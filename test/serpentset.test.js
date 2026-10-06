// SERPENT-SET (2026-10-05, Mac: "The serpent boss needs to use the currency from oblivion gate and have its own equipment
// rewards"): THE SEA SERPENT PAYS THE GATE'S CURRENCY, AND HAS A SET OF ITS OWN - the hoard's Deadlands Ember
// (systems/serpentSpoils.js, net/serpentHoardLaw.js), Sethrakul's Coilscale: its law (systems/sigilSets.js), its nine
// Aetheric records and the wire's check of them (systems/aetheric.js), each power driven through the REAL seams SET2
// opened (systems/sigilSetPowers.js - the fold, the blow, the strike, the hurt, the kill, the round, the HUD's chips)
// with a stand-in for the running host's door and a clock of the test's own, the hoard's roll off a receipt's seed, the
// one heal a power gives (systems/playerHeal.js), the Broker's shelf that never carries it, and the host's wiring by
// source (scenes/world.js, net/serpentClaims.js). Design: bible/11-Multiplayer/Sigil-Sets.md section 6c;
// bible/11-Multiplayer/Sea-Serpent.md section 8. The service's half: test/serpentset_service.test.js.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  setBlow, setStrike, setStruck, setRound, setPowerStates, setHudChips, setSetPowersVoice, coilStacks, coiledFoe, coilStacksAt, awakeTiersOf,
  _setSetPowersClockForTests, _resetSetPowersForTests,
} from '../src/systems/sigilSetPowers.js';
import { setSigilOnline, setSigilRenown, SIGIL_STAGES, SIGIL_SET_IDS, SIGIL_BANDS, _resetSigilForTests } from '../src/systems/sigil.js';
import {
  SIGIL_SETS, WORLD_SET_IDS, BRIEF_MAX, SET_STAGE_MAX, COIL_STACKS, COIL_SECONDS, SHED_BELOW, setById, raidSetOf, tierValues, setSetsDueling,
  _resetSigilSetsForTests,
} from '../src/systems/sigilSets.js';
import {
  AETHERIC_RECORDS, REGALIA, RAID_SET_PIECES, RAID_SET_CHANCE, SERPENT_SET_PIECES, SERPENT_SET_POWER, SERPENT_SET_CHANCE,
  aethericById, aethericMaterial, mintAetheric, rollSerpentSetPiece, validSetMarks, AETHERIC,
} from '../src/systems/aetheric.js';
import { rollSerpentSpoils, serpentSpoilsList, serpentEmbers } from '../src/systems/serpentSpoils.js';
import { SERPENT_EMBERS } from '../src/net/serpentHoardLaw.js';
import { SIGIL_STONE_TEMPLATE, isSigilStone } from '../src/systems/gateSpoils.js';
import { brokerStock } from '../src/systems/sigilBroker.js';
import { healMine, _resetPlayerHealForTests } from '../src/systems/playerHeal.js';
import { createSerpentClaims } from '../src/net/serpentClaims.js';
import { mintSerpentReceipt } from '../src/net/serpentReceipt.js';
import { importReceiptKey } from '../src/net/gateReceipt.js';
import { entityStatMod, entityModsOf } from '../src/systems/entityMods.js';
import { hurtPlayer } from '../src/characters/playerEntity.js';
import { reportPlayerKill } from '../src/systems/playerKills.js';
import { setPlayerDoor } from '../src/systems/playerDoor.js';
import { equipItem } from '../src/systems/equip.js';
import { mintCondition } from '../src/systems/itemTemplates.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { WEAPON_MATERIALS } from '../src/characters/weapons.js';
import { WEAPON_HANDS } from '../src/characters/equipRules.js';
import { SKILLS } from '../src/systems/skills.js';
import { AFFIX_RANGES } from '../src/systems/lootRarity.js';
import { validLootItem } from '../src/systems/loot.js';
import { isBound } from '../src/systems/itemBound.js';

