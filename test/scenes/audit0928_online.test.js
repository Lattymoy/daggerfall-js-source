// AUDIT PRE-MERGE 0928 (online): the Sea Update's wire, read before it merges - Come Sail Away's `sa` word and the
// others' boats (O1 a variant past the hull's own, and a throw kept to its owner; O2 the moved word asks for a frame;
// O3 a word kept, never built from, one build a frame under a bucket; O4 the owner's look is their boat's; O6 the hull
// carries only the foes this client steps) and the boats' pool (R5 one walk a frame, nothing allocated per node; R6 a
// flat that stands still is no shadow dynamic). The modules are the real ones: the pool over the vendored models with
// a stand-in renderer and pipeline (test/systems/comeSailAway/csa_online.test.js's), world.js's own foesStream, csaWord and csaEnemies
// mounted from the source, the renderer over a recording GL (test/render/shadowreach.test.js's).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as poolMod from '../../src/scenes/comeSailAway/comeSailAwayPool.js';
import * as peersMod from '../../src/scenes/comeSailAway/comeSailAwayPeers.js';
import * as wireMod from '../../src/systems/comeSailAway/comeSailAwayWire.js';
import * as boatMod from '../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { createExteriorFoes } from '../../src/scenes/exteriorFoes.js';
import { quietFoesGate } from '../../src/net/foesQuiet.js';   // SCALE2c
import { rendererModel, bundleSlots } from '../../src/systems/comeSailAway/comeSailAwayModels.js';
import { FOES_MS, FOES_FULL_MS } from '../../src/net/online.js';
import { isCellRoom, isWorldRoom, FOES_HZ_MAX } from '../../src/net/wire.js';
import { Renderer, WORLD_FRAME } from '../../src/render/renderer.js';
import { EL_LANE } from '../../src/render/enhancedLighting.js';
import { SHADOW_DYNAMIC_HOLD } from '../../src/render/shadowPass.js';

const { createComeSailAwayPool, activeObjects } = poolMod;
const { createComeSailAwayPeers } = peersMod;
const { validCsaRecord, csaWireRecord, csaRecordKey } = wireMod;
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const settle = () => new Promise((r) => setTimeout(r, 0));

const fileFetch = async (url) => {
  const bytes = readFileSync(fileURLToPath(url));
  return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
};
function recordingRenderer() {
  const r = { drawn: [], batches: [], destroyed: [] };
  r.createMesh = (model) => ({ model, buffers: [{}, {}], bounds: [0, 0, 0, 0], subMeshes: model.subMeshes.map((s) => ({ ...s, _bounds: [0, 0, 0, 0] })) });
  r.drawMesh = (mesh, matrix) => r.drawn.push({ mesh, matrix });
  r.updateMeshVertices = () => {};
  r.createBillboardBatch = (archive, record, size, centers, opts) => { const b = { archive, record, size, centers, opts }; r.batches.push(b); return b; };
  r.destroyBillboardBatch = (b) => r.destroyed.push(b);
  r.destroyMesh = (m) => r.destroyed.push(m);
  return r;
}
function standInPipeline() {
  const texture = () => ({ recordCount: 100, getSize: () => ({ width: 40, height: 64 }), getScale: () => ({ width: 0, height: 0 }) });
  const textureFiles = new Map(), cpuModels = new Map(), gpuMeshes = new Map();
  return {
    textureFiles, cpuModels, gpuMeshes,
    getTexture: async (a) => { if (!textureFiles.has(a)) textureFiles.set(a, texture()); return textureFiles.get(a); },
    uploadRecord: () => {},
    getGpuMesh: async (id) => { cpuModels.set(id, { positions: new Float32Array([-1, 0, -2, 1, 1.5, 2]) }); const g = { classic: id }; gpuMeshes.set(id, g); return g; },
  };
}
async function readyPool(renderer = recordingRenderer()) {
  const pool = createComeSailAwayPool({ renderer, pipeline: standInPipeline(), fetchFn: fileFetch, log: { warn() {} } });
  assert.equal(await pool.preload(), true);
  return pool;
}
const Q = [0, Math.sin(0.25), 0, Math.cos(0.25)];
const word = (o = {}) => [o.hull ?? 1, o.variant ?? 0, o.x ?? 10, o.y ?? 34, o.z ?? 20, ...(o.q ?? Q), o.sails ?? 0, o.helm ?? 0, o.light ?? 0];
/** The pool's builds, counted where the peers ask for them. */
function countBuilds(pool) {
  const spawn = pool.spawnPeerNow, n = { builds: 0 };
  pool.spawnPeerNow = (b) => { n.builds++; return spawn(b); };
  return n;
}

