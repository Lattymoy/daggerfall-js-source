// SMOOTH-LAND (2026-10-26, bible/03-World/Tamriel.md SMOOTH-LAND; the owner, asked whether to smooth the coasts and the
// province borders: "Whatever is most detailed"): the land past the Bay is one smooth law (world/tamriel/tamrielLand.js
// landLabelAt) - every picture centre its own side, a square of four centres one label that label whole, the outline
// between them the centres' contour made smooth - and every line the maps draw is its edges at the map's own pixel
// (world/tamriel/tamrielLines.js lawLines): the held map's coasts and borders, Cyrodiil's zone line. Its readers follow
// it without a copy: the ground's bytes, the places' pixels, the picture's sea, the zone, the lanes' moorings. Where
// ARENA2_PATH names the data, the freeware's own picture: no staircase left, every place on its own province's land.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  setTamrielTrace, tamrielTrace, landLaw, landLabelAt, landSideAt, provinceLeadAt, coastDepthAt, provinceKeyAt, provinceKeyBeyondBay,
  SMOOTH_LAND, PROVINCE_OF_ID,
} from '../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit, pictureToBay, bayToPicture } from '../../src/world/tamriel/tamrielFrame.js';
import { lawLines, linkPieces, squareEnds, segKey, LINE_BISECT } from '../../src/world/tamriel/tamrielLines.js';
import { tracedChains, INK_THIN } from '../../src/ui/tamrielInk.js';
import { cyrodiilMask, zoneLineOf } from '../../src/systems/wild/cyrodiilZone.js';
import { wildInside } from '../../src/systems/wild/wildZone.js';
import { authoredHeightByte } from '../../src/world/tamriel/tamrielGround.js';
import { pictureSea } from '../../src/world/arenaPlaces.js';
import { pictureSeaMask, beyondLaneWay, worldLaneWater, moorCell, MOOR_REACH } from '../../src/scenes/naval/worldLanes.js';
import { theatreAt } from '../../src/world/worldWide/worldGrid.js';
import { NATIVE_PIXEL } from '../../src/systems/seaRaiders.js';
import { CLIMATES } from '../../src/formats/mapsTables.js';

afterEach(() => { setTamrielTrace(null); setTamrielFit(null); });

/** A 40 x 30 picture: the sea round it; a block of land (x 6..34, y 6..24) whose north-west coast is a staircase (land
 *  where x + y >= 22), Skyrim (3) west of x 20, Cyrodiil (9) east of it and Elsweyr (7) under y 18 - three borders that
 *  meet inside the land at (20, 18); a bay of the sea into Cyrodiil's north-east (x 30..34, y 6..11); a lone pixel of
 *  Skyrim at (2, 2); two of Cyrodiil's meeting at a corner only, (2, 26) and (3, 27), and two of Skyrim's on the other
 *  diagonal, (37, 2) and (36, 3). */
function picture() {
  const w = 40, h = 30, land = new Uint8Array(w * h), province = new Uint8Array(w * h);
  const put = (x, y, p) => { land[y * w + x] = p ? 1 : 0; province[y * w + x] = p; };
  for (let y = 6; y < 25; y++) for (let x = 6; x < 35; x++) if (x + y >= 22) put(x, y, x < 20 ? 3 : y >= 18 ? 7 : 9);
  for (let y = 6; y < 12; y++) for (let x = 30; x < 35; x++) put(x, y, 0);
  put(2, 2, 3); put(2, 26, 9); put(3, 27, 9); put(37, 2, 3); put(36, 3, 3);
  return { w, h, land, province };
}
const labelOf = (t, x, y) => (x >= 0 && y >= 0 && x < t.w && y < t.h && t.land[y * t.w + x] ? t.province[y * t.w + x] : 0);
/** The picture east of the Bay, 16 map pixels a picture pixel (map x = 2000 + 16 px). */
const FIT = { ox: -2000, oy: 0, ppu: 16 };
const install = (fit = FIT) => { const t = picture(); setTamrielFit(fit); setTamrielTrace(t); return t; };

