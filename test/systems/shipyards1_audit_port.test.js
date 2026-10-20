// AUDIT SHIPYARDS (2026-10-11, Mac: "Audit everything") - THE PORT'S PLACES: what the audit's lanes found in the
// shipyard's and the lighthouse's models, the port's pool, the lighthouse's gallery and stair, the piers and where the
// places stand, each fix pinned on the producer's own output (the built model, the host's own frames - TEST THE SHAPE THE
// PRODUCER MINTS). bible/03-World/Shipyards.md, AUDIT SHIPYARDS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { ALLOC_CHILD_ARGS } from '../allocChild.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildShipyardModel, SHIPYARD, HULL_STATIONS } from '../../src/world/shipyardModel.js';
import { buildLighthouseModel, buildLighthouseFire, LIGHTHOUSE, LIGHTHOUSE_POINTS, GALLERY_Y, LANTERN_H, TOWER_SIDES, towerR, OIL_CASKS, WATER_BUTT, STEP_BOX } from '../../src/world/lighthouseModel.js';
import { PORT_REC, PORT_PAINTERS, PORT_ARCHIVE } from '../../src/world/portArt.js';
import { peopleOf, createPortHost, feetInPort, guardFor, GUARD_HEADROOM, beamPuffs, nearFade, BEAM_PUFFS, BEAM_NEAR_FADE, BEAM_PERIOD_S, OFFICE_LAMP_RANGE } from '../../src/scenes/portHost.js';
import { KEEPER_HALF, KEEPER_HEIGHT, yardToScene } from '../../src/scenes/merchantYardsHost.js';
import { DECOR_SHADOW } from '../../src/scenes/decor/decorRoom.js';
import { townSeaOf, seaField, portSitesOn, portSpans, portPlaceRows, sceneToLocationXZ, siteToLocation, SEA_CELLS_MIN, LIGHT_APART_K, LIGHT_APART_CAP, LATERAL_K, FACE_K } from '../../src/world/portSites.js';
import { YARD_PAD_M, NO_ROAD_COST, FRONT_ROAD_CELLS } from '../../src/world/merchantYards/merchantYardSites.js';
import { NAV_CELL, NAV_CELLS_PER_BLOCK } from '../../src/world/city/cityNavigation.js';
import { portTownByData, lettersOnMap, foundBuildingKey, portPlaceName } from '../../src/systems/portPlaces.js';
import { stairRefusal, stairFeetY, PORT_TEXT } from '../../src/scenes/portHost.js';
import { AnswerPipeline } from '../../src/systems/answerPipeline.js';
import { DIRECTION_TEXT_ID, MAP_REVEAL_TEXT_ID } from '../../src/systems/talk/talkTopics.js';
import { SALE_FLOOR } from '../../src/systems/shipyards.js';
import { LOCATION_TYPES } from '../../src/formats/mapsFile.js';
import { planQuay, pierDress, lanternLights, GANGWAY_LANE, DRESS_LANE, FENDER_W, FENDER_STEP, BRACE_SPAN, BRACE_LOW, PILE_STEP, QUAY_DECK_UP, QUAY_DECK_T } from '../../src/systems/naval/quays.js';
import { buildQuayModel, JOIST_STEP, JOIST_H } from '../../src/world/quayModel.js';
import { findHarbour, offsetHarbour } from '../../src/systems/naval/shipLife.js';
import { createQuayPool } from '../../src/scenes/quayPool.js';
import { drawFleetPage, resetFleetPage } from '../../src/ui/fleetPage.js';
import { setHoldingsProvider } from '../../src/ui/holdingsPages.js';
import { MOD_SETTINGS } from '../../src/systems/modSettings.js';
import { TUTORIALS } from '../../src/systems/tutorialCatalogue.js';
import { Collider } from '../../src/player/collider.js';
import { PlayerMotor, CAPSULE_RADIUS } from '../../src/player/motor.js';

// ── the models' own triangles ─────────────────────────────────────────────────────────────────────────────────────
/** Each triangle of a built model: its corners, unit normal, picture and bounds. */
function trisOf(m) {
  const P = m.positions, I = m.indices, recOf = new Array(I.length / 3), out = [];
  for (const sm of m.subMeshes) for (let t = sm.startIndex / 3; t < sm.startIndex / 3 + sm.primitiveCount; t++) recOf[t] = sm.textureRecord;
  for (let t = 0; t < I.length / 3; t++) {
    const v = [0, 1, 2].map((k) => { const i = I[t * 3 + k]; return [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]; });
    const e1 = v[1].map((x, k) => x - v[0][k]), e2 = v[2].map((x, k) => x - v[0][k]);
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], l = Math.hypot(...n);
    if (l < 1e-9) continue;
    out.push({ v, n: n.map((x) => x / l), rec: recOf[t], min: [0, 1, 2].map((k) => Math.min(v[0][k], v[1][k], v[2][k])), max: [0, 1, 2].map((k) => Math.max(v[0][k], v[1][k], v[2][k])) });
  }
  return out;
}
/** The area two flat polygons (2D) share: `a` clipped by the triangle `b`. */
function sharedArea(a, b) {
  const area = (P) => { let s = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; s += p[0] * q[1] - q[0] * p[1]; } return s / 2; };
  const sb = area(b) > 0 ? 1 : -1;
  let poly = a.slice();
  for (let i = 0; i < 3 && poly.length; i++) {
    const p = b[i], q = b[(i + 1) % 3], inside = (r) => sb * ((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])) >= 0, next = [];
    for (let k = 0; k < poly.length; k++) {
      const c = poly[k], d = poly[(k + 1) % poly.length], ci = inside(c);
      if (ci) next.push(c);
      if (ci !== inside(d)) {
        const A = q[1] - p[1], B = p[0] - q[0], den = A * (d[0] - c[0]) + B * (d[1] - c[1]), t = den === 0 ? 0 : (A * p[0] + B * p[1] - A * c[0] - B * c[1]) / den;
        next.push([c[0] + (d[0] - c[0]) * t, c[1] + (d[1] - c[1]) * t]);
      }
    }
    poly = next;
  }
  return poly.length >= 3 ? Math.abs(area(poly)) : 0;
}
/** THE Z-FIGHTS: faces facing one way in DIFFERENT pictures (one picture with world-axis UVs draws the same texels),
 *  every corner of one within `tol` of the other's plane, sharing an area - `{ pictures, area }` per pair of pictures. */
