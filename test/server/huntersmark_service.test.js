// HUNTERS-MARK and MARKS-OF-MASTERY (2026-10-27; a player, handed on by the owner: "Add more horizontal progression
// please!"; bible/06-Systems/Bounty-Boards.md section 12): THE HUNT'S LEDGER on the account service, through the real
// Worker over node:sqlite (test/accountDb.mjs). A clear is the client's word, bounded: its shape, the event clock's
// window, the level the realm trusts, one row a character a notice, the account's day; asked of the seat; a named mark
// from its rung alone. The Marks of Mastery are derived from what the service keeps - the clears, a living Master's
// track, the serpents slain - held on the wardrobe, worn, and signed into the token. A clear in a pledged region is a
// seat's influence, capped by the week.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import { verifyToken } from '../../src/net/identityToken.js';
import { bountyId, bountySlotKey } from '../../src/systems/bounty/bountyBoard.js';
import {
  huntGameDayAt, huntWeekAt, huntMarkId, huntClearOf, huntTierFits, masteryMarksOf, HUNT_CLEARS_DAY_MAX, HUNT_CLEAR_LATE_DAYS,
  HUNT_RUNGS, HUNT_MARK_RUNG, HUNT_TITLES, MASTERY_TITLES, SEA_TITLES, MASTERY_MARKS, GAME_DAYS_PER_UTC_DAY,
} from '../../src/net/huntLaw.js';
import { PROF_XP_MAX } from '../../src/net/professionLaw.js';
import { HUNT_INFLUENCE, HUNT_WEEK_CAP, accountSeatInfluence, ACCOUNT_SEAT_WEEK_CAP, seatWeekOf, seatWeekStartMs } from '../../src/net/townSeatLaw.js';
import { progressSpentOf, PROGRESS_ROUTES } from '../../server-account/src/progress.js';
import { ROUTES } from '../../server-account/src/service.js';
import { titlesHeld } from '../../server-account/src/titles.js';
import { creditHunt, standingsOf } from '../../server-account/src/seatInfluence.js';
import { withMasteryMarksAll, withMasteryMarks, masteryCountsRead, masteryCountsAll } from '../../server-account/src/hunts.js';
import { utcDay } from '../../src/net/marksLaw.js';

const { subtle } = globalThis.crypto;
const NOON = utcDay(T0) * 86_400 + 12 * 3600;

async function stand(t, env = { SEATS_OPEN: 'on' }) {
  let clock = NOON * 1000;
  t.mock.method(Date, 'now', () => clock);
  const s = await standService(env);
  const raw = s.env.DB._raw;
  const mac = await s.seated('Mac');
  const day = huntGameDayAt(clock);
  const clear = (who, id, extra = {}) => s.call('/v1/hunt/clear', { character: who.character, id, ...extra }, who.secret);
  const state = (who) => s.call('/v1/hunt/state', { character: who.character }, who.secret);
  return { s, raw, mac, day, clear, state, at: (ms) => { clock = ms; }, now: () => clock };
}

