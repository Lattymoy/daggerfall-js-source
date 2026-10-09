// SD10 (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 11's collapse): THE COLLAPSE -
// the three minutes the Hour stands after the Brass Remnant falls. A WAY HOME rises where it fell (scenes/sdEnd.js - the
// Return's pale light stood alone, later, under the Hour's own words), walked into or pressed, out of the Hour before the
// Hollow's door; and THE READOUTS tell whoever stands in the Hollow or its Hour how long is left (scenes/sdHost.js) - at
// the fall, then at a minute, thirty seconds and ten, each once. Its end (SD2d's cast-out) is unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSdHost, sdCollapseDue, sdCollapseLine, SD_COLLAPSE_WARN_MS } from '../src/scenes/sdHost.js';
import { createSdEnd, SD_HOME_TEXT, SD_RETURN_KEY, SD_RIFT_KEY } from '../src/scenes/sdEnd.js';
import { SD_END_TEXT, SD_RETURN_SIZE } from '../src/world/sdDungeon.js';
import { sdCities, sdTemplates } from '../src/systems/sdSite.js';
import { scanGatePixels } from '../src/systems/gateSite.js';
import { LOCATION_TYPES, CLIMATES } from '../src/formats/mapsFile.js';
import { isMainStoryDungeon } from '../src/world/dungeonTextures.js';
import { sdFirst, sdRise, sdFind, sdFell, sdGone, SD_COLLAPSE_MS } from '../src/net/sdLaw.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
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
  const s = { clock: T0, index: new Map(), inside: false, hour: false, warned: [], castOut: [] };
  const host = createSdHost({
    now: () => s.clock, scan: () => SCAN, cities, templates: () => sdTemplates([LAB], isMainStoryDungeon),
    where: () => ({ regionIndex: 0, regionName: 'Alik\'r Desert' }),
    stand: (key, loc) => s.index.set(key, loc), unstand: (key) => s.index.delete(key),
    inside: () => s.inside, door: () => null, feet: () => null, sendFound: () => true, say: () => {},
    castOut: (key) => s.castOut.push(key), warn: (t) => s.warned.push(t), inHour: () => s.hour,
  });
  return { s, host };
}
/** A Hollow risen, found and fallen at T0 + H (its collapse from then), heard by the host. */
function fallen(h) {
  const r = sdRise(sdFirst(T0 - 3 * H), T0 - 10 * M, 0);
  h.host.heard({ k: 'ev', ...r });
  h.host.frame();
  const f = sdFind(r, T0, 'Mara');
  h.host.heard({ k: 'ev', ...f });
  h.host.frame();
  const k = sdFell(f, T0 + H, { top: 'Mara', n: 3 });
  h.host.heard({ k: 'ev', ...k });
  return k;
}

// ── the readouts ─────────────────────────────────────────────────────

test('SD10 THE READOUTS\' LAW: the readout owed is the least mark at or above what is left - the whole collapse\'s at the fall, then a minute, thirty seconds and ten - when it is under the last said; nothing once it is out; their words name the Hour\'s way home at the first and the Hollow\'s own in the Hollow (mutants: a mark said twice; a passed mark; the way home unsaid)', () => {
  assert.deepEqual([...SD_COLLAPSE_WARN_MS], [60_000, 30_000, 10_000]);
  assert.equal(sdCollapseDue(SD_COLLAPSE_MS), SD_COLLAPSE_MS, 'at the fall');
  assert.equal(sdCollapseDue(SD_COLLAPSE_MS - 1000, SD_COLLAPSE_MS), null, 'said: not again');
  assert.equal(sdCollapseDue(60_000, SD_COLLAPSE_MS), 60_000);
  assert.equal(sdCollapseDue(60_001, SD_COLLAPSE_MS), null, 'not before its mark');
  assert.equal(sdCollapseDue(45_000), 60_000, 'first inside at 0:45: the minute\'s mark, said with what is left');
  assert.equal(sdCollapseDue(45_000, 60_000), null);
  assert.equal(sdCollapseDue(30_000, 60_000), 30_000);
  assert.equal(sdCollapseDue(9_000, 30_000), 10_000, 'a frame late: the mark reached, once');
  assert.equal(sdCollapseDue(9_000, 10_000), null);
  assert.equal(sdCollapseDue(0, Infinity), null, 'out: nothing');
  assert.equal(sdCollapseDue(-5, Infinity), null);
  assert.equal(sdCollapseLine(SD_COLLAPSE_MS, { hour: true, first: true }), 'The Hour collapses in 3:00. The way home opens where the Remnant fell.');   // AUDIT SD II (L6 F2, F21, PIN MOVED): WB13b's words; the way home opens there
  assert.equal(sdCollapseLine(30_000, { hour: true }), 'The Hour collapses in 0:30.');
  assert.equal(sdCollapseLine(150_400, { first: true }), 'The Hour is broken. The Abyss Dungeon collapses in 2:31.');   // AUDIT SD II (PIN MOVED); AUDIT SD III (T15, PIN MOVED): the player's word for it, Abyss Dungeon
  assert.equal(sdCollapseLine(9_100), 'The Abyss Dungeon collapses in 0:10.', 'rounded up - never 0:00 while time is left');
});

