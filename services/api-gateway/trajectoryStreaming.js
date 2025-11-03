/**
 * Trajectory Streaming Endpoint
 * Efficiently streams large molecular dynamics trajectories to clients
 * 
 * Features:
 * - Chunked binary streaming for large files
 * - Format support: DCD, TRR, XTC, custom binary
 * - Frame interpolation for smooth playback
 * - Compression and caching
 * - Range requests for seeking
 * 
 * Extension points:
 * - Add support for more trajectory formats
 * - Implement server-side frame filtering
 * - Add on-the-fly analysis during streaming
 * - Implement adaptive streaming based on network conditions
 */

import { createReadStream, statSync } from 'fs';
import { pipeline } from 'stream';
import { createGzip } from 'zlib';
import { promisify } from 'util';

const pipelineAsync = promisify(pipeline);

/**
 * Trajectory metadata structure
 */
class TrajectoryMetadata {
  constructor(data) {
    this.id = data.id;
    this.format = data.format; // 'dcd', 'trr', 'xtc', 'custom'
    this.frameCount = data.frameCount;
    this.atomCount = data.atomCount;
    this.timestep = data.timestep; // in picoseconds
    this.totalTime = data.totalTime;
    this.filePath = data.filePath;
    this.fileSize = data.fileSize;
    this.compressed = data.compressed || false;
  }

  getFrameSize() {
    // Calculate approximate frame size in bytes
    // For coordinates: atomCount * 3 (x,y,z) * 4 bytes (float32)
    return this.atomCount * 3 * 4;
  }

  getFrameOffset(frameIndex) {
    // Calculate byte offset for a specific frame
    // This is format-dependent
    switch (this.format) {
      case 'custom':
        return this.getCustomFrameOffset(frameIndex);
      case 'dcd':
        return this.getDCDFrameOffset(frameIndex);
      default:
        return frameIndex * this.getFrameSize();
    }
  }

  getCustomFrameOffset(frameIndex) {
    // Custom format: [header (256 bytes)] [frame1] [frame2] ...
    const headerSize = 256;
    const frameSize = this.getFrameSize() + 16; // 16 bytes frame metadata
    return headerSize + (frameIndex * frameSize);
  }

  getDCDFrameOffset(frameIndex) {
    // DCD format offset calculation
    const headerSize = 276; // DCD header
    const frameSize = this.atomCount * 12 + 24; // 3 floats per atom + frame header
    return headerSize + (frameIndex * frameSize);
  }
}

/**
 * Binary frame parser
 * Extension point: Add parsers for different formats
 */
class TrajectoryParser {
  static parseFrame(buffer, format, atomCount) {
    switch (format) {
      case 'custom':
        return this.parseCustomFrame(buffer, atomCount);
      case 'dcd':
        return this.parseDCDFrame(buffer, atomCount);
      default:
        return this.parseGenericFrame(buffer, atomCount);
    }
  }

  static parseCustomFrame(buffer, atomCount) {
    const frame = {
      timestamp: buffer.readFloatLE(0),
      temperature: buffer.readFloatLE(4),
      energy: buffer.readFloatLE(8),
      coordinates: []
    };

    let offset = 16; // Skip metadata
    for (let i = 0; i < atomCount; i++) {
      frame.coordinates.push({
        x: buffer.readFloatLE(offset),
        y: buffer.readFloatLE(offset + 4),
        z: buffer.readFloatLE(offset + 8)
      });
      offset += 12;
    }

    return frame;
  }

  static parseDCDFrame(buffer, atomCount) {
    // DCD format: X coords, Y coords, Z coords (separate arrays)
    const frame = { coordinates: [] };
    const floatSize = 4;
    
    for (let i = 0; i < atomCount; i++) {
      frame.coordinates.push({
        x: buffer.readFloatLE(i * floatSize),
        y: buffer.readFloatLE((atomCount + i) * floatSize),
        z: buffer.readFloatLE((2 * atomCount + i) * floatSize)
      });
    }

    return frame;
  }

  static parseGenericFrame(buffer, atomCount) {
    // Generic XYZ format
    const frame = { coordinates: [] };
    let offset = 0;

    for (let i = 0; i < atomCount; i++) {
      frame.coordinates.push({
        x: buffer.readFloatLE(offset),
        y: buffer.readFloatLE(offset + 4),
        z: buffer.readFloatLE(offset + 8)
      });
      offset += 12;
    }

    return frame;
  }

  /**
   * Interpolate between two frames for smooth playback
   * Extension point: Add different interpolation methods (linear, cubic, spline)
   */
  static interpolateFrames(frame1, frame2, t) {
    if (!frame1 || !frame2) return frame1 || frame2;

    const interpolated = {
      coordinates: []
    };

    for (let i = 0; i < frame1.coordinates.length; i++) {
      const c1 = frame1.coordinates[i];
      const c2 = frame2.coordinates[i];

      interpolated.coordinates.push({
        x: c1.x + (c2.x - c1.x) * t,
        y: c1.y + (c2.y - c1.y) * t,
        z: c1.z + (c2.z - c1.z) * t
      });
    }

    return interpolated;
  }
}

/**
 * Streaming trajectory handler
 */
export class TrajectoryStreamHandler {
  constructor(metadata) {
    this.metadata = new TrajectoryMetadata(metadata);
    this.cache = new Map(); // Frame cache
    this.maxCacheSize = 100; // frames
  }

