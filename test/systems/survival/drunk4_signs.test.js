// DRUNK4 (2026-10-17, asked for: "Perhaps seeing the tavern sign appear outside random buildings to give the impression
// your character can't discern reality anymore") - THE DRINK, MISTAKEN (src/systems/survival/drunkSigns.js, the law;
// src/scenes/drunkSignsHost.js, the sign; worldModes' exteriorHoverName, the plaque). While the player is Very drunk a few
// of the town's non-tavern buildings read as taverns. Pinned here: how many by the share; nothing below Very drunk; a
// real tavern (or a palace, a wall) never picked; the same pick every frame of a binge and a new one the next; the name
// is generateBuildingName's own tavern draw off the real building's seed; the plaque through the real mode machine, off
// a building the real producers mint (locationBuildings, buildingDataForDoor), with nothing discovered, stored or
// changed; the sign's picture and place; and the host's batches made and freed with the pick.
import '../../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tinyRmb } from '../../wd3Fakes.mjs';
import {
  PHANTOM, phantomCount, phantomEligible, phantomOrder, phantomName, createDrunkSigns, drunkSigns, phantomNameFor, phantomDoorText,
} from '../../../src/systems/survival/drunkSigns.js';
import { drunkFeel } from '../../../src/systems/survival/drunkFeel.js';
import { tavernDrink } from '../../../src/systems/survival/tavernMenu.js';
import { survivalOf } from '../../../src/systems/survival/needs.js';
import { locationBuildings, buildingDataForDoor } from '../../../src/systems/talk/talkTopics.js';
import { BUILDING_TYPES as BT, generateBuildingName, tavernsB } from '../../../src/world/buildingNames.js';
import { getDiscoveredBuilding } from '../../../src/systems/discovery.js';
import { setModSetting } from '../../../src/systems/modSettings.js';
import { _resetForTests } from '../../../src/systems/uiPrefs.js';
import { Collider } from '../../../src/player/collider.js';
import { PlayerMotor } from '../../../src/player/motor.js';
import { doorCornersOf, hallBannerAnchors, BANNER_TOP_M, BANNER_SIDE_GAP_M, BANNER_OUT_M } from '../../../src/scenes/hallBanners.js';
import { BANNER_W_M } from '../../../src/render/bannerPass.js';
import { statusGlyphColor32 } from '../../../src/ui/hud/hudStatus.js';
import { SIGN, signImage, signPlace, createDrunkSignsHost } from '../../../src/scenes/drunkSignsHost.js';

_resetForTests();   // modsOff.js put Climates & Calories off with the mods; the drink is its part, so its default is back on

const rd = (f) => readFileSync(new URL(`../../../${f}`, import.meta.url), 'utf8');

// ── the town, from the producers ─────────────────────────────────────────────────────────────────────────────────────
/** Five blocks of two buildings each, typed as listed - the real RMB fixture (tinyRmb) through the real directory walk. */
const TOWN_TYPES = Object.freeze([[BT.Tavern, BT.Bank], [BT.House3, BT.GeneralStore], [BT.Temple, BT.Palace], [BT.Tavern, BT.WeaponSmith], [BT.House1, BT.Town23]]);
const TOWN = 5150;
function makeTown(types = TOWN_TYPES) {
  const blocks = types.map((pair, i) => {
    const dfBlock = tinyRmb(7 + i, `TOWN${i}.RMB`);
    dfBlock.rmbBlock.fldHeader.buildingDataList = dfBlock.rmbBlock.fldHeader.buildingDataList.map((d, j) => ({ ...d, buildingType: pair[j], nameSeed: 1000 + i * 17 + j * 5 }));
    return { x: i, y: 1, originX: i * 64, originZ: 0, dfBlock };
  });
  return { blocks, list: locationBuildings([], blocks), taverns: new Set() };
}
const town = makeTown();
town.list.forEach((b) => { if (b.buildingType === BT.Tavern) town.taverns.add(b.buildingKey); });
const ELIGIBLE = town.list.filter((b) => PHANTOM.types.includes(b.buildingType)).map((b) => b.buildingKey);