test('SD10 THE READOUTS IN THE HOLLOW: whoever stands in the Hollow while it collapses is told at the fall and at each mark, once each, in the Hollow\'s words - in the Hour, the Hour\'s; a player outside is told nothing; the collapse\'s end casts them out as before (mutants: never told; told outside; the Hour\'s words in the Hollow)', () => {
  const h = harness();
  const k = fallen(h);
  h.s.clock = T0 + H + 100;
  h.host.frame();
  assert.deepEqual(h.s.warned, [], 'outside: nothing');
  h.s.inside = true;
  h.host.frame(); h.host.frame();
  assert.deepEqual(h.s.warned, ['The Hour is broken. The Abyss Dungeon collapses in 3:00.'], 'at the fall, once');   // AUDIT SD II (PIN MOVED); AUDIT SD III (T15, PIN MOVED): the player's word for it, Abyss Dungeon
  h.s.clock = T0 + H + SD_COLLAPSE_MS - 60_000;
  h.host.frame(); h.host.frame();
  h.s.hour = true;   // through the Rift, into the Hour
  h.s.clock = T0 + H + SD_COLLAPSE_MS - 30_000;
  h.host.frame();
  h.s.clock = T0 + H + SD_COLLAPSE_MS - 10_000;
  h.host.frame(); h.host.frame();
  assert.deepEqual(h.s.warned, [
    'The Hour is broken. The Abyss Dungeon collapses in 3:00.', 'The Abyss Dungeon collapses in 1:00.', 'The Hour collapses in 0:30.', 'The Hour collapses in 0:10.',
  ]);
  h.s.clock = T0 + H + SD_COLLAPSE_MS;
  h.host.heard({ k: 'ev', ...sdGone(k, h.s.clock) });
  h.host.frame();
  assert.equal(h.s.castOut.length, 1, 'its end casts them out (SD2d)');
  assert.equal(h.s.warned.length, 4, 'and says no more of the collapse');
  // first inside the Hour late: the mark it is under, with what is left, the way home named
  const g = harness();
  fallen(g);
  g.s.inside = true; g.s.hour = true;
  g.s.clock = T0 + H + SD_COLLAPSE_MS - 45_000;
  g.host.frame();
  assert.deepEqual(g.s.warned, ['The Hour collapses in 0:45. The way home opens where the Remnant fell.']);   // AUDIT SD II (PIN MOVED)
});

// ── the way home ─────────────────────────────────────────────────────

