// FOLLOW-OWN-ID (2026-10-24, mob: "need the follow dropping me to stop", "says im in another tab...", "i didnt do that") -
// A FOLLOW NEVER PUTS THE STAFF MEMBER'S OWN GAME OFFLINE. Over the real relay and its hub shards (the harness of
// staffpanel5live_e2e.test.js): the target's game, the staff member's own game (its room and its World tab's hub link) and
// the real createStaffHook, whose sessions take the TAB's id when they name none - as a browser's do (online.js peerId,
// kept in the tab's storage). Shown, hidden, and Hide me pressed during the follow (scenes/staffFollowHost.js relinkGame),
// with the staff body standing in its room or out of every room (the host's half while a follow is locked). Before the
// fix every case put the staff game offline: the hook's hub link said hello with the game's own id and secret, and the
// relay replaced the game's World tab (CLOSE_REPLACED, "online in another tab, window or device").
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fakeRooms, roomSigner } from '../fakeRoom.mjs';
import { OnlineSession, roomKeyFor } from '../../src/net/online.js';
import { reconnectWave } from '../../src/net/reconnectWave.js';
import { SOCIAL_ROOM, PIXEL_UNITS, isSocialRoom } from '../../src/net/wire.js';
import * as H from '../../src/net/hubShards.js';
import { createStaffHook } from '../../src/net/staffHook.js';
import { relinkGame } from '../../src/scenes/staffFollowHost.js';
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
      const room = (name) => { const r = W.room(name); r.env.IDENTITY_PUBLIC_KEY ??= service.IDENTITY_PUBLIC_KEY; r.env.GATE_SIGNING_KEY ??= gate; r.env.HIDDEN_SEEN_URL ??= 'https://accounts.test/v1/mod/hidden-seen'; r.env.ACCOUNTS ??= { fetch: async () => new Response('{}') }; return r; };
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
      const settle = async () => {
        for (let i = 0; i < 6; i++) {
          while (pending.length) await pending.shift()();
          await turn();
          for (const [k, r] of [...W.made]) if (H.isChannelShard(k)) await r.room._hubUpFlush();
          for (const [k, r] of [...W.made]) if (H.isChannelBus(k)) await r.room._downFlush();
          for (const [k, r] of [...W.made]) if (H.isChannelShard(k)) await r.room._hubPoll();
        }
      };
      const Session = class extends OnlineSession { constructor(o) { super({ wave: reconnectWave({ online: () => true }), ...o, now: () => clock }); } };
      try {
        return await fn({ W, service, signer, BridgeWS, Session, settle, opened, tick: (ms) => { clock += ms; }, now: () => clock });
      } finally {
        for (const [, r] of W.made) { clearTimeout(r.room._upT); clearTimeout(r.room._downT); clearTimeout(r.room._hubCountT); clearTimeout(r.room._owedSoon); clearTimeout(r.room._owedLate); }
      }
    });
  } finally { Date.now = realNow; }
}


const TARGET = 'acct-target-0001';
const STAFF = 'acct-staff-0001';
const at = (px, py) => ({ x: (px + 0.5) * PIXEL_UNITS, y: 0, z: (499 - py + 0.5) * PIXEL_UNITS, yaw: 0.5, pitch: 0, mv: 1 });

