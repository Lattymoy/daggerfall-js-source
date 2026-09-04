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
//      the refusal into the code instead. In the street the arm handed
//      a struck watchman to the ENCOUNTER pool's `removeFoe` - which
//      was not a leak: that remover never looks the record up in
//      `foes` (exteriorFoes.js:247-252) and both pools share the host's
//      one renderer, so the watchman got exactly what `removeGuard`
//      gives it. Routing by POOL MEMBERSHIP is an OWNERSHIP law: each
//      pool owns the teardown of its own records, and `removeFoe`'s
//      `questBehaviour?.notifyDestroyed()` is an encounter-pool term
//      the watch has no business reaching.
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
import { playerArrowHitFoe } from '../src/combat/arrowFlight.js';

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

test('ROAD-G G1(a): a connecting swing that dealt NOTHING still reaches the door', () => {
  // WeaponManager.cs:630's HandleAttackFromSource sits outside the
  // `damage > 0` fork that closes at :615, so a swing that lost the
  // to-hit roll still turns what it touched.
  const walks = [];
  const { g } = pool({ makeAreaHostile: () => walks.push('walk') });
  const w = watchman({ hostile: false });
  g.guards.push(w);
  g.hurtGuard(w, 0, null, null);
  assert.deepEqual(walks, ['walk'], 'a connecting swing that dealt nothing still reaches the door');
  assert.equal(w.ai.calls.length, 1);
});

test('ROAD-G G1(a): the door is gated on the PLAYER being the source (F035\'s law, kept)', () => {
  // ROAD-G G1 (review): the pin that used to carry this title drove
  // `hurtGuard`, which forwards no options bag - so `fromPlayer`
  // always defaulted TRUE and the negative arm was unreachable from
  // it. The gate is DFU's `sourceEntityBehaviour ==
  // PlayerEntityBehaviour` (DaggerfallEntityBehaviour.cs:203) wrapping
  // the whole aggro block at :250-261: a watchman struck by a rat
  // (the cross-pool `hurtFromFoe` minted at cityGuards.js:264) or
  // killed by a fall (EnemyMotor.ApplyFallDamage calls DecreaseHealth
  // and nothing else, :1398-1401) must turn NOBODY.
  //
  // MUTANT: drop the `if (fromPlayer)` at cityGuards.js's aggro call
  // and all three assertions below go red.
  const walks = [];
  const { g } = pool({ makeAreaHostile: () => walks.push('walk') });
  const w = watchman({ hostile: false, team: 'PlayerAlly' });
  g.guards.push(w);
  g._damage(0, 3, { fromPlayer: false });
  assert.deepEqual(walks, [], 'a rat\'s blow does not walk the active database');
  assert.equal(w.ai.calls.length, 0, 'nor seeds this guard\'s own target/give-up bookkeeping');
  assert.equal(w.entity.team, 'PlayerAlly', 'nor reverts the ally team - :204-213 never runs');
  assert.equal(w.ai.isHostile, false, 'and the watchman stays pacified');
  // ...and the SAME door with the bag left off is a player blow, so all
  // three statements run: the gate is the only difference.
  g._damage(0, 3);
  assert.deepEqual(walks, ['walk']);
  assert.equal(w.ai.calls.length, 1);
  assert.equal(w.entity.team, 'CityWatch');
});

test('ROAD-G G1(a): a ZERO-DAMAGE player ARROW reaches the watch\'s door too', () => {
  // ROAD-G G1 (review): the lane wired the aggro block for the MELEE
  // arms only. An arrow reaches a pool through TWO seams - `dealDamage`,
  // which arrowFlight calls inside its own `dmg > 0` fork
  // (arrowFlight.js:186-192), and `onAttackFromPlayer`, which it calls
  // unconditionally at :195 because that is where WeaponManager.cs:630
  // lives - and all three hosts that resolve a player shaft EXCLUDED the
  // guards from the second one, on a sentence this pool's own
  // `handleAttackFromPlayer` had already falsified. DFU makes no such
  // distinction: AssignBowDamageToTarget's player arm
  // (DaggerfallMissile.cs:660-688) calls WeaponManager.WeaponDamage, so
  // :630 runs for the shaft exactly as for the swing.
  //
  // MUTANTS: (1) drop `handleAttackFromPlayer` from the pool's returned
  // surface and this throws; (2) restore the hosts' exclusion arm
  // (`if (!cityGuards.guards.includes(f)) ...`) and the source pin below
  // goes red.
  const walks = [];
  const { g } = pool({ makeAreaHostile: () => walks.push('walk') });
  const w = watchman({ hostile: false, team: 'PlayerAlly' });
  // FormulaHelper.cs:576-583: a weapon material the target refuses
  // returns 0 - a shaft that CONNECTED and dealt nothing, DFU's way
  // (formulas.js:523-531).
  w.entity.minMetalToHit = 1;
  g.guards.push(w);
  const hits = [];
  const dmg = playerArrowHitFoe({ pos: [1, 0, 4], dir: [0, 0, -1], weapon: { material: 0, templateIndex: 121 } }, w, {
    playerEntity: { isPlayer: true, level: 1, skills: {}, items: [], stats: {} },
    playerFeet: [1, 0, 4],
    // the host's router, verbatim in shape: the damage door is the
    // pool's own, and it never fires for a zero-damage shaft...
    dealDamage: (f, d) => hits.push(d),
    // ...while the hostility seam is unconditional and routes by pool.
    onAttackFromPlayer: (f) => (g.guards.includes(f)
      ? g.handleAttackFromPlayer(f, [1, 0, 4])
      : assert.fail('the watchman must take the WATCH pool\'s door')),
  });
  assert.equal(dmg, 0, 'the material was refused: the shaft connected and dealt nothing');
  assert.deepEqual(hits, [], 'so the damage door never ran');
  assert.deepEqual(walks, ['walk'], 'and the pacified watchman still turned the whole active database');
  assert.equal(w.ai.calls.length, 1, 'and learned where the shaft came from');
  assert.equal(w.ai.isHostile, true);
  assert.equal(w.entity.team, 'CityWatch', 'and the ally team reverted to the static row');
});

