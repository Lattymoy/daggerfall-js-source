// ROLL-PACE (FIELD BUGS 2026-10-15f, a Discord report: "exploit where you do easy quests for a guild and then ask to join
// it to farm 100 rep in 1 minute"; Mac, asked of four shapes: "Pace ranks from joining"). PROMO-NOW took the 28 days off
// an online promotion because the Roll paces reputation - but a stranger's quests bank reputation with the guild before
// the membership begins, and the first review turned it into seven ranks at once. Online a review now promotes no
// further than the Roll's pace could have paid since it saw the membership begin; the stranger's standing still counts,
// at that pace, and no rank already held is taken. bible/01-Overview/bugs/Field-Bugs-2026-10-15f.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GUILDS, updateRank, joinGuild } from '../../../src/systems/guild/guilds.js';
import { createFactionRep, getReputation } from '../../../src/systems/faction/factionRep.js';
import { rankNeedsLines } from '../../../src/systems/guild/guildServiceFlow.js';
import { rollPromoteCeiling, rollPaceWait, rollPaceDays, ROLL_GAIN_DAY_MAX, ROLL_BOOK_RANK_MAX } from '../../../src/net/npcChapterLaw.js';
import { createRollTracker, rollEntityDoors, rollPaceOf } from '../../../src/net/npcRollTracker.js';
import { readRoll, claimRoll } from '../../../server-account/src/npcRoll.js';
import { standService, T0 } from '../../accountDb.mjs';
import { seatRealm } from '../../realmSeat.mjs';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const DAY = 86_400;
const DAY0 = Math.floor(T0 / DAY) * DAY;   // a UTC midnight
const g = GUILDS.FightersGuild;
const F = g.factionId;
const date = (n) => ({ year: 405, dayOfYear: 10 + n });
const ONLINE = (ceiling) => ({ promoteWhenEarned: true, rankCeiling: ceiling });

test('ROLL-PACE: the pace - the first day counted, fifteen a day, the Roll\'s own reputation and the book\'s seven the bounds; nothing before the Roll\'s first word (mutants: the first day uncounted, the reputation unread, the book unbounded)', () => {
  assert.equal(ROLL_GAIN_DAY_MAX, 15);
  assert.equal(rollPaceDays(DAY0 + 3600, DAY0 + 7200), 1, 'the day it began');
  assert.equal(rollPaceDays(DAY0 + 80_000, DAY0 + DAY + 10), 2, 'past midnight UTC: the second day');
  assert.equal(rollPaceDays(null, DAY0), 1, 'one the Roll has not yet seen begins today');
  const at = (rep, days) => rollPromoteCeiling({ rep, since: DAY0 }, DAY0 + days * DAY + 60);
  assert.deepEqual([0, 1, 2, 3, 4, 10].map((d) => at(75, d)), [1, 3, 4, 6, 7, 7], 'a stranger\'s 75: one rank the day it joins, then the pace');
  assert.equal(at(15, 30), 1, 'the Roll\'s reputation bounds it');
  assert.equal(at(100, 30), ROLL_BOOK_RANK_MAX, 'never a seat');
  assert.equal(rollPromoteCeiling(null, DAY0), 0, 'before the Roll\'s first word: none');
});

test('ROLL-PACE: the days the pace still holds a rank - none once paid, null where it is not the pace that holds it (mutants: the reputation\'s null, the wait off by a day)', () => {
  const s = { rep: 75, since: DAY0 };
  assert.equal(rollPaceWait(s, DAY0 + 60, 1), 0, 'rank 1 the first day');
  assert.equal(rollPaceWait(s, DAY0 + 60, 2), 1, 'rank 2 (twenty) tomorrow');
  assert.equal(rollPaceWait(s, DAY0 + 60, 7), 4, 'rank 7 (seventy) the fifth day');
  assert.equal(rollPaceWait({ rep: 15, since: DAY0 }, DAY0 + 60, 2), null, 'the reputation short: the hall says that, not the pace');
  assert.equal(rollPaceWait(null, DAY0, 1), null);
  assert.equal(rollPaceWait(s, DAY0, 8), null, 'a seat is no rank the pace pays');
});

/** The real Roll (server-account/src/npcRoll.js) on the account service's own database, and this tab's tracker over it. */
async function realm() {
  const svc = await standService({ CHAPTERS_OPEN: 'on' });
  const who = await svc.registered('Audra');
  const R = await seatRealm(svc.env, who.secret, 'Audra');
  let nowS = DAY0 + 3600;
  const ctx = () => ({ db: svc.env.DB, nowS });
  const answer = (r) => (r?.error ? { ok: false, error: r.error } : { ok: true, data: r });
  const io = {
    read: async (character, lease, seed) => answer(await readRoll(ctx(), { id: who.id }, { character, lease, seed })),
    claim: async (character, lease, rid, deltas, members) => answer(await claimRoll(ctx(), { id: who.id }, { character, lease, rid, deltas, members })),
  };
  const book = {};
  // a stranger who did the guild's errands: its standing 75 (born online, the Roll seeded whole), no membership
  const entity = {
    name: 'Audra', skills: Object.fromEntries(g.skills.map((s) => [s, 100])),
    factionRep: createFactionRep(new Map([[F, { id: F, parent: 0, rep: 75, flags: 0, power: 50, ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0, children: null, type: 0, ggroup: 0 }]])),
    guildMemberships: { mortal: book, vampire: {} },
  };
  const doors = rollEntityDoors(() => entity);
  let ms = nowS * 1000;
  const tracker = createRollTracker({ io, character: () => R.id, lease: () => R.lease, ...doors, now: () => ms });
  const settle = () => new Promise((r) => setTimeout(r, 0));
  const tick = async () => { tracker.tick(); await settle(); };
  const advance = (s) => { nowS += s; ms = nowS * 1000; };
  return { tracker, entity, book, tick, advance, now: () => nowS };
}

