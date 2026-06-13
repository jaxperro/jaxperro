# /world — driveable 3D portfolio ocean

A self-contained Three.js scene served at [jaxperro.com/world](https://jaxperro.com/world):
an infinite ocean you drive a boat around in, with islands that represent
portfolio projects. Tapping an island opens a popup.

**Stack:** Three.js + nipplejs from CDN, ES modules, **no build step**. Edit a
file, refresh the browser. Served by GitHub Pages from the repo root, so the
page also reuses a few home-page modules (popup + Rive cat) via root-absolute
paths.

## Run it locally

Serve the **repo root** (not this folder — the page imports `/scripts/...` and
`/styles/...` from the home page):

```sh
python3 -m http.server 4173    # from the repo root
# open http://localhost:4173/world/
```

## File map

| File | What it does |
| --- | --- |
| `index.html` | Scaffold: import map, canvas, hint HUD, Explore/Regular buttons, joystick zone, popup markup. |
| `styles.css` | Full-viewport canvas, mode buttons, full-screen joystick layer, full-screen popup overrides. |
| `js/config.js` | **Every tunable lives here.** Start here for any "make X faster/bigger/bluer" change. |
| `js/main.js` | Entry point: wires everything, owns the mode state machine, cameras, popups, and the render loop. |
| `js/scene.js` | Renderer, camera, `Sky` dome, fog, lights → `initScene(canvas)` returns `{ renderer, scene, camera, sunDirection }`. |
| `js/ocean.js` | Shader ocean → `createOcean(sunDirection)` returns `{ mesh, update }`; also exports `getWaterHeight(x, z, t)`. |
| `js/boat.js` | Procedural boat + arcade physics → `createBoat()` returns `{ group, position, update, getForward, getSpeed }`. |
| `js/controls.js` | WASD/arrows + nipplejs joystick → `createControls(zone, { onFirstInput })` returns `{ read }` giving `{ throttle, steer }` in −1..1. |
| `js/islands.js` | Islands from config → `createIslands({ onActivate })` returns `{ group, colliders, update, handleTap }`. |
| `js/models.js` | `GLTFLoader` wrapper for swapping in real 3D models (`loadModel`, `clearGroup`). |
| `assets/models/` | Drop `.glb` files here to replace the boat/island visuals — see its [README](assets/models/README.md). |

## How the page flows

1. **Load → `intro` mode.** Camera sits ahead of the bow looking back at the
   boat. Boat input is zeroed and the joystick zone is hidden. Two buttons
   show: **Explore** and **Regular** (→ navigates to `/`).
2. **Explore → `transition` mode.** The camera sweeps around the boat's side
   from bow to stern (orbit, not over the top — passing overhead whips the
   lookAt azimuth and reads as a jump). Radius/height blend from the intro
   pose to the chase pose so both endpoints are exactly continuous.
3. **`play` mode.** Joystick + keyboard live, damped third-person chase
   camera. The hint pill shows, then auto-hides.

Every frame (`main.js` render loop): read input (zeroed unless `play` and no
popup open) → `boat.update` → `ocean.update` → `islands.update` → camera for
the current mode → render.

### Input pipeline

- `controls.read()` merges keyboard and joystick into one `{ throttle, steer }`.
- The joystick is nipplejs **dynamic mode** on a full-screen zone: it spawns
  wherever you touch/click and disappears on release.
- A **capture-phase** `pointerdown` listener raycasts armed islands *before*
  nipplejs sees the event; island taps are consumed so no joystick spawns.

### Ocean / boat sync (the one invariant you must not break)

The wave list in `OCEAN.waves` is compiled into the ocean's GLSL vertex shader
**and** mirrored by `getWaterHeight(x, z, t)` in JS. The boat samples that JS
function for buoyancy (height at center, pitch fore/aft, roll port/starboard),
so it rides exactly the surface the shader draws. **Only change waves via the
config list** — never edit the GLSL or the JS sampler independently.

The ocean mesh recenters on the boat every frame while waves are computed in
world space, so the sea is effectively infinite with a finite mesh.

### Islands

Each island is data in `ISLANDS` (see below). At runtime each one is a wrapper
`Group` holding its visual — a colored box by default, or a `.glb` model.

- **Arming:** within `interactionRadius` the island eases to "armed" — gentle
  scale pulse + emissive glow signals it's tappable.
- **Tap:** raycast hit starts a press animation (shrink ~12% + darken 45%,
  then recover, ~0.45 s). When it completes, `onActivate(config)` fires and
  `main.js` dispatches `config.action.type` through its action map:
  - `catPopup` — opens the home page's Rive cat popup (shared modules).
  - `emptyPopup` — placeholder full-screen panel for projects without content yet.
- **Collision:** axis-aligned square colliders (always from `size`, never the
  model). Boat physics push out along the least-penetration axis and bleed
  speed, so the hull grinds along island faces.

### Popups

The popup card/DOM and the Rive cat come from the home page
(`/styles/components/popup.css`, `/scripts/ui/popups.js`,
`/scripts/ui/riveCat.js`) — those modules use root-absolute asset paths so
they work from `/world/` too. The world's `styles.css` overrides the card to
**fill the whole screen**, and adds the close (×) button. While a popup is
open, boat input is zeroed and the joystick layer is hidden.

## All config variables (`js/config.js`)

### `SCENE`

| Variable | Default | Meaning |
| --- | --- | --- |
| `sunElevationDeg` / `sunAzimuthDeg` | `18` / `135` | Sun position; drives the Sky shader, directional light, and ocean glint. |
| `fogColor` | `0xbfdcec` | Should visually match the sky at the horizon. |
| `fogNear` / `fogFar` | `90` / `620` | Fog distances; `fogFar` must stay well under half of `OCEAN.size` so the mesh edge is never visible. |
| `toneMappingExposure` | `0.68` | ACES filmic exposure. |
| `cameraFov` | `55` | Vertical FOV on landscape screens. |
| `minHorizontalFov` | `70` | On narrow (portrait) screens the vertical FOV widens so the horizontal view never drops below this. |

### `OCEAN`

| Variable | Default | Meaning |
| --- | --- | --- |
| `size` / `segments` | `1500` / `256` | Mesh extent and resolution. |
| `deepColor` / `shallowColor` | `0x0d5c79` / `0x9fd3e8` | Fresnel blend: deep when looking down, shallow toward the horizon. |
| `waves` | 3 entries | `{ amplitude, wavelength, direction }` per swell. Compiled into GLSL **and** mirrored in JS (see invariant above). Keep wavelengths above ~4× the vertex spacing (`size/segments`) or they shimmer. |

### `BOAT`

| Variable | Default | Meaning |
| --- | --- | --- |
| `maxForwardSpeed` / `maxReverseSpeed` | `13` / `4.5` | Speed clamps (world units/s). |
| `acceleration` | `7` | Throttle acceleration (reverse uses 60% of it). |
| `drag` | `0.55` | Exponential speed bleed; higher = stops faster. |
| `turnRate` | `1.4` | Steering rate (rad/s at full speed). Rudder authority is 35% at standstill, growing with speed; reversing flips the steering sense. |
| `floatOffset` | `0.18` | How far above the sampled water height the hull rests. |
| `pitchSampleDist` / `rollSampleDist` | `2.4` / `1.1` | Buoyancy sample spacing (fore/aft, port/starboard). Bigger = smoother, smaller = more responsive tilt. |
| `model` | `null` | Optional `.glb` swap: `{ url, scale, yOffset, rotationY }`. See [assets/models/README.md](assets/models/README.md). |

### `CAMERA_FOLLOW` (chase camera in `play`)

| Variable | Default | Meaning |
| --- | --- | --- |
| `distance` / `height` | `11` / `4.6` | Camera offset behind/above the boat. |
| `lookAhead` / `lookHeight` | `6` / `1.4` | The look target sits this far ahead of/above the boat. |
| `positionDamping` / `targetDamping` | `3.5` / `4.5` | Exponential smoothing rates; higher = stiffer follow. Waves never jitter the view because both are critically damped. |
| `portraitScreenShift` | `0.3` | On portrait screens the camera pitches up so the boat sits in the lower third of the frame (fraction of NDC half-height; fades out approaching landscape aspect). |

### `CAMERA_INTRO` (landing shot + Explore sweep)

| Variable | Default | Meaning |
| --- | --- | --- |
| `distance` / `height` | `12` / `2.6` | Camera ahead of the bow, low over the water. |
| `lookHeight` | `1.1` | Look target height on the boat. |
| `transitionDuration` | `2.6` | Seconds for the Explore sweep. |
| `arcHeight` | `2.5` | Extra mid-sweep rise so the orbit doesn't skim the water. |

### `ISLANDS`

One entry per portfolio project:

```js
{
  id: 'cat',                      // unique name
  position: [0, 140],             // world [x, z]; boat spawns at origin facing +z
  footprint: 'square',            // axis-aligned square (only footprint so far)
  size: 18,                       // box width/depth — also the collider size
  height: 10,                     // box height (base sinks ~1.5 below water)
  color: 0xd9c08a,                // box color
  interactionRadius: 76,          // boat distance at which it arms + accepts taps
  action: { type: 'catPopup' },   // dispatched via the action map in main.js
  model: null,                    // optional .glb visual swap (collider unchanged)
}
```

The twelve islands ring the spawn in a full circle — one every 30° at radius
~120, positioned as `[r·sin θ, r·cos θ]` — each with a unique color. The
front three (green −30°, tan 0°, purple +30°) form the arc you see on load,
with the tan cat island pushed to radius 140 as the far point. Slots
`project-2` … `project-12` are `emptyPopup` placeholders waiting for real
projects.

**Adding an island** = add an entry here. Default it to
`action: { type: 'emptyPopup' }` until the project has real content; if it
needs novel behavior, add an action type to `islandActions` in `main.js`.
Keep new islands within ~`fogFar` of something visible, or players won't find
them.

### `DOM_IDS`

Central registry of element ids used by `main.js` (`scene`, `joystick-zone`,
`hint`, `popup-layer`, `popup-close`).

## Debugging

`window.__world` is exposed in the console:

```js
__world.boat.position.set(0, 0, 122) // teleport next to the cat island
__world.snapCamera()                 // snap the chase camera behind the boat
__world.getMode()                    // 'intro' | 'transition' | 'play'
__world.controls.read()              // current { throttle, steer }
__world.islands / __world.camera / __world.scene / __world.renderer
```

Nothing in the app uses it — it's safe to break.
