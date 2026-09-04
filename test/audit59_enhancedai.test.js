// AUDIT 59 - ENHANCED AI, BEFORE THE MERGE (2026-09-04, Mac: "Lets do a
// comprehensive audit on enhanced AI before we merge"). The arc came
// back by reverting its revert; this audit reads it against today's
// tree and the production BUILD, which no node test had looked at. Four
// findings, all fixed here and pinned below; the sweeps that came back
// clean are recorded in bible/01-Overview/Audit-59.md.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EnhancedEnemyAI, makeNavWorld } from '../src/ai/enhancedMotor.js';

const read = (p) => readFileSync(p, 'utf8');

test('AUDIT 59 F1: the nav worker is spelled the way Vite bundles it - the literal terrainGenClient.js records', () => {
  const client = read('src/ai/navClient.js');
  // the one spelling the bundler turns into a worker chunk; anything
  // else (a ctor in a variable) 404s in production and every bake ran
  // on the main thread
  assert.ok(client.includes("new Worker(new URL('./navWorker.js', import.meta.url), { type: 'module' })"),
    'the real worker takes the literal spelling');
  // the same rule the terrain worker is pinned to, so the two cannot
  // drift apart
  assert.ok(read('src/world/terrainGenClient.js').includes("new Worker(new URL('./terrainGenWorker.js', import.meta.url), { type: 'module' })"));
  // a test double still comes in through WorkerCtor, and does NOT carry
  // a second `new URL(...)` for Vite to emit as a stray asset
  assert.match(client, /WorkerCtor === globalThis\.Worker\s*\n\s*\? new Worker\(new URL\('\.\/navWorker\.js', import\.meta\.url\), \{ type: 'module' \}\)\s*\n\s*: new WorkerCtor\('\.\/navWorker\.js', \{ type: 'module' \}\);/);
  assert.equal((client.match(/new URL\('\.\/navWorker\.js', import\.meta\.url\)/g) ?? []).length, 1, 'exactly one URL for the bundler');
});

test('AUDIT 59 F1: a worker double is constructed through WorkerCtor and the bake goes to it', async () => {
  const { NavClient } = await import('../src/ai/navClient.js');
  const made = [];
  class FakeWorker {
    constructor(url, opts) { made.push([url, opts]); this.onmessage = null; this.onerror = null; }
    postMessage(m) { this.posted = m; setTimeout(() => this.onmessage?.({ data: { t: 'error', id: m.id, message: 'double' } }), 0); }
    terminate() { this.terminated = true; }
  }
  const client = new NavClient({ store: null, WorkerCtor: FakeWorker });
  assert.deepEqual(made, [['./navWorker.js', { type: 'module' }]], 'the double is built, with the module option');
  assert.ok(client._worker instanceof FakeWorker);
  client.dispose();
  assert.equal(client._worker, null, 'dispose drops it');
  assert.ok(made.length === 1);
});

test('AUDIT 59 F2: the dungeon context disposes its nav client on destroy, first thing after the dead latch', () => {
  const src = read('src/scenes/dungeonContext.js');
  const at = src.indexOf('    destroy() {');
  assert.ok(at > 0);
  const body = src.slice(at, at + 3000);
  const latch = body.indexOf('_ctxDead = true;');
  const dispose = body.indexOf('enhancedNav.client?.dispose();');
  assert.ok(latch > 0 && dispose > latch, 'the worker leaves with the context, after NT1\'s latch');
  // ...and OUTSIDE the 500-char window two older pins read after the
  // latch (automap A1, PX21c) - the dispose sits with the foe frees
  assert.ok(dispose > 500, 'below the latch window the teardown pins watch');
  assert.ok(dispose < body.indexOf('renderer.destroyBatch(b)'), 'before the batch frees');
  assert.ok(body.includes('enhancedNav.client = null;'), 'and the handle is dropped');
  // one client per context, built once when the switch is on
  assert.equal((src.match(/new NavClient\(\)/g) ?? []).length, 1);
});

test('AUDIT 59 F3: the Enhanced tab row says what ships - dungeons, the motor live, effect on the next dungeon', () => {
  const menu = read('src/ui/enhancedMenu.js');
  const at = menu.indexOf("prefRow('enhancedAI'");
  // the row is one string built by `+` across lines - read it joined
  const row = menu.slice(at, menu.indexOf('));', at)).replace(/'\s*\n\s*\+\s*'/g, '');
  assert.ok(!/not yet driving/.test(row), 'the "not yet" clause died with ENHANCED AI 4');
  assert.ok(!/each dungeon, town and interior/.test(row), 'no promise of hosts the arc has not reached');
  assert.match(row, /Dungeons for now/);
  assert.match(row, /Takes effect on the next dungeon you enter/, 'a foe keeps the motor it was born with');
  assert.match(row, /Off keeps the 1:1 classic motor/);
});

test('AUDIT 59 F4: the route\'s vertical is never steered at, whatever y findPath answers', () => {
  // the premise the adaptation was written on (a colliderless chf ->
  // y = 0) was wrong; the law it produced still holds and is what
  // matters: a corner takes the foe’s y, the goal takes the goal’s
  const collider = { move() {}, raycast() { return Infinity; }, penetrationAt() { return 0; }, heightAt() { return 0; } };
  const foe = new EnhancedEnemyAI(collider, [0, 7, 0], 0, { nav: () => ({}), navWorld: makeNavWorld() });
  foe.path = [[0, -3, 0], [5, -3, 0], [10, 42, 0]];   // a route whose y is the phantom floor, then nonsense
  foe.pathI = 1;
  foe.avoidObstaclesTimer = 0;
  foe.stopDistance = 2.25;
  foe.predictedTargetPos = [10, 7.5, 0];
  foe._getDestination([10, 7.5, 0]);
  assert.equal(foe.destination[1], 7, 'a corner: the foe\'s own y, not the route\'s');
  foe.feet = [9, 7, 0]; foe.lastX = 9;
  foe.pathI = 2;
  foe._getDestination([10, 7.5, 0]);
  assert.equal(foe.destination[1], 7.5, 'the goal: the predicted target\'s y, not the route\'s');
  const motor = read('src/ai/enhancedMotor.js');
  assert.ok(!/The port's live chf never\s*\n\/\/ does/.test(motor), 'the stale premise is gone from the comment');
  assert.match(motor, /AUDIT 59 F4 corrected the premise/);
});
