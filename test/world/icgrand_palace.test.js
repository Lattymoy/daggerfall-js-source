// IC-GRAND x THE COORDINATOR'S REVIEW OF THE RENDERS (2026-10-26, bible/03-World/Arena-Provinces.md IC-GRAND, "The Palace
// District"): "THE PALACE DISTRICT reads empty ... Give it the canon's content at the city's scale: the palace at the
// tower's foot, Green Emperor Way's gardens and paths, the emperors' tombs as real monuments along the way, walls/gates of
// the palace wall dressed, and trees and statuary - so from the air and from the street it reads as the heart of the
// Empire, not a lawn." Pinned: the palace's ring of wings round the tower's plaza, its gates and its pavilions; the
// gardens' paths, ring walks, fountains, statues and rows of trees; the tombs on the Way's verge, each facing it; the
// palace wall's gatehouses; and each seen from afar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  IMPERIAL, IMPERIAL_SPAN, IMPERIAL_MODELS, IMPERIAL_PARTS, polar, imperialTile, imperialClosed, imperialTree, imperialBearing, tombAt, tombFrame,
  palaceCorners, palaceGates, palacePillars, inPalace, gardenPaths, palaceFountains, palaceStatues, imperialGeo, STATUE_PLINTH, imperialSliceRect,
} from '../../src/world/imperialCity.js';
import { buildImperialPalace, buildPalaceGardens, buildEmperorsTombs, buildPalaceWall, nearRect } from '../../src/world/capitalImperial.js';
import { CAPITAL_ART, CAPITAL_ARCHIVE } from '../../src/world/capitalShapes.js';
import { imperialLandmarkMesh } from '../../src/world/imperialImpostor.js';
import { imperialPartBuild } from '../../src/world/capitalModels.js';
import { IMPERIAL_CARRY } from '../../src/world/imperialCity.js';

const I = IMPERIAL, P = I.palace, G = I.gardens, T = I.tombs, N = IMPERIAL_SPAN, CENTRE = (N * N - 1) / 2;
const tris = (m, fn) => { const p = m.positions, ix = m.indices, out = []; for (let t = 0; t < ix.length; t += 3) { const v = [0, 1, 2].map((k) => [p[ix[t + k] * 3], p[ix[t + k] * 3 + 1], p[ix[t + k] * 3 + 2]]); if (!fn || fn(v)) out.push(v); } return out; };
/** Does a segment [x, z, y] - [x, z, y] (the map's frame) pass through any of the triangles (Moller-Trumbore)? */
function crosses(all, [ax, az, ay], [bx, bz, by]) {
  const o = [ax, ay, az], d = [bx - ax, by - ay, bz - az];
  for (const [p0, p1, p2] of all) {
    const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
    const h = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]], a = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
    if (Math.abs(a) < 1e-9) continue;
    const f = 1 / a, s = [o[0] - p0[0], o[1] - p0[1], o[2] - p0[2]], u = f * (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]);
    if (u < 0 || u > 1) continue;
    const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]], v = f * (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]);
    if (v < 0 || u + v > 1) continue;
    const t = f * (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]);
    if (t >= 0 && t <= 1) return true;
  }
  return false;
}
const recOf = (m, t) => m.subMeshes.find((s) => t >= s.startIndex / 3 && t < s.startIndex / 3 + s.primitiveCount)?.textureRecord;

