#!/usr/bin/env node
// REVIVE (2026-10-14) - A REALM CHARACTER'S DEATH TAKEN BACK, BY THE OPERATOR. Mac, of TheHalfinStream: "I want to roll
// back this specific account", then "Undo the death", then "Full revive". Her Enduring elder died of her years in
// Castle Wayrest on 2026-10-13, and the remains bug (FIELD BUGS 2026-10-13d REMAINS-STAND) hid everything she lay with.
//
// THE PLAN, NEVER THE WRITE. This file reads what stood just before the death and what stands now - each a JSON of
// rows the workflow (.github/workflows/realm-revive.yml) asked D1 for, the first through Time Travel - and writes the
// statements that revive her, and a summary for the run's page. The workflow runs them only with apply on.
//
// WHAT A DEATH WROTE (server-account/src/legacy.js entomb, afterTomb), AND WHAT THE PLAN PUTS BACK:
//   - the tombstone (`realm_characters.dead_at`, `dead_why`): cleared - the character joins again, and her save, the last
//     checkpoint before the death (nothing checkpoints after one), is hers again with everything she carried;
//   - the line's record (`lineages`): her death taken back - stamped `revived` (src/systems/legacy/revived.js) and
//     dropped, with the remains row and the Succession it laid - and the houses her heir took up are hers again. The
//     stamp is what makes it hold: every copy that meets it drops the death, so a device that never heard of the revival
//     cannot kill her again (store.js mergeFacts, legacy.js putLineage). Its rev moves well past every copy's;
//   - the homes her heir inherited (`homes.char_id`): hers again;
//   - her guild seat (`guild_members`, deleted by guildMemberDead): put back as it stood - HELD, not written, when she
//     was the master (another was made master at her death) or the guild is gone or full;
//   - the item ledger (`item_uids`, released by releaseSteps): the pieces she held that her heir now holds are hers again,
//     and the heir's copies known copies (`item_dupes`) - else her first checkpoint claims them and the heir's next one
//     proves them copies charged to her. What nobody holds now her checkpoints register again on their own;
//   - her union with another player's character (`realm_unions`): REPORTED, never written - the other house heard she died.
// Her heir stays: a living member, theirs to keep or to delete from the Online door. Her years stay spent - an Enduring
// elder's next death is final, as it was.
//
// EVERY STATEMENT GUARDED: each writes only over the row as the plan read it (a death at its stamp, a record at its rev,
// a home and a piece the heir's), so a run cut short is planned and run again, and a second run writes nothing twice.
//
//   node tools/reviveRealmCharacter.mjs --query <name> --player <id> [--fallen <id>] [--line <id>] [--guild <id>] [--uids <file>]
//   node tools/reviveRealmCharacter.mjs --find --handle <handle> --facts <find.json> [--character <id>]
//   node tools/reviveRealmCharacter.mjs --plan --then <then.json> --now <now.json> --find <found.json> --out <revive.sql>
//                                       --summary <summary.md> [--keep-homes] [--keep-guild]

import { readFileSync, writeFileSync } from 'node:fs';
import { isMain } from './lib/isMain.mjs';
import { isHandleShaped } from '../src/net/handleShape.js';
import { stampRevived, dropRevived, revivedOf } from '../src/systems/legacy/revived.js';
import { GUILD_RANK_MASTER, GUILD_MEMBERS_MAX, GUILD_ID_RE } from '../src/net/guild/guildLaw.js';
import { ID_RE, REALM_CHARACTER_RE } from '../src/net/identityToken.js';
import { ITEM_UID_RE } from '../src/systems/item/itemLaw.js';
import { REALM_CHARACTERS_MAX } from '../server-account/src/realm.js';
import { LINEAGE_ID_RE } from '../server-account/src/legacy.js';

/** The window the death is looked for in, when no character is named: 2026-10-12T12Z - 2026-10-14T12Z. */
export const DEATH_WINDOW = Object.freeze({ from: Date.parse('2026-10-12T12:00:00Z') / 1000, to: Date.parse('2026-10-14T12:00:00Z') / 1000 });
/** How far before the death the past is read (seconds): the last write before the tombstone, never the tombstone's. */
export const BEFORE_DEATH_S = 120;
/** How far the line's rev moves past every copy's: a device's copy written after the revival but from a stale base is
 *  refused as stale and merges the stored copy in (legacy.js putLineage) - the margin keeps the stored copy the newer. */
