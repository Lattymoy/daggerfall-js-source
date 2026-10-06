// RAID4b (2026-09-28, Mac on World Events - Raiding Parties online: "3. We can also add renown and it's own atheric +
// armor sets"): THE RAIDING PARTIES' OWN SETS AND A TOWN'S THANKS. The three sets' law (systems/sigilSets.js), each
// power driven through the REAL seam SET2 opened (systems/sigilSetPowers.js - the fold, the blow, the damage door, the
// kill, the round, the HUD's chips) with a stand-in for the running host's door and a clock of the test's own, the
// twenty-seven Aetheric records and the wire's check of them (systems/aetheric.js), the thanks rolled off a receipt's
// seed (systems/raidSpoils.js), the spoils pool's own keys for them (scenes/spoilsPool.js), and the host's wiring by
// source (scenes/world.js). Design: bible/03-World/Raiding-Parties.md, "The rewards (RAID4)"; the numbers
// bible/11-Multiplayer/Sigil-Sets.md section 6b.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  awakeTiersOf, setBlow, setStruck, setDamageMod, setRound, setPowerStates, setHudChips, setSetPowersVoice, bloodStacks, markedFoe,
  _setSetPowersClockForTests, _resetSetPowersForTests,
} from '../src/systems/sigilSetPowers.js';
import { setSigilOnline, setSigilRenown, SIGIL_STAGES, SIGIL_SET_IDS, SIGIL_BANDS, SIGIL_POWER_MAX, _resetSigilForTests } from '../src/systems/sigil.js';
import {
  setSetsDueling, SIGIL_SETS, WORLD_SET_IDS, SET_PLACES, SET_STAGE_MAX, RIPOSTE_SECONDS, MARK_METRES, MARK_SECONDS, BLOOD_SECONDS,
  BLOOD_STACKS, raidSetOf, rollWorldSet, rollSetSigil, tierValues, wornSetPieces, setState, _resetSigilSetsForTests,
} from '../src/systems/sigilSets.js';
import {
  AETHERIC_RECORDS, RAID_SET_PIECES, RAID_SET_POWER, RAID_SET_CHANCE, REGALIA, AETHERIC_WORTH, aethericById, aethericMaterial,
  mintAetheric, raidSetPieces, rollRaidSetPiece, validSetMarks,
} from '../src/systems/aetheric.js';
import {
  RAID_SPOILS_GOLD_PER_LEVEL, RAID_SPOILS_SOURCE, RAID_SPOILS_KEYS, RAID_SPOILS_TEXT, raidSpoilsDay, rollRaidSpoils, raidSpoilsList,
} from '../src/systems/raidSpoils.js';
import { createSpoilsPool, recoverSpoils, SPOILS_KEYS, SPOILS_STORE_KEY, SPOILS_DAY_KEY, SPOILS_TEXT } from '../src/scenes/spoilsPool.js';
import { entityModsOf, entityArmorMod, entityStatMod, entitySkillMod, weaponBlowMods, NUMBER_BODY_PARTS } from '../src/systems/entityMods.js';
import { hurtPlayer } from '../src/characters/playerEntity.js';
import { reportPlayerKill } from '../src/systems/playerKills.js';
import { setPlayerDoor } from '../src/systems/playerDoor.js';
import { equipItem } from '../src/systems/equip.js';
import { mintCondition, itemBaseValue, isAmmunition } from '../src/systems/itemTemplates.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { WEAPON_MATERIALS } from '../src/characters/weapons.js';
import { SKILLS } from '../src/systems/skills.js';
import { KNIGHT_CITY_WATCH } from '../src/characters/mobileTypes.js';
import { AFFIX_RANGES, validAffix, affixesWorth, RARITIES } from '../src/systems/lootRarity.js';
import { validLootItem } from '../src/systems/loot.js';
import { getItemHands, ITEM_HANDS } from '../src/characters/equipTable.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = () => ({
  isPlayer: true, items: [], stats: stats(), skills: new Array(35).fill(30), level: 5, career: {}, activeEffects: [],
  health: 100, maxHealth: 100, magicka: 0, maxMagicka: 1000, armorValues: new Array(7).fill(100),
});
const BODY = [107, 106, 105, 102, 103, 104, 108];   // helm, right and left pauldron, cuirass, gauntlets, greaves, boots
const XP = SIGIL_STAGES.map((s) => s.xp);
const piece = (templateIndex, set, xp = 0) => {
  const it = mintCondition({ group: 'Armor', templateIndex, material: ARMOR_MATERIAL.Steel, flags: 0 });
  it.rarity = 'rare';
  it.sigil = { set, party: 1, xp };
  return it;
};
const wearSet = (e, set, n, xp = 0) => { for (const t of BODY.slice(0, n)) { const it = piece(t, set, xp); e.items.push(it); equipItem(e, it); } return e; };
const sword = () => createWeapon(120, 0, () => 0.5);   // a longsword: melee
const bow = () => createWeapon(130, 0, () => 0.5);     // a long bow: Archery
const RAT = Object.freeze({ name: 'rat' });

