// ZONE-SAFE (2026-10-25; bible/11-Multiplayer/Wild-Zone.md section 26), the owner: "Btw with the pvp changes. All cities
// should be considered safe zones" - and, asked which places, "Every settlement". In the open zone no player's blow or
// spell lands in the streets of a city, a town or a village, nor out of them: the law (systems/wild/zoneSafe.js
// settledAt - DFU's location rect over the place a point stands on, of a settlement's kind), my word on the zone (0 in
// the streets, so the relay's referee refuses every blow into and out of them), every door of mine (no body in the
// streets is fair), the dungeons the zone's as they were, the town watch's narrowed sentence, and the words that tell
// the player where the peace is.
import '../../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { settledAt, isSettlement, SETTLEMENT_TYPES, zoneSafe, zoneSafeFrame, ZONE_SAFE_TEXT } from '../../../src/systems/wild/zoneSafe.js';
import { TOWN_LOCATION_TYPES, isPlayerInTown } from '../../../src/systems/nearbyObjects.js';
import { LOCATION_TYPES, mapPixelToLongitudeLatitude } from '../../../src/formats/mapsFile.js';
import { locationWorldRect, isInLocationRect, mapPixelToWorldCoords, WORLD_MAP_RMB_DIM } from '../../../src/world/streamingWorld.js';
import { setWildHere, WILD_TEXT, wildRing, zoneRingName, wildRingBonus, WILD_RINGS } from '../../../src/systems/wild/wildZone.js';
import { newWildRef, wildZone, wildBlow, wildKin, WILD_GRACE } from '../../../src/net/wild/wildRef.js';
import { SIEGE_UNITS_PER_M } from '../../../src/net/siege/siegeRef.js';
import { statusTip } from '../../../src/ui/hud/statusTips.js';
import { activeSpellIcons, setZoneEntity } from '../../../src/ui/hud/hudActiveSpells.js';
import { buildZoneLegend, ZONE_RULES } from '../../../src/ui/wild/wildZoneMap.js';
import { hostText } from '../../hostText.mjs';
import * as tm from '../../../src/systems/textManager.js';

