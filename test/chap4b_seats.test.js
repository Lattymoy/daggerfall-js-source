// CHAP4b (2026-10-08, Mac: "Your decision", on "Whats next") - THE SEATS ON THE CLIENT: online, while the Roll holds,
// the book's own rank stops at 7 (held at the Roll's adoption, never passed by DFU's review) and a seat's rank is read at
// its own chapter's halls alone (bible/11-Multiplayer/Chapters-Arc.md sections 3.5 and 6). The law against literals; the
// review's ceiling through DFU's own updateRank and the popup's push effects; a seat's rank at the service gate; the tab
// holding the book and saying the seats; the hosts' wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  rollSeatsOf, seatRankAt, seatedBook, rollBookCap, seatLineOf, seatLinesOf, bookCappedLine, ROLL_BOOK_RANK_MAX, SEAT_RANK,
} from '../src/net/npcChapterLaw.js';
import { GUILDS, updateRank, joinGuild, membershipOf, membershipKey } from '../src/systems/guilds.js';
import { createFactionRep, setReputation } from '../src/systems/factionRep.js';
import { onPushEffects, serviceAccess } from '../src/systems/guildServiceFlow.js';
import { createRollTracker, rollEntityDoors } from '../src/net/npcRollTracker.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); };
const FIGHTERS = 41, MAGES = 40, ANTICLERE = 21, DAGGERFALL = 17;

// ── THE LAW ─────────────────────────────────────────────────────────

test('CHAP4b a Roll answer\'s seats: a guild\'s, a region\'s, a seat\'s - nothing else kept; a seat\'s rank at its own guild and region alone (mutants: each filter, the match)', () => {
  assert.deepEqual(rollSeatsOf([
    { f: FIGHTERS, region: ANTICLERE, seat: 'master', since: 3 }, { f: 99, region: ANTICLERE, seat: 'master' }, { f: MAGES, region: 999, seat: 'officer' },
    { f: MAGES, region: DAGGERFALL, seat: 'lord' }, { f: MAGES, region: DAGGERFALL, seat: 'officer' }, null,
  ]), [{ f: FIGHTERS, region: ANTICLERE, seat: 'master' }, { f: MAGES, region: DAGGERFALL, seat: 'officer' }]);
  assert.deepEqual([rollSeatsOf(null), rollSeatsOf({ f: 41 })], [[], []]);
  const seats = [{ f: FIGHTERS, region: ANTICLERE, seat: 'master' }, { f: MAGES, region: DAGGERFALL, seat: 'officer' }];
  assert.deepEqual([seatRankAt(seats, FIGHTERS, ANTICLERE), seatRankAt(seats, MAGES, DAGGERFALL), seatRankAt(seats, FIGHTERS, DAGGERFALL),
    seatRankAt(seats, MAGES, ANTICLERE), seatRankAt([], FIGHTERS, ANTICLERE), seatRankAt(null, FIGHTERS, ANTICLERE)], [9, 8, null, null, null, null]);
  assert.deepEqual(SEAT_RANK, { master: 9, officer: 8 });
});

test('CHAP4b a book seated: its row reads the seat\'s rank where its own is lower - every other read and every write the row\'s own; no row, no higher rank, no seat: the book itself (mutants: the rank read, the write-through, each guard)', () => {
  const row = { guild: 'FightersGuild', rank: 7, flags: 0, lastRankChange: 12 };
  const book = { FightersGuild: row, MagesGuild: { guild: 'MagesGuild', rank: 3 } };
  const seated = seatedBook(book, 'FightersGuild', 9);
  assert.notEqual(seated, book);
  assert.deepEqual([seated.FightersGuild.rank, seated.FightersGuild.flags, seated.FightersGuild.lastRankChange, seated.MagesGuild], [9, 0, 12, book.MagesGuild]);
  seated.FightersGuild.flags = 0x40;   // a knightly order's gift, given through the seated row
  assert.deepEqual(row, { guild: 'FightersGuild', rank: 7, flags: 0x40, lastRankChange: 12 }, 'the write is the row\'s; its rank its own');
  assert.equal(book.FightersGuild.rank, 7);
  for (const [why, b, k, r] of [['no row', book, 'ThievesGuild', 9], ['no higher rank', book, 'FightersGuild', 7], ['a lower one', book, 'FightersGuild', 6],
    ['no seat', book, 'FightersGuild', null], ['a rank by a string', book, 'FightersGuild', '9'], ['no book', null, 'FightersGuild', 9]]) {
    assert.equal(seatedBook(b, k, r), b, why);
  }
});

