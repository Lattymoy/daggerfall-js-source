// G1: city guards (PlayerEntity.SpawnCityGuards / SpawnCityGuard,
// verbatim) - the spawn law over real CLASS18.CFG data with faked
// renderer/collider seams.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  createCityGuards, GUARD_MOBILE_TYPE, MAX_ACTIVE_GUARD_SPAWNS,
  GUARD_NPC_SPAWN_RANGE, GUARD_BEHIND_ANGLE,
  GUARD_FALLBACK_MIN_DIST, GUARD_FALLBACK_MAX_DIST,
} from '../src/scenes/cityGuards.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

/** The batch-free counter every makeDeps hands its stub renderer. */
const destroyed = { n: 0 };

function makeDeps(rand) {
  destroyed.n = 0;
  return {
    // AUDIT 24 (wave 6, EVERY ALLOCATION HAS AN OWNER): a released
    // guard frees its billboard batch. The stub predated that call and
    // threw when it landed - and because this file is ARENA2-gated, CI
    // never saw it. Counted rather than swallowed, so the pin proves
    // the free HAPPENS instead of merely tolerating it.
    renderer: {
      createBillboardBatch: () => ({}),
      destroyBillboardBatch: () => { destroyed.n++; },
      textures: new Map(),
    },
    collider: { heightAt: () => 0, raycast: () => Infinity,
      // D9: the ring fallback places through FoeSpawner.PlaceFoeFreely,
      // which asks the collider for a ray HIT and an overlap test
      raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
    fetchBytes: async (name) => new Uint8Array(readFileSync(join(ARENA2, name))),
    getTexture: async () => ({
      getFrameCount: () => 4,
      getSize: () => ({ width: 64, height: 100 }),
      getScale: () => ({ width: 0, height: 0 }),
    }),
    uploadRecordFrame: () => {},
    currentMinute: () => 523530,   // AUDIT 23 (hosts-3): the clock is REQUIRED now
    playerEntity: { level: 1, reflexes: 2, skills: 30, stats: { strength: 50, agility: 50, luck: 50 } },
    audio: null,
    onPlayerHurt: () => {},
    rand,
  };
}

test('guards: constants + immediate spawn converts the guard NPC first and disables it', { skip: skipReal }, async () => {
  assert.equal(GUARD_MOBILE_TYPE, 146);
  assert.equal(MAX_ACTIVE_GUARD_SPAWNS, 5);
  assert.equal(GUARD_NPC_SPAWN_RANGE, 77.5);
  assert.ok(Math.abs(GUARD_BEHIND_ANGLE - 105.469) < 1e-6);
  const g = createCityGuards(makeDeps(() => 0.9));
  let disabled = 0;
  const pool = [
    { pos: [5, 0, 5], fwdYaw: 0, guard: true, disable: () => disabled++ },
    { pos: [200, 0, 200], fwdYaw: 0, guard: true, disable: () => disabled++ },   // out of the 77.5 range
  ];
  await g.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool });
  assert.equal(g.activeCount(), 1, 'the in-range wandering guard converted');
  assert.equal(disabled, 1, 'classic disables the source NPC');
  const dbg = g._debug();
  assert.ok(dbg[0].hp > 0, 'a live Knight_CityWatch entity from CLASS18.CFG');
});

test('guards audit pin: the seen-by-guard MASS conversion quirk (verbatim)', { skip: skipReal }, async () => {
  // DFU's non-immediate loop: once ANY guard NPC has seen the crime,
  // EVERY REMAINING pool NPC converts (in range or not, guard or
  // not) - the `if (seenByGuard)` sits outside the range/LOS gate.
  const g = createCityGuards(makeDeps(() => 0.9));
  let disabled = 0;
  const pool = [
    { pos: [0, 0, 500], fwdYaw: 0, guard: false, disable: () => disabled++ },   // BEFORE the seer: untouched
    { pos: [0, 0, 10], fwdYaw: Math.PI, guard: true, disable: () => disabled++ },  // faces the player, sees
    { pos: [0, 0, 900], fwdYaw: 0, guard: false, disable: () => disabled++ },   // far civilian: converts anyway
  ];
  await g.spawnCityGuards(false, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool });
  assert.equal(g.activeCount(), 2, 'the seer AND every subsequent NPC convert');
  assert.equal(disabled, 2, 'the pre-seer civilian is untouched');
});

