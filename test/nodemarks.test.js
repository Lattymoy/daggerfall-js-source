// NODE-MARKS (2026-10-01, Mac: "Any profession node, like herbs, should appear on the compass. The node itself should
// also stand out with a detailed slight glow or something").
//
// EVERY PROFESSION'S NODES ON THE COMPASS, AND LIT WHERE THEY STAND. Before, the compass marked a Prospector's veins and
// a Tracker's animals alone, in one copper; a herb patch, a tree, a school or an ordinary character's vein stood nowhere
// on it, and nothing in the world set a node apart from the grass. Now:
//   - the gathering host answers the nodes standing near the player (scenes/gatherHost.js marks) - each kind's own word
//     on its nodes (`mark`: its glow's footprint, its reach - a Prospector's veins from 200 m), the street's pixels or
//     the dungeon's veins, and the loose bodies, nearest first, NODE_MARK_MAX at most;
//   - both compasses mark them in their profession's colour (ui/nodeMarks.js), the nearer brighter - the classic box
//     (ui/hud.js drawNodeCompassMarks) and the enhanced strip (ui/enhancedHud.js) - with a Tracker's animals in
//     Hunting's;
//   - each glows in the same colour (render/nodeGlow.js): a halo low on the node, a shimmer climbing it, motes rising
//     out of it, kindling as it first stands near and fading out with distance; added onto the frame, fogged.
// bible/06-Systems/Professions-Arc.md, NODE-MARKS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createProfBook } from '../src/net/profBook.js';
import { veins, utcDayOfMs, dungeonVeins } from '../src/net/nodeLaw.js';
import { SKINNING_KNIFE } from '../src/net/professionLaw.js';
import { mineKind, MINE_MARKS, PROSPECT_M } from '../src/scenes/mineHost.js';
import { herbKind, PATCH_MARK } from '../src/scenes/herbHost.js';
import { huntKind, BODY_MARK } from '../src/scenes/huntHost.js';
import { treeKind, TREE_MARK } from '../src/scenes/treeHost.js';
import { fishKind, SCHOOL_MARK } from '../src/scenes/fishHost.js';
import { createGatherHost, NODE_MARK_M, NODE_MARK_MAX, NODE_MARK_SIZE } from '../src/scenes/gatherHost.js';
import { NODE_MARK_CSS, nodeMarkCss, nodeMarkRgb, nodeMarkAlpha, nodeCompassPoints, NODE_MARK_FAR_DIM } from '../src/ui/nodeMarks.js';
import { drawNodeCompassMarks, compassMarkerLerp, DETECT_MARKER_W, DETECT_MARKER_H } from '../src/ui/hud.js';
import { PARTY_GREEN_CSS } from '../src/net/social.js';
import { SHIP_MARK_CSS } from '../src/ui/enhancedHud.js';
import { QUEST_MARK_CSS } from '../src/ui/questMarks.js';
import {
  NODE_GLOW_M, NODE_GLOW_FADE_M, NODE_GLOW_MAX, NODE_GLOW_KINDLE_S, NODE_GLOW_PERIOD, NODE_GLOW_PULL, NODE_GLOW_MOTES,
  NODE_GLOW_VS, NODE_GLOW_FS, nodeGlows, createNodeGlowState, nodeGlowClock, nodeGlowRatesWhole, nodeGlowSeed,
  nodeGlowVertices, NodeGlowRenderer, createNodeGlowPass,
} from '../src/render/nodeGlow.js';
import { glslFunctions } from './glsl.mjs';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../src/world/terrainSampler.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
const tick = () => new Promise((r) => setImmediate(r));
const WOODS = 231, GLENUMBRA = 59;
const NOON = 20500 * 86_400 + 43_200;
const DAY = utcDayOfMs(NOON * 1000);
/** The pixel's place in the scene: far from the origin, so a mark that forgot it stands nowhere near. */
const TR = Object.freeze([-1000, 2, 500]);
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

/**
 * The gathering host over one flat grass pixel (400, 150) with its veins on rock - its herbs, its veins, a body where
 * `body` lies - its book a real one over a scripted door: `specs` Mining's, `taken` the day's taken harvests
 * (`${node}|${kind}`), `knife` whether the pack holds a Skinning Knife, `extra` more kinds.
 */
async function rig({ specs = {}, taken = [], knife = true, body = null, extra = [] } = {}) {
  const samples = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.25);
  const law = veins({ x: 400, y: 150, day: DAY, climate: WOODS, region: GLENUMBRA });
  const rocks = law.map((v) => [v.u * TERRAIN_SIZE - 2, 0, v.v * TERRAIN_SIZE + 4, v.u * TERRAIN_SIZE + 2, 6, v.v * TERRAIN_SIZE + 8]);
  const entry = { px: 400, py: 150, samples, tilemap: new Uint8Array(128 * 128).fill(2), locationRect: null, batches: [], rocks };
  const door = {
    account: () => 'acct-1',
    state: async () => ({ ok: true, data: { day: DAY, character: 'c1', tracks: [{ profession: 'mining', xp: 0, rank: 0, specs: { 50: specs[50] ?? null, 100: null } }], today: {}, taken, stores: [], caps: { harvests: 60, stores: 5000 } } }),
    pixels: async (c, px) => ({ ok: true, data: { pixels: px.map(([x, y]) => ({ x, y, state: 'none' })), dungeons: [] } }),
    harvest: async () => ({ ok: false, error: 'offline' }),
  };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c1', now: () => NOON * 1000, sleep: noWait });
  const hud = { setPrompt: () => {}, setMeter: () => {}, toast: () => {}, banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {} };
  const entity = { items: knife ? [{ templateIndex: SKINNING_KNIFE.templateIndex, currentCondition: 50, maxCondition: 50 }] : [], stats: {} };
  const bodies = () => (body ? [{ key: body.key, foe: 1, tier: 1, hide: 'hide:wolf', at: () => body.at, lift: 0.2, reach: 3, lootKey: () => null }] : []);
  const built = new Map([['400,150', entry]]);
  const host = createGatherHost({
    book, hud, kinds: [herbKind({ book }), mineKind({ book }), huntKind({ book, bodies }), ...extra],
    renderer: { createBillboardBatch: () => ({}), destroyBatch: () => {} }, getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {},
    billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => built, pixelTranslation: (x, y, out) => { out[0] = TR[0]; out[1] = TR[1]; out[2] = TR[2]; return out; },
    pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs: () => NOON * 1000,
    eye: () => ({ pos: [0, 1.6, 0], dir: [0, 0, 1] }), view: () => ({ yaw: 0, pitch: 0 }), feet: () => [0, 0, 0],
    entity: () => entity, keyLabel: () => 'E', input: () => ({ held: false, attack: false, choice: false }),
    active: () => true, activeDungeon: () => true,
  });
  const before = host.marks([0, 0, 0]).length;
  await book.refresh();
  host.onBuilt(entry);
  for (let i = 0; i < 4; i++) await tick();
  /** A node's base in the scene: its local place through the pixel's translation, never lifted. */
  const base = (n) => [n.local[0] + TR[0], n.local[1] + TR[1], n.local[2] + TR[2]];
  const nodes = () => host.nodesOf(400, 150);
  return { host, book, nodes, base, before, entity };
}
const size = (n) => (n.kind === 'herb' ? PATCH_MARK : MINE_MARKS[n.what]);
const professionOf = (n) => (n.kind === 'herb' ? 'herbalism' : 'mining');

