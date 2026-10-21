// EG15 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 19, THE BATTLEMAGE'S
// PANOPLY; section 15's death saves): the Spire's own Aetheric set (systems/sigil/sigilSets.js 'panoply', systems/aetheric.js
// PANOPLY_SET_PIECES): its law, its nine records of Mithril at the Legendary band's top under the pay law's own ids
// (net/eliteGates/egPay.js EG_PANOPLY_IDS), the item law that judges them, the pick a Redoubt's spoils and the Broker's sink mint by,
// and its three tiers through the powers' seams (systems/sigil/sigilSetPowers.js) - Battlemage's Bearing (every resistance and
// the maximum magicka, never in a save), Battlemage's Discipline (a cast arms the next weapon blow with its element; a
// weapon blow returns a share of the last spell's cost) and Battlemage's Reprieve (a shield under 20%, shared with the
// allies near) - and THE SPIRE'S RECOVERY: in an Elite Breach every death save recovers at the next Redoubt taken.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  setRound, setPowerStates, setHudChips, setSetPowersVoice, awakeTiersOf, setStruck, setBlow, setStrike, setHurt, setCast,
  setSetPowersAllies, setSpireRecovery, spireRedoubtTaken, reprieveBundle, eventideBundle, _setSetPowersClockForTests, _resetSetPowersForTests,
} from '../../../src/systems/sigil/sigilSetPowers.js';
import { setSigilOnline, setSigilRenown, SIGIL_STAGES, SIGIL_SET_IDS, SIGIL_POWER_MAX, _resetSigilForTests } from '../../../src/systems/sigil/sigil.js';
import {
  WORLD_SET_IDS, BRIEF_MAX, SET_STAGE_MAX, SET_PLACES, ROUND_SECONDS, REPRIEVE_BELOW, REPRIEVE_SECONDS, REPRIEVE_METRES, REPRIEVE_ALLY_SHARE,
  setById, raidSetOf, tierValues, setSetsDueling, _resetSigilSetsForTests,
} from '../../../src/systems/sigil/sigilSets.js';
import {
  AETHERIC_RECORDS, REGALIA, RAID_SET_PIECES, SERPENT_SET_PIECES, NUMIDIUM_SET_PIECES, PANOPLY_SET_PIECES, WYRD_SET_PIECES, STARSPUN_SET_PIECES, aethericById, aethericMaterial,
  mintAetheric, mintPanoplyPiece, panoplyPieceById, validSetMarks, AETHERIC,
} from '../../../src/systems/aetheric.js';
import { EG_PANOPLY_KEYS, EG_PANOPLY_IDS } from '../../../src/net/eliteGates/egPay.js';
import { brokerStock } from '../../../src/systems/sigil/sigilBroker.js';
import { itemFindings } from '../../../src/systems/item/itemLaw.js';
import { manaMine, _resetPlayerHealForTests } from '../../../src/systems/playerHeal.js';
import { registerPlayerCastListener, tellPlayerCast } from '../../../src/systems/playerCasts.js';
import { entityModsOf, entityResistMod, computeEntityMods, EMPTY_MODS, newMods, registerEntityFold, weaponBlowMods } from '../../../src/systems/entityMods.js';
import { foldMpOf, onlineMpOf, offlineVitals } from '../../../src/systems/renownLayer.js';
import { defineLiveMaxMagicka } from '../../../src/systems/chargen.js';
import { snapshotPlayer } from '../../../src/systems/save/save.js';
import { passiveSpecialsMagicRound, setPassiveSpecialsHost } from '../../../src/systems/passiveSpecials.js';
import { hurtPlayer, registerPlayerDeathSave } from '../../../src/characters/playerEntity.js';
import { setPlayerDoor } from '../../../src/systems/playerDoor.js';
import { equipItem } from '../../../src/systems/equip.js';
import { mintCondition } from '../../../src/systems/item/itemTemplates.js';
import { ARMOR_MATERIAL } from '../../../src/systems/armorMaterials.js';
import { WEAPON_MATERIALS } from '../../../src/characters/weapons.js';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';
import { WEAPON_HANDS } from '../../../src/characters/equipRules.js';
import { SKILLS } from '../../../src/systems/skills.js';
import { AFFIX_RANGES, RESIST_ELEMENTS, LOOT_RARITY_KEY } from '../../../src/systems/loot/lootRarity.js';
import { setPref, _resetForTests as resetPrefs } from '../../../src/systems/uiPrefs.js';
import { validLootItem } from '../../../src/systems/loot/loot.js';
import { EFFECT_FLAGS } from '../../../src/systems/spellcast.js';
import { allyCastable, strangerCastable, allyCastFrame, allyCastSpell } from '../../../src/systems/allyCast.js';
import { validCastData, CAST_SETTING_MAX } from '../../../src/net/wire.js';
import { applySpell } from '../../../src/systems/effects.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = () => ({
  isPlayer: true, items: [], stats: stats(), skills: new Array(35).fill(30), level: 5, career: {}, activeEffects: [],
  health: 100, maxHealth: 100, magicka: 0, maxMagicka: 1000, armorValues: new Array(7).fill(100),
});
const BODY = [107, 106, 105, 102, 103, 104, 108];
const XP = SIGIL_STAGES.map((s) => s.xp);
/** Another set's piece, as SD9d's suite wears one (the powers read the sigil's set alone). */
const piece = (templateIndex, set, xp = 0) => {
  const it = mintCondition({ group: 'Armor', templateIndex, material: ARMOR_MATERIAL.Steel, flags: 0 });
  it.rarity = 'rare';
  it.sigil = { set, party: 1, xp };
  return it;
};
const wearSet = (e, set, n, xp = 0) => { for (const t of BODY.slice(0, n)) { const it = piece(t, set, xp); e.items.push(it); equipItem(e, it); } return e; };
/** THE PANOPLY AS THE GAME MINTS IT (TEST THE SHAPE THE PRODUCER MINTS): its first `n` records in the places' order - the
 *  body pieces, then the Spire-Shield, then the Spire-Saber - each grown to `xp`, worn. */
