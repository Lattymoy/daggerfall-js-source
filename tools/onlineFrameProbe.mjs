// PERF-ON4 (2026-10-09, Mac: "I want to continue working to increase performance across the board, especially for
// online"): THE ONLINE FRAME PROBE - the REAL game online, in headless Chromium over the freeware ARENA2, joined to the
// REAL relay and the REAL account service in local workerd (tools/loadHarness.mjs's own two services), with a crowd of
// bots round the player - each bot the client's own OnlineSession, as the harness's fleet is. PERF-NEXT measured online
// in node, over the modules (bible/07-Rendering/Performance-Next.md "Online, measured"); this measures the frame a player
// online pays, through the frame probe's own three windows (tools/frameProbe.mjs measure): the census of every WebGL
// call, the CPU profile by sample count, and the sampled heap.
//
//   ARENA2_PATH=/path/to/arena2 node tools/onlineFrameProbe.mjs            crowds of 0, 20, 60 and 0 again
//   PEERS=0,40 CHAT=1 ...                                                   the crowds, in order (a smaller one after a
//                                                                           larger sends the extra bots away); CHAT=1 opens
//                                                                           the chat's World tab
//   TREE / TAG / OUT / FRAMES / W / H / PORT / JSFLAGS                      as tools/frameProbe.mjs - but TREE= swaps the
//                                                                           PAGE alone: the relay, the account service and
//                                                                           the bots' client are this tree's (an A/B of a
//                                                                           client change, never of a relay or wire one)
//   WAYS_FRAMES=1500                                                        the most frames the settle waits on the Living
//                                                                           World's way book (below)
//   SVC_PORT=8870                                                           the account service (the relay on the next port)
//   SAVE=<file>                                                             the first save's text: read when the file is there,
//                                                                           written when it is not (a rerun skips the offline boot)
//
// THE STEPS. The services stood up as the harness stands them (a throwaway signing pair, every migration, both Workers).
// The player's guest account, and its realm character, whose first save is the one an offline boot at Knightstale
// composes (the world host's own composer, through a probe-only hook). Then the online boot - `?world&online&realm=<id>
// &load&server=ws://127.0.0.1:<relay>`, the account's session in the page's storage - and, crowd by crowd, the bots
// joined in the player's cell and stood round the pose the relay hears from the player (within 4-28 m, seven in ten
// walking a small ring), settled, and measured. Every wait is frame-synced on the shot-mode `__frame` counter.
//
// AUDIT PERF-ON4 F2/F3: THE SETTLE. Before the first crowd the page settles as the frame probe's scenes do (the grass,
// tools/frameProbe.mjs settle) AND until the Living World's way book stops growing (WAYS_FRAMES at most) - a probe that
// measured fifty frames after the boot measured the ways' filling, and crowd size with time since the boot. A crowd is
// measured when the session is open and draws every bot; one that does not is measured, said, and fails the run. The
// default's last crowd is 0 again: the drift between the first and the last is the run's own noise floor.
//
// Three probe-only transforms beside the frame probe's own, the tree untouched: the account base may be the local service
// (net/accountClient.js serviceBase answers an https base alone); `?shot` survives the online boot (REALM P0.1 refuses
// it there - systems/onlineLane.js ONLINE_REFUSED_FLAGS - because it installs the probe seams, which are the instrument
// here: `__frame`, `__shotReady`); and the composer's hook (`__probeSaveText`, with `__onlinePeers`, the peers the
// session draws, its status and the way book's size - `__probeOnline`). `?tod` is still refused online, so the sky is the shared clock's: an A/B's two arms stand at
// different hours, and an online A/B is read by its counts and its own functions, not by the frame's total.
//
// WHAT IT IS NOT. The services, the fleet and SwiftShader share this machine; the milliseconds are relative, an A/B's
// arms are run one after the other (TREE=), and nothing else runs while they do - tools/frameProbe.mjs's rule. Not in
// the suite (a toolchain and minutes, tools/loadHarness.mjs's reason); its record is Performance-Online.md (PERF-ON4).
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { probeTransforms, editsPlugin, waitFrames, settle, measure, measured, summaryLine, CENSUS, SWIFTSHADER_ARGS } from './frameProbe.mjs';
import { isMain } from './lib/isMain.mjs';
import { standServices, stopAll, makeBot, setUp, localFetch, localWebSocket, relayTally, botStorage, LOAD_SERVICE } from './loadHarness.mjs';
import { OnlineSession } from '../src/net/online.js';
import { SESSION_KEY, SERVICE_KEY } from '../src/net/accountClient.js';
import { realmIo, realmCreate, createRealmSession } from '../src/systems/realmSaves.js';
import { worldRoom, CHAT_WORLD_ROOM, PIXEL_UNITS } from '../src/net/wire.js';
import { PIXEL_M } from '../src/net/gateLaw.js';
import { ACCEPTED } from '../src/net/legalLaw.js';

