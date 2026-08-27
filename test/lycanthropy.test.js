// V2a - THE LYCANTHROPY CURSE, pinned against LycanthropyEffect.cs,
// MorphSelf.cs and DaggerfallDateTime.GetLunarPhase. V1 built the
// infection ramp and pinned that the turn MINTS a pending marker;
// these pins hold the other half: the marker consumed into a live
// racial override, the moons, the advantages, the change, the urge,
// and the cure. Every law figure is DFU's own constant, and the free
// spell is proven against the spellbook's ALREADY-SHIPPED tag laws -
// the U42 seam finally has its producer (TEST THE SHAPE THE PRODUCER
// MINTS).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  LUNAR_PHASES, lunarPhase, lunarPhasesFromMinutes, isFullMoonFromMinutes,
  dateFromClassicMinutes, dateToClassicMinutes, MINUTES_PER_DAY, CLASSIC_GAME_START_TIME,
} from '../src/systems/gameDate.js';
import {
  createLycanthropyCurse, consumeRacialOverridePending, lycanthropyMagicRound,
  morphSelf, updateSatiation, onLycanthropeHit, cureLycanthropy, liveLycanthropy,
  isWearingHircineRing, grantLycanthropySpell, currentMaxHealth,
  LYCANTHROPY_SPELL_TAG, LYCANTHROPY_SPELL_ID, HIRCINE_RING_SUBTYPE,
  NEED_TO_KILL_PERIOD, NEED_TO_KILL_HEALTH_LIMIT_MINIMUM,
  LYCANTHROPE_STATS, LYCANTHROPE_SKILLS, ONCE_PER_DAY, YOU_DREAM_OF_THE_MOON,
} from '../src/systems/lycanthropy.js';
import { LYCANTHROPY_TYPES, startInfection, INFECTION, infectionAccepted } from '../src/systems/infection.js';
import { liveStat } from '../src/systems/statMods.js';
import { skillValue, SKILLS } from '../src/systems/skills.js';
import { liveInfection } from '../src/systems/infection.js';
import { runMagicRoundsFor } from '../src/systems/worldTick.js';
import { spellPointCost, LYCANTHROPY_SPELL_TAG as WINDOW_TAG } from '../src/ui/spellbookWindow.js';
import { setSpellRecordsByIndex } from '../src/systems/loot.js';
import { inflictDisease } from '../src/systems/diseases.js';
import { EQUIP_SLOTS, equipItem, equipTableOf } from '../src/systems/equip.js';
import { WEAPON_MATERIALS } from '../src/characters/weapons.js';
import { ENCHANTMENT_TYPES } from '../src/systems/enchantments.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const noSinks = {};
// A QUIET night on the REAL clock. Two fixture lessons paid here: the
// first draft used year-0 dates, whose classic minutes are NEGATIVE
// (the epoch sits at year 397) - so "one day later" was still before
// the curse's own stamps and the once-a-day gate refused everything -
// and day 0 of year 0 is a secunda full moon, which force-transformed
// the subject before the test's own morph. The moon is always on;
// fixtures walk forward from the classic start to a night without it.
const QUIET = (() => {
  let m = CLASSIC_GAME_START_TIME;
  while (isFullMoonFromMinutes(m) || isFullMoonFromMinutes(m + MINUTES_PER_DAY * 3)) m += MINUTES_PER_DAY;
  return m;
})();
const P = (level = 5) => ({
  isPlayer: true, level, activeEffects: [],
  stats: { strength: 50, agility: 50, endurance: 50, speed: 50, willpower: 50, intelligence: 50, personality: 50, luck: 50 },
  skills: {}, health: 60, maxHealth: 60, items: [], spells: [],
});

beforeEach(() => setSpellRecordsByIndex(null));

// ── THE MOONS ────────────────────────────────────────────────────

