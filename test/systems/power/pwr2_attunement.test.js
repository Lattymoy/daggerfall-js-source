// PWR2 (2026-10-23, bible/05-Combat/Power-Arc.md section 5; Mac, asked: "3, swap out of combat", "2 sets, 2 combat
// keystones", "Nothing taken, extras sleep"): ATTUNEMENT - three power pieces awake, chosen out of combat; the stamp the
// receiver's mark; a piece's lines never sleep, its power does, and a drawback always bites; two sets awake, two combat
// keystones; what an older character holds past a limit sleeps, never taken, with a free respec and a free reset.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../../../src/systems/uiPrefs.js';
import * as LR from '../../../src/systems/loot/lootRarity.js';
import * as LP from '../../../src/systems/loot/lootPowers.js';
import {
  ATTUNE_MOST, SETS_AWAKE_MOST, attunable, attunedStamp, stampedPieces, attunedPieces, powerAwake, attuneRoom, attunePreview,
  attunementOn, attuneSkiesOf,
} from '../../../src/systems/power/attunement.js';
import { attune, release, attuneRefusal, releaseRefusal, settleAttunement, swapAttunementSet } from '../../../src/systems/power/attuneActions.js';
import { equipItem } from '../../../src/systems/equip.js';
import { entityModsOf } from '../../../src/systems/entityMods.js';
import { mintCondition } from '../../../src/systems/item/itemTemplates.js';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../../../src/systems/armorMaterials.js';
import { ENCHANTMENT_TYPES as T, doItemEnchantmentPayloads, PAYLOAD, LEECH_WEAPON_AMOUNT } from '../../../src/systems/enchantments.js';
import { RECEIVER_MARKS } from '../../../src/net/realm/realmTradeLaw.js';
import { validLootItem } from '../../../src/systems/loot/loot.js';
import { snapshotPlayer, restorePlayer } from '../../../src/systems/save/save.js';
import { playerEntity } from '../../../src/characters/playerEntity.js';
import { setPlayerDoor } from '../../../src/systems/playerDoor.js';
import { awakeSetIds, wornSets, _resetSigilSetsForTests } from '../../../src/systems/sigil/sigilSets.js';
import { setSigilOnline, setSigilRenown, _resetSigilForTests, SIGIL_STAGES } from '../../../src/systems/sigil/sigil.js';
import { FIRM_KEYSTONES_AWAKE, isCombatKeystone, awakeKeys, sleepingKeys, treeFault, starsFor } from '../../../src/net/firmament/firmamentLaw.js';
import { FIRM_NODES, FIRM_ADJ, START_KEYS } from '../../../src/net/firmament/firmamentTree.js';
import { pathTo } from '../../../src/net/firmament/firmamentLaw.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const fresh = () => { _resetForTests(); setPref('lootRarity', true); LP._resetLootPowersForTests(); setPlayerDoor(null); };
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = () => ({ isPlayer: true, items: [], stats: stats(), skills: new Array(35).fill(30), level: 5, career: {}, activeEffects: [], health: 100, maxHealth: 100, magicka: 50, maxMagicka: 100, goldPieces: 0 });
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
function legendary(id) {
  const rec = LR.legendaryById(id);
  const t = rec.templates?.[0];
  const base = rec.group === 'Weapons' ? createWeapon(t ?? 120, 0, () => 0.5)
    : mintCondition({ group: rec.group, templateIndex: t ?? (rec.group === 'Armor' ? 102 : 135), material: rec.group === 'Armor' ? ARMOR_MATERIAL.Steel : undefined, flags: 0 });
  const it = LR.applyRarity(base, 'legendary', lcg(1), [rec]);
  it.isIdentified = true;
  return it;
}
const wear = (e, it) => { e.items.push(it); equipItem(e, it); return it; };
const hold = (e, it) => { e.items.push(it); return it; };

