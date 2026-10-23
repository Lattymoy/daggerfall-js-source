// DEEDS (2026-10-23, bible/06-Systems/Deeds-And-Talents.md): the switch, the two price tables and the career's live
// multiplier (DEEDS0/1), the four weak advantages made worth their price (DEEDS1), the party's minor skills and the
// pose that carries them (DEEDS2), and the deeds - their tallies, slots, overcomings, fold and save (DEEDS3). Every pin
// is a literal of the law, so a one-character change to a price, a bar or a threshold fails here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import {
  TALENTS_PREF, talentsInForce, pickDifficulty, careerAdvancementMultiplier, careerPriceDelta, MULTIPLIER_PER_POINT,
  regenerateAmount, hearsFoes, inAdrenalineRush, rushBlow, athleteSkill, athleteFatigue, rowsOvercome,
} from '../../src/systems/talents.js';
import { advDisAdjustment, DFO_DIFFICULTY, DIFFICULTY, classSpecials } from '../../src/systems/specialAdvantages.js';
import {
  TALENT_SKILLS, talentPose, partyTalentsFrame, _setNearTalents, partySkill, careAmount, careRound, notePlayerHurt, haggleOf,
  partyWord, rewardGold, samePlace, nearTalents,
} from '../../src/systems/partyTalents.js';
import {
  DEEDS, DEED_SLOTS, BANE_KILLS, FEAR_KILLS, STAND_KILLS, ENDURE_STEP, deedsOf, deedsSaved, deedKill, deedEndured,
  applyDeeds, deedGroupOf, deedRows, deedSpecials,
} from '../../src/systems/deeds.js';
import { rezHealthPct, rezFor } from '../../src/systems/resurrect.js';
import { validPartyPose, PARTY_TALENTS, PARTY_TALENT_MAX } from '../../src/net/wire.js';
import { SKILLS } from '../../src/systems/skills.js';
import { passiveSpecialsMagicRound } from '../../src/systems/passiveSpecials.js';
import { adrenalineRushToHit } from '../../src/combat/formulas.js';
import { pcaaoAdrenalineRushToHit } from '../../src/combat/pcaao.js';
import { createDetectFeed, motorStats, fatigueLossMultiplierFor } from '../../src/scenes/shared.js';
import { FEATURES } from '../../src/systems/features.js';
import { KNIGHT_CITY_WATCH } from '../../src/characters/mobile/mobileTypes.js';
import { EFFECT_FLAGS } from '../../src/systems/spellcast.js';

const DEFAULT_MAGERY = 20 << 8;   // SpellPointMultipliers.Times_0_50 - every real career carries it
const career = (o = {}) => ({
  attackModifierFlags: 0, weaponArmorShieldsBitfield: 0, abilityFlagsAndSpellPointsBitfield: DEFAULT_MAGERY,
  resistanceFlags: 0, immunityFlags: 0, lowToleranceFlags: 0, criticalWeaknessFlags: 0, forbiddenMaterialsFlags: 0,
  spellAbsorptionFlags: 0, regeneration: 0, rapidHealing: 0, advancementMultiplier: 1, ...o,
});
const skills = (v = 0, o = {}) => Object.assign(new Array(35).fill(v), o);
const player = (o = {}) => ({
  isPlayer: true, _online: true, level: 10, health: 100, maxHealth: 100, stats: { personality: 50 }, skills: skills(),
  career: career(), activeEffects: [], ...o,
});
/** Run `fn` with the offline switch at `on`, the shelf put back after. */
const withSwitch = (on, fn) => { _resetForTests(); setPref(TALENTS_PREF, on); try { return fn(); } finally { _resetForTests(); } };

// ── DEEDS0: the switch ─────────────────────────────────────────────

test('DEEDS0 the switch: online always in force; offline the Features row, on by default', () => {
  const row = FEATURES.find((f) => f.id === 'deeds-and-talents');
  assert.deepEqual({ key: row.control.key, initial: row.control.initial, online: row.control.online, group: row.group },
    { key: 'deedsAndTalents', initial: true, online: true, group: 'character' });
  _resetForTests();
  assert.equal(talentsInForce({}), true, 'on by default offline');
  withSwitch(false, () => {
    assert.equal(talentsInForce({ _online: false }), false, 'offline: the switch');
    assert.equal(talentsInForce({ _online: true }), true, 'online: always');
  });
});

