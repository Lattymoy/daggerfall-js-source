// The input map: bindings + routing precedence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overlayAction, gameAction, routeKey } from '../src/ui/input.js';

test('input: the binding tables', () => {
  assert.equal(overlayAction({ key: 'a' }), 'char:a');
  assert.equal(overlayAction({ key: 'Enter' }), 'confirm');
  assert.equal(overlayAction({ key: '=' }), 'plus');
  assert.equal(overlayAction({ key: 'F9' }), null);
  assert.equal(gameAction({ key: 'F5' }), 'charSheet');
  assert.equal(gameAction({ key: 'F6' }), 'inventory');
  assert.equal(gameAction({ key: 'Backspace' }), 'spellbook');
  assert.equal(gameAction({ key: 'c', code: 'KeyC' }), 'castSpell');
  assert.equal(gameAction({ key: 'x', code: 'KeyX' }), null);
});

test('input: routeKey - overlay precedence, toggles, cast dir, unconsumed', () => {
  const calls = [];
  const ctx = {
    uiOverlayActive: false,
    overlayInput: (a) => calls.push('ov:' + a),
    toggleCharSheet: () => calls.push('sheet'),
    toggleInventory: () => calls.push('inv'),
    toggleSpellbook: () => calls.push('book'),
    playerCastInput: (eye, dir) => calls.push(`cast:${eye},${dir}`),
  };
  assert.ok(routeKey({ key: 'F6' }, ctx, () => ({})));
  assert.ok(routeKey({ key: 'c', code: 'KeyC' }, ctx, () => ({ eye: [1], dir: [2] })));
  assert.ok(!routeKey({ key: 'x', code: 'KeyX' }, ctx, () => ({})));   // unconsumed falls through
  ctx.uiOverlayActive = true;
  assert.ok(routeKey({ key: 'Backspace' }, ctx, () => ({})));           // overlay wins: backspace edits, not spellbook
  assert.ok(!routeKey({ key: 'F9' }, ctx, () => ({})));
  assert.deepEqual(calls, ['inv', 'cast:1,2', 'ov:backspace']);
});

test('input: the one-shot click-cast latch', async () => {
  const { OneShotLatch } = await import('../src/ui/input.js');
  const l = new OneShotLatch();
  assert.ok(!l.consume());          // unarmed: nothing
  l.arm();
  assert.ok(l.consume());           // fires once
  assert.ok(!l.consume());          // one-shot: the next click swings
  l.arm(); l.arm();
  assert.ok(l.consume());
  assert.ok(!l.consume());          // double-arm still single fire
});
