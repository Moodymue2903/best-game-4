// THUNDERHEAD RUN — the simulation. Pure logic, no THREE, no DOM: the same
// file runs in the browser and in Node, so the autopilot's numbers are the
// game's numbers. Fixed 60 Hz steps; every random choice comes from the
// seeded generator, so one seed always plays the same run.
//
// The board never stops: the player steers on the (x, y) plane while the
// canyon scrolls toward them. Entities spawn ahead (z negative) and travel
// to the player plane (z = 0). The boss zone parks the scroll and turns the
// fight into an orbit-and-zap duel with the Storm Titan.

import { STEP, CANYON_HALF, THUNDERHEAD_RULES, THUNDERHEAD_ZONES, THUNDERHEAD_ENEMIES, THUNDERHEAD_RELICS, THUNDERHEAD_TITAN_SLAYER_AFTER_ZONE } from './config.js';
import { makeRng, range, shuffle } from './random.js';

const R = THUNDERHEAD_RULES;

/** Start a fresh run. opts: { seed, lazy } — lazy plays badly on purpose. */
export function createRun(seed, opts = {}) {
  const rng = makeRng(seed);
  return {
    seed,
    lazy: !!opts.lazy,
    rng,
    screen: 'title', // title | play | relic | boss | win | lose
    time: 0,
    dist: 0,
    zoneIdx: 0,
    zoneTime: 0,
    x: 0, y: 0, vy: 0, vx: 0,
    jumpsUsed: 0,
    speed: THUNDERHEAD_ZONES[0].speed,
    charge: R.startCharge,
    score: 0,
    gates: 0, gateChain: 0, zaps: 0, kills: 0, hits: 0, falls: 0,
    orbs: 0, forkPick: null, forkBonus: 0,
    zapCooldown: 0, boostCooldown: 0, boostTime: 0, invuln: 0,
    gust: 0, gustTimer: 0,
    relics: [], relicFlags: {},
    draft: null, draftZone: -1,
    entities: [], // {kind,x,y,z,hp,vx,vy,mult,shielded}
    nextGateAt: 18, nextCrowAt: 55, nextWhaleAt: 9999, nextOrbAt: 30, nextGapAt: 9999,
    forkAt: 0, forkDecided: false,
    boss: null, // {weak:[{angle,hp,dead}], timer, sweepEvery, sweepX, sweepT, sweepState, orbAt}
    lastZap: null, // {x,y,z,t} for the renderer's lightning arc
    lastEvent: '',
    loseReason: '',
    stats: null,
  };
}

/** Begin play from the title screen. */
export function startRun(state) {
  state.screen = 'play';
  state.time = 0;
  state.zoneIdx = 0;
  state.zoneTime = 0;
  state.forkAt = 40;
  state.forkDecided = false;
  state.nextGapAt = 60;
}

function zone(state) {
  return THUNDERHEAD_ZONES[state.zoneIdx];
}

function hasRelic(state, id) {
  return state.relicFlags[id] === true;
}

function spawnGate(state, x, y, mult) {
  state.entities.push({ kind: 'gate', x, y, z: -75, hp: 1, mult: mult || 1 });
}

function spawnCrow(state, shielded) {
  const kind = shielded ? 'shielded' : 'crow';
  const hp = shielded ? THUNDERHEAD_ENEMIES.shieldedCrow.hp : THUNDERHEAD_ENEMIES.crow.hp;
  state.entities.push({ kind, x: range(state.rng, -5.5, 5.5), y: range(state.rng, 0, 4), z: -75, hp, shielded });
}

function spawnBrute(state, x) {
  state.entities.push({ kind: 'brute', x, y: 1.5, z: -75, hp: THUNDERHEAD_ENEMIES.brute.hp });
}

function spawnWhale(state) {
  const dir = state.rng() < 0.5 ? 1 : -1;
  const speed = THUNDERHEAD_ENEMIES.whale.drift * (hasRelic(state, 'whisperer') ? 0.7 : 1);
  state.entities.push({ kind: 'whale', x: dir * 7, y: range(state.rng, 0.5, 3.5), z: -80, hp: 99, vx: -dir * speed });
}

