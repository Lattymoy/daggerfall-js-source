#!/usr/bin/env node
// SCALE3 (2026-10-08, Mac: "Do 1 2 and 3"): THE LOAD HARNESS - a fleet of bots against the REAL relay and the REAL account
// service, both in local workerd, at the real client's own rates, measured (bible/11-Multiplayer/Scale-Arc.md SCALE3).
//
//   npm run load                                    50 bots, three minutes standing play
//   node tools/loadHarness.mjs --bots 200 --minutes 5
//   node tools/loadHarness.mjs --scenario storm     the same, and halfway the relay is restarted under the fleet (a deploy)
//   node tools/loadHarness.mjs --json out.json      every figure, for a machine
//   node tools/loadHarness.mjs --help               every knob
//
// WRANGLER_BIN names a wrangler to run (`npm ci` in server/ installs one - server/node_modules/.bin/wrangler, which is
// taken by default when it is there); without one, `npx --yes wrangler@4` (minutes a call on a cold cache).
//
// ═══ WHAT A BOT IS ══════════════════════════════════════════════════════════════════════════════════════════════════
//
// The client's own modules, never a model of them - so what the fleet does is what the game does, and a change to the
// client's law moves the fleet with it:
//   - a guest made through POST /v1/auth/guest (TERMS1's versions ticked, each bot its own address - the service bounds
//     an address's sign-ups), registered through /v1/auth/register, and a realm character created and given its first
//     save through the realm's own client calls (systems/realmSaves.js realmCreate) - online is the realm's (REALM-DOOR);
//   - three rooms as the world host holds them (scenes/world.js onlineStart): the PRESENCE session in its cell (and the
//     cell's halo), the hub link (`chat:world`, the account's profile, the seat claimed) and the region link - each a
//     net/online.js OnlineSession over this harness's WebSocket, each token from ONE net/accountClient.js
//     accountTokenMinter for the bot, as the game shares one;
//   - poses from a walk, through OnlineSession.sendPose (its own POSE_HZ gate and crowd law), chat lines, and the
//     session's own tick (pings, retries, halos);
//   - the account calls the client makes on its own clocks, each by the client's own call and at the client's own
//     constant: the play beat (net/playClock.js PLAY_BEAT_S), the mail (net/mail.js MAIL_POLL_MS), Renown while it is
//     owed (net/renown.js RENOWN_REPORT_MS - a bot fighting), the realm checkpoint (systems/onlineCheckpoint.js
//     ONLINE_CHECKPOINT_MS, through the realm's own session, packed and idle-keyed), the town's Notice Board
//     (net/boardLaw.js BOARD_CACHE_MS), the town's yards (scenes/homeYards.js YARD_TOWN_TTL_MS, no session), the towns'
//     layouts once at the start, the seats' red lines (net/townSeatBook.js SEAT_RED_READ_MS), the Motherlodes
//     (net/motherlodeBook.js MOTHERLODE_READ_MS), and the professions' state as the client's book reads it
//     (net/profBook.js stale(), scenes/gatherHost.js): once on arrival and again at the UTC day's turn, a refusal (a
//     guest's) asked again every PROF_CLOSED_RECHECK_MS. AUDIT SCALE C1: the harness asked it every 30 s of a gatherer's -
//     the client's floor for a read that FAILED - thirty times the client, and a quarter of every statement it measured.
// Each clock starts at a random phase, so a fleet is not one synchronised drum. WHAT A PLAYER DOES IS NOT MODELLED: no
// harvest, craft, market post, pin or letter sent - the fleet stands and walks in its town, fights (a fighter owes
// Renown every RENOWN_REPORT_MS, without a pause) and talks, as the knobs say; a run's report states its fleet.
//
// ═══ WHAT IT MEASURES ═══════════════════════════════════════════════════════════════════════════════════════════════
//
//   - THE ACCOUNT SERVICE, by route: requests a bot-hour, statuses, latency, and the D1 statements each ran - the
//     service's own metrics point (server-account/src/metrics.js), kept in the isolate by tools/loadAccountEntry.mjs
//     where a deploy writes it to Analytics Engine; and by statement, the rows D1 read and wrote - the figure the
//     database is billed and throttled by (YARD-SHED and STORM-SHED read it off `wrangler d1 insights`);
//   - THE RELAY, at the bots: frames and bytes in and out a bot-second by frame type, the latency of a pose from its
//     sender's stamp (wire.js POSE_TS_MOD) to a listener, the closes by code and the refusals by word;
//   - A DEPLOY (--scenario storm): the relay's process killed and started again on the same state, as a deploy restarts
//     every Durable Object - and the reconnect wave second by second: the mints, the service's statements, the hellos
//     refused, and how long until a quarter, half, nine in ten and every bot is welcomed back in its cell.
//
// ═══ WHAT IT IS NOT ═════════════════════════════════════════════════════════════════════════════════════════════════
//
// workerd on this machine is not Cloudflare: a local D1 is one SQLite file with no queue, no network and no global
// placement, and the fleet shares the machine with both Workers. Latency here is relative; COUNTS are not - statements a
// request, rows a statement, requests a bot-hour and frames a bot-second are the code's own, and they are what the
// production overloads were made of. The staging pair (SCALE3's second half) is the same harness pointed at deployed
// Workers; it is not built here, and this file refuses every address but its own two.
//
// A RUN SERVES THE TREE IT STANDS IN, LIVE: `wrangler dev` rebuilds a Worker whenever its source changes, so a file edited
// under a run is what the run measures from that moment on (the first baseline of SCALE3's record was lost that way).
// Measure a commit from a snapshot of it - `git worktree add <dir> <commit>`, server/node_modules linked into it.
//
// It is NOT in the suite and has no Testing.md row, for the account probe's reason (tools/accountProbe.mjs): it needs a
// toolchain and minutes. Its parts that can be pinned without one are - test/scale3.test.js.
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { request as httpRequest } from 'node:http';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

import { isMain } from './lib/isMain.mjs';
import { OnlineSession } from '../src/net/online.js';
import {
  accountTokenMinter, SESSION_KEY, SERVICE_KEY, beatPlay, register as registerCall,
  accountBoard, accountHomes, accountSeats, accountProf, accountRenown, accountDecor,
} from '../src/net/accountClient.js';
import { inboxCall, MAIL_POLL_MS, MailBox } from '../src/net/mail.js';
import { createNoticeBook } from '../src/net/noticeBook.js';
import { startPlayClock } from '../src/net/playClock.js';
import { realmIo, realmCreate, createRealmSession } from '../src/systems/realmSaves.js';
import { worldRoom, cellHaloFor, CHAT_WORLD_ROOM, chatRegionRoom, PIXEL_UNITS, POSE_TS_MOD } from '../src/net/wire.js';
import { ACCEPTED } from '../src/net/legalLaw.js';
import { PLAY_BEAT_S } from '../src/net/playClock.js';
import { RENOWN_REPORT_MS } from '../src/net/renown.js';
import { renownRid } from '../src/net/renownTracker.js';
import { BOARD_CACHE_MS } from '../src/net/boardLaw.js';
import { YARD_TOWN_TTL_MS } from '../src/scenes/homeYards.js';
import { ONLINE_CHECKPOINT_MS } from '../src/systems/onlineCheckpoint.js';
import { SEAT_RED_READ_MS } from '../src/net/townSeatBook.js';
import { MOTHERLODE_READ_MS } from '../src/net/motherlodeBook.js';
import { PROF_CLOSED_RECHECK_MS } from '../src/net/profBook.js';
import { utcDayOfMs } from '../src/net/nodeLaw.js';
import { routeLabel } from '../server-account/src/metrics.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/** SCALE4c: the tab's one heartbeat (src/net/heartbeat.js), where the tree under test has it - its bots then keep the
 *  beat, the letterbox and the town's board as the world host keeps them (the client's own MailBox, notice book and play
 *  clock, each a part of the bot's heartbeat); a tree before it is measured with the three clocks it had. */
const HEARTBEAT = await import('../src/net/heartbeat.js').catch(() => null);
const run = promisify(execFile);