function zFights(m, tol = 0.008) {
  const T = trisOf(m), grid = new Map(), seen = new Set(), out = new Map(), name = Object.fromEntries(Object.entries(PORT_REC).map(([k, v]) => [v, k]));
  T.forEach((t, i) => {
    for (let gx = Math.floor(t.min[0] / 0.5); gx <= Math.floor(t.max[0] / 0.5); gx++)
      for (let gy = Math.floor(t.min[1] / 0.5); gy <= Math.floor(t.max[1] / 0.5); gy++)
        for (let gz = Math.floor(t.min[2] / 0.5); gz <= Math.floor(t.max[2] / 0.5); gz++) {
          const k = `${gx},${gy},${gz}`; (grid.get(k) ?? grid.set(k, []).get(k)).push(i);
        }
  });
  for (const list of grid.values()) for (let x = 0; x < list.length; x++) for (let y = x + 1; y < list.length; y++) {
    const a = T[list[x]], b = T[list[y]], key = `${list[x]}|${list[y]}`;
    if (a.rec === b.rec || seen.has(key)) continue;
    seen.add(key);
    if (a.n[0] * b.n[0] + a.n[1] * b.n[1] + a.n[2] * b.n[2] < 0.9995) continue;
    const d = a.n[0] * a.v[0][0] + a.n[1] * a.v[0][1] + a.n[2] * a.v[0][2];
    if (b.v.some((p) => Math.abs(a.n[0] * p[0] + a.n[1] * p[1] + a.n[2] * p[2] - d) > tol)) continue;
    const n = a.n, ref = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const s = [n[1] * ref[2] - n[2] * ref[1], n[2] * ref[0] - n[0] * ref[2], n[0] * ref[1] - n[1] * ref[0]], sl = Math.hypot(...s);
    const u = s.map((c) => c / sl), w = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
    const pr = (p) => [p[0] * u[0] + p[1] * u[1] + p[2] * u[2], p[0] * w[0] + p[1] * w[1] + p[2] * w[2]];
    const area = sharedArea(a.v.map(pr), b.v.map(pr));
    if (area < 1e-4) continue;
    const k = [name[a.rec] ?? a.rec, name[b.rec] ?? b.rec].sort().join(' / ');
    out.set(k, +((out.get(k) ?? 0) + area).toFixed(4));
  }
  return Object.fromEntries(out);
}
/** Whether the segment a-b runs through the open box [x0, y0, z0, x1, y1, z1] (along its faces is not through it). */
function through(a, b, B) {
  let t0 = 0, t1 = 1;
  for (let k = 0; k < 3; k++) {
    const d = b[k] - a[k], lo = B[k], hi = B[k + 3];
    if (Math.abs(d) < 1e-12) { if (a[k] <= lo || a[k] >= hi) return false; continue; }
    let p = (lo - a[k]) / d, q = (hi - a[k]) / d;
    if (p > q) [p, q] = [q, p];
    t0 = Math.max(t0, p); t1 = Math.min(t1, q);
    if (t0 >= t1) return false;
  }
  return t1 - t0 > 1e-9;
}
/** Every edge of a built model running through the box `B` shrunk by 2 cm (a prop resting on another touches it). */
function edgesThrough(m, B) {
  const P = m.positions, I = m.indices, pt = (i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]], b = [B[0] + 0.02, B[1] + 0.02, B[2] + 0.02, B[3] - 0.02, B[4] - 0.02, B[5] - 0.02], out = [];
  for (let t = 0; t < I.length; t += 3) for (const [x, y] of [[0, 1], [1, 2], [2, 0]]) {
    const a = pt(I[t + x]), c = pt(I[t + y]);
    if (through(a, c, b)) out.push([a, c].map((p) => p.map((v) => +v.toFixed(2))));
  }
  return out;
}
/** Whether the model has a corner at `p` (the layout's data is where the model draws it). */
const hasCorner = (m, p) => {
  const P = m.positions;
  for (let i = 0; i < P.length; i += 3) if (Math.abs(P[i] - p[0]) < 1e-4 && Math.abs(P[i + 1] - p[1]) < 1e-4 && Math.abs(P[i + 2] - p[2]) < 1e-4) return true;
  return false;
};

test('AUDIT SHIPYARDS NO Z-FIGHT (L5-1): no two faces of the shipyard or the lighthouse facing one way in different pictures lie in one plane (within 8 mm) over a shared area - the office\'s and the cottage\'s gables stop under their roofs (they were in the tops\' plane), the hall\'s eaves beam butts its far side, the scaffold\'s inner posts stop under its walk, the gallery\'s hatch lid stands a centimetre proud', () => {
  assert.deepEqual(zFights(buildShipyardModel()), {}, 'the shipyard');
  assert.deepEqual(zFights(buildLighthouseModel()), {}, 'the lighthouse');
});

test('AUDIT SHIPYARDS PROPS CLEAR OF PROPS (L5-3): no edge of the built shipyard runs through its steam box, its firebox, its sea wall or a scaffold post - the shores skip the steam box and the posts, the capstan\'s bars clear the wall and the posts - nor through a person\'s box (the second shipwright stood in the firebox); each solid drawn where the layout says', () => {
  const m = buildShipyardModel(), Fe = SHIPYARD.fence, W = SHIPYARD.seaWall, H = SHIPYARD.hull, C = SHIPYARD.capstan;
  const sx = H.x + H.half + SHIPYARD.scaffold.out, walkY = SHIPYARD.points.workers[0][2] - 0.05;
  const solids = {
    'the steam box': SHIPYARD.steamBox, 'the firebox': SHIPYARD.firebox,
    'the sea wall (left)': [Fe.x0, 0.1, Fe.z0 - 0.15, W.gap0, W.h, Fe.z0 + 0.35], 'the sea wall (right)': [W.gap1, 0.1, Fe.z0 - 0.15, Fe.x1, W.h, Fe.z0 + 0.35],
  };
  for (const z of SHIPYARD.scaffold.posts) {   // their shafts: the walk and the rail are lashed on at their heads
    solids[`the scaffold's outer post at z ${z}`] = [sx + 0.35 - 0.065, 0.1, z - 0.065, sx + 0.35 + 0.065, walkY + 0.9, z + 0.065];
    solids[`the scaffold's inner post at z ${z}`] = [sx - 0.35 - 0.065, 0.1, z - 0.065, sx - 0.35 + 0.065, walkY - 0.16, z + 0.065];
  }
  for (const p of peopleOf({ kind: 'shipyard', key: '4242:shipyard' })) solids[`the ${p.role} ${p.i}'s box`] = [p.at[0] - KEEPER_HALF, p.at[1], p.at[2] - KEEPER_HALF, p.at[0] + KEEPER_HALF, p.at[1] + KEEPER_HEIGHT, p.at[2] + KEEPER_HALF];
  assert.equal(Object.keys(solids).length, 4 + 8 + 7);
  for (const [what, B] of Object.entries(solids)) assert.deepEqual(edgesThrough(m, B), [], `nothing through ${what}`);
  // each solid is drawn where the layout says - its corners are the model's
  for (const B of [SHIPYARD.steamBox, SHIPYARD.firebox]) for (const p of [[B[0], B[1], B[2]], [B[3], B[4], B[5]], [B[0], B[4], B[5]], [B[3], B[1], B[2]]]) assert.ok(hasCorner(m, p), `a corner at ${p}`);
  for (const z of SHIPYARD.scaffold.posts) {
    assert.ok(hasCorner(m, [sx + 0.35 + 0.065, walkY + 1.0, z + 0.065]), `the outer post at ${z}`);
    assert.ok(hasCorner(m, [sx - 0.35 - 0.065, walkY - 0.06, z - 0.065]), `the inner post at ${z}, under the walk`);
  }
  assert.ok(hasCorner(m, [C.x + 0.42, 0, C.z]), 'the capstan stands at its spot');
  // the shores stood: every other station either side, save the three along the steam box and the one at a post
  const shored = HULL_STATIONS.filter((_, i) => !(i % 2));
  assert.equal(shored.length, 7);
  assert.deepEqual(shored.filter((z) => z > SHIPYARD.steamBox[2] - 0.2 && z < SHIPYARD.steamBox[5] + 0.2), [-1.37, 0.29, 1.95]);
  assert.deepEqual(shored.filter((z) => SHIPYARD.scaffold.posts.some((p) => Math.abs(p - z) < 0.2)), [-3.03]);
});

