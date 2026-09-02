// V2c - PASSIVE SPECIALS + THE SUNLIGHT SEAM, pinned against
// PassiveSpecialsEffect.cs and PlayerEnterExit.cs (MIT, Daggerfall
// Workshop). The one key that unlocked three standing flags: the
// vampire's actual sun/holy FIRE (V2b shipped only the flags), the
// custom-class regeneration / sun damage / light-and-darkness magery
// mintable since chargen and read by nothing, and the enchantment
// conditions' inSunlight/inHolyPlace ctx arms FLAGGED since E1.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  setPassiveSpecialsHost, playerInSunlight, playerInHolyPlace,
  careerSunDamage, careerHolyDamage, careerLightMagery, careerDarknessMagery,
  passiveSpecialsMagicRound,
  SUN_DAMAGE_AMOUNT, HOLY_DAMAGE_AMOUNT, REGENERATE_AMOUNT,
  SUN_DAMAGE_PER_ROUNDS, HOLY_DAMAGE_PER_ROUNDS, REGENERATE_PER_ROUNDS,
  MAGERY_REDUCED_FRACTION, MAGERY_UNABLE, FIGHTER_TRAINERS_FACTION,
} from '../src/systems/passiveSpecials.js';
import { parseCareerData, REGENERATION_FLAGS, SPECIAL_ABILITY_BITS } from '../src/systems/specialAdvantages.js';
import { defineLiveMaxMagicka, spellPoints, spellPointMultiplier } from '../src/systems/chargen.js';
import { runMagicRoundsFor } from '../src/systems/worldTick.js';
import { createVampirismCurse } from '../src/systems/vampirism.js';
import { VAMPIRE_CLANS } from '../src/systems/infection.js';
import { CLASSIC_GAME_START_TIME, dateFromClassicMinutes, isDayFromMinutes } from '../src/systems/gameDate.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const P = (career = null) => ({
  isPlayer: true, level: 5, activeEffects: [], career,
  stats: { strength: 50, agility: 50, endurance: 50, speed: 50, willpower: 50, intelligence: 50, personality: 50, luck: 50 },
  skills: {}, health: 60, maxHealth: 60, items: [], spells: [],
});
const career = (...picks) => { const c = { abilityFlagsAndSpellPointsBitfield: 0 }; parseCareerData(c, picks); return c; };
const sinkLog = () => { const log = { hurt: 0, heal: 0 }; return { log, sinks: { hurt: (n) => { log.hurt += n; }, heal: (n) => { log.heal += n; } } }; };

// The V2a epoch lesson: real classic minutes, never year-0 fixtures.
// The cadence gates run on `now % 4`, so both anchors are scanned to
// a %4 == 0 minute inside their hour band.
const noon4 = (() => {
  let m = CLASSIC_GAME_START_TIME;
  while (dateFromClassicMinutes(m).hour !== 12 || m % 4 !== 0) m++;
  return m;
})();
const midnight4 = (() => {
  let m = noon4;
  while (dateFromClassicMinutes(m).hour !== 0 || m % 4 !== 0) m++;
  return m;
})();

beforeEach(() => setPassiveSpecialsHost(null));

// ── 1. THE CONSTANTS (PassiveSpecialsEffect.cs:31-36, :218, :222) ──

test('V2c: the six cs:31-36 constants, the magery pair, and faction 849', () => {
  assert.equal(SUN_DAMAGE_AMOUNT, 12);
  assert.equal(HOLY_DAMAGE_AMOUNT, 12);
  assert.equal(REGENERATE_AMOUNT, 1);
  assert.equal(SUN_DAMAGE_PER_ROUNDS, 4);
  assert.equal(HOLY_DAMAGE_PER_ROUNDS, 4);
  assert.equal(REGENERATE_PER_ROUNDS, 4);
  assert.equal(MAGERY_REDUCED_FRACTION, -0.33);
  assert.equal(MAGERY_UNABLE, -10000000);
  assert.equal(FIGHTER_TRAINERS_FACTION, 849, 'FactionFile.FactionIDs.Fighter_Trainers');
});

