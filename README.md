# MOLECULAI

> **Enterprise-Grade Molecular Visualization and Reaction-Engineering Platform**

[![CI/CD](https://github.com/aaakaind/MOLECULAI/workflows/CI%2FCD%20Pipeline/badge.svg)](https://github.com/aaakaind/MOLECULAI/actions)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](infrastructure/docker/docker-compose.yml)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Ready-blue)](infrastructure/kubernetes/)

A full-stack, extensible platform for molecular visualization, collaborative editing, and computational chemistry. Built for researchers, educators, and pharmaceutical teams requiring enterprise-grade features, scalability, and security.

## 🚀 Key Features

### Core Visualization & UX
- ⚡ **Advanced 3D Rendering**: WebGL/Three.js with WebGPU fallback, PBR materials, volumetric electron density
- 🔬 **Scientific Visualization**: Van der Waals surfaces, explicit/implicit solvent, dynamic bond rendering (single/double/aromatic)
- 📏 **Measurement Tools**: Distances, angles, dihedrals with real-time calculations
- 🎬 **Reaction Playback**: Stepwise reaction timelines with energy graphs and transition-state highlighting
- 🎨 **Photorealistic Rendering**: Post-processing effects, HDR environments, GPU instancing for large complexes

### Collaboration & Real-time Sync
- 👥 **Multi-User Collaboration**: Real-time state synchronization with CRDT (Yjs)
- 🎯 **Collaborative Features**: Shared cursors, selections, annotations, synchronized playback
- 💬 **Communication**: Integrated voice/text chat channels
- 📹 **Session Recording**: Deterministic replay with time-warp scrubbing
- 🔐 **Permissions System**: Room-based access control with owner/editor/viewer roles

### Data & Simulation
- 📊 **REST + GraphQL APIs**: Comprehensive molecular data access
- 📂 **Format Support**: PDB, CIF, SDF, MOL2, XYZ, DCD, TRR, glTF
- 🔬 **Trajectory Streaming**: Efficient streaming of large MD trajectories
- ⚗️ **Simulation Tools**: Energy minimization, docking, QM/MM job submission
- 📈 **Analytics**: Per-molecule metrics, batch processing, provenance tracking

### Enterprise Security
- 🔑 **Authentication**: OAuth/OIDC + SSO (SAML), JWT tokens
- 👮 **Authorization**: RBAC with granular roles and scoped API tokens
- 🔒 **Data Protection**: Encryption at rest/transit, audit logging, tenant isolation
- 🛡️ **Safety**: File sanitization, virus scanning, rate limiting, DoS protection

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Client (React + Three.js + WebSocket)                  │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│  API Gateway (REST + GraphQL + Auth)                    │
└─────────────────┬───────────────────────────────────────┘
                  │
    ┌─────────────┼─────────────┬─────────────┐
    ▼             ▼             ▼             ▼
┌────────┐  ┌──────────┐  ┌─────────┐  ┌──────────┐
│  MCP   │  │ Renderer │  │ Compute │  │PostgreSQL│
│ Collab │  │ Service  │  │ Worker  │  │  Redis   │
└────────┘  └──────────┘  └─────────┘  └──────────┘
```

**Services:**
- **API Gateway**: Request routing, authentication, rate limiting
- **MCP Collaboration Server**: WebSocket-based real-time collaboration
- **Renderer Service**: Server-side photorealistic rendering
- **Compute Worker**: Molecular simulations and analysis

**Full architecture documentation:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## 📦 Technology Stack

**Frontend:**
- React 18+ with TypeScript
- Three.js for 3D rendering
- Yjs for CRDT state management
- WebSocket for real-time communication

**Backend:**
- Node.js with Express
- PostgreSQL for persistent storage
- Redis for caching and sessions
- GraphQL with Apollo Server

**Infrastructure:**
- Docker & Docker Compose
- Kubernetes with Helm charts
- GitHub Actions for CI/CD
- Prometheus + Grafana for monitoring

## 🚀 Quick Start

### Using Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/aaakaind/MOLECULAI.git
cd MOLECULAI

# Set environment variables
cp .env.example .env
# Edit .env with your configuration

# Start all services
cd infrastructure/docker
docker-compose up -d

# Access the application
open http://localhost:3000
```

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# In separate terminals, start microservices:
cd services/mcp-collaboration && npm start
cd services/api-gateway && npm start

# Run tests
npm test
```

### Kubernetes Deployment

```bash
# Install Helm chart
helm install moleculai ./infrastructure/kubernetes \
  --namespace moleculai \
  --create-namespace \
  --values production-values.yaml

# Check deployment
kubectl get pods -n moleculai
```

## 📖 Documentation

- **[Architecture Guide](docs/ARCHITECTURE.md)**: System design, components, scalability
- **[API Reference](docs/API.md)**: REST and GraphQL API documentation
- **[Contributing Guide](CONTRIBUTING.md)**: How to contribute to the project
- **[Examples](examples/)**: Code examples and tutorials
  - [MCP Session Handshake](examples/mcp-handshake-example.js)
  - [CRDT Shared Selection](client/src/hooks/useCRDTSelection.js)
  - [Volumetric Electron Cloud Shader](client/src/shaders/volumetricElectronCloud.glsl)
  - [Trajectory Streaming](services/api-gateway/trajectoryStreaming.js)
  - [Deterministic Replay](client/src/utils/deterministicReplayLoader.js)

## 💡 Usage Examples

### Viewing Molecules

```javascript
import MolecularViewer from '@moleculai/client/components/MolecularViewer';

<MolecularViewer
  molecule={moleculeData}
  showElectronCloud={true}
  showVdwSurface={true}
  measurementMode="distance"
  onAtomSelect={(atoms) => console.log('Selected:', atoms)}
/>
```

### Collaborative Session

```javascript
import { MCPClient } from '@moleculai/examples/mcp-handshake-example';

const client = new MCPClient('ws://localhost:4000', authToken);
await client.connect();
const room = await client.createRoom('molecule-id', 'user-id');

// Real-time collaboration is now active
client.on('participant-joined', (data) => {
  console.log('New participant:', data.participant);
});
```

### Trajectory Streaming

```javascript
// Stream large MD trajectory
const response = await fetch('/api/trajectories/uuid/stream?compress=true');
const reader = response.body.getReader();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  // Process chunk
  processTrajectoryChunk(value);
}
```

### CRDT-Based Selection

```javascript
import { useCRDTSelection } from '@moleculai/client/hooks/useCRDTSelection';

const {
  localSelection,
  remoteSelections,
  addToSelection,
  toggleSelection,
  undo,
  redo
} = useCRDTSelection(roomId, userId);

// Select atoms with automatic sync to all participants
addToSelection([0, 1, 2]);
```

## 🔌 API Overview

### REST API

```bash
# Get molecules
curl https://api.moleculai.example.com/v1/molecules \
  -H "Authorization: Bearer YOUR_TOKEN"

# Stream trajectory
curl https://api.moleculai.example.com/v1/trajectories/:id/stream \
  -H "Authorization: Bearer YOUR_TOKEN"

# Submit simulation
curl -X POST https://api.moleculai.example.com/v1/simulations/jobs \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"molecule_id": "uuid", "job_type": "energy_minimization"}'
```

### GraphQL API

```graphql
query {
  molecules(limit: 10) {
    id
    name
    formula
    atoms {
      element
      position { x y z }
    }
    bonds {
      from
      to
      order
    }
  }
}
```

### WebSocket (MCP)

```javascript
const ws = new WebSocket('wss://api.moleculai.example.com/ws');
ws.send(JSON.stringify({
  type: 'handshake',
  action: 'create-room',
  userId: 'user-123',
  moleculeId: 'water'
}));
```

**Full API documentation:** [docs/API.md](docs/API.md)

## 🏗️ Project Structure

```
MOLECULAI/
├── client/                      # React frontend application
│   ├── src/
│   │   ├── components/         # React components
│   │   │   └── MolecularViewer.jsx
│   │   ├── hooks/              # Custom React hooks
│   │   │   └── useCRDTSelection.js
│   │   ├── shaders/            # WebGL shaders
│   │   │   └── volumetricElectronCloud.glsl
│   │   ├── utils/              # Utility functions
│   │   │   └── deterministicReplayLoader.js
│   │   └── services/           # API clients
│   └── package.json
├── services/                    # Microservices
│   ├── api-gateway/            # Main API gateway
│   │   ├── server.js
│   │   ├── trajectoryStreaming.js
│   │   └── Dockerfile
│   ├── mcp-collaboration/      # Collaboration server
│   │   ├── server.js
│   │   └── Dockerfile
│   ├── renderer/               # Rendering service
│   └── compute-worker/         # Simulation worker
├── infrastructure/              # DevOps configuration
│   ├── docker/                 # Docker configs
│   │   ├── docker-compose.yml
│   │   ├── init.sql
│   │   └── prometheus.yml
│   ├── kubernetes/             # Kubernetes/Helm
│   │   ├── Chart.yaml
│   │   └── values.yaml
│   └── ci/                     # CI/CD scripts
├── docs/                        # Documentation
│   ├── ARCHITECTURE.md
│   └── API.md
├── examples/                    # Code examples
│   └── mcp-handshake-example.js
├── plugins/                     # Plugin system
├── tests/                       # Test suites
│   ├── api.test.js
│   └── molecules-server.test.js
├── .github/
│   └── workflows/
│       └── ci-cd.yml           # GitHub Actions
├── server.js                    # Legacy server (being migrated)
├── mcp-server/                  # Legacy MCP server
├── public/                      # Legacy frontend
└── package.json
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run specific test suite
npm test -- trajectoryStreaming.test.js

# Run linting
npm run lint
```

## 🚢 Deployment

### Docker

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Kubernetes

```bash
# Install with Helm
helm install moleculai ./infrastructure/kubernetes \
  --namespace moleculai \
  --set postgresql.auth.password=SECURE_PASSWORD \
  --set redis.auth.password=SECURE_PASSWORD

# Upgrade deployment
helm upgrade moleculai ./infrastructure/kubernetes

# Check status
kubectl get pods -n moleculai

# View logs
kubectl logs -f deployment/api-gateway -n moleculai
```

## 🔧 Configuration

Key environment variables:

```bash
# Authentication
JWT_SECRET=your-secret-key
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-client-secret

# Database
POSTGRES_URL=postgresql://user:pass@host:5432/moleculai
REDIS_URL=redis://host:6379

# Services
MCP_SERVER_URL=http://mcp-collaboration:4000
RENDERER_URL=http://renderer:5000
COMPUTE_WORKER_URL=http://compute-worker:6000

# Storage
S3_BUCKET=moleculai-assets
S3_REGION=us-east-1

# Monitoring
SENTRY_DSN=your-sentry-dsn
PROMETHEUS_URL=http://prometheus:9090
```

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Quick start:**
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

ISC License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Three.js](https://threejs.org/) for 3D rendering
- [Yjs](https://github.com/yjs/yjs) for CRDT implementation
- [RDKit](https://www.rdkit.org/) for cheminformatics
- [RCSB PDB](https://www.rcsb.org/) for molecular structures
- [PubChem](https://pubchem.ncbi.nlm.nih.gov/) for chemical data

## 📞 Support

- 📧 Email: support@moleculai.example.com
- 💬 Discord: [Join our community](https://discord.gg/moleculai)
- 🐛 Issues: [GitHub Issues](https://github.com/aaakaind/MOLECULAI/issues)
- 📚 Docs: [Documentation](https://docs.moleculai.example.com)

## 🗺️ Roadmap

- [ ] VR/AR support for immersive visualization
- [ ] AI-powered property prediction
- [ ] Mobile applications (iOS/Android)
- [ ] Quantum computing integration
- [ ] Blockchain-based provenance tracking
- [ ] Advanced ML models for drug discovery
- [ ] Real-time collaborative docking
- [ ] Multi-tenant cloud deployment

---

**Built with ❤️ by the MOLECULAI team**