let T = 0;
_setSetPowersClockForTests(() => T);
const at = (t) => { T = t; };
function fresh() {
  _resetSigilForTests(); _resetSigilSetsForTests(); _resetSetPowersForTests(); setPlayerDoor(null); at(0);
  const v = { said: [], sounds: [] };
  setSetPowersVoice({ say: (l) => v.said.push(l), sound: (n) => v.sounds.push(n) });
  return v;
}
const online = (renown = 1) => { setSigilOnline(true); setSigilRenown(renown); };
const foe = (name, x, z = 0, y = 0) => ({ name, entity: { name }, ai: { feet: [x, y, z] }, dead: false });
/** A foe's blow at me as the game deals one: the formula's struck tail marks it, then my damage door takes it. */
const blow = (e, n, attacker = RAT) => { setStruck(attacker, e, n); return hurtPlayer(e, n); };
function door(foes = [], { feet = [0, 0, 0], me = null, clear = undefined } = {}) {
  const d = { hurts: [], casts: [] };
  setPlayerDoor({
    foes: () => foes.filter((f) => !f.dead && f.entity),
    feet: () => feet,
    hurtFoe: (f, n) => { d.hurts.push([f.name, n]); },
    castOnPlayer: (b) => { d.casts.push(b); },
    player: () => me,
    ...(clear ? { clear } : {}),
  });
  return d;
}
const seq = (...xs) => { let i = 0; return () => xs[Math.min(i++, xs.length - 1)]; };

test('RAID4b the law: three sets after the gate boss\'s own - the Broken Oath (the knights\', party 0), the Thief-Taker\'s Garb (the bandits\', 1), Orcsbane Harness (the orcs\', 2) - Aetheric, the Bay\'s towns their Prince, each tier\'s numbers a whole pair and its words whole; a raiding party names its set and nothing else does; no roll of the world ever lands on one (mutants: a raid set among the world\'s; a party naming the wrong set; a missing party naming a world set)', () => {
  assert.deepEqual(SIGIL_SET_IDS.slice(5, 8), ['oath', 'thieftaker', 'orcsbane']);   // PIN MOVED (SERPENT-SET): right after the gate boss's own, the serpent's own after them
  assert.deepEqual([0, 1, 2].map((p) => raidSetOf(p)?.id), ['oath', 'thieftaker', 'orcsbane']);
  for (const p of [3, -1, undefined, null, '1', 1.5]) assert.equal(raidSetOf(p), null, `no set for ${String(p)}`);
  for (const id of ['oath', 'thieftaker', 'orcsbane']) {
    const set = SIGIL_SETS[id];
    assert.equal(set.aetheric, true, id);
    assert.equal(set.prince, 'The towns of the Bay');
    assert.ok(!WORLD_SET_IDS.includes(id), `${id} is no world set`);
  }
  assert.equal(SIGIL_SETS.ruhn.raid, undefined, 'the gate boss\'s own names no party');
  const words = (id, i, st) => { const t = SIGIL_SETS[id].tiers[i]; return t.text(tierValues(t, st)); };
  assert.equal(words('oath', 0, 0), '+1 armour on every part, +2 Willpower');
  assert.equal(words('oath', 1, SET_STAGE_MAX), `When a foe's blow lands on you, your next weapon blow within ${RIPOSTE_SECONDS} s deals +40% damage`);
  assert.equal(words('oath', 2, 0), 'While you are under half health, you take 10% less damage');
  assert.equal(words('thieftaker', 1, 0), 'Your weapon blows deal +8% damage to a foe under half health, arrows too');
  assert.equal(words('thieftaker', 2, SET_STAGE_MAX), `A kill marks the nearest other foe within ${MARK_METRES} m for ${MARK_SECONDS} s: your weapon blows deal it +40% damage`);
  assert.equal(words('orcsbane', 1, 0), `Each foe's blow that lands on you grants a stack for ${BLOOD_SECONDS} s, up to ${BLOOD_STACKS}: +3% weapon damage a stack`);
  assert.equal(words('orcsbane', 2, 0), 'A kill wards you: the next 10 damage you take is turned aside. Recovers in 60 s');
  assert.equal(words('orcsbane', 2, SET_STAGE_MAX), 'A kill wards you: the next 40 damage you take is turned aside. Recovers in 30 s');
  // the world's rolls: a win's set sigil, a weapon's join, the Broker's shelf - the four alone
  const seen = new Set();
  for (let i = 0; i < 400; i++) { seen.add(rollWorldSet(() => i / 400)); const s = rollSetSigil('rare', 1, seq(0, i / 400)); if (s) seen.add(s.set); }
  assert.deepEqual([...seen].sort(), [...WORLD_SET_IDS].sort(), 'the world rolls its four, never a raid\'s');
  assert.match(strip(read('src/systems/sigilBroker.js')), /for \(const set of WORLD_SET_IDS\)[\s\S]*const wset = pick\(WORLD_SET_IDS, rolls\);/, 'the Broker shelves the world\'s sets');
});

test('RAID4b the 2-piece stat tiers: one fold over RF1\'s channels - Oath of the Watch\'s armour on all seven parts and its Willpower, Keen-Eyed\'s Agility and Archery, Thick-Skinned\'s Endurance and Blunt Weapon - at the set\'s stage; nothing at one piece (mutants: a part left out; a stat or skill on the wrong name)', () => {
  fresh(); online(1);
  assert.deepEqual(entityModsOf(wearSet(player(), 'oath', 1)).armorParts, new Array(NUMBER_BODY_PARTS).fill(0), 'one piece wakes nothing');
  const oath = wearSet(player(), 'oath', 2);
  assert.deepEqual(entityModsOf(oath).armorParts, new Array(NUMBER_BODY_PARTS).fill(1), 'Oath of the Watch at Faint: +1 on every part');
  for (let p = 0; p < NUMBER_BODY_PARTS; p++) assert.equal(entityArmorMod(oath, p), -1, `part ${p}`);
  assert.equal(entityStatMod(oath, 'willpower'), 2);
  assert.equal(entityStatMod(oath, 'endurance'), 0, 'the Willpower alone');
  const keen = wearSet(player(), 'thieftaker', 3);
  assert.equal(entityStatMod(keen, 'agility'), 2);
  assert.equal(entitySkillMod(keen, SKILLS.Archery), 4);
  assert.equal(entitySkillMod(keen, SKILLS.LongBlade), 0, 'Archery alone');
  const hide = wearSet(player(), 'orcsbane', 2);
  assert.equal(entityStatMod(hide, 'endurance'), 2);
  assert.equal(entitySkillMod(hide, SKILLS.BluntWeapon), 4);
  assert.equal(entitySkillMod(hide, SKILLS.Axe), 0, 'Blunt Weapon alone');
  fresh(); online(40);
  const asc = wearSet(player(), 'oath', 2, XP[4]);
  assert.equal(entityArmorMod(asc, 0), -4, 'Ascendant: +4');
  assert.equal(entityStatMod(asc, 'willpower'), 6);
});

