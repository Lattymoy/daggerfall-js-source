// NODE-GLINT (2026-10-20, the owner: "Lets just bring the glint back but better", of NODE-OUTLINE's ring - which players
// found unimmersive).
//
// EVERY GATHERING NODE CATCHING THE LIGHT ON ITS OWN PICTURE. NODE-MARKS lit a node with a card before it - a halo, a
// shimmer and motes - which the eye read as a faint sparkle near the node, not as the node; NODE-OUTLINE (2026-10-19)
// ringed the picture in its profession's colour, which read as a line painted on the world. Now (render/nodeGlint.js):
//   - the gathering host's marks carry each node's PICTURES (scenes/gatherHost.js, NODE-OUTLINE's): the flats it stood
//     for the node (a herb patch's, a vein's, a boulder's, a school's - which flats of which batch, and their centres), a
//     dungeon vein's own batches, and a tree's forest flat with its centre (treeHost.js picturesOf - the 3D tree that
//     stands for it near the eye is found by that centre in its pixel's tree set);
//   - each frame the pass draws those pictures, unmoved, into a tile of a depth-only atlas (the silhouette, NODE-OUTLINE's
//     mask), then adds light over the node on screen: glints - a white-hot core in a soft bloom with four thin rays, each
//     life at a spot its silhouette holds round it (found once for the node, in the vertex stage), born and gone dark -
//     and a sheen crossing the silhouette, faded out near; at the picture's depth pulled toward the eye (a wall before
//     the node hides it), in a warm light with a hint of the profession's colour;
//   - a node with no picture (a body drawn as a 3D character) keeps the glow; the node an act works is quiet.
// AUDIT NODE-GLINT (the owner: "Audit this"): a node behind the eye no full-screen pass; the spots once a node, held off
// a leaf's edge; the clock's wrap moving no glint; a small tree's own box; a batch not yet placed where its mark stands;
// the act's node quiet; the sea's murk; the constants pinned by value. tools/nodeGlintProbe.mjs draws it in a real WebGL2.
// bible/06-Systems/Professions-Arc.md, NODE-GLINT.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createProfBook } from '../../src/net/profBook.js';
import { veins, utcDayOfMs } from '../../src/net/nodeLaw.js';
import { SKINNING_KNIFE } from '../../src/net/professionLaw.js';
import { mineKind } from '../../src/scenes/mineHost.js';
import { herbKind } from '../../src/scenes/herbHost.js';
import { huntKind } from '../../src/scenes/huntHost.js';
import { treeKind } from '../../src/scenes/treeHost.js';
import { createGatherHost, aimAt } from '../../src/scenes/gatherHost.js';
import { setForagingHost } from '../../src/systems/foraging/foragingInstall.js';
import { FT } from '../../src/systems/foraging/foragingLaw.js';
import { nodeMarkRgb } from '../../src/ui/nodeMarks.js';
import { NODE_GLOW_MAX, NODE_GLOW_KINDLE_S, nodeGlows, createNodeGlowState } from '../../src/render/nodeGlow.js';
import * as NG from '../../src/render/nodeGlint.js';
import {
  GLINT_MAX, GLINT_TILE, GLINT_GRID, GLINT_QUAD_INDEX_BYTES, GLINT_COUNT, GLINT_TRIES, GLINT_RATE, GLINT_RATE_STEP, GLINT_FLASH, GLINT_STILL,
  GLINT_PX, GLINT_PX_MIN, GLINT_PX_FLOOR, GLINT_REF_ROWS, GLINT_SHARE, GLINT_GAIN, GLINT_LIGHT, GLINT_TINT, GLINT_CORE_WHITE, GLINT_PULL,
  GLINT_SHEEN_HZ, GLINT_SHEEN_SHARE, GLINT_SHEEN_NEAR_M, GLINT_SHEEN_FULL_M, GLINT_TREE_REACH, GLINT_SHEEN_DARK, GLINT_SHEEN_LIT,
  glintPx, glintPxMax, glintTint, glintSheen, glintRatesWhole, glintLightLevel, glintSheenLight, screenRect, widenRect, snapRect, innerShare, treeInstanceOf,
  NODE_MASK_VS, NODE_MASK_FS, NODE_GLINT_VS, NODE_GLINT_FS, NodeGlintRenderer, createNodeGlintPass,
} from '../../src/render/nodeGlint.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../../src/world/terrain/terrainSampler.js';
import { Renderer, FLAT_LIGHT_FLOOR } from '../../src/render/renderer.js';
import { exteriorAmbient, sunScale, SUN_RIG_COLOR } from '../../src/world/worldClock.js';
import { MOONS, moonlightTerm, withMoonAmbient } from '../../src/render/enhancedSky.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
const tick = () => new Promise((r) => setImmediate(r));
const WOODS = 231, GLENUMBRA = 59;
const NOON = 20500 * 86_400 + 43_200;
const DAY = utcDayOfMs(NOON * 1000);
const TR = Object.freeze([-1000, 2, 500]);
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const f4 = (x) => x.toFixed(4);

/** The gathering host over one grass pixel (400, 150) with its veins on rock and a body, every batch it makes kept with
 *  the arguments it was made of (`made`). */
async function rig() {
  const samples = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.25);
  const law = veins({ x: 400, y: 150, day: DAY, climate: WOODS, region: GLENUMBRA });
  const rocks = law.map((v) => [v.u * TERRAIN_SIZE - 2, 0, v.v * TERRAIN_SIZE + 4, v.u * TERRAIN_SIZE + 2, 6, v.v * TERRAIN_SIZE + 8]);
  const entry = { px: 400, py: 150, samples, tilemap: new Uint8Array(128 * 128).fill(2), locationRect: null, batches: [], rocks };
  const door = {
    account: () => 'acct-1',
    state: async () => ({ ok: true, data: { day: DAY, character: 'c1', tracks: [{ profession: 'mining', xp: 100_000, rank: 100, specs: { 50: null, 100: null } }], today: {}, taken: [], stores: [], caps: { stores: 5000 } } }),   // a Master miner: any vein is hers to work
    pixels: async (c, px) => ({ ok: true, data: { pixels: px.map(([x, y]) => ({ x, y, state: 'none' })), dungeons: [] } }),
    harvest: async () => ({ ok: false, error: 'offline' }),
  };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c1', now: () => NOON * 1000, sleep: noWait });
  const hud = { setPrompt: () => {}, setMeter: () => {}, toast: () => {}, banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {} };
  const entity = { items: [{ templateIndex: SKINNING_KNIFE.templateIndex, currentCondition: 50, maxCondition: 50 }, { templateIndex: FT.PickAxe, currentCondition: 50, maxCondition: 50 }], stats: {} };   // a body is a node while the knife is carried; the Pick-Axe works a vein
  const feet = [0, 0, 0], view = { yaw: 0, pitch: 0 };
  const made = [];
  const kinds = [herbKind({ book }), mineKind({ book }), huntKind({ book, bodies: () => [{ key: 'body:20500:abcdefabcdef', foe: 1, tier: 1, hide: 'hide:wolf', at: () => [TR[0] + 10, TR[1], TR[2] + 10], lift: 0.2, reach: 3, lootKey: () => null }] })];
  const host = createGatherHost({
    book, hud, kinds,
    renderer: { createBillboardBatch: (archive, record, size, centers) => { const b = { archive, record, size, centers: centers.map((c) => [...c]) }; made.push(b); return b; }, destroyBatch: () => {} },
    getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {},
    billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => new Map([['400,150', entry]]), pixelTranslation: (x, y, out) => { out[0] = TR[0]; out[1] = TR[1]; out[2] = TR[2]; return out; },
    pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs: () => NOON * 1000,
    eye: () => ({ pos: [feet[0], feet[1] + 1.6, feet[2]], dir: [Math.sin((view.yaw * Math.PI) / 180), Math.sin((view.pitch * Math.PI) / 180), Math.cos((view.yaw * Math.PI) / 180)] }),
    view: () => view, feet: () => feet,
    entity: () => entity, keyLabel: () => 'E', input: () => ({ held: false, attack: false, choice: false }),
    active: () => true, activeDungeon: () => true,
  });
  await book.refresh();
  host.onBuilt(entry);
  for (let i = 0; i < 4; i++) await tick();
  return { host, made, kinds, feet, view, nodes: () => host.nodesOf(400, 150), entry };
}

// ─── THE PICTURES (NODE-OUTLINE's, which the glint lights) ───────────

test('NODE-GLINT the host\'s pictures: every herb patch\'s and vein\'s mark carries the flats the host stood for it - which batch, which of its flats (from `first`, `count` of them) and their centres - its own and never a neighbour\'s, though nodes share a batch; a body\'s none (the glow); AUDIT NODE-GLINT: each mark its pictures\' frame in the scene (`origin` - the pixel\'s translation) (mutants: the owners unrecorded; the range off by one; the pictures never handed; the origin unset)', async () => {
  const t = await rig();
  const all = t.nodes();
  assert.ok(all.length > 4, 'the pixel stands its herbs and veins');
  let shared = 0;
  for (const n of all) {
    const at = [n.local[0] + TR[0], n.local[1] + TR[1], n.local[2] + TR[2]];
    const m = t.host.marks(at).find((x) => x.key === n.key);
    if (!m) continue;
    assert.deepEqual([...m.origin], [...TR], `${n.key}: its pictures stand in its pixel's frame`);
    const kind = t.kinds.find((k) => k.id === n.kind);
    const want = kind.flatsOf(n).flatMap((f) => f.centers);
    assert.ok(m.pictures?.length > 0, `${n.key}: its pictures`);
    const got = m.pictures.flatMap((p) => {
      assert.ok(t.made.includes(p.batch), 'a batch the host made');
      assert.equal(p.count, p.centers.length);
      assert.deepEqual(p.batch.centers.slice(p.first, p.first + p.count), p.centers.map((c) => [...c]), `${n.key}: its flats in the batch, from first`);
      if (p.first > 0 || p.batch.centers.length > p.count) shared++;
      return p.centers;
    });
    assert.deepEqual(got.map((c) => [...c]), want.map((c) => [...c]), `${n.key}: exactly its own flats`);
  }
  assert.ok(shared > 0, 'some node shares its batch - its range is its own');
  const body = t.host.marks([TR[0] + 10, TR[1], TR[2] + 10]).find((x) => x.key.startsWith('body:'));
  assert.ok(body, 'the body is marked');
  assert.equal(body.pictures, null, 'a loose body hands no picture: the glow lights it');
});

