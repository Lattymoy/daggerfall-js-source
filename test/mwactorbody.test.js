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
  mwActorBody, mwBodyKey, mwActorBodyStats, MAX_BODIES, _resetActorBodiesForTests,
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
  assert.match(svc, /buildTpBody, clothingColourOf, wornEquipKeyOf, fpWeaponKey, buildMwCreature,/,
    'the service must ride the arm’s own builds and key helpers');
  // NPC2b: the creature build is the arm's too, and the beast MAP is
  // the one home for "which creature stands in for which enemy".
  assert.match(svc, /import \{ pickMwCreature \} from '\.\/mwCreatureMap\.js';/, 'the beast map is re-minted');
  assert.match(svc, /import \{ mwActorCatalog, catalogRace \} from '\.\.\/formats\/mwActorCatalog\.js';/,
    'and the one catalog');
  assert.match(svc, /import \{ isEnhanced \} from '\.\.\/systems\/uiSkin\.js';/, 'and the one skin gate');
  // The key must not be re-spelled here: MW-D19 and MW-D32 own "same
  // weapon" and "same outfit".
  assert.match(svc, /wornEquipKeyOf\(worn\)/, 'the outfit key is re-minted');
  assert.match(svc, /fpWeaponKey\(weapon, hasAmmo\)/, 'the weapon key is re-minted');
});

// ═══ THE NPC1 AUDIT'S OWN FINDINGS ══════════════════════════════════
// Both were found by auditing the slice before building on it, and
// both are the same class: a cache that looked right and shared the
// wrong thing.

test('NPC1 audit F1: WITHOUT a real generation the body cache stands down', async () => {
  reset();
  // MEASURED before the gate existed: two DIFFERENT fixture data sets,
  // each carrying no stamp, produced one body - the first one served
  // the second's request. That is the collision the mSpeed pin
  // convicted in IG2, in a cache that had not learned it yet. Every
  // other memo in this lane (the walk, the clip, the texture, the
  // catalog) gates on a real stamp; this one does now too.
  const a = tpActorDeps({ gen: null });
  const b = tpActorDeps({ gen: null });
  const bodyA = await mwActorBody({ race: 'fprace', worn: [] }, a.deps);
  const bodyB = await mwActorBody({ race: 'fprace', worn: [] }, b.deps);
  assert.ok(bodyA && bodyB, 'both must still BUILD - the gate withholds the cache, not the body');
  assert.notEqual(bodyA, bodyB, 'one data set’s body served another’s request');
  assert.equal(mwActorBodyStats().builds, 2, 'the unstamped builds were shared');
  assert.equal(mwActorBodyStats().cached, 0, 'an unstamped body was cached');
});

test('NPC1 audit F2: the body cache is BOUNDED - a body is megabytes and nothing evicted them', async () => {
  reset();
  const fx = tpActorDeps({ gen: 7 });
  // DFU rolls equipment at random, so distinct outfits are not a small
  // closed set: a player crossing many towns without re-attaching grew
  // this without bound. Past the cap the OLDEST goes.
  for (let i = 0; i < MAX_BODIES + 8; i++) {
    await mwActorBody({ race: 'fprace', worn: [{ templateIndex: i, material: 0 }] }, fx.deps);
  }
  assert.equal(mwActorBodyStats().cached, MAX_BODIES, 'the cache grew past its cap');
  assert.equal(mwActorBodyStats().builds, MAX_BODIES + 8, 'every distinct outfit still built once');
});

