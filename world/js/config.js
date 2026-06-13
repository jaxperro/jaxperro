// Central constants for the world scene. Tweak values here rather than in feature code.

export const SCENE = {
  // Sun position drives the Sky shader, the directional light, and the ocean glint.
  sunElevationDeg: 18,
  sunAzimuthDeg: 135,
  fogColor: 0xbfdcec,
  fogNear: 90,
  fogFar: 620,
  toneMappingExposure: 0.68,
  cameraFov: 55,
  // On narrow (portrait) screens the vertical FOV is widened so the view
  // never gets narrower than this many degrees horizontally.
  minHorizontalFov: 70,
};

export const OCEAN = {
  size: 1500,
  segments: 256,
  deepColor: 0x0d5c79,
  shallowColor: 0x9fd3e8,
  // Broad swells displaced in the vertex shader. Mirrored in JS for boat buoyancy,
  // so keep getWaterHeight() and the generated GLSL in sync via this single list.
  waves: [
    { amplitude: 0.42, wavelength: 62, direction: [1.0, 0.35] },
    { amplitude: 0.2, wavelength: 30, direction: [-0.6, 1.0] },
    { amplitude: 0.09, wavelength: 16, direction: [0.35, -0.8] },
  ],
};

export const BOAT = {
  maxForwardSpeed: 13,
  maxReverseSpeed: 4.5,
  acceleration: 7,
  drag: 0.55,
  turnRate: 1.4,
  // How far above the sampled water height the hull rests.
  floatOffset: 0.18,
  // Distance between buoyancy sample points (fore/aft and port/starboard).
  pitchSampleDist: 2.4,
  rollSampleDist: 1.1,
  // Optional 3D model that replaces the built-in procedural boat. Drop a .glb
  // in world/assets/models/ and set { url, scale, yOffset, rotationY }; null
  // keeps the procedural boat. The model's bow should face +Z (set rotationY
  // to correct it). See world/assets/models/README.md.
  model: null,
};

export const CAMERA_FOLLOW = {
  distance: 11,
  height: 4.6,
  lookAhead: 6,
  lookHeight: 1.4,
  positionDamping: 3.5,
  targetDamping: 4.5,
  // On portrait screens the camera pitches up so the boat sits in the lower
  // third of the frame instead of dead center. Fraction of NDC half-height;
  // fades out as the aspect ratio approaches landscape.
  portraitScreenShift: 0.3,
};

// Landing shot before a mode is chosen: camera ahead of the bow, low to the
// water, looking back at the boat. "Explore" sweeps from here around the
// boat's side into the chase position; arcHeight is an extra mid-sweep rise.
export const CAMERA_INTRO = {
  distance: 12,
  height: 2.6,
  lookHeight: 1.1,
  transitionDuration: 2.6,
  arcHeight: 2.5,
};

// Portfolio islands. Adding a project = adding an entry here (and a new
// action type in main.js if it does something novel). Positions are world
// coordinates; the boat spawns at the origin facing +z. Footprint squares
// are axis-aligned.
//
// Optional `model` field swaps the procedural box for a 3D model (visual only
// — the square collider and interaction still come from `size`): same shape
// as the boat's, { url, scale, yOffset, rotationY }. See the models README.
//
// `active: false` removes an island entirely — not rendered, no collider, no
// interaction. Flip it to true when its project is ready (omitting the field
// counts as active).
// Twelve islands ring the spawn in a full circle, one every 30° at radius
// ~120 (x = r·sin θ, z = r·cos θ, θ from +z). The front three — green, tan,
// purple — form the arc you see on load, with the tan cat island pushed
// deeper (radius 140) so it reads as the far point of the arc.
export const ISLANDS = [
  {
    id: 'cat', // 0°, dead ahead and furthest out
    active: true,
    position: [0, 140],
    footprint: 'square',
    size: 18,
    height: 10,
    color: 0xd9c08a,
    // Boat distance at which the island starts pulsing and accepts taps.
    interactionRadius: 76,
    action: { type: 'catPopup' },
    model: null,
  },
  {
    id: 'project-2', // -30°
    active: true,
    position: [-60, 104],
    footprint: 'square',
    size: 16,
    height: 8,
    color: 0x5fb364,
    interactionRadius: 76,
    action: { type: 'emptyPopup' },
    model: null,
  },
  {
    id: 'project-3', // +30°
    active: true,
    position: [60, 104],
    footprint: 'square',
    size: 20,
    height: 12,
    color: 0x9b6fd0,
    interactionRadius: 80,
    action: { type: 'emptyPopup' },
    model: null,
  },
  {
    id: 'project-4', // -60°
    active: false,
    position: [-104, 60],
    footprint: 'square',
    size: 16,
    height: 9,
    color: 0xd95f5f,
    interactionRadius: 76,
    action: { type: 'emptyPopup' },
    model: null,
  },
  {
    id: 'project-5', // +60°
    active: false,
    position: [104, 60],
    footprint: 'square',
    size: 18,
    height: 8,
    color: 0xe09a4b,
    interactionRadius: 76,
    action: { type: 'emptyPopup' },
    model: null,
  },
  {
    id: 'project-6', // -90°
    active: false,
    position: [-120, 0],
    footprint: 'square',
    size: 16,
    height: 11,
    color: 0xe3d36b,
    interactionRadius: 76,
    action: { type: 'emptyPopup' },
    model: null,
  },
  {
    id: 'project-7', // +90°
    active: false,
    position: [120, 0],
    footprint: 'square',
    size: 20,
    height: 9,
    color: 0x4fb8a8,
    interactionRadius: 80,
    action: { type: 'emptyPopup' },
    model: null,
  },
  {
    id: 'project-8', // -120°
    active: false,
    position: [-104, -60],
    footprint: 'square',
    size: 18,
    height: 10,
    color: 0x5a8fd6,
    interactionRadius: 76,
    action: { type: 'emptyPopup' },
    model: null,
  },
  {
    id: 'project-9', // +120°
    active: false,
    position: [104, -60],
    footprint: 'square',
    size: 16,
    height: 8,
    color: 0xd98ab5,
    interactionRadius: 76,
    action: { type: 'emptyPopup' },
    model: null,
  },
  {
    id: 'project-10', // -150°
    active: false,
    position: [-60, -104],
    footprint: 'square',
    size: 20,
    height: 12,
    color: 0x8a93a6,
    interactionRadius: 80,
    action: { type: 'emptyPopup' },
    model: null,
  },
  {
    id: 'project-11', // +150°
    active: false,
    position: [60, -104],
    footprint: 'square',
    size: 16,
    height: 9,
    color: 0xe8e4da,
    interactionRadius: 76,
    action: { type: 'emptyPopup' },
    model: null,
  },
  {
    id: 'project-12', // 180°, directly behind spawn
    active: false,
    position: [0, -120],
    footprint: 'square',
    size: 18,
    height: 10,
    color: 0xa9805b,
    interactionRadius: 76,
    action: { type: 'emptyPopup' },
    model: null,
  },
];

export const DOM_IDS = {
  canvas: 'scene',
  joystickZone: 'joystick-zone',
  hint: 'hint',
  popupLayer: 'popup-layer',
  popupClose: 'popup-close',
};
