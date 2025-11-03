/**
 * GraphQL Resolvers for MOLECULAI API
 * Implements data fetching and mutations with DataLoader for optimization
 */

import DataLoader from 'dataloader';

/**
 * Create DataLoaders for batch loading
 * Prevents N+1 query problems
 */
export function createLoaders(db) {
  return {
    moleculeLoader: new DataLoader(async (ids) => {
      const query = 'SELECT * FROM molecules WHERE id = ANY($1)';
      const result = await db.query(query, [ids]);
      
      // Maintain order of requested ids
      const moleculesMap = new Map(result.rows.map(m => [m.id, m]));
      return ids.map(id => moleculesMap.get(id) || null);
    }),

    userLoader: new DataLoader(async (ids) => {
      const query = 'SELECT * FROM users WHERE id = ANY($1)';
      const result = await db.query(query, [ids]);
      
      const usersMap = new Map(result.rows.map(u => [u.id, u]));
      return ids.map(id => usersMap.get(id) || null);
    }),

    trajectoryLoader: new DataLoader(async (ids) => {
      const query = 'SELECT * FROM trajectories WHERE id = ANY($1)';
      const result = await db.query(query, [ids]);
      
      const trajectoriesMap = new Map(result.rows.map(t => [t.id, t]));
      return ids.map(id => trajectoriesMap.get(id) || null);
    }),
  };
}

/**
 * GraphQL Resolvers
 */
