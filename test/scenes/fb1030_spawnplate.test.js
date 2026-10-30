// FIELD BUGS 2026-10-30b SPAWN-PLATE (bible/01-Overview/bugs/Field-Bugs-2026-10-30b.md section 4): "Dungeon Titles
// stacked on top of each other ... happens only to procedurally generated dungeons ... mainly in the new areas of the
// map". Past the Bay a found spawned dungeon within the Overworld's grid stood two plates on one spot - the place's
// (travelViewPlaces, its name and its tier) and the dungeons' (nearDungeons' `spawn:`, its name, its tier and its
// distance) - and their second lines overlapped. On the Bay a spawn has no MAPS.BSA row, so it only ever had the second.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nearDungeons } from '../../src/systems/travel/travelDungeons.js';
import { synthesizeDungeonLocation, WORLD_SALT } from '../../src/world/spawnedDungeons.js';

const W = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
/** world.js's travelViewPlaces, as written, over `env`. */
function travelViewPlacesOf(env) {
  const at = W.indexOf('  function travelViewPlaces() {');
  const end = W.indexOf('\n  }\n', at);
  assert.ok(at > 0 && end > at, 'travelViewPlaces stands in bootWorld');
  // eslint-disable-next-line no-new-func
  return new Function(...Object.keys(env), `${W.slice(at, end + 4)}\nreturn travelViewPlaces;`)(...Object.values(env));
}

test('SPAWN-PLATE a found spawned dungeon within the Overworld\'s grid stands one plate - the dungeons\' - past the Bay as on the Bay; a town keeps the place\'s; past the twelve nearest too (mutants: the spawn platted twice; a found spawn in the grid capped)', () => {
  const template = { name: 'The Hold of Gaerfeld', regionIndex: 63, mapTableData: { mapId: 1, locationType: 7 }, exterior: { exteriorData: {} }, dungeon: { recordElement: { header: {} } } };
  const at = { x: 3286, y: 546 };   // the report's: past the Bay
  const spawn = synthesizeDungeonLocation(template, { salt: WORLD_SALT, px: at.x, py: at.y });
  const town = { name: 'Leyawiin', spawned: undefined, mapTableData: { mapId: 2 } };
  const places = new Map([[`${at.x},${at.y}`, spawn], [`${at.x + 1},${at.y}`, town]]);
  const summaryOf = (x, y) => { const loc = places.get(`${x},${y}`); return loc ? { pixel: { x, y }, name: loc.name, mapId: loc.mapTableData.mapId, loc } : null; };
  const travelViewPlaces = travelViewPlacesOf({
    playerTravelPixel: () => at, tvKnownGen: () => 0, tvPlates: { at: null, dg: -1, list: [] }, state: { terrainDistance: 1 },
    tvPlaceSummary: summaryOf, tvPlaceRect: () => ({ cx: 0, cz: 0 }),
  });
  assert.deepEqual(travelViewPlaces().map((p) => p.summary.name), ['Leyawiin'], 'the town keeps its plate, the spawn wears none of the places\'');
  const dungeons = nearDungeons({ at, dungeons: [], locAt: () => null, isFound: () => true, spawns: [{ x: at.x, y: at.y, loc: spawn }], spawnKnown: () => true, spawnFound: () => true, grid: 1 });
  assert.deepEqual(dungeons.map((g) => [g.key, g.loc.name]), [[`spawn:${spawn.mapTableData.mapId}`, 'The Hold of Gaerfeld (3286,546)']], 'its one plate: the dungeons\'');
  // AUDIT FB1030 Z1: every found spawn inside the grid keeps its one plate - past the twelve the cap kept, it had none
  const many = [];
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) many.push({ x: at.x + dx, y: at.y + dz, loc: { name: `S${dx},${dz}`, mapTableData: { mapId: 5000 + (dx + 3) * 7 + dz + 3 } } });
  const plated = nearDungeons({ at, dungeons: [], locAt: () => null, isFound: () => true, spawns: many, spawnKnown: () => true, spawnFound: () => true, grid: 3 });
  assert.equal(plated.length, 49, 'all 49 found spawns of a 7 x 7 grid plated');
  // the Bay's: a spawn on a Bay pixel is no place's plate either
  const bay = { x: 200, y: 300 }, bs = synthesizeDungeonLocation(template, { salt: WORLD_SALT, px: bay.x, py: bay.y });
  places.set(`${bay.x},${bay.y}`, bs);
  const onBay = travelViewPlacesOf({ playerTravelPixel: () => bay, tvKnownGen: () => 0, tvPlates: { at: null, dg: -1, list: [] }, state: { terrainDistance: 1 }, tvPlaceSummary: summaryOf, tvPlaceRect: () => ({ cx: 0, cz: 0 }) });
  assert.deepEqual(onBay(), [], 'on the Bay too');
});
