// SD9d (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 11): THE BRASS OF NUMIDIUM -
// the Brass Remnant's own Aetheric set (systems/sigilSets.js 'numidium', systems/aetheric.js NUMIDIUM_SET_PIECES): its
// law, its nine records of Dwarven brass at the Legendary band's top, the spoils' last roll that carries one a third of
// the time, and its three tiers through the powers' seams (systems/sigilSetPowers.js) - Dwemer Brass (magic and shock
// resistance), Gearward (a foe's blow lighter while the gear is wound) and The Hour Turns (a death turned back, healed).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setRound, setPowerStates, setHudChips, setSetPowersVoice, awakeTiersOf, setStruck, _setSetPowersClockForTests, _resetSetPowersForTests } from '../src/systems/sigilSetPowers.js';
import { setSigilOnline, setSigilRenown, SIGIL_STAGES, SIGIL_SET_IDS, SIGIL_POWER_MAX, _resetSigilForTests } from '../src/systems/sigil.js';
import { WORLD_SET_IDS, BRIEF_MAX, SET_STAGE_MAX, setById, raidSetOf, tierValues, setSetsDueling, _resetSigilSetsForTests } from '../src/systems/sigilSets.js';
import {
  AETHERIC_RECORDS, REGALIA, RAID_SET_PIECES, SERPENT_SET_PIECES, NUMIDIUM_SET_PIECES, NUMIDIUM_SET_CHANCE, aethericById, aethericMaterial,
  mintAetheric, rollNumidiumPiece, validSetMarks, AETHERIC,
} from '../src/systems/aetheric.js';
import { brokerStock } from '../src/systems/sigilBroker.js';
import { _resetPlayerHealForTests } from '../src/systems/playerHeal.js';
import { entityStatMod, entityModsOf } from '../src/systems/entityMods.js';
import { hurtPlayer } from '../src/characters/playerEntity.js';
import { setPlayerDoor } from '../src/systems/playerDoor.js';
import { equipItem } from '../src/systems/equip.js';
import { mintCondition } from '../src/systems/itemTemplates.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { WEAPON_MATERIALS } from '../src/characters/weapons.js';
import { WEAPON_HANDS } from '../src/characters/equipRules.js';
import { SKILLS } from '../src/systems/skills.js';
import { AFFIX_RANGES } from '../src/systems/lootRarity.js';
import { validLootItem } from '../src/systems/loot.js';
import { HOUR_BRASS } from '../src/ui/playerBadge.js';
import { SD_HALL_SOUNDS } from '../src/scenes/sdHall.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = () => ({
  isPlayer: true, items: [], stats: stats(), skills: new Array(35).fill(30), level: 5, career: {}, activeEffects: [],
  health: 100, maxHealth: 100, magicka: 0, maxMagicka: 1000, armorValues: new Array(7).fill(100),
});
const BODY = [107, 106, 105, 102, 103, 104, 108];
const XP = SIGIL_STAGES.map((s) => s.xp);
const piece = (templateIndex, set, xp = 0) => {
  const it = mintCondition({ group: 'Armor', templateIndex, material: ARMOR_MATERIAL.Steel, flags: 0 });
  it.rarity = 'rare';
  it.sigil = { set, party: 1, xp };
  return it;
};
const wearSet = (e, set, n, xp = 0) => { for (const t of BODY.slice(0, n)) { const it = piece(t, set, xp); e.items.push(it); equipItem(e, it); } return e; };
const RAT = Object.freeze({ name: 'rat' });
let T = 0;
_setSetPowersClockForTests(() => T);
const at = (t) => { T = t; };
function fresh() {
  _resetSigilForTests(); _resetSigilSetsForTests(); _resetSetPowersForTests(); _resetPlayerHealForTests(); setPlayerDoor(null); at(0);
  const v = { said: [], sounds: [] };
  setSetPowersVoice({ say: (l) => v.said.push(l), sound: (n) => v.sounds.push(n) });
  return v;
}
const online = (renown = 1) => { setSigilOnline(true); setSigilRenown(renown); };
/** A foe's blow at me as the game deals one: the formula's struck tail marks it, then my damage door takes it. */
const blow = (e, n, attacker = RAT) => { setStruck(attacker, e, n); return hurtPlayer(e, n); };
const door = (me) => setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {}, player: () => me });
const seq = (...xs) => { let i = 0; return () => xs[Math.min(i++, xs.length - 1)]; };

