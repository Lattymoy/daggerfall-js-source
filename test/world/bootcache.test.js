// AUDIT RELEASE R4-4 (bible/01-Overview/audits/Audit-Release-R4.md; the owner: "Take care of exclusions and gaps"): the
// boot's continent - the trace, its relief and the Bay's fit - kept in IndexedDB under its inputs' print, so a returning
// boot takes them (world/tamriel/tamrielBootCache.js, ui/tamrielTrace.js preloadTamrielTrace, tamrielLand.js
// fitBayToPicture). A record that does not answer to its key, sizes or checksum is none; no store, the boot as before;
// the laws' prints held under BOOT_CACHE_VERSION, so a law moved without it fails here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { memoryIdb } from '../memoryIdb.mjs';
import { bootStore, traceKey, keptTrace, keepTrace, loadFits, keptFit, keepFit, keptLandRegions, fnv32, BOOT_CACHE_VERSION } from '../../src/world/tamriel/tamrielBootCache.js';
import { fitBayToPicture } from '../../src/world/tamriel/tamrielLand.js';
import { maskRelief } from '../../src/world/tamriel/tamrielRelief.js';
import { BAY_W, BAY_H } from '../../src/world/tamriel/tamrielFrame.js';

const settle = async (n = 30) => { for (let k = 0; k < n; k++) await new Promise((r) => setTimeout(r, 0)); };
/** A picture-sized trace: land in a block, two provinces. */
function block() {
  const w = 320, h = 200, land = new Uint8Array(w * h), province = new Uint8Array(w * h);
  for (let y = 40; y < 160; y++) for (let x = 30; x < 290; x++) { land[y * w + x] = 1; province[y * w + x] = x < 150 ? 1 : 9; }
  return { w, h, land, province };
}

test('BOOT-CACHE (AUDIT RELEASE R4-4) the trace kept and taken: under its inputs\' print (each picture, the palette, the relief, BOOT_CACHE_VERSION), the arrays back byte for byte; a record whose key, sizes or checksum do not answer is none; no IndexedDB, no store (mutants: the checksum unread; the sizes unread; the key unread; an input out of the print)', async () => {
  assert.equal(bootStore(null), null, 'no IndexedDB, no store');
  const store = bootStore(memoryIdb());
  const t = { ...block(), relief: Uint8Array.from({ length: 320 * 200 * 4 }, (_, i) => i % 251) };
  const inputs = { picture: Uint8Array.of(1, 2, 3), picker: Uint8Array.of(4, 5), palette: Uint8Array.of(6), relief: 'cells' };
  const key = traceKey(inputs);
  assert.ok(key.startsWith(`tamriel-boot:v${BOOT_CACHE_VERSION}:`));
  for (const [k, v] of [['picture', Uint8Array.of(1, 2, 4)], ['picker', Uint8Array.of(4, 6)], ['palette', Uint8Array.of(7)], ['relief', 'cellz'], ['relief', null]]) assert.notEqual(traceKey({ ...inputs, [k]: v }), key, `${k} in the print`);
  assert.equal(await keptTrace(store, key), null, 'nothing kept yet');
  await keepTrace(store, key, t);
  const back = await keptTrace(store, key);
  assert.deepEqual([back.w, back.h], [320, 200]);
  for (const f of ['land', 'province', 'relief']) assert.ok(Buffer.from(back[f]).equals(Buffer.from(t[f])), `${f} byte for byte`);
  assert.equal(await keptTrace(store, traceKey({ ...inputs, picker: Uint8Array.of(9) })), null, 'another print, none');
  // a record that does not answer: its key, its sizes, its checksum
  const raw = await store.get(key);
  await store.set(key, { ...raw, key: 'else' });
  assert.equal(await keptTrace(store, key), null, 'its key');
  await keepTrace(store, key, { ...t, w: 321 });   // its own checksum, sizes that do not answer
  assert.equal(await keptTrace(store, key), null, 'its sizes');
  const land = raw.land.slice(); land[100 * 320 + 100] ^= 1;
  await store.set(key, { ...raw, land });
  assert.equal(await keptTrace(store, key), null, 'its checksum');
  await store.set(key, raw);
  assert.ok(await keptTrace(store, key), 'whole again, taken');
  assert.equal(fnv32('ab'), fnv32(Uint8Array.of(97, 98)));
});