test('NODE-GLINT a tree\'s pictures (treeKind picturesOf): its forest\'s own flat - the group\'s batch, the flat\'s index, its centre (the very array its pixel\'s tree set holds) and its pixel - one list a node, made again only when its batch or its centre changes (none made a frame); none where the flat is gone (mutants: a flat\'s index not its own; made every call)', () => {
  const kind = treeKind({ book: { taken: () => false, counting: () => false, state: {} } });
  const c = [10, 0, 20], batch = { archive: 504, record: 3 };
  const entry = { forest: { groups: new Map([['g', { batch, centers: [[0, 0, 0], c], size: { w: 3, h: 6 } }]]) } };
  const n = { key: 'tree:1:2:3:0', flat: { group: 'g', i: 1 } };
  const p = kind.picturesOf(n, entry);
  assert.deepEqual(p, [{ batch, first: 1, count: 1, centers: [c], center: c, entry }]);
  assert.equal(p[0].center, c, 'the centre itself, not a copy: the 3D tree is found by it');
  assert.equal(kind.picturesOf(n, entry), p, 'the same list next frame');
  const again = { archive: 504, record: 3 };
  entry.forest.groups.get('g').batch = again;
  assert.notEqual(kind.picturesOf(n, entry), p, 'a new batch (the pixel stood again): a new list');
  assert.equal(kind.picturesOf(n, entry)[0].batch, again);
  assert.equal(kind.picturesOf({ key: 'x', flat: { group: 'h', i: 0 } }, entry), null, 'no such group');
  assert.equal(kind.picturesOf({ key: 'y', flat: { group: 'g', i: 9 } }, entry), null, 'no such flat');
});

test('NODE-GLINT treeInstanceOf: a tree\'s 3D instance this frame by its centre - its row in its pixel\'s set (Low Poly Trees\' or the jungle\'s) at the set\'s translation, its run in the frame that drew its handle; none when no frame drew it, or the centre is no tree of the sets (mutants: the translation forgotten; a stale frame trusted)', () => {
  const h0 = { id: 'oak' }, h1 = { id: 'kapok' };
  const c0 = [1, 2, 3], c1 = [4, 5, 6];
  const set = { trees: new Float32Array([0, 1, 2, 3, 1.1, 0.5, 1, 4, 5, 6, 0.9, 2.5]), centers: [c0, c1], handles: [h0, h1], ox: 100, oy: 10, oz: -50 };
  const run = { run: { handle: h1 }, scale: [1, 1, 1], size: [8, 20], subs: [] };
  const frame = { cut: new Set([h1]), runs: [{ run: { handle: h0 } }, run] };
  const rows = new WeakMap(), out = new Float32Array(5);
  const got = treeInstanceOf({ batch: null, first: 0, count: 1, center: c1, entry: { jungleTrees: set } }, [null, frame], rows, out);
  assert.equal(got.frame, frame); assert.equal(got.run, run);
  assert.deepEqual([...out], [104, 15, -44, 2.5, 0.9].map((v) => Math.fround(v)), 'x, y, z at the set\'s translation, yaw, scale');
  assert.equal(treeInstanceOf({ batch: null, first: 0, count: 1, center: c0, entry: { lowPolyTrees: set } }, [frame], rows, out), null, 'its handle not drawn this frame');
  assert.equal(treeInstanceOf({ batch: null, first: 0, count: 1, center: c1, entry: { lowPolyTrees: set } }, [], rows, out), null, 'no frame drew a tree');
  assert.equal(treeInstanceOf({ batch: null, first: 0, count: 1, center: [4, 5, 6], entry: { lowPolyTrees: set } }, [frame], rows, out), null, 'an equal array is not its centre');
  assert.equal(treeInstanceOf({ batch: null, first: 0, count: 1, center: c1, entry: {} }, [frame], rows, out), null, 'a pixel with no set');
});

// ─── THE ACT'S NODE IS QUIET (AUDIT NODE-GLINT) ───────────────────────

test('AUDIT NODE-GLINT the act\'s node is quiet: nodeGlows dims a quiet mark over NODE_GLOW_KINDLE_S as it kindled and kindles it again when it is not - its seed and place kept (mutants: a quiet mark kindled; dimmed at once)', () => {
  const state = createNodeGlowState(), out = [];
  const m = { key: 'vein:1', profession: 'mining', at: [0, 0, -5], w: 1, h: 1, quiet: false };
  nodeGlows([m], [0, 1.6, 0], 0, state, out);
  for (let t = 0.25; t <= 1; t += 0.25) nodeGlows([m], [0, 1.6, 0], t, state, out);
  assert.equal(out[0].alpha, 1, 'kindled whole');
  m.quiet = true;
  nodeGlows([m], [0, 1.6, 0], 1.25, state, out);
  assert.ok(Math.abs(out[0].alpha - (1 - 0.25 / NODE_GLOW_KINDLE_S)) < 1e-9, 'dimming at the kindling\'s own pace');
  nodeGlows([m], [0, 1.6, 0], 1.5, state, out);
  nodeGlows([m], [0, 1.6, 0], 1.75, state, out);
  assert.equal(out.length, 0, 'quiet: nothing lit');
  assert.ok(state.nodes.has('vein:1'), 'still known - it kindles from where it stands, not from a new seed');
  m.quiet = false;
  nodeGlows([m], [0, 1.6, 0], 2, state, out);
  assert.ok(Math.abs(out[0].alpha - 0.25 / NODE_GLOW_KINDLE_S) < 1e-9, 'kindling again');
});

