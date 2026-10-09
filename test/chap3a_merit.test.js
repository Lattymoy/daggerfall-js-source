// CHAP3a (2026-10-08, Mac: "Keep going with the arc/slices") - MERIT: what a member did for its chapter this week, from
// witnessed acts alone - its OWN writ for the chapter (one a member a chapter a day, drawn over the character, its
// owner's alone, inside the account's three a day, paid as a hall writ) filled with its own units, and a receipt in the
// chapter's region. 100 a writ for its own units' share, 50 a receipt; after seven days in the guild; one chapter of a
// guild an account a week; 600 an account a chapter a week. bible/11-Multiplayer/Chapters-Arc.md section 5.1 (CHAP3a).
//
// The law against literals; the service through the real board, gate and raid routes over the real migrations; the
// Merit line's every bound against the real schema; the card in a DOM; the host's wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byClass } from './chargenDom.mjs';

import {
  MERIT_WRIT, MERIT_RECEIPT, MERIT_TENURE_S, MERIT_CAP_WEEK, MERIT_SOURCES, MEMBER_WRIT_SALT, meritWeekOf, meritOfWrit,
  memberWritId, memberWrit, hallWrits, isChapterWrit, meritLineOf, hallFamiliesOf,
} from '../src/net/npcChapterLaw.js';
import { seatWeekOf } from '../src/net/townSeatLaw.js';
import { regionWritTable, courtWrits, material, daySeason, herbPatches, nodeKey } from '../src/net/nodeLaw.js';
import { meritStatement } from '../server-account/src/npcMerit.js';
import { readRoll } from '../server-account/src/npcRoll.js';
import { forgetChapters } from '../server-account/src/npcHalls.js';
import { mintRaidReceipt } from '../src/net/raidReceipt.js';
import { mintReceipt } from '../src/net/gateReceipt.js';
import { gameDayAt } from '../src/net/gateLaw.js';   // AUDIT CHAP3 E1: a gate's day is the game's
import { mountNoticeBoard } from '../src/ui/noticeWindow.js';
import { materialCountLabel } from '../src/systems/profItems.js';
import { sharedClassicMinutes } from '../src/net/wire.js';
import { utcDay } from '../src/net/marksLaw.js';
import { standService, T0 } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DAY = 86_400, WOODS = 231, ANTICLERE = 21;
const subtle = globalThis.crypto.subtle;
const RA = 'r0123456789abcdef0123', RB = 'rfedcba9876543210fedc';

// ── THE LAW ─────────────────────────────────────────────────────────

test('CHAP3a Merit\'s numbers: 100 a member\'s own writ, 50 a receipt, seven days in the guild, 600 an account a chapter a week; the seats\' week (mutants: each number, the week)', () => {
  assert.deepEqual([MERIT_WRIT, MERIT_RECEIPT, MERIT_TENURE_S, MERIT_CAP_WEEK], [100, 50, 7 * DAY, 600]);
  assert.deepEqual([...MERIT_SOURCES], ['writ', 'gate', 'raid']);
  for (let s = T0; s < T0 + 8 * DAY; s += 1800) assert.equal(meritWeekOf(s), seatWeekOf(s * 1000), String(s));   // every half hour of a week and a day: its turn too
  assert.notEqual(meritWeekOf(T0), meritWeekOf(T0 + 7 * DAY));
  assert.equal(memberWritId(20000, 21, 41, RA), `m:20000:21:41:${RA}`);
  assert.deepEqual(['hall', 'member', 'court', undefined].map(isChapterWrit), [true, true, false, false]);
});

test('CHAP3a a writ\'s Merit is its own units\' share, rounded down - bought units earn none (mutants: the share, the rounding, the bounds)', () => {
  assert.deepEqual([[5, 5], [5, 3], [3, 1], [3, 2], [3, 0], [3, -1], [3, 9], [7, 6]].map(([q, o]) => meritOfWrit(q, o)), [100, 60, 33, 66, 0, 0, 100, 85]);
  assert.deepEqual([[0, 0], [-2, 1], [1.5, 1], [2, 1.5], ['2', 1], [2, null]].map(([q, o]) => meritOfWrit(q, o)), [0, 0, 0, 0, 0, 0]);
});