test('ROLL-PACE end to end: a stranger with 75 joins the Fighters Guild - the hall\'s review makes them rank 1, not 7, then the pace a day; the hall says when the next comes (mutants: the membership\'s start unread, the host\'s ceiling the book\'s)', async () => {
  const r = await realm();
  await r.tick();
  assert.ok(r.tracker.held, 'the Roll\'s first word');
  joinGuild(r.book, g, date(0));
  r.advance(61); await r.tick();   // the claim carries the membership; the Roll begins it now
  const pace = () => rollPaceOf(r.tracker, F, r.now());
  assert.equal(pace().ceiling, 1);
  const review = (n) => updateRank(r.book, g, r.entity, r.entity.factionRep, date(n), ONLINE(pace().ceiling));
  assert.equal(review(0)?.rank, 1, 'the first review: rank 1 - before ROLL-PACE, rank 7');
  assert.deepEqual(rankNeedsLines(r.entity, g, r.book, r.entity.factionRep, { rankCeiling: pace().book, pace: pace() }).at(-1), 'Earliest promotion: tomorrow');
  r.advance(DAY); await r.tick();
  assert.equal(review(1)?.rank, 3, 'the second day');
  r.advance(3 * DAY); await r.tick();
  assert.equal(review(4)?.rank, 7, 'the fifth: the book\'s seven');
  assert.equal(getReputation(r.entity.factionRep, F), 75, 'and not a point of the standing was taken');
});

test('ROLL-PACE: the review reads the Roll\'s reputation, never the page\'s unclaimed number; a rank already held is never taken; no Roll, no promotion without DFU\'s wait (mutants: the page\'s number read, the held rank taken)', async () => {
  const s = { rep: 10, since: DAY0 - 60 * DAY };
  assert.equal(rollPromoteCeiling(s, DAY0), 1, 'a member of two months whose page holds 40 unclaimed: the Roll\'s 10 is rank 1');
  const book = {};
  const m = joinGuild(book, g, date(0));
  m.rank = 5;
  const entity = { name: 'Kept', skills: Object.fromEntries(g.skills.map((x) => [x, 100])) };
  const store = createFactionRep(new Map([[F, { id: F, parent: 0, rep: 60, flags: 0, power: 50, ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0, children: null, type: 0, ggroup: 0 }]]));
  assert.equal(updateRank(book, g, entity, store, date(1), ONLINE(1)), null, 'a rank 5 under a ceiling of 1 stays 5');
  assert.equal(updateRank(book, g, entity, store, date(40), ONLINE(1)), null, 'and at a review past DFU\'s 28 days, still 5');
  assert.equal(m.rank, 5);
  assert.equal(rollPaceOf(null, F, DAY0), null, 'offline: no pace, DFU\'s review');
  assert.equal(rollPaceOf({ stopped: null, held: false, standing: () => null }, F, DAY0)?.ceiling, 0, 'online before the Roll\'s first word: paced, and nobody promoted (AUDIT CHAP4 C3: never DFU\'s 8 and 9)');
  assert.equal(rollPaceOf({ stopped: 'chapters-closed', standing: () => null }, F, DAY0), null, 'the Roll refused: DFU\'s review');
});

test('ROLL-PACE by source: the halls read the pace for the guild\'s own faction - the review\'s ceiling, the no-wait only while it paces, the hall\'s line - and the host hands it (mutants: each dropped)', () => {
  const wm = read('src/scenes/worldModes.js');
  assert.ok(wm.includes('        rankCeiling: host.rollPace?.(guild.factionId)?.ceiling ?? null,'));
  assert.ok(wm.includes('        promoteWhenEarned: sharedClockOn() && !!host.rollPace?.(guild.factionId),'));
  assert.ok(wm.includes('rankNeedsLines(playerEntity, guild, seated(), store, { rankCeiling: pace?.book ?? null, pace, now: ownDate(), book: memberships })'));   // PIN MOVED (SEAT-LINE, FIELD BUGS 2026-10-15g): read seated, with the review's date and book
  assert.ok(read('src/scenes/world.js').includes('    rollPace: (f) => rollPaceOf(rollTracker, f, Math.floor(Date.now() / 1000)),'));
});