/** A drinker at the bar, the record the tavern's own pour writes (as drunk1_feel's); `drunk` set straight for a chosen share. */
const STATS = Object.freeze({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
function drinker(drunk = 0) {
  const p = { isPlayer: true, health: 40, maxHealth: 40, fatigue: 100, magicka: 10, maxMagicka: 20, stats: { ...STATS }, activeEffects: [], items: [] };
  tavernDrink(survivalOf(p, 0), 25, { endurance: 50 });
  p.survival.drunk = drunk;
  return p;
}
/** A runtime on a drink the test sets: { band, share }. */
function runtimeAt(drink = { band: 'veryDrunk', share: 1 }, buildings = town.list, id = TOWN) {
  const drinkNow = { ...drink };
  const signs = createDrunkSigns({ state: () => drinkNow });
  signs.provide({ town: () => id, buildings: () => buildings });
  return { signs, drink: (d) => Object.assign(drinkNow, d) };
}

afterEach(() => {
  drunkSigns.reset();
  drunkFeel.frame(1 / 60, { entity: drinker(0) });
});

// ── THE LAW ──────────────────────────────────────────────────────────────────────────────────────────────────────────
test('DRUNK4: how many a town shows - one at the line, up to three at the endurance, by the share (PHANTOM.count)', () => {
  assert.deepEqual(PHANTOM.count, { base: 1, perShare: 2, max: 3 });
  assert.deepEqual([0, 0.2, 0.25, 0.5, 0.74, 0.75, 1].map(phantomCount), [1, 1, 2, 2, 2, 3, 3]);
  assert.deepEqual([-1, NaN, undefined, 7].map(phantomCount), [1, 1, 1, 3], 'a share outside 0..1 is clamped; none is the line');
  assert.ok(Object.isFrozen(PHANTOM) && Object.isFrozen(PHANTOM.count) && Object.isFrozen(PHANTOM.types), 'a frozen table');
  // through the runtime: the share of the drink asks the count, the peak of it held within the binge
  const { signs, drink } = runtimeAt({ band: 'veryDrunk', share: 0.6 });
  assert.equal(signs.current().keys.length, 2, 'share 0.6: 1 + round(1.2)');
  drink({ share: 1 });
  assert.equal(signs.current().keys.length, 3, 'share 1: three');
  drink({ share: 0.6 });
  assert.equal(signs.current().keys.length, 3, 'a sip of water does not take a sign back');
});

test('DRUNK4: nothing below Very drunk - sober or merely Drunk shows no phantom and names none', () => {
  for (const band of ['sober', 'drunk']) {
    const { signs } = runtimeAt({ band, share: band === 'sober' ? 0 : 0.9 });
    assert.deepEqual([...signs.current().keys], [], band);
    for (const b of town.list) assert.equal(signs.nameFor(TOWN, b.buildingKey, { type: b.buildingType, seed: b.nameSeed }), null, `${band}: ${b.buildingKey}`);
  }
  // no host said where the player is: nothing either
  const lost = createDrunkSigns({ state: () => ({ band: 'veryDrunk', share: 1 }) });
  assert.deepEqual([...lost.current().keys], []);
  // and the town is not built yet (no buildings): asked again, nothing cached
  let built = [];
  const early = createDrunkSigns({ state: () => ({ band: 'veryDrunk', share: 1 }) });
  early.provide({ town: () => TOWN, buildings: () => built });
  assert.deepEqual([...early.current().keys], []);
  built = town.list;
  assert.equal(early.current().keys.length, 3, 'built a frame later: picked then');
});

test('DRUNK4: real taverns are never picked - nor a palace, a city wall or anything the table leaves out; every other building is in the order', () => {
  assert.equal(town.taverns.size, 2, 'the fixture holds two real taverns');
  assert.equal(PHANTOM.types.includes(BT.Tavern), false);
  for (const t of [BT.Palace, BT.Town23, BT.Town4, BT.Ship, BT.HouseForSale, BT.None, BT.Special1]) assert.equal(PHANTOM.types.includes(t), false, `type ${t}`);
  for (let binge = 1; binge <= 40; binge++) {
    const order = phantomOrder(TOWN, binge, town.list);
    assert.deepEqual([...order].sort((a, b) => a - b), [...ELIGIBLE].sort((a, b) => a - b), `binge ${binge}: exactly the eligible buildings, each once`);
    for (const k of order) assert.equal(town.taverns.has(k), false, `binge ${binge}: ${k} is a real tavern`);
  }
  // and through the runtime, every binge, at the most it shows
  const { signs, drink } = runtimeAt();
  for (let i = 0; i < 12; i++) {
    for (const k of signs.current().keys) assert.equal(town.taverns.has(k), false);
    drink({ band: 'drunk' }); signs.current(); drink({ band: 'veryDrunk' });
  }
  signs.current();
  assert.equal(signs.binge, 13, 'twelve crossings out and back in, and the first in');
  // a door a player does not see is not picked
  assert.equal(phantomEligible({ buildingKey: 1, buildingType: BT.Bank, hasDoor: false }), false);
  assert.equal(phantomEligible({ buildingKey: 1, buildingType: BT.Bank }), true);
  assert.equal(phantomEligible({ buildingKey: 1, buildingType: BT.Tavern }), false);
  assert.equal(phantomEligible(null), false);
  assert.deepEqual(phantomOrder(TOWN, 1, town.list.map((b) => ({ ...b, hasDoor: false }))), [], 'no doors, no phantoms');
});

test('DRUNK4: the same pick every frame of a binge, a fresh one after sobering, and the town\'s own', () => {
  const { signs, drink } = runtimeAt();
  const first = [...signs.current().keys];
  assert.equal(first.length, 3);
  for (let frame = 0; frame < 30; frame++) assert.deepEqual([...signs.current().keys], first, 'stable while the band holds');
  drink({ share: 0.7 });
  assert.deepEqual([...signs.current().keys], first, 'a different share inside the band does not reroll');
  assert.equal(signs.binge, 1);
  assert.ok(signs.held > 0, 'the binge holds its picks');
  drink({ band: 'drunk', share: 0.5 });
  assert.deepEqual([...signs.current().keys], [], 'dropped under the band: everything let go');
  assert.equal(signs.held, 0, 'no pick and no name kept');
  drink({ band: 'veryDrunk', share: 1 });
  const second = [...signs.current().keys];
  assert.equal(signs.binge, 2, 'the crossing back in is the next binge');
  assert.deepEqual(second, [...phantomOrder(TOWN, 2, town.list)].slice(0, 3), 'the order is the law\'s, for the binge\'s number');
  assert.notDeepEqual(phantomOrder(TOWN, 2, town.list), phantomOrder(TOWN, 1, town.list), 'and not the first binge\'s');
  // the law itself, pinned: the seeded order of this town's six candidates (building keys) for its first three binges
  assert.deepEqual(phantomOrder(TOWN, 1, town.list), [262400, 257, 196865, 65792, 65793, 131328]);
  assert.deepEqual(phantomOrder(TOWN, 2, town.list), [262400, 196865, 65793, 257, 131328, 65792]);
  assert.deepEqual(phantomOrder(TOWN, 3, town.list), [262400, 131328, 196865, 257, 65793, 65792]);
  // pure in (town, binge, buildings), and keyed by each
  assert.deepEqual(phantomOrder(TOWN, 3, town.list), phantomOrder(TOWN, 3, [...town.list].reverse()), 'the same order whatever order the host lists them in');
  assert.notDeepEqual(phantomOrder(TOWN, 1, town.list), phantomOrder(TOWN + 1, 1, town.list), 'another town, another order');
  assert.ok([1, 2, 3, 4, 5, 6].some((b) => phantomOrder(TOWN, b, town.list)[0] !== phantomOrder(TOWN, 1, town.list)[0]), 'the first pick moves between binges');
  // another town: the player walked into it, and it is picked from its own buildings
  const other = makeTown([[BT.Tavern, BT.Bank], [BT.House2, BT.Library]]);
  let at = TOWN, there = town.list;
  const walker = createDrunkSigns({ state: () => ({ band: 'veryDrunk', share: 1 }) });
  walker.provide({ town: () => at, buildings: () => there });
  assert.equal(walker.current().town, TOWN);
  at = 77; there = other.list;
  const away = walker.current();
  assert.equal(away.town, 77);
  assert.ok(away.keys.length >= 1 && away.keys.every((k) => other.list.some((b) => b.buildingKey === k && b.buildingType !== BT.Tavern)));
});

test('DRUNK4: the phantom\'s name is generateBuildingName\'s tavern draw off the real building\'s name seed', () => {
  const { signs } = runtimeAt();
  const picked = signs.current().keys;
  assert.ok(picked.length > 0);
  for (const k of picked) {
    const real = town.list.find((b) => b.buildingKey === k);
    const shown = signs.nameFor(TOWN, k, { type: real.buildingType, seed: real.nameSeed });
    assert.equal(shown, generateBuildingName(real.nameSeed, BT.Tavern), `${k}: the tavern draw for its own seed`);
    assert.equal(shown, phantomName(real.nameSeed));
    assert.ok(tavernsB().some((b) => shown.endsWith(` ${b}`)), `"${shown}" reads as one of the tavern names`);
    assert.equal(signs.nameFor(TOWN, k, { type: real.buildingType, seed: real.nameSeed }), shown, 'and the same every time it is asked');
  }
  // the seed is the building's: different seeds draw different taverns (a seed ignored would name them all alike)
  assert.ok(new Set([101, 202, 303, 404, 505, 606].map(phantomName)).size > 3);
  // not for a building that is not picked, a real tavern, a type the table leaves out, or another town's
  const notPicked = ELIGIBLE.find((k) => !picked.includes(k));
  const np = town.list.find((b) => b.buildingKey === notPicked);
  assert.equal(signs.nameFor(TOWN, notPicked, { type: np.buildingType, seed: np.nameSeed }), null);
  const tavern = town.list.find((b) => b.buildingType === BT.Tavern);
  assert.equal(signs.nameFor(TOWN, tavern.buildingKey, { type: tavern.buildingType, seed: tavern.nameSeed }), null);
  assert.equal(signs.nameFor(TOWN, picked[0], { type: BT.Tavern, seed: 1 }), null, 'a record that says tavern is no phantom');
  assert.equal(signs.nameFor(TOWN + 1, picked[0], { seed: 1 }), null, 'another town\'s door');
  // a host that hands no seed still gets a stable name
  const bare = signs.nameFor(TOWN, picked[0]);
  assert.equal(typeof bare, 'string');
  assert.equal(signs.nameFor(TOWN, picked[0]), bare);
});

// ── THE PLAQUE: through the real mode machine, off buildings the producers mint ─────────────────────────────────────────
const noop = () => {};
async function quietly(fn) {
  const saved = [console.warn, console.error, console.log];
  console.warn = console.error = console.log = () => {};
  try { return await fn(); } finally { [console.warn, console.error, console.log] = saved; }
}
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
/** A door of the street for every building of the town: the real block and record, the door record the walk hands. */
function doorsOf(t) {
  const entries = [];
  t.blocks.forEach((blk) => {
    for (let r = 0; r < 2; r++) {
      const buildingKey = t.list.find((b) => b.recordIndex === r && locationBuildingsBlock(t, b) === blk)?.buildingKey;
      entries.push({ door: { matrix: I, centre: { x: 0, y: 1.2, z: -3 }, normal: { x: 0, y: 0, z: 1 }, size: { x: 0.2, y: 2.4, z: 1.4 }, doorType: 0, buildingKey }, dfBlock: blk.dfBlock, recordIndex: r, pixelKey: 0, climateBase: 300, season: 0, dfLocation: null, group: 'g' });
    }
  });
  return entries;
}
/** The block a listed building came from (locationBuildings lists block by block, record by record). */
const locationBuildingsBlock = (t, b) => t.blocks[t.list.indexOf(b) >> 1];

async function buildModes(t, entries) {
  const deep = () => new Proxy(function () {}, {
    get: (_t, k) => (k === 'then' ? undefined : k === Symbol.toPrimitive ? () => 0 : deep()),
    apply: () => deep(),
    construct: () => deep(),
  });
  globalThis.addEventListener ??= noop;
  globalThis.removeEventListener ??= noop;
  globalThis.fetch = async () => { throw new Error('no ARENA2 in this test'); };
  const { createWorldModes } = await import('../../../src/scenes/worldModes.js');
  globalThis.window = globalThis;
  const canvas = { width: 640, height: 400, clientWidth: 640, clientHeight: 400, getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 400 }) };
  const street = new Collider(() => 0);
  const player = new PlayerMotor(street);
  const cam = { yaw: 0, pitch: 0, pos: [0, 1.6, 0] };
  return quietly(() => createWorldModes({
    canvas, renderer: deep(), player, cam, keys: new Set(), latch: { edge: deep() },
    blocks: null, pipeline: deep(), townTalk: { say: noop },
    doorTargets: () => entries, baseCollider: () => street,
    buildingTargets: () => [],
    // the host's own seam (world.js buildingDataForDoor): the real merge, the town's id, the directory's name
    buildingDataForDoor: (e) => {
      const d = buildingDataForDoor([], t.blocks, { dfBlock: e.dfBlock, recordIndex: e.recordIndex, position: [0, 0, 0] });
      return d && { ...d, townMapId: TOWN, regionIndex: 17, name: generateBuildingName(d.nameSeed, d.buildingType) };
    },
    discoveryLocationId: () => 'drunk4town',
  }));
}