test('AUDIT NODE-GLINT the act\'s node is quiet, as the host marks it: a Pick-Axe\'s act on a vein makes its mark `quiet` (the act\'s own glint - the strike\'s - is the one to watch), every other node\'s not; the act ended, none (mutants: no mark quiet; every mark quiet)', async () => {
  setForagingHost({ world: () => ({ inside: false, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 12, climate: WOODS, region: GLENUMBRA, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' }) });
  try {
    const t = await rig();
    const vein = t.nodes().find((n) => n.kind === 'mine' && n.what === 'vein');
    assert.ok(vein, 'a vein stands');
    const [x, y, z] = [vein.local[0] + TR[0], vein.local[1] + TR[1], vein.local[2] + TR[2]];
    t.feet[0] = x; t.feet[1] = y; t.feet[2] = z - 1.5;
    const aim = aimAt([x, y + 1.6, z - 1.5], [x, y + (vein.lift ?? 0.3), z], { yaw: 0, pitch: 0 });
    t.view.yaw = -aim.yaw; t.view.pitch = -aim.pitch;
    t.host.tick(0.016);
    assert.equal(t.host.target?.node.key, vein.key, 'the vein under the look');
    const before = t.host.marks(t.feet);
    assert.ok(before.length > 1 && before.every((m) => m.quiet === false), 'no act: none quiet');
    assert.equal(t.host.press(), true);
    assert.equal(t.host.acting(), true, 'the act begun');
    const during = t.host.marks(t.feet);
    assert.deepEqual(during.filter((m) => m.quiet).map((m) => m.key), [vein.key], 'the worked vein alone quiet');
    assert.equal(t.host.cancel(), true);
    assert.ok(t.host.marks(t.feet).every((m) => m.quiet === false), 'the act ended: none quiet');
    t.host.dispose();
  } finally { setForagingHost(null); }
});

// ─── THE LAWS ────────────────────────────────────────────────────────

test('AUDIT NODE-GLINT the record\'s numbers, by value: every constant the record states (mutants: any one moved)', () => {
  const pick = Object.fromEntries(['GLINT_TILE', 'GLINT_GRID', 'GLINT_MAX', 'GLINT_TREE_REACH', 'GLINT_QUAD_INDEX_BYTES', 'GLINT_COUNT', 'GLINT_TRIES', 'GLINT_HOLD_PX',
    'GLINT_RATE', 'GLINT_RATE_STEP', 'GLINT_FLASH', 'GLINT_STILL', 'GLINT_PX', 'GLINT_PX_MIN', 'GLINT_PX_FLOOR', 'GLINT_REF_ROWS', 'GLINT_SHARE', 'GLINT_TINT',
    'GLINT_CORE_WHITE', 'GLINT_PULL', 'GLINT_SHEEN_HZ', 'GLINT_SHEEN_SHARE', 'GLINT_SHEEN_NEAR_M', 'GLINT_SHEEN_FULL_M', 'GLINT_NEAR_W', 'GLINT_OVERHANG', 'GLINT_ANCHORS',
    'GLINT_SHEEN_DARK', 'GLINT_SHEEN_LIT'].map((k) => [k, NG[k]]));
  assert.deepEqual(pick, {
    GLINT_TILE: 256, GLINT_GRID: 4, GLINT_MAX: 16, GLINT_TREE_REACH: 0.75, GLINT_QUAD_INDEX_BYTES: 24, GLINT_COUNT: 6, GLINT_TRIES: 6, GLINT_HOLD_PX: 1.5,
    GLINT_RATE: 0.35, GLINT_RATE_STEP: 0.05, GLINT_FLASH: 3, GLINT_STILL: 0.6, GLINT_PX: 14, GLINT_PX_MIN: 4, GLINT_PX_FLOOR: 1.5, GLINT_REF_ROWS: 1080, GLINT_SHARE: 0.35,
    GLINT_TINT: 0.35, GLINT_CORE_WHITE: 0.6, GLINT_PULL: 0.3, GLINT_SHEEN_HZ: 0.15, GLINT_SHEEN_SHARE: 0.5, GLINT_SHEEN_NEAR_M: 6, GLINT_SHEEN_FULL_M: 18,
    GLINT_NEAR_W: 1e-3, GLINT_OVERHANG: 2, GLINT_ANCHORS: 8, GLINT_SHEEN_DARK: 0.4, GLINT_SHEEN_LIT: 0.55,
  });
  assert.deepEqual({ ...GLINT_GAIN }, { core: 0.9, ray: 0.5, bloom: 0.3, sheen: 0.14 });
  assert.deepEqual([...GLINT_LIGHT], [1, 0.95, 0.84]);
});

test('NODE-GLINT a glint\'s reach: GLINT_SHARE of the picture\'s longer side, between GLINT_PX_MIN and GLINT_PX at GLINT_REF_ROWS rows, both with the image, never under GLINT_PX_FLOOR; the most it reaches the rectangle\'s room (mutants: the cap unscaled; the share unread; the least unscaled; the floor gone)', () => {
  assert.equal(glintPx(GLINT_REF_ROWS, 1000), GLINT_PX, 'a big picture: the most');
  assert.ok(Math.abs(glintPx(GLINT_REF_ROWS, 20) - GLINT_SHARE * 20) < 1e-12, 'a small one: its share');
  assert.equal(glintPx(GLINT_REF_ROWS, 2), GLINT_PX_MIN, 'a speck: the least, so a far node still glints');
  assert.equal(glintPx(2160, 1000), GLINT_PX * 2, 'with the image');
  assert.equal(glintPx(2160, 2), GLINT_PX_MIN * 2);
  assert.equal(glintPx(100, 1000), GLINT_PX_FLOOR, 'a retro image: a pixel and a half of its own');
  assert.equal(glintPxMax(GLINT_REF_ROWS), GLINT_PX);
  assert.equal(glintPxMax(540), GLINT_PX / 2);
  assert.equal(glintPxMax(100), GLINT_PX_FLOOR);
  for (const rows of [100, 480, 1080, 2160]) for (const side of [1, 10, 40, 400]) assert.ok(glintPx(rows, side) <= glintPxMax(rows), 'never past the room the rectangle keeps');
});

test('NODE-GLINT the light: a warm daylight carrying GLINT_TINT of the profession\'s colour - each profession told apart, none its compass colour whole; the core whiter still (mutants: the tint whole; the light white)', () => {
  const out = [0, 0, 0];
  for (const p of ['herbalism', 'mining', 'logging', 'hunting', 'fishing']) {
    const rgb = nodeMarkRgb(p), got = [...glintTint(rgb, out)];
    assert.deepEqual(got.map((v) => +v.toFixed(9)), rgb.map((c, i) => +(GLINT_LIGHT[i] * (1 - GLINT_TINT) + c * GLINT_TINT).toFixed(9)), p);
  }
  assert.equal(glintTint([0, 0, 0], out), out, 'written into out');
  const a = [...glintTint(nodeMarkRgb('herbalism'), [0, 0, 0])], b = [...glintTint(nodeMarkRgb('mining'), [0, 0, 0])];
  assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > 0.05, 'the professions still told apart');
});

test('NODE-GLINT the sheen: none within GLINT_SHEEN_NEAR_M, rising smoothly to GLINT_GAIN.sheen at GLINT_SHEEN_FULL_M and held beyond; every rate whole over the glow\'s 60 s clock (mutants: the near fade gone; the far gain short)', () => {
  assert.equal(glintSheen(0), 0);
  assert.equal(glintSheen(GLINT_SHEEN_NEAR_M), 0);
  assert.equal(glintSheen(GLINT_SHEEN_FULL_M), GLINT_GAIN.sheen);
  assert.equal(glintSheen(120), GLINT_GAIN.sheen);
  assert.ok(Math.abs(glintSheen((GLINT_SHEEN_NEAR_M + GLINT_SHEEN_FULL_M) / 2) - GLINT_GAIN.sheen / 2) < 1e-12, 'half way, half');
  assert.equal(glintRatesWhole(), true);
  assert.deepEqual([GLINT_SHEEN_HZ, GLINT_RATE, GLINT_RATE_STEP].map((r) => Math.round(r * 60)), [9, 21, 3]);
});

/** The state renderer.flatLightAt reads (test/systems/machij_sprites_and_chat.test.js's lightState): the world's own terms. */
const lightState = (over = {}) => ({
  _clockLit: true, _ambient: [0, 0, 0], _moonColor: [0, 0, 0], _moonScale: 0, _sunColor: [0, 0, 0], _sunScale: 0, _camPos: [0, 0, 0],
  _pointLights: new Float32Array(0), _pointColors: null, _pointColor: [1, 1, 1], _pointColorScratch: new Float32Array(48), _lane: null,
  _indirect: [0, 0, 0, 0], _indirectColor: [0, 0, 0], _pointColorData: Renderer.prototype._pointColorData, ...over,
});
const hex3 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

test('GLINT-LIGHT the light where a node stands (the owner, at night and underground: "Follow the light"): its level the 601 luma of the light its flat takes; the sheen none at GLINT_SHEEN_DARK and under, whole from GLINT_SHEEN_LIT - and the clock\'s own hours where the record puts them: every night and a storm\'s noon dark, a moonless one at the flats\' floor; a clear day whole from its first hour (mutants: the weights; the dark edge; the lit edge)', () => {
  assert.equal(glintLightLevel([1, 1, 1]), 1);
  assert.deepEqual([[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((c) => +glintLightLevel(c).toFixed(12)), [0.299, 0.587, 0.114], 'the 601 weights');
  for (const g of [0, FLAT_LIGHT_FLOOR, 0.5, 1]) assert.equal(glintLightLevel([g, g, g]), g, 'a grey light\'s level that grey exactly');
  assert.equal(glintSheenLight(0), 0);
  assert.equal(glintSheenLight(GLINT_SHEEN_DARK), 0);
  assert.equal(glintSheenLight(GLINT_SHEEN_LIT), 1);
  assert.equal(glintSheenLight(1), 1);
  assert.ok(Math.abs(glintSheenLight((GLINT_SHEEN_DARK + GLINT_SHEEN_LIT) / 2) - 0.5) < 1e-12, 'half way, half');
  // the clock's light at a node: its ambient (and the moons' - EV5), the sun's key at its weather's scale, through the
  // renderer's own composition at the floor the pass asks it at
  const level = (minute, wx = 1, moons = null) => glintLightLevel(Renderer.prototype.flatLightAt.call(lightState({
    _ambient: withMoonAmbient(exteriorAmbient(minute, 1, wx), moons), _sunColor: SUN_RIG_COLOR, _sunScale: sunScale(minute) * wx,
    _moonColor: moons?.color ?? [0, 0, 0], _moonScale: moons?.scale ?? 0,
  }), [0, 0, 0], FLAT_LIGHT_FLOOR, [0, 0, 0]));
  const full = moonlightTerm({ daylight: 0, masser: { phase: 4, vis: 1, dir: [0, 1, 0], color: hex3(MOONS.masser.color) }, secunda: { phase: 4, vis: 1, color: hex3(MOONS.secunda.color) } });
  const hours = { moonless: level(0), moonlit: level(0, 1, full), storm: level(720, 0.25), rain: level(720, 0.45), firstHour: level(420), overcast: level(720, 0.65), noon: level(720) };
  assert.deepEqual(Object.fromEntries(Object.entries(hours).map(([k, v]) => [k, +v.toFixed(2)])),
    { moonless: 0.25, moonlit: 0.39, storm: 0.35, rain: 0.48, firstHour: 0.59, overcast: 0.66, noon: 1 }, 'the record\'s numbers are the clock\'s');
  assert.equal(hours.moonless, FLAT_LIGHT_FLOOR, 'a moonless night: the flats\' floor - its glints a quarter of the day\'s, never less');
  for (const k of ['moonless', 'moonlit', 'storm']) assert.equal(glintSheenLight(hours[k]), 0, `${k}: no sheen`);
  for (const k of ['firstHour', 'overcast', 'noon']) assert.equal(glintSheenLight(hours[k]), 1, `${k}: the sheen whole`);
  assert.ok(glintSheenLight(hours.rain) > 0 && glintSheenLight(hours.rain) < 1, 'a rainy noon between');
  // a mine with no lamp near: the floor; a lamp beside the vein: lit (renderer.flatLightAt's own falloff)
  const mine = lightState({ _ambient: [0.12, 0.12, 0.12] });
  assert.equal(glintLightLevel(Renderer.prototype.flatLightAt.call(mine, [0, 0, 0], FLAT_LIGHT_FLOOR, [0, 0, 0])), FLAT_LIGHT_FLOOR);
  const lamp = lightState({ _ambient: [0.12, 0.12, 0.12], _pointLights: new Float32Array([0.5, 0, 0, 8]), _pointColors: new Float32Array([1, 0.8, 0.5]) });
  assert.equal(glintSheenLight(glintLightLevel(Renderer.prototype.flatLightAt.call(lamp, [0, 0, 0], FLAT_LIGHT_FLOOR, [0, 0, 0]))), 1, 'a vein beside a lamp catches it whole');
});

test('GLINT-LIGHT renderer.flatLightAt writes into the `out` it is handed (one a pass, no array a node a frame) - white in a scene with no clock, its own answer otherwise, the same numbers a new array holds (mutants: the clockless light a new array)', () => {
  const out = [9, 9, 9];
  assert.equal(Renderer.prototype.flatLightAt.call(lightState({ _clockLit: false }), [0, 0, 0], FLAT_LIGHT_FLOOR, out), out);
  assert.deepEqual(out, [1, 1, 1]);
  const st = lightState({ _ambient: [0.4, 0.3, 0.2], _sunColor: [0.6, 0.6, 0.6], _sunScale: 1 });
  assert.equal(Renderer.prototype.flatLightAt.call(st, [0, 0, 0], FLAT_LIGHT_FLOOR, out), out);
  assert.deepEqual(out, Renderer.prototype.flatLightAt.call(st, [0, 0, 0]));
  assert.deepEqual(out.map((v) => +v.toFixed(9)), [0.7, 0.6, 0.5]);
});

test('NODE-GLINT screenRect, widenRect, snapRect and innerShare: a node\'s boxes through the camera to its picture on screen, kept within GLINT_OVERHANG past the screen (its glints\' shares stand as it slides off); off it, none; AUDIT NODE-GLINT: a box wholly behind the eye none (it was the whole screen), one across the eye\'s plane bounded where its edges cross it - beside the eye, none; widened by the room its rays take and held to the screen; snapped out to whole pixels; the picture\'s box as its shares of that rectangle (mutants: a corner skipped; the overhang unkept; behind the eye taken; the crossing unclipped; the widening unapplied; the widening unheld; the snap rounding in; the share off its corner)', () => {
  // an identity projection: NDC is x, y
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const out = [0, 0, 0, 0];
  screenRect([[-0.2, -0.1, 0, 0.4, 0.3, 0]], 1, I, out);
  assert.deepEqual(out.map((v) => +v.toFixed(9)), [0.1, 0.1, 0.3, 0.2]);
  screenRect([[-0.2, -0.1, 0, 0, 0, 0], [0.1, 0.1, 0, 0.4, 0.3, 0]], 2, I, out);
  assert.deepEqual(out.map((v) => +v.toFixed(9)), [0.1, 0.1, 0.3, 0.2], 'every box, every corner');
  screenRect([[-0.2, -0.1, 0, 0, 0, 0], [5, 5, 0, 6, 6, 0]], 1, I, out);
  assert.deepEqual(out.map((v) => +v.toFixed(9)), [-0.1, -0.05, 0.1, 0.05], 'the first `count` alone');
  screenRect([[0.8, 0.8, 0, 1.5, 1.5, 0]], 1, I, out);
  assert.deepEqual(out.map((v) => +v.toFixed(9)), [1.15, 1.15, 0.35, 0.35], 'past the screen\'s edge, kept whole');
  screenRect([[0.5, 0.5, 0, 9, 9, 0]], 1, I, out);
  assert.deepEqual(out.map((v) => +v.toFixed(9)), [1.25, 1.25, 0.75, 0.75], 'within the overhang');
  assert.equal(screenRect([[2, 2, 0, 3, 3, 0]], 1, I, out), null, 'off the screen');
  const behind = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1, 0, 0, 0, 0];   // w = -z: z >= 0 is behind
  assert.equal(screenRect([[0, 0, 0.5, 0.1, 0.1, 1]], 1, behind, out), null, 'wholly behind the eye: none');
  assert.deepEqual(screenRect([[0, 0, -1, 0.1, 0.1, 0.5]], 1, behind, out)?.map((v) => +v.toFixed(9)), [1, 1, 1, 1], 'across the eye\'s plane: from its corners before the eye to where its edges cross (here past the overhang)');
  assert.equal(screenRect([[-5, 0, -1, -4, 0.1, 1]], 1, behind, out), null, 'across the plane beside the eye: off the screen, none');
  assert.deepEqual(screenRect([[-0.2, -0.1, -2, 0.4, 0.3, -1], [0, 0, 0.5, 1, 1, 1]], 2, behind, out)?.map((v) => +v.toFixed(9)), [0.1, 0.1, 0.3, 0.2], 'a box behind the eye adds nothing to one before it');
  const wide = [0, 0, 0, 0];
  assert.deepEqual(widenRect([0.1, 0.1, 0.3, 0.2], [0.05, 0.1], wide).map((v) => +v.toFixed(9)), [0.1, 0.1, 0.35, 0.3], 'widened each way');
  assert.deepEqual(widenRect([0.85, -0.85, 0.1, 0.1], [0.1, 0.1], wide).map((v) => +v.toFixed(9)), [0.825, -0.825, 0.175, 0.175], 'held to the screen (0.65..1.05 to 0.65..1)');
  const r = [0.1, -0.2, 0.0731, 0.0517];
  const was = [r[0] - r[2], r[0] + r[2], r[1] - r[3], r[1] + r[3]];
  snapRect(r, 640, 480);
  const px = [(r[0] - r[2] + 1) * 320, (r[0] + r[2] + 1) * 320, (r[1] - r[3] + 1) * 240, (r[1] + r[3] + 1) * 240];
  for (const v of px) assert.ok(Math.abs(v - Math.round(v)) < 1e-9, `whole pixels (${v})`);
  assert.ok(r[0] - r[2] <= was[0] + 1e-12 && r[0] + r[2] >= was[1] - 1e-12 && r[1] - r[3] <= was[2] + 1e-12 && r[1] + r[3] >= was[3] - 1e-12, 'snapped out, never in');
  const share = innerShare([0.1, 0.1, 0.3, 0.2], [0.1, 0.1, 0.4, 0.4], [0, 0, 0, 0]);
  assert.deepEqual(share.map((v) => +v.toFixed(9)), [0.125, 0.25, 0.875, 0.75], 'the picture\'s box within its rectangle');
  assert.deepEqual(innerShare([0.2, 0.3, 0.5, 0.5], [0.2, 0.3, 0.5, 0.5], [0, 0, 0, 0]), [0, 0, 1, 1], 'the whole of it');
  assert.deepEqual(innerShare([1, 0, 0.5, 0.5], [0.75, 0, 0.25, 0.5], [0, 0, 0, 0]), [0, 0, 2, 1], 'past the screen: shares past 1 (no glint stands there)');
});

test('NODE-GLINT the programs: the mask\'s vertex stage is the billboard program\'s own with the rectangle stretched over the tile after it, never moving a vertex given way; its fragment stage the picture\'s cut; AUDIT NODE-GLINT: each glint found once for the node in the light\'s vertex stage - each node its own seed, each life its own spot and turn, the life numbered on the clock\'s own wrap, its light never NaN, the first of its tries in the picture\'s box on the screen that the silhouette holds round it, none a dark life, handed on flat; the fragment stage the sheen inside the silhouette and never still, each glint\'s star about its spot, nothing lit nothing drawn, at the nearer picture, stood toward the eye never past half its way, faded in the fog, the haze and the sea\'s murk (mutants: the remap moving a gone vertex; every node one seed; a spot never chosen afresh; the wrap unkept; a negative flash; the hold unasked; a spot off the screen taken; a dark life lit; the still glints moving; the sheen outside the picture; the sheen under reduced motion; the depth its own texel\'s; the light behind its node; the pull past the eye; the murk ignored)', () => {
  const bb = src('src/render/renderer.js');
  assert.ok(NODE_MASK_VS.startsWith('#version 300 es'));
  assert.ok(NODE_MASK_VS.includes('if (uMesh > 0.5) {') && NODE_MASK_VS.includes('if (gone) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);'), 'BB_VS whole');
  assert.ok(bb.includes('if (gone) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);'));
  assert.match(NODE_MASK_VS, /if \(gone\) gl_Position = vec4\(2\.0, 2\.0, 2\.0, 1\.0\);[^\n]*\n\s*if \(!gone\) gl_Position\.xy = \(gl_Position\.xy - uMaskRect\.xy \* gl_Position\.w\) \* uMaskRect\.zw;/, 'the remap after the vertex is placed, a gone one left off the clip volume');
  assert.match(NODE_MASK_FS, /if \(a < 0\.5\) discard;/);
  assert.match(NODE_MASK_FS, /a = vAlpha > 0\.0 \? a \* vAlpha : 1\.0;/, 'a tree\'s material cut, an opaque card never');
  assert.match(NODE_MASK_FS, /bayer4\(gl_FragCoord\.xy\) \+ 0\.03125 >= vFade/, 'the handover\'s screen-door');
  const vs = NODE_GLINT_VS, fs = NODE_GLINT_FS;
  assert.ok(vs.startsWith('#version 300 es') && fs.startsWith('#version 300 es'));
  // PIN MOVED (FIELD BUGS 2026-10-25i NODE-CROWN, AUDIT FB1025i C1): a glint's life is one law both stages read (the
  // vertex stage its spot, the fragment stage its turn - no turn handed on, a big crown's twelve in a herb's six's varyings)
  for (const st of [vs, fs]) {
    assert.ok(st.includes('uint glintSeed() { return uint(uSeed * 1009.0 + 0.5) * 2654435761u; }') && st.includes('  uint seed = glintSeed();'), 'each node its own seed');
    assert.ok(st.includes('float glintLife(int i, uint seed, float tm, out uint life) {'), 'the life, one law');
  }
  assert.ok(vs.includes(`  float lives = ${f4(GLINT_RATE * 60)} + float(i) * ${f4(GLINT_RATE_STEP * 60)};`), 'a glint\'s lives a period');
  assert.ok(vs.includes('  float cyc = tm * lives / 60.0 + glintRand(seed ^ (ui * 0x9e3779b9u));'));
  assert.ok(vs.includes('  float c = mod(floor(cyc), lives);'), 'the life at the wrap the life at zero');
  assert.ok(vs.includes(`  float env = uStill > 0.5 ? ${f4(GLINT_STILL)} : pow(max(sin(PI * fract(cyc)), 0.0), ${f4(GLINT_FLASH)});`), 'born and gone dark, never NaN; still, steady');
  assert.ok(vs.includes('  life = glintHash(seed + ui * 0x85ebca6bu + uint(c) * 0xc2b2ae35u);'), 'each life its own spot');
  assert.ok(fs.includes('  return (glintRand(life ^ 0x5bd1e995u) - 0.5) * 0.6;'), 'and its own turn, within 17 degrees');
  assert.ok(fs.includes('  glintLife(i, seed, tm, life);   // NODE-CROWN: the life the vertex stage stood it at, its turn its own\n  float th = glintTurn(life);'), 'the turn of the life its spot stands at');
  assert.ok(vs.includes('  if (i >= uCount) return vec4(0.0, 0.0, 1.0, 0.0);'), 'NODE-CROWN: past the node\'s own count, none');
  assert.ok(vs.includes(`  for (int j = 0; j < ${GLINT_TRIES}; j++) {`), 'its tries');
  assert.ok(vs.includes('    int k = int(h % uint(max(uAnchors, 1)));'), 'one of the node\'s pictures');
  assert.ok(vs.includes('    vec4 cp = uVP * vec4(a.xyz + uRight * ((uv.x - 0.5) * a.w) + uUp * (uv.y * b.x), 1.0);'), 'a point of it, in the plane it stands in - moving with it as the eye moves');
  assert.ok(vs.includes(`    if (cp.w <= ${f4(NG.GLINT_NEAR_W)}) continue;`), 'before the eye');
  assert.ok(vs.includes('    vec2 spot = (cp.xy / cp.w - uRect.xy) / uRect.zw * 0.5 + 0.5;'), 'the rectangle\'s shares');
  assert.ok(vs.includes('  if (uAnchors < 1) return vec4(0.0, 0.0, 1.0, 0.0);'), 'no picture, no glint');
  assert.ok(vs.includes('    if (b.y > 0.5) {   // a flat: its own picture judges the point, and its depth is the point\'s own\n      if (opaque(uv)) return vec4(spot, cp.z / cp.w * 0.5 + 0.5, env);\n      continue;\n    }'), 'a flat judged at its own texel, at its own depth - it holds as the eye moves');
  assert.ok(vs.includes('bool opaque(vec2 uv) { return textureLod(uFlatTex, uv, 0.0).a >= 0.5; }'), 'the picture\'s own cut');
  assert.ok(vs.includes('    if (spot.x < 0.0 || spot.y < 0.0 || spot.x > 1.0 || spot.y > 1.0) continue;'), 'on the screen');
  assert.ok(vs.includes('    if (d < 1.0 && holds(at, lo, hi)) return vec4(spot, d, env);'), 'the first the silhouette holds round it');
  assert.ok(vs.includes('  return maskAt(at + vec2(uHold, 0.0), lo, hi) < 1.0 && maskAt(at - vec2(uHold, 0.0), lo, hi) < 1.0\n    && maskAt(at + vec2(0.0, uHold), lo, hi) < 1.0 && maskAt(at - vec2(0.0, uHold), lo, hi) < 1.0;'), 'held round on every side');
  assert.ok(vs.includes('  return vec4(0.0, 0.0, 1.0, 0.0);   // no try held: this life is dark'));
  assert.ok(vs.includes('  float tm = uTime * (1.0 - uStill);'), 'still: every life held at its first');
  for (let i = 0; i < NG.GLINT_CROWN_COUNT; i++) {   // NODE-CROWN: every slot a big crown lights
    assert.ok(vs.includes(`flat out vec4 vGlint${i};`) && fs.includes(`flat in vec4 vGlint${i};`), `glint ${i} handed on flat`);
    assert.ok(vs.includes(`  vGlint${i} = glintOf(${i}, seed, tm);`), `glint ${i} found`);
    assert.ok(fs.includes(`  glintAt(vGlint${i}, ${i}, seed, tm, q, rectPx, parts, best, bestDepth);`), `glint ${i} drawn`);
  }
  assert.equal((vs.match(/flat out /g) ?? []).length, NG.GLINT_CROWN_COUNT, 'a vec4 a glint and nothing more: no turn handed on');
  assert.ok(!vs.includes(`vGlint${NG.GLINT_CROWN_COUNT}`), 'no slot past them');
  assert.ok(fs.includes('  if (here < 1.0 && uStill < 0.5) {'), 'the sheen inside the silhouette alone, and never still');
  assert.ok(fs.includes(`fract(tm * ${f4(GLINT_SHEEN_HZ)} + uSeed) / ${f4(GLINT_SHEEN_SHARE)}`), 'crossing at its rate, dark the rest of its period');
  assert.ok(fs.includes('    sheen = exp(-k * k) * uSheen;'), 'at its gain (none near)');
  assert.ok(fs.includes('  if (g.w <= 0.0) return;   // a dark life'));
  assert.ok(fs.includes('  vec2 off = (q - g.xy) * rectPx;'), 'measured in the screen\'s pixels');
  assert.ok(fs.includes(`  float lit = sheen + ${f4(GLINT_GAIN.ray)} * parts.y + ${f4(GLINT_GAIN.bloom)} * parts.z + ${f4(GLINT_GAIN.core)} * parts.x;`));
  assert.ok(fs.includes('  if (lit * uAlpha < 0.002) discard;'), 'nothing lit, nothing drawn');
  assert.ok(fs.includes('  float dep = min(here, bestDepth);'), 'the nearer picture: a front card never hides its own light, a ray past the picture at its glint\'s');
  assert.ok(fs.includes(`at3 - away * (min(${f4(GLINT_PULL)}, 0.5 * far) / max(far, 1e-4))`), 'stood toward the eye, never past half its way');
  assert.ok(fs.includes(`mix(uColor, vec3(1.0), ${f4(GLINT_CORE_WHITE)}) * ${f4(GLINT_GAIN.core)} * parts.x`), 'the core whiter');
  assert.ok(fs.includes('  o = vec4(dwWaterFogAdd(light * uAlpha * fogFactorAt(at3), at3), 1.0);'), 'kindled, faded, fogged and murked');
  assert.equal(GLINT_MAX, NODE_GLOW_MAX, 'a tile for every node the glow could light');
  assert.equal(GLINT_MAX, GLINT_GRID * GLINT_GRID);
  assert.match(bb, /BB_QUAD_INDEX_BYTES = 6 \* 4;/);
});

// ─── THE DRAW ────────────────────────────────────────────────────────

/** A WebGL2 that records every call; the viewport 640 x 480 at (8, 4), the frame's target a token; `scissor` a scissor
 *  in force. */
function fakeGl({ scissor = false } = {}) {
  const calls = [];
  const C = { VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, BLEND: 9, CULL_FACE: 11,
    DEPTH_TEST: 12, LESS: 13, VIEWPORT: 14, FRAMEBUFFER_BINDING: 15, FRAMEBUFFER: 16, TEXTURE_2D: 17, DEPTH_COMPONENT24: 18, DEPTH_ATTACHMENT: 19, NONE: 20,
    ELEMENT_ARRAY_BUFFER: 21, UNSIGNED_INT: 22, DYNAMIC_DRAW: 23, SCISSOR_TEST: 24, TEXTURE0: 25, DEPTH_BUFFER_BIT: 26, ONE: 27, TEXTURE1: 28,
    TEXTURE_MIN_FILTER: 29, TEXTURE_MAG_FILTER: 30, NEAREST: 31, TEXTURE_WRAP_S: 32, TEXTURE_WRAP_T: 33, CLAMP_TO_EDGE: 34 };
  let n = 0;
  const gl = new Proxy(C, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => {
        calls.push([k, ...a]);
        if (k === 'getShaderParameter' || k === 'getProgramParameter') return true;
        if (k === 'getUniformLocation') return a[1];
        if (k === 'getParameter') return a[0] === C.VIEWPORT ? new Int32Array([8, 4, 640, 480]) : a[0] === C.FRAMEBUFFER_BINDING ? 'frame-target' : null;
        if (k === 'isEnabled') return scissor && a[0] === C.SCISSOR_TEST;
        return { id: ++n, kind: k };
      };
    },
  });
  return { gl, calls };
}
const PROJ = new Float32Array([1.5, 0, 0, 0, 0, 2, 0, 0, 0, 0, -1.001, -1, 0, 0, -0.1, 0]);
const VIEW = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -1.6, 0, 1]);
const mul4 = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const fakeRenderer = (gl, frames = []) => ({ gl, _proj: PROJ, _view: VIEW, _camPos: new Float32Array([0, 1.6, 0]), _bbRight: new Float32Array([1, 0, 0]), _bbUp: new Float32Array([0, 1, 0]),
  _fogMode: 0, _fogRange: [0, 1], _haze: new Float32Array(8), _dwFog: new Float32Array(20),
  textures: new Map([['500_9', { tex: 'herb' }], ['504_3', { tex: 'far' }]]), lptDrawnFrames: () => frames });

