// FIELD BUGS 2026-10-21c, the record's Left ("my own boats' Animators ... still stepped every frame") and BOAT-FAR's
// "what it still pays" (bible/07-Rendering/Performance-Priority.md BOAT-OWN, HELD-DRAW and HELD-FLATS).
//
// BOAT-OWN: MY OWN BOATS LIVE BY THE FAR LAW. The Come Sail Away runtime stepped every Animator and particle system of
// every boat the player owns every frame at any range (systems/comeSailAway/comeSailAway.js animate,
// simulateParticles); now through the module it wires (scenes/comeSailAway/farLife.js createBoatLives), past
// NEAR_LIFE_M of the pool's eye one frame in FAR_LIFE_EVERY on the time she missed - the peers' boats' law. And A SHIP'S
// TREE (farTreeStep): one switched or reshaped since she last lived lives that frame - mine, a peer's, the pool's walk.
// HELD-DRAW: a held boat's parts are the ones her walk's draw found - drawn where she stands, never read again until she
// lives. HELD-FLATS: a held boat's flat keeps the scale her walk found and only its place is made - placed()'s own floats.
// The real runtime and SpawnBoat over the vendored hulls (test/csaScene.mjs), the real pool and peers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scene } from '../../csaScene.mjs';
import { createComeSailAwayPool, STILL_FRAMES } from '../../../src/scenes/comeSailAway/comeSailAwayPool.js';
import { createComeSailAwayPeers } from '../../../src/scenes/comeSailAway/comeSailAwayPeers.js';
import { NEAR_LIFE_M, FAR_LIFE_EVERY, farLife, farTreeStep } from '../../../src/scenes/comeSailAway/farLife.js';
import { Boat, boatAnimators, boatParticleSystems, setLights } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { HULL } from '../../../src/systems/naval/navalShips.js';
import { PrefabNode } from '../../../src/world/prefabNode.js';
import { invertAffine } from '../../../src/world/prefabColliders.js';
import { multiply } from '../../../src/world/mat4.js';
import { liveryCode, LIVERY_ARCHIVE } from '../../../src/systems/naval/shipLivery.js';

const D = 0.02;
const close = (a, b) => Math.abs(a - b) < 1e-9;
/** The runtime's scene (csaScene.mjs), Time.deltaTime D, the pool's eye `eye.at` (null: none), and boats of mine placed
 *  where `xs` say (hull 1, the Large Boat: seventeen Animators, ten particle systems). */
function fleet(xs, eye) {
  const s = scene();
  s.deps.dt = () => D;
  s.deps.pool.lifeEye = () => eye.at;
  const boats = xs.map((x) => s.rt.PlaceBoat([x, 34, 200], [0, 0, 1], 1, 0, s.terrains[0]));
  return { s, boats, frame: () => s.rt.lateUpdate({ paused: false }) };
}
/** Every Animator's update and particle system's step of each boat, logged by frame: `[frame, dt]`. */
function spyLives(boats, at) {
  const logs = new Map();
  for (const b of boats) {
    const log = { a: [], p: [] };
    logs.set(b, log);
    for (const a of boatAnimators(b)) { const up = a.update.bind(a); a.update = (dt) => { log.a.push([at.frame, dt]); up(dt); }; }
    for (const p of (b.particleSystems ??= boatParticleSystems(b))) { const st = p.step.bind(p); p.step = (dt) => { log.p.push([at.frame, dt]); st(dt); }; }
  }
  return logs;
}
/** The frames a log stepped on, and the time of each. */
const framesOf = (log) => [...new Set(log.map(([f]) => f))];
const timesOf = (log) => [...new Set(log.map(([, dt]) => dt))];

