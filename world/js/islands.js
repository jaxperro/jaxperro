import * as THREE from 'three';
import { ISLANDS } from './config.js';

// Builds the portfolio islands from config and owns their interaction state:
// proximity pulsing, the tap press animation, and axis-aligned colliders the
// boat physics resolves against. `onActivate(islandConfig)` fires when a
// press animation completes; main.js maps that to an action.
export function createIslands({ onActivate }) {
  const group = new THREE.Group();
  const raycaster = new THREE.Raycaster();

  const islands = ISLANDS.map((config) => {
    const half = config.size / 2;
    const geometry = new THREE.BoxGeometry(config.size, config.height, config.size);
    const material = new THREE.MeshStandardMaterial({
      color: config.color,
      flatShading: true,
      emissive: config.color,
      emissiveIntensity: 0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    // Sink the base just past the deepest wave trough (~0.7), with margin so
    // it stays submerged even at the bottom of the press-shrink animation.
    mesh.position.set(config.position[0], config.height / 2 - 1.5, config.position[1]);
    group.add(mesh);

    return {
      config,
      mesh,
      baseColor: new THREE.Color(config.color),
      pressedColor: new THREE.Color(config.color).multiplyScalar(0.55),
      armed: 0, // eased 0..1: boat inside interactionRadius
      pressT: -1, // -1 idle, else 0..1 through the press animation
      activated: false,
      collider: { x: config.position[0], z: config.position[1], half },
    };
  });

  const colliders = islands.map((island) => island.collider);

  const PRESS_DURATION = 0.45;
  // Press timeline: shrink/darken for the first 40%, recover for the rest.
  const pressCurve = (t) =>
    t < 0.4 ? THREE.MathUtils.smoothstep(t / 0.4, 0, 1) : 1 - THREE.MathUtils.smoothstep((t - 0.4) / 0.6, 0, 1);

  function update(dt, boatPosition, time) {
    for (const island of islands) {
      const dx = boatPosition.x - island.collider.x;
      const dz = boatPosition.z - island.collider.z;
      const near = Math.hypot(dx, dz) < island.config.interactionRadius;
      const ease = 1 - Math.exp(-4 * dt);
      island.armed += ((near ? 1 : 0) - island.armed) * ease;

      // Proximity affordance: gentle breathing pulse + emissive glow.
      const pulse = (Math.sin(time * 2.6) * 0.5 + 0.5) * island.armed;
      let scale = 1 + pulse * 0.035;
      island.mesh.material.emissiveIntensity = pulse * 0.18;

      let press = 0;
      if (island.pressT >= 0) {
        island.pressT += dt / PRESS_DURATION;
        if (island.pressT >= 1) {
          island.pressT = -1;
          if (!island.activated) {
            island.activated = true;
            onActivate(island.config);
          }
        } else {
          press = pressCurve(island.pressT);
        }
      }

      scale *= 1 - press * 0.12;
      island.mesh.scale.setScalar(scale);
      island.mesh.material.color.copy(island.baseColor).lerp(island.pressedColor, press);
    }
  }

  // Raycasts a tap (NDC coords) against armed islands. Starts the press
  // animation and returns true if one was hit, so the caller can stop the
  // event from reaching the joystick.
  function handleTap(ndc, camera) {
    raycaster.setFromCamera(ndc, camera);
    for (const island of islands) {
      if (island.armed < 0.5 || island.pressT >= 0) continue;
      if (raycaster.intersectObject(island.mesh, false).length > 0) {
        island.pressT = 0;
        island.activated = false;
        return true;
      }
    }
    return false;
  }

  return { group, colliders, update, handleTap };
}
