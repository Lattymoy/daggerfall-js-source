// OT1 (2026-09-10) - AUDIT 64 F0's RESIDUE, WIRED: IsPlayerSwimming
// ABOVE GROUND.
//
// F0 fixed the exterior swim SPEED through `sunk` and recorded the rest:
// `exteriorSwimLatch` modelled PlayerEnterExit.Update's else arm
// (:415-421) and "still has no production caller". The reason it had
// none is that the latch is a CLEARING rule - "don't clear swimming if
// we're outside on a water tile - MeteoricDragon" - and a clear with
// nothing to guard is a no-op: both exterior hosts wrote `player.swimming
// = false` every frame (shared.js's applyMotorEffectFlags) and nothing
// above ground ever wrote true. So a sea swim never suppressed the
// encounter roll (StreamingWorld :488-491 reads IsPlayerSwimming), never
// refused a rest (355, restSession.js:185), and a dungeon exit onto open
// water lost the dungeon branch's value on its first exterior frame.
//
// DFU has exactly two writers above ground, and the port's own motor
// note at `_beginSink` names the first: PlayerHeightChanger's DoSinking /
// DoUnsinking write IsPlayerSwimming in lockstep with controllerSink
// ("the host's half of the same edge"), and PlayerEnterExit's else arm
// clears it off tile 0. `exteriorSwimming` is both, and the two exterior
// hosts call it after the surface model, feeding the value the frame
// arrived with (read BEFORE the per-frame clear) and the sink edge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exteriorSwimming, exteriorSwimLatch } from '../src/player/exteriorSurface.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel) => readFileSync(join(root, rel), 'utf8');

test('OT1: the sink edge writes IsPlayerSwimming, the unsink edge clears it, the latch carries between', () => {
  // DoSinking's write: sunk is swimming, on any tile (the sink itself
  // only arms on Swimming water, so the tile is 0 when it is live).
  assert.equal(exteriorSwimming({ wasSwimming: false, sunk: true, tileIndex: 0 }), true, 'DoSinking: controllerSink true -> IsPlayerSwimming true');
  assert.equal(exteriorSwimming({ wasSwimming: false, sunk: true, tileIndex: 5 }), true, 'the sink is the writer, not the tile');
  // DoUnsinking's write beats the latch: stepping from the sea onto a
  // ship hull (StaticGeometry over tile 0) unsinks, and DFU's flag goes
  // false THAT frame even though PlayerTileMapIndex is still 0.
  assert.equal(exteriorSwimming({ wasSwimming: true, sunk: false, unsunk: true, tileIndex: 0 }), false, 'DoUnsinking clears on the edge, tile 0 or not');
  // Between edges: MeteoricDragon's latch alone - the carried value
  // survives on tile 0 and clears on every other tile.
  assert.equal(exteriorSwimming({ wasSwimming: true, sunk: false, unsunk: false, tileIndex: 0 }), true, 'a dungeon exit onto open water keeps the dungeon\'s value');
  assert.equal(exteriorSwimming({ wasSwimming: true, sunk: false, unsunk: false, tileIndex: 5 }), false, 'a shallow tile is not record 0');
  assert.equal(exteriorSwimming({ wasSwimming: true, sunk: false, unsunk: false, tileIndex: -1 }), false, 'no tilemap under the player reads as not water');
  assert.equal(exteriorSwimming({ wasSwimming: false, sunk: false, unsunk: false, tileIndex: 0 }), false, 'the latch never SETS: open water with nothing carried is dry');
  // The default arguments are the shell case shared.js already wrote.
  assert.equal(exteriorSwimming(), false);
  // The latch half is the pure function ROAD-B b3 pinned - the helper
  // composes it rather than restating it.
  for (const was of [true, false]) for (const idx of [0, 2, 5, -1]) {
    assert.equal(exteriorSwimming({ wasSwimming: was, tileIndex: idx }), exteriorSwimLatch(was, idx).swimming);
  }
});

test('OT1: both exterior hosts feed the helper the pre-clear value and the sink edge, after the surface model', () => {
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = src(host);
    assert.match(s, /import \{[^}]*\bexteriorSwimming\b[^}]*\} from '\.\.\/player\/exteriorSurface\.js'/, `${host} imports exteriorSwimming`);
    // The carried value is read BEFORE applyMotorEffectFlags clears it
    // - after, and the dungeon exit's value is gone before the latch
    // can see it.
    const read = s.indexOf('const _wasSwimming = !!player.swimming;');
    const clear = s.indexOf('applyMotorEffectFlags(player, playerEntity);');
    assert.ok(read > 0 && clear > 0 && read < clear, `${host}: _wasSwimming must be read before the per-frame clear`);
    // The write sits after the surface model (it needs the tile under
    // the player) and after the motor ran (it needs this frame's sunk).
    const surf = s.indexOf('const _surf = exteriorSurfaceNow();');
    const write = s.indexOf("player.swimming = exteriorSwimming({ wasSwimming: _wasSwimming, sunk: !!player.sunk, unsunk: player.heightAction === 'unsink', tileIndex: _surf.tileIndex });");
    assert.ok(surf > 0 && write > surf, `${host}: player.swimming is derived from the surface model's tile`);
    assert.ok(write > clear, `${host}: the write follows the clear it re-derives`);
    // DoUnsinking's write is the motor's own 'unsink' height action -
    // `_beginUnsink` sets it and the lerp's end resets it - so the host
    // invents no memory of its own for the edge.
    const motor = src('src/player/motor.js');
    assert.match(motor, /_beginUnsink\(\) \{[\s\S]{0,400}this\.heightAction = 'unsink';/, 'the motor names the unsink edge');
  }
});

test('OT1: the per-frame clear is untouched - the EFFECT still owns levitate/waterWalking/slowFall', () => {
  // The clear stays exactly as AUDIT 18 pinned it (audit18_hosts_outer):
  // the helper re-derives swimming AFTER it rather than reaching into
  // shared.js, so a host that forgets the helper is back to the old
  // false, never to a leak.
  const shared = src('src/scenes/shared.js');
  assert.match(shared, /player\.swimming = false;/, 'applyMotorEffectFlags still clears swimming');
});