// ─── THE HOST ────────────────────────────────────────────────────────

test('NODE-MARKS the host: every node standing within NODE_MARK_M of the feet - the herbs and the veins alike - at its base in the scene (the pixel\'s translation, never the look\'s lift), its profession and its kind\'s footprint, nearest first; the professions shut, none; a pixel 5 km off, none (mutants: the herbs never marked; the lift kept; the translation dropped; farthest first; the reach ignored)', async () => {
  const t = await rig();
  assert.equal(t.before, 0, 'the professions not yet said open: nothing marked');
  const all = t.nodes();
  assert.ok(all.some((n) => n.kind === 'herb') && all.some((n) => n.kind === 'mine'), 'herbs and veins stand on the pixel');
  // the oracle: from each node's own place and the pixel's middle, every node within reach, nearest first
  const feetAt = [...all.map((n) => t.base(n)), [TERRAIN_SIZE / 2 + TR[0], TR[1], TERRAIN_SIZE / 2 + TR[2]]];
  let seenHerb = false;
  for (const raw of feetAt) {
    const feet = new Float32Array(raw);   // AUDIT (the independent pass): the motor's own feet are a Float32Array
    const want = all.map((n) => ({ n, at: t.base(n) })).map((o) => ({ ...o, d: Math.hypot(o.at[0] - feet[0], o.at[2] - feet[2]) }))
      .filter((o) => o.d <= NODE_MARK_M).sort((a, b) => a.d - b.d).slice(0, NODE_MARK_MAX);
    const got = t.host.marks(feet).map((m) => ({ key: m.key, profession: m.profession, at: [...m.at], w: m.w, h: m.h, d: m.d, reach: m.reach }));
    assert.deepEqual(got.map((m) => m.key), want.map((o) => o.n.key), `the nodes within ${NODE_MARK_M} m, nearest first`);
    for (let i = 0; i < want.length; i++) {
      const { n, at, d } = want[i];
      assert.deepEqual(got[i].at, at, `${n.key} at its base, through the translation`);
      assert.equal(got[i].profession, professionOf(n));
      assert.deepEqual([got[i].w, got[i].h], [size(n).w, size(n).h], `${n.key} in its kind's footprint`);
      assert.ok(Math.abs(got[i].d - d) < 1e-9);
      assert.equal(got[i].reach, NODE_MARK_M);
      if (n.kind === 'herb') seenHerb = true;
    }
  }
  assert.ok(seenHerb, 'a herb patch marked');
  const f0 = t.base(all[0]);
  assert.deepEqual(t.host.marks(new Float32Array(f0)).map((m) => m.key), t.host.marks([...f0]).map((m) => m.key), 'AUDIT: typed feet and plain feet mark alike');
  assert.ok(t.host.marks(new Float32Array(f0)).length > 0, 'AUDIT: the motor\'s Float32Array feet mark the nodes (it marked none)');
  assert.deepEqual(t.host.marks([5000, 0, 5000]), [], 'a pixel 5 km off');
  const feet = t.base(all[0]);
  assert.ok(t.host.marks(feet).length > 0);
  t.book.state.open = false;
  assert.deepEqual(t.host.marks(feet), [], 'the professions shut: the nodes still stood, none marked');
  t.book.state.open = true;
  assert.deepEqual(t.host.marks(null), [], 'no feet, no marks');
});

test('NODE-MARKS the host: a node gone for the day is no mark - a vein its ore taken, a patch its herbs AND its food taken; a patch with one harvest left still is (mutants: a gone vein marked; a half-taken patch dropped)', async () => {
  const probe = await rig();
  const vein = probe.nodes().find((n) => n.kind === 'mine' && n.what === 'vein');
  const patches = probe.nodes().filter((n) => n.kind === 'herb');
  assert.ok(vein && patches.length >= 2);
  const [half, whole] = patches;
  const t = await rig({ taken: [`${vein.key}|ore`, `${half.key}|herbs`, `${whole.key}|herbs`, `${whole.key}|food`] });
  const keysNear = (n) => t.host.marks(t.base(n)).map((m) => m.key);
  assert.ok(!keysNear(vein).includes(vein.key), 'the vein mined today: no mark');
  assert.ok(keysNear(half).includes(half.key), 'the patch whose food is left: marked');
  assert.ok(!keysNear(whole).includes(whole.key), 'the patch gathered whole: no mark');
});

test('NODE-MARKS the host: a Prospector\'s veins are marked from PROSPECT_M off (PROF0 3.3) - everyone else\'s from NODE_MARK_M; a boulder never past NODE_MARK_M (mutants: the Prospector\'s reach lost; every node given it)', async () => {
  const plain = await rig();
  const vein = plain.nodes().find((n) => n.kind === 'mine' && n.what === 'vein');
  const at = plain.base(vein);
  const off = (NODE_MARK_M + PROSPECT_M) / 2;
  // walk off the vein to the side its pixel is widest, so the feet stay over the pixel's ground
  const dir = vein.local[0] < TERRAIN_SIZE / 2 ? 1 : -1;
  const feet = new Float32Array([at[0] + dir * off, at[1], at[2]]);
  assert.ok(!plain.host.marks(feet).some((m) => m.key === vein.key), `${off} m off: no mark for an ordinary miner`);
  const pro = await rig({ specs: { 50: 'prospector' } });
  const m = pro.host.marks(feet).find((x) => x.key === vein.key);
  assert.ok(m, `${off} m off: a Prospector's mark`);
  assert.equal(m.reach, PROSPECT_M);
  assert.ok(Math.abs(m.d - off) < 1e-3);
  assert.ok(pro.host.marks(feet).every((x) => x.d <= NODE_MARK_M || x.reach === PROSPECT_M), 'only the veins reach past NODE_MARK_M');
  const kind = mineKind({ book: { taken: () => false } });
  const specs = () => ({ 50: 'prospector', 100: null });
  assert.equal(kind.mark({ key: 'b', what: 'boulder' }, { specs }).reach, undefined, 'a boulder is quarried, not prospected');
  assert.equal(kind.mark({ key: 'd', what: 'dvein' }, { specs }).reach, PROSPECT_M, 'a dungeon\'s vein is a vein');
});

