// SEAT-WORDS and STANDING-WORDS (FIELD BUGS 2026-10-15g; Mac, asked what the guild system still left unsaid: "Seat-locked
// services", "Standing changes shown", "Probation warning", "Tutorial + guide words"), AUDIT GUILD-WORDS (Mac: "Lets
// audit everything") and AUDIT GUILD-WORDS II (Mac: "Audit this and ensure perfection"; bible/01-Overview/audits/Audit-Guild-Words.md),
// which read them cold and fixed what they found: online, a service a chair opens says it is a chair's at any rank, and a
// knight is told the order's house is not given; the hold at 7 pops the Chapters page; every Roll answer says what it
// moved - a quest's whole reward, a loss the owed absorbed, the owed paid (the service's own word, II B-4) - and what it
// still owes, in the port's guild names and the language's own list (II B-6, B-7); the pace's line only where the owed
// grew, and a gain lost to the most a standing holds said lost (II B-3); the review's warnings (a probation's stakes, one
// the next review begins, a demotion before it lands, each with its days) come first; the tutorial and the notice board's
// guide say the law as it is.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GUILDS, joinGuild, membershipOf, membershipKey, activeMemberships, reviewDaysLeft, daySinceZero, setUnderworldRule } from '../../src/systems/guild/guilds.js';
import { templeOf, orderOf } from '../../src/systems/guild/guildVariants.js';
import { createFactionRep, setReputation } from '../../src/systems/faction/factionRep.js';
import { serviceAccess, rankNeedsLines, probationWords, reviewWarnings, INSUFFICIENT_RANK_ID } from '../../src/systems/guild/guildServiceFlow.js';
import { receiveHouseDecision, claimHouse, NO_HOUSE_TEXT_ID, alreadyGivenHouseText } from '../../src/systems/knightlyGifts.js';
import { seatedBook, rollMovesOf, rollKeptOf, rollCredit, rollDrain, ROLL_FACTIONS } from '../../src/net/npcChapterLaw.js';
import { createRollTracker, rollEntityDoors } from '../../src/net/npcRollTracker.js';
import { setStandingOwed, standingOwedOf } from '../../src/systems/standingOwed.js';
import { standingLine, standingName, rollNoticeDoors } from '../../src/scenes/rollNoticeHost.js';
import { setTutorialHandler, _resetTutorialTriggerForTests, tutorialById, forgetTutorialsSeen } from '../../src/systems/tutorials.js';
import { affiliations } from '../../src/systems/affiliations.js';
import { chapterGuide } from '../../src/ui/noticeWindow.js';
import { layoutMessageBox, fitBoxRows, latchBoxRows } from '../../src/ui/messageBox.js';
import * as tm from '../../src/systems/textManager.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); };
const day = (n) => ({ year: 405, dayOfYear: n });
const MAGES = GUILDS.MagesGuild.factionId, FIGHTERS = GUILDS.FightersGuild.factionId;
const ROLL = { rankCeiling: 7 };
const PACE = { book: 7, ceiling: 9, wait: () => 0 };   // the host's rollPace while the Roll paces: PROMO-NOW's online review
const storeOf = (rows) => {
  const dict = new Map(Object.entries(rows).map(([id, v]) => [Number(id), { id: Number(id), parent: 0, rep: 0, flags: 0, power: 50, name: v.name,
    ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0, children: null, type: 0, ggroup: 0 }]));
  const store = createFactionRep(dict);
  for (const [id, v] of Object.entries(rows)) setReputation(store, Number(id), v.rep);
  return store;
};
const skilled = (g, v) => ({ name: 'Tester', skills: Object.fromEntries(g.skills.map((s) => [s, v])) });
/** TEST THE SHAPE THE PRODUCER MINTS (AUDIT GUILD-WORDS L5-2): the character's book as the game holds it - the mortal and
 *  vampire books activeMemberships mints - joined through joinGuild (its stamp day 1). */
const memberAt = (g, rank, extra = {}, entity = {}) => {
  Object.assign(joinGuild(activeMemberships(entity), g, day(1)), { rank, ...extra });
  return entity;
};
const bookOf = (entity) => activeMemberships(entity);
/** The review's when, as every warning says it (AUDIT GUILD-WORDS II A-8). */
const when = (d) => (d === 0 ? 'at your next visit to the guild\'s hall' : `at the guild's hall in ${d} ${d === 1 ? 'day' : 'days'} or later`);
const SEAT = 'Rank 8 offers this. Online, ranks 8 and 9 are chapter chairs won by Merit, and a chair\'s services are at its own chapter\'s halls, for a member at rank 7. A notice board explains chapters.';
afterEach(() => { setStandingOwed(null); _resetTutorialTriggerForTests(); setUnderworldRule(null); });

// ── SEAT-WORDS ──────────────────────────────────────────────────────

test('SEAT-WORDS: online a service only a chair\'s rank opens says so at any rank - the Mages\' Teleport, Zenithar\'s summoning; offline, a chair\'s holder at its own halls and a service no rank opens keep DFU\'s answers (mutants: the refusal gone, read only at 7, a rank the ceiling opens, the rank not the first)', () => {
  const g = GUILDS.MagesGuild;
  for (const rank of [7, 6, 3, 0]) {
    assert.deepEqual(serviceAccess(g, membershipOf(bookOf(memberAt(g, rank)), g), 'Teleport', ROLL), { allowed: false, text: SEAT }, `rank ${rank}: no review reaches 8 online`);
  }
  assert.deepEqual(serviceAccess(g, membershipOf(bookOf(memberAt(g, 2)), g), 'BuyMagicItems', ROLL), { allowed: false, textId: INSUFFICIENT_RANK_ID }, 'rank 3 opens it: a review still may');
  assert.deepEqual(serviceAccess(g, membershipOf(bookOf(memberAt(g, 7)), g), 'Teleport'), { allowed: false, textId: INSUFFICIENT_RANK_ID }, 'offline DFU\'s 3100');
  assert.deepEqual(serviceAccess(g, membershipOf(seatedBook(bookOf(memberAt(g, 7)), membershipKey(g), 8), g), 'Teleport', ROLL), { allowed: true }, 'a chair\'s holder at its halls');
  assert.deepEqual(serviceAccess(g, membershipOf(bookOf(memberAt(g, 7)), g), 'Repair', ROLL), { allowed: false, textId: INSUFFICIENT_RANK_ID }, 'no rank opens it');
  const z = templeOf('Zenithar');
  assert.equal(serviceAccess(z, membershipOf(bookOf(memberAt(z, 5)), z), 'DaedraSummoning', ROLL).text, SEAT);
});

