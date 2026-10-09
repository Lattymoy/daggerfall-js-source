// LOOT-BANNER, SEEN (2026-10-09, Mac: "something akin to a destiny loot popup notification") - the banners drawn in a real
// browser over the real enhanced HUD, beside a real notice toast at the right edge, and photographed.
//
// The suite holds the banners' LAW (what arrives, what stands, how long) and their DOM's shape (test/lootbanner.test.js);
// what it cannot hold is whether a banner reads at the edge of a screen, whether each tier's colour reads over the veil,
// whether a big one stands out from the rest, and whether the stack steps under the notices and stays on a phone's screen.
// Those are things about pixels, so the page builds every surface through its real entry - `drawLootBanners` with a
// player entity (what drawHud hands it), `drawEnhancedHud`, `drawEnhancedToasts` - the pieces minted by the game's own
// producers, and the probe measures the rectangles as well as photographing them.
//
// THE ICONS ARE STAND-INS (tools/pickupFeedProbe.mjs's reason: no ARENA2 here). A card's picture is the real painted face.
//
// IT RUNS ON VITE'S OWN DEV SERVER (the pickup feed probe's pattern).
//
//     node tools/lootBannerProbe.mjs                  -> shots (tools/shots/, or SHOT_DIR) and a report
import { mkdirSync } from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const PAGE_NAME = 'lootbanner.tmp.html';
const OUT = process.env.SHOT_DIR ?? join(ROOT, 'tools/shots');

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>LOOT-BANNER probe</title>
<style>
 html,body{margin:0;height:100%;overflow:hidden;background:#1b1a17}
 .world{position:fixed;inset:0;background:
   radial-gradient(ellipse 26% 20% at 82% 62%, rgba(226,220,200,0.8), transparent 70%),
   linear-gradient(180deg,#3e4a5c 0%,#6b6f73 46%,#4a4436 52%,#3a3428 100%)}
</style></head><body>
<div class="world"></div>
<script type="module">
import { drawEnhancedHud } from '/src/ui/enhancedHud.js';
import { drawEnhancedToasts } from '/src/ui/enhancedNotice.js';
import { drawLootBanners, clearLootBanners, _setLootBannerForTests } from '/src/ui/lootBanner.js';
import { setPref } from '/src/systems/uiPrefs.js';
import * as LR from '/src/systems/lootRarity.js';
import { createWeapon } from '/src/combat/enemyEquipment.js';
import { mintAetheric, AETHERIC_RECORDS } from '/src/systems/aetheric.js';
import { mintHourlock } from '/src/systems/gilded.js';
import { mintIliacCard } from '/src/systems/iliacItems.js';
import { ILIAC_CARDS } from '/src/net/iliacCards.js';
import { addItem } from '/src/systems/inventory.js';

setPref('lootRarity', true);
setPref('soundEnhancements', false);
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const known = (it) => Object.assign(it, { isIdentified: true });
const tiered = (tier, tpl = 113, seed = 2) => known(LR.applyRarity(createWeapon(tpl, 1), tier, lcg(seed)));
const legend = (id) => { const rec = LR.legendaryById(id); return known(LR.applyRarity(createWeapon(rec.templates?.[0] ?? 113, 1), 'legendary', lcg(1), [rec])); };
const cardOf = (tier) => ILIAC_CARDS.find((c) => c.tier === tier).id;
let e = null;
let notice = false;
const fresh = () => ({ name: 'Aelwyn', isPlayer: true, chargenDone: true, career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48, willpower: 50, intelligence: 50 },
  health: 30, maxHealth: 40, fatigue: 150, maxFatigue: 200, magicka: 14, maxMagicka: 20, items: [], wagonItems: [], bagItems: [], spells: [] });
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, Math.max(0, ((now ?? performance.now()) - last) / 1000));
  last = now ?? performance.now();
  if (e) {
    drawEnhancedHud(e, 0.25, dt, {});
    drawEnhancedToasts({ rows: notice ? ['Your Long Blade skill has increased.', 'You feel rested.'] : [], ids: notice ? [1, 2] : [], visible: true }, document, 'probe');
    drawLootBanners({ entity: e, dt });
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// stand-in icons: a sword's pixels at the banner's box
const swordPic = (() => {
  const rows = ['........ww', '.......wlw', '......wlw.', '.....wlw..', '....wlw...', '.g.wlw....', '..ggw.....', '..bgg.....', '.bb..g....', 'bb........'];
  const PAL = { w: '#e8ecef', l: '#a9b4bd', g: '#d9a83a', b: '#6b4423' };
  const cv = document.createElement('canvas'); cv.width = 40; cv.height = 40;
  const g = cv.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (PAL[ch]) { g.fillStyle = PAL[ch]; g.fillRect(x * 4, y * 4, 4, 4); } }));
  return cv.toDataURL('image/png');
})();
_setLootBannerForTests({ icon: (image, box) => ({ src: swordPic, w: box, h: box, smooth: false }), play: () => {} });

