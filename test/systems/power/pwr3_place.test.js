// PWR3 (2026-10-23, bible/05-Combat/Power-Arc.md section 6; Mac, asked: "Online only, keep a 15% edge"): THE PLACE SETS
// THE PLAYER - a place's ceiling is the deadliest native of its own DFU table; online, a player above it plays at the
// level whose skill line stands 15% over the ceiling's, the world is built at the ceiling, the hero's threat answers the
// level the hero plays at, and the kit stays awake (mentor mode's overlay, a second source). BAL11's Renown arm
// re-derived on the real kit: to Renown 20.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../../../src/systems/uiPrefs.js';
import {
  PLACE_SYNC_EDGE, placeEdgeLevel, placeTargetLevel, expectedSkillAt, refreshMentor, effectiveLevel, playLevel, playLevelIn,
  isMentoring, mentoredSkill, mentorEndedSource, _resetPlaceCeilingForTests,
} from '../../../src/systems/mentorMode.js';
import { mentorStatusText, mentorEndedText } from '../../../src/systems/mentorText.js';
import { DUNGEON_CEILINGS, tableCeiling, dungeonCeiling, groundCeiling, placeCeilingAt, enterDungeonPlace, _resetPlaceSyncForTests } from '../../../src/systems/placeSync.js';
import { ENCOUNTER_TABLES } from '../../../src/characters/encounterTables.js';
import { ENEMY_BASICS } from '../../../src/characters/enemy/enemyBasics.js';
import { CLIMATES } from '../../../src/formats/mapsFile.js';
import { heroThreat, heroThreatOf, HERO_THREAT } from '../../../src/systems/heroThreat.js';
import { RENOWN_SOFT_CAP } from '../../../src/net/renown.js';
import { weaponClimb } from '../../../src/systems/weaponMastery.js';
import { SKILLS } from '../../../src/systems/skills.js';
import { setSigilOnline, setSigilRenown, _resetSigilForTests } from '../../../src/systems/sigil/sigil.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const stats = () => ({ strength: 80, intelligence: 50, willpower: 50, agility: 80, endurance: 80, personality: 50, speed: 70, luck: 50 });
const hero = (level = 30) => {
  const skills = new Array(35).fill(60);
  skills[SKILLS.LongBlade] = 200;
  return { isPlayer: true, level, skills, stats: stats(), maxHealth: 400, rawMaxHealth: 400, health: 400, _online: true, masteredSkills: [SKILLS.LongBlade] };
};
const off = (p) => { refreshMentor(p, [], true, null); _resetPlaceCeilingForTests(); };

test('PWR3 THE CEILINGS ARE DFU\'S: a place\'s ceiling is the deadliest native its own table fields - the highest base level of a monster in it, class foes (who stand at the player\'s level) aside; the open country the deadliest of its climate\'s three tables (mutants: a class foe counted; a table read short; the ground one table)', () => {
  for (let k = 0; k < 19; k++) {
    const mons = ENCOUNTER_TABLES[k].filter((id) => id < 128).map((id) => ENEMY_BASICS[id].level);
    assert.equal(DUNGEON_CEILINGS[k], Math.max(...mons), `dungeon kind ${k}`);
  }
  assert.deepEqual([18, 3, 1, 13, 2, 14].map(dungeonCeiling), [11, 16, 18, 18, 19, 21], 'a Cemetery, a Prison, an Orc and a Giant Stronghold, a Human Stronghold, a Dragon\'s Den');
  assert.equal(tableCeiling(39), null, 'a table of class foes alone has none');
  assert.equal(groundCeiling(CLIMATES.Woodlands), Math.max(tableCeiling(32), tableCeiling(33), tableCeiling(34)));
  assert.equal(groundCeiling(CLIMATES.Woodlands), 19);
  assert.equal(groundCeiling(CLIMATES.HauntedWoodlands), 20, 'the haunted woods\' night');
  assert.equal(groundCeiling(CLIMATES.Ocean), null);
  assert.equal(dungeonCeiling(255), null);
});

