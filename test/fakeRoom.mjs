// The relay pins' fake Durable Object - ONE home (AUDIT WORLD D10: three copies had to grow list() and the batched
// put() in lockstep, and a fake that lies makes a pin pass that production would fail). A state with sockets and
// storage (get/put/delete/deleteAll/list, the batched put, the alarm), a socket with a bounded attachment (the
// runtime's 2 KiB - AUDIT SOC: this said 16 KiB, and the runtime's serializeAttachment() takes 2048 bytes; a fake
// with a wider wall than production's makes a pin pass that production would fail), and the Room's doors as helpers;
// wake() is what a hibernation wakes into - a fresh Room over the same state, every attachment re-read.
import { Room } from '../server/src/index.js';
import { mintToken, MAX_TTL_S, _b64url } from '../src/net/identityToken.js';

// ═══ ACC1g: EVERY HELLO CARRIES A REAL, SIGNED TOKEN ═══════════════
//
// Mac: "You shouldnt be able to just type a name and enter anymore....
// this is what the account system is for."
//
// The relay refuses a hello it cannot verify, so a harness that sent a
// bare `{ t: 'hello', name }` would now be testing the refusal and
// nothing else - 89 relay pins went red on the change, which is the
// gate telling the truth about what every one of them had been
// assuming. THE FIX IS NOT A BACK DOOR IN THE ROOM: the harness mints
// a real Ed25519 token against a real key and the room really verifies
// it, so these pins run through the door a player runs through rather
// than around it.
//
// ONE KEYPAIR PER ROOM, made lazily because `fakeRoom()` is sync and
// WebCrypto is not; `env` is a live object the room holds, and the
// relay imports the key on its first hello, so filling it in before
// that hello is in time.
//
// AND EVERY TOKEN IS UNIQUE, because the room SPENDS a signature once
// (ACC1d F8) and Ed25519 is deterministic: the same claims signed twice
// are the same bytes, so a reconnect would be refused as a replay. The
// claims differ by their issued-at, walked one second further into the
// past per mint - which stays inside MAX_TTL_S, and a harness that
// mints more than that many helloes into one room will say so out loud
// rather than fail as something else.

/**
 * The signing half, for ANY relay harness - `fakeRoom` below and the
 * hand-rolled `strictRoom` in slam5 both take it, so there is one place
 * a room's key and its tokens are made rather than one per harness.
 *
 * @param env  the live object the Room was constructed with; the public
 *             key is written into it on the first mint, which is in
 *             time because the relay imports it lazily on its first
 *             hello.
 * @param now  the harness's clock, so a test that fakes Date.now mints
 *             on the same clock the room verifies on.
 */
export function roomSigner(env, now = () => Date.now()) {
  let signing = null;
  // ONE ISSUED-AT PER CLAIM SET, not one counter per room. What has to
  // be unique is the SIGNATURE, and two different peers already sign
  // different claims - so only a repeat of the SAME identity needs a
  // new `i`, and a room may hold as many peers as it likes.
  //
  // AND IT IS TRACKED AS A VALUE, NOT A COUNT, which is the bug this
  // walked into first: counting mints and subtracting from the CURRENT
  // clock cancels out the moment the clock moves. A harness ticking its
  // fake clock past a second boundary between two helloes for one id
  // minted `nowS - 1` and then `(nowS + 1) - 2` - the same instant, the
  // same claims, the same Ed25519 bytes, and the room refused the
  // second as a replay. So each identity's `i` is kept and only ever
  // goes DOWN, and it jumps forward to follow a clock that has moved.
  const lastI = new Map();
  const signer = async () => {
    if (!signing) {
      signing = (async () => {
        const kp = await globalThis.crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
        const raw = new Uint8Array(await globalThis.crypto.subtle.exportKey('raw', kp.publicKey));
        env.IDENTITY_PUBLIC_KEY = _b64url.encode(raw);
        return kp;
      })();
    }
    return signing;
  };
  /** A token for `id`, signed by this room's own key and NEVER THE SAME
   *  BYTES TWICE - the room spends a signature once (ACC1d F8) and
   *  Ed25519 is deterministic, so the same claims signed twice would be
   *  refused as a replay. The issued-at walks one second further into
   *  the past per mint, which stays inside MAX_TTL_S; past that the
   *  harness says so out loud rather than failing as something else. */
  const token = async (id, who = {}) => {
    const kp = await signer();
    const claims = { s: who.s ?? `acct-${id}`, n: who.n ?? String(id), k: who.k ?? 'guest' };
    // ACC3: the badge, when the caller asked for one. Signed like the
    // name and for the same reason - the relay reads a title OUT of
    // the token and never off the frame - so a harness that wants a
    // titled peer has to mint one, which is exactly the point.
    if (who.t !== undefined) claims.t = who.t;
    if (who.g !== undefined) claims.g = who.g;
    const key = `${claims.s}|${claims.n}|${claims.k}|${claims.t ?? ''}|${(claims.g ?? []).join('+')}`;
    const nowS = Math.floor(now() / 1000);
    const prev = lastI.get(key);
    let i = nowS - 1;
    if (prev !== undefined && i >= prev) i = prev - 1;
    lastI.set(key, i);
    if (i <= nowS - MAX_TTL_S) throw new Error(`roomSigner: ${key} has run out of issued-at room inside MAX_TTL_S - this harness has minted for one identity too many times on one clock`);
    return mintToken(claims, kp.privateKey, { subtle: globalThis.crypto.subtle, nowS: i });
  };
  return { token, signer };
}

