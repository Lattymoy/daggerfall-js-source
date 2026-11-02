// A private server on a player's own PC, and the bridge a guest's game reaches it through.
//
// The host runs the game's own relay (server/src/index.js, bundled into app/private/relay.mjs by
// scripts/privateRelay.mjs) in Cloudflare's local runtime (miniflare + workerd), unchanged: the rooms, the referees
// and the room snapshots are the live relay's code. Its storage is a folder under the shell's userData, so a world
// keeps between sessions. Nothing here talks to the main relay or the account service.
//
// Sign-in: the relay refuses a hello without a token signed by the key in IDENTITY_PUBLIC_KEY. On a private server
// that key is the host's own, made on the first host and kept in its folder, and this module is the minter: a game
// asks POST /private/token for its name and gets a guest token signed with it. A private server trusts its host
// (see the plan's trust section): the name is the player's word.
//
// ONE PORT: the front server (`port`, default 7777) answers /private/* itself and hands every WebSocket upgrade to
// the relay on a loopback port. A guest's shell runs a bridge on 127.0.0.1 that pipes bytes to the host's front, so
// every game connects to ws://127.0.0.1:<port> - the only plain ws:// address wire.js relayUrl accepts.
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { mintToken, claimsValid, _b64url } from '../../src/net/identityToken.js';

export const PRIVATE_PORT = 7777;
export const PLAYERS_MIN = 2;
export const PLAYERS_MAX = 10;
/** A token's life on a private server - the relay's own ceiling (IDENTITY_MAX_TTL_S is passed the same). */
const TOKEN_TTL_S = 300;
const BODY_MAX = 2048;

const subtle = globalThis.crypto.subtle;

/** The host's signing pair, made once and kept in `dir`/identity.json. */
export async function hostKeys(dir) {
  const file = path.join(dir, 'identity.json');
  try {
    const kept = JSON.parse(fs.readFileSync(file, 'utf8'));
    const privateKey = await subtle.importKey('pkcs8', Buffer.from(kept.pkcs8, 'base64'), { name: 'Ed25519' }, false, ['sign']);
    return { privateKey, publicB64: kept.pub };
  } catch { /* none yet, or unreadable: a new pair */ }
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = _b64url.encode(new Uint8Array(await subtle.exportKey('raw', kp.publicKey)));
  const pkcs8 = Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ pub, pkcs8 }), { mode: 0o600 });
  return { privateKey: kp.privateKey, publicB64: pub };
}

/** A minter that never signs the same bytes twice: the relay spends a signature once a room, and Ed25519 is
 *  deterministic, so each subject's issued-at walks down a second per mint (test/fakeRoom.mjs roomSigner's law). */
export function tokenMinter(privateKey, { now = () => Date.now() } = {}) {
  const lastI = new Map();
  return async ({ s, n }) => {
    const nowS = Math.floor(now() / 1000);
    let i = nowS;
    const last = lastI.get(s);
    if (last !== undefined && i >= last) i = last - 1;
    if (i < nowS - 60) i = nowS;   // walked a minute back: start again from the clock
    lastI.set(s, i);
    const who = { s, n, k: 'guest' };
    if (!claimsValid({ ...who, i, e: i + TOKEN_TTL_S })) return null;
    return mintToken(who, privateKey, { subtle, nowS: i, ttlS: TOKEN_TTL_S });
  };
}

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const send = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', ...cors }); res.end(JSON.stringify(body)); };
const addrOf = (sock) => String(sock.remoteAddress ?? '').replace(/^::ffff:/, '');

/** The upgrade's request line and headers, as they came, for the relay's port. */
function headOf(req) {
  let s = `${req.method} ${req.url} HTTP/1.1\r\n`;
  for (let i = 0; i < req.rawHeaders.length; i += 2) s += `${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`;
  return s + '\r\n';
}

/**
 * The front server: /private/token, /private/info, and every WebSocket upgrade piped to `relayPort`.
 * A player is a remote address with a socket open or a token minted in the last token life; a new one past
 * `maxPlayers` is refused ('full').
 */
