// EC1 - THE ENCHANT CTX READS THE LIVE FOE POOL (2026-08-29).
//
// world.js's enchant mount answered `[]` for its foe pool in every
// mode but exterior - which is the mode the player does not fight in.
//
// DFU has no scene gate here at all. PlayerGPS.UpdateNearbyObjects
// (PlayerGPS.cs:747-777) walks ActiveGameObjectDatabase
// .GetActiveEnemyBehaviours(), every active enemy in the scene, and
// CastWhenStrikes does not look a foe up at all (CastWhenStrikes.cs
// :105) - it assigns the bundle to the entity behaviour the strike
// already handed it. The port's lookup exists only because it needs
// the RECORD to reach that foe's sinks; the gate was never DFU's.
//
// What the gate cost, inside a dungeon in the streaming host: a
// CastWhenStrikes weapon found no record for the foe it had just
// struck and returned, so paralysis, Wizard's Fire and the other ten
// classic strike spells did nothing; the vampiric drain and both
// artifact affinity scans saw an empty room. Nothing threw and nothing
// was logged. The one ctx in play is that mount - no host passes an
// enchantCtx at the strike site (formulas.js:465 defaults it null) -
// so mergeCtx folds it under every dispatch, in every mode.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { liveEnchantFoes, liveEnchantFoeSinks } from '../src/scenes/shared.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(HERE, '..', rel), 'utf8');

/** A dungeon context's two enchant-facing members, and a ledger of
 *  which host's damage door each hurt actually went through. */
function fixture() {
  const hits = [];
  const dFoe = { name: 'dungeon-rat' };
  const otherDFoe = { name: 'dungeon-bat' };
  const xFoe = { name: 'street-thug' };
  // AUDIT 54: the interior's TWO pools - the quest/encounter foes IF
  // mounted and ROAD-B's indoor watch - which worldModes joins into
  // one answer exactly as it does for MakeEnemiesHostile.
  const iFoe = { name: 'shop-daedroth' };
  const iWatch = { name: 'indoor-watchman' };
  const insideSinks = (f) => ({ hurt: (n) => hits.push(['interior', f.name, n]) });
  const dungeonCtx = {
    foes: [dFoe, otherDFoe],
    foeSinksFor: (f) => ({ hurt: (n) => hits.push(['dungeon', f.name, n]) }),
  };
  const exteriorSinks = (f) => ({ hurt: (n) => hits.push(['exterior', f.name, n]) });
  return { hits, dFoe, otherDFoe, xFoe, iFoe, iWatch, dungeonCtx, exteriorSinks, insideSinks,
    exteriorPool: () => [xFoe], insidePool: () => [iFoe, iWatch] };
}

test('EC1: the live pool follows the MODE - dungeon foes are reachable', () => {
  const f = fixture();
  assert.deepEqual(liveEnchantFoes('dungeon', f.dungeonCtx, f.exteriorPool), [f.dFoe, f.otherDFoe],
    'the mode the player fights in is the one the gate used to empty');
  assert.deepEqual(liveEnchantFoes('exterior', f.dungeonCtx, f.exteriorPool), [f.xFoe],
    'and the exterior pool is still exactly the exterior pool - a dungeon ctx left mounted from a previous descent cannot leak into it');
});

