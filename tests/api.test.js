/**
 * Tests for API endpoints
 */

import request from 'supertest';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import moleculeServer from '../mcp-server/molecules-server.js';

// Create a test version of the app
function createTestApp() {
  const app = express();
  const JWT_SECRET = 'test-secret-key';

  // Middleware
  app.use(cors());
  app.use(bodyParser.json());

  // In-memory storage for tests
  const users = new Map();
  const savedVisualizations = new Map();

  // Authentication middleware
  const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
      }
      req.user = user;
      next();
    });
  };

  // Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }

      if (users.has(username)) {
        return res.status(400).json({ error: 'Username already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      users.set(username, {
        username,
        password: hashedPassword,
        createdAt: new Date().toISOString()
      });

      const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token, username });
    } catch (error) {
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;

      const user = users.get(username);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token, username });
    } catch (error) {
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // Molecule routes
  app.get('/api/molecules', (req, res) => {
    const molecules = moleculeServer.getAllMolecules();
    res.json(molecules);
  });

  app.get('/api/molecules/:id', (req, res) => {
    const molecule = moleculeServer.getMolecule(req.params.id);
    if (!molecule) {
      return res.status(404).json({ error: 'Molecule not found' });
    }
    res.json(molecule);
  });

  app.get('/api/molecules/:id/elements', (req, res) => {
    const elements = moleculeServer.getElementsInMolecule(req.params.id);
    if (!elements) {
      return res.status(404).json({ error: 'Molecule not found' });
    }
    res.json(elements);
  });

  app.get('/api/molecules/search/:query', (req, res) => {
    const results = moleculeServer.searchMolecules(req.params.query);
    res.json(results);
  });

  // Visualization routes
  app.get('/api/visualizations', authenticateToken, (req, res) => {
    const userVisualizations = Array.from(savedVisualizations.values())
      .filter(v => v.username === req.user.username);
    res.json(userVisualizations);
  });

  app.post('/api/visualizations', authenticateToken, (req, res) => {
    const { name, moleculeId, settings } = req.body;
    
    if (!name || !moleculeId) {
      return res.status(400).json({ error: 'Name and molecule ID required' });
    }

    const visualization = {
      id: Date.now().toString(),
      username: req.user.username,
      name,
      moleculeId,
      settings: settings || {},
      createdAt: new Date().toISOString()
    };

    savedVisualizations.set(visualization.id, visualization);
    res.json(visualization);
  });

  app.delete('/api/visualizations/:id', authenticateToken, (req, res) => {
    const visualization = savedVisualizations.get(req.params.id);
    
    if (!visualization) {
      return res.status(404).json({ error: 'Visualization not found' });
    }

    if (visualization.username !== req.user.username) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    savedVisualizations.delete(req.params.id);
    res.json({ success: true });
  });

  return app;
}