test('RAID4b Riposte (the Broken Oath, 4): a foe\'s blow that TAKES my health opens a window of RIPOSTE_SECONDS, and my next weapon blow inside it deals its per cent more - that blow alone, a miss spending nothing; a fall, a blow a Shield spell swallowed whole and a window run out sharpen nothing (mutants: the window never spent; a fall arming it; the window never closing; a miss spending it)', () => {
  fresh(); online(1);
  const e = wearSet(player(), 'oath', 4);
  const s = sword();
  at(10);
  assert.equal(weaponBlowMods(s, 100, e, RAT), 100, 'no blow has landed on me');
  blow(e, 10);
  assert.equal(e.health, 90);
  assert.equal(weaponBlowMods(s, 0, e, RAT), 0, 'a miss');
  assert.equal(weaponBlowMods(s, 100, e, RAT), 115, 'the next blow that lands: +15% at Faint');
  assert.equal(weaponBlowMods(s, 100, e, RAT), 100, 'spent by it');
  blow(e, 10);
  at(10 + RIPOSTE_SECONDS - 0.01);
  assert.equal(weaponBlowMods(bow(), 100, e, RAT), 115, 'inside the window - an arrow too');
  blow(e, 10);
  at(T + RIPOSTE_SECONDS);
  assert.equal(weaponBlowMods(s, 100, e, RAT), 100, 'the window closed');
  hurtPlayer(e, 5);
  assert.equal(weaponBlowMods(s, 100, e, RAT), 100, 'a hurt no foe\'s blow dealt (a fall) opens nothing');
  e.activeEffects = [{ kind: 'shield', shieldRemaining: 100 }];
  blow(e, 10);
  assert.equal(weaponBlowMods(s, 100, e, RAT), 100, 'a blow the Shield swallowed whole never landed');
  e.activeEffects = [];
  e.health = 0;
  blow(e, 10);
  e.health = 100;
  assert.equal(weaponBlowMods(s, 100, e, RAT), 100, 'a blow on a body already at nothing took nothing');
  fresh(); online(1);
  const two = wearSet(player(), 'oath', 2);
  blow(two, 10);
  assert.equal(weaponBlowMods(sword(), 100, two, RAT), 100, 'two pieces: no Riposte');
  for (const t of [104, 108]) { const it = piece(t, 'oath'); two.items.push(it); equipItem(two, it); }
  assert.equal(weaponBlowMods(sword(), 100, two, RAT), 100, 'a blow taken with two pieces opened no window for the four put on after it');
  fresh(); online(40);
  const asc = wearSet(player(), 'oath', 4, XP[4]);
  blow(asc, 10);
  assert.equal(weaponBlowMods(sword(), 100, asc, RAT), 140, 'Ascendant: +40%');
});

test('RAID4b Run Them Down (the Thief-Taker\'s Garb, 4): my weapon blows at a foe UNDER half its health deal their per cent more, arrows too; never at half or above, never at a foe with no health to read (mutants: at half health; the attacker\'s health read)', () => {
  fresh(); online(1);
  const e = wearSet(player(), 'thieftaker', 4);
  const bandit = { name: 'bandit', health: 50, maxHealth: 100 };
  assert.equal(weaponBlowMods(sword(), 100, e, bandit), 100, 'at half: not under it');
  bandit.health = 49;
  assert.equal(weaponBlowMods(sword(), 100, e, bandit), 108, 'under half: +8% at Faint');
  assert.equal(weaponBlowMods(bow(), 100, e, bandit), 108, 'an arrow too');
  assert.equal(weaponBlowMods(sword(), 100, e, RAT), 100, 'no health to read');
  e.health = 10;
  assert.equal(weaponBlowMods(sword(), 100, e, { ...bandit, health: 90 }), 100, 'MY health is not the foe\'s');
  fresh(); online(40);
  assert.equal(weaponBlowMods(sword(), 100, wearSet(player(), 'thieftaker', 4, XP[4]), { health: 1, maxHealth: 100 }), 120, 'Ascendant: +20%');
});

