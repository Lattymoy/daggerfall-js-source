// AUDIT RELEASE-FLOW D3 (2026-10-19, bible/01-Overview/Release-Flow.md, DEV-ENV): THE DEV ENVIRONMENT'S FEEDS AND LAW
// DOOR, AS ITS UNITS SET THEM.
//
// The dev relay posts its chat feed and its grant windows to the dev account service, and the service pushes a mute or a
// ban to the dev relay - each through its service binding (ACCOUNTS, RELAY), which wrangler's dev registry points at the
// other Worker's own session; the URL names the path. The units gave them http:// addresses, and every one of the three
// sends nothing for a URL that is not https:// - so in dev no public line reached the reviewer's feed, no grant window
// was posted and no sanction was pushed live, with the units' own comments saying the feeds were wired. Each is driven
// here with the value its unit hands `wrangler dev`, through a binding, and must post to the path production's own
// wrangler.toml names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeRoom } from '../fakeRoom.mjs';
import { CHAT_WORLD_ROOM, cellRoomOfWire, PIXEL_UNITS } from '../../src/net/wire.js';
import { GRANT_MEASURE_MS } from '../../src/net/grantMeasure.js';
import { pushLaw } from '../../server-account/src/sanctions.js';

const { subtle } = globalThis.crypto;
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** The value a dev unit hands `wrangler dev` for a var (`--var NAME:value`). */
const unitVar = (unit, name) => {
  const v = new RegExp(`--var ${name}:(\\S+)`).exec(rd(`ops/dev/${unit}`))?.[1];
  assert.ok(v, `ops/dev/${unit} sets no ${name}`);
  return v;
};
/** The path production's wrangler.toml gives a var's URL. */
const prodPath = (toml, name) => new URL(new RegExp(`^${name} = "([^"]+)"$`, 'm').exec(rd(toml))[1]).pathname;
/** A binding that records what it is handed and answers as the other Worker would. */
const binding = (posts) => ({ fetch: async (req) => { posts.push(new URL(req.url).pathname); return Response.json({ ok: true }, { status: 202 }); } });
/** A room holding the relay's receipt key, as the deploy puts it. */
async function keyedRoom(key, opts) {
  const r = fakeRoom(key, opts);
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  r.env.GATE_SIGNING_KEY = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  return r;
}

test('AUDIT RELEASE-FLOW D3: the dev relay\'s chat feed, as dfo-dev-relay.service sets it, is posted through the ACCOUNTS binding to the path production\'s feed has (mutants: the feed\'s URL http:// again)', async () => {
  const r = await keyedRoom(CHAT_WORLD_ROOM);
  const posts = [];
  r.env.MOD_FEED_URL = unitVar('dfo-dev-relay.service', 'MOD_FEED_URL');
  r.env.ACCOUNTS = binding(posts);
  const a = r.connect();
  await r.hello(a, 'aaaa-0001', null, { kind: 'linked' });
  await r.chat(a, 'a line the reviewer reads');
  assert.equal(await r.room._feedFlush(), true, `the relay posted nothing for ${r.env.MOD_FEED_URL}`);
  assert.deepEqual(posts, [prodPath('server/wrangler.toml', 'MOD_FEED_URL')]);
});

test('AUDIT RELEASE-FLOW D3: the dev relay\'s grant windows, as dfo-dev-relay.service sets them, are posted through the ACCOUNTS binding to the path production\'s have (mutants: the grant feed\'s URL http:// again)', async (t) => {
  let now = 1_800_000_000_000;
  t.mock.method(Date, 'now', () => now);
  const at = { x: 402 * PIXEL_UNITS + 100, y: 60, z: (499 - 151) * PIXEL_UNITS + 100, yaw: 0, pitch: 0 };
  const r = await keyedRoom(cellRoomOfWire(at.x, at.z), { now: () => now });
  const posts = [];
  r.env.GRANT_FEED_URL = unitVar('dfo-dev-relay.service', 'GRANT_FEED_URL');
  r.env.ACCOUNTS = binding(posts);
  t.after(() => r.room._grantFlush());
  const ws = r.connect();
  await r.hello(ws, 'peer-0001', at, { lv: 7, charLevel: 12 });
  await r.raw(ws, JSON.stringify({ t: 'grant', k: 'mint', id: 1, kind: 'enc', n: 2 }));
  now += GRANT_MEASURE_MS;
  assert.equal(await r.room._grantFlush(), true, `the relay posted nothing for ${r.env.GRANT_FEED_URL}`);
  assert.deepEqual(posts, [prodPath('server/wrangler.toml', 'GRANT_FEED_URL')]);
});

test('AUDIT RELEASE-FLOW D3: the dev account service\'s law door, as dfo-dev-accounts.service sets it, pushes a sanction through the RELAY binding to the path production\'s does (mutants: the law door\'s URL http:// again)', async () => {
  const posts = [];
  const env = { RELAY_LAW_URL: unitVar('dfo-dev-accounts.service', 'RELAY_LAW_URL'), RELAY: binding(posts) };
  assert.equal(await pushLaw(env, () => { throw new Error('an address fetched past the binding'); }, 'v1.order'), true, `the service pushed nothing for ${env.RELAY_LAW_URL}`);
  assert.deepEqual(posts, [prodPath('server-account/wrangler.toml', 'RELAY_LAW_URL')]);
});
