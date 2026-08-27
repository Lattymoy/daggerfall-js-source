// V2b - THE VAMPIRISM CURSE, pinned against VampirismEffect.cs. The
// other racial override, on V2a's shape: the entry, the marker, the
// channels - and the vampire's own asymmetries held explicitly
// against the werewolf's: feeding is ANY landed hit (no innocence
// test), the advantages add Willpower/Personality/Luck and skip
// Swimming, Intelligence belongs to the Anthotis alone, silver finds
// you ALWAYS, and the sun does not so much hurt as forbid - the rest
// gate is hunger, the travel gate is daylight.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createVampirismCurse, consumeVampirismPending, vampirismMagicRound,
  isVampireSatiated, onVampireHit, racialRestBlock, racialFastTravelBlock,
  cureVampirism, liveVampirism, grantVampireSpells, isDayFromMinutes,
  VAMPIRE_STATS, VAMPIRE_SKILLS, VAMPIRE_STAT_MOD, VAMPIRE_SKILL_MOD,
  NOT_SATED_TEXT_ID, VAMPIRE_BASE_SPELLS, VAMPIRE_CLAN_SPELLS,
} from '../src/systems/vampirism.js';
import { createLycanthropyCurse, VAMPIRE_SPELL_TAG } from '../src/systems/lycanthropy.js';
import { VAMPIRE_CLANS, startInfection, INFECTION, markDreamPlayed, liveInfection } from '../src/systems/infection.js';
import { liveStat } from '../src/systems/statMods.js';
import { skillValue, SKILLS } from '../src/systems/skills.js';
import { runMagicRoundsFor } from '../src/systems/worldTick.js';
import { isEntityImmuneToParalysis } from '../src/systems/effects.js';
import { setSpellRecordsByIndex } from '../src/systems/loot.js';
import { WEAPON_MATERIALS } from '../src/characters/weapons.js';
import {
  MINUTES_PER_DAY, CLASSIC_GAME_START_TIME, dateFromClassicMinutes,
} from '../src/systems/gameDate.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const noSinks = {};
const P = (level = 5) => ({
  isPlayer: true, level, activeEffects: [],
  stats: { strength: 50, agility: 50, endurance: 50, speed: 50, willpower: 50, intelligence: 50, personality: 50, luck: 50 },
  skills: {}, health: 60, maxHealth: 60, items: [], spells: [],
});
// noon and midnight on the real clock (the V2a epoch lesson)
const dayAnchor = (() => {
  let m = CLASSIC_GAME_START_TIME;
  while (dateFromClassicMinutes(m).hour !== 12) m += 30;
  return m;
})();
const nightAnchor = dayAnchor + 12 * 60;   // 00:00 the next day

beforeEach(() => setSpellRecordsByIndex(null));

test('V2b: the turn completes through worldTick - death video, deploy, curse, clan', () => {
  const p = P();
  startInfection(p, INFECTION.Vampirism, { day: 0 });
  const day = (d) => d * MINUTES_PER_DAY;
  runMagicRoundsFor(p, day(1) - 1, day(1), { sinks: noSinks });   // the dream (null host: played instantly)
  assert.equal(liveInfection(p).dreamPlayed, true);
  runMagicRoundsFor(p, day(4) - 1, day(4), { sinks: noSinks });   // the fake death -> deploy -> consume
  const entry = liveVampirism(p);
  assert.ok(entry, 'the curse stands in the same round the marker was minted');
  assert.equal(p.racialOverridePending, undefined);
  assert.equal(p.racialOverride, entry);
  assert.equal(entry.clan, VAMPIRE_CLANS.Lyrezi, 'no clan host: the Lyrezi default, like classic');
  assert.equal(entry.sunDamage, true);
  assert.equal(liveInfection(p), null, 'nothing left to cure');
});

