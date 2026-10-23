// THE DWARVEN PISTOLET ON THE REAL PAPER DOLL (PISTOLET, 2026-10-21; bible/05-Combat/Dwarven-Pistolet.md) - the doll the
// game composes (ui/paperDoll.js refreshPaperDoll, the one door every doll draws through) over the player's own ARENA2
// body and backdrop, wearing a PAIR of Pistolets through the equip law - beside a classic dagger pair (the measurement's
// own reference: TEXTURE.234's two hands) and the Sunken Sovereign's gold pair.
//
// What no pin can say: the fist reads THROUGH each pistol's gap - the doll's right hand on the right pistol's grip, its
// left hand on the left's. The composites are written enlarged, side by side, for the eye (to the directory named, never
// public/ - AUDIT 21: the body is ARENA2's).
//
//     ARENA2_PATH=<the freeware data, tools/fetch-data.sh> node tools/pistoletDollProbe.mjs [shots-dir] [--body=Race:gender ...]
//
// AUDIT PISTOLET D17: the bodies are an argument (a Breton male unless named), so the record's six-body check is one
// command - --body=Breton:male --body=Breton:female --body=Nord:male --body=DarkElf:female --body=Khajiit:male
// --body=Argonian:female - one row of three dolls a body.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const ARGS = process.argv.slice(2);
const OUT = ARGS.find((a) => !a.startsWith('--')) || 'scratch/pistolet-doll';
const BODIES = ARGS.filter((a) => a.startsWith('--body=')).map((a) => { const [race, gender = 'male'] = a.slice(7).split(':'); return { race, gender }; });
if (!BODIES.length) BODIES.push({ race: 'Breton', gender: 'male' });
mkdirSync(OUT, { recursive: true });
// AUDIT PISTOLET M9: the page beside the probe (tools/, ignored as every *.tmp.html is), written inside the try whose
// finally unlinks it (AUDIT 68 X2), and driven at its own path - never the site root, which is the landing page (U60).
const PAGE_NAME = 'pistoletdoll.tmp.html';
const PAGE = `tools/${PAGE_NAME}`;
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>pistolet doll probe</title>
<style>body{margin:0;background:#222}canvas{image-rendering:pixelated}</style></head><body><canvas id="gl" width="8" height="8" style="display:none"></canvas><canvas id="out"></canvas>
<script type="module">
import { Renderer } from '/src/render/renderer.js';
import { DFPalette } from '/src/formats/dfPalette.js';
import { fetchBytes } from '/src/scenes/shared.js';
import { createDataPipeline } from '/src/scenes/dataPipeline.js';
import { preloadPaperDollArt, refreshPaperDoll, paperDollPixels } from '/src/ui/paperDoll.js';
import { createPistolet, installPistoletIcons } from '/src/systems/pistolet.js';
import { installThunderlockIcons } from '/src/systems/thunderlock.js';
import { equipItem } from '/src/systems/equip.js';
import { createWeapon } from '/src/combat/enemyEquipment.js';
import { mintGilded, SUNKEN_SOVEREIGN } from '/src/systems/gilded.js';
const renderer = new Renderer(document.getElementById('gl'));
const palette = new DFPalette();
palette.load(await fetchBytes('ART_PAL.COL'), 'ART_PAL.COL');
const { getTexture } = createDataPipeline({ renderer, arch: null, palette });
installThunderlockIcons(); installPistoletIcons();
const dolls = [];
for (const { race, gender } of ${JSON.stringify(BODIES)}) {
  await preloadPaperDollArt({ renderer, fetchBytes, palette, getTexture }, { race, gender, faceIndex: 0 });
  const body = () => ({ isPlayer: true, race, gender, faceIndex: 0, items: [], stats: { strength: 50, agility: 50 }, skills: new Array(35).fill(50) });
  for (const pair of [[createPistolet(), createPistolet()], [createWeapon(113, 1), createWeapon(113, 1)], [mintGilded(SUNKEN_SOVEREIGN), mintGilded(SUNKEN_SOVEREIGN)]]) {
    const e = body();
    for (const it of pair) { e.items.push(it); equipItem(e, it); }
    await refreshPaperDoll(e);
    await new Promise((r) => setTimeout(r, 400));
    await refreshPaperDoll(e);
    const p = paperDollPixels();
    dolls.push(p ? { w: p.width, h: p.height, rgba: Array.from(p.rgba), slots: pair.map((it) => it.equipSlot), row: \`\${race} \${gender}\` } : null);
  }
}
globalThis.__dolls = dolls;
globalThis.__ready = true;
</script></body></html>`;

const server = await createServer({ server: { port: 5193, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); };
try {
  await writeFile(PAGE, HTML);
  await page.goto(`http://localhost:5193/tools/${PAGE_NAME}`, { waitUntil: 'domcontentloaded', timeout: 600000 });
  await page.waitForFunction(() => globalThis.__ready, null, { timeout: 600000 });
  const dolls = await page.evaluate(() => globalThis.__dolls);
  console.log('dolls', dolls.map((d) => d && `${d.row}: ${d.w}x${d.h} slots ${d.slots}`).join(' | '));
  // what can be judged without an eye: every body drew its three dolls, each pair worn in BOTH hands (the equip law's
  // Either - EQUIP_SLOTS RightHand 19, LeftHand 21), and nothing threw. Where the fist meets the grip is the owner's eye.
  check(`every body drew its three dolls (${BODIES.length} bodies)`, dolls.length === BODIES.length * 3 && dolls.every(Boolean), `${dolls.filter(Boolean).length} of ${BODIES.length * 3}`);
  check('each pair is worn in both hands', dolls.every((d) => d && [...d.slots].sort((a, b) => a - b).join() === '19,21'), dolls.map((d) => d?.slots).join(' | '));
  const { writePng } = await import('./pngIO.mjs');
  // one row of three (the pistols, the daggers, the gold pair) a body
  const Z = 3, rows = [];
  for (let i = 0; i < dolls.length; i += 3) rows.push(dolls.slice(i, i + 3).filter(Boolean));
  const W = Math.max(...rows.map((r) => r.reduce((n, d) => n + d.w * Z + 10, 0))), rowH = rows.map((r) => Math.max(0, ...r.map((d) => d.h * Z)));
  const H = rowH.reduce((n, h) => n + h + 10, 0);
  const out = new Uint8Array(W * H * 4).fill(30);
  let oy = 0;
  rows.forEach((r, ri) => {
    let ox = 0;
    for (const d of r) {
      for (let y = 0; y < d.h * Z; y++) for (let x = 0; x < d.w * Z; x++) {
        const s = (((y / Z) | 0) * d.w + ((x / Z) | 0)) * 4, o = ((oy + y) * W + ox + x) * 4;
        const a = d.rgba[s + 3] / 255;
        for (let c = 0; c < 3; c++) out[o + c] = d.rgba[s + c] * a + 30 * (1 - a);
        out[o + 3] = 255;
      }
      ox += d.w * Z + 10;
    }
    oy += rowH[ri] + 10;
  });
  writeFileSync(`${OUT}/dolls.png`, writePng({ width: W, height: H, data: out }));
  console.log(`the dolls, for the eye: ${OUT}/dolls.png`);
  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  await browser.close(); await server.close();
  await unlink(PAGE).catch(() => { /* gone */ });
}
console.log(`${results.filter(Boolean).length}/${results.length} ok`);
process.exit(results.length && results.every(Boolean) ? 0 : 1);
