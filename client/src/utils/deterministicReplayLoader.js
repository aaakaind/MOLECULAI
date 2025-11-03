/**
 * Deterministic Replay Loader
 * Loads and replays recorded collaboration sessions with exact state reproduction
 * 
 * Features:
 * - Frame-perfect replay of user interactions
 * - Time-warp scrubbing (forward/backward/speed control)
 * - State snapshot restoration
 * - Multi-user action visualization
 * - Binary format for compact storage
 * 
 * Extension points:
 * - Add replay filters (by user, action type)
 * - Implement replay branching (what-if scenarios)
 * - Add replay analytics and metrics
 * - Implement differential snapshots for efficiency
 */

import * as Y from 'yjs';

/**
 * Replay event types
 */
const EventType = {
  STATE_SNAPSHOT: 'state-snapshot',
  CURSOR_UPDATE: 'cursor-update',
  SELECTION_UPDATE: 'selection-update',
  CRDT_UPDATE: 'crdt-update',
  CHAT_MESSAGE: 'chat-message',
  PARTICIPANT_JOINED: 'participant-joined',
  PARTICIPANT_LEFT: 'participant-left',
  CAMERA_UPDATE: 'camera-update',
  ANNOTATION_ADDED: 'annotation-added',
  PLAYBACK_CONTROL: 'playback-control'
};

/**
 * Replay snapshot structure
 */
class ReplaySnapshot {
  constructor(data) {
    this.timestamp = data.timestamp;
    this.relativeTime = data.relativeTime;
    this.type = data.type;
    this.userId = data.userId;
    this.payload = data.payload;
  }

  /**
   * Serialize snapshot to binary format
   * Extension point: Add compression, encryption
   */
  toBinary() {
    const encoder = new TextEncoder();
    const payloadStr = JSON.stringify(this.payload);
    const payloadBytes = encoder.encode(payloadStr);
    
    const buffer = new ArrayBuffer(
      8 + // timestamp (double)
      8 + // relativeTime (double)
      1 + // type (byte)
      36 + // userId (UUID string)
      4 + // payload length (uint32)
      payloadBytes.length
    );

    const view = new DataView(buffer);
    let offset = 0;

    // Write timestamp
    view.setFloat64(offset, this.timestamp, true);
    offset += 8;

    // Write relative time
    view.setFloat64(offset, this.relativeTime, true);
    offset += 8;

    // Write type (as enum index)
    const typeIndex = Object.values(EventType).indexOf(this.type);
    view.setUint8(offset, typeIndex);
    offset += 1;

    // Write userId (padded to 36 bytes)
    const userIdBytes = encoder.encode(this.userId.padEnd(36, '\0'));
    new Uint8Array(buffer, offset, 36).set(userIdBytes);
    offset += 36;

    // Write payload length
    view.setUint32(offset, payloadBytes.length, true);
    offset += 4;

    // Write payload
    new Uint8Array(buffer, offset).set(payloadBytes);

    return buffer;
  }

  /**
   * Deserialize from binary format
   */
  static fromBinary(buffer) {
    const view = new DataView(buffer);
    const decoder = new TextDecoder();
    let offset = 0;

    // Read timestamp
    const timestamp = view.getFloat64(offset, true);
    offset += 8;

    // Read relative time
    const relativeTime = view.getFloat64(offset, true);
    offset += 8;

    // Read type
    const typeIndex = view.getUint8(offset);
    const type = Object.values(EventType)[typeIndex];
    offset += 1;

    // Read userId
    const userIdBytes = new Uint8Array(buffer, offset, 36);
    const userId = decoder.decode(userIdBytes).replace(/\0/g, '');
    offset += 36;

    // Read payload length
    const payloadLength = view.getUint32(offset, true);
    offset += 4;

    // Read payload
    const payloadBytes = new Uint8Array(buffer, offset, payloadLength);
    const payloadStr = decoder.decode(payloadBytes);
    const payload = JSON.parse(payloadStr);

    return new ReplaySnapshot({
      timestamp,
      relativeTime,
      type,
      userId,
      payload
    });
  }
}

/**
 * Main replay loader class
 */
