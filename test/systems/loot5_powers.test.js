// LOOT5 - EVERY LEGENDARY A POWER (2026-10-01; bible/06-Systems/Loot-Arc.md section 7, Mac: "Do you wanna turn this
// into an arc and do all of the above?" - "Legendary powers. Give each Legendary one effect that shapes a build. The
// hooks Sigil Sets already use ... would carry them. They'd work offline, like Legendaries do now"). The laws pinned:
//   - THIRTY POWERS: one a record, a name, a brief inside CARD-FIT's 32, a sentence; the card says it.
//   - WHO: MY entity's worn pieces, ONE count a power; a weapon's power rides that weapon's blows; asleep in a duel;
//     nothing with the switch off; offline as online.
//   - WHAT: every kind does what its sentence says through its seam - the blow, the landed strike, the landed foe's
//     blow, my damage door's modifier, death save and hurt, my kill, the cast price, the absorption roll, the round,
//     the host door's finder.

import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import * as LR from '../../src/systems/loot/lootRarity.js';
import * as LP from '../../src/systems/loot/lootPowers.js';
import { setStruck, _resetSetPowersForTests } from '../../src/systems/sigil/sigilSetPowers.js';
import { setSetsDueling, _resetSigilSetsForTests } from '../../src/systems/sigil/sigilSets.js';
import { hurtPlayer } from '../../src/characters/playerEntity.js';
import { reportPlayerKill } from '../../src/systems/playerKills.js';
import { setPlayerDoor } from '../../src/systems/playerDoor.js';
import { equipItem } from '../../src/systems/equip.js';
import { mintCondition } from '../../src/systems/item/itemTemplates.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { EFFECT_FLAGS } from '../../src/systems/spellcast.js';
import { setWorldMinutes } from '../../src/systems/worldTick.js';
import { KNIGHT_CITY_WATCH } from '../../src/characters/mobile/mobileTypes.js';
import { BRIEF_MAX } from '../../src/systems/sigil/sigilSets.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
let T = 0;
LP._setLootPowersClockForTests(() => T);
let R = 0.5;
LP._setLootPowersRandForTests(() => R);
const said = [];
const fresh = () => {
  _resetForTests(); setPref('lootRarity', true); LP._resetLootPowersForTests(); _resetSetPowersForTests(); _resetSigilSetsForTests();
  setPlayerDoor(null); T = 0; R = 0.5; said.length = 0; LP.setLootPowersVoice({ say: (l) => said.push(l) });
};
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = () => ({ isPlayer: true, items: [], stats: stats(), skills: new Array(35).fill(30), level: 5, career: {}, activeEffects: [], health: 100, maxHealth: 100, magicka: 50, maxMagicka: 100, goldPieces: 0 });
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
/** A Legendary of a record, on a base that fits it - minted through the ladder's own door. */
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
const foe = (careerIndex, extra = {}) => ({ careerIndex, career: {}, health: 100, maxHealth: 100, level: 10, ...extra });
const rec = (name, entity, x, z = 0) => ({ name, entity, ai: { feet: [x, 0, z] }, dead: false });
function door(foes = [], me = null) {
  const d = { hurts: [], casts: [] };
  setPlayerDoor({ foes: () => foes.filter((f) => !f.dead), feet: () => [0, 0, 0], hurtFoe: (f, n) => d.hurts.push([f.name, n]), castOnPlayer: (b) => d.casts.push(b), player: () => me });
  return d;
}
const blow = (e, n, attacker) => { setStruck(attacker, e, n); return hurtPlayer(e, n); };

