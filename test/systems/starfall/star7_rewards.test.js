// STAR7 (bible/11-Multiplayer/Starfall.md section 6): A HELD STAR'S SPOILS - the Starspun Weave (the festival's own Aetheric
// set: its law, its nine pieces, its three powers through SET2's seams), Starglass (template 576, its row, its picture, its
// law's leaf) and the roll off the receipt's seed (the Heart-Star's doubled). tools/mutants/star7.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  setBlow, setStrike, setStruck, setRound, setPowerStates, setHudChips, setSetPowersVoice, strandsAt, strandCount, awakeTiersOf, setFold,
  veilBundle, _setSetPowersClockForTests, _resetSetPowersForTests,
} from '../../../src/systems/sigil/sigilSetPowers.js';
import { setSigilOnline, setSigilRenown, SIGIL_STAGES, SIGIL_SET_IDS, _resetSigilForTests } from '../../../src/systems/sigil/sigil.js';
import {
  WORLD_SET_IDS, BRIEF_MAX, SET_STAGE_MAX, STRAND_HITS, STRAND_SECONDS, VEIL_BELOW, ROUND_SECONDS, setById, raidSetOf, tierValues,
  _resetSigilSetsForTests,
} from '../../../src/systems/sigil/sigilSets.js';
import {
  AETHERIC_RECORDS, PANOPLY_SET_PIECES, WYRD_SET_PIECES, STARSPUN_SET_PIECES, ELTHERIC_SET_PIECES, STARSPUN_SET_CHANCE, RAID_SET_CHANCE, RAID_SET_POWER, aethericById,
  aethericMaterial, mintAetheric, rollStarspunPiece, validSetMarks, AETHERIC,
} from '../../../src/systems/aetheric.js';
import { _resetPlayerHealForTests } from '../../../src/systems/playerHeal.js';
import { hurtPlayer } from '../../../src/characters/playerEntity.js';
import { reportPlayerKill } from '../../../src/systems/playerKills.js';
import { setPlayerDoor } from '../../../src/systems/playerDoor.js';
import { equipItem } from '../../../src/systems/equip.js';
import { mintCondition, templateByIndex } from '../../../src/systems/item/itemTemplates.js';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../../../src/systems/armorMaterials.js';
import { WEAPON_MATERIALS } from '../../../src/characters/weapons.js';
import { WEAPON_HANDS } from '../../../src/characters/equipRules.js';
import { SKILLS } from '../../../src/systems/skills.js';
import { AFFIX_RANGES } from '../../../src/systems/loot/lootRarity.js';
import { validLootItem } from '../../../src/systems/loot/loot.js';
import { isBound } from '../../../src/systems/item/itemBound.js';
import { lawTemplate } from '../../../src/systems/item/itemLaw.js';
import { STARGLASS_TEMPLATE, STARGLASS_LAW_ROW } from '../../../src/systems/starfall/starglassRow.js';
import { starglass, isStarglass, STARGLASS_ROW } from '../../../src/systems/starfall/starglass.js';
import { starglassArt, starglassTexel, registerStarglassArt, _resetStarglassArt, STARGLASS_ARCHIVE, STARGLASS_ART, STARGLASS_ART_SIZE, STARGLASS_OUTLINE } from '../../../src/world/starfall/starglassArt.js';
import { STAR_RAMPS } from '../../../src/world/starfall/starArt.js';
import { PSEUDO_ARCHIVES, pseudoArchiveCollisions } from '../../../src/world/eliteGates/pseudoArchives.js';
import { rollStarSpoils, starSpoilsList, starSpoilsDay, STAR_SPOILS_GOLD_PER_LEVEL, STARGLASS_MAX, STAR_SPOILS_KEYS, STAR_SPOILS_TEXT } from '../../../src/systems/starfall/starSpoils.js';
import { RAID_SPOILS_KEYS } from '../../../src/systems/raidSpoils.js';
import { SERPENT_SPOILS_KEYS } from '../../../src/systems/serpent/serpentSpoils.js';
import { witchesNight, HEART_STAR } from '../../../src/systems/starfall/starfallNight.js';
import { starNightAt } from '../../../src/net/starfall/starfallLaw.js';
import { STAR_VIOLET_CSS } from '../../../src/ui/starfall/starMapMark.js';
import { FESTIVALS } from '../../../src/net/festivalLaw.js';
const FESTIVAL_FROM_MS = FESTIVALS[0].fromMs;   // the Witches' Festival's first day, the Starfall's own (net/festivalLaw.js)

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
const sword = () => createWeapon(120, 0, () => 0.5);
const RAT = Object.freeze({ name: 'rat' });
const WOLF = Object.freeze({ name: 'wolf' });
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
const blow = (e, n, attacker = RAT) => { setStruck(attacker, e, n); return hurtPlayer(e, n); };
function door({ me = null } = {}) {
  const d = { casts: [] };
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: (b) => { d.casts.push(b); }, player: () => me });
  return d;
}
const seq = (...xs) => { let i = 0; return () => xs[Math.min(i++, xs.length - 1)]; };
const swing = (e, weapon, target, n = 100) => { const d = setBlow(weapon, n, e, target, {}); setStrike(e, target, d, weapon); return d; };

