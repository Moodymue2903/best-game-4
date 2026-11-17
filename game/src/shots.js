// THUNDERHEAD RUN — screenshot staging and headless runs. The dossier's
// screenshots are real renders of the game's own code: these helpers put a
// run into a chosen moment (cover / mid-play / title / victory) without
// editing any pixels, and the autopilot fast-forward plays a whole run in
// the simulation alone, with no rendering at all.
//
// This file is an automated runner / capture hook only. It drives the sim's
// own createRun / step / autoInput and returns the finished state object
// for the renderer; it never edits the simulation module, never writes a
// rule or a tuning number, and no staged coordinate ever feeds back into a
// run. The cover hand-places a few entities in the returned state (a gate,
// a crow, a whale, a zap arc) the same way a photographer poses a scene —
// the sim itself is untouched.

import { createRun, startRun, step, chooseRelic, autoInput } from './sim.js';
import { THUNDERHEAD_ZONES } from './config.js';

/** Play a whole run in the sim only. Returns the finished state. */
export function runToEnd(seed, opts = {}) {
  const state = createRun(seed, opts);
  startRun(state);
  let guard = 0;
  while (state.screen !== 'win' && state.screen !== 'lose' && guard < 60 * 400) {
    guard += 1;
    if (state.screen === 'relic') { chooseRelic(state, 0); continue; }
    step(state, autoInput(state));
  }
  if (state.screen === 'win') {
    // Victory staging only: the renderer only draws the Titan while the
    // screen is 'boss', so flip to the boss frame with the defeated Titan
    // (all 3 weak points dead, sweep idle) for the victory screenshot.
    // state.won remembers the real outcome for the end overlay. The sim
    // has already ended — no further steps are taken.
    state.won = true;
    state.screen = 'boss';
    if (state.boss) {
      state.boss.sweepState = 'idle';
      for (const w of state.boss.weak) { w.dead = true; w.hp = 0; }
    }
  }
  return state;
}

/** Fast-forward an autopilot run to `seconds` of play (or its end). */
export function fastForward(seed, seconds, opts = {}) {
  const state = createRun(seed, opts);
  startRun(state);
  let guard = 0;
  while (state.time < seconds && state.screen !== 'win' && state.screen !== 'lose' && guard < 60 * 400) {
    guard += 1;
    if (state.screen === 'relic') { chooseRelic(state, 0); continue; }
    step(state, autoInput(state));
  }
  return state;
}

/** The cover: mid-canyon, board banked hard left, gold gate just ahead, a
// magenta storm-crow diving from the right, a sky-whale behind it, HUD lit.
// The cover carries the wordmark (state.coverWordmark) and shows two
// mechanics in one frame: a gate being passed and a crow being zapped
// (live lightning arc mid-frame), with the whale in the background. */
export function stageCover() {
  const state = createRun(1);
  startRun(state);
  state.zoneIdx = 2;
  state.zoneTime = 12;
  state.time = 62;
  state.score = 2450;
  state.gates = 9;
  state.kills = 4;
  state.charge = 78;
  state.x = -1.5;
  state.vx = -7;
  state.coverWordmark = true;
  state.lastZap = { x: 3.5, y: 2.4, z: -10, t: 0.25 };
  state.entities = [
    { kind: 'gate', x: -1, y: 0, z: -14, hp: 1, mult: 1 },
    { kind: 'gate', x: 2.5, y: 0, z: -55, hp: 1, mult: 1 },
    { kind: 'crow', x: 3.5, y: 2.4, z: -10, hp: 1, shielded: false },
    { kind: 'shielded', x: -3.4, y: 3.1, z: -32, hp: 2, shielded: true },
    { kind: 'whale', x: -3.2, y: 3.4, z: -18, hp: 99, vx: 0.8 },
    { kind: 'orb', x: 0.6, y: 1.2, z: -30, hp: 1 },
    { kind: 'orb', x: -2.2, y: 3.2, z: -38, hp: 1 },
  ];
  state.lastEvent = 'THE SQUALL — counter-steer the gusts!';
  return state;
}

/** The boss frame: mid-fight in The Eye (zone 6). The autopilot plays to
// the moment the Titan's timer drops below 70 — about 20s into the fight,
// one weak point already shattered, two still glowing. A live zap arc is
// staged on the nearest live weak point, a storm-crow is staged mid-dive
// nearby, and the lightning-sweep telegraph is staged visible if the sim
// left it idle. The HUD shows the boss timer and the earned relics. */
export function stageBoss() {
  const state = createRun(1);
  startRun(state);
  let guard = 0;
  while (!(state.screen === 'boss' && state.boss && state.boss.timer < 70) && state.screen !== 'win' && state.screen !== 'lose' && guard < 60 * 400) {
    guard += 1;
    if (state.screen === 'relic') { chooseRelic(state, 0); continue; }
    step(state, autoInput(state));
  }
  if (state.screen === 'boss' && state.boss) {
    const live = state.boss.weak.find((w) => !w.dead);
    if (live) {
      state.lastZap = { x: Math.cos(live.angle) * 5.5, y: 3.5 + Math.sin(live.angle) * 2.2, z: -24, t: 0.25 };
    }
    if (state.boss.sweepState === 'idle') {
      state.boss.sweepState = 'warn';
      state.boss.sweepX = state.x;
    }
    state.entities = [
      { kind: 'crow', x: 4.2, y: 2.6, z: -16, hp: 1, shielded: false },
    ];
  }
  return state;
}

/** The title screen: a fresh run, canyon behind the title. */
export function stageTitle() {
  const state = createRun(1);
  state.entities = [
    { kind: 'gate', x: 0, y: 0, z: -18, hp: 1, mult: 1 },
    { kind: 'crow', x: 4, y: 2.5, z: -30, hp: 1, shielded: false },
    { kind: 'whale', x: -5, y: 3, z: -55, hp: 99, vx: 0.8 },
  ];
  return state;
}

export { THUNDERHEAD_ZONES };
