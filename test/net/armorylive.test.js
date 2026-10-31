// ARMORY (2026-10-28; bible/04-Characters/Aura-Armory.md section 4): A KIT WORN REACHES THE ROOM, the aura's way (AURA-LIVE).
// The relay reads a peer's kit off the token alone (`ak`) and badges it on the peer's row; the session keeps it with the
// id, so a peer re-stood after a blip is dressed at once. These pins run the session's reading, then a real minter and the
// real Room (test/fakeRoom.mjs) end to end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OnlineSession, REHELLO_GAP_MS } from '../../src/net/online.js';
import { PIXEL_UNITS } from '../../src/net/wire.js';
import { accountTokenMinter, adoptIdentity, keepSession, storedSession } from '../../src/net/accountClient.js';
import { ownArmory } from '../../src/systems/ownGlyphs.js';
import { armoryWeaponLook } from '../../src/systems/weaponGlow.js';
import { createAuraHost } from '../../src/scenes/auraHost.js';
import { fakeRoom } from '../fakeRoom.mjs';
import { fakeSocketClass } from '../fakeSocket.mjs';

const at = (/** @type {number} */ px, /** @type {number} */ pz) => ({ x: px * PIXEL_UNITS + 10, y: 0, z: pz * PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });
const quiet = (/** @type {() => any} */ fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };
const until = async (/** @type {() => boolean} */ ready, /** @type {string} */ label) => {
  const deadline = Date.now() + 5000;
  while (!ready()) {
    assert.ok(Date.now() < deadline, `${label}: timed out`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};
const ROOM = 'dungeon:m1291010263';

test('ARMORY the online session: my own kit adopted through the wire\'s reader; a peer\'s off its introduction, its newest hello\'s whatever it is, kept with the id so a peer re-stood after a blip wears it at once (mutants: the peer\'s kit never read; the memory losing it; the re-stood peer bare)', () => quiet(() => {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { t: 1000 };
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => clock.t });
  assert.equal(s.armoryOf('mac-0001'), null);
  assert.equal(s.adoptIdentity({ name: 'Mac', armory: 'b0a00' }), true);
  assert.equal(s.armoryOf('mac-0001'), 'b0a00');
  assert.equal(s.adoptIdentity({ name: 'Mac' }), false, 'an older service\'s answer says nothing about it');
  assert.equal(s.adoptIdentity({ name: 'Mac', armory: 'zzzzz' }), true);
  assert.equal(s.armoryOf('mac-0001'), null, 'a kit of no pieces is none');
  const pose = { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 };
  s.join('world:2,12', pose); sockets[0].open();
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'peer-0002', name: 'Ember', ak: 'aaaa0', pose }], host: null, world: null });
  assert.equal(s.armoryOf('peer-0002'), 'aaaa0', 'off the introduction the relay stamped');
  sockets[0].receive({ t: 'join', id: 'peer-0002', name: 'Ember', pose });
  assert.equal(s.armoryOf('peer-0002'), null, 'the newest hello\'s, including none');
  sockets[0].receive({ t: 'join', id: 'peer-0002', name: 'Ember', ak: '0b000', pose });
  assert.equal(s.armoryOf('peer-0002'), '0b000');
  sockets[0].receive({ t: 'join', id: 'peer-0003', name: 'Liar', ak: 'q0000', pose });
  assert.equal(s.armoryOf('peer-0003'), null, 'a kit no relay stamps is read as none');
  sockets[0].receive({ t: 'leave', id: 'peer-0002' });
  assert.equal(s.peers.has('peer-0002'), false);
  assert.equal(s.armoryOf('peer-0002'), '0b000', 'an introduction is a fact about an id, kept');
  sockets[0].receive({ t: 'pose', id: 'peer-0002', p: { ...pose, x: 4 } });
  assert.equal(s.peers.get('peer-0002')?.ak, '0b000', 'the memory carries it onto the re-stood peer');
}));

