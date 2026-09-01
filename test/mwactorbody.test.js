// NPC1: THE HUMANOID BODY SERVICE.
//
// The laws under test are the SERVICE's, not the build's: which
// actors share a body, what counts as a different one, when nothing
// is built at all, and what a refusal answers. The build itself
// (buildTpBody) is MW-D24/D29/D31's and is pinned in fparm.test.js -
// this suite must not re-assert it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tpActorDeps } from './mwFixtures.mjs';
import {
  mwActorBody, mwBodyKey, mwActorBodyStats, _resetActorBodiesForTests,
} from '../src/characters/mwActorBody.js';
import { _resetActorCatalogForTests } from '../src/formats/mwActorCatalog.js';

const reset = () => { _resetActorBodiesForTests(); _resetActorCatalogForTests(); };

/** The enhanced gate reads the URL override first, which needs no
 *  storage - the documented door the probes use. */
function withSkin(skin, fn) {
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'location');
  const prev = globalThis.location;
  globalThis.location = { search: `?skin=${skin}` };
  try { return fn(); } finally {
    if (had) globalThis.location = prev; else delete globalThis.location;
  }
}

test('NPC1: N actors wearing ONE outfit cost ONE build - the law a town lives or dies by', async () => {
  reset();
  const fx = tpActorDeps();
  // Five guards, same race, same sex, same face, same kit: one body.
  const bodies = [];
  for (let i = 0; i < 5; i++) {
    bodies.push(await mwActorBody({ race: 'fprace', female: false, faceIndex: 0, worn: [] }, fx.deps));
  }
  assert.ok(bodies[0], `the body built (${JSON.stringify(mwActorBodyStats())})`);
  assert.equal(mwActorBodyStats().builds, 1, 'five actors must not cost five builds');
  for (const b of bodies) assert.equal(b, bodies[0], 'and they must SHARE one body, not hold five copies');

  // A different outfit is a different body - and only one more build.
  const armed = await mwActorBody(
    { race: 'fprace', female: false, faceIndex: 0, worn: [{ templateIndex: 2, material: 3 }] }, fx.deps);
  assert.ok(armed, 'the second outfit built');
  assert.notEqual(armed, bodies[0], 'a different outfit is a different body');
  assert.equal(mwActorBodyStats().builds, 2, 'and it cost exactly one more build');
  // ...and re-asking for the FIRST outfit is still free.
  await mwActorBody({ race: 'fprace', female: false, faceIndex: 0, worn: [] }, fx.deps);
  assert.equal(mwActorBodyStats().builds, 2, 'the first outfit was rebuilt');
});

test('NPC1: two actors asking at once share ONE build - the promise is cached, not the result', async () => {
  reset();
  const fx = tpActorDeps();
  // The race a naive cache loses: both calls start before either
  // finishes, so a cache that stores only the RESULT builds twice.
  const [a, b] = await Promise.all([
    mwActorBody({ race: 'fprace', worn: [] }, fx.deps),
    mwActorBody({ race: 'fprace', worn: [] }, fx.deps),
  ]);
  assert.ok(a);
  assert.equal(a, b, 'the two concurrent askers got different bodies');
  assert.equal(mwActorBodyStats().builds, 1, 'a concurrent pair cost two builds');
});

test('NPC1: the KEY is the identity of a BODY - what changes the mesh, and nothing else', () => {
  const base = { race: 'fprace', female: false, beast: false, faceIndex: 0, worn: [], weapon: null, hasAmmo: false };
  const k = mwBodyKey(base);
  // Everything that changes which meshes are assembled changes it.
  assert.notEqual(mwBodyKey({ ...base, race: 'other' }), k, 'race');
  assert.notEqual(mwBodyKey({ ...base, female: true }), k, 'sex');
  assert.notEqual(mwBodyKey({ ...base, beast: true }), k, 'beast');
  assert.notEqual(mwBodyKey({ ...base, faceIndex: 3 }), k, 'face');
  assert.notEqual(mwBodyKey({ ...base, worn: [{ templateIndex: 2, material: 1 }] }), k, 'outfit');
  assert.notEqual(mwBodyKey({ ...base, hasAmmo: true }), k, 'the held round');
  // ...and nothing an actor merely IS changes it: two guards in
  // opposite corners facing opposite ways are one body. Keying on any
  // of these silently turns a shared cache into a per-actor one.
  assert.equal(mwBodyKey({ ...base, pos: [10, 0, 5], yaw: 2.1, name: 'Ulrich', health: 12 }), k,
    'position, heading, name or health reached the key');
  // The race half is case-insensitive, as every other race read is.
  assert.equal(mwBodyKey({ ...base, race: 'FPRACE' }), k, 'the race is not folded');
});

