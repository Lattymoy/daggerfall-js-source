#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// RESTORE (2026-09-29, Mac: "I want people to get their stuff back") - THE HOUSES A DELETED CUSTOMS CHARACTER TOOK WITH IT,
// PLANNED BACK FROM THE DATABASE'S OWN HISTORY.
//
// From CUSTOMS-CARRY's arrival on main (2026-09-29 03:09:50 UTC) until HOUSE-LOSS, customs carried an offline
// character's online home, guild place and Renown track to its realm id before the first save was sent, and the door's
// Delete on a character whose first save never landed took them with it - the home's pieces and hidden furniture by the
// tables' cascade - and left the census spent (bible/01-Overview/bugs/Field-Bugs-2026-09-29.md, HOUSE-LOSS). Those rows are
// gone from the database; D1 Time Travel still holds them. The operator's workflow (.github/workflows/realm-restore.yml)
// reads a snapshot from before the loss (THEN) and the database as it stands (NOW), and this plans what comes back.
//
// MAC'S CALL, AS ASKED ("To the offline character"): everything a deleted customs character took comes back to the
// OFFLINE character it came from - the home with every piece and its hidden list, the guild place, the track - and the
// census is unspent, so the character can be brought in again and customs carries them across, as HOUSE-LOSS's undo
// does from now on. An account whose deleted character TRADED in the realm is HELD for Mac: a character brought in again
// brings its offline items again, and what it traded away would then stand twice. Nothing another player holds now is
// taken back: a building someone else bought since is reported, never written.
//
//   node tools/realmRestore.mjs --then then.sql --now now.sql --out restore.sql [--handles handles.json] [--summary s.md]
//
// `then.sql` and `now.sql` are `wrangler d1 export` dumps of the tables below; `handles.json` is `wrangler d1 execute
// --json` of `SELECT id, handle FROM players` (a report names players by handle, never by id). The SQL written is
// idempotent - INSERT OR IGNORE, and an UPDATE guarded by the census's own law - so a run cut short is run again.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { GUILD_MEMBERS_MAX, GUILD_RANK_MASTER } from '../src/net/guild/guildLaw.js';
import { isMain } from './lib/isMain.mjs';   // AUDIT 68: the one "am I the program" test
import { lit } from './lib/sqlLit.mjs';
import { reseatRestored } from './yardReseat.mjs';

/** The realm's own ids (server-account/src/realm.js REALM_ID_RE): a home under one is a realm character's, never lost here. */
const REALM_ID_RE = /^r[0-9a-f]{20}$/;
/** The tables each dump carries. THEN: what a deleted character took. NOW: where things stand, and who traded. */
export const THEN_TABLES = Object.freeze(['homes', 'home_decor', 'home_hidden', 'guild_members', 'renown_tracks']);
export const NOW_TABLES = Object.freeze(['homes', 'home_decor', 'home_hidden', 'guild_members', 'guilds', 'renown_tracks', 'realm_census', 'realm_characters', 'realm_trades']);

/** A dump, loaded: foreign keys off, since a dump carries some tables and not the ones they point at. */
export function loadDump(/** @type {string} */ sql) {
  const db = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
  db.exec(sql);
  return db;
}

/** One SQL literal (tools/lib/sqlLit.mjs, its one home since PURSE-BACK - handed on for this tool's readers). */
export { lit };
/** AUDIT HOME-VOTE II A6: a home's row as it is put back - every column of the snapshot's but its `score`. */
export const homeRowOf = (/** @type {Record<string, unknown>} */ home) => {
  const { score: _score, ...row } = home;
  return row;
};
const insert = (/** @type {string} */ table, /** @type {Record<string, unknown>} */ row) => {
  const cols = Object.keys(row);
  return `INSERT OR IGNORE INTO ${table} (${cols.join(', ')}) VALUES (${cols.map((c) => lit(row[c])).join(', ')});`;
};
const all = (/** @type {DatabaseSync} */ db, /** @type {string} */ sql, /** @type {unknown[]} */ ...a) => db.prepare(sql).all(...a).map((r) => ({ ...r }));
const one = (/** @type {DatabaseSync} */ db, /** @type {string} */ sql, /** @type {unknown[]} */ ...a) => {
  const r = db.prepare(sql).get(...a);
  return r ? { ...r } : null;
};

/**
 * THE PLAN. `then` and `now` are the two dumps, loaded; `handles` names players. Answers `{ restored, held, taken,
 * notes, reopened, sql }`: `restored` one entry a (player, offline character) with what comes back; `held` the
 * accounts Mac decides; `taken` the buildings someone else holds now; `notes` what could not be put back as it was (a
 * guild gone, full, or mastered again); `reopened` the offline characters that may be brought in again; `sql` the
 * statements, in order.
 * @param {{ then: DatabaseSync, now: DatabaseSync, handles?: Map<string, string> }} at
 */