export const REV_MARGIN = 100;
/** D1's longest statement (bytes) - a plan with a longer one writes nothing (REVIVE-SIZE). */
export const STATEMENT_MAX_BYTES = 100_000;

/** An SQL string, a quote doubled - for values the plan read back from D1 itself, never a caller's text. */
export const sqlStr = (s) => `'${String(s).replace(/'/g, "''")}'`;
/** A ledger key: an item's uid or a crafted piece's provenance - sixteen hex either way (judge.js ledgerKeyOf). */
const KEY_RE = ITEM_UID_RE;

/**
 * THE QUERIES the workflow asks D1, each scoped to the one account (and its fallen, line, guild) - no table is ever
 * exported whole. The ids are D1's own, read back by `--find`; each is held to the id shape before it is spliced.
 */
export function query(name, { player, fallen = null, line = null, guild = null, uids = [] }) {
  if (typeof player !== 'string' || !ID_RE.test(player)) throw new Error('the player is not an account id');
  if (fallen != null && !REALM_CHARACTER_RE.test(fallen)) throw new Error('the fallen is not a realm character id');
  if (line != null && !LINEAGE_ID_RE.test(line)) throw new Error('the line is not a line id');
  if (guild != null && !GUILD_ID_RE.test(guild)) throw new Error('the guild is not a guild id');
  const P = sqlStr(player), F = fallen && sqlStr(fallen);
  switch (name) {
    case 'player': throw new Error('the player is asked by handle: playerQuery');
    case 'chars': return `SELECT id, name, lineage_id, person_id, dead_at, dead_why, created_at FROM realm_characters WHERE player = ${P}`;
    case 'lineages': return `SELECT id, model, rev, record FROM lineages WHERE player = ${P}`;
    case 'homes': return `SELECT map_id, building_key, char_id, guild_id, deed FROM homes WHERE player = ${P}`;
    case 'seat': return `SELECT player, char_id, guild_id, rank, name, joined_at, vault_level, vault_limit, vault_day, vault_taken FROM guild_members WHERE player = ${P} AND char_id = ${F}`;
    case 'guild': return guild ? `SELECT g.id, (SELECT COUNT(*) FROM guild_members m WHERE m.guild_id = g.id) AS members, (SELECT player || ':' || char_id FROM guild_members m WHERE m.guild_id = g.id AND m.rank = ${GUILD_RANK_MASTER} LIMIT 1) AS master FROM guilds g WHERE g.id = ${sqlStr(guild)}` : 'SELECT 1 WHERE 0';
    case 'items': return `SELECT uid, state FROM item_uids WHERE char_id = ${F}`;
    case 'itemsNow': {
      const list = uids.filter((u) => typeof u === 'string' && KEY_RE.test(u));
      return list.length ? `SELECT uid, player, char_id, state FROM item_uids WHERE uid IN (${list.map(sqlStr).join(', ')})` : 'SELECT 1 WHERE 0';
    }
    case 'unions': return `SELECT sid, a_player, a_char, b_player, b_char, ended_at, ended_why, ended_by FROM realm_unions WHERE a_char = ${F} OR b_char = ${F}`;
    default: throw new Error(`no query named ${name}`);
  }
}

/** The account, by its handle as the service folds it (`handle_lc`) - a registered one; its quote doubled. */
export function playerQuery(handle) {
  if (!isHandleShaped(handle)) throw new Error('not a handle');
  return `SELECT id, handle FROM players WHERE handle_lc = ${sqlStr(handle.toLowerCase())} AND handle IS NOT NULL`;
}

const parseRecord = (text) => { try { return typeof text === 'string' ? JSON.parse(text) : text; } catch { return null; } };
const personOf = (rec, id) => (rec?.people ?? []).find((p) => p?.id === id) ?? null;

/**
 * WHO DIED: the account's realm character dead in the window - one, of an Enduring line, a member of it - or the one
 * named. Answers `{ fallen, line, person, diedAt, deadAt, heirs, living }`, or `{ error }`.
 * @param {{ player: {id:string,handle:string}|null, chars: any[], lineages: any[] }} facts
 */