test('AUDIT SHIPYARDS THE LIGHTHOUSE\'S PROPS (L5-3): its oil casks clear of the water butt, of each other, of the plinth and of the step; the butt clear of the plinth\'s corners (it stood 2.4 cm in them); the door and the slit windows lean with the tower\'s taper - every corner on the face at its own height (laid flat, the door\'s foot sank into the wall and its head stood off it)', () => {
  const m = buildLighthouseModel(), T = LIGHTHOUSE.tower, [bx, bz, br] = WATER_BUTT, CASK_R = 0.32;
  for (const [x, z] of OIL_CASKS) {
    assert.ok(Math.hypot(x - bx, z - bz) >= CASK_R + br + 0.01, `the cask at ${x},${z} clear of the butt`);
    assert.ok(Math.hypot(x - T.x, z - T.z) - CASK_R >= T.plinthR + 0.01, 'clear of the plinth\'s corners');
    assert.ok(x - CASK_R >= STEP_BOX[3] + 0.01 || x + CASK_R <= STEP_BOX[0] - 0.01 || z - CASK_R >= STEP_BOX[5] + 0.01, 'clear of the step');
    assert.ok(hasCorner(m, [x + CASK_R, 0, z]), 'drawn where the layout says');
  }
  assert.ok(Math.hypot(OIL_CASKS[0][0] - OIL_CASKS[1][0], OIL_CASKS[0][1] - OIL_CASKS[1][1]) >= 2 * CASK_R + 0.01, 'the casks clear of each other');
  assert.ok(Math.hypot(bx - T.x, bz - T.z) - br >= T.plinthR + 0.01, 'the butt clear of the plinth\'s corners');
  assert.ok(hasCorner(m, [bx + br, 0, bz]), 'the butt drawn where the layout says');
  // the door and the windows: every corner of theirs on the tower's face square to the town (+z) or the sea (-z)
  const face = (zSide, y, out) => T.z + zSide * (towerR(y) * Math.cos(Math.PI / TOWER_SIDES) + out);
  const corners = (rec, xHalf) => {
    const P = m.positions, out = [];
    for (const sm of m.subMeshes) {
      if (sm.textureRecord !== rec) continue;
      for (let t = sm.startIndex; t < sm.startIndex + sm.primitiveCount * 3; t++) {
        const i = m.indices[t], p = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
        if (Math.abs(p[0] - T.x) <= xHalf + 1e-6 && p[1] >= T.plinthH - 1e-6 && p[1] <= T.top) out.push(p);
      }
    }
    return out;
  };
  const door = corners(PORT_REC.door, LIGHTHOUSE.door.w / 2), windows = corners(PORT_REC.window, 0.22);
  assert.ok(door.length >= 4 && windows.length >= 6 * 4, 'the door and six windows found');
  for (const p of door) assert.ok(Math.abs(p[2] - face(1, p[1], 0.04)) < 1e-6, `the door's corner at y ${p[1].toFixed(2)} on the face`);
  for (const p of windows) assert.ok(Math.abs(p[2] - face(Math.sign(p[2] - T.z), p[1], 0.03)) < 1e-6, `a window's corner at y ${p[1].toFixed(2)} on the face`);
  assert.ok(new Set(door.map((p) => p[2].toFixed(4))).size === 2, 'the door leans: its foot and its head at two depths');
});

// ── the lighthouse over the real collider and motor ────────────────────────────────────────────────────────────────
const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const STILL = Object.freeze({ forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, crouch: false });
/** A flat ground, a lighthouse at (100, 100) turned `yaw`, the host over the REAL Collider - its buckets logged - with the
 *  feet of the body it is handed (`rig.body`), and its climbs. */
function towerRig(yaw = 0) {
  const col = new Collider(() => 0), buckets = new Set(), climbs = [];
  const g = { positions: [-200, 0, -200, 400, 0, -200, 400, 0, 400, -200, 0, 400], indices: [0, 1, 2, 0, 2, 3] };
  col.addMesh('ground', g.positions, g.indices, I4);
  const logged = { addMesh: (k, ...a) => { buckets.add(k); return col.addMesh(k, ...a); }, removeBucket: (k) => { buckets.delete(k); return col.removeBucket(k); } };
  const site = { key: '9:lighthouse', kind: 'lighthouse', x: 100, z: 100, yaw, comp: 0, race: 'Breton', name: 'L', keeper: { name: 'K', sex: 'male', variant: 0 } };
  const rig = { col, buckets, climbs, site, body: null, host: null };
  rig.host = createPortHost({ collider: () => logged, sites: () => [site], groundAt: () => 0, feet: () => (rig.body ? [rig.body.pos[0], rig.body.pos[1], rig.body.pos[2]] : null), climb: (s2, way, at) => { climbs.push({ way, at }); return true; } });
  rig.host.frame();
  rig.axis = yardToScene([100, 0, 100], yaw, LIGHTHOUSE.tower.x, 0, LIGHTHOUSE.tower.z);
  rig.r = () => Math.hypot(rig.body.pos[0] - rig.axis[0], rig.body.pos[2] - rig.axis[2]);
  rig.step = (n, input, yawOf = () => 0) => { for (let i = 0; i < n; i++) { rig.body.update(1 / 60, typeof input === 'function' ? input(i) : input, yawOf(i)); rig.host.frame(); } };
  return rig;
}
const seeded = (seed) => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

test('AUDIT SHIPYARDS THE GALLERY HOLDS (L4-1), over the real collider and motor: walking, a boosted jump, the classic climb (Climbing 10 crossed the railing in 1.63 s and fell 19.68 m) and the enhanced climb with parkour - none leaves the gallery; its guard stands in its own bucket while the feet are on the gallery, and goes as they climb down', () => {
  const G = LIGHTHOUSE.gallery;
  const bodies = {
    'a boosted jumper': (col) => new PlayerMotor(col, undefined, { jumpBoost: () => 1.5 }),
    'the classic climb': (col) => new PlayerMotor(col, undefined, { climbing: { inputs: () => ({ climbing: 10, luck: 50, khajiit: false, enhanced: false }), tally: () => {}, say: () => {}, rolls: seeded(1) } }),
    'the enhanced climb with parkour': (col) => new PlayerMotor(col, undefined, { jumpBoost: () => 1.5, climbing: { inputs: () => ({ climbing: 100, luck: 100, khajiit: true, enhanced: true }), tally: () => {}, say: () => {} }, parkour: { enabled: () => true, inputs: () => ({ climbing: 100, jumping: 100, khajiit: true, enhanced: true, fatigue: 1, load: 0 }), tally: () => {}, say: () => {}, hold: () => false } }),
  };
  for (const [who, make] of Object.entries(bodies)) for (const yaw of who === 'the classic climb' ? [0, 90] : [0]) {
    const rig = towerRig(yaw);
    rig.host.activate('port:9:lighthouse|door', 'grab', 'climb');
    const up = rig.climbs[0].at;
    rig.body = make(rig.col);
    rig.body.spawn(up.feet[0], up.feet[1], up.feet[2]);
    rig.step(30, STILL, () => up.yaw);
    assert.ok(rig.buckets.has('port:9:lighthouse:guard'), `${who}: the guard stands with the feet on the gallery`);
    let maxR = 0, minY = Infinity;
    const pats = [(i) => ({ ...STILL, forward: 1 }), (i) => ({ ...STILL, forward: 1, run: true, jump: i % 25 < 2 }), (i) => ({ ...STILL, forward: 1, up: true, jump: i % 7 < 3 })];
    for (const [k, pat] of pats.entries()) for (const turn of [0, 0.5]) {
      for (let i = 0; i < 150; i++) { rig.step(1, pat(i), () => up.yaw + turn + k * 0.3); maxR = Math.max(maxR, rig.r()); minY = Math.min(minY, rig.body.pos[1]); }
    }
    assert.ok(maxR < G.parapetR, `${who} (turned ${yaw}): kept inside the parapet - ${maxR.toFixed(2)} m off the axis`);   // PIN MOVED (BEACON-TOWER): the railing a parapet
    assert.ok(minY > GALLERY_Y - 0.1, `${who} (turned ${yaw}): never below the gallery's floor - ${minY.toFixed(2)}`);
    rig.host.activate('port:9:lighthouse|hatch', 'grab', 'down');
    const down = rig.climbs[1].at;
    rig.body.spawn(down.feet[0], down.feet[1], down.feet[2]);
    rig.step(2, STILL);
    assert.ok(!rig.buckets.has('port:9:lighthouse:guard'), `${who}: the guard goes as the feet go down`);
  }
});

test('AUDIT SHIPYARDS THE GUARD IS NO FLOOR (L4-1, the fix\'s own case): a body coming down onto the gallery from over it (levitating) lands on its floor, never on the guard\'s lid; it stands once the feet are under the lid by GUARD_HEADROOM (guardFor), stays while they are on the gallery, and never stands for feet outside the railing', () => {
  const rig = towerRig(0);
  rig.body = new PlayerMotor(rig.col);
  const over = yardToScene([100, 0, 100], 0, LIGHTHOUSE.tower.x, 25, LIGHTHOUSE.tower.z - 2.4);
  rig.body.spawn(over[0], over[1], over[2]);
  rig.body.levitating = true;
  rig.step(600, { ...STILL, down: true });
  assert.ok(Math.abs(rig.body.pos[1] - GALLERY_Y) < 0.05, `on the gallery's floor: ${rig.body.pos[1].toFixed(2)} (the lid at ${GALLERY_Y + LIGHTHOUSE.gallery.guardH})`);
  assert.ok(rig.buckets.has('port:9:lighthouse:guard'));
  const site = rig.site, at = [100, 0, 100], G = LIGHTHOUSE.gallery, onWalk = (y) => yardToScene(at, 0, 0, y, LIGHTHOUSE.tower.z - 2.4);
  assert.equal(guardFor(site, at, onWalk(GALLERY_Y + 0.02), false), true);
  assert.equal(guardFor(site, at, onWalk(GALLERY_Y + G.guardH - GUARD_HEADROOM + 0.05), false), false, 'too near the lid to stand it under');
  assert.equal(guardFor(site, at, onWalk(GALLERY_Y + G.guardH - 0.3), true), true, 'standing, it stays up to its lid');
  assert.equal(guardFor(site, at, yardToScene(at, 0, 0, GALLERY_Y + 0.05, LIGHTHOUSE.tower.z - G.parapetR - 0.1), false), false, 'past the parapet\'s inner face');
  assert.equal(guardFor(site, at, yardToScene(at, 0, 0, GALLERY_Y + 0.05, LIGHTHOUSE.tower.z - G.parapetR + 0.2), false), true, 'inside it');
  assert.equal(guardFor(site, at, onWalk(0), true), false, 'down at the foot');
});