test('STAR7 THE LAW: the Starspun Weave last of every set - Aetheric, Mephala its patron, the star\'s violet its colour, no raiding party\'s, never a world set; Spinner\'s Thread, Bound in Silk and Mephala\'s Veil at 2, 4 and 6 pieces with the design\'s numbers Faint to Ascendant, every brief inside BRIEF_MAX at every stage (mutants: a tier\'s number; the set\'s place; a world set)', () => {
  assert.deepEqual(SIGIL_SET_IDS.slice(-2), ['starspun', 'eltheric']);   // PIN MOVED (SEA-SET): the Eltheric Tidemail after it
  const s = setById('starspun');
  assert.deepEqual([s.id, s.name, s.prince, s.colour, s.aetheric, 'raid' in s, s.role],
    ['starspun', 'The Starspun Weave', 'Mephala', STAR_VIOLET_CSS, true, false, 'The coven\'s thread, turned on the coven']);
  assert.ok(!WORLD_SET_IDS.includes('starspun'), 'no world drop rolls it');
  assert.ok(![0, 1, 2].some((p) => raidSetOf(p)?.id === 'starspun'), 'no raiding party pays it');
  assert.deepEqual(s.tiers.map((t) => [t.at, t.key, t.name, t.values]), [
    [2, 'spinners-thread', "Spinner's Thread", { poison: [10, 30], agility: [2, 6] }],
    [4, 'bound-in-silk', 'Bound in Silk', { more: [60, 140] }],
    [6, 'mephalas-veil', "Mephala's Veil", { rounds: [2, 4], recover: [240, 120] }],
  ]);
  assert.deepEqual([STRAND_HITS, STRAND_SECONDS, VEIL_BELOW], [4, 8, 0.3]);
  for (const t of s.tiers) for (let st = 0; st <= SET_STAGE_MAX; st++) {
    const b = t.brief(tierValues(t, st));
    assert.ok(b.length <= BRIEF_MAX, `${t.key} at ${st}: "${b}" (${b.length})`);
    assert.ok(!/\S - \S/.test(t.text(tierValues(t, st))), `${t.key}: no dash aside`);
  }
  assert.equal(s.tiers[1].brief(tierValues(s.tiers[1], 0)), 'Every 4th hit on a foe +60%');
  assert.equal(s.tiers[2].brief(tierValues(s.tiers[2], SET_STAGE_MAX)), `Under 30%: Chameleon ${4 * ROUND_SECONDS}s`);
  assert.equal(s.tiers[2].text(tierValues(s.tiers[2], 0)), 'When a hit drops you below 30% health, the web hides you. Chameleon for 10 s. Recovers in 240 s');
});