test('IC-GRAND THE PALACE AT THE TOWER\'S FOOT - a ring of marble wings round the tower\'s plaza (r0 to r1), a gate through each wing a palace gate faces - the tower\'s door\'s among them - a great round pillar-tower at each corner and either side of each gate, crenellated, well over the wings (the owner\'s "large pillars"); its ground stone and its insides closed; the start markers on the plaza clear of it (mutants: no gate; the pillars open; the plaza swallowed; the gates\' pillars unbuilt)', () => {
  assert.ok(P.r0 > I.plaza && P.r1 < 2 * I.plaza && P.r0 > I.tower.plinthR + 100, 'round the plaza, clear of the tower\'s rotunda');
  assert.deepEqual(palaceGates(), [30, 90, 150, 210, 270, 330]);
  for (const g of palaceGates()) {
    const mid = (P.r0 + P.r1) / 2;
    assert.equal(inPalace(...polar(g, mid)), false, `the ${g} gate open`);
    assert.equal(imperialClosed(...polar(g, mid)), false);
    assert.equal(inPalace(...polar(g + (P.gate / 2 + 3) / mid * (180 / Math.PI), mid)), true, `walled beside the ${g} gate`);
  }
  for (const b of [0, 60, 120, 180, 240, 300]) assert.equal(inPalace(...polar(b, (P.r0 + P.r1) / 2)), true, `the ${b} wing whole`);
  for (const [x, z] of palaceCorners()) {
    assert.ok(inPalace(x, z) && imperialClosed(x, z), 'a pavilion closed');
    const [ox, oz] = [x / Math.hypot(x, z), z / Math.hypot(x, z)], d = P.pavilionR - 2;
    assert.ok(imperialClosed(x + ox * d, z + oz * d), 'standing out past its wings');
  }
  assert.equal(palaceCorners().length, P.sides);
  for (const b of [0, 37, 90, 200]) {
    assert.equal(imperialTile(...polar(b, P.r0 - 5)), 3, 'the plaza stone');
    assert.equal(imperialTile(...polar(b, P.r1 + 5)), 3, 'its terrace stone');
    assert.equal(inPalace(...polar(b, P.r0 - 6)), false, 'the plaza open');
  }
  for (const [mx, mz] of [[220, 0], [-220, 0], [0, 220], [0, -220]]) assert.ok(!imperialClosed(mx, mz) && imperialTile(mx, mz) === 3, 'a start marker on the plaza, clear');
  // its model: its walls within its ring, its pavilions' domes gilt, its roofs slate, its windows dark
  const m = buildImperialPalace(), all = tris(m);
  const rr = all.flatMap((v) => v.map((q) => Math.hypot(q[0], q[2])));
  assert.ok(Math.min(...rr) > P.r0 - 1 && Math.max(...rr) < P.r1 / Math.cos(Math.PI / P.sides) + P.pavilionR + 2, `${Math.min(...rr).toFixed(1)}-${Math.max(...rr).toFixed(1)} m out`);
  const top = Math.max(...all.flatMap((v) => v.map((q) => q[1])));
  assert.ok(top > P.pavilionH + 2 && top < P.pavilionH + 6 && P.pavilionH > 2 * P.h, `its pillars' crenellated tops ${top.toFixed(1)}, well over its wings`);
  // the owner's "large pillars": one either side of every gate, standing over the wings - a walk past it at the wings'
  // eaves meets its drum
  assert.equal(palacePillars().length, P.sides + 2 * palaceGates().length);
  for (const [x, z] of palacePillars().slice(P.sides)) {
    const [ox, oz] = [x / Math.hypot(x, z), z / Math.hypot(x, z)];
    assert.equal(crosses(all, [x + oz * (P.pavilionR + 3), z - ox * (P.pavilionR + 3), P.h + 10], [x, z, P.h + 10]), true, 'a gate\'s pillar over the wing');
    assert.ok(imperialClosed(x, z), 'its foot closed');
  }
  const recs = new Set(m.subMeshes.map((s) => s.textureRecord));
  for (const r of [CAPITAL_ART.marble, CAPITAL_ART.gold, CAPITAL_ART.blueSlate, CAPITAL_ART.dark]) assert.ok(recs.has(r), `${r}`);
  // a gate's passage: a walk through it at a body's height meets no face; through a wing without one it meets a wall
  for (const g of palaceGates()) assert.equal(crosses(all, [...polar(g, P.r0 - 4), 1.6], [...polar(g, P.r1 + 4), 1.6]), false, `the ${g} gate's passage clear`);
  for (const b of [0, 60, 180]) assert.equal(crosses(all, [...polar(b, P.r0 - 4), 1.6], [...polar(b, P.r1 + 4), 1.6]), true, `the ${b} wing walled`);
  for (const [x, z] of palaceCorners()) { const [ox, oz] = [x / Math.hypot(x, z), z / Math.hypot(x, z)]; assert.equal(crosses(all, [x + ox * (P.pavilionR + 3), z + oz * (P.pavilionR + 3), 4], [x + ox * (P.pavilionR - 4), z + oz * (P.pavilionR - 4), 4]), true, 'a pavilion\'s drum'); }
  assert.ok(m.indices.length / 3 < 20000, `${m.indices.length / 3} triangles`);
  // carried by the centre slice
  assert.deepEqual(IMPERIAL_PARTS.filter((q) => q.base === IMPERIAL_MODELS.imperialPalace).map((q) => q.s), [CENTRE]);
});