const { subtle } = globalThis.crypto;
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
/** A foe's blow at me as the game deals one: the formula's struck tail marks it, then my damage door takes it. */
const blow = (e, n, attacker = RAT) => { setStruck(attacker, e, n); return hurtPlayer(e, n); };
function door(foes = [], { feet = [0, 0, 0], me = null } = {}) {
  const d = { hurts: [], casts: [] };
  setPlayerDoor({
    foes: () => foes.filter((f) => !f.dead && f.entity),
    feet: () => feet,
    hurtFoe: (f, n) => { d.hurts.push([f.name, n]); },
    castOnPlayer: (b) => { d.casts.push(b); },
    player: () => me,
  });
  return d;
}
const seq = (...xs) => { let i = 0; return () => xs[Math.min(i++, xs.length - 1)]; };
/** One weapon blow of mine at `target` as the game deals it: the blow's modifiers, then (landed) the strike's tail. */
const swing = (e, weapon, target, n = 100) => { const d = setBlow(weapon, n, e, target, {}); setStrike(e, target, d, weapon); return d; };

// ─── THE LAW ──────────────────────────────────────────────────────────────────────────────────────────────────────────

test('SERPENT-SET the law: Sethrakul\'s Coilscale after the raids\' three - Aetheric, Satakal its patron, no raiding party\'s, never a world set; Sea-Scale, Constrict and Shed Skin at 2, 4 and 6 pieces, each a whole pair from Faint to Ascendant, every brief inside BRIEF_MAX at every stage (mutants: the set out of the record; a world set; a raid\'s; a tier\'s number)', () => {
  assert.deepEqual(SIGIL_SET_IDS.slice(-1), ['coilscale'], 'the serpent\'s own, after the raids\'');
  const s = setById('coilscale');
  assert.deepEqual([s.id, s.name, s.prince, s.colour, s.aetheric, 'raid' in s, s.role],
    ['coilscale', "Sethrakul's Coilscale", 'Satakal', '#3a9ad9', true, false, 'The Old Coil, shed and worn']);
  assert.ok(!WORLD_SET_IDS.includes('coilscale'), 'no world drop rolls it');
  assert.deepEqual([0, 1, 2].map((p) => raidSetOf(p)?.id), ['oath', 'thieftaker', 'orcsbane'], 'no raiding party pays it');
  assert.deepEqual(s.tiers.map((t) => [t.at, t.key, t.name, t.values]), [
    [2, 'sea-scale', 'Sea-Scale', { frost: [10, 30], endurance: [2, 6] }],
    [4, 'constrict', 'Constrict', { stack: [3, 8] }],
    [6, 'shed-skin', 'Shed Skin', { heal: [10, 30], recover: [240, 120] }],
  ]);
  assert.deepEqual([COIL_STACKS, COIL_SECONDS, SHED_BELOW], [5, 6, 0.35]);
  for (const t of s.tiers) {
    for (let st = 0; st <= SET_STAGE_MAX; st++) {
      const b = t.brief(tierValues(t, st));
      assert.ok(b.length <= BRIEF_MAX, `${t.key} at ${st}: "${b}" (${b.length})`);
    }
  }
  assert.equal(s.tiers[2].brief(tierValues(s.tiers[2], 0)), 'Under 35%: shed skin, heal 10%');
  assert.equal(s.tiers[1].brief(tierValues(s.tiers[1], SET_STAGE_MAX)), '+8% a blow on each foe, to 5');   // PIN MOVED (AUDIT 625 P3): each foe its own coil
});

