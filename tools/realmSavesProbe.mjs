#!/usr/bin/env node
// THE REALM'S SAVES, PLAYED ON TWO DEVICES (bible/06-Systems/Realm-Arc.md: SEAT-SAVES, SAVES-SAID, STRANDED, and the
// Roll's never-heard standing). The real game in Edge against the REAL relay and the REAL account service in local
// workerd (tools/loadHarness.mjs standServices). A "device" is a browser context: its own storage, the account signed
// in. Each guest's realm character starts from the classic start's save, composed by the world host offline (as
// tools/partyLootProbe.mjs makes it). The probe's hooks are source edits served by Vite (REALM_SAVES_PROBE_EDITS), so
// the same probe plays any tree that has their needles (TREE=<a checkout>: the page's tree; the services are this one's).
//
//   (a) Device B joins A's character while device A plays it: A loses the seat, is refused `lease` and goes to the door
//       within one checkpoint period; B's save lands; A's device copy is set aside at A's next join, or dropped.
//   (b) Another account in the same browser takes the seat from A: A's saves still land.
//   (c) A is killed (its renderer crashed) with a put out: the rejoin plays the device's copy at the matching seq.
//   (d) A drops a valuable piece and B picks it up, and A dies before its periodic save. Driven through the realm
//       sessions the game uses (systems/realmSaves.js), not the game's hands: A's record keeps the piece, B's save shows
//       it, A rejoins and saves it after the ledger's grace (server-account/src/ledger.js DUPE_GRACE_S).
//   (e) The put route is blocked past two checkpoint periods: what the HUD says, and when, then the puts recover.
//   (f) The Roll is stopped on device A, A earns standing, and device B joins: after a claim whose save never landed,
//       does B keep what A earned?
//
//   ARENA2_PATH=/path/to/arena2 PW_CHANNEL=msedge node tools/realmSavesProbe.mjs     ONLY=a,b,c,d,e,f,g,h (default all);
//                                                                                     TREE=<dir>; PORT / SVC_PORT
// Not in the suite (a toolchain and an hour); the laws it plays are pinned in test/net/rollUnheard.test.js,
// test/systems/online/*.test.js and test/server/rescuesave.test.js.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { probeTransforms, editsPlugin, waitFrames } from './frameProbe.mjs';
import { ONLINE_PROBE_EDITS } from './onlineFrameProbe.mjs';
import { isMain } from './lib/isMain.mjs';
import { standServices, stopAll, localFetch, botStorage, LOAD_SERVICE } from './loadHarness.mjs';
import { SESSION_KEY, SERVICE_KEY } from '../src/net/accountClient.js';
import {
  realmIo,
  realmCreate,
  realmJoin,
  realmFetch,
  createRealmSession,
  idleKeyOf,
} from '../src/systems/realmSaves.js';
import { stampItemIds } from '../src/systems/item/itemIds.js';
import { ACCEPTED } from '../src/net/legalLaw.js';

const ROOT = process.env.TREE || fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || 5243);
const SVC_PORT = Number(process.env.SVC_PORT || 8872);
const ONLY = new Set((process.env.ONLY || 'a,b,c,d,e,f,g,h').split(','));
const MINUTE = 60_000;
const W = 640,
  H = 360;
/** The guild faction (Chapters-Arc's twenty-two) whose standing (f) moves. */
const FACTION = 40;
const sleep = (ms) =>
  new Promise((r) => {
    setTimeout(r, ms);
  });
const EDGE_ARGS = [
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-background-timer-throttling',
];

/** The probe's seams, beside the online probe's: a checkpoint by hand, the realm session's and the Roll's state, what
 *  the HUD says, and the realm's end said on the console (the page leaves for the door). */
