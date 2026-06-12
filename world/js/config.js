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
export const ISLANDS = [
  {
    id: 'cat',
    position: [0, 110],
    footprint: 'square',
    size: 18,
    height: 10,
    color: 0xd9c08a,
    // Boat distance at which the island starts pulsing and accepts taps.
    interactionRadius: 38,
    action: { type: 'catPopup' },
  },
];

export const DOM_IDS = {
  canvas: 'scene',
  joystickZone: 'joystick-zone',
  hint: 'hint',
  popupLayer: 'popup-layer',
  popupClose: 'popup-close',
};