test('SD10 THE WAY HOME: the Return\'s pale light stood alone, later, where it is told - in the ray at a door\'s reach, named the Hour\'s way home on the plaque, handed to the host by a press or a step into it; out when told, and stood again; a stand-up with no Return stays as it was (mutants: the Return\'s words in the Hour; carried off where it rises; never stood again)', () => {
  let homes = 0, rifts = 0;
  const e = createSdEnd({ onRift: () => { rifts++; }, onReturn: () => { homes++; }, riftTo: 'To the Hollow', retTitle: SD_HOME_TEXT.title, retTo: SD_HOME_TEXT.to });
  e.stand({ rift: { at: [0, 0, -4], size: 4 }, retAt: null });
  assert.equal(e.ret, null, 'the Hour stands no Return');
  assert.deepEqual(e.targets().map((t) => t.key), [SD_RIFT_KEY]);
  assert.equal(e.standReturn([10, 0, 20]), true);
  assert.equal(e.standReturn([0, 0, 0]), false, 'once while it stands');
  assert.deepEqual(e.ret, { at: [10, 0, 20], foot: 0 });   // SD-LOOK (PIN MOVED): and its foot - risen at once, with no age
  const t = e.targets().find((x) => x.key === SD_RETURN_KEY);
  assert.deepEqual(t.aabb, { min: [10 - SD_RETURN_SIZE.w / 2, 0, 20 - SD_RETURN_SIZE.w / 2], max: [10 + SD_RETURN_SIZE.w / 2, SD_RETURN_SIZE.h, 20 + SD_RETURN_SIZE.w / 2] });
  assert.deepEqual(e.hoverName(SD_RETURN_KEY), { title: 'The Way Home', subs: ['To the Abyss Dungeon\'s door'] });   // AUDIT SD III (T15, PIN MOVED): the player's word for it, Abyss Dungeon
  assert.equal(e.press(SD_RETURN_KEY), true);
  assert.equal(homes, 1, 'pressed: the host\'s way home');
  // AUDIT SD II (SD11f, L6 F9, PIN MOVED): never walked into - it stands where the spoils land; pressed alone
  let clock = 1000;
  const w = createSdEnd({ now: () => clock, onReturn: () => { homes++; }, retTitle: SD_HOME_TEXT.title, retTo: SD_HOME_TEXT.to });
  w.stand({ rift: { at: [0, 0, -4], size: 4 }, retAt: null });
  w.standReturn([10, 0, 20]);
  w.frame([10, 0, 21]); clock += 16;
  assert.equal(w.frame([10, 0, 20.3]), null, 'stepped into: nothing');
  assert.equal(homes, 1);
  assert.equal(w.press(SD_RETURN_KEY), true);
  assert.equal(homes, 2, 'pressed');
  w.returnOut();
  assert.equal(w.ret, null);
  assert.equal(w.standReturn([3, 0, 3]), true, 'stood again where it is next told');
  assert.equal(rifts, 0);
  // a player standing where it rises is not carried off: the step is INTO it (the Portal Stones' latch)
  let clock2 = 1000, carried = 0;
  const z = createSdEnd({ now: () => clock2, onReturn: () => { carried++; } });
  z.stand({ rift: { at: [0, 0, -4], size: 4 }, retAt: null });
  z.frame([10, 0, 20]); clock2 += 16;
  z.frame([10, 0, 20]); clock2 += 16;
  z.standReturn([10, 0, 20]);
  z.frame([10, 0, 20]); clock2 += 16;
  z.frame([10, 0, 20.1]); clock2 += 16;
  assert.equal(carried, 0, 'standing where it rose: not carried off');
  z.frame([10, 0, 21]); clock2 += 16;
  z.frame([10, 0, 20.3]);
  assert.equal(carried, 0, 'stepped out, and back in: still nothing');   // AUDIT SD II (SD11f, L6 F9, PIN MOVED): pressed alone
  // a Hollow's own Return keeps its words
  const d = createSdEnd({});
  d.stand({ rift: { at: [0, 0, 0], size: 4 }, retAt: [2, 0, 0] });
  assert.deepEqual(d.hoverName(SD_RETURN_KEY), { title: SD_END_TEXT.ret, subs: [SD_END_TEXT.retTo] });
  assert.deepEqual(SD_HOME_TEXT, { title: 'The Way Home', to: 'To the Abyss Dungeon\'s door', taken: 'The way home carries you out of the Hour, to the Abyss Dungeon\'s door.', rises: 'The way home stands open.' });   // AUDIT SD I; AUDIT SD III (T15, PIN MOVED): the player's word for it, Abyss DungeonI (SD11f, L6 F16, PIN MOVED): and said as it rises
});

// ── the hosts ────────────────────────────────────────────────────────

