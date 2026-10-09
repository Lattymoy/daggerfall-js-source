// WB2 (2026-09-25, Mac: "A gate model would be spawned with a timer that leads to a completely different area, a gate
// of oblivion"): THE GATE IN THE WORLD - its stone (world/gateModel.js), its art (world/gateArt.js), its fire and beacon
// (render/gatePass.js), the pool the world host stands it with (scenes/gatePool.js), the banner, the activation race
// and the world host's seams. Design: bible/11-Multiplayer/World-Bosses.md section 3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildGateModel, gateArchProfile, gateArchTop, gateSpines, gateClearAt, faces, spike, GATE_ARCHIVE, GATE_STONE_RECORD, GATE_PLINTH_RECORD, GATE_SPINE_RECORD, GATE_RIM_RECORD,
  GATE_HEIGHT, GATE_HALF_W, GATE_FOOT_SINK, GATE_TILE_M, GATE_PART, ARCH_Y0, ARCH_Y1, ARCH_PROFILE_N, PORTAL_CENTRE_Y,
} from '../src/world/gateModel.js';
import GATE_BAKE from '../src/assets/gate/oblivionGate.json' with { type: 'json' };
import { gateStoneArt, gatePlinthArt, gateSpineArt, gateRimArt, gateArt, GATE_ART_SIZE, VEIN_HEART, RUNE_GLOW, RIM_EMBER, RIM_SMOULDER } from '../src/world/gateArt.js';
import {
  GatePassRenderer, GATE_CLOCK_PERIOD, gateClock, MEMBRANE_TURN_SEALED_HZ, MEMBRANE_TURN_OPEN_HZ, MEMBRANE_FLOW_HZ, BEACON_CLIMB_HZ,
  GATE_PASS_MAX, MEMBRANE_VS, MEMBRANE_FS, BEACON_VS, BEACON_FS, BEACON_START_M, BEACON_WIDEN, membraneVertices, beaconVertices,
} from '../src/render/gatePass.js';
import { createGatePool, gatePlacement, gateLocal, openingHalfWidth, fireBox, GATE_BUCKET, GATE_TEXT, GATE_SAY_MS, GATE_BANNER_M } from '../src/scenes/gatePool.js';
import { raceActivation, raceWinner } from '../src/player/activationRace.js';
import { gateTimes, gateYaw, countdownText, GATE_RISE_MS, GATE_COLLAPSE_MS } from '../src/net/gateLaw.js';
import { trs } from '../src/world/mat4.js';
import { drawGateBanner, destroyGateBanner } from '../src/ui/gateBanner.js';
import { composeNamer } from '../src/systems/worldHover.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('WB2 the stone - GATE-FBX: Mac\'s gate as baked (tools/bakeGate.mjs), renderer.createMesh\'s own shape, flat-shaded, three textures of the gate\'s pseudo-archive, WB2\'s height; every triangle of the bake stands in it corner for corner and wound as baked, its soles sunk under the ground on walls of their own; AUDIT GATE-FBX P7/P8: its reach across x the spines\' points, and every spine\'s face a Spike of the model\'s parts, the rest Stone (mutants: a face turned over; the soles left on the ground; the reach read off z; the spines Stone)', () => {
  const m = buildGateModel();
  const n = m.positions.length / 3;
  assert.equal(m.normals.length, n * 3); assert.equal(m.uvs.length, n * 2); assert.equal(m.indices.length, n);
  assert.equal(n % 3, 0, 'whole triangles');
  // the sub-meshes partition the index list, one per texture, all the gate's own archive
  assert.deepEqual(m.subMeshes.map((s) => s.textureRecord), [GATE_STONE_RECORD, GATE_SPINE_RECORD, GATE_RIM_RECORD]);
  assert.ok(m.subMeshes.every((s) => s.textureArchive === GATE_ARCHIVE && GATE_ARCHIVE > 38000), 'far above any classic archive (bloodArt\'s law)');
  let at = 0;
  for (const s of m.subMeshes) { assert.equal(s.startIndex, at); at += s.primitiveCount * 3; }
  assert.equal(at, n, 'every triangle in exactly one sub-mesh');
  // flat shading: a face's three normals are one
  for (let i = 0; i < n; i += 3) for (let k = 0; k < 3; k++) assert.equal(m.normals[i * 3 + k], m.normals[(i + 2) * 3 + k]);
  const part = GATE_BAKE.parts[0], B = part.positions;
  assert.equal(GATE_HEIGHT, Math.max(...B.filter((_, i) => i % 3 === 1)), 'its crown, read off the bake');
  assert.ok(Math.abs(GATE_HEIGHT - 16.2) < 0.05, `WB2's height (${GATE_HEIGHT})`);
  assert.equal(m.triangles, m.positions, 'the collider takes the same triangles');
  // a triangle as a key: its corners as the mesh holds them (single precision), turned to start at the least - the same
  // face wound the same way
  const key = (c) => { const k = c.map((v) => v.map((x) => Math.fround(x)).join(',')); const r = k.indexOf([...k].sort()[0]); return [...k.slice(r), ...k.slice(0, r)].join('|'); };
  const have = new Set();
  for (let i = 0; i < n; i += 3) have.add(key([0, 1, 2].map((v) => [...m.positions.subarray((i + v) * 3, (i + v) * 3 + 3)])));
  const corner = (v, dy = 0) => [B[v * 3], B[v * 3 + 1] + dy, B[v * 3 + 2]];
  let soles = 0;
  for (let t = 0; t < part.triangles.length; t += 3) {
    const vs = part.triangles.slice(t, t + 3);
    const sole = vs.every((v) => Math.abs(B[v * 3 + 1]) < 1e-3);
    if (sole) soles++;
    assert.ok(have.has(key(vs.map((v) => corner(v, sole ? -GATE_FOOT_SINK : 0)))), `the bake's triangle ${t / 3} ${sole ? 'sunk ' : ''}as baked`);
  }
  assert.equal(soles, 4, 'two feet, two triangles a sole');
  // and nothing else but the soles' walls: four a foot, two triangles each
  assert.equal(n / 3, part.triangles.length / 3 + 2 * 4 * 2);
  let low = Infinity;
  for (let i = 1; i < m.positions.length; i += 3) low = Math.min(low, m.positions[i]);
  assert.ok(Math.abs(low + GATE_FOOT_SINK) < 1e-6, 'the feet run on under the ground');
  // its reach across x: the spines' points, 7.73 m out
  const tips = gateSpines().map((x) => Math.abs(B[x.tip * 3]));
  assert.equal(GATE_HALF_W, Math.max(...tips), 'the spines\' points');
  assert.ok(Math.abs(GATE_HALF_W - 7.7282) < 1e-4, `${GATE_HALF_W}`);
  // its parts: a spine's every face a Spike, every other face Stone
  assert.equal(m.parts.length, n / 3);
  const spine = m.subMeshes.find((x) => x.textureRecord === GATE_SPINE_RECORD);
  for (let t = 0; t < n / 3; t++) {
    const inSpine = t * 3 >= spine.startIndex && t * 3 < spine.startIndex + spine.primitiveCount * 3;
    assert.equal(m.parts[t], inSpine ? GATE_PART.Spike : GATE_PART.Stone, `triangle ${t}`);
  }
});

