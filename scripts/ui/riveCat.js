const ARTBOARD_NAME = "WCT 01";
const PREFERRED_STATE_MACHINES = ["BLACK CATW", "CAT STATE", "CAT RUN"];
const PREFERRED_ANIMATIONS = [
  "CAT STATE",
  "CAT RUN",
  "EYES Y",
  "EYES X",
  "BLINK EYE",
  "BLACK CATW",
  "SOLO FX"
];

const STATE_MACHINE_INPUT_TYPES = {
  NUMBER: 56,
  TRIGGER: 58,
  BOOLEAN: 59
};

let stateMachineInputRegistry = {
  numberInputs: new Map(),
  booleanInputs: new Map(),
  triggerInputs: new Map(),
  defaults: new Map()
};
let pointerListenersAttached = false;
let touchListenersAttached = false;
let activeTouchId = null;

let loadPromise = null;
let riveInstance = null;
let riveCanvas = null;
let runtimePromise = null;

function resetInputRegistry() {
  stateMachineInputRegistry = {
    numberInputs: new Map(),
    booleanInputs: new Map(),
    triggerInputs: new Map(),
    defaults: new Map()
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function hasInteractiveInputs() {
  return (
    stateMachineInputRegistry.numberInputs.size > 0 ||
    stateMachineInputRegistry.booleanInputs.size > 0 ||
    stateMachineInputRegistry.triggerInputs.size > 0
  );
}

function updateInputsFromClientPosition(clientX, clientY) {
  if (!riveCanvas || !riveInstance) return;

  const rect = riveCanvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  const normX = clamp((clientX - rect.left) / rect.width, 0, 1);
  const normY = clamp((clientY - rect.top) / rect.height, 0, 1);
  const centeredX = (normX - 0.5) * 2;
  const centeredY = (0.5 - normY) * 2;

  stateMachineInputRegistry.numberInputs.forEach((input, name) => {
    const lower = name.toLowerCase();
    if (lower.includes("x")) {
      input.value = centeredX;
    } else if (lower.includes("y")) {
      input.value = centeredY;
    }
  });

  const distanceFromCenter = Math.hypot(normX - 0.5, normY - 0.5);
  const isCenterHover = distanceFromCenter < 0.18;

  stateMachineInputRegistry.booleanInputs.forEach((input, name) => {
    const lower = name.toLowerCase();
    if (lower.includes("run") || lower.includes("hover")) {
      input.value = isCenterHover;
    }
  });

  stateMachineInputRegistry.triggerInputs.forEach((input, name) => {
    const lower = name.toLowerCase();
    if ((lower.includes("run") || lower.includes("hover")) && isCenterHover) {
      input.fire();
    }
  });
}

function findActiveTouch(touchList) {
  if (!touchList) return null;
  for (let i = 0; i < touchList.length; i += 1) {
    const touch = touchList[i];
    if (activeTouchId === null || touch.identifier === activeTouchId) {
      activeTouchId = touch.identifier;
      return touch;
    }
  }
  return null;
}

function preventScroll(event) {
  if (!hasInteractiveInputs()) return;
  if (event.cancelable) {
    event.preventDefault();
  }
}

function attachPointerListeners() {
  if (!riveCanvas || pointerListenersAttached) return;

  riveCanvas.addEventListener("pointermove", handlePointerMove);
  riveCanvas.addEventListener("pointerdown", handlePointerMove);
  riveCanvas.addEventListener("pointerup", handlePointerLeave);
  riveCanvas.addEventListener("pointerleave", handlePointerLeave);
  riveCanvas.addEventListener("wheel", preventScroll, { passive: false });
  pointerListenersAttached = true;
}

function detachPointerListeners() {
  if (!riveCanvas || !pointerListenersAttached) return;

  riveCanvas.removeEventListener("pointermove", handlePointerMove);
  riveCanvas.removeEventListener("pointerdown", handlePointerMove);
  riveCanvas.removeEventListener("pointerup", handlePointerLeave);
  riveCanvas.removeEventListener("pointerleave", handlePointerLeave);
  riveCanvas.removeEventListener("wheel", preventScroll);
  pointerListenersAttached = false;
}

function attachTouchListeners() {
  if (!riveCanvas || touchListenersAttached) return;

  riveCanvas.addEventListener("touchstart", handleTouchStart, { passive: false });
  riveCanvas.addEventListener("touchmove", handleTouchMove, { passive: false });
  riveCanvas.addEventListener("touchend", handleTouchEnd, { passive: false });
  riveCanvas.addEventListener("touchcancel", handleTouchEnd, { passive: false });
  touchListenersAttached = true;
}

function detachTouchListeners() {
  if (!riveCanvas || !touchListenersAttached) return;

  riveCanvas.removeEventListener("touchstart", handleTouchStart);
  riveCanvas.removeEventListener("touchmove", handleTouchMove);
  riveCanvas.removeEventListener("touchend", handleTouchEnd);
  riveCanvas.removeEventListener("touchcancel", handleTouchEnd);
  touchListenersAttached = false;
}

function handlePointerMove(event) {
  if (!riveCanvas || !riveInstance) return;
  if (event.cancelable) {
    event.preventDefault();
  }
  if (!hasInteractiveInputs()) return;
  updateInputsFromClientPosition(event.clientX, event.clientY);
}

function handlePointerLeave() {
  stateMachineInputRegistry.numberInputs.forEach((input, name) => {
    if (stateMachineInputRegistry.defaults.has(name)) {
      input.value = stateMachineInputRegistry.defaults.get(name);
    }
  });

  stateMachineInputRegistry.booleanInputs.forEach((input) => {
    input.value = false;
  });

  activeTouchId = null;
}

function handleTouchStart(event) {
  if (!riveCanvas || !riveInstance) return;
  if (event.cancelable) event.preventDefault();
  if (!hasInteractiveInputs()) return;

  const touch = event.changedTouches[0];
  if (!touch) return;
  activeTouchId = touch.identifier;
  updateInputsFromClientPosition(touch.clientX, touch.clientY);
}

function handleTouchMove(event) {
  if (!riveCanvas || !riveInstance) return;
  if (event.cancelable) event.preventDefault();
  if (!hasInteractiveInputs()) return;

  const touch = findActiveTouch(event.changedTouches);
  if (!touch) return;
  updateInputsFromClientPosition(touch.clientX, touch.clientY);
}

function handleTouchEnd(event) {
  if (!riveCanvas || !riveInstance) return;
  if (event.cancelable) event.preventDefault();

  const touch = findActiveTouch(event.changedTouches);
  if (!touch) return;

  handlePointerLeave();
}

function registerStateMachineInputs(stateMachineNames) {
  resetInputRegistry();
  if (!riveInstance || !Array.isArray(stateMachineNames)) return;

  stateMachineNames.forEach((name) => {
    const inputs = riveInstance.stateMachineInputs?.(name) ?? [];
    inputs.forEach((input) => {
      stateMachineInputRegistry.defaults.set(input.name, input.value);
      if (input.type === STATE_MACHINE_INPUT_TYPES.NUMBER) {
        stateMachineInputRegistry.numberInputs.set(input.name, input);
      } else if (input.type === STATE_MACHINE_INPUT_TYPES.BOOLEAN) {
        stateMachineInputRegistry.booleanInputs.set(input.name, input);
      } else if (input.type === STATE_MACHINE_INPUT_TYPES.TRIGGER) {
        stateMachineInputRegistry.triggerInputs.set(input.name, input);
      }
      // eslint-disable-next-line no-console
      console.info(
        `[Rive] Input (${name})`,
        input.name,
        "type",
        input.type,
        "default",
        input.value
      );
    });
  });

  if (hasInteractiveInputs()) {
    attachPointerListeners();
    attachTouchListeners();
  } else {
    detachPointerListeners();
    detachTouchListeners();
  }
}

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

            let toPlay = [];
            if (stateMachinesToPlay.length > 0) {
              toPlay = stateMachinesToPlay;
            } else if (animationsToPlay.length > 0) {
              toPlay = animationsToPlay;
            } else if (availableAnimations.has("CAT STATE")) {
              toPlay = ["CAT STATE"];
            }

            if (toPlay.length > 0) {
              riveInstance.play(toPlay);
            } else {
              riveInstance.play();
            }

            registerStateMachineInputs(stateMachinesToPlay);

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
  detachPointerListeners();
  detachTouchListeners();
  resetInputRegistry();
  activeTouchId = null;
  riveCanvas = null;
  loadPromise = null;
}
