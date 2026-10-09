// CHAP2b (2026-10-08, Mac: "Keep going with the arc/slices") - THE RECEIPTS' STANDING AND THE RECEIPT WRITS: a gate
// closed or a raided town defended by a realm character, in a region where a guild it is a member of on the Roll keeps
// a chapter, is remembered - +1 a guild a receipt (Chapters-Arc 3.3), and +2 more for that chapter's receipt writ, its
// first such receipt of the UTC day there, where the guild's row of section 4 asks that kind. Each member its own; no
// Marks; outside the three a day. bible/11-Multiplayer/Chapters-Arc.md sections 3.3 and 4 (CHAP2b).
//
// The law against literals; the service through the real gate and raid routes over the real migrations; the board's
// asks; the card in a DOM; the host's wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byClass } from './chargenDom.mjs';

import {
  RECEIPT_KINDS, RECEIPT_REP, HALL_WRIT_REP, hallReceiptKindsOf, receiptRef, receiptWritRef, receiptCreditsOf, hallRememberLine,
} from '../src/net/npcChapterLaw.js';
import { creditReceipt, receiptAsks } from '../server-account/src/npcReceipts.js';
import { readRoll } from '../server-account/src/npcRoll.js';
import { forgetChapters } from '../server-account/src/npcHalls.js';
import { mintRaidReceipt } from '../src/net/raidReceipt.js';
import { mintReceipt } from '../src/net/gateReceipt.js';
import { gameDayAt } from '../src/net/gateLaw.js';   // AUDIT CHAP3 E1: a gate's day is the game's, never the calendar's
import { mountNoticeBoard } from '../src/ui/noticeWindow.js';
import { materialCountLabel } from '../src/systems/profItems.js';
import { utcDay } from '../src/net/marksLaw.js';
import { standService, T0 } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DAY = 86_400, ANTICLERE = 21;
const subtle = globalThis.crypto.subtle;

// ── THE LAW ─────────────────────────────────────────────────────────

test('CHAP2b the asks by section 4\'s table: the Fighters a raid and a gate, the Mages a gate, the Brotherhood both, the temples a gate, the orders both, the Thieves Guild none (mutants: a row moved)', () => {
  assert.deepEqual([...RECEIPT_KINDS], ['gate', 'raid']);
  assert.deepEqual([41, 40, 42, 108, 21, 35, 368, 417, 510].map(hallReceiptKindsOf), [
    ['gate', 'raid'], ['gate'], [], ['gate', 'raid'], ['gate'], ['gate'], ['gate', 'raid'], ['gate', 'raid'], [],
  ]);
  assert.equal(RECEIPT_REP, 1);
  assert.equal(HALL_WRIT_REP, 2);
  assert.equal(receiptRef('gate', 20000), 'gate:20000');
  assert.equal(receiptRef('raid', '21:7:20000'), 'raid:21:7:20000');
  assert.equal(receiptWritRef('raid', 20000), 'wraid:20000');
});

test('CHAP2b what one receipt credits: +1 each member guild with a chapter where it stood, +2 more for that day\'s writ where the guild asks the kind - never a guild it is no member of, nor one with no chapter there (mutants: the intersection, the writ, the kind)', () => {
  assert.deepEqual(receiptCreditsOf({ kind: 'gate', id: 20000, day: 20000, members: [41, 40, 42, 21, 510], chapters: [41, 42, 21, 108] }), [
    { faction: 21, ref: 'gate:20000', amount: 1 }, { faction: 21, ref: 'wgate:20000', amount: 2 },
    { faction: 41, ref: 'gate:20000', amount: 1 }, { faction: 41, ref: 'wgate:20000', amount: 2 },
    { faction: 42, ref: 'gate:20000', amount: 1 },
  ]);
  assert.deepEqual(receiptCreditsOf({ kind: 'raid', id: '21:7:20000', day: 20000, members: [40, 41], chapters: [40, 41] }), [
    { faction: 40, ref: 'raid:21:7:20000', amount: 1 },
    { faction: 41, ref: 'raid:21:7:20000', amount: 1 }, { faction: 41, ref: 'wraid:20000', amount: 2 },
  ], 'the Mages ask no raid');
  assert.deepEqual(receiptCreditsOf({ kind: 'serpent', id: 1, day: 20000, members: [41], chapters: [41] }), [], 'a serpent names no region');
  assert.deepEqual(receiptCreditsOf({ kind: 'gate', id: 1, day: 1.5, members: [41], chapters: [41] }), []);
  assert.deepEqual(receiptCreditsOf({ kind: 'gate', id: 1, day: 1, members: [41], chapters: [] }), []);
  assert.deepEqual(receiptCreditsOf({ kind: 'gate', id: 1, day: 1, members: [510, 41], chapters: [510, 41] }), [
    { faction: 41, ref: 'gate:1', amount: 1 }, { faction: 41, ref: 'wgate:1', amount: 2 },
  ], 'the twenty-two alone, whatever a caller names');
});

