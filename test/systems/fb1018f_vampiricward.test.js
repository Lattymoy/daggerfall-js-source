// FIELD BUGS 2026-10-18f VAMPIRIC-WARD (Low_Poly_Gaming, "Weir Key Generated Elite Breach bugs": "Its an exploit for heals if
// you have a vampiric weapon to heal yourself during the breach run"). Vampiric Effect when strikes heals the wearer every
// point a blow DEALS (systems/enchantments.js - VampiricEffect.cs; bible/05-Combat/Balance-Arc.md BAL7). A blow on a body a
// referee holds is resolved against its stand-in, and a ward the referee keeps turns it whole - the stand-in says so
// (`warded`: the Warden's ward and the Brass Remnant shut, scenes/dungeonContext.js gateBossBody; the Spire's turned blows,
// scenes/eliteGates/egFight.js TURNED-BLOW). Every other heal and power of a landed blow already refused one (the leech since
// AUDIT WORLD-REWARDS B3); the payload alone healed the whole claim. Driven through the real payload dispatcher and the real
// formula, on the real Legendary that carries it (Gortwog's Cleaver, systems/loot/lootRarity.js) against the Warden's own
// stand-in (world/gate/gateBoss.js bossStandIn). On the code before the fix the warded blows heal their whole damage.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { doItemEnchantmentPayloads, PAYLOAD, ENCHANTMENT_TYPES, DURABILITY_LOSS_ON_STRIKE } from '../../src/systems/enchantments.js';
import { calculateAttackDamage } from '../../src/combat/formulas.js';
import { bossStandIn, bossLookOf } from '../../src/world/gate/gateBoss.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import * as LR from '../../src/systems/loot/lootRarity.js';
import { ARTIFACTS, SPECIAL_ARTIFACT_HANDLERS, maceState } from '../../src/systems/artifactEffects.js';
// AUDIT FB1018f lane L3: the arcane paths' riders, the sets' strike
import * as AP from '../../src/systems/arcanePaths.js';
import * as POW from '../../src/systems/arcanePowers.js';
import { signatureSpell } from '../../src/systems/signatureSpells.js';
import { createCharacter } from '../../src/systems/chargen.js';
import { buildCustomCareer } from '../../src/systems/customClass.js';
import { masterSkill } from '../../src/systems/masterSkills.js';
import { SKILLS } from '../../src/systems/skills.js';
import { playerEntity } from '../../src/characters/playerEntity.js';
import { applySpell } from '../../src/systems/effects.js';
import { tellSpellLanded } from '../../src/systems/spell/spellPower.js';
import { duelSpellOf } from '../../src/combat/duelCombat.js';
import { _resetPlayerHealForTests } from '../../src/systems/playerHeal.js';
import { setPlayerDoor } from '../../src/systems/playerDoor.js';
import { coilStacksAt, _resetSetPowersForTests, _setSetPowersClockForTests } from '../../src/systems/sigil/sigilSetPowers.js';
import { setSigilOnline, setSigilRenown, _resetSigilForTests } from '../../src/systems/sigil/sigil.js';
import { _resetSigilSetsForTests } from '../../src/systems/sigil/sigilSets.js';
import { PANOPLY_SET_PIECES, SERPENT_SET_PIECES, mintAetheric } from '../../src/systems/aetheric.js';
import { tellPlayerCast } from '../../src/systems/playerCasts.js';
import { equipItem } from '../../src/systems/equip.js';
import { WEAPON_MATERIALS } from '../../src/characters/weapons.js';

const T = ENCHANTMENT_TYPES;
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const me = () => ({ isPlayer: true, level: 30, items: [], career: {}, activeEffects: [], skills: new Array(35).fill(60), skillUses: new Array(35).fill(0), armor: 0, health: 100, maxHealth: 1000, magicka: 0, maxMagicka: 100,
  stats: { strength: 75, agility: 50, luck: 50, speed: 50, endurance: 50, willpower: 50, intelligence: 50, personality: 50 } });

