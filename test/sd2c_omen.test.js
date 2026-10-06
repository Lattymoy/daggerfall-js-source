// SD2c (2026-10-06, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 4): THE HOLLOW SEEN AND
// HEARD OF (systems/sdOmen.js, render/sdOmenPass.js, scenes/sdHost.js) - before it is found, a column of brass-gold light
// over its pixel seen from SD_OMEN_PX round and a word in the taverns of its city; once found, its ring on the held map,
// its mark on the compass inside SD_COMPASS_M, its row in the Timers window and its note under the red seal, until it
// is gone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sdOmenLight, sdOmenSeen, sdMapMark, sdNoticeCard, sdRumor, sdRumorLine, sdStateWords, SD_OMEN_PX, SD_OMEN_KINDLE_MS, SD_OMEN_FADE_MS, SD_RING_R, SD_COMPASS_M, SD_RUMOR_CHANCE } from '../src/systems/sdOmen.js';
import { SdOmenPassRenderer, SD_OMEN_COLOR } from '../src/render/sdOmenPass.js';
import { BEACON_VS, BEACON_FS, BEACON_RADIUS_M, BEACON_COLOR, beaconVertices } from '../src/render/gatePass.js';
import { sdFirst, sdRise, sdFind, sdFell, sdGone, SD_COLLAPSE_MS } from '../src/net/sdLaw.js';
import { readGateMark, gateMarkKey } from '../src/ui/gateMapMark.js';
import { eventTimerRows } from '../src/systems/eventTimers.js';
import { TIMER_KINDS } from '../src/ui/enhancedTimers.js';
import { noticeCards } from '../src/ui/noticeWindow.js';
import { SD_RING_MAP_CSS, SD_MAP_INK, SD_LEGEND_TEXT } from '../src/ui/sdMapMark.js';
import { MAX_ANSWERS_TELL_ME_ABOUT_OR_RUMORS } from '../src/systems/rumorMill.js';
import { createSdHost } from '../src/scenes/sdHost.js';
import { sdCities, sdTemplates, findSdSite, pixelOfLoc } from '../src/systems/sdSite.js';
import { scanGatePixels } from '../src/systems/gateSite.js';
import { LOCATION_TYPES, CLIMATES } from '../src/formats/mapsFile.js';
import { isMainStoryDungeon } from '../src/world/dungeonTextures.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const M = 60_000, H = 3_600_000, T0 = 1_800_000_000_000;
const CITY_ROW = { name: 'Copperham', regionIndex: 0, locationIndex: 0, mapTableData: { mapId: 200 * 1000 + 300 } };
const SITE = { s: 1, px: 303, py: 202, city: CITY_ROW, cityName: 'Copperham', cityRegion: 0, region: 0 };
const HOLLOW = { s: 1, site: SITE, loc: { name: 'The Stopped Bell', superTier: true, sdSlot: 1 }, key: '303,202' };
const rise = (at = T0) => sdRise(sdFirst(at - 3 * H), at, 0);