test(`BOAT-OWN my own boats: past NEAR_LIFE_M of the pool's eye a boat's Animators and particle systems step one frame in FAR_LIFE_EVERY on the time she missed - none of it lost - each boat on her own frame of the stride, her particles with her Animators; a near one every frame on its own time; with no eye every boat every frame, as before (mutants: the pool's eye unread, the range unread, the missed time dropped, every boat one frame of the stride, the particles on their own, the particles every frame, the frame's time unhanded)`, () => {
  const eye = { at: [100, 34, 200] };
  const { boats: [nearB, far, far2], frame } = fleet([100, 100 + NEAR_LIFE_M + 400, 100 + NEAR_LIFE_M + 900], eye);
  const at = { frame: 0 };
  for (let i = 0; i < FAR_LIFE_EVERY * 2; i++) frame();   // each past her first frame (she lives the frame she is placed: her tree is new)
  const logs = spyLives([nearB, far, far2], at);
  const N = FAR_LIFE_EVERY * 3;
  for (at.frame = 0; at.frame < N; at.frame++) frame();
  const n = boatAnimators(nearB).length, ps = nearB.particleSystems.length;
  assert.ok(n > 10 && ps > 5, `she carries Animators and particle systems (${n}, ${ps})`);
  const ln = logs.get(nearB);
  assert.equal(ln.a.length, N * n, 'near: every Animator every frame');
  assert.equal(ln.p.length, N * ps, 'and every particle system');
  assert.deepEqual(timesOf([...ln.a, ...ln.p]), [Math.fround(D)], 'on this frame\'s time');
  for (const b of [far, far2]) {
    const l = logs.get(b), on = framesOf(l.a);
    assert.equal(on.length, N / FAR_LIFE_EVERY, `far (${on}): one frame in ${FAR_LIFE_EVERY}`);
    assert.ok(on.every((f, i) => !i || f - on[i - 1] === FAR_LIFE_EVERY), 'on her stride');
    assert.equal(l.a.length, on.length * n, 'every Animator of hers on those frames');
    assert.ok(timesOf(l.a).every((dt) => close(dt, FAR_LIFE_EVERY * Math.fround(D))), `on the time she missed (${timesOf(l.a)})`);
    assert.deepEqual(framesOf(l.p), on, 'her particle systems on her frames, none between');
    assert.equal(l.p.length, on.length * ps);
    assert.ok(timesOf(l.p).every((dt) => close(dt, FAR_LIFE_EVERY * Math.fround(D))), 'on the same time');
  }
  assert.notDeepEqual(framesOf(logs.get(far).a), framesOf(logs.get(far2).a), 'each far boat on her own frame of the stride');
  // no eye to judge her by: every boat every frame
  eye.at = null;
  for (const l of logs.values()) { l.a.length = 0; l.p.length = 0; }
  for (at.frame = 0; at.frame < N; at.frame++) frame();
  for (const b of [nearB, far, far2]) assert.deepEqual([logs.get(b).a.length, logs.get(b).p.length], [N * n, N * ps], 'no eye: every frame');
});

test('BOAT-OWN A SHIP\'S TREE (farTreeStep): a far boat of mine switched off lives that frame - her Animators note it - and switched on lives that frame, her rudder started over from its default state then, as an every-frame boat\'s is; an Animator hung on her (her tree reshaped) steps the frame it is hung; on every frame of her stride; no switch and no reshape, and she keeps her stride (mutants: the switches unread, the shape unread, the stamps never kept)', () => {
  const eye = { at: [100, 34, 200] };
  const { boats: [far], frame } = fleet([100 + NEAR_LIFE_M + 400], eye);
  const rudder = boatAnimators(far).find((a) => a.node.name === 'RudderObject');
  const lived = () => { let n = 0; const up = rudder.update.bind(rudder); rudder.update = (dt) => { n++; up(dt); }; return () => { const k = n; n = 0; return k; }; };
  const steps = lived();
  for (let i = 0; i < FAR_LIFE_EVERY * 2; i++) frame();
  steps();
  for (let phase = 0; phase < FAR_LIFE_EVERY; phase++) {
    rudder.Play('Sailing');
    for (let i = 0; i < FAR_LIFE_EVERY; i++) frame();   // past her next life: the Play taken
    assert.equal(rudder.stateName, 'Sailing', `(${phase}) played out of her default state`);
    for (let k = 0; k < phase; k++) frame();   // each switch on another frame of her stride
    steps();
    far.GameObject.setActive(false);   // UpdateBoatVisibility's root switch
    frame();
    assert.equal(steps(), 1, `(${phase}) switched off: she lives that frame`);
    far.GameObject.setActive(true);
    frame();
    assert.equal(steps(), 1, `(${phase}) switched on: she lives that frame`);
    assert.equal(rudder.stateName, 'Disembarked', `(${phase}) her rudder started over from its default state that frame`);
    // an Animator hung on her: her tree reshaped, she lives the frame it is hung, the new one with her
    const seen = [];
    new PrefabNode(`BoatOwnProbe${phase}`, { components: [{ type: 'Animator', animator: { update: (dt) => seen.push(dt) } }] }).setParent(far.MeshObject);
    frame();
    assert.equal(seen.length, 1, `(${phase}) an Animator hung on her steps the frame it is hung`);
    assert.equal(steps(), 1, `(${phase}) and her own with it`);
  }
  // nothing switched, nothing hung: one frame in FAR_LIFE_EVERY again
  let n = 0;
  for (let i = 0; i < FAR_LIFE_EVERY * 3; i++) { frame(); n += steps(); }
  assert.equal(n, 3, 'her stride as before');
  // the law's own cases: a tree never lived yet lives (farLife's stamps none), one that stands keeps the stride
  const root = new PrefabNode('LawProbe'), life = farLife(1), far3 = [0, 0, 5000];
  assert.equal(farTreeStep(life, D, root, far3, [0, 0, 0]), D, 'her first frame: lived');
  assert.deepEqual([1, 2, 3].map(() => farTreeStep(life, D, root, far3, [0, 0, 0]) !== null), [false, false, true], 'then her stride (her frame of it, farLife(1)\'s)');
});