test('SEAT-WORDS: online no knight is given the order\'s house - the chairs bring none; a house the order gave says so; offline DFU\'s rank-9 record and grant, on a knightly order\'s own row (mutants: the online arm gone, the given house unread)', () => {
  const o = orderOf('Dragon');
  const knight = membershipOf(bookOf(memberAt(o, 7)), o);
  assert.equal(knight.guild, 'Order:Dragon', 'the order\'s own row');
  assert.deepEqual(receiveHouseDecision(knight, { rankCeiling: 7 }),
    { kind: 'refuse', line: 'Online, ranks 8 and 9 are the order\'s chapter chairs, held by winning Merit. A chair brings no house.' });
  const given = { ...knight };
  claimHouse(given);
  assert.deepEqual(receiveHouseDecision(given, { rankCeiling: 7 }), { kind: 'refuse', line: alreadyGivenHouseText() });
  assert.deepEqual(receiveHouseDecision(knight), { kind: 'refuse', textId: NO_HOUSE_TEXT_ID });
  assert.equal(receiveHouseDecision({ ...knight, rank: 9 }, { housesForSale: [{ buildingKey: 1 }], rolls: () => 0 }).kind, 'grant');
});

test('SEAT-WORDS: the hold at 7 is said and pops the Chapters page; the first word pops it for a member, moved or not, and not a stranger, and only the first; every move is said, and a quiet one says nothing (mutants: each door, the say unguarded, the entity unread, the first-word gate, a first word needing a move, the raw book)', () => {
  forgetTutorialsSeen();
  const asked = [];
  setTutorialHandler((id) => { asked.push(id); return true; });
  const said = [];
  const member = memberAt(GUILDS.MagesGuild, 7, {}, { factionRep: storeOf({ [MAGES]: { name: 'The Mages Guild', rep: 35 } }) });
  const doors = rollNoticeDoors({ entityOf: () => member, say: (s) => said.push(s) });
  doors.onCapped([MAGES]);
  assert.deepEqual([said.length, asked], [1, ['chapters']]);
  assert.match(said[0], /Mages Guild keeps ranks 8 and 9/);
  asked.length = 0;
  doors.onStanding([], false);
  assert.deepEqual([said.length, asked], [1, []], 'a quiet answer, not the first: nothing');
  doors.onStanding([], true);
  assert.deepEqual([said.length, asked], [1, ['chapters']], 'the usual first word - nothing moved - still shows the page');
  asked.length = 0;
  doors.onStanding([{ f: MAGES, delta: 5, now: 35, owed: 0 }], true);
  assert.deepEqual([said.at(-1), asked], ['Standing: Mages Guild +5 (now 35)', ['chapters']]);
  asked.length = 0;
  rollNoticeDoors({ entityOf: () => ({}), say: () => {} }).onStanding([], true);
  assert.deepEqual(asked, [], 'a stranger');
  assert.ok(tutorialById('chapters'), 'the page stands');
});

test('AUDIT GUILD-WORDS II B-3, C-4: the pace\'s line names the guild and what is owed; a gain the most a standing holds turned away is said lost (mutants: the owed unread, the lost line, the name)', () => {
  const said = [];
  const doors = rollNoticeDoors({ entityOf: () => ({}), say: (s) => said.push(s) });
  setStandingOwed({ [MAGES]: 10 });
  doors.onCeiling([MAGES]);
  doors.onFull([templeOf('Zenithar').factionId]);
  assert.deepEqual(said, ['Mages Guild: quests cannot raise your standing any further today. 10 more is owed and arrives over the coming days.',
    'Temple of Zenithar: your standing and what is owed already reach 100, so the rest of that reward is lost.']);
});

// ── STANDING-WORDS ──────────────────────────────────────────────────

test('STANDING-WORDS: the moves - a reward whole with what is owed, a loss the owed absorbed, a faction either word lacks unread; a service before `paid`: a standing moved alone is the owed paid (mutants: the owed uncounted, the paid unsaid, a rise alone)', () => {
  assert.deepEqual(rollMovesOf({ 40: 10, 41: 5 }, { 40: 4 }, { 40: 30, 41: 5 }, { 40: 9 }), [{ f: 40, delta: 25, now: 30, owed: 9 }]);
  assert.deepEqual(rollMovesOf({ 40: 30 }, { 40: 9 }, { 40: 30 }, { 40: 4 }), [{ f: 40, delta: -5, now: 30, owed: 4 }], 'the owed took the loss');
  assert.deepEqual(rollMovesOf({ 40: 40 }, { 40: 10 }, { 40: 50 }, {}), [{ f: 40, paid: 10, now: 50, owed: 0 }]);
  assert.deepEqual(rollMovesOf({ 40: 40 }, {}, { 40: 15 }, {}), [{ f: 40, delta: -25, now: 15, owed: 0 }]);
  assert.deepEqual(rollMovesOf({ 40: 40 }, {}, { 41: 1 }, {}), []);
});

test('AUDIT GUILD-WORDS II B-4, B-5: with the service\'s `paid` - a move and a payment both said, a writ the owed\'s room trimmed beside it said as the standing\'s rise, a payment alone; a page\'s first word says what its read paid and nothing else (mutants: the paid map unread, the both arm, the trim\'s rise, the first word\'s payment)', () => {
  assert.deepEqual(rollMovesOf({ 40: 50 }, { 40: 10 }, { 40: 55 }, {}, { 40: 10 }), [{ f: 40, delta: -5, paid: 10, now: 55, owed: 0 }], 'the day turned: ten paid, then a -5');
  assert.deepEqual(rollMovesOf({ 40: 90 }, { 40: 10 }, { 40: 92 }, { 40: 8 }, {}), [{ f: 40, delta: 2, now: 92, owed: 8 }], 'a writ\'s +2, the owed trimmed under 100');
  assert.deepEqual(rollMovesOf({ 40: 40 }, { 40: 10 }, { 40: 50 }, {}, { 40: 10 }), [{ f: 40, paid: 10, now: 50, owed: 0 }]);
  assert.deepEqual(rollMovesOf({ 40: 40 }, {}, { 40: 40 }, {}, {}), [], 'nothing moved');
  assert.deepEqual(rollMovesOf(null, {}, { 40: 50, 41: 3 }, { 40: 5 }, { 40: 10 }), [{ f: 40, paid: 10, now: 50, owed: 5 }], 'the first word: the payment alone');
  assert.deepEqual(rollMovesOf(null, {}, { 40: 50 }, {}, null), [], 'the first word from a service before `paid`: nothing');
});