export function findFallen(facts, { character = null, window = DEATH_WINDOW } = {}) {
  if (!facts.player) return { error: 'no registered account by that handle' };
  const chars = facts.chars ?? [];
  const dead = character ? chars.filter((c) => c.id === character)
    : chars.filter((c) => c.dead_at != null && c.dead_at >= window.from && c.dead_at <= window.to && c.dead_why === 'fell');
  if (dead.length !== 1) return { error: character ? `no realm character ${character} on this account` : `${dead.length} realm characters of this account fell in the window - name one with --character` };
  const fallen = dead[0];
  const lineRow = (facts.lineages ?? []).find((l) => l.id === fallen.lineage_id);
  if (!lineRow) return { error: 'the character is no member of a line this account holds online' };
  const rec = parseRecord(lineRow.record);
  const person = personOf(rec, fallen.person_id);
  if (!person) return { error: 'the line holds no such person' };
  const diedAt = person.died ? Number(person.died.at) : revivedOf(person).at(-1);
  if (!Number.isFinite(diedAt)) return { error: 'the line says nothing of a death to take back' };
  const living = chars.filter((c) => c.dead_at == null).length;
  const heirs = chars.filter((c) => c.lineage_id === fallen.lineage_id && c.dead_at == null && c.id !== fallen.id && (fallen.dead_at == null || c.created_at >= fallen.dead_at)).map((c) => c.id);
  return { fallen: fallen.id, name: fallen.name, line: lineRow.id, model: lineRow.model, rev: lineRow.rev, person: person.id, diedAt, deadAt: fallen.dead_at, cause: person.died?.cause ?? null, place: person.died?.place ?? null, heirs, living };
}

/**
 * THE PLAN. `then` the rows just before the death, `now` the rows as they stand (both after the present was put back,
 * the service still held), `found` findFallen's answer. Answers `{ sql: string[], held: string[], said: string[] }`.
 */