test('AUDIT SHIPYARDS THE WAY DOWN CLEAR OF THE STEP (L4-4): the hatch stands the player before the door\'s step by a body\'s capsule and more (it stood them inside the step, popped half a metre up) - on the ground there, the real motor settled on it', () => {
  for (const yaw of [0, 90, 180, 270]) {
    const rig = towerRig(yaw);
    rig.host.activate('port:9:lighthouse|hatch', 'grab', 'down');
    const { feet } = rig.climbs[0].at;
    // the feet in the lighthouse's frame, against the step's box there
    const a = (-yaw * Math.PI) / 180, dx = feet[0] - 100, dz = feet[2] - 100, x = dx * Math.cos(a) + dz * Math.sin(a), z = -dx * Math.sin(a) + dz * Math.cos(a);
    const gx = Math.max(STEP_BOX[0] - x, 0, x - STEP_BOX[3]), gz = Math.max(STEP_BOX[2] - z, 0, z - STEP_BOX[5]);
    assert.ok(Math.hypot(gx, gz) >= CAPSULE_RADIUS + 0.1, `turned ${yaw}: ${Math.hypot(gx, gz).toFixed(2)} m clear of the step`);
    assert.deepEqual(LIGHTHOUSE_POINTS.foot.map((v) => +v.toFixed(6)), [x, feet[1] - 0, z].map((v) => +v.toFixed(6)), 'at the foot point');
    rig.body = new PlayerMotor(rig.col);
    rig.body.spawn(feet[0], feet[1], feet[2]);
    rig.step(60, STILL);
    assert.ok(rig.body.pos[1] < 0.05, `turned ${yaw}: on the ground - feet at ${rig.body.pos[1].toFixed(2)}`);
  }
});

test('AUDIT SHIPYARDS THE HOLLOW TOWER HOLDS NOBODY (L4-5): its collider is held back while a body is inside the tower up to half a metre under the gallery (it stopped at 2.5 m: a body levitating inside was sealed in) and inside the lantern up to its roof\'s point (else it rose into the lantern room\'s glass the tower had then, shut in with the lamp) - never on the gallery', () => {
  const site = { kind: 'lighthouse', yaw: 0 }, T = LIGHTHOUSE.tower, L = LIGHTHOUSE.lantern;
  const top = GALLERY_Y + L.sillH + L.archH + L.cornice + L.roofH;   // PIN MOVED (BEACON-TOWER): the lantern's sills, arches, cornice and roof
  assert.equal(top, GALLERY_Y + LANTERN_H);
  assert.equal(feetInPort(site, [0, 0, 0], [T.x, 10, T.z]), true, 'inside the tower at 10 m');
  assert.equal(feetInPort(site, [0, 0, 0], [T.x + 2.4, GALLERY_Y - 0.6, T.z]), true, 'just under the gallery');
  assert.equal(feetInPort(site, [0, 0, 0], LIGHTHOUSE_POINTS.gallery), false, 'on the gallery');
  assert.equal(feetInPort(site, [0, 0, 0], [T.x + 1.2, GALLERY_Y + 1, T.z]), true, 'inside the lantern');
  assert.equal(feetInPort(site, [0, 0, 0], [T.x, top + 0.1, T.z]), false, 'over the roof\'s point');
  // a body levitating up the tower's axis: never stood under it inside, and free over the dome
  const rig = towerRig(0);
  rig.body = new PlayerMotor(rig.col);
  rig.body.spawn(rig.axis[0], 0, rig.axis[2]);
  rig.host.destroyAll();   // the place rises again round the body at its foot
  rig.host.frame();
  assert.ok(!rig.buckets.has('port:9:lighthouse'), 'held back over the feet at its foot');
  rig.body.levitating = true;
  let stoodAt = null;
  for (let i = 0; i < 600 && stoodAt === null; i++) { rig.step(1, { ...STILL, up: true }); if (rig.buckets.has('port:9:lighthouse')) stoodAt = rig.body.pos[1]; }
  assert.ok(stoodAt !== null && stoodAt >= top - 0.05, `stood with the feet over the roof's point: ${stoodAt?.toFixed(2)}`);
});

// ── the pool's light, its art and its frame ────────────────────────────────────────────────────────────────────────
/** The pool over a renderer that logs its meshes, uploads and draws (with their options), a shipyard and a lighthouse. */
function poolRig({ now = () => 0, beamClock, lit = true } = {}) {
  const log = { meshes: [], uploads: [], draws: [], shadows: [], buckets: new Map() };
  const renderer = {
    textures: new Map(),
    uploadTexture: (a, r) => log.uploads.push([a, r]),
    createMesh: (m) => { const mesh = { n: log.meshes.length, tris: m.indices.length / 3 }; log.meshes.push(mesh); return mesh; },
    destroyMesh: () => {},
    drawMesh: (mesh, matrix, remap, o) => log.draws.push({ mesh, o }),
    recordShadowMesh: (mesh) => log.shadows.push(mesh),
    createBillboardBatch: (a, r, size) => ({ size }), destroyBillboardBatch: () => {},
  };
  const collider = { addMesh: (k, pos, idx) => log.buckets.set(k, { pos, idx }), removeBucket: (k) => log.buckets.delete(k) };
  const sites = [
    { key: '9:shipyard', kind: 'shipyard', x: 160, z: 100, yaw: 90, comp: 0, race: 'Breton', name: 'Y', keeper: { name: 'K', sex: 'male', variant: 0 }, crewmaster: { name: 'C', sex: 'male', variant: 1 } },
    { key: '9:lighthouse', kind: 'lighthouse', x: 100, z: 100, yaw: 0, comp: 0, race: 'Breton', name: 'L', keeper: { name: 'K', sex: 'male', variant: 0 } },
  ];
  const host = createPortHost({ renderer, collider: () => collider, sites: () => sites, groundAt: () => 2, lit: () => lit, now, ...(beamClock ? { beamClock } : {}) });
  return { host, log, renderer, sites };
}

test('AUDIT SHIPYARDS THE BEACON\'S FLAMES CAST NOTHING (L5-2\'s law; BEACON-TOWER, PIN MOVED): the flames over the coals are a mesh of their own, drawn with noShadow (round the lamp the lantern room\'s glass the tower had then shadowed its own light on every side: 600 rays of 600 hit the model within a metre) and only in the lanterns\' hours, never cast where the place is cast alone - and no solid: the collider holds the model and the keeper\'s box alone', () => {
  const { host, log, renderer } = poolRig();
  host.frame();
  assert.equal(log.meshes.length, 3, 'the shipyard, the lighthouse, its flames');
  const fire = log.meshes.find((m) => m.tris === buildLighthouseFire().indices.length / 3);
  assert.ok(fire, 'the flames a mesh of their own');
  host.draw(renderer);
  const drawn = log.draws.filter((d) => d.mesh === fire);
  assert.equal(drawn.length, 1);
  assert.deepEqual(drawn[0].o, { noShadow: true });
  assert.ok(log.draws.filter((d) => d.mesh !== fire).every((d) => !d.o), 'the timber and the stone cast as ever');
  log.draws.length = 0;
  assert.equal(host.draw(renderer, () => DECOR_SHADOW), 0, 'off screen within a shadow\'s reach: cast alone, none drawn');
  assert.ok(!log.shadows.includes(fire) && log.shadows.length === 2, 'the flames never cast');
  assert.deepEqual(log.draws, [], 'nor drawn');
  const bucket = log.buckets.get('port:9:lighthouse'), people = 1, box = 36;
  assert.equal(bucket.idx.length / 3, buildLighthouseModel().indices.length / 3 + people * box / 3, 'the model and the keeper\'s box in the collider - never the flames');
  // by day the brazier's coals smoulder and no flame stands over them
  const day = poolRig({ lit: false });
  day.host.frame();
  day.host.draw(day.renderer);
  const dayFire = day.log.meshes.find((m) => m.tris === buildLighthouseFire().indices.length / 3);
  assert.ok(dayFire, 'made all the same');
  assert.equal(day.log.draws.filter((d) => d.mesh === dayFire).length, 0, 'by day: no flames');
  assert.equal(day.log.draws.length, 2, 'the shipyard and the tower drawn');
});

