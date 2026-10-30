import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClientModHost, validClientMod } from '../../src/systems/clientMods.js';
import { loadClientMods } from '../../src/systems/clientModsLoader.js';

const descriptor = (id = 'example', requires = ['player.health.read', 'hud.health-label']) => ({ id, apiVersion: 1, requires, entry: 'main.js' });
test('client mods reject incompatible descriptors and undeclared capabilities', () => {
  for (const mod of [{ ...descriptor(), apiVersion: 2 }, { ...descriptor(), id: '../escape' }, descriptor('x', ['unknown'])]) assert.equal(validClientMod(mod), false);
  const host = createClientModHost();
  assert.equal(host.start(descriptor('missing', []), api => api.player.health()), false);
  assert.deepEqual(host.status().mods, []);
  host.dispose();
});
test('health snapshots are immutable, change-driven, nullable and detached from native entities', () => {
  const host = createClientModHost(), seen = []; let api;
  host.start(descriptor(), value => { api = value; api.player.onHealthChange(h => seen.push(h)); });
  assert.deepEqual(seen, [null]);
  host.publishHealth(41.5, 118);
  assert.deepEqual(seen[1], { current: 41.5, maximum: 118 });
  assert.throws(() => { seen[1].current = 0; }, TypeError);
  for (let i = 0; i < 10000; i++) host.publishHealth(41.5, 118);
  assert.equal(seen.length, 2);
  host.publishHealth(null, null); assert.equal(api.player.health(), null);
  host.publishHealth(0, 118); assert.equal(api.player.health().current, 0);
  host.dispose(); assert.throws(() => api.player.health());
  host.publishHealth(30, 118); assert.equal(seen.length, 4);
});
test('failed initialization releases its subscriptions and label ownership', () => {
  const host = createClientModHost(); let calls = 0;
  assert.equal(host.start(descriptor(), api => {
    api.player.onHealthChange(() => calls++); api.hud.formatHealth(() => 'bad'); throw Error('init failed');
  }), false);
  host.publishHealth(30, 100); assert.equal(calls, 1);
  assert.equal(host.healthLabel(30, 100, '30%'), '30%');
  assert.equal(host.start(descriptor(), api => api.hud.formatHealth(() => '30/100')), true);
  host.dispose();
});
test('formatter owns the native label, caches unchanged frames, and restores fallback on failure', () => {
  const host = createClientModHost(); let calls = 0;
  host.start(descriptor(), api => api.hud.formatHealth(({ current, maximum }) => {
    calls++; if (current === 0) throw Error('formatter'); return `${current}/${maximum}`;
  }));
  assert.equal(host.start(descriptor('conflict'), api => api.hud.formatHealth(() => 'conflict')), false);
  for (let i = 0; i < 10000; i++) assert.equal(host.healthLabel(30, 100, '30%'), '30/100');
  assert.equal(calls, 1);
  assert.equal(host.healthLabel(0, 100, '0%'), '0%');
  assert.equal(host.healthLabel(30, 100, '30%'), '30%'); assert.equal(calls, 2);
  host.dispose();
});
test('listener faults and teardown faults do not prevent other callbacks or cleanup', () => {
  const host = createClientModHost(); let calls = 0, disposed = 0;
  host.start(descriptor(), api => {
    api.player.onHealthChange(h => { if (h) throw Error('listener'); });
    api.player.onHealthChange(() => calls++);
    return () => { disposed++; throw Error('cleanup'); };
  });
  host.publishHealth(1, 100); host.publishHealth(2, 100); assert.equal(calls, 3);
  host.dispose(); host.dispose(); assert.equal(disposed, 1);
  assert.equal(host.status().errors.length, 2);
  for (let i = 0; i < 100; i++) host.reportError('test', Error('bounded'));
  assert.equal(host.status().errors.length, 16);
  assert.equal(host.start(descriptor(), () => {}), false);
});
test('invalid labels and async initializers fail closed without an unhandled rejection', async () => {
  for (const value of ['', 'x'.repeat(65), {}, Promise.resolve('no')]) {
    const host = createClientModHost(); host.start(descriptor(), api => api.hud.formatHealth(() => value));
    assert.equal(host.healthLabel(3, 10, '30%'), '30%'); host.dispose();
  }
  const host = createClientModHost();
  assert.equal(host.start(descriptor(), async api => { api.hud.formatHealth(() => 'stale'); throw Error('async'); }), false);
  assert.equal(host.healthLabel(3, 10, '30%'), '30%');
  await new Promise(resolve => setImmediate(resolve)); host.dispose();
});
test('loader rejects incompatible/remote/traversal entries before evaluating modules', async () => {
  const host = createClientModHost(), imported = [];
  const mods = [{ ...descriptor(), apiVersion: 2 }, descriptor('unknown', ['future']),
    { ...descriptor('remote'), entry: 'https://example.com/a.js' }, { ...descriptor('escape'), entry: '../a.js' }, descriptor('good'), descriptor('good')];
  const session = loadClientMods({ host, fetchIndex: async () => Response.json({ enabled: true, apiVersion: 1, mods }),
    importModule: async url => { imported.push(url); return { default: () => {} }; } });
  await session.ready; assert.deepEqual(imported, ['/__client_mods/good/main.js']); session.dispose();
});
test('page disposal while a module import is pending never initializes the late module', async () => {
  const host = createClientModHost(); let resolveImport, importing;
  const started = new Promise(resolve => { importing = resolve; }); let calls = 0;
  const session = loadClientMods({ host, fetchIndex: async () => Response.json({ enabled: true, apiVersion: 1, mods: [descriptor()] }),
    importModule: () => { importing(); return new Promise(resolve => { resolveImport = resolve; }); } });
  await started; session.dispose(); resolveImport({ default: () => { calls++; } });
  await session.ready; assert.equal(calls, 0); assert.deepEqual(host.status().mods, []);
});
