export const HELIX_CONFIG = {
  puckRadius: 1.2,
  puckHeight: 0.75,
  gap: 0.95,
  count: 50,
  helixRadius: 5,
  helixTurns: 2
};

export const CAMERA_PATH = { 
  radius: 8,
  yStart: -2,
  yEnd: 2,
  tilt: 0.12
};

export const POPUP_CONTENT = [
  { title: "Square One", body: "Checkpoint at the first third of the spiral." },
  { title: "Square Two", body: "Halfway through the corkscrew journey." },
  { title: "Square Three", body: "Final pause before the finish." }
];

export const SCROLL_CONFIG = {
  spinTurns: 1.5,
  popupRevealMs: 100,
  scrollKeys: [
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "PageUp",
    "PageDown",
    "Home",
    "End",
    " ",
    "Space",
    "Spacebar"
  ]
};

export const CANVAS_ID = "c";
export const POPUP_LAYER_ID = "popup-layer";
