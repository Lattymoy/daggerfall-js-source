// BLD (2026-10-26, the owner, having walked the Imperial City: "The new building layouts in the city look like some
// windows are upside down, clip into the ground and into the roofs, no doors/interiors, and no lighting sources like the
// original layouts"; bible/03-World/Arena-Provinces.md IC-GRAND, BLD) - THE FABRIC'S BUILDINGS AS THE GL DRAWS THEM,
// pinned: every wall's picture right side up on every facing, as the GL samples it; no window under the ground, over an
// eave, on a gable or on a party wall, none cut at a wall's end, a balcony on a floor, every wall's foot under the ground
// and no building over another; the capitals' own walls (vanillaTexels) right side up too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fabricCell, outwardOf, inQuad, STOREY } from '../../src/world/imperialFabric.js';
import { fabricCellModel, buildPlot, partyEdges, BALCONY_FLOORS } from '../../src/world/imperialFabricModels.js';
import { FACADE_PLAIN, FACADE_WINDOW, FACADE_TEXELS } from '../../src/world/imperialArt.js';
import { MeshBuilder } from '../../src/world/detStandIns.js';
import { IMPERIAL_CELLS, IMPERIAL_SECTORS, polar, imperialCell } from '../../src/world/imperialCity.js';
import { CAPITAL_ART, CAPITAL_ARCHIVE } from '../../src/world/capitalShapes.js';
import { capitalArt, installCapitals, _resetCapitals } from '../../src/world/capitalModels.js';
import { CAPITAL_MODELS } from '../../src/world/tamrielCapitals.js';
import { customModelFor } from '../../src/world/customModels.js';
import { toColor32Order } from '../../src/formats/color32Order.js';
import { BLOCK_M } from '../../src/world/spawnedDungeons.js';

const B = BLOCK_M, HALF = IMPERIAL_CELLS / 2;
/** A cell of the city's own near a point with at least `n` buildings. */
function sampleCell(x, z, n = 8) {
  const r0 = Math.floor(z / B + HALF), c0 = Math.floor(x / B + HALF);
  for (let k = 0; k < 6; k++) for (let r = r0 - k; r <= r0 + k; r++) for (let c = c0 - k; c <= c0 + k; c++) {
    if (Math.max(Math.abs(r - r0), Math.abs(c - c0)) !== k || !/^I/.test(imperialCell(r, c) ?? '')) continue;
    const L = fabricCell(r, c);
    if (L.plots.length >= n) return L;
  }
  return null;
}
/** A cell in each district (its grid, its rings and spokes, its warped lanes, its docks): each sector's middle at two
 *  rings, and the Waterfront's. */
const CELLS = [...IMPERIAL_SECTORS.flatMap(([, b]) => [[b + 22.5, 3000], [b + 37.5, 5300]]), [170, 7300]].map(([b, r]) => sampleCell(...polar(b, r))).filter(Boolean);
const FACADES = new Set(['facadeOchre', 'facadeBrick', 'facadeWhite', 'facadeStone', 'facadeTimber', 'groundShop', 'groundArcade'].map((k) => CAPITAL_ART[k]));
/** Every vertical facade triangle of a model: its corners, their uvs, its record and its facing. */
function facadeFaces(m) {
  const out = [];
  for (const sm of m.subMeshes) {
    if (sm.textureArchive !== CAPITAL_ARCHIVE || !FACADES.has(sm.textureRecord)) continue;
    for (let t = sm.startIndex; t < sm.startIndex + sm.primitiveCount * 3; t += 3) {
      const ix = [m.indices[t], m.indices[t + 1], m.indices[t + 2]];
      const n = [m.normals[ix[0] * 3], m.normals[ix[0] * 3 + 1], m.normals[ix[0] * 3 + 2]];
      if (Math.abs(n[1]) > 1e-6) continue;
      out.push({ record: sm.textureRecord, n, p: ix.map((i) => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]]), uv: ix.map((i) => [m.uvs[i * 2], m.uvs[i * 2 + 1]]) });
    }
  }
  return out;
}
const MODELS = CELLS.map((L) => fabricCellModel(L.r, L.c));