test('STANDING-WORDS: one line - the guilds the character belongs to named by the port\'s names, in the language\'s list, the sign, now and the owed, the owed paid, both; the rest counted; nothing moved, nothing said (mutants: each item, the fold, the empty line, the list joined bare, FACTION.TXT\'s name)', () => {
  const entity = memberAt(GUILDS.MagesGuild, 2, {}, memberAt(GUILDS.FightersGuild, 1, {}, { factionRep: storeOf({ [MAGES]: { name: 'The Mages Guild', rep: 35 } }) }));
  assert.equal(standingLine(entity, [{ f: MAGES, delta: 5, now: 35, owed: 0 }, { f: FIGHTERS, delta: -25, now: -20, owed: 0 }]),
    'Standing: Mages Guild +5 (now 35) and Fighters Guild -25 (now -20)');
  assert.equal(standingLine(entity, [{ f: MAGES, delta: 25, now: 40, owed: 10 }]), 'Standing: Mages Guild +25 (now 40, 10 more to come)');
  assert.equal(standingLine(entity, [{ f: MAGES, paid: 10, now: 50, owed: 0 }]), 'Standing: Mages Guild: 10 of what was owed arrived (now 50)');
  assert.equal(standingLine(entity, [{ f: MAGES, paid: 10, now: 50, owed: 5 }]), 'Standing: Mages Guild: 10 of what was owed arrived (now 50, 5 more to come)');
  assert.equal(standingLine(entity, [{ f: MAGES, delta: -5, paid: 10, now: 55, owed: 0 }]), 'Standing: Mages Guild -5, and 10 of what was owed arrived (now 55)');
  assert.equal(standingLine(entity, [{ f: MAGES, delta: 3, paid: 10, now: 63, owed: 4 }]), 'Standing: Mages Guild +3, and 10 of what was owed arrived (now 63, 4 more to come)');
  assert.equal(standingLine(entity, [{ f: MAGES, delta: -1, now: 34, owed: 0 }, { f: 42, delta: -1, now: 9, owed: 0 }, { f: 82, delta: 1, now: -9, owed: 0 }]),
    'Standing: Mages Guild -1 (now 34) and 2 other guilds');
  assert.equal(standingLine(entity, [{ f: MAGES, delta: -1, now: 34, owed: 0 }, { f: FIGHTERS, delta: 1, now: 2, owed: 0 }, { f: 42, delta: -1, now: 9, owed: 0 }]),
    'Standing: Mages Guild -1 (now 34), Fighters Guild +1 (now 2), and 1 other guild', 'three: the language\'s own list');
  assert.equal(standingLine(entity, [{ f: 42, delta: -1, now: 9, owed: 0 }]), 'Standing moved with 1 guild you do not belong to.');
  assert.equal(standingLine(entity, []), null);
  assert.equal(standingLine(entity, [{ f: MAGES, delta: 0, now: 35, owed: 0 }]), null);
  const zen = memberAt(templeOf('Zenithar'), 1, {}, { factionRep: storeOf({ [templeOf('Zenithar').factionId]: { name: 'Zen', rep: 30 } }) });
  assert.equal(standingLine(zen, [{ f: templeOf('Zenithar').factionId, delta: 2, now: 32, owed: 0 }]), 'Standing: Temple of Zenithar +2 (now 32)', 'never FACTION.TXT\'s "Zen"');
  assert.deepEqual([standingName(orderOf('Rose').factionId), standingName(5)], ['Knights of the Rose', '5']);
  // a vampire's active book is the vampire's (DFU's GuildManager): its mortal Mages Guild lies dormant, counted not named
  const vamp = { racialOverride: { racial: 'vampirism', ended: false }, guildMemberships: { mortal: {}, vampire: {} } };
  joinGuild(vamp.guildMemberships.mortal, GUILDS.MagesGuild, day(1));
  assert.equal(standingLine(vamp, [{ f: MAGES, delta: 5, now: 35, owed: 0 }]), 'Standing moved with 1 guild you do not belong to.');
});

const ALL = (over) => ({ ...Object.fromEntries(ROLL_FACTIONS.map((f) => [f, 0])), ...over });

/** TEST THE SHAPE THE PRODUCER MINTS (AUDIT GUILD-WORDS II E-13): the Mages Guild's row as server-account/src/npcRoll.js
 *  keeps it, read and claimed through the law's own rollDrain and rollCredit - its answers readRoll's and claimRoll's,
 *  `paid` and `credited` with them. `legacy`: a service before `paid`. */
function lawService(row, { legacy = false } = {}) {
  let seq = 1, today = row.gainedDay;
  const svc = { refuse: null, nextDay() { today++; } };
  const view = () => ({ seq, factions: ALL({ [MAGES]: row.rep }), owed: row.owed > 0 ? { [MAGES]: row.owed } : {}, members: [], seats: [] });
  const drain = () => {
    if (!(row.owed > 0)) return {};
    const d = rollDrain(row, today);
    Object.assign(row, { rep: d.rep, gainedDay: d.gainedDay, gained: d.gained, owed: d.owed });
    return d.credited > 0 ? { [MAGES]: d.credited } : {};
  };
  const paidOf = (paid) => (legacy ? {} : { paid });
  svc.io = {
    async read() { const paid = drain(); return { ok: true, data: { roll: view(), from: seq, ...paidOf(paid) } }; },
    async claim(id, ls, rid, deltas) {
      if (svc.refuse) return { ok: false, error: svc.refuse };
      const paid = drain();
      const credited = {};
      if (deltas[MAGES]) {
        const c = rollCredit(row, deltas[MAGES], today);
        Object.assign(row, { rep: c.rep, gainedDay: c.gainedDay, gained: c.gained, owed: c.owed });
        credited[MAGES] = c.credited;
        seq++;
      }
      return { ok: true, data: { roll: view(), credited, ...paidOf(paid) } };
    },
  };
  return svc;
}
const tab = (svc, entity, extra = {}) => {
  const heard = [], ceiling = [], full = [];
  let t = 1_000_000;
  const tracker = createRollTracker({ io: svc.io, character: () => 'r0123456789abcdef0123', lease: () => 'a'.repeat(32), ...rollEntityDoors(() => entity), now: () => t,
    onStanding: (changes, first) => heard.push([changes, first]), onCeiling: (f) => ceiling.push(f), onFull: (f) => full.push(f), ...extra });
  return { tracker, heard, ceiling, full, step: async () => { t += 60_000; tracker.tick(); await settle(); } };
};
const magesAt = (rep) => ({ factionRep: storeOf({ [MAGES]: { name: 'The Mages Guild', rep } }), guildMemberships: { mortal: {}, vampire: {} } });