test('CHAP4b the book held at 7: each Roll guild\'s row above 7, in both books, set to 7 - answered by guild; 7 and below untouched, a row of no Roll guild untouched (mutants: the line, the books, the guild)', () => {
  const store = {
    mortal: { MagesGuild: { guild: 'MagesGuild', rank: 9 }, FightersGuild: { guild: 'FightersGuild', rank: 7 }, Custom: { guild: 'NotAGuild', rank: 9 } },
    vampire: { FightersGuild: { guild: 'FightersGuild', rank: 8 } },
  };
  assert.deepEqual(rollBookCap(store), [MAGES, FIGHTERS]);
  assert.deepEqual([store.mortal.MagesGuild.rank, store.mortal.FightersGuild.rank, store.mortal.Custom.rank, store.vampire.FightersGuild.rank], [7, 7, 9, 7]);
  assert.deepEqual(rollBookCap(store), [], 'held: nothing more to hold');
  assert.deepEqual([rollBookCap(null), rollBookCap({ FightersGuild: { guild: 'FightersGuild', rank: 9 } })], [[], [FIGHTERS]], 'a plain book');
  assert.equal(ROLL_BOOK_RANK_MAX, 7);
});

test('CHAP4b the seats said, worded without gender: every seat at the page\'s first word; then each one gained or moved, each one lost; the book\'s hold said by guild (mutants: each arm, the words)', () => {
  assert.equal(seatLineOf({ f: FIGHTERS, region: ANTICLERE, seat: 'master' }), 'You hold the Master\'s seat of the Fighters Guild in Anticlere.');
  assert.equal(seatLineOf({ f: MAGES, region: DAGGERFALL, seat: 'officer' }, false), 'You no longer hold an officer\'s seat of the Mages Guild in Daggerfall.');
  const m = { f: FIGHTERS, region: ANTICLERE, seat: 'master' }, o = { f: MAGES, region: DAGGERFALL, seat: 'officer' };
  assert.deepEqual(seatLinesOf(null, [m, o]), [seatLineOf(m), seatLineOf(o)]);
  assert.deepEqual(seatLinesOf(null, []), []);
  assert.deepEqual(seatLinesOf([m, o], [m, o]), [], 'nothing moved, nothing said');
  assert.deepEqual(seatLinesOf([{ ...m, seat: 'officer' }, o], [m]), [seatLineOf(m), seatLineOf(o, false)]);
  assert.deepEqual(seatLinesOf([], [o]), [seatLineOf(o)]);
  assert.equal(bookCappedLine([FIGHTERS]), 'The Fighters Guild keeps ranks 8 and 9 as its chapters\' seats, won by Merit - your rank there is 7.');
  assert.equal(bookCappedLine([MAGES, FIGHTERS]), 'The Mages Guild and the Fighters Guild keep ranks 8 and 9 as their chapters\' seats, won by Merit - your rank there is 7.');
  assert.deepEqual([bookCappedLine([]), bookCappedLine(null), bookCappedLine([99])], [null, null, null]);
});

// ── DFU'S REVIEW, UNDER THE CEILING ─────────────────────────────────

