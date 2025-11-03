/**
 * GraphQL Schema for MOLECULAI API
 * Provides comprehensive access to molecular data with optimized queries
 */

import { gql } from 'apollo-server-express';

export const typeDefs = gql`
  # Scalar types
  scalar DateTime
  scalar JSON

  # Enums
  enum MoleculeFormat {
    JSON
    PDB
    CIF
    SDF
    MOL2
    XYZ
  }

  enum BondOrder {
    SINGLE
    DOUBLE
    TRIPLE
    AROMATIC
  }

  enum JobStatus {
    PENDING
    RUNNING
    COMPLETED
    FAILED
    CANCELLED
  }

  enum UserRole {
    OWNER
    EDITOR
    VIEWER
    AUDITOR
  }

  # Types
  type Position {
    x: Float!
    y: Float!
    z: Float!
  }

  type Atom {
    index: Int!
    element: String!
    position: Position!
    charge: Float
    residue: String
    chain: String
  }

  type Bond {
    from: Int!
    to: Int!
    order: BondOrder!
    aromatic: Boolean
  }

  type Molecule {
    id: ID!
    name: String!
    formula: String!
    molecular_weight: Float
    smiles: String
    inchi: String
    atoms: [Atom!]!
    bonds: [Bond!]!
    metadata: JSON
    created_by: User
    created_at: DateTime!
    updated_at: DateTime!
    version: Int!
  }

  type Trajectory {
    id: ID!
    molecule_id: ID!
    molecule: Molecule!
    name: String!
    frame_count: Int!
    format: String!
    metadata: JSON
    created_by: User
    created_at: DateTime!
  }

  type Frame {
    timestamp: Float!
    coordinates: [Position!]!
    energy: Float
    temperature: Float
  }

  type User {
    id: ID!
    username: String!
    email: String!
    role: UserRole!
    created_at: DateTime!
    last_login: DateTime
  }

  type CollaborationSession {
    id: ID!
    room_id: String!
    molecule_id: ID!
    molecule: Molecule
    owner: User!
    participants: [SessionParticipant!]!
    is_active: Boolean!
    created_at: DateTime!
    updated_at: DateTime!
  }

  type SessionParticipant {
    user: User!
    role: UserRole!
    joined_at: DateTime!
    is_online: Boolean!
  }

  type SimulationJob {
    id: ID!
    molecule_id: ID!
    molecule: Molecule
    job_type: String!
    status: JobStatus!
    parameters: JSON
    results: JSON
    error_message: String
    started_at: DateTime
    completed_at: DateTime
    created_at: DateTime!
  }

  type Visualization {
    id: ID!
    user_id: ID!
    user: User!
    name: String!
    molecule_id: ID!
    molecule: Molecule
    settings: JSON!
    thumbnail_path: String
    is_public: Boolean!
    created_at: DateTime!
    updated_at: DateTime!
  }

  type ReactionPathway {
    id: ID!
    name: String!
    reactants: [Molecule!]!
    products: [Molecule!]!
    intermediates: [Molecule!]!
    transition_states: JSON
    energy_profile: JSON
    metadata: JSON
    created_by: User
    created_at: DateTime!
  }

  type Analytics {
    molecule_id: ID!
    energy: Float
    charge: Float
    dipole_moment: Float
    sasa: Float
    hydrogen_bonds: Int
    metrics: JSON
  }

  # Pagination
  type PageInfo {
    has_next_page: Boolean!
    has_previous_page: Boolean!
    start_cursor: String
    end_cursor: String
  }

  type MoleculeConnection {
    nodes: [Molecule!]!
    page_info: PageInfo!
    total_count: Int!
  }

  type TrajectoryConnection {
    nodes: [Trajectory!]!
    page_info: PageInfo!
    total_count: Int!
  }

  type SimulationJobConnection {
    nodes: [SimulationJob!]!
    page_info: PageInfo!
    total_count: Int!
  }

  # Input types
  input PositionInput {
    x: Float!
    y: Float!
    z: Float!
  }

  input AtomInput {
    element: String!
    position: PositionInput!
    charge: Float
    residue: String
    chain: String
  }

  input BondInput {
    from: Int!
    to: Int!
    order: BondOrder!
    aromatic: Boolean
  }

  input CreateMoleculeInput {
    name: String!
    formula: String!
    smiles: String
    atoms: [AtomInput!]!
    bonds: [BondInput!]!
    metadata: JSON
  }

  input UpdateMoleculeInput {
    name: String
    formula: String
    metadata: JSON
  }

  input CreateSimulationJobInput {
    molecule_id: ID!
    job_type: String!
    parameters: JSON
  }

  input CreateVisualizationInput {
    name: String!
    molecule_id: ID!
    settings: JSON!
  }

  # Queries
  type Query {
    # Molecules
    molecule(id: ID!): Molecule
    molecules(
      first: Int
      after: String
      search: String
      format: MoleculeFormat
    ): MoleculeConnection!
    
    moleculeByName(name: String!): Molecule
    moleculesByFormula(formula: String!): [Molecule!]!
    
    # Trajectories
    trajectory(id: ID!): Trajectory
    trajectories(
      first: Int
      after: String
      molecule_id: ID
    ): TrajectoryConnection!
    
    trajectoryFrames(
      id: ID!
      frames: [Int!]!
      interpolate: Boolean
    ): [Frame!]!
    
    # Collaboration
    collaborationSession(id: ID!): CollaborationSession
    activeSessions: [CollaborationSession!]!
    
    # Simulations
    simulationJob(id: ID!): SimulationJob
    simulationJobs(
      first: Int
      after: String
      status: JobStatus
      job_type: String
    ): SimulationJobConnection!
    
    # Visualizations
    visualization(id: ID!): Visualization
    myVisualizations: [Visualization!]!
    publicVisualizations(first: Int): [Visualization!]!
    
    # Reactions
    reactionPathway(id: ID!): ReactionPathway
    reactionPathways: [ReactionPathway!]!
    
    # Analytics
    moleculeAnalytics(molecule_id: ID!): Analytics
    
    # Current user
    me: User
  }

  # Mutations
  type Mutation {
    # Molecules
    createMolecule(input: CreateMoleculeInput!): Molecule!
    updateMolecule(id: ID!, input: UpdateMoleculeInput!): Molecule!
    deleteMolecule(id: ID!): Boolean!
    
    importMolecule(
      file: String!
      format: MoleculeFormat!
      name: String
    ): Molecule!
    
    # Collaboration
    createCollaborationSession(molecule_id: ID!): CollaborationSession!
    joinCollaborationSession(session_id: ID!): CollaborationSession!
    leaveCollaborationSession(session_id: ID!): Boolean!
    
    # Simulations
    submitSimulationJob(input: CreateSimulationJobInput!): SimulationJob!
    cancelSimulationJob(id: ID!): SimulationJob!
    
    # Visualizations
    createVisualization(input: CreateVisualizationInput!): Visualization!
    updateVisualization(id: ID!, settings: JSON!): Visualization!
    deleteVisualization(id: ID!): Boolean!
    
    # Analytics
    calculateMoleculeAnalytics(molecule_id: ID!): Analytics!
  }

  # Subscriptions
  type Subscription {
    # Real-time collaboration updates
    sessionUpdated(session_id: ID!): CollaborationSession!
    
    # Simulation job updates
    jobStatusChanged(job_id: ID!): SimulationJob!
    
    # Molecule updates
    moleculeCreated: Molecule!
    moleculeUpdated(molecule_id: ID!): Molecule!
  }
`;

export default typeDefs;
