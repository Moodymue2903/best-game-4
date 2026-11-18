# THUNDERHEAD RUN

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Moodymue2903/best-game-4/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Moodymue2903/best-game-4/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Entered on [make.fun](https://make.fun/bounty/best-game-01) — the "Make the best game" bounty, $1,000 in USDC.

Surf a hoverboard down a lightning-charged cloud canyon. The board never stops.

Steer through emerald gates to charge. Zap storm-crows. Dodge the sky-whales.
Every 20 seconds the canyon forks: left is fast, right is safe. Draft a relic
after each zone. In The Eye, zap all 3 weak points of the Storm Titan before
it collapses — or lose to 3 falls, an empty charge, or the 90-second timer.

**WIN:** destroy the Titan's 3 weak points.
**LOSE:** 3 falls off the board, charge hits 0, or the Eye collapses (90s).

## Controls

- A / D or Left / Right — steer (the board banks into turns)
- Space — jump (Double Jump relic: twice)
- Shift — boost (costs 5 charge, 2s cooldown)
- Click — zap (short-range lightning arc, aims at the mouse, 3s cooldown)
- 1 / 2 — pick a relic card
- R — restart, M — mute

## Play

Open `game/index.html` in desktop Chrome (or `node serve.ts` and visit
http://localhost:8080). No network needed: three.js is vendored under
`game/vendor/`, all sounds are synthesized with WebAudio.

## Verify

- `node tests/auto.mjs` — autopilot determinism (seed 1 twice identical),
  seed 2 win, lazy seed 7 loss. No browser needed.
- `node tools/shot.mjs` — takes the 4 screenshots into `screenshots/`
  (run from a directory with `playwright-core` installed).
- `node tools/playtest.mjs` — live playtest with a real mouse.
- `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` — writes the
  dossier to `out/dossier.json`.

Built for the make.fun best-game-01 bounty. Original idea, art, sounds and
names; three.js (MIT) is the only third-party code, vendored as
`game/vendor/three.module.min.js`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=XSCZ-RCXQ&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