test('PWR2 THE LAW: a Legendary\'s record, a Rare\'s imprint, a Gilded record or one of Daggerfall\'s artifacts carries a power to attune - a plain piece none; of the stamped pieces a character holds the three latest wake; with the ladder off nothing binds (mutants: a kind left out; the most moved; the oldest kept; off still binding)', () => {
  fresh();
  assert.equal(ATTUNE_MOST, 3);
  assert.equal(SETS_AWAKE_MOST, 2);
  assert.equal(attunable({ rarity: 'legendary', legendary: 'ravens-wings' }), true);
  assert.equal(attunable({ rarity: 'legendary' }), false, 'a Legendary with no record: nothing to wake');
  assert.equal(attunable({ rarity: 'rare', imprint: 'the-warden' }), true);
  assert.equal(attunable({ rarity: 'rare' }), false, 'a Rare\'s lines need none');
  assert.equal(attunable({ rarity: 'gilded', gilded: 'hourlock' }), true);
  assert.equal(attunable({ artifact: true }), true);
  assert.equal(attunable({ rarity: 'magic' }), false);
  const e = player();
  const four = ['ravens-wings', 'mountains-root', 'the-warden', 'aegis-of-dawn'].map((id) => hold(e, legendary(id)));
  four.forEach((it, i) => { it.attuned = i + 1; });
  assert.deepEqual(stampedPieces(e), [...four].reverse(), 'latest first');
  assert.deepEqual(attunedPieces(e), [four[3], four[2], four[1]], 'the three latest');
  assert.equal(powerAwake(e, four[0]), false, 'the oldest sleeps');
  assert.equal(powerAwake(e, four[3]), true);
  assert.equal(powerAwake(e, { rarity: 'magic' }), true, 'a piece with no power: nothing to sleep');
  assert.equal(attuneRoom(e), 0);
  setPref('lootRarity', false);
  assert.equal(attunementOn(), false);
  assert.equal(powerAwake(e, four[0]), true, 'the ladder off: Daggerfall\'s game, nothing binds');
  fresh();
});

test('PWR2 THE DOORS: attune and release out of combat - a fourth refused while three are attuned, a release frees the room; wearing a piece with room attunes it (a fresh character\'s first Legendary needs no window); a stale stamp past the latest three cleared at the settle (mutants: combat unread; the room unread; the settle never attunes; a stale stamp kept)', () => {
  fresh();
  const e = player();
  const raven = wear(e, legendary('ravens-wings'));
  assert.equal(attunedStamp(raven), 1, 'worn with room: attuned at once');
  assert.equal(powerAwake(e, raven), true);
  const root = wear(e, legendary('mountains-root'));
  const warden = wear(e, legendary('the-warden'));
  assert.equal(attuneRoom(e), 0);
  const aegis = wear(e, legendary('aegis-of-dawn'));
  assert.equal(attunedStamp(aegis), 0, 'a fourth worn: it sleeps');
  assert.equal(powerAwake(e, aegis), false);
  assert.match(attuneRefusal(e, aegis, { combat: false }), /attuned to 3 pieces already/);
  assert.match(attuneRefusal(e, raven, { combat: false }), /already attuned/);
  assert.match(attuneRefusal(e, { rarity: 'magic' }, { combat: false }), /no power/);
  assert.match(releaseRefusal(e, root, { combat: true }), /enemies nearby/, 'never in combat');
  assert.deepEqual(release(e, root, { combat: false }).ok, true);
  assert.equal(powerAwake(e, root), false);
  assert.match(attuneRefusal(e, aegis, { combat: true }), /enemies nearby/);
  assert.equal(attune(e, aegis, { combat: false }).ok, true);
  assert.equal(powerAwake(e, aegis), true);
  assert.deepEqual(attunedPieces(e), [aegis, warden, raven]);
  // a stale stamp: a piece stamped before three later ones is cleared at the settle
  root.attuned = 1; raven.attuned = 2;
  assert.equal(settleAttunement(e, { combat: false }), true);
  assert.equal(attunedStamp(root), 0, 'the oldest beyond three: cleared');
  // the settle in combat attunes nothing new
  const e2 = player();
  const r2 = hold(e2, legendary('ravens-wings'));
  equipItem(e2, r2);
  delete r2.attuned;
  assert.equal(settleAttunement(e2, { combat: true }), false);
  assert.equal(attunedStamp(r2), 0, 'with enemies near, a worn piece waits');
  fresh();
});