export function planRevive({ then, now, found, player, nowS, restoreHomes = true, restoreGuild = true }) {
  const sql = [], held = [], said = [];
  const P = sqlStr(player), F = sqlStr(found.fallen);
  const fallenNow = (now.chars ?? []).find((c) => c.id === found.fallen);
  // 1. THE TOMBSTONE - at the stamp it was read with, and only while the roster has room (the living are listed six).
  // Written AFTER the line (REVIVE-SIZE): a write cut between them leaves her line stamped and her tombstone standing -
  // dead as she was, run again - never alive under a line whose next write entombs her again
  let tombstone = null;
  if (fallenNow?.dead_at != null) {
    if (found.living >= REALM_CHARACTERS_MAX) held.push(`the account holds ${found.living} living realm characters - the revived one would fall off the roster's ${REALM_CHARACTERS_MAX}; delete one first`);
    else {
      tombstone = `UPDATE realm_characters SET dead_at = NULL, dead_why = NULL, lease = NULL, updated_at = ${nowS} WHERE id = ${F} AND player = ${P} AND dead_at = ${fallenNow.dead_at} AND dead_why = 'fell' AND (SELECT COUNT(*) FROM realm_characters WHERE player = ${P} AND dead_at IS NULL) < ${REALM_CHARACTERS_MAX};`;
      said.push(`the tombstone of ${found.name ?? found.fallen} (dead at ${new Date(fallenNow.dead_at * 1000).toISOString()}) cleared`);
    }
  } else said.push(`${found.name ?? found.fallen} stands already - no tombstone to clear`);

  // 2. THE LINE - her death taken back, stamped so it holds, and the houses her heir took up hers again
  const lineNow = (now.lineages ?? []).find((l) => l.id === found.line);
  const rec = parseRecord(lineNow?.record);
  const me = personOf(rec, found.person);
  const heirPersons = new Set((now.chars ?? []).filter((c) => found.heirs.includes(c.id)).map((c) => c.person_id));
  if (rec && me) {
    const was = JSON.parse(JSON.stringify(rec));
    const before = JSON.stringify(rec);
    stampRevived(me, found.diedAt);
    dropRevived(rec);
    let houses = 0;
    if (restoreHomes) {
      rec.houses = (rec.houses ?? []).map((h) => {
        if (h?.from !== me.id || !heirPersons.has(h.by)) return h;
        houses++;
        const { from, ...row } = h;   // eslint-disable-line no-unused-vars
        return { ...row, by: me.id };
      });
    }
    if (JSON.stringify(rec) !== before) {
      rec.rev = Math.max(Number(lineNow.rev) || 0, Number(rec.rev) || 0) + REV_MARGIN;
      const edit = recordEdit(was, rec);
      if (!edit) held.push('the line\'s record changed past what an edit in place can say - nothing written to it');
      else {
        sql.push(`UPDATE lineages SET record = ${edit}, rev = ${rec.rev}, updated_at = ${nowS} WHERE player = ${P} AND id = ${sqlStr(found.line)} AND rev = ${lineNow.rev};`);
        said.push(`the line's record: her death (at ${found.diedAt}) taken back and stamped, its remains and its Succession dropped${houses ? `, ${houses} house row(s) hers again` : ''}; rev ${lineNow.rev} -> ${rec.rev}`);
      }
    } else said.push('the line\'s record already holds her alive and stamped');
  } else held.push('the line or her person is not in the record as it stands - nothing written to it');
  if (tombstone) sql.push(tombstone);

  // 3. THE HOMES her heir inherited - hers again where the heir still holds them
  const homesThen = (then.homes ?? []).filter((h) => h.char_id === found.fallen);
  for (const h of homesThen) {
    const n = (now.homes ?? []).find((x) => x.map_id === h.map_id && x.building_key === h.building_key);
    const where = `home ${h.map_id}:${h.building_key}`;
    if (!n) { held.push(`${where} is no longer this account's - not written`); continue; }
    if (n.char_id === found.fallen) { said.push(`${where} is hers already`); continue; }
    if (!restoreHomes) { said.push(`${where} stays with ${n.char_id} (homes kept)`); continue; }
    if (!found.heirs.includes(n.char_id) || n.guild_id != null) { held.push(`${where} is held by ${n.char_id}${n.guild_id ? ' as a guild hall' : ''}, not her heir - not written`); continue; }
    sql.push(`UPDATE homes SET char_id = ${F} WHERE player = ${P} AND char_id = ${sqlStr(n.char_id)} AND map_id = ${h.map_id} AND building_key = ${h.building_key} AND guild_id IS NULL;`);
    said.push(`${where} hers again (from ${n.char_id})${n.deed ? ' - a knight\'s house: the heir\'s save still holds its bank deed' : ''}`);
  }

  // 4. THE GUILD SEAT - as it stood, unless putting it back would take another's place
  const seat = (then.seat ?? [])[0];
  if (seat) {
    const g = (now.guild ?? [])[0];
    const where = `her seat in guild ${seat.guild_id} (rank ${seat.rank})`;
    if (!restoreGuild) said.push(`${where} not put back (guild kept)`);
    else if (!g) held.push(`${where}: the guild is gone - not written`);
    else if (seat.rank === GUILD_RANK_MASTER && g.master && g.master !== `${player}:${found.fallen}`) held.push(`${where}: she was its master, and ${g.master} was made master at her death - not written; the master's call`);
    else if (g.members >= GUILD_MEMBERS_MAX) held.push(`${where}: the guild is full (${g.members}) - not written`);
    else {
      const v = (x) => (x == null ? 'NULL' : typeof x === 'number' ? String(x) : sqlStr(x));
      sql.push(`INSERT OR IGNORE INTO guild_members (player, char_id, guild_id, rank, name, joined_at, vault_level, vault_limit, vault_day, vault_taken) SELECT ${[seat.player, seat.char_id, seat.guild_id, seat.rank, seat.name, seat.joined_at, seat.vault_level, seat.vault_limit, seat.vault_day, seat.vault_taken].map(v).join(', ')} WHERE EXISTS (SELECT 1 FROM guilds WHERE id = ${sqlStr(seat.guild_id)}) AND (SELECT COUNT(*) FROM guild_members WHERE guild_id = ${sqlStr(seat.guild_id)}) < ${GUILD_MEMBERS_MAX};`);
      said.push(`${where} put back, joined as she joined`);
    }
  } else said.push('she held no guild seat');

  // 5. THE LEDGER - the pieces she held that her heir holds now are hers again; the heir's copies known copies
  const heldThen = (then.items ?? []).filter((r) => r.state === 'held').map((r) => r.uid);
  const byUid = new Map((now.items ?? []).map((r) => [r.uid, r]));
  let back = 0, others = 0, free = 0;
  for (const uid of heldThen) {
    const r = byUid.get(uid);
    if (!r) { free++; continue; }
    if (r.char_id === found.fallen) continue;
    if (r.player === player && found.heirs.includes(r.char_id)) {
      sql.push(`UPDATE item_uids SET char_id = ${F}, state = 'held', claim_char = NULL, claim_at = NULL, at = ${nowS} WHERE uid = ${sqlStr(uid)} AND char_id = ${sqlStr(r.char_id)};`);
      sql.push(`INSERT OR IGNORE INTO item_dupes (uid, char_id, at) VALUES (${sqlStr(uid)}, ${sqlStr(r.char_id)}, ${nowS});`);
      back++;
    } else if (r.player !== player) others++;
  }
  said.push(`the ledger: ${heldThen.length} piece(s) she held; ${back} her heir holds, hers again; ${free} nobody holds (her next checkpoints register them)${others ? `; ${others} another account holds now - not written` : ''}`);
  if (others) held.push(`${others} of her pieces are held by another account now - not written`);

  // 6. HER UNION - reported, never written
  for (const u of then.unions ?? []) {
    if (u.ended_at != null) continue;
    const other = u.a_char === found.fallen ? `${u.b_player}:${u.b_char}` : `${u.a_player}:${u.a_char}`;
    held.push(`she was wed to ${other}; the union ended at her death and their house heard it - not reopened`);
  }
  // ALL OR NOTHING (REVIVE-SIZE): D1 refuses a statement past STATEMENT_MAX_BYTES, and a revive written in part is worse
  // than none - so a plan with one too long writes nothing, and says which
  const long = sql.filter((q) => new TextEncoder().encode(q).length > STATEMENT_MAX_BYTES);
  if (long.length) {
    held.push(`${long.length} statement(s) longer than D1 takes (${STATEMENT_MAX_BYTES} bytes) - NOTHING written: ${long.map((q) => q.slice(0, 40)).join('; ')}`);
    sql.length = 0;
  }
  return { sql, held, said };
}

