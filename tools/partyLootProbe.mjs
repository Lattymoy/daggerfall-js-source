#!/usr/bin/env node
// PARTY-LOOT's END-TO-END PROBE (bible/06-Systems/Online-Arc.md PARTY-LOOT) - the report, played: "When in a party, if a
// monster is killed, loot drops for one player but the other player sees 'Empty'. If that player clicks 'Empty' it wipes
// out the loot for the other player." Two players in the REAL game in headless Chromium over the player's own ARENA2, both
// online in Privateer's Hold against the REAL relay and the REAL account service in local workerd
// (tools/loadHarness.mjs standServices). Each is a guest with a realm character whose first save is the classic start's,
// composed by the world host (tools/onlineFrameProbe.mjs's own way in - a save made inside the Hold enters it online,
// HOLD-ONCE). The first in holds the seat. The host kills foes through the game's own damage door (`__damageFoe`) and the
// joiner the rest through its own - its blows ride to the host as hits, as a party member's do; once each copy has laid
// each body and the room's word for it has landed, the probe reads what each copy's plaque names (the dungeon's own
// lootContents): the room's shared base, every piece by its template, material, count, condition and enchantments, and
// apart from it the player's own bonus (roomLoot.js isPersonalLoot - never the room's, so never compared). Then three
// windows, each through the game's own loot door (`__takeLoot`, the press's) and the enhanced pack's own row click
// (online is the enhanced lane):
//   the joiner opens a body and closes it (Escape) taking nothing - the host's base must stand;
//   the joiner opens a body, the host opens it too and takes a base piece, and the joiner closes taking nothing - the
//   piece the host took must stay taken on both;
//   the joiner opens a body and takes a base piece - the host's base must lose that one piece and keep the rest.
//   PASS: every body names one base on both copies, the three windows leave both bases as the takes left them, and no
//   page threw. A body a copy cannot read fails the run; so does a run whose bodies hold nothing to take.
//   TREE=<a checkout before PARTY-LOOT (2026-10-15, #923)> plays the report as it was - no base is shared there, every
//   row reads as the room's, and the run fails.
//
//   ARENA2_PATH=/path/to/arena2 node tools/partyLootProbe.mjs       KILLS=6 the bodies; TREE=<dir> the page's tree (the
//                                                                   relay and the account service are this tree's);
//                                                                   PORT / SVC_PORT as tools/onlineFrameProbe.mjs;
//                                                                   PW_CHANNEL=chromium the full build headless (no
//                                                                   headless shell installed)
// Not in the suite (a toolchain and minutes, tools/loadHarness.mjs's reason) - test/net/partyloot_wire.test.js is the wire pin and test/tooling/partyloot_probe.test.js the pin of its edits and reads.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
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

const ROOT = process.env.TREE || fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || 5243);
const SVC_PORT = Number(process.env.SVC_PORT || 8872);
const KILLS = Number(process.env.KILLS || 6);
const W = 480, H = 270;
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

/** This probe's seams beside the online probe's, the tree untouched: what a body's plaque names - the room's base apart
 *  from the player's own bonus - which piece is a player's own, and who holds the seat. The personal mark is roomLoot.js's
 *  own (a set inside the module the dungeon reads), asked of that module - by a path the dev server does not resolve
 *  ahead (a tree before PARTY-LOOT has no such module, and a static path there failed worldModes.js's transform), the
 *  browser's import landing on the very module the dungeon imported; a tree without it marks nothing. */
export const PARTY_LOOT_PROBE_EDITS = Object.freeze([
  { file: 'src/scenes/worldModes.js', edits: [['    window.__takeLoot = (k) => (dungeonCtx ? dungeonCtx.takeLoot(k) : null);', `    window.__takeLoot = (k) => (dungeonCtx ? dungeonCtx.takeLoot(k) : null);
    let __personal = () => false; window.__personalMark = 'none'; import(/* @vite-ignore */ ['..', 'systems', 'roomLoot.js'].join('/')).then((m) => { if (typeof m.isPersonalLoot === 'function') { __personal = m.isPersonalLoot; window.__personalMark = 'roomLoot.js'; } }).catch(() => {});
    window.__isPersonal = (it) => __personal(it);
    window.__bodyLoot = (i) => { const f = dungeonCtx?.foes?.[i]; if (!(f?.dead && f.corpse)) return null; const l = dungeonCtx.lootContents?.(\`corpse:\${i}\`); if (!Array.isArray(l)) return null; const fp = (it) => \`\${it.name} x\${it.stackCount ?? 1} [\${it.templateIndex}/\${it.material ?? '-'}/\${it.currentCondition ?? '-'}/\${(it.enchantments ?? []).length}]\`; return JSON.stringify({ base: l.filter((it) => !__personal(it)).map(fp), mine: l.filter((it) => __personal(it)).map(fp) }); };
    window.__seat = () => (dungeonCtx ? JSON.stringify({ authority: !!dungeonCtx.isAuthority?.(), location: dungeonCtx.locationKey?.() ?? null }) : null);`]] },
]);