  /**
   * Stream entire trajectory
   * Uses HTTP chunked transfer encoding
   */
  async streamTrajectory(req, res) {
    const { compress = false } = req.query;

    try {
      // Set headers for streaming
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('X-Frame-Count', this.metadata.frameCount);
      res.setHeader('X-Atom-Count', this.metadata.atomCount);
      res.setHeader('X-Format', this.metadata.format);

      if (compress) {
        res.setHeader('Content-Encoding', 'gzip');
      }

      // Create read stream
      const fileStream = createReadStream(this.metadata.filePath, {
        highWaterMark: 64 * 1024 // 64KB chunks
      });

      // Apply compression if requested
      if (compress) {
        await pipelineAsync(fileStream, createGzip(), res);
      } else {
        await pipelineAsync(fileStream, res);
      }

    } catch (error) {
      console.error('Streaming error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Streaming failed' });
      }
    }
  }

  /**
   * Stream specific frame range
   * Supports HTTP Range requests for seeking
   */
  async streamFrameRange(req, res) {
    const { start, end } = req.query;
    const startFrame = parseInt(start) || 0;
    const endFrame = parseInt(end) || this.metadata.frameCount - 1;

    // Validate range
    if (startFrame < 0 || endFrame >= this.metadata.frameCount || startFrame > endFrame) {
      return res.status(400).json({ error: 'Invalid frame range' });
    }

    try {
      const startOffset = this.metadata.getFrameOffset(startFrame);
      const endOffset = this.metadata.getFrameOffset(endFrame + 1);
      const rangeSize = endOffset - startOffset;

      // Set headers
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Length', rangeSize);
      res.setHeader('Content-Range', `bytes ${startOffset}-${endOffset - 1}/${this.metadata.fileSize}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.status(206); // Partial Content

      // Stream the range
      const fileStream = createReadStream(this.metadata.filePath, {
        start: startOffset,
        end: endOffset - 1,
        highWaterMark: 64 * 1024
      });

      await pipelineAsync(fileStream, res);

    } catch (error) {
      console.error('Range streaming error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Range streaming failed' });
      }
    }
  }

  /**
   * Get specific frames (parsed)
   * Returns JSON data for client-side rendering
   */
  async getFrames(req, res) {
    const { frames, interpolate = false } = req.query;
    
    if (!frames) {
      return res.status(400).json({ error: 'Frame indices required' });
    }

    const frameIndices = frames.split(',').map(f => parseInt(f));
    const results = [];

    try {
      for (let i = 0; i < frameIndices.length; i++) {
        const frameIndex = frameIndices[i];
        
        // Check cache first
        let frame = this.cache.get(frameIndex);
        
        if (!frame) {
          // Read and parse frame
          frame = await this.readFrame(frameIndex);
          this.cacheFrame(frameIndex, frame);
        }

        // Interpolate if requested and next frame is sequential
        if (interpolate && i < frameIndices.length - 1) {
          const nextIndex = frameIndices[i + 1];
          if (nextIndex === frameIndex + 1) {
            const nextFrame = await this.readFrame(nextIndex);
            // Add interpolated frames
            for (let t = 0.25; t < 1.0; t += 0.25) {
              results.push(TrajectoryParser.interpolateFrames(frame, nextFrame, t));
            }
          }
        }

        results.push(frame);
      }

      res.json({
        frames: results,
        metadata: {
          atomCount: this.metadata.atomCount,
          timestep: this.metadata.timestep
        }
      });

    } catch (error) {
      console.error('Frame parsing error:', error);
      res.status(500).json({ error: 'Failed to parse frames' });
    }
  }

  /**
   * Read and parse a single frame
   */
  async readFrame(frameIndex) {
    return new Promise((resolve, reject) => {
      const offset = this.metadata.getFrameOffset(frameIndex);
      const frameSize = this.metadata.getFrameSize() + 16; // Include metadata

      const stream = createReadStream(this.metadata.filePath, {
        start: offset,
        end: offset + frameSize - 1
      });

      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const frame = TrajectoryParser.parseFrame(
          buffer,
          this.metadata.format,
          this.metadata.atomCount
        );
        resolve(frame);
      });
      stream.on('error', reject);
    });
  }

  /**
   * Cache management
   */
  cacheFrame(frameIndex, frame) {
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entry (FIFO)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(frameIndex, frame);
  }

  /**
   * Get trajectory metadata
   */
  getMetadata(req, res) {
    res.json({
      id: this.metadata.id,
      format: this.metadata.format,
      frameCount: this.metadata.frameCount,
      atomCount: this.metadata.atomCount,
      timestep: this.metadata.timestep,
      totalTime: this.metadata.totalTime,
      fileSize: this.metadata.fileSize
    });
  }
}

/**
 * Express route setup
 * Extension point: Add authentication, rate limiting, analytics
 */
export function setupTrajectoryRoutes(app, trajectoryManager) {
  // Get trajectory metadata
  app.get('/api/trajectories/:id/metadata', (req, res) => {
    const handler = trajectoryManager.get(req.params.id);
    if (!handler) {
      return res.status(404).json({ error: 'Trajectory not found' });
    }
    handler.getMetadata(req, res);
  });

  // Stream entire trajectory
  app.get('/api/trajectories/:id/stream', (req, res) => {
    const handler = trajectoryManager.get(req.params.id);
    if (!handler) {
      return res.status(404).json({ error: 'Trajectory not found' });
    }
    handler.streamTrajectory(req, res);
  });

  // Stream frame range
  app.get('/api/trajectories/:id/stream/range', (req, res) => {
    const handler = trajectoryManager.get(req.params.id);
    if (!handler) {
      return res.status(404).json({ error: 'Trajectory not found' });
    }
    handler.streamFrameRange(req, res);
  });

  // Get specific frames (parsed)
  app.get('/api/trajectories/:id/frames', (req, res) => {
    const handler = trajectoryManager.get(req.params.id);
    if (!handler) {
      return res.status(404).json({ error: 'Trajectory not found' });
    }
    handler.getFrames(req, res);
  });
}

export default TrajectoryStreamHandler;