function spawnOrb(state, x, y) {
  state.entities.push({ kind: 'orb', x: x !== undefined ? x : range(state.rng, -5, 5), y: y !== undefined ? y : range(state.rng, 0.5, 4), z: -75, hp: 1 });
}

function applyFall(state, reason) {
  if (hasRelic(state, 'stormshield') && !state.relicFlags.stormshieldUsed) {
    state.relicFlags.stormshieldUsed = true;
    state.lastEvent = 'STORM SHIELD saved you!';
    return;
  }
  state.falls += 1;
  state.charge -= R.hitCharge;
  state.invuln = 2.5;
  state.lastEvent = reason;
  if (state.falls >= R.maxFalls) endRun(state, 'lose', '3 falls — thrown off the board');
}

function endRun(state, screen, reason) {
  state.screen = screen;
  state.loseReason = reason || '';
  if (screen === 'win') {
    state.score += R.winBonus + Math.round((state.boss ? state.boss.timer : 0) * 10);
  }
  state.stats = {
    score: state.score, gates: state.gates, zaps: state.zaps, kills: state.kills,
    hits: state.hits, falls: state.falls, orbs: state.orbs,
    time: Math.round(state.time * 10) / 10, zones: state.zoneIdx + 1,
    relics: state.relics.map((r) => r.id), forkPick: state.forkPick,
  };
}

function enterBoss(state) {
  state.screen = 'boss';
  state.entities = [];
  const weakHp = hasRelic(state, 'titanslayer') ? 2 : THUNDERHEAD_ENEMIES.titan.weakHp;
  state.boss = {
    weak: [0, 1, 2].map((i) => ({ angle: (i * Math.PI * 2) / 3, hp: weakHp, dead: false })),
    timer: R.bossTime,
    sweepEvery: THUNDERHEAD_ENEMIES.titan.sweepEvery,
    sweepTimer: 2.5, sweepX: 0, sweepT: 0, sweepState: 'idle',
    orbAt: 4,
  };
  state.lastEvent = 'THE STORM TITAN — zap all 3 weak points!';
}

function offerDraft(state) {
  const owned = new Set(state.relics.map((r) => r.id));
  let pool = THUNDERHEAD_RELICS.filter((r) => !owned.has(r.id));
  if (state.zoneIdx < THUNDERHEAD_TITAN_SLAYER_AFTER_ZONE) {
    pool = pool.filter((r) => r.id !== 'titanslayer');
  }
  shuffle(state.rng, pool);
  state.draft = pool.slice(0, 2);
  state.draftZone = state.zoneIdx;
  state.screen = 'relic';
}

/** Pick draft[i] (0 or 1) and resume play. */
export function chooseRelic(state, i) {
  if (state.screen !== 'relic' || !state.draft) return;
  const relic = state.draft[i] || state.draft[0];
  state.relics.push(relic);
  state.relicFlags[relic.id] = true;
  state.draft = null;
  if (state.zoneIdx >= THUNDERHEAD_ZONES.length - 1) {
    enterBoss(state);
  } else {
    state.zoneIdx += 1;
    state.zoneTime = 0;
    state.screen = 'play';
    state.forkAt = state.dist + 40;
    state.forkDecided = false;
    if (zone(state).platforms) state.nextGapAt = state.dist + 30;
    state.nextCrowAt = state.dist + 30;
    state.nextWhaleAt = zone(state).whaleGap ? state.dist + zone(state).whaleGap : 9999;
  }
}