test('HUNTERS-MARK THE LAW: a board clear inside the event clock\'s window, a mark of this week or the last, the level within reach of the trusted one; the day\'s ceiling measured, above any honest day (mutants: the window\'s edges; the ceiling; the tier\'s reach)', () => {
  const now = NOON * 1000;
  const today = huntGameDayAt(now);
  assert.equal(GAME_DAYS_PER_UTC_DAY, 12, 'a game day every two real hours');
  // PIN MOVED (AUDIT HORIZONTAL F3): 48 was four held a game day - four held is not four cleared; the ceiling is measured
  // (tools/huntPace.mjs, test/tooling/huntpace.test.js on the game's map)
  assert.equal(HUNT_CLEARS_DAY_MAX, 750);
  assert.deepEqual(huntClearOf(bountyId(today, 300, 200, 1, 7), now), { kind: 'board', id: bountyId(today, 300, 200, 1, 7), key: bountySlotKey(today, 300, 200, 1), level: 7, tier: 2 });
  assert.equal(huntClearOf(bountyId(today - HUNT_CLEAR_LATE_DAYS, 300, 200, 1, 7), now).kind, 'board', 'a real day late: still taken');
  assert.deepEqual(huntClearOf(bountyId(today - HUNT_CLEAR_LATE_DAYS - 1, 300, 200, 1, 7), now), { why: 'late' });
  assert.equal(huntClearOf(bountyId(today + 1, 300, 200, 1, 7), now).kind, 'board', 'the boards a minute ahead');
  assert.deepEqual(huntClearOf(bountyId(today + 2, 300, 200, 1, 7), now), { why: 'early' });
  const week = huntWeekAt(now);
  assert.equal(huntClearOf(huntMarkId(week, 300, 200, 16), now).key, `m.${week}`);
  assert.equal(huntClearOf(huntMarkId(week - 1, 300, 200, 16), now).kind, 'mark');
  assert.deepEqual(huntClearOf(huntMarkId(week - 2, 300, 200, 16), now), { why: 'late' });
  assert.deepEqual(huntClearOf(huntMarkId(week + 1, 300, 200, 16), now), { why: 'early' });
  assert.deepEqual(huntClearOf('7.300.200.1', now), { why: 'id' });
  assert.equal(huntTierFits(12, 10), true, 'two levels past the trusted one');
  assert.equal(huntTierFits(13, 10), false);
  assert.equal(huntTierFits(6, 15), false, 'two tiers below');
  assert.equal(huntTierFits(11, 15), true, 'one tier below');
  assert.equal(huntTierFits(30, null), true, 'no level judged yet');
  assert.deepEqual(masteryMarksOf({ clears: 99, masters: ['fishing', 'mining'], serpents: 40 }), ['bloodhound', 'mastermining', 'masterfishing', 'serpenthunter', 'deepbane']);
  assert.deepEqual(masteryMarksOf({ clears: 100 }), ['bloodhound', 'beastbane']);
  assert.deepEqual(MASTERY_MARKS.length, HUNT_TITLES.length + Object.keys(MASTERY_TITLES).length + SEA_TITLES.length);
});