test('PWR3 THE EDGE: a player above a place\'s ceiling plays at the level whose skill line (SetEnemyCareer\'s 5L + 30) stands 15% over the ceiling\'s - a Cemetery\'s 11 plays at 14, the bestiary\'s 21 at 25; at or under that level the player plays whole (mutants: the edge moved; the line\'s base; engaged at the edge)', () => {
  assert.equal(PLACE_SYNC_EDGE, 1.15);
  assert.deepEqual([11, 16, 19, 21].map(placeEdgeLevel), [14, 19, 23, 25]);
  for (const c of [11, 16, 19, 21]) assert.ok(Math.abs(expectedSkillAt(placeEdgeLevel(c)) / expectedSkillAt(c) - PLACE_SYNC_EDGE) <= 5 / expectedSkillAt(c), `${c}: within a level's rounding`);
  assert.equal(placeTargetLevel(14, 11), null, 'at the edge: whole');
  assert.equal(placeTargetLevel(15, 11), 14);
  assert.equal(placeTargetLevel(30, null), null, 'no ceiling, no sync');
});

test('PWR3 THE OVERLAY: above the edge the place is the overlay\'s source - the world built at the ceiling, the player at the edge (skills, the level their own spells are cast at), no mentoring; under the edge the world still stops at the ceiling; leaving says so in the place\'s words (mutants: the world at the edge; the place mentoring; the ceiling unkept; the end said as mentoring\'s)', () => {
  const p = hero(30);
  try {
    assert.equal(refreshMentor(p, [], true, 11), 'on');
    assert.deepEqual([p._mentor.source, p._mentor.playLevel, p._mentor.ceiling], ['place', 14, 11]);
    assert.deepEqual([effectiveLevel(p), playLevel(p), isMentoring(p)], [11, 14, false], 'the world at the ceiling, the player at the edge, no mentoring');
    assert.ok(mentoredSkill(p, 200) < 200 && mentoredSkill(p, 200) <= expectedSkillAt(14) + 10, 'the skills the edge\'s');
    assert.match(mentorStatusText(p), /no higher than level 11: you fight as level 14 \(really 30\)/);
    assert.equal(effectiveLevel(p, 21), 21, 'a host\'s own ceiling read over the frame\'s');
    assert.equal(refreshMentor(p, [], true, null), 'off');
    assert.equal(mentorEndedSource(), 'place');
    assert.match(mentorEndedText(), /This place no longer holds you back/);
    const q = hero(13);
    assert.equal(refreshMentor(q, [], true, 11), null, 'under the edge: no overlay');
    assert.equal(effectiveLevel(q), 11, 'but the world stops at the ceiling');
    assert.equal(playLevel(q), 13);
    // the party and the place: the lower plays, the lower world is built; the party's law sleeps the kit
    refreshMentor(p, [5, 5], true, 21);
    assert.deepEqual([p._mentor.source, playLevel(p), effectiveLevel(p), isMentoring(p)], ['party', 6, 6, true]);
  } finally { off(p); }
});

test('PWR3 THE KIT STAYS AWAKE: a place\'s sync is no mentoring - the climb past 100 still pays, read off the synced skill; the party\'s mentoring sleeps it (mutants: the place sleeping the kit; the climb read off the real skill)', () => {
  const p = hero(30);
  try {
    const whole = weaponClimb(p, SKILLS.LongBlade, { online: true });
    assert.ok(whole > 0, 'the climb, whole');
    refreshMentor(p, [], true, 21);
    const synced = weaponClimb(p, SKILLS.LongBlade, { online: true });
    assert.ok(synced > 0 && synced < whole, `synced: still paid, the edge's (${synced} of ${whole})`);
    refreshMentor(p, [5, 5], true, 21);
    assert.equal(weaponClimb(p, SKILLS.LongBlade, { online: true }), 0, 'mentoring: asleep');
  } finally { off(p); }
});