const ROOT = process.env.TREE || fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || 5241);
const SVC_PORT = Number(process.env.SVC_PORT || 8870);
const W = Number(process.env.W || 480), H = Number(process.env.H || 270);
const CHAT = process.env.CHAT === '1';
const WAYS_FRAMES = Number(process.env.WAYS_FRAMES || 1500);
/** World units a metre (a map pixel's units over its metres: 40, DFU's MeshReader.GlobalScale's 0.025). */
const UNITS_M = PIXEL_UNITS / PIXEL_M;
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
/** The crowds, in the order measured (read by main, never at import - AUDIT PERF-ON4 F6). */
export function crowdsOf(env = process.env.PEERS) {
  const peers = (env || '0,20,60,0').split(',').map(Number);
  if (!peers.length || !peers.every((n) => Number.isSafeInteger(n) && n >= 0)) throw new Error(`PEERS is a list of crowd sizes, not ${env}`);
  const seen = new Map();
  return peers.map((n) => { const k = seen.get(n) ?? 0; seen.set(n, k + 1); return { crowd: n, name: `online${n}${k ? String.fromCharCode(97 + k) : ''}${CHAT ? 'chat' : ''}` }; });
}
/** The run's state directory - its signing pair among it until the account service answers - for the signal's cleanup too. */
let stateDir = null;
const dropState = () => { if (stateDir) { try { rmSync(stateDir, { recursive: true, force: true }); } catch { /* gone */ } stateDir = null; } };

/** The edits this probe makes beside the frame probe's (FRAME_PROBE_EDITS' shape: each needle asserted, and held to the
 *  tree by test/perfon4_probes.test.js). */
export const ONLINE_PROBE_EDITS = Object.freeze([
  // the account base may be the local service - serviceBase answers an https base alone
  { file: 'src/net/accountClient.js', edits: [["/^https:\\/\\/\\S+$/.test(v)", "/^(https:\\/\\/\\S+|http:\\/\\/127\\.0\\.0\\.1:\\d+)$/.test(v)"]] },
  // REALM P0.1 drops `?shot` from an online boot - it installs the probe seams, `__addGold` among them, which no player's
  // world may carry. Here the world is this run's own, local, and the seams are the instrument
  { file: 'src/systems/onlineLane.js', edits: [["export const ONLINE_REFUSED_FLAGS = Object.freeze(['shot', ", 'export const ONLINE_REFUSED_FLAGS = Object.freeze([']] },
  // the composer's hook, and the peers the session draws
  { file: 'src/scenes/world.js', edits: [['    window.__quickSave = (name) => modes.quickSaveNow(name);', `    window.__quickSave = (name) => modes.quickSaveNow(name);
    window.__probeSaveText = () => { let t = null; modes.quickSaveNow('probe', { quiet: true, sink: (s) => { t = JSON.stringify(s); } }); return t; };
    window.__probeOnline = () => ({ peers: online ? online.drawable().length : null, status: online ? online.status : null, ways: livingWays.size, frame: window.__frame | 0 });`]] },
]);

/** The page's server's transforms: the frame probe's and this probe's own (exported for test/perfon4_probes.test.js). */
export const probePlugins = () => [probeTransforms(), editsPlugin('online-probe-transforms', ONLINE_PROBE_EDITS)];

/** The bots' knobs, as tools/loadHarness.mjs makeBot reads them: guests (no registration), seven in ten walking. */
const BOT_O = Object.freeze({ cells: 1, edge: 0, movers: 0.7, fighters: 0, registered: 0, setup: 8 });