export function frontServer({ relayPort, mint, maxPlayers = PLAYERS_MAX, name = 'Private server', now = () => Date.now() }) {
  const open = new Map();   // address -> open upgraded sockets
  const minted = new Map();   // address -> when it last took a token
  const players = () => {
    const t = now();
    for (const [a, at] of minted) if (t - at > TOKEN_TTL_S * 1000 && !open.get(a)) minted.delete(a);
    return new Set([...open.keys(), ...minted.keys()]);
  };
  const admits = (addr) => { const p = players(); return p.has(addr) || p.size < maxPlayers; };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
    if (req.method === 'GET' && url.pathname === '/private/info') { send(res, 200, { ok: true, name, players: players().size, max: maxPlayers }); return; }
    if (req.method === 'POST' && url.pathname === '/private/token') {
      const addr = addrOf(req.socket);
      if (!admits(addr)) { send(res, 503, { error: 'full' }); return; }
      let body = '';
      req.setEncoding('utf8');
      req.on('data', (c) => { body += c; if (body.length > BODY_MAX) req.destroy(); });
      req.on('end', async () => {
        let m = null;
        try { m = JSON.parse(body); } catch { /* refused below */ }
        const tok = m && typeof m.s === 'string' && typeof m.n === 'string' ? await mint({ s: m.s, n: m.n }).catch(() => null) : null;
        if (!tok) { send(res, 400, { error: 'bad name' }); return; }
        minted.set(addr, now());
        send(res, 200, { tok });
      });
      return;
    }
    send(res, 404, { error: 'no such path' });
  });

  server.on('upgrade', (req, sock, head) => {
    const addr = addrOf(sock);
    if (!admits(addr)) { sock.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); return; }
    open.set(addr, (open.get(addr) ?? 0) + 1);
    let left = false;
    const leave = () => { if (left) return; left = true; const n = (open.get(addr) ?? 1) - 1; if (n > 0) open.set(addr, n); else open.delete(addr); };
    const up = net.connect(relayPort, '127.0.0.1', () => { up.write(headOf(req)); if (head?.length) up.write(head); sock.pipe(up); up.pipe(sock); });
    const end = () => { leave(); sock.destroy(); up.destroy(); };
    up.on('error', end); sock.on('error', end); up.on('close', end); sock.on('close', end);
  });
  return { server, players };
}

/** Listen and answer the port actually bound (0 asks the system for one). */
const listen = (server, port, host) => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, host, () => { server.off('error', reject); resolve(server.address().port); });
});

/**
 * Host a private server. `dir` holds the world and the host's key; `relayScript` is the bundled relay;
 * `Miniflare` is miniflare's class (passed in, so this module loads without it where nobody hosts).
 * Answers { url, port, stop, players }: `url` is the address the host's own game connects to.
 */
export async function startHost({ dir, relayScript, Miniflare, compatibilityDate, port = PRIVATE_PORT, maxPlayers = PLAYERS_MAX, name, listenHost = '0.0.0.0' }) {
  const cap = Math.min(PLAYERS_MAX, Math.max(PLAYERS_MIN, Math.floor(Number(maxPlayers)) || PLAYERS_MAX));
  const { privateKey, publicB64 } = await hostKeys(dir);
  const mf = new Miniflare({
    modules: true,
    script: fs.readFileSync(relayScript, 'utf8'),   // the source, not a path: the runtime refuses a module path outside its working folder
    compatibilityDate,
    durableObjects: { ROOMS: 'Room' },
    durableObjectsPersist: path.resolve(dir, 'world'),
    bindings: { IDENTITY_PUBLIC_KEY: publicB64, IDENTITY_MAX_TTL_S: String(TOKEN_TTL_S) },
    host: '127.0.0.1',
    port: 0,
  });
  let front = null;
  try {
    const relayPort = Number(new URL(String(await mf.ready)).port);
    front = frontServer({ relayPort, mint: tokenMinter(privateKey), maxPlayers: cap, name });
    const bound = await listen(front.server, port, listenHost);
    return {
      url: `ws://127.0.0.1:${bound}`,
      port: bound,
      max: cap,
      players: () => front.players().size,
      stop: async () => { front.server.close(); front.server.closeAllConnections?.(); await mf.dispose(); },
    };
  } catch (e) {
    front?.server.close();
    await mf.dispose().catch(() => {});
    throw e;
  }
}

/** "host", "host:port", "[v6]:port" -> { host, port }, or null. */
export function parseAddress(text) {
  const s = String(text ?? '').trim().replace(/^(?:wss?|https?):\/\//, '').replace(/\/.*$/, '');
  const m = /^\[([0-9a-fA-F:.]+)\](?::(\d{1,5}))?$/.exec(s) ?? /^([A-Za-z0-9.-]+)(?::(\d{1,5}))?$/.exec(s);
  if (!m) return null;
  const port = m[2] ? Number(m[2]) : PRIVATE_PORT;
  return port >= 1 && port <= 65535 ? { host: m[1], port } : null;
}

/** A guest's bridge: 127.0.0.1:<free port> piped byte for byte to the host's front. Answers { url, stop }. */
export async function startBridge({ host, port }) {
  const conns = new Set();
  const server = net.createServer((sock) => {
    const up = net.connect(port, host);
    conns.add(sock); conns.add(up);
    sock.pipe(up); up.pipe(sock);
    const end = () => { sock.destroy(); up.destroy(); conns.delete(sock); conns.delete(up); };
    up.on('error', end); sock.on('error', end); up.on('close', end); sock.on('close', end);
  });
  const bound = await listen(server, 0, '127.0.0.1');
  return { url: `ws://127.0.0.1:${bound}`, port: bound, stop: async () => { server.close(); for (const c of conns) c.destroy(); } };
}

/** Whether a host answers at `url`'s address (its /private/info), within `ms`. */
export async function probe(url, ms = 4000) {
  try {
    const res = await fetch(url.replace(/^ws/, 'http') + '/private/info', { signal: AbortSignal.timeout(ms) });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}
