// ARENA5 (2026-10-03): THE BANNERS' COLOURS ON THE SAND, DRIVEN (bible/11-Multiplayer/Arena.md 3: a team gives "its
// colours on your ladder bouts (your banners on your side of the floor, the crowd's half in your colour)"; the ARENA3
// record left them "waiting on a tint the billboard pass does not take and on hangings the floor's instance does not
// stand"). The billboard pass's per-batch wash on both lanes (render/renderer.js BB_FS uBatchTint, render/enhancedLighting.js
// EL_BB_FS) on a recording GL; the crowd's halves (systems/arenaCrowd.js crowdHalves / crowdWash) and the driver's crowd
// batched and washed by them (scenes/arenaBouts.js buildCrowd) over a fake stage, for a ladder bout under a banner, one
// under none, an exhibition and a relay's watched pair; the floor's hangings (world/arenaFloor.js hangingModel /
// arenaFloorBlock) for the banners the driver says (floorBanners) - offline the save's, online the realm's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { EL_LANE, EL_BB_FS } from '../src/render/enhancedLighting.js';
import { classicShadowLane } from '../src/render/classicShadowLane.js';
import { perspective, lookAt, mirrorProjectionX } from '../src/world/mat4.js';
import { CROWD_WASH, crowdHalves, crowdHalfOf, crowdWash } from '../src/systems/arenaCrowd.js';
import { createArenaBouts, YOU } from '../src/scenes/arenaBouts.js';
import { newArenaLadder, nextLadderBout, exhibitionFor } from '../src/systems/arenaLadder.js';
import * as LG from '../src/systems/arenaLeague.js';
import { arenaFloorBlock, arenaFloorBlocks, hangingModel, KAMER_BANNERS, ARENA_BANNER_MODEL, HANG_HALF_M, ARENA_FLOOR_BLOCK_INDEX } from '../src/world/arenaFloor.js';
import { ARENA_MODEL_ID } from '../src/world/arenaModel.js';
import ARENA_BLOCK_JSON from '../vendor/daggerfall-arena/Arena/ARENADAG.RMB.json' with { type: 'json' };
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const R = new Float32Array([1, 0, 0]), UP = new Float32Array([0, 1, 0]);
const PROJ = mirrorProjectionX(perspective(Math.PI / 3, 1.6, 0.1, 400));
const VIEW = lookAt([0, 1.7, 9], [0, 1.2, -4], [0, 1, 0]);
/** A recording fake GL (la_cost's shape): every call logged, a uniform's location its NAME. */
function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE0: 33984, TEXTURE_2D: 3553, TEXTURE_2D_ARRAY: 35866 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? Array.from(a) : a))]); };
    },
  });
  return { gl, calls, canvas: { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 } };
}
/** The code of a shader's main(), its comments gone. */
const mainOf = (src) => src.slice(src.indexOf('void main() {')).replace(/\/\/[^\n]*/g, '');
const settle = () => new Promise((r) => setTimeout(r, 0));
const at = (day, hour = 12) => (405 * 360 + day) * MINUTES_PER_DAY + hour * 60;

