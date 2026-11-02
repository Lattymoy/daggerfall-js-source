// AUDIT GALLEON (2026-10-02, Mac: "Audit this. It must be perfect") - THE GUNS: her broadside out of her own ports
// whatever the shooter did and whoever watches. Each pin failed on the code as it stood (886da9b19).
//   G1 the port side's shutters keep their mirror and swing up outboard, as the starboard side's do;
//   G2 a quick click (a release without a lay) still fires every ball from a gun run out through an open port;
//   G3 my laid broadside is on my word (`g`), another player's galleon is laid from hers, and a volley of hers laid late
//      still leaves her ports open with her guns out;
//   G4 hull 2 that falls back to the mod's own galleon keeps the mod's own numbers for her guns, her box and her rig;
//   G5 each ball leaves through its port as she heels - placed through her hull, not her upright root;
//   G6 her draft in the routing table is her keel's;
//   G7 a fast sea's long frame runs her guns out as far as its time does;
//   G8 my look lays no battery while it reloads.
// AUDIT GALLEON-2 (2026-10-03): G2's and G3's frames run in world.js's order, the Animators before the sea (PF1); G5's
// captain heeled 8 deg and each ball held to its heeled muzzle's height (TS3: her own heel there was inside the slack).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { scene, MODELS } from '../../csaScene.mjs';
import { sea, freshPool } from '../../navalSea.mjs';
import * as ships from '../../../src/systems/naval/navalShips.js';
const { HULL } = ships;
import { MEASURED, LID_OPEN_DEG, LID } from '../../../src/world/ships/galleonModel.js';
import { TEX } from '../../../src/world/ships/galleonArt.js';
import { hullTriangles, halfBreadth } from '../../../tools/galleonLidFit.mjs';
import { createGalleonGunDeck, RUN_OUT_X, RUN_IN_X, RECOIL, KICK_S, HOLD_S } from '../../../src/systems/naval/galleonGunDeck.js';
import { PEER_LAY_S } from '../../../src/scenes/naval/navalHost.js';
import { navalWireRecord, validNavalRecord } from '../../../src/systems/naval/navalWire.js';
import { Boat, animatorOf } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { createComeSailAwayPool } from '../../../src/scenes/comeSailAway/comeSailAwayPool.js';
import { draftOf } from '../../../src/systems/naval/shipLife.js';   // AUDIT GN2-PF6: the draft table's home
import { quatRotate } from '../../../src/world/quat.js';

