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
//   SPREAD=1 node tools/hubWaveModel.mjs        SCALE2c: each page first waits its one offset in the wave's spread
//   N=256 RATE=10 ARRIVE_S=5 node tools/hubWaveModel.mjs   GATE-DOOR: a crowd walking into a room whose door is RATE
//
// GATE-DOOR (2026-10-18; AUDIT PLAN-1000 B5, its figures re-run here): RATE is the door's hellos a second (burst the same;
// CHAT_HELLO_HZ_MAX unless said - a gate's court is net/wire.js GATE_HELLO_HZ_MAX, every other room HELLO_HZ_MAX), and
// ARRIVE_S, when set, puts each player's first hello uniform over that many seconds - a crowd arriving, not a drop - with
// the same busy ladder after it. The refusals are said as the seeds' min / median / mean / max.
//
// SCALE2c (2026-10-10): it also counts the MINTS - a page's first hello after the drop is its one mint (its sockets
// share it, TOKEN_REUSE_MS) - and says the busiest second's, the figure the account database feels. With SPREAD=1 the
// drop's retry waits for the page's slot (net/reconnectWave.js: uniform over waveSpreadMs(n)), as a page that sees the
// wave does; the busy ladder after it is unchanged.
import { tokenGate, CHAT_HELLO_HZ_MAX } from '../src/net/wire.js';
import { BACKOFF_MIN_MS, BACKOFF_MAX_MS } from '../src/net/online.js';
import { waveSpreadMs } from '../src/net/reconnectWave.js';
import { isMain } from './lib/isMain.mjs';

const PLAYERS = (process.env.N || '500,1000,2000').split(',').map(Number);
const SEEDS = Number(process.env.SEEDS || 20);
const SPREAD = process.env.SPREAD === '1';
const RATE = Number(process.env.RATE || CHAT_HELLO_HZ_MAX);
const ARRIVE_S = Number(process.env.ARRIVE_S || 0);

/** A seeded roll (mulberry32), so a run is the same run. */
function roll(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** One wave: N players dropped at 0. Answers the busy refusals, each player's welcome time (ms), and the mints of the
 *  busiest second (each page's first hello). `spread`: SCALE2c's page slot before the drop's retry; `rate`: the door's
 *  hellos a second; `arriveS`: each first hello uniform over that many seconds instead of the drop's retry (GATE-DOOR). */
export function wave(n, seed, { spread = false, rate = CHAT_HELLO_HZ_MAX, arriveS = 0 } = {}) {
  const rand = roll(seed);
  const at = [], backoff = [];
  const window = spread ? waveSpreadMs(n) : 0;
  for (let i = 0; i < n; i++) {   // the drop's own retry (`_scheduleRetry` with the backoff at its floor), held to the page's slot
    const retry = arriveS > 0 ? rand() * arriveS * 1000 : BACKOFF_MIN_MS + rand() * BACKOFF_MIN_MS;
    at.push(window ? Math.max(retry, rand() * window) : retry);
    backoff.push(Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2));
  }
  const mintsBySecond = new Map();
  for (const t of at) { const s = Math.floor(t / 1000); mintsBySecond.set(s, (mintsBySecond.get(s) ?? 0) + 1); }
  const mintPeak = Math.max(...mintsBySecond.values());
  let bucket = null, refused = 0;
  const welcomed = [];
  const queue = at.map((t, i) => [t, i]);
  while (queue.length) {
    queue.sort((x, y) => x[0] - y[0]);
    const [t, i] = queue.shift();
    const gate = tokenGate(bucket, t, rate);
    bucket = gate.bucket;
    if (gate.pass) { welcomed.push(t); continue; }
    refused++;
    backoff[i] = Math.max(backoff[i], BACKOFF_MAX_MS / 2);   // a busy close: back off hard
    const span = Math.max(BACKOFF_MIN_MS, backoff[i] - BACKOFF_MIN_MS);
    queue.push([t + BACKOFF_MIN_MS + rand() * span, i]);
    backoff[i] = Math.min(BACKOFF_MAX_MS, backoff[i] * 2);
  }
  welcomed.sort((x, y) => x - y);
  return { refused, median: welcomed[Math.floor(n / 2)], p90: welcomed[Math.floor(n * 0.9)], last: welcomed[n - 1], mintPeak };
}

const mid = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
if (isMain(import.meta.url)) {
  process.stdout.write(`${SPREAD ? '(each page waits its slot in the spread - SCALE2c)' : ARRIVE_S > 0 ? `(each player arrives within ${ARRIVE_S} s - GATE-DOOR)` : '(every page retries at once)'}, the door ${RATE} a second\n`);
  process.stdout.write('players   busy refusals (min / median / mean / max of seeds)   welcomed, s (median / p90 / last, median seed)   mints in the busiest second\n');
  for (const n of PLAYERS) {
    const runs = Array.from({ length: SEEDS }, (_, s) => wave(n, s + 1, { spread: SPREAD, rate: RATE, arriveS: ARRIVE_S }));
    const r = runs.map((x) => x.refused).sort((a, b) => a - b);
    const mean = (r.reduce((a, b) => a + b, 0) / r.length).toFixed(1);
    const s = (k) => (mid(runs.map((x) => x[k])) / 1000).toFixed(1);
    process.stdout.write(`${String(n).padStart(7)}   ${`${r[0]} / ${mid(r)} / ${mean} / ${r[r.length - 1]}`.padStart(47)}   ${`${s('median')} / ${s('p90')} / ${s('last')}`.padStart(35)}   ${String(mid(runs.map((x) => x.mintPeak))).padStart(27)}\n`);
  }
}