test('ARENA5 the wash in both billboard shaders: a uniform multiplied into the lit flat after both maps are sampled (SPRITE-GRAD\'s order kept) - the classic lane in display colour, the Enhanced Lighting lane decoded into its linear light, the classic-shadows lane as given (mutants: ARENA5-WASH-CLASSIC-DROPPED, ARENA5-WASH-EL-DROPPED, ARENA5-WASH-EL-UNDECODED)', () => {
  const classic = mainOf(read('src/render/renderer.js').split('const BB_FS = `')[1].split('`;')[0]);
  const el = mainOf(EL_BB_FS);
  for (const [name, m, line] of [['BB_FS', classic, 'lit *= uBatchTint;'], ['EL_BB_FS', el, 'lit *= elDecode(uBatchTint);']]) {
    const k = m.indexOf(line);
    assert.ok(k > 0, `${name} washes the lit flat`);
    assert.ok(k > m.indexOf('vec4 tex = texture(uTex, uv);') && k > m.indexOf('texture(uEmissionTex, uv)'), `${name}: after both maps`);
    assert.ok(k > m.indexOf('vec3 lit = albedo'), `${name}: once the flat is lit`);
    assert.ok(k < m.lastIndexOf('outColor = vec4('), `${name}: before it is written`);
  }
  assert.match(read('src/render/renderer.js'), /uniform vec3 uBatchTint;/);
  assert.match(EL_BB_FS, /uniform vec3 uBatchTint;/);
  assert.match(classicShadowLane().bbFs, /lit \*= elDecode\(uBatchTint\);/, 'the classic-shadows lane keeps it (its elDecode the identity)');
});

test('ARENA5 the wash on the billboard pass: a washed batch sends its colour, the next unwashed one white, the frame starts white, and a call with no washed batch sends nothing of it - on both lanes (mutants: ARENA5-WASH-NOT-SENT, ARENA5-WASH-STICKS, ARENA5-WASH-FRAME-NOT-WHITE)', () => {
  for (const lane of [null, EL_LANE]) {
    const { calls, canvas } = recordingGl();
    const r = new Renderer(canvas);
    if (lane) r.setLightingLane(lane);
    r.textures.set('182_0', { id: 't0' }); r.textures.set('182_1', { id: 't1' });
    const red = r.createBillboardBatch(182, 0, { w: 1, h: 2 }, [[0, 0, -3]]);
    const plain = r.createBillboardBatch(182, 1, { w: 1, h: 2 }, [[1, 0, -4]]);
    assert.equal(red.tint, undefined, 'minted with the batch');
    red.tint = CROWD_WASH.red;
    r.beginFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
    calls.length = 0;
    r.drawBillboards([red, plain], R, UP);
    const tints = () => calls.filter((c) => c[0] === 'uniform3f' && c[1] === 'uBatchTint').map((c) => c.slice(2));
    const draws = () => calls.filter((c) => c[0] === 'drawElements').length;
    const seq = calls.filter((c) => (c[0] === 'uniform3f' && c[1] === 'uBatchTint') || c[0] === 'drawElements').map((c) => (c[0] === 'drawElements' ? 'draw' : c.slice(2).join(',')));
    assert.equal(draws(), 2);
    assert.deepEqual(tints()[0], [1, 1, 1], `${lane ? 'EL' : 'classic'}: the frame starts white`);
    // the sort is by picture: whichever comes first, the washed one is drawn under its colour and the plain one under white
    const iRed = seq.indexOf(CROWD_WASH.red.join(','));
    assert.ok(iRed > 0 && seq[iRed + 1] === 'draw', 'the washed batch drawn under its colour');
    const lastWhite = seq.lastIndexOf('1,1,1');
    assert.ok(seq.filter((s) => s === 'draw').length === 2 && (lastWhite > iRed ? seq[lastWhite + 1] === 'draw' : seq.indexOf('draw') < iRed), 'the plain one under white');
    // a second call in the frame, nothing washed: nothing of the wash sent (the white is still the program's)
    calls.length = 0;
    r.drawBillboards([plain], R, UP);
    assert.deepEqual(tints(), lastWhite > iRed ? [] : [[1, 1, 1]], 'white again only when a washed batch was the last sent');
    // a new frame: white from the block, whatever the last frame left
    r.beginFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
    calls.length = 0;
    r.drawBillboards([red], R, UP);
    assert.deepEqual(tints(), [[1, 1, 1], [...CROWD_WASH.red]]);
    calls.length = 0;
    r.drawBillboards([plain], R, UP);
    assert.deepEqual(tints(), [[1, 1, 1]], 'the washed batch\'s colour never rides onto the next call\'s flats');
  }
});

