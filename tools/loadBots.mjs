// ═══════════════════════════════════════════════════════════════════
// SCALE3 (2026-09-30, the scaling audit - bible/11-Multiplayer/Scale-Arc.md): THE BOT FLEET.
//
// Every figure the audit gave was arithmetic from the code's constants; nothing had been measured, because nothing
// in this tree could stand up more than one player. This does: N bots, each a guest account with a realm character,
// sign in, mint identity tokens and join relay rooms exactly as a tab does - the cell, a halo, the hub and a region
// channel - then pose and chat at the client's rates.
//
//   npm run load                         both Workers in local workerd, the deploy-storm scenario in both token modes
//   npm run load -- --bots 80 --seconds 20
//   node tools/loadBots.mjs --account https://<staging-account> --relay wss://<staging-relay> --bots 200
//
// THE SCENARIO IS A RELAY DEPLOY: every bot connects its sockets in the same instant, as every tab does when the
// relay drops everyone. It runs twice:
//   per-socket   every socket mints its own token (the client before SCALE2)
//   per-connect  one token for a connect's rooms (SCALE2 accountTokenMinter)
// and says, for each: the mints the account service answered and their latency, the time from the first socket to
// each room's welcome, and every refusal by the relay's own word (a busy room's gate, a token refused).
//
// NEVER AGAINST PRODUCTION. Each run makes N guest accounts and N realm characters that stay in the database, and a
// storm is a storm: point it at local workerd (the default) or a staging pair.
//
// LOCAL NUMBERS ARE NOT PRODUCTION'S. workerd's D1 is SQLite on this disk, one process: no network between the
// Worker and its database, no replicas, no edge. What local runs DO measure is relative - mints per connect, the hello
// gates' refusals, how long a wave takes to settle - and they prove the harness before a staging pair exists.
// ═══════════════════════════════════════════════════════════════════

import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACCEPTED } from '../src/net/legalLaw.js';
import { isMain } from './lib/isMain.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const run = promisify(execFile);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── THE LAW, pure (test/scale3.test.js) ─────────────────────────────

/** The q-quantile of `xs` (nearest rank), or null for none. */
export function quantile(xs, q) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))];
}

/** One scenario's report: its counts and latencies, each latency list as p50/p95/max (ms, rounded). */
export function summarize({ mode, bots, sockets, mints, mintMs, welcomeMs, refusals, unwelcomed }) {
  const dist = (xs) => ({ n: xs.length, p50: round(quantile(xs, 0.5)), p95: round(quantile(xs, 0.95)), max: round(quantile(xs, 1)) });
  return { mode, bots, sockets, mints, mintsPerBot: bots ? +(mints / bots).toFixed(2) : 0, mint: dist(mintMs), welcome: dist(welcomeMs), refusals: { ...refusals }, unwelcomed };
}
const round = (v) => (v == null ? null : Math.round(v));

/** The rooms one bot's connect opens: its cell, one halo cell beside it, the hub and a region channel (net/wire.js).
 *  The cells are real ones - Daggerfall city's (pixel 207,212: cell 12,13) and its neighbours, a town's crowd. */
export const roomsFor = (i, { cells = 4 } = {}) => {
  const x = 12 + (i % cells) * 2, y = 13;
  return [`world:${x},${y}`, `world:${x + 1},${y}`, 'chat:world', `chat:region.${i % 62}`];
};

/** A tab's retry after a busy room or a dropped socket (net/online.js _scheduleRetry, SLAM12): the first uniform over
 *  [1 s, 2 s], each later window doubled to BACKOFF_MAX_MS. */
export function retryAfter(attempt, rand = Math.random) {
  const MIN = 1000, MAX = 8000;
  const backoff = Math.min(MAX, MIN * 2 ** attempt);
  return MIN + rand() * Math.max(MIN, backoff - MIN);
}

/** Parse `--key value` / `--flag` into an object. */
export function argsOf(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2), v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) out[k] = true; else { out[k] = v; i++; }
  }
  return out;
}