test('SD2c the omen\'s light: kindled from the rise over SD_OMEN_KINDLE_MS, whole while the Hollow stands, out over SD_OMEN_FADE_MS before it is gone - its time\'s end unbeaten, its collapse\'s after the kill; none gone, none without a record (mutants: lit at once; never out; out at the kill; the collapse forgotten)', () => {
  const r = rise();
  assert.equal(sdOmenLight(r, T0), 0, 'dark at the rise\'s instant');
  assert.equal(sdOmenLight(r, T0 + SD_OMEN_KINDLE_MS / 2), 0.5, 'kindling');
  assert.equal(sdOmenLight(r, T0 + SD_OMEN_KINDLE_MS), 1);
  assert.equal(sdOmenLight(r, T0 + 30 * H), 1, 'whole while it stands');
  assert.equal(sdOmenLight(r, r.until - SD_OMEN_FADE_MS / 2), 0.5, 'going out before it fades');
  assert.equal(sdOmenLight(r, r.until), 0, 'faded: out');
  const f = sdFind(r, T0 + H, 'Mara');
  assert.equal(sdOmenLight(f, T0 + 2 * H), 1, 'found: still a column');
  const k = sdFell(f, T0 + 3 * H, { top: 'Mara', n: 2 });
  assert.equal(sdOmenLight(k, T0 + 3 * H), 1, 'the kill: the column stands through the collapse');
  assert.equal(sdOmenLight(k, k.fellAt + SD_COLLAPSE_MS - SD_OMEN_FADE_MS / 2), 0.5, 'going out with the collapse');
  assert.equal(sdOmenLight(k, k.fellAt + SD_COLLAPSE_MS), 0, 'collapsed: out');
  assert.equal(sdOmenLight(sdGone(k, k.fellAt + SD_COLLAPSE_MS), k.fellAt + SD_COLLAPSE_MS), 0);
  assert.equal(sdOmenLight(null, T0), 0);
  assert.equal(sdOmenLight(sdFirst(T0), T0 + H), 0, 'slot 0 is no Hollow');
});

test('SD2c seen from SD_OMEN_PX map pixels round, either way, and no farther (mutants: a Euclid ring; one axis read)', () => {
  assert.equal(SD_OMEN_PX, 12, 'section 4\'s twelve');
  for (const [x, y, seen] of [[303, 202, true], [315, 214, true], [291, 190, true], [316, 202, false], [303, 215, false], [290, 202, false], [303, 189, false], [314, 213, true]]) {
    assert.equal(sdOmenSeen(SITE, x, y), seen, `${x},${y}`);
  }
  assert.equal(sdOmenSeen(null, 303, 202), false);
});

test('SD2c the ring: none while it has only risen (a find), its own pixel\'s once found - its name, its state, its card - collapsing after the kill, none gone; another slot\'s Hollow rings nothing; the held map\'s reader takes it (mutants: rung while risen; rung gone; the slot unchecked; the centre off the pixel)', () => {
  const r = rise();
  assert.equal(sdMapMark(r, HOLLOW, T0 + M), null, 'risen: a find, not news');
  const f = sdFind(r, T0 + H, 'Mara');
  const m = sdMapMark(f, HOLLOW, T0 + H + 1000);
  assert.deepEqual({ ...m, tip: null }, { day: 1, cx: 303.5, cy: 202.5, r: SD_RING_R, label: 'The Stopped Bell - fades in 1d 22h', phase: 'found', tip: null });
  assert.deepEqual(m.tip, { title: 'The Stopped Bell, a Super Dungeon', lines: ['Near Copperham', 'Found by Mara', 'Fades in 1d 22h'] });
  assert.equal(sdStateWords(f, T0 + H + 1000), 'fades in 1d 22h');
  const k = sdFell(f, T0 + 3 * H, { top: 'Mara', n: 2 });
  assert.equal(sdMapMark(k, HOLLOW, T0 + 3 * H + 1000).label, 'The Stopped Bell - collapsing');
  assert.equal(sdMapMark(k, HOLLOW, k.fellAt + SD_COLLAPSE_MS), null, 'collapsed: gone');
  assert.equal(sdMapMark(f, { ...HOLLOW, s: 2 }, T0 + H + 1000), null, 'another slot\'s Hollow');
  assert.equal(sdMapMark(f, { s: 1, key: HOLLOW.key, loc: HOLLOW.loc }, T0 + H + 1000), null, 'a Hollow whose site is not known');
  const read = readGateMark(() => m, { width: 1000, height: 500 });
  assert.equal(read.cx, 303.5);
  assert.equal(read.label, m.label);
  assert.deepEqual(read.tip.lines, m.tip.lines);
  assert.notEqual(gateMarkKey(read), gateMarkKey(readGateMark(() => sdMapMark(f, HOLLOW, T0 + 3 * H), { width: 1000, height: 500 })), 'its words tick: a new key, a repaint');
  assert.equal(SD_RING_MAP_CSS, SD_MAP_INK.ring);
  assert.equal(SD_LEGEND_TEXT, 'Super Dungeon');
});

