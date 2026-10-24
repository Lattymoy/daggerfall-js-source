// RVN-GEAR (bible/06-Systems/Revenants.md section 40; the owner, 2026-10-17: "Add gear slots to revnants and the ability
// to customize with gear (Must be balanced)"). A sworn revenant's kit: ten slots (a melee weapon, a shield, eight armour
// places, a charm), filled from the player's pack and taken back to it; worn over the kit its stand rolls, its armour read
// again by DFU's own pass (EnemyEntity.SetEnemyEquipment - the class clamp, a monster's hide), its rarity's lines folded.
// Balanced by rank (the metal and the tier it may bear) and by kind (DFU's equipment table: the classes, the orcs, the
// centaur - every kind a charm). Inventory as its pack is: the save's copy, customs and the realm's walks, a release, a
// deserter's split.
// Pinned: the law's numbers; the slots a piece takes; every refusal; the give and the take; a real stood body
// (makeEnemyEntity + equipEnemy, through applySwornStrength - the stand's own door); the fold; the save, the release, the
// split and the two walks; the power an errand reads; the page. AUDIT RVN (Revenants.md section 43): a wand no charm; a
// broken weapon holds no shield; a piece taken back off a live body by identity, a broken blade out of its hand; the rank
// a refusal names whichever cap binds; the power's retune; no kit act abroad; the page's list (wearable first, the rest a
// press away), its condition and its broken mark; the release's count; the branches the cold lanes found unpinned.
import '../../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const N = await import('../../../src/systems/revenant/revenant.js');
const G = await import('../../../src/systems/revenant/revenantGear.js');
const RC = await import('../../../src/systems/revenant/revenantCompanions.js');
const S = await import('../../../src/systems/companionSlots.js');
const { setPref, _resetForTests } = await import('../../../src/systems/uiPrefs.js');
const { setWorldMinutes } = await import('../../../src/systems/worldTick.js');
const { MOBILE_TYPES: M } = await import('../../../src/characters/mobile/mobileTypes.js');
const { modSaveRecords, restoreModSaveRecords } = await import('../../../src/systems/modSaveData.js');
const { weaponOfMaterial, armorOfMaterial } = await import('../../../src/combat/enemyEquipment.js');
const { mintCondition, setItemFields } = await import('../../../src/systems/item/itemTemplates.js');
const { applyRarity, rarityOf } = await import('../../../src/systems/loot/lootRarity.js');
const { tieredGear } = await import('../../../src/systems/eliteFoes.js');
const { makeEnemyEntity } = await import('../../../src/characters/enemy/enemyEntity.js');
const { ENEMY_BASICS } = await import('../../../src/characters/enemy/enemyBasics.js');
const { equipEnemy } = await import('../../../src/scenes/hostCombat.js');
const { equipTableOf, EQUIP_SLOTS, lowerCondition } = await import('../../../src/systems/equip.js');
const { entityModsOf } = await import('../../../src/systems/entityMods.js');
const { stashedItemLists } = await import('../../../src/net/realm/realmGoldLaw.js');
const { possessedItemLists } = await import('../../../src/systems/item/possessedItems.js');
const { drawCompanionsPage, _resetCompanionRosterForTests, _setCompanionRosterIconForTests } = await import('../../../src/ui/companionRoster.js');

