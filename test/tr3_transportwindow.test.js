import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TransportWindow, TRANSPORT_RECTS, TRANSPORT_DISABLED_RECTS, DISABLED_SHEET,
  transportPanelOrigin, drawTransportDisabledRow, CANNOT_CHANGE_INDOORS,
  TRANSPORT_BASE_IMG, TRANSPORT_DISABLED_IMG,
} from '../src/ui/transportWindow.js';
import { TRANSPORT_MODES } from '../src/systems/transport.js';

// TR3 - THE TRANSPORT WINDOW (DaggerfallTransportWindow, whole): the
// last of DFU's 60 real windows the port did not have, and the door
// TR1's mode and TR2's sprite were both waiting on.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const win = (over = {}, log = []) => new TransportWindow({
  hasHorse: true, hasCart: true, shipAvailable: false,
  onMode: (m) => log.push(`mode:${m}`), onClose: () => log.push('close'), ...over,
});

test('TR3: the rects - four rows and an exit on the panel, three DISABLED rows in a 122x36 SHEET', () => {
  assert.deepEqual([...TRANSPORT_RECTS.foot], [5, 5, 120, 7]);
  assert.deepEqual([...TRANSPORT_RECTS.horse], [5, 14, 120, 7]);
  assert.deepEqual([...TRANSPORT_RECTS.cart], [5, 23, 120, 7]);
  assert.deepEqual([...TRANSPORT_RECTS.ship], [5, 32, 120, 7]);
  assert.deepEqual([...TRANSPORT_RECTS.exit], [44, 42, 43, 15]);
  assert.deepEqual([...TRANSPORT_DISABLED_RECTS.horse], [1, 10, 120, 7]);
  assert.deepEqual([...TRANSPORT_DISABLED_RECTS.cart], [1, 19, 120, 7]);
  assert.deepEqual([...TRANSPORT_DISABLED_RECTS.ship], [1, 28, 120, 7]);
  assert.deepEqual({ ...DISABLED_SHEET }, { width: 122, height: 36 });
  // The two sets differ by (-4, -4) BECAUSE the disabled ones are
  // sheet coordinates, not panel ones - the pin that stops a future
  // reader "correcting" them to match.
  for (const row of ['horse', 'cart', 'ship']) {
    assert.equal(TRANSPORT_DISABLED_RECTS[row][0], TRANSPORT_RECTS[row][0] - 4, row);
    assert.equal(TRANSPORT_DISABLED_RECTS[row][1], TRANSPORT_RECTS[row][1] - 4, row);
  }
  assert.equal(TRANSPORT_BASE_IMG, 'MOVE00I0.IMG');
  assert.equal(TRANSPORT_DISABLED_IMG, 'MOVE01I0.IMG');
});

test('TR3: ownership is read ONCE at Setup (:78-81) and decides which rows work', () => {
  const w = win({ hasHorse: false, hasCart: true });
  assert.deepEqual({ ...w.enabled }, { foot: true, horse: false, cart: true, ship: false });
  // Foot is ALWAYS enabled - there is no `if` around its handler.
  assert.equal(win({ hasHorse: false, hasCart: false }).enabled.foot, true);
  // Selling the horse after the window opened does not change the row.
  const items = { hasHorse: true };
  const w2 = win(items);
  items.hasHorse = false;
  assert.equal(w2.enabled.horse, true);
});

test('TR3: a row sets the mode and closes; a DISABLED row is a dead button that eats its click (:82-91)', () => {
  const inside = ([rx, ry]) => [rx + 1, ry + 1];   // no art loaded: the origin is (160, 100)
  const o = transportPanelOrigin(null);
  assert.deepEqual(o, { x: 160, y: 100 }, 'a missing image centres on zero size');
  const at = ([rx, ry]) => [rx + o.x + 1, ry + o.y + 1];
  let log = [];
  let w = win({}, log);
  w.click(...at(TRANSPORT_RECTS.horse));
  assert.deepEqual(log, [`mode:${TRANSPORT_MODES.Horse}`, 'close'], 'set THEN close (:217-218)');
  log = []; w = win({ hasHorse: false }, log);
  assert.equal(w.click(...at(TRANSPORT_RECTS.horse)), true, 'the click is eaten');
  assert.deepEqual(log, [], 'and nothing happens');
  assert.equal(w.done, false);
  log = []; w = win({}, log);
  w.click(...at(TRANSPORT_RECTS.foot));
  assert.deepEqual(log, [`mode:${TRANSPORT_MODES.Foot}`, 'close']);
  log = []; w = win({}, log);
  w.click(...at(TRANSPORT_RECTS.exit));
  assert.deepEqual(log, ['close'], 'exit closes only');
  // The ship row is dead until TR4.
  log = []; w = win({}, log);
  w.click(...at(TRANSPORT_RECTS.ship));
  assert.deepEqual(log, []);
  assert.equal(inside(TRANSPORT_RECTS.foot).length, 2);
});

