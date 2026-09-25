// HUB1 (2026-09-25, Mac: "giving each region's main city a natural player hub and future ownership for online
// guilds"; the marker: "a color coded circle indicator or something along those lines for distinguishing"; respawn:
// "leave that out. That'll be a seperate idea"): EVERY REGION'S MAIN CITY IS ITS HUB (systems/regionHubs.js). The
// rule, the words, the base-row count, the held map's circles and names, and the world host's wiring by source.
// The held map window's label and info box are driven in test/heldmap.test.js. `06-Systems/Online-Arc.md` HUB1.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HUB_CAPITALS, hubClaim, pickRegionHubs, hubOfRegion, hubAtMapId, hubTitle, hubMapWord, hubArrivalLine,
} from '../src/systems/regionHubs.js';
import { MapsFile, LOCATION_TYPES, mapPixelToLongitudeLatitude, longitudeLatitudeToMapPixel } from '../src/formats/mapsFile.js';
import {
  buildInkModel, buildInkMarks, paintInk, placeNames, markReach, paintHubCircle, HUB_CIRCLE, HUB_CIRCLE_PAD, GLYPH_R, PEN, toPaper,
} from '../src/ui/inkMap.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

/** A location as MapsFile.getLocation answers it, standing at map pixel (x, y). */
function loc(regionIndex, locationIndex, name, locationType, { w = 2, h = 2, buildings = 20, x = 10, y = 10, mapId = null } = {}) {
  const ll = mapPixelToLongitudeLatitude(x, y);
  return {
    regionIndex, locationIndex, name,
    mapTableData: { mapId: mapId ?? -(1000 + regionIndex * 100 + locationIndex), locationType, longitude: ll.x, latitude: ll.y },   // the helper answers {x: longitude, y: latitude}
    exterior: { buildingCount: buildings, exteriorData: { width: w, height: h } },
  };
}
const NAMES = { 17: 'Daggerfall', 20: 'Wayrest', 44: 'Sentinel', 5: 'Dragontail Mountains', 9: 'Bhoriane', 11: 'Glenpoint' };
const regionNameOf = (r) => NAMES[r] ?? `R${r}`;