test('DRUNK4: the plaque through the real exteriorHoverName - a phantom reads as a tavern, everything else is the door\'s own, nothing is discovered or stored', async () => {
  setModSetting('world-tooltips', 'Enabled', true);
  const entries = doorsOf(town);
  assert.equal(entries.length, 10);
  assert.deepEqual(entries.map((e) => e.door.buildingKey), town.list.map((b) => b.buildingKey), 'a door for every listed building, in its order');
  const modes = await buildModes(town, entries);
  drunkSigns.provide({ town: () => TOWN, buildings: () => town.list });
  const plaque = (i) => modes.exteriorHoverName(i, { eye: [0, 1.6, 0], dir: [0, 0, -1] });
  const sober = entries.map((_, i) => plaque(i));
  // the host names a shop, a tavern, a bank; a nameless house, a wall, or a temple the host has no faction name for has no plaque at all
  town.list.forEach((b, i) => {
    if (sober[i] === null) assert.ok(b.buildingType === BT.Temple || b.buildingType === BT.Town23 || (b.buildingType >= BT.House1 && b.buildingType <= BT.House6), `type ${b.buildingType} has a plaque sober`);
    else assert.equal(typeof sober[i].title, 'string');
  });
  assert.ok(sober.filter((p) => p === null).length >= 3, 'the fixture holds doors with no plaque');
  assert.ok(sober.some((p, i) => town.list[i].buildingType === BT.Bank && /\nThe Bank of/.test(p.title)), 'a bank reads as a bank');

  // very drunk, by a record the tavern\'s pour writes: the law picks, the plaque follows
  drunkFeel.frame(1 / 60, { entity: drinker(49) });
  assert.equal(drunkFeel.state().band, 'veryDrunk');
  const keys = [...drunkSigns.current().keys];
  assert.ok(keys.length >= 2 && keys.length <= 3);
  const drunk = entries.map((_, i) => plaque(i));
  town.list.forEach((b, i) => {
    if (!keys.includes(b.buildingKey)) { assert.deepEqual(drunk[i], sober[i], `building ${i}: not picked, the plaque as it was`); return; }
    const name = generateBuildingName(b.nameSeed, BT.Tavern);
    assert.equal(drunk[i].title, `To\n${name}`, `building ${i} (type ${b.buildingType}): the tavern\'s name behind the door\'s own "To"`);
    if (sober[i]) assert.deepEqual({ ...drunk[i], title: null }, { ...sober[i], title: null }, 'and the rest of the plaque - lines, verbs - is the door\'s');
    else assert.deepEqual(drunk[i], { title: `To\n${name}`, subs: [] }, 'a door with no plaque has the one a tavern\'s has');
    assert.equal(phantomNameFor(TOWN, b.buildingKey, { type: b.buildingType, seed: b.nameSeed }), name);
    // presentation only: the discovery store still holds the REAL building, and the real plaque comes back with the sobriety
    const db = getDiscoveredBuilding('drunk4town', b.buildingKey);
    assert.ok(db && db.buildingType === b.buildingType && db.buildingType !== BT.Tavern, 'discovered as what it is');
    assert.notEqual(db.displayName, name);
  });
  for (const k of town.taverns) {
    const i = town.list.findIndex((b) => b.buildingKey === k);
    assert.deepEqual(drunk[i], sober[i], 'a real tavern reads as itself');
  }
  assert.strictEqual(plaque(town.list.findIndex((b) => b.buildingKey === keys[0])), plaque(town.list.findIndex((b) => b.buildingKey === keys[0])), 'the same plaque object while it is read again');

  // sober again: the cache holds the real words, untouched by the phantom\'s
  drunkFeel.frame(1 / 60, { entity: drinker(0) });
  entries.forEach((_, i) => assert.deepEqual(plaque(i), sober[i], `building ${i} back to itself`));
  // and merely Drunk shows nothing
  drunkFeel.frame(1 / 60, { entity: drinker(30) });
  assert.equal(drunkFeel.state().band, 'drunk');
  entries.forEach((_, i) => assert.deepEqual(plaque(i), sober[i], `building ${i} Drunk: no phantom`));
});