test('RAID4b No Escape (the Thief-Taker\'s Garb, 6): a kill marks the NEAREST other live foe within MARK_METRES of my feet for MARK_SECONDS - never the one killed, an ally, a foe at peace, one a storey away, one behind a wall or one past the reach - and my blows at it deal their per cent more, said and sounded; a kill with none to mark leaves the mark as it stood; the watch\'s death marks nothing (mutants: the last in reach marked; the killed foe marked; the reach ignored; a wall ignored; the mark never ending; four pieces marking)', () => {
  const v = fresh(); online(1);
  const e = wearSet(player(), 'thieftaker', 6);
  const s = sword();
  const killed = { name: 'killed', entity: { name: 'killed' }, ai: { feet: [0.5, 0, 0] }, dead: false };
  const near = foe('near', 5), far = foe('far', 11), beyond = foe('beyond', 13), up = foe('up', 2, 0, 3);
  const ally = { ...foe('ally', 1), entity: { name: 'ally', team: 'PlayerAlly' } };
  const calm = { ...foe('calm', 1.5), ai: { feet: [1.5, 0, 0], isHostile: false } };
  door([killed, near, far, beyond, up, ally, calm], { me: e });
  at(50);
  reportPlayerKill(killed.entity);
  assert.equal(markedFoe(), near.entity, 'the nearest, not the last in reach: never the one killed, the ally, the calmed foe, or one a storey up');
  assert.deepEqual(v.said, ['No Escape - the nearest of them is marked.']);
  assert.deepEqual(v.sounds, ['mark']);
  assert.equal(weaponBlowMods(s, 100, e, near.entity), 115, '+15% at Faint on the marked foe');
  assert.equal(weaponBlowMods(s, 100, e, far.entity), 100, 'no other');
  at(50 + MARK_SECONDS - 0.01);
  assert.equal(weaponBlowMods(bow(), 100, e, near.entity), 115, 'an arrow too, inside the mark');
  at(50 + MARK_SECONDS);
  assert.equal(markedFoe(), null, 'the mark ran out');
  assert.equal(weaponBlowMods(s, 100, e, near.entity), 100);
  // a wall between my feet and the nearest: the next clear one is marked
  door([killed, far, near], { me: e, clear: (a, b) => b !== near.ai.feet });
  reportPlayerKill(killed.entity);
  assert.equal(markedFoe(), far.entity, 'behind a wall: passed over');
  // none in reach: the mark stands as it was
  door([killed, beyond], { me: e });
  reportPlayerKill(killed.entity);
  assert.equal(markedFoe(), far.entity, 'nothing to mark - the old mark stands');
  reportPlayerKill({ name: 'a guard', mobileType: KNIGHT_CITY_WATCH });
  assert.equal(v.said.length, 2, 'the watch\'s death marks nothing');
  fresh(); online(1);
  const four = wearSet(player(), 'thieftaker', 4);
  door([killed, near], { me: four });
  reportPlayerKill(killed.entity);
  assert.equal(markedFoe(), null, 'four pieces: no mark');
});

test('RAID4b Blood for Blood (Orcsbane Harness, 4): each foe\'s blow that takes my health is a stack, up to BLOOD_STACKS, the newest refreshing every one and all gone BLOOD_SECONDS after it; each stack its per cent of my weapon blows; a fall is no stack (mutants: no cap; the window from the first stack; a fall stacking)', () => {
  fresh(); online(1);
  const e = wearSet(player(), 'orcsbane', 4);
  const s = sword();
  at(0);
  blow(e, 2);
  assert.equal(bloodStacks(), 1);
  assert.equal(weaponBlowMods(s, 100, e, RAT), 103, '+3% a stack at Faint');
  for (let i = 0; i < 6; i++) { at(1 + i); blow(e, 2); }
  assert.equal(bloodStacks(), BLOOD_STACKS, 'five at most');
  assert.equal(weaponBlowMods(s, 100, e, RAT), 115);
  at(6 + BLOOD_SECONDS - 0.01);
  assert.equal(bloodStacks(), 5, 'the last blow refreshed them all');
  at(6 + BLOOD_SECONDS);
  assert.equal(bloodStacks(), 0);
  hurtPlayer(e, 2);
  assert.equal(bloodStacks(), 0, 'a fall is no stack');
  fresh(); online(40);
  const asc = wearSet(player(), 'orcsbane', 4, XP[4]);
  blow(asc, 2); blow(asc, 2);
  assert.equal(weaponBlowMods(sword(), 100, asc, RAT), 116, 'Ascendant: +8% a stack');
});

test('RAID4b Hold the Line (the Broken Oath, 6): while I stand UNDER half health every hurt my door takes is its per cent less, in whole points with the fraction carried to the next hurt; never at half or above (mutants: at half health; the fraction dropped)', () => {
  fresh(); online(1);
  const e = wearSet(player(), 'oath', 6);
  e.health = 50;
  assert.equal(setDamageMod(e, 100), 100, 'at half: not under it');
  e.health = 49;
  assert.equal(setDamageMod(e, 100), 90, '10% less at Faint');
  assert.deepEqual([3, 3, 3, 3].map((n) => setDamageMod(e, n)), [3, 3, 3, 2], 'three tenths a hurt, carried: the fourth takes the whole point');
  hurtPlayer(e, 20);
  assert.equal(e.health, 31, 'through my door: eighteen of twenty');
  fresh(); online(40);
  const asc = wearSet(player(), 'oath', 6, XP[4]);
  asc.health = 10;
  assert.equal(setDamageMod(asc, 100), 75, 'Ascendant: 25% less');
  fresh(); online(1);
  const four = wearSet(player(), 'oath', 4);
  four.health = 10;
  assert.equal(setDamageMod(four, 100), 100, 'four pieces: nothing');
});

