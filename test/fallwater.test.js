// FD1 - THE OUTDOOR-WATER FALL EXEMPTION (2026-08-28).
//
// AcrobatMotor.CheckFallingDamage (:208-224), first statement after
// clearing `falling`:
//
//   // don't take damage if landing in outdoor water
//   if (GameManager.Instance.StreamingWorld.PlayerTileMapIndex == 0)
//       return;
//   float fallDistance = fallStartLevel - myTransform.position.y;
//
// It returns BEFORE the distance is computed, so the exemption covers
// the BadFallDetected half too: a landing in a lake costs neither HP
// nor the hard-fall grunt. Both exterior hosts billed a water landing
// exactly like ground.
//
// PlayerTileMapIndex (StreamingWorld.cs:345) is
// `playerTerrain.TileMap[...].r / 4` over the bytes TerrainHelper's
// UpdateTileMapDataJob writes - which the port already had verbatim in
// convertTilemap, 0xFF sentinel and all. So the index is that
// conversion >> 2 and needed no new law, only a per-tile door onto the
// one it had. That is why convertTile was factored out rather than the
// conversion re-derived beside the fall code: a second copy is how the
// water sentinel comes to be handled in one place and not the other.
//
// AND -1 IS WHY THIS NEEDS NO INTERIOR ARM.
// UpdatePlayerTerrainTileIndex (:321) sets the index to -1 and returns
// early when the player is over no terrain object - every dungeon and
// every building interior. -1 is not 0, so the exemption is simply
// false there, and the port's `null` tile maps onto it exactly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  convertTile, convertTilemap, playerTileMapIndex, isOutdoorWaterTile, WATER_TILE_INDEX,
} from '../src/world/terrainSurface.js';
import { applyFallLanding } from '../src/scenes/shared.js';
import { FALL_DAMAGE_THRESHOLD } from '../src/player/motor.js';   // the constants' one home
import { dfuFile } from './dfuRoot.mjs';   // PY1: DFU_PATH, then the in-tree sparse clone

const HERE = dirname(fileURLToPath(import.meta.url));

test('FD1: PlayerTileMapIndex is the CONVERTED tile >> 2, sentinel included', () => {
  // record 0 with no transform bits IS water, the plain case
  assert.equal(playerTileMapIndex(0), 0);
  assert.equal(WATER_TILE_INDEX, 0, "StreamingWorld's own doc: 0 = Water");
  // THE SENTINEL. setLocationTiles stores a zero tileBitfield as 0xFF
  // so AssignTiles will not overwrite it, and convertWater (true on the
  // DEFAULT texturer) restores it to record 0 - so a location ground
  // tile that encoded as zero reads as WATER to this index. That is
  // DFU's behaviour and the port keeps it; masking the raw byte with
  // 0x3f instead would answer 63 here and silently lose the case.
  assert.equal(playerTileMapIndex(0xff), 0, 'the 0xFF location-zero sentinel is water');
  assert.notEqual(0xff & 0x3f, 0, 'and a plain 0x3f mask would NOT have said so');
  // every other tile is its 6-bit record, transform bits dropped by the
  // divide: (tile * 4) & 0xff is (tile & 0x3f) * 4, and rotate (+1) and
  // flip (+2) are both under 4.
  for (const raw of [1, 2, 3, 7, 30, 62, 63]) {
    for (const bits of [0, 64, 128, 192]) {
      const tile = raw | bits;
      // ...except where the transform bits carry the byte ONTO the
      // sentinel; see the collision pinned below.
      if (tile === 0xff) continue;
      assert.equal(playerTileMapIndex(tile), raw, `record ${raw} with transform bits ${bits}`);
    }
  }
  // THE SENTINEL COLLIDES WITH A REAL TILE, and DFU lets it.
  // Record 63 with BOTH the rotate (0x40) and flip (0x80) bits set is
  // the byte 0xFF exactly, so the convertWater arm claims it before
  // the record arm is ever reached: that tile reads as WATER, not as
  // 63. This is not the port rounding a corner - the C# tests
  // `tile == byte.MaxValue` first and has no way to tell the two
  // apart either. It surfaced as a failing assertion in the first
  // version of this loop, which asserted the record always survives
  // its transform bits, and the honest resolution was to pin the
  // collision rather than to exclude the case quietly.
  assert.equal(63 | 192, 0xff, 'record 63 + rotate + flip IS the sentinel byte');
  assert.equal(playerTileMapIndex(63 | 192), 0, 'and DFU reads it as water');
  assert.equal(playerTileMapIndex(63 | 64), 63, 'either bit alone leaves the record readable');
  assert.equal(playerTileMapIndex(63 | 128), 63);
});

test('FD1: a null tile is DFU\'s -1 - no terrain means NOT water', () => {
  // The safe direction, and the one C# takes: a missed exemption costs
  // the player HP, an over-eager one makes every fall free. This is
  // also the whole interior/dungeon story - those hosts never see a
  // terrain tile, so they never take the exemption.
  assert.equal(playerTileMapIndex(null), -1);
  assert.equal(playerTileMapIndex(undefined), -1);
  assert.equal(isOutdoorWaterTile(null), false);
  assert.equal(isOutdoorWaterTile(undefined), false);
  assert.equal(isOutdoorWaterTile(0), true);
  assert.equal(isOutdoorWaterTile(0xff), true);
  assert.equal(isOutdoorWaterTile(1), false, 'dirt is not water');
});