// ── world.js's own statements, mounted (audit26_dungeonfoes' law: the statements are the ones in src/) ──
const WORLD = rd('src/scenes/world.js');
function cut(src, head, end) {
  const i = src.indexOf(head);
  assert.ok(i >= 0, `${head} is in the source`);
  const j = src.indexOf(end, i);
  assert.ok(j > i, `and it ends`);
  return src.slice(i, j + end.length);
}
function mount(scope, code, name) {
  const proxy = new Proxy(scope, {
    has: () => true,
    get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  // eslint-disable-next-line no-new-func
  return new Function('__scope', `with (__scope) { ${code}\n return ${name}; }`)(proxy);
}

// ── O1 ──────────────────────────────────────────────────────────────────────

test('AUDIT PRE-MERGE 0928 O1: the variants each hull\'s prefab carries - read off the vendored prefabs, the table the door bounds a word by; the Large Boat\'s seven and none on the rest', () => {
  const prefabs = JSON.parse(rd('vendor/come-sail-away/Models/prefabs.json')).prefabs;
  const counts = boatMod.HULL_NAMES.map((_, h) => {
    let n = 0;
    (function walk(node) { if (node.name === 'Variants' && node.active) n = node.children.length; else for (const c of node.children) walk(c); })(prefabs[String(boatMod.FIRST_HULL_MODEL_ID + h)]);
    return n;
  });
  assert.deepEqual(counts, [0, 7, 0, 0, 0], 'the prefabs as the extraction carried them');
  assert.deepEqual(boatMod.HULL_VARIANT_COUNTS, counts);
});

test('AUDIT PRE-MERGE 0928 O1: the door refuses a Large Boat word past its seventh variant - SpawnBoat throws on it ("Transform child out of bounds") - and takes any variant of a hull that never reads one', async () => {
  for (const v of [7, 8, 9]) assert.equal(validCsaRecord({ b: [word({ hull: 1, variant: v })] }), null, `the Large Boat's variant ${v}`);
  assert.equal(validCsaRecord({ b: [word({ hull: 0 }), word({ hull: 1, variant: 9 })] }), null, 'one such boat drops the word whole');
  assert.deepEqual(validCsaRecord({ b: [word({ hull: 1, variant: 6 })] }).boats.map((b) => b.variant), [6], 'its seventh stands');
  for (const h of [0, 2, 3, 4]) assert.ok(validCsaRecord({ b: [word({ hull: h, variant: 9 })] }), `hull ${h} carries no Variants node - any variant (the console's random.range(0, 7) among them) is honest`);
  const pool = await readyPool();
  assert.throws(() => pool.spawnPeerNow(new boatMod.Boat(1, 7)), /Transform child out of bounds/, 'what the door keeps out throws where it is built');
  assert.ok(pool.spawnPeerNow(new boatMod.Boat(1, 6)) && pool.spawnPeerNow(new boatMod.Boat(0, 9)), 'what it lets in builds');
});

test('AUDIT PRE-MERGE 0928 O1: a peer\'s build or SetBoatVariant that throws costs that owner\'s word and boats, said once - never the frame (AUDIT MWBODY A1\'s law) - and another owner\'s boats stand', async () => {
  const pool = await readyPool();
  const warns = [];
  const peers = createComeSailAwayPeers({ pool, selfId: () => 'me', log: { warn: (...a) => warns.push(a.join(' ')) } });
  const spawn = pool.spawnPeerNow;
  pool.spawnPeerNow = (b) => { if (b.hull === 2) throw new Error('Transform child out of bounds'); return spawn(b); };
  let threw = null;
  try {
    peers.applyOwner('ann', { b: [word({ hull: 2 })] }, (p) => p, 0);
    peers.applyOwner('bob', { b: [word({ hull: 0, x: 60 })] }, (p) => p, 0);
    for (let i = 0; i < 6; i++) { peers.frame(1 / 60); if (i === 3) peers.applyOwner('ann', { b: [word({ hull: 2 })] }, (p) => p, 100); }
  } catch (e) { threw = e; }
  assert.equal(threw, null, 'no frame threw');
  assert.deepEqual(peers.shown().map((o) => o.owner), ['bob'], 'ann\'s word went with the throw');
  assert.equal(pool.peerBoats.length, 1);
  assert.equal(pool.peerBoats[0].hull, 0, 'bob\'s Rowboat stands');
  assert.equal(warns.length, 1, `said once (${warns})`);
  assert.match(warns[0], /Transform child out of bounds/);
  // a re-dress that throws: the same owner's loss alone
  pool.spawnPeerNow = spawn;
  const setVariant = pool.setVariant;
  pool.setVariant = () => { throw new Error('a variant that is not there'); };
  peers.applyOwner('cid', { b: [word({ hull: 1, variant: 2, x: 120 })] }, (p) => p, 200);
  peers.frame(1 / 60);
  assert.equal(pool.peerBoats.length, 2);
  peers.applyOwner('cid', { b: [word({ hull: 1, variant: 3, x: 120 })] }, (p) => p, 300);
  assert.doesNotThrow(() => peers.frame(1 / 60));
  assert.deepEqual(peers.shown().map((o) => o.owner), ['bob'], 'cid\'s boats went');
  assert.equal(pool.peerBoats.length, 1);
  pool.setVariant = setVariant;
});

// ── O3 ──────────────────────────────────────────────────────────────────────

test('AUDIT PRE-MERGE 0928 O3: the handler keeps the word and builds nothing; the frame builds ONE boat, across every owner; an honest owner\'s eight stand within eight frames, a place in the list not built yet standing nothing', async () => {
  const pool = await readyPool();
  const n = countBuilds(pool);
  const peers = createComeSailAwayPeers({ pool, selfId: () => 'me' });
  const eight = { b: Array.from({ length: 8 }, (_, k) => word({ hull: k % 2 ? 0 : 2, x: 10 + k * 40 })) };
  assert.equal(peers.applyOwner('ann', eight, (p) => p, 0), true);
  assert.equal(peers.applyOwner('bob', { b: [word({ hull: 0, x: 500 })] }, (p) => p, 0), true);
  assert.equal(n.builds, 0, 'the socket\'s handler built nothing');
  assert.equal(pool.peerBoats.length, 0);
  const perFrame = [];
  for (let f = 0; f < 9; f++) { const b0 = n.builds; peers.frame(1 / 60); perFrame.push(n.builds - b0); }
  assert.deepEqual(perFrame, [1, 1, 1, 1, 1, 1, 1, 1, 1], 'one build a frame');
  const ann = peers.shown().find((o) => o.owner === 'ann').boats;
  assert.equal(ann.length, 8, 'the places the word names, in its order');
  assert.ok(ann.every(Boolean), 'ann\'s eight stand by the ninth frame (the builds shared with bob\'s one)');
  assert.deepEqual(ann.map((s) => s.hull), eight.b.map((w) => w[0]));
  // a single owner: eight frames
  const pool2 = await readyPool();
  const peers2 = createComeSailAwayPeers({ pool: pool2, selfId: () => 'me' });
  peers2.applyOwner('ann', eight, (p) => p, 0);
  const standing = [];
  for (let f = 0; f < 8; f++) { peers2.frame(1 / 60); standing.push(peers2.shown()[0].boats.filter(Boolean).length); }
  assert.deepEqual(standing, [1, 2, 3, 4, 5, 6, 7, 8], 'a place waiting for its build stands nothing, and eight frames stand all eight');
  assert.equal(pool2.peerBoats.length, 8);
});

test('AUDIT PRE-MERGE 0928 O3: a hull-swapping peer is bounded - eight Large Galleys and eight Rowboats in turn at the relay\'s rate (FOES_HZ_MAX a second) for ten seconds of frames builds at most eight and one more every FOES_FULL_MS; a word refused or nulled between, or a sweep that finds it out of range, never hands the bucket back', async () => {
  const pool = await readyPool();
  const n = countBuilds(pool);
  const peers = createComeSailAwayPeers({ pool, selfId: () => 'me', log: { warn() {} } });
  const galleys = { b: Array.from({ length: 8 }, (_, k) => word({ hull: 3, x: 10 + k * 60 })) };
  const rowboats = { b: Array.from({ length: 8 }, (_, k) => word({ hull: 0, x: 10 + k * 60 })) };
  const dt = 1 / 60, every = Math.round(60 / FOES_HZ_MAX);
  let words = 0;
  for (let f = 0; f < 600; f++) {
    if (f % every === 0) {
      peers.applyOwner('eve', words % 2 ? rowboats : galleys, (p) => p, f * dt * 1000);
      if (words % 3 === 2) { peers.applyOwner('eve', null, (p) => p, f * dt * 1000); peers.applyOwner('eve', { b: [word({ hull: 9 })] }, (p) => p, f * dt * 1000); }   // a null and a refused word between
      if (words % 4 === 3) peers.sweepOwners(new Set(), f * dt * 1000, FOES_FULL_MS * 3);   // and out of range and back (a pose flickered past the reach)
      words++;
    }
    peers.frame(dt);
  }
  const cap = 8 + Math.floor((600 * dt * 1000) / FOES_FULL_MS);
  assert.ok(n.builds <= cap, `${n.builds} builds in ten seconds, at most ${cap}`);
  assert.ok(n.builds >= cap - 1, `and the bucket does spend what it holds (${n.builds})`);
  assert.equal(peersMod.CSA_PEER_BUILD_BURST, wireMod.CSA_WIRE_BOATS_MAX);
  assert.equal(peersMod.CSA_PEER_BUILD_REFILL_MS, FOES_FULL_MS);
});

test('AUDIT PRE-MERGE 0928 O3: a word that moves a boat along its list (a place, a pack) keeps it - matched by its hull, nearest first - and builds nothing; a hull the word no longer names goes', async () => {
  const pool = await readyPool();
  const n = countBuilds(pool);
  const peers = createComeSailAwayPeers({ pool, selfId: () => 'me' });
  const A = word({ hull: 0, x: 10 }), B = word({ hull: 2, x: 60 }), C = word({ hull: 0, x: 110 });
  peers.applyOwner('ann', { b: [A, B, C] }, (p) => p, 0);
  for (let f = 0; f < 3; f++) peers.frame(1 / 60);
  const [a, b, c] = peers.shown()[0].boats.map((s) => s.boat);
  const built = n.builds;
  peers.applyOwner('ann', { b: [B, C, A] }, (p) => p, 100);
  peers.frame(1 / 60);
  assert.equal(n.builds, built, 'reordered: nothing built');
  assert.deepEqual(peers.shown()[0].boats.map((s) => s.boat), [b, c, a], 'each boat at its new place - the two Rowboats by their own places, not swapped');
  peers.applyOwner('ann', { b: [B, A] }, (p) => p, 200);   // C packed
  peers.frame(1 / 60);
  assert.equal(n.builds, built, 'packed: nothing built');
  assert.deepEqual(peers.shown()[0].boats.map((s) => s.boat), [b, a]);
  assert.ok(!pool.peerBoats.includes(c), 'the packed one goes');
  peers.applyOwner('ann', { b: [word({ hull: 3, x: 60 }), A] }, (p) => p, 300);   // B is a galley now
  peers.frame(1 / 60);
  assert.ok(!pool.peerBoats.includes(b), 'a hull the word no longer names goes');
  assert.equal(peers.shown()[0].boats[1].boat, a);
});

// ── O2 ──────────────────────────────────────────────────────────────────────

const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
function foesPool(clock) {
  const pool = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: () => ({ grounded: true }) },
    fetchBytes: async (name) => { throw new Error(`no ${name} in this pin`); }, getTexture: async () => stubTex, uploadRecordFrame: () => {}, currentMinute: () => 0, currentPixelKey: () => '3,12',
    playerEntity: { level: 1, health: 50, maxHealth: 50, skills: new Array(40).fill(20), items: [], activeEffects: [], stats: {} }, audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
  });
  pool.setNet({ room: () => 'world:3,12', selfId: () => 'me', peers: () => [], now: () => clock.t, staleMs: 0, onPeerHit: () => true, toWire: (p) => [...p], toScene: (p) => [...p] });
  return pool;
}
/** world.js's foesStream and csaWord over a real foes pool with no foe in it, a boat moving at `speed`; the frames sent. */
function sail(speed) {
  const clock = { t: 0 };
  const boat = { hull: 1, variant: 0, GameObject: { activeSelf: true, position: [0, 0, 0], rotation: [0, 0, 0, 1] }, Sails: [], LightOn: false };
  const sent = [];
  const scope = {
    online: { status: 'open', room: 'world:3,12', isHost: () => false, sendFoes: (f) => { sent.push(f); return true; } },
    isCellRoom, isWorldRoom, FOES_MS, FOES_FULL_MS, _foesSentAt: -Infinity, _foesFullAt: -Infinity, modes: { mode: 'exterior' },
    _foesQuiet: quietFoesGate(),   // SCALE2c (PIN MOVED): the host's memory of what its cell last heard - a full frame that says nothing, said once
    exteriorFoes: foesPool(clock), _hccDirty: false, camps: { wireRecords: () => [] }, hcc: { wireRecord: () => null }, duelRingWord: () => {}, raidWireWord: () => null,   // THE MERGE: RAID2's word rides the same line - no raid here
    portalWord: () => {},   // PORTAL1: nor a portal
    campToWire: (p) => [...p], csaRuntime: { AllBoats: [boat], isSailing: () => true, state: { CurrentBoat: boat } }, csaOn: () => true,
    csaWireRecord, csaRecordKey, csaAnimatorOf: boatMod.animatorOf, _csaWordKey: null,
    shipFlags: { wireFlag: () => null },   // PIN MOVED (SHIP-COLOURS: the boats' word asks each boat's flag - none flown here)
    bandWord: () => false,   // TV7b: no band chases on this sea
    seaRaidWord: () => false,   // OW6: nor raider chases
    csaAboardWord: () => false,   // CSA-K: aboard nobody's boat - the stream's second word says nothing
    navalOn: () => false, naval: null, navalRecordKey: () => '', _navalWordKey: null,   // NAV-G: the sea's word rides the same stream - off here, this pin is the boats'
  };
  scope.csaWord = mount(scope, cut(WORLD, 'function csaWord(frame, full) {', '\n  }\n'), 'csaWord');
  scope.navalWord = mount(scope, cut(WORLD, 'function navalWord(frame, full) {', '\n  }\n'), 'navalWord');
  const foesStream = mount(scope, cut(WORLD, 'const foesStream = (now) => {', '\n  };\n'), 'foesStream');
  for (let t = 0; t <= 6000; t += 1000 / 60) {
    clock.t = t;
    boat.GameObject.position = [t / 1000 * speed, 0, 0];
    foesStream(t);
  }
  return sent;
}

