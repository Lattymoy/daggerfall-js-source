// TAMRIEL4 (2026-10-09, bible/03-World/Tamriel.md) - THE CONTINENT, TRACED PROPERLY, pinned.
//
// The owner, with the map in hand: "increase the accuracy and fidelity of the tamerial ingame map. Its not properly
// traced". Four faults of TAMRIEL3's trace, each seen on the freeware data: the picker's one-pixel border lines read as
// sea (a 15 km strait down every border, inked as a double coast and streamed as water); the painting's dabs of blue in
// the land read as lakes; the fit scored the inside of the Bay, where the picture is never drawn, and left the painted
// coasts 100-200 Bay pixels off the data's at the Bay's edge; and the coast was the pixels' staircase simplified, with
// the lore map's rivers drawn straight across it and out to sea. No file ships; the pins trace synthetic pictures, and
// where ARENA2_PATH names the data they hold the trace and the fit on the player's own two files.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { traceTamrielPicture, closeBorderLines, fillSpecks, HOLE_PX, pieces, paletteReader } from '../src/ui/tamrielTrace.js';
import { fitBayToPicture, FIT_PPUS, FIT_AREA_WEIGHT, setTamrielTrace, PROVINCE_OF_ID } from '../src/world/tamrielLand.js';
import { setTamrielFit, bayToPicture, BAY_W, BAY_H } from '../src/world/tamrielFrame.js';
import {
  contourSegments, chaikinCapped, dropEdgeRuns, tracedChains, buildTamrielInk, STITCH_REACH, SMOOTH_PASSES, COAST_SIMPLIFY_PX,
  COAST_CUT_PX, BORDER_SNAP_PX,
} from '../src/ui/tamrielInk.js';
import { linkSegments } from '../src/ui/inkMap.js';
import { RIVERS } from '../src/world/tamrielGeography.js';

const ARENA2 = process.env.ARENA2_PATH;
const HAVE_ARENA2 = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'MAP.PAL', 'WOODS.WLD', 'MAPS.BSA', 'CLIMATE.PAK'].every((f) => existsSync(join(ARENA2, f)));
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
afterEach(() => { setTamrielTrace(null); setTamrielFit(null); });

/** A grid from rows of characters: '.' sea, a digit a province's land. */
function grid(rows) {
  const h = rows.length, w = rows[0].length;
  const land = new Uint8Array(w * h), province = new Uint8Array(w * h);
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (c !== '.') { land[y * w + x] = 1; province[y * w + x] = Number(c); } }));
  return { w, h, land, province };
}
const show = (g) => Array.from({ length: g.h }, (_, y) => Array.from({ length: g.w }, (_, x) => (g.land[y * g.w + x] ? String(g.province[y * g.w + x]) : '.')).join(''));

test('TAMRIEL4 border lines: a pixel of no land between two DIFFERENT provinces (west-east or north-south) is the picker\'s border line - land, of the province most of its neighbours hold; a line\'s corner closes on the next pass; a channel inside one province and a coast\'s inner corner stay sea', () => {
  const g = grid([
    '.........',
    '.111.333.',
    '.111.333.',
    '.111.333.',
    '.........',
    '.........',
    '.11.11...',
    '.11.11...',
    '.........',
  ]);
  assert.equal(closeBorderLines(g.land, g.province, g.w, g.h), 3);
  assert.deepEqual(show(g), [
    '.........',
    '.1111333.',
    '.1111333.',
    '.1111333.',
    '.........',
    '.........',
    '.11.11...',
    '.11.11...',
    '.........',
  ], 'the line between 1 and 3 is land (a tie of neighbours goes to the lower id); the channel inside 1 stays sea, and a strait of two pixels');
  // the rule's one reading of a strait ONE pixel wide between two provinces: their border (the picture has none past the Bay)
  const strait = grid(['.....', '.333.', '.....', '.111.', '.....']);
  assert.equal(closeBorderLines(strait.land, strait.province, strait.w, strait.h), 3);
  // a T where three provinces meet: the arms on the first pass, the meeting pixel on the next
  const t = grid([
    '.........',
    '.111.333.',
    '.111.333.',
    '.........',
    '.2222222.',
    '.2222222.',
    '.........',
  ]);
  assert.equal(closeBorderLines(t.land, t.province, t.w, t.h), 9);
  assert.equal(t.land[3 * t.w + 4], 1, 'the meeting pixel closed on the second pass');
  // the real picker's shape: an 8-connected diagonal line
  const d = grid(['11.33', '1.333', '.3333']);
  closeBorderLines(d.land, d.province, d.w, d.h);
  assert.equal(d.land[1 * d.w + 1], 1, 'a diagonal step of the line');
});

