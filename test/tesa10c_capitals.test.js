// TESA10c (2026-10-13, the owner: "Can we redesign each capital city as close to 1:1 with other games"; bible/03-World/
// Arena-Provinces.md TESA10c) - THE OTHER CAPITALS, BUILT BY HAND, pinned: Mournhold, Alinor, Falinesti, Torval and
// Helstrom - each its plan, its districts, its own blocks' laws, its landmarks and its pixel on its own province's land.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { CAPITALS, CAPITAL_MODELS, CAPITAL_BLOCKS, CAPITAL_BLOCK_INDEX, BLOCK_M, capitalPixel, capitalCarrier, capitalPortBlocks, anchorMetres, capitalDistrict, tileCentre, autoCentre, CAPITAL_CLOSED_BYTE, onCapitalRing } from '../src/world/tamrielCapitals.js';
import {
  MOURNHOLD, ALINOR, FALINESTI, TORVAL, HELSTROM, MOURNHOLD_PLAN, ALINOR_PLAN, FALINESTI_PLAN, TORVAL_PLAN, HELSTROM_PLAN,
} from '../src/world/capitalPlans.js';
import { buildMournholdPlaza, buildHighFane, buildMournholdPalace, buildGreatBazaar, buildMournholdWall, mournholdTowers } from '../src/world/capitalMournhold.js';
import { buildAlinorPalace, buildAlinorHarbour, buildAlinorWall, alinorWallCorners, alinorTowers } from '../src/world/capitalAlinor.js';
import { buildGrahtOak, trunkRadius } from '../src/world/capitalFalinesti.js';
import { buildManePalace, buildTwoMoonsTemple, buildTorvalQuay, buildTorvalWall, torvalWallCorners, torvalTowers } from '../src/world/capitalTorval.js';
import { buildXanmeer, buildHist, buildHelstromWalks, buildPalisade, helstromCorners, helstromOpenings } from '../src/world/capitalHelstrom.js';
import { CAPITAL_ARCHIVE, CAPITAL_ART, capitalArt, installCapitals, _resetCapitals } from '../src/world/capitalModels.js';
import { customModelFor } from '../src/world/customModels.js';
import { CITIES } from '../src/world/tamriel/tamrielGeography.js';
import { provinceKeyBeyondBay } from '../src/world/tamriel/tamrielLand.js';
import { setTamrielFit, inBay } from '../src/world/tamriel/tamrielFrame.js';

afterEach(() => setTamrielFit(null));

const FIVE = ['mournhold', 'alinor', 'falinesti', 'torval', 'helstrom'];
const capOf = (key) => CAPITALS.find((c) => c.key === key);
const bounds = (m) => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < m.positions.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], m.positions[i + a]); hi[a] = Math.max(hi[a], m.positions[i + a]); } return { lo, hi }; };
const sane = (m) => {
  assert.ok(m.positions.every(Number.isFinite) && m.uvs.every(Number.isFinite));
  for (let i = 0; i < m.normals.length; i += 3) assert.ok(Math.abs(Math.hypot(m.normals[i], m.normals[i + 1], m.normals[i + 2]) - 1) < 1e-4, 'unit normals');
  assert.ok(m.subMeshes.every((s) => s.textureArchive === CAPITAL_ARCHIVE && Object.values(CAPITAL_ART).includes(s.textureRecord)));
  assert.equal(m.subMeshes.reduce((n, s) => n + s.primitiveCount * 3, 0), m.indices.length);
};
/** Does the segment p-q cross any face of the model (Moller-Trumbore)? */
const crosses = (m, p, q) => {
  const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
  for (let t = 0; t < m.indices.length; t += 3) {
    const V = (k) => [0, 1, 2].map((a) => m.positions[m.indices[t + k] * 3 + a]);
    const [a, b, c] = [V(0), V(1), V(2)], e1 = b.map((v, i) => v - a[i]), e2 = c.map((v, i) => v - a[i]);
    const h = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]], det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
    if (Math.abs(det) < 1e-12) continue;
    const sv = p.map((v, i) => v - a[i]), u = (sv[0] * h[0] + sv[1] * h[1] + sv[2] * h[2]) / det;
    if (u < 0 || u > 1) continue;
    const qv = [sv[1] * e1[2] - sv[2] * e1[1], sv[2] * e1[0] - sv[0] * e1[2], sv[0] * e1[1] - sv[1] * e1[0]], v = (d[0] * qv[0] + d[1] * qv[1] + d[2] * qv[2]) / det;
    if (v < 0 || u + v > 1) continue;
    const k = (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]) / det;
    if (k >= 0 && k <= 1) return true;
  }
  return false;
};