test('AUDIT 39: the guards-arrive countdown is gated on the LOCATION it started in', async () => {
  // PlayerEntity.cs:355-359 -
  //     if (guardsArriveCountdown > 0) {
  //         guardsArriveCountdown -= Time.deltaTime;
  //         if (guardsArriveCountdown <= 0 && guardsArriveCountdownLocation
  //             == GameManager.Instance.StreamingWorld.CurrentPlayerLocationObject)
  //             SpawnCityGuards(true);
  //     }
  // and :739-741 stores the location WITH the countdown, "so guards
  // don't appear if player leaves during countdown". The port tested
  // nothing, so a player who ran out of town inside the 5-10 second
  // window was ambushed by the ring fallback (12.8..51.2 units around
  // wherever they had got to) in open wilderness.
  //
  // No ARENA2 needed: the observable is whether the arrival reaches
  // spawnGuardAt at all, and CLASS18.CFG is the first thing it asks
  // for. The stub never answers, so nothing spawns either way.
  const witness = () => [{ pos: [0, 0, 10], fwdYaw: Math.PI, guard: false, disable: () => {} }];   // faces the player, civilian
  const rig = (where) => {
    const asked = { n: 0 };
    const g = createCityGuards({
      ...makeDeps(() => 0.9),
      fetchBytes: () => { asked.n++; return new Promise(() => {}); },   // parked: the career never lands
      currentPixelKey: () => where.at,
    });
    return { g, asked };
  };

  // LEFT the location during the countdown: nothing arrives.
  const away = { at: 'town' };
  const a = rig(away);
  await a.g.spawnCityGuards(false, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: witness() });
  assert.equal(a.asked.n, 0, 'a civilian witness spawns nobody on the spot');
  away.at = 'wilderness';
  a.g.update(11, [0, 0, 0], [0, 1.7, 0]);
  assert.equal(a.asked.n, 0, 'the countdown expired somewhere else - no watch ring in the wilderness');

  // STAYED: the arrival fires exactly as before.
  const here = { at: 'town' };
  const b = rig(here);
  await b.g.spawnCityGuards(false, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: witness() });
  b.g.update(11, [0, 0, 0], [0, 1.7, 0]);
  assert.ok(b.asked.n > 0, 'still in the location the crime was seen in - the watch arrives');
  // and the countdown is spent either way (DFU decrements before the
  // location test), so a re-entry does not re-fire it
  here.at = 'town';
  b.g.update(11, [0, 0, 0], [0, 1.7, 0]);
  assert.equal(b.asked.n, 1, 'one arrival per countdown');
});

test('guards G3: killed guards are loot targets, walk-aways are not, loot takes once', { skip: skipReal }, async () => {
  const deps = makeDeps(() => 0.9);
  const g = createCityGuards(deps);
  const pool = () => [{ pos: [5, 0, 5], fwdYaw: 0, guard: true, disable: () => {} }];
  await g.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: pool() });
  g.guards[0].entity.items = [{ name: 'Gold', group: 'Currency', stackCount: 5 }];
  // crimeCommitted is falsy -> the stand-down law marks the guard dead
  // WITHOUT a corpse (they walk away) - never a loot target
  g.update(0, [0, 0, 0], [0, 1.7, 0]);
  // AUDIT 39 moved this pin: it read `g.guards[0].dead &&
  // !g.guards[0].corpse`, and the record with no corpse on it is now
  // SPLICED by the same update (EnemyEntity.cs:184-191 destroys the
  // walk-away watch), so the observable is that it is gone.
  assert.equal(g.guards.length, 0, 'the walk-away is destroyed, not merely marked');
  // AUDIT 24 wave 6's law, now observable: the walk-away RELEASES its
  // billboard batch. Silently stubbing the free would have let a leak
  // pass here, which is how this file came to throw on it at all.
  assert.equal(destroyed.n, 1, 'the released guard frees its batch');
  assert.equal(g.lootTargets().length, 0, 'walk-aways vanish with their items');
  // a KILLED guard leaves a lootable corpse through the real death path
  await g.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: pool() });
  g.guards[0].entity.items = [
    { name: 'Gold', group: 'Currency', stackCount: 7 },
    { name: 'Longsword', group: 'Weapons' },
  ];
  g._damage(0, 9999);
  assert.ok(g.guards[0].dead && g.guards[0].corpse);
  const targets = g.lootTargets();
  assert.equal(targets.length, 1);
  // AUDIT 39: the ID of the second guard this pool ever stood - which
  // is 1 where its INDEX is now 0, the whole point of the change.
  assert.equal(targets[0].key, 'guardCorpse:1');
  let said = null;
  assert.equal(g.takeLoot('guardCorpse:1', (l) => { said = l; }), 2);
  assert.equal(said, 'You take 2 items.');
  assert.ok(deps.playerEntity.items.some((it) => it.group === 'Currency' && it.stackCount === 7));
  assert.equal(g.takeLoot('guardCorpse:1'), 0, 'a looted corpse is empty');
  assert.equal(g.lootTargets().length, 0);
});