describe('API Endpoints', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('GET /api/health', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('POST /api/auth/register', () => {
    test('should register a new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: 'testpass123' })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('username', 'testuser');
    });

    test('should reject registration without username', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ password: 'testpass123' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Username and password required');
    });

    test('should reject registration without password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Username and password required');
    });

    test('should reject duplicate username', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: 'testpass123' });

      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: 'testpass456' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Username already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Register a user for login tests
      await request(app)
        .post('/api/auth/register')
        .send({ username: 'loginuser', password: 'loginpass123' });
    });

    test('should login with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'loginuser', password: 'loginpass123' })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('username', 'loginuser');
    });

    test('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'loginuser', password: 'wrongpass' })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    test('should reject login with non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nonexistent', password: 'somepass' })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });
  });

  describe('GET /api/molecules', () => {
    test('should return list of molecules', async () => {
      const response = await request(app)
        .get('/api/molecules')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      response.body.forEach(mol => {
        expect(mol).toHaveProperty('id');
        expect(mol).toHaveProperty('name');
        expect(mol).toHaveProperty('formula');
      });
    });
  });

  describe('GET /api/molecules/:id', () => {
    test('should return specific molecule', async () => {
      const response = await request(app)
        .get('/api/molecules/water')
        .expect(200);

      expect(response.body).toHaveProperty('id', 'water');
      expect(response.body).toHaveProperty('name', 'Water');
      expect(response.body).toHaveProperty('formula', 'H2O');
      expect(response.body).toHaveProperty('atoms');
      expect(response.body).toHaveProperty('bonds');
    });

    test('should return 404 for non-existent molecule', async () => {
      const response = await request(app)
        .get('/api/molecules/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Molecule not found');
    });
  });

  describe('GET /api/molecules/:id/elements', () => {
    test('should return element composition', async () => {
      const response = await request(app)
        .get('/api/molecules/water/elements')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      
      const hydrogen = response.body.find(e => e.element === 'H');
      const oxygen = response.body.find(e => e.element === 'O');
      
      expect(hydrogen.count).toBe(2);
      expect(oxygen.count).toBe(1);
    });

    test('should return 404 for non-existent molecule', async () => {
      const response = await request(app)
        .get('/api/molecules/nonexistent/elements')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Molecule not found');
    });
  });

  describe('GET /api/molecules/search/:query', () => {
    test('should search molecules by name', async () => {
      const response = await request(app)
        .get('/api/molecules/search/water')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].id).toBe('water');
    });

    test('should return empty array for no matches', async () => {
      const response = await request(app)
        .get('/api/molecules/search/xyz123')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });
  });

  describe('Protected Visualization Endpoints', () => {
    let token;

    beforeEach(async () => {
      // Register and get token
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'vizuser', password: 'vizpass123' });
      
      token = response.body.token;
    });

    describe('GET /api/visualizations', () => {
      test('should return user visualizations with valid token', async () => {
        const response = await request(app)
          .get('/api/visualizations')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      test('should reject request without token', async () => {
        const response = await request(app)
          .get('/api/visualizations')
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Access token required');
      });

      test('should reject request with invalid token', async () => {
        const response = await request(app)
          .get('/api/visualizations')
          .set('Authorization', 'Bearer invalid-token')
          .expect(403);

        expect(response.body).toHaveProperty('error', 'Invalid or expired token');
      });
    });

    describe('POST /api/visualizations', () => {
      test('should create visualization with valid data', async () => {
        const response = await request(app)
          .post('/api/visualizations')
          .set('Authorization', `Bearer ${token}`)
          .send({
            name: 'My Water View',
            moleculeId: 'water',
            settings: { style: 'sphere', zoom: 1.5 }
          })
          .expect(200);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('name', 'My Water View');
        expect(response.body).toHaveProperty('moleculeId', 'water');
        expect(response.body).toHaveProperty('settings');
        expect(response.body).toHaveProperty('username', 'vizuser');
      });

      test('should reject without name', async () => {
        const response = await request(app)
          .post('/api/visualizations')
          .set('Authorization', `Bearer ${token}`)
          .send({ moleculeId: 'water' })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Name and molecule ID required');
      });

      test('should reject without moleculeId', async () => {
        const response = await request(app)
          .post('/api/visualizations')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'My View' })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Name and molecule ID required');
      });
    });

    describe('DELETE /api/visualizations/:id', () => {
      let visualizationId;

      beforeEach(async () => {
        // Create a visualization
        const response = await request(app)
          .post('/api/visualizations')
          .set('Authorization', `Bearer ${token}`)
          .send({
            name: 'Test View',
            moleculeId: 'water',
            settings: {}
          });
        
        visualizationId = response.body.id;
      });

      test('should delete own visualization', async () => {
        const response = await request(app)
          .delete(`/api/visualizations/${visualizationId}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });

      test('should return 404 for non-existent visualization', async () => {
        const response = await request(app)
          .delete('/api/visualizations/nonexistent')
          .set('Authorization', `Bearer ${token}`)
          .expect(404);

        expect(response.body).toHaveProperty('error', 'Visualization not found');
      });

      test('should reject deletion without token', async () => {
        await request(app)
          .delete(`/api/visualizations/${visualizationId}`)
          .expect(401);
      });
    });
  });
});