for (const leaves of [false, true]) for (const hide of ['shown', 'hidden', 'relink', 'unhide', 'twice']) test(`FOLLOW-DROP: a staff member's own game is never put offline by their follow (host ${leaves ? 'leaves' : 'keeps'} its room, ${hide})`, async () => {
  await world(async ({ W, signer, BridgeWS, Session, settle, opened, tick, now }) => {
    const tmint = async () => signer.token('tgt-0001', { s: TARGET, n: 'Target', k: 'linked' });
    const main = new Session({ url: 'wss://relay.test', name: 'Target', id: 'tgt-0001', secret: 'secret-of-tgt-0001', WebSocketImpl: BridgeWS, mintToken: tmint });
    const thub = new Session({ url: 'wss://relay.test', name: 'Target', id: 'tgt-0001', secret: 'secret-of-tgt-0001', acct: TARGET, asecret: 'secret-of-acct-target', presence: false, WebSocketImpl: BridgeWS, mintToken: tmint });
    thub.solo = true;
    let hidden = hide === 'hidden' || hide === 'unhide';
    const smint = async () => signer.token('stf-0001', hidden ? { s: 'HiddenSub0123456789abcde', n: 'Staff member', k: 'linked', hd: 1 } : { s: STAFF, n: 'Mob', k: 'linked' });
    const smain = new Session({ url: 'wss://relay.test', name: 'Mob', id: 'stf-0001', secret: 'secret-of-stf-0001', WebSocketImpl: BridgeWS, mintToken: smint });
    const shub = new Session({ url: 'wss://relay.test', name: 'Mob', id: 'stf-0001', secret: 'secret-of-stf-0001', acct: STAFF, asecret: 'secret-of-acct-staff', presence: false, WebSocketImpl: BridgeWS, mintToken: smint });
    shub.claim = true;
    const closes = [];
    for (const [nm, s] of [['smain', smain], ['shub', shub]]) { s.onSuperseded = () => closes.push(`${nm} superseded`); }
    const pose = at(100, 100), spose = at(100, 100);
    const cell = roomKeyFor({ host: 'world', mode: 'exterior', mapPixel: { x: 100, y: 100 } });
    const note = () => ({ px: 100, py: 100, in: 0, loc: 'Daggerfall', h: 50, hm: 60, f: 40, fm: 40, m: 10, mm: 20, rk: main.room ?? cell });
    let n = 0;
    const kp = await signer.signer();
    const askToken = async (sub, r) => { n++; return mintToken({ s: 'hd-0123456789abcdef01234567', n: 'Spectator', k: 'guest', hd: 1, fo: sub }, kp.privateKey, { subtle: globalThis.crypto.subtle, nowS: Math.floor(now() / 1000) - n }); };
    // the browser's tab storage: a session made with no id of its own takes the TAB's - the staff member's game's (online.js peerId)
    const TabSession = class extends Session { constructor(o) { super({ id: 'stf-0001', secret: 'secret-of-stf-0001', ...o }); } };
    const hook = createStaffHook({ main: () => ({ url: 'wss://relay.test' }), askToken, WS: BridgeWS, Session: TabSession });
    const frame = async () => {
      if (main.room !== cell) main.join(cell, { ...pose }); else main.sendPose({ ...pose });
      if (!(leaves && hook.locked())) { if (smain.room !== cell) smain.join(cell, { ...spose }); else smain.sendPose({ ...spose }); }
      else if (smain.room) smain.leave();
      for (const h of [thub, shub]) if (!h.terminal && !isSocialRoom(h.room)) h.join(SOCIAL_ROOM);
      thub.sendParty(note());
      for (const s of [main, thub, smain, shub]) s.tick();
      hook.tick();
      await settle();
      tick(100);
    };
    for (let i = 0; i < 20 || (i < 400 && !smain.peers?.size); i++) await frame();   // the mints are real crypto: a busy runner may take more frames for the hellos to land
    assert.ok(smain.peers?.size, 'the staff game sees the target before the follow');
    hook.follow(TARGET);
    for (let i = 0; i < 60; i++) { pose.x += 1; await frame(); }
    if (hide === 'relink') { hidden = true; relinkGame(null, smain, [shub]); }
    if (hide === 'unhide') { hidden = false; relinkGame(null, smain, [shub]); }
    if (hide === 'twice') { hidden = true; relinkGame(null, smain, [shub]); await frame(); hidden = false; relinkGame(null, smain, [shub]); }
    for (let i = 0; i < 60 || (i < 400 && !(hook.locked() && hook.view())); i++) { pose.x += 1; await frame(); }   // a busy runner's slower mints: until the follow has its view again
    const st = (s) => `${s.room}/${s.status}/${s.error ?? ''}`;
    assert.deepEqual(closes, [], `the staff game is never put offline: room ${st(smain)}, World ${st(shub)}`);
    assert.equal(hook.locked(), true, 'the follow holds');
    assert.ok(Math.abs(hook.view()?.x - pose.x) <= 2, `and draws the target where they stand, a frame behind at most: ${hook.view()?.x} vs ${pose.x}`);
    assert.ok(shub.status === 'open' && isSocialRoom(shub.room), `hub link up: ${st(shub)}`);
    if (!leaves) assert.ok(smain.status === 'open' && smain.room === cell, `room link up: ${st(smain)}`);
  });
});

