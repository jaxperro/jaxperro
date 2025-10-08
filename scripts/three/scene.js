import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";
import { HELIX_CONFIG, CAMERA_PATH } from "../config.js";

function makeRainbowTexture(renderer) {
  const { capabilities } = renderer;
  const width = 1024;
  const height = 256;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  [
    ["#ff004c", 0],
    ["#ff7a00", 0.16],
    ["#ffee00", 0.33],
    ["#00d45a", 0.5],
    ["#00b2ff", 0.66],
    ["#7a3cff", 0.83],
    ["#ff2bd6", 1]
  ].forEach(([color, stop]) => gradient.addColorStop(stop, color));

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 1);
  texture.anisotropy =
    typeof capabilities.getMaxAnisotropy === "function"
      ? capabilities.getMaxAnisotropy()
      : 1;
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

function buildPuckMesh(renderer) {
  const {
    puckRadius,
    puckHeight,
    gap,
    count,
    helixRadius,
    helixTurns
  } = HELIX_CONFIG;

  const geometry = new THREE.CylinderGeometry(
    puckRadius,
    puckRadius,
    puckHeight,
    64,
    1,
    false
  );

  const material = new THREE.MeshStandardMaterial({
    map: makeRainbowTexture(renderer),
    metalness: 0.1,
    roughness: 0.35
  });

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const upAxis = new THREE.Vector3(0, 1, 0);
  const startY = -((count * gap) / 2);

  for (let i = 0; i < count; i += 1) {
    const y = startY + i * gap;
    const progress = i / count;
    const angle = progress * helixTurns * Math.PI * 2;

    position.set(
      Math.cos(angle) * helixRadius,
      y,
      Math.sin(angle) * helixRadius
    );
    quaternion.setFromAxisAngle(upAxis, angle);

    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(i, matrix);
  }

  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

export function initScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    200
  );
  camera.position.set(0, 0.5, 8);

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));

  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(3, 5, 4);
  scene.add(dirLight);

  const puckGroup = new THREE.Group();
  puckGroup.add(buildPuckMesh(renderer));
  scene.add(puckGroup);

  function resize(width, height) {
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function render({ progress, spinTurns }) {
    const { radius, yStart, yEnd, tilt } = CAMERA_PATH;
    const angle = progress * spinTurns * Math.PI * 2;
    const y = THREE.MathUtils.lerp(yStart, yEnd, progress);
    const bank = Math.sin(angle) * tilt;
    const ahead = angle + 0.02;

    camera.position.set(
      Math.sin(angle) * radius,
      y + bank,
      Math.cos(angle) * radius
    );
    camera.lookAt(
      Math.sin(ahead) * 0.5,
      y,
      Math.cos(ahead) * 0.5
    );

    renderer.render(scene, camera);
  }

  return {
    resize,
    render
  };
}