test('IC-GRAND GREEN EMPEROR WAY\'S GARDENS - a paved path out from the palace\'s terrace to the Way every thirty degrees, two ring walks round the tower, a fountain where a path crosses a walk (its basin closed, a paved round about it), the emperors\' statues along every path facing it (their plinths closed), rows of trees beyond them and groves on the lawns between - grass the rest (mutants: the paths unlaid; the walks unlaid; the fountains open; a statue\'s plinth open; the rows unplanted)', () => {
  assert.deepEqual(gardenPaths(), [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]);
  for (const b of gardenPaths()) for (const r of [450, 1200, 1800, 2100]) {
    if (G.walks.some((w) => Math.abs(r - w) < G.fountainR + G.round + 1)) continue;
    assert.equal(imperialTile(...polar(b, r)), 3, `the ${b} path at ${r} m`);
    const off = polar(b + 90, G.path / 2 + 2.5), [x, z] = polar(b, r);
    assert.equal(imperialTile(x + off[0], z + off[1]), 2, `its verge grass at ${b}, ${r}`);
  }
  for (const w of G.walks) for (const b of [7, 52, 200]) assert.equal(imperialTile(...polar(b, w)), 3, `the ${w} m walk`);
  const fountains = palaceFountains();
  assert.equal(fountains.length, gardenPaths().length * G.walks.length);
  for (const [x, z] of fountains) {
    assert.equal(imperialClosed(x, z), true, 'a basin closed');
    assert.equal(imperialClosed(x + G.fountainR + 2, z), false, 'its round walked');
    assert.equal(imperialTile(x + G.fountainR + 2, z), 3, 'and paved');
  }
  const statues = palaceStatues();
  assert.equal(statues.length, imperialGeo().statues.length);
  assert.ok(statues.length >= 200 && statues.length <= 300, `${statues.length} statues`);
  for (const [x, z, fx, fz] of statues) {
    assert.equal(imperialClosed(x, z), true, 'a plinth closed');
    assert.equal(imperialTile(x, z), 2, 'on the path\'s verge');
    const b = imperialBearing(x, z), pb = Math.round(b / G.every) * G.every, [px, pz] = polar(pb, Math.hypot(x, z));
    assert.ok(Math.hypot(px - x - fx * G.statueOff, pz - z - fz * G.statueOff) < 0.5, 'facing its path');
  }
  // trees: on grass, the path's rows beside every path, groves between, none on the paths, the walks or the palace's terrace
  let row = 0, lawn = 0, grass = 0;
  for (let x = -2300; x < 2300; x += 6.4) for (let z = -2300; z < 2300; z += 6.4) {
    const t = imperialTree(x, z), r = Math.hypot(x, z);
    if (r > I.palaceWall.r - 10) continue;
    if (imperialTile(x, z) === 2) grass++;
    if (t < 0) continue;
    assert.equal(imperialTile(x, z), 2);
    assert.ok(r > P.r1 + P.terrace, 'none on the palace\'s terrace');
    const b = imperialBearing(x, z), d = Math.abs(r * Math.sin(((b - Math.round(b / G.every) * G.every) * Math.PI) / 180));
    if (Math.abs(d - G.rowOff) < 3.3) row++; else lawn++;
  }
  assert.ok(row > 1500, `${row} trees in the paths' rows`);
  assert.ok(lawn > 4000 && (row + lawn) / grass < 0.15, `${lawn} on the lawns, ${row + lawn} trees on ${grass} grass tiles`);
});