test('SERPENT-SET the records: nine in the places\' order - the seven body pieces, a kite shield and a ONE-HANDED Katana (so all nine are worn at once) - Ebony, the set\'s own; every affix at the Legendary band\'s middle (over a town\'s thanks, under the Warden), the blow the band\'s middle too; never a frost resistance and one resistance of an element at most; AETHERIC_RECORDS the Regalia, the raids\' and then these (mutants: a number off the middle; a frost piece; the make; the order)', () => {
  assert.equal(SERPENT_SET_PIECES.length, 9);
  assert.deepEqual(SERPENT_SET_PIECES.map((r) => [r.id, r.group, r.templateIndex]), [
    ['coilscale-crest', 'Armor', 107], ['coilscale-right-pauldron', 'Armor', 106], ['coilscale-left-pauldron', 'Armor', 105],
    ['coilscale-hide', 'Armor', 102], ['coilscale-grip', 'Armor', 103], ['coilscale-greaves', 'Armor', 104],
    ['coilscale-boots', 'Armor', 108], ['coilscale-shield', 'Armor', 111], ['coilscale-fang', 'Weapons', 121],
  ]);
  assert.equal(WEAPON_HANDS['121'], 'Either', 'the Katana is one-handed - the shield beside it');
  for (const r of SERPENT_SET_PIECES) assert.deepEqual([r.set, r.make], ['coilscale', 'Ebony'], r.id);
  assert.equal(SERPENT_SET_POWER, 10);
  assert.equal(SERPENT_SET_POWER, Math.round((SIGIL_BANDS.legendary[0] + SIGIL_BANDS.legendary[1]) / 2));
  assert.equal(aethericById('coilscale-fang').power, 10);
  const mid = (id) => Math.round((AFFIX_RANGES[id].legendary[0] + AFFIX_RANGES[id].legendary[1]) / 2);
  assert.deepEqual(['armor', 'stat', 'resist', 'skill', 'weight', 'damage'].map(mid), [16, 13, 43, 25, 43, 30]);
  for (const r of SERPENT_SET_PIECES) for (const a of r.affixes) assert.equal(a.value, mid(a.id), `${r.id} ${a.id}`);
  assert.deepEqual(SERPENT_SET_PIECES.map((r) => r.affixes.map((a) => a.param ?? a.id)), [
    ['armor', 'willpower', 'shock'], ['armor', 'strength', SKILLS.Swimming], ['armor', 'endurance', 'poison'],
    ['armor', 'endurance', 'willpower'], ['armor', 'strength', SKILLS.LongBlade], ['armor', 'agility', 'weight'],
    ['armor', 'speed', SKILLS.Running], ['armor', 'endurance', 'magic'], ['damage', 'agility', SKILLS.LongBlade],
  ]);
  const resists = SERPENT_SET_PIECES.flatMap((r) => r.affixes.filter((a) => a.id === 'resist').map((a) => a.param));
  assert.ok(!resists.includes('frost'), 'never frost - Sea-Scale carries it');
  assert.equal(new Set(resists).size, resists.length, 'one resistance of an element at most');
  assert.deepEqual(AETHERIC_RECORDS, [...REGALIA, ...RAID_SET_PIECES, ...SERPENT_SET_PIECES]);
  assert.equal(new Set(AETHERIC_RECORDS.map((r) => r.id)).size, AETHERIC_RECORDS.length, 'every id its own');
});

test('SERPENT-SET minted and checked: each record mints as its make - Ebony armour, an Ebony Katana - Aetheric, known, its set\'s sigil fresh at Faint (the Fang\'s with its blow), and passes the wire\'s check; an affix past its record, another set\'s sigil or another make is no item (mutants: the material; the check\'s ceiling)', () => {
  for (const r of SERPENT_SET_PIECES) {
    const it = mintAetheric(r);
    assert.deepEqual([it.name, it.rarity, it.aetheric, it.isIdentified], [r.name, AETHERIC, r.id, true], r.id);
    assert.equal(it.material, aethericMaterial(r), r.id);
    assert.deepEqual(it.sigil, r.group === 'Weapons' ? { power: 10, set: 'coilscale', party: 1, xp: 0 } : { set: 'coilscale', party: 1, xp: 0 });
    assert.ok(validLootItem(JSON.parse(JSON.stringify(it))), `${r.id} off the wire`);
  }
  assert.equal(mintAetheric(aethericById('coilscale-fang')).material, WEAPON_MATERIALS.Ebony);
  assert.equal(mintAetheric(aethericById('coilscale-hide')).material, ARMOR_MATERIAL.Ebony);
  const over = mintAetheric(aethericById('coilscale-crest'));
  over.affixes[2].value = 44;
  assert.equal(validSetMarks(over), null, 'a resistance past the record\'s is a forgery');
  const theirs = mintAetheric(aethericById('coilscale-greaves'));
  theirs.sigil.set = 'oath';
  assert.equal(validSetMarks(theirs), null, 'another set\'s sigil on a Coilscale piece');
  const steel = mintAetheric(aethericById('coilscale-boots'));
  steel.material = ARMOR_MATERIAL.Steel;
  assert.equal(validSetMarks(steel), null, 'another make');
});

