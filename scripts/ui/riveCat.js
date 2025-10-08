const ARTBOARD_NAME = "WCT 01";
const PREFERRED_STATE_MACHINES = ["CAT STATE", "CAT RUN"];
const PREFERRED_ANIMATIONS = [
  "BLACK CATW",
  "EYES Y",
  "EYES X",
  "BLINK EYE",
  "CAT RUN",
  "SOLO FX"
];

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

    return new Promise((resolve, reject) => {
      const riveConfig = {
        src: "assets/black_cat.riv",
        canvas: riveCanvas,
        artboard: ARTBOARD_NAME,
        autoplay: false,
        onLoad: () => {
          resizeCanvas();
          try {
            const availableAnimations = new Set(riveInstance?.animationNames ?? []);
            const availableStateMachines = new Set(
              riveInstance?.stateMachineNames ?? []
            );
            const animationsToPlay = PREFERRED_ANIMATIONS.filter((name) =>
              availableAnimations.has(name)
            );
            const stateMachinesToPlay = PREFERRED_STATE_MACHINES.filter((name) =>
              availableStateMachines.has(name)
            );

            const toPlay = [...stateMachinesToPlay, ...animationsToPlay];
            if (toPlay.length > 0) {
              riveInstance?.play(toPlay);
            } else {
              riveInstance?.play();
            }

            // eslint-disable-next-line no-console
            console.info("[Rive] Available animations:", [...availableAnimations]);
            // eslint-disable-next-line no-console
            console.info(
              "[Rive] Available state machines:",
              [...availableStateMachines]
            );
            // eslint-disable-next-line no-console
            console.info("[Rive] Playing:", toPlay.length > 0 ? toPlay : "default");
          } catch (error) {
            console.error("Failed to start Rive animations", error);
          }
          resolve(riveInstance);
        },
        onError: (error) => {
          console.error("Rive failed to load black_cat.riv", error);
          loadPromise = null;
          riveInstance = null;
          reject(error);
        }
      };

      riveInstance = new Rive(riveConfig);
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
