// CSA-J (2026-09-28) - COME SAIL AWAY ONLINE: a player's boats as the others in a cell see them - the `sa` word on
// the owner's foes frame (systems/comeSailAway/comeSailAwayWire.js), a peer's boats in the pool's PEER list
// (scenes/comeSailAway/comeSailAwayPeers.js, scenes/comeSailAway/comeSailAwayPool.js), and the host's four doors (world.js, exteriorFoes.js).
// The pool runs over the vendored models and a stand-in renderer and pipeline (test/systems/comeSailAway/csa_pool.test.js's).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createComeSailAwayPool } from '../../../src/scenes/comeSailAway/comeSailAwayPool.js';
import { createComeSailAwayPeers } from '../../../src/scenes/comeSailAway/comeSailAwayPeers.js';
import { csaWireRecord, validCsaRecord, csaRecordKey, CSA_WIRE_BOATS_MAX } from '../../../src/systems/comeSailAway/comeSailAwayWire.js';
import { animatorOf } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { POSE_BOUND } from '../../../src/net/wire.js';

const fileFetch = async (url) => {
  const bytes = readFileSync(fileURLToPath(url));
  return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
};
const settle = () => new Promise((r) => setTimeout(r, 0));

function recordingRenderer() {
  const r = { created: [], drawn: [], updated: [], batches: [], destroyed: [] };
  r.createMesh = (model) => { const m = { model, buffers: [{}, {}], bounds: [0, 0, 0, 0], subMeshes: model.subMeshes.map((s) => ({ ...s, _bounds: [0, 0, 0, 0] })) }; r.created.push(m); return m; };
  r.drawMesh = (mesh, matrix) => r.drawn.push({ mesh, matrix });
  r.updateMeshVertices = (mesh, p, n) => r.updated.push({ mesh, p: p.slice(), n: n.slice() });
  r.createBillboardBatch = (archive, record, size, centers, opts) => { const b = { archive, record, size, centers, opts }; r.batches.push(b); return b; };
  r.destroyBillboardBatch = (b) => r.destroyed.push(b);
  r.destroyMesh = (m) => r.destroyed.push(m);
  return r;
}
function standInPipeline() {
  const uploads = [];
  const texture = (archive) => ({ recordCount: 100, getSize: () => ({ width: 40, height: 64 }), getScale: () => ({ width: 0, height: 0 }), archive: undefined, _a: archive });
  const textureFiles = new Map();
  const cpuModels = new Map(), gpuMeshes = new Map();
  return {
    uploads, textureFiles, cpuModels, gpuMeshes,
    getTexture: async (a) => { if (!textureFiles.has(a)) textureFiles.set(a, texture(a)); return textureFiles.get(a); },
    uploadRecord: (a, r, o) => uploads.push([a, r, !!o?.opaque]),
    getGpuMesh: async (id) => { cpuModels.set(id, { positions: new Float32Array([-1, 0, -2, 1, 1.5, 2]) }); const g = { classic: id }; gpuMeshes.set(id, g); return g; },
  };
}

const src = (p) => readFileSync(new URL(`../../../src/${p}`, import.meta.url), 'utf8');
const Q = [0, Math.sin(0.25), 0, Math.cos(0.25)];
const word = (over = {}) => [over.hull ?? 1, over.variant ?? 0, over.x ?? 10, over.y ?? 34, over.z ?? 20, ...(over.q ?? Q), over.sails ?? 0, over.helm ?? 0, over.light ?? 0];

// ── the word ─────────────────────────────────────────────────────────────────────

