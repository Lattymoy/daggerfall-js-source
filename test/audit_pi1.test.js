// AUDIT PI1 (2026-10-07, Mac: "Lets do a conprehensive audit and ensure this is perfection"): PHYSICAL ITEMS audited -
// the scene layer, the law, the four hosts' halves and the record, read against the shipped assembly's IL
// (vendor/physical-items/il) and the port's own laws. One test a finding group; each names the finding ids it holds
// (bible/01-Overview/Audit-PI1.md). Mutants: tools/mutants/audit_pi1.json.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PHYSICAL_ITEMS_VENDOR, readPhysicalItemsSettings, makeBody, stepBody, flyBody, constrainMove, PI_CONSTRAIN, bleedEdges, hasVisible,
  dropRadius, PI_FOOTPRINT, nearestFloor, PI_FLOOR_PROBE, PI_PATH, spiralPoint, isPresented, markDeath, diedRecently, PI_FRESH_MS,
  PI_REACH, itemLook, PI_BODY, PI_PROBE_LIFT,
} from '../src/systems/physicalItems.js';
import { createPhysicalItems, heldTextureCount, PI_ICON_ARCHIVE, PI_KEY_PREFIX, PI_MW_PX, PI_RETRY_MS, PI_RETRY_MAX } from '../src/scenes/physicalItemsLayer.js';
import { createDroppedLoot } from '../src/scenes/droppedLoot.js';
import { MOD_SETTINGS, setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { createRandomArmor, randomlyAddMap } from '../src/systems/loot.js';
import { goldStack } from '../src/systems/inventory.js';
import { Collider } from '../src/player/collider.js';
import { USE_TEXT } from '../src/systems/useItem.js';
import { CANNOT_REMOVE_ITEM_TEXT } from '../src/systems/createItem.js';
import { quickLootArm, foldQuickLoot, quickLootTake, resetQuickLoot, tookItemText } from '../src/systems/quickLoot.js';
import { resolveHover } from '../src/systems/worldHover.js';
import { setPref } from '../src/systems/uiPrefs.js';
import { setSilverFinder, silverFindAt, _resetSilverFindsForTests } from '../src/systems/silverFinds.js';
import { NativeInventoryWindow } from '../src/ui/nativeInventory.js';
import { CELL_X } from '../src/ui/itemScroller.js';
import { ITEM_TEMPLATES } from '../src/characters/paperdoll.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const shippedRead = (over = {}) => {
  const base = Object.fromEntries(Object.entries(MOD_SETTINGS[PHYSICAL_ITEMS_VENDOR].keys).map(([k, d]) => [k, d.default]));
  const all = { ...base, ...over };
  return (k) => all[k];
};
const sword = () => createWeapon(120, 0, () => 0.5);
const tick = () => new Promise((r) => setTimeout(r, 5));
/** A 4x4 picture whose lower two rows show. */
const picture = { key: 'k', width: 4, height: 4, colors: new Uint8ClampedArray(64).map((_, i) => (i % 4 === 3 ? (i >= 32 ? 255 : 0) : 9)) };
const mwImage = { width: 2, height: 2, data: new Uint8Array(16).fill(255) };
const noMw = { stamp: () => null, picture: async () => null };
function fakeRenderer() {
  const made = [], gone = [], up = [], freed = [];
  return { made, gone, up, freed, uploadTexture: (a, r, img) => { up.push([a, r, img.width, img.height, img.colors]); return {}; }, createBillboardBatch: (a, r, size) => { const b = { a, r, size }; made.push(b); return b; }, destroyBillboardBatch: (b) => gone.push(b), releaseTexture: (a, r) => freed.push([a, r]) };
}
const layerOf = (over = {}) => createPhysicalItems({ renderer: fakeRenderer(), enabled: () => true, settings: () => readPhysicalItemsSettings(shippedRead()), iconOf: async () => picture, mw: noMw, ...over });
const poolOf = (physical = {}) => createDroppedLoot({ renderer: fakeRenderer(), getTexture: () => Promise.resolve({}), uploadRecordFrame: () => {}, physical: { enabled: () => true, settings: () => readPhysicalItemsSettings(shippedRead()), iconOf: async () => picture, mw: noMw, ...physical } });
const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const QUAD = new Uint32Array([0, 1, 2, 0, 2, 3]);
/** A real collider: a floor at 0, and a wall across z = 2. */
const room = ({ table = false } = {}) => {
  const c = new Collider(() => -100);
  c.addMesh('floor', new Float32Array([-20, 0, -20, 20, 0, -20, 20, 0, 20, -20, 0, 20]), QUAD, I4);
  c.addMesh('wall', new Float32Array([-20, -1, 2, 20, -1, 2, 20, 5, 2, -20, 5, 2]), QUAD, I4);
  if (table) c.addMesh('table', new Float32Array([-1, 0.3, -3, 1, 0.3, -3, 1, 0.3, 1, -1, 0.3, 1]), QUAD, I4);
  return c;
};
const groundOf = (c) => (x, top, z) => { const d = c.raycast([x, top, z], [0, -1, 0], 64); return Number.isFinite(d) ? top - d : null; };
const wallOf = (c) => (from, dir, len) => { const d = c.raycast(from, dir, len); return Number.isFinite(d) ? d : null; };
const player = (strength = 50) => ({ items: [], goldPieces: 0, stats: { strength } });