test('AUDIT PRE-MERGE 0928 O2: world.js\'s foes stream, mounted - a sailing boat\'s moved word asks for a frame as the team\'s does, so it rides every FOES_MS on a sea with no foe; a still boat rides the full frames alone', () => {
  const sailing = sent => sent.filter((f) => f.sa !== undefined);
  const moving = sailing(sail(4));
  assert.ok(moving.length >= 25, `the word rode ${moving.length} frames in six seconds of sailing (a FOES_MS apart: about ${6000 / FOES_MS})`);
  const gaps = moving.slice(1).map((f, i) => f.sa.b[0][2] - moving[i].sa.b[0][2]);
  assert.ok(gaps.every((g) => g < 1.5), `no step between words past a FOES_MS of sailing (${Math.max(...gaps).toFixed(2)} m)`);
  const still = sailing(sail(0));
  assert.ok(still.length >= 3 && still.length <= Math.ceil(6000 / FOES_FULL_MS) + 1, `a still boat: ${still.length} words`);
  assert.ok(still.every((f) => f.full === 1), 'every one on a full frame');
});

// ── O4 ──────────────────────────────────────────────────────────────────────

test('AUDIT PRE-MERGE 0928 O4: the owner\'s look is their boat\'s (AUDIT 0927 I-B) - the classic lane\'s hidden sailor\'s boat at the helm stands nowhere (no mesh, no flat, no lantern light); the enhanced lane\'s wears the look on its crew and lanterns while the hull draws whole; a moored boat is a boat in the world either way', async () => {
  const renderer = recordingRenderer();
  const pool = await readyPool(renderer);
  const peers = createComeSailAwayPeers({ pool, selfId: () => 'me' });
  let look = 'hidden';
  peers.setPeerLook?.((id) => (id === 'ann' ? look : null));
  // ann at the helm of a Small Ship at x 0, her Large Galley moored at x 1000, both lit
  peers.applyOwner('ann', { b: [word({ hull: 2, x: 0, z: 0, helm: 1, light: 1 }), word({ hull: 3, x: 1000, z: 0, light: 1 })] }, (p) => p, 0);
  const near = (x) => (m) => Math.abs(m[12] - x) < 200;
  const step = async () => { peers.frame(0.1); pool.frame(0.1, { cityLightsOn: true, playerPosition: [0, 0, 0] }); renderer.drawn.length = 0; pool.draw(); for (let i = 0; i < 4; i++) await settle(); renderer.drawn.length = 0; pool.draw(); };
  for (let i = 0; i < 3; i++) await step();
  const helmBoat = peers.shown()[0].boats[0].boat, moored = peers.shown()[0].boats[1].boat;
  assert.equal(renderer.drawn.filter((d) => near(0)(d.matrix)).length, 0, 'hidden: nothing of the helm boat drawn');
  assert.ok(renderer.drawn.filter((d) => near(1000)(d.matrix)).length > 0, 'the moored galley drawn');
  assert.equal(pool.batches().filter((b) => Math.abs(b.origin[0]) < 200).length, 0, 'no flat of the helm boat');
  assert.ok(pool.batches().some((b) => Math.abs(b.origin[0] - 1000) < 200), 'the moored one\'s flats');
  assert.equal(pool.lights([0, 0, 0]).filter((l) => Math.hypot(l.x, l.z) < 60).length, 0, 'no lantern of the helm boat in the light list (the player beside it)');
  // the enhanced lane: a concealed look
  look = { mode: 1, alpha: 0.4, t: 0, phase: 0 };
  for (let i = 0; i < 2; i++) await step();
  assert.equal(helmBoat.GameObject.activeSelf, true);
  assert.ok(renderer.drawn.filter((d) => near(0)(d.matrix)).length > 0, 'concealed: the hull drawn whole');
  assert.ok(pool.lights([0, 0, 0]).some((l) => Math.hypot(l.x, l.z) < 60), 'seen, its lanterns light again');
  const helmFlats = pool.batches().filter((b) => Math.abs(b.origin[0]) < 200), mooredFlats = pool.batches().filter((b) => Math.abs(b.origin[0] - 1000) < 200);
  assert.ok(helmFlats.length > 0 && helmFlats.every((b) => b.conceal === look), 'its crew and lanterns in the owner\'s look');
  assert.ok(mooredFlats.length > 0 && mooredFlats.every((b) => b.conceal == null), 'the moored boat\'s plain');
  // seen again: plain
  look = null;
  await step();
  assert.ok(pool.batches().every((b) => b.conceal == null), 'the look gone: every flat plain');
  assert.equal(moored.GameObject.activeSelf, true);
  // the host hands the look over as it hands the cart pool's
  assert.match(WORLD, /csaPeers\.setPeerLook\(\(id\) => \(_hiddenPeers\.has\(id\)(?: \|\| !gateCrowd\.shows\(id\))? \? 'hidden' : \(_veils\.get\(id\) \?\? null\)\)\);/);   // PIN MOVED (AUDIT CROWD-WIDE B1): and one the crowd's count leaves undrawn (test/systems/gatecrowd.test.js)
});

