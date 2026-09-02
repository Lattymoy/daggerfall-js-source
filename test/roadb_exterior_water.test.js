// ROAD-B (b3-exterior-water) - THE EXTERIOR SURFACE MODEL AND
// UNDERWATER FOG (2026-09-01).
//
// Three items, and the first thing the C# settles is what the port is
// NOT owed:
//
//  1. THE EXTERIOR SUBMERSION MODEL. There isn't one. PlayerEnterExit
//     .Update guards the whole underwater block with a comment that
//     says so (PlayerEnterExit.cs:377, "Underwater swimming logic
//     should only be processed in dungeons at this time") and its else
//     arm (:415-422) forces isPlayerSubmerged false and
//     levitateMotor.IsSwimming false above ground, every frame. So
//     there is no exterior breath drain, no exterior drowning, and
//     PlayerMotor.IsSwimming - which IS levitateMotor.IsSwimming
//     (:149-152) - is always false outdoors. What DFU does have above
//     water is PlayerMotor.OnExteriorWaterMethod, a TILE
//     classification, and that is what this lane lands.
//
//  2. OnExteriorPath / OnExteriorStaticGeometry. Both real, both
//     ported. The path arm is NOT blocked on "no road data": DFU reads
//     terrain tile records 46, 47 and 55 out of the same tilemap byte
//     the water arm reads (OnPathTile, PlayerMotor.cs:568-574).
//
//  3. EXTERIOR UNDERWATER FOG. UnderwaterFog.UpdateFog has exactly one
//     call site and it is inside `if (dungeon && isPlayerInsideDungeon)`
//     (PlayerEnterExit.cs:327-352). The fog law is real and was missing
//     for dungeons; the exterior half of the claim is not DFU.
//
// Every pin below either regenerates the constant set from the C# or
// fails on a revert of the wiring.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ON_EXTERIOR_WATER, WALKING_RAY_DISTANCE, RIDING_RAY_DISTANCE, rayDistanceFor,
  onShallowWaterTile, onPathTile, downProbe,
  onExteriorGroundMethod, onExteriorStaticGeometryMethod,
  exteriorWaterMethod, exteriorPathMethod, exteriorSurfaces, exteriorSwimLatch,
} from '../src/player/exteriorSurface.js';
import {
  UnderwaterFog, fogT, WATER_FOG_COLOR, WATER_MAP_COLOR,
  FOG_DENSITY_MIN, FOG_DENSITY_MAX, DUNGEON_FOG, applyFog,
} from '../src/render/underwaterFog.js';
import { pickFootstepSet, FootstepMachine, FOOTSTEP, WALK_STEP_INTERVAL } from '../src/systems/footsteps.js';
import { GLOBAL_SCALE } from '../src/world/meshReader.js';
import { dfuFile, missingDfu } from './dfuRoot.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const MOTOR_CS = 'Assets/Scripts/Game/PlayerMotor.cs';
const PEE_CS = 'Assets/Scripts/Game/PlayerEnterExit.cs';
const FOG_CS = 'Assets/Scripts/Game/UnderwaterFog.cs';
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// ── 1. the tile sets, REGENERATED from PlayerMotor.cs ──────────────

test('ROAD-B b3: OnShallowWaterTile and OnPathTile are DFU’s own record sets, cell for cell', {
  skip: missingDfu(MOTOR_CS) && 'no DFU checkout (DFU_PATH)',
}, () => {
  const cs = readFileSync(dfuFile(MOTOR_CS), 'utf8');
  // Pull each method's body and re-derive the record set it accepts by
  // running the C# comparisons as data - a remembered list would not
  // notice DFU adding a shore record.
  const bodyOf = (name) => {
    const at = cs.indexOf(`bool ${name}()`);
    assert.ok(at > 0, `${name} still exists`);
    const open = cs.indexOf('{', at);
    const close = cs.indexOf('}', open);
    return cs.slice(open, close);
  };
  const setFrom = (body) => {
    const out = new Set();
    // `PlayerTileMapIndex == N`
    for (const m of body.matchAll(/PlayerTileMapIndex\s*==\s*(\d+)/g)) out.add(Number(m[1]));
    // `(PlayerTileMapIndex >= A && PlayerTileMapIndex <= B)`
    for (const m of body.matchAll(/PlayerTileMapIndex\s*>=\s*(\d+)\s*&&\s*[^)]*?<=\s*(\d+)/g)) {
      for (let i = Number(m[1]); i <= Number(m[2]); i++) out.add(i);
    }
    return out;
  };
  const shallow = setFrom(bodyOf('OnShallowWaterTile'));
  const path = setFrom(bodyOf('OnPathTile'));
  assert.ok(shallow.size >= 11, `parsed ${shallow.size} shallow records - the scrape broke, not the port`);
  assert.equal(path.size, 3, 'three path records');
  for (let i = -1; i <= 63; i++) {
    assert.equal(onShallowWaterTile(i), shallow.has(i), `shallow record ${i}`);
    assert.equal(onPathTile(i), path.has(i), `path record ${i}`);
  }
  // and the values themselves, so the pin still says something with no
  // checkout in the room
  assert.deepEqual([...shallow].sort((a, b) => a - b),
    [5, 6, 8, 20, 21, 23, 30, 31, 33, 34, 35, 36, 49]);
  assert.deepEqual([...path].sort((a, b) => a - b), [46, 47, 55]);
});

