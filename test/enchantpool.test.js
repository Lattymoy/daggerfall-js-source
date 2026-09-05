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
import { liveEnchantFoes, liveEnchantFoeSinks, enchantFoeHost } from '../src/scenes/shared.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(HERE, '..', rel), 'utf8');

/** A dungeon context's two enchant-facing members, and a ledger of
 *  which host's damage door each hurt actually went through. */
function fixture() {
  const hits = [];
  const dFoe = { name: 'dungeon-rat' };
  const otherDFoe = { name: 'dungeon-bat' };
  const xFoe = { name: 'street-thug' };
  // AUDIT 58: the interior's TWO pools - the quest/encounter foes IF
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

test('AUDIT 58: an interior answers ITS OWN TWO POOLS - the third live mode had no arm at all', () => {
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
  // AUDIT 58: and an INTERIOR record goes through the interior host's
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

test('AUDIT 58: WHOSE RECORD IS THIS - one membership answer, and the sinks are not its only reader', () => {
  // The sinks were routed by pool membership and the WABBAJACK DOOR in
  // the same mount was not: `replaceFoe` found its record through the
  // widened getter and then reached `exteriorFoes.removeFoe` /
  // `.spawnFoe` unconditionally. Over a foe standing in a shop that is
  // destruction, not transformation - releaseFoeBatch + `dead = true`
  // in a pool that owns neither its billboard nor its death chain -
  // with the new monster stood at the building's coordinates in the
  // street's pool, which the interior frame never ticks. So the
  // question moved into a law of its own, with two readers.
  const f = fixture();
  assert.equal(enchantFoeHost(f.dFoe, f.dungeonCtx, f.insidePool), 'dungeon');
  assert.equal(enchantFoeHost(f.iFoe, f.dungeonCtx, f.insidePool), 'inside');
  assert.equal(enchantFoeHost(f.iWatch, f.dungeonCtx, f.insidePool), 'inside',
    'the indoor watch is the interior host\'s record too - one building, one door');
  assert.equal(enchantFoeHost(f.xFoe, f.dungeonCtx, f.insidePool), 'exterior');
  // THE ORDER IS LOAD-BEARING, not defensive: worldModes' insideFoes()
  // answers the DUNGEON's own pool while a dungeon is mounted, so a
  // test that asked the inside pool first would send every dungeon
  // record to the interior host's remover.
  assert.equal(enchantFoeHost(f.dFoe, f.dungeonCtx, () => [f.dFoe]), 'dungeon',
    'a record in BOTH answers is the dungeon\'s - membership is asked in host order');
  // and a host mid-transition answers exterior rather than throwing
  assert.equal(enchantFoeHost(f.xFoe, null, null), 'exterior');
  assert.equal(enchantFoeHost(f.xFoe, {}, () => undefined), 'exterior');
  // ...and the sinks router is that same answer, not a second copy of it
  const src = read('src/scenes/shared.js');
  assert.match(src, /const host = enchantFoeHost\(foe, dungeonCtx, insidePool\);/,
    'liveEnchantFoeSinks asks the one law');
  assert.equal(liveEnchantFoeSinks.length, 5, 'and its signature is unchanged');
});

test('AUDIT 58: the WABBAJACK re-stands a foe in the pool that owns it', () => {
  // world.js's door, worldModes' interior arm, and dungeonContext's own
  // - three arms, asked in the one order, each removing and re-standing
  // through the pool that owns the record's billboard and collider.
  // WabbajackEffect.cs:85-88 CreateEnemy's the new career under the
  // struck enemy's OWN parent transform, which is what "its own pool"
  // means here.
  const world = read('src/scenes/world.js');
  assert.match(world, /const enchantReplaceFoe = \(targetEntity, mobileType\) => \{/,
    'the body is out of the mount, so the mount names no pool');
  const body = world.slice(world.indexOf('const enchantReplaceFoe ='), world.indexOf('/** SD1: stand a loose foe'));
  assert.match(body, /const host = enchantFoeHost\(f, modes\?\.dungeonCtx \?\? null, _insidePool\);/,
    'it asks the SAME membership law the sinks ask');
  assert.match(body, /if \(host === 'dungeon'\) \{ modes\?\.dungeonCtx\.replaceFoe\?\.\(targetEntity, mobileType\); return; \}/);
  assert.match(body, /if \(host === 'inside'\) \{ Promise\.resolve\(modes\?\.insideReplaceFoe\?\.\(f, mobileType, feet\)\)\.then\(stamp\)\.catch\(\(\) => \{\}\); return; \}/);
  // ROAD-G G1: the exterior arm is a router TOO now, because the street
  // is two pools. `exteriorFoePool` is the watch AND the encounter
  // foes, and this arm handed both to the encounter pool's remover.
  // That was not a leak - removeFoe never looks the record up in `foes`
  // (exteriorFoes.js:253-258) and both pools share the host's one
  // renderer - but the teardown of a watchman is the WATCH's to own,
  // and `removeFoe`'s `questBehaviour?.notifyDestroyed()` is an
  // encounter-pool term a guard has no business reaching, so the
  // removal is routed by pool membership. The RE-STAND stays
  // the encounter pool's for either - WabbajackEffect's careerIDs are
  // seventeen monsters and no Knight_CityWatch, so CreateEnemy always
  // mints an EnemyMonster (WabbajackEffect.cs:24-44, :87-88).
  assert.match(body, /if \(cityGuards\.guards\.includes\(f\)\) cityGuards\.removeGuard\(f\);\n\s+else exteriorFoes\.removeFoe\(f\);\n\s+exteriorFoes\.spawnFoe\(mobileType, feet\)\.then\(stamp\)\.catch\(\(\) => \{\}\);/,
    'the removal goes through the pool that owns the billboard; the re-stand is the encounter pool either way');
  // and the pool really exposes the door the router needs - the
  // SetActive(false) shape, no corpse and no death chain
  const cg = read('src/scenes/cityGuards.js');
  assert.match(cg, /function removeGuard\(g\) \{\n\s+if \(!g \|\| g\.dead\) return;\n\s+releaseGuardBatch\(g\);\n\s+g\.dead = true;/,
    'WabbajackEffect.cs:86 - the struck watchman is REMOVED, not killed');
  assert.match(cg, /snapshotWorld, restoreWorld, removeGuard,/, 'and it is on the pool\'s public surface');
  // and the two DFU laws are still on the way in, once
  assert.match(body, /if \(f\.questBehaviour && !f\.questBehaviour\.isFoeDead\) return;/, 'WabbajackEffect.cs:70-73');
  assert.match(body, /nf\.entity\.wabbajackActive = true;/, 'WabbajackEffect.cs:68');
  assert.match(body, /nf\.entity\.health -= missing;/, 'WabbajackEffect.cs:94');
  assert.equal(/exteriorFoes\.removeFoe\(f\);/.test(body.slice(0, body.indexOf("if (host === 'inside')"))), false,
    'no reach into the street pool happens BEFORE the question is asked');

  // the interior host's arm, over its own remove/spawn pair
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /insideReplaceFoe\(foe, mobileType, feet\) \{\n\s+if \(!foe \|\| !interiorFoes\) return null;\n\s+if \(foe\._encounter\) interiorFoes\.removeFoe\(foe\);\n\s+else if \(interiorGuards\?\.guards\.includes\(foe\)\) interiorGuards\.removeGuard\(foe\);\n\s+else return null;\n\s+return interiorFoes\.spawnFoe\(mobileType, feet\);\n\s+\},/,
    'the interior arm removes through whichever of THIS building\'s two pools owns the record');
  // ROAD-G G1: and the refusal that used to stand here is RETIRED, not
  // reworded. Its whole premise was "createCityGuards exposes no
  // remove/spawn pair"; the pool carries removeGuard now, so the watch
  // transforms like any other EnemyEntity (WabbajackEffect.cs:64).
  assert.equal(/THE WATCH IS REFUSED/.test(wm), false,
    'the written refusal is gone, because the thing it refused on exists');
  // a record from NEITHER pool is still refused - that is the
  // membership question the door exists to ask
  assert.match(wm, /AND THE WATCH TRANSFORMS TOO - the refusal that/);
  // the dungeon host's arm is reachable from the hosted route at all
  assert.match(read('src/scenes/dungeonContext.js'), /\n    replaceFoe: replaceFoeInPool,   \/\/ AUDIT 58/);
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
    'AUDIT 58: the interior pool is the host\'s own join, not a third spelling of it');
  assert.match(world, /const enchantFoes = \(\) => liveEnchantFoes\(_mode\(\), modes\?\.dungeonCtx \?\? null, \(\) => \[\.\.\.cityGuards\.guards, \.\.\.exteriorFoes\.foes\], _insidePool\);/);
  assert.match(world, /const enchantFoeSinks = \(f\) => liveEnchantFoeSinks\(f, modes\?\.dungeonCtx \?\? null, foeSinks, _insidePool, \(g\) => modes\?\.insideFoeSinksFor\(g\)\);/);
  // AUDIT 58 (review): and the MOUNT'S OWN HEADER no longer states the
  // opposite of what the mount does. The parenthetical forty lines
  // above it said the interior mode's foes list is empty "so the scan
  // arms answer none" - the exact premise this lane falsified, struck
  // in its two twins (shared.js, worldModes.js) in the same commit and
  // left standing here. A false sentence in the file the change lands
  // in is how the next reader re-derives the gate.
  assert.equal(/its foes list is empty, so the scan arms answer/.test(world), false,
    'the falsified clause is not still asserted');
  const head = world.slice(world.indexOf('// E2: THE ENCHANTCTX MOUNT'), world.indexOf('const enchantFeet ='));
  assert.match(head, /the clause\n\s*\/\/ that stood here said "its foes list is empty, so the scan arms\n\s*\/\/ answer none", which stopped being true/,
    'it is STRUCK where it stood, not deleted - the record is the point');
  assert.match(head, /answer worldModes' own insideFoes join now, through _insidePool/,
    'and the header says what the arms answer instead');
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
  // AUDIT 58 (review): and NO site in the mount reaches a host pool at
  // all. The grep above was structurally blind to the door that got
  // through - `replaceFoe` sat in this same literal calling
  // `exteriorFoes.removeFoe` / `.spawnFoe` unconditionally over a
  // getter the lane had just widened, so the Wabbajack destroyed a
  // foe standing in a shop with the STREET pool's remover (no corpse,
  // no loot, no interior death chain) and stood its replacement
  // outdoors. A pin that greps for one door's name cannot hold a
  // router; this asks the law instead - every foe door in the mount
  // is a thunk over something that routes by pool membership.
  assert.equal(/exteriorFoes\.|cityGuards\.|dungeonCtx\./.test(mount), false,
    'no site inside the mount names a host pool directly - EVERY foe door routes by membership');
  const body = read('src/scenes/hostEnchant.js');
  const ctx = body.slice(body.indexOf('export function createEnchantCtx'));
  assert.equal((ctx.match(/foeSinks\(/g) ?? []).length, 3,
    'all three sites route through the handed-in sinks: the caster, the target, and the nearby scan');
  assert.equal(/exteriorFoes|cityGuards|dungeonCtx/.test(ctx), false,
    'and the shared body names no host\'s pool at all');
});

test('AUDIT 58 (f2/hosts): the EXTERIOR host mounts the same body over its own pools', () => {
  // The third host that can hold an enchanted item and mounted nothing.
  // `_defaultCtx` is a session singleton (enchantments.js:249-251) and
  // in a ?exterior session it stayed null for the whole boot, so every
  // arm that folds it in optional-chained into silence - CastWhenUsed
  // and CastWhenStrikes found no record and still billed 10 condition,
  // HealthLeech never billed the wearer and stamped its last-used
  // minute at epoch 0, CastWhenHeld could never take the resting
  // degrade rate, and the held/round scans saw nothing. And because
  // this host builds createWorldModes - which passes `enchantCtx:
  // false` on the premise that an outer host owns the mount - the
  // dungeons and shops entered from here inherited the hole.
  const ext = read('src/scenes/exterior.js');
  assert.match(ext, /import \{ setDefaultEnchantCtx \} from '\.\.\/systems\/enchantments\.js';/);
  assert.match(ext, /import \{ createEnchantCtx, standLooseFoe \} from '\.\/hostEnchant\.js';/);
  const at = ext.indexOf('setDefaultEnchantCtx(createEnchantCtx({');
  assert.ok(at > 0, 'the host mounts the SHARED body, not a second copy of it');
  // ...and it mounts AFTER the mode machine exists, so the fold routes
  // by LIVE mode the way EC1 routes world.js's.
  assert.ok(ext.indexOf('var modes = createWorldModes({') < at,
    'the mount comes after `var modes = ...` - a mount above it reads undefined for every mode');
  // the three live reads, through the ONE shared law, over THIS host's
  // own pools: BOTH street pools above ground (ROAD-G G2 mounted the
  // encounter pool beside the watch and struck the "it mints no
  // encounter foes" clause that stood here), and worldModes' own two
  // arms for inside and below. The exterior arm is the host's ONE
  // named join, not a second spread - two spreads is two laws.
  assert.match(ext, /const _insidePool = \(\) => modes\?\.insideFoes\?\.\(\) \?\? \[\];/);
  assert.match(ext, /const enchantFoes = \(\) => liveEnchantFoes\(_mode\(\), modes\?\.dungeonCtx \?\? null, exteriorFoePool, _insidePool\);/);
  assert.match(ext, /const enchantFoeSinks = \(f\) => liveEnchantFoeSinks\(f, modes\?\.dungeonCtx \?\? null, foeSinks, _insidePool, \(g\) => modes\?\.insideFoeSinksFor\(g\)\);/);
  // the same law the world host's mount is held to: NO site inside the
  // ctx literal names a host pool - every foe door is a thunk over
  // something that routes by membership. This is the exact shape the
  // AUDIT 58 review caught in world.js's `replaceFoe`.
  const mount = ext.slice(at, ext.indexOf('\n  }\n', at));
  assert.match(mount, /foes: \(\) => enchantFoes\(\),/);
  assert.match(mount, /foeSinks: \(f\) => enchantFoeSinks\(f\),/);
  assert.equal(/cityGuards\.|dungeonCtx\.|interiorFoes/.test(mount), false,
    'no site inside the mount names a host pool directly');
  // and the reflection path travels with the player's OWN sinks, which
  // is why they are hoisted here rather than inlined into the cast
  // engine (effects.js:828/:842 heals the caster through them).
  assert.match(ext, /const playerSpellSinks = \{/);
  assert.match(ext, /^\s*playerSinks: playerSpellSinks,$/m, 'one object, both readers');
  assert.match(mount, /^\s*playerSpellSinks,$/m);
  // ROAD-G G2: THE WABBAJACK'S EXTERIOR ARM TRANSFORMS NOW. It refused
  // and said why - "the watch has no remove/spawn pair" - which was
  // true of the only pool this host had; the encounter pool mounted
  // beside it owns both, so an encounter or quest foe struck in the
  // street is removed and re-stood by the pool that owns its billboard
  // (WabbajackEffect.cs:85-88). The WATCH is still left standing, and
  // that departure moved from "no arm" to a named test.
  const rf = ext.slice(ext.indexOf('const _enchantReplaceFoe ='), at);
  assert.match(rf, /const host = enchantFoeHost\(f, modes\?\.dungeonCtx \?\? null, _insidePool\);/);
  assert.match(rf, /if \(host === 'dungeon'\)/);
  assert.match(rf, /if \(host === 'inside'\)/);
  assert.match(rf, /if \(!f\._encounter\) return;/, 'the watch is named by MEMBERSHIP, not by pool identity');
  assert.match(rf, /exteriorFoes\.removeFoe\(f\);\n\s*exteriorFoes\.spawnFoe\(mobileType, feet\)/);
  assert.equal(/cityGuards\./.test(rf), false, 'and the arm still never names the watch pool');
  // the loose-foe arm reaches whichever pool the player is standing in
  // (SD1) - the dungeon's own chain below, this host's encounter pool
  // above ground - and INTERIOR still refuses, which is world.js's own
  // answer for the same mode.
  const sf = ext.slice(ext.indexOf('const _standLooseFoe ='), ext.indexOf('const _enchantReplaceFoe ='));
  assert.match(sf, /if \(mode !== 'exterior' && mode !== 'dungeon'\) return null;/);
  // the MODE gate is the ONLY refusal - a `if (!d) return null;` after
  // it is the pre-ROAD-G G2 body and refuses the whole exterior arm
  // while leaving every other assertion in this pin green.
  assert.match(sf, /const d = mode === 'dungeon' \? \(modes\?\.dungeonCtx \?\? null\) : null;\n\s*return standLooseFoe\(\{/);
  assert.match(sf, /collider: d \? d\.collider : collider,/, 'and it rays through the world it is standing in');
  assert.match(sf, /\? d\.spawnLooseFoe\(mt, pos, \{ yawRad: so\.yawRad, allied: so\.allied \}\)\n\s*: exteriorFoes\.spawnFoe\(mt, pos, \{ yaw: so\.yawRad, allied: so\.allied \}\)/);
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

test('EC1/ROAD-G G1: the two SPAWN arms stand a foe in the world the player IS in, through that world\'s own pool', () => {
  // THE LAW EC1 WAS HOLDING, RESTATED FOR THE THIRD TIME AND FINALLY
  // POSITIVE. EC1 made both arms REFUSE in a dungeon, because the only
  // spawner they could reach was the exterior one; SD1 gave them the
  // dungeon's own door an hour later and the refusal narrowed to the
  // INTERIOR. ROAD-G G1 closes that last one: the premise EC1 wrote -
  // "interiors have no foe pool to stand one in" - died the day
  // `interiorFoes.spawnFoe` went live, and nothing had gone back to
  // read it. So SoulBound's break release and the Sanguine Rose's
  // Daedroth stood NOWHERE in a building for as long as the pool
  // existed.
  //
  // DFU has no mode gate here at all. CreateFoe picks a PLACEMENT per
  // area (CreateFoe.cs:195-212) and every branch places:
  // PlaceFoeBuildingInterior (:219-233) is PlaceFoeFreely over the
  // building's own transform - DFU's own comment refuses the interior
  // spawn nodes for exactly this case ("Always place foes around
  // player rather than use spawn points") - and PlaceFoeDungeonInterior
  // (:238-241) is the identical call over the dungeon's. The port's
  // gate was never DFU's; what a mode must have is a POOL, and each of
  // the three now stands its foe through its own.
  const world = read('src/scenes/world.js');
  const at = world.indexOf('const _standLooseFoe =');
  const body = world.slice(at, at + 2400);
  assert.match(body, /if \(mode === 'interior'\) return modes\?\.insideStandLooseFoe\?\.\(mobileType, opts\) \?\? null;/,
    'a building stands its foe through the INTERIOR host - never this host\'s street pool, which is what enchantFoeHost routes for the sinks');
  assert.match(body, /d\n\s*\? d\.spawnLooseFoe\(/, 'a dungeon stands its foe through the DUNGEON\'s chain');
  assert.match(body, /: exteriorFoes\.spawnFoe\(mt, pos, \{ yaw: o\.yawRad, allied: o\.allied \}\)/,
    'and the street through its own encounter pool');
  // The gate that remains is not a mode gate but a POOL gate, and it
  // still refuses: a mode this host does not know is not a world with
  // a spawner in it.
  assert.match(body, /if \(mode !== 'exterior' && mode !== 'dungeon'\) return null;/,
    'a mode with no pool at all still refuses');
  assert.equal(/spawnFoe\(mobileType, \[pf\[0\] \+ 2, pf\[1\] \+ 1, pf\[2\]\]/.test(world), false,
    'and the fixed player-feet offset both arms used is gone (SD1)');
  // THE FOUR HOSTS RULE: the fixed-city route mounts the SAME mode
  // machine, so it takes the same arm - it refused interiors on a
  // clause ("a building has none of its own here at all") that was
  // never about this host.
  assert.ok(read('src/scenes/exterior.js').includes("if (_mode() === 'interior') return modes?.insideStandLooseFoe?.(mobileType, o) ?? null;"),
    'and so does ?exterior');
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
