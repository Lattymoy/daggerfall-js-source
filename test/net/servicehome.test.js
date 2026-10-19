// DEV-ENV (2026-10-19, bible/01-Overview/Release-Flow.md): THE SERVICES A BUILD CALLS HOME. The dev environment's build
// of main must talk to the dev environment's relay and account service and never the players' - and every other build,
// a release, a desktop build and node itself, must talk to the players'. The stamp is Vite's (VITE_DFO_RELAY,
// VITE_DFO_ACCOUNTS, written into the bundle as it builds), so it is held here by a build through Vite itself; what the
// client makes of a stamp is held in node, through each end's own law; and every fallback a tab reaches, by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
import { BUILD_RELAY, BUILD_ACCOUNTS } from '../../src/net/serviceHome.js';
import { DEFAULT_SERVER, HOME_SERVER, homeServerOf } from '../../src/net/online.js';
import { DEFAULT_ACCOUNT_SERVICE, HOME_ACCOUNT_SERVICE, homeAccountServiceOf, serviceBase } from '../../src/net/accountClient.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const DEV_RELAY = 'wss://dev.daggerfalljs.dev/relay';
const DEV_ACCOUNTS = 'https://dev.daggerfalljs.dev/accounts';

/** serviceHome.js built by Vite with the environment given - the way dev-deploy.yml builds the site - and imported. */
async function builtHome(env) {
  const dir = mkdtempSync(join(tmpdir(), 'servicehome-'));
  const kept = { VITE_DFO_RELAY: process.env.VITE_DFO_RELAY, VITE_DFO_ACCOUNTS: process.env.VITE_DFO_ACCOUNTS };
  try {
    for (const [k, v] of Object.entries(env)) process.env[k] = v;
    await build({
      root: dir, configFile: false, logLevel: 'silent',
      build: { outDir: join(dir, 'dist'), minify: false, lib: { entry: join(root, 'src/net/serviceHome.js'), formats: ['es'], fileName: 'home' } },
    });
    const out = readdirSync(join(dir, 'dist')).find((f) => /^home\.m?js$/.test(f));
    return await import(pathToFileURL(join(dir, 'dist', out)).href);
  } finally {
    for (const [k, v] of Object.entries(kept)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    rmSync(dir, { recursive: true, force: true });
  }
}

test('DEV-ENV: a build made for the dev environment carries its services into the bundle, and one made for nobody carries none - through Vite itself (mutants: the stamp unread)', async () => {
  const dev = await builtHome({ VITE_DFO_RELAY: DEV_RELAY, VITE_DFO_ACCOUNTS: DEV_ACCOUNTS });
  assert.equal(dev.BUILD_RELAY, DEV_RELAY);
  assert.equal(dev.BUILD_ACCOUNTS, DEV_ACCOUNTS);
  const players = await builtHome({});
  assert.equal(players.BUILD_RELAY, null, 'a release names no relay of its own');
  assert.equal(players.BUILD_ACCOUNTS, null);
  // ...and node, a test, a Worker: no stamp at all
  assert.equal(BUILD_RELAY, null);
  assert.equal(BUILD_ACCOUNTS, null);
});

test('DEV-ENV: the client calls a stamped service home only if its own law takes it - wss:// (ws:// on localhost), https:// - and the players\' otherwise; an unstamped build is the players\' (mutants: a refused relay taken; a refused service taken)', () => {
  assert.equal(homeServerOf(DEV_RELAY), DEV_RELAY);
  assert.equal(homeServerOf('ws://localhost:8787'), 'ws://localhost:8787', 'a relay on the machine itself');
  for (const refused of ['http://dev.daggerfalljs.dev/relay', 'ws://dev.daggerfalljs.dev/relay', 'dev.daggerfalljs.dev', '', null, undefined]) {
    assert.equal(homeServerOf(refused), DEFAULT_SERVER, String(refused));
  }
  assert.equal(homeAccountServiceOf(DEV_ACCOUNTS), DEV_ACCOUNTS);
  for (const refused of ['http://dev.daggerfalljs.dev/accounts', 'https://', 'dev.daggerfalljs.dev', '', null, undefined]) {
    assert.equal(homeAccountServiceOf(refused), DEFAULT_ACCOUNT_SERVICE, String(refused));
  }
  assert.equal(HOME_SERVER, DEFAULT_SERVER, 'this build - node - is the players\'');
  assert.equal(HOME_ACCOUNT_SERVICE, DEFAULT_ACCOUNT_SERVICE);
  assert.equal(serviceBase(null), DEFAULT_ACCOUNT_SERVICE, 'a device that stored no service calls this build\'s home');
});

test('DEV-ENV: every fallback a tab reaches is the build\'s home - the session\'s, the world host\'s, the Relay field\'s, the account door\'s - and nothing else in the client falls back to the players\' services by name (mutants: the world host on the players\' relay)', () => {
  const online = rd('src/net/online.js');
  assert.match(online, /^export const HOME_SERVER = homeServerOf\(BUILD_RELAY\);$/m);
  assert.match(online, /constructor\(\{ url = HOME_SERVER, /);
  assert.match(online, /this\.url = relayUrl\(url \|\| HOME_SERVER\);/);
  assert.match(rd('src/scenes/world.js'), /url: params\.get\('server'\) \|\| getPref\('onlineServer'\) \|\| HOME_SERVER,\n/);
  assert.match(rd('src/ui/enhanced/enhancedMenu.js'), /field\(t\('menu\.online\.relay', 'Relay'\), 'onlineServer', HOME_SERVER, 200\)/);
  const account = rd('src/net/accountClient.js');
  assert.match(account, /^export const HOME_ACCOUNT_SERVICE = homeAccountServiceOf\(BUILD_ACCOUNTS\);$/m);
  assert.match(account, /export async function call\(\{ fetch, base = HOME_ACCOUNT_SERVICE, /);
  assert.match(account, /SERVICE_URL\.test\(v\)\) \? v : HOME_ACCOUNT_SERVICE;\n\s*\} catch \{ return HOME_ACCOUNT_SERVICE; \}/);
  // the players' constants are named in code by their own homes alone (comments aside) - a new fallback is the home's
  const code = (text) => text.split('\n').filter((l) => !/^\s*(\/\/|\/?\*)/.test(l)).map((l) => l.replace(/\s\/\/.*$/, '')).join('\n');
  const walk = (dir, out = []) => {
    for (const name of readdirSync(join(root, dir))) {
      const rel = `${dir}/${name}`;
      if (statSync(join(root, rel)).isDirectory()) walk(rel, out);
      else if (name.endsWith('.js')) out.push(rel);
    }
    return out;
  };
  const strays = [];
  for (const f of walk('src')) {
    const c = code(rd(f));
    if (f !== 'src/net/online.js' && /\bDEFAULT_SERVER\b/.test(c)) strays.push(`${f}: DEFAULT_SERVER`);
    if (f !== 'src/net/accountClient.js' && /\bDEFAULT_ACCOUNT_SERVICE\b/.test(c)) strays.push(`${f}: DEFAULT_ACCOUNT_SERVICE`);
  }
  assert.deepEqual(strays, [], 'a fallback to the players\' service by name - a dev build would call it home');
});