// AUDIT 39r R32 ADDED THIS PIN, AND IT IS DELIBERATELY UN-GATED.
// AUDIT 39 moved the corpse's loot key from the array index to a minted
// `g.id` and added the walk-away splice, and every pin of the mint was
// either ARENA2-gated (G3 above, which CI never runs - Testing.md's own
// header calls those half-blind) or handed its own id in by a fixture.
// Mutation-checked: deleting `id: _nextGuardId++` from the spawned
// record failed nothing, and without it every corpse keys
// `guardCorpse:undefined`, `Number('undefined')` is NaN, and
// `guards.find((g) => g.id === id)` matches nothing - the watch's dead
// become unlootable. The only real-data dependency in the spawn is
// CLASS18.CFG, so the career is synthesised here and the pin runs
// everywhere.
//
// The 74-byte CLASS*.CFG record ClassFile.load walks: zero but for the
// hit-points-per-level (offset 52) and the eight u16 stats (58..73), so
// the spawned Knight_CityWatch is a live entity with health.
function stubClassCfg() {
  const b = new Uint8Array(80);
  const v = new DataView(b.buffer);
  v.setUint16(52, 10, true);
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true);
  return b;
}

test('guards G3 (un-gated): the id is MINTED at the spawn, and the loot key survives the prune', async () => {
  const player = { level: 1, reflexes: 2, skills: 30, items: [], stats: { strength: 50, agility: 50, luck: 50 }, crimeCommitted: 5 };
  const deps = { ...makeDeps(() => 0.9), fetchBytes: async () => stubClassCfg(), playerEntity: player };
  const g = createCityGuards(deps);
  const pool = () => [{ pos: [5, 0, 5], fwdYaw: 0, guard: true, disable: () => {} }];
  await g.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: pool() });
  await g.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: pool() });
  assert.deepEqual(g.guards.map((x) => x.id), [0, 1], 'two spawns, two distinct numeric ids');
  assert.ok(g.guards.every((x) => x.entity.health > 0), 'live entities off the synthetic career');

  // kill the SECOND, then let the crime clear so the first walks away
  g.guards[1].entity.items = [
    { name: 'Gold', group: 'Currency', stackCount: 7 },
    { name: 'Longsword', group: 'Weapons' },
  ];
  g._damage(1, 9999);
  player.crimeCommitted = 0;
  g.update(0, [0, 0, 0], [0, 1.7, 0]);
  assert.deepEqual(g.guards.map((x) => x.id), [1],
    'the walk-away is spliced (EnemyEntity.cs:184-191); the killed body stays with its corpse');

  // THE WHOLE POINT: its INDEX is now 0 and its key is still its id.
  assert.deepEqual(g.lootTargets().map((t) => t.key), ['guardCorpse:1']);
  let said = null;
  assert.equal(g.takeLoot('guardCorpse:1', (l) => { said = l; }), 2, 'and takeLoot resolves the same name');
  assert.equal(said, 'You take 2 items.');
  assert.ok(player.items.some((it) => it.group === 'Currency' && it.stackCount === 7),
    'the purse that moved is the one that was on THAT body');
});