export const REALM_SAVES_PROBE_EDITS = Object.freeze([
  {
    file: 'src/scenes/world.js',
    edits: [
      // HOST-SPLIT SHOT-PROBES: before the shot block's construction, in the host's scope, as the online probe's seam
      [
        '  createWorldShotProbes({   // HOST-SPLIT: src/scenes/worldShotProbes.js',
        `  if (shotMode) {
    window.__onlineCheckpoint = () => onlineCheckpoint();
    window.__realmState = () => (realmSession ? { seq: realmSession.seq, lost: realmSession.lost, missedSince: realmSession.missedSince } : null);
    window.__seatOut = () => seatOut();
    window.__rollHeld = () => !!rollTracker?.held; window.__rollStopped = () => rollTracker?.stopped ?? null; window.__rollRep = (f) => rollTracker?.standing(f)?.rep ?? null;
    window.__standing = (f) => playerEntity?.factionRep?.dict?.get(f)?.rep ?? null;
    { const said = townTalk.say; window.__heard = []; townTalk.say = (line, delay) => { window.__heard.push({ at: Date.now(), line: String(line) }); return said(line, delay); }; }
  }
  createWorldShotProbes({   // HOST-SPLIT: src/scenes/worldShotProbes.js`,
      ],
      ['  function realmLost(why) {', '  function realmLost(why) {\n    console.info(`[realm] lost: ${why}`);'],
      [
        '  if (realmBoot?.stranded) townTalk.say(realmStrandedText());',
        '  if (realmBoot?.stranded) { townTalk.say(realmStrandedText()); window.__strandedSaid = realmStrandedText(); }',
      ],
    ],
  },
]);

/** Whether a save text was written inside a dungeon (the dungeon host's composer: its dungeon and the player's feet). */
export function dungeonSave(text) {
  try {
    const save = JSON.parse(text);
    return save?.dungeon != null && save?.position != null;
  } catch {
    return false;
  }
}

/** Where two save texts differ once idleKeyOf's clock and look are set aside: up to 40 paths, each with both values cut short. */
export function saveDiff(aText, bText) {
  if (!aText || !bText) return { missing: !aText ? 'landed' : 'copy' };
  const norm = (t) => JSON.parse(idleKeyOf(t))[0];
  const out = [];
  const walk = (a, b, path) => {
    if (out.length >= 40) return;
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[k], b[k], `${path}.${k}`);
      return;
    }
    if (JSON.stringify(a) !== JSON.stringify(b))
      out.push([path, JSON.stringify(a)?.slice(0, 60), JSON.stringify(b)?.slice(0, 60)]);
  };
  walk(norm(aText), norm(bText), '');
  return out;
}

let stateDir = null;
const dropState = () => {
  if (stateDir) {
    try {
      rmSync(stateDir, { recursive: true, force: true });
    } catch {
      /* gone */
    }
    stateDir = null;
  }
};
const standing = (page) =>
  page
    .evaluate(() => ({
      frame: window.__frame | 0,
      text: (document.body?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 140),
    }))
    .catch((e) => ({ error: e.message.slice(0, 120) }));
async function until(page, fn, arg, { what, timeout = 600000, every = 1000 } = {}) {
  const t0 = Date.now();
  let saidAt = t0;
  for (;;) {
    const v = await page.evaluate(fn, arg).catch(() => null);
    if (v) return v;
    if (Date.now() - t0 > timeout)
      throw new Error(`${what}: not within ${Math.round(timeout / 1000)} s (${JSON.stringify(await standing(page))})`);
    if (Date.now() - saidAt >= 30000) {
      saidAt = Date.now();
      console.log(`   ${what} - ${Math.round((saidAt - t0) / 1000)} s: ${JSON.stringify(await standing(page))}`);
    }
    await sleep(every);
  }
}
const results = [];
const record = (test, ok, line) => {
  results.push({ test, ok, line });
  console.log(`   ${ok ? 'HOLDS' : 'FAILS'}: (${test}) ${line}`);
};

