// AUDIT BRANCH (WoD) - THE WHOLE WORLD OF DAGGERFALL BRANCH, READ BY FIVE LENSES BEFORE THE MERGE.
//
// Mac: "Lets do a comprehensive audit before we decide to merge. This needs to be a perfect integration and
// hopefully bug free". Every finding was reproduced by execution first; each is pinned here as it now stands,
// by behaviour wherever the code can be run - the world host's own WoD code is sliced out of scenes/world.js and
// run against stubs, the lens rigs' own technique - and by source where the line lives inside a scene closure.
// The mutants are tools/mutants/auditwod.json; the page is bible/03-World/World-Of-Daggerfall.md, AUDIT BRANCH.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Collider } from '../src/player/collider.js';
import { objectMatrix } from '../src/world/wodLocationObjects.js';
import { loadLocationPrefab } from '../src/world/wodLocationData.js';
import { WodWorld, fetchPackBytes, WOD_RETRY_MAX } from '../src/world/worldOfDaggerfall.js';
import { StreamingWorldState, TerrainSlots, MAX_TERRAIN_ARRAY } from '../src/world/streamingWorld.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { createDroppedLoot } from '../src/scenes/droppedLoot.js';
import { WodSpawner, WOD_LOOT_LOCATION_INDEX, WOD_LOOT_ALIGN } from '../src/world/wodSpawner.js';
import { wodSiteId, yieldsTo } from '../src/world/wodShared.js';
import { WOD_SPAWN_TYPE } from '../src/world/wodLocationObjects.js';
import { alignBillboardToGround } from '../src/world/groundAlign.js';
import { CELL_PUPPETS_MAX } from '../src/net/wire.js';
import { isPeerTarget } from '../src/characters/enemyTargets.js';
import { readWorldOfDaggerfallBundle } from '../tools/worldOfDaggerfallAssets.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const V = join(ROOT, 'vendor/world-of-daggerfall');
const tick = () => new Promise((r) => setTimeout(r, 0));
const flush = async () => { for (let i = 0; i < 6; i++) await tick(); };

// ── B1: the collider's wide triangles ──────────────────────────────────

/** A unit icosphere, subdivided once: 80 faces. */
function ico() {
  const t = (1 + Math.sqrt(5)) / 2;
  const v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((p) => { const l = Math.hypot(...p); return p.map((c) => c / l); });
  const f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const mid = new Map(); const out = [];
  const m = (a, b) => { const k = a < b ? `${a},${b}` : `${b},${a}`; if (!mid.has(k)) { const p = v[a].map((c, i) => (c + v[b][i]) / 2); const l = Math.hypot(...p); v.push(p.map((c) => c / l)); mid.set(k, v.length - 1); } return mid.get(k); };
  for (const [a, b, c] of f) { const ab = m(a, b), bc = m(b, c), ca = m(c, a); out.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
  return { positions: new Float32Array(v.flat()), indices: new Uint32Array(out.flat()) };
}
const scaled = (tx, ty, tz, s) => new Float32Array([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, tx, ty, tz, 1]);
let seed = 11;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
const sub = (u, w) => [u[0] - w[0], u[1] - w[1], u[2] - w[2]];
const dot = (u, w) => u[0] * w[0] + u[1] * w[1] + u[2] * w[2];
const cross = (u, w) => [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
/** Ericson's closest point, as the collider's. */
function closest(p, a, b, c) {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a); const d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return a;
  const bp = sub(p, b); const d3 = dot(ab, bp), d4 = dot(ac, bp); if (d3 >= 0 && d4 <= d3) return b;
  const vc = d1 * d4 - d3 * d2; if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return [a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v]; }
  const cp = sub(p, c); const d5 = dot(ab, cp), d6 = dot(ac, cp); if (d6 >= 0 && d5 <= d6) return c;
  const vb = d5 * d2 - d1 * d6; if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return [a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w]; }
  const va = d3 * d6 - d5 * d4; if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return [b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w]; }
  const den = 1 / (va + vb + vc); const v = vb * den, w = vc * den; return [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w];
}
/** Möller-Trumbore, both faces. */
function rayTri(o, d, a, b, c) {
  const e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
  if (Math.abs(det) < 1e-12) return null;
  const inv = 1 / det, s = sub(o, a), u = dot(s, p) * inv; if (u < 0 || u > 1) return null;
  const q = cross(s, e1), v = dot(d, q) * inv; if (v < 0 || u + v > 1) return null;
  const t = dot(e2, q) * inv; return t >= 0 ? t : null;
}
/** A bucket with every home: fine (a 2-unit rock), coarse (a 3,000-unit hill), the short list (a 100,000-unit one). */
function wideScene() {
  const c = new Collider();
  const u = ico();
  c.addMesh('k', u.positions, u.indices, scaled(0, 0, 0, 3000));
  c.addMesh('k', u.positions, u.indices, scaled(9000, -500, 0, 1e5));
  c.addMesh('k', u.positions, u.indices, scaled(40, 3000, 40, 30));
  c.addMesh('k', u.positions, u.indices, scaled(10, 3001, 10, 2));
  return c;
}

test('AUDIT BRANCH (WoD) B1: the Mountains layouts\' giant rock files NOTHING on the fine grid - one face of it filed two million cells and half a gigabyte, or ran the Map out of room', () => {
  const p = loadLocationPrefab(readFileSync(join(V, 'LocationPrefab/WOD_Mountain_01r1.txt'), 'utf8'));
  const g = p.obj.find((o) => o.type === 0 && o.scale.x > 1e5);
  assert.ok(g, 'object 2, model 60711 at a scale of about a million');
  assert.equal(g.name, '60711');
  for (const r of [0.001, 0.003, 0.25]) {   // one face of a rock of that radius, under the object's own matrix
    const c = new Collider();
    c.addMesh('k', new Float32Array([r, 0, 0, -r / 2, 0, r * 0.866, -r / 2, 0, -r * 0.866]), new Uint32Array([0, 1, 2]), objectMatrix([g.pos.x, g.pos.y, g.pos.z], g.rot, g.scale));
    const b = c._buckets.get('k');
    assert.equal(b.grid.size, 0, `r ${r}: the fine grid never sees it`);
    assert.equal(b.coarse.size + b.huge.length, 1, `r ${r}: one home - the coarse grid within its cap, else the short list`);
  }
  // every shipped layout, a 1-unit stand-in under each model: bounded, whatever it scales
  const tet = { positions: new Float32Array([1, 1, 1, -1, -1, 1, -1, 1, -1, 1, -1, -1]), indices: new Uint32Array([0, 1, 2, 0, 3, 1, 0, 2, 3, 1, 3, 2]) };
  let worst = 0;
  for (const f of readdirSync(join(V, 'LocationPrefab'))) {
    const lp = loadLocationPrefab(readFileSync(join(V, 'LocationPrefab', f), 'utf8'));
    const c = new Collider();
    for (const o of lp.obj) if (o.type === 0) c.addMesh('k', tet.positions, tet.indices, objectMatrix([o.pos.x, o.pos.y, o.pos.z], o.rot, o.scale));
    const b = c._buckets.get('k');
    if (!b) continue;
    let n = b.huge.length;
    for (const cell of b.grid.values()) n += cell.length;
    for (const cell of b.coarse.values()) n += cell.length;
    worst = Math.max(worst, n);
  }
  assert.ok(worst < 100000, `the worst layout files ${worst} entries (the giant alone filed millions)`);
});