// ═══ THE KNOBS ═════════════════════════════════════════════════════════════════════════════════════════════════════

/** Every knob, its default, and what it means - `--help` prints this table. */
export const KNOBS = Object.freeze({
  bots: [50, 'bots in the fleet'],
  minutes: [3, 'minutes of play once the fleet is in'],
  scenario: ['steady', 'steady, or storm (the relay restarted under the fleet at --storm-at)'],
  'storm-at': [0.5, 'when the storm comes, as a share of --minutes'],
  cells: [1, 'world cells the fleet stands in (one: the whole fleet in one town, the worst crowd)'],
  edge: [0, '1 stands each cell\'s bots near its corner, so every bot holds a halo of three more cells'],
  ramp: [30, 'seconds over which the bots connect'],
  movers: [0.7, 'the share of bots walking (the rest stand, saying a heartbeat pose)'],
  fighters: [0.5, 'the share fighting (each owes Renown every RENOWN_REPORT_MS, without a pause)'],
  registered: [1, 'the share registered (a guest is refused the mail, the Motherlodes and the board\'s writes)'],
  'chat-every': [300, 'seconds between a bot\'s lines on the hub (0: silent)'],
  'save-kb': [48, 'the realm save a checkpoint carries, in KB of JSON before packing'],
  setup: [8, 'bots set up at once (a fleet\'s)'],
  threads: [1, 'worker threads the fleet is spread over - a crowd of a hundred in one cell outruns one thread\'s event loop, and its pose ages are then the fleet\'s own queue'],
  port: [8870, 'the account service listens here, the relay on the next port'],
  json: ['', 'a file to write every figure to'],
  keep: [0, '1 keeps the state directory (the D1 file, the Durable Objects) for a look afterwards'],
  trace: [0, '1 prints, each second of a storm, how the fleet\'s sessions stand (status, why, next retry)'],
});

/** `--name value` / `--name=value` pairs over KNOBS' defaults, typed as the default is. Unknown names are refused. */
export function parseArgs(argv) {
  const out = Object.fromEntries(Object.entries(KNOBS).map(([k, [v]]) => [k, v]));
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') return { help: true };
    const m = /^--([a-z-]+)(?:=(.*))?$/.exec(a);
    if (!m || !(m[1] in KNOBS)) throw new Error(`unknown argument ${a} (--help names them)`);
    const raw = m[2] ?? argv[++i];
    if (raw === undefined) throw new Error(`--${m[1]} needs a value`);
    const was = KNOBS[m[1]][0];
    const v = typeof was === 'number' ? Number(raw) : String(raw);
    if (typeof was === 'number' && !Number.isFinite(v)) throw new Error(`--${m[1]} takes a number, not ${raw}`);
    out[m[1]] = v;
  }
  if (!['steady', 'storm'].includes(out.scenario)) throw new Error(`--scenario is steady or storm, not ${out.scenario}`);
  if (!(out.bots >= 1 && out.minutes > 0 && out.cells >= 1)) throw new Error('--bots, --minutes and --cells must be positive');
  // AUDIT SCALE C12: a count is a whole number (2.5 threads built fleets past the bots asked), a share a share, and the
  // storm inside the play (--setup 0 never set a bot up, and spun)
  for (const k of ['bots', 'cells', 'setup', 'threads', 'port']) if (!Number.isSafeInteger(out[k]) || out[k] < 1) throw new Error(`--${k} takes a whole number from 1, not ${out[k]}`);
  for (const k of ['movers', 'fighters', 'registered']) if (!(out[k] >= 0 && out[k] <= 1)) throw new Error(`--${k} is a share, 0 to 1, not ${out[k]}`);
  if (!(out['storm-at'] > 0 && out['storm-at'] < 1)) throw new Error(`--storm-at is a share of the play, between 0 and 1, not ${out['storm-at']}`);
  for (const k of ['ramp', 'chat-every', 'save-kb']) if (!(out[k] >= 0)) throw new Error(`--${k} cannot be negative`);
  return out;
}

// ═══ ONLY ITS OWN TWO ADDRESSES ════════════════════════════════════════════════════════════════════════════════════

/** The account service's address as the bots' storage names it. The client accepts only an https base
 *  (accountClient.js serviceBase) and falls back to the PRODUCTION service for anything else - so the bots are given
 *  this one, which resolves nowhere, and `localFetch` maps it to the local Worker. */
export const LOAD_SERVICE = 'https://accounts.load.invalid';

/** A fetch that reaches the local account service and NOTHING ELSE: a URL on LOAD_SERVICE goes to 127.0.0.1:`port`
 *  (over node:http - no proxy is consulted), every other URL - the production service a fallback would name above all
 *  - is refused before a byte leaves. `ip` rides as cf-connecting-ip, the address the service bounds an open route's
 *  callers by. `note(route, status, ms)` hears every answer. */
export function localFetch({ port, ip = null, note = null, request = httpRequest }) {
  return async (url, init = {}) => {
    const u = String(url);
    if (!u.startsWith(`${LOAD_SERVICE}/`)) throw new Error(`the load harness reaches its own services only - refused ${u}`);
    const path = u.slice(LOAD_SERVICE.length);
    const started = Date.now();
    const body = init.body == null ? null : (typeof init.body === 'string' ? Buffer.from(init.body) : Buffer.from(init.body));
    const headers = { ...(init.headers ?? {}), ...(ip ? { 'cf-connecting-ip': ip } : {}), ...(body ? { 'content-length': String(body.length) } : {}) };
    const res = await new Promise((resolve, reject) => {
      // AUDIT SCALE C13: the caller's give-up honoured (the client's waitedPost, the heartbeat's try), as a browser's fetch
      if (init.signal?.aborted) { reject(new Error('aborted')); return; }
      const req = request({ host: '127.0.0.1', port, path, method: init.method ?? 'GET', headers, timeout: 30_000 }, (r) => {
        const parts = [];
        r.on('data', (d) => parts.push(d));
        r.on('end', () => resolve({ status: r.statusCode, headers: r.headers, buf: Buffer.concat(parts) }));
        r.on('error', reject);
      });
      req.on('timeout', () => req.destroy(new Error('timed out')));
      req.on('error', reject);
      init.signal?.addEventListener?.('abort', () => req.destroy(new Error('aborted')), { once: true });
      if (body) req.write(body);
      req.end();
    }).catch((e) => { note?.(routeLabel(path.split('?')[0]), 'offline', Date.now() - started); throw e; });
    let word = '';
    if (res.status >= 400 && /json/.test(String(res.headers['content-type'] ?? ''))) { try { word = JSON.parse(res.buf.toString('utf8'))?.error ?? ''; } catch { word = ''; } }
    note?.(routeLabel(path.split('?')[0]), word ? `${res.status} ${word}` : res.status, Date.now() - started);
    const h = new Headers();
    for (const [k, v] of Object.entries(res.headers)) if (v != null) h.set(k, Array.isArray(v) ? v.join(', ') : String(v));
    return new Response(res.status === 204 || res.status === 304 ? null : res.buf, { status: res.status, headers: h });
  };
}

/** The bots' WebSocket: Node's own, opened only to the local relay (any other URL throws), each frame counted by type
 *  and each pose's latency taken from its sender's stamp. One class a fleet, so every socket lands in one tally. */