test('WB2 the stone faces out - GATE-FBX: the soles\' walls away from their sole and the sunk soles down; every spine\'s three faces away from its own axis, its point the corner they share; and spike() (the court\'s spires\', the Deadlands\') wound outward whatever way it points (mutants: a spike wound inward)', () => {
  const m = buildGateModel(), P = m.positions;
  const tri = (i) => [0, 1, 2].map((v) => [P[i + v * 3], P[i + v * 3 + 1], P[i + v * 3 + 2]]);
  const normal = ([a, b, c]) => { const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; return [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; };
  const mid = (c) => [0, 1, 2].map((k) => (c[0][k] + c[1][k] + c[2][k]) / 3);
  // the soles and their walls: below the ground, each wall facing away from its sole's middle (read off the bake)
  const bake = GATE_BAKE.parts[0], BP = bake.positions;
  const soleMids = bake.polygons.filter((poly) => poly.every((v) => Math.abs(BP[v * 3 + 1]) < 1e-3))
    .map((poly) => [0, 1, 2].map((k) => poly.reduce((sum, v) => sum + BP[v * 3 + k], 0) / poly.length));
  assert.equal(soleMids.length, 2, 'two feet');
  let walls = 0, sunk = 0;
  for (let i = 0; i < P.length; i += 9) {
    const c = tri(i), cen = mid(c), nr = normal(c);
    if (!(cen[1] < -1e-3)) continue;
    if (c.every((v) => Math.abs(v[1] + GATE_FOOT_SINK) < 1e-6)) { assert.ok(nr[1] < 0, 'a sunk sole faces down'); sunk++; continue; }
    const foot = soleMids.reduce((a, b) => (Math.hypot(b[0] - cen[0], b[2] - cen[2]) < Math.hypot(a[0] - cen[0], a[2] - cen[2]) ? b : a));   // its own sole's middle
    const out = [cen[0] - foot[0], 0, cen[2] - foot[2]];
    assert.ok(nr[0] * out[0] + nr[2] * out[2] > 0, `a sole's wall faces in at ${cen.map((x) => x.toFixed(2))}`);
    walls++;
  }
  assert.equal(sunk, 4); assert.equal(walls, 16);
  // the spines: each a cone of faces round its own axis, root to point - a cone of any count of faces, and never a box
  const cone = { polygons: [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]] }, box = { polygons: [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]] };
  assert.deepEqual(gateSpines(cone), [{ polygons: [0, 1, 2, 3], tip: 4 }], 'a four-faced cone, its point the corner every face shares');
  assert.deepEqual(gateSpines(box), [], 'a box is no spine');
  assert.deepEqual(gateSpines({ polygons: [...cone.polygons, ...box.polygons.map((p) => p.map((v) => v + 10))] }).map((s) => s.tip), [4], 'each piece judged apart');
  const spines = gateSpines();
  assert.equal(spines.length, 6, 'three down each pillar\'s outside');
  const part = GATE_BAKE.parts[0], B = part.positions, at = (v) => [B[v * 3], B[v * 3 + 1], B[v * 3 + 2]];
  for (const { polygons, tip } of spines) {
    const roots = [...new Set(polygons.flatMap((k) => part.polygons[k]))].filter((v) => v !== tip);
    assert.equal(roots.length, 3, 'a three-cornered root');
    const R = [0, 1, 2].map((k) => roots.reduce((s, v) => s + at(v)[k], 0) / 3), T = at(tip);
    assert.ok(Math.abs(T[0]) > Math.abs(R[0]) + 1 && T[1] > R[1], 'pointing out from its pillar, and up');
    const ax = [T[0] - R[0], T[1] - R[1], T[2] - R[2]], al = Math.hypot(...ax), u = ax.map((x) => x / al);
    for (const k of polygons) {
      const c = part.polygons[k].map(at), cen = mid(c), nr = normal(c), w = [cen[0] - R[0], cen[1] - R[1], cen[2] - R[2]];
      const along = w[0] * u[0] + w[1] * u[1] + w[2] * u[2], off = [w[0] - u[0] * along, w[1] - u[1] * along, w[2] - u[2] * along];
      assert.ok(nr[0] * off[0] + nr[1] * off[1] + nr[2] * off[2] > 0, 'a spine\'s face away from its axis');
    }
  }
  // spike(): four faces from a square root to a point, each facing away from its axis - pointing up, out, and down
  for (const [b, tip] of [[[0, 0, 0], [0, 3, 0]], [[0, 0, 0], [3, 0.5, 1]], [[0, 2, 0], [0.5, -1, -2]]]) {
    const f = faces();
    spike(f, b, 0.5, tip);
    const g = f.byRec.get(GATE_STONE_RECORD), Q = g.p;
    assert.equal(Q.length, 4 * 9, 'four faces');
    const ax = [tip[0] - b[0], tip[1] - b[1], tip[2] - b[2]], al = Math.hypot(...ax), u = ax.map((x) => x / al);
    for (let i = 0; i < Q.length; i += 9) {
      const c = [0, 1, 2].map((v) => [Q[i + v * 3], Q[i + v * 3 + 1], Q[i + v * 3 + 2]]), cen = mid(c), nr = normal(c);
      const w = [cen[0] - b[0], cen[1] - b[1], cen[2] - b[2]], along = w[0] * u[0] + w[1] * u[1] + w[2] * u[2];
      const off = [w[0] - u[0] * along, w[1] - u[1] * along, w[2] - u[2] * along];
      assert.ok(nr[0] * off[0] + nr[1] * off[1] + nr[2] * off[2] > 0, `spike(${JSON.stringify(tip)}) wound outward`);
    }
  }
});

