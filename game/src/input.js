// THUNDERHEAD RUN — keyboard + mouse. Reads the physical inputs and turns
// them into one input frame per fixed step. Edges (jump / boost / zap) fire
// once per press; steering is held. Mouse position aims the zap and pitches
// the camera a little; no pointer lock, so headless playtests just work.

const keys = {};
let mouseX = 0.5;
let mouseY = 0.4;
let zapQueued = false;
let jumpQueued = false;
let boostQueued = false;
let relicQueued = -1;

export function bindInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys[e.code] = true;
    if (e.code === 'Space') { jumpQueued = true; e.preventDefault(); }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') boostQueued = true;
    if (e.code === 'Digit1') relicQueued = 0;
    if (e.code === 'Digit2') relicQueued = 1;
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouseX = (e.clientX - r.left) / r.width;
    mouseY = (e.clientY - r.top) / r.height;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) zapQueued = true;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

/** One frame of input. aimX/aimY are world coordinates the zap aims at. */
export function readInput() {
  const steer = (keys.KeyA || keys.ArrowLeft ? -1 : 0) + (keys.KeyD || keys.ArrowRight ? 1 : 0);
  const out = {
    steer,
    jump: jumpQueued,
    boost: boostQueued,
    zap: zapQueued,
    aimX: (mouseX * 2 - 1) * 7,
    aimY: (1 - mouseY) * 6.5,
    camPitch: (0.4 - mouseY) * 1.6,
  };
  jumpQueued = false;
  boostQueued = false;
  zapQueued = false;
  return out;
}

/** A relic key (1/2) pressed since the last read, or -1. */
export function readRelicPick() {
  const r = relicQueued;
  relicQueued = -1;
  return r;
}

/** Camera pitch from the mouse height (no input consumed). */
export function getCamPitch() {
  return (0.4 - mouseY) * 1.6;
}

export function keyPressed(code) {
  return !!keys[code];
}