test('V2b: the advantages are the VAMPIRE\'S seven and six - Anthotis minds alone add Intelligence', () => {
  const p = P();
  createVampirismCurse(p, VAMPIRE_CLANS.Vraseth, { now: 0 });
  vampirismMagicRound(p, { nowMinutes: 1 });
  for (const stat of VAMPIRE_STATS) assert.equal(liveStat(p, stat), 70, `${stat} +20`);
  assert.equal(liveStat(p, 'intelligence'), 50, 'a Vraseth mind is untouched');
  for (const skill of VAMPIRE_SKILLS) {
    assert.equal(skillValue(p, skill), skillValue({ ...p, activeEffects: [] }, skill) + VAMPIRE_SKILL_MOD);
  }
  assert.ok(!VAMPIRE_SKILLS.includes(SKILLS.Swimming), 'the dead do not float better - no Swimming, unlike the werewolf');
  assert.equal(VAMPIRE_STAT_MOD, 20);
  assert.equal(p.minMetalToHit, WEAPON_MATERIALS.Silver, 'silver ALWAYS - there is no untransformed vampire');
  assert.equal(isEntityImmuneToParalysis(p), true, 'the compound race is immune');

  const anthotis = P();
  createVampirismCurse(anthotis, VAMPIRE_CLANS.Anthotis, { now: 0 });
  vampirismMagicRound(anthotis, { nowMinutes: 1 });
  assert.equal(liveStat(anthotis, 'intelligence'), 70, 'the Anthotis add the eighth stat');
});

test('V2b: feeding is fighting - any landed hit sates, and hunger blocks rest with TEXT.RSC 36', () => {
  const p = P();
  createVampirismCurse(p, VAMPIRE_CLANS.Lyrezi, { now: 1000 });
  assert.equal(isVampireSatiated(p, 1000 + MINUTES_PER_DAY), true, 'fed within a day, <= not <');
  assert.equal(isVampireSatiated(p, 1000 + MINUTES_PER_DAY + 1), false);
  assert.equal(racialRestBlock(p, 1000)?.textId, undefined, 'fed: rest is open');
  assert.deepEqual(racialRestBlock(p, 1000 + MINUTES_PER_DAY + 1), { textId: NOT_SATED_TEXT_ID });
  // ANY hit feeds - no innocence test, DFU's own asymmetry with the wolf
  onVampireHit(p, 1000 + MINUTES_PER_DAY + 5);
  assert.equal(racialRestBlock(p, 1000 + MINUTES_PER_DAY + 6), null, 'the blood is fresh again');
  // a werewolf's rest is never blocked - its CheckStartRest is the base's
  const wolf = P();
  createLycanthropyCurse(wolf, 1, { now: 0 });
  assert.equal(racialRestBlock(wolf, 1e7), null);
});

test('V2b: daylight forbids fast travel for a sun-damaged override; night opens it', () => {
  assert.equal(isDayFromMinutes(dayAnchor), true, 'the fixture is noon');
  assert.equal(isDayFromMinutes(nightAnchor), false, 'and midnight');
  const p = P();
  createVampirismCurse(p, VAMPIRE_CLANS.Lyrezi, { now: 0 });
  assert.ok(racialFastTravelBlock(p, dayAnchor)?.text, 'the sun bars the door');
  assert.equal(racialFastTravelBlock(p, nightAnchor), null, 'the night does not');
  assert.equal(racialFastTravelBlock(P(), dayAnchor), null, 'a mortal travels at noon');
  const wolf = P();
  createLycanthropyCurse(wolf, 1, { now: 0 });
  assert.equal(racialFastTravelBlock(wolf, dayAnchor), null, 'the wolf carries no sun damage');
});

test('V2b: the clan spells - three for every clan, then the clan\'s own, tagged and stripped', () => {
  const records = new Map();
  for (const id of [...VAMPIRE_BASE_SPELLS, ...Object.values(VAMPIRE_CLAN_SPELLS).flat()]) {
    records.set(id, { index: id, name: id === 90 ? '!Charm Mortal' : `Spell ${id}`, effects: [] });
  }
  setSpellRecordsByIndex(records);
  const p = P();
  createVampirismCurse(p, VAMPIRE_CLANS.Selenu, { now: 0 });
  const tagged = p.spells.filter((s) => s.tag === VAMPIRE_SPELL_TAG);
  assert.equal(tagged.length, VAMPIRE_BASE_SPELLS.length + VAMPIRE_CLAN_SPELLS[VAMPIRE_CLANS.Selenu].length,
    'Selenu: the base three plus the three resists');
  assert.ok(tagged.every((s) => s.custom === true), 'saved whole');
  assert.ok(tagged.some((s) => s.name === 'Charm Mortal'), "the '!' is stripped");
  assert.equal(grantVampireSpells(p, VAMPIRE_CLANS.Selenu), 0, 'a regrant adds nothing');
  // the clan table itself, spot-held both ways
  assert.deepEqual(VAMPIRE_CLAN_SPELLS[VAMPIRE_CLANS.Montalion], [94], 'the Montalion carry Recall');
  assert.deepEqual(VAMPIRE_CLAN_SPELLS[VAMPIRE_CLANS.Haarvenu], [20, 33]);
});

