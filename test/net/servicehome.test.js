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
import { execFileSync } from 'node:child_process';
import { build, createServer } from 'vite';
import viteConfig from '../../vite.config.js';
import { BUILD_RELAY, BUILD_ACCOUNTS } from '../../src/net/serviceHome.js';
import { DEFAULT_SERVER, HOME_SERVER, homeServerOf } from '../../src/net/online.js';
import { DEFAULT_ACCOUNT_SERVICE, HOME_ACCOUNT_SERVICE, homeAccountServiceOf, serviceBase } from '../../src/net/accountClient.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const DEV_RELAY = 'wss://dev.daggerfalljs.dev/relay';
const DEV_ACCOUNTS = 'https://dev.daggerfalljs.dev/accounts';
/** A variable of the builder's environment the client never reads - and no bundle may carry (AUDIT RELEASE-FLOW E2). */
const STRAY = 'VITE_DFO_NOT_FOR_THE_BUNDLE';

/** `env` set in this process for `fn`, and put back after. */
async function withEnv(env, fn) {
  const kept = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  try {
    for (const [k, v] of Object.entries(env)) process.env[k] = v;
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(kept)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
}

/** serviceHome.js built by Vite with `env` in the builder's environment - the way dev-deploy.yml builds the site: the
 *  built text, and what the module exports to a node holding NO `VITE_*` variable of its own. AUDIT RELEASE-FLOW E3:
 *  imported by this process, which still held the variables, a module that read process.env passed for Vite. */
async function builtHome(env) {
  const dir = mkdtempSync(join(tmpdir(), 'servicehome-'));
  try {
    await withEnv(env, () => build({
      root: dir, configFile: false, logLevel: 'silent',
      build: { outDir: join(dir, 'dist'), minify: false, lib: { entry: join(root, 'src/net/serviceHome.js'), formats: ['es'], fileName: 'home' } },
    }));
    const file = join(dir, 'dist', readdirSync(join(dir, 'dist')).find((f) => /^home\.m?js$/.test(f)));
    const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('VITE_')));
    const out = execFileSync(process.execPath, ['--input-type=module', '-e',
      `const m = await import(${JSON.stringify(pathToFileURL(file).href)}); console.log(JSON.stringify([m.BUILD_RELAY, m.BUILD_ACCOUNTS]));`],
    { env: clean, encoding: 'utf8' });
    return { text: readFileSync(file, 'utf8'), stamps: JSON.parse(out) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('DEV-ENV (AUDIT RELEASE-FLOW E2, E3): a build made for the dev environment writes its two services into the bundle, by value, and nothing else of the builder\'s environment; one made for nobody writes none - each read by a node that holds no stamp of its own (mutants: the stamp unread; the whole environment read; the stamp read from the process)', async () => {
  const dev = await builtHome({ VITE_DFO_RELAY: DEV_RELAY, VITE_DFO_ACCOUNTS: DEV_ACCOUNTS, [STRAY]: 'leaked' });
  assert.deepEqual(dev.stamps, [DEV_RELAY, DEV_ACCOUNTS], 'the bundle carries its home');
  assert.ok(dev.text.includes(`"${DEV_RELAY}"`) && dev.text.includes(`"${DEV_ACCOUNTS}"`), 'written in by value, as Vite builds it');
  assert.ok(!dev.text.includes(STRAY) && !dev.text.includes('leaked'), 'and no other variable of the builder\'s environment');
  const players = await builtHome({});
  assert.deepEqual(players.stamps, [null, null], 'a release names no service of its own');
  assert.ok(!players.text.includes('dev.daggerfalljs.dev'));
  // ...and node, a test, a Worker: no stamp at all
  assert.equal(BUILD_RELAY, null);
  assert.equal(BUILD_ACCOUNTS, null);
  // the project's own config hands Vite's VITE_ variables to the client, and writes none over
  assert.ok(viteConfig.envPrefix === undefined || [].concat(viteConfig.envPrefix).includes('VITE_'), 'envPrefix keeps VITE_');
  assert.ok(!Object.keys(viteConfig.define ?? {}).some((k) => /import\.meta\.env|VITE_DFO/.test(k)), 'no define stands over the stamp');
});

test('DEV-ENV (AUDIT RELEASE-FLOW E2): Vite\'s dev server serves the stamp as a build writes it - `npm run dev` with VITE_DFO_RELAY set calls that relay, never the players\' (mutants: the whole environment read)', async () => {
  await withEnv({ VITE_DFO_RELAY: DEV_RELAY, VITE_DFO_ACCOUNTS: DEV_ACCOUNTS }, async () => {
    const server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] } });
    try {
      const served = (await server.transformRequest('/src/net/serviceHome.js'))?.code ?? '';
      assert.ok(served.includes(DEV_RELAY) && served.includes(DEV_ACCOUNTS), 'the dev server writes both stamps in');
    } finally {
      await server.close();
    }
  });
});

test('DEV-ENV (AUDIT RELEASE-FLOW E1): the client calls a stamped service home only exactly as its own law writes it - wss:// (ws:// on the machine itself), https:// with no trailing slash - and a stamp its law refuses stops the build, said, where it used to become the players\' service; an unstamped build is the players\' (mutants: a refused relay taken; a refused service taken; a refused relay the players\'; a refused service the players\')', () => {
  assert.equal(homeServerOf(DEV_RELAY), DEV_RELAY);
  assert.equal(homeServerOf('ws://localhost:8787'), 'ws://localhost:8787', 'a relay on the machine itself');
  for (const refused of ['ws://10.66.0.1:8787', 'http://dev.daggerfalljs.dev/relay', 'wss://dev_env.example/relay', `${DEV_RELAY}/`, ` ${DEV_RELAY}`, `${DEV_RELAY}\n`, 'dev.daggerfalljs.dev', '']) {
    assert.throws(() => homeServerOf(refused), /no relay a client may connect to as written - it calls no relay home, the players' least of all/, JSON.stringify(refused));
  }
  assert.equal(homeAccountServiceOf(DEV_ACCOUNTS), DEV_ACCOUNTS);
  for (const refused of ['http://10.66.0.1:8788', 'http://dev.daggerfalljs.dev/accounts', `${DEV_ACCOUNTS}/`, ` ${DEV_ACCOUNTS}`, `${DEV_ACCOUNTS}\n`, 'https://', 'dev.daggerfalljs.dev', '']) {
    assert.throws(() => homeAccountServiceOf(refused), /may not be pointed at as written - it calls no account service home, the players' least of all/, JSON.stringify(refused));
  }
  for (const none of [null, undefined]) {
    assert.equal(homeServerOf(none), DEFAULT_SERVER, 'no stamp: the players\' relay');
    assert.equal(homeAccountServiceOf(none), DEFAULT_ACCOUNT_SERVICE, 'no stamp: the players\' service');
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
