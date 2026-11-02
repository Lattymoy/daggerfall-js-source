// FB1020c BAG-COOK (FIELD BUGS 2026-10-20c, the Discord: "raw fish cant be cooked over fires"). A netted Raw Fish goes
// into the Materials Bag first (BAG1: profBook.js mintHarvest -> world.js carryHands.give -> materialsBag.js giveCarried,
// the bag before the pack), and the fire's Cook food list (scenes/camps.js openCook) read the pack alone - so a bag's
// owner was told "You have nothing to cook." over a bag of fish. The list reads the pack, then the bag (as DFU's potion
// maker reads the wagon after the pack - DaggerfallPotionMakerWindow.cs Refresh), only while the pack holds a bag, and
// the cooked food goes into the pack: a cooked food is no material, and the bag holds materials alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../../src/systems/professions/profTemplates.js';
import { setItemFields } from '../../src/systems/item/itemTemplates.js';
import { BAG_TEMPLATE, isBagItem } from '../../src/net/bagLaw.js';
import { FISH_KEY } from '../../src/net/professionLaw.js';
import { giveCarried, materialKeyOfItem } from '../../src/systems/materialsBag.js';
import { createCamps } from '../../src/scenes/camps.js';
import { CAMP_TEXT, COOK_MINUTES, TENT_MODEL, cookFood } from '../../src/systems/survival/camp.js';
import { createSurvivalItem } from '../../src/systems/survival/items.js';
import { TEMPLATE, isFood, SURVIVAL_GROUP } from '../../src/systems/survival/food.js';
import { setWorldMinutes } from '../../src/systems/worldTick.js';
import { getPref } from '../../src/systems/uiPrefs.js';
import { survivalOn } from '../../src/systems/survival/switch.js';

const bagItem = () => setItemFields({ group: 'UselessItems2', templateIndex: BAG_TEMPLATE });
const settle = () => new Promise((r) => setTimeout(r, 0));
const flat = () => (o, d) => (d[1] < 0 ? o[1] : Infinity);
const fish = (list) => list.filter((it) => it.templateIndex === TEMPLATE.RawFish).reduce((n, it) => n + (it.stackCount ?? 1), 0);
const cooked = (list) => list.filter((it) => it.templateIndex === TEMPLATE.CookedFish).length;

/** The real pool on a fake renderer (surv3_camps.test.js's shape), the entity the player's. */
function camp(entity) {
  const said = [], overlays = [];
  const camps = createCamps({
    renderer: { createBillboardBatch: (a, r, size, centers) => ({ a, r, size, centers }), destroyBillboardBatch: () => {}, drawMesh: () => {} },
    getTexture: async () => ({ getFrameCount: () => 3, getSize: () => ({ width: 40, height: 40 }) }), uploadRecordFrame: () => {},
    meshes: { getGpuMesh: async () => ({ gpu: true }), cpuModels: new Map([[TENT_MODEL, { positions: [-1, 0, -1, 1, 2, 1] }]]) }, entity,
    camera: () => ({ feet: [0, 1, 0], yaw: 0 }), collider: () => ({ raycast: flat() }), place: () => ({}),
    pixelKeyAt: () => 'px:0', say: (l) => said.push(l), showOverlay: (w) => overlays.push(w), openRest: () => said.push('REST'),
    advanceMinutes: (n) => said.push(`+${n}`), selfId: () => null,
  });
  return { camps, said, overlays };
}
/** A lit Campfire of the player's own, placed from the pack, and its key. */
async function litFire(entity) {
  setWorldMinutes(5000);
  const h = camp(entity);
  const kit = createSurvivalItem(TEMPLATE.Campfire, { condition: 3 });
  entity.items.push(kit);
  assert.equal(h.camps.placeItem(kit, entity.items), true);
  await settle();
  assert.equal(h.said.at(-1), CAMP_TEXT.lit);
  return { ...h, key: h.camps.targets().find((t) => t.key.startsWith('camp:')).key };
}