test('STANDING-WORDS over the law\'s own service: the first word\'s owed kept; a quest past the day\'s room said whole with the pace\'s line; a loss the owed absorbed; the next day\'s payment the service\'s word; a payment and a loss in one claim, both (mutants: the last word unread, the owed unkept, the paid map dropped, the pace\'s line unguarded)', async () => {
  const entity = magesAt(10);
  const svc = lawService({ rep: 10, owed: 4, gainedDay: 0, gained: 15 });
  const p = tab(svc, entity);
  p.tracker.tick(); await settle();
  assert.deepEqual(p.heard, [[[], true]], 'no room today: nothing paid, nothing said');
  assert.equal(standingOwedOf(MAGES), 4, 'the first word\'s owed, shown at once');
  setReputation(entity.factionRep, MAGES, 35);   // a quest's +25, the day's room spent
  await p.step();
  assert.deepEqual(p.heard[1], [[{ f: MAGES, delta: 25, now: 10, owed: 29 }], false]);
  assert.deepEqual(p.ceiling, [[MAGES]], 'the owed grew: the pace\'s line');
  setReputation(entity.factionRep, MAGES, 5);   // a crime's -5 - the owed takes it
  await p.step();
  assert.deepEqual(p.heard[2], [[{ f: MAGES, delta: -5, now: 10, owed: 24 }], false]);
  svc.nextDay();
  p.tracker.refresh();   // a hall's word: the next tick claims with nothing moved
  await p.step();
  assert.deepEqual(p.heard[3], [[{ f: MAGES, paid: 15, now: 25, owed: 9 }], false], 'the day\'s room paid fifteen');
  svc.nextDay();
  setReputation(entity.factionRep, MAGES, 20);   // a -5 on a new day: the claim pays the nine first
  await p.step();
  assert.deepEqual(p.heard[4], [[{ f: MAGES, delta: -5, paid: 9, now: 29, owed: 0 }], false]);
  assert.deepEqual([p.ceiling.length, p.full.length], [1, 0]);
});

test('AUDIT GUILD-WORDS II B-3: a gain the most a standing holds turned away is said lost, not owed; a gain both owed and lost says both; a service before `paid` keeps AUDIT CHAP\'s pace alone (mutants: the lost line, the owed\'s growth unread, the legacy arm)', async () => {
  const entity = magesAt(90);
  let p = tab(lawService({ rep: 90, owed: 10, gainedDay: 0, gained: 15 }), entity);
  p.tracker.tick(); await settle();
  setReputation(entity.factionRep, MAGES, 95);
  await p.step();
  assert.deepEqual([p.ceiling, p.full], [[], [[MAGES]]], '90 and ten owed: the +5 is lost');
  assert.deepEqual(p.heard[1], [[], false], 'and no move to say');
  assert.equal(entity.factionRep.dict.get(MAGES).rep, 90, 'the standing the Roll\'s');
  const e2 = magesAt(80);
  p = tab(lawService({ rep: 80, owed: 10, gainedDay: 0, gained: 10 }), e2);
  p.tracker.tick(); await settle();
  setReputation(e2.factionRep, MAGES, 100);   // +20: five taken, five owed, ten lost
  await p.step();
  assert.deepEqual([p.ceiling, p.full], [[[MAGES]], [[MAGES]]]);
  // a new day: the claim pays the nine owed first, then takes six of a +20 - fourteen owed after a payment is growth, none lost
  const e4 = magesAt(25);
  const svc4 = lawService({ rep: 25, owed: 9, gainedDay: 0, gained: 15 });
  p = tab(svc4, e4);
  p.tracker.tick(); await settle();
  svc4.nextDay();
  setReputation(e4.factionRep, MAGES, 45);
  await p.step();
  assert.deepEqual(p.heard[1], [[{ f: MAGES, delta: 20, paid: 9, now: 40, owed: 14 }], false]);
  assert.deepEqual([p.ceiling, p.full], [[[MAGES]], []], 'the owed read after the claim\'s own payment');
  const e3 = magesAt(90);
  p = tab(lawService({ rep: 90, owed: 10, gainedDay: 0, gained: 15 }, { legacy: true }), e3);
  p.tracker.tick(); await settle();
  setReputation(e3.factionRep, MAGES, 95);
  await p.step();
  assert.deepEqual([p.ceiling, p.full], [[[MAGES]], []], 'a service before `paid`: the cut is AUDIT CHAP\'s pace');
});

test('STANDING-WORDS: a lease\'s stop keeps what is owed (the next lease resumes); a closed Roll clears it (mutants: the stop\'s clear, the lease\'s clear - AUDIT GUILD-WORDS II E-14)', async () => {
  const entity = magesAt(10);
  const svc = lawService({ rep: 10, owed: 4, gainedDay: 0, gained: 15 });
  const p = tab(svc, entity);
  p.tracker.tick(); await settle();
  svc.refuse = 'lease';
  setReputation(entity.factionRep, MAGES, 12);
  await p.step();
  assert.equal(p.tracker.stopped, 'lease');
  assert.equal(standingOwedOf(MAGES), 4, 'the page hid: still owed');
  svc.refuse = 'chapters-closed';
  const q = tab(svc, magesAt(10));
  svc.refuse = null;
  q.tracker.tick(); await settle();
  svc.refuse = 'chapters-closed';
  setReputation(entity.factionRep, MAGES, 13);
  q.tracker.refresh();
  await q.step();
  assert.equal(q.tracker.stopped, 'chapters-closed');
  assert.equal(standingOwedOf(MAGES), 0, 'closed: nothing owed is said');
});