test('NODE-MARKS the host: the loose nodes - a body the knife may skin is Hunting\'s mark where it lies, in BODY_MARK; no knife, or its hide taken, none; a kind that marks none of its loose nodes (Fishing\'s cast) is never asked for them (mutants: the loose nodes never walked; a body marked with no knife; every kind\'s loose nodes asked)', async () => {
  const near = new Float32Array([TR[0] + 300, TR[1], TR[2] + 300]);
  const body = { key: 'body:20500:aaaaaaaaaaaa', at: [near[0] + 3, near[1], near[2] + 4] };
  let asked = 0;
  const cast = { id: 'cast', professions: Object.freeze(['fishing']), nodesOf: () => [], flatsOf: () => [], gone: () => false,
    looseNodesOf: () => { asked++; return [{ key: 'haul:1:2:3:x', at: () => [near[0] + 1, near[1], near[2]] }]; }, plan: () => null, start: () => null, cleanNote: () => '', title: () => '' };
  const t = await rig({ body, extra: [cast] });
  const m = t.host.marks(near);
  const b = m.find((x) => x.key === body.key);
  assert.ok(b, 'the body marked');
  assert.deepEqual([b.profession, b.w, b.h, b.d], ['hunting', BODY_MARK.w, BODY_MARK.h, 5]);
  assert.deepEqual(b.at, body.at, 'where it lies');
  assert.ok(!m.some((x) => x.key.startsWith('haul:')), 'the cast is the look itself: no mark');
  assert.equal(asked, 0, 'and never asked for: its water\'s check is Foraging\'s whole world');
  assert.equal(fishKind({ book: { taken: () => false }, host: /** @type {any} */ ({}) }).marksLoose, undefined, 'Fishing marks no loose node');
  assert.equal(huntKind({ book: { taken: () => false }, bodies: () => [] }).marksLoose, true, 'Hunting marks its bodies');
  assert.ok(!(await rig({ body, knife: false })).host.marks(near).some((x) => x.key === body.key), 'no knife: no node, no mark');
  assert.ok(!(await rig({ body, taken: [`${body.key}|hide`] })).host.marks(near).some((x) => x.key === body.key), 'its hide taken: no mark');
});

test('NODE-MARKS the host: at most NODE_MARK_MAX, the nearest; a kind with no mark of its own marks its standing nodes in NODE_MARK_SIZE (mutants: uncapped; the farthest kept)', async () => {
  const row = { id: 'row', professions: Object.freeze(['logging']), flatsOf: () => [], gone: (n) => n.slot === 3, plan: () => null, start: () => null, cleanNote: () => '', title: () => '',
    nodesOf: ({ px, py }) => Array.from({ length: 30 }, (_, i) => ({ key: `row:${px}:${py}:${i}`, slot: i, local: [400 + i * 4, 0, 400] })) };
  const t = await rig({ extra: [row] });
  const feet = [400 + TR[0], TR[1], 400 + TR[2]];
  const m = t.host.marks(feet).filter((x) => x.key.startsWith('row:'));
  assert.ok(t.host.marks(feet).length <= NODE_MARK_MAX);
  assert.ok(m.length > 0 && !m.some((x) => x.key === 'row:400:150:3'), 'a gone node of a kind with no mark: none');
  for (const x of m) assert.deepEqual([x.w, x.h, x.profession], [NODE_MARK_SIZE.w, NODE_MARK_SIZE.h, 'logging']);
  const all = t.host.marks(feet);
  for (let i = 1; i < all.length; i++) assert.ok(all[i - 1].d <= all[i].d, 'nearest first');
  const kept = new Set(all.map((x) => x.key));
  const farthestKept = Math.max(...all.map((x) => x.d));
  for (let i = 0; i < 30; i++) if (i !== 3 && i * 4 < farthestKept) assert.ok(kept.has(`row:400:150:${i}`), `the nearer ${i} kept over a farther one`);
  assert.equal(all, t.host.marks(feet), 'one list, refilled');
});

test('NODE-MARKS the host underground: the dungeon\'s veins in its own space, Mining\'s, in the dungeon vein\'s footprint - never the street\'s pixels; left, the street\'s again (mutants: the dungeon\'s nodes never walked; the street marked underground)', async () => {
  const t = await rig();
  const wall = (marker, bearing) => [Math.sin(bearing) * 2, 1.2, Math.cos(bearing) * 2];
  t.host.enterDungeon({ id: 88, climate: WOODS, region: GLENUMBRA, wall, stand: async () => ({}), drop: () => {} });
  for (let i = 0; i < 4; i++) await tick();
  const law = dungeonVeins({ dungeon: 88, day: DAY, climate: WOODS, confirmed: false });
  const m = t.host.marks(new Float32Array(3));   // the dungeon's own feet: the motor's typed array too
  assert.equal(m.length, law.length, 'each of the dungeon\'s veins');
  for (const x of m) {
    assert.ok(x.key.startsWith('dvein:88:'));
    assert.deepEqual([x.profession, x.w, x.h], ['mining', MINE_MARKS.dvein.w, MINE_MARKS.dvein.h]);
    assert.ok(Math.abs(Math.hypot(x.at[0], x.at[2]) - 2) < 1e-9 && x.at[1] === 1.2, 'on its wall, the dungeon\'s own space');
  }
  t.host.leaveDungeon();
  const street = t.nodes()[0];
  assert.ok(t.host.marks(t.base(street)).some((x) => x.key === street.key), 'back on the street');
});

test('NODE-MARKS the kinds: each says its own - a patch while either harvest stands, a tree while it stands, a school always (the cast never), a body while its hide is untaken; each footprint across and up, a tree\'s the tallest, a school\'s the widest (mutants: a felled tree marked; a school dropped)', () => {
  const taken = new Set();
  const book = { taken: (k, h) => taken.has(`${k}|${h}`) };
  const herb = herbKind({ book }), tree = treeKind({ book }), hunt = huntKind({ book, bodies: () => [] });
  const fish = fishKind({ book, host: /** @type {any} */ ({}) });
  assert.equal(herb.mark({ key: 'p' }, { specs: () => ({}) }), PATCH_MARK);
  taken.add('p|herbs');
  assert.equal(herb.mark({ key: 'p' }, { specs: () => ({}) }), PATCH_MARK, 'the food left');
  taken.add('p|food');
  assert.equal(herb.mark({ key: 'p' }, { specs: () => ({}) }), null);
  assert.equal(tree.mark({ key: 't' }, { specs: () => ({}) }), TREE_MARK);
  taken.add('t|logs');
  assert.equal(tree.mark({ key: 't' }, { specs: () => ({}) }), null, 'felled');
  assert.equal(fish.mark({ key: 's', school: true }, { specs: () => ({}) }), SCHOOL_MARK);
  assert.equal(fish.mark({ key: 'haul:1:2:3:x' }, { specs: () => ({}) }), null, 'the cast');
  assert.equal(hunt.mark({ key: 'b' }, { specs: () => ({}) }), BODY_MARK);
  taken.add('b|hide');
  assert.equal(hunt.mark({ key: 'b' }, { specs: () => ({}) }), null);
  for (const m of [PATCH_MARK, TREE_MARK, SCHOOL_MARK, BODY_MARK, ...Object.values(MINE_MARKS), NODE_MARK_SIZE]) assert.ok(m.w > 0.5 && m.w < 6 && m.h > 0.5 && m.h < 4, 'a node-sized glow');
  assert.ok(TREE_MARK.h > Math.max(PATCH_MARK.h, BODY_MARK.h, SCHOOL_MARK.h, ...Object.values(MINE_MARKS).map((m) => m.h)), 'up a trunk');
  assert.ok(SCHOOL_MARK.w > TREE_MARK.w && SCHOOL_MARK.h < PATCH_MARK.h, 'a school lies wide and low on the water');
});

// ─── THE COMPASS ─────────────────────────────────────────────────────