test('NODE-GLINT the draw over a fake GL: nothing to light touches nothing; each node\'s pictures drawn into its own tile of the atlas - a flat\'s own six indices (its batch\'s range, from its first), a 3D tree its run\'s every submesh as one instance - then the frame\'s target and viewport back and one quad a node, added (ONE, ONE) with no depth written, in its light, kindling, seed, reach, hold, picture\'s box and sheen by its distance, the room its rays take on every side; the clock, reduced motion, the haze and the sea\'s murk handed; the baseline handed back (mutants: the tile shared; the offset its batch\'s first flat; the target not given back; the viewport not given back; the light not added; the depth written; the colour whole; the sheen by no distance; the reach by the room; the room halved; the seed lost; the hold unsent; the clock unhanded; the haze unsent; the murk unsent)', () => {
  const { gl, calls } = fakeGl();
  const r = new NodeGlintRenderer(/** @type {any} */ (gl));
  const subTex = { tex: 'leaf' };
  const handle = { h: 1 }, c = [0, 0, -12];
  const frame = { eye: [0, 1.6, 0], radius: 140, band: 20, gpu: { vb: 'vb', ib: 'ib' }, cut: new Set([handle]), runs: [{ run: { handle }, scale: [1, 1, 1], size: [6, 10], sway: 0, subs: [{ offset: 96, count: 30, tex: subTex, alpha: 2, cull: 0 }, { offset: 216, count: 12, tex: subTex, alpha: 0, cull: 2 }] }] };
  const renderer = fakeRenderer(gl, [frame, null]);
  calls.length = 0;
  assert.equal(r.draw([], renderer, 0), 0);
  assert.equal(calls.length, 0, 'nothing to light, nothing touched');
  const batch = { archive: 500, record: 9, frame: null, vao: 'herb-vao', _ibOff: 4800, size: { w: 1, h: 1 }, origin: [0, 0, 0] };
  const forest = { archive: 504, record: 3, frame: null, vao: 'forest-vao', _ibOff: 0, size: { w: 6, h: 10 }, origin: [0, 0, 0], lptProto: handle };
  const set = { trees: new Float32Array([0, ...c, 1, 0.3]), centers: [c], handles: [handle], ox: 0, oy: 0, oz: 0 };
  const herbAt = [1, 0, -6];
  const list = [
    { alpha: 1, seed: 0.25, at: herbAt, rgb: nodeMarkRgb('herbalism'), mark: { pictures: [{ batch, first: 2, count: 3, centers: [[1, 0, -6], [1.3, 0, -6.2], [0.8, 0, -5.8]] }] } },
    { alpha: 0.5, seed: 0.75, at: c, rgb: nodeMarkRgb('logging'), mark: { pictures: [{ batch: forest, first: 0, count: 1, centers: [c], center: c, entry: { lowPolyTrees: set } }] } },
    { alpha: 0, seed: 0.5, at: [0, 0, -3], rgb: nodeMarkRgb('mining'), mark: { pictures: [{ batch, first: 0, count: 1, centers: [[0, 0, -3]] }] } },
  ];
  calls.length = 0;
  assert.equal(r.draw(list, renderer, 2.5, true), 2, 'the unkindled one none');
  assert.equal(r.trees, 1);
  const at = (k, ...a) => calls.findIndex((x) => x[0] === k && a.every((v, i) => x[i + 1] === v));
  // the masks: into the atlas, a tile a node
  const toAtlas = at('bindFramebuffer', gl.FRAMEBUFFER, r.fb), back = at('bindFramebuffer', gl.FRAMEBUFFER, 'frame-target');
  assert.ok(toAtlas >= 0 && back > toAtlas, 'into the atlas, then the frame\'s own target back');
  const tiles = calls.slice(toAtlas, back).filter((x) => x[0] === 'viewport').slice(1).map((x) => x.slice(1, 3));
  assert.deepEqual(tiles, [[0, 0], [GLINT_TILE, 0]], 'its own tile each');
  const flats = calls.slice(toAtlas, back).filter((x) => x[0] === 'drawElements');
  assert.deepEqual(flats.map((x) => x.slice(2)), [[18, gl.UNSIGNED_INT, 4800 + 2 * 24], [6, gl.UNSIGNED_INT, 0]], 'the herb\'s three flats from its first; the tree\'s far picture (its handover the billboard program\'s)');
  const trees = calls.slice(toAtlas, back).filter((x) => x[0] === 'drawElementsInstanced');
  assert.deepEqual(trees.map((x) => x.slice(2)), [[30, gl.UNSIGNED_INT, 96, 1], [12, gl.UNSIGNED_INT, 216, 1]], 'every submesh of its run, one instance');
  assert.ok(calls.some((x) => x[0] === 'bufferSubData' && x[3] instanceof Float32Array && x[3][0] === c[0] && x[3][2] === c[2]), 'its instance row written');
  assert.ok(calls.some((x) => x[0] === 'vertexAttribDivisor' && x[1] === 3 && x[2] === 1), 'the door\'s buffers under the pass\'s own instance');
  // the light: on the frame's target, its viewport back, added with no depth written
  const light = calls.slice(back);
  assert.deepEqual(light[1], ['viewport', 8, 4, 640, 480], 'its viewport back');
  const firstQuad = light.findIndex((x) => x[0] === 'drawArrays');
  assert.ok(light.slice(0, firstQuad).some((x) => x[0] === 'blendFunc' && x[1] === gl.ONE && x[2] === gl.ONE), 'added onto the frame: it only brightens');
  assert.ok(light.slice(0, firstQuad).some((x) => x[0] === 'depthMask' && x[1] === false), 'tested against the world\'s depth, never writing it');
  assert.equal(light.filter((x) => x[0] === 'drawArrays').length, 2, 'one quad a node');
  const u = (name) => light.filter((x) => x[0].startsWith('uniform') && x[1] === name).map((x) => x.slice(2));
  assert.deepEqual(u('uTime'), [[2.5]], 'the clock handed');
  assert.deepEqual(u('uStill'), [[1]], 'reduced motion handed');
  assert.deepEqual(u('uJungleHaze'), [[renderer._haze]], 'the jungle\'s haze, the frame\'s');
  assert.deepEqual(u('uDwFog'), [[renderer._dwFog]], 'the sea\'s murk, the frame\'s');
  assert.deepEqual([u('uRight'), u('uUp')], [[[renderer._bbRight]], [[renderer._bbUp]]], 'the plane the pictures stand in, the flats\' own');
  // the pictures its glints stand on: the herb's three flats (base, width, height - each judged by the herb's own picture),
  // the tree's crown about its root (judged by the silhouette)
  const anchors = u('uAnchor').map(([arr, off, len]) => Array.from(arr.slice(off, off + len)).map((v) => +v.toFixed(5)));
  assert.deepEqual(anchors, [
    [1, 0, -6, 1, 1, 1, 0, 0, 1.3, 0, -6.2, 1, 1, 1, 0, 0, 0.8, 0, -5.8, 1, 1, 1, 0, 0],
    [0, 0, -12, 2 * 6 * GLINT_TREE_REACH, 10, 0, 0, 0].map((v) => +v.toFixed(5)),
  ]);
  assert.deepEqual(u('uAnchors'), [[3], [1]]);
  assert.deepEqual(u('uFlatTex'), [[1]], 'the flats\' picture on unit 1');
  const onUnit1 = [];
  light.forEach((x, i) => { if (x[0] === 'activeTexture' && x[1] === gl.TEXTURE1 && light[i + 1]?.[0] === 'bindTexture') onUnit1.push(light[i + 1][2]); });
  assert.deepEqual(onUnit1, [renderer.textures.get('500_9'), null, null], 'the herb\'s own picture for the herb, none for the tree, unit 1 cleared at the end');
  assert.deepEqual(u('uColor').map((v) => v.map((x) => +x.toFixed(6))), [glintTint(nodeMarkRgb('herbalism'), [0, 0, 0]), glintTint(nodeMarkRgb('logging'), [0, 0, 0])].map((v) => v.map((x) => +x.toFixed(6))), 'each its light, never its compass colour whole');
  assert.deepEqual(u('uAlpha'), [[1], [0.5]], 'its kindling');
  assert.deepEqual(u('uSeed'), [[0.25], [0.75]], 'its own seed');
  const eye = renderer._camPos;
  const want = [herbAt, c].map((p) => glintSheen(Math.hypot(p[0] - eye[0], p[1] - eye[1], p[2] - eye[2])));
  assert.deepEqual(u('uSheen').map((v) => +v[0].toFixed(9)), want.map((v) => +v.toFixed(9)), 'the sheen by its distance');
  assert.ok(want[0] < want[1], 'nearer, fainter');
  const reach = u('uGlint').map((v) => v[0]), shares = u('uInner'), holds = u('uHold').map((v) => v[0]);
  // PIN MOVED (FIELD BUGS 2026-10-25i NODE-CROWN, AUDIT FB1025i C1): the herb's six at its picture's reach, as they were;
  // the 3D tree's grown by its crown on screen - its standing width (6 m) and height (10 m) at its root, 12 m off
  const crown = NG.crownSidePx(PROJ, 12, 6, 10, 640, 480);
  assert.deepEqual(u('uCount'), [[GLINT_COUNT], [NG.glintCrownCount(480, crown)]], 'a flat\'s six; a big crown\'s more');
  assert.equal(NG.glintCrownCount(480, crown), NG.GLINT_CROWN_COUNT, '(this one the most)');
  assert.equal(reach[1], NG.glintCrownPx(480, crown), 'the crown\'s reach grown');
  assert.ok(reach[1] > glintPxMax(480), 'past a flat\'s most');
  for (let i = 0; i < 2; i++) {
    const s = r._nodes[i];
    if (i === 0) assert.equal(reach[i], glintPx(480, Math.max(s.inner[2] * 640, s.inner[3] * 480)), 'its reach by its picture on screen');
    assert.deepEqual(shares[i], innerShare(s.inner, s.rect, [0, 0, 0, 0]), 'its picture\'s box in its rectangle');
    const fit = Math.min(1, GLINT_TILE / Math.max(Math.round(s.rect[2] * 640), Math.round(s.rect[3] * 480)));
    assert.equal(holds[i], Math.max(1, NG.GLINT_HOLD_PX * fit), 'its hold, in its tile\'s texels');
    // the room its rays take on every side the screen does not cut (a picture past the screen's edge keeps its box whole)
    for (const [a, rc, ic, side] of [[0, s.rect[0], s.inner[0], 320], [1, s.rect[1], s.inner[1], 240]]) {
      const rh = s.rect[a + 2], ih = s.inner[a + 2];
      const room = Math.max(glintPxMax(480), reach[i]) + 2;   // NODE-CROWN: a crown's longer rays their room
      if (rc - rh > -1 + 1e-9) assert.ok(((ic - ih) - (rc - rh)) * side >= room - 1e-6, `room below/left (${((ic - ih) - (rc - rh)) * side} px)`);
      if (rc + rh < 1 - 1e-9) assert.ok(((rc + rh) - (ic + ih)) * side >= room - 1e-6, `room above/right (${((rc + rh) - (ic + ih)) * side} px)`);
    }
  }
  assert.ok(holds[1] < holds[0] || holds[0] === NG.GLINT_HOLD_PX, 'a node fitted into its tile holds fewer texels');
  // the baseline handed back
  const last = calls.length - 1 - [...calls].reverse().findIndex((x) => x[0] === 'drawArrays');
  const after = calls.slice(last).map((x) => x.slice(0, 2).join(':'));
  for (const want2 of [`disable:${gl.BLEND}`, `depthMask:true`, `enable:${gl.CULL_FACE}`]) assert.ok(after.includes(want2), want2);
  assert.ok(!calls.some((x) => x[0] === 'enable' && x[1] === gl.SCISSOR_TEST), 'no scissor where none stood');
  // a far herb, a speck on screen: its reach its picture's share - under the most, never the room round it
  calls.length = 0;
  assert.equal(r.draw([{ alpha: 1, seed: 0.5, at: [0, 0, -60], rgb: nodeMarkRgb('herbalism'), mark: { pictures: [{ batch, first: 0, count: 1, centers: [[0, 0, -60]] }] } }], renderer, 0), 1);
  const speck = r._nodes[0], side = Math.max(speck.inner[2] * 640, speck.inner[3] * 480);
  const far = calls.filter((x) => x[0] === 'uniform1f' && x[1] === 'uGlint').map((x) => x[2]);
  assert.deepEqual(far, [glintPx(480, side)]);
  assert.ok(far[0] < glintPxMax(480) - 0.5 && Math.abs(far[0] - GLINT_SHARE * side) < 1e-9, `its share of its picture (${far[0]} px of a ${side} px picture)`);
  r.dispose();
  assert.ok(calls.some((x) => x[0] === 'deleteFramebuffer') && calls.some((x) => x[0] === 'deleteTexture') && calls.filter((x) => x[0] === 'deleteProgram').length === 3, 'EVERY ALLOCATION HAS AN OWNER');   // PIN MOVED (RESOURCE-HIGHLIGHTS): the mask's, the light's and the ring's
});

