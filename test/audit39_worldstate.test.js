// AUDIT 39, world-state group: the laws the two ABOVE-GROUND walk
// hosts were missing - the paralysis consumer gate, the HUD call that
// must not hang on ARENA2, CleanupUntrackedObjects at the teleport,
// AreEnemiesNearby at the travel map's door - plus the exterior host's
// un-intercepted touch tap and a comment that outlived its feature.
// Source pins, because the hosts need a browser to import; the pool
// sweep is behavioural, on audit26_dungeonfoes' harness shape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { createCityGuards, GUARD_MOBILE_TYPE } from '../src/scenes/cityGuards.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, f), 'utf8');
const WORLD = src('src/scenes/world.js');
const EXTERIOR = src('src/scenes/exterior.js');
const WORLD_MODES = src('src/scenes/worldModes.js');
const HOSTS = [['world.js', WORLD], ['exterior.js', EXTERIOR]];

// ---------------------------------------------------------------------
// #59 - paralysis, above ground
// ---------------------------------------------------------------------

test('AUDIT 39 #59: the two above-ground hosts gate the motor and the weapon on paralysis', () => {
  // DFU reads PlayerEntity.IsParalyzed with no interior/exterior test:
  // FrictionMotor.GroundedMovement (:75-81) and AcrobatMotor
  // .CheckAirControl (:135-141) zero the movement input,
  // HandleJumpInput (:64-70) and LevitateMotor.Update (:67-69) return
  // early, WeaponManager (:235-239) does ShowWeapons(false) and takes
  // no swing. Only dungeon.js and worldModes' dungeon arm carried it,
  // and exteriorFoes' castParalyze mints the spell out of the
  // wilderness encounter tables - so a landed paralysis was inert.
  for (const [name, s] of HOSTS) {
    assert.match(s, /import \{ isInvisible, entityIsParalyzed \} from '\.\.\/systems\/effects\.js';/,
      `${name}: the read-time fold (DaggerfallEntity.IsParalyzed + the FreeAction immunity)`);
    assert.match(s, /const paralyzed = entityIsParalyzed\(playerEntity\);/,
      `${name}: one read per frame, above the motor and the weapon rig`);
    // dungeon.js:465's own bag, verbatim - and the crouch toggle stays
    // LIVE (DecideHeightAction has no paralysis check).
    assert.ok(s.includes('player.update(dt, paralyzed ? { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, crouch: crouchHeld && !latch.crouch } : {'),
      `${name}: movement, run, jump and the levitate axes are zeroed; crouch is not`);
    assert.ok(s.includes('const moving = !paralyzed && anyMove(mv);'),
      `${name}: a frozen player takes no stride`);
    assert.ok(s.includes('standingStill: !moving,'), `${name}: and the footstep machine reads it`);
    assert.ok(s.includes('weaponRig.frame(dt, { paralyzed })'), `${name}: no swing while frozen`);
    assert.ok(s.includes('weaponRig.draw({ paralyzed })'), `${name}: ShowWeapons(false) - and no viewmodel`);
  }
  // the standalone dungeon host is the shape being matched
  assert.match(src('src/scenes/dungeon.js'), /const paralyzed = ctx\.playerParalyzed\?\.\(\) \?\? false;/);
});

// ---------------------------------------------------------------------
// #152 - the HUD call is host-agnostic and reads no ARENA2
// ---------------------------------------------------------------------

