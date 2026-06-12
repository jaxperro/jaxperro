// Unifies keyboard (WASD / arrows) and the nipplejs joystick into a single
// { throttle, steer } input, each in [-1, 1].

const KEY_MAP = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

const clamp = (v) => Math.max(-1, Math.min(1, v));

export function createControls(joystickZone, { onFirstInput } = {}) {
  const held = new Set();
  const joy = { x: 0, y: 0 };
  let firstInputSeen = false;

  function noteInput() {
    if (!firstInputSeen) {
      firstInputSeen = true;
      if (onFirstInput) onFirstInput();
    }
  }

  window.addEventListener('keydown', (event) => {
    const action = KEY_MAP[event.code];
    if (!action || event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    held.add(action);
    noteInput();
  });
  window.addEventListener('keyup', (event) => {
    const action = KEY_MAP[event.code];
    if (action) held.delete(action);
  });
  window.addEventListener('blur', () => held.clear());

  // nipplejs is loaded as a UMD global from the CDN. Dynamic mode spawns the
  // joystick wherever the user touches or clicks inside the full-screen zone
  // and removes it on release; it works for both touch and mouse drags.
  if (window.nipplejs && joystickZone) {
    const manager = window.nipplejs.create({
      zone: joystickZone,
      mode: 'dynamic',
      size: 110,
      color: 'white',
    });
    manager.on('move', (_, data) => {
      joy.x = data.vector.x;
      joy.y = data.vector.y;
      noteInput();
    });
    manager.on('end', () => {
      joy.x = 0;
      joy.y = 0;
    });
  }

  function read() {
    let throttle = joy.y;
    let steer = joy.x;
    if (held.has('forward')) throttle += 1;
    if (held.has('back')) throttle -= 1;
    if (held.has('right')) steer += 1;
    if (held.has('left')) steer -= 1;
    return { throttle: clamp(throttle), steer: clamp(steer) };
  }

  return { read };
}