// ─── ONE BOT ─────────────────────────────────────────────────────────

async function call(base, path, body, secret = null) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(secret ? { authorization: `Bearer ${secret}` } : {}) },
    body: JSON.stringify(body ?? {}),
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

/** A bot's account: a guest, and a realm character the relay's door admits (REALM-DOOR signs `rc` off it). */
async function seat(account, i) {
  const g = await call(account, '/v1/auth/guest', { label: `loadbot-${i}`, ...ACCEPTED });
  if (g.status !== 200) throw new Error(`guest ${i}: ${g.status} ${JSON.stringify(g.data)}`);
  const r = await call(account, '/v1/realm/create', { name: `Bot ${i}` }, g.data.secret);
  if (r.status !== 200) throw new Error(`realm ${i}: ${r.status} ${JSON.stringify(r.data)}`);
  return { i, secret: g.data.secret, character: r.data.id };
}

/** A token, as the client mints one - and how long the service took. */
async function mint(account, bot, stats) {
  const t0 = performance.now();
  const r = await call(account, '/v1/auth/token', { character: bot.character, guild: true }, bot.secret);
  stats.mints += 1;
  stats.mintMs.push(performance.now() - t0);
  return r.status === 200 && typeof r.data?.token === 'string' ? r.data.token : null;
}

const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
const LOOK = { race: 'Nord', gender: 'male', faceIndex: 0, items: [] };

/**
 * ONE ROOM, until its welcome (or the deadline): a socket, the hello, and the tab's own retry on a busy room or a
 * drop. `tokenFor(room)` answers the hello's token (the mode decides whether it mints). Resolves the ms from `t0` to
 * the welcome, or null.
 */
function joinRoom({ relay, bot, room, tokenFor, t0, stats, deadline, onOpen, over }) {
  return new Promise((resolve) => {
    let attempt = 0;
    // ONE TAB: a tab's peer id and secret are the same in every room it opens (net/online.js), and the connect that
    // goes online claims the account's seat (`cl`, ONE-SEAT) - a fresh id a room reads as another tab, and is refused
    const { id, secret } = bot.tab;
    const tryOnce = async () => {
      if (over.done || performance.now() > deadline) { resolve(null); return; }
      let ws;
      try { ws = new WebSocket(`${relay}/room/${room}`); } catch { resolve(null); return; }
      let said = null, opened = false;
      ws.onopen = async () => {
        opened = true;
        const tok = await tokenFor(room);
        const pose = room.startsWith('world:') ? { x: bot.i % 50, y: 0, z: (bot.i * 7) % 50, yaw: 0, pitch: 0 } : null;
        ws.send(JSON.stringify({ t: 'hello', id, secret, name: `Bot ${bot.i}`, look: LOOK, pose, ...(tok ? { tok } : {}), ...(attempt === 0 ? { cl: 1 } : {}) }));
      };
      ws.onmessage = (ev) => {
        let m = null;
        try { m = JSON.parse(String(ev.data)); } catch { return; }
        if (m?.t === 'welcome') { resolve(performance.now() - t0); onOpen?.(ws, id); }
        else if (m?.t === 'error') said = String(m.m ?? 'error');
      };
      ws.onerror = () => {};
      ws.onclose = (ev) => {
        if (over.done) return;   // the scenario's own closes at its end (Node reports some as 1006): neither counted nor retried
        // the relay's own word when it said one; else the close - and a 1006 (no close frame) split by whether the
        // socket ever opened: an upgrade that failed, or a connection dropped under it
        const why = said ?? (ev.code === 1006 ? (opened ? 'dropped after open (1006)' : 'upgrade failed (1006)') : `close ${ev.code}`);
        if (ev.code === 1000) return;   // ours
        stats.refusals[why] = (stats.refusals[why] ?? 0) + 1;
        if (process.env.LOADBOTS_TRACE && said) console.log(`   [trace] bot ${bot.i} ${room} attempt ${attempt}: ${said} (close ${ev.code})`);
        if (ev.code === 1008 && said !== 'busy') { resolve(null); return; }   // a refusal a retry cannot clear
        setTimeout(tryOnce, retryAfter(attempt++));
      };
    };
    tryOnce();
  });
}

