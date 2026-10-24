// AUDIT SOUNDSCAPE (2026-10-24, the owner: "Audit this and ensure its perfect"; bible/08-Audio/Audio.md SOUNDSCAPE,
// bible/01-Overview/audits/Audit-Soundscape.md): THE SOUNDS THE PORT MAKES, MADE AND LOADED - the two modules the audit
// made out of the first cut's three loaders. soundJobs.js: a job's samples (a bed, a town's murmur and its tavern);
// made OFF THE MAIN THREAD by a module worker spelled the way Vite bundles one (W4, S5), one at a time, registered the
// next frame and let go; where no worker can be had in the page's idle time, and where there is none of that either at
// once; a maker that throws given up, never asked again; a worker that fails hands its beds back to the main thread and
// its town jobs back to their driver (their voices went with it). soundWorker.js: a message answered with the job's
// samples, handed over, or its error. clipInstall.js (S7, H2, H6): a first load that failed asked again on a backoff,
// then given up; a file the server refuses never asked for again; the bytes kept until the bus takes them; asked every
// frame with nothing to do, it makes nothing.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runJob, ensureMade, ensureBed, soundWorker, _resetMade } from '../../../src/systems/soundscape/soundJobs.js';
import { SOUND_BEDS, bedSamples, bedOf } from '../../../src/systems/soundscape/soundBeds.js';
import { murmurSamples, tavernSamples, TOWN_BED_RATE } from '../../../src/systems/soundscape/townBeds.js';
import { createClipInstaller, CLIP_RETRY_MS } from '../../../src/systems/soundscape/clipInstall.js';

const voices = () => Array.from({ length: 4 }, (_, v) => Float32Array.from({ length: 3000 }, (_, k) => Math.sin(k * (0.05 + v * 0.01)) * 0.3));
const rms = (x) => Math.sqrt(x.reduce((a, v) => a + v * v, 0) / x.length);
/** An engine that records what it is handed. */
const engineOf = (take = () => true) => {
  const registered = [];
  return { registered, registerSamples: (key, samples, rate) => { const ok = take(key); if (ok) registered.push([key, samples.length, rate]); return ok; } };
};
/** A worker double, made through soundWorker's own door (its handlers its own): what is posted, and a hand to answer
 *  it. `worker` the option ensureMade takes. */
function fakeWorker() {
  _resetMade();
  const posted = [];
  function Fake() { this.postMessage = (msg, transfer) => { posted.push({ msg, transfer }); }; }
  const w = soundWorker(Fake);
  w.posted = posted;
  w.answer = (i = 0) => { const { msg } = posted[i]; w.onmessage({ data: { id: msg.id, samples: runJob(msg.job) } }); };
  w.worker = () => soundWorker(Fake);
  return w;
}

test('AUDIT SOUNDSCAPE THE JOBS: a bed\'s samples are the bed\'s own; a town\'s murmur and its tavern made of the people\'s voices at the arena\'s rate, the tavern darker and levelled under the murmur; a job with nothing to make it of, or of no kind, none (mutants: a job\'s kinds crossed; the tavern unlevelled)', () => {
  assert.deepEqual(runJob({ kind: 'bed', key: 'shore:lap' }), bedSamples(SOUND_BEDS['shore:lap']));
  assert.equal(runJob({ kind: 'bed', key: 'nope' }), null);
  const v = voices();
  const m = runJob({ kind: 'murmur', voices: v }), t = runJob({ kind: 'tavern', voices: v });
  assert.deepEqual(m, murmurSamples(v));
  assert.deepEqual(t, tavernSamples(v));
  assert.equal(TOWN_BED_RATE, 22050);
  assert.ok(Math.abs(rms(t) - 0.06) < 1e-3, `the tavern levelled: ${rms(t)}`);
  assert.notDeepEqual(m.subarray(0, 256), t.subarray(0, 256), 'two crowds, not one');
  for (const j of [{ kind: 'murmur', voices: [] }, { kind: 'tavern' }, { kind: 'x' }, null]) assert.equal(runJob(j), null);
});