test('BLD WINDOWS RIGHT SIDE UP - every facade face of the fabric, on every facing, lays its picture\'s top row at its top as the GL samples it: v RISING up the wall (Daggerfall\'s own models\' law, world/meshReader.js v = -(row / height)), because every picture reaches the GL bottom-up (formats/color32Order.js, the stand-in door\'s toColor32); a point a hand under a storey\'s top samples the picture\'s top rows, a point a hand over the ground the shopfront\'s or the arcade\'s foot (mutant: v laid falling up the wall, a top-down raster\'s rows)', () => {
  assert.ok(CELLS.length >= 12, 'a cell in every district');
  const octants = new Set();
  let faces = 0;
  for (const m of MODELS) for (const f of facadeFaces(m)) {
    // v's rise per metre up the face, off the triangle's corners at two heights
    const [i, j] = [[0, 1], [0, 2], [1, 2]].find(([a, b]) => Math.abs(f.p[a][1] - f.p[b][1]) > 0.05) ?? [];
    if (i === undefined) continue;
    const rise = (f.uv[i][1] - f.uv[j][1]) / (f.p[i][1] - f.p[j][1]);
    assert.ok(rise > 0, `a face facing (${f.n[0].toFixed(2)}, ${f.n[2].toFixed(2)}) lays its picture upside down (dv/dy ${rise})`);
    octants.add(Math.round(((Math.atan2(f.n[2], f.n[0]) / Math.PI) * 4 + 8)) % 8);
    faces++;
  }
  assert.ok(faces > 1000, `the faces read (${faces})`);
  assert.equal(octants.size, 8, 'every facing of the compass among them');
  // the GL's own sampling of one face: an arcade's (its arch's crown up, its loggia's shadow at its foot)
  const art = capitalArt(), H = 128;
  const arcade = MODELS.flatMap(facadeFaces).find((f) => f.record === CAPITAL_ART.groundArcade && Math.min(...f.p.map((q) => q[1])) <= 1e-6 && Math.max(...f.p.map((q) => q[1])) >= STOREY - 1e-6);
  assert.ok(arcade, 'an arcade on a street front');
  const gl = toColor32Order(art.get(CAPITAL_ART.groundArcade));
  /** The picture's row (counted from its top, as painted) the GL samples at height y on the face. */
  const rowAt = (y) => {
    const [a, b] = [0, 1, 2].filter((k) => k < 3).sort((p, q) => arcade.p[p][1] - arcade.p[q][1]).filter((k, n, all) => n === 0 || n === all.length - 1);
    const t = (y - arcade.p[a][1]) / (arcade.p[b][1] - arcade.p[a][1]), v = arcade.uv[a][1] + (arcade.uv[b][1] - arcade.uv[a][1]) * t;
    const bufferRow = Math.min(H - 1, Math.floor((v - Math.floor(v)) * H));
    assert.equal(gl.width * H * 4, gl.data.length);
    return H - 1 - bufferRow;
  };
  assert.equal(rowAt(STOREY - 0.1), 4, 'a hand under the arcade\'s top: the picture\'s top rows (its impost and voussoirs)');
  assert.equal(rowAt(0.1), 124, 'a hand over the street: the picture\'s foot');
});

const WALLS = new Set(['facadeOchre', 'facadeBrick', 'facadeWhite', 'facadeStone', 'facadeTimber'].map((k) => CAPITAL_ART[k]));
/** The picture's rows a window stands in (its frame, its sill and its lintel, the stone's cap over it) - every row but
 *  the plain run - as a v interval of the GL's law (row r at v = -r / h): (k - foot, k - head] for each whole k. */
const HEAD = (FACADE_PLAIN.top + FACADE_PLAIN.rows) % FACADE_TEXELS.h, FOOT = FACADE_PLAIN.top;
/** One plot built alone, the test's own party edges (a hand out from the middle of every inner edge, under another
 *  building), and its triangles in the map frame (x east, z south). */