test('GLINT-LIGHT the draw: each node\'s light asked where it stands, at the flats\' floor, into the pass\'s one array - its glints as bright as that light, its sheen out in the dark and part in a dim one; a renderer that answers none lights it as the day (the draw above) (mutants: the light unread; the sheen lit in the dark; the floor not asked; the node\'s place not handed; an array a node)', () => {
  const { gl, calls } = fakeGl();
  const r = new NodeGlintRenderer(/** @type {any} */ (gl));
  const batch = { archive: 500, record: 9, frame: null, vao: 'herb-vao', _ibOff: 0, size: { w: 1, h: 1 }, origin: [0, 0, 0] };
  const night = [0.25, 0.25, 0.25], rain = [0.5, 0.45, 0.4], asked = [];
  const renderer = { ...fakeRenderer(gl), flatLightAt: (pos, floor, out) => { asked.push([pos, floor, out]); const l = pos[2] === -30 ? night : rain; out[0] = l[0]; out[1] = l[1]; out[2] = l[2]; return out; } };
  const dark = [0, 0, -30], dim = [2, 0, -40];
  const node = (at, alpha) => ({ alpha, seed: 0.5, at, rgb: nodeMarkRgb('herbalism'), mark: { pictures: [{ batch, first: 0, count: 1, centers: [at] }] } });
  assert.equal(r.draw([node(dark, 1), node(dim, 0.5)], renderer, 0), 2);
  assert.deepEqual(asked.map(([pos, floor]) => [pos, floor]), [[dark, FLAT_LIGHT_FLOOR], [dim, FLAT_LIGHT_FLOOR]], 'where each stands, at the flats\' floor');
  assert.ok(asked[0][2] === asked[1][2] && asked[0][2] === r._lit, 'into the pass\'s one array');
  const u = (name) => calls.filter((x) => x[0] === 'uniform1f' && x[1] === name).map((x) => +x[2].toFixed(9));
  const dimLevel = glintLightLevel(rain);
  assert.deepEqual(u('uAlpha'), [FLAT_LIGHT_FLOOR, 0.5 * dimLevel].map((v) => +v.toFixed(9)), 'its kindling times the light where it stands');
  const eye = renderer._camPos, far = (p) => glintSheen(Math.hypot(p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]));
  assert.ok(far(dark) === GLINT_GAIN.sheen && far(dim) === GLINT_GAIN.sheen, 'both far enough for the whole sheen by day');
  assert.deepEqual(u('uSheen'), [0, +(GLINT_GAIN.sheen * glintSheenLight(dimLevel)).toFixed(9)], 'none in the dark; part in a dim light');
  assert.ok(glintSheenLight(dimLevel) > 0 && glintSheenLight(dimLevel) < 1);
});