test('AUDIT SOUNDSCAPE OFF THE MAIN THREAD: a job posted to the worker (a town\'s voices handed over, not copied), one at a time, answered false until its samples come back; registered on the next ask under its key at its rate; a second engine asks its own; a page with no worker makes it in idle time, with neither at once; a maker that throws given up for the session; nothing to make it of yet, asked again (mutants: two at once; made inside the frame with a worker there; the thrower asked again; the transfer dropped)', () => {
  const w = fakeWorker();
  const { worker } = w;
  const e = engineOf();
  assert.equal(ensureBed(e, 'sea:swell', { worker }), false, 'posted, not made');
  assert.equal(ensureBed(e, 'sea:wash', { worker }), false, 'and one at a time');
  assert.equal(w.posted.length, 1);
  assert.deepEqual(w.posted[0].msg.job, { kind: 'bed', key: 'sea:swell' });
  assert.deepEqual(e.registered, [], 'nothing inside the frame');
  w.answer(0);
  assert.equal(ensureBed(e, 'sea:swell', { worker }), true);
  assert.deepEqual(e.registered, [['sea:swell', 12 * 11025, 11025]]);
  assert.equal(ensureBed(e, 'sea:swell', { worker }), true, 'held: asked no more');
  assert.equal(w.posted.length, 1);
  // a town's job hands its voices over
  const v = voices();
  assert.equal(ensureMade(e, 'town:murmur', () => ({ kind: 'murmur', voices: v }), TOWN_BED_RATE, { worker }), false);
  assert.deepEqual(w.posted[1].transfer, v.map((x) => x.buffer), 'the voices transferred');
  _resetMade();
  // no worker: idle time, one at a time
  const queue = [];
  const idle = (fn, o) => { queue.push([fn, o]); };
  const e2 = engineOf();
  assert.equal(ensureBed(e2, 'shore:lap', { worker: null, idle }), false);
  assert.equal(ensureBed(e2, 'sea:wash', { worker: null, idle }), false);
  assert.equal(queue.length, 1);
  assert.deepEqual(queue[0][1], { timeout: 1000 });
  queue.shift()[0]();
  assert.equal(ensureBed(e2, 'shore:lap', { worker: null, idle }), true);
  _resetMade();
  assert.equal(ensureBed(e2, 'shore:lap', { worker: null, idle: null }), true, 'neither: made at once');
  assert.equal(ensureBed(engineOf(), 'shore:lap', { worker: null, idle: null }), true, 'another engine, its own');
  // nothing to make it of yet; a maker that throws
  let asks = 0;
  assert.equal(ensureMade(e2, 'x:y', () => (asks++, null), 22050, { worker: null, idle: null }), false);
  assert.equal(ensureMade(e2, 'x:y', () => (asks++, { kind: 'bed', key: 'shore:lap' }), 22050, { worker: null, idle: null }), true, 'asked again, made');
  assert.equal(asks, 2);
  const warn = console.warn;
  console.warn = () => {};
  try {
    let tries = 0;
    const thrower = () => (tries++, { kind: 'murmur', get voices() { throw new Error('no'); } });
    for (let k = 0; k < 5; k++) assert.equal(ensureMade(e2, 'x:z', thrower, 22050, { worker: null, idle: null }), false);
    assert.equal(tries, 1, 'given up: never asked again');
  } finally { console.warn = warn; }
  assert.equal(ensureBed({}, 'sea:swell', { worker: null, idle: null }), false, 'no engine to register on');
  assert.equal(ensureBed(e2, 'nope', { worker: null, idle: null }), false, 'no such bed');
  assert.equal(bedOf('sea:rigging'), bedOf('sea:rigging'), 'bedOf: made once');
  _resetMade();
});

test('AUDIT SOUNDSCAPE A WORKER THAT FAILS: its beds made on the main thread, its town jobs handed back to their driver (their voices went with it) and asked again; a worker that answers with an error gives the job up; a register refused (no context yet) asked again with the samples kept (mutants: the town job rerun on voices gone; the error ignored; the samples dropped before they stand)', () => {
  const w = fakeWorker();
  const { worker } = w;
  const e = engineOf();
  ensureBed(e, 'shore:lap', { worker });
  w.onerror();
  assert.equal(ensureBed(e, 'shore:lap', { worker: null, idle: null }), true, 'the bed made here instead');
  const w2 = fakeWorker();
  let jobs = 0;
  const town = () => (jobs++, { kind: 'tavern', voices: voices() });
  ensureMade(e, 'town:tavern', town, TOWN_BED_RATE, { worker: w2.worker });
  w2.posted[0].msg.job.voices.forEach((v) => v.fill(0));   // stands for the voices gone with the transfer
  w2.onerror();
  assert.equal(ensureMade(e, 'town:tavern', town, TOWN_BED_RATE, { worker: null, idle: null }), true, 'asked again of its driver');
  assert.equal(jobs, 2, 'with fresh voices');
  const w3 = fakeWorker();
  const warn = console.warn;
  console.warn = () => {};
  try {
    ensureBed(e, 'sea:wash', { worker: w3.worker });
    w3.onmessage({ data: { id: w3.posted[0].msg.id, samples: null, error: 'boom' } });
    assert.equal(ensureBed(e, 'sea:wash', { worker: w3.worker }), false);
    assert.equal(w3.posted.length, 1, 'given up');
  } finally { console.warn = warn; }
  _resetMade();
  let take = false;
  const shy = engineOf(() => take);
  assert.equal(ensureBed(shy, 'shore:lap', { worker: null, idle: null }), false, 'no context to register on yet');
  take = true;
  assert.equal(ensureBed(shy, 'shore:lap', { worker: () => { throw new Error('not asked'); }, idle: null }), true, 'the samples kept, registered now');
  _resetMade();
});

