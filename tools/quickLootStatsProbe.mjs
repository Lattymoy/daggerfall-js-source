// QUICK-LOOT-STATS, SEEN - the plaque and its stat panel, drawn in a
// real browser against the real sheet, and photographed.
//
// A player asked for the stats "next to the quickloot window"; NEXT TO
// is a thing about pixels, and the suite can only tell you that the
// side was COMPUTED right, never that the panel reads as one surface
// with the list beside it. CHARGEN-REFLEX's own lesson, twice over: a
// harness that builds its own markup measures its own artefact, so
// this builds the plaque through `showWorldPlaque` itself - the same
// entry the four hosts call - over the real ENHANCED_CSS.
//
// IT PAID FOR ITSELF THE FIRST TIME IT RAN, twice, on things no pin in
// the suite could have failed on:
//
//   - a Condition reads "Slightly Used (75%)" and the panel is
//     deliberately narrow, so that row WRAPS - and the value was only
//     pushed right by an auto margin, so its second line sat hard
//     against the LABEL and read as a different row. It is
//     text-aligned right now, and both lines flush to the same edge as
//     every value above and below.
//   - the survival SENTENCE rows ("Nourishes for 180 minutes") inherited
//     that same right alignment and read as a value with no name. They
//     are left-aligned again, which is what the label-less class was
//     for in the first place.
//
// Both are true of the rendered box and of nothing else: the rows were
// right, the side was right, the markup was right.
//
//     node tools/quickLootStatsProbe.mjs            -> shots + a report
//     SHOT_DIR=/tmp/x node tools/quickLootStatsProbe.mjs
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENHANCED_CSS, ENHANCED_TOKENS } from '../src/ui/enhancedStyle.js';

const ROOT = normalize(join(fileURLToPath(import.meta.url), '..', '..'));
/** The page imports the REAL modules, so the plaque it draws is the
 *  plaque the hosts draw. Served off disk rather than through a dev
 *  server: no port, no second thing to be running. */
async function serveRepo(page) {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (process.env.TRACE) console.error('req', url.href);
    if (url.hostname !== 'probe.local') return route.continue();
    try {
      if (url.pathname === '/') return route.fulfill({ status: 200, contentType: 'text/html', body: PAGE });
      const body = readFileSync(join(ROOT, url.pathname.replace(/^\/+/, '')), 'utf8');
      // A wrong MIME is a module that will not load at all: the tree
      // imports JSON with an import attribute, and Chrome enforces the
      // type strictly for module scripts.
      const type = url.pathname.endsWith('.js') || url.pathname.endsWith('.mjs') ? 'text/javascript'
        : url.pathname.endsWith('.json') ? 'application/json'
        : url.pathname.endsWith('.css') ? 'text/css' : 'text/html';
      route.fulfill({ status: 200, contentType: type, body });
    } catch (e) { console.error('404', url.pathname); route.fulfill({ status: 404, body: 'no' }); }
  });
}

const OUT = process.env.SHOT_DIR ?? 'tools/shots';
mkdirSync(OUT, { recursive: true });

/** The pile a player would actually be looking at. */
const ITEMS = [
  { name: 'Dagger', group: 'Weapons', templateIndex: 121, material: 3, maxCondition: 200, currentCondition: 150 },
  { name: 'Cuirass', group: 'Armor', templateIndex: 103, material: 0x0202, maxCondition: 100, currentCondition: 62 },
  { name: 'Arrow', group: 'Weapons', templateIndex: 131, material: 0, stackCount: 24, maxCondition: 1, currentCondition: 1 },
  { name: 'Bread', group: 'UselessItems2', templateIndex: 534, maxCondition: 100, currentCondition: 100 },
];

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<style>${ENHANCED_TOKENS}${ENHANCED_CSS}
 html,body{margin:0;height:100%;background:#1b1a17;overflow:hidden}
 /* a flat stand-in for the world behind the plaque, so the box's own
    contrast is what the picture shows rather than a blank page's */
 .floor{position:fixed;inset:0;background:
   repeating-linear-gradient(45deg,#2a2721 0 14px,#231f1a 14px 28px)}
 .cross{position:fixed;left:50%;top:44%;width:2px;height:18px;margin-left:-1px;
   background:#d8cfae;opacity:.8}
 .cross.h{width:18px;height:2px;margin:-1px 0 0 -9px}
</style></head><body>
<div class="floor"></div><div class="cross"></div><div class="cross h"></div>
</body></html>`;

const b = await chromium.launch();
const shots = [];
for (const [W, H, label] of [[1280, 720, 'desktop'], [1024, 640, 'narrow'], [420, 780, 'phone']]) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') console.error('PAGE', m.text().slice(0, 200)); });
  p.on('pageerror', (e) => console.error('PAGEERR', String(e).slice(0, 300)));
  await serveRepo(p);
  await p.goto('http://probe.local/', { waitUntil: 'load' });

  // The rows and the highlight come from the REAL modules, and the
  // plaque is raised through the real seam.
  for (let row = 0; row < ITEMS.length; row++) {
    const side = await p.evaluate(async ({ items, row, W }) => {
      const hv = await import('/src/systems/worldHover.js');
      const ql = await import('/src/systems/quickLoot.js');
      const wp = await import('/src/ui/worldPlaque.js');
      const pf = await import('/src/systems/uiPrefs.js');
      pf.setPref('quickLoot', true);
      wp.destroyWorldPlaque();
      ql.resetQuickLoot();
      const { shown, rest, empty } = hv.hoverLines(items);
      const f = { key: 'loot:probe', kind: 'items', title: 'Loot Pile', subs: [], rows: shown, rest, empty };
      ql.foldQuickLoot(f);
      for (let i = 0; i < row; i++) { ql.quickLootWheel(120); ql.foldQuickLoot(f); }
      wp.showWorldPlaque(f, { x: W / 2, top: Math.round(window.innerHeight * 0.44) + 26 });
      const panel = document.querySelector('.wplaque-stats');
      return panel ? panel.dataset.side : 'none';
    }, { items: ITEMS, row, W });
    const name = `${OUT}/quickloot-${label}-row${row}.png`;
    await p.screenshot({ path: name });
    shots.push({ label, row, item: ITEMS[row].name, side, name });
  }
  await ctx.close();
}
await b.close();
for (const s of shots) console.log(`${s.label.padEnd(8)} row ${s.row} ${s.item.padEnd(9)} panel:${s.side.padEnd(6)} -> ${s.name}`);
