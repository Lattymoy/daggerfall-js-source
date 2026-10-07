// PI1 (2026-10-07, Mac: "This is the next mod I would like to integrate (permission has been granted). This should work
// for both morrowind and the sprite system, and should also included the rarity treatment (like we do for the world
// boss)"): PHYSICAL ITEMS 0.1.29, by demifiend000 - a body's items thrown out round it, a shift-drop laid ahead of the
// player, each item its own picture, taken on a press. The port's law is the shipped assembly's IL
// (vendor/physical-items/il); every pin names the offsets it holds the port to (bible/06-Systems/Physical-Items.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import {
  PHYSICAL_ITEMS_VENDOR, PI_CATEGORIES, itemCategory, defaultWorldHeight, readPhysicalItemsSettings, worldHeight, showsOnCorpse,
  visibleBox, cropTo, artworkSize, colliderDepth, scatterOffset, proxyLaunch, spiralPoint, spiralDrop, PI_SPIRAL, makeBody,
  stepBody, flyBody, shoulder, settleBody, PI_BODY, rarityRim, PI_RIM, isPresented, markDeath, diedRecently, shiftDrop, shiftDropRefusal,
} from '../src/systems/physicalItems.js';
import { createPhysicalItems, PI_KEY_PREFIX, PI_ICON_ARCHIVE } from '../src/scenes/physicalItemsLayer.js';
import { createDroppedLoot } from '../src/scenes/droppedLoot.js';
import { pickLootLines } from '../src/scenes/lootLines.js';
import { raiseEnemyDeath, physicalCorpseSources } from '../src/scenes/corpseMarker.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { ONLINE_PLAYERS_OWN_MODS } from '../src/systems/onlineLane.js';
import { MOD_CURATED } from '../src/systems/features.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { createRandomArmor, createRandomClothing, createRandomPotion, randomlyAddMap } from '../src/systems/loot.js';
import { goldStack } from '../src/systems/inventory.js';
import { tierColour } from '../src/render/spoilsGlow.js';
import { CANNOT_REMOVE_ITEM_TEXT } from '../src/systems/createItem.js';
import { setPref } from '../src/systems/uiPrefs.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const VENDOR = 'vendor/physical-items';
const IL = read(`${VENDOR}/il/PhysicalItems.il.txt`);
const SHIPPED = JSON.parse(read(`${VENDOR}/modsettings.json`));
/** One method body out of the IL dump. */
const method = (name) => { const i = IL.indexOf(`---- ${name} `); assert.ok(i >= 0, name); const j = IL.indexOf('\n---- ', i + 1); return IL.slice(i, j < 0 ? undefined : j); };
/** The settings as shipped, with `over` laid on - no store. */
const shippedRead = (over = {}) => {
  const base = Object.fromEntries(Object.entries(MOD_SETTINGS[PHYSICAL_ITEMS_VENDOR].keys).map(([k, d]) => [k, d.default]));
  const all = { ...base, ...over };
  return (k) => all[k];
};
const fixed = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };
const sword = () => createWeapon(120, 0, () => 0.5);

test('PI1 the record: the manifest verbatim, and every key the port reads restated under the vendor in the file\'s order with the author\'s words, ranges and defaults - the Interaction section alone not declared', () => {
  const mf = JSON.parse(read(`${VENDOR}/physical-items.dfmod.json`));
  assert.deepEqual([mf.ModTitle, mf.ModVersion, mf.ModAuthor, mf.DFUnity_Version, mf.GUID, mf.Dependencies.map((d) => d.Name)],
    ['Physical Items', '0.1.29', 'demifiend000', '1.1.1', '8764ae71-a464-4a5e-b646-fbc464670137', ['daggerfall.harmony']]);
  const keys = MOD_SETTINGS[PHYSICAL_ITEMS_VENDOR].keys;
  const shipped = SHIPPED.Sections.filter((s) => s.Name !== 'Interaction').flatMap((s) => s.Keys.map((k) => [`${s.Name}.${k.Name}`, k]));
  assert.deepEqual(Object.keys(keys).filter((k) => k !== 'Enabled'), shipped.map(([n]) => n));
  for (const [name, k] of shipped) {
    assert.equal(keys[name].description, k.Description, `${name}: the author's words`);
    assert.equal(keys[name].default, k.Value, `${name}: the shipped default`);
    if ('Min' in k) assert.deepEqual([keys[name].min, keys[name].max], [k.Min, k.Max], `${name}: the slider's range`);
  }
  assert.deepEqual(SHIPPED.Sections.find((s) => s.Name === 'Interaction').Keys.map((k) => k.Name),
    ['Placement Mode Key', 'Freeze Placement Key', 'Scroll Mode Key', 'Character Item Collision'], 'the four undeclared keys are the placement section, as the page says');
  assert.equal(keys.Enabled.default, true);
  assert.ok(ONLINE_PLAYERS_OWN_MODS.includes(PHYSICAL_ITEMS_VENDOR), 'online: the player\'s own');
  assert.deepEqual(MOD_CURATED[PHYSICAL_ITEMS_VENDOR], ['Enemy Loot.Physical Enemy Drops', 'Enemy Loot.Impulse Strength', 'Item Sizes.Weapons', 'Item Sizes.Armor']);
});

