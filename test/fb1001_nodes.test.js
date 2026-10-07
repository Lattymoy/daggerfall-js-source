// AUDIT 2026-10-01 part four (Mac: "...and also ensure the other professions are sound") - THE NODES AND THEIR WORDS.
//
// NODE-SPAN. A node is found by the look anywhere up its upright, base to aim point (NODE-AIM); a tree's aim point is 1.2 m
// up its trunk and its glow stands 3.4 m, so a level look from two metres or closer passed over the tree, a look up never
// found it, and from the saddle nothing did - E silent beside a glowing tree; a patch glowed 1.3 m and was found 0.3 m up
// its centre. Now the upright runs to the top of the node's glow where that stands higher.
// NODE-CLEAR. VEIN-CLEAR kept the veins out of the rock pieces; a patch or a tree stood inside one, glowing, on the compass,
// where no look reached it. Now a patch inside a piece stands nowhere and a tree claims the nearest flat outside every one
// (world/terrainNature.js insideRocks, one home).
// STEADY-SAID. The steady hand ends when E is let go, and its meter said "hold still" and nothing of the key: a tap of E
// at a patch ended the act with nothing taken. Now the meter names the key (the Sickle's Use holds it itself, and says none).
// SEASONAL-EYE. Herbalism 100's Seasonal Eye changes what stands; chosen mid-session it stood nothing again until the next
// state read or the day's turn, and the patches named herbs the service did not roll. Now a change of it stands them again.
// NAVAL-E. At sea the net's cast stands in the look, and E cast it where the readout said "E: board her"; now the street
// asks the sea first (scenes/navalHost.js takesActivate). The real gathering host and its kinds over a stood pixel
// (test/fb1001_mining.test.js's), the real meter, and the street's gate lifted from the world host (test/auditnav2_helm's).
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createGatherHost, aimAt } from '../src/scenes/gatherHost.js';
import { herbKind, standPatches, PATCH_MARK } from '../src/scenes/herbHost.js';
import { mineKind } from '../src/scenes/mineHost.js';
import { treeKind, standTrees, TREE_MARK, TRUNK_LIFT } from '../src/scenes/treeHost.js';
import { trees, veins, herbPatches, utcDayOfMs } from '../src/net/nodeLaw.js';
import { createForagingItem, setForagingHost } from '../src/systems/foragingInstall.js';
import { FT } from '../src/systems/foragingLaw.js';
import { createHerbAct } from '../src/systems/herbAct.js';
import { createProfHud } from '../src/ui/profHud.js';
import { insideRocks, natureStandsAt } from '../src/world/terrainNature.js';
import { CLIMATES, LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { WORLD_MAP_TILE_DIM } from '../src/world/terrainTiles.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../src/world/terrainSampler.js';

const WORLD = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const WOODS = CLIMATES.Woodlands, GLENUMBRA = 59;
const PX = 405, PY = 150;
const NOON_MS = (20500 * 86_400 + 43_200) * 1000;
const DAY = utcDayOfMs(NOON_MS);
const tick = () => new Promise((r) => setImmediate(r));
const WILD = Object.freeze({ inside: false, insideDungeon: false, insideCastle: false, locationType: LOCATION_TYPES.None, inLocationRect: false,
  hour: 12, climate: WOODS, region: GLENUMBRA, enemiesNear: false, carriedWeight: 10, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' });

function pixelEntry() {
  const law = veins({ x: PX, y: PY, day: DAY, climate: WOODS, region: GLENUMBRA });
  const rocks = law.map((v) => [v.u * TERRAIN_SIZE - 2, 0, v.v * TERRAIN_SIZE + 4, v.u * TERRAIN_SIZE + 2, 6, v.v * TERRAIN_SIZE + 8]);
  const flats = trees({ x: PX, y: PY, day: DAY, climate: WOODS }).map((t, i) => ({ id: i, group: '504_12', i, x: t.u * TERRAIN_SIZE + 1, y: 0, z: t.v * TERRAIN_SIZE }));
  const batch = { archive: 504, record: 12, size: { w: 4, h: 8 } };
  const forest = { base: 504, archive: 504, trees: flats, groups: new Map([['504_12', { batch, centers: flats.map((f) => [f.x, f.y, f.z]), size: batch.size }]]) };
  return { px: PX, py: PY, samples: new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.5), tilemap: new Uint8Array(128 * 128).fill(2), locationRect: null, batches: [], rocks, forest };
}

/** The gathering host over the pixel, a player with the Sickle, the Pick-Axe and the Wood-Axe, Herbalism's spec at 100 `S.eye`. */
async function stage() {
  const S = { said: [], prompt: null, eye: null, eyeHeight: 1.6 };
  S.e = { stats: { intelligence: 60, agility: 60, strength: 55, endurance: 50, luck: 50 }, items: [FT.Sickle, FT.PickAxe, FT.WoodAxe].map((t) => createForagingItem(t)), wagonItems: [] };
  const book = {
    state: { open: true, today: {}, caps: { stores: 5000 } },
    stale: () => false, refresh: async () => ({ ok: true }), pixel: () => ({ state: 'none' }), askPixels: async () => [], pump: () => {},
    dungeon: () => null, askDungeon: async () => false, held: () => 0, taken: () => false, counting: () => false,
    track: (p) => ({ rank: 100, specs: { 50: null, 100: p === 'herbalism' ? S.eye : null } }),
    harvest: () => new Promise(() => {}),
  };
  const feet = [400, 0, 400];
  const view = { yaw: 0, pitch: 0 };
  const rad = Math.PI / 180;
  const eye = () => ({ pos: [feet[0], feet[1] + S.eyeHeight, feet[2]], dir: [Math.sin(view.yaw * rad) * Math.cos(view.pitch * rad), Math.sin(view.pitch * rad), Math.cos(view.yaw * rad) * Math.cos(view.pitch * rad)] });
  const renderer = { createBillboardBatch: () => ({}), destroyBatch: () => {}, moveBillboardBatch: () => true };
  const entry = pixelEntry();
  const built = new Map([[`${PX},${PY}`, entry]]);
  S.herb = herbKind({ book });
  S.stood = 0;
  const herbNodesOf = S.herb.nodesOf.bind(S.herb);
  S.herb.nodesOf = (a) => { S.stood++; return herbNodesOf(a); };
  S.host = createGatherHost({
    book, kinds: [S.herb, mineKind({ book }), treeKind({ book, renderer })],
    hud: { setPrompt: (p) => { S.prompt = p; }, setMeter: () => {}, toast: (t) => S.said.push(t), banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {} },
    renderer, getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {}, billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => built, pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; },
    pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs: () => NOON_MS,
    eye, view: () => view, feet: () => feet, entity: () => S.e,
    keyLabel: () => 'E', input: () => ({ held: false, attack: false, choice: false }), active: () => true, activeDungeon: () => false,
  });
  setForagingHost({ world: () => WILD, monthValue: () => 5, entity: () => null, startQuest: () => true, professionsOpen: () => true, keyLabel: () => 'E', professionUse: () => false });
  S.host.onBuilt(entry);
  await tick(); await tick();
  S.nodes = (kind) => S.host.nodesOf(PX, PY).filter((n) => n.kind === kind);
  /** Stand `back` metres south of a node and look at the point `atY` metres over its base; the host finds its target. */
  S.look = (n, atY, back = 1.5) => {
    const [x, y, z] = n.local;
    feet[0] = x; feet[1] = y; feet[2] = z - back;
    const a = aimAt([x, y + S.eyeHeight, z - back], [x, y + atY, z], { yaw: 0, pitch: 0 });
    view.yaw = -a.yaw; view.pitch = -a.pitch;
    S.host.tick(0.016);
    return S.host.target?.node.key === n.key;
  };
  S.done = () => { S.host.dispose(); setForagingHost(null); };
  return S;
}

test('NODE-SPAN: a tree is found by a level look from a metre and a half, up its trunk to its glow\'s top, and from the saddle; above the glow nothing; a patch by a look a metre up it (mutants: the span ends at the aim point)', async () => {
  const s = await stage();
  try {
    const tree = s.nodes('tree')[0];
    assert.ok(tree, 'a tree stands');
    assert.deepEqual([tree.lift, TREE_MARK.h], [TRUNK_LIFT, 3.4], 'its aim point 1.2 m up the trunk, its glow 3.4 m');
    assert.equal(s.look(tree, s.eyeHeight), true, 'a level look from 1.5 m');
    assert.match(s.prompt?.verb ?? '', /^Chop /);
    assert.equal(s.look(tree, 2.8), true, 'a look up the trunk');
    assert.equal(s.look(tree, 3.3, 2.5), true, 'near the glow\'s top, from 2.5 m');
    assert.equal(s.look(tree, 6, 1.5), false, 'far above the glow: none');
    s.eyeHeight = 2.51;   // mounted
    assert.equal(s.look(tree, 2.51), true, 'a level look from the saddle');
    s.eyeHeight = 1.6;
    const patch = s.nodes('herb')[0];
    assert.equal(PATCH_MARK.h, 1.3);
    assert.equal(s.look(patch, 1.0), true, 'a patch, a metre up its glow');
    assert.equal(s.look(patch, 3.5), false, 'well above it: none');
  } finally { s.done(); }
});

test('NODE-CLEAR: a patch whose ground is inside a rock piece stands nowhere; a tree whose nearest flat is inside one claims the next outside every piece (mutants: the patch inside taken; the tree inside taken)', () => {
  const samples = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.5), tilemap = new Uint8Array(128 * 128).fill(2);
  const law = herbPatches({ x: PX, y: PY, day: DAY, climate: WOODS });
  const all = standPatches({ px: PX, py: PY, day: DAY, climate: WOODS, samples, tilemap });
  assert.equal(all.length, law.length, 'every patch stands on open grass');
  const p = all[0];
  const rock = [p.local[0] - 3, 0, p.local[2] - 3, p.local[0] + 3, 8, p.local[2] + 3];
  const kept = standPatches({ px: PX, py: PY, day: DAY, climate: WOODS, samples, tilemap, rocks: [rock] });
  assert.equal(kept.some((q) => q.slot === p.slot), false, 'the patch inside the rock: none');
  assert.ok(kept.every((q) => !insideRocks([rock], q.local[0], q.local[2])), 'none inside');
  assert.equal(kept.length, all.filter((q) => !insideRocks([rock], q.local[0], q.local[2])).length, 'the rest as they were');
  void natureStandsAt; void WORLD_MAP_TILE_DIM;
  // trees: the law's first tree's nearest flat under a rock
  const lawTrees = trees({ x: PX, y: PY, day: DAY, climate: WOODS });
  const flats = lawTrees.map((t, i) => ({ id: i, x: t.u * TERRAIN_SIZE + 1, y: 0, z: t.v * TERRAIN_SIZE }));
  flats.push({ id: 99, x: flats[0].x + 6, y: 0, z: flats[0].z });   // a spare flat beside the first, outside the rock
  const forest = { trees: flats };
  const open = standTrees({ px: PX, py: PY, day: DAY, climate: WOODS, forest });
  assert.equal(open[0].flat.id, 0, 'its own flat, the rock away');
  const stone = [flats[0].x - 2, 0, flats[0].z - 2, flats[0].x + 2, 8, flats[0].z + 2];
  const moved = standTrees({ px: PX, py: PY, day: DAY, climate: WOODS, forest, rocks: [stone] });
  assert.equal(moved.find((t) => t.slot === open[0].slot)?.flat.id === 0, false, 'never the flat inside the rock');
  assert.ok(moved.every((t) => !insideRocks([stone], t.local[0], t.local[2])), 'no tree inside');
  // and the kinds hand their pixel's rocks to both
  const read = (f) => readFileSync(new URL(`../src/scenes/${f}`, import.meta.url), 'utf8');
  assert.match(read('herbHost.js'), /\n\s*rocks: entry\.rocks \?\? \[\],/, 'the patches are stood with the pixel\'s rocks');
  assert.match(read('treeHost.js'), /standTrees\(\{ px, py, day, climate: info\.climate, confirmed, forest: entry\.forest \?\? null, rocks: entry\.rocks \?\? \[\] \}\)/, 'and the trees');
});