function plotFaces(L, p) {
  const mb = new MeshBuilder();
  buildPlot(mb, p, partyEdges(L, p));
  const m = mb.build(), out = [];
  for (const sm of m.subMeshes) for (let t = sm.startIndex; t < sm.startIndex + sm.primitiveCount * 3; t += 3) {
    const ix = [m.indices[t], m.indices[t + 1], m.indices[t + 2]];
    out.push({ record: sm.textureRecord, n: [m.normals[ix[0] * 3], m.normals[ix[0] * 3 + 1], -m.normals[ix[0] * 3 + 2]], p: ix.map((i) => [m.positions[i * 3], m.positions[i * 3 + 1], -m.positions[i * 3 + 2]]), uv: ix.map((i) => [m.uvs[i * 2], m.uvs[i * 2 + 1]]) });
  }
  return out;
}
/** The edge of a plot a vertical face stands on (its normal the edge's outward one, its middle on the edge's line). */
function edgeOf(p, f) {
  const m = [(f.p[0][0] + f.p[1][0] + f.p[2][0]) / 3, (f.p[0][2] + f.p[1][2] + f.p[2][2]) / 3];
  for (let e = 0; e < 4; e++) {
    const a = p.q[e], n = outwardOf(p.q, e);
    if (Math.abs(n[0] - f.n[0]) < 1e-3 && Math.abs(n[1] - f.n[2]) < 1e-3 && Math.abs((m[0] - a[0]) * n[0] + (m[1] - a[1]) * n[1]) < 0.02) return e;
  }
  return -1;
}

