#!/usr/bin/env node
// DELVE II DLV3's END-TO-END PROBE (bible/03-World/Delve-II.md section 7): a Hold played online by two guests in the real
// game, against the real relay and account service in local workerd (tools/loadHarness.mjs). Each loads a save inside the
// dungeon, composed offline by the world host. They are no party. The first wakes the Hold, kills its waves and captain
// through the game's own damage door, and asks the room for its share. The second stands in the ward: it sees the same
// phases, stands no foe, and is refused the vault. PASS: one plan on both copies, the win on both, the share rolled for
// the winner alone, and no page error.  ARENA2_PATH=... node tools/delveOnlineProbe.mjs  (REGION, LOC: the dungeon; PORT,
// SVC_PORT, PW_CHANNEL as tools/partyLootProbe.mjs; CHROMIUM a browser's path). Not in the suite; test/tooling/dlv3_probe.test.js holds its edits.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { probeTransforms, editsPlugin, waitFrames, SWIFTSHADER_ARGS } from './frameProbe.mjs';
import { ONLINE_PROBE_EDITS } from './onlineFrameProbe.mjs';
import { isMain } from './lib/isMain.mjs';
import { standServices, stopAll, localFetch, botStorage, LOAD_SERVICE } from './loadHarness.mjs';
import { SESSION_KEY, SERVICE_KEY } from '../src/net/accountClient.js';
import { realmIo, realmCreate, createRealmSession } from '../src/systems/realmSaves.js';
import { ACCEPTED } from '../src/net/legalLaw.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || 5247);
const SVC_PORT = Number(process.env.SVC_PORT || 8876);
const REGION = process.env.REGION || 'Daggerfall';
const LOC = process.env.LOC || 'Bedard Laboratory';
const W = 480,
  H = 270;
const sleep = (ms) =>
  new Promise((r) => {
    setTimeout(r, ms);
  });

/** The seams beside the loot door, the tree untouched: the encounters' host and a foe's record (scenes/dungeon.js's own). */
export const DELVE_ONLINE_PROBE_EDITS = Object.freeze([
  {
    file: 'src/scenes/worldModes.js',
    edits: [
      [
        '    window.__takeLoot = (k) => (dungeonCtx ? dungeonCtx.takeLoot(k) : null);',
        `    window.__takeLoot = (k) => (dungeonCtx ? dungeonCtx.takeLoot(k) : null);
    window.__delve = () => dungeonCtx?.delve?.() ?? null;
    window.__foeRecord = (i) => dungeonCtx?.foes?.[i] ?? null;`,
      ],
    ],
  },
]);

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

/** Wait for `fn` in the page to answer truthy, polled every `every` ms; `what` said when it never does. */
async function until(page, fn, arg, { what, timeout = 600000, every = 1000 } = {}) {
  const t0 = Date.now();
  let saidAt = t0;
  for (;;) {
    const v = await page.evaluate(fn, arg).catch(() => null);
    if (v) return v;
    if (Date.now() - t0 > timeout) throw new Error(`${what}: not within ${Math.round(timeout / 1000)} s`);
    if (Date.now() - saidAt >= 30000) {
      saidAt = Date.now();
      console.log(
        `   ${what} - ${Math.round((saidAt - t0) / 1000)} s, frame ${await page.evaluate(() => window.__frame | 0).catch(() => '?')}`,
      );
    }
    await sleep(every);
  }
}
/** A page's errors said as they fall, under its label, and kept. */
function watch(page, label, errors) {
  page.on('pageerror', (e) => {
    errors.push(e.message);
    console.log(`   ${label} pageerror: ${e.message.slice(0, 200)}`);
  });
  page.on('console', (m) => {
    if (/\[(delve|online|realm|grant)\]/.test(m.text()))
      console.log(`   ${label} ${m.type()}: ${m.text().slice(0, 200)}`);
  });
}
/** Every window shut the way a player shuts it: a tutorial page with Space, any other with Escape. */
async function closeWindows(page) {
  for (let k = 0; k < 12; k++) {
    const ov = JSON.parse((await page.evaluate(() => window.__overlay?.() ?? 'null')) ?? 'null');
    if (!ov) return;
    await page.keyboard.press(ov.kind === 'TutorialBox' ? 'Space' : 'Escape');
    await waitFrames(page, 3);
  }
}
const siteOf = (page, i) => page.evaluate((n) => window.__delve()?.state()[n] ?? null, i);