// ── DEEDS1: the prices ─────────────────────────────────────────────

test('DEEDS1 the DFO prices: the measured picks, everything else DFU\'s; phobia priced by its group', () => {
  assert.deepEqual({ ...DFO_DIFFICULTY }, {
    expertiseIn: 8, bonusToHitanimals: 4, bonusToHitundead: 4, bonusToHitdaedra: 2,
    phobiahumanoid: -4, phobiaanimals: -3, phobiaundead: -3, phobiadaedra: -1, damagefromSunlight: -4, acuteHearing: 3,
  });
  const pairs = [['expertiseIn', 'axe'], ['bonusToHit', 'humanoid'], ['bonusToHit', 'animals'], ['bonusToHit', 'undead'],
    ['bonusToHit', 'daedra'], ['phobia', 'humanoid'], ['phobia', 'daedra'], ['damage', 'fromSunlight'],
    ['damage', 'fromHolyPlaces'], ['acuteHearing', ''], ['immunity', 'toFire'], ['forbiddenMaterial', 'steel']];
  assert.deepEqual(pairs.map(([p, s]) => advDisAdjustment(p, s)), [2, 6, 6, 6, 3, -4, -4, -10, -6, 1, 10, -10], 'DFU unchanged');
  assert.deepEqual(pairs.map(([p, s]) => advDisAdjustment(p, s, true)), [8, 6, 4, 4, 2, -4, -1, -4, -6, 3, 10, -10]);
  assert.equal(DIFFICULTY.expertiseIn, 2, 'DFU\'s own table untouched');
  assert.equal(withSwitch(true, () => pickDifficulty('expertiseIn', 'axe')), 8);
  assert.equal(withSwitch(false, () => pickDifficulty('expertiseIn', 'axe')), 2);
});

test('DEEDS1 the career keeps its price: DFO\'s table charges only a class it built, and only in force', () => {
  const expert = (o = {}) => player({ career: career({ weaponArmorShieldsBitfield: 2 << 16, advancementMultiplier: 1.5, ...o }) });   // Expertise In Long Blade
  assert.ok(Math.abs(MULTIPLIER_PER_POINT - 2.7 / 52) < 1e-12);
  assert.equal(careerAdvancementMultiplier(expert()), 1.5, 'a stock class (or one built before) keeps CLASS.CFG\'s multiplier');
  assert.equal(careerAdvancementMultiplier(expert({ advPricing: 'dfu' })), 1.5, 'built off: DFU priced it, DFU charges it');
  const dfo = expert({ advPricing: 'dfo' });
  assert.equal(careerAdvancementMultiplier(dfo), 1.5, 'built in force, played in force');
  withSwitch(false, () => {
    assert.equal(careerPriceDelta({ ...dfo, _online: false }), -6);
    assert.equal(careerAdvancementMultiplier({ ...dfo, _online: false }), 1.5 - 6 * (2.7 / 52), 'built in force, played off: DFU\'s 2, not DFO\'s 8');
  });
  const clamp = player({ career: career({ weaponArmorShieldsBitfield: 0x3f << 16, advancementMultiplier: 0.5, advPricing: 'dfo' }), _online: false });
  withSwitch(false, () => assert.equal(careerAdvancementMultiplier(clamp), 0.3, 'the builder\'s floor'));
});

// ── DEEDS1: the four weak advantages ───────────────────────────────

test('DEEDS1 Regenerate Health: 2% of the maximum a pulse in force, DFU\'s 1 off', () => {
  const e = player({ maxHealth: 300, health: 100, career: career({ regeneration: 8 }) });   // REGENERATION_FLAGS.general
  assert.equal(regenerateAmount(e), 6);
  assert.equal(regenerateAmount({ ...e, maxHealth: 20 }), 1, 'at least 1');
  withSwitch(false, () => assert.equal(regenerateAmount({ ...e, _online: false }), 1));
  const healed = [];
  passiveSpecialsMagicRound(e, { nowMinutes: 4, clockMinutes: 4, sinks: { heal: (n) => healed.push(n), hurt: () => {} } });
  assert.deepEqual(healed, [6], 'the round heals through the sink');
});