test('AUDIT PI1 R1/H1/L1 - the pictures are the renderer\'s, held once across every layer: a dungeon\'s teardown freed the street\'s Longswords with its own (mutants: a layer frees what it asked for)', async () => {
  const renderer = fakeRenderer();
  const a = createPhysicalItems({ renderer, enabled: () => true, settings: () => readPhysicalItemsSettings(shippedRead()), iconOf: async () => picture, mw: noMw });
  const b = createPhysicalItems({ renderer, enabled: () => true, settings: () => readPhysicalItemsSettings(shippedRead()), iconOf: async () => picture, mw: noMw });
  a.attach({ corpses: ((e) => () => [{ entity: e, pos: [0, 0, 0] }])({ items: [sword()] }) });
  b.attach({ corpses: ((e) => () => [{ entity: e, pos: [9, 0, 0] }])({ items: [sword()] }) });
  a.frame(0.016); b.frame(0.016); await tick();
  const rec = a.state()[0].pic;
  assert.equal(rec, b.state()[0].pic, 'one picture, one record');
  assert.equal(heldTextureCount(renderer, rec), 2);
  assert.equal(renderer.up.filter(([, r]) => r === rec).length, 1, 'uploaded once');
  a.destroy();
  assert.equal(heldTextureCount(renderer, rec), 1);
  assert.deepEqual(renderer.freed, [], 'the street still stands in it');
  b.clear();
  assert.deepEqual(renderer.freed, [[PI_ICON_ARCHIVE, rec]], 'the last holder frees it');
  assert.equal(heldTextureCount(renderer, rec), 0);
  // H8: a teardown with a picture still on its way - nothing lands after it
  const c = createPhysicalItems({ renderer, enabled: () => true, settings: () => readPhysicalItemsSettings(shippedRead()), iconOf: async () => picture, mw: noMw });
  c.attach({ corpses: ((e) => () => [{ entity: e, pos: [0, 0, 0] }])({ items: [sword()] }) });
  c.frame(0.016);
  const made = renderer.made.length;
  c.destroy(); await tick();
  assert.deepEqual([renderer.made.length, heldTextureCount(renderer, rec), c.state().length], [made, 0, 0]);
});

