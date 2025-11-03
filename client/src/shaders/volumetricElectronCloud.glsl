/**
 * Volumetric Electron Density Shader
 * Renders electron probability clouds using ray marching
 * 
 * Extension points:
 * - Adjust density function for different orbital types
 * - Modify color mapping for different visualization modes
 * - Add isosurface extraction at specific density levels
 */

// Vertex Shader
const vertexShader = `
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  
  void main() {
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fragment Shader
const fragmentShader = `
  uniform vec3 atomPosition;
  uniform float atomicNumber;
  uniform float densityScale;
  uniform vec3 cameraPosition;
  uniform float time;
  
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  
  // Ray marching parameters
  const int MAX_STEPS = 64;
  const float MAX_DIST = 10.0;
  const float EPSILON = 0.001;
  
  /**
   * Electron density function based on hydrogen-like orbitals
   * Can be extended for different orbital types (s, p, d, f)
   */
  float getElectronDensity(vec3 pos, vec3 center, float Z) {
    vec3 r = pos - center;
    float dist = length(r);
    
    // Bohr radius scaled by atomic number
    float a0 = 0.529 / Z; // Angstroms
    float rho = dist / a0;
    
    // 1s orbital density (can be extended for other orbitals)
    float density = exp(-2.0 * rho) / (3.14159 * a0 * a0 * a0);
    
    // Add p-orbital contribution (example)
    float theta = atan(r.y, r.x);
    float phi = acos(r.z / (dist + 0.001));
    float pOrbital = rho * exp(-rho) * abs(sin(phi)) * densityScale * 0.3;
    
    return density + pOrbital;
  }
  
  /**
   * Ray marching through volume
   * Extension point: Add multiple atoms, molecular orbitals
   */
  vec4 raymarch(vec3 rayOrigin, vec3 rayDir) {
    float totalDensity = 0.0;
    float dist = 0.0;
    
    for (int i = 0; i < MAX_STEPS; i++) {
      if (dist > MAX_DIST) break;
      
      vec3 pos = rayOrigin + rayDir * dist;
      float density = getElectronDensity(pos, atomPosition, atomicNumber);
      
      totalDensity += density * (MAX_DIST / float(MAX_STEPS));
      dist += MAX_DIST / float(MAX_STEPS);
    }
    
    return vec4(totalDensity);
  }
  
  /**
   * Color mapping for density visualization
   * Extension point: Custom color schemes, isosurface highlighting
   */
  vec3 densityToColor(float density) {
    // Blue to red gradient based on density
    vec3 lowColor = vec3(0.0, 0.2, 1.0);
    vec3 midColor = vec3(0.0, 1.0, 0.5);
    vec3 highColor = vec3(1.0, 0.3, 0.0);
    
    float normalized = clamp(density * densityScale, 0.0, 1.0);
    
    if (normalized < 0.5) {
      return mix(lowColor, midColor, normalized * 2.0);
    } else {
      return mix(midColor, highColor, (normalized - 0.5) * 2.0);
    }
  }
  
  void main() {
    vec3 rayOrigin = cameraPosition;
    vec3 rayDir = normalize(vWorldPosition - cameraPosition);
    
    // Perform ray marching
    vec4 result = raymarch(rayOrigin, rayDir);
    float density = result.x;
    
    // Map density to color
    vec3 color = densityToColor(density);
    
    // Calculate alpha based on density
    float alpha = clamp(density * densityScale * 5.0, 0.0, 0.8);
    
    // Add Fresnel effect for better depth perception
    float fresnel = pow(1.0 - abs(dot(rayDir, vNormal)), 2.0);
    alpha *= (0.7 + 0.3 * fresnel);
    
    gl_FragColor = vec4(color, alpha);
  }
`;

export { vertexShader, fragmentShader };
