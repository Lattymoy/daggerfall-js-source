// ITEM-WALK (2026-10-07, Mac: "Do them now within this PR"): the two follow-ups AUDIT WEAPON-POOL recorded and left
// for their own pass, done in its pull request. A - the load's one-time item repairs (DISC21-A, WEAPON-POOL, DISC29-B,
// WB12a, RARITY-WEAR) run over every list a save holds, by one walk (systems/save.js savedItemLists) and one runner
// (repairItemLists). B - Project Legacy runs the same repairs on what leaves the line's record by no load: a bequest as
// it is paid, a fallen member's remains as they open (scenes/legacyHost.js). C - customs counts a sworn revenant's pack
// (net/realmGoldLaw.js stashedItemLists). bible/05-Combat/Physical-Combat-Overhaul.md, ITEM-WALK.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { WEAPONS, WEAPON_MATERIALS } from '../src/characters/weapons.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { goldStack, letterOfCredit } from '../src/systems/inventory.js';
import { liquidWealthOf, stashedItemLists, customsAllowance } from '../src/net/realmGoldLaw.js';
import { applyCustoms } from '../src/systems/realmCustoms.js';
import { firstSaveRefusal } from '../server-account/src/realm.js';
import { modSaveRecords, _resetModSaveData } from '../src/systems/modSaveData.js';
import { MODELS, LEGACY_VENDOR } from '../src/systems/legacy/family.js';
import { createLegacyHost } from '../src/scenes/legacyHost.js';
import { snapshotPlayer, restorePlayer, savedItemLists } from '../src/systems/save.js';
import { setItemFields, mintCondition } from '../src/systems/itemTemplates.js';
import { applyRarity } from '../src/systems/lootRarity.js';
import { seededRng } from '../src/systems/wind.js';
import { decorStandOf } from '../src/systems/decorItems.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};
const N = await import('../src/systems/revenant.js');
const RC = await import('../src/systems/revenantCompanions.js');
const S = await import('../src/systems/companionSlots.js');

const at = (v) => () => v;
const cond = (it) => [it.maxCondition, it.currentCondition];
/** An iron dagger as a build before WEAPON-POOL minted and wore it: its row's 50, half gone. */
const stale = (over = {}) => Object.assign(createWeapon(WEAPONS.Dagger, WEAPON_MATERIALS.Iron, at(0.5)), { maxCondition: 50, currentCondition: 25 }, over);

// ── C: customs and a sworn revenant's pack ───────────────────────────────────────────────────────────────────────────

const me = { isPlayer: true, name: 'Ayla Stormwind', characterId: 'char-walk', level: 8, health: 100, maxHealth: 100 };
function swornOne() {
  N._resetRevenantForTests(); RC._resetRetinueForTests(); S._resetCompanionSlotsForTests(); _store.clear();
  S.registerCompanionCount('revenant', () => RC.revenantsWithYou().length);
  RC.setRetinuePlayer(me);
  const mobileType = MOBILE_TYPES.Orc;
  const r = N.revenantDeed(me, { mobileType, level: 6, champion: 'mighty', health: 5, maxHealth: 50, team: 'Orcs' }, 'fled', { mobileType, rolls: at(0) });
  return N.revenantSpared(me, { revenant: { id: r.id } }, { state: 'with' });
}
const feudSave = () => ({ level: 1, goldPieces: 0, items: [], wagonItems: [], bankAccounts: [], houses: [], modData: { [N.REVENANT_SAVE]: JSON.parse(JSON.stringify(modSaveRecords()[N.REVENANT_SAVE])) } });