/** Even-odd inside over closed chains, read at map pixels' centres (row y's crossings at y + 0.5). */
function insideOf(chains) {
  const rows = new Map();
  for (const c of chains) {
    for (let i = 0; i + 1 < c.length; i++) {
      const p = c[i], q = c[i + 1];
      if (p.y === q.y) continue;
      const lo = Math.min(p.y, q.y), hi = Math.max(p.y, q.y);
      for (let y = Math.ceil(lo - 0.5); y + 0.5 < hi; y++) if (y + 0.5 >= lo) (rows.get(y) ?? rows.set(y, []).get(y)).push(p.x + ((q.x - p.x) * (y + 0.5 - p.y)) / (q.y - p.y));
    }
  }
  for (const xs of rows.values()) xs.sort((a, b) => a - b);
  return (x, y) => { const xs = rows.get(y) ?? []; let k = 0; while (k < xs.length && xs[k] <= x + 0.5) k++; return k % 2 === 1; };
}
/** The sharpest turn along a chain, degrees (a point within a twentieth of a pixel of the one before it - a crossing on
 *  a pixel's own centre, where the line runs through it - one with it). */
function sharpest(c0) {
  const c = c0.filter((p, i) => i === 0 || Math.hypot(p.x - c0[i - 1].x, p.y - c0[i - 1].y) > 0.05);
  let turn = 0;
  for (let i = 1; i + 1 < c.length; i++) {
    const a1 = Math.atan2(c[i].y - c[i - 1].y, c[i].x - c[i - 1].x), a2 = Math.atan2(c[i + 1].y - c[i].y, c[i + 1].x - c[i].x);
    turn = Math.max(turn, Math.abs(((a2 - a1 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI));
  }
  return (turn * 180) / Math.PI;
}

test('SMOOTH-LAND the law: every picture centre its own label; a square of four centres one label that label whole; a straight run of coast or border the pixels\' own edge, a staircase\'s diagonal one straight line, a convex corner cut and a concave one filled, a lone pixel a round islet, a strait on the diagonal open; the waterline itself the sea\'s, a border\'s own line the lower id\'s (mutants: the dials; the marching cases; the saddle joined; Chaikin\'s cut; the bilinear read; the near centres; the square\'s label; the waterline land; the tie)', () => {
  const t = install(), L = landLaw(tamrielTrace());
  assert.deepEqual({ ...SMOOTH_LAND }, { reach: 2, clamp: 1, passes: 3 });
  for (let y = 0; y < t.h; y++) {
    for (let x = 0; x < t.w; x++) {
      assert.equal(landLabelAt(L, x + 0.5, y + 0.5), labelOf(t, x, y), `the centre of ${x}, ${y} its own`);
      assert.equal(provinceKeyAt(x + 0.5, y + 0.5), PROVINCE_OF_ID[labelOf(t, x, y)] ?? null);
    }
  }
  // a square of four centres one label: that label at every point of it (an eighth of a pixel apart)
  let whole = 0;
  for (let py = 0.0625; py < t.h; py += 0.125) {
    for (let px = 0.0625; px < t.w; px += 0.125) {
      const ix = Math.floor(px - 0.5), iy = Math.floor(py - 0.5), l = labelOf(t, ix, iy);
      if (labelOf(t, ix + 1, iy) !== l || labelOf(t, ix, iy + 1) !== l || labelOf(t, ix + 1, iy + 1) !== l) continue;
      whole++;
      assert.equal(landLabelAt(L, px, py), l, `${px}, ${py} in a square all ${l}`);
    }
  }
  assert.ok(whole > 60000, `${whole} points in squares of one label`);
  // a straight run: the south coast on y 25 and Skyrim's border with Cyrodiil on x 20, to the pixels' own edge
  for (let x = 10; x <= 17; x += 0.5) { assert.equal(landLabelAt(L, x, 24.998), 3); assert.equal(landLabelAt(L, x, 25.002), 0); }
  for (let y = 9; y <= 15; y += 0.5) { assert.equal(landLabelAt(L, 19.998, y), 3); assert.equal(landLabelAt(L, 20.002, y), 9); }
  assert.equal(landLabelAt(L, 12.5, 25), 0, 'the waterline itself the sea\'s');
  assert.deepEqual([landLabelAt(L, -50, 10), landLabelAt(L, 10, t.h + 50), landLabelAt(L, t.w + 50, 10)], [0, 0, 0], 'far off the picture, the sea');
  assert.equal(landLabelAt(L, 20, 12), 3, 'a border\'s own line the lower id\'s');
  // the staircase's diagonal (its centres' middles on x + y = 22.5): one straight line, a fiftieth of a pixel either way
  for (let x = 8.5; x <= 13.5; x += 0.125) {
    const y = 22.5 - x;
    assert.equal(landLabelAt(L, x - 0.02, y - 0.02), 0, `${x}: the sea short of the diagonal`);
    assert.equal(landLabelAt(L, x + 0.02, y + 0.02), 3, `${x}: the land past it`);
  }
  // round the corners, along each one's diagonal: where the land's side changes
  const along = (x0, y0, dx, dy) => { let a = 0, b = 1; for (let n = 0; n < 30; n++) { const m = (a + b) / 2; if (landSideAt(L, x0 + dx * m, y0 + dy * m) === landSideAt(L, x0, y0)) a = m; else b = m; } return (a + b) / 2; };
  // (from a centre toward the corner, the corner itself at 0.5): a convex corner cut - the land's corner the sea's - and a
  // concave one filled - the sea's the land's; a lone pixel a round islet, as far out along a side as on the diagonal
  const convex = along(34.5, 24.5, 1, 1), concave = along(30.5, 11.5, -1, 1), islet = along(2.5, 2.5, 1, 0), isletDiag = along(2.5, 2.5, 1, 1);
  assert.ok(convex < 0.3 && landLabelAt(L, 35, 25) === 0 && landLabelAt(L, 34.85, 24.85) === 0, `the convex corner cut: the coast ${convex.toFixed(4)} out along its diagonal`);
  assert.ok(concave < 0.3 && landLabelAt(L, 30, 12) === 9 && landLabelAt(L, 30.15, 11.85) === 9, `the concave corner filled: the sea ${concave.toFixed(4)} out along its diagonal`);
  assert.deepEqual([convex, concave, islet, isletDiag].map((v) => Math.round(v * 1000)), [252, 252, 460, 317], 'the corners\' own measure');
  assert.ok(islet < 0.5 && Math.abs(islet - Math.SQRT2 * isletDiag) < 0.02, `a lone pixel a round islet (${islet.toFixed(3)} along a side, ${(Math.SQRT2 * isletDiag).toFixed(3)} on the diagonal)`);
  // a strait on the diagonal: the corner the two of Cyrodiil's pixels meet at is the sea's, a channel through it
  assert.equal(landLabelAt(L, 3, 27), 0, 'the strait open');
  for (let s = -0.4; s <= 0.4; s += 0.05) assert.equal(landLabelAt(L, 3 + s, 27 - s), 0, `the channel at ${s}`);
  assert.equal(landLabelAt(L, 37, 3), 0, 'the strait on the other diagonal open');
  for (let s = -0.4; s <= 0.4; s += 0.05) assert.equal(landLabelAt(L, 37 + s, 3 + s), 0, `its channel at ${s}`);
  // each pixel of a strait's pair reaches toward the corner as far as its own contour cuts it
  assert.deepEqual([along(2.5, 26.5, 1, 1), along(36.5, 3.5, 1, -1)].map((v) => Math.round(v * 1000)), [274, 274], 'the straits\' measure');
  // the square's label: a square of one the law's own, MIXED where they differ
  const P = (L.W - t.w) / 2;
  assert.equal(L.uni[(P + 12) * L.W + P + 12], 3);
  assert.equal(L.uni[(P + 24) * L.W + P + 10], 255, 'the square on the south coast mixed');
});

test('SMOOTH-LAND the law\'s distance: the coast\'s waterline 0, half a pixel at a centre beside a straight run, held to the clamp inland and at sea, the clamp\'s sea off the picture, none without a trace; each province\'s own; one law a picture, the same from a copy of its arrays bit for bit (mutants: the clamp; the off-picture sea; the sign)', () => {
  assert.equal(coastDepthAt(5, 5), null, 'no trace');
  const t = install();
  assert.equal(coastDepthAt(12.5, 24.5), 0.5);
  assert.equal(coastDepthAt(12.5, 25.5), -0.5);
  assert.equal(coastDepthAt(12.5, 25), 0);
  assert.equal(coastDepthAt(12.5, 20.5), SMOOTH_LAND.clamp, 'inland, the clamp');
  assert.equal(coastDepthAt(37.5, 15.5), -SMOOTH_LAND.clamp, 'at sea');
  assert.equal(coastDepthAt(-1, 5), -SMOOTH_LAND.clamp, 'off the picture, the sea');
  const L = landLaw(tamrielTrace());
  assert.equal(landLaw(tamrielTrace()), L, 'made once');
  assert.equal(L.fieldOf(9)[(L.H / 2) * L.W], -SMOOTH_LAND.clamp);
  assert.ok(provinceLeadAt(L, 19.9, 12, 3, 9) && !provinceLeadAt(L, 20.1, 12, 3, 9) && provinceLeadAt(L, 20.1, 12, 9, 3));
  assert.ok(provinceLeadAt(L, 20, 12, 3, 9) && !provinceLeadAt(L, 20, 12, 9, 3), 'a tie the lower id\'s');
  assert.ok(provinceLeadAt(L, 37.5, 15.5, 0, 9) && !provinceLeadAt(L, 25.5, 12.5, 0, 9), 'the sea\'s own distance leads at sea, a province\'s on its land');
  assert.ok(landSideAt(L, 12.5, 15.5) && !landSideAt(L, 38.5, 15.5), 'a square of one label, the land\'s side or the sea\'s whole');
  const copy = landLaw({ w: t.w, h: t.h, land: Uint8Array.from(t.land), province: Uint8Array.from(t.province) });
  assert.notEqual(copy, L);
  assert.ok(Buffer.from(copy.S.buffer).equals(Buffer.from(L.S.buffer)), 'the land\'s distance bit for bit');
  for (const id of [3, 7, 9]) assert.ok(Buffer.from(copy.fieldOf(id).buffer).equals(Buffer.from(L.fieldOf(id).buffer)), `province ${id}'s`);
  assert.equal(copy.T[1], null, 'no field for a province the picture has none of');
});

test('SMOOTH-LAND the lines: every crossing on the law\'s own edge to the halving\'s thousandth of a pixel; a map pixel inside the coast\'s rings exactly when the law calls it land and inside a province\'s exactly when its; three borders meeting at one middle and each border\'s ends on a coast\'s; no corner sharper than a curve\'s; a square\'s ends its neighbours\' (mutants: the halvings; the border\'s ask; the junction; the walk\'s reach; the run through a junction)', () => {
  install();
  const lines = lawLines(tamrielTrace());
  assert.equal(lawLines(tamrielTrace()), lines, 'kept');
  assert.equal(LINE_BISECT, 10);
  const { segs, squares } = lines.all();
  assert.ok(squares.length > 1500 && segs.length >= squares.length, `${squares.length} squares, ${segs.length} pieces`);
  // the ends' own: a square's right its east neighbour's left, its bottom the one below's top, its five distinct
  const e = squareEnds(2040, 100), r = squareEnds(2041, 100), b = squareEnds(2040, 101);
  assert.deepEqual([e.right, e.bottom], [r.left, b.top]);
  assert.equal(new Set(Object.values(e)).size, 6);
  // every crossing between the two labels of its edge, a two-thousandth of a pixel either way - but by a meeting point,
  // where a third label can hold the crossing of the other two's own distances
  const meets = [...lines.points.entries()].filter(([id]) => id % 4 >= 2).map(([, p]) => p);
  let crossings = 0, third = 0;
  for (const s of segs) {
    for (const id of [s.a, s.b]) {
      const kind = id % 4, p = lines.points.get(id);
      if (kind >= 2) continue;   // a meeting point
      crossings++;
      const [dx, dy] = kind === 0 ? [1, 0] : [0, 1];
      const lab = (k) => landLabelAt(landLaw(tamrielTrace()), ...bayToPicture(p.x + dx * k, p.y + dy * k));
      const lo = lab(-0.002), hi = lab(0.002);
      if (lo === hi) { third++; assert.ok(meets.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 2), `the crossing at ${p.x}, ${p.y} between its labels`); continue; }
      assert.equal(lo, lines.label(Math.floor(p.x - 0.5 * dx), Math.floor(p.y - 0.5 * dy)));
    }
  }
  assert.ok(crossings > 3000 && third < 8, `${crossings} crossings, ${third} by a meeting point`);
  // the centre rule, over every map pixel of the picture and a pixel round it
  const coast = linkPieces(segs.filter((s) => s.kind === 'coast'), lines.points);
  for (const c of coast) assert.deepEqual(c[0], c.at(-1), 'a coast\'s ring closed');
  assert.equal(coast.length, 6, 'the land, the islet and the two pairs of the straits, each pixel its own ring');
  const of = (id) => insideOf(linkPieces(segs.filter((s) => Math.floor(s.pair / 16) === id || s.pair % 16 === id), lines.points));
  const land = insideOf(coast), mine = { 3: of(3), 7: of(7), 9: of(9) };
  let n = 0, off = 0;
  for (let y = -1; y <= 30 * 16; y++) {
    for (let x = 1999; x <= 2000 + 40 * 16; x++) {
      const l = lines.label(x, y);
      if (land(x, y) !== (l !== 0) || [3, 7, 9].some((id) => mine[id](x, y) !== (l === id))) off++;
      n++;
    }
  }
  assert.ok(n > 300000);
  assert.equal(off, 0, 'a map pixel inside a line exactly when the law\'s label is its');
  // the borders: three, each from the middle where the three meet to a coast's middle
  const borders = linkPieces(segs.filter((s) => s.kind === 'border'), lines.points);
  assert.equal(borders.length, 3);
  const meet = pictureToBay(20, 18), ends = borders.map((c) => [c[0], c.at(-1)]);
  const coastEnds = new Set(segs.filter((s) => s.kind === 'coast').flatMap((s) => [s.a, s.b]).filter((id) => id % 4 === 2).map((id) => `${lines.points.get(id).x},${lines.points.get(id).y}`));
  for (const [p, q] of ends) {
    const [inner, outer] = Math.hypot(p.x - meet[0], p.y - meet[1]) < Math.hypot(q.x - meet[0], q.y - meet[1]) ? [p, q] : [q, p];
    assert.ok(Math.hypot(inner.x - meet[0], inner.y - meet[1]) < 8, `a border from the meeting (${inner.x}, ${inner.y})`);
    assert.ok(coastEnds.has(`${outer.x},${outer.y}`), `to a coast's middle (${outer.x}, ${outer.y})`);
  }
  const r2 = (v) => Math.round(v * 100) / 100;
  assert.deepEqual([...new Set(ends.map(([p, q]) => (Math.hypot(p.x - meet[0], p.y - meet[1]) < 8 ? `${r2(p.x)},${r2(p.y)}` : `${r2(q.x)},${r2(q.y)}`)))], ['2323.37,288'], 'one point for the three - a fifth of a picture pixel east of the picture\'s corner, the middle of their crossings');
  // no staircase: the sharpest turn of any line a curve's
  for (const c of [...coast, ...borders]) assert.ok(sharpest(c) < 30, `a turn of ${sharpest(c).toFixed(1)} degrees`);
});

test('SMOOTH-LAND a saddle of the map\'s own pixels, one picture pixel a map pixel: the strait\'s square joined as the law at its middle says - the two of Cyrodiil\'s apart, each its own ring - and the zone\'s line the same (mutants: the saddle\'s join, the lines\' and the zone\'s)', () => {
  install({ ox: -2000, oy: 0, ppu: 1 });
  const lines = lawLines(tamrielTrace());
  const sq = lines.square(2002, 26);
  assert.deepEqual(sq.l, [9, 0, 9, 0], 'the strait\'s square: a saddle');
  const coast = linkPieces(lines.all().segs.filter((s) => s.kind === 'coast'), lines.points);
  const small = coast.filter((c) => c.every((p) => p.x < 2005 && p.y > 25));
  assert.equal(small.length, 2, 'the two pixels each a ring');
  const m = cyrodiilMask();
  assert.ok(wildInside(m, 2002, 26) && wildInside(m, 2003, 27) && !wildInside(m, 2003, 26));
  const zone = zoneLineOf(tamrielTrace());
  assert.equal(zone.chains.filter((c) => c.every((p) => p.x < 2005 && p.y > 25)).length, 2, 'the zone\'s line round each');
});

test('SMOOTH-LAND three labels about a square, one picture pixel a map pixel: two of one label on a diagonal are two lines past each other where the law\'s middle holds them apart (two islets of two provinces, the sea between: each its own ring, no border), else the other two meet between them at two points on the chords about the twice-held\'s corners, a line between them (Cyrodiil and Elsweyr meeting between two corners of Skyrim\'s: each its own ring) (mutants: the diagonal\'s pass; its meeting points; the line between them)', () => {
  const w = 16, h = 10, land = new Uint8Array(w * h), province = new Uint8Array(w * h);
  const put = (x, y, p) => { land[y * w + x] = 1; province[y * w + x] = p; };
  put(1, 1, 3); put(2, 2, 9);   // two islets on a diagonal, the sea round them
  const block = ['333003', '033337', '303990', '737390', '000379', '937370'];   // about (10, 4): Skyrim, Cyrodiil, Skyrim, Elsweyr
  block.forEach((r, y) => [...r].forEach((c, x) => put(8 + x, 2 + y, Number(c))));
  setTamrielFit({ ox: -2000, oy: 0, ppu: 1 }); setTamrielTrace({ w, h, land, province });
  const lines = lawLines(tamrielTrace()), { segs } = lines.all();
  const near = (c, x0, y0, x1, y1) => c.every((p) => p.x >= 2000 + x0 && p.x <= 2000 + x1 && p.y >= y0 && p.y <= y1);
  // the islets: the sea on the diagonal, the law's middle the sea's - two rings, no border
  const isle = lines.square(2001, 1);
  assert.deepEqual(isle.l, [3, 0, 9, 0]);
  assert.equal(isle.segs.length, 2);
  assert.ok(isle.segs.every((s) => s.kind === 'coast'));
  const coast = linkPieces(segs.filter((s) => s.kind === 'coast'), lines.points);
  assert.equal(coast.filter((c) => near(c, 0, 0, 4, 4)).length, 2, 'each islet its own ring');
  assert.equal(segs.filter((s) => s.kind === 'border' && s.side[0] < 2005).length, 0, 'no border between them');
  // Skyrim on the diagonal, Cyrodiil and Elsweyr the other two - and the law's middle Cyrodiil's: the two meet between
  // Skyrim's two corners
  const sq = lines.square(2010, 4);
  assert.deepEqual(sq.l, [3, 9, 3, 7]);
  assert.equal(sq.segs.length, 5, 'four to the two meeting points, one between');
  const ends = squareEnds(2010, 4), between = sq.segs.find((s) => s.a === ends.mid && s.b === ends.second);
  assert.ok(between && between.kind === 'border' && between.pair === 7 * 16 + 9, 'Elsweyr | Cyrodiil between the meetings');
  const [m1, m2] = [lines.points.get(ends.mid), lines.points.get(ends.second)];
  assert.ok(m1.x > 2010.5 && m1.x < 2011.5 && m1.y > 4.5 && m1.y < 5.5 && m2.x > 2010.5 && m2.x < 2011.5 && m2.y > 4.5 && m2.y < 5.5, 'both inside the square');
  assert.ok(m1.x + m1.y < m2.x + m2.y, 'the first about the top-left corner, the second about the bottom-right');
  assert.equal(landLabelAt(landLaw(tamrielTrace()), 11, 5), 9, 'the law\'s middle Cyrodiil\'s');
  const skyrim = linkPieces(segs.filter((s) => Math.floor(s.pair / 16) === 3 || s.pair % 16 === 3), lines.points);
  for (const c of skyrim) assert.deepEqual(c[0], c.at(-1), 'Skyrim\'s rings closed');
  const ringOf = (x, y) => skyrim.findIndex((c) => insideOf([c])(x, y));
  assert.ok(ringOf(2010, 4) >= 0 && ringOf(2011, 5) >= 0 && ringOf(2010, 4) !== ringOf(2011, 5), 'Skyrim\'s two corners in two rings');
});

test('SMOOTH-LAND its readers, one law without a copy: a map pixel\'s province (provinceKeyBeyondBay, theatreAt), the ground\'s bytes, the picture\'s sea under the places and the ports, the lanes\' open sea a cell\'s centre, Cyrodiil\'s zone to the pixel and its line\'s centre rule, the held map\'s lines the law\'s own points thinned by a quarter of a pixel (mutants: a reader on the picture\'s pixel; the zone\'s kinds; the ink\'s thinning)', () => {
  const t = install();
  const lines = lawLines(tamrielTrace()), m = cyrodiilMask();
  const theatre9 = theatreAt(2000 + 16 * 25, 16 * 15);
  const off = { key: 0, theatre: 0, sea: 0, ground: 0, zone: 0 };
  for (let y = 0; y < 30 * 16; y += 1) {
    for (let x = 2000; x < 2000 + 40 * 16; x += 1) {
      const l = lines.label(x, y), [qx, qy] = bayToPicture(x + 0.5, y + 0.5);
      if (provinceKeyBeyondBay(x, y) !== (PROVINCE_OF_ID[l] ?? null)) off.key++;
      if ((theatreAt(x, y) === theatre9) !== (l === 9)) off.theatre++;
      if (pictureSea(t, x, y) !== (l === 0)) off.sea++;
      if ((x + y) % 3 === 0 && (authoredHeightByte(qx, qy) > 0) !== (l !== 0)) off.ground++;
      if (wildInside(m, x, y) !== (l === 9)) off.zone++;
    }
  }
  assert.deepEqual(off, { key: 0, theatre: 0, sea: 0, ground: 0, zone: 0 }, 'every reader the law\'s');
  const sea = pictureSeaMask(tamrielTrace());
  for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) assert.equal(sea(x, y), labelOf(t, x, y) === 0, `cell ${x}, ${y}`);
  // the zone's line: a pixel the zone's exactly when its centre lies inside; its coast and its borders the law's kinds
  const zone = zoneLineOf(tamrielTrace());
  const inZone = insideOf(zone.chains);
  let apart = 0;
  for (let y = 0; y < 30 * 16; y++) for (let x = 2000; x < 2000 + 40 * 16; x++) if (inZone(x, y) !== wildInside(m, x, y)) apart++;
  assert.equal(apart, 0, 'a pixel the zone\'s exactly when its centre lies inside its line');
  assert.ok(zone.coast.length >= 1 && zone.borders.length === 1, `the zone's coast and its one border, Skyrim's and Elsweyr's through their meeting (${zone.borders.length})`);
  const law = lines.all().segs, kindOf = new Map(law.map((s) => [segKey(s), s.kind]));
  assert.ok([...zone.keys].every((k) => kindOf.has(k)), 'every piece of the zone\'s line a piece of the law\'s');
  const coastLen = (cs) => cs.reduce((n, c) => n + c.slice(1).reduce((d, p, i) => d + Math.hypot(p.x - c[i].x, p.y - c[i].y), 0), 0);
  assert.ok(Math.abs(coastLen(zone.borders) - coastLen(linkPieces(law.filter((s) => s.kind === 'border' && (s.pair % 16 === 9)), lines.points))) < 1e-9, 'the zone\'s borders the law\'s borders of Cyrodiil');
  // the ink: every point a point of the law's, every law point within a quarter of a pixel of the ink's line
  assert.equal(INK_THIN, 0.25);
  const ink = tracedChains(tamrielTrace()), pts = new Set([...lines.points.values()].map((p) => `${p.x},${p.y}`));
  for (const c of [...ink.coast, ...ink.borders]) for (const p of c) assert.ok(pts.has(`${p.x},${p.y}`), `an ink point (${p.x}, ${p.y}) the law's`);
  const drawn = [...ink.coast, ...ink.borders];
  const offInk = (p) => Math.min(...drawn.flatMap((c) => c.slice(1).map((q, i) => {
    const a = c[i], dx = q.x - a.x, dy = q.y - a.y, l2 = dx * dx + dy * dy;
    const u = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    return Math.hypot(a.x + dx * u - p.x, a.y + dy * u - p.y);
  })));
  let k = 0;
  for (const p of lines.points.values()) if (k++ % 7 === 0) assert.ok(offInk(p) <= 0.2501, `the law's point ${p.x}, ${p.y} ${offInk(p).toFixed(3)} off the ink`);
});

