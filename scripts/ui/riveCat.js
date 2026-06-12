/**
 * Rive controller for popup one.
 *
 * Responsibilities:
 *  - Lazy-load the Rive runtime/WASM bundle from `scripts/vendor/`.
 *  - Instantiate the exported artboard (`WCT 01`) and preferred state machines.
 *  - Map pointer/touch events to state machine inputs (eyes follow, run trigger).
 *  - Show a loading spinner until the first frame renders.
 *  - Lock document scrolling while the animation is being manipulated.
 */

const ARTBOARD_NAME = "WCT 01";
const PREFERRED_STATE_MACHINES = ["BLACK CATW", "CAT STATE", "CAT RUN"];
const PREFERRED_ANIMATIONS = ["CAT STATE", "CAT RUN", "EYES Y", "EYES X", "BLINK EYE"];
const CENTER_HOVER_RADIUS = 0.18;
const SCROLL_LOCK_CLASS = "scroll-locked";

const STATE_MACHINE_INPUT_TYPES = {
  NUMBER: 56,
  TRIGGER: 58,
  BOOLEAN: 59
};

let runtimePromise = null;
let scrollLockDepth = 0;
let controllerInstance = null;

function addScrollLock() {
  if (typeof document === "undefined") return;
  if (scrollLockDepth === 0) {
    document.body.classList.add(SCROLL_LOCK_CLASS);
    document.documentElement.classList.add(SCROLL_LOCK_CLASS);
  }
  scrollLockDepth += 1;
}

function removeScrollLock(force = false) {
  if (typeof document === "undefined") return;
  if (scrollLockDepth === 0) return;
  scrollLockDepth = force ? 0 : Math.max(0, scrollLockDepth - 1);
  if (scrollLockDepth === 0) {
    document.body.classList.remove(SCROLL_LOCK_CLASS);
    document.documentElement.classList.remove(SCROLL_LOCK_CLASS);
  }
}