test('V2b: the cure remembers the clan, takes a minute, and burns the spells', () => {
  setSpellRecordsByIndex(new Map([[4, { index: 4, name: 'Levitate', effects: [] }]]));
  const p = P();
  createVampirismCurse(p, VAMPIRE_CLANS.Khulari, { now: 0 });
  let advanced = 0;
  assert.equal(cureVampirism(p, { advanceMinutes: (n) => { advanced += n; } }), true);
  assert.equal(liveVampirism(p), null);
  assert.equal(p.racialOverride, null);
  assert.equal(p.previousVampireClan, VAMPIRE_CLANS.Khulari,
    'PreviousVampireClan - the clan outlives the curse');
  assert.equal(advanced, 1, 'sixty SECONDS, the V2a lesson holds here too');
  assert.equal(p.spells.some((s) => s.tag === VAMPIRE_SPELL_TAG), false);
});

test('V2b: the curse survives the save, marker rebuilt', async () => {
  const { snapshotPlayer, restorePlayer } = await import('../src/systems/save.js');
  const p = P();
  createVampirismCurse(p, VAMPIRE_CLANS.Garlythi, { now: 777 });
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(p, { classicMinutes: 800 })));
  const q = P();
  restorePlayer(q, snap);
  const entry = liveVampirism(q);
  assert.ok(entry);
  assert.equal(entry.clan, VAMPIRE_CLANS.Garlythi);
  assert.equal(entry.lastTimeFed, 777);
  assert.equal(q.racialOverride, entry);
});

// ── THE SEAMS, SWEPT ─────────────────────────────────────────────

test('V2b: one round runs both curses; the hit hook is REGISTERED, not imported', () => {
  const tick = read('src/systems/worldTick.js');
  const order = ['runInfections(entity', 'consumeRacialOverridePending(entity',
    'consumeVampirismPending(entity', 'lycanthropyMagicRound(entity', 'vampirismMagicRound(entity'];
  let at = -1;
  for (const needle of order) {
    const i = tick.indexOf(needle);
    assert.ok(i > at, `round order: ${needle}`);
    at = i;
  }
  assert.match(tick, /setRacialHitHook\(/, 'worldTick registers OnWeaponHitEntity');
  const formulas = read('src/combat/formulas.js');
  assert.match(formulas, /_racialHitHook\?\.\(attacker, target/, 'the tail calls the hook');
  assert.doesNotMatch(formulas, /from '..\/systems\/lycanthropy|from '..\/systems\/vampirism/,
    'formulas must not import the curses - the dice100 cycle');
});

test('V2b: THE FOUR HOSTS wire the vampire\'s rest gate, and only the world hosts travel\'s', () => {
  for (const host of ['scenes/world.js', 'scenes/exterior.js', 'scenes/dungeonContext.js', 'scenes/worldModes.js']) {
    const src = read(`src/${host}`);
    assert.match(src, /racialRestBlock\(playerEntity/, `${host} asks the rest gate`);
    assert.match(src, /racialOverrideBlocks: !!rb/, `${host} feeds the dispatch`);
  }
  const world = read('src/scenes/world.js');
  assert.match(world, /racialFastTravelBlock\(playerEntity/, 'the map door asks the daylight gate');
  assert.match(world, /sunAverse: !!playerEntity\.racialOverride\?\.sunDamage/,
    'the arrival clamp\'s sunAverse parameter is finally wired');
});