test('STANDING-WORDS: a page\'s first word says what its read paid - the service\'s word, whatever the save keeps, an older record\'s owed never read, a moved Roll\'s payment too; a reseed is no second first word; a service before `paid` says nothing (mutants: the paid unread, a kept record compared, the first said twice - AUDIT GUILD-WORDS II B-1, B-2, B-5)', async () => {
  const entity = magesAt(40);
  let kept = { seq: 1, factions: ALL({ [MAGES]: 40 }), owed: { [MAGES]: 10 } };
  assert.deepEqual(rollKeptOf(kept), { seq: 1, factions: ALL({ [MAGES]: 40 }) }, 'the kept record is its seq and its twenty-two');
  const svc = lawService({ rep: 40, owed: 10, gainedDay: 0, gained: 0 });
  const answers = [];
  const io = { read: async (...a) => answers.shift() ?? svc.io.read(...a), claim: (...a) => svc.io.claim(...a) };
  answers.push(undefined, { ok: false, error: 'roll-unseeded' });
  const p = tab({ io }, entity, { kept: () => kept, keep: (k) => { kept = k; } });
  p.tracker.tick(); await settle();
  assert.deepEqual(p.heard, [[[{ f: MAGES, paid: 10, now: 50, owed: 0 }], true]]);
  assert.deepEqual(kept, { seq: 1, factions: ALL({ [MAGES]: 50 }) }, 'kept as it ever was');
  setReputation(entity.factionRep, MAGES, 51);
  await p.step();   // roll-unseeded: read again
  await p.step();
  assert.equal(p.heard.length, 2);
  assert.equal(p.heard[1][1], false, 'once a page');
  // the Roll moved on past the save's record: the read's payment is said all the same
  const moved = lawService({ rep: 60, owed: 5, gainedDay: 0, gained: 0 });
  const q = tab(moved, magesAt(60), { kept: () => ({ seq: 0, factions: ALL({ [MAGES]: 10 }) }) });
  q.tracker.tick(); await settle();
  assert.deepEqual(q.heard, [[[{ f: MAGES, paid: 5, now: 65, owed: 0 }], true]]);
  const old = tab(lawService({ rep: 40, owed: 10, gainedDay: 0, gained: 0 }, { legacy: true }), magesAt(40), { kept: () => ({ seq: 1, factions: ALL({ [MAGES]: 40 }), owed: { [MAGES]: 10 } }) });
  old.tracker.tick(); await settle();
  assert.deepEqual(old.heard, [[[], true]], 'no `paid`: no word invented off the save');
});

test('STANDING-WORDS: the hall\'s reputation row and the Standing page\'s book carry the owed (mutants: the owed row, the book\'s owed)', () => {
  const g = GUILDS.FightersGuild;
  const entity = memberAt(g, 1, {}, { factionRep: storeOf({ [FIGHTERS]: { name: 'The Fighters Guild', rep: 14 } }), skills: skilled(g, 40).skills });
  setStandingOwed({ [FIGHTERS]: 6 });
  assert.deepEqual(rankNeedsLines(skilled(g, 40), g, bookOf(entity), entity.factionRep), ['Next rank: Swordsman', 'Reputation 14 of 20 (6 more already earned, arriving at most 15 a real day)']);
  const book = affiliations(entity);
  assert.deepEqual([book[0].owed, book[0].warnings], [6, []]);
});

// ── THE SEAT LINE ───────────────────────────────────────────────────

test('SEAT-WORDS: the seat line\'s arms - the owed beside the chairs\' 80, a probation first, the 80 met says the Turning alone (mutants: the owed, the probation, the boundary)', () => {
  const g = GUILDS.MagesGuild;
  const seats = 'Ranks 8 and 9 are each chapter\'s council and Master, won only by Merit';
  const merit = 'At each Sunday\'s Turning the chairs go to the members with the most Merit over the last 4 weeks, with 14 real days in the guild and accounts 7 real days old';
  setStandingOwed({ [MAGES]: 10 });
  assert.deepEqual(rankNeedsLines(skilled(g, 90), g, bookOf(memberAt(g, 7)), storeOf({ [MAGES]: { rep: 72 } }), ROLL),
    ['Next rank: Master Wizard', seats, 'Reputation 72 of 80 (10 more already earned, arriving at most 15 a real day)', merit]);
  setStandingOwed(null);
  assert.deepEqual(rankNeedsLines(skilled(g, 90), g, bookOf(memberAt(g, 7)), storeOf({ [MAGES]: { rep: 80 } }), ROLL), ['Next rank: Master Wizard', seats, merit]);
  const onProbation = bookOf(memberAt(g, 7, { probation: true, lastRankChange: daySinceZero(day(10)) }));
  const lines = rankNeedsLines(skilled(g, 90), g, onProbation, storeOf({ [MAGES]: { rep: 75 } }), { ...ROLL, now: day(30) });
  assert.deepEqual(lines.slice(0, 2), [probationWords(8), 'Next rank: Master Wizard']);
});

// ── THE REVIEW'S WARNINGS ───────────────────────────────────────────

test('AUDIT GUILD-WORDS L1-2, II A-8: a demotion is said before it lands, with when - a Wizard at 62 told the review lowers it to Warlock and why, first in the hall\'s line and on the Standing page (mutants: the demotion unsaid, the reason, the rank read, the days)', () => {
  const g = GUILDS.MagesGuild;
  const entity = memberAt(g, 7, {}, { factionRep: storeOf({ [MAGES]: { name: 'The Mages Guild', rep: 62 } }), skills: skilled(g, 90).skills });
  const falls = `Your review ${when(0)} lowers you to Warlock: Wizard needs reputation 70.`;
  assert.deepEqual(reviewWarnings(entity, g, bookOf(entity), entity.factionRep, ROLL), [falls]);
  assert.equal(rankNeedsLines(entity, g, bookOf(entity), entity.factionRep, ROLL)[0], falls);
  assert.deepEqual(affiliations(entity)[0].warnings, [falls]);
  assert.deepEqual(reviewWarnings(entity, g, bookOf(entity), entity.factionRep, { ...ROLL, now: day(10) }), [`Your review ${when(19)} lowers you to Warlock: Wizard needs reputation 70.`], 'stamped day 1: due day 29');
  assert.deepEqual(reviewWarnings(entity, g, bookOf(entity), entity.factionRep, { ...ROLL, now: day(28) }), [`Your review ${when(1)} lowers you to Warlock: Wizard needs reputation 70.`]);
  setReputation(entity.factionRep, MAGES, 45);
  assert.deepEqual(reviewWarnings(entity, g, bookOf(entity), entity.factionRep, ROLL), [`Your review ${when(0)} lowers you to Magician: Wizard needs reputation 70.`], 'three ranks down, named');
  setReputation(entity.factionRep, MAGES, 70);
  assert.deepEqual(reviewWarnings(entity, g, bookOf(entity), entity.factionRep, ROLL), [], 'at the line: nothing');
  // a chair's holder at its own hall: the review reads the book (7), never the chair's 9 - nothing falls
  setReputation(entity.factionRep, MAGES, 75);
  assert.equal(rankNeedsLines(entity, g, seatedBook(bookOf(entity), membershipKey(g), 9), entity.factionRep, { ...ROLL, book: bookOf(entity) }), null);
});

