// WM2b — THE SAILS, WIRED. Source sweeps over the two exterior hosts.
//
// These are source pins and not behaviour pins for R5's reason, which
// this arc has quoted twice and now has to live by: R5 wired a paint
// into buildPixel, lint passed, the build passed, 4,283 tests passed,
// and the world host was dead on its first terrain load - because
// NOTHING IN THE SUITE DRIVES THAT PATH. It wants GL and ARENA2, and
// this container has neither. So the wiring is held the way roadsboot
// holds its own: by reading the hosts.
//
// What they cannot tell you is whether the sail LOOKS right - whether
// it hangs on the classic tower rather than beside it. That is a
// one-look question and it is recorded as outstanding, not pinned here
// as though it were settled.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { ROTOR_HUB } from '../src/world/windmills.js';
import { PLACEMENTS, BODY, ROTOR } from '../src/world/windmillMesh.js';
import { windmillsFor } from '../src/world/rmbLayout.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, f), 'utf8');

const EXTERIOR_HOSTS = ['src/scenes/exterior.js', 'src/scenes/world.js'];

test('WM2b: both exterior hosts select mills, mount the rotor, and draw it', () => {
  for (const host of EXTERIOR_HOSTS) {
    const text = src(host);
    assert.match(text, /b\.layout\.windmills/,
      `${host} does not read the mills rmbLayout places`);
    assert.match(text, /getWindmillMeshes\(\)/, `${host} never uploads the mill`);
    assert.match(text, /mountRotor\(/, `${host} never mounts the rotor`);
    assert.match(text, /advanceRotor\(/, `${host} never advances the rotor`);
    // The draw must go through mountRotor, not rotorMatrix: the vendored
    // geometry is origin-centred, and conjugating it ORBITS the sail
    // around the hub instead of turning it (pinned in windmills.test.js).
    assert.doesNotMatch(text, /rotorMatrix\(/,
      `${host} uses the conjugating transform on origin-centred geometry - the sail will orbit`);
    assert.match(text, /drawMesh\(\s*millParts\.rotor|drawMesh\(millParts\.rotor/,
      `${host} advances an angle it never draws`);
    // ...and the TOWER must be drawn too, or the sail turns in mid-air.
    assert.match(text, /millParts\.body|parts\.body/, `${host} draws no tower`);
    assert.match(text, /isEnhanced\(\)/, `${host} does not gate mills on the enhanced skin`);
  }
});

test('WM2b: a mill only turns on a wind the sky actually knows', () => {
  // sky.wind() is null under the classic sky, which eases nothing. Null
  // is "no wind is known", NOT "the wind is zero" - so the guard is on
  // the row's existence, and a mill stands still rather than guessing.
  for (const host of EXTERIOR_HOSTS) {
    const text = src(host);
    assert.match(text, /sky\.wind\(\)/, `${host} does not read the eased wind`);
  }
  assert.match(src('src/scenes/shared.js'), /wind\(\)\s*\{\s*\n?\s*return weatherRowNow \? weatherRowNow\.wind : null;/,
    'the sky controller no longer answers the eased wind, or answers zero instead of null');
  // world.js reads it ONCE a frame rather than once a mill.
  assert.match(src('src/scenes/world.js'), /const windNow = sky\.wind\(\);/,
    'world.js should read the wind once per frame, not per mill');
});

test('WM2b: the rotor is uploaded lazily, and once', () => {
  // A town with no farm block must pay nothing, and a location with
  // twenty mills must upload one mesh.
  assert.match(src('src/scenes/exterior.js'), /millCount && isEnhanced\(\)\) \? await getWindmillMeshes\(\) : null/,
    'exterior.js uploads the mill even when no block here stands one');
  const pipeline = src('src/scenes/dataPipeline.js');
  assert.match(pipeline, /if \(gpuMeshes\.has\(key\)\) return gpuMeshes\.get\(key\);/,
    'the mill parts no longer cache - every mill would upload its own copy');
  assert.match(pipeline, /const ROTOR_KEY = -\d+, BODY_KEY = -\d+;/,
    'the mill cache keys must be ones no ARCH3D record id can collide with');
});

test('WM2b: the streaming host phases mills on the MAP PIXEL, not the world', () => {
  // The floating origin shifts the world under the player. A phase keyed
  // on world position would re-seed every mill on every origin shift -
  // every windmill in sight jumping to a new angle as you walk.
  assert.match(src('src/scenes/world.js'), /rotorPhase\(px \+ local\[12\], py \+ local\[14\]\)/,
    'world.js phases mills on something other than the map pixel + local offset');
});

test('WM2b: THE FOUR HOSTS RULE - the record names all four by name', () => {
  // 17e: a slice wiring a seam into one host must name ALL FOUR in its
  // record, each either wired or FLAGGED. Windmills are exterior
  // scenery, so two are wired and two are deliberately not - and
  // "deliberately" only counts if it is written down.
  const arc = src('bible/03-World/World-Arc.md');
  const record = arc.slice(arc.indexOf('### WM2b'));
  assert.ok(record.length > 400, 'the WM2b record is missing from World-Arc.md');
  for (const host of ['exterior.js', 'world.js', 'worldModes.js', 'dungeonContext.js']) {
    assert.ok(record.includes(host), `the WM2b record does not name ${host}`);
  }
});

test('WM2b: the two unwired hosts really do not place mills', () => {
  // The record says interiors and dungeons never stand a mill, because
  // mills are exterior scenery. Checked rather than asserted in prose.
  for (const host of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    const text = src(host);
    assert.doesNotMatch(text, /windmillMesh|getWindmillMeshes|layout\.windmills/,
      `${host} now knows about mills - the four-hosts record must be updated`);
  }
});

test('WM2d: the placement is real, and lives where every other model\'s does', () => {
  // The bug WM2b shipped was a rotor hung on a placement that never
  // happened. So the placement itself is pinned: the six farm blocks
  // each stand exactly one mill, and a block that is not one stands none.
  const blocks = new Set(PLACEMENTS.map((p) => p.block));
  assert.equal(blocks.size, PLACEMENTS.length, 'two placements claim the same block');
  assert.ok(PLACEMENTS.length >= 6, `only ${PLACEMENTS.length} mills placed`);
  for (const b of blocks) {
    const mills = windmillsFor(b);
    assert.equal(mills.length, 1, `${b} stands ${mills.length} mills`);
    assert.equal(mills[0].matrix.length, 16, 'a placement without a matrix');
  }
  assert.deepEqual(windmillsFor('CITYAA00.RMB'), [], 'a city block stands a windmill');
  assert.deepEqual(windmillsFor(undefined), [], 'an unnamed block stands a windmill');

  // The mill's FEET must land near the block's ground, not float or sink:
  // the placement's own Y against the tower's own base.
  for (const b of blocks) {
    const m = windmillsFor(b)[0].matrix;
    const footY = m[13] + BODY.bounds.min[1];
    assert.ok(Math.abs(footY) < 1.5, `${b}'s mill has its feet at y=${footY.toFixed(2)}`);
  }
  // ...and the layout math is rmbLayout's own, not a copy in a host.
  for (const host of EXTERIOR_HOSTS) {
    assert.doesNotMatch(src(host), /ROTATION_DIVISOR/,
      `${host} rebuilds the placement matrix instead of using rmbLayout's`);
  }
  assert.ok(ROTOR.subMeshes.length && BODY.subMeshes.length);
});

test('WM2b: the hub the hosts mount at is the module\'s, not a copy', () => {
  // ONE DFU MEMBER, ONE EXPORT (17e). A host spelling the offset out
  // would drift from the module the day the classic tower is measured.
  for (const host of EXTERIOR_HOSTS) {
    const text = src(host);
    assert.match(text, /ROTOR_HUB/, `${host} does not use the exported hub`);
    assert.doesNotMatch(text, /3\.96/, `${host} spells the hub offset out instead of importing it`);
  }
  assert.deepEqual([...ROTOR_HUB], [3.96, 6.01, -5.5]);
});