test('ROAD-B b3: record 0 is DEEP water and is NOT in the shallow set - the two arms cannot both fire', () => {
  assert.equal(onShallowWaterTile(0), false, 'record 0 is the swim tile, never the wade tile');
  assert.equal(onPathTile(0), false);
  // -1 is StreamingWorld's off-terrain answer; nothing may claim it
  assert.equal(onShallowWaterTile(-1), false);
  assert.equal(onPathTile(-1), false);
});

// ── 2. the raycast (GetOnExteriorGroundMethod / StaticGeometry) ────

test('ROAD-B b3: the down probe reaches rayDistance * 2, and riding doubles the reach', () => {
  assert.equal(WALKING_RAY_DISTANCE, 1.0, 'PlayerMotor.cs:22');
  assert.equal(RIDING_RAY_DISTANCE, 2.0, 'PlayerMotor.cs:23');
  assert.equal(rayDistanceFor(true), 1.0);
  assert.equal(rayDistanceFor(false), 2.0);
  // on foot: the cast is 2.0 deep, so a floor 1.9 under the centre hits
  // and one 2.1 under it does not
  const walk = (drop) => downProbe({ centreY: 10, terrainY: 10 - drop, rayDistance: WALKING_RAY_DISTANCE });
  assert.equal(walk(1.9).hit, true);
  assert.equal(walk(2.1).hit, false, 'rayDistance * 2 is the whole reach - a ship’s deck is out of range of the sea');
  // mounted: 4.0 deep, which is why a horse over shallows still splashes
  const ride = (drop) => downProbe({ centreY: 10, terrainY: 10 - drop, rayDistance: RIDING_RAY_DISTANCE });
  assert.equal(ride(3.9).hit, true);
  assert.equal(ride(4.1).hit, false);
});

test('ROAD-B b3: terrain and StaticGeometry are the NEAREST hit, and are mutually exclusive', () => {
  // terrain alone
  let p = downProbe({ centreY: 5, terrainY: 4, meshDist: Infinity, rayDistance: 1 });
  assert.deepEqual([p.hit, p.terrain, p.staticGeometry], [true, true, false]);
  // a model between the player and the ground - DFU's raycast returns
  // the model, whose transform carries no DaggerfallTerrain
  p = downProbe({ centreY: 5, terrainY: 4, meshDist: 0.5, rayDistance: 1 });
  assert.deepEqual([p.hit, p.terrain, p.staticGeometry], [true, false, true],
    'standing on a building is standing on StaticGeometry, whatever tile is painted under it');
  // the model BELOW the ground cannot be what you stand on
  p = downProbe({ centreY: 5, terrainY: 4.8, meshDist: 0.9, rayDistance: 1 });
  assert.deepEqual([p.terrain, p.staticGeometry], [true, false]);
  // FLUSH - the tie. A model laid flat ON the terrain is what the
  // player stands on (:149-152), so the answer is StaticGeometry, and a
  // flush model over a water tile therefore reports None, not Swimming.
  p = downProbe({ centreY: 5, terrainY: 4, meshDist: 1, rayDistance: 1 });
  assert.deepEqual([p.hit, p.terrain, p.staticGeometry], [true, false, true],
    'ties go to the mesh - `terrainDist < md`, never <=');
  // nothing in range at all
  p = downProbe({ centreY: 5, terrainY: -Infinity, meshDist: Infinity, rayDistance: 1 });
  assert.deepEqual([p.hit, p.terrain, p.staticGeometry], [false, false, false]);
  // a null terrain (no built pixel) is -Infinity's twin
  assert.equal(downProbe({ centreY: 5, terrainY: null, rayDistance: 1 }).hit, false);
  // and a floor ABOVE the origin is not something a DOWN ray reaches
  assert.equal(downProbe({ centreY: 5, terrainY: 5.5, rayDistance: 1 }).hit, false);
});

