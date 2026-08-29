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

import { WINDMILL_MODELS, ROTOR_HUB } from '../src/world/windmills.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, f), 'utf8');

const EXTERIOR_HOSTS = ['src/scenes/exterior.js', 'src/scenes/world.js'];

test('WM2b: both exterior hosts select mills, mount the rotor, and draw it', () => {
  for (const host of EXTERIOR_HOSTS) {
    const text = src(host);
    assert.match(text, /WINDMILL_MODELS\[placed\.modelIdNum\]/,
      `${host} does not select placed mills by model id`);
    assert.match(text, /mountRotor\(/, `${host} never mounts the rotor`);
    assert.match(text, /advanceRotor\(/, `${host} never advances the rotor`);
    // The draw must go through mountRotor, not rotorMatrix: the vendored
    // geometry is origin-centred, and conjugating it ORBITS the sail
    // around the hub instead of turning it (pinned in windmills.test.js).
    assert.doesNotMatch(text, /rotorMatrix\(/,
      `${host} uses the conjugating transform on origin-centred geometry - the sail will orbit`);
    assert.match(text, /drawMesh\(\s*rotorMesh/,
      `${host} advances an angle it never draws`);
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
  assert.match(src('src/scenes/exterior.js'), /windmills\.length \? await getRotorMesh\(\) : null/,
    'exterior.js uploads the rotor even when no mill was placed');
  const pipeline = src('src/scenes/dataPipeline.js');
  assert.match(pipeline, /if \(gpuMeshes\.has\(ROTOR_KEY\)\) return gpuMeshes\.get\(ROTOR_KEY\);/,
    'getRotorMesh no longer caches - every mill would upload its own copy');
  assert.match(pipeline, /const ROTOR_KEY = -\d+;/,
    'the rotor cache key must be one no ARCH3D record id can collide with');
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
  // The flag says interiors and dungeons never place model 41600 because
  // RMB building models are exterior. If that ever stops being true the
  // flag is a lie, so it is checked rather than asserted in prose.
  for (const host of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    const text = src(host);
    assert.doesNotMatch(text, /WINDMILL_MODELS/,
      `${host} now knows about mills - the four-hosts record must be updated`);
    for (const id of Object.keys(WINDMILL_MODELS)) {
      assert.doesNotMatch(text, new RegExp(`\\b${id}\\b`),
        `${host} references model ${id} - it may be placing a mill the record says it cannot`);
    }
  }
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
