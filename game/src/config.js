// THUNDERHEAD RUN — you are a storm-rider on a hoverboard. You never stop
// moving. You steer, gate, and zap while the canyon forks every 20 seconds.
// Every tuning number, colour and rule in one place. The game is a 2D
// runner wearing a 3D camera: the simulation lives on the (x, y) plane and
// moves forward at a fixed speed; the renderer sells the depth. Nothing in
// here depends on the screen size or the frame rate.

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** Lateral canyon half-width the board can steer inside. */
export const CANYON_HALF = 6.5;

export const THUNDERHEAD_RULES = {
  startCharge: 100,
  maxCharge: 100,
  gateCharge: 20,
  gateChargeHoarder: 35,
  hitCharge: 15,
  orbCharge: 8,
  gapCharge: 10,
  boostCost: 5,
  maxFalls: 3,
  bossTime: 90,
  gateScore: 100,
  crowScore: 150,
  orbScore: 25,
  weakPointScore: 500,
  winBonus: 1000,
  forkLeftBonus: 200,
};

/** The six zones of a run. dur is seconds; spawn numbers are per zone. */
export const THUNDERHEAD_ZONES = [
  { name: 'THE APPROACH', dur: 25, speed: 14, gateGap: 24, crowGap: 90, whaleGap: 0, gust: 0, shielded: false, brute: false, fork: null, platforms: false },
  { name: 'THE FORK', dur: 25, speed: 15, gateGap: 22, crowGap: 70, whaleGap: 130, gust: 0, shielded: false, brute: false, fork: 'first', platforms: false },
  { name: 'THE SQUALL', dur: 30, speed: 16, gateGap: 22, crowGap: 55, whaleGap: 110, gust: 2.6, shielded: true, brute: false, fork: null, platforms: false },
  { name: 'THE ASCENT', dur: 30, speed: 16, gateGap: 20, crowGap: 60, whaleGap: 120, gust: 1.4, shielded: true, brute: false, fork: null, platforms: true },
  { name: 'THE GAUNTLET', dur: 30, speed: 18, gateGap: 18, crowGap: 42, whaleGap: 85, gust: 3.2, shielded: true, brute: true, fork: 'return', platforms: true },
  { name: 'THE EYE', dur: 90, speed: 0, gateGap: 0, crowGap: 0, whaleGap: 0, gust: 0, shielded: false, brute: false, fork: null, platforms: false },
];

export const THUNDERHEAD_ENEMIES = {
  crow: { hp: 1, diveSpeed: 6, score: 150, telegraph: 'SQUAWK' },
  shieldedCrow: { hp: 2, diveSpeed: 5, score: 200, telegraph: 'SQUAWK' },
  brute: { hp: 3, diveSpeed: 3, score: 400, telegraph: 'RUMBLE' },
  whale: { hp: 0, drift: 1.6, score: 0, telegraph: 'WHALE CALL' },
  // The Storm Titan: 3 glowing weak points, each taking 3 hits while the
  // Titan sweeps lightning and moves between positions — the challenge is
  // aiming under pressure, not grinding HP (3 weak points x 3 hits = 9
  // zaps inside the 90s Eye timer).
  titan: { weakPoints: 3, weakHp: 3, sweepEvery: 4, sweepWarn: 0.9, score: 500 },
};

export const THUNDERHEAD_RELICS = [
  { id: 'longarc', name: 'LONG ARC', desc: 'Zap range +50%.' },
  { id: 'quickzap', name: 'QUICK ZAP', desc: 'Zap cooldown -40%.' },
  { id: 'hoarder', name: 'CHARGE HOARDER', desc: 'Gates give +35 charge.' },
  { id: 'whisperer', name: 'WHALE WHISPERER', desc: 'Whales drift 30% slower.' },
  { id: 'gustguard', name: 'GUST GUARD', desc: 'Wind gusts 50% weaker.' },
  { id: 'doublejump', name: 'DOUBLE JUMP', desc: 'A second jump in mid-air.' },
  { id: 'titanslayer', name: 'TITAN SLAYER', desc: 'Titan weak points take 2 hits, not 3. Only after zone 4.' },
  { id: 'stormshield', name: 'STORM SHIELD', desc: 'One free fall per run.' },
];

export const THUNDERHEAD_TITAN_SLAYER_AFTER_ZONE = 4;

export const PALETTE = {
  skyTop: '#0e2466',
  skyMid: '#2b1d7a',
  skyHorizon: '#ff3b8d',
  skyBottom: '#0a1030',
  cloudWhite: '#fff5e0',
  cloudGold: '#ffc53d',
  cloudEdge: '#ff3b8e',
  gate: '#2eff8a',
  gateGold: '#ffd23f',
  lightning: '#5ef2ff',
  crow: '#ff2e93',
  crowDark: '#8a0f4d',
  whale: '#2a3a6e',
  whaleBelly: '#dfe8ff',
  boardGold: '#ffc53d',
  boardCyan: '#00f0ff',
  rider: '#5ef2ff',
  titan: '#3a2a5e',
  titanEye: '#ffd23f',
  hudGold: '#ffc53d',
  hudPanel: '#141a3d',
  text: '#fff5e0',
  danger: '#ff4d5e',
};
