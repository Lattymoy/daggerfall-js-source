// AUDIT TAMRIEL-WIDE (2026-10-28; the owner: "ensure pur future development isnt just Daggerfall anymore and is the
// entirety of tamriel") - the account service's and the staff's findings: C3, a dungeon vein's identity past the Bay
// (acct217), and B4/C7, the staff's /tp and flat map past the Bay. Each on the real code past the Bay beside the Bay's
// own answer (bible/06-Systems/Professions-Arc.md section 23, bible/06-Systems/Online-Arc.md STAFF1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { dungeonIdentity, dungeonIdOf } from '../../../src/scenes/dungeonIdentity.js';
import { synthesizeEtherLocation, etherPlaceId } from '../../../src/world/etherPlaces.js';
import { synthesizeLairLocation, lairPlaceId, lairSite } from '../../../src/world/tamrielDungeons.js';
import { isleOfCell, CELLS_W, CELLS_H } from '../../../src/world/ethericSea.js';
import { getAbyssMapId, cloneDungeon } from '../../../src/world/oceanHoles.js';
import { dveinKey, parseNodeKey, dungeonOk } from '../../../src/net/nodeLaw.js';
import { gameMaps } from '../../../src/net/staffPlaces.js';
import { parseStaffCommand, findPlace } from '../../../src/net/staffCommands.js';
import { parseStaffLine, staffHelpLines, staffTpPlaces } from '../../../src/scenes/staffTp.js';
import { createWorldPlaces } from '../../../src/world/worldWide/worldPlaces.js';
import { createStaffFlatMapHost } from '../../../src/scenes/staffFlatMapHost.js';
import { groundPoliticIndex } from '../../../src/world/tamriel/tamrielGround.js';
import { tamrielFrameInBay, setTamrielFit, tamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';
import { setTamrielTrace } from '../../../src/world/tamriel/tamrielLand.js';
import { isProvinceRegion, PROVINCE_REGION_NAMES } from '../../../src/formats/mapsTables.js';
import { standService, T0 } from '../../accountDb.mjs';
import { xpForRank } from '../../../src/net/professionLaw.js';
import { utcDay } from '../../../src/net/marksLaw.js';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const low20 = (id) => (id >>> 0) & 0xfffff;
/** A dungeon template as MAPS.BSA's rows hand one over: Privateer's Hold's map id (wire.js MAIN_STORY_DUNGEON_IDS). */
const TEMPLATE = Object.freeze({
  name: 'Template', regionIndex: 17, regionName: 'Daggerfall', climate: { worldClimate: 231 }, politic: 128 + 17,
  mapTableData: { mapId: 187853213, locationType: 8, dungeonType: 0, longitude: 0, latitude: 0 }, exterior: {},
  dungeon: { recordElement: { header: { locationId: 1 } }, blocks: [] },
});
/** The first ruin of the Eltheric Ocean whose low 20 bits are a lair cell's (most are: 53,534 of 56,792 on the probe). */
function firstRuin() {
  for (let cy = 0; cy < CELLS_H; cy++) for (let cx = 0; cx < CELLS_W; cx++) {
    const i = isleOfCell(cx, cy);
    if (i?.kind === 'ruin' && low20(etherPlaceId(i)) >= 0x80000) return i;
  }
  throw new Error('no ruin');
}

test('AUDIT TAMRIEL-WIDE C3: two dungeons past the Bay are two veins - an isle\'s ruin and the lair whose low 20 bits it shares, and two abysses a pit\'s span apart, each its whole map id; a Bay dungeon and a Bay abyss keep DFU\'s mask byte for byte (mutant: nine digits read; the mask kept past the Bay)', () => {
  setTamrielTrace(null);
  const isle = firstRuin();
  const c = low20(etherPlaceId(isle)) - 0x80000;
  const ruin = synthesizeEtherLocation(TEMPLATE, isle);
  const lair = synthesizeLairLocation(TEMPLATE, { c, ...lairSite(c), type: 8, name: 'Lair', blocks: [] });
  assert.equal(low20(ruin.mapTableData.mapId), low20(lair.mapTableData.mapId), 'the collision the audit found: one low 20');
  const [r, l] = [dungeonIdentity(ruin), dungeonIdentity(lair)];
  assert.deepEqual([r.id, l.id], [etherPlaceId(isle), lairPlaceId(c)], 'each its whole id');
  assert.notEqual(r.id, l.id);
  for (const id of [r.id, l.id]) assert.deepEqual(parseNodeKey(dveinKey({ dungeon: id, day: 20390, slot: 0 })), { kind: 'dvein', dungeon: id, day: 20390, slot: 0 }, 'its vein parses');
  const [a, b] = [getAbyssMapId(2434, 1460), getAbyssMapId(2434, 1556)];
  assert.equal(low20(a), low20(b), 'two abysses past the Bay share their low 20');
  assert.equal(low20(a), low20(lairPlaceId(low20(a) - 0x80000)), 'and a lair\'s');
  assert.equal(new Set([dungeonIdOf(a), dungeonIdOf(b), dungeonIdOf(lairPlaceId(low20(a) - 0x80000))]).size, 3, 'three veins');
  // AUDIT TAMRIEL-WIDE II A1: an abyss's whole id past the Bay is ten digits, and its vein parses
  for (const id of [a, b]) {
    assert.equal(String(dungeonIdOf(id)).length, 10, `${id}: ten digits`);
    assert.deepEqual(parseNodeKey(dveinKey({ dungeon: dungeonIdOf(id), day: 20390, slot: 0 })), { kind: 'dvein', dungeon: dungeonIdOf(id), day: 20390, slot: 0 }, 'its vein parses');
  }
  assert.equal(dungeonIdentity(TEMPLATE).id, 187853213 & 0xfffff, 'a Bay dungeon: MapId & 0xfffff, as DFU has it');
  assert.equal(dungeonIdOf(getAbyssMapId(412, 220)), 220 * 1000 + 412, 'the Bay\'s abyss: its pixel id, as before');
  assert.deepEqual([dungeonOk(0xffffffff), dungeonOk(2 ** 32)], [true, false]);
  assert.equal(parseNodeKey(`dvein:0${r.id}:20390:0`), null, 'one spelling');
  assert.equal(parseNodeKey('dvein:12345678901:20390:0'), null, 'eleven digits');
});

test('AUDIT TAMRIEL-WIDE C3: an abyss past the Bay names its pit\'s ground, as the gathering reads that pixel off the game\'s maps - never its borrowed template\'s; the Bay\'s abyss keeps its template\'s, the ground its facts were witnessed under (mutant: the template\'s ground past the Bay)', () => {
  const asked = [];
  gameMaps({ getClimateIndex: (x, y) => { asked.push([x, y]); return 223; }, getRegionIndexAt: () => 0 });
  try {
    const abyss = (px, py) => { const d = cloneDungeon(TEMPLATE, 'The Drowned Hall'); d.mapTableData = { ...d.mapTableData, mapId: getAbyssMapId(px, py) }; return d; };   // dungeonContext.js rename's shape
    assert.deepEqual(dungeonIdentity(abyss(2441, 1500)), { id: getAbyssMapId(2441, 1500), climate: 223, region: 0 }, 'the Topal Bay\'s sea, not Daggerfall\'s woods');
    assert.deepEqual(asked, [[2441, 1500]], 'asked at the pit');
    assert.deepEqual(dungeonIdentity(abyss(412, 220)), { id: 220 * 1000 + 412, climate: 231, region: 17 }, 'the Bay\'s abyss: its template\'s, as before');
    assert.deepEqual(dungeonIdentity(TEMPLATE), { id: 187853213 & 0xfffff, climate: 231, region: 17 }, 'a dungeon: its own');
  } finally { gameMaps(null); }
  const loc = cloneDungeon(TEMPLATE, 'x');
  loc.mapTableData = { ...loc.mapTableData, mapId: getAbyssMapId(2441, 1500) };
  assert.deepEqual(dungeonIdentity(loc), { id: getAbyssMapId(2441, 1500), climate: 231, region: 17 }, 'no maps kept (a probe, the standalone scene): the template\'s');
});

/** buildDungeonContext's own profIdentity, cut from the source and run over a location. */
function hostIdentity(dfLocation) {
  const DC = src('src/scenes/dungeonContext.js');
  const i = DC.indexOf('    profIdentity() {');
  const j = DC.indexOf('\n    },', i);
  assert.ok(i > 0 && j > i, 'profIdentity is in the dungeon host');
  const scope = { dfLocation, isGateArena: () => false, isArenaFloor: () => false, dungeonIdentity };
  // eslint-disable-next-line no-new-func
  return new Function('__s', `with (__s) { return ({ ${DC.slice(i, j + 6)} }).profIdentity(); }`)(scope);
}

test('AUDIT TAMRIEL-WIDE C3: the dungeon host names a dungeon by the identity\'s law - the ruin past the Veil by its whole id, a Bay dungeon by its pixel, a spawned one none (mutant: the host\'s own mask back)', () => {
  setTamrielTrace(null);
  const isle = firstRuin();
  assert.equal(hostIdentity(synthesizeEtherLocation(TEMPLATE, isle)).id, etherPlaceId(isle));
  assert.equal(hostIdentity(TEMPLATE).id, 187853213 & 0xfffff);
  assert.equal(hostIdentity({ ...TEMPLATE, spawned: true }), null);
  assert.match(src('src/scenes/dungeonContext.js'), /^import \{ dungeonIdentity \} from '\.\/dungeonIdentity\.js';/m);
});

// ─── THE SERVICE (acct217) ───────────────────────────────────────────

const DAY = 86_400, MOUNTAIN = 226, WOODS = 231, ETHER = 19, SKYRIM = 64;
let _now = utcDay(T0) * DAY + 12 * 3600;
const realNow = Date.now;
const clock = (s) => { _now = s; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `tw-${String(++_rid).padStart(6, '0')}`;

test('AUDIT TAMRIEL-WIDE C3 (acct217): the service keeps the ruin\'s and the lair\'s veins apart - the ruin witnessed for its ground, the lair\'s own claim stands, and one account takes slot 0 of each; a whole id past 32 bits is refused (mutants: the 20-bit bound kept; the key\'s seven digits kept)', async () => {
  clock(utcDay(T0) * DAY + 12 * 3600);
  setTamrielTrace(null);
  const isle = firstRuin();
  const c = low20(etherPlaceId(isle)) - 0x80000;
  const ruinId = dungeonIdentity(synthesizeEtherLocation(TEMPLATE, isle)).id;
  const lairId = dungeonIdentity(synthesizeLairLocation(TEMPLATE, { c, ...lairSite(c), type: 8, name: 'Lair', blocks: [] })).id;
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const day = utcDay(_now);
  const harvest = (who, dungeon, climate, region) => s.call('/v1/prof/harvest', { character: who.character, node: dveinKey({ dungeon, day, slot: 0 }), kind: 'ore', climate, region, act: { glints: 0 }, at: _now - 2, rid: rid() }, who.secret);
  const ws = [];
  for (let k = 0; k < 3; k++) {
    const w = await s.seated(`Witness${k}`);
    raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(_now - 8 * DAY, w.id);
    raw.prepare('INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, ?, ?, ?)').run(w.id, w.character, 'mining', xpForRank(70), _now);
    const r = await harvest(w, ruinId, MOUNTAIN, ETHER);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    ws.push(w);
  }
  clock(_now + 60);
  const inLair = await harvest(ws[0], lairId, WOODS, SKYRIM);
  assert.equal(inLair.status, 200, `the lair is its own dungeon - its own ground, its own slot 0: ${JSON.stringify(inLair.body)}`);
  const read = (await s.call('/v1/prof/pixels', { character: ws[0].character, pixels: [], dungeons: [ruinId, lairId] }, ws[0].secret)).body.dungeons;
  assert.deepEqual(read.find((d) => d.id === ruinId), { id: ruinId, state: 'confirmed', climate: MOUNTAIN, region: ETHER }, 'the ruin, witnessed');
  assert.notEqual(read.find((d) => d.id === lairId)?.state, 'confirmed', 'the lair: none of the ruin\'s witnesses');
  assert.deepEqual([(await harvest(ws[1], ruinId, MOUNTAIN, ETHER)).body], [{ error: 'node-taken' }], 'the ruin\'s slot is still the ruin\'s');
  const past = await s.call('/v1/prof/harvest', { character: ws[2].character, node: `dvein:${2 ** 32}:${day}:0`, kind: 'ore', climate: MOUNTAIN, region: ETHER, act: { glints: 0 }, at: _now - 2, rid: rid() }, ws[2].secret);
  assert.deepEqual(past.body, { error: 'bad-node' });
  const tooMany = await s.call('/v1/prof/pixels', { character: ws[0].character, pixels: [], dungeons: [2 ** 32] }, ws[0].secret);
  assert.deepEqual(tooMany.body, { error: 'bad-pixels' });
});

// ─── THE STAFF'S TOOLS (B4/C7) ───────────────────────────────────────

test('AUDIT TAMRIEL-WIDE B4/C7: /tp <x> <y> takes a pixel of the world\'s grid, either sign, as /pos prints it; a Bay pixel as before; past the grid answered with the usage; every other line parseStaffCommand\'s (mutants: the Bay\'s grammar first; a minus a place\'s name; the bound unread)', () => {
  assert.deepEqual(parseStaffLine('/tp 2700 187'), { cmd: 'tp', px: 2700, py: 187 }, 'Skyrim: it was "A map pixel is x 0-999, y 0-499."');
  assert.deepEqual(parseStaffLine('/tp 1688 -488'), { cmd: 'tp', px: 1688, py: -488 }, 'north of the Bay: it was a place search for "1688 -488"');
  assert.deepEqual(parseStaffLine('/TP  -500   250 '), { cmd: 'tp', px: -500, py: 250 });
  assert.deepEqual(parseStaffLine('/tp 412 220'), parseStaffCommand('/tp 412 220'), 'the Bay\'s answer');
  assert.deepEqual([parseStaffLine('/tp 8192 0'), parseStaffLine('/tp 0 -8192')], [parseStaffCommand('/tp'), parseStaffCommand('/tp')], 'past the world\'s grid: the usage');
  assert.deepEqual(parseStaffLine('/tp 8191 -8191'), { cmd: 'tp', px: 8191, py: -8191 });
  for (const line of ['/tp Daggerfall', '/tp 12', '/tp @Bran', '/god', '/staff', 'hello', '/tp 1 2 3']) assert.deepEqual(parseStaffLine(line), parseStaffCommand(line), line);
  const help = staffHelpLines();
  // AUDIT TAMRIEL-WIDE II A5: the place's line says what the search reaches - every Bay place, the named ones past it
  assert.ok(help.includes('/tp <place> - to a named place: any on the Bay, past it a city or town the map names'), help.join(' | '));
  assert.equal(help.length, 10);   // PIN MOVED (STAFF-PULL, #1389): main's /tpa line joined the list
  assert.ok(help.includes('/tpa <player> - bring them to you (admins and Shadow Fang)'), 'STAFF-PULL\'s line kept beside the place\'s');
  assert.ok(help.includes('/tp <x> <y> - to a map pixel') && !help.some((l) => /0-999/.test(l)), 'the help names no Bay bound');
  assert.match(src('src/scenes/world.js'), /const staffCmd = isStaffT\(staffGlyphs\(\)\) \? \(parseDragonCommand\(text\) \?\? parseStaffLine\(/, 'the host reads the world\'s grammar (after DRAGON-RIDE\'s /dragon)');
  assert.match(src('src/scenes/world.js'), /if \(c\.cmd === 'staff'\) \{ for \(const line of \[\.\.\.staffHelpLines\(\), DRAGON_HELP_LINE\]\) say\(line\); return; \}/);   // and DRAGON-RIDE's line after
});

test('AUDIT TAMRIEL-WIDE B4/C7: /tp <place> searches the registry\'s places past the Bay after the Bay\'s own, in the order it always read them - the location index, the stood places on no indexed pixel - and a pixel once (mutants: the registry unread; its Bay rows read; a held pixel twice)', () => {
  const registry = createWorldPlaces();
  registry.register('bay', [{ mapId: 1, name: 'Daggerfall', px: 207, py: 213, type: 0, region: 17 }, { mapId: 2, name: 'Unindexed', px: 500, py: 300, type: 0, region: 20 }]);   // the Bay's answers are the location index's
  registry.register('tesa', [
    { mapId: 0x30080001, name: 'Solitude', px: 1500, py: -200, type: 0 },
    { mapId: 0x30080002, name: 'Dawnstar', px: 1688, py: -488, type: 0 },
    { mapId: 0x30080003, name: 'Stood Twice', px: 2700, py: 187, type: 0 },
  ]);
  const locationIndex = new Map([['207,213', { name: 'Daggerfall' }], ['300,100', { name: 'Wayrest' }]]);
  const stood = [{ name: 'Stood Twice', bx: 2700, by: 187 }, { name: 'Wayrest Again', bx: 300, by: 100 }];
  const places = staffTpPlaces({ locationIndex, stood, registry });
  assert.deepEqual(places, [
    { name: 'Daggerfall', px: 207, py: 213 }, { name: 'Wayrest', px: 300, py: 100 },
    { name: 'Stood Twice', px: 2700, py: 187 },
    { name: 'Solitude', px: 1500, py: -200 }, { name: 'Dawnstar', px: 1688, py: -488 },
  ]);
  assert.deepEqual(findPlace(places, 'solitude'), { name: 'Solitude', px: 1500, py: -200 }, 'a province\'s city: it was "No place called"');
  assert.deepEqual(findPlace(places, 'dagger'), { name: 'Daggerfall', px: 207, py: 213 }, 'the Bay\'s answer, as before');
  assert.deepEqual(staffTpPlaces({ locationIndex, stood: null, registry: null }), places.slice(0, 2), 'no TESA, no registry: the index alone');
  assert.match(src('src/scenes/world.js'), /findPlace\(staffTpPlaces\(\{ locationIndex, stood: _arenaTemplates \? arenaPixels\(\)\?\.stood : null, registry: worldPlaces \}\), c\.place\)/, 'the host hands it the world\'s registry');
});

test('AUDIT TAMRIEL-WIDE B4/C7: the flat map opens on a province\'s land past the Bay - its box found over the continent\'s frame, the staff member\'s dot in it, the land at the box\'s edge none of its own and its margin kept - where the Bay\'s map held no pixel of it (mutants: the Bay\'s map scanned; the coarse step\'s reach ungrown)', () => {
  setTamrielTrace(null);   // the authored shape, as a page with no trace stands it
  const politicAt = groundPoliticIndex((x, y) => (x >= 0 && y >= 0 && x < 1000 && y < 500 ? (y < 250 ? 128 + 17 : 64) : -1));
  let here = null;
  for (let x = 1400; x < 3000 && !here; x += 25) if (isProvinceRegion(politicAt(x, -200) - 128)) here = { x, y: -200 };
  assert.ok(here, 'a province\'s pixel north of the Bay');
  const region = politicAt(here.x, here.y) - 128;
  const shows = [];
  const host = createStaffFlatMapHost({ map: { pick() {}, answer: () => null }, politicAt, pixel: () => here, flagOf: () => null, words: () => '', choose() {},
    makeSheet: () => ({ show: (v) => shows.push(v), hide() {}, dispose() {} }) });
  host.toggle();
  host.frame();
  const v = shows.at(-1);
  assert.equal(v.region, region);
  assert.ok(v.box, 'a box: the Bay\'s 1000 x 500 held none of it');
  assert.deepEqual(v.me, { x: here.x + 0.5, y: here.y + 0.5 }, 'the staff member\'s dot');
  assert.equal(v.landAt(here.x, here.y), 'own');
  const f = tamrielFrameInBay();
  assert.ok(v.box.x0 >= Math.floor(f.x0) && v.box.y0 >= Math.floor(f.y0) && v.box.x1 < f.x0 + f.w && v.box.y1 < f.y0 + f.h, 'inside the continent\'s frame');
  // the province's land stands MARGIN (4) inside the box on every side the frame does not cut, and none past it
  const own = (x, y) => politicAt(x, y) - 128 === region;
  const edge = [];
  for (let d = -12; d < 4; d++) {
    for (let x = v.box.x0 - 12; x <= v.box.x1 + 12; x++) { if (own(x, v.box.y0 + d)) edge.push(['n', x, d]); if (own(x, v.box.y1 - d)) edge.push(['s', x, d]); }
    for (let y = v.box.y0 - 12; y <= v.box.y1 + 12; y++) { if (own(v.box.x0 + d, y)) edge.push(['w', y, d]); if (own(v.box.x1 - d, y)) edge.push(['e', y, d]); }
  }
  assert.deepEqual(edge, [], 'no land of its own within the margin or past the box');
});

test('AUDIT TAMRIEL-WIDE II A3, A4: every province\'s box holds all its land and four pixels of margin, the frame aside; a new fit finds the box again (mutants: the coarse step\'s pixel ungrown; the box kept across fits)', () => {
  setTamrielTrace(null);
  const politicAt = groundPoliticIndex((x, y) => (x >= 0 && y >= 0 && x < 1000 && y < 500 ? (y < 250 ? 128 + 17 : 64) : -1));
  const boxesAt = () => {
    const f = tamrielFrameInBay();
    const fx0 = Math.floor(f.x0), fy0 = Math.floor(f.y0), fx1 = Math.ceil(f.x0 + f.w) - 1, fy1 = Math.ceil(f.y0 + f.h) - 1;
    const land = new Map();
    for (let y = fy0; y <= fy1; y++) for (let x = fx0; x <= fx1; x++) {
      const r = politicAt(x, y) - 128;
      if (!isProvinceRegion(r)) continue;
      const b = land.get(r) ?? { x0: x, y0: y, x1: x, y1: y, at: { x, y } };
      land.set(r, { ...b, x0: Math.min(b.x0, x), y0: Math.min(b.y0, y), x1: Math.max(b.x1, x), y1: Math.max(b.y1, y) });
    }
    return [...land].map(([r, e]) => {
      const shows = [];
      const host = createStaffFlatMapHost({ map: { pick() {}, answer: () => null }, politicAt, pixel: () => e.at, flagOf: () => null, words: () => '', choose() {},
        makeSheet: () => ({ show: (v) => shows.push(v), hide() {}, dispose() {} }) });
      host.toggle(); host.frame();
      const box = shows.at(-1).box;
      const need = { x0: Math.max(fx0, e.x0 - 4), y0: Math.max(fy0, e.y0 - 4), x1: Math.min(fx1, e.x1 + 4), y1: Math.min(fy1, e.y1 + 4) };
      assert.ok(box.x0 <= need.x0 && box.y0 <= need.y0 && box.x1 >= need.x1 && box.y1 >= need.y1, `${r}: ${JSON.stringify(box)} holds ${JSON.stringify(need)}`);
      return [r, box];
    });
  };
  assert.equal(boxesAt().length, PROVINCE_REGION_NAMES.length, 'every province');
  // one host across a fit: the box it keeps is the fit's own
  let here = null;
  for (let x = 1400; x < 3000 && !here; x += 25) if (isProvinceRegion(politicAt(x, -200) - 128)) here = { x, y: -200 };
  const shows = [];
  const host = createStaffFlatMapHost({ map: { pick() {}, answer: () => null }, politicAt, pixel: () => here, flagOf: () => null, words: () => '', choose() {},
    makeSheet: () => ({ show: (v) => shows.push(v), hide() {}, dispose() {} }) });
  host.toggle(); host.frame();
  const before = shows.at(-1).box, was = tamrielFit();
  try {
    setTamrielFit({ ...was, ox: was.ox + 6 });
    host.frame();
    assert.notDeepEqual(shows.at(-1).box, before, 'the fit moved: the box found again');
  } finally { setTamrielFit(was); }
});