test('guards G4: civilian strike = one-hit Murder; wandering guard = Assault + conversion; guard kill = Murder', { skip: skipReal }, async () => {
  const deps = makeDeps(() => 0.9);
  const g = createCityGuards(deps);
  let disabled = 0, murder = 0;
  const fakeWeapon = { resolveHit: () => [] };
  const eye = [0, 1.7, 0], fwd = [0, 0, 1], feet = [0, 0, 0];
  // A CIVILIAN in weapon reach dies to ONE hit: disabled + Murder + the response
  const civ = () => ({ pos: [0, 0, 1.5], fwdYaw: 0, guard: false, disable: () => disabled++ });
  const r1 = await g.resolveCivilianHit(fakeWeapon, eye, fwd, feet, [civ()], { onMurder: () => murder++ });
  assert.deepEqual(r1, { crime: 'murder' });
  assert.equal(disabled, 1);
  assert.equal(murder, 1, 'SpawnCityGuards(true) fired');
  assert.equal(deps.playerEntity.crimeCommitted, 5, 'Crimes.Murder');
  // Out of reach: no strike, no crime
  deps.playerEntity.crimeCommitted = 0;
  assert.equal(await g.resolveCivilianHit(fakeWeapon, eye, fwd, feet,
    [{ pos: [0, 0, 5], fwdYaw: 0, guard: false, disable: () => disabled++ }], {}), false);
  assert.equal(deps.playerEntity.crimeCommitted, 0);
  // A wall strictly in front blocks the strike
  const gWall = createCityGuards({ ...deps, collider: { heightAt: () => 0, raycast: () => 0.5 } });
  assert.equal(await gWall.resolveCivilianHit(fakeWeapon, eye, fwd, feet, [civ()], {}), false);
  // A wandering GUARD NPC: Assault + on-the-spot conversion, the
  // swing carried onto the fresh foe (DFU re-points the hit)
  let carried = 0;
  const carryWeapon = { resolveHit: () => { carried++; return []; } };
  const r2 = await g.resolveCivilianHit(carryWeapon, eye, fwd, feet,
    [{ pos: [0, 0, 1.5], fwdYaw: 0, guard: true, disable: () => disabled++ }], {});
  assert.equal(r2.crime, 'assault');
  assert.equal(deps.playerEntity.crimeCommitted, 4, 'Crimes.Assault');
  assert.equal(g.activeCount(), 1, 'converted to a live foe');
  assert.equal(carried, 1, 'the swing resolved against the fresh guard');
  // Killing the watch through the real death path IS Murder
  g._damage(0, 9999);
  assert.equal(deps.playerEntity.crimeCommitted, 5);
});

test('guards: behind-player civilians convert at 1/4; none seen -> the 2-5 ring fallback', { skip: skipReal }, async () => {
  // Civilian BEHIND the player (angle >= 105.469 from fwd +z), the
  // 1/4 roll passes (floor(0*4) === 0).
  const g1 = createCityGuards(makeDeps(seq(0.0, 0.9, 0.9, 0.9)));
  const pool1 = [{ pos: [0, 0, -10], fwdYaw: 0, guard: false, disable: () => {} }];
  await g1.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: pool1 });
  assert.equal(g1.activeCount(), 1, 'the behind civilian converted on the 1/4');
  // A civilian IN FRONT never converts; the ring fallback spawns
  // 2 + floor(rand*4) guards instead.
  const g2 = createCityGuards(makeDeps(() => 0.5));   // count = 2 + 2 = 4
  const pool2 = [{ pos: [0, 0, 10], fwdYaw: 0, guard: false, disable: () => {} }];
  await g2.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: pool2 });
  assert.equal(g2.activeCount(), 4, 'the foe-spawner ring: 2 + floor(0.5*4)');
  // The max-active gate: 4 active <= 5 allows one more call; push to
  // 8 (4 + ring 4), then the NEXT call refuses (8 > 5).
  await g2.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: [] });
  assert.equal(g2.activeCount(), 8);
  await g2.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: [] });
  assert.equal(g2.activeCount(), 8, 'over maxActiveGuardSpawns nothing spawns');
});

// =====================================================================
// CLOSEOUT: the OUTER gate's first term, and the reset's real count.
// =====================================================================