const wearPanoply = (e, n, xp = 0) => {
  for (const r of PANOPLY_SET_PIECES.slice(0, n)) { const it = mintAetheric(r); it.sigil = { ...it.sigil, xp }; e.items.push(it); equipItem(e, it); }
  return e;
};
const RAT = Object.freeze({ name: 'rat' });
let T = 0;
_setSetPowersClockForTests(() => T);
const at = (t) => { T = t; };
function fresh() {
  _resetSigilForTests(); _resetSigilSetsForTests(); _resetSetPowersForTests(); _resetPlayerHealForTests(); setPlayerDoor(null); at(0);
  resetPrefs(); setPref(LOOT_RARITY_KEY, false);   // the affixes' own fold off: every number below is the set's alone
  const v = { said: [], sounds: [] };
  setSetPowersVoice({ say: (l) => v.said.push(l), sound: (n) => v.sounds.push(n) });
  return v;
}
const online = (renown = 1) => { setSigilOnline(true); setSigilRenown(renown); };
/** A foe's blow at me as the game deals one: the formula's struck tail marks it, then my damage door takes it. */
const blow = (e, n, attacker = RAT) => { setStruck(attacker, e, n); return hurtPlayer(e, n); };
const door = (me) => setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {}, player: () => me });
const seq = (...xs) => { let i = 0; return () => xs[Math.min(i++, xs.length - 1)]; };
const saber = () => createWeapon(119, WEAPON_MATERIALS.Steel);
const FIRE = { name: 'Fireball', element: 0 }, FROST = { name: 'Frostbite', element: 1 }, POISON = { name: 'Venom', element: 2 }, MAGIC = { name: 'Magicka Bolt', element: 4 };

// ── the law and the records ───────────────────────────────────────────

test('EG15 THE LAW: The Battlemage\'s Panoply after the Brass - Aetheric, the Imperial Battlemages its patron, Battlemage blue its colour, no raiding party\'s, never a world set; Bearing, Discipline and Reprieve at 2, 4 and 6 pieces with the design\'s numbers Faint to Ascendant, every brief inside BRIEF_MAX at every stage, plain, no recovery in its words (mutants: a tier\'s number; a world set; the colour)', () => {
  assert.deepEqual(SIGIL_SET_IDS.slice(-3), ['panoply', 'wyrd', 'starspun'], 'the Spire\'s own - PIN MOVED (WITCH1): the Wyrd\'s Raiment after it - PIN MOVED (STAR7): the Starspun Weave after that');
  const s = setById('panoply');
  assert.deepEqual([s.id, s.name, s.prince, s.colour, s.aetheric, 'raid' in s, s.role],
    ['panoply', 'The Battlemage\'s Panoply', 'The Imperial Battlemages', '#5c7cc4', true, false, 'What the Kyn took from the Battlemages']);
  assert.equal(s.colour, `#${[92, 124, 196].map((x) => x.toString(16).padStart(2, '0')).join('')}`, 'Battlemage blue (Elite-Gates.md section 25.2)');
  assert.ok(!WORLD_SET_IDS.includes('panoply'), 'no world drop rolls it');
  assert.ok(![0, 1, 2, 3].some((p) => raidSetOf(p)?.id === 'panoply'), 'no raiding party pays it');
  assert.deepEqual(s.tiers.map((t) => [t.at, t.key, t.name, t.values]), [
    [2, 'battlemages-bearing', 'Battlemage\'s Bearing', { resist: [5, 15], magicka: [10, 30] }],
    [4, 'battlemages-discipline', 'Battlemage\'s Discipline', { armed: [20, 50], refund: [5, 15] }],
    [6, 'battlemages-reprieve', 'Battlemage\'s Reprieve', { shield: [15, 40], recover: [240, 120] }],
  ]);
  for (const t of s.tiers) {
    for (let st = 0; st <= SET_STAGE_MAX; st++) {
      const v = tierValues(t, st), b = t.brief(v);
      assert.ok(b.length <= BRIEF_MAX, `${t.key} at ${st}: "${b}"`);
      assert.match(b, /^[\x20-\x7e]+$/);
      assert.doesNotMatch(b, /[Rr]ecover|\bevery \d/);
    }
  }
  assert.deepEqual(s.tiers.map((t) => t.brief(tierValues(t, SET_STAGE_MAX))), ['+15 all resists, +30 magicka', 'Cast arms blow +50%, 15% MP back', 'Under 20%: shield 40% of HP']);
  assert.deepEqual(s.tiers.map((t) => t.text(tierValues(t, 0))), [
    '+5 to every resistance, +10 magicka',
    'Casting a spell adds its element to your next weapon hit for 20% more damage. Each weapon hit restores 5% of your last spell\'s cost as magicka',
    'When a hit drops you below 20% health, you gain a shield worth 15% of your max health for 6 s, and allies within 8 m get half of it. Recovers in 240 s',
  ]);
  assert.deepEqual([REPRIEVE_BELOW, REPRIEVE_SECONDS, REPRIEVE_METRES, REPRIEVE_ALLY_SHARE], [0.2, 6, 8, 0.5], 'the design\'s 20%, 6 s, 8 m and half');
});

