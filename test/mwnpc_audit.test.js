// AUDIT MW-NPC (2026-10-10, Mac: "Do a deep audit and ensure perfection" - bible/04-Characters/Morrowind-NPCs.md
// section 21): the findings of four cold lanes over the arc at 1fd44c83ad, each pinned where the code that fixes it
// lives - the GPU skin and the body service, the lanes and the frame budget, the populations and their hosts, the
// creatures and the special foes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assembleCreature, poseAssembly } from '../src/formats/mwFirstPerson.js';
import { skinLayout, packSkinStream, writeSkinPalette, skinStreamCorner } from '../src/formats/mwGpuSkin.js';
import { pieceLanes, createFpArm, esmLoadOrder } from '../src/combat/fpArm.js';
import { creatureModel, creatureDeps, creaRec } from './fixtures/mw/creatureRig.mjs';
import { countingRenderer } from './fixtures/mw/bodyRig.mjs';
import { foeActor, isBodyFoe, foeLook } from '../src/characters/foeBodies.js';
import { GUARD_MOBILE_TYPE } from '../src/scenes/cityGuards.js';
import { residentLook, residentWalkerActor } from '../src/characters/rosterBodies.js';
import { CREATURE_MATCH } from '../src/characters/creatureBodies.js';
import { ELITE_FOE_SIZE } from '../src/systems/eliteFoes.js';
import { createNpcBodies, createPopulationLane, createFrameBudget, NPC_BODY_TIERS, WATCH_BODY_TIERS, NPC_FRAME_TIERS } from '../src/characters/npcBodies.js';
import { creatureLook } from '../src/characters/creatureBodies.js';
import { MOBILE_TYPES as M } from '../src/characters/mobileTypes.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { PeerBodies } from '../src/net/peerBodies.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const close = (a, b, tol = 2e-5) => Math.abs(a - b) <= tol * (1 + Math.abs(b));
const flush = () => new Promise((r) => setTimeout(r, 0));

/** stub rigs that say where each drawThird fell - inside the renderer's open batch or not (mwnpc13_spectral's rig) */
function stubLane(renderer, log) {
  const rig = () => { const r = { mode: 'first', skinned: false, attach() {}, async build() { await flush(); return { ok: true }; }, canThirdPerson: () => true, raceHeightScale: () => 1, setViewMode(m) { r.mode = m; return true; }, thirdActive: () => r.mode === 'third' && r.skinned, update(dt, o) { if (o?.pose !== false) r.skinned = true; }, drawThird(_c, o) { log.push({ id: r.id, conceal: o.conceal, batched: renderer.characterSpriteBatchOpen }); return true; }, unload() {}, setSheathed() {}, revive() {} }; return r; };
  let n = 0;
  return createNpcBodies({ renderer, tier: () => 'near', createRig: () => Object.assign(rig(), { id: n++ }), now: () => 1000 });
}
/** a renderer that counts its sprite batches */
function batchingRenderer() {
  const r = { opens: 0, flushes: 0, open: false };
  Object.assign(r, {
    beginCharacterSpriteBatch() { r.opens++; r.open = true; },
    flushCharacterSpriteBatch() { r.flushes++; r.open = false; return 1; },
  });
  Object.defineProperty(r, 'characterSpriteBatchOpen', { get: () => r.open });
  return r;
}