test('ITEM-WALK C: customs and the account service\'s first save count a sworn revenant\'s pack - the storage the player fills as the crew\'s (revenantCompanions.js packOf), saved in the feud\'s record: a million gold in it crossed whole while the same million in a crew hand\'s pack was capped; now capped alike, taken from as the crew\'s is; a pack the load keeps for no one (not sworn, or defeated) counts nothing (mutants: the pack unread; the oath or the defeat unasked; the key misnamed)', () => {
  const r = swornOne();
  RC.revenantParty().packOf(r.id).push(goldStack(1_000_000), letterOfCredit(50_000));
  const snap = feudSave();
  const pack = snap.modData[N.REVENANT_SAVE].list[0].companion.items;
  assert.ok(stashedItemLists(snap).includes(pack), 'its pack is a stash customs reads');
  assert.equal(liquidWealthOf(snap), 1_050_000);
  const out = applyCustoms(snap);
  assert.deepEqual([out.wealth, out.taken, liquidWealthOf(snap)], [1_050_000, 1_050_000 - customsAllowance(1), customsAllowance(1)], 'capped at the allowance');
  // the service's first save: a customs character's - and what customs let through passes
  const row = { origin_id: 'offline-1', summary: JSON.stringify({ level: 1 }) };
  assert.deepEqual(firstSaveRefusal(JSON.stringify(feudSave()), row), { error: 'customs-allowance' });
  assert.equal(firstSaveRefusal(JSON.stringify(snap), row), null);
  // a record the load keeps no pack for (revenant.js sanitize: sworn and not defeated) counts nothing, whatever it holds
  const rec = JSON.parse(JSON.stringify(modSaveRecords()[N.REVENANT_SAVE])).list[0];
  for (const off of [{ sworn: false }, { defeated: true }]) {
    assert.equal(liquidWealthOf({ modData: { [N.REVENANT_SAVE]: { list: [{ ...rec, ...off }] } } }), 0, JSON.stringify(off));
  }
  // and a record that is no list measures as none
  for (const list of [5, {}, 'x', null, [null, 7, { sworn: true, companion: { items: 5 } }, { sworn: true }]]) {
    assert.equal(liquidWealthOf({ modData: { [N.REVENANT_SAVE]: { list } } }), 0, `list ${JSON.stringify(list)}`);
  }
});

// ── A: the load's repairs over every list a save holds ───────────────────────────────────────────────────────────
// (C and A read the feud's record through the save registry before B's lines reset it.)

const ROOM = 'DaggerfallInterior [MapID=1, BuildingKey=2]';
/** A save as a build before WEAPON-POOL wrote it: `fill` puts a stale piece in each list; the load reads it. */
function loadOf(fill) {
  const p = { isPlayer: true, level: 10, gender: 'male', activeEffects: [], health: 60, maxHealth: 60, items: [], spells: [], stats: {}, skills: {}, career: { primarySkills: [], majorSkills: [], luck: 50 } };
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(p, { classicMinutes: 100 })));
  fill(snap);
  const loaded = { isPlayer: true };
  const extras = restorePlayer(loaded, snap, new Map());
  return { snap, loaded, extras };
}

