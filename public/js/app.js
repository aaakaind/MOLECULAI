// MOLECULAI Application - Main JavaScript
class MoleculAI {
    constructor() {
        this.viewer = null;
        this.currentMolecule = null;
        this.authToken = localStorage.getItem('authToken');
        this.username = localStorage.getItem('username');
        this.spinning = false;
        this.spinInterval = null;
        this.elementVisibility = {};
        this.currentStyle = 'stick';

        this.init();
    }

    async init() {
        this.setupViewer();
        this.setupEventListeners();
        this.updateAuthUI();
        await this.loadMolecules();
    }

    setupViewer() {
        this.viewer = new Simple3DMolecule('viewer-3d');
    }

    setupEventListeners() {
        // Auth events
        document.getElementById('login-btn').addEventListener('click', () => this.login());
        document.getElementById('register-btn').addEventListener('click', () => this.register());
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
        document.getElementById('save-btn').addEventListener('click', () => this.showSaveDialog());
        document.getElementById('my-saves-btn').addEventListener('click', () => this.showSavedVisualizations());

        // Molecule selection
        document.getElementById('molecule-select').addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadMolecule(e.target.value);
            }
        });

        // View controls
        document.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.dataset.view;
                this.setView(view);
            });
        });

        // Style selection
        document.getElementById('style-select').addEventListener('change', (e) => {
            this.currentStyle = e.target.value;
            if (this.currentMolecule) {
                this.renderMolecule(this.currentMolecule);
            }
        });

        // Viewer controls
        document.getElementById('reset-view').addEventListener('click', () => this.resetView());
        document.getElementById('zoom-in').addEventListener('click', () => this.zoom(1.2));
        document.getElementById('zoom-out').addEventListener('click', () => this.zoom(0.8));
        document.getElementById('toggle-spin').addEventListener('click', () => this.toggleSpin());

        // Modal controls
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
            });
        });

        document.getElementById('confirm-save').addEventListener('click', () => this.saveVisualization());

        // Allow Enter key for login
        document.getElementById('password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.login();
            }
        });
    }

    updateAuthUI() {
        const loginControls = document.getElementById('login-controls');
        const userControls = document.getElementById('user-controls');

        if (this.authToken) {
            loginControls.style.display = 'none';
            userControls.style.display = 'flex';
            document.getElementById('user-name').textContent = `👤 ${this.username}`;
        } else {
            loginControls.style.display = 'flex';
            userControls.style.display = 'none';
        }
    }

    async login() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (!username || !password) {
            alert('Please enter username and password');
            return;
        }

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.authToken = data.token;
                this.username = data.username;
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('username', data.username);
                this.updateAuthUI();
                document.getElementById('password').value = '';
                alert('Login successful!');
            } else {
                alert(data.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Login failed');
        }
    }

    async register() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (!username || !password) {
            alert('Please enter username and password');
            return;
        }

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.authToken = data.token;
                this.username = data.username;
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('username', data.username);
                this.updateAuthUI();
                document.getElementById('password').value = '';
                alert('Registration successful!');
            } else {
                alert(data.error || 'Registration failed');
            }
        } catch (error) {
            console.error('Registration error:', error);
            alert('Registration failed');
        }
    }

    logout() {
        this.authToken = null;
        this.username = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('username');
        this.updateAuthUI();
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
    }

    async loadMolecules() {
        try {
            const response = await fetch('/api/molecules');
            const molecules = await response.json();

            const select = document.getElementById('molecule-select');
            select.innerHTML = '<option value="">Select a molecule...</option>';

            molecules.forEach(mol => {
                const option = document.createElement('option');
                option.value = mol.id;
                option.textContent = `${mol.name} (${mol.formula})`;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading molecules:', error);
            alert('Failed to load molecules');
        }
    }

    async loadMolecule(id) {
        try {
            const response = await fetch(`/api/molecules/${id}`);
            const molecule = await response.json();

            this.currentMolecule = molecule;
            this.renderMolecule(molecule);
            this.updateMoleculeInfo(molecule);
            await this.loadElementControls(id);
        } catch (error) {
            console.error('Error loading molecule:', error);
            alert('Failed to load molecule');
        }
    }

    renderMolecule(molecule) {
        // Initialize element visibility if not set
        molecule.atoms.forEach(atom => {
            if (!(atom.element in this.elementVisibility)) {
                this.elementVisibility[atom.element] = true;
            }
        });

        // Use the Simple3D visualizer
        this.viewer.setMolecule(molecule, this.elementVisibility);
    }

    updateMoleculeInfo(molecule) {
        const infoBox = document.getElementById('molecule-info');
        infoBox.innerHTML = `
            <strong>${molecule.name}</strong><br>
            <strong>Formula:</strong> ${molecule.formula}<br>
            <strong>Atoms:</strong> ${molecule.atoms.length}<br>
            <strong>Bonds:</strong> ${molecule.bonds.length}
        `;
    }

    async loadElementControls(moleculeId) {
        try {
            const response = await fetch(`/api/molecules/${moleculeId}/elements`);
            const elements = await response.json();

            const container = document.getElementById('element-controls');
            container.innerHTML = '';

            elements.forEach(({ element, count }) => {
                const control = this.createElementControl(element, count);
                container.appendChild(control);
            });
        } catch (error) {
            console.error('Error loading element controls:', error);
        }
    }

    createElementControl(element, count) {
        const colors = {
            H: '#FFFFFF', C: '#909090', N: '#3050F8', O: '#FF0D0D',
            F: '#90E050', Cl: '#1FF01F', Br: '#A62929', I: '#940094',
            P: '#FF8000', S: '#FFFF30', B: '#FFB5B5', Si: '#F0C8A0'
        };

        const div = document.createElement('div');
        div.className = 'element-control';
        
        const isVisible = this.elementVisibility[element] !== false;

        div.innerHTML = `
            <div class="element-header">
                <div>
                    <span class="element-symbol" style="background-color: ${colors[element] || '#808080'}">${element}</span>
                    <span class="element-name">${this.getElementName(element)}</span>
                </div>
            </div>
            <div class="element-info">
                <span class="element-count">Quantity: ${count}</span>
                <label class="toggle-switch">
                    <input type="checkbox" ${isVisible ? 'checked' : ''} data-element="${element}">
                    <span class="slider"></span>
                </label>
            </div>
        `;

        const toggle = div.querySelector('input[type="checkbox"]');
        toggle.addEventListener('change', (e) => {
            this.elementVisibility[element] = e.target.checked;
            this.renderMolecule(this.currentMolecule);
        });

        return div;
    }

    getElementName(symbol) {
        const names = {
            H: 'Hydrogen', C: 'Carbon', N: 'Nitrogen', O: 'Oxygen',
            F: 'Fluorine', Cl: 'Chlorine', Br: 'Bromine', I: 'Iodine',
            P: 'Phosphorus', S: 'Sulfur', B: 'Boron', Si: 'Silicon'
        };
        return names[symbol] || symbol;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setView(viewType) {
        this.viewer.setView(viewType);
    }

    resetView() {
        this.viewer.resetView();
    }

    zoom(factor) {
        if (factor > 1) {
            this.viewer.zoomIn();
        } else {
            this.viewer.zoomOut();
        }
    }

    toggleSpin() {
        this.viewer.toggleSpin();
    }

    showSaveDialog() {
        if (!this.authToken) {
            alert('Please login to save visualizations');
            return;
        }

        if (!this.currentMolecule) {
            alert('Please select a molecule first');
            return;
        }

        document.getElementById('save-modal').style.display = 'block';
        document.getElementById('save-name').value = '';
        document.getElementById('save-name').focus();
    }

    async saveVisualization() {
        const name = document.getElementById('save-name').value;

        if (!name) {
            alert('Please enter a name');
            return;
        }

        try {
            const settings = {
                style: this.currentStyle,
                elementVisibility: this.elementVisibility
            };

            const response = await fetch('/api/visualizations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({
                    name,
                    moleculeId: this.currentMolecule.id,
                    settings
                })
            });

            if (response.ok) {
                alert('Visualization saved successfully!');
                document.getElementById('save-modal').style.display = 'none';
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to save visualization');
            }
        } catch (error) {
            console.error('Save error:', error);
            alert('Failed to save visualization');
        }
    }

    async showSavedVisualizations() {
        if (!this.authToken) {
            alert('Please login to view saved visualizations');
            return;
        }

        try {
            const response = await fetch('/api/visualizations', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            const saves = await response.json();

            const savesList = document.getElementById('saves-list');
            
            if (saves.length === 0) {
                savesList.innerHTML = '<p class="placeholder">No saved visualizations yet</p>';
            } else {
                savesList.innerHTML = saves.map(save => {
                    const saveId = save.id;
                    const encodedSettings = btoa(JSON.stringify(save.settings));
                    return `
                    <div class="save-item">
                        <div class="save-item-info">
                            <div class="save-item-name">${this.escapeHtml(save.name)}</div>
                            <div class="save-item-details">
                                Molecule: ${this.escapeHtml(save.moleculeId)} | 
                                Saved: ${new Date(save.createdAt).toLocaleDateString()}
                            </div>
                        </div>
                        <div class="save-item-actions">
                            <button class="btn btn-primary btn-small" data-save-id="${saveId}" data-molecule-id="${save.moleculeId}" data-settings="${encodedSettings}">Load</button>
                            <button class="btn btn-secondary btn-small" data-delete-id="${saveId}">Delete</button>
                        </div>
                    </div>
                `}).join('');

                // Add event listeners to buttons
                savesList.querySelectorAll('[data-save-id]').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const saveId = e.target.dataset.saveId;
                        const moleculeId = e.target.dataset.moleculeId;
                        const settings = JSON.parse(atob(e.target.dataset.settings));
                        this.loadSavedVisualization(saveId, moleculeId, settings);
                    });
                });

                savesList.querySelectorAll('[data-delete-id]').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const deleteId = e.target.dataset.deleteId;
                        this.deleteSavedVisualization(deleteId);
                    });
                });
            }

            document.getElementById('saves-modal').style.display = 'block';
        } catch (error) {
            console.error('Error loading saved visualizations:', error);
            alert('Failed to load saved visualizations');
        }
    }

    async loadSavedVisualization(id, moleculeId, settings) {
        try {
            // Load the molecule
            document.getElementById('molecule-select').value = moleculeId;
            await this.loadMolecule(moleculeId);

            // Apply settings
            if (settings.style) {
                this.currentStyle = settings.style;
                document.getElementById('style-select').value = settings.style;
            }

            if (settings.elementVisibility) {
                this.elementVisibility = settings.elementVisibility;
                await this.loadElementControls(moleculeId);
                this.renderMolecule(this.currentMolecule);
            }

            document.getElementById('saves-modal').style.display = 'none';
            alert('Visualization loaded successfully!');
        } catch (error) {
            console.error('Error loading visualization:', error);
            alert('Failed to load visualization');
        }
    }

    async deleteSavedVisualization(id) {
        if (!confirm('Are you sure you want to delete this visualization?')) {
            return;
        }

        try {
            const response = await fetch(`/api/visualizations/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (response.ok) {
                alert('Visualization deleted successfully!');
                this.showSavedVisualizations();
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to delete visualization');
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('Failed to delete visualization');
        }
    }
}

// Initialize the application
const app = new MoleculAI();