test('HUB1 the rule: a region\'s hub is its best KIND of settlement (a city over a town over a village), then the one NAMED FOR ITS REGION, then the LARGEST by exterior blocks and then buildings, then the lowest index; a region with no settlement has none; a row a mod appended never counts; the three kingdoms\' own cities are capitals (mutants: kind unread, the name unread, blocks or buildings unread, the tie reversed, a mod row counted, a capital by name alone)', () => {
  const locs = [
    // Daggerfall: the city named for its region beats a LARGER city
    loc(17, 3, 'Daggerfall', LOCATION_TYPES.TownCity, { w: 6, h: 6, buildings: 300, x: 200, y: 150 }),
    loc(17, 1, 'Bigger Town', LOCATION_TYPES.TownCity, { w: 8, h: 8, buildings: 400 }),
    loc(17, 9, 'Daggerfall Farm', LOCATION_TYPES.HomeFarms, { w: 9, h: 9 }),
    // Dragontail: no city named for it - the largest city by blocks; a hamlet named for the region does not beat a city
    loc(5, 0, 'Dragontail Mountains', LOCATION_TYPES.TownHamlet, { w: 9, h: 9 }),
    loc(5, 1, 'Small City', LOCATION_TYPES.TownCity, { w: 2, h: 2, buildings: 90 }),
    loc(5, 2, 'Large City', LOCATION_TYPES.TownCity, { w: 3, h: 3, buildings: 10 }),
    // Bhoriane: equal blocks - the more buildings; equal again - the lower index
    loc(9, 4, 'Fewer', LOCATION_TYPES.TownCity, { w: 4, h: 4, buildings: 50 }),
    loc(9, 7, 'More', LOCATION_TYPES.TownCity, { w: 4, h: 4, buildings: 60 }),
    loc(9, 2, 'Also More', LOCATION_TYPES.TownCity, { w: 4, h: 4, buildings: 60 }),
    // Glenpoint: villages only - the best of them still stands as its hub
    loc(11, 0, 'A Village', LOCATION_TYPES.TownVillage, { w: 1, h: 1 }),
    loc(11, 1, 'A Bigger Village', LOCATION_TYPES.TownVillage, { w: 2, h: 1 }),
    // Wayrest: the kingdom's own city
    loc(20, 0, 'Wayrest', LOCATION_TYPES.TownCity, { w: 5, h: 5 }),
    // a mod's appended city in the Dragontail Mountains, larger than any of the game's own there, is no row of the game's
    loc(5, 900, 'Modded Metropolis', LOCATION_TYPES.TownCity, { w: 8, h: 8, buildings: 999 }),
    // a region of dungeons and farms has no hub
    loc(33, 0, 'A Keep', LOCATION_TYPES.DungeonKeep, { w: 8, h: 8 }),
  ];
  const hubs = pickRegionHubs(locs, { regionNameOf, isBase: (l) => l.locationIndex < 900 });
  const pick = (r) => hubOfRegion(hubs, r)?.name ?? null;
  assert.equal(pick(17), 'Daggerfall', 'named for its region, over a larger city');
  assert.equal(pick(5), 'Large City', 'a city over a hamlet named for the region; the larger of two cities by blocks - and a mod\'s appended row never counts');
  assert.equal(pick(9), 'Also More', 'equal blocks: more buildings; equal again: the lower index');
  assert.equal(pick(11), 'A Bigger Village', 'a region of villages keeps its best village');
  assert.equal(pick(20), 'Wayrest');
  assert.equal(pickRegionHubs(locs, { regionNameOf }).byRegion.get(5).name, 'Modded Metropolis', '(counted, the mod\'s city would be the hub...)');
  assert.equal(pick(33), null, 'no settlement, no hub');
  assert.equal(hubs.byRegion.size, 5);
  const dag = hubOfRegion(hubs, 17);
  assert.deepEqual([dag.regionIndex, dag.locationIndex, dag.regionName, dag.capital], [17, 3, 'Daggerfall', true]);
  assert.equal(dag.mapId, (-(1000 + 17 * 100 + 3)) >>> 0, 'the map id unsigned - the room keys\' own spelling');
  assert.deepEqual({ ...dag.pixel }, longitudeLatitudeToMapPixel(locs[0].mapTableData.longitude, locs[0].mapTableData.latitude), 'where it stands, in map pixels');
  assert.deepEqual({ ...dag.pixel }, { x: 200, y: 150 });
  assert.ok(Object.isFrozen(dag) && Object.isFrozen(dag.pixel), 'a hub is read, never written');
  assert.equal(hubOfRegion(hubs, 20).capital, true, 'Wayrest');
  assert.equal(hubOfRegion(hubs, 5).capital, false);
  // by map id, signed or not
  assert.equal(hubAtMapId(hubs, locs[0].mapTableData.mapId), dag, 'the signed id MAPS.BSA reads');
  assert.equal(hubAtMapId(hubs, locs[0].mapTableData.mapId >>> 0), dag, 'and the unsigned one');
  assert.equal(hubAtMapId(hubs, locs[1].mapTableData.mapId), null, 'a city that is not its region\'s hub');
  assert.equal(hubAtMapId(hubs, null), null);
  assert.equal(hubAtMapId(hubs, 'x'), null);
  assert.equal(hubAtMapId(null, 5), null);
  // a capital is the kingdom's city in the kingdom's region - the name alone is not enough
  const elsewhere = pickRegionHubs([loc(5, 0, 'Sentinel', LOCATION_TYPES.TownCity)], { regionNameOf });
  assert.equal(hubOfRegion(elsewhere, 5).capital, false, 'a town called Sentinel in the Dragontail Mountains is no capital');
  const sentinel = pickRegionHubs([loc(44, 0, 'Sentinel', LOCATION_TYPES.TownCity)], { regionNameOf });
  assert.equal(hubOfRegion(sentinel, 44).capital, true);
  assert.deepEqual(HUB_CAPITALS, ['Daggerfall', 'Wayrest', 'Sentinel']);
  // the claim itself
  assert.equal(hubClaim(loc(1, 0, 'x', LOCATION_TYPES.Graveyard), 'x'), null, 'no settlement, no claim');
  assert.deepEqual(hubClaim(loc(1, 4, 'Glenpoint', LOCATION_TYPES.TownCity, { w: 3, h: 2, buildings: 7 }), ' glenpoint '), [3, 1, 6, 7, -4], 'the name matched without case or spaces');
  // junk is passed over, never thrown on
  assert.equal(pickRegionHubs([null, {}, { regionIndex: 1.5, locationIndex: 0 }], { regionNameOf }).byRegion.size, 0);
  assert.equal(pickRegionHubs(null).byRegion.size, 0);
});