test('ROAD-B b3: inside, or a ray that hits nothing, is an immediate false on BOTH methods', () => {
  const onTerrain = { hit: true, terrain: true, staticGeometry: false };
  const onModel = { hit: true, terrain: false, staticGeometry: true };
  assert.equal(onExteriorGroundMethod({ inside: false, probe: onTerrain }), true);
  assert.equal(onExteriorGroundMethod({ inside: true, probe: onTerrain }), false, ':517 IsPlayerInside');
  assert.equal(onExteriorGroundMethod({ inside: false, probe: null }), false);
  assert.equal(onExteriorGroundMethod({ inside: false, probe: onModel }), false,
    'a hit without a DaggerfallTerrain on it is not exterior ground (:518-521)');
  assert.equal(onExteriorStaticGeometryMethod({ inside: false, probe: onModel }), true, ':546');
  assert.equal(onExteriorStaticGeometryMethod({ inside: true, probe: onModel }), false);
  assert.equal(onExteriorStaticGeometryMethod({ inside: false, probe: onTerrain }), false);
});

// ── 3. GetOnExteriorWaterMethod, the whole table ───────────────────

test('ROAD-B b3: GetOnExteriorWaterMethod - deep swims, shore wades, off-ground is None', () => {
  const G = { onGround: true };
  // "Player is swimming in exterior water" - on the ground, record 0,
  // no Water Walking.
  assert.equal(exteriorWaterMethod({ ...G, tileIndex: 0 }), ON_EXTERIOR_WATER.Swimming);
  // Water Walking turns the SAME tile into a walk (:590-591)
  assert.equal(exteriorWaterMethod({ ...G, tileIndex: 0, waterWalking: true }),
    ON_EXTERIOR_WATER.WaterWalking, 'PlayerEntity.IsWaterWalking never swims');
  // every shallow record wades, with or without the effect
  for (const idx of [5, 6, 8, 20, 21, 23, 30, 31, 33, 34, 35, 36, 49]) {
    assert.equal(exteriorWaterMethod({ ...G, tileIndex: idx }), ON_EXTERIOR_WATER.WaterWalking, `record ${idx}`);
    assert.equal(exteriorWaterMethod({ ...G, tileIndex: idx, waterWalking: true }), ON_EXTERIOR_WATER.WaterWalking);
  }
  // dry land, path tiles and off-terrain are all None
  for (const idx of [-1, 1, 2, 3, 46, 47, 55, 63]) {
    assert.equal(exteriorWaterMethod({ ...G, tileIndex: idx }), ON_EXTERIOR_WATER.None, `record ${idx}`);
  }
  // THE SHIP/LEVITATION CASE, which is the whole reason the raycast
  // exists (:499-503): over deep water but not ON it.
  assert.equal(exteriorWaterMethod({ onGround: false, tileIndex: 0 }), ON_EXTERIOR_WATER.None,
    'standing above water is not standing in it');
  assert.equal(exteriorWaterMethod({ onGround: false, tileIndex: 5 }), ON_EXTERIOR_WATER.None);
});

test('ROAD-B b3: GetOnExteriorPathMethod is ground AND a path record', () => {
  for (const idx of [46, 47, 55]) {
    assert.equal(exteriorPathMethod({ onGround: true, tileIndex: idx }), true);
    assert.equal(exteriorPathMethod({ onGround: false, tileIndex: idx }), false, 'a bridge over a road is not the road');
  }
  for (const idx of [-1, 0, 2, 45, 48, 54, 56]) {
    assert.equal(exteriorPathMethod({ onGround: true, tileIndex: idx }), false, `record ${idx}`);
  }
});

