// WATER-FOES (2026-10-04, from the field: "Enemies in the water on a boat shouldn't slow down your ship or prevent you
// from resting when on board") - a foe in the water reaches no one aboard (systems/foeReach.js), and the one sweep every
// "enemies nearby" asks (systems/encounters.js areEnemiesNearby - the helm's time scale, rest, a journey, the travel
// view, a camp's placing) passes it over; the Overworld's threats too. bible/03-World/Come-Sail-Away.md.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { foeInWater, markFoeReach } from '../src/systems/foeReach.js';
import { areEnemiesNearby } from '../src/systems/encounters.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const SEA = 34;
/** A foe that sees the player, feet at `y` (its centre `c` over them), aquatic or not. */
const foe = (y, { swims = false, c = 0.9, sees = true } = {}) => ({
  dead: false, entity: null,
  ai: { feet: [0, y, 0], centreOffset: c, swims, detected: sees, inSight: sees, wouldBeSpawned: true, _dist: 30, isHostile: true },
});

test('WATER-FOES IN THE WATER: an aquatic foe wherever it is, any other whose centre stands under the sea\'s top - never one on a deck or the shore, nor a shape with no ai or no height', () => {
  assert.equal(foeInWater(foe(SEA - 6, { swims: true }), SEA), true, 'a slaughterfish down in the deep');
  assert.equal(foeInWater(foe(SEA + 2, { swims: true }), SEA), true, 'an aquatic foe is the water\'s wherever it lies');
  assert.equal(foeInWater(foe(SEA - 1.5), SEA), true, 'a bandit waded in to his chest');
  assert.equal(foeInWater(foe(SEA - 0.5), SEA), false, 'one ankle-deep stands on the bottom, its centre over the sea');
  assert.equal(foeInWater(foe(SEA - 0.9, { c: 0.9 }), SEA), false, 'its centre at the very top is not under it');
  assert.equal(foeInWater(foe(SEA + 1.2), SEA), false, 'a boarder on a deck');
  assert.equal(foeInWater({ ai: null }, SEA), false);
  assert.equal(foeInWater(foe(NaN), SEA), false, 'no height, no answer');
  assert.equal(foeInWater(foe(SEA - 3), NaN), false, 'no sea, no water');
});

test('WATER-FOES THE LATCH: aboard, each foe in the water is unreachable and every other reachable; not aboard (ashore, or swimming - the host\'s word), none is', () => {
  const fish = foe(SEA - 5, { swims: true }), wader = foe(SEA - 1.5), boarder = foe(SEA + 1.2), shore = foe(SEA + 4);
  const all = [fish, wader, boarder, shore];
  markFoeReach(all, { aboard: true, seaY: SEA });
  assert.deepEqual(all.map((f) => f.ai.unreachable), [true, true, false, false]);
  markFoeReach(all, { aboard: false, seaY: SEA });
  assert.deepEqual(all.map((f) => f.ai.unreachable), [false, false, false, false], 'off the boat it is cleared, never left standing');
  markFoeReach([null, { ai: null }, fish], { aboard: true, seaY: SEA });
  assert.equal(fish.ai.unreachable, true, 'a hole in the pool is passed over');
});

test('WATER-FOES THE SWEEP: AreEnemiesNearby passes over an unreachable foe - strict (the helm\'s time scale, a journey, the travel view) and resting alike - and counts it the moment it is reachable again (mutant: the skip removed)', () => {
  const fish = foe(SEA - 5, { swims: true });
  assert.equal(areEnemiesNearby([fish]), true, 'a fish that sees you counts, as DFU counts it');
  assert.equal(areEnemiesNearby([fish], { resting: true }), true);
  markFoeReach([fish], { aboard: true, seaY: SEA });
  assert.equal(areEnemiesNearby([fish]), false, 'aboard: no enemy nearby');
  assert.equal(areEnemiesNearby([fish], { resting: true }), false, 'and rest is not refused');
  assert.equal(areEnemiesNearby([fish, foe(SEA + 1.2)]), true, 'a boarder on the deck still counts');
  markFoeReach([fish], { aboard: false, seaY: SEA });
  assert.equal(areEnemiesNearby([fish]), true, 'swimming or ashore, it counts again');
});

test('WATER-FOES THE WORLD\'S WIRING by source: the reach latched over the watch and the street\'s foes every exterior frame after they moved (the deck\'s leash, the spacing and the doorways, the watch, the raids), aboard meaning afloat and not swimming, on the sea\'s top; the Overworld\'s threats pass an unreachable foe over - THE FOUR HOSTS: the street alone (a building has no water foe, a dungeon\'s flooded halls carry no boat of the port\'s yet, the standalone street no sea)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /if \(playerSpawned\) raidingPartiesFrame\(gamePaused\(\) \? 0 : foeDt\);[^\n]*\n\s+markFoeReach\(\[\.\.\.cityGuards\.guards, \.\.\.exteriorFoes\.foes\], \{ aboard: playerAfloat\(\) && !\(walkMode && playerSpawned && player\.isPlayerSwimming\), seaY: tvSeaY\(\) \}\);/);
  assert.equal((w.match(/markFoeReach\(/g) ?? []).length, 1, 'one latch');
  assert.match(w, /if \(!foeAlerted\(f\) \|\| !f\.ai\.feet \|\| f\.ai\.unreachable\) continue;/);   // WILD-ALERT: an alerted foe alone holds the clock
  for (const host of ['src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) assert.ok(!read(host).includes('markFoeReach'), `${host}: no latch`);
  assert.match(read('src/systems/encounters.js'), /if \(!f \|\| f\.dead \|\| !f\.ai\) continue;\n[^\n]*\n[^\n]*\n\s+if \(f\.ai\.unreachable\) continue;/);
});