test('STEADY-SAID: the steady hand\'s meter names the key E\'s start must hold; started by the Sickle\'s Use, which holds it, it names none (mutants: the key never named)', async () => {
  const s = await stage();
  try {
    const patch = { ...s.nodes('herb')[0], tier: 2 };   // a Sickle's patch: the steady hand
    const plan = s.herb.plan(patch, { entity: s.e, rank: () => 100, specs: () => ({ 50: null, 100: null }), keyLabel: () => 'E' });
    const byE = s.herb.start(patch, plan, { entity: s.e, rank: () => 100, keyLabel: () => 'E' });
    assert.equal(byE.act.state.kind, 'steady');
    assert.equal(byE.label, 'E', 'E started it: E must be held');
    const byUse = s.herb.start(patch, plan, { entity: s.e, rank: () => 100, keyLabel: () => 'E', tool: FT.Sickle });
    assert.deepEqual([byUse.label, byUse.heldByUse], ['', true], 'the Sickle\'s Use holds it: no key to name');
  } finally { s.done(); }
  const hud = createProfHud();
  const meter = () => document.body.querySelector('.prof-meter');
  const a = createHerbAct({ kind: 'steady', band: 1 });
  hud.setMeter(a, 'E');
  assert.match(meter().textContent, /hold E and keep still \(\d+(\.\d)? degrees\)/, 'the key named');
  hud.setMeter(a, '');
  assert.match(meter().textContent, /^[^E]*keep still \(\d+(\.\d)? degrees\)/, 'held by the Use: keep still alone');
  hud.dispose?.();
});