test('AUDIT PI1 R2/R7/R9/R6/L9 - the Morrowind picture first at the classic icons\' density, the classic one on its miss (an empty render is a miss), a miss while a build stands asked again, and a re-ask that fails keeps the picture it stands in (mutants: the order swapped, the empty render kept, no retry)', async () => {
  let stamp = null, clock = 0, mwFails = false;
  const asked = [];
  const renderer = fakeRenderer();
  const mw = { stamp: () => stamp, picture: async (it) => { asked.push(it); return mwFails ? { key: 'clear', image: { width: 2, height: 2, data: new Uint8Array(16) } } : { key: 'mw', image: mwImage }; } };
  const layer = createPhysicalItems({ renderer, enabled: () => true, settings: () => readPhysicalItemsSettings(shippedRead({ 'Item Sizes.Weapons': 1 })), iconOf: async () => picture, mw, now: () => clock });
  layer.attach({ corpses: ((e) => () => [{ entity: e, pos: [0, 0, 0] }])({ items: [sword()] }) });
  layer.frame(0.016); await tick();
  assert.equal(asked.length, 0, 'no build: Morrowind is not asked');
  assert.equal(layer.state()[0].pic, 'c:k@0,2,4,2', 'the classic picture, cut to its visible rows');
  assert.deepEqual(renderer.made.at(-1).size, { w: 1, h: 0.5 }, 'the longer visible side is Item Sizes.Weapons');
  stamp = '7'; layer.frame(0.016); await tick();
  assert.equal(asked.length, 1, 'a build landed: asked again, Morrowind first');
  assert.equal(layer.state()[0].pic, 'm:mw@0,0,2,2');
  assert.deepEqual(renderer.made.at(-1).size, { w: 1, h: 1 });
  assert.equal(PI_MW_PX, 64, 'rendered at 64 texels - the tier rim two texels of it, not a hair on 256');
  // a new build whose render is empty: the classic picture, and the Morrowind one asked again later
  mwFails = true; stamp = '8'; layer.frame(0.016); await tick();
  assert.equal(layer.state()[0].pic, 'c:k@0,2,4,2', 'an empty render is no picture: the classic one stands');
  clock = PI_RETRY_MS - 1; layer.frame(0.016); await tick();
  assert.equal(asked.length, 2, 'not before its time');
  mwFails = false; clock = PI_RETRY_MS; layer.frame(0.016); await tick();
  assert.equal(asked.length, 3, 'asked again 5 s on');
  assert.equal(layer.state()[0].pic, 'm:mw@0,0,2,2', 'and it came');
  // a re-ask with nothing at all keeps the picture standing
  const keep = createPhysicalItems({ renderer: fakeRenderer(), enabled: () => true, settings: () => readPhysicalItemsSettings(shippedRead()), iconOf: async () => (stamp === '9' ? null : picture), mw: { stamp: () => stamp, picture: async () => null } });
  stamp = null;
  keep.attach({ corpses: ((e) => () => [{ entity: e, pos: [0, 0, 0] }])({ items: [sword()] }) });
  keep.frame(0.016); await tick();
  stamp = '9'; keep.frame(0.016); await tick();
  assert.equal(keep.state()[0].pic, 'c:k@0,2,4,2', 'nothing came: the old picture stays');
  assert.equal(keep.batches().length, 1);
});

test('AUDIT PI1 R3/R7/L12 - a picture\'s clear edge bled from its shown texels (the mips\' dark fringe), a picture with nothing in it is none, and the cut copies (mutants: no bleed, alpha bled, the source written)', async () => {
  const c = new Uint8ClampedArray([200, 10, 20, 255, 0, 0, 0, 0, 0, 0, 0, 0]);
  bleedEdges(c, 3, 1, 1);
  assert.deepEqual([...c], [200, 10, 20, 255, 200, 10, 20, 0, 0, 0, 0, 0], 'one pass: the neighbour takes the colour, never the alpha');
  bleedEdges(c, 3, 1);
  assert.deepEqual([...c.slice(8)], [200, 10, 20, 0], 'the second pass reaches the next');
  assert.equal(hasVisible(new Uint8ClampedArray(16)), false);
  assert.equal(hasVisible(new Uint8ClampedArray([0, 0, 0, 127, 0, 0, 0, 128])), true, 'alpha 128 shows');
  // the layer bleeds what it cuts: a hole inside the box goes up in its neighbours' colour
  const holed = { key: 'h', width: 3, height: 1, colors: new Uint8ClampedArray([90, 0, 0, 255, 0, 0, 0, 0, 30, 0, 0, 255]) };
  const renderer = fakeRenderer();
  const hl = layerOf({ renderer, iconOf: async () => holed });
  hl.attach({ corpses: ((e) => () => [{ entity: e, pos: [0, 0, 0] }])({ items: [sword()] }) });
  hl.frame(0.016);
  await tick();
  assert.deepEqual([...renderer.up[0][4].slice(4, 8)], [60, 0, 0, 0], 'the hole bled, still clear');
  const src = new Uint8ClampedArray(picture.colors);
  const layer = layerOf({ iconOf: async () => ({ ...picture, colors: src }) });
  layer.attach({ corpses: ((e) => () => [{ entity: e, pos: [0, 0, 0] }])({ items: [sword()] }) });
  layer.frame(0.016);
  await tick();
  assert.deepEqual([...src], [...picture.colors], 'the pack\'s own picture is never written');
});

test('AUDIT PI1 R4 - the rim and the size follow the settings live: a slider moved re-dresses what stands (mutants: dressed once)', async () => {
  _resetModSettings();
  try {
    const renderer = fakeRenderer();
    const layer = createPhysicalItems({ renderer, enabled: () => true, iconOf: async () => picture, mw: noMw });
    layer.attach({ corpses: ((e) => () => [{ entity: e, pos: [0, 0, 0] }])({ items: [sword()] }) });
    layer.frame(0.016); await tick(); layer.frame(0.016);
    assert.deepEqual(layer.state()[0].size, { w: 0.8, h: 0.4 });
    setModSetting(PHYSICAL_ITEMS_VENDOR, 'Item Sizes.Weapons', 1.2);
    layer.frame(0.016);
    assert.deepEqual(layer.state()[0].size, { w: 1.2, h: 0.6 }, 'the new size, without a new body');
    assert.equal(renderer.made.length, 2);
  } finally { _resetModSettings(); }
});

