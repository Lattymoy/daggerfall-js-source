import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SaveWindow } from '../../src/ui/saveWindow.js';
import { makeWindowStack } from '../../src/ui/windowStack.js';

test('save screenshot is released once when the dungeon stack reconciles a closed window', () => {
  const released = [];
  const win = new SaveWindow('load', { playerName: () => 'GPU regression' });
  win._renderer = { releaseTexture: (...args) => released.push(args) };
  win._shot = { key: 42, tex: {}, url: 'fixture' };
  const stack = makeWindowStack();
  stack.pushWindow(win);
  stack.reconcile(null);
  assert.deepEqual(released, [['saveshot', 42]]);
  assert.equal(win._shot, null);
  win.dispose();
  assert.deepEqual(released, [['saveshot', 42]], 'later teardown must not release twice');
});

test('covering a save window retains its screenshot until the save window itself closes', () => {
  const released = [];
  const win = new SaveWindow('load', { playerName: () => 'GPU regression' });
  win._renderer = { releaseTexture: (...args) => released.push(args) };
  win._shot = { key: 43, tex: {}, url: 'fixture' };
  const stack = makeWindowStack();
  stack.pushWindow(win);
  stack.pushWindow({});
  assert.equal(released.length, 0);
  stack.reconcile(null);
  assert.equal(released.length, 0, 'uncovering the save window keeps its texture');
  stack.reconcile(null);
  assert.deepEqual(released, [['saveshot', 43]]);
});

test('closing a window cancels the identity of a pending screenshot before upload', () => {
  const win = new SaveWindow('load', { playerName: () => 'GPU regression' });
  const pending = { key: 44, url: 'fixture', tex: null };
  win._shot = pending;
  const stack = makeWindowStack();
  stack.pushWindow(win);
  stack.reconcile(null);
  assert.equal(win._shot, null, 'the existing async identity guard will reject the stale shot');
});