test('SERPENT-SET the drop: a quarter of a hoard (the raids\' own share), the same seed choosing which - one roll when nothing drops, two when a piece does; never on a world drop or the Broker\'s shelf (mutants: the chance; the pick)', () => {
  assert.equal(SERPENT_SET_CHANCE, 1 / 4);
  assert.equal(SERPENT_SET_CHANCE, RAID_SET_CHANCE);
  let calls = 0;
  const counted = (...xs) => { const r = seq(...xs); return () => { calls++; return r(); }; };
  assert.equal(rollSerpentSetPiece(counted(0.25)), null, 'not under the line');
  assert.equal(calls, 1, 'one roll when nothing drops');
  calls = 0;
  assert.equal(rollSerpentSetPiece(counted(0.2, 0.5)).aetheric, 'coilscale-grip');
  assert.equal(calls, 2, 'two when a piece does');
  assert.equal(rollSerpentSetPiece(seq(0.24999, 0.9999)).aetheric, 'coilscale-fang');
  assert.equal(rollSerpentSetPiece(seq(0, 0)).aetheric, 'coilscale-crest');
  for (let d = 0; d < 60; d++) assert.ok(!brokerStock(d).some((o) => o.set === 'coilscale' || o.item?.sigil?.set === 'coilscale'), `day ${d}: the Broker never shelves it`);
  assert.match(strip(read('src/systems/sigilBroker.js')), /for \(const set of WORLD_SET_IDS\)[\s\S]*const wset = pick\(WORLD_SET_IDS, rolls\);[\s\S]*offer\('regalia', 'ruhn',/, 'the Broker shelves the world\'s sets and the Regalia alone');
});

// ─── THE HOARD ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('SERPENT-SET the hoard: every hoard - a ship that dealt and one that stood - carries SERPENT_EMBERS Deadlands Embers, the gate\'s own (template 570, bound), between its pieces and its gold; a dealer\'s hoard a quarter of the time a Coilscale piece, LAST, a stander\'s never; the seed\'s own, every earlier roll what it was (mutants: no ember; the ember a roll; the set before the last pass; a stander\'s set)', () => {
  assert.equal(SERPENT_EMBERS, 1);
  const e = serpentEmbers();
  assert.deepEqual([e.templateIndex, e.name, e.stackCount, isSigilStone(e), isBound(e)], [SIGIL_STONE_TEMPLATE, 'Deadlands Ember', 1, true, true]);
  for (const x of ['dealt', 'stood']) {
    const list = serpentSpoilsList(2, 12, x);
    const ember = list.filter((p) => p.kind === 'item' && isSigilStone(p.item));
    assert.equal(ember.length, 1, `${x}: one stack`);
    assert.equal(ember[0].item.stackCount, SERPENT_EMBERS);
    assert.equal(list[list.length - 1].kind, 'gold', 'the gold last');
    assert.equal(list[list.length - 2].item, ember[0].item, 'the embers just before it');
  }
  // the seed's own, pinned whole: a dealer's seed 2 at level 12 finds Constrictor's Grip, after the hoard's own two
  const h = rollSerpentSpoils(2, 12, 'dealt');
  assert.deepEqual([h.gold, h.pieces.map((p) => [p.item.name, p.tier])], [2100, [
    ["Warrior's Broadsword of Skill", 'rare'], ["Porter's Amulet", 'magic'], ["Constrictor's Grip", 'aetheric'],
  ]]);
  assert.deepEqual(rollSerpentSpoils(2, 12, 'dealt'), h, 'the same seed, the same hoard');
  assert.ok(validLootItem(JSON.parse(JSON.stringify(h.pieces[2].item))));
  const stood = rollSerpentSpoils(2, 12, 'stood');
  assert.deepEqual([stood.gold, stood.pieces.map((p) => p.tier)], [1260, ['magic']], 'a stander: the Magic piece alone');
  let dealt = 0, coil = 0, stander = 0;
  for (let s = 1; s <= 2000; s++) {
    dealt++;
    if (rollSerpentSpoils(s, 10, 'dealt').pieces.some((p) => p.tier === AETHERIC)) coil++;
    if (rollSerpentSpoils(s, 10, 'stood').pieces.some((p) => p.tier === AETHERIC)) stander++;
  }
  assert.ok(Math.abs(coil / dealt - SERPENT_SET_CHANCE) < 0.035, `a quarter of dealers: ${coil}/${dealt}`);
  assert.equal(stander, 0, 'a ship that stood never finds one');
});