test('DRUNK4: phantomDoorText leaves a plaque it cannot place as it came - no text, no title, no building, no pick', () => {
  const { signs } = runtimeAt();
  const k = signs.current().keys[0];
  const real = town.list.find((b) => b.buildingKey === k);
  const text = { title: 'To\nThe Shop', subs: ['Lock Level: 5'], actions: ['Go in'] };
  assert.strictEqual(phantomDoorText(null, null, TOWN, signs), null, 'no plaque and no building');
  assert.deepEqual(phantomDoorText(null, real, TOWN, signs), { title: `To\n${phantomName(real.nameSeed)}`, subs: [] }, 'no plaque, a phantom: the one a tavern\'s door has');
  assert.strictEqual(phantomDoorText(null, town.list.find((b) => b.buildingType === BT.Tavern), TOWN, signs), null, 'no plaque, a real tavern: none');
  assert.strictEqual(phantomDoorText({ subs: [] }, real, TOWN, signs).title, undefined);
  assert.strictEqual(phantomDoorText(text, null, TOWN, signs), text);
  const tav = town.list.find((b) => b.buildingType === BT.Tavern);
  assert.strictEqual(phantomDoorText(text, tav, TOWN, signs), text, 'a real tavern');
  const out = phantomDoorText(text, real, TOWN, signs);
  assert.deepEqual(out, { title: `To\n${phantomName(real.nameSeed)}`, subs: text.subs, actions: text.actions });
  assert.equal(text.title, 'To\nThe Shop', 'the host\'s cached object is never written');
  assert.strictEqual(phantomDoorText(text, real, TOWN, signs), out, 'one object per plaque and name');
  assert.equal(phantomDoorText({ title: 'Your home' }, real, TOWN, signs).title, phantomName(real.nameSeed), 'a title with no "To" line is the name alone');
});