// ── 2. THE TWO FLAGS (PlayerEnterExit.cs:371, :1424-1431) ─────────

test('V2c: IsPlayerInSunlight = IsDay && !inside && !prison, through the host seam', () => {
  assert.equal(isDayFromMinutes(noon4), true, 'anchor sanity');
  assert.equal(isDayFromMinutes(midnight4), false, 'anchor sanity');
  // headless: no host - inside/prison idle false, the day term rules
  assert.equal(playerInSunlight(noon4), true);
  assert.equal(playerInSunlight(midnight4), false);
  // a host that answers INSIDE kills the noon
  setPassiveSpecialsHost({ isInside: () => true });
  assert.equal(playerInSunlight(noon4), false);
  // ...and prison does the same (the port's arrestFlow serves the
  // sentence as a clock move, but the seam member still exists)
  setPassiveSpecialsHost({ inPrison: () => true });
  assert.equal(playerInSunlight(noon4), false);
});

test('V2c: IsPlayerInHolyPlace is the HOST\'s answer, and the setter returns the PREVIOUS host', () => {
  assert.equal(playerInHolyPlace(), false, 'headless: never holy');
  const temple = { isHolyPlace: () => true };
  const prev = setPassiveSpecialsHost(temple);
  assert.equal(prev, null, 'beforeEach cleared it');
  assert.equal(playerInHolyPlace(), true);
  // the death-presenter shape: a nested mount can hand it back
  const prev2 = setPassiveSpecialsHost({ isHolyPlace: () => false });
  assert.equal(prev2, temple, 'the setter answers the displaced host');
  assert.equal(playerInHolyPlace(), false);
  setPassiveSpecialsHost(prev2);
  assert.equal(playerInHolyPlace(), true, 'restored');
});

// ── 3. THE CAREER READS (the CFG bitfields parseCareerData mints) ─

test('V2c: sun/holy/magery read the SHAPE THE PRODUCER MINTS', () => {
  const sun = career({ primary: 'damage', secondary: 'fromSunlight' });
  assert.equal(sun.abilityFlagsAndSpellPointsBitfield & SPECIAL_ABILITY_BITS.sunDamage, 16);
  assert.equal(careerSunDamage(sun), true);
  assert.equal(careerHolyDamage(sun), false);
  const holy = career({ primary: 'damage', secondary: 'fromHolyPlaces' });
  assert.equal(careerHolyDamage(holy), true);
  // LightMageryFlags at bits 6-7: 1 = unable, 2 = reduced (DFCareer:350-355)
  const lr = career({ primary: 'lightPoweredMagery', secondary: 'lowerMagicAbilityDarkness' });
  assert.equal(careerLightMagery(lr), 2);
  const lu = career({ primary: 'lightPoweredMagery', secondary: 'unableToUseMagicInDarkness' });
  assert.equal(careerLightMagery(lu), 1);
  // DarknessMageryFlags at bits 8-9 (DFCareer:339-344)
  const dr = career({ primary: 'darknessPoweredMagery', secondary: 'lowerMagicAbilityDaylight' });
  assert.equal(careerDarknessMagery(dr), 2);
  const du = career({ primary: 'darknessPoweredMagery', secondary: 'unableToUseMagicInDaylight' });
  assert.equal(careerDarknessMagery(du), 1);
  assert.equal(careerLightMagery(du), 0, 'the two mageries are separate bit pairs');
});

// ── 4. RegenerateHealth (:113-143) ────────────────────────────────