test('DEEDS1 Adrenaline Rush: a quarter of health in both cores, and its blows 20% (30% improved) harder', () => {
  const rush = (health, o = {}) => player({ health, maxHealth: 100, career: career({ abilityFlagsAndSpellPointsBitfield: DEFAULT_MAGERY | 4 }), ...o });
  assert.equal(inAdrenalineRush(rush(24), 8), true);
  assert.equal(inAdrenalineRush(rush(25), 8), false, 'under, not at');
  withSwitch(false, () => {
    assert.equal(inAdrenalineRush(rush(24, { _online: false }), 8), false, 'off: the classic eighth');
    assert.equal(inAdrenalineRush(rush(11, { _online: false }), 8), true);
    assert.equal(inAdrenalineRush(rush(15, { _online: false }), 6), true, 'off: the overhaul\'s sixth');
    assert.equal(inAdrenalineRush(rush(16, { _online: false }), 6), false);
  });
  assert.equal(adrenalineRushToHit(rush(24), {}), 5, 'classic to-hit at the quarter');
  assert.equal(pcaaoAdrenalineRushToHit(rush(24), {}), 8, 'overhaul to-hit at the quarter');
  assert.equal(rushBlow(10, rush(24)), 12);
  assert.equal(rushBlow(10, rush(24, { _enchantMods: { improvedAdrenalineRush: true } })), 13);
  assert.equal(rushBlow(10, rush(25)), 10);
  assert.equal(rushBlow(10, player({ health: 10 })), 10, 'no rush without the advantage');
});

test('DEEDS1 Athleticism: +15 Running and Climbing for the motor, and 0.8 (0.7 improved) fatigue in force', () => {
  const athlete = player({ career: career({ abilityFlagsAndSpellPointsBitfield: DEFAULT_MAGERY | 2 }), skills: skills(40), stats: { speed: 50, personality: 50 } });
  assert.equal(athleteSkill(athlete), 15);
  assert.equal(athleteSkill(player()), 0);
  assert.equal(motorStats(athlete).running, 55);
  assert.deepEqual([athleteFatigue(athlete, false), athleteFatigue(athlete, true)], [0.8, 0.7]);
  withSwitch(false, () => assert.deepEqual([athleteFatigue({}, false), athleteFatigue({}, true)], [0.9, 0.8]));
  assert.equal(fatigueLossMultiplierFor(athlete), 0.8);
});

test('DEEDS1 Acute Hearing: foes within its sound\'s reach (16 m x 1.25) show on the compass in force', () => {
  const ears = player({ career: career({ abilityFlagsAndSpellPointsBitfield: DEFAULT_MAGERY | 1 }) });
  assert.equal(hearsFoes(ears), true);
  const foes = [{ ref: 'near', pos: [0, 0, 19.5], mobileType: 0 }, { ref: 'far', pos: [0, 0, 20.5], mobileType: 0 }];
  const feed = createDetectFeed(ears, { entities: () => foes, feet: () => [0, 0, 0] });
  assert.deepEqual(feed.tick(1), [[0, 19.5]], 'the near foe alone - 20 m is the reach');
  withSwitch(false, () => {
    const off = createDetectFeed({ ...ears, _online: false }, { entities: () => foes, feet: () => [0, 0, 0] });
    assert.deepEqual(off.tick(1), [], 'off: DFU\'s louder sounds alone');
  });
});

// ── DEEDS2: the party's minor skills ───────────────────────────────

test('DEEDS2 the pose: thirteen talents in TALENT_SKILLS\' order, and the wire\'s law for them', () => {
  assert.deepEqual([...TALENT_SKILLS], [SKILLS.Medical, SKILLS.Stealth, SKILLS.Etiquette, SKILLS.Streetwise, SKILLS.Orcish,
    SKILLS.Harpy, SKILLS.Giantish, SKILLS.Dragonish, SKILLS.Nymph, SKILLS.Daedric, SKILLS.Spriggan, SKILLS.Centaurian, SKILLS.Impish]);
  assert.deepEqual([PARTY_TALENTS, PARTY_TALENT_MAX], [13, 200]);
  const e = player({ skills: skills(0, { [SKILLS.Medical]: 77, [SKILLS.Impish]: 12 }) });
  assert.deepEqual(talentPose(e), [77, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12]);
  const base = { px: 1, py: 2, h: 1, hm: 1, f: 1, fm: 1, m: 1, mm: 1 };
  const tk = [77, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 200];
  assert.deepEqual(validPartyPose({ ...base, tk }).tk, tk);
  assert.equal(validPartyPose({ ...base, tk: tk.slice(1) }).tk, undefined, 'twelve: refused alone');
  assert.equal(validPartyPose({ ...base, tk: [...tk.slice(1), 201] }).tk, undefined, 'past the ceiling');
  assert.equal(validPartyPose({ ...base, tk: [...tk.slice(1), 1.5] }).tk, undefined, 'a fraction');
  assert.ok(validPartyPose({ ...base, tk: 'x' }), 'the pose stands without it');
});