test('STAR7 THE RECORDS: nine in the places\' order - the seven body pieces, a buckler and a ONE-HANDED Shortsword (all nine worn at once) - Elven; every affix at the Legendary band\'s floor and the blow the band\'s floor (the raiding parties\' measure: a star is held three times an hour); never a poison resistance, one resistance of an element at most; AETHERIC_RECORDS ends with them (mutants: a number off the floor; a poison piece; the make; the order)', () => {
  assert.deepEqual(STARSPUN_SET_PIECES.map((r) => [r.id, r.group, r.templateIndex]), [
    ['starspun-cowl', 'Armor', 107], ['starspun-right-pauldron', 'Armor', 106], ['starspun-left-pauldron', 'Armor', 105],
    ['starspun-cuirass', 'Armor', 102], ['starspun-hands', 'Armor', 103], ['starspun-greaves', 'Armor', 104],
    ['starspun-boots', 'Armor', 108], ['starspun-buckler', 'Armor', 109], ['starspun-blade', 'Weapons', 116],
  ]);
  assert.equal(WEAPON_HANDS['116'], 'Either', 'the Shortsword is one-handed - the buckler beside it');
  for (const r of STARSPUN_SET_PIECES) assert.deepEqual([r.set, r.make], ['starspun', 'Elven'], r.id);
  assert.equal(aethericById('starspun-blade').power, RAID_SET_POWER);
  const floor = (id) => AFFIX_RANGES[id].legendary[0];
  for (const r of STARSPUN_SET_PIECES) for (const a of r.affixes) assert.equal(a.value, floor(a.id), `${r.id} ${a.id}`);
  assert.deepEqual(STARSPUN_SET_PIECES.map((r) => r.affixes.map((a) => a.param ?? a.id)), [
    ['armor', 'personality', SKILLS.Illusion], ['armor', 'strength', SKILLS.ShortBlade], ['armor', 'endurance', 'shock'],
    ['armor', 'agility', 'endurance'], ['armor', 'agility', SKILLS.Backstabbing], ['armor', 'speed', SKILLS.Stealth],
    ['armor', 'speed', SKILLS.Jumping], ['armor', 'willpower', 'magic'], ['damage', 'agility', SKILLS.ShortBlade],
  ]);
  const resists = STARSPUN_SET_PIECES.flatMap((r) => r.affixes.filter((a) => a.id === 'resist').map((a) => a.param));
  assert.ok(!resists.includes('poison'), 'never poison - Spinner\'s Thread carries it');
  assert.equal(new Set(resists).size, resists.length);
  for (const r of STARSPUN_SET_PIECES) assert.ok(r.lore.length > 20 && r.lore.length <= 100 && !/\S - \S/.test(r.lore), `${r.id}: a line of lore`);
  assert.deepEqual(AETHERIC_RECORDS.slice(-ELTHERIC_SET_PIECES.length - STARSPUN_SET_PIECES.length - WYRD_SET_PIECES.length - PANOPLY_SET_PIECES.length), [...PANOPLY_SET_PIECES, ...WYRD_SET_PIECES, ...STARSPUN_SET_PIECES, ...ELTHERIC_SET_PIECES]);   // PIN MOVED (SEA-SET): the Tidemail's nine after the Weave's   // PIN MOVED (WITCH1): the Wyrd's Raiment between the Panoply and the Weave
  assert.equal(new Set(AETHERIC_RECORDS.map((r) => r.id)).size, AETHERIC_RECORDS.length, 'every id its own');
});