test('NODE-MARKS the colours: one a profession, each its own and none the party\'s green or the quest\'s gold; Mining keeps PROF2\'s copper; the floats are the hex; an unknown profession Mining\'s (mutants: two professions one colour; the floats off the hex)', () => {
  const css = Object.values(NODE_MARK_CSS);
  assert.deepEqual(Object.keys(NODE_MARK_CSS).sort(), ['fishing', 'herbalism', 'hunting', 'logging', 'mining']);
  assert.equal(new Set(css).size, css.length);
  assert.ok(!css.includes(PARTY_GREEN_CSS.toLowerCase()) && !css.includes(QUEST_MARK_CSS.toLowerCase()));
  assert.equal(NODE_MARK_CSS.mining, '#d9894a');
  // AUDIT NODE-MARKS (the independent pass): clear of every other TRIANGLE on the strip by colour - Logging's pale
  // heartwood stood 26 from a ship's bone, Hunting's coral 42 from a hostile ship's red - and of each other. The quest's
  // gold and the gate's ember are diamonds on the strip's middle, a ship's triangle points UP: Mining's copper (PROF2's,
  // the veins' colour since before the ships) stands beside those three by shape alone, every other node's by colour too
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const others = { party: PARTY_GREEN_CSS, detect: '#9a1808', gate: '#ff5a2a', quest: QUEST_MARK_CSS, ...Object.fromEntries(Object.entries(SHIP_MARK_CSS).map(([k, v]) => [`ship ${k}`, v])) };
  const byShape = { mining: ['gate', 'quest', 'ship hostile'] };
  for (const [p, hex] of Object.entries(NODE_MARK_CSS)) {
    for (const [o, ohex] of Object.entries(others)) if (!byShape[p]?.includes(o)) assert.ok(Math.hypot(...rgb(hex).map((v, i) => v - rgb(ohex)[i])) >= 75, `${p} ${hex} beside the ${o}'s ${ohex}`);
    for (const [q, qhex] of Object.entries(NODE_MARK_CSS)) if (q !== p) assert.ok(Math.hypot(...rgb(hex).map((v, i) => v - rgb(qhex)[i])) >= 75, `${p} beside ${q}`);
  }
  for (const [p, hex] of Object.entries(NODE_MARK_CSS)) {
    const rgb = nodeMarkRgb(p);
    assert.equal(nodeMarkCss(p), hex);
    assert.equal(`#${rgb.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`, hex);
  }
  assert.equal(nodeMarkCss('smithing'), NODE_MARK_CSS.mining);
  assert.equal(nodeMarkRgb('smithing'), nodeMarkRgb('mining'));
});

test('NODE-MARKS nodeCompassPoints: the host\'s marks in their professions, the nearest LAST (drawn over the rest), each the brighter the nearer - whole at the feet, NODE_MARK_FAR_DIM down at its reach; a Tracker\'s animals in Hunting\'s; nothing, null (mutants: the order kept; the opacity flat; the animals dropped)', () => {
  const marks = [
    { profession: 'herbalism', at: [1, 0, 2], d: 0, reach: 150 },
    { profession: 'mining', at: [3, 0, 4], d: 75, reach: 150 },
    { profession: 'logging', at: [5, 0, 6], d: 150, reach: 150 },
  ];
  const pts = nodeCompassPoints(marks, [[9, 8]]);
  assert.deepEqual(pts?.map((p) => [p.mark, [...p.xz]]), [['hunting', [9, 8]], ['logging', [5, 6]], ['mining', [3, 4]], ['herbalism', [1, 2]]]);
  assert.equal(pts?.[3].a, 1);
  assert.ok(Math.abs((pts?.[2].a ?? 0) - (1 - NODE_MARK_FAR_DIM / 2)) < 1e-12);
  assert.ok(Math.abs((pts?.[1].a ?? 0) - (1 - NODE_MARK_FAR_DIM)) < 1e-12);
  assert.equal(pts?.[0].a, 1, 'a living animal, whole');
  assert.equal(nodeMarkAlpha(500, 150), 1 - NODE_MARK_FAR_DIM, 'clamped at the reach');
  assert.equal(nodeCompassPoints([], null), null);
  assert.equal(nodeCompassPoints(null, []), null);
  assert.equal(nodeCompassPoints(marks, null), nodeCompassPoints([marks[0]], null), 'one list, refilled');
});

test('NODE-MARKS AUDIT the classic compass\'s order: the node marks are drawn FIRST, after the strip, so the Detect markers (a spell\'s whole output), the party and the ships stand over them (mutant: the nodes drawn last again)', () => {
  const H = src('src/ui/hud.js');
  const body = H.slice(H.indexOf('export function drawHud('), H.indexOf('export function drawPartyCompassMarks('));
  const nodesAt = body.indexOf('drawNodeCompassMarks(renderer, nodes,');
  assert.ok(nodesAt > body.indexOf('drawCompassStrip(renderer, art, bx, by, s, heading01)'), 'over the strip');
  for (const later of ['if (detected && detected.length && playerXZ)', 'drawPartyCompassMarks(renderer, party,', 'drawShipCompassMarks(renderer, ships,']) assert.ok(nodesAt < body.indexOf(later), `before ${later}`);
});

test('NODE-MARKS the classic compass: the party\'s 5x3 triangle per node over the box\'s top edge at its bearing, clamped, in its profession\'s colour at its opacity; nothing without points or my own place (mutants: one colour for all; the opacity dropped; the bearing ignored)', () => {
  const quads = [];
  const renderer = { drawScreenQuad: (tex, rect, uv, col) => quads.push({ rect, col: [...col] }) };
  const box = { bx: 500, by: 400, bw: 100, s: 2 };
  const me = [0, 0];
  // the host's order, nearest first: a school behind, then herbs ahead - drawn the other way round
  const pts = nodeCompassPoints([{ profession: 'fishing', at: [0, 0, -40], d: 40, reach: 150 }, { profession: 'herbalism', at: [0, 0, 50], d: 50, reach: 150 }]);
  assert.equal(drawNodeCompassMarks(renderer, pts, me, 0, box), 2);
  assert.equal(quads.length, 6, 'three rows a mark');
  const mw = DETECT_MARKER_W * box.s, mh = DETECT_MARKER_H * box.s;
  const left = (xz) => box.bx + (box.bw - mw) * Math.min(1, Math.max(0, compassMarkerLerp(xz, me, 0)));
  assert.deepEqual(quads[3].col, [...nodeMarkRgb('fishing'), nodeMarkAlpha(40, 150)], 'the nearest drawn last, over the rest');
  assert.deepEqual(quads[0].col, [...nodeMarkRgb('herbalism'), nodeMarkAlpha(50, 150)]);
  assert.equal(quads[0].rect.x, left([0, 50]), 'at its bearing');
  assert.equal(quads[0].rect.y, box.by - mh, 'over the box\'s top edge');
  assert.equal(quads[0].rect.w, 5 * box.s);
  const behind = quads[3].rect.x;
  assert.ok(behind === box.bx || behind === box.bx + box.bw - mw, 'a node behind pins to an end of the box');
  quads.length = 0;
  assert.equal(drawNodeCompassMarks(renderer, null, me, 0, box), 0);
  assert.equal(drawNodeCompassMarks(renderer, pts, null, 0, box), 0);
  assert.equal(quads.length, 0);
});