export function planRestore({ then, now, handles = new Map() }) {
  const who = (/** @type {string} */ p) => handles.get(p) ?? `(an account, ${String(p).slice(0, 8)})`;
  // THE CHARACTERS BROUGHT IN AND DELETED SINCE: every census row of it spent, and no realm character stands on it now
  const standing = new Set(all(now, 'SELECT origin_id FROM realm_characters WHERE origin_id IS NOT NULL').map((r) => r.origin_id));
  const realmIds = new Set(all(now, 'SELECT id FROM realm_characters').map((r) => r.id));
  const gone = all(now, 'SELECT DISTINCT char_id FROM realm_census WHERE spent = 1').map((r) => r.char_id).filter((o) => !standing.has(o)).sort();
  // THE ACCOUNTS HELD: one whose realm character that no longer stands made a trade that landed
  const held = new Set();
  for (const t of all(now, "SELECT a_player AS p, a_char AS c FROM realm_trades WHERE state = 'done' UNION SELECT b_player, b_char FROM realm_trades WHERE state = 'done' AND b_player IS NOT NULL")) {
    if (t.p && !realmIds.has(t.c)) held.add(t.p);
  }
  const censusPlayers = (/** @type {string} */ o) => all(now, 'SELECT player FROM realm_census WHERE char_id = ?', o).map((r) => r.player);

  /** @type {string[]} */
  const sql = [];
  /** @type {any[]} */
  const restored = [];
  /** @type {any[]} */
  const heldOut = [];
  /** @type {any[]} */
  const taken = [];
  /** @type {string[]} */
  const notes = [];
  /** @type {string[]} */
  const reopened = [];

  for (const origin of gone) {
    if (REALM_ID_RE.test(origin)) continue;
    // every account this character's rows stood under, THEN and in the census NOW
    const owners = new Set([
      ...all(then, 'SELECT player FROM homes WHERE char_id = ?', origin).map((r) => r.player),
      ...all(then, 'SELECT player FROM guild_members WHERE char_id = ?', origin).map((r) => r.player),
      ...all(then, 'SELECT player FROM renown_tracks WHERE char_id = ?', origin).map((r) => r.player),
      ...censusPlayers(origin),
    ]);
    const heldBy = [...owners].filter((p) => held.has(p));
    if (heldBy.length) {
      for (const p of heldBy) heldOut.push({ player: p, handle: who(p), origin, why: 'a realm character of this account that no longer stands traded in the realm' });
      continue;
    }
    for (const player of owners) {
      const entry = { player, handle: who(player), origin, homes: /** @type {any[]} */ ([]), pieces: 0, hidden: 0, guild: false, track: false };
      for (const home of all(then, 'SELECT * FROM homes WHERE player = ? AND char_id = ?', player, origin)) {
        const place = `${home.map_id}/${home.building_key}`;
        const nowHome = one(now, 'SELECT player, char_id FROM homes WHERE map_id = ? AND building_key = ?', home.map_id, home.building_key);
        if (nowHome && nowHome.player === player && nowHome.char_id === origin) continue;   // never lost
        // AUDIT GUILD1d S8: a guild's hall is its guild's, whichever account bought it - never a home bought again
        if (nowHome && (nowHome.player !== player || String(nowHome.char_id).startsWith('guild:'))) {
          taken.push({ player, handle: who(player), origin, building: place, by: who(nowHome.player) });
          continue;
        }
        // AUDIT HOME-VOTE II A6: never its score - the votes behind it are no table of this tool's, and a score with no
        // votes brought a home back hidden for good (migration 0107's triggers keep it from the votes alone)
        if (!nowHome) sql.push(insert('homes', homeRowOf(home)));
        // the house back - or, bought again by the same account since, its pieces and hidden list back into it
        const pieces = all(then, 'SELECT * FROM home_decor WHERE map_id = ? AND building_key = ?', home.map_id, home.building_key);
        // STALL-SHAPE's audit: a yard's stall or boulder from before migration 0121 comes back re-seated, as 0121 left
        // every other (tools/yardReseat.mjs reseatRestored)
        for (const p of pieces) {
          const back = reseatRestored(p);
          sql.push(insert('home_decor', back.row));
          if (back.unsure) notes.push(`${who(player)}: yard piece ${p.id} at ${place} (model ${p.model}) is written as the snapshot holds it - placed between TEMPLE-STEPS' deploy and STALL-SHAPE's, against either stand-in; if it was TEMPLE-STEPS' and the snapshot is from before migration 0121 ran, it stands 0.26 m further back than it was put`);
        }
        const hidden = all(then, 'SELECT * FROM home_hidden WHERE map_id = ? AND building_key = ?', home.map_id, home.building_key);
        for (const h of hidden) sql.push(insert('home_hidden', h));
        entry.homes.push({ building: place, rebought: !!nowHome });
        entry.pieces += pieces.length;
        entry.hidden += hidden.length;
      }
      const place = one(then, 'SELECT * FROM guild_members WHERE player = ? AND char_id = ?', player, origin);
      if (place && !one(now, 'SELECT 1 AS x FROM guild_members WHERE player = ? AND char_id = ?', player, origin)) {
        const guild = one(now, 'SELECT id, name FROM guilds WHERE id = ?', place.guild_id);
        const members = one(now, 'SELECT COUNT(*) AS n FROM guild_members WHERE guild_id = ?', place.guild_id)?.n ?? 0;
        const master = one(now, 'SELECT 1 AS x FROM guild_members WHERE guild_id = ? AND rank = ?', place.guild_id, GUILD_RANK_MASTER);
        if (!guild) notes.push(`${who(player)}: the guild ${place.guild_id} is gone - the place cannot come back`);
        else if (members >= GUILD_MEMBERS_MAX) notes.push(`${who(player)}: ${guild.name} is full - the place waits for you`);
        else if (place.rank === GUILD_RANK_MASTER && master) notes.push(`${who(player)}: ${guild.name} has a master again - the place waits for you`);
        else { sql.push(insert('guild_members', place)); entry.guild = true; }
      }
      const track = one(then, 'SELECT * FROM renown_tracks WHERE player = ? AND char_id = ?', player, origin);
      if (track && !one(now, 'SELECT 1 AS x FROM renown_tracks WHERE player = ? AND char_id = ?', player, origin)) {
        sql.push(insert('renown_tracks', track));
        entry.track = true;
      }
      if (entry.homes.length || entry.guild || entry.track) restored.push(entry);
    }
    // ...and the character may be brought in again, carrying them - the census as it stood before that customs
    sql.push(`UPDATE realm_census SET spent = 0 WHERE char_id = ${lit(origin)} AND NOT EXISTS (SELECT 1 FROM realm_characters WHERE origin_id = ${lit(origin)});`);
    reopened.push(origin);
  }
  return { restored, held: heldOut, taken, notes, reopened, sql: sql.join('\n') + (sql.length ? '\n' : '') };
}