test('TAMRIEL4 specks: a hole in the land smaller than HOLE_PX is the painting\'s dab - land, of its rim\'s province; a hole of HOLE_PX is a lake; the sea round the picture is never filled', () => {
  assert.equal(HOLE_PX, 6);
  const g = grid([
    '..........',
    '.2222222..',
    '.2.22..2..',
    '.2222..2..',
    '.2222222..',
    '..........',
  ]);
  const hole = grid(['........', '.333333.', '.3...33.', '.3...33.', '.333333.', '........']);
  assert.equal(fillSpecks(g.land, g.province, g.w, g.h), 5, 'the one-pixel dab and the four-pixel pool, both under HOLE_PX');
  assert.equal(g.land[2 * g.w + 2], 1);
  assert.equal(g.province[2 * g.w + 2], 2);
  assert.equal(fillSpecks(hole.land, hole.province, hole.w, hole.h), 0, 'six pixels: a lake');
  assert.equal(hole.land[2 * hole.w + 2], 0);
  assert.equal(g.land[0], 0, 'the sea at the edge');
});

test('TAMRIEL4 trace: the two run after the remainder - a picker line between Breton and Redguard is land, a dab in Nord is filled, the lakes and the pond stand', () => {
  const W = 320, H = 200;
  const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && y >= y0 && x < x1 && y < y1;
  const picker = { width: W, height: H, data: new Uint8Array(W * H) };
  const picture = { width: W, height: H, data: new Uint8Array(W * H) };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (rect(40, 30, 140, 90)(x, y)) picker.data[i] = 1;
    if (rect(40, 91, 140, 150)(x, y)) picker.data[i] = 2;   // the line: row 90 claimed by no race
    if (rect(180, 30, 280, 90)(x, y) && !rect(200, 50, 202, 52)(x, y)) picker.data[i] = 3;   // a 4 px dab in Nord
    if (rect(60, 40, 66, 46)(x, y)) picker.data[i] = 0;   // a lake in Breton, 36 px
  }
  const t = traceTamrielPicture(picker, picture, (i) => (i === 1 ? [40, 60, 200] : [210, 180, 130]));
  for (let x = 40; x < 140; x++) assert.equal(t.land[90 * W + x], 1, `the border line at ${x}, 90 is land`);
  assert.equal(t.land[50 * W + 200], 1, 'the dab');
  assert.equal(t.province[50 * W + 200], 3);
  assert.equal(t.land[42 * W + 62], 0, 'the lake');
});

/** The fixture's lands, as tamriel3.test.js lays them (Breton, Redguard, Nord, and the Imperial Province between). */
function lands() {
  const W = 320, H = 200;
  const land = new Uint8Array(W * H), province = new Uint8Array(W * H);
  const put = (x0, y0, x1, y1, p) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { land[y * W + x] = 1; province[y * W + x] = p; } };
  put(40, 30, 140, 90, 1); put(40, 90, 140, 150, 2); put(180, 30, 280, 90, 3); put(140, 30, 180, 90, 9);
  return { w: W, h: H, land, province };
}