test('CHAP3a a member\'s own writ: the chapter\'s law over the guild\'s kinds, drawn from the member\'s own dice - its own each member, the same all day, never the Court\'s top slot (mutants: the dice, the kinds, the slot)', () => {
  const table = regionWritTable(ANTICLERE, [{ climate: WOODS, confirmed: true }], 'summer');
  const fam = (w) => material(w.material).family;
  const a = memberWrit(20000, ANTICLERE, 41, RA, table);
  assert.ok(a && a.slot === 0 && a.units >= 1 && a.pay >= 1);
  assert.ok(hallFamiliesOf(41).includes(fam(a)));
  assert.deepEqual(memberWrit(20000, ANTICLERE, 41, RA, table), a, 'the same all day');
  assert.ok(fam(memberWrit(20000, ANTICLERE, 108, RA, table)) === 'herbs', 'the Brotherhood\'s herbs');
  // each member its own dice: across a day's members, never all one writ, and never the hall writs' own draw
  const many = Array.from({ length: 12 }, (_, i) => memberWrit(20000, ANTICLERE, 41, `r${String(i).padStart(4, '0')}${RB.slice(5)}`, table));
  assert.ok(new Set(many.map((w) => JSON.stringify(w))).size > 1, 'its own dice, keyed by the member');
  assert.notDeepEqual(memberWrit(20000, ANTICLERE, 41, RB, table), a);
  const own = table.filter((m) => hallFamiliesOf(41).includes(material(m.material)?.family));
  const top = Math.max(...own.map((m) => m.tier));
  assert.ok(many.every((w) => w.tier < top || own.every((m) => m.tier === top)), 'the day\'s top tier stays the Court\'s (AUDIT CHAP2 E5)');
  assert.deepEqual(Object.keys(a).sort(), Object.keys(courtWrits(20000, ANTICLERE, 2, own)[1]).sort(), 'the Court\'s writ shape');
  assert.notDeepEqual(memberWrit(20000, ANTICLERE, 41, RA, table), hallWrits(20000, ANTICLERE, 41, 1, table)[0] ?? null, 'not the hall writs\' dice');
  assert.equal(MEMBER_WRIT_SALT, 0x3e17);
  for (const [f, c, t] of [[510, RA, table], [41, 'char-x', table], [41, RA.toUpperCase(), table], [41, RA, []], [41, null, table]]) {
    assert.equal(memberWrit(20000, ANTICLERE, f, c, t), null, String(c));
  }
});

test('CHAP3a the board\'s Merit line: the account\'s Merit in the chapter, or why it earns none here (mutants: the order, the days)', () => {
  const now = T0;
  assert.equal(meritLineOf({ faction: 41, merit: 1250, max: 600, elsewhere: false, from: null }, now), 'Merit with the Fighters Guild here this week: 1,250 of 600');
  assert.equal(meritLineOf({ faction: 368, merit: 0, max: 600, elsewhere: true, from: null }, now), 'Your Merit with the Knights of the Dragon this week is another chapter\'s');
  assert.equal(meritLineOf({ faction: 41, merit: 0, max: 600, elsewhere: true, from: now + 3 * DAY - 5 }, now), 'The Fighters Guild counts your Merit after a week in the guild - in 3 days');
  assert.equal(meritLineOf({ faction: 41, merit: 0, max: 600, elsewhere: false, from: now + 60 }, now), 'The Fighters Guild counts your Merit after a week in the guild - tomorrow');
  assert.equal(meritLineOf({ faction: 41, merit: 50, max: 600, elsewhere: false, from: now }, now), 'Merit with the Fighters Guild here this week: 50 of 600', 'a tenure ended is no wait');
});

// ── THE SERVICE ─────────────────────────────────────────────────────