// ── THE FIVE ────────────────────────────────────────────────────

test('TESA10c the five: Mournhold, Alinor, Falinesti, Torval and Helstrom after the Imperial City and Solitude - TAMRIEL1\'s points and provinces, Alinor and Torval on the shore, each its anchor carried by one of its own blocks, its own models', () => {
  assert.deepEqual(CAPITALS.map((c) => c.key), ['imperial-city', 'solitude', ...FIVE]);
  for (const key of FIVE) {
    const cap = capOf(key), city = CITIES.find((c) => c.name === cap.name && c.capital);
    assert.ok(city, key);
    assert.deepEqual([...cap.at], city.at, `${key}: TAMRIEL1's point`);
    assert.equal(cap.shore, key === 'alinor' || key === 'torval', key);
    assert.ok(capitalCarrier(cap), `${key} carried`);
    assert.ok(cap.models.length > 0);
  }
  assert.deepEqual(CAPITALS.map((c) => c.province), ['Imperial', 'Skyrim', 'Morrowind', 'Sumurset', 'Valenwood', 'Elsweyr', 'BlackMarsh']);
  const ids = CAPITALS.flatMap((c) => c.models);
  assert.equal(new Set(ids).size, ids.length, 'no model two capitals\'');
  assert.deepEqual([...ids].sort(), Object.values(CAPITAL_MODELS).sort(), 'every model a capital\'s');
});

test('TESA10c the pixels: each on its own province\'s land past the Bay, a shore capital beside the sea, no two on one (TAMRIEL1\'s shape where no trace is set)', () => {
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const seen = new Set();
  for (const cap of CAPITALS) {
    const p = capitalPixel(cap);
    assert.ok(p, cap.key);
    assert.ok(!inBay(p.px, p.py), cap.key);
    assert.equal(provinceKeyBeyondBay(p.px, p.py), cap.province, cap.key);
    if (cap.shore) assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].some(([dx, dy]) => provinceKeyBeyondBay(p.px + dx, p.py + dy) === null && !inBay(p.px + dx, p.py + dy)), `${cap.key} beside the sea`);
    assert.equal(seen.has(`${p.px},${p.py}`), false);
    seen.add(`${p.px},${p.py}`);
  }
});

test('TESA10c the plans: 8 x 8 as a map reads (AUDIT TESA II C2: Alinor\'s and Torval\'s 8 x 16, the sea pixel off their harbour); each own block once; every city cell in one district; Alinor\'s and Torval\'s sea the south row, their quay above it; Helstrom\'s canal across the city with the Hist\'s isle in it; the guilds, a temple and a bank in each', () => {
  for (const key of FIVE) {
    const cap = capOf(key), P = cap.plan, flat = P.flat();
    assert.ok(P.length === (key === 'alinor' || key === 'torval' ? 16 : 8) && P.every((r) => r.length === 8), key);
    for (const code of Object.keys(cap.blocks)) assert.equal(flat.filter((c) => c === code).length, 1, `${key} ${code}`);
    const seen = new Set();
    for (const [d, cells] of Object.entries(cap.districts)) for (const [x, y] of cells) { assert.ok(!['L', 'G'].includes(P[y][x]), `${key} ${d} ${x},${y}`); assert.equal(seen.has(`${x},${y}`), false, `${key} ${x},${y} twice`); seen.add(`${x},${y}`); }
    assert.equal(seen.size, flat.filter((c) => c !== 'L' && c !== 'G').length, `${key}: every city cell a district's`);
    for (const k of ['MAGE', 'FIGH', 'TEMP', 'BANK', 'TVRN', 'GENR']) assert.ok(flat.includes(k), `${key} ${k}`);
  }
  for (const P of [ALINOR_PLAN, TORVAL_PLAN]) {
    assert.ok(P[7].every((c) => c === 'L')); assert.ok(P[6].slice(1, 7).every((c) => /^Q\d$/.test(c)));
    assert.ok(P.slice(8).flat().every((c) => c === 'L' || c === 'S0') && P[8][3] === 'S0', 'AUDIT TESA II C2: the sea slice all water, its own block its carrier');
  }
  assert.deepEqual(HELSTROM_PLAN[4], ['L', 'L', 'L', 'H0', 'L', 'L', 'L', 'L']);
  assert.deepEqual([MOURNHOLD_PLAN[3][3], MOURNHOLD_PLAN[4][4], FALINESTI_PLAN[3][3], FALINESTI_PLAN[4][4]], ['R0', 'R3', 'T0', 'T3']);   // PIN MOVED (TESA-LORE): Mournhold's palace at the middle
  assert.equal(capitalDistrict(capOf('mournhold'), 3, 3), 'Royal Palace');
  assert.equal(capitalDistrict(capOf('mournhold'), 3, 5), 'Plaza Brindisi Dorom');
  assert.equal(capitalDistrict(capOf('torval'), 5, 3), 'Temple of the Two Moons');
  assert.equal(capitalDistrict(capOf('helstrom'), 3, 4), 'The Hist');
});