/** Fire the zap. Returns the thing hit, or null. */
function doZap(state, aimX, aimY) {
  if (state.zapCooldown > 0) return null;
  const rangeZ = hasRelic(state, 'longarc') ? 45 : 30;
  state.zapCooldown = hasRelic(state, 'quickzap') ? 1.8 : 3;
  state.zaps += 1;
  let best = null;
  let bestD = 1e9;
  if (state.screen === 'boss' && state.boss) {
    for (const w of state.boss.weak) {
      if (w.dead) continue;
      const wx = Math.cos(w.angle) * 5.5;
      const wy = 3.5 + Math.sin(w.angle) * 2.2;
      const d = Math.hypot(wx - aimX, wy - aimY);
      if (d < bestD) { bestD = d; best = { kind: 'weak', weak: w, x: wx, y: wy, z: -24 }; }
    }
    if (best && bestD < 2.4) {
      state.lastZap = { x: best.x, y: best.y, z: -24, t: 0.25 };
      best.weak.hp -= 1;
      if (best.weak.hp <= 0) {
        best.weak.dead = true;
        state.score += R.weakPointScore;
        state.lastEvent = 'WEAK POINT SHATTERED!';
        if (state.boss.weak.every((w) => w.dead)) endRun(state, 'win', '');
      }
      return best;
    }
    state.lastZap = { x: aimX, y: aimY, z: -24, t: 0.25 };
    return null;
  }
  for (const e of state.entities) {
    if ((e.kind === 'crow' || e.kind === 'shielded' || e.kind === 'brute') && e.z < -1 && e.z > -rangeZ) {
      const d = Math.hypot(e.x - aimX, e.y - aimY) + Math.abs(e.z) * 0.02;
      if (d < bestD) { bestD = d; best = e; }
    }
  }
  if (best && bestD < 3.2) {
    state.lastZap = { x: best.x, y: best.y, z: best.z, t: 0.25 };
    best.hp -= 1;
    if (best.hp <= 0) {
      best.dead = true;
      state.kills += 1;
      state.score += best.kind === 'brute' ? THUNDERHEAD_ENEMIES.brute.score : best.kind === 'shielded' ? THUNDERHEAD_ENEMIES.shieldedCrow.score : THUNDERHEAD_ENEMIES.crow.score;
    }
    return best;
  }
  state.lastZap = { x: aimX, y: aimY, z: -12, t: 0.25 };
  return null;
}