test('ROAD-G G1(a): all three arrow hosts ROUTE the hostility seam by pool', () => {
  // The door is PUBLIC now, as the encounter pool's has always been
  // (exteriorFoes.js:957), so every host can reach it.
  const cg = read('src/scenes/cityGuards.js');
  assert.match(cg, /restoreWorld, removeGuard, handleAttackFromPlayer,/,
    'the watch exports its hostility pair on the returned surface');
  const router = (pool) => new RegExp(`onAttackFromPlayer: \\(f\\) => \\(${pool}`);
  assert.match(read('src/scenes/world.js'), router('cityGuards\\.guards\\.includes\\(f\\)\\n\\s+\\? cityGuards\\.handleAttackFromPlayer\\(f, player\\.pos\\)\\n\\s+: exteriorFoes\\.handleAttackFromPlayer\\(f, player\\.pos\\)\\),'),
    'the street routes by pool membership, as its dealDamage does');
  assert.match(read('src/scenes/exterior.js'), router('cityGuards\\.guards\\.includes\\(f\\)\\n\\s+\\? cityGuards\\.handleAttackFromPlayer\\(f, player\\.pos\\)\\n\\s+: exteriorFoes\\.handleAttackFromPlayer\\(f, player\\.pos\\)\\),'),
    'the exterior host too - it mounts both pools');
  assert.match(read('src/scenes/worldModes.js'), router('f\\._encounter\\n\\s+\\? interiorFoes\\?\\.handleAttackFromPlayer\\(f, player\\.pos\\)\\n\\s+: interiorGuards\\?\\.handleAttackFromPlayer\\(f, player\\.pos\\)\\),'),
    'and the interior watch, which the encounter half used to drop');
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js']) {
    assert.equal(/carries no hostility pair/.test(read(f)), false,
      `${f}: the false sentence is struck, not reworded`);
  }
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
    'the street: the removal goes through the pool that owns the record, not the encounter pool\'s remover');
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /else if \(interiorGuards\?\.guards\.includes\(foe\)\) interiorGuards\.removeGuard\(foe\);/,
    'the building: the indoor watch transforms like any foe');
  assert.equal(/THE WATCH IS REFUSED/.test(wm), false, 'and the written refusal is retired, not reworded');

  // ROAD-G G1 (review): the RATIONALE this lane first wrote was FALSE
  // and is struck in all seven places it reached. `removeFoe`
  // (exteriorFoes.js:247-252) never looks a record up in `foes` and
  // both pools share the host's one renderer, so the old arm tore a
  // watchman down exactly as `removeGuard` does - batch freed,
  // `dead = true`, no corpse, skipped by cityGuards.js:718 and spliced
  // at :889 in that same pass. The router is an OWNERSHIP fix, not a
  // leak fix, and no page may say otherwise again.
  // (the halves are joined at runtime so this very file does not carry
  // the sentence it bans)
  const struck = [['kept', 'standing'], ['kept its', 'VAO'], ['stood up', 'beside'], ['could not', 'find it']]
    .map(([a, b]) => new RegExp(`${a} ${b}`));
  for (const rel of ['src/scenes/world.js', 'test/roadg_pools.test.js', 'test/enchantpool.test.js',
    'bible/01-Overview/Audit-58.md', 'bible/04-Characters/Characters-Arc.md',
    'bible/06-Systems/Systems-Arc.md', 'bible/09-Testing/Testing.md']) {
    const t = read(rel);
    for (const re of struck) {
      assert.equal(re.test(t), false, `${rel}: the false "${re.source}" rationale is struck, not reworded`);
    }
  }
  assert.match(w, /That was not a leak: removeFoe/, 'and world.js states the true one where the router lives');
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
  // ROAD-G G1 (review): the one term the port has already been bitten
  // by. `fieldOfView()` answers RADIANS (viewSettings.js) and the law
  // speaks DEGREES (MainCamera.fieldOfView) - the S-A lane's catch,
  // written at worldModes.js's dungeon arm. Raw, the direction angle
  // placeFoeFreely reads is ~1 degree instead of ~75, so the Sanguine
  // Rose's allied Daedroth (lineOfSightCheck defaults TRUE,
  // hostEnchant.js:61/:195) stands DEAD AHEAD inside the view instead
  // of just outside the cone. MUTANT: `fieldOfView()` raw, or
  // `* 90 / Math.PI` - both red here, and the slice is scoped to this
  // arm so worldModes' three other spellings cannot mask it.
  assert.match(stand, /fovDegrees: fieldOfView\(\) \* 180 \/ Math\.PI,/,
    'the placement cone is DEGREES, not the radians fieldOfView() answers');
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