test('V2c: regeneration - the %4 cadence and all four flags', () => {
  const p = P(career({ primary: 'regenerateHealth', secondary: 'general' }));
  assert.equal(p.career.regeneration, REGENERATION_FLAGS.general);
  const { log, sinks } = sinkLog();
  passiveSpecialsMagicRound(p, { nowMinutes: noon4, sinks });
  assert.equal(log.heal, REGENERATE_AMOUNT, 'Always: heals 1 on the 4th round');
  passiveSpecialsMagicRound(p, { nowMinutes: noon4 + 1, sinks });
  assert.equal(log.heal, 1, 'off-cadence round heals nothing');

  // InDarkness = IsNight || dungeon (:130)
  const dark = P(career({ primary: 'regenerateHealth', secondary: 'inDarkness' }));
  const d = sinkLog();
  passiveSpecialsMagicRound(dark, { nowMinutes: midnight4, sinks: d.sinks });
  assert.equal(d.log.heal, 1, 'night regenerates');
  passiveSpecialsMagicRound(dark, { nowMinutes: noon4, sinks: d.sinks });
  assert.equal(d.log.heal, 1, 'noon above ground does not');
  setPassiveSpecialsHost({ inDungeon: () => true });
  passiveSpecialsMagicRound(dark, { nowMinutes: noon4, sinks: d.sinks });
  assert.equal(d.log.heal, 2, 'noon IN A DUNGEON does - the OR arm');
  setPassiveSpecialsHost(null);

  // InLight = IsDay && !dungeon (:133)
  const light = P(career({ primary: 'regenerateHealth', secondary: 'inLight' }));
  const l = sinkLog();
  passiveSpecialsMagicRound(light, { nowMinutes: noon4, sinks: l.sinks });
  assert.equal(l.log.heal, 1, 'noon regenerates');
  passiveSpecialsMagicRound(light, { nowMinutes: midnight4, sinks: l.sinks });
  assert.equal(l.log.heal, 1, 'night does not');
  setPassiveSpecialsHost({ inDungeon: () => true });
  passiveSpecialsMagicRound(light, { nowMinutes: noon4, sinks: l.sinks });
  assert.equal(l.log.heal, 1, 'a dungeon blocks the light arm even by day');
  setPassiveSpecialsHost(null);

  // InWater = the motor's swimming flag (:136)
  const wet = P(career({ primary: 'regenerateHealth', secondary: 'whileImmersed' }));
  const w = sinkLog();
  passiveSpecialsMagicRound(wet, { nowMinutes: noon4, sinks: w.sinks });
  assert.equal(w.log.heal, 0, 'dry: nothing');
  setPassiveSpecialsHost({ isSwimming: () => true });
  passiveSpecialsMagicRound(wet, { nowMinutes: noon4, sinks: w.sinks });
  assert.equal(w.log.heal, 1, 'swimming regenerates');
});

// ── 5. DamageFromSunlight / DamageFromHolyPlaces (:149-203) ───────

test('V2c: the sun burns the career flag OR the racial override, only in sunlight, 12 per 4th round', () => {
  const p = P(career({ primary: 'damage', secondary: 'fromSunlight' }));
  const { log, sinks } = sinkLog();
  passiveSpecialsMagicRound(p, { nowMinutes: noon4, sinks });
  assert.equal(log.hurt, SUN_DAMAGE_AMOUNT);
  passiveSpecialsMagicRound(p, { nowMinutes: noon4 + 2, sinks });
  assert.equal(log.hurt, 12, 'off-cadence: nothing');
  passiveSpecialsMagicRound(p, { nowMinutes: midnight4, sinks });
  assert.equal(log.hurt, 12, 'night: nothing');
  setPassiveSpecialsHost({ isInside: () => true });
  passiveSpecialsMagicRound(p, { nowMinutes: noon4, sinks });
  assert.equal(log.hurt, 12, 'inside: the sun cannot reach');
  setPassiveSpecialsHost(null);
  // the RACE arm (:159-161) - the vampire's compound race flag, no career bit
  const v = P();
  v.racialOverride = { sunDamage: true };
  const r = sinkLog();
  passiveSpecialsMagicRound(v, { nowMinutes: noon4, sinks: r.sinks });
  assert.equal(r.log.hurt, SUN_DAMAGE_AMOUNT, 'the override burns without any career flag');
});