test('ITEM-WALK A: the load\'s item repairs reach every list a save holds - beside the pack\'s five and customs\' walk, a thing set out in a room, a living foe\'s and a guard\'s kit (in the street and in a building), a revenant\'s take and a sworn one\'s pack, a quest\'s item and a quest foe\'s queue: each came back as an older build wrote it, a weapon to move at its first wear (WEAPON-POOL\'s P2 door) and the rest never (DISC21-A, DISC29-B, WB12a, RARITY-WEAR); now each is what a load makes it, as the hosts read it back; the walk also holds the furnisher\'s deliveries and a guild\'s shelves, where no repair applies today (mutants: each list dropped from the walk)', () => {
  // the feud's record through its own producer: a sworn one with a pack, a living one holding what it took
  const sworn = swornOne();
  RC.revenantParty().packOf(sworn.id).push(stale());
  const mobileType = MOBILE_TYPES.Orc;
  const living = N.revenantDeed(me, { mobileType, level: 6, champion: 'mighty', health: 5, maxHealth: 50, team: 'Orcs' }, 'fled', { mobileType, rolls: at(0) });
  N.revenantById(living.id).took = [stale()];   // what it took, as a build before the fix kept it
  const feud = JSON.parse(JSON.stringify(modSaveRecords()[N.REVENANT_SAVE]));
  const shelf = { day: 3, items: [] };   // a guild's day's Buy shelf (GUILD-SHELF), bought down
  const furnishings = [{ group: 'Furniture', templateIndex: 217, name: 'Bed' }];   // DECOR2b: a bed the furnisher delivered (decorFurnish.js FURNISH_BEDS)
  // weapons and armour are never set out (decorItems.js DECOR_OWN_NEVER_GROUPS): a jewel the spoils rolled on the Wand is
  const wand = mintCondition(setItemFields({ group: 'Jewellery', templateIndex: 140, flags: 0 }));
  applyRarity(wand, 'rare', seededRng(11));
  assert.ok(decorStandOf(wand), 'a rolled wand can be set out');
  const { snap, loaded, extras } = loadOf((s) => {
    s.furnishings = furnishings;
    s.sceneCache = { scenes: [{ sceneName: ROOM, decorOwn: { 'own-1': wand }, guildShelves: { BuyMagicItems: shelf } }] };
    s.world = { piles: [], droppedLoot: [], foes: [{ items: [stale()] }, { dead: true, items: [stale()] }], guards: [{ items: [stale()] }] };
    s.interior = { foes: [{ items: [stale()] }], guards: [{ items: [stale()] }] };
    s.quest = { machine: { quests: [{ resources: [
      { type: 'Person', resourceSpecific: {} }, { type: 'Item', resourceSpecific: { item: stale() } }, { type: 'Foe', resourceSpecific: { itemQueue: [stale()] } },
    ] }] } };
    s.modData = { [N.REVENANT_SAVE]: feud };
  });
  const room = loaded.sceneCache.scenes.get(ROOM);
  assert.equal(room.decorOwn['own-1'].templateIndex, 133, 'a rolled wand set out in a room, on its Amulet (RARITY-WEAR) as the restored cache holds it');
  assert.deepEqual(cond(extras.world.foes[0].items[0]), [1600, 800], 'a living foe\'s kit, handed back to the world');
  assert.deepEqual(cond(extras.world.foes[1].items[0]), [1600, 800], 'a dead foe\'s, as D3 had it');
  assert.deepEqual(cond(extras.world.guards[0].items[0]), [1600, 800], 'a guard\'s kit');
  assert.deepEqual(cond(extras.interior.foes[0].items[0]), [1600, 800], 'a building\'s foe');
  assert.deepEqual(cond(extras.interior.guards[0].items[0]), [1600, 800], 'and its guard');
  const resources = extras.quest.machine.quests[0].resources;
  assert.deepEqual(cond(resources[1].resourceSpecific.item), [1600, 800], 'a quest\'s item, as its resource restores it');
  assert.deepEqual(cond(resources[2].resourceSpecific.itemQueue[0]), [1600, 800], 'what a quest foe will carry');
  const list = extras.modData[N.REVENANT_SAVE].list;
  assert.deepEqual(cond(list.find((r) => r.id === sworn.id).companion.items[0]), [1600, 800], 'a sworn revenant\'s pack');
  assert.deepEqual(cond(list.find((r) => r.id === living.id).took[0]), [1600, 800], 'what a revenant took');
  // the walk: every list, the two no repair reaches today among them
  const walk = savedItemLists(snap, loaded);
  for (const l of [loaded.items, loaded.wagonItems, loaded.bagItems, loaded.furnishings, loaded.otherItems, snap.sceneCache.scenes[0].guildShelves.BuyMagicItems.items]) assert.ok(walk.includes(l));
  assert.equal(loaded.furnishings[0].templateIndex, 217);
});

test('ITEM-WALK A: and Project Legacy\'s lists in a save - a fallen member\'s remains (the list as it lies and as it was laid), the waiting Succession\'s bequest, and a member\'s - each through the real host\'s record, loaded on the one pool (mutants: each list dropped from the walk)', () => {
  const recordOf = () => JSON.parse(JSON.stringify(modSaveRecords()[LEGACY_VENDOR]));   // the host the last line() made
  const fell = line();
  fell.host.deathOutcome();
  const remains = loadOf((s) => { s.modData = { [LEGACY_VENDOR]: recordOf() }; }).extras.modData[LEGACY_VENDOR].remains[0];
  assert.deepEqual(cond(remains.items.find((it) => it.heirloom)), [1600, 800], 'the list as it lies');
  assert.deepEqual(cond(remains.first.find((it) => it.heirloom)), [1600, 800], 'and as it was laid');
  const elder = line({ model: MODELS.enduring });
  elder.host.current().toll = 100;
  assert.equal(elder.host.passMantle().ok, true);
  const waiting = loadOf((s) => { s.modData = { [LEGACY_VENDOR]: recordOf() }; }).extras.modData[LEGACY_VENDOR];
  assert.deepEqual(cond(waiting.pending.bequest[0]), [1600, 800], 'the waiting Succession\'s bequest');
  const heir = heirOf(elder);
  const settled = loadOf((s) => { s.modData = { [LEGACY_VENDOR]: recordOf() }; }).extras.modData[LEGACY_VENDOR];
  assert.deepEqual(cond(settled.people.find((p) => p.id === heir.id).bequest[0]), [1600, 800], 'a member\'s bequest');
});

// ── B: Project Legacy's bequests and remains ─────────────────────────────────────────────────────────────────────────