// ── O6 ──────────────────────────────────────────────────────────────────────

test('AUDIT PRE-MERGE 0928 O6: world.js\'s csaEnemies, mounted - underground the hull carries only the foes this client steps, never a room foe while another holds the seat or a party member\'s own; the modes answer with the dungeon frame\'s own puppet test', () => {
  const mine = { ai: { feet: [0, 0, 0] } }, roomPuppet = { ai: { feet: [1, 0, 0] } }, ownPuppet = { ai: { feet: [2, 0, 0] }, _ownFrom: 'bob' }, dead = { dead: true, ai: { feet: [3, 0, 0] } };
  const scope = {
    modes: { mode: 'dungeon', insideFoes: () => [mine, roomPuppet, ownPuppet, dead], insideFoeIsPuppet: (f) => f === roomPuppet || f === ownPuppet },
    exteriorFoes: { foes: [] }, cityGuards: { guards: [] }, _csaEnemyHandles: new WeakMap(), CAPSULE_HEIGHT: 1.8,
  };
  const csaEnemies = mount(scope, cut(WORLD, 'function csaEnemies() {', '\n  }\n'), 'csaEnemies');
  assert.deepEqual(csaEnemies().map((h) => h.key), [mine.ai], 'mine alone');
  scope.modes.insideFoeIsPuppet = () => false;
  assert.equal(csaEnemies().length, 3, 'the one seat held here: every live foe is mine to carry');
  // the seam and the test it asks, one law with the dungeon's frame
  const modes = rd('src/scenes/worldModes.js'), dc = rd('src/scenes/dungeonContext.js');
  assert.match(modes, /insideFoeIsPuppet\(f\) \{ return mode === 'dungeon' && !!dungeonCtx\?\.isPuppetFoe\?\.\(f\); \},/);
  assert.match(dc, /const _puppet = isPuppetFoe\(f, _fi\);/, 'the frame steps its puppets by the same test');
  assert.match(dc, /isPuppetFoe: \(f\) => isPuppetFoe\(f\),/);
  // the dungeon's predicate, mounted: the room's foes are puppets only while another holds the seat
  const predScope = { _authority: false, _layoutFoes: 2, foes: [] };
  predScope.isRoomFoe = mount(predScope, cut(dc, 'const isRoomFoe = ', ';\n'), 'isRoomFoe');
  const isPuppetFoe = mount(predScope, cut(dc, 'const isPuppetFoe = ', ';\n'), 'isPuppetFoe');
  const layout = { n: 'layout' }, loose = { n: 'loose' }, enc = { n: 'enc', _encId: 3 }, own = { n: 'own', _ownFrom: 'bob' };
  predScope.foes.push(layout, { n: 'layout2' }, loose, enc, own);
  assert.deepEqual([layout, loose, enc, own].map((f) => isPuppetFoe(f)), [true, false, true, true], 'another holds the seat');
  predScope._authority = true;
  assert.deepEqual([layout, loose, enc, own].map((f) => isPuppetFoe(f)), [false, false, false, true], 'I hold it: only a party member\'s own is another\'s');
});