test('AUDIT 54: an interior answers ITS OWN TWO POOLS - the third live mode had no arm at all', () => {
  // THE STRUCK ROW: this test used to assert `[]` here, on the stated
  // premise that "the port stands no foe pool inside a building".
  // That premise died twice over - IF mounted `interiorFoes` and
  // ROAD-B mounted `interiorGuards` beside it - and the vacuous pin
  // held the original EC1 defect open for the third mode: inside a
  // building a CastWhenStrikes weapon (paralysis, Wizard's Fire, the
  // rest of the classic strike spells) found no record and returned,
  // and the vampiric drain and both artifact affinity scans saw an
  // empty room. Silently, in a mode with live enemies in it.
  const f = fixture();
  assert.deepEqual(liveEnchantFoes('interior', f.dungeonCtx, f.exteriorPool, f.insidePool), [f.iFoe, f.iWatch],
    'the whole active enemy database of the building the player is in - the quest foes AND the watch');
  // and it does not silently borrow the exterior pool it is standing on
  assert.deepEqual(liveEnchantFoes('interior', null, f.exteriorPool, () => []), []);
  // ...nor does the exterior arm borrow the interior's, which is the
  // leak the other way: the street's pools are a different scene.
  assert.deepEqual(liveEnchantFoes('exterior', f.dungeonCtx, f.exteriorPool, f.insidePool), [f.xFoe]);
  // an interior mid-transition (no context yet) must not take the frame down
  assert.deepEqual(liveEnchantFoes('interior', null, f.exteriorPool, null), []);
  assert.deepEqual(liveEnchantFoes('interior', null, f.exteriorPool, () => undefined), []);
});

test('EC1: a dungeon with no ctx yet answers empty rather than throwing', () => {
  // the mode flips before the context finishes building; an enchantment
  // firing in that window must not take the frame down.
  assert.deepEqual(liveEnchantFoes('dungeon', null, () => { throw new Error('exterior pool must not be consulted'); }), []);
  assert.deepEqual(liveEnchantFoes('dungeon', {}, () => []), []);
});

test('EC1: sinks route by POOL MEMBERSHIP, and the mode is not consulted', () => {
  const f = fixture();
  liveEnchantFoeSinks(f.dFoe, f.dungeonCtx, f.exteriorSinks).hurt(7);
  assert.deepEqual(f.hits, [['dungeon', 'dungeon-rat', 7]], 'a dungeon record goes through the dungeon host\'s damage door');
  // THE ONE THAT MATTERS: the dungeon ctx is mounted, but this record
  // is a stranger to its pool. Routing on the ctx's PRESENCE would send
  // it to the dungeon host's damageFoe, which knocks back and kills
  // against a collider that record was never built for.
  liveEnchantFoeSinks(f.xFoe, f.dungeonCtx, f.exteriorSinks).hurt(3);
  assert.deepEqual(f.hits[1], ['exterior', 'street-thug', 3], 'a stranger to the dungeon pool goes through the exterior door');
  // AUDIT 54: and an INTERIOR record goes through the interior host's
  // own damage door. Widening the pool without this would have been
  // worse than the gap it closed - a record from a building sent
  // through `foeSinks` knocks back and dies against the STREET's
  // collider and death chain.
  liveEnchantFoeSinks(f.iFoe, f.dungeonCtx, f.exteriorSinks, f.insidePool, f.insideSinks).hurt(9);
  assert.deepEqual(f.hits[2], ['interior', 'shop-daedroth', 9], 'an interior record goes through the interior host\'s damage door');
  liveEnchantFoeSinks(f.iWatch, f.dungeonCtx, f.exteriorSinks, f.insidePool, f.insideSinks).hurt(2);
  assert.deepEqual(f.hits[3], ['interior', 'indoor-watchman', 2], 'and so does the indoor watch - one pool, one door');
  // the DUNGEON is still asked first: insideFoes answers the dungeon's
  // own pool while one is mounted, and that record is the dungeon's.
  liveEnchantFoeSinks(f.dFoe, f.dungeonCtx, f.exteriorSinks, () => [f.dFoe], f.insideSinks).hurt(1);
  assert.deepEqual(f.hits[4], ['dungeon', 'dungeon-rat', 1], 'membership is asked in host order, dungeon first');
  // a stranger to BOTH inner pools still takes the exterior door
  liveEnchantFoeSinks(f.xFoe, f.dungeonCtx, f.exteriorSinks, f.insidePool, f.insideSinks).hurt(5);
  assert.deepEqual(f.hits[5], ['exterior', 'street-thug', 5]);
  // and the router takes no mode at all - it cannot be asked the wrong
  // question. (It took one until the campaign showed no record is ever
  // in both pools, so the term could not change an answer.)
  assert.equal(liveEnchantFoeSinks.length, 5,
    'foe, dungeonCtx, exteriorSinks, insidePool, insideSinks - and nothing else');
});

