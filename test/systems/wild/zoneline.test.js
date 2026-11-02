// ZONE-LINE (2026-10-26, the owner: "Also ensure the pvp border outlines cyrodil perfectly, currently it doesnt";
// bible/11-Multiplayer/Wild-Zone.md section 27): THE ZONE IS THE PROVINCE TO THE PIXEL, AND ONE LINE DRAWS BOTH. A cell
// of four had stood whole where its middle pixel stood - the zone a 3.3 km staircase about the province (9,012 map pixels
// of the two apart on the freeware's picture), its red line that staircase smoothed, and the province's own line on the
// held map the picture smoothed another way. Now a pixel is the zone's by the province's own law (systems/wild/wildZone.js
// buildWildMask's `bits`, the cells a pre-test where they are whole), and the red line, the zone map's edge and the
// province's own line are one line (systems/wild/cyrodiilZone.js zoneLineOf): a pixel is the zone's exactly when its
// middle lies inside it.
import '../../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildWildMask, fillEnclosed, wildInside, wildNear, wildRingAt, wildEdgeChains, wildOutline, wildJourney, ringOfCell, maskWorld, WILD_NEAR_PX } from '../../../src/systems/wild/wildZone.js';
import { cyrodiilMask, cyrodiilBox, zoneLineOf, provinceWaterAt, CYRODIIL_THEATRE } from '../../../src/systems/wild/cyrodiilZone.js';
import { wildGiantsAt } from '../../../src/systems/wild/wildGiants.js';
import { wildHallPicks } from '../../../src/systems/wild/wildDungeons.js';
import { zoneLine, zoneMapInk } from '../../../src/ui/wild/wildZoneMap.js';
import { wildInk } from '../../../src/ui/wild/wildMapInk.js';
import { tracedChains } from '../../../src/ui/tamrielInk.js';
import { setTamrielTrace, fitBayToPicture } from '../../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit, pictureToBay } from '../../../src/world/tamriel/tamrielFrame.js';
import { traceTamrielPicture, paletteReader } from '../../../src/ui/tamrielTrace.js';
import { theatreAt } from '../../../src/world/worldWide/worldGrid.js';

const ARENA2 = process.env.ARENA2_PATH;
const HAVE_ARENA2 = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'MAP.PAL', 'WOODS.WLD', 'MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));
const realSkip = HAVE_ARENA2 ? false : 'ARENA2_PATH not set (sh tools/fetch-data.sh)';
afterEach(() => { setTamrielTrace(null); setTamrielFit(null); });

/** The player's own trace and fit, as scenes/world.js makes them (test/systems/wild/audittesa2z_zone.test.js's reading). */
async function installPlayersPicture() {
  const { ImgFile } = await import('../../../src/formats/imgFile.js');
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { MapsFile } = await import('../../../src/formats/mapsFile.js');
  const { isWaterPixel } = await import('../../../src/ui/overworldModel.js');
  const f = (n) => new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), n)));
  const pic = new ImgFile(); pic.load(f('TMAP00I0.IMG'), 'TMAP00I0.IMG');
  const pal = new DFPalette(); pal.load(f('MAP.PAL'), 'MAP.PAL');
  const pk = new ImgFile(); pk.load(f('TAMRIEL2.IMG'), 'TAMRIEL2.IMG');
  const trace = traceTamrielPicture(pk.getDFBitmap(), pic.getDFBitmap(), paletteReader(pal));
  const woods = new WoodsFile(); woods.load(f('WOODS.WLD'));
  const maps = new MapsFile(); maps.load(f('MAPS.BSA'), f('CLIMATE.PAK'), f('POLITIC.PAK'));
  const fit = /** @type {any} */ (fitBayToPicture({ bayLand: (x, y) => !isWaterPixel(maps.getClimateIndex(x, y), woods.getHeightMapValue(x, y)), trace }));
  setTamrielTrace(trace);
  setTamrielFit({ ox: fit.ox * fit.ppu, oy: fit.oy * fit.ppu, ppu: fit.ppu });
  return trace;
}