test('LOOT5: thirty powers - one a record, named, briefed inside the card\'s 32, said on the card; registered at every seam', () => {
  fresh();
  assert.equal(Object.keys(LR.LEGENDARY_POWERS).length, 30);
  for (const r of LR.LEGENDARIES) {
    const p = LR.powerOf(r.id);
    assert.ok(p && p.name && p.text && p.kind, r.id);
    assert.ok(p.brief.length <= BRIEF_MAX, `${r.id}: "${p.brief}" fits the card's row (${p.brief.length})`);
  }
  assert.equal(new Set(Object.values(LR.LEGENDARY_POWERS).map((p) => p.name)).size, 30, 'every power its own name');
  assert.equal(LR.powerOf('nope'), null);
  LR.registerLegendary({ id: 'loot5-test-own', name: 'A Test', group: 'Weapons', affixes: [], enchantment: { type: 2, param: 7 }, lore: 'x', power: { name: 'Own', brief: 'its own', kind: 'echo', chance: 1 } });
  assert.equal(LR.powerOf('loot5-test-own').name, 'Own', 'a mod\'s record may carry its own');
  const w = legendary('wyrmbane');
  const lines = LR.rarityLines(w);
  assert.ok(lines.includes('Dragonsbane: +50% vs dragons and giants'), 'the card says it');
  assert.equal(lines.at(-1), LR.legendaryById('wyrmbane').lore, 'the lore still last');
  const src = strip(read('src/systems/loot/lootPowers.js'));
  for (const [seam, fn] of [['registerPlayerDamageMod', 'lootDamageMod'], ['registerPlayerDeathSave', 'lootDeathSave'], ['registerPlayerHurtListener', 'lootHurt'],
    ['registerPlayerKillListener', 'lootKill'], ['registerAbsorptionChance', 'lootAbsorbChance'], ['registerMagicRoundHook', 'lootRound'], ['registerLegendaryFind', 'lootFind']]) {
    assert.match(src, new RegExp(`\\n${seam}\\(LOOT_POWERS, ${fn}\\);`), `${seam} -> ${fn}`);
  }
  assert.match(read('src/scenes/world.js'), /setHudSetChips\(\(e\) => \[\.\.\.setHudChips\(e\), \.\.\.lootHudChips\(e\)\]\);/, 'the HUD hears both');
});

test('LOOT5: who - my worn pieces, one count a power, a weapon\'s on its own blows, asleep in a duel, nothing off', () => {
  fresh();
  const me = player();
  const nw = wear(me, legendary('nightwhisper'));
  assert.deepEqual(LP.wornPowers(me).map((p) => p.id), ['nightwhisper']);
  const second = legendary('nightwhisper');
  wear(me, second);
  assert.equal(LP.wornPowers(me).length, 1, 'a power counts once');
  assert.deepEqual(LP.wornPowers({ ...me, peer: true }), [], 'never a peer');
  const zombie = foe(17);
  assert.equal(LP.lootBlow(nw, 10, me, zombie, { unaware: true }), 20, 'Silent Death on its own blow');
  assert.equal(LP.lootBlow(nw, 10, me, zombie, { unaware: false }), 10, 'a foe that has noticed me: nothing');
  const other = createWeapon(116, 0, () => 0.5);
  assert.equal(LP.lootBlow(other, 10, me, zombie, { unaware: true }), 10, 'another weapon\'s blow: not its power');
  setSetsDueling(true);
  assert.deepEqual(LP.wornPowers(me), [], 'asleep in a duel');
  setSetsDueling(false);
  setPref('lootRarity', false);
  assert.deepEqual(LP.wornPowers(me), [], 'off: nothing');
  setPref('lootRarity', true);
  const forged = Object.assign(createWeapon(120, 0, () => 0.5), { legendary: 'wyrmbane' });   // no tier: not a Legendary
  const you = player();
  wear(you, forged);
  assert.deepEqual(LP.wornPowers(you), [], 'a record id on a piece that is not a Legendary wakes nothing');
});