test('V2c: holy places burn through the host\'s Temple/849 answer', () => {
  const p = P(career({ primary: 'damage', secondary: 'fromHolyPlaces' }));
  const { log, sinks } = sinkLog();
  passiveSpecialsMagicRound(p, { nowMinutes: noon4, sinks });
  assert.equal(log.hurt, 0, 'not holy: nothing');
  setPassiveSpecialsHost({ isHolyPlace: () => true });
  passiveSpecialsMagicRound(p, { nowMinutes: noon4, sinks });
  assert.equal(log.hurt, HOLY_DAMAGE_AMOUNT);
  const v = P();
  v.racialOverride = { holyDamage: true };
  const r = sinkLog();
  passiveSpecialsMagicRound(v, { nowMinutes: midnight4, sinks: r.sinks });
  assert.equal(r.log.hurt, HOLY_DAMAGE_AMOUNT, 'the override arm, and no day term on holy damage');
});

// ── 6. Light & Darkness Powered Magery (:209-245) ─────────────────

test('V2c: light magery penalized at night or inside; darkness magery in sunlight; the modifier SUMS with the enchant fold', () => {
  const p = P(career({ primary: 'lightPoweredMagery', secondary: 'lowerMagicAbilityDarkness' }));
  p.maxMagicka = 100; p.magicka = 100;
  passiveSpecialsMagicRound(p, { nowMinutes: midnight4 });
  assert.equal(p.maxMagickaModifier, Math.trunc(100 * -0.33), '-33 at night');
  passiveSpecialsMagicRound(p, { nowMinutes: noon4 });
  assert.equal(p.maxMagickaModifier, 0, 'noon outside: the penalty lifts');
  setPassiveSpecialsHost({ isInside: () => true });
  passiveSpecialsMagicRound(p, { nowMinutes: noon4 });
  assert.equal(p.maxMagickaModifier, -33, 'inside by day is darkness too (:212)');
  setPassiveSpecialsHost(null);
  // the SUM: ChangeMaxMagickaModifier accumulates from every producer
  p._enchantMods = { maxMagicka: 25 };
  passiveSpecialsMagicRound(p, { nowMinutes: midnight4 });
  assert.equal(p.maxMagickaModifier, 25 - 33, 'enchant fold + magery in the ONE field');
  passiveSpecialsMagicRound(p, { nowMinutes: noon4 });
  assert.equal(p.maxMagickaModifier, 25, 'by day only the fold remains');

  const d = P(career({ primary: 'darknessPoweredMagery', secondary: 'lowerMagicAbilityDaylight' }));
  d.maxMagicka = 100;
  passiveSpecialsMagicRound(d, { nowMinutes: noon4 });
  assert.equal(d.maxMagickaModifier, -33, 'darkness magery pays in sunlight');
  passiveSpecialsMagicRound(d, { nowMinutes: midnight4 });
  assert.equal(d.maxMagickaModifier, 0, 'and not at night');
  setPassiveSpecialsHost({ isInside: () => true });
  passiveSpecialsMagicRound(d, { nowMinutes: noon4 });
  assert.equal(d.maxMagickaModifier, 0, 'inside there is no sunlight (IsPlayerInSunlight, :371)');
});

test('V2c: THE POISON PIN - unable magery survives repeated rounds on the LIVE accessor', () => {
  // The accessor (defineLiveMaxMagicka) FLOORS at 0, so RawMaxMagicka
  // is read with the modifier ZEROED, never recovered by subtracting
  // it back out. Proven against the subtraction shape: the pin that
  // FAILS on it is the enchant-fold SUM above (a plain headless
  // maxMagicka is not modifier-inclusive, so subtraction eats the
  // fold); this one pins the unable write's round-over-round
  // stability - exactly -10000000 every dark round, never compounded.
  const c = career({ primary: 'lightPoweredMagery', secondary: 'unableToUseMagicInDarkness' });
  const p = defineLiveMaxMagicka(P(c));
  const raw = spellPoints(50, spellPointMultiplier(c.abilityFlagsAndSpellPointsBitfield));
  p.magicka = raw;
  assert.equal(p.maxMagicka, raw, 'accessor sanity: no modifier yet');
  passiveSpecialsMagicRound(p, { nowMinutes: midnight4 });
  assert.equal(p.maxMagickaModifier, MAGERY_UNABLE);
  assert.equal(p.maxMagicka, 0, 'the accessor floors: 0 magicka in darkness');
  assert.equal(p.magicka, 0, 'the clamp (SetMagicka clamps to max)');
  passiveSpecialsMagicRound(p, { nowMinutes: midnight4 + 4 });
  assert.equal(p.maxMagickaModifier, MAGERY_UNABLE, 'round two: still exactly -10000000, not compounded garbage');
  passiveSpecialsMagicRound(p, { nowMinutes: noon4 });
  assert.equal(p.maxMagickaModifier, 0, 'daylight hands the whole pool back');
  assert.equal(p.maxMagicka, raw, 'raw was never corrupted');
});