test('AUDIT MW-NPC A3 (MW-SMOOTH): a creature is lit by the normals its shapes author, as a person is - its skinned body posed by skinBatch, its rigid head placed with its vertices, and the GPU stream lit by the same', async () => {
  const asm = await assembleCreature({ modelBytes: creatureModel({ normals: true }) });
  assert.equal(asm.ok, true, asm.error);
  const body = asm.pieces.find((p) => p.kind === 'skinned');
  const head = asm.pieces.find((p) => p.kind === 'rigid' && p.shape === 'Tri Head');
  assert.ok(body.normals && body.normals.length === body.positions.length, 'the body poses its normals');
  assert.ok(head.normals && head.sourceNormals && head.sourceNormals.length === head.source.length, 'the head carries its own, turned by its pre-transform');
  poseAssembly(asm, { time: 0 });
  const unit = (n, v) => Math.hypot(n[v * 3], n[v * 3 + 1], n[v * 3 + 2]);
  for (const p of [body, head]) for (let v = 0; v < p.normals.length / 3; v++) assert.ok(Math.abs(unit(p.normals, v) - 1) < 1e-5, `${p.shape ?? 'body'} v${v}: a unit normal posed`);
  // the head sits under a node a quarter turn about z: its authored (0, 0, 1) stays up, (0.6, 0, 0.8) turns to y
  assert.ok(close(head.normals[2], 1) && close(head.normals[3 + 1], 0.6, 1e-4), `the head's normals turned with it (${[...head.normals].map((x) => x.toFixed(3))})`);
  // and the GPU skin lights each corner by what the CPU skin posed
  const L = skinLayout(asm.pieces);
  const packed = packSkinStream(L, pieceLanes);
  writeSkinPalette(L, asm);
  for (const p of [body, head]) {
    const range = packed.ranges.find((r) => r.piece === p);
    for (let c = range.first; c < range.first + range.count; c++) {
      const n = skinStreamCorner(packed.stream, packed.floats, L.pairs, c, L.palette, [0, 0, 0], { normal: true });
      const v = p.indices[c - range.first];
      for (let k = 0; k < 3; k++) assert.ok(close(n[k], p.normals[v * 3 + k], 1e-4), `corner ${c}[${k}]: ${n[k]} vs ${p.normals[v * 3 + k]}`);
    }
  }
  // a creature that authors none is lit by its faces, as it was
  const bare = await assembleCreature({ modelBytes: creatureModel() });
  assert.ok(bare.pieces.every((p) => !p.normals), 'no normals authored: none posed');
});

test('AUDIT MW-NPC A1 (MWNPC2\'s law, for the veiled): every concealed or spectral body is drawn inside ONE batch of the sprite target - a crypt\'s ghosts one bind, not one each; a batch a host already holds is not reopened', async () => {
  const renderer = batchingRenderer();
  const log = [];
  const lane = stubLane(renderer, log);
  const ghosts = [0, 1, 2].map((i) => ({ id: `g${i}`, look: creatureLook({ mobileType: M.Ghost }), feet: [i, 0, -3], yaw: 0 }));
  for (let i = 0; i < 12; i++) { lane.begin(); for (const g of ghosts) lane.stand('foe', g); lane.end(1 / 60, [0, 0, 0]); await flush(); await flush(); }
  lane.draw({}, { proj: null, view: null, eye: [0, 0, 0] });
  log.length = 0; renderer.opens = 0; renderer.flushes = 0;
  lane.drawVeiled();
  assert.equal(log.length, 3, 'the three ghosts, veiled');
  assert.ok(log.every((d) => d.batched && d.conceal), 'each drawn inside the batch, under its veil');
  assert.deepEqual([renderer.opens, renderer.flushes, renderer.open], [1, 1, false], 'one batch opened and flushed');
  // a host that holds a batch of its own keeps it: drawn into it, not reopened (a nested begin would drop its queue)
  renderer.open = true; renderer.opens = 0; renderer.flushes = 0; log.length = 0;
  lane.drawVeiled();
  assert.deepEqual([renderer.opens, renderer.flushes, renderer.open], [0, 0, true]);
  assert.ok(log.every((d) => d.batched));
  lane.destroy();
});

/** the encounter pool over a lane that records its offers and stands what it is told (mwnpc5_pool's shape) */
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8 };
function poolWithLane() {
  const L = { offered: [], standing: new Set() };
  Object.assign(L, { begin() { L.offered.length = 0; }, stand(lane, actor) { L.offered.push(actor); }, end() {}, has: (lane, id) => L.standing.has(`${lane}:${id}`), draw() {}, drawVeiled() {}, destroy() {}, offsetAll() {} });
  const pool = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { raycast: () => 0.5, heightAt: () => 0 }, fetchBytes: async () => { throw new Error('none'); }, getTexture: async () => stubTex,
    uploadRecordFrame: () => {}, currentMinute: () => 1000, playerEntity: { level: 1, items: [], stats: {} }, audio: null, onPlayerHurt: () => {},
    wantNpcBodies: () => true, makeNpcBodies: () => L,
  });
  return { pool, L };
}
const poolFoe = (mobileType, feet, extra = {}) => ({
  mobileType, gender: 'male', dead: false,
  entity: { health: 10, maxHealth: 10, items: [], activeEffects: [], isClass: mobileType >= 128 },
  ai: { feet: [...feet], yaw: 0, moving: false, isHostile: true, detected: false, height: 1.8, offsetOrigin() {} },
  tex: stubTex, archive: ENEMY_BASICS[mobileType].maleTexture, batch: {}, _mout: { record: 0, frame: 0, flip: false }, mobile: { basics: { behaviour: 'General' } },
  ...extra,
});

