// THUNDERHEAD RUN — boot + game loop. Fixed 60 Hz simulation, a render
// every animation frame, DOM HUD and overlays. ?shot=cover|play|title|
// victory stages a frozen frame for screenshots; ?auto=1 plays the whole
// run with the autopilot and reports the result on window.__autoResult.

import { createRun, startRun, step, chooseRelic, autoInput, runAuto } from './sim.js';
import { STEP, THUNDERHEAD_ZONES, THUNDERHEAD_RELICS } from './config.js';
import { createRenderer, renderFrame, shake } from './render.js';
import { bindInput, readInput, readRelicPick, getCamPitch } from './input.js';
import { initAudio, setHum, setMusicLayers, gateChime, zapCrack, squawk, whaleCall, titanRoar, relicPick, winJingle, loseDrone } from './audio.js';
import { stageCover, stageTitle, fastForward, runToEnd } from './shots.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('game');
const world = createRenderer(canvas);
bindInput(canvas);

const el = (id) => document.getElementById(id);
const hud = el('hud');
const chargeFill = el('charge-fill');
const chargeText = el('charge-text');
const scoreText = el('score-text');
const zoneText = el('zone-banner');
const zapFill = el('zap-fill');
const fallsText = el('falls-text');
const timerText = el('timer-text');
const eventText = el('event-text');
const statusEl = el('status');
const titleEl = el('title');
const relicEl = el('relic');
const endEl = el('end');
const endTitle = el('end-title');
const endStats = el('end-stats');

let state = createRun(1);
let prevGates = 0;
let prevKills = 0;
let prevCharge = 100;
let eventTimer = 0;
let lastScreen = 'title';

window.__shotReady = false;
window.__thunder = { get state() { return state; } };

function zoneName(s) {
  return THUNDERHEAD_ZONES[s.zoneIdx].name;
}

function updateHud() {
  chargeFill.style.width = Math.max(0, state.charge) + '%';
  chargeText.textContent = 'CHARGE ' + Math.max(0, Math.round(state.charge));
  scoreText.textContent = String(state.score).padStart(6, '0');
  zoneText.textContent = state.screen === 'boss' ? 'THE EYE — STORM TITAN' : zoneName(state);
  const zapMax = 3;
  const zapFrac = state.zapCooldown > 0 ? 1 - state.zapCooldown / zapMax : 1;
  zapFill.style.width = Math.round(zapFrac * 100) + '%';
  fallsText.textContent = 'FALLS ' + state.falls + '/3';
  if (state.screen === 'boss' && state.boss) {
    timerText.textContent = 'EYE ' + Math.ceil(state.boss.timer) + 's';
    timerText.style.display = 'block';
  } else if (state.zoneIdx === 5) {
    timerText.style.display = 'none';
  } else {
    timerText.style.display = 'none';
  }
  if (state.lastEvent && eventTimer > 0) {
    eventText.textContent = state.lastEvent;
    eventText.style.opacity = '1';
  } else {
    eventText.style.opacity = '0';
  }
  const screenWord = state.screen === 'play' ? 'surfing ' + zoneName(state) : state.screen;
  statusEl.textContent = 'THUNDERHEAD RUN — ' + screenWord + '. Score ' + state.score + ', charge ' + Math.round(state.charge) + ', falls ' + state.falls + ' of 3.';
}

function showRelicDraft() {
  const cards = el('relic-cards');
  cards.innerHTML = '';
  state.draft.forEach((relic, i) => {
    const b = document.createElement('button');
    b.className = 'relic-card';
    b.innerHTML = '<b>[' + (i + 1) + '] ' + relic.name + '</b><span>' + relic.desc + '</span>';
    b.addEventListener('click', () => {
      initAudio();
      relicPick();
      chooseRelic(state, i);
      relicEl.style.display = 'none';
    });
    cards.appendChild(b);
  });
  relicEl.style.display = 'flex';
}