test('LOOT5: the blow - bane, unaware, sanctified, venom, moon, rage, execute, first blood, flow', () => {
  fresh();
  const me = player();
  const w = wear(me, legendary('wyrmbane'));
  assert.equal(LP.lootBlow(w, 10, me, foe(34), {}), 15, 'a dragonling');
  assert.equal(LP.lootBlow(w, 10, me, foe(16), {}), 15, 'the giant');
  assert.equal(LP.lootBlow(w, 10, me, foe(16, { affinity: 'Human' }), {}), 10, 'a class foe whose career index is 16 is no giant');
  const g = legendary('graveward');
  const me2 = player(); wear(me2, g);
  assert.equal(LP.lootBlow(g, 10, me2, foe(28), {}), 14, 'a vampire is undead');
  assert.equal(LP.lootBlow(g, 10, me2, foe(7), {}), 10);
  const t = legendary('tsaesci-fang'); const me3 = player(); wear(me3, t);
  assert.equal(LP.lootBlow(t, 10, me3, foe(7), {}), 18, '8 poison');
  assert.equal(LP.lootBlow(t, 10, me3, foe(7, { health: 40 }), {}), 26, 'twice under half');
  assert.equal(LP.lootBlow(t, 10, me3, foe(7, { career: { immunityFlags: EFFECT_FLAGS.Poison } }), {}), 10, 'none on the immune');
  const b = legendary('glenmoril-bow'); const me4 = player(); wear(me4, b);
  setWorldMinutes(12 * 60);
  assert.equal(LP.lootBlow(b, 100, me4, foe(4), {}), 100, 'noon: nothing');
  setWorldMinutes(23 * 60);
  assert.equal(LP.lootBlow(b, 100, me4, foe(7), {}), 135, 'night');
  assert.equal(LP.lootBlow(b, 100, me4, foe(4), {}), 170, 'night, and a beast');
  const c = legendary('gortwogs-cleaver'); const me5 = player(); wear(me5, c);
  assert.equal(LP.lootBlow(c, 100, me5, foe(7), {}), 100);
  me5.health = 30;
  assert.equal(LP.lootBlow(c, 100, me5, foe(7), {}), 130, 'under a third');
  const nm = player(); wear(nm, legendary('night-mothers-embrace'));
  const sword = createWeapon(120, 0, () => 0.5);
  assert.equal(LP.lootBlow(sword, 100, nm, foe(7, { health: 20 }), {}), 150, 'armour\'s power rides any blow: under a quarter');
  assert.equal(LP.lootBlow(sword, 100, nm, foe(7, { health: 30 }), {}), 100);
  const dv = player(); wear(dv, legendary('duelists-vambrace'));
  const orc = foe(7);
  assert.equal(LP.lootBlow(sword, 100, dv, orc, {}), 160, 'First Blood');
  LP.lootStrike(dv, orc, 160, sword);
  assert.equal(LP.lootBlow(sword, 100, dv, orc, {}), 100, 'once a foe');
  const ae = legendary('anseis-edge'); const fl = player(); wear(fl, ae);
  for (let i = 0; i < 7; i++) LP.lootStrike(fl, foe(7), 10, ae);
  assert.equal(LP.flowStacks(), 5, 'Flow stacks to five');
  assert.equal(LP.lootBlow(ae, 100, fl, foe(7), {}), 130);
  T = 7;
  assert.equal(LP.flowStacks(), 0, 'and runs out');
  // TWO-HANDS (AUDIT 2): a blow that does not count whole (an off-hand blow's share of the time - formulas.js `blow`)
  // stacks nothing; a whole one, as ever
  LP.lootStrike(fl, foe(7), 10, ae, { blow: false });
  assert.equal(LP.flowStacks(), 0, 'no stack from a blow that does not count whole');
  LP.lootStrike(fl, foe(7), 10, ae, { blow: true });
  assert.equal(LP.flowStacks(), 1);
});

test('LOOT5: the landed strike - chain, quake, echo, open hand, conduit', () => {
  fresh();
  const me = player();
  const struck = foe(7), near = foe(7), far = foe(7), proof = foe(7, { career: { immunityFlags: EFFECT_FLAGS.Shock } });
  const d = door([rec('struck', struck, 0), rec('near', near, 3), rec('far', far, 9)], me);
  const bow = wear(me, legendary('stormcaller'));
  LP.lootStrike(me, struck, 40, bow);
  assert.deepEqual(d.hurts, [['near', 20]], 'half its damage to the nearest other foe within 6 m');
  const d2 = door([rec('struck', struck, 0), rec('proof', proof, 2)], me);
  LP.lootStrike(me, struck, 40, bow);
  assert.deepEqual(d2.hurts, [], 'the shock-proof take none');
  fresh();
  const me2 = player();
  const anvil = wear(me2, legendary('orsiniums-anvil'));
  const d3 = door([rec('struck', struck, 0), rec('a', foe(7), 2), rec('b', foe(7), 2.5, 1), rec('c', foe(7), 5)], me2);
  LP.lootStrike(me2, struck, 40, anvil);
  assert.deepEqual(d3.hurts, [['a', 10], ['b', 10]], 'a quarter to every other foe within 3 m');
  fresh();
  const me3 = player();
  const warp = wear(me3, legendary('warp-edge'));
  const d4 = door([rec('struck', struck, 0)], me3);
  R = 0.2; LP.lootStrike(me3, struck, 33, warp);
  assert.deepEqual(d4.hurts, [], 'nine times in ten, once');
  R = 0.05; LP.lootStrike(me3, struck, 33, warp);
  assert.deepEqual(d4.hurts, [['struck', 33]], 'one time in ten, again');
  fresh();
  const me4 = player();
  wear(me4, legendary('gauntlets-of-the-rose'));
  const d5 = door([rec('struck', struck, 0)], me4);
  LP.lootStrike(me4, struck, 7, null);
  assert.deepEqual(d5.hurts, [['struck', 4]], 'a bare-handed blow lands again - PIN MOVED (BAL7, bible/05-Combat/Balance-Arc.md section 13): for half (3.5, a whole 4)');
  LP.lootStrike(me4, struck, 7, createWeapon(120, 0, () => 0.5));
  assert.equal(d5.hurts.length, 1, 'a weapon\'s does not');
  fresh();
  const me5 = player();
  const staff = wear(me5, legendary('direnni-staff'));
  me5.magicka = 10;
  LP.lootStrike(me5, struck, 5, staff);
  assert.equal(me5.magicka, 13, '3 magicka a blow');
  LP.lootStrike(me5, struck, 5, staff, { blow: false });
  assert.equal(me5.magicka, 13, 'TWO-HANDS (AUDIT 2): none from a blow that does not count whole (formulas.js `blow`)');
  LP.lootStrike(me5, struck, 5, staff, { blow: true });
  assert.equal(me5.magicka, 16);
  assert.equal(LP.lootCastCost(me5, 100), 80, 'and 20% off a spell while wielded');
});