const hourAt = (s) => Math.floor((((Math.floor(sharedClassicMinutes(s * 1000)) % 1440) + 1440) % 1440) / 60);
function secondAt(from, want) {
  for (let s = from; s < from + 2 * 7200; s += 30) if (hourAt(s) === want && hourAt(s - 60) === want && hourAt(s + 60) === want) return s;
  throw new Error('no such hour');
}
const NOON = secondAt(utcDay(T0) * DAY + 3600, 12);
let _now = NOON;
const realNow = Date.now;
const clock = (x) => { _now = x; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `chap3a-${String(++_rid).padStart(6, '0')}`;

/** A confirmed town of `factions` in Anticlere, its ground witnessed, and a realm character on the Roll with `members` -
 *  a week and a day in each guild where `tenure`. */
async function stand({ open = 'on', factions = [41, 108, 368], members = [41], reps = { 41: 10, 368: 5, 108: 0 }, tenure = true } = {}) {
  clock(NOON);
  forgetChapters();
  const s = await standService({ CHAPTERS_OPEN: open, PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', DEVELOPER_HANDLES: 'Devra,Wit0,Wit1,Wit2,Ground' });
  const raw = s.env.DB._raw;
  const age = (who, days) => raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(_now - days * DAY, who.id);
  for (let i = 0; i < 3; i++) {
    const w = await s.registered(`Wit${i}`);
    age(w, 8);
    clock(_now + 1);
    assert.equal((await s.call('/v1/chapters/witness', { hall: { key: 77, region: ANTICLERE, factions } }, w.secret)).status, 200);
  }
  const g = await s.registered('Ground');
  age(g, 8);
  const p = herbPatches({ x: 300, y: 200, day: utcDay(_now), climate: WOODS, confirmed: false })[0];
  const h = await s.call('/v1/prof/harvest', {
    character: g.character, node: nodeKey({ kind: 'herb', x: 300, y: 200, day: utcDay(_now), slot: p.slot }), kind: 'herbs',
    climate: WOODS, region: ANTICLERE, act: { clean: false, bruised: false }, at: _now - 2, rid: rid(),
  }, g.secret);
  assert.equal(h.status, 200, JSON.stringify(h.body));
  const who = await s.registered('Rolla');
  const R = await seatRealm(s.env, who.secret, 'Rolla');
  await readRoll({ db: s.env.DB, nowS: _now }, { id: who.id }, { character: R.id, lease: R.lease, seed: { factions: reps, members: members.map((f) => ({ f, rank: 0 })) } });
  if (tenure) raw.prepare('UPDATE npc_roll SET joined_at = joined_at - ? WHERE char_id = ?').run(8 * DAY, R.id);
  const give = (by, character, m, qty, origin = 'own') => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(by.id, character, m, origin, qty);
  const list = async (character = R.id, by = who) => (await s.call('/v1/writs/list', { character, region: ANTICLERE }, by.secret)).body;
  const deliver = async (id, { character = R.id, by = who, r = rid() } = {}) => s.call('/v1/writs/deliver', { character, id, rid: r }, by.secret);
  const rep = (f) => raw.prepare('SELECT rep FROM npc_roll WHERE char_id = ? AND faction_id = ?').get(R.id, f)?.rep;
  const merit = () => raw.prepare('SELECT week, faction, region, account, char_id, source, amount, ref FROM npc_chapter_merit ORDER BY rowid').all().map((r) => ({ ...r }));
  const gate = async (character = R.id) => s.call('/v1/gate/claim', {
    receipt: await mintReceipt({ d: gameDayAt(_now * 1000), b: 'ruhn', s: who.id, c: 4242, x: 'dealt' }, s.gatePriv, { subtle, nowS: _now }), region: ANTICLERE, character,
  }, who.secret);
  const raid = async (loc) => s.call('/v1/raid/claim', {
    receipt: await mintRaidReceipt({ w: `${ANTICLERE}:${loc}:${utcDay(_now)}`, s: who.id, c: 777, y: 2 }, s.gatePriv, { subtle, nowS: _now }), character: R.id,
  }, who.secret);
  return { ...s, raw, age, who, R, give, list, deliver, rep, merit, gate, raid };
}

test('CHAP3a a member\'s own writ on the board: one for each of its guilds keeping a chapter here, drawn over the character, written down once, its owner\'s alone - never another account\'s character, never another of its own, never once it leaves the guild (mutants: posted for no member, the owner unread, the membership unread)', async () => {
  const s = await stand({ members: [41, 108, 40] });
  const day = utcDay(_now);
  const l = await s.list();
  assert.deepEqual(l.merit.map((m) => m.faction), [41, 108], 'the Mages Guild keeps no chapter here');
  const own = l.writs.filter((w) => w.kind === 'member');
  assert.deepEqual(own.map((w) => [w.faction, w.id, w.state]), [[41, memberWritId(day, ANTICLERE, 41, s.R.id), 'open'], [108, memberWritId(day, ANTICLERE, 108, s.R.id), 'open']],
    'the Knights of the Dragon keep a chapter here - but it is no member');
  const table = regionWritTable(ANTICLERE, [{ climate: WOODS, confirmed: false }], daySeason(day));
  const law = memberWrit(day, ANTICLERE, 41, s.R.id, table);
  assert.deepEqual([own[0].material, own[0].tier, own[0].qty, own[0].pay, own[0].renown], [law.material, law.tier, law.units, law.pay, law.renown]);
  assert.equal(own[0].expiresAt, (day + 1) * DAY);
  await s.list();
  assert.deepEqual(s.raw.prepare("SELECT owner, COUNT(*) AS n FROM writs WHERE kind = 'member' GROUP BY owner").all().map((r) => ({ ...r })), [{ owner: s.R.id, n: 2 }], 'written down once');
  // another account's reader, and the same account's other character, see none of it
  const mac = await s.registered('Mac');
  assert.deepEqual((await s.list(mac.character, mac)).writs.filter((w) => w.kind === 'member'), []);
  assert.deepEqual((await s.list(s.who.character)).writs.filter((w) => w.kind === 'member'), []);
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM writs WHERE kind = 'member'").get().n, 2, 'nor posted for a reader with no Roll');
  // the account's second realm character, a member of the Fighters too: its own writ beside the first's, never the first's
  const R2 = await seatRealm(s.env, s.who.secret, 'Rolla Two');
  await readRoll({ db: s.env.DB, nowS: _now }, { id: s.who.id }, { character: R2.id, lease: R2.lease, seed: { factions: { 41: 10 }, members: [{ f: 41, rank: 0 }] } });
  assert.deepEqual((await s.list(R2.id)).writs.filter((w) => w.kind === 'member').map((w) => w.id), [memberWritId(day, ANTICLERE, 41, R2.id)]);
  s.give(s.who, R2.id, own[0].material, own[0].qty);
  assert.deepEqual((await s.deliver(own[0].id, { character: R2.id })).body, { error: 'no-writ' }, 'the first\'s writ, by the second');
  // the Chapters shut after it was posted: its owner is refused it
  s.env.CHAPTERS_OPEN = 'off';
  s.give(s.who, s.R.id, own[0].material, own[0].qty);
  assert.deepEqual((await s.deliver(own[0].id)).body, { error: 'chapters-closed' });
  s.env.CHAPTERS_OPEN = 'on';
  // no longer the guild's member: no longer its writ
  s.raw.prepare('UPDATE npc_roll SET member = 0 WHERE char_id = ? AND faction_id = 108').run(s.R.id);
  assert.deepEqual((await s.list()).writs.filter((w) => w.kind === 'member').map((w) => w.faction), [41]);
  s.give(s.who, s.R.id, own[1].material, own[1].qty);
  assert.deepEqual((await s.deliver(own[1].id)).body, { error: 'no-writ' });
  // the Chapters not this account's: no writ of its own, nothing posted
  const dev = await stand({ open: 'dev' });
  assert.deepEqual((await dev.list()).writs.filter((w) => w.kind !== 'court'), []);
  assert.equal(dev.raw.prepare("SELECT COUNT(*) AS n FROM writs WHERE kind = 'member'").get().n, 0);
});

test('CHAP3a a member\'s own writ delivered: paid as a hall writ - its pay, +2 to its guild - and 100 Merit for its own units, in the answer and its repeat; inside the account\'s three a day; the board\'s Merit line (mutants: the Merit unwritten, the answer, the line)', async () => {
  const s = await stand();
  const w = (await s.list()).writs.find((x) => x.kind === 'member');
  s.give(s.who, s.R.id, w.material, w.qty);
  const rep0 = s.rep(41);
  const r0 = rid();
  const r = await s.deliver(w.id, { r: r0 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.writ.kind, r.body.writ.faction, r.body.pay, r.body.merit, r.body.today.filled], ['member', 41, w.pay, 100, 1]);
  assert.equal(s.rep(41), rep0 + 2);
  assert.deepEqual(s.merit(), [{ week: meritWeekOf(_now), faction: 41, region: ANTICLERE, account: s.who.id, char_id: s.R.id, source: 'writ', amount: 100, ref: w.id }]);
  const again = await s.deliver(w.id, { r: r0 });
  assert.deepEqual([again.body.repeat, again.body.merit], [true, 100]);
  assert.equal(s.merit().length, 1);
  const l = await s.list();
  assert.equal(l.writs.find((x) => x.id === w.id).state, 'mine');
  assert.deepEqual(l.merit, [{ faction: 41, merit: 100, max: 600, elsewhere: false, from: null }]);
  assert.deepEqual(l.today, { filled: 1, max: 3 }, 'the account\'s one allowance');
});

test('CHAP3a bought units earn no Merit: the bought spent first, the writ\'s Merit its own units\' share; a writ filled with bought units alone pays and earns none (mutants: the bought unread, read after the spend)', async () => {
  const s = await stand({ members: [41, 368] });
  const [a, b] = (await s.list()).writs.filter((x) => x.kind === 'member');
  assert.ok(a.qty >= 2, 'a writ of two units or more');
  s.give(s.who, s.R.id, a.material, 1, 'bought');
  s.give(s.who, s.R.id, a.material, a.qty, 'own');
  const r = await s.deliver(a.id);
  assert.equal(r.body.merit, meritOfWrit(a.qty, a.qty - 1));   // its size the member's dice (a realm id is minted at random): the rounding's own pin is the line's, below
  assert.ok(r.body.merit < 100 && r.body.merit > 0);
  assert.deepEqual(s.raw.prepare('SELECT origin, qty FROM prof_stores WHERE char_id = ? AND material = ? ORDER BY origin').all(s.R.id, a.material).map((x) => ({ ...x })),
    [{ origin: 'own', qty: 1 }], 'the bought unit spent first');
  s.raw.prepare('DELETE FROM prof_stores WHERE char_id = ? AND material = ?').run(s.R.id, b.material);
  s.give(s.who, s.R.id, b.material, b.qty, 'bought');
  const z = await s.deliver(b.id);
  assert.deepEqual([z.status, z.body.merit], [200, 0]);
  assert.deepEqual(s.merit().map((m) => m.faction), [41], 'no line for none');
});

test('CHAP3a only its owner delivers it, and Merit waits on the week in the guild: another account naming the character, the account\'s other character - no-writ; a new member\'s writ pays and earns none, the board says when (mutants: the owner, the player, the tenure)', async () => {
  const s = await stand({ tenure: false });
  const w = (await s.list()).writs.find((x) => x.kind === 'member');
  const mallory = await s.registered('Mallory');
  s.give(mallory, s.R.id, w.material, w.qty);
  assert.deepEqual((await s.deliver(w.id, { by: mallory })).body, { error: 'no-writ' }, 'another account, naming the character');
  s.give(s.who, s.who.character, w.material, w.qty);
  assert.deepEqual((await s.deliver(w.id, { character: s.who.character })).body, { error: 'no-writ' }, 'its account\'s other character');
  const joined = s.raw.prepare('SELECT joined_at FROM npc_roll WHERE char_id = ? AND faction_id = 41').get(s.R.id).joined_at;
  assert.deepEqual((await s.list()).merit, [{ faction: 41, merit: 0, max: 600, elsewhere: false, from: joined + MERIT_TENURE_S }]);
  s.give(s.who, s.R.id, w.material, w.qty);
  const r = await s.deliver(w.id);
  assert.deepEqual([r.status, r.body.merit, s.rep(41)], [200, 0, 12]);
  assert.deepEqual(s.merit(), []);
});

test('CHAP3a a receipt\'s Merit: its 50 shared among the chapters its own line credited (AUDIT CHAP3 E4 - PIN MOVED: 50 to each), never for the receipt writ, every gate and raid - in the claim\'s answer (mutants: the receipt\'s Merit, the writ\'s line counted, the answer)', async () => {
  const s = await stand({ members: [41, 368] });
  const day = utcDay(_now);
  const g = await s.gate();
  assert.deepEqual(g.body.chapters, { counted: true, credited: [{ f: 41, amount: 3 }, { f: 368, amount: 3 }], merit: [{ f: 41, amount: 25 }, { f: 368, amount: 25 }] });
  const a = await s.raid(7);
  assert.deepEqual(a.body.chapters.merit, [{ f: 41, amount: 25 }, { f: 368, amount: 25 }]);
  const b = await s.raid(8);
  assert.deepEqual(b.body.chapters.merit, [{ f: 41, amount: 25 }, { f: 368, amount: 25 }], 'the receipt writ filled: the receipt\'s own Merit still');
  const week = meritWeekOf(_now);
  assert.deepEqual(s.merit().map((m) => [m.faction, m.source, m.ref, m.amount, m.week, m.region]), [
    [41, 'gate', `gate:${gameDayAt(_now * 1000)}`, 25, week, ANTICLERE], [368, 'gate', `gate:${gameDayAt(_now * 1000)}`, 25, week, ANTICLERE],   // PIN MOVED (AUDIT CHAP3 E1)
    [41, 'raid', `raid:${ANTICLERE}:7:${day}`, 25, week, ANTICLERE], [368, 'raid', `raid:${ANTICLERE}:7:${day}`, 25, week, ANTICLERE],
    [41, 'raid', `raid:${ANTICLERE}:8:${day}`, 25, week, ANTICLERE], [368, 'raid', `raid:${ANTICLERE}:8:${day}`, 25, week, ANTICLERE],
  ]);
  assert.deepEqual((await s.list()).merit.map((m) => [m.faction, m.merit]), [[41, 75], [368, 75]]);
});

test('CHAP3a the week\'s bounds through a receipt: the cap cut to the room an account has left, whichever of its characters earned it; one chapter of a guild an account a week - last week\'s no bar (mutants: the cap\'s key, the chapter\'s lock, the week)', async () => {
  const s = await stand({ members: [41, 368] });
  const week = meritWeekOf(_now);
  const line = s.raw.prepare('INSERT INTO npc_chapter_merit (week, faction, region, account, char_id, source, amount, ref, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  line.run(week, 41, ANTICLERE, s.who.id, RB, 'raid', 580, 'raid:x', _now);   // another character of the account
  line.run(week, 368, 17, s.who.id, s.R.id, 'gate', 10, 'gate:y', _now);   // this week's chapter of the Knights is Daggerfall's
  line.run(week - 1, 41, 17, s.who.id, s.R.id, 'gate', 10, 'gate:z', _now);   // last week's is no bar
  line.run(week - 1, 41, ANTICLERE, s.who.id, s.R.id, 'raid', 500, 'raid:v', _now);   // nor last week's Merit here, to the cap
  line.run(week, 41, ANTICLERE, 'someone-else', RA, 'raid', 600, 'raid:w', _now);   // another account's is not this one's
  const g = await s.gate();
  assert.deepEqual(g.body.chapters.merit, [{ f: 41, amount: 20 }], 'the room left; the Knights\' Merit is Daggerfall\'s chapter\'s this week');
  assert.deepEqual((await s.raid(7)).body.chapters.merit, [], 'the cap reached');
  assert.deepEqual((await s.list()).merit, [
    { faction: 41, merit: 600, max: 600, elsewhere: false, from: null }, { faction: 368, merit: 0, max: 600, elsewhere: true, from: null },
  ], 'the account\'s, whichever character; last week\'s Daggerfall line names no elsewhere');
});

test('CHAP3a the Merit line\'s every bound, against the real schema: the guard, the amount, the tenure to the second, the membership, the account, a dead character, the cap, the week\'s one chapter, an act once (mutants: each clause)', async () => {
  const s = await stand({ members: [41] });
  const db = s.env.DB;
  const week = meritWeekOf(_now);
  const run = async (o = {}) => {
    await db.batch([meritStatement(db, {
      player: s.who.id, character: s.R.id, faction: 41, region: ANTICLERE, source: 'gate', ref: `gate:${++_rid}`, nowS: _now,
      amountSql: '?11', guard: '?12 = 1', binds: [50, 1], ...o,
    })]);
    const r = s.raw.prepare('SELECT amount FROM npc_chapter_merit ORDER BY rowid DESC LIMIT 1').get();
    const n = s.raw.prepare('SELECT COUNT(*) AS n FROM npc_chapter_merit').get().n;
    return { n, last: r?.amount ?? null };
  };
  const total = () => s.raw.prepare('SELECT COUNT(*) AS n FROM npc_chapter_merit').get().n;
  assert.equal((await run({ binds: [50, 0] })).n, 0, 'the guard');
  assert.equal((await run({ binds: [0, 1] })).n, 0, 'nothing to earn');
  assert.deepEqual(await run(), { n: 1, last: 50 });
  assert.deepEqual(await run({ binds: [37.9, 1] }), { n: 2, last: 37 }, 'whole Merit, rounded down - whatever a bound number is read as');
  s.raw.prepare("DELETE FROM npc_chapter_merit WHERE amount = 37").run();
  // the tenure to the second
  const joined = s.raw.prepare('SELECT joined_at FROM npc_roll WHERE char_id = ? AND faction_id = 41').get(s.R.id).joined_at;
  s.raw.prepare('UPDATE npc_roll SET joined_at = ? WHERE char_id = ? AND faction_id = 41').run(_now - MERIT_TENURE_S + 1, s.R.id);
  assert.equal((await run()).n, 1, 'a second short');
  s.raw.prepare('UPDATE npc_roll SET joined_at = ? WHERE char_id = ? AND faction_id = 41').run(_now - MERIT_TENURE_S, s.R.id);
  assert.equal((await run()).n, 2, 'the seventh day whole');
  s.raw.prepare('UPDATE npc_roll SET joined_at = ? WHERE char_id = ? AND faction_id = 41').run(joined, s.R.id);
  // the membership, the guild, the account, the character's life
  s.raw.prepare('UPDATE npc_roll SET member = 0 WHERE char_id = ? AND faction_id = 41').run(s.R.id);
  assert.equal((await run()).n, 2, 'no member');
  s.raw.prepare('UPDATE npc_roll SET member = 1 WHERE char_id = ? AND faction_id = 41').run(s.R.id);
  assert.equal((await run({ faction: 368 })).n, 2, 'another guild');
  assert.equal((await run({ player: 'p-other' })).n, 2, 'another account');
  s.raw.prepare('UPDATE realm_characters SET dead_at = ? WHERE id = ?').run(_now, s.R.id);
  assert.equal((await run()).n, 2, 'dead');
  s.raw.prepare('UPDATE realm_characters SET dead_at = NULL WHERE id = ?').run(s.R.id);
  // the cap: 100 stand, 500 room - a 600 asked is cut to it, then none
  assert.deepEqual(await run({ binds: [600, 1] }), { n: 3, last: 500 });
  assert.equal((await run()).n, 3, 'the cap');
  assert.equal(MERIT_CAP_WEEK, 600);
  // another region's chapter of the guild this week, while this one holds lines: none there
  s.raw.prepare('DELETE FROM npc_chapter_merit').run();
  assert.equal((await run({ region: 17 })).n, 1);
  assert.equal((await run()).n, 1, 'the week\'s chapter of the guild is Daggerfall\'s');
  s.raw.prepare('UPDATE npc_chapter_merit SET week = ?').run(week - 1);
  assert.equal((await run()).n, 2, 'last week\'s chapter no bar');
  // an act once
  await run({ ref: 'gate:once' });
  await run({ ref: 'gate:once' });
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM npc_chapter_merit WHERE ref = 'gate:once'").get().n, 1);
  assert.equal(total(), 3);
});

// ── THE BOARD AND THE WIRING ────────────────────────────────────────

test('CHAP3a the member\'s own card: "Your writ", yours to fill for the guild, its pay Merit too, and Take; the account\'s Merit lines under the day\'s count (mutants: the text, the lines)', async () => {
  const tick = () => new Promise((r) => setImmediate(r));
  const writs = [{ id: `m:1:21:41:${RA}`, kind: 'member', region: 21, faction: 41, material: 'p1:23', tier: 2, qty: 4, pay: 24, renown: 37, expiresAt: 9e9, state: 'open' }];
  const merit = [{ faction: 41, merit: 150, max: 600, elsewhere: false, from: null }, { faction: 368, merit: 0, max: 600, elsewhere: true, from: null }];
  const book = { state: { open: true, writs: { today: 0, max: 3 } }, held: () => 9,
    writs: async () => ({ data: { writs, receipts: [], merit, today: { filled: 0, max: 3 } }, error: null, stale: false }), deliver: async () => ({ ok: true, data: {} }) };
  const notices = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen() {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }) };
  const host = document.createElement('div');
  mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 5 }, book: notices, work: { book, region: 21, regionName: 'Anticlere', countName: (k, n) => materialCountLabel(k, n) } });
  await tick();
  byClass(host, 'notice-tab')[1].click();
  for (let i = 0; i < 3; i++) await tick();
  const [card] = byClass(host, 'notice-writ');
  assert.equal(byClass(card, 'writ-kind')[0].textContent, 'Your writ');
  assert.equal(byClass(card, 'writ-need')[0].textContent, `Yours to fill: 4 ${materialCountLabel('p1:23', 4)}, for the Fighters Guild in Anticlere`);
  assert.equal(byClass(card, 'writ-pay')[0].textContent, 'Pays 24 silver, 37 Renown, standing and Merit with the Fighters Guild');
  assert.ok(card.className.includes('seal-guild'));
  assert.equal(byClass(card, 'notice-take').length, 1);
  assert.deepEqual(byClass(host, 'notice-merit').map((p) => p.textContent), [
    'Merit with the Fighters Guild here this week: 150 of 600', 'Your Merit with the Knights of the Dragon this week is another chapter\'s',
  ]);
});