test('ROAD-B b3: exteriorSurfaces runs all three off one raw tilemap byte, sentinel included', () => {
  const onTerrain = { hit: true, terrain: true, staticGeometry: false };
  // the 0xFF location-zero sentinel converts back to record 0, which IS
  // water to every consumer of PlayerTileMapIndex (terrainSurface's own
  // note) - so a town tile that encoded as zero swims, bug for bug
  let s = exteriorSurfaces({ rawTile: 0xff, probe: onTerrain });
  assert.equal(s.tileIndex, 0);
  assert.equal(s.water, ON_EXTERIOR_WATER.Swimming);
  assert.equal(s.path, false);
  assert.equal(s.staticGeometry, false);
  // a path record with its rotate/flip bits set still reads as a path:
  // the >> 2 drops the transform, and 46 * 4 = 184 fits a byte
  s = exteriorSurfaces({ rawTile: 46, probe: onTerrain });
  assert.equal(s.tileIndex, 46);
  assert.equal(s.path, true);
  assert.equal(s.water, ON_EXTERIOR_WATER.None);
  // null raw tile - no built pixel - is DFU's -1: nothing at all
  s = exteriorSurfaces({ rawTile: null, probe: onTerrain });
  assert.equal(s.tileIndex, -1);
  assert.equal(s.water, ON_EXTERIOR_WATER.None);
  assert.equal(s.path, false);
  // standing on a model over a water tile: static geometry, no water
  s = exteriorSurfaces({ rawTile: 0xff, probe: { hit: true, terrain: false, staticGeometry: true } });
  assert.equal(s.water, ON_EXTERIOR_WATER.None);
  assert.equal(s.staticGeometry, true);
});

// ── 4. what the exterior does NOT have ─────────────────────────────

test('ROAD-B b3: PlayerEnterExit’s exterior else arm is DFU’s own', {
  skip: missingDfu(PEE_CS) && 'no DFU checkout (DFU_PATH)',
}, () => {
  const cs = readFileSync(dfuFile(PEE_CS), 'utf8');
  // the guard comment that settles item 1
  assert.match(cs, /Underwater swimming logic should only be processed in dungeons at this time/,
    'if DFU ever grows exterior swimming, this pin is the notice');
  // and the else arm's three assignments
  assert.match(cs, /PlayerTileMapIndex\s*!=\s*0\)\s*\n\s*isPlayerSwimming\s*=\s*false;/,
    'the MeteoricDragon latch: swimming survives only on a water tile');
});

// The behaviour table itself reads no file and calls only the port's own
// pure function, so it runs with or without a checkout - the law must be
// pinned in the environment the suite actually runs in.
test('ROAD-B b3: the exterior swim latch clears submersion and the motor swim flag, ALWAYS', () => {
  const latchWater = exteriorSwimLatch(true, 0);
  assert.deepEqual(latchWater, { swimming: true, submerged: false, motorSwimming: false },
    'a swimmer who surfaces onto open water keeps IsPlayerSwimming');
  assert.deepEqual(exteriorSwimLatch(true, 5), { swimming: false, submerged: false, motorSwimming: false },
    'a SHALLOW tile is not record 0 - the latch clears there too');
  assert.deepEqual(exteriorSwimLatch(true, 2), { swimming: false, submerged: false, motorSwimming: false });
  assert.deepEqual(exteriorSwimLatch(false, 0), { swimming: false, submerged: false, motorSwimming: false });
  // submerged/motorSwimming are false for EVERY input - there is no
  // exterior breath drain and no exterior drowning
  for (const was of [true, false]) {
    for (const idx of [-1, 0, 5, 46, 63]) {
      const l = exteriorSwimLatch(was, idx);
      assert.equal(l.submerged, false, 'isPlayerSubmerged = false (:420)');
      assert.equal(l.motorSwimming, false, 'levitateMotor.IsSwimming = false (:421)');
    }
  }
});