test('RAID4b Iron Hide (Orcsbane Harness, 6): a kill when it is ready wards me - the next points of damage my door takes are turned aside, spent point for point - said and sounded, and it recovers in its time, said ready again at the round; a kill inside the recovery wards nothing, and a ward is never piled on a ward (mutants: no recovery; the ward stacked; the ward spent twice; the ward taken off a sleeping set)', () => {
  const v = fresh(); online(1);
  const e = wearSet(player(), 'orcsbane', 6);
  door([], { me: e });
  at(100);
  assert.equal(setDamageMod(e, 5), 5, 'no ward yet');
  reportPlayerKill(RAT);
  assert.deepEqual(v.said, ['Iron Hide - the next 10 damage is turned aside.']);
  assert.deepEqual(v.sounds, ['ward']);
  assert.equal(setPowerStates().ward, 10);
  assert.equal(setDamageMod(e, 4), 0, 'four of the ten');
  hurtPlayer(e, 8);
  assert.equal(e.health, 98, 'six turned aside, two taken');
  assert.equal(setPowerStates().ward, 0);
  at(130);
  reportPlayerKill(RAT);
  assert.equal(setPowerStates().ward, 0, 'inside the recovery: no ward');
  setRound(e);
  assert.equal(v.said.length, 1, 'not ready yet');
  at(160);
  setRound(e);
  assert.deepEqual(v.said.slice(1), ['Iron Hide is ready again.']);
  reportPlayerKill(RAT);
  at(221);
  reportPlayerKill(RAT);
  assert.equal(setPowerStates().ward, 10, 'a fresh ward, never one piled on another');
  setSigilOnline(false);
  assert.equal(setDamageMod(e, 5), 5, 'the sets asleep: the ward turns nothing aside');
  assert.equal(setPowerStates().ward, 10, 'and is not spent');
  fresh(); online(40);
  const asc = wearSet(player(), 'orcsbane', 6, XP[4]);
  door([], { me: asc });
  reportPlayerKill(RAT);
  assert.equal(setPowerStates().ward, 40, 'Ascendant: forty');
  assert.equal(setPowerStates().wardRecoverLeft, 30, 'recovering in thirty seconds');
});

test('RAID4b the HUD\'s chips: No Escape\'s mark while it stands, Iron Hide\'s ward (its points) while it holds and its recovery after - only with the 6-piece tier awake; and the powers\' states (mutants: a chip for four pieces; the ward\'s chip reading time)', () => {
  fresh(); online(1);
  const t = wearSet(player(), 'thieftaker', 6);
  door([{ name: 'killed', entity: RAT, ai: { feet: [1, 0, 0] }, dead: false }, foe('next', 4)], { me: t });
  at(0);
  assert.deepEqual(setHudChips(t), []);
  reportPlayerKill(RAT);
  assert.deepEqual(setHudChips(t), [{ key: 'mark', set: 'thieftaker', name: 'No Escape', text: '10s', state: 'active' }]);
  fresh(); online(1);
  const o = wearSet(player(), 'orcsbane', 6);
  door([], { me: o });
  at(0);
  reportPlayerKill(RAT);
  assert.deepEqual(setHudChips(o), [{ key: 'ward', set: 'orcsbane', name: 'Iron Hide', text: '10', state: 'active' }]);
  setDamageMod(o, 10);
  at(0.5);
  assert.deepEqual(setHudChips(o), [{ key: 'ward', set: 'orcsbane', name: 'Iron Hide', text: '1:00', state: 'recovering' }]);
  reportPlayerKill(RAT);
  at(61);
  reportPlayerKill(RAT);
  assert.equal(setPowerStates().ward, 10);
  const fourO = wearSet(player(), 'orcsbane', 4);
  assert.deepEqual(setHudChips(fourO), [], 'a ward left over from the six pieces shows nothing on four');
  assert.equal(setDamageMod(fourO, 5), 5, 'and turns nothing aside');
  fresh(); online(1);
  door([{ name: 'killed', entity: RAT, ai: { feet: [1, 0, 0] }, dead: false }, foe('next', 4)], { me: t });
  reportPlayerKill(RAT);
  assert.ok(markedFoe());
  assert.deepEqual(setHudChips(wearSet(player(), 'thieftaker', 4)), [], 'a mark left over from the six pieces shows nothing on four');
  fresh(); online(1);
  const four = wearSet(player(), 'orcsbane', 4);
  door([], { me: four });
  blow(four, 3);
  assert.deepEqual(setHudChips(four), [], 'four pieces: no chip');
  const st = setPowerStates();
  assert.equal(st.blood, 1);
  assert.equal(st.bloodLeft, BLOOD_SECONDS);
});

test('RAID4b every raid power sleeps with the sets - offline, in a duel - and for anyone but me (mutants: a raid power awake while the sets sleep)', () => {
  fresh();
  const e = wearSet(player(), 'oath', 6);
  e.health = 10;
  blow(e, 1);
  assert.equal(weaponBlowMods(sword(), 100, e, RAT), 100, 'offline: no Riposte');
  assert.equal(setDamageMod(e, 100), 100, 'offline: no Hold the Line');
  online(1);
  setSetsDueling(true);
  assert.equal(awakeTiersOf(e), null);
  assert.equal(setDamageMod(e, 100), 100, 'in a duel');
  setSetsDueling(false);
  assert.equal(setDamageMod({ ...e, peer: 'p1' }, 100), 100, 'a peer\'s entity');
  assert.equal(setBlow(sword(), 100, { ...e, peer: 'p1' }, RAT, {}), 100);
});