test('AUDIT PI1 R5/L8/L7 - an item is presented only once its picture stands: its pile keeps its bag and target, its body\'s line counts it, and a picture that did not come is asked again (mutants: presented at the mint, never asked again)', async () => {
  let clock = 0, n = 0;
  const dl = poolOf({ iconOf: async () => (++n === 1 ? null : picture), now: () => clock });
  const [pile] = dl.dropPhysical([sword()], [0, 0, 0], [0, 0, 1]);
  dl.tickFlats(0.016); await tick(); dl.tickFlats(0.02);
  assert.equal(dl.physical.presents(pile), false);
  assert.equal(isPresented(pile.items[0]), false);
  assert.deepEqual(dl.lootTargets().map((t) => t.key), [`droppedLoot:${pile.id}`], 'pressed as the pile it is');
  assert.equal(dl.lootFinds().length, 1, 'its line, the pile\'s');
  clock = PI_RETRY_MS; dl.tickFlats(0.02); await tick(); dl.tickFlats(0.02);
  assert.equal(n, 2, 'asked again');
  assert.equal(dl.physical.presents(pile), true);
  assert.ok(dl.lootTargets().every((t) => t.key.startsWith(PI_KEY_PREFIX)));
  assert.equal(PI_RETRY_MAX, 3);
});

test('AUDIT PI1 I1/L5 - a body against a wall throws its items this side of it: the start moved out to the scatter point through ConstrainItemMovement, and the flight never crosses (mutants: the scatter point taken as is)', async () => {
  const c = room();
  const layer = layerOf({ rolls: (() => { const xs = [0.5, 1, 0.5]; let i = 0; return () => xs[i++ % 3]; })() });
  layer.attach({ collider: () => c, corpses: ((e) => () => [{ entity: e, pos: [0, 0, 1.6] }])({ items: [sword()] }) });
  layer.frame(0.016);
  assert.ok(layer.state()[0].pos[2] < 2, `started this side (${layer.state()[0].pos})`);
  await tick();
  for (let i = 0; i < 400; i++) { layer.frame(0.02); assert.ok(layer.state()[0].pos[2] < 2); }
  assert.ok(layer.state()[0].settled);
  // the law alone: stopped short by the item's own half-width and slid along the face
  const hit = (from, dir, len) => { if (dir[2] <= 0) return null; const d = (2 - from[2]) / dir[2]; return d >= 0 && d <= len ? { dist: d, normal: [0, 0, -1] } : null; };
  const at = constrainMove([0, 0, 1], [0.5, 0, 3], 0.2, 0.4, hit);
  assert.ok(at[2] <= 2 - 0.2 * PI_CONSTRAIN.share + 1e-9 && at[2] > 1.7, `short of the wall (${at})`);
  assert.ok(Math.abs(at[0] - 0.5) < 1e-9, 'slid the rest of the way along it');
  assert.deepEqual(constrainMove([0, 0, 0], [1, 2, 3], 0.2, 0.4, null), [1, 2, 3], 'no collider: the point as asked');
});

test('AUDIT PI1 L6 - the floor is asked from just over the item\'s foot, and a ceiling turns a rising item back: an item rolling under a table stays on the floor (mutants: asked from 0.5 m up, no ceiling)', () => {
  const c = room({ table: true });
  const b = makeBody([0, 0, -2], [0.5, 0, 0]);
  stepBody(b, groundOf(c), wallOf(c));
  assert.ok(Math.abs(b.pos[1]) < 1e-9, `under the table, on the floor (${b.pos})`);
  assert.equal(PI_PROBE_LIFT, 0.05);
  const up = makeBody([0, 0.5, 0], [0, 3, 0], [0.2, 0.2], 0.4);
  const ceiling = (from, dir, len) => (dir[1] === 1 && from[1] + len >= 0.93 ? 0.93 - from[1] : null);   // 3 cm over its top
  const vn = (3 - PI_BODY.gravity * PI_BODY.dt) / (1 + PI_BODY.drag * PI_BODY.dt);
  assert.equal(stepBody(up, () => 0, ceiling), 'bounce');
  assert.ok(Math.abs(up.vel[1] + PI_BODY.bounce * vn) < 1e-12, `turned back at the bounce (${up.vel[1]})`);
});