/**
 * REVIVE-SIZE: THE LINE'S NEW RECORD, AS AN EDIT IN PLACE - SQLite's own JSON functions over the stored text - never
 * the whole record in the statement. A record may be LINEAGE_MAX_BYTES (128 KiB) and D1 refuses a statement past 100 KB;
 * an edit names only what the revival moved: the people changed (each set whole, by index), the remains rows dropped
 * (removed by index, the last first), the Succession, the house rows changed, and the rev. Proven before it is
 * answered: the same edit made here, over the record as read, must give the new record exactly - else null, and the
 * plan holds the line. The statement's guard (the rev it read) makes sure the text it edits is the text read.
 * @param {any} was the record as it stands @param {any} rec the record the revival makes
 * @returns {string | null} the SQL expression for the new `record`
 */
export function recordEdit(was, rec) {
  const same = (a, b) => canon(a) === canon(b);
  const keys = new Set([...Object.keys(was ?? {}), ...Object.keys(rec ?? {})]);
  for (const k of keys) if (!['people', 'remains', 'pending', 'houses', 'rev'].includes(k) && !same(was[k], rec[k])) return null;
  if ((was.people ?? []).length !== (rec.people ?? []).length || (was.houses ?? []).length !== (rec.houses ?? []).length) return null;
  const sets = [];
  rec.people.forEach((p, i) => { if (!same(was.people[i], p)) sets.push([`$.people[${i}]`, p]); });
  (rec.houses ?? []).forEach((h, i) => { if (!same(was.houses[i], h)) sets.push([`$.houses[${i}]`, h]); });
  if (!same(was.pending ?? null, rec.pending ?? null)) sets.push(['$.pending', rec.pending ?? null]);
  sets.push(['$.rev', rec.rev]);
  // the rows dropped: the record's remains are the stored ones, in order, less some - matched in one walk
  const gone = [];
  const kept = rec.remains ?? [];
  let m = 0;
  (was.remains ?? []).forEach((r, k) => { if (m < kept.length && same(r, kept[m])) m++; else gone.push(k); });
  if (m !== kept.length) return null;
  // proven: the same edit, made here
  const made = JSON.parse(JSON.stringify(was));
  for (const k of [...gone].reverse()) made.remains.splice(k, 1);
  for (const [path, v] of sets) {
    const at = /^\$\.(\w+)(?:\[(\d+)\])?$/.exec(path);
    if (at[2] == null) made[at[1]] = v; else made[at[1]][Number(at[2])] = v;
  }
  if (!same(made, rec)) return null;
  const removed = gone.length ? `json_remove(record, ${[...gone].reverse().map((k) => sqlStr(`$.remains[${k}]`)).join(', ')})` : 'record';
  return `json_set(${removed}, ${sets.map(([path, v]) => `${sqlStr(path)}, json(${sqlStr(JSON.stringify(v))})`).join(', ')})`;
}
/** A value's JSON with its keys in order - two records the same whatever order their keys were written in. */
const canon = (v) => JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));