/** THE STORM: every bot connects all its rooms in the same instant. */
async function storm({ account, relay, bots, mode, seconds }) {
  const stats = { mints: 0, mintMs: [], welcomeMs: [], refusals: {}, sockets: 0, unwelcomed: 0 };
  const open = [];
  const over = { done: false };
  const deadline = performance.now() + seconds * 1000;
  const t0 = performance.now();
  await Promise.all(bots.map(async (bot) => {
    bot.tab = { id: `bot${bot.i}-${hex(4)}`, secret: hex(12) };   // a new tab each scenario - it claims the seat
    // per-connect: one token for the connect's rooms, never twice into one room (SCALE2's minter, in small)
    let held = null;
    const tokenFor = mode === 'per-socket'
      ? () => mint(account, bot, stats)
      : (room) => {
        if (!held || held.rooms.has(room)) held = { p: mint(account, bot, stats), rooms: new Set() };
        held.rooms.add(room);
        return held.p;
      };
    const rooms = roomsFor(bot.i);
    stats.sockets += rooms.length;
    const got = await Promise.all(rooms.map((room) => joinRoom({ relay, bot, room, tokenFor, t0, stats, deadline, over, onOpen: (ws) => open.push(ws) })));
    for (const ms of got) { if (ms == null) stats.unwelcomed += 1; else stats.welcomeMs.push(ms); }
  }));
  over.done = true;
  for (const ws of open) { try { ws.close(1000, 'done'); } catch { /* gone */ } }
  await sleep(500);
  return summarize({ mode, bots: bots.length, ...stats });
}

// ─── LOCAL WORKERD, BOTH WORKERS ─────────────────────────────────────

const WRANGLER_BIN = process.env.WRANGLER_BIN || '';
const cmd = (args) => (WRANGLER_BIN ? [WRANGLER_BIN, args] : ['npx', ['--yes', 'wrangler@4', ...args]]);

async function waitUp(url, label, proc, log) {
  for (let i = 0; i < 150; i++) {
    await sleep(1000);
    try { if ((await fetch(url)).status === 200) return; } catch { /* not yet */ }
    if (proc.exitCode != null) break;
  }
  throw new Error(`${label} never answered ${url}:\n${log().split('\n').slice(-20).join('\n')}`);
}