test('STAR7 MINTED AND CHECKED: each record mints Elven, Aetheric, known, its set\'s sigil fresh at Faint (the blade\'s with its blow), and passes the wire\'s check; an affix past its record, another set\'s sigil or another make is no item (mutants: the material; the check)', () => {
  for (const r of STARSPUN_SET_PIECES) {
    const it = mintAetheric(r);
    assert.deepEqual([it.name, it.rarity, it.aetheric, it.isIdentified], [r.name, AETHERIC, r.id, true], r.id);
    assert.equal(it.material, aethericMaterial(r), r.id);
    assert.deepEqual(it.sigil, r.group === 'Weapons' ? { power: RAID_SET_POWER, set: 'starspun', party: 1, xp: 0 } : { set: 'starspun', party: 1, xp: 0 });
    assert.ok(validLootItem(JSON.parse(JSON.stringify(it))), `${r.id} off the wire`);
  }
  assert.equal(mintAetheric(aethericById('starspun-blade')).material, WEAPON_MATERIALS.Elven);
  assert.equal(mintAetheric(aethericById('starspun-cuirass')).material, ARMOR_MATERIAL.Elven);
  const over = mintAetheric(aethericById('starspun-buckler'));
  over.affixes[2].value += 1;
  assert.equal(validSetMarks(over), null, 'a resistance past the record\'s is a forgery');
  const theirs = mintAetheric(aethericById('starspun-greaves'));
  theirs.sigil.set = 'coilscale';
  assert.equal(validSetMarks(theirs), null, 'another set\'s sigil');
});

test('STAR7 THE DROP: a quarter of a star\'s spoils (the raids\' own share), the Heart-Star\'s every time; the same seed choosing which - one roll when nothing drops, two when a piece does, one with the Heart-Star\'s (mutants: the chance; the Heart-Star\'s draw)', () => {
  assert.equal(STARSPUN_SET_CHANCE, RAID_SET_CHANCE);
  let calls = 0;
  const counted = (...xs) => { const r = seq(...xs); return () => { calls++; return r(); }; };
  assert.equal(rollStarspunPiece(counted(0.25)), null);
  assert.equal(calls, 1);
  calls = 0;
  assert.equal(rollStarspunPiece(counted(0.2, 0.5)).aetheric, 'starspun-hands');
  assert.equal(calls, 2);
  calls = 0;
  assert.equal(rollStarspunPiece(counted(0.5), true).aetheric, 'starspun-hands', 'the Heart-Star\'s: no chance taken');
  assert.equal(calls, 1);
  assert.equal(rollStarspunPiece(seq(0, 0.9999)).aetheric, 'starspun-blade');
});

test('STAR7 SPINNER\'S THREAD (2): one fold - poison resistance and Agility, Faint to Ascendant; nothing with one piece, nothing asleep (mutants: the element; the stat)', () => {
  fresh(); online(1);
  const e = wearSet(player(), 'starspun', 2);
  const m = setFold(e);
  assert.deepEqual([m.resist.poison, m.stats.agility], [10, 2]);
  fresh(); online(40);
  const asc = wearSet(player(), 'starspun', 2, XP[4]);
  assert.deepEqual([setFold(asc).resist.poison, setFold(asc).stats.agility], [30, 6]);
  fresh(); online(1);
  assert.equal(setFold(wearSet(player(), 'starspun', 1)).resist?.poison ?? 0, 0, 'one piece wakes nothing');
  fresh();
  assert.equal(setFold(wearSet(player(), 'starspun', 2)).resist?.poison ?? 0, 0, 'asleep offline');
});