test('SEASONAL-EYE: Herbalism 100\'s Seasonal Eye chosen mid-session stands the patches again at once; no change, no stand (mutants: the spec\'s change unread)', async () => {
  const s = await stage();
  try {
    const before = s.stood;
    s.host.tick(0.016); s.host.tick(0.016);
    assert.equal(s.stood, before, 'nothing changed: nothing stood again');
    s.eye = 'seasonal-eye';
    s.host.tick(0.016);
    assert.ok(s.stood > before, 'the Eye chosen: the patches stood again');
    const after = s.stood;
    s.host.tick(0.016);
    assert.equal(s.stood, after, 'and once');
  } finally { s.done(); }
});

test('NAVAL-E: at sea, a press the sea takes (a struck ship\'s rail, a prize, the grapples) is never offered to a node - the net\'s cast in the look; with nothing for the sea, the node has it first as ever (mutants: the sea never asked)', () => {
  const start = WORLD.indexOf('        // GUN-HOLD: Activate while the guns are laid holds fire');
  const ifLine = '        if (((_act.activate && !gatherHost?.acting() && !_actClick && !nodeClicked) || (useEdge && !nodeTook)) && !modes.transitioning && !_holdFire) {';   // PROF-MENU: and a node's lit row's click
  const end = WORLD.indexOf(ifLine, start);
  assert.ok(start > 0 && end > start, 'the street\'s gate');
  const cond = ifLine.trim().slice('if ('.length, -') {'.length);
  // eslint-disable-next-line no-new-func
  const gate = new Function('_act', 'naval', 'magic', 'gatherHost', 'travelView', 'pressed', 'latch', 'keys', 'modes', '_activateDown',
    `${WORLD.slice(start, end)}return { nodeTook, ladder: !!(${cond}) };`);
  const run = (seaTakes) => {
    const calls = [];
    const naval = { aiming: false, holdFire: () => false, takesActivate: () => seaTakes };
    const gatherHost = { acting: () => false, press: () => { calls.push('cast'); return true; }, clickTaken: () => false };
    return { ...gate({ activate: false, cast: false }, naval, { interceptAttack() {} }, gatherHost, null, (_e, _k, a) => a === 'Interact', { edge: null }, null, { transitioning: false }, false), calls };
  };
  const sea = run(true);
  assert.deepEqual([sea.calls, sea.nodeTook, sea.ladder], [[], false, true], 'the sea\'s: the ladder runs (its naval arm boards her), the cast never asked');
  const calm = run(false);
  assert.deepEqual([calm.calls, calm.nodeTook, calm.ladder], [['cast'], true, false], 'nothing for the sea: the net\'s cast, as ever');
});