let stateDir = null;
const dropState = () => { if (stateDir) { try { rmSync(stateDir, { recursive: true, force: true }); } catch { /* gone */ } stateDir = null; } };

/** Where a page stands - its frame, its readiness and the words on its screen - for a long wait's log. */
const standing = (page) => page.evaluate(() => ({ frame: window.__frame | 0, ready: window.__shotReady === true, text: (document.body?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 140) })).catch((e) => ({ error: e.message.slice(0, 120) }));
/** Wait for `fn` in the page to answer truthy - polled every `every` ms, where the page stands said every 30 s, `what`
 *  said when it never does. */
async function until(page, fn, arg, { what, timeout = 600000, every = 1000 } = {}) {
  const t0 = Date.now();
  let saidAt = t0;
  for (;;) {
    const v = await page.evaluate(fn, arg).catch(() => null);
    if (v) return v;
    if (Date.now() - t0 > timeout) throw new Error(`${what}: not within ${Math.round(timeout / 1000)} s (${JSON.stringify(await standing(page))})`);
    if (Date.now() - saidAt >= 30000) { saidAt = Date.now(); console.log(`   ${what} - ${Math.round((saidAt - t0) / 1000)} s: ${JSON.stringify(await standing(page))}`); }
    await sleep(every);
  }
}
/** A page's errors said as they fall, under its label. */
const watch = (page, label) => {
  page.on('pageerror', (e) => console.log(`   ${label} pageerror: ${e.message.slice(0, 200)}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_CERT|WebSocket/.test(m.text())) console.log(`   ${label} console error: ${m.text().slice(0, 200)}`); });
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** A base with one piece taken out - the first row that names it. */
const without = (base, row) => { const i = base.indexOf(row); return i < 0 ? null : [...base.slice(0, i), ...base.slice(i + 1)]; };

async function main() {
  const state = stateDir = mkdtempSync(join(tmpdir(), 'party-loot-probe-'));
  let server = null, browser = null;
  try {
    server = await createServer({ root: ROOT, configFile: `${ROOT}/vite.config.js`, plugins: [probeTransforms(), editsPlugin('online-probe-transforms', ONLINE_PROBE_EDITS), editsPlugin('party-loot-probe', PARTY_LOOT_PROBE_EDITS)], server: { port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
    await server.listen();
    const svc = await standServices({ port: SVC_PORT }, state);
    const io = { fetch: localFetch({ port: svc.accountPort, ip: '10.9.9.9' }) };
    browser = await chromium.launch({ args: SWIFTSHADER_ARGS, ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}) });

    console.log('== the first save: the classic start, composed by the world host offline');
    const cctx = await browser.newContext({ viewport: { width: W, height: H } });
    const cpage = await cctx.newPage();
    watch(cpage, 'compose');
    await cpage.goto(`http://localhost:${PORT}/play/?world&classic&class=1&novideo&shot&play`);
    // the dungeon stood and the composer's hook in: `__shotReady` waits on the world's streaming queue, which software GL
    // can take an hour to drain around the Hold's pixel, and nothing here reads the streamed world
    await until(cpage, () => !!window.__probeSaveText && window.__foes?.() != null && (window.__frame | 0) > 30, null, { what: 'the classic start in the Hold', timeout: 1800000, every: 2000 });
    await waitFrames(cpage, 3);
    const saveText = await cpage.evaluate(() => window.__probeSaveText());
    await cctx.close();
    if (!saveText) throw new Error('the world host composed no save');
    console.log(`   ${(saveText.length / 1024).toFixed(0)} KB`);

    /** A player: a guest, a realm character with the composed save, and the online boot in its own browser context. */
    const player = async (label) => {
      const made = await io.fetch(`${LOAD_SERVICE}/v1/auth/guest`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label, ...ACCEPTED }) }).then((r) => r.json());
      if (!made?.secret) throw new Error(`no guest for ${label} (${JSON.stringify(made)})`);
      const storage = botStorage({ [SESSION_KEY]: JSON.stringify({ secret: made.secret, id: made.id, name: made.name }), [SERVICE_KEY]: LOAD_SERVICE });
      const pio = realmIo({ fetch: io.fetch, storage });
      const c = await realmCreate(pio, made.name || label, null);
      if (!c.ok) throw new Error(`no realm character for ${label} (${c.error})`);
      const rs = createRealmSession({ io: pio, id: c.data.id, lease: c.data.lease, seq: c.data.seq ?? 0, gzip: c.data.gzip === true, hidden: () => false, watchHidden: () => {} });
      const first = await rs.checkpoint(saveText);
      if (!first?.ok) throw new Error(`${label}'s first save did not land (${first?.error})`);
      const ctx = await browser.newContext({ viewport: { width: W, height: H } });
      // the tutorials' popups off (systems/tutorials.js TUTORIAL_POPUPS_PREF on the UI shelf): the first loot's page is a box
      // over the window the probe opens, and a press under a box opens nothing
      await ctx.addInitScript(({ sk, sv, sess, base }) => {
        try {
          localStorage.setItem(sk, sess); localStorage.setItem(sv, base);
          const shelf = JSON.parse(localStorage.getItem('dagger.ui.v1') ?? '{}');
          localStorage.setItem('dagger.ui.v1', JSON.stringify({ ...shelf, tutorialPopups: false }));
        } catch { /* no storage */ }
      }, { sk: SESSION_KEY, sv: SERVICE_KEY, sess: JSON.stringify({ secret: made.secret, id: made.id, name: made.name }), base: `http://127.0.0.1:${svc.accountPort}` });
      const page = await ctx.newPage();
      const errors = [];
      watch(page, label);
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (/\[(realm|online|loot)\]/.test(m.text())) console.log(`   ${label} ${m.type()}: ${m.text().slice(0, 200)}`); });
      const t0 = Date.now();
      await page.goto(`http://localhost:${PORT}/play/?world&online&realm=${c.data.id}&load&server=ws://127.0.0.1:${svc.relayPort}&novideo&shot&play`);
      await until(page, () => !!window.__seat?.() && window.__foes?.() != null && (window.__frame | 0) > 30, null, { what: `${label}'s online boot into the Hold`, timeout: 1800000, every: 5000 });
      await until(page, () => window.__probeOnline?.()?.status === 'open', null, { what: `${label}'s session open` });
      console.log(`   ${label} ready after ${((Date.now() - t0) / 1000).toFixed(0)} s: ${await page.evaluate(() => window.__seat())}`);
      return { label, page, errors, seat: async () => JSON.parse(await page.evaluate(() => window.__seat())) };
    };

    console.log('== the host');
    const host = await player('host');
    console.log('== the joiner');
    const joiner = await player('joiner');
    await until(joiner.page, () => JSON.parse(window.__seat?.() ?? 'null')?.authority === false, null, { what: 'the joiner hearing the host\'s seat', timeout: 120000 });
    const [hs, js] = [await host.seat(), await joiner.seat()];
    if (!hs.authority || js.authority || hs.location !== js.location) throw new Error(`not one room with one seat: host ${JSON.stringify(hs)}, joiner ${JSON.stringify(js)}`);
    console.log(`   one room (${hs.location}), the host holds the seat`);
    // the personal mark the seams read: roomLoot.js's own wherever the tree has it - a mark that did not load would read
    // a player's bonus as the room's (and no run has yet rolled a bonus to show it)
    const markWant = existsSync(join(ROOT, 'src/systems/roomLoot.js')) ? 'roomLoot.js' : 'none';
    for (const who of [host, joiner]) {
      const mark = await until(who.page, () => window.__personalMark, null, { what: `the ${who.label}'s personal mark`, timeout: 60000 });
      if (mark !== markWant) throw new Error(`the ${who.label}'s personal mark is ${mark}, not ${markWant}`);
    }
    console.log(`   the personal mark: ${markWant}`);

    const foes = JSON.parse(await host.page.evaluate(() => window.__foes()));
    const targets = foes.filter((f) => !f.dead).slice(0, KILLS).map((f) => f.i);
    if (targets.length < 2) throw new Error(`${targets.length} foes standing - the probe kills two at least, one by each player`);
    const byHost = targets.filter((_, n) => n % 2 === 0), byJoiner = targets.filter((_, n) => n % 2 === 1);
    console.log(`== the host kills ${byHost.join(', ')}; the joiner kills ${byJoiner.join(', ')} (its blows ride to the host as hits)`);
    for (const i of byHost) await host.page.evaluate((n) => window.__damageFoe(n, 1e6), i);
    for (const i of byJoiner) {
      // a joiner's blow is the host's to apply (WORLD2): blows of the health the joiner's copy streams, until it falls
      for (let n = 0; n < 20 && !JSON.parse(await joiner.page.evaluate(() => window.__foes()))[i]?.dead; n++) {
        await joiner.page.evaluate((k) => window.__damageFoe(k), i);
        await sleep(1500);
      }
    }
    const read = async (who, i) => { const v = await who.page.evaluate((n) => window.__bodyLoot(n), i); return v == null ? null : JSON.parse(v); };
    // every body laid on both copies, and the room's word for it landed (a body before its word names nothing - UNBORN)
    const t1 = Date.now();
    for (const who of [joiner, host]) {
      await until(who.page, (ids) => ids.every((i) => window.__bodyLoot(i) != null), targets, { what: `the ${who.label}'s plaque naming every body`, timeout: 300000 });
    }
    console.log(`   every body named on both copies ${((Date.now() - t1) / 1000).toFixed(0)} s after the last kill`);
    await waitFrames(joiner.page, 5);

    const rows = [];
    for (const i of targets) {
      const h = await read(host, i), j = await read(joiner, i);
      if (h == null || j == null) throw new Error(`body ${i} unread (host ${JSON.stringify(h)}, joiner ${JSON.stringify(j)})`);
      rows.push({ i, by: byHost.includes(i) ? 'host' : 'joiner', host: h, joiner: j, same: same(h.base, j.base) });
    }
    console.log('== what each copy\'s plaque names - the room\'s base (the players\' own bonus apart)');
    for (const r of rows) console.log(`   body ${r.i} (the ${r.by}'s kill): ${r.same ? 'SAME' : 'DIFFERENT'}  host ${JSON.stringify(r.host.base)}${r.host.mine.length ? ` +${r.host.mine.length} its own` : ''}  joiner ${JSON.stringify(r.joiner.base)}${r.joiner.mine.length ? ` +${r.joiner.mine.length} its own` : ''}`);
    const full = rows.filter((r) => r.host.base.length);
    if (full.length < 2) throw new Error(`${full.length} bodies hold a base - the windows want two (KILLS= more)`);

    const windowUp = (who) => who.page.evaluate(() => !!(window.__overlayKind?.() || document.getElementById('enhanced-inventory')));
    const noWindow = async (who) => {
      for (let n = 0; n < 5 && (await windowUp(who)); n++) { await who.page.keyboard.press('Escape'); await sleep(1000); }   // a press under a window opens nothing
      if (await windowUp(who)) throw new Error(`a window stands over the ${who.label}`);
    };
    /** The press's own loot door, and the pack it opens - mounted (its rows in), so its keys are its own. */
    const openBody = async (who, i) => {
      await noWindow(who);
      await who.page.evaluate((k) => window.__takeLoot(k), `corpse:${i}`);
      return until(who.page, () => (document.getElementById('enhanced-inventory')?.querySelector('*') ? 'the enhanced pack' : /Inventory/.test(window.__overlayKind?.() ?? '') ? window.__overlayKind() : null), null, { what: `the ${who.label}'s loot window`, timeout: 60000 });
    };
    const closeWindow = async (who) => {
      await who.page.keyboard.press('Escape');
      await until(who.page, () => !document.getElementById('enhanced-inventory') && !window.__overlayKind?.(), null, { what: `the ${who.label}'s loot window closing`, timeout: 60000 });
    };
    /** The enhanced pack's own click on its first row of the ROOM'S base - a loot-side click takes (IG7); a row of the
     *  player's own bonus is theirs at once and no claim, so never the one taken here. Answers the piece's fingerprint. */
    const takeBase = (who) => until(who.page, () => {
      const row = [...document.querySelectorAll('#enhanced-inventory *')].find((e) => e._padFrom === 'remote' && e._padItem && !window.__isPersonal(e._padItem));
      if (!row) return null;
      const it = row._padItem;
      const fp = `${it.name} x${it.stackCount ?? 1} [${it.templateIndex}/${it.material ?? '-'}/${it.currentCondition ?? '-'}/${(it.enchantments ?? []).length}]`;
      row.click();
      return fp;
    }, null, { what: `a base row in the ${who.label}'s pack`, timeout: 60000 });
    const settle = async () => { await sleep(3000); await waitFrames(host.page, 3); await waitFrames(joiner.page, 3); };

    const a = full[0];
    console.log(`== the joiner opens body ${a.i} and closes it, taking nothing`);
    const aBefore = (await read(host, a.i)).base;
    console.log(`   the window: ${await openBody(joiner, a.i)}`);
    await waitFrames(joiner.page, 3);
    await closeWindow(joiner);
    await settle();
    const aAfter = (await read(host, a.i)).base;
    const keptA = same(aBefore, aAfter);
    console.log(`   the host's base on body ${a.i}: before ${JSON.stringify(aBefore)}, after ${JSON.stringify(aAfter)}`);

    const b = full[1];
    console.log(`== the joiner opens body ${b.i}; the host opens it too, takes a base piece and closes; the joiner closes, taking nothing`);
    const bBefore = (await read(host, b.i)).base;
    await openBody(joiner, b.i);
    await openBody(host, b.i);
    const tookB = await takeBase(host);
    await sleep(1000);
    await closeWindow(host);
    await settle();   // the host's word reaches the joiner, under its open window
    await closeWindow(joiner);
    await settle();
    const bHost = (await read(host, b.i)).base, bJoiner = (await read(joiner, b.i)).base;
    const bWant = without(bBefore, tookB);
    const keptB = !!bWant && same(bHost, bWant) && same(bJoiner, bWant);
    console.log(`   the host took ${tookB}; the host's base ${JSON.stringify(bHost)}, the joiner's ${JSON.stringify(bJoiner)}`);

    const c = full.find((r) => r !== a && r !== b && r.host.base.length) ?? a;
    console.log(`== the joiner opens body ${c.i}, takes a base piece and closes`);
    const cBefore = (await read(host, c.i)).base;
    await openBody(joiner, c.i);
    const tookC = await takeBase(joiner);
    await sleep(1000);
    await closeWindow(joiner);
    await settle();   // the claim to the host, its grant back
    const cHost = (await read(host, c.i)).base, cJoiner = (await read(joiner, c.i)).base;
    const cWant = without(cBefore, tookC);
    const tookOne = !!cWant && same(cHost, cWant) && same(cJoiner, cWant);
    console.log(`   the joiner took ${tookC}; the host's base ${JSON.stringify(cHost)}, the joiner's ${JSON.stringify(cJoiner)}`);

    const errors = [...host.errors.map((e) => `host: ${e}`), ...joiner.errors.map((e) => `joiner: ${e}`)];
    if (errors.length) console.log(`== page errors: ${errors.slice(0, 6).join(' | ')}`);
    const differ = rows.filter((r) => !r.same).length;
    const ok = differ === 0 && keptA && keptB && tookOne && !errors.length;
    console.log(`\n${ok ? 'PASS' : 'FAIL'}: ${rows.length - differ} of ${rows.length} bodies one base on both copies (${byHost.length} the host's kills, ${byJoiner.length} the joiner's); the untouched window ${keptA ? 'left the host\'s base' : 'CHANGED the host\'s base'}; the host's take ${keptB ? 'stayed taken on both' : 'did NOT stay taken'}; the joiner's take ${tookOne ? 'came off both bases, one piece' : 'did NOT come off both bases as one piece'}${errors.length ? `; ${errors.length} page error(s)` : ''}`);
    return ok;
  } finally {
    try { await browser?.close(); } catch { /* gone */ }
    try { await server?.close(); } catch { /* gone */ }
    try { stopAll(); } finally { dropState(); }
  }
}

if (isMain(import.meta.url)) {
  for (const [sig, code] of [['SIGINT', 130], ['SIGTERM', 143]]) process.on(sig, () => { try { stopAll(); } finally { dropState(); process.exit(code); } });
  main().then((ok) => process.exit(ok ? 0 : 1), (e) => { console.error(`\nthe party loot probe failed: ${e?.stack ?? e}`); try { stopAll(); } finally { dropState(); process.exit(2); } });
}