// ── the law and the records ───────────────────────────────────────────

test('SD9d THE LAW: The Brass of Numidium after the serpent\'s - Aetheric, Kagrenac its patron, the Hourbreaker\'s brass its colour, no raiding party\'s, never a world set; Dwemer Brass, Gearward and The Hour Turns at 2, 4 and 6 pieces, each a whole pair from Faint to Ascendant, every brief inside BRIEF_MAX at every stage (mutants: a tier\'s number; a world set)', () => {
  assert.deepEqual(SIGIL_SET_IDS.slice(-1), ['numidium'], 'the Brass Remnant\'s own, last');
  const s = setById('numidium');
  assert.deepEqual([s.id, s.name, s.prince, s.colour, s.aetheric, 'raid' in s, s.role],
    ['numidium', 'The Brass of Numidium', 'Kagrenac', '#b5862f', true, false, 'What the Warp kept of the Walking Brass']);
  assert.equal(s.colour, `#${HOUR_BRASS.slice(0, 3).map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('')}`, 'the Hourbreaker\'s brass');
  assert.ok(!WORLD_SET_IDS.includes('numidium'), 'no world drop rolls it');
  assert.ok(![0, 1, 2].some((p) => raidSetOf(p)?.id === 'numidium'), 'no raiding party pays it');
  assert.deepEqual(s.tiers.map((t) => [t.at, t.key, t.name, t.values]), [
    [2, 'dwemer-brass', 'Dwemer Brass', { magic: [4, 10], shock: [4, 10] }],
    [4, 'gearward', 'Gearward', { lighter: [15, 30], recover: [18, 12] }],
    [6, 'hour-turns', 'The Hour Turns', { heal: [15, 25], recover: [90, 60] }],
  ]);
  for (const t of s.tiers) for (let st = 0; st <= SET_STAGE_MAX; st++) { const b = t.brief(tierValues(t, st)); assert.ok(b.length <= BRIEF_MAX, `${t.key} at ${st}: "${b}"`); }
  assert.deepEqual(s.tiers.map((t) => t.brief(tierValues(t, SET_STAGE_MAX))), ['+10 magic, +10 shock resist', 'A foe\'s blow 30% lighter', 'Death turned back, heal 25%']);
  assert.equal(s.tiers[1].text(tierValues(s.tiers[1], 0)), 'The gear catches the next foe\'s blow that lands on you: it is 15% lighter, and the gear winds again. Recovers in 18 s');
});

