import * as THREE from 'three';
import { initScene } from './scene.js';
import { createOcean } from './ocean.js';
import { createBoat } from './boat.js';
import { createControls } from './controls.js';
import { CAMERA_FOLLOW, DOM_IDS } from './config.js';

const canvas = document.getElementById(DOM_IDS.canvas);
const hint = document.getElementById(DOM_IDS.hint);

const { renderer, scene, camera, sunDirection } = initScene(canvas);

const ocean = createOcean(sunDirection);
scene.add(ocean.mesh);

const boat = createBoat();
scene.add(boat.group);

const hideHint = () => hint.classList.add('is-hidden');
const hintTimer = setTimeout(hideHint, 8000);
const controls = createControls(document.getElementById(DOM_IDS.joystickZone), {
  onFirstInput: () => {
    clearTimeout(hintTimer);
    hideHint();
  },
});

// Third-person follow camera: chase a point behind/above the boat and look at
// a point ahead of it, both critically damped so waves don't jitter the view.
const cameraTarget = new THREE.Vector3();
const desiredPosition = new THREE.Vector3();
const desiredTarget = new THREE.Vector3();

function updateCamera(dt) {
  const forward = boat.getForward();
  desiredPosition
    .copy(boat.position)
    .addScaledVector(forward, -CAMERA_FOLLOW.distance)
    .add({ x: 0, y: CAMERA_FOLLOW.height, z: 0 });
  desiredTarget
    .copy(boat.position)
    .addScaledVector(forward, CAMERA_FOLLOW.lookAhead)
    .add({ x: 0, y: CAMERA_FOLLOW.lookHeight, z: 0 });

  const posDamp = 1 - Math.exp(-CAMERA_FOLLOW.positionDamping * dt);
  const targetDamp = 1 - Math.exp(-CAMERA_FOLLOW.targetDamping * dt);
  camera.position.lerp(desiredPosition, posDamp);
  cameraTarget.lerp(desiredTarget, targetDamp);
  camera.lookAt(cameraTarget);
}

// Start with the camera already settled behind the boat.
boat.update(0.016, { throttle: 0, steer: 0 }, 0);
updateCamera(1000);

// Debug handle for console poking; not used by the app itself.
window.__world = { boat, controls, camera, renderer };

const clock = new THREE.Clock();
let elapsed = 0;

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  boat.update(dt, controls.read(), elapsed);
  ocean.update(elapsed, boat.position);
  updateCamera(dt);

  renderer.render(scene, camera);
});
