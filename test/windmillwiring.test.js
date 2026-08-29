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
import { skinnedBody } from '../src/world/windmills.js';
import { windmillsFor, attachWindmillRecord } from '../src/world/rmbLayout.js';
import { WINDMILL_INTERIOR } from '../src/world/windmillInterior.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, f), 'utf8');

const EXTERIOR_HOSTS = ['src/scenes/exterior.js', 'src/scenes/world.js'];

test('WM2b: both exterior hosts select mills, mount the rotor, and draw it', () => {
  for (const host of EXTERIOR_HOSTS) {
    const text = src(host);
    assert.match(text, /b\.layout\.windmills/,
      `${host} does not read the mills rmbLayout places`);
    assert.match(text, /getWindmillMeshes\(/, `${host} never uploads the mill`);
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
  assert.match(src('src/scenes/exterior.js'), /millCount && isEnhanced\(\)\)\s*\?\s*await getWindmillMeshes\(/,
    'exterior.js uploads the mill even when no block here stands one');
  const pipeline = src('src/scenes/dataPipeline.js');
  assert.match(pipeline, /if \(gpuMeshes\.has\(key\)\) return gpuMeshes\.get\(key\);/,
    'the mill parts no longer cache - every mill would upload its own copy');
  assert.match(pipeline, /const ROTOR_KEY = -\d+;/,
    'the rotor cache key must be one no ARCH3D record id can collide with');
  assert.match(pipeline, /bodyKey = \(climateBase, isWinter\) => -\(/,
    'the body is cached per climate and season, under a negative key');
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

test('WM2e: the mill is skinned for the climate it stands in', () => {
  // Kamer ships seventeen variant prefabs; only the WALLS and the ROOF
  // differ across them, and DESERT NEVER WINTERS - his prefabs and
  // ClimateSwaps.cs's own rule agreeing.
  for (const host of EXTERIOR_HOSTS) {
    assert.match(src(host), /getWindmillMeshes\(climateBase, season === SEASON\.Winter\)/,
      `${host} uploads the mill without telling it which climate it stands in`);
  }
  const tex = (m) => m.subMeshes.map((sm) => `${sm.textureArchive}_${sm.textureRecord}`);
  assert.deepEqual(tex(skinnedBody(300, false)), ['364_2', '67_1', '369_3', '67_1', '332_0'],
    "the temperate mill is not the one Kamer authored");
  assert.deepEqual(tex(skinnedBody(300, true)), ['365_1', '67_1', '103_1', '67_1', '332_0'],
    'winter must change the walls and the roof, and only those');
  assert.deepEqual(tex(skinnedBody(0, false)), tex(skinnedBody(0, true)),
    'the desert mill wintered - it must not');
  assert.deepEqual(tex(skinnedBody(999, false)), tex(BODY),
    'an unknown climate must keep the mill as authored, not strip its textures');
  // Only the two slots ever move, in every climate.
  for (const base of [0, 100, 300, 400]) {
    const a = tex(skinnedBody(base, false)), b = tex(skinnedBody(base, true));
    for (const i of [1, 3, 4]) assert.equal(a[i], b[i], `slot ${i} changed with the season and must not`);
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

test('WM2f: the mill comes with the building that carries its door', () => {
  // Mac: "the door is covered and I can't enter it". Kamer's subrecord
  // places TWO models - a CLASSIC building (118) and the mill beside it
  // - and WM2d read only the mill, so the structure with the real door
  // was never placed at all. His subrecord headers declare
  // Num3dObjectRecords 1 while carrying 2, the same hand-edit slip as
  // the subrecord counts, which is how the second record went unread.
  for (const p of PLACEMENTS) {
    assert.ok(p.building, `${p.block} places a mill with no building`);
    assert.equal(p.building.modelIdNum, 118, 'the companion is classic model 118');
  }
  for (const b of new Set(PLACEMENTS.map((p) => p.block))) {
    const [mill] = windmillsFor(b);
    assert.ok(mill.building, `${b} lost its building on the way through the layout`);
    assert.equal(mill.building.matrix.length, 16);
    // Beside the mill, not on top of it and not across the farm.
    const d = Math.hypot(mill.matrix[12] - mill.building.matrix[12],
      mill.matrix[14] - mill.building.matrix[14]);
    assert.ok(d > 2 && d < 20, `${b}: the building is ${d.toFixed(1)} units from its mill`);
  }
});

test('WM2f: the building rides the ordinary model path, and the 1:1 lane never sees it', () => {
  // It is a placed model like any other, so it takes its mesh, climate
  // swap, collider and door geometry from the paths that already exist -
  // which is also how it would leak into the classic skin, since those
  // paths know nothing about the enhanced one. Hence the flag.
  const layout = readFileSync(join(root, 'src/world/rmbLayout.js'), 'utf8');
  assert.match(layout, /models\.push\(w\.building\)/, 'the building is not placed as an ordinary model');
  assert.match(layout, /enhancedOnly: true/, 'the building is not marked as an enhanced-skin departure');
  for (const host of EXTERIOR_HOSTS) {
    assert.match(src(host), /placed\.enhancedOnly && !isEnhanced\(\)/,
      `${host} would draw the mill's building on the classic skin`);
  }
  // WM2g: and it DOES claim a recordIndex now - the one the attached
  // subrecord got. WM2f left it undefined on purpose, because the
  // subrecord it belongs to is one Kamer added and the port's block did
  // not have it; WM2g appends that subrecord, so the door has an inside.
  assert.match(layout, /w\.building\.recordIndex = recordIndex/,
    'the building has no subrecord index, so its door can never open');
});

test('WM2g: the mill\'s subrecord is attached, and attaching it twice does nothing', () => {
  // BlocksFile CACHES its parsed blocks - the same object comes back for
  // every location using this block and for every re-entry - so a second
  // append would grow the array without bound AND move the recordIndex a
  // live door already refers to.
  const block = () => ({
    name: 'FARMAA00.RMB',
    rmbBlock: { subRecords: [{ exterior: { block3dObjectRecords: [] }, interior: {} }] },
  });
  const b = block();
  const first = attachWindmillRecord(b);
  assert.equal(attachWindmillRecord(b), first, 'a second attach made a second subrecord');
  assert.equal(b.rmbBlock.subRecords.length, 2, 'the subrecord array grew twice');

  const rec = b.rmbBlock.subRecords[first];
  assert.equal(rec.interior, WINDMILL_INTERIOR, 'the attached subrecord carries something else');
  // Its EXTERIOR must be empty: the mill and its building are placed by
  // windmillsFor, and a subrecord carrying them too would stand each twice.
  assert.equal(rec.exterior.block3dObjectRecords.length, 0,
    'the attached subrecord places models - every mill would be doubled');
  assert.equal(rec.exterior.header.num3dObjectRecords, 0);
});

test('WM2g: the interior is real, and its header counts its own arrays', () => {
  const I = WINDMILL_INTERIOR;
  assert.ok(I.block3dObjectRecords.length > 0, 'an interior with no models cannot be entered - layoutInterior throws');
  // HIS header declares 44 models, 12 flats and 10 doors over arrays of
  // 16, 11 and 0 - the third header-versus-data mismatch in these files.
  // A consumer trusting the count walks off the end of the array.
  assert.equal(I.header.num3dObjectRecords, I.block3dObjectRecords.length);
  assert.equal(I.header.numFlatObjectRecords, I.blockFlatObjectRecords.length);
  assert.equal(I.header.numSection3Records, I.blockSection3Records.length);
  assert.equal(I.header.numPeopleRecords, I.blockPeopleRecords.length);
  assert.equal(I.header.numDoorRecords, I.blockDoorRecords.length);
  // The shape blocksFile parses, or interiorLayout reads undefined off
  // every record: camelCase, and the fields it actually uses.
  for (const o of I.block3dObjectRecords) {
    for (const k of ['modelIdNum', 'objectType', 'xPos', 'yPos', 'zPos', 'yRotation']) {
      assert.equal(typeof o[k], 'number', `an interior model is missing ${k}`);
    }
  }
  for (const f of I.blockFlatObjectRecords) {
    assert.equal(typeof f.textureArchive, 'number');
    assert.equal(f.textureBitfield, (f.textureArchive << 7) | (f.textureRecord & 0x7f));
  }
  // His mill machinery is in there - 41601, the roller and the plank gear.
  assert.ok(I.block3dObjectRecords.some((o) => o.modelIdNum === 41601),
    'the mill interior lost its machinery');
});