export function localWebSocket({ port, tally, Base = globalThis.WebSocket, now = () => Date.now() }) {
  const allowed = `ws://127.0.0.1:${port}/room/`;
  return class LoadSocket extends Base {
    constructor(url, protocols) {
      if (!String(url).startsWith(allowed)) throw new Error(`the load harness reaches its own relay only - refused ${url}`);
      super(url, protocols);
      const room = String(url).slice(allowed.length);
      tally.opened += 1;
      this.addEventListener('message', (e) => {
        const text = typeof e.data === 'string' ? e.data : '';
        const t = /^\{"t":"([a-z]+)"/.exec(text)?.[1] ?? '?';
        tally.inFrames += 1; tally.inBytes += text.length;
        tally.inByType[t] = (tally.inByType[t] ?? 0) + 1;
        if (t === 'pose') {
          const ts = /"ts":(\d+)/.exec(text)?.[1];
          if (ts != null) tally.poseMs.push(((now() % POSE_TS_MOD) - Number(ts) + POSE_TS_MOD) % POSE_TS_MOD);
        } else if (t === 'welcome') {
          tally.onWelcome?.(this, room);
        } else if (t === 'error') {
          const m = /"m":"([^"]*)"/.exec(text)?.[1] ?? '?';
          tally.refusals[m] = (tally.refusals[m] ?? 0) + 1;
          tally.refusedAt?.push([now(), m]);   // AUDIT SCALE C5: when, for the storm's seconds
        }
      });
      let opened = false, closed = false;
      this.addEventListener('open', () => { opened = true; });
      this.addEventListener('close', (e) => { closed = true; tally.closes[e.code] = (tally.closes[e.code] ?? 0) + 1; });
      // A BROWSER CLOSES WHAT FAILED TO OPEN, AND NODE DOES NOT: a connect refused (a relay down mid-deploy) fires
      // `error` and then `close` 1006 in every browser, and Node 22's WebSocket fires the error alone and leaves the
      // socket CONNECTING for ever. The client's retry waits on that close (net/online.js _bind's onclose), so under
      // Node a fleet never came back from a storm - the harness's own artifact, said here as a browser says it.
      this.addEventListener('error', () => {
        if (opened) return;
        setTimeout(() => {
          if (closed) return;
          closed = true;
          tally.closes[1006] = (tally.closes[1006] ?? 0) + 1;
          tally.synthetic += 1;
          this.onclose?.({ type: 'close', code: 1006, reason: '', wasClean: false });
        }, 0);
      });
    }
    send(data) {
      const text = String(data);
      const t = /^\{"t":"([a-z]+)"/.exec(text)?.[1] ?? '?';
      tally.outFrames += 1; tally.outBytes += text.length;
      tally.outByType[t] = (tally.outByType[t] ?? 0) + 1;
      return super.send(data);
    }
  };
}

/** A fresh tally for the relay's side. */
export const relayTally = () => ({
  opened: 0, synthetic: 0, inFrames: 0, inBytes: 0, outFrames: 0, outBytes: 0,
  inByType: {}, outByType: {}, closes: {}, refusals: {}, refusedAt: [], poseMs: [], onWelcome: null,
});

/** The p-th percentile (0..1) of a list of numbers, or null for none. */
export function percentile(list, p) {
  if (!list.length) return null;
  const s = [...list].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))];
}

/** A device's storage: a Map behind the four calls the client asks of localStorage. */
export function botStorage(seed = {}) {
  const m = new Map(Object.entries(seed));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _map: m };
}

// ═══ THE WORLD THE FLEET STANDS IN ═════════════════════════════════════════════════════════════════════════════════

/** The map pixel of cell `k`'s town: cells two apart along one row from (13, 13) - far enough that no two cells' halos
 *  meet - standing at the cell's middle, or (`edge`) a pixel inside its corner, where its halo is three more cells. */
export function townPixel(k, edge = false) {
  const cx = 13 + 2 * k, cy = 13;
  return edge ? { px: cx * 16 + 1, py: cy * 16 + 1 } : { px: cx * 16 + 8, py: cy * 16 + 8 };
}

/** A bot's pose at `t` seconds: a mover walks a circle of up to a third of a pixel round its town's pixel (every bot of
 *  a town within the relay's range of every other - the crowd the fan was built for), a stander stands. */
export function poseAt(bot, t) {
  const { px, py } = bot.town;
  const a = bot.phase + (bot.mover ? t * bot.speed : 0);
  const r = bot.mover ? bot.radius : 0;
  const x = (px + 0.5) * PIXEL_UNITS + Math.cos(a) * r * PIXEL_UNITS;
  const z = (499 - py + 0.5) * PIXEL_UNITS + Math.sin(a) * r * PIXEL_UNITS;
  return { x, y: 0, z, yaw: a, pitch: 0, mv: bot.mover ? 1 : 0 };
}

/** A realm save of about `kb` KB of JSON - a character as the realm keeps one, its inventory the bulk - stamped with
 *  where it stands and when, so every checkpoint is a save that changed (a player at play), never an idle one. */
export function saveText(bot, kb, at) {
  const items = [];
  for (let i = 0; JSON.stringify(items).length < kb * 1024; i++) {
    items.push({ templateIndex: (i * 37) % 600, group: 'Weapons', equipSlot: i % 30, condition: 100 - (i % 50), name: `item ${bot.n}-${i}`, value: i * 13 });
  }
  return JSON.stringify({ name: bot.name, level: 1, goldPieces: 100, items, place: poseAt(bot, at / 1000), at });
}

// ═══ THE TOOLCHAIN ═════════════════════════════════════════════════════════════════════════════════════════════════