const DAY = 1440;
let me;
beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true);
  N._resetRevenantForTests(); RC._resetRetinueForTests(); S._resetCompanionSlotsForTests(); _store.clear();
  S.registerCompanionCount('revenant', () => RC.revenantsWithYou().length);
  me = { isPlayer: true, name: 'Ayla Stormwind', characterId: 'char-rvngear', level: 12, health: 100, maxHealth: 100, items: [] };
  RC.setRetinuePlayer(me);
  setWorldMinutes(DAY * 10);
});
/** A sworn one, as the game makes one: its deed, then spared. */
function sworn({ mobileType = M.Warrior, rank = 1, state = 'with' } = {}) {
  const r = N.revenantDeed(me, { mobileType, level: 6, champion: 'mighty', unquiet: true, health: 5, maxHealth: 50, team: 'Monster' }, 'fled', { mobileType, rolls: () => 0 });
  r.rank = rank;
  return N.revenantSpared(me, { revenant: { id: r.id } }, { state });
}
const rec = (r) => N.revenantById(r.id);
/** A piece of the player's, minted as the game mints it. */
const blade = (template = 120, material = 1) => weaponOfMaterial(template, material);
const plate = (template, metal) => armorOfMaterial(template, 0x0200 + metal);
const amulet = () => mintCondition(setItemFields({ group: 'Jewellery', templateIndex: 133 }));
const seq = (s) => { let a = s; return () => { a = (a * 1103515245 + 12345) >>> 0; return a / 4294967296; }; };
const career = { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50, attackModifierFlags: 0, hitPointsPerLevel: 8 };
/** A body a place stands for it: DFU's entity and its rolled kit (scenes/exteriorFoes.js spawnFoe's own two). */
function stood(mobileType, rolls = () => 0.3) {
  const e = makeEnemyEntity(mobileType, ENEMY_BASICS[mobileType], career, 10, () => 0.5);
  e.items = [];
  equipEnemy(e, mobileType, 10, rolls);
  return e;
}

// ── the law ─────────────────────────────────────────────────────────

test('RVN-GEAR THE LAW: the ten slots in order, the rank\'s metal and tier, the power; who carries equipment is DFU\'s table - the classes, the orcs, the centaur, never a beast or a lich (mutants: a cap moved; the power moved; the table unread)', () => {
  assert.deepEqual([...G.GEAR_KEYS], ['weapon', 'shield', 'head', 'rightArm', 'leftArm', 'body', 'hands', 'legs', 'feet', 'charm']);
  assert.deepEqual(G.GEAR_SLOTS.map((s) => s.slot), [EQUIP_SLOTS.RightHand, EQUIP_SLOTS.LeftHand, EQUIP_SLOTS.Head, EQUIP_SLOTS.RightArm, EQUIP_SLOTS.LeftArm, EQUIP_SLOTS.ChestArmor, EQUIP_SLOTS.Gloves, EQUIP_SLOTS.LegsArmor, EQUIP_SLOTS.Feet, null]);
  assert.deepEqual([...G.GEAR.METAL_CAP], [0, 2, 4, 6, 8, 9]);
  assert.deepEqual([...G.GEAR.RARITY_CAP], [0, 1, 2, 2, 3, 3]);
  assert.deepEqual([G.GEAR.POWER_PIECE, [...G.GEAR.POWER_TIER], G.GEAR.POWER_MAX], [0.05, [0, 0.1, 0.2, 0.35], 2]);
  assert.deepEqual([M.Warrior, M.Mage, M.Orc, M.Centaur, M.OrcSergeant, M.OrcShaman, M.OrcWarlord].map(G.armedKind), [true, true, true, true, true, true, true]);
  assert.deepEqual([M.GrizzlyBear, M.Lich, M.Rat, M.SkeletalWarrior, M.Vampire, M.FireAtronach].map(G.armedKind), [false, false, false, false, false, false]);
  assert.deepEqual([1, 3, 5, 7, 9].map((m) => G.gearRankNeeded(blade(120, m))), [1, 2, 3, 4, 5], 'Steel at I, Elven at II, Mithril at III, Ebony at IV, Daedric at V');
});

test('RVN-GEAR THE SLOTS: a melee weapon (Dagger to War Axe), each armour piece its own place, a shield its own, any jewel the charm; a bow, an arrow, a garment none (mutants: the bows let in; the jewel shut out; a place mapped wrong)', () => {
  assert.equal(G.gearKeyOf(blade(113)), 'weapon');
  assert.equal(G.gearKeyOf(blade(128)), 'weapon', 'the War Axe');
  assert.equal(G.gearKeyOf(blade(129)), null, 'a Short Bow is swung by nobody');
  assert.equal(G.gearKeyOf(blade(130)), null, 'nor a Long Bow');
  assert.deepEqual([107, 106, 105, 102, 103, 104, 108, 109, 112].map((t) => G.gearKeyOf(plate(t, 0))), ['head', 'rightArm', 'leftArm', 'body', 'hands', 'legs', 'feet', 'shield', 'shield']);
  assert.equal(G.gearKeyOf(amulet()), 'charm');
  assert.equal(G.gearKeyOf(mintCondition(setItemFields({ group: 'Jewellery', templateIndex: 140 }))), null, 'AUDIT RVN G2: a Wand is jewellery nobody wears');
  assert.equal(G.gearKeyOf({ group: 'MensClothing', templateIndex: 141 }), null);
  assert.equal(G.needsBothHands(blade(122)), true, 'the Claymore'); assert.equal(G.needsBothHands(blade(120)), false, 'the Longsword');
});