/** One fixed step. input: {steer:-1..1, jump, boost, zap, aimX, aimY}. */
export function step(state, input) {
  if (state.screen === 'title' || state.screen === 'win' || state.screen === 'lose' || state.screen === 'relic') return;
  const dt = STEP;
  state.time += dt;
  const z = zone(state);

  // Cooldowns and timers.
  if (state.zapCooldown > 0) state.zapCooldown -= dt;
  if (state.boostCooldown > 0) state.boostCooldown -= dt;
  if (state.invuln > 0) state.invuln -= dt;
  if (state.lastZap) { state.lastZap.t -= dt; if (state.lastZap.t <= 0) state.lastZap = null; }

  // Wind gusts push the board sideways; the player counter-steers.
  if (z.gust > 0) {
    state.gustTimer -= dt;
    if (state.gustTimer <= 0) {
      state.gustTimer = 2;
      state.gust = range(state.rng, -1, 1) * z.gust * (hasRelic(state, 'gustguard') ? 0.5 : 1);
    }
  } else {
    state.gust = 0;
  }

  // Steering: accelerate toward the target lateral speed, then clamp.
  const steerSpeed = 10;
  const targetVx = (input.steer || 0) * steerSpeed + state.gust;
  const accel = 42;
  if (state.vx < targetVx) state.vx = Math.min(targetVx, state.vx + accel * dt);
  else state.vx = Math.max(targetVx, state.vx - accel * dt);
  state.x += state.vx * dt;
  if (state.x < -CANYON_HALF) { state.x = -CANYON_HALF; state.vx = Math.max(0, state.vx); }
  if (state.x > CANYON_HALF) { state.x = CANYON_HALF; state.vx = Math.min(0, state.vx); }

  // Jump physics (double jump is a relic).
  const maxJumps = hasRelic(state, 'doublejump') ? 2 : 1;
  if (input.jump && state.jumpsUsed < maxJumps) {
    state.vy = 9.5;
    state.jumpsUsed += 1;
  }
  if (state.y > 0 || state.vy > 0) {
    state.vy -= 22 * dt;
    state.y += state.vy * dt;
    if (state.y <= 0) { state.y = 0; state.vy = 0; state.jumpsUsed = 0; }
  }

  // Boost: costs charge, short speed surge.
  if (input.boost && state.boostCooldown <= 0 && state.charge > R.boostCost) {
    state.charge -= R.boostCost;
    state.boostCooldown = 2;
    state.boostTime = 1.2;
  }
  if (state.boostTime > 0) state.boostTime -= dt;

  if (input.zap) doZap(state, input.aimX || 0, input.aimY || 1.5);

  if (state.screen === 'boss') {
    stepBoss(state, input, dt);
    return;
  }

  // Forward motion and zone clock.
  const speed = z.speed * (state.boostTime > 0 ? 1.6 : 1);
  state.speed = speed;
  state.dist += speed * dt;
  state.zoneTime += dt;

  // The fork: left is tight and fast, right is wide and safe.
  if (z.fork && !state.forkDecided && state.dist >= state.forkAt) {
    state.forkDecided = true;
    state.forkPick = state.x < 0 ? 'left' : 'right';
    if (state.forkPick === 'left') {
      state.score += R.forkLeftBonus;
      state.forkBonus += R.forkLeftBonus;
      state.lastEvent = 'FORK: LEFT PATH — fast line! +200';
    } else {
      state.lastEvent = 'FORK: RIGHT PATH — safe line';
      spawnWhale(state);
    }
  }

  // Spawning, by distance travelled.
  if (state.dist >= state.nextGateAt) {
    const high = z.platforms && state.rng() < 0.45;
    const gx = range(state.rng, -5, 5);
    spawnGate(state, gx, high ? 2.6 : 0, 1);
    if (z.fork && state.forkDecided && state.forkPick === 'left') state.nextGateAt = state.dist + z.gateGap * 0.55;
    else state.nextGateAt = state.dist + z.gateGap;
    // Multiplier gate in the Gauntlet, guarded by a brute.
    if (state.zoneIdx === 4 && state.rng() < 0.5) {
      spawnBrute(state, gx);
      const g = state.entities[state.entities.length - 2];
      if (g) g.mult = 3;
    }
  }
  if (state.dist >= state.nextCrowAt) {
    spawnCrow(state, z.shielded && state.rng() < 0.4);
    state.nextCrowAt = state.dist + z.crowGap * (state.forkPick === 'left' ? 0.7 : 1);
  }
  if (z.whaleGap && state.dist >= state.nextWhaleAt) {
    spawnWhale(state);
    state.nextWhaleAt = state.dist + z.whaleGap;
  }
  if (state.dist >= state.nextOrbAt) {
    spawnOrb(state);
    state.nextOrbAt = state.dist + range(state.rng, 45, 75);
  }
  if (z.platforms && state.dist >= state.nextGapAt) {
    state.entities.push({ kind: 'gap', x: 0, y: 0, z: -75, hp: 1 });
    state.nextGapAt = state.dist + range(state.rng, 55, 80);
  }

  // Move entities toward the player and resolve crossings at z = 0.
  const spd = speed;
  for (const e of state.entities) {
    if (e.kind === 'whale') e.x += e.vx * dt;
    if (e.kind === 'crow' || e.kind === 'shielded' || e.kind === 'brute') {
      const dive = e.kind === 'brute' ? 3 : 6;
      e.z += (spd + dive) * dt;
      e.x += (state.x - e.x) * 0.25 * dt;
      e.y += (state.y + 1 - e.y) * 0.3 * dt;
    } else {
      e.z += spd * dt;
    }
    if (e.dead) continue;
    if (e.z >= 0 && !e.counted) {
      e.counted = true;
      if (e.kind === 'gate') {
        if (Math.abs(e.x - state.x) < 1.5 && Math.abs(e.y - state.y) < 1.7) {
          state.gates += 1;
          state.gateChain += 1;
          state.charge = Math.min(R.maxCharge, state.charge + (hasRelic(state, 'hoarder') ? R.gateChargeHoarder : R.gateCharge));
          state.score += R.gateScore * e.mult + (state.gateChain - 1) * 25;
          state.lastEvent = e.mult > 1 ? 'MULTIPLIER GATE x3!' : 'GATE +' + R.gateScore;
        } else {
          state.gateChain = 0;
        }
      } else if (e.kind === 'orb') {
        if (Math.abs(e.x - state.x) < 1.5 && Math.abs(e.y - state.y) < 1.6) {
          state.orbs += 1;
          state.charge = Math.min(R.maxCharge, state.charge + R.orbCharge);
          state.score += R.orbScore;
        }
      } else if (e.kind === 'crow' || e.kind === 'shielded' || e.kind === 'brute') {
        if (state.invuln <= 0 && Math.abs(e.x - state.x) < 1.3 && Math.abs(e.y - state.y) < 1.5) {
          state.hits += 1;
          state.charge -= R.hitCharge;
          state.invuln = 1.2;
          state.gateChain = 0;
          state.lastEvent = e.kind === 'brute' ? 'BRUTE SLAM -15' : 'CROW HIT -15';
          if (state.charge <= 0) { endRun(state, 'lose', 'Charge hit 0 — the board went dark'); return; }
        }
      } else if (e.kind === 'whale') {
        if (state.invuln <= 0 && Math.abs(e.x - state.x) < 2.3 && Math.abs(e.y - state.y) < 1.8) {
          applyFall(state, 'WHALE! Thrown off the board');
          if (state.screen !== 'play') return;
        }
      } else if (e.kind === 'gap') {
        if (state.y <= 0.05 && state.invuln <= 0) {
          state.charge -= R.gapCharge;
          state.invuln = 1;
          state.lastEvent = 'MISSED THE PLATFORM -10';
          if (state.charge <= 0) { endRun(state, 'lose', 'Charge hit 0 — the board went dark'); return; }
        }
      }
    }
  }
  state.entities = state.entities.filter((e) => e.z < 8 && !e.dead);

  // Zone end: draft a relic, or enter the boss.
  if (state.zoneTime >= z.dur) {
    if (state.zoneIdx >= THUNDERHEAD_ZONES.length - 2) {
      // Gauntlet done -> the Eye.
      state.zoneIdx = 5;
      state.zoneTime = 0;
      enterBoss(state);
    } else {
      offerDraft(state);
    }
  }
}