test('AUDIT GUILD-WORDS II E-5: a fall to rank 0 is said; a fall the skills make says no reputation, the reputation\'s line read at its boundary (mutants: the fall to 0 unsaid, the reason always the reputation, < as <=)', () => {
  const g = GUILDS.MagesGuild;
  const at = (rep, skill) => memberAt(g, 7, {}, { factionRep: storeOf({ [MAGES]: { rep } }), skills: skilled(g, skill).skills });
  const w = (e) => reviewWarnings(e, g, bookOf(e), e.factionRep, ROLL);
  assert.deepEqual(w(at(5, 90)), [`Your review ${when(0)} lowers you to Apprentice: Wizard needs reputation 70.`]);
  assert.deepEqual(w(at(75, 30)), [`Your review ${when(0)} lowers you to Journeyman.`], 'the skills alone');
  const skillsFall = at(75, 30);
  assert.deepEqual(reviewWarnings(skillsFall, g, bookOf(skillsFall), skillsFall.factionRep, { ...ROLL, now: day(10) }), [`Your review ${when(19)} lowers you to Journeyman.`], 'with its days');
  assert.deepEqual(w(at(70, 30)), [`Your review ${when(0)} lowers you to Journeyman.`], 'at 70 the reputation is met');
  assert.deepEqual(w(at(69, 30)), [`Your review ${when(0)} lowers you to Journeyman: Wizard needs reputation 70.`]);
});

test('AUDIT GUILD-WORDS L1-3, L1-4, L1-7, II A-6, C-7: a probation as its review will rule it - the days to the hall, the renewal and the end, online sooner by a promotion; a guild that never expels ends it; skills short of a member\'s hold it whatever the standing; said where no next rank is (mutants: each kind, the days, the online arm, the raw book)', () => {
  const g = GUILDS.MagesGuild;
  const store = storeOf({ [MAGES]: { rep: -20 } });
  const entity = memberAt(g, 0, { probation: true, lastRankChange: daySinceZero(day(10)) }, { factionRep: store, skills: skilled(g, 40).skills });
  const m = membershipOf(bookOf(entity), g);
  assert.deepEqual([reviewDaysLeft(m, day(30)), reviewDaysLeft(m, day(40))], [8, 0]);
  assert.equal(probationWords(8), 'On probation: your review is at the guild\'s hall in 8 days or later. Below -10 you are expelled there, below 0 it runs 28 days more, and at 0 or more it ends.');
  assert.equal(probationWords(1), 'On probation: your review is at the guild\'s hall in 1 day or later. Below -10 you are expelled there, below 0 it runs 28 days more, and at 0 or more it ends.');
  assert.equal(probationWords(8, 'expel', true), 'On probation: your review is at the guild\'s hall in 8 days or later - sooner if you earn the next rank. Below -10 you are expelled there, below 0 it runs 28 days more, and at 0 or more it ends.');
  assert.equal(probationWords(0), 'On probation: your review is at your next visit to the guild\'s hall. Below -10 you are expelled there, below 0 it runs 28 days more, and at 0 or more it ends.');
  assert.equal(probationWords(0, 'expel', true), probationWords(0), 'the next visit is the next visit');
  assert.deepEqual(reviewWarnings(entity, g, bookOf(entity), store, { now: day(30) }), [probationWords(8)]);
  assert.deepEqual(reviewWarnings(entity, g, bookOf(entity), store, { now: day(30), online: true }), [probationWords(8, 'expel', true)]);
  assert.deepEqual(affiliations(entity, { now: day(30) })[0].warnings, [probationWords(8)], 'the Standing page\'s days (II E-6)');
  assert.deepEqual(affiliations(entity, { now: day(30), online: true })[0].warnings, [probationWords(8, 'expel', true)]);
  const lines = rankNeedsLines(entity, g, bookOf(entity), store, { now: day(30) });
  assert.deepEqual(lines.slice(0, 2), [probationWords(8), 'Next rank: Journeyman']);
  assert.equal(rankNeedsLines(entity, g, bookOf(entity), store, { now: day(30), pace: PACE })[0], probationWords(8, 'expel', true), 'the hall online, while the Roll paces');
  setReputation(store, MAGES, 20);   // mended, the review not yet run: nothing short, the probation still said
  assert.deepEqual(rankNeedsLines(entity, g, bookOf(entity), store, { now: day(30) }), [probationWords(8)]);
  const skillsWords = (d) => `On probation: your guild skills are short of a member's. Your review is ${when(d)}: below -10 you are expelled, and it ends only once one skill reaches 22, a second 4, and your standing is 0 or more.`;
  const weak = memberAt(g, 0, { probation: true }, { factionRep: store, skills: skilled(g, 3).skills });
  assert.deepEqual(reviewWarnings(weak, g, bookOf(weak), store), [skillsWords(0)]);
  assert.deepEqual(reviewWarnings(weak, g, bookOf(weak), store, { now: day(20) }), [skillsWords(9)]);
  assert.equal(probationWords(1, 'skills'), skillsWords(1));
  const tg = GUILDS.ThievesGuild;
  const thief = memberAt(tg, 3, { probation: true }, { factionRep: storeOf({ [tg.factionId]: { rep: -5 } }), skills: skilled(tg, 40).skills });
  assert.equal(reviewWarnings(thief, tg, bookOf(thief), thief.factionRep)[0], 'On probation: it ends at your next review, at the guild\'s hall.');
  setUnderworldRule((name) => (name === tg.name ? {} : null));   // Roleplay & Realism's ThievesGuildRR: it expels (II E-4)
  assert.equal(reviewWarnings(thief, tg, bookOf(thief), thief.factionRep)[0], probationWords(0));
  setUnderworldRule(null);
  const seatHolder = memberAt(g, 7, { probation: true }, { factionRep: storeOf({ [MAGES]: { rep: -3 } }), skills: skilled(g, 90).skills });
  const seated = seatedBook(bookOf(seatHolder), membershipKey(g), 9);
  assert.equal(rankNeedsLines(seatHolder, g, seated, seatHolder.factionRep, { ...ROLL, book: bookOf(seatHolder) })?.[0], probationWords(null), 'a chair\'s hall: the probation still said');
});

