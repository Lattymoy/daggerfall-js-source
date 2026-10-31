#!/usr/bin/env node
// PRIVATE-HOST's END-TO-END PROBE: a private server hosted the way the desktop shell hosts one (app/lib/privateHost.mjs:
// the game's relay in local workerd, the host's own sign-in key), and two players in the real game - the host's own
// page on the host's address, a guest's through a bridge, as a friend's shell joins. Each page is told the address the
// way the shell's preload tells it (window.daggerShell.privateServer), and boots a new character offline-style: the
// private hook takes it online. PASS: both pages online on the private relay, each sees the other, the account service
// is never asked, and no page error.  ARENA2_PATH=... node tools/privateHostProbe.mjs  (PORT: vite's; PLAYERS: pages; CHROMIUM: a browser's path;
// 2 by default). Not in the suite: it boots the whole game twice.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

import { SWIFTSHADER_ARGS } from './frameProbe.mjs';
import { probePlugins } from './onlineFrameProbe.mjs';   // the online probe's seams: ?shot kept online, __probeOnline

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || 5261);
const PLAYERS = Math.max(2, Number(process.env.PLAYERS || 2));
const W = 480, H = 270;
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
execFileSync(process.execPath, [join(ROOT, 'scripts/privateRelay.mjs')], { stdio: 'inherit' });
// the shell's own miniflare (app/package.json)
const { Miniflare, supportedCompatibilityDate } = await import(createRequire(join(ROOT, 'app/package.json')).resolve('miniflare'));
const host = await import(join(ROOT, 'app/private/host.mjs'));

const dir = mkdtempSync(join(tmpdir(), 'dfo-private-'));
const server = await host.startHost({ dir, relayScript: join(ROOT, 'dist/private/relay.mjs'), Miniflare, compatibilityDate: supportedCompatibilityDate, port: 0, maxPlayers: 10, name: 'Probe' });
const bridge = await host.startBridge({ host: '127.0.0.1', port: server.port });
console.log(`== host ${server.url}, guest bridge ${bridge.url}`);
const vite = await createServer({ root: ROOT, logLevel: 'error', server: { port: PORT, strictPort: true }, plugins: probePlugins() });
await vite.listen();
const browser = await chromium.launch({ args: SWIFTSHADER_ARGS, ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });   // CHROMIUM: a browser of its own (tools/delveProbe.mjs)

let failed = false;
const pages = [];
try {
  for (let i = 0; i < PLAYERS; i++) {
    const url = i === 0 ? server.url : bridge.url;
    const ctx = await browser.newContext({ viewport: { width: W, height: H } });
    await ctx.addInitScript((u) => { window.daggerShell = { privateServer: { url: u } }; }, url);
    const page = await ctx.newPage();
    const errors = [];
    const asked = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => { if (/workers\.dev|private\.invalid/.test(r.url())) asked.push(r.url()); });
    page.on('console', (m) => { if (/\[(online|private|realm)\]/.test(m.text())) console.log(`   p${i} ${m.type()}: ${m.text().slice(0, 200)}`); });
    // a new character, as a player who made one offline would play - the private hook takes the boot online
    await page.goto(`http://localhost:${PORT}/play/?world&region=Daggerfall&loc=Daggerfall&class=${1 + i}&novideo&shot&play&tod=15:00`);
    pages.push({ page, errors, asked, label: i === 0 ? 'host' : `guest ${i}` });
  }
  // the meeting is the session's, which runs from the first online frame - long before a software-rendered page is
  // ready for a picture (__shotReady), so the probe watches the sessions themselves
  for (const p of pages) await p.page.waitForFunction(() => typeof window.__probeOnline === 'function', null, { timeout: 1200000, polling: 1000 });
  console.log('== all pages booting; waiting to meet');
  const seen = async (p) => p.page.evaluate(() => window.__probeOnline?.() ?? { online: new URLSearchParams(location.search).has('online') }).catch((e) => ({ error: e.message }));
  let met = false;
  for (let t = 0; t < 600 && !met; t++) {
    await sleep(2000);
    const all = await Promise.all(pages.map(seen));
    met = all.every((s) => s.status === 'open' && (s.peers ?? 0) >= PLAYERS - 1);
    if (t % 10 === 0 || met) console.log(`   ${all.map((s, i) => `${pages[i].label}: ${JSON.stringify(s)}`).join(' | ')}`);
  }
  console.log(`== players on the host: ${server.players()}`);
  if (process.env.SHOTS) for (const [i, p] of pages.entries()) await p.page.screenshot({ path: `${process.env.SHOTS}/private-${i}.png` }).catch(() => {});
  for (const p of pages) {
    if (p.errors.length) { failed = true; console.log(`FAIL ${p.label}: page errors\n   ${p.errors.slice(0, 5).join('\n   ')}`); }
    if (p.asked.length) { failed = true; console.log(`FAIL ${p.label}: asked a main server: ${[...new Set(p.asked)].slice(0, 3).join(', ')}`); }
  }
  if (!met) { failed = true; console.log('FAIL: the players never all saw each other'); }
  if (!failed) console.log('PASS: every player online on the private server, each seeing the rest, no main server asked');
} catch (e) {
  failed = true;
  console.log('FAIL:', e?.message ?? e);
} finally {
  await browser.close().catch(() => {});
  await vite.close().catch(() => {});
  await bridge.stop();
  await server.stop();
  rmSync(dir, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