/** Her hull's own triangles, as baked (her side's half-breadth under a point: tools/galleonLidFit.mjs). */
const HULL_TRIS = hullTriangles(JSON.parse(readFileSync(new URL('../../../src/assets/galleon/galleon.json', import.meta.url), 'utf8')));
const near = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);
const nodesOf = (boat) => [...boat.GameObject.walk()];
const animatorsOf = (boat) => nodesOf(boat).flatMap((n) => n.getComponents('Animator').map((c) => c.animator).filter(Boolean));
/** A point of a node's own frame, in her MeshObject's (her hull's) frame. */
function inHull(boat, node, p) {
  const m = node.worldMatrix(), h = boat.MeshObject.worldMatrix();
  const w = [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
  const d = [w[0] - h[12], w[1] - h[13], w[2] - h[14]];
  // her hull's frame is rigid: R^T d
  return [h[0] * d[0] + h[1] * d[1] + h[2] * d[2], h[4] * d[0] + h[5] * d[1] + h[6] * d[2], h[8] * d[0] + h[9] * d[1] + h[10] * d[2]];
}
/** Every vertex of a node's drawn mesh, in her hull's frame. */
function meshInHull(boat, node) {
  const mf = node.getComponent('MeshFilter');
  const g = MODELS.geometry(mf.m_Mesh.mesh);
  const out = [];
  for (let i = 0; i < g.positions.length; i += 3) out.push(inHull(boat, node, [g.positions[i], g.positions[i + 1], g.positions[i + 2]]));
  return out;
}
const lidAngle = (n) => Math.abs(2 * Math.atan2(Math.hypot(n.localRotation[0], n.localRotation[2]), n.localRotation[3]) * 180 / Math.PI);
/** How far outboard of its hinge a shutter's body stands, across her (its faces' area-weighted middle). */
function bodyOutboard(boat, node, sgn) {
  const g = MODELS.geometry(node.getComponent('MeshFilter').m_Mesh.mesh);
  const P = (i) => inHull(boat, node, [g.positions[3 * i], g.positions[3 * i + 1], g.positions[3 * i + 2]]);
  let area = 0, x = 0;
  for (let t = 0; t < g.indices.length; t += 3) {
    const a = P(g.indices[t]), b = P(g.indices[t + 1]), c = P(g.indices[t + 2]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const k = Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
    area += k; x += k * (a[0] + b[0] + c[0]) / 3;
  }
  return sgn * (x / area - inHull(boat, node, [0, 0, 0])[0]);
}

test('AUDIT GALLEON G1: every gunport shutter on both her sides stands outboard of her planking shut, its board outboard of its hinge, and swings up outboard to LID_OPEN_DEG open - the port side\'s board and clip each the starboard side\'s mirror (the clip wrote the node\'s whole turn, and five boards swung into her gun deck)', () => {
  const s = scene();
  const boat = s.place(HULL.SmallShip, 0);
  const lids = nodesOf(boat).filter((n) => /^Gunport(Starboard|Port)\d$/.test(n.name));
  assert.equal(lids.length, 10);
  const step = (secs) => { for (let t = 0; t < secs; t += 0.25) s.frame(); };
  step(1);
  for (const lid of lids) {
    const sgn = lid.name.includes('Starboard') ? 1 : -1;
    const pts = meshInHull(boat, lid);
    // PIN MOVED (AUDIT GALLEON P6, 2026-10-02): fitted to her side - a shut shutter's board lies on her planking (its
    // inner face 3 mm off it, bent to it: tools/galleonLidFit.mjs), so it is held to her side's own half-breadth under
    // each vertex, not to one plumb bound 12 cm inside her widest (5.739): port 4's foot follows her side where it falls
    // in under the sill toward the bow, to 5.390; the hinge's iron eyes sit on their pin on her side, let into it by
    // their radius
    const g = MODELS.geometry(lid.getComponent('MeshFilter').m_Mesh.mesh);
    const iron = g.subMeshes[g.slots.findIndex((sl) => sl.record === TEX.iron)];
    // (a MeshBench geometry draws each corner its own vertex, in index order: a sub-mesh's index run is its vertices)
    const isEye = (v) => v >= iron.startIndex && v < iron.startIndex + iron.primitiveCount * 3;
    pts.forEach((p, v) => {
      const side = halfBreadth(HULL_TRIS, p[1], p[2], sgn);
      if (side == null) return;
      assert.ok(sgn * p[0] >= side - (isEye(v) ? LID.eyeR : 0) - 1e-3, `${lid.name} shut: outboard of her planking at (${p[1].toFixed(3)}, ${p[2].toFixed(3)}): ${(sgn * p[0]).toFixed(3)} vs her side ${side.toFixed(3)}`);
    });
    // its board hangs outboard of its hinge, its painted face out (the starboard side's board on the port side stood
    // inboard of it, into her planking, its inner face to the sea)
    const out = bodyOutboard(boat, lid, sgn);
    assert.ok(out > 0.03, `${lid.name} shut: its board outboard of its hinge (${out.toFixed(3)})`);
    animatorOf(lid).SetBool('Opened', true);
  }
  step(3);
  for (const lid of lids) {
    const sgn = lid.name.includes('Starboard') ? 1 : -1;
    const pts = meshInHull(boat, lid);
    near(lidAngle(lid), LID_OPEN_DEG, 1.5, `${lid.name} open`);
    assert.ok(pts.every((p) => sgn * p[0] >= MEASURED.hullOuterX - 0.12), `${lid.name} open: outboard (min ${Math.min(...pts.map((p) => sgn * p[0])).toFixed(3)})`);
    const far = Math.max(...pts.map((p) => sgn * p[0]));
    assert.ok(far > MEASURED.hullOuterX + 1.2, `${lid.name} open: up and out over her side (${far.toFixed(2)})`);
  }
});

/** A boat's starboard battery fired by a quick click (`holdS` of lay before the release) - each gun's x and its
 *  shutter's turn on the frame its own ball leaves (my shots shake my deck once a ball: the k-th shake is gun k's).
 *  PIN MOVED (AUDIT GALLEON-2 PF1): a frame in world.js's order - csaUpdate (Come Sail Away's animate: my boats'
 *  Animators) and then navalFrame; the host ran first here, an order the game never runs, and a Play left for the
 *  Animators' next update passed. */
function quickClick(h, holdS) {
  const nodes = nodesOf(h.boat);
  const anims = animatorsOf(h.boat);
  const frame = (dt) => { for (const a of anims) a.update(dt); h.host.frame(dt); };
  frame(0.1); frame(0.1);
  h.view.look = { origin: [0, 5, 0], dir: [1, -0.05, 0] };
  h.host.attackInput(true);
  for (let t = 0; t < holdS; t += 0.02) frame(0.02);
  h.host.attackInput(false);
  const atShot = [];
  let shakes = h.log.shake.length;
  for (let k = 0; k < 120 && atShot.length < 5; k++) {
    frame(0.02);
    const r = h.host.gunDeckOf(h.boat);
    for (; shakes < h.log.shake.length; shakes++) {
      const i = atShot.length;
      atShot.push({ x: r.starboard.guns[i], lid: lidAngle(nodes.find((n) => n.name === `GunportStarboard${i}`)) });
    }
  }
  return atShot;
}

test('AUDIT GALLEON G2: a quick click - the release with no lay before it - fires every ball from a gun run out through an open shutter: each gun stands out and its shutter up on the frame its ball leaves (balls burst out of shut ports from guns 0.7-1.0 m inside them)', async () => {
  const h = await sea({ hull: HULL.SmallShip });
  const atShot = quickClick(h, 0);
  assert.equal(atShot.length, 5, 'five balls');
  atShot.forEach(({ x, lid }, i) => {
    assert.ok(x >= RUN_OUT_X - 0.2, `gun ${i} out as its ball left (${x.toFixed(3)}, run out ${RUN_OUT_X})`);
    assert.ok(Math.abs(lid - LID_OPEN_DEG) < 1.5, `shutter ${i} up as its ball left (${lid.toFixed(1)})`);
  });
});

/** Two players: A at her armed helm, B with A's galleon built in B's own pool (as Come Sail Away's peers build one). */
async function pair() {
  const poolB = await freshPool();
  const aOnB = poolB.spawnNow(Object.assign(new Boat(HULL.SmallShip, 0), { uid: 7 }), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
  const A = await sea({ hull: HULL.SmallShip, pool: await freshPool(), online: { id: () => 'a', peers: () => [{ id: 'b', feet: [30, 0, 0] }], sendHit: () => true } });
  const B = await sea({ hull: null, pool: poolB, online: { id: () => 'b', peers: () => [{ id: 'a', feet: [0, 0, 0] }], sendHit: () => true },
    peerBoats: () => [{ id: 'a', pos: [0, 0, 0], vel: [0, 0, 0], speed: 0, hull: HULL.SmallShip, yaw: 0, boat: aOnB }] });
  B.view.feet = [30, 0, 0];
  const animsB = animatorsOf(aOnB), animsA = animatorsOf(A.boat);
  /** A frame of both; A's word handed to B (older: without `g`, as an older build says it). PIN MOVED (AUDIT
   *  GALLEON-2 PF1): in world.js's order - each world's Animators (csaUpdate: animate, csaPeers.frame), then its sea */
  const tick = ({ send = true, older = false } = {}) => {
    for (const a of animsA) a.update(1 / 30);
    A.host.frame(1 / 30);
    for (const a of animsB) a.update(1 / 30);
    B.host.frame(1 / 30);
    if (!send) return;
    const w = A.host.word((p) => p);
    if (!w) return;
    const said = older ? (({ g, ...rest }) => rest)(w) : w;
    B.host.applyWord('a', JSON.parse(JSON.stringify(said)), (p) => p);
  };
  return { A, B, aOnB, tick, lid: (i) => nodesOf(aOnB).find((n) => n.name === `GunportStarboard${i}`) };
}

test('AUDIT GALLEON G3: my laid broadside rides my word as `g` (a bit a side, as a ship\'s runOut) and another player\'s galleon is laid from hers on my screen; and her volley read from a word with no lay (an older build\'s) still leaves through open ports, each gun out as its ball leaves (her five balls burst from shut ports on every other screen)', async () => {
  // the word: the bits; a reader takes them; a bad `g` fails the word whole; nothing laid says no `g`
  const rec = navalWireRecord({ me: { hull: 1, crippled: false, boarders: true }, laid: ['starboard'] });
  assert.equal(rec.g, 1, 'starboard laid: bit 0');
  assert.deepEqual(validNavalRecord(rec).laid, ['starboard']);
  assert.equal(validNavalRecord({ ...rec, g: 99 }), null, 'a malformed lay fails the word whole');
  assert.equal(navalWireRecord({ me: { hull: 1, crippled: false, boarders: true } }).g, undefined, 'nothing laid: no `g`');
  assert.deepEqual(validNavalRecord({ p: [100, 0, 1] }).laid, [], 'an older word: nothing laid');
  // her lay on my screen
  {
    const { A, B, aOnB, tick, lid } = await pair();
    for (let i = 0; i < 10; i++) tick();
    A.view.look = { origin: [0, 5, 0], dir: [1, -0.05, 0] };
    A.host.attackInput(true);
    for (let i = 0; i < 45; i++) tick();
    assert.equal(A.host.word((p) => p).g, 1, 'my word says my starboard battery laid');
    const r = B.host.gunDeckOf(aOnB);
    assert.ok(r.starboard.laid && r.starboard.guns.every((x) => Math.abs(x - RUN_OUT_X) < 1e-6), `her guns run out on my screen before she fires (${r.starboard.guns.map((x) => x.toFixed(2))})`);
    assert.ok([0, 1, 2, 3, 4].every((i) => Math.abs(lidAngle(lid(i)) - LID_OPEN_DEG) < 1.5), 'her shutters up on my screen');
    A.host.attackInput(false);
  }
  // her word gone quiet (PEER_LAY_S without one): her last lay is not held for ever - her shutters come down, her guns in
  {
    const { A, B, aOnB, tick, lid } = await pair();
    for (let i = 0; i < 10; i++) tick();
    A.view.look = { origin: [0, 5, 0], dir: [1, -0.05, 0] };
    A.host.attackInput(true);
    for (let i = 0; i < 45; i++) tick();
    assert.ok(B.host.gunDeckOf(aOnB).starboard.laid, 'laid from her word');
    for (let i = 0; i < 30 * (PEER_LAY_S + HOLD_S + 2.5); i++) tick({ send: false });
    const r = B.host.gunDeckOf(aOnB);
    assert.ok(!r.starboard.laid && r.starboard.guns.every((x) => x < RUN_IN_X + 1e-6), `no word from her: her guns in on my screen (${r.starboard.guns.map((x) => x.toFixed(2))})`);
    assert.ok([0, 1, 2, 3, 4].every((i) => lidAngle(lid(i)) < 1), 'and her shutters down');
    A.host.attackInput(false);
  }
  // an older build's word: no lay said - her guns stand in until her balls leave, then each is out as its own goes
  {
    const { A, B, aOnB, tick, lid } = await pair();
    for (let i = 0; i < 10; i++) tick({ older: true });
    A.view.look = { origin: [0, 5, 0], dir: [1, -0.05, 0] };
    A.host.attackInput(true);
    for (let i = 0; i < 45; i++) tick({ older: true });
    assert.ok(B.host.gunDeckOf(aOnB).starboard.guns.every((x) => x < RUN_IN_X + 1e-6), 'no lay said: her guns in on my screen');
    A.host.attackInput(false);
    const atShot = [];
    let heard = B.log.sounds.filter((x) => x[0] === 'naval:cannon').length;
    for (let i = 0; i < 90 && atShot.length < 5; i++) {
      tick({ older: true });
      const n = B.log.sounds.filter((x) => x[0] === 'naval:cannon').length;
      const r = B.host.gunDeckOf(aOnB);
      for (; heard < n; heard++) { const k = atShot.length; atShot.push({ x: r.starboard.guns[k], lid: lidAngle(lid(k)) }); }
    }
    assert.equal(atShot.length, 5, 'her five reports heard');
    atShot.forEach(({ x, lid: a }, k) => {
      assert.ok(x >= RUN_OUT_X - 0.2, `her gun ${k} out as its ball left on my screen (${x.toFixed(3)})`);
      assert.ok(Math.abs(a - LID_OPEN_DEG) < 1.5, `her shutter ${k} up as its ball left (${a.toFixed(1)})`);
    });
  }
});

test('AUDIT GALLEON G4: hull 2 fallen back to the mod\'s own galleon (her model would not load) answers the mod\'s own Small Ship build - six guns at its own ports, its box, deck and rig - and the new galleon\'s build again once she stands (the old ship fired from 0.24-1.29 m inside her own planking)', async () => {
  try {
    const failing = async (url) => {
      if (String(url).includes('galleon.json')) return { ok: false, status: 404, json: async () => null, arrayBuffer: async () => null };
      const { readFileSync: r } = await import('node:fs');
      const { fileURLToPath } = await import('node:url');
      const bytes = r(fileURLToPath(url));
      return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
    };
    const renderer = { createMesh: (m) => ({ model: m, buffers: [{}, {}], bounds: [0, 0, 0, 0], subMeshes: m.subMeshes.map((s) => ({ ...s, _bounds: [0, 0, 0, 0] })) }), drawMesh() {}, updateMeshVertices() {}, createBillboardBatch: () => ({}), destroyBillboardBatch() {}, destroyMesh() {} };
    const pipeline = { getTexture: async () => ({ recordCount: 100, getSize: () => ({ width: 40, height: 64 }), getScale: () => ({ width: 0, height: 0 }) }), uploadRecord() {}, getGpuMesh: async (id) => ({ classic: id }) };
    const pool = createComeSailAwayPool({ renderer, pipeline, fetchFn: failing, log: { warn() {} } });
    assert.equal(await pool.preload(), true);
    assert.equal(pool.models.galleon, false, 'her model missing: hull 2 is the mod\'s own galleon');
    const b = ships.hullBuild(HULL.SmallShip);
    assert.ok(ships.MOD_SMALL_SHIP_BUILD && b === ships.MOD_SMALL_SHIP_BUILD, 'and her numbers are the mod galleon\'s');
    assert.equal(b.broadside.length, 6);
    assert.deepEqual([b.bowZ, b.aftZ, b.halfWidth, b.keel, b.top, b.deck, b.beam], [19.88, -24.25, 8.43, -3.35, 10.92, 3.64, 7.4]);
  } finally {
    ships.setGalleonStanding?.(true);
  }
  const b = ships.hullBuild(HULL.SmallShip);
  assert.notEqual(b, ships.MOD_SMALL_SHIP_BUILD);
  assert.equal(b.broadside.length, 5, 'standing again: hers');
});

test('AUDIT GALLEON G5: each ball of her broadside leaves through its own port as she heels - its start placed through her hull as she lies, not her upright root (at 8 deg of roll the start stood 0.89 m off the port, under its sill on the high side)', async () => {
  for (const rollDeg of [8, -8]) {
    const h = await sea({ hull: HULL.SmallShip });   // a fresh sea each: the battery that fired is reloading
    const anims = animatorsOf(h.boat);
    const frame = (dt) => { h.host.frame(dt); for (const an of anims) an.update(dt); };
    const a = (rollDeg * Math.PI) / 360;
    const lay = () => { h.boat.MeshObject.localRotation = [0, 0, Math.sin(a), Math.cos(a)]; };
    lay(); frame(0.1); lay();
    h.view.look = { origin: [0, 5, 0], dir: [1, -0.05, 0] };
    h.host.attackInput(true);
    for (let t = 0; t < 1.5; t += 0.05) { lay(); frame(0.05); }
    h.host.attackInput(false);
    const starts = [];
    for (let k = 0; k < 60; k++) {
      lay(); frame(0.02);
      for (const l of h.host.lights()) if (l.carried && !starts.some((s) => Math.hypot(s[0] - l.x, s[1] - l.y, s[2] - l.z) < 0.05)) starts.push([l.x, l.y, l.z]);
    }
    assert.ok(starts.length >= 5, `her five starts seen at ${rollDeg} deg (${starts.length})`);
    const m = h.boat.MeshObject.worldMatrix();
    for (const w of starts.slice(0, 5)) {
      const d = [w[0] - m[12], w[1] - m[13], w[2] - m[14]];
      const p = [m[0] * d[0] + m[1] * d[1] + m[2] * d[2], m[4] * d[0] + m[5] * d[1] + m[6] * d[2], m[8] * d[0] + m[9] * d[1] + m[10] * d[2]];
      const lp = h.boat.MeshObject.localPosition ?? [0, 0, 0];
      const y = p[1] + lp[1];
      assert.ok(y > MEASURED.portSillY && y < MEASURED.portTopY, `at ${rollDeg} deg a ball left at ${y.toFixed(2)} in her frame - inside its port (${MEASURED.portSillY}..${MEASURED.portTopY})`);
    }
  }
});

test('AUDIT GALLEON G5: a captain\'s ball leaves her port as she sails, in a fast sea\'s long frame (0.5 s) - her heel stood on her as she fires, not through her hull as it was drawn the frame before (the fix\'s first cut: a ball 2.26 m aft of its port; the cutter\'s duels with the sloop went six to two against the odds)', async () => {
  const h = await sea({ hull: null, seed: 5 });
  h.deps.csa = () => ({ state: { windVectorCurrent: [0.6, 0, 0.8], AllBoats: [] }, isSailing: () => false });
  const A = h.host._sea.get(h.host.spawnShip('navyCutter', { range: 100, bearing: 0 }));
  const B = h.host._sea.get(h.host.spawnShip('pirateBrig', { range: 200, bearing: 0, temper: 'bold' }));
  A.ship.pos = [-130, 0, 700]; B.ship.pos = [130, 0, 700];
  A.ship.yaw = Math.PI / 2 - 0.5; B.ship.yaw = 1.5 * Math.PI + 0.4;
  // AUDIT GALLEON-2 TS3: each heeled 8 deg (her own heel in this duel stood under 3.7 deg - 0.38 m at a muzzle, inside
  // the plan's 0.6 m slack, so a captain's balls from her upright root passed): her hull laid over before each frame,
  // as the frame's captain fires through it (her pose after it lays her again)
  const ROLL = new Map([[A, 8], [B, -8]]);
  const lay = () => { for (const [e, deg] of ROLL) if (e.boat?.MeshObject) e.boat.MeshObject.localRotation = [0, 0, Math.sin((deg * Math.PI) / 360), Math.cos((deg * Math.PI) / 360)]; };
  /** A muzzle (the root's frame) through her hull as it lies: her MeshObject's turn about its own place. */
  const heeledAt = (boat, m) => {
    const lp = boat.MeshObject.localPosition;
    const h = quatRotate(boat.MeshObject.localRotation, [m[0] - lp[0], m[1] - lp[1], m[2] - lp[2]]);
    return [h[0] + lp[0], h[1] + lp[1], h[2] + lp[2]];
  };
  const off = [], rise = [], tilt = [];
  const play = h.deps.audio.play3d;
  h.deps.audio.play3d = (k, p, v, o) => {
    // each report in the root's frame of the ship that fired it, as she fires it: off the nearest of her heeled muzzles
    // in plan (a ripple step's way along her course), and at its height through her heel (none of her way's)
    if (k === 'naval:cannon') for (const { ship: sh, boat } of [A, B]) {
      if (!boat?.MeshObject) continue;
      const c = Math.cos(sh.yaw), sn = Math.sin(sh.yaw), dx = p[0] - sh.pos[0], dz = p[2] - sh.pos[2];
      const x = c * dx - sn * dz, z = sn * dx + c * dz, y = p[1] - boat.GameObject.position[1];
      let best = null;
      for (const g of ships.batteriesOf(sh.hull).flatMap((b) => b.muzzles)) {
        const w = heeledAt(boat, g), e = Math.hypot(x - w[0], z - w[2]);
        if (!best || e < best.e) best = { e, dy: Math.abs(y - w[1]), lean: Math.abs(w[1] - g[1]) };
      }
      if (best.e < 6) { off.push(best.e); rise.push(best.dy); tilt.push(best.lean); }
    }
    return play(k, p, v, o);
  };
  for (let t = 0; t < 120 && off.length < 30; t += 0.5) {
    lay();
    h.host.frame(0.5);
    h.view.feet = [(A.ship.pos[0] + B.ship.pos[0]) / 2, 0, (A.ship.pos[2] + B.ship.pos[2]) / 2];
  }
  assert.ok(off.length >= 20, `their reports heard (${off.length})`);
  assert.ok(Math.min(...tilt) > 0.5, `her heel lifts or drops every muzzle more than the heights' slack (least ${Math.min(...tilt).toFixed(2)} m)`);
  assert.ok(Math.max(...off) < 0.6, `every ball off its heeled muzzle by no more than a ripple step's way (worst ${Math.max(...off).toFixed(2)} m)`);
  assert.ok(Math.max(...rise) < 0.05, `every ball at its heeled muzzle's height (worst ${Math.max(...rise).toFixed(3)} m)`);
});

test('AUDIT GALLEON G5: another player\'s volley, flown here from her word, leaves her ports as this screen draws her heeled - placed through her hull as drawn here, not her upright root', async () => {
  for (const rollDeg of [8, -8]) {
    const { A, B, aOnB, tick } = await pair();
    const a = (rollDeg * Math.PI) / 360;
    const lay = () => { aOnB.MeshObject.localRotation = [0, 0, Math.sin(a), Math.cos(a)]; };
    for (let i = 0; i < 10; i++) { lay(); tick(); }
    A.view.look = { origin: [0, 5, 0], dir: [1, -0.05, 0] };
    A.host.attackInput(true);
    for (let i = 0; i < 45; i++) { lay(); tick(); }
    A.host.attackInput(false);
    const starts = [];
    for (let i = 0; i < 90 && starts.length < 5; i++) {
      lay(); tick();
      for (const l of B.host.lights()) if (l.carried && !starts.some((s) => Math.hypot(s[0] - l.x, s[1] - l.y, s[2] - l.z) < 0.05)) starts.push([l.x, l.y, l.z]);
    }
    assert.equal(starts.length, 5, `her five starts seen here at ${rollDeg} deg`);
    const m = aOnB.MeshObject.worldMatrix(), lp = aOnB.MeshObject.localPosition;
    for (const w of starts) {
      const d = [w[0] - m[12], w[1] - m[13], w[2] - m[14]];
      const y = m[4] * d[0] + m[5] * d[1] + m[6] * d[2] + lp[1];
      assert.ok(y > MEASURED.portSillY && y < MEASURED.portTopY, `at ${rollDeg} deg her ball left at ${y.toFixed(2)} in her frame here - inside its port (${MEASURED.portSillY}..${MEASURED.portTopY})`);
    }
  }
});

test('AUDIT GALLEON G6: her draft in the routing table (shipLife.js draftOf, world.js navalIsWater\'s - AUDIT GN2-PF6: the table moved there, hull 2\'s read off her keel) is no shallower than her keel - a ship drawing 4.64 m was sailed over a 2.2 m floor', () => {
  const draft = draftOf(HULL.SmallShip);
  assert.ok(draft >= -ships.hullBuild(HULL.SmallShip).keel, `hull 2's ${draft} m against her keel ${ships.hullBuild(HULL.SmallShip).keel}`);
});

test('AUDIT GALLEON G7: a long frame (a fast sea: Come Sail Away\'s time scale, 0.5 s a frame) runs her guns out as far as its time does - the gun deck no longer clamps a step to 0.25 s (the volley came three frames after the run-out with the guns 0.35 m short of the port)', () => {
  const s = scene();
  const boat = s.place(HULL.SmallShip, 0);
  const deck = createGalleonGunDeck();
  deck.step([boat], 0);
  deck.lay(boat, 'starboard', 0);
  deck.step([boat], 1.5);
  const r = deck.read(boat, 1.5);
  assert.ok(r.starboard.guns.every((x) => Math.abs(x - RUN_OUT_X) < 1e-9), `run out in one 1.5 s step (${r.starboard.guns.map((x) => x.toFixed(2))})`);
});

test('AUDIT GALLEON G8: my look lays no battery that is reloading - its guns stay in to load (they stood run out through a 9 s reload, against the gun deck\'s own law)', async () => {
  const h = await sea({ hull: HULL.SmallShip });
  h.view.look = { origin: [0, 5, 0], dir: [1, -0.05, 0] };
  h.host.attackInput(true);
  h.run(1.5);
  h.host.attackInput(false);
  h.run(3.5);   // fired, held HOLD_S, run in
  h.host.attackInput(true);
  h.run(1.5);   // aiming again while the starboard battery reloads
  const r = h.host.gunDeckOf(h.boat);
  assert.ok(!r.starboard.laid && r.starboard.guns.every((x) => x < RUN_IN_X + 0.05), `reloading: not laid, guns in (${r.starboard.guns.map((x) => x.toFixed(2))})`);
  h.host.attackInput(false);
});

test('AUDIT GALLEON G2/G3: a gun fired before it is out is stood out at its shot, and its shutter snapped open (the gun deck\'s own law, whoever fired it)', () => {
  const s = scene();
  const boat = s.place(HULL.SmallShip, 0);
  const deck = createGalleonGunDeck();
  deck.step([boat], 0);
  deck.fired(boat, 'port', 2, 0.01);
  deck.step([boat], 0.01);
  const r = deck.read(boat, 0.01);
  near(r.port.guns[2], RUN_OUT_X, 1e-6, 'port gun 2 out at its shot');
  assert.ok(r.port.open[2], 'its shutter opened');
  assert.ok(r.port.guns.every((x, i) => i === 2 || x < RUN_IN_X + 0.05), 'the rest of the side only starting out (the side is laid)');
  assert.ok(KICK_S > 0);
});