test('AUDIT 39 #152: no host hides drawHud behind the classic HUD art', () => {
  // hud.js:377-402 runs playerDamageFlash and the enhanced DOM branch
  // ABOVE its own `if (!art) return;` - "the enhanced HUD reads no
  // ARENA2, and a player whose HUD art failed to load still has
  // vitals". Three hosts wrapped the whole call in `if (hudArt)`, and
  // hudArt starts null and is filled by a fire-and-forget load whose
  // failure leaves it null forever: no vitals for the first frames of
  // every session, and none at all when MAIN/HUD cannot be read.
  const hud = src('src/ui/hud.js');
  const flashAt = hud.indexOf('playerDamageFlash.tick(dt);');
  const enhancedAt = hud.indexOf('if (isEnhanced() && typeof document !== \'undefined\') {');
  const returnAt = hud.indexOf('if (!art) return;');
  assert.ok(flashAt > 0 && enhancedAt > flashAt && returnAt > enhancedAt,
    'the flash and the enhanced branch sit above the art return');
  for (const [name, s] of [...HOSTS, ['worldModes.js', WORLD_MODES]]) {
    const call = s.indexOf('drawHud(renderer, canvas, hudArt, playerEntity,');
    assert.ok(call > 0, `${name}: the one host-agnostic call`);
    // walk out from the call: no `if (hudArt) {` may open a block that
    // still contains it
    for (let i = s.indexOf('if (hudArt) {'); i >= 0; i = s.indexOf('if (hudArt) {', i + 1)) {
      let depth = 0, j = s.indexOf('{', i);
      const open = j;
      for (; j < s.length; j++) {
        if (s[j] === '{') depth++;
        else if (s[j] === '}' && --depth === 0) break;
      }
      assert.ok(!(call > open && call < j), `${name}: drawHud must not sit inside a classic-art guard`);
    }
  }
});

// ---------------------------------------------------------------------
// #158 - CleanupUntrackedObjects
// ---------------------------------------------------------------------

const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8 };
const poolDeps = (freed) => ({
  renderer: {
    createBillboardBatch: () => ({}),
    destroyBillboardBatch: () => { freed.n++; },
    textures: new Map(),
  },
  collider: { raycast: () => 0.5, heightAt: () => 0 },
  fetchBytes: async () => { throw new Error('no ARENA2 in this pin'); },
  getTexture: async () => stubTex,
  uploadRecordFrame: () => {},
  currentMinute: () => 1000,
  playerEntity: { level: 1, reflexes: 2, skills: 30, items: [], stats: { strength: 50, agility: 50, luck: 50 } },
  audio: null,
  onPlayerHurt: () => {},
  rand: () => 0.5,
  rolls: () => 0.5,
});
const standFoe = (mobileType, feet) => ({
  mobileType, gender: 'male', dead: false, entity: { health: 10, maxHealth: 10, items: [], activeEffects: [] },
  ai: { feet: [...feet], isHostile: true, detected: false, height: 1.8 },
  tex: stubTex, archive: ENEMY_BASICS[mobileType].maleTexture, batch: {}, _mout: null,
});
const settle = () => new Promise((r) => setTimeout(r, 0));

test('AUDIT 39 #158: clearLive is CleanupUntrackedObjects - the LIVE records go, not just the corpses', async () => {
  // StreamingWorld.cs:1624-1635 destroys every EnemyMotor under the
  // streaming target on load, and ClearStreamingWorld (:993-998)
  // collects every loose object on a teleport. collectPixel frees only
  // corpse batches and corpse flags, so before this a quickload
  // mid-fight left the live fight standing and restoreWorld spawned
  // the save's copies on top of it.
  const freed = { n: 0 };
  const pool = createExteriorFoes({ ...poolDeps(freed), currentPixelKey: () => '3,4' });
  const alive = standFoe(0, [10, 0, 10]);
  const slain = standFoe(0, [12, 0, 12]);
  pool.foes.push(alive, slain);
  pool.damageFoe(slain, 99, [0, 0, 0], null);
  await settle();
  assert.equal(pool.batches().length, 1, 'the corpse draws');

  const before = freed.n;
  pool.collectPixel('3,4');
  assert.equal(pool.foes.length, 2, 'collectPixel leaves the LIVE record standing - that is the gap');

  pool.clearLive();
  assert.equal(pool.foes.length, 0, 'the live pool is emptied');
  assert.equal(pool.batches().length, 0, 'and nothing is left to draw');
  assert.ok(freed.n > before, 'every batch is handed back');
  pool.clearLive();
  assert.equal(pool.foes.length, 0, 'idempotent - a second sweep frees nothing twice');
});

test('AUDIT 39 #158: the city watch sweeps on the same law', async () => {
  const freed = { n: 0 };
  const pool = createCityGuards({ ...poolDeps(freed), currentPixelKey: () => '3,4' });
  const live = standFoe(GUARD_MOBILE_TYPE, [5, 0, 5]);
  const dead = standFoe(GUARD_MOBILE_TYPE, [7, 0, 7]);
  pool.guards.push(live, dead);
  pool.hurtGuard(dead, 99, [0, 0, 0]);
  await settle();
  assert.equal(pool.lootTargets().length, 1, 'the body is a loot target');

  pool.clearLive();
  assert.equal(pool.guards.length, 0, 'the watch is gone - a quickload mid-pursuit resets the chase');
  assert.equal(pool.lootTargets().length, 0, 'and its corpses with it');
  assert.equal(pool.update(0, [0, 0, 0], [0, 1.7, 0], {}).length, 0, 'nothing draws');
});

