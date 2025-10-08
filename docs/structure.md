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

### Extending The Project

- New UI feature? Add a stylesheet under `styles/components/`, a module under `scripts/ui/`, and expose a clean API for `main.js`.
- More scenes or Three.js experiments? Create additional helpers within `scripts/three/` and import them where appropriate.
- Additional pages? Duplicate `index.html`, include the shared styles/scripts, and customize the markup. Shared JS modules can be reused across pages.

Keep separating concerns by responsibility; it will remain easy to reason about and maintain even as you add more interactive elements.
