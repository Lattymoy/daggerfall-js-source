// FIELD BUGS 2026-09-29h (SPAWN-PLATE) - "Elite Dungeons that despawn stay on map. Got two of them like this that have
// despawned with no entrance anymore but are still marked on overworld map!"
//
// A spawn's time runs out (TTL1: seven days from first sight, two from its clearing - the ledger's clocks, never while
// the player is in it); the next build of its pixel takes it out of the index and builds the pixel EMPTY
// (_locationToBuild). The Overworld marks a FOUND spawn off the discovered-places store, which files it for good, and
// asked `tvSpawnGone` whether it was gone - which excused a spawn on a BUILT pixel ("one standing on built ground stands
// until that ground is next built", AUDIT OW5b D2). A pixel built after the clock ran out is built, and empty: the
// excuse kept the plate over bare grass, and its walk, whenever the traveller came within the grid of it.
//
// The pin runs the two host functions lifted off world.js, over the real ledger, through the report's own sequence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSpawnLedger, GENERAL_TTL_MINUTES, CLEARED_TTL_MINUTES } from '../../src/world/spawnedDungeons.js';

const W = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
const lift = (re, what) => { const m = re.exec(W); assert.ok(m, `${what} moved`); return m[1]; };
const GONE = lift(/\n {2}(const tvSpawnGone = [^\n]*;)\n/, 'tvSpawnGone');
const TO_BUILD = lift(/\n {2}(function _locationToBuild\(px, py\) \{\n[\s\S]*?\n {2}\})\n/, '_locationToBuild');

function host() {
  const ledger = createSpawnLedger();
  const locationIndex = new Map();
  const built = new Map();
  const env = { clock: 0, inside: null };
  // eslint-disable-next-line no-new-func
  // PIN MOVED (ETHER-PLACES): the builder answers an Eltheric pixel by its isle first (world.js etherPlaceAt) - with the
  // Eltheric Ocean off (`etherSea` false) it never asks, and the Bay's pixels are this pin's
  const make = new Function('_spawnLedger', '_spawnClock', '_insideSpawn', 'built', 'locationIndex', 'spawnedDungeonAt', 'bump',
    `const etherSea = false; let _locIndexGen = 0; ${GONE}\n${TO_BUILD}\nreturn { tvSpawnGone, _locationToBuild };`);
  const fns = make(ledger, () => env.clock, (key) => key === env.inside, built, locationIndex, () => null);
  /** the pixel built (world.js buildPixel: `location: dfLocation ? dfLocation.name : null`) */
  const build = (px, py) => { const loc = fns._locationToBuild(px, py); built.set(`${px},${py}`, { location: loc ? loc.name : null }); return loc; };
  return { ledger, locationIndex, built, env, build, gone: fns.tvSpawnGone };
}

test('SPAWN-PLATE: an Elite past its time is off the map once its pixel stands empty - the report\'s sequence (mutant: built ground read as standing)', () => {
  const h = host();
  const elite = { name: 'Elite Castle Fenwick', spawned: true };
  // found and stood: the first sight starts the seven days, the pixel is built with the dungeon on it
  h.locationIndex.set('40,50', elite);
  h.ledger.note('40,50', 0);
  assert.equal(h.build(40, 50), elite, 'built with its entrance');
  assert.equal(h.gone(40, 50), false, 'a plate: it stands');
  // the seven days run out while the traveller is elsewhere, the ground still as it was built
  h.env.clock = GENERAL_TTL_MINUTES + 60;
  assert.equal(h.gone(40, 50), false, 'AUDIT OW5b D2 kept: still standing on the ground built before its time ran out');
  // the traveller comes back: the pixel is built again, and the spawn is taken out - the ground is empty
  assert.equal(h.build(40, 50), null, 'no entrance anymore');
  assert.equal(h.locationIndex.has('40,50'), false, 'out of the index');
  assert.equal(h.gone(40, 50), true, 'and off the map - no plate over bare grass, no walk to it');
});

test('SPAWN-PLATE: the cleared clock too, and never while the player stands in it (TTL1)', () => {
  const h = host();
  h.locationIndex.set('7,8', { name: 'Elite Mines of Ruin', spawned: true });
  h.ledger.note('7,8', 0);
  h.ledger.clear('7,8', 100);
  h.build(7, 8);
  h.env.clock = 100 + CLEARED_TTL_MINUTES;
  h.env.inside = '7,8';
  assert.equal(h.build(7, 8)?.name, 'Elite Mines of Ruin', 'the player inside: it stands whatever its clocks say');
  assert.equal(h.gone(7, 8), false);
  h.env.inside = null;
  h.build(7, 8);
  assert.equal(h.gone(7, 8), true, 'two days after its clearing, built again: gone');
  assert.equal(h.gone(9, 9), false, 'a pixel the ledger never met is never gone');
  h.built.set('7,8', { location: '' });   // what stands is the build's word, whatever its name spells
  assert.equal(h.gone(7, 8), false, 'a location stood is standing');
});
