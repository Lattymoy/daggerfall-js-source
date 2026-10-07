// SD2b (2026-10-05, Mac: "Super dungeons are random finds on the world map, and spawn where population is at its most.
// Only one can be active at a time."): THE HOLLOW IN THE WORLD (scenes/sdHost.js) - the hub's record in, the Hollow it
// names found over this client's own map files and stood at its pixel while its phase stands, the find said at its door
// until the hub's word moves it, and the chat's lines for the moves everyone online hears. bible/11-Multiplayer/
// Super-Dungeons.md sections 2-4.
import { sdMarksLine } from '../src/systems/sdOmen.js';   // SD19 (PIN MOVED): its marks said with its find
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSdHost, SD_LINE_WAIT_MS } from '../src/scenes/sdHost.js';
import { sdCities, findSdSite, sdTemplates } from '../src/systems/sdSite.js';
import { scanGatePixels } from '../src/systems/gateSite.js';
import { LOCATION_TYPES, CLIMATES } from '../src/formats/mapsFile.js';
import { sdFirst, sdRise, sdFind, sdFell, sdGone, SD_FOUND_NEAR_M, SD_FOUND_RESEND_MS, SD_LIFETIME_MS, SD_COLLAPSE_MS, sdFoundLine } from '../src/net/sdLaw.js';
import { worldRoom } from '../src/net/wire.js';
import { isMainStoryDungeon } from '../src/world/dungeonTextures.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
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
const M = 60_000, T0 = 1_800_000_000_000;

/** A host over the small world, every seam a record the test reads. */
function harness({ scanReady = true } = {}) {
  const s = { clock: T0, scanReady, index: new Map(), stands: [], unstands: [], sent: [], lines: [], inside: false, feet: null, built: true, warmed: 0 };
  const host = createSdHost({
    now: () => s.clock,
    scan: () => (s.scanReady ? SCAN : null),
    warmScan: () => { s.warmed++; },
    cities: (r) => sdCities([CITY], r, { regionNameOf: () => 'Nowhere' }),
    templates: () => sdTemplates([LAB], isMainStoryDungeon),
    where: () => ({ regionIndex: 0, regionName: 'Alik\'r Desert' }),
    stand: (key, loc) => { s.index.set(key, loc); s.stands.push(key); },
    unstand: (key) => { s.index.delete(key); s.unstands.push(key); },
    inside: () => s.inside,
    door: (key) => { if (!s.built) return null; const [px, py] = key.split(',').map(Number); return [px * 100, 0, py * 100]; },   // the test's own frame: a pixel's door at (100 px, 100 py)
    feet: () => s.feet,
    sendFound: (w, cell) => { s.sent.push([w, cell]); return true; },
    say: (text) => s.lines.push(text),
    regionName: () => 'Alik\'r Desert',
  });
  return { s, host };
}
const atDoor = (key, off = 0) => { const [px, py] = key.split(',').map(Number); return [px * 100 + off, 0, py * 100]; };

test('SD2b the Hollow stands: the hub\'s first word stands it at the site its region names - the template cloned under the slot\'s own id, named, Super - in silence; its phase gone, it is taken down; never from under a player standing in it (mutants: the welcome\'s record announced; stood while gone; the ground pulled from under a player)', () => {
  const { s, host } = harness();
  host.frame();
  assert.equal(s.stands.length, 0, 'no word, no Hollow');
  const risen = sdRise(sdFirst(T0 - 20 * M), T0 - 10 * M, 0);
  host.heard({ k: 'ev', ...risen });
  host.frame();
  const site = findSdSite(risen, SCAN, sdCities([CITY], 0, { regionNameOf: () => 'Nowhere' }));
  const key = `${site.px},${site.py}`;
  assert.deepEqual(s.stands, [key], 'stood at the site');
  const loc = s.index.get(key);
  assert.equal(loc.superTier, true);
  assert.equal(loc.sdSlot, risen.s);
  assert.equal(loc.spawned, true, 'a spawned dungeon\'s machinery');
  assert.match(loc.name, /^The |Copperham/, 'named from the slot');
  assert.deepEqual(s.lines, [], 'the welcome\'s record is no news');
  assert.equal(host.hollow().key, key);
  assert.equal(host.isHollow(loc), true);
  assert.equal(host.isHollow(LAB), false);
  host.frame();
  assert.equal(s.stands.length, 1, 'stood once');
  // its time runs out - the player inside: it stays; out: it goes
  s.clock = risen.until;
  s.inside = true;
  host.heard({ k: 'ev', ...sdGone(risen, s.clock) });
  host.frame();
  assert.deepEqual(s.unstands, [], 'never from under a player');
  s.inside = false;
  host.frame();
  assert.deepEqual(s.unstands, [key]);
  assert.equal(host.hollow(), null);
  // a welcome that already says found - or fell - is no news either
  const { s: s2, host: h2 } = harness();
  h2.heard({ k: 'ev', ...sdFind(risen, T0, 'Mara') });
  h2.frame();
  assert.deepEqual(s2.lines, [], 'found while I was away: said to nobody');
  assert.equal(s2.stands.length, 1, 'and stood');
});