const Q = [0, Math.sin(0.25), 0, Math.cos(0.25)];
const word = (o = {}) => [o.hull ?? 2, 0, o.x ?? 10, 34, o.z ?? 20, ...Q, 0, o.helm ?? 1, 0];
const fileFetch = async (url) => {
  const bytes = readFileSync(fileURLToPath(url));
  return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
};
const plank = { width: 4, height: 4, data: new Uint8Array(16).fill(9) };   // every record a 4 x 4 plank (shiplivery.test.js's), for her paint
const texture = () => ({ recordCount: 100, getSize: () => ({ width: 40, height: 64 }), getScale: () => ({ width: 0, height: 0 }), getDFBitmap: () => plank });
const standInPipeline = () => ({ textureFiles: { get: () => texture() }, cpuModels: new Map(), gpuMeshes: new Map(), getTexture: async () => texture(), uploadRecord() {}, getGpuMesh: async (id) => ({ classic: id }),
  palette: { getRed: (i) => i * 10, getGreen: (i) => i * 8, getBlue: (i) => i * 6 } });
const settle = () => new Promise((r) => setTimeout(r, 5));
/** fb1021_boats.test.js's pool: a renderer that records each draw (its mesh, matrix and remap - her paint) and each flat it
 *  stands, and takes a livery's pictures (the paint shop's upload). */
async function recordingPool() {
  const log = { drawn: [], flats: [] };
  const renderer = {
    createMesh: (model) => ({ model, buffers: [{}, {}], bounds: [0, 0, 0, 0], subMeshes: model.subMeshes.map((s) => ({ ...s })) }),
    drawMesh: (mesh, matrix, remap) => log.drawn.push({ mesh, matrix: Float32Array.from(matrix), remap }), updateMeshVertices() {}, uploadTexture() {},
    createBillboardBatch: (a, rec, size) => { const b = { a, rec, size }; log.flats.push(b); return b; }, destroyBillboardBatch() {}, destroyMesh() {},
  };
  const pool = createComeSailAwayPool({ renderer, pipeline: standInPipeline(), fetchFn: fileFetch, log: { warn() {} } });
  assert.equal(await pool.preload(), true);
  return { pool, log };
}