test('DEEDS2 who is near: the same place, within 40 m of a body I draw, online, carrying a whole pose', () => {
  const here = { px: 5, py: 5, in: 2, bk: 9 };
  const tk = (n) => new Array(13).fill(n);
  const members = [
    { acct: 'a', p: { ...here, tk: tk(10) } },
    { acct: 'b', p: { ...here, tk: tk(20) } },            // 41 m
    { acct: 'c', p: { ...here, bk: 8, tk: tk(30) } },     // another building
    { acct: 'd', online: false, p: { ...here, tk: tk(40) } },
    { acct: 'e', p: { ...here, tk: tk(50).slice(1) } },   // a short pose
    { acct: 'f', p: { ...here, tk: tk(60) } },            // no body drawn
  ];
  const dist = { a: 40, b: 41, c: 1, d: 1, e: 1, f: Infinity };
  partyTalentsFrame(members, here, (acct) => dist[acct]);
  assert.deepEqual(nearTalents(), [tk(10)]);
  assert.equal(samePlace({ px: 1, py: 1, in: 0, bk: 3 }, { px: 1, py: 1, in: 0, bk: 4 }), true, 'outside, no building to match');
  partyTalentsFrame([], here, () => 0);
  assert.deepEqual(nearTalents(), []);
});

test('DEEDS2 the party lends: a tongue whole, Stealth at three quarters, care, the good word, revival', () => {
  const me = player({ skills: skills(0, { [SKILLS.Stealth]: 30, [SKILLS.Orcish]: 5, [SKILLS.Medical]: 10, [SKILLS.Etiquette]: 20 }), health: 50, maxHealth: 200 });
  const mate = new Array(13).fill(0);
  mate[0] = 100; mate[1] = 80; mate[3] = 90; mate[4] = 70;   // Medical, Stealth, Streetwise, Orcish
  _setNearTalents([mate]);
  try {
    assert.equal(partySkill(me, SKILLS.Orcish), 70);
    assert.equal(partySkill(me, SKILLS.Stealth), 60);
    assert.equal(partySkill({ ...me, skills: skills(0, { [SKILLS.Stealth]: 65 }) }, SKILLS.Stealth), 65, 'my own when better');
    notePlayerHurt(-Infinity);
    assert.equal(careAmount(me, 0), 4, 'Medical 100 near: 2% of 200');
    const healed = [];
    careRound(me, { nowMinutes: 8, sinks: { heal: (n) => healed.push(n) } });
    careRound(me, { nowMinutes: 9, sinks: { heal: (n) => healed.push(n) } });
    assert.deepEqual(healed, [4], 'every fourth round');
    notePlayerHurt(1000);
    assert.equal(careAmount(me, 1000 + 14_999), 0, 'not within 15 s of a hurt');
    assert.equal(careAmount(me, 1000 + 15_000), 4);
    assert.equal(careAmount({ ...me, health: 200 }, 1e9), 0, 'full');
    assert.equal(partyWord(me), 9, 'a tenth of the best near Streetwise');
    assert.deepEqual(haggleOf(me), { mercantile: 0, personality: 59 });
    const quest = { hooks: { addHUDText: () => {} } };
    const purse = { stackCount: 1000 };
    assert.equal(rewardGold(quest, purse, me), 90);
    assert.equal(purse.stackCount, 1090);
    withSwitch(false, () => {
      const off = { ...me, _online: false };
      assert.deepEqual([partySkill(off, SKILLS.Orcish), partySkill(off, SKILLS.Stealth), careAmount(off, 1e9), partyWord(off)], [5, 30, 0, 0]);
    });
  } finally { _setNearTalents([]); notePlayerHurt(-Infinity); }
  assert.equal(careAmount(me, 1e9), 0, 'solo with Medical 10: nothing');
  assert.equal(careAmount({ ...me, skills: skills(0, { [SKILLS.Medical]: 50 }) }, 1e9), 2, 'solo, my own Medical 50: 1%');
  const rez = rezFor([{ acct: 'x', name: 'X', p: { rz: { to: 'me', at: 5 }, tk: [100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] } }], 'me', new Map());
  assert.equal(rez.med, 100);
  assert.deepEqual([rezHealthPct(rez), rezHealthPct({ med: 200 }), rezHealthPct({}), rezHealthPct({ med: 49 })], [50, 60, 30, 39]);
});