test('TR3: the accelerators skip disabled rows, and Escape closes without a mode', () => {
  let log = [];
  let w = win({ hasHorse: false, hasCart: true }, log);
  w.input('KeyH');
  assert.deepEqual(log, [], 'no horse, no hotkey');
  w.input('KeyC');
  assert.deepEqual(log, [`mode:${TRANSPORT_MODES.Cart}`, 'close']);
  log = []; w = win({}, log); w.input('KeyF');
  assert.deepEqual(log, [`mode:${TRANSPORT_MODES.Foot}`, 'close']);
  log = []; w = win({}, log); w.input('Escape');
  assert.deepEqual(log, ['close']);
  log = []; w = win({ shipAvailable: false }, log); w.input('KeyS');
  assert.deepEqual(log, [], 'the ship hotkey is dead until TR4');
});

test('TR3: the disabled blit reads its sub-rect from the 122x36 sheet', () => {
  const calls = [];
  const renderer = { drawScreenQuad: (tex, dst, src) => calls.push({ tex, dst, src }) };
  const m = { ox: 10, oy: 20, s: 2 };
  drawTransportDisabledRow(renderer, { tex: 'SHEET' }, m, TRANSPORT_DISABLED_RECTS.cart, [5, 23]);
  const [sx, sy, sw, sh] = TRANSPORT_DISABLED_RECTS.cart;
  assert.equal(calls[0].tex, 'SHEET');
  assert.ok(near(calls[0].src.u0, sx / 122) && near(calls[0].src.u1, (sx + sw) / 122));
  assert.ok(near(calls[0].src.v0, sy / 36) && near(calls[0].src.v1, (sy + sh) / 36));
  assert.deepEqual(calls[0].dst, { x: 10 + 5 * 2, y: 20 + 23 * 2, w: sw * 2, h: sh * 2 });
});

test('TR3: the host door - grounded and outdoors only, and the mount is loaded and drawn', () => {
  const input = read('src/ui/input.js');
  assert.match(input, /case 'Transport': return ctx\.openTransport \? \(ctx\.openTransport\(\), true\) : false;/);
  const world = read('src/scenes/world.js');
  // dfuiOpenTransportWindow (:690-700): airborne is SILENTLY ignored.
  assert.match(world, /openTransport: \(\) => \{\s*\n\s*if \(!player\.grounded \|\| !transportArtLoaded\(\)\) return;/);
  assert.match(world, /hasHorse: hasHorse\(playerEntity\.items \?\? \[\]\),/);
  // TR4 made the row live for an owner; tr4_ship.test.js holds that.
  assert.match(world, /shipAvailable: ownsShip\(playerEntity\),/);
  // The mount's art is loaded on the pick and dropped when you dismount.
  assert.match(world, /ridingAnimator\.mount\(mode\);/);
  assert.match(world, /if \(isRiding\(mode\)\) \{\s*\n\s*loadRidingArt\(fetchBytes, palette, renderer, mode\)/);
  // The sprite goes in BEFORE the HUD (OnGUI depth 2).
  // F-E1 (the parity audit): OnGUI :293 refuses to draw while paused -
  // an open window hides the mount, it does not freeze it.
  assert.match(world, /if \(ridingArt && isRiding\(player\.transportMode\) && !ridePaused\) \{/);
  const spriteAt = world.indexOf('renderer.drawScreenQuad(ridingArt.frames[r.frame], rect);');
  const hudAt = world.indexOf('drawHud(renderer, canvas, hudArt, playerEntity,');
  assert.ok(spriteAt > 0 && hudAt > spriteAt, 'the mount draws under the HUD');
  // The loop is a REAL channel, not an optional-chained no-op.
  // MW-D42 moved this pin deliberately: with the enhanced 3D horse
  // standing, the mod's own hoof clips ride the channel through the
  // MW-D40 string-key door - and the CLASSIC clip stays the literal
  // fallback in the same expression, so the 1:1 lane is untouched.
  assert.match(world, /audio\.setLoop\('riding', r\.playing \? rideClip : null, \{ volume: r\.volume, pitch: r\.pitch \}\);/);
  assert.match(world, /const rideClip = pegasUp && pegasSounds\.has\(pegasClipKey\) \? pegasClipKey : SOUND\[r\.clip\];/);
  assert.match(read('src/systems/audio.js'), /setLoop\(name, clip, \{ volume = 1, pitch = 1 \} = \{\}\) \{/);
  assert.equal(typeof CANNOT_CHANGE_INDOORS, 'string');
});