test('NPC1: the CLASSIC skin builds nothing at all - this lane is the enhanced one', async () => {
  reset();
  const fx = tpActorDeps();
  const body = await withSkin('classic', () => mwActorBody({ race: 'fprace', worn: [] }, fx.deps));
  assert.equal(body, null, 'classic must answer null - the port’s own rigged body stands');
  assert.equal(mwActorBodyStats().builds, 0, 'and it must not have BUILT one to throw away');
  // ...and the same call on the enhanced skin does build.
  const enhanced = await withSkin('enhanced', () => mwActorBody({ race: 'fprace', worn: [] }, fx.deps));
  assert.ok(enhanced, 'the enhanced skin still builds');
  assert.equal(mwActorBodyStats().builds, 1);
});

test('NPC1: no data, or a refusal, answers NULL - never a half body, never a throw', async () => {
  reset();
  const noBsa = { loadMorrowindArchives: async () => [], storedMorrowindNames: async () => [], loadMorrowindFile: async () => new Uint8Array() };
  assert.equal(await mwActorBody({ race: 'fprace', worn: [] }, noBsa), null, 'no archives must be a null, not a throw');
  const fx = tpActorDeps();
  // A race the data carries no body records for: the BUILD refuses,
  // and the service turns that into "keep your own body".
  reset();
  assert.equal(await mwActorBody({ race: 'no-such-race', worn: [] }, fx.deps), null,
    'a refused build must answer null');
});

test('NPC1: a fresh ATTACH drops every body - the meshes came from archives that are gone', async () => {
  reset();
  const fx = tpActorDeps({ gen: 1 });
  const first = await mwActorBody({ race: 'fprace', worn: [] }, fx.deps);
  assert.ok(first);
  assert.equal(mwActorBodyStats().builds, 1);
  await mwActorBody({ race: 'fprace', worn: [] }, fx.deps);
  assert.equal(mwActorBodyStats().builds, 1, 'the same generation must not rebuild');
  // The player attaches another archive: the generation turns over.
  fx.setGeneration(2);
  _resetActorCatalogForTests();   // the store's own cache turns over with it
  const after = await mwActorBody({ race: 'fprace', worn: [] }, fx.deps);
  assert.ok(after);
  assert.equal(mwActorBodyStats().builds, 2, 'a new generation must rebuild, not serve the old meshes');
  assert.notEqual(after, first, 'and it must be a NEW body, not the stale one');
});

test('NPC1: the service reuses the ONE build and the ONE catalog - it re-implements neither', () => {
  // MW7's law. The body build (buildTpBody) and the records
  // (mwActorCatalog) each have one home; a second port of either is
  // how two callers of one rule drift apart.
  const svc = readFileSync('src/characters/mwActorBody.js', 'utf8');
  assert.match(svc, /import \{\s*buildTpBody, clothingColourOf, wornEquipKeyOf, fpWeaponKey,\s*\} from '\.\.\/combat\/fpArm\.js';/,
    'the service must ride the arm’s own build and key helpers');
  assert.match(svc, /import \{ mwActorCatalog, catalogRace \} from '\.\.\/formats\/mwActorCatalog\.js';/,
    'and the one catalog');
  assert.match(svc, /import \{ isEnhanced \} from '\.\.\/systems\/uiSkin\.js';/, 'and the one skin gate');
  // The key must not be re-spelled here: MW-D19 and MW-D32 own "same
  // weapon" and "same outfit".
  assert.match(svc, /wornEquipKeyOf\(worn\)/, 'the outfit key is re-minted');
  assert.match(svc, /fpWeaponKey\(weapon, hasAmmo\)/, 'the weapon key is re-minted');
});