test('AUDIT BRANCH (WoD) B1: the same triangles are found - rays and sphere queries over all three homes agree with brute force', () => {
  const c = wideScene();
  const b = c._buckets.get('k');
  assert.ok(b.grid.size && b.coarse.size && b.huge.length, 'the scene fills every home');
  let rayMiss = 0, rayHits = 0;
  for (let i = 0; i < 800; i++) {
    const tri = b.tris[Math.floor(rnd() * b.tris.length)];
    const u = rnd(), v = rnd() * (1 - u), w = 1 - u - v;
    const target = [0, 1, 2].map((k) => tri[0][k] * u + tri[1][k] * v + tri[2][k] * w);
    const o = target.map((x) => x + (rnd() - 0.5) * 400);
    let d = sub(target, o); const l = Math.hypot(...d); d = d.map((x) => x / l);
    const reach = 1000;
    const got = c.raycastHit(o, d, reach).dist;
    let want = Infinity;
    for (const q of b.tris) { const t = rayTri(o, d, q[0], q[1], q[2]); if (t !== null && t <= reach && t < want) want = t; }
    if (Number.isFinite(want)) rayHits++;
    if (!(got === want || Math.abs(got - want) < 1e-6 * Math.max(1, want))) rayMiss++;
  }
  assert.equal(rayMiss, 0, `rays: ${rayHits} hits of 800, every one the nearest`);
  let sphMiss = 0, sphHits = 0;
  for (let i = 0; i < 2000; i++) {
    const tri = b.tris[Math.floor(rnd() * b.tris.length)];
    const u = rnd(), v = rnd() * (1 - u), w = 1 - u - v;
    const p = [0, 1, 2].map((k) => tri[0][k] * u + tri[1][k] * v + tri[2][k] * w + (rnd() - 0.5) * 4);
    const r = 0.05 + rnd() * 1.85;
    let want = false;
    for (const q of b.tris) { const cp = closest(p, q[0], q[1], q[2]); if ((p[0] - cp[0]) ** 2 + (p[1] - cp[1]) ** 2 + (p[2] - cp[2]) ** 2 < r * r) { want = true; break; } }
    if (want) sphHits++;
    if (c.sphereOverlaps(p, r) !== want) sphMiss++;
  }
  assert.equal(sphMiss, 0, `sphere queries: ${sphHits} overlapping of 2000, all agreeing`);
  // and the resolve stands a body on a wide face and on a short-list one
  assert.equal(c.move([0, 3000.02, 0], 0, -0.5, 0).grounded, true, 'on the hill\'s top face');
  assert.equal(c.move([9000, -500 + 1e5 + 0.02, 0], 0, -0.5, 0).grounded, true, 'on the giant\'s');
});

// ── M1: a placed foe never rides, and hunts no peer ─────────────────────

function craftCfg({ hpPerLevel = 4, speed = 90, str = 40, agi = 85, luck = 55, atkFlags = 0x08 } = {}) {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = atkFlags; v.setUint16(52, hpPerLevel, true);
  const attrs = [str, 50, 50, agi, 50, 50, speed, luck];
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true);
  return b;
}
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18;
  const dataLen = records.reduce((a, [, b]) => a + b.length, 0);
  const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()], ['ENEMY003.CFG', craftCfg({ speed: 60 })]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const playerEntity = () => ({ level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const poolRig = (extra = {}) => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
  fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); },
  getTexture: async () => stubTex,
  uploadRecordFrame: () => {}, currentMinute: () => 0, currentPixelKey: () => '3,12',
  playerEntity: playerEntity(), audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01, ...extra,
});
const netFor = (id, peers = { list: [] }) => ({ room: () => 'world:3,12', selfId: () => id, peers: () => peers.list, now: () => 0, staleMs: 0, onPeerHit: (h, fate) => { fate?.sent?.(); return true; }, toWire: (f) => [f[0], f[1], f[2]], toScene: (p) => [p[0], p[1], p[2]] });
const senses = (pe) => ({ candidates: () => [], playerEntity: pe, playerHeight: 1.8, playerCrouching: false, playerInvisible: false, movingLessThanHalfSpeed: true });