const storeWith = (rep) => {
  const dict = new Map();
  for (const g of Object.values(GUILDS)) {
    dict.set(g.factionId, { id: g.factionId, parent: 0, rep: 0, flags: 0, power: 50, ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0, children: null, type: 0, ggroup: 0 });
  }
  const store = createFactionRep(dict);
  for (const g of Object.values(GUILDS)) setReputation(store, g.factionId, rep);
  return store;
};
const master = (guild) => ({ name: 'Tester', skills: Object.fromEntries(guild.skills.map((s) => [s, 100])) });
const day = (n) => ({ year: 405, dayOfYear: n });

test('CHAP4b DFU\'s review under the host\'s ceiling: a member DFU would make 9 is promoted to 7, one at 7 stays unmoved and unannounced, one above it never demoted by it; with no ceiling, DFU\'s own (mutants: the ceiling, its floor, its guard)', () => {
  const g = GUILDS.FightersGuild;
  const store = storeWith(95);
  const at = (rank, ctx) => {
    const book = {};
    const m = joinGuild(book, g, day(0));
    m.rank = rank;
    return { moved: updateRank(book, g, master(g), store, day(60), ctx), m };
  };
  const promoted = at(5, { rankCeiling: 7 });
  assert.deepEqual([promoted.moved?.outcome, promoted.moved?.rank, promoted.m.rank], ['promotion', 7, 7]);
  const held = at(7, { rankCeiling: 7 });
  assert.deepEqual([held.moved, held.m.rank], [null, 7]);
  const above = at(9, { rankCeiling: 7 });
  assert.deepEqual([above.moved, above.m.rank], [null, 9], 'the Roll\'s adoption holds it, never a demotion record');
  const offline = at(5, null);
  assert.deepEqual([offline.moved?.rank, offline.m.rank], [9, 9]);
  assert.deepEqual(at(5, { rankCeiling: null }).moved?.rank, 9);
  // the popup's push effects hand the host's ceiling to the review
  const book = {};
  joinGuild(book, g, day(0)).rank = 5;
  const steps = onPushEffects(master(g), g, book, store, day(60), { rankCeiling: 7 });
  assert.deepEqual([steps[0]?.rankChange?.outcome, steps[0]?.rankChange?.rank, membershipOf(book, g).rank], ['promotion', 7, 7]);
});

test('CHAP4b a seat\'s rank at the service gate: rank 7 is refused the Mages Guild\'s teleport, its chapter\'s officer is not (mutants: the seated read)', () => {
  const g = GUILDS.MagesGuild;
  const book = {};
  joinGuild(book, g, day(0)).rank = 7;
  assert.equal(serviceAccess(g, membershipOf(book, g), 'Teleport').allowed, false);
  assert.equal(serviceAccess(g, membershipOf(seatedBook(book, membershipKey(g), 8), g), 'Teleport').allowed, true);
  assert.equal(membershipOf(book, g).rank, 7);
});

// ── THE TAB ─────────────────────────────────────────────────────────

/** A Roll door that answers each read and claim from `answers`, in order. */
const door = (answers) => ({
  calls: 0,
  async read() { this.calls++; return answers.shift(); },
  async claim() { this.calls++; return answers.shift(); },
});
const roll = (seats, extra = {}) => ({ ok: true, data: { roll: { seq: 1, factions: { [FIGHTERS]: 90 }, owed: {}, members: [{ f: FIGHTERS, rank: 7 }], seats, ...extra }, from: 1 } });