/** The stone's section at height `y`: the least |x| of any triangle it cuts there (0 where one spans the middle). */
function sectionClear(P, y) {
  let clear = Infinity;
  for (let i = 0; i < P.length; i += 9) {
    let lo = Infinity, hi = -Infinity;
    for (let e = 0; e < 3; e++) {
      const a = i + e * 3, b = i + ((e + 1) % 3) * 3, ya = P[a + 1] - y, yb = P[b + 1] - y;
      if ((ya < 0 && yb < 0) || (ya > 0 && yb > 0) || ya === yb) continue;
      const x = P[a] + (P[b] - P[a]) * (ya / (ya - yb));
      lo = Math.min(lo, x); hi = Math.max(hi, x);
    }
    if (lo <= hi) clear = Math.min(clear, lo <= 0 && hi >= 0 ? 0 : Math.min(Math.abs(lo), Math.abs(hi)));
  }
  return clear;
}

test('WB2 the way in is clear - GATE-FBX: nothing of Mac\'s stone stands in the walk through the fire; the opening runs from the ground between the feet to the lintel\'s underside, and the fire drawn in it (the profile, interpolated as the pass draws it) stands its margin clear of the stone at every height - the cut corners\' tips included (mutants: the fire over the stone)', () => {
  const m = buildGateModel(), P = m.positions;
  // the corridor through the portal: 1.2 m either side of the centre, from the ground to over a head
  for (let y = 0.05; y <= 2.4; y += 0.05) assert.ok(sectionClear(P, y) >= 1.2, `stone in the way in at y ${y.toFixed(2)}`);
  assert.equal(ARCH_Y0, 0, 'the opening\'s foot is the ground between the feet');
  assert.ok(Math.abs(ARCH_Y1 - 13.8953) < 1e-4, `its top the lintel's underside (${ARCH_Y1})`);
  assert.equal(sectionClear(P, ARCH_Y1 + 0.05), 0, 'and the lintel closes it');
  assert.ok(Math.abs(PORTAL_CENTRE_Y - (ARCH_Y0 + ARCH_Y1) / 2) < 1e-9);
  const prof = gateArchProfile(m);
  assert.equal(prof.length, ARCH_PROFILE_N);
  assert.ok(prof.every((w) => w >= 0));
  assert.ok(openingHalfWidth(prof, 1.2) > 1.6 && openingHalfWidth(prof, 2) > 1.6, 'a body walks through with room either side');
  assert.ok(Math.max(...prof) > 3.3 && Math.max(...prof) < 3.6, 'as wide as the pillars stand apart, less the margin');
  assert.ok(Math.min(...prof.slice(-4)) < 0.4 * Math.max(...prof), 'the cut corners narrow it under the lintel');
  // the fire never runs into the stone: at every height the stone stands clear of it by the margin (to the millimetre
  // the profile's two ends are measured inside the opening - the feet's inner faces widen 0.8 mm up it)
  for (let y = ARCH_Y0 + 0.01; y < ARCH_Y1; y += 0.02) {
    const fire = openingHalfWidth(prof, y);
    assert.ok(sectionClear(P, y) >= fire + 0.15 - 1e-3, `the fire into the stone at y ${y.toFixed(2)}: ${fire.toFixed(3)} against ${sectionClear(P, y).toFixed(3)}`);
  }
  assert.equal(openingHalfWidth(prof, ARCH_Y0 - 1), 0);
  assert.equal(openingHalfWidth(prof, ARCH_Y1 + 1), 0);
  // AUDIT GATE-FBX G2: and it fits - each height the stone's own clear less the margin, but where the line between two
  // runs into a corner of the stone between them; nowhere a strip of sky between the fire and the stone wider than 0.6 m
  const band = (ARCH_Y1 - ARCH_Y0) / (ARCH_PROFILE_N - 1);
  const tight = prof.filter((w, k) => Math.abs(w - Math.max(0, gateClearAt(P, Math.min(ARCH_Y1 - 1e-3, Math.max(ARCH_Y0 + 1e-3, ARCH_Y0 + k * band))) - 0.15)) < 1e-6).length;
  assert.ok(tight >= 20, `${tight} of ${ARCH_PROFILE_N} heights at the stone's clear less the margin`);
  let wide = 0;
  for (let y = ARCH_Y0 + 0.01; y < ARCH_Y1; y += 0.01) wide = Math.max(wide, sectionClear(P, y) - openingHalfWidth(prof, y));
  assert.ok(wide < 0.6, `the widest strip between the fire and the stone ${wide.toFixed(3)} m (1.15 m in the bands' days)`);
});

test('AUDIT GATE-FBX G8 the opening\'s top: the least height over the threshold\'s middle of a face standing over it - the floor under half a metre and a face edge-on over the middle answer nothing - and a part with none refused, never Infinity handed to the fire\'s shader (mutants: the floor taken for the top; the crown taken for it)', () => {
  const part = (...tris) => ({ positions: tris.flat(2), triangles: tris.flatMap((_, t) => [t * 3, t * 3 + 1, t * 3 + 2]) });
  const flat = (y, r = 2) => [[-r, y, -r], [r, y, -r], [0, y, r]];
  const edgeOn = [[-1, 1, 0], [1, 1, 0], [0, 3, 0]];
  assert.equal(gateArchTop(part(flat(0.2), flat(9), flat(5), edgeOn)), 5, 'the lowest stone over the middle');
  assert.equal(gateArchTop(part(flat(5), flat(3, 0.5).map(([x, y, z]) => [x + 4, y, z]))), 5, 'a face off the middle answers nothing');
  assert.throws(() => gateArchTop(part(flat(0.2), edgeOn)), /no stone over its threshold/);
  assert.equal(gateArchTop(), ARCH_Y1);
});