test('ARENA5 the crowd\'s halves: the west half side 0\'s, the east side 1\'s, each the first banner of its side\'s fighters - a Grand Melee\'s third side none; the washes the banners\' lore colours, held near white (mutants: ARENA5-HALVES-SIDE, ARENA5-HALF-OF-FLIPPED, ARENA5-WASH-ANY-BANNER)', () => {
  assert.equal(crowdHalfOf(-0.01), 0);
  assert.equal(crowdHalfOf(3), 1);
  assert.deepEqual(crowdHalves([{ id: 'you', side: 0 }, { id: 'f0', side: 1 }], { you: 'red' }), ['red', null]);
  assert.deepEqual(crowdHalves([{ id: 'f0', side: 0 }, { id: 'f1', side: 1 }], { f0: 'red', f1: 'blue' }), ['red', 'blue']);
  assert.deepEqual(crowdHalves([{ id: 'a', side: 0 }, { id: 'b', side: 2 }], { a: 'blue', b: 'red' }), ['blue', null], 'a side past the second has no half');
  assert.deepEqual(crowdHalves([{ id: 'a', side: 1 }, { id: 'b', side: 1 }], { a: 'green', b: 'blue' }), [null, 'blue'], 'an unknown banner skipped');
  assert.equal(crowdWash('red'), CROWD_WASH.red);
  assert.equal(crowdWash('blue'), CROWD_WASH.blue);
  assert.equal(crowdWash('green'), null);
  assert.equal(crowdWash(null), null);
  assert.ok(CROWD_WASH.red[0] > CROWD_WASH.red[2] && CROWD_WASH.blue[2] > CROWD_WASH.blue[0], 'red reads red, blue reads blue');
  for (const w of Object.values(CROWD_WASH)) for (const c of w) assert.ok(c >= 0.7 && c <= 1, 'a wash, never a dye');
});

