// THUNDERHEAD RUN — screenshot staging and headless runs. The dossier's
// screenshots are real renders of the game's own code: these helpers put a
// run into a chosen moment (cover / mid-play / title / victory) without
// editing any pixels, and the autopilot fast-forward plays a whole run in
// the simulation alone, with no rendering at all.

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
// magenta storm-crow diving from the right, a sky-whale behind it, HUD lit. */
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
  state.entities = [
    { kind: 'gate', x: -1, y: 0, z: -14, hp: 1, mult: 1 },
    { kind: 'gate', x: 2.5, y: 0, z: -55, hp: 1, mult: 1 },
    { kind: 'crow', x: 3.5, y: 2.4, z: -18, hp: 1, shielded: false },
    { kind: 'shielded', x: -3.4, y: 3.1, z: -32, hp: 2, shielded: true },
    { kind: 'whale', x: -5, y: 3.4, z: -38, hp: 99, vx: 0.8 },
    { kind: 'orb', x: 0.6, y: 1.2, z: -30, hp: 1 },
    { kind: 'orb', x: -2.2, y: 3.2, z: -38, hp: 1 },
  ];
  state.lastEvent = 'THE SQUALL — counter-steer the gusts!';
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