test('EG15 THE RECORDS: nine in the places\' order under the pay law\'s own ids - the seven body pieces, the Spire-Shield on a Kite Shield and the Spire-Saber, ONE-HANDED (all nine worn at once) - Mithril; the design\'s names; every affix at the Legendary band\'s TOP and the blow the sigil\'s greatest; NO resistance on any piece (Bearing carries every one); AETHERIC_RECORDS ends with them (mutants: an id off the pay law; a number off the top; a resistance; the make; the order)', () => {
  assert.equal(PANOPLY_SET_PIECES.length, SET_PLACES.length);
  assert.deepEqual(EG_PANOPLY_KEYS, ['warhelm', 'right-pauldron', 'left-pauldron', 'cuirass', 'gauntlets', 'greaves', 'boots', 'shield', 'saber']);
  assert.deepEqual(PANOPLY_SET_PIECES.map((r) => r.id), [...EG_PANOPLY_IDS], 'every record\'s id the one the account service\'s sink sells by');
  assert.deepEqual(PANOPLY_SET_PIECES.map((r) => [r.name, r.group, r.templateIndex]), [
    ['The Battlemage\'s Warhelm', 'Armor', 107], ['The Battlemage\'s Right Pauldron', 'Armor', 106], ['The Battlemage\'s Left Pauldron', 'Armor', 105],
    ['The Battlemage\'s Cuirass', 'Armor', 102], ['The Battlemage\'s Gauntlets', 'Armor', 103], ['The Battlemage\'s Greaves', 'Armor', 104],
    ['The Battlemage\'s Boots', 'Armor', 108], ['The Spire-Shield', 'Armor', 111], ['The Spire-Saber', 'Weapons', 119],
  ]);
  assert.equal(WEAPON_HANDS['119'], 'Either', 'the Saber is one-handed - the shield beside it');
  for (const r of PANOPLY_SET_PIECES) assert.deepEqual([r.set, r.make], ['panoply', 'Mithril'], r.id);
  assert.equal(aethericById('panoply-saber').power, SIGIL_POWER_MAX, 'the Spire\'s top drop: the greatest blow');
  const top = (id) => AFFIX_RANGES[id].legendary[1];
  for (const r of PANOPLY_SET_PIECES) for (const a of r.affixes) assert.equal(a.value, top(a.id), `${r.id} ${a.id}`);
  assert.deepEqual(PANOPLY_SET_PIECES.map((r) => r.affixes.map((a) => a.param ?? a.id)), [
    ['armor', 'intelligence', SKILLS.Destruction], ['armor', 'strength', SKILLS.LongBlade], ['armor', 'willpower', SKILLS.Alteration],
    ['armor', 'endurance', 'intelligence'], ['armor', 'agility', SKILLS.CriticalStrike], ['armor', 'speed', 'weight'],
    ['armor', 'luck', SKILLS.Dodging], ['armor', 'willpower', SKILLS.Restoration], ['damage', 'intelligence', SKILLS.LongBlade],
  ]);
  assert.ok(!PANOPLY_SET_PIECES.some((r) => r.affixes.some((a) => a.id === 'resist')), 'no resistance on a piece - Bearing raises every one');
  for (const r of PANOPLY_SET_PIECES) assert.ok(typeof r.lore === 'string' && r.lore.length > 20 && r.lore.length <= 100, `${r.id}: a line of lore`);
  const upTo = REGALIA.length + RAID_SET_PIECES.length + SERPENT_SET_PIECES.length + NUMIDIUM_SET_PIECES.length;
  assert.deepEqual(AETHERIC_RECORDS, [...AETHERIC_RECORDS.slice(0, upTo), ...PANOPLY_SET_PIECES, ...WYRD_SET_PIECES, ...STARSPUN_SET_PIECES], 'the Battlemages\' - PIN MOVED (WITCH1): then the Wyrd\'s - PIN MOVED (STAR7): then the Starspun Weave');
  assert.deepEqual(AETHERIC_RECORDS.slice(0, upTo), [...REGALIA, ...RAID_SET_PIECES, ...SERPENT_SET_PIECES, ...NUMIDIUM_SET_PIECES]);
  assert.equal(new Set(AETHERIC_RECORDS.map((r) => r.id)).size, AETHERIC_RECORDS.length, 'every id its own');
});

test('EG15 NEVER IMMUNE: the whole Panoply worn at Ascendant, through the real fold with the affixes\' own fold on, stands at +15 an element - Bearing\'s alone, far under the saving throw\'s 100 (AUDIT FINAL); its magicka +30 (mutants: an element missed; a resistance on a piece)', () => {
  fresh(); online(40);
  setPref(LOOT_RARITY_KEY, true);
  const e = wearPanoply(player(), 9, XP[4]);
  computeEntityMods(e);
  for (const el of RESIST_ELEMENTS) assert.equal(entityResistMod(e, [el]), 15, el);
  assert.deepEqual(RESIST_ELEMENTS, ['fire', 'frost', 'shock', 'poison', 'magic']);
  assert.equal(entityModsOf(e).magicka, 30);
  setPref(LOOT_RARITY_KEY, false);
});

test('EG15 THE ITEM LAW: each record mints as its make - Mithril armour, a Mithril Saber - Aetheric, known, its set\'s sigil fresh at Faint (the Saber\'s with its blow), passes the wire\'s check and raises no finding in the account service\'s judge; an affix past its record, another template, another set\'s sigil, another make or another blow is a forgery (mutants: the material; the check\'s ceiling)', () => {
  for (const r of PANOPLY_SET_PIECES) {
    const it = mintAetheric(r);
    assert.deepEqual([it.name, it.rarity, it.aetheric, it.isIdentified], [r.name, AETHERIC, r.id, true], r.id);
    assert.equal(it.material, aethericMaterial(r), r.id);
    assert.deepEqual(it.sigil, r.group === 'Weapons' ? { power: SIGIL_POWER_MAX, set: 'panoply', party: 1, xp: 0 } : { set: 'panoply', party: 1, xp: 0 });
    assert.ok(validLootItem(JSON.parse(JSON.stringify(it))), `${r.id} off the wire`);
    assert.deepEqual(itemFindings(it), [], `${r.id}: honest`);
  }
  assert.equal(mintAetheric(aethericById('panoply-saber')).material, WEAPON_MATERIALS.Mithril);
  assert.equal(mintAetheric(aethericById('panoply-cuirass')).material, ARMOR_MATERIAL.Mithril);
  const forge = (id, fn) => { const it = mintAetheric(aethericById(id)); fn(it); return it; };
  const forged = [
    ['an affix past its record', forge('panoply-warhelm', (it) => { it.affixes[1].value = 16; })],
    ['another template', forge('panoply-shield', (it) => { it.templateIndex = 112; })],
    ['another set\'s sigil', forge('panoply-greaves', (it) => { it.sigil.set = 'numidium'; })],
    ['another make', forge('panoply-boots', (it) => { it.material = ARMOR_MATERIAL.Steel; })],
    ['another blow', forge('panoply-saber', (it) => { it.sigil.power = SIGIL_POWER_MAX - 1; })],
    ['a resistance its record never had', forge('panoply-gauntlets', (it) => { it.affixes[2] = { id: 'resist', param: 'magic', value: 50 }; })],
  ];
  for (const [why, it] of forged) {
    assert.equal(validSetMarks(JSON.parse(JSON.stringify(it))), null, why);
    assert.ok(itemFindings(it).includes('aetheric'), `${why}: the judge's finding`);
  }
  const fake = mintCondition({ group: 'Armor', templateIndex: 102, material: ARMOR_MATERIAL.Mithril, flags: 0 });
  fake.rarity = 'legendary';
  fake.sigil = { set: 'panoply', party: 1, xp: 0 };
  assert.equal(validSetMarks(fake), null, 'the Panoply\'s sigil on a piece no record mints');
});

