// STAFF-PANEL5 LIVE (2026-10-23, mob: "follow does not work", "tried didnt follow player at all", "freeze does nothing",
// "froze a player he still moves") - THE WHOLE FOLLOW AND THE WHOLE FREEZE OVER THE REAL RELAY: a target's real OnlineSession (its cell and its hub link, which hops to its shard and sends where
// notes) and the real createStaffHook (its hub link and its eye), every socket a bridge to a real Room (test/fakeRoom.mjs),
// the hub's sixteen shards and their bus driven to rest between frames, follow tokens shaped as the account service mints
// them (server-account/src/staffFollow.js). No step stubbed between the panel's pick and the camera. The freeze: the
// service's signed order through the Worker's law door, the target's hub link told `frozen` and its lease handed to its
// cell (scenes/chatSafetyHost.js), and a second player in the cell who must see them stand still.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fakeRooms, roomSigner } from '../fakeRoom.mjs';
import { OnlineSession, roomKeyFor } from '../../src/net/online.js';
import { reconnectWave } from '../../src/net/reconnectWave.js';
import { SOCIAL_ROOM, PIXEL_UNITS, isSocialRoom } from '../../src/net/wire.js';
import * as H from '../../src/net/hubShards.js';
import { createStaffHook } from '../../src/net/staffHook.js';
import { mintToken, mintFreezeOrder } from '../../src/net/identityToken.js';
import worker from '../../server/src/index.js';
import { SAFE_LAW_PATH } from '../../server/src/relay.js';

const quiet = async (fn) => { const keep = { info: console.info, warn: console.warn, log: console.log }; console.info = console.warn = console.log = () => {}; try { return await fn(); } finally { Object.assign(console, keep); } };
const turn = () => new Promise((r) => setImmediate(r));

async function world(fn) {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  const W = fakeRooms({ now: () => clock });
  try {
    return await quiet(async () => {
      const service = {};
      const signer = roomSigner(service, () => clock);
      await signer.signer();
      const gate = Buffer.from(new Uint8Array(await globalThis.crypto.subtle.exportKey('pkcs8', (await globalThis.crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])).privateKey))).toString('base64');
      const room = (name) => { const r = W.room(name); r.env.IDENTITY_PUBLIC_KEY ??= service.IDENTITY_PUBLIC_KEY; r.env.GATE_SIGNING_KEY ??= gate; return r; };
      const pending = [];
      const opened = [];
      class BridgeWS {
        constructor(url) {
          this.url = url;
          this.key = decodeURIComponent(/\/room\/([^?]+)/.exec(url)[1]);
          this.r = room(this.key);
          this.readyState = 0;
          opened.push(this.key);
          const rws = this.r.connect();
          const send = rws.send.bind(rws), close = rws.close.bind(rws);
          rws.send = (s) => { send(s); pending.push(() => { if (this.readyState === 1) this.onmessage?.({ data: s }); }); };
          rws.close = (code, reason) => { close(code, reason); pending.push(() => { if (this.readyState !== 3) { this.readyState = 3; this.onclose?.({ code, reason }); } }); };
          this.rws = rws;
          pending.push(() => { if (this.readyState === 0) { this.readyState = 1; this.onopen?.(); } });
        }
        send(s) { if (this.readyState !== 1) throw new Error('not open'); const { r, rws } = this; pending.push(() => r.room.webSocketMessage(rws, s)); }
        close(code = 1000, reason = '') {
          if (this.readyState === 3) return;
          this.readyState = 3;
          const { r, rws } = this;
          pending.push(async () => { const i = r.sockets.indexOf(rws); if (i >= 0) { r.sockets.splice(i, 1); await r.room.webSocketClose(rws, code, reason); } });
        }
      }
      // a link's token mint (WebCrypto, the thread pool) runs on the real clock: a frame waits for it, or under a loaded
      // runner its hello lands frames late in the faked one and the links never welcome (deploy 365, shard 2/8)
      const minting = new Set();
      const held = (mint) => mint && ((r) => { const p = Promise.resolve(mint(r)); minting.add(p); p.finally(() => minting.delete(p)).catch(() => {}); return p; });
      const settle = async () => {
        for (let i = 0; i < 6; i++) {
          while (pending.length || minting.size) { while (pending.length) await pending.shift()(); await Promise.allSettled([...minting]); await turn(); }
          for (const [k, r] of [...W.made]) if (H.isChannelShard(k)) await r.room._hubUpFlush();
          for (const [k, r] of [...W.made]) if (H.isChannelBus(k)) await r.room._downFlush();
          for (const [k, r] of [...W.made]) if (H.isChannelShard(k)) await r.room._hubPoll();
        }
      };
      const Session = class extends OnlineSession { constructor(o) { super({ wave: reconnectWave({ online: () => true }), ...o, mintToken: held(o.mintToken), now: () => clock }); } };
      try {
        return await fn({ W, service, signer, BridgeWS, Session, settle, opened, tick: (ms) => { clock += ms; }, now: () => clock });
      } finally {
        for (const [, r] of W.made) { clearTimeout(r.room._upT); clearTimeout(r.room._downT); clearTimeout(r.room._hubCountT); clearTimeout(r.room._owedSoon); clearTimeout(r.room._owedLate); }
      }
    });
  } finally { Date.now = realNow; }
}