function showEnd() {
  const s = state.stats || { score: state.score, gates: 0, time: 0 };
  if (state.screen === 'win') {
    endTitle.textContent = 'VICTORY — THE TITAN FALLS!';
    endTitle.style.color = '#ffd23f';
  } else {
    endTitle.textContent = 'DEFEAT — ' + (state.loseReason || 'the storm wins');
    endTitle.style.color = '#ff4d5e';
  }
  endStats.textContent = 'SCORE ' + s.score + '  •  GATES ' + s.gates + '  •  ZAPS ' + s.zaps + '  •  CROWS DOWN ' + s.kills +
    '  •  TIME ' + s.time + 's  •  ZONES ' + s.zones + '  •  RELICS ' + (s.relics || []).join(', ');
  endEl.style.display = 'flex';
}

el('start-btn').addEventListener('click', () => {
  initAudio();
  startRun(state);
  titleEl.style.display = 'none';
  hud.style.display = 'block';
});
el('restart-btn').addEventListener('click', () => {
  location.reload();
});
el('mute-btn').addEventListener('click', async () => {
  const { toggleMute } = await import('./audio.js');
  const m = toggleMute();
  el('mute-btn').textContent = m ? 'UNMUTE (M)' : 'MUTE (M)';
});

function handleScreenChanges() {
  if (state.screen === lastScreen) return;
  const prev = lastScreen;
  lastScreen = state.screen;
  if (state.screen === 'relic') showRelicDraft();
  if (state.screen === 'boss' && prev !== 'boss') titanRoar();
  if (state.screen === 'win') { winJingle(); showEnd(); }
  if (state.screen === 'lose') { loseDrone(); showEnd(); }
}

function playSounds() {
  if (state.gates > prevGates) gateChime(state.gateChain);
  if (state.kills > prevKills) zapCrack();
  if (state.charge < prevCharge - 5) {
    shake(world, 1.2);
    if (state.hits > 0) squawk();
  }
  prevGates = state.gates;
  prevKills = state.kills;
  prevCharge = state.charge;
}

// ---- Staged screenshot mode: freeze a moment, render it, signal ready. ----
if (params.has('shot')) {
  const kind = params.get('shot');
  if (kind === 'cover') state = stageCover();
  else if (kind === 'play') state = fastForward(1, 100);
  else if (kind === 'victory') state = runToEnd(1);
  else state = stageTitle();
  hud.style.display = 'block';
  titleEl.style.display = 'none';
  if (kind === 'title') titleEl.style.display = 'flex';
  if (kind === 'victory') showEnd();
  updateHud();
  let frames = 0;
  (function shotLoop() {
    renderFrame(world, state, 0.016, 0);
    frames += 1;
    if (frames < 4) requestAnimationFrame(shotLoop);
    else window.__shotReady = true;
  })();
} else {
  // ---- Live game. ----
  const autoMode = params.has('auto');
  const lazyMode = params.get('auto') === 'lazy';
  let acc = 0;
  let last = performance.now();
  let shotSignalled = false;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (eventTimer > 0) eventTimer -= dt;

    if (state.screen === 'play' || state.screen === 'boss') {
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 5) {
        acc -= STEP;
        n += 1;
        const input = autoMode
          ? autoInput(state)
          : readInput();
        if (autoMode && state.screen === 'relic') chooseRelic(state, 0);
        step(state, input);
        playSounds();
        if (state.lastEvent) eventTimer = 2.2;
        if (state.screen === 'win' || state.screen === 'lose') {
          window.__autoResult = { screen: state.screen, loseReason: state.loseReason, stats: state.stats };
          break;
        }
      }
      if (acc > STEP * 5) acc = 0;
    } else if (state.screen === 'relic') {
      if (autoMode) {
        chooseRelic(state, 0);
        relicEl.style.display = 'none';
      } else {
        const pick = readRelicPick();
        if (pick >= 0) {
          relicPick();
          chooseRelic(state, pick);
          relicEl.style.display = 'none';
        }
      }
    }
    if (state.screen === 'title' && autoMode) {
      initAudio();
      startRun(state);
      titleEl.style.display = 'none';
      hud.style.display = 'block';
    }

    handleScreenChanges();
    setMusicLayers(state.zoneIdx + 1);
    setHum(state.screen === 'play' ? state.speed : 4);
    renderFrame(world, state, dt, autoMode ? 0 : getCamPitch());
    updateHud();
    if (!shotSignalled) {
      shotSignalled = true;
      window.__shotReady = true;
    }
  }
  requestAnimationFrame(frame);
}

export { runAuto };
