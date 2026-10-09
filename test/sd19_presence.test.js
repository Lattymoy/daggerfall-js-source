// SD19 (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 4 and section 16's SD19;
// Mac: "The detail needs to exceed that of the oblivion gates"): THE HOLLOW'S PRESENCE - the gate's sky burns over its
// region, its banner counts down at its fire and the chat speaks of it; a Hollow had its column alone. Now the land's haze
// and light lean to brass near a standing one (strongest at dusk, as the taverns always said), a banner and its marks on
// the gate's own card stand at its door, its marks are said with its find, a found one's last hour is said to the realm,
// and the Timers count the next one's rise once it is gone.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SD_AIR, sdAirNear, sdAirDusk, sdAirWeight, SD_BRASS_RAMP, sdBrassGrade, SD_BRASS_TINT, sdBrassLight,
  SD_BANNER_M, sdBannerText, sdMarksLine, SD_HOUR_LEFT_MS, sdHourLine,
} from '../src/systems/sdOmen.js';
import { sdMarksCardModel, sdMarksViewOf, SD_MARKS_ARRIVE_MS } from '../src/ui/sdMarksView.js';
import { sdMarksOf, sdEndingOf, sdOmensOf } from '../src/net/sdMarks.js';
import { createSdHost } from '../src/scenes/sdHost.js';
import { sdCities, findSdSite, sdTemplates } from '../src/systems/sdSite.js';
import { scanGatePixels } from '../src/systems/gateSite.js';
import { LOCATION_TYPES, CLIMATES } from '../src/formats/mapsFile.js';
import { sdFirst, sdRise, sdFind, sdFell, sdGone, sdNameIn, SD_COLLAPSE_MS } from '../src/net/sdLaw.js';
import { eventTimerRows, timerText } from '../src/systems/eventTimers.js';
import { isMainStoryDungeon } from '../src/world/dungeonTextures.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const near = (a, b, e = 1e-6) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= e);
const M = 60_000, T0 = 1_800_000_000_000;

test('SD19 THE BRASS AIR\'S LAW: whole within SD_AIR.fullM of the Hollow and gone by SD_AIR.edgeM, smoothly; SD_AIR.base of it all day and whole at dusk, wrapping the day; its weight the column\'s light by both, never past SD_AIR.max', () => {
  assert.deepEqual([sdAirNear(0), sdAirNear(SD_AIR.fullM), sdAirNear(SD_AIR.edgeM), sdAirNear(SD_AIR.edgeM * 2)], [1, 1, 0, 0]);
  assert.equal(sdAirNear(NaN), 0, 'nowhere: none');
  const mid = sdAirNear((SD_AIR.fullM + SD_AIR.edgeM) / 2);
  assert.ok(Math.abs(mid - 0.5) < 1e-9, 'half way: half');
  for (let d = SD_AIR.fullM; d < SD_AIR.edgeM; d += 250) assert.ok(sdAirNear(d + 250) <= sdAirNear(d), 'it thins outward');
  assert.equal(sdAirDusk(SD_AIR.duskAt), 1, 'whole at dusk');
  assert.equal(sdAirDusk(720), SD_AIR.base, 'noon: the base');
  assert.equal(sdAirDusk(SD_AIR.duskAt + SD_AIR.duskHalf), SD_AIR.base);
  assert.equal(sdAirDusk(SD_AIR.duskAt - SD_AIR.duskHalf), SD_AIR.base);
  assert.ok(sdAirDusk(SD_AIR.duskAt - SD_AIR.duskHalf / 2) > SD_AIR.base && sdAirDusk(SD_AIR.duskAt - SD_AIR.duskHalf / 2) < 1, 'it gathers toward dusk');
  assert.equal(sdAirDusk(SD_AIR.duskAt + 1440), 1, 'the day wraps');
  assert.equal(sdAirDusk(SD_AIR.duskAt - 1440), 1);
  assert.equal(sdAirWeight(1, 0, SD_AIR.duskAt), SD_AIR.max, 'its most: a column whole, at its foot, at dusk');
  assert.equal(sdAirWeight(1, 0, 720), SD_AIR.max * SD_AIR.base);
  assert.equal(sdAirWeight(0, 0, SD_AIR.duskAt), 0, 'no column, no brass');
  assert.equal(sdAirWeight(0.5, 0, SD_AIR.duskAt), SD_AIR.max * 0.5, 'by the column\'s light');
  assert.equal(sdAirWeight(1, SD_AIR.edgeM, SD_AIR.duskAt), 0, 'gone by the edge');
  assert.equal(sdAirWeight(3, 0, SD_AIR.duskAt), SD_AIR.max, 'never past its most');
});