test('HUNTERS-MARK THE LEDGER through the real Worker: a clear recorded once a character - the same notice again a repeat, never twice - each region tallied; shape, window and the trusted level refused; asked of the seat; the bounties\' stream spent by a recorded clear alone (mutants: the key; the region tally; the tier check; the seat; the spend)', async (t) => {
  const { s, raw, mac, day, clear, state } = await stand(t);
  assert.ok(ROUTES.has('/v1/hunt/clear') && ROUTES.has('/v1/hunt/state'));
  assert.deepEqual(PROGRESS_ROUTES['/v1/hunt/clear'], ['bounty', true], 'a progression claim of the seat');
  const one = await clear(mac, bountyId(day, 300, 200, 1, 3), { region: 17 });
  assert.equal(one.status, 200, JSON.stringify(one.body));
  assert.equal(one.body.recorded, true);
  assert.equal(one.body.clears, 1);
  assert.deepEqual(one.body.regions, { 17: 1 });
  const again = await clear(mac, bountyId(day, 300, 200, 1, 3), { region: 17 });
  assert.equal(again.body.recorded, false);
  assert.equal(again.body.repeat, true, 'the same notice, this character\'s already');
  assert.equal(again.body.clears, 1);
  const shared = await clear(mac, bountyId(day, 300, 200, 1, 2), { region: 17 });
  assert.equal(shared.body.repeat, true, 'the notice, not the id: taken again at another level is the same slot');
  const two = await clear(mac, bountyId(day, 300, 200, 2, 3), { region: 9 });
  assert.equal(two.body.recorded, true);
  assert.deepEqual(two.body.regions, { 9: 1, 17: 1 });
  assert.deepEqual((await clear(mac, bountyId(day, 301, 200, 0, 3), { region: 17 })).body.regions, { 9: 1, 17: 2 }, 'the region tallied');
  assert.equal((await clear(mac, bountyId(day, 300, 200, 3, 3))).body.recorded, true, 'a board of no known region');
  assert.equal((await state(mac)).body.account.clears, 4);
  assert.deepEqual(progressSpentOf('/v1/hunt/clear', one.body), [['bounty', 1]]);
  assert.deepEqual(progressSpentOf('/v1/hunt/clear', again.body), []);
  const spent = raw.prepare("SELECT SUM(claims) AS n FROM progress_hours WHERE player = ? AND stream = 'bounty'").get(mac.id);
  assert.equal(spent.n, 4, 'four recorded, four spent');
  // REFUSED: no bounty's shape, a region out of law, a day the boards are past, the trusted level's reach
  assert.equal((await clear(mac, 'nothing')).body.error, 'hunt-id');
  assert.equal((await clear(mac, bountyId(day, 300, 200, 0, 3), { region: 999 })).body.error, 'hunt-id');
  assert.equal((await clear(mac, bountyId(day - HUNT_CLEAR_LATE_DAYS - 1, 300, 200, 0, 3))).body.error, 'hunt-late');
  assert.equal(raw.prepare('SELECT level_seen AS lv FROM realm_characters WHERE id = ?').get(mac.character).lv, 1, 'the seat\'s first save judged: level 1');
  raw.prepare('UPDATE realm_characters SET level_seen = 3 WHERE id = ?').run(mac.character);
  const far = await clear(mac, bountyId(day, 300, 200, 0, 9));
  assert.equal(far.status, 409);
  assert.equal(far.body.error, 'hunt-tier');
  assert.equal((await clear(mac, bountyId(day, 300, 200, 0, 5))).body.recorded, true, 'two levels past: a level gained since the checkpoint');
  // ASKED OF THE SEAT: a body naming another character is no claim
  const other = await s.call('/v1/hunt/clear', { character: 'r00000000000000000000', id: bountyId(day, 302, 200, 0, 3) }, mac.secret);
  assert.equal(other.status, 403);
  assert.equal(other.body.error, 'progress-seat');
  const guest = await s.guest();
  assert.equal((await s.call('/v1/hunt/state', { character: mac.character }, guest.secret)).body.error, 'hunt-need-account');
});