export class DeterministicReplayLoader {
  constructor(recording) {
    this.recording = recording;
    this.snapshots = recording.snapshots.map(s => new ReplaySnapshot(s));
    this.currentIndex = 0;
    this.isPlaying = false;
    this.playbackSpeed = 1.0;
    this.startTime = null;
    this.pausedTime = 0;
    
    // State restoration
    this.yDoc = new Y.Doc();
    this.sharedState = this.yDoc.getMap('state');
    this.participants = new Map();
    this.cursors = new Map();
    this.selections = new Map();
    
    // Event listeners
    this.listeners = new Map();
    
    // Initialize from first snapshot (should be initial state)
    this.initializeState();
  }

  /**
   * Initialize state from recording
   */
  initializeState() {
    const firstSnapshot = this.snapshots[0];
    if (firstSnapshot && firstSnapshot.type === EventType.STATE_SNAPSHOT) {
      this.restoreState(firstSnapshot.payload.state);
    }
  }

  /**
   * Restore complete state from snapshot
   * Extension point: Add validation, error recovery
   */
  restoreState(stateData) {
    // Clear existing state
    this.yDoc.destroy();
    this.yDoc = new Y.Doc();
    this.sharedState = this.yDoc.getMap('state');

    // Restore state structure
    Object.entries(stateData).forEach(([key, value]) => {
      this.sharedState.set(key, value);
    });

    this.emit('state-restored', { state: stateData });
  }

  /**
   * Start replay
   */
  play() {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.startTime = Date.now() - this.pausedTime;
    this.playbackLoop();
    this.emit('play', { speed: this.playbackSpeed });
  }

  /**
   * Pause replay
   */
  pause() {
    if (!this.isPlaying) return;

    this.isPlaying = false;
    this.pausedTime = Date.now() - this.startTime;
    this.emit('pause', { time: this.getCurrentTime() });
  }

  /**
   * Stop and reset replay
   */
  stop() {
    this.isPlaying = false;
    this.currentIndex = 0;
    this.startTime = null;
    this.pausedTime = 0;
    this.initializeState();
    this.emit('stop');
  }

  /**
   * Seek to specific time (in milliseconds)
   * Implements time-warp scrubbing
   */
  seek(targetTime) {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) this.pause();

    // Find the closest snapshot before or at target time
    let targetIndex = 0;
    for (let i = 0; i < this.snapshots.length; i++) {
      if (this.snapshots[i].relativeTime <= targetTime) {
        targetIndex = i;
      } else {
        break;
      }
    }

    // Find the last state snapshot before target
    let stateSnapshotIndex = -1;
    for (let i = targetIndex; i >= 0; i--) {
      if (this.snapshots[i].type === EventType.STATE_SNAPSHOT) {
        stateSnapshotIndex = i;
        break;
      }
    }

    // Restore from state snapshot
    if (stateSnapshotIndex >= 0) {
      this.restoreState(this.snapshots[stateSnapshotIndex].payload.state);
      this.currentIndex = stateSnapshotIndex + 1;
    } else {
      this.currentIndex = 0;
    }

    // Apply events up to target time
    while (this.currentIndex <= targetIndex) {
      this.applySnapshot(this.snapshots[this.currentIndex]);
      this.currentIndex++;
    }

    this.pausedTime = targetTime;
    this.emit('seek', { time: targetTime });