test('AUDIT MW-NPC B1: online, my foe 1 and a peer\'s foe 1 (its puppet carries its owner\'s number) are two bodies - each its own id, the look still the number every machine shares; only the one whose body stands is cast-only', () => {
  const { pool, L } = poolWithLane();
  const mine = poolFoe(130, [2, 0, 3], { seq: 1 });
  const theirs = poolFoe(130, [8, 0, 3], { seq: 1, puppet: 'peer-a' });
  pool.foes.push(mine, theirs);
  pool.batches();
  const ids = L.offered.map((a) => a.id);
  assert.equal(ids.length, 2);
  assert.notEqual(ids[0], ids[1], 'two ids for two foes');
  assert.deepEqual(L.offered.map((a) => a.feet), [mine.ai.feet, theirs.ai.feet]);
  L.standing.add(`foe:${ids[0]}`);   // my foe's body stands; the puppet's does not (past the cap, say)
  pool.drawBodies({}, null, null, [0, 0, 0], 1 / 60);
  assert.deepEqual([mine.batch.castOnly, theirs.batch.castOnly], [true, false], 'the puppet\'s billboard still draws - never a foe drawn nowhere');
});

/** THE STREET (tools/mwNpcLaneProbe.mjs's seven lanes on one budget), still: each actor 2-70 m out on the ground, on stub
 *  rigs that count their builds. `eyeH` the eye's height over the ground. */
const STREET = [['foe', 10, NPC_BODY_TIERS], ['watch', 5, WATCH_BODY_TIERS], ['folk', 48, NPC_BODY_TIERS], ['people', 24, NPC_BODY_TIERS], ['siege', 16, NPC_BODY_TIERS], ['crew', 12, NPC_BODY_TIERS], ['roads', 8, NPC_BODY_TIERS]];
function street(tier) {
  const c = { builds: 0 }; const clock = { t: 0 };
  const budget = createFrameBudget();
  const rig = () => { const r = { mode: 'first', skinned: false, attach() {}, async build() { c.builds++; await flush(); return { ok: true }; }, canThirdPerson: () => true, raceHeightScale: () => 1, setViewMode(m) { r.mode = m; return true; }, thirdActive: () => r.mode === 'third' && r.skinned, update(dt, o) { if (o?.pose !== false) r.skinned = true; }, drawThird: () => true, unload() {}, setSheathed() {}, revive() {} }; return r; };
  const lanes = STREET.map(([name, n, tiers], k) => {
    const lane = createPopulationLane({ laneName: name, renderer: {}, want: () => true, make: () => createNpcBodies({ renderer: {}, tier: () => tier, tiers, createRig: rig, now: () => clock.t, budget, frameTiers: NPC_FRAME_TIERS }) });
    const actors = Array.from({ length: n }, (_, i) => { const r = 2 + ((i * 37 + k * 11) % 68) + 0.37 * k + 0.013 * i, a = (i * 2.399 + k) % (Math.PI * 2); return { id: i, look: { race: 'Breton', gender: 'male', faceIndex: 0, items: [] }, feet: [Math.sin(a) * r, 0, Math.cos(a) * r], yaw: 0, moving: false, drawn: false }; });
    return { lane, actors, batches: actors.map(() => ({ castOnly: false })) };
  });
  const step = async (eyeH = 0, dtMs = 1000 / 60) => {
    clock.t += dtMs;
    let s = 0;
    for (const L of lanes) {
      L.lane.frame();
      L.actors.forEach((a, i) => L.lane.offer(a, L.batches[i]));
      L.lane.draw({}, null, null, [0, eyeH, 0], 1 / 60);
      for (const a of L.actors) if (L.lane.has(a.id)) s++;
    }
    await flush();
    return s;
  };
  return { c, step, destroy: () => { for (const L of lanes) L.lane.destroy(); } };
}