test('RVN-GEAR THE REFUSALS: the rank\'s metal and its tier, each saying the rank it needs; a beast takes a charm alone; a broken, a quest, a summoned piece, an artifact never; a shield wants a one-handed weapon given, a two-hander no shield (mutants: a cap off by one; the kind unread; the shield\'s rule gone; a broken piece worn)', () => {
  const r = sworn({ rank: 1 });
  assert.equal(G.gearRefusal(r, blade(120, 2)), null, 'Silver at rank I');
  assert.equal(G.gearRefusal(r, blade(120, 3)), 'It must rise to Rank II to bear Elven.');
  assert.equal(G.gearRefusal(r, plate(102, 9)), 'It must rise to Rank V to bear Daedric.');
  const magic = applyRarity(blade(120, 0), 'magic', seq(3)), rare = applyRarity(blade(120, 0), 'rare', seq(4));
  assert.deepEqual([rarityOf(magic), rarityOf(rare)], ['magic', 'rare']);
  assert.equal(G.gearRefusal(r, magic), null, 'Magic at rank I');
  assert.equal(G.gearRefusal(r, rare), 'It must rise to Rank II to bear a Rare piece.');
  const leg = tieredGear(12, 'legendary', seq(5));
  assert.equal(rarityOf(leg), 'legendary');
  r.rank = 3;
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
  assert.match(G.gearRefusal(r, leg) ?? '', new RegExp(`^It must rise to Rank ${ROMAN[G.gearRankNeeded(leg)]} to bear `), 'never a Legendary at rank III - and the rank that bears it whole');
  r.rank = 1;
  const legMithril = applyRarity(blade(120, 5), 'legendary', seq(11));
  assert.equal(G.gearRefusal(r, legMithril), 'It must rise to Rank IV to bear a Legendary piece of Mithril.', 'AUDIT RVN G5: both caps over - the rank that bears both');
  r.rank = 2;
  assert.equal(G.gearRefusal(r, legMithril), 'It must rise to Rank IV to bear a Legendary piece of Mithril.');
  r.rank = 3;
  assert.equal(G.gearRefusal(r, legMithril), 'It must rise to Rank IV to bear a Legendary piece.', 'Mithril borne at III: the tier binds');
  r.rank = 5;
  assert.equal(G.gearRefusal(r, leg), null, 'at rank V');
  r.rank = 1;
  assert.equal(G.gearRefusal(r, { ...blade(120, 0), currentCondition: 0 }), 'It is broken.');
  assert.equal(G.gearRefusal(r, { ...blade(120, 0), questItem: true }), 'A quest item stays with you.');
  assert.equal(G.gearRefusal(r, { ...blade(120, 0), timeForItemToDisappear: 99 }), 'A summoned piece fades in any hand but yours.');
  assert.equal(G.gearRefusal(r, { ...blade(120, 0), artifact: true }), 'It answers to you alone.');
  const bear = sworn({ mobileType: M.GrizzlyBear });
  assert.equal(G.gearRefusal(bear, blade(120, 0), { kindName: 'Grizzly Bear' }), 'Grizzly Bear wields no weapon and wears no armor, only a charm.');
  assert.equal(G.gearRefusal(bear, amulet()), null, 'a charm on a cord');
  assert.equal(G.gearRefusal(r, plate(110, 0)), 'Give it a one-handed weapon first.');
  assert.equal(G.gearRefusal(r, plate(110, 0), { gear: { weapon: blade(122) } }), 'Its weapon needs both hands.');
  assert.equal(G.gearRefusal(r, plate(110, 0), { gear: { weapon: blade(120) } }), null);
  assert.equal(G.gearRefusal(r, plate(110, 0), { gear: { weapon: { ...blade(120), currentCondition: 0 } } }), 'Give it a one-handed weapon first.', 'AUDIT RVN G3: a broken blade holds no shield');
  const w = sworn({ rank: 2 });
  N.revenantRecord(me, w.id).companion.gear = { weapon: { ...blade(120), currentCondition: 0 }, shield: plate(110, 0) };
  assert.deepEqual(G.wornGear(rec(w)), [], 'neither worn: the blade broken, so the shield held off');
  N.revenantRecord(me, w.id).companion.gear.weapon = blade(120);
  assert.deepEqual(G.wornGear(rec(w)).map(([k]) => k), ['weapon', 'shield']);
  assert.equal(G.gearRefusal(r, blade(122), { gear: { weapon: blade(120), shield: plate(110, 0) } }), 'Take back its shield first.');
  assert.equal(G.gearRefusal({ ...r, sworn: false }, blade(120)), 'It is no longer sworn to you.');
});

