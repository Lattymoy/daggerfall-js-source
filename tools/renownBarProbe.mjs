// RENOWN-BAR (2026-09-26, Mac: "with the new renown xp bar, I want to remove the xp amount on the lefthand side and
// integrate it into the bar itself, then center the bar properly"; then "Actually lets just keep the other bar and
// remove the xp. Just have it visible in the player profile") - THE HUD'S RENOWN ROW, DRAWN AND MEASURED.
//
// Whether a bar is centred is a thing about pixels: a pin can say the row's rule reads `grid` with two equal outer
// columns, and only a layout engine can say the bar's middle IS the vitals' middle. So the REAL HUD is drawn here
// (ui/enhancedHud.js's drawEnhancedHud over the real sheets, the enhanced skin - Plus is its only dress) with a Renown
// the page hands it through ui/hudRenown.js's own seam, at a desktop, a laptop and a phone both ways up, and for each
// Renown state - a level part-way (with XP earned and not yet answered), a level's start, a level's last XP, the cap,
// and a level with no total yet (the box alone) - it reads:
//   - UI3 (2026-09-27, Mac: "more space for the XP bar and being able to fit the XP amounts inside"): THE NUMBERS IN
//     THE BAR - the level's credit over its span ("Highest" at the cap), inside the track and on one line, never
//     beside it; none with no total;
//   - THE BAR IS CENTRED: the track's middle within 1px of the vitals row's middle (the health bar's - the screen's);
//   - THE VITALS' HEIGHT: a 20px track, as tall as a vital's, inside the row's 22px (the HUD's boxes count their frame);
//   - the level's box stands clear of the track, and the row is on the screen.
// Each state's row is photographed. Before RENOWN-BAR it read the bar 42px left of the vitals' middle (57px at the
// widest numbers), the numbers beside it; RENOWN-BAR took the numbers off and kept the bar thin while the status row
// stood under it.
//
// IT RUNS ON VITE'S OWN DEV SERVER (tools/qs3Probe.mjs's reason).
//
//     node tools/renownBarProbe.mjs                  -> shots (tools/shots/, or SHOT_DIR) and a report
//     PROBE_PORT=<n> node tools/renownBarProbe.mjs   -> reuse a dev server already listening there
//     NOFONTS=1 node tools/renownBarProbe.mjs        -> offline: the sheet's fallback faces, not the web fonts (the
//                                                       widths it reports are then the fallback's)
import { mkdirSync } from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const PAGE_NAME = 'renownbar.tmp.html';
const OUT = process.env.SHOT_DIR ?? join(ROOT, 'tools/shots');

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>RENOWN-BAR probe</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:repeating-linear-gradient(45deg,#3b4a3a 0 14px,#324031 14px 28px)}</style></head><body>
<script type="module">
import { drawEnhancedHud } from '/src/ui/enhancedHud.js';
import { setHudRenown } from '/src/ui/hudRenown.js';
import { renownXpFor, RENOWN_MAX } from '/src/net/renown.js';
const e = { name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48, willpower: 50, intelligence: 50 },
  health: 30, maxHealth: 40, fatigue: 150, maxFatigue: 200, magicka: 14, maxMagicka: 20, items: [], spells: [] };