test('WB2 the art - GATE-FBX: sixty-four texels square, the same stone for every client, fire only in the veins and the runes; every face laid on its picture - a standing face\'s veins climbing it, the rim the faces looking into the opening, each spine its horn root to burning point; AUDIT GATE-FBX G1/G3/G4: the rim Mac\'s own faces round the opening by hand - never a pillar\'s outer flank - its stone smouldering where it can be seen; and no face\'s picture stretched, its own normal choosing how it is laid (mutants: a wall of fire; the veins never burn; the spine laid point to root; the rim on the outside; the rim on the flanks; the rim cold; a face laid by its quad\'s normal; the tops\' v up; a spine\'s root one corner)', () => {
  const s = gateStoneArt(), p = gatePlinthArt(), sp = gateSpineArt(), rim = gateRimArt();
  for (const a of [s, p, sp, rim]) {
    for (const img of [a.albedo, a.emission]) { assert.equal(img.width, GATE_ART_SIZE); assert.equal(img.height, GATE_ART_SIZE); assert.equal(img.colors.length, GATE_ART_SIZE * GATE_ART_SIZE * 4); }
  }
  assert.deepEqual(gateStoneArt().albedo.colors, s.albedo.colors, 'deterministic');
  assert.deepEqual(gateSpineArt().emission.colors, sp.emission.colors, 'deterministic');
  const lit = (img) => { let n = 0; for (let i = 0; i < img.colors.length; i += 4) if (img.colors[i] || img.colors[i + 1] || img.colors[i + 2]) n++; return n; };
  const veins = lit(s.emission), runes = lit(p.emission);
  assert.ok(veins > 80 && veins < GATE_ART_SIZE * GATE_ART_SIZE * 0.35, `veins, not a wall of fire (${veins})`);
  assert.ok(runes > 40 && runes < GATE_ART_SIZE * GATE_ART_SIZE * 0.2, `a ring of runes (${runes})`);
  // wherever the emission burns the albedo is the fire's own colour; the stone itself stays dark
  let darkest = 255;
  for (let i = 0; i < s.albedo.colors.length; i += 4) if (!s.emission.colors[i]) darkest = Math.min(darkest, s.albedo.colors[i]);
  assert.ok(darkest < 40, 'the basalt is near black');
  const heart = (img, rgb) => { for (let i = 0; i < img.colors.length; i += 4) if (img.colors[i] === rgb[0] && img.colors[i + 1] === rgb[1] && img.colors[i + 2] === rgb[2]) return true; return false; };
  assert.ok(heart(s.emission, VEIN_HEART) && heart(p.emission, RUNE_GLOW));
  // the rim: more fire than the stone, and its stone smouldering where the stone's is dark - at an ember's two fifths,
  // a glow the night shows (a fifth of the bank was (6, 1, 0))
  assert.ok(lit(rim.emission) > veins * 3, 'the rim smoulders');
  let dimmest = 255;
  for (let i = 0; i < rim.emission.colors.length; i += 4) dimmest = Math.min(dimmest, rim.emission.colors[i]);
  assert.ok(dimmest >= Math.floor(RIM_EMBER[0] * RIM_SMOULDER) && dimmest >= 30, `its dimmest texel ${dimmest} red`);
  // the spine: dark from its root, burning toward its point - its first rows unlit, its last its hottest
  const row = (img, y) => { let sum = 0; for (let x = 0; x < GATE_ART_SIZE; x++) { const i = (y * GATE_ART_SIZE + x) * 4; sum += img.colors[i] + img.colors[i + 1] + img.colors[i + 2]; } return sum; };
  assert.equal(row(sp.emission, 0), 0, 'its root cold');
  assert.ok(row(sp.emission, GATE_ART_SIZE - 1) > row(sp.emission, Math.floor(GATE_ART_SIZE * 0.8)), 'its point the hottest');
  assert.deepEqual(gateArt().map(([rec]) => rec), [GATE_STONE_RECORD, GATE_PLINTH_RECORD, GATE_SPINE_RECORD, GATE_RIM_RECORD]);
  // laid on the model: a spine's point at v 1, its root at v 0
  const m = buildGateModel(), spine = m.subMeshes.find((x) => x.textureRecord === GATE_SPINE_RECORD);
  assert.equal(spine.primitiveCount, 18, 'six spines, three faces each');
  const tips = new Set(gateSpines().map((x) => x.tip)), part = GATE_BAKE.parts[0];
  const tipAt = [...tips].map((v) => part.positions.slice(v * 3, v * 3 + 3).map((x) => Math.fround(x)).join());
  for (let i = spine.startIndex; i < spine.startIndex + spine.primitiveCount * 3; i++) {
    const at = [...m.positions.subarray(i * 3, i * 3 + 3)].join();
    assert.equal(m.uvs[i * 2 + 1], tipAt.includes(at) ? 1 : 0, 'the point at v 1, the root at v 0');
  }
  // the stone: v climbs every standing face (its veins up the pillars), GATE_TILE_M a tile
  const stone = m.subMeshes.find((x) => x.textureRecord === GATE_STONE_RECORD);
  for (let i = stone.startIndex; i < stone.startIndex + stone.primitiveCount * 3; i++) {
    if (Math.abs(m.normals[i * 3 + 1]) < 0.5) assert.ok(Math.abs(m.uvs[i * 2 + 1] - m.positions[i * 3 + 1] / GATE_TILE_M) < 1e-5, 'v up a standing face');
  }
  // the rim: Mac's faces round the opening, BY HAND - each pillar's inner face, its foot's inner slope, the cut corners'
  // two faces and the lintel's underside (bake polygons 4, 15, 19, 22, 25, 42, 46, 49, 52) - and each sole's inner
  // wall under the ground; never the flanks of a pillar's outer flange (10, 14, 37, 41), which look out of its front and back
  const RIM = [4, 15, 19, 22, 25, 42, 46, 49, 52];
  const tkey = (c) => c.map((v) => v.map((x) => Math.fround(x)).join(',')).sort().join('|');
  const want = new Set(), BB = part.positions, cAt = (v) => [BB[v * 3], BB[v * 3 + 1], BB[v * 3 + 2]];
  part.triangleOf.forEach((k, t) => { if (RIM.includes(k)) want.add(tkey([0, 1, 2].map((e) => cAt(part.triangles[t * 3 + e])))); });
  const rimSm = m.subMeshes.find((x) => x.textureRecord === GATE_RIM_RECORD), have = new Set();
  let innerWalls = 0;
  for (let i = rimSm.startIndex; i < rimSm.startIndex + rimSm.primitiveCount * 3; i += 3) {
    const c = [0, 1, 2].map((v) => [...m.positions.subarray((i + v) * 3, (i + v) * 3 + 3)]);
    if (c.some((v) => v[1] < -1e-3)) {   // under the ground: a sole's wall, its face turned to the threshold's middle
      assert.ok(m.normals[i * 3] * Math.sign(c[0][0]) < -0.9, 'a sole\'s INNER wall');
      innerWalls++;
    } else have.add(tkey(c));
  }
  assert.deepEqual([...have].sort(), [...want].sort(), 'the rim, polygon for polygon');
  assert.equal(innerWalls, 4, 'each sole\'s inner wall, two triangles');
  // AUDIT GATE-FBX G3: no face's picture stretched past what a box projection must - each laid along the axis its OWN
  // face looks down most, its picture's area its own times that largest share of its normal (never under 1/sqrt 3); a
  // quad's normal laid a triangle of four of Mac's out-of-plane quads along another axis
  for (const sm of m.subMeshes) {
    if (sm.textureRecord === GATE_SPINE_RECORD) continue;
    for (let i = sm.startIndex; i < sm.startIndex + sm.primitiveCount * 3; i += 3) {
      const p = (v) => [...m.positions.subarray((i + v) * 3, (i + v) * 3 + 3)], uv = (v) => [m.uvs[(i + v) * 2], m.uvs[(i + v) * 2 + 1]];
      const [a, b, c] = [p(0), p(1), p(2)], e1 = b.map((x, k) => x - a[k]), e2 = c.map((x, k) => x - a[k]);
      const area = Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]) / 2;
      const [ua, ub, uc] = [uv(0), uv(1), uv(2)], uvArea = Math.abs((ub[0] - ua[0]) * (uc[1] - ua[1]) - (uc[0] - ua[0]) * (ub[1] - ua[1])) / 2;
      const nr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]].map((x) => Math.abs(x) / (2 * area));
      assert.ok(Math.abs((uvArea * GATE_TILE_M * GATE_TILE_M) / area - Math.max(...nr)) < 1e-3 && Math.max(...nr) >= 1 / Math.sqrt(3) - 1e-9, `a face laid stretched at ${a.map((x) => x.toFixed(2))}`);
    }
  }
  // a spine's three corners three places on its picture
  for (let i = spine.startIndex; i < spine.startIndex + spine.primitiveCount * 3; i += 3) {
    const keys = new Set([0, 1, 2].map((v) => `${m.uvs[(i + v) * 2]},${m.uvs[(i + v) * 2 + 1]}`));
    assert.equal(keys.size, 3, 'root, root and point');
  }
});

