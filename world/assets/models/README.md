# World 3D models

Drop `.glb` (or `.gltf`) files here to replace the built-in procedural boat and
island shapes. No build step — models load at runtime via `GLTFLoader`.

## Swapping a model

1. Put your file in this folder, e.g. `world/assets/models/boat.glb`.
2. Point the matching config entry in [`world/js/config.js`](../../js/config.js)
   at it. The path is relative to the world page, so it starts with
   `assets/models/`.

**Boat** — set `BOAT.model`:

```js
export const BOAT = {
  // ...
  model: { url: 'assets/models/boat.glb', scale: 1, yOffset: 0, rotationY: 0 },
};
```

**Island** — set `model` on any entry in `ISLANDS`:

```js
{
  id: 'cat',
  // ...
  model: { url: 'assets/models/lighthouse.glb', scale: 2, yOffset: -1, rotationY: 0 },
}
```

`null` (the default) keeps the procedural shape.

## Options

| Field       | Meaning                                                        |
| ----------- | ------------------------------------------------------------- |
| `url`       | Path to the model, relative to the world page.                |
| `scale`     | Uniform scale multiplier (default `1`).                       |
| `yOffset`   | Vertical shift of the model root, in world units (default `0`). |
| `rotationY` | Yaw in **radians** to align the model's facing (default `0`). |

## Notes

- **Boat facing:** the boat drives along **+Z** (bow forward). If your model
  faces a different way, correct it with `rotationY` (e.g. `Math.PI` for a
  180° flip).
- **Islands are visual-only swaps:** the square collider and the tap/proximity
  interaction still come from the island's `size` in config, not the model —
  so size the `model` to roughly match `size` for collisions to feel right.
- If a model fails to load, the world logs a warning and falls back to the
  procedural shape, so a bad path won't break the scene.
- Keep files small (a few MB) — they download on page load over the CDN-less
  GitHub Pages host.
