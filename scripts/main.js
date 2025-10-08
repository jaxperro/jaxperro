import { initScene } from "./three/scene.js";
import { createPopupManager } from "./ui/popups.js";
import { initScrollController } from "./ui/scroll.js";
import { CANVAS_ID, SCROLL_CONFIG } from "./config.js";
import {
  ensureCatAnimation,
  resizeCatAnimation
} from "./ui/riveCat.js";

const canvas = document.getElementById(CANVAS_ID);
if (!canvas) {
  throw new Error(`Canvas with id "${CANVAS_ID}" not found.`);
}

const scene = initScene(canvas);
const popupManager = createPopupManager();

let targetProgress = 0;
let progress = 0;

document.addEventListener("popup:show", (event) => {
  const index = event?.detail?.index;
  if (index === 0) {
    ensureCatAnimation()
      .then((instance) => {
        if (!instance) return;
        requestAnimationFrame(() => resizeCatAnimation());
      })
      .catch((error) => {
        console.error("Failed to start Rive animation", error);
      });
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
  resizeCatAnimation();
}

window.addEventListener("resize", handleResize);

window.scrollTo({ top: 0, behavior: "auto" });
handleResize();

let lastFrame = performance.now();
function tick(now = performance.now()) {
  const delta = Math.min((now - lastFrame) / 1000, 0.033);
  lastFrame = now;

  progress += (targetProgress - progress) * Math.min(1, delta * 6);
  scene.render({ progress, spinTurns: SCROLL_CONFIG.spinTurns });

  requestAnimationFrame(tick);
}

tick();