test('WB2 the fire and the beacon: every rate whole cycles over the clock, the membrane masked to the arch, the beacon never a hair', () => {
  for (const hz of [MEMBRANE_TURN_SEALED_HZ, MEMBRANE_TURN_OPEN_HZ, MEMBRANE_FLOW_HZ, BEACON_CLIMB_HZ]) {
    assert.ok(Math.abs(hz * GATE_CLOCK_PERIOD - Math.round(hz * GATE_CLOCK_PERIOD)) < 1e-9, `${hz} Hz is whole cycles over ${GATE_CLOCK_PERIOD} s`);
  }
  assert.equal(gateClock(GATE_CLOCK_PERIOD + 3), 3);
  assert.equal(gateClock(-1), GATE_CLOCK_PERIOD - 1);
  assert.match(MEMBRANE_FS, /uniform float uProfile\[24\];/, 'the arch\'s own opening');
  assert.match(MEMBRANE_FS, /if \(inside <= 0\.0\) discard;/, 'nothing drawn over the stone');
  assert.doesNotMatch(MEMBRANE_FS, /atan\(/, 'no branch cut to stand in the fire as a seam');
  assert.match(MEMBRANE_VS, /vec3 p = uOrigin \+ vec3\(aXY\.x \* c, aXY\.y, -aXY\.x \* s\);/, 'turned as trs turns the stone');
  assert.match(BEACON_VS, /float rad = max\(uRadius, length\(uEye\.xz - uOrigin\.xz\) \* /, 'the beacon widens with its distance');
  assert.ok(BEACON_WIDEN > 0 && BEACON_START_M >= GATE_HEIGHT - 2, 'and leaves the gate from its crown');
  assert.match(BEACON_FS, /max\(fogFactorAt\(vWorld\), /, 'the fog thins it and never takes it');
  // the membrane's quad turned by the VS equals the stone's matrix turned by trs - one frame for the fire and the stone
  const yaw = 1.1, c = Math.cos(yaw), s = Math.sin(yaw);
  const M = trs(10, 2, -5, 0, (yaw * 180) / Math.PI, 0);
  for (const [x, y] of [[3, 1], [-2.5, 9]]) {
    const vs = [10 + x * c, 2 + y, -5 - x * s];
    const tr = [M[0] * x + M[4] * y + M[12], M[1] * x + M[5] * y + M[13], M[2] * x + M[6] * y + M[14]];
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(vs[k] - tr[k]) < 1e-5, 'the fire hangs in the stone\'s own frame');   // trs answers a Float32Array
  }
  assert.equal(membraneVertices().length, 12);
  assert.equal(beaconVertices(8).length, 8 * 12);
});

function fakeGl() {
  const calls = [];
  const gl = new Proxy({ VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, ONE_MINUS_SRC_ALPHA: 12 }, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  return { gl, calls };
}

test('WB2 the pass: beacons added, fires premultiplied, faded gates skipped and capped, no depth written, the state put back', () => {
  const { gl, calls } = fakeGl();
  const pass = new GatePassRenderer(gl, gateArchProfile());
  calls.length = 0;
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  pass.draw([], I, I, [0, 0, 0], 1);
  assert.equal(calls.length, 0, 'nothing to draw, nothing touched');
  const g = (fade, x = 0) => ({ origin: [x, 0, 0], yaw: 0.3, open: 1, fade });
  pass.draw([g(0, 5), g(1), g(0.5, 30), g(1, 60)], I, I, [0, 0, 0], 12.5);
  assert.ok(!calls.some((c) => c[0] === 'uniform3f' && c[2] === 5), 'the faded gate is not the one drawn - it is skipped before the cap');
  const draws = calls.filter((c) => c[0] === 'drawArrays');
  assert.equal(draws.length, GATE_PASS_MAX * 2, 'a beacon and a fire each, the faded skipped, the rest capped');
  assert.equal(pass.drawn, GATE_PASS_MAX);
  assert.deepEqual(calls.filter((c) => c[0] === 'blendFunc').map((c) => c.slice(1)), [[gl.ONE, gl.ONE], [gl.ONE, gl.ONE_MINUS_SRC_ALPHA]], 'the beacon added; the fire premultiplied, so it hides what stands behind it');
  assert.deepEqual(calls.filter((c) => c[0] === 'depthMask').map((c) => c[1]), [false, true], 'no depth written, and the mask put back');
  const names = calls.map((c) => c[0]);
  assert.ok(names.lastIndexOf('enable') > names.lastIndexOf('drawArrays'), 'culling back on after');
  assert.ok(calls.some((c) => c[0] === 'disable' && c[1] === gl.BLEND) && names.lastIndexOf('disable') > names.lastIndexOf('drawArrays'), 'blending off after');
  assert.ok(calls.some((c) => c[0] === 'uniform1fv' && c[1] === 'uProfile' && c[2].length === ARCH_PROFILE_N), 'the arch\'s opening handed over');
});

/** A world the pool can stand a gate in: a pixel translation, a flat ground, a feet, a collider and a clock. */
function world({ day = 700, ground = 12, feet = null, ready = false } = {}) {
  const t = gateTimes(day);
  const clock = { now: t.riseAt - 1000 };
  const said = [], banners = [], entered = [], col = { adds: [], removes: 0 };
  const shift = { x: 0 };
  const g = { day, px: 400, py: 200, spot: [409.6, 409.6], t, fellAt: null, near: 'Copperham' };
  const pool = createGatePool({
    renderer: null, gl: null,
    collider: () => ({ addMesh: (k, p, i, m) => col.adds.push([k, Array.from(m)]), removeBucket: () => { col.removes++; } }),
    standing: () => ({ ...g, phase: clock.now < t.riseAt ? 'omen' : clock.now < t.riseAt + GATE_RISE_MS ? 'rising' : clock.now < t.openAt ? 'sealed' : clock.now < t.sealAt ? 'open' : 'closed' }),
    pixelTranslation: () => [shift.x, 0, 0],
    heightAt: (x) => (x > 1e6 ? -Infinity : ground),
    now: () => clock.now,
    feet: () => feet?.(),
    say: (s) => said.push(s), banner: (s) => banners.push(s), ready: () => ready, enter: (x) => entered.push(x),
  });
  return { t, clock, pool, said, banners, entered, col, shift, g };
}

test('WB2 the pool: stood where the omen says on the ground, heaving up out of it, its collider only once risen and again when the world moves', () => {
  const w = world();
  assert.equal(w.pool.frame(0.016), null, 'the omen marks the land; nothing stands yet');
  w.clock.now = w.t.riseAt + GATE_RISE_MS / 2;
  const half = w.pool.frame(0.016);
  assert.deepEqual([half.origin[0], half.origin[2]], [409.6, 409.6], 'the spot on its pixel, in the scene');
  assert.ok(half.origin[1] < 12 && half.origin[1] > 12 - GATE_HEIGHT, 'half out of the ground');
  assert.equal(half.yaw, gateYaw(700), 'turned by the day, alike for everyone');
  assert.ok(half.fade > 0.4 && half.fade < 0.6);
  assert.equal(w.col.adds.length, 0, 'no collider while it rises');
  w.clock.now = w.t.riseAt + GATE_RISE_MS;
  const up = w.pool.frame(0.016);
  assert.equal(up.origin[1], 12);
  assert.equal(w.col.adds.length, 1, 'the stone stands in the collider once risen');
  assert.equal(w.col.adds[0][0], GATE_BUCKET);
  w.pool.frame(0.016);
  assert.equal(w.col.adds.length, 1, 'and is not stood again while nothing moves');
  w.shift.x = 50;   // a floating-origin recentre: the pixel's translation moved
  const moved = w.pool.frame(0.016);
  assert.equal(moved.origin[0], 459.6);
  assert.equal(w.col.adds.length, 2, 'stood again where the world put it');
  assert.equal(w.pool.lights().length, 1);
  // a pixel not yet built stands nowhere
  w.shift.x = 2e6;
  assert.equal(w.pool.frame(0.016), null);
});

test('WB2 the pool: the collapse sinks it and takes its collider; the placement law pure', () => {
  const t = gateTimes(710);
  const g = { day: 710, px: 1, py: 1, spot: [0, 0], t, fellAt: t.openAt + 60_000 };
  const at = (now) => gatePlacement(g, { pixelTranslation: () => [0, 0, 0], heightAt: () => 5, now });
  assert.equal(at(t.openAt + 59_000).phase, 'open');
  const sinking = at(t.openAt + 60_000 + GATE_COLLAPSE_MS / 2);
  assert.equal(sinking.phase, 'collapsing');
  assert.ok(sinking.origin[1] < 5 && !sinking.risen && sinking.fade < 0.6);
  assert.equal(at(t.openAt + 60_000 + GATE_COLLAPSE_MS), null, 'gone');
  const w = world({ day: 711 });
  w.clock.now = w.t.openAt;
  w.pool.frame(0.016);
  assert.equal(w.pool.state().collider, true);
  w.pool.destroyAll();
  assert.equal(w.pool.state().collider, false, 'a transition takes the stone out of the collider');
  // the box the eye strikes is the FIRE's, not the stone's: a player before the threshold stands outside it
  const place = w.pool.frame(0.016);
  const box = fireBox(place, gateArchProfile());
  assert.ok(Math.abs(box.max[1] - box.min[1] - (ARCH_Y1 - ARCH_Y0)) < 1e-9, 'the fire\'s height');
  const before = [place.origin[0] + Math.cos(place.yaw) * 0 + Math.sin(place.yaw) * 4, place.origin[1] + 1, place.origin[2] + Math.cos(place.yaw) * 4];
  assert.ok(!before.every((v, k) => v >= box.min[k] && v <= box.max[k]), 'four metres before the fire is not inside its box');
  assert.ok(GATE_HALF_W < 8, 'GATE-FBX: the stone reaches no further than WB2\'s plinth did');
});

test('WB2 the door: sealed says when, open without a relay says not yet, open with one enters; said once a while', () => {
  const w = world({ day: 720 });
  w.clock.now = w.t.riseAt + GATE_RISE_MS + 1000;
  w.pool.frame(0.016);
  assert.equal(w.pool.activate('gate:720'), false);
  assert.deepEqual(w.said, [GATE_TEXT.opensIn(countdownText(w.t.openAt - w.clock.now))]);
  w.pool.activate('gate:720');
  assert.equal(w.said.length, 1, 'not again inside GATE_SAY_MS');
  w.clock.now = w.t.openAt + 1000;
  w.pool.frame(0.016);
  w.clock.now += GATE_SAY_MS;
  assert.equal(w.pool.activate('gate:720'), false);
  assert.equal(w.said[1], GATE_TEXT.notYet, 'a relay that cannot hold the arena: not yet');
  assert.equal(w.entered.length, 0);
  assert.equal(w.pool.activate('camp:1'), false, 'another key is not the gate\'s');
  const r = world({ day: 721, ready: true });
  r.clock.now = r.t.openAt + 1000;
  r.pool.frame(0.016);
  assert.equal(r.pool.activate('gate:721'), true);
  assert.deepEqual({ day: r.entered[0].day, near: r.entered[0].near }, { day: 721, near: 'Copperham' });
  assert.equal(r.pool.activate('camp:9'), false, 'a press on another key is never the gate\'s door');
  assert.equal(r.entered.length, 1);
  // the plaque names it, its countdown under it - SET7: a record the hover's ladder reads (composeNamer takes the first
  // answer with a title), where a bare string named nothing at all
  assert.deepEqual(r.pool.hoverName('gate:721'), { title: 'Dagon\'s Breach', subs: [`Seals in ${countdownText(r.t.sealAt - r.clock.now)}`] });
  assert.deepEqual(composeNamer([(k) => r.pool.hoverName(k)])('gate:721')?.title, 'Dagon\'s Breach', 'and the ladder takes it');
  r.clock.now = r.t.sealAt + 1000;
  r.pool.frame(0.016);
  assert.deepEqual(r.pool.hoverName('gate:721'), { title: 'Dagon\'s Breach', subs: ['Sealed', `Collapses in ${countdownText(r.t.wrathAt - r.clock.now)}`] },
    'GATE-COLLAPSE: sealed for the night, and when it goes');
  r.clock.now += GATE_SAY_MS;
  assert.equal(r.pool.activate('gate:721'), false);
  assert.equal(r.said.at(-1), GATE_TEXT.collapsesIn(countdownText(r.t.wrathAt - r.clock.now)), 'a press on the sealed gate says when it collapses');
  assert.equal(GATE_TEXT.collapsesIn('6:12'), 'The gate has sealed. It collapses in 6:12.');
  r.clock.now = r.t.wrathAt + 1000;
  r.pool.frame(0.016);
  assert.deepEqual(r.pool.hoverName('gate:721'), { title: 'Dagon\'s Breach', subs: [] }, 'collapsing: nothing left to count');
  assert.equal(r.pool.hoverName(7), null, 'a door\'s bare number is not the gate\'s (AUDIT-WH C1)');
});

test('WB2 the walk through: a step across the fire inside its opening enters; beside the pillars it does not; the banner near it alone', () => {
  let feet = null;
  const w = world({ day: 730, ready: true, feet: () => feet });
  w.clock.now = w.t.openAt + 1000;
  const place = w.pool.frame(0.016);
  const at = (lx, lz) => { const c = Math.cos(place.yaw), s = Math.sin(place.yaw); return [place.origin[0] + c * lx + s * lz, place.origin[1] + ARCH_Y0, place.origin[2] - s * lx + c * lz]; };
  for (const [lx, lz] of [[0, 1], [0, 0.4], [0, -0.4]]) { feet = at(lx, lz); w.pool.frame(0.016); }
  assert.equal(w.entered.length, 1, 'walked through the fire');
  assert.ok(Math.abs(gateLocal(place, at(1.2, -0.7))[0] - 1.2) < 1e-9 && Math.abs(gateLocal(place, at(1.2, -0.7))[2] + 0.7) < 1e-9, 'the gate\'s frame undone exactly');
  const w2 = world({ day: 731, ready: true, feet: () => feet });
  w2.clock.now = w2.t.openAt + 1000;
  const p2 = w2.pool.frame(0.016);
  const at2 = (lx, lz) => { const c = Math.cos(p2.yaw), s = Math.sin(p2.yaw); return [p2.origin[0] + c * lx + s * lz, p2.origin[1] + 1, p2.origin[2] - s * lx + c * lz]; };
  for (const [lx, lz] of [[7, 1], [7, -1]]) { feet = at2(lx, lz); w2.pool.frame(0.016); }
  assert.equal(w2.entered.length, 0, 'past the pillars, not through the fire');
  assert.ok(w2.banners.at(-1)?.startsWith('Dagon\'s Breach - seals in'), 'near it, the countdown stands over the screen');
  // GATE-COLLAPSE: sealed for the night, the banner counts down to the collapse (it said "sealed" and nothing more)
  w2.clock.now = w2.t.sealAt + 2000;
  w2.pool.frame(0.016);
  assert.equal(w2.banners.at(-1), 'Dagon\'s Breach - sealed, collapses in 9:58');
  w2.clock.now = w2.t.wrathAt + 1000;
  w2.pool.frame(0.016);
  assert.equal(w2.banners.at(-1), null, 'collapsing: no countdown over the screen');
  w2.clock.now = w2.t.openAt + 1000;
  feet = [p2.origin[0] + GATE_BANNER_M + 5, p2.origin[1], p2.origin[2]];
  w2.pool.frame(0.016);
  assert.equal(w2.banners.at(-1), null, 'and not from afar');
});

test('WB2 the race: the gate\'s fire takes a press it is nearest for, heads the tie order, and the plaque names what the press opens', () => {
  const p = (key, distance) => ({ key, distance, reach: 4 });
  assert.equal(raceActivation({ gate: p('gate:1', 3) }).gateWins, true);
  assert.equal(raceActivation({ gate: p('gate:1', 3), doorDistance: 2 }).gateWins, false, 'a nearer door takes it');
  assert.equal(raceActivation({ gate: p('gate:1', 2), camp: p('camp:1', 2) }).gateWins, true, 'at a tie the gate');
  assert.equal(raceWinner({ gate: p('gate:1', 2), camp: p('camp:1', 2), corpse: p('body', 2) }).key, 'gate:1');
  assert.equal(raceActivation({}).gateWins, false);
});

test('WB2 the banner: a readout that is written only when its words change and hides rather than leaves', () => {
  destroyGateBanner();
  const made = [];
  const doc = { createElement: () => { const n = { style: {}, remove() {}, set textContent(v) { this._t = v; made.push(v); }, get textContent() { return this._t; } }; return n; }, body: { append() {} } };
  drawGateBanner(null, { doc });
  assert.equal(made.length, 0, 'nothing to say, nothing made');
  drawGateBanner('Dagon\'s Breach - opens in 1:00', { doc });
  drawGateBanner('Dagon\'s Breach - opens in 1:00', { doc });
  assert.deepEqual(made, ['Dagon\'s Breach - opens in 1:00'], 'the same words, not written again');
  drawGateBanner('Dagon\'s Breach - opens in 0:59', { doc, hidden: true });
  assert.deepEqual(made, ['Dagon\'s Breach - opens in 1:00', ''], 'the HUD hidden takes it with it');
  destroyGateBanner();
});

test('WB2 the seams: online alone, stood before the lights, the stone in the world pass, the fire after the duel wall, the press and the plaque', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /const gatePool = gateOmen \? createGatePool\(\{/, 'the omen\'s own gate - online alone');
  assert.match(w, /ready: \(\) => !!online\?\.gateOk,   \/\/ WB3b/, 'the door opens at a relay that runs a gate\'s boss room (WB3b; it said "not yet" to every relay until then)');
  const frameAt = w.indexOf('try { if (gatePool?.frame(dt)) warmGateVeil(); }'), lightsAt = w.indexOf('const wodLit = wod ? _wodLitCount() : 0;');   // AUDIT WB D5: and the step's veil warmed when a gate stands
  assert.ok(frameAt > 0 && frameAt < lightsAt, 'stood before the lights read it');
  assert.equal((w.match(/\.\.\.\(gatePool\?\.lights\(\) \?\? \[\]\), \.\.\.\(riteHost\?\.lights\(\) \?\? \[\]\), \.\.\.camps\.lights\(\), \.\.\.droppedTorches\.lights\(\)\);/g) ?? []).length, 2,   // WB12d: the rite's braziers beside it
    'its fire lights the ground by night and by day - after the hand lights, before the camps and the dropped torches the renderer\'s cap cuts first');
  assert.match(w, /gatePool\?\.draw\(renderer\);[^\n]*\n\s*camps\.draw\(renderer\);/, 'the stone in the world pass beside the tents (before them: the tents and the wagon keep their HCC pair)');
  const duel = w.indexOf('duelWall.draw(rings'), pass = w.indexOf('gatePool.drawPass(proj, view');
  assert.ok(duel > 0 && pass > duel, 'the fire after the duel wall');
  assert.match(w, /if \(_race\.gateWins\) \{ if \(_gatePick\.distance > _gatePick\.reach\) setMidScreenText\(TOO_FAR_AWAY_TEXT\); else if \(!riteHost\?\.activate\(_gatePick\.key\)\) gatePool\.activate\(_gatePick\.key\); \}/, 'the press\'s arm, refusing out loud past its reach (WB12d: the faithful\'s casket rides its slot)');
  assert.match(w, /gate: _gatePick,   \/\/ WB2/);
  assert.match(w, /gate: gatePool \? pickActivatableHit\(cam\.pos, _hd, \[\.\.\.gatePool\.targets\(\), \.\.\.\(riteHost\?\.targets\(\) \?\? \[\]\)\], collider\) : null,/, 'the plaque races it too');
  assert.match(w, /\(key\) => gatePool\?\.hoverName\(key\) \?\? null,/);
  assert.match(w, /if \(\(gatePool \|\| sdHost\) && \(modes\?\.mode \?\? 'exterior'\) !== 'exterior'\) drawGateBanner\(null\);/, 'the countdown leaves with the street');   // SD19 (PIN MOVED): a Hollow's door's banner too
  assert.match(read('src/player/activationRace.js'), /firmFirst\(\[gate, broker, camp, water,/, 'the gate heads the tie order (SET7: the Broker who stands beside it right after)');
  assert.ok(PORTAL_CENTRE_Y > ARCH_Y0 && PORTAL_CENTRE_Y < ARCH_Y1);
});