test('BOOT-CACHE (AUDIT RELEASE R4-4) the roads\' regions with land kept: with no kept trace every start scans and keeps nothing; a boot whose trace was kept scans once and keeps the answer, a returning boot on the same ground (and lattice) takes it - no region scanned, the same regions - and another ground or lattice scans again (mutants: the kept answer unread; the ground out of the print; the lattice out of it; kept before the last region)', async () => {
  const lattice = { x0: 0, y0: 0, cols: 3, rows: 2 }, regs = [];
  for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) regs.push({ i, j });
  let scans = 0;
  const scan = (r) => { scans++; return (r.i + r.j) % 2 === 0; };
  regs.map(keptLandRegions({ lattice, scan, ground: 'g1' }));
  scans = 0;
  regs.map(keptLandRegions({ lattice, scan, ground: 'g1' }));
  assert.equal(scans, 6, 'no kept trace: scanned again');
  const store = bootStore(memoryIdb());
  await loadFits(store, 'trace-k');
  scans = 0;
  const first = regs.map(keptLandRegions({ lattice, scan, ground: 'g1' }));
  assert.equal(scans, 6);
  await settle();
  await loadFits(store, 'trace-k');   // a returning boot
  scans = 0;
  const p = keptLandRegions({ lattice, scan, ground: 'g1' });
  assert.deepEqual(regs.map(p), first);
  assert.deepEqual(first, [true, false, true, false, true, false]);
  assert.equal(scans, 0, 'taken, none scanned');
  scans = 0;
  regs.map(keptLandRegions({ lattice, scan, ground: 'g2' }));
  assert.equal(scans, 6, 'another ground, scanned');
  scans = 0;
  const wide = { ...lattice, cols: 4 }, more = [...regs, { i: 3, j: 0 }, { i: 3, j: 1 }];
  more.map(keptLandRegions({ lattice: wide, scan, ground: 'g2' }));
  assert.equal(scans, 8, 'another lattice, scanned');
  // half a scan keeps nothing: a start broken off is no answer
  await loadFits(store, 'trace-k2');
  const half = keptLandRegions({ lattice, scan, ground: 'g3' });
  regs.slice(0, 3).map(half);
  scans = 0;
  regs.map(keptLandRegions({ lattice, scan, ground: 'g3' }));
  assert.equal(scans, 6);
});

test('BOOT-CACHE (AUDIT RELEASE R4-4) the fit kept and taken: fitBayToPicture with a trace\'s fitKeep searches once on a land and keeps it, takes the kept fit on the same land - the same fit byte for byte - and searches again on another; without one, the fit as ever; the fits kept a trace reloaded from the store (mutants: the kept fit unread; the print blind to the land; the keep unwritten)', async () => {
  const trace = block();
  const bayLand = (x, y) => { const px = Math.floor(10 + x / 18), py = Math.floor(30 + y / 18); return !!trace.land[py * 320 + px]; };
  const plain = fitBayToPicture({ bayLand, trace, around: { ox: 12, oy: 32 }, span: 4, ppus: [18] });
  const kept = new Map(), asked = [];
  const keep = { get: (p) => { asked.push(p); return kept.get(p) ?? null; }, keep: (p, f) => kept.set(p, f) };
  const first = fitBayToPicture({ bayLand, trace: { ...trace, fitKeep: keep }, around: { ox: 12, oy: 32 }, span: 4, ppus: [18] });
  assert.deepEqual(first, plain, 'the same fit');
  assert.equal(kept.size, 1);
  const [print] = kept.keys();
  kept.set(print, { ...first, marker: 1 });
  const second = fitBayToPicture({ bayLand, trace: { ...trace, fitKeep: keep }, around: { ox: 12, oy: 32 }, span: 4, ppus: [18] });
  assert.equal(second.marker, 1, 'the kept fit taken');
  const other = fitBayToPicture({ bayLand: (x, y) => bayLand(x + 18, y), trace: { ...trace, fitKeep: keep }, around: { ox: 12, oy: 32 }, span: 4, ppus: [18] });
  assert.notEqual(asked.at(-1), print, 'another land, another print');
  assert.equal(other.marker, undefined, 'searched again');
  assert.equal(kept.size, 2);
  // the store's fits for a key
  const store = bootStore(memoryIdb());
  await loadFits(store, 'k');
  assert.equal(keptFit('k', 'land'), null);
  keepFit('k', 'land', { ox: 1, oy: 2, ppu: 18 });
  await settle();
  await loadFits(store, 'k');
  assert.deepEqual(keptFit('k', 'land'), { ox: 1, oy: 2, ppu: 18 }, 'kept in the store, loaded again');
  assert.equal(keptFit(undefined, 'land'), null);
});

