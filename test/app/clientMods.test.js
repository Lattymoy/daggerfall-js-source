import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { clientModResponse } from '../../app/lib/clientMods.cjs';
import { createClientModHost } from '../../src/systems/clientMods.js';
import { loadClientMods } from '../../src/systems/clientModsLoader.js';

const manifest = { enabled: true, apiVersion: 1, mods: [{ id: 'health-numbers', apiVersion: 1, requires: ['hud.health-label'], entry: 'main.js' }] };
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dfo-client-mod-test-'));
  const files = [], dirs = [root];
  const dir = async name => { const file = path.join(root, name); await fs.mkdir(file); dirs.push(file); return file; };
  const write = async (name, data) => {
    const file = path.join(root, name); await fs.writeFile(file, data);
    if (!files.includes(file)) files.push(file); return file;
  };
  // Only remove explicitly created fixture entries; unexpected files prevent rmdir, never broad recursive deletion.
  t.after(async () => {
    assert.equal(await fs.realpath(root), path.resolve(root));
    for (const file of [...files].reverse()) await fs.unlink(file);
    for (const file of [...dirs].reverse()) await fs.rmdir(file);
  });
  await dir('ClientMods'); await dir('ClientMods/health-numbers');
  await write('ClientMods/enabled.json', JSON.stringify(manifest));
  const request = (name = 'index.json', options) => clientModResponse(new Request(`dagger://game/__client_mods/${name}`, options), root);
  return { root, dir, write, request, files };
}

test('shell serves a sanitized explicit index and loads the example through the real route', async t => {
  const f = await fixture(t);
  const source = await fs.readFile(new URL('../../examples/client-mods/health-numbers/main.js', import.meta.url), 'utf8');
  await f.write('ClientMods/health-numbers/main.js', source);
  const index = await f.request(); assert.equal(index.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await index.json(), manifest);
  const host = createClientModHost();
  const session = loadClientMods({ host, fetchIndex: () => f.request(), importModule: async url => {
    const response = await f.request(url.slice('/__client_mods/'.length));
    assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'text/javascript');
    return import(`data:text/javascript;base64,${Buffer.from(await response.text()).toString('base64')}`);
  } });
  await session.ready; assert.equal(host.healthLabel(41.2, 118, '35%'), '42/118');
  session.dispose(); assert.equal(host.healthLabel(41.2, 118, '35%'), '35%');
});
test('disabled/malformed/oversized indexes never expose mod files', async t => {
  const f = await fixture(t); await f.write('ClientMods/health-numbers/main.js', 'export default () => {};');
  for (const value of [{ ...manifest, enabled: false }, { ...manifest, apiVersion: 2 }, { ...manifest, mods: Array(33).fill(manifest.mods[0]) },
    { ...manifest, mods: [manifest.mods[0], manifest.mods[0]] }, { ...manifest, mods: [{ ...manifest.mods[0], entry: '../escape.js' }] },
    { ...manifest, mods: [{ ...manifest.mods[0], id: 'x:stream' }] }, null]) {
    await f.write('ClientMods/enabled.json', JSON.stringify(value));
    assert.equal((await (await f.request()).json()).enabled, false);
    assert.equal((await f.request('health-numbers/main.js')).status, 404);
  }
  for (const text of ['{bad', ' '.repeat(65537)]) {
    await f.write('ClientMods/enabled.json', text); assert.equal((await (await f.request()).json()).enabled, false);
  }
});
test('undeclared modules, traversal, streams, unsupported types and non-game requests are rejected', async t => {
  const f = await fixture(t); await f.write('ClientMods/health-numbers/main.js', 'export default () => {};');
  await f.write('ClientMods/health-numbers/secret.txt', 'fixture only');
  for (const name of ['other/main.js', 'health-numbers/secret.txt', 'health-numbers/%2e%2e%2fsecret.js',
    'health-numbers/%5csecret.js', 'health-numbers/main.js:stream', 'health-numbers//main.js', 'health-numbers/main.js%00']) {
    assert.equal((await f.request(name)).status, 404, name);
  }
  assert.equal((await f.request('index.json', { method: 'POST' })).status, 404);
  assert.equal((await clientModResponse(new Request('dagger://launcher/__client_mods/index.json'), f.root)).status, 404);
});
test('oversized assets and a directory symlink outside the mod root are rejected', async t => {
  const f = await fixture(t);
  await f.write('ClientMods/health-numbers/main.js', 'x'.repeat(1024 * 1024 + 1));
  assert.equal((await f.request('health-numbers/main.js')).status, 404);
  const outside = await f.dir('outside'); await f.write('outside/data.js', 'fixture outside mod root');
  const link = path.join(f.root, 'ClientMods/health-numbers/escape');
  await fs.symlink(outside, link, 'junction'); f.files.push(link);
  assert.equal((await f.request('health-numbers/escape/data.js')).status, 404);
});
test('a missing manifest leaves the game unmodified and performs no profile writes', async t => {
  const f = await fixture(t);
  await fs.unlink(path.join(f.root, 'ClientMods/enabled.json'));
  f.files.splice(f.files.indexOf(path.join(f.root, 'ClientMods/enabled.json')), 1);
  assert.deepEqual(await (await f.request()).json(), { enabled: false, apiVersion: 1, mods: [] });
  assert.deepEqual((await fs.readdir(f.root)).sort(), ['ClientMods']);
});
