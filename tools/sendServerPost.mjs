#!/usr/bin/env node
// SERVER-POST (2026-10-08, Mac: "Let's develop an ingame server mailbox that goes next to the hourglass in the pause
// menu. It should show notifications whenever players have a message. First use is to utilize it for players being
// granted items."): THE POST, SENT BY THE OPERATOR. No route a player can reach writes a piece of the server's post
// (server-account/src/post.js only reads, claims and throws away), so a piece is written here, by hand, through
// .github/workflows/server-post.yml:
//   1. a dry run reads the accounts the names find, and whether each already holds this send - and nothing is written;
//   2. the run with apply on writes one piece to each, INSERT OR IGNORE over the one-a-send index (0093's
//      ux_server_post_batch), so a send run twice sends once.
//
//   node tools/sendServerPost.mjs --names <handles>                                        the names, one a line
//   node tools/sendServerPost.mjs --look <handles> <batch>                                 the dry run's statement
//   node tools/sendServerPost.mjs --sql <handles> <batch> <item> <subject> <message>       the send's statement
//
// `handles` is comma-separated, as the config's lists are; `item` is one of POST_ITEMS - an item is MINTED here by the
// game's own code (the Hourlock as its drop mints it, src/systems/gilded.js), never typed into a workflow; `message`
// takes `\n` for a line break. Every word reaches the statement through sqlText, quotes doubled.
//
// HOURS-FIRST (2026-10-08, Mac: "for all the accounts here I want to grant them ... each the gilded gun"): the post's
// first use - HOURS_FIRST, the thirteen of the first clear (server-account/wrangler.toml HOURS_FIRST_HANDLES), each
// sent the Hourlock. That send is migration 0094 (`--migration hours-first` prints it), so it lands with the deploy that
// ships the mailbox; test/serverpost_send.test.js holds the migration to this file's statement.

import { readFileSync } from 'node:fs';
import { isMain } from './lib/isMain.mjs';
import { HANDLE_RE } from '../src/net/handleShape.js';
import { POST_BATCH_RE, POST_SENDER, POST_SUBJECT_MAX, POST_BODY_MAX } from '../src/net/postLaw.js';
import { mintHourlock } from '../src/systems/gilded.js';

/** THE ITEMS A PIECE MAY HOLD, by name - each minted by the game's own code. `none` a message alone. */
export const POST_ITEMS = Object.freeze({
  none: () => null,
  hourlock: () => mintHourlock(),   // the gilded gun: the Hourlock, as the Brass Remnant's spoils mint it
});
/** How many accounts one send may name. */
export const POST_RECIPIENTS_MAX = 200;

/** HOURS-FIRST: the first send - its name, what it holds and its words. */
export const HOURS_FIRST = Object.freeze({
  batch: 'hours-first-hourlock',
  item: 'hourlock',
  subject: "Hour's First",
  body: [
    'You were among the first to break an Abyss Dungeon. The Hour remembers.',
    '',
    "Your title, Hour's First, and its aura, The First Hour, are yours to wear - choose them on your profile.",
    '',
    'The Hourlock is enclosed. Claim it and it goes into the pack of the online character you are playing.',
    '',
    `- ${POST_SENDER}`,
  ].join('\n'),
});

/** A word as an SQL string, its quotes doubled - nothing in it can end the string. */
export const sqlText = (/** @type {string} */ s) => `'${String(s).replaceAll("'", "''")}'`;

/** The names a send is to, as `handle_lc` holds them - each a handle's shape, none twice, at least one; or throw. */
export function postHandles(raw) {
  const names = String(raw ?? '').split(',').map((h) => h.trim()).filter(Boolean);
  if (!names.length || names.length > POST_RECIPIENTS_MAX) throw new Error(`not a list of names: 1 to ${POST_RECIPIENTS_MAX} handles, comma-separated`);
  for (const h of names) if (!HANDLE_RE.test(h)) throw new Error(`not a handle: ${JSON.stringify(h)}`);
  return [...new Set(names.map((h) => h.toLowerCase()))];
}

/** A send's name, or throw. */
export function postBatch(raw) {
  const b = String(raw ?? '').trim();
  if (!POST_BATCH_RE.test(b)) throw new Error(`not a send's name: ${JSON.stringify(raw)} - lower-case words and hyphens, 3 to 48`);
  return b;
}

