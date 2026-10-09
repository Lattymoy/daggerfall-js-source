// @ts-nocheck
// CHAP6d (2026-10-09, Mac: "continue", the Chapters arc's sixth slice - bible/11-Multiplayer/Chapters-Arc.md 7 and 9):
// THE SEASON ON THE HALLS. The law: a hall's price factor by its chapter's band and Season (an Ascendancy's tenth on
// training and spells, "cheaper training"'s tenth on training alone), its shelf (the band's step and "a deeper shelf"'s
// two, inside the band's bounds), shut halls and their line. The living world: a shut hall keeps no evenings, and its
// guildsmen keep their working day at home. The host's wiring: the whole chapter handed to the hall, each window priced
// by its own service, a shut hall's services refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  chapterHallFactor, chapterHallShelf, chapterHallShut, chapterShelfQuality, chapterPriceFactor, CHAPTER_HALL_SHUT_LINE, CHAPTER_HALL_SERVICES,
  CHAPTER_EVENT_EFFECTS, CHAPTER_DOCTRINE_EFFECTS,
} from '../src/net/npcChapterLaw.js';
import { synthTown } from './lwTown.mjs';
import { townPlaces } from '../src/systems/livingWorld/places.js';
import { townCensus } from '../src/systems/livingWorld/census.js';
import { dayPlan, hallGuildDays, GUILD_DAYS, GUILD_DAYS_SHUT, FIGHTERS_GUILD, MAGES_GUILD } from '../src/systems/livingWorld/dayPlan.js';
import { LivingTown } from '../src/systems/livingWorld/livingTown.js';
import { BUILDING_TYPES as B } from '../src/world/buildingNames.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const MPM = PERSON_MOVE_SPEED / CLASSIC_MINUTES_PER_SECOND;
const TOWN = Object.freeze({ mapId: 4242, blocks: 36, region: 17, people: 3, port: false });

// ── THE LAW ─────────────────────────────────────────────────────────

test('CHAP6d a hall\'s price factor: its band\'s, an Ascendancy\'s further tenth on training and spells alike, "cheaper training"\'s tenth on training alone; none known, DFU\'s own (mutants: the band, the Ascendancy, the doctrine, the service)', () => {
  assert.deepEqual(CHAPTER_HALL_SERVICES, ['training', 'spells']);
  assert.equal(CHAPTER_EVENT_EFFECTS.ascendancyPrice, 0.9);
  const f = (c, service) => chapterHallFactor(c, service);
  assert.deepEqual([f(null, 'training'), f(null, 'spells')], [1, 1]);
  assert.deepEqual([f({ strength: 10 }, 'training'), f({ strength: 50 }, 'spells'), f({ strength: 80 }, 'training')], [chapterPriceFactor(10), 1, chapterPriceFactor(80)]);
  assert.equal(f({ strength: 50, event: 'ascendancy' }, 'spells'), 0.9);
  assert.equal(f({ strength: 50, event: 'ascendancy' }, 'training'), 0.9);
  assert.equal(f({ strength: 95, event: 'ascendancy' }, 'spells'), chapterPriceFactor(95) * 0.9);
  assert.equal(f({ strength: 50, doctrine: 'training' }, 'training'), CHAPTER_DOCTRINE_EFFECTS.training);
  assert.equal(f({ strength: 50, doctrine: 'training' }, 'spells'), 1, 'the training\'s doctrine prices no spell');
  assert.equal(f({ strength: 50, event: 'ascendancy', doctrine: 'training' }, 'training'), 0.9 * 0.9);
  assert.deepEqual([f({ strength: 50, event: 'decline', doctrine: 'shelf' }, 'training'), f({ strength: 50, event: 'Ascendancy', doctrine: 'gold' }, 'training')], [1, 1], 'no other event, nor doctrine, nor a name it does not know');
});

test('CHAP6d a hall\'s shelf: the band\'s step and "a deeper shelf"\'s two, inside the band\'s own bounds; none known, DFU\'s own (mutants: the doctrine\'s two, the bounds, the none)', () => {
  assert.deepEqual([chapterHallShelf(10, null), chapterHallShelf(0, { strength: 50, doctrine: 'shelf' })], [10, 0], 'DFU\'s own; a hall of no quality untouched');
  assert.equal(chapterHallShelf(10, { strength: 50, doctrine: 'shelf' }), 12);
  assert.equal(chapterHallShelf(10, { strength: 80, doctrine: 'shelf' }), 16, 'Thriving\'s four and the doctrine\'s two');
  assert.equal(chapterHallShelf(10, { strength: 10, doctrine: 'shelf' }), 8, 'Failing\'s four less, the doctrine\'s two back');
  assert.equal(chapterHallShelf(19, { strength: 80, doctrine: 'shelf' }), 20, 'never past 20');
  assert.equal(chapterHallShelf(25, { strength: 50, doctrine: 'shelf' }), 25, 'a world-data hall past 20 never lowered by it');
  assert.equal(chapterHallShelf(10, { strength: 80, doctrine: 'writs' }), chapterShelfQuality(10, 80), 'another doctrine: the band\'s alone');
  assert.deepEqual([chapterShelfQuality(10, 50), chapterShelfQuality(10, 80)], [10, 14], 'the band\'s own law unchanged');
});

test('CHAP6d shut halls: shut where the sheet says so, and what such a hall says (mutants: the read, the line)', () => {
  assert.deepEqual([chapterHallShut({ strength: 20, shut: true }), chapterHallShut({ strength: 20, shut: 'yes' }), chapterHallShut(null)], [true, false, false]);
  assert.equal(CHAPTER_HALL_SHUT_LINE, 'The hall is shut this Season, by the watch\'s order.');
});