const TARGET = 'acct-target-0001';
const at = (px, py) => ({ x: (px + 0.5) * PIXEL_UNITS, y: 0, z: (499 - py + 0.5) * PIXEL_UNITS, yaw: 0.5, pitch: 0, mv: 1 });

test('STAFF-PANEL5-FOLLOW LIVE: a staff pick follows a solo player over the real relay and its hub shards - the hook\'s hub link is told `on`, hears the note, its eye joins the target\'s cell and the camera has their pose', async () => {
  await world(async ({ W, signer, BridgeWS, Session, settle, opened, tick, now }) => {
    // the target: a cell link and a hub link, on their account, as the game holds them
    const tmint = async () => signer.token('tgt-0001', { s: TARGET, n: 'Target', k: 'linked' });
    const main = new Session({ url: 'wss://relay.test', name: 'Target', id: 'tgt-0001', secret: 'secret-of-tgt-0001', WebSocketImpl: BridgeWS, mintToken: tmint });
    const thub = new Session({ url: 'wss://relay.test', name: 'Target', id: 'tgt-0001', secret: 'secret-of-tgt-0001', acct: TARGET, asecret: 'secret-of-acct-target', presence: false, WebSocketImpl: BridgeWS, mintToken: tmint });
    thub.solo = true;
    const pose = at(100, 100);
    const cell = roomKeyFor({ host: 'world', mode: 'exterior', mapPixel: { x: 100, y: 100 } });
    const note = () => ({ px: 100, py: 100, in: 0, loc: 'Daggerfall', h: 50, hm: 60, f: 40, fm: 40, m: 10, mm: 20, rk: main.room ?? cell });
    // the staff member's game: the follow tokens the account service mints (hd 1, fo the target), one a room asked
    const asked = [];
    let n = 0;
    const kp = await signer.signer();
    // as server-account/src/staffFollow.js mints it (the harness's roomSigner signs no `fo`), each its own issued-at
    const askToken = async (sub, r) => { asked.push(r); n++; return mintToken({ s: 'hd-0123456789abcdef01234567', n: 'Spectator', k: 'guest', hd: 1, fo: sub }, kp.privateKey, { subtle: globalThis.crypto.subtle, nowS: Math.floor(now() / 1000) - n }); };
    const links = [];
    const Spy = class extends Session { constructor(o) { super(o); links.push(this); } };
    const hook = createStaffHook({ main: () => ({ url: 'wss://relay.test' }), askToken, Session: Spy, WS: BridgeWS });
    const frame = async () => {
      if (main.room !== cell) main.join(cell, { ...pose }); else main.sendPose({ ...pose });
      if (!isSocialRoom(thub.room)) thub.join(SOCIAL_ROOM);
      thub.sendParty(note());
      main.tick(); thub.tick();
      hook.tick();
      await settle();
      tick(100);
    };
    for (let i = 0; i < 20; i++) await frame();
    assert.ok(H.isHubShard(thub.room), `the target's hub link sits on its shard (${thub.room})`);
    assert.ok(main.followOk, 'the relay says follow at its welcome');
    hook.follow(TARGET);
    const trace = [];
    for (let i = 0; i < 80; i++) { await frame(); trace.push(`${i}:${hook.locked() ? 'L' : '-'}:${hook.room() ?? '?'}:${hook.view() ? 'V' : '-'}`); }
    // what went wrong, said in every message: the bus's follows, the hook's links, the tokens it asked and the last frames
    const bus = W.made.get(SOCIAL_ROOM).room;
    const info = `follows [${[...(bus._follows?.keys() ?? [])]}]; links ${links.map((l) => `${l.room}${l.welcomed ? '+' : '-'}`).join(' ')}; asked ${asked.length} tokens (${[...new Set(asked)].join(', ')}); sockets opened ${opened.length}; trace ${trace.slice(-5).join(' ')}`;
    assert.ok(asked.length <= 6, `the hook asks a token a room, not one a frame: ${info}`);
    assert.equal(hook.locked(), true, `the hub said on: ${info}`);
    assert.equal(hook.room(), cell, `the note named their cell: ${info}`);
    assert.ok(hook.view(), `the camera has their pose: ${info}`);
    assert.equal(hook.view().x, pose.x);
  });
});