test('TAMRIEL4 fit: THE SEAM FIRST - a Bay whose inside is a sea the picture has not (its own water where the painting has land) is found where its EDGE agrees, not where its inside does; the edge\'s cells and the inside\'s are both reported', () => {
  const trace = lands();
  const OX = 30, OY = 20, PPU = 18;
  const cols = Math.floor(BAY_W / PPU), rows = Math.floor(BAY_H / PPU);
  const truth = (x, y) => !!trace.land[Math.floor(OY + y / PPU) * trace.w + Math.floor(OX + x / PPU)];
  // the Bay's inside, six cells in from every edge, is sea
  const inland = (x, y) => { const i = Math.floor(x / PPU), j = Math.floor(y / PPU); return i >= 6 && i < cols - 6 && j >= 6 && j < rows - 6; };
  const bayLand = (x, y) => !inland(x, y) && truth(x, y);
  const fit = fitBayToPicture({ bayLand, trace, around: { ox: 30, oy: 22 }, span: 10, ppus: [18] });
  assert.deepEqual([fit.ox, fit.oy, fit.ppu], [OX, OY, PPU], 'the edge decides');
  assert.equal(fit.edge, 2 * (cols + rows));
  assert.equal(fit.seam, fit.edge, 'every edge cell agrees there');
  assert.ok(fit.score < fit.cells * 0.75, `${fit.score} of ${fit.cells} inside: the sea the picture has not`);
  // an inside-only fit would have gone elsewhere: some offset of the window agrees better inside
  let bestInside = 0;
  for (let oy = 12; oy <= 32; oy++) for (let ox = 20; ox <= 40; ox++) {
    let s = 0;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      let n = 0;
      for (const [dx, dy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) if (bayLand(Math.floor((i + dx) * PPU), Math.floor((j + dy) * PPU))) n++;
      if ((n >= 2 ? 1 : 0) === trace.land[(oy + j) * trace.w + ox + i]) s++;
    }
    bestInside = Math.max(bestInside, s);
  }
  assert.ok(bestInside > fit.score, `the inside alone prefers another place (${bestInside} > ${fit.score})`);
  assert.equal(FIT_AREA_WEIGHT, 0.25);
  assert.deepEqual([FIT_PPUS[0], FIT_PPUS[FIT_PPUS.length - 1], FIT_PPUS.length], [15, 21, 25], 'every quarter, 15 to 21');
  assert.ok(FIT_PPUS.includes(15.5));
});

test('TAMRIEL4 contour: the land\'s 0.5 contour over its pixel centres - an edge between land and sea crossed at its middle, a lone pixel a diamond, a saddle\'s two lands kept apart', () => {
  const one = linkSegments(contourSegments((x, y) => x === 1 && y === 1, 3, 3));
  assert.equal(one.length, 1);
  const ring = one[0];
  assert.deepEqual(ring[0], ring[ring.length - 1], 'closed');
  assert.deepEqual(new Set(ring.slice(0, -1).map((p) => `${p.x},${p.y}`)), new Set(['1,1.5', '1.5,1', '2,1.5', '1.5,2']), 'the pixel (1,1) centred at (1.5, 1.5): the middles between its centre and its four neighbours\'');
  const saddle = linkSegments(contourSegments((x, y) => (x === 0 && y === 0) || (x === 1 && y === 1), 2, 2));
  assert.equal(saddle.length, 2, 'two diagonal lands are two coasts');
  for (const c of saddle) assert.deepEqual(c[0], c[c.length - 1], 'each closed round its own land');
  const off = linkSegments(contourSegments((x, y) => x === 0 && y === 0, 1, 1));
  assert.equal(off.length, 1, 'land at the picture\'s edge is closed by the sea round it');
});

test('TAMRIEL4 smoothing: Chaikin\'s cut keeps an open chain\'s ends and closes a ring; each cut at most a quarter of its run and never past `maxCut`', () => {
  const open = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
  const c = chaikinCapped(open, 1);
  assert.deepEqual(c[0], { x: 0, y: 0 }); assert.deepEqual(c[c.length - 1], { x: 10, y: 10 });
  assert.deepEqual(c.slice(1, -1), [{ x: 7.5, y: 0 }, { x: 10, y: 2.5 }], 'the corner cut a quarter of each run');
  const capped = chaikinCapped(open, 1, 0.75);
  assert.deepEqual(capped.slice(1, -1), [{ x: 9.25, y: 0 }, { x: 10, y: 0.75 }], 'and no more than maxCut');
  const sq = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }, { x: 0, y: 0 }];
  const r = chaikinCapped(sq, 2);
  assert.deepEqual(r[0], r[r.length - 1]);
  assert.equal(r.length, 4 * 2 * 2 + 1, 'every corner cut, twice');
  assert.deepEqual([SMOOTH_PASSES, COAST_SIMPLIFY_PX, COAST_CUT_PX, BORDER_SNAP_PX], [3, 0.4, 0.75, 1.5]);
});