test('AUDIT PI1 I2/H2 - the press takes the whole stack or nothing (CanCarryWholeStack [IL_858c], "cannotCarryAnymore"), and a refused press leaves the item standing and the room untold (mutants: the part taken)', async () => {
  const layer = layerOf();
  const gold = goldStack(100000), body = { items: [gold] };
  const said = [], heard = [];
  layer.attach({ corpses: () => [{ entity: body, pos: [0, 0, 0], key: 'corpse:1' }], say: (l) => said.push(l), taken: (b) => heard.push(b) });
  layer.frame(0.016); await tick(); layer.frame(0.02);
  const p = player(10);
  assert.equal(layer.pick(layer.targets()[0].key, p), true);
  assert.deepEqual(said, ['You cannot carry any more stuff.']);
  assert.deepEqual([body.items, gold.stackCount, p.goldPieces, heard.length], [[gold], 100000, 0, 0]);
  assert.equal(layer.state().length, 1, 'still standing');
});

test('AUDIT PI1 I11/maps - a summoned item is refused aloud first; a map is read and spent on the press, with none left to reveal said; a host with no reveal brings it whole (mutants: the summoned check after the map arm, the map packed where it is read)', async () => {
  const maps = []; randomlyAddMap(1, maps, () => 0);
  for (const [reveal, line, packed] of [[() => 'Somewhere', undefined, 0], [() => null, USE_TEXT.readMapFail, 0], [null, tookItemText(maps[0]), 1]]) {
    const said = [];
    const layer = layerOf();
    const body = { items: [{ ...maps[0] }] };
    layer.attach({ corpses: () => [{ entity: body, pos: [0, 0, 0], key: 'c:1' }], say: (l) => said.push(l), revealMap: reveal });
    layer.frame(0.016); await tick(); layer.frame(0.02);
    const p = player();
    assert.equal(layer.pick(layer.targets()[0].key, p), true);
    assert.deepEqual(body.items, []);
    assert.equal(p.items.length, packed);
    assert.equal(said[0], line);
  }
  const said = [];
  const layer = layerOf();
  const summoned = { ...maps[0], summoned: true, timeForItemToDisappear: 1 };
  const body = { items: [summoned] };
  layer.attach({ corpses: () => [{ entity: body, pos: [0, 0, 0] }], say: (l) => said.push(l), revealMap: () => assert.fail('a summoned map is not read') });
  layer.frame(0.016); await tick(); layer.frame(0.02);
  layer.pick(layer.targets()[0].key, player());
  assert.deepEqual([said, body.items.length], [[CANNOT_REMOVE_ITEM_TEXT], 1]);
});

test('AUDIT PI1 H3/H7 - the press spends an armed quick-loot key, a transformed lycanthrope\'s paws take nothing, and a body\'s silver is rolled at its first take (mutants: the key left armed, the paws taking, no roll)', async () => {
  setPref('quickLoot', true);
  _resetSilverFindsForTests();
  setSilverFinder(() => {});
  try {
    const layer = layerOf();
    const body = { items: [sword(), sword()] };
    const said = [];
    layer.attach({ corpses: () => [{ entity: body, pos: [0, 0, 0], key: 'c:1', silver: 'silver:c:1' }], say: (l) => said.push(l) });
    layer.frame(0.016); await tick(); layer.frame(0.02);
    const [k0, k1] = layer.targets().map((t) => t.key);
    const beast = { ...player(), race: 'Breton', activeEffects: [{ kind: 'racialOverride', racial: 'lycanthropy', isTransformed: true, infectionType: 1 }] };
    assert.equal(layer.pick(k0, beast), true);
    assert.equal(body.items.length, 2, 'the paws took nothing');
    assert.equal(said.length, 1, 'and said why');
    assert.equal(silverFindAt('corpse', 'silver:c:2', () => 0), true, 'an untouched body would roll');
    foldQuickLoot(resolveHover({ key: k0, distance: 2, reach: 3 }, { name: () => ({ title: 'Longsword' }), contents: () => [body.items[0]] }));
    assert.equal(quickLootArm('QuickLootAll'), true, 'armed over the item');
    layer.pick(k0, player());
    assert.equal(body.items.length, 1);
    assert.equal(silverFindAt('corpse', 'silver:c:1', () => 0), false, 'this body\'s silver was rolled at the take');
    const pile = [{ name: 'Torch', weight: 0.5 }, { name: 'Apple', weight: 0.1 }];
    foldQuickLoot(resolveHover({ key: 'droppedLoot:7', distance: 2, reach: 3 }, { name: () => ({ title: 'Loot Pile' }), contents: () => pile }));
    quickLootTake('droppedLoot:7', { items: () => pile }, player(), () => {});
    assert.equal(pile.length, 1, 'the next E took the lit row alone - the armed P was spent on the item');
    layer.pick(k1, player());
  } finally { setPref('quickLoot', false); resetQuickLoot(); _resetSilverFindsForTests(); }
});

