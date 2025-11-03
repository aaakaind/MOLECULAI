# Sample Datasets

This directory contains sample molecular datasets for testing and demonstration purposes.

## Included Molecules

### Small Molecules

1. **water.json** - Water (H₂O)
   - 3 atoms (1 oxygen, 2 hydrogen)
   - Simple demonstration molecule

2. **methane.json** - Methane (CH₄)
   - 5 atoms (1 carbon, 4 hydrogen)
   - Tetrahedral geometry

3. **benzene.json** - Benzene (C₆H₆)
   - 12 atoms (6 carbon, 6 hydrogen)
   - Aromatic ring with delocalized electrons

4. **ethanol.json** - Ethanol (C₂H₅OH)
   - 9 atoms
   - Demonstrates hydroxyl group

### Proteins (PDB format)

5. **1crn.pdb** - Crambin
   - Small protein (46 residues)
   - High-resolution structure
   - Good for testing protein visualization

### Trajectories

6. **water-md.dcd** - Molecular dynamics trajectory of water
   - 1000 frames
   - 256 water molecules
   - 2 ps timestep

## File Formats

### JSON Format
```json
{
  "id": "molecule-id",
  "name": "Molecule Name",
  "formula": "H2O",
  "molecular_weight": 18.015,
  "smiles": "O",
  "inchi": "InChI=1S/H2O/h1H2",
  "atoms": [
    {
      "element": "O",
      "x": 0.0,
      "y": 0.0,
      "z": 0.0,
      "charge": -0.834
    }
  ],
  "bonds": [
    {
      "from": 0,
      "to": 1,
      "order": 1,
      "aromatic": false
    }
  ],
  "metadata": {
    "source": "RCSB PDB",
    "resolution": 1.0,
    "method": "X-RAY DIFFRACTION"
  }
}
```

### PDB Format
Standard Protein Data Bank format. See: https://www.wwpdb.org/documentation/file-format

### DCD Format
Binary trajectory format used by CHARMM, NAMD, and other MD packages.

## Usage

### Loading in Application

```javascript
// Load JSON molecule
const response = await fetch('/examples/sample-datasets/water.json');
const molecule = await response.json();

// Load PDB file
const pdbText = await fetch('/examples/sample-datasets/1crn.pdb');
const molecule = parsePDB(pdbText);

// Stream trajectory
const trajectory = await streamTrajectory('/examples/sample-datasets/water-md.dcd');
```

### Importing to Database

```bash
# Import single molecule
curl -X POST http://localhost:3000/api/molecules/import \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@water.json" \
  -F "format=json"

# Batch import
npm run import-samples
```

## Creating Your Own Datasets

### From RCSB PDB

```bash
# Download from RCSB
curl https://files.rcsb.org/download/1CRN.pdb -o 1crn.pdb

# Convert to JSON
npm run convert -- 1crn.pdb --format pdb --output 1crn.json
```

### From PubChem

```bash
# Download by CID
curl "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/962/SDF" -o ethanol.sdf

# Convert to JSON
npm run convert -- ethanol.sdf --format sdf --output ethanol.json
```

### From SMILES

```javascript
import { smilesTo3D } from '@moleculai/utils';

const molecule = await smilesTo3D('CCO'); // Ethanol
```

## Data Sources

- **RCSB PDB**: https://www.rcsb.org/
- **PubChem**: https://pubchem.ncbi.nlm.nih.gov/
- **ChEMBL**: https://www.ebi.ac.uk/chembl/
- **ZINC**: https://zinc.docking.org/

## License

Sample datasets are provided for demonstration purposes only. Original data sources may have their own licenses and usage restrictions. Please check with the original data providers before using in production.
