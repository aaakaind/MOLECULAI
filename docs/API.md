# MOLECULAI API Documentation

## Overview

The MOLECULAI API provides comprehensive access to molecular data, collaboration features, and computational services.

**Base URL:** `https://api.moleculai.example.com/v1`

**Authentication:** JWT Bearer Token

## Authentication

### Register User

```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "username": "johndoe",
    "email": "john@example.com",
    "role": "viewer"
  }
}
```

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "johndoe",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "username": "johndoe",
    "role": "viewer"
  }
}
```

## Molecules

### List Molecules

```http
GET /api/molecules
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (integer): Page number (default: 1)
- `limit` (integer): Items per page (default: 20, max: 100)
- `search` (string): Search by name or formula

**Response:**
```json
{
  "molecules": [
    {
      "id": "uuid",
      "name": "Water",
      "formula": "H2O",
      "molecular_weight": 18.015
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "pages": 5
  }
}
```

### Get Molecule

```http
GET /api/molecules/:id
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "uuid",
  "name": "Water",
  "formula": "H2O",
  "molecular_weight": 18.015,
  "smiles": "O",
  "inchi": "InChI=1S/H2O/h1H2",
  "atoms": [
    { "element": "O", "x": 0, "y": 0, "z": 0 },
    { "element": "H", "x": 0.757, "y": 0.586, "z": 0 },
    { "element": "H", "x": -0.757, "y": 0.586, "z": 0 }
  ],
  "bonds": [
    { "from": 0, "to": 1, "order": 1 },
    { "from": 0, "to": 2, "order": 1 }
  ],
  "metadata": {
    "source": "RCSB PDB",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### Create Molecule

```http
POST /api/molecules
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Methanol",
  "formula": "CH3OH",
  "smiles": "CO",
  "atoms": [...],
  "bonds": [...]
}
```

### Update Molecule

```http
PUT /api/molecules/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name",
  "metadata": {...}
}
```

### Delete Molecule

```http
DELETE /api/molecules/:id
Authorization: Bearer <token>
```

### Import Molecule

```http
POST /api/molecules/import
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: molecule.pdb
format: pdb
```

**Supported Formats:** PDB, CIF, SDF, MOL2, XYZ

## Trajectories

### List Trajectories

```http
GET /api/trajectories
Authorization: Bearer <token>
```

**Response:**
```json
{
  "trajectories": [
    {
      "id": "uuid",
      "name": "MD Simulation 1",
      "molecule_id": "uuid",
      "frame_count": 1000,
      "format": "dcd",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Get Trajectory Metadata

```http
GET /api/trajectories/:id/metadata
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "uuid",
  "format": "dcd",
  "frameCount": 1000,
  "atomCount": 256,
  "timestep": 2.0,
  "totalTime": 2000.0,
  "fileSize": 12345678
}
```

### Stream Trajectory

```http
GET /api/trajectories/:id/stream
Authorization: Bearer <token>
```

**Query Parameters:**
- `compress` (boolean): Enable gzip compression

**Response:** Binary stream with chunked transfer encoding

### Get Trajectory Frames

```http
GET /api/trajectories/:id/frames?frames=0,10,20&interpolate=true
Authorization: Bearer <token>
```

**Response:**
```json
{
  "frames": [
    {
      "timestamp": 0,
      "coordinates": [
        { "x": 0, "y": 0, "z": 0 },
        ...
      ]
    }
  ],
  "metadata": {
    "atomCount": 256,
    "timestep": 2.0
  }
}
```

### Stream Frame Range

```http
GET /api/trajectories/:id/stream/range?start=0&end=100
Authorization: Bearer <token>
```

## Collaboration

### Create Room

```http
POST /api/collaboration/rooms
Authorization: Bearer <token>
Content-Type: application/json

{
  "molecule_id": "uuid",
  "name": "My Collaboration Session"
}
```

**Response:**
```json
{
  "room_id": "uuid",
  "owner_id": "uuid",
  "molecule_id": "uuid",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### List Rooms

```http
GET /api/collaboration/rooms
Authorization: Bearer <token>
```

**Response:**
```json
{
  "rooms": [
    {
      "room_id": "uuid",
      "molecule_id": "uuid",
      "participant_count": 3,
      "is_active": true,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Start Recording

```http
POST /api/rooms/:roomId/recording/start
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "recordingId": "uuid"
}
```

### Stop Recording

```http
POST /api/rooms/:roomId/recording/stop
Authorization: Bearer <token>
```

### Get Recording

```http
GET /api/recordings/:id
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "uuid",
  "roomId": "uuid",
  "moleculeId": "uuid",
  "duration": 300000,
  "snapshots": [...],
  "participants": [...]
}
```

## Simulations

### Submit Simulation Job

```http
POST /api/simulations/jobs
Authorization: Bearer <token>
Content-Type: application/json

{
  "molecule_id": "uuid",
  "job_type": "energy_minimization",
  "parameters": {
    "force_field": "AMBER",
    "max_iterations": 1000
  }
}
```

**Response:**
```json
{
  "job_id": "uuid",
  "status": "pending",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Get Job Status

```http
GET /api/simulations/jobs/:id
Authorization: Bearer <token>
```

**Response:**
```json
{
  "job_id": "uuid",
  "status": "completed",
  "progress": 100,
  "results": {
    "final_energy": -12345.67,
    "structure": {...}
  },
  "started_at": "2024-01-01T00:00:00Z",
  "completed_at": "2024-01-01T00:05:00Z"
}
```

### List Jobs

```http
GET /api/simulations/jobs
Authorization: Bearer <token>
```

**Query Parameters:**
- `status` (string): Filter by status (pending, running, completed, failed)
- `job_type` (string): Filter by job type

## Visualizations

### Save Visualization

```http
POST /api/visualizations
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Beautiful Molecule",
  "molecule_id": "uuid",
  "settings": {
    "style": "sphere",
    "camera": {...},
    "lighting": {...}
  }
}
```

### List Visualizations

```http
GET /api/visualizations
Authorization: Bearer <token>
```

### Delete Visualization

```http
DELETE /api/visualizations/:id
Authorization: Bearer <token>
```

## GraphQL API

### Endpoint

```
POST /graphql
Authorization: Bearer <token>
Content-Type: application/json
```

### Example Query

```graphql
query {
  molecules(limit: 10, search: "water") {
    id
    name
    formula
    atoms {
      element
      position {
        x
        y
        z
      }
    }
    bonds {
      from
      to
      order
    }
  }
}
```

### Example Mutation

```graphql
mutation {
  createMolecule(input: {
    name: "Ethanol"
    formula: "C2H5OH"
    smiles: "CCO"
  }) {
    id
    name
    formula
  }
}
```

## WebSocket API

### Connection

```javascript
const ws = new WebSocket('wss://api.moleculai.example.com/ws');
```

### Message Format

All messages are JSON with the following structure:

```json
{
  "type": "message-type",
  "payload": {...}
}
```

### Message Types

- `handshake`: Initial connection handshake
- `cursor-update`: User cursor position update
- `selection-update`: Atom selection change
- `state-update`: Molecular state change
- `chat-message`: Chat message
- `participant-joined`: New user joined
- `participant-left`: User left

## Rate Limits

- **Public endpoints**: 100 requests/minute
- **Authenticated endpoints**: 1000 requests/minute
- **WebSocket messages**: 100 messages/second

**Rate Limit Headers:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1609459200
```

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid molecule data",
    "details": {
      "field": "atoms",
      "reason": "At least one atom required"
    }
  }
}
```

**Common Error Codes:**
- `AUTHENTICATION_ERROR`: Invalid or missing token
- `AUTHORIZATION_ERROR`: Insufficient permissions
- `VALIDATION_ERROR`: Invalid request data
- `NOT_FOUND`: Resource not found
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `SERVER_ERROR`: Internal server error

## SDK Examples

### JavaScript/TypeScript

```javascript
import { MoleculaiClient } from '@moleculai/sdk';

const client = new MoleculaiClient({
  apiUrl: 'https://api.moleculai.example.com',
  token: 'your-auth-token'
});

// Get molecule
const molecule = await client.molecules.get('uuid');

// Create visualization
const viz = await client.visualizations.create({
  name: 'My Viz',
  moleculeId: 'uuid',
  settings: {...}
});
```

### Python

```python
from moleculai import MoleculaiClient

client = MoleculaiClient(
    api_url='https://api.moleculai.example.com',
    token='your-auth-token'
)

# Get molecule
molecule = client.molecules.get('uuid')

# Submit simulation
job = client.simulations.submit(
    molecule_id='uuid',
    job_type='energy_minimization'
)
```