// ─── THE POWERS ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('SERPENT-SET Sea-Scale (2): one fold over RF1\'s channels - frost resistance and Endurance, Faint to Ascendant; nothing with one piece, nothing asleep (mutants: the element; the stat)', () => {
  fresh(); online(1);
  assert.deepEqual(entityModsOf(wearSet(player(), 'coilscale', 1)).resist, {}, 'one piece wakes nothing');
  const e = wearSet(player(), 'coilscale', 2);
  assert.deepEqual(entityModsOf(e).resist, { frost: 10 }, 'Faint: +10 frost');
  assert.equal(entityStatMod(e, 'endurance'), 2);
  assert.equal(entityStatMod(e, 'willpower'), 0, 'Endurance alone');
  fresh(); online(40);
  const asc = wearSet(player(), 'coilscale', 2, XP[4]);
  assert.deepEqual(entityModsOf(asc).resist, { frost: 30 });
  assert.equal(entityStatMod(asc, 'endurance'), 6);
  fresh();
  assert.deepEqual(entityModsOf(wearSet(player(), 'coilscale', 2)).resist, {}, 'offline the sets sleep');
});

test('SERPENT-SET Constrict (4): each weapon blow of mine that LANDS on a foe tightens ITS coil - its per cent a stack at that foe, up to COIL_STACKS, held COIL_SECONDS from the last; another foe starts its own and the first keeps its (AUDIT 625 P3, Mac: "A coil per foe"); a bow\'s blow counts; the coiled foe\'s death ends it; never on a player, nor asleep (mutants: the cap; the window; one coil moved foe to foe; the bow refused; the death ignored)', () => {
  fresh(); online(1);
  const e = wearSet(player(), 'coilscale', 4);
  door([], { me: e });
  const s = sword();
  at(10);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(() => swing(e, s, RAT)), [100, 103, 106, 109, 112, 115, 115], 'three per cent a stack at Faint, five at the most');
  assert.equal(coilStacks(10), COIL_STACKS);
  assert.equal(coiledFoe(10), RAT);
  assert.equal(swing(e, s, WOLF), 100, 'another foe: its own coil, nothing yet');
  assert.equal(coiledFoe(10), WOLF, 'the states say the foe struck last');
  // PIN MOVED (AUDIT 625 P3, Mac: "A coil per foe"): the first foe's coil was let go - it is its own now, and holds
  assert.equal(swing(e, s, RAT), 115, 'the first foe keeps its own five');
  at(10 + COIL_SECONDS - 0.01);
  assert.equal(coilStacks(), COIL_STACKS, 'held to the window\'s end');
  assert.equal(coilStacksAt(WOLF), 1, 'the other foe its own');
  at(10 + COIL_SECONDS + 0.01);
  assert.equal(coilStacks(), 0, 'and gone past it');
  assert.equal(coilStacksAt(WOLF), 0);
  assert.equal(swing(e, s, RAT), 100);
  at(20);
  swing(e, bow(), RAT, 10);
  assert.equal(coilStacks(), 2, 'a bow\'s blow tightens it too');
  reportPlayerKill(RAT);
  assert.equal(coilStacks(), 0, 'the coiled foe\'s death ends it');
  swing(e, s, { isPlayer: true, name: 'duelist' });
  assert.equal(coilStacks(), 0, 'never on a player');
  fresh(); online(1);
  const two = wearSet(player(), 'coilscale', 3);
  door([], { me: two });
  swing(two, s, RAT); swing(two, s, RAT);
  assert.equal(coilStacks(), 0, 'three pieces wake no Constrict');
  fresh(); online(40);
  const asc = wearSet(player(), 'coilscale', 4, XP[4]);
  door([], { me: asc });
  assert.deepEqual([1, 2, 3].map(() => swing(asc, s, RAT)), [100, 108, 116], 'Ascendant: eight a stack');
  fresh();
  const off = wearSet(player(), 'coilscale', 4);
  swing(off, s, RAT); swing(off, s, RAT);
  assert.equal(coilStacks(), 0, 'asleep offline');
});

