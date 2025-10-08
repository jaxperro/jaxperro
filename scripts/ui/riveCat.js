let loadPromise = null;
let riveInstance = null;
let riveCanvas = null;

function getCanvas() {
  return document.getElementById("rive-animation");
}

function resizeCanvas() {
  if (!riveCanvas || !riveInstance) return;
  const rect = riveCanvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  const dpr = window.devicePixelRatio || 1;
  riveCanvas.width = Math.round(rect.width * dpr);
  riveCanvas.height = Math.round(rect.height * dpr);
  riveInstance.resizeDrawingSurfaceToCanvas();
}

async function loadRive() {
  if (loadPromise) return loadPromise;

  riveCanvas = getCanvas();
  if (!riveCanvas) return null;

  loadPromise = (async () => {
    const { Rive } = await import(
      "https://unpkg.com/@rive-app/canvas@2.17.4?module"
    );

    return new Promise((resolve, reject) => {
      riveInstance = new Rive({
        src: "assets/black_cat.riv",
        canvas: riveCanvas,
        artboard: "BLACK CAT",
        stateMachines: ["CAT STATE"],
        autoplay: true,
        onLoad: () => {
          resizeCanvas();
          resolve(riveInstance);
        },
        onError: (error) => {
          console.error("Rive failed to load black_cat.riv", error);
          loadPromise = null;
          riveInstance = null;
          reject(error);
        }
      });
    });
  })();

  return loadPromise;
}

export async function ensureCatAnimation() {
  if (riveInstance) {
    resizeCanvas();
    return riveInstance;
  }

  return loadRive();
}

export function resizeCatAnimation() {
  resizeCanvas();
}

export function destroyCatAnimation() {
  if (!riveInstance) return;
  riveInstance.cleanup();
  riveInstance = null;
  riveCanvas = null;
  loadPromise = null;
}