test('SD2c the note under the red seal: the ring\'s own words - its name, its city, its state; none without a ring; the board hangs it after the gate\'s (mutants: the state dropped; hung without a ring)', () => {
  const f = sdFind(rise(), T0 + H, 'Mara');
  const card = sdNoticeCard(sdMapMark(f, HOLLOW, T0 + H + 1000), 'Copperham');
  assert.deepEqual(card, { subject: 'Super Dungeon', body: 'The Stopped Bell, near Copperham. Fades in 1d 22h.' });
  assert.equal(sdNoticeCard(null, 'Copperham'), null);
  const cards = noticeCards({ town: { name: 'Copperham' }, gate: { subject: 'Dagon\'s Breach', body: 'Near Copperham.' }, sd: card });
  assert.deepEqual(cards.map((c) => [c.key, c.seal]), [['gate', 'server'], ['sd', 'server']]);
  assert.deepEqual(noticeCards({ town: { name: 'Copperham' } }), [], 'none: nothing hung');
});

test('SD2c the Timers row: none while it has only risen, its fading once found, its collapse after the kill, none gone - the super kind, beside the serpent\'s (mutants: a row while risen; the collapse\'s end at the kill)', () => {
  const r = rise();
  const rows = (rec, now, more = {}) => eventTimerRows({ now, sd: { rec, name: 'The Stopped Bell', place: 'Copperham', ...more } }).filter((x) => x.kind === 'super');
  assert.deepEqual(rows(r, T0 + M), [], 'risen: a find');
  const f = sdFind(r, T0 + H, 'Mara');
  assert.deepEqual(rows(f, T0 + 2 * H), [{ id: 'sd:1', kind: 'super', title: 'The Stopped Bell stands', where: 'Near Copperham', detail: 'Found - it fades unbroken when this runs out', live: true, at: f.until, until: f.until }]);
  const k = sdFell(f, T0 + 3 * H, { top: 'Mara', n: 2 });
  const [c] = rows(k, T0 + 3 * H + M);
  assert.equal(c.title, 'The Stopped Bell collapses');
  assert.equal(c.until, k.fellAt + SD_COLLAPSE_MS);
  assert.deepEqual(rows(k, k.fellAt + SD_COLLAPSE_MS), [], 'gone');
  assert.deepEqual(rows(f, T0 + 2 * H, { name: null, place: null }).map((x) => [x.title, x.where]), [['The Super Dungeon stands', null]], 'its name and city not known yet');
  assert.deepEqual(eventTimerRows({ now: T0 }).filter((x) => x.kind === 'super'), [], 'offline: no record');
  assert.deepEqual(TIMER_KINDS.slice(0, 3), ['gate', 'serpent', 'super']);
  assert.match(read('src/ui/enhancedStyle.js'), /\.px-timerswin \.tm-super \{ --tm-kind: \$\{SD_RING_MAP_CSS\}; \}/, 'its row in the ring\'s brass');
});