test('SD10 THE HOSTS: the dungeon host stands the Hour\'s way home where the outer host says and takes it down when it says none (never the Hollow\'s Return check in the Hour); the mode machine hands both doors through; the world host says where - the Remnant\'s fall, its body sunk, one place a fall (AUDIT SD), clear of the pillars - and carries a player out of the Hour before the Hollow\'s door under the veil; the Hollow host is handed the readouts\' voice and the Hour\'s question (mutants: the way home unstood; never taken down; stood before the body sank; out with no veil; the readouts unvoiced)', () => {
  const D = strip(read('src/scenes/dungeonContext.js'));
  assert.match(D, /: _sdRealm \? createSdEnd\(\{ renderer, audio, riftTo: SD_REALM_TEXT\.wayBack, onRift: \(\) => opts\.sdWayBack\?\.\(\), onReturn: \(\) => opts\.sdWayHome\?\.\(\), retTitle: SD_HOME_TEXT\.title, retTo: SD_HOME_TEXT\.to, clock: sdEndClock \}\) : null;/);   // SD-LOOK (PIN MOVED): on the realm's clock
  assert.match(D, /if \(_sdRealm\) \{ const home = opts\.sdHomeAt\?\.\(\) \?\? null; if \(home && !sdEnd\.hasRet\) sdEnd\.standReturn\(home, opts\.sdHomeAge\?\.\(\) \?\? Infinity, \{ dynamicDraws \}\); else if \(!home && sdEnd\.hasRet\) sdEnd\.returnOut\(\); \}[^\n]*\n\s*else if \(sdEnd\.hasRet && t >= _sdEndCheckAt\)/);   // AUDIT SD II (SD11f, L6 F16, PIN MOVED): stood with how long ago it rose   // PIN MOVED (AUDIT SD V P1): the end asked `hasRet`, its look off the host's look door
  const M2 = strip(read('src/scenes/worldModes.js'));
  assert.match(M2, /sdWayHome: \(\) => host\.sdWayHome\?\.\(\),/);
  assert.match(M2, /sdHomeAt: \(\) => host\.sdHomeAt\?\.\(\) \?\? null,/);
  const W = strip(read('src/scenes/world.js'));
  assert.match(W, /const sdHomeAt = \(\) => \{\n\s*const s = sdFightLink\?\.state\(\);\n\s*if \(!s\?\.fell \|\| sdFightLink\.now\(\) < s\.fell\.at \+ SD_REM_SINK_MS\) return null;\n[^\n]*\n\s*if \(_sdHome\?\.fell !== s\.fell\.at\) \{\n\s*const \[x, z\] = clearOfPillars\(s\.rem\.x, s\.rem\.z\);\n\s*_sdHome = \{ fell: s\.fell\.at, at: sdRealmToDungeon\(SD_ARENA\.x \+ x, 0, SD_ARENA\.z \+ z\) \};\n[^\n]*\n\s*\}\n\s*return _sdHome\.at;\n\s*\};/);   // AUDIT SD: one place a fall, clear of the pillars (PIN MOVED); AUDIT SD II (SD11f, L6 F16, PIN MOVED): said as it rises
  assert.match(W, /function sdWayHome\(\) \{\n\s*if \(!isSdRealm\(modes\?\.dungeonLocation\) \|\| !\(playerEntity\.health > 0\) \|\| modes\?\.deathUp\?\.\(\)\) return false;\n\s*gateVeil\?\.flash\('hourHome'\);[^\n]*\n\s*if \(!modes\?\.unstuck\?\.\(\)\) return false;\n\s*sdSay\(SD_HOME_TEXT\.taken\);/);   // AUDIT SD II (SD11d, PIN MOVED): the Hour's brass veil, its voice
  assert.match(W, /sdWayHome: \(\) => sdWayHome\(\),/);
  assert.match(W, /sdHomeAt: \(\) => sdHomeAt\(\),/);
  assert.match(W, /warn: \(text\) => sdSay\(text, SD_VOICE_RANK\.readout\),/);   // AUDIT SD II (SD11d, PIN MOVED): the readouts through the Hour's voice, after its turns
  assert.match(W, /inHour: \(\) => modes\?\.sdRealmSlot\?\.\(\) != null,/);
});