test('AUDIT MW-NPC B2 (the share): a lane that reports none - every actor past its range - takes no skins, never the share its last cut gave it', () => {
  const F = (...a) => Float64Array.from(a);
  const b = createFrameBudget();
  const A = {}, B = {};
  b.report(A, F(1, 2), 2); b.report(B, F(3), 1);
  b.cut(3);
  assert.ok(b.skins(A, 4) > 0 && b.skins(B, 4) > 0);
  b.report(A, F(), 0);   // the next frame: all of A's past its range
  b.cut(3);
  assert.equal(b.skins(A, 4), 0, 'none of its own: no skins');
});

test('AUDIT MW-NPC B2: the frame\'s bodies are the budget\'s whatever the eye\'s height - the cut is ranked on the ground\'s plane, as PeerBodies measures the range it becomes (an eye 25 m up stood every body the flat range let in)', async () => {
  for (const [tier, k] of [['near', NPC_FRAME_TIERS.near.bodies], ['all', NPC_FRAME_TIERS.all.bodies]]) {
    for (const eyeH of [0, 12, 25]) {
      const S = street(tier);
      let most = 0;
      for (let f = 0; f < 160; f++) { const s = await S.step(eyeH); if (f > 40) most = Math.max(most, s); }
      assert.equal(most, k, `${tier}, the eye ${eyeH} m up: ${most} standing against the budget's ${k}`);
      S.destroy();
    }
  }
});

test('AUDIT MW-NPC B4: no rig is built for a body past the cut - a scene\'s first frame, cut before the other lanes report, queues more than the frame\'s bodies, and those that fall past it are let go unbuilt; a hitch builds nothing', async () => {
  const S = street('near');
  for (let f = 0; f < 300; f++) await S.step();
  assert.equal(S.c.builds, NPC_FRAME_TIERS.near.bodies, `${S.c.builds} rigs built for a still street - the frame's bodies, and not one more`);
  const before = S.c.builds;
  await S.step(0, 600);   // a frame of 600 ms: every report stale
  for (let f = 0; f < 120; f++) await S.step();
  assert.equal(S.c.builds - before, 0, 'the hitch built nothing that would only stand as its sprite');
  S.destroy();
});

test('AUDIT MW-NPC B3: a lane\'s body past the cut gives its slot to one of its actors within it - at once, as a lingering body does (its sprite already stands); kept, a lane\'s nearer actors stood as sprites for good', async () => {
  let t = 0;
  const budget = createFrameBudget();
  const rig = () => { const r = { mode: 'first', skinned: false, attach() {}, async build() { await flush(); return { ok: true }; }, canThirdPerson: () => true, raceHeightScale: () => 1, setViewMode(m) { r.mode = m; return true; }, thirdActive: () => r.mode === 'third' && r.skinned, update(dt, o) { if (o?.pose !== false) r.skinned = true; }, drawThird: () => true, unload() {}, setSheathed() {}, revive() {} }; return r; };
  const mk = () => createNpcBodies({ renderer: {}, tier: () => 'near', tiers: NPC_BODY_TIERS, createRig: rig, now: () => t, budget, frameTiers: NPC_FRAME_TIERS });
  const A = mk(), B = mk();
  const look = { race: 'Breton', gender: 'male', faceIndex: 0, items: [] };
  const ring = (n, r, base) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return { id: base + i, look, feet: [Math.sin(a) * r, 0, Math.cos(a) * r], yaw: 0 }; });
  const old = ring(12, 24, 0), near = ring(12, 20, 100), bs = ring(12, 19, 0);
  const frame = async (aActors) => {
    t += 1000 / 60;
    A.begin(); for (const a of aActors) A.stand('people', a); A.end(1 / 60, [0, 0, 0]);
    B.begin(); for (const a of bs) B.stand('folk', a); B.end(1 / 60, [0, 0, 0]);
    await flush();
    return { old: old.filter((a) => A.has('people', a.id)).length, near: near.filter((a) => A.has('people', a.id)).length, b: bs.filter((a) => B.has('folk', a.id)).length };
  };
  for (let f = 0; f < 60; f++) await frame(old);
  assert.deepEqual(await frame(old), { old: 12, near: 0, b: 12 }, 'A\'s twelve at 24 m and B\'s at 19 m: the frame\'s twenty-four');
  let r;
  for (let f = 0; f < 120; f++) r = await frame([...old, ...near]);   // two seconds
  assert.deepEqual(r, { old: 0, near: 12, b: 12 }, 'A\'s twelve at 20 m are within the cut and stand; its twelve at 24 m fell past it and gave their slots up');
  A.destroy(); B.destroy();
});