    if (wasPlaying) this.play();
  }

  /**
   * Seek by frame count
   */
  seekToFrame(frameIndex) {
    if (frameIndex < 0 || frameIndex >= this.snapshots.length) return;
    const targetSnapshot = this.snapshots[frameIndex];
    this.seek(targetSnapshot.relativeTime);
  }

  /**
   * Set playback speed
   * Extension point: Add frame-skipping for very high speeds
   */
  setPlaybackSpeed(speed) {
    const currentTime = this.getCurrentTime();
    this.playbackSpeed = Math.max(0.1, Math.min(10.0, speed));
    
    if (this.isPlaying) {
      this.startTime = Date.now() - currentTime;
    }
    
    this.emit('speed-changed', { speed: this.playbackSpeed });
  }

  /**
   * Get current playback time
   */
  getCurrentTime() {
    if (!this.isPlaying) return this.pausedTime;
    return (Date.now() - this.startTime) * this.playbackSpeed;
  }

  /**
   * Get replay progress (0-1)
   */
  getProgress() {
    if (this.snapshots.length === 0) return 0;
    const lastSnapshot = this.snapshots[this.snapshots.length - 1];
    return this.getCurrentTime() / lastSnapshot.relativeTime;
  }

  /**
   * Main playback loop
   */
  playbackLoop() {
    if (!this.isPlaying) return;

    const currentTime = this.getCurrentTime();
    
    // Apply all snapshots up to current time
    while (this.currentIndex < this.snapshots.length) {
      const snapshot = this.snapshots[this.currentIndex];
      
      if (snapshot.relativeTime <= currentTime) {
        this.applySnapshot(snapshot);
        this.currentIndex++;
      } else {
        break;
      }
    }

    // Check if replay is complete
    if (this.currentIndex >= this.snapshots.length) {
      this.stop();
      this.emit('complete');
      return;
    }

    // Schedule next frame
    requestAnimationFrame(() => this.playbackLoop());
  }

  /**
   * Apply a single snapshot to current state
   * Extension point: Add custom handlers for different event types
   */
  applySnapshot(snapshot) {
    switch (snapshot.type) {
      case EventType.CURSOR_UPDATE:
        this.cursors.set(snapshot.userId, snapshot.payload.cursor);
        this.emit('cursor-update', {
          userId: snapshot.userId,
          cursor: snapshot.payload.cursor
        });
        break;

      case EventType.SELECTION_UPDATE:
        this.selections.set(snapshot.userId, new Set(snapshot.payload.selection));
        this.emit('selection-update', {
          userId: snapshot.userId,
          selection: snapshot.payload.selection
        });
        break;

      case EventType.CRDT_UPDATE:
        // Apply CRDT update to document
        Y.applyUpdate(this.yDoc, new Uint8Array(snapshot.payload.update));
        this.emit('crdt-update', { userId: snapshot.userId });
        break;

      case EventType.PARTICIPANT_JOINED:
        this.participants.set(snapshot.userId, {
          userId: snapshot.userId,
          joinedAt: snapshot.relativeTime
        });
        this.emit('participant-joined', { userId: snapshot.userId });
        break;

      case EventType.PARTICIPANT_LEFT:
        this.participants.delete(snapshot.userId);
        this.cursors.delete(snapshot.userId);
        this.selections.delete(snapshot.userId);
        this.emit('participant-left', { userId: snapshot.userId });
        break;

      case EventType.CHAT_MESSAGE:
        this.emit('chat-message', snapshot.payload);
        break;

      case EventType.CAMERA_UPDATE:
        this.emit('camera-update', snapshot.payload);
        break;

      case EventType.ANNOTATION_ADDED:
        this.emit('annotation-added', snapshot.payload);
        break;

      default:
        console.warn(`Unknown snapshot type: ${snapshot.type}`);
    }

    // Emit generic event
    this.emit('snapshot', snapshot);
  }

  /**
   * Event emitter
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach(callback => callback(data));
  }

  /**
   * Export replay to binary format
   */
  toBinary() {
    const snapshots = this.snapshots.map(s => s.toBinary());
    const totalSize = snapshots.reduce((sum, buf) => sum + buf.byteLength, 0);
    
    // Create header
    const headerSize = 32;
    const buffer = new ArrayBuffer(headerSize + totalSize);
    const view = new DataView(buffer);
    
    // Write header
    view.setUint32(0, this.snapshots.length, true); // snapshot count
    view.setFloat64(4, this.recording.duration, true); // duration
    
    // Write snapshots
    let offset = headerSize;
    snapshots.forEach(snapshotBuffer => {
      new Uint8Array(buffer, offset).set(new Uint8Array(snapshotBuffer));
      offset += snapshotBuffer.byteLength;
    });

    return buffer;
  }

  /**
   * Get replay statistics
   */
  getStatistics() {
    const eventCounts = {};
    this.snapshots.forEach(s => {
      eventCounts[s.type] = (eventCounts[s.type] || 0) + 1;
    });

    return {
      totalSnapshots: this.snapshots.length,
      duration: this.recording.duration,
      participantCount: this.recording.participants.length,
      eventCounts,
      avgEventsPerSecond: (this.snapshots.length / (this.recording.duration / 1000)).toFixed(2)
    };
  }
}

export default DeterministicReplayLoader;
export { EventType, ReplaySnapshot };