test('SD2b the find: at its door (SD_FOUND_NEAR_M), while the record says risen, to the cell its pixel is in - again every SD_FOUND_RESEND_MS, and never once the hub\'s word says found; never from afar, never while its pixel stands no door (mutants: from afar; never again; again at once; after the find; another slot\'s)', () => {
  const { s, host } = harness();
  const risen = sdRise(sdFirst(T0 - 20 * M), T0 - 10 * M, 0);
  host.heard({ k: 'ev', ...risen });
  host.frame();
  const key = host.hollow().key;
  const [px, py] = key.split(',').map(Number);
  s.feet = atDoor(key, SD_FOUND_NEAR_M + 1);
  host.frame();
  assert.equal(s.sent.length, 0, 'from afar');
  s.feet = atDoor(key, SD_FOUND_NEAR_M - 1);
  s.built = false;
  host.frame();
  assert.equal(s.sent.length, 0, 'no door built: nothing to stand at');
  s.built = true;
  host.frame();
  assert.deepEqual(s.sent, [[{ s: risen.s, px, py }, worldRoom(px, py)]], 'to the cell its pixel is in');
  s.clock += SD_FOUND_RESEND_MS - 1;
  host.frame();
  assert.equal(s.sent.length, 1, 'not again at once');
  s.clock += 1;
  host.frame();
  assert.equal(s.sent.length, 2, 'again while the hub has not moved it');
  const found = sdFind(risen, s.clock, 'Mara');
  host.heard({ k: 'ev', ...found });
  s.clock += SD_FOUND_RESEND_MS;
  host.frame();
  assert.equal(s.sent.length, 2, 'found: no more');
  assert.deepEqual(s.lines, [sdFoundLine({ who: 'Mara', near: 'Copperham' }), sdMarksLine({ name: host.hollow()?.loc?.name, s: found.s })], 'the find said, near its city - SD19 (PIN MOVED): and its marks');
});

test('SD2b the lines: the find, the kill and the fading said once each, to everyone - a rise to nobody; a line whose place the scan has not found yet waits for it, and past SD_LINE_WAIT_MS is said with the region\'s name (mutants: a line said twice; the fading said after a kill; a line lost while the scan warms)', () => {
  const { s, host } = harness({ scanReady: false });
  const first = sdRise(sdFirst(T0 - 20 * M), T0 - 10 * M, 0);
  host.heard({ k: 'ev', ...first });
  host.frame();
  assert.ok(s.warmed > 0, 'the scan warmed');
  assert.equal(s.stands.length, 0, 'nothing stands before the scan');
  const found = sdFind(first, T0, 'Mara');
  host.heard({ k: 'ev', ...found });
  host.heard({ k: 'ev', ...found });
  host.frame();
  assert.deepEqual(s.lines, [], 'owed until its city is known');
  s.scanReady = true;
  host.frame();
  assert.deepEqual(s.lines.slice(0, 1), ['Mara has found an Abyss Dungeon near Copperham!'], 'once, near its city');
  assert.match(s.lines[1], /keeps the Ending of /, 'SD19 (PIN MOVED): and its marks');
  s.lines.length = 1;
  const fell = sdFell(found, T0 + M, { top: 'Ann', n: 3 });
  host.heard({ k: 'ev', ...fell });
  host.frame();
  assert.equal(s.lines.length, 2);
  assert.match(s.lines[1], /^Ann and 2 others broke the Hour in .+\. It collapses\.$/);
  s.clock = fell.fellAt + SD_COLLAPSE_MS;
  host.heard({ k: 'ev', ...sdGone(fell, s.clock) });
  host.frame();
  assert.equal(s.lines.length, 2, 'the collapse after a kill says nothing more');
  // a second Hollow fades unbeaten - its line said with the region's name when the world never placed it
  // (AUDIT SD II, L6 - PIN MOVED: a FOUND one; the rise is said to nobody, so a fade never found says nothing)
  const { s: s2, host: h2 } = harness({ scanReady: false });
  const r2 = sdFind(sdRise(sdFirst(T0 - 20 * M), T0 - 10 * M, 0), T0 - 9 * M, 'Mara');
  h2.heard({ k: 'ev', ...r2 });
  s2.clock = r2.until;
  h2.heard({ k: 'ev', ...sdGone(r2, s2.clock) });
  h2.frame();
  assert.deepEqual(s2.lines, [], 'waiting on the scan');
  s2.clock += SD_LINE_WAIT_MS;
  h2.frame();
  assert.deepEqual(s2.lines, ['The Hour closes over an Abyss Dungeon, unbroken.'], 'past the wait: said, never lost');
  const { s: s3, host: h3 } = harness({ scanReady: true });
  const r3 = sdRise(sdFirst(T0 - 20 * M), T0 - 10 * M, 0);
  h3.heard({ k: 'ev', ...r3 });
  s3.clock = r3.until;
  h3.heard({ k: 'ev', ...sdGone(r3, s3.clock) });
  s3.clock += SD_LINE_WAIT_MS;
  h3.frame();
  assert.deepEqual(s3.lines, [], 'a Hollow never found fades unsaid');
});