test('PWR2 A PIECE\'S LINES NEVER SLEEP, ITS POWER DOES - AND A DRAWBACK ALWAYS BITES: the Raven\'s evasion asleep, its lines still folded; a sleeping artifact\'s good enchantments run no payload while a curse\'s drawback still does (a piece left unattuned never sheds its curse) (mutants: the lines put to sleep; the drawback asleep; the goods awake)', () => {
  fresh();
  const e = player();
  for (const id of ['mountains-root', 'the-warden', 'aegis-of-dawn']) wear(e, legendary(id));
  const raven = wear(e, legendary('ravens-wings'));
  assert.equal(powerAwake(e, raven), false);
  assert.equal(LP.lootEvadeChance(e, { blow: true }), 0, 'its power asleep');
  const stats = raven.affixes.filter((a) => a.id === 'stat');
  assert.ok(stats.length > 0, 'the Raven carries a stat line');
  for (const a of stats) assert.ok((entityModsOf(e).stats[a.param] ?? 0) >= a.value, `its ${a.param} line folded, asleep`);
  release(e, e.items[0], { combat: false });
  attune(e, raven, { combat: false });
  assert.equal(LP.lootEvadeChance(e, { blow: true }), LR.LEGENDARY_POWERS['ravens-wings'].chance, 'attuned: awake');
  // the payloads: a good row sleeps, a drawback bites
  const piece = { group: 'Weapons', templateIndex: 120, rarity: 'legendary', legendary: 'gortwogs-cleaver', currentCondition: 100, maxCondition: 100,
    enchantments: [{ type: T.VampiricEffect, param: 1 }, { type: T.HealthLeech, param: 0 }] };
  const holder = player();
  for (const id of ['mountains-root', 'the-warden', 'aegis-of-dawn']) wear(holder, legendary(id));
  hold(holder, piece);
  assert.equal(powerAwake(holder, piece), false);
  let bitten = 0;
  holder.health = 50;   // room to heal, so a good row awake would show
  const before = holder.health;
  doItemEnchantmentPayloads(PAYLOAD.Strikes, piece, { entity: holder, target: { mobileType: 0, health: 50, maxHealth: 50 }, damage: 20, ctx: { hurtSelf: (n) => { bitten += n; } } });
  assert.equal(bitten, LEECH_WEAPON_AMOUNT, 'the drawback\'s Health Leech bit, asleep (the damned blade\'s 8 a strike)');
  assert.equal(holder.health, before, 'and Vampiric Effect healed nothing');
  assert.equal(attune(holder, piece, { combat: false }).ok, false, 'three attuned: refused');
  release(holder, holder.items[0], { combat: false });
  assert.equal(attune(holder, piece, { combat: false }).ok, true);
  holder.health = 50;
  doItemEnchantmentPayloads(PAYLOAD.Strikes, piece, { entity: holder, target: { mobileType: 0, health: 50, maxHealth: 50 }, damage: 20, ctx: { hurtSelf: () => {} } });
  assert.ok(holder.health > 50, 'attuned, its good row wakes: the blow heals');
  assert.match(rd('src/systems/enchantments.js'), /const sleeps = \(e\) => Number\.isInteger\(e\?\.type\) && e\.type < VALUE_COUNTS_BELOW;/, 'the goods are DFU\'s types under the drawbacks');
  fresh();
});