/** The freeze, said `quietMs` after the target's game last asked its lease; their cell must hold it within `withinFrames`. */
const freezeCase = (quietMs, withinFrames) => world(async ({ W, service, signer, BridgeWS, Session, settle, tick, now }) => {
    const tmint = async () => signer.token('tgt-0001', { s: TARGET, n: 'Target', k: 'linked' });
    const main = new Session({ url: 'wss://relay.test', name: 'Target', id: 'tgt-0001', secret: 'secret-of-tgt-0001', WebSocketImpl: BridgeWS, mintToken: tmint });
    const thub = new Session({ url: 'wss://relay.test', name: 'Target', id: 'tgt-0001', secret: 'secret-of-tgt-0001', acct: TARGET, asecret: 'secret-of-acct-target', presence: false, WebSocketImpl: BridgeWS, mintToken: tmint });
    thub.onLease = (l) => { for (const x of [thub, main]) x.sendLease(l); };   // scenes/chatSafetyHost.js: the hub's lease to every link
    const heard = [];
    thub.onFrozen = (f) => heard.push(f.until);
    const omint = async () => signer.token('obs-0002', { s: 'acct-obs-0002', n: 'Watcher', k: 'linked' });
    const obs = new Session({ url: 'wss://relay.test', name: 'Watcher', id: 'obs-0002', secret: 'secret-of-obs-0002', WebSocketImpl: BridgeWS, mintToken: omint });
    const ohub = new Session({ url: 'wss://relay.test', name: 'Watcher', id: 'obs-0002', secret: 'secret-of-obs-0002', acct: 'acct-obs-0002', asecret: 'secret-of-acct-obs', presence: false, WebSocketImpl: BridgeWS, mintToken: omint });
    ohub.onLease = (l) => { for (const x of [ohub, obs]) x.sendLease(l); };
    const cell = roomKeyFor({ host: 'world', mode: 'exterior', mapPixel: { x: 100, y: 100 } });
    const pose = at(100, 100);
    const opose = at(100, 100);
    const frame = async () => {
      for (const [s, p] of [[main, pose], [obs, opose]]) { if (s.room !== cell) s.join(cell, { ...p }); else s.sendPose({ ...p }); }
      for (const h of [thub, ohub]) if (!isSocialRoom(h.room)) h.join(SOCIAL_ROOM);
      for (const s of [main, thub, obs, ohub]) s.tick();
      await settle();
      tick(100);
    };
    const seen = () => { for (const p of obs.peers?.values?.() ?? []) if (p.id === 'tgt-0001') return p.pose ?? p.shown ?? null; return null; };
    for (let i = 0; i < 30; i++) { pose.x += 1; await frame(); }
    assert.ok(seen(), 'the watcher sees the target before the freeze');
    for (let t = 0; t < quietMs; t += 500) { await frame(); tick(400); }
    // the service's push (server-account/src/staffFreeze.js pushFreeze -> sanctions.js pushLaw), signed by its key
    const kp = await signer.signer();
    const until = Math.floor(now() / 1000) + 3600;
    const order = await mintFreezeOrder({ s: TARGET, fz: until }, kp.privateKey, { subtle: globalThis.crypto.subtle, nowS: Math.floor(now() / 1000) });
    const res = await worker.fetch(new Request(`https://relay.example${SAFE_LAW_PATH}`, { method: 'POST', body: JSON.stringify({ order }) }), { ROOMS: W.ROOMS, IDENTITY_PUBLIC_KEY: service.IDENTITY_PUBLIC_KEY });
    const said = await res.json().catch(() => null);
    assert.equal(res.status, 200, `the law door took it: ${JSON.stringify(said)}`);
    for (let i = 0; i < 5; i++) await frame();
    assert.deepEqual(heard, [until], 'the target\'s game is told `frozen`');
    // the target's game walks on (a client that did not hold, or any client): the relay holds them where they stood, from
    // the lease their game asked the moment it heard (online.js `frozen`) and handed to the cell with its next frame
    const cellRoom = W.made.get(cell).room;
    const fzOf = () => [...cellRoom._all()].find(([, a]) => a.id === 'tgt-0001')?.[1]?.fz ?? 0;
    let held = null;
    for (let i = 0; i < 40 && held === null; i++) { pose.x += 2; await frame(); if (fzOf() >= until) held = i; }
    for (let i = 0; i < 10; i++) { pose.x += 2; await frame(); }   // the watcher's last pose of them lands
    const at0 = seen()?.x;
    for (let i = 0; i < 30; i++) { pose.x += 2; await frame(); }
    const info = `held after ${held} frames; seen x ${at0} -> ${seen()?.x}; walked to ${pose.x}`;
    assert.ok(held !== null && held <= withinFrames, `the cell holds the freeze within ${withinFrames} frames: ${info}`);
    assert.equal(seen()?.x, at0, `the watcher sees them stand still: ${info}`);
  });

test('STAFF-PANEL5-FREEZE LIVE: the service\'s freeze order through the law door reaches the target\'s hub link on its shard (`frozen`), their cell learns it from their next lease, and another player in the cell sees them stand still while they walk', () => freezeCase(10_000, 20));

test('STAFF-FREEZE-ASK: a freeze said a moment after the target\'s game asked its lease (inside the hub\'s LEASE_FRAME_MIN_MS meter) still reaches their cell within seconds, not at the next LEASE_MS ask (mutant: the ask at once, dropped by the meter)', () => freezeCase(0, 80));