test('TAMRIEL4 ink on the trace: the coast stays within half a picture pixel of the traced land and no corner is square; a border\'s ends sit on the coast\'s line; a run along the Bay\'s frame is no shore; the lore map\'s rivers are not drawn on the picture', () => {
  const trace = lands();
  setTamrielTrace(trace);
  setTamrielFit({ ox: 50 * 18, oy: 40 * 18, ppu: 18 });
  const ch = tracedChains(trace);
  const toPic = (p) => bayToPicture(p.x, p.y);
  // the union's outline: x 40..280 at y 30..90, x 40..140 down to 150
  const offOutline = ([px, py]) => {
    const d = [];
    if (py >= 29 && py <= 91) d.push(Math.abs(px - 40), Math.abs(px - 280));
    if (px >= 39 && px <= 281) d.push(Math.abs(py - 30));
    if (py >= 89 && py <= 151) d.push(Math.abs(px - 40), Math.abs(px - 140));
    if (px >= 39 && px <= 141) d.push(Math.abs(py - 150));
    if (px >= 139 && px <= 281) d.push(Math.abs(py - 90));
    return Math.min(...d);
  };
  for (const c of ch.coast) for (const p of c) assert.ok(offOutline(toPic(p)) <= 0.55, `${toPic(p)} within half a pixel of the land`);
  assert.ok(!ch.coast.flat().some((p) => { const [px, py] = toPic(p); return Math.abs(px - 40) < 1e-6 && Math.abs(py - 30) < 1e-6; }), 'the corner is drawn round, not square');
  const round = ch.coast.flat().filter((p) => { const [px, py] = toPic(p); return Math.hypot(px - 40.5, py - 30.5) < 1.2; }).length;
  assert.ok(round >= 4, `${round} points round the corner: a curve, not the contour's one 45-degree cut`);
  const toLine = (ex, ey) => {
    let d = Infinity;
    for (const c of ch.coast) for (let i = 0; i + 1 < c.length; i++) {
      const [ax, ay] = toPic(c[i]), [bx, by] = toPic(c[i + 1]), dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((ex - ax) * dx + (ey - ay) * dy) / l2)) : 0;
      d = Math.min(d, Math.hypot(ax + dx * t - ex, ay + dy * t - ey));
    }
    return d;
  };
  for (const b of ch.borders) {
    for (const end of [b[0], b[b.length - 1]]) {
      const [ex, ey] = toPic(end);
      const atCoast = toLine(ex, ey);
      const atJunction = ch.borders.some((o) => o !== b && [o[0], o[o.length - 1]].some((q) => Math.hypot(q.x - end.x, q.y - end.y) < 1e-6));
      assert.ok(atCoast < 0.06 || atJunction, `a border's end ON the coast's line or at a meeting of borders: ${ex}, ${ey} (${atCoast})`);
    }
  }
  // a border that meets a stepped shore at a pixel's corner, off the contour's cut: moved onto it
  const step = grid([
    '..........',
    '.....2222.',
    '....12222.',
    '...112222.',
    '..1112222.',
    '..1112222.',
    '..........',
  ]);
  setTamrielTrace(step);
  const sc = tracedChains(step);
  assert.equal(sc.borders.length, 1);
  const top = [sc.borders[0][0], sc.borders[0][sc.borders[0].length - 1]].map(toPic).sort((a, b) => a[1] - b[1])[0];
  let best = Infinity;
  for (const c of sc.coast) for (let i = 0; i + 1 < c.length; i++) {
    const [ax, ay] = toPic(c[i]), [bx, by] = toPic(c[i + 1]), dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((top[0] - ax) * dx + (top[1] - ay) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(ax + dx * t - top[0], ay + dy * t - top[1]));
  }
  assert.ok(best < 0.06, `the border's top end on the stepped shore's line, to the ink's own simplification (${best} off) - the pixel corner (5, 2) is a third of a pixel off it`);
  setTamrielTrace(trace);
  // the frame
  const r = { x0: 0, y0: 0, x1: 100, y1: 50 };
  assert.deepEqual(dropEdgeRuns([{ x: -5, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 30 }, { x: -5, y: 30 }], r), [[{ x: -5, y: 10 }, { x: 0, y: 10 }], [{ x: 0, y: 30 }, { x: -5, y: 30 }]]);
  assert.deepEqual(dropEdgeRuns([{ x: -5, y: 10 }, { x: 0, y: 12 }], r), [[{ x: -5, y: 10 }, { x: 0, y: 12 }]], 'a chain that only ends on the frame is kept');
  const ink = buildTamrielInk();
  assert.deepEqual(ink.rivers, [], 'the picture\'s own water is its rivers');
  assert.equal(ink.traced, true);
  setTamrielTrace(null);
  assert.ok(buildTamrielInk().rivers.length >= RIVERS.length - 1, 'the authored shape keeps its rivers');
  assert.equal(STITCH_REACH, 64);
});

