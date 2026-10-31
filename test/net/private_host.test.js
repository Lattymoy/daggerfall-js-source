// A private server on a player's own PC (app/lib/privateHost.mjs) and the page's side of it
// (src/net/privateServer.js). The host's minter, the address a player types, the front's player cap and the page's
// address and sign-in are driven here; the relay in local workerd with two real game pages is tools/privateHostProbe.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';

import { tokenMinter, parseAddress, frontServer, PRIVATE_PORT } from '../../app/lib/privateHost.mjs';
import { privateServer, privateMinter, privateSubject } from '../../src/net/privateServer.js';
import { serviceBase, PRIVATE_NO_SERVICE, DEFAULT_ACCOUNT_SERVICE } from '../../src/net/accountClient.js';
import { verifyToken, importPublicKeyB64, _b64url } from '../../src/net/identityToken.js';

const subtle = globalThis.crypto.subtle;
const keys = async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = _b64url.encode(new Uint8Array(await subtle.exportKey('raw', kp.publicKey)));
  return { kp, verify: await importPublicKeyB64(pub, { subtle }) };
};

test('the host mints guest tokens its relay verifies, never the same bytes twice, and refuses a name no relay takes', async () => {
  const { kp, verify } = await keys();
  const mint = tokenMinter(kp.privateKey, { now: () => 1_800_000_000_000 });
  const a = await mint({ s: 'p0123456789abcdef01234567', n: 'Sir Host' });
  const b = await mint({ s: 'p0123456789abcdef01234567', n: 'Sir Host' });
  assert.ok(a && b && a !== b, 'one subject minted twice in one second is two signatures (the relay spends each once)');
  const r = await verifyToken(a, verify, { subtle, nowS: 1_800_000_000 });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.claims.n, 'Sir Host');
  assert.equal(r.claims.k, 'guest');
  assert.equal(await mint({ s: 'p0123456789abcdef01234567', n: '' }), null);
  assert.equal(await mint({ s: 'x', n: 'Fine Name' }), null, 'a subject outside ID_RE');
});

test('an address a player types: host, host:port, a bracketed IPv6, with or without a scheme', () => {
  assert.deepEqual(parseAddress('192.168.1.20'), { host: '192.168.1.20', port: PRIVATE_PORT });
  assert.deepEqual(parseAddress(' 100.64.0.7:9000 '), { host: '100.64.0.7', port: 9000 });
  assert.deepEqual(parseAddress('ws://my-pc.tail1234.ts.net:7777/'), { host: 'my-pc.tail1234.ts.net', port: 7777 });
  assert.deepEqual(parseAddress('[fd7a:115c::1]:7777'), { host: 'fd7a:115c::1', port: 7777 });
  for (const bad of ['', 'a b', 'host:0', 'host:70000', 'host:port']) assert.equal(parseAddress(bad), null, bad);
});

test('the front counts a player per address and refuses a new one past the cap', async () => {
  const { kp } = await keys();
  const { server, players } = frontServer({ relayPort: 1, mint: tokenMinter(kp.privateKey), maxPlayers: 2 });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const ask = (path, body, localAddress) => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method: body ? 'POST' : 'GET', localAddress }, (res) => {
      let t = ''; res.on('data', (c) => { t += c; }); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(t), cors: res.headers['access-control-allow-origin'] }));
    });
    req.on('error', reject);
    req.end(body ? JSON.stringify(body) : undefined);
  });
  try {
    const one = await ask('/private/token', { s: 'p0123456789abcdef01234567', n: 'One' }, '127.0.0.1');
    assert.equal(one.status, 200);
    assert.equal(typeof one.body.tok, 'string');
    assert.equal(one.cors, '*', 'the game page is another origin (dagger://game)');
    assert.equal((await ask('/private/token', { s: 'p1123456789abcdef01234567', n: 'Two' }, '127.0.0.2')).status, 200);
    assert.equal(players().size, 2);
    assert.deepEqual((await ask('/private/token', { s: 'p2123456789abcdef01234567', n: 'Three' }, '127.0.0.3')).body, { error: 'full' });
    assert.equal((await ask('/private/token', { s: 'p0123456789abcdef01234567', n: 'One' }, '127.0.0.1')).status, 200, 'a player already in is never refused');
    const info = await ask('/private/info', null, '127.0.0.1');
    assert.deepEqual({ players: info.body.players, max: info.body.max }, { players: 2, max: 2 });
    assert.equal((await ask('/private/token', { s: 'p0123456789abcdef01234567', n: '' }, '127.0.0.1')).status, 400);
  } finally { server.close(); }
});

