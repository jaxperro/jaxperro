import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Shared GLTF/GLB loader for the world. Models live in world/assets/models/;
// point a config `model` field at one to replace the built-in procedural mesh.
// See world/assets/models/README.md for the drop-in workflow.
const loader = new GLTFLoader();

/**
 * Load a .glb/.gltf and apply placement options.
 * @param {string} url - Path to the model, e.g. 'assets/models/boat.glb'.
 * @param {object} [opts]
 * @param {number} [opts.scale=1]      Uniform scale.
 * @param {number} [opts.yOffset=0]    Vertical offset of the model root.
 * @param {number} [opts.rotationY=0]  Yaw in radians (align the model's facing).
 * @returns {Promise<import('three').Object3D>} the model root.
 */
export function loadModel(url, { scale = 1, yOffset = 0, rotationY = 0 } = {}) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        const root = gltf.scene;
        root.scale.setScalar(scale);
        root.position.y = yOffset;
        root.rotation.y = rotationY;
        resolve(root);
      },
      undefined,
      reject
    );
  });
}

// Detach and dispose every child of a group (used before swapping in a model
// so the procedural placeholder doesn't leak GPU memory).
export function clearGroup(group) {
  for (const child of [...group.children]) {
    group.remove(child);
    child.traverse?.((obj) => {
      obj.geometry?.dispose?.();
      const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
      for (const m of mats) m.dispose?.();
    });
  }
}