/** The plan, in words for the run's summary: who gets what back, who is held, what someone else holds now. */
export function planReport(/** @type {ReturnType<typeof planRestore>} */ plan) {
  const out = ['## Realm restore: what a deleted customs character took with it', ''];
  out.push(`- **Coming back:** ${plan.restored.length} (account, character) - ${plan.restored.reduce((n, e) => n + e.homes.length, 0)} homes, ${plan.restored.reduce((n, e) => n + e.pieces, 0)} pieces, ${plan.restored.filter((e) => e.guild).length} guild places.`);
  out.push(`- **May be brought in again:** ${plan.reopened.length} offline characters.`);
  out.push(`- **Held for you:** ${plan.held.length}. **Taken by someone else since:** ${plan.taken.length}.`, '');
  for (const e of plan.restored) out.push(`- ${e.handle}: ${e.homes.map((h) => `home ${h.building}${h.rebought ? ' (its pieces, into the house bought again)' : ''}`).join(', ') || 'no home'}${e.guild ? ', guild place' : ''}${e.pieces ? `, ${e.pieces} pieces` : ''}`);
  for (const h of plan.held) out.push(`- HELD ${h.handle}: ${h.why}`);
  for (const t of plan.taken) out.push(`- TAKEN ${t.handle}: building ${t.building} belongs to ${t.by} now`);
  for (const n of plan.notes) out.push(`- NOTE ${n}`);
  return out.join('\n') + '\n';
}

/** `wrangler d1 execute --json` output of `SELECT id, handle FROM players`, as a map. */
export function handlesOf(/** @type {string} */ json) {
  const map = new Map();
  let parsed = null;
  try { parsed = JSON.parse(json); } catch { return map; }
  for (const block of Array.isArray(parsed) ? parsed : [parsed]) {
    for (const r of block?.results ?? []) if (typeof r?.id === 'string' && typeof r?.handle === 'string' && r.handle) map.set(r.id, r.handle);
  }
  return map;
}

// ── the command ──
const arg = (/** @type {string} */ name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : null; };
if (isMain(import.meta.url)) {
  const thenPath = arg('then'), nowPath = arg('now'), out = arg('out');
  if (!thenPath || !nowPath || !out) {
    console.error('usage: node tools/realmRestore.mjs --then then.sql --now now.sql --out restore.sql [--handles handles.json] [--summary summary.md]');
    process.exit(2);
  }
  const handlesPath = arg('handles');
  const plan = planRestore({
    then: loadDump(readFileSync(thenPath, 'utf8')),
    now: loadDump(readFileSync(nowPath, 'utf8')),
    handles: handlesPath ? handlesOf(readFileSync(handlesPath, 'utf8')) : new Map(),
  });
  writeFileSync(out, plan.sql);
  const report = planReport(plan);
  const summary = arg('summary');
  if (summary) writeFileSync(summary, report);
  process.stdout.write(report);
}