/** The driver over a fake stage whose tiers stand 8 m over the sand everywhere, its renderer's batches kept. */
function rig(P, { realm = null } = {}) {
  let t = 1000;
  const made = [];
  const stage = {
    kind: 'floor', centre: () => [0, 0, 0],
    spawn: async (mobile, feet, o) => ({ mobile, o, entity: { health: 40, maxHealth: 40, bout: o.bout, items: [] }, ai: { feet: [...feet], target: null } }),
    remove: () => {}, heightAt: () => 8,
  };
  const renderer = { createBillboardBatch: (archive, record, size, at) => { const b = { archive, record, size, at, tint: undefined }; made.push(b); return b; }, destroyBillboardBatch: () => {} };
  const getTexture = async () => ({ getSize: () => ({ width: 40, height: 70 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 });
  const A = createArenaBouts({ now: () => t, rng: () => 0.99, playerEntity: P, gameMinutes: () => at(40), renderer, getTexture, drawHud: () => {}, pay: () => {}, heal: () => {} });
  if (realm) A.setRealm(() => realm);
  const step = (ms) => { t += ms; A.frame(ms / 1000, { playerFeet: [0, 0, 0], sheathed: false }); };
  return { A, stage, made, step };
}
/** Every seat of the crowd's batches, by the wash it wears. */
const seatsByWash = (made) => {
  const out = new Map();
  for (const b of made) { const k = b.tint ? b.tint.join(',') : 'none'; for (const s of b.at) { if (!out.has(k)) out.set(k, []); out.get(k).push(s); } }
  return out;
};

test('ARENA5 the crowd in your colour, driven: a ladder bout under the Red washes the west half red and leaves the east as it was; under no banner nothing is washed and the batches are not split; an exhibition washes the west red and the east blue; online the realm\'s banner, not the save\'s (mutants: ARENA5-CROWD-NOT-WASHED, ARENA5-CROWD-NOT-SPLIT, ARENA5-CROWD-HALF-WRONG)', async () => {
  const red = LG.joinBanner(LG.newArenaLeague(), 'red', at(40)).league;
  const P = { name: 'Hero', health: 100, maxHealth: 100, arenaLadder: newArenaLadder(), arenaLeague: red };
  const r = rig(P);
  r.A.setStage(r.stage);
  r.A.ask({ where: 'floor', kind: 'ladder', next: nextLadderBout(P.arenaLadder) });
  for (let i = 0; i < 8; i++) await settle();
  const w = seatsByWash(r.made);
  assert.ok(w.get(CROWD_WASH.red.join(','))?.length > 10, 'the west half washed red');
  assert.ok(w.get('none')?.length > 10, 'the east half as it was');
  assert.ok(w.get(CROWD_WASH.red.join(',')).every(([x]) => x < 0), 'the red only west of the middle line');
  assert.ok(w.get('none').every(([x]) => x >= 0));
  assert.equal(w.has(CROWD_WASH.blue.join(',')), false);
  // under no banner: one batch a picture and phase, nothing washed
  const P0 = { name: 'Hero', health: 100, maxHealth: 100, arenaLadder: newArenaLadder(), arenaLeague: LG.newArenaLeague() };
  const r0 = rig(P0);
  r0.A.setStage(r0.stage);
  r0.A.ask({ where: 'floor', kind: 'ladder', next: nextLadderBout(P0.arenaLadder) });
  for (let i = 0; i < 8; i++) await settle();
  assert.ok(r0.made.length > 0 && r0.made.every((b) => b.tint === undefined), 'nothing washed');
  const keys = r0.made.map((b) => `${b.archive}:${b.record}`);
  assert.ok(keys.length - new Set(keys).size <= keys.length / 2 + 1, 'not split by half');
  assert.ok(r0.made.some((b) => b.at.some(([x]) => x < 0) && b.at.some(([x]) => x >= 0)), 'a batch holds both halves');
  // an exhibition: the Red against the Blue
  const r2 = rig({ ...P0 });
  r2.A.setStage(r2.stage);
  r2.A.ask({ where: 'floor', kind: 'exhibition', ex: exhibitionFor(at(40) - (at(40) % MINUTES_PER_DAY) + 12 * 60) });
  for (let i = 0; i < 8; i++) await settle();
  const w2 = seatsByWash(r2.made);
  assert.ok(w2.get(CROWD_WASH.red.join(','))?.every(([x]) => x < 0) && w2.get(CROWD_WASH.blue.join(','))?.every(([x]) => x >= 0), 'west red, east blue');
  assert.equal(w2.has('none'), false);
  // online: the realm's banner (the Blue) over the save's (the Red)
  const r3 = rig({ ...P, arenaLeague: red }, { realm: { banner: 'blue', laurel: null } });
  r3.A.setStage(r3.stage);
  r3.A.ask({ where: 'floor', kind: 'ladder', next: nextLadderBout(P.arenaLadder) });
  for (let i = 0; i < 8; i++) await settle();
  const w3 = seatsByWash(r3.made);
  assert.ok(w3.get(CROWD_WASH.blue.join(','))?.every(([x]) => x < 0), 'the realm\'s banner on my half');
  assert.equal(w3.has(CROWD_WASH.red.join(',')), false);
});

test('ARENA5 a relay\'s watched pair washes each half by the banner the hall billed (relayBanners\' law, read through it) - and a relay\'s watched bout has its crowd at all (mutants: ARENA5-CROWD-NOT-WASHED, ARENA5-RELAY-CROWD-THROWS)', async () => {
  const r = rig({ name: 'Sola', health: 50, maxHealth: 50 });
  r.A.setStage(r.stage);
  r.A.startRelay({ o: '0123456789abcdef', kind: 'pvp', me: '', banners: { p0: 'blue', p1: 'red' } });
  r.A.relayWord({ k: 'st', o: '0123456789abcdef', kind: 'pvp', ph: 'call', pa: 1000, fa: null, lim: 180000, f: [['p0', 'Ana', 0, 300, 300, '', 0, -1, 50, '', ''], ['p1', 'Bo', 1, 300, 300, '', 0, -1, 50, '', '']], me: '', sp: 1 });
  for (let i = 0; i < 8; i++) await settle();
  const w = seatsByWash(r.made);
  assert.ok(w.get(CROWD_WASH.blue.join(','))?.every(([x]) => x < 0), 'p0 (west) under the Blue');
  assert.ok(w.get(CROWD_WASH.red.join(','))?.every(([x]) => x >= 0), 'p1 (east) under the Red');
});

test('ARENA5 the hangings: Kamer\'s twenty ring banners are the tapestry run\'s cloth; a bannered side\'s half takes its banner\'s cloth at his hang points (turned as his were), the middle line\'s and the box\'s stay his; no banners, the block as it was (mutants: ARENA5-HANG-NONE, ARENA5-HANG-SIDES-SWAPPED, ARENA5-HANG-MIDDLE)', () => {
  const ring = ARENA_BLOCK_JSON.RmbBlock.Misc3dObjectRecords.filter((o) => KAMER_BANNERS.includes(Number(o.ModelIdNum)));
  assert.equal(ring.length, 20, 'his twenty');
  for (const id of [...KAMER_BANNERS, ...Object.values(ARENA_BANNER_MODEL)]) assert.ok(id >= 42500 && id <= 42571, 'the tapestry run (DFU RDBLayout\'s minTapestryID..maxTapestryID)');
  const c = ARENA_BLOCK_JSON.RmbBlock.Misc3dObjectRecords.find((o) => Number(o.ModelIdNum) === ARENA_MODEL_ID);
  const dx = (o) => (o.XPos - c.XPos) * 0.025;
  const west = ring.filter((o) => dx(o) <= -HANG_HALF_M), east = ring.filter((o) => dx(o) >= HANG_HALF_M);
  assert.deepEqual([west.length, east.length], [9, 9], 'nine a side, two by the box over the middle line');
  for (const o of west) assert.equal(hangingModel(o, { west: 'red', east: null }), ARENA_BANNER_MODEL.red);
  for (const o of east) assert.equal(hangingModel(o, { west: 'red', east: null }), Number(o.ModelIdNum), 'the unbannered side his');
  for (const o of east) assert.equal(hangingModel(o, { west: null, east: 'blue' }), ARENA_BANNER_MODEL.blue);
  for (const o of ring.filter((x) => Math.abs(dx(x)) < HANG_HALF_M)) assert.equal(hangingModel(o, { west: 'red', east: 'blue' }), Number(o.ModelIdNum), 'over the middle line: his');
  const box = ARENA_BLOCK_JSON.RmbBlock.Misc3dObjectRecords.find((o) => Number(o.ModelIdNum) === 42548);
  assert.equal(hangingModel(box, { west: 'red', east: 'blue' }), 42548, 'the box\'s banner his');
  // the made block: the models it references and where they stand
  const ids = (blk) => blk.rdbBlock.objectRootList[0].rdbObjects.filter((o) => o.type === 1).map((o) => Number(blk.rdbBlock.modelReferenceList[o.resources.modelResource.modelIndex].modelIdNum));
  const plain = arenaFloorBlock('ladder');
  assert.deepEqual(arenaFloorBlock('ladder', ARENA_BLOCK_JSON, null), plain, 'no banners: the block as it was');
  assert.deepEqual(arenaFloorBlock('ladder', ARENA_BLOCK_JSON, { west: null, east: null }), plain);
  const ex = arenaFloorBlock('watch', ARENA_BLOCK_JSON, { west: 'red', east: 'blue' });
  const count = (blk, id) => ids(blk).filter((x) => x === id).length;
  assert.deepEqual([count(ex, ARENA_BANNER_MODEL.red), count(ex, ARENA_BANNER_MODEL.blue)], [9, 9]);
  assert.equal(KAMER_BANNERS.reduce((s, id) => s + count(ex, id), 0), 2, 'his two by the box');
  assert.equal(ids(ex).length, ids(plain).length, 'nothing added, nothing lost');
  const P = plain.rdbBlock.objectRootList[0].rdbObjects, E = ex.rdbBlock.objectRootList[0].rdbObjects;
  for (let i = 0; i < P.length; i++) {
    if (P[i].type !== 1) continue;
    assert.deepEqual([E[i].xPos, E[i].yPos, E[i].zPos, E[i].resources.modelResource.yRotation], [P[i].xPos, P[i].yPos, P[i].zPos, P[i].resources.modelResource.yRotation], 'at his hang point, turned as his');
  }
  // the blocks file made with them answers the made block
  const f = arenaFloorBlocks(null, 'ladder', { west: 'blue', east: null });
  assert.equal(count(f.getBlock(ARENA_FLOOR_BLOCK_INDEX), ARENA_BANNER_MODEL.blue), 9);
});

test('ARENA5 the banners the floor hangs, from the bout asked for it: a ladder bout mine on the west (the save\'s offline, the realm\'s online), an exhibition the Red against the Blue, a relay\'s pair by the hall\'s bill and mine the realm\'s, a replay\'s recorded sides; none for the pit or no bout (mutants: ARENA5-FLOOR-BANNERS-LADDER-SIDE, ARENA5-FLOOR-BANNERS-REALM, ARENA5-FLOOR-BANNERS-EXHIBITION)', () => {
  const red = LG.joinBanner(LG.newArenaLeague(), 'red', at(40)).league;
  const P = { name: 'Hero', health: 100, maxHealth: 100, arenaLadder: newArenaLadder(), arenaLeague: red };
  const r = rig(P);
  assert.deepEqual(r.A.floorBanners(), { west: null, east: null }, 'no bout asked');
  r.A.ask({ where: 'floor', kind: 'ladder', next: nextLadderBout(P.arenaLadder) });
  assert.deepEqual(r.A.floorBanners(), { west: 'red', east: null });
  r.A.setRealm(() => ({ banner: 'blue', laurel: 'red' }));
  assert.deepEqual(r.A.floorBanners(), { west: 'blue', east: null }, 'online the realm\'s');
  r.A.setRealm(null);
  r.A.ask({ where: 'floor', kind: 'exhibition', ex: exhibitionFor(at(40)) ?? { hour: 1, seed: 1, tier: 0, opponents: [], open: true } });
  assert.deepEqual(r.A.floorBanners(), { west: 'red', east: 'blue' });
  r.A.ask({ where: 'pit', kind: 'practice', next: nextLadderBout(P.arenaLadder) });
  assert.deepEqual(r.A.floorBanners(), { west: null, east: null }, 'the pit hangs nothing');
  r.A.setRealm(() => ({ banner: 'red', laurel: null }));
  r.A.ask({ where: 'floor', relay: { o: '0123456789abcdef', kind: 'pvp', me: 'p1', banners: { p0: 'blue' } } });
  assert.deepEqual(r.A.floorBanners(), { west: 'blue', east: 'red' }, 'my rival\'s by the bill, mine the realm\'s');
  r.A.ask({ where: 'floor', relay: { o: '0123456789abcdef', kind: 'pve', me: '', sides: ['blue', 'nope'] } });
  assert.deepEqual(r.A.floorBanners(), { west: 'blue', east: null }, 'a replay\'s recorded sides');
  // the host's half: both hosts hand the driver's word to the mode machine, which lays the block with it
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.match(read(f), /arenaFloorBanners: \(\) => arenaBouts\.floorBanners\(\),/, f);
  assert.match(read('src/scenes/worldModes.js'), /blocksFile: arenaFloorBlocks\(blocks, kind, host\.arenaFloorBanners\?\.\(\) \?\? null\)/);
  assert.equal(YOU, 'you');
});