// ── the acts ────────────────────────────────────────────────────────

test('RVN-GEAR GIVE AND TAKE: out of my pack into its slot, the piece there before home to my pack; a piece I wear refused; taking its weapon brings its shield too; the record kept at once (mutants: the pack keeps a copy; the old piece lost; the shield left on a bare hand)', () => {
  const r = sworn({ rank: 2 });
  const a = blade(120, 1), b = blade(116, 2), sh = plate(110, 1), worn = blade(118, 1);
  me.items.push(a, b, sh, worn);
  equipTableOf(me)[EQUIP_SLOTS.RightHand] = worn;
  assert.equal(RC.giveSwornGear(r.id, worn), 'You are wearing it.');
  assert.deepEqual(RC.giftablePieces(me), [a, b, sh], 'the pack\'s pieces, never one I wear');
  assert.equal(RC.giveSwornGear(r.id, a), null);
  assert.equal(rec(r).companion.gear.weapon, a);
  assert.equal(me.items.includes(a), false, 'out of my pack');
  assert.equal(RC.giveSwornGear(r.id, b), null, 'another weapon');
  assert.equal(rec(r).companion.gear.weapon, b);
  assert.ok(me.items.includes(a), 'the first home again');
  assert.equal(RC.giveSwornGear(r.id, sh), null, 'a shield, with its one-handed weapon');
  const mirror = JSON.parse(_store.get(`dagger.revenant.${me.characterId}`));
  assert.equal(mirror.list.find((x) => x.id === r.id).companion.gear.shield.templateIndex, 110, 'kept at once, in the mirror');
  assert.deepEqual(RC.takeSwornGear(r.id, 'weapon'), [sh, b], 'its weapon, and its shield with it');
  assert.deepEqual(rec(r).companion.gear, {});
  assert.ok(me.items.includes(b) && me.items.includes(sh));
  assert.deepEqual(RC.takeSwornGear(r.id, 'weapon'), [], 'nothing there');
  assert.deepEqual(RC.takeSwornGear(r.id, 'crown'), [], 'no such slot');
});

test('RVN-GEAR A STOOD BODY (makeEnemyEntity + equipEnemy, then applySwornStrength - the stand\'s door): the given pieces over the rolled, its weapon swung, DFU\'s armour pass over what it wears (class clamp 60; an adamantium cuirass 25 on the chest), a two-hander frees the left hand; nothing given leaves the roll untouched; a broken piece is not worn; a piece taken back off a live body empties its slot (mutants: the stand never asked; the pass skipped; the left hand kept; the roll redone with nothing given)', () => {
  const r = sworn({ rank: 3 });
  const e0 = stood(M.Warrior);
  const before = [...e0.armorValues], w0 = e0.weapon;
  RC.applySwornStrength(e0, rec(r));
  assert.deepEqual(e0.armorValues, before, 'nothing given: DFU\'s stand, untouched');
  assert.equal(e0.weapon, w0);
  const cl = blade(122, 6), cu = plate(102, 6);
  me.items.push(cl, cu);
  RC.giveSwornGear(r.id, cl); RC.giveSwornGear(r.id, cu);
  const e = stood(M.Warrior, () => 0);   // its roll: a shield in the left hand
  assert.ok(equipTableOf(e)[EQUIP_SLOTS.LeftHand], 'the roll gave it a shield or a sidearm');
  RC.applySwornStrength(e, rec(r));
  assert.equal(e.weapon, cl, 'my Claymore in its hand');
  assert.equal(equipTableOf(e)[EQUIP_SLOTS.ChestArmor], cu);
  assert.equal(equipTableOf(e)[EQUIP_SLOTS.LeftHand], null, 'a two-hander frees the left hand');
  assert.equal(e.armorValues[3], 100 - 15 * 5, 'the chest: adamantium, 15 x 5 off a hundred');
  assert.ok(e.armorValues.every((v, i) => i === 3 || v <= 60), 'the class clamp holds');
  rec(r).companion.gear.body.currentCondition = 0;
  const e2 = stood(M.Warrior);
  RC.applySwornStrength(e2, rec(r));
  assert.notEqual(equipTableOf(e2)[EQUIP_SLOTS.ChestArmor], cu, 'a broken piece is worn by nobody');
  // a live body: taken back, its slot emptied at once
  RC.setRetinueBodies((id) => (id === r.id ? e : null));
  RC.takeSwornGear(r.id, 'body');
  assert.equal(equipTableOf(e)[EQUIP_SLOTS.ChestArmor], null);
  assert.equal(e.armorValues[3], 60, 'its chest bare again: the clamp');
});