test('TESA10c the port blocks: every capital\'s own after the lake and the garden, names apart, indices in order; the quays\' water past their edges, the canal\'s past the Hist\'s isle, the oak\'s soil at its foot; the landmarks\' feet closed, the plaza\'s gates open', () => {
  const b = capitalPortBlocks();
  assert.deepEqual(b.slice(0, 2).map((x) => x.name), [CAPITAL_BLOCKS.lake, CAPITAL_BLOCKS.garden]);
  assert.equal(new Set(b.map((x) => x.name)).size, b.length);
  assert.deepEqual(b.map((x) => x.index), b.map((_, i) => CAPITAL_BLOCK_INDEX + i));
  const ring = (c) => c.plan.flatMap((row, r) => row.map((x, cx) => x === 'L' && onCapitalRing(c, cx, r))).filter(Boolean).length;
  assert.equal(b.length, 2 + CAPITALS.reduce((n, c) => n + Object.keys(c.blocks).length + c.plan.flat().filter((x) => x === 'G').length + ring(c), 0), 'AUDIT-TESA A6-2: and every capital\'s gardens after them; AUDIT TESA II C1: and its ring\'s lakes');
  const tile = (key, dx, dz) => capOf(key).blocks[Object.keys(capOf(key).blocks)[0]].tile(dx, dz);
  const closed = (key, dx, dz) => capOf(key).blocks[Object.keys(capOf(key).blocks)[0]].closed(dx, dz);
  assert.deepEqual([tile('alinor', 0, ALINOR.quay.edge - 1), tile('alinor', 0, ALINOR.quay.edge + 1)], [3, 0]);
  assert.deepEqual([tile('torval', 0, TORVAL.quay.edge - 1), tile('torval', 0, TORVAL.quay.edge + 1)], [3, 0]);
  assert.deepEqual([tile('helstrom', HELSTROM.hist.x, HELSTROM.hist.z), tile('helstrom', 150, 150), tile('helstrom', 0, 0)], [2, 0, 3]);
  assert.deepEqual([tile('falinesti', 10, 10), tile('falinesti', 90, 0)], [1, 2]);
  const MP = MOURNHOLD.plaza;   // PIN MOVED (TESA-LORE): the palace at the middle, the plaza south of it
  assert.equal(closed('mournhold', 0, 0), true, 'the palace');
  assert.equal(closed('mournhold', MP.x, MP.z), true, 'the statue');
  assert.equal(closed('mournhold', MP.x + Math.cos(0.3) * MP.r, MP.z + Math.sin(0.3) * MP.r), true, 'the plaza\'s ring');
  assert.equal(closed('mournhold', MP.x + MP.r, MP.z), false, 'its gate');
  assert.equal(closed('mournhold', MOURNHOLD.fane.x, MOURNHOLD.fane.z + 20), true, 'the Fane');
  assert.equal(closed('mournhold', MOURNHOLD.palace.x, MOURNHOLD.palace.z), true, 'the palace');
  assert.equal(closed('alinor', 0, 0), true);
  assert.equal(closed('alinor', 0, ALINOR.palace.stairFoot + 2), false, 'PIN MOVED (TESA-LORE): the palace\'s height closed, the street at its stair\'s foot open');
  assert.equal(closed('torval', TORVAL.temple.x, TORVAL.temple.z), true);
  assert.equal(closed('torval', 0, 0), false, 'the square between');
  assert.equal(closed('helstrom', 0, 0), true, 'the Xanmeer');
  assert.equal(closed('helstrom', HELSTROM.hist.x, HELSTROM.hist.z), true, 'the Hist');
  assert.equal(closed('falinesti', 0, 0), true, 'the oak');
  assert.equal(closed('falinesti', FALINESTI.foot + 1, 0), false);
  // a block's own metres to the anchor's, through the law every capital's blocks are laid by
  const mh = capOf('mournhold'), [cx, r] = [3, 5], blk = b.find((x) => x.name === mh.blocks.P0.name);   // PIN MOVED (TESA-LORE): the plaza's first block
  const A = blk.json.RmbBlock.FldHeader.AutoMapData, T = blk.json.RmbBlock.FldHeader.GroundData.GroundTiles;
  for (let ay = 0; ay < 64; ay++) for (let ax = 0; ax < 64; ax++) { const [x, z] = autoCentre(ax, ay); assert.equal(A[ay * 64 + ax], mh.blocks.P0.closed(...anchorMetres(mh, cx, r, x, z)) ? CAPITAL_CLOSED_BYTE : 0); }   // PIN MOVED (AUDIT-TESA A6-5)
  for (let ty = 0; ty < 16; ty++) for (let tx = 0; tx < 16; tx++) { const [x, z] = tileCentre(tx, ty); assert.equal(T[ty * 16 + tx].TileBitfield, mh.blocks.P0.tile(...anchorMetres(mh, cx, r, x, z))); }
  void BLOCK_M;
});

