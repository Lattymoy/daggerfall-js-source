// @ts-check
// AUDIT SOUNDSCAPE W4 (2026-10-24): THE SOUNDSCAPE'S WORKER - the beds the port makes, made off the main thread. A bed is
// 15 to 50 ms of work warm and 70 to 170 ms cold (measured on the player's own DAGGER.SND people), and made on the main
// thread - in an idle callback or not - it was that long a stall the moment a deck was boarded, a shore neared or a
// town's gate passed. A message `{ id, job }` (soundJobs.js runJob's job) is answered `{ id, samples }` - the samples
// handed over, not copied - or `{ id, error }`.
import { runJob } from './soundJobs.js';

globalThis.onmessage = (/** @type {MessageEvent} */ e) => {
  const { id, job } = e.data ?? {};
  try {
    const samples = runJob(job);
    /** @type {any} */ (globalThis).postMessage({ id, samples }, samples ? [samples.buffer] : []);
  } catch (err) {
    /** @type {any} */ (globalThis).postMessage({ id, samples: null, error: String(/** @type {any} */ (err)?.message ?? err) });
  }
};
