// PERF-ON4 (2026-10-09, Mac: "I want to continue working to increase performance across the board, especially for
// online"): THE ONLINE FRAME PROBE - the REAL game online, in headless Chromium over the freeware ARENA2, joined to the
// REAL relay and the REAL account service in local workerd (tools/loadHarness.mjs's own two services), with a crowd of
// bots round the player - each bot the client's own OnlineSession, as the harness's fleet is. PERF-NEXT measured online
// in node, over the modules (bible/07-Rendering/Performance-Next.md "Online, measured"); this measures the frame a player
// online pays, through the frame probe's own three windows (tools/frameProbe.mjs measure): the census of every WebGL
// call, the CPU profile by sample count, and the sampled heap.
//
//   ARENA2_PATH=/path/to/arena2 node tools/onlineFrameProbe.mjs            crowds of 0, 20 and 60
//   PEERS=0,40 CHAT=1 ...                                                   the crowds; CHAT=1 opens the chat's World tab
//   TREE / TAG / OUT / FRAMES / W / H / PORT / JSFLAGS                      as tools/frameProbe.mjs
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
// Three probe-only transforms beside the frame probe's own, the tree untouched: the account base may be the local service
// (net/accountClient.js serviceBase answers an https base alone); `?shot` survives the online boot (REALM P0.1 refuses
// it there - systems/onlineLane.js ONLINE_REFUSED_FLAGS - because it installs the probe seams, which are the instrument
// here: `__frame`, `__shotReady`); and the composer's hook (`__probeSaveText`, with `__onlinePeers`, the peers the
// session draws). `?tod` is still refused online, so the sky is the shared clock's: an A/B's two arms stand at
// different hours, and an online A/B is read by its counts and its own functions, not by the frame's total.
//
// WHAT IT IS NOT. The services, the fleet and SwiftShader share this machine; the milliseconds are relative, an A/B's
// arms are run one after the other (TREE=), and nothing else runs while they do - tools/frameProbe.mjs's rule. Not in
// the suite (a toolchain and minutes, tools/loadHarness.mjs's reason); its record is Performance-Next.md's PERF-ON4.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { probeTransforms, editsPlugin, waitFrames, measure, measured, summaryLine, CENSUS, SWIFTSHADER_ARGS } from './frameProbe.mjs';
import { isMain } from './lib/isMain.mjs';
import { standServices, stopAll, makeBot, setUp, localFetch, localWebSocket, relayTally, botStorage, LOAD_SERVICE } from './loadHarness.mjs';
import { OnlineSession } from '../src/net/online.js';
import { SESSION_KEY, SERVICE_KEY } from '../src/net/accountClient.js';
import { realmIo, realmCreate, createRealmSession } from '../src/systems/realmSaves.js';
import { worldRoom, CHAT_WORLD_ROOM } from '../src/net/wire.js';
import { ACCEPTED } from '../src/net/legalLaw.js';

const ROOT = process.env.TREE || fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || 5241);
const SVC_PORT = Number(process.env.SVC_PORT || 8870);
const W = Number(process.env.W || 480), H = Number(process.env.H || 270);
const PEERS = (process.env.PEERS || '0,20,60').split(',').map(Number);
const CHAT = process.env.CHAT === '1';
/** World units a metre (DFU's MeshReader.GlobalScale, 0.025). */
const UNITS_M = 40;
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

if (!PEERS.every((n) => Number.isSafeInteger(n) && n >= 0)) throw new Error(`PEERS is a list of crowd sizes, not ${process.env.PEERS}`);

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
    window.__onlinePeers = () => (online ? online.drawable().length : null);`]] },
]);

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
  const state = mkdtempSync(join(tmpdir(), 'online-frame-probe-'));
  const restore = { warn: console.warn, info: console.info };
  let server = null, browser = null, ticker = null;
  const bots = [];
  const failed = [];
  try {
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

    server = await createServer({ root: ROOT, configFile: `${ROOT}/vite.config.js`, plugins: [probeTransforms(), editsPlugin('online-probe-transforms', ONLINE_PROBE_EDITS)], server: { port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
    await server.listen();
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
    const errors = [];
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
    console.log(`   ready after ${bootS.toFixed(0)}s`);
    const [px, py] = (await page.evaluate(() => window.__currentPixel())).split(',').map(Number);
    const cell = worldRoom(px, py);
    await waitFrames(page, 20);
    if (CHAT) await page.keyboard.press('Enter').catch(() => {});

    // the fleet: set up all at once (guests, realm characters), joined crowd by crowd
    const most = Math.max(...PEERS);
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
    for (const crowd of [...PEERS].sort((a, b) => a - b)) {
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
      // settled: every bot welcomed and heard, and the page's frames past the arrivals
      for (let i = 0; i < 300; i++) {
        const drawn = await page.evaluate(() => (window.__onlinePeers ? window.__onlinePeers() : null)).catch(() => null);
        if (drawn == null || drawn >= crowd) break;
        await sleep(500);
      }
      await waitFrames(page, 30);
      console.warn = restore.warn; console.info = restore.info;
      const name = `online${crowd}${CHAT ? 'chat' : ''}`;
      // the census wraps the page's WebGL and DOM doors, and measure() takes the wrappers off after its window: put them
      // on again for each crowd (the last crowd's off first, so nothing is wrapped twice)
      await page.evaluate(`window.__censusOff?.(); ${CENSUS}`);
      const r = await measure(ctx, page, { name, url, bootS, errors, extra: () => page.evaluate(() => ({ peers: window.__onlinePeers?.() ?? null })) });
      console.log(`== ${name}: ${summaryLine(r)}`);
      if (!measured(r)) failed.push(`${name} (${r.errors[0] ?? 'an empty window'})`);
      console.warn = () => {}; console.info = () => {};
    }
    await ctx.close();
  } finally {
    console.warn = restore.warn; console.info = restore.info;
    if (ticker) clearInterval(ticker);
    for (const b of bots) for (const s of b.sessions ?? []) { try { s.leave(); } catch { /* gone */ } }
    await browser?.close();
    await server?.close();
    stopAll();
    rmSync(state, { recursive: true, force: true });
  }
  if (failed.length) throw new Error(`onlineFrameProbe: no measurement for ${failed.join('; ')}`);
}

if (isMain(import.meta.url)) {
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { stopAll(); process.exit(130); });   // never an orphaned workerd holding the ports
  main().then(() => process.exit(0), (e) => { console.error(`\nthe online probe failed: ${e?.stack ?? e}`); stopAll(); process.exit(1); });
}