test('RAID4b the records: twenty-seven, nine a set in the places\' order - the seven body pieces, the set\'s shield and its ONE-HANDED weapon (so all nine are worn at once) - each of its party\'s make (the knights\' Mithril, the bandits\' Elven, the orcs\' Orcish), three affixes at the Legendary band\'s FLOOR, a weapon\'s blow at its floor too, a line of plain lore; every id its own among every Aetheric record, and the Regalia as it was (mutants: an affix at the top; a raid weapon at the top blow; a record of the wrong make)', () => {
  assert.equal(RAID_SET_PIECES.length, 27);
  // PIN MOVED (SERPENT-SET): the Regalia, then the raiding parties' - then the Old Coil's own (test/serpentset.test.js)
  assert.deepEqual(AETHERIC_RECORDS.slice(0, REGALIA.length + RAID_SET_PIECES.length), [...REGALIA, ...RAID_SET_PIECES]);
  assert.equal(new Set(AETHERIC_RECORDS.map((r) => r.id)).size, AETHERIC_RECORDS.length, 'every id its own');
  assert.equal(RAID_SET_POWER, SIGIL_BANDS.legendary[0]);
  assert.equal(RAID_SET_POWER, 7);
  const own = { oath: ['Mithril', 111, 120], thieftaker: ['Elven', 109, 119], orcsbane: ['Orcish', 110, 124] };
  for (const [set, [make, shield, weapon]] of Object.entries(own)) {
    const recs = RAID_SET_PIECES.filter((r) => r.set === set);
    assert.equal(recs.length, SET_PLACES.length, set);
    assert.deepEqual(recs.map((r) => r.templateIndex), [...BODY, shield, weapon], `${set}: the places' order`);
    assert.deepEqual(raidSetPieces(SIGIL_SETS[set].raid), recs);
    for (const r of recs) {
      assert.equal(r.make, make, r.id);
      assert.equal(r.affixes.length, 3, r.id);
      assert.equal(new Set(r.affixes.map((a) => `${a.id}:${a.param ?? ''}`)).size, 3, `${r.id}: no kind and param twice`);
      for (const a of r.affixes) {
        assert.ok(validAffix(a), `${r.id}: ${JSON.stringify(a)}`);
        assert.equal(a.value, AFFIX_RANGES[a.id].legendary[0], `${r.id}: ${a.id} at the band's floor`);
      }
      assert.ok(r.affixes.some((a) => a.id === (r.group === 'Weapons' ? 'damage' : 'armor')), `${r.id}: its group's own number`);
      assert.match(r.lore, /^[\x20-\x7e]{21,}$/, `${r.id}: plain lore`);
      assert.equal(aethericById(r.id), r);
      if (r.group === 'Weapons') assert.equal(r.power, RAID_SET_POWER, r.id);
    }
  }
  assert.deepEqual([3, undefined].map((p) => raidSetPieces(p)), [[], []]);
  for (const r of REGALIA) { assert.equal(r.make, 'Daedric', r.id); assert.equal(r.set, 'ruhn'); }
  assert.equal(aethericById('ruhn-gatecleaver').power, SIGIL_POWER_MAX, 'the Gatecleaver keeps the widest band\'s top blow');
});

test('RAID4b the mint: each raid record made an item of its own make by the game\'s minters - whole, known, Aetheric, its affixes a copy, its set\'s sigil fresh at Faint (a weapon\'s with its blow), its price its make\'s, its affixes\' and the rung\'s - a valid loot item on the wire, and all nine of a set worn at once (mutants: the make ignored; the Regalia\'s blow on a raid weapon)', () => {
  fresh(); online(1);
  const e = player();
  for (const r of RAID_SET_PIECES) {
    const it = mintAetheric(r);
    assert.equal(it.name, r.name);
    assert.equal(it.material, r.group === 'Weapons' ? WEAPON_MATERIALS[r.make] : ARMOR_MATERIAL[r.make], `${r.id}: ${r.make}`);
    assert.equal(it.material, aethericMaterial(r));
    assert.equal(it.rarity, 'aetheric');
    assert.equal(it.aetheric, r.id);
    assert.equal(it.isIdentified, true);
    assert.ok(it.maxCondition > 0 && it.currentCondition === it.maxCondition, `${r.id}: whole`);
    assert.deepEqual(it.affixes, r.affixes.map((a) => ({ ...a })));
    assert.notEqual(it.affixes[0], r.affixes[0], 'a copy');
    assert.deepEqual(it.sigil, r.group === 'Weapons' ? { power: RAID_SET_POWER, set: r.set, party: 1, xp: 0 } : { set: r.set, party: 1, xp: 0 });
    assert.equal(it.value, itemBaseValue({ ...it, value: undefined }) + affixesWorth(it.affixes) + AETHERIC_WORTH, `${r.id}: its price`);
    assert.ok(validLootItem(JSON.parse(JSON.stringify(it))), `${r.id}: on the wire`);
    if (r.group === 'Weapons') assert.equal(getItemHands(it), ITEM_HANDS.Either, `${r.id}: one hand, beside its shield`);
  }
  for (const r of RAID_SET_PIECES.filter((x) => x.set === 'orcsbane')) { const it = mintAetheric(r); e.items.push(it); equipItem(e, it); }
  assert.equal(wornSetPieces(e).get('orcsbane')?.length, 9, 'all nine places at once');
  assert.deepEqual(setState('orcsbane', wornSetPieces(e).get('orcsbane'), 1).tiers.map((t) => t.awake), [true, true, true]);
});

test('RAID4b the wire\'s marks (AUDIT SET D6, widened): a raid set\'s sigil only on an Aetheric piece; an Aetheric raid piece only of its record\'s make; and an Aetheric piece\'s sigil its own record\'s set - never another\'s (mutants: a raid sigil on a Rare piece; a Daedric Oathkeeper\'s Helm; the Oathkeeper\'s Helm wearing Ruhn\'s sigil)', () => {
  const wire = (it) => validLootItem(JSON.parse(JSON.stringify(it)));
  const helm = mintAetheric(aethericById('oath-helm'));
  assert.ok(wire(helm));
  const rare = piece(107, 'oath');
  assert.equal(wire(rare), null, 'the Broken Oath\'s sigil on a Rare helm');
  assert.equal(wire({ ...piece(107, 'ruhn') }), null, 'the Regalia\'s rule as it was');
  assert.ok(wire(piece(107, 'malacath')), 'a world set\'s sigil on a Rare piece is a world set piece');
  assert.equal(wire({ ...helm, material: ARMOR_MATERIAL.Daedric }), null, 'the Oathkeeper\'s Helm is Mithril');
  assert.equal(wire({ ...helm, sigil: { set: 'ruhn', party: 1, xp: 0 } }), null, 'another Aetheric set\'s sigil');
  assert.equal(wire({ ...helm, sigil: { set: 'malacath', party: 1, xp: 0 } }), null, 'a world set\'s sigil on an Aetheric piece');
  assert.ok(wire({ ...helm, sigil: { set: 'oath', party: 1, xp: XP[2] } }), 'its own set, grown');
  const saber = mintAetheric(aethericById('thieftaker-saber'));
  assert.equal(wire({ ...saber, material: WEAPON_MATERIALS.Daedric }), null, 'the Reeve\'s Warrant is Elven');
  assert.equal(validSetMarks({ ...helm, sigil: { set: 'thieftaker', party: 1, xp: 0 } }), null);
});