test('HUB1 the words: a capital is "Capital of the Kingdom of X", a hub "Hub of X"; the map\'s word; the arrival line (mutants: the capital\'s words on a hub)', () => {
  const cap = { name: 'Daggerfall', regionName: 'Daggerfall', capital: true };
  const hub = { name: 'Large City', regionName: 'Dragontail Mountains', capital: false };
  assert.equal(hubTitle(cap), 'Capital of the Kingdom of Daggerfall');
  assert.equal(hubTitle(hub), 'Hub of Dragontail Mountains');
  assert.deepEqual([hubMapWord(cap), hubMapWord(hub)], ['Capital', 'Hub']);
  assert.equal(hubArrivalLine(cap), 'Daggerfall, capital of the Kingdom of Daggerfall.');
  assert.equal(hubArrivalLine(hub), 'Large City, hub of Dragontail Mountains.');
});

test('HUB1 the base rows: MapsFile.baseLocationCount is the region\'s own MAPNAMES count, and 0 for a region that will not load (mutants: the count read after a mod\'s rows)', () => {
  const count = (loads, n) => MapsFile.prototype.baseLocationCount.call({ loadRegion: () => loads, _readLocationCount: () => n }, 3);
  assert.equal(count(true, 812), 812);
  assert.equal(count(false, 812), 0);
});

// ── THE HELD MAP'S INK ───────────────────────────────────────────────
function recordingCtx() {
  const calls = [];
  const state = {};
  return new Proxy({}, {
    get: (_, k) => {
      if (k === 'calls') return calls;
      if (k === 'measureText') return (t) => ({ width: t.length * 6 });
      if (k in state) return state[k];
      return (...args) => { calls.push({ fn: k, args, strokeStyle: state.strokeStyle, fillStyle: state.fillStyle, lineWidth: state.lineWidth }); };
    },
    set: (_, k, v) => { state[k] = v; return true; },
  });
}
const island = () => {
  const w = 60, h = 40;
  const bytes = new Uint8Array(w * h).fill(40);
  return { width: w, height: h, heightBytes: bytes, climateAt: () => 231 };
};
const summary = (x, y, locationType) => ({ id: y * 1000 + x, mapID: -(y * 1000 + x), regionIndex: 17, mapIndex: 1, locationType, discovered: true });

