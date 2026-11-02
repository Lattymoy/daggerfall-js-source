// AUDIT SCALE II (2026-10-11, the audit of SCALE4d-SCALE5d; Mac: "Lets do an audit on everything. Ensure perfection"):
// A D1 BINDING WITH ONE READ REPLICA THAT LAGS THE PRIMARY until told to catch up - D1's Sessions API as its contract
// says it: withSession(bookmark) may serve its first read from ANY replica at least as new as `bookmark`;
// 'first-primary' sends the first statement to the primary; 'first-unconstrained' anywhere. A write always goes to the
// primary, and the session's reads after it are the primary's (one session is sequentially consistent). Positions are
// test/accountDb.mjs's d1Position (the primary's total_changes()), so a bookmark the fake answers orders as D1's do.
//
// accountDb.mjs's own sessions have no replica - every statement is the primary's, as on a database whose read
// replication is off - so a law about WHICH position a session starts from could not fail over it. This one can:
// `sync()` copies the primary into the replica now, and every session started from a bookmark the replica holds reads
// the copy until it writes. The replica is a file under the OS's temporary directory, removed by `close()`.
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { d1Position } from './accountDb.mjs';

const WRITE = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i;

/** A replica's statements over its copy - D1's statement face, its answers saying a replica served them. */
function apiOver(raw) {
  return {
    _raw: raw,
    prepare(sql) {
      const stmt = raw.prepare(sql);
      let args = [];
      const api = {
        _replica: true,
        bind(...a) { args = a; return api; },
        async first(c) { const r = stmt.get(...args) ?? null; return c === undefined ? r : (r ? r[c] ?? null : null); },
        async all() { return { results: stmt.all(...args), meta: { served_by_primary: false, rows_read: 0, rows_written: 0 } }; },
        async run() { stmt.all(...args); return { meta: { changes: 0, served_by_primary: false } }; },
        _result() { return { results: stmt.all(...args), meta: { served_by_primary: false } }; },
      };
      return api;
    },
    async batch(list) { return list.map((s) => s._result()); },
  };
}

/**
 * Wrap the primary `P` (accountDb's d1()). Answers `{ db, sync, log, close }`: `db` the binding to hand the service,
 * `sync()` the replica brought level with the primary now (its position answered), `log` every session opened - its
 * constraint, whether it began on the replica, and both positions then - and `close()` the replica's files removed.
 */
export function laggy(P) {
  const dir = mkdtempSync(join(tmpdir(), 'laggy-d1-'));
  let R = null;
  let n = 0;
  const log = [];
  const sync = () => {
    const f = join(dir, `replica-${++n}.db`);
    P._raw.exec(`VACUUM INTO '${f}'`);
    R = { api: apiOver(new DatabaseSync(f)), pos: d1Position(P) };
    return R.pos;
  };
  class Session {
    #onReplica; #rec;
    constructor(constraint) {
      this.#onReplica = !!R && constraint !== 'first-primary' && (constraint === 'first-unconstrained' || R.pos >= constraint);
      this.#rec = { constraint, replica: this.#onReplica, replicaPos: R?.pos ?? null, primaryPos: d1Position(P), statements: [] };
      log.push(this.#rec);
    }
    prepare(sql) {
      if (WRITE.test(sql)) this.#onReplica = false;
      this.#rec.statements.push([this.#onReplica ? 'replica' : 'primary', sql]);
      return (this.#onReplica ? R.api : P).prepare(sql);
    }
    batch(list) { return (list.every((s) => s._replica) ? R.api : P).batch(list); }
    getBookmark() { return this.#onReplica ? R.pos : d1Position(P); }
  }
  const db = new Proxy(P, {
    get(t, k) {
      if (k === 'withSession') return (c) => new Session(c);
      const v = Reflect.get(t, k);
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
  const close = () => { rmSync(dir, { recursive: true, force: true }); };
  return { db, sync, log, close };
}
