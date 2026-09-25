// SPAWN-TRAVEL (2026-09-25, a crash report: "Error finding location Daggerfall : The Jubul Monastery (208,189)"):
// Travel Options' nearby pause discovers the location the autopilot stopped beside, and the world host filed it
// BY NAME through PlayerGPS.DiscoverLocation's throwing lookup. An online spawned dungeon is a template's clone
// named "<name> (x,y)" and stands in no MAPS table, so the lookup threw out of the travel frame. The hook now files
// the location it already holds by its own id - the write the pixel-entry discovery makes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnedMapId } from '../src/world/spawnedDungeons.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('SPAWN-TRAVEL: the travel hook files a spawned dungeon by its own id and never asks the name lookup that threw (the host\'s hook, lifted and run; mutants: the name path back, the id dropped)', () => {
  const world = rd('src/scenes/world.js');
  const m = /\n {4}discoverLocation: (\(loc\) => \{[^\n]*\}),\n/.exec(world);
  assert.ok(m, 'the travel deps\' discoverLocation hook');
  const filed = [];
  const questWorld = { discoverLocation: () => { throw new Error('Error finding location'); } };   // the name path, as it answers a spawned name
  const hook = new Function('discoverLocation', 'questWorld', `return ${m[1]};`)((id, info) => { filed.push([id, info]); return true; }, questWorld);
  const id = spawnedMapId(1, 208, 189);
  assert.doesNotThrow(() => hook({ mapId: id, locationType: 7, name: 'The Jubul Monastery (208,189)', regionName: 'Daggerfall' }));
  assert.deepEqual(filed, [[id, { regionName: 'Daggerfall', locationName: 'The Jubul Monastery (208,189)' }]], 'filed by its id, with its names');
  hook(null);
  hook({ name: 'nowhere', regionName: 'Daggerfall' });
  assert.equal(filed.length, 1, 'no location, or none with an id: nothing filed');
  // the location it is handed carries the id - the hook above reads the travel deps' own currentLocation
  assert.match(world, /currentLocation: \(\) => \(_musicLoc \? \{ mapId: _musicLoc\.mapTableData\?\.mapId, locationType: _musicLoc\.mapTableData\?\.locationType, name: _musicLoc\.name, regionName: _musicLoc\.regionName \} : null\),/);
  // ...and Travel Options hands that very object on at the nearby pause
  assert.match(rd('src/systems/travelOptions.js'), /const loc = deps\.currentLocation\?\.\(\) \?\? null;[\s\S]{0,400}deps\.discoverLocation\?\.\(loc\);/);
});
