// The account service over node:sqlite with every migration applied - D1's surface as the Worker uses it (prepare /
// bind / first / all / run, and batch as ONE transaction, rolled back whole when a statement throws) - and the Worker
// stood on it with a registered-account helper. AUDIT 28's pins (test/net/audit28_marks.test.js, audit28_notice.test.js)
// drive the real service through it; marks1 and notice1 keep their own copies, written first.
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';

import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { _resetPassKeyForTests } from '../server-account/src/sessionPass.js';
import { _resetYardsKept } from '../server-account/src/decor.js';   // YARD-SHED: a stood service is a fresh isolate - no town's yards kept
import { _resetBusyShed } from '../server-account/src/service.js';   // BUSY-GATE: and nothing shed
import { _resetWeeksKept } from '../server-account/src/weekKept.js';   // PRIMARY-FOLD: nor any week read settled
import { forgetChapters } from '../server-account/src/npcHalls.js';   // AUDIT CHAP3 T4: nor any region's chapters - a test's first read is its own database's
import { _resetTownEconForTests } from '../server-account/src/townEcon.js';   // TOWN-ECON TE2: nor the towns' shares
import { renownXpFor } from '../src/net/renown.js';
import { mintReceipt, importReceiptKey } from '../src/net/gate/gateReceipt.js';
import { ACCEPTED } from '../src/net/legalLaw.js';   // MERGE 2: TERMS1 - a request that makes an account carries the versions ticked
import { r2, seatRealm } from './realmSeat.mjs';   // MERGE 2: a founding is a realm character's (AUDIT REALM2 S2)
import { GUILD_FOUND_GOLD } from '../src/net/guild/guildLaw.js';
import { ROLL_FACTIONS } from '../src/net/npcChapterLaw.js';   // AUDIT CHAP4 E3: a scene's chapters confirmed

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();

/** SEAT-CAP: D1's bound on one statement's parameters (Cloudflare's D1 limits) - node:sqlite's is 32,766, so a list bound
 *  whole passed every test here and threw on the live database once it grew past 100 (the seats' Turning, 2026-10-11). */
export const D1_MAX_BOUND = 100;