export function fakeRoom(key, { now = () => Date.now() } = {}) {
  const sockets = [];
  const store = new Map();
  const alarm = { at: null };
  const state = {
    getWebSockets: () => sockets.slice(),
    acceptWebSocket: (ws) => sockets.push(ws),
    storage: {
      // AUDIT SOC (2026-09-16): THE RUNTIME'S BATCH LIMIT IS A LAW HERE TOO. A Durable Object's batched get takes 128 keys
      // and its batched put 128 pairs; SLAM5 found the 130th player's hello throwing on exactly this wall, and the fake
      // let it pass - a fake that lies makes a pin pass that production would fail (this file's own header).
      async get(k) { if (Array.isArray(k) && k.length > 128) throw new Error(`storage.get(): ${k.length} keys, the runtime takes 128 at most`); return Array.isArray(k) ? new Map(k.filter((x) => store.has(x)).map((x) => [x, store.get(x)])) : store.get(k); },
      async put(k, v) { if (k && typeof k === 'object') { const e = Object.entries(k); if (e.length > 128) throw new Error(`storage.put(): ${e.length} pairs, the runtime takes 128 at most`); for (const [kk, vv] of e) store.set(kk, vv); } else store.set(k, v); },
      async delete(k) { if (Array.isArray(k) && k.length > 128) throw new Error(`storage.delete(): ${k.length} keys, the runtime takes 128 at most`); for (const x of Array.isArray(k) ? k : [k]) store.delete(x); },
      async deleteAll() { store.clear(); },
      // AUDIT SOC A4: list() pages as the runtime's does - `limit` keys at most, sorted, after `startAfter` - or a paged
      // sweep over this fake never ends (a page that is always full is always followed)
      async list({ prefix = '', limit = Infinity, startAfter = null } = {}) {
        const keys = [...store.keys()].filter((k) => k.startsWith(prefix) && (startAfter == null || k > startAfter)).sort();
        return new Map(keys.slice(0, limit).map((k) => [k, store.get(k)]));
      },
      async setAlarm(at) { alarm.at = at; },
      async getAlarm() { return alarm.at; },
      async deleteAlarm() { alarm.at = null; },
    },
  };
  // ACC1g: the room's config, filled in by `signer()` before the first
  // hello reaches it. The object identity is what matters - the Room
  // captures it at construction and reads the key lazily.
  const env = {};
  let room = new Room(state, env);
  const wake = () => { room = new Room(state, env); };
  const { token, signer } = roomSigner(env, now);
  const connect = () => {
    const ws = { sent: [], closed: null, att: { key, id: null, name: null, pose: null, bucket: null, drops: 0 },
      send(s) { if (this.closed) throw new Error('closed'); this.sent.push(JSON.parse(s)); },
      // the runtime drops a socket the object closed from getWebSockets() and calls no webSocketClose for it
      close(code, reason) { this.closed = { code, reason }; const i = sockets.indexOf(ws); if (i >= 0) sockets.splice(i, 1); },
      serializeAttachment(a) { if (JSON.stringify(a).length > 2048) throw new Error('attachment too large'); this.att = JSON.parse(JSON.stringify(a)); }, deserializeAttachment() { return this.att; } };
    state.acceptWebSocket(ws);
    return ws;
  };
  const look = { race: 'Nord', gender: 'male', faceIndex: 0, items: [] };
  /** A hello; the fourth argument is a secret (a string) or extra fields (an object) laid over the frame. */
  const hello = async (ws, id, pose = null, extra = {}) => {
    const over = typeof extra === 'string' ? { secret: extra } : extra;
    // ACC1g: a caller that wants to drive the gate itself says so -
    // `tok: null` is a hello with NO token (the refusal), and any other
    // value is that caller's own token. Everything else gets a real one.
    // ACC1g: THE TOKEN'S NAME IS THE FRAME'S, because the relay takes
    // the name OUT of the token and ignores the frame's entirely - a
    // harness that signed one name and typed another would be testing
    // that the frame is ignored, over and over, in every pin that ever
    // names a peer.
    // ACC3: a `title`/`glyphs` on the frame is minted INTO the token,
    // never laid on the frame - the relay ignores what a client says
    // about its own badge, and a harness that could set one on the
    // frame would be testing the wrong half forever.
    const tok = 'tok' in over ? over.tok : await token(id, { n: over.name ?? String(id), t: over.title, g: over.glyphs });
    const frame = { t: 'hello', id, secret: 'secret-of-' + id, name: id, look, pose, ...over };
    delete frame.title; delete frame.glyphs;   // ACC3: they went into the token above; the wire has no such hello field
    if (tok == null) delete frame.tok; else frame.tok = tok;
    return room.webSocketMessage(ws, JSON.stringify(frame));
  };
  const pose = (ws, p) => room.webSocketMessage(ws, JSON.stringify({ t: 'pose', p }));
  const chat = (ws, text) => room.webSocketMessage(ws, JSON.stringify({ t: 'chat', text }));
  const ping = (ws) => room.webSocketMessage(ws, '{"t":"ping","x":1}');   // not the byte-exact one the runtime answers in its sleep: this one wakes the object
  const world = (ws, data, extra = {}) => room.webSocketMessage(ws, JSON.stringify({ t: 'world', data, ...extra }));
  const raw = (ws, text) => room.webSocketMessage(ws, text);
  const drop = (ws) => { const i = sockets.indexOf(ws); if (i >= 0) sockets.splice(i, 1); return room.webSocketClose(ws, 1005, ''); };
  const fire = () => room.alarm();
  return { get room() { return room; }, state, store, sockets, alarm, connect, hello, token, signer, env, pose, chat, ping, world, raw, drop, wake, fire, now, look };
}