/** A line on one device: the real host over shared storage, the entity the one played (legacy4_heirloom.test.js's). */
function line({ model = MODELS.bloodline } = {}) {
  _resetModSaveData();
  const mem = () => { const m = new Map(); return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };
  const storage = mem(), tab = mem();
  const e = {
    name: 'Ysolde Hlaalu', gender: 'female', race: 'DarkElf', faceIndex: 3, careerIndex: 5, career: { name: 'Nightblade', primarySkills: [28], majorSkills: [], minorSkills: [] },
    level: 9, characterId: 'c-y', chargenDone: true, health: 0, stats: { strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
    skills: Array.from({ length: 35 }, (_, i) => (i === 28 ? 80 : 20)), items: [stale({ equipSlot: 1 })], wagonItems: [],
  };
  const w = { at: false, opened: [], given: [], said: [] };
  const host = createLegacyHost({
    entity: e, storage: () => storage, tab: () => tab, on: () => true, online: () => false, now: () => 500, own: () => 0,
    here: () => ({ pixel: { x: 40, y: 60 }, region: 'Daggerfall', regionIndex: 17, mode: 'dungeon', loc: 'Castle Daggerfall', locationType: LOCATION_TYPES.DungeonKeep, dungeon: { regionIndex: 17, locationIndex: 3 }, pos: [1, 2, 3], world: null }),
    town: () => null, nearestTown: () => ({ region: 'Daggerfall', loc: 'Daggerfall' }), gold: () => 1000, say: (l) => w.said.push(l),
    boot: () => {}, search: () => '?world', loadCharacter: () => false, saveNow: () => true, inFight: () => false, rng: at(0),   // 0: the remains keep the heirloom
    killer: () => 'the Vampire Ancient', atPlace: () => w.at, openRemains: (rec, items) => { w.opened.push(items); return true; },
    carried: () => [...e.items, ...e.wagonItems], giveItems: (items) => w.given.push(...items),
  });
  host.found(model);
  return { host, e, w };
}
/** The heir takes the mantle through the birth's own door (legacy4_heirloom.test.js heirOf) - a birth, never a load. */
function heirOf(t) {
  assert.equal(t.host.succeed({ newborn: true }), true);
  assert.ok(t.host.takeBorn(t.host.current().id), 'the birth reads the line from the device\'s store');
  Object.assign(t.e, { characterId: 'c-heir', name: `Heir ${t.host.family.surname}`, items: [], health: 50 });
  t.host.onBorn();
  return t.host.current();
}

test('ITEM-WALK B: a bequest is repaired as it is paid - an elder\'s heirloom handed down on its row\'s pool (as a build before the fix wrote it into the line\'s record) reaches the heir at birth, which is no load, on the one pool at the same share; the line\'s record keeps its own, paid once (mutants: the payout unrepaired)', () => {
  const t = line({ model: MODELS.enduring });
  t.host.current().toll = 100;   // an elder
  assert.equal(t.host.passMantle().ok, true);
  assert.deepEqual(cond(t.host.family.pending.bequest[0]), [50, 25], 'the bequest as the record holds it');
  const heir = heirOf(t);
  assert.equal(t.w.given.length, 1);
  assert.deepEqual(cond(t.w.given[0]), [1600, 800], 'paid on the one pool, the same half');
  assert.ok(t.w.given[0].heirloom, 'the heirloom it was');
  assert.deepEqual(cond(heir.bequest[0]), [50, 25], 'the line\'s record keeps its own');
  t.host.tick();
  assert.equal(t.w.given.length, 1, 'paid once');
});

test('ITEM-WALK B: a fallen member\'s remains are repaired as they open - the list is the line\'s record, the device\'s copy as often as a save\'s (mergeFamily), and the heir takes from it by no load: its heirloom on its row\'s pool opens on the one pool; the repair is no change of the heir\'s, so it claims nothing (mutants: the remains unrepaired)', () => {
  const t = line();
  assert.equal(t.host.deathOutcome().kind, 'fall');
  heirOf(t);
  const r = t.host.family.remains[0];
  const heirloom = r.items.find((it) => it.heirloom);
  assert.deepEqual(cond(heirloom), [50, 25], 'the remains as laid');
  t.w.at = true;
  t.host.tick();
  assert.equal(t.w.opened.length, 1);
  assert.deepEqual(cond(t.w.opened[0].find((it) => it.heirloom)), [1600, 800], 'opened on the one pool, the same half');
  assert.equal(r.by, null, 'opened and left: no claim');
});