test('EG15 WHICH PIECE: mintPanoplyPiece picks one of the nine at even odds off ONE draw - it never decides whether (the pay law\'s draw and the service\'s pity do); panoplyPieceById mints the sink\'s piece by the pay law\'s id, fresh, and nothing else; the Broker\'s day never shelves it (mutants: the pick; a second draw; an id outside the nine)', () => {
  let calls = 0;
  const counted = (x) => () => { calls++; return x; };
  assert.equal(mintPanoplyPiece(counted(0)).aetheric, 'panoply-warhelm');
  assert.equal(calls, 1, 'one draw, and no chance of its own');
  assert.equal(mintPanoplyPiece(seq(0.9999)).aetheric, 'panoply-saber');
  assert.equal(mintPanoplyPiece(seq(4 / 9 + 0.01)).aetheric, 'panoply-gauntlets');
  assert.equal(mintPanoplyPiece(seq(1)).aetheric, 'panoply-saber', 'a draw at the edge stays inside');
  const seen = new Set();
  for (let i = 0; i < 9; i++) seen.add(mintPanoplyPiece(seq((i + 0.5) / 9)).aetheric);
  assert.deepEqual([...seen], [...EG_PANOPLY_IDS], 'every piece its ninth of the draw');
  for (const id of EG_PANOPLY_IDS) {
    const a = panoplyPieceById(id), b = panoplyPieceById(id);
    assert.equal(a.aetheric, id);
    assert.notEqual(a, b, 'a fresh piece every call');
    assert.deepEqual(itemFindings(a), []);
  }
  for (const id of ['numidium-visage', 'ruhn-gatecleaver', 'panoply-x', '', null, undefined, 3]) assert.equal(panoplyPieceById(id), null, String(id));
  assert.deepEqual(WORLD_SET_IDS, ['malacath', 'dagon', 'nocturnal', 'mora'], 'the Broker\'s sets stay the four');
  for (let d = 0; d < 60; d++) assert.ok(!brokerStock(d).some((o) => o.set === 'panoply' || o.item?.sigil?.set === 'panoply'), `day ${d}: her day\'s stock never shelves it`);
});

// ── Bearing ───────────────────────────────────────────────────────────

test('EG15 BATTLEMAGE\'S BEARING (2): one fold over RF1\'s channels - every resistance and the new magicka channel, Faint to Ascendant; nothing with one piece, nothing asleep; the channel sums whole and is EMPTY\'s 0 (mutants: an element; the magicka lost; a stage)', () => {
  fresh(); online(1);
  assert.deepEqual(entityModsOf(wearPanoply(player(), 1)).resist, {}, 'one piece wakes nothing');
  assert.equal(entityModsOf(wearPanoply(player(), 1)).magicka, 0);
  const e = wearPanoply(player(), 2);
  assert.deepEqual(entityModsOf(e).resist, { fire: 5, frost: 5, shock: 5, poison: 5, magic: 5 }, 'Faint: +5 every element');
  assert.equal(entityModsOf(e).magicka, 10, 'Faint: +10 magicka');
  fresh(); online(40);
  const asc = wearPanoply(player(), 2, XP[4]);
  assert.deepEqual(entityModsOf(asc).resist, { fire: 15, frost: 15, shock: 15, poison: 15, magic: 15 }, 'Ascendant: +15');
  assert.equal(entityModsOf(asc).magicka, 30);
  fresh();
  assert.equal(entityModsOf(wearPanoply(player(), 2)).magicka, 0, 'offline the sets sleep');
  assert.equal(EMPTY_MODS.magicka, 0);
  assert.equal(newMods().magicka, 0);
  registerEntityFold('eg15-a', () => ({ magicka: 2.7 }));
  registerEntityFold('eg15-b', () => ({ magicka: 3 }));
  assert.equal(computeEntityMods(player()).magicka, 5, 'every fold summed, whole points');
  registerEntityFold('eg15-a', null); registerEntityFold('eg15-b', null);
});

test('EG15 BEARING\'S MAGICKA, LIVE AND NEVER SAVED: the live maximum reads the fold beside Renown\'s term; a save written online keeps the vitals the character would have offline - at Renown 1 too, where no Renown layer stands; the magery\'s third is of Daggerfall\'s own maximum, never the Bearing\'s (mutants: the fold unread; the save keeping it; the magery taking a third of it)', () => {
  fresh();
  const live = (over = {}) => {
    const e = { ...player(), name: 'Mara', spells: [], maxMagicka: 0, career: { abilityFlagsAndSpellPointsBitfield: 0x1000 }, ...over };
    defineLiveMaxMagicka(e);
    e.magicka = e.maxMagicka;
    return e;
  };
  const e = wearPanoply(live(), 2);
  const bare = e.maxMagicka;
  assert.equal(bare, 50, 'offline: Daggerfall\'s own spell points');
  online(1);
  computeEntityMods(e);
  assert.deepEqual([foldMpOf(e), onlineMpOf(e), e.maxMagicka], [10, 10, bare + 10], 'the Bearing on top of the live maximum');
  e.magicka = e.maxMagicka;
  const snap = snapshotPlayer(e, {});
  assert.deepEqual([snap.maxMagicka, snap.magicka], [bare, bare], 'full online is full offline - and the Bearing never rides the save');
  assert.deepEqual(offlineVitals(e), { health: e.health, magicka: bare, maxMagicka: bare });
  e.magicka = 30;
  assert.equal(snapshotPlayer(e, {}).magicka, 25, 'half is half');
  // the magery: a light-powered mage in the dark loses a third of DAGGERFALL'S maximum, never of the Bearing
  fresh();
  const mage = wearPanoply(live({ career: { abilityFlagsAndSpellPointsBitfield: 0x1000 | 0x80 } }), 2);
  setPassiveSpecialsHost({ now: () => 0, isInside: () => true, inPrison: () => false, isHolyPlace: () => false, inDungeon: () => true });
  passiveSpecialsMagicRound(mage, { nowMinutes: 1, clockMinutes: 60 * 12 });
  const offMax = mage.maxMagicka;
  online(1);
  computeEntityMods(mage);
  passiveSpecialsMagicRound(mage, { nowMinutes: 2, clockMinutes: 60 * 12 });
  assert.equal(mage.maxMagicka, offMax + 10, 'the whole Bearing on top, not two thirds of it');
  setPassiveSpecialsHost(null);
});

// ── Discipline ────────────────────────────────────────────────────────