const mkEl = () => ({
  className: '', textContent: '', id: '', children: [], dataset: {},
  style: { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } },
  classList: {
    _s: new Set(),
    add(...c) { c.forEach((x) => this._s.add(x)); }, remove(...c) { c.forEach((x) => this._s.delete(x)); },
    toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); }, contains(c) { return this._s.has(c); },
  },
  attrs: {},
  setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; },
  removeAttribute(a) { delete this.attrs[a]; }, remove() {},
  append(...c) { for (const n of c) { if (n && typeof n === 'object') n.parentNode = this; } this.children.push(...c); }, appendChild(c) { this.append(c); return c; },
  insertBefore(n, ref) { const i = ref ? this.children.indexOf(ref) : -1; n.parentNode = this; if (i < 0) this.children.push(n); else this.children.splice(i, 0, n); return n; },
  get nextSibling() { const sib = this.parentNode?.children ?? []; return sib[sib.indexOf(this) + 1] ?? null; },
  replaceChildren(...c) { this.children = c; }, addEventListener() {},
});
const findAll = (n, cls, out = []) => { if (String(n.className ?? '').split(/\s+/).includes(cls)) out.push(n); for (const c of n.children ?? []) findAll(c, cls, out); return out; };

test('NODE-MARKS the enhanced strip: a mark per node at its bearing in its profession\'s colour and opacity, pooled - a node gone hides its mark, never removes it; the party\'s marks their own (mutants: the marks never placed; one colour; the pool rebuilt)', async () => {
  const prev = globalThis.document;
  globalThis.document = { createElement: mkEl, createElementNS: () => mkEl(), getElementById: () => null, head: mkEl(), body: mkEl() };
  const { drawEnhancedHud, destroyEnhancedHud } = await import('../src/ui/enhancedHud.js');
  const { clearQuickslots } = await import('../src/systems/quickslots.js');
  clearQuickslots();
  const me = { health: 40, maxHealth: 80, magicka: 0, maxMagicka: 10, fatigue: 100, items: [], equip: { slots: {} }, lightSource: null };
  const frame = (nodes) => drawEnhancedHud(me, 0, 0, { weapon: null, weaponSheathed: true, playerXZ: [0, 0], party: [[0, 30]], nodes });
  try {
    frame(nodeCompassPoints([{ profession: 'herbalism', at: [0, 0, 50], d: 0, reach: 150 }, { profession: 'logging', at: [50, 0, 0], d: 150, reach: 150 }]));
    const root = document.body.children.find((n) => n.className === 'hud');
    let marks = findAll(root, 'hud-node');
    assert.equal(marks.length, 2);
    assert.equal(findAll(root, 'hud-party').length, 1, 'the party\'s marks their own');
    // the nearest last: the logging tree first, then the herbs
    assert.equal(marks[0].style.borderTopColor, NODE_MARK_CSS.logging);
    assert.equal(marks[0].style.opacity, (1 - NODE_MARK_FAR_DIM).toFixed(2));
    assert.equal(marks[1].style.borderTopColor, NODE_MARK_CSS.herbalism);
    assert.equal(marks[1].style.opacity, '1.00');
    assert.equal(marks[1].style.left, `${(compassMarkerLerp([0, 50], [0, 0], 0) * 100).toFixed(1)}%`);
    frame(nodeCompassPoints([{ profession: 'fishing', at: [0, 0, 50], d: 10, reach: 150 }]));
    marks = findAll(root, 'hud-node');
    assert.equal(marks.length, 2, 'the pool is kept');
    assert.equal(marks[0].style.borderTopColor, NODE_MARK_CSS.fishing, 'recoloured');
    assert.equal(marks[1].style.display, 'none', 'the gone node\'s mark hidden');
    frame(null);
    assert.equal(marks[0].style.display, 'none');
    // AUDIT: the node marks' own layer, just over the tape and the needle - every other mark over them, made before or after
    const compass = findAll(root, 'hud-compass')[0];
    const layer = findAll(root, 'hud-nodes')[0];
    assert.ok(layer && marks.every((m) => layer.children.includes(m)), 'the node marks live in their layer');
    assert.equal(compass.children.indexOf(layer), 2, 'right after the strip and the needle');
    assert.ok(compass.children.indexOf(findAll(root, 'hud-party')[0]) > 2, 'a mate made BEFORE them stands over them');
    drawEnhancedHud(me, 0, 0, { weapon: null, weaponSheathed: true, playerXZ: [0, 0], party: [[0, 30], [10, 30]], detected: [[0, 40]], nodes: nodeCompassPoints([{ profession: 'mining', at: [0, 0, 40], d: 40, reach: 150 }]) });
    assert.equal(compass.children.indexOf(layer), 2, 'and the layer stays under the marks made after it');
    assert.ok(findAll(root, 'hud-party').every((m) => compass.children.indexOf(m) > 2));
    // AUDIT: each write kept on the node, never read back from a style that normalises what it was given
    const n0 = marks[0];
    const same = () => drawEnhancedHud(me, 0, 0, { weapon: null, weaponSheathed: true, playerXZ: [0, 0], nodes: nodeCompassPoints([{ profession: 'mining', at: [0, 0, 40], d: 0, reach: 150 }]) });
    same();
    assert.deepEqual([n0.style.opacity, n0.style.left], ['1.00', '50.0%'], 'written');
    n0.style.opacity = '1'; n0.style.left = '50%';   // what a browser reads back for '1.00' and '50.0%'
    same();
    assert.equal(n0.style.opacity, '1', 'the same opacity: not written again');
    assert.equal(n0.style.left, '50%', 'the same bearing: not written again');
  } finally {
    destroyEnhancedHud();
    clearQuickslots();
    globalThis.document = prev;
  }
});

// ─── THE GLOW ────────────────────────────────────────────────────────