test('TAMRIEL4 by source: the trace closes the lines and the dabs after the remainder; the ink drops the frame\'s runs from the traced coast; the host logs the edge it fitted', () => {
  const trace = read('src/ui/tamrielTrace.js');
  assert.match(trace, /if \(rem\) for \(let i = 0; i < rem\.length; i\+\+\) if \(rem\[i\] && !land\[i\]\) \{ land\[i\] = 1; province\[i\] = IMPERIAL_ID; \}\s*\n\s*closeBorderLines\(land, province, w, h\);[^\n]*\n\s*fillSpecks\(land, province, w, h\);/);
  const ink = read('src/ui/tamrielInk.js');
  assert.match(ink, /for \(const c of traced\.coast\) for \(const piece of clipOutsideRect\(c, rect\)\) coast\.push\(\.\.\.dropEdgeRuns\(piece, rect\)\);/);
  assert.match(ink, /if \(!traced\) for \(const rv of RIVERS\)/);
  assert.match(read('src/scenes/world.js'), /% of its cells and \$\{fit \? Math\.round\(\(100 \* fit\.seam\) \/ fit\.edge\) : 0\}% of its edge agreeing`\);/);
});

test('TAMRIEL4 with ARENA2: the player\'s own picture - no strait down any border, the painting\'s six waters and nothing else enclosed, 26,636 land pixels; the Bay fitted at (38, 57) x15.5 with 190 of its 192 edge cells agreeing', { skip: HAVE_ARENA2 ? false : 'ARENA2_PATH not set' }, async () => {
  const { ImgFile } = await import('../src/formats/imgFile.js');
  const { DFPalette } = await import('../src/formats/dfPalette.js');
  const { WoodsFile } = await import('../src/formats/woodsFile.js');
  const { MapsFile } = await import('../src/formats/mapsFile.js');
  const { isWaterPixel } = await import('../src/ui/overworldModel.js');
  const f = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const pic = new ImgFile(); pic.load(f('TMAP00I0.IMG'), 'TMAP00I0.IMG');
  const pal = new DFPalette(); pal.load(f('MAP.PAL'), 'MAP.PAL');
  const pk = new ImgFile(); pk.load(f('TAMRIEL2.IMG'), 'TAMRIEL2.IMG');
  const t = traceTamrielPicture(pk.getDFBitmap(), pic.getDFBitmap(), paletteReader(pal));
  assert.equal(t.land.reduce((n, v) => n + v, 0), 26636);
  const holes = pieces(t.land.map((v) => 1 - v), t.w, t.h).filter((p) => !p.edge).map((p) => p.cells.length).sort((a, b) => a - b);
  assert.deepEqual(holes, [11, 15, 20, 49, 115, 281], 'Lake Rumare\'s two pieces, Hammerfell\'s two lakes, the Niben, the Inner Sea');
  // no strait: every pixel between two provinces' land is land
  for (let y = 1; y < t.h - 1; y++) for (let x = 1; x < t.w - 1; x++) {
    const i = y * t.w + x;
    if (t.land[i]) continue;
    for (const [a, b] of [[i - 1, i + 1], [i - t.w, i + t.w]]) assert.ok(!(t.land[a] && t.land[b] && t.province[a] !== t.province[b]), `a strait at ${x}, ${y} between ${PROVINCE_OF_ID[t.province[a]]} and ${PROVINCE_OF_ID[t.province[b]]}`);
  }
  const woods = new WoodsFile(); woods.load(f('WOODS.WLD'));
  const maps = new MapsFile(); maps.load(f('MAPS.BSA'), f('CLIMATE.PAK'), f('POLITIC.PAK'));
  const fit = fitBayToPicture({ bayLand: (x, y) => !isWaterPixel(maps.getClimateIndex(x, y), woods.getHeightMapValue(x, y)), trace: t });
  assert.deepEqual(fit, { ox: 38, oy: 57, ppu: 15.5, score: 1537, cells: 2048, seam: 190, edge: 192 });
});
