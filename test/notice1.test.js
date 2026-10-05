// NOTICE1 (2026-09-28, Mac: "The new notice board should be a physical object that houses quests, the player auction
// house, etc"; "Go"): THE NOTICE BOARD - the law both ends read (src/net/boardLaw.js), the account service's notes,
// reports and notices driven through the real Worker over node:sqlite with every migration applied
// (server-account/src/board.js, 0026_board.sql), and the client's book, window and wiring.
// bible/06-Systems/Professions-Arc.md 10.1, 10.6 and 10.7.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import worker from '../server-account/src/index.js';
import { pinNote, readBoard } from '../server-account/src/board.js';
import { ROUTES, ACCOUNT_VERSION } from '../server-account/src/service.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { renownXpFor } from '../src/net/renown.js';
import {
  NOTES_LIVE_MAX, NOTE_DAYS, NOTE_DAY_S, BOARD_NOTES_SHOWN, BOARD_NOTICES_SHOWN, NOTES_PINNED_MAX, NOTE_REPORTS_HIDE,
  BOARD_CACHE_MS, NOTE_BUTTONS, BOARD_SWITCH, boardSwitchOf, boardKeyOk, noteWords, noticeWords, unseenCount, unseenText,
  NOTE_SUBJECT_MAX, NOTE_BODY_MAX, BOUNTY_BOARD_LINE,
} from '../src/net/boardLaw.js';
import { LETTER_SUBJECT_MAX, LETTER_BODY_MAX } from '../src/net/letterLaw.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
function d1() {
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
const T0 = 1_800_000_000;

async function stand({ open = 'on', developers = 'Devra', moderators = 'Mora' } = {}) {
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = {
    DB: d1(), SAVES: r2(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*',   // MERGE 2: SAVES, the realm's records
    BOARD_OPEN: open, DEVELOPER_HANDLES: developers, MODERATOR_HANDLES: moderators,
  };
  const call = async (path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: JSON.stringify(body ?? {}),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const guest = async () => (await call('/v1/auth/guest', { ...ACCEPTED })).body;   // MERGE 2: main's TERMS1
  const registered = async (handle, { renown = 1 } = {}) => {
    const g = await guest();
    assert.equal((await call('/v1/auth/register', { handle, password: 'a good long one', ...ACCEPTED }, g.secret)).status, 200, `${handle} registers`);
    const character = `char-${handle.toLowerCase()}`;
    if (renown > 1) {
      // RENOWN-CHAR: the character's own track again (MERGE 2 had seeded RENOWN-ACCOUNT's one track an account)
      env.DB._raw.prepare('INSERT OR REPLACE INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(g.id, character, handle, renownXpFor(renown), T0, T0);
    }
    return { secret: g.secret, id: g.id, character, handle };
  };
  const read = (who, map) => call('/v1/board/read', { map }, who.secret);
  const pin = (who, map, extra = {}) => call('/v1/board/pin', { map, subject: 'Hands wanted', body: 'Meet at the gate at dusk.', days: 7, rid: rid(), ...extra }, who.secret);
  /** AUDIT 28 N3: accounts past their sprout's fortnight - the only reporters whose reports count toward hiding */
  const seasoned = (...who) => { for (const w of who) env.DB._raw.prepare('UPDATE players SET created_at = ? WHERE id = ?').run(Math.floor(Date.now() / 1000) - 15 * 86400, w.id); };
  return { env, call, guest, registered, read, pin, seasoned };
}
let _rid = 0;
const rid = () => `pin-${String(++_rid).padStart(6, '0')}`;
const TOWN = 1234567, OTHER = 7654321;

// ─── THE LAW ─────────────────────────────────────────────────────────────

test('NOTICE1 the law: three live notes an account, one, three or seven days, thirty shown a board and twenty notices, ten pins an hour, three reports hide, a minute\'s cache; a note\'s words are MAIL1\'s letter law', () => {
  assert.equal(NOTES_LIVE_MAX, 3);
  assert.deepEqual(NOTE_DAYS, [1, 3, 7]);
  assert.equal(NOTE_DAY_S, 86400);
  assert.deepEqual([BOARD_NOTES_SHOWN, BOARD_NOTICES_SHOWN, NOTES_PINNED_MAX, NOTE_REPORTS_HIDE, BOARD_CACHE_MS], [30, 20, 10, 3, 60_000]);
  assert.deepEqual(NOTE_BUTTONS, ['party', 'guild', 'duel', 'commission']);   // PROF6: a crafter's commission (10.6)
  assert.deepEqual(BOARD_SWITCH, ['off', 'dev', 'on']);
  assert.deepEqual(['on', 'dev', 'off', 'ON', undefined].map(boardSwitchOf), ['on', 'dev', 'off', 'off', 'off']);
  assert.deepEqual([0, 4294967295, -1, 4294967296, 1.5, '7'].map(boardKeyOk), [true, true, false, false, false, false]);
  assert.deepEqual([NOTE_SUBJECT_MAX, NOTE_BODY_MAX], [LETTER_SUBJECT_MAX, LETTER_BODY_MAX], 'the letter\'s bounds, not a second set');
  assert.deepEqual(noteWords({ subject: '  Hands   wanted ', body: 'Meet\n\n\n\nat dusk', days: 3, button: 'party' }),
    { subject: 'Hands wanted', body: 'Meet\n\nat dusk', days: 3, button: 'party' }, 'cleaned as a letter is');
  assert.deepEqual(noteWords({ subject: 'a', body: 'b', days: 3 }).button, null, 'no button');
  assert.deepEqual(['no-subject', 'no-body', 'bad-note-days', 'bad-note-days', 'bad-note-button', 'subject-long'].map((e, i) => [
    { body: 'b', days: 1 }, { subject: 'a', days: 1 }, { subject: 'a', body: 'b', days: 2 }, { subject: 'a', body: 'b' },
    { subject: 'a', body: 'b', days: 1, button: 'trade' }, { subject: 'x'.repeat(61), body: 'b', days: 1 },
  ][i]).map((n) => noteWords(n).error), ['no-subject', 'no-body', 'bad-note-days', 'bad-note-days', 'bad-note-button', 'subject-long']);
  assert.equal(noticeWords({ subject: 'a', body: 'b', days: 15 }).error, 'bad-notice-days');
  assert.equal(noticeWords({ subject: 'a', body: 'b', days: 14 }).days, 14);
  const board = { notices: [{ at: 10 }], notes: [{ at: 5 }, { at: 20 }] };
  assert.deepEqual([unseenCount(board, null), unseenCount(board, 9), unseenCount(board, 20)], [3, 2, 0]);
  assert.deepEqual([unseenText(3), unseenText(0)], ['3 new', '']);
  assert.equal(BOUNTY_BOARD_LINE, "The town's bounties are posted on its Bounty Board.");
});

// ─── THE SERVICE ─────────────────────────────────────────────────────────

test('NOTICE1 the schema and the routes: a note\'s button and its hiding are CHECKed; (author, rid) is one note; an account gone takes its notes and reports; eight routes; the service\'s version in both places (acct18 at NOTICE1, AUDIT 29\'s acct21 since); shipped at dev', async () => {
  const { env, registered } = await stand();
  const a = await registered('Anna');
  const raw = env.DB._raw;
  const put = (id, extra = {}) => raw.prepare(`INSERT INTO board_notes (id, map_id, author, author_name, subject, body, button, at, expires_at, hidden, rid)
    VALUES (?, ?, ?, 'Anna', 's', 'b', ?, 1, 2, ?, ?)`).run(id, extra.map ?? 1, a.id, extra.button ?? null, extra.hidden ?? 0, extra.rid ?? id);
  put('n-000000000000000001');
  assert.throws(() => put('n-000000000000000002', { button: 'trade' }), /CHECK/);
  assert.throws(() => put('n-000000000000000003', { hidden: 3 }), /CHECK/);
  assert.throws(() => put('n-000000000000000004', { map: -1 }), /CHECK/);
  assert.throws(() => put('n-000000000000000005', { rid: 'n-000000000000000001' }), /UNIQUE/, 'one note a request');
  raw.prepare('INSERT INTO board_reports (note_id, reporter, at) VALUES (?, ?, 1)').run('n-000000000000000001', a.id);
  raw.prepare('DELETE FROM players WHERE id = ?').run(a.id);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM board_notes').get().n, 0, 'an account gone takes its notes');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM board_reports').get().n, 0, '...and its reports');
  for (const r of ['/v1/board/read', '/v1/board/pin', '/v1/board/take-down', '/v1/board/report', '/v1/board/mod/remove', '/v1/board/mod/restore', '/v1/board/notice', '/v1/board/notice/remove']) {
    assert.ok(ROUTES.has(r), r);
  }
  assert.equal(ACCOUNT_VERSION, 'acct82');   // AUDIT ARENA-LADDER moved it on last (acct82: /v1/arena/attempt and migration 0082, the ladder attempt ticket - acct79 on its branch, renumbered past GLOBAL-MARKET, SHADOW-CLOAK and SERAPH-WINGS at the merges); SERAPH-WINGS moved it on (acct81: DEVELOPER_HANDLES grants the Seraph Wings - DEVELOPER_AURA); SHADOW-CLOAK moved it on (acct80: SHADOW_FANG_HANDLES grants the Holo Shadow Cloak with the title - acct78 on its branch, renumbered past SERPENT1 and GLOBAL-MARKET at the merges); GLOBAL-MARKET moved it on (acct79: buy orders the Bay's - the Orders view reads every board's, and a fill from another region pays its courier out of its pay; no migration); SERPENT1 moved it on (acct78: /v1/serpent/claim and the serpents slain on the cards, migration 0081 - acct75, acct76 then acct77 on its branch, renumbered past HOME-PRICE (acct75), PRIMARCH and FOUNDER4 (acct76) and KNIGHT-HOUSE (acct77) at the merges); FIELD BUGS 2026-10-04d KNIGHT-HOUSE moved it on (acct77: a deed the realm gave, held off the record - /v1/homes/deed and the release of a hold, migration 0079); PRIMARCH and FOUNDER4 moved it on (acct76: PRIMARCH_HANDLES grants the Primarch's title, glyph and aura; migration 0078 links an account to a row it shares a character with, for Founder - acct75 on its branch, which HOME-PRICE took first); HOME-PRICE moved it on (acct75: a home's price held to the online range, the town's sale refund; before it, BAG1 and GUILD2's acct74: the Materials Bag carried count and /v1/stores/deposit, migration 0076; a guild new name and its vault, /v1/guilds/rename and /v1/guilds/vault*, migration 0077); AEGIS moved it on (acct73: AEGIS_HANDLES grants the Aegis of Oblivion's title, glyph and aura); ARENA4, ARENA4b and WD3 moved it on (acct72 - acct66 on the arena branch, renumbered past PROF-541's acct70 and SILVER-WAYS' acct71 at its merges onto main: the arena records and the online homes it displaced - migrations 0074 and 0075 - and the layout a home was bought in - 0073); SILVER-WAYS and PROF2b before it (acct71: a raid's silver under the day's combat cap, guild deeds and guild contracts, the Motherlodes - migrations 0071 and 0072 - acct66 on its branch, renumbered past PROF-541's acct66-acct70 at the merge); AUDIT PROF-541 before it (acct70: the Alchemy audit's fixes, the hall door set by rank alone - hallEntry; a jewel's first craft its piece and base's; no migration); PROF12 before it (acct69: Alchemy's brew, the Apothecaries' counter, a Transmuter's transmutations, Disenchanting, the Apothecary opened; migration 0070); PROF10 before it (acct68: the jeweller's bench's pieces and the jeweller's hand, a Lapidary's cracked gem; no migration); PROF9 before it (acct67: the fire's dishes and a dish's cook's hand, migration 0069; acct67 past another branch's acct66); GUILD-YARD before it (acct65: a guild hall's outside and yard, its keepers'; no migration); AUDIT 529 before it (acct64: SIEGE-VOID's route and migration 0067, STANDING-TREND's standing rows, the void's audit); GLYPH-WEAR before it (acct63: a player shows or hides each glyph, migration 0068); WB12d moved it on (acct62: a receipt's rite and the rite's own receipt, the rows' embers - migration 0066 - main's part four and the Seats arc took acct46-acct61 first); before it SEAT2b part two moved it on (acct61: the works at peace); AUDIT-SEATS, PROF11 and SEAT2b before it (acct60: the audit, Masonry and the works - the Seats arc's fourteen renumbered past main's PATREON-LINK and part four (acct45, acct46) at the merge); SEASON1 part three before it (acct59: the Hall of Records); SEASON1 part two, the banner ribbon before it (acct58: the banner ribbon); SEASON1 part two, the client's before it (acct57: the Orc Raids and the stormy sea); SEASON1 part two, the economy before it (acct56: the economy's Tides); SEASON1 part two before it (acct55: the Tides); SEASON1 part one before it (acct54: the Seasons); CROWN2 before it (acct53: fealty and Pacts); CROWN1 part two before it (acct52: the Royal Tourney); CROWN1 before it (acct51: the crown Edicts); SEAT2a part three before it (acct50: the siege's pass and result); SEAT2a before it (acct49: the battles' week - the holder's window, the schedule, the sides and their Sellswords; migration 0052); SEAT1d before it (acct48: holding a seat - the upkeep, the Tithe, the Edicts; migration 0051); GUILD1d, GUILD1e and SEAT1a before it (acct47: the guild hall, its heraldry, the guild's own board and the seats' registry - migrations 0046, 0047 and 0048; acct42, then acct43, then acct44, then acct45, on their branch, renumbered past main's REALM-GZIP, SCALE1, MARKET-ANY and PATREON-LINK at the merges); FIELD BUGS 2026-10-01 part four before it (acct46: ANY-HOUR and HERB-XP - no hour refused, a herb at the rank's tier; acct45 on its branch, past PATREON-LINK at the merge); PATREON-LINK before it (acct45: a patron's own Patreon linked, its tier's title held by the pledge - migration 0045); MARKET-ANY before it (acct44: FIELD BUGS 2026-10-01 - a piece from the pack listed for gold, migration 0044); SCALE1 before it (acct43: the scaling audit's service half - metrics, indexes, fewer writes); REALM-GZIP before it (acct42: a realm save rides gzipped); PROF8 before it (acct41: Fishing with the net - migration 0042); GOLD-MARKET before it (acct40: the market in gold or Drakes - migration 0041); PINE-SHARE before it (acct39: Pine in every forest); WB9g before it (acct38: the Broker's insignia - a title and an aura bought, recorded on the row (0040) and paid for by the account's closed gates; the aura worn and signed (`au`)); HOUSING before it (acct37: HOME-RENT's rooms, HOME-LOOK's outside, HOME-YARD's yards - migrations 0037-0039); the PROF7 merge before it (acct36: past main's FIELD BUGS 2026-09-30, acct33, and the branch's acct33-acct35 never deployed); AUDIT 32 S1 before it (acct35: the Weavers' cloth alone lays on no first-craft XP); AUDIT 32 before it (acct34); PROF7 before it (acct33); PROF-DELETE before it (acct32); RENOWN-CHAR before it (acct31); MERGE 2 before it moved it on past main's realm (acct23); the merge of main moved it on past RAID4 and AUDIT RAID; PROF3 after it, PROF4 after that, PROF5 after that, AUDIT 30 after that, PROF5b after that, PROF6 after that, AUDIT 31 after that
  const toml = src('server-account/wrangler.toml');
  assert.match(toml, /^ACCOUNT_VERSION = "acct82"$/m);
  assert.match(toml, /^BOARD_OPEN = "on"$/m, 'BOARD-ON: shipped at dev, opened to everyone (Mac: "Board now, rest after fixes")');
  assert.deepEqual(['MARKS_OPEN', 'PROFESSIONS_OPEN'].map((k) => toml.match(new RegExp(`^${k} = "(\\w+)"$`, 'm'))?.[1]), ['on', 'on'], 'SWITCH-ON (Mac: "Fuck it lets switch everything on"): the Marks and the professions too, after PROF-SAVE and PROF-DELETE');
  assert.match(src('.github/workflows/account-deploy.yml'), /- "src\/net\/boardLaw\.js"/, 'the law the Worker bundles deploys it');
});

test('NOTICE1 read and pin: anyone the switch lets in reads a town\'s board; a guest cannot pin; three live notes and no fourth; a pin asked again is the note it made; a note is its TOWN\'s', async () => {
  const { read, pin, guest, registered } = await stand();
  const g = await guest();
  const anna = await registered('Anna');
  const empty = await read(g, TOWN);
  assert.equal(empty.status, 200);
  assert.deepEqual([empty.body.notes, empty.body.notices, empty.body.me.canPin], [[], [], false], 'a guest reads, and may not pin');
  assert.deepEqual([(await pin(g, TOWN)).status, (await pin(g, TOWN)).body.error], [403, 'board-need-account']);
  const first = await pin(anna, TOWN, { rid: 'pin-again-1' });
  assert.equal(first.status, 200);
  assert.deepEqual([first.body.note.from, first.body.note.subject, first.body.note.mine, first.body.live], ['Anna', 'Hands wanted', true, 1]);
  const again = await pin(anna, TOWN, { rid: 'pin-again-1' });
  assert.deepEqual([again.body.repeat, again.body.note.id], [true, first.body.note.id], 'the same request is the same note');
  await pin(anna, TOWN); await pin(anna, OTHER);
  const full = await pin(anna, TOWN);
  assert.deepEqual([full.status, full.body.error], [409, 'notes-full'], 'three on every board together, and no fourth');
  const town = (await read(g, TOWN)).body;
  assert.equal(town.notes.length, 2, 'the other town\'s note is the other town\'s');
  assert.ok(town.notes.every((n) => n.mine === false && n.from === 'Anna'), 'a guest\'s view: nobody\'s is theirs');
  assert.deepEqual([(await read(g, -1)).status, (await read(g, -1)).body.error], [400, 'bad-board']);
  assert.equal((await pin(anna, TOWN, { days: 30 })).body.error, 'bad-note-days', 'the words are refused before the room is asked');
});

test('NOTICE1 the switch: at dev the developers alone read and pin; off shuts everyone; a refusal the book reads', async () => {
  const dev = await stand({ open: 'dev' });
  const devra = await dev.registered('Devra');
  const anna = await dev.registered('Anna');
  assert.equal((await dev.read(devra, TOWN)).status, 200);
  assert.equal((await dev.read(devra, TOWN)).body.me.developer, true);
  assert.deepEqual([(await dev.read(anna, TOWN)).status, (await dev.read(anna, TOWN)).body.error], [403, 'board-closed']);
  assert.equal((await dev.pin(anna, TOWN)).body.error, 'board-closed');
  const off = await stand({ open: 'off' });
  const d2 = await off.registered('Devra');
  assert.equal((await off.read(d2, TOWN)).body.error, 'board-closed', 'off shuts the developers too');
});

test('NOTICE1 take down and report: an author takes their own down and nobody else\'s; a reporter stops seeing a note at once; three reporters hide it from everyone; one\'s own cannot be reported', async () => {
  const { read, pin, call, registered, seasoned } = await stand();
  const anna = await registered('Anna');
  const [b, c, d, e] = [await registered('Bran'), await registered('Cyra'), await registered('Dorn'), await registered('Eld')];
  seasoned(b, c, d);
  const n = (await pin(anna, TOWN)).body.note;
  assert.deepEqual([(await call('/v1/board/take-down', { id: n.id }, b.secret)).status], [404], 'not Bran\'s to take down');
  assert.deepEqual([(await call('/v1/board/report', { id: n.id }, anna.secret)).status, (await call('/v1/board/report', { id: n.id }, anna.secret)).body.error], [403, 'own-note']);
  assert.equal((await call('/v1/board/report', { id: n.id }, b.secret)).status, 200);
  assert.equal((await read(b, TOWN)).body.notes.length, 0, 'the reporter stops seeing it');
  assert.equal((await read(e, TOWN)).body.notes.length, 1, 'everyone else still does');
  await call('/v1/board/report', { id: n.id }, b.secret);   // twice is once
  await call('/v1/board/report', { id: n.id }, c.secret);
  assert.equal((await read(e, TOWN)).body.notes.length, 1, 'two reporters do not hide it');
  await call('/v1/board/report', { id: n.id }, d.secret);
  assert.equal((await read(e, TOWN)).body.notes.length, 0, 'the third hides it from everyone');
  assert.deepEqual((await read(anna, TOWN)).body.notes.map((x) => [x.id, x.hidden]), [[n.id, true]], 'its author still sees it, marked - and may take it down (AUDIT 28 N2)');
  const m = await pin(anna, TOWN);
  assert.equal((await call('/v1/board/take-down', { id: m.body.note.id }, anna.secret)).body.live, 1, 'taken down, and the room given back (the hidden one still counts)');
});

test('NOTICE1 moderation: a moderator sees what reports hid, with the count, and removes or restores it; a restored note is not hidden again; nobody else may; a muted author\'s notes leave every board while the mute stands', async () => {
  const { read, pin, call, registered, seasoned } = await stand();
  const anna = await registered('Anna');
  const mora = await registered('Mora');
  const readers = [await registered('Bran'), await registered('Cyra'), await registered('Dorn')];
  seasoned(...readers);
  const eld = await registered('Eld');
  const n = (await pin(anna, TOWN)).body.note;
  for (const r of readers) await call('/v1/board/report', { id: n.id }, r.secret);
  const seen = (await read(mora, TOWN)).body;
  assert.equal(seen.me.moderator, true);
  assert.deepEqual([seen.notes.length, seen.notes[0].hidden, seen.notes[0].reports], [1, true, 3], 'the moderator sees it, hidden, three reports');
  assert.equal((await call('/v1/board/mod/restore', { id: n.id }, eld.secret)).body.error, 'not-moderator');
  assert.equal((await call('/v1/board/mod/restore', { id: n.id }, mora.secret)).status, 200);
  assert.equal((await read(eld, TOWN)).body.notes.length, 1, 'restored: everyone sees it again');
  await call('/v1/board/report', { id: n.id }, eld.secret);
  assert.equal((await read(await registered('Fenn'), TOWN)).body.notes.length, 1, 'and a fourth report does not hide it again');
  assert.equal((await call('/v1/board/mod/remove', { id: n.id }, mora.secret)).status, 200);
  assert.equal((await read(mora, TOWN)).body.notes.length, 0, 'removed');
  // the mute
  const again = (await pin(anna, TOWN)).body.note;
  assert.equal((await call('/v1/mod/mute', { target: anna.id, minutes: 60 }, mora.secret)).status, 200);
  assert.equal((await read(eld, TOWN)).body.notes.length, 0, 'a muted author\'s notes leave the board');
  assert.equal((await read(mora, TOWN)).body.notes[0].id, again.id, '...but not the moderator\'s view');
  assert.deepEqual([(await pin(anna, TOWN)).status, (await pin(anna, TOWN)).body.error], [403, 'muted']);
});

test('NOTICE1 a recruitment note names its guild: only a rank that may invite pins one; a guild that is gone leaves the note without its button', async () => {
  const { env, read, pin, call, registered } = await stand();
  const gm = await registered('Aldric', { renown: 10 });
  const recruit = await registered('Bran');
  const lone = await registered('Cyra');
  // MERGE 2: a founding is a realm character's, paid on its record (main's AUDIT REALM2 S2) - Aldric plays one from here
  const R = await seatRealm(env, gm.secret, gm.handle, { name: gm.handle, level: 9, goldPieces: GUILD_FOUND_GOLD * 10, items: [] });
  // RENOWN-CHAR: a founding asks the founder's OWN track - carried to the realm character it plays from here, as customs carries one
  env.DB._raw.prepare('UPDATE renown_tracks SET char_id = ? WHERE player = ? AND char_id = ?').run(R.id, gm.id, gm.character);
  gm.character = R.id;
  const founded = await call('/v1/guilds/found', { character: R.id, name: 'The Hound', tag: 'HND', realm: R.at() }, gm.secret);
  const { guild } = founded.body ?? {};
  assert.ok(guild?.id, `the guild stands: ${JSON.stringify(founded)}`);
  await call('/v1/guilds/invite', { character: gm.character, handle: 'Bran' }, gm.secret);
  await call('/v1/guilds/answer', { character: recruit.character, guild: guild.id, accept: true }, recruit.secret);
  assert.deepEqual([(await pin(lone, TOWN, { button: 'guild', character: lone.character })).body.error], ['note-no-guild']);
  assert.deepEqual([(await pin(recruit, TOWN, { button: 'guild', character: recruit.character })).body.error], ['guild-rank'], 'a Recruit cannot invite, so cannot recruit');
  const n = (await pin(gm, TOWN, { button: 'guild', character: gm.character })).body.note;
  assert.deepEqual([n.button, n.guild], ['guild', { name: 'The Hound', tag: 'HND', heraldry: null }]);   // GUILD1e: and its banner, none chosen yet
  await call('/v1/guilds/leave', { character: recruit.character }, recruit.secret);
  assert.equal((await call('/v1/guilds/disband', { character: gm.character }, gm.secret)).status, 200, 'the guild disbands');
  const after = (await read(lone, TOWN)).body.notes[0];
  assert.deepEqual([after.id, after.button, after.guild], [n.id, null, undefined], 'the words stand; the button goes with the guild');
});

test('NOTICE1 the server\'s word: a developer posts a notice to every board, for one to fourteen days; nobody else may; it can be taken down', async () => {
  const { read, call, registered } = await stand();
  const devra = await registered('Devra');
  const anna = await registered('Anna');
  assert.equal((await call('/v1/board/notice', { subject: 'Festival', body: 'Ale at noon.', days: 3, rid: rid() }, anna.secret)).body.error, 'not-developer');
  assert.equal((await call('/v1/board/notice', { subject: 'Festival', body: 'Ale at noon.', days: 30, rid: rid() }, devra.secret)).body.error, 'bad-notice-days');
  const posted = (await call('/v1/board/notice', { subject: 'Festival', body: 'Ale at noon.', days: 3, rid: rid() }, devra.secret)).body;
  for (const map of [TOWN, OTHER]) assert.deepEqual((await read(anna, map)).body.notices.map((x) => [x.subject, x.from]), [['Festival', 'Devra']], 'on every board');
  assert.equal((await call('/v1/board/notice/remove', { id: posted.id }, anna.secret)).body.error, 'not-developer');
  assert.equal((await call('/v1/board/notice/remove', { id: posted.id }, devra.secret)).status, 200);
  assert.equal((await read(anna, TOWN)).body.notices.length, 0);
});

test('NOTICE1 expiry and the hour: a note past its days leaves the board and gives its room back (swept on the read); the eleventh pin in an hour is refused', async () => {
  const { env, registered } = await stand();
  const anna = await registered('Anna');
  const row = env.DB._raw.prepare('SELECT * FROM players WHERE id = ?').get(anna.id);
  const ctx = (nowS) => ({ db: env.DB, rand: (b) => globalThis.crypto.getRandomValues(b), nowS });
  const one = await pinNote(ctx(T0), row, env, { map: TOWN, subject: 's', body: 'b', days: 1, rid: 'exp-0000001' });
  assert.equal(one.ok, true);
  assert.equal((await readBoard(ctx(T0 + NOTE_DAY_S - 1), row, env, TOWN)).notes.length, 1, 'a day less a second: still up');
  const later = await readBoard(ctx(T0 + NOTE_DAY_S), row, env, TOWN);
  assert.deepEqual([later.notes.length, later.me.live], [0, 0], 'its day done: gone, and its room back');
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM board_notes').get().n, 0, 'the row swept, not kept');
  // the hour: pin and take down, ten times; the eleventh pin is refused
  let refused = null;
  for (let i = 0; i < NOTES_PINNED_MAX + 1; i++) {
    const r = await pinNote(ctx(T0 + 10), row, env, { map: TOWN, subject: 's', body: 'b', days: 1, rid: `hour-${String(i).padStart(5, '0')}` });
    if (r.error) { refused = [i, r.error]; break; }
    env.DB._raw.prepare('DELETE FROM board_notes WHERE id = ?').run(r.note.id);
  }
  assert.deepEqual(refused, [NOTES_PINNED_MAX - 1, 'board-rate'], 'the hour\'s tenth pin lands (this test\'s first note spent one) and the eleventh is refused');
});

// ─── THE CLIENT ──────────────────────────────────────────────────────────

import { createNoticeBook, parseNoteCommand, mintNoticeRid, NOTICE_SEEN_KEY, NOTICE_SEEN_MAX, NOTICE_TRIES, NOTE_USAGE } from '../src/net/noticeBook.js';
import { noticeCards, timeLeftText, snippetOf, NOTICE_SEALS } from '../src/ui/noticeWindow.js';
import { REFUSALS, accountRefusalText } from '../src/net/accountClient.js';
import { HOST_COMMANDS } from '../src/net/chatCommands.js';
import { RemotePlayers } from '../src/net/remotePlayers.js';
import { ACCEPTED } from '../src/net/legalLaw.js';   // MERGE 2: TERMS1 - a request that makes an account carries the versions ticked
import { r2, seatRealm } from './realmSeat.mjs';   // MERGE 2: a founding is a realm character's (AUDIT REALM2 S2)
import { GUILD_FOUND_GOLD } from '../src/net/guildLaw.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m };
}
const boardOf = (notes = [], notices = [], me = {}) => ({ map: TOWN, notes, notices, me: { canPin: true, live: 0, max: 3, moderator: false, developer: false, ...me } });

test('NOTICE1 the book reads a town\'s board through a minute\'s cache, keeps the last good one when the service fails (stale), learns whether the board is open, and asks a lost read again', async () => {
  let t = 0, reads = 0;
  const answers = [];
  const door = { read: async () => { reads++; return answers.shift() ?? { ok: true, data: boardOf() }; } };
  const book = createNoticeBook({ door, nowMs: () => t });
  assert.equal(book.open, null, 'not asked yet');
  answers.push({ ok: false, error: 'offline' }, { ok: true, data: boardOf([{ id: 'a', at: 5 }]) });
  const first = await book.read(TOWN);
  assert.deepEqual([first.board.notes.length, first.stale, reads, book.open], [1, false, 2, true], 'a lost answer is asked again');
  t = 59_999;
  await book.read(TOWN);
  assert.equal(reads, 2, 'inside the minute: the cache answers');
  t = 60_000;
  answers.push({ ok: false, error: 'server' }, { ok: false, error: 'server' }, { ok: false, error: 'server' });
  const slow = await book.read(TOWN);
  assert.deepEqual([slow.board.notes.length, slow.stale, slow.error, reads], [1, true, 'server', 2 + NOTICE_TRIES], 'the service slow: the last good board, marked stale');
  assert.deepEqual([(await book.read(TOWN)).stale, reads], [true, 2 + NOTICE_TRIES], '...and kept, marked, for the minute');
  answers.push({ ok: false, error: 'board-closed' });
  const shut = await book.read(TOWN, { force: true });
  assert.deepEqual([shut.board, book.open], [null, false], 'the switch says no: nothing shown, and the book knows');
  const asked = reads;
  t += 30_000;
  assert.deepEqual([(await book.read(TOWN)).error, reads], ['board-closed', asked], 'a refusal is an answer: not asked again inside the minute (a town stood in at dev is one read a minute, not one a second)');
  t += 30_000;
  await book.read(TOWN);
  assert.equal(reads, asked + 1, 'and asked again after it');
  assert.equal((await book.read(-4)).error, 'bad-board');
  const p1 = book.read(OTHER), p2 = book.read(OTHER);
  assert.equal(p1, p2, 'a second read while one is in flight is the same read');
});

test('NOTICE1 what this device has read: the count over a board is the notes newer than the last read; reading it sets it to nought; the table is bounded and survives a storage that refuses writes', async () => {
  const storage = memoryStorage();
  const door = { read: async () => ({ ok: true, data: boardOf([{ id: 'a', at: 100 }, { id: 'b', at: 200 }], [{ id: 'n', at: 150 }]) }) };
  const book = createNoticeBook({ door, storage });
  await book.read(TOWN);
  assert.deepEqual([book.seenAt(TOWN), book.unseen(TOWN)], [null, 3]);
  book.markSeen(TOWN);
  assert.deepEqual([book.seenAt(TOWN), book.unseen(TOWN)], [200, 0], 'read to the newest');
  assert.deepEqual(JSON.parse(storage.getItem(NOTICE_SEEN_KEY)), { [TOWN]: 200 });
  const big = memoryStorage();
  big.setItem(NOTICE_SEEN_KEY, JSON.stringify(Object.fromEntries(Array.from({ length: NOTICE_SEEN_MAX + 5 }, (_, i) => [String(i), i]))));
  const book2 = createNoticeBook({ door, storage: big });
  await book2.read(TOWN); book2.markSeen(TOWN);
  const kept = JSON.parse(big.getItem(NOTICE_SEEN_KEY));
  assert.equal(Object.keys(kept).length, NOTICE_SEEN_MAX, 'the oldest towns forgotten');
  assert.equal(kept[TOWN], 200, 'the newest kept');
  const refusing = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
  const book3 = createNoticeBook({ door, storage: refusing });
  await book3.read(TOWN); book3.markSeen(TOWN);
  assert.equal(book3.seenAt(TOWN), 200, 'memory holds it');
});

test('NOTICE1 a pin carries ONE request id through every retry - a lost answer is asked again with it, never a second note - and a second press while one is in flight is the same press; a refusal comes back in words', async () => {
  const sent = [];
  const answers = [{ ok: false, error: 'offline' }, { ok: false, error: 'server' }, { ok: true, data: { note: { id: 'x' } } }];
  let n = 0;
  const door = {
    read: async () => ({ ok: true, data: boardOf() }),
    pin: async (note, rid) => { sent.push([note.map, note.subject, rid]); return answers.shift(); },
  };
  const book = createNoticeBook({ door, rid: () => `rid-${String(++n).padStart(4, '0')}` });
  const a = book.pin(TOWN, { subject: 'Hands', body: 'Dusk', days: 3 });
  const b = book.pin(TOWN, { subject: 'Hands', body: 'Dusk', days: 3 });
  assert.equal(a, b, 'the same press');
  const r = await a;
  assert.deepEqual([r.ok, r.text], [true, 'Your note is pinned up.']);
  assert.deepEqual(sent, [[TOWN, 'Hands', 'rid-0001'], [TOWN, 'Hands', 'rid-0001'], [TOWN, 'Hands', 'rid-0001']], 'three asks, one id');
  answers.push({ ok: false, error: 'notes-full' });
  const full = await book.pin(TOWN, { subject: 'Hands', body: 'Dusk', days: 3 });
  assert.deepEqual([full.ok, full.text, sent.at(-1)[2]], [false, REFUSALS['notes-full'], 'rid-0002'], 'the service said no: its words, a fresh id next time');
  assert.match(mintNoticeRid(), /^n[0-9a-z]{15}$/);
});

test('NOTICE1 every word the board\'s service can answer has a sentence; /note remove is the host\'s, and its grammar is strict', () => {
  const words = [...src('server-account/src/board.js').matchAll(/error: '([a-z-]+)'/g)].map((m) => m[1]);
  const law = [...src('src/net/boardLaw.js').matchAll(/error: '([a-z-]+)'/g)].map((m) => m[1]);
  for (const w of new Set([...words, ...law])) assert.ok(REFUSALS[w], `${w} has a sentence`);
  assert.equal(accountRefusalText('bad-note-days'), 'A note stands for 1, 3 or 7 days.');
  assert.ok(HOST_COMMANDS.includes('note'), 'the chat never says /note to the room');
  assert.deepEqual(parseNoteCommand('/note remove abcdefghijklmnop1234'), { op: 'remove', id: 'abcdefghijklmnop1234' });
  for (const bad of ['/note', '/note remove', '/note delete abcdefghijklmnop1234', '/note remove short', '/note remove abcdefghijklmnop1234 extra']) {
    assert.deepEqual(parseNoteCommand(bad), { error: NOTE_USAGE }, bad);
  }
  assert.equal(parseNoteCommand('/mute Anna'), null, 'another command is not this one');
});

test('NOTICE1 the cards hang in their order - the rumour first, the bounty board\'s line, the server\'s word (the gate, the notices), then the players\' notes - each under the seal of who posted it; new is what was not read', () => {
  const board = boardOf(
    [{ id: 'p1', subject: 'Party', body: 'x', from: 'Anna', at: 300 }, { id: 'g1', subject: 'Join us', body: 'y', from: 'Aldric', at: 100, guild: { name: 'The Hound', tag: 'HND' } }],
    [{ id: 's1', subject: 'Festival', body: 'z', from: 'Devra', at: 250 }]);
  const cards = noticeCards({ town: { name: 'Anticlere' }, rumour: ['The price of grain is up.', ''], bountyLine: true, gate: { subject: 'Dagon\'s Breach', body: 'soon' }, board, seenAt: 200 });
  assert.deepEqual(cards.map((c) => [c.key, c.seal]), [['rumour', 'town'], ['bounty', 'bounty'], ['gate', 'server'], ['notice:s1', 'server'], ['note:p1', 'player'], ['note:g1', 'guild']]);
  assert.equal(cards[0].subject, 'News of Anticlere');
  assert.equal(cards[1].body, BOUNTY_BOARD_LINE);
  assert.deepEqual(cards.filter((c) => c.isNew).map((c) => c.key), ['notice:s1', 'note:p1'], 'new since the last read');
  assert.deepEqual(noticeCards({ town: { name: 'X' }, board: null }).length, 0, 'nothing at all without a rumour or a board');
  assert.deepEqual(Object.keys(NOTICE_SEALS), ['town', 'bounty', 'server', 'player', 'guild']);
  assert.deepEqual([timeLeftText(1000 + 2 * 86400 + 5, 1000), timeLeftText(1000 + 3600 * 5, 1000), timeLeftText(1030, 1000)], ['2 days left', '5 hours left', 'under an hour left']);
  assert.equal(snippetOf('a\n\nb\nc\nd\ne\nf'), 'a\nb\nc\nd');
});

test('NOTICE1 the wiring: a rumour board carries its town to the press online; the press opens the Notice Board only once the service said it is open, else DFU\'s box and a read; offline the board carries nothing and is DFU\'s byte for byte; one door, one mount', () => {
  const w = src('src/scenes/world.js');
  const m = src('src/scenes/worldModes.js');
  assert.match(w, /\.\.\.\(!bountyAt\.has\(i\) && noticeTown \? \{ notice: noticeTown \} : \{\}\),/, 'every board that is not a bounty board');
  assert.match(w, /const noticeTown = noticeBook && p\.location \? noticeTownOf\(p\.px, p\.py, bountyAt\.size > 0\) : null;/, 'online alone (the book is online\'s)');
  assert.match(w, /const noticeBook = params\.has\('online'\)\s*\n\s*\? createNoticeBook\(/);
  assert.match(w, /if \(noticeBook\.open !== true\) \{ noticeBook\.read\(town\.mapId\); return false; \}/, 'not yet open: DFU\'s box, and the read that settles it');
  const arm = m.slice(m.indexOf('function activateBulletinBoard('), m.indexOf('\n  }\n', m.indexOf('function activateBulletinBoard(')));
  const bountyAt = arm.indexOf('openBountyBoard?.('), noticeAt = arm.indexOf('openNoticeBoard?.('), boxAt = arm.indexOf('townTalk?.showOverlay?.(new ChoiceWindow');
  assert.ok(bountyAt > 0 && noticeAt > bountyAt && boxAt > noticeAt, 'the bounty board first, then the Notice Board, then DFU\'s box');
  assert.match(arm, /rows\.map\(\(r\) => r\.text\)\.filter\(\(t, i\) => !\(i === 0 && t === locationName\)\)/, 'the rumour pinned first, its name row the window\'s heading');
  // THE ONE CONSTRUCTION SEAM: one constructor, one mount
  const all = ['src/scenes/world.js', 'src/scenes/worldModes.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js'].map(src).join('\n');
  assert.equal((all.match(/createNoticeOverlay\(/g) ?? []).length, 1, 'the board is built in one place');
  assert.doesNotMatch(all, /mountNoticeBoard\(/, 'and mounted only through its door');
  assert.match(src('src/ui/noticeDoor.js'), /mount: \(m\) => \{ view = m\.mountNoticeBoard\(host, \{ \.\.\.deps, onExit: close \}\); \}/);
  // THE SLOT IS EMPTIED BEFORE THE OCCUPANT IS TOLD: `done` true only once the DOM is gone, the host told last
  const door = src('src/ui/noticeDoor.js');
  const close = door.slice(door.indexOf('const close = () => {'), door.indexOf('\n  };', door.indexOf('const close = () => {')));
  assert.ok(close.indexOf('host.remove()') < close.indexOf('fired = true') && close.indexOf('fired = true') < close.indexOf('deps.onClose?.()'));
  assert.doesNotMatch(src('src/scenes/exterior.js'), /noticeBook|openNoticeBoard/, 'the fixed city keeps DFU\'s board');
});

test('NOTICE1 the count over a board rides the names\' pass - asked with the face\'s own pixels, never on a covered frame, and a throw there never costs the names; the name layer wears it as a board, not a person', () => {
  const rendered = [];
  const layer = { render: (o) => { rendered.push(o.points.map((p) => p.id)); return 0; } };
  const self = { namePoints: () => [{ id: 'peer-1', x: 1, y: 1 }] };
  let asked = null;
  RemotePlayers.prototype.nameFrame.call(self, { layer, w: 640, h: 480, extra: (o) => { asked = o; return [{ id: 'board:1:0', kind: 'board', name: '3 new', x: 5, y: 5 }]; } });
  assert.deepEqual(rendered.at(-1), ['peer-1', 'board:1:0']);
  assert.deepEqual([asked.w, asked.h], [640, 480]);
  let coveredAsks = 0;
  RemotePlayers.prototype.nameFrame.call(self, { layer, covered: true, extra: () => { coveredAsks++; return [{ id: 'board:9:9', kind: 'board', name: '1 new', x: 1, y: 1 }]; } });
  assert.deepEqual([rendered.at(-1), coveredAsks], [[], 0], 'covered: nothing, and the extra never asked');
  RemotePlayers.prototype.nameFrame.call(self, { layer, extra: () => { throw new Error('a bad label'); } });
  assert.deepEqual(rendered.at(-1), ['peer-1'], 'a throw costs the label, never the names');
  assert.match(src('src/ui/nameLayer.js'), /setCls\(tag\.node, p\.kind === 'board' \? 'dfname dfname-board' : 'dfname'\);/);
  assert.match(src('src/scenes/world.js'), /extra: noticeCountPoints,/);
});

test('NOTICE1b\'s measure (tools/boardCount.mjs): a hub\'s boards are the models its blocks place that the town sign wears, split as BOUNTY1 splits them - a hub with none is the list NOTICE1b stands boards in', async () => {
  const { boardTally } = await import('../tools/boardCount.mjs');
  const { BULLETIN_BOARD_MODEL_ID } = await import('../src/world/rmbLayout.js');
  const at = (x) => ({ modelIdNum: BULLETIN_BOARD_MODEL_ID, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, 0, 0, 1] });
  const house = { modelIdNum: 1, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] };
  assert.deepEqual(boardTally([{ layout: { models: [house] } }]), { boards: 0, bounty: 0, rumour: 0 }, 'no board: no Notice Board');
  assert.deepEqual(boardTally([{ layout: { models: [at(3), house] } }]), { boards: 1, bounty: 0, rumour: 1 }, 'a lone board keeps its rumour');
  assert.deepEqual(boardTally([{ originX: 0, layout: { models: [at(3)] } }, { originX: 100, layout: { models: [at(3)] } }]), { boards: 2, bounty: 1, rumour: 1 }, 'two: one of each, across blocks');
  assert.deepEqual(boardTally([{ layout: { models: [at(1), at(2), at(3), at(4), at(5)] } }]), { boards: 5, bounty: 2, rumour: 3 });
  assert.match(src('tools/boardCount.mjs'), /It writes nothing to the tree; Mac runs it/);
});