test('HUNTERS-MARK THE DAY\'S CEILING AND THE MARK\'S RUNG: the account\'s UTC day takes HUNT_CLEARS_DAY_MAX, the next answered day-full and kept nowhere; a named mark is refused before its rung and recorded from it, once a week a character (mutants: the ceiling; the rung\'s count; the week\'s key)', async (t) => {
  const { raw, mac, day, clear, state } = await stand(t);
  const today = utcDay(NOON);
  let seeded = 0;
  const week = huntWeekAt(NOON * 1000);
  const lastWeekS = seatWeekStartMs(week) / 1000 - 3600;   // an hour before this week's Turning
  const seed = (n, kind = 'board', d = today, at = lastWeekS) => { for (let i = 0; i < n; i++) raw.prepare('INSERT INTO hunt_clears (player, char_id, kind, key, id, tier, region, day, at) VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?)').run(mac.id, mac.character, kind, `seed.${seeded++}`, 'x', d, at); };
  const mark = huntMarkId(week, 300, 200, 3);
  seed(HUNT_RUNGS[HUNT_MARK_RUNG].at - 1, 'board', today - 1);
  const early = await clear(mac, mark);
  assert.equal(early.status, 409);
  assert.equal(early.body.error, 'hunt-rung', 'a rung short');
  // AUDIT HORIZONTAL F10: a Stalker since this week's Turning is no Stalker of last week - last week's mark is refused
  seed(1, 'board', today - 1, NOON);
  const since = await clear(mac, huntMarkId(week - 1, 300, 200, 3));
  assert.equal(since.status, 409, JSON.stringify(since.body));
  assert.equal(since.body.error, 'hunt-rung', 'the rung read as the mark\'s week ended');
  seed(1, 'board', today - 1);
  // AUDIT HORIZONTAL F2: last week's mark is no answer for this week's (markDone is the week's key, never any mark)
  const last = await clear(mac, huntMarkId(week - 1, 300, 200, 3));
  assert.equal(last.body.recorded, true, 'last week\'s mark, a Stalker\'s of last week, reported after the Turning');
  assert.equal(last.body.markDone, false, 'this week\'s is still to hunt');
  const got = await clear(mac, mark);
  assert.equal(got.body.recorded, true, 'a Stalker: the week\'s mark');
  assert.equal(got.body.marks, 2);
  assert.equal(got.body.markDone, true);
  assert.equal((await clear(mac, huntMarkId(week, 310, 210, 3))).body.repeat, true, 'one mark a week, wherever it was taken');
  assert.equal((await state(mac)).body.markDone, true);
  // THE DAY: the account's recorded rows today, under the ceiling - AUDIT HORIZONTAL F1: every character's, so the day's
  // rows on another character of the account leave the seat no more (a seat changed is no second day)
  const today0 = raw.prepare('SELECT COUNT(*) AS n FROM hunt_clears WHERE player = ? AND day = ?').get(mac.id, today).n;
  for (let i = 0; i < HUNT_CLEARS_DAY_MAX - 1 - today0; i++) raw.prepare("INSERT INTO hunt_clears (player, char_id, kind, key, id, tier, region, day, at) VALUES (?, 'r22222222222222222222', 'board', ?, 'x', 0, NULL, ?, ?)").run(mac.id, `alt.${i}`, today, NOON);
  assert.equal((await clear(mac, bountyId(day, 300, 200, 0, 3))).body.recorded, true, 'the last of the day');
  const full = await clear(mac, bountyId(day, 300, 200, 1, 3));
  assert.equal(full.body.recorded, false);
  assert.equal(full.body.why, 'day-full');
  assert.equal(full.body.account.day, today, 'AUDIT HORIZONTAL F3: the service\'s UTC day, the one a kept report waits out');
  assert.deepEqual(progressSpentOf('/v1/hunt/clear', full.body), [], 'a clear the day took no more of spends nothing');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM hunt_clears WHERE player = ? AND day = ?').get(mac.id, today).n, HUNT_CLEARS_DAY_MAX);
});