test('SD2c the taverns: "Any news?" in the city it stands by, while it has risen or been found, one time in SD_RUMOR_CHANCE - the person\'s one answer spent, the spymaster past the gate; nowhere else, not after the kill (mutants: told anywhere; told after the kill; the answer unspent; the cap unread; the chance unrolled)', () => {
  const r = rise();
  const city = pixelOfLoc(CITY_ROW);
  assert.deepEqual(city, { px: 300, py: 200 });
  const here = { px: 300, py: 200 };
  const ses = () => ({ numAnswersGivenTellMeAboutOrRumors: 0 });
  const s1 = ses();
  assert.equal(sdRumor(r, HOLLOW, T0 + M, here, s1, { rolls: () => 0 }), sdRumorLine('Copperham'));
  assert.equal(s1.numAnswersGivenTellMeAboutOrRumors, 1, 'the person\'s answer spent');
  assert.equal(sdRumorLine('Copperham'), 'They say the air goes brass-coloured past the walls of Copperham at dusk, and a bell rings where there is no bell.');
  assert.equal(sdRumor(r, HOLLOW, T0 + M, here, ses(), { rolls: () => SD_RUMOR_CHANCE }), null, 'the chance not met');
  assert.equal(sdRumor(r, HOLLOW, T0 + M, { px: 301, py: 200 }, ses(), { rolls: () => 0 }), null, 'not in its city');
  assert.equal(sdRumor(r, HOLLOW, T0 + M, { px: 300, py: 201 }, ses(), { rolls: () => 0 }), null);
  const f = sdFind(r, T0 + H, 'Mara');
  assert.equal(sdRumor(f, HOLLOW, T0 + 2 * H, here, ses(), { rolls: () => 0 }), sdRumorLine('Copperham'), 'found: still the talk of the town');
  const k = sdFell(f, T0 + 3 * H, { top: 'Mara', n: 2 });
  assert.equal(sdRumor(k, HOLLOW, T0 + 3 * H + M, here, ses(), { rolls: () => 0 }), null, 'broken: no more omens');
  const spent = { numAnswersGivenTellMeAboutOrRumors: MAX_ANSWERS_TELL_ME_ABOUT_OR_RUMORS };
  assert.equal(sdRumor(r, HOLLOW, T0 + M, here, spent, { rolls: () => 0 }), null, 'no news left in them');
  assert.equal(spent.numAnswersGivenTellMeAboutOrRumors, MAX_ANSWERS_TELL_ME_ABOUT_OR_RUMORS, 'and none spent');
  assert.equal(sdRumor(r, HOLLOW, T0 + M, here, { ...spent, isSpyMaster: true }, { rolls: () => 0 }), sdRumorLine('Copperham'), 'the spymaster has more');
  assert.equal(sdRumor(r, { ...HOLLOW, s: 2 }, T0 + M, here, ses(), { rolls: () => 0 }), null, 'another slot\'s Hollow');
  assert.equal(sdRumor(r, HOLLOW, T0 + M, null, ses(), { rolls: () => 0 }), null);
});

// The host, end to end, over sd2b's small world.
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

test('SD2c the host: its ring, its column and its word read the record it heard and the Hollow it stood - nothing before the hub\'s word, the column from the rise, the ring from the find, nothing once it is taken down (mutants: the ring off the stood Hollow; the column without a record)', () => {
  const s = { clock: T0, index: new Map(), inside: false };
  const host = createSdHost({
    now: () => s.clock, scan: () => SCAN,
    cities: (r) => sdCities([CITY], r, { regionNameOf: () => 'Nowhere' }),
    templates: () => sdTemplates([LAB], isMainStoryDungeon),
    where: () => ({ regionIndex: 0, regionName: 'Alik\'r Desert' }),
    stand: (key, loc) => s.index.set(key, loc), unstand: (key) => s.index.delete(key),
    inside: () => s.inside, door: () => null, feet: () => null, sendFound: () => true, say: () => {},
  });
  host.frame();
  assert.equal(host.omen(), null, 'no word, no column');
  assert.equal(host.mapMark(), null);
  const r = rise(T0 - 10 * M);
  host.heard({ k: 'ev', ...r });
  host.frame();
  const site = findSdSite(r, SCAN, sdCities([CITY], 0, { regionNameOf: () => 'Nowhere' }));
  const o = host.omen();
  assert.equal(o.hollow.key, `${site.px},${site.py}`, 'its column over the Hollow it stood');
  assert.equal(o.light, 1, 'ten minutes risen: whole');
  assert.equal(host.mapMark(), null, 'risen: a find');
  const ses = { numAnswersGivenTellMeAboutOrRumors: 0 };
  assert.equal(host.rumor({ px: 300, py: 200 }, ses, { rolls: () => 0 }), sdRumorLine('Copperham'), 'its city\'s taverns');
  const f = sdFind(r, T0, 'Mara');
  host.heard({ k: 'ev', ...f });
  host.frame();
  assert.equal(host.mapMark().cx, site.px + 0.5, 'found: rung at its pixel');
  // its time runs out with a player inside: it stays standing under them (SD2b), and the next slot's rise lights
  // nothing over it - the column and the ring are the stood Hollow's own slot's alone
  s.clock = r.until;
  s.inside = true;
  host.heard({ k: 'ev', ...sdGone(f, s.clock) });
  host.frame();
  assert.equal(host.hollow().key, `${site.px},${site.py}`, 'still standing under the player');
  assert.equal(host.omen(), null, 'gone: out');
  const next = sdRise(sdGone(f, s.clock), f.next, 0);
  s.clock = next.at + 10 * M;
  host.heard({ k: 'ev', ...next });
  host.frame();
  assert.equal(host.omen(), null, 'the next slot\'s light is not this Hollow\'s');
  assert.equal(host.mapMark(), null);
  s.inside = false;
  host.frame();
  assert.equal(host.omen()?.hollow?.s, next.s, 'out of the old: the next one stands, and its column with it');
});