test('V2a: the lunar law is GetLunarPhase verbatim, offsets and band order included', () => {
  // moonRatio = (dayOfYear + year*360 + offset) % 32. Build dates by
  // ratio directly: year 0, month 0, day d => dayOfYear d+1.
  const dateAt = (ratioMinusOffset) => ({ year: 0, month: 0, day: ratioMinusOffset - 1, hour: 0, minute: 0 });
  // masser offset 3: day where dayOfYear + 3 === 32 -> ratio 0 -> Full
  assert.equal(lunarPhase(dateAt(29), { masser: true }), LUNAR_PHASES.Full);
  // the SAME date on secunda (offset -1): ratio 28 -> HalfWax - the
  // two moons genuinely differ, which is what makes EITHER-full a law
  assert.equal(lunarPhase(dateAt(29), { masser: false }), LUNAR_PHASES.HalfWax);
  // ratio 16 is NEW because the == tests run before the bands - a
  // reordering that lets <=22 see it calls it OneWax and dies here
  assert.equal(lunarPhase(dateAt(13), { masser: true }), LUNAR_PHASES.New);
  // band edges, masser: 5/6 and 10/11 and 15/17 and 22/23 and 28/29
  const phaseAtRatio = (r) => lunarPhase(dateAt(((r - 3) + 32) % 32 === 0 ? 32 : ((r - 3) + 32) % 32), { masser: true });
  assert.equal(phaseAtRatio(5), LUNAR_PHASES.ThreeWane);
  assert.equal(phaseAtRatio(6), LUNAR_PHASES.HalfWane);
  assert.equal(phaseAtRatio(10), LUNAR_PHASES.HalfWane);
  assert.equal(phaseAtRatio(11), LUNAR_PHASES.OneWane);
  assert.equal(phaseAtRatio(15), LUNAR_PHASES.OneWane);
  assert.equal(phaseAtRatio(17), LUNAR_PHASES.OneWax);
  assert.equal(phaseAtRatio(22), LUNAR_PHASES.OneWax);
  assert.equal(phaseAtRatio(23), LUNAR_PHASES.HalfWax);
  assert.equal(phaseAtRatio(28), LUNAR_PHASES.HalfWax);
  assert.equal(phaseAtRatio(29), LUNAR_PHASES.ThreeWax);
  assert.equal(phaseAtRatio(31), LUNAR_PHASES.ThreeWax);
  // negative years are refused, DFU's own guard
  assert.equal(lunarPhase({ year: -1, month: 0, day: 0 }), LUNAR_PHASES.None);
  // and the minutes reader hands both moons off one clock
  const m = dateToClassicMinutes(dateAt(29));
  assert.deepEqual(lunarPhasesFromMinutes(m), { masser: LUNAR_PHASES.Full, secunda: LUNAR_PHASES.HalfWax });
  assert.equal(isFullMoonFromMinutes(m), true, 'EITHER moon full is a full moon');
});

// ── THE TURN ─────────────────────────────────────────────────────

test('V2a: the pending marker becomes a live curse in the same round, cured clean', () => {
  const p = P();
  p.activeEffects.push({ kind: 'fortifyAttribute', stat: 'luck', magnitude: 5, roundsRemaining: 100 });
  startInfection(p, INFECTION.Werewolf, { day: 0 });
  const day = (d) => d * MINUTES_PER_DAY;
  runMagicRoundsFor(p, day(1) - 1, day(1), { sinks: noSinks });   // the dream
  runMagicRoundsFor(p, day(4) - 1, day(4), { sinks: noSinks });   // the turn
  const entry = liveLycanthropy(p);
  assert.ok(entry, 'the curse stands');
  assert.equal(p.racialOverride, entry, 'the marker IS the entry');
  assert.equal(p.racialOverridePending, undefined);
  assert.equal(entry.infectionType, LYCANTHROPY_TYPES.Werewolf);
  // CureAll at Start: the old fortify ended with the old life
  assert.ok(p.activeEffects.find((a) => a.kind === 'fortifyAttribute').ended);
  assert.equal(liveInfection(p), null, 'nothing left for the temple to cure');
  // and a second infection can never take hold
  assert.equal(infectionAccepted(p, INFECTION.Vampirism), false);
  assert.equal(inflictDisease(p, [1], { rolls: () => 0.99 }), null, 'IsImmuneToDisease');
});