test('SD9d THE RECORDS: nine in the places\' order - the seven body pieces, a round shield and a ONE-HANDED Longsword (all nine worn at once) - Dwarven, the Dwemer\'s brass; every affix at the Legendary band\'s TOP (the Regalia\'s), the blow the sigil\'s greatest; never a magic or shock resistance (the 2-piece tier\'s) and one of an element at most; AETHERIC_RECORDS ends with them (mutants: a number off the top; a doubled element; the make; the order)', () => {
  assert.equal(NUMIDIUM_SET_PIECES.length, 9);
  assert.deepEqual(NUMIDIUM_SET_PIECES.map((r) => [r.id, r.group, r.templateIndex]), [
    ['numidium-visage', 'Armor', 107], ['numidium-right-pauldron', 'Armor', 106], ['numidium-left-pauldron', 'Armor', 105],
    ['numidium-heartcage', 'Armor', 102], ['numidium-hands', 'Armor', 103], ['numidium-greaves', 'Armor', 104],
    ['numidium-boots', 'Armor', 108], ['numidium-gear-face', 'Armor', 110], ['numidium-hour-hand', 'Weapons', 120],
  ]);
  assert.equal(WEAPON_HANDS['120'], 'Either', 'the Longsword is one-handed - the shield beside it');
  for (const r of NUMIDIUM_SET_PIECES) assert.deepEqual([r.set, r.make], ['numidium', 'Dwarven'], r.id);
  assert.equal(aethericById('numidium-hour-hand').power, SIGIL_POWER_MAX);
  const top = (id) => AFFIX_RANGES[id].legendary[1];
  for (const r of NUMIDIUM_SET_PIECES) for (const a of r.affixes) assert.equal(a.value, top(a.id), `${r.id} ${a.id}`);
  assert.deepEqual(NUMIDIUM_SET_PIECES.map((r) => r.affixes.map((a) => a.param ?? a.id)), [
    ['armor', 'intelligence', 'fire'], ['armor', 'strength', SKILLS.LongBlade], ['armor', 'endurance', 'frost'],
    ['armor', 'willpower', SKILLS.Mysticism], ['armor', 'agility', SKILLS.CriticalStrike], ['armor', 'speed', 'poison'],
    ['armor', 'luck', SKILLS.Jumping], ['armor', 'endurance', 'weight'], ['damage', 'strength', SKILLS.LongBlade],
  ]);
  const resists = NUMIDIUM_SET_PIECES.flatMap((r) => r.affixes.filter((a) => a.id === 'resist').map((a) => a.param));
  assert.ok(!resists.includes('magic') && !resists.includes('shock'), 'never magic or shock - Dwemer Brass carries them');
  assert.equal(new Set(resists).size, resists.length, 'one resistance of an element at most');
  assert.deepEqual(AETHERIC_RECORDS, [...REGALIA, ...RAID_SET_PIECES, ...SERPENT_SET_PIECES, ...NUMIDIUM_SET_PIECES]);
  assert.equal(new Set(AETHERIC_RECORDS.map((r) => r.id)).size, AETHERIC_RECORDS.length, 'every id its own');
});

test('SD9d MINTED AND CHECKED: each record mints as its make - Dwarven armour, a Dwarven Longsword - Aetheric, known, its set\'s sigil fresh at Faint (the Hour-Hand\'s with its blow), and passes the wire\'s check; an affix past its record, another set\'s sigil or another make is no item (mutants: the material; the check\'s ceiling)', () => {
  for (const r of NUMIDIUM_SET_PIECES) {
    const it = mintAetheric(r);
    assert.deepEqual([it.name, it.rarity, it.aetheric, it.isIdentified], [r.name, AETHERIC, r.id, true], r.id);
    assert.equal(it.material, aethericMaterial(r), r.id);
    assert.deepEqual(it.sigil, r.group === 'Weapons' ? { power: SIGIL_POWER_MAX, set: 'numidium', party: 1, xp: 0 } : { set: 'numidium', party: 1, xp: 0 });
    assert.ok(validLootItem(JSON.parse(JSON.stringify(it))), `${r.id} off the wire`);
  }
  assert.equal(mintAetheric(aethericById('numidium-hour-hand')).material, WEAPON_MATERIALS.Dwarven);
  assert.equal(mintAetheric(aethericById('numidium-heartcage')).material, ARMOR_MATERIAL.Dwarven);
  const over = mintAetheric(aethericById('numidium-visage'));
  over.affixes[2].value = 51;
  assert.equal(validSetMarks(over), null, 'a resistance past the band is a forgery');
  const theirs = mintAetheric(aethericById('numidium-greaves'));
  theirs.sigil.set = 'coilscale';
  assert.equal(validSetMarks(theirs), null, 'another set\'s sigil on a Numidium piece');
  const steel = mintAetheric(aethericById('numidium-boots'));
  steel.material = ARMOR_MATERIAL.Steel;
  assert.equal(validSetMarks(steel), null, 'another make');
});

