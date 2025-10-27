/**
 * MCP Server for Molecular Data
 * Serves molecular structures and chemical data to the visualization frontend
 */

// Sample molecular database
const moleculeDatabase = {
  water: {
    id: 'water',
    name: 'Water',
    formula: 'H2O',
    atoms: [
      { element: 'O', x: 0, y: 0, z: 0 },
      { element: 'H', x: 0.757, y: 0.586, z: 0 },
      { element: 'H', x: -0.757, y: 0.586, z: 0 }
    ],
    bonds: [
      { from: 0, to: 1, order: 1 },
      { from: 0, to: 2, order: 1 }
    ]
  },
  methane: {
    id: 'methane',
    name: 'Methane',
    formula: 'CH4',
    atoms: [
      { element: 'C', x: 0, y: 0, z: 0 },
      { element: 'H', x: 0.629, y: 0.629, z: 0.629 },
      { element: 'H', x: -0.629, y: -0.629, z: 0.629 },
      { element: 'H', x: -0.629, y: 0.629, z: -0.629 },
      { element: 'H', x: 0.629, y: -0.629, z: -0.629 }
    ],
    bonds: [
      { from: 0, to: 1, order: 1 },
      { from: 0, to: 2, order: 1 },
      { from: 0, to: 3, order: 1 },
      { from: 0, to: 4, order: 1 }
    ]
  },
  ethanol: {
    id: 'ethanol',
    name: 'Ethanol',
    formula: 'C2H5OH',
    atoms: [
      { element: 'C', x: 0.755, y: 0.010, z: 0.000 },
      { element: 'C', x: -0.755, y: -0.010, z: 0.000 },
      { element: 'O', x: -1.377, y: 1.263, z: 0.000 },
      { element: 'H', x: 1.144, y: -0.503, z: 0.883 },
      { element: 'H', x: 1.144, y: -0.503, z: -0.883 },
      { element: 'H', x: 1.084, y: 1.042, z: 0.000 },
      { element: 'H', x: -1.144, y: -0.521, z: -0.883 },
      { element: 'H', x: -1.144, y: -0.521, z: 0.883 },
      { element: 'H', x: -2.326, y: 1.157, z: 0.000 }
    ],
    bonds: [
      { from: 0, to: 1, order: 1 },
      { from: 1, to: 2, order: 1 },
      { from: 0, to: 3, order: 1 },
      { from: 0, to: 4, order: 1 },
      { from: 0, to: 5, order: 1 },
      { from: 1, to: 6, order: 1 },
      { from: 1, to: 7, order: 1 },
      { from: 2, to: 8, order: 1 }
    ]
  },
  benzene: {
    id: 'benzene',
    name: 'Benzene',
    formula: 'C6H6',
    atoms: [
      { element: 'C', x: 1.207, y: 0.697, z: 0 },
      { element: 'C', x: 1.207, y: -0.697, z: 0 },
      { element: 'C', x: 0, y: -1.394, z: 0 },
      { element: 'C', x: -1.207, y: -0.697, z: 0 },
      { element: 'C', x: -1.207, y: 0.697, z: 0 },
      { element: 'C', x: 0, y: 1.394, z: 0 },
      { element: 'H', x: 2.147, y: 1.240, z: 0 },
      { element: 'H', x: 2.147, y: -1.240, z: 0 },
      { element: 'H', x: 0, y: -2.480, z: 0 },
      { element: 'H', x: -2.147, y: -1.240, z: 0 },
      { element: 'H', x: -2.147, y: 1.240, z: 0 },
      { element: 'H', x: 0, y: 2.480, z: 0 }
    ],
    bonds: [
      { from: 0, to: 1, order: 2 },
      { from: 1, to: 2, order: 1 },
      { from: 2, to: 3, order: 2 },
      { from: 3, to: 4, order: 1 },
      { from: 4, to: 5, order: 2 },
      { from: 5, to: 0, order: 1 },
      { from: 0, to: 6, order: 1 },
      { from: 1, to: 7, order: 1 },
      { from: 2, to: 8, order: 1 },
      { from: 3, to: 9, order: 1 },
      { from: 4, to: 10, order: 1 },
      { from: 5, to: 11, order: 1 }
    ]
  },
  co2: {
    id: 'co2',
    name: 'Carbon Dioxide',
    formula: 'CO2',
    atoms: [
      { element: 'C', x: 0, y: 0, z: 0 },
      { element: 'O', x: 1.162, y: 0, z: 0 },
      { element: 'O', x: -1.162, y: 0, z: 0 }
    ],
    bonds: [
      { from: 0, to: 1, order: 2 },
      { from: 0, to: 2, order: 2 }
    ]
  }
};

export class MoleculeServer {
  constructor() {
    this.database = moleculeDatabase;
  }

  getAllMolecules() {
    return Object.values(this.database).map(mol => ({
      id: mol.id,
      name: mol.name,
      formula: mol.formula
    }));
  }

  getMolecule(id) {
    return this.database[id] || null;
  }

  getElementsInMolecule(id) {
    const molecule = this.getMolecule(id);
    if (!molecule) return null;

    const elementCounts = {};
    molecule.atoms.forEach(atom => {
      elementCounts[atom.element] = (elementCounts[atom.element] || 0) + 1;
    });

    return Object.entries(elementCounts).map(([element, count]) => ({
      element,
      count
    }));
  }

  searchMolecules(query) {
    const lowerQuery = query.toLowerCase();
    return Object.values(this.database)
      .filter(mol => 
        mol.name.toLowerCase().includes(lowerQuery) ||
        mol.formula.toLowerCase().includes(lowerQuery)
      )
      .map(mol => ({
        id: mol.id,
        name: mol.name,
        formula: mol.formula
      }));
  }
}

export default new MoleculeServer();
