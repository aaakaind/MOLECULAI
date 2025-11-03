/**
 * CRDT-Based Shared Selection Hook
 * Enables conflict-free collaborative selection of atoms and molecules
 * 
 * Features:
 * - Conflict-free replicated data types (CRDT) using Yjs
 * - Real-time synchronization across clients
 * - Per-user selection tracking
 * - Undo/redo support with operation history
 * 
 * Extension points:
 * - Add selection predicates (by element type, distance, etc.)
 * - Implement selection groups and named selections
 * - Add selection persistence and snapshots
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

/**
 * Custom hook for CRDT-based shared selection
 * 
 * @param {string} roomId - Collaboration room identifier
 * @param {string} userId - Current user identifier
 * @param {string} wsUrl - WebSocket URL for MCP server
 * @returns {Object} Selection state and operations
 */
export function useCRDTSelection(roomId, userId, wsUrl = 'ws://localhost:4000') {
  const [localSelection, setLocalSelection] = useState(new Set());
  const [remoteSelections, setRemoteSelections] = useState(new Map());
  const [isConnected, setIsConnected] = useState(false);
  
  const yDocRef = useRef(null);
  const wsProviderRef = useRef(null);
  const selectionsMapRef = useRef(null);
  const undoManagerRef = useRef(null);

  // Initialize Yjs document and WebSocket provider
  useEffect(() => {
    if (!roomId || !userId) return;

    // Create Yjs document
    const yDoc = new Y.Doc();
    yDocRef.current = yDoc;

    // Get shared map for selections
    // Each user has their own selection set in the shared map
    const selectionsMap = yDoc.getMap('selections');
    selectionsMapRef.current = selectionsMap;

    // Initialize current user's selection as a Y.Array
    if (!selectionsMap.has(userId)) {
      selectionsMap.set(userId, new Y.Array());
    }

    // Set up undo manager for local operations
    const userSelectionArray = selectionsMap.get(userId);
    const undoManager = new Y.UndoManager(userSelectionArray, {
      trackedOrigins: new Set([userId])
    });
    undoManagerRef.current = undoManager;

    // Connect to WebSocket provider
    const wsProvider = new WebsocketProvider(
      wsUrl,
      roomId,
      yDoc,
      {
        connect: true,
        params: { userId }
      }
    );
    wsProviderRef.current = wsProvider;

    // Handle connection status
    wsProvider.on('status', ({ status }) => {
      setIsConnected(status === 'connected');
      console.log(`WebSocket ${status}`);
    });

    // Observe changes to selections map
    const observeSelections = () => {
      const newRemoteSelections = new Map();
      
      selectionsMap.forEach((selectionArray, user) => {
        if (user !== userId) {
          // Convert Y.Array to Set for remote users
          const selection = new Set(selectionArray.toArray());
          newRemoteSelections.set(user, selection);
        }
      });

      setRemoteSelections(newRemoteSelections);
    };

    // Listen for changes
    selectionsMap.observe(observeSelections);
    
    // Initial sync
    observeSelections();

    // Cleanup
    return () => {
      selectionsMap.unobserve(observeSelections);
      wsProvider.destroy();
      yDoc.destroy();
    };
  }, [roomId, userId, wsUrl]);

  /**
   * Add atoms to selection
   * Extension point: Add selection predicates, ranges
   */
  const addToSelection = useCallback((atomIndices) => {
    if (!selectionsMapRef.current || !userId) return;

    const userSelectionArray = selectionsMapRef.current.get(userId);
    if (!userSelectionArray) return;

    yDocRef.current.transact(() => {
      // Ensure atomIndices is an array
      const indices = Array.isArray(atomIndices) ? atomIndices : [atomIndices];
      
      indices.forEach(index => {
        // Check if already selected
        const currentArray = userSelectionArray.toArray();
        if (!currentArray.includes(index)) {
          userSelectionArray.push([index]);
        }
      });
    }, userId); // Track transaction origin for undo

    // Update local state
    setLocalSelection(prev => {
      const newSelection = new Set(prev);
      const indices = Array.isArray(atomIndices) ? atomIndices : [atomIndices];
      indices.forEach(i => newSelection.add(i));
      return newSelection;
    });
  }, [userId]);

  /**
   * Remove atoms from selection
   */
  const removeFromSelection = useCallback((atomIndices) => {
    if (!selectionsMapRef.current || !userId) return;

    const userSelectionArray = selectionsMapRef.current.get(userId);
    if (!userSelectionArray) return;

    yDocRef.current.transact(() => {
      const indices = Array.isArray(atomIndices) ? atomIndices : [atomIndices];
      const currentArray = userSelectionArray.toArray();
      
      indices.forEach(index => {
        const indexInArray = currentArray.indexOf(index);
        if (indexInArray !== -1) {
          userSelectionArray.delete(indexInArray, 1);
        }
      });
    }, userId);

    setLocalSelection(prev => {
      const newSelection = new Set(prev);
      const indices = Array.isArray(atomIndices) ? atomIndices : [atomIndices];
      indices.forEach(i => newSelection.delete(i));
      return newSelection;
    });
  }, [userId]);

  /**
   * Toggle atom selection
   */
  const toggleSelection = useCallback((atomIndex) => {
    if (localSelection.has(atomIndex)) {
      removeFromSelection(atomIndex);
    } else {
      addToSelection(atomIndex);
    }
  }, [localSelection, addToSelection, removeFromSelection]);

  /**
   * Clear local selection
   */
  const clearSelection = useCallback(() => {
    if (!selectionsMapRef.current || !userId) return;

    const userSelectionArray = selectionsMapRef.current.get(userId);
    if (!userSelectionArray) return;

    yDocRef.current.transact(() => {
      userSelectionArray.delete(0, userSelectionArray.length);
    }, userId);

    setLocalSelection(new Set());
  }, [userId]);

  /**
   * Select all atoms
   */
  const selectAll = useCallback((atomCount) => {
    const allIndices = Array.from({ length: atomCount }, (_, i) => i);
    addToSelection(allIndices);
  }, [addToSelection]);

  /**
   * Select by element type
   * Extension point: Add more selection predicates
   */
  const selectByElement = useCallback((elementType, atoms) => {
    const indices = atoms
      .map((atom, index) => atom.element === elementType ? index : -1)
      .filter(index => index !== -1);
    
    addToSelection(indices);
  }, [addToSelection]);

  /**
   * Undo last selection operation
   */
  const undo = useCallback(() => {
    if (undoManagerRef.current && undoManagerRef.current.canUndo()) {
      undoManagerRef.current.undo();
      
      // Update local selection from CRDT state
      const userSelectionArray = selectionsMapRef.current?.get(userId);
      if (userSelectionArray) {
        setLocalSelection(new Set(userSelectionArray.toArray()));
      }
    }
  }, [userId]);

  /**
   * Redo last undone selection operation
   */
  const redo = useCallback(() => {
    if (undoManagerRef.current && undoManagerRef.current.canRedo()) {
      undoManagerRef.current.redo();
      
      // Update local selection from CRDT state
      const userSelectionArray = selectionsMapRef.current?.get(userId);
      if (userSelectionArray) {
        setLocalSelection(new Set(userSelectionArray.toArray()));
      }
    }
  }, [userId]);

  /**
   * Get all selections (local + remote)
   */
  const getAllSelections = useCallback(() => {
    const allSelections = new Map(remoteSelections);
    allSelections.set(userId, localSelection);
    return allSelections;
  }, [localSelection, remoteSelections, userId]);

  /**
   * Check if an atom is selected by any user
   */
  const isAtomSelected = useCallback((atomIndex) => {
    if (localSelection.has(atomIndex)) return true;
    
    for (const selection of remoteSelections.values()) {
      if (selection.has(atomIndex)) return true;
    }
    
    return false;
  }, [localSelection, remoteSelections]);

  /**
   * Get which users have selected a specific atom
   */
  const getSelectingUsers = useCallback((atomIndex) => {
    const users = [];
    
    if (localSelection.has(atomIndex)) {
      users.push(userId);
    }
    
    for (const [user, selection] of remoteSelections) {
      if (selection.has(atomIndex)) {
        users.push(user);
      }
    }
    
    return users;
  }, [localSelection, remoteSelections, userId]);

  return {
    // State
    localSelection,
    remoteSelections,
    isConnected,
    
    // Operations
    addToSelection,
    removeFromSelection,
    toggleSelection,
    clearSelection,
    selectAll,
    selectByElement,
    
    // Undo/Redo
    undo,
    redo,
    canUndo: undoManagerRef.current?.canUndo() ?? false,
    canRedo: undoManagerRef.current?.canRedo() ?? false,
    
    // Queries
    getAllSelections,
    isAtomSelected,
    getSelectingUsers,
  };
}

export default useCRDTSelection;
