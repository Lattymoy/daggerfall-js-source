// PURSE-BACK (2026-10-19): THE ACCOUNT SERVICE'S OWN BINDINGS, OVER WRANGLER - D1's and R2's surface as the service's
// Worker uses them (env.DB: prepare / bind / first / all / run; env.SAVES: get / delete), answered by `wrangler d1
// execute` and `wrangler r2 object` with the repository's CLOUDFLARE_API_TOKEN. An operator's run in Actions can then
// call the service's own functions - server-account/src/review.js reviewAct, its law whole - where the service itself
// asks for a developer signed in (tools/realmRollback.mjs).
//
// WRANGLER TAKES NO PARAMETERS, so a statement's binds are written into it as literals (literalSql, through lit) - the
// placeholders outside quotes alone. WRANGLER SAYS NOTHING OF A WRITE'S ROWS (its JSON's meta is `{ duration }` on the
// local database), so `run` asks SQLite in the same command - `SELECT changes()` after the write, on its connection - and
// the review's acts read that count (a rollback whose guarded UPDATE moved nothing says so and writes no finding). A
// MISSING OBJECT is R2's "The specified key does not exist." and answered null, as the binding answers it; any other
// failure throws, its words wrangler's and never its command (a statement can name an account's id, and a run's log in
// a public repository is public).
//
// DRY, the bindings READ and HOLD every write: a statement that writes is answered as one row changed and kept in `held`
// as the literal it would have run, an object's delete kept the same way - so an act runs whole, every refusal its own,
// and writes nothing.
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { lit } from './sqlLit.mjs';

/** A statement that writes - held by a dry binding. */
const WRITES = /^\s*(?:INSERT|UPDATE|DELETE|REPLACE)\b/i;
/** R2's own word for a key that holds nothing. */
const MISSING = /The specified key does not exist/;
/** What `run` appends: the rows the write before it changed, asked on its connection. */
export const CHANGES_SQL = 'SELECT changes() AS changes';

/**
 * A statement with its `?` and `?N` placeholders (SQLite's, outside quotes) written as `args`' literals - a bare `?`
 * takes the number after the highest bound so far, as SQLite numbers it. Every arg must be bound, and nothing past them.
 * @param {string} sql @param {unknown[]} [args]
 */
export function literalSql(sql, args = []) {
  let out = '';
  /** @type {string | null} */
  let quote = null;
  let top = 0;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (quote) {
      out += c;
      if (c === quote) quote = null;   // a doubled quote closes and opens again: the same text either way
      continue;
    }
    if (c === "'" || c === '"') { quote = c; out += c; continue; }
    if (c !== '?') { out += c; continue; }
    const digits = /^\d*/.exec(sql.slice(i + 1))[0];
    const n = digits ? Number(digits) : top + 1;
    if (!(n >= 1 && n <= args.length)) throw new Error(`literalSql: ?${n} binds nothing (${args.length} bound)`);
    out += lit(args[n - 1]);
    top = Math.max(top, n);
    i += digits.length;
  }
  if (quote) throw new Error('literalSql: a quote never closed');
  if (top !== args.length) throw new Error(`literalSql: ${args.length} bound, ${top} asked`);
  return out;
}

/**
 * `exec` for the bindings: wrangler - WRANGLER's words (the workflows' `npx --yes wrangler@4`), else those - run in `cwd`
 * with `args`, answering its stdout. A failure throws wrangler's own error lines and its exit, never the command.
 * @param {{ command?: string, cwd?: string }} [o]
 */
export function wranglerExec({ command = process.env.WRANGLER || 'npx --yes wrangler@4', cwd = process.cwd() } = {}) {
  const [bin, ...pre] = command.split(/\s+/).filter(Boolean);
  return (/** @type {string[]} */ args) => {
    try {
      return execFileSync(bin, [...pre, ...args], {
        cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024,
        env: { ...process.env, WRANGLER_SEND_METRICS: 'false', FORCE_COLOR: '0' },
      });
    } catch (e) {
      const said = String(e?.stderr ?? '').split('\n').filter((l) => /error|exist/i.test(l)).map((l) => l.trim()).join(' ');
      throw Object.assign(new Error(`wrangler ${args.slice(0, 3).join(' ')} failed (exit ${e?.status ?? '?'}): ${said || 'no words'}`), { stderr: String(e?.stderr ?? '') });
    }
  };
}

/**
 * env.DB over `wrangler d1 execute <database> --<where> --json --yes --command <statement>`.
 * @param {{ database: string, exec: (args: string[]) => string, where?: 'remote' | 'local', dry?: boolean, held?: string[] }} o
 */
export function wranglerD1({ database, exec, where = 'remote', dry = false, held = [] }) {
  const ask = (/** @type {string} */ sql) => {
    const out = JSON.parse(exec(['d1', 'execute', database, `--${where}`, '--json', '--yes', '--command', sql]));
    if (!Array.isArray(out) || out.some((r) => r?.success === false)) throw new Error('wrangler d1 execute: an answer that is no success');
    return out;
  };
  const rows = (/** @type {string} */ sql, /** @type {unknown[]} */ args) => {
    if (dry && WRITES.test(sql)) throw new Error('wranglerD1: a write asked for rows - a dry binding cannot answer it');
    return ask(literalSql(sql, args))[0]?.results ?? [];
  };
  return {
    prepare(/** @type {string} */ sql) {
      /** @type {unknown[]} */
      let args = [];
      const api = {
        bind(/** @type {unknown[]} */ ...a) { args = a; return api; },
        async first(/** @type {string} */ col) {
          const row = rows(sql, args)[0] ?? null;
          return col ? row?.[col] ?? null : row;
        },
        async all() { return { results: rows(sql, args), meta: {} }; },
        async run() {
          const text = literalSql(sql, args);
          if (dry && WRITES.test(sql)) {
            held.push(text);
            return { meta: { changes: 1 } };
          }
          const out = ask(`${text}; ${CHANGES_SQL}`);
          const changes = out[1]?.results?.[0]?.changes;
          if (!Number.isSafeInteger(changes)) throw new Error('wranglerD1: a write whose rows nobody counted');
          return { meta: { changes } };
        },
      };
      return api;
    },
    async batch() { throw new Error('wranglerD1: no batch - one statement a command, and no act run here asks one'); },
  };
}

/**
 * env.SAVES over `wrangler r2 object get|delete <bucket>/<key> --<where>`, an object's bytes through a file in `dir`.
 * @param {{ bucket: string, exec: (args: string[]) => string, dir: string, where?: 'remote' | 'local', dry?: boolean, held?: string[] }} o
 */
export function wranglerR2({ bucket, exec, dir, where = 'remote', dry = false, held = [] }) {
  let n = 0;
  return {
    async get(/** @type {string} */ key) {
      const file = join(dir, `object-${++n}`);
      try {
        exec(['r2', 'object', 'get', `${bucket}/${key}`, `--${where}`, '--file', file]);
        const bytes = readFileSync(file);
        return { size: bytes.byteLength, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
      } catch (e) {
        if (MISSING.test(String(e?.stderr ?? '')) || MISSING.test(String(e?.message ?? ''))) return null;
        throw e;
      } finally {
        rmSync(file, { force: true });   // wrangler leaves an empty file behind a key that holds nothing
      }
    },
    async delete(/** @type {string} */ key) {
      if (dry) {
        held.push(`r2 object delete ${bucket}/${key}`);
        return;
      }
      exec(['r2', 'object', 'delete', `${bucket}/${key}`, `--${where}`]);
    },
  };
}