// ── THE LANDMARKS ───────────────────────────────────────────────

test('TESA10c Mournhold: the plaza\'s ring open on its axes round its statue (PIN MOVED, TESA-LORE: the plaza south of the palace, its fountain and column the statue of Almalexia and Dagon); the High Fane\'s dome its highest, its porch south to the courtyard; the palace\'s domes over its roof; the bazaar\'s stalls in their cells; the walls\' four gates open', () => {
  const M = MOURNHOLD, plaza = buildMournholdPlaza(), fane = buildHighFane(), palace = buildMournholdPalace(), bazaar = buildGreatBazaar(), wall = buildMournholdWall();
  for (const m of [plaza, fane, palace, bazaar, wall]) sane(m);
  const PX = M.plaza.x, PZ = M.plaza.z;
  for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) assert.equal(crosses(plaza, [PX + x * (M.plaza.r - 3), 0.5, PZ + z * (M.plaza.r - 3)], [PX + x * (M.plaza.r + 3), 0.5, PZ + z * (M.plaza.r + 3)]), false, `the plaza open ${x},${z}`);
  assert.equal(crosses(plaza, [PX + Math.cos(0.7) * (M.plaza.r - 3), 0.5, PZ + Math.sin(0.7) * (M.plaza.r - 3)], [PX + Math.cos(0.7) * (M.plaza.r + 3), 0.5, PZ + Math.sin(0.7) * (M.plaza.r + 3)]), true, 'walled between');
  assert.ok(bounds(plaza).hi[1] > M.statue.plinthH + M.statue.dagon, 'the statue on its plinth');
  const fb = bounds(fane), F = M.fane;
  assert.ok(Math.abs(fb.hi[1] - (F.plinthH + F.drumH + F.domeH - 0.3 + 10)) < 1e-3, 'the lantern\'s tip its top');
  assert.equal(crosses(fane, [F.x, 4, F.z + F.plinth / 2 + F.porch + 2], [F.x, 4, F.z + F.plinth / 2 + 2]), true, 'the porch south');
  const pb = bounds(palace);
  assert.ok(pb.hi[1] > M.palace.h + M.palace.domeR, 'the domes over the roof');
  const bb = bounds(bazaar), B = M.bazaar;
  assert.ok(bb.lo[0] >= B.x - B.w / 2 - 1 && bb.hi[0] <= B.x + B.w / 2 + 1 && bb.lo[2] >= B.z - B.d / 2 - 1 && bb.hi[2] <= B.z + B.d / 2 + 1);
  const W = M.wall, g = W.gateH / 2;
  for (const [x, z] of [[W.half, 0], [-W.half, 0], [0, W.half], [0, -W.half]]) {
    const ax = x ? 1 : 0, az = z ? 1 : 0;
    assert.equal(crosses(wall, [x - ax * 6, g, z - az * 6], [x + ax * 6, g, z + az * 6]), false, `the gate at ${x},${z} open`);
    assert.equal(crosses(wall, [x - ax * 6 + az * 60, g, z - az * 6 + ax * 60], [x + ax * 6 + az * 60, g, z + az * 6 + ax * 60]), true, 'walled beside it');
  }
  assert.ok(mournholdTowers().every(([x, z]) => Math.abs(x) === W.half || Math.abs(z) === W.half));
});