test('NODE-MARKS nodeGlows: those within NODE_GLOW_M of the eye, each kindling from nothing over NODE_GLOW_KINDLE_S, fading out from NODE_GLOW_FADE_M to NODE_GLOW_M, in its profession\'s colour and its own seed; at most NODE_GLOW_MAX; one no longer marked forgotten, and kindles again (mutants: no kindling; no fade; the cap ignored; the unmarked kept)', () => {
  const st = createNodeGlowState(), out = [];
  const mk = (key, z, profession = 'herbalism') => ({ key, profession, at: [0, 0, z], w: 2, h: 1 });
  const marks = [mk('a', 10), mk('b', (NODE_GLOW_FADE_M + NODE_GLOW_M) / 2, 'fishing'), mk('c', NODE_GLOW_M + 5)];
  const E = new Float32Array(3);   // AUDIT (the independent pass): the renderer's camera is a Float32Array
  assert.equal(nodeGlows(marks, E, 100, st, out).length, 0, 'the first sight: unkindled, nothing drawn');
  nodeGlows(marks, E, 100 + NODE_GLOW_KINDLE_S / 4, st, out);
  nodeGlows(marks, E, 100 + NODE_GLOW_KINDLE_S / 2, st, out);
  assert.equal(out.length, 2, 'past NODE_GLOW_M: none');
  assert.ok(Math.abs(out[0].alpha - 0.5) < 1e-9, 'half kindled, frame by frame');
  for (let i = 1; i <= 8; i++) nodeGlows(marks, E, 100 + NODE_GLOW_KINDLE_S / 2 + i * 0.1, st, out);
  assert.equal(out[0].alpha, 1, 'whole');
  const hitch = createNodeGlowState();
  nodeGlows(marks, [0, 0, 0], 0, hitch, []);
  assert.ok(Math.abs(nodeGlows(marks, [0, 0, 0], 5, hitch, [])[0].alpha - 0.25 / NODE_GLOW_KINDLE_S) < 1e-9, 'a hitch\'s frame kindles a quarter second\'s worth, never all at once');
  assert.ok(Math.abs(out[1].alpha - 0.5) < 1e-9, 'half way through the fade');
  assert.equal(out[0].rgb, nodeMarkRgb('herbalism'));
  assert.equal(out[1].rgb, nodeMarkRgb('fishing'));
  assert.equal(out[0].seed, nodeGlowSeed('a'));
  assert.notEqual(nodeGlowSeed('a'), nodeGlowSeed('b'));
  assert.equal(out[0].at, marks[0].at, 'at the mark\'s own base');
  nodeGlows([marks[1]], [0, 0, 0], 101.6, st, out);
  assert.ok(!st.nodes.has('a'), 'unmarked: forgotten');
  nodeGlows(marks, [0, 0, 0], 101.7, st, out);
  assert.equal(out.find((g) => g.seed === nodeGlowSeed('a')), undefined, 'and kindles again from nothing');
  const rec = out[0];
  nodeGlows(marks, [0, 0, 0], 101.75, st, out);
  assert.equal(out[0], rec, 'AUDIT: the records refilled, none made a frame');
  const many = Array.from({ length: 40 }, (_, i) => mk(`n${i}`, i));
  nodeGlows(many, [0, 0, 0], 102, st, out);
  nodeGlows(many, [0, 0, 0], 102.2, st, out);
  assert.equal(out.length, NODE_GLOW_MAX);
  assert.equal(nodeGlows(null, [0, 0, 0], 6, st, out).length, 0);
  assert.equal(st.nodes.size, 0, 'none marked: every one forgotten');
});

/** The glow's light at a point on its card - the shader's own main(), run. */
const glowAt = (vM, { t = 7.25, seed = 0.31, alpha = 1, color = [1, 1, 1], w = 2, h = 1.5, world = [0, 0, 0], fog = null, still = 0 } = {}) => {
  const f = glslFunctions(NODE_GLOW_FS, {
    vM, vWorld: world, uSize: [w, h], uColor: color, uAlpha: alpha, uSeed: seed, uTime: t, uStill: still,
    uFogMode: fog ? 2 : 0, uFogDensity: fog?.density ?? 0, uFogRange: [0, 1], uCamPos: [0, 0, 0], uFocus: [0, 0, 0, 0],
  });
  f.main();
  return f.globals.o;
};
const lum = (c) => c[0] + c[1] + c[2];
/** The mean light across the card's width at a height `y` (m). */
const rowMean = (y, o = {}) => { let s = 0; const n = 21; for (let i = 0; i < n; i++) s += lum(glowAt([-1 + (2 * i) / (n - 1), y], o)); return s / n; };

test('NODE-MARKS the glow\'s light, the shader RUN: added onto the frame (alpha 1 under ONE, ONE); brightest low on the node and at its middle - nothing at the ground (no edge where the ground cuts the card) and next to nothing at its crown and its sides; slight (never past a third of white in its halo); in its profession\'s colour; the motes rise; the picture at the clock\'s wrap the picture at zero, every rate whole; unkindled, nothing; the fog thins it (mutants: the halo upside down; a rate not whole; the alpha ignored; the colour ignored)', () => {
  const h = 1.5;
  const low = rowMean(0.3 * h), ground = rowMean(0), crown = rowMean(0.99 * h);
  assert.ok(low > 0.05, `the halo stands (${low.toFixed(3)})`);
  assert.ok(ground < 1e-3, `out of nothing at the ground (${ground})`);
  assert.ok(low > crown * 4, `low on the node, thinning to its crown (${low.toFixed(3)} vs ${crown.toFixed(3)})`);
  const high = rowMean(0.75 * h);
  assert.ok(low > high * 2, `its body low on the node, not high on it (${low.toFixed(3)} vs ${high.toFixed(3)})`);
  assert.ok(lum(glowAt([0, 0.3 * h])) > lum(glowAt([0.98, 0.3 * h])) * 3, 'soft across - brightest at its middle');
  let peak = 0;
  for (let t = 0; t < 8; t += 0.25) peak = Math.max(peak, glowAt([0, 0.3 * h], { t: t + 100, seed: 0.9 })[0]);
  assert.ok(peak < 0.75, `slight: ${peak.toFixed(3)} at its brightest (motes and all)`);
  assert.equal(glowAt([0, 0.3 * h])[3], 1, 'alpha 1 under ONE, ONE: the light is ADDED');
  const c = glowAt([0, 0.3 * h], { color: [1, 0.5, 0.25] });
  assert.ok(Math.abs(c[1] / c[0] - 0.5) < 1e-9 && Math.abs(c[2] / c[0] - 0.25) < 1e-9, 'in its colour');
  assert.equal(lum(glowAt([0, 0.3 * h], { alpha: 0 })), 0, 'unkindled: nothing');
  assert.ok(lum(glowAt([0, 0.3 * h], { world: [0, 0, 400], fog: { density: 0.01 } })) < lum(glowAt([0, 0.3 * h])) * 0.1, 'the fog thins it');
  // the wrap: every rate whole over NODE_GLOW_PERIOD
  assert.ok(nodeGlowRatesWhole());
  assert.equal(nodeGlowClock(NODE_GLOW_PERIOD + 3.5), 3.5);
  assert.equal(nodeGlowClock(-1), NODE_GLOW_PERIOD - 1);
  for (let i = 0; i < 12; i++) {
    const p = [Math.sin(i * 1.7) * 0.9, (i / 12) * h];
    const a = glowAt(p, { t: 0, seed: i / 12 }), b = glowAt(p, { t: NODE_GLOW_PERIOD, seed: i / 12 });
    assert.ok(Math.abs(lum(a) - lum(b)) < 1e-6, `the picture at the wrap is the picture at zero (${p})`);
  }
  // the motes rise: over a second the light high on the card moves - something climbs it
  const strip = (t) => Array.from({ length: 40 }, (_, i) => lum(glowAt([((i % 8) - 3.5) / 4, 0.4 * h + Math.floor(i / 8) * 0.15 * h], { t })));
  const a = strip(10), b = strip(10.5);
  assert.ok(a.some((v, i) => Math.abs(v - b[i]) > 1e-3), 'it moves');
  assert.equal(NODE_GLOW_MOTES, (NODE_GLOW_FS.match(/i < (\d+);/) ?? [])[1] * 1, 'the shader sends up NODE_GLOW_MOTES');
});

