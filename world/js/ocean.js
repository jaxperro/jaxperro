import * as THREE from 'three';
import { OCEAN } from './config.js';

// Precompute wave constants (wavenumber k, angular frequency from deep-water
// dispersion) once, then feed the same numbers to both GLSL and JS so the boat
// bobs on exactly the surface the shader draws.
const WAVES = OCEAN.waves.map((w) => {
  const k = (2 * Math.PI) / w.wavelength;
  const dir = new THREE.Vector2(w.direction[0], w.direction[1]).normalize();
  return { amplitude: w.amplitude, k, omega: Math.sqrt(9.81 * k), dirX: dir.x, dirY: dir.y };
});

export function getWaterHeight(x, z, time) {
  let h = 0;
  for (const w of WAVES) {
    h += w.amplitude * Math.sin(w.k * (w.dirX * x + w.dirY * z) - w.omega * time);
  }
  return h;
}

const fmt = (n) => n.toFixed(6);

const glslHeightTerms = WAVES.map(
  (w) =>
    `  h += ${fmt(w.amplitude)} * sin(${fmt(w.k)} * dot(vec2(${fmt(w.dirX)}, ${fmt(
      w.dirY
    )}), p) - ${fmt(w.omega)} * t);`
).join('\n');

const vertexShader = /* glsl */ `
uniform float uTime;
varying vec3 vWorldPos;
varying vec3 vNormal;
#include <fog_pars_vertex>

float waveHeight(vec2 p, float t) {
  float h = 0.0;
${glslHeightTerms}
  return h;
}

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  float h = waveHeight(worldPos.xz, uTime);
  float eps = 1.5;
  float hx = waveHeight(worldPos.xz + vec2(eps, 0.0), uTime);
  float hz = waveHeight(worldPos.xz + vec2(0.0, eps), uTime);
  worldPos.y += h;

  vNormal = normalize(vec3(h - hx, eps, h - hz));
  vWorldPos = worldPos.xyz;

  vec4 mvPosition = viewMatrix * worldPos;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDirection;
uniform vec3 uDeepColor;
uniform vec3 uShallowColor;
varying vec3 vWorldPos;
varying vec3 vNormal;
#include <fog_pars_fragment>

void main() {
  vec3 normal = normalize(vNormal);

  // Fine ripples in the normal only — too small to displace vertices, but they
  // break up the sun glint and make the surface sparkle.
  float r1 = sin(dot(vWorldPos.xz, vec2(0.9, 0.4)) * 1.3 + uTime * 2.2);
  float r2 = sin(dot(vWorldPos.xz, vec2(-0.6, 0.8)) * 2.1 + uTime * 1.6);
  normal = normalize(normal + vec3(r1 * 0.05, 0.0, r2 * 0.05));

  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);
  vec3 color = mix(uDeepColor, uShallowColor, fresnel);

  vec3 reflectDir = reflect(-viewDir, normal);
  float toSun = max(dot(reflectDir, uSunDirection), 0.0);
  color += vec3(1.0, 0.95, 0.8) * pow(toSun, 220.0) * 1.2; // sharp glints
  color += vec3(0.12, 0.1, 0.06) * pow(toSun, 8.0);        // broad sheen

  gl_FragColor = vec4(color, 1.0);
  #include <fog_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// Returns { mesh, update(time, center) }. The mesh is recentered on the boat
// each frame; waves are computed in world space, so the move is invisible and
// the ocean is effectively infinite.
export function createOcean(sunDirection) {
  const geometry = new THREE.PlaneGeometry(OCEAN.size, OCEAN.size, OCEAN.segments, OCEAN.segments);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uSunDirection: { value: sunDirection.clone() },
        uDeepColor: { value: new THREE.Color(OCEAN.deepColor) },
        uShallowColor: { value: new THREE.Color(OCEAN.shallowColor) },
      },
    ]),
    fog: true,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;

  function update(time, center) {
    material.uniforms.uTime.value = time;
    if (center) {
      mesh.position.set(center.x, 0, center.z);
    }
  }

  return { mesh, update };
}