test('CSA-J: my word - each boat as it stands: hull, variant, its root in the wire frame (centimetres), its turn (four places), the raised sails\' bits, the helm and the lanterns; at most eight; none, null', () => {
  const toWire = (p) => [p[0] + 1000, p[1] - 5, p[2] + 2000];
  const rec = csaWireRecord([{ hull: 2, variant: 3, position: [1.234567, 40, -2.5], rotation: [0, 0.123456789, 0, 0.99235], sails: 5, helm: true, light: false }], toWire);
  assert.deepEqual(rec, { b: [[2, 3, 1001.23, 35, 1997.5, 0, 0.1235, 0, 0.9924, 5, 1, 0]] });
  assert.equal(csaWireRecord([], toWire), null);
  assert.equal(csaWireRecord(null), null);
  const many = Array.from({ length: 11 }, (_, i) => ({ hull: 0, variant: 0, position: [i, 0, 0], rotation: [0, 0, 0, 1], sails: 0 }));
  assert.equal(csaWireRecord(many).b.length, CSA_WIRE_BOATS_MAX, 'eight at most');
  assert.equal(csaWireRecord([{ hull: 7, variant: 0, position: [0, 0, 0], rotation: [0, 0, 0, 1] }]), null, 'no such hull: not said');
  assert.equal(csaRecordKey(null), '');
  assert.notEqual(csaRecordKey(rec), csaRecordKey(csaWireRecord([{ hull: 2, variant: 3, position: [1.3, 40, -2.5], rotation: [0, 0.123456789, 0, 0.99235], sails: 5, helm: true }], toWire)), 'a moved boat is a new word');
});

test('CSA-J: a peer\'s word through the door - the shape, a known hull and variant, the bounds, a unit quaternion (normalized), the bits and two flags; anything else drops the record whole', () => {
  const ok = validCsaRecord({ b: [word({ q: [0, 0, 0, 1.5], sails: 3, helm: 1, light: 1 })] });
  assert.deepEqual(ok, { boats: [{ hull: 1, variant: 0, position: [10, 34, 20], rotation: [0, 0, 0, 1], sails: 3, helm: true, light: true }] });
  for (const [bad, why] of [
    [null, 'nothing'], [[], 'an array'], [{}, 'no boats'], [{ b: [] }, 'an empty list'],
    [{ b: Array.from({ length: 9 }, () => word()) }, 'nine boats'],
    [{ b: [word().slice(0, 11)] }, 'eleven fields'], [{ b: [[...word(), 0]] }, 'thirteen'],
    [{ b: [word({ hull: 5 })] }, 'a hull past the Carrack'], [{ b: [word({ hull: 1.5 })] }, 'a fractional hull'],
    [{ b: [word({ variant: 10 })] }, 'a variant past X'], [{ b: [word({ variant: -1 })] }, 'a negative variant'],
    [{ b: [word({ x: POSE_BOUND + 1 })] }, 'past the world'], [{ b: [word({ q: [0, 0, 0, 0] })] }, 'no turn'],
    [{ b: [word({ q: [0, 0, 0, 3] })] }, 'no unit quaternion near enough'],
    [{ b: [word({ sails: -1 })] }, 'negative bits'], [{ b: [word({ sails: 1 << 16 })] }, 'past sixteen sails'],
    [{ b: [word({ helm: 2 })] }, 'a helm that is not a bit'], [{ b: [word({ light: 0.5 })] }, 'a lantern that is not a bit'],
    [{ b: [word({ x: NaN })] }, 'NaN'], [{ b: [word(), 'x'] }, 'one bad boat drops them all'],
  ]) assert.equal(validCsaRecord(bad), null, why);
});

// ── a peer's boats ───────────────────────────────────────────────────────────────

async function readyPool() {
  const pool = createComeSailAwayPool({ renderer: recordingRenderer(), pipeline: standInPipeline(), fetchFn: fileFetch, log: { warn() {} } });
  assert.equal(await pool.preload(), true);
  return pool;
}