/** The run's page: who, what is written, what is held for the operator. */
export function summaryOf({ handle, found, plan, apply }) {
  const lines = [
    `## Revive: ${handle}`,
    '',
    `- **${found.name ?? found.fallen}** (${found.fallen}), a member of the ${found.model} line ${found.line} - died ${found.cause ?? 'of an unknown cause'}${found.place?.region ? ` in ${found.place.region}` : ''} (world minute ${found.diedAt}).`,
    `- Heir(s) since: ${found.heirs.length ? found.heirs.join(', ') : 'none'}. Living realm characters now: ${found.living}.`,
    '',
    '### What the run writes',
    ...plan.said.map((s) => `- ${s}`),
    '',
    '### Held for you (nothing written)',
    ...(plan.held.length ? plan.held.map((s) => `- ${s}`) : ['- nothing']),
    '',
    `${plan.sql.length} statement(s).`,
    apply ? '**Applied.**' : '**A dry run: nothing was written.** Run again with apply on to write it.',
    '',
    'Tell the player: close every tab of the game, then play her from the Online door. Her years are still spent - an Enduring elder\'s next death is final.',
  ];
  return `${lines.join('\n')}\n`;
}

/** D1's JSON (`wrangler d1 execute --json`) as rows. */
const rowsOf = (text) => { const j = JSON.parse(text); return Array.isArray(j) ? (j[0]?.results ?? []) : (j.results ?? []); };

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const has = (k) => argv.includes(k);
  // THE MODE IS THE FIRST WORD, never any word: the plan's own line carries `--find <found.json>`, and asked "is
  // --find anywhere?" first, the first run (2026-10-14) took the plan for a find and read a facts file it never named
  const mode = argv[0];
  try {
    if (mode === '--player-query') {
      process.stdout.write(playerQuery(arg('--handle')));
    } else if (mode === '--query') {
      const uids = arg('--uids') ? rowsOf(readFileSync(arg('--uids'), 'utf8')).filter((r) => r.state === 'held').map((r) => r.uid) : [];
      process.stdout.write(query(arg('--query'), { player: arg('--player'), fallen: arg('--fallen') || null, line: arg('--line') || null, guild: arg('--guild') || null, uids }));
    } else if (mode === '--find') {
      const handle = arg('--handle');
      if (!isHandleShaped(handle)) throw new Error('not a handle');
      const facts = JSON.parse(readFileSync(arg('--facts'), 'utf8'));
      const character = arg('--character') || null;
      if (character && !REALM_CHARACTER_RE.test(character)) throw new Error('not a realm character id');
      const found = findFallen(facts, { character });
      if (found.error) throw new Error(found.error);
      process.stdout.write(JSON.stringify({ player: facts.player.id, ...found, before: found.deadAt != null ? found.deadAt - BEFORE_DEATH_S : null }));
    } else if (mode === '--plan') {
      const found = JSON.parse(readFileSync(arg('--find'), 'utf8'));
      const then = JSON.parse(readFileSync(arg('--then'), 'utf8'));
      const now = JSON.parse(readFileSync(arg('--now'), 'utf8'));
      const plan = planRevive({ then, now, found, player: found.player, nowS: Math.floor(Date.now() / 1000), restoreHomes: !has('--keep-homes'), restoreGuild: !has('--keep-guild') });
      writeFileSync(arg('--out'), plan.sql.join('\n') + (plan.sql.length ? '\n' : ''));
      writeFileSync(arg('--summary'), summaryOf({ handle: arg('--handle') ?? found.player, found, plan, apply: has('--apply') }));
      process.stdout.write(`${plan.sql.length} statement(s), ${plan.held.length} held\n`);
    } else {
      console.error('usage: see the head of this file');
      process.exit(2);
    }
  } catch (e) {
    console.error(`::error::${e.message}`);
    process.exit(1);
  }
}