test('NPC1 audit F2b: a HIT refreshes recency - what survives is what is WORN, not what came first', async () => {
  reset();
  const fx = tpActorDeps({ gen: 8 });
  const outfit = (i) => ({ race: 'fprace', worn: [{ templateIndex: i, material: 0 }] });
  // Fill the cache exactly to its cap: outfits 0..MAX-1, oldest first.
  for (let i = 0; i < MAX_BODIES; i++) await mwActorBody(outfit(i), fx.deps);
  assert.equal(mwActorBodyStats().cached, MAX_BODIES);
  // TOUCH THE OLDEST. Under plain insertion-order eviction this
  // changes nothing and outfit 0 is still first out; under the law it
  // becomes the newest. The mutation round caught the first version of
  // this pin asking for the NEWEST outfit, which cannot tell the two
  // apart - it survived the eviction either way.
  const builds = mwActorBodyStats().builds;
  await mwActorBody(outfit(0), fx.deps);
  assert.equal(mwActorBodyStats().builds, builds, 'the oldest was already gone before we touched it');
  // One more outfit forces exactly one eviction.
  await mwActorBody(outfit(MAX_BODIES), fx.deps);
  assert.equal(mwActorBodyStats().cached, MAX_BODIES);
  // The touched one must have SURVIVED - asking again costs no build.
  const after = mwActorBodyStats().builds;
  await mwActorBody(outfit(0), fx.deps);
  assert.equal(mwActorBodyStats().builds, after,
    'the outfit being worn was evicted while an untouched one survived');
});

// ═══ THE CROSS-ARC AUDIT'S FINDINGS (NPC1-NPC3a) ════════════════════

test('AUDIT A1: "no weapon" is None (-1) - ZERO is a real one-handed blade', async () => {
  const { MW_WEAPON_TYPE } = await import('../src/formats/mwFirstPerson.js');
  // The trap, stated: the enum's None is -1 and 0 is ShortBladeOneHand,
  // so `?? 0` asked every unarmed actor for a one-handed stance. The
  // ladder's bare-group fallback MASKED it - and would stop masking it
  // the moment a rig carried an idle1h its actor should not stand in.
  assert.equal(MW_WEAPON_TYPE.None, -1);
  assert.equal(MW_WEAPON_TYPE.ShortBladeOneHand, 0, 'zero is a weapon, not the absence of one');
  const rig = readFileSync('src/characters/mwActorRig.js', 'utf8');
  assert.match(rig, /const stance = body\.mwType \?\? MW_WEAPON_TYPE\.None;/, 'the rig defaults to a weapon');
  const arm = readFileSync('src/combat/fpArm.js', 'utf8');
  const crea = arm.slice(arm.indexOf('export async function buildMwCreature'), arm.indexOf('export function uploadMwBodyMesh'));
  assert.match(crea, /mwType: MW_WEAPON_TYPE\.None,/, 'a creature declares a weapon type it does not have');
  // ...and the behaviour: an unarmed body asks for the BARE group.
  const { actorGroupFor } = await import('../src/characters/mwActorRig.js');
  const body = { groupSet: new Set(['idle', 'idle1h']), mwType: MW_WEAPON_TYPE.None };
  assert.equal(actorGroupFor(body, { moving: false }), 'idle',
    'an unarmed actor took the one-handed idle that happened to exist');
});

test('AUDIT A2: a body that leaves the cache GIVES ITS MESH BACK', async () => {
  const { releaseMwBodyMesh } = await import('../src/combat/fpArm.js');
  // A body holds a VAO, its buffers and one texture per piece. The cap
  // and the re-attach both drop bodies and neither freed a byte.
  const freed = { vao: 0, buffers: 0, textures: 0 };
  const gl = {
    deleteVertexArray: () => { freed.vao++; },
    deleteBuffer: () => { freed.buffers++; },
    deleteTexture: () => { freed.textures++; },
  };
  const holder = {
    meshOwner: { gl },
    packed: { packed: new Float32Array(3) },
    mesh: { vao: 1, buffers: [1, 2], ranges: [{ tex: 7 }, { tex: 8 }, { tex: null }] },
  };
  assert.equal(releaseMwBodyMesh(holder), true);
  assert.deepEqual(freed, { vao: 1, buffers: 2, textures: 2 });
  assert.equal(holder.mesh, null, 'the freed mesh must not still be reachable');
  assert.equal(holder.packed, null, 'the packed buffer goes with it');
  // Idempotent, and safe on a body that was never drawn.
  assert.equal(releaseMwBodyMesh(holder), false);
  assert.equal(releaseMwBodyMesh({}), false);
  assert.equal(releaseMwBodyMesh(null), false);
  // The service must actually CALL it on both exits.
  const svc = readFileSync('src/characters/mwActorBody.js', 'utf8');
  assert.match(svc, /const body = await pending; if \(body\) releaseMwBodyMesh\(body\);/, 'eviction leaks');
  assert.match(svc, /while \(BODIES\.size > MAX_BODIES\) evict\(BODIES\.keys\(\)\.next\(\)\.value\);/, 'the cap leaks');
  assert.match(svc, /if \(cat\.gen !== _gen\) \{ evictAll\(\); _gen = cat\.gen; \}/, 'a re-attach leaks');
  assert.ok(!/BODIES\.clear\(\); _gen = cat\.gen;/.test(svc), 'a bare clear drops the meshes on the floor');
  // ...and the mesh remembers who made it, or nothing could free it.
  const arm = readFileSync('src/combat/fpArm.js', 'utf8');
  assert.match(arm, /holder\.meshOwner = renderer;/, 'the mesh forgets its renderer');
});