test('AUDIT MW-NPC D1: the dead stand where the corpse lies - the dungeon\'s corpsePos, the marker\'s pos outdoors (a deck that moves carries it) - never in the air a flyer died in; the living at their feet', () => {
  const f = { mobileType: 130, gender: 'male', dead: false, entity: { items: [] }, ai: { feet: [0, 4, 0], yaw: 0 } };
  assert.deepEqual(foeActor(f, 1).feet, [0, 4, 0], 'alive: its feet');
  f.dead = true;
  assert.deepEqual(foeActor(f, 1).feet, [0, 4, 0], 'dead, no corpse laid yet: where it fell');
  f.corpsePos = [0, 0.05, 0];
  assert.deepEqual(foeActor(f, 1).feet, [0, 0.05, 0], 'the dungeon\'s corpse on the floor');
  delete f.corpsePos;
  f.corpseMarker = { pos: [3, 0, 2] };
  assert.equal(foeActor(f, 1).feet, f.corpseMarker.pos, 'the marker\'s ground point, by reference - moveCorpse writes it in place');
});

test('AUDIT MW-NPC D2: a Daedra Seducer in her mortal guise keeps her sprite - the match is the winged daedra she becomes; transformed, she stands as it; a record with no mobile (the gate\'s host) is the daedra', () => {
  const her = { mobileType: M.DaedraSeducer, mobile: { specialTransformationCompleted: false } };
  assert.equal(creatureLook(her), null, 'in her guise: no body');
  assert.equal(isBodyFoe(her), false);
  her.mobile.specialTransformationCompleted = true;
  assert.deepEqual(creatureLook(her), { creature: ['winged twilight'] });
  assert.equal(isBodyFoe(her), true);
  assert.deepEqual(creatureLook({ mobileType: M.DaedraSeducer }), { creature: ['winged twilight'] });
});

test('AUDIT MW-NPC D3: a foe\'s body is drawn the size its sprite is - an elite\'s quarter, a last stand\'s tenth, the wild giant - and the pool hands its sprite\'s size to it', () => {
  const f = { mobileType: 130, gender: 'male', dead: false, entity: { items: [] }, ai: { feet: [0, 0, 0], yaw: 0 } };
  assert.equal(foeActor(f, 1).scale, 1);
  assert.equal(foeActor(f, 1, { scale: 1.25 }).scale, 1.25);
  const { pool, L } = poolWithLane();
  const elite = poolFoe(130, [2, 0, 3]);
  elite.entity.eliteFoe = true;
  pool.foes.push(elite);
  pool.batches();
  assert.equal(L.offered[0].scale, ELITE_FOE_SIZE, 'the elite as large as its sprite');
});

test('AUDIT MW-NPC D4/D5: no creature that flies or swims in Daggerfall stands in a Morrowind creature that walks - the imp (a flyer; the scamp walks) and the dreugh (a swimmer) keep their sprites, as the bat, the harpy and the slaughterfish do; the table holds it for every row', () => {
  assert.ok(CREATURE_MATCH[M.Imp].miss && !CREATURE_MATCH[M.Imp].creature);
  assert.ok(CREATURE_MATCH[M.Dreugh].miss && !CREATURE_MATCH[M.Dreugh].creature);
  for (const [t, m] of Object.entries(CREATURE_MATCH)) {
    if (!m.creature) continue;
    const b = ENEMY_BASICS[Number(t)]?.behaviour ?? 'General';
    assert.ok(b === 'General' || b === 'Spectral', `mobile ${t} (${b}) is matched to ${m.creature} - a flyer or swimmer needs a Morrowind one that moves as it does`);
  }
});