function loadRuntime() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Rive runtime requires a browser environment."));
  }

  // Root-absolute URLs so the module works from any page depth (the world
  // page lives at /world/ and would otherwise resolve these to /world/...).
  if (window.rive) {
    if (window.rive.RuntimeLoader) {
      window.rive.RuntimeLoader.setWasmUrl("/scripts/vendor/rive.wasm");
    }
    return Promise.resolve(window.rive);
  }

  if (runtimePromise) return runtimePromise;

  runtimePromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/scripts/vendor/rive.js";
    script.async = true;
    script.onload = () => {
      if (window.rive) {
        if (window.rive.RuntimeLoader) {
          window.rive.RuntimeLoader.setWasmUrl("/scripts/vendor/rive.wasm");
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

class RiveCatController {
  constructor() {
    this.riveInstance = null;
    this.canvas = null;
    this.mediaContainer = null;
    this.loadPromise = null;
    this.pointerListenersAttached = false;
    this.touchListenersAttached = false;
    this.activeTouchId = null;
    this.stateMachineInputRegistry = this.createInputRegistry();

    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    this.handleInteractingScrollBlock = this.handleInteractingScrollBlock.bind(this);
  }

  createInputRegistry() {
    return {
      numberInputs: new Map(),
      booleanInputs: new Map(),
      triggerInputs: new Map(),
      defaults: new Map()
    };
  }

  resetInputRegistry() {
    this.stateMachineInputRegistry = this.createInputRegistry();
  }

  hasInteractiveInputs() {
    const { numberInputs, booleanInputs, triggerInputs } = this.stateMachineInputRegistry;
    return numberInputs.size > 0 || booleanInputs.size > 0 || triggerInputs.size > 0;
  }

  lockScroll() {
    addScrollLock();
  }

  unlockScroll(force = false) {
    removeScrollLock(force);
  }

  updateInputsFromClientPosition(clientX, clientY) {
    if (!this.canvas || !this.riveInstance) return;

    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const normX = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const normY = Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1);
    const centeredX = (normX - 0.5) * 2;
    const centeredY = (0.5 - normY) * 2;

    // Feed XY offsets into any number inputs whose name hints at axis control.
    this.stateMachineInputRegistry.numberInputs.forEach((input, name) => {
      const lower = name.toLowerCase();
      if (lower.includes("x")) {
        input.value = centeredX;
      } else if (lower.includes("y")) {
        input.value = centeredY;
      }
    });

    const distanceFromCenter = Math.hypot(normX - 0.5, normY - 0.5);
    const isCenterHover = distanceFromCenter < CENTER_HOVER_RADIUS;

    // Run/hover boolean inputs act like a latch while the pointer stays in the orb.
    this.stateMachineInputRegistry.booleanInputs.forEach((input, name) => {
      const lower = name.toLowerCase();
      if (lower.includes("run") || lower.includes("hover")) {
        input.value = isCenterHover;
      }
    });

    // Trigger inputs fire once per pass; Rive handles the actual transition.
    this.stateMachineInputRegistry.triggerInputs.forEach((input, name) => {
      const lower = name.toLowerCase();
      if ((lower.includes("run") || lower.includes("hover")) && isCenterHover) {
        input.fire();
      }
    });
  }

  findActiveTouch(touchList) {
    if (!touchList) return null;
    for (let i = 0; i < touchList.length; i += 1) {
      const touch = touchList[i];
      if (this.activeTouchId === null || touch.identifier === this.activeTouchId) {
        this.activeTouchId = touch.identifier;
        return touch;
      }
    }
    return null;
  }

  isEventOnCanvas(event) {
    if (!this.canvas) return false;
    const target = event.target;
    if (target && (target === this.canvas || this.canvas.contains(target))) {
      return true;
    }
    const pointList = event.changedTouches || event.touches;
    if (pointList && pointList.length > 0) {
      const rect = this.canvas.getBoundingClientRect();
      for (let i = 0; i < pointList.length; i += 1) {
        const touch = pointList[i];
        const x = touch.clientX;
        const y = touch.clientY;
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          return true;
        }
      }
    }
    return false;
  }

  handleInteractingScrollBlock(event) {
    if (!this.hasInteractiveInputs()) return;
    if (!this.isEventOnCanvas(event)) return;
    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopPropagation();
  }

  handlePointerDown(event) {
    if (!this.canvas || !this.riveInstance) return;
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    if (typeof this.canvas.setPointerCapture === "function" && event.pointerId != null) {
      try {
        this.canvas.setPointerCapture(event.pointerId);
      } catch (error) {
        // ignore capture errors
      }
    }
    if (!this.hasInteractiveInputs()) return;
    this.lockScroll();
    this.updateInputsFromClientPosition(event.clientX, event.clientY);
  }

  handlePointerMove(event) {
    if (!this.canvas || !this.riveInstance) return;
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    if (!this.hasInteractiveInputs()) return;
    this.updateInputsFromClientPosition(event.clientX, event.clientY);
  }

  handlePointerUp(event) {
    if (!this.canvas || !this.riveInstance) return;
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    if (typeof this.canvas.releasePointerCapture === "function" && event.pointerId != null) {
      try {
        this.canvas.releasePointerCapture(event.pointerId);
      } catch (error) {
        // ignore release errors
      }
    }
    this.handlePointerLeave();
  }

  handlePointerLeave() {
    this.stateMachineInputRegistry.numberInputs.forEach((input, name) => {
      if (this.stateMachineInputRegistry.defaults.has(name)) {
        input.value = this.stateMachineInputRegistry.defaults.get(name);
      }
    });

    this.stateMachineInputRegistry.booleanInputs.forEach((input) => {
      input.value = false;
    });

    this.activeTouchId = null;
    this.unlockScroll();
  }

  handleTouchStart(event) {
    if (!this.canvas || !this.riveInstance) return;
    if (event.cancelable) event.preventDefault();
    if (!this.hasInteractiveInputs()) return;
    if (!this.isEventOnCanvas(event)) return;

    const touch = event.changedTouches?.[0];
    if (!touch) return;
    this.activeTouchId = touch.identifier;
    this.lockScroll();
    this.updateInputsFromClientPosition(touch.clientX, touch.clientY);
    event.stopPropagation();
  }

  handleTouchMove(event) {
    if (!this.canvas || !this.riveInstance) return;
    if (event.cancelable) event.preventDefault();
    if (!this.hasInteractiveInputs()) return;
    if (!this.isEventOnCanvas(event)) return;

    const touch = this.findActiveTouch(event.changedTouches);
    if (!touch) return;
    this.updateInputsFromClientPosition(touch.clientX, touch.clientY);
    event.stopPropagation();
  }

  handleTouchEnd(event) {
    if (!this.canvas || !this.riveInstance) return;
    if (event.cancelable) event.preventDefault();
    if (!this.isEventOnCanvas(event)) return;

    const touch = this.findActiveTouch(event.changedTouches);
    if (!touch) return;

    this.handlePointerLeave();
    event.stopPropagation();
  }

  attachPointerListeners() {
    if (!this.canvas || this.pointerListenersAttached) return;

    this.canvas.addEventListener("pointerdown", this.handlePointerDown, { passive: false });
    this.canvas.addEventListener("pointermove", this.handlePointerMove, { passive: false });
    this.canvas.addEventListener("pointerup", this.handlePointerUp, { passive: false });
    this.canvas.addEventListener("pointercancel", this.handlePointerUp, { passive: false });
    this.canvas.addEventListener("pointerleave", this.handlePointerLeave, { passive: false });
    this.canvas.addEventListener("wheel", this.handleInteractingScrollBlock, { passive: false });
    this.pointerListenersAttached = true;
  }

  detachPointerListeners() {
    if (!this.canvas || !this.pointerListenersAttached) return;

    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas.removeEventListener("pointercancel", this.handlePointerUp);
    this.canvas.removeEventListener("pointerleave", this.handlePointerLeave);
    this.canvas.removeEventListener("wheel", this.handleInteractingScrollBlock);
    this.pointerListenersAttached = false;
  }

  attachTouchListeners() {
    if (!this.canvas || this.touchListenersAttached) return;

    this.canvas.addEventListener("touchstart", this.handleTouchStart, { passive: false });
    this.canvas.addEventListener("touchmove", this.handleTouchMove, { passive: false });
    this.canvas.addEventListener("touchend", this.handleTouchEnd, { passive: false });
    this.canvas.addEventListener("touchcancel", this.handleTouchEnd, { passive: false });
    document.addEventListener("touchstart", this.handleInteractingScrollBlock, { passive: false });
    document.addEventListener("touchmove", this.handleInteractingScrollBlock, { passive: false });
    this.touchListenersAttached = true;
  }

  detachTouchListeners() {
    if (!this.canvas || !this.touchListenersAttached) return;

    this.canvas.removeEventListener("touchstart", this.handleTouchStart);
    this.canvas.removeEventListener("touchmove", this.handleTouchMove);
    this.canvas.removeEventListener("touchend", this.handleTouchEnd);
    this.canvas.removeEventListener("touchcancel", this.handleTouchEnd);
    document.removeEventListener("touchstart", this.handleInteractingScrollBlock);
    document.removeEventListener("touchmove", this.handleInteractingScrollBlock);
    this.touchListenersAttached = false;
  }

  registerStateMachineInputs(stateMachineNames) {
    this.resetInputRegistry();
    if (!this.riveInstance || !Array.isArray(stateMachineNames)) return;

    stateMachineNames.forEach((name) => {
      const inputs = this.riveInstance.stateMachineInputs?.(name) ?? [];
      inputs.forEach((input) => {
        this.stateMachineInputRegistry.defaults.set(input.name, input.value);
        if (input.type === STATE_MACHINE_INPUT_TYPES.NUMBER) {
          this.stateMachineInputRegistry.numberInputs.set(input.name, input);
        } else if (input.type === STATE_MACHINE_INPUT_TYPES.BOOLEAN) {
          this.stateMachineInputRegistry.booleanInputs.set(input.name, input);
        } else if (input.type === STATE_MACHINE_INPUT_TYPES.TRIGGER) {
          this.stateMachineInputRegistry.triggerInputs.set(input.name, input);
        }
      });
    });

    if (this.hasInteractiveInputs()) {
      this.attachPointerListeners();
      this.attachTouchListeners();
    } else {
      this.detachPointerListeners();
      this.detachTouchListeners();
    }
  }

  resize() {
    if (!this.canvas || !this.riveInstance) return;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.riveInstance.resizeDrawingSurfaceToCanvas();
  }

  async ensure() {
    return this.load();
  }

  async load() {
    if (this.loadPromise) return this.loadPromise;

    const canvas = getCanvas();
    if (!canvas) return null;

    this.canvas = canvas;
    this.mediaContainer = canvas.parentElement;
    if (this.mediaContainer) {
      this.mediaContainer.removeAttribute("data-loaded");
    }

    this.loadPromise = (async () => {
      const runtime = await loadRuntime();
      const { Rive } = runtime;

      return new Promise((resolve, reject) => {
        const riveConfig = {
          src: "/assets/black_cat.riv",
          canvas: this.canvas,
          artboard: ARTBOARD_NAME,
          autoplay: false,
          onLoad: () => {
            try {
              this.resize();
              const availableAnimations = new Set(this.riveInstance?.animationNames ?? []);
              const availableStateMachines = new Set(
                this.riveInstance?.stateMachineNames ?? []
              );
              const playableMachines = PREFERRED_STATE_MACHINES.filter((name) =>
                availableStateMachines.has(name)
              );
              const playableAnimations = PREFERRED_ANIMATIONS.filter((name) =>
                availableAnimations.has(name)
              );

              const playbackList = playableMachines.length > 0
                ? playableMachines
                : playableAnimations.length > 0
                  ? playableAnimations
                  : availableAnimations.has("CAT STATE")
                    ? ["CAT STATE"]
                    : [];

              if (playbackList.length > 0) {
                this.riveInstance.play(playbackList);
              } else {
                this.riveInstance.play();
              }

              this.registerStateMachineInputs(playableMachines);

              if (this.mediaContainer) {
                this.mediaContainer.setAttribute("data-loaded", "true");
              }
            } catch (error) {
              reject(error);
              return;
            }
            resolve(this.riveInstance);
          },
          onError: (error) => {
            console.error("Rive failed to load black_cat.riv", error);
            this.riveInstance = null;
            this.loadPromise = null;
            if (this.mediaContainer) {
              this.mediaContainer.removeAttribute("data-loaded");
            }
            reject(error);
          }
        };

        this.riveInstance = new Rive(riveConfig);
      });
    })();

    this.loadPromise.catch(() => {
      this.loadPromise = null;
    });

    return this.loadPromise;
  }

  destroy() {
    this.riveInstance?.cleanup();
    this.riveInstance = null;
    this.detachPointerListeners();
    this.detachTouchListeners();
    this.resetInputRegistry();
    this.activeTouchId = null;
    if (this.mediaContainer) {
      this.mediaContainer.removeAttribute("data-loaded");
    }
    this.canvas = null;
    this.mediaContainer = null;
    this.loadPromise = null;
    this.unlockScroll(true);
  }
}

export async function ensureCatAnimation() {
  if (!controllerInstance) {
    controllerInstance = new RiveCatController();
  }
  return controllerInstance.ensure();
}

export function resizeCatAnimation() {
  controllerInstance?.resize();
}

export function destroyCatAnimation() {
  if (!controllerInstance) return;
  controllerInstance.destroy();
  controllerInstance = null;
}