test('AUDIT NODE-GLINT the boxes: a node behind the eye draws nothing (it was a full-screen pass); a far tree\'s flat at its own scale (its batch sized for its tallest tree), none where its 3D tree stands; the 3D tree\'s crown scaled by its row; a batch the walk has not placed stands where its mark says; a scissor in force put aside for the atlas and given back (mutants: behind the eye taken; the flat\'s scale unread; the far flat boxed beside its 3D tree; the tree\'s reach unscaled; the mark\'s origin unread; the scissor not given back)', () => {
  const vp = mul4(PROJ, VIEW);
  const expect = (box) => screenRect([box], 1, vp, [0, 0, 0, 0]).map((v) => +v.toFixed(6));
  const got = (r) => r._nodes[0].inner.map((v) => +v.toFixed(6));
  const { gl, calls } = fakeGl({ scissor: true });
  const r = new NodeGlintRenderer(/** @type {any} */ (gl));
  const batch = { archive: 500, record: 9, frame: null, vao: 'herb-vao', _ibOff: 0, size: { w: 1, h: 1 }, origin: [0, 0, 0] };
  // behind the eye (the camera looks down -z from the origin)
  assert.equal(r.draw([{ alpha: 1, seed: 0.5, at: [0, 0, 8], rgb: [1, 1, 1], mark: { pictures: [{ batch, first: 0, count: 1, centers: [[0, 0, 8]] }] } }], fakeRenderer(gl), 0), 0, 'behind the eye: nothing drawn');
  // a far tree's flat at its own scale
  const forest = { archive: 504, record: 3, frame: null, vao: 'forest-vao', _ibOff: 0, size: { w: 6, h: 10 }, origin: [0, 0, 0], _scales: [1, 0.5] };
  r.draw([{ alpha: 1, seed: 0.5, at: [2, 0, -20], rgb: [1, 1, 1], mark: { pictures: [{ batch: forest, first: 1, count: 1, centers: [[2, 0, -20]] }] } }], fakeRenderer(gl), 0);
  assert.deepEqual(got(r), expect([2 - 1.5, 0, -20 - 1.5, 2 + 1.5, 5, -20 + 1.5]), 'half the batch\'s size: its own');
  assert.deepEqual([r._nodes[0].anchorN, ...Array.from(r._nodes[0].anchors.slice(0, 5))], [1, 2, 0, -20, 3, 5], 'and its glints stand on it at that size');
  // its 3D tree drawn: the crown alone, at its row's scale
  const handle = { h: 1 }, c = [2, 0, -20];
  const frame = { eye: [0, 1.6, 0], radius: 140, band: 20, gpu: { vb: 'vb', ib: 'ib' }, cut: new Set([handle]), runs: [{ run: { handle }, scale: [1, 1.2, 1], size: [6, 10], sway: 0, subs: [] }] };
  const set = { trees: new Float32Array([0, ...c, 1.5, 0]), centers: [c], handles: [handle], ox: 0, oy: 0, oz: 0 };
  r.draw([{ alpha: 1, seed: 0.5, at: c, rgb: [1, 1, 1], mark: { pictures: [{ batch: { ...forest, size: { w: 30, h: 40 }, lptProto: handle }, first: 0, count: 1, centers: [c], center: c, entry: { lowPolyTrees: set } }] } }], fakeRenderer(gl, [frame]), 0);   // a far picture larger than its crown: had its box stood, it would show
  // PIN MOVED (FIELD BUGS 2026-10-25i NODE-CROWN): the run's size is its prototype's standing size, its own scale (1.2
  // up) in it already (world/lowPolyTrees.js readLowPolyTrees) - its height the size at the row's scale, never the 1.2 again
  const reach = 6 * GLINT_TREE_REACH * 1.5, h = 10 * 1.5;
  assert.deepEqual(got(r), expect([2 - reach, 0, -20 - reach, 2 + reach, h, -20 + reach]), 'the crown at its row\'s scale, the far flat\'s box none');
  assert.deepEqual([r._nodes[0].anchorN, ...Array.from(r._nodes[0].anchors.slice(0, 5)).map((v) => +v.toFixed(5))], [1, 2, 0, -20, 2 * reach, h].map((v) => +v.toFixed(5)), 'its glints on the crown about its root, the far flat none');
  // a node of two batches (a dungeon vein's washes): the first's flats judged by its own picture, the second's by the silhouette
  const other = { archive: 504, record: 3, frame: null, vao: 'far-vao', _ibOff: 0, size: { w: 1, h: 1 }, origin: [0, 0, 0] };
  const two = fakeRenderer(gl);
  r.draw([{ alpha: 1, seed: 0.5, at: [0, 0, -8], rgb: [1, 1, 1], mark: { pictures: [{ batch, first: 0, count: 1, centers: [[0, 0, -8]] }, { batch: other, first: 0, count: 1, centers: [[0.5, 0, -8]] }] } }], two, 0);
  assert.deepEqual([r._nodes[0].anchorN, r._nodes[0].anchors[5], r._nodes[0].anchors[13]], [2, 1, 0], 'its own picture for the first batch\'s, the silhouette for the other\'s');
  assert.equal(r._nodes[0].flatTex, two.textures.get('500_9'), 'the first batch\'s picture bound for its flats');
  // a node of many flats: its glints stand on GLINT_ANCHORS of them, taken evenly
  const many = Array.from({ length: 20 }, (_, j) => [-2 + j * 0.2, 0, -10]);
  r.draw([{ alpha: 1, seed: 0.5, at: [0, 0, -10], rgb: [1, 1, 1], mark: { pictures: [{ batch, first: 0, count: 20, centers: many }] } }], fakeRenderer(gl), 0);
  assert.equal(r._nodes[0].anchorN, NG.GLINT_ANCHORS);
  assert.deepEqual(Array.from({ length: NG.GLINT_ANCHORS }, (_, i) => +r._nodes[0].anchors[i * 8].toFixed(5)), [0, 2, 5, 7, 10, 12, 15, 17].map((j) => +many[j][0].toFixed(5)), 'every few, across the whole patch');
  // a batch the walk has not placed: where its mark says
  calls.length = 0;
  r.draw([{ alpha: 1, seed: 0.5, at: [1, 0, -6], rgb: [1, 1, 1], mark: { origin: [0, 0, -4], pictures: [{ batch: { ...batch, origin: null }, first: 0, count: 1, centers: [[1, 0, -2]] }] } }], fakeRenderer(gl), 0);
  assert.deepEqual(got(r), expect([0.5, 0, -6.5, 1.5, 1, -5.5]), 'boxed in its mark\'s frame');
  assert.ok(calls.some((x) => x[0] === 'uniform3f' && x[1] === 'uOrigin' && x[2] === 0 && x[3] === 0 && x[4] === -4), 'and drawn in it');
  // the tile whole pixels: a rectangle whose rows the float carries a hair over (31, 62, 123... of 480) is no taller a tile
  let met = 0;
  for (let z = -2.5; z > -60; z -= 0.37) {
    r.draw([{ alpha: 1, seed: 0.5, at: [0, 0, z], rgb: [1, 1, 1], mark: { pictures: [{ batch, first: 0, count: 1, centers: [[0, 0.8, z]] }] } }], fakeRenderer(gl), 0);
    const nd = r._nodes[0], rows = Math.round(nd.rect[3] * 480), cols = Math.round(nd.rect[2] * 640);
    if (Math.max(rows, cols) > GLINT_TILE || nd.rect[3] * 480 === rows) continue;
    met++;
    assert.equal(nd.tile[3], rows, `a ${rows}-row rectangle a ${rows}-row tile`);
  }
  assert.ok(met > 0, 'a height the float carries over was met');
  // the scissor
  const off = calls.findIndex((x) => x[0] === 'disable' && x[1] === gl.SCISSOR_TEST), on = calls.findIndex((x) => x[0] === 'enable' && x[1] === gl.SCISSOR_TEST);
  const toAtlas = calls.findIndex((x) => x[0] === 'bindFramebuffer' && x[2] === r.fb), back = calls.findIndex((x) => x[0] === 'bindFramebuffer' && x[2] === 'frame-target');
  assert.ok(off >= 0 && off < toAtlas && on > back, 'put aside for the atlas, given back for the frame');
  r.dispose();
});

