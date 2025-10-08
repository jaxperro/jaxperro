import { initScene } from "./three/scene.js";
import { createPopupManager } from "./ui/popups.js";
import { initScrollController } from "./ui/scroll.js";
import { CANVAS_ID, SCROLL_CONFIG } from "./config.js";

async function initRiveAnimation() {
  const riveCanvas = document.getElementById("rive-animation");
  if (!riveCanvas) return null;

  const { Rive } = await import(
    "https://unpkg.com/@rive-app/canvas@2.17.4?module"
  );

  let riveInstance = null;
  const controller = {
    resize() {
      if (!riveCanvas) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = riveCanvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      riveCanvas.width = Math.round(rect.width * dpr);
      riveCanvas.height = Math.round(rect.height * dpr);
      riveInstance?.resizeDrawingSurfaceToCanvas();
    },
    destroy() {
      riveInstance?.cleanup();
      riveInstance = null;
    }
  };

  riveInstance = new Rive({
    src: "assets/black_cat.riv",
    canvas: riveCanvas,
    autoplay: true,
    onLoad: () => {
      controller.resize();
    }
  });

  return controller;
}

const canvas = document.getElementById(CANVAS_ID);
if (!canvas) {
  throw new Error(`Canvas with id "${CANVAS_ID}" not found.`);
}

const scene = initScene(canvas);
const popupManager = createPopupManager();

let targetProgress = 0;
let progress = 0;
let riveController = null;

document.addEventListener("popup:show", (event) => {
  const index = event?.detail?.index;
  if (index === 0) {
    requestAnimationFrame(() => riveController?.resize());
  }
});

const scrollController = initScrollController({
  popupManager,
  onTargetChange: (value) => {
    targetProgress = value;
  }
});

function handleResize() {
  scene.resize(window.innerWidth, window.innerHeight);
  scrollController.refresh();
  riveController?.resize();
}

window.addEventListener("resize", handleResize);

window.scrollTo({ top: 0, behavior: "auto" });
handleResize();

initRiveAnimation()
  .then((controller) => {
    riveController = controller;
    riveController?.resize();
  })
  .catch((error) => {
    console.error("Failed to initialize Rive animation", error);
  });

let lastFrame = performance.now();
function tick(now = performance.now()) {
  const delta = Math.min((now - lastFrame) / 1000, 0.033);
  lastFrame = now;

  progress += (targetProgress - progress) * Math.min(1, delta * 6);
  scene.render({ progress, spinTurns: SCROLL_CONFIG.spinTurns });

  requestAnimationFrame(tick);
}

tick();
