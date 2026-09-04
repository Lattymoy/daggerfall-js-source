// ---------------------------------------------------------------------------
// ROAD-G G1 - THE FOE POOLS' THREE REMAINDERS (2026-09-04).
//
// Audit 58 left three, each recorded at its site rather than flagged,
// and all three were the same shape: a LAW the port already owned,
// refused at one pool because that pool had never been given the door
// the other pools had.
//
//  (a) `createCityGuards` took no `makeAreaHostile` dep at all, so
//      striking a PASSIVE watchman turned nobody. GameManager
//      .MakeEnemiesHostile (GameManager.cs:790-806) walks the whole
//      ActiveGameObjectDatabase whenever a non-hostile enemy is struck
//      by the player (DaggerfallEntityBehaviour.cs:255-258) - and
//      Knight_CityWatch is an EnemyClass, one of the two EntityTypes
//      that walk (:250). Both encounter pools had carried the pair
//      since ROAD-B; the watch had neither half of it, so a watchman
//      talked down by Etiquette and then struck stayed passive, and so
//      did every other enemy in the area.
//
//  (b) The WATCH refused the Wabbajack. DFU transforms any
//      `EnemyEntity` (WabbajackEffect.cs:63-95) and a watchman is one,
//      but the guard pool exposed no removal door, so both hosts wrote
//      the refusal into the code instead. Worse in the street than the
//      note admitted: world.js's exterior arm handed a struck watchman
//      to the ENCOUNTER pool's `removeFoe`, which could not find it -
//      so the guard kept standing, kept swinging and kept its VAO
//      while its replacement stood up beside it.
//
//  (c) `world.js`'s `_standLooseFoe` refused INTERIOR mode on the
//      premise "interiors have no foe pool to stand one in", which
//      died the day `interiorFoes.spawnFoe` went live. SoulBound's
//      break release and the Sanguine Rose's Daedroth could not be
//      stood in a building - and CreateFoe has no mode gate at all:
//      PlaceFoeBuildingInterior (CreateFoe.cs:219-233) is
//      PlaceFoeFreely over the building, the same member the dungeon
//      arm gets, and the same one `tryPlaceInteriorQuestFoe` already
//      stands quest foes through.
//
// The wiring pins here are source pins because their hosts need a
// browser; the POOL's two new doors are driven for real against the
// live module, with no ARENA2 needed - the records are pushed onto the
// pool's own public `guards` array, which is how the pool hands them
// to every host reader anyway.
// ---------------------------------------------------------------------------
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCityGuards, GUARD_MOBILE_TYPE } from '../src/scenes/cityGuards.js';
import { PLAYER_TARGET } from '../src/characters/enemyTargets.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

/** The pool's seams, with the two observables this file needs: how
 *  many billboard batches were freed, and every makeAreaHostile call. */
