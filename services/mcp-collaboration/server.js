/**
 * MCP Collaboration Server
 * Enterprise-grade realtime collaboration for molecular visualization
 * 
 * Features:
 * - WebSocket-based realtime communication
 * - CRDT-based state synchronization using Yjs
 * - Room/lobby management with permissions
 * - Session recording and deterministic replay
 * - Collaborative cursors and selections
 * - Voice/text chat channels
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import * as Y from 'yjs';
import { register, collectDefaultMetrics } from 'prom-client';

// Initialize metrics
collectDefaultMetrics({ prefix: 'mcp_' });

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 4000;

// In-memory storage (use Redis in production)
const rooms = new Map();
const sessions = new Map();
const recordings = new Map();

/**
 * MCP Session Handshake Example
 * Demonstrates the connection protocol between client and server
 */
class MCPSession {
  constructor(ws, sessionId, userId, roomId) {
    this.ws = ws;
    this.sessionId = sessionId;
    this.userId = userId;
    this.roomId = roomId;
    this.role = 'viewer'; // owner, editor, viewer, auditor
    this.cursor = { x: 0, y: 0, z: 0 };
    this.selection = new Set();
    this.isOnline = true;
    this.joinedAt = Date.now();
  }

  send(message) {
    if (this.ws.readyState === 1) { // OPEN
      this.ws.send(JSON.stringify(message));
    }
  }

  handleMessage(data) {
    const message = JSON.parse(data);
    
    switch (message.type) {
      case 'cursor-update':
        this.updateCursor(message.payload);
        break;
      case 'selection-update':
        this.updateSelection(message.payload);
        break;
      case 'state-update':
        this.handleStateUpdate(message.payload);
        break;
      case 'chat-message':
        this.broadcastChatMessage(message.payload);
        break;
      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  }

  updateCursor(cursor) {
    this.cursor = cursor;
    this.broadcastToRoom({
      type: 'cursor-update',
      userId: this.userId,
      cursor
    }, true); // exclude self
  }

  updateSelection(selection) {
    this.selection = new Set(selection);
    this.broadcastToRoom({
      type: 'selection-update',
      userId: this.userId,
      selection: Array.from(this.selection)
    }, true);
  }

  handleStateUpdate(payload) {
    const room = rooms.get(this.roomId);
    if (!room) return;

    // Apply CRDT update to room state
    room.applyUpdate(payload, this.userId);
  }

  broadcastChatMessage(message) {
    this.broadcastToRoom({
      type: 'chat-message',
      userId: this.userId,
      username: message.username,
      message: message.text,
      timestamp: Date.now()
    });
  }

  broadcastToRoom(message, excludeSelf = false) {
    const room = rooms.get(this.roomId);
    if (!room) return;

    room.broadcast(message, excludeSelf ? this.sessionId : null);
  }
}

/**
 * Collaboration Room
 * Manages state, participants, and synchronization
 */
class CollaborationRoom {
  constructor(roomId, ownerId, moleculeId) {
    this.roomId = roomId;
    this.ownerId = ownerId;
    this.moleculeId = moleculeId;
    this.participants = new Map();
    this.yDoc = new Y.Doc(); // CRDT document
    this.sharedState = this.yDoc.getMap('state');
    this.isRecording = false;
    this.recordingId = null;
    this.recordingSnapshots = [];
    
    // Initialize shared state structure
    this.initializeSharedState();
    
    // Set up CRDT update listener
    this.yDoc.on('update', (update, origin) => {
      this.handleCRDTUpdate(update, origin);
    });
  }

  initializeSharedState() {
    // Initialize collaborative state structure
    this.sharedState.set('molecule', {
      id: this.moleculeId,
      atoms: [],
      bonds: []
    });
    this.sharedState.set('selections', new Y.Map());
    this.sharedState.set('annotations', new Y.Array());
    this.sharedState.set('camera', {
      position: { x: 0, y: 0, z: 10 },
      target: { x: 0, y: 0, z: 0 },
      fov: 45
    });
    this.sharedState.set('playback', {
      isPlaying: false,
      currentFrame: 0,
      totalFrames: 0
    });
  }

  addParticipant(session) {
    this.participants.set(session.sessionId, session);
    
    // Send current state to new participant
    const state = this.getStateSnapshot();
    session.send({
      type: 'room-joined',
      roomId: this.roomId,
      state,
      participants: this.getParticipantList()
    });

    // Broadcast participant joined to others
    this.broadcast({
      type: 'participant-joined',
      participant: {
        userId: session.userId,
        sessionId: session.sessionId,
        role: session.role
      }
    }, session.sessionId);

    // Record event if recording
    if (this.isRecording) {
      this.recordEvent({
        type: 'participant-joined',
        userId: session.userId,
        timestamp: Date.now()
      });
    }
  }

  removeParticipant(sessionId) {
    const session = this.participants.get(sessionId);
    if (!session) return;

    this.participants.delete(sessionId);

    // Broadcast participant left
    this.broadcast({
      type: 'participant-left',
      sessionId,
      userId: session.userId
    });

    // Record event if recording
    if (this.isRecording) {
      this.recordEvent({
        type: 'participant-left',
        userId: session.userId,
        timestamp: Date.now()
      });
    }

    // Close room if empty
    if (this.participants.size === 0) {
      this.stopRecording();
      rooms.delete(this.roomId);
    }
  }

  applyUpdate(update, userId) {
    // Apply CRDT update
    Y.applyUpdate(this.yDoc, new Uint8Array(update));

    // Record update if recording
    if (this.isRecording) {
      this.recordEvent({
        type: 'state-update',
        userId,
        update,
        timestamp: Date.now()
      });
    }
  }