test('LOOT5: the damage I take - Dawnward, the Raven, Hex, Bedrock, Bulwark, Last Stand, Unyielding; a fall is no blow', () => {
  fresh();
  const orc = foe(7);
  let me = player(); wear(me, legendary('aegis-of-dawn'));
  for (let i = 0; i < 5; i++) blow(me, 2, orc);
  assert.equal(me.health, 90, 'five blows land and charge it');
  blow(me, 50, orc);
  assert.equal(me.health, 90, 'the sixth is turned aside whole');
  assert.ok(said.includes('Dawnward turns the blow aside.'));
  blow(me, 2, orc);
  assert.equal(me.health, 88, 'and it charges again');
  fresh();
  me = player(); wear(me, legendary('ravens-wings'));
  R = 0.1; blow(me, 10, orc);
  assert.equal(me.health, 100, 'evaded');
  R = 0.5; blow(me, 10, orc);
  assert.equal(me.health, 90, 'eighty-five in a hundred, it lands');
  R = 0.1; hurtPlayer(me, 10);
  assert.equal(me.health, 80, 'a fall is no blow to evade');
  fresh();
  me = player(); wear(me, legendary('witch-sisters-ring'));
  blow(me, 8, orc);
  assert.equal(me.health, 92, 'the first blow hexes its foe');
  blow(me, 8, orc);
  assert.equal(me.health, 86, 'a hexed foe\'s blow: a quarter less');
  T = 9; blow(me, 8, orc);
  assert.equal(me.health, 78, 'the hex runs out');
  fresh();
  me = player(); wear(me, legendary('mountains-root'));
  me.maxHealth = me.health = 1000;
  blow(me, 100, orc);
  assert.equal(me.health, 900, 'the first lands whole');
  blow(me, 100, orc);
  assert.equal(me.health, 804, 'the second lessened by one stack: 4%');
  blow(me, 100, orc);
  assert.equal(me.health, 712, 'the third by two: 8%');
  assert.equal(LP.bedrockStacks(), 3);
  T = 7;
  blow(me, 100, orc);
  assert.equal(me.health, 612, 'the stacks run out after six seconds');
  fresh();
  me = player(); wear(me, legendary('wall-of-daggerfall'));
  blow(me, 12, orc);
  assert.equal(me.health, 93, '5 off');
  blow(me, 3, orc);
  assert.equal(me.health, 92, 'never under 1');
  fresh();
  me = player(); wear(me, legendary('the-warden'));
  hurtPlayer(me, 8);
  assert.equal(me.health, 92, 'above its line, nothing');
  me.health = 20;
  hurtPlayer(me, 8);
  assert.equal(me.health, 14, 'under a quarter: a quarter less, any hurt');
  fresh();
  me = player(); wear(me, legendary('titanheart'));
  hurtPlayer(me, 60);
  assert.equal(me.health, 75, 'no hurt over a quarter of my health');
});

