## Spiral Scroll Playground

Interactive Three.js experiment where the camera orbits a rainbow corkscrew of pucks as you scroll. Popups pause the journey at evenly spaced checkpoints and resume after the user intentionally continues. Popup one now embeds a Rive animation that reacts to pointer/touch input.

### /world — driveable 3D portfolio ocean

`world/` is a second page served at [jaxperro.com/world](https://jaxperro.com/world): an infinite shader ocean with a boat you drive (WASD or touch joystick) and tappable islands that represent portfolio projects. It reuses this site's popup + Rive cat modules. **Developer guide — every config variable and the page logic — lives in [world/README.md](world/README.md).**

### Project Structure

- `index.html` – minimal entry point that links shared styles and `scripts/main.js`.
- `styles/` – global, layout, and component-specific CSS broken into separate files.
- `scripts/` – ES modules for configuration, Three.js scene setup, popup UI, scroll handling, and app bootstrap.
- `scripts/ui/riveCat.js` – lazy-loads the Rive runtime, boots the `WCT 01` artboard, and maps pointer/touch input to the `BLACK CATW` state machine so the cat follows the cursor/finger.
- `assets/` – placeholder for textures, images, and other static files.
- `docs/structure.md` – quick reference describing how everything fits together.

See [docs/structure.md](docs/structure.md) for a breakdown of the file layout and how the pieces work together.

### Working With The Rive Animation

1. **Export** the animation from the Rive editor using *Export → Runtime*, ensuring the artboard is named `WCT 01` (or update `ARTBOARD_NAME` in `scripts/ui/riveCat.js`).
2. **State Machines / Animations**: the loader prefers the `BLACK CATW`, `CAT STATE`, and `CAT RUN` state machines. If those are missing it falls back to the matching animations listed in `PREFERRED_ANIMATIONS`.
3. **Interactivity**: number inputs containing `x` or `y` drive the eye follow effect; boolean/trigger inputs containing `run` or `hover` fire when a pointer/touch is close to the centre orb. Adjust those heuristics inside `updateInputsFromClientPosition`.
4. **Mobile Support**: the module captures pointer/touch events, locks the document scroll (adds the `.scroll-locked` class to `<html>`/`<body>`) while interacting, and releases it on pointer/touch end. Everything is detached automatically when the popup closes.

To replace the animation, drop a new `.riv` file into `assets/black_cat.riv` and tweak the constants in `scripts/ui/riveCat.js` if the artboard or input names change.