test('CHAP4b the tab: each adoption holds the book at 7 (said once a hold) and keeps the seats - said as they stand at the first word, then as they move; none before the first word (mutants: the cap at adoption, the seats kept, the before)', async () => {
  const entity = {
    factionRep: storeWith(90),
    guildMemberships: { mortal: { FightersGuild: { guild: 'FightersGuild', rank: 9, lastRankChange: 0 } }, vampire: {} },
  };
  const doors = rollEntityDoors(() => entity);
  const capped = [], said = [];
  const m = { f: FIGHTERS, region: ANTICLERE, seat: 'master' };
  const io = door([roll([m]), roll([{ ...m, seat: 'officer' }])]);
  let t = 1_000_000;
  const tracker = createRollTracker({
    io, character: () => 'r0123456789abcdef0123', lease: () => 'a'.repeat(32), ...doors, now: () => t,
    onCapped: (fs) => capped.push(fs), onSeats: (seats, before) => said.push([seats, before]),
  });
  assert.deepEqual(tracker.seats, []);
  tracker.tick(); await settle();
  assert.equal(entity.guildMemberships.mortal.FightersGuild.rank, 7, 'held at the first word');
  assert.deepEqual(capped, [[FIGHTERS]]);
  assert.deepEqual(said, [[[m], null]]);
  assert.deepEqual(tracker.seats, [m]);
  // the next answer (a claim, the book's rank moved by nothing): the seat moved; the hold not said again
  tracker.refresh();
  t += 60_000; tracker.tick(); await settle();
  assert.deepEqual(capped, [[FIGHTERS]]);
  assert.deepEqual(said[1], [[{ ...m, seat: 'officer' }], [m]]);
  assert.deepEqual(tracker.seats, [{ ...m, seat: 'officer' }]);
});

// ── THE HOSTS ───────────────────────────────────────────────────────

test('CHAP4b the hosts\' wiring: the hall\'s services read the book seated, its review the host\'s ceiling; the streets\' host names the seat\'s rank by the politic region (the teleport\'s fee too) and the ceiling while the Roll holds, and says the hold and the seats (mutants: each seam)', () => {
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /const seated = \(\) => seatedBook\(memberships, membershipKey\(guild\), host\.chapterSeatRank\?\.\(guild\.factionId\) \?\? null\);/);
  assert.match(wm, /const access = serviceAccess\(guild, membershipOf\(seated\(\), guild\), service\);/);
  assert.match(wm, /guild, memberships: seated\(\), store, rows, route,/);
  assert.match(wm, /freeHealing: freeHealing\(guild, membershipOf\(seated\(\), guild\)\),/);
  assert.match(wm, /rankCeiling: host\.rollRankCeiling\?\.\(\) \?\? null,/);
  assert.match(wm, /steps: \(\) => onPushEffects\(playerEntity, guild, memberships, store, ownDate\(\), \{/, 'the review reads the book itself');
  const w = src('src/scenes/world.js');
  assert.match(w, /const seatRankHere = \(\/\*\* @type \{number\} \*\/ faction\) => \{\n\s+if \(!rollTracker\?\.held \|\| rollTracker\.stopped\) return null;\n\s+const px = playerTravelPixel\(\);\n\s+const region = \(\(\) => \{ try \{ return maps\.getRegionIndexAt\(px\.x, px\.y\); \} catch \{ return null; \} \}\)\(\);\n\s+return seatRankAt\(rollTracker\.seats, faction, region\);/);
  assert.match(w, /chapterSeatRank: \(faction\) => seatRankHere\(faction\),/);
  assert.match(w, /magesGuildRank: \(\) => Math\.max\(joinedGuildOfGroup\(activeMemberships\(playerEntity\), GUILD_GROUPS\.MagesGuild\)\?\.rank \?\? 0, seatRankHere\(GUILD_FACTION_IDS\.MagesGuild\) \?\? 0\),/, 'the paid teleport\'s fee at a seat\'s rank');
  assert.match(w, /rollRankCeiling: \(\) => \(rollTracker\?\.held && !rollTracker\.stopped \? ROLL_BOOK_RANK_MAX : null\),/);
  assert.match(w, /onCapped: \(factions\) => \{ const line = bookCappedLine\(factions\); if \(line\) chatNotice\(line\); \},/);
  assert.match(w, /onSeats: \(seats, before\) => \{ for \(const line of seatLinesOf\(before, seats\)\) chatNotice\(line\); \},/);
  assert.match(w, /\.\.\.rollEntityDoors\(\(\) => playerEntity\),/, 'the doors carry the cap');
  assert.match(src('src/net/npcRollTracker.js'), /cap: \(\) => rollBookCap\(entityOf\(\)\?\.guildMemberships\),/);
});