test('PI1 the categories: ItemCategories (.cctor [IL_7dac]) in the mod\'s order, and GetItemCategory [IL_28e4] over every producer the port mints from', () => {
  const ordered = [...method('PhysicalItemManager::.cctor').matchAll(/ldstr\s+"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(PI_CATEGORIES, ordered);
  assert.deepEqual(SHIPPED.Sections.find((s) => s.Name === 'Enemy Categories').Keys.map((k) => k.Name), [...PI_CATEGORIES]);
  const maps = []; randomlyAddMap(1, maps, () => 0);
  const minted = [sword(), createWeapon(131, 0, () => 0.5), createRandomArmor(1, () => 0.3), createRandomClothing('male', () => 0.3), createRandomPotion(() => 0.1), maps[0], goldStack(7)];
  assert.deepEqual(minted.map(itemCategory), ['Weapons', 'Arrows', 'Armor', 'Clothing', 'Potions', 'Maps', 'Gold']);
  const g = (group, templateIndex = 0) => itemCategory({ group, templateIndex });
  assert.deepEqual(['Gems', 'Jewellery', 'Books', 'ReligiousItems', 'QuestItems', 'Transportation', 'MagicItems', 'Artifacts', 'PlantIngredients1', 'MetalIngredients', 'MiscellaneousIngredients2', 'WomensClothing', 'Maps'].map((x) => g(x)),
    ['Gems', 'Jewellery', 'Books', 'Religious Items', 'Quest Items', 'Transportation', 'Magic Items', 'Magic Items', 'Ingredients', 'Ingredients', 'Ingredients', 'Clothing', 'Maps']);
  assert.deepEqual(['Drugs', 'UselessItems1', 'Furniture', 'UselessItems2', 'Paintings', 'Deeds', 'MiscItems'].map((x) => g(x)), Array(7).fill('Other Items'), 'the switch\'s default arm, and a MiscItems that is not a map');
  assert.equal(itemCategory(null), 'Other Items');
});

test('PI1 the sizes: GetDefaultWorldHeight [IL_2a08] as the IL holds it, the overrides by enum name (ApplySettings [IL_2f73] - both pauldrons one key), and the clamps', () => {
  const body = method('PhysicalItemManager::GetDefaultWorldHeight');
  for (const v of ['0.800000011920929', '0.3199999928474426', '0.5199999809265137', '0.6499999761581421', '0.4000000059604645']) assert.ok(body.includes(`ldc.r4         ${v}`), v);
  assert.deepEqual([sword(), createWeapon(131, 0, () => 0.5), createRandomArmor(1, () => 0.3), createRandomClothing('male', () => 0.3), goldStack(3)].map(defaultWorldHeight), [0.8, 0.32, 0.65, 0.52, 0.4]);
  const s = readPhysicalItemsSettings(shippedRead({ 'Weapon Sizes.Longsword': 1.2, 'Armor Sizes.Pauldrons': 0.05, 'Item Sizes.Gold': 9, 'Weapon Sizes.Dai Katana': 0, 'Enemy Loot.Impulse Strength': 500, 'Enemy Categories.Gems': false }));
  assert.equal(worldHeight(sword(), s), 1.2, 'a weapon\'s own override');
  assert.equal(worldHeight({ group: 'Armor', templateIndex: 105 }, s), 0.1, 'a positive override under 0.1 reads 0.1');
  assert.equal(worldHeight({ group: 'Armor', templateIndex: 106 }, s), 0.1, 'the right pauldron answers to the same key');
  assert.equal(worldHeight({ group: 'Weapons', templateIndex: 123 }, s), 0.8, '0 inherits the category');
  assert.equal(worldHeight(goldStack(3), s), 1.5, 'a category\'s size clamps to 1.5');
  assert.equal(s.impulse, 4, 'Impulse Strength clamps to 400 percent');
  assert.equal(readPhysicalItemsSettings(shippedRead()).impulse, 2, 'the shipped 200 is twice the base throw');
  assert.equal(readPhysicalItemsSettings(shippedRead({ 'Enemy Loot.Impulse Strength': NaN })).impulse, 2, 'a NaN reads the shipped value');
  assert.equal(showsOnCorpse({ group: 'Gems', templateIndex: 0 }, s), false, 'a category turned off stays in the body');
  assert.equal(showsOnCorpse(sword(), readPhysicalItemsSettings(shippedRead({ 'Enemy Loot.Physical Enemy Drops': false }))), false, 'the master switch');
  assert.equal(showsOnCorpse(sword(), s), true);
});

test('PI1 the picture: the visible box at alpha 128 [IL_0d39], the whole picture when nothing shows, the cut, and the longer side made the size (BuildVisual [IL_09b8]) with the box\'s depth [IL_1a21]', () => {
  const w = 5, h = 4, px = new Uint8ClampedArray(w * h * 4);
  const set = (x, y, a) => { px[(y * w + x) * 4 + 3] = a; px[(y * w + x) * 4] = 10 + x; };
  set(1, 1, 128); set(3, 2, 200); set(4, 3, 127);
  assert.deepEqual(visibleBox(px, w, h), { x: 1, y: 1, w: 3, h: 2 });
  assert.deepEqual(visibleBox(new Uint8ClampedArray(16), 2, 2), { x: 0, y: 0, w: 2, h: 2 });
  const cut = cropTo(px, w, { x: 1, y: 1, w: 3, h: 2 });
  assert.equal(cut.length, 24); assert.equal(cut[0], 11); assert.equal(cut[3], 128); assert.equal(cut[(1 * 3 + 2) * 4 + 3], 200);
  assert.deepEqual(artworkSize(30, 15, 0.8), { w: 0.8, h: 0.4 });
  assert.deepEqual(artworkSize(10, 40, 0.4), { w: 0.1, h: 0.4 });
  assert.equal(colliderDepth(0.2, 1), 0.4); assert.equal(colliderDepth(0.6, 1), 0.6);
});

test('PI1 the scatter and the throw: RandomScatterOffset [IL_51d8] and CreateCorpseProxy\'s launch [IL_4fe6] - out, up, scaled by Impulse Strength only at the fall', () => {
  // insideUnitCircle off (0.5, 1) = (0, 1) (passiveFish.js's rejection draw); the range's roll 0.5 -> 0.65 m out; 0.65 up
  assert.deepEqual(scatterOffset(fixed(0.5, 1, 0.5)).map((v) => +v.toFixed(6)), [0, 0.65, 0.65]);
  const body = method('PhysicalItemManager::RandomScatterOffset');
  for (const v of ['0.44999998807907104', '0.8500000238418579', '0.6499999761581421']) assert.ok(body.includes(v), v);
  // the nudge: 0.08 along the bearing and 0.08 up, never scaled
  assert.deepEqual(proxyLaunch([3, 0, 4], false, 2, fixed(0.5)).map((v) => +v.toFixed(6)), [0.048, 0.08, 0.064]);
  // the fall: 0.75..1 of 0.85 along it (roll 0 -> 0.6375), a tenth of the disc ((0.5, 0.5) -> the centre), 0.7..1.1 up (roll 0.5 -> 0.9), times 2
  assert.deepEqual(proxyLaunch([0, 0, 1], true, 2, fixed(0, 0.5, 0.5, 0.5)).map((v) => +v.toFixed(6)), [0, 1.8, 1.275]);
  const launch = method('PhysicalItemManager::CreateCorpseProxy');
  for (const v of ['0.07999999821186066', '0.8500000238418579', '0.75', '0.699999988079071', '1.100000023841858', 'PhysicalItemManager::enemyImpulseStrength']) assert.ok(launch.includes(v), v);
});

test('PI1 the spiral: GetBatchDropPosition [IL_4028] - 0.78 * sqrt(i) at the golden angle, 1.1 m ahead, a point refused for no floor, a blocked way or another drop\'s footprint, the anchor past 256 tries', () => {
  assert.deepEqual(spiralPoint([0, 0, 0], 0), [0, 0, 0]);
  const p4 = spiralPoint([0, 0, 0], 4);
  assert.ok(Math.abs(Math.hypot(p4[0], p4[2]) - 1.56) < 1e-9);
  assert.ok(Math.abs(p4[0] - 1.56 * Math.cos(4 * 2.399963140487671)) < 1e-9 && Math.abs(p4[2] - 1.56 * Math.sin(4 * 2.399963140487671)) < 1e-9);
  assert.ok(method('PhysicalItemManager::GetBatchDropPosition').includes('2.399963140487671'));
  assert.ok(method('PhysicalItemManager::GetBatchDropAnchor').length && method('PhysicalItemManager::GetBatchSpreadCentre').includes('1.100000023841858'));
  const next = { i: 0 };
  const placed = [{ pos: [0, 0, 0], r: 0.2 }];
  const at = spiralDrop([0, 0, -1.1], [0, 0, 0], 0.2, next, placed, () => 0);
  assert.ok(Math.hypot(at[0], at[2]) >= 0.5, 'clear of the drop lying at the centre (0.2 + 0.2 + 0.1)');
  assert.equal(next.i, 2, 'the centre was tried and refused, ring 1 taken - the index past both');
  const tight = { i: 0 };
  spiralDrop([0, 0, -1.1], [0, 0, 0], 0.35, tight, [{ pos: [0, 0, 0], r: 0.35 }], () => 0);
  assert.equal(tight.i, 3, 'ring 1 (0.78 out) is inside 0.35 + 0.35 + the 0.1 margin: ring 2 taken');
  const none = spiralDrop([9, 1, 9], [0, 0, 0], 0.2, { i: 0 }, [], () => null);
  assert.deepEqual(none, [9, 1, 9], 'no floor anywhere: the anchor');
  assert.equal(PI_SPIRAL.tries, 256);
});

test('PI1 the body: a drop falls, a hard landing bounces at 0.35 and a soft one does not (the 2 m/s threshold), the grip stops a slide, and it settles after half a second quiet with the ground in reach', () => {
  const flat = () => 0;
  const b = makeBody([0, 0.15, 0]);
  let steps = 0, bounced = false;
  while (!b.settled && steps < 400) { if (stepBody(b, flat) === 'bounce') bounced = true; steps++; }
  assert.ok(b.settled && Math.abs(b.pos[1]) < 1e-9);
  assert.equal(bounced, false, 'from 0.15 m the landing is under 2 m/s: no bounce');
  assert.ok(steps * PI_BODY.dt >= PI_BODY.settleS, 'settled only after half a second at rest');
  const hard = makeBody([0, 3, 0]);
  let up = null, landing = 0;
  for (let i = 0; i < 400 && up == null; i++) {
    // the landing speed this step reaches: gravity's step, then the drag's
    landing = (-hard.vel[1] + PI_BODY.gravity * PI_BODY.dt) / (1 + PI_BODY.drag * PI_BODY.dt);
    if (stepBody(hard, flat) === 'bounce') up = hard.vel[1];
  }
  assert.ok(up > 0, 'from 3 m it bounces');
  assert.ok(Math.abs(up - 0.35 * landing) < 1e-9, `the bounce is 0.35 of the landing (${up} of ${landing})`);
  const slide = makeBody([0, 0, 0], [2, 0, 0]);
  for (let i = 0; i < 150; i++) flyBody(slide, 0.02, flat);
  const theory = 4 / (2 * PI_BODY.dynamicGrip * PI_BODY.gravity);   // v^2 / 2 mu g with no drag - the drag (every axis, as Unity's) takes its share
  assert.ok(slide.settled && slide.pos[0] > theory * 0.7 && slide.pos[0] < theory, `it slides about v^2 / 2 mu g and stops (${slide.pos[0]} of ${theory})`);
  const lost = makeBody([0, 1, 0]);
  for (let i = 0; i < 80; i++) flyBody(lost, 0.25, () => null);   // a frame's step is capped at 0.25 s
  assert.ok(lost.settled, 'no ground ever: the port\'s floor stands it');
  assert.deepEqual({ ...PI_BODY }, { gravity: 9.81, dt: 0.02, drag: 0.9, bounce: 0.35, bounceThreshold: 2, dynamicGrip: (0.45 + 0.6) / 2, staticGrip: (0.55 + 0.6) / 2, settleSq: 0.0025, settleS: 0.5, reach: 0.1, flightMaxS: 8 },
    'the rigidbody as the mod sets it, against Unity\'s defaults (the material 0.6/0.6, the bounce threshold 2, gravity 9.81, the 0.02 s step)');
  const upd = method('PhysicalItemInstance::Update');
  assert.ok(upd.includes('0.002500000176951289') && upd.includes('ldc.r4         0.5'), 'Update\'s quiet speed and time');
  const res = method('PhysicalItemManager::CreatePresentationResources');
  for (const v of ['0.3499999940395355', '0.44999998807907104', '0.550000011920929']) assert.ok(res.includes(v), v);
  assert.ok(method('PhysicalItemInstance::BuildVisual').includes('0.8999999761581421'), 'the drag');
});

test('PI1 the shoulder: FixedUpdate [IL_1e94] - two slow bodies on one spot by the ground ease apart at 0.45 m/s; a fast, a settled or a flying one is left alone', () => {
  const grounded = (...a) => Object.assign(makeBody(...a), { nearGround: true });   // stepBody's own word: within 0.15 m of the floor
  const a = grounded([0, 0, 0], [0, 0, 0], [0.2, 0.2]), c = grounded([0.1, 0, 0], [0, 0, 0], [0.2, 0.2]);
  for (let i = 0; i < 30; i++) shoulder([a, c], 0.02);
  assert.ok(a.vel[0] < 0 && c.vel[0] > 0, 'apart');
  assert.ok(Math.abs(c.vel[0] - 0.45) < 1e-9, 'at the shoulder\'s speed once eased');
  const fast = grounded([0, 0, 0], [1, 0, 0], [0.2, 0.2]), d = grounded([0, 0, 0], [0, 0, 0], [0.2, 0.2]);
  shoulder([fast, d], 0.02);
  assert.equal(fast.vel[0], 1, 'over 0.65 m/s across it is not slowed');
  assert.ok(Math.abs(d.vel[0] - 0.03) < 1e-12 && d.vel[2] === 0, 'the slow one is eased by exactly 1.5 m/s a second x 0.02 s - right, the higher index of a tie');
  const high = makeBody([0, 0, 0]), low = grounded([0, 0, 0]);
  shoulder([high, low], 0.02);
  assert.deepEqual([high.vel, low.vel], [[0, 0, 0], [0.03, 0, 0]], 'a body in the air is not shouldered - the one by the ground is, off it');
  const stood = grounded([0, 0, 0]), by = grounded([0.05, 0, 0]);
  settleBody(stood);
  shoulder([stood, by], 0.02);
  assert.deepEqual(stood.vel, [0, 0, 0], 'a settled body is not moved');
  assert.ok(by.vel[0] > 0, 'but it still shoulders the one beside it');
  const over = grounded([0, 0, 0]), under = grounded([0, 0.6, 0]);
  shoulder([over, under], 0.02);
  assert.deepEqual([over.vel, under.vel], [[0, 0, 0], [0, 0, 0]], 'one over the other (0.4 + 0.08 apart in height) is not a neighbour');
});

test('PI1 the rarity dress: a Magic-or-better item wears its tier\'s rim, stronger up the ladder; a Common one and the rarity row off wear none', () => {
  const at = (rarity) => ({ ...sword(), rarity });
  assert.equal(rarityRim(sword()), null);
  for (const tier of ['magic', 'rare', 'legendary']) assert.deepEqual(rarityRim(at(tier)), [...tierColour(tier), PI_RIM[tier]]);
  assert.deepEqual({ ...PI_RIM }, { magic: 0.3, rare: 0.45, legendary: 0.6, aetheric: 0.7, artifact: 0.7 });
  setPref('lootRarity', false);
  try { assert.equal(rarityRim(at('rare')), null); } finally { setPref('lootRarity', true); }
});

/** A renderer that records what it is asked. */
function fakeRenderer() {
  const made = [], gone = [], up = [];
  return { made, gone, up, uploadTexture: (a, r, img) => { up.push([a, r, img.width, img.height]); return {}; }, createBillboardBatch: (a, r, size) => { const b = { a, r, size }; made.push(b); return b; }, destroyBillboardBatch: (b) => gone.push(b), releaseTexture: () => {} };
}
const picture = { key: 'k', width: 4, height: 4, colors: new Uint8ClampedArray(64).map((_, i) => (i % 4 === 3 ? (i >= 32 ? 255 : 0) : 9)) };
const flatFloor = { raycast: (o, d) => (d[1] < 0 && o[1] >= 0 ? o[1] : Infinity) };
const settle = async (step, n = 400) => { step(0.016); await new Promise((r) => setTimeout(r, 5)); for (let i = 0; i < n; i++) step(0.02); };

test('PI1 the bodies: a fresh death throws each shown item out of the body (OnEnemyDeath -> HandleEnemyDeath), a body met later lays them by it, a category off stays in, and the window\'s take retires the proxy', async () => {
  const renderer = fakeRenderer();
  const s = readPhysicalItemsSettings(shippedRead({ 'Enemy Categories.Gold': false }));
  const layer = createPhysicalItems({ renderer, enabled: () => true, settings: () => s, iconOf: async () => picture, mw: { stamp: () => null, picture: async () => null } });
  const fresh = { items: [sword(), goldStack(4)] }, old = { items: [createWeapon(113, 0, () => 0.5)] };
  raiseEnemyDeath(fresh);
  assert.equal(diedRecently(fresh), true, 'the death handler is registered');
  layer.attach({ collider: () => flatFloor, corpses: () => [{ entity: fresh, pos: [0, 0, 0], key: 'foeCorpse:1' }, { entity: old, pos: [10, 0, 0], key: 'foeCorpse:2' }] });
  layer.frame(0.016);
  const first = layer.state();
  assert.deepEqual(first.map((p) => p.item), [fresh.items[0], old.items[0]], 'the gold category is off - it stays in the body only');
  const v = (it) => first.find((p) => p.item === it).vel;
  assert.ok(Math.hypot(v(fresh.items[0])[0], v(fresh.items[0])[2]) > 1, 'thrown out at the fall');
  assert.ok(Math.abs(v(old.items[0])[1] - 0.08) < 1e-9, 'laid by a body met later - the nudge');
  assert.equal(isPresented(fresh.items[0]), false, 'not presented while its picture is on its way - the body\'s line still counts it');
  await settle((dt) => layer.frame(dt));
  assert.ok(isPresented(fresh.items[0]) && !isPresented(fresh.items[1]), 'presented once it stands in its picture; the gold left in the body never');
  for (const p of layer.state()) assert.ok(p.settled && Math.abs(p.pos[1]) < 1e-9, 'on the floor');
  assert.equal(layer.targets().length, 2);
  assert.ok(layer.targets().every((t) => t.key.startsWith(PI_KEY_PREFIX)));
  assert.equal(renderer.up[0][0], PI_ICON_ARCHIVE);
  assert.deepEqual(renderer.up[0].slice(2), [4, 2], 'the picture cut to its visible rows');
  fresh.items.shift();   // the body's window took it
  layer.frame(0.02);
  assert.equal(layer.state().length, 1);
  assert.equal(isPresented(sword()), false);
});

test('PI1 the press: TryPickup [IL_847c] takes the item out of the body into the pack through the one-item door, the room hears a body\'s take, and the press is the layer\'s', async () => {
  const layer = createPhysicalItems({ renderer: fakeRenderer(), enabled: () => true, settings: () => readPhysicalItemsSettings(shippedRead()), iconOf: async () => picture, mw: { stamp: () => null, picture: async () => null } });
  const body = { items: [sword(), goldStack(25)] };
  const heard = [];
  layer.attach({ collider: () => flatFloor, corpses: () => [{ entity: body, pos: [0, 0, 0], key: 'corpse:3' }], taken: (b) => heard.push(b.key), say: () => {} });
  await settle((dt) => layer.frame(dt), 50);
  const player = { items: [], goldPieces: 0, stats: { strength: 50 }, career: {} };
  const keys = layer.targets().map((t) => t.key);
  assert.deepEqual(layer.contents(keys[1]), [body.items[1]]);
  assert.equal(layer.pick(keys[0], player), true);
  assert.equal(layer.pick(keys[1], player), true);
  assert.deepEqual(body.items, [], 'out of the body');
  assert.equal(player.items.length, 1, 'the sword in the pack');
  assert.equal(player.goldPieces, 25, 'the gold into the purse');
  assert.deepEqual(heard, ['corpse:3', 'corpse:3']);
  assert.equal(layer.pick('droppedLoot:7', player), false, 'a pile\'s key is not the layer\'s');
  assert.equal(layer.state().length, 0);
});

test('PI1 the pool: a shift-drop is one pile an item laid on the spiral, presented as itself (no bag, no pile target), saved as one and restored where it lay; the mod off wears the bags again', async () => {
  let on = true;
  const renderer = fakeRenderer();
  const dl = createDroppedLoot({ renderer, getTexture: () => Promise.resolve({}), uploadRecordFrame: () => {}, physical: { enabled: () => on, settings: () => readPhysicalItemsSettings(shippedRead()), iconOf: async () => picture, mw: { stamp: () => null, picture: async () => null } } });
  dl.physical.attach({ collider: () => flatFloor });
  const piles = dl.dropPhysical([sword(), createRandomArmor(1, () => 0.3)], [0, 0, 0], [0, 0, 1]);
  assert.equal(piles.length, 2);
  assert.ok(piles.every((p) => p.physical === true && p.items.length === 1));
  assert.ok(Math.abs(piles[0].pos[2] - 1.1) < 1e-9 && Math.abs(piles[0].pos[1] - 0.025) < 1e-9, 'the first 1.1 m ahead, lifted 0.025');
  assert.ok(Math.hypot(piles[1].pos[0] - piles[0].pos[0], piles[1].pos[2] - piles[0].pos[2]) > 0.5, 'the second clear of the first');
  await settle((dt) => dl.tickFlats(dt), 60);
  assert.ok(dl.lootTargets().every((t) => t.key.startsWith(PI_KEY_PREFIX)), 'pressed as items, never as piles');
  assert.ok(dl.batches().every((b) => b.a === PI_ICON_ARCHIVE), 'their pictures, not their bags');
  assert.equal(dl.lootFinds().length, 2);
  assert.ok(dl.lootFinds().every((f) => f.own === true));
  const snap = dl.snapshotWorld((p) => ({ x: p[0], z: p[2] }));
  assert.ok(snap.every((s) => s.physical === true));
  assert.ok(Math.abs(snap[0].y) < 1e-9, 'saved where it came to rest');
  dl.restoreWorld(snap, (x, z) => [x, z]);
  assert.ok(dl._piles.every((p) => p.physical && p.settled));
  dl.tickFlats(0.02);
  assert.ok(dl.physical.state().every((p) => p.settled), 'restored lying, not dropped again');
  on = false;
  dl.tickFlats(0.02);
  assert.equal(dl.physical.state().length, 0);
  assert.ok(dl.lootTargets().every((t) => /^droppedLoot:\d+$/.test(t.key)), 'off: the piles are piles again');
  const sceneSnap = dl.snapshotScene();
  assert.ok(sceneSnap.every((s) => s.physical === true), 'the scene cache keeps them one too');
});

test('PI1 the lines: a presented item leaves its body\'s line and stands its own (LOOT11\'s pick)', async () => {
  const rare = { ...sword(), rarity: 'rare' };
  const body = { root: [0, 1, 0], items: [rare] };
  assert.equal(pickLootLines([body], [0, 1, 5]).length, 1, 'the body\'s line while the item is in it');
  const layer = createPhysicalItems({ renderer: fakeRenderer(), enabled: () => true, settings: () => readPhysicalItemsSettings(shippedRead()), iconOf: async () => picture, mw: { stamp: () => null, picture: async () => null } });
  layer.attach({ corpses: () => [{ entity: { items: body.items }, pos: [0, 0, 0] }] });
  layer.frame(0.016);
  assert.equal(pickLootLines([body], [0, 1, 5]).length, 1, 'the picture still on its way: the body\'s line stands for it');
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(isPresented(rare), true);
  assert.equal(pickLootLines([body], [0, 1, 5]).length, 0, 'the body no longer counts it');
  assert.equal(pickLootLines([{ root: [1, 1, 0], items: [rare], own: true }], [0, 1, 5]).length, 1, 'its own line');
  layer.clear();
});

test('PI1 the shift-drop law: the mod\'s Transportation refusal in its words, the pack\'s ground guards, the whole stack moved, a map read and not dropped', () => {
  assert.deepEqual(shiftDropRefusal({ group: 'Transportation', templateIndex: 0 }), { text: CANNOT_REMOVE_ITEM_TEXT });
  const pre = method('InventoryPatches::LocalItemLeftClickPrefix');
  assert.ok(pre.includes('ldc.i4.s       23') && pre.includes('"cannotRemoveItem"'), 'ItemGroups.Transportation');
  assert.ok(pre.includes('ldc.i4         304') && pre.includes('ldc.i4         303'), 'either Shift');
  const arrows = createWeapon(131, 0, () => 0.5);
  const items = [arrows];
  let laid = null;
  const r = shiftDrop(arrows, { items, entity: { items }, drop: (l) => { laid = l; } });
  assert.deepEqual(r.moved, [arrows]); assert.deepEqual(laid, [arrows]); assert.deepEqual(items, []);
  assert.equal(laid[0].stackCount, 11, 'the whole stack');
  const locked = { ...sword(), locked: true };
  assert.ok(shiftDrop(locked, { items: [locked], entity: {}, drop: () => assert.fail('a locked piece is not dropped') }).refusal);
  const floor = shiftDrop(sword(), { items: [], entity: {}, dropRefusal: () => 'Not on my floor.', drop: () => assert.fail() });
  assert.equal(floor.refusal.text, 'Not on my floor.');
  const maps = []; randomlyAddMap(1, maps, () => 0);
  assert.deepEqual(shiftDrop(maps[0], { items: maps, entity: { items: maps }, drop: () => assert.fail() }), { map: true });
});

test('PI1 the seams: ONE construction - the pool is the only maker of the layer - every host attaches its half and takes on the press, both packs shift-drop through the one law, and every corpse pool hands its bodies', () => {
  const src = (p) => read(`src/${p}`);
  const makers = [];
  const walk = (dir) => { for (const f of readdirSync(new URL(`../src/${dir}`, import.meta.url), { withFileTypes: true })) { const p = `${dir}/${f.name}`; if (f.isDirectory()) walk(p); else if (p.endsWith('.js') && /\bcreatePhysicalItems\(/.test(src(p))) makers.push(p); } };
  walk('.');
  assert.deepEqual(makers.map((p) => p.replace(/^\.\//, '')).sort(), ['scenes/droppedLoot.js', 'scenes/physicalItemsLayer.js']);
  for (const [host, pool] of [['scenes/world.js', 'droppedLoot'], ['scenes/exterior.js', 'droppedLoot'], ['scenes/worldModes.js', 'interiorDropped'], ['scenes/dungeonContext.js', 'droppedLoot']]) {
    const s = src(host);
    assert.ok(s.includes(`${pool}.physical.attach({`), `${host} attaches its half`);
    assert.ok(s.includes(`${pool}.physical.owns(`) && s.includes(`${pool}.physical.pick(`), `${host} takes on the press`);
    assert.ok(s.includes(`${pool}.dropPhysical(`) && s.includes('physicalDropOn:'), `${host} hands the pack its shift-drop`);
  }
  for (const w of ['ui/nativeInventory.js', 'ui/enhancedInventory.js']) assert.ok(/shiftDrop\(/.test(src(w)) && /physicalDropOn\?\.\(\)/.test(src(w)), w);
  assert.match(src('scenes/exteriorFoes.js'), /physicalCorpses: \(\) => physicalCorpseSources\(foes, 'foeCorpse', corpseLens\)/);
  assert.match(src('scenes/cityGuards.js'), /physicalCorpses: \(\) => physicalCorpseSources\(guards, 'guardCorpse', corpseLens\)/);
  const lens = { isCorpse: (e) => !!e.corpse, feetOf: (e) => e.corpseMarker?.pos ?? null, idOf: (e) => e.uid };
  assert.deepEqual(physicalCorpseSources([{ corpse: true, uid: 4, entity: 'a', corpseMarker: { pos: [1, 2, 3] } }, { corpse: true, uid: 5, puppet: 'p', entity: 'b', corpseMarker: { pos: [0, 0, 0] } }, { corpse: true, uid: 6, entity: 'c' }, { corpse: true, uid: 7, corpseDisabled: true, entity: 'd', corpseMarker: { pos: [0, 0, 0] } }], 'foeCorpse', lens),
    [{ entity: 'a', pos: [1, 2, 3], key: 'foeCorpse:4' }], 'a landed, searchable, own body only');
  markDeath(null);   // tolerated
});