test('VAMPIRIC-WARD THE PAYLOAD: Vampiric Effect when strikes heals the damage a blow deals - on a warded target, none; on any other the whole of it (E1\'s own pin beside it); at range it is unmoved (mutants: the ward unread)', () => {
  const blade = { name: 'Blade', templateIndex: 120, group: 3, currentCondition: 100, maxCondition: 100, enchantments: [{ type: T.VampiricEffect, param: 1 }] };
  const w = { health: 20, maxHealth: 30 };
  doItemEnchantmentPayloads(PAYLOAD.Strikes, blade, { entity: w, target: { mobileType: 3, warded: true }, damage: 7 });
  assert.equal(w.health, 20, 'a blow the ward turns dealt nothing, and heals nothing');
  doItemEnchantmentPayloads(PAYLOAD.Strikes, blade, { entity: w, target: { mobileType: 3, warded: false }, damage: 7 });
  assert.equal(w.health, 27, 'a blow that lands heals what it dealt');
  doItemEnchantmentPayloads(PAYLOAD.Strikes, { ...blade, enchantments: [{ type: T.VampiricEffect, param: 0 }] }, { entity: w, target: { warded: false }, damage: 7 });
  assert.equal(w.health, 27, 'the at-range param heals nothing on a strike');
});

test('VAMPIRIC-WARD GORTWOG\'S CLEAVER ON THE WARDEN: the Legendary as the loot maker mints it, swung through the real formula at the Warden\'s own stand-in - while his ward stands (the stand-in warded, as the court\'s door marks it) twenty blows heal nothing; with it down each heals its whole damage', () => {
  const rec = LR.legendaryById('gortwogs-cleaver');
  assert.deepEqual(rec.enchantment, { type: T.VampiricEffect, param: 1 }, 'the Cleaver carries Vampiric Effect when strikes');
  const cleaver = LR.applyRarity(createWeapon(rec.templates[0], 0, () => 0.5), 'legendary', lcg(1), [rec]);
  cleaver.isIdentified = true;
  assert.ok((cleaver.enchantments ?? []).some((e) => e.type === T.VampiricEffect && e.param === 1), 'minted with it');
  const warden = bossStandIn(bossLookOf('warden'), 'The Warden');
  const swing = (k) => { const p = me(), d = calculateAttackDamage(p, warden, { weapon: cleaver, toHitMod: 1000, rolls: () => (k + 0.5) / 20 }); return { d, healed: p.health - 100 }; };
  warden.warded = true;
  let claimed = 0;
  for (let k = 0; k < 20; k++) { const { d, healed } = swing(k); claimed += d; assert.equal(healed, 0, `a blow of ${d} into his ward heals nothing`); }
  assert.ok(claimed > 100, `the blows claimed ${claimed}`);
  warden.warded = false;
  let landed = 0;
  for (let k = 0; k < 20; k++) { const { d, healed } = swing(k); if (d > 0) { landed++; assert.equal(healed, d, `a blow of ${d} heals ${d}`); } }
  assert.ok(landed > 0);
});

test('VAMPIRIC-WARD THE MACE OF MOLAG BAL (AUDIT FB1018f L1-2): its strike takes the target\'s magicka or Strength as a landed blow\'s gift - a warded target gives nothing (the ward turns the blow whole), an unwarded one as before (artifactEffects.js; mutant: the ward unread)', () => {
  const mace = SPECIAL_ARTIFACT_HANDLERS.get(ARTIFACTS.MaceOfMolagBal);
  const wielder = () => ({ isPlayer: true, magicka: 20, maxMagicka: 30, stats: { strength: 50 }, activeEffects: [], level: 10 });
  const target = (warded) => ({ health: 30, magicka: 10, stats: { strength: 30, willpower: 0, luck: 0 }, level: 1, skills: {}, activeEffects: [], warded });
  const a = wielder(), t1 = target(true);
  assert.equal(mace.strikes({ entity: a, target: t1, damage: 6, nowMinutes: 100, rolls: () => 0.99 }), null, 'into the ward: nothing');
  assert.deepEqual([a.magicka, t1.magicka, maceState(a)], [20, 10, null], 'no magicka moves, no state begins');
  const b = wielder(), t2 = target(false);
  assert.deepEqual(mace.strikes({ entity: b, target: t2, damage: 6, nowMinutes: 100, rolls: () => 0.99 }), { durabilityLoss: 6 });
  assert.deepEqual([b.magicka, t2.magicka], [26, 4], 'a landed blow drains as it did');
});