test('FD1: convertTile is the SAME law convertTilemap runs - one home', () => {
  // The factoring is only safe if the array path still goes through it;
  // this is the pin that says so, over every byte a tilemap can hold.
  const all = new Uint8Array(256);
  for (let i = 0; i < 256; i++) all[i] = i;
  const bulk = convertTilemap(all);
  for (let i = 0; i < 256; i++) assert.equal(bulk[i], convertTile(i), `tile ${i}`);
});

test('FD1: a water landing costs neither HP nor the hard-fall grunt', () => {
  const mk = () => ({ health: 100, maxHealth: 100, level: 1, career: {}, skills: new Array(40).fill(50) });
  const far = FALL_DAMAGE_THRESHOLD * 4;
  // the control first: without the exemption the same fall bills
  const ground = mk(); const groundSounds = []; const groundHurt = [];
  applyFallLanding(ground, far, { hurt: (n) => groundHurt.push(n), sound: (s) => groundSounds.push(s) });
  assert.ok(groundHurt[0] > 0, 'a long fall on land costs HP');
  assert.equal(groundSounds.length, 1, 'and rings the fall-damage clip');
  // ...and with it, nothing happens at all
  const water = mk(); const waterSounds = []; const waterHurt = [];
  applyFallLanding(water, far, {
    hurt: (n) => waterHurt.push(n), sound: (s) => waterSounds.push(s), inOutdoorWater: true,
  });
  assert.deepEqual(waterHurt, [], 'no damage in water');
  assert.deepEqual(waterSounds, [], 'and NO sound - DFU returns before the distance is computed');
  assert.equal(water.health, 100);
  // THE HALF-PORT THIS GUARDS AGAINST: the BadFallDetected band, which
  // costs no HP and would still grunt if the exemption were written
  // inside the damage arm instead of ahead of both.
  const mid = FALL_DAMAGE_THRESHOLD * 0.75;   // over half, under the threshold
  const hardSounds = [];
  applyFallLanding(mk(), mid, { sound: (s) => hardSounds.push(s) });
  assert.equal(hardSounds.length, 1, 'a hard-but-safe fall grunts on land');
  const wetSounds = [];
  applyFallLanding(mk(), mid, { sound: (s) => wetSounds.push(s), inOutdoorWater: true });
  assert.deepEqual(wetSounds, [], 'and is silent in water');
});

test('FD1: both exterior hosts take the exemption; the underground hosts do not', () => {
  // A SOURCE SWEEP over the shared law's call sites. The exemption is
  // only real where a host passes it, and "one host got the fix" is
  // exactly the shape the FOUR HOSTS RULE exists to catch - world.js
  // and exterior.js carried the identical flag, worded identically,
  // for as long as it stood.
  const SRC = join(HERE, '..', 'src');
  const callers = new Map();
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.js')) continue;
      const src = readFileSync(p, 'utf8');
      if (/\bapplyFallLanding\s*\(/.test(src) && !/export function applyFallLanding/.test(src)) {
        callers.set(relative(SRC, p), src);
      }
    }
  };
  walk(SRC);
  const outdoor = ['scenes/world.js', 'scenes/exterior.js'];
  for (const host of outdoor) {
    assert.ok(callers.has(host), `${host} still lands falls`);
    assert.match(callers.get(host), /inOutdoorWater:\s*isOutdoorWaterTile\(/,
      `${host} must pass the tile under the player - a host without it bills water like ground`);
  }
  // and the underground/indoor callers must NOT invent one: DFU's
  // index is -1 there, so passing anything true would make dungeon
  // falls free.
  for (const [name, src] of callers) {
    if (outdoor.includes(name)) continue;
    assert.equal(/inOutdoorWater/.test(src), false,
      `${name} has no terrain tilemap; PlayerTileMapIndex is -1 underground and indoors`);
  }
});

const ACROBAT_CS = dfuFile('Assets/Scripts/Game/Player/AcrobatMotor.cs');

test('FD1: the exemption is REGENERATED from AcrobatMotor.cs', { skip: !existsSync(ACROBAT_CS) }, () => {
  const cs = readFileSync(ACROBAT_CS, 'utf8');
  const at = cs.indexOf('public void CheckFallingDamage');
  assert.ok(at > 0, 'CheckFallingDamage is still there under this name');
  const body = cs.slice(at, cs.indexOf('\n        }', at));
  assert.match(body, /PlayerTileMapIndex\s*==\s*0/, 'the exemption still tests tile index 0');
  // THE ORDER IS THE LAW: the early return sits above the fallDistance
  // computation, which is what makes the hard-fall sound exempt too.
  assert.ok(body.indexOf('PlayerTileMapIndex') < body.indexOf('fallDistance'),
    'the water return precedes the distance - if DFU ever moves it, the sound arm changes with it');
});