test('NODE-MARKS the glow\'s card, the vertex half RUN: turned about the upright to face the eye, stood NODE_GLOW_PULL toward it off the node\'s base (never past half its way), `w` across and `h` up in metres', () => {
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const vs = (aP, eye = [10, 5, 20]) => { const f = glslFunctions(NODE_GLOW_VS, { aP, uVP: I, uAt: [10, 2, 0], uSize: [2, 1.5], uEye: eye, uPull: NODE_GLOW_PULL }); f.main(); return { w: f.globals.vWorld, m: f.globals.vM }; };
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  // the eye due north (+z) of the node: the card stands toward it, across the x axis
  assert.ok(near(vs([0, 0]).w, [10, 2, NODE_GLOW_PULL]), 'its foot, stood toward the eye');
  assert.ok(near(vs([1, 1]).w, [11, 3.5, NODE_GLOW_PULL]), 'its corner: half its width across, its height up');
  assert.ok(near(vs([1, 1]).m, [1, 1.5]), 'metres on the card');
  assert.ok(near(vs([0, 0], [10, 5, 0.4]).w, [10, 2, 0.2]), 'an eye nearer than twice the pull: half its way');
  assert.deepEqual([...nodeGlowVertices()], [-1, 0, 1, 0, 1, 1, -1, 0, 1, 1, -1, 1]);
});