test('RVN-GEAR AUDIT RVN G4, G9 A LIVE BODY: a gift is worn at once by a body standing; a piece taken back comes off it BY IDENTITY - a rolled piece standing where a broken given one was is left it, and the taken blade leaves its hand; a given blade that breaks in a fight leaves its hand (DFU\'s EnemyAttack reads the right hand) and is swung no more; a charm taken back comes off (mutants: no re-fit on a gift; the slot cleared by its key; the broken blade swung on; the charm left on)', () => {
  const r = sworn({ rank: 3 });
  const e = stood(M.Warrior);
  RC.setRetinueBodies((id) => (id === r.id ? e : null));
  const a = blade(116, 1);
  me.items.push(a);
  assert.equal(RC.giveSwornGear(r.id, a), null);
  assert.deepEqual([e.weapon, equipTableOf(e)[EQUIP_SLOTS.RightHand]], [a, a], 'worn at once');
  assert.deepEqual(RC.takeSwornGear(r.id, 'weapon'), [a]);
  assert.deepEqual([e.weapon, equipTableOf(e)[EQUIP_SLOTS.RightHand]], [null, null], 'taken back: out of its hand and its slot');
  assert.equal(RC.giveSwornGear(r.id, a), null);
  lowerCondition(a, (a.currentCondition ?? 0) + 1, e);
  assert.deepEqual([a.currentCondition, e.weapon, equipTableOf(e)[EQUIP_SLOTS.RightHand]], [0, null, null], 'broken: out of its hand');
  const e2 = stood(M.Warrior, () => 0.7);
  const rolled = e2.weapon;
  assert.ok(rolled && rolled !== a, 'its stand rolled its own blade');
  RC.applySwornStrength(e2, rec(r));
  assert.equal(e2.weapon, rolled, 'a broken gift is worn by nobody - its own blade stands');
  RC.setRetinueBodies((id) => (id === r.id ? e2 : null));
  assert.deepEqual(RC.takeSwornGear(r.id, 'weapon'), [a]);
  assert.deepEqual([e2.weapon, equipTableOf(e2)[EQUIP_SLOTS.RightHand]], [rolled, rolled], 'by identity: its own blade left it');
  const c = amulet();
  me.items.push(c);
  RC.giveSwornGear(r.id, c);
  assert.ok(equipTableOf(e2).includes(c), 'its charm on');
  RC.takeSwornGear(r.id, 'charm');
  assert.equal(equipTableOf(e2).includes(c), false, 'and off');
  assert.deepEqual(G.sanitizeGear({ weapon: { group: 'Weapons' }, head: plate(107, 1), crown: plate(107, 1) }), { head: G.sanitizeGear({ head: plate(107, 1) }).head }, 'a kit read back: the known slots, each an item with its template');
});

