// WEBKIT-TLA (bible/01-Overview/bugs/Field-Bugs-2026-10-29g.md; AUDIT FB1029g TLA-2): THE BUILT GAME THROUGH ITS FRONT
// DOOR IN WEBKIT - the iPhone's engine. Serves a build's dist and the player's ARENA2, opens /play/, presses OFFLINE,
// NEW GAME and BEGIN by their words, and says whether the world booted or the field's error came ("undefined is not a
// constructor" - a chunk's body run after its importer). The bug lived in the built bundle's chunking, so the dev server
// is no stand-in. WebKit is not pre-installed: PLAYWRIGHT_BROWSERS_PATH=<dir> npx playwright install webkit first.
//
// Usage: npx vite build --outDir <dist> && ARENA2_PATH=/home/claude/dfdata/arena2 node tools/webkitDoorProbe.mjs <dist>
//   BROWSER=webkit|chromium   (default webkit)   DEVICE='iPhone 15'   PORT=8781   PLAY_DELAY_MS=0
// Exit 0 booted, 1 the error, 2 neither within a minute.
import http from 'node:http';
import { createReadStream, statSync, readdirSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { webkit, chromium, devices } from 'playwright';

const [dist] = process.argv.slice(2);
const A2 = process.env.ARENA2_PATH;
if (!dist || !A2) {
  console.error('usage: ARENA2_PATH=<arena2> node tools/webkitDoorProbe.mjs <dist>');
  process.exit(2);
}
const PORT = Number(process.env.PORT ?? 8781);
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
};
const upper = new Map(readdirSync(A2).map((f) => [f.toUpperCase(), f]));
const server = http.createServer((req, res) => {
  let path = decodeURIComponent(String(req.url).split('?')[0]);
  const m = /\/arena2\/([^/]+)$/i.exec(path);
  if (!m && path.endsWith('/')) path += 'index.html';
  const file = m
    ? upper.has(m[1].toUpperCase())
      ? join(A2, /** @type {string} */ (upper.get(m[1].toUpperCase())))
      : ''
    : join(dist, normalize(path));
  let st = null;
  try {
    st = file ? statSync(file) : null;
  } catch {
    st = null;
  }
  if (!st?.isFile()) {
    res.statusCode = 404;
    res.end();
    return;
  }
  res.setHeader('Content-Type', TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', () => r(null)));
const which = process.env.BROWSER ?? 'webkit';
const browser = await (which === 'chromium'
  ? chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  : webkit.launch());
const ctx = await browser.newContext(
  process.env.DEVICE ? { ...devices[process.env.DEVICE] } : { viewport: { width: 1280, height: 800 } },
);
const page = await ctx.newPage();
const seen = [];
const t0 = Date.now();
const say = (s) => {
  const line = `[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`;
  seen.push(line);
  console.log(line);
};
page.on('pageerror', (e) => say(`pageerror ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) say(`console.error ${m.text().slice(0, 300)}`);
});
await page.goto(`http://127.0.0.1:${PORT}/play/?nointro`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.px-menu button', { timeout: 90000 }).catch(() => say('no menu'));
if (await page.locator('.px-acctstage').count()) await page.keyboard.press('Escape');
await page.waitForTimeout(Number(process.env.PLAY_DELAY_MS ?? 0));
for (const word of [/^OFFLINE/i, /^NEW GAME/i, /^(Begin|Start a new game)$/i]) {
  let pressed = false;
  for (let k = 0; k < 20 && !pressed; k++) {
    const buttons = page.locator('button:visible');
    for (let i = 0, n = await buttons.count(); i < n && !pressed; i++) {
      const text = (
        await buttons
          .nth(i)
          .innerText()
          .catch(() => '')
      )
        .replace(/◆/g, '')
        .trim()
        .split('\n')[0]
        .trim();
      if (word.test(text)) {
        await buttons
          .nth(i)
          .click({ timeout: 3000 })
          .catch(() => {});
        say(`pressed ${text}`);
        pressed = true;
      }
    }
    if (!pressed) await page.waitForTimeout(500);
  }
  if (!pressed) say(`no button for ${word}`);
  await page.waitForTimeout(800);
}
let verdict = 2;
for (let k = 0; k < 120 && verdict === 2; k++) {
  await page.waitForTimeout(500);
  if (seen.some((l) => /not a constructor|before initialization/.test(l))) verdict = 1;
  const status = await page
    .evaluate(() => document.getElementById('status')?.textContent ?? document.title)
    .catch(() => '');
  if (/building player pixel|streaming world/.test(status)) verdict = 0;
}
say(['BOOTED', "THE FIELD'S ERROR", 'NEITHER WITHIN A MINUTE'][verdict]);
await browser.close();
server.close();
process.exit(verdict);
