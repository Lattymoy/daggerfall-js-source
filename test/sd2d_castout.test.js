// SD2d (2026-10-06, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 11's collapse and the
// Hollow's end): A HOLLOW'S END CASTS OUT WHOEVER IS INSIDE IT, AND A SAVE TAKEN INSIDE ONE WAKES OUTSIDE. The ground
// is never pulled from under a player (SD2b) - and they do not stay in a Hollow that has ended: its end casts them out
// before its door once, by the dungeon's own way out, with the closing line, and the next frame finds them outside and
// takes it down. The host frames in every mode now, so the end reaches them underground. A save inside a Hollow is
// ONLINE-UNDERGROUND-LOAD1's: an online page never puts a character back inside a dungeon, and a Hollow's save names
// its own pixel, so the wake is by the city it stood by.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSdHost } from '../src/scenes/sdHost.js';
import { sdCities, sdTemplates, findSdSite, pickSdTemplate, sdHollowLocation } from '../src/systems/sdSite.js';
import { scanGatePixels } from '../src/systems/gateSite.js';
import { LOCATION_TYPES, CLIMATES, longitudeLatitudeToMapPixel } from '../src/formats/mapsFile.js';
import { isMainStoryDungeon } from '../src/world/dungeonTextures.js';
import { sdFirst, sdRise, sdFind, sdFell, sdGone, SD_COLLAPSE_MS, SD_CAST_OUT_LINE } from '../src/net/sdLaw.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const M = 60_000, H = 3_600_000, T0 = 1_800_000_000_000;
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
const cities = (r) => sdCities([CITY], r, { regionNameOf: () => 'Nowhere' });

function harness() {
  const s = { clock: T0, index: new Map(), unstands: [], inside: false, castOut: [] };
  const host = createSdHost({
    now: () => s.clock, scan: () => SCAN, cities, templates: () => sdTemplates([LAB], isMainStoryDungeon),
    where: () => ({ regionIndex: 0, regionName: 'Alik\'r Desert' }),
    stand: (key, loc) => s.index.set(key, loc), unstand: (key) => { s.index.delete(key); s.unstands.push(key); },
    inside: () => s.inside, door: () => null, feet: () => null, sendFound: () => true, say: () => {},
    castOut: (key) => s.castOut.push(key),
  });
  return { s, host };
}

test('SD2d a Hollow\'s end casts out whoever stands inside it - once, before its door - and the next frame finds them outside and takes it down; never while it stands, never a player outside it (mutants: never cast out; cast out every frame; cast out while it stands; the ground pulled)', () => {
  const { s, host } = harness();
  const r = sdRise(sdFirst(T0 - 3 * H), T0 - 10 * M, 0);
  host.heard({ k: 'ev', ...r });
  host.frame();
  const key = host.hollow().key;
  s.inside = true;
  const f = sdFind(r, T0, 'Mara');
  host.heard({ k: 'ev', ...f });
  host.frame();
  const k = sdFell(f, T0 + H, { top: 'Mara', n: 3 });
  host.heard({ k: 'ev', ...k });
  s.clock = T0 + H + SD_COLLAPSE_MS - 1;
  host.frame();
  assert.deepEqual(s.castOut, [], 'collapsing still: the spoils are still to be taken');
  // its end, with the player inside
  s.clock = T0 + H + SD_COLLAPSE_MS;
  host.heard({ k: 'ev', ...sdGone(k, s.clock) });
  host.frame();
  assert.deepEqual(s.castOut, [key], 'cast out before its door');
  assert.deepEqual(s.unstands, [], 'the ground is not pulled from under them');
  host.frame();
  host.frame();
  assert.deepEqual(s.castOut, [key], 'once');
  s.inside = false;   // the dungeon's own way out, drained at its safe point
  host.frame();
  assert.deepEqual(s.unstands, [key], 'outside: taken down');
  assert.equal(host.hollow(), null);
  host.frame();
  assert.deepEqual(s.castOut, [key], 'and nobody is cast out of nothing');
});

test('SD2d a Hollow that fades unbeaten casts out too, and the next slot\'s rise casts a player out of the last one they never left; a player outside is never told (mutants: the next slot\'s rise keeps them in)', () => {
  const { s, host } = harness();
  const r = sdRise(sdFirst(T0 - 3 * H), T0 - 10 * M, 0);
  host.heard({ k: 'ev', ...r });
  host.frame();
  const key = host.hollow().key;
  // outside when it fades: taken down, nobody cast out
  s.clock = r.until;
  host.frame();
  assert.deepEqual(s.unstands, [key]);
  assert.deepEqual(s.castOut, [], 'a player outside is never told');
  // the next one rises: the player walks in; its record's word is missed and the one after it comes while they are in
  const n = sdRise(sdGone(r, r.until), r.next, 0);
  s.clock = n.at + 10 * M;
  host.heard({ k: 'ev', ...n });
  host.frame();
  const key2 = host.hollow().key;
  s.inside = true;
  const n2 = sdRise(sdGone(n, n.until), n.next, 0);
  s.clock = n2.at + M;
  host.heard({ k: 'ev', ...n2 });
  host.frame();
  assert.deepEqual(s.castOut, [key2], 'cast out of the last one');
  s.inside = false;
  host.frame();
  assert.ok(s.unstands.includes(key2), 'the last one taken down once they are out');
  assert.equal(host.hollow()?.s, n2.s, 'and the next one stood');
});