test('NODE-GLINT the world host\'s pass (createNodeGlintPass): a mark with pictures is lit by its glints, one with none goes to the glow; the programs built at IDLE once a node is first lit, nothing lit until they stand; a glint that will not build hands every mark to the glow; the clock wrapped at 60 s and reduced motion handed; a pass that drew is a foreign pass; null forgets; AUDIT NODE-GLINT: its end frees the glow it built for itself (not one handed), and an idle build after it builds nothing (mutants: every mark to the glow; the build on the frame; the clock unwrapped; reduced motion unread; its own glow kept; a handed glow freed; the end forgotten)', async () => {
  const { gl } = fakeGl();
  let foreign = 0;
  const renderer = { gl, _proj: new Float32Array(16), _view: new Float32Array(16), _camPos: new Float32Array([0, 1.6, 0]), markForeignPass: () => { foreign++; } };
  const glowed = [], lit = [], idled = [];
  let glowFreed = 0;
  const glow = { draw: (m) => { glowed.push(m ? m.map((x) => x.key) : null); return 0; }, dispose: () => { glowFreed++; } };
  const fake = { draw: (list, r, seconds, still) => { lit.push({ keys: list.map((g) => g.mark.key), seconds, still }); return list.length; }, dispose() {} };
  let t = 70, builds = 0, reduced = false;
  const pass = createNodeGlintPass(renderer, { glow, now: () => t, build: () => { builds++; return /** @type {any} */ (fake); }, idle: (fn) => idled.push(fn), reduced: () => reduced });
  const herb = { key: 'herb:1', profession: 'herbalism', at: [0, 0, -5], w: 2, h: 1, pictures: [{ batch: {}, first: 0, count: 1 }] };
  const body = { key: 'body:1', profession: 'hunting', at: [1, 0, -5], w: 1, h: 1, pictures: null };
  assert.equal(pass.draw([herb, body]), 0, 'not built: nothing lit');
  assert.deepEqual(glowed.at(-1), ['body:1'], 'the body to the glow at once');
  assert.equal(builds, 0, 'never built on a frame');
  assert.equal(idled.length, 1);
  idled[0]();
  assert.equal(builds, 1);
  t += 0.5;
  assert.equal(pass.draw([herb, body]), 1);
  assert.deepEqual(lit.at(-1), { keys: ['herb:1'], seconds: 10.5, still: false }, 'the clock wrapped');
  reduced = true; t += 0.25;
  pass.draw([herb]);
  assert.equal(lit.at(-1).still, true, 'reduced motion: still');
  assert.equal(foreign, 2, 'a foreign pass');
  pass.draw(null);
  assert.deepEqual(glowed.at(-1), null, 'null forgets, the glow\'s too');
  pass.dispose();
  assert.equal(glowFreed, 0, 'a glow handed in is the host\'s to free');
  const broken = createNodeGlintPass(renderer, { glow, now: () => t, build: () => { throw new Error('no GL'); }, idle: (fn) => fn(), reduced: () => false });
  broken.draw([herb]);
  broken.draw([herb, body]);
  assert.deepEqual(glowed.at(-1), ['herb:1', 'body:1'], 'a glint that will not build: every mark to the glow');
  // its own glow: built with it (for a body), freed with it; an idle build of the glint after its end builds nothing
  const own = fakeGl(), pending = [];
  let late = 0;
  const mine = createNodeGlintPass({ ...renderer, gl: own.gl }, { now: () => t, build: () => { late++; return /** @type {any} */ (fake); }, idle: (fn) => pending.push(fn), reduced: () => false });
  mine.draw([herb, body]);
  await new Promise((res) => setTimeout(res, 20));   // the glow's own idle build (PERF-WARM's wait)
  const before = own.calls.filter((x) => x[0] === 'deleteProgram').length;
  mine.dispose();
  for (const fn of pending) fn();
  assert.equal(late, 0, 'an idle build after the end builds nothing');
  assert.equal(mine.pass, null);
  assert.equal(own.calls.filter((x) => x[0] === 'deleteProgram').length - before, 1, 'its own glow\'s program freed with it');
  assert.match(src('src/render/nodeGlint.js'), /dispose\(\) \{ dead = true; asked = true; pass\?\.dispose\(\); pass = null; if \(handed === undefined\) glow\?\.dispose\?\.\(\); \},/, 'its own glow freed at its end');
});

