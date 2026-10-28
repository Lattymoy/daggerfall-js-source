// TESA-LANDS' audit (bible/03-World/Tamriel-Biomes.md, "The air a body feels"; the owner: "Definitely fix any bugs you
// encounter") - THE AIR A BODY FEELS past the Bay. TESA-BIOME gave Morrowind's zones their ground's climate (the grey
// volcanic sets) and their air's (`air` - the air law's map, systems/weather/airGround.js), and the survival law read the
// ground's: the Ashlands felt the Mountains' -40 under the Dak'fron's air, -45 and Freezing at noon in Frostfall, and the
// headless probe's character froze to death in a walk across it. world/tamriel/tamrielGround.js feltClimateIndex is the
// climate the hosts hand the survival law: a zone's air where it names one, the hosts' map's everywhere else.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feltClimateIndex } from '../../src/world/tamriel/tamrielGround.js';
import { BIOMES, tamrielBiomeAt } from '../../src/world/tamriel/tamrielBiomes.js';
import { tamrielFrameInBay } from '../../src/world/tamriel/tamrielFrame.js';
import { naturalTemperature, temperatureWord } from '../../src/systems/survival/temperature.js';
import { CLIMATES } from '../../src/formats/mapsFile.js';

/** A pixel of zone `key` on the continent's frame (every 3rd), or null. */
function pixelOf(key) {
  const f = tamrielFrameInBay();
  for (let y = Math.ceil(f.y0); y < f.y0 + f.h; y += 3) for (let x = Math.ceil(f.x0); x < f.x0 + f.w; x += 3) if (tamrielBiomeAt(x, y)?.key === key) return [x, y];
  return null;
}
/** The hosts' map past the Bay: a zone's ground climate (tamrielGround.js groundClimateIndex's). */
const ground = (x, y) => tamrielBiomeAt(x, y)?.climate ?? CLIMATES.Woodlands;

test('TESA-LANDS\' AUDIT: THE AIR A BODY FEELS - past the Bay a zone\'s air where it names one (every one of them), its ground\'s where it names none, the Bay\'s map on the Bay; the Ashlands at noon in Frostfall warm, not Freezing (mutants: the ground\'s read; the hosts\' lines)', () => {
  const ash = pixelOf('morrowindAshlands'), pine = pixelOf('skyrimPinewood');
  assert.ok(ash && pine);
  assert.equal(feltClimateIndex(...ash, ground(...ash)), CLIMATES.Desert2, 'the Ashlands: the Dak\'fron\'s air');
  assert.equal(feltClimateIndex(...pine, ground(...pine)), ground(...pine), 'a zone naming no air: its ground\'s');
  assert.equal(feltClimateIndex(100, 100, 231), 231, 'the Bay: the map\'s');
  let named = 0;
  for (const b of BIOMES) {
    if (b.air == null) continue;
    const at = pixelOf(b.key);
    if (!at) continue;
    named++;
    assert.equal(feltClimateIndex(...at, ground(...at)), b.air, `${b.key}: its air`);
  }
  assert.ok(named >= 8, `the zones that name their air (${named})`);
  // noon in Frostfall under a clear sky (systems/survival/temperature.js - the Climates & Calories law)
  const noon = (c) => naturalTemperature({ climateIndex: c, month: 9, hour: 12, weather: 'sunny' });
  assert.equal(noon(ground(...ash)), -45, 'as it read: the ground\'s Mountains');
  assert.equal(temperatureWord(noon(ground(...ash))), 'freezing');
  assert.equal(noon(feltClimateIndex(...ash, ground(...ash))), 45, 'its air: the Dak\'fron\'s noon');
  const asc = pixelOf('morrowindAscadian');
  assert.ok(noon(feltClimateIndex(...asc, ground(...asc))) > 0, 'the Ascadian Isles\' subtropical air warm');
});