test('AUDIT A3: the creature cache is keyed by the CREATURE, not the enemy asking', async () => {
  const { pickMwCreature, MAPPED_BEASTS } = await import('../src/characters/mwCreatureMap.js');
  // MEASURED: 23 mapped enemies resolve to only 18 distinct creatures.
  // Keyed on mobileType, five pairs built the same model twice.
  const C = (id) => ({ id, model: 'r/x.nif', name: id, flags: 0, scale: 1 });
  const pool = ['rat', 'skeleton', 'ancestor_ghost', 'daedroth', 'dreugh', 'atronach_flame',
    'atronach_frost', 'bonewalker', 'draugr', 'dremora', 'winged_twilight', 'scamp',
    'bonelord', 'ogrim', 'spriggan', 'bear', 'werewolf', 'slaughterfish'].map(C);
  const ids = new Set();
  for (const mt of MAPPED_BEASTS) {
    const r = pickMwCreature(Number(mt), pool);
    if (r.record) ids.add(r.record.id);
  }
  assert.ok(ids.size < MAPPED_BEASTS.length,
    'the map has stopped sharing models - this pin is measuring nothing');
  assert.equal(ids.size, 18, 'the distinct-creature count changed; the saving is the claim');
  const svc = readFileSync('src/characters/mwActorBody.js', 'utf8');
  assert.match(svc, /const key = `crea\/\$\{picked\.record\.id\}`;/, 'the key is the enemy, not the creature');
  // The resolve must happen BEFORE the key, or it cannot be the key.
  const resolve = svc.indexOf('const picked = pickMwCreature(mobileType, cat.creatures);');
  const key = svc.indexOf('const key = `crea/${picked.record.id}`;');
  assert.ok(resolve > 0 && key > resolve, 'the creature is resolved after it is needed');
});

test('AUDIT A4/A5: a shared body carries no ONE enemy’s substitution, and no actor keeps a stale one', () => {
  const svc = readFileSync('src/characters/mwActorBody.js', 'utf8');
  // A4: a winged twilight stands in for a harpy AND a seducer; one
  // `why` on the shared body cannot be true for both.
  assert.ok(!/body\.substitution = /.test(svc), 'one enemy’s substitution is written onto a shared body');
  // A5: the service drops its cache on a re-attach, but an ACTOR holds
  // its own reference and never asks twice - so it would draw archives
  // the player has replaced, forever.
  assert.match(svc, /export function mwBodyGeneration\(\) \{ return _gen; \}/, 'an actor cannot tell which data its body came from');
  const rig = readFileSync('src/characters/mwActorRig.js', 'utf8');
  assert.match(rig, /actor\._mwGen === mwBodyGeneration\(\)/, 'a stale body is kept across a re-attach');
  assert.match(rig, /actor\._mwGen = mwBodyGeneration\(\); \}\)/, 'the stamp is never written');
});
