// PEERMENU1 (2026-09-26): the player menu opens on a bind - a press or a hold, keyboard or controller.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPeerMenuReader, peerMenuBind, setPeerMenuBind, PEER_MENU_HOLD_S } from '../src/systems/peerMenuBind.js';
import { _resetForTests as resetPrefs } from '../src/systems/uiPrefs.js';

test('PEERMENU1: the defaults are hold E and hold A; a bind of the wrong kind is refused', () => {
  resetPrefs();
  assert.deepEqual(peerMenuBind('key'), { code: 'KeyE', hold: true });
  assert.deepEqual(peerMenuBind('pad'), { code: 'JoystickButton0', hold: true });
  assert.equal(setPeerMenuBind('key', { code: 'JoystickButton3' }), false, 'a pad code is not a key');
  assert.equal(setPeerMenuBind('pad', { code: 'KeyG' }), false);
  resetPrefs();
});

test('PEERMENU1: a hold fires once after the hold time, a tap never; a press bind fires on the keydown, not on repeat', () => {
  resetPrefs();
  let t = 0; const fired = [];
  const r = createPeerMenuReader({ onFire: (k) => fired.push(k), now: () => t });
  r.down('KeyE'); t = PEER_MENU_HOLD_S / 2; r.frame(); r.up('KeyE'); r.frame();
  assert.deepEqual(fired, [], 'a tap of E is only E');
  r.down('KeyE'); t += PEER_MENU_HOLD_S + 0.01; r.frame(); r.frame();
  assert.deepEqual(fired, ['key'], 'held, once');
  r.up('KeyE');
  setPeerMenuBind('pad', { code: 'JoystickButton3', hold: false });
  r.down('JoystickButton3'); r.down('JoystickButton3', true);
  assert.deepEqual(fired, ['key', 'pad'], 'a press bind: the press, not the repeat');
  r.down('JoystickButton0'); t += 5; r.frame();
  assert.deepEqual(fired, ['key', 'pad'], 'the old pad button is nothing now');
  resetPrefs();
});
