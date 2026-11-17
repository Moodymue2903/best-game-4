// THUNDERHEAD RUN — Node determinism test. Runs the autopilot twice from
// seed 1 (must be byte-identical), once from seed 2 (must win), and once
// lazy from seed 7 (must lose). No rendering, no browser.
import { runAuto } from '../game/src/sim.js';

const a = runAuto(1);
const b = runAuto(1);
const c = runAuto(2);
const lazy = runAuto(7, { lazy: true });

console.log('seed1 run A:', a.screen, JSON.stringify(a.stats));
console.log('seed1 run B:', b.screen, JSON.stringify(b.stats));
console.log('deterministic (A === B):', JSON.stringify(a) === JSON.stringify(b));
console.log('seed2:', c.screen, JSON.stringify(c.stats));
console.log('lazy seed7:', lazy.screen, lazy.loseReason, JSON.stringify(lazy.stats));

let fail = 0;
if (JSON.stringify(a) !== JSON.stringify(b)) { console.log('FAIL: seed 1 not deterministic'); fail += 1; }
if (a.screen !== 'win') { console.log('FAIL: seed 1 autopilot did not win'); fail += 1; }
if (c.screen !== 'win') { console.log('FAIL: seed 2 autopilot did not win'); fail += 1; }
if (lazy.screen !== 'lose') { console.log('FAIL: lazy seed 7 did not lose'); fail += 1; }
if (fail === 0) console.log('ALL NODE CHECKS PASS');
process.exit(fail === 0 ? 0 : 1);