// ─── THE WIRING ──────────────────────────────────────────────────────

test('NODE-GLINT the wiring: the world host lights the marks through the glint, the glow its fallback, in the hook after each mode\'s opaque world (the street\'s, a dungeon\'s), none under the travel view; the renderer keeps the flats\' basis and the 3D trees its frame drew, forgotten each frame; no ring remains (mutants: the glint unwired; the drawn trees never forgotten; the drawn trees never kept; no glow of its own)', () => {
  const w = src('src/scenes/world.js'), r = src('src/render/renderer.js');
  assert.match(w, /const nodeGlintPass = createNodeGlintPass\(renderer\);/);   // PIN MOVED (NODE-GLINT): the outline's pass, renamed - HOST-SPLIT's no entry in bootWorld stands
  assert.match(src('src/render/nodeGlint.js'), /const glow = handed === undefined \? createNodeGlowPass\(renderer\) : handed;/, 'the fallback glow its own when the host hands none');   // PIN MOVED (AUDIT NODE-GLINT): built where its end can free it
  assert.match(w, /const drawVeiledPeerBodies = \(\) => \{ peerBodies\?\.drawVeiled\(\); drawAuras\(\); nodeGlintPass\.draw\(travelView\?\.active \? null : nodeMarksAt\(enchantFeet\(\)\)\); partyPing\?\.draw\(renderer\); \};/);   // PARTY-PING: the route rides the same hook
  assert.doesNotMatch(w, /nodeGlowPass|nodeOutline/, 'the glow is the glint\'s fallback alone, and the ring is gone');
  // PIN MOVED (the seams review's matrix-for-a-basis test): the three components the vec3 uniforms read, never a copy whole
  assert.match(r, /const bbR = \(this\._bbRight \?\?= new Float32Array\(3\)\), bbU = \(this\._bbUp \?\?= new Float32Array\(3\)\);\n\s*bbR\[0\] = camRight\[0\]; bbR\[1\] = camRight\[1\]; bbR\[2\] = camRight\[2\];\n\s*bbU\[0\] = camUp\[0\]; bbU\[1\] = camUp\[1\]; bbU\[2\] = camUp\[2\];/);
  assert.match(r, /for \(let i = 0; i < slots\.length; i\+\+\) drawn\[i\] = slots\[i\]\?\.runs\.length \? slots\[i\] : null;/);
  assert.match(r, /this\._lptDrawn\?\.fill\(null\);   \/\/ NODE-OUTLINE: and the 3D trees a frame drew/);
  assert.match(r, /lptDrawnFrames\(\) \{ return this\._lptDrawn \?\? \[\]; \}/);
  assert.match(src('src/scenes/gatherHost.js'), /for \(const r of out\) r\.pictures = r\.kind\.picturesOf\?\.\(r\.node, r\.src\?\.entry \?\? null\) \?\? r\.src\?\.pictures\?\.get\(r\.key\) \?\? null;/);
});
