# Project Structure Overview

This mini-site is now organized by responsibility so you can extend features without digging through a single file. Below is a quick guide to the folders and the most important modules.

## HTML

- `index.html` — minimal scaffold that loads the shared styles and bootstraps the main JavaScript module. It contains only structural markup for the canvas, overlay text, popup container, and scrollable spacer.

## Styles

- `styles/base.css` — global resets and typography (background, fonts, `<main>` height, headings, paragraphs).
- `styles/layout.css` — page layout rules for the canvas and overlay positioning.
- `styles/components/popup.css` — styling for the popup layer and card animation variables.
- You can add more component files under `styles/components/` as new UI pieces appear, then link them from `index.html` (or bundle them via a build tool later).

## JavaScript

All scripts are ES modules loaded via `scripts/main.js`.

- `scripts/config.js`
  - Central place for constants and identifiers (helix geometry, camera path, popup copy, scroll behaviour, DOM ids).
  - Edit values here (e.g. `spinTurns`, `popupRevealMs`, `wheelUnlockPauseMs`) to tweak behaviour without touching feature code.

- `scripts/three/scene.js`
  - Creates the Three.js renderer, scene, camera, lights, and rainbow puck instancing.
  - Exports `initScene(canvas)` which returns `{ resize, render }`. `render` accepts `{ progress, spinTurns }` so the main loop controls the camera path.

- `scripts/ui/popups.js`
  - Encapsulates popup DOM logic. `createPopupManager()` exposes `show`, `hide`, and `setProgress` for other modules.
  - Reads copy from `config.js`, so adding/removing popups is just editing the config array.

- `scripts/ui/scroll.js`
  - Handles scroll/touch/keyboard input, computes scroll progress, triggers popup locks, and notifies the main loop by calling `onTargetChange`.
  - Keeps the stop locking logic self-contained; main code assigns callbacks and uses the manager’s API. When events originate inside a `[data-scroll-lock="true"]` element (the popup/Rive canvas), the handler exits early so page scroll is temporarily disabled.
  - Scroll locking is indicated by adding the `.scroll-locked` class to `<html>`/`<body>`, making it easy to apply consistent behaviour if other overlays need the same treatment.

- `scripts/ui/riveCat.js`
  - Lazy-loads the Rive runtime, initialises the `WCT 01` artboard, and plays the preferred state machine list (falling back to animations when required).
  - Registers pointer/touch listeners that translate screen coordinates into state machine inputs (eyes follow, run trigger) while locking document scroll, then detaches and restores scroll when the interaction ends.

- `scripts/main.js`
  - Entry point. Finds the canvas, initializes the scene and popup manager, wires the scroll controller, and runs the animation loop.
  - Handles window resizes and keeps the camera in sync with scroll progress via the scene’s `render` method.

## Assets

- `assets/` — currently empty but reserved for textures, imagery, fonts, etc. Add subfolders (`textures/`, `images/`, …) as needed.

## Docs

- `docs/structure.md` — this file. Expand it with deployment instructions, workflow tips, or convention lists as the project grows.

---

# Architecture Overview

This mini-site pulls together a 3D scene, scroll-driven choreography, popups, and a Rive animation that reacts to user input. The following sections highlight how the modules collaborate so you can extend or debug the experience quickly.

## High-Level Flow

1. **`index.html`** loads the shared CSS and boots `scripts/main.js`.
2. **`scripts/main.js`**
   - Instantiates the Three.js scene (`initScene`).
  - Creates a popup manager (`createPopupManager`) and a scroll controller (`initScrollController`).
  - Runs the render loop that lerps the camera toward the target scroll progress.
  - Listens for `popup:show` events; when popup one opens it triggers `ensureCatAnimation()` to lazy-load the Rive asset.
3. **Scroll interactions**
  - User scroll/touch/keys are intercepted by `scripts/ui/scroll.js`.
  - Crossing a configured stop locks the page, shows the popup, and emits `popup:show`.
  - When the user intentionally continues, the popup hides and normal scrolling resumes.
4. **Rive interactivity**
  - `scripts/ui/riveCat.js` loads the runtime/WASM, instantiates the `WCT 01` artboard, and plays the preferred state machines (`BLACK CATW`, `CAT STATE`, `CAT RUN`) or matching animations.
  - Pointer/touch events are mapped to state machine inputs: number inputs containing `x`/`y` drive the eye follow effect; boolean/trigger inputs containing `run` or `hover` fire when the pointer rests on the orb.
  - While the user interacts, the controller adds `.scroll-locked` to `<html>`/`<body>` so the page cannot scroll. It cleans everything up on pointer/touch end or when the popup closes.
  - A spinner inside the popup shows until the first Rive frame renders.

## Module Responsibilities