test('RVN-GEAR THE FOLD AND THE BEAST: a Rare helm\'s lines reach its wearer (its armour on the head, its resistances); a bear wears a charm and keeps its own hide (mutants: the fold never run; a monster read as a class)', () => {
  const r = sworn({ rank: 2 });
  const helm = applyRarity(plate(107, 1), 'rare', seq(7));
  me.items.push(helm);
  assert.equal(RC.giveSwornGear(r.id, helm), null);
  const e = stood(M.Warrior);
  RC.applySwornStrength(e, rec(r));
  const mods = entityModsOf(e);
  const armor = helm.affixes.filter((a) => a.id === 'armor').reduce((n, a) => n + a.value, 0);
  assert.ok(armor > 0, 'the producer\'s Rare carries an armour line');
  assert.equal(mods.armorParts[0], armor, 'on the head');
  for (const a of helm.affixes.filter((x) => x.id === 'resist')) assert.equal(mods.resist[a.param], a.value);
  const bear = sworn({ mobileType: M.GrizzlyBear });
  const charm = amulet();
  me.items.push(charm);
  assert.equal(RC.giveSwornGear(bear.id, charm), null);
  const b = makeEnemyEntity(M.GrizzlyBear, ENEMY_BASICS[M.GrizzlyBear], career, 10, () => 0.5);
  const hide = [...b.armorValues];
  RC.applySwornStrength(b, rec(bear));
  assert.ok(equipTableOf(b).includes(charm), 'its charm worn');
  assert.deepEqual(b.armorValues, hide, 'its own hide - a monster keeps the better');
});

// ── inventory ───────────────────────────────────────────────────────

test('RVN-GEAR ITS KIT IS INVENTORY: the save\'s copy wins on a reload both ways; a release hands it back; a deserter weighs it with its pack (keeps the more valuable half); customs and the realm\'s walk count it (mutants: the mirror\'s kit kept; the release forgets it; the split blind to it; either walk blind to it)', () => {
  const r = sworn({ rank: 2 });
  const s1 = blade(120, 1);
  me.items.push(s1);
  RC.giveSwornGear(r.id, s1);
  const saved = JSON.parse(JSON.stringify(modSaveRecords()));
  RC.takeSwornGear(r.id, 'weapon');   // after the save
  restoreModSaveRecords(saved);
  assert.equal(RC.revenantsWithYou().length, 1);
  assert.equal(N.revenantRecord(me, r.id).companion.gear.weapon?.templateIndex, 120, 'abroad in the save, worn again: the mirror never takes it');
  const snap = { modData: JSON.parse(JSON.stringify(modSaveRecords())) };
  const found = (lists) => lists.some((l) => l.some((it) => it?.templateIndex === 120 && it?.group === 'Weapons'));
  assert.ok(found(stashedItemLists(snap)), 'customs counts its kit');
  assert.ok(found(possessedItemLists(snap)), 'the realm\'s walk counts its kit');
  // given after a save: never given
  const saved2 = JSON.parse(JSON.stringify(modSaveRecords()));
  assert.equal(RC.giveSwornGear(r.id, plate(102, 0)), 'It is not in your pack.');
  const helm = plate(107, 1);
  me.items.push(helm);
  RC.giveSwornGear(r.id, helm);
  restoreModSaveRecords(saved2);
  assert.equal(N.revenantRecord(me, r.id).companion.gear.head, undefined, 'given since the save: the save says it never was');
  // the release
  me.items.length = 0;
  const got = RC.releaseRevenant(r.id);
  assert.ok(got);
  assert.ok(me.items.some((it) => it.templateIndex === 120), 'its kit handed back');
  // AUDIT RVN G9: one the save holds sworn with a kit and an empty pack, released since - back as the save had it
  const k = sworn({ rank: 2 });
  const kb = blade(116, 1);
  me.items.push(kb);
  RC.giveSwornGear(k.id, kb);
  const saved3 = JSON.parse(JSON.stringify(modSaveRecords()));
  RC.releaseRevenant(k.id);
  assert.equal(N.revenantById(k.id)?.sworn ?? false, false);
  restoreModSaveRecords(saved3);
  const kr = N.revenantRecord(me, k.id);   // the load's merge with the mirror, which saw it released
  assert.deepEqual([kr?.sworn, kr?.companion.gear.weapon?.templateIndex], [true, 116], 'its kit is no one\'s to lose');
  // the deserter
  const d = sworn({ rank: 2 });
  const cheap = blade(113, 0), dear = plate(102, 4);
  me.items.push(cheap, dear);
  RC.giveSwornGear(d.id, dear);
  N.revenantRecord(me, d.id).companion.items.push(cheap);
  me.items.length = 0;
  N.revenantDeserts(me, N.revenantRecord(me, d.id));
  assert.equal(N.revenantById(d.id).took.length, 1, 'the more valuable half kept');
  assert.equal(N.revenantById(d.id).took[0].templateIndex, 102, 'its cuirass, the dearer');
  assert.ok(me.items.some((it) => it.templateIndex === 113), 'the rest back to me');
});