/** A law constant on squares of `side` pixels from (sx, sy) - a picture's - square (i, j) the zone's where PATTERN says. */
const PATTERN = [
  '...........',
  '.#########.',
  '.#..####.#.',
  '.#..#.##.#.',
  '.####..#.#.',
  '.##.#.###..',
  '.#.#####.#.',
  '.##.#.#.##.',
  '..###.#####',   // a pocket open downward alone: the walk reaches it going up
  '...........',
];
const squares = (side, sx, sy) => (x, y) => {
  const i = Math.floor((x - sx) / side), j = Math.floor((y - sy) / side);
  return j >= 0 && j < PATTERN.length && i >= 0 && i < PATTERN[j].length && PATTERN[j][i] === '#';
};

/** The zone a law cuts on a grid, pixel by pixel - the law, and what it encloses (fillEnclosed, a pixel's sides alone). */
function expected(law, W, H) {
  const z = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) z[y * W + x] = law(x, y) ? 1 : 0;
  fillEnclosed(z, W, H);
  return z;
}

/** Every pixel of the grid against the expectation: inside, its ring, its band, the cells, the edge. */
function checkExact(m, law, label, nearPx = WILD_NEAR_PX) {
  const { cell, width, height } = m, W = width * cell, H = height * cell;
  const z = expected(law, W, H);
  const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? z[y * W + x] : 0);
  // the band: within `nearPx` pixels (both axes) of a zone pixel
  const rowNear = new Uint8Array(W * H), near = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let h = 0; for (let k = x - nearPx; k <= x + nearPx && !h; k++) h = at(k, y); rowNear[y * W + x] = h; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let h = 0; for (let k = Math.max(0, y - nearPx); k <= Math.min(H - 1, y + nearPx) && !h; k++) h = rowNear[k * W + x]; near[y * W + x] = h; }
  let sides = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = at(x, y) === 1;
      if (wildInside(m, x + 0.5, y + 0.5) !== v) assert.fail(`${label}: pixel ${x},${y} ${v ? 'in' : 'out'} by the law`);
      const r = wildRingAt(x, y, m);
      if (v ? r < 1 : r !== 0) assert.fail(`${label}: pixel ${x},${y} ring ${r} (${v ? 'in' : 'out'})`);
      if (near[y * W + x] && !wildNear(m, x, y)) assert.fail(`${label}: pixel ${x},${y} within the band, not near`);
      if (v) sides += [at(x, y - 1), at(x + 1, y), at(x, y + 1), at(x - 1, y)].filter((u) => !u).length;
    }
  }
  const mid = Math.floor(cell / 2);
  for (let cy = 0; cy < height; cy++) for (let cx = 0; cx < width; cx++) assert.equal(m.inside[cy * width + cx], at(cx * cell + mid, cy * cell + mid), `${label}: cell ${cx},${cy} its middle's`);
  // the edge: every side between a zone pixel and another, on the pixels' corners, and nothing else
  let length = 0;
  for (const c of wildEdgeChains(m)) {
    for (let i = 0; i + 1 < c.length; i++) {
      const a = c[i], b = c[i + 1];
      assert.ok(Number.isInteger(a.x) && Number.isInteger(a.y) && (a.x === b.x || a.y === b.y), `${label}: the edge on the pixels' corners`);
      length += Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const [p, q] = a.x === b.x ? [at(mx - 1, Math.floor(my)), at(mx, Math.floor(my))] : [at(Math.floor(mx), my - 1), at(Math.floor(mx), my)];
      assert.notEqual(p, q, `${label}: an edge between the zone and the rest`);
    }
  }
  assert.equal(length, sides, `${label}: the whole edge, once`);
  return z;
}

