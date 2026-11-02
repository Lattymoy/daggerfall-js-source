// AURUM-CACHES (2026-10-30; bible/06-Systems/Aurum.md section 3a): THE AURUM COFFER'S PICTURES - painted in code, the same
// pixels every call; shut and open, one silhouette mirrored about its middle column; the coin on its lock plate a dark rim
// round a gold face with the sun's white heart; both on the texture door as stand-ins of the coffer's own archive, which
// the registry holds. tools/mutants/aurum_caches.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { AURUM_COFFER_ARCHIVE, AURUM_COFFER_ART, AURUM_COFFER_SIZE, cofferShutArt, cofferOpenArt, registerAurumCofferArt, _resetAurumCofferArt } from '../../src/world/aurumCofferArt.js';
import { pseudoArchiveOwner } from '../../src/world/eliteGates/pseudoArchives.js';

const px = (img, x, y) => { const i = (y * img.width + x) * 4; return [...img.colors.slice(i, i + 4)]; };
const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

test('AURUM-CACHES the coffer\'s pictures: 33 x 24 shut and 33 x 32 open, the same pixels every call, one silhouette mirrored about the middle column, opaque to the plinth and clear above the lid (mutants: the sizes, the plinth)', () => {
  for (const [name, paint, size] of [['shut', cofferShutArt, AURUM_COFFER_SIZE.shut], ['open', cofferOpenArt, AURUM_COFFER_SIZE.open]]) {
    const img = paint();
    assert.deepEqual([img.width, img.height], [size.w, size.h], name);
    assert.deepEqual(paint().colors, img.colors, `${name}: pure`);
    let opaque = 0;
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
      const a = px(img, x, y)[3];
      assert.equal(a, px(img, img.width - 1 - x, y)[3], `${name}: mirrored at ${x},${y}`);
      assert.ok(a === 0 || a === 255, `${name}: no half-clear texel`);
      opaque += a ? 1 : 0;
    }
    for (let x = 0; x < img.width; x++) assert.ok(px(img, x, img.height - 1)[0] > 80, `${name}: the gold plinth stands on its whole width (${x})`);
    assert.equal(px(img, 0, 0)[3], 0, `${name}: the corner above the lid is clear`);
    assert.ok(opaque > img.width * img.height * 0.7, `${name}: a solid chest (${opaque})`);
  }
  assert.equal(AURUM_COFFER_SIZE.shut.w % 2, 1, 'odd wide: the sun has a middle texel');
});

test('AURUM-CACHES the Aurum coin on the lock plate: a dark rim, a gold face, the sun\'s white heart in the middle column, its rays brighter than the face - on the shut coffer and the open alike; the open one\'s mouth dark (mutants: the heart dimmed, the rim painted bright, the mouth lit)', () => {
  for (const [name, img, cy] of [['shut', cofferShutArt(), 17], ['open', cofferOpenArt(), 25]]) {
    const heart = px(img, 16, cy), ray = px(img, 16, cy - 3), face = px(img, 18, cy + 1), rim = px(img, 16, cy - 4);
    assert.deepEqual(heart.slice(0, 3), [255, 252, 232], `${name}: the white heart`);
    assert.ok(lum(ray) > lum(face) + 20, `${name}: a ray brighter than the face`);
    assert.ok(face[0] > 180 && face[2] < 120, `${name}: a gold face (${face})`);
    assert.ok(lum(rim) < 80, `${name}: the dark rim (${rim})`);
  }
  const open = cofferOpenArt();
  assert.ok(lum(px(open, 16, 17)) < 30, 'the open coffer\'s mouth is dark and bare');
  assert.ok(lum(px(cofferShutArt(), 16, 6)) > 30, 'the shut one\'s lid is oak');
});

test('AURUM-CACHES the pictures on the texture door: once, two stand-ins of AURUM_COFFER_ARCHIVE built as painted, the archive the registry\'s (mutants: a record lost, registered twice)', async () => {
  _resetAurumCofferArt();
  const got = [];
  assert.equal(registerAurumCofferArt((e) => { got.push(...e); return e.length; }), 2);
  assert.equal(registerAurumCofferArt((e) => { got.push(...e); return e.length; }), 0, 'once');
  assert.deepEqual(got.map((e) => [e.archive, e.record, e.standIn]), [[AURUM_COFFER_ARCHIVE, AURUM_COFFER_ART.shut, true], [AURUM_COFFER_ARCHIVE, AURUM_COFFER_ART.open, true]]);
  const built = await got[1].build();
  assert.deepEqual([built.width, built.height], [AURUM_COFFER_SIZE.open.w, AURUM_COFFER_SIZE.open.h]);
  assert.deepEqual(built.data, cofferOpenArt().colors);
  assert.equal(pseudoArchiveOwner(AURUM_COFFER_ARCHIVE)?.name, 'AURUM_COFFER_ARCHIVE');
  _resetAurumCofferArt();
});
