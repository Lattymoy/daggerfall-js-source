// PICKUP-FEED, SEEN (2026-10-01, Mac: "a better center screen notification for pickups") - the take's cards drawn in a
// real browser over the real sheets, beside the real plaque under a crosshair and the real enhanced HUD, and
// photographed.
//
// The suite holds the feed's LAW (the bump, the cap, the fade, the line said or not) and its DOM's shape; what it cannot
// hold is whether the cards read at the centre of a screen, whether a tier's colour reads over the veil, and whether
// the stack stands clear of the plaque it hangs under, the mid-screen line a refusal is said on, and the HUD's own
// bottom block. Those are things about pixels, so the page builds every surface through its real entry -
// `showPickups` (what the four hosts hand the take as `took`), `showWorldPlaque`, `drawEnhancedMidText`,
// `drawEnhancedHud` - and the probe measures the rectangles as well as photographing them.
//
// THE ICONS ARE STAND-INS. This container has no ARENA2, so the cached icon door (textureCanvas.requestFittedIcon) has
// no archive to read; the page hands the feed's icon seam small pixel pictures of its own so the card's picture slot is
// seen at its real size. The address the real door is asked for is the pack's own (inventoryItemImage) and is pinned in
// test/pickupfeed.test.js.
//
// HAUL-CARDS (2026-10-03): four scenes more - a vein's card bumped and its gem, a raid's three silver cards, the day's
// cap beside a pickup, a Motherlode's one card - built from answers through ui/haulCards.js and drawn by `showHaul`,
// held to the same checks (no card over the plaque, the mid-screen line, the HUD's foot, or above the crosshair).
//
// IT RUNS ON VITE'S OWN DEV SERVER (tools/renownBarProbe.mjs's pattern). Web fonts come through the session's proxy
// when one is set (the pixel face is what the cards are measured in); NOFONTS=1 measures the fallback face.
//
//     node tools/pickupFeedProbe.mjs                  -> shots (tools/shots/, or SHOT_DIR) and a report
//     SHOT_DIR=/tmp/x node tools/pickupFeedProbe.mjs
import { mkdirSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const PAGE_NAME = 'pickupfeed.tmp.html';
const OUT = process.env.SHOT_DIR ?? join(ROOT, 'tools/shots');

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PICKUP-FEED probe</title>
<style>
 html,body{margin:0;height:100%;overflow:hidden;background:#1b1a17}
 /* a stand-in for the world: a dusk sky over a road, with a pale patch (snow, sand, a lit wall) so a card's contrast is
    seen over light as well as dark */
 .world{position:fixed;inset:0;background:
   radial-gradient(ellipse 30% 18% at 70% 78%, rgba(226,220,200,0.85), transparent 70%),
   linear-gradient(180deg,#3e4a5c 0%,#6b6f73 46%,#4a4436 52%,#3a3428 100%)}
 .cross{position:fixed;left:50%;width:2px;height:16px;margin:-8px 0 0 -1px;background:#dcd1ad;opacity:.85;z-index:3}
 .cross.h{width:16px;height:2px;margin:-1px 0 0 -8px}
</style></head><body>
<div class="world"></div><div class="cross" id="cv"></div><div class="cross h" id="ch"></div>
<script type="module">
import { drawEnhancedHud } from '/src/ui/enhancedHud.js';
import { showWorldPlaque, destroyWorldPlaque, plaqueAnchor } from '/src/ui/worldPlaque.js';
import { hoverLines } from '/src/systems/worldHover.js';
import { foldQuickLoot, resetQuickLoot, quickLootWheel } from '/src/systems/quickLoot.js';
import { setPref } from '/src/systems/uiPrefs.js';
import { LOOT_RARITY_KEY } from '/src/systems/lootRarity.js';
import { GOLD_TEMPLATE } from '/src/systems/inventory.js';
import { showPickups, showHaul, destroyPickupFeed, _setPickupFeedForTests } from '/src/ui/pickupFeed.js';
import { harvestHauls, claimHauls } from '/src/ui/haulCards.js';   // HAUL-CARDS: a gather's, a strike's and a claim's cards
import { drawEnhancedMidText, midTextTopPx } from '/src/ui/enhancedHudText.js';
import { crosshairCentreY } from '/src/ui/hudCrosshair.js';

setPref('quickLoot', true);
setPref(LOOT_RARITY_KEY, true);
const e = { name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48, willpower: 50, intelligence: 50 },
  health: 30, maxHealth: 40, fatigue: 150, maxFatigue: 200, magicka: 14, maxMagicka: 20, items: [], spells: [] };
// the host's frame: the HUD, and the plaque redrawn every frame as a host's worldHoverFrame redraws it (a plaque left
// undrawn is taken down by its own watchdog - the law the feed's watchdog copies)
let plaqueFrame = null;
function frame() {
  drawEnhancedHud(e, 0.25, 1 / 60, {});
  if (plaqueFrame) showWorldPlaque(plaqueFrame, plaqueAnchor(canvasLike()));
  requestAnimationFrame(frame);
}
frame();

// ── stand-in icons: 10x10 pictures drawn at 2x (a real icon is the pack's fitted picture, at the same 20px box) ──
const PAL = { w: '#e8ecef', l: '#a9b4bd', g: '#d9a83a', b: '#6b4423', y: '#f2c94c', Y: '#fff1a8', r: '#c0392b', R: '#ff8a7a',
  c: '#cfd8dc', P: '#7d3cc8', p: '#c9a2ff', f: '#9a9079', s: '#8b6a3e', h: '#e0e0e0', k: '#3a3a3a', m: '#b0b8c0', o: '#d07a2e' };
const GLYPHS = {
  sword: ['........ww', '.......wlw', '......wlw.', '.....wlw..', '....wlw...', '.g.wlw....', '..ggw.....', '..bgg.....', '.bb..g....', 'bb........'],
  dagger: ['..........', '.......ww.', '......wlw.', '.....wlw..', '....wlw...', '..g.ww....', '...gg.....', '..bbg.....', '.bb.......', '..........'],
  gold: ['..........', '...yyyy...', '..yYYYYy..', '..yyyyyy..', '.yyyyyyyy.', 'yYYyyYYyyy', 'yyyyyyyyyy', '.yyyyyyyy.', '..........', '..........'],
  ring: ['....RR....', '...RrrR...', '....gg....', '..gg..gg..', '.g......g.', '.g......g.', '.g......g.', '..gg..gg..', '....gg....', '..........'],
  potion: ['....ss....', '....cc....', '...c..c...', '..c....c..', '.cPPPPPPc.', '.cPpPPPPc.', '.cPPPPPPc.', '.cPPPPPPc.', '..cccccc..', '..........'],
  arrow: ['.........f', '........ff', '.......s..', '......s...', '.....s....', '....s.....', '...s......', '.hs.......', 'hh........', 'h.........'],
  helm: ['..........', '...mmmm...', '..mllllm..', '.mlllllm..', '.mlkkklm..', '.mlk.klm..', '.mm...mm..', '.m.....m..', '..........', '..........'],
  axe: ['....oo....', '...oooo...', '...ooob...', '....oob...', '......b...', '......b...', '......b...', '......b...', '......b...', '..........'],
  // HAUL-CARDS: an ore's lump and a gem's facet
  ore: ['..........', '...mmm....', '..mllmm...', '.mlkklmm..', '.mllkkmm..', '.mmllkkm..', '..mmlllm..', '...mmmm...', '..........', '..........'],
  gem: ['..........', '....oo....', '...oYYo...', '..oYYYYo..', '..oyYYyo..', '...oyyo...', '....oo....', '..........', '..........', '..........'],
};
const kindOf = (name) => (/^ore:|^metal:/.test(name) ? 'ore' : /^gem:/.test(name) ? 'gem' : /gold/i.test(name) ? 'gold' : /ring|amulet|star/i.test(name) ? 'ring' : /potion|elixir/i.test(name) ? 'potion'
  : /arrow/i.test(name) ? 'arrow' : /dagger|tanto/i.test(name) ? 'dagger' : /helm/i.test(name) ? 'helm' : /axe|cleaver/i.test(name) ? 'axe' : 'sword');
const pics = new Map();
function pictureOf(kind) {
  if (pics.has(kind)) return pics.get(kind);
  const cv = document.createElement('canvas');
  cv.width = 20; cv.height = 20;
  const g = cv.getContext('2d');
  GLYPHS[kind].forEach((row, y) => [...row].forEach((ch, x) => { if (PAL[ch]) { g.fillStyle = PAL[ch]; g.fillRect(x * 2, y * 2, 2, 2); } }));
  const pic = { src: cv.toDataURL('image/png'), w: 20, h: 20, smooth: false };
  pics.set(kind, pic);
  return pic;
}
globalThis.__t = 0;
_setPickupFeedForTests({ now: () => globalThis.__t, icon: (line) => (line.image ? pictureOf(kindOf(line.material ?? line.name)) : null) });

// ── the things a player takes ──
const W = (name, extra = {}) => ({ name, group: 'Weapons', templateIndex: 121, material: 0, identified: true, maxCondition: 100, currentCondition: 90, ...extra });
const gold = (n) => ({ name: 'Gold', group: 'Currency', templateIndex: GOLD_TEMPLATE, stackCount: n });
const ITEMS = {
  longsword: W('Longsword', { templateIndex: 115 }),
  arrows: { name: 'Arrow', group: 'Weapons', templateIndex: 131, stackCount: 24, maxCondition: 1, currentCondition: 1 },
  bread: { name: 'Bread', group: 'UselessItems2', templateIndex: 534, maxCondition: 100, currentCondition: 100 },
  dagger: W('Dagger of Embers', { templateIndex: 113, rarity: 'magic', magic: true }),
  katana: W('Stormcaller Katana', { rarity: 'rare' }),
  axe: W('Ruhn\\'s Gatecleaver', { templateIndex: 123, rarity: 'legendary', legendary: true }),
  ring: { name: 'Ring of Namira', group: 'Jewellery', templateIndex: 133, artifact: true, identified: true },
  helm: { name: 'Helm', group: 'Armor', templateIndex: 102, material: 0x0200, identified: true, maxCondition: 100, currentCondition: 70 },
  potion: { name: 'Potion', group: 'UselessItems1', templateIndex: 78, identified: true },
};
const take = (...rows) => showPickups(rows.map(([it, n]) => ({ item: it, count: n ?? it.stackCount ?? 1 })), e);

function canvasLike() { const d = devicePixelRatio || 1; return { width: Math.round(innerWidth * d), height: Math.round(innerHeight * d), clientWidth: innerWidth }; }
function stand(items, { lit = -1, title = 'Loot Pile' } = {}) {
  const { shown, rest, empty } = hoverLines(items);
  const f = { key: 'loot:probe', kind: 'items', title, subs: [], rows: shown, rest, empty };
  foldQuickLoot(f);
  for (let i = 0; i < lit; i++) { quickLootWheel(120); foldQuickLoot(f); }
  plaqueFrame = f;
  showWorldPlaque(f, plaqueAnchor(canvasLike()));
}
function cross() {
  const y = crosshairCentreY(innerHeight) + 'px';
  document.getElementById('cv').style.top = y; document.getElementById('ch').style.top = y;
}
const frames = (n = 2) => new Promise((res) => { const go = (k) => (k ? requestAnimationFrame(() => go(k - 1)) : res()); go(n); });

const SCENES = {
  // one row taken off a pile, the pile's plaque still listing what is left
  async one() { stand([ITEMS.arrows, ITEMS.bread, ITEMS.helm], { lit: 0 }); take([ITEMS.longsword]); },
  // the same sword three times inside the window, and a stack of arrows: one card each, counted
  async bump() {
    stand([ITEMS.bread, ITEMS.helm], { lit: 0 });
    take([ITEMS.arrows]); globalThis.__t = 300; take([ITEMS.longsword]); globalThis.__t = 900; take([ITEMS.longsword]);
    globalThis.__t = 1500; take([ITEMS.longsword]);
  },
  // a take-all of four tiers: the plaque says Empty, the four cards say what went
  async four() { stand([], { title: 'Skeletal Warrior (dead)' }); take([ITEMS.dagger], [ITEMS.katana], [ITEMS.axe], [ITEMS.ring]); },
  // gold: "+N Gold", bumped by a second purse inside the window; an item beside it
  async gold() {
    stand([ITEMS.bread], { lit: 0 });
    take([ITEMS.potion]); globalThis.__t = 400; take([gold(120), 120]); globalThis.__t = 1100; take([gold(80), 80]);
  },
  // a take-all that took two rows and refused the third: the cards AND the refusal on the mid-screen line
  async refusal() {
    stand([ITEMS.helm], { lit: 0 });
    take([ITEMS.longsword], [gold(35), 35]);
    drawEnhancedMidText({ text: 'You cannot carry any more stuff.', visible: true, top: midTextTopPx(canvasLike(), 146) });
  },
  // a tall plaque (six rows, the lit row's stats beside it) - the feed stands BELOW it, not over it
  async tall() {
    stand([ITEMS.helm, ITEMS.arrows, ITEMS.bread, ITEMS.potion, W('Claymore', { templateIndex: 117 }), W('Mace', { templateIndex: 125 }), W('Staff', { templateIndex: 126 })], { lit: 1 });
    take([ITEMS.dagger]); globalThis.__t = 200; take([ITEMS.longsword]); globalThis.__t = 400; take([gold(12), 12]);
  },
  // HAUL-CARDS: a vein struck clean - its ore, its Stores and its XP one card, a gem under it; then the same vein's ore
  // again inside the window, bumped (the counts add, the Stores and the bar the newest's)
  async haul() {
    const vein = (qty, held, xp) => ({ material: 'metal:iron', qty, xp, track: { profession: 'mining', xp, rank: 34 }, store: { own: held } });
    showHaul(harvestHauls({ ...vein(3, 41, 12000), xp: 60, gem: 'gem:amber' }, { note: ' (every strike on the glint)' }));
    globalThis.__t = 700; showHaul(harvestHauls({ ...vein(2, 43, 12080), xp: 40 }));
  },
  // HAUL-CARDS: a raid counted - its silver (the day's combat bar), the guild's deed (to its treasury), a contract's pay
  async silver() {
    showHaul(claimHauls({ marks: { struck: 30, balance: 90, combat: { earned: 120, max: 150 } }, deed: { struck: 25, guild: { name: 'The HND Guild', tag: 'HND' } },
      contracts: [{ contract: 'c1', pay: 38, tax: 2, guild: { name: 'The HND Guild', tag: 'HND' } }] }, 'raid'));
  },
  // HAUL-CARDS: a gate at the day's cap - its muted card - beside a pickup's
  async capped() {
    stand([ITEMS.bread], { lit: 0 });
    take([ITEMS.longsword]); globalThis.__t = 300;
    showHaul(claimHauls({ marks: { struck: 0, balance: 150, why: 'cap', combat: { earned: 150, max: 150 } } }, 'gate'));
  },
  // HAUL-CARDS: a Motherlode struck - the day's one card, its ore, its silver and its twenty
  async lode() {
    showHaul(harvestHauls({ motherlode: true, node: 'mlode:20833:0', material: 'ore:ebony', qty: 9, xp: 1380, track: { profession: 'mining', xp: 13100, rank: 36 },
      store: { own: 9 }, marks: { struck: 10, balance: 60 }, lode: { struck: 4, strikers: 20 } }, { note: ' (every strike on the glint)' }));
  },
  // the fade: two cards, the older past its hold
  // (the entrance runs its course first - in play a card is 2.5 s old before it fades, never mid-entrance)
  async fade() {
    stand([ITEMS.bread], { lit: 0 }); take([ITEMS.katana]); globalThis.__t = 1800; take([ITEMS.longsword]);
    await frames(16); globalThis.__t = 2700;
  },
};
globalThis.__scene = async (name) => {
  plaqueFrame = null; destroyPickupFeed(); destroyWorldPlaque(); resetQuickLoot(); drawEnhancedMidText({ text: '', visible: false });
  globalThis.__t = 0; cross();
  await SCENES[name]();
  await frames(3);
};
const box = (n) => { if (!n) return null; const r = n.getBoundingClientRect(); return r.width || r.height ? { x: r.x, y: r.y, w: r.width, h: r.height, b: r.bottom, r: r.right } : null; };
const shown = (n) => !!n && getComputedStyle(n).display !== 'none';
globalThis.__measure = () => {
  const plaque = document.querySelector('.wplaque.on');
  const mid = document.getElementById('enhanced-midtext');
  return {
    vw: innerWidth, vh: innerHeight, crossY: crosshairCentreY(innerHeight), midLine: midTextTopPx(canvasLike(), 146),
    plaque: box(plaque), stats: box(plaque?.querySelector('.wplaque-stats')),
    mid: shown(mid) && mid.textContent ? box(mid) : null,
    feed: box(document.querySelector('.pickfeed')),
    cards: [...document.querySelectorAll('.pickfeed-card:not(.pf-over)')].map((c) => ({ ...box(c), text: c.textContent, rarity: c.dataset.rarity ?? null,
      colour: c.querySelector('.pickfeed-name') ? getComputedStyle(c.querySelector('.pickfeed-name')).color : null, fading: c.classList.contains('fading') })),   // HAUL-CARDS: a muted card has no name
    hudBottom: box(document.querySelector('.hud-bottom')),
    font: getComputedStyle(document.querySelector('.pickfeed-card') ?? document.body).fontFamily,
  };
};
globalThis.__ready = true;
</script></body></html>`;

const VIEWS = [
  { name: 'desktop', viewport: { width: 1280, height: 800 }, dsf: 1 },
  { name: 'phone', viewport: { width: 390, height: 844 }, dsf: 2 },
];
const SCENE_NAMES = ['one', 'bump', 'four', 'gold', 'refusal', 'tall', 'fade', 'haul', 'silver', 'capped', 'lode'];   // HAUL-CARDS: the last four

mkdirSync(OUT, { recursive: true });
const vite = process.env.PROBE_PORT ? null : await createServer({ root: ROOT, server: { port: 0, host: '127.0.0.1', watch: null }, logLevel: 'error' });
if (vite) await vite.listen();
const port = vite ? vite.httpServer.address().port : Number(process.env.PROBE_PORT);
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
/** The web fonts, fetched by curl (which reads the session's HTTPS_PROXY and its CA, where the browser's own stack may
 *  not) and handed to the page - so the cards are measured in the face they are drawn in. */
const fetched = new Map();
const curl = (url) => {
  if (!fetched.has(url)) {
    fetched.set(url, new Promise((res) => execFile('curl', ['-sS', '-A', 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120', url],
      { encoding: 'buffer', maxBuffer: 8 << 20 }, (err, out) => res(err ? null : out))));
  }
  return fetched.get(url);
};
async function serveFonts(page) {
  if (process.env.NOFONTS) return;
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, async (route) => {
    const url = route.request().url();
    const body = await curl(url);
    if (!body) return route.abort();
    const type = url.includes('googleapis') ? 'text/css' : url.endsWith('.ttf') ? 'font/ttf' : 'font/woff2';
    return route.fulfill({ status: 200, contentType: type, body, headers: { 'access-control-allow-origin': '*' } });
  });
}
const fails = [];
let checks = 0;
const check = (ok, what) => { checks++; if (!ok) fails.push(what); };
const overlaps = (a, b) => !!a && !!b && a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;
try {
  await writeFile(join(ROOT, `tools/${PAGE_NAME}`), PAGE);
  for (const v of VIEWS) {
    const ctx = await browser.newContext({ viewport: v.viewport, deviceScaleFactor: v.dsf });
    const page = await ctx.newPage();
    await serveFonts(page);
    page.on('pageerror', (err) => fails.push(`${v.name}: page error ${err.message}`));
    page.on('console', (m) => { if (m.type() === 'error') console.error(`${v.name} PAGE`, m.text().slice(0, 200)); });
    await page.goto(`http://127.0.0.1:${port}/tools/${PAGE_NAME}?skin=enhanced&touch=off${process.env.NOFONTS ? '&nofonts' : ''}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => globalThis.__ready === true, null, { timeout: 90000 });
    await page.evaluate(async () => { await globalThis.__scene('one'); await document.fonts.ready; });
    for (const s of SCENE_NAMES) {
      await page.evaluate((n) => globalThis.__scene(n), s);
      await page.waitForTimeout(s === 'fade' ? 120 : 450);   // the entrance and a bump's pop run their course (the fade is caught part-way)
      const m = await page.evaluate(() => globalThis.__measure());
      const tag = `${v.name}/${s}`;
      const file = join(OUT, `pickupfeed-${v.name}-${s}.png`);
      await page.screenshot({ path: file });
      console.log(`${tag.padEnd(16)} ${m.cards.map((c) => `[${c.text}${c.rarity ? ` ${c.rarity}` : ''}${c.fading ? ' fading' : ''}]`).join(' ')}`
        + `  feed top ${m.feed ? m.feed.y.toFixed(0) : '-'} | plaque ${m.plaque ? `${m.plaque.y.toFixed(0)}-${m.plaque.b.toFixed(0)}` : '-'}`
        + ` | mid ${m.mid ? `${m.mid.y.toFixed(0)}-${m.mid.b.toFixed(0)}` : '-'} | hud-bottom ${m.hudBottom ? m.hudBottom.y.toFixed(0) : '-'}  -> ${file}`);
      check(m.cards.length > 0, `${tag}: no card drawn`);
      check(!m.cards.length || /Pixelify/.test(m.font), `${tag}: the cards are not in the pixel face (${m.font})`);
      for (const c of m.cards) {
        check(c.x >= 0 && c.r <= m.vw && c.b <= m.vh, `${tag}: [${c.text}] runs off the screen`);
        check(!overlaps(c, m.plaque), `${tag}: [${c.text}] overlaps the plaque`);
        check(!overlaps(c, m.stats), `${tag}: [${c.text}] overlaps the plaque's stat panel`);
        check(!overlaps(c, m.mid), `${tag}: [${c.text}] overlaps the mid-screen line`);
        check(!overlaps(c, m.hudBottom), `${tag}: [${c.text}] overlaps the HUD's bottom block`);
        check(c.y > m.crossY, `${tag}: [${c.text}] stands above the crosshair`);
      }
      // with room under the line, the feed stands ON it (the classic label's own top edge)
      const room = m.hudBottom ? m.hudBottom.y - m.midLine : m.vh - m.midLine;
      if (m.feed && !m.plaque && !m.mid && m.feed.h + 16 <= room) check(Math.abs(m.feed.y - m.midLine) < 1.5, `${tag}: the feed is not on the mid-screen line (${m.feed.y.toFixed(1)} vs ${m.midLine.toFixed(1)})`);
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
