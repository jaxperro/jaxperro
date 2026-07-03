## Spiral Scroll Playground

Interactive Three.js experiment where the camera orbits a rainbow corkscrew of pucks as you scroll. Popups pause the journey at evenly spaced checkpoints and resume after the user intentionally continues. Popup one now embeds a Rive animation that reacts to pointer/touch input.

### /world — driveable 3D portfolio ocean

`world/` is a second page served at [jaxperro.com/world](https://jaxperro.com/world): an infinite shader ocean with a boat you drive (WASD or touch joystick) and tappable islands that represent portfolio projects. It reuses this site's popup + Rive cat modules. **Developer guide — every config variable and the page logic — lives in [world/README.md](world/README.md).**

### /trading — Polymarket dashboard

A static, single-file dashboard (no build step — edit the HTML, push, done):

- **[`trading/index.html`](trading/index.html)** → [jaxperro.com/trading](https://jaxperro.com/trading) —
  the winning-wallet-finder dashboard: live copy-bot book (open/resolved/missed
  bets, per-wallet allocation), the fee-and-lag-modeled backtest book, and the
  validated-sharps table. **All data comes from three JSON feeds in the
  [winning-wallet-finder](https://github.com/jaxperro/winning-wallet-finder)
  repo via raw.githubusercontent** (`copybot_live.json`, `portfolio.json`,
  `watch_sharps.json`) — this page is only a renderer, with a fee-blind
  client-side replay as fallback. Selection/execution logic lives (and is
  documented) in that repo, not here.
- `archive/trading2/` — the retired "Mop-Up Yield" favorites paper book
  (page, runner, final book state, and its Actions workflow). Legacy — the
  strategy was superseded by the copy-trading system; nothing runs it.

**⚠ Pages deploy quota — batch your pushes.** Every push to this repo triggers
a GitHub Pages deploy (`[skip ci]` does **not** skip Pages), and Pages
soft-limits ~**10 deploys/hour**; past that, deployments fail with a generic
"try again later" until the window rolls (builds still succeed — re-run the
failed "pages build and deployment" run once the hour clears). When iterating
on the dashboard, batch several edits into one commit/push instead of pushing
each tweak.

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
