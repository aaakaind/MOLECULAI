/**
 * MCP Session Handshake Example
 * Demonstrates how to establish a connection with the MCP collaboration server
 * 
 * This example shows:
 * - WebSocket connection establishment
 * - Authentication handshake
 * - Room creation and joining
 * - Message handling
 */

// Client-side implementation
class MCPClient {
  constructor(wsUrl, authToken) {
    this.wsUrl = wsUrl;
    this.authToken = authToken;
    this.ws = null;
    this.sessionId = null;
    this.roomId = null;
    this.messageHandlers = new Map();
  }

  /**
   * Connect to MCP server and perform handshake
   */
  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
      };
    });
  }

  /**
   * Create a new collaboration room
   */
  async createRoom(moleculeId, userId) {
    return new Promise((resolve, reject) => {
      // Send handshake message to create room
      const handshake = {
        type: 'handshake',
        action: 'create-room',
        userId,
        moleculeId,
        token: this.authToken
      };

      // Set up one-time handler for room creation response
      this.once('room-created', (data) => {
        this.sessionId = data.sessionId;
        this.roomId = data.roomId;
        console.log(`Room created: ${this.roomId}`);
        resolve(data);
      });

      this.once('handshake-error', (error) => {
        console.error('Handshake error:', error);
        reject(error);
      });

      this.send(handshake);
    });
  }

  /**
   * Join an existing collaboration room
   */
  async joinRoom(roomId, userId) {
    return new Promise((resolve, reject) => {
      const handshake = {
        type: 'handshake',
        action: 'join-room',
        userId,
        roomId,
        token: this.authToken
      };

      this.once('room-joined', (data) => {
        this.sessionId = data.sessionId;
        this.roomId = data.roomId;
        console.log(`Joined room: ${this.roomId}`);
        resolve(data);
      });

      this.once('handshake-error', (error) => {
        console.error('Handshake error:', error);
        reject(error);
      });

      this.send(handshake);
    });
  }

  /**
   * List available rooms
   */
  async listRooms(userId) {
    return new Promise((resolve) => {
      const handshake = {
        type: 'handshake',
        action: 'list-rooms',
        userId,
        token: this.authToken
      };

      this.once('room-list', (data) => {
        resolve(data.rooms);
      });

      this.send(handshake);
    });
  }

  /**
   * Send a message to the server
   */
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket not connected');
    }
  }

  /**
   * Handle incoming messages
   */
  handleMessage(message) {
    const handlers = this.messageHandlers.get(message.type) || [];
    handlers.forEach(handler => handler(message));
  }

  /**
   * Register message handler
   */
  on(type, handler) {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type).push(handler);
  }

  /**
   * Register one-time message handler
   */
  once(type, handler) {
    const wrappedHandler = (message) => {
      handler(message);
      this.off(type, wrappedHandler);
    };
    this.on(type, wrappedHandler);
  }

  /**
   * Unregister message handler
   */
  off(type, handler) {
    if (!this.messageHandlers.has(type)) return;
    const handlers = this.messageHandlers.get(type);
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Usage example
async function example() {
  // Initialize client
  const client = new MCPClient('ws://localhost:4000', 'your-auth-token');

  try {
    // Connect to server
    await client.connect();
    console.log('Connected to MCP server');

    // Create a new room
    const roomData = await client.createRoom('water', 'user-123');
    console.log('Room created:', roomData);

    // Listen for participant events
    client.on('participant-joined', (data) => {
      console.log('Participant joined:', data.participant);
    });

    client.on('participant-left', (data) => {
      console.log('Participant left:', data.userId);
    });

    // Listen for state updates
    client.on('crdt-update', (data) => {
      console.log('State updated by:', data.origin);
    });

    // Send cursor update
    client.send({
      type: 'cursor-update',
      payload: {
        x: 100,
        y: 200,
        z: 0
      }
    });

    // Send selection update
    client.send({
      type: 'selection-update',
      payload: {
        selection: [0, 1, 2] // atom indices
      }
    });

    // Send chat message
    client.send({
      type: 'chat-message',
      payload: {
        username: 'User123',
        text: 'Hello, everyone!'
      }
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

// Alternative: Join existing room
async function joinExistingRoom() {
  const client = new MCPClient('ws://localhost:4000', 'your-auth-token');

  try {
    await client.connect();

    // List available rooms
    const rooms = await client.listRooms('user-456');
    console.log('Available rooms:', rooms);

    // Join first available room
    if (rooms.length > 0) {
      const roomData = await client.joinRoom(rooms[0].roomId, 'user-456');
      console.log('Joined room:', roomData);

      // Room state is automatically synced
      client.on('room-joined', (data) => {
        console.log('Current state:', data.state);
        console.log('Participants:', data.participants);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

// Export for use in other modules
export { MCPClient, example, joinExistingRoom };
