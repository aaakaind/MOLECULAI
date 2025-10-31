/**
 * Tests for MoleculeServer class
 */

import { MoleculeServer } from '../mcp-server/molecules-server.js';

describe('MoleculeServer', () => {
  let moleculeServer;

  beforeEach(() => {
    moleculeServer = new MoleculeServer();
  });

  describe('getAllMolecules', () => {
    test('should return all molecules with id, name, and formula', () => {
      const molecules = moleculeServer.getAllMolecules();
      
      expect(molecules).toBeDefined();
      expect(Array.isArray(molecules)).toBe(true);
      expect(molecules.length).toBeGreaterThan(0);
      
      molecules.forEach(mol => {
        expect(mol).toHaveProperty('id');
        expect(mol).toHaveProperty('name');
        expect(mol).toHaveProperty('formula');
      });
    });

    test('should return exactly 5 molecules', () => {
      const molecules = moleculeServer.getAllMolecules();
      expect(molecules.length).toBe(5);
    });
  });

  describe('getMolecule', () => {
    test('should return water molecule with correct structure', () => {
      const water = moleculeServer.getMolecule('water');
      
      expect(water).toBeDefined();
      expect(water.id).toBe('water');
      expect(water.name).toBe('Water');
      expect(water.formula).toBe('H2O');
      expect(water.atoms).toBeDefined();
      expect(water.bonds).toBeDefined();
      expect(water.atoms.length).toBe(3);
      expect(water.bonds.length).toBe(2);
    });

    test('should return methane molecule with correct structure', () => {
      const methane = moleculeServer.getMolecule('methane');
      
      expect(methane).toBeDefined();
      expect(methane.id).toBe('methane');
      expect(methane.name).toBe('Methane');
      expect(methane.formula).toBe('CH4');
      expect(methane.atoms.length).toBe(5);
      expect(methane.bonds.length).toBe(4);
    });

    test('should return null for non-existent molecule', () => {
      const nonExistent = moleculeServer.getMolecule('nonexistent');
      expect(nonExistent).toBeNull();
    });
  });

  describe('getElementsInMolecule', () => {
    test('should return correct element counts for water', () => {
      const elements = moleculeServer.getElementsInMolecule('water');
      
      expect(elements).toBeDefined();
      expect(Array.isArray(elements)).toBe(true);
      expect(elements.length).toBe(2);
      
      const hydrogen = elements.find(e => e.element === 'H');
      const oxygen = elements.find(e => e.element === 'O');
      
      expect(hydrogen).toBeDefined();
      expect(hydrogen.count).toBe(2);
      expect(oxygen).toBeDefined();
      expect(oxygen.count).toBe(1);
    });

    test('should return correct element counts for methane', () => {
      const elements = moleculeServer.getElementsInMolecule('methane');
      
      expect(elements).toBeDefined();
      expect(elements.length).toBe(2);
      
      const carbon = elements.find(e => e.element === 'C');
      const hydrogen = elements.find(e => e.element === 'H');
      
      expect(carbon).toBeDefined();
      expect(carbon.count).toBe(1);
      expect(hydrogen).toBeDefined();
      expect(hydrogen.count).toBe(4);
    });

    test('should return null for non-existent molecule', () => {
      const elements = moleculeServer.getElementsInMolecule('nonexistent');
      expect(elements).toBeNull();
    });
  });

  describe('searchMolecules', () => {
    test('should find molecules by name (case insensitive)', () => {
      const results = moleculeServer.searchMolecules('water');
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('water');
    });

    test('should find molecules by formula', () => {
      const results = moleculeServer.searchMolecules('H2O');
      
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('water');
    });

    test('should find multiple molecules with partial match', () => {
      const results = moleculeServer.searchMolecules('c');
      
      expect(results.length).toBeGreaterThan(0);
      // Should include molecules with 'C' in name or formula
    });

    test('should return empty array for no matches', () => {
      const results = moleculeServer.searchMolecules('xyz123');
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    test('should be case insensitive', () => {
      const resultsLower = moleculeServer.searchMolecules('water');
      const resultsUpper = moleculeServer.searchMolecules('WATER');
      const resultsMixed = moleculeServer.searchMolecules('WaTeR');
      
      expect(resultsLower.length).toBe(resultsUpper.length);
      expect(resultsLower.length).toBe(resultsMixed.length);
    });
  });
});