test('CLOSEOUT: SpawnCityGuards does nothing at all inside a dungeon (PlayerEntity.cs:625)', async () => {
  // DFU gates the WHOLE member on two terms:
  //     if (!GameManager.Instance.PlayerEnterExit.IsPlayerInsideDungeon
  //         && GameManager.Instance.HowManyEnemiesOfType(
  //             MobileTypes.Knight_CityWatch, false, true) <= maxActiveGuardSpawns)
  // The indoor arm (:628-641) and BOTH street arms live inside that one
  // `if`, so underground the method spawns nothing from any caller -
  // the quest action `spawncityguards` included, which ticks in dungeon
  // mode through worldModes' own questBridge. The port carried only the
  // cap, so that call fell through to the immediate street law with an
  // empty pool (there is no exterior person pool underground) and rang
  // 2-5 Knight_CityWatch onto the EXTERIOR collider at the player's
  // dungeon-local feet, where they also ate the 5-guard cap.
  //
  // No ARENA2 needed: the observable is whether a spawn is REACHED at
  // all - the ring fallback places through PlaceFoeFreely, whose floor
  // probe reaches `collider.heightAt` (D9), and every spawn's first act
  // is the CLASS18.CFG fetch, which is refused here so the call cannot
  // hang on a career that never lands.
  const rig = (flags) => {
    const tried = { n: 0 };
    const g = createCityGuards({
      ...makeDeps(() => 0.5),   // ring count = 2 + floor(0.5 * 4) = 4
      collider: {
        heightAt: () => { tried.n++; return 0; }, raycast: () => Infinity,
        raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false,
      },
      fetchBytes: async () => { tried.n++; throw new Error('no career here'); },
      enterExitFlags: () => flags,
    });
    const call = (immediate, pool) => g.spawnCityGuards(immediate, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool })
      .catch(() => {});   // the refused career, not the gate
    return { g, tried, call };
  };
  const street = rig({ isPlayerInsideDungeon: false, isPlayerInside: false, insideOpenShop: false, insideTavern: false, insideResidence: false });
  await street.call(true, []);
  assert.ok(street.tried.n > 0, 'above ground the empty pool still takes the CreateFoeSpawner ring');

  // ...and the same call underground, where the player entered from the
  // street (isPlayerInside true, none of the three indoor latches set,
  // so the ported inner arm cannot answer for it).
  const under = rig({ isPlayerInsideDungeon: true, isPlayerInside: true, insideOpenShop: false, insideTavern: false, insideResidence: false });
  await under.call(true, []);
  assert.equal(under.tried.n, 0, 'inside a dungeon the whole member returns - no ring, no watch');
  assert.equal(under.g.activeCount(), 0);

  // The WITNESS arm is inside the same `if`, so it is refused too.
  const witness = rig({ isPlayerInsideDungeon: true, isPlayerInside: true, insideOpenShop: false, insideTavern: false, insideResidence: false });
  // a guard NPC facing the player: converts on the spot above ground
  await witness.call(false, [{ pos: [0, 0, 10], fwdYaw: Math.PI, guard: true, disable: () => {} }]);
  assert.equal(witness.tried.n, 0, 'the non-immediate arm is enclosed by the same gate');

  // ...and the host that owns the latch must actually publish it.
  const world = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(world, /enterExitFlags: \(\) => \(\{\s*\n\s*isPlayerInsideDungeon: \(modes\?\.mode \?\? 'exterior'\) === 'dungeon',/,
    'world.js hands the dungeon latch into the flags bag the module reads');
});

test('CLOSEOUT: the surrender-dialogue reset counts HOSTILE, non-allied watchmen only (PlayerEntity.cs:534)', () => {
  // `HowManyEnemiesOfType(MobileTypes.Knight_CityWatch, true)` - the
  // positional `true` is stopLookingIfFound; `includingPacified` keeps
  // its default FALSE (GameManager.cs:740), so the counter increments
  // only under `includingPacified || (enemyMotor.IsHostile && entity
  // .Team != MobileTeams.PlayerAlly)` (:752). A watchman talked down by
  // Etiquette/Streetwise (EnemySenses.cs:518 writes IsHostile false and
  // destroys nothing) or charmed onto the player's team is NOT counted,
  // so DFU clears the flag with him standing in the street - and the
  // next arrest offers the surrender box again, which is the ONLY call
  // site of LowerRepForCrime. A bare liveness test held the flag up for
  // the rest of the active crime.
  //
  // The observable is the FLAG, which the reset writes ABOVE the
  // per-guard drive; the stub record cannot be driven, so that drive's
  // own throw is caught. If the reset ever moved BELOW the drive, the
  // throw would stop it reaching the flag and this pin would fail -
  // which is exactly right.
  const drive = (guard) => {
    const playerEntity = { ...makeDeps(() => 0.5).playerEntity, crimeCommitted: 4, haveShownSurrenderDialogue: true };
    const g = createCityGuards({ ...makeDeps(() => 0.5), playerEntity });
    g.guards.push(guard);
    try { g.update(0.016, [0, 0, 0], [0, 1.7, 0]); } catch { /* the per-guard drive; the reset above it has already run */ }
    return playerEntity.haveShownSurrenderDialogue;
  };
  assert.equal(drive({ dead: false, ai: { isHostile: true }, entity: { team: 'CityWatch' } }), true,
    'a hostile watchman still standing holds the flag up');
  assert.equal(drive({ dead: false, ai: { isHostile: false }, entity: { team: 'CityWatch' } }), false,
    'one talked down by a Language skill is not counted - the flag clears with him standing');
  assert.equal(drive({ dead: false, ai: { isHostile: true }, entity: { team: 'PlayerAlly' } }), false,
    "...and neither is one charmed onto the player's team");
  assert.equal(drive({ dead: true, ai: { isHostile: true }, entity: { team: 'CityWatch' } }), false,
    'a dead one was never counted either way');
});


// ---------------------------------------------------------------
// D9 - the CreateFoeSpawner fallback (PlayerEntity.cs:687) places
// through FoeSpawner.PlaceFoeFreely like every other spawner call
// site, instead of rolling a bare bearing + distance and taking
// collider.heightAt with no clearance and no occupancy test.
// ---------------------------------------------------------------

test('D9: the guard ring goes through PlaceFoeFreely - blocked ground stands nobody', async () => {
  const rig = (colliderOverrides) => {
    const asked = { n: 0 };
    const g = createCityGuards({
      ...makeDeps(() => 0.5),   // ring count = 2 + floor(0.5 * 4) = 4
      collider: {
        heightAt: () => 0, raycast: () => Infinity,
        raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false,
        ...colliderOverrides,
      },
      // the spawn's first act; refused so nothing hangs on a career
      fetchBytes: async () => { asked.n++; throw new Error('no career here'); },
    });
    const call = () => g.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: [] })
      .catch(() => {});
    return { asked, call };
  };

  // open ground: the ring places and the spawns are reached
  const open = rig({});
  await open.call();
  assert.ok(open.asked.n > 0, 'an empty pool still takes the ring fallback');

  // EVERY candidate point is occupied - PlaceFoeFreely's own
  // "Ensure this is open space" (OverlapSphere) refuses all of them,
  // so not one watchman is stood. The old arm had no such test and
  // would have spawned its 2..5 into whatever was standing there.
  const packed = rig({ sphereOverlaps: () => true });
  await packed.call();
  assert.equal(packed.asked.n, 0, 'no clear spot, no watchman');

  // no floor within reach either (the ray finds nothing and heightAt
  // is far below): the same refusal
  const voidGround = rig({ heightAt: () => -1000 });
  await voidGround.call();
  assert.equal(voidGround.asked.n, 0, 'no ground under the point, no watchman');
});

test('D9: the ring reads the SPAWNER_ARMS row, and the two named constants are that row', async () => {
  const { SPAWNER_ARMS } = await import('../src/systems/encounters.js');
  assert.equal(SPAWNER_ARMS.cityGuards.minDistance, 12.8, 'PlayerEntity.cs:687');
  assert.equal(SPAWNER_ARMS.cityGuards.maxDistance, 51.2);
  assert.equal(SPAWNER_ARMS.cityGuards.lineOfSightCheck, true, 'the watch converges from outside the FOV');
  assert.equal(GUARD_FALLBACK_MIN_DIST, SPAWNER_ARMS.cityGuards.minDistance, 'one home');
  assert.equal(GUARD_FALLBACK_MAX_DIST, SPAWNER_ARMS.cityGuards.maxDistance);
  const src = readFileSync(new URL('../src/scenes/cityGuards.js', import.meta.url), 'utf8');
  assert.match(src, /spot = placeFoeFreely\(env, SPAWNER_ARMS\.cityGuards\);/,
    'the fallback stands its guards through the one placement law');
});