// ── R5 / R6 ─────────────────────────────────────────────────────────────────

test('AUDIT PRE-MERGE 0928 R5: the pool walks each boat ONCE a frame - its walk activeObjects\' own (the nodes, their order, every matrix to the bit), the draw reading it in that order - and a second frame allocates no per-node matrix', async () => {
  const renderer = recordingRenderer();
  const pool = await readyPool(renderer);
  const boats = [0, 1, 2, 3, 4].map((h) => pool.spawnNow(new boatMod.Boat(h, 0), { position: [h * 30, 0, 5], rotation: [0, Math.sin(0.3), 0, Math.cos(0.3)] }));
  for (const b of boats) boatMod.setLights(b, true);
  for (let i = 0; i < 40; i++) { pool.frame(1 / 60, { cityLightsOn: true, playerPosition: [0, 0, 0] }); pool.draw(); await settle(); }
  pool.frame(0, { playerPosition: [0, 0, 0], cityLightsOn: true }); pool.frame(0, { playerPosition: [0, 0, 0], cityLightsOn: true });
  // a second frame (its timers held, so no bake and no lantern's reach is asked): the walk's storage kept - no matrix
  // made per node, by the frame or by its draw
  const Real = globalThis.Float32Array;
  let made = 0;
  globalThis.Float32Array = new Proxy(Real, { construct(t, args) { if (args[0] === 16 || args[0]?.length === 16) made++; return new t(...args); } });   // a matrix made either way (quatToMat4 makes its own from a literal)
  try { pool.frame(0, { playerPosition: [0, 0, 0], cityLightsOn: true }); pool.draw(); } finally { globalThis.Float32Array = Real; }
  assert.equal(made, 0, `no matrix made by a second frame and its draw (${made})`);
  for (const boat of boats) {
    const w = pool.walkOf(boat), old = [...activeObjects(boat.GameObject)];
    assert.equal(w.nodes.length, old.length, `hull ${boat.hull}: every active object`);
    old.forEach(([n, m], i) => {
      assert.equal(w.nodes[i], n, `hull ${boat.hull}: the same order (${i})`);
      assert.ok(m.every((v, k) => Object.is(v, w.mats[i][k])), `hull ${boat.hull}: the same matrix to the bit (${n.name})`);
    });
  }
  renderer.drawn.length = 0;
  const drawn = pool.draw();
  const galley = pool.walkOf(boats[3]);
  // AUDIT NAV1 (the frame's cost, #13): her still parts, still these forty frames, drawn as her one batch at her hull's
  // matrix (comeSailAwayPool.js stillBatch); every other object at its own
  const still = pool.stillOf(boats[3]);
  assert.ok(still && still.nodes.size > 100, `the galley's still parts merged (${still?.nodes.size})`);
  const hullAt = galley.mats[galley.nodes.indexOf(boats[3].MeshObject)];
  assert.deepEqual(renderer.drawn.filter((d) => d.mesh === still.mesh).map((d) => d.matrix), [hullAt], 'her batch drawn once, at her hull\'s matrix');
  const drawnGalley = renderer.drawn.filter((d) => d.mesh !== still.mesh && galley.mats.includes(d.matrix));
  const drawsHere = (n) => {   // the draw's own law, over what it reads
    const mr = n.getComponent('MeshRenderer');
    if (!mr || mr.m_Enabled === false || mr.materials?.[0]?.billboard) return false;
    if (mr.classicModel != null) return true;
    const mf = n.getComponent('MeshFilter');
    if (mf?.baked) return !!n.getComponent('FixDeformations')?.bakedMesh?.gpu;
    return !!mf?.m_Mesh?.mesh && !!rendererModel(pool.models.geometry(mf.m_Mesh.mesh), mr.materials ?? bundleSlots(mr));
  };
  const drawable = galley.nodes.filter((n) => drawsHere(n) && !still.nodes.has(n));
  assert.ok(galley.nodes.filter(drawsHere).every((n) => still.nodes.has(n) || drawable.includes(n)));
  assert.ok(drawnGalley.length > 0 && drawnGalley.length === drawable.length, `the galley: every drawable object not in her batch drawn once (${drawnGalley.length} of ${drawable.length})`);
  assert.deepEqual(drawnGalley.map((d) => galley.nodes[galley.mats.indexOf(d.matrix)]), drawable, 'those objects, each at its own matrix');
  const at = drawnGalley.map((d) => galley.mats.indexOf(d.matrix));
  assert.ok(at.every((v, i) => i === 0 || v > at[i - 1]), 'in the walk\'s order');
  assert.equal(drawn, renderer.drawn.length);
  // ONCE: a frame and its draw read the galley's root's children one time between them - one visit of one walk
  const root = boats[3].GameObject, kids = root.children;
  let reads = 0;
  Object.defineProperty(root, 'children', { configurable: true, get() { reads++; return kids; } });
  try { pool.frame(0, { playerPosition: [0, 0, 0], cityLightsOn: true }); pool.draw(); } finally { delete root.children; root.children = kids; }
  assert.equal(reads, kids.length + 1, `one walk a frame: the root's children read once (${reads})`);
  // walked again where the frame's walk would be stale: a re-dress between the frame and the draw
  const large = boats[1];
  pool.frame(0, { playerPosition: [0, 0, 0], cityLightsOn: true });
  const before = new Set(pool.walkOf(large).nodes);
  pool.setVariant(large, 3);
  const now = new Set([...activeObjects(large.GameObject)].map(([n]) => n));
  assert.ok([...before].some((n) => !now.has(n)), 'the variant changed which objects are active');
  const mine = new Map();
  for (const b of boats) { const w = pool.walkOf(b); w.nodes.forEach((n, i) => mine.set(w.mats[i], [b, n])); }
  renderer.drawn.length = 0; pool.draw();
  const drewLarge = renderer.drawn.map((d) => mine.get(d.matrix)).filter((x) => x && x[0] === large);
  assert.ok(drewLarge.length > 0 && drewLarge.every(([, n]) => now.has(n)), 'the re-dressed boat drawn from its new objects alone');
  // and the origin's shift between them
  pool.frame(0, { playerPosition: [0, 0, 0], cityLightsOn: true });
  pool.offsetAll([10, 0, 0]);
  renderer.drawn.length = 0; pool.draw();
  const fresh = [...activeObjects(boats[0].GameObject)];
  const rw = pool.walkOf(boats[0]);
  assert.ok(fresh.every(([n, m]) => m.every((v, k) => Object.is(v, rw.mats[rw.nodes.indexOf(n)][k]))), 'the origin\'s shift: walked again where it stands');
  assert.ok(renderer.drawn.some((d) => rw.mats.includes(d.matrix) && Math.abs(d.matrix[12] - fresh[0][1][12]) < 40) && fresh[0][1][12] === Math.fround(10), 'drawn where it stands now');
});