test('SD9d THE DROP: a third of the Remnant\'s spoils, the same seed choosing which - one roll when nothing drops, two when a piece does; never on a world drop or the Broker\'s shelf (mutants: the chance; the pick)', () => {
  assert.equal(NUMIDIUM_SET_CHANCE, 1 / 3);
  let calls = 0;
  const counted = (...xs) => { const r = seq(...xs); return () => { calls++; return r(); }; };
  assert.equal(rollNumidiumPiece(counted(1 / 3)), null, 'not under the line');
  assert.equal(calls, 1, 'one roll when nothing drops');
  calls = 0;
  assert.equal(rollNumidiumPiece(counted(0.3, 0.5)).aetheric, 'numidium-hands');
  assert.equal(calls, 2, 'two when a piece does');
  assert.equal(rollNumidiumPiece(seq(0.33, 0.9999)).aetheric, 'numidium-hour-hand');
  assert.equal(rollNumidiumPiece(seq(0, 0)).aetheric, 'numidium-visage');
  for (let d = 0; d < 60; d++) assert.ok(!brokerStock(d).some((o) => o.set === 'numidium' || o.item?.sigil?.set === 'numidium'), `day ${d}: the Broker never shelves it`);
});

// ── the tiers ─────────────────────────────────────────────────────────

test('SD9d DWEMER BRASS (2): one fold over RF1\'s channels - magic and shock resistance, Faint to Ascendant; nothing with one piece, nothing asleep (mutants: an element; a stage)', () => {
  fresh(); online(1);
  assert.deepEqual(entityModsOf(wearSet(player(), 'numidium', 1)).resist, {}, 'one piece wakes nothing');
  const e = wearSet(player(), 'numidium', 2);
  assert.deepEqual(entityModsOf(e).resist, { magic: 4, shock: 4 }, 'Faint: +4 each');
  assert.equal(entityStatMod(e, 'endurance'), 0, 'resistances alone');
  fresh(); online(40);
  assert.deepEqual(entityModsOf(wearSet(player(), 'numidium', 2, XP[4])).resist, { magic: 10, shock: 10 }, 'Ascendant: +10 each');
  fresh();
  assert.deepEqual(entityModsOf(wearSet(player(), 'numidium', 2)).resist, {}, 'offline the sets sleep');
});

test('SD9d GEARWARD (4): while the gear is wound a foe\'s blow lands its share lighter, in whole points, and the gear winds again - the next blow inside the winding lands whole; a fall or a spell (no foe\'s blow) is never lightened and never unwinds it; Ascendant, a lighter blow sooner; nothing with three pieces (mutants: the share; the winding; a fall lightened)', () => {
  const v = fresh(); online(1);
  const e = wearSet(player(), 'numidium', 4);
  door(e);
  at(10);
  blow(e, 40);
  assert.equal(e.health, 66, 'Faint: 15% of 40 is 6 - the blow lands 34');
  assert.deepEqual(v.sounds, ['gear'], 'the gear catches it');
  at(20);
  blow(e, 40);
  assert.equal(e.health, 26, 'wound again only at 28: this one lands whole');
  e.health = 100;
  at(30);
  hurtPlayer(e, 20);
  assert.equal(e.health, 80, 'a fall\'s hurt - no foe\'s blow - lands whole');
  blow(e, 30);
  assert.equal(e.health, 55, 'the gear still wound for the blow after it: 15% of 30 is 4.5 - whole points, 5 turned');
  assert.equal(setPowerStates(30).gearLeft, 18, 'winding again for 18 s');
  fresh(); online(40);
  const asc = wearSet(player(), 'numidium', 4, XP[4]);
  door(asc);
  at(5);
  blow(asc, 50);
  assert.equal(asc.health, 65, 'Ascendant: 30% of 50 is 15 - the blow lands 35');
  at(16);
  blow(asc, 10);
  assert.equal(asc.health, 55, 'wound at 17: whole');
  at(17);
  blow(asc, 10);
  assert.equal(asc.health, 48, 'wound: 3 of 10 turned');
  fresh(); online(1);
  const three = wearSet(player(), 'numidium', 3);
  door(three);
  blow(three, 40);
  assert.equal(three.health, 60, 'three pieces wake no Gearward');
});