test('MARKS-OF-MASTERY THE TITLES ARE DERIVED: the hunt\'s off the account\'s board clears (every character), a Master\'s off a LIVING character\'s track, the sea\'s off the serpents slain - held on the wardrobe, worn, signed into the token; a guest holds none; the wardrobe carries the Annals\' pages kept (mutants: the clears\' count; the dead character\'s track; the serpents; the guest\'s guard; the mint\'s read; the pages left off)', async (t) => {
  const { s, raw, mac } = await stand(t);
  const seed = (n, char = mac.character) => { for (let i = 0; i < n; i++) raw.prepare("INSERT INTO hunt_clears (player, char_id, kind, key, id, tier, region, day, at) VALUES (?, ?, 'board', ?, 'x', 0, NULL, 1, 1)").run(mac.id, char, `k${char}${i}`); };
  const wardrobe = async () => (await (await s.fetch('https://accounts.invalid/v1/account', { headers: { authorization: `Bearer ${mac.secret}` } })).json()).wardrobe;
  assert.ok(!(await wardrobe()).titles.includes('bloodhound'));
  // HUNTERS-MARK (Collections.md section 10): the Annals' pages the account keeps ride the wardrobe, for the page's part
  assert.equal((await wardrobe()).annals, 0);
  raw.prepare('UPDATE players SET eg_annals = 5 WHERE id = ?').run(mac.id);
  assert.equal((await wardrobe()).annals, 5);
  seed(19);
  seed(5, 'char-other');   // another character of the account: counted together
  raw.prepare("INSERT INTO hunt_clears (player, char_id, kind, key, id, tier, region, day, at) VALUES (?, ?, 'mark', 'm.1', 'x', 0, NULL, 1, 1)").run(mac.id, mac.character);
  assert.ok(!(await wardrobe()).titles.includes('bloodhound'), 'twenty-four board clears and a mark - a mark is no board clear');
  seed(1, 'char-third');
  assert.deepEqual((await wardrobe()).titles.filter((x) => MASTERY_MARKS.includes(x)), ['bloodhound'], 'twenty-five board clears');
  const track = (char, prof, xp) => raw.prepare('INSERT OR REPLACE INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, ?, ?, 1)').run(mac.id, char, prof, xp);
  track(mac.character, 'fishing', PROF_XP_MAX);
  track(mac.character, 'mining', PROF_XP_MAX - 1);
  raw.prepare("INSERT INTO realm_characters (id, player, name, created_at, updated_at, dead_at) VALUES ('r11111111111111111111', ?, 'Fallen', 1, 1, 5)").run(mac.id);
  track('r11111111111111111111', 'smithing', PROF_XP_MAX);
  for (let d = 0; d < SEA_TITLES[0][1]; d++) raw.prepare("INSERT INTO serpent_kills (day, account, boss, hull, char_id, xp, nonce, at) VALUES (?, ?, 'sethrakul', 1, ?, 1, ?, 1)").run(d, mac.id, mac.character, `n${d}`);
  const held = (await wardrobe()).titles.filter((x) => MASTERY_MARKS.includes(x));
  assert.deepEqual(held, ['bloodhound', 'masterfishing', 'serpenthunter'], 'a Master on the living alone; ten serpents');
  // a board's rows read the same marks in one batch (boardNames.js), a guest's none
  assert.equal((await withMasteryMarks({ db: s.env.DB }, { id: mac.id, handle: null })).masteryMarks, undefined, 'a guest\'s rows are not read');
  const [board, guest] = await withMasteryMarksAll({ db: s.env.DB }, [raw.prepare('SELECT * FROM players WHERE id = ?').get(mac.id), { id: 'guest-1', handle: null }]);
  assert.deepEqual(board.masteryMarks, held, 'the board\'s batch reads what the wardrobe reads');
  assert.equal(guest.masteryMarks, undefined);
  assert.equal((await s.call('/v1/account/title', { title: 'masterfishing' }, mac.secret)).status, 200, 'worn');
  assert.equal((await s.call('/v1/account/title', { title: 'mastersmithing' }, mac.secret)).status, 403, 'a dead character\'s Master is no title');
  const tok = (await s.call('/v1/auth/token', { secret: mac.secret, character: mac.character })).body.token;
  const v = await verifyToken(tok, s.identityPublic, { subtle, nowS: NOON });
  assert.ok(v.ok, v.why);
  assert.equal(v.claims.t, 'masterfishing', 'the mint reads the marks, and the vocabulary signs it');
  assert.deepEqual(titlesHeld({ masteryMarks: ['beastbane'] }, {}), [], 'a guest - no handle - holds none, whatever the row says');
  assert.ok(titlesHeld({ handle: 'x', registered_at: 2e9, masteryMarks: ['beastbane', 'nonsense'] }, {}).includes('beastbane'));
  assert.ok(!titlesHeld({ handle: 'x', registered_at: 2e9, masteryMarks: ['nonsense'] }, {}).includes('nonsense'), 'the law\'s titles alone');
});