test('SD19 THE BRASS GRADE: the haze toward the brass its own brightness falls on (the ramp), by the weight, the haze never written; the light each channel toward SD_BRASS_TINT - warm up, blue down', () => {
  const haze = [0.5, 0.6, 0.7];
  const g0 = sdBrassGrade(haze, 0);
  assert.deepEqual(g0, haze);
  assert.notEqual(g0, haze, 'a new array');
  assert.deepEqual(haze, [0.5, 0.6, 0.7], 'never written');
  assert.ok(near(sdBrassGrade([0, 0, 0], 1), SD_BRASS_RAMP[0].color), 'black: the ramp\'s dark');
  assert.ok(near(sdBrassGrade([1, 1, 1], 1), SD_BRASS_RAMP[2].color), 'white: the ramp\'s bright');
  const l = 0.45;   // the ramp's middle stop, as a grey
  assert.ok(near(sdBrassGrade([l, l, l], 1), SD_BRASS_RAMP[1].color), 'its middle');
  const half = sdBrassGrade(haze, 0.5), whole = sdBrassGrade(haze, 1);
  assert.ok(near(half, haze.map((v, i) => (v + whole[i]) / 2)), 'by the weight');
  assert.ok(whole[0] > whole[2], 'brass: red over blue');
  assert.deepEqual(sdBrassGrade(haze, 4), whole, 'never past whole');
  const light = [0.8, 0.8, 0.8];
  assert.ok(sdBrassLight(light, 0) instanceof Float32Array);
  assert.ok(near([...sdBrassLight(light, 0)], light));
  assert.ok(near([...sdBrassLight(light, 1)], light.map((v, i) => v * SD_BRASS_TINT[i])));
  assert.ok(near([...sdBrassLight(light, 0.5)], light.map((v, i) => v * (1 + (SD_BRASS_TINT[i] - 1) * 0.5))));
  const lit = sdBrassLight(light, 1);
  assert.ok(lit[0] > light[0] && lit[2] < light[2], 'warm up, blue down');
});