async function main() {
  const state = (stateDir = mkdtempSync(join(tmpdir(), 'realm-saves-probe-')));
  let server = null,
    browser = null;
  try {
    server = await createServer({
      root: ROOT,
      configFile: `${ROOT}/vite.config.js`,
      plugins: [
        probeTransforms(),
        editsPlugin('online-probe-transforms', ONLINE_PROBE_EDITS),
        editsPlugin('realm-saves-probe', REALM_SAVES_PROBE_EDITS),
      ],
      server: { port: PORT, strictPort: true, hmr: false, watch: null },
      logLevel: 'error',
    });
    await server.listen();
    const svc = await standServices({ port: SVC_PORT }, state);
    const fetch = localFetch({ port: svc.accountPort, ip: '10.9.9.9' });
    const serviceBase = `http://127.0.0.1:${svc.accountPort}`;
    browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge', headless: false, args: EDGE_ARGS });

    console.log('== the first save: the classic start, composed by the world host offline');
    const cctx = await browser.newContext({ viewport: { width: W, height: H } });
    const cpage = await cctx.newPage();
    cpage.on('dialog', (d) => d.accept());
    await cpage.goto(`http://localhost:${PORT}/play/?world&classic&class=1&novideo&shot&play`);
    await until(cpage, () => !!window.__probeSaveText && (window.__frame | 0) > 30, null, {
      what: 'the classic start',
      timeout: 1800000,
      every: 2000,
    });
    await waitFrames(cpage, 3);
    const saveText = await cpage.evaluate(() => window.__probeSaveText());
    await cctx.close();
    if (!saveText) throw new Error('the world host composed no save');

    /** A guest account: its session as a device stores it, and its realm door from here. */
    const guest = async (label) => {
      const made = await fetch(`${LOAD_SERVICE}/v1/auth/guest`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ label, ...ACCEPTED }),
      }).then((r) => r.json());
      if (!made?.secret) throw new Error(`no guest for ${label}`);
      const session = JSON.stringify({ secret: made.secret, id: made.id, name: made.name });
      const io = realmIo({ fetch, storage: botStorage({ [SESSION_KEY]: session, [SERVICE_KEY]: LOAD_SERVICE }) });
      return { label, id: made.id, name: made.name, session, io };
    };
    /** A realm character of `acct`, its first save `text` landed. */
    const character = async (acct, text = saveText) => {
      const c = await realmCreate(acct.io, acct.name || acct.label, null);
      if (!c.ok) throw new Error(`no realm character (${c.error})`);
      const rs = createRealmSession({
        io: acct.io,
        id: c.data.id,
        lease: c.data.lease,
        seq: c.data.seq ?? 0,
        gzip: c.data.gzip === true,
        hidden: () => false,
        watchHidden: () => {},
      });
      const first = await rs.checkpoint(text);
      if (!first?.ok) throw new Error(`the first save did not land (${first?.error})`);
      await rs.leave();
      return c.data.id;
    };
    const recordSeq = async (acct, id) => (await realmFetch(acct.io, id)).seq ?? null;
    /** A device: a browser context signed in as `acct` (the session written once, so a page may sign another in). */
    const device = async (acct) => {
      const ctx = await browser.newContext({ viewport: { width: W, height: H } });
      await ctx.addInitScript(
        ({ sk, sv, sess, base }) => {
          try {
            if (localStorage.getItem(sk) == null) localStorage.setItem(sk, sess);
            localStorage.setItem(sv, base);
            const shelf = JSON.parse(localStorage.getItem('dagger.ui.v1') ?? '{}');
            localStorage.setItem('dagger.ui.v1', JSON.stringify({ ...shelf, tutorialPopups: false }));
          } catch {
            /* no storage */
          }
        },
        { sk: SESSION_KEY, sv: SERVICE_KEY, sess: acct.session, base: serviceBase },
      );
      return ctx;
    };
    /** A page of `ctx` booting realm character `id` online, ready once its session is open and the hooks stand. */
    const boot = async (ctx, id, label, { before = async () => {} } = {}) => {
      const page = await ctx.newPage();
      const log = [];
      page.on('dialog', (d) => d.accept());
      page.on('pageerror', (e) => console.log(`   ${label} pageerror: ${e.message.slice(0, 160)}`));
      page.on('console', (m) => {
        const t = m.text();
        if (/\[(realm|roll)\]/.test(t)) {
          log.push({ at: Date.now(), t });
          console.log(`   ${label} ${m.type()}: ${t.slice(0, 160)}`);
        }
      });
      await before(page);
      const t0 = Date.now();
      await page.goto(
        `http://localhost:${PORT}/play/?world&online&realm=${id}&load&server=ws://127.0.0.1:${svc.relayPort}&novideo&shot&play`,
      );
      let booted = false;
      await Promise.race([
        until(
          page,
          () => !!window.__onlineCheckpoint && window.__probeOnline?.()?.status === 'open' && (window.__frame | 0) > 30,
          null,
          { what: `${label}'s online boot`, timeout: 1800000, every: 3000 },
        ).then(() => {
          booted = true;
        }),
        (async () => {
          while (!booted && !log.some((l) => /\[realm\] lost/.test(l.t))) await sleep(1000);
          if (booted) return;
          throw new Error(
            `${label} was sent to the door while it booted: ${log.find((l) => /\[realm\] lost/.test(l.t)).t}`,
          );
        })(),
      ]);
      console.log(`   ${label} ready after ${((Date.now() - t0) / 1000).toFixed(0)} s`);
      const heard = () => page.evaluate(() => (window.__heard ?? []).map((h) => h.line)).catch(() => []);
      const bodyText = () => page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
      return { page, log, label, heard, bodyText, lostAt: () => log.find((l) => /\[realm\] lost/.test(l.t)) ?? null };
    };
    /** A checkpoint by hand, waited until the record moved past `seq` (or `timeout`). */
    const checkpointLanded = async (p, timeout = 60000) => {
      const before = (await p.page.evaluate(() => window.__realmState()))?.seq;
      await p.page.evaluate(() => window.__onlineCheckpoint());
      const t0 = Date.now();
      for (;;) {
        const now = await p.page.evaluate(() => window.__realmState()).catch(() => null);
        if (now?.seq > before) return now.seq;
        if (Date.now() - t0 > timeout) return null;
        await sleep(500);
      }
    };
    /** `promise`, or null once `ms` pass - a step a crashed page never answers (a route left hanging holds its close) moves on. */
    const within = (ms, promise, what) => {
      let settled = false;
      const done = Promise.resolve(promise).finally(() => {
        settled = true;
      });
      return Promise.race([
        done,
        sleep(ms).then(() => {
          if (!settled) console.log(`   ${what}: no answer in ${ms / 1000} s - moving on`);
          return null;
        }),
      ]);
    };
    const crash = async (p) => {
      const cdp = await within(10000, p.page.context().newCDPSession(p.page), "the crash's session");
      if (cdp)
        await within(
          10000,
          cdp.send('Page.crash').catch(() => {}),
          'the crash',
        );
      await within(
        10000,
        p.page.close().catch(() => {}),
        "the crashed page's close",
      );
    };
    const unsentRecord = (p, id) =>
      p.page
        .evaluate((cid) => JSON.parse(localStorage.getItem(`dagger.realm.unsent.${cid}.at`) ?? 'null'), id)
        .catch(() => null);
    const strandedRecord = (page, id) =>
      page.evaluate((cid) => localStorage.getItem(`dagger.realm.stranded.${cid}.at`), id);

    const x = await guest('device-x');
    const y = await guest('device-y');

    if (ONLY.has('a')) {
      console.log('== (a) device B joins the character device A plays');
      const id = await character(x);
      const ctxA = await device(x),
        ctxB = await device(x);
      const a = await boot(ctxA, id, 'A');
      // A's first periodic save, written inside the classic start's dungeon, landed (the first checkpoint waits for the
      // world to stand; a save from before the dungeon is never the idle tab's)
      let landed = null;
      for (let i = 0; i < 420 && !(landed?.seq >= 2 && dungeonSave(landed.text)); i++) {
        await sleep(1000);
        landed = await realmFetch(x.io, id);
      }
      const landedText = landed?.text ?? null;
      console.log(`   (a) A's landed save: seq ${landed?.seq}, inside the dungeon: ${dungeonSave(landedText)}`);
      const b = await boot(ctxB, id, 'B');
      const bReady = Date.now();
      // A is out of the seat once B's hub claims it; A's lease went at B's join
      await until(a.page, () => !!window.__seatOut?.() || !window.__onlineCheckpoint, null, {
        what: 'A out of the seat',
        timeout: 120000,
      }).catch(() => null);
      const deadline = bReady + 6 * MINUTE;
      while (!a.lostAt() && Date.now() < deadline) await sleep(1000);
      const lost = a.lostAt();
      record(
        'a',
        !!lost && lost.at - bReady <= 5 * MINUTE + 30_000,
        lost
          ? `A went to the door (${lost.t}) ${((lost.at - bReady) / 1000).toFixed(0)} s after B was ready`
          : 'A never went to the door within 6 minutes',
      );
      const unsent = await unsentRecord({ page: a.page }, id);
      const copyText = await a.page
        .evaluate(async (cid) => {
          const { readUnsent, unpackUnsent } = await import('/src/systems/realmSaves.js');
          const kept = readUnsent(localStorage, cid);
          return kept ? (kept.packed ? await unpackUnsent(kept.packed) : kept.text) : null;
        }, id)
        .catch(() => null);
      console.log(
        `   (a) landed vs the seat-loss copy, clock aside: ${JSON.stringify(saveDiff(landedText, copyText))}`,
      );
      const seqB = await checkpointLanded(b);
      record('a', seqB != null, `B's save landed at seq ${seqB}`);
      await b.page.close();
      const again = await boot(ctxA, id, 'A again');
      await waitFrames(again.page, 5);
      const stranded = await strandedRecord(again.page, id);
      const said = [await again.page.evaluate(() => window.__strandedSaid ?? null)]
        .filter(Boolean)
        .map((l) => l.slice(0, 80));
      record(
        'a',
        !stranded,
        `A's copy (${JSON.stringify(unsent)}) at A's next join: ${stranded ? `SET ASIDE, said: ${JSON.stringify(said)}` : 'dropped, nothing said'}`,
      );
      await ctxA.close();
      await ctxB.close();
    }

    if (ONLY.has('b')) {
      console.log('== (b) another account in the same browser takes the seat');
      const idA = await character(x),
        idY = await character(y);
      const ctx = await device(x);
      const a = await boot(ctx, idA, 'A');
      const before = await recordSeq(x, idA);
      // the second account signs in on this browser's storage (any page of the origin will do), then plays its own character
      const other = await boot(ctx, idY, 'Y', {
        before: async (page) => {
          await page.goto(`http://localhost:${PORT}/src/buildTag.js`);
          await page.evaluate(({ sk, sess }) => localStorage.setItem(sk, sess), { sk: SESSION_KEY, sess: y.session });
        },
      });
      void other;
      await until(a.page, () => !!window.__seatOut?.(), null, { what: 'A out of the seat', timeout: 120000 });
      const outAt = Date.now();
      let after = before;
      while (after <= before && Date.now() - outAt < 6 * MINUTE) {
        await sleep(2000);
        after = await recordSeq(x, idA);
      }
      const state = await a.page.evaluate(() => window.__realmState());
      record(
        'b',
        after > before && !state?.lost,
        `A's record ${before} -> ${after} ${((Date.now() - outAt) / 1000).toFixed(0)} s after the seat went; A's session ${state?.lost ?? 'stands'}`,
      );
      const rollStop = await a.page.evaluate(() => window.__rollStopped());
      const rollSaid = /not hearing your guild standing/i.test(await a.bodyText());
      record(
        'b',
        !rollStop || rollSaid,
        `A's Roll: ${rollStop ? `stopped (${rollStop}), ${rollSaid ? 'said in the chat' : 'NOT said'}` : 'still asking'}`,
      );
      await ctx.close();
    }

    if (ONLY.has('c')) {
      console.log('== (c) A killed with a put out');
      const id = await character(x);
      const ctx = await device(x);
      const a = await boot(ctx, id, 'A');
      await a.page.evaluate(() => {
        window.__playerEntity.goldPieces = 4242;
      });
      await a.page.route('**/v1/realm/**', (route) =>
        route.request().method() === 'PUT' ? new Promise(() => {}) : route.continue(),
      );
      await within(
        10000,
        a.page.evaluate(() => window.__onlineCheckpoint()),
        'the checkpoint',
      );
      await sleep(4000); // past the grace: the copy is on the device
      const unsent = await within(10000, unsentRecord(a, id), "the device copy's read");
      console.log(`   the device's copy: ${JSON.stringify(unsent)} - crashing A`);
      await crash(a);
      const seq = await recordSeq(x, id);
      const again = await boot(ctx, id, 'A rejoined');
      const gold = await again.page.evaluate(() => window.__playerEntity?.goldPieces ?? null);
      record(
        'c',
        gold === 4242 && unsent?.seq === seq,
        `the device's copy at seq ${unsent?.seq} (the record at ${seq}): the rejoin plays gold ${gold} (the copy's 4242)`,
      );
      await within(15000, ctx.close(), "the device's close");
    }

    let dupe = null;
    if (ONLY.has('d')) {
      console.log(
        '== (d) a piece dropped by A and picked up by B, A dying before its periodic save (the realm sessions)',
      );
      const snap = JSON.parse(saveText);
      const lists = [snap.items, snap.player?.items, snap.entity?.items].filter(Array.isArray);
      const piece = lists[0]?.find((it) => !(it.stackCount > 1));
      if (!piece) throw new Error('(d): the classic start holds no piece to drop');
      piece.magic = true;
      stampItemIds({ items: lists[0] });
      const withPiece = JSON.stringify(snap);
      const without = JSON.stringify({ ...snap, items: snap.items?.filter((it) => it !== piece) });
      // its own accounts: it runs beside (e) and (f), and its rejoin after the grace must take no lease they play under
      const dx = await guest('drop-x'),
        dy = await guest('drop-y');
      const idA = await character(dx),
        idB = await character(dy);
      const join = async (acct, cid) => {
        const j = await realmJoin(acct.io, cid);
        return createRealmSession({
          io: acct.io,
          id: cid,
          lease: j.data.lease,
          seq: j.data.seq,
          gzip: j.data.gzip === true,
          hidden: () => false,
          watchHidden: () => {},
        });
      };
      const sa = await join(dx, idA);
      const held = await sa.checkpoint(withPiece);
      const sb = await join(dy, idB);
      const picked = await sb.checkpoint(withPiece); // B's save shows the piece; A's next save, without it, never comes
      dupe = (async () => {
        console.log(
          `   A holds piece ${piece.uid} (${held.ok ? 'landed' : held.error}), B shows it (${picked.ok ? 'landed' : picked.error}); A dies before its save - waiting out the ledger's grace`,
        );
        await sleep(13 * MINUTE);
        const back = await join(dx, idA); // A rejoins: the record still holds the piece
        const rejoined = JSON.parse((await realmFetch(dx.io, idA)).text);
        const stillA = JSON.stringify(rejoined).includes(piece.uid);
        await back.checkpoint(withPiece);
        const bNext = await sb.checkpoint(withPiece);
        const locked = sb.lockedKeys ?? [];
        record(
          'd',
          locked.length > 0,
          `A's record ${stillA ? 'still holds' : 'no longer holds'} the piece; after A saves it past the grace, B's copy is ${locked.length ? 'LOCKED (the realm keeps one usable piece)' : 'NOT locked - two usable copies'} (B's save ${bNext.ok ? 'landed' : bNext.error})`,
        );
        void without;
      })();
    }

    if (ONLY.has('e')) {
      console.log('== (e) the put route blocked for 12 minutes');
      const id = await character(x);
      const ctx = await device(x);
      const a = await boot(ctx, id, 'A');
      await checkpointLanded(a);
      const landedAt = Date.now();
      let blocked = true;
      await a.page.route('**/v1/realm/**', (route) =>
        blocked && route.request().method() === 'PUT' ? route.abort('internetdisconnected') : route.continue(),
      );
      // the player plays on while the puts fail: a save that says nothing new is answered by the one the realm holds
      // (realmSaves.js `idle`), and that is no progress lost - so the gold moves every half minute
      for (const end = Date.now() + 12 * MINUTE; Date.now() < end;) {
        await a.page.evaluate(() => {
          window.__playerEntity.goldPieces += 1;
        });
        await sleep(30000);
      }
      const during = await a.page.evaluate(() => window.__heard.map((h) => ({ at: h.at, line: h.line })));
      blocked = false;
      await a.page.evaluate(() => window.__onlineCheckpoint());
      await sleep(15000);
      const after = await a.page.evaluate(() => window.__heard.map((h) => ({ at: h.at, line: h.line })));
      const warnings = during
        .filter((h) => /realm for \d+ minute/i.test(h.line))
        .map((h) => `${((h.at - landedAt) / MINUTE).toFixed(1)} min: ${h.line.slice(0, 70)}`);
      const again = after.slice(during.length).some((h) => /reached the realm again/i.test(h.line));
      const first = during.find((h) => /realm for \d+ minute/i.test(h.line));
      record(
        'e',
        !!first && first.at - landedAt <= 5.5 * MINUTE && warnings.length >= 2 && again,
        `warnings: ${JSON.stringify(warnings)}; "reached again" ${again ? 'said' : 'NOT said'} when the puts recovered`,
      );
      await ctx.close();
    }

    if (ONLY.has('f')) {
      console.log('== (f) the Roll stopped on device A, standing earned, device B joins');
      const id = await character(x);
      const ctxA = await device(x),
        ctxB = await device(x);
      const raise = (p, by) =>
        p.page.evaluate(
          async ({ f, n }) => {
            const { setReputation } = await import('/src/systems/faction/factionRep.js');
            const store = window.__playerEntity.factionRep;
            setReputation(store, f, (store.dict.get(f)?.rep ?? 0) + n);
            return store.dict.get(f).rep;
          },
          { f: FACTION, n: by },
        );
      // the first page: the Roll read, its save landed, then 4 earned and claimed - and the page dies before its next save
      const a0 = await boot(ctxA, id, 'A0');
      await until(a0.page, () => window.__rollHeld(), null, { what: 'A0 hearing the Roll', timeout: 120000 });
      await checkpointLanded(a0);
      const start = await a0.page.evaluate((f) => window.__standing(f), FACTION);
      await raise(a0, 4);
      await until(a0.page, (f) => window.__rollRep(f) === window.__standing(f), FACTION, {
        what: "A0's claim answered",
        timeout: 180000,
      });
      const rollAfterA0 = await a0.page.evaluate((f) => window.__rollRep(f), FACTION);
      await crash(a0);
      // device A again, its Roll refused (a stop): it plays the save, earns 6, and its save lands
      const a1 = await boot(ctxA, id, 'A1', {
        before: async (page) => {
          await page.route('**/v1/chapters/**', (route) =>
            route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'auth' }) }),
          );
        },
      });
      await until(a1.page, () => window.__rollStopped() != null, null, { what: "A1's Roll stopping", timeout: 120000 });
      const stopSaid = /not hearing your guild standing/i.test(await a1.bodyText());
      const a1Start = await a1.page.evaluate((f) => window.__standing(f), FACTION);
      const a1End = await raise(a1, 6);
      await checkpointLanded(a1);
      await a1.page.close();
      // device B joins on A1's save
      const b = await boot(ctxB, id, 'B');
      await until(b.page, () => window.__rollHeld(), null, { what: 'B hearing the Roll', timeout: 120000 });
      await sleep(ROLL_SETTLE_MS);
      const bSees = await b.page.evaluate((f) => window.__standing(f), FACTION);
      const bRoll = await b.page.evaluate((f) => window.__rollRep(f), FACTION);
      // what nothing lost looks like: the Roll's word after A0's claim, and everything A1 earned while its Roll was silent
      const want = rollAfterA0 + (a1End - a1Start);
      record(
        'f',
        bSees === want && stopSaid,
        `standing with ${FACTION}: start ${start}; A0 claimed +4 (Roll ${rollAfterA0}) and died before its save; A1 (Roll stopped: ${stopSaid ? 'said' : 'NOT said'}) began at ${a1Start} and earned ${a1End - a1Start}; B shows ${bSees} (the Roll ${bRoll}), nothing lost is ${want}${bSees < want ? ` - DROPPED ${want - bSees}` : ''}`,
      );
      await ctxA.close();
      await ctxB.close();
    }

    if (ONLY.has('g') || ONLY.has('h')) {
      console.log(
        '== (g) A plays on after its last landed save, device B joins; (h) the set-aside save recovered at the Online door',
      );
      const id = await character(x);
      const ctxA = await device(x),
        ctxB = await device(x);
      const a = await boot(ctxA, id, 'A');
      await checkpointLanded(a);
      await a.page.evaluate(() => {
        window.__playerEntity.goldPieces = 7777;
      }); // play the realm has not taken
      const b = await boot(ctxB, id, 'B');
      const bReady = Date.now();
      while (!a.lostAt() && Date.now() < bReady + 6 * MINUTE) await sleep(1000);
      const unsent = await unsentRecord(a, id);
      record(
        'g',
        unsent?.missed === true,
        `A's copy at the seat's loss: ${JSON.stringify(unsent)} (${a.lostAt() ? 'A went to the door' : 'A NEVER went to the door'})`,
      );
      const seqB = await checkpointLanded(b);
      await b.page.close();
      const again = await boot(ctxA, id, 'A again');
      await waitFrames(again.page, 5);
      const setAside = await again.page.evaluate(async (cid) => {
        const { readStranded, unpackUnsent } = await import('/src/systems/realmSaves.js');
        const copy = readStranded(localStorage, cid);
        const text = copy ? (copy.packed ? await unpackUnsent(copy.packed) : copy.text) : null;
        return text ? JSON.parse(text).goldPieces : null;
      }, id);
      const said = [await again.page.evaluate(() => window.__strandedSaid ?? null)]
        .filter(Boolean)
        .map((l) => l.slice(0, 80));
      const played = await again.page.evaluate(() => window.__playerEntity?.goldPieces ?? null);
      record(
        'g',
        setAside === 7777 && said.length > 0,
        `B's save landed at seq ${seqB}; A's next join plays gold ${played} (the realm's) and set aside gold ${setAside} (7777 played on A), said: ${JSON.stringify(said)}`,
      );
      await again.page.close();
      if (ONLY.has('h')) {
        const door = await ctxA.newPage();
        door.on('dialog', (d) => d.accept());
        await door.goto(`http://localhost:${PORT}/play/index.html`);
        let tile = false;
        for (let i = 0; i < 120 && !tile; i++) {
          tile = await door
            .evaluate((name) => {
              const skip = [...document.querySelectorAll('button, [role=button], .act')].find((el) =>
                /skip intro/i.test(el.textContent ?? ''),
              );
              if (skip) {
                skip.click();
                return false;
              }
              const online = document.querySelector('.door-online');
              if (online && !document.body.innerText.includes(name)) {
                online.click();
                return false;
              }
              return [...document.querySelectorAll('button')].some((el) => /recover it/i.test(el.textContent ?? ''));
            }, x.name)
            .catch(() => false);
          if (!tile) await sleep(1000);
        }
        const press = () =>
          door.evaluate(() => {
            const all = [...document.querySelectorAll('button')].filter((el) =>
              /recover it/i.test(el.textContent ?? ''),
            );
            all.at(-1)?.click();
            return all.length;
          });
        const before = tile ? await press() : 0;
        await sleep(1500);
        const asked = tile ? await press() : 0; // the question's own Recover it
        await sleep(2000);
        const after = await door.evaluate(async (cid) => {
          const { enumerateSaves, loadSlot } = await import('/src/systems/save/saveSlots.js');
          const { REALM_COPY_SAVE_NAME } = await import('/src/systems/realmCopyMark.js');
          const { readStranded } = await import('/src/systems/realmSaves.js');
          const slots = [...enumerateSaves(localStorage).info].filter(
            ([, info]) => info.saveName === REALM_COPY_SAVE_NAME,
          );
          const snap = slots.length ? loadSlot(slots[0][0], localStorage) : null;
          return {
            copies: slots.length,
            gold: snap?.goldPieces ?? null,
            copy: snap?.realmCopy === true,
            stillSetAside: !!readStranded(localStorage, cid),
            notice: [...document.querySelectorAll('button')].some((el) => /recover it/i.test(el.textContent ?? '')),
          };
        }, id);
        record(
          'h',
          tile && after.copies === 1 && after.gold === 7777 && after.copy && !after.stillSetAside && !after.notice,
          `the door showed Recover it: ${tile} (${before} button, then ${asked} with the question); after: ${JSON.stringify(after)}`,
        );
        await door.close();
      }
      await ctxA.close();
      await ctxB.close();
    }

    if (dupe) await dupe;
    const failed = results.filter((r) => !r.ok);
    console.log(`\n== ${results.length - failed.length} of ${results.length} hold`);
    for (const r of results) console.log(`   (${r.test}) ${r.ok ? 'HOLDS' : 'FAILS'}: ${r.line}`);
    return failed.length === 0;
  } finally {
    try {
      await browser?.close();
    } catch {
      /* gone */
    }
    try {
      await server?.close();
    } catch {
      /* gone */
    }
    try {
      stopAll();
    } finally {
      dropState();
    }
  }
}
/** How long B is given after its first word from the Roll to claim what it adopted (the claim goes at its next tick). */
const ROLL_SETTLE_MS = 15000;

if (isMain(import.meta.url)) {
  for (const [sig, code] of [
    ['SIGINT', 130],
    ['SIGTERM', 143],
  ])
    process.on(sig, () => {
      try {
        stopAll();
      } finally {
        dropState();
        process.exit(code);
      }
    });
  main().then(
    (ok) => process.exit(ok ? 0 : 1),
    (e) => {
      console.error(`\nthe realm saves probe failed: ${e?.stack ?? e}`);
      try {
        stopAll();
      } finally {
        dropState();
        process.exit(2);
      }
    },
  );
}
