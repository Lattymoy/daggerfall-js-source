// MODS AUDIT: THE VENDORED MODS, BYTE FOR BYTE. Three mods
// ship files that are the authors' own, carried verbatim with their
// permission - Hazelnut's four path arrays, Kamer's five Collada
// exports, and Dynamic Skies' shader, includes, presets, settings and
// manifest. Every earlier pin checked a LENGTH (ledger.test.js: 500,000
// bytes) or a derived count (roads.test.js: 21,554 road pixels) or that
// a bake reproduces itself (windmillmesh.test.js) - none could tell a
// re-exported, re-saved or hand-edited file from the author's. These
// are the sha256 of each file as verified against upstream this audit:
// the roads and the Dynamic Skies files against their public repos
// (github.com/ajrb/dfunity-mods master; drcarademono/dynamic-skies
// 04506e2), the windmill DAEs against the archive Mac supplied. A
// change here is either a deliberate re-vendoring, in which case the
// hash and the README move together, or a corruption.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const sha256 = (rel) => createHash('sha256').update(readFileSync(new URL(`../../vendor/${rel}`, import.meta.url))).digest('hex');

// Hazelnut's four path arrays are retired - their hashes are their Own-Work.md row's record now,
// and the Bay's network is the port's own (test/world/road/ownwork2_bayroads.test.js). OWN-WORK4: so are
// Dynamic Skies' eighteen files - the sky is the port's own (test/systems/dynamicSkies.test.js).
// OWN-WORK4: Travel Options' three UI textures are retired - their hashes are their Own-Work.md row's
// record now, and the pictures are our own (test/systems/ownwork4_pictures.test.js pins their prints).
const WINDMILLS = {
  'windmills-kamer/Blade.dae': 'c373edf569f43334f5e17ab9f65409705bca62c597f529022bcbbcb427eebae9',
  'windmills-kamer/Windmill.dae': 'c932193ae0afce9806360272b7b548e24f174e1bdaa3f310430121550155f889',
  'windmills-kamer/41601.dae': 'ca044d7111c7c7f67b195cba1f1021bc4c653623c9f36b45ee8a5e9492eeff76',
  'windmills-kamer/Plank_Gear.dae': '9ed29fbe93ca80e13b14e79d497e042d5eb8db55c19461663fe103ad210c4ed9',
  'windmills-kamer/Roller.dae': '4276f87b29eb603466ba1528fc45fe57c38a2f4eb54ec5b4d376de04e006c430',
};

const check = (table) => { for (const [rel, want] of Object.entries(table)) assert.equal(sha256(rel), want, `${rel} is not the author's file`); };

test('MODS AUDIT: Windmills of Daggerfall - the five Collada exports are Kamer’s, sha256 against the archive', () => {
  check(WINDMILLS);
  assert.equal(Object.keys(WINDMILLS).length, 5);
});