test('IC-GRAND THE GARDENS\' MONUMENTS - a fountain (its basin, its water, its bowls, a gilt finial) at each crossing and a statue (a marble plinth, an emperor in bronze crowned in gold) at each statue\'s place, each part of them built of its own near its slice alone - the whole\'s triangles there (mutants: a part built of the whole; the statues unbuilt)', () => {
  const whole = buildPalaceGardens(), all = tris(whole);
  const recs = new Set(whole.subMeshes.map((s) => s.textureRecord));
  for (const r of [CAPITAL_ART.marble, CAPITAL_ART.bronze, CAPITAL_ART.gold, CAPITAL_ART.water]) assert.ok(recs.has(r), `${r}`);
  const g = imperialGeo();
  for (const [x, z] of [...g.fountains.slice(0, 4), ...g.statues.slice(0, 6)]) assert.ok(all.some((v) => v.every((q) => Math.hypot(q[0] - x, q[2] - z) < G.fountainR + 1)), `a monument at ${x.toFixed(0)},${z.toFixed(0)}`);
  assert.ok(whole.indices.length / 3 < 40000, `${whole.indices.length / 3} triangles`);
  const parts = IMPERIAL_PARTS.filter((q) => q.base === IMPERIAL_MODELS.palaceGardens);
  assert.ok(parts.length > 8 && parts.every((q) => IMPERIAL_CARRY[q.id] === q.s));
  // a part's source: the monuments near its square alone - fewer than the whole's, the same where they stand
  const q = parts.find((p) => p.s !== CENTRE), rect = imperialSliceRect(q.s), near = buildPalaceGardens(undefined, nearRect(rect, 40));
  assert.ok(near.indices.length < whole.indices.length / 4, 'built of its own');
  const inside = (m) => tris(m, (v) => { const cx = (v[0][0] + v[1][0] + v[2][0]) / 3, cz = (v[0][2] + v[1][2] + v[2][2]) / 3; return cx >= rect[0] && cx < rect[2] && cz >= rect[1] && cz < rect[3]; }).length;
  assert.ok(inside(near) > 0);
  assert.equal(inside(near), inside(whole), 'the whole\'s triangles in its square');
  assert.ok(imperialPartBuild(IMPERIAL_MODELS.palaceGardens, rect).indices.length < whole.indices.length / 4, 'the part\'s builder asks only its own (world/capitalModels.js PART_BUILDS)');
});

test('IC-GRAND THE EMPERORS\' TOMBS ALONG THE WAY - twenty-four marble mausolea on Green Emperor Way\'s inner verge, each facing it (its door and its portico out toward the Way), two either side of every garden path\'s end; each on its podium, closed, its walk out to the Way paved; tall enough to stand over the gardens (mutants: the doors toward the tower; the walk unpaved; the podium open)', () => {
  assert.ok(T.r + T.w / 2 + T.podium < I.way.r0 - 20 && T.r - T.w > G.walks.at(-1) + 100, 'on the Way\'s verge, past the walks');
  const bearings = Array.from({ length: T.n }, (_, i) => imperialBearing(...tombAt(i)));
  for (const pb of gardenPaths()) assert.equal(bearings.filter((b) => Math.abs(((b - pb + 540) % 360) - 180) < 360 / T.n).length, 2, `two either side of the ${pb} path`);
  const m = buildEmperorsTombs(), all = tris(m);
  const top = Math.max(...all.flatMap((v) => v.map((q) => q[1])));
  assert.ok(top > 30, `${top.toFixed(1)} m tall`);
  for (let i = 0; i < T.n; i++) {
    const [x, z] = tombAt(i);
    assert.equal(imperialClosed(x, z), true, 'its podium closed');
    const [ox, oz] = polar(22.5 + i * 15, 1);
    for (const f of [T.w / 2 + T.podium + 3, (I.way.r0 - T.r) - 4]) assert.equal(imperialTile(x + ox * f, z + oz * f), 3, `its walk paved at ${f.toFixed(0)} m`);
    assert.equal(imperialClosed(x + ox * (T.w / 2 + T.podium + 3), z + oz * (T.w / 2 + T.podium + 3)), false, 'its walk walked');
    // its door: a dark face turned out toward the Way
    const door = all.filter((v, t) => recOf(m, t) === CAPITAL_ART.dark && v.every((q) => Math.hypot(q[0] - x, q[2] - z) < T.w));
    assert.ok(door.length >= 2, 'a door');
    const c = door[0].reduce((a, q) => [a[0] + q[0] / 3, a[1] + q[2] / 3], [0, 0]), [f] = tombFrame(c[0], c[1], i);
    assert.ok(f > 0, `tomb ${i}'s door on its face toward the Way`);
  }
});

