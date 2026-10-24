// KETCH-LOOK KL2 (bible/11-Multiplayer/Sky-Ketch-Look.md section 2, "Palette: Daggerfall's index space"): HER METAL IN
// DAGGERFALL'S OWN INDEX SPACE - every texel of every record a step of her ramps (world/ketch/ketchLook.js KT_PAL), its
// ART_PAL index beside it (world/superDungeon/sdPixelKit.js quantizeIndexed); the indices code (her Dwarven
// METAL_TABLES.Dwarven's own steps), the fallbacks the port's own (one colour an index, never the file's); resolved
// through the player's palette at upload (world/ketch/ketchArt.js resolveKetchArt). With ARENA2_PATH (sh tools/
// fetch-data.sh), against ART_PAL.COL itself: every fallback within 24 of its entry and not its bytes, every ramp rising in
// the palette's own luminance. tools/mutants/ketch_look_metal.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KT_PAL } from '../../../src/world/ketch/ketchLook.js';
import { ketchArt, resolveKetchArt, KT_REC, KT_NET_M } from '../../../src/world/ketch/ketchArt.js';
import { quantizeIndexed, image, putTexel } from '../../../src/world/superDungeon/sdPixelKit.js';
import { METAL_TABLES } from '../../../src/characters/dyes.js';

const ARENA2 = process.env.ARENA2_PATH;   // AUDIT 17n: the corpus by its variable alone, never a path of one machine's
const PAL = ARENA2 && existsSync(join(ARENA2, 'ART_PAL.COL')) ? readFileSync(join(ARENA2, 'ART_PAL.COL')) : null;
const palRgb = PAL ? PAL.subarray(PAL.length === 776 ? 8 : 0, (PAL.length === 776 ? 8 : 0) + 768) : null;
const entry = (i) => [palRgb[i * 3], palRgb[i * 3 + 1], palRgb[i * 3 + 2]];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const lin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ramps = Object.values(KT_PAL);

test('KETCH-LOOK KL2 THE CONTRACT\'S OWN LAW: every ramp an index a step with a colour for each; every index 0-255; an index one colour wherever it stands, and two indices never one colour (an index image must say which step a texel is); her Dwarven METAL_TABLES.Dwarven\'s own steps in the table\'s order, her steel\'s greys METAL_TABLES.Iron\'s (mutants: a Dwarven step off the table; two indices one colour)', () => {
  const colourOf = new Map(), indexOf = new Map();
  for (const r of ramps) {
    assert.equal(r.idx.length, r.fallback.length);
    r.idx.forEach((i, k) => {
      assert.ok(Number.isInteger(i) && i >= 0 && i <= 255, `index ${i}`);
      const c = r.fallback[k].join(',');
      if (colourOf.has(i)) assert.equal(colourOf.get(i), c, `index ${i} one colour`);
      colourOf.set(i, c);
      if (indexOf.has(c)) assert.equal(indexOf.get(c), i, `colour ${c} one index`);
      indexOf.set(c, i);
    });
  }
  const D = METAL_TABLES.Dwarven;
  const at = KT_PAL.dwarven.idx.map((i) => D.indexOf(i));
  assert.ok(at.every((k) => k >= 0), 'every Dwarven step the table\'s');
  assert.ok(at.every((k, j) => j === 0 || k < at[j - 1]), 'in the table\'s own order, dark to light');
  assert.ok(D.includes(KT_PAL.glint.idx[0]) && KT_PAL.burnished.idx.every((i) => D.includes(i)), 'the glint and the burnished the table\'s');
  for (const i of KT_PAL.steel.idx.filter((i) => i < 200)) assert.ok(METAL_TABLES.Iron.includes(i) || i === 85, `steel ${i} the Iron table's greys (or 85, under them)`);
});

test('KETCH-LOOK KL2 EVERY TEXEL A STEP: each record\'s every texel is a fallback colour of KT_PAL and its index image names that step - one byte a texel, the colour and the index agreeing; no record keeps a colour of the Hour\'s orange brass (mutants: a record quantized to the old ramps; the index image left out)', () => {
  const step = new Map();
  for (const r of ramps) r.idx.forEach((i, k) => step.set(r.fallback[k].join(','), i));
  const all = ketchArt();
  assert.ok(all.some(([rec]) => rec === KT_REC.inner), 'the hold\'s inner plating a record');
  for (const [rec, art] of all) {
    const c = art.albedo.colors;
    assert.ok(art.index instanceof Uint8Array && art.index.length === c.length / 4, `record ${rec}: its index image`);
    for (let t = 0, j = 0; t < art.index.length; t++, j += 4) {
      const i = step.get(`${c[j]},${c[j + 1]},${c[j + 2]}`);
      if (i !== art.index[t]) assert.fail(`record ${rec} texel ${t}: colour ${c[j]},${c[j + 1]},${c[j + 2]} is step ${i}, its index ${art.index[t]}`);
    }
  }
});