test('AUDIT PRE-MERGE 0928 R5: the walk\'s transform written in place is mat4.js\'s own, to the bit - its copy kept out of the relay\'s bundle, where a byte is a relay deploy', async () => {
  const { mat4FromQuatPosScale } = await import('../../src/world/quat.js');
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
  for (let k = 0; k < 200; k++) {
    const q = [rnd(), rnd(), rnd(), rnd()], l = Math.hypot(...q);
    const qn = q.map((v) => v / l), p = [rnd() * 900, rnd() * 50, rnd() * 900], s = [rnd() * 3, rnd() * 3, rnd() * 3];
    const want = mat4FromQuatPosScale(qn, p, s), out = new Float32Array(16).fill(7);
    const got = mat4FromQuatPosScale(qn, p, s, out);
    assert.equal(got, out, 'written into the storage handed it');
    assert.ok(want.every((v, i) => Object.is(v, out[i])), `the same numbers (${k})`);
  }
  assert.ok(!rd('test/net/relayversion.test.js').includes("'src/world/quat.js'"), 'quat.js is no part of the relay\'s bundle');
});

/** test/render/shadowreach.test.js's recording GL, under the real renderer */
function recordingGl() {
  let ids = 0;
  const consts = { TEXTURE0: 1000, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384, READ_FRAMEBUFFER: 36008, DRAW_FRAMEBUFFER: 36009, FRAMEBUFFER: 36160 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray' || k === 'createTexture' || k === 'createFramebuffer' || k === 'createRenderbuffer') return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return () => {};
    },
  });
  return { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 };
}