test('AUDIT GUILD-WORDS II E-4: the kind reads rank 0\'s bars - no skill at the high bar, or fewer than two at the low, hold it; a rank-7 probationer with rank 0\'s skills is told the standing\'s stakes (mutants: the high alone, the sum alone, the rank\'s own bars)', () => {
  const g = GUILDS.MagesGuild;
  const store = storeOf({ [MAGES]: { rep: -3 } });
  const kindOf = (skills, rank = 0) => {
    const e = memberAt(g, rank, { probation: true }, { factionRep: store, skills });
    return reviewWarnings(e, g, bookOf(e), store)[0].startsWith('On probation: your guild skills') ? 'skills' : 'expel';
  };
  const [a, b, ...rest] = g.skills;
  assert.equal(kindOf({ [a]: 10, [b]: 10, ...Object.fromEntries(rest.map((s) => [s, 0])) }), 'skills', 'two at the low bar, none at the high');
  assert.equal(kindOf({ [a]: 30, ...Object.fromEntries([b, ...rest].map((s) => [s, 0])) }), 'skills', 'one at the high bar, no second');
  assert.equal(kindOf({ [a]: 30, [b]: 4 }), 'expel', 'one high, a second at 4');
  assert.equal(kindOf(skilled(g, 40).skills, 7), 'expel', 'rank 0\'s bars, not rank 7\'s');
});

test('AUDIT GUILD-WORDS II A-7: a probation the next review begins is warned, with when - below 0, or the guild skills short of a member\'s; a guild that never expels says the fall to rank 0 instead (mutants: the start unsaid, the reason, the days)', () => {
  const g = GUILDS.MagesGuild;
  const e = memberAt(g, 2, {}, { factionRep: storeOf({ [MAGES]: { rep: -5 } }), skills: skilled(g, 40).skills });
  const below = (d) => `Your review ${when(d)} puts you on probation: your standing is below 0.`;
  assert.deepEqual(reviewWarnings(e, g, bookOf(e), e.factionRep), [below(0)]);
  assert.deepEqual(reviewWarnings(e, g, bookOf(e), e.factionRep, { now: day(10) }), [below(19)]);
  assert.equal(rankNeedsLines(e, g, bookOf(e), e.factionRep, { now: day(10) })[0], below(19), 'first in the hall\'s line');
  const weak = memberAt(g, 2, {}, { factionRep: storeOf({ [MAGES]: { rep: 25 } }), skills: skilled(g, 3).skills });
  assert.deepEqual(reviewWarnings(weak, g, bookOf(weak), weak.factionRep), [`Your review ${when(0)} puts you on probation: your guild skills are short of a member's.`]);
  const tg = GUILDS.ThievesGuild;
  const thief = memberAt(tg, 3, {}, { factionRep: storeOf({ [tg.factionId]: { rep: -5 } }), skills: skilled(tg, 40).skills });
  assert.deepEqual(reviewWarnings(thief, tg, bookOf(thief), thief.factionRep), [`Your review ${when(0)} lowers you to Apprentice: Crook needs reputation 30.`]);
});

test('AUDIT GUILD-WORDS II E-12: an unstamped membership is due now; no store, no line and no throw (mutants: the unread stamp a wait, the store unguarded)', () => {
  assert.equal(reviewDaysLeft({ rank: 2 }, day(30)), 0);
  const g = GUILDS.MagesGuild;
  const e = memberAt(g, 2, {}, { skills: skilled(g, 40).skills });
  assert.deepEqual(reviewWarnings(e, g, bookOf(e), null), []);
  assert.equal(rankNeedsLines(e, g, bookOf(e), null, { now: day(30) }), null);
});

// ── THE WORDS ───────────────────────────────────────────────────────

test('SEAT-WORDS: the tutorial and the notice board\'s guide say the law - a review\'s 7, the chairs\' 8 and 9, a quest\'s pace in real days and the UTC day, a chair\'s services at its own halls, a chapter writ\'s 2 and a receipt\'s 1 beyond the pace (mutants: a number not the law\'s)', () => {
  const guilds = tutorialById('guilds');
  assert.deepEqual([guilds.title, guilds.trigger, guilds.body], ['Guilds', 'When you first visit a guild.',
    ['Join a guild for its services and its work. Do that work and practice the skills it teaches to rise in rank.', 'You may join one temple, one knightly order, and as many guilds as will have you.']]);
  assert.deepEqual(guilds.points, ['Online, reviews promote you no further than rank 7. Ranks 8 and 9 are chapter chairs; see Guild Chapters.']);   // VOICE1 (PIN MOVED)
  const ch = tutorialById('chapters');
  assert.deepEqual([ch.group, ch.title], ['online', 'Guild Chapters']);
  assert.deepEqual(ch.body, ['Online, quests raise your standing with each guild by at most 15 a real day (days start at midnight UTC). Any more is added on later days.',
    'Reviews promote you up to rank 7. Ranks 8 and 9 are chapter chairs, won by Merit at each Sunday\'s Turning. A notice board explains chapters.']);   // VOICE1 (PIN MOVED)
  const guide = Object.fromEntries(chapterGuide());
  assert.equal(guide['Your rank'], 'Your guild still promotes you as usual, up to rank 7. Ranks 8 and 9 are the chairs (see below). A chair\'s services are at its own chapter\'s halls, for members at rank 7.');
  assert.equal(guide.Standing, 'Your standing with each of these guilds is kept online. Quests raise it by at most 15 a real day for each guild (days start at midnight UTC), and any more is paid on later days. On top of that, a chapter writ (yours or the chapter\'s) adds 2, and closing a Breach or defending a town adds 1 to each of your guilds with a chapter there (2 more for the first each day, if the chapter asks for it).');
  assert.match(guide.Merit, /after 7 real days in the guild,/);
  assert.match(guide['The chairs'], /A member needs 14 real days in the guild, enough standing for rank 8 and an account 7 real days old\./);
});

