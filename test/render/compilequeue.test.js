// COMPILE-QUEUE (FIELD BUGS 2026-10-27b, the desktop app: "hitch 13064 ms" shortly after login): the boot's idle started
// every program play meets at once, and the next build that read a link waited until the driver's few compile threads
// had done them all. render/glProgram.js startProgramsInTurn starts them one at a time; a door's ask moves a pair to the
// front, a build takes it out of turn, and a pair taken or let go is never started (bible/07-Rendering/
// Performance-Priority.md COMPILE-QUEUE).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startPrograms, startProgramsInTurn, buildProgram, releasePrograms } from '../../src/render/glProgram.js';

/** A context whose driver finishes a program when the test says (`finish`, one or all). Its program reads throw on a
 *  null program, as WebGL's do; once lost, every read answers null. `made()` the fragment sources in the order their
 *  programs were made; `count(name)` the calls - `link?` the LINK_STATUS read. */
function fakeGl({ parallel = true } = {}) {
  let lost = false;
  const log = [], progs = [], done = new Set(), sources = new Map(), attached = new Map();
  const ext = parallel ? { COMPLETION_STATUS_KHR: 0x91B1 } : null;
  const base = { VERTEX_SHADER: 0x8B31, FRAGMENT_SHADER: 0x8B30, COMPILE_STATUS: 0x8B81, LINK_STATUS: 0x8B82 };
  const gl = new Proxy(base, {
    get(t, k) {
      if (typeof k !== 'string') return undefined;
      if (k in t) return t[k];
      switch (k) {
        case 'getExtension': return (n) => (n === 'KHR_parallel_shader_compile' ? ext : null);
        case 'isContextLost': return () => lost;
        case 'createProgram': return () => { const p = { id: progs.length }; progs.push(p); attached.set(p, []); log.push(['createProgram']); return p; };
        case 'createShader': return () => ({ shader: true });
        case 'shaderSource': return (s, src) => { sources.set(s, src); };
        case 'attachShader': return (p, s) => { attached.get(p).push(s); };
        case 'getProgramParameter': return (p, pn) => {
          if (!p) throw new TypeError('parameter 1 is not of type \'WebGLProgram\'');
          if (lost) return null;
          if (pn === base.LINK_STATUS) { log.push(['link?']); return true; }
          if (ext && pn === ext.COMPLETION_STATUS_KHR) return done.has(p);
          return null;
        };
        default: return (...a) => { log.push([k, ...a]); };
      }
    },
  });
  const fsOf = (p) => sources.get(attached.get(p)[1]);
  return {
    gl, progs,
    finish: (p) => { for (const q of p ? [p] : progs) done.add(q); },
    lose: () => { lost = true; },
    made: () => progs.map(fsOf),
    open: () => progs.filter((p) => !done.has(p)).length,
    count: (name) => log.filter((x) => x[0] === name).length,
  };
}

const PAIRS = [['va', 'A'], ['vb', 'B'], ['vc', 'C'], ['vd', 'D']];
/** The queue's wait, held by the test: `turns` the queue's pending waits, `turn()` lets the oldest go. */
function turner() {
  const turns = [];
  const turn = async () => { turns.shift()?.(); await new Promise((r) => setImmediate(r)); };
  return { turns, wait: () => new Promise((r) => turns.push(r)), turn };
}

test('COMPILE-QUEUE one at a time: the first started at once, the next only once the driver says the last is done - never two compiling - and the queue ends with the last (mutants: started without waiting their turn)', async () => {
  const f = fakeGl(), q = turner();
  let ended = false;
  const queue = startProgramsInTurn(f.gl, PAIRS, q.wait).then(() => { ended = true; });
  assert.deepEqual(f.made(), ['A'], 'one started');
  await q.turn();
  assert.deepEqual(f.made(), ['A'], 'still compiling: asked again, nothing more started');
  for (const want of [['A', 'B'], ['A', 'B', 'C'], ['A', 'B', 'C', 'D']]) {
    f.finish();
    await q.turn();
    assert.deepEqual(f.made(), want);
    assert.equal(f.open(), 1, 'never two compiling');
  }
  assert.equal(ended, false);
  f.finish();
  await q.turn();
  await queue;
  assert.equal(ended, true, 'the queue ends with the last');
  assert.equal(q.turns.length, 0);
  assert.equal(f.count('link?'), 0, 'nothing read that waits');
});