test('DRUNK4: the hosts - the plaque is the one exteriorHoverName both outer hosts call; the sign is world.js\'s; the bench provides its town', () => {
  const wm = rd('src/scenes/worldModes.js'), w = rd('src/scenes/world.js'), x = rd('src/scenes/exterior.js');
  assert.ok(wm.includes('exteriorHoverName: (key, o) => drunkPlaque(exteriorHoverName(key, o), key),'), 'the export wraps the namer: after the door cache, never inside it');
  assert.ok(wm.includes("const drunkPlaque = (t, key) => phantomDoorText(t, typeof key === 'number' && key === _doorTextKey && t === _doorText ? _doorBd : null, homeTownOf(_doorBd));"), 'only the door\'s own cached answer, with the record it names');
  assert.match(wm, /const bd = doorBuilding\(entry\); _doorBd = bd \?\? _doorBd;/);
  for (const [name, src] of [['world.js', w], ['exterior.js', x]]) {
    assert.ok(src.includes('modes.exteriorHoverName(key, { eye: cam.pos, dir: _hd, names: _hoverNamers, modNames: _hoverModNamers })'), `${name}: the plaque is the one seam's`);
  }
  assert.ok(x.includes('drunkSigns.provide({ town: () => dfLocation?.mapTableData?.mapId ?? 0'), 'exterior.js says its town and buildings');
  assert.ok(w.includes('drunkSignsHost = createDrunkSignsHost({'), 'world.js stands the sign host');
  assert.ok(w.includes('if (drunkSignsHost) livePersonBatches.push(...drunkSignsHost.batches());'), 'and draws its batches on the flats\' axis');
  assert.ok(w.includes('drunkSignsHost?.destroyAll();'), 'and takes it down at a load');
  assert.equal(x.includes('createDrunkSignsHost'), false, 'the bench hangs no sign (no door frames)');
});