test('RAID4b the set piece\'s roll, a town\'s thanks\' last: RAID_SET_CHANCE of the time a piece of the PARTY\'S own set, the same seed choosing which - one roll when none comes, none at all for a party no set names (mutants: the chance inverted; another party\'s set; the last record unreachable)', () => {
  assert.equal(RAID_SET_CHANCE, 1 / 4);
  assert.equal(rollRaidSetPiece(0, seq(RAID_SET_CHANCE)), null, 'a quarter is not under a quarter');
  let n = 0;
  assert.equal(rollRaidSetPiece(1, () => { n++; return 0.9; }), null);
  assert.equal(n, 1, 'one roll when none comes');
  assert.equal(rollRaidSetPiece(0, seq(0.2499, 0)).aetheric, 'oath-helm');
  assert.equal(rollRaidSetPiece(1, seq(0, 0.9999)).aetheric, 'thieftaker-saber', 'the last record reachable');
  assert.equal(rollRaidSetPiece(2, seq(0, 0.5)).aetheric, 'orcsbane-gauntlets', 'the fifth of nine');
  n = 0;
  assert.equal(rollRaidSetPiece(3, () => { n++; return 0; }), null);
  assert.equal(n, 0, 'no party, no roll');
});

test('RAID4b a town\'s thanks off the receipt\'s seed: gold RAID_SPOILS_GOLD_PER_LEVEL a level (a fifth either way), ONE piece Magic or better and known (never arrows), then the party\'s set piece when it comes, LAST; the same seed, level and party the same thanks; handed over items first, the gold last (mutants: the gold per level; the piece unknown; the set piece first; the party ignored)', () => {
  assert.equal(RAID_SPOILS_GOLD_PER_LEVEL, 80);
  assert.deepEqual(RAID_SPOILS_SOURCE, { kind: 'pile', tier: 12, luck: 50 });
  let sets = 0;
  const partyOf = new Map();
  for (let i = 1; i <= 400; i++) {
    const seed = Math.imul(i, 2654435761) >>> 0, party = i % 3, level = 1 + (i % 30);
    const s = rollRaidSpoils(seed, level, party);
    assert.ok(s.gold >= Math.floor(80 * level * 0.8) && s.gold <= Math.ceil(80 * level * 1.2), `gold ${s.gold} at ${level}`);
    const [first, ...rest] = s.pieces;
    assert.ok(RARITIES[first.item.rarity]?.rank >= RARITIES.magic.rank && first.item.rarity !== 'aetheric', `Magic or better: ${first.item.rarity}`);
    assert.equal(first.tier, first.item.rarity, 'its tier read back off the item');
    assert.equal(first.item.isIdentified, true, 'known');
    assert.ok(!isAmmunition(first.item), 'no arrows');
    assert.ok(rest.length <= 1);
    if (rest.length) {
      sets++;
      assert.equal(rest[0].tier, 'aetheric');
      assert.equal(rest[0].item.sigil.set, raidSetOf(party).id, 'the party\'s own set');
      partyOf.set(party, rest[0].item.sigil.set);
    }
    assert.equal(JSON.stringify(rollRaidSpoils(seed, level, party)), JSON.stringify(s), 'the same seed, the same thanks');
  }
  assert.ok(sets > 60 && sets < 140, `about a quarter carry a set piece (${sets} of 400)`);
  assert.deepEqual([...partyOf.keys()].sort(), [0, 1, 2]);
  const list = raidSpoilsList(12345, 10, 2);
  assert.deepEqual(list.map((p) => p.kind), [...list.slice(0, -1).map(() => 'item'), 'gold']);
  assert.equal(list.at(-1).tier, 'common');
  assert.equal(rollRaidSpoils(1, 0, 0).gold > 0, true, 'level floors at one');
  assert.equal(raidSpoilsDay('3:12:45'), 'raid:3:12:45');
});