test('EG15 BATTLEMAGE\'S DISCIPLINE (4), THE ARMED BLOW: a cast (told by the cast engine\'s seam) arms the next weapon blow with its element - +20% of the blow at Faint, that blow alone; a later cast re-arms with its own element; a foe that resists takes half, an immune foe none and the arm is still spent; fists spend nothing; three pieces, or a cast while the sets sleep, arm nothing; Ascendant +50% (mutants: the arm never spent; the share; the element\'s flag; fists)', () => {
  fresh(); online(1);
  const e = wearPanoply(player(), 4);
  const w = saber(), foe = { career: {} };
  assert.equal(setPowerStates().armed, -1, 'nothing armed');
  assert.equal(weaponBlowMods(w, 100, e, foe), 100, 'no cast, no arm');
  tellPlayerCast(e, FIRE, 40);
  assert.equal(setPowerStates().armed, 0, 'armed with fire');
  assert.equal(weaponBlowMods(w, 100, e, foe, { unaware: false, estimate: true }), 120, 'the Stats page reads it...');   // PIN ADDED (AUDIT MARTIAL L2 F7)
  assert.equal(setPowerStates().armed, 0, '...and spends nothing');
  assert.equal(weaponBlowMods(w, 100, e, foe), 120, 'Faint: +20% of the blow');
  assert.equal(setPowerStates().armed, -1, 'spent');
  assert.equal(weaponBlowMods(w, 100, e, foe), 100, 'that blow alone');
  tellPlayerCast(e, FIRE, 40);
  assert.equal(setBlow(null, 100, e, foe), 100, 'a fist\'s blow is no weapon\'s');
  assert.equal(setPowerStates().armed, 0, '...and spends nothing');
  tellPlayerCast(e, FROST, 30);
  assert.equal(setPowerStates().armed, 1, 'a later cast re-arms with its own element');
  assert.equal(setBlow(w, 100, e, { career: { immunityFlags: EFFECT_FLAGS.Fire } }), 120, 'frost meets a fire daedra whole');
  tellPlayerCast(e, FIRE, 40);
  assert.equal(setBlow(w, 100, e, { career: { resistanceFlags: EFFECT_FLAGS.Fire } }), 110, 'a foe that resists the element takes half');
  tellPlayerCast(e, FIRE, 40);
  assert.equal(setBlow(w, 100, e, { career: { immunityFlags: EFFECT_FLAGS.Fire } }), 100, 'an immune foe takes none of it');
  assert.equal(setPowerStates().armed, -1, '...and the arm is spent on it all the same: the next blow is the next blow');
  tellPlayerCast(e, POISON, 10);
  assert.equal(setBlow(w, 100, e, { career: { immunityFlags: EFFECT_FLAGS.Poison } }), 100, 'poison read by its own flag');
  tellPlayerCast(e, MAGIC, 10);
  assert.equal(setBlow(w, 100, e, { career: { resistanceFlags: EFFECT_FLAGS.Magic } }), 110, 'magic by its own');
  tellPlayerCast(e, { name: 'Odd', element: 9 }, 10);
  assert.equal(setPowerStates().armed, -1, 'an element outside the five arms nothing');
  tellPlayerCast(e, FIRE, 40);
  assert.equal(setBlow(w, 100, e, { isPlayer: true }), 100, 'never a blow at a player');
  fresh(); online(1);
  const three = wearPanoply(player(), 3);
  tellPlayerCast(three, FIRE, 40);
  assert.equal(setPowerStates().armed, -1, 'three pieces wake no Discipline');
  assert.equal(setBlow(w, 100, three, foe), 100);
  fresh();
  const asleep = wearPanoply(player(), 4);
  tellPlayerCast(asleep, FIRE, 40);
  assert.equal(setPowerStates().armed, -1, 'a cast while the sets sleep arms nothing');
  fresh(); online(40);
  const asc = wearPanoply(player(), 4, XP[4]);
  setCast(asc, FIRE, 40);
  assert.equal(setBlow(w, 100, asc, foe), 150, 'Ascendant: +50%');
  fresh(); online(1);
  const duel = wearPanoply(player(), 4);
  setSetsDueling(true);
  tellPlayerCast(duel, FIRE, 40);
  assert.equal(setPowerStates().armed, -1, 'asleep in a duel');
  setSetsDueling(false);
});

test('EG15 BATTLEMAGE\'S DISCIPLINE (4), THE RETURN: each weapon blow that lands returns 5% of the last spell\'s cost as magicka at Faint (15% at Ascendant), the fraction carried, never past the maximum - a bow\'s blow too, fists never; the next cast names the next cost; a free cast\'s cost is nothing (mutants: the share; the cost never kept; the fraction lost; the cap)', () => {
  fresh(); online(1);
  const e = wearPanoply(player(), 4);
  const w = saber(), foe = { career: {} };
  setStrike(e, foe, 30, w);
  assert.equal(e.magicka, 0, 'no cast yet, nothing to return');
  tellPlayerCast(e, FIRE, 40);
  setStrike(e, foe, 30, w);
  assert.equal(e.magicka, 2, 'Faint: 5% of 40');
  setStrike(e, foe, 30, w);
  assert.equal(e.magicka, 4, 'each blow returns it, until the next cast');
  setStrike(e, foe, 30, null);
  assert.equal(e.magicka, 4, 'a fist\'s blow returns nothing');
  setStrike(e, foe, 0, w);
  assert.equal(e.magicka, 4, 'a blow that took nothing returns nothing');
  setStrike(e, foe, 30, createWeapon(130, WEAPON_MATERIALS.Steel));
  assert.equal(e.magicka, 6, 'a bow\'s blow is a weapon blow');
  setStrike(e, foe, 30, w, { blow: false });
  assert.equal(e.magicka, 6, 'TWO-HANDS (AUDIT 2): an off-hand blow that does not count whole sets off no per-blow charge, and the return is one');
  tellPlayerCast(e, FROST, 10);
  setStrike(e, foe, 30, w);
  assert.equal(e.magicka, 6, 'the next cast\'s cost: 5% of 10 is half a point, carried');
  setStrike(e, foe, 30, w);
  assert.equal(e.magicka, 7, '...and paid on the next blow');
  e.maxMagicka = 8;
  tellPlayerCast(e, FIRE, 100);
  setStrike(e, foe, 30, w);
  assert.equal(e.magicka, 8, 'never past the maximum');
  e.maxMagicka = 1000;
  tellPlayerCast(e, FIRE, 0);
  setStrike(e, foe, 30, w);
  assert.equal(e.magicka, 8, 'a free cast (an item\'s, a trap\'s) cost nothing to return');
  fresh(); online(40);
  const asc = wearPanoply(player(), 4, XP[4]);
  tellPlayerCast(asc, FIRE, 40);
  setStrike(asc, foe, 30, w);
  assert.equal(asc.magicka, 6, 'Ascendant: 15% of 40');
  fresh(); online(1);
  const three = wearPanoply(player(), 3);
  tellPlayerCast(three, FIRE, 40);
  setStrike(three, foe, 30, w);
  assert.equal(three.magicka, 0, 'three pieces return nothing');
});