test('AUDIT PI1 H2 - the room hears every take that moved anything, and an emptied shift-drop is that pile freed alone (H8: never another emptied container) (mutants: no word on a move, releaseEmptied)', async () => {
  const dl = poolOf();
  const untouched = dl.seedPile([], [5, 0, 5], { archive: 205, record: 0 });
  dl.dropPhysical([sword()], [0, 0, 0], [0, 0, 1]);
  dl.tickFlats(0.016); await tick(); dl.tickFlats(0.02);
  const heard = [];
  dl.physical.attach({ taken: (b) => heard.push(b.kind) });
  dl.physical.pick(dl.lootTargets().find((t) => t.key.startsWith(PI_KEY_PREFIX)).key, player());
  assert.deepEqual(heard, ['pile']);
  assert.deepEqual(dl._piles, [untouched], 'the drop freed');
  assert.ok(!untouched.inactive, 'the scene\'s empty container never deactivated with it (releaseEmptied would)');
});

test('AUDIT PI1 H5/L11/L4/L15 - a body that moves carries its items; a list replaced with look-alikes keeps every picture where it lies; a feed that throws is not "no bodies"; an item gone from the list is no plaque (mutants: the items left behind, the lot thrown again, the lot retired)', async () => {
  const layer = layerOf();
  const at = [0, 0, 0], body = { items: [sword(), createRandomArmor(1, () => 0.3)] };
  let boom = false;
  layer.attach({ corpses: () => { if (boom) throw new Error('feed'); return [{ entity: body, pos: [...at] }]; } });
  layer.frame(0.016); await tick();
  for (let i = 0; i < 400; i++) layer.frame(0.02);
  const before = layer.state();
  assert.ok(before.length === 2 && before.every((p) => p.settled));
  at[0] = 5; layer.frame(0.02);
  assert.deepEqual(layer.state().map((p) => p.pos), before.map((p) => [p.pos[0] + 5, p.pos[1], p.pos[2]]), 'carried with the deck');
  // the room's word replaces the list with equal items: each picture handed to its look-alike, where it lies
  const old = body.items;
  body.items = old.map((it) => ({ ...it }));
  assert.ok(body.items.every((it, i) => itemLook(it) === itemLook(old[i])));
  layer.frame(0.02);
  const after = layer.state();
  assert.deepEqual(after.map((p) => [p.id, p.settled, p.item]), before.map((p, i) => [p.id, true, body.items[i]]), 'the same proxies, lying, now the new items\'');
  assert.deepEqual(after.map((p) => p.pos), before.map((p) => [p.pos[0] + 5, p.pos[1], p.pos[2]]), 'not thrown again');
  assert.deepEqual([...body.items, ...old].map(isPresented), [true, true, false, false]);
  boom = true;
  layer.frame(0.02);
  assert.equal(layer.state().length, 2, 'a feed that threw keeps what stands');
  const key = `${PI_KEY_PREFIX}${after[0].id}`;
  assert.deepEqual(layer.contents(key), [body.items[0]]);
  body.items.shift();
  assert.equal(layer.contents(key), null, 'gone from the list: no plaque, even before the frame');
});

test('AUDIT PI1 L10 - the flights hold while the game is paused (FixedUpdate returns on IsGamePaused [IL_1eb6]) (mutants: flown under the window)', async () => {
  let paused = true;
  const layer = layerOf();
  layer.attach({ corpses: ((e) => () => [{ entity: e, pos: [0, 0, 0] }])({ items: [sword()] }), paused: () => paused });
  layer.frame(0.016); await tick();
  const was = layer.state()[0].pos;
  for (let i = 0; i < 20; i++) layer.frame(0.02);
  assert.deepEqual(layer.state()[0].pos, was);
  paused = false; layer.frame(0.02);
  assert.notDeepEqual(layer.state()[0].pos, was);
  assert.match(read('src/scenes/world.js'), /paused: \(\) => !!gamePaused\(\),\s+\/\/ AUDIT PI1 L10/);
  assert.match(read('src/scenes/exterior.js'), /paused: \(\) => !!gamePaused\(\),\s+\/\/ AUDIT PI1 L10/);
  assert.match(read('src/scenes/worldModes.js'), /paused: \(\) => !!townTalk\?\.overlayActive \|\| interiorPaused\(\),/);
  assert.match(read('src/scenes/dungeonContext.js'), /paused: \(\) => dungeonPaused\(\),/);
});