test('STAR7 BOUND IN SILK (4): every 4th weapon blow of mine that lands on the same foe is the one the web holds - its per cent more, and the count cut back to none; each foe its own count, held STRAND_SECONDS from the last; a foe\'s death ends its strands; never on a player, nor asleep (mutants: the count, the reset, the window, one count moved foe to foe)', () => {
  fresh(); online(1);
  const e = wearSet(player(), 'starspun', 4);
  door({ me: e });
  const s = sword();
  at(10);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map(() => swing(e, s, RAT)), [100, 100, 100, 160, 100, 100, 100, 160], 'every 4th: +60% at Faint');
  assert.equal(strandsAt(RAT), 0, 'the held blow cut the count');
  swing(e, s, RAT); swing(e, s, RAT);
  assert.equal(swing(e, s, WOLF), 100, 'another foe: its own count');
  assert.equal(strandsAt(RAT), 2, 'the first keeps its own');
  assert.equal(strandCount(), 1, 'the states say the foe struck last');
  assert.equal(swing(e, s, RAT), 100);
  assert.equal(swing(e, s, RAT), 160, 'its 4th');
  swing(e, s, RAT); swing(e, s, RAT); swing(e, s, RAT);
  at(10 + STRAND_SECONDS + 0.01);
  assert.equal(strandsAt(RAT), 0, 'fallen away past the window');
  assert.equal(swing(e, s, RAT), 100, 'the count begun again');
  swing(e, s, RAT); swing(e, s, RAT);
  reportPlayerKill(RAT);
  assert.equal(strandsAt(RAT), 0, 'a foe\'s death ends its strands');
  swing(e, s, { isPlayer: true, name: 'duelist' }); swing(e, s, { isPlayer: true, name: 'duelist' });
  assert.equal(strandCount(), 0, 'never on a player');
  assert.equal(setBlow(s, 100, e, WOLF, { estimate: true }), 100, 'an estimate spends nothing and adds nothing it has not earned');
  fresh(); online(40);
  const asc = wearSet(player(), 'starspun', 4, XP[4]);
  door({ me: asc });
  assert.deepEqual([1, 2, 3, 4].map(() => swing(asc, s, WOLF)), [100, 100, 100, 240], 'Ascendant: +140%');
  fresh(); online(1);
  const three = wearSet(player(), 'starspun', 3);
  door({ me: three });
  assert.deepEqual([1, 2, 3, 4].map(() => swing(three, s, RAT)), [100, 100, 100, 100], 'three pieces wake no Bound in Silk');
});

test('STAR7 MEPHALA\'S VEIL (6): a foe\'s blow that takes me under VEIL_BELOW of my health hides me - Chameleon on me through the player\'s own door, its rounds and one more - then it recovers, says it is ready, and shows its recovery as a chip; never on a killing blow, never without a foe\'s blow, never from under the line (mutants: the line; the crossing; the recovery; a killing blow hidden)', () => {
  const v = fresh(); online(1);
  const e = wearSet(player(), 'starspun', 6);
  const d = door({ me: e });
  at(10);
  blow(e, 75);
  assert.equal(e.health, 25);
  assert.equal(d.casts.length, 1, 'hidden');
  assert.deepEqual(d.casts[0], veilBundle(2));
  assert.equal(d.casts[0].name, "Mephala's Veil");
  assert.deepEqual([d.casts[0].effects[0].type, d.casts[0].effects[0].subType, d.casts[0].effects[0].durationBase], [23, 0, 3], 'Chameleon, its rounds and one more');
  assert.deepEqual(v.said, ["Mephala's Veil! Chameleon for 10 s."]);   // PIN MOVED (AUDIT STAR W6): the effect and how long, never a feeling
  assert.deepEqual(v.sounds, ['veil']);
  assert.deepEqual(setHudChips(e, 10).map((c) => [c.key, c.set, c.state, c.text]), [['veil', 'starspun', 'recovering', '4:00']]);
  assert.equal(setPowerStates(10).veilRecoverLeft, 240);
  e.health = 100;
  at(20);
  blow(e, 75);
  assert.equal(d.casts.length, 1, 'recovering: nothing');
  at(260);
  setRound(e);
  assert.deepEqual(v.said.slice(-1), ["Mephala's Veil is ready again."]);
  e.health = 25;
  blow(e, 5);
  assert.equal(d.casts.length, 1, 'already under the line: no crossing');
  e.health = 100;
  blow(e, 65);
  assert.equal(d.casts.length, 1, 'at 35, over the line: nothing');
  e.health = 50;
  hurtPlayer(e, 25);
  assert.equal(d.casts.length, 1, 'a fall\'s hurt hides nothing');
  e.health = 40;
  blow(e, 40);
  assert.equal(d.casts.length, 1, 'a killing blow hides nothing');
  assert.equal(setPowerStates().veilRecoverLeft, 0, 'and spends no recovery');
  fresh(); online(40);
  const asc = wearSet(player(), 'starspun', 6, XP[4]);
  const d2 = door({ me: asc });
  at(5);
  blow(asc, 75);
  assert.equal(d2.casts[0].effects[0].durationBase, 5, 'Ascendant: four rounds and one more');
  assert.equal(setPowerStates(5).veilRecoverLeft, 120);
  fresh(); online(1);
  const five = wearSet(player(), 'starspun', 5);
  const d3 = door({ me: five });
  blow(five, 75);
  assert.equal(d3.casts.length, 0, 'five pieces wake no Veil');
  assert.deepEqual(awakeTiersOf(five).get('starspun').map((t) => t !== null), [true, true, false]);
});