test('ZONE-LINE THE PIXEL\'S LAW ON THE CELLS: a law constant over squares wider than two cells, at every offset - every pixel the law\'s, what it encloses filled at the pixel (a corner no way out, a bay open), every ring and band and the edge to the pixel; a zone at the grid\'s edge (mutants: a band\'s diagonals unasked; the grid\'s edge unasked; the fill\'s last step unwritten; the walk\'s upward side unwalked; a bit\'s row and column swapped; the edge\'s ring dropped; the ring past the law; the band from the middles; the box of the middles)', () => {
  let cases = 0;
  for (let sy = 0; sy < 9; sy++) {
    for (let sx = 0; sx < 9; sx++) {
      const law = squares(9, sx, sy);
      const nearPx = (sx + sy) % 2 ? 8 : WILD_NEAR_PX;   // a band past six pixels too: a cell the zone only touches is its seed
      const m = buildWildMask({ width: 28, height: 25, cell: 4, nearPx, pixelIn: law });
      checkExact(m, law, `squares from ${sx},${sy}`, nearPx);
      cases++;
    }
  }
  assert.equal(cases, 81);
  // the zone at the grid's edge: every pixel but the last column, a band of rows - the edge cell's middle in, its last pixel out
  const edgeLaw = (x, y) => x < 4 * 12 - 1 && y >= 5 && y < 30;
  checkExact(buildWildMask({ width: 12, height: 9, cell: 4, pixelIn: edgeLaw }), edgeLaw, 'the grid\'s edge');
  // on the world: an origin moves the law with it
  const m = buildWildMask({ width: 28, height: 25, cell: 4, ox: 1036, oy: 200, pixelIn: (x, y) => squares(9, 3, 5)(x - 1036, y - 200) });
  for (let y = 0; y < 100; y += 3) for (let x = 0; x < 112; x += 1) assert.equal(wildInside(m, 1036 + x, 200 + y), wildInside(buildWildMask({ width: 28, height: 25, cell: 4, pixelIn: squares(9, 3, 5) }), x, y), `${x},${y} on the world`);
});

test('ZONE-LINE THE CELLS ARE THE ZONE\'S OWN STILL: with the pixel\'s law a cell is inside where its middle pixel is, its depth and ring as before, so the rings, the halls and the giants\' tiers stand where they stood; a zone pixel of a cell whose middle is out is the edge\'s ring; a fast journey and its fee by the pixel (mutants: the middle\'s bit at the corner)', () => {
  const law = squares(9, 2, 6);
  const exact = buildWildMask({ width: 28, height: 25, cell: 4, pixelIn: law });
  const z = expected(law, 112, 100);
  const cells = buildWildMask({ width: 28, height: 25, cell: 4, inZone: (cx, cy) => z[(cy * 4 + 2) * 112 + cx * 4 + 2] === 1 });
  assert.deepEqual(exact.inside, cells.inside, 'a cell inside where its middle is');
  assert.deepEqual(exact.depth, cells.depth, 'its depth');
  assert.equal(exact.maxDepth, cells.maxDepth);
  // a zone pixel whose cell's middle is out, and a pixel out whose cell's middle is in
  let inOut = null, outIn = null;
  for (let y = 0; y < 100 && !(inOut && outIn); y++) {
    for (let x = 0; x < 112; x++) {
      const c = exact.inside[Math.floor(y / 4) * 28 + Math.floor(x / 4)] === 1, v = z[y * 112 + x] === 1;
      if (v && !c && !inOut) inOut = { x, y };
      if (!v && c && !outIn) outIn = { x, y };
    }
  }
  assert.ok(inOut && outIn, 'the cells and the pixels part somewhere on this zone');
  assert.equal(wildRingAt(inOut.x, inOut.y, exact), 1, 'a zone pixel of a cell whose middle is out: The Borderlands');
  assert.equal(ringOfCell(exact, Math.floor(inOut.x / 4), Math.floor(inOut.y / 4)), 0);
  assert.equal(wildRingAt(outIn.x, outIn.y, exact), 0, 'a pixel past the line: no ring, whatever its cell');
  const far = { x: 500, y: 500 };
  assert.equal(wildJourney({ from: inOut, to: far, mask: exact, gold: 1e9 }).ok, false, 'from the zone\'s own pixel: out of the zone, refused');
  assert.deepEqual(wildJourney({ from: outIn, to: far, mask: exact, gold: 1e9 }), { ok: true, fee: 0 }, 'from a pixel past the line: no zone to leave');
});