test('SERPENT-SET Shed Skin (6): a foe\'s blow that takes me under SHED_BELOW of my health sheds my skin - its share of my health returns at once, through the one heal a power gives - then it recovers, says it is ready, and shows its recovery as a chip; never on a killing blow, never without a foe\'s blow, never from under the line (mutants: the line; the crossing; a heal past the maximum; the recovery; a killing blow healed)', () => {
  const v = fresh(); online(1);
  const e = wearSet(player(), 'coilscale', 6);
  door([], { me: e });
  at(10);
  blow(e, 70);
  assert.equal(e.health, 40, '30 left, under 35: shed - a tenth of 100 back');
  assert.deepEqual(v.said, ['Shed Skin! 10 health returns.']);
  assert.deepEqual(v.sounds, ['shed']);
  assert.deepEqual(setHudChips(e, 10).map((c) => [c.key, c.set, c.state, c.text]), [['shed', 'coilscale', 'recovering', '4:00']]);
  assert.equal(setPowerStates(10).shedRecoverLeft, 240);
  e.health = 100;
  at(20);
  blow(e, 70);
  assert.equal(e.health, 30, 'recovering: no shed');
  at(250);
  setRound(e);
  assert.deepEqual(v.said.slice(-1), ['Shed Skin is ready again.']);
  e.health = 30;
  blow(e, 5);
  assert.equal(e.health, 25, 'already under the line: no crossing, no shed');
  e.health = 100;
  blow(e, 60);
  assert.equal(e.health, 40, 'at 40, over the line: no shed');
  e.health = 50;
  hurtPlayer(e, 20);
  assert.equal(e.health, 30, 'a fall\'s hurt - no foe\'s blow - sheds nothing');
  e.health = 40;
  blow(e, 40);
  assert.equal(e.health, 0, 'a killing blow from over the line sheds nothing');
  assert.equal(setPowerStates().shedRecoverLeft, 0, 'and spends no recovery');
  assert.equal(v.said.filter((l) => l.startsWith('Shed Skin!')).length, 1, 'the one shed, said once');
  const w = fresh(); online(40);
  const asc = wearSet(player(), 'coilscale', 6, XP[4]);
  door([], { me: asc });
  at(5);
  blow(asc, 70);
  assert.equal(asc.health, 60, 'Ascendant: three tenths back');
  assert.equal(setPowerStates(5).shedRecoverLeft, 120);
  assert.deepEqual(w.said, ['Shed Skin! 30 health returns.']);
  fresh(); online(1);
  const five = wearSet(player(), 'coilscale', 5);
  door([], { me: five });
  blow(five, 70);
  assert.equal(five.health, 30, 'five pieces wake no Shed Skin');
  assert.deepEqual(awakeTiersOf(five).get('coilscale').map((t) => t !== null), [true, true, false]);
});

test('SERPENT-SET the heal: one door for every power - the loot\'s leech and its heals and Shed Skin - never past the maximum, never a body, the fraction carried (mutants: the cap; a body healed; the fraction lost)', () => {
  _resetPlayerHealForTests();
  const e = { health: 50, maxHealth: 60 };
  assert.equal(healMine(e, 25), 10, 'never past the maximum');
  assert.equal(e.health, 60);
  const body = { health: 0, maxHealth: 60 };
  assert.equal(healMine(body, 10), 0, 'a body is never healed');
  assert.equal(body.health, 0);
  const f = { health: 10, maxHealth: 100 };
  assert.equal(healMine(f, 0.5), 0);
  assert.equal(healMine(f, 0.5), 1, 'the fraction carried to the next heal');
  assert.equal(f.health, 11);
  assert.doesNotMatch(strip(read('src/systems/lootPowers.js')), /export function healMine/, 'one heal, never two');
  assert.match(strip(read('src/systems/lootPowers.js')), /import \{ healMine, _resetPlayerHealForTests \} from '\.\/playerHeal\.js';/);
  assert.match(strip(read('src/systems/sigilSetPowers.js')), /import \{ healMine \} from '\.\/playerHeal\.js';/);
  assert.doesNotMatch(strip(read('src/systems/sigilSetPowers.js')), /from '\.\/lootPowers\.js'/, 'the set powers never import the loot\'s (it imports them)');
});