function pool({ makeAreaHostile } = {}) {
  const freed = { n: 0 };
  const g = createCityGuards({
    renderer: {
      createBillboardBatch: () => ({}),
      destroyBillboardBatch: () => { freed.n++; },
      textures: new Map(),
    },
    collider: { heightAt: () => 0, raycast: () => Infinity, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
    fetchBytes: () => new Promise(() => {}),   // no ARENA2: no spawn ever completes, and none is asked for
    getTexture: () => new Promise(() => {}),
    uploadRecordFrame: () => {},
    currentMinute: () => 523530,
    playerEntity: { level: 1, reflexes: 2, crimeCommitted: 0 },
    audio: null,
    onPlayerHurt: () => {},
    makeAreaHostile,
  });
  return { g, freed };
}

/** A live watchman record in the shape the pool's own spawn builds -
 *  enough of one for the damage door and the removal door to run. */
function watchman({ hostile = true, team = 'CityWatch' } = {}) {
  const calls = [];
  return {
    id: 1, dead: false, batch: {}, mobileType: GUARD_MOBILE_TYPE,
    entity: { health: 40, maxHealth: 40, activeEffects: [], items: [], team },
    ai: {
      isHostile: hostile, feet: [1, 0, 1], yaw: 0, knockbackSpeed: 0,
      calls,
      makeEnemyHostileToAttacker(t, f) { calls.push([t, f, this.isHostile]); },
    },
  };
}

// ═══ (a) the struck PASSIVE watchman turns the whole area ═══
test('ROAD-G G1(a): a struck PASSIVE watchman walks the area; a hostile one does not', () => {
  // DaggerfallEntityBehaviour.cs:255-258 verbatim - the walk is
  // conditional on `!enemyMotor.IsHostile`, and nothing else in the
  // block is.
  const walks = [];
  const { g } = pool({ makeAreaHostile: () => walks.push('walk') });

  const passive = watchman({ hostile: false });
  g.guards.push(passive);
  g.hurtGuard(passive, 3, [0, 0, 0]);
  assert.deepEqual(walks, ['walk'], 'the pacified watchman turns the whole active database');
  assert.equal(passive.ai.isHostile, true, 'and himself');

  // ...and a second blow on the now-hostile guard walks nothing: DFU
  // asks IsHostile every time, so the walk is once per stand-down.
  g.hurtGuard(passive, 3, [0, 0, 0]);
  assert.deepEqual(walks, ['walk'], 'an already-hostile enemy does not re-walk the database');

  const hostile = watchman({ hostile: true });
  g.guards.push(hostile);
  g.hurtGuard(hostile, 3, [0, 0, 0]);
  assert.deepEqual(walks, ['walk'], 'and a guard that was hostile all along never walks it');
});

test('ROAD-G G1(a): the READ precedes the walk, and the walk precedes the flip', () => {
  // The ordering IS the law: MakeEnemyHostileToAttacker's player arm
  // (:204-213) raises IsHostile, so reading the flag after it would
  // make :255-258 unreachable for the only case it exists for.
  const seen = [];
  const { g } = pool({ makeAreaHostile: () => seen.push('walk') });
  const w = watchman({ hostile: false });
  w.ai.makeEnemyHostileToAttacker = function (t, f) { seen.push(['attacker', t, f]); this.isHostile = true; };
  g.guards.push(w);
  g.hurtGuard(w, 5, [7, 0, 8]);
  assert.deepEqual(seen, ['walk', ['attacker', PLAYER_TARGET, [7, 0, 8]]],
    'the whole-area walk fires FIRST, then this foe learns where the blow came from');
});

test('ROAD-G G1(a): the door is gated on the PLAYER being the source (F035\'s law, kept)', () => {
  const walks = [];
  const { g } = pool({ makeAreaHostile: () => walks.push('walk') });
  const w = watchman({ hostile: false });
  g.guards.push(w);
  // the cross-pool door a monster's swing comes through, and the fall
  // arm - EnemyMotor.ApplyFallDamage calls DecreaseHealth and nothing
  // else (:1398-1401)
  w.hurtFromFoe = null;
  g.hurtGuard(w, 0, null, null);   // still a PLAYER blow: WeaponManager.cs:630 sits outside the `damage > 0` fork
  assert.deepEqual(walks, ['walk'], 'a connecting swing that dealt nothing still reaches the door');
  assert.equal(w.ai.calls.length, 1);
});

test('ROAD-G G1(a): a struck former ALLY reverts to the static row\'s team', () => {
  // EnemyMotor.MakeEnemyHostileToAttacker's player arm (:204-213) reads
  // the STATIC table by mobile ID, never the instance's own copy.
  const { g } = pool({ makeAreaHostile: () => {} });
  const w = watchman({ hostile: false, team: 'PlayerAlly' });
  g.guards.push(w);
  g.hurtGuard(w, 2, [0, 0, 0]);
  assert.equal(w.entity.team, 'CityWatch', 'Knight_CityWatch\'s row team, not PlayerAlly');
});

test('ROAD-G G1(a): every host that mints guards hands in its own area walk', () => {
  // THE FOUR HOSTS RULE. The dep is useless unwired, and the three
  // hosts that mint watchmen must each walk their OWN database -
  // ActiveGameObjectDatabase is one database per scene, not per pool.
  const cg = read('src/scenes/cityGuards.js');
  assert.match(cg, /^  makeAreaHostile = null,$/m, 'the dep defaults absent (the pre-wiring shape)');
  assert.match(cg, /if \(!g\.ai\.isHostile\) makeAreaHostile\?\.\(\);/);

  const w = read('src/scenes/world.js');
  const guardMount = w.slice(w.indexOf('const cityGuards = createCityGuards({'), w.indexOf('const exteriorFoes = createExteriorFoes({'));
  assert.match(guardMount, /makeAreaHostile: _makeEnemiesHostile,/,
    'the streaming world: both street pools joined with whatever inside the player stands in');

  const ex = read('src/scenes/exterior.js');
  assert.match(ex, /const _liveEnemyDatabase = \(\) => \[\n\s*\.\.\.exteriorFoes\.foes, \.\.\.cityGuards\.guards, \.\.\.\(modes\?\.insideFoes\?\.\(\) \?\? \[\]\),\n\s*\];/);   // ROAD-G G2 widened the join to the encounter pool it mounted
  const exMount = ex.slice(ex.indexOf('const cityGuards = createCityGuards({'), ex.indexOf('const _guardPool = ()'));
  assert.match(exMount, /makeAreaHostile: _makeEnemiesHostile,/, 'the fixed-city route: its watch plus the mounted mode');

  const wm = read('src/scenes/worldModes.js');
  const inMount = wm.slice(wm.indexOf('function makeInteriorGuards(ctx) {'));
  assert.match(inMount.slice(0, 2200), /makeAreaHostile: \(\) => makeEnemiesHostile\(interiorEnemyDatabase\(\)\),/,
    'the interior watch: THIS building\'s one database, which is both of its pools');
});

// ═══ (b) the Wabbajack transforms the watch ═══
test('ROAD-G G1(b): removeGuard is WabbajackEffect\'s SetActive(false), not a death', () => {
  const { g, freed } = pool();
  const w = watchman();
  g.guards.push(w);
  g.removeGuard(w);
  assert.equal(w.dead, true, 'off the scene');
  assert.equal(w.corpse, undefined, 'and NOT killed - no corpse, no loot, no death chain');
  assert.equal(w.batch, null);
  assert.equal(freed.n, 1, 'the billboard batch is freed - every allocation has an owner');

  // idempotent, like the encounter pool's removeFoe: a second call
  // cannot double-free the VAO
  g.removeGuard(w);
  assert.equal(freed.n, 1);
  g.removeGuard(null);
  assert.equal(freed.n, 1);
});

test('ROAD-G G1(b): both hosts route the transform by POOL MEMBERSHIP', () => {
  // The removal goes through the pool that owns the billboard; the
  // RE-STAND is the encounter pool either way, because
  // WabbajackEffect's careerIDs are seventeen monsters and no
  // Knight_CityWatch (:24-44), so CreateEnemy always mints an
  // EnemyMonster.
  const w = read('src/scenes/world.js');
  assert.match(w, /if \(cityGuards\.guards\.includes\(f\)\) cityGuards\.removeGuard\(f\);\n\s+else exteriorFoes\.removeFoe\(f\);/,
    'the street: a struck watchman is no longer handed to the encounter pool\'s remover, which could not find it');
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /else if \(interiorGuards\?\.guards\.includes\(foe\)\) interiorGuards\.removeGuard\(foe\);/,
    'the building: the indoor watch transforms like any foe');
  assert.equal(/THE WATCH IS REFUSED/.test(wm), false, 'and the written refusal is retired, not reworded');
});