test('V2a: the advantages are +40/+30 through the live channels, re-applied per round', () => {
  const p = P();
  const entry = createLycanthropyCurse(p, LYCANTHROPY_TYPES.Werewolf, { now: QUIET });
  assert.ok(entry);
  lycanthropyMagicRound(p, { nowMinutes: QUIET + 1 });
  for (const stat of LYCANTHROPE_STATS) {
    assert.equal(liveStat(p, stat), 90, `${stat} 50 + 40, read through liveStat itself`);
  }
  assert.equal(liveStat(p, 'willpower'), 50, 'the other four untouched');
  for (const skill of LYCANTHROPE_SKILLS) {
    assert.equal(skillValue(p, skill), skillValue({ ...p, activeEffects: [] }, skill) + 30,
      'the seven skills, +30 through skillValue itself');
  }
  assert.ok(LYCANTHROPE_SKILLS.includes(SKILLS.HandToHand), 'the claws ride Hand-to-Hand');
  // untransformed: iron finds you; transformed: silver or better
  assert.equal(p.minMetalToHit, WEAPON_MATERIALS.Iron);
  morphSelf(p, { force: true, nowMinutes: QUIET + 2 });
  lycanthropyMagicRound(p, { nowMinutes: QUIET + 3 });
  assert.equal(p.minMetalToHit, WEAPON_MATERIALS.Silver);
  assert.equal(p.isInBeastForm, true);
});

// ── THE CHANGE ───────────────────────────────────────────────────

test('V2a: MorphSelf - once a day, hands emptied, healed to the LIMITED max', () => {
  const p = P();
  createLycanthropyCurse(p, LYCANTHROPY_TYPES.Werewolf, { now: QUIET });
  // a sword in hand: the beast drops it
  const sword = { name: 'Sword', group: 'Weapons', templateIndex: 203, hands: 1 };
  p.items.push(sword);
  equipItem(p, sword);
  p.health = 10;
  const said = [];
  const r = morphSelf(p, { nowMinutes: QUIET + MINUTES_PER_DAY + 1, say: (t) => said.push(t) });
  assert.equal(r.ok, true);
  const entry = liveLycanthropy(p);
  assert.equal(entry.isTransformed, true);
  assert.equal(entry.raceNameOverride, 'Werewolf');
  assert.equal(p.health, 60, 'a full heal rides the change');
  const table = equipTableOf(p);
  assert.ok(!table[EQUIP_SLOTS.RightHand] && !table[EQUIP_SLOTS.LeftHand], 'both hands emptied');
  // change back: no gate on the way OUT
  const back = morphSelf(p, { nowMinutes: QUIET + MINUTES_PER_DAY + 2 });
  assert.equal(back.ok, true);
  assert.equal(entry.isTransformed, false);
  assert.equal(entry.raceNameOverride, null);
  // ...but the way IN is once a day, STRICTLY more than 1440 minutes
  const again = morphSelf(p, { nowMinutes: QUIET + MINUTES_PER_DAY + 3, say: (t) => said.push(t) });
  assert.equal(again.ok, false);
  assert.ok(said.includes(ONCE_PER_DAY));
  const later = morphSelf(p, { nowMinutes: (QUIET + MINUTES_PER_DAY + 2) + MINUTES_PER_DAY + 1 });
  assert.equal(later.ok, true, 'a day and a minute later the change is back');
});

test('V2a: the full moon forces the change - unless the Ring of Hircine is worn', () => {
  const fullMoonMinutes = dateToClassicMinutes({ year: 0, month: 0, day: 28, hour: 12, minute: 0 });
  assert.equal(isFullMoonFromMinutes(fullMoonMinutes), true, 'the fixture is a real full moon');
  const p = P();
  createLycanthropyCurse(p, LYCANTHROPY_TYPES.Wereboar, { now: 0 });
  const said = [];
  lycanthropyMagicRound(p, { nowMinutes: fullMoonMinutes, say: (t) => said.push(t) });
  assert.equal(liveLycanthropy(p).isTransformed, true, 'the moon changed you');
  assert.ok(said.includes(YOU_DREAM_OF_THE_MOON));
  assert.equal(liveLycanthropy(p).raceNameOverride, 'Wereboar');

  // the ring: an artifact carrying SpecialArtifactEffect param 3
  const ringed = P();
  createLycanthropyCurse(ringed, LYCANTHROPY_TYPES.Werewolf, { now: 0 });
  equipTableOf(ringed)[EQUIP_SLOTS.Ring0] = {
    name: 'Ring of Hircine',
    enchantments: [{ type: ENCHANTMENT_TYPES.SpecialArtifactEffect, param: HIRCINE_RING_SUBTYPE }],
  };
  assert.equal(isWearingHircineRing(ringed), true);
  lycanthropyMagicRound(ringed, { nowMinutes: fullMoonMinutes });
  assert.equal(liveLycanthropy(ringed).isTransformed, false, 'Hircine masters the moon');
});