/** The save the players load: the world host booted offline at the dungeon's location, walked in at its entrance. */
async function compose(browser) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  const errors = [];
  watch(page, 'compose', errors);
  await page.goto(
    `http://localhost:${PORT}/play/?world&shot&play&class=1&novideo&region=${encodeURIComponent(REGION)}&loc=${encodeURIComponent(LOC)}`,
  );
  await until(
    page,
    () => window.__mode?.() === 'exterior' && window.__streamIdle?.() && !!window.__probeSaveText,
    null,
    { what: 'the location stood', timeout: 1800000, every: 2000 },
  );
  for (let k = 0; k < 60 && JSON.parse(await page.evaluate(() => window.__talk?.() ?? '{}')).overlay; k++) {
    await page.keyboard.press('Space');
    await sleep(400);
  }
  await closeWindows(page);
  const doors = (await page.evaluate(() => window.__doors())).filter((d) => d.type === 2);
  if (!doors.length) throw new Error(`${LOC}: no dungeon entrance in the loaded world`);
  const d = doors[0];
  await page.evaluate(
    ([p, y]) => window.__warpTo(p, y),
    [[d.pos[0] + d.normal[0], d.pos[1] - 0.5, d.pos[2] + d.normal[2]], Math.atan2(-d.normal[0], -d.normal[2])],
  );
  await waitFrames(page, 3);
  if (!(await page.evaluate(() => window.__enter()))) throw new Error(`${LOC}: the entrance did not open`);
  await until(
    page,
    () => window.__mode?.() === 'dungeon' && window.__delve?.()?.sites?.length > 0 && (window.__frame | 0) > 30,
    null,
    { what: 'inside, the sites planned', timeout: 1800000, every: 2000 },
  );
  const sites = await page.evaluate(() => window.__delve().sites.map((s) => ({ i: s.i, kind: s.kind })));
  const text = await page.evaluate(() => window.__probeSaveText());
  await ctx.close();
  if (!text) throw new Error('the world host composed no save');
  if (errors.length) throw new Error(`the composer threw: ${errors[0]}`);
  return { text, sites };
}