test('CHAP2b the line a credit says: the guilds by name, "and" before the last (mutants: the join)', () => {
  assert.equal(hallRememberLine([41]), 'The Fighters Guild will remember it.');
  assert.equal(hallRememberLine([41, 368]), 'The Fighters Guild and the Knights of the Dragon will remember it.');
  assert.equal(hallRememberLine([41, 21, 368, 41]), 'The Fighters Guild, the Temple of Arkay and the Knights of the Dragon will remember it.');
  assert.equal(hallRememberLine([510]), null);
  assert.equal(hallRememberLine([]), null);
});

// ── THE SERVICE ─────────────────────────────────────────────────────

let _now = T0;
const realNow = Date.now;
const clock = (x) => { _now = x; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });

/** A service with a confirmed town of `factions` in Anticlere and a realm character on the Roll with `members`. */
async function stand({ open = 'on', factions = [41, 368, 108], members = [41, 368], reps = { 41: 10, 368: 5, 40: 0 }, extra = {} } = {}) {
  clock(T0);
  forgetChapters();
  const s = await standService({ CHAPTERS_OPEN: open, PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', DEVELOPER_HANDLES: 'Devra,Wit0,Wit1,Wit2', ...extra });   // the witnesses are developers: a town is witnessed at `dev` as at `on`
  const raw = s.env.DB._raw;
  for (let i = 0; i < 3; i++) {
    const w = await s.registered(`Wit${i}`);
    raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(_now - 8 * DAY, w.id);
    clock(_now + 1);
    assert.equal((await s.call('/v1/chapters/witness', { hall: { key: 77, region: ANTICLERE, factions } }, w.secret)).status, 200);
  }
  const who = await s.registered('Rolla');
  const R = await seatRealm(s.env, who.secret, 'Rolla');
  await readRoll({ db: s.env.DB, nowS: _now }, { id: who.id }, { character: R.id, lease: R.lease, seed: { factions: reps, members: members.map((f) => ({ f, rank: 0 })) } });
  const rep = (f) => raw.prepare('SELECT rep, owed FROM npc_roll WHERE char_id = ? AND faction_id = ?').get(R.id, f);
  const credits = () => raw.prepare('SELECT faction_id AS f, ref, amount FROM npc_receipt_credits ORDER BY faction_id, ref').all().map((r) => ({ ...r }));
  const gate = async (day = gameDayAt(_now * 1000), region = ANTICLERE, character = R.id, by = who) => s.call('/v1/gate/claim', {
    receipt: await mintReceipt({ d: day, b: 'ruhn', s: by.id, c: 4242, x: 'dealt' }, s.gatePriv, { subtle, nowS: _now }), region, character,
  }, by.secret);
  const raid = async (loc, region = ANTICLERE, character = R.id) => s.call('/v1/raid/claim', {
    receipt: await mintRaidReceipt({ w: `${region}:${loc}:${utcDay(_now)}`, s: who.id, c: 777, y: 2 }, s.gatePriv, { subtle, nowS: _now }), character,
  }, who.secret);
  return { ...s, raw, who, R, rep, credits, gate, raid };
}

test('CHAP2b a gate closed: +1 to each of the character\'s guilds with a chapter where it stood, +2 more for the day\'s writ where the guild asks a gate - in the gate claim\'s own answer, the claim\'s own row first (mutants: the route\'s credit, the head)', async () => {
  const s = await stand();
  const seq0 = s.raw.prepare('SELECT seq, kseq FROM npc_roll_heads WHERE char_id = ?').get(s.R.id);
  const g = await s.gate();
  assert.equal(g.status, 200, JSON.stringify(g.body));
  assert.equal(g.body.recorded, true);
  assert.deepEqual(g.body.chapters, { counted: true, credited: [{ f: 41, amount: 3 }, { f: 368, amount: 3 }], merit: [] });   // PIN MOVED (CHAP3a: and its Merit - none inside a new member's week)
  assert.deepEqual([s.rep(41).rep, s.rep(368).rep, s.rep(108).rep], [13, 8, 0], 'a Brotherhood chapter there - but no member');
  const day = utcDay(_now), gday = gameDayAt(_now * 1000);   // PIN MOVED (AUDIT CHAP3 E1): the gate's own day, the writ's UTC day
  assert.deepEqual(s.credits(), [
    { f: 41, ref: `gate:${gday}`, amount: 1 }, { f: 41, ref: `wgate:${day}`, amount: 2 },
    { f: 368, ref: `gate:${gday}`, amount: 1 }, { f: 368, ref: `wgate:${day}`, amount: 2 },
  ]);
  const seq1 = s.raw.prepare('SELECT seq, kseq FROM npc_roll_heads WHERE char_id = ?').get(s.R.id);
  assert.deepEqual([seq1.seq, seq1.kseq], [seq0.seq + 1, seq0.kseq], 'the guard moved; the claim sequence did not (AUDIT CHAP2 C1)');
  // claimed again: the claim's own row says so, and nothing more is credited
  const again = await s.gate();
  assert.deepEqual([again.body.recorded, again.body.why, again.body.chapters], [false, 'claimed', undefined]);
  assert.equal(s.rep(41).rep, 13);
});

test('CHAP2b raids: the town defended credits by its key\'s region; the day\'s writ once a member a day, the receipt\'s own +1 every raid (mutants: the writ\'s day, the raid\'s region)', async () => {
  const s = await stand();
  const a = await s.raid(7);
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.deepEqual(a.body.chapters, { counted: true, credited: [{ f: 41, amount: 3 }, { f: 368, amount: 3 }], merit: [] });   // PIN MOVED (CHAP3a)
  const b = await s.raid(8);
  assert.deepEqual(b.body.chapters, { counted: true, credited: [{ f: 41, amount: 1 }, { f: 368, amount: 1 }], merit: [] }, 'the day\'s writ is filled: the receipt\'s own +1');   // PIN MOVED (CHAP3a)
  assert.deepEqual([s.rep(41).rep, s.rep(368).rep], [14, 9]);
  const elsewhere = await s.raid(9, 17);
  assert.deepEqual(elsewhere.body.chapters, { counted: false, why: 'no-chapter' }, 'Daggerfall keeps no chapter of its guilds');
});

test('CHAP2b nothing credited: a non-member, no chapter where it stood, the Chapters shut, a gate with no region named - the claim stands each time (mutants: the members, the switch)', async () => {
  const s = await stand({ members: [] });
  const g = await s.gate();
  assert.deepEqual([g.body.recorded, g.body.chapters], [true, { counted: false, why: 'no-member' }]);
  const t = await stand({ factions: [40] });
  assert.deepEqual((await t.gate()).body.chapters, { counted: false, why: 'no-chapter' });
  const shut = await stand({ open: 'dev' });
  const r = await shut.gate();
  assert.equal(r.body.recorded, true);
  assert.deepEqual(r.body.chapters, { counted: false, why: 'chapters-closed' });
  const u = await stand();
  const noRegion = await u.call('/v1/gate/claim', { receipt: await mintReceipt({ d: gameDayAt(_now * 1000), b: 'ruhn', s: u.who.id, c: 4242, x: 'dealt' }, u.gatePriv, { subtle, nowS: _now }), character: u.R.id }, u.who.secret);
  assert.deepEqual([noRegion.body.recorded, noRegion.body.chapters], [true, undefined], 'no region: no chapter\'s');
});

test('CHAP2b the credit\'s bounds: never past 100, what is owed trimmed; never another account\'s character nor a dead one; a receipt credited once (mutants: the cap, the owed, the player, the death, the stood lines)', async () => {
  const s = await stand({ reps: { 41: 99, 368: 5 } });
  s.raw.prepare('UPDATE npc_roll SET owed = 4 WHERE char_id = ? AND faction_id = 41').run(s.R.id);
  await s.gate();
  assert.deepEqual({ ...s.rep(41) }, { rep: 100, owed: 0 });
  const ctx = { db: s.env.DB, nowS: _now };
  const env = { CHAPTERS_OPEN: 'on' };
  assert.deepEqual(await creditReceipt(ctx, { id: s.who.id }, env, { character: s.R.id, kind: 'gate', id: gameDayAt(_now * 1000), region: ANTICLERE }), { counted: false, why: 'credited' });
  const mallory = await s.registered('Mallory');
  assert.deepEqual(await creditReceipt(ctx, { id: mallory.id }, env, { character: s.R.id, kind: 'raid', id: '21:3:1', region: ANTICLERE }), { counted: false, why: 'no-member' });
  s.raw.prepare('UPDATE realm_characters SET dead_at = ? WHERE id = ?').run(_now, s.R.id);
  assert.deepEqual(await creditReceipt(ctx, { id: s.who.id }, env, { character: s.R.id, kind: 'raid', id: '21:4:1', region: ANTICLERE }), { counted: false, why: 'no-member' });
  for (const [body, why] of [[{ character: s.R.id, kind: 'serpent', id: 1, region: ANTICLERE }, 'no-receipt'], [{ character: s.R.id, kind: 'gate', id: 1, region: 62 }, 'no-region']]) {
    assert.deepEqual(await creditReceipt(ctx, { id: s.who.id }, env, body), { counted: false, why }, why);
  }
  const throws = { prepare: () => { throw new Error('D1 down'); } };
  assert.deepEqual(await creditReceipt({ db: throws, nowS: _now }, { id: s.who.id }, env, { character: s.R.id, kind: 'gate', id: gameDayAt(_now * 1000), region: ANTICLERE }), { counted: false, why: 'server' });   // PIN MOVED (AUDIT CHAP3 E1): a gate of this week, so the store is asked
});

test('CHAP2b a lost race: a credit whose head moved before its write credits nothing and says so - the Roll\'s one guard (mutants: the tag)', async () => {
  const s = await stand();
  const racing = { prepare: (sql) => s.env.DB.prepare(sql), batch: async (list) => { s.raw.prepare("UPDATE npc_roll_heads SET tag = 'other' WHERE char_id = ?").run(s.R.id); return s.env.DB.batch(list.slice(1)); } };
  const r = await creditReceipt({ db: racing, nowS: _now }, { id: s.who.id }, { CHAPTERS_OPEN: 'on' }, { character: s.R.id, kind: 'raid', id: '21:5:1', region: ANTICLERE });
  assert.deepEqual(r, { counted: false, why: 'busy' });
  assert.deepEqual([s.rep(41).rep, s.credits()], [10, []]);
});

test('CHAP2b the board\'s asks: each chapter\'s by its guild\'s row, a member\'s own state, a hidden guild\'s to its members alone, none while the Chapters are shut (mutants: the kinds, the hidden rule, the done)', async () => {
  const s = await stand({ factions: [41, 40, 42, 108] });
  const asks = async (who = s.who, character = s.R.id) => (await s.call('/v1/writs/list', { character, region: ANTICLERE }, who.secret)).body.receipts;
  assert.deepEqual(await asks(), [
    { faction: 40, kind: 'gate', member: false, done: false },
    { faction: 41, kind: 'gate', member: true, done: false }, { faction: 41, kind: 'raid', member: true, done: false },
  ], 'the Thieves Guild asks none; the Brotherhood\'s are its members\' alone');
  await s.gate();
  assert.deepEqual((await asks()).filter((a) => a.faction === 41).map((a) => [a.kind, a.done]), [['gate', true], ['raid', false]]);
  const mac = await s.registered('Mac');
  assert.deepEqual((await asks(mac, mac.character)).map((a) => [a.faction, a.member]), [[40, false], [41, false], [41, false]]);
  assert.deepEqual(await receiptAsks(s.env.DB, { id: s.who.id }, { CHAPTERS_OPEN: 'off' }, s.R.id, ANTICLERE, _now), []);
  const db = await stand({ factions: [108], members: [108], reps: { 108: 0 } });
  assert.deepEqual(await receiptAsks(db.env.DB, { id: db.who.id }, { CHAPTERS_OPEN: 'on' }, db.R.id, ANTICLERE, _now), [
    { faction: 108, kind: 'gate', member: true, done: false }, { faction: 108, kind: 'raid', member: true, done: false },
  ], 'a Brotherhood member sees its chapter\'s contracts');
});

test('CHAP2b a realm character\'s delete takes what its receipts gave (mutants: the delete)', () => {
  const realm = src('server-account/src/realm.js');
  assert.equal((realm.match(/DELETE FROM npc_receipt_credits WHERE player = \? AND char_id = \?/g) ?? []).length, 2, 'deleteRealm and undoCustoms');
  assert.match(src('server-account/migrations/0095_npc_receipts.sql'), /PRIMARY KEY \(char_id, faction_id, ref\)/);
});

// ── THE BOARD AND THE WIRING ────────────────────────────────────────

test('CHAP2b the ask\'s card: under the guild\'s seal, the gate held or the town defended for the guild, its pay the guild\'s standing, a member\'s state; no Take (mutants: the text, the state)', async () => {
  const tick = () => new Promise((r) => setImmediate(r));
  const receipts = [
    { faction: 41, kind: 'gate', member: true, done: true }, { faction: 41, kind: 'raid', member: true, done: false },
    { faction: 368, kind: 'raid', member: false, done: false },
  ];
  const book = { state: { open: true, writs: { today: 0, max: 3 } }, held: () => 0,
    writs: async () => ({ data: { writs: [], receipts, today: { filled: 0, max: 3 } }, error: null, stale: false }), deliver: async () => ({ ok: true, data: {} }) };
  const notices = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen() {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }) };
  const host = document.createElement('div');
  mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 5 }, book: notices, work: { book, region: 21, regionName: 'Anticlere', countName: (k, n) => materialCountLabel(k, n) } });
  await tick();
  byClass(host, 'notice-tab')[1].click();
  for (let i = 0; i < 3; i++) await tick();
  const cards = byClass(host, 'notice-writ');
  assert.equal(cards.length, 3);
  assert.deepEqual(cards.map((c) => byClass(c, 'writ-need')[0].textContent), [
    'Hold the gate in Anticlere, for the Fighters Guild', 'Defend a raided town of Anticlere, for the Fighters Guild',
    'Defend a raided town of Anticlere, for the Knights of the Dragon',
  ]);
  assert.deepEqual(cards.map((c) => byClass(c, 'writ-left')[0].textContent), ['Done today', 'Your next one here fills it', 'For members of the Knights of the Dragon']);
  assert.equal(byClass(cards[0], 'writ-pay')[0].textContent, 'Pays standing with the Fighters Guild, once a day a member');
  assert.ok(cards.every((c) => c.className.includes('seal-guild')) && cards[0].className.includes('done'));
  assert.equal(byClass(host, 'notice-take').length, 0, 'no Take: the receipt is the relay\'s');
});