// ── DEEDS3: the deeds ──────────────────────────────────────────────

const UNDEAD = { careerIndex: 15 };
const DAEDRA = { careerIndex: 25 };
const RAT = { careerIndex: 0 };
const ORC = { careerIndex: 7 };
const MAN = { affinity: 'Human', careerIndex: 3 };
const kill = (e, foe, n) => { const said = []; for (let i = 0; i < n; i++) said.push(...deedKill(e, foe)); return said; };

test('DEEDS3 the groups are the Bonus to Hit ladder\'s: a man, an animal, the dead, the daedra - and no orc', () => {
  assert.deepEqual([MAN, RAT, UNDEAD, DAEDRA, ORC, { careerIndex: 3 }].map(deedGroupOf), ['humanoid', 'animals', 'undead', 'daedra', null, 'animals']);
  assert.deepEqual({ ...BANE_KILLS }, { humanoid: 250, animals: 150, undead: 100, daedra: 30 });
  assert.deepEqual({ ...FEAR_KILLS }, { humanoid: 80, animals: 50, undead: 35, daedra: 10 });
  assert.deepEqual([DEED_SLOTS, STAND_KILLS, ENDURE_STEP], [3, 20, 40]);
  const e = player();
  kill(e, { ...UNDEAD, mobileType: KNIGHT_CITY_WATCH }, 3);
  kill(e, { ...UNDEAD, team: 'PlayerAlly' }, 3);
  assert.equal(deedsOf(e).kills.undead, 0, 'the Watch and my allies never count');
});

test('DEEDS3 fear conquered, then its Bane: the phobia goes at a third, the bonus comes after the whole', () => {
  const e = player({ career: career({ attackModifierFlags: 0x10 }) });   // Phobia: Undead
  assert.equal(careerPriceDelta(e), 0, 'a career the table did not build keeps its price');
  assert.deepEqual(kill(e, UNDEAD, 34), []);
  assert.deepEqual(kill(e, UNDEAD, 1), ['Fear conquered: you no longer suffer your Phobia of Undead.']);
  assert.equal(e.career.attackModifierFlags, 0, 'the phobia bit cleared');
  assert.equal(careerPriceDelta(e), 4, 'the discount repaid');
  assert.deepEqual(kill(e, UNDEAD, 99), []);
  assert.deepEqual(kill(e, UNDEAD, 1), ['Deed done: Bane of the Dead. Bonus to hit Undead is yours (1 of 3 deeds).']);
  assert.equal(e.career.attackModifierFlags, 0x01);
  assert.equal(careerPriceDelta(e), 4, 'an earned advantage costs nothing');
  assert.equal(e.career.deedBase.attackModifierFlags, 0x10, 'the career as made is kept');
  withSwitch(false, () => {
    const off = Object.assign(e, { _online: false });
    applyDeeds(off);
    assert.equal(off.career.attackModifierFlags, 0x10, 'off: the career as made');
    off._online = true;
    applyDeeds(off);
    assert.equal(off.career.attackModifierFlags, 0x01, 'on again: folded again');
  });
});

