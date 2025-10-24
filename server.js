import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import moleculeServer from './mcp-server/molecules-server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || (() => {
    if (process.env.NODE_ENV === 'production') {
        console.error('FATAL: JWT_SECRET must be set in production environment');
        process.exit(1);
    }
    // Generate random secret for development
    const randomSecret = crypto.randomBytes(32).toString('hex');
    console.warn('WARNING: Using randomly generated JWT secret for development.');
    console.warn('Set JWT_SECRET environment variable for consistent sessions.');
    return randomSecret;
})();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// In-memory user storage (in production, use a proper database)
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes
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

// MCP Server routes - Molecule data
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

// Saved visualizations (requires authentication)
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

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`MOLECULAI server running on http://localhost:${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});