// ── 7. THE ROUND (worldTick's order) + the vampire integration ────

test('V2c: the vampire actually burns - through runMagicRoundsFor, after the enchant fold', () => {
  const p = P();
  createVampirismCurse(p, VAMPIRE_CLANS.Lyrezi, { now: noon4 });
  assert.equal(p.racialOverride.sunDamage, true, 'V2b minted the flag');
  const before = p.health;
  // a 4-minute noon window crosses exactly one %4 boundary
  runMagicRoundsFor(p, noon4, noon4 + 4, { sinks: { hurt: (n) => { p.health -= n; } } });
  assert.equal(before - p.health, SUN_DAMAGE_AMOUNT, 'V2b\'s STILL OPEN line closes: the sun burns 12');
  const src = read('src/systems/worldTick.js');
  const body = src.slice(src.indexOf('export function runMagicRoundsFor'));
  assert.ok(body.indexOf('enchantmentMagicRound(') < body.indexOf('passiveSpecialsMagicRound('),
    'the pass runs AFTER the enchant fold - its magery arm sums _enchantMods.maxMagicka into the one modifier');
});

// ── 8. THE FOUR HOSTS (the seam registrations, greppable) ─────────

test('V2c: THE FOUR HOSTS answer the sunlight seam', () => {
  // worldModes owns the mode machine for BOTH town pages (world.js and
  // exterior.js each build it), so the one live-mode-routed
  // registration there serves exterior, interior and town dungeons.
  const wm = read('src/scenes/worldModes.js');
  assert.ok(wm.includes('setPassiveSpecialsHost({'), 'worldModes registers');
  assert.ok(wm.includes("isInside: () => mode !== 'exterior'"), 'routed by LIVE mode, never latched');
  assert.ok(wm.includes('BUILDING_TYPES.Temple') && wm.includes('FIGHTER_TRAINERS_FACTION'),
    'the holy pair: Temple type or faction 849 (PlayerEnterExit.cs:1424-1431)');
  // dungeonContext registers its own and RESTORES the displaced host
  // on destroy - a latched dungeon answer would keep the sun off the
  // player forever after the exit.
  const dc = read('src/scenes/dungeonContext.js');
  assert.ok(dc.includes('const _prevPassiveHost = setPassiveSpecialsHost({'), 'dungeonContext registers and keeps the previous');
  assert.ok(dc.includes('setPassiveSpecialsHost(_prevPassiveHost)'), 'destroy() hands the seam back');
  // the enchant ctx wires the two E1-FLAGGED arms off the seam. WAVE
  // D: in the SHARED ctx body, so every host that mounts it answers
  // them - the two reads route by live mode anyway, which is why they
  // are resolved there rather than handed in by each host.
  const he = read('src/scenes/hostEnchant.js');
  assert.ok(he.includes('inSunlight: () => playerInSunlight()'), 'the E1 conditional arms are live');
  assert.ok(he.includes('inHolyPlace: () => playerInHolyPlace()'), 'both of them');
  for (const h of ['src/scenes/world.js', 'src/scenes/dungeonContext.js']) {
    assert.ok(read(h).includes('createEnchantCtx('), `${h} mounts that body`);
  }
  // exterior.js gets the registration from the mode machine it builds
  const ex = read('src/scenes/exterior.js');
  assert.ok(ex.includes('setPassiveSpecialsHost'), 'exterior names the seam at its createWorldModes call');
});