async function main() {
  stateDir = mkdtempSync(join(tmpdir(), 'delve-online-probe-'));
  let server = null,
    browser = null;
  try {
    server = await createServer({
      root: ROOT,
      configFile: `${ROOT}/vite.config.js`,
      plugins: [
        probeTransforms(),
        editsPlugin('online-probe-transforms', ONLINE_PROBE_EDITS),
        editsPlugin('delve-online-probe', DELVE_ONLINE_PROBE_EDITS),
      ],
      server: { port: PORT, strictPort: true, hmr: false, watch: null },
      logLevel: 'error',
    });
    await server.listen();
    const svc = await standServices({ port: SVC_PORT }, stateDir);
    const io = { fetch: localFetch({ port: svc.accountPort, ip: '10.9.9.9' }) };
    browser = await chromium.launch({
      args: SWIFTSHADER_ARGS,
      ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
      ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
    }); // CHROMIUM: a browser of its own (tools/delveProbe.mjs)

    console.log(`== the save: ${REGION} / ${LOC}, composed offline`);
    const { text, sites } = await compose(browser);
    const hold = sites.find((s) => s.kind === 'hold');
    console.log(`   ${(text.length / 1024).toFixed(0)} KB; sites ${JSON.stringify(sites)}`);
    if (!hold) throw new Error(`${LOC} plans no Hold`);

    /** A player: a guest, a realm character with the save, the online boot in its own context, the probe's heal on. */
    const player = async (label) => {
      const made = await io
        .fetch(`${LOAD_SERVICE}/v1/auth/guest`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ label, ...ACCEPTED }),
        })
        .then((r) => r.json());
      if (!made?.secret) throw new Error(`no guest for ${label}`);
      const storage = botStorage({
        [SESSION_KEY]: JSON.stringify({ secret: made.secret, id: made.id, name: made.name }),
        [SERVICE_KEY]: LOAD_SERVICE,
      });
      const pio = realmIo({ fetch: io.fetch, storage });
      const c = await realmCreate(pio, made.name || label, null);
      if (!c.ok) throw new Error(`no realm character for ${label} (${c.error})`);
      const rs = createRealmSession({
        io: pio,
        id: c.data.id,
        lease: c.data.lease,
        seq: c.data.seq ?? 0,
        gzip: c.data.gzip === true,
        hidden: () => false,
        watchHidden: () => {},
      });
      if (!(await rs.checkpoint(text))?.ok) throw new Error(`${label}'s save did not land`);
      const ctx = await browser.newContext({ viewport: { width: W, height: H } });
      await ctx.addInitScript(
        ({ sk, sv, sess, base }) => {
          try {
            localStorage.setItem(sk, sess);
            localStorage.setItem(sv, base);
            const shelf = JSON.parse(localStorage.getItem('dagger.ui.v1') ?? '{}');
            localStorage.setItem('dagger.ui.v1', JSON.stringify({ ...shelf, tutorialPopups: false }));
          } catch {
            /* no storage */
          }
        },
        {
          sk: SESSION_KEY,
          sv: SERVICE_KEY,
          sess: JSON.stringify({ secret: made.secret, id: made.id, name: made.name }),
          base: `http://127.0.0.1:${svc.accountPort}`,
        },
      );
      const page = await ctx.newPage();
      const errors = [];
      watch(page, label, errors);
      const t0 = Date.now();
      await page.goto(
        `http://localhost:${PORT}/play/?world&online&realm=${c.data.id}&load&server=ws://127.0.0.1:${svc.relayPort}&novideo&shot&play`,
      );
      await until(
        page,
        () => window.__mode?.() === 'dungeon' && !!window.__delve?.() && (window.__frame | 0) > 30,
        null,
        { what: `${label}'s online boot into the dungeon`, timeout: 1800000, every: 5000 },
      );
      await until(page, () => window.__probeOnline?.()?.status === 'open', null, { what: `${label}'s session open` });
      await page.evaluate(() => {
        setInterval(() => {
          const p = window.__playerEntity;
          if (p && p.health > 0) p.health = p.maxHealth;
        }, 50);
      });
      console.log(`   ${label} in after ${((Date.now() - t0) / 1000).toFixed(0)} s`);
      return { label, page, errors };
    };
    console.log('== the winner');
    const A = await player('winner');
    console.log('== the stranger');
    const B = await player('stranger');
    const S = await A.page.evaluate((i) => window.__delve().sites[i], hold.i);
    const at = (who, p) => who.page.evaluate(([x, y, z]) => window.__warpTo([x, y + 0.05, z]), p);
    for (const who of [A, B]) await closeWindows(who.page);

    // the plan: one hash on both copies, the room's answer heard (each copy's chest stands once it is)
    const hashes = await Promise.all([A, B].map((w) => w.page.evaluate(() => window.__delve().snapshot().h)));
    if (hashes[0] !== hashes[1]) throw new Error(`two plans: ${hashes.join(' vs ')}`);
    console.log(`   one plan on both copies (${hashes[0]})`);

    console.log(
      `== the winner wakes the Hold (site ${S.i} at [${S.x}, ${S.y}, ${S.z}] r ${S.r}); the stranger stands in it`,
    );
    await at(A, [S.x, S.y, S.z]);
    await until(A.page, (i) => (window.__delve().state()[i]?.p ?? 0) > 0, S.i, {
      what: 'the room starting the Hold',
      timeout: 120000,
    });
    await at(B, [S.x + S.r * 0.5, S.y, S.z]);
    const t0 = Date.now();
    let phases = new Set(),
      seenB = new Set();
    while (!(await siteOf(A.page, S.i))?.won && Date.now() - t0 < 3_600_000) {
      for (const who of [A, B]) await closeWindows(who.page);
      await at(A, [S.x, S.y, S.z]);
      const killed = await A.page.evaluate((i) => {
        let k = 0;
        for (const [j] of Object.entries(JSON.parse(window.__foes()))) {
          const r = window.__foeRecord(Number(j));
          if (r && r._delve?.i === i && !r.dead && r.entity) {
            window.__damageFoe(Number(j), r.entity.health + 999);
            k++;
          }
        }
        return k;
      }, S.i);
      const [a, b] = [await siteOf(A.page, S.i), await siteOf(B.page, S.i)];
      if (!phases.has(a?.p)) {
        phases.add(a?.p);
        console.log(
          `   the winner sees phase ${a?.p} (wave ${a?.w}), the stranger ${b?.p}${killed ? `, ${killed} slain` : ''}`,
        );
      }
      seenB.add(b?.p);
      if ((b?.hold?.stood ?? 0) > 0) throw new Error(`the stranger's machine stood ${b.hold.stood} of the site's foes`);
      await sleep(2000);
    }
    const [a, b] = [await siteOf(A.page, S.i), await siteOf(B.page, S.i)];
    if (!a?.won) throw new Error(`not won in an hour: ${JSON.stringify(a)}`);
    await until(B.page, (i) => window.__delve().state()[i]?.won, S.i, {
      what: 'the stranger seeing the win',
      timeout: 60000,
    });
    console.log(
      `   WON in ${((Date.now() - t0) / 1000).toFixed(0)} s; the stranger saw phases ${[...seenB].join(', ')}; its machine stood ${b?.hold?.stood ?? 0}`,
    );

    console.log("== the vault: the winner's share asked of the room; the stranger's press refused");
    const key = `delve:vault:${S.i}`;
    await A.page.evaluate((k) => window.__delve().press(k), key);
    const share = await until(
      A.page,
      (k) => {
        const c = window.__delve().contents(k);
        return c?.length ? c.length : 0;
      },
      key,
      { what: "the winner's share", timeout: 60000 },
    );
    await B.page.evaluate((k) => window.__delve().press(k), key);
    await waitFrames(B.page, 5);
    const refused = await B.page.evaluate(async () => (await import('/src/ui/midScreenText.js')).midScreenText.text);
    const bShare = await B.page.evaluate((k) => window.__delve().contents(k)?.length ?? 0, key);
    console.log(`   the winner's share: ${share} piece(s); the stranger: ${bShare}, "${refused}"`);
    if (bShare) throw new Error('the stranger rolled a share');
    const errs = [...A.errors, ...B.errors];
    if (errs.length) throw new Error(`a page threw: ${errs[0]}`);
    console.log('PASS');
  } finally {
    await browser?.close().catch(() => {});
    await server?.close().catch(() => {});
    try {
      stopAll();
    } finally {
      dropState();
    }
  }
}

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
    () => process.exit(0),
    (e) => {
      console.error(`FAIL: ${e?.stack ?? e}`);
      try {
        stopAll();
      } finally {
        dropState();
        process.exit(1);
      }
    },
  );
}