test('RVN-GEAR ITS WEIGHT ABROAD: a piece a twentieth, its tier\'s share more, at most two - only what it wears; ten Common pieces never weigh what three Legendaries do (AUDIT RVN G8) (mutants: the cap gone; a tier unread; a piece it cannot wear counted)', () => {
  const r = sworn({ rank: 5 });
  assert.equal(G.gearPower(rec(r)), 0);
  const pieces = [blade(120, 1), plate(107, 1), plate(102, 1)];
  me.items.push(...pieces);
  for (const it of pieces) RC.giveSwornGear(r.id, it);
  assert.equal(G.gearPower(rec(r)), 0.15, 'three Common pieces');
  const rare = applyRarity(plate(104, 1), 'rare', seq(9));
  me.items.push(rare); RC.giveSwornGear(r.id, rare);
  assert.equal(G.gearPower(rec(r)), 0.4, 'a Rare: a twentieth and a fifth');
  for (const t of [106, 105, 103, 108, 110]) { const p = plate(t, 1); me.items.push(p); RC.giveSwornGear(r.id, p); }
  assert.equal(G.gearPower(rec(r)), 0.65, 'ten pieces, nine of them Common');
  for (const t of [106, 105, 103, 108, 110]) { const p = applyRarity(plate(t, 1), 'legendary', seq(t)); me.items.push(p); RC.giveSwornGear(r.id, p); }
  assert.equal(G.gearPower(rec(r)), 2, 'at most two');
  const bear = sworn({ mobileType: M.GrizzlyBear });
  N.revenantRecord(me, bear.id).companion.gear.weapon = blade(120, 1);   // an old record's
  assert.equal(G.gearPower(rec(bear)), 0, 'a bear wears no blade, so it counts none');
  assert.deepEqual(G.wornGear(rec(bear)), []);
});