test('PWR2 THE RECEIVER\'S MARK: a piece given away comes unattuned - the trade\'s volatile fields, the wire\'s clamp drop the stamp; a save keeps it, and the skies kept aside carry their sets (mutants: the mark kept on a trade; the save forgets it)', () => {
  fresh();
  assert.ok(RECEIVER_MARKS.includes('attuned'));
  const raven = legendary('ravens-wings');
  raven.attuned = 7;
  assert.equal('attuned' in (validLootItem(raven) ?? {}), false, 'the wire carries no stamp');
  const e = structuredClone(playerEntity);
  e.items = [raven];
  e.attuneSkies = { 1: ['a1', 'a2'], 2: ['b1'] };
  const back = structuredClone(playerEntity);
  restorePlayer(back, JSON.parse(JSON.stringify(snapshotPlayer(e))));
  assert.equal(back.items[0].attuned, 7, 'a save keeps the stamp');
  assert.deepEqual(back.attuneSkies, { 1: ['a1', 'a2'], 2: ['b1'] });
  assert.deepEqual(attuneSkiesOf({ 1: ['x', 5, '', 'y', 'z', 'w'], 3: ['q'], 2: 'nope' }), { 1: ['x', 'y', 'z'] }, 'three ids at most, the two slots');
  fresh();
});

test('PWR2 THE SKIES CARRY THEIR SETS: exchanging the sky in force with a slot takes the attunements in force with it and brings the slot\'s back - by the pieces\' ids, three at most; a slot never set aside brings nothing back (mutants: the set in force not kept; the slot\'s not restored)', () => {
  fresh();
  const e = player();
  const ids = ['ravens-wings', 'mountains-root', 'the-warden', 'aegis-of-dawn'];
  const pieces = ids.map((id, i) => { const it = hold(e, legendary(id)); it.uid = `u${i}`; return it; });
  pieces.slice(0, 3).forEach((it, i) => { it.attuned = i + 1; });
  assert.equal(swapAttunementSet(e, 1), false, 'a slot never set aside: the set in force stands');
  assert.deepEqual(e.attuneSkies[1].sort(), ['u0', 'u1', 'u2']);
  e.attuneSkies[2] = ['u3', 'u0'];
  assert.equal(swapAttunementSet(e, 2), true);
  assert.deepEqual(attunedPieces(e).map((it) => it.uid).sort(), ['u0', 'u3']);
  assert.deepEqual(e.attuneSkies[2].sort(), ['u0', 'u1', 'u2'], 'the set that was in force kept in the slot');
  fresh();
});

test('PWR2 THE COMPARISON WEARS A PIECE AS PUTTING IT ON WOULD LEAVE IT: with room, a power piece is previewed awake (a copy - never the piece); full, as it would sleep (mutants: the piece stamped in place; the room unread)', () => {
  fresh();
  const e = player();
  const raven = legendary('ravens-wings');
  const view = attunePreview(e, raven);
  assert.notEqual(view, raven);
  assert.equal(attunedStamp(raven), 0, 'the piece untouched');
  assert.equal(powerAwake(e, view), true, 'previewed awake');
  for (const id of ['mountains-root', 'the-warden', 'aegis-of-dawn']) wear(e, legendary(id));
  assert.equal(attunePreview(e, raven), raven, 'no room: as it is');
  assert.match(rd('src/ui/armourCard.js'), /slotsThen\[slot\] = attunePreview\(entity, asKnown\(item\)\);/);
  fresh();
});

test('PWR2 TWO SETS AWAKE: of the sets worn, the two with the most pieces wake, then the higher stage, then the registry\'s order; a third sleeps and its card says so (mutants: the most moved; the rank by the registry first; the stage unread; the limit unsaid)', () => {
  fresh(); _resetSigilForTests(); _resetSigilSetsForTests();
  setSigilOnline(true); setSigilRenown(20);
  // seven slots, a piece each: [templateIndex, set, its stage]
  const dress = (spec) => {
    const e = player();
    for (const [t, set, stage] of spec) { const it = mintCondition({ group: 'Armor', templateIndex: t, material: ARMOR_MATERIAL.Steel }); it.sigil = { set, party: 1, xp: SIGIL_STAGES[stage].xp }; wear(e, it); }
    return e;
  };
  // the registry runs malacath, dagon, nocturnal: its LAST of the three, with the most pieces, wakes first
  const e = dress([[102, 'nocturnal', 4], [104, 'nocturnal', 4], [107, 'nocturnal', 4], [103, 'malacath', 3], [108, 'malacath', 3], [105, 'dagon', 4], [106, 'dagon', 4]]);
  assert.deepEqual([...awakeSetIds(e)].sort(), ['dagon', 'nocturnal'], 'three pieces first; of two and two, the higher stage');
  const mal = wornSets(e).find((s) => s.id === 'malacath');
  assert.equal(mal.limited, true, 'the third sleeps, and says why');
  assert.ok(mal.tiers.every((t) => !t.awake));
  const tie = dress([[102, 'nocturnal', 4], [104, 'nocturnal', 4], [107, 'nocturnal', 4], [103, 'dagon', 4], [108, 'dagon', 4], [105, 'malacath', 4], [106, 'malacath', 4]]);
  assert.deepEqual([...awakeSetIds(tie)].sort(), ['malacath', 'nocturnal'], 'two and two at one stage: the registry\'s order breaks the tie');
  _resetSigilForTests(); _resetSigilSetsForTests(); fresh();
});