test('FOLLOW-GROUND-HINT (mob: "following from ground does not work", "panel open said locked never moved"): a target whose game has sent the hub no where note - none yet, or a room a note cannot name - is locked on all the same when picked off the staff member\'s own ground: the eye goes to the room the pick names, the room tells the bus they are in it, and the camera draws them; with no hint the follow is locked and still waits (mutants: the hint dropped)', async () => {
  for (const hinted of [false, true]) await world(async ({ W, signer, BridgeWS, Session, settle, tick, now }) => {
    void W;
    const tmint = async () => signer.token('tgt-0001', { s: TARGET, n: 'Target', k: 'linked' });
    const main = new Session({ url: 'wss://relay.test', name: 'Target', id: 'tgt-0001', secret: 'secret-of-tgt-0001', WebSocketImpl: BridgeWS, mintToken: tmint });
    const thub = new Session({ url: 'wss://relay.test', name: 'Target', id: 'tgt-0001', secret: 'secret-of-tgt-0001', acct: TARGET, asecret: 'secret-of-acct-target', presence: false, WebSocketImpl: BridgeWS, mintToken: tmint });
    const smint = async () => signer.token('stf-0001', { s: STAFF, n: 'Mob', k: 'linked' });
    const smain = new Session({ url: 'wss://relay.test', name: 'Mob', id: 'stf-0001', secret: 'secret-of-stf-0001', WebSocketImpl: BridgeWS, mintToken: smint });
    const pose = at(100, 100);
    const cell = roomKeyFor({ host: 'world', mode: 'exterior', mapPixel: { x: 100, y: 100 } });
    let n = 0;
    const kp = await signer.signer();
    const askToken = async (sub, r) => { n++; return mintToken({ s: 'hd-0123456789abcdef01234567', n: 'Spectator', k: 'guest', hd: 1, fo: sub }, kp.privateKey, { subtle: globalThis.crypto.subtle, nowS: Math.floor(now() / 1000) - n }); };
    const hook = createStaffHook({ main: () => ({ url: 'wss://relay.test' }), askToken, WS: BridgeWS, Session });
    const frame = async () => {
      if (main.room !== cell) main.join(cell, { ...pose }); else main.sendPose({ ...pose });
      if (smain.room !== cell) smain.join(cell, { ...pose }); else smain.sendPose({ ...pose });
      if (!thub.terminal && !isSocialRoom(thub.room)) thub.join(SOCIAL_ROOM);
      for (const s of [main, thub, smain]) s.tick();   // the target sends no where note
      hook.tick();
      await settle();
      tick(100);
    };
    for (let i = 0; i < 20 || (i < 400 && !smain.peers?.size); i++) await frame();
    const seen = [...smain.peers.values()].find((p) => p);
    assert.ok(seen, 'the staff game sees the target on its ground');
    hook.follow(TARGET, hinted ? { room: smain.room, id: seen.id, ly: smain.layer } : null);
    for (let i = 0; i < 60 || (hinted && i < 400 && !(hook.locked() && hook.view())); i++) { pose.x += 1; await frame(); }
    assert.equal(hook.locked(), true, 'the hub said on');
    if (!hinted) { assert.equal(hook.view(), null, 'no note, no hint: nowhere to look'); return; }
    assert.ok(Math.abs(hook.view()?.x - pose.x) <= 2, `picked off my ground: drawn where they stand - ${hook.view()?.x} vs ${pose.x}`);
    assert.equal(hook.where(), cell, 'the room the pick named, which the room\'s own word to the bus confirms');
  });
});