test('COMPILE-QUEUE a door that asks for a queued pair moves it to the front - never started beside the queue - and its ready() says not yet without a read on a program not made (mutants: the ask ignored; started out of turn; a null program read)', async () => {
  const f = fakeGl(), q = turner();
  const queue = startProgramsInTurn(f.gl, PAIRS, q.wait);
  const ready = startPrograms(f.gl, [PAIRS[3]]);
  assert.deepEqual(f.made(), ['A'], 'the ask started nothing');
  assert.equal(ready(), false, 'queued: not yet');
  f.finish();
  await q.turn();
  assert.deepEqual(f.made(), ['A', 'D'], 'the asked pair next');
  assert.equal(ready(), false, 'compiling');
  f.finish();
  assert.equal(ready(), true);
  for (let i = 0; i < 4; i++) { f.finish(); await q.turn(); }
  await queue;
  assert.deepEqual(f.made(), ['A', 'D', 'B', 'C'], 'the rest in order, each once');
});

test('COMPILE-QUEUE a build that wants a queued pair compiles it then, out of its turn, and the queue never starts it again (mutants: the queued pair taken as a program; a taken pair started again)', async () => {
  const f = fakeGl(), q = turner();
  const queue = startProgramsInTurn(f.gl, PAIRS, q.wait);
  const prog = buildProgram(f.gl, 'vc', 'C', 'c');
  assert.ok(prog);
  assert.deepEqual(f.made(), ['A', 'C'], 'made at once');
  assert.equal(f.count('link?'), 1, 'its one read');
  for (let i = 0; i < 4; i++) { f.finish(); await q.turn(); }
  await queue;
  assert.deepEqual(f.made(), ['A', 'C', 'B', 'D'], 'C never started by the queue');
});

test('COMPILE-QUEUE a queued pair let go (a pass whose build threw) frees nothing and is never started (mutants: a queued pair freed as a program)', async () => {
  const f = fakeGl(), q = turner();
  const queue = startProgramsInTurn(f.gl, PAIRS.slice(0, 2), q.wait);
  releasePrograms(f.gl, [PAIRS[1]]);
  assert.equal(f.count('deleteShader') + f.count('deleteProgram'), 0, 'nothing to free');
  f.finish();
  await q.turn();
  await queue;
  assert.deepEqual(f.made(), ['A'], 'its turn dropped');
});

test('COMPILE-QUEUE the pair in its turn taken by a build before the driver is done ends its turn - the queue moves on, never waiting on a program it no longer holds (mutants: the turn waits on a taken program)', async () => {
  const f = fakeGl(), q = turner();
  const queue = startProgramsInTurn(f.gl, PAIRS.slice(0, 2), q.wait);
  buildProgram(f.gl, 'va', 'A', 'a');
  assert.deepEqual(f.made(), ['A'], 'the started program taken, no second compile');
  await q.turn();
  assert.deepEqual(f.made(), ['A', 'B'], 'B next, A never reported done');
  f.finish();
  await q.turn();
  await queue;
});

test('COMPILE-QUEUE a lost context ends the queue (mutants: the turn blind to the loss)', async () => {
  const f = fakeGl(), q = turner();
  let ended = false;
  const queue = startProgramsInTurn(f.gl, PAIRS, q.wait).then(() => { ended = true; });
  f.lose();
  await q.turn();
  assert.equal(ended, true, 'ended at the next turn');
  assert.deepEqual(f.made(), ['A'], 'nothing more started');
  assert.equal(q.turns.length, 0, 'no wait left pending');
  await queue;
});

test('COMPILE-QUEUE a queue that ends early - its wait failed - strands no pair: a door asking for one it never reached starts it then and is answered when it is done (mutants: the queued pairs left behind)', async () => {
  const f = fakeGl();
  await assert.rejects(startProgramsInTurn(f.gl, PAIRS, () => Promise.reject(new Error('no idle'))), /no idle/);
  assert.deepEqual(f.made(), ['A']);
  const ready = startPrograms(f.gl, [PAIRS[2]]);
  assert.deepEqual(f.made(), ['A', 'C'], 'started at the ask');
  assert.equal(ready(), false);
  f.finish();
  assert.equal(ready(), true);
});

test('COMPILE-QUEUE without KHR_parallel_shader_compile nothing is queued: a door starts its pair at once and is answered done, a build compiles as it always did', async () => {
  const f = fakeGl({ parallel: false }), q = turner();
  await startProgramsInTurn(f.gl, PAIRS, q.wait);
  assert.deepEqual(f.made(), [], 'nothing queued, nothing started');
  assert.equal(q.turns.length, 0);
  const ready = startPrograms(f.gl, [PAIRS[0]]);
  assert.deepEqual(f.made(), ['A']);
  assert.equal(ready(), true, 'answered done at once - its build waits as before');
  buildProgram(f.gl, 'va', 'A', 'a');
  assert.deepEqual(f.made(), ['A'], 'the build takes the started program');
});