// ── AUDIT FB1018f lane L3: every other answer of a landed blow, refused off a ward ──────────────────────────────────

test('VAMPIRIC-WARD A SPELL INTO A WARD (AUDIT FB1018f L3-2): a necromancer\'s Siphon Life (the path\'s signature spell, through the one landing every cast tells its riders - systems/spell/spellPower.js tellSpellLanded) cast at the Warden\'s stand-in while his ward stands heals nothing - the spell landed nothing, the relay takes nothing of it; with the ward down it heals its share as it did (mutants: the arcane riders blind to the ward)', () => {
  const { Destruction: DES, Restoration: RES, Alteration: ALT, Mysticism: MYS, Illusion: ILL, Thaumaturgy: THA } = SKILLS;
  const STATS = { strength: 50, intelligence: 80, willpower: 60, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 };
  const career = buildCustomCareer({ name: 'Mage', hp: 8, stats: STATS, skills: [DES, RES, ALT, MYS, ILL, THA, SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Medical, SKILLS.Etiquette, SKILLS.Streetwise, SKILLS.Lockpicking] });
  const p = structuredClone(playerEntity);
  createCharacter(p, career, -1, { rolls: () => 0.5 });
  p._online = true; p.level = 20; p.activeEffects = []; p.health = 100; p.maxHealth = 200; p.magicka = p.maxMagicka = 300;
  for (const s of AP.PATH_BY_ID.necromancer.schools) { p.skills[s] = 100; masterSkill(p, s); p.skills[s] = 150; }
  POW._resetArcanePowersForTests(); _resetPlayerHealForTests();
  assert.equal(AP.choosePath(p, 'necromancer').ok, true);
  assert.equal(POW.awakePathId(p), 'necromancer', 'the path awake');
  setPlayerDoor({ player: () => p, foes: () => [], castOnPlayer: () => {}, hurtFoe: () => {} });
  try {
    const sp = signatureSpell('necromancer'), warden = bossStandIn(bossLookOf('warden'), 'The Warden');
    const cast = () => {
      let dealt = 0, r = null;
      const sinks = { hurt: (n) => { dealt += Math.max(0, n); }, heal() {}, drainFatigue() {}, restoreFatigue() {}, drainMagicka() {}, restoreMagicka() {} };
      try { r = applySpell(duelSpellOf(sp), p.level, warden, sinks, () => 0.999, { entity: p }); } finally { warden.activeEffects = []; }
      const before = p.health;
      tellSpellLanded({ caster: p, target: warden, foe: null, spell: sp, r, self: false, took: dealt, cast: null });
      const healed = p.health - before;
      p.health = 100;
      return { dealt, healed };
    };
    warden.warded = true;
    for (let k = 0; k < 5; k++) { const { dealt, healed } = cast(); assert.ok(dealt >= 1, 'the spell claims'); assert.equal(healed, 0, `a Siphon Life of ${dealt} into his ward heals nothing`); }
    warden.warded = false;
    const { dealt, healed } = cast();
    assert.ok(healed > 0 && healed <= dealt, `with it down a Siphon Life of ${dealt} heals its share (${healed})`);
  } finally { setPlayerDoor(null); POW._resetArcanePowersForTests(); }
});