test('AUDIT MW-NPC D6: the masters in load order - Morrowind, Tribunal, Bloodmoon, then the rest as stored - so an expansion\'s record of an id wins over Morrowind\'s, whatever order the store lists them in', async () => {
  assert.deepEqual(esmLoadOrder(['Bloodmoon.esm', 'Morrowind.esm', 'mod.esm', 'Tribunal.esm']), ['Morrowind.esm', 'Tribunal.esm', 'Bloodmoon.esm', 'mod.esm']);
  const mw = creatureDeps({ records: [creaRec('fixture_beast', 'r\\creature.nif', { scale: 1 })] });
  const bm = creatureDeps({ records: [creaRec('fixture_beast', 'r\\creature.nif', { scale: 2 })] });
  const deps = { ...mw, storedMorrowindNames: async () => ['Bloodmoon.esm', 'Morrowind.esm'], loadMorrowindFile: async (n) => (/^bloodmoon/i.test(n) ? bm : mw).loadMorrowindFile(n) };
  const r = createFpArm(); r.attach(countingRenderer(), () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, move: { forward: 0, speed: 0, grounded: true } }));
  const res = await r.build({ creature: 'fixture_beast', deps });
  assert.equal(res.ok, true, res.error);
  assert.equal(res.creature.scale, 2, 'Bloodmoon\'s record, loaded after Morrowind\'s, wins');
});

test('AUDIT MW-NPC C4: a living resident walking the street is ONE person - their own id and the look residentLook gives them indoors and on the road, whichever pooled walker the town dressed them onto; a walker carrying no resident is the street\'s spawn as before', () => {
  const res = { id: 'L7.t3', cls: null, sex: 'female', gender: 1, race: 'Breton', archive: 385, face: 5, name: 'Ann', job: 'farmer', guard: false };
  // livingTown._dress: the pool row's walker takes the resident's archive, gender, name and face, and carries them
  const dressed = () => ({ archive: res.archive, gender: res.gender, nameNPC: res.name, personFaceRecordId: res.face, state: 'move', facingYaw: 0.4, living: { id: res.id, res } });
  const rowA = dressed(), rowB = dressed();
  const a = residentWalkerActor(rowA, [1, 0, 2]), b = residentWalkerActor(rowB, [5, 0, 6]);
  assert.equal(a.id, 'res:L7.t3');
  assert.equal(b.id, a.id, 'one id on either row');
  assert.deepEqual(a.look, residentLook({}, res), 'the look she wears indoors and on the road');
  assert.deepEqual(b.look, a.look, 'and on another row');
  assert.deepEqual([a.feet, a.yaw, a.moving, a.drawn], [[1, 0, 2], 0.4, true, false], 'walking as the walker walks');
  // the row dressed as someone else: a new person
  const other = { ...res, id: 'L7.t4', face: 2, race: 'Redguard' };
  rowA.living = { id: other.id, res: other };
  const c = residentWalkerActor(rowA, [0, 0, 0]);
  assert.equal(c.id, 'res:L7.t4');
  assert.deepEqual(c.look, residentLook({}, other), 'and their own look - never the last resident\'s');
});

test('AUDIT MW-NPC C5: a watchman\'s look follows his number on the wire once he rides - the look a peer\'s puppet of him wears; a foe of the encounter pool is its number from its spawn, its owner\'s and its puppets\' alike', () => {
  const man = (id, seq) => ({ id, seq, mobileType: GUARD_MOBILE_TYPE, gender: 'male', entity: { isClass: true, items: [] }, ai: { feet: [0, 0, 0], yaw: 0 } });
  const mine = man(3, null);
  foeLook(mine);   // drawn before he first rides: off his local id
  mine.seq = 41;
  const theirs = man(77, 41);   // a peer's puppet of him: his number, its own local id
  assert.deepEqual(foeLook(mine), foeLook(theirs), 'one man on both machines');
  assert.equal(foeLook(mine), foeLook(mine), 'kept, a compare a frame');
  const a = { id: 1, seq: 5, mobileType: 130, gender: 'male', entity: { isClass: true, items: [] }, ai: { feet: [0, 0, 0], yaw: 0 } };
  const b = { ...a, id: 2, puppet: 'peer-a', entity: { isClass: true, items: [] } };
  assert.deepEqual(foeLook(a), foeLook(b), 'the encounter pool\'s foe and its puppet one person');
});