test('AUDIT PI1 I3/I5/L6 - the shift-drop\'s footprint is max(0.2, 0.6 x its size); the floor is the face nearest the feet\'s height (never a table over them); a point behind a wall is refused (mutants: one footprint for all, the first face down, no path check)', async () => {
  assert.deepEqual([dropRadius(0.8), dropRadius(0.2), PI_FOOTPRINT.min, PI_FOOTPRINT.share], [0.48, 0.2, 0.2, 0.6]);
  const dl = poolOf();
  const piles = dl.dropPhysical([sword(), createRandomArmor(1, () => 0.3)], [0, 0, 0], [0, 0, 1]);
  const r2 = spiralPoint([0, 0, 1.1], 2);
  assert.ok(Math.abs(piles[1].pos[0] - r2[0]) < 1e-9 && Math.abs(piles[1].pos[2] - r2[2]) < 1e-9, `ring 1 is inside 0.48 + 0.39 + 0.1: ring 2 (${piles[1].pos} vs ${r2})`);
  assert.equal(nearestFloor([{ y: 1.5, ny: 1 }, { y: 0.1, ny: 1 }, { y: -0.05, ny: 0.2 }], 0), 0.1, 'the nearest floor face - a steep one is no floor');
  assert.equal(nearestFloor([{ y: 0, ny: 0.49 }], 0), null);
  assert.deepEqual([PI_FLOOR_PROBE.up, PI_FLOOR_PROBE.len, PI_FLOOR_PROBE.floorNormalY, PI_PATH.lift, PI_PATH.skin], [2, 5, 0.5, 0.2, 0.05]);
  const t = poolOf();
  t.physical.attach({ collider: () => room({ table: true }) });
  const [under] = t.dropPhysical([sword()], [0, 0, -2.2], [0, 0, 1]);
  assert.ok(Math.abs(under.pos[1] - 0.025) < 1e-9, `on the floor under the table, not on it (${under.pos})`);
  const w = poolOf();
  w.physical.attach({ collider: () => room() });
  const [p] = w.dropPhysical([sword()], [0, 0, 1.5], [0, 0, 1]);
  assert.ok(p.pos[2] < 2, `the spot 1.1 m ahead is behind the wall: one this side (${p.pos})`);
});

test('AUDIT PI1 I6/I10/D1g - the press reaches 3 m (RaycastPhysicalItem [IL_5b54]); an infinite Impulse Strength clamps; a death is fresh for 4 s (mutants: the pile\'s reach, Infinity read as the default, the window moved)', async () => {
  const layer = layerOf();
  layer.attach({ corpses: ((e) => () => [{ entity: e, pos: [0, 0, 0] }])({ items: [sword()] }) });
  layer.frame(0.016); await tick(); layer.frame(0.02);
  const [t] = layer.targets();
  assert.equal(t.reach, PI_REACH); assert.equal(PI_REACH, 3);
  assert.deepEqual([readPhysicalItemsSettings(shippedRead({ 'Enemy Loot.Impulse Strength': Infinity })).impulse, readPhysicalItemsSettings(shippedRead({ 'Enemy Loot.Impulse Strength': -Infinity })).impulse, readPhysicalItemsSettings(shippedRead({ 'Enemy Loot.Impulse Strength': 'x' })).impulse], [4, 0, 2]);
  const e = {};
  markDeath(e, 0);
  assert.deepEqual([diedRecently(e, PI_FRESH_MS), diedRecently(e, PI_FRESH_MS + 1), PI_FRESH_MS], [true, false, 4000]);
  const s = layer.state()[0];
  assert.deepEqual([s.noShadow, s.glint], [true, null], 'lying things cast no card\'s shadow; a Common item wears no rim');
});

test('AUDIT PI1 H4/H6/H7/D1f - the hosts\' halves: the fate window drops nothing, a dungeon\'s save keeps a shift-drop one, an unreadable body stands nothing, its silver by the room\'s name, and the watch called indoors stands its dead (mutants: each line gone)', () => {
  assert.match(read('src/scenes/world.js'), /makeInventoryWindow\(\{ fate: model, loot: \{ items: \(\) => \[\], playerOwned: false \}, physicalDropOn: \(\) => false \}\)/);
  const dc = read('src/scenes/dungeonContext.js');
  assert.match(dc, /\.\.\.\(p\.physical \? \{ physical: true \} : \{\}\),\s+\/\/ AUDIT PI1 H6/);
  assert.match(dc, /if \(u && _lootUnreadable\.has\(lootKeyOf\(u\)\)\) return null;/);
  assert.match(dc, /silver: silverFindKey\(key, 'corpse', i\)/);
  assert.match(read('src/scenes/worldModes.js'), /corpses: \(\) => \[\.\.\.\(interiorFoes\?\.physicalCorpses\?\.\(\) \?\? \[\]\), \.\.\.\(interiorGuards\?\.physicalCorpses\?\.\(\) \?\? \[\]\)\]/);
});