test('BOAT-OWN a peer\'s far boat hidden or shown lives that frame (farTreeStep) - her door starts over from its default state the frame her owner is shown, on every frame of her stride, as SEA-TOWN HIDDEN\'s near one does (mutant: the peers\' tree unread)', async () => {
  const { pool } = await recordingPool();
  const peers = createComeSailAwayPeers({ pool, selfId: () => 'me', log: { warn() {} } });
  let look = null;
  peers.setPeerLook(() => look);
  peers.applyOwner('ann', { b: [word()] }, (p) => p, 0);
  const eye = [10 + NEAR_LIFE_M + 500, 0, 20];   // the pool's eye far off her
  for (let i = 0; i < 6 && !pool.peerBoats.length; i++) peers.frame(1 / 60, eye);
  const [boat] = pool.peerBoats;
  assert.ok(boat, 'her boat built');
  const door = boatAnimators(boat).find((a) => a.node.name === 'CastleDoor');
  for (let phase = 0; phase < FAR_LIFE_EVERY; phase++) {
    door.Play('Opened');
    for (let i = 0; i < FAR_LIFE_EVERY; i++) peers.frame(1 / 60, eye);
    assert.equal(door.stateName, 'Opened', `(${phase}) her door played open`);
    for (let k = 0; k < phase; k++) peers.frame(1 / 60, eye);
    look = 'hidden';
    peers.frame(1 / 60, eye);
    assert.equal(boat.GameObject.activeSelf, false, 'under a hidden owner she stands nowhere');
    look = null;
    peers.frame(1 / 60, eye);
    assert.equal(door.stateName, 'Closed', `(${phase}) shown: her door started over that frame`);
  }
});

/** Each of the boat's part renderers counts its reads while `on()` says so (the draw's own reads of them). */
function rendererReads(pool, boat) {
  let n = 0, counting = false;
  for (const e of pool.walkOf(boat).plan.parts) {
    let v = e.mr.m_Enabled;
    Object.defineProperty(e.mr, 'm_Enabled', { configurable: true, get() { if (counting) n++; return v; }, set(x) { v = x; } });
  }
  return { during: (fn) => { counting = true; try { fn(); } finally { counting = false; } const k = n; n = 0; return k; } };
}
/** How often the boat's root's children are read while `fn` runs - a walk of her reads them (fb1021_boats.test.js's). */
function walkedIn(boat, fn) {
  let reads = 0;
  const kids = boat.GameObject.children;
  Object.defineProperty(boat.GameObject, 'children', { configurable: true, get() { reads++; return kids; } });
  try { fn(); } finally { delete boat.GameObject.children; boat.GameObject.children = kids; }
  return reads > 0;
}
/** The meshes a draw drew, counted by identity. */
const meshCount = (drawn) => { const m = new Map(); for (const d of drawn) m.set(d.mesh, (m.get(d.mesh) ?? 0) + 1); return m; };
/** The remap each mesh a draw drew was drawn by, and whether a remap carries a livery's paint. */
const remapOf = (drawn) => new Map(drawn.map((d) => [d.mesh, d.remap]));
const painted = (remap) => !!remap && [...remap.values()].some((v) => String(v).startsWith(`${LIVERY_ARCHIVE}_`));
const near = (a, b, eps = 1e-3) => a.length === b.length && [...a].every((v, i) => Math.abs(v - b[i]) < eps);