test('IC-GRAND THE PALACE WALL\'S GATES DRESSED - each gate a gatehouse: a marble arch over it from its lintel to over the wall\'s walk, a gilt frieze and a gilt crest on both faces - its passage open below (mutant: the arches unbuilt)', () => {
  const W = I.palaceWall;
  for (const g of palaceGates()) {
    const [gx, gz] = polar(g, W.r), m = buildPalaceWall(undefined, nearRect([gx - 30, gz - 30, gx + 30, gz + 30], 0)), all = tris(m);
    const over = all.filter((v) => v.every((q) => Math.hypot(q[0] - gx, q[2] - gz) < W.gate / 2 + 2 && q[1] >= W.gateH - 0.01));
    assert.ok(over.length >= 10, `the ${g} gate's arch`);
    assert.ok(Math.max(...over.flatMap((v) => v.map((q) => q[1]))) > W.h + 3, 'over the walk');
    assert.ok(over.some((v) => recOf(m, all.indexOf(v)) === CAPITAL_ART.gold), 'gilt');
    assert.ok(over.filter((v) => recOf(m, all.indexOf(v)) === CAPITAL_ART.marble).length >= 8, 'a marble arch');
    assert.equal(all.some((v) => v.every((q) => Math.hypot(q[0] - gx, q[2] - gz) < W.gate / 2 - 1 && q[1] < W.gateH - 0.5)), false, 'its passage open');
  }
});

test('IC-GRAND THE PALACE DISTRICT FROM AFAR - the far silhouette of the centre slice carries the palace\'s wings and its pavilions round the tower, and the tombs\' slices their tombs (mutant: the palace unseen)', () => {
  const c = imperialLandmarkMesh(CENTRE);
  const B = 102.4, ox = (CENTRE % N - N / 2) * 8 * B, oz = (Math.floor(CENTRE / N) - N / 2 + 1) * 8 * B;
  let ring = 0;
  for (let i = 0; i < c.positions.length; i += 3) {
    const x = c.positions[i] + ox, z = oz - c.positions[i + 2], r = Math.hypot(x, z);
    if (r > P.r0 - 2 && r < P.r1 / Math.cos(Math.PI / P.sides) + P.pavilionR + 2 && c.positions[i + 1] > P.h - 1) ring++;
  }
  assert.ok(ring > 50, `${ring} of the palace's vertices round the tower`);
  const [tx, tz] = tombAt(0), s = Math.floor((tz + N * 4 * B) / (8 * B)) * N + Math.floor((tx + N * 4 * B) / (8 * B)), m = imperialLandmarkMesh(s);
  const sox = (s % N - N / 2) * 8 * B, soz = (Math.floor(s / N) - N / 2 + 1) * 8 * B;
  let tomb = 0;
  for (let i = 0; i < m.positions.length; i += 3) if (Math.hypot(m.positions[i] + sox - tx, soz - m.positions[i + 2] - tz) < T.w && m.positions[i + 1] > T.h) tomb++;
  assert.ok(tomb >= 4, 'a tomb from afar');
  assert.equal(STATUE_PLINTH > 2 && STATUE_PLINTH < G.statueOff, true);
  assert.equal(CAPITAL_ARCHIVE, 38400);
});