test('AUDIT PI1 H6 - a shift-drop restored from the dungeon\'s save lies where it was saved, an item of its own again (mutants: restored as a bag)', async () => {
  const dl = poolOf();
  dl.restorePiles([{ pos: [1, 0, 1], archive: 205, record: 0, items: [sword()], physical: true }]);
  assert.ok(dl._piles[0].physical && dl._piles[0].settled);
  dl.tickFlats(0.016); await tick(); dl.tickFlats(0.02);
  assert.deepEqual(dl.physical.state().map((p) => [p.kind, p.settled, p.pos]), [['pile', true, [1, 0, 1]]]);
});

test('AUDIT PI1 the recentre and the ground move carry the proxies and their bodies\' places (mutants: either forward dropped)', async () => {
  const dl = poolOf();
  const at = [0, 0, 0], body = { items: [sword()] };
  dl.physical.attach({ corpses: () => [{ entity: body, pos: [...at] }] });
  dl.tickFlats(0.016); await tick(); for (let i = 0; i < 400; i++) dl.tickFlats(0.02);
  const before = dl.physical.state()[0].pos;
  dl.offsetAll([10, 1, -5]); at[0] += 10; at[1] += 1; at[2] -= 5;
  dl.tickFlats(0.02);
  assert.deepEqual(dl.physical.state()[0].pos, [before[0] + 10, before[1] + 1, before[2] - 5], 'moved once, not twice');
  dl.groundMoved(-100, -100, 100, 100, () => 2); at[1] += 2;
  dl.tickFlats(0.02);
  assert.equal(dl.physical.state()[0].pos[1], before[1] + 3);
});

test('AUDIT PI1 the classic pack\'s Shift + click on a pack slot drops the whole stack as itself; a host that says no keeps DFU\'s click (mutants: the arm unwired)', () => {
  const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };
  const t = ITEM_TEMPLATES.find((x) => x.name === 'Arrow');
  const arrows = (n) => ({ name: t.name, templateIndex: t.index, group: 'Weapons', stackCount: n });
  const slot = (w) => w.click(163 + CELL_X + 5, 48 + 5);
  const bag = [arrows(10)], laid = [];
  const w = new NativeInventoryWindow({ items: () => bag, entity: { items: bag }, icons: ICONS, physicalDropOn: () => true, physicalDrop: (l) => laid.push(...l) });
  w.mode = 'info';
  w.hover(10, 10, { shiftKey: true });
  slot(w);
  assert.deepEqual(laid.map((it) => `${it.name}:${it.stackCount}`), ['Arrow:10']);
  assert.equal(bag.length, 0);
  const bag2 = [arrows(3)], laid2 = [];
  const w2 = new NativeInventoryWindow({ items: () => bag2, entity: { items: bag2 }, icons: ICONS, physicalDropOn: () => false, physicalDrop: (l) => laid2.push(...l) });
  w2.mode = 'info'; w2.hover(10, 10, { shiftKey: true }); slot(w2);
  assert.deepEqual([laid2.length, bag2.length], [0, 1]);
});

test('AUDIT PI1 the body\'s settle on a real collider: a hard throw at a wall bounces back off it and comes to rest this side (mutants: the wall passed)', () => {
  const c = room();
  const b = makeBody([0, 0.5, 1.5], [0, 0, 3]);
  let bounced = false;
  for (let i = 0; i < 600 && !b.settled; i++) if (stepBody(b, groundOf(c), wallOf(c)) === 'bounce') bounced = true;
  assert.ok(bounced && b.settled && b.pos[2] < 2 && b.vel[2] === 0, `${b.pos}`);
  const s = makeBody([0, 0, 0], [2, 0, 0]);
  flyBody(s, 0.02, () => 0);
  const damp = 1 / (1 + PI_BODY.drag * PI_BODY.dt), vn = PI_BODY.gravity * PI_BODY.dt * damp;
  assert.ok(Math.abs(s.vel[0] - (2 * damp - PI_BODY.dynamicGrip * vn)) < 1e-12, `one step's slide loses exactly the grip of its weight (${s.vel[0]})`);
});
