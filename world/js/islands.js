import * as THREE from 'three';
import { ISLANDS } from './config.js';
import { loadModel, clearGroup } from './models.js';

// Builds the portfolio islands from config and owns their interaction state:
// proximity pulsing, the tap press animation, and axis-aligned colliders the
// boat physics resolves against. `onActivate(islandConfig)` fires when a
// press animation completes; main.js maps that to an action.
//
// Each island is a wrapper Group holding its visual (a procedural box by
// default, or a swapped-in model). The press animation scales the wrapper and
// tints every material it contains, so a model needs no special handling —
// the square collider and raycast target come from the wrapper either way.
export function createIslands({ onActivate }) {
  const group = new THREE.Group();
  const raycaster = new THREE.Raycaster();

  // Snapshot the current materials/colors of an island's visual. Re-run after a
  // model swap so the pulse + press tint apply to whatever is now showing.
  function collectMaterials(island) {
    island.materials = [];
    island.baseColors = [];
    island.wrapper.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        island.materials.push(m);
        island.baseColors.push(m.color.clone());
        if (m.emissive) m.emissive.copy(m.color); // pulse rides emissive
      }
    });
  }

  // Inactive islands (active: false) are skipped entirely: no mesh, no
  // collider, no interaction. Omitting the field counts as active.
  const islands = ISLANDS.filter((config) => config.active !== false).map((config) => {
    const half = config.size / 2;

    const wrapper = new THREE.Group();
    wrapper.position.set(config.position[0], 0, config.position[1]);
    group.add(wrapper);

    const box = new THREE.Mesh(
      new THREE.BoxGeometry(config.size, config.height, config.size),
      new THREE.MeshStandardMaterial({
        color: config.color,
        flatShading: true,
        emissive: config.color,
        emissiveIntensity: 0,
      })
    );
    // Sink the base just past the deepest wave trough (~0.7), with margin so it
    // stays submerged even at the bottom of the press-shrink animation.
    box.position.y = config.height / 2 - 1.5;
    wrapper.add(box);

    const island = {
      config,
      wrapper,
      materials: [],
      baseColors: [],
      armed: 0, // eased 0..1: boat inside interactionRadius
      pressT: -1, // -1 idle, else 0..1 through the press animation
      activated: false,
      collider: { x: config.position[0], z: config.position[1], half },
    };
    collectMaterials(island);

    // Optional model swap: replace the box visual; collider/interaction stay.
    if (config.model) {
      loadModel(config.model.url, config.model)
        .then((root) => {
          clearGroup(wrapper);
          wrapper.add(root);
          collectMaterials(island);
        })
        .catch((err) => console.warn(`Island "${config.id}" model failed to load:`, err));
    }

    return island;
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
      island.wrapper.scale.setScalar(scale);

      // Darken toward 55% on press; pulse the emissive glow when armed.
      for (let i = 0; i < island.materials.length; i++) {
        const m = island.materials[i];
        m.color.copy(island.baseColors[i]).multiplyScalar(1 - press * 0.45);
        if ('emissiveIntensity' in m) m.emissiveIntensity = pulse * 0.18;
      }
    }
  }

  // Raycasts a tap (NDC coords) against armed islands. Starts the press
  // animation and returns true if one was hit, so the caller can stop the
  // event from reaching the joystick.
  function handleTap(ndc, camera) {
    raycaster.setFromCamera(ndc, camera);
    for (const island of islands) {
      if (island.armed < 0.5 || island.pressT >= 0) continue;
      if (raycaster.intersectObject(island.wrapper, true).length > 0) {
        island.pressT = 0;
        island.activated = false;
        return true;
      }
    }
    return false;
  }

  return { group, colliders, update, handleTap };
}