test('AUDIT BRANCH (WoD) M1: an owner\'s PLACED foes never ride - eight left behind at two camps took every one of a peer\'s puppet slots, and the owner\'s next real encounter never stood there', async () => {
  const A = createExteriorFoes(poolRig()); A.setNet(netFor('aaaa-0001'));
  for (let i = 0; i < CELL_PUPPETS_MAX; i++) await A.spawnFoe(0, [2000 + i * 10, 0, 2000], { placed: true, groundAlign: { hitDist: 0.5 } });
  A.update(0.05, [0, 0, 0], [0, 1.6, 0]);
  assert.equal(A.foes.filter((f) => f.placed && !f.dead).length, CELL_PUPPETS_MAX, 'placed: never culled, outside the cap - DFU\'s CreateFoeGameObjects');
  const enc = [];
  for (let i = 0; i < 3; i++) enc.push(await A.spawnFoe(3, [10 + i, 0, 10], { feetGiven: true }));
  const frame = A.foesFrame(true);
  assert.deepEqual(frame.f.map((r) => r.i).sort(), enc.map((f) => f.seq).sort(), 'the frame carries the encounter alone');
  const B = createExteriorFoes(poolRig()); B.setNet(netFor('bbbb-0002'));
  B.applyFoes('aaaa-0001', frame);
  await flush();
  const pups = B.foes.filter((f) => f.puppet);
  assert.deepEqual(pups.map((f) => f.seq).sort(), enc.map((f) => f.seq).sort(), 'the peer stands the three that are fighting beside it');
  // the law is the pool's to state: wire.js's bytes are the relay's deployed law (relayversion.test.js), and what
  // rides still keeps within its comment - a placed foe exceeds the cap as a quest foe does, and never rides either
  assert.match(rd('src/scenes/exteriorFoes.js'), /A quest's foe is the quest owner's alone \(Multiplayer\.md's first lock\) and never rides; nor does a foe a mod\n\s*\*\s*PLACED/, 'the frame\'s own comment names them');
});

test('AUDIT BRANCH (WoD) M1: a PLACED foe hunts no peer - no peer holds its puppet, and a blow at a peer lands only through one; an ordinary foe still does', async () => {
  const run = async (placed) => {
    const peers = { list: [{ id: 'bob-0002', feet: [12, 0, 10], height: 1.8 }] };
    const pe = playerEntity();
    const pool = createExteriorFoes(poolRig({ playerEntity: pe }));
    pool.setNet(netFor('mac-0001', peers));
    const f = placed
      ? await pool.spawnFoe(0, [10, 0, 10], { yaw: Math.PI / 2, placed: true, groundAlign: { hitDist: 0.5 } })
      : await pool.spawnFoe(0, [10, 0, 10], { feetGiven: true, yaw: Math.PI / 2 });
    f.ai.isHostile = true; f.ai.detected = true;
    const me = [80, 0, 80];   // I am far; Bob stands two units from it
    for (let i = 0; i < 40; i++) pool.update(0.05, me, [me[0], me[1] + 1.6, me[2]], senses(pe));
    return f.ai.target;
  };
  assert.ok(isPeerTarget(await run(false)), 'an encounter foe takes the peer, as WORLD6b-ii');
  const t = await run(true);
  assert.ok(!isPeerTarget(t), `the placed one does not (${JSON.stringify(t && { isPeer: t.isPeer, id: t.id })})`);
});

// ── M2: one bad or hung pack never stops the stream ─────────────────────

const packOf = (r) => { try { return new Uint8Array(readFileSync(join(V, 'Locations', `${r}.bin`))); } catch { return null; } };
const prefabTexts = () => new Map(readdirSync(join(V, 'LocationPrefab')).map((f) => [f.replace('.txt', ''), readFileSync(join(V, 'LocationPrefab', f), 'utf8')]));

test('AUDIT BRANCH (WoD) M2: a pack the decoder refuses is that region lost, never the chain - settle() rejected for good and every build after it threw', async () => {
  const warns = [], retries = [];
  const w = new WodWorld({ regions: () => [], pack: async (r) => (r === 20 ? new TextEncoder().encode('<!doctype html>') : packOf(r)), prefabs: async () => prefabTexts() }, { warn: (m) => warns.push(m), schedule: (fn, ms) => retries.push(ms) });
  await w.open();
  w.noteRegion(20);
  await assert.doesNotReject(w.settle(), 'the chain survives the bad pack');
  w.noteRegion(16);
  await assert.doesNotReject(w.settle());
  assert.deepEqual(w.session.regions, [17, 16], 'the bad region is skipped, the next one appends');
  assert.ok(warns.some((m) => /region 20 did not read/.test(m)), 'and it is said');
  assert.deepEqual(retries, [5000], 'WOD6: and tried again off the chain, five seconds on');
});

test('AUDIT BRANCH (WoD) M2: a region heard before Awake waits for region 17; a prefab whose chunk did not load is that layout lost', async () => {
  const w = new WodWorld({ regions: () => [], pack: async (r) => packOf(r), prefabs: async () => { const m = prefabTexts(); m.set('WOD_Rocks_Small_01', null); return m; } }, { warn: () => {}, schedule: () => {} });
  w.noteRegion(16);   // before open()
  await w.open();
  await w.settle();
  assert.deepEqual(w.session.regions, [17, 16], 'Awake\'s folder first, as the C# event cannot fire before Awake');
  assert.equal(w.prefabs.get('WOD_Rocks_Small_01'), null, 'a null text reads as a layout that failed');
  assert.ok(w.prefabs.get('WOD_Rocks_Small_02'), 'and the rest read');
  assert.match(rd('src/world/worldOfDaggerfall.js'), /out\.set\(baseName\(p\)\.replace\(\/\\\.txt\$\/, ''\), await load\(\)\.catch\(\(\) => null\)\);/, 'the browser source catches per file');
});

test('WOD6: a region whose pack failed is tried again off the chain and lands in its own place - the list built again in the order the events came, the host told which pixels it names', async () => {
  let fail = true;
  const timers = [], late = [], warns = [];
  const w = new WodWorld({
    regions: () => [], prefabs: async () => prefabTexts(),
    pack: async (r) => { if (r === 16 && fail === 'page') return new TextEncoder().encode('<!doctype html>'); if (r === 16 && fail) throw new Error('503'); return packOf(r); },
  }, { warn: (m) => warns.push(m), schedule: (fn, ms) => timers.push({ fn, ms }) });
  w.onLate = (region, keys) => late.push({ region, keys });
  await w.open();
  w.noteRegion(16); await w.settle();   // its chain tries fail
  w.noteRegion(9); await w.settle();    // a later region lands first
  assert.deepEqual(w.session.regions, [17, 9], 'the stream goes on without it');
  assert.deepEqual(timers.map((t) => t.ms), [5000], 'one background try scheduled');
  timers.shift().fn(); await flush(); await w.settle();   // down again: the next try waits twice as long
  assert.deepEqual(timers.map((t) => t.ms), [10000]);
  fail = 'page';   // up, but a proxy's page where the pack should be: it does not read, and is tried again
  timers.shift().fn(); await flush(); await w.settle();
  assert.deepEqual(timers.map((t) => t.ms), [20000]);
  assert.deepEqual(w.session.regions, [17, 9]);
  fail = false;
  timers.shift().fn(); await flush(); await w.settle();
  assert.deepEqual(w.session.regions, [17, 16, 9], 'in the events\' order, not the landing\'s: a pixel 16 and 9 both name goes to 16\'s instance, as it would have');
  assert.equal(late.length, 1); assert.equal(late[0].region, 16);
  assert.ok(late[0].keys.size > 1000 && [...late[0].keys].every((k) => /^-?\d+,-?\d+$/.test(k)), `the pixels its instances name (${late[0].keys.size})`);
  assert.ok(warns.some((m) => /region 16 landed late/.test(m)));
  // and one that never comes back is given up after WOD_RETRY_MAX tries, said
  const t2 = [], w2 = [];
  const g = new WodWorld({ regions: () => [], prefabs: async () => new Map(), pack: async (r) => { if (r === 16) throw new Error('down'); return packOf(r); } },
    { warn: (m) => w2.push(m), schedule: (fn, ms) => t2.push({ fn, ms }) });
  await g.open(); g.noteRegion(16); await g.settle();
  const waits = [];
  while (t2.length) { const t = t2.shift(); waits.push(t.ms); t.fn(); await flush(); }
  assert.equal(waits.length, WOD_RETRY_MAX);
  assert.deepEqual(waits.slice(0, 5), [5000, 10000, 20000, 40000, 60000], 'doubling to a minute');
  assert.ok(w2.some((m) => /region 16 gave up after 12 more tries/.test(m)));
  // a build picks, awaits its art, then places: a late landing between them swaps the list, and the pick's identity
  // is its own list's - read through its index into the new one, it was another instance's (or none)
  const p0 = new WodWorld({ regions: () => [], prefabs: async () => prefabTexts(), pack: async (r) => packOf(r) }, { warn: () => {}, schedule: () => {} });
  await p0.open(); p0.noteRegion(0); await p0.settle();
  const [pick] = p0.picksFor({ mapPixelX: 625, mapPixelY: 418, hasLocation: false, mapRegionIndex: -1, worldHeight: 50 });
  const id = p0.session.locationID[pick.index];
  assert.equal(pick.locationID, id);
  p0.session = { locationID: new Int32Array(0) };   // swapped whole by a landing, as _landLate does
  const sp = p0.placements([pick], [0.1]).spawners;
  assert.ok(sp.length > 0 && sp.every((s) => s.locationID === id), 'the spawners name the instance the pick came from');
});

test('AUDIT BRANCH (WoD) M2: a pack fetch is abandoned after a stall and tried three times - a request that never answered held every build for good; a slow line is not a dead one', async () => {
  const hang = (signal) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(signal.reason ?? new Error('aborted'))));
  const noSleep = async () => {};
  let calls = 0;
  await assert.rejects(fetchPackBytes('x', { fetchFn: (u, { signal }) => { calls++; return hang(signal); }, stallMs: 20, sleep: noSleep }), /no byte in 20 ms/);
  assert.equal(calls, 3, 'three tries');
  calls = 0;
  const stallBody = (signal) => { let n = 0; return { getReader: () => ({ read: () => (n++ === 0 ? Promise.resolve({ done: false, value: new Uint8Array([1]) }) : hang(signal)) }) }; };
  await assert.rejects(fetchPackBytes('x', { fetchFn: async (u, { signal }) => { calls++; return { ok: true, body: stallBody(signal) }; }, stallMs: 20, sleep: noSleep }), /no byte/);
  assert.equal(calls, 3, 'a body that stops is a stall too');
  // a real body's read rejects when the request is aborted; this one does too
  const slow = (signal) => { let n = 0; return { getReader: () => ({ read: () => new Promise((res, rej) => { signal.addEventListener('abort', () => rej(signal.reason)); setTimeout(() => res(n < 5 ? { done: false, value: new Uint8Array([n++]) } : { done: true }), 12); }) }) }; };
  assert.deepEqual([...await fetchPackBytes('x', { fetchFn: async (u, { signal }) => ({ ok: true, body: slow(signal) }), stallMs: 30, attempts: 1, sleep: noSleep })], [0, 1, 2, 3, 4], 'bytes arriving inside the stall window keep it alive past it - the window is per byte, not per request');
  calls = 0;
  assert.deepEqual([...await fetchPackBytes('x', { fetchFn: async () => (++calls < 3 ? { ok: false, status: 503 } : { ok: true, arrayBuffer: async () => new Uint8Array([9]).buffer }), sleep: noSleep })], [9], 'a 503 is retried');
  assert.match(rd('src/world/worldOfDaggerfall.js'), /try \{ return await fetchPackBytes\(url\); \}/, 'the browser source fetches through it');
});