/** A piece's words within the post's bounds - `\n` a line break - or throw. */
export function postWords({ subject, body }) {
  const s = String(subject ?? '').trim();
  const b = String(body ?? '').replaceAll('\\n', '\n').trim();
  if (!s || s.length > POST_SUBJECT_MAX) throw new Error(`not a subject: 1 to ${POST_SUBJECT_MAX} characters`);
  if (!b || b.length > POST_BODY_MAX) throw new Error(`not a message: 1 to ${POST_BODY_MAX} characters`);
  if (/[\u0000-\u0008\u000b-\u001f\u007f]/.test(s + b)) throw new Error('a control character is not words');
  return { subject: s, body: b };
}

/** The item a name mints (its record as JSON), or null for `none`; or throw. */
export function postItem(raw) {
  const k = String(raw ?? '').trim();
  if (!Object.hasOwn(POST_ITEMS, k)) throw new Error(`not an item: ${JSON.stringify(raw)} - one of ${Object.keys(POST_ITEMS).join(', ')}`);
  const rec = POST_ITEMS[k]();
  return rec ? JSON.stringify(rec) : null;
}

const inList = (names) => names.map(sqlText).join(', ');

/** THE DRY RUN: each registered account the names find, and whether it already holds this send. */
export function lookSql(handles, batch) {
  const names = postHandles(handles), b = postBatch(batch);
  return `SELECT p.handle, p.handle_lc, (SELECT COUNT(*) FROM server_post s WHERE s.to_id = p.id AND s.batch = ${sqlText(b)}) AS sent FROM players p WHERE p.handle IS NOT NULL AND p.handle_lc IN (${inList(names)}) ORDER BY p.handle_lc;`;
}

/**
 * THE SEND: one piece to each registered account the names find - once a send an account (INSERT OR IGNORE over 0093's
 * index), its id the database's own random, its moment the database's own clock. RETURNING names the pieces it wrote
 * (a migration's copy leaves it off).
 * @param {{ handles: string, batch: string, item: string, subject: string, body: string }} o
 */
export function sendSql({ handles, batch, item, subject, body }, { returning = true } = {}) {
  const names = postHandles(handles), b = postBatch(batch), words = postWords({ subject, body }), rec = postItem(item);
  return `INSERT OR IGNORE INTO server_post (id, to_id, batch, sender, subject, body, item, sent_at)
SELECT lower(hex(randomblob(12))), p.id, ${sqlText(b)}, ${sqlText(POST_SENDER)}, ${sqlText(words.subject)}, ${sqlText(words.body)}, ${rec ? sqlText(rec) : 'NULL'}, CAST(strftime('%s', 'now') AS INTEGER)
FROM players p WHERE p.handle IS NOT NULL AND p.handle_lc IN (${inList(names)})${returning ? '\nRETURNING id, to_id' : ''};`;
}

/** HOURS-FIRST: the thirteen, off the config's own list. */
export function hoursFirstHandles(toml = readFileSync(new URL('../server-account/wrangler.toml', import.meta.url), 'utf8')) {
  const m = /^HOURS_FIRST_HANDLES = "([^"]*)"$/m.exec(toml);
  if (!m) throw new Error('server-account/wrangler.toml holds no HOURS_FIRST_HANDLES');
  return m[1];
}
/** HOURS-FIRST: the first send's statement, as migration 0094 holds it. */
export const hoursFirstSql = (toml) => sendSql({ ...HOURS_FIRST, handles: hoursFirstHandles(toml) }, { returning: false });

function main(argv) {
  if (argv[0] === '--names' && argv.length === 2) return void process.stdout.write(`${postHandles(argv[1]).join('\n')}\n`);
  if (argv[0] === '--look' && argv.length === 3) return void process.stdout.write(`${lookSql(argv[1], argv[2])}\n`);
  if (argv[0] === '--sql' && argv.length === 6) return void process.stdout.write(`${sendSql({ handles: argv[1], batch: argv[2], item: argv[3], subject: argv[4], body: argv[5] })}\n`);
  if (argv[0] === '--migration' && argv[1] === 'hours-first' && argv.length === 2) return void process.stdout.write(`${hoursFirstSql()}\n`);
  throw new Error('usage: node tools/sendServerPost.mjs --names <handles> | --look <handles> <batch> | --sql <handles> <batch> <item> <subject> <message> | --migration hours-first');
}

if (isMain(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(1); }
}