test('AUDIT SHIPYARDS A NIGHT FRAME ALLOCATES NOTHING HERE (L4-2, PERF-LIGHTS\' law): the pool\'s frame, its glows (a lit lighthouse\'s 37 particles: 16 KB a call) and its lights write their records in place - measured as perfextb measures, in a node of its own with the collector at hand and a control that allocates', () => {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const script = `
    const { createPortHost } = await import(${JSON.stringify(root + 'src/scenes/portHost.js')});
    const site = { key: '9:lighthouse', kind: 'lighthouse', x: 100, z: 100, yaw: 0, comp: 0, race: 'Breton', name: 'L', keeper: { name: 'K', sex: 'male', variant: 0 } };
    const yard = { key: '9:shipyard', kind: 'shipyard', x: 160, z: 100, yaw: 0, comp: 0, race: 'Breton', name: 'Y', keeper: { name: 'K', sex: 'male', variant: 0 }, crewmaster: { name: 'C', sex: 'male', variant: 1 } };
    const tex = { getSize: () => ({ width: 40, height: 76 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 3 };
    const renderer = { textures: new Map(), createMesh: () => ({}), uploadTexture: () => {}, drawMesh: () => {}, createBillboardBatch: (a, r, size) => ({ size }), destroyBillboardBatch: () => {} };
    let T = 0, sink = null;
    const sites = [site, yard], eye = [100, 2, 160];
    const host = createPortHost({ renderer, getTexture: async () => tex, uploadRecordFrame: (a, r, f) => renderer.textures.set(a + '_' + r + '#' + f, 1), sites: () => sites, groundAt: () => 0, lit: () => true, now: () => T });
    host.frame(); await new Promise((r) => setTimeout(r, 0));
    const fns = { frame: () => { T += 16; host.frame(); }, glows: () => { T += 16; host.glows(eye, T / 1000); }, lights: () => host.lights(), control: () => { sink = { a: T, b: [T] }; } };
    const bytes = (fn) => {
      let least = Infinity;
      for (let r = 0; r < 5; r++) {
        for (let f = 0; f < 2000; f++) fn();
        globalThis.gc(); globalThis.gc();
        const h0 = process.memoryUsage().heapUsed;
        for (let f = 0; f < 2000; f++) fn();
        least = Math.min(least, (process.memoryUsage().heapUsed - h0) / 2000);
      }
      return least;
    };
    const out = {};
    for (const k of Object.keys(fns)) out[k] = bytes(fns[k]);
    out.glowCount = host.glows(eye, 0).length;
    console.log(JSON.stringify(out));
  `;
  const run = spawnSync(process.execPath, [...ALLOC_CHILD_ARGS, '--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const m = JSON.parse(run.stdout.trim().split('\n').pop());
  assert.equal(m.glowCount, 1 + 2 * BEAM_PUFFS);
  assert.ok(m.control >= 20, `the control allocated ${m.control.toFixed(2)} bytes a call - the measure is blind`);
  // the glows' 16 is the harness's own: its time handed as a fraction, a heap number a call
  assert.ok(m.glows < 64, `the glows: ${m.glows.toFixed(2)} bytes a call (were 16 KB)`);
  assert.ok(m.frame < 128, `the frame: ${m.frame.toFixed(2)} bytes a call (was 2.2 KB; a person's size read once a second as its idle turns)`);
  assert.ok(m.lights < 16, `the lights: ${m.lights.toFixed(2)} bytes a call (were 470)`);
});

test('AUDIT SHIPYARDS THE BEAMS TURN ON ONE CLOCK (L4-6): two clients whose frame clocks differ see one sweep - the beams\' clock is the wall clock\'s (Date.now), never the frame clock (performance.now: each client its own phase); and a puff the eye stands in fades out (L7-12: from the gallery each sweep was a flash), whole again at BEAM_NEAR_FADE of its size', () => {
  const eye = [100, 3, 160], wall = 1.79e9 + 3.25;
  const a = poolRig({ now: () => 12345, beamClock: () => wall }), b = poolRig({ now: () => 999, beamClock: () => wall });
  a.host.frame(); b.host.frame();
  const ga = a.host.glows(eye).map((g) => [...g.pos]), gb = b.host.glows(eye).map((g) => [...g.pos]);
  assert.deepEqual(ga, gb, 'one sweep on both');
  // the default clock: the wall clock's seconds
  const d = poolRig({ now: () => 5 });
  d.host.frame();
  const t0 = Date.now() / 1000, gd = d.host.glows(eye).map((g) => [...g.pos]), ge = d.host.glows(eye, t0).map((g) => [...g.pos]);
  const bearing = (G) => Math.atan2(G[BEAM_PUFFS][0] - G[0][0], G[BEAM_PUFFS][2] - G[0][2]);
  const turn = Math.abs(bearing(gd) - bearing(ge)) % (2 * Math.PI);
  assert.ok(Math.min(turn, 2 * Math.PI - turn) < (2 * Math.PI * 0.5) / BEAM_PERIOD_S, `the default turns on the wall clock: ${turn.toFixed(4)} rad off it`);
  // the near fade
  assert.equal(nearFade(0, 4), 0);
  assert.equal(nearFade(2, 4), 0, 'half its size: none');
  assert.equal(nearFade(4 * BEAM_NEAR_FADE, 4), 1);
  assert.ok(nearFade(4, 4) > 0 && nearFade(4, 4) < 1);
  const L = poolRig({ beamClock: () => 0 });
  L.host.frame();
  const lamp = L.host.glows(eye)[0].pos.slice(), far = L.host.glows([lamp[0] + 900, lamp[1], lamp[2]]).map((g) => g.color[3]);
  const th = (L.host.glows(eye), Math.atan2(L.host.glows(eye)[1].pos[0] - lamp[0], L.host.glows(eye)[1].pos[2] - lamp[2]));
  const puffs = beamPuffs(lamp, th);
  far.slice(1, 1 + BEAM_PUFFS).forEach((al, k) => assert.ok(Math.abs(al - puffs[k].alpha) < 1e-9, 'from afar, every puff whole'));
  const inside = L.host.glows(puffs[2].pos);   // the eye in the third puff's middle
  assert.equal(inside[3].color[3], 0, 'the puff the eye stands in: none');
  assert.ok(Math.abs(inside[15].color[3] - puffs[14].alpha) < 1e-9 && puffs[14].alpha > 0, 'the far puffs as they were');
});

test('AUDIT SHIPYARDS THE ART A FEW PICTURES A FRAME (L5-5): the twenty-six pictures were painted at once (~60 ms) in the frame that first stood a port - now while ART_BUDGET_MS of the frame is unspent (one at least), each once; the meshes are made once all are up, and the places stand in the collider from the first frame', () => {
  let t = 0;
  const { host, log } = poolRig({ now: () => (t += 3) });   // 3 ms a reading: two pictures a frame
  host.frame();
  assert.ok(log.uploads.length >= 1 && log.uploads.length <= 3, `the first frame painted ${log.uploads.length}`);
  assert.equal(log.meshes.length, 0, 'no mesh before the art is up');
  assert.ok(log.buckets.has('port:9:shipyard') && log.buckets.has('port:9:lighthouse'), 'in the collider at once');
  let frames = 1;
  while (log.meshes.length === 0 && frames < 100) { host.frame(); frames++; }
  assert.ok(frames > 5, `spread over ${frames} frames`);
  assert.equal(log.uploads.length, PORT_PAINTERS.length, 'every picture once');
  assert.deepEqual(new Set(log.uploads.map(([a, r]) => `${a}:${r}`)).size, PORT_PAINTERS.length);
  assert.ok(log.uploads.every(([a]) => a === PORT_ARCHIVE));
  assert.equal(log.meshes.length, 3);
});

test('AUDIT SHIPYARDS THE OFFICE LANTERN\'S LIGHT AT ITS GLASS (L5-6): the shipyard\'s lantern is one point of its layout (SHIPYARD.lantern) - the light the pool hands and the glass the model draws round it (the light was a literal of its own)', () => {
  const { host } = poolRig();
  host.frame();
  const lantern = host.lights().find((l) => l.range === OFFICE_LAMP_RANGE), want = yardToScene([160, 2, 100], 90, ...SHIPYARD.lantern);
  assert.deepEqual([lantern.x, lantern.y, lantern.z].map((v) => +v.toFixed(9)), want.map((v) => +v.toFixed(9)));
  const m = buildShipyardModel(), [lx, , lz] = SHIPYARD.lantern;
  assert.ok(hasCorner(m, [lx - 0.08, 1.77, lz - 0.09]) && hasCorner(m, [lx + 0.08, 2.03, lz + 0.09]), 'its glass round the point');
  assert.ok(SHIPYARD.lantern[1] > 1.77 && SHIPYARD.lantern[1] < 2.03);
});

// ── where they stand, and how they are found ───────────────────────────────────────────────────────────────────────
/** A town's ground (yardGround's shape) W x H cells, open but where `blockedAt` closes it and `roadAt` lays a road. */
function groundOf(W, H, { blockedAt = () => false, roadAt = () => false } = {}) {
  const blocked = new Uint8Array(W * H), road = new Uint8Array(W * H);
  for (let gy = 0; gy < H; gy++) for (let gx = 0; gx < W; gx++) { blocked[gy * W + gx] = blockedAt(gx, gy) ? 1 : 0; road[gy * W + gx] = roadAt(gx, gy) ? 1 : 0; }
  return { width: W, height: H, blocked, road };
}
const middleOf = (s) => [s.gx + s.nx / 2, s.gy + s.nz / 2];
const apartOf = (a, b) => { const [ax, ay] = middleOf(a), [bx, by] = middleOf(b); return Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by)); };