test('CSA-J: a peer\'s boats stand in the pool\'s PEER list - built as SpawnBoat builds one, posed off the word converted each frame, never in `boats` (the host\'s colliders, rays and activations read that); sails, crew and lanterns as the word says; drawn with mine', async () => {
  const pool = await readyPool();
  const peers = createComeSailAwayPeers({ pool, selfId: () => 'me' });
  const toScene = (p) => [p[0] - 5, p[1], p[2] - 7];
  assert.equal(peers.applyOwner('ann', { b: [word({ hull: 1, variant: 2, sails: 0b11, helm: 1, light: 1 })] }, toScene, 1000), true);
  assert.equal(pool.peerBoats.length, 0, 'AUDIT PRE-MERGE 0928 O3: the handler keeps the word - the frame builds');
  peers.frame(0.1);
  assert.equal(pool.boats.length, 0, 'not one of MY boats');
  assert.equal(pool.peerBoats.length, 1);
  const boat = pool.peerBoats[0];
  assert.deepEqual([boat.hull, boat.variant], [1, 2]);
  assert.deepEqual(boat.GameObject.position.map((v) => +v.toFixed(6)), [5, 34, 13], 'the first frame stands it on its word');
  assert.ok(boat.Sails.length >= 2, 'the Large Boat has sails');
  assert.deepEqual(boat.Sails.map((s) => animatorOf(s)?.GetBool('Stowed')), boat.Sails.map((s, k) => !(k < 2)), 'the two bits raised the first two');
  assert.equal(boat.IdleObject.activeSelf, false, 'its owner at the helm: the idle crew away');
  assert.equal(boat.ActiveObject.activeSelf, true);
  assert.equal(boat.LightOn, true, 'the lanterns lit');
  pool.draw();   // the first frame asks for the meshes
  for (let i = 0; i < 5; i++) await settle();
  assert.ok(pool.draw() > 0, 'drawn with mine - and it is the only boat there is');
  assert.equal(peers.shown()[0].owner, 'ann');
  // a word five metres on eases; one thirty metres on snaps (a crossing, a teleport)
  peers.applyOwner('ann', { b: [word({ hull: 1, variant: 2, x: 15, sails: 0b11, helm: 1, light: 1 })] }, toScene, 1200);
  assert.ok(pool.peerBoats[0] === boat, 'the same boat kept - the same hull and variant at the same place');
  peers.frame(0.05);
  const x = boat.GameObject.position[0];
  assert.ok(x > 5 && x < 10, `eased toward 10, not snapped (${x})`);
  peers.applyOwner('ann', { b: [word({ hull: 1, variant: 2, x: 60, sails: 0, helm: 0, light: 0 })] }, toScene, 1400);
  peers.frame(0.05);
  assert.equal(+boat.GameObject.position[0].toFixed(6), 55, 'past twenty metres: snapped');
  assert.ok(boat.Sails.every((s) => animatorOf(s)?.GetBool('Stowed') !== false), 'the bits gone: every sail stowed again');
  assert.equal(boat.IdleObject.activeSelf, true, 'the helm left: the idle crew back');
  assert.equal(boat.LightOn, false);
  // the owner's SetBoatVariant: the same boat, its variant object switched
  peers.applyOwner('ann', { b: [word({ hull: 1, variant: 4, x: 60 })] }, toScene, 1500);
  peers.frame(0.05);
  assert.ok(pool.peerBoats[0] === boat, 'the same instance');
  assert.equal(boat.variant, 4);
  if (boat.VariantObject) assert.deepEqual(boat.VariantObject.children.map((c) => c.activeSelf), boat.VariantObject.children.map((c, i) => i === 4), 'variant 4 alone shown');
  // a different boat at that place in the list: the old one goes, another is built
  peers.applyOwner('ann', { b: [word({ hull: 0, variant: 0 })] }, toScene, 1600);
  peers.frame(0.05);
  assert.equal(pool.peerBoats.length, 1);
  assert.ok(pool.peerBoats[0] !== boat && pool.peerBoats[0].hull === 0, 'a Rowboat now');
  // two owners, and the owner law
  peers.applyOwner('bob', { b: [word({ hull: 3 }), word({ hull: 4, x: 100 })] }, toScene, 1600);
  peers.frame(0.05);
  assert.equal(pool.peerBoats.length, 2, 'AUDIT PRE-MERGE 0928 O3: one build a frame');
  peers.frame(0.05);
  assert.equal(pool.peerBoats.length, 3);
  assert.equal(peers.applyOwner('me', { b: [word()] }, toScene, 1600), false, 'my own word is never a peer\'s');
  assert.equal(peers.applyOwner('bob', { b: [word({ hull: 9 })] }, toScene, 1700), false, 'an invalid word drops bob\'s');
  assert.equal(pool.peerBoats.length, 1);
  assert.equal(peers.applyOwner('ann', null, toScene, 1700), true, 'null: none of ann\'s stand');
  assert.equal(pool.peerBoats.length, 0);
});

