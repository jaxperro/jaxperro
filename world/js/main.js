import * as THREE from 'three';
import { initScene } from './scene.js';
import { createOcean } from './ocean.js';
import { createBoat } from './boat.js';
import { createControls } from './controls.js';
import { createIslands } from './islands.js';
import { createPopupManager } from '/scripts/ui/popups.js';
import { ensureCatAnimation, destroyCatAnimation } from '/scripts/ui/riveCat.js';
import { CAMERA_FOLLOW, DOM_IDS } from './config.js';

const canvas = document.getElementById(DOM_IDS.canvas);
const hint = document.getElementById(DOM_IDS.hint);

const { renderer, scene, camera, sunDirection } = initScene(canvas);

const ocean = createOcean(sunDirection);
scene.add(ocean.mesh);

const boat = createBoat();
scene.add(boat.group);

// --- Islands & popup ---------------------------------------------------
// The popup manager and Rive cat are the home page's modules, reused as-is;
// the cat popup is POPUP_CONTENT[0]. While a popup is open, boat input is
// zeroed and the joystick layer is hidden.
const popupManager = createPopupManager();
const joystickZone = document.getElementById(DOM_IDS.joystickZone);
let popupOpen = false;

function openCatPopup() {
  popupOpen = true;
  joystickZone.style.display = 'none';
  popupManager.show(0);
  ensureCatAnimation();
}

function closePopup() {
  popupOpen = false;
  joystickZone.style.display = '';
  popupManager.hide();
  destroyCatAnimation();
}

document.getElementById(DOM_IDS.popupClose).addEventListener('click', closePopup);

const islandActions = {
  catPopup: openCatPopup,
};

const islands = createIslands({
  onActivate: (island) => islandActions[island.action.type]?.(),
});
scene.add(islands.group);

// Capture-phase so island taps are consumed before nipplejs sees them;
// everywhere else the joystick spawns as usual.
const tapNdc = new THREE.Vector2();
window.addEventListener(
  'pointerdown',
  (event) => {
    if (popupOpen) return;
    tapNdc.set(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );
    if (islands.handleTap(tapNdc, camera)) {
      event.stopPropagation();
      event.preventDefault();
    }
  },
  true
);

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

  // Pitch up on narrow screens so the boat rides in the lower third of the
  // frame; a screen-space shift of `s` NDC maps to atan(s * tan(fov/2)).
  const portrait = THREE.MathUtils.clamp((1.1 - camera.aspect) / 0.4, 0, 1);
  const shift = portrait * CAMERA_FOLLOW.portraitScreenShift;
  if (shift > 0) {
    camera.rotateX(Math.atan(shift * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)));
  }
}

// Start with the camera already settled behind the boat.
boat.update(0.016, { throttle: 0, steer: 0 }, 0);
updateCamera(1000);

// Debug handle for console poking; not used by the app itself.
window.__world = { boat, controls, camera, renderer, islands, snapCamera: () => updateCamera(1000) };

const clock = new THREE.Clock();
let elapsed = 0;

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  const input = popupOpen ? { throttle: 0, steer: 0 } : controls.read();
  boat.update(dt, input, elapsed, islands.colliders);
  ocean.update(elapsed, boat.position);
  islands.update(dt, boat.position, elapsed);
  updateCamera(dt);

  renderer.render(scene, camera);
});