test('AUDIT SHIPYARDS THE LIGHT STANDS OFF THE YARD ON A BEARING (L3-1): where the town holds no sea of its own, the light stands along the seaward edge well off the shipyard - LIGHT_APART_K (0.5) outweighs the LATERAL_K (0.25) it pays a cell off the edge\'s middle (at the same quarter they cancelled: the light 14.5 cells off, beside the yard); the constants as numbers, never read back off themselves', () => {
  assert.deepEqual([LIGHT_APART_K, LATERAL_K, LIGHT_APART_CAP, SEA_CELLS_MIN, FACE_K, NO_ROAD_COST, SALE_FLOOR], [0.5, 0.25, 40, 48, 2, 12, 0.6]);
  assert.ok(LIGHT_APART_K > LATERAL_K && LIGHT_APART_K < 1, 'a cell off the middle pays less than it gains; a cell inland more');
  for (const bearing of [[0, 5], [5, 0], [-4, 0], [0, -3]]) {
    const [yard, light] = portSitesOn(groundOf(96, 80), seaField(96, 80, null, bearing));
    assert.equal(light.kind, 'lighthouse');
    assert.ok(apartOf(yard, light) >= 30, `bearing ${bearing}: ${apartOf(yard, light).toFixed(1)} cells between their middles`);
  }
});

test('AUDIT SHIPYARDS NO POND IS THE SEA AGAINST THE MAP (U2): a body of the town\'s own water lying against the map\'s bearing - its middle on the far side of the town\'s from the sea the map shows - is a lake inland, never the sea (the shipyard turned its back on the sea to face it); with the bearing, or with none, the same water is the sea', () => {
  const N = NAV_CELLS_PER_BLOCK;
  const block = (x, y, wet) => {
    const groundTiles = Array.from({ length: 16 }, (_, tx) => Array.from({ length: 16 }, (__, ty) => ({ textureRecord: wet(tx, ty) ? 0 : 2 })));
    return { x, y, dfBlock: { rmbBlock: { fldHeader: { autoMapData: new Uint8Array(N * N), groundData: { groundTiles } } } } };
  };
  // a lake against the town's west edge (the first block's first four tiles)
  const loc = { width: 2, height: 1, blocks: [block(0, 0, (tx) => tx <= 3), block(1, 0, () => false)] };
  assert.equal(townSeaOf(loc).cells, 16 * N, 'no bearing: its own water is the sea');
  assert.equal(townSeaOf(loc, [-3, 0]).cells, 16 * N, 'the map\'s sea west too: the sea');
  assert.equal(townSeaOf(loc, [3, 0]).cells, 0, 'the map\'s sea east: a lake inland');
  assert.equal(townSeaOf(loc, [0, 3]).cells, 16 * N, 'the map\'s sea north: across, not against');
  // and the places then stand off the map's bearing, backs to the east
  const g = groundOf(2 * N, N, { blockedAt: (gx) => gx < 4 * 4 });
  const [yard] = portSitesOn(g, seaField(2 * N, N, townSeaOf(loc, [3, 0]), [3, 0]));
  assert.ok(middleOf(yard)[0] > N, `the shipyard on the east side: ${middleOf(yard)[0]}`);
});

test('AUDIT SHIPYARDS ROOM FOR THE YARD ALONE (L6-9): a ground that fits the shipyard and nothing else stands the shipyard alone - its pad round it; and its front onto a road beats a front onto none by NO_ROAD_COST', () => {
  const [nx, nz] = portSpans('shipyard', 2), pad = Math.ceil(YARD_PAD_M / NAV_CELL - 1e-9);
  const tight = groundOf(nx + 2 * pad, nz + 2 * pad);
  const sites = portSitesOn(tight, seaField(nx + 2 * pad, nz + 2 * pad, null, [0, 3]));
  assert.deepEqual(sites.map((s) => s.kind), ['shipyard'], 'the yard alone');
  // the sea north; a road before the front (south) of the edge's east part only: the yard goes to face it
  const W = 120, H = 60, roadRow = H - pad - nz - FRONT_ROAD_CELLS;
  const withRoad = groundOf(W, H, { roadAt: (gx, gy) => gy === roadRow && gx >= 80 });
  const bare = groundOf(W, H);
  const [onRoad] = portSitesOn(withRoad, seaField(W, H, null, [0, 3])), [offRoad] = portSitesOn(bare, seaField(W, H, null, [0, 3]));
  assert.ok(offRoad.gx + offRoad.nx <= 80 && onRoad.gx + onRoad.nx > 80 && onRoad.gx > offRoad.gx, `along the edge to face the road: ${offRoad.gx}..${offRoad.gx + offRoad.nx} -> ${onRoad.gx}..${onRoad.gx + onRoad.nx}`);
  assert.ok(onRoad.score - offRoad.score < NO_ROAD_COST, 'it pays less off the middle than a front onto no road');
});