const localWrangler = join(ROOT, 'server/node_modules/.bin/wrangler');
const WRANGLER_BIN = process.env.WRANGLER_BIN || (existsSync(localWrangler) ? localWrangler : '');
const wrangler = (args) => (WRANGLER_BIN ? [WRANGLER_BIN, args] : ['npx', ['--yes', 'wrangler@4', ...args]]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Is anything answering (or holding) a local port? Only a refused connection says no - an orphaned workerd accepts and
 *  never answers (tools/accountProbe.mjs's lesson). */
async function portHeld(port) {
  return new Promise((resolve) => {
    const req = httpRequest({ host: '127.0.0.1', port, path: '/', timeout: 1500 }, (r) => { r.resume(); resolve(true); });
    req.on('timeout', () => { req.destroy(); resolve(true); });
    req.on('error', (e) => resolve(!/ECONNREFUSED/.test(String(e?.code ?? e?.message ?? e))));
    req.end();
  });
}

async function healthy(port, path, waitS) {
  for (let i = 0; i < waitS; i++) {
    const ok = await new Promise((resolve) => {
      const req = httpRequest({ host: '127.0.0.1', port, path, timeout: 1500 }, (r) => { r.resume(); resolve(r.statusCode === 200); });
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
      req.end();
    });
    if (ok) return true;
    await sleep(1000);
  }
  return false;
}

/** The processes this run started, each its own group - killed whole (npx -> wrangler -> workerd: the grandchild holds
 *  the port), on the way out and on a signal. */
const started = new Set();
function startDev(cwd, args, label) {
  const [bin, a] = wrangler(args);
  const p = spawn(bin, a, { cwd, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  p.label = label; p.log = '';
  const keep = (d) => { p.log = (p.log + d).slice(-20_000); };
  p.stdout.on('data', keep); p.stderr.on('data', keep);
  started.add(p);
  return p;
}
function stopDev(p) {
  if (!p) return;
  started.delete(p);
  try { process.kill(-p.pid, 'SIGKILL'); } catch { /* already gone */ }
}
export const stopAll = () => { for (const p of [...started]) stopDev(p); };

// ═══ THE SERVICES ══════════════════════════════════════════════════════════════════════════════════════════════════

export async function standServices(o, state) {
  const accountPort = o.port, relayPort = o.port + 1;
  for (const port of [accountPort, relayPort]) {
    if (await portHeld(port)) throw new Error(`something already holds 127.0.0.1:${port} - stop it (an orphaned workerd: \`ps aux | grep workerd\`), or pass --port`);
  }
  console.log('== a throwaway signing pair (never written into the repository)');
  const { stdout } = await run(process.execPath, [join(ROOT, 'tools/mintIdentityKeys.mjs'), '--pipe']);
  const [priv, pub] = stdout.split('\n');
  const acctEnv = join(state, 'account.env');
  writeFileSync(acctEnv, `IDENTITY_PRIVATE_KEY=${priv}\nIDENTITY_PUBLIC_KEY=${pub}\n`, { mode: 0o600 });
  const relayEnv = join(state, 'relay.env');
  writeFileSync(relayEnv, `IDENTITY_PUBLIC_KEY=${pub}\n`, { mode: 0o600 });

  console.log('== the account database: every migration, through wrangler\'s ledger');
  const [mb, ma] = wrangler(['d1', 'migrations', 'apply', 'daggerfall-accounts', '--local', '--persist-to', state]);
  await run(mb, ma, { cwd: join(ROOT, 'server-account'), timeout: 600_000, maxBuffer: 64 * 1024 * 1024 });

  const account = () => startDev(join(ROOT, 'server-account'), ['dev', join(ROOT, 'tools/loadAccountEntry.mjs'),
    '--config', join(ROOT, 'server-account/wrangler.toml'), '--local', '--persist-to', state, '--port', String(accountPort),
    '--ip', '127.0.0.1', '--inspector-port', String(accountPort + 100), '--env-file', acctEnv, '--test-scheduled'], 'account');
  const relay = () => startDev(join(ROOT, 'server'), ['dev', '--config', join(ROOT, 'server/wrangler.toml'), '--local',
    '--persist-to', state, '--port', String(relayPort), '--ip', '127.0.0.1', '--inspector-port', String(relayPort + 100), '--env-file', relayEnv], 'relay');
  console.log('== booting both Workers in workerd');
  const svc = { accountPort, relayPort, account: account(), relay: relay(), restartRelay: null };
  if (!(await healthy(accountPort, '/v1/health', 180))) throw new Error(`the account service never answered:\n${svc.account.log.slice(-2000)}`);
  // AUDIT SCALE C11: the private half read and the service up - it leaves the disk now, not at the run's end (the relay's
  // file holds the public half alone, and the storm restarts only the relay)
  rmSync(acctEnv, { force: true });
  if (!(await healthy(relayPort, '/health', 180))) throw new Error(`the relay never answered:\n${svc.relay.log.slice(-2000)}`);
  svc.restartRelay = async () => {
    stopDev(svc.relay);
    for (let i = 0; i < 20 && (await portHeld(relayPort)); i++) await sleep(250);
    svc.relay = relay();
    return healthy(relayPort, '/health', 180);
  };
  return svc;
}

/** THE SERVICE'S OWN CLOCK (SCALE4b, server-account/src/cron.js), fired as the deploy fires it: the minute's list every
 *  minute of play and the hour's once as play begins - `wrangler dev --test-scheduled` answers /__scheduled. Its
 *  statements ride the service's own points (`cron:<job>`), counted with the rest. The two strings are cron.js's
 *  CRON_MINUTE and CRON_HOUR (test/scale3.test.js holds them together); a tree whose service keeps no clock (before
 *  SCALE4b) answers the firing with nothing, so one harness measures either. */
export const FIRE_MINUTE = '* * * * *';
export const FIRE_HOUR = '41 * * * *';
async function fireCron(port, cron) {
  return new Promise((resolve) => {
    const req = httpRequest({ host: '127.0.0.1', port, path: `/__scheduled?cron=${encodeURIComponent(cron)}`, timeout: 60_000 }, (r) => { r.resume(); r.on('end', resolve); });
    req.on('error', () => resolve());
    req.on('timeout', () => { req.destroy(); resolve(); });
    req.end();
  });
}

/** The account service's kept points and statements since the last read (tools/loadAccountEntry.mjs) - every read
 *  drains them, so each fold is of what is new. */
async function serviceStats(port) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path: '/__load/stats', timeout: 30_000 }, (r) => {
      const parts = [];
      r.on('data', (d) => parts.push(d));
      r.on('end', () => { try { resolve(JSON.parse(Buffer.concat(parts).toString('utf8'))); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.end();
  });
}

// ═══ THE FLEET ═════════════════════════════════════════════════════════════════════════════════════════════════════

/** The client-side tally of the account service: route -> { n, statuses, ms[] }. */
const accountTally = () => ({ byRoute: new Map(), at: [] });
function noteCall(tally, route, status, ms) {
  const row = tally.byRoute.get(route) ?? { n: 0, statuses: {}, ms: [] };
  row.n += 1;
  row.statuses[status] = (row.statuses[status] ?? 0) + 1;
  row.ms.push(ms);
  tally.byRoute.set(route, row);
  tally.at.push([Date.now(), route, status]);
}

const LOOK = Object.freeze({ race: 'Nord', gender: 'male', faceIndex: 0, items: [] });
const quietly = async (fn) => { try { return await fn(); } catch { return null; } };

/** One bot: made, then connected, then ticked. */
/** Bot `n`'s roles - a deterministic spread of each share over the fleet, each role its own (AUDIT SCALE C2: one spread
 *  for every share nested the roles, every fighter a mover and every gatherer a fighter). */
export function rolesOf(n, o) {
  // a Weyl sequence a role, the three multipliers rationally independent: each share spread evenly over the fleet, and
  // the roles' pairs spread evenly over the square (offsets on one sequence had moved every fighter with a mover)
  const roll = (share, a) => (n * a + 0.5) % 1 < share;
  return { mover: roll(o.movers, 0.6180339887498949), fighter: roll(o.fighters, 0.4142135623730951), registered: roll(o.registered, 0.7320508075688772) };
}

export function makeBot(n, o, ctx) {
  const k = n % o.cells;
  const town = townPixel(k, o.edge === 1);
  const bot = {
    n, name: `Load Bot ${n}`, handle: `LoadBot${n.toString(36)}x${ctx.runTag}`, town, mapId: 1000 + k,
    ...rolesOf(n, o),
    phase: Math.random() * Math.PI * 2, speed: 0.4 + Math.random() * 0.4, radius: 0.1 + Math.random() * 0.2,
    ip: `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`,
    id: `pload${n.toString(36).padStart(6, '0')}${ctx.runTag}`, secret: `loadsecret${n.toString(36)}x${ctx.runTag}`.padEnd(24, 'q'),
    acct: `aload${n.toString(36).padStart(6, '0')}${ctx.runTag}`, asecret: `loadacct${n.toString(36)}x${ctx.runTag}`.padEnd(24, 'w'),
    account: null, realm: null, sessions: [], presence: null, timers: [], welcomedAt: new Map(),
  };
  bot.fetch = localFetch({ port: ctx.svc.accountPort, ip: bot.ip, note: (route, status, ms) => noteCall(ctx.account, route, status, ms) });
  return bot;
}

export async function setUp(bot, o) {
  const io0 = { fetch: bot.fetch, base: LOAD_SERVICE };
  const made = await quietly(() => bot.fetch(`${LOAD_SERVICE}/v1/auth/guest`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label: 'load', ...ACCEPTED }),
  }).then((r) => r.json()));
  if (!made?.secret) throw new Error(`bot ${bot.n}: no guest (${JSON.stringify(made)})`);
  bot.account = { id: made.id, secret: made.secret, name: made.name };
  if (bot.registered) {
    const r = await registerCall({ ...io0, secret: made.secret }, bot.handle, 'a long load-test password', ACCEPTED);
    if (!r.ok) throw new Error(`bot ${bot.n}: not registered (${r.error})`);
    bot.account.name = bot.handle;
  }
  bot.storage = botStorage({
    [SESSION_KEY]: JSON.stringify({ secret: bot.account.secret, id: bot.account.id, name: bot.account.name }),
    [SERVICE_KEY]: LOAD_SERVICE,
  });
  const io = realmIo({ fetch: bot.fetch, storage: bot.storage });
  const c = await realmCreate(io, bot.name, null);
  if (!c.ok) throw new Error(`bot ${bot.n}: no realm character (${c.error})`);
  const rs = createRealmSession({ io, id: c.data.id, lease: c.data.lease, seq: c.data.seq ?? 0, gzip: c.data.gzip === true, hidden: () => false, watchHidden: () => {} });
  const first = await rs.checkpoint(JSON.stringify({ name: bot.name, level: 1, goldPieces: 100, items: [] }));
  if (!first?.ok) throw new Error(`bot ${bot.n}: the first save did not land (${first?.error})`);
  bot.realm = { id: c.data.id, session: rs };
  bot.minter = accountTokenMinter({ fetch: bot.fetch, storage: bot.storage, character: () => bot.realm.id });
  return bot;
}

/** The bot's three rooms, as the world host opens them. */
function connect(bot, ctx) {
  const t0 = ctx.clock();
  const pose = poseAt(bot, t0 / 1000);
  const { px, py } = bot.town;
  // the bot's own socket class over the fleet's: a socket opened at any time - a retry, a halo - is known as this bot's
  const Fleet = ctx.WS;
  const WS = class extends Fleet { constructor(url, protocols) { super(url, protocols); ctx.ownerOf.set(this, bot); } };
  const presence = new OnlineSession({ url: ctx.relayUrl, name: bot.account.name, look: LOOK, id: bot.id, secret: bot.secret, mintToken: bot.minter, WebSocketImpl: WS });
  presence.join(worldRoom(px, py), pose);
  presence.setHalo(cellHaloFor(px, py));
  const hub = new OnlineSession({ url: ctx.relayUrl, name: bot.account.name, look: LOOK, id: bot.id, secret: bot.secret, presence: false, WebSocketImpl: WS });
  hub.mintToken = bot.minter;
  hub.join(CHAT_WORLD_ROOM);
  hub.acct = bot.acct; hub.asecret = bot.asecret;
  hub.claim = true;
  const region = new OnlineSession({ url: ctx.relayUrl, name: bot.account.name, look: LOOK, id: bot.id, secret: bot.secret, presence: false, WebSocketImpl: WS });
  region.mintToken = bot.minter;
  region.join(chatRegionRoom(17));
  bot.presence = presence;
  bot.sessions = [presence, hub, region];
  bot.cell = worldRoom(px, py);
  bot.hub = hub;
}

/** The account calls a bot makes on its own clocks - each the client's own call, at the client's own constant. */
export function accountClocks(bot, o) {
  const io = () => ({ fetch: bot.fetch, base: LOAD_SERVICE, secret: bot.account.secret });
  const dev = { fetch: bot.fetch, storage: bot.storage };
  const board = accountBoard(dev), homes = accountHomes(dev), seats = accountSeats(dev), prof = accountProf(dev), renown = accountRenown(dev), decor = accountDecor(dev);
  const clocks = [];
  if (HEARTBEAT) {
    // SCALE4c: as the world host keeps them - the play clock knocking through the heartbeat, the box and the board its parts
    bot.heartbeat = HEARTBEAT.createHeartbeat({ fetch: bot.fetch, storage: bot.storage });
    bot.mail = new MailBox({ ioOf: () => ({ ...io(), storage: bot.storage }) });
    bot.notices = createNoticeBook({ door: board, storage: bot.storage });
    bot.heartbeat.add('board', bot.notices.heartbeatPart(() => bot.mapId));
    bot.heartbeat.add('mail', bot.mail.heartbeatPart());
    bot.stopBeat = startPlayClock({ beat: () => bot.heartbeat.beat() });
  } else {
    clocks.push(
      ['play beat', PLAY_BEAT_S * 1000, () => beatPlay(io())],
      ['mail', MAIL_POLL_MS, () => inboxCall(io())],
      ['board', BOARD_CACHE_MS, () => board.read(bot.mapId)],
    );
  }
  clocks.push(
    ['checkpoint', ONLINE_CHECKPOINT_MS, () => bot.realm.session.idle(() => bot.realm.session.checkpoint(saveText(bot, o['save-kb'], Date.now())))],
    ['yards', YARD_TOWN_TTL_MS, () => decor.yards(bot.mapId)],
    ['seats', SEAT_RED_READ_MS, () => seats.list()],
  );
  if (bot.registered) clocks.push(['motherlodes', MOTHERLODE_READ_MS, () => prof.motherlodes(bot.realm.id)]);
  if (bot.fighter) clocks.push(['renown', RENOWN_REPORT_MS, () => renown.report(bot.realm.id, 40, bot.name, renownRid())]);
  // AUDIT SCALE C1: the professions' state as the client's book reads it - on arrival, then at the UTC day's turn
  // (tickBot); a guest's refusal asked again every PROF_CLOSED_RECHECK_MS (net/profBook.js stale())
  bot.profDay = utcDayOfMs(Date.now());
  bot.profState = () => quietly(() => prof.state(bot.realm.id));
  if (bot.registered) bot.profState();
  else clocks.push(['prof state', PROF_CLOSED_RECHECK_MS, bot.profState]);
  // once at the start, as a boot asks: the towns' layouts
  quietly(() => homes.layouts());
  return clocks.map(([name, every, call]) => ({ name, every, call, next: Date.now() + Math.random() * every, busy: false }));
}

function tickBot(bot, ctx, o) {
  const now = Date.now();
  if (bot.presence) {
    bot.presence.sendPose(poseAt(bot, ctx.clock() / 1000));
    for (const s of bot.sessions) s.tick();
    if (o['chat-every'] > 0 && now >= bot.nextLine) {
      bot.nextLine = now + o['chat-every'] * 1000 * (0.5 + Math.random());
      bot.hub.sendChat(`the fleet says hello (${bot.n})`);
    }
  }
  // AUDIT SCALE C1: a registered account's professions' state read again at the UTC day's turn, as the book reads it
  if (bot.registered && bot.profState && utcDayOfMs(now) !== bot.profDay) { bot.profDay = utcDayOfMs(now); bot.profState(); }
  for (const c of bot.clocks ?? []) {
    if (c.busy || now < c.next) continue;
    c.busy = true;
    c.next = now + c.every;
    Promise.resolve().then(c.call).catch(() => null).finally(() => { c.busy = false; });
  }
}

// ═══ THE RUN ═══════════════════════════════════════════════════════════════════════════════════════════════════════

/** The pose ages a fleet keeps for its percentiles - a reservoir, so a long crowded run neither grows without bound nor
 *  loses its late poses (every pose heard has the same chance of being kept). */
export const POSE_SAMPLE_MAX = 100_000;
/** Keep `v` in `list`, a uniform reservoir of `max` over the `seen` values offered. */
export function reservoir(list, v, seen, max = POSE_SAMPLE_MAX) {
  if (list.length < max) { list.push(v); return; }
  const j = Math.floor(Math.random() * seen);
  if (j < max) list[j] = v;
}

/**
 * A FLEET: bots `from`..`to` of the run, with its own tallies - in this thread (`--threads 1`) or a worker thread of
 * its own, the main thread asking it the same six questions either way. The services, the clock and the storm are the
 * main thread's; a fleet only plays.
 */
export class Fleet {
  constructor({ o, accountPort, relayPort, runTag, from, to }) {
    this.o = o;
    this.relay = relayTally();
    this.poseSeen = 0;
    const relay = this.relay;
    const keepAge = relay.poseMs;
    relay.poseMs = { push: (v) => { this.poseSeen += 1; reservoir(keepAge, v, this.poseSeen); }, list: keepAge };
    const t0 = Date.now();
    this.ctx = {
      svc: { accountPort }, relayUrl: `ws://127.0.0.1:${relayPort}`, account: accountTally(), runTag,
      WS: localWebSocket({ port: relayPort, tally: relay }), clock: () => Date.now() - t0, ownerOf: new WeakMap(), trace: o.trace === 1,
    };
    relay.onWelcome = (ws, room) => { const b = this.ctx.ownerOf.get(ws); if (b) b.welcomedAt.set(room, Date.now()); };
    this.bots = [];
    for (let n = from; n < to; n++) this.bots.push(makeBot(n, o, this.ctx));
    this.ticker = null;
    this.mark = null;
  }
  async setUp() {
    for (let i = 0; i < this.bots.length; i += this.o.setup) await Promise.all(this.bots.slice(i, i + this.o.setup).map((b) => setUp(b, this.o)));
    return this.bots.length;
  }
  async connect(rampMs) {
    console.warn = () => {}; console.info = () => {};   // the sessions' own chatter, not the run's
    this.ticker = setInterval(() => { for (const b of this.bots) tickBot(b, this.ctx, this.o); }, 50);
    const start = Date.now();
    for (let i = 0; i < this.bots.length; i++) {
      const due = start + (i / this.bots.length) * rampMs;
      if (due > Date.now()) await sleep(due - Date.now());
      connect(this.bots[i], this.ctx);
      this.bots[i].clocks = accountClocks(this.bots[i], this.o);
      this.bots[i].nextLine = Date.now() + Math.random() * this.o['chat-every'] * 1000;
    }
    return true;
  }
  /** Play begins: every tally from nought. */
  play() {
    this.ctx.account = accountTally();
    const r = this.relay;
    for (const k of ['inFrames', 'inBytes', 'outFrames', 'outBytes']) r[k] = 0;
    r.inByType = {}; r.outByType = {}; r.closes = {}; r.refusals = {};
    r.poseMs.list.length = 0; this.poseSeen = 0;
    return true;
  }
  /** The storm begins: nobody is back until a welcome says so. */
  stormBegin() {
    for (const b of this.bots) b.welcomedAt.clear();
    this.mark = { calls: this.ctx.account.at.length, refusals: { ...this.relay.refusals }, refusedAt: this.relay.refusedAt.length };
    return true;
  }
  /** Each bot's welcome back into its own cell since the storm began (ms, or null for one not back). */
  backTimes() { return this.bots.map((b) => b.welcomedAt.get(b.cell) ?? null); }
  /** The second since the last asked: the calls (mints among them, failures), the refusals, and the bots back in their
   *  cell - and (AUDIT SCALE C5) every call and refusal with its own moment, for the storm's seconds. */
  second() {
    const calls = this.ctx.account.at.slice(this.mark.calls);
    this.mark.calls = this.ctx.account.at.length;
    const refusedAt = this.relay.refusedAt.slice(this.mark.refusedAt);
    this.mark.refusedAt = this.relay.refusedAt.length;
    const refused = {};
    for (const [m, n] of Object.entries(this.relay.refusals)) if (n - (this.mark.refusals[m] ?? 0) > 0) refused[m] = n - (this.mark.refusals[m] ?? 0);
    this.mark.refusals = { ...this.relay.refusals };
    const trace = {};
    if (this.ctx.trace) {
      for (const b of this.bots) for (const [i, ss] of b.sessions.entries()) {
        const k = `${['cell', 'hub', 'region'][i]}:${ss.status}${ss.terminal ? '!' : ''}${ss.error ? `(${String(ss.error).slice(0, 40)})` : ''}${ss._retryAt != null ? `+${Math.round((ss._retryAt - Date.now()) / 1000)}s` : ''}`;
        trace[k] = (trace[k] ?? 0) + 1;
      }
    }
    return {
      mints: calls.filter(([, route]) => route === '/v1/auth/token').length,
      calls: calls.length,
      failed: calls.filter(([, , st]) => st === 'offline' || parseInt(st, 10) >= 500).length,
      back: this.bots.filter((b) => b.welcomedAt.has(b.cell)).length,
      refused, trace, callsAt: calls, refusedAt,
    };
  }
  /** Play ends: every session left, every clock stopped, the tallies handed back. */
  finish() {
    clearInterval(this.ticker);
    for (const b of this.bots) for (const ss of b.sessions) { try { ss.leave(); } catch { /* gone */ } }
    for (const b of this.bots) { b.heartbeat?.stop(); b.stopBeat?.(); }
    const r = this.relay;
    return {
      bots: this.bots.length,
      account: [...this.ctx.account.byRoute].map(([route, row]) => [route, row]),
      relay: { ...r, onWelcome: null, poseMs: r.poseMs.list, poseSeen: this.poseSeen },
    };
  }
}

/** A fleet in a worker thread of its own - the same six questions, asked by message. */
function remoteFleet(data) {
  const w = new Worker(new URL(import.meta.url), { workerData: { role: 'fleet', ...data } });
  let seq = 0;
  const waiting = new Map();
  w.on('message', (m) => { const f = waiting.get(m.id); if (f) { waiting.delete(m.id); m.error ? f.reject(new Error(m.error)) : f.resolve(m.r); } });
  w.on('error', (e) => { for (const f of waiting.values()) f.reject(e); waiting.clear(); });
  const ask = (t, ...args) => new Promise((resolve, reject) => { const id = ++seq; waiting.set(id, { resolve, reject }); w.postMessage({ id, t, args }); });
  return {
    setUp: () => ask('setUp'), connect: (ms) => ask('connect', ms), play: () => ask('play'), stormBegin: () => ask('stormBegin'),
    second: () => ask('second'), backTimes: () => ask('backTimes'), finish: async () => { const r = await ask('finish'); await w.terminate(); return r; },
    stop: () => w.terminate(),
  };
}

/** A uniform `take` of `list` (a partial Fisher-Yates over a copy). */
function sampleOf(list, take, rand) {
  const a = list.slice();
  const n = Math.min(take, a.length);
  for (let i = 0; i < n; i++) { const j = i + Math.floor(rand() * (a.length - i)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}

/** The fleet's tallies, merged: the account calls by route and the relay's counts, the pose ages' reservoirs pooled -
 *  AUDIT SCALE C9: each fleet's kept ages standing for the same number of heard poses, so a fleet that heard less weighs
 *  less in the percentiles (pooled as they were, a quiet fleet's ages counted as much as a crowded one's). */
export function mergeFleets(finals, rand = Math.random) {
  const account = accountTally();
  const relay = relayTally();
  let bots = 0, poseSeen = 0;
  for (const f of finals) {
    bots += f.bots;
    for (const [route, row] of f.account) {
      const m = account.byRoute.get(route) ?? { n: 0, statuses: {}, ms: [] };
      m.n += row.n;
      for (const [k, v] of Object.entries(row.statuses)) m.statuses[k] = (m.statuses[k] ?? 0) + v;
      for (const v of row.ms) m.ms.push(v);
      account.byRoute.set(route, m);
    }
    for (const k of ['opened', 'synthetic', 'inFrames', 'inBytes', 'outFrames', 'outBytes']) relay[k] += f.relay[k];
    for (const k of ['inByType', 'outByType', 'closes', 'refusals']) for (const [t, v] of Object.entries(f.relay[k])) relay[k][t] = (relay[k][t] ?? 0) + v;
    poseSeen += f.relay.poseSeen;
  }
  // the heaviest kept age's weight (poses heard a kept one stands for), and every fleet's sample cut to it
  const weight = Math.max(0, ...finals.map((f) => (f.relay.poseMs.length ? f.relay.poseSeen / f.relay.poseMs.length : 0)));
  for (const f of finals) {
    const take = weight > 0 ? Math.round(f.relay.poseSeen / weight) : 0;
    for (const v of sampleOf(f.relay.poseMs, take, rand)) relay.poseMs.push(v);   // a loop: a reservoir's hundred thousand would overrun a spread's arguments
  }
  return { bots, account, relay, poseSeen };
}

async function main(o) {
  const state = mkdtempSync(join(tmpdir(), 'scale3-load-'));
  const out = { knobs: o, started: new Date().toISOString() };
  const restore = { warn: console.warn, info: console.info };
  let fleets = [];
  // AUDIT SCALE C11: an interrupted run takes its state with it (the throwaway signing pair among it) - process.exit
  // skips the `finally` below
  const onSignal = () => {
    for (const f of fleets) f.stop?.();
    stopAll();
    if (!o.keep) { try { rmSync(state, { recursive: true, force: true }); } catch { /* gone */ } }
    process.exit(130);
  };
  process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal);
  try {
    const svc = await standServices(o, state);
    const runTag = Math.random().toString(36).slice(2, 6);
    const threads = Math.max(1, Math.min(o.threads, o.bots));
    for (let k = 0; k < threads; k++) {
      const data = { o, accountPort: svc.accountPort, relayPort: svc.relayPort, runTag, from: Math.floor((k * o.bots) / threads), to: Math.floor(((k + 1) * o.bots) / threads) };
      fleets.push(threads === 1 ? new Fleet(data) : remoteFleet(data));
    }
    console.log(`== setting up ${o.bots} bots in ${threads} fleet${threads > 1 ? 's, a thread each' : ''} (${o.setup} at once a fleet): guest, ${o.registered < 1 ? 'some ' : ''}registered, a realm character and its first save`);
    await Promise.all(fleets.map((f) => f.setUp()));
    console.log(`== connecting over ${o.ramp} s`);
    await Promise.all(fleets.map((f) => f.connect(o.ramp * 1000)));
    console.warn = () => {}; console.info = () => {};
    await sleep(5000);

    console.log(`== playing for ${o.minutes} min${o.scenario === 'storm' ? `, the relay restarted at ${Math.round(o['storm-at'] * 100)}%` : ''}`);
    await serviceStats(svc.accountPort);   // the setup's and the ramp's points and rows are not the play's - drained
    await Promise.all(fleets.map((f) => f.play()));
    const playStart = Date.now();
    const playMs = o.minutes * 60_000;
    await fireCron(svc.accountPort, FIRE_HOUR);
    const clockTimer = setInterval(() => { fireCron(svc.accountPort, FIRE_MINUTE); }, 60_000);
    const statsSum = { byRoute: new Map(), statements: new Map() };
    const fold = (s) => {
      for (const p of s.points) {
        const route = p.blobs?.[0] ?? '?';
        const row = statsSum.byRoute.get(route) ?? { n: 0, statements: 0 };
        row.n += 1; row.statements += Number(p.doubles?.[2] ?? 0);
        statsSum.byRoute.set(route, row);
      }
      for (const st of s.statements) {
        const row = statsSum.statements.get(st.sql) ?? { n: 0, rowsRead: 0, rowsWritten: 0 };
        row.n += st.n; row.rowsRead += st.rowsRead; row.rowsWritten += st.rowsWritten;
        statsSum.statements.set(st.sql, row);
      }
    };
    let storm = null;
    if (o.scenario === 'storm') {
      const stormAt = playStart + playMs * o['storm-at'];
      while (Date.now() < stormAt) { await sleep(Math.min(30_000, stormAt - Date.now())); fold(await serviceStats(svc.accountPort)); }
      storm = await theStorm(fleets, o.bots, svc, fold, playStart + playMs);
    }
    while (Date.now() < playStart + playMs) { await sleep(Math.min(30_000, playStart + playMs - Date.now())); fold(await serviceStats(svc.accountPort)); }
    const playedMs = Date.now() - playStart;
    clearInterval(clockTimer);
    const merged = mergeFleets(await Promise.all(fleets.map((f) => f.finish())));
    fleets = [];
    fold(await serviceStats(svc.accountPort));
    console.warn = restore.warn; console.info = restore.info;

    out.report = report({ bots: merged.bots, o, account: merged.account, relay: merged.relay, poseSeen: merged.poseSeen, statsSum, playedMs, storm, threads });
    if (o.json) writeFileSync(o.json, JSON.stringify(out, null, 2));
  } finally {
    console.warn = restore.warn; console.info = restore.info;
    for (const f of fleets) f.stop?.();
    stopAll();
    if (!o.keep) rmSync(state, { recursive: true, force: true });
    else console.log(`== the state is kept at ${state}`);
  }
  return out;
}

/** A DEPLOY: the relay's process killed - every socket in the game closes at once - and started again on the same state.
 *  Second by second until the run ends: the mints asked, the service's statements, the hellos refused, the bots back. */
/** THE STORM'S SECONDS (AUDIT SCALE C5), each by its own moment: `marks` - [ms, kind, n] the calls, mints, failures,
 *  statements and refusals as they happened; `back` - each bot's welcome into its own cell (ms or null). Row `t` holds
 *  what happened in the t-th second after `at`; `back` the bots in by its end. Answers the rows and the moments a share of
 *  `total` was back (seconds, a tenth's grain) - from the welcomes themselves, not from when a loop looked. */
export function stormSeconds(marks, back, at, total) {
  const rows = new Map();
  const row = (t) => {
    const k = Math.max(1, Math.ceil((t - at) / 1000));
    if (!rows.has(k)) rows.set(k, { t: k, mints: 0, calls: 0, failed: 0, statements: 0, back: 0, refused: {} });
    return rows.get(k);
  };
  for (const [t, kind, n = 1] of marks) {
    const r = row(t);
    if (kind === 'refused') r.refused[n] = (r.refused[n] ?? 0) + 1;
    else r[kind] += n;
  }
  const times = back.filter((t) => t != null && t >= at).map((t) => t - at).sort((a, b) => a - b);
  const last = Math.max(0, ...rows.keys(), ...times.map((ms) => Math.ceil(ms / 1000)));
  const out = [];
  for (let k = 1; k <= last; k++) {
    const r = rows.get(k) ?? { t: k, mints: 0, calls: 0, failed: 0, statements: 0, back: 0, refused: {} };
    r.back = times.filter((ms) => ms <= k * 1000).length;
    out.push(r);
  }
  const reached = {};
  for (const q of [0.25, 0.5, 0.9, 1]) {
    const need = Math.ceil(q * total);
    if (need >= 1 && times.length >= need) reached[q] = Math.round(times[need - 1] / 100) / 10;
  }
  return { seconds: out, reachedS: reached };
}

async function theStorm(fleets, total, svc, fold, endsAt) {
  console.log('== the storm: the relay restarted under the fleet');
  fold(await serviceStats(svc.accountPort));   // what came before the storm is the play's, not its first second's
  await Promise.all(fleets.map((f) => f.stormBegin()));
  const at = Date.now();
  const restarting = svc.restartRelay();
  let up = null;
  restarting.then((ok) => { up = ok ? Date.now() : -1; });
  /** @type {Array<[number, string, any]>} */
  const marks = [];
  let quiet = 0;
  while (Date.now() < endsAt) {
    await sleep(1000);
    const s = await serviceStats(svc.accountPort);
    fold(s);
    for (const p of s.points) marks.push([Number(p.t ?? Date.now()), 'statements', Number(p.doubles?.[2] ?? 0)]);
    const parts = await Promise.all(fleets.map((f) => f.second()));
    const trace = {};
    let mints = 0, back = 0;
    for (const p of parts) {
      for (const [t, route, st] of p.callsAt) {
        marks.push([t, 'calls', 1]);
        if (route === '/v1/auth/token') { marks.push([t, 'mints', 1]); mints++; }
        if (st === 'offline' || parseInt(st, 10) >= 500) marks.push([t, 'failed', 1]);
      }
      for (const [t, m] of p.refusedAt) marks.push([t, 'refused', m]);
      for (const [k, n] of Object.entries(p.trace)) trace[k] = (trace[k] ?? 0) + n;
      back += p.back;
    }
    if (Object.keys(trace).length) console.log(`   trace t+${Math.round((Date.now() - at) / 1000)}s ${JSON.stringify(trace)}`);
    quiet = mints === 0 ? quiet + 1 : 0;
    if (back >= total && quiet >= 3) break;
  }
  await restarting;
  const backs = (await Promise.all(fleets.map((f) => f.backTimes()))).flat();
  return { relayUpS: up > 0 ? Math.round((up - at) / 100) / 10 : null, ...stormSeconds(marks, backs, at, total) };
}

// ═══ THE REPORT ════════════════════════════════════════════════════════════════════════════════════════════════════

const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);
const r1 = (x) => (x == null ? '-' : Math.round(x * 10) / 10);

export function report({ bots, o, account, relay, poseSeen, statsSum, playedMs, storm, threads }) {
  const botHours = (bots * playedMs) / 3_600_000;
  const botSeconds = (bots * playedMs) / 1000;
  const routes = [...account.byRoute].map(([route, row]) => {
    const svc = statsSum.byRoute.get(route) ?? { n: 0, statements: 0 };
    return {
      route, requests: row.n, perBotHour: row.n / botHours, statuses: row.statuses,
      p50: percentile(row.ms, 0.5), p95: percentile(row.ms, 0.95),
      statementsPerRequest: svc.n ? svc.statements / svc.n : null, statementsPerBotHour: svc.statements / botHours,
    };
  }).sort((a, b) => b.statementsPerBotHour - a.statementsPerBotHour);
  for (const [route, svc] of statsSum.byRoute) {
    if (!route.startsWith('cron:')) continue;   // the service's own clock: no bot asked it, the database paid it
    routes.push({ route, requests: svc.n, perBotHour: svc.n / botHours, statuses: {}, p50: null, p95: null, statementsPerRequest: svc.n ? svc.statements / svc.n : null, statementsPerBotHour: svc.statements / botHours });
  }
  routes.sort((a, b) => b.statementsPerBotHour - a.statementsPerBotHour);
  const totals = routes.reduce((a, r) => ({ requests: a.requests + (r.route.startsWith('cron:') ? 0 : r.requests), statements: a.statements + r.statementsPerBotHour * botHours }), { requests: 0, statements: 0 });
  // AUDIT SCALE C2: the play's own, the deploy's mints apart - a storm folded into an hourly rate is a deploy every few
  // minutes, and standing play mints nothing (its token rides a connect's every room)
  const mints = routes.find((r) => r.route === '/v1/auth/token');
  const play = { requests: totals.requests - (mints?.requests ?? 0), statements: totals.statements - (mints ? mints.statementsPerBotHour * botHours : 0) };
  // AUDIT SCALE C2: the fleet the figures are of
  const fleet = { bots, threads, ...Object.fromEntries(['mover', 'fighter', 'registered'].map((k) => [`${k}s`, Array.from({ length: bots }, (_, n) => rolesOf(n, o)[k]).filter(Boolean).length])) };
  const statements = [...statsSum.statements].map(([sql, s]) => ({ sql, ...s, rowsReadPerBotHour: s.rowsRead / botHours }))
    .sort((a, b) => b.rowsRead - a.rowsRead);
  const rows = statements.reduce((a, s) => ({ read: a.read + s.rowsRead, written: a.written + s.rowsWritten }), { read: 0, written: 0 });

  console.log(`\n== THE ACCOUNT SERVICE - ${bots} bots, ${r1(playedMs / 60_000)} min of play (${r1(botHours)} bot-hours)`);
  console.log(`${pad('route', 30)}${lpad('req', 7)}${lpad('/bot-h', 9)}${lpad('p50', 7)}${lpad('p95', 7)}${lpad('stmt/req', 10)}${lpad('stmt/bot-h', 12)}  statuses`);
  for (const r of routes) {
    console.log(`${pad(r.route, 30)}${lpad(r.requests, 7)}${lpad(r1(r.perBotHour), 9)}${lpad(r.p50 ?? '-', 7)}${lpad(r.p95 ?? '-', 7)}${lpad(r1(r.statementsPerRequest), 10)}${lpad(r1(r.statementsPerBotHour), 12)}  ${JSON.stringify(r.statuses)}`);
  }
  console.log(`${pad('every route', 30)}${lpad(totals.requests, 7)}${lpad(r1(totals.requests / botHours), 9)}${lpad('', 14)}${lpad('', 10)}${lpad(r1(totals.statements / botHours), 12)}`);
  console.log(`${pad('  the play (no mints)', 30)}${lpad(play.requests, 7)}${lpad(r1(play.requests / botHours), 9)}${lpad('', 14)}${lpad('', 10)}${lpad(r1(play.statements / botHours), 12)}`);
  console.log(`the fleet: ${JSON.stringify(fleet)}; the service's clock: its minute every minute of play, its hour once as play began`);
  console.log(`\nD1 rows a bot-hour: ${r1(rows.read / botHours)} read, ${r1(rows.written / botHours)} written. The ten statements reading the most:`);
  for (const s of statements.slice(0, 10)) console.log(`  ${lpad(r1(s.rowsReadPerBotHour), 9)} rows/bot-h  ${lpad(s.n, 6)}x  ${s.sql.slice(0, 110)}`);

  console.log(`\n== THE RELAY, at the bots - ${r1(botSeconds)} bot-seconds, the fleet in ${threads} thread${threads > 1 ? 's' : ''}`);
  console.log(`frames a bot-second: ${r1(relay.inFrames / botSeconds)} in, ${r1(relay.outFrames / botSeconds)} out; bytes a bot-second: ${r1(relay.inBytes / botSeconds)} in, ${r1(relay.outBytes / botSeconds)} out`);
  console.log(`in by type:  ${JSON.stringify(relay.inByType)}`);
  console.log(`out by type: ${JSON.stringify(relay.outByType)}`);
  console.log(`a pose, sender to listener: p50 ${percentile(relay.poseMs, 0.5) ?? '-'} ms, p95 ${percentile(relay.poseMs, 0.95) ?? '-'} ms, p99 ${percentile(relay.poseMs, 0.99) ?? '-'} ms (${poseSeen} heard, ${relay.poseMs.length} kept)`);
  console.log(`closes by code: ${JSON.stringify(relay.closes)}; refusals: ${JSON.stringify(relay.refusals)}`);

  if (storm) {
    console.log(`\n== THE STORM - the relay answered again ${storm.relayUpS ?? '-'} s after it went down`);
    console.log(`bots back in their cell: a quarter ${storm.reachedS[0.25] ?? '-'} s, half ${storm.reachedS[0.5] ?? '-'} s, nine in ten ${storm.reachedS[0.9] ?? '-'} s, every one ${storm.reachedS[1] ?? 'never, in the run'} s`);
    console.log(`${lpad('t', 4)}${lpad('mints', 7)}${lpad('calls', 7)}${lpad('failed', 8)}${lpad('stmts', 7)}${lpad('back', 6)}  refused`);
    for (const s of storm.seconds) console.log(`${lpad(s.t, 4)}${lpad(s.mints, 7)}${lpad(s.calls, 7)}${lpad(s.failed, 8)}${lpad(s.statements, 7)}${lpad(s.back, 6)}  ${JSON.stringify(s.refused)}`);
  }
  return {
    botHours, botSeconds, routes, fleet, play: { requestsPerBotHour: play.requests / botHours, statementsPerBotHour: play.statements / botHours },
    totals: { requestsPerBotHour: totals.requests / botHours, statementsPerBotHour: totals.statements / botHours, rowsReadPerBotHour: rows.read / botHours, rowsWrittenPerBotHour: rows.written / botHours },
    statements: statements.slice(0, 40),
    relay: { framesInPerBotSecond: relay.inFrames / botSeconds, framesOutPerBotSecond: relay.outFrames / botSeconds, bytesInPerBotSecond: relay.inBytes / botSeconds, bytesOutPerBotSecond: relay.outBytes / botSeconds, inByType: relay.inByType, outByType: relay.outByType, poseMs: { p50: percentile(relay.poseMs, 0.5), p95: percentile(relay.poseMs, 0.95), p99: percentile(relay.poseMs, 0.99), n: relay.poseMs.length }, closes: relay.closes, refusals: relay.refusals },
    storm,
  };
}

// A FLEET'S THREAD: the six questions, answered as they come
if (!isMainThread && workerData?.role === 'fleet') {
  const fleet = new Fleet(workerData);
  parentPort.on('message', async (m) => {
    try { parentPort.postMessage({ id: m.id, r: await fleet[m.t](...(m.args ?? [])) }); }
    catch (e) { parentPort.postMessage({ id: m.id, error: String(e?.stack ?? e) }); }
  });
}

if (isMainThread && isMain(import.meta.url)) {
  let o;
  try { o = parseArgs(process.argv.slice(2)); } catch (e) { console.error(String(e?.message ?? e)); process.exit(2); }
  if (o.help) {
    console.log('node tools/loadHarness.mjs [--knob value]...\n');
    for (const [k, [v, what]] of Object.entries(KNOBS)) console.log(`  --${pad(k, 12)} ${pad(JSON.stringify(v), 10)} ${what}`);
    process.exit(0);
  }
  main(o).then(() => process.exit(0), (e) => { console.error(`\nthe load run failed: ${e?.stack ?? e}`); stopAll(); process.exit(1); });
}