// ── THE SIGN ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test('DRUNK4: the sign\'s picture - 32 by 24, opaque board and chains on clear, the HUD\'s tankard on it, rows from the bottom up', () => {
  const img = signImage();
  assert.equal(img.width, 32); assert.equal(img.height, 24);
  assert.deepEqual([SIGN.tex.w, SIGN.tex.h], [32, 24]);
  assert.equal(img.colors.length, 32 * 24 * 4);
  const px = (x, yTop) => { const o = ((23 - yTop) * 32 + x) * 4; return [...img.colors.slice(o, o + 4)]; };
  const alphas = new Set();
  let opaque = 0;
  for (let i = 3; i < img.colors.length; i += 4) { alphas.add(img.colors[i]); if (img.colors[i] === 255) opaque++; }
  assert.deepEqual([...alphas].sort((a, b) => a - b), [0, 255], 'cut out, never half');
  assert.equal(opaque, 32 * 21 - 4 + 2 * 3, 'the board (21 rows of 32, its four corners cut) and two chains of three');
  assert.equal(px(0, 3)[3], 0, 'the board\'s corner is cut'); assert.equal(px(31, 23)[3], 0);
  assert.equal(px(6, 0)[3], 255, 'a chain at the top of the picture (the last row stored)'); assert.equal(px(25, 2)[3], 255);
  assert.equal(px(7, 0)[3], 0, 'and clear beside it');
  assert.equal(px(15, 12)[3], 255, 'the board');
  // the tankard: every glyph pixel the HUD draws is on the board in its own colour, at the glyph\'s place, upright
  const glyph = statusGlyphColor32('drunk');
  const g = new Uint8Array(glyph.colors.buffer);
  let lit = 0;
  for (let gy = 0; gy < 16; gy++) for (let gx = 0; gx < 16; gx++) {
    const o = (gy * 16 + gx) * 4;
    if (!g[o + 3]) continue;
    lit++;
    assert.deepEqual(px(8 + gx, 5 + gy), [g[o], g[o + 1], g[o + 2], 255], `glyph (${gx}, ${gy})`);
  }
  assert.ok(lit > 100, 'the tankard is most of its grid');
  // dark wood: the board\'s plank is a brown, darker than the tankard\'s foam
  const plank = px(4, 8);
  assert.ok(plank[0] > plank[1] && plank[1] > plank[2] && plank[0] < 160, `plank ${plank}`);
  assert.deepEqual(signImage().colors, img.colors, 'pure: the same picture each time');
});

/** A building\'s frame as the pixel build measures it: the door record\'s corners through the model\'s matrix (doorCornersOf). */
function frameAt(box, doorRec = { vert0: { x: -0.6, y: 0, z: 0 }, vert2: { x: 0.6, y: 2.2, z: 0 } }, matrix = I) {
  return { at: [0, 0, 0], box, rects: [], type: BT.Bank, faction: 0, door: doorCornersOf(doorRec, matrix) };
}
test('DRUNK4: where the sign hangs - beside the door on the banner\'s anchor, 2.6 to 3 m up the wall, a hand off it, the side the key picks', () => {
  const frame = frameAt([-5, 0, -8, 5, 6, 0]);   // the door on the building\'s front (z = 0), the middle behind it
  const a = signPlace(frame, 2), b = signPlace(frame, 3);
  assert.ok(a && b);
  const anchors = hallBannerAnchors(frame);
  const side = 0.6 + BANNER_SIDE_GAP_M + BANNER_W_M / 2;   // the door\'s half width, the gap, the cloth\'s half
  assert.ok(Math.abs(Math.abs(a.base[0]) - side) < 1e-9 && Math.abs(Math.abs(b.base[0]) - side) < 1e-9, 'a banner\'s side off the door\'s middle');
  assert.ok(a.base[0] * b.base[0] < 0, 'the two keys hang on the two sides');
  assert.ok(Math.abs(a.base[0] - anchors[0].top[0]) < 1e-9 && Math.abs(b.base[0] - anchors[1].top[0]) < 1e-9, 'an even key the first anchor, an odd the second');
  assert.ok(Math.abs(a.base[2] - (BANNER_OUT_M + SIGN.extraOutM)) < 1e-9, 'off the wall, on the face away from the building');
  assert.ok(Math.abs(a.out[0]) < 1e-9 && Math.abs(a.out[1]) < 1e-9 && Math.abs(a.out[2] - 1) < 1e-9, 'out of the front wall');
  assert.ok(a.centre >= 2.6 && a.centre <= 3, `the sign\'s middle ${a.centre} m over the door\'s foot`);
  assert.ok(Math.abs(a.centre - 2.8) < 1e-9);
  assert.ok(Math.abs(a.base[1] + SIGN.h / 2 - a.centre) < 1e-9, 'the quad stands on its base and rises its height');
  // the foot is the door\'s own: a door on higher ground carries the sign up with it
  const high = signPlace(frameAt([-5, 10, -8, 5, 16, 0], { vert0: { x: -0.6, y: 10, z: 0 }, vert2: { x: 0.6, y: 12.2, z: 0 } }), 2);
  assert.ok(Math.abs(high.base[1] - (a.base[1] + 10)) < 1e-9);
  assert.ok(BANNER_TOP_M > a.centre, 'under the banners\' top: no taller than the cloth');
  // no door measured, a door narrower than a man: none
  assert.equal(signPlace({ box: [-5, 0, -8, 5, 6, 0], door: null }, 2), null);
  assert.equal(signPlace(frameAt([-5, 0, -8, 5, 6, 0], { vert0: { x: -0.1, y: 0, z: 0 }, vert2: { x: 0.1, y: 2, z: 0 } }), 2), null);
  assert.equal(signPlace(undefined, 2), null);
});