test('NODE-MARKS the glow\'s draw: nothing to draw touches nothing; one quad a node placed by uniforms in its colour, size, kindling and seed; ONE, ONE; no depth written and the mask put back; culling back and blending off after; the clock wrapped; the fog\'s focus uploaded; `drawn` counts them, the faded skipped (mutants: depth written; a node\'s colour not set; the clock unwrapped)', () => {
  const calls = [];
  const gl = new Proxy({ VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11 }, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  const r = new NodeGlowRenderer(gl);
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  calls.length = 0;
  r.draw([], I, I, [0, 0, 0], 1);
  assert.equal(calls.length, 0, 'nothing to draw, nothing touched');
  const focus = new Float32Array([1, 2, 3, 1]);
  const herb = nodeMarkRgb('herbalism'), ore = nodeMarkRgb('mining');
  r.draw([
    { at: [1, 0, 1], w: 2, h: 1, rgb: herb, alpha: 1, seed: 0.1 },
    { at: [5, 0, 5], w: 1.5, h: 1.2, rgb: ore, alpha: 0.5, seed: 0.2 },
    { at: [9, 0, 9], w: 1, h: 1, rgb: ore, alpha: 0, seed: 0.3 },
  ], I, I, [0, 1.6, 0], NODE_GLOW_PERIOD + 7, { mode: 2, density: 0.01, range: [0, 1], camPos: [0, 1.6, 0], focus });
  assert.equal(r.drawn, 2, 'the faded one skipped');
  assert.equal(calls.filter((c) => c[0] === 'drawArrays').length, 2);
  assert.deepEqual(calls.filter((c) => c[0] === 'uniform3f' && c[1] === 'uAt').map((c) => c.slice(2)), [[1, 0, 1], [5, 0, 5]]);
  assert.deepEqual(calls.filter((c) => c[0] === 'uniform3f' && c[1] === 'uColor').map((c) => c.slice(2)), [[...herb], [...ore]]);
  assert.deepEqual(calls.filter((c) => c[0] === 'uniform2f' && c[1] === 'uSize').map((c) => c.slice(2)), [[2, 1], [1.5, 1.2]]);
  assert.deepEqual(calls.filter((c) => c[0] === 'uniform1f' && c[1] === 'uAlpha').map((c) => c[2]), [1, 0.5]);
  assert.deepEqual(calls.filter((c) => c[0] === 'uniform1f' && c[1] === 'uSeed').map((c) => c[2]), [0.1, 0.2]);
  assert.equal(calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uTime')[2], 7, 'the clock wrapped');
  assert.equal(calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uStill')[2], 0, 'moving by default');
  assert.deepEqual(calls.find((c) => c[0] === 'blendFunc').slice(1), [gl.ONE, gl.ONE]);
  assert.deepEqual(calls.filter((c) => c[0] === 'depthMask').map((c) => c[1]), [false, true]);
  const names = calls.map((c) => c[0]);
  const last = names.lastIndexOf('drawArrays');
  assert.ok(calls.some((c, i) => i > last && c[0] === 'enable' && c[1] === gl.CULL_FACE), 'culling back on after');
  assert.ok(calls.some((c, i) => i > last && c[0] === 'disable' && c[1] === gl.BLEND), 'blending off after');
  assert.deepEqual(calls.find((c) => c[0] === 'uniform4fv' && c[1] === 'uFocus')?.[2], focus, 'the travel view\'s focus, as every fogged program');
  assert.ok(NODE_GLOW_MAX >= NODE_MARK_MAX, 'every node the compass marks may glow');
  assert.ok(NODE_GLOW_M <= NODE_MARK_M && NODE_GLOW_FADE_M < NODE_GLOW_M);
  calls.length = 0;
  r.draw([{ at: [1, 0, 1], w: 2, h: 1, rgb: herb, alpha: 1, seed: 0.1 }], I, I, [0, 1.6, 0], 3, null, true);
  assert.equal(calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uStill')[2], 1, 'AUDIT: the still form uploaded');
});

// ─── THE WIRING ──────────────────────────────────────────────────────

test('NODE-MARKS the world host\'s glow pass (createNodeGlowPass), over a fake renderer: the marks lit under the frame\'s own camera and fog (its focus too), kindling node by node; AUDIT: the program built at IDLE once a node is first marked - never on a frame - and nothing lit until it stands; a build that throws costs the glow, never the game, and is never tried again; a pass that RAN is a foreign pass, whatever it drew; under reduced motion its still form; no camera or null marks light nothing (mutants: built on the frame; built every frame; the throw let through; the foreign pass marked only for a draw; the fog not handed; the still form never asked)', () => {
  const marked = [];
  const renderer = { _proj: new Float32Array(16), _view: new Float32Array(16), _camPos: new Float32Array([0, 1.6, 0]), _fogMode: 2, _fogDensity: 0.01, _fogRange: [0, 1], _focus: new Float32Array([1, 2, 3, 1]), gl: {}, markForeignPass: () => marked.push(1) };
  let t = 10, builds = 0, still = false;
  const idled = [];
  const drawn = [];
  const fake = { drawn: 0, draw(list, proj, view, eye, seconds, fog, st) { this.drawn = list.length; drawn.push({ n: list.length, proj, view, eye, seconds, fog, st }); } };
  const pass = createNodeGlowPass(renderer, { now: () => t, build: () => { builds++; return /** @type {any} */ (fake); }, idle: (fn) => idled.push(fn), reduced: () => still });
  const marks = [{ key: 'herb:1:2:3:0', profession: 'herbalism', at: [0, 0, 5], w: 2, h: 1 }];
  assert.equal(pass.draw(null), 0);
  assert.equal(idled.length, 0, 'nothing marked: nothing asked of the idle');
  assert.equal(pass.draw(marks), 0, 'first sight: unkindled');
  assert.equal(idled.length, 1, 'the first node marked asks the idle for the compile');
  assert.equal(builds, 0, 'never on the frame');
  t += 0.1;
  assert.equal(pass.draw(marks), 0, 'kindling, but the program not yet built: nothing lit');
  assert.equal(marked.length, 0, 'and no foreign pass');
  idled[0]();   // the browser's idle time
  assert.equal(builds, 1);
  t += 0.1;
  assert.equal(pass.draw(marks), 1);
  assert.equal(idled.length, 1, 'asked once');
  assert.equal(drawn[0].proj, renderer._proj);
  assert.equal(drawn[0].eye, renderer._camPos, 'the frame\'s own camera');
  assert.deepEqual(drawn[0].fog, { mode: 2, density: 0.01, range: renderer._fogRange, camPos: renderer._camPos, focus: renderer._focus }, 'the frame\'s fog and the travel view\'s focus');
  assert.equal(drawn[0].seconds, t);
  assert.equal(drawn[0].st, false, 'moving');
  assert.equal(marked.length, 1, 'a foreign pass');
  still = true; t += 0.1;
  pass.draw(marks);
  assert.equal(drawn[1].st, true, 'reduced motion: the still form');
  fake.draw = function (list) { this.drawn = 0; drawn.push({ n: list.length }); };   // a pass that ran and drew nothing
  t += 0.1;
  pass.draw(marks);
  assert.equal(marked.length, 3, 'a pass that RAN is a foreign pass - its program went up whatever it drew');
  assert.equal(pass.draw(null), 0, 'none marked');
  renderer._proj = null;
  t += 0.1;
  pass.draw(marks); t += 0.1;
  assert.equal(pass.draw(marks), 0, 'no camera: nothing drawn');
  const warn = console.warn; const warned = [];
  console.warn = (...a) => warned.push(a.join(' '));
  try {
    renderer._proj = new Float32Array(16);
    let tries = 0;
    const broken = createNodeGlowPass(renderer, { now: () => t, build: () => { tries++; throw new Error('no GL'); }, idle: (fn) => fn(), reduced: () => false });
    broken.draw(marks); t += 0.1;
    assert.equal(broken.draw(marks), 0, 'a glow that will not build lights nothing');
    t += 0.1;
    assert.doesNotThrow(() => broken.draw(marks));
    assert.equal(tries, 1, 'and is never tried again');
    assert.ok(warned.some((w) => w.includes('the nodes\' glow would not build')));
  } finally { console.warn = warn; }
});

test('NODE-MARKS AUDIT the still form, the shader RUN: under reduced motion (`uStill` 1) the picture is the same at every moment - no breath, no shimmer climbing, every mote held at its own place - and still a glow, low on the node; and the motes still stand in it (mutants: the clock not held; the shimmer kept; the halo dropped)', () => {
  const h = 1.5;
  const at = (vM, t, still = 1, seed = 0.31) => glowAt(vM, { t, seed, still, h });
  const probe = [];
  for (let i = 0; i < 40; i++) probe.push([((i % 8) - 3.5) / 4, ((Math.floor(i / 8) + 0.5) / 5) * h]);
  for (const p of probe) assert.ok(Math.abs(lum(at(p, 3)) - lum(at(p, 41.7))) < 1e-9, `still at ${p}`);
  assert.ok(probe.some((p) => Math.abs(lum(at(p, 3, 0)) - lum(at(p, 41.7, 0))) > 1e-3), 'moving without it');
  assert.ok(rowMean(0.3 * h, { still: 1 }) > 0.05, 'the halo stands');
  assert.ok(rowMean(0.3 * h, { still: 1 }) > rowMean(0.75 * h, { still: 1 }) * 2, 'low on the node');
  // no shimmer: a held band would sit where its seed puts it, and the halo does not care for the seed - so a row's median
  // (the motes are a few points of it) is the same for any two nodes
  const rowMedian = (y, seed) => { const v = []; for (let i = 0; i < 21; i++) v.push(lum(at([-1 + (2 * i) / 20, y], 3, 1, seed))); v.sort((p, q) => p - q); return v[10]; };
  for (let y = 0.1; y < 0.95; y += 0.1) assert.ok(Math.abs(rowMedian(y * h, 0.12) - rowMedian(y * h, 0.64)) < 0.01, `no band held at ${y.toFixed(1)} of its height`);   // a band is ~0.05 a row; the motes' tails far less
  let sparks = 0;
  for (let y = 0.05; y < 0.95; y += 0.01) for (let x = -0.6; x <= 0.6; x += 0.01) if (lum(at([x * 1, y * h], 3)) > 0.6) sparks++;
  assert.ok(sparks > 0, 'the motes held where they are, not gone');
});

test('NODE-MARKS the hosts by source: the street\'s compass and the dungeon\'s take the nodes - under the travel view too (AUDIT); the glow is drawn after each mode\'s opaque world through the veiled bodies\' hook, never under the travel view; none in a building or with the professions shut; every edit to the cited hosts line-neutral (one import line, one door folded beside the party\'s)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /if \(!gatherHost \|\| profBook\?\.state\.open !== true \|\| !feet\) return null;\n\s*const m = _mode\(\);\n\s*return m === 'exterior' \|\| m === 'dungeon' \? gatherHost\.marks\(feet\) : null;/, 'AUDIT: the compass keeps the nodes under the travel view, as PROF2\'s Prospector\'s veins were kept');
  assert.match(w, /nodes: professionMarks\(\),/);
  // PIN MOVED (PROF2b): the far Motherlodes beside the near nodes, the glow still built right after
  assert.match(w, /const professionMarks = \(feet = enchantFeet\(\)\) => \{\n\s*const near = nodeMarksAt\(feet\), far = motherlodeMarks\(\);\n\s*return nodeCompassPoints\(far\.length \? \[\.\.\.\(near \?\? \[\]\), \.\.\.far\] : near, trackerAnimals\(\)\);[^\n]*\n\s*\};\n\s*const nodeGlowPass = createNodeGlowPass\(renderer\);/);
  assert.match(w, /const drawVeiledPeerBodies = \(\) => \{ peerBodies\?\.drawVeiled\(\); drawAuras\(\); nodeGlowPass\.draw\(travelView\?\.active \? null : nodeMarksAt\(enchantFeet\(\)\)\); \};/, 'the glow alone none under the travel view');
  assert.match(w, /partyNear: \(\) => partyOnMaps\(\), professionMarks: \(feet\) => professionMarks\(feet\),/);
  assert.match(w, /^import \{ mineKind \} from '\.\/mineHost\.js'; import \{ nodeCompassPoints \} from '\.\.\/ui\/nodeMarks\.js'; import \{ createNodeGlowPass \} from '\.\.\/render\/nodeGlow\.js';/m);
  assert.match(src('src/scenes/worldModes.js'), /party: \(\) => host\.partyNear\?\.\(\) \?\? \[\], nodeMarks: \(feet\) => host\.professionMarks\?\.\(feet\) \?\? null,/);
  assert.match(src('src/scenes/dungeonContext.js'), /party: partyCompassPoints\(\{ bodies: opts\.party \?\? null \}\), nodes: playerFeet \? \(opts\.nodeMarks\?\.\(playerFeet\) \?\? null\) : null,/);
  assert.match(src('src/ui/hud.js'), /nodes: nodes \?\? null,/, 'handed to the enhanced skin');
});