test('SD19 THE SKY AND THE LIGHT, by source: the sky controller grades the land\'s haze last, after the sun baby\'s and the dread, by a clamped weight; the world reads the air only outside by its column\'s light and the eye, hands it to the sky before the fog is read, and leans both lights by it', () => {
  const sh = read('src/scenes/shared.js');
  assert.match(sh, /setBrass\(w\) \{[^\n]*\n\s*brassW = Math\.max\(0, Math\.min\(1, Number\(w\) \|\| 0\)\);\n\s*for \(const r of \[sky, enhancedSky, dynamicSky, clouds\]\) if \(r\) r\.brass = brassW;/);   // AUDIT SD III (V8, PIN MOVED): and the sky graded as its haze
  assert.match(sh, /const d = dreadW > 0 \? dreadGrade\(c, dreadW\) : c;[^\n]*\n\s*return brassW > 0 \? sdBrassGrade\(d, brassW\) : d;/, 'last: over the dread and the sun baby');
  const w = read('src/scenes/world.js');
  assert.match(w, /const sdAirNow = \(eye, minuteNow\) => \{\n\s*const o = sdHost\?\.omen\(\);\n\s*if \(!o\?\.hollow\?\.site \|\| \(modes\?\.mode \?\? 'exterior'\) !== 'exterior' \|\| !eye\) return 0;/);
  assert.match(w, /return sdAirWeight\(o\.light, Math\.hypot\(eye\[0\] - x, eye\[2\] - z\), minuteNow\);/);
  assert.match(w, /const sdAirW = sdHost \? sdAirNow\(tvStand, minute\) : 0;[^\n]*\n\s*sky\.setBrass\?\.\(sdAirW\);/);
  assert.ok(w.indexOf('sky.setBrass?.(sdAirW);') < w.indexOf('const fogColor = sky.fogColorFor(fogNow);'), 'before the haze is read');
  assert.match(w, /sdBrassLight\(sunbabyLight\(dreadLight\(withMoonAmbient\(/, 'the ambient');
  assert.match(w, /sdBrassLight\(sunbabyKey\(dreadLight\(SUN_RIG_COLOR, skyDreadW\), sunbabyW, sunbabyFace\.evil\), sdAirW\)\);/, 'the key');
  assert.match(w, /sunbabyFace\.evil\), sdAirW\), sunScale\(minute\)/, 'the ambient\'s weight the same');
});

test('SD19 THE BANNER AT ITS DOOR: its name, what it is and its state - fading, collapsing; within SD_BANNER_M of its centre while it stands, outside, its marks on the gate\'s own card (none once it fell); the gate\'s wish first, cleared indoors', () => {
  assert.equal(SD_BANNER_M, 60);
  const risen = sdRise(sdFirst(T0 - 20 * M), T0 - 10 * M, 0);
  const found = sdFind(risen, T0, 'Mara');
  // AUDIT SD III (T1, PIN MOVED): its name and its state - what it is is the card's beside it (a long name ran the banner
  // off both sides of a phone)
  assert.equal(sdBannerText('The Stopped Bell', found, T0), `The Stopped Bell - fades in ${timerText(found.until - T0)}`);
  assert.equal(sdBannerText('', found, T0), `An Abyss Dungeon - fades in ${timerText(found.until - T0)}`, 'nameless: said once');
  const fell = sdFell(found, T0 + M, { top: 'Mara', n: 2 });
  assert.equal(sdBannerText('The Stopped Bell', fell, T0 + 2 * M), 'The Stopped Bell - collapsing');
  assert.equal(sdBannerText('The Stopped Bell', sdGone(found, found.until), found.until), 'The Stopped Bell');
  const w = read('src/scenes/world.js');
  assert.match(w, /if \(!h\?\.site \|\| !rec \|\| rec\.s !== h\.s \|\| !walkMode \|\| !playerSpawned \|\| \(modes\?\.mode \?\? 'exterior'\) !== 'exterior'\) return null;/);
  assert.match(w, /if \(!\['risen', 'found', 'fell'\]\.includes\(sdHost\.phase\(\)\)\) return null;/);
  assert.match(w, /if \(Math\.hypot\(f\[0\] - x, f\[2\] - z\) > SD_BANNER_M\) return null;/);
  assert.match(w, /return \{ text: sdBannerText\(h\.loc\?\.name, rec, t\), card: sdHost\.phase\(\) === 'fell' \? null : sdMarksCardModel\(sdMarksOf\(h\.s\), \{ mode: 'gate' \}\) \};/);
  assert.match(w, /drawGateBanner\(_gateBannerWish \?\? sb\?\.text \?\? null, \{ hidden, look: _gateBannerWish == null && sb \? 'brass' : 'gate' \}\);/, 'the gate\'s first');   // AUDIT SD III (T3, PIN MOVED): a Hollow's door in the Hour's brass
  assert.match(w, /if \(gatePool \|\| sdHost\) presenceFrame\(\);/);
  assert.match(w, /if \(\(gatePool \|\| sdHost\) && \(modes\?\.mode \?\? 'exterior'\) !== 'exterior'\) drawGateBanner\(null\);/, 'cleared indoors');
  // the card at the door: no clock, whole, its marks
  const mk = sdMarksOf(found.s);
  const card = sdMarksCardModel(mk, { mode: 'gate' });
  assert.equal(card.mode, 'gate');
  assert.equal(card.alpha, 1);
  assert.equal(card.key, sdMarksViewOf(mk).key);
  assert.deepEqual(sdMarksCardModel(mk, { mode: 'gate', since: 0, now: SD_MARKS_ARRIVE_MS * 10 }), card, 'it stands while the player does');
  assert.equal(sdMarksCardModel(mk, { since: 0, now: SD_MARKS_ARRIVE_MS * 10 }), null, 'the arrive card still fades');
  assert.equal(sdMarksCardModel(['nowhere'], { mode: 'gate' }), null);
});

// the host over a small world (test/sd2b_world.test.js's)
const T = LOCATION_TYPES;
const place = (region, index, px, py, type, { name = `P${region}.${index}`, w = 1, h = 1, buildings = 0, blocks = 0 } = {}) => ({
  name, regionIndex: region, locationIndex: index, hasDungeon: blocks > 0,
  mapTableData: { mapId: py * 1000 + px, locationType: type, longitude: 0, latitude: 0 },
  exterior: { exteriorData: { width: w, height: h, locationId: py * 1000 + px }, buildingCount: buildings },
  ...(blocks ? { dungeon: { blocks: Array.from({ length: blocks }, (_, i) => ({ blockName: `${i % 3 ? 'N' : 'B'}0000${i}.RDB`, x: i, z: 0, isStartingBlock: !i })), recordElement: { header: { locationId: py * 1000 + px } } } } : {}),
});
function world(places) {
  const regions = [0, 1].map(() => ({ mapTable: [], mapNames: [] }));
  for (const p of places) { regions[p.regionIndex].mapTable[p.locationIndex] = { mapId: p.mapTableData.mapId, locationType: p.mapTableData.locationType }; regions[p.regionIndex].mapNames[p.locationIndex] = p.name; }
  return {
    regionCount: 2, getRegion: (r) => regions[r],
    getClimateIndex: (x) => (x < 100 ? CLIMATES.Ocean : 231),
    getPoliticIndex: (x) => (x < 100 ? 0 : 128 + (x < 500 ? 0 : 1)),
    getRegionIndexAt: (x) => (x < 500 ? 0 : 1),
  };
}
const CITY = place(0, 0, 300, 200, T.TownCity, { name: 'Copperham', w: 3, h: 3, buildings: 80 });
const LAB = place(0, 1, 450, 400, T.DungeonLabyrinth, { name: 'The Old Maze', blocks: 14 });
const SCAN = scanGatePixels(world([CITY, LAB]), { heightAt: () => 90 });
function harness({ scanReady = true } = {}) {
  const s = { clock: T0, scanReady, lines: [] };
  const host = createSdHost({
    now: () => s.clock,
    scan: () => (s.scanReady ? SCAN : null),
    warmScan() {},
    cities: (r) => sdCities([CITY], r, { regionNameOf: () => 'Nowhere' }),
    templates: () => sdTemplates([LAB], isMainStoryDungeon),
    where: () => ({ regionIndex: 0, regionName: 'Alik\'r Desert' }),
    stand() {}, unstand() {}, inside: () => false, door: () => null, feet: () => null,
    sendFound: () => true,
    say: (text) => s.lines.push(text),
    regionName: () => 'Alik\'r Desert',
  });
  return { s, host };
}

test('SD19 THE WORDS: its marks said with its find - its Ending, its signature and both omens; a found Hollow\'s last hour said to the realm once, near its city - never while it is only risen, never before the hour, never twice; with no Hollow the world offers, the region\'s name', () => {
  const risen = sdRise(sdFirst(T0 - 20 * M), T0 - 10 * M, 0);
  const E = sdEndingOf(sdMarksOf(risen.s)), O = sdOmensOf(sdMarksOf(risen.s));
  // AUDIT SD III (T11, PIN MOVED): each mark's article small inside the line - it read "under The Quickened Gears and The
  // Hardened Hearts"
  // PIN MOVED (AUDIT SD IV T9): its signature the Ending's own, between commas - it hung between dashes (WB13b's aside)
  assert.equal(sdMarksLine({ name: 'The Stopped Bell', s: risen.s }), `The Stopped Bell keeps the Ending of ${E.stone}, its ${E.sig.replace(/^The /, '')}, under ${sdNameIn(O[0].name)} and ${sdNameIn(O[1].name)}.`);
  assert.doesNotMatch(sdMarksLine({ name: 'The Stopped Bell', s: risen.s }).slice(1), /\bThe /, 'no capital article inside it');
  assert.match(sdMarksLine({ s: risen.s }), /^The Abyss Dungeon keeps the Ending of /);
  assert.equal(sdHourLine({ name: 'The Stopped Bell', near: 'Copperham' }), 'The Stopped Bell near Copperham will fade within the hour.');
  assert.equal(sdHourLine({}), 'The Abyss Dungeon near the Iliac Bay will fade within the hour.');
  assert.equal(sdHourLine({ region: 'Alik\'r Desert' }), 'The Abyss Dungeon in the Alik\'r Desert region will fade within the hour.', 'AUDIT SD III (T19): a region said as a region');
  assert.equal(SD_HOUR_LEFT_MS, 60 * M);
  // the host
  const { s, host } = harness();
  host.heard({ k: 'ev', ...risen });
  host.frame();
  s.clock = risen.until - 30 * M;
  host.frame();
  assert.deepEqual(s.lines, [], 'only risen: a find, not news');
  const found = sdFind(risen, T0, 'Mara');
  s.clock = T0;
  host.heard({ k: 'ev', ...found });
  host.frame();
  const name = host.hollow().loc.name;
  assert.equal(s.lines.length, 2);
  assert.equal(s.lines[1], sdMarksLine({ name, s: found.s }), 'its marks with its find');
  s.clock = found.until - SD_HOUR_LEFT_MS - 1000;
  host.frame();
  assert.equal(s.lines.length, 2, 'not before the hour');
  s.clock = found.until - SD_HOUR_LEFT_MS + 1000;
  host.frame();
  assert.deepEqual(s.lines.slice(2), [sdHourLine({ name, near: 'Copperham' })], 'its last hour');
  s.clock += 10 * M;
  host.frame();
  assert.equal(s.lines.length, 3, 'once');
  // a welcome that says found with half an hour left: said (news to the one who just came)
  const { s: s2, host: h2 } = harness();
  s2.clock = found.until - 30 * M;
  h2.heard({ k: 'ev', ...found });
  h2.frame();
  assert.deepEqual(s2.lines, [sdHourLine({ name, near: 'Copperham' })]);
  // a scan never ready: past nothing, nothing said - the place unknown and not yet none
  const { s: s3, host: h3 } = harness({ scanReady: false });
  s3.clock = found.until - 30 * M;
  h3.heard({ k: 'ev', ...found });
  h3.frame();
  assert.deepEqual(s3.lines, [], 'its place not yet known');
  const H = read('src/scenes/sdHost.js');
  assert.match(H, /if \(hh \|\| \(memo && memo\.s === rec\.s && memo\.none\)\) \{ hourSaidS = rec\.s; say\(sdHourLine\(\{ name: hh\?\.loc\?\.name, near: hh\?\.site\?\.cityName \|\| '', region: regionName\(rec\.r\) \|\| '' \}\)\); \}/, 'with no Hollow: the region\'s');   // AUDIT SD III (T19, PIN MOVED): said as a region
});

test('SD19 THE NEXT ONE\'S RISE: once a Hollow is gone - beaten, collapsed or faded - the Timers count the next slot\'s not-before, never where; none once it may rise', () => {
  const rows = (rec, now) => eventTimerRows({ now, sd: { rec, name: 'The Stopped Bell', place: 'Copperham' } }).filter((r) => r.id.startsWith('sd:'));
  const risen = sdRise(sdFirst(T0 - 20 * M), T0 - 10 * M, 0);
  const faded = sdGone(risen, risen.until);
  assert.ok(Number.isFinite(faded.next) && faded.next > risen.until);
  assert.deepEqual(rows(faded, risen.until + M).map((r) => [r.id, r.title, r.where, r.live, r.at]), [[`sd:${risen.s + 1}`, 'An Abyss Dungeon rises', null, false, faded.next]], 'faded unfound: the next one still counted');
  const found = sdFind(risen, T0, 'Mara'), fell = sdFell(found, T0 + M, { top: 'Mara', n: 2 }), gone = sdGone(fell, fell.fellAt + SD_COLLAPSE_MS);
  assert.deepEqual(rows(gone, fell.fellAt + SD_COLLAPSE_MS).map((r) => r.id), [`sd:${risen.s + 1}`]);
  assert.deepEqual(rows(gone, gone.next), [], 'none once it may');
  assert.deepEqual(rows(risen, T0), [], 'risen: a find, never a row');
});