test('DRUNK4: the sign host - one batch a picked building, set by its pixel\'s translation, freed with the pick, the pixel and the picture', () => {
  const calls = { make: 0, kill: 0, up: 0, rel: 0, batches: [] };
  const renderer = {
    uploadTexture(a, r, c) { calls.up++; assert.equal(a, SIGN.archive); assert.equal(r, SIGN.record); assert.equal(c.width, 32); },
    createBillboardBatch(a, r, size, centers) { calls.make++; assert.equal(a, SIGN.archive); assert.deepEqual(size, { w: SIGN.w, h: SIGN.h }); assert.deepEqual(centers, [[0, 0, 0]]); const b = { archive: a, record: r, size, dead: false }; calls.batches.push(b); return b; },
    destroyBillboardBatch(b) { calls.kill++; b.dead = true; },
    releaseTexture(a, r) { calls.rel++; assert.deepEqual([a, r], [SIGN.archive, SIGN.record]); },
  };
  // the pixel the pixel build makes: every building\'s frame by its key, the real types - doors on all but one
  const mkPixel = (px = 4, py = 9) => {
    const homeFrames = new Map();
    town.list.forEach((b, i) => {
      const f = frameAt([-5 + i * 20, 0, -8, 5 + i * 20, 6, 0], i === 3 ? undefined : undefined);
      f.type = b.buildingType;
      if (b.buildingKey === town.list[3].buildingKey) f.door = null;   // one building the build measured no door for
      homeFrames.set(b.buildingKey, f);
    });
    return { px, py, homeTown: TOWN, homeFrames };
  };
  let pixel = mkPixel();
  const builtMap = new Map([['4,9', pixel]]);
  let shift = [100, 0, -50];
  const { signs, drink } = runtimeAt({ band: 'sober', share: 0 });
  const host = createDrunkSignsHost({ renderer, built: () => builtMap, translation: (px, py, out) => { assert.deepEqual([px, py], [4, 9]); out[0] = shift[0]; out[1] = shift[1]; out[2] = shift[2]; return out; }, pixelNow: () => pixel, signs });

  assert.deepEqual([...host.batches()], [], 'sober: none'); assert.equal(calls.make, 0);
  drink({ band: 'veryDrunk', share: 1 });
  const hung = [...host.batches()];
  const keys = [...signs.current().keys];
  const withDoor = keys.filter((k) => pixel.homeFrames.get(k).door);
  assert.equal(hung.length, withDoor.length);
  assert.ok(hung.length >= 2);
  assert.equal(calls.make, hung.length); assert.equal(calls.up, hung.length, 'the picture asked with each batch (the renderer\'s cache keeps one)');
  hung.forEach((b, i) => {
    const key = withDoor[i];
    const place = signPlace(pixel.homeFrames.get(key), key);
    assert.deepEqual(b.origin, [shift[0] + place.base[0], shift[1] + place.base[1], shift[2] + place.base[2]], 'at its building\'s door, in the scene now');
    assert.equal(b.noShadow, true);
    assert.equal(town.taverns.has(key), false, 'never a real tavern\'s');
  });
  // the same batches next frame; the floating origin moves them in place
  shift = [140, 3, -50];
  const again = [...host.batches()];
  assert.deepEqual(again, hung); assert.equal(calls.make, hung.length, 'nothing made again');
  assert.equal(again[0].origin[0], 140 + signPlace(pixel.homeFrames.get(withDoor[0]), withDoor[0]).base[0]);
  // its pixel built again: the old batch freed, a new one hung
  pixel = mkPixel(); builtMap.set('4,9', pixel);
  const rebuilt = [...host.batches()];
  assert.equal(rebuilt.length, hung.length); assert.equal(calls.kill, hung.length, 'the old pixel\'s batches freed'); assert.ok(hung.every((b) => b.dead));
  assert.equal(calls.make, hung.length * 2);
  // sober: all freed and the picture released
  const before = calls.kill;
  drink({ band: 'drunk', share: 0.5 });
  assert.deepEqual([...host.batches()], []);
  assert.equal(calls.kill - before, rebuilt.length); assert.equal(host.count, 0); assert.equal(calls.rel, 1, 'the picture goes with the last sign');
  assert.ok(calls.batches.every((b) => b.dead), 'no batch left alive');
  // the next binge hangs a fresh set, and the town unbuilt frees them as well
  drink({ band: 'veryDrunk', share: 1 });
  assert.ok(host.batches().length >= 2);
  builtMap.delete('4,9');
  assert.deepEqual([...host.batches()], []);
  assert.ok(calls.batches.every((b) => b.dead)); assert.equal(calls.rel, 2);
  // a load takes them down at once
  builtMap.set('4,9', pixel);
  assert.ok(host.batches().length >= 2);
  host.destroyAll();
  assert.equal(host.count, 0); assert.ok(calls.batches.every((b) => b.dead)); assert.equal(calls.rel, 3);
  // a pixel of another town hangs none (the player is in TOWN)
  builtMap.set('4,9', { ...pixel, homeTown: TOWN + 1 });
  assert.deepEqual([...host.batches()], []);
});