test('HUNTERS-MARK A SEAT\'S INFLUENCE: a recorded clear on a board of a region where the hunter\'s war-guild pledged counts HUNT_INFLUENCE as the `hunt` source, once a clear, at most HUNT_WEEK_CAP an account a week; the standings read it, under the account\'s whole cap (mutants: the source; the week\'s cap; the standings\' arm)', async (t) => {
  // AUDIT HORIZONTAL G9: the numbers the record and the patch notes state, pinned as they are said
  assert.equal(HUNT_INFLUENCE, 25, 'a clear counts 25');
  assert.equal(HUNT_WEEK_CAP, 250, 'at most 250 an account a week');
  assert.equal(accountSeatInfluence({ hunt: HUNT_INFLUENCE * 3 }), 75);
  assert.equal(accountSeatInfluence({ hunt: 10_000 }), HUNT_WEEK_CAP, 'the week\'s cap');
  assert.equal(accountSeatInfluence({ hunt: 10_000, watch: 10_000 }), ACCOUNT_SEAT_WEEK_CAP);
  const { s, raw, mac } = await stand(t);
  // a guild the character joined 7 days ago and more, pledged to seat 4242 in region 17 this week (written by hand)
  const nowS = NOON;
  const ctx = { db: s.env.DB, nowS };
  const player = raw.prepare('SELECT * FROM players WHERE id = ?').get(mac.id);
  const env = s.env;
  const why = await creditHunt(ctx, player, env, { character: mac.character, region: 17, ref: 'a' });
  assert.equal(why.counted, false, 'no guild, no pledge: nothing counted, nothing refused');
  raw.prepare("INSERT INTO guilds (id, name, name_key, tag, ranks, founded_at) VALUES ('g1', 'Hunters', 'hunters', 'HNT', '[]', 0)").run();
  raw.prepare("INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, 'g1', 0, 'Mac', 0)").run(mac.id, mac.character);
  const week = seatWeekOf(nowS * 1000);
  raw.prepare("INSERT INTO town_seat_pledges (week, guild_id, region, key, set_by, at) VALUES (?, 'g1', 17, 4242, 'Mac', 0)").run(week);
  // through the ledger's route: a recorded clear in the pledged region answers the seat it counted at
  const routed = await s.call('/v1/hunt/clear', { character: mac.character, id: bountyId(huntGameDayAt(NOON * 1000), 300, 200, 0, 1), region: 17 }, mac.secret);
  assert.deepEqual(routed.body.influence, { counted: true, key: 4242 }, JSON.stringify(routed.body));
  // AUDIT HORIZONTAL F6: once a CLEAR, never once a character - the character's next clear in the region counts too
  const again = await s.call('/v1/hunt/clear', { character: mac.character, id: bountyId(huntGameDayAt(NOON * 1000), 300, 200, 2, 1), region: 17 }, mac.secret);
  assert.deepEqual(again.body.influence, { counted: true, key: 4242 }, JSON.stringify(again.body));
  assert.equal(raw.prepare("SELECT SUM(amount) AS n FROM town_seat_influence WHERE account = ? AND source = 'hunt'").get(mac.id).n, 2 * HUNT_INFLUENCE, 'two clears, two counts');
  assert.equal((await s.call('/v1/hunt/clear', { character: mac.character, id: bountyId(huntGameDayAt(NOON * 1000), 300, 200, 1, 1) }, mac.secret)).body.influence, undefined, 'no region: no influence');
  const got = await creditHunt(ctx, player, env, { character: mac.character, region: 17, ref: 'b' });
  assert.deepEqual(got, { counted: true, key: 4242 });
  assert.deepEqual(await creditHunt(ctx, player, env, { character: mac.character, region: 17, ref: 'b' }), { counted: false, why: 'claimed' });
  for (let i = 0; i < 20; i++) await creditHunt(ctx, player, env, { character: mac.character, region: 17, ref: `c${i}` });
  const sum = raw.prepare("SELECT SUM(amount) AS n, COUNT(*) AS c FROM town_seat_influence WHERE account = ? AND source = 'hunt'").get(mac.id);
  assert.equal(sum.n, HUNT_WEEK_CAP, 'the week\'s cap in the write');
  assert.equal(sum.c, HUNT_WEEK_CAP / HUNT_INFLUENCE);
  // THE STANDINGS read the source: the guild's week at the seat, the account's own rows
  const rows = raw.prepare('SELECT guild_id, account, source, region, day, amount FROM town_seat_influence WHERE key = 4242').all();
  const [g] = standingsOf({ guilds: ['g1'], rows, renown: [], homes: [], binds: new Map([[mac.id, 'g1']]), agreed: new Map(), weekStartS: 0, nowS });
  assert.equal(g.total, HUNT_WEEK_CAP);
  assert.equal(g.accounts, 1);
});