test('SD9d THE HOUR TURNS (6): a blow that would kill me does not - the door leaves me at 1 and its share of my health returns at once, said; a fall\'s death too (a death save\'s law); then it recovers - a second death inside the recovery kills - says it is ready again, and shows its recovery as a chip; Ascendant heals more and recovers sooner; nothing with five pieces, nothing in a duel (mutants: the heal lost; the recovery; a heal at 0)', () => {
  const v = fresh(); online(1);
  const e = wearSet(player(), 'numidium', 6);
  door(e);
  at(10);
  const dead = blow(e, 150);
  assert.equal(dead, false, 'no death');
  assert.equal(e.health, 16, 'left at 1, and 15% of 100 back');
  assert.ok(v.said.includes('The Hour Turns! 15 health returns.'), v.said.join(' | '));
  assert.ok(v.sounds.includes('hour'));
  assert.deepEqual(setHudChips(e, 10).map((c) => [c.key, c.set, c.state, c.text]), [['hour', 'numidium', 'recovering', '1:30']]);
  assert.equal(setPowerStates(10).hourRecoverLeft, 90);
  at(40);
  assert.equal(blow(e, 150), true, 'recovering: a second death kills');
  assert.equal(e.health, 0);
  e.health = 100;
  at(101);
  setRound(e);
  assert.deepEqual(v.said.slice(-1), ['The Hour Turns is ready again.']);
  e.health = 10;
  hurtPlayer(e, 50);
  assert.equal(e.health, 16, 'a fall that would kill is turned back too');
  assert.equal(v.said.filter((l) => l.startsWith('The Hour Turns!')).length, 2, 'said each time');
  const w = fresh(); online(40);
  const asc = wearSet(player(), 'numidium', 6, XP[4]);
  door(asc);
  at(5);
  blow(asc, 500);
  assert.equal(asc.health, 26, 'Ascendant: a quarter back');
  assert.equal(setPowerStates(5).hourRecoverLeft, 60);
  assert.deepEqual(w.said, ['The Hour Turns! 25 health returns.']);
  fresh(); online(1);
  const five = wearSet(player(), 'numidium', 5);
  door(five);
  assert.equal(blow(five, 150), true, 'five pieces wake no Hour Turns');
  assert.deepEqual(awakeTiersOf(wearSet(player(), 'numidium', 5)).get('numidium').map((t) => t !== null), [true, true, false]);
  fresh(); online(1);
  const duel = wearSet(player(), 'numidium', 6);
  door(duel);
  setSetsDueling(true);
  assert.equal(awakeTiersOf(duel), null);
  assert.equal(blow(duel, 150), true, 'asleep in a duel');
  setSetsDueling(false);
});

// ── the host ──────────────────────────────────────────────────────────

test('SD9d THE HOST: world.js gives the Brass\'s powers the Orrery hall\'s own sounds through the voice\'s index door, as the hall plays them - the gear\'s clunk for Gearward, the low bell\'s toll for The Hour Turns (mutants: a power unvoiced; the sounds crossed)', () => {
  const w = strip(read('src/scenes/world.js'));
  assert.match(w, /import \{ SD_HALL_TEXT, SD_HALL_SOUNDS \} from '\.\/sdHall\.js';/);
  // PIN MOVED (AUDIT SD IV A3): the index door (playOneShot) - the ID door played whatever record carries the ID 433 or
  // 107, not the hall's records (sd26_audio runs the voice)
  assert.match(w, /else if \(name === 'gear'\) audio\.playOneShot\(SD_HALL_SOUNDS\.clunk, 1\);/);
  assert.match(w, /else if \(name === 'hour'\) audio\.playOneShot\(SD_HALL_SOUNDS\.toll, 1\);/);
  assert.deepEqual([SD_HALL_SOUNDS.clunk, SD_HALL_SOUNDS.toll], [433, 107], 'the hall\'s gear and its low bell');
});
