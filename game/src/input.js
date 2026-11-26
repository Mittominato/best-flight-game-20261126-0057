// Keyboard and mouse input. Held keys steer and set the throttle; one-shot
// presses (start, pause, camera, restart, mute) are queued as bit flags and
// taken once by the loop, so a press between two frames is never lost and
// never counted twice. The mouse steers like a stick when it moves and the
// wheel trims the throttle; a click in flight swaps the camera.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CAMERA = 4;
export const ACTION_RESTART = 8;
export const ACTION_MUTE = 16;

const PITCH_UP = new Set(['ArrowUp']);
const PITCH_DOWN = new Set(['ArrowDown']);
const ROLL_LEFT = new Set(['ArrowLeft']);
const ROLL_RIGHT = new Set(['ArrowRight']);
const THROTTLE_UP = new Set(['KeyW', 'ShiftLeft', 'ShiftRight']);
const THROTTLE_DOWN = new Set(['KeyS', 'ControlLeft', 'ControlRight']);
const BRAKE = new Set(['Space']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const CAMERA = new Set(['KeyC']);
const RESTART = new Set(['KeyR']);
const MUTE = new Set(['KeyM']);

/** Mouse steering fades out this long after the pointer stops moving. */
const MOUSE_IDLE_MS = 2000;

export function createInput(target) {
  const keys = new Set();
  let actions = 0;
  let wheel = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseMovedAt = 0;
  let mouseActive = false;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) {
      if (PITCH_UP.has(event.code) || PITCH_DOWN.has(event.code)
        || ROLL_LEFT.has(event.code) || ROLL_RIGHT.has(event.code)
        || THROTTLE_UP.has(event.code) || THROTTLE_DOWN.has(event.code)
        || BRAKE.has(event.code)) event.preventDefault();
      return;
    }
    keys.add(event.code);
    if (CONFIRM.has(event.code) || BRAKE.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (CAMERA.has(event.code)) actions |= ACTION_CAMERA;
    else if (RESTART.has(event.code)) actions |= ACTION_RESTART;
    else if (MUTE.has(event.code)) actions |= ACTION_MUTE;
    if (PITCH_UP.has(event.code) || PITCH_DOWN.has(event.code)
      || ROLL_LEFT.has(event.code) || ROLL_RIGHT.has(event.code)
      || THROTTLE_UP.has(event.code) || THROTTLE_DOWN.has(event.code)
      || BRAKE.has(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => keys.clear());

  target.addEventListener('pointermove', (event) => {
    const rect = target.getBoundingClientRect();
    mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    mouseMovedAt = performance.now();
    mouseActive = true;
  });
  target.addEventListener('pointerdown', () => {
    actions |= ACTION_CONFIRM;
  });
  target.addEventListener('wheel', (event) => {
    wheel += event.deltaY < 0 ? 0.12 : -0.12;
    event.preventDefault();
  }, { passive: false });

  function hasAny(codes) {
    for (const code of codes) if (keys.has(code)) return true;
    return false;
  }

  return {
    /** Stick deflection in [-1, 1]: keys first, else the mouse position. */
    stick() {
      let pitch = 0;
      let roll = 0;
      if (hasAny(PITCH_UP)) pitch += 1;
      if (hasAny(PITCH_DOWN)) pitch -= 1;
      if (hasAny(ROLL_LEFT)) roll -= 1;
      if (hasAny(ROLL_RIGHT)) roll += 1;
      if (pitch === 0 && roll === 0 && mouseActive
        && performance.now() - mouseMovedAt < MOUSE_IDLE_MS) {
        // Mouse up is nose up: the pointer is a stick, not a cursor.
        pitch = Math.max(-1, Math.min(1, -mouseY));
        roll = Math.max(-1, Math.min(1, mouseX));
      }
      return { pitch, roll };
    },
    /** -1, 0 or 1 from the held throttle keys. */
    throttleKeys() {
      return (hasAny(THROTTLE_UP) ? 1 : 0) - (hasAny(THROTTLE_DOWN) ? 1 : 0);
    },
    /** Wheel throttle since the last call, in throttle units. */
    takeWheel() {
      const taken = wheel;
      wheel = 0;
      return taken;
    },
    brakeHeld() {
      return hasAny(BRAKE);
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