test('SMOOTH-LAND a lane\'s mooring: a roadstead on the law\'s sea whose picture cell\'s centre is land (a corner the law rounded) leaves from the nearest cell of the picture\'s sea it reaches straight on the lane water, within MOOR_REACH - and its way past the Bay stands; its own cell where that is the sea\'s; none in reach, none (mutants: the mooring refused; the reach; the straight leg unasked; the nearest not first)', () => {
  install();
  assert.equal(MOOR_REACH, 2);
  const lw = worldLaneWater({ bayOpen: () => false, water: (x, y) => provinceKeyBeyondBay(x, y) === null, climateAt: () => CLIMATES.Ocean, beyond: () => true });
  // the convex corner at picture (35, 25): map pixel (2558, 398) is the law's sea in the land's cell (34, 24)
  const [qx, qy] = bayToPicture(2558.5, 398.5);
  assert.deepEqual([Math.floor(qx), Math.floor(qy), provinceKeyBeyondBay(2558, 398)], [34, 24, null]);
  const way = beyondLaneWay({ a: { road: { x: 2558, y: 398 } }, b: { road: { x: 2000 + 38 * 16 + 8, y: 10 * 16 + 8 } } }, lw.openNative);
  assert.ok(way && way.pts.length >= 2, 'the way stands');
  const first = way.pts[0];
  assert.deepEqual([Math.floor(first.x / NATIVE_PIXEL), 499 - Math.floor(first.z / NATIVE_PIXEL)], [2558, 398], 'from the roadstead');
  for (let i = 1; i < way.pts.length; i++) {
    const a = way.pts[i - 1], b = way.pts[i];
    for (let s = 1; s < 64; s++) assert.ok(lw.openNative(a.x + ((b.x - a.x) * s) / 64, a.z + ((b.z - a.z) * s) / 64), `leg ${i} on the lane water`);
  }
  // the mooring itself: its own cell where that is the sea's; else the nearest whose straight leg holds; none in reach
  const sea = pictureSeaMask(tamrielTrace()), native = (p) => ({ x: p[0], z: p[1] });
  assert.deepEqual(moorCell(37.2, 15.7, sea, native, () => true), [37, 15]);
  assert.deepEqual(moorCell(qx, qy, sea, native, () => true), [35, 24], 'the nearest, the first in rows of two as near');
  assert.deepEqual(moorCell(qx, qy, sea, native, (a, b) => !(b.x === 35.5 && b.z === 24.5)), [34, 25], 'the next where the nearest\'s leg crosses land');
  assert.equal(moorCell(12.5, 15.5, sea, native, () => true), null, 'no sea within reach');
  assert.deepEqual(moorCell(32.5, 13.5, sea, native, () => true), [32, 11], 'two cells off');
});