// ── THE URGE ─────────────────────────────────────────────────────

test('V2a: a month without innocent blood shrinks the ceiling by 24 a day to the floor of 4', () => {
  const p = P();
  createLycanthropyCurse(p, LYCANTHROPY_TYPES.Werewolf, { now: QUIET });
  // one day past the month: limit = 60 - round(1440 * 24/1440) = 36
  const now = QUIET + NEED_TO_KILL_PERIOD + MINUTES_PER_DAY;
  lycanthropyMagicRound(p, { nowMinutes: now });
  const entry = liveLycanthropy(p);
  assert.equal(entry.urgeToKillRising, true);
  assert.equal(p.maxHealthLimiter, 36);
  assert.equal(p.health, 36, 'the ceiling clamps the blood down');
  assert.equal(currentMaxHealth(p), 36);
  // far past: the floor is 4, never less
  lycanthropyMagicRound(p, { nowMinutes: QUIET + NEED_TO_KILL_PERIOD * 10 });
  assert.equal(p.maxHealthLimiter, NEED_TO_KILL_HEALTH_LIMIT_MINIMUM);
  // an innocent's death resets everything - a dead CIVILIAN through
  // the player's own hit
  onLycanthropeHit(p, { health: 0 }, { nowMinutes: QUIET + NEED_TO_KILL_PERIOD * 10 + 5, isCivilian: true });
  assert.equal(entry.urgeToKillRising, false);
  assert.equal(p.maxHealthLimiter, null);
  lycanthropyMagicRound(p, { nowMinutes: QUIET + NEED_TO_KILL_PERIOD * 10 + 6 });
  assert.equal(entry.urgeToKillRising, false, 'satiated for another month');
  // the city watch counts as innocent; a LIVE one does not satiate
  updateSatiation(p, QUIET);
  lycanthropyMagicRound(p, { nowMinutes: QUIET + NEED_TO_KILL_PERIOD + 10 });
  assert.equal(entry.urgeToKillRising, true);
  onLycanthropeHit(p, { health: 5 }, { nowMinutes: QUIET + NEED_TO_KILL_PERIOD + 11, mobileType: 146 });
  assert.equal(entry.urgeToKillRising, true, 'a wounded watchman feeds nothing');
  onLycanthropeHit(p, { health: 0 }, { nowMinutes: QUIET + NEED_TO_KILL_PERIOD + 12, mobileType: 146 });
  assert.equal(entry.urgeToKillRising, false, 'Knight_CityWatch is innocent enough');
});

// ── THE SPELL, THROUGH THE U42 SEAM ──────────────────────────────

test('V2a: the free spell is record 92, name-stripped, and the spellbook already knows its tag', () => {
  setSpellRecordsByIndex(new Map([[LYCANTHROPY_SPELL_ID,
    { index: 92, name: '!Lycanthropy', cost: 50, effects: [{ type: 29, subType: -1 }] }]]));
  const p = P();
  createLycanthropyCurse(p, LYCANTHROPY_TYPES.Werewolf, { now: 0 });
  const spell = p.spells.find((s) => s.tag === LYCANTHROPY_SPELL_TAG);
  assert.ok(spell, 'the curse grants the spell');
  assert.equal(spell.name, 'Lycanthropy', "the '!' is stripped");
  assert.equal(spell.custom, true, 'saved whole, not as a bare index');
  // THE PRODUCER MEETS THE SHIPPED CONSUMER: the spellbook's free-cast
  // and delete-refusal laws have keyed on this tag since U42 with no
  // producer minting it - the exact {enchanted:true} failure shape
  // AUDIT 17e recorded. Now the shapes meet.
  assert.equal(spellPointCost(spell, () => 999), 0, 'the book casts it free');
  assert.equal(WINDOW_TAG, LYCANTHROPY_SPELL_TAG, 'one spelling, re-exported');
  assert.match(read('src/ui/spellbookWindow.js'), /tag === LYCANTHROPY_SPELL_TAG.*CANNOT_DELETE_WERE/,
    'and the delete refusal keys on the same tag');
  // granting twice does not stack
  grantLycanthropySpell(p);
  assert.equal(p.spells.filter((s) => s.tag === LYCANTHROPY_SPELL_TAG).length, 1);
});