test('AUDIT SOUNDSCAPE THE WORKER ITSELF: spelled the way Vite bundles a module worker (new Worker(new URL(...)), never through a variable - the nav and the terrain workers\' rule, AUDIT 59 F1), a double built with the module option; its message answered with the job\'s samples handed over, or its error (mutants: the spelling; the transfer; the error unanswered)', async () => {
  const S = readFileSync(new URL('../../../src/systems/soundscape/soundJobs.js', import.meta.url), 'utf8');
  assert.ok(S.includes("? new Worker(new URL('./soundWorker.js', import.meta.url), { type: 'module' })"));
  _resetMade();
  const built = [];
  function Double(url, o) { built.push([url, o]); this.postMessage = () => {}; }
  assert.ok(soundWorker(Double) instanceof Double);
  assert.deepEqual(built, [['./soundWorker.js', { type: 'module' }]]);
  assert.equal(soundWorker(Double), soundWorker(Double), 'made once');
  _resetMade();
  assert.equal(soundWorker(undefined), null, 'none to be had');
  _resetMade();
  const sent = [];
  const was = { onmessage: globalThis.onmessage, postMessage: globalThis.postMessage };
  globalThis.postMessage = (msg, transfer) => { sent.push({ msg, transfer }); };
  try {
    await import('../../../src/systems/soundscape/soundWorker.js');
    globalThis.onmessage({ data: { id: 7, job: { kind: 'bed', key: 'shore:lap' } } });
    assert.equal(sent[0].msg.id, 7);
    assert.deepEqual(sent[0].msg.samples, bedSamples(SOUND_BEDS['shore:lap']));
    assert.deepEqual(sent[0].transfer, [sent[0].msg.samples.buffer], 'handed over');
    globalThis.onmessage({ data: { id: 8, job: { kind: 'tavern', get voices() { throw new Error('bad job'); } } } });
    assert.deepEqual(sent[1].msg, { id: 8, samples: null, error: 'bad job' });
  } finally { globalThis.onmessage = was.onmessage; globalThis.postMessage = was.postMessage; }
});

test('AUDIT SOUNDSCAPE THE CLIPS\' LOADER: every clip fetched and registered; a pass that left any asked again after CLIP_RETRY_MS in turn, then given up; a file the server refuses (4xx) never asked for again; a clip\'s bytes fetched once and kept until the bus takes them; asked with nothing due it answers the last count and makes nothing (mutants: never retried; retried for ever; the refusal asked again; the bytes fetched every pass; a pass made every frame)', async () => {
  assert.deepEqual([...CLIP_RETRY_MS], [2000, 8000, 30000, 120000]);
  let t = 0, fetched = [], take = new Set(['a']);
  const fetchBytes = async (file) => {
    fetched.push(file);
    if (file === 'gone.wav') throw Object.assign(new Error('404'), { status: 404 });
    if (file === 'flaky.wav' && t < 2000) throw Object.assign(new Error('offline'), { status: NaN });
    return new Uint8Array(4);
  };
  const L = createClipInstaller({ a: 'a.wav', b: 'b.wav', flaky: 'flaky.wav', gone: 'gone.wav' }, { fetchBytes, now: () => t });
  const audio = { registerSound: async (key) => take.has(key) };
  assert.equal(await L.install(audio), 1, 'a in; b not taken; flaky offline; gone refused');
  assert.deepEqual(fetched.sort(), ['a.wav', 'b.wav', 'flaky.wav', 'gone.wav']);
  const idle = L.install(audio);
  assert.equal(L.install(audio), idle, 'nothing due: the same answer, nothing made');
  assert.equal(await idle, 1);
  t = 1999;
  assert.equal(await L.install(audio), 1, 'not yet');
  assert.equal(fetched.length, 4);
  t = 2000; take = new Set(['a', 'b', 'flaky']);
  assert.equal(await L.install(audio), 3);
  assert.deepEqual(fetched.sort(), ['a.wav', 'b.wav', 'flaky.wav', 'flaky.wav', 'gone.wav'], 'b\'s bytes kept, never fetched again; gone never asked again');
  assert.ok(L.has('b') && L.has('flaky') && !L.has('gone'));
  assert.equal(L.count, 3);
  // a loader that never gets its clips gives up after the last gap
  let asks = 0;
  const never = createClipInstaller({ x: 'x.wav' }, { fetchBytes: async () => { asks++; throw new Error('offline'); }, now: () => t });
  for (const gap of [0, ...CLIP_RETRY_MS]) { t += gap; await never.install(audio); }
  assert.equal(asks, 1 + CLIP_RETRY_MS.length);
  t += 1e9;
  await never.install(audio);
  assert.equal(asks, 1 + CLIP_RETRY_MS.length, 'given up');
  assert.equal(await createClipInstaller({ x: 'x.wav' }, { fetchBytes }).install({}), 0, 'no bus to register on: nothing asked');
});