test('KETCH-LOOK KL2 THROUGH THE PLAYER\'S PALETTE: a record resolved takes the palette\'s colour at each texel\'s index, its alpha kept, its glow the same share of its new colour; with no palette the record as it stands (mutants: resolved to the fallback; the glow left on the old colour)', () => {
  const rgb = new Uint8Array(768);
  for (let i = 0; i < 256; i++) { rgb[i * 3] = i; rgb[i * 3 + 1] = 255 - i; rgb[i * 3 + 2] = (i * 7) & 255; }
  const [, lamp] = ketchArt().find(([rec]) => rec === KT_REC.lamp), [, net] = ketchArt().find(([rec]) => rec === KT_REC.net);
  assert.equal(resolveKetchArt(lamp, null), lamp);
  const L = resolveKetchArt(lamp, rgb);
  for (let t = 0; t < lamp.index.length; t += 97) {
    const i = lamp.index[t], j = t * 4;
    assert.deepEqual([...L.albedo.colors.subarray(j, j + 3)], [rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]]);
    for (let k = 0; k < 3; k++) {
      const was = lamp.albedo.colors[j + k], glow = lamp.emission.colors[j + k];
      if (was > 0) assert.ok(Math.abs(L.emission.colors[j + k] - Math.min(255, (glow * rgb[i * 3 + k]) / was)) <= 0.5 + 1e-9, 'its glow\'s share kept');
    }
  }
  const N = resolveKetchArt(net, rgb);
  for (let j = 3; j < net.albedo.colors.length; j += 4) assert.equal(N.albedo.colors[j], net.albedo.colors[j], 'the net\'s holes kept');
});

test('KETCH-LOOK KL2 THE KIT\'S INDEXED QUANTIZE: every texel to its nearest step\'s fallback, the step\'s index beside it; alpha untouched', () => {
  const R = { idx: [10, 20], fallback: [[0, 0, 0], [200, 200, 200]] };
  const img = image(2, 1);
  putTexel(img, 0, 0, [30, 20, 10], 0); putTexel(img, 1, 0, [150, 190, 170]);
  const idx = quantizeIndexed(img, [R]);
  assert.deepEqual([...idx], [10, 20]);
  assert.deepEqual([...img.colors], [0, 0, 0, 0, 200, 200, 200, 255]);
});

test('KETCH-LOOK KL2 THE NET A DIAMOND A CELL: the rigging\'s picture one 1.5 m diamond (the 1 m mesh read as a chain-link fence), its cord the Dwarven ramp\'s darker steps (the old cord stood as bright as the sky behind it)', () => {
  assert.equal(KT_NET_M, 1.5);
  const [, net] = ketchArt().find(([rec]) => rec === KT_REC.net);
  const used = new Set();
  for (let t = 0; t < net.index.length; t++) if (net.albedo.colors[t * 4 + 3] > 0) used.add(net.index[t]);
  const dark = new Set(KT_PAL.dwarven.idx.slice(0, 4));
  assert.ok([...used].every((i) => dark.has(i)), `the cord in the darker steps: ${[...used]}`);
});

test('KETCH-LOOK KL2 AGAINST ART_PAL ITSELF (ARENA2_PATH): every fallback within 24 of its entry and never the file\'s own bytes; every ramp rising in the palette\'s own luminance - the lab looks like the game, and no palette byte enters the repository', { skip: palRgb ? false : 'no ARENA2 here: sh tools/fetch-data.sh' }, () => {
  for (const [name, r] of Object.entries(KT_PAL)) {
    r.idx.forEach((i, k) => {
      const d = dist(r.fallback[k], entry(i));
      assert.ok(d <= 24, `${name} ${i}: ${d.toFixed(1)} from its entry`);
      assert.ok(d > 0, `${name} ${i}: the file's own bytes`);
    });
    for (let k = 1; k < r.idx.length; k++) assert.ok(lum(entry(r.idx[k])) > lum(entry(r.idx[k - 1])), `${name} rises at ${r.idx[k]}`);
  }
});

test('KETCH-LOOK KL2 THE HOLD WITHOUT BOOKSHELVES: the hold\'s long walls are its plates\' backs (the inner record), never the outside\'s strakes - which between its ribs read as library shelves in the dark; the outside keeps them (mutants: the hold walled in the hull\'s)', async () => {
  const { buildKetchShip } = await import('../../../src/world/ketch/ketchModel.js');
  const ship = buildKetchShip(), of = (rec) => ship.model.subMeshes.filter((m) => m.textureRecord === rec).reduce((a, m) => a + m.primitiveCount, 0);
  assert.equal(of(KT_REC.inner), 4, 'its two long walls, two faces each');
  assert.ok(of(KT_REC.hull) > 100, 'the hull outside');
});

test('KETCH-LOOK KL2 THE PALETTE ASKED ONCE: ART_PAL.COL read off the game\'s data seam once, its 768 colours past its header; nothing where there is no data', async () => {
  const { ketchPaletteRgb } = await import('../../../src/scenes/ketch/ketchDeckHost.js');
  const file = new Uint8Array(776);
  for (let i = 0; i < 768; i++) file[8 + i] = i & 255;
  let asked = 0;
  const rgb = await ketchPaletteRgb((name) => { asked++; assert.equal(name, 'ART_PAL.COL'); return Promise.resolve(file); });
  assert.equal(rgb.length, 768);
  assert.deepEqual([...rgb.subarray(0, 4)], [0, 1, 2, 3], 'past the header');
  assert.equal(await ketchPaletteRgb(() => { asked++; return Promise.reject(new Error('again')); }), rgb, 'once');
  assert.equal(asked, 1);
});