// ── THE CURE, AND THE SAVE ───────────────────────────────────────

test('V2a: the cure unmakes everything, one classic minute later', () => {
  setSpellRecordsByIndex(new Map([[92, { index: 92, name: '!Lycanthropy', effects: [] }]]));
  const p = P();
  createLycanthropyCurse(p, LYCANTHROPY_TYPES.Werewolf, { now: 0 });
  morphSelf(p, { force: true, nowMinutes: QUIET + 5 });
  let advanced = 0;
  assert.equal(cureLycanthropy(p, { nowMinutes: QUIET + 6, advanceMinutes: (n) => { advanced += n; } }), true);
  assert.equal(liveLycanthropy(p), null);
  assert.equal(p.racialOverride, null);
  assert.equal(p.isInBeastForm, false);
  assert.equal(p.maxHealthLimiter, null);
  assert.equal(p.health, 60, 'a full RAW heal');
  assert.equal(advanced, 1, 'RaiseTime(60) is sixty SECONDS - one minute, not an hour');
  assert.equal(p.spells.some((s) => s.tag === LYCANTHROPY_SPELL_TAG), false, 'the tagged spell went with it');
  assert.equal(infectionAccepted(p, INFECTION.Werewolf), true, 'a cured man can be bitten again');
});

test('V2a: the curse survives the save whole, marker rebuilt from the entry', async () => {
  const { snapshotPlayer, restorePlayer } = await import('../src/systems/save.js');
  const p = P();
  createLycanthropyCurse(p, LYCANTHROPY_TYPES.Wereboar, { now: QUIET + 100 });
  lycanthropyMagicRound(p, { nowMinutes: QUIET + 200 });
  morphSelf(p, { force: true, nowMinutes: QUIET + 300 });
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(p, { classicMinutes: QUIET + 300 })));
  const q = P();
  restorePlayer(q, snap);
  const entry = liveLycanthropy(q);
  assert.ok(entry, 'the entry rode activeEffects');
  assert.equal(entry.infectionType, LYCANTHROPY_TYPES.Wereboar);
  assert.equal(entry.isTransformed, true);
  assert.equal(entry.lastCastMorphSelf, QUIET + 300);
  assert.equal(q.racialOverride, entry, 'the MARKER is rebuilt, never trusted from the envelope');
  assert.equal(entry.skillMods && typeof entry.skillMods, 'object', 'the skill map detached with the snapshot');
});

// ── THE SEAMS, SWEPT ─────────────────────────────────────────────

test('V2a: the round pump runs the curse beside the infection, in worldTick\'s one home', () => {
  const src = read('src/systems/worldTick.js');
  const i = src.indexOf('runInfections(entity');
  const j = src.indexOf('consumeRacialOverridePending(entity');
  const k = src.indexOf('lycanthropyMagicRound(entity');
  assert.ok(i > 0 && j > i && k > j,
    'infection -> consume -> fold, in the same round, in that order');
});

test('V2a: the ONE cast engine wires MorphSelf, and every host hands it the clock', () => {
  assert.match(read('src/scenes/hostMagic.js'), /base\.morphSelf = \(\) => morphSelf\(playerEntity/,
    'the arm rides applySpellToPlayer for every host at once');
  // THE FOUR HOSTS: world, exterior and the dungeon context build the
  // magic engine and pass their clocks; worldModes BORROWS the outer
  // host\'s engine (mountInterior\'s makeSpellbookWindow casts through
  // it), so it is wired by construction - named here so the record
  // holds all four.
  for (const host of ['scenes/world.js', 'scenes/exterior.js', 'scenes/dungeonContext.js']) {
    assert.match(read(`src/${host}`), /now: \(\) => [A-Za-z.]*(classicMinutes|value)/,
      `${host} hands the once-a-day clock`);
  }
});

test('V2a: the tag\'s home moved to the producer; the spellbook re-exports one spelling', () => {
  const win = read('src/ui/spellbookWindow.js');
  assert.match(win, /import \{ VAMPIRE_SPELL_TAG, LYCANTHROPY_SPELL_TAG \} from '..\/systems\/lycanthropy.js'/);
  assert.doesNotMatch(win, /LYCANTHROPY_SPELL_TAG = '/, 'no second literal');
});
