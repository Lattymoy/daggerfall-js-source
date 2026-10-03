// The account service over node:sqlite with every migration applied - D1's surface as the Worker uses it (prepare /
// bind / first / all / run, and batch as ONE transaction, rolled back whole when a statement throws) - and the Worker
// stood on it with a registered-account helper. AUDIT 28's pins (test/audit28_marks.test.js, audit28_notice.test.js)
// drive the real service through it; marks1 and notice1 keep their own copies, written first.
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';

import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { renownXpFor } from '../src/net/renown.js';
import { mintReceipt, importReceiptKey } from '../src/net/gateReceipt.js';
import { ACCEPTED } from '../src/net/legalLaw.js';   // MERGE 2: TERMS1 - a request that makes an account carries the versions ticked
import { r2, seatRealm } from './realmSeat.mjs';   // MERGE 2: a founding is a realm character's (AUDIT REALM2 S2)
import { GUILD_FOUND_GOLD } from '../src/net/guildLaw.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();

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
        bind(...a) { args = a; return api; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
        _result() { const results = stmt.all(...args); return { results, meta: { changes: writes ? Number(db.prepare('SELECT changes() AS c').get().c) : 0 } }; },
      };
      return api;
    },
    async batch(list) {
      db.exec('BEGIN');
      try { const out = list.map((st) => st._result()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}

/** A UTC day's middle. */
export const T0 = 1_800_000_000;

/** The Worker on a fresh database, with the gate's key pair - `env` extended by `extra`. */
export async function standService(extra = {}) {
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const gk = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const gatePriv = await importReceiptKey(Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', gk.privateKey))).toString('base64'), { subtle });
  const gatePub = Buffer.from(new Uint8Array(await subtle.exportKey('raw', gk.publicKey))).toString('base64url');
  const env = { DB: d1(), SAVES: r2(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*', GATE_PUBLIC_KEY: gatePub, ...extra };   // MERGE 2: SAVES, the realm's records (R2)
  const call = async (path, body, bearer = null) => {
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
  return { env, call, guest, registered, claim, seedMarks, fetch, found, seatHome, identityPublic: kp.publicKey, gateKey: gatePriv, gatePriv };   // ARENA4: the relay's signing half, so a bout's receipt is signed as the relay signs it   // PROF3: the identity key's public half, a product record's verifier; SEAT1b: the relay's private half, a watch receipt's signer
}

/** A device's storage holding `who`'s session (net/accountClient.js SESSION_KEY). */
export const sessionStorageOf = (sessionKey, who) => ({ getItem: (k) => (k === sessionKey ? JSON.stringify({ secret: who.secret, id: who.id }) : null) });