test('AUDIT MW-NPC C6: under a window both dungeon hosts draw the flats and return before drawFoes (the only place a body is drawn) - so the corpse flats are shown first, none left cast-only by the last frame (by source)', () => {
  const ctx = rd('src/scenes/dungeonContext.js');
  assert.ok(ctx.includes('    showBodyFlats: () => { for (const f of foes) if (f.corpseBatch) f.corpseBatch.castOnly = false; },'));
  for (const [file, show, draw, ret] of [
    ['src/scenes/worldModes.js', '      if (dungeonCtx.uiOverlayActive) dungeonCtx.showBodyFlats?.();', '      renderer.drawBillboards([...dungeonCtx.billboardBatches,', 'if (dungeonCtx.uiOverlayActive) { dungeonCtx.hideHudText?.();'],
    ['src/scenes/dungeon.js', '    if (ctx.uiOverlayActive) ctx.showBodyFlats?.();', '    renderer.drawBillboards([...ctx.billboardBatches,', 'ctx.hideHudText?.(); hideWorldPlaque(); ctx.tickOverlay(dt); ctx.drawOverlay(canvas);'],
  ]) {
    const s = rd(file), a = s.indexOf(show), b = s.indexOf(draw, a), c = s.indexOf(ret, b);
    assert.ok(a > 0 && b > a && b - a < 600 && !s.slice(a, b).includes('drawBillboards(') && c > b, `${file}: shown just before the flats are drawn, ahead of the window's return`);   // worldModes holds it above BLOOD1a's marks: that pin keeps the marks within 400 of the flats
  }
});

test('AUDIT MW-NPC B3 (the slot): in an NPC lane a newcomer within the cut takes the slot of a body past it at once - never the dwell a visible body waits out - and an unseen far body gives its slot up before a visible one held past the range, even where the visible one is farther', async () => {
  const rig = () => { const r = { mode: 'first', skinned: false, attach() {}, async build() { await flush(); return { ok: true }; }, canThirdPerson: () => true, raceHeightScale: () => 1, setViewMode(m) { r.mode = m; return true; }, thirdActive: () => r.mode === 'third' && r.skinned, update(dt, o) { if (o?.pose !== false) r.skinned = true; }, drawThird: () => true, unload() {}, setSheathed() {}, revive() {} }; return r; };
  // the clock stands still: no dwell or hand-over interval ever runs out - only an unseen body's slot can be taken
  const pb = new PeerBodies({ renderer: {}, createRig: rig, buildOpts: () => ({}), now: () => 1000, limits: { max: 2, range: 10, skinBudget: 2, spareMax: 0, buildInRange: true, hysteresis: 1.2 } });
  const toScene = (p) => [p.x, p.y, p.z];
  const at = (id, z, face) => ({ id, name: '', told: true, look: { race: 'Breton', gender: 'male', faceIndex: face, items: [] }, shown: { x: 0, y: 0, z: -z, yaw: 0, pitch: 0, mv: 0, wd: 0, an: 0, as: 0, cn: 0 } });
  const sync = async (list, n = 1) => { for (let i = 0; i < n; i++) { pb.sync(list, toScene, 1 / 60, [0, 0, 0]); await flush(); await flush(); } };
  await sync([at('held', 9, 1), at('far', 9, 2)], 8);
  assert.deepEqual([pb.has('held'), pb.has('far')], [true, true], 'the pool full');
  await sync([at('held', 9, 1), at('far', 13, 2)]);   // past 10 x 1.2: far - its sprite
  await sync([at('held', 11.5, 1), at('far', 10.5, 2)]);   // held standing within the hysteresis; the far one stays far until within 10
  assert.deepEqual([pb.has('held'), pb.has('far')], [true, false], 'one visible, held farther; one unseen, nearer');
  await sync([at('held', 11.5, 1), at('far', 10.5, 2), at('new', 5, 3)], 6);
  assert.equal(pb.has('new'), true, 'the newcomer stands - the unseen body\'s slot, taken at once');
  assert.equal(pb.has('held'), true, 'and the visible one was never popped for it');
  pb.destroy();
});