test('AUDIT SHIPYARDS THE ROWS, THE PORT AND THE STAIR, EXECUTED (L3-5, L6-10): the talk directory\'s rows (the crew hall at the crewmaster\'s table turned with the yard, the docks where the scene\'s point put them, named for the town), a port by its own data (Travel Options\' list or the port byte, never neither), the stair\'s refusals and its landing - each run, never read off world.js\'s text', () => {
  const yard = { kind: 'shipyard', x: 100, z: 50, yaw: 90, name: 'Voss\'s Shipyard', crewName: 'Wayrest\'s Crew Hall' };
  const light = { kind: 'lighthouse', x: 140, z: 20, yaw: 0, name: 'The Sentinel Light' };
  const crewAt = SHIPYARD.points.crewmaster, [cx, cz] = siteToLocation(yard, crewAt[0], crewAt[1]);
  assert.deepEqual(portPlaceRows([yard, light], crewAt, [180, -12], 'Sentinel'), [
    { kind: 'shipyard', x: 100, z: 50, name: 'Voss\'s Shipyard' },
    { kind: 'crewhall', x: cx, z: cz, name: 'Wayrest\'s Crew Hall' },
    { kind: 'lighthouse', x: 140, z: 20, name: 'The Sentinel Light' },
    { kind: 'docks', x: 180, z: -12, name: portPlaceName('docks', { townName: 'Sentinel' }) },
  ]);
  assert.deepEqual([cx, cz], [100 + crewAt[1], 50 - crewAt[0]], 'turned a quarter: its x along -z');
  assert.deepEqual(portPlaceRows([light], crewAt, null, 'Sentinel').map((r) => r.kind), ['lighthouse'], 'no docks till sounded');
  assert.deepEqual(portPlaceRows(null, crewAt, null, 'Sentinel'), []);
  assert.deepEqual(sceneToLocationXZ([500, -300], [400, 7, -200], [30, 2, -40]), [70, -60], 'the berth: the pixel\'s translation and the location\'s origin taken off');
  const town = (byte, mapId = 7) => ({ mapTableData: { mapId, locationType: LOCATION_TYPES.TownCity }, exterior: { exteriorData: { portTownAndUnknown: byte } } });
  assert.equal(portTownByData(town(0), (id) => id === 7), true, 'Travel Options\' harbour');
  assert.equal(portTownByData(town(1), () => false), true, 'the port byte');
  assert.equal(portTownByData(town(0), () => false), false, 'neither');
  assert.equal(portTownByData(town(0, 8), (id) => id === 7), false, 'another town\'s harbour');
  const now = { walking: true, onFoot: true, sailing: false, foes: false };
  assert.equal(stairRefusal('up', now), null);
  assert.equal(stairRefusal('up', { ...now, walking: false }), PORT_TEXT.shutStair, 'off the street');
  assert.equal(stairRefusal('up', { ...now, onFoot: false }), PORT_TEXT.riding);
  assert.equal(stairRefusal('up', { ...now, sailing: true }), PORT_TEXT.shutStair);
  assert.equal(stairRefusal('up', { ...now, foes: true }), PORT_TEXT.foes);
  assert.equal(stairRefusal('down', { ...now, onFoot: false, sailing: true, foes: true }), null, 'down always');
  assert.equal(stairRefusal('down', { ...now, walking: false }), PORT_TEXT.shutStair);
  assert.equal(stairFeetY('down', 2, 2.5), 2.52, 'onto the drawn ground where it stands higher');
  assert.equal(stairFeetY('down', 2, 1.5), 2, 'never under the door\'s point');
  assert.equal(stairFeetY('down', 2, NaN), 2);
  assert.equal(stairFeetY('up', 19.6, 30), 19.6, 'up where the pool says');
});

test('AUDIT SHIPYARDS NO MARK THAT MARKS NOTHING (L7-5): asked where the crew hall or the docks are - places no town map letters - the answer is the way there (7333) whatever the roll; the shipyard, the lighthouse, the yards and every building keep the 0.35 roll for the map\'s mark (7332)', () => {
  assert.equal(lettersOnMap(foundBuildingKey('crewhall')), false);
  assert.equal(lettersOnMap(foundBuildingKey('docks')), false);
  for (const k of ['shipyard', 'lighthouse', 'stable', 'transport']) assert.equal(lettersOnMap(foundBuildingKey(k)), true, k);
  assert.equal(lettersOnMap(123456), true, 'a building');
  const answer = (kind) => {
    const pipe = new AnswerPipeline({ tree: { getBuildingList: () => [] }, rolls: () => 0, expandRandomTextRecord: (id) => id, session: () => ({ socialGroup: 0, isSpyMaster: false }) });
    pipe.currentKeySubjectBuildingKey = foundBuildingKey(kind);
    pipe._resourceInfo = () => null;
    return pipe.getKeySubjectBuildingHint();
  };
  assert.equal(answer('docks'), DIRECTION_TEXT_ID);
  assert.equal(answer('crewhall'), DIRECTION_TEXT_ID);
  assert.equal(answer('lighthouse'), MAP_REVEAL_TEXT_ID, 'a roll under 0.35 marks a lettered place');
  assert.equal(answer('shipyard'), MAP_REVEAL_TEXT_ID);
  // the talk window's own hint asks the same law
  const tt = readFileSync(new URL('../../src/scenes/townTalk.js', import.meta.url), 'utf8');
  assert.match(tt, /const h = buildingHint\(rolls, !lettersOnMap\(building\.buildingKey\)\);/);
});

// ── the piers ───────────────────────────────────────────────────────────────────────────────────────────────────────
const COAST = (x, z) => !(z > 200 || (x > 300 && x < 400 && z > -300));
const QSEA = 34;
const QGROUND = (x, z) => (COAST(x, z) ? QSEA - 8 : QSEA + 3);
const QHARBOUR = findHarbour({ rect: { minX: -100, maxX: 100, minZ: 220, maxZ: 420 }, isWater: COAST });
const quayOf = (i = 0, key = 'port:1') => planQuay({ berth: QHARBOUR.berths[i], hull: QHARBOUR.hull, key, index: i, seaY: QSEA, groundAt: QGROUND });

test('AUDIT SHIPYARDS THE CARGO IS THE ONE IT WAS (L5-4): the dress draws its turns off its own stream (PIER_SALT), so a berth\'s cargo is what the quays laid before the piers were dressed - main\'s own output for this berth, number for number (proved over 18 berths at the audit)', () => {
  assert.deepEqual(quayOf(0).cargo, [
    { kind: 'crate', x: 12.359252345766873, z: 23.821940350814263, s: 1.1045052169938572, stack: 1 },
    { kind: 'crate', x: 12.561603851914406, z: 7.424981217903554, s: 0.882291863206774, stack: 1 },
    { kind: 'barrel', x: 12.54802552724257, z: -16.86649711120175, s: 0.36, stack: 1 },
    { kind: 'crate', x: 12.404793924950063, z: 17.830140411611648, s: 1.1118067693547347, stack: 1 },
  ]);
});

test('AUDIT SHIPYARDS A PIECE\'S BODY OUT OF THE LANE (L5-6): every fender pile\'s width (FENDER_W, its cap) and every coil\'s round stand out of the gangway\'s lane and DRESS_LANE past it - not their middles alone (a fender\'s stood 0.055 m in)', () => {
  assert.equal(FENDER_W, 0.26);
  let fenders = 0, coils = 0;
  for (let k = 0; k < 24; k++) for (let i = 0; i < QHARBOUR.berths.length; i++) {
    const p = quayOf(i, `port:${k}`);
    for (const [z] of p.fenders) { fenders++; assert.ok(Math.abs(z) - FENDER_W / 2 >= GANGWAY_LANE + DRESS_LANE - 1e-9, `fender at ${z.toFixed(3)}`); }
    for (const [, z, r] of p.coils) { coils++; assert.ok(Math.abs(z) - r >= GANGWAY_LANE + DRESS_LANE - 1e-9, `coil at ${z.toFixed(3)}, ${r.toFixed(2)} round`); }
  }
  assert.ok(fenders > 100 && coils > 50);
  // a bollard just off the lane: a coil's middle there clears the lane by a hand, its round would not - it goes the far side
  const p = quayOf(0), edge = GANGWAY_LANE + DRESS_LANE;
  let near = 0;
  for (let k = 0; k < 40; k++) {
    const bz = edge + 0.1 + 0.95;
    const d = pierDress({ frame: p.frame, deck: p.deck, quay: p.quay, zJ: 0, jetty: null, rows: [], bollards: [[p.quay.x0 + 0.4, bz]], cargo: [], key: `port:${k}`, index: 1, ground: () => -5 });
    for (const [, z, r] of d.coils) { assert.ok(Math.abs(z) - r >= edge - 1e-9, `coil at ${z.toFixed(2)}`); if (Math.abs(z - bz) > 0.9) near++; }
  }
  assert.ok(near > 0, 'the far side taken where the near one would stand in the lane');
});