async function standLocal({ accountPort, relayPort }) {
  const state = mkdtempSync(join(tmpdir(), 'loadbots-state-'));
  const tmp = mkdtempSync(join(tmpdir(), 'loadbots-'));
  const { stdout } = await run(process.execPath, [join(root, 'tools/mintIdentityKeys.mjs'), '--pipe']);
  const [priv, pub] = stdout.split('\n');
  const envFile = join(tmp, 'acct.env');
  writeFileSync(envFile, `IDENTITY_PRIVATE_KEY=${priv}\nIDENTITY_PUBLIC_KEY=${pub}\n`, { mode: 0o600 });
  const [migBin, migArgs] = cmd(['d1', 'migrations', 'apply', 'daggerfall-accounts', '--local', '--persist-to', state]);
  await run(migBin, migArgs, { cwd: join(root, 'server-account'), timeout: 300_000 });
  const procs = [];
  const start = (cwd, args) => {
    const [bin, a] = cmd(args);
    const p = spawn(bin, a, { cwd, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    let log = '';
    p.stdout.on('data', (d) => { log += d; }); p.stderr.on('data', (d) => { log += d; });
    procs.push(p);
    return { p, log: () => log };
  };
  // two workerds side by side: each its own port AND its own inspector port (both default to 9229, and the second one
  // dies binding it)
  const a = start(join(root, 'server-account'), ['dev', '--local', '--persist-to', state, '--port', String(accountPort), '--inspector-port', String(accountPort + 100), '--ip', '127.0.0.1', '--env-file', envFile]);
  const r = start(join(root, 'server'), ['dev', '--local', '--persist-to', join(state, 'relay'), '--port', String(relayPort), '--inspector-port', String(relayPort + 100), '--ip', '127.0.0.1', '--var', `IDENTITY_PUBLIC_KEY:${pub}`]);
  // THE WHOLE GROUP (npx wraps wrangler wraps workerd), and WAITED FOR - a run straight after this one binds the same
  // ports - with a hard kill for any still standing after five seconds
  const stop = async () => {
    const gone = procs.map((p) => (p.exitCode != null ? Promise.resolve() : new Promise((r) => p.once('exit', r))));
    for (const p of procs) { try { process.kill(-p.pid, 'SIGTERM'); } catch { /* gone */ } }
    await Promise.race([Promise.all(gone), sleep(5000)]);
    for (const p of procs) { if (p.exitCode == null) { try { process.kill(-p.pid, 'SIGKILL'); } catch { /* gone */ } } }
    try { rmSync(state, { recursive: true, force: true }); rmSync(tmp, { recursive: true, force: true }); } catch { /* best effort */ }
  };
  try {
    await waitUp(`http://127.0.0.1:${accountPort}/v1/health`, 'the account service', a.p, a.log);
    await waitUp(`http://127.0.0.1:${relayPort}/health`, 'the relay', r.p, r.log);
  } catch (e) { await stop(); throw e; }
  return { account: `http://127.0.0.1:${accountPort}`, relay: `ws://127.0.0.1:${relayPort}`, stop };
}

// ─── THE RUN ─────────────────────────────────────────────────────────

function print(s) {
  const d = (x) => `p50 ${x.p50 ?? '-'}  p95 ${x.p95 ?? '-'}  max ${x.max ?? '-'} ms (n ${x.n})`;
  console.log(`\n== ${s.mode}: ${s.bots} bots, ${s.sockets} sockets`);
  console.log(`   mints        ${s.mints} (${s.mintsPerBot} a bot)`);
  console.log(`   mint         ${d(s.mint)}`);
  console.log(`   to welcome   ${d(s.welcome)}   never welcomed: ${s.unwelcomed}`);
  const r = Object.entries(s.refusals).sort((a, b) => b[1] - a[1]);
  console.log(`   refusals     ${r.length ? r.map(([k, v]) => `${k} x${v}`).join(', ') : 'none'}`);
}

async function main() {
  const args = argsOf(process.argv.slice(2));
  const n = Number(args.bots ?? 40), seconds = Number(args.seconds ?? 30);
  let local = null;
  let account = args.account, relay = args.relay;
  if (!account || !relay) {
    console.log('== standing both Workers up in local workerd (a throwaway key pair, a throwaway database)');
    local = await standLocal({ accountPort: Number(args['account-port'] ?? 8821), relayPort: Number(args['relay-port'] ?? 8822) });
    ({ account, relay } = local);
  }
  try {
    console.log(`== seating ${n} bots (a guest and a realm character each) at ${account}`);
    const bots = [];
    for (let i = 0; i < n; i++) bots.push(await seat(account, i));   // one at a time: the per-IP guest bound is the service's, not the storm's
    const out = [];
    for (const mode of String(args.modes ?? 'per-socket,per-connect').split(',')) {
      out.push(await storm({ account, relay, bots, mode, seconds }));
      print(out.at(-1));
      await sleep(2000);
    }
    if (args.json) writeFileSync(String(args.json), JSON.stringify(out, null, 2));
  } finally {
    await local?.stop();
  }
}

if (isMain(import.meta.url)) {
  main().catch((e) => { console.error(e?.stack ?? String(e)); process.exit(1); });
}