test('AUDIT GUILD-WORDS II B-6, F-7: a language\'s own list joins the line (no comma before its "and"); the Guilds page is the player\'s language whole, not English around a translated point (mutants: the list joined bare, a page row left English)', () => {
  const was = tm.currentLocale();
  const entity = memberAt(GUILDS.MagesGuild, 2, {}, memberAt(GUILDS.FightersGuild, 1, {}, { factionRep: storeOf({ [MAGES]: { name: 'The Mages Guild', rep: 35 } }) }));
  try {
    tm.setLocale('de');
    assert.match(standingLine(entity, [{ f: MAGES, delta: 5, now: 35, owed: 0 }, { f: FIGHTERS, delta: -25, now: -20, owed: 0 }]), / und /);
    tm.setLocale(tm.PSEUDO_LOCALE);
    const page = tutorialById('guilds');
    for (const [shown, english] of [[page.title, 'Guilds'], [page.trigger, 'When you first visit a guild.'], [page.body[0], 'Join a guild for its services and its work. Do that work and practice the skills it teaches to rise in rank.'], [page.body[1], 'You may join one temple, one knightly order, and as many guilds as will have you.']]) {
      assert.notEqual(shown, english, `"${english}" drawn in the player's language`);
    }
  } finally { tm.setLocale(was); }
});

test('STANDING-WORDS: the Standing page draws the review\'s warnings and the owed under the guild, in the law\'s numbers; nothing owed, no note (mutants: each note, the pace, the owed\'s number, an owed of 0 drawn - II E-7)', async () => {
  const { statsGuilds } = await import('../../src/ui/enhanced/enhancedMenu.js');
  const make = (tag) => ({ tag, className: '', textContent: '', children: [], append(...c) { this.children.push(...c); } });
  globalThis.document = { createElement: make };
  try {
    const g = GUILDS.FightersGuild;
    const entity = memberAt(g, 1, { probation: true }, { factionRep: storeOf({ [FIGHTERS]: { name: 'The Fighters Guild', rep: -3 } }), skills: skilled(g, 40).skills });
    setStandingOwed({ [FIGHTERS]: 6 });
    const notesOf = (e) => {
      const detail = make('div');
      statsGuilds(detail, e);
      return detail.children.filter((c) => c.className === 'px-note').map((c) => c.textContent);
    };
    const notes = notesOf(entity);
    assert.equal(notes.length, 2);
    assert.match(notes[0], /^On probation: your review is at /);
    assert.equal(notes[1], '6 more standing on the way, at most 15 a real day (days turn at midnight UTC).');
    setStandingOwed(null);
    const steady = memberAt(g, 1, {}, { factionRep: storeOf({ [FIGHTERS]: { name: 'The Fighters Guild', rep: 14 } }), skills: skilled(g, 40).skills });
    assert.deepEqual(notesOf(steady), [], 'nothing owed, nothing warned: no note');
  } finally { delete globalThis.document; }
});

test('AUDIT GUILD-WORDS II F-1, F-2: the classic window\'s refusal wraps on the screen; the enhanced hall\'s line scrolls in its own well, the actions under it in view (mutants: the box unfitted, the well unscrolled)', () => {
  const font = { fnt: { fixedHeight: 7, fixedWidth: 5, glyphWidth: () => 4 } };   // ss1_stones' five pixels a glyph
  assert.ok(layoutMessageBox(font, latchBoxRows({ rows: [SEAT] })).w > 320, 'left whole, the chair\'s refusal ran past both edges');
  const laid = layoutMessageBox(font, fitBoxRows(font, latchBoxRows({ rows: [SEAT] })));
  assert.ok(laid.w <= 320 && laid.x >= 0, `fitted, ${laid.w} wide at ${laid.x}`);
  assert.ok(src('src/ui/guildServiceWindow.js').includes('this._box = layoutMessageBox(font, fitBoxRows(font, latchBoxRows(top, this.hooks.rows)), buttons);'));
  assert.ok(src('src/ui/enhanced/enhancedPort.js').includes("const n = el(doc, 'div', `port-text${b.center ? ' center' : ''}${b.scroll ? ' scroll' : ''}`);"));
  const css = src('src/ui/enhanced/enhancedPortStyle.js');
  assert.match(css, /\.port-text\.scroll \{ flex: none; max-height: min\(34dvh, 240px\); overflow-y: auto; display: flex; flex-direction: column; gap: 6px;/);
  assert.match(css, /@media \(max-height: 480px\) \{ \.port-text\.scroll \{ max-height: 20dvh; \} \}/, 'a phone on its side: a shorter well');
});

test('SEAT-WORDS / STANDING-WORDS: the hosts - the gate and the house take the book\'s ceiling, the hall\'s line the character\'s date and the review\'s book, the Standing page the online flag, the streets\' tracker the module\'s doors through a lazy chat door and no door of its own over them, in any shape (mutants: each seam, a door overridden - II E-11)', () => {
  const wm = src('src/scenes/worldModes.js');
  assert.ok(wm.includes('const access = serviceAccess(guild, membershipOf(seated(), guild), service, { rankCeiling: host.rollPace?.(guild.factionId)?.book ?? null });'));
  assert.ok(wm.includes('const decision = receiveHouseDecision(kept, { rankCeiling: host.rollPace?.(guild.factionId)?.book ?? null,'));
  assert.ok(wm.includes('rankNeedsLines(playerEntity, guild, seated(), store, { rankCeiling: pace?.book ?? null, pace, now: ownDate(), book: memberships })'));
  const w = src('src/scenes/world.js');
  const start = w.indexOf('const rollTracker = onlineOn && realmSession ? createRollTracker({');
  const call = w.slice(start, w.indexOf('}) : null;', start));
  assert.ok(start > 0 && call.includes('...rollNoticeDoors({ entityOf: () => playerEntity, say: (text) => chatNotice(text) }),'));
  assert.doesNotMatch(call.slice(call.indexOf('...rollNoticeDoors(')), /['"]?\bon(Capped|Standing|Ceiling|Full)['"]?\s*[:(]/, 'no door of the host\'s own after the module\'s');
  assert.doesNotMatch(call, /['"]?\bon(Ceiling|Full)['"]?\s*[:(]/, 'the pace\'s lines are the module\'s alone');
  assert.ok(src('src/ui/enhanced/enhancedMenu.js').includes('const book = affiliations(entity, { now: dateFromClassicMinutes(Math.floor(ownMinutes())), online: isOnlinePage() });'));
});
