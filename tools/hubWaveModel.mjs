// AUDIT SCALE5a D10 (2026-10-10): THE HUB'S RECONNECT WAVE, MODELLED - how many hellos the hub's gate refuses busy when a
// relay deploy drops N players at once, and how long they wait to be welcomed. Before SCALE5a each busy refusal was one
// more token mint (a dozen reads against the account database); since, none is. A MODEL, not a measurement: the
// client's own retry ladder (net/online.js `_scheduleRetry` and its busy floor) against the hub's own gate (net/wire.js
// `tokenGate` at CHAT_HELLO_HZ_MAX, burst the same), with these assumptions said out loud -
//   - every socket drops at the same instant, and a hello arrives at its retry's instant (no connect, no mint time);
//   - round one is the drop's retry, uniform over [BACKOFF_MIN_MS, 2 x BACKOFF_MIN_MS); a busy refusal raises the backoff
//     to BACKOFF_MAX_MS / 2 and retries over its span, doubling to BACKOFF_MAX_MS, as the session does;
//   - the hub admits nothing else meanwhile, and refuses for nothing but its gate (never 'room full').
//
//   node tools/hubWaveModel.mjs                 players 500, 1000 and 2000, twenty seeds each
//   N=500 SEEDS=50 node tools/hubWaveModel.mjs
import { tokenGate, CHAT_HELLO_HZ_MAX } from '../src/net/wire.js';
import { BACKOFF_MIN_MS, BACKOFF_MAX_MS } from '../src/net/online.js';
import { isMain } from './lib/isMain.mjs';

const PLAYERS = (process.env.N || '500,1000,2000').split(',').map(Number);
const SEEDS = Number(process.env.SEEDS || 20);

/** A seeded roll (mulberry32), so a run is the same run. */
function roll(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** One wave: N players dropped at 0. Answers the busy refusals and each player's welcome time (ms). */
export function wave(n, seed) {
  const rand = roll(seed);
  const at = [], backoff = [];
  for (let i = 0; i < n; i++) {   // the drop's own retry (`_scheduleRetry` with the backoff at its floor)
    at.push(BACKOFF_MIN_MS + rand() * BACKOFF_MIN_MS);
    backoff.push(Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2));
  }
  let bucket = null, refused = 0;
  const welcomed = [];
  const queue = at.map((t, i) => [t, i]);
  while (queue.length) {
    queue.sort((x, y) => x[0] - y[0]);
    const [t, i] = queue.shift();
    const gate = tokenGate(bucket, t, CHAT_HELLO_HZ_MAX);
    bucket = gate.bucket;
    if (gate.pass) { welcomed.push(t); continue; }
    refused++;
    backoff[i] = Math.max(backoff[i], BACKOFF_MAX_MS / 2);   // a busy close: back off hard
    const span = Math.max(BACKOFF_MIN_MS, backoff[i] - BACKOFF_MIN_MS);
    queue.push([t + BACKOFF_MIN_MS + rand() * span, i]);
    backoff[i] = Math.min(BACKOFF_MAX_MS, backoff[i] * 2);
  }
  welcomed.sort((x, y) => x - y);
  return { refused, median: welcomed[Math.floor(n / 2)], p90: welcomed[Math.floor(n * 0.9)], last: welcomed[n - 1] };
}

const mid = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
if (isMain(import.meta.url)) {
  process.stdout.write('players   busy refusals (min / median / max of seeds)   welcomed, s (median / p90 / last, median seed)\n');
  for (const n of PLAYERS) {
    const runs = Array.from({ length: SEEDS }, (_, s) => wave(n, s + 1));
    const r = runs.map((x) => x.refused).sort((a, b) => a - b);
    const s = (k) => (mid(runs.map((x) => x[k])) / 1000).toFixed(1);
    process.stdout.write(`${String(n).padStart(7)}   ${`${r[0]} / ${mid(r)} / ${r[r.length - 1]}`.padStart(40)}   ${`${s('median')} / ${s('p90')} / ${s('last')}`.padStart(35)}\n`);
  }
}