/** A WebSocket class whose every socket is a socket of the real Room (auralive.test.js's bridge). */
function bridged(/** @type {any} */ r) {
  const sockets = [];
  class WS {
    constructor(/** @type {string} */ url) {
      this.url = url; this.closed = null; sockets.push(this);
      const server = r.connect();
      this.server = server;
      const shut = server.close.bind(server);
      server.close = (/** @type {number} */ code, /** @type {string} */ reason) => { shut(code, reason); if (!this.closed) { this.closed = { code, reason, by: 'relay' }; queueMicrotask(() => this.onclose?.({ code, reason })); } };
      server.send = (/** @type {string} */ s) => { if (server.closed) throw new Error('closed'); queueMicrotask(() => this.onmessage?.({ data: s })); };
      queueMicrotask(() => this.onopen?.());
    }
    send(/** @type {string} */ s) { if (this.closed) throw new Error('closed'); r.raw(this.server, s); }
    close(code = 1000, reason = '') {
      if (this.closed) return;
      this.closed = { code, reason, by: 'me' };
      if (!this.server.closed) r.drop(this.server);
      queueMicrotask(() => this.onclose?.({ code, reason }));
    }
  }
  return { WS, sockets };
}
/** A player in the room: a session and the kit its account wears now (what the next token signs). */
function player(/** @type {any} */ r, /** @type {string} */ id, /** @type {{ t: number }} */ clock) {
  const { WS, sockets } = bridged(r);
  const me = { kit: /** @type {string|null} */ (null), sockets, s: /** @type {any} */ (null) };
  me.s = new OnlineSession({ url: 'wss://relay.test', name: id, id, secret: 'secret-of-' + id, WebSocketImpl: WS, now: () => clock.t, mintToken: () => r.token(id, { ak: me.kit ?? undefined }) });
  return me;
}

test('ARMORY live: a kit put on mid-session reaches the room through the real relay\'s badge; changed, the latest goes; taken off, it goes the same way (mutants: the relay never badging the kit; the token never carrying it)', async () => {
  const r = fakeRoom(ROOM);
  await r.signer();
  const clock = { t: 1_000_000 };
  const a = player(r, 'aaaa-0001', clock), b = player(r, 'bbbb-0002', clock);
  quiet(() => a.s.join(ROOM, at(1, 1)));
  await until(() => a.s.host === 'aaaa-0001', 'a welcomed');
  quiet(() => b.s.join(ROOM, at(1, 1)));
  await until(() => b.s.peers.has('aaaa-0001'), 'b sees a');
  assert.equal(b.s.armoryOf('aaaa-0001'), null, 'no kit yet');
  a.kit = 'a000b';
  assert.equal(a.s.rehello(), true);
  await until(() => b.s.armoryOf('aaaa-0001') === 'a000b', 'b draws the crown and sees the edge');
  a.kit = 'b000b';
  assert.equal(a.s.rehello(), true);
  clock.t += REHELLO_GAP_MS; a.s.tick();
  await until(() => b.s.armoryOf('aaaa-0001') === 'b000b', 'the halo now');
  a.kit = null;
  a.s.rehello();
  clock.t += REHELLO_GAP_MS; a.s.tick();
  await until(() => b.s.armoryOf('aaaa-0001') === null, 'b drops the pieces');
});

/** A device's storage, as localStorage answers. */
const memStorage = () => { const m = new Map(); return { getItem: (/** @type {string} */ k) => m.get(k) ?? null, setItem: (/** @type {string} */ k, /** @type {string} */ v) => m.set(k, String(v)), removeItem: (/** @type {string} */ k) => m.delete(k) }; };