test('PWR2 TWO COMBAT KEYSTONES: a sky wakes two at most - walked out from the start, nearest first, a keystone ending its path; the service refuses a new third, an old sky that holds three may only shrink, and what it holds past the limit sleeps (mutants: the most moved; a keystone passable; the shrink refused; the third awake)', () => {
  assert.equal(FIRM_KEYSTONES_AWAKE, 2);
  // three combat keystones the sky can reach from one start, through its own paths
  const start = START_KEYS[0];
  const combat = [...FIRM_NODES.keys()].filter(isCombatKeystone);
  let tree = { start, keys: [] };
  const taken = [];
  for (const k of combat) {
    const path = pathTo({ start, keys: tree.keys }, k);
    if (!path.length) continue;
    tree = { start, keys: [...new Set([...tree.keys, ...path])].sort() };
    taken.push(k);
    if (taken.length === 3) break;
  }
  assert.equal(taken.length, 3, 'the sky reaches three');
  const purse = { stars: 1e6, craft: 1e6 };
  assert.equal(treeFault(tree, 1e6, 1e6), 'firm-keystones', 'a new third refused');
  assert.equal(treeFault(tree, 1e6, 1e6, tree), null, 'the sky held already: it may stand');
  const shrunk = { start, keys: tree.keys.filter((k) => k !== taken[2]) };
  assert.equal(treeFault(shrunk, 1e6, 1e6, tree), null, 'and shrink');
  const awake = awakeKeys(tree, purse);
  assert.equal(taken.filter((k) => awake.has(k)).length, 2, 'two wake');
  assert.equal(sleepingKeys(tree, purse).filter(isCombatKeystone).length, 1, 'the third sleeps');
  // a keystone ends a path: every keystone is a leaf of the sky - its one road in - so the walk's stop at one
  // (awakeKeys' passable) is what the sky's shape already says; a road past one would be read by the walk, not this pin
  for (const k of [...FIRM_NODES.keys()].filter((x) => FIRM_NODES.get(x).kind === 'keystone')) assert.equal([...(FIRM_ADJ.get(k) ?? [])].length, 1, `${k}: one road`);
  assert.ok(starsFor(50) > 0);
});

test('PWR2 THE SWITCH BINDS WHERE ITS DOORS ARE: the doors register the ladder\'s word as they load, so no piece sleeps where nothing could attune it; the card says the attunement once the law binds (mutants: the ladder registering it; the card\'s line under the bare ladder)', () => {
  assert.match(rd('src/systems/power/attuneActions.js'), /\nregisterAttunementSwitch\(\(\) => lootRarityOn\(\)\);/);
  assert.doesNotMatch(rd('src/systems/loot/lootRarity.js'), /registerAttunementSwitch/);
  assert.match(rd('src/systems/loot/lootPowers.js'), /import '\.\.\/power\/attuneActions\.js';/, 'every host that has the powers has the doors');
  fresh();
  const raven = legendary('ravens-wings');
  assert.ok(LR.rarityLines(raven).includes(LR.attuneLineText(false)));
  raven.attuned = 1;
  assert.ok(LR.rarityLines(raven).includes(LR.attuneLineText(true)));
  fresh();
});