// ── THE LIVING WORLD ────────────────────────────────────────────────

function guildTown() {
  const halls = { 1006: [B.GuildHall, MAGES_GUILD], 1009: [B.GuildHall, FIGHTERS_GUILD], 1030: [B.GuildHall, FIGHTERS_GUILD] };
  const fx = synthTown({ blocksW: 6, blocksH: 6 });
  const buildings = fx.buildings.map((b) => (halls[b.key] ? { ...b, type: halls[b.key][0], factionId: halls[b.key][1] } : b));
  const places = townPlaces(fx.nav, fx.doors, buildings);
  const census = townCensus(TOWN, buildings, new Set(places.doors.keys()));
  return { fx, buildings, places, census };
}

test('CHAP6d a shut hall keeps no evenings, and its guildsmen keep their working day at home; an open hall\'s as before (mutants: the shut days, the guildsman\'s home)', () => {
  const { places, census } = guildTown();
  assert.equal(GUILD_DAYS_SHUT, 0);
  const fighters = [...places.doors.values()].find((d) => places.factions.get(d.building) === FIGHTERS_GUILD);
  assert.deepEqual([hallGuildDays(places, fighters, () => 'shut'), hallGuildDays(places, fighters, () => 'thriving'), hallGuildDays(places, fighters, () => null)], [0, 3, GUILD_DAYS]);
  const shut = (f) => (f === FIGHTERS_GUILD ? 'shut' : null);
  const guildsmen = census.filter((r) => r.job === 'guildsman' && r.work != null && places.factions.get(places.doors.get(r.work)?.building) === FIGHTERS_GUILD);
  assert.ok(guildsmen.length, 'the town keeps the Fighters\' guildsmen');
  for (const r of guildsmen) {
    const home = r.home != null ? places.doors.get(r.home) : null;
    const plan = dayPlan(r, places, 300, { mpm: MPM, bandOf: shut });
    const works = plan.filter((e) => e.kind === 'work');
    assert.ok(works.length && works.every((e) => e.at === home), `${r.id}: at home`);
    const open = dayPlan(r, places, 300, { mpm: MPM, bandOf: () => 'thriving' }).filter((e) => e.kind === 'work');
    assert.ok(open.some((e) => e.at === places.doors.get(r.work)), `${r.id}: at the hall when it is open`);
  }
  for (const r of census.filter((x) => x.job !== 'guildsman')) {
    for (let day = 300; day < 307; day++) {
      for (const e of dayPlan(r, places, day, { mpm: MPM, bandOf: shut })) if (e.kind === 'guild') assert.notEqual(places.factions.get(e.at?.building), FIGHTERS_GUILD, `${r.id}: no evening at a shut hall`);
    }
  }
});

test('CHAP6d the living town reads a shut hall as its own band - its plans made again the minute it shuts (mutants: the read)', () => {
  const { fx, buildings } = guildTown();
  const t = { now: 300 * 1440 + 480 };
  let chapter = { band: 'thriving', name: 'the Fighters Guild', shut: false };
  const lt = new LivingTown(fx.nav, { town: TOWN, buildings, doors: fx.doors, makePerson: () => null, clock: () => t.now, rate: () => CLASSIC_MINUTES_PER_SECOND, mpm: MPM, chapterOf: (f) => (f === FIGHTERS_GUILD ? chapter : null) });
  assert.equal(lt._chapterRead().bands.get(FIGHTERS_GUILD), 'thriving');
  chapter = { ...chapter, shut: true };
  t.now += 1;
  assert.equal(lt._chapterRead().bands.get(FIGHTERS_GUILD), 'shut');
});

// ── THE HOST ────────────────────────────────────────────────────────

test('CHAP6d the wiring: the host hands the hall its whole chapter; each window priced by its own service; the three shelves by the chapter; a shut hall\'s services refused before any window (mutants: each seam)', () => {
  const modes = src('src/scenes/worldModes.js');
  assert.match(modes, /const chapterFactor = \(\/\*\* @type \{string\} \*\/ service\) => chapterHallFactor\(chapterHere\(\), service, host\.guildId\?\.\(\) \?\? null\);/);   // PIN MOVED (CHAP7b): and the reader's guild, a patron's members' price
  assert.match(modes, /const shelfQuality = \(\) => chapterHallShelf\(b\?\.quality \?\? 0, chapterHere\(\)\);/);
  // PIN MOVED (AUDIT CHAP5 D2): the services refused, DFU's popup standing - audit_chap5 pins the seams
  assert.match(modes, /const shutBox = \(\) => \(chapterHallShut\(host\.chapterHere\?\.\(guild\.factionId\) \?\? null\) \? \{ rows: \[CHAPTER_HALL_SHUT_LINE\] \} : null\);/);
  assert.match(modes, /const bookFactor = chapterFactor\('spells'\);/);
  assert.match(modes, /const makerFactor = chapterFactor\('spells'\);/);
  assert.match(modes, /priceFactor: chapterFactor\('training'\),/);
  assert.equal((modes.match(/quality: shelfQuality\(\)/g) ?? []).length, 3);
  assert.match(src('src/scenes/world.js'), /const c = Number\.isInteger\(region\) \? chapterSheet\?\.chapterOf\(faction, region\) \?\? null : null;\n(\s+\/\/.*\n)+\s+if \(c\?\.patron && guildBook\?\.stale\?\.\(\)\) guildBook\.refresh\(\)\.catch\(\(\) => \{\}\);\n\s+return c;\n\s+\},\n\s+\/\/ CHAP4b/);   // PIN MOVED (AUDIT CHAP5 C1)
});