test('EG15 THE CAST SEAM AND THE ONE MAGICKA: playerCasts.js is a leaf the one cast engine tells as the spell leaves the hands (hostMagic.js done(), with its cost) - every host builds that engine, the interiors take the streaming page\'s; a listener that throws is skipped; gainMana moved whole beside the heal and the loot\'s Conduit reads it there (mutants: the seam never told; a throwing listener stopping the rest; the return\'s cap)', () => {
  const told = [];
  registerPlayerCastListener('eg15-throw', () => { throw new Error('no'); });
  registerPlayerCastListener('eg15-t', (e, sp, cost) => told.push([e, sp.name, cost]));
  tellPlayerCast(RAT, FIRE, 12);
  tellPlayerCast(RAT, FROST, -3);
  tellPlayerCast(RAT, MAGIC, NaN);
  assert.deepEqual(told, [[RAT, 'Fireball', 12], [RAT, 'Frostbite', 0], [RAT, 'Magicka Bolt', 0]], 'every listener told, a throw skipped, a cost never below 0');
  registerPlayerCastListener('eg15-throw', null); registerPlayerCastListener('eg15-t', null);
  assert.doesNotMatch(strip(read('src/systems/playerCasts.js')), /\bimport\b/, 'a leaf');
  const magic = strip(read('src/scenes/hostMagic.js'));
  assert.match(magic, /import \{ tellPlayerCast \} from '\.\.\/systems\/playerCasts\.js';/);
  assert.match(magic, /const done = \(v\) => \{ lastSpell = sp; onCastReadySpell\?\.\(sp\); if \(v\) tellPlayerCast\(playerEntity, sp, cost\); readiedSpell = null;/);
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js']) assert.match(strip(read(host)), /createPlayerMagic\(\{/, `${host} builds the one engine`);
  assert.doesNotMatch(strip(read('src/scenes/worldModes.js')), /createPlayerMagic\(/, 'the interiors take the streaming page\'s engine');
  assert.match(strip(read('src/systems/sigil/sigilSetPowers.js')), /registerPlayerCastListener\(SIGIL_SETS_POWER, setCast\);/);
  // the one magicka a power returns
  _resetPlayerHealForTests();
  const m = { magicka: 10, maxMagicka: 12 };
  manaMine(m, 5);
  assert.equal(m.magicka, 12, 'never past the maximum');
  const f = { magicka: 0, maxMagicka: 100 };
  manaMine(f, 0.4); manaMine(f, 0.4);
  assert.equal(f.magicka, 0);
  manaMine(f, 0.4);
  assert.equal(f.magicka, 1, 'the fraction carried');
  _resetPlayerHealForTests();
  manaMine(f, 0.85);
  assert.equal(f.magicka, 1, 'the reset clears the fraction (0.2 was owed)');
  const loot = strip(read('src/systems/loot/lootPowers.js'));
  assert.doesNotMatch(loot, /function gainMana/, 'one door, never two');
  assert.match(loot, /case 'conduit': if \(whole\) gainMana\(attacker, p\.mana\); break;/);   // PIN MOVED (TWO-HANDS AUDIT 2, at the sixth merge of main): a per-blow charge on a whole blow alone - the Discipline's return beside it
});

// ── Reprieve ──────────────────────────────────────────────────────────

test('EG15 BATTLEMAGE\'S REPRIEVE (6): a foe\'s blow that takes me under 20% (from at or over it, still standing) raises a shield of 15% of my maximum health for 6 s - said, sounded, soaking whatever comes next point for point, gone when its window ends; never a killing blow, a saved one, a fall\'s or a spell\'s hurt, nor a blow from under the line; then it recovers in 240 s, says it is ready again and shows itself as a chip; Ascendant 40%, 120 s; nothing with five pieces (mutants: the line; the crossing; the window; the soak; the recovery; a saved blow raising it)', () => {
  const v = fresh(); online(1);
  const e = wearPanoply(player(), 6);
  door(e);
  at(10);
  blow(e, 85);
  assert.equal(e.health, 15, 'the blow lands whole');
  assert.deepEqual(v.said, ['Battlemage\'s Reprieve! A 15-point shield.']);
  assert.deepEqual(v.sounds, ['reprieve']);
  const st = setPowerStates(10);
  assert.deepEqual([st.reprieve, st.reprieveLeft, st.reprieveRecoverLeft], [15, 6, 240]);
  assert.deepEqual(setHudChips(e, 10).map((c) => [c.key, c.set, c.name, c.state, c.text]), [['reprieve', 'panoply', 'Reprieve', 'active', '15']]);
  at(12);
  blow(e, 10);
  assert.equal(e.health, 15, 'soaked whole');
  hurtPlayer(e, 3);
  assert.equal(e.health, 15, 'a fall soaked too, as a Shield\'s pool soaks it');
  blow(e, 4);
  assert.equal(e.health, 13, 'the last 2 points soaked, the rest lands');
  assert.equal(setPowerStates(12).reprieve, 0);
  assert.deepEqual(setHudChips(e, 12).map((c) => [c.key, c.state, c.text]), [['reprieve', 'recovering', '3:58']]);
  // the window: a fresh shield gone at 6 s
  const w = fresh(); online(1);
  const e2 = wearPanoply(player(), 6);
  door(e2);
  at(0);
  blow(e2, 81);
  assert.equal(setPowerStates(5.9).reprieve, 15, 'inside the window');
  at(6);
  assert.equal(setPowerStates(6).reprieve, 0, 'gone at 6 s');
  blow(e2, 5);
  assert.equal(e2.health, 14, 'past its window it soaks nothing');
  // the guards
  e2.health = 100;
  at(50);
  blow(e2, 85);
  assert.equal(w.said.filter((l) => l.startsWith('Battlemage\'s Reprieve!')).length, 1, 'recovering: no second shield');
  e2.health = 100;
  at(240);
  setRound(e2);
  assert.deepEqual(w.said.slice(-1), ['Battlemage\'s Reprieve is ready again.']);
  hurtPlayer(e2, 85);
  assert.equal(setPowerStates(240).reprieve, 0, 'a fall raises nothing');
  e2.health = 19;
  blow(e2, 5);
  assert.equal(setPowerStates(240).reprieve, 0, 'from under the line: no crossing');
  e2.health = 30;
  assert.equal(blow(e2, 40), true, 'a killing blow kills');
  assert.equal(setPowerStates(240).reprieve, 0, '...and raises nothing');
  e2.health = 50;
  registerPlayerDeathSave('eg15-save', () => true);
  blow(e2, 200);
  registerPlayerDeathSave('eg15-save', null);
  assert.equal(e2.health, 1, 'a death save turned the killing blow');
  assert.equal(setPowerStates(240).reprieve, 0, 'the save was the save: no shield on top');
  e2.health = 100;
  blow(e2, 80);
  assert.equal(setPowerStates(240).reprieve, 0, 'exactly 20% is not under it: 100 -> 20 crosses nothing');
  blow(e2, 1);
  assert.equal(setPowerStates(240).reprieve, 15, '...and 20 -> 19 does');
  // Ascendant
  const a = fresh(); online(40);
  const asc = wearPanoply(player(), 6, XP[4]);
  door(asc);
  blow(asc, 90);
  assert.deepEqual([setPowerStates(0).reprieve, setPowerStates(0).reprieveRecoverLeft], [40, 120], 'Ascendant: 40% for 120 s');
  assert.deepEqual(a.said, ['Battlemage\'s Reprieve! A 40-point shield.']);
  fresh(); online(1);
  const five = wearPanoply(player(), 5);
  door(five);
  blow(five, 85);
  assert.equal(setPowerStates(0).reprieve, 0, 'five pieces wake no Reprieve');
  assert.deepEqual(awakeTiersOf(five).get('panoply').map((t) => t !== null), [true, true, false]);
});

test('EG15 THE ALLIES\' HALF: the host\'s door (setSetPowersAllies) names the allies within 8 m and casts at each a Shield of half the points - an ALLY-CAST gift the wire carries and every receiver lands as its own pool, three magic rounds (6 s rounded up and one more, Eventide\'s law), inside the frame\'s byte; a door that throws, a cast that does not leave or no door shields me alone (mutants: the share; the reach; the rounds; the byte)', () => {
  const v = fresh(); online(1);
  const e = wearPanoply(player(), 6);
  door(e);
  const asked = [], casts = [];
  const mira = { id: 'peer-mira' }, bran = { id: 'peer-bran' };
  setSetPowersAllies({ near: (m) => { asked.push(m); return [mira, bran]; }, shield: (ally, sp) => { casts.push([ally, sp]); return ally === mira; } });
  blow(e, 85);
  assert.deepEqual(asked, [REPRIEVE_METRES], 'asked for the allies within 8 m');
  assert.deepEqual(casts.map(([a]) => a), [mira, bran], 'each ally its own cast');
  assert.deepEqual(casts[0][1], reprieveBundle(8), 'half of 15, whole');
  assert.deepEqual(v.said, ['Battlemage\'s Reprieve! A 15-point shield, and 1 ally shielded.'], 'the casts that left are counted');
  assert.equal(setPowerStates(0).reprieve, 15, 'and the whole shield is mine');
  const sp = reprieveBundle(8);
  assert.deepEqual(sp.effects[0], { type: 35, subType: 255, durationBase: 3, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1, magnitudeBaseLow: 8, magnitudeBaseHigh: 8, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 });
  assert.equal(sp.effects[0].durationBase, Math.ceil(REPRIEVE_SECONDS / ROUND_SECONDS) + 1, '6 s is no whole round: rounded up, and one more');
  assert.equal(sp.effects[0].durationBase, eventideBundle(2).effects[0].durationBase, 'Eventide\'s own law: two rounds named, three given');
  assert.ok(allyCastable(sp) && strangerCastable(sp), 'a gift a mate (or a stranger\'s switch) takes');
  const frame = allyCastFrame(sp, 12, mira.id);
  const wire = validCastData(JSON.parse(JSON.stringify(frame)));
  assert.ok(wire, 'the wire carries it');
  const target = { isPlayer: true, health: 50, maxHealth: 100, activeEffects: [], stats: stats(), career: {}, level: 3 };
  applySpell(allyCastSpell(wire.spell), wire.level, target, { hurt: () => {}, heal: () => {} }, () => 0.5);
  const pool = target.activeEffects.find((x) => x.kind === 'shield');
  assert.deepEqual([pool?.startingShield, pool?.shieldRemaining], [8, 8], 'the receiver lands the share as its own Shield pool, whatever its level');
  assert.equal(reprieveBundle(400).effects[0].magnitudeBaseLow, CAST_SETTING_MAX, 'never past the frame\'s byte');
  assert.equal(CAST_SETTING_MAX, 255);
  // a door that throws, a cast that throws, no door
  const w = fresh(); online(1);
  const e2 = wearPanoply(player(), 6);
  door(e2);
  setSetPowersAllies({ near: () => { throw new Error('no'); }, shield: () => true });
  blow(e2, 85);
  assert.equal(setPowerStates(0).reprieve, 15, 'the door threw: the shield is mine all the same');
  assert.deepEqual(w.said, ['Battlemage\'s Reprieve! A 15-point shield.']);
  fresh(); online(1);
  const e3 = wearPanoply(player(), 6);
  door(e3);
  let n = 0;
  setSetPowersAllies({ near: () => [mira, bran], shield: (a) => { n++; if (a === mira) throw new Error('no'); return true; } });
  blow(e3, 85);
  assert.equal(n, 2, 'one ally\'s throw is not the next ally\'s');
  fresh(); online(1);
  const e4 = wearPanoply(player(), 6);
  door(e4);
  let askedHalf = 0;
  setSetPowersAllies({ near: () => { askedHalf++; return [mira]; }, shield: null });
  blow(e4, 85);
  assert.equal(askedHalf, 0, 'a door with no shield is no door: nobody is asked for');
  assert.equal(setPowerStates(0).reprieve, 15, '...and the shield is mine');
  fresh(); online(1);
  const e5 = wearPanoply(player(), 6);
  door(e5);
  setSetPowersAllies(null);
  blow(e5, 85);
  assert.equal(setPowerStates(0).reprieve, 15, 'no door: me alone');
});

// ── the Spire ─────────────────────────────────────────────────────────

test('EG15 THE SPIRE\'S RECOVERY: in an Elite Breach the Reprieve is no timer - spent there it is held past its 240 s to the next Redoubt taken, its chip reads "Redoubt", the round says nothing; the Redoubt makes it ready and the round says so; out of the breach (or in another) its own timer governs (mutants: the hold ignored; the Redoubt not recovering it; a hold outliving its breach)', () => {
  const v = fresh(); online(1);
  let room = 'breach-1';
  setSpireRecovery(() => room);
  const e = wearPanoply(player(), 6);
  door(e);
  blow(e, 85);
  assert.deepEqual(setPowerStates(0).redoubt, ['reprieve']);
  at(500);
  setRound(e);
  assert.ok(!v.said.includes('Battlemage\'s Reprieve is ready again.'), 'held: nothing said');
  assert.deepEqual(setHudChips(e, 500).map((c) => [c.key, c.state, c.text]), [['reprieve', 'recovering', 'Redoubt']]);
  e.health = 100;
  blow(e, 85);
  assert.equal(setPowerStates(500).reprieve, 0, 'past its timer, still held');
  spireRedoubtTaken();
  assert.deepEqual(setPowerStates(500).redoubt, []);
  setRound(e);
  assert.deepEqual(v.said.slice(-1), ['Battlemage\'s Reprieve is ready again.']);
  e.health = 100;
  blow(e, 85);
  assert.equal(setPowerStates(500).reprieve, 15, 'the Redoubt recovered it');
  at(520);
  assert.deepEqual(setPowerStates(520).redoubt, ['reprieve'], 'spent again: held again');
  assert.equal(setPowerStates(520).reprieveRecoverLeft, 220, 'its timer still runs beneath');
  spireRedoubtTaken();
  assert.equal(setPowerStates(520).reprieveRecoverLeft, 0, 'a Redoubt inside the timer recovers it too');
  e.health = 100;
  blow(e, 85);
  assert.equal(setPowerStates(520).reprieve, 15, '...and it raises again at once');
  // a hold is its breach's alone
  room = null;
  assert.deepEqual(setPowerStates(520).redoubt, [], 'out of the breach the timer governs');
  assert.deepEqual(setHudChips(e, 520).map((c) => [c.key, c.text]), [['reprieve', '15']]);
  at(800);
  e.health = 100;
  blow(e, 85);
  assert.equal(setPowerStates(800).reprieve, 15, 'its timer ran out: ready again outside');
  room = 'breach-2';
  at(1100);
  e.health = 100;
  blow(e, 85);
  assert.equal(setPowerStates(1100).reprieve, 15, 'spent outside, nothing held it in the next breach');
  assert.deepEqual(setPowerStates(1100).redoubt, ['reprieve'], 'spent in breach 2: held to its Redoubt');
  room = 'breach-3';
  assert.deepEqual(setPowerStates(1100).redoubt, [], 'another breach is not the one that holds it');
  setSpireRecovery(() => { throw new Error('no'); });
  assert.deepEqual(setPowerStates(1100).redoubt, [], 'a host that throws holds nothing');
  setSpireRecovery(() => false);
  assert.deepEqual(setPowerStates(1100).redoubt, []);
  at(1400);
  e.health = 100;
  blow(e, 85);
  assert.equal(setPowerStates(1400).reprieve, 15);
  assert.deepEqual(setPowerStates(1400).redoubt, [], 'a host answering false is in no breach: spent there, nothing holds it');
});

test('EG15 THE SPIRE\'S RECOVERY, EVERY DEATH SAVE: Unbroken, The Hour Turns and Shed Skin spent in an Elite Breach are held to the next Redoubt too - past their timers, their chips reading "Redoubt"; the Redoubt makes each ready, and the round says so (Elite-Gates.md section 15) (mutants: a save left on its timer in the Spire)', () => {
  // Unbroken (Malacath's Bulwark)
  let v = fresh(); online(1);
  setSpireRecovery(() => 'b');
  const m = wearSet(player(), 'malacath', 6);
  door(m);
  m.health = 5;
  hurtPlayer(m, 50);
  assert.equal(m.health, 1, 'Unbroken saves');
  at(400);
  assert.deepEqual(setHudChips(m, 400).map((c) => [c.key, c.state, c.text]), [['unbroken', 'recovering', 'Redoubt']]);
  m.health = 5;
  assert.equal(hurtPlayer(m, 50), true, 'held past its 300 s: the next death is a death');
  spireRedoubtTaken();
  setRound(m);
  assert.deepEqual(v.said.slice(-1), ['Unbroken is ready again.']);
  m.health = 5;
  assert.equal(hurtPlayer(m, 50), false, 'the Redoubt recovered it');
  // The Hour Turns (the Brass of Numidium)
  v = fresh(); online(1);
  setSpireRecovery(() => 'b');
  const h = wearSet(player(), 'numidium', 6);
  door(h);
  h.health = 99;
  blow(h, 150);
  assert.equal(h.health, 16, 'the Hour turns');
  at(200);
  assert.deepEqual(setHudChips(h, 200).map((c) => [c.key, c.text]), [['hour', 'Redoubt']]);
  h.health = 99;
  assert.equal(blow(h, 150), true, 'held past its 90 s');
  spireRedoubtTaken();
  setRound(h);
  assert.deepEqual(v.said.slice(-1), ['The Hour Turns is ready again.']);
  h.health = 99;
  assert.equal(blow(h, 150), false);
  // Shed Skin (Sethrakul's Coilscale)
  v = fresh(); online(1);
  setSpireRecovery(() => 'b');
  const s = wearSet(player(), 'coilscale', 6);
  door(s);
  blow(s, 70);
  assert.equal(s.health, 40, 'Shed Skin heals 10%');
  at(300);
  assert.deepEqual(setHudChips(s, 300).map((c) => [c.key, c.text]), [['shed', 'Redoubt']]);
  s.health = 100;
  blow(s, 70);
  assert.equal(s.health, 30, 'held past its 240 s');
  spireRedoubtTaken();
  setRound(s);
  assert.deepEqual(v.said.slice(-1), ['Shed Skin is ready again.']);
  s.health = 100;
  blow(s, 70);
  assert.equal(s.health, 40);
  assert.deepEqual(setPowerStates(300).redoubt, ['shed'], 'and spent there again, held again');
});

// ── the HUD and the host ──────────────────────────────────────────────

test('EG15 THE HUD AND THE HOST: the states carry the Discipline\'s arm, the Reprieve\'s shield, window and recovery and the Spire\'s holds; the chip shows the Reprieve only while six pieces wake; world.js voices it with a Shield spell\'s own cast through the cast sounds\' ID door (mutants: the reprieve unvoiced; a chip with five pieces)', () => {
  fresh(); online(1);
  const st = setPowerStates(0);
  assert.deepEqual([st.armed, st.reprieve, st.reprieveLeft, st.reprieveRecoverLeft, st.redoubt], [-1, 0, 0, 0, []]);
  const e = wearPanoply(player(), 6);
  door(e);
  blow(e, 85);
  const five = wearPanoply(player(), 5);
  assert.deepEqual(setHudChips(five, 0), [], 'a shield left over from six pieces says nothing on five');
  assert.equal(setHudChips(e, 0).length, 1);
  const w = strip(read('src/scenes/world.js'));
  assert.match(w, /else if \(name === 'reprieve'\) audio\.playOneShotId\(SPELL_CAST_SOUND\[4\], 1\);/);
  assert.equal(reprieveBundle(1).element, 4, 'the Reprieve\'s Shield rides the magic element - its cast sound\'s index');
});