const ARENA2 = process.env.ARENA2_PATH;
const HAVE_ARENA2 = !!ARENA2 && ['MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));
const realSkip = HAVE_ARENA2 ? false : 'ARENA2_PATH not set (sh tools/fetch-data.sh)';
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const quiet = () => {};
/** Back to no zone and no streets (the frame's word is the module's). */
const reset = () => { zoneSafeFrame(false, false, quiet); setWildHere(false); setZoneEntity(null); };
afterEach(reset);

/** A location of `type` whose footprint is `w` x `h` city blocks. */
const place = (type, w = 2, h = 2) => ({ name: 'Somewhere', mapTableData: { locationType: type }, exterior: { exteriorData: { width: w, height: h, blockNames: Array(w * h).fill('TVRNAL01.RMB') } } });
/** A world-frame point ([x, y, z], the wire's) at world x, z. */
const at = (x, z) => [x, 0, z];
const rectOf = (loc, px, py) => locationWorldRect(loc, px, py);
const mid = (r) => at((r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2);

test('ZONE-SAFE THE LAW (zoneSafe.js settledAt): a point stands in a settlement\'s streets when the location its own map pixel stands is a city, a town or a village and the point is within its footprint widened one city block (PlayerGPS.PlayerLocationRectCheck); DFU\'s four other town kinds (a farm, a manor, an inn, a temple) and every lair are no settlement; past the Bay as on it; a rect widened over its pixel\'s edge reaches no further (mutants: a kind more; a kind less; the block\'s widening unread; the rect unread; the pixel\'s own location unread; a farm a settlement)', () => {
  assert.deepEqual([...SETTLEMENT_TYPES].sort(), [LOCATION_TYPES.TownCity, LOCATION_TYPES.TownHamlet, LOCATION_TYPES.TownVillage].sort());
  for (const k of SETTLEMENT_TYPES) assert.ok(TOWN_LOCATION_TYPES.has(k), 'every settlement is one of DFU\'s towns');
  const others = [...TOWN_LOCATION_TYPES].filter((k) => !SETTLEMENT_TYPES.has(k)).sort();
  assert.deepEqual(others, [LOCATION_TYPES.HomeFarms, LOCATION_TYPES.ReligionTemple, LOCATION_TYPES.Tavern, LOCATION_TYPES.HomeWealthy].sort(), 'DFU\'s four other towns, and no more');
  // the Bay (Daggerfall's own pixels), Cyrodiil's heart and a pixel west of the Bay's edge
  for (const [px, py] of [[207, 213], [2069, 658], [-40, 520]]) {
    const index = new Map();
    const key = `${px},${py}`;
    for (const type of Object.values(LOCATION_TYPES)) {
      const loc = place(type);
      index.set(key, loc);
      const r = rectOf(loc, px, py);
      assert.equal(settledAt(mid(r), index), SETTLEMENT_TYPES.has(type), `${key} kind ${type}`);
    }
    for (const type of SETTLEMENT_TYPES) {
      const loc = place(type, 1, 1);
      index.set(key, loc);
      const r = rectOf(loc, px, py), z = (r.minZ + r.maxZ) / 2;
      assert.ok(settledAt(at(r.minX - WORLD_MAP_RMB_DIM + 1, z), index), `${key}: a block outside the footprint is its streets still`);
      assert.ok(settledAt(at(r.maxX + WORLD_MAP_RMB_DIM - 1, z), index));
      assert.ok(!settledAt(at(r.minX - WORLD_MAP_RMB_DIM - 1, z), index), `${key}: past the block, the open country`);
      assert.ok(!settledAt(at(r.maxX + WORLD_MAP_RMB_DIM + 1, z), index));
      assert.ok(!settledAt(at((r.minX + r.maxX) / 2, r.maxZ + WORLD_MAP_RMB_DIM + 1), index));
      // the law and DFU's own: a settlement's streets are always DFU's town with its rect
      assert.ok(isPlayerInTown(type, { mustBeInLocationRect: true, mustBeOutside: true, inLocationRect: isInLocationRect(r.minX, r.minZ, r), inside: false }));
    }
  }
  // an eight-by-eight city fills its pixel: the next pixel, a few paces past its edge, is the next pixel's (none)
  const index = new Map([['300,200', place(LOCATION_TYPES.TownCity, 8, 8)]]);
  const o = mapPixelToWorldCoords(300, 200);
  assert.ok(settledAt(at(o.x + 32768 - 10, o.z + 16384), index), 'the city\'s own pixel, at its east edge');
  assert.ok(!settledAt(at(o.x + 32768 + 10, o.z + 16384), index), 'ten units east: the next pixel, which stands nothing');
  // what cannot say where it stands, or stands nothing
  assert.ok(!settledAt(null, index));
  assert.ok(!settledAt(at(NaN, 0), index));
  assert.ok(!settledAt(at(o.x + 100, o.z + 100), null));
  assert.ok(!settledAt(at(o.x + 100, o.z + 100), new Map([['300,200', { mapTableData: { locationType: LOCATION_TYPES.TownCity } }]])), 'no exterior, no streets');
  assert.ok(!isSettlement(null));
});

test('ZONE-SAFE ON THE GAME\'S OWN PLACES: every MAPS.BSA row\'s middle is a settlement\'s streets exactly when it is a city, a town or a village (3,444 of 15,251 rows - DFU\'s IsPlayerInTown would take 5,929 more: farms, manors, inns, temples), each of them DFU\'s town with its rect; and past the Bay the places TESA clones off them - Arena\'s towns and the countryside\'s - read the same (mutants: a kind more; the rect unread)', { skip: realSkip }, async () => {
  const { MapsFile, longitudeLatitudeToMapPixel } = await import('../../../src/formats/mapsFile.js');
  const { arenaTemplates, arenaTemplateOf, synthesizeArenaLocation } = await import('../../../src/world/arenaLocations.js');
  const { countryTemplates, synthesizeCountryLocation } = await import('../../../src/world/tamrielCountry.js');
  const f = (n) => new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), n)));
  const maps = new MapsFile(); maps.load(f('MAPS.BSA'), f('CLIMATE.PAK'), f('POLITIC.PAK'));
  const rows = [];
  for (let r = 0; r < maps.regionCount; r++) {
    const region = maps.getRegion(r);
    if (!region) continue;
    for (let l = 0; l < region.locationCount; l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(loc); }
  }
  let settled = 0, towns = 0;
  for (const loc of rows) {
    if (!loc.exterior?.exteriorData) continue;
    const p = longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude);
    const index = new Map([[`${p.x},${p.y}`, loc]]);
    const r = rectOf(loc, p.x, p.y), type = loc.mapTableData.locationType;
    const s = settledAt(mid(r), index);
    assert.equal(s, SETTLEMENT_TYPES.has(type), `${loc.name} (${type})`);
    if (s) { settled++; assert.ok(isPlayerInTown(type, { mustBeInLocationRect: true, inLocationRect: true })); }
    else if (TOWN_LOCATION_TYPES.has(type)) towns++;
  }
  assert.equal(settled, 3_444, 'the Bay\'s cities, towns and villages');
  assert.equal(towns, 5_929, 'DFU\'s other towns - no settlements');
  // past the Bay: Arena's town of each kind and the countryside's, cloned off the game's rows at Cyrodiil's pixels
  const arena = arenaTemplates(rows), country = countryTemplates(rows);
  const cases = [
    ...['city-state', 'town', 'village'].map((kind, i) => [synthesizeArenaLocation(arenaTemplateOf(arena, { kind, provinceIndex: 1, id: 7 + i }), { kind, provinceIndex: 1, province: 'Cyrodiil', id: 7 + i, name: 'An Arena town', bx: 2050 + i, by: 640 }), 2050 + i, 640, true]),
    ...[[LOCATION_TYPES.TownVillage, true], [LOCATION_TYPES.TownHamlet, true], [LOCATION_TYPES.HomeFarms, false], [LOCATION_TYPES.Tavern, false], [LOCATION_TYPES.ReligionTemple, false], [LOCATION_TYPES.HomeWealthy, false]]
      .map(([type, want], i) => [synthesizeCountryLocation(country.get(type)[0], { px: 2100 + i, py: 700, type, name: 'A countryside place' }), 2100 + i, 700, want]),
  ];
  for (const [loc, px, py, want] of cases) {
    assert.ok(loc, `a place stood at ${px},${py}`);
    assert.equal(settledAt(mid(rectOf(loc, px, py)), new Map([[`${px},${py}`, loc]])), want, `${loc.mapTableData.locationType} at ${px},${py}`);
  }
});