test('SD2d the world host: the cast-out is the dungeon\'s own way out (the mode machine\'s exit, drained at its safe point: PositionPlayerToDungeonExit\'s landing) with the closing line, the dead left to their death\'s door; the host frames above the modal return, in every mode; the find is the street\'s (mutants: the line unsaid; the dead cast out; the host framed outdoors alone)', () => {
  const w = read('src/scenes/world.js');
  // AUDIT SD II (L1 F2, F9, PIN MOVED): it answers whether it acted (the host asks again until it does), and out of the
  // Hour under its veil - (SD11d, PIN MOVED) the Hour's own brass, the line through the Hour's voice
  assert.match(w, /castOut: \(\) => \{\n {6}if \(!\(playerEntity\.health > 0\) \|\| modes\?\.deathUp\?\.\(\)\) return false;\n {6}const hour = modes\?\.sdRealmSlot\?\.\(\) != null;\n {6}if \(!modes\?\.unstuck\?\.\(\)\) return false;\n {6}if \(hour\) gateVeil\?\.flash\('hourCast'\);[^\n]*\n {6}sdSay\(SD_CAST_OUT_LINE\);\n {6}return true;\n {4}\},/);
  assert.equal(SD_CAST_OUT_LINE, 'The Hour closes, and the Abyss Dungeon folds in on itself behind you.');   // AUDIT SD III (T15, PIN MOVED): the player's word for it, Abyss Dungeon
  const online = w.indexOf('  const onlineFrame = (now, dt) => {');
  const frameAt = w.indexOf('    sdFrame();   // SD2b');
  const serpent = w.indexOf('    serpentFrame();   // SERPENT1');
  assert.ok(online > 0 && serpent > online && frameAt > serpent, 'in the online frame, beside the gate\'s and the serpent\'s');
  assert.equal(w.split('try { sdHost?.frame(); }').length - 1, 1, 'framed by sdFrame alone');
  assert.equal(w.split('sdFrame();').length - 1, 1, 'once a frame, nowhere else');
  const modal = w.indexOf('    if (modes.frame(dt, now)) {');
  const call = w.indexOf('onlineFrame(now, dt);');
  assert.ok(call > 0 && call < modal, 'the online frame runs above the modal return');
  assert.match(w, /feet: \(\) => \(walkMode && playerSpawned && _mode\(\) === 'exterior' \? player\.feetAt\(\) : null\),/, 'the find is the street\'s');
  // the mode machine's exit: the dungeon's own way out, the landing at its door
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /unstuck: \(\) => \{\n {6}if \(mode === 'dungeon' && dungeonCtx\) \{ pendingDungeonExit = true; return true; \}/);
  assert.match(wm, /if \(pendingDungeonExit\) \{ pendingDungeonExit = false; if \(aliveUnder\(\)\) \{ exitDungeonNow\(\); return true; \} \}/);
});

test('SD2d a save taken inside a Hollow: its clone names its own pixel - the save\'s dungeon home - so an online load wakes the character by the city it stood by (ONLINE-UNDERGROUND-LOAD1: an online page never puts a character back inside a dungeon), and an offline one lands at its door (mutants: the clone at the template\'s pixel)', () => {
  const r = sdRise(sdFirst(T0 - 3 * H), T0, 0);
  const site = findSdSite(r, SCAN, cities(0));
  const loc = sdHollowLocation(r, site, pickSdTemplate(r.s, sdTemplates([LAB], isMainStoryDungeon)), { regionIndex: 0, regionName: 'Alik\'r Desert' });
  const p = longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude);
  assert.deepEqual({ x: p.x, y: p.y }, { x: site.px, y: site.py }, 'the dungeon home a save inside it writes (dungeonContext.js dungeonHome)');
  assert.notDeepEqual({ x: p.x, y: p.y }, { x: 450, y: 400 }, 'not the template\'s');
  const w = read('src/scenes/world.js');
  assert.match(w, /else if \(onlineOn && !\(pixel\.x === getInt\('Startup', 'StartCellX'\) && pixel\.y === getInt\('Startup', 'StartCellY'\)\)\) \{/, 'online: every dungeon save but the tutorial\'s wakes outside');
  assert.match(w, /const wake = undergroundWakeSpot\(maps\.getRegion\(maps\.getRegionIndexAt\(from\.x, from\.y\)\)\?\.mapTable \?\? \[\], from\);/, 'by the nearest temple, town or graveyard to its pixel');
  assert.match(w, /else \{ _wodInside = false; townTalk\.say\('\(the dungeon has no entrance here - character restored at its door\)'\); \}/, 'offline, no Hollow stands: at its door');
  assert.match(read('src/scenes/dungeonContext.js'), /const p = longitudeLatitudeToMapPixel\(mt\.longitude, mt\.latitude\);\n {4}return \{ pixel: \{ x: p\.x, y: p\.y \}, mapId: mt\.mapId \?\? null \};/);
  const rec = read('bible/11-Multiplayer/Super-Dungeons.md');
  assert.match(rec, /### SD2d - shipped 2026-10-06/);
  const sd2d = rec.slice(rec.indexOf('### SD2d - shipped'));
  for (const host of ['scenes/world.js', 'scenes/worldModes.js', 'scenes/dungeonContext.js', 'scenes/exterior.js']) assert.ok(sd2d.includes(host), `the record names ${host}`);
});
