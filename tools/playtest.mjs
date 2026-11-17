// THUNDERHEAD RUN — live playtest with a real mouse. Opens the game, clicks
// START, steers with the keyboard, clicks to zap, and confirms the state
// advances (score/time/zone change) with zero console/page errors.
// Usage: node tools/playtest.mjs  (run from ~/workspace/makefun/shot-tool/)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const repoDir = '/home/hatch/workspace/makefun/best-game-4-repo';
const port = 8105;
const node22 = '/home/hatch/workspace/makefun/node22/node-v22.23.5-linux-x64/bin/node';
const serve = spawn(node22, [join(repoDir, 'serve.ts'), '--port', String(port)], { cwd: repoDir, stdio: ['ignore', 'pipe', 'pipe'] });
let serveLog = '';
serve.stdout.on('data', (d) => { serveLog += d; });
serve.stderr.on('data', (d) => { serveLog += d; });

function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolveOk, reject) => {
    (function probe() {
      fetch(url).then((r) => { if (r.ok) resolveOk(); else retry(); }).catch(retry);
      function retry() {
        if (Date.now() - start > timeoutMs) reject(new Error('server did not start: ' + serveLog));
        else setTimeout(probe, 200);
      }
    })();
  });
}

const errors = [];
async function readState(page) {
  return page.evaluate(() => {
    const s = window.__thunder.state;
    return { screen: s.screen, score: s.score, time: Math.round(s.time * 10) / 10, zone: s.zoneIdx, charge: Math.round(s.charge), gates: s.gates, x: Math.round(s.x * 10) / 10 };
  });
}

try {
  await waitForServer(`http://127.0.0.1:${port}/index.html`);
  const browser = await chromium.launch({ args: ['--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  console.log('before start:', JSON.stringify(await readState(page)));
  await page.mouse.click(640, 545); // START SURFING
  await page.waitForTimeout(500);
  console.log('after start:', JSON.stringify(await readState(page)));
  // Steer left, then right, jump, zap.
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(900);
  await page.keyboard.up('KeyA');
  console.log('after steer left:', JSON.stringify(await readState(page)));
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(900);
  await page.keyboard.up('KeyD');
  await page.keyboard.press('Space');
  await page.mouse.click(640, 300); // zap at centre
  await page.waitForTimeout(500);
  console.log('after steer right + jump + zap:', JSON.stringify(await readState(page)));
  // Let it surf for 20s with some steering.
  for (let i = 0; i < 10; i++) {
    await page.keyboard.down(i % 2 === 0 ? 'KeyA' : 'KeyD');
    await page.waitForTimeout(1000);
    await page.keyboard.up(i % 2 === 0 ? 'KeyA' : 'KeyD');
    await page.mouse.click(640, 300);
    await page.waitForTimeout(1000);
  }
  const end = await readState(page);
  console.log('after 20s of play:', JSON.stringify(end));
  await page.screenshot({ path: '/tmp/th4-live.jpg', type: 'jpeg', quality: 85 });
  console.log('live screenshot: /tmp/th4-live.jpg');
  console.log('state advanced (time>=20, score>0):', end.time >= 20 && end.score > 0 ? 'YES' : 'NO');
  await browser.close();
} finally {
  serve.kill();
}
console.log('console/page errors:', errors.length ? errors : 'none');