test('PWR3 THE HERO\'S THREAT ANSWERS THE HERO AS THEY PLAY: the level the place\'s edge leaves (a host\'s own ceiling read before the frame\'s), never the world\'s ceiling; the Renown kept; the Renown arm to 20 (mutants: the threat at the world\'s level; the Renown dropped under a place)', () => {
  _resetForTests(); setPref('lootRarity', true);
  _resetSigilForTests(); setSigilOnline(true); setSigilRenown(30);
  const p = hero(30);
  try {
    assert.deepEqual(HERO_THREAT.renown, { from: 15, to: RENOWN_SOFT_CAP, damage: 1.014, health: 1.008 });
    assert.deepEqual(heroThreatOf(p), heroThreat(30, 30), 'no place: the hero whole');
    refreshMentor(p, [], true, 11);   // the frame in the Cemetery: the place's profile live
    assert.equal(playLevelIn(p, 11), 14);
    assert.deepEqual(heroThreatOf(p), heroThreat(14, 30), 'at the Cemetery\'s edge (the frame\'s), with the Renown - a place is no mentoring');
    assert.deepEqual(heroThreatOf(p, { ceiling: 21 }), heroThreat(25, 30), 'a host\'s own ceiling over the frame\'s');
    assert.deepEqual(heroThreat(30, 50), heroThreat(30, 20), 'Renown past 20 pays nothing');
  } finally { off(p); _resetSigilForTests(); _resetForTests(); }
});

test('PWR3 THE PLACE\'S DOORS: online only; a dungeon\'s build reads its own ceiling and hands it to every level it builds at - none on a tuned place; the frame reads the dungeon inside it, the climate\'s ground outside (mutants: offline binding; a tuned place bound; the frame inside reading the ground)', () => {
  _resetPlaceSyncForTests();
  const cemetery = { mapTableData: { dungeonType: 18 } };
  assert.equal(enterDungeonPlace(cemetery, false), null, 'offline (no ?online): none');
  const was = globalThis.location;
  globalThis.location = { search: '?online' };
  try {
    assert.equal(enterDungeonPlace(cemetery, true), null, 'a tuned place: none');
    assert.equal(enterDungeonPlace(cemetery, false), 11);
    assert.equal(placeCeilingAt(true, { insideDungeon: true }, CLIMATES.Woodlands), 11, 'inside: the dungeon built last');
    assert.equal(placeCeilingAt(true, { insideDungeon: false }, CLIMATES.Woodlands), 19, 'outside: the ground');
    assert.equal(placeCeilingAt(false, { insideDungeon: true }, CLIMATES.Woodlands), null, 'offline: never');
  } finally { globalThis.location = was; _resetPlaceSyncForTests(); }
  const dc = rd('src/scenes/dungeonContext.js');
  assert.match(dc, /const _ceiling = enterDungeonPlace\(dfLocation, _made != null \|\| _superTier \|\| _sdRealm \|\| isGateArena\(dfLocation\) \|\| isArenaFloor\(dfLocation\) \|\| !!dfLocation\?\.elite \|\| \(isOnlinePage\(\) && \(isWildRegion\(dfLocation\?\.regionIndex \?\? -1\) \|\| !!dfLocation\?\.ether\)\)\);/);
  assert.doesNotMatch(dc, /effectiveLevel\((?:D\.)?playerEntity\)/, 'every level the build reads takes its ceiling');
  assert.match(dc, /heroThreatOf\(foeDeps\.playerEntity, \{ puppet, ceiling: _ceiling \}\)/);
  assert.equal((dc.match(/where: 'dungeon', ceiling: _ceiling \}\)/g) ?? []).length, 2, 'its loot and gear at the ceiling');
  assert.match(rd('src/scenes/world.js'), /refreshMentor\(playerEntity, mentorLevels, true, placeCeilingAt\(playerEntity\._online, modes\?\.insideContext\?\.\(\), maps\.getClimateIndex\(playerTravelPixel\(\)\.x, playerTravelPixel\(\)\.y\)\)\)/);
  assert.doesNotMatch(rd('src/scenes/hostMagic.js'), /effectiveLevel\(/, 'the player\'s own casts at the level they play at');
});