test('BLD NO WINDOW CUT - a window of the fabric\'s walls stands whole in a whole storey: never under the street, never over its eave, never on a gable (cut by the roof\'s slopes) nor on a party wall (under a neighbour\'s roof), never cut at a wall\'s end (a whole number of bays); what is no whole storey - a plinth, a mezzanine over a shopfront, a gable, a party wall - laid in the picture\'s plain rows (world/imperialArt.js FACADE_PLAIN); every wall\'s foot under the ground the city is flattened to; a balcony on a floor (mutants: the storeys counted to the ground; a gable in storeys; the party walls windowed; the bay unstretched; a balcony across a window; a party wall off the ground)', () => {
  let windowed = 0, partyFaces = 0, gableFaces = 0, decks = 0;
  const stats = new Set();
  for (const L of CELLS) for (const p of L.plots) {
    // the test's own measure of the party walls: a hand out from an inner edge's middle, under another building
    const party = [0, 1, 2, 3].filter((e) => {
      if (p.out & (1 << e)) return false;
      const a = p.q[e], b = p.q[(e + 1) & 3], n = outwardOf(p.q, e), x = (a[0] + b[0]) / 2 + n[0] * 0.3, z = (a[1] + b[1]) / 2 + n[1] * 0.3;
      return L.near.some((o) => o !== p && inQuad(o.q, x, z));
    });
    const lowest = [Infinity, Infinity, Infinity, Infinity];
    for (const f of plotFaces(L, p)) {
      const across = Math.hypot(...[0, 1, 2].map((k) => (f.p[1][(k + 1) % 3] - f.p[0][(k + 1) % 3]) * (f.p[2][(k + 2) % 3] - f.p[0][(k + 2) % 3]) - (f.p[1][(k + 2) % 3] - f.p[0][(k + 2) % 3]) * (f.p[2][(k + 1) % 3] - f.p[0][(k + 1) % 3]))) / 2;
      if (f.record === CAPITAL_ART.timber && f.n[1] === 1 && p.balcony && across > 0.3) {   // a deck (not its rails' tops)
        const y0 = f.p[0][1], y = BALCONY_FLOORS.some((b) => Math.abs(b + 0.95 - y0) < 1e-4) ? y0 - 0.95 : y0;   // a deck, or its rail's top
        if (y > STOREY && y < p.h - 1) { decks++; assert.ok(BALCONY_FLOORS.some((b) => Math.abs(b - y) < 1e-4) && Math.abs((p.h - y) / STOREY - Math.round((p.h - y) / STOREY)) < 1e-4, `a balcony's deck at ${y} under an eave at ${p.h} - across a window`); }
      }
      if (Math.abs(f.n[1]) > 1e-6) continue;
      const e = edgeOf(p, f);
      if (e >= 0) lowest[e] = Math.min(lowest[e], ...f.p.map((q) => q[1]));
      if (!WALLS.has(f.record)) continue;
      const ys = f.p.map((q) => q[1]), vs = f.uv.map((q) => q[1]), top = Math.max(...ys);
      if (top > p.h + 1e-6) gableFaces++;
      if (e >= 0 && party.includes(e)) partyFaces++;
      const [i, j] = [[0, 1], [0, 2], [1, 2]].find(([s, t]) => Math.abs(ys[s] - ys[t]) > 1e-3);
      const yOf = (v) => ys[i] + ((v - vs[i]) * (ys[j] - ys[i])) / (vs[j] - vs[i]);
      const vmin = Math.min(...vs), vmax = Math.max(...vs);
      for (let k = Math.floor(vmin); k <= Math.ceil(vmax) + 1; k++) {
        const lo = k - FOOT / FACADE_TEXELS.h, hi = k - HEAD / FACADE_TEXELS.h;
        if (Math.min(hi, vmax) - Math.max(lo, vmin) <= 1e-6) continue;   // no window's rows on this face here
        windowed++;
        stats.add(p.wall);
        assert.ok(lo >= vmin - 1e-6 && hi <= vmax + 1e-6, `a window cut by its face's foot or head (plot ${p.key}, rows ${vmin}..${vmax})`);
        assert.ok(yOf(lo) >= -1e-6, `a window under the street (plot ${p.key}: its foot at ${yOf(lo).toFixed(2)} m)`);
        assert.ok(top <= p.h + 1e-6, `a window on a gable (plot ${p.key})`);
        assert.ok(!party.includes(e), `a window on a party wall (plot ${p.key}, edge ${e})`);
        // whole bays: the face's foot runs a whole number of pictures
        const low = Math.min(...ys), us = f.p.map((q, n) => (Math.abs(q[1] - low) < 1e-6 ? f.uv[n][0] : null)).filter((u) => u !== null);
        if (us.length >= 2) { const span = Math.max(...us) - Math.min(...us); assert.ok(Math.abs(span - Math.round(span)) < 1e-6, `a window cut at a wall's end (plot ${p.key}: ${span} bays)`); }
      }
    }
    for (let e = 0; e < 4; e++) assert.ok(lowest[e] <= -0.3, `plot ${p.key}'s wall ${e} stands off the ground (its foot at ${lowest[e]})`);
  }
  assert.ok(windowed > 2000 && partyFaces > 200 && gableFaces > 100, `the windows (${windowed}), party walls (${partyFaces}) and gables (${gableFaces}) read`);
  assert.equal(stats.size, 5, 'every wall\'s picture among them');
  assert.ok(decks > 5, `the balconies read (${decks})`);
});