test('SERPENT-SET the sets sleep in a duel: a duel wakes none of the Coilscale\'s tiers (mutants: the duel unread)', () => {
  fresh(); online(1);
  const e = wearSet(player(), 'coilscale', 6);
  door([], { me: e });
  setSetsDueling(true);
  assert.equal(awakeTiersOf(e), null);
  blow(e, 70);
  assert.equal(e.health, 30);
  setSetsDueling(false);
});

// ─── THE HOST ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('SERPENT-SET the host: the Old Coil\'s hoard and its crash door take their spoils by the ember\'s door (the first ember brings On the Burning Doors, as a breach\'s); Shed Skin\'s splash is the voice\'s; the serpent\'s claim says its silver through the raids\' own door (mutants: the plain door back; no splash; no silver lines)', () => {
  const w = strip(read('src/scenes/world.js'));
  assert.match(w, /const serpentSpoils = createSpoilsPool\(\{\s*ray: \(\) => null, now: \(\) => Date\.now\(\) \+ _sharedOffsetMs, take: takeGateSpoil,/);
  assert.match(w, /recoverSpoils\(_spoilsStore, takeGateSpoil, \{ who, saves: enumerateSaves\(\)\.info\.values\(\), onHanded: \(rec\) => serpentSpoils\.adopt\(rec\), key: SERPENT_SPOILS_KEYS\.store/);
  assert.match(w, /else if \(name === 'shed'\) audio\.playOneShot\(SOUND\.SplashLarge, 1\);/);
  assert.match(w, /onMarks: \(data\) => \{ showHaul\(claimHauls\(data, 'serpent'\)\); return marksBook\?\.claimLines\(data, 'serpent'\) \?\? null; \},/);
});

test('SERPENT-SET the claim\'s silver: a counted serpent says its silver lines after its record, the host\'s own lines; a hook that throws is the host\'s, never the carrier\'s - the receipt still settles (mutants: the lines unsaid; a throw breaking the claim)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const priv = await importReceiptKey(Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64'), { subtle });
  const T0S = 1_800_000_000, A = 'acct-aaaa', CH = 'char-0001';
  const r = await mintSerpentReceipt({ d: 363, b: 'sethrakul', s: A, c: 99, x: 'dealt', h: 4, l: 20 }, priv, { subtle, nowS: T0S });
  const answer = { ok: true, data: { recorded: true, slain: 1, spoils: false, renown: { credited: 5 }, marks: { struck: 40, balance: 40 } } };
  const run = async (onMarks) => {
    const mem = new Map();
    const store = { get: (k) => mem.get(k), set: (k, v) => mem.set(k, structuredClone(v)) };
    const said = [], heard = [];
    const c = createSerpentClaims({ claim: async () => answer, store, nowS: () => T0S, nowMs: () => 1_000_000, me: () => A, say: (t) => said.push(t), onMarks, onRecorded: (d) => heard.push(d) });
    assert.equal(c.add(r, CH, 'Ann', 20), true);
    await c.flush();
    return { said, heard, kept: c.kept().length };
  };
  const ok = await run((data) => [`${data.marks.struck} silver struck to your account.`, '']);
  assert.equal(ok.said.length, 2, 'the record\'s line, then the silver\'s (an empty line unsaid)');
  assert.equal(ok.said[1], '40 silver struck to your account.');
  assert.deepEqual([ok.heard.length, ok.kept], [1, 0], 'heard and settled');
  const one = await run((data) => `${data.marks.struck} silver.`);
  assert.equal(one.said[1], '40 silver.', 'one line as well as a list');
  const thrown = await run(() => { throw new Error('the host\'s'); });
  assert.deepEqual([thrown.said.length, thrown.heard.length, thrown.kept], [1, 1, 0], 'a throw is the host\'s - the receipt still settles');
});