test('RAID4b the spoils pool\'s own keys for a town\'s thanks: the grant rolls through the caller\'s roll and says its words, once a receipt and account; its record and its spent marks under RAID_SPOILS_KEYS, never the gate\'s; the hub told nothing; the crash\'s door asks the town\'s record by its key, and a save of its character clears it (mutants: the keys ignored; the roll asked for a spent receipt; the gate\'s words said)', () => {
  const mem = new Map();
  const store = { get: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null), set: (k, v) => mem.set(k, JSON.stringify(v)), remove: (k) => mem.delete(k), persisted: () => true };
  const taken = [], said = [];
  let rolled = 0;
  const spent = [];
  const pool = createSpoilsPool({ ray: () => null, now: () => 0, take: (p) => taken.push(p), say: (t) => said.push(t), store, who: () => 'char-1', keys: RAID_SPOILS_KEYS, wall: () => 1000 });
  const roll = () => { rolled++; return raidSpoilsList(99, 5, 0); };
  const day = raidSpoilsDay('3:12:45');
  assert.equal(pool.grant({ day, acct: 'acct-1', roll, text: RAID_SPOILS_TEXT.granted }), true);
  assert.equal(rolled, 1);
  assert.equal(taken.length, raidSpoilsList(99, 5, 0).length);
  assert.deepEqual(said, [RAID_SPOILS_TEXT.granted]);
  assert.ok(mem.has('raid4.spoils') && mem.has('raid4.spoilsDay'), 'the town\'s own keys');
  assert.ok(!mem.has(SPOILS_STORE_KEY) && !mem.has(SPOILS_DAY_KEY), 'never the gate\'s');
  assert.deepEqual(store.get('raid4.spoilsDay'), ['raid:3:12:45:acct-1']);
  assert.equal(pool.grant({ day, acct: 'acct-1', roll, text: RAID_SPOILS_TEXT.granted }), false, 'once a receipt');
  assert.equal(rolled, 1, 'a spent receipt rolls nothing');
  assert.equal(pool.grant({ day, acct: 'acct-2', roll, text: RAID_SPOILS_TEXT.granted }), true, 'another account on this device has its own');
  assert.deepEqual(spent, []);
  assert.deepEqual(SPOILS_KEYS, { store: SPOILS_STORE_KEY, day: SPOILS_DAY_KEY }, 'a boss\'s pool keeps the gate\'s keys');
  // the crash's door, by the town's key: handed back until a save holds them
  const back = [];
  assert.equal(recoverSpoils(store, (p) => back.push(p), { who: 'char-1', key: RAID_SPOILS_KEYS.store }), raidSpoilsList(99, 5, 0).length, 'one record a raid and character (AUDIT WB A7\'s law), handed back whole');
  assert.equal(recoverSpoils(store, () => {}, { who: 'char-1' }), 0, 'the gate\'s key holds none of it');
  assert.equal(pool.saved('char-1'), 1, 'a save of the character clears it');
  assert.equal(store.get('raid4.spoils'), null);
  // and a gate pool beside it keeps its own words and keys
  const gate = createSpoilsPool({ ray: () => null, now: () => 0, take: () => {}, say: (t) => said.push(t), store, who: () => 'char-1', onSpent: (d) => spent.push(d) });
  assert.equal(gate.grant({ day: 7, seed: 5, level: 3, acct: 'acct-1' }), true);
  assert.equal(said.at(-1), SPOILS_TEXT.granted);
  assert.deepEqual(spent, [7]);
  assert.deepEqual(store.get(SPOILS_DAY_KEY), ['7:acct-1']);
  assert.deepEqual(store.get('raid4.spoilsDay'), ['raid:3:12:45:acct-1', 'raid:3:12:45:acct-2'], 'the town\'s marks untouched');
});

test('RAID4b the host: world.js rolls a town\'s thanks off each raid receipt - AUDIT RAID R4: when the account service says the claim is the (raid, account)\'s - its raid, seed, party and account, at the level it was fought at, into the pack of the character that fought it (else kept for it), one tab at a time - through a pool of the town\'s own keys that tells the hub nothing, clears on a save and is asked at the crash\'s door by its key; the new powers\' sounds (mutants: the receipt never granted; the town\'s pool on the gate\'s keys; the save never clearing it; the crash\'s door never asked)', () => {
  const w = strip(read('src/scenes/world.js'));
  assert.match(w, /onRaidReceipt: \(r\) => \{ raidClaims\?\.add\(r, characterIdOf\(playerEntity\), [^;]+\); \},/);
  assert.match(w, /onSpoils: \(entry\) => grantRaidSpoils\(entry\),/);
  assert.match(w, /function grantRaidSpoils\(entry\) \{\s*const c = readRaidReceipt\(entry\?\.r\);\s*if \(!c\) return;\s*const level = Math\.max\(1, Math\.floor\(Number\(entry\.lv\) \|\| playerEntity\.level \|\| 1\)\);\s*spoilsLock\(\(\) => raidSpoils\.grant\(\{ day: raidSpoilsDay\(c\.w\), acct: c\.s, roll: \(\) => raidSpoilsList\(c\.c, level, c\.y\), text: RAID_SPOILS_TEXT\.granted,\s*owner: entry\.ch, kept: RAID_SPOILS_TEXT\.kept\(entry\.nm\) \}\)\)/);
  assert.match(w, /const raidSpoils = createSpoilsPool\(\{\s*ray: \(\) => null, now: [^\n]+\n\s*store: _spoilsStore, who: \(\) => characterIdOf\(playerEntity\), keys: RAID_SPOILS_KEYS, recordsMax: RAID_SPOILS_RECORDS_MAX,/);
  assert.doesNotMatch(w.slice(w.indexOf('const raidSpoils = createSpoilsPool('), w.indexOf('const raidSpoils = createSpoilsPool(') + 400), /onSpent/, 'the hub never kept a raid\'s receipt');
  assert.match(w, /onSlotSaved\(\(characterId\) => \{ try \{ raidSpoils\.saved\(characterId\); \}/);
  assert.match(w, /recoverSpoils\(_spoilsStore, takeSpoil, \{ who, saves: enumerateSaves\(\)\.info\.values\(\), onHanded: \(rec\) => raidSpoils\.adopt\(rec\), key: RAID_SPOILS_KEYS\.store, inSave: _spoilsInSave \}\)\) setMidScreenText\(RAID_SPOILS_TEXT\.recovered\);/);   // AUDIT RESCUE-SAVE A1: and the kept save's records adopted, never handed twice
  assert.match(w, /else if \(name === 'mark'\) audio\.playOneShot\(SOUND\.DrawWeapon, 1\);\s*else if \(name === 'ward'\) audio\.playOneShot\(SOUND\.EquipMaceOrHammer, 1\);/);
  assert.match(strip(read('src/systems/raidingParties.js')), /host\(\)\.onRaidReceipt\?\.\(f\.r, c\);/, 'the raid module hands the host each receipt');
});
