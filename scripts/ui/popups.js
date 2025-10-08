import { POPUP_CONTENT, POPUP_LAYER_ID } from "../config.js";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function createPopupManager() {
  const layer = document.getElementById(POPUP_LAYER_ID);
  const card = layer?.querySelector(".popup-card");
  const title = card?.querySelector("h4");
  const body = card?.querySelector("p");

  function show(index) {
    if (!layer || !card || !title || !body) return;
    const data = POPUP_CONTENT[index];
    if (!data) return;

    title.textContent = data.title;
    body.textContent = data.body;
    layer.dataset.visible = "true";
    card.dataset.visible = "true";
    card.style.setProperty("--scale", "0.8");
    card.style.setProperty("--alpha", "0");
    requestAnimationFrame(() => setProgress(0));
  }

  function hide() {
    if (!layer || !card) return;
    card.dataset.visible = "false";
    layer.dataset.visible = "false";
    card.style.setProperty("--scale", "0.8");
    card.style.setProperty("--alpha", "0");
  }

  function setProgress(value) {
    if (!card) return;
    const normalized = clamp(value, 0, 1);
    const scale = 1 - normalized * 0.55;
    const alpha = 1 - normalized * 0.45;
    card.style.setProperty("--scale", scale.toFixed(3));
    card.style.setProperty("--alpha", alpha.toFixed(3));
  }

  return {
    show,
    hide,
    setProgress
  };
}