test('CSA-J: the owner law - gone from the room or quiet past the stale time, a peer\'s boats go; a clear (a transition, a fast travel, a room change) takes everyone\'s; the mod off stands nothing and takes nothing; the origin\'s shift moves the eased places', async () => {
  const pool = await readyPool();
  const peers = createComeSailAwayPeers({ pool, selfId: () => 'me' });
  peers.applyOwner('ann', { b: [word()] }, (p) => p, 1000);
  peers.applyOwner('bob', { b: [word({ hull: 0 })] }, (p) => p, 5000);
  peers.frame(0.1); peers.frame(0.1);   // AUDIT PRE-MERGE 0928 O3: one build a frame
  peers.sweepOwners(new Set(['ann', 'bob']), 6000, 6000);
  assert.equal(pool.peerBoats.length, 2, 'both in the room, neither quiet past six seconds');
  peers.sweepOwners(new Set(['ann', 'bob']), 7001, 6000);
  assert.deepEqual(peers.shown().map((o) => o.owner), ['bob'], 'ann quiet past the stale time');
  peers.rebase([100, 0, -50]);
  assert.deepEqual(peers.shown()[0].boats[0].position, [110, 34, -30], 'the eased place moved with the world');
  peers.sweepOwners(new Set([]), 7002, 6000);
  assert.equal(pool.peerBoats.length, 0, 'bob gone from the room');
  peers.applyOwner('ann', { b: [word()] }, (p) => p, 8000);
  peers.clearPeers();
  assert.equal(pool.peerBoats.length, 0);
  peers.applyOwner('bob', { b: [word()] }, (p) => p, 8500);
  peers.frame(0.1);
  assert.equal(pool.peerBoats.length, 1);
  peers.setEnabled(false);
  assert.equal(pool.peerBoats.length, 0, 'the switch off takes what stood');
  assert.equal(peers.applyOwner('ann', { b: [word()] }, (p) => p, 9000), false, 'the mod off: nothing of a peer\'s stands');
  assert.equal(pool.peerBoats.length, 0);
  peers.setEnabled(true);
  assert.equal(peers.applyOwner('ann', { b: [word()] }, (p) => p, 9000), true);
  peers.frame(0.1);
  pool.destroyAll();
  assert.equal(pool.peerBoats.length, 0, 'the pool\'s teardown takes the peers\' boats too');
});

test('CSA-J: before the models are in, a word stands nothing - and the first frame after, it stands', async () => {
  const pool = createComeSailAwayPool({ renderer: recordingRenderer(), pipeline: standInPipeline(), fetchFn: fileFetch, log: { warn() {} } });
  const peers = createComeSailAwayPeers({ pool, selfId: () => 'me' });
  assert.equal(peers.applyOwner('ann', { b: [word()] }, (p) => p, 0), true);
  assert.equal(pool.peerBoats.length, 0, 'not ready: nothing built');
  await pool.ensureModels();
  peers.frame(0.1);
  assert.equal(pool.peerBoats.length, 0, 'the models in but the hulls\' needs not loaded (the pool not ready): still nothing');
  peers.frame(0.1);
  assert.equal(pool.peerBoats.length, 0);
  await pool.preload();
  peers.frame(0.1);
  assert.equal(pool.peerBoats.length, 1, 'the models in: the next frame builds it');
});

