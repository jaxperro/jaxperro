import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { SCENE } from './config.js';

// Sets up renderer, scene, camera, sky dome, fog, and lights.
// Returns the pieces main.js needs plus the shared sun direction vector.
export function initScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = SCENE.toneMappingExposure;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(SCENE.fogColor, SCENE.fogNear, SCENE.fogFar);

  const camera = new THREE.PerspectiveCamera(
    SCENE.cameraFov,
    window.innerWidth / window.innerHeight,
    0.5,
    4000
  );

  // Sun direction shared by the sky, lights, and ocean glint.
  const sunDirection = new THREE.Vector3();
  const phi = THREE.MathUtils.degToRad(90 - SCENE.sunElevationDeg);
  const theta = THREE.MathUtils.degToRad(SCENE.sunAzimuthDeg);
  sunDirection.setFromSphericalCoords(1, phi, theta);

  const sky = new Sky();
  sky.scale.setScalar(8000);
  const skyUniforms = sky.material.uniforms;
  skyUniforms.turbidity.value = 6;
  skyUniforms.rayleigh.value = 1.6;
  skyUniforms.mieCoefficient.value = 0.005;
  skyUniforms.mieDirectionalG.value = 0.8;
  skyUniforms.sunPosition.value.copy(sunDirection);
  scene.add(sky);

  const sunLight = new THREE.DirectionalLight(0xfff2dd, 2.4);
  sunLight.position.copy(sunDirection).multiplyScalar(120);
  scene.add(sunLight);

  const hemiLight = new THREE.HemisphereLight(0xbfdcec, 0x0d5c79, 0.9);
  scene.add(hemiLight);

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;

    // Keep a minimum horizontal FOV: with a fixed vertical FOV, portrait
    // screens would otherwise get a zoomed-in tunnel view of the boat.
    const baseV = THREE.MathUtils.degToRad(SCENE.cameraFov);
    const minH = THREE.MathUtils.degToRad(SCENE.minHorizontalFov);
    const hFov = 2 * Math.atan(Math.tan(baseV / 2) * camera.aspect);
    camera.fov =
      hFov < minH
        ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(minH / 2) / camera.aspect))
        : SCENE.cameraFov;
    camera.updateProjectionMatrix();

    // DPR can change when the window moves between displays or the page zooms.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
  }
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  // iOS/Android fire this when collapsing toolbars change the viewport
  // without always firing a window resize.
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resize);
  }

  return { renderer, scene, camera, sunDirection };
}
