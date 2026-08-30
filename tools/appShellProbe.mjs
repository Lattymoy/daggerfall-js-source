// DA5: the desktop shell, launched for real. Headless proof that the
// downloadable app actually is the game with files under it:
//
//   1. Electron boots app/main.cjs, the dagger:// protocol serves the
//      BUILT dist/ (so `npm run build` first), and the game's entry
//      document arrives with its scripts;
//   2. the preload bridge is standing: window.daggerShell.storage
//      speaks the five words from the page;
//   3. a save written FROM THE PAGE lands on disk in DFU's layout
//      (Saves/SAVE9/SaveData.txt + SaveInfo.txt + Screenshot.jpg,
//      with the screenshot a real JPEG), reads back byte-identical,
//      and enumerates through the DA1 seam's localStorage shape.
//
// Needs a display (xvfb-run -a on a headless box) and the shell's
// deps (`cd app && npm install`). No ARENA2 required: the probe never
// leaves the boot overlay, and the storage laws it proves do not care.
//
//   npm run build && xvfb-run -a node tools/appShellProbe.mjs

import { _electron } from 'playwright';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'app', 'package.json'));
const electronPath = require('electron');   // app/node_modules - the shell's own binary

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'dagger-shell-probe-'));
let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? 'ok' : 'NOT OK'} - ${label}`);
  if (!ok) failures++;
};

const app = await _electron.launch({
  executablePath: electronPath,
  args: ['--no-sandbox', path.join(root, 'app')],
  env: {
    ...process.env,
    DAGGER_USER_DATA: userData,
    DAGGER_SKIP_ARENA2_PROMPT: '1',
  },
});

try {
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  check(page.url() === 'dagger://game/play/index.html', `the game document over dagger:// (got ${page.url()})`);
  check(await page.evaluate(() => !!document.querySelector('script')), 'the built entry script arrived');

  const bridge = await page.evaluate(() => ({
    has: !!window.daggerShell,
    words: window.daggerShell ? Object.keys(window.daggerShell.storage).sort() : [],
    savesPath: window.daggerShell?.savesPath ?? null,
  }));
  check(bridge.has, 'daggerShell bridge exposed');
  check(bridge.words.join(',') === 'getItem,key,length,removeItem,setItem', `the five words (got ${bridge.words})`);
  check(bridge.savesPath === userData, 'savesPath is the shell user-data dir');

  // A save from the page, DFU-shaped on disk. A tiny real JPEG (SOI +
  // EOI) rides as the screenshot.
  const shot = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64');
  const roundTrip = await page.evaluate((shotUrl) => {
    const s = window.daggerShell.storage;
    s.setItem('dagger.save.9', '{"v":1,"name":"Probe"}');
    s.setItem('dagger.saveinfo.9', '{"saveName":"ProbeSave","characterName":"Probe"}');
    s.setItem('dagger.saveshot.9', shotUrl);
    s.setItem('dagger.settings.v1', '{"Video":{"Fullscreen":"True"}}');
    const keys = [];
    for (let i = 0; i < s.length(); i++) keys.push(s.key(i));
    return { back: s.getItem('dagger.save.9'), shotBack: s.getItem('dagger.saveshot.9'), keys };
  }, shot);
  check(roundTrip.back === '{"v":1,"name":"Probe"}', 'SaveData round-trips byte-identical through the bridge');
  check(roundTrip.shotBack === shot, 'the screenshot data URL round-trips');
  check(roundTrip.keys.includes('dagger.saveinfo.9') && roundTrip.keys.includes('dagger.settings.v1'),
    `enumeration sees the writes (got ${roundTrip.keys})`);

  const slotDir = path.join(userData, 'Saves', 'SAVE9');
  check(fs.readFileSync(path.join(slotDir, 'SaveData.txt'), 'utf8') === '{"v":1,"name":"Probe"}',
    'Saves/SAVE9/SaveData.txt holds the exact bytes');
  check(fs.existsSync(path.join(slotDir, 'SaveInfo.txt')), 'SaveInfo.txt beside it');
  const jpg = fs.readFileSync(path.join(slotDir, 'Screenshot.jpg'));
  check(jpg[0] === 0xff && jpg[1] === 0xd8, 'Screenshot.jpg is a real JPEG on disk');
  check(fs.existsSync(path.join(userData, 'Prefs', 'dagger.settings.v1')), 'settings landed under Prefs/');

  // The DA1 seam from inside the game's own modules: the entry chunk
  // already booted; ask the page-side wrap directly.
  const seam = await page.evaluate(() => {
    const s = window.daggerShell.storage;
    s.removeItem('dagger.save.9'); s.removeItem('dagger.saveinfo.9'); s.removeItem('dagger.saveshot.9');
    return s.getItem('dagger.save.9');
  });
  check(seam === null, 'removeItem answers null afterwards, localStorage-style');
  check(!fs.existsSync(slotDir), 'the emptied SAVE9 folder went with its last file');
} finally {
  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall shell probes green');
process.exit(failures ? 1 : 0);