test('VAMPIRIC-WARD CAST WHEN STRIKES INTO A WARD (AUDIT FB1018f L3-2; CastWhenStrikes.cs\'s own sourceDamage == 0 guard): a blow a ward turns dealt nothing - its spell is not cast at the turned body and the weapon pays nothing for it; a blow that lands casts and pays its 10 as it did (mutants: Cast When Strikes blind to the ward)', () => {
  const blade = () => ({ name: 'Blade', templateIndex: 120, group: 3, currentCondition: 100, maxCondition: 100, enchantments: [{ type: T.CastWhenStrikes, param: 7 }] });
  const casts = [];
  const ctx = { spellsByIndex: () => new Map([[7, { name: 'Fireball' }]]), applySpellToTarget: (record, entity, target) => casts.push([record.name, target.name]) };
  const w = { health: 20, maxHealth: 30 };
  const b1 = blade();
  doItemEnchantmentPayloads(PAYLOAD.Strikes, b1, { entity: w, target: { name: 'warded', warded: true }, damage: 7, ctx });
  assert.deepEqual([casts, b1.currentCondition], [[], 100], 'into the ward: no spell, no wear');
  const b2 = blade();
  doItemEnchantmentPayloads(PAYLOAD.Strikes, b2, { entity: w, target: { name: 'open', warded: false }, damage: 7, ctx });
  assert.deepEqual(casts, [['Fireball', 'open']], 'a landed blow casts on the body it met');
  assert.equal(b2.currentCondition, 100 - DURABILITY_LOSS_ON_STRIKE, 'and pays its 10');
});

test('VAMPIRIC-WARD THE SETS\' STRIKE INTO A WARD (AUDIT FB1018f L3-3; systems/sigil/sigilSetPowers.js setStrike, setBlow\'s own AUDIT SETS L4): through the real formula on the Warden\'s stand-in, warded - the Battlemage\'s Panoply returns no magicka of its armed cast and Sethrakul\'s Coilscale lays no Constrict on him; unwarded, both as they did (mutants: the sets\' strike blind to the ward)', () => {
  const stats = () => ({ strength: 75, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
  const player = () => ({ isPlayer: true, items: [], stats: stats(), skills: new Array(35).fill(60), skillUses: new Array(35).fill(0), level: 30, career: {}, activeEffects: [], health: 100, maxHealth: 100, magicka: 0, maxMagicka: 1000, armorValues: new Array(7).fill(100) });
  const wear = (pieces) => { const e = player(); for (const r of pieces.slice(0, 4)) { const it = mintAetheric(r); e.items.push(it); equipItem(e, it); } return e; };
  const blows = (e, target, n) => { for (let k = 0; k < n; k++) calculateAttackDamage(e, target, { weapon: createWeapon(119, WEAPON_MATERIALS.Steel), toHitMod: 1000, rolls: () => (k + 0.5) / n }); };
  _resetSigilForTests(); _resetSigilSetsForTests(); _resetSetPowersForTests(); _resetPlayerHealForTests();
  const T0 = 0;
  _setSetPowersClockForTests(() => T0);
  setSigilOnline(true); setSigilRenown(1);
  try {
    for (const warded of [true, false]) {
      _resetSetPowersForTests(); _setSetPowersClockForTests(() => T0);
      const warden = bossStandIn(bossLookOf('warden'), 'The Warden');
      warden.warded = warded;
      const e = wear(PANOPLY_SET_PIECES);
      setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {}, player: () => e });
      tellPlayerCast(e, { name: 'Fireball', element: 0 }, 400);
      blows(e, warden, 10);
      if (warded) assert.equal(e.magicka, 0, 'the Discipline: no magicka back off his ward');
      else assert.ok(e.magicka > 0, `the Discipline returns ${e.magicka} off blows that land`);
      _resetSetPowersForTests(); _setSetPowersClockForTests(() => T0);
      const c = wear(SERPENT_SET_PIECES);
      setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {}, player: () => c });
      blows(c, warden, 5);
      if (warded) assert.equal(coilStacksAt(warden, T0), 0, 'Constrict: no coil on him through his ward');
      else assert.ok(coilStacksAt(warden, T0) > 0, 'a coil laid off blows that land');
    }
  } finally { setPlayerDoor(null); _resetSetPowersForTests(); _setSetPowersClockForTests(null); setSigilOnline(false); _resetSigilForTests(); }
});