test('CHAP2b the wiring: both routes credit after the receipt\'s row, the raid by its key\'s region; the board lists the asks; the host refreshes the Roll and says the guilds\' memory on a credited claim (mutants: the routes, the refresh)', () => {
  const index = src('server-account/src/index.js');
  assert.match(index, /if \(r\.recorded && !r\.rite && body\.region != null\) answer\.chapters = await creditReceipt\(ctx, who\.player, env, \{ character: body\.character \?\? null, kind: 'gate', id: r\.day, region: body\.region \}\);/);
  assert.match(index, /answer\.chapters = await creditReceipt\(ctx, who\.player, env, \{ character: body\.character \?\? null, kind: 'raid', id: r\.key, region: contractRegionOfRaid\(r\.key\) \}\);/);
  assert.match(src('server-account/src/professions.js'), /receipts: await receiptAsks\(db, player, env, character, region, nowS\),/);
  const world = src('src/scenes/world.js');
  // PIN MOVED (AUDIT CHAP3 C8: and the Merit its chapters counted it)
  assert.match(world, /if \(c\?\.counted\) \{\n\s+rollTracker\?\.refresh\(\);\n(?:\s+\/\/[^\n]*\n)*\s+const merit = \(c\.merit \?\? \[\]\)\.reduce\(\(n, \/\*\* @type \{any\} \*\/ x\) => n \+ \(Number\(x\?\.amount\) \|\| 0\), 0\);\n\s+const line = hallRememberLine\(\(c\.credited \?\? \[\]\)\.map\(\(x\) => x\.f\), merit\);\n\s+if \(line\) chatNotice\(line\);/);
  // PIN MOVED (AUDIT CHAP3 C3: a kept gate claim waits for the gate's scan; C4: a raid's said on the fighting character's page)
  assert.match(world, /claim: \(r\) => \(gateClaimReady\(\) \? _accountGates\.claim\(r, gateSeatWord\(r\)\)\.then\(rollHeard\) : Promise\.resolve\(\{ ok: false, error: 'offline' \}\)\),/);
  assert.match(world, /claim: \(r, ch, \.\.\.a\) => _accountRaids\.claim\(r, ch, \.\.\.a\)\.then\(\(x\) => \(ch === characterIdOf\(playerEntity\) \? rollHeard\(x\) : x\)\),/);
  assert.match(src('src/ui/noticeWindow.js'), /for \(const a of writs\?\.receipts \?\? \[\]\) grid\.append\(receiptNode\(a\)\);/);
});