| Module | Role | Key Exports |
| ------ | ---- | ----------- |
| `scripts/config.js` | Central constants (helix geometry, camera path, popup content, scroll config). | `HELIX_CONFIG`, `CAMERA_PATH`, `POPUP_CONTENT`, `SCROLL_CONFIG`, DOM id constants. |
| `scripts/three/scene.js` | Sets up the Three.js renderer, spiralling puck instancing, and camera animation helpers. | `initScene(canvas)` returning `{ resize, render }`. |
| `scripts/ui/popups.js` | DOM manipulation for the popup layer (copy injection, show/hide animations). | `createPopupManager()` returning `{ show, hide, setProgress }`. |
| `scripts/ui/scroll.js` | Converts wheel/touch/key events into scroll progress, pauses at popup stops, and emits `popup:show`. | `initScrollController({ popupManager, onTargetChange })`. |
| `scripts/ui/riveCat.js` | Encapsulates the Rive runtime and interactive behaviour using the `RiveCatController` class. | `ensureCatAnimation()`, `resizeCatAnimation()`, `destroyCatAnimation()`. |
| `scripts/main.js` | Entry point that wires everything together and runs the animation loop. | – |

## RiveCatController Internals

`RiveCatController` keeps all Rive-related state scoped to the popup:

- **Runtime Loading** – Injects `scripts/vendor/rive.js`, points the runtime at `scripts/vendor/rive.wasm`, and caches the promise.
- **Canvas Setup** – Instantiates `new Rive({ … })`, plays whichever state machine/animation list is available, and toggles the spinner via a `data-loaded` attribute.
- **Input Discovery** – Caches references to number/boolean/trigger inputs for the active state machines so pointer/touch events can update them directly.
- **Event Wiring** – Pointer/touch listeners feed coordinates into the state machine. Document-level listeners call a shared prevent handler to block the page from scrolling while the cat is being manipulated.
- **Scroll Locking** – Adds/removes the `.scroll-locked` class on `<html>` and `<body>` so multiple overlays can share the same behaviour if needed.
- **Lifecycle** – `ensure()` loads on demand, `resize()` adjusts DPI whenever the popup resizes, `destroy()` cleans listeners, unlocks scroll, and hides the spinner.

## Extending The Architecture

- **Additional Popups** – Follow the same pattern: add copy in `POPUP_CONTENT`, build UI in `popups.js`, register any custom modules from `main.js`, and mark interactive popups with `data-scroll-lock="true"` if they must pause scrolling.
- **More Rive Animations** – Create a controller module similar to `RiveCatController`; hook it into `popup:show` for the corresponding stop.
- **Shared Scroll Locks** – Reuse the `.scroll-locked` class for any overlay that should suspend document scrolling.
- **Bundle/Build Step** – When the project outgrows CDN imports, add a bundler (e.g. Vite/Rollup) to tree-shake Three.js, host vendor assets locally, and manage cache busting.


### Extending The Project

- New UI feature? Add a stylesheet under `styles/components/`, a module under `scripts/ui/`, and expose a clean API for `main.js`.
- More scenes or Three.js experiments? Create additional helpers within `scripts/three/` and import them where appropriate.
- Additional pages? Duplicate `index.html`, include the shared styles/scripts, and customize the markup. Shared JS modules can be reused across pages.

Keep separating concerns by responsibility; it will remain easy to reason about and maintain even as you add more interactive elements.

---

# World (`/world`)

A self-contained 3D ocean scene served at `jaxperro.com/world`. Same conventions as the main site: ES modules from CDN (Three.js via import map, nipplejs as a UMD global), no build step, constants centralized in a config module.

- `world/index.html` — scaffold: import map, canvas, hint HUD, joystick zone.
- `world/styles.css` — full-viewport canvas, hint pill, full-screen joystick capture layer (the stick spawns where the user touches/clicks — nipplejs dynamic mode — and disappears on release).
- `world/js/config.js` — all tunables: sun position, fog, wave definitions, boat physics, camera follow.
- `world/js/scene.js` — renderer, camera, `Sky` dome, fog, lights. Exports `initScene(canvas)` returning `{ renderer, scene, camera, sunDirection }`.
- `world/js/ocean.js` — shader ocean. The wave list in `config.js` is compiled into the GLSL vertex shader **and** mirrored by `getWaterHeight(x, z, t)` in JS, so the boat bobs on exactly the surface the shader draws. The mesh recenters on the boat each frame; waves are computed in world space, so the ocean is effectively infinite.
- `world/js/boat.js` — low-poly boat built from primitives plus arcade physics (throttle/drag/speed-scaled steering) and wave-sampled buoyancy (height, pitch, roll).
- `world/js/controls.js` — merges WASD/arrow keys and the nipplejs joystick into one `{ throttle, steer }` input.
- `world/js/islands.js` — portfolio islands, built from the `ISLANDS` list in `config.js`. Each entry is pure data (position, footprint, interaction radius, action). The module owns proximity arming (pulse + glow affordance), the tap press animation (shrink/darken/recover, then the action fires), and the axis-aligned colliders the boat resolves against.
- `world/js/main.js` — entry point: wires scene, ocean, boat, islands, controls, damped third-person follow camera, and the render loop. Owns the island action map (e.g. `catPopup` reuses the home page's `createPopupManager` + `ensureCatAnimation`), gates input while a popup is open, and intercepts island taps in a capture-phase listener so they never reach the joystick. Exposes `window.__world` for console debugging.

**Adding a portfolio island** = add an entry to `ISLANDS` in `world/js/config.js`; if it needs a new behavior, add an action type to the map in `main.js`. The world page reuses the home popup (`styles/components/popup.css`, `scripts/ui/popups.js`, `scripts/ui/riveCat.js`); those modules now use root-absolute asset paths so they work from any page depth.