test('ZONE-LINE THE GIANTS AND THE HALLS STAND IN THE ZONE TO THE PIXEL: a giant\'s walk never steps on a pixel past the line, its cell\'s middle in or not; a hall stands on a zone pixel', () => {
  const law = squares(9, 4, 1);
  const m = buildWildMask({ width: 28, height: 25, cell: 4, pixelIn: law });
  const free = () => true;
  let seen = 0;
  for (let t = 0; t < 4 * 24 * 3_600_000; t += 97_000) {
    for (const g of wildGiantsAt(m, free, 1.78e12 + t)) {
      seen++;
      if (!wildInside(m, g.x, g.y)) assert.fail(`giant ${g.g} at ${g.x.toFixed(2)},${g.y.toFixed(2)} (t ${t}) past the line`);
    }
  }
  assert.ok(seen > 1000, `the giants walked (${seen})`);
  for (const h of wildHallPicks(m, free, 20500)) assert.ok(wildInside(m, h.x, h.y), `hall ${h.key} on a zone pixel`);
});

/** A small picture: Cyrodiil (9) with a lake in it, Elsweyr (7) beside it, the sea round both, Cyrodiil's coast and
 *  Elsweyr's meeting at a corner of the border. */
function smallTrace() {
  const rows = [
    '..........',
    '.99999977.',
    '.9..99977.',
    '.9..99977.',
    '.99999777.',
    '.99999777.',
    '..9999.77.',
    '..........',
  ];
  const w = rows[0].length, h = rows.length, land = new Uint8Array(w * h), province = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = rows[y][x]; if (c !== '.') { land[y * w + x] = 1; province[y * w + x] = Number(c); } }
  return { w, h, land, province };
}