test('SD2b one Hollow at a time: an older slot\'s word is no word; the next slot\'s Hollow stands once the last is down - and not while the player still stands in the last (mutants: an older word kept; two at once)', () => {
  const { s, host } = harness();
  const r1 = sdRise(sdFirst(T0 - 20 * M), T0 - 10 * M, 0);
  host.heard({ k: 'ev', ...r1 });
  host.frame();
  const k1 = host.hollow().key;
  s.clock = r1.next;
  const r2 = sdRise(sdGone(r1, r1.until), s.clock, 0);
  s.inside = true;
  s.feet = atDoor(k1);   // standing at the last one's door (its mouth, from inside)
  host.heard({ k: 'ev', ...r2 });
  host.heard({ k: 'ev', ...r1 });
  assert.equal(host.record().s, r2.s, 'an older slot\'s word is no word');
  host.frame();
  assert.deepEqual(s.unstands, [], 'the player still in the last');
  assert.equal(s.index.size, 1, 'one at a time');
  assert.equal(s.sent.length, 0, 'no find for the last one\'s door: the record speaks of the next');
  s.inside = false;
  host.frame();
  assert.deepEqual(s.unstands, [k1]);
  assert.equal(host.hollow().s, r2.s);
  assert.equal(s.index.size, 1);
  assert.equal(host.hollow().loc.sdSlot, r2.s, 'the next slot\'s own Hollow');
});

test('SD2b the world host by source: the hub\'s link hears the record; the host made online alone, framed every frame; the Hollow stood into the index and its pixel built again between builds; the spawn ledger never notes or clears it; the find through the session (mutants: each seam removed)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /if \(tab\.room === SOCIAL_ROOM\) link\.onSd = \(w\) => sdHost\?\.heard\(w\);/);
  assert.match(w, /const sdHost = params\.has\('online'\) \? createSdHost\(\{/);
  assert.match(w, /try \{ sdHost\?\.frame\(\); \} catch \(e\) \{ console\.warn\('\[sd\] host', e\?\.message \?\? e\); \}/);
  assert.match(w, /if \(!building\) sweepGateClear\(\);[^\n]*\n\s*if \(_sdLate\.size && !building\) sweepSdLate\(\);/, 'between builds, after the gate\'s clearing');
  assert.match(w, /function _spawnSeen\(key\) \{\n\s*if \(locationIndex\.get\(key\)\?\.superTier\) return;/, 'a first sight never notes a Hollow - the dungeon\'s door and the roll\'s alike');
  assert.match(w, /if \(!locationIndex\.get\(key\)\?\.spawned\) return;\n\s*if \(locationIndex\.get\(key\)\.superTier\) return;/, 'nor a clear');
  assert.match(w, /sendFound: \(word, cell\) => !!online\?\.sendSdFound\?\.\(word, cell\),/);
});
