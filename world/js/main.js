import * as THREE from 'three';
import { initScene } from './scene.js';
import { createOcean } from './ocean.js';
import { createBoat } from './boat.js';
import { createControls } from './controls.js';
import { createIslands } from './islands.js';
import { createPopupManager } from '/scripts/ui/popups.js';
import { ensureCatAnimation, destroyCatAnimation } from '/scripts/ui/riveCat.js';
import { CAMERA_FOLLOW, CAMERA_INTRO, DOM_IDS } from './config.js';

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
const popupLayer = document.getElementById(DOM_IDS.popupLayer);
const popupCard = popupLayer.querySelector('.popup-card');
let popupOpen = false;

function openCatPopup() {
  popupOpen = true;
  joystickZone.style.display = 'none';
  popupManager.show(0);
  ensureCatAnimation();
}

// Placeholder popup for islands without bespoke content yet. Reuses the shared
// popup card and its CSS scale/alpha animation — no title, body, or Rive media.
function showEmptyPopup() {
  popupOpen = true;
  joystickZone.style.display = 'none';
  popupCard.querySelector('h4').textContent = '';
  popupCard.querySelector('p').textContent = '';
  delete popupCard.dataset.popupIndex; // keep the Rive media hidden
  popupCard.classList.add('is-empty');
  popupLayer.dataset.visible = 'true';
  popupCard.dataset.visible = 'true';
  popupCard.style.setProperty('--scale', '0.8');
  popupCard.style.setProperty('--alpha', '0');
  requestAnimationFrame(() => {
    popupCard.style.setProperty('--scale', '1');
    popupCard.style.setProperty('--alpha', '1');
  });
}

function closePopup() {
  popupOpen = false;
  joystickZone.style.display = '';
  popupCard.classList.remove('is-empty');
  popupManager.hide();
  destroyCatAnimation();
}

document.getElementById(DOM_IDS.popupClose).addEventListener('click', closePopup);

const islandActions = {
  catPopup: openCatPopup,
  emptyPopup: showEmptyPopup,
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
let hintTimer = null;
const controls = createControls(joystickZone, {
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
  applyPortraitShift();
}

// Pitch up on narrow screens so the boat rides in the lower third of the
// frame; a screen-space shift of `s` NDC maps to atan(s * tan(fov/2)).
function applyPortraitShift() {
  const portrait = THREE.MathUtils.clamp((1.1 - camera.aspect) / 0.4, 0, 1);
  const shift = portrait * CAMERA_FOLLOW.portraitScreenShift;
  if (shift > 0) {
    camera.rotateX(Math.atan(shift * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)));
  }
}

// --- Modes ---------------------------------------------------------------
// 'intro': landing shot facing the bow, boat locked, mode buttons showing.
// 'transition': Explore was clicked; camera arcs over the boat into the
// chase position. 'play': normal driving with the joystick live.
let mode = 'intro';
let transitionT = 0;
const introPosition = new THREE.Vector3();
const introTarget = new THREE.Vector3();
const arcPosition = new THREE.Vector3();
const arcTarget = new THREE.Vector3();

function updateIntroCamera() {
  // Fixed in front of the bow, low over the water; the boat bobs in frame.
  const forward = boat.getForward();
  introPosition
    .set(boat.position.x, 0, boat.position.z)
    .addScaledVector(forward, CAMERA_INTRO.distance)
    .add({ x: 0, y: CAMERA_INTRO.height, z: 0 });
  introTarget.copy(boat.position).add({ x: 0, y: CAMERA_INTRO.lookHeight, z: 0 });
  camera.position.copy(introPosition);
  camera.lookAt(introTarget);
  applyPortraitShift();
}

function updateTransitionCamera(dt) {
  transitionT = Math.min(transitionT + dt / CAMERA_INTRO.transitionDuration, 1);
  const e = THREE.MathUtils.smoothstep(transitionT, 0, 1);
  const forward = boat.getForward();

  // Sweep around the boat's side from bow (angle 0) to stern (angle PI)
  // rather than straight over the top — passing directly overhead whips the
  // lookAt azimuth 180° in a few frames and reads as a jump. Radius and
  // height blend from the intro pose to the chase pose, so both endpoints
  // are exactly continuous.
  const heading = Math.atan2(forward.x, forward.z);
  const angle = heading + e * Math.PI;
  const radius = THREE.MathUtils.lerp(CAMERA_INTRO.distance, CAMERA_FOLLOW.distance, e);
  const height =
    THREE.MathUtils.lerp(CAMERA_INTRO.height, boat.position.y + CAMERA_FOLLOW.height, e) +
    Math.sin(e * Math.PI) * CAMERA_INTRO.arcHeight;
  arcPosition.set(
    boat.position.x + Math.sin(angle) * radius,
    height,
    boat.position.z + Math.cos(angle) * radius
  );

  // End look-target matches the chase camera exactly for a seamless handoff.
  desiredTarget
    .copy(boat.position)
    .addScaledVector(forward, CAMERA_FOLLOW.lookAhead)
    .add({ x: 0, y: CAMERA_FOLLOW.lookHeight, z: 0 });
  arcTarget.lerpVectors(introTarget, desiredTarget, e);

  camera.position.copy(arcPosition);
  camera.lookAt(arcTarget);
  applyPortraitShift();

  if (transitionT >= 1) {
    cameraTarget.copy(desiredTarget);
    enterPlayMode();
  }
}

const modeSelect = document.getElementById('mode-select');

function enterPlayMode() {
  mode = 'play';
  joystickZone.style.display = '';
  hint.classList.remove('is-hidden');
  hintTimer = setTimeout(hideHint, 8000);
}

document.getElementById('btn-explore').addEventListener('click', () => {
  if (mode !== 'intro') return;
  mode = 'transition';
  transitionT = 0;
  modeSelect.classList.add('is-hidden');
});

document.getElementById('btn-regular').addEventListener('click', () => {
  window.location.href = '/';
});

// Boat locked until a mode is chosen: joystick hidden, input zeroed.
joystickZone.style.display = 'none';
boat.update(0.016, { throttle: 0, steer: 0 }, 0);
updateIntroCamera();

// Debug handle for console poking; not used by the app itself.
window.__world = {
  boat,
  controls,
  camera,
  renderer,
  scene,
  islands,
  snapCamera: () => updateCamera(1000),
  getMode: () => mode,
};

const clock = new THREE.Clock();
let elapsed = 0;

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  const driving = mode === 'play' && !popupOpen;
  const input = driving ? controls.read() : { throttle: 0, steer: 0 };
  boat.update(dt, input, elapsed, islands.colliders);
  ocean.update(elapsed, boat.position);
  islands.update(dt, boat.position, elapsed);

  if (mode === 'intro') {
    updateIntroCamera();
  } else if (mode === 'transition') {
    updateTransitionCamera(dt);
  } else {
    updateCamera(dt);
  }

  renderer.render(scene, camera);
});