test('ZONE-SAFE THE REFEREE (net/wild/wildRef.js, unchanged): a blow lands only where both fighters said they stand in the zone, so my word 0 in a settlement\'s streets refuses every blow and cast into them and out of them - the defender\'s own word protects the defender, and the relay needs no map (mutants: the defender\'s word unread; the striker\'s unread)', () => {
  const now = 1_000_000;
  for (const [aIn, bIn, ok] of [[true, true, true], [true, false, false], [false, true, false]]) {
    const st = newWildRef();
    // both stood in the zone - PIN MOVED (ZONE-GRACE, Wild-Zone.md section 3b): since before an entry's safe passage, which
    // refuses every player's blow its first minute; then each says where it stands now - 0 a step into a settlement's streets
    for (const [sub, id, x] of [['a', 'A', 0], ['b', 'B', SIEGE_UNITS_PER_M]]) wildZone(st, sub, { id, lv: 10 }, true, { x, y: 0, z: 0 }, now - WILD_GRACE.ms - 20_000);
    wildZone(st, 'a', { id: 'A', lv: 10 }, aIn, { x: 0, y: 0, z: 0 }, now - 10_000);
    wildZone(st, 'b', { id: 'B', lv: 10 }, bIn, { x: SIEGE_UNITS_PER_M, y: 0, z: 0 }, now - 10_000);
    const res = wildBlow(st, 'a', 'b', { d: 5, held: { w: -1, m: 0 } }, now);   // a fist, a pace apart
    assert.equal(res.why === 'zone', !ok, `striker ${aIn ? 'in the zone' : 'in the streets'}, defender ${bIn ? 'in the zone' : 'in the streets'}: ${res.why}`);
    if (ok) assert.ok(res.ok && res.dealt > 0, `both in the zone, in reach: the blow lands (${res.why})`);
  }
});