function fakeGl() {
  const calls = [];
  const gl = new Proxy({ VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, ONE_MINUS_SRC_ALPHA: 12 }, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  return { gl, calls };
}
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

test('SD2c the pass: the gate\'s beacon in brass - its own program over the gate\'s own shaders and column, its colour never the gate\'s red, one column a Hollow, added, the dark skipped, the state put back (mutants: the gate\'s colour; a dark column drawn; the blend left on)', () => {
  const { gl, calls } = fakeGl();
  const pass = new SdOmenPassRenderer(gl);
  const sources = calls.filter((c) => c[0] === 'shaderSource').map((c) => c[2]);
  assert.deepEqual(sources, [BEACON_VS, BEACON_FS], 'the gate\'s column, built under its own program');
  assert.equal(pass.count, beaconVertices().length / 2);
  assert.notDeepEqual([...SD_OMEN_COLOR], [...BEACON_COLOR], 'never the gate\'s red');
  assert.ok(SD_OMEN_COLOR[0] > SD_OMEN_COLOR[1] && SD_OMEN_COLOR[1] > SD_OMEN_COLOR[2] && SD_OMEN_COLOR[1] >= 0.5, 'brass: red over green over blue, the green high');
  calls.length = 0;
  assert.equal(pass.draw([{ origin: [1, 2, 3], fade: 0.5 }, { origin: [4, 5, 6], fade: 0 }, null, { origin: [NaN, 0, 0], fade: 1 }], I, I, [0, 0, 0], 1), 1, 'one column: the dark and the broken skipped');
  assert.deepEqual(Array.from(calls.find((c) => c[0] === 'uniform3fv' && c[1] === 'uColor')[2]), [...new Float32Array(SD_OMEN_COLOR)]);
  assert.equal(calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uRadius')[2], BEACON_RADIUS_M);
  assert.deepEqual(calls.find((c) => c[0] === 'uniform3f' && c[1] === 'uOrigin').slice(2), [1, 2, 3]);
  assert.equal(calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uFade')[2], 0.5);
  assert.deepEqual(calls.find((c) => c[0] === 'blendFunc').slice(1), [gl.ONE, gl.ONE], 'added onto the frame');
  assert.deepEqual(calls.filter((c) => c[0] === 'drawArrays').length, 1);
  const last = calls.slice(-4).map((c) => c[0]);
  assert.deepEqual(last, ['bindVertexArray', 'enable', 'depthMask', 'disable'], 'the state put back');
  assert.deepEqual(calls.at(-1).slice(1), [gl.BLEND]);
  calls.length = 0;
  assert.equal(pass.draw([], I, I, [0, 0, 0], 1), 0);
  assert.equal(calls.length, 0, 'nothing to draw, nothing touched');
});

test('SD2c the hosts by source: world.js hands the held map, the compass, the Timers, the board and the taverns their Super dungeon, draws its column after the gate\'s fire outside alone, and builds the pass once; the held map, the ink, the HUD and the board read it (THE FOUR HOSTS: world.js WIRED; worldModes.js, dungeonContext.js and exterior.js FLAGGED in the record)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /\n {6}sd: \(\) => sdHost\?\.mapMark\(\) \?\? null,/, 'the held map\'s ring');
  assert.match(w, /\n {8}sd: sdHost \? \{ rec: sdHost\.record\(\), name: sdHost\.hollow\(\)\?\.loc\?\.name \?\? null, place: sdHost\.hollow\(\)\?\.site\?\.cityName \?\? null \} : null,/, 'the Timers row\'s source');
  assert.match(w, /getNewsOrRumors: \(session\) => sdHost\?\.rumor\(rumorHere\(\), session\) \?\? revenantRumor\(rumorHere\(\), session\) \?\? rumorMill\.getNewsOrRumors\(session\),/, 'its city\'s taverns first');
  assert.match(w, /gate: \(\) => noticeGateCard\(\), sd: \(\) => noticeSdCard\(\),/, 'the board\'s note');
  assert.match(w, /\n {10}sd: sdCompassMark\(\),/, 'the compass');
  assert.match(w, /return Math\.hypot\(at\[0\] - f\[0\], at\[1\] - f\[2\]\) <= SD_COMPASS_M \? at : null;/, 'inside its kilometre');
  assert.match(w, /if \(!o \|\| \(modes\?\.mode \?\? 'exterior'\) !== 'exterior'\) return null;\n {4}const p = playerTravelPixel\(\);\n {4}const \{ site, loc, key \} = o\.hollow;\n {4}if \(!sdOmenSeen\(site, p\.x, p\.y\)\) return null;/, 'outside alone, from its twelve pixels');
  const gateFire = w.indexOf('if (gatePool?.stands() && gatePool.drawPass(');
  const omen = w.indexOf('if (sdo && sdOmenPassOf()?.draw([sdo], proj, view, new Float32Array(mwv.eye), now / 1000,');
  assert.ok(gateFire > 0 && omen > gateFire, 'after the gate\'s fire');
  assert.match(w, /if \(_sdOmenPass === undefined\) \{ try \{ _sdOmenPass = new SdOmenPassRenderer\(renderer\.gl\); \}/, 'built once, the first time');
  const hm = read('src/ui/heldMap.js');
  assert.match(hm, /const sd = readGateMark\(this\.deps\.sd, this\._size\);/);
  assert.match(hm, /\n {10}sd: this\._sd,   \/\/ SD2c/);
  assert.match(read('src/ui/inkMap.js'), /if \(opts\.sd && visible\(opts\.sd\.cx, opts\.sd\.cy, opts\.sd\.r \+ 2\)\) paintGateRing\(ctx, view, opts\.sd, pulse, SD_MAP_INK\);/);
  assert.match(read('src/ui/enhancedHud.js'), /drawSdMark\(opts\.sd \?\? null, opts\.playerXZ \?\? null, heading01\);/);
  assert.match(read('src/ui/noticeWindow.js'), /sd: deps\.sd\?\.\(\) \?\? null,/);
  const rec = read('bible/11-Multiplayer/Super-Dungeons.md');
  assert.match(rec, /### SD2c - shipped 2026-10-06/);
  const sd2c = rec.slice(rec.indexOf('### SD2c - shipped'));
  for (const host of ['scenes/world.js', 'scenes/worldModes.js', 'scenes/dungeonContext.js', 'scenes/exterior.js']) assert.ok(sd2c.includes(host), `the record names ${host}`);
});
