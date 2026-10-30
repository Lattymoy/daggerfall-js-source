// OVERLOAD-EASE (2026-10-29: the account database overloaded, /v1/homes/town its busiest route at some 5.5 asks a
// page a minute): a pixel's build asks a town's homes only where one can stand - never for a far Imperial City slice,
// nor a place the boot's read of every town says holds none. Doors still ask (worldModes.js waitFor).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createOnlineHomes } from '../../src/systems/online/onlineHomes.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const homesOf = (rows) => createOnlineHomes({ api: { town: async () => ({ ok: true, data: { homes: rows } }) } });

test('OVERLOAD-EASE: a place is homeless only once the boot has read every town, and it named none there', async () => {
  const h = homesOf([{ buildingKey: 0x101, owner: 'Example' }]);
  assert.equal(h.heardHomeless(7101), false, 'unread: every place may hold a home');
  h.hearEveryTown([[7103, [0x101]]]);
  assert.equal(h.heardHomeless(7101), true);
  assert.equal(h.heardHomeless(7103), false);
  h.hearHome([{ m: 7101, u: [0x202], d: [] }]);
  assert.equal(h.heardHomeless(7101), false, 'a home bought since the boot is asked again');
});

test('OVERLOAD-EASE: a town this page asked keeps its own answer over the boot read', async () => {
  const h = homesOf([{ buildingKey: 0x101, owner: 'Example' }]);
  h.hearEveryTown([]);
  await h.ensure(7105);
  assert.equal(h.heardHomeless(7105), false);
});

test('OVERLOAD-EASE: an answer naming no towns (an older service) leaves every place asked', () => {
  const h = homesOf([]);
  assert.equal(h.hearEveryTown(undefined), false);
  assert.equal(h.heardHomeless(7101), false);
});

test('OVERLOAD-EASE: the pixel build skips a far slice and a homeless place', () => {
  assert.match(src('src/scenes/pixelBuild.js'), /if \(onlineHomes && homeTown && !farView && !onlineHomes\.heardHomeless\?\.\(homeTown\)\) \{/);
});
