// QS3 - THE QUICKSLOT DIAMOND, MEASURED IN A REAL BROWSER.
//
// Node has no layout engine, so "the diamond clears the vitals column"
// and "it does not stand under the phone's jump button" are claims the
// suite cannot check. This is the artifact that checks them: a page
// over the REAL modules (src/ui/enhancedHud.js and
// src/ui/enhancedStyle.js, imported rather than re-implemented), a fake
// player carrying a weapon, a shield and two potions, and every box
// read back off the live engine at three sizes, two HUD scales and both
// virtual-stick anchors.
//
// IT RUNS ON VITE'S OWN DEV SERVER rather than a static file server,
// and that is not a convenience: the HUD's module graph reaches
// `import.meta.glob` (scenes/questData.js, systems/dynamicSkiesAssets
// .js, systems/betterAmbience.js), which is a Vite COMPILE-TIME macro.
// A plain server hands the browser the macro itself and the page dies
// with "(intermediate value).glob is not a function" - measured, on the
// first draft of this file. The shipping graph is the transformed one,
// so the probe uses the transform.
//
// The rectangles it must clear belong to the other layers, and are
// stated here as the numbers those layers use rather than measured off
// them - ui/touch.js: the bottom-right column at edge 16 with 48-tall
// buttons, and a FIXED virtual stick at inset 36 radius 56
// (FIXED_STICK_INSET, STICK_RADIUS).
//
//     node tools/qs3Probe.mjs
//
// PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers here; pass CHROMIUM=... to
// point at another executable. QS3_SHOTS=<dir> writes a screenshot per
// page beside the numbers.
import { writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const PAGE_REL = 'tools/qs3-probe.tmp.html';
const PAGE_PATH = join(ROOT, PAGE_REL);

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>QS3 probe</title>
<style>html,body{margin:0;height:100%;background:#12141a;overflow:hidden}</style></head><body>
<script type="module">
import { drawEnhancedHud } from '/src/ui/enhancedHud.js';
import { assignQuickslot, clearQuickslots } from '/src/systems/quickslots.js';
import { setPref } from '/src/systems/uiPrefs.js';
import { EQUIP_SLOTS } from '/src/characters/paperdoll.js';

const q = new URLSearchParams(location.search);
setPref('hudScale', Number(q.get('scale') ?? 1));
setPref('touchStickAnchor', q.get('stick') === 'fixed' ? 'fixed' : 'float');

const weapon = { group: 'Weapons', templateIndex: 121, name: 'Longsword', currentCondition: 12, maxCondition: 40 };
const shield = { group: 'Armor', templateIndex: 105, name: 'Kite Shield', currentCondition: 300, maxCondition: 400 };
const potion = (key, n) => ({ group: 'UselessItems1', templateIndex: 83, name: 'Glass Bottle', potionRecipeKey: key, stackCount: n, currentCondition: 1, maxCondition: 1 });
const heal = potion(1, 6), cure = potion(2, 0);

const entity = {
  health: 42, maxHealth: 80, magicka: 19, maxMagicka: 40, fatigue: 5000,
  stats: { strength: 50, endurance: 50 },
  items: [weapon, shield, heal],
  equip: { slots: { [EQUIP_SLOTS.LeftHand]: shield } },
  lightSource: null,
};
clearQuickslots();
assignQuickslot('c1', heal);
assignQuickslot('c2', cure);

drawEnhancedHud(entity, 0.02, 1 / 60, {
  weapon, weaponSheathed: q.get('sheathed') === '1',
  readied: q.get('spell') === '1' ? { name: 'Far Silence' } : null,
  quickUse: () => {}, quickSwap: () => {},
});

const box = (sel) => { const el = document.querySelector(sel); if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1) }; };
const cls = (sel) => (document.querySelector(sel)?.className ?? '');
const txt = (sel) => (document.querySelector(sel)?.textContent ?? '');
const shown = (sel) => { const el = document.querySelector(sel); return !!el && getComputedStyle(el).display !== 'none'; };

