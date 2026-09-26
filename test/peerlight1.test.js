// PEERLIGHT1 (2026-09-26): another player's lit torch lights my world - the pose's `lt`, and the light at their hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { torchPoseByte, peerTorchLight, playerTorchLight, TORCH_OFFSET, LANTERN_HIP } from '../src/systems/playerTorch.js';
import { validPose, poseChanged } from '../src/net/wire.js';

const P = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('PEERLIGHT1 sender: nothing while no light burns; the steady radius x2 (+1 guttering) while one does', () => {
  assert.equal(torchPoseByte(null), undefined);
  assert.equal(torchPoseByte({ _torch: { range: 0 }, lightSource: { templateIndex: 247 } }), undefined, 'unlit');
  assert.equal(torchPoseByte({ _torch: { range: 14 }, lightSource: { templateIndex: 247, currentCondition: 40 } }), 28, 'a torch, radius 14');
  assert.equal(torchPoseByte({ _torch: { range: 9.7 }, lightSource: { templateIndex: 247, currentCondition: 1 } }), 29, 'guttering: the steady radius, flagged - the flicker is the reader\'s own');
  assert.equal(torchPoseByte({ _torch: { range: 16 }, lightSource: { templateIndex: 248, currentCondition: 40 } }), 32, 'a lantern');
});

test('PEERLIGHT1 wire: rides the pose when lit, omitted otherwise, bounded, and its edge is sent at once', () => {
  assert.equal(validPose({ ...P, lt: 28 }).lt, 28);
  assert.ok(!('lt' in validPose(P)), 'a player with no light keeps the bytes it had');
  assert.ok(!('lt' in validPose({ ...P, lt: 1 })), 'no radius, no light');
  assert.ok(validPose({ ...P, lt: 1e9 }).lt <= 127);
  assert.ok(poseChanged(validPose(P), validPose({ ...P, lt: 28 })), 'lit');
  assert.ok(poseChanged(validPose({ ...P, lt: 28 }), validPose({ ...P, lt: 29 })), 'starts to gutter');
});

test('PEERLIGHT1 reader: the light stands where the owner\'s own torch stands, at any heading; a lantern at the waist lights from the hip', () => {
  for (const yaw of [0, 1, -2.5, Math.PI]) {
    const feet = [3, 1, -4];
    const mine = playerTorchLight({ _torch: { range: 14 } }, feet, yaw);
    const theirs = peerTorchLight({ lt: 28, yaw }, feet);
    for (const k of ['x', 'y', 'z', 'range']) assert.ok(Math.abs(mine[k] - theirs[k]) < 1e-9, `${k} at yaw ${yaw}`);
    assert.equal(theirs.carried, true, 'a light in a hand: no glare ball over the body');
  }
  const hip = peerTorchLight({ lt: 32, yaw: 0, hl: 1 }, [0, 0, 0]);
  assert.equal(hip.y, LANTERN_HIP.up);
  assert.equal(peerTorchLight({ lt: 28, yaw: 0 }, [0, 0, 0]).y, TORCH_OFFSET.up);
  assert.equal(peerTorchLight({ yaw: 0 }, [0, 0, 0]), null, 'no light');
  const g = [0, 1, 2, 3].map((t) => peerTorchLight({ lt: 29, yaw: 0 }, [0, 0, 0], t).range);
  assert.ok(g.every((r) => r > 0 && r <= 14.5) && new Set(g).size > 1, 'a guttering torch flickers at the reader');
});

test('PEERLIGHT1 wiring: sent with my pose, eased, and added to every scene\'s light list', () => {
  const w = read('src/scenes/world.js'), m = read('src/scenes/worldModes.js');
  assert.match(w, /lt: torchPoseByte\(playerEntity\),/);
  assert.equal((w.match(/\.\.\.peerTorchLights\(\), \.\.\.\(gatePool\?\.lights\(\) \?\? \[\]\), \.\.\.camps\.lights\(\), \.\.\.droppedTorches\.lights\(\)\)/g) || []).length, 2, 'the exterior, night and day');
  assert.match(w, /peerLights: \(\) => peerTorchLights\(\),/);
  assert.match(m, /\.\.\.\(host\.peerLights\?\.\(\) \?\? \[\]\)\.map\(_dgTint\), \.\.\.dungeonCtx\.campLights\(\)/, 'the dungeon, in its tint');
  assert.match(m, /\.\.\.\(host\.peerLights\?\.\(\) \?\? \[\]\), \.\.\.interiorTorches\.lights\(\)\)/, 'the interior');
  assert.match(read('src/net/online.js'), /\.\.\.\(to\.lt \? \{ lt: to\.lt \} : \{\}\)/, 'the pose ease carries it');
});

test('PEERLIGHT2 wire: the Light spell rides the pose as `lc` 1, omitted otherwise, and its edge is sent at once', () => {
  assert.equal(validPose({ ...P, lc: 1 }).lc, 1);
  assert.equal(validPose({ ...P, lc: 7 }).lc, 1, 'a bit');
  assert.ok(!('lc' in validPose(P)), 'no spell, the bytes it had');
  assert.ok(poseChanged(validPose(P), validPose({ ...P, lc: 1 })), 'cast');
  assert.ok(poseChanged(validPose({ ...P, lc: 1 }), validPose(P)), 'run out');
});

test('PEERLIGHT2 wiring: sent while the effect burns; the live mode\'s engine hangs one candle mount a peer (sprite and light), the other engine put out; out on death and offline', () => {
  const w = read('src/scenes/world.js'), h = read('src/scenes/hostMagic.js'), d = read('src/scenes/dungeonContext.js');
  assert.match(w, /lc: hasActiveEffect\(playerEntity, 'light'\) \? 1 : undefined,/);
  assert.match(w, /peerCandlesFrame\(drawable, dt\);/);
  assert.match(w, /if \(dc\?\.peerCandles\) \{ magic\.peerCandles\?\.\(\[\], dt\); _peerCandleLights = dc\.peerCandles\(want, dt\)/);
  assert.match(w, /for \(const l of _peerCandleLights\) _peerLights\.push\(l\);/, 'their candles join the light list');
  assert.match(w, /peerWalkers\?\.destroy\(\); peerCandlesFrame\(\[\], dt\); return;/, 'the dead see no candle');
  assert.match(w, /else \{ if \(_peerCandleLights\.length\) peerCandlesFrame\(\[\], dt\);/, 'offline');
  assert.match(h, /peerCandles\(list, dt\) \{/);
  assert.match(h, /m\.update\(dt, \{ active: true, feet: c\.feet, height: c\.height, forward: c\.forward \}\);/, 'the mount mine is');
  assert.match(h, /if \(!want\.has\(id\)\) \{ m\.clear\(\); peerCandleMounts\.delete\(id\); \}/, 'a peer gone drops its sprite');
  assert.match(h, /for \(const m of peerCandleMounts\.values\(\)\) m\.offsetAll\(offset\);/, 'the recenter');
  assert.match(h, /for \(const m of peerCandleMounts\.values\(\)\) m\.clear\(\);/, 'the teardown');
  assert.match(d, /peerCandles: \(list, dt\) => magic\.peerCandles\(list, dt\),/, 'the dungeon\'s own engine');
  assert.match(read('src/net/online.js'), /\.\.\.\(to\.lc \? \{ lc: 1 \} : \{\}\)/, 'the pose ease carries it');
});