test('CHAP3a the wiring: the writs\' kind and owner in the rebuild, Merit\'s table and its key; the board lists the Merit; the host says a writ\'s Merit and refreshes the Roll on a member\'s own; the version note (mutants: the schema, the line)', () => {
  const halls = src('server-account/migrations/0099_npc_halls.sql');
  assert.match(halls, /kind\s+TEXT NOT NULL CHECK \(kind IN \('court', 'hall', 'member'\)\)/);
  assert.match(halls, /owner\s+TEXT NOT NULL DEFAULT '',/);
  assert.match(halls, /UNIQUE \(day, region, kind, faction, owner, slot\)/);
  const merit = src('server-account/migrations/0101_npc_merit.sql');
  assert.match(merit, /source\s+TEXT NOT NULL CHECK \(source IN \('writ', 'gate', 'raid'\)\)/);
  assert.match(merit, /amount\s+INTEGER NOT NULL CHECK \(amount >= 1\)/);
  assert.match(merit, /UNIQUE \(char_id, faction, source, ref\)/);
  assert.match(src('server-account/src/professions.js'), /merit: await meritAsks\(db, player\.id, character, region, nowS, members\),/);
  const world = src('src/scenes/world.js');
  assert.match(world, /const merit = hall && Number\(d\.merit\) > 0 \? `, \$\{Number\(d\.merit\)\.toLocaleString\('en-US'\)\} Merit to its chapter here` : '';/);
  assert.match(src('src/ui/noticeWindow.js'), /for \(const m of writs\?\.merit \?\? \[\]\) body\.append\(el\('p', 'notice-merit', meritLineOf\(m, nowS\(\)\)\)\);/);
  assert.match(src('server-account/src/service.js'), /CHAP3a \(Mac: "Keep going with the arc\/slices"; migration 0101_npc_merit/);
});