test('ROAD-B b3: no exterior host drives breathStep - drowning above ground is not a DFU law', () => {
  for (const host of ['scenes/world.js', 'scenes/exterior.js']) {
    const src = readFileSync(join(SRC, host), 'utf8');
    assert.equal(/breathStep/.test(src), false,
      `${host} must not drain breath: PlayerEnterExit.cs:420 forces isPlayerSubmerged false outdoors`);
  }
  // the dungeon host, which IS the call site, still does
  assert.match(readFileSync(join(SRC, 'scenes/dungeonContext.js'), 'utf8'), /breathStep\(/);
});

// ── 5. the host wiring (fails on a revert) ─────────────────────────

test('ROAD-B b3: both exterior hosts raise onExteriorWater and feed all four footstep arms', () => {
  for (const host of ['scenes/world.js', 'scenes/exterior.js']) {
    const src = readFileSync(join(SRC, host), 'utf8');
    assert.match(src, /exteriorSurfaces\s*\(/, `${host} runs the three methods`);
    assert.match(src, /downProbe\s*\(/, `${host} casts the ray - without it a ship swims`);
    assert.match(src, /rayDistanceFor\(isOnFoot\(/, `${host} takes the mounted reach (:507, :533)`);
    assert.match(src, /player\.onExteriorWater\s*=\s*_surf\.water === ON_EXTERIOR_WATER\.Swimming/,
      `${host} must raise the capsule-sink flag on Swimming ALONE (PlayerHeightChanger.cs:127)`);
    // the three FLAGGED footstep arms, plus the path arm
    assert.match(src, /onExteriorWater: _onWater/, `${host} feeds the splash`);
    assert.match(src, /onStaticGeometry: _surf\.staticGeometry/, `${host} feeds the roof/bridge arm`);
    assert.match(src, /onFoot: isOnFoot\(/, `${host} feeds the mounted gate (:221-227)`);
    assert.match(src, /onExteriorPath: _surf\.path/, `${host} feeds the path arm off records 46/47/55`);
    assert.equal(/onExteriorPath: false/.test(src), false,
      `${host} must not hardcode the path arm off - OnPathTile is real terrain data`);
  }
});

test('ROAD-B b3: the splash covers BOTH water methods, not just Swimming', () => {
  // PlayerFootsteps.cs:116 - "Play splash footsteps whether player is
  // walking on or swimming in exterior water". Wading a shore tile
  // splashes; only Swimming sinks the capsule. The hosts express that
  // with two different reads of the same method, and this pin is why
  // they cannot be collapsed into one.
  for (const host of ['scenes/world.js', 'scenes/exterior.js']) {
    const src = readFileSync(join(SRC, host), 'utf8');
    assert.match(src, /_onWater = _surf\.water !== ON_EXTERIOR_WATER\.None/,
      `${host}: the splash is !== None`);
  }
});

test('ROAD-B b3: pickFootstepSet’s static-geometry arm takes a snowy outdoor step to STONE', () => {
  // PlayerFootsteps.cs:131 - `if (!isInside && !playerOnStaticGeometry)`
  // picks the outdoor pair; standing on a model in winter falls through
  // to the `else // in dungeon` stone pair, not to snow.
  const winterField = { inside: false, winter: true, climateIndex: 226 };   // Woodlands: snows
  assert.deepEqual(pickFootstepSet(winterField), [FOOTSTEP.Snow1, FOOTSTEP.Snow2]);
  assert.deepEqual(pickFootstepSet({ ...winterField, onStaticGeometry: true }),
    [FOOTSTEP.Stone1, FOOTSTEP.Stone2], 'a roof in a blizzard is not snow underfoot');
  // and the exterior water arm still overrides everything above it
  assert.deepEqual(pickFootstepSet({ ...winterField, onStaticGeometry: true, onExteriorWater: true }),
    [FOOTSTEP.Submerged, FOOTSTEP.Submerged]);
});

test('ROAD-B b3: a MOUNTED player is silent on land and splashes in water (:221-227)', () => {
  const set = [FOOTSTEP.Outside1, FOOTSTEP.Outside2];
  // six strides' worth of ground covered; the stride fires past 2.5
  const walk = (m, mach) => {
    let steps = 0;
    for (let i = 0; i < 6; i++) if (mach.update([i * WALK_STEP_INTERVAL, 0, 0], m, set)) steps++;
    return steps;
  };
  const dry = new FootstepMachine();
  dry.ignoreLostGrounding = false;
  assert.equal(walk({ grounded: true, onFoot: false, onExteriorWater: false }, dry), 0,
    'a horse on dry ground takes no footsteps');
  const wet = new FootstepMachine();
  wet.ignoreLostGrounding = false;
  assert.ok(walk({ grounded: true, onFoot: false, onExteriorWater: true }, wet) > 0,
    'the same horse in exterior water does - the one exception in the on-foot gate');
  // and on foot, dry, the stride is of course alive
  const foot = new FootstepMachine();
  foot.ignoreLostGrounding = false;
  assert.ok(walk({ grounded: true, onFoot: true, onExteriorWater: false }, foot) > 0);
});

// ── 6. UnderwaterFog ───────────────────────────────────────────────

test('ROAD-B b3: UnderwaterFog’s constants are UnderwaterFog.cs’s own', {
  skip: missingDfu(FOG_CS) && 'no DFU checkout (DFU_PATH)',
}, () => {
  const cs = readFileSync(dfuFile(FOG_CS), 'utf8');
  const c32 = cs.match(/waterFogColor\s*=\s*new Color32\((\d+),\s*(\d+),\s*(\d+),\s*(\d+)\)/);
  assert.ok(c32, 'waterFogColor is still a Color32');
  assert.deepEqual([...WATER_FOG_COLOR],
    [Number(c32[1]) / 255, Number(c32[2]) / 255, Number(c32[3]) / 255]);
  const cmap = cs.match(/waterMapColor\s*=\s*new Color\(([\d.f, ]+)\)/);
  assert.deepEqual([...WATER_MAP_COLOR],
    cmap[1].split(',').map((v) => Number(v.replace('f', '').trim())));
  assert.match(cs, new RegExp(`fogDensityMin = ${FOG_DENSITY_MIN}f?;`));
  assert.match(cs, new RegExp(`fogDensityMax = ${String(FOG_DENSITY_MAX).replace('.', '\\.')}f;`));
  // and the exterior claim: ONE call site, inside the dungeon guard
  const pee = readFileSync(dfuFile(PEE_CS), 'utf8');
  const calls = [...pee.matchAll(/underwaterFog\.UpdateFog\(/g)];
  assert.equal(calls.length, 1, 'UpdateFog is called from exactly one place');
  const guard = pee.lastIndexOf('if (dungeon && isPlayerInsideDungeon)', calls[0].index);
  assert.ok(guard > 0 && guard < calls[0].index,
    'and that place is inside the dungeon guard - there is no exterior underwater fog in DFU');
});

test('ROAD-B b3: fogT is a 0.02-unit RAMP around the water line, not a threshold', () => {
  // a block whose water surface sits at world y = 1.0
  const waterLevel = -1.0 / GLOBAL_SCALE;   // waterSurfaceY = -level * GlobalScale
  const surfaceY = -waterLevel * GLOBAL_SCALE;
  assert.ok(near(surfaceY, 1.0));
  // adjustedCamY = camY + 50 * 0.025 - 0.95 = camY + 0.30
  // entry = surfaceY + 0.38, exit = entry - 0.02
  // => dry at camY >= surfaceY + 0.08, full at camY <= surfaceY + 0.06
  assert.equal(fogT(waterLevel, surfaceY + 0.20), 0, 'well above: dry');
  assert.ok(near(fogT(waterLevel, surfaceY + 0.08), 0, 1e-12), 'the entry threshold itself is still dry');
  assert.ok(near(fogT(waterLevel, surfaceY + 0.07), 0.5, 1e-9), 'half a centimetre in is half the fog');
  assert.ok(near(fogT(waterLevel, surfaceY + 0.06), 1, 1e-12), 'the exit threshold is full fog');
  assert.equal(fogT(waterLevel, surfaceY - 5), 1, 'and it clamps - deeper is not more');
  // the 10000 sentinel: no water in the block, so no fog anywhere a
  // player can be
  assert.equal(fogT(10000, 0), 0);
  assert.equal(fogT(10000, -100), 0, 'the sentinel puts the line 250 units below the deepest floor');
});

test('ROAD-B b3: UpdateFog backs the room up on the dry frame and restores it on surfacing', () => {
  const fog = new UnderwaterFog();
  const waterLevel = -1.0 / GLOBAL_SCALE;
  const room = { mode: 'exp', density: 0.005, start: 0, end: 0, color: [0, 0, 0] };
  assert.deepEqual(DUNGEON_FOG.color.slice(), [0, 0, 0], 'WeatherManager.cs:77 + SetFog’s black');
  assert.equal(DUNGEON_FOG.density, 0.005);

  // dry: the room comes back unchanged, and is remembered
  let s = fog.updateFog(waterLevel, 1.2, room);
  assert.equal(s.mode, 'exp');
  assert.equal(s.density, 0.005);
  assert.deepEqual(s.color, [0, 0, 0]);

  // half in: exponential, the lerped density, the green
  s = fog.updateFog(waterLevel, 1.07, room);
  assert.equal(s.mode, 'exp');
  assert.ok(near(s.density, FOG_DENSITY_MIN + (FOG_DENSITY_MAX - FOG_DENSITY_MIN) * 0.5, 1e-9),
    'Mathf.Lerp(fogDensityMin, fogDensityMax, fogT)');
  assert.deepEqual(s.color, [...WATER_FOG_COLOR]);

  // fully under
  s = fog.updateFog(waterLevel, 0.5, room);
  assert.ok(near(s.density, FOG_DENSITY_MAX));
  assert.deepEqual(s.color, [...WATER_FOG_COLOR]);

  // THE RESTORE. While submerged the host keeps handing its own dungeon
  // fog in; the backup must be the one taken on the last DRY frame, not
  // re-taken from the water settings - so surfacing returns the room.
  s = fog.updateFog(waterLevel, 1.2, room);
  assert.equal(s.mode, 'exp');
  assert.equal(s.density, 0.005);
  assert.deepEqual(s.color, [0, 0, 0], 'the green must not stick after surfacing');
});

test('ROAD-B b3: the backup is taken on the ENTRY frame too, so a changed room survives the dive', () => {
  // oldFogT == 0 covers both "out of water" and "just entering", which
  // is what lets the room the player dived out of come back.
  const fog = new UnderwaterFog();
  const waterLevel = -1.0 / GLOBAL_SCALE;
  const litRoom = { mode: 'linear', density: 0.02, start: 5, end: 90, color: [0.2, 0.1, 0.3] };
  // the frame that ENTERS the water still carries the dry room in
  let s = fog.updateFog(waterLevel, 1.07, litRoom);
  assert.deepEqual(s.color, [...WATER_FOG_COLOR], 'and it is already green');
  // deeper, with the host now feeding whatever it likes
  fog.updateFog(waterLevel, 0.4, { mode: 'exp', density: 0.25, start: 0, end: 0, color: [0, 0.1, 0.08] });
  // surfacing restores the room from the entry frame, not the water
  s = fog.updateFog(waterLevel, 2.0, { mode: 'exp', density: 0.25, start: 0, end: 0, color: [0, 0.1, 0.08] });
  assert.equal(s.mode, 'linear');
  assert.equal(s.density, 0.02);
  assert.equal(s.start, 5);
  assert.equal(s.end, 90);
  assert.deepEqual(s.color, [0.2, 0.1, 0.3]);
});

test('ROAD-B b3: applyFog puts a settings record through the port’s one fog door', () => {
  const seen = [];
  applyFog({ setFog: (...a) => seen.push(a) }, { mode: 'exp', density: 0.125, start: 1, end: 2, color: [0.1, 0.2, 0.3] });
  assert.equal(seen.length, 1);
  const [mode, density, start, end, color] = seen[0];
  assert.deepEqual([mode, density, start, end], ['exp', 0.125, 1, 2]);
  assert.ok(color instanceof Float32Array, 'the renderer takes a Float32Array');
  assert.ok(near(color[1], 0.2, 1e-7));
});

test('ROAD-B b3: both dungeon hosts run UpdateFog per frame; no exterior host does', () => {
  const callers = new Map();
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.js')) continue;
      const src = readFileSync(p, 'utf8');
      if (/underwaterFogSettings/.test(src)) callers.set(relative(SRC, p).replace(/\\/g, '/'), src);
    }
  };
  walk(SRC);
  for (const host of ['scenes/dungeon.js', 'scenes/worldModes.js']) {
    assert.ok(callers.has(host), `${host} must apply the underwater fog`);
    assert.match(callers.get(host), /applyFog\(renderer, [a-zA-Z]+\.underwaterFogSettings\?\.\([^)]*\) \?\? DUNGEON_FOG\)/,
      `${host} passes the DungeonFogSettings base and falls back to it off-block`);
  }
  assert.ok(callers.has('scenes/dungeonContext.js'), 'the context owns the instance');
  // The exterior hosts must NOT: PlayerEnterExit.cs:327-352 has the one
  // call site and it is inside the dungeon guard.
  for (const host of ['scenes/world.js', 'scenes/exterior.js']) {
    assert.equal(callers.has(host), false,
      `${host} must not tint the screen underwater - DFU has no exterior UpdateFog call`);
  }
});