test('HUB1 the held map: online a hub\'s mark carries its hub and sits in a coloured circle - blue, purple for a capital - painted UNDER its glyph and its halo, at every band; offline, and on every other town, no circle; a name is set clear of a hub\'s circle (mutants: the circle over the glyph, the colours swapped, circles offline, names across the circle)', () => {
  const town = summary(10, 10, LOCATION_TYPES.TownCity);
  const capital = summary(30, 20, LOCATION_TYPES.TownCity);
  const plain = summary(50, 30, LOCATION_TYPES.TownCity);
  const hubs = new Map([[town.mapID >>> 0, { name: 'Hubton', capital: false }], [capital.mapID >>> 0, { name: 'Crown', capital: true }]]);
  const hubAt = (s) => hubs.get(s.mapID >>> 0) ?? null;
  const marks = buildInkMarks({ summaries: [town, capital, plain], isDiscovered: () => true, nameOf: (s) => `P${s.id}`, hubAt });
  const byId = (id) => marks.find((m) => m.summary.id === id);
  assert.equal(byId(town.id).hub.name, 'Hubton');
  assert.equal(byId(capital.id).hub.capital, true);
  assert.equal(byId(plain.id).hub, null, 'a town that is no hub');
  assert.ok(buildInkMarks({ summaries: [town], isDiscovered: () => true }).every((m) => m.hub === null), 'offline the host hands no hubAt: no mark carries a hub');
  // the reach: a hub's circle is ground its mark holds
  assert.equal(markReach(byId(town.id)), GLYPH_R.city + HUB_CIRCLE_PAD);
  assert.equal(markReach(byId(plain.id)), GLYPH_R.city);
  // the paint, at the far band (cities alone) and the near
  const model = { ...buildInkModel(island()), marks };
  for (const band of ['far', 'near']) {
    const ctx = recordingCtx();
    paintInk(ctx, model, { ox: 0, oy: 0, scale: 10 }, { paperW: 600, paperH: 400, band });
    const calls = ctx.calls;
    const fills = calls.filter((c) => c.fn === 'fill' && (c.fillStyle === HUB_CIRCLE.hub.fill || c.fillStyle === HUB_CIRCLE.capital.fill));
    assert.deepEqual(fills.map((c) => c.fillStyle), [HUB_CIRCLE.hub.fill, HUB_CIRCLE.capital.fill], `${band}: the hub in blue, the capital in purple - and the plain town in neither`);
    const rims = calls.filter((c) => c.fn === 'stroke' && (c.strokeStyle === HUB_CIRCLE.hub.rim || c.strokeStyle === HUB_CIRCLE.capital.rim));
    assert.equal(rims.length, 2, `${band}: each circle rimmed`);
    const firstHalo = calls.findIndex((c) => c.strokeStyle === PEN.halo);
    assert.ok(firstHalo > calls.indexOf(fills[1]), `${band}: every circle is down before the first halo - the town sits ON the colour`);
    const arcs = calls.filter((c) => c.fn === 'arc' && c.args[2] === GLYPH_R.city + HUB_CIRCLE_PAD);
    assert.equal(arcs.length, 2, `${band}: the circle reaches past the city glyph by the pad`);
  }
  // the colours are none the sheet already speaks in
  for (const c of [HUB_CIRCLE.hub.rim, HUB_CIRCLE.capital.rim]) assert.ok(![PEN.select, PEN.player, PEN.line].includes(c));
  // a name set clear of the circle, not only of the glyph
  const view = { ox: 0, oy: 0, scale: 10 };
  const placed = placeNames(marks, view, 'near', { paperW: 600, paperH: 400, measure: (t) => t.length * 6 });
  const hubName = placed.find((n) => n.mark.summary.id === town.id);
  const [tx] = toPaper(view, byId(town.id).x, byId(town.id).y);
  assert.equal(hubName.box.x, tx + GLYPH_R.city + HUB_CIRCLE_PAD + 1 + 3, 'the hub\'s name starts past its circle');
  const plainName = placed.find((n) => n.mark.summary.id === plain.id);
  const [px] = toPaper(view, byId(plain.id).x, byId(plain.id).y);
  assert.equal(plainName.box.x, px + GLYPH_R.city + 1 + 3, '...where a plain town\'s sits by its glyph');
  // ...and a NEIGHBOUR's name keeps clear of it too: the circle is seeded as ground the hub's mark holds
  const neighbourRight = (hub) => {
    const pair = [
      { x: 0.5, y: 10.5, colorIndex: 11, kind: 'city', name: 'Neighbour', summary: {}, hub: null },
      { x: 10.5, y: 10.5, colorIndex: 11, kind: 'city', name: 'Beside', summary: {}, hub },
    ];
    const got = placeNames(pair, view, 'near', { paperW: 600, paperH: 400, measure: () => 80 }).find((n) => n.mark.name === 'Neighbour');
    return got?.box.x === toPaper(view, 0.5, 10.5)[0] + GLYPH_R.city + 1 + 3;
  };
  assert.equal(neighbourRight(null), true, 'beside a plain town the neighbour\'s name sits to its right');
  assert.equal(neighbourRight({ capital: false }), false, 'beside a hub it would cross the circle, so it does not');
  // the circle painter alone
  const ctx = recordingCtx();
  paintHubCircle(ctx, 5, 6, 9, true);
  assert.deepEqual(ctx.calls.map((c) => c.fn), ['beginPath', 'arc', 'fill', 'stroke']);
  assert.deepEqual(ctx.calls[1].args.slice(0, 3), [5, 6, 9]);
});

test('HUB1 the world host, by source: the boot collects the game\'s own rows as it indexes every location and picks the hubs from them; online alone the held map is handed each summary\'s hub, and walking into a hub says so at the location rect\'s entry (mutants: a mod row collected, the map handed hubs offline, the arrival said offline or on every town)', () => {
  const W = strip(read('src/scenes/world.js'));
  assert.match(W, /const baseCount = maps\.baseLocationCount\(r\);[\s\S]{0,400}?locationIndex\.set\(`\$\{p\.x\},\$\{p\.y\}`, loc\);\s*if \(l < baseCount\) _hubRows\.push\(loc\);/, 'the game\'s own rows, collected as the index is built');
  assert.match(W, /const regionHubs = pickRegionHubs\(_hubRows, \{ regionNameOf: \(r\) => maps\.getRegionName\(r\) \}\);/);
  assert.match(W, /hubAt: params\.has\('online'\) \? \(summary\) => hubAtMapId\(regionHubs, summary\?\.mapID \?\? summary\?\.mapId\) : null,/, 'the map is handed hubs online alone');
  const edge = W.slice(W.indexOf('_inRect && !_wasInLocationRect'));
  assert.match(edge.slice(0, 1500), /revealMemberGuildHalls\(\);\s*if \(onlineOn\) \{ const hub = hubAtMapId\(regionHubs, _musicLoc\?\.mapTableData\?\.mapId\); if \(hub\) townTalk\.say\(hubArrivalLine\(hub\), 5\); \}/, 'the arrival, at the location rect\'s entry, online');
  // and the held map reads what it is handed
  const H = strip(read('src/ui/heldMap.js'));
  assert.match(H, /hubAt: \(s\) => this\.deps\.hubAt\?\.\(s\) \?\? null,/);
});