test('ARMORY-SEEN (players could not see their own pieces) - my kit through the producers that write it: the mint\'s answer hands it to the page and the stored session, `ownArmory` and the weapon glow read it back, a wear\'s answer lands the same way, and the world host hears the mint\'s kit, so a wear since is said again (mutants: keepSession dropping the kit; the minter dropping it)', async () => {
  const storage = memStorage();
  keepSession(storage, { id: 'p_me', name: 'Mac', kind: 'linked', sessionId: 's1', secret: 'SECRETSECRETSECRETSECRET' });
  let answer = /** @type {any} */ ({ token: 'v1.t.s', name: 'Mac', kind: 'linked', title: null, glyphs: [], level: 10, aura: null, armory: 'bbbb0' });
  const fetch = async () => ({ ok: true, status: 200, json: async () => answer });
  const issued = /** @type {any[]} */ ([]);
  const mint = accountTokenMinter({ fetch, storage, onIssued: (w) => issued.push(w), character: () => 'char-aaaa' });
  await mint();
  assert.equal(issued.at(-1).armory, 'bbbb0', 'the page is told the kit the token signed');
  assert.equal(storedSession(storage)?.armory, 'bbbb0', 'and the stored session keeps it');
  assert.equal(ownArmory(storage), 'bbbb0', 'so my own body wears it');
  assert.deepEqual([armoryWeaponLook(ownArmory(storage)), armoryWeaponLook(ownArmory(memStorage()))], [null, null], 'no weapon piece in this kit, none with no session');
  const { armory: _drop, ...older } = answer;
  answer = older;
  await mint();
  assert.deepEqual(['armory' in issued.at(-1), ownArmory(storage)], [false, 'bbbb0'], 'an older service says nothing, and the kit stays');
  // a wear's answer (ui/accountFlow.js armoryWore) - a weapon piece too, which the glow reads off the same word
  assert.equal(adoptIdentity(storage, { armory: 'a000b', secret: 'SECRETSECRETSECRETSECRET' }), true);
  assert.deepEqual([ownArmory(storage), armoryWeaponLook(ownArmory(storage))], ['a000b', 'edge']);
  assert.equal(adoptIdentity(storage, { armory: 'a000b', secret: 'SECRETSECRETSECRETSECRET' }), false, 'a kit that did not change is not written again');
  answer = { ...older, armory: null };
  await mint();
  assert.deepEqual([issued.at(-1).armory, ownArmory(storage)], [null, null], 'none, said and kept');
  // THE WORLD HOST on the same device: the mint's kit heard, my body dressed, and a wear since said to the room again
  answer = { ...older, armory: 'bbbb0' };
  await mint();
  const was = globalThis.localStorage;
  globalThis.localStorage = /** @type {any} */ (storage);
  try {
    let rehellos = 0;
    const online = { rehello: () => { rehellos++; return true; }, auraOf: () => null, armoryOf: () => null };
    const host = createAuraHost({
      renderer: { gl: null }, online: () => online, travelActive: () => false, quiet: () => false, camYaw: () => 0,
      player: () => ({ feetAt: () => [1, 0, 2], bodyYawFor: () => 0, height: 1.8, riding: false }),
      spawned: () => true, beast: () => false, veiled: () => false, toScene: (/** @type {any} */ s) => s.at,
      sprites: () => [], bodies: () => null,
    });
    host.issued(issued.at(-1));
    host.frame([]);
    assert.deepEqual([host.armoryWearersNow().map((w) => w.kit), rehellos], [['bbbb0'], 0], 'my kit on my body, the room already told');
    adoptIdentity(storage, { armory: 'b000b', secret: 'SECRETSECRETSECRETSECRET' });
    host.frame([]);
    assert.deepEqual([host.armoryWearersNow().map((w) => w.kit), rehellos], [['b000b'], 1], 'a wear since: drawn now, and said again');
  } finally {
    if (was === undefined) delete globalThis.localStorage; else globalThis.localStorage = was;
  }
});

test('ARMORY-SEEN the stored session keeps every field adoptIdentity writes - the kit was written and dropped by keepSession\'s list (mutants: keepSession dropping the kit)', () => {
  const src = readFileSync(new URL('../../src/net/accountClient.js', import.meta.url), 'utf8');
  const adopt = src.slice(src.indexOf('export function adoptIdentity('), src.indexOf('\n}\n', src.indexOf('export function adoptIdentity(')));
  const written = [...new Set([...adopt.matchAll(/\bnext\.(\w+) = /g)].map((m) => m[1]))];
  const kept = src.match(/storage\?\.setItem\?\.\(SESSION_KEY, JSON\.stringify\(\{ ([^}]+) \}\)\)/)?.[1].split(/,\s*/) ?? [];
  assert.ok(written.length >= 7 && written.includes('armory'), `adoptIdentity's fields read (${written})`);
  assert.deepEqual(written.filter((f) => !kept.includes(f)), [], 'each one kept');
});