/** The host's own lines, run as they stand (scenes/world.js, read whole - test/hostText.mjs). */
const W = hostText('src/scenes/world.js');
const lineOf = (head) => { const i = W.indexOf(head); assert.ok(i >= 0, `the host holds ${head}`); return W.slice(i, W.indexOf('\n', i) + 1); };
const blockOf = (head) => { const i = W.indexOf(head); assert.ok(i >= 0, `the host holds ${head}`); return W.slice(i, W.indexOf('\n  };\n', i) + 5); };

test('ZONE-SAFE THE HOST\'S DOORS (scenes/world.js wildCan, wildFair - the four hosts: this one wired; dungeonContext.js reads its bodies and its strike through them; worldModes.js and exterior.js stand no fight): outdoors in a settlement\'s streets I may fight no one, so my word on the zone is 0 and no door of mine strikes; a body in the streets is no fair player for the melee arm, the arrows or the cast engine\'s marks; in a dungeon the zone fights as it did; a building fights no one (mutants: wildCan\'s streets unread; wildFair\'s body in the streets fair; the dungeon made safe)', () => {
  const cityPx = [207, 213], city = place(LOCATION_TYPES.TownCity), index = new Map([[cityPx.join(','), city]]);
  const r = rectOf(city, ...cityPx), inStreets = mid(r), outside = at(r.maxX + 3 * WORLD_MAP_RMB_DIM, (r.minZ + r.maxZ) / 2);
  const scope = {
    online: { wildOk: true, status: 'open', guildTagOf: () => null }, wildHere: () => true, wildOutdoors: () => scope.modes.mode === 'exterior',
    settledAt, campToWire: (p) => p, player: { feetAt: () => scope.me }, locationIndex: index, modes: { mode: 'exterior', deathUp: () => false },
    playerEntity: { health: 50 }, me: outside, peers: new Map(),
    wildKin, social: { isPartyPeer: () => false }, _wildTruce: { holds: () => false }, duelMgr: { live: false }, myGuildTag: () => null,
    wildAtWire: (p) => !!p, pvpFlag: { fair: () => true }, duelWorldOf: (id) => scope.peers.get(id) ?? null,
  };
  const body = `${lineOf('  const wildCan = () =>')}${blockOf('  const wildFair = (peerId) => {')}`;
  const { wildCan, wildFair } = new Function('S', `with (S) { ${body}\n return { wildCan, wildFair }; }`)(scope);
  scope.peers.set('out', outside); scope.peers.set('in', inStreets);
  assert.ok(wildCan(), 'the open country: I fight');
  assert.ok(wildFair('out'), 'a body in the open country is fair');
  assert.ok(!wildFair('in'), 'a body in the streets is no one\'s to strike');
  scope.me = inStreets;
  assert.ok(!wildCan(), 'in the streets: my word is 0 and I strike no one');
  assert.ok(!wildFair('out'), 'not even one outside');
  scope.me = outside; scope.modes.mode = 'dungeon';
  assert.ok(wildCan() && wildFair('in'), 'in a dungeon the zone\'s fights are as they were - a body\'s pose there is the dungeon\'s own frame, never a street');
  scope.me = inStreets;
  assert.ok(wildCan(), 'and my own pose too (the dungeon under a street is the dungeon\'s)');
  scope.modes.mode = 'interior';
  assert.ok(!wildCan(), 'under a roof no one fights');
  // the word the referee hears is wildCan's (INT9), and the dungeon's swing and casts read these same doors
  assert.match(W, /online\?\.setWildZone\?\.\(wildCan\(\) \? 1 : 0, playerEntity\.health <= 0\);/);
  assert.match(W, /wildBodies: \(\) => wildBodiesNow\(\),/);
  assert.match(W, /const wildBodiesNow = \(\) => \{\n {4}if \(!wildCan\(\)\) return NO_BODIES;\n {4}const out = \[\];\n {4}for \(const b of peersNear\(\) \?\? \[\]\) if \(wildFair\(b\.id\)\) out\.push\(b\);/);
  assert.match(W, /const wildStrikeOut = \(to, by, weapon, swing, drawMs = 0, \{ off = false \} = \{\}\) => \{\n {4}if \(!wildFair\(to\)\) return false;/);
  assert.match(W, /const wildSpellOut = \(peerId, sp\) => \{\n {4}if \(!wildFair\(peerId\)\) return false;/);
});

test('ZONE-SAFE THE TOWN WATCH NARROWED (scenes/world.js zoneWatchCall): no blow is struck in a settlement\'s streets nor under a roof, so the watch answers a blow at DFU\'s other towns alone - a farm, a manor, an inn, a temple - outdoors; ten times as strong as it was (mutants: the roof\'s arm back; the town unread)', () => {
  const crimes = [];
  const scope = {
    modes: { mode: 'exterior' }, town: true, _isPlayerInTownStrict: () => scope.town, wildHere: () => true, clock: 0, performance: { now: () => scope.clock },
    setCrimeCommitted: (_e, c) => crimes.push(c), playerEntity: {}, CRIMES: { Assault: 'assault' }, _crimeResponse: () => {}, townTalk: { say: () => {} },
  };
  const body = `${lineOf('  let _zoneWatchAt = -Infinity;')}${blockOf('  const zoneWatchCall = () => {')}`;
  const { zoneWatchCall } = new Function('S', `with (S) { ${body}\n return { zoneWatchCall }; }`)(scope);
  scope.modes.mode = 'interior'; scope.clock = 100_000;
  zoneWatchCall();
  assert.deepEqual(crimes, [], 'under a roof no blow is struck - the watch is never called there');
  scope.modes.mode = 'exterior'; scope.town = false;
  zoneWatchCall();
  assert.deepEqual(crimes, [], 'the open country has no watch');
  scope.town = true;
  zoneWatchCall();
  assert.deepEqual(crimes, ['assault'], 'a farm, a manor, an inn or a temple of the zone: Assault, and the watch comes');
  assert.match(W, /guardScale: \(\) => \(wildHere\(\) \? ZONE_WATCH_SCALE : 1\),/, 'the zone\'s watch stands ten times as strong, whatever the crime');
});

test('ZONE-SAFE THE WORDS (zoneSafe.js zoneSafeFrame, ZONE_SAFE_TEXT; the frame, the HUD\'s zone tile and tip, the classic row, the zone map\'s laws and the world map\'s key): into the streets in the zone, their peace said; out of them still in the zone, its end; leaving the zone from the streets, nothing of its own; a building keeps the word; the tile says Safe zone there; every word through the text core (mutants: the leave said outside the zone; a building a crossing; the tile\'s word unread; the tip\'s line unread; the legend\'s law unread; the frame\'s streets unread)', () => {
  const said = [];
  const say = (l) => said.push(l);
  zoneSafeFrame(true, false, say);
  assert.deepEqual(said, [], 'the open country: nothing');
  assert.equal(zoneSafeFrame(true, true, say), true);
  assert.deepEqual(said, [ZONE_SAFE_TEXT.enter], 'into the streets');
  assert.ok(zoneSafe());
  zoneSafeFrame(true, true, say);
  zoneSafeFrame(true, false, say, true);
  assert.equal(said.length, 1, 'a building in the same street keeps its word - no crossing');
  assert.ok(zoneSafe());
  zoneSafeFrame(true, false, say);
  assert.deepEqual(said.slice(1), [ZONE_SAFE_TEXT.leave], 'out of them, still in the zone');
  zoneSafeFrame(true, true, say);
  zoneSafeFrame(false, false, say);
  assert.deepEqual(said.slice(2), [ZONE_SAFE_TEXT.enter], 'leaving the zone from the streets says nothing of its own');
  assert.ok(!zoneSafe());
  // the frame's own line, run as it stands: outdoors in the streets, in the zone
  const city = place(LOCATION_TYPES.TownVillage), index = new Map([['207,213', city]]);
  const frameLine = lineOf('      zoneSafeFrame(here, ');
  const vr = rectOf(city, 207, 213);
  const fr = { zoneSafeFrame, settledAt, campToWire: (p) => p, player: { feetAt: () => fr.me }, locationIndex: index, wildOutdoors: () => fr.modes.mode === 'exterior', modes: { mode: 'exterior' }, here: true, me: at(vr.maxX + 3 * WORLD_MAP_RMB_DIM, vr.minZ), wildSay: say };
  const runFrame = () => new Function('S', `with (S) { ${frameLine} }`)(fr);
  said.length = 0;
  runFrame();
  assert.deepEqual(said, [], 'the open country beside the village: nothing');
  fr.me = mid(vr);
  runFrame();
  assert.deepEqual(said, [ZONE_SAFE_TEXT.enter], 'its streets');
  fr.modes.mode = 'interior'; fr.me = at(0, 0);
  runFrame();
  assert.ok(zoneSafe(), 'through a door: the word kept');
  fr.modes.mode = 'dungeon';
  runFrame();
  assert.deepEqual(said.slice(1), [ZONE_SAFE_TEXT.leave], 'down into a dungeon: the zone\'s again');
  // the tile, the tip, the classic row
  let tile = null;
  new Function('S', `with (S) { ${lineOf('  setHudZone(() => (wildHere() ?')} }`)({ setHudZone: (fn) => { tile = fn; }, wildHere: () => true, zoneSafe, ZONE_SAFE_TEXT, WILD_TEXT, zoneRingName, wildRing: () => 2, wildRingBonus, WILD_RINGS });
  setWildHere(true, 2);
  const me = { name: 'me' };
  setZoneEntity(me);
  zoneSafeFrame(true, false, quiet);
  assert.match(tile().name, /^Open PvP - /);
  assert.equal(statusTip({ key: 'wild', name: tile().name }, me).title, WILD_TEXT.chip);
  assert.ok(statusTip({ key: 'wild', name: tile().name }, me).lines.includes(ZONE_SAFE_TEXT.rule), 'the zone\'s tip says where its peace is');
  assert.equal(activeSpellIcons(me).other[0].displayName, WILD_TEXT.chip);
  zoneSafeFrame(true, true, quiet);
  assert.match(tile().name, /^Safe zone - /, 'in the streets the tile says so');
  assert.equal(statusTip({ key: 'wild', name: tile().name }, me).title, ZONE_SAFE_TEXT.chip);
  assert.ok(statusTip({ key: 'wild', name: tile().name }, me).lines.includes(ZONE_SAFE_TEXT.enter));
  assert.equal(activeSpellIcons(me).other[0].displayName, ZONE_SAFE_TEXT.chip, 'and the classic row');
  // the zone map's laws, beside the first; the world map's key
  const doc = { createElement: () => { const e = { children: [], style: {}, className: '', textContent: '', append: (...c) => e.children.push(...c), addEventListener: () => {} }; return e; }, createTextNode: (s) => ({ textContent: s }) };
  const legend = buildZoneLegend(/** @type {any} */ (doc));
  const find = (e, cls) => (e.className?.split(' ').includes(cls) ? e : e.children?.map((c) => find(c, cls)).find(Boolean));
  const laws = find(legend, 'hmwild-rules').children.map((c) => c.textContent);   // PIN MOVED (the merge with AUDIT TESA II M5: Cyrodiil's travel law among the laws)
  assert.deepEqual([laws[0], laws[1]], [ZONE_RULES[0], ZONE_SAFE_TEXT.rule], 'the settlements\' peace beside the first law');
  assert.deepEqual(laws.filter((l) => l !== ZONE_SAFE_TEXT.rule && ZONE_RULES.includes(l)), [...ZONE_RULES], 'every other law, in its order');
  assert.equal(laws.length, ZONE_RULES.length + 2, 'the zone\'s laws, the peace and the travel law');
  assert.match(rd('src/ui/heldMap.js'), /item\.title = this\._zoneLaws\(\) \? `\$\{WILD_TEXT\.chipTip\} \$\{ZONE_SAFE_TEXT\.rule\}` : ZONE_MAP_TEXT\.chipTipOffline\(\);/);   // PIN MOVED (the merge with AUDIT TESA II M5: online alone)
  // in the player's language
  tm.patchLocaleTable('de', 'Port_Strings', tm.loadStringTableCsv(rd('locales/de/Port_Strings.csv')));
  try {
    tm.setLocale('de');
    assert.equal(ZONE_SAFE_TEXT.chip, 'Sichere Zone');
    assert.match(ZONE_SAFE_TEXT.leave, /^Du verlässt die sicheren Straßen/);
  } finally { tm.setLocale(tm.BASE_LOCALE); }
  for (const key of ['wild.safe.chip', 'wild.safe.enter', 'wild.safe.leave', 'wild.safe.rule']) assert.match(rd('locales/en/Port_Strings.csv'), new RegExp(`^${key.replace(/\./g, '\\.')},`, 'm'), key);
});