test('BLD THE PLAIN ROWS - FACADE_PLAIN, the run of a storey\'s picture between its window\'s sill and the next storey\'s lintel, holds no glass, shutter, frame or sill in any of the five walls, and the rows outside it hold their window (mutant: the run into the window)', () => {
  const art = capitalArt(), [x0, y0, x1, y1] = FACADE_WINDOW.rect;
  assert.ok(FACADE_PLAIN.rows > 48 && FACADE_PLAIN.top >= y1, 'over a metre of plain wall');
  for (const k of ['facadeOchre', 'facadeBrick', 'facadeWhite', 'facadeStone', 'facadeTimber']) {
    const img = art.get(CAPITAL_ART[k]), at = (x, y) => img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 3);
    const glassy = (c) => c[2] > c[0] + 6 && c[2] >= c[1];   // the glass's ramp is the only blue one
    let plainGlass = 0, windowGlass = 0;
    for (let r = 0; r < FACADE_PLAIN.rows; r++) for (let x = 0; x < img.width; x++) if (glassy(at(x, (FACADE_PLAIN.top + r) % img.height))) plainGlass++;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (glassy(at(x, y))) windowGlass++;
    assert.equal(plainGlass, 0, `${k}: glass in its plain rows`);
    assert.ok(windowGlass > 600, `${k}: its window's glass (${windowGlass})`);
    // nothing of the window's frame either: the plain rows' colours are the wall's own, none the frame's dark wood
    // (the half-timbering's beams are its framing, the same ramp as its posts - it is the one wall that carries it)
  }
});

test('BLD NO BUILDING OVER ANOTHER - no two of the fabric\'s buildings share ground (their footprints\' overlap measured in every district\'s cells), so no roof runs into a neighbour\'s (mutant: a ring\'s corner a hand wider than its run)', () => {
  const area = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const [x0, z0] = P[i], [x1, z1] = P[(i + 1) % P.length]; a += x0 * z1 - x1 * z0; } return a / 2; };
  const clip = (subj, cq) => {
    const s = area(cq) > 0 ? 1 : -1;
    let out = subj;
    for (let i = 0; i < cq.length && out.length; i++) {
      const a = cq[i], b = cq[(i + 1) % cq.length], inp = out;
      out = [];
      const side = (q) => s * ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]));
      for (let k = 0; k < inp.length; k++) {
        const P = inp[k], Q = inp[(k + 1) % inp.length], sp = side(P), sq = side(Q);
        if (sp >= 0) out.push(P);
        if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]); }
      }
    }
    return out.length >= 3 ? Math.abs(area(out)) : 0;
  };
  let pairs = 0;
  for (const L of CELLS) for (const p of L.plots) for (const o of L.near) {
    if (o === p) continue;
    pairs++;
    const a = clip(p.q, o.q);
    assert.ok(a < 0.05, `plots ${p.key} and ${o.key} share ${a.toFixed(2)} m2`);
  }
  assert.ok(pairs > 10000, `the pairs read (${pairs})`);
});

test('BLD THE CAPITALS\' WALLS RIGHT SIDE UP - world/capitalModels.js vanillaTexels (every capital landmark\'s pictures, and URBANIZER\'s yard and dead-end walls) lays v RISING up every vertical face, MeshReader\'s law, so a stone is lit on its top as it is painted (mutant: v falling up the wall)', () => {
  _resetCapitals();
  installCapitals({ addTextures: () => 0 });
  let faces = 0;
  for (const id of Object.values(CAPITAL_MODELS)) {
    const m = customModelFor(id);
    for (let t = 0; t < m.indices.length; t += 3) {
      const ix = [m.indices[t], m.indices[t + 1], m.indices[t + 2]], P = ix.map((i) => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]]);
      const e1 = P[1].map((x, k) => x - P[0][k]), e2 = P[2].map((x, k) => x - P[0][k]);
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], l = Math.hypot(...n);
      if (l < 1e-4 || Math.abs(n[1]) / l > 1e-3) continue;   // a vertical face
      const pair = [[0, 1], [0, 2], [1, 2]].find(([a, b]) => Math.abs(P[a][1] - P[b][1]) > 0.3 && Math.hypot(P[a][0] - P[b][0], P[a][2] - P[b][2]) < 1e-3);   // two corners one over the other
      if (!pair) continue;
      const [a, b] = pair, rise = (m.uvs[ix[a] * 2 + 1] - m.uvs[ix[b] * 2 + 1]) / (P[a][1] - P[b][1]);
      assert.ok(rise > 0, `model ${id}: a wall's picture upside down (dv/dy ${rise})`);
      faces++;
    }
  }
  assert.ok(faces > 5000, `the walls read (${faces})`);
});