test('AUDIT PRE-MERGE 0928 R6: a boat\'s flats are built still - their origin moves them, which SC1\'s origin test sees - so a lantern\'s cube caches a boat that stands and replays none of it every frame', async () => {
  const r = new Renderer(recordingGl());
  r.setLightingLane(EL_LANE);
  r.textures.set('1_1', { id: 't11' });
  r.setLighting(new Float32Array([0.12, 0.12, 0.12]), 0, new Float32Array([1, 1, 1]));
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const room = { vao: { id: 'vao-room' }, buffers: [], bounds: new Float32Array([0, 2, 0, 6]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] };
  const pool = createComeSailAwayPool({ renderer: r, pipeline: standInPipeline(), fetchFn: fileFetch, log: { warn() {} } });
  assert.equal(await pool.preload(), true);
  const boat = pool.spawnNow(new boatMod.Boat(2, 0), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
  boatMod.setLights(boat, true);
  pool.frame(0, { playerPosition: [0, 0, 0], cityLightsOn: true });
  const flats = pool.batches();
  assert.ok(flats.length > 0, 'the Small Ship\'s crew and lanterns');
  assert.ok(flats.every((b) => b._dyn === false), 'built still');
  const sp = r.shadows, dyn = [];
  for (let f = 0; f < SHADOW_DYNAMIC_HOLD + 8; f++) {
    r.setPointLights(new Float32Array([0, 2, 0, 10]), new Float32Array([1, 1, 1]));
    r.beginFrame(I, I, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
    dyn.push(sp.stats.dynFaces);
    pool.frame(0, { playerPosition: [0, 0, 0], cityLightsOn: true });   // the flats' origins written again, the same numbers: the boat stands
    r.drawMesh(room, I, null);
    r.drawBillboards(pool.batches(), new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
  }
  assert.deepEqual(dyn.slice(-4), [0, 0, 0, 0], `a boat that stands replays nothing on top of the cache (${dyn})`);
});