// ---------------------------------------------------------------------
// #159 - AreEnemiesNearby at the travel map's door
// ---------------------------------------------------------------------

test('AUDIT 39 #159: the travel map refuses with enemies nearby, before the racial gate', () => {
  // DaggerfallUI.cs:604-609: IsPlayerInside first, then
  // AreEnemiesNearby -> MessageBox("cannotTravelWithEnemiesNearby"),
  // and only then GiveOffer, the sun-damage box and
  // racialOverride.CheckFastTravel. The port carried the indoors gate
  // (the keydown ladder's `mode === 'exterior'`) and the racial one,
  // and nothing between them.
  assert.match(WORLD, /const CANNOT_TRAVEL_ENEMIES_TEXT = 'You cannot travel with enemies nearby\.';/,
    'Internal_Strings.csv :221, verbatim');
  const i = WORLD.indexOf('const toggleTravelMap = (gotoPlace = null) => {');
  assert.ok(i > 0);
  const door = WORLD.slice(i, WORLD.indexOf('townTalk.showOverlay(_travelMap);', i));
  const nearby = door.indexOf('if (areEnemiesNearby([...cityGuards.guards, ...exteriorFoes.foes])) {');
  const racial = door.indexOf('const ftb = racialFastTravelBlock(playerEntity');
  const build = door.indexOf('_travelMap = buildTravelMapWindow(');
  assert.ok(nearby > 0, 'the refusal is at the door');
  assert.ok(racial > nearby, 'ordered ahead of CheckFastTravel, as DFU orders it');
  assert.ok(build > racial, 'and both ahead of the window');
  assert.ok(door.includes('townTalk.say(CANNOT_TRAVEL_ENEMIES_TEXT);'), 'the line is spoken');
  // the STRICT variant - resting's slack distance is the sleep rule
  assert.ok(!/areEnemiesNearby\(\[\.\.\.cityGuards\.guards, \.\.\.exteriorFoes\.foes\]\), \{ resting/.test(door));
});

// ---------------------------------------------------------------------
// #130 / #78 - the exterior host's touch tap and its stale comment
// ---------------------------------------------------------------------

test('AUDIT 39 #130: the exterior host\'s attack TAP defers to a readied spell like its other three doors', () => {
  // WeaponManager.cs:244-263 hands the click to the ready spell before
  // it handles any attack; touch.js:98 already promises the tap casts.
  assert.ok(EXTERIOR.includes("attackTap: () => { if (walkMode && modeNow() === 'exterior') { if (magic.interceptAttack(true)) return; weaponRig.clickAttack(); } },"),
    'the tap is the world host\'s shape now');
  // INTEGRATION MOVED THIS PIN 4 -> 3: #127 (ui-core-hud) removed the
  // dead attack(dx,dy,held) drag hook in the same wave - touch.js never
  // called it - taking its interceptAttack call with it. The three live
  // doors are mousemove, mousedown and the TAP.
  for (const [name, s] of HOSTS) {
    assert.equal((s.match(/magic\.interceptAttack\(true\)/g) ?? []).length, 3,
      `${name}: mousemove, mousedown and the TAP`);
  }
});

test('AUDIT 39 #78: the engine-rig block no longer promises a V toggle that was retired', () => {
  // I2 retired it: V is DFU's TravelMap default (InputManager.cs:1028,
  // mirrored at inputActions.js's ['KeyV', 'TravelMap']), and the
  // keydown ladder has no camera branch. ?tp is boot-only, and the
  // const says so.
  assert.ok(!EXTERIOR.includes('V toggles at runtime'), 'the promise is gone');
  assert.match(EXTERIOR, /const tpMode = params\.has\('tp'\);/, 'never reassigned - the binding pins it');
  assert.ok(EXTERIOR.includes('?tp is BOOT-ONLY'), 'and the block says what is true');
  assert.match(src('src/systems/inputActions.js'), /\['KeyV', 'TravelMap'\]/, 'V is the map');
});
