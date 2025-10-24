/**
 * Simple 3D Molecular Visualizer using Canvas
 * A lightweight alternative for molecular visualization
 */

class Simple3DMolecule {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width = this.canvas.offsetWidth;
        this.height = this.canvas.height = this.canvas.offsetHeight;
        
        this.atoms = [];
        this.bonds = [];
        this.rotation = { x: 0.5, y: 0.5 };
        this.zoom = 1;
        this.spinning = false;
        
        this.setupInteraction();
    }

    setupInteraction() {
        let isDragging = false;
        let lastX = 0;
        let lastY = 0;

        this.canvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const dx = e.clientX - lastX;
                const dy = e.clientY - lastY;
                this.rotation.y += dx * 0.01;
                this.rotation.x += dy * 0.01;
                lastX = e.clientX;
                lastY = e.clientY;
                this.render();
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            isDragging = false;
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoom *= delta;
            this.zoom = Math.max(0.1, Math.min(this.zoom, 5));
            this.render();
        });
    }

    clear() {
        this.atoms = [];
        this.bonds = [];
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    setMolecule(molecule, elementVisibility = {}) {
        this.clear();
        
        // Filter visible atoms
        this.atoms = molecule.atoms
            .map((atom, index) => ({
                ...atom,
                originalIndex: index,
                visible: elementVisibility[atom.element] !== false
            }))
            .filter(atom => atom.visible);

        // Filter bonds where both atoms are visible
        const visibleIndices = new Set(this.atoms.map(a => a.originalIndex));
        this.bonds = molecule.bonds.filter(bond => 
            visibleIndices.has(bond.from) && visibleIndices.has(bond.to)
        );

        this.render();
    }

    project3D(x, y, z) {
        // Apply rotation
        const cosX = Math.cos(this.rotation.x);
        const sinX = Math.sin(this.rotation.x);
        const cosY = Math.cos(this.rotation.y);
        const sinY = Math.sin(this.rotation.y);

        // Rotate around Y axis
        let x1 = x * cosY - z * sinY;
        let z1 = x * sinY + z * cosY;

        // Rotate around X axis
        let y1 = y * cosX - z1 * sinX;
        let z2 = y * sinX + z1 * cosX;

        // Apply zoom and perspective
        const scale = 100 * this.zoom;
        const perspective = 5;
        const scaleFactor = perspective / (perspective + z2);

        return {
            x: this.width / 2 + x1 * scale * scaleFactor,
            y: this.height / 2 - y1 * scale * scaleFactor,
            z: z2
        };
    }

    getElementColor(element) {
        const colors = {
            H: '#FFFFFF', C: '#909090', N: '#3050F8', O: '#FF0D0D',
            F: '#90E050', Cl: '#1FF01F', Br: '#A62929', I: '#940094',
            P: '#FF8000', S: '#FFFF30', B: '#FFB5B5', Si: '#F0C8A0'
        };
        return colors[element] || '#808080';
    }

    getElementRadius(element) {
        const radii = {
            H: 0.31, C: 0.70, N: 0.65, O: 0.60,
            F: 0.50, Cl: 1.00, Br: 1.20, I: 1.40,
            P: 1.00, S: 1.00, B: 0.90, Si: 1.10
        };
        return (radii[element] || 0.70) * 20;
    }

    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Draw background gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, '#f8f9fa');
        gradient.addColorStop(1, '#e9ecef');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Project all atoms
        const projectedAtoms = this.atoms.map(atom => ({
            ...atom,
            pos: this.project3D(atom.x, atom.y, atom.z)
        }));

        // Sort by z-depth for proper rendering order
        projectedAtoms.sort((a, b) => a.pos.z - b.pos.z);

        // Draw bonds first
        this.bonds.forEach(bond => {
            const fromAtom = projectedAtoms.find(a => a.originalIndex === bond.from);
            const toAtom = projectedAtoms.find(a => a.originalIndex === bond.to);

            if (fromAtom && toAtom) {
                this.ctx.beginPath();
                this.ctx.moveTo(fromAtom.pos.x, fromAtom.pos.y);
                this.ctx.lineTo(toAtom.pos.x, toAtom.pos.y);
                this.ctx.strokeStyle = '#555555';
                this.ctx.lineWidth = bond.order * 2;
                this.ctx.stroke();
            }
        });

        // Draw atoms
        projectedAtoms.forEach(atom => {
            const radius = this.getElementRadius(atom.element) * this.zoom;
            
            // Shadow
            this.ctx.beginPath();
            this.ctx.arc(atom.pos.x + 2, atom.pos.y + 2, radius, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            this.ctx.fill();

            // Atom sphere with gradient
            const atomGradient = this.ctx.createRadialGradient(
                atom.pos.x - radius/3, atom.pos.y - radius/3, 0,
                atom.pos.x, atom.pos.y, radius
            );
            const color = this.getElementColor(atom.element);
            atomGradient.addColorStop(0, this.lightenColor(color, 40));
            atomGradient.addColorStop(1, color);
            
            this.ctx.beginPath();
            this.ctx.arc(atom.pos.x, atom.pos.y, radius, 0, Math.PI * 2);
            this.ctx.fillStyle = atomGradient;
            this.ctx.fill();
            
            // Outline
            this.ctx.strokeStyle = '#333333';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();

            // Element label
            this.ctx.fillStyle = atom.element === 'H' ? '#000000' : '#FFFFFF';
            this.ctx.font = `bold ${Math.max(12, radius)}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(atom.element, atom.pos.x, atom.pos.y);
        });
    }

    lightenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, (num >> 8 & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
    }

    setView(view) {
        const views = {
            front: { x: 0, y: 0 },
            top: { x: Math.PI / 2, y: 0 },
            side: { x: 0, y: Math.PI / 2 },
            iso: { x: 0.5, y: 0.5 }
        };
        
        if (views[view]) {
            this.rotation = views[view];
            this.render();
        }
    }

    resetView() {
        this.rotation = { x: 0.5, y: 0.5 };
        this.zoom = 1;
        this.render();
    }

    zoomIn() {
        this.zoom *= 1.2;
        this.zoom = Math.min(this.zoom, 5);
        this.render();
    }

    zoomOut() {
        this.zoom *= 0.8;
        this.zoom = Math.max(this.zoom, 0.1);
        this.render();
    }

    startSpin() {
        this.spinning = true;
        const spin = () => {
            if (this.spinning) {
                this.rotation.y += 0.02;
                this.render();
                requestAnimationFrame(spin);
            }
        };
        spin();
    }

    stopSpin() {
        this.spinning = false;
    }

    toggleSpin() {
        if (this.spinning) {
            this.stopSpin();
        } else {
            this.startSpin();
        }
    }
}