// PIN MOVED (SMOOTH-LAND, test/world/smoothland.test.js): the outline is the land's smooth law's line where the zone's
// pixels meet the rest (no longer the picture's pixel sides), the province's ink the same law's pieces with the outline's
// left to it - so a neighbour's coast and border end where the law's three labels meet, by the picture's corner (6, 6)
test('ZONE-LINE THE PROVINCE\'S INK IS THE ZONE\'S LINE: on a picture, Cyrodiil\'s coast and borders are the zone\'s outline - no smoothed copy of them beside it, the lake inside drawn as before, and a neighbour\'s coast and border ending on the outline where the law\'s three labels meet (mutants: the ink keeps Cyrodiil\'s border; the ink keeps its coast; a neighbour\'s coast stopped short)', () => {
  const trace = smallTrace();
  setTamrielFit({ ox: -2000, oy: 0, ppu: 16 });   // the picture east of the Bay (the zone is the world's pixels, the Bay none of it)
  setTamrielTrace(trace);
  const line = zoneLineOf(trace);
  const ink = tracedChains(trace);
  const P = (x, y) => { const [bx, by] = pictureToBay(x, y); return { x: bx, y: by }; };
  // the outline: Cyrodiil and its lake, against the sea and Elsweyr - one closed chain, its runs the ink's own
  assert.equal(line.chains.length, 1, 'one outline round the province and its lake');
  const outline = line.chains[0];
  assert.deepEqual(outline[0], outline.at(-1), 'closed');
  for (const run of line.coast) assert.ok(ink.coast.includes(run), 'the outline\'s coast in the ink\'s coast');
  for (const run of line.borders) assert.ok(ink.borders.includes(run), 'the outline\'s border in the ink\'s borders');
  assert.ok(line.coast.length >= 1 && line.borders.length >= 1);
  const fromOutline = (p) => Math.min(...outline.slice(1).map((b, i) => {
    const a = outline[i], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    return Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y);
  }));
  const onOutline = (p) => fromOutline(p) < 1e-6;
  // no other ink runs along the outline: a picture pixel (16) from its own ends, a line of the rest keeps off it - an
  // eighth of a picture pixel at the least (a copy of Cyrodiil's own line runs on it)
  const others = [...ink.coast, ...ink.borders].filter((c) => !line.coast.includes(c) && !line.borders.includes(c));
  for (const c of others) {
    const ends = [c[0], c[c.length - 1]];
    for (let i = 0; i + 1 < c.length; i++) {
      for (const f of [0.25, 0.5, 0.75]) {
        const p = { x: c[i].x + (c[i + 1].x - c[i].x) * f, y: c[i].y + (c[i + 1].y - c[i].y) * f };
        if (ends.every((e) => Math.hypot(e.x - p.x, e.y - p.y) > 16)) assert.ok(fromOutline(p) > 2, `an ink line along the outline at ${p.x.toFixed(1)},${p.y.toFixed(1)}`);
      }
    }
  }
  // the lake inside Cyrodiil: its shore drawn, closed, all of it inside the outline's box and off the outline
  const lake = others.filter((c) => c.every((p) => p.x > P(2, 2).x - 8 && p.x < P(4, 4).x + 8 && p.y > P(2, 2).y - 8 && p.y < P(4, 4).y + 8));
  assert.equal(lake.length, 1, 'the lake\'s shore drawn');
  assert.deepEqual(lake[0][0], lake[0].at(-1));
  // Elsweyr's coast and border end on the outline: the coast where Cyrodiil's south coast meets Elsweyr (by the picture's
  // corner (6, 6), within a picture pixel), every end of the rest that comes within a picture pixel of the outline on it
  const ends = others.flatMap((c) => [c[0], c[c.length - 1]]);
  const corner = P(6, 6);
  assert.ok(ends.some((p) => Math.hypot(p.x - corner.x, p.y - corner.y) < 16 && onOutline(p)), 'Elsweyr\'s coast ends on the outline by the corner');
  for (const p of ends) if (fromOutline(p) < 16) assert.ok(onOutline(p), `an end beside the outline at ${p.x},${p.y} not on it`);
});