test('HELD-DRAW: a held boat\'s parts are the ones her walk\'s draw found - on a frame that holds her the draw reads none of her renderers and draws the very meshes it drew when she was walked, each where it stands now and in her livery as it drew them; a near boat\'s are read every frame, and her parts drawn where they stand as she sails; a list made over an older walk is made again (the frame that walked her drew nothing), and before any frame every draw reads her (mutants: the held list never drawn from, a list kept past her walk, a draw-made walk\'s list kept, the held parts\' paint dropped)', async () => {
  const { pool, log } = await recordingPool();
  const world = { cityLightsOn: true, playerPosition: [0, 0, 0] };
  const nearB = pool.spawnSeaNow(new Boat(HULL.SmallShip, 0)); nearB.GameObject.position = [0, 0, -50];
  const far = pool.spawnSeaNow(Object.assign(new Boat(HULL.LargeGalley, 0), { livery: liveryCode({ stain: 3, sail: 7 }) })); far.GameObject.position = [0, 0, -1000];   // SHIP-LIVERY: her planks stained, her sails tinted
  for (let i = 0; i < STILL_FRAMES * 2; i++) { pool.frame(1 / 60, world); pool.draw(); await settle(); }
  const nr = rendererReads(pool, nearB), fr = rendererReads(pool, far);
  const sail = () => {
    const p = far.GameObject.position; far.GameObject.position = [p[0] + 0.5, p[1], p[2]];
    const q = nearB.GameObject.position; nearB.GameObject.position = [q[0] + 0.3, q[1], q[2]];   // she sails too, walked every frame
  };
  const hers = (d) => Math.abs(d.matrix[14] - far.GameObject.position[2]) < 150;
  const nearOnes = (d) => Math.abs(d.matrix[14] - nearB.GameObject.position[2]) < 30;
  let lastWalked = null, lastPaint = null;
  for (let f = 0; f < FAR_LIFE_EVERY * 3; f++) {
    sail();
    const walked = walkedIn(far, () => pool.frame(1 / 60, world));
    log.drawn.length = 0;
    let nearReads = 0;
    const farReads = fr.during(() => { nearReads = nr.during(() => pool.draw()); });
    assert.ok(nearReads > 0, `near (${f}): her renderers read every frame`);
    // the near boat's parts drawn on their own each where its node stands this frame - its walk's matrix made for the draw
    const nearPlan = pool.walkOf(nearB).plan, batchMesh = pool.stillOf(nearB)?.mesh;
    const nearAlone = log.drawn.filter((d) => nearOnes(d) && d.mesh !== batchMesh);
    assert.ok(nearAlone.length > 0, `near (${f}): parts of hers drawn on their own`);
    for (const d of nearAlone) assert.ok(nearPlan.parts.some((e) => e.gpu === d.mesh && near(d.matrix, e.node.worldMatrix())), `near (${f}): each where its node stands as she sails`);
    const mine = meshCount(log.drawn.filter(hers)), paint = remapOf(log.drawn.filter(hers));
    const alone = new Set(pool.walkOf(far).draws.alone.map((e) => e.gpu));
    assert.ok(log.drawn.some((d) => hers(d) && alone.has(d.mesh) && painted(d.remap)), `far (${f}): her livery on a part of hers drawn on its own`);
    if (walked) { assert.ok(farReads > 0, `far (${f}), walked: her renderers read`); lastWalked = mine; lastPaint = paint; continue; }
    assert.equal(farReads, 0, `far (${f}), held: none of her renderers read`);
    if (!lastWalked) continue;   // held before the first walk this loop saw: read by the walk before it
    assert.deepEqual([...mine.entries()], [...lastWalked.entries()], `far (${f}), held: the very meshes her walk's draw drew`);
    for (const [mesh, remap] of paint) assert.equal(remap, lastPaint.get(mesh), `far (${f}), held: each in the very remap her walk's draw drew it by`);
  }
  // a part switched off while she is held is read as she lives - and a list made over an older walk is not drawn from:
  // the frame that walks her again draws nothing, the next draw (holding her) reads her parts again
  const part = pool.walkOf(far).plan.parts.find((e) => e.gpu && !e.chain);
  assert.ok(part, 'a part of hers drawn on its own');
  part.mr.m_Enabled = false;
  let walkedOnly = false;
  for (let i = 0; i < FAR_LIFE_EVERY * 3 && !walkedOnly; i++) {
    sail();
    if (walkedIn(far, () => pool.frame(1 / 60, world))) { walkedOnly = true; break; }   // walked: no draw this frame
    pool.draw();
  }
  assert.ok(walkedOnly, 'a frame that walked her and drew nothing');
  sail();
  assert.equal(walkedIn(far, () => pool.frame(1 / 60, world)), false, 'the next frame holds her');
  log.drawn.length = 0;
  assert.ok(fr.during(() => pool.draw()) > 0, 'held, over a walk no draw has read: her renderers read');
  assert.equal(log.drawn.some((d) => d.mesh === part.gpu), false, 'the part switched off: not drawn');
  // before any frame: every draw walks her for itself and reads her parts
  const fresh = await recordingPool();
  const b = fresh.pool.spawnSeaNow(new Boat(HULL.SmallShip, 0));
  fresh.pool.draw(); await settle();
  const r = rendererReads(fresh.pool, b);
  assert.ok(r.during(() => fresh.pool.draw()) > 0, 'a draw before any frame reads her');
  assert.ok(r.during(() => fresh.pool.draw()) > 0, 'and the next one too');
});