/** A bot's pose round `at` (the player's pose as the relay hears it): its own spot 4-28 m out, a walker on a 2 m ring. */
function botPose(bot, at, t) {
  const a0 = bot.n * 2.399963229728653;   // the golden angle: spots spread evenly round the player
  const r = (4 + (bot.n % 7) * 4) * UNITS_M;
  const cx = at.x + Math.cos(a0) * r, cz = at.z + Math.sin(a0) * r;
  const a = bot.phase + (bot.mover ? t * bot.speed : 0);
  const ring = bot.mover ? 2 * UNITS_M : 0;
  return { x: cx + Math.cos(a) * ring, y: at.y, z: cz + Math.sin(a) * ring, yaw: a + Math.PI / 2, pitch: 0, mv: bot.mover ? 1 : 0 };
}

async function main() {
  const CROWDS = crowdsOf();
  const state = stateDir = mkdtempSync(join(tmpdir(), 'online-frame-probe-'));
  const restore = { warn: console.warn, info: console.info };
  let server = null, browser = null, ticker = null;
  const bots = [];
  const failed = [];
  try {
    // the page's server first: a port already held says so before the services take minutes to stand (AUDIT PERF-ON4 F11)
    server = await createServer({ root: ROOT, configFile: `${ROOT}/vite.config.js`, plugins: probePlugins(), server: { port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
    await server.listen();
    const svc = await standServices({ port: SVC_PORT }, state);
    const runTag = Math.random().toString(36).slice(2, 6);
    const io0 = { fetch: localFetch({ port: svc.accountPort, ip: '10.9.9.9' }), base: LOAD_SERVICE };

    console.log('== the player: a guest, and a realm character');
    const made = await io0.fetch(`${LOAD_SERVICE}/v1/auth/guest`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label: 'probe', ...ACCEPTED }),
    }).then((r) => r.json());
    if (!made?.secret) throw new Error(`no guest for the player (${JSON.stringify(made)})`);
    const playerStorage = botStorage({ [SESSION_KEY]: JSON.stringify({ secret: made.secret, id: made.id, name: made.name }), [SERVICE_KEY]: LOAD_SERVICE });
    const pio = realmIo({ fetch: io0.fetch, storage: playerStorage });
    browser = await chromium.launch({ args: SWIFTSHADER_ARGS });

    let saveText = process.env.SAVE && existsSync(process.env.SAVE) ? readFileSync(process.env.SAVE, 'utf8') : null;
    if (saveText) console.log(`== the first save: ${process.env.SAVE}`);
    else {
      console.log('== the first save: an offline boot at Knightstale, composed by the world host');
      const ctx = await browser.newContext({ viewport: { width: W, height: H } });
      const page = await ctx.newPage();
      await page.goto(`http://localhost:${PORT}/play/?world&region=Wayrest&loc=Knightstale&class=1&novideo&shot&play&tod=15:00`);
      await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 1200000, polling: 500 });
      await waitFrames(page, 3);
      saveText = await page.evaluate(() => window.__probeSaveText());
      await ctx.close();
      if (saveText && process.env.SAVE) writeFileSync(process.env.SAVE, saveText);
    }
    if (!saveText) throw new Error('the world host composed no save');
    const c = await realmCreate(pio, made.name || 'Probe', null);
    if (!c.ok) throw new Error(`no realm character (${c.error})`);
    const rs = createRealmSession({ io: pio, id: c.data.id, lease: c.data.lease, seq: c.data.seq ?? 0, gzip: c.data.gzip === true, hidden: () => false, watchHidden: () => {} });
    const first = await rs.checkpoint(saveText);
    if (!first?.ok) throw new Error(`the first save did not land (${first?.error})`);
    console.log(`   realm ${c.data.id}, ${(saveText.length / 1024).toFixed(0)} KB of save`);

    console.log('== the online boot');
    const ctx = await browser.newContext({ viewport: { width: W, height: H } });
    await ctx.addInitScript(({ sk, sv, sess, base }) => {
      try { localStorage.setItem(sk, sess); localStorage.setItem(sv, base); } catch { /* a page without storage reads none */ }
    }, { sk: SESSION_KEY, sv: SERVICE_KEY, sess: JSON.stringify({ secret: made.secret, id: made.id, name: made.name }), base: `http://127.0.0.1:${svc.accountPort}` });
    await ctx.addInitScript(CENSUS);
    const page = await ctx.newPage();
    // AUDIT PERF-ON4 F8: a page's errors are the window's they fell in - the boot's apart, each crowd's its own
    const bootErrors = [];
    let errors = bootErrors;
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (/\[(realm|online|account|chat)\]/.test(m.text())) console.log(`   page ${m.type()}: ${m.text().slice(0, 240)}`); });
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_CERT|WebSocket/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    const url = `/play/?world&online&realm=${c.data.id}&load&server=ws://127.0.0.1:${svc.relayPort}&novideo&shot&play&fps&tod=15:00`;
    const t0 = Date.now();
    await page.goto(`http://localhost:${PORT}${url}`);
    // where the boot stands, every half minute until it is ready - an online boot refused goes to the title, never ready
    for (let i = 0; !(await page.evaluate(() => window.__shotReady === true)); i++) {
      if (i >= 40) throw new Error('the online boot never readied in 20 minutes');
      await sleep(30000);
      const at = await page.evaluate(() => ({ href: location.href.replace(/^.*\/play\//, ''), text: (document.body?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 160), frame: window.__frame | 0 })).catch((e) => ({ error: e.message }));
      console.log(`   booting (${(i + 1) * 30}s): ${JSON.stringify(at)}`);
    }
    const bootS = (Date.now() - t0) / 1000;
    const probe = () => page.evaluate(() => (window.__probeOnline ? window.__probeOnline() : null)).catch((e) => ({ error: e.message }));
    console.log(`   ready after ${bootS.toFixed(0)}s: ${JSON.stringify(await probe())}`);
    if (bootErrors.length) { console.log(`   the boot's errors: ${bootErrors.slice(0, 5).join(' | ')}`); failed.push(`the boot (${bootErrors[0]})`); }
    const [px, py] = (await page.evaluate(() => window.__currentPixel())).split(',').map(Number);
    const cell = worldRoom(px, py);
    // AUDIT PERF-ON4 F3: settled before the first crowd - the grass, then the way book standing still over 30 frames
    await settle(page);
    let ways = -1, still = 0, waysFrames = 0;
    for (; waysFrames < WAYS_FRAMES && still < 3; waysFrames += 10) {
      await waitFrames(page, 10);
      const w = (await probe())?.ways ?? -2;
      if (w === ways) still++; else still = 0;
      ways = w;
    }
    console.log(`   settled: ${JSON.stringify(await probe())}${still < 3 ? ` - the way book still growing after ${WAYS_FRAMES} frames` : ''}`);
    if (CHAT) await page.keyboard.press('Enter').catch(() => {});

    // the fleet: set up all at once (guests, realm characters), joined crowd by crowd
    const most = Math.max(...CROWDS.map((c) => c.crowd));
    const fleetCtx = { svc: { accountPort: svc.accountPort }, runTag, account: { byRoute: new Map(), at: [] } };
    for (let n = 0; n < most; n++) bots.push(makeBot(n, BOT_O, fleetCtx));
    console.log(`== setting up ${most} bots`);
    for (let i = 0; i < bots.length; i += BOT_O.setup) await Promise.all(bots.slice(i, i + BOT_O.setup).map((b) => setUp(b, BOT_O)));
    const tally = relayTally();
    const WS = localWebSocket({ port: svc.relayPort, tally });
    const relayUrl = `ws://127.0.0.1:${svc.relayPort}`;
    const botIds = new Set(bots.map((b) => b.id));
    let at = null;   // the player's pose as the relay hears it
    const tStart = Date.now();
    const connect = (bot) => {
      const presence = new OnlineSession({ url: relayUrl, name: bot.account.name, look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] }, id: bot.id, secret: bot.secret, mintToken: bot.minter, WebSocketImpl: WS });
      presence.join(cell, at ? botPose(bot, at, 0) : null);
      const hub = new OnlineSession({ url: relayUrl, name: bot.account.name, look: null, id: bot.id, secret: bot.secret, presence: false, mintToken: bot.minter, WebSocketImpl: WS });
      hub.join(CHAT_WORLD_ROOM);
      hub.acct = bot.acct; hub.asecret = bot.asecret; hub.claim = true;
      bot.presence = presence;
      bot.sessions = [presence, hub];
    };
    const sendAway = (bot) => { for (const s of bot.sessions ?? []) { try { s.leave(); } catch { /* gone */ } } bot.presence = null; bot.sessions = null; };
    console.warn = () => {}; console.info = () => {};   // the sessions' own chatter, not the run's
    ticker = setInterval(() => {
      const t = (Date.now() - tStart) / 1000;
      for (const b of bots) {
        if (!b.presence) continue;
        if (at) b.presence.sendPose(botPose(b, at, t));
        for (const s of b.sessions) s.tick();
      }
    }, 50);
    ticker.unref?.();

    let joined = 0;
    for (const { crowd, name } of CROWDS) {
      while (joined > crowd) sendAway(bots[--joined]);   // a smaller crowd after a larger: the last in leave first
      while (joined < crowd) {
        connect(bots[joined]);
        joined += 1;
        // the player's pose, heard by the first bot in, places every bot after it
        if (!at) {
          for (let i = 0; i < 600 && !at; i++) {
            await sleep(100);
            const peer = [...bots[0].presence.peers.values()].find((p) => !botIds.has(p.id) && p.pose);
            if (peer) at = { x: peer.pose.x, y: peer.pose.y, z: peer.pose.z };
          }
          if (!at) throw new Error(`the relay never told a bot of the player in ${cell}`);
        }
        await sleep(200);   // a ramp: the relay's hello door is per room
      }
      // AUDIT PERF-ON4 F2: settled when the session is open and draws exactly the crowd (a peer that left is undrawn by
      // the silence law, PEER_TIMEOUT_MS on) - and a crowd that never got there is measured, said, and fails the run
      let o = null;
      for (let i = 0; i < 300; i++) {
        o = await probe();
        if (o?.status === 'open' && o.peers === crowd) break;
        await sleep(500);
      }
      await waitFrames(page, 30);
      console.warn = restore.warn; console.info = restore.info;
      errors = [];
      // the census wraps the page's WebGL and DOM doors, and measure() takes the wrappers off after its window: put them
      // on again for each crowd (the last crowd's off first, so nothing is wrapped twice)
      await page.evaluate(`window.__censusOff?.(); ${CENSUS}`);
      const r = await measure(ctx, page, { name, url, bootS, errors, extra: () => probe() });
      const ready = o?.status === 'open' && o.peers === crowd;
      console.log(`== ${name}: ${summaryLine(r)}, peers ${r.extra?.peers ?? '?'} of ${crowd} (${r.extra?.status ?? '?'}), ways ${r.extra?.ways ?? '?'}`);
      if (!measured(r)) failed.push(`${name} (${r.errors[0] ?? 'an empty window'})`);
      if (!ready) failed.push(`${name} (${o?.peers ?? 'no'} peers of ${crowd} drawn, the session ${o?.status ?? o?.error ?? 'unread'})`);
      console.warn = () => {}; console.info = () => {};
    }
    await ctx.close();
  } finally {
    // AUDIT PERF-ON4 F9: every step runs whatever the one before it threw
    console.warn = restore.warn; console.info = restore.info;
    if (ticker) clearInterval(ticker);
    for (const b of bots) for (const s of b.sessions ?? []) { try { s.leave(); } catch { /* gone */ } }
    try { await browser?.close(); } catch { /* gone */ }
    try { await server?.close(); } catch { /* gone */ }
    try { stopAll(); } finally { dropState(); }
  }
  if (failed.length) throw new Error(`onlineFrameProbe: no measurement for ${failed.join('; ')}`);
}

if (isMain(import.meta.url)) {
  // never an orphaned workerd holding the ports, and never the run's state left behind - its signing pair among it until
  // the account service answers (AUDIT PERF-ON4 F1: tools/loadHarness.mjs's onSignal, AUDIT SCALE C11's)
  for (const [sig, code] of [['SIGINT', 130], ['SIGTERM', 143]]) process.on(sig, () => { try { stopAll(); } finally { dropState(); process.exit(code); } });
  main().then(() => process.exit(0), (e) => { console.error(`\nthe online probe failed: ${e?.stack ?? e}`); try { stopAll(); } finally { dropState(); process.exit(1); } });
}