test('STAR7 STARGLASS: template 576, its row a leaf the law reads headless - light, stacked, never bound, a good price; miscellany, never a gem; minted as one stack (mutants: the template, the bound, the group)', () => {
  assert.equal(STARGLASS_TEMPLATE, 576);
  assert.deepEqual(STARGLASS_LAW_ROW, { index: 576, baseWeight: 0.1, hitPoints: 1000, basePrice: 400, rarity: 20, stackable: true });
  assert.ok(!('bound' in STARGLASS_LAW_ROW), 'never bound - the holder\'s to sell or give');
  assert.equal(lawTemplate(576)?.index, 576, 'the law knows it');
  assert.equal(templateByIndex(576)?.name, 'Starfall Glass');   // PIN MOVED (AUDIT STAR I1): the sea's trade good is Starglass
  assert.equal(STARGLASS_ROW.worldTextureArchive, STARGLASS_ARCHIVE);
  const s = starglass(3);
  assert.deepEqual([s.group, s.templateIndex, s.stackCount], ['UselessItems2', 576, 3]);
  assert.equal(isStarglass(s), true);
  assert.equal(isStarglass({ ...s, group: 'Gems' }), false);
  assert.equal(isBound(s), false);
  assert.ok(validLootItem(JSON.parse(JSON.stringify(s))), 'off the wire');
  assert.equal(starglass(0).stackCount, 1, 'at least one');
});

test('STAR7 STARGLASS\'S PICTURE: its own pseudo-archive, painted in code - an upright sliver in the stone\'s glass with a violet vein, outlined, its ground clear; the same pixels every call; on the texture door once (mutants: the archive, the ground, the palette, the once)', async () => {
  assert.equal(STARGLASS_ARCHIVE, 38302);
  const row = PSEUDO_ARCHIVES.find((r) => r.from === STARGLASS_ARCHIVE);
  assert.deepEqual([row?.owner, row?.name], ['world/starfall/starglassArt.js', 'STARGLASS_ARCHIVE']);
  assert.deepEqual(pseudoArchiveCollisions(), []);
  const img = starglassArt();
  assert.deepEqual([img.width, img.height], [STARGLASS_ART_SIZE.w, STARGLASS_ART_SIZE.h]);
  const pal = new Set([...STAR_RAMPS.glass, ...STAR_RAMPS.vein, STARGLASS_OUTLINE].map((c) => c.join()));
  let glass = 0, vein = 0, clear = 0;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    const i = (y * img.width + x) * 4, rgb = [img.colors[i], img.colors[i + 1], img.colors[i + 2]].join(), k = starglassTexel(x, y);
    if (k === 'glass') glass++;
    if (k === 'vein') vein++;
    if (k) assert.ok(pal.has(rgb), `${x},${y} in its palette`);
    else if (rgb !== '0,0,0') assert.equal(rgb, STARGLASS_OUTLINE.join(), `${x},${y} outline or clear`);
    else clear++;
  }
  assert.ok(glass > 100 && vein > 8 && clear > 100, `${glass} glass, ${vein} vein, ${clear} clear`);
  assert.deepEqual(starglassArt().colors, img.colors, 'the same pixels');
  _resetStarglassArt();
  const got = [];
  assert.equal(registerStarglassArt((es) => { got.push(...es); return es.length; }), 1);
  assert.equal(registerStarglassArt(() => 1), 0, 'once');
  assert.deepEqual([got[0].archive, got[0].record, got[0].standIn], [STARGLASS_ART.archive, STARGLASS_ART.record, true]);
  const built = await got[0].build();
  assert.deepEqual([built.width, built.height], [img.width, img.height]);
});