test('LOOT5: death, the vigil, the kill, the round, the absorption, the find', () => {
  fresh();
  let me = player(); wear(me, legendary('amulet-of-the-nine'));
  hurtPlayer(me, 500);
  assert.equal(me.health, 26, 'left at 1, healed a quarter');
  hurtPlayer(me, 500);
  assert.equal(me.health, 0, 'then it must recover');
  fresh();
  me = player(); wear(me, legendary('lysandus-visor'));
  hurtPlayer(me, 70);
  assert.equal(me.health, 50, 'under a third: healed a fifth of my health');
  hurtPlayer(me, 30);
  assert.equal(me.health, 20, 'recovering');
  fresh();
  me = player(); wear(me, legendary('kings-mark')); wear(me, legendary('worms-tooth')); wear(me, legendary('gortwogs-cleaver'));
  me.health = 50; me.magicka = 0;
  const d = door([], me);
  reportPlayerKill(foe(7, { level: 12 }));
  assert.equal(me.goldPieces, 60, 'Tribute: 5 gold a level');
  assert.equal(me.magicka, 15, 'Soul Siphon: 15% of my magicka');
  assert.equal(me.health, 60, 'Orc Rage: 10% of my health');
  reportPlayerKill({ mobileType: KNIGHT_CITY_WATCH, level: 20 });
  assert.equal(me.goldPieces, 60, 'the watch never pays');
  fresh();
  me = player(); wear(me, legendary('wayrest-treads'));
  const d2 = door([], me);
  reportPlayerKill(foe(7)); reportPlayerKill(foe(7));
  assert.equal(d2.casts.length, 1, 'Courier\'s Haste, then its recovery');
  assert.deepEqual([d2.casts[0].effects[0].type, d2.casts[0].effects[0].subType, d2.casts[0].effects[0].magnitudeBaseLow], [9, 6, 20], 'Fortify Speed 20');
  void d;
  fresh();
  me = player(); wear(me, legendary('mark-of-the-hist'));
  me.health = 60;
  LP.lootRound(me);
  assert.equal(me.health, 61, '1% a round - PIN MOVED (BAL7, Balance-Arc.md section 13): halved, it was 2%');
  me.health = 40;
  LP.lootRound(me);
  assert.equal(me.health, 42, '2% under half (it was 4%)');
  fresh();
  me = player(); wear(me, legendary('reachmans-torc'));
  assert.equal(LP.lootAbsorbChance(me), 15);
  fresh();
  me = player(); wear(me, legendary('archmages-loop'));
  me.magicka = 80;
  assert.equal(LP.lootCastCost(me, 100), 85);
  me.magicka = 20;
  assert.equal(LP.lootCastCost(me, 100), 70);
  fresh();
  me = player();
  door([], me);
  assert.equal(LP.lootFind(), 1);
  wear(me, legendary('foxglove'));
  assert.equal(LP.lootFind(), 1.5);
  assert.equal(LR.legendaryFindMult(), 1.5, 'registered: the host door\'s finders');
  const c = LR.rarityChances({ kind: 'pile', tier: 10, find: 1.5 }), c0 = LR.rarityChances({ kind: 'pile', tier: 10 });
  assert.equal(c.legendary, c0.legendary * 1.5, 'the source\'s own chance, times one and a half');
  assert.ok(LR.rarityChances({ kind: 'corpse', tier: 0, luck: 100, find: 1000 }).legendary <= LR.rarityChances({ kind: 'corpse', tier: 0, luck: 100 }).rare, 'never past the Rare');
  setPlayerDoor(null);
});

test('LOOT5: the HUD\'s chips - the stacks, the charges and the recoveries, in the Legendary\'s colour', () => {
  fresh();
  const me = player();
  const ae = wear(me, legendary('anseis-edge'));
  wear(me, legendary('aegis-of-dawn'));
  wear(me, legendary('amulet-of-the-nine'));
  LP.lootStrike(me, foe(7), 10, ae);
  blow(me, 1, foe(7));
  hurtPlayer(me, 500);
  const chips = LP.lootHudChips(me);
  assert.deepEqual(chips.map((c) => [c.key, c.state]), [['flow', 'active'], ['dawnward', 'active'], ['grace', 'recovering']]);
  assert.ok(chips.every((c) => c.set === 'legendary'));
  assert.deepEqual(LP.lootHudChips({ ...me, peer: true }), []);
  assert.match(read('src/ui/enhanced/enhancedHud.js'), /t\.set === 'legendary' \? RARITIES\.legendary\.colour/);
});