/** A fresh database, every migration applied. */
export function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) db.exec(src(`server-account/migrations/${f}`));
  return {
    _raw: db,
    prepare(sql) {
      const stmt = db.prepare(sql);
      const writes = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql);
      let args = [];
      const api = {
        bind(...a) {
          if (a.length > D1_MAX_BOUND) throw new Error(`D1_ERROR: too many SQL variables (${a.length} bound, D1 takes ${D1_MAX_BOUND})`);   // SEAT-CAP: as D1 refuses it
          args = a; return api;
        },
        async first() { return stmt.get(...args) ?? null; },
        // SCALE4h: an answer's meta says its rows written, as D1's does (a table's rows - D1 counts its indexes' too), so a
        // route's metrics point can be read over this database
        async all() { const results = stmt.all(...args); return { results, meta: { rows_written: writes ? Number(db.prepare('SELECT changes() AS c').get().c) : 0 } }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes), rows_written: writes ? Number(r.changes) : 0 } }; },
        _result() { const results = stmt.all(...args); const n = writes ? Number(db.prepare('SELECT changes() AS c').get().c) : 0; return { results, meta: { changes: n, rows_written: n } }; },
      };
      return api;
    },
    async batch(list) {
      db.exec('BEGIN');
      try { const out = list.map((st) => st._result()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    /** SCALE4d: D1's Sessions API - a session over the same database. A fake has no replica, so every statement is the
     *  primary's, as on a database whose read replication is off. Each session opened is recorded - its constraint and
     *  the statements prepared through it - so a pin can say which statements a route ran on one. */
    _sessions: [],
    withSession(constraint) {
      const rec = { constraint, statements: [] };
      this._sessions.push(rec);
      return new FakeD1Session(this, rec);
    },
  };
}

/** SCALE4d: D1's session as the runtime makes one - a class whose methods read its own private fields, so a method
 *  called off its object (an unbound `prepare`) throws, as workerd's D1DatabaseSession's does (AUDIT SCALE4d D8: a fake
 *  of plain closures let a wrapper that dropped the binding pass). */
class FakeD1Session {
  #db; #rec;
  constructor(db, rec) { this.#db = db; this.#rec = rec; }
  prepare(sql) { this.#rec.statements.push(sql); return this.#db.prepare(sql); }
  batch(list) { return this.#db.batch(list); }
  /** SCALE4g: the session's position, as D1 writes one - the database's total changes so far, D1's shape (fixed-width
   *  hex positions, so a newer one orders after an older one). */
  getBookmark() { return d1Position(this.#db); }
}

/** SCALE4g: a fake database's position in D1's bookmark shape. */
export const d1Position = (db) => `${Number(db._raw.prepare('SELECT total_changes() AS c').get().c).toString(16).padStart(8, '0')}-00000000-00000000-${'0'.repeat(32)}`;

/** A UTC day's middle. */
export const T0 = 1_800_000_000;
/** INT19: the routes that take a crafted piece out of its realm record (the pins' `call` names the record for them). */
const CRAFTED_ACTS = new Set(['/v1/market/list', '/v1/market/auction', '/v1/writs/fulfil']);

/** The Worker on a fresh database, with the gate's key pair - `env` extended by `extra`. */
export async function standService(extra = {}) {
  _resetKeyForTests();
  _resetPassKeyForTests();   // SESSION-SIGN: the pass key drawn from this service's own key
  _resetYardsKept();
  _resetBusyShed();
  forgetChapters();
  _resetWeeksKept();
  _resetTownEconForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const gk = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const gatePriv = await importReceiptKey(Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', gk.privateKey))).toString('base64'), { subtle });
  const gatePub = Buffer.from(new Uint8Array(await subtle.exportKey('raw', gk.publicKey))).toString('base64url');
  const env = { DB: d1(), SAVES: r2(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*', GATE_PUBLIC_KEY: gatePub, ...extra };   // MERGE 2: SAVES, the realm's records (R2)
  const call = async (path, body, bearer = null) => {
    // INT19 (bible/06-Systems/Integrity-Arc.md section 7): A CRAFTED ACT NAMES WHERE ITS RECORD STANDS - a listing's, an
    // auction's or a commission fill's piece leaves the realm record (server-account/src/craftedPiece.js), and the client's
    // realm act names the record as it asks (net/marketBook.js realmPieceAct). A pin's act for a realm character that names
    // none is named it here, off the row as it stands; `realm: null` asks with none (the route's own refusal).
    if (CRAFTED_ACTS.has(path) && body && typeof body === 'object' && !('realm' in body) && typeof body.character === 'string'
      && /^r[0-9a-f]{20}$/.test(body.character) && (path !== '/v1/market/list' || body.kind === 'piece')) {
      const row = env.DB._raw.prepare('SELECT lease, seq FROM realm_characters WHERE id = ?').get(body.character);
      if (row) body = { ...body, realm: { id: body.character, lease: row.lease, seq: row.seq } };
    }
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method: 'POST',
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const guest = async () => (await call('/v1/auth/guest', { ...ACCEPTED })).body;   // MERGE 2: main's TERMS1 - an account is made with the Terms ticked
  const registered = async (handle, { character = `char-${handle.toLowerCase()}`, renown = 1 } = {}) => {
    const g = await guest();
    assert.equal((await call('/v1/auth/register', { handle, password: 'a good long one', ...ACCEPTED }, g.secret)).status, 200, `${handle} registers`);
    if (renown > 1) {
      // RENOWN-CHAR: the character's own track again (MERGE 2 had seeded RENOWN-ACCOUNT's one track an account)
      env.DB._raw.prepare('INSERT OR REPLACE INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(g.id, character, handle, renownXpFor(renown), T0, T0);
    }
    return { secret: g.secret, id: g.id, character, handle };
  };
  /** INT16 (bible/06-Systems/Integrity-Arc.md section 7): A REGISTERED ACCOUNT PLAYING A REALM CHARACTER - the seat every
   *  progression claim is asked of (server-account/src/progress.js progressRefusal: Renown, a raid's cleanse, a camp, the
   *  Watch, a silver find, a profession's XP). `registered`'s account, seated as a realm character the way the realm makes
   *  one (test/realmSeat.mjs, the realm pins' one home); `character` is its id, `at()` where its record stands, and a
   *  `renown` seeded on the account's own character is carried to it. `save` lays a record over its first save. */
  const seated = async (handle, { save = null, ...opts } = {}) => {
    const who = await registered(handle, opts);
    const R = await seatRealm(env, who.secret, handle, save);
    env.DB._raw.prepare('UPDATE renown_tracks SET char_id = ? WHERE player = ? AND char_id = ?').run(R.id, who.id, who.character);
    return { ...who, character: R.id, at: R.at };
  };
  const claim = async (who, gameDay, nowS) => call('/v1/gate/claim', { receipt: await mintReceipt({ d: gameDay, b: 'ruhn', s: who.id, c: 4242, x: 'dealt' }, gatePriv, { subtle, nowS }) }, who.secret);
  /** Marks struck to an account by hand - a line, so the balances move as the ledger's triggers move them. */
  const seedMarks = (who, n, tag = 'seed') => env.DB._raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('mint', NULL, 'account', ?, 'test', ?, 1, 1, ?, NULL, ?)`).run(who.id, n, who.id, `${tag}-${who.handle}-${n}`);
  const fetch = (u, i) => worker.fetch(new Request(u, i), env);
  /** MERGE 2: A GUILD FOUNDED - main's AUDIT REALM2 S2 made a founding a realm character's, paid on its record: `who` is
   *  seated as one (test/realmSeat.mjs, the realm pins' one home) and plays it from here (`who.character` is its id),
   *  and the founding asks the real route with where its record stands. Answers the route's `{ status, body }`. */
  const found = async (who, { name, tag }) => {
    const R = await seatRealm(env, who.secret, who.handle, { name: who.handle, level: 9, goldPieces: GUILD_FOUND_GOLD * 10, items: [] });
    // RENOWN-CHAR: a founding asks the founder's OWN track - carried to the realm character it plays from here, as customs carries one
    env.DB._raw.prepare('UPDATE renown_tracks SET char_id = ? WHERE player = ? AND char_id = ?').run(R.id, who.id, who.character);
    who.character = R.id; who.at = R.at;
    return call('/v1/guilds/found', { character: R.id, name, tag, realm: R.at() }, who.secret);
  };
  /** MERGE 2: A HOME CLAIMED - main's AUDIT REALM2 S2 made a house a realm character's, bought on its record, and a
   *  placement in it that character's: `who` is seated as a realm character (its crafting and its Stores stay its own
   *  character's - a crafted piece is the ACCOUNT's, products.owner) and the claim asks the real route. Answers the
   *  route's `{ status, body }` and `character`, the realm character that owns the home and places in it. */
  const seatHome = async (who, home) => {
    const R = await seatRealm(env, who.secret, who.handle, { name: who.handle, level: 9, goldPieces: 1_000_000, items: [] });
    return { ...(await call('/v1/homes/claim', { layout: null, ...home, character: R.id, realm: R.at() }, who.secret)), character: R.id };
  };
  return { env, call, guest, registered, seated, claim, seedMarks, fetch, found, seatHome, identityPublic: kp.publicKey, gateKey: gatePriv, gatePriv };   // ARENA4: the relay's signing half, so a bout's receipt is signed as the relay signs it   // PROF3: the identity key's public half, a product record's verifier; SEAT1b: the relay's private half, a watch receipt's signer
}

/** A device's storage holding `who`'s session (net/accountClient.js SESSION_KEY). */
export const sessionStorageOf = (sessionKey, who) => ({ getItem: (k) => (k === sessionKey ? JSON.stringify({ secret: who.secret, id: who.id }) : null) });

/** AUDIT CHAP4 E3: A SCENE'S CHAPTERS CONFIRMED - each region's kept row (npcHalls.js npc_hall_regions, AUDIT CHAP3 S3)
 *  naming `factions` (every guild of the Roll by default), as its witnessed towns' reports would leave it: the seats are
 *  placed, and the titles minted, only at a chapter confirmed now. */
export function confirmChapters(raw, regions, factions = ROLL_FACTIONS) {
  for (const g of regions) raw.prepare('INSERT OR REPLACE INTO npc_hall_regions (region, chapters, ver, done, at) VALUES (?, ?, 1, 1, 0)').run(g, JSON.stringify([...factions]));
}