test('the page plays on the private server the shell names - a loopback ws:// address alone', () => {
  assert.deepEqual(privateServer({ privateServer: { url: 'ws://127.0.0.1:7777' } }), { url: 'ws://127.0.0.1:7777' });
  assert.equal(privateServer({ privateServer: null }), null);
  assert.equal(privateServer(undefined), null);
  assert.equal(privateServer({ privateServer: { url: 'ws://192.168.1.20:7777' } }), null, 'a LAN address is the bridge\'s to reach, never the page\'s');
  assert.equal(privateServer({ privateServer: { url: 'wss://daggerfall-online.mackcothran.workers.dev' } }), null, 'never the main relay');
});

test('on a private server the page asks the host for its token and reaches no account service', async () => {
  const calls = [];
  const fetch = async (u, init) => { calls.push({ u, body: JSON.parse(init.body) }); return { ok: true, json: async () => ({ tok: 'T' }) }; };
  const mint = privateMinter({ url: 'ws://127.0.0.1:7777' }, { fetch, subject: () => 'p0123456789abcdef01234567', name: () => 'Sir  Host' });
  assert.equal(await mint('world:1,1'), 'T');
  assert.equal(calls[0].u, 'http://127.0.0.1:7777/private/token');
  assert.equal(calls[0].body.s, 'p0123456789abcdef01234567');
  assert.equal(typeof calls[0].body.n, 'string');
  const down = privateMinter({ url: 'ws://127.0.0.1:7777' }, { fetch: async () => { throw new Error('refused'); }, subject: () => 'p0', name: () => 'x' });
  assert.equal(await down(), null);
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const s = privateSubject(storage);
  assert.match(s, /^p[0-9a-f]{24}$/);
  assert.equal(privateSubject(storage), s, 'one subject a device');

  const prior = globalThis.daggerShell;
  try {
    assert.equal(serviceBase(storage), DEFAULT_ACCOUNT_SERVICE);
    globalThis.daggerShell = { privateServer: { url: 'ws://127.0.0.1:7777' } };
    assert.equal(serviceBase(storage), PRIVATE_NO_SERVICE);
  } finally { globalThis.daggerShell = prior; }
});

test('the launcher shows the private server: host, join, the addresses a friend types', () => {
  const require = createRequire(import.meta.url);
  const L = require('../../app/lib/launcherState.cjs');
  let s = L.initialState({ current: '1.0.0', checkEnabled: false });
  assert.equal(L.viewOf(s).options.privateServer.on, false);
  s = L.reduce(s, { type: 'private', priv: { status: 'hosting', port: 7777, max: 10, players: 3, addresses: ['192.168.1.5', '100.64.0.7'] } });
  const v = L.viewOf(s).options.privateServer;
  assert.equal(v.on, true);
  assert.match(v.note, /3 of 10 players/);
  assert.match(v.note, /192\.168\.1\.5:7777 or 100\.64\.0\.7:7777/);
  s = L.reduce(s, { type: 'private', priv: { status: 'joining', address: 'x:1' } });
  assert.equal(L.viewOf(s).options.privateServer.enabled, false, 'no second press while it is reaching the host');
});