test('ZONE-LINE ON THE PLAYER\'S OWN PICTURE: every pixel of Cyrodiil\'s box the province\'s own law with what it encloses (0 apart); the cells as they stood; the red line, the fog\'s cut, the zone map\'s edge and the province\'s own ink one line, and a pixel the zone\'s exactly when its middle lies inside it; the giants inside it to the pixel, a day\'s leg walked whole (mutants: the giant\'s pixel unasked on its walk; unasked at its leash; the zone\'s cells again; the line untraced; the line\'s fill unasked; the red line smoothed again; the zone map\'s edge its own; the fog\'s line its own; the drawn edge the mask\'s alone)', { skip: realSkip }, async () => {
  const trace = await installPlayersPicture();
  const m = /** @type {any} */ (cyrodiilMask());
  assert.ok(m?.bits && m.line, 'the zone, to the pixel, and its line');
  const box = /** @type {any} */ (cyrodiilBox());
  const bx0 = box.x0 - 8, by0 = box.y0 - 8, bw = box.x1 - box.x0 + 17, bh = box.y1 - box.y0 + 17;
  // PIN MOVED (NIBEN-SEA, bible/03-World/Tamriel.md): and the province's own water (provinceWaterAt) - Lake Rumare and the
  // Niben joined to the sea, the province encloses them no more, and its banks keep them the zone's
  const law = (x, y) => theatreAt(bx0 + x, by0 + y) === CYRODIIL_THEATRE || provinceWaterAt(bx0 + x, by0 + y);
  const z = expected(law, bw, bh);
  let apart = 0, zone = 0;
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const v = wildInside(m, bx0 + x, by0 + y); zone += v ? 1 : 0; if (v !== (z[y * bw + x] === 1)) apart++; }
  assert.equal(apart, 0, 'the zone the province to the pixel');
  assert.ok(zone > 1_300_000, `a province's zone (${zone} pixels)`);
  // the cells as they stood: a cell inside where its middle pixel is the province's or enclosed
  const cell = m.cell, mid = Math.floor(cell / 2);
  for (let cy = 0; cy < m.height; cy += 3) for (let cx = 0; cx < m.width; cx++) {
    const [x, y] = maskWorld(m, cx, cy);
    assert.equal(m.inside[cy * m.width + cx] === 1, wildInside(m, x + mid, y + mid), `cell ${cx},${cy} its middle's`);
  }
  // one line: the red line and the zone map's edge are the outline; the province's ink holds it, run for run
  const red = zoneLine(m);
  assert.equal(red, m.line.chains);
  assert.equal(wildOutline(m), red);
  assert.equal(/** @type {any} */ (zoneMapInk(m, null)).edge, red);
  const paperless = /** @type {any} */ ({ createElement: () => ({ getContext: () => null }) });   // a document with no 2D context: the ink's chains alone
  assert.equal(/** @type {any} */ (wildInk(m, paperless)).chains, red, 'the red line and the fog\'s cut');
  const line = zoneLineOf(trace);
  assert.equal(line, m.line, 'the ink\'s line the zone\'s');
  const ink = tracedChains(trace);
  for (const run of line.coast) assert.ok(ink.coast.includes(run));
  for (const run of line.borders) assert.ok(ink.borders.includes(run));
  // the centre rule over the whole box: inside the line (even-odd, a row at a pixel's middle) exactly when the zone's
  const rows = new Map();
  for (const c of red) {
    for (let i = 0; i + 1 < c.length; i++) {
      const p = c[i], q = c[i + 1];
      if (p.y === q.y) continue;
      const lo = Math.min(p.y, q.y), hi = Math.max(p.y, q.y);
      for (let y = Math.ceil(lo - 0.5); y + 0.5 < hi; y++) if (y + 0.5 >= lo) (rows.get(y) ?? rows.set(y, []).get(y)).push(p.x + ((q.x - p.x) * (y + 0.5 - p.y)) / (q.y - p.y));
    }
  }
  let off = 0;
  for (let y = by0; y < by0 + bh; y++) {
    const xs = (rows.get(y) ?? []).sort((a, b) => a - b);
    let k = 0;
    for (let x = bx0; x < bx0 + bw; x++) { while (k < xs.length && xs[k] <= x + 0.5) k++; if ((k % 2 === 1) !== wildInside(m, x, y)) off++; }
  }
  assert.equal(off, 0, 'a pixel the zone\'s exactly when its middle lies inside the line');
  // the giants inside the line to the pixel, over a day of legs - and where the cells alone had stood them past it (the
  // freeware's picture, the free ground everywhere): a giant of the Borderlands half a leg past the line on a day's walk
  // and on the first leg of another (68 of 691,200 places over thirty days, 30 s apart)
  const at = (t) => new Map(wildGiantsAt(m, () => true, 1.78e12 + t).map((g) => [g.g, g]));
  for (let t = 0; t < 24 * 3_600_000; t += 600_000) for (const g of at(t).values()) assert.ok(wildInside(m, g.x, g.y), `giant ${g.g} past the line`);
  for (const t of [40_200_000, 1_912_560_000]) for (const g of at(t).values()) assert.ok(wildInside(m, g.x, g.y), `giant ${g.g} past the line at ${t}`);
  // a day's leg is walked whole, the line it walks inside to the pixel: never a halt and a leap at its middle (a waypoint
  // whose line crosses past the province's line is never chosen within a day)
  for (const t of [40_050_000, 40_770_000, 73_500_000]) {
    const a = /** @type {any} */ (at(t - 30_000).get(0)), b = /** @type {any} */ (at(t).get(0));
    assert.ok(Math.hypot(b.x - a.x, b.y - a.y) < 2, `giant 0 leapt ${Math.hypot(b.x - a.x, b.y - a.y).toFixed(2)} pixels at ${t}`);
  }
});