// ── WITH ARENA2: THE FREEWARE'S OWN PICTURE ───────────────────────

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TAMRIEL2.IMG', 'TMAP00I0.IMG', 'ART_PAL.COL', 'MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));

test('SMOOTH-LAND with ARENA2: on the player\'s own picture no staircase is left - no corner of the law\'s labels on a picture pixel\'s corner with straight legs of eight map pixels, where the picture\'s own law stood one at every step of its coasts and borders; the law\'s lines curves (a coast\'s turn under 20 degrees at the map\'s pixel, a border\'s under 50 where three meet); every place past the Bay on its own province\'s land and every port beside the law\'s sea (mutants: the law on the picture\'s pixels)', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const bytes = (n) => new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), n)));
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const tr = tamrielTrace(), lines = lawLines(tr), { ox, oy, ppu } = { ox: 589, oy: 883.5, ppu: 15.5 };
  // the staircase's corners: at every picture corner whose four pixels are not one label, the map pixels about it
  let stairs = 0, corners = 0;
  const lab = (x, y) => lines.label(x, y);
  const pic = (x, y) => (x >= 0 && y >= 0 && x < tr.w && y < tr.h && tr.land[y * tr.w + x] ? tr.province[y * tr.w + x] : 0);
  for (let Y = 1; Y < tr.h; Y++) {
    for (let X = 1; X < tr.w; X++) {
      const a = pic(X - 1, Y - 1);
      if (a === pic(X, Y - 1) && a === pic(X - 1, Y) && a === pic(X, Y)) continue;
      corners++;
      const cx = Math.round(X * ppu - ox), cy = Math.round(Y * ppu - oy);
      if (cx > -9 && cx < 1009 && cy > -9 && cy < 509) continue;   // the Bay's own
      for (let j = cy - 1; j <= cy + 1; j++) {
        for (let i = cx - 1; i <= cx + 1; i++) {
          const q = [lab(i - 1, j - 1), lab(i, j - 1), lab(i - 1, j), lab(i, j)];
          if (new Set(q).size !== 2 || (q[0] === q[3] && q[1] === q[2])) continue;
          const odd = [0, 1, 2, 3].find((k) => q.filter((v) => v === q[k]).length === 1);
          if (odd === undefined) continue;
          const sx = odd % 2 ? 1 : -1, sy = odd > 1 ? 1 : -1, hx = odd % 2 ? 0 : -1, hy = odd > 1 ? 0 : -1;
          let legs = true;
          for (let k = 1; k <= 8 && legs; k++) {
            if (lab(i + hx + sx * k, j - 1) === lab(i + hx + sx * k, j)) legs = false;
            if (lab(i - 1, j + hy + sy * k) === lab(i, j + hy + sy * k)) legs = false;
          }
          if (legs) stairs++;
        }
      }
    }
  }
  assert.ok(corners > 3000, `${corners} picture corners on a coast or a border`);
  assert.equal(stairs, 0, 'no staircase\'s corner left');
  // the law's lines: curves - every coast's turn at the map's pixel a curve's, never a staircase's square one nor the
  // picture contour's 45-degree cut; a border's sharpest where three provinces meet
  const { segs } = lines.all();
  let coastTurn = 0, borderTurn = 0;
  for (const c of linkPieces(segs.filter((s) => s.kind === 'coast'), lines.points)) coastTurn = Math.max(coastTurn, sharpest(c));
  for (const c of linkPieces(segs.filter((s) => s.kind === 'border'), lines.points)) borderTurn = Math.max(borderTurn, sharpest(c));
  assert.ok(coastTurn < 20 && borderTurn < 50, `the sharpest turns: a coast's ${coastTurn.toFixed(1)} degrees, a border's ${borderTurn.toFixed(1)}`);
  // the places: each on its own province's land by the one law, a port beside its sea
  const AP = await import('../../src/world/arenaPlaces.js');
  const { stood } = AP.arenaPixels();
  assert.ok(stood.length > 280);
  for (const p of stood) {
    assert.equal(provinceKeyBeyondBay(p.bx, p.by), p.province, `${p.name} on its own land`);
    if (p.port) assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].some(([dx, dy]) => AP.pictureSea(tr, p.bx + dx, p.by + dy)), `${p.name} beside the sea`);
  }
});