let src = null;
setHudRenown(() => src);
// level, the share of it credited, the XP earned and not yet answered, and whether the service has said the total
globalThis.__renown = (level, frac, pending = 0, total = true) => {
  const a = renownXpFor(level), b = level < RENOWN_MAX ? renownXpFor(level + 1) : a;
  src = { level, xp: total ? a + Math.min(b - a - (level < RENOWN_MAX ? 1 : 0), Math.floor((b - a) * frac)) : null, pending };
};
function frame() { drawEnhancedHud(e, 0.25, 1 / 60, {}); requestAnimationFrame(frame); }
frame();
const box = (n) => { if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, r: r.x + r.width }; };
globalThis.__measure = () => {
  const row = document.querySelector('.hud-renown');
  const track = row?.querySelector('.hud-renowntrack');
  const num = row?.querySelector('.hud-renownnum');
  const shown = (n) => !!n && getComputedStyle(n).display !== 'none' && n.getClientRects().length > 0;
  return {
    vw: innerWidth, vh: innerHeight,
    on: !!row && shown(row),
    bars: box(document.querySelector('.hud-bars')),
    row: box(row), track: shown(track) ? box(track) : null, level: box(row?.querySelector('.hud-renownbox')),
    num: shown(num) && num.textContent ? box(num) : null,
    words: (row?.textContent ?? '').replace(row?.querySelector('.hud-renownbox')?.textContent ?? '', '').trim(),
    levelText: row?.querySelector('.hud-renownbox')?.textContent ?? '',
  };
};
</script></body></html>`;

const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'laptop', viewport: { width: 1024, height: 700 } },
  { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { name: 'phone-land', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true },
];
const STATES = [
  { name: 'mid', args: [12, 0.42, 900] },
  { name: 'start', args: [3, 0, 0] },
  { name: 'lastxp', args: [41, 0.9999, 0] },
  { name: 'cap', args: [50, 0, 0] },
  { name: 'nototal', args: [7, 0, 0, false] },
];

mkdirSync(OUT, { recursive: true });
const vite = process.env.PROBE_PORT ? null : await createServer({ root: ROOT, server: { port: 0, host: '127.0.0.1', watch: null }, logLevel: 'error' });
if (vite) await vite.listen();
const port = vite ? vite.httpServer.address().port : Number(process.env.PROBE_PORT);
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const fails = [];
let checks = 0;
const check = (ok, what) => { checks++; if (!ok) fails.push(what); };
try {
  await writeFile(join(ROOT, `tools/${PAGE_NAME}`), PAGE);
  for (const v of VIEWS) {
    const ctx = await browser.newContext({ viewport: v.viewport, isMobile: !!v.isMobile, hasTouch: !!v.hasTouch, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', (err) => fails.push(`${v.name}: page error ${err.message}`));
    await page.goto(`http://127.0.0.1:${port}/tools/${PAGE_NAME}?skin=enhanced${process.env.NOFONTS ? '&nofonts' : ''}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => typeof globalThis.__measure === 'function' && !!document.querySelector('.hud-renown'), null, { timeout: 60000 });
    // the box's width is its FACE's: wait for the web fonts the page asked for (a face that never came says so)
    const face = await page.evaluate(async () => {
      const link = document.getElementById('dagger-enhanced-fonts');
      if (link && !link.sheet) await new Promise((res) => { link.addEventListener('load', res, { once: true }); link.addEventListener('error', res, { once: true }); setTimeout(res, 15000); });
      globalThis.__renown(12, 0.42, 900);
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      await document.fonts.ready;
      const lv = document.querySelector('.hud-renownbox');
      const fam = lv ? getComputedStyle(lv).fontFamily : '';
      const first = fam.split(',')[0].trim().replace(/["']/g, '');
      return { fam, first, loaded: !!first && document.fonts.check(`13px "${first}"`) && [...document.fonts].some((f) => f.family.replace(/["']/g, '') === first && f.status === 'loaded') };
    });
    console.log(`${v.name}: the box's face ${face.first || '(none)'} - ${face.loaded ? 'loaded' : 'NOT loaded (the fallback measured)'}`);
    for (const s of STATES) {
      await page.evaluate((a) => globalThis.__renown(...a), s.args);
      await page.waitForTimeout(250);
      const m = await page.evaluate(() => globalThis.__measure());
      const tag = `${v.name}/${s.name}`;
      const off = m.track && m.bars ? m.track.cx - m.bars.cx : null;
      console.log(`${tag.padEnd(20)} level [${m.levelText}] words "${m.words}"`
        + (m.track ? ` | bar ${m.track.w.toFixed(0)}x${m.track.h.toFixed(0)}, centre off ${off.toFixed(1)}px` : ' | no bar'));
      check(m.on, `${tag}: the row is not drawn`);
      if (m.on && m.bars && m.row) {
        const pad = 18;
        const clip = { x: Math.max(0, Math.min(m.bars.x, m.row.x) - pad), y: Math.max(0, Math.min(m.bars.y, m.row.y) - pad) };
        clip.width = Math.min(m.vw, Math.max(m.bars.r, m.row.r) + pad) - clip.x;
        clip.height = Math.min(m.vh, Math.max(m.bars.y + m.bars.h, m.row.y + m.row.h) + pad) - clip.y;
        await page.screenshot({ path: join(OUT, `renownbar-${v.name}-${s.name}.png`), clip });
      }
      check(m.row && m.row.x >= 0 && m.row.r <= m.vw, `${tag}: the row runs off the screen`);
      check(m.levelText === String(s.args[0]), `${tag}: the box says "${m.levelText}", not ${s.args[0]}`);
      if (s.name === 'nototal') {
        check(!m.track && !m.num && m.words === '', `${tag}: a bar or words with no total`);
        continue;
      }
      check(s.name === 'cap' ? m.words === 'Highest' : /^[\d,]+ \/ [\d,]+ XP$/.test(m.words), `${tag}: the bar says "${m.words}"`);
      check(m.num && m.track && m.num.x >= m.track.x - 0.5 && m.num.r <= m.track.r + 0.5 && m.num.y >= m.track.y - 0.5 && m.num.y + m.num.h <= m.track.y + m.track.h + 0.5, `${tag}: the words run out of the bar`);
      check(m.num && m.num.h <= 16, `${tag}: the words wrap (${m.num?.h}px tall)`);
      check(m.track && Math.abs(off) <= 1, `${tag}: the bar's centre is ${off?.toFixed(1)}px off the vitals'`);
      check(m.track && Math.abs(m.track.h - 20) <= 0.5 && m.row && m.track.h <= m.row.h + 0.5, `${tag}: the bar is ${m.track?.h}px, not the vitals' 20 inside the row`);
      check(m.level && m.track && m.level.r <= m.track.x, `${tag}: the level's box overlaps the bar`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  await vite?.close();
  await unlink(join(ROOT, `tools/${PAGE_NAME}`)).catch(() => {});
}
console.log(`\n${checks - fails.length}/${checks} checks${fails.length ? ':' : ''}`);
for (const f of fails) console.log(`  FAIL ${f}`);
console.log(`shots in ${OUT}`);
process.exitCode = fails.length ? 1 : 0;