test('BAG-COOK THE PRODUCER: a haul\'s Raw Fish is minted into the Materials Bag first - C&C\'s Raw Fish (535, UselessItems2), a food that cooks, the material `food:fish`; with no bag, into the pack (mutants: none - the shape the fire\'s list must take)', () => {
  assert.equal(survivalOn(), true, `the default tier cooks (${getPref('survival')})`);
  const e = { stats: { strength: 50 }, items: [bagItem()], bagItems: [] };
  const got = giveCarried(e, FISH_KEY, 2);   // world.js carryHands.give - the door profBook.js mintHarvest mints a haul through
  assert.deepEqual([got.bag, got.pack], [2, 0]);
  assert.deepEqual(e.bagItems.map((it) => [it.templateIndex, it.group, it.name]), [[TEMPLATE.RawFish, SURVIVAL_GROUP, 'Raw Fish'], [TEMPLATE.RawFish, SURVIVAL_GROUP, 'Raw Fish']]);
  assert.ok(e.bagItems.every((it) => isFood(it) && materialKeyOfItem(it) === FISH_KEY), 'a food, and the fish material');
  const none = { stats: { strength: 50 }, items: [], bagItems: [] };
  giveCarried(none, FISH_KEY, 1);
  assert.deepEqual([fish(none.items), none.bagItems.length], [1, 0], 'no bag: the pack');
});

test('BAG-COOK THE FIRE: Cook food lists the bag\'s Raw Fish after the pack\'s; a pick cooks one out of the bag and the Cooked Fish goes into the pack, never the bag; a bag sold (none in the pack) has its list unread (mutants: the bag unread; the bag read only without one; the cooked food into the bag)', async () => {
  const e = { stats: { strength: 50 }, items: [bagItem()], bagItems: [] };
  giveCarried(e, FISH_KEY, 2);
  e.items.push(createSurvivalItem(TEMPLATE.RawMeat));
  const h = await litFire(e);
  h.camps.activate(h.key, 'grab', 'cook');
  const list = h.overlays.at(-1);
  assert.deepEqual(list.items, ['Raw Meat', 'Raw Fish', 'Raw Fish'], 'the pack\'s first, then the bag\'s');
  list._pick(1);
  assert.equal(h.said.at(-2), CAMP_TEXT.cooked('Raw Fish'));
  assert.equal(h.said.at(-1), `+${COOK_MINUTES}`);
  assert.deepEqual([fish(e.bagItems), cooked(e.bagItems), cooked(e.items)], [1, 0, 1], 'one out of the bag, the cooked one in the pack');
  assert.ok(e.bagItems.every((it) => materialKeyOfItem(it) != null), 'the bag holds materials alone');
  // the bag sold - its list is nobody's (materialsBag.js listOf's law): the fire reads it no more
  e.items = e.items.filter((it) => !isBagItem(it) && it.templateIndex !== TEMPLATE.RawMeat);
  h.camps.activate(h.key, 'grab', 'cook');
  assert.equal(h.said.at(-1), CAMP_TEXT.nothingToCook);
  setWorldMinutes(0);
});

test('BAG-COOK THE LAW: cookFood takes the raw food off its own list and puts the cooked one where `into` says - its own list where none is named, as every caller before (mutants: `into` unread)', () => {
  const bag = [createSurvivalItem(TEMPLATE.RawFish)], pack = [];
  const r = cookFood(bag[0], bag, { into: pack });
  assert.deepEqual([bag.length, pack.map((it) => it.templateIndex)], [0, [TEMPLATE.CookedFish]]);
  assert.equal(r.minutes, COOK_MINUTES);
  const one = [createSurvivalItem(TEMPLATE.RawMeat)];
  cookFood(one[0], one);
  assert.deepEqual(one.map((it) => it.templateIndex), [TEMPLATE.Meat], 'no `into`: the same list');
});

test('BAG-COOK THE WORDS: the fire\'s page says where the gathered goods go and that a Raw Fish from the pack or the bag cooks over the flame (mutants: none - the words)', () => {
  const page = readFileSync(new URL('../../src/ui/professions/profPages.js', import.meta.url), 'utf8');
  assert.match(page, /All go into your Materials Bag, then your pack\. A Raw Fish from your pack or bag cooked over the flame is a plain meal and gives no Cooking experience\./);
  assert.doesNotMatch(page, /All go to your Stores\./);
});