export const resolvers = {
  Query: {
    // Molecules
    molecule: async (_, { id }, { db, loaders }) => {
      return loaders.moleculeLoader.load(id);
    },

    molecules: async (_, { first = 20, after, search }, { db }) => {
      let query = 'SELECT * FROM molecules';
      const params = [];
      
      if (search) {
        query += ' WHERE name ILIKE $1 OR formula ILIKE $1';
        params.push(`%${search}%`);
      }
      
      query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
      params.push(first + 1);
      
      if (after) {
        query += ' OFFSET $' + (params.length + 1);
        params.push(parseInt(after));
      }
      
      const result = await db.query(query, params);
      const hasMore = result.rows.length > first;
      const nodes = hasMore ? result.rows.slice(0, -1) : result.rows;
      
      return {
        nodes,
        page_info: {
          has_next_page: hasMore,
          has_previous_page: !!after,
          start_cursor: after || '0',
          end_cursor: String(parseInt(after || '0') + nodes.length),
        },
        total_count: nodes.length,
      };
    },

    moleculeByName: async (_, { name }, { db }) => {
      const query = 'SELECT * FROM molecules WHERE name = $1 LIMIT 1';
      const result = await db.query(query, [name]);
      return result.rows[0] || null;
    },

    moleculesByFormula: async (_, { formula }, { db }) => {
      const query = 'SELECT * FROM molecules WHERE formula = $1';
      const result = await db.query(query, [formula]);
      return result.rows;
    },

    // Trajectories
    trajectory: async (_, { id }, { loaders }) => {
      return loaders.trajectoryLoader.load(id);
    },

    trajectories: async (_, { first = 20, after, molecule_id }, { db }) => {
      let query = 'SELECT * FROM trajectories';
      const params = [];
      
      if (molecule_id) {
        query += ' WHERE molecule_id = $1';
        params.push(molecule_id);
      }
      
      query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
      params.push(first + 1);
      
      if (after) {
        query += ' OFFSET $' + (params.length + 1);
        params.push(parseInt(after));
      }
      
      const result = await db.query(query, params);
      const hasMore = result.rows.length > first;
      const nodes = hasMore ? result.rows.slice(0, -1) : result.rows;
      
      return {
        nodes,
        page_info: {
          has_next_page: hasMore,
          has_previous_page: !!after,
        },
        total_count: nodes.length,
      };
    },

    trajectoryFrames: async (_, { id, frames, interpolate }, { trajectoryManager }) => {
      const handler = trajectoryManager.get(id);
      if (!handler) throw new Error('Trajectory not found');
      
      const results = [];
      for (const frameIndex of frames) {
        const frame = await handler.readFrame(frameIndex);
        results.push(frame);
      }
      
      return results;
    },

    // Collaboration
    collaborationSession: async (_, { id }, { db }) => {
      const query = 'SELECT * FROM collaboration_sessions WHERE id = $1';
      const result = await db.query(query, [id]);
      return result.rows[0] || null;
    },

    activeSessions: async (_, __, { db }) => {
      const query = 'SELECT * FROM collaboration_sessions WHERE is_active = true';
      const result = await db.query(query);
      return result.rows;
    },

    // Simulations
    simulationJob: async (_, { id }, { db }) => {
      const query = 'SELECT * FROM simulation_jobs WHERE id = $1';
      const result = await db.query(query, [id]);
      return result.rows[0] || null;
    },

    simulationJobs: async (_, { first = 20, after, status, job_type }, { db, user }) => {
      let query = 'SELECT * FROM simulation_jobs WHERE user_id = $1';
      const params = [user.id];
      
      if (status) {
        query += ' AND status = $' + (params.length + 1);
        params.push(status);
      }
      
      if (job_type) {
        query += ' AND job_type = $' + (params.length + 1);
        params.push(job_type);
      }
      
      query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
      params.push(first + 1);
      
      const result = await db.query(query, params);
      const hasMore = result.rows.length > first;
      const nodes = hasMore ? result.rows.slice(0, -1) : result.rows;
      
      return {
        nodes,
        page_info: {
          has_next_page: hasMore,
          has_previous_page: !!after,
        },
        total_count: nodes.length,
      };
    },

    // Visualizations
    visualization: async (_, { id }, { db }) => {
      const query = 'SELECT * FROM visualizations WHERE id = $1';
      const result = await db.query(query, [id]);
      return result.rows[0] || null;
    },

    myVisualizations: async (_, __, { db, user }) => {
      const query = 'SELECT * FROM visualizations WHERE user_id = $1 ORDER BY created_at DESC';
      const result = await db.query(query, [user.id]);
      return result.rows;
    },

    publicVisualizations: async (_, { first = 20 }, { db }) => {
      const query = 'SELECT * FROM visualizations WHERE is_public = true ORDER BY created_at DESC LIMIT $1';
      const result = await db.query(query, [first]);
      return result.rows;
    },

    // Current user
    me: async (_, __, { user }) => {
      return user;
    },
  },

  Mutation: {
    // Molecules
    createMolecule: async (_, { input }, { db, user }) => {
      const query = `
        INSERT INTO molecules (name, formula, smiles, data, metadata, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      
      const data = {
        atoms: input.atoms,
        bonds: input.bonds,
      };
      
      const result = await db.query(query, [
        input.name,
        input.formula,
        input.smiles,
        JSON.stringify(data),
        JSON.stringify(input.metadata || {}),
        user.id,
      ]);
      
      return result.rows[0];
    },

    updateMolecule: async (_, { id, input }, { db, user }) => {
      const updates = [];
      const params = [id];
      let paramIndex = 2;
      
      if (input.name) {
        updates.push(`name = $${paramIndex}`);
        params.push(input.name);
        paramIndex++;
      }
      
      if (input.formula) {
        updates.push(`formula = $${paramIndex}`);
        params.push(input.formula);
        paramIndex++;
      }
      
      if (input.metadata) {
        updates.push(`metadata = $${paramIndex}`);
        params.push(JSON.stringify(input.metadata));
        paramIndex++;
      }
      
      updates.push('updated_at = CURRENT_TIMESTAMP');
      updates.push(`version = version + 1`);
      
      const query = `
        UPDATE molecules
        SET ${updates.join(', ')}
        WHERE id = $1 AND created_by = $${paramIndex}
        RETURNING *
      `;
      params.push(user.id);
      
      const result = await db.query(query, params);
      return result.rows[0];
    },

    deleteMolecule: async (_, { id }, { db, user }) => {
      const query = 'DELETE FROM molecules WHERE id = $1 AND created_by = $2';
      const result = await db.query(query, [id, user.id]);
      return result.rowCount > 0;
    },

    // Simulations
    submitSimulationJob: async (_, { input }, { db, user }) => {
      const query = `
        INSERT INTO simulation_jobs (user_id, molecule_id, job_type, parameters, status)
        VALUES ($1, $2, $3, $4, 'pending')
        RETURNING *
      `;
      
      const result = await db.query(query, [
        user.id,
        input.molecule_id,
        input.job_type,
        JSON.stringify(input.parameters || {}),
      ]);
      
      // TODO: Queue job for processing
      
      return result.rows[0];
    },

    cancelSimulationJob: async (_, { id }, { db, user }) => {
      const query = `
        UPDATE simulation_jobs
        SET status = 'cancelled'
        WHERE id = $1 AND user_id = $2 AND status IN ('pending', 'running')
        RETURNING *
      `;
      
      const result = await db.query(query, [id, user.id]);
      return result.rows[0];
    },

    // Visualizations
    createVisualization: async (_, { input }, { db, user }) => {
      const query = `
        INSERT INTO visualizations (user_id, name, molecule_id, settings)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      
      const result = await db.query(query, [
        user.id,
        input.name,
        input.molecule_id,
        JSON.stringify(input.settings),
      ]);
      
      return result.rows[0];
    },

    deleteVisualization: async (_, { id }, { db, user }) => {
      const query = 'DELETE FROM visualizations WHERE id = $1 AND user_id = $2';
      const result = await db.query(query, [id, user.id]);
      return result.rowCount > 0;
    },
  },

  // Type resolvers
  Molecule: {
    created_by: async (molecule, _, { loaders }) => {
      return molecule.created_by ? loaders.userLoader.load(molecule.created_by) : null;
    },
    
    atoms: (molecule) => {
      const data = typeof molecule.data === 'string' 
        ? JSON.parse(molecule.data) 
        : molecule.data;
      return data.atoms || [];
    },
    
    bonds: (molecule) => {
      const data = typeof molecule.data === 'string' 
        ? JSON.parse(molecule.data) 
        : molecule.data;
      return data.bonds || [];
    },
  },

  Trajectory: {
    molecule: async (trajectory, _, { loaders }) => {
      return loaders.moleculeLoader.load(trajectory.molecule_id);
    },
    
    created_by: async (trajectory, _, { loaders }) => {
      return trajectory.created_by ? loaders.userLoader.load(trajectory.created_by) : null;
    },
  },

  CollaborationSession: {
    molecule: async (session, _, { loaders }) => {
      return loaders.moleculeLoader.load(session.molecule_id);
    },
    
    owner: async (session, _, { loaders }) => {
      return loaders.userLoader.load(session.owner_id);
    },
    
    participants: async (session, _, { db }) => {
      const query = `
        SELECT sp.*, u.*
        FROM session_participants sp
        JOIN users u ON sp.user_id = u.id
        WHERE sp.session_id = $1 AND sp.left_at IS NULL
      `;
      const result = await db.query(query, [session.id]);
      return result.rows.map(row => ({
        user: row,
        role: row.role,
        joined_at: row.joined_at,
        is_online: row.is_online,
      }));
    },
  },

  SimulationJob: {
    molecule: async (job, _, { loaders }) => {
      return loaders.moleculeLoader.load(job.molecule_id);
    },
  },

  Visualization: {
    user: async (viz, _, { loaders }) => {
      return loaders.userLoader.load(viz.user_id);
    },
    
    molecule: async (viz, _, { loaders }) => {
      return loaders.moleculeLoader.load(viz.molecule_id);
    },
  },
};

export default resolvers;