test('EC1: an exterior record is untouched by the new branch, ctx or no ctx', () => {
  const f = fixture();
  liveEnchantFoeSinks(f.xFoe, f.dungeonCtx, f.exteriorSinks).hurt(4);
  liveEnchantFoeSinks(f.xFoe, null, f.exteriorSinks).hurt(5);
  liveEnchantFoeSinks(f.xFoe, {}, f.exteriorSinks, null, f.insideSinks).hurt(6);
  assert.deepEqual(f.hits, [['exterior', 'street-thug', 4], ['exterior', 'street-thug', 5], ['exterior', 'street-thug', 6]],
    'the path that already worked still works - with a live ctx, with none, and with one still building');
});

test('EC1: the world host consumes the shared law rather than a second copy of it', () => {
  const world = read('src/scenes/world.js');
  assert.equal(/const enchantFoes = \(\) => \(\(modes\?\.mode \?\? 'exterior'\) === 'exterior'/.test(world), false,
    'the exterior-only gate is gone');
  assert.match(world, /const _insidePool = \(\) => modes\?\.insideFoes\?\.\(\) \?\? \[\];/,
    'AUDIT 54: the interior pool is the host\'s own join, not a third spelling of it');
  assert.match(world, /const enchantFoes = \(\) => liveEnchantFoes\(_mode\(\), modes\?\.dungeonCtx \?\? null, \(\) => \[\.\.\.cityGuards\.guards, \.\.\.exteriorFoes\.foes\], _insidePool\);/);
  assert.match(world, /const enchantFoeSinks = \(f\) => liveEnchantFoeSinks\(f, modes\?\.dungeonCtx \?\? null, foeSinks, _insidePool, \(g\) => modes\?\.insideFoeSinksFor\(g\)\);/);
  // and the interior host really answers that sinks door, over its own
  // two pools, with world.js's own _encounter split
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /insideFoeSinksFor\(foe\) \{/, 'the interior host has a foeSinksFor of its own');
  assert.match(wm, /if \(foe\._encounter\) interiorFoes\?\.damageFoe\(foe, n, player\.pos\);\n\s+else interiorGuards\?\.hurtGuard\(foe, n, player\.pos\);/,
    'routed by pool, so the billboard dies in the pool that owns it');
  // every enchant-ctx site that reaches a foe's vitals goes through the
  // router - a bare foeSinks() there is the exterior assumption again.
  //
  // WAVE D: the mount's BODY is scenes/hostEnchant.js, one copy for the
  // two hosts that mount it, so this host hands the router IN and the
  // shared body reaches a foe's vitals only through what it was handed.
  // Both halves are pinned, because either alone would let the
  // exterior assumption back: the host could hand in the raw sinks, or
  // the body could reach past what it was given.
  const at = world.indexOf('setDefaultEnchantCtx(createEnchantCtx({');
  assert.ok(at > 0, 'the host mounts the shared body');
  const mount = world.slice(at, world.indexOf('\n  }\n', at));
  assert.match(mount, /foes: \(\) => enchantFoes\(\),/);
  assert.match(mount, /foeSinks: \(f\) => enchantFoeSinks\(f\),/);
  assert.equal(/[^t]foeSinks\(/.test(mount.replace('foeSinks: (f) => enchantFoeSinks(f),', '')), false,
    'no other site inside the mount reaches the exterior sinks directly');
  const body = read('src/scenes/hostEnchant.js');
  const ctx = body.slice(body.indexOf('export function createEnchantCtx'));
  assert.equal((ctx.match(/foeSinks\(/g) ?? []).length, 3,
    'all three sites route through the handed-in sinks: the caster, the target, and the nearby scan');
  assert.equal(/exteriorFoes|cityGuards|dungeonCtx/.test(ctx), false,
    'and the shared body names no host\'s pool at all');
});

test('EC1: the DETECT feed keeps its own exterior pool - one change, two consumers', () => {
  const world = read('src/scenes/world.js');
  // onDispel removes what it dispels through exteriorFoes.removeFoe, and
  // the HUD markers this frame draws are the exterior ones (dungeon mode
  // draws dungeonContext's HUD off dungeonContext's own feed). Widening
  // the SHARED getter without splitting these would have handed dungeon
  // records to the exterior pool's remover.
  assert.match(world, /const exteriorFoePool = \(\) => \[\.\.\.cityGuards\.guards, \.\.\.exteriorFoes\.foes\];/);
  assert.match(world, /entities: \(\) => exteriorFoePool\(\)\.filter\(\(f\) => !f\.dead && f\.ai\)\.map\(foeNearbyRecord\)/);
  assert.equal(/entities: \(\) => enchantFoes\(\)/.test(world), false,
    'the detect feed must NOT read the live pool - its two consumers are exterior arms');
  assert.match(world, /for \(const f of gone\) exteriorFoes\.removeFoe\(f\);/,
    'the consumer that made the split necessary is still the one that needs it');
});

test('EC1: the two SPAWN arms never stand a foe in a world the player is not in', () => {
  // EC1 made both arms REFUSE in a dungeon, because the only spawner
  // they could reach was the exterior one. SD1 gave them the dungeon's
  // own door an hour later, so the refusal is now the INTERIOR one -
  // the mode that still has no foe pool to stand anything in. The law
  // EC1 was holding is the same; what satisfies it grew.
  const world = read('src/scenes/world.js');
  const at = world.indexOf('const _standLooseFoe =');
  const body = world.slice(at, at + 1600);
  assert.match(body, /if \(mode !== 'exterior' && mode !== 'dungeon'\) return null;/,
    'an interior refuses; the two modes with a pool do not');
  // and neither arm can reach the exterior pool from a dungeon any more
  assert.match(body, /d\n\s*\? d\.spawnLooseFoe\(/, 'a dungeon stands its foe through the DUNGEON\'s chain');
  assert.equal(/spawnFoe\(mobileType, \[pf\[0\] \+ 2, pf\[1\] \+ 1, pf\[2\]\]/.test(world), false,
    'and the fixed player-feet offset both arms used is gone (SD1)');
});

test('EC1/FS1: dungeonContext mounts the ctx, and only when no outer host owns it', () => {
  // FS1 planted the flag; EC1 closed half of it (the world host's
  // dungeon MODE); wave D closed the other half - the STANDALONE host,
  // which had no ctx at all, mounts the shared body now.
  const dc = read('src/scenes/dungeonContext.js').replace(/"[^"]*"/g, '""');
  assert.equal(/its foe pool answers empty by design/.test(dc), false,
    'the retired half of the flag is gone from the sentence that carried it');
  assert.equal(/FLAGGED \(THE FOUR HOSTS RULE\): THE ENCHANT CTX IS NOT/.test(dc), false,
    'and so is the half wave D closed');
  assert.match(dc, /FS1 - SHIPPED \(wave D/);
  // setDefaultEnchantCtx is a SESSION SINGLETON. EC1 routed the world
  // host's mount into this context through modes.dungeonCtx, so a
  // second unconditional mount here would overwrite that one the
  // moment worldModes builds a dungeon - last writer wins, silently.
  assert.match(dc, /if \(opts\.enchantCtx !== false\) \{\n\s*setDefaultEnchantCtx\(createEnchantCtx\(\{/,
    'the mount is gated on the outer host not owning it');
  assert.match(read('src/scenes/worldModes.js'), /\n\s*enchantCtx: false,/,
    'and the outer host says so, beside the chargen: false it already said it with');
});