test('STAR7 THE SPOILS: off the receipt\'s seed - gold 60 a level a fifth either way, one to three Starglass, one piece Magic or better and known, a Starspun piece last a quarter of the time; the Heart-Star doubles the gold and the Starglass and always carries one; the list hands the pieces, the Starglass, then the gold; their own keys (mutants: the gold, the glass, the doubling, the order, a key shared)', () => {
  const n = starNightAt(FESTIVAL_FROM_MS) + 30, k = 1;
  const s = rollStarSpoils(12345, 10, n, k);
  assert.deepEqual([STAR_SPOILS_GOLD_PER_LEVEL, STARGLASS_MAX], [60, 3], 'the design\'s numbers');
  assert.ok(s.gold >= STAR_SPOILS_GOLD_PER_LEVEL * 10 * 0.8 && s.gold <= STAR_SPOILS_GOLD_PER_LEVEL * 10 * 1.2, `${s.gold}`);
  assert.equal(s.starglass.templateIndex, 576);
  assert.ok(s.starglass.stackCount >= 1 && s.starglass.stackCount <= STARGLASS_MAX);
  assert.ok(['magic', 'rare', 'legendary'].includes(s.pieces[0].tier));
  assert.equal(s.pieces[0].item.isIdentified, true);
  assert.deepEqual(JSON.parse(JSON.stringify(rollStarSpoils(12345, 10, n, k))), JSON.parse(JSON.stringify(s)), 'the seed\'s own');
  const glass = new Set(), sets = [];
  for (let i = 0; i < 400; i++) { const r = rollStarSpoils(i * 7919 + 1, 10, n, k); glass.add(r.starglass.stackCount); sets.push(r.pieces.length > 1); }
  assert.deepEqual([...glass].sort(), [1, 2, 3]);
  const share = sets.filter(Boolean).length / sets.length;
  assert.ok(share > 0.17 && share < 0.33, `a quarter of the time (${share})`);
  let hn = n;
  while (!witchesNight(hn)) hn++;
  for (let i = 0; i < 40; i++) {
    const plain = rollStarSpoils(i + 1, 10, hn, 0), heart = rollStarSpoils(i + 1, 10, hn, HEART_STAR);
    assert.equal(heart.gold % 2, 0);
    assert.equal(heart.gold, plain.gold * 2, 'the gold doubled');
    assert.equal(heart.starglass.stackCount, plain.starglass.stackCount * 2, 'the Starglass doubled');
    assert.equal(heart.pieces.at(-1).item.sigil?.set, 'starspun', 'a Starspun piece every time');
  }
  const list = starSpoilsList(12345, 10, n, k);
  assert.deepEqual(list.map((p) => p.kind), [...s.pieces.map(() => 'item'), 'item', 'gold']);
  assert.equal(list.at(-2).item.templateIndex, 576);
  assert.equal(list.at(-1).gold, s.gold);
  assert.equal(starSpoilsDay(n, k), `star:${n}.${k}`);
  assert.notDeepEqual(STAR_SPOILS_KEYS, RAID_SPOILS_KEYS);
  assert.notDeepEqual(STAR_SPOILS_KEYS, SERPENT_SPOILS_KEYS);
  assert.equal(STAR_SPOILS_TEXT.granted(), 'The star\'s spoils are in your pack.');   // PIN MOVED (AUDIT STAR W5): gold, glass and a piece, never the glass alone
  assert.equal(STAR_SPOILS_TEXT.kept('Ann'), 'A fallen star\'s spoils wait for Ann.');
  assert.equal(STAR_SPOILS_TEXT.kept(null), 'A fallen star\'s spoils wait for the one who held it.');
});