test('AUDIT SHIPYARDS THE PIER\'S MODEL, COUNTED OFF ITS OWN FACES (L6-9): its joists one every 1.2 m under the deck and the jetty, its fender piles on a lattice of about 3 m, its braces two to each pair of neighbouring piles in a row no more than 6 m apart - the numbers, never read back off the module\'s own constants', () => {
  assert.deepEqual([JOIST_STEP, JOIST_H, FENDER_STEP, BRACE_SPAN, BRACE_LOW, PILE_STEP], [1.2, 0.18, 3, 6, -1.2, 4]);
  const p = quayOf(0), m = buildQuayModel(p), q = p.quay, under = QUAY_DECK_UP - QUAY_DECK_T;
  const zs = new Set(), P = m.positions;
  for (let i = 0; i < P.length; i += 3) if (Math.abs(P[i + 1] - (under - 0.18)) < 1e-5 && Math.abs(P[i] - (q.x0 + 0.25)) < 1e-5) zs.add(P[i + 2].toFixed(4));
  assert.equal(zs.size / 2, Math.floor((q.z1 - q.z0 - 0.6) / 1.2 + 1e-6) + 1, 'a joist every 1.2 m along the quay, its two edges each');
  const nF = Math.max(1, Math.round((q.z1 - q.z0 - 3) / 3));
  const lattice = Array.from({ length: nF + 1 }, (_, k) => q.z0 + 1.5 + ((q.z1 - q.z0 - 3) * k) / nF);
  for (const [z] of p.fenders) assert.ok(lattice.some((l) => Math.abs(l - z) < 1e-9), `a fender on the lattice: ${z}`);
  assert.ok(p.fenders.length >= lattice.length - 4, 'the lattice\'s all but the lane\'s and the ladders\'');
  // the braces: this berth's 29 pairs of neighbouring piles, two to each - counted at the audit (the plan keeps its rows)
  assert.equal(p.braces.length, 58);
  const pairs = new Set(p.braces.map(([a, b]) => [a, b].map((e) => `${e[0].toFixed(3)},${e[2].toFixed(3)}`).sort().join('|')));
  assert.equal(pairs.size, 29, 'two to a pair');
  const top = QUAY_DECK_UP - QUAY_DECK_T - 0.12;
  for (const [a, b] of p.braces) {
    assert.ok(Math.hypot(b[0] - a[0], b[2] - a[2]) <= 6 + 1e-9, 'neighbours no more than 6 m apart');
    assert.ok(Math.max(a[1], b[1]) <= top + 1e-9 && Math.min(a[1], b[1]) >= -1.2 + 0.1 - 1e-9, 'under the deck\'s timbers, never under -1.1');
  }
});

test('AUDIT SHIPYARDS THE PIER\'S COLLIDER IS ITS SOLID PART (L5-5): the timbers under the decks (joists, stringers, braces) and the deck\'s small fittings (cleats, coils) are drawn and never collided - the bucket the pool files at every recentre holds the rest (all of it went in: 2.5-3.8 times the quay\'s); and its lanterns\' light is made once a berth, standing where the berth lies now (made every night frame, and off the plan\'s place - where it was laid, not where a recentre moved it)', async () => {
  const p = quayOf(0), m = buildQuayModel(p), c = m.collider;
  const solidOnly = buildQuayModel({ ...p, braces: [], cleats: [], coils: [] });
  assert.ok(c.indices.length < m.indices.length * 0.75, `${c.indices.length / 3} of ${m.indices.length / 3} triangles collided`);
  assert.equal(c.indices.length, solidOnly.collider.indices.length, 'nothing of the braces, cleats or coils');
  const under = QUAY_DECK_UP - QUAY_DECK_T, q = p.quay;
  for (let k = 0; k < c.indices.length; k++) {
    const i = c.indices[k] * 3, x = c.positions[i], y = c.positions[i + 1];
    assert.ok(!(Math.abs(y - (under - 0.18)) < 1e-5 && x > q.x0 + 0.2 && x < q.x1 - 0.2), 'no joist\'s underside');
  }
  for (const [, , r] of p.coils) assert.ok(r > 0);
  assert.deepEqual([...m.indices.subarray(0, c.indices.length)], [...c.indices], 'the collider\'s faces the model\'s own first ones');
  // the pool files the collider, not the model, and lights the berth where it lies now
  const H = findHarbour({ rect: { minX: -100, maxX: 100, minZ: 220, maxZ: 420 }, isWater: COAST });
  const buckets = new Map();
  const pool = createQuayPool({
    renderer: { createMesh: () => ({}), destroyMesh() {}, drawMesh() {} }, prepare: async () => {},
    collider: () => ({ addMesh: (k, pos, idx) => buckets.set(k, idx.length / 3), removeBucket: (k) => buckets.delete(k) }),
    harbours: () => [{ key: 'port:1', name: 'Sentinel', harbour: H }], seaY: () => QSEA, groundAt: QGROUND,
    feet: () => [H.berths[0].pos[0], QSEA, H.berths[0].pos[1] + 20], mode: () => 'exterior', now: () => 0,
  });
  pool.frame();
  await new Promise((r) => setTimeout(r, 0));
  const plan0 = pool.standing().find((s) => s.index === 0).plan;
  assert.equal([...buckets.values()][0], buildQuayModel(plan0).collider.indices.length / 3, 'the solid part filed');
  const a = pool.lights(), b = pool.lights();
  assert.ok(a.length > 0 && a.every((l, i) => l === b[i]), 'the same lights, made once');
  const before = a.map((l) => [l.x, l.z]);
  offsetHarbour(H, [100, 0, 50]);   // the world recentred: the berths moved in place
  pool.offsetAll();
  const moved = pool.lights();
  const near = (l, x, z) => Math.abs(l.x - x) < 1e-6 && Math.abs(l.z - z) < 1e-6;
  assert.ok(moved.length > 0 && moved.every((l) => before.some(([x, z]) => near(l, x + 100, z + 50))), 'every lantern moved with its berth');
  assert.ok(moved.some((l) => lanternLights(plan0, QSEA, H.berths[0].pos).some((p) => near(l, p[0], p[2]))), 'off its live place');
});

// ── the words ───────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT SHIPYARDS THE WORDS SEND THE PLAYER TO THE SHIPYARD (L7-1, L7-4, L7-6): the empty Fleet and Come Sail Away\'s own setting name the shipyard (they named a general store, which sells no ship now); the Sailing page says a bought ship is laid up and brought round from Your fleet (she does not wait at the quay); the Shipyards page says port towns have one (a town with no room stands none)', () => {
  const kids = (n) => n.children;
  const el = (tag, cls, text) => {
    const n = { tag, cls, children: [], _t: text == null ? '' : String(text), append(...cs) { n.children.push(...cs); }, setAttribute() {} };
    Object.defineProperty(n, 'textContent', { get: () => n._t + kids(n).map((c) => c.textContent).join(' ') });
    return n;
  };
  const prevDoc = globalThis.document;
  globalThis.document = undefined;
  try {
    setHoldingsProvider({ fleet: { model: () => ({ ships: [], gold: 0, atPort: false }) } });
    resetFleetPage();
    const d = el('div');
    drawFleetPage(d, () => {}, { el, divider: (t) => el('h4', null, t) });
    assert.match(d.textContent, /You don't own a ship\. Buy one at a port shipyard/);
    assert.doesNotMatch(d.textContent, /general store/i);
  } finally { setHoldingsProvider(null); globalThis.document = prevDoc; }
  const csa = MOD_SETTINGS['come-sail-away'].keys.Enabled.description;
  assert.match(csa, /Buy parts or a deed at a shipyard, put it in the water/);
  const page = (id) => TUTORIALS.find((t) => t.id === id).body.join(' ');
  assert.match(page('ships'), /A larger ship is laid up where you bought it; bring it round from the shipyard's Your fleet page\./);   // VOICE1 (PIN MOVED): the same law in plain words
  assert.doesNotMatch(page('ships'), /waits at the port/);
  assert.match(page('shipyard'), /^Port towns have a shipyard by the water\./);
});
