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
  const dungeonCtx = {
    foes: [dFoe, otherDFoe],
    foeSinksFor: (f) => ({ hurt: (n) => hits.push(['dungeon', f.name, n]) }),
  };
  const exteriorSinks = (f) => ({ hurt: (n) => hits.push(['exterior', f.name, n]) });
  return { hits, dFoe, otherDFoe, xFoe, dungeonCtx, exteriorSinks, exteriorPool: () => [xFoe] };
}

test('EC1: the live pool follows the MODE - dungeon foes are reachable', () => {
  const f = fixture();
  assert.deepEqual(liveEnchantFoes('dungeon', f.dungeonCtx, f.exteriorPool), [f.dFoe, f.otherDFoe],
    'the mode the player fights in is the one the gate used to empty');
  assert.deepEqual(liveEnchantFoes('exterior', f.dungeonCtx, f.exteriorPool), [f.xFoe],
    'and the exterior pool is still exactly the exterior pool - a dungeon ctx left mounted from a previous descent cannot leak into it');
});

test('EC1: an interior answers EMPTY, and that is the honest answer rather than a gate', () => {
  const f = fixture();
  assert.deepEqual(liveEnchantFoes('interior', f.dungeonCtx, f.exteriorPool), [],
    'the port stands no foe pool inside a building; DFU\'s list holds enemies and civilian mobiles, neither of which exists there');
  // and it does not silently borrow the exterior pool it is standing on
  assert.equal(liveEnchantFoes('interior', null, f.exteriorPool).length, 0);
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
  // and the router takes no mode at all - it cannot be asked the wrong
  // question. (It took one until the campaign showed no record is ever
  // in both pools, so the term could not change an answer.)
  assert.equal(liveEnchantFoeSinks.length, 3, 'foe, dungeonCtx, exteriorSinks - and nothing else');
});

test('EC1: an exterior record is untouched by the new branch, ctx or no ctx', () => {
  const f = fixture();
  liveEnchantFoeSinks(f.xFoe, f.dungeonCtx, f.exteriorSinks).hurt(4);
  liveEnchantFoeSinks(f.xFoe, null, f.exteriorSinks).hurt(5);
  liveEnchantFoeSinks(f.xFoe, {}, f.exteriorSinks).hurt(6);
  assert.deepEqual(f.hits, [['exterior', 'street-thug', 4], ['exterior', 'street-thug', 5], ['exterior', 'street-thug', 6]],
    'the path that already worked still works - with a live ctx, with none, and with one still building');
});

test('EC1: the world host consumes the shared law rather than a second copy of it', () => {
  const world = read('src/scenes/world.js');
  assert.equal(/const enchantFoes = \(\) => \(\(modes\?\.mode \?\? 'exterior'\) === 'exterior'/.test(world), false,
    'the exterior-only gate is gone');
  assert.match(world, /const enchantFoes = \(\) => liveEnchantFoes\(_mode\(\), modes\?\.dungeonCtx \?\? null, \(\) => \[\.\.\.cityGuards\.guards, \.\.\.exteriorFoes\.foes\]\);/);
  assert.match(world, /const enchantFoeSinks = \(f\) => liveEnchantFoeSinks\(f, modes\?\.dungeonCtx \?\? null, foeSinks\);/);
  // every enchant-ctx site that reaches a foe's vitals goes through the
  // router - a bare foeSinks() there is the exterior assumption again
  const at = world.indexOf('setDefaultEnchantCtx({');
  const mount = world.slice(at, world.indexOf('const detectFeed', at) > at ? world.indexOf('const detectFeed', at) : at + 6000);
  assert.equal(/[^t]foeSinks\(/.test(mount), false, 'no site inside the mount reaches the exterior sinks directly');
  assert.equal((mount.match(/enchantFoeSinks\(/g) ?? []).length, 3, 'all three sites route: the caster, the target, and the nearby scan');
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

test('EC1: the two SPAWN arms refuse in a dungeon rather than standing a foe in the wrong world', () => {
  const world = read('src/scenes/world.js');
  const at = world.indexOf('spawnFoe: (mobileType) => {');
  const arms = world.slice(at, at + 700);
  assert.equal((arms.match(/if \(_dungeonPool\(\)\) return;/g) ?? []).length, 2,
    'both SoulBound\'s break release and the Sanguine Rose refuse');
  // and they still work where the pool they spawn into is the live one
  assert.match(arms, /exteriorFoes\.spawnFoe\(mobileType, \[pf\[0\] \+ 2, pf\[1\] \+ 1, pf\[2\]\]\)/);
  assert.match(arms, /exteriorFoes\.spawnFoe\(mobileType, \[pf\[0\] \+ 2, pf\[1\] \+ 1, pf\[2\]\], \{ allied: true \}\)/);
  // the refusal is FLAGGED, not silent doctrine
  assert.match(world, /FLAGGED: the dungeon spawner is spawnQuestFoe/);
});

test('EC1: dungeonContext\'s flag narrows to what is still open', () => {
  // FS1 planted it; EC1 closed half of it. The half that is still true
  // is the STANDALONE host, which has no ctx at all.
  const dc = read('src/scenes/dungeonContext.js').replace(/"[^"]*"/g, '""');
  assert.equal(/its foe pool answers empty by design/.test(dc), false,
    'the retired half of the flag is gone from the sentence that carried it');
  assert.match(dc, /EC1 closed that one/);
  assert.match(dc, /FLAGGED \(THE FOUR HOSTS RULE\): THE ENCHANT CTX IS NOT/,
    'and the half that is still open still stands');
});