test('AUDIT HORIZONTAL F5 AND LANE F\'S SUSPECTED: a worn Mark of Mastery on a letter (the inbox\'s head and the letter opened) and on a notice-board note; a Master only off a realm character alive - a track no realm row stands for holds none; the clears read stops at the top title\'s count, alone and in a batch (mutants: the inbox\'s, the letter\'s and the board\'s marks unread; a track with no realm row a Master, alone and batched; the read unbounded, alone and batched)', async (t) => {
  const { s, raw, mac } = await stand(t, { SEATS_OPEN: 'on', BOARD_OPEN: 'on' });
  const bob = await s.registered('Bob');
  const seed = (n, from = 0) => { for (let i = from; i < from + n; i++) raw.prepare("INSERT INTO hunt_clears (player, char_id, kind, key, id, tier, region, day, at) VALUES (?, ?, 'board', ?, 'x', 0, NULL, 1, 1)").run(mac.id, mac.character, `k${i}`); };
  seed(HUNT_TITLES[0][1]);
  assert.equal((await s.call('/v1/account/title', { title: 'bloodhound' }, mac.secret)).status, 200, 'worn');
  // F5: the letter's sender and the note's author wear it, as the token and the boards' names do
  assert.equal((await s.call('/v1/mail/send', { to: 'Bob', subject: 'Hi', body: 'A letter.' }, mac.secret)).status, 200);
  const inbox = await (await s.fetch('https://accounts.invalid/v1/mail/inbox', { headers: { authorization: `Bearer ${bob.secret}` } })).json();
  assert.equal(inbox.letters[0].title, 'bloodhound', 'the inbox\'s head');
  assert.equal((await s.call('/v1/mail/read', { id: inbox.letters[0].id }, bob.secret)).body.letter.title, 'bloodhound', 'the letter opened');
  assert.equal((await s.call('/v1/board/pin', { map: 1234, subject: 'Hunters wanted', body: 'Meet at the gate.', days: 1, rid: 'r1234567890abcdef' }, mac.secret)).status, 200);
  const board = await s.call('/v1/board/read', { map: 1234 }, bob.secret);
  assert.equal(board.body.notes[0].title, 'bloodhound', 'the note on the board');
  // SUSPECTED, REPRODUCED: a Master's track whose character no realm row stands for (a track written before the seat
  // law, an id no realm holds) is no living Master - the realm row alive is, as the crafting writs read it
  raw.prepare('INSERT OR REPLACE INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, ?, ?, 1)').run(mac.id, 'offline-character-1', 'mining', PROF_XP_MAX);
  const wardrobe = async () => (await (await s.fetch('https://accounts.invalid/v1/account', { headers: { authorization: `Bearer ${mac.secret}` } })).json()).wardrobe;
  assert.ok(!(await wardrobe()).titles.includes('mastermining'), 'no realm row: no Master');
  assert.deepEqual((await masteryCountsAll({ db: s.env.DB }, [mac.id])).get(mac.id).masters, [], 'nor in a batch');
  raw.prepare('INSERT OR REPLACE INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, ?, ?, 1)').run(mac.id, mac.character, 'mining', PROF_XP_MAX);
  assert.ok((await wardrobe()).titles.includes('mastermining'), 'the seated character\'s: a Master');
  assert.deepEqual((await masteryCountsAll({ db: s.env.DB }, [mac.id])).get(mac.id).masters, ['mining']);
  // SUSPECTED, MEASURED: the read stops at the top title's count - past it, a year's clears read as a week's
  const top = HUNT_TITLES[HUNT_TITLES.length - 1][1];
  seed(top + 50 - HUNT_TITLES[0][1], HUNT_TITLES[0][1]);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM hunt_clears WHERE player = ?').get(mac.id).n, top + 50);
  assert.equal((await masteryCountsRead(s.env.DB, mac.id)).clears, top, 'the count stops at the top title\'s');
  assert.equal((await masteryCountsAll({ db: s.env.DB }, [mac.id, bob.id])).get(mac.id).clears, top, 'and in a batch');
  assert.ok((await wardrobe()).titles.includes('huntlegend'), 'every hunt title still held');
});
