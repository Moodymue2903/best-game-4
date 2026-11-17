// THUNDERHEAD RUN — the entrypoint handed to make.fun. Node 22, standard
// library only. It mirrors the game's files and its screenshots into the
// output directory and writes dossier.json with the vendored make.fun
// library, so the judge reads exactly what the browser plays.
//
// Run it outside the grader with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(root, 'game');
const shotsDir = join(root, 'screenshots');

function sizeOfTree(dir) {
  let bytes = 0;
  let files = 0;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) {
      const sub = sizeOfTree(p);
      bytes += sub.bytes;
      files += sub.files;
    } else {
      bytes += statSync(p).size;
      files += 1;
    }
  }
  return { bytes, files };
}

if (!existsSync(gameDir)) throw new Error('game/ is missing from the repository');
const gameSize = sizeOfTree(gameDir);
if (gameSize.files > 993) throw new Error('game/ has ' + gameSize.files + ' files, over the 993 cap');
if (gameSize.bytes > 48 * 1024 * 1024) throw new Error('game/ is ' + gameSize.bytes + ' bytes, over the 48 MiB cap');

mkdirSync(outDir, { recursive: true });
cpSync(gameDir, join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
}

writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log('THUNDERHEAD RUN handed in: ' + gameSize.files + ' game files, ' + gameSize.bytes + ' bytes.');
