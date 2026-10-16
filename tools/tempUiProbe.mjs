// TEMP-UI (2026-10-12, the owner: "add a tempurature widget to the UI") - THE TEMPERATURE PLATE, DRAWN AND MEASURED.
//
// The REAL HUD (ui/enhanced/enhancedHud.js over the real sheets, the enhanced skin) under a character reading freezing, then
// comfortable, then scorching, beside the quest card (.qtrack, the right edge 92px down), a foe's bar under the compass
// and the status widget at the left edge - at a desktop, two laptops, HUD scales 1.5 and 2, and a phone both ways up -
// in Enhanced Plus and in the DFO Grimoire dress. For each it reads:
//   - THE PLATE STANDS: shown, wholly on the screen, (UI-CALM) in the bottom-left corner - the quick block's caption;
//   - NOTHING MET: it meets none of the quest card, the foe's bar, the status widget or the compass's own strip;
//   - IT SAYS IT: the number and the word the reading has (the phone the number alone, and a screen where the whole
//     plate would run off the edge - a large HUD scale - steps down to it, while a desktop at its own scale never
//     does), its glyph loaded, the mark inside its scale where the reading stands;
// and photographs each (the whole screen, and the plate close up).
//
// IT RUNS ON VITE'S OWN DEV SERVER and needs NO game data: nothing on the plate is drawn from ARENA2.
//
//     node tools/tempUiProbe.mjs                    -> shots (tools/shots/, or SHOT_DIR) and a report
//     PROBE_PORT=<n> node tools/tempUiProbe.mjs     -> reuse a dev server already listening there
import { mkdirSync } from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const PAGE_NAME = 'tempui.tmp.html';
const OUT = process.env.SHOT_DIR ?? join(ROOT, 'tools/shots');

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>TEMP-UI probe</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:repeating-linear-gradient(45deg,#3b4a3a 0 14px,#324031 14px 28px)}</style></head><body>
<script type="module">
import { setPref } from '/src/systems/uiPrefs.js';
import { drawEnhancedHud } from '/src/ui/enhanced/enhancedHud.js';
import { survivalOf } from '/src/systems/survival/needs.js';
import { worldMinutes } from '/src/systems/worldTick.js';
const q = new URLSearchParams(location.search);
setPref('survival', 'casual');
if (q.get('dress') === 'grimoire') { setPref('plusDress', 'grimoire'); document.documentElement.dataset.plusDress = 'grimoire'; }
const e = { isPlayer: true, name: 'Aelwyn', level: 12, stats: { strength: 50, endurance: 48, willpower: 50, intelligence: 50, agility: 50, speed: 50, personality: 50, luck: 50 },
  health: 70, maxHealth: 100, fatigue: 150, maxFatigue: 200, magicka: 14, maxMagicka: 20, items: [], spells: [], activeEffects: [] };
const now = Math.floor(worldMinutes());
const s = survivalOf(e, now);
Object.assign(s, { lastAte: now - 800, thirst: 85, felt: -40 });
globalThis.__felt = (f) => { s.felt = f; };
// the quest card at its own place (ui/quest/questTracker.js - the sheet's .qtrack rule stands it), with a title and a line
const card = document.createElement('div'); card.className = 'qtrack';
card.innerHTML = '<div class="qtrack-title">The Lord\\u2019s Ransom</div><div class="qtrack-line">Find the courier at the Wayrest docks.</div>';
document.body.append(card);
let foe = q.has('foe');
function frame() { drawEnhancedHud(e, 0.25, 1 / 60, {}); if (foe) { const f = document.querySelector('.hud-foe'); f?.classList.add('on'); const n = document.querySelector('.hud-foename'); if (n) n.textContent = 'Orc Warlord'; } requestAnimationFrame(frame); }
frame();
const rect = (n) => { if (!n || !n.getClientRects().length || getComputedStyle(n).display === 'none') return null; const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; };
globalThis.__measure = () => {
  const p = document.querySelector('.hud-temp');
  const g = p?.querySelector('.hud-tempglyph');
  return {
    vw: innerWidth, vh: innerHeight, plate: rect(p), compass: rect(document.querySelector('.hud-compass')), strip: rect(document.querySelector('.hud-strip')),
    card: rect(card), foe: rect(document.querySelector('.hud-foe.on')), stat: rect(document.querySelector('.hud-stat')),
    num: p?.querySelector('.hud-tempnum')?.textContent ?? '', word: rect(p?.querySelector('.hud-tempword')) ? p.querySelector('.hud-tempword').textContent : null,
    glyph: !!g && g.complete && g.naturalWidth > 0, scale: rect(p?.querySelector('.hud-tempscale')), mark: rect(p?.querySelector('.hud-tempmark')),
    side: p?.dataset.side, level: p?.dataset.level, border: p ? getComputedStyle(p).borderTopColor : '', compact: !!p?.classList.contains('compact'),
  };
};
</script></body></html>`;

const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, dpr: 1 },
  { name: 'laptop-1280', viewport: { width: 1280, height: 800 }, dpr: 2 },
  { name: 'laptop-1024', viewport: { width: 1024, height: 768 }, dpr: 1 },
  { name: 'desktop-hud1.5', viewport: { width: 1440, height: 900 }, dpr: 1, scale: 1.5 },
  { name: 'desktop-hud2', viewport: { width: 1440, height: 900 }, dpr: 1, scale: 2 },
  { name: 'phone', viewport: { width: 390, height: 844 }, dpr: 3, isMobile: true, hasTouch: true },
  { name: 'phone-land', viewport: { width: 844, height: 390 }, dpr: 3, isMobile: true, hasTouch: true },
];
const READINGS = [[-40, 'Freezing', 'cold'], [4, 'Comfortable', 'mild'], [64, 'Scorching', 'hot']];
const meets = (a, b) => !!a && !!b && a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;

mkdirSync(OUT, { recursive: true });
const vite = process.env.PROBE_PORT ? null : await createServer({ root: ROOT, server: { port: 0, host: '127.0.0.1', watch: null }, logLevel: 'error' });
if (vite) await vite.listen();
const port = vite ? vite.httpServer.address().port : Number(process.env.PROBE_PORT);
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const fails = [];
let checks = 0;
const check = (ok, what) => { checks++; if (!ok) fails.push(what); };
const settle = (page) => page.evaluate(() => new Promise((res) => { let n = 0; const f = () => (++n > 20 ? res() : requestAnimationFrame(f)); f(); }));
try {
  await writeFile(join(ROOT, `tools/${PAGE_NAME}`), PAGE);
  for (const dress of ['plus', 'grimoire']) for (const v of VIEWS) for (const foe of [false, true]) {
    const ctx = await browser.newContext({ viewport: v.viewport, isMobile: !!v.isMobile, hasTouch: !!v.hasTouch, deviceScaleFactor: v.dpr });
    const page = await ctx.newPage();
    const tag0 = `${dress}/${v.name}${foe ? '/foe' : ''}`;
    page.on('pageerror', (err) => fails.push(`${tag0}: page error ${err.message}`));
    await page.goto(`http://127.0.0.1:${port}/tools/${PAGE_NAME}?skin=enhanced&dress=${dress}${foe ? '&foe' : ''}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => typeof globalThis.__measure === 'function' && document.querySelector('.hud-temp'), null, { timeout: 60000 });
    if (v.scale) await page.evaluate(async (sc) => { (await import('/src/systems/uiPrefs.js')).setPref('hudScale', sc); }, v.scale);
    for (const [felt, word, side] of READINGS) {
      await page.evaluate((f) => globalThis.__felt(f), felt);
      await settle(page);
      const m = await page.evaluate(() => globalThis.__measure());
      const tag = `${tag0} at ${felt}`;
      check(!!m.plate, `${tag}: the plate is not shown`);
      if (!m.plate) continue;
      check(m.plate.x >= 0 && m.plate.y >= 0 && m.plate.r <= m.vw + 0.5 && m.plate.b <= m.vh + 0.5, `${tag}: the plate runs off the screen (${JSON.stringify(m.plate)})`);
      // UI-CALM (2026-10-14): the plate stands in the BOTTOM-LEFT corner, the quick block's caption - no longer off the compass's end
      check(m.plate.x < m.vw / 2 && m.plate.y > m.vh / 2, `${tag}: the plate is not in the bottom-left corner (${JSON.stringify(m.plate)})`);
      check(!meets(m.plate, m.card), `${tag}: the plate meets the quest card`);
      check(!meets(m.plate, m.foe), `${tag}: the plate meets the foe's bar`);
      check(!meets(m.plate, m.stat), `${tag}: the plate meets the status widget`);
      check(!meets(m.plate, m.strip), `${tag}: the plate meets the compass strip`);
      check(m.num === `${felt > 0 ? '+' : felt < 0 ? '-' : ''}${Math.abs(felt)}°`, `${tag}: the number says "${m.num}"`);
      check(m.glyph, `${tag}: the glyph did not load`);
      check(m.side === side, `${tag}: the side is ${m.side}`);
      const phone = v.viewport.width <= 860;
      if (!phone && !v.scale) check(!m.compact, `${tag}: a desktop at its own scale stepped down to the compact plate`);
      if (phone || m.compact || word === 'Comfortable') check(m.word == null && !m.scale, `${tag}: a ${phone ? 'phone' : word === 'Comfortable' ? 'comfortable plate (UI-CALM)' : 'compact plate'} shows the word or the scale`);
      else {
        check(m.word === word, `${tag}: the word says "${m.word}"`);
        const at = Math.min(1, Math.max(0, (felt + 60) / 120));
        check(m.scale && m.mark && Math.abs((m.mark.x + m.mark.w / 2) - (m.scale.x + 1 + at * (m.scale.w - 2))) <= 2.5, `${tag}: the mark is not where the reading stands on the scale`);
      }
      if (felt === -40 && !foe) {
        await page.screenshot({ path: join(OUT, `tempui-${dress}-${v.name}.png`) });
        const pad = 16;
        const clip = { x: Math.max(0, m.plate.x - pad), y: Math.max(0, m.plate.y - pad) };
        clip.width = Math.min(m.vw - clip.x, m.plate.r - clip.x + pad);
        clip.height = Math.min(m.vh - clip.y, m.plate.b - clip.y + pad);
        await page.screenshot({ path: join(OUT, `tempui-${dress}-${v.name}-plate.png`), clip });
      }
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
