// STAR2 (bible/11-Multiplayer/Starfall.md sections 1 and 2): THE COVENS, THE NIGHT'S STARS AND THE WITCHES' NIGHT - the bag
// that names a night's coven, the twelve held against the player's own data (MAPS.BSA's covens, FACTION.TXT's witches,
// DFU's quest places), a night's three pixels in its coven's wilds over the gate's own scan, and the festival's night
// read off the sky. tools/mutants/star2.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { STAR_COVENS, STAR_COVENS_APART, starCovenOf, covenLocation, covenFactionName } from '../../../src/systems/starfall/starfallCovens.js';
import { findStarSites, starSiteKey, STAR_APART_PX } from '../../../src/systems/starfall/starfallSites.js';
import { WITCHES_FESTIVAL_DAY, witchesNight, heartStar, HEART_STAR, nightDayOfYear } from '../../../src/systems/starfall/starfallNight.js';
import { STAR_HOUR_MS, STAR_PER_NIGHT, starTimes } from '../../../src/net/starfall/starfallLaw.js';
import { DAEDRA } from '../../../src/systems/daedraSummoning.js';
import { HOLIDAYS, holidayDayOfYear } from '../../../src/systems/holidays.js';
import { WILD_REGION } from '../../../src/systems/wild/wildZone.js';
import { gateScanner, findGateSite } from '../../../src/systems/gate/gateSite.js';
import { gameDayAt } from '../../../src/net/gate/gateLaw.js';
import { LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { FactionFile, FACTION_TYPES } from '../../../src/formats/factionFile.js';
import { WoodsFile } from '../../../src/formats/woodsFile.js';
import { HAS_ARENA2, ARENA2, loadMaps, ROOT } from '../../arena1Data.mjs';
import { FESTIVALS } from '../../../src/net/festivalLaw.js';
const { fromMs: FESTIVAL_FROM_MS, toMs: FESTIVAL_TO_MS } = FESTIVALS[0];   // the Witches' Festival's days, the Starfall's own (net/festivalLaw.js)

const SKIP = HAS_ARENA2 ? false : 'no ARENA2 (sh tools/fetch-data.sh, then ARENA2_PATH)';

test('STAR2 THE BAG: every coven takes a night in each round of twelve, none twice running, the rounds\' seams too (mutants: the seam unchecked; the round\'s roll fixed)', () => {
  assert.equal(STAR_COVENS.length, 12);
  const N = 500_000;
  let last = null;
  const orders = [];
  for (let r = 0; r < 40; r++) {
    const ids = [];
    for (let i = 0; i < 12; i++) {
      const c = starCovenOf((Math.floor(N / 12) + r) * 12 + i);
      assert.notEqual(c, last, `night ${(Math.floor(N / 12) + r) * 12 + i}: the coven of the night before`);
      last = c;
      ids.push(c.id);
    }
    assert.equal(new Set(ids).size, 12, `round ${r} misses a coven`);
    orders.push(ids.join());
  }
  assert.ok(new Set(orders).size > 30, 'each round shuffled anew');
});

test('STAR2 THE TABLE: twelve covens, each its own, none in the open zone; Glenmoril (Hircine\'s) and Wroth (the open zone\'s) apart (mutants: a coven in the open zone)', () => {
  assert.equal(new Set(STAR_COVENS.map((c) => c.id)).size, 12);
  assert.ok(STAR_COVENS.every((c) => c.region !== WILD_REGION));
  assert.deepEqual(STAR_COVENS_APART.map((c) => [c.id, c.region]), [['glenmoril', 60], ['wroth', WILD_REGION]]);
  assert.ok(STAR_COVENS.every((c) => typeof c.member() === 'string' && c.member().length > 3));
  assert.deepEqual(STAR_COVENS.map((c) => c.member()), ['Witch of the Marsh', 'Witch of Devilrock', 'Mountain Witch', 'Sister of Kykos', 'Sister of the Bluff', 'Tamarilyn Witch', 'Witch of Alcaire', 'Skeffington Witch', 'Beldam', 'Daggerfall Witch', 'Tide Witch', 'Dust Witch']);
});

test('STAR2 CANON: every coven stands in MAPS.BSA as a Coven in its region, its witches are FACTION.TXT\'s type 8 by that name, and its place is the quest table\'s - the fourteen are every coven the map holds', { skip: SKIP }, () => {
  const maps = loadMaps();
  const factions = new FactionFile();
  factions.load(new Uint8Array(readFileSync(join(ARENA2, 'FACTION.TXT'))));
  const places = readFileSync(join(ROOT, 'vendor/dfu-quests/Tables/Quests-Places.txt'), 'utf8');
  const all = [...STAR_COVENS, ...STAR_COVENS_APART];
  const onMap = [];
  for (let r = 0; r < maps.regionCount; r++) {
    const reg = maps.getRegion(r);
    if (!reg) continue;
    for (let l = 0; l < maps.baseLocationCount(r); l++) if (reg.mapTable[l]?.locationType === LOCATION_TYPES.Coven) onMap.push(`${r}:${reg.mapNames[l]}`);
  }
  assert.deepEqual(onMap.sort(), all.map((c) => `${c.region}:${covenLocation(c)}`).sort(), 'the fourteen are the map\'s own covens, each in its region');
  for (const c of all) {
    const f = factions.factionDict.get(c.factionId);
    assert.ok(f, `faction ${c.factionId}`);
    assert.equal(f.type, FACTION_TYPES.WitchesCoven, `${covenFactionName(c)} is a witches' coven`);
    assert.equal(f.name.trim(), covenFactionName(c));
    if (c.place) assert.match(places, new RegExp(`^${c.place},`, 'm'), `${c.place} is a quest place`);
  }
});

test('STAR2 THE NIGHT\'S STARS ON THE PLAYER\'S MAP: for a hundred nights, three stars in the coven\'s region, five pixels apart and from the gate\'s site, each named by its nearest town - a different town for each; the same on every run (mutants: the stars bunched; the gate\'s site ignored; one town for all)', { skip: SKIP }, () => {
  const maps = loadMaps();
  const woods = new WoodsFile();
  woods.load(new Uint8Array(readFileSync(join(ARENA2, 'WOODS.WLD'))));
  const scan = gateScanner(maps, { heightAt: (x, y) => woods.getHeightMapValue(x, y) }).step();
  const gateSiteOf = (day) => findGateSite(day, scan);
  const n0 = Math.ceil(FESTIVAL_FROM_MS / STAR_HOUR_MS);
  let distinct = 0, total = 0;
  for (let n = n0; n < n0 + 100; n++) {
    const sites = findStarSites(n, scan, { gateSiteOf });
    assert.equal(sites.length, STAR_PER_NIGHT, `night ${n} (${starCovenOf(n).id}) stands three stars`);
    for (const s of sites) {
      assert.equal(s.region, starCovenOf(n).region);
      assert.equal(maps.getRegionIndexAt(s.px, s.py), s.region, 'its pixel is its coven\'s region\'s');
      assert.ok(s.town && s.near === s.town.name && s.near.length > 0);
      const gate = gateSiteOf(gameDayAt(starTimes(n, s.k).fallAt));
      if (gate) assert.ok(Math.max(Math.abs(gate.px - s.px), Math.abs(gate.py - s.py)) >= STAR_APART_PX, 'never beside the gate of its game day');
    }
    for (let i = 0; i < sites.length; i++) for (let j = i + 1; j < sites.length; j++) {
      assert.ok(Math.max(Math.abs(sites[i].px - sites[j].px), Math.abs(sites[i].py - sites[j].py)) >= STAR_APART_PX);
    }
    total++;
    if (new Set(sites.map((s) => s.town.name)).size === sites.length) distinct++;
    assert.deepEqual(findStarSites(n, scan, { gateSiteOf }).map(starSiteKey), sites.map(starSiteKey), 'the same on every run');
  }
  assert.ok(distinct / total > 0.95, `three towns a night (${distinct} of ${total})`);
});

test('STAR2 THE WITCHES\' NIGHT: the festival is day 283 - the holiday table\'s Witches\' Festival and Mephala\'s summoning day both; the night whose dusk falls on it is the Witches\' Night, once a sky year, and its last star the Heart-Star (mutants: the day off by one; the Heart-Star the first)', () => {
  assert.equal(WITCHES_FESTIVAL_DAY, 283);
  assert.equal(holidayDayOfYear(HOLIDAYS.Witches_Festival), 283);
  assert.equal(DAEDRA.find((d) => d.name === 'Mephala').dayOfYear, WITCHES_FESTIVAL_DAY, 'Mephala\'s day is the Witches\' Festival');
  const nights = [];
  for (let n = Math.ceil(FESTIVAL_FROM_MS / STAR_HOUR_MS); n < Math.ceil(FESTIVAL_TO_MS / STAR_HOUR_MS); n++) if (witchesNight(n)) nights.push(n);
  assert.deepEqual(nights, [Date.UTC(2026, 9, 20, 12) / STAR_HOUR_MS, Date.UTC(2026, 10, 4, 12) / STAR_HOUR_MS], 'the window\'s two, a sky year (fifteen real days) apart: dusk 2026-10-20 and 2026-11-04, 11:45 UTC');
  const n = nights[1];
  assert.equal(nightDayOfYear(n), 283);
  assert.equal(nightDayOfYear(n + 1), 284);
  assert.equal(HEART_STAR, STAR_PER_NIGHT - 1);
  assert.ok(heartStar(n, 2) && !heartStar(n, 0) && !heartStar(n + 1, 2));
  assert.ok(existsSync(join(ROOT, 'src/net/skyLaw.js')));
});

test('STAR2 NEVER BESIDE THE GATE: a star whose first draw lands within five pixels of its game day\'s gate draws again, on a scan made to put the gate there (mutants: the gate\'s site ignored)', () => {
  const n = 500_123, coven = starCovenOf(n);
  // a region of 400 pixels in a 20 x 20 block, each its own town's
  const pixels = [], townAt = new Int32Array(1000 * 500).fill(-1), towns = [];
  for (let y = 100; y < 120; y++) for (let x = 300; x < 320; x++) { const id = y * 1000 + x; pixels.push(id); townAt[id] = towns.length; towns.push({ name: `T${towns.length}`, px: x, py: y, region: coven.region }); }
  const scan = { byRegion: new Map([[coven.region, Int32Array.from(pixels)]]), towns, townAt };
  const free = findStarSites(n, scan);
  const first = free[0];
  const sites = findStarSites(n, scan, { gateSiteOf: () => ({ px: first.px, py: first.py }) });
  assert.ok(sites.length >= 1);
  for (const s of sites) assert.ok(Math.max(Math.abs(s.px - first.px), Math.abs(s.py - first.py)) >= STAR_APART_PX, 'no star within five pixels of the gate');
});
