// FOEBAR1 (2026-09-17, Mac, from a friend's two pictures) - THE BLADE
// FACE, SEEN. The enhanced HUD is drawn over the real module on a phone
// context, a foe is marked struck at full, half and a tenth of its
// health, and the target block is screenshotted under both faces (the
// plain bar, the blade) so the pictures Mac's friend sent can be checked
// against what the port draws: the dark shape as the empty bar, the red
// one as the fill, receding from both tips toward the skull hub.
//
// It also reads the laws off the DOM: the blade shows only under the
// pref, the plain track hides under it, the clip is inset(0 X% 0 X%) with
// X = (100 - pct) / 2, and both pictures resolve (no broken image).
//
//     PROBE_PORT=5199 node tools/foebar1Probe.mjs        # shots into tools/foebar1-*.png
import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const PAGE_NAME = 'foebar1-probe.tmp.html';   // written at the ROOT, not tools/: the pictures are page-relative (./hud/), as the doll's ./skin/ is
const OUT = process.env.FOEBAR1_OUT ?? join(ROOT, 'tools');

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>FOEBAR1 probe</title>
<style>html,body{margin:0;height:100%;background:#3a4a5a;overflow:hidden}</style></head><body>
<script type="module">
import { drawEnhancedHud } from '/src/ui/enhancedHud.js';
import { markFoeStruck, clearFoeTarget } from '/src/ui/hudFoeTarget.js';
import { setPref, getPref } from '/src/systems/uiPrefs.js';
const e = { name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48, willpower: 50, intelligence: 50 },
  health: 30, maxHealth: 40, fatigue: 100, maxFatigue: 200, magicka: 10, maxMagicka: 20, items: [], spells: [] };
const foe = { entity: { name: 'Vampire Ancient', health: 100, maxHealth: 100 }, dead: false };
function frame() { drawEnhancedHud(e, 0.25, 1 / 60, {}); requestAnimationFrame(frame); }
frame();
globalThis.__probe = {
  style: (s) => { setPref('foeBarStyle', s); return getPref('foeBarStyle'); },
  strike: (pct) => { foe.entity.health = pct; markFoeStruck(foe); },
  clear: () => clearFoeTarget(),
  rect: () => { const n = document.querySelector('.hud-foe'); if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; },
  read: () => {
    const foe = document.querySelector('.hud-foe'); const track = document.querySelector('.hud-foetrack'); const blade = document.querySelector('.hud-foeblade');
    const full = document.querySelector('.hud-bladefull'); const empty = document.querySelector('.hud-bladeempty');
    const cs = (n) => n ? getComputedStyle(n) : null;
    return { on: foe?.classList.contains('on'), blade: foe?.classList.contains('blade'), trackDisplay: cs(track)?.display, bladeDisplay: cs(blade)?.display,
      clip: full?.style.clipPath ?? null, fill: document.querySelector('.hud-fill')?.style.width ?? null,
      emptyImg: cs(empty)?.backgroundImage, fullImg: cs(full)?.backgroundImage, w: blade?.getBoundingClientRect().width, h: blade?.getBoundingClientRect().height };
  },
  loaded: async () => { const urls = ['./hud/foe-blade-empty.png', './hud/foe-blade-full.png']; const out = {}; for (const u of urls) { const r = await fetch(u); out[u] = r.ok ? (await r.blob()).size : r.status; } return out; },
};
document.title = 'ready';
<\/script></body></html>`;

const fails = [];
const check = (name, ok, detail = '') => { if (!ok) fails.push(`${name}${detail ? ` - ${detail}` : ''}`); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); };

await writeFile(join(ROOT, PAGE_NAME), PAGE);
await mkdir(OUT, { recursive: true });
const vite = process.env.PROBE_PORT ? null : await createServer({ root: ROOT, server: { port: 0, host: '127.0.0.1', watch: null }, logLevel: 'error' });
if (vite) await vite.listen();
const port = vite ? vite.httpServer.address().port : Number(process.env.PROBE_PORT);
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
try {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 500 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (er) => errors.push(er.message));
  await page.goto(`http://127.0.0.1:${port}/${PAGE_NAME}?nofonts`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!globalThis.__probe, null, { timeout: 30000 });
  const P = (fn, ...a) => page.evaluate(fn, ...a);
  const sleep = (ms) => page.waitForTimeout(ms);
  const loaded = await P(() => globalThis.__probe.loaded());
  check('both pictures are served', Object.values(loaded).every((v) => v > 1000), JSON.stringify(loaded));
  for (const style of ['bar', 'blade']) {
    check(`the pref takes '${style}'`, (await P((s) => globalThis.__probe.style(s), style)) === style);
    for (const pct of [100, 50, 10]) {
      await P((p) => globalThis.__probe.strike(p), pct);
      await sleep(120);
      const r = await P(() => globalThis.__probe.read());
      check(`${style} @${pct}: the target block is on`, r.on === true, JSON.stringify(r));
      if (style === 'blade') {
        check(`blade @${pct}: the blade shows and the track hides`, r.blade && r.bladeDisplay === 'block' && r.trackDisplay === 'none', `${r.bladeDisplay}/${r.trackDisplay}`);
        const x = ((100 - pct) / 2).toFixed(2);
        // the browser normalises the four-value inset to its short form (`inset(0px 25%)`)
        const insets = (r.clip.match(/[\d.]+%/g) ?? []).map(parseFloat);
        check(`blade @${pct}: the fill is clipped in ${x}% from each tip`, insets.length >= 1 && insets.every((v) => Math.abs(v - Number(x)) < 0.01) && /^inset\(0(?:px)? /.test(r.clip), r.clip);
        check(`blade @${pct}: both pictures are the crop`, /foe-blade-empty\.png/.test(r.emptyImg) && /foe-blade-full\.png/.test(r.fullImg), `${r.emptyImg} | ${r.fullImg}`);
        check(`blade @${pct}: the shape keeps the crop's aspect`, Math.abs(r.w / r.h - 981 / 130) < 0.05, `${r.w}x${r.h}`);
      } else {
        check(`bar @${pct}: the plain track shows and the blade hides`, !r.blade && r.trackDisplay !== 'none' && r.bladeDisplay === 'none', `${r.trackDisplay}/${r.bladeDisplay}`);
        check(`bar @${pct}: the fill is ${pct}%`, Math.abs(parseFloat(r.fill) - pct) < 0.01, r.fill);
      }
      const rect = await P(() => globalThis.__probe.rect());
      const clip = { x: Math.max(0, rect.x - 24), y: Math.max(0, rect.y - 12), width: Math.min(900, rect.width + 48), height: rect.height + 24 };
      await page.screenshot({ path: join(OUT, `foebar1-${style}-${pct}.png`), clip });
    }
  }
  check('no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
} finally {
  await browser.close();
  await vite?.close();
  await unlink(join(ROOT, PAGE_NAME)).catch(() => {});
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall passed');
process.exit(fails.length ? 1 : 0);