test('CSA-J: the hosts - the foes frame carries my word beside the team\'s, the receiver lands a peer\'s past the room test, the sweep and the clear take theirs with the puppets, and the origin\'s shift and the pool\'s frame reach the peers', () => {
  const w = src('scenes/world.js');
  assert.match(w, /frame\.hv = hcc\.wireRecord\(campToWire\); _hccDirty = false; \} if \(cell\) duelRingWord\(frame, full\); if \(cell\) csaWord\(frame, full\);/);
  assert.match(w, /function csaWord\(frame, full\) \{\n\s+if \(!csaRuntime \|\| !csaOn\(\)\) \{ if \(!_csaWordKey\) return false; if \(frame\) \{ frame\.sa = null; _csaWordKey = ''; \} return true; \}/);
  assert.match(w, /const rec = csaWireRecord\(view, campToWire\);\n\s+if \(rec && modes\?\.sailingCabin\) rec\.cabin = 1;\n\s+const key = csaRecordKey\(rec\);\n\s+if \(!full && key === _csaWordKey\) return false;\n\s+if \(frame\) \{ frame\.sa = rec; _csaWordKey = key; \}\n\s+return true;/);
  // AUDIT PRE-MERGE 0928 O2: the moved word asks for the frame it rides (test/scenes/audit0928_online.test.js drives it)
  // NAV-G: the sea's word rides beside the boats' by the same law - a changed word asks for the frame it rides (OW6: a raider's beside it)
  assert.match(w, /const csaMoved = cell && csaWord\(null, full\);[^\n]*\n\s+const csaAboardMoved = cell && csaAboardWord\(null, full\);[^\n]*\n(\s+const bandMoved = [^\n]*\n)?\s+const navalMoved = cell && navalWord\(null, full\);[^\n]*\n(\s+const seaRaidMoved = cell && seaRaidWord\(null, full\);[^\n]*\n)?\s+const frame = cell \? \(\(modes\?\.mode \?\? 'exterior'\) === 'exterior' \? exteriorFoes\.foesFrame\(full, _hccDirty \|\| csaMoved \|\| csaAboardMoved( \|\| bandMoved)? \|\| navalMoved( \|\| seaRaidMoved)?\) : null\)/);
  assert.match(w, /exteriorFoes\.setOnCsa\(\(from, sa, at\) => csaPeers\.applyOwner\(from, sa, campToScene, at\), \(\) => csaPeers\.clearPeers\(\)\);/);
  assert.match(w, /if \(ids\) hcc\.sweepOwners\(ids, now, FOES_STALE_MS\); \}[^\n]*\n\s+if \(isCellRoom\(online\.room\)\) \{ const ids = ownerIds\(\); if \(ids\) csaPeers\.sweepOwners\(ids, now, FOES_STALE_MS\); \}/);
  assert.match(w, /csaPeers\.rebase\(r\.offset\);/);
  assert.match(w, /csaPeers\.setEnabled\(csaOn\(\)\);[^\n]*\n\s+if \(csaOn\(\)\) csaPeers\.frame\(dt\);/);   // CSA-K: posed once a frame (csaPeersFrame), before the pool's own frame
  assert.match(w, /function csaPoolFrame\(dt\) \{\n\s+csaPeersFrame\(dt\);[^\n]*\n\s+_csaPeersPosed = false;\n\s+if \(csaOn\(\)\) csa\.frame\(/);
  const x = src('scenes/exteriorFoes.js');
  assert.match(x, /if \(data\.sa !== undefined\) _onCsa\?\.\(from, data\.sa, _now\(\)\);/);
  assert.equal((x.match(/_onCsaClear\?\.\(\);/g) ?? []).length, 2, 'both clears: the teardown and the room change');
});
