# Contributing to MOLECULAI

Thank you for considering contributing to MOLECULAI! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Code Style](#code-style)
- [Project Structure](#project-structure)
- [Extension Points](#extension-points)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please:

- Be respectful and considerate
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Respect differing viewpoints and experiences
- Accept responsibility and apologize when needed

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- Docker and Docker Compose
- Git
- PostgreSQL 16+ (for local development without Docker)
- Redis 7+ (for local development without Docker)

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork:
```bash
git clone https://github.com/YOUR_USERNAME/MOLECULAI.git
cd MOLECULAI
```

3. Add upstream remote:
```bash
git remote add upstream https://github.com/aaakaind/MOLECULAI.git
```

## Development Setup

### Option 1: Docker Compose (Recommended)

```bash
# Start all services
cd infrastructure/docker
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Option 2: Local Development

```bash
# Install dependencies
npm install

# Install service dependencies
cd services/mcp-collaboration && npm install
cd ../api-gateway && npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start database
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres:16-alpine
docker run -d -p 6379:6379 redis:7-alpine

# Run database migrations
npm run db:migrate

# Start development servers
npm run dev
```

## Making Changes

### Branch Naming

Use descriptive branch names:
- `feature/add-protein-viewer` - New features
- `fix/trajectory-streaming-bug` - Bug fixes
- `docs/update-api-reference` - Documentation
- `refactor/optimize-renderer` - Code refactoring
- `test/add-simulation-tests` - Test additions

### Commit Messages

Follow conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(viewer): add volumetric electron density rendering

Implement ray marching shader for electron cloud visualization
with configurable density thresholds and color mapping.

Closes #123
```

```
fix(collaboration): resolve CRDT synchronization issue

Fixed race condition in state updates when multiple users
edit simultaneously.

Fixes #456
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- trajectoryStreaming.test.js

# Run E2E tests
npm run test:e2e

# Run tests in watch mode
npm test -- --watch
```

### Writing Tests

**Unit Tests:**
```javascript
import { TrajectoryStreamHandler } from './trajectoryStreaming.js';

describe('TrajectoryStreamHandler', () => {
  it('should parse DCD frames correctly', () => {
    const handler = new TrajectoryStreamHandler(metadata);
    const frame = handler.readFrame(0);
    expect(frame.coordinates).toHaveLength(metadata.atomCount);
  });
});
```

**Integration Tests:**
```javascript
import request from 'supertest';
import app from './server.js';

describe('API Integration', () => {
  it('should stream trajectory', async () => {
    const response = await request(app)
      .get('/api/trajectories/test-id/stream')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
    expect(response.headers['transfer-encoding']).toBe('chunked');
  });
});
```

**E2E Tests (Playwright):**
```javascript
import { test, expect } from '@playwright/test';

test('should create collaboration room', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('#create-room');
  await expect(page.locator('#room-id')).toBeVisible();
});
```

### Test Coverage

Aim for:
- 80%+ code coverage for business logic
- 100% coverage for critical paths (authentication, data integrity)
- All API endpoints should have integration tests
- Key user flows should have E2E tests

## Submitting Changes

### Before Submitting

1. **Update your branch:**
```bash
git fetch upstream
git rebase upstream/main
```

2. **Run tests:**
```bash
npm test
npm run lint
```

3. **Check types (if TypeScript):**
```bash
npm run type-check
```

4. **Update documentation:**
- Update README.md if adding features
- Update API.md for API changes
- Add JSDoc comments to new functions
- Update ARCHITECTURE.md for structural changes

### Pull Request Process

1. **Push your changes:**
```bash
git push origin feature/your-feature-name
```

2. **Create Pull Request:**
- Use a descriptive title
- Reference related issues
- Provide detailed description
- Include screenshots for UI changes
- List breaking changes (if any)

3. **PR Template:**
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing performed

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests pass locally
- [ ] Dependent changes merged

## Related Issues
Closes #123
```

4. **Review Process:**
- At least one approval required
- All CI checks must pass
- No merge conflicts
- Documentation updated
- Tests maintain or improve coverage

## Code Style

### JavaScript/TypeScript

Follow existing code style:

```javascript
// Use meaningful variable names
const moleculeData = await fetchMolecule(id);

// Add JSDoc comments for functions
/**
 * Parse DCD trajectory frame
 * @param {Buffer} buffer - Frame data buffer
 * @param {number} atomCount - Number of atoms
 * @returns {Object} Parsed frame with coordinates
 */
function parseDCDFrame(buffer, atomCount) {
  // Implementation
}

// Use async/await over promises
async function loadTrajectory(id) {
  const metadata = await getMetadata(id);
  const frames = await loadFrames(metadata);
  return { metadata, frames };
}

// Error handling
try {
  await processData(data);
} catch (error) {
  console.error('Processing failed:', error);
  throw new Error('Failed to process data');
}
```

### React Components

```javascript
/**
 * MolecularViewer component
 * Renders 3D molecular structure with Three.js
 */
export default function MolecularViewer({
  molecule,
  showElectronCloud = false,
  onAtomSelect
}) {
  const [selectedAtoms, setSelectedAtoms] = useState([]);
  
  // Event handlers
  const handleAtomClick = useCallback((atomIndex) => {
    setSelectedAtoms(prev => [...prev, atomIndex]);
    onAtomSelect?.(atomIndex);
  }, [onAtomSelect]);
  
  return (
    <Canvas>
      {/* Component JSX */}
    </Canvas>
  );
}
```

### Linting

```bash
# Run ESLint
npm run lint

# Fix auto-fixable issues
npm run lint:fix
```

## Project Structure

### Adding New Features

**1. Client Component:**
```
client/src/components/
  └── NewFeature/
      ├── index.jsx
      ├── NewFeature.jsx
      ├── NewFeature.test.jsx
      └── styles.module.css
```

**2. Backend Service:**
```
services/new-service/
  ├── server.js
  ├── routes/
  ├── controllers/
  ├── models/
  ├── tests/
  ├── Dockerfile
  └── package.json
```

**3. Documentation:**
```
docs/
  └── features/
      └── new-feature.md
```

## Extension Points

### Plugin System

Create plugins in `plugins/` directory:

```javascript
// plugins/my-plugin/index.js
export default {
  name: 'my-plugin',
  version: '1.0.0',
  
  // Plugin hooks
  onLoad(api) {
    api.registerAnalysis('my-analysis', myAnalysisFunc);
  },
  
  onUnload() {
    // Cleanup
  }
};
```

### Custom Shaders

Add shaders to `client/src/shaders/`:

```glsl
// myCustomShader.glsl
uniform vec3 color;
varying vec3 vPosition;

void main() {
  // Shader code
  gl_FragColor = vec4(color, 1.0);
}
```

### Analysis Modules

Extend compute worker with analysis modules:

```javascript
// services/compute-worker/modules/myAnalysis.js
export function analyzeStructure(molecule) {
  // Analysis implementation
  return results;
}
```

## Getting Help

- 💬 Join our [Discord community](https://discord.gg/moleculai)
- 📧 Email: dev@moleculai.example.com
- 🐛 Open an [issue](https://github.com/aaakaind/MOLECULAI/issues)
- 📚 Read the [documentation](docs/)

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Credited in documentation

Thank you for contributing to MOLECULAI! 🎉