// ═══ (c) the loose foe stands where the player is standing ═══
test('ROAD-G G1(c): the SPAWN arms stand a foe in the world the player IS in', () => {
  // EC1's refusal was "interiors have no foe pool to stand one in".
  // They have had one since IF. CreateFoe.cs:195-212 picks a placement
  // per area and never refuses; :219-233 is PlaceFoeFreely over the
  // building, which is what worldModes' door does.
  const wm = read('src/scenes/worldModes.js');
  const stand = wm.slice(wm.indexOf('function standInteriorLooseFoe('), wm.indexOf('function makeInteriorFoes('));
  assert.match(stand, /if \(!interiorCtx \|\| !interiorFoes\) return null;/, 'no building mounted is the only refusal left');
  assert.match(stand, /collider: interiorCtx\.collider,/, 'raycast against THIS building');
  assert.match(stand, /foes: interiorFoePool\(\),/, 'and the occupancy test walks both of its pools - the watch blocks a spot too');
  assert.match(stand, /spawn: \(mt, pos, o\) => interiorFoes\.spawnFoe\(mt, pos, \{ yaw: o\.yawRad, allied: o\.allied \}\),/,
    'through the building\'s own chain, carrying allied for the Sanguine Rose');
  assert.match(wm, /insideStandLooseFoe\(mobileType, opts = \{\}\) \{ return standInteriorLooseFoe\(mobileType, opts\); \},/);

  // ...and BOTH hosts that mount the mode machine reach it, because it
  // is the SAME machine for both routes.
  for (const [rel, needle] of [
    ['src/scenes/world.js', "if (mode === 'interior') return modes?.insideStandLooseFoe?.(mobileType, opts) ?? null;"],
    ['src/scenes/exterior.js', "if (_mode() === 'interior') return modes?.insideStandLooseFoe?.(mobileType, o) ?? null;"],
  ]) assert.ok(read(rel).includes(needle), `${rel} routes its interior arm to the pool that owns the building`);
});