function stepBoss(state, input, dt) {
  const b = state.boss;
  b.timer -= dt;
  if (b.timer <= 0) { endRun(state, 'lose', 'The Eye collapsed — time ran out'); return; }
  // Weak points orbit the Titan.
  for (const w of b.weak) {
    if (!w.dead) w.angle += 0.45 * dt;
  }
  // Lightning sweeps: telegraphed, then struck at the warned x.
  if (b.sweepState === 'idle') {
    b.sweepTimer -= dt;
    if (b.sweepTimer <= 0) {
      b.sweepState = 'warn';
      b.sweepT = THUNDERHEAD_ENEMIES.titan.sweepWarn;
      b.sweepX = state.x + range(state.rng, -1, 1);
      b.sweepX = Math.max(-CANYON_HALF, Math.min(CANYON_HALF, b.sweepX));
    }
  } else if (b.sweepState === 'warn') {
    b.sweepT -= dt;
    if (b.sweepT <= 0) {
      b.sweepState = 'strike';
      b.sweepT = 0.3;
      if (state.invuln <= 0 && Math.abs(state.x - b.sweepX) < 1.6) {
        state.hits += 1;
        state.charge -= R.hitCharge;
        state.invuln = 1.2;
        state.lastEvent = 'LIGHTNING STRIKE -15';
        if (state.charge <= 0) { endRun(state, 'lose', 'Charge hit 0 — the board went dark'); return; }
      }
    }
  } else {
    b.sweepT -= dt;
    if (b.sweepT <= 0) {
      b.sweepState = 'idle';
      b.sweepTimer = THUNDERHEAD_ENEMIES.titan.sweepEvery;
    }
  }
  // Charge gates drift in around the Titan.
  b.orbAt -= dt;
  if (b.orbAt <= 0) {
    b.orbAt = 8;
    spawnOrb(state, range(state.rng, -5, 5), range(state.rng, 0.5, 5));
  }
  for (const e of state.entities) {
    e.z += 12 * dt;
    if (e.z >= 0 && !e.counted) {
      e.counted = true;
      if (e.kind === 'orb' && Math.abs(e.x - state.x) < 1.5 && Math.abs(e.y - state.y) < 1.6) {
        state.orbs += 1;
        state.charge = Math.min(R.maxCharge, state.charge + R.orbCharge);
        state.score += R.orbScore;
      }
    }
  }
  state.entities = state.entities.filter((e) => e.z < 8);
}