test('RVN-GEAR THE PAGE: Gear opens its kit - a well a slot (a beast\'s the charm alone), what it wears with Take back, my pieces with Give (a refusal said under its row) (mutants: the sheet never drawn; a beast shown armour; the refusal unsaid)', () => {
  _resetCompanionRosterForTests();
  _setCompanionRosterIconForTests(() => ({ src: 'data:x', w: 30, h: 40 }));
  globalThis.document = undefined;
  const r = sworn({ rank: 1 });
  const ok = blade(120, 1), dear = blade(120, 9);
  me.items.push(ok, dear);
  const draw = () => { const d = el('div', 'px-qdetail'); drawCompanionsPage(d, () => {}, { el, divider: (t) => el('h4', 'px-divider', t), meter: (n, m) => el('div', 'px-meter', `${n}/${m}`), here: () => null, kindName: (t) => (t === M.GrizzlyBear ? 'Grizzly Bear' : 'Warrior') }); return d; };
  let d = draw();
  assert.equal(byClass(d, 'cmp-sheet').length, 0, 'shut until asked');
  buttons(d, 'Gear')[0].onclick();
  d = draw();
  assert.equal(byClass(d, 'cmp-gslot').length, 10, 'a well a slot');
  assert.match(d.textContent, /At Rank I it can wear up to Silver and Magic pieces\./);
  assert.match(d.textContent, /From your pack/);
  const gives = buttons(d, 'Give');
  assert.equal(gives.length, 2);
  gives.find((b) => /Daedric/.test(b.title)).onclick();
  d = draw();
  assert.match(d.textContent, /It must rise to Rank V to bear Daedric\./, 'the refusal under its row');
  buttons(d, 'Give').find((b) => !/Daedric/.test(b.title)).onclick();
  assert.equal(rec(r).companion.gear.weapon, ok);
  d = draw();
  assert.equal(buttons(d, 'Take back').length, 1);
  _resetCompanionRosterForTests();
  const bear = sworn({ mobileType: M.GrizzlyBear, state: 'away' });
  d = draw();
  buttons(d, 'Gear')[1].onclick();
  d = draw();
  const wells = byClass(d, 'cmp-gslot');
  assert.equal(wells.length, 1, 'a beast: the charm alone');
  assert.match(d.textContent, /Grizzly Bear can't use weapons or armor, but it can wear a charm\./);
  assert.ok(bear.sworn);
});

test('RVN-GEAR AUDIT RVN G1, G6, G7 THE PAGE\'S LIST AND MARKS: the pieces it can wear listed before those it cannot - a looter\'s twelve blades past its rank hide no helm and no charm - a quest\'s or a summoned piece never listed, the rest a press away; what it wears says its condition, a broken piece says it is not worn; the release counts its kit (mutants: the refused first; the cap with no more; the broken unmarked; the kit uncounted)', () => {
  _resetCompanionRosterForTests();
  _setCompanionRosterIconForTests(() => ({ src: 'data:x', w: 30, h: 40 }));
  globalThis.document = undefined;
  const r = sworn({ rank: 1 });
  const ebony = Array.from({ length: 12 }, () => blade(120, 7));
  const helm = plate(107, 0), charm = amulet(), quest = { ...blade(113, 0), questItem: true };
  me.items.push(...ebony, helm, charm, quest);
  const draw = () => { const d = el('div', 'px-qdetail'); drawCompanionsPage(d, () => {}, { el, divider: (t) => el('h4', 'px-divider', t), meter: (n, m) => el('div', 'px-meter', `${n}/${m}`), here: () => null, kindName: () => 'Warrior' }); return d; };
  let d = draw();
  buttons(d, 'Gear')[0].onclick();
  d = draw();
  const picks = byClass(d, 'cmp-pick');
  assert.equal(picks.length, 12, 'the first twelve');
  assert.match(picks[0].textContent, /Helm/);
  assert.match(picks[1].textContent, /Charm/);
  assert.ok(picks.slice(0, 2).every((x) => x.children.at(-1).classList.contains('primary')), 'the two it can wear, first and offered');
  assert.equal(d.textContent.includes('Dagger'), false, 'a quest piece never listed');
  const more = buttons(d, 'Show 2 more');
  assert.equal(more.length, 1);
  more[0].onclick();
  d = draw();
  assert.equal(byClass(d, 'cmp-pick').length, 14, 'every one, a press away');
  // its condition, and a broken piece's mark
  const a = blade(120, 1);
  me.items.push(a);
  RC.giveSwornGear(r.id, a);
  d = draw();
  assert.match(d.textContent, /Condition 100%/);
  a.currentCondition = 0;
  d = draw();
  assert.match(d.textContent, /Broken: not worn until repaired/);
  assert.ok(byClass(d, 'cmp-gname').some((n) => n.classList.contains('is-broken')));
  // the release counts the kit
  N.revenantRecord(me, r.id).companion.items = [];
  buttons(d, 'Release')[0].onclick();
  d = draw();
  assert.match(d.textContent, /giving back what it carries \(one item\)/);
});

// ── the page's fake document (revenant_companions.test.js's) ────────
function fakeEl(tag) {
  const classes = new Set();
  const n = {
    tag, children: [], attrs: {}, parent: null, title: '', isConnected: true,
    classList: { add: (...c) => c.forEach((x) => classes.add(x)), contains: (c) => classes.has(c), remove: (...c) => c.forEach((x) => classes.delete(x)) },
    get className() { return [...classes].join(' '); }, set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((x) => classes.add(x)); },
    _text: '', get textContent() { return n._text + n.children.map((c) => c.textContent ?? '').join(''); }, set textContent(v) { n._text = String(v ?? ''); },
    get firstChild() { return n.children[0] ?? null; },
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    insertBefore(c, ref) { c.parent = n; const i = ref ? n.children.indexOf(ref) : -1; if (i < 0) n.children.push(c); else n.children.splice(i, 0, c); return c; },
    setAttribute(k, v) { n.attrs[k] = v; },
  };
  return n;
}
function el(t, cls, text) { const n = fakeEl(t); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
function byClass(root, cls) { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (c.classList?.contains(cls)) out.push(c); walk(c); } }; walk(root); return out; }
function buttons(root, label) { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (c.tag === 'button' && c.textContent === label) out.push(c); walk(c); } }; walk(root); return out; }