test('BOOT-CACHE (AUDIT RELEASE R4-4) the laws a kept continent stands for, printed under BOOT_CACHE_VERSION: the relief\'s mask and the fit on a fixture - a law moved and the version not, this fails (mutants: the mask\'s rule; the fit\'s)', () => {
  const t = block();
  const cells = maskRelief(Uint8Array.from({ length: 640 * 400 }, (_, i) => 1 + (i % 200)), t);
  const fit = fitBayToPicture({ bayLand: (x, y) => x > 100 && x < BAY_W - 100 && y > 60 && y < BAY_H - 60, trace: t, around: { ox: 20, oy: 40 }, span: 6, ppus: [18, 19.5] });
  const print = fnv32(cells, fnv32(JSON.stringify(fit))).toString(36);
  const PRINTS = Object.freeze({ 1: 'ua6qdv', 2: 'ua6qdv' });   // 2 (NIBEN-SEA): the trace's law moved, the mask's and the fit's not
  assert.equal(print, PRINTS[BOOT_CACHE_VERSION], `the laws answer otherwise than under BOOT_CACHE_VERSION ${BOOT_CACHE_VERSION}: move it and record '${print}' under the new number`);
});

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL'].every((f) => existsSync(join(ARENA2, f)));
test('BOOT-CACHE (AUDIT RELEASE R4-4) with ARENA2: the freeware\'s trace and relief kept at a first boot and taken at the next, byte for byte; with no IndexedDB the boot as before', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const bytes = (n) => new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), n)));
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  const idb = memoryIdb();
  const fresh = await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal, indexedDBRef: idb });
  await settle();
  const store = bootStore(idb), kept = await keptTrace(store, fresh.cacheKey);
  assert.ok(kept, 'kept at the first boot');
  for (const f of ['land', 'province', 'relief']) assert.ok(Buffer.from(kept[f]).equals(Buffer.from(fresh[f])), `${f} byte for byte`);
  // a returning boot takes what is kept (a record planted under its key, with its own checksum, is what it answers)
  const planted = fresh.land.slice(); planted[0] ^= 1;
  await keepTrace(store, fresh.cacheKey, { ...fresh, land: planted });
  const again = await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal, indexedDBRef: idb });
  assert.equal(again.cacheKey, fresh.cacheKey);
  assert.ok(Buffer.from(again.land).equals(Buffer.from(planted)), 'taken from the store, not traced again');
  await keepTrace(store, fresh.cacheKey, fresh);
  // the trace's law and the relief's mask on the freeware's pictures, printed under BOOT_CACHE_VERSION
  const print = fnv32(fresh.relief, fnv32(fresh.province, fnv32(fresh.land))).toString(36);
  assert.equal(print, Object.freeze({ 1: '1akglnx', 2: 'cev4vj' })[BOOT_CACHE_VERSION], `the trace or the relief answers otherwise than under BOOT_CACHE_VERSION ${BOOT_CACHE_VERSION}: move it and record '${print}' under the new number`);
  const plain = await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal, indexedDBRef: null });
  assert.equal(plain.cacheKey, undefined);
  for (const f of ['land', 'province', 'relief']) assert.ok(Buffer.from(plain[f]).equals(Buffer.from(fresh[f])));
});
