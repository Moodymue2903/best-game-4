// THUNDERHEAD RUN — procedural WebAudio. No audio files, no network: every
// sound is an oscillator or filtered noise built at run time, started only
// after the player's first gesture (browsers demand that).

let ctx = null;
let humOsc = null;
let humGain = null;
let muted = false;
let musicTimer = null;
let musicStep = 0;
let musicLayers = 1;

function ensure() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
  } catch (e) {
    ctx = null;
  }
  return ctx;
}

/** Call from the first user gesture. Starts the board hum + music. */
export function initAudio() {
  const c = ensure();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
  if (!humOsc) {
    humOsc = c.createOscillator();
    humOsc.type = 'sawtooth';
    humOsc.frequency.value = 55;
    humGain = c.createGain();
    humGain.gain.value = 0.0;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    humOsc.connect(filter);
    filter.connect(humGain);
    humGain.connect(c.destination);
    humOsc.start();
    humGain.gain.linearRampToValueAtTime(0.05, c.currentTime + 0.5);
  }
  if (!musicTimer) {
    // Driving 4/4 arpeggio: one note per 8th at 132 BPM, a layer per zone.
    musicTimer = setInterval(() => {
      if (muted || !ctx) return;
      const scale = [0, 3, 5, 7, 10, 12, 15];
      const note = scale[musicStep % scale.length];
      const freq = 220 * Math.pow(2, note / 12);
      blip('square', freq, 0.09, 0.035);
      if (musicLayers >= 2 && musicStep % 2 === 0) blip('square', freq / 2, 0.12, 0.04);
      if (musicLayers >= 3 && musicStep % 4 === 0) blip('sine', freq * 2, 0.2, 0.03);
      musicStep += 1;
    }, 227);
  }
}

export function setMusicLayers(n) {
  musicLayers = Math.max(1, Math.min(4, n));
}

/** The hum follows the board's speed. */
export function setHum(speed) {
  if (!ctx || !humOsc || muted) return;
  humOsc.frequency.setTargetAtTime(45 + speed * 3.2, ctx.currentTime, 0.1);
  if (humGain) humGain.gain.setTargetAtTime(muted ? 0 : 0.05, ctx.currentTime, 0.1);
}

export function toggleMute() {
  muted = !muted;
  if (humGain && ctx) humGain.gain.setTargetAtTime(muted ? 0 : 0.05, ctx.currentTime, 0.05);
  return muted;
}

function blip(type, freq, dur, vol, slideTo) {
  if (!ctx || muted) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  o.connect(g);
  g.connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + dur + 0.02);
}

function noiseBurst(dur, vol, filterFreq) {
  if (!ctx || muted) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f);
  f.connect(g);
  g.connect(ctx.destination);
  src.start();
}

/** Bright bell; pitch climbs with each gate in a chain. */
export function gateChime(chain) {
  blip('sine', 660 * Math.pow(2, Math.min(chain, 8) * 0.5 / 12), 0.35, 0.09);
  blip('sine', 990 * Math.pow(2, Math.min(chain, 8) * 0.5 / 12), 0.25, 0.05);
}

/** Short square-wave crack + noise burst. */
export function zapCrack() {
  blip('square', 1800, 0.08, 0.08, 300);
  noiseBurst(0.12, 0.12, 3200);
}

/** Fast downward sweep + noise tail. */
export function squawk() {
  blip('sawtooth', 900, 0.25, 0.06, 220);
  noiseBurst(0.2, 0.05, 1400);
}

/** Low sine with slow vibrato. */
export function whaleCall() {
  blip('sine', 140, 0.9, 0.08, 90);
  blip('sine', 210, 0.7, 0.04, 130);
}

/** Layered saw + sub-bass roar. */
export function titanRoar() {
  blip('sawtooth', 90, 1.2, 0.12, 45);
  blip('sawtooth', 135, 1.0, 0.08, 60);
  noiseBurst(0.8, 0.06, 300);
}

/** Ascending arpeggio for a relic pick. */
export function relicPick() {
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip('sine', f, 0.22, 0.07), i * 70));
}

/** Victory chord; defeat drone. */
export function winJingle() {
  [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => blip('triangle', f, 0.6, 0.08), i * 90));
}
export function loseDrone() {
  blip('sawtooth', 160, 1.4, 0.09, 55);
}