test('AUDIT BRANCH (WoD) M2: the build\'s pick can cost a pixel its site, never the pixel; with the mod off no frame walks the pixels for its lights', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(wod && await wodOpened\) \{\n[^\n]*\n[^\n]*\n      try \{\n        const here = state\.current \?\? \{ x: px, y: py \};[\s\S]{0,900}\} catch \(e\) \{\n        console\.warn\(`\[wod\] pixel \$\{key\}: the loader failed here[^\n]*\n        wodPicks = null;\n      \}/);
  assert.match(w, /const wodLit = wod \? _wodLitCount\(\) : 0;/);
  assert.match(rd('src/world/worldOfDaggerfall.js'), /if \(!b\) return;\n[^\n]*\n[^\n]*\n      await new Promise\(\(r\) => setTimeout\(r, 0\)\);[\s\S]{0,400}decodeRegionPack\(b\)/, 'one decode a task');
});

// ── L1-3: DFU's terrain array ──────────────────────────────────────────

test('AUDIT BRANCH (WoD) L1-3: DFU pools a terrain that leaves range and reuses its slot only when a new tile needs one - one step back finds it, a second crossing takes it', () => {
  const s = new TerrainSlots();
  assert.equal(s.size, MAX_TERRAIN_ARRAY); assert.equal(MAX_TERRAIN_ARRAY, 256, 'StreamingWorld.cs:44');
  let r = s.step(100, 100, 3);
  assert.equal(s.keys.size, 49);
  r = s.step(101, 100, 3);
  assert.deepEqual([r.recycled.length, r.pooled.length], [0, 7], 'placement runs first, so the column just left is never the slot the new one takes');
  assert.equal(s.has('97,100'), true, 'pooled, still keyed');
  r = s.step(100, 100, 3);
  assert.ok(r.reactivated.includes('97,100'), 'straight back: reactivated, not promoted');
  s.step(101, 100, 3);
  r = s.step(102, 100, 3);
  assert.ok(r.recycled.includes('97,100'), 'a second crossing east: the new column takes its slot');
  assert.equal(s.has('97,100'), false);
  s.clear();
  assert.equal(s.keys.size, 0, 'ClearStreamingWorld unkeys everything');
  r = s.step(100, 100, 3);
  assert.deepEqual([r.reactivated.length, r.recycled.length], [0, 0], 'and the next world places fresh');
  // a diagonal leaves 13 behind; a straight step then needs only 7 slots - DFU's first-fit keeps the rest
  s.clear(); s.step(100, 100, 3); s.step(101, 101, 3);
  r = s.step(102, 101, 3);
  assert.equal(r.recycled.length, 7);
  assert.equal([...s.keys.keys()].filter((k) => { const [x, y] = k.split(',').map(Number); return Math.abs(x - 102) > 3 || Math.abs(y - 101) > 3; }).length, 13, 'six of the diagonal\'s thirteen survive the step, and the seven it pooled join them');
  assert.deepEqual(new TerrainSlots().step(1, 1, 3, StreamingWorldState.onMap).reactivated, [], 'off the map nothing is placed');
});

// ── The world host's own WoD code, sliced and run ───────────────────────

const WORLD = rd('src/scenes/world.js');
function sliceWorld() {
  const cut = (a, b) => { const i = WORLD.indexOf(a); const j = WORLD.indexOf(b, i); assert.ok(i >= 0 && j > i, `slice ${a}`); return WORLD.slice(i, j); };
  const wodCode = cut('  const wodCarry = new Map();', '  const tickCityGates = ');
  const dpStart = WORLD.indexOf('  function destroyPixel(px, py, { collectLoose = true } = {}) {');
  const dpEnd = WORLD.indexOf('\n  }\n', dpStart) + 4;
  const pubA = WORLD.match(/    const wodKept = adoptWodCarry\(key, wodSpawners, privateersHold\);\n    const wodLife = wodKept\.life \?\? \{\};/);
  const pubB = WORLD.match(/    for \(const pile of wodKept\.piles \?\? \[\]\) standWodPile\(key, wodLife, pile\);/);
  assert.ok(pubA && pubB, 'the publish lines stand where the rig reads them');
  return { wodCode, dpCode: WORLD.slice(dpStart, dpEnd), pubA: pubA[0], pubB: pubB[0] };
}
const SLICE = sliceWorld();
function host({ online = null, removeSiteFoes = () => {} } = {}) {
  let release = null; let cold = false;
  const tex = { recordCount: 47, getFrameCount: () => 1, getSize: () => ({ width: 32, height: 32 }), getScale: () => ({ width: 0, height: 0 }) };
  const getTexture = (a) => (cold && a === 216 ? new Promise((r) => { release = () => r(tex); }) : Promise.resolve(tex));
  const renderer = { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, destroyBatch: () => {}, destroyMesh: () => {}, destroyWaterSurface: () => {}, gl: { deleteTexture: () => {} } };
  const droppedLoot = createDroppedLoot({ renderer, getTexture: async () => tex, uploadRecordFrame: () => {} });
  const built = new Map();
  const state = new StreamingWorldState(3);
  state.init(100, 100);
  const player = { pos: [0, 0, 0], height: 1.8 };
  const env = {
    wod: {}, walkMode: true, playerSpawned: true, player, cam: { pos: [0, 0, 0] }, built, state, TerrainSlots,
    collider: { surfaceHit: () => ({ dist: 1 }), removeBucket: () => {} },
    exteriorFoes: { spawnFoe: async () => null, removeFoe: () => {}, collectPixel: () => {}, removeSiteFoes },
    alignBillboardToGround, WOD_LOOT_ALIGN, WOD_LOOT_LOCATION_INDEX, DUNGEON_LOOT_KEYS: ['A', 'B', 'C', 'N'],
    generateLootItems: () => [{ name: 'Gold' }], playerEntity: { level: 1, gender: 'male' }, addPileLootExtras: () => {}, rollLootRarity: () => {},
    pileSource: () => 0, dungeonRarityTier: () => 0, liveStat: () => 50, getTexture, billboardSize: () => ({ w: 0.8, h: 0.6 }), droppedLoot,
    uploadRecord: () => {}, centredBase: (c) => c, renderer, flatBatchAabb: () => [0, 0, 0, 0, 0, 0], armFlatAnim: () => {}, uploadRecordFrame: () => {},
    _seasonStraightening: false, _loading: false, _recalling: false, rollHoldFoes: () => [], online, wodSiteId, yieldsTo, performance: { now: () => 0 },
    buildingDoors: [], doorGeneration: 0, droppedTorches: { collectPixel: () => {} }, cityGuards: { collectPixel: () => {} },
  };
  const names = Object.keys(env);
  const body = `${SLICE.wodCode}\n${SLICE.dpCode}\n
    function publish(px, py, centres, { wodSite = null } = {}) {
      const key = px + ',' + py;
      const wodSpawners = centres.map((centre, i) => ({ spawner: new __WodSpawner({ spawnType: __LOOT }), centre, flat: null, restand: false, oid: i + 1 }));
      const privateersHold = null;
${SLICE.pubA}
      built.set(key, { px, py, batches: [], _box: [0, 0, 0, 0, 0, 0], wodSpawners, privateersHold, wodSite, wodLife });
${SLICE.pubB}
      return built.get(key);
    }
    function sweep(px, py) {
      wodCarry.clear(); wodSlots.clear();
      for (const k of [...built.keys()]) { const [a, b] = k.split(',').map(Number); destroyPixel(a, b); }
      state.init(px, py); wodSlots.step(px, py, state.terrainDistance, StreamingWorldState.onMap);
    }
    function cross(px, py) {
      state.current = { x: px, y: py };
      for (const k of wodSlots.step(px, py, state.terrainDistance, StreamingWorldState.onMap).recycled) wodCarry.delete(k);
      for (const k of [...built.keys()]) { const [a, b] = k.split(',').map(Number); if (!state.inRange(a, b)) destroyPixel(a, b); }
    }
    wodSlots.step(100, 100, state.terrainDistance, StreamingWorldState.onMap);   // the scene's start, as the host steps it
    return { tick: tickWodSpawners, destroyPixel, publish, sweep, cross, carryOf: (k) => wodCarry.get(k), arriving: (v) => { _seasonStraightening = v; }, siteWas: _wodSiteWas,
      arrival: (list) => { _wodArrival = wodArrivalOf(list); }, onLoad: (c) => wodOnLoad(c), inside: (v) => { _wodInside = v; },
      sprung: _wodSprung, peerSprung: _wodPeerSprung, peerSites: wodPeerSites, sprungChanged: () => _wodSprungChanged };`;
  const api = new Function(...names, '__WodSpawner', '__LOOT', 'StreamingWorldState', body)(...names.map((k) => env[k]), WodSpawner, WOD_SPAWN_TYPE.Loot, StreamingWorldState);
  return { ...api, built, droppedLoot, state, player, cold: (v) => { cold = v; }, release: () => release?.() };
}
const worldAt = (h, px, py, l) => { const t = h.state.pixelTranslation(px, py); return [l[0] + t[0], l[1] + t[1], l[2] + t[2]]; };
const localAt = (h, px, py, p) => { const t = h.state.pixelTranslation(px, py); return p.map((v, i) => Math.round((v - t[i]) * 1000) / 1000); };
/** A camp at (97,100): one treasure marker at local (400, 50, 400), sprung by a player far then near. */
function springCamp(h) {
  const camp = h.publish(97, 100, [[400, 50, 400]]);
  const orig = Math.random; Math.random = () => 0.1;   // SpawnLoot: Range(1,100) = 10 <= 50, a pile
  try {
    h.player.pos = worldAt(h, 97, 100, [0, -0.9, 0]); h.tick();          // Start, far: live
    h.player.pos = worldAt(h, 97, 100, [400, 49.1, 380]); h.tick();      // within 100: springs
  } finally { Math.random = orig; }
  return camp;
}

test('AUDIT BRANCH (WoD) L1-3: one step out of range and straight back finds a sprung camp spent and its pile where it fell; a second crossing drops it, and the site is new', async () => {
  const h = host();
  const camp = springCamp(h);
  await flush();
  const spent = camp.wodSpawners[0].spawner;
  assert.equal(spent.active, false, 'sprung');
  assert.equal(h.droppedLoot._piles.length, 1);
  const at = localAt(h, 97, 100, h.droppedLoot._piles[0].pos);
  h.droppedLoot.seedPile([{ name: 'Dagger' }], worldAt(h, 97, 100, [300, 50, 300]), { archive: 205, record: 0 }, null, '97,100');   // a loose pile on the same pixel: CollectLooseObjects' own
  h.cross(101, 100);
  assert.equal(h.built.has('97,100'), false, 'the port frees the pixel');
  assert.equal(h.carryOf('97,100')?.piles.length, 1, 'the pooled terrain keeps ITS pile - the loose one is collected, as DFU destroys it');
  assert.equal(h.droppedLoot._piles.length, 0, 'and none stands in the world, as an inactive terrain\'s child does not');
  h.cross(100, 100);
  const back = h.publish(97, 100, [[400, 50, 400]]);
  await flush();
  assert.equal(back.wodSpawners[0].spawner, spent, 'the same marker, spent');
  assert.equal(h.carryOf('97,100'), undefined, 'the carry is spent by the build that adopted it');
  assert.deepEqual(h.droppedLoot._piles.map((p) => localAt(h, 97, 100, p.pos)), [at], 'the pile where it lay');
  // two steps out: the slot goes, and the site comes back new
  h.cross(101, 100); h.cross(102, 100);
  assert.equal(h.carryOf('97,100'), undefined, 'recycled - dropped');
  h.cross(101, 100); h.cross(100, 100);
  const fresh = h.publish(97, 100, [[400, 50, 400]]);
  await flush();
  assert.equal(fresh.wodSpawners[0].spawner.active, true, 'a new marker');
  assert.equal(h.droppedLoot._piles.length, 0, 'and no pile');
});

test('AUDIT BRANCH (WoD) m1: a pile whose art lands late lands on what holds its terrain - after a recentre, after a rebuild, while pooled, and nowhere once the terrain is gone', async () => {
  const cases = {};
  for (const what of ['recentre', 'rebuild', 'pool', 'recycle', 'promoted']) {
    const h = host();
    h.cold(true);
    springCamp(h);
    if (what === 'recentre') { h.state.compensation[0] -= 819.2; h.droppedLoot.offsetAll([-819.2, 0, 0]); }
    if (what === 'rebuild') { h.destroyPixel(97, 100, { collectLoose: false }); h.publish(97, 100, [[400, 50, 400]]); }
    if (what === 'pool') h.cross(101, 100);
    if (what === 'recycle') { h.cross(101, 100); h.cross(102, 100); }
    if (what === 'promoted') { h.cross(101, 100); h.cross(102, 100); h.cross(101, 100); h.cross(100, 100); h.publish(97, 100, [[400, 50, 400]]); }
    h.release(); await flush();
    cases[what] = { world: h.droppedLoot._piles.map((p) => localAt(h, 97, 100, p.pos)), carried: h.carryOf('97,100')?.piles.length ?? 0 };
  }
  const lay = [[400, 49.42, 400]];   // the marker's ground, the pile's base
  assert.deepEqual(cases.recentre, { world: lay, carried: 0 }, 'pixel-local: the recentre that moved the world moved it too (it was 819.2 off)');
  assert.deepEqual(cases.rebuild, { world: lay, carried: 0 }, 'the rebuilt pixel is the same terrain (it was dropped)');
  assert.deepEqual(cases.pool, { world: [], carried: 1 }, 'a pooled terrain keeps it');
  assert.deepEqual(cases.recycle, { world: [], carried: 0 }, 'a recycled one takes it with it');
  assert.deepEqual(cases.promoted, { world: [], carried: 0 }, 'and a pixel promoted afresh in its place is another terrain');
});

test('WOD6 (AUDIT BRANCH m3, as DFU orders it): an arrival\'s markers meet Start from the scene origin, where InitWorld holds the player - a camp at the landing is still live and springs on the first steps; a pixel promoted later measures from the player', () => {
  const h = host();
  h.arrival([{ px: 100, py: 100 }]);
  const far = [700, 50, 700];   // ~990 from the origin of the arrival frame
  const p = h.publish(100, 100, [far]);
  const orig = Math.random; Math.random = () => 0.1;
  try {
    h.arriving(true);
    h.player.pos = worldAt(h, 100, 100, [far[0], far[1] - 0.9, far[2]]);   // where the port's player stands in a re-anchored frame - it does not count
    h.tick();
    assert.deepEqual([p.wodSpawners[0].spawner.started, p.wodSpawners[0].spawner.active], [true, true], 'Start measured from the origin: live, however near the stale player stood');
    h.tick();
    assert.equal(p.wodSpawners[0].spawner.active, true, 'and every Update of the arrival from the origin too');
    h.arriving(false);
    h.tick();
    assert.equal(p.wodSpawners[0].spawner.active, false, 'the player lands beside it: it springs on the first frame, as DFU\'s does');
    // a pixel promoted after the arrival is no part of it: Start from the player, within 300, spends it
    const q = h.publish(101, 100, [[20, 50, 20]]);
    h.player.pos = worldAt(h, 101, 100, [20, 49.1, 200]);
    h.tick();
    assert.deepEqual([q.wodSpawners[0].spawner.started, q.wodSpawners[0].spawner.active], [true, false], 'Start from the player: spent');
  } finally { Math.random = orig; }
  // the latch is the arrival's own: up at the teleport's head, down in a `finally` once the destination has built,
  // with nothing awaited between that and the player standing
  assert.match(WORLD, /const arriving = _seasonStraightening \|\| _loading \|\| _recalling;/, 'a load or a recall lands the player last');
  const tp = WORLD.slice(WORLD.indexOf('  async function _teleportToPixel('));
  const up = tp.indexOf('_seasonStraightening = true;');
  const sweep = tp.indexOf('wodCarry.clear();');
  const down = tp.indexOf('try { dest = await buildPixel(first.px, first.py); }\n    finally { _seasonStraightening = false; }');
  const stand = tp.indexOf('if (walkMode) { player.spawn(pos[0], pos[1], pos[2]); playerSpawned = true; }');
  assert.ok(up > 0 && up < sweep && sweep < down && down < stand, 'raised before the sweep, lowered after the build, before the stand');
  assert.doesNotMatch(tp.slice(down + 20, stand), /\bawait\b/, 'no await between the build landing and the player standing');
  assert.match(WORLD, /queue\.push\(\.\.\.state\.init\(px, py\)\);\n[^\n]*\n    _wodArrival = wodArrivalOf\(queue\);/, 'every sweep\'s first grid is the arrival\'s');
  assert.match(WORLD, /const queue = state\.init\(startPixel\.x, startPixel\.y\);\n[^\n]*\n  _wodArrival = wodArrivalOf\(queue\);/, 'and the first world\'s');
  assert.match(WORLD, /state\.release\(u\.px, u\.py\);\n        _wodArrival\.keys\.delete\(`\$\{u\.px\},\$\{u\.py\}`\);/, 'a pixel that leaves range is promoted afresh when it returns');
  assert.match(WORLD, /for \(const q of \[_wodArrival\.origin, _wodArrival\.loadAt\]\) if \(q\) \{ q\[0\] \+= r\.offset\[0\];/, 'the origin rides the floating origin');
});

test('WOD6: a load raises OnLoad last - every started marker within 300 of the loaded player deactivates, and a marker whose Start comes later hears it as Start runs (CheckPlayerDistance_OnLoad)', () => {
  const h = host();
  h.arrival([{ px: 100, py: 100 }, { px: 101, py: 100 }]);
  const a = h.publish(100, 100, [[700, 50, 700], [150, 50, 700]]);
  h.arriving(true);
  h.tick();   // both Start from the origin, far: live
  assert.deepEqual(a.wodSpawners.map((w) => w.spawner.active), [true, true]);
  const loaded = worldAt(h, 100, 100, [700, 50, 500]);   // 200 from the first marker, ~580 from the second
  h.onLoad(loaded);
  assert.deepEqual(a.wodSpawners.map((w) => w.spawner.active), [false, true], 'within 300 of the loaded player: spent; beyond it: live');
  const b = h.publish(101, 100, [[10, 50, 500]]);   // built after the load, within 300 of the loaded player (~180 away)
  h.arriving(false);
  h.player.pos = worldAt(h, 100, 100, [100, 49.1, 100]);
  h.tick();
  assert.deepEqual([b.wodSpawners[0].spawner.started, b.wodSpawners[0].spawner.active], [true, false], 'its Start ran from the origin, then it heard OnLoad');
  assert.match(WORLD, /cityGuards\.restoreWorld\(restandRows\(w\.guards\)[^\n]*\n[^\n]*OnLoad[^\n]*\n        \{ const s = walkMode && playerSpawned; const f = s \? player\.pos : cam\.pos; wodOnLoad\(/, 'the quickload raises it after the pools are back');
  assert.match(WORLD, /wodOnLoad\(walkMode \? \[lx, ly \+ player\.height \/ 2, lz\] : cam\.pos\);   \/\/ WOD6: StartFromClassicSave raises OnLoad too/, 'and the classic import');
  // the C#'s own boundary, `dist <= 300f`: at 300 it deactivates; nothing else moves
  const at = new WodSpawner({ spawnType: 2 }); at.onLoad(300);
  const past = new WodSpawner({ spawnType: 2 }); past.onLoad(300.001);
  assert.deepEqual([at.active, past.active, at.started, at.spawnFinished], [false, true, false, false]);
});

test('WOD6: a marker standing unstarted when the load lands hears OnLoad as its Start runs - never before it', () => {
  const h = host();
  h.arrival([{ px: 100, py: 100 }, { px: 101, py: 100 }]);
  h.publish(100, 100, [[700, 50, 700]]);
  h.arriving(true);
  h.tick();
  const c = h.publish(101, 100, [[10, 50, 500]]);   // built, its Start not yet run
  h.onLoad(worldAt(h, 100, 100, [700, 50, 500]));
  assert.deepEqual([c.wodSpawners[0].spawner.started, c.wodSpawners[0].spawner.active], [false, true], 'not subscribed yet: it heard nothing');
  h.tick();
  assert.deepEqual([c.wodSpawners[0].spawner.started, c.wodSpawners[0].spawner.active], [true, false], 'Start from the origin, then OnLoad at the loaded player');
});

test('WOD6 (audit): a pixel is the arrival\'s until its first frame - a marker made on it by a later rebuild meets Start from the player, not from an origin the player has left', () => {
  const h = host();
  h.arrival([{ px: 100, py: 100 }]);
  h.publish(100, 100, [[700, 50, 700]]);
  h.arriving(true);
  h.tick();   // the promotion's Start, from the origin
  h.arriving(false);
  h.destroyPixel(100, 100, { collectLoose: false });   // a late region's rebuild: a new site, new markers
  const q = h.publish(100, 100, [[640, 50, 660]]);   // ~920 from the corner; a new centre, so no carried marker
  h.player.pos = worldAt(h, 100, 100, [640, 49.1, 650]);   // beside the new camp
  const orig = Math.random; Math.random = () => 0.1;
  try { h.tick(); } finally { Math.random = orig; }
  assert.deepEqual([q.wodSpawners[0].spawner.started, q.wodSpawners[0].spawner.active], [true, false], 'Start from the player, within 300: stood down, never sprung at their feet');
  assert.equal(h.droppedLoot.piles?.length ?? 0, 0);
  assert.match(WORLD, /destroyPixel\(next\.px, next\.py, \{ collectLoose: false \}\);\n      _wodArrival\.keys\.delete\(`\$\{next\.px\},\$\{next\.py\}`\);\n      state\.release\(next\.px, next\.py\);/, 'a build that failed is torn down with its key, and is no longer the arrival\'s');
  assert.match(WORLD, /reposition: REPOSITION\.RandomStartMarker \}\);\n[^\n]*\n          \{ const s = walkMode && playerSpawned; const f = s \? player\.pos : cam\.pos; wodOnLoad\(/, 'the online underground wake is a load: OnLoad last');
});

test('WOD6 (dungeon loads): an arrival that lands INSIDE runs no marker - DFU\'s Exterior is off, so they hear no OnLoad and meet Start on the way out, from the player at the door', () => {
  const h = host();
  h.arrival([{ px: 100, py: 100 }]);
  h.inside(true);   // a load into a dungeon: the teleport builds the exterior over frames of it
  const p = h.publish(100, 100, [[640, 50, 660]]);   // ~920 from the corner, beside the dungeon's door
  h.player.pos = worldAt(h, 100, 100, [640, 49.1, 650]);
  h.tick();
  h.onLoad(worldAt(h, 100, 100, [640, 50, 650]));
  assert.deepEqual([p.wodSpawners[0].spawner.started, p.wodSpawners[0].spawner.active], [false, true], 'nothing runs, nothing hears the load');
  // the first frame inside ends the arrival (world.js's frame, pinned below); out of the door, Start from the player
  h.inside(false); h.arrival([]);
  const orig = Math.random; Math.random = () => 0.1;
  try { h.tick(); } finally { Math.random = orig; }
  assert.deepEqual([p.wodSpawners[0].spawner.started, p.wodSpawners[0].spawner.active], [true, false], 'Start from the player at the door, within 300: stood down');
  assert.match(WORLD, /if \(modes\.frame\(dt, now\)\) \{\n      if \(_wodInside\) \{ _wodInside = false; _wodArrival = wodArrivalOf\(\[\]\); \}/);
  assert.match(WORLD, /if \(!wod \|\| _wodInside\) return;/);
  assert.match(WORLD, /_wodInside = plan\.arrive === 'dungeon' \|\| plan\.arrive === 'building';[^\n]*\n      await _teleportToPixel\(a\.pixel\.x, a\.pixel\.y\);/, 'a recall inside');
  assert.match(WORLD, /_wodInside = !!extras\.interior;[^\n]*\n        await _teleportToPixel\(w\.pixel\.x, w\.pixel\.y/, 'a load inside a building');
  assert.match(WORLD, /_wodInside = true;[^\n]*\n          await _teleportToPixel\(pixel\.x, pixel\.y, null, \{ modEvent: 'load' \}\);/, 'a load inside a dungeon');
  assert.match(WORLD, /_wodInside = true;[^\n]*\n      await _teleportToPixel\(pos\.x, pos\.y\);/, 'the vampire\'s crypt');
  assert.equal((WORLD.match(/_wodInside = false;/g) ?? []).length, 6, 'the declaration, the frame inside, and each of the four arrivals that lands outside after all');
});

test('WOD7: a marker a peer sprang never springs here - its camp is theirs, and everyone\'s; one I spring is mine, online', () => {
  const h = host({ online: { id: 'mmmm-0002' } });
  const p = h.publish(100, 100, [[400, 50, 400], [420, 50, 400]]);   // two treasure markers, oids 1 and 2
  h.peerSprung.add('100,100:1');
  h.player.pos = worldAt(h, 100, 100, [410, 49.1, 800]);   // far: Start leaves both live
  const orig = Math.random; Math.random = () => 0.1;
  try { h.tick(); h.player.pos = worldAt(h, 100, 100, [410, 49.1, 390]); h.tick(); } finally { Math.random = orig; }   // then within 100 of both
  assert.equal(p.wodSpawners[0].spawner.active, false, 'the peer\'s marker is spent');
  assert.equal(p.wodSpawners[0].spawner.started, false, 'and never ran: no Start, no spring, no pile of mine');
  assert.deepEqual([...h.sprung.keys()], ['100,100:2'], 'the other I sprang - mine now, on my next full frame');
  assert.ok(h.sprungChanged());
});

test('WOD6: the pixels a late region names are built again on the list in its order - those standing now, nearest first; one still building once it stands; the player\'s own under the season hold', () => {
  const i = WORLD.indexOf('  const _wodLate = new Set();');
  const j = WORLD.indexOf('  // LocationLoader.cs:146-151', i);
  assert.ok(i > 0 && j > i);
  const wod = {};
  const built = new Map([['5,5', { px: 5, py: 5 }], ['7,5', { px: 7, py: 5 }], ['6,6', { px: 6, py: 6 }]]);
  const inFlight = new Map([['9,9', {}]]);
  const destroyed = [], queue = [], logs = [];
  const h = new Function('wod', 'built', 'inFlight', 'state', 'walkMode', 'playerSpawned', 'destroyPixel', 'queue', 'console',
    `let _seasonHoldKey = null;\n${WORLD.slice(i, j)}\nreturn { sweepWodLate, late: _wodLate, hold: () => _seasonHoldKey };`)(
    wod, built, inFlight, { current: { x: 5, y: 5 } }, true, true, (px, py, o) => destroyed.push(`${px},${py}:${JSON.stringify(o)}`), queue, { log: (m) => logs.push(m) });
  wod.onLate(16, new Set(['7,5', '5,5', '9,9', '40,40']));
  h.sweepWodLate();
  assert.deepEqual(destroyed.sort(), ['5,5:{"collectLoose":false}', '7,5:{"collectLoose":false}'], 'torn down with their loose piles kept - the carry keeps the markers');
  assert.deepEqual(queue, [{ px: 5, py: 5 }, { px: 7, py: 5 }], 'queued nearest first');
  assert.equal(h.hold(), '5,5', 'the player\'s own pixel rebuilds under the season hold');
  assert.deepEqual([...h.late], ['9,9'], 'one still building waits until it stands; one neither standing nor building builds on the list as it is');
  built.set('9,9', { px: 9, py: 9 }); inFlight.delete('9,9');
  h.sweepWodLate();
  assert.deepEqual(queue.at(-1), { px: 9, py: 9 });
  assert.equal(h.late.size, 0);
  assert.equal(logs.length, 2);
  assert.match(WORLD, /if \(_wodLate\.size && !building\) sweepWodLate\(\);   \/\/ WOD6/, 'between builds, every frame');
});

test('AUDIT BRANCH (WoD) m4: a sweep while a rebuild is in flight is heard - the carry is adopted at publish, so the old roll never stands in the new world', () => {
  const h = host();
  const p = h.publish(100, 100, [[10, 5, 10]]);
  p.wodSpawners[0].spawner.active = false;   // spent
  h.destroyPixel(100, 100, { collectLoose: false });   // a season re-skin's teardown
  assert.ok(h.carryOf('100,100'), 'the rebuild\'s carry');
  h.sweep(100, 100);   // a load at the same spot, the rebuild still in flight
  assert.equal(h.publish(100, 100, [[10, 5, 10]]).wodSpawners[0].spawner.active, true, 'fresh, as ClearStreamingWorld re-promotes');
  assert.doesNotMatch(WORLD, /const carried = wodCarry\.get\(key\) \?\? null;   \/\/ WOD3\/WOD4: what a rebuild/, 'no build reads the carry at its start');
  assert.match(WORLD, /    const wodKept = adoptWodCarry\(key, wodSpawners, privateersHold\);\n    const wodLife = wodKept\.life \?\? \{\};[^\n]*\n    if \(!wodKept\.life\) wodForgetPeerSites\(key\);[^\n]*\n    if \(_building\.get\(key\) === made\) _building\.delete\(key\);[^\n]*\n    built\.set\(key, \{/, 'nothing awaited between the adoption and built.set (BUILD-FAIL1\'s hand-over and WOD7\'s forget are the lines between)');
});

test('AUDIT BRANCH (WoD) m2: a rebuild of a pixel that had a site re-reads its grass - Basic Roads can forbid a site stood before its data landed', () => {
  const h = host();
  h.publish(100, 100, [[10, 5, 10]], { wodSite: { xMin: 1, xMax: 2, yMin: 1, yMax: 2 } });
  h.destroyPixel(100, 100, { collectLoose: false });
  assert.ok(h.siteWas.has('100,100'), 'the teardown remembers the site');
  assert.match(WORLD, /const hadWodSite = _wodSiteWas\.delete\(key\);[^\n]*\n    if \(\(dfLocation \|\| wodSite \|\| hadWodSite\) && labGrassField\) \{/, 'and the publish re-reads the grass for it');
});

test('AUDIT BRANCH (WoD) L1-3: the host steps DFU\'s array on every crossing and at every world\'s start, and the Hold does not ride the pool', () => {
  assert.match(WORLD, /if \(wod\) for \(const k of wodSlots\.step\(r\.current\.x, r\.current\.y, state\.terrainDistance, StreamingWorldState\.onMap\)\.recycled\) wodCarry\.delete\(k\);\n      for \(const u of r\.unload\) \{/, 'the crossing, before its unloads');
  assert.match(WORLD, /const queue = state\.init\(startPixel\.x, startPixel\.y\);\n  if \(wod\) wodSlots\.step\(startPixel\.x/, 'the first world');
  assert.match(WORLD, /queue\.push\(\.\.\.state\.init\(px, py\)\);\n    if \(wod\) wodSlots\.step\(px, py,/, 'every swept world');
  assert.match(WORLD, /if \(p\.wodSpawners && wodSlots\.has\(key\)\) \{[\s\S]{0,400}carryWodSite\(p, key, \{ piles \}\);/, 'an unload pools the site alone - no hold');
  assert.match(WORLD, /if \(collectLoose && p\.privateersHold\) \{ p\.privateersHold\.state\.gone = true;/, 'the Hold\'s foes still go with the block');
});

// ── Numbers and words ───────────────────────────────────────────────────

test('AUDIT BRANCH (WoD) n: the numbers the docs state are the numbers the tree holds', () => {
  const loc = JSON.parse(rd('vendor/world-of-daggerfall/locations.json'));
  const xml = loc.regions.reduce((a, r) => a + r.files.reduce((b, f) => b + f[1], 0), 0);
  assert.equal(xml, 61000862, 'the XML the packs replace');
  assert.match(rd('vendor/world-of-daggerfall/README.md'), /They are 61\.0 MB of XML/);
  assert.match(rd('src/world/wodLocationPack.js'), /61\.0 MB/);
  assert.doesNotMatch(rd('src/ui/credits.js'), /stood at 227,938 places/, 'the lists NAME 227,938 places; one site stands to a pixel');
  const dirs = readdirSync(join(ROOT, 'vendor'), { withFileTypes: true }).filter((d) => d.isDirectory()).length;
  const reg = rd('bible/01-Overview/Mod-Registry.md');
  const open = reg.split('\n').filter((l) => /^\| `[^`]+` \|/.test(l) && /RECORD OPEN/.test(l)).length;
  assert.match(reg, new RegExp(`\`vendor/\` holds ${dirs} directories and ${open} of their READMEs`), `the registry counts ${dirs} and ${open}`);
  assert.match(rd('src/world/wodLocationLoader.js'), /Four pieces, each pure:/);
});

test('AUDIT BRANCH (WoD) n: the asset tool writes each TextAsset\'s own bytes - the decoded text drops a byte-order mark', () => {
  const src = rd('tools/worldOfDaggerfallAssets.mjs');
  assert.match(src, /body: t\.bytes \? Buffer\.from\(t\.bytes\) : Buffer\.from\(t\.text \?\? '', 'utf8'\),/);
  assert.equal(typeof readWorldOfDaggerfallBundle, 'function');
  const bom = new Uint8Array([0xef, 0xbb, 0xbf, 0x41]);
  assert.equal(new TextDecoder('utf-8').decode(bom).length, 1, 'the decoder strips it - what the tool used to write');
  assert.equal(Buffer.from(bom).length, 4, 'the bytes keep it');
});