test('TESA10c Alinor: the palace\'s great tower its highest over four corner spires (PIN MOVED, TESA-LORE: on its terraces\' top; the Crystal Tower and its isle retired - Summerset\'s, not Alinor\'s); the harbour\'s piers out over the water; the walls\' three gates open and the harbour side open', () => {
  const A = ALINOR, palace = buildAlinorPalace(), harbour = buildAlinorHarbour(), wall = buildAlinorWall();
  for (const m of [palace, harbour, wall]) sane(m);
  assert.ok(Math.abs(bounds(palace).hi[1] - (A.palace.terraces[A.palace.terraces.length - 1][1] + A.palace.towerH + 1.4 + A.palace.crown)) < 1e-3);
  const hb = bounds(harbour);
  assert.ok(hb.hi[2] >= A.quay.pierTo - 1e-6 && A.quay.pierTo > A.quay.edge);
  const W = A.wall, midZ = (W.south + W.north) / 2, g = W.gateH / 2;
  assert.equal(crosses(wall, [W.northGate - 18, g, W.north], [W.northGate - 6, g, W.north]), true, 'the north side walled beside its gate');
  assert.equal(crosses(wall, [W.northGate, g, W.north - 6], [W.northGate, g, W.north + 6]), false, 'the north gate open (PIN MOVED, AUDIT TESA II C10: on its lane, off the palace\'s height)');
  assert.equal(crosses(wall, [0, g, W.north - 6], [0, g, W.north + 6]), true, 'walled at the palace\'s back');
  assert.equal(crosses(wall, [W.west - 6, g, midZ], [W.west + 6, g, midZ]), false, 'the west gate');
  assert.equal(crosses(wall, [W.east - 6, g, midZ], [W.east + 6, g, midZ]), false, 'the east gate');
  assert.equal(crosses(wall, [W.west - 6, g, midZ + 60], [W.west + 6, g, midZ + 60]), true);
  assert.equal(crosses(wall, [0, g, W.south - 6], [0, g, W.south + 6]), false, 'the harbour open');
  assert.deepEqual(alinorWallCorners(), [[W.east, W.south], [W.east, W.north], [W.west, W.north], [W.west, W.south]]);
  assert.ok(alinorTowers().every(([x, z]) => x === W.west || x === W.east || z === W.north));
});

test('TESA10c Falinesti: the Great Graht-Oak - its trunk narrowing up its levels, its roots out to their reach, its crown over the city, its platforms round the trunk', () => {
  const F = FALINESTI, m = buildGrahtOak();
  sane(m);
  for (let i = 0; i + 1 < F.trunk.length; i++) assert.ok(F.trunk[i + 1][1] < F.trunk[i][1] && F.trunk[i + 1][0] > F.trunk[i][0]);
  assert.equal(trunkRadius(F.trunk[0][0] - 5), F.trunk[0][1]);
  assert.equal(trunkRadius(40), (F.trunk[1][1] + F.trunk[2][1]) / 2);
  const { lo, hi } = bounds(m);
  assert.ok(hi[1] > F.crown.y + 30 && hi[1] < F.crown.y + 60, `its crown at ${hi[1].toFixed(1)}`);
  let top = 1;
  for (let i = 1; i < m.positions.length; i += 3) if (m.positions[i] > m.positions[top]) top = i;
  assert.ok(Math.hypot(m.positions[top - 1], m.positions[top + 1]) < 70, 'the crown highest over the trunk');
  assert.ok(Math.max(-lo[0], hi[0], -lo[2], hi[2]) > F.crown.r * 0.9, 'the crown over the city');
  let roots = 0;
  for (let i = 0; i < m.positions.length; i += 3) if (m.positions[i + 1] < 0 && Math.hypot(m.positions[i], m.positions[i + 2]) > F.rootOut - 3) roots++;
  assert.ok(roots >= F.roots, 'the roots to their reach');
  for (const y of F.platforms) assert.equal(crosses(m, [trunkRadius(y) + 4, y + 3, 0], [trunkRadius(y) + 4, y - 3, 0]), true, `a platform at ${y}`);
});