/** The autopilot: steers to the nearest gate, zaps what it can, jumps gaps. */
export function autoInput(state) {
  const input = { steer: 0, jump: false, boost: false, zap: false, aimX: 0, aimY: 1.5 };
  if (state.screen === 'relic') return input;
  if (state.lazy) {
    // Lazy play: never steers, never zaps, never jumps.
    return input;
  }
  if (state.screen === 'boss' && state.boss) {
    const b = state.boss;
    // Dodge a warned sweep.
    if (b.sweepState === 'warn') {
      input.steer = state.x < b.sweepX ? -1 : 1;
      if (Math.abs(state.x - b.sweepX) > 2.2) input.steer = 0;
    }
    // Aim at the nearest live weak point and zap.
    let best = null;
    let bestD = 1e9;
    for (const w of b.weak) {
      if (w.dead) continue;
      const wx = Math.cos(w.angle) * 5.5;
      const wy = 3.5 + Math.sin(w.angle) * 2.2;
      const d = Math.hypot(wx - state.x, wy - (state.y + 1));
      if (d < bestD) { bestD = d; best = { x: wx, y: wy }; }
    }
    if (best) {
      input.aimX = best.x;
      input.aimY = best.y;
      if (state.zapCooldown <= 0 && bestD < 8) input.zap = true;
      if (b.sweepState !== 'warn') input.steer = Math.max(-1, Math.min(1, (best.x - state.x) * 0.4));
    }
    // Drift toward a boss orb if no weak point is in range.
    const orb = state.entities.find((e) => e.kind === 'orb' && e.z > -30);
    if (!best && orb) input.steer = Math.max(-1, Math.min(1, (orb.x - state.x) * 0.5));
    return input;
  }
  // Dodge an approaching whale first: it throws you off the board.
  const whale = state.entities.find((e) => e.kind === 'whale' && e.z > -32 && e.z < -2);
  if (whale && Math.abs(whale.x - state.x) < 3.6) {
    const away = whale.x > state.x ? state.x - 3.5 : state.x + 3.5;
    input.steer = Math.max(-1, Math.min(1, (Math.max(-CANYON_HALF, Math.min(CANYON_HALF, away)) - state.x) * 0.8));
    return input;
  }
  // Nearest gate ahead sets the steering target.
  let target = null;
  let targetZ = 1e9;
  for (const e of state.entities) {
    if (e.kind === 'gate' && e.z < -1 && e.z < targetZ) { targetZ = e.z; target = e; }
  }
  if (!target) {
    for (const e of state.entities) {
      if (e.kind === 'orb' && e.z < -1 && e.z < targetZ) { targetZ = e.z; target = e; }
    }
  }
  if (target) {
    input.steer = Math.max(-1, Math.min(1, (target.x - state.x) * 0.6));
    if (target.y > 1.5 && target.z > -16 && state.y === 0) input.jump = true;
  }
  // Jump an approaching gap.
  const gap = state.entities.find((e) => e.kind === 'gap' && e.z > -14 && e.z < -2);
  if (gap && state.y === 0) input.jump = true;
  // Zap the nearest attackable thing in range.
  if (state.zapCooldown <= 0) {
    const rangeZ = hasRelic(state, 'longarc') ? 45 : 30;
    let foe = null;
    let foeZ = 1e9;
    for (const e of state.entities) {
      if ((e.kind === 'crow' || e.kind === 'shielded' || e.kind === 'brute') && e.z < -1 && e.z > -rangeZ && e.z < foeZ) {
        foeZ = e.z; foe = e;
      }
    }
    if (foe) {
      input.aimX = foe.x;
      input.aimY = foe.y;
      input.zap = true;
    }
  }
  // Boost on long safe straights when the charge is high.
  if (state.boostCooldown <= 0 && state.charge > 70 && state.time % 9 < 0.02) input.boost = true;
  return input;
}

/** Run a whole autopilot game in Node (no rendering). Returns the stats. */
export function runAuto(seed, opts = {}) {
  const state = createRun(seed, opts);
  startRun(state);
  let guard = 0;
  while (state.screen !== 'win' && state.screen !== 'lose' && guard < 60 * 400) {
    guard += 1;
    if (state.screen === 'relic') {
      chooseRelic(state, 0);
      continue;
    }
    step(state, autoInput(state));
  }
  return { screen: state.screen, loseReason: state.loseReason, stats: state.stats, guard };
}