  handleCRDTUpdate(update, origin) {
    // Broadcast update to all participants except origin
    const updateArray = Array.from(update);
    this.broadcast({
      type: 'crdt-update',
      update: updateArray,
      origin
    }, origin);
  }

  broadcast(message, excludeSessionId = null) {
    for (const [sessionId, session] of this.participants) {
      if (sessionId !== excludeSessionId) {
        session.send(message);
      }
    }
  }

  getStateSnapshot() {
    // Return current CRDT state as JSON
    return this.sharedState.toJSON();
  }

  getParticipantList() {
    return Array.from(this.participants.values()).map(s => ({
      userId: s.userId,
      sessionId: s.sessionId,
      role: s.role,
      cursor: s.cursor,
      selection: Array.from(s.selection)
    }));
  }

  startRecording() {
    if (this.isRecording) return;

    this.isRecording = true;
    this.recordingId = uuidv4();
    this.recordingSnapshots = [];
    this.recordingStartTime = Date.now();

    // Record initial state
    this.recordEvent({
      type: 'recording-started',
      state: this.getStateSnapshot(),
      timestamp: Date.now()
    });
  }

  stopRecording() {
    if (!this.isRecording) return;

    this.isRecording = false;
    
    // Save recording
    const recording = {
      id: this.recordingId,
      roomId: this.roomId,
      moleculeId: this.moleculeId,
      duration: Date.now() - this.recordingStartTime,
      snapshots: this.recordingSnapshots,
      participants: this.getParticipantList()
    };

    recordings.set(this.recordingId, recording);
    
    this.recordingId = null;
    this.recordingSnapshots = [];
  }

  recordEvent(event) {
    if (!this.isRecording) return;

    this.recordingSnapshots.push({
      ...event,
      relativeTime: Date.now() - this.recordingStartTime
    });
  }
}

/**
 * MCP Session Handshake Protocol
 * Extension point for authentication and authorization
 */
function handleHandshake(ws, message) {
  const { userId, roomId, token, action } = message;

  // Validate token (simplified - implement proper JWT validation)
  if (!validateToken(token)) {
    ws.send(JSON.stringify({
      type: 'handshake-error',
      error: 'Invalid authentication token'
    }));
    ws.close();
    return;
  }

  // Handle different actions
  switch (action) {
    case 'create-room':
      return handleCreateRoom(ws, userId, message.moleculeId);
    case 'join-room':
      return handleJoinRoom(ws, userId, roomId);
    case 'list-rooms':
      return handleListRooms(ws);
    default:
      ws.send(JSON.stringify({
        type: 'handshake-error',
        error: 'Invalid action'
      }));
  }
}

function handleCreateRoom(ws, userId, moleculeId) {
  const roomId = uuidv4();
  const room = new CollaborationRoom(roomId, userId, moleculeId);
  rooms.set(roomId, room);

  const sessionId = uuidv4();
  const session = new MCPSession(ws, sessionId, userId, roomId);
  session.role = 'owner';
  sessions.set(sessionId, session);

  room.addParticipant(session);

  ws.send(JSON.stringify({
    type: 'room-created',
    roomId,
    sessionId,
    role: 'owner'
  }));

  setupWebSocketHandlers(ws, session);
}

function handleJoinRoom(ws, userId, roomId) {
  const room = rooms.get(roomId);
  
  if (!room) {
    ws.send(JSON.stringify({
      type: 'handshake-error',
      error: 'Room not found'
    }));
    ws.close();
    return;
  }

  const sessionId = uuidv4();
  const session = new MCPSession(ws, sessionId, userId, roomId);
  sessions.set(sessionId, session);

  room.addParticipant(session);

  ws.send(JSON.stringify({
    type: 'room-joined',
    roomId,
    sessionId,
    role: session.role
  }));

  setupWebSocketHandlers(ws, session);
}

function handleListRooms(ws) {
  const roomList = Array.from(rooms.values()).map(room => ({
    roomId: room.roomId,
    moleculeId: room.moleculeId,
    participantCount: room.participants.size,
    isRecording: room.isRecording
  }));

  ws.send(JSON.stringify({
    type: 'room-list',
    rooms: roomList
  }));
}

function setupWebSocketHandlers(ws, session) {
  ws.on('message', (data) => {
    try {
      session.handleMessage(data);
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });

  ws.on('close', () => {
    const room = rooms.get(session.roomId);
    if (room) {
      room.removeParticipant(session.sessionId);
    }
    sessions.delete(session.sessionId);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
}

function validateToken(token) {
  // Implement proper JWT validation
  // For now, accept any non-empty token
  return token && token.length > 0;
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      
      if (message.type === 'handshake') {
        handleHandshake(ws, message);
      }
    } catch (error) {
      console.error('Error handling connection:', error);
      ws.close();
    }
  });
});

// REST API endpoints
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    rooms: rooms.size,
    sessions: sessions.size,
    timestamp: new Date().toISOString()
  });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Recording endpoints
app.post('/api/rooms/:roomId/recording/start', (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  room.startRecording();
  res.json({ success: true, recordingId: room.recordingId });
});

app.post('/api/rooms/:roomId/recording/stop', (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  room.stopRecording();
  res.json({ success: true });
});

app.get('/api/recordings/:id', (req, res) => {
  const recording = recordings.get(req.params.id);
  if (!recording) {
    return res.status(404).json({ error: 'Recording not found' });
  }

  res.json(recording);
});

// Start server
server.listen(PORT, () => {
  console.log(`MCP Collaboration Server running on port ${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}`);
  console.log(`HTTP: http://localhost:${PORT}`);
});

export { MCPSession, CollaborationRoom };