test('TESA10c Torval: the palace\'s dome over its roof and its four minarets; the temple\'s terraces, Masser\'s dome greater than Secunda\'s, its stair north; the walls\' gates open, the quay\'s piers out over the bay', () => {
  const T = TORVAL, palace = buildManePalace(), temple = buildTwoMoonsTemple(), quay = buildTorvalQuay(), wall = buildTorvalWall();
  for (const m of [palace, temple, quay, wall]) sane(m);
  const P = T.palace, pb = bounds(palace);
  // PIN MOVED (TESA-LORE): the domes' finials crescent moons - the palace's the top, over its dome's axis
  const domeTop = P.h + P.drumH + P.domeH - 0.4;
  assert.ok(pb.hi[1] > domeTop + 2.6 && pb.hi[1] < domeTop + 2.6 * 1.4, `its moon over its dome: ${pb.hi[1].toFixed(2)}`);
  let ptop = 1;
  for (let i = 1; i < palace.positions.length; i += 3) if (palace.positions[i] > palace.positions[ptop]) ptop = i;
  assert.ok(Math.hypot(palace.positions[ptop - 1] - P.x, palace.positions[ptop + 1] - P.z) < 2.6 * 1.3, 'over its dome, not a minaret');
  assert.ok(T.temple.masser[1] > T.temple.secunda[1] && T.temple.masser[2] > T.temple.secunda[2]);
  const M = T.temple, top = M.tiers.length * M.tierH;
  assert.equal(crosses(temple, [M.x, top / 2 + 3, M.z - M.tiers[0] / 2 - 9], [M.x, top / 2 - 6, M.z - M.tiers[0] / 2 - 9]), true, 'the stair north');
  const tt = bounds(temple).hi[1], mt = top + M.drumH + M.masser[2];
  assert.ok(tt > mt && tt < mt + M.masser[1] * 0.16 * 1.4, 'Masser\'s moon the top (PIN MOVED, TESA-LORE: its crescent over its dome)');
  let hi = -1;
  const red = temple.subMeshes.find((sm) => sm.textureRecord === CAPITAL_ART.terracotta);
  for (let i = red.startIndex; i < red.startIndex + red.primitiveCount * 3; i++) { const v = temple.indices[i]; if (hi < 0 || temple.positions[v * 3 + 1] > temple.positions[hi * 3 + 1]) hi = v; }
  assert.ok(Math.abs(temple.positions[hi * 3 + 1] - mt) < 1e-3, 'Masser red, the highest dome');
  assert.ok(temple.positions[hi * 3] < M.x, 'Masser west of Secunda');
  const W = T.wall, midZ = (W.south + W.north) / 2, g = W.gateH / 2;
  assert.equal(crosses(wall, [W.northGate, g, W.north - 6], [W.northGate, g, W.north + 6]), false, 'PIN MOVED (AUDIT TESA II C10): the north gate on its lane, off the estate\'s back');
  assert.equal(crosses(wall, [0, g, W.north - 6], [0, g, W.north + 6]), true, 'walled at the estate\'s back');
  assert.equal(crosses(wall, [W.west - 6, g, midZ], [W.west + 6, g, midZ]), false);
  assert.equal(crosses(wall, [W.east - 6, g, midZ], [W.east + 6, g, midZ]), false);
  assert.equal(crosses(wall, [80, g, W.north - 6], [80, g, W.north + 6]), true);
  assert.deepEqual(torvalWallCorners(), [[W.east, W.south], [W.east, W.north], [W.west, W.north], [W.west, W.south]]);
  assert.ok(torvalTowers().every(([x, z]) => x === W.west || x === W.east || z === W.north));
  assert.ok(bounds(quay).hi[2] >= T.quay.pierTo - 1e-6);
});