test('AUDIT DRUNK2: sign maintenance makes nothing a frame - an unchanged pick returns the same batches and places no sign again; a sober frame answers the one frozen empty', () => {
  const made = [];
  const renderer = {
    uploadTexture() {},
    createBillboardBatch(a, r, size) { const b = { size, dead: false }; made.push(b); return b; },
    destroyBillboardBatch(b) { b.dead = true; },
    releaseTexture() {},
  };
  const mkPixel = (px = 4, py = 9) => {
    const homeFrames = new Map();
    town.list.forEach((b, i) => { const f = frameAt([-5 + i * 20, 0, -8, 5 + i * 20, 6, 0]); f.type = b.buildingType; homeFrames.set(b.buildingKey, f); });
    return { px, py, homeTown: TOWN, homeFrames };
  };
  let pixel = mkPixel();
  const builtMap = new Map([['4,9', pixel]]);
  let placed = 0;
  const place = (f, k) => { placed++; return signPlace(f, k); };
  const { signs, drink } = runtimeAt({ band: 'sober', share: 0 });
  const host = createDrunkSignsHost({ renderer, built: () => builtMap, translation: (px, py, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; }, pixelNow: () => pixel, signs, place });

  // sober: the one frozen empty answer from the law and from the host, however often it is asked
  const quiet = signs.current();
  assert.strictEqual(signs.current(), quiet, 'the same object sober, every frame');
  assert.ok(Object.isFrozen(quiet) && Object.isFrozen(quiet.keys));
  assert.deepEqual({ ...quiet }, { town: null, keys: [] });
  const none = host.batches();
  assert.ok(Object.isFrozen(none));
  assert.strictEqual(host.batches(), none, 'the host answers one frozen empty array sober');
  const lost = createDrunkSigns({ state: () => ({ band: 'veryDrunk', share: 1 }) });
  assert.strictEqual(lost.current(), quiet, 'no host, no town and no buildings yet: the same empty answer too');
  assert.equal(placed, 0, 'nothing is placed sober');

  // very drunk: the first frame places each candidate once (the law asks which have a door) and hangs the picks
  drink({ band: 'veryDrunk', share: 1 });
  const first = [...host.batches()];
  assert.ok(first.length >= 2);
  const afterFirst = placed;
  assert.ok(afterFirst >= town.list.length, 'the law\'s one question a binge, and each hung sign placed');
  // thirty frames on, the pick and the pixel unchanged: the same batch objects, and no sign placed again
  for (let frame = 0; frame < 30; frame++) {
    const again = host.batches();
    assert.equal(again.length, first.length);
    again.forEach((b, i) => assert.strictEqual(b, first[i], `frame ${frame}: the sign\'s own batch`));
  }
  assert.equal(placed, afterFirst, 'a kept sign is not placed again');
  assert.equal(made.length, first.length, 'and nothing made again');
  assert.equal(host.count, first.length);

  // the pixel built again: the new object is placed, once, and the old one\'s batches freed
  pixel = mkPixel(); builtMap.set('4,9', pixel);
  const rebuilt = [...host.batches()];
  assert.equal(rebuilt.length, first.length);
  assert.equal(placed, afterFirst + first.length, 'each sign of the new pixel placed once');
  assert.ok(first.every((b) => b.dead) && rebuilt.every((b) => !b.dead));
  for (let frame = 0; frame < 10; frame++) host.batches();
  assert.equal(placed, afterFirst + first.length, 'and then kept');
  assert.equal(host.count, first.length, 'one batch a sign, the old ones gone');

  // sobered: all freed, the host quiet again and placing nothing
  drink({ band: 'drunk', share: 0.5 });
  assert.deepEqual([...host.batches()], []);
  assert.equal(host.count, 0);
  assert.ok(made.every((b) => b.dead));
  const settled = placed;
  assert.strictEqual(host.batches(), none, 'back to the frozen empty');
  assert.equal(placed, settled);
});

test('DRUNK4: the host says the player\'s town and its buildings to the law - the doors the build measured, the types it recorded', () => {
  let pixel = { px: 1, py: 1, homeTown: 9001, homeFrames: new Map([[11, { ...frameAt([-5, 0, -8, 5, 6, 0]), type: BT.GeneralStore }], [12, { ...frameAt([-5, 0, -8, 5, 6, 0]), type: BT.Tavern }], [13, { box: [0, 0, 0, 1, 1, 1], door: null, type: BT.Bank }]]) };
  const seen = createDrunkSigns({ state: () => ({ band: 'veryDrunk', share: 1 }) });
  createDrunkSignsHost({ renderer: {}, built: () => new Map(), translation: () => [0, 0, 0], pixelNow: () => pixel, signs: seen });
  const now = seen.current();
  assert.equal(now.town, 9001);
  assert.deepEqual([...now.keys], [11], 'the shop with a door; the tavern and the doorless bank are not');
  pixel = null;
  assert.equal(seen.current().town, null, 'the player is in no built town');
});