window.__probe = {
  W: innerWidth, H: innerHeight,
  scale: getComputedStyle(document.querySelector('.hud')).getPropertyValue('--hud-scale').trim(),
  quick: box('.hud-quick'), diamond: box('.hud-qdiamond'), bars: box('.hud-bars'),
  cap: box('.hud-qcap'), mode: box('.hud-modecorner'),
  cells: { main: box('.hud-qmain'), off: box('.hud-qoff'), c1: box('.hud-qc1'), c2: box('.hud-qc2') },
  tags: { top: box('.hud-qstop'), left: box('.hud-qsleft'), right: box('.hud-qsright'), bottom: box('.hud-qsbottom') },
  tagsOn: { top: shown('.hud-qstop'), left: shown('.hud-qsleft'), right: shown('.hud-qsright'), bottom: shown('.hud-qsbottom') },
  classes: { main: cls('.hud-qmain'), off: cls('.hud-qoff'), c1: cls('.hud-qc1'), c2: cls('.hud-qc2'), quick: cls('.hud-quick') },
  counts: { c1: txt('.hud-qc1 .hud-qcount'), c2: txt('.hud-qc2 .hud-qcount') },
  pointer: getComputedStyle(document.querySelector('.hud-qmain')).pointerEvents,
  rootPointer: getComputedStyle(document.querySelector('.hud')).pointerEvents,
  hands: !!document.querySelector('.hud-hands'),
};
document.title = 'ready';
<\/script></body></html>`;

/** The other layers' own rectangles, in viewport px off the edges they
 *  are inset from (ui/touch.js). */
const touchButtons = (W, H) => ({ x: W - 296, y: H - 64, right: W - 16, bottom: H - 16 });
const fixedStickBox = (H) => ({ x: 36, y: H - 148, right: 148, bottom: H - 36 });
const overlaps = (a, b) => !!a && !!b && a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;

await writeFile(PAGE_PATH, PAGE);
const vite = await createServer({ root: ROOT, server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await vite.listen();
const port = vite.httpServer.address().port;
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const fails = [];
const notes = [];
try {
  const sizes = [['desktop', { width: 1280, height: 800 }], ['phone-landscape', { width: 860, height: 400 }], ['phone-portrait', { width: 430, height: 860 }]];
  for (const [name, size] of sizes) {
    for (const scale of [1, 2]) {
      for (const stick of ['float', 'fixed']) {
        const page = await browser.newPage({ viewport: size });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(`http://127.0.0.1:${port}/${PAGE_REL}?nofonts&scale=${scale}&stick=${stick}&spell=1`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => errors.push(e.message));
        await page.waitForFunction(() => !!window.__probe, null, { timeout: 30000 }).catch(() => {});
        const p = await page.evaluate(() => window.__probe ?? null);
        if (!p) { fails.push(`${name} x${scale} ${stick}: the page never reported (${errors.join('; ') || 'no error'})`); await page.close(); continue; }
        const btns = touchButtons(p.W, p.H), stickBox = fixedStickBox(p.H);
        const label = `${name} ${p.W}x${p.H} scale ${scale} stick ${stick}`;
        console.log(`\n== ${label}  (--hud-scale ${p.scale})`);
        console.log(`   .hud-quick    x ${p.quick.x} y ${p.quick.y} ${p.quick.w}x${p.quick.h}  right ${p.quick.right} bottom ${p.quick.bottom}`);
        console.log(`   .hud-qdiamond x ${p.diamond.x} y ${p.diamond.y} ${p.diamond.w}x${p.diamond.h}`);
        console.log(`   .hud-bars     x ${p.bars.x} y ${p.bars.y} ${p.bars.w}x${p.bars.h}`);
        console.log(`   .hud-qcap     x ${p.cap.x} y ${p.cap.y} ${p.cap.w}x${p.cap.h}`);
        for (const k of ['main', 'off', 'c1', 'c2']) console.log(`   cell ${k.padEnd(4)}     x ${p.cells[k].x} y ${p.cells[k].y} ${p.cells[k].w}x${p.cells[k].h}  [${p.classes[k]}]`);
        for (const k of ['top', 'left', 'right', 'bottom']) console.log(`   tag  ${k.padEnd(6)}   ${p.tagsOn[k] ? `x ${p.tags[k].x} y ${p.tags[k].y} ${p.tags[k].w}x${p.tags[k].h}` : 'hidden (nothing bound)'}`);
        console.log(`   counts c1 "${p.counts.c1}" c2 "${p.counts.c2}"; cell pointer-events ${p.pointer}, root ${p.rootPointer}; .hud-hands present: ${p.hands}`);
        console.log(`   touch buttons ${JSON.stringify(btns)}${stick === 'fixed' ? `  fixed stick ${JSON.stringify(stickBox)}` : ''}`);

        // WHAT IS CHECKED IS WHAT IS DRAWN. `.hud-quick` is a padded box
        // whose caption row is as wide as its longest chip and whose
        // bottom 18px are empty, so measuring IT reports collisions
        // between two pieces of nothing. The drawn parts are the
        // diamond, the caption and whichever tags are standing.
        // ...and the diamond's own SQUARE is four corners of nothing, so
        // the four cells are measured rather than the box round them.
        const drawn = [...['main', 'off', 'c1', 'c2'].map((k) => [`the ${k} cell`, p.cells[k]]), ['the caption', p.cap],
          ...['top', 'left', 'right', 'bottom'].filter((k) => p.tagsOn[k]).map((k) => [`the ${k} tag`, p.tags[k]])];
        const hit = (box, what) => { for (const [name, r] of drawn) if (overlaps(r, box)) fails.push(`${label}: ${name} overlaps ${what}`); };
        // AT hudScale 2 ON A PHONE THE WHOLE HUD IS OVER-SCALED, and
        // that is not this slice's doing: the vitals column itself is
        // 710px wide on a 430px screen and hangs off BOTH edges
        // (measured below, `.hud-bars x -140.4`). Where the reference
        // element does not fit either, the containment check is a NOTE
        // rather than a verdict - it would be a pin on PX30c's clamp,
        // not on the diamond.
        const hudFits = p.bars.x >= 0 && p.bars.right <= p.W;
        if (p.hands) fails.push(`${label}: the old hand plaques are still in the DOM`);
        hit(p.bars, 'the vitals column');
        hit(btns, "the touch layer's bottom-right buttons");
        if (stick === 'fixed') hit(stickBox, 'the fixed virtual stick');
        for (const [name, r] of drawn) {
          const off = r.x < 0 || r.right > p.W || r.y < 0 || r.bottom > p.H + 0.5;
          if (!off) continue;
          const line = `${label}: ${name} leaves the viewport (x ${r.x} right ${r.right} y ${r.y} bottom ${r.bottom} of ${p.W}x${p.H})`;
          if (hudFits) fails.push(line); else notes.push(`${line} - and so does the vitals column (x ${p.bars.x} right ${p.bars.right})`);
        }
        if (stick === 'fixed' && !p.classes.quick.includes('stickclear')) fails.push(`${label}: the stick-clear class was not toggled`);
        if (stick === 'float' && p.classes.quick.includes('stickclear')) fails.push(`${label}: the stick-clear class stuck on`);
        if (p.rootPointer !== 'none') fails.push(`${label}: the HUD root takes the pointer`);
        // QS3_SHOTS=<dir>: a screenshot per page, for a reader who wants
        // to SEE the diamond rather than read its rectangles.
        if (process.env.QS3_SHOTS) await page.screenshot({ path: join(process.env.QS3_SHOTS, `qs3-${name}-x${scale}-${stick}.png`) });
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  await vite.close();
  await unlink(PAGE_PATH).catch(() => {});
}
if (notes.length) { console.log('\nNOTES (the whole HUD is over-scaled here, the vitals column included):'); for (const n of notes) console.log(`  - ${n}`); }
if (fails.length) { console.log('\nFAILED:'); for (const f of fails) console.log(`  - ${f}`); process.exit(1); }
console.log('\nall clear');
