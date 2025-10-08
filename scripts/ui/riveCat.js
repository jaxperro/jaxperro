const ARTBOARD_NAME = "WCT 01";
const STATE_MACHINE_NAME = "CAT STATE";

let loadPromise = null;
let riveInstance = null;
let riveCanvas = null;
let runtimePromise = null;

function loadRuntime() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Rive runtime requires a browser environment."));
  }

  if (window.rive) {
    if (window.rive.RuntimeLoader) {
      window.rive.RuntimeLoader.setWasmUrl("scripts/vendor/rive.wasm");
    }
    return Promise.resolve(window.rive);
  }

  if (runtimePromise) return runtimePromise;

  runtimePromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "scripts/vendor/rive.js";
    script.async = true;
    script.onload = () => {
      if (window.rive) {
        if (window.rive.RuntimeLoader) {
          window.rive.RuntimeLoader.setWasmUrl("scripts/vendor/rive.wasm");
        }
        resolve(window.rive);
      } else {
        reject(new Error("Rive runtime loaded without exposing window.rive."));
      }
    };
    script.onerror = (event) => {
      runtimePromise = null;
      reject(new Error(`Failed to load Rive runtime: ${event?.message || "unknown error"}`));
    };
    document.head.appendChild(script);
  });

  return runtimePromise;
}

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

  const pending = (async () => {
    const runtime = await loadRuntime();
    const { Rive } = runtime;

    if (typeof Rive?.load === "function") {
      try {
        const riveFile = await Rive.load({ src: "assets/black_cat.riv" });
        const artboardNames = riveFile?.artboardNames ?? [];
        const artboard = riveFile?.artboardByName?.(ARTBOARD_NAME);
        const stateMachineNames = artboard?.stateMachineNames ?? [];
        const animationNames = artboard?.animationNames ?? [];
        // eslint-disable-next-line no-console
        console.info("[Rive] Artboards:", artboardNames);
        // eslint-disable-next-line no-console
        console.info("[Rive] State machines on", ARTBOARD_NAME, stateMachineNames);
        // eslint-disable-next-line no-console
        console.info("[Rive] Animations on", ARTBOARD_NAME, animationNames);
        riveFile?.delete?.();
      } catch (error) {
        console.error("Failed to inspect Rive file", error);
      }
    }

    return new Promise((resolve, reject) => {
      riveInstance = new Rive({
        src: "assets/black_cat.riv",
        canvas: riveCanvas,
        artboard: ARTBOARD_NAME,
        stateMachines: [STATE_MACHINE_NAME],
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

  loadPromise = pending.catch((error) => {
    loadPromise = null;
    return Promise.reject(error);
  });

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