test('TESA10c Helstrom: the Xanmeer\'s tiers to its shrine and a stair up each face; the Hist on its isle, sap-gilt; the boardwalks over the canal; the palisade broken for its gates and the canal, toothed, a watchtower at each corner', () => {
  const H = HELSTROM, X = H.xanmeer, xan = buildXanmeer(), hist = buildHist(), walks = buildHelstromWalks(), pal = buildPalisade();
  for (const m of [xan, hist, walks, pal]) sane(m);
  const top = X.tiers.length * X.tierH;
  assert.ok(Math.abs(bounds(xan).hi[1] - (top + X.shrineH + X.shrine * 0.6)) < 1e-3, 'the shrine\'s roof the top');
  const foot = X.tiers[0] / 2 + 3;   // past the lowest tier: the stair alone stands there
  for (const [ux, uz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) assert.equal(crosses(xan, [ux * foot, 6, uz * foot], [ux * foot, -1, uz * foot]), true, `the stair ${ux},${uz}`);
  const hb = bounds(hist);
  assert.ok(Math.hypot(hb.lo[0] - H.hist.x, 0) < H.hist.crown * 1.6 && hb.hi[1] > H.hist.h, 'the Hist over its isle');
  assert.ok(hist.subMeshes.some((s) => s.textureRecord === CAPITAL_ART.gold), 'its sap');
  for (const x of H.walks) assert.equal(crosses(walks, [x, H.walkDeck + 1, (H.canal.z0 + H.canal.z1) / 2], [x, H.walkDeck - 1, (H.canal.z0 + H.canal.z1) / 2]), true, 'a boardwalk over the canal');
  const P = H.palisade, cz = (H.canal.z0 + H.canal.z1) / 2;
  assert.equal(crosses(pal, [P.west - 3, 2, cz], [P.west + 3, 2, cz]), false, 'the canal through the west side');
  assert.equal(crosses(pal, [P.east - 3, 2, cz], [P.east + 3, 2, cz]), false, 'and the east');
  assert.equal(crosses(pal, [0, 2, P.north - 3], [0, 2, P.north + 3]), false, 'the north gate');
  assert.equal(crosses(pal, [0, 2, P.south - 3], [0, 2, P.south + 3]), false, 'the south gate');
  assert.equal(crosses(pal, [P.west - 3, 2, 0], [P.west + 3, 2, 0]), true, 'logs between');
  assert.equal(crosses(pal, [80, 2, P.north - 3], [80, 2, P.north + 3]), true);
  assert.ok(bounds(pal).hi[1] > P.towerH + 3.4, 'the watchtowers\' roofs');
  assert.equal(helstromOpenings().length, 4);
  assert.deepEqual(helstromCorners(), [[P.east, P.north], [P.west, P.north], [P.west, P.south], [P.east, P.south]]);
});

test('TESA10c the pictures and the install: the five\'s pictures painted with the rest, opaque; every one of their models on the model door', () => {
  const a = capitalArt();
  assert.deepEqual([...a.keys()].sort((x, y) => x - y), Object.values(CAPITAL_ART).sort((x, y) => x - y));
  for (const r of ['ochre', 'bronze', 'cloth', 'bark', 'leaves', 'sandstone', 'terracotta', 'mossStone']) {   // AUDIT TESA II (lane K's K15): the crystal retired with the Crystal Tower
    const img = a.get(CAPITAL_ART[r]);
    for (let i = 3; i < img.data.length; i += 4) assert.equal(img.data[i], 255, r);
  }
  const leaf = a.get(CAPITAL_ART.leaves).data, sand = a.get(CAPITAL_ART.sandstone).data;
  assert.ok(leaf[1] > leaf[0] && leaf[1] > leaf[2], 'the leaves green');
  assert.ok(sand[0] > sand[2], 'the sandstone warm');
  _resetCapitals();
  installCapitals({ addTextures: () => 0 });
  for (const key of FIVE) for (const id of capOf(key).models) { const m = customModelFor(id); assert.ok(m?.positions?.length > 0, `${key} ${id}`); sane(m); }
});