test('DEEDS3 three slots, first come first served; a deed past them is recorded, not granted', () => {
  const e = player({ health: 20, maxHealth: 100 });
  const said = kill(e, DAEDRA, 30);
  assert.equal(said.length, 2, 'Last Stand at the twentieth (every kill under a quarter of health), Bane of the Daedra at the thirtieth');
  assert.deepEqual(deedsOf(e).granted, ['lastStand', 'baneDaedra']);
  e.health = 100;
  kill(e, UNDEAD, 100);
  kill(e, RAT, 150);
  assert.deepEqual(deedsOf(e).granted, ['lastStand', 'baneDaedra', 'baneDead']);
  assert.deepEqual(deedsOf(e).unslotted, ['baneBeasts']);
  assert.equal(e.career.attackModifierFlags, 0x01 | 0x02, 'undead and daedra; no animals');
  assert.equal(e.career.abilityFlagsAndSpellPointsBitfield & 4, 4, 'Adrenaline Rush');
  const rows = Object.fromEntries(deedRows(e).map((r) => [r.id, r.state]));
  assert.deepEqual([rows.baneDaedra, rows.baneBeasts, rows.baneMen, rows.temperedFire], ['earned', 'unslotted', 'progress', 'progress']);
  const marked = deedSpecials(e, classSpecials(e.career)).filter((r) => r.source === 'deed').map((r) => r.label);
  assert.deepEqual(marked.sort(), ['Adrenaline Rush', 'Bonus to hit Daedra', 'Bonus to hit Undead']);
});

test('DEEDS3 the elements: a weakness lowered, lifted, then Tempered - forty spells a step', () => {
  const e = player({ career: career({ criticalWeaknessFlags: 8 }) });   // Critical Weakness To Fire
  const endure = (n) => { const said = []; for (let i = 0; i < n; i++) said.push(...deedEndured(e, EFFECT_FLAGS.Fire)); return said; };
  assert.deepEqual(endure(40), ['Hardened: your Critical Weakness To Fire is now a Low Tolerance.']);
  assert.deepEqual([e.career.criticalWeaknessFlags, e.career.lowToleranceFlags], [0, 8]);
  assert.deepEqual(endure(40), ['Hardened: you no longer suffer a Low Tolerance To Fire.']);
  assert.deepEqual([e.career.criticalWeaknessFlags, e.career.lowToleranceFlags], [0, 0]);
  assert.equal(careerPriceDelta(e), 14, 'the weakness\'s -14 repaid');
  assert.deepEqual(endure(40), ['Deed done: Tempered: Fire. Resistance To Fire is yours (1 of 3 deeds).']);
  assert.equal(e.career.resistanceFlags, 8);
  assert.deepEqual(rowsOvercome([{ primary: 'criticalWeakness', secondary: 'toFire' }], deedsOf(e).overcome), []);
  const immune = player({ career: career({ immunityFlags: 16 }) });
  for (let i = 0; i < 200; i++) deedEndured(immune, EFFECT_FLAGS.Frost);
  assert.deepEqual(deedsOf(immune).granted, [], 'never Tempered over an immunity');
});

test('DEEDS3 out of force nothing counts; a save writes the career as made and lays the deeds again', async () => {
  const off = player({ _online: false });
  withSwitch(false, () => kill(off, UNDEAD, 5));
  assert.equal(deedsOf(off).kills.undead, 0);
  const { snapshotPlayer, restorePlayer } = await import('../../src/systems/save/save.js');
  const e = Object.assign(player({ career: career({ attackModifierFlags: 0x10 }) }), {
    name: 'Rin', stats: { strength: 50, personality: 50 }, skillUses: [], items: [], spells: [], level: 5,
  });
  kill(e, UNDEAD, 135);
  assert.equal(e.career.attackModifierFlags, 0x01);
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(e, {})));
  assert.equal(snap.career.attackModifierFlags, 0x10, 'the save holds the career as made');
  assert.equal(snap.career.deedBase, undefined);
  assert.deepEqual(snap.deeds.granted, ['baneDead']);
  const loaded = { isPlayer: true, _online: true, stats: {}, skills: [], skillUses: [], items: [], activeEffects: [] };
  restorePlayer(loaded, snap);
  assert.equal(loaded.career.attackModifierFlags, 0x01, 'folded again at the load');
  assert.deepEqual(deedsSaved({ granted: ['nope', 'baneDead', 'baneDead'], kills: { undead: -3 } }).granted, ['baneDead']);
  assert.equal(DEEDS.length, 10);
});