const SCENES = {
  // three tiers at once, beside two notices: the stack steps under them
  mixed: () => { notice = true; return [tiered('rare', 113, 3), Object.assign(legend('wyrmbane'), { exalted: true }), ...[mintIliacCard(cardOf('legendary'), 2)]]; },
  // the top tiers: big banners
  big: () => { notice = false; return [mintAetheric(AETHERIC_RECORDS[0]), mintHourlock(), Object.assign(tiered('rare', 120, 5), { artifact: true, name: 'Mace of Molag Bal' })]; },
  // a burst: three stand, the best first, the rest wait
  burst: () => { notice = false; return [tiered('rare', 113, 7), tiered('rare', 120, 8), legend('graveward'), mintIliacCard(cardOf('rare'), 1), mintIliacCard(cardOf('aetheric'), 1), tiered('legendary', 121, 9)]; },
};
globalThis.__scene = async (name) => {
  clearLootBanners();
  e = fresh();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));   // the first frames: a baseline
  for (const it of SCENES[name]()) addItem(e.items, it);
};
globalThis.__measure = () => {
  const r = (n) => { if (!n) return null; const b = n.getBoundingClientRect(); return b.height > 0 ? { x: b.left, y: b.top, r: b.right, b: b.bottom, h: b.height, w: b.width } : null; };
  const banners = [...document.querySelectorAll('.lootbanner')].filter((n) => !n.classList.contains('lb-over')).map((n) => ({ ...r(n), tier: n.dataset.rarity, big: n.classList.contains('lb-big'),
    kicker: n.querySelector('.lb-kicker')?.textContent, name: n.querySelector('.lb-name')?.textContent, nameColour: getComputedStyle(n.querySelector('.lb-name')).color,
    scrollW: n.scrollWidth, clientW: n.clientWidth }));
  const notices = [...document.querySelectorAll('.notice-stack')].map(r).filter(Boolean);
  return { vw: innerWidth, vh: innerHeight, banners, notice: notices[0] ?? null, font: getComputedStyle(document.querySelector('.lootbanner') ?? document.body).fontFamily,
    hudBottom: r(document.querySelector('.hud .hud-bottom')) };
};
globalThis.__ready = true;
</script></body></html>`;

const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, dsf: 1 },
  { name: 'laptop', viewport: { width: 1024, height: 700 }, dsf: 1 },
  { name: 'phone', viewport: { width: 390, height: 844 }, dsf: 2 },
];
const SCENE_NAMES = ['mixed', 'big', 'burst'];

mkdirSync(OUT, { recursive: true });
const vite = await createServer({ root: ROOT, server: { port: 0, host: '127.0.0.1', watch: null }, logLevel: 'error' });
await vite.listen();
const port = vite.httpServer.address().port;
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const fails = [];
let checks = 0;
const check = (ok, what) => { checks++; if (!ok) fails.push(what); };
const overlaps = (a, b) => !!a && !!b && a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;
try {
  await writeFile(join(ROOT, `tools/${PAGE_NAME}`), PAGE);
  for (const v of VIEWS) {
    const ctx = await browser.newContext({ viewport: v.viewport, deviceScaleFactor: v.dsf });
    const page = await ctx.newPage();
    page.on('pageerror', (err) => fails.push(`${v.name}: page error ${err.message}`));
    await page.goto(`http://127.0.0.1:${port}/tools/${PAGE_NAME}?skin=enhanced&touch=off&nofonts`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => globalThis.__ready === true, null, { timeout: 90000 });
    for (const s of SCENE_NAMES) {
      await page.evaluate((n) => globalThis.__scene(n), s);
      await page.waitForTimeout(1300);   // landed, the sweep run
      const m = await page.evaluate(() => globalThis.__measure());
      const tag = `${v.name}/${s}`;
      const file = join(OUT, `lootbanner-${v.name}-${s}.png`);
      await page.screenshot({ path: file });
      console.log(`${tag.padEnd(16)} ${m.banners.map((b) => `[${b.kicker} | ${b.name}${b.big ? ' BIG' : ''}]`).join(' ')}  notice ${m.notice ? `${m.notice.y.toFixed(0)}-${m.notice.b.toFixed(0)}` : '-'}  -> ${file}`);
      check(m.banners.length > 0, `${tag}: no banner drawn`);
      check(m.banners.length <= 3, `${tag}: more than three stand`);
      for (const b of m.banners) {
        check(b.x >= 0 && b.r <= m.vw + 0.5 && b.b <= m.vh, `${tag}: [${b.name}] runs off the screen`);
        check(m.vw - b.r < 40, `${tag}: [${b.name}] is not at the right edge (${(m.vw - b.r).toFixed(0)}px in)`);
        check(!overlaps(b, m.notice), `${tag}: [${b.name}] overlaps the notices`);
        check(b.scrollW <= b.clientW + 1, `${tag}: [${b.name}] scrolls sideways`);
        check(b.nameColour !== 'rgb(233, 228, 217)', `${tag}: [${b.name}] name wears no tier colour`);
        check(b.big === ['aetheric', 'artifact', 'gilded'].includes(b.tier), `${tag}: [${b.name}] big is ${b.big} for ${b.tier}`);
      }
      if (s === 'burst') check(m.banners[m.banners.length - 1]?.tier === 'aetheric' || m.banners.some((b) => b.tier === 'aetheric'), `${tag}: the best tier did not stand first`);
      if (s === 'big') {
        const big = m.banners.filter((b) => b.big), small = m.banners.filter((b) => !b.big);
        if (big.length && small.length) check(Math.min(...big.map((b) => b.h)) > Math.max(...small.map((b) => b.h)), `${tag}: a big banner is not taller`);
      }
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  await vite.close();
  await unlink(join(ROOT, `tools/${PAGE_NAME}`)).catch(() => {});
}
console.log(`\n${checks - fails.length}/${checks} checks${fails.length ? ':' : ''}`);
for (const f of fails) console.log(`  FAIL ${f}`);
process.exitCode = fails.length ? 1 : 0;
