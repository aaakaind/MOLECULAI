# MOLECULAI
Molecule and chemical reaction visualization tool with interactive 3D visualization, user authentication, and data served via MCP servers.

## Features

- 🧪 **Interactive 3D Molecular Visualization**: Visualize molecules in 3D using custom Canvas-based renderer
- 🔐 **User Authentication**: Login/Register system to save custom views
- 👁️ **Element Visibility Controls**: Toggle visibility of individual elements in molecules
- 📊 **Element Quantities**: View the count of each element in selected molecules
- 🎨 **Multiple Rendering Styles**: Stick, Sphere, Line, and Cross representations
- 📐 **Standard View Presets**: Front, Top, Side, and Isometric views
- 💾 **Save Visualizations**: Authenticated users can save their custom views
- 🔄 **Interactive Controls**: Zoom, rotate, spin, and reset view options
- 🏗️ **MCP Server Architecture**: Molecular data served through dedicated MCP server

## Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **3D Visualization**: Custom Canvas-based 3D molecular renderer
- **Backend**: Node.js with Express
- **Authentication**: JWT (JSON Web Tokens) with bcrypt
- **MCP Server**: Custom molecular data server

## Installation

1. Clone the repository:
```bash
git clone https://github.com/aaakaind/MOLECULAI.git
cd MOLECULAI
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

## Usage

### Viewing Molecules

1. Select a molecule from the dropdown menu
2. The molecule will be rendered in the 3D viewer
3. Use your mouse to:
   - **Rotate**: Click and drag
   - **Zoom**: Scroll wheel
   - **Pan**: Right-click and drag

### Standard Views

Click any of the view buttons to orient the molecule:
- **Front View**: View from the front
- **Top View**: View from above
- **Side View**: View from the side
- **Isometric**: 3D perspective view

### Rendering Styles

Select from the dropdown:
- **Stick**: Ball-and-stick representation (default)
- **Sphere**: Space-filling spheres
- **Line**: Simple line representation
- **Cross**: Cross representation

### Element Controls

In the "Element Visibility & Quantities" section below the main viewer:
- View the quantity of each element in the current molecule
- Toggle element visibility using the switches
- Hidden elements are removed from the visualization

### Viewer Controls

- **🔄 Reset**: Reset the view to default position
- **🔍 +**: Zoom in
- **🔍 -**: Zoom out
- **🔄 Spin**: Toggle auto-rotation

### Saving Views (Requires Login)

1. Click **Register** or **Login** with your credentials
2. Customize your view (style, element visibility, etc.)
3. Click **💾 Save View**
4. Enter a name for your visualization
5. View saved visualizations by clicking **📂 My Saves**

## API Endpoints

### Public Endpoints

- `GET /api/health` - Health check
- `GET /api/molecules` - List all molecules
- `GET /api/molecules/:id` - Get molecule details
- `GET /api/molecules/:id/elements` - Get element composition
- `GET /api/molecules/search/:query` - Search molecules

### Authentication Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Protected Endpoints (Require Authentication)

- `GET /api/visualizations` - Get user's saved visualizations
- `POST /api/visualizations` - Save a visualization
- `DELETE /api/visualizations/:id` - Delete a visualization

## Available Molecules

- Water (H₂O)
- Methane (CH₄)
- Ethanol (C₂H₅OH)
- Benzene (C₆H₆)
- Carbon Dioxide (CO₂)

## Development

### Project Structure

```
MOLECULAI/
├── public/              # Frontend files
│   ├── css/
│   │   └── styles.css   # Application styles
│   ├── js/
│   │   └── app.js       # Main application logic
│   └── index.html       # Main HTML page
├── mcp-server/          # MCP server for molecular data
│   └── molecules-server.js
├── server.js            # Express backend server
├── package.json         # Dependencies
└── README.md           # Documentation
```

### Adding New Molecules

Edit `mcp-server/molecules-server.js` and add new molecule objects to the `moleculeDatabase`:

```javascript
newMolecule: {
  id: 'newMolecule',
  name: 'New Molecule',
  formula: 'XYZ',
  atoms: [
    { element: 'X', x: 0, y: 0, z: 0 },
    // ... more atoms
  ],
  bonds: [
    { from: 0, to: 1, order: 1 },
    // ... more bonds
  ]
}
```

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