test('HELD-FLATS: a held boat\'s flat keeps the scale the frame that walked her found and only its place is made - to the bit where placed() stands it (her hull\'s move times her walk\'s matrix), its world rotation never climbed; a flat scaled while she is held keeps its size until her next life, then takes it, as before - its height by its own height\'s scale, not its width\'s (mutants: the held scale never kept, kept past her walk, a term of the place, the place unrounded, the height off the width\'s scale)', async () => {
  const { pool } = await recordingPool();
  const world = { cityLightsOn: true, playerPosition: [0, 0, 0] };
  const far = pool.spawnSeaNow(new Boat(HULL.SmallShip, 0)); far.GameObject.position = [0, 0, -1000];
  setLights(far, true);
  for (let i = 0; i < STILL_FRAMES; i++) { pool.frame(1 / 60, world); pool.draw(); await settle(); }
  const flats = pool.walkOf(far).plan.flats, standing = pool.batches().length;
  assert.ok(standing > 2, `her flats stand (${standing} of ${flats.length})`);
  let climbs = 0;
  for (const e of flats) e.node.lossyScaleOf = function lossyScaleOf(...a) { climbs++; return PrefabNode.prototype.lossyScaleOf.apply(this, a); };
  const sail = (f) => {
    const p = far.GameObject.position;
    far.GameObject.position = [p[0] + 0.37, p[1], p[2] + 0.11];
    const a = 0.013 * f;
    far.MeshObject.localRotation = [Math.sin(a / 2), 0, 0, Math.cos(a / 2)];   // she rolls in the swell
  };
  let held = 0, walked = 0;
  for (let f = 0; f < FAR_LIFE_EVERY * 3; f++) {
    sail(f);
    climbs = 0;
    const w = walkedIn(far, () => pool.frame(1 / 60, world));
    if (w) { walked++; assert.equal(climbs, standing, `walked (${f}): each flat's scale found`); continue; }
    held++;
    assert.equal(climbs, 0, `held (${f}): no flat's world rotation climbed`);
    // where placed() stands each: her hull's matrix now times the inverse of her walk's, times the flat's walk matrix
    const walk = pool.walkOf(far), hullWas = walk.mats[walk.nodes.indexOf(far.MeshObject)];
    const shift = multiply(far.MeshObject.worldMatrix(), invertAffine(hullWas));
    const want = flats.map((e) => multiply(shift, walk.mats[e.i]));
    for (const b of pool.batches()) {
      const hit = want.find((m) => Object.is(b.origin[0], m[12]) && Object.is(b.origin[1], m[13] - b.size.h / 2) && Object.is(b.origin[2], m[14]));
      assert.ok(hit, `held (${f}): a flat at ${b.origin.map((v) => v.toFixed(3))} stands where placed() stands one, to the bit`);
    }
  }
  assert.ok(held > 0 && walked > 0, 'frames that held her and frames that walked her');
  // a flat scaled while she is held: its size the walk's until her next life, then its own
  const until = (fn) => { for (let i = 0; i < FAR_LIFE_EVERY * 2; i++) { sail(i); if (fn(walkedIn(far, () => pool.frame(1 / 60, world)))) return true; } return false; };
  assert.ok(until((w) => w), 'walked');
  assert.ok(until((w) => !w), 'then held');
  const sizes = () => pool.batches().map((b) => b.size.h);
  const before = sizes();
  flats.find((e) => e.r?.m_Enabled !== false && e.bb.Summary.Size[0] > 0).node.localScale = [2, 3, 2];   // stretched: her height three times, her width twice
  for (let i = 0; i < FAR_LIFE_EVERY; i++) {
    sail(i);
    if (walkedIn(far, () => pool.frame(1 / 60, world))) {
      const now = sizes(), grown = now.filter((h, k) => Math.abs(h - 3 * before[k]) < 1e-4);
      assert.equal(grown.length, 1, `her next life: the scaled flat its own height, three times its walk's (${before} -> ${now})`);
      assert.equal(now.filter((h, k) => Math.abs(h - before[k]) < 1e-5).length, before.length - 1, 'every other as it was (found again from her new walk: the same to a float\'s last places)');
      return;
    }
    assert.deepEqual(sizes(), before, 'held: every flat the size her walk found');
  }
  assert.fail('never walked again');
});
