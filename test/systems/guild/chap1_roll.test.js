// CHAP1 (2026-10-07, Mac: "how could we split away from DFU, completely overhaul the NPC guild system and reputation
// system"; "This is mostly with online in mind"; asked who holds it online, "Server-owned"; on the rest, "You make the
// best decisions"): THE ROLL - a realm character's standing with Daggerfall's own guilds (the twenty-two guild
// factions' reputation and its memberships) kept by the account service. bible/11-Multiplayer/Chapters-Arc.md section 3.
//
// The law (src/net/npcChapterLaw.js) against literals; the leaf the service reads (src/systems/guild/guildFactions.js) as the
// one home of DFU's ids; the service (server-account/src/npcRoll.js) over the real migrations - the switch, the seed
// and its cap, the day's bound, a loss believed, a repeat, a lost race, the lease, the tenure, the delete; the playing
// tab's tracker (src/net/npcRollTracker.js) against a fake door; and the host's wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ROLL_FACTIONS, isRollFaction, ROLL_GAIN_DAY_MAX, ROLL_CUSTOMS_CAP, ROLL_EPOCH_S, ROLL_DELTA_MAX, ROLL_CLAIM_MS, ROLL_RETRY_MS,
  rollCredit, rollSeedCapOf, rollSeedOf, rollSeedOk, rollDeltasOk, rollDeltasOf, rollAdopt, rollMembersOf, rollMembersOk,
  rollFactionOfGuild, chaptersSwitchOf, rollRidOf,
} from '../../../src/net/npcChapterLaw.js';
import { createRollTracker, rollValuesOf, rollRid } from '../../../src/net/npcRollTracker.js';
import * as leaf from '../../../src/systems/guild/guildFactions.js';
import { GUILDS } from '../../../src/systems/guild/guilds.js';
import { DIVINES, ORDERS } from '../../../src/systems/guild/guildVariants.js';
import { MIN_REPUTATION, MAX_REPUTATION } from '../../../src/systems/faction/factionRep.js';
import { readRoll, claimRoll, rollViewOf } from '../../../server-account/src/npcRoll.js';
import { standService, T0 } from '../../accountDb.mjs';
import { seatRealm } from '../../realmSeat.mjs';
import { hostText } from '../../hostText.mjs';   // HOST-SPLIT 2 (AUDIT, the second read): its negatives read the host whole

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const DAY = 86_400;

// ── THE LAW ─────────────────────────────────────────────────────────

test('CHAP1 the twenty-two: the Roll keeps exactly DFU\'s four guilds, eight temples and ten orders, from the one leaf every caller reads (mutants: an id dropped from the leaf)', () => {
  assert.deepEqual([...ROLL_FACTIONS], [21, 22, 24, 26, 27, 29, 33, 35, 40, 41, 42, 108, 368, 408, 409, 410, 411, 413, 414, 415, 416, 417]);
  assert.equal(isRollFaction(41), true);
  assert.equal(isRollFaction(510), false, 'the merchants are no guild');
  assert.equal(isRollFaction('41'), false, 'an id is a number');
  // ONE DFU MEMBER, ONE EXPORT: guilds.js, guildVariants.js and factionRep.js hand the leaf's own on
  assert.deepEqual(Object.fromEntries(Object.entries(GUILDS).map(([k, g]) => [k, g.factionId])), { ...leaf.GUILD_FACTION_IDS });
  assert.equal(DIVINES, leaf.DIVINES);
  assert.equal(ORDERS, leaf.ORDERS);
  assert.deepEqual([MIN_REPUTATION, MAX_REPUTATION, leaf.MIN_REPUTATION, leaf.MAX_REPUTATION], [-100, 100, -100, 100]);
  assert.doesNotMatch(src('src/systems/guild/guildFactions.js'), /^import /m, 'a leaf: the account service\'s graph reaches it and nothing past it');
  assert.doesNotMatch(src('src/systems/guild/guildVariants.js'), /Akatosh: 26/, 'the divines are written once, in the leaf');
  assert.doesNotMatch(src('src/systems/guild/guilds.js'), /factionId: 4[012],|factionId: 108,/, 'the four ids are written once, in the leaf');
});

// PIN MOVED (AUDIT CHAP D2/D4): the day's NET rise is paced, and what the pace leaves is owed - a loss gives the day's room back
test('CHAP1 the day\'s pace: a gain is credited what 15 a UTC day leaves and the rest owed, a new day opens it again, a loss is taken whole and gives its room back, both inside DFU\'s bounds (mutants: the bound, the rollover, a loss bounded, the clamp)', () => {
  assert.deepEqual([ROLL_GAIN_DAY_MAX, ROLL_CUSTOMS_CAP, ROLL_DELTA_MAX, ROLL_EPOCH_S], [15, 40, 200, 1_791_417_600]);
  assert.deepEqual(rollCredit({ rep: 10, gainedDay: 5, gained: 0 }, 10, 5), { rep: 20, gainedDay: 5, gained: 10, owed: 0, credited: 10 });
  assert.deepEqual(rollCredit({ rep: 20, gainedDay: 5, gained: 10 }, 10, 5), { rep: 25, gainedDay: 5, gained: 15, owed: 5, credited: 5 });
  assert.deepEqual(rollCredit({ rep: 25, gainedDay: 5, gained: 15 }, 10, 5), { rep: 25, gainedDay: 5, gained: 15, owed: 10, credited: 0 });
  assert.deepEqual(rollCredit({ rep: 25, gainedDay: 5, gained: 15 }, 10, 6), { rep: 35, gainedDay: 6, gained: 10, owed: 0, credited: 10 }, 'a new UTC day');
  assert.deepEqual(rollCredit({ rep: 25, gainedDay: 5, gained: 15 }, -40, 5), { rep: -15, gainedDay: 5, gained: -25, owed: 0, credited: -40 }, 'a loss whole, its room given back');
  assert.deepEqual(rollCredit({ rep: 95, gainedDay: 5, gained: 0 }, 10, 5), { rep: 100, gainedDay: 5, gained: 5, owed: 0, credited: 5 }, 'the day counts what moved; nothing is owed past 100');
  assert.deepEqual(rollCredit({ rep: -95, gainedDay: 5, gained: 2 }, -10, 5), { rep: -100, gainedDay: 5, gained: -3, owed: 0, credited: -5 });
});

// PIN MOVED (AUDIT CHAP C3): the cap is a customs crossing's from the epoch - one born online earned its standing online
test('CHAP1 the seed: a customs crossing from the epoch is capped at 40, one before it and a character born online are taken whole; every faction seeded, a missing one at 0 (mutants: the epoch\'s side, the cap)', () => {
  assert.equal(rollSeedCapOf({ origin: 'off-1', createdAt: ROLL_EPOCH_S - 1 }), 100);
  assert.equal(rollSeedCapOf({ origin: 'off-1', createdAt: ROLL_EPOCH_S }), 40);
  assert.equal(rollSeedCapOf({ origin: 'off-1', createdAt: ROLL_EPOCH_S + DAY }), 40);
  assert.equal(rollSeedCapOf({ origin: 'off-1', createdAt: null }), 40, 'a crossing of unknown age is never whole');
  assert.equal(rollSeedCapOf({ origin: null, createdAt: ROLL_EPOCH_S + DAY }), 100, 'born online');
  const seed = rollSeedOf({ 40: 90, 41: -120, 26: 12 }, 40);
  assert.deepEqual(Object.keys(seed).map(Number), [...ROLL_FACTIONS]);
  assert.deepEqual([seed[40], seed[41], seed[26], seed[108]], [40, -100, 12, 0]);
  assert.deepEqual(rollSeedOf({ 40: 90 }, 100)[40], 90);
});

test('CHAP1 the shapes: a seed, a claim and the memberships are refused out of their shape (mutants: a foreign id let in, a zero line let in, a rank past 9)', () => {
  assert.equal(rollSeedOk({ 40: 50, 108: -100 }), true);
  assert.equal(rollSeedOk({}), true, 'a character with no guild standing at all');
  assert.equal(rollSeedOk({ 510: 5 }), false);
  assert.equal(rollSeedOk({ 40: 101 }), false);
  assert.equal(rollSeedOk({ '040': 5 }), false, 'a key is the id\'s own decimal');
  assert.equal(rollSeedOk([1]), false);
  assert.equal(rollDeltasOk({ 40: 5, 41: -200 }), true);
  assert.equal(rollDeltasOk({}), false, 'a claim of nothing is no claim');
  assert.equal(rollDeltasOk({ 40: 0 }), false);
  assert.equal(rollDeltasOk({ 40: 201 }), false);
  assert.equal(rollDeltasOk({ 40: 1.5 }), false);
  assert.equal(rollMembersOk([{ f: 40, rank: 9 }, { f: 21, rank: 0 }]), true);
  assert.equal(rollMembersOk([{ f: 40, rank: 10 }]), false);
  assert.equal(rollMembersOk([{ f: 40, rank: 1 }, { f: 40, rank: 2 }]), false, 'a guild once');
  assert.equal(rollMembersOk([{ f: 510, rank: 1 }]), false);
  assert.equal(chaptersSwitchOf('dev'), 'dev');
  assert.equal(chaptersSwitchOf('yes'), 'off');
  assert.equal(rollRidOf('abc'), null);
  assert.equal(rollRidOf('claim-0001'), 'claim-0001');
  assert.match(rollRid(), /^[0-9a-f]{24}$/);
});

test('CHAP1 the memberships: both books, the higher rank where both hold one, a temple and an order by their records\' names, a non-member and an unknown guild left out (mutants: one book read, the lower rank kept)', () => {
  assert.equal(rollFactionOfGuild('MagesGuild'), 40);
  assert.equal(rollFactionOfGuild('Temple:Arkay'), 21);
  assert.equal(rollFactionOfGuild('Order:Raven'), 414);
  assert.equal(rollFactionOfGuild('Temple:Sheogorath'), null);
  assert.equal(rollFactionOfGuild('constructor'), null);
  const store = {
    mortal: { 10: { guild: 'MagesGuild', rank: 5 }, 17: { guild: 'Temple:Arkay', rank: 2 } },
    vampire: { 10: { guild: 'MagesGuild', rank: 3 }, 9: { guild: 'Order:Raven', rank: 1 }, 3: { guild: 'Bards', rank: 4 } },
  };
  assert.deepEqual(rollMembersOf(store), [{ f: 21, rank: 2 }, { f: 40, rank: 5 }, { f: 414, rank: 1, d: 1 }], 'PIN MOVED (AUDIT CHAP4 D1): a line the active book does not hold is dormant');
  assert.deepEqual(rollMembersOf(store, true), [{ f: 21, rank: 2, d: 1 }, { f: 40, rank: 5 }, { f: 414, rank: 1 }], 'the vampire\'s book the active one: the mortal\'s alone dormant');
  assert.deepEqual(rollMembersOf({ 10: { guild: 'MagesGuild', rank: 4 } }), [{ f: 40, rank: 4 }], 'a book from before the two-book store');
  assert.equal(rollMembersOf(null), null, 'PIN MOVED (AUDIT CHAP S8): no book is no word - the Roll\'s stand unchanged');
  assert.deepEqual(rollMembersOf({ mortal: {}, vampire: {} }), []);
});

test('CHAP1 adopting the service\'s word: the Roll\'s number, plus whatever moved here while the claim was out (mutants: the in-flight change dropped, the sent change counted twice)', () => {
  const base = { 40: 10, 41: 0 };
  const sent = { 40: 10 };
  const current = { 40: 25, 41: -5 };   // +10 sent, +5 since; -5 since on 41
  const roll = { 40: 15, 41: 0 };       // the service credited 5 of the 10
  const a = rollAdopt(current, base, sent, roll);
  assert.equal(a.local[40], 20, 'the service\'s 15, plus the 5 that moved while out');
  assert.equal(a.local[41], -5);
  assert.equal(a.base[40], 15);
  assert.deepEqual(rollDeltasOf(a.local, a.base), { 40: 5, 41: -5 }, 'and that is the next claim');
  assert.deepEqual(rollDeltasOf({ 40: 3 }, { 40: 3 }), {});
});

// ── THE SERVICE ─────────────────────────────────────────────────────

const ROLL = '/v1/chapters/roll';
const CLAIM = '/v1/chapters/claim';

async function stand(open = 'on') {
  const svc = await standService({ CHAPTERS_OPEN: open, DEVELOPER_HANDLES: 'Devra' });
  const who = await svc.registered('Rolla');
  const R = await seatRealm(svc.env, who.secret, 'Rolla');
  const raw = svc.env.DB._raw;
  const born = (s, origin = 'off-rolla') => raw.prepare('UPDATE realm_characters SET created_at = ?, origin_id = ? WHERE id = ?').run(s, origin, R.id);
  born(ROLL_EPOCH_S + DAY);   // PIN MOVED (AUDIT CHAP C3): a customs crossing after CHAP1 arrived, unless a pin says otherwise
  return { ...svc, who, R, raw, born };
}

test('CHAP1 the switch: shut, the Roll answers chapters-closed (403) and the save keeps the standing; at dev, only a developer; on, everyone (mutants: the switch ignored, dev let anyone in)', async () => {
  for (const [open, handle, status] of [['off', 'Rolla', 403], ['dev', 'Rolla', 403], ['dev', 'Devra', 200], ['on', 'Rolla', 200]]) {
    const svc = await standService({ CHAPTERS_OPEN: open, DEVELOPER_HANDLES: 'Devra' });
    const who = await svc.registered(handle);
    const R = await seatRealm(svc.env, who.secret, handle);
    const r = await svc.call(ROLL, { character: R.id, lease: R.lease }, who.secret);
    assert.equal(r.status, status, `${open} for ${handle}`);
    if (status === 403) assert.equal(r.body.error, 'chapters-closed');
  }
});

test('CHAP1 the first read: no seed, no Roll; the seed taken once, capped at 40 for a customs crossing since the epoch and whole for one before; a second seed never moves it (mutants: the cap skipped, a second seed taken)', async () => {
  const { call, who, R, raw, born } = await stand();
  assert.deepEqual((await call(ROLL, { character: R.id, lease: R.lease }, who.secret)).body, { roll: null });
  const seed = { factions: { 40: 90, 41: -60, 108: 75 }, members: [{ f: 40, rank: 6 }] };
  const first = await call(ROLL, { character: R.id, lease: R.lease, seed }, who.secret);
  assert.equal(first.status, 200);
  assert.equal(first.body.seeded, true);
  assert.equal(first.body.roll.factions[40], 69, 'capped at 40 - but a member keeps its rank\'s band (AUDIT CHAP D1: rank 6 needs 60; PIN MOVED, AUDIT CHAP2 D3: up to rank 7\'s line less one, 69)');
  assert.equal(first.body.roll.factions[42], 0);
  assert.equal(first.body.roll.factions[41], -60, 'a loss is never capped');
  assert.equal(first.body.roll.factions[108], 40, 'no member: the cap');
  assert.equal(Object.keys(first.body.roll.factions).length, 22);
  assert.deepEqual(first.body.roll.members.map((m) => [m.f, m.rank]), [[40, 6]]);
  const again = await call(ROLL, { character: R.id, lease: R.lease, seed: { factions: { 40: 10 }, members: [] } }, who.secret);
  assert.equal(again.body.seeded, undefined);
  assert.equal(again.body.roll.factions[40], 69, 'the Roll stands; a second seed is nothing');   // PIN MOVED (AUDIT CHAP2 D3)
  // a character the realm made before CHAP1 arrived keeps what it earned online whole
  raw.prepare('DELETE FROM npc_roll WHERE char_id = ?').run(R.id);
  raw.prepare('DELETE FROM npc_roll_heads WHERE char_id = ?').run(R.id);
  born(ROLL_EPOCH_S - 1);
  const old = await call(ROLL, { character: R.id, lease: R.lease, seed }, who.secret);
  assert.equal(old.body.roll.factions[40], 90);
  assert.equal(raw.prepare('SELECT cap FROM npc_roll_heads WHERE char_id = ?').get(R.id).cap, 100);
  assert.equal((await call(ROLL, { character: R.id, lease: R.lease, seed: { factions: { 999: 1 }, members: [] } }, who.secret)).body.roll.factions[40], 90);
  // and one born online after the epoch earned its standing online: whole
  raw.prepare('DELETE FROM npc_roll WHERE char_id = ?').run(R.id);
  raw.prepare('DELETE FROM npc_roll_heads WHERE char_id = ?').run(R.id);
  born(ROLL_EPOCH_S + DAY, null);
  assert.equal((await call(ROLL, { character: R.id, lease: R.lease, seed }, who.secret)).body.roll.factions[108], 75);
});

test('CHAP1 a malformed seed is refused whole (roll-seed, 400) and writes nothing', async () => {
  const { call, who, R, raw } = await stand();
  const r = await call(ROLL, { character: R.id, lease: R.lease, seed: { factions: { 510: 5 }, members: [] } }, who.secret);
  assert.deepEqual([r.status, r.body.error], [400, 'roll-seed']);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM npc_roll').get().n, 0);
});

test('CHAP1 a claim: a gain under the day\'s bound, a loss whole, the record kept line by line; a repeat answered and never credited twice (mutants: the repeat credited, the ledger skipped)', async () => {
  const { env, who, R, raw } = await stand();
  const ctx = (s) => ({ db: env.DB, nowS: s });
  const player = { id: who.id };
  await readRoll(ctx(T0), player, { character: R.id, lease: R.lease, seed: { factions: { 40: 10 }, members: [] } });
  const a = await claimRoll(ctx(T0), player, { character: R.id, lease: R.lease, rid: 'claim-0001', deltas: { 40: 10 }, members: [] });
  assert.deepEqual([a.credited, a.roll.factions[40]], [{ 40: 10 }, 20]);
  const b = await claimRoll(ctx(T0 + 60), player, { character: R.id, lease: R.lease, rid: 'claim-0002', deltas: { 40: 10, 41: -30 }, members: [] });
  assert.deepEqual([b.credited, b.roll.factions[40], b.roll.factions[41]], [{ 40: 5, 41: -30 }, 25, -30], 'five of ten: the day\'s fifteen spent');
  const rep = await claimRoll(ctx(T0 + 120), player, { character: R.id, lease: R.lease, rid: 'claim-0002', deltas: { 40: 10, 41: -30 }, members: [] });
  assert.equal(rep.repeat, true);
  assert.deepEqual([rep.roll.factions[40], rep.roll.factions[41]], [25, -30], 'a repeat moves nothing');
  const c = await claimRoll(ctx(T0 + DAY), player, { character: R.id, lease: R.lease, rid: 'claim-0003', deltas: { 40: 10 }, members: [] });
  assert.equal(c.credited[40], 10, 'a new UTC day');
  assert.deepEqual(raw.prepare('SELECT faction_id, asked, credited, rid FROM npc_rep_events ORDER BY seq').all().map((e) => ({ ...e })), [
    { faction_id: 40, asked: 10, credited: 10, rid: 'claim-0001' },
    { faction_id: 40, asked: 10, credited: 5, rid: 'claim-0002' },
    { faction_id: 41, asked: -30, credited: -30, rid: 'claim-0002' },
    { faction_id: 40, asked: 10, credited: 10, rid: 'claim-0003' },
  ]);
  assert.equal(raw.prepare('SELECT seq FROM npc_roll_heads WHERE char_id = ?').get(R.id).seq, 3);
});

test('CHAP1 a lost race: a claim whose head moved between its read and its write writes nothing and says roll-busy (mutants: the guard dropped)', async () => {
  const { env, who, R, raw } = await stand();
  const player = { id: who.id };
  await readRoll({ db: env.DB, nowS: T0 }, player, { character: R.id, lease: R.lease, seed: { factions: { 40: 10 }, members: [] } });
  // another claim lands between this one's read and its batch
  const racing = { ...env.DB, prepare: (sql) => env.DB.prepare(sql), batch: async (list) => { raw.prepare('UPDATE npc_roll_heads SET seq = seq + 1 WHERE char_id = ?').run(R.id); return env.DB.batch(list); } };
  const r = await claimRoll({ db: racing, nowS: T0 }, player, { character: R.id, lease: R.lease, rid: 'claim-race1', deltas: { 40: 10 }, members: [{ f: 40, rank: 1 }] });
  assert.deepEqual(r, { error: 'roll-busy' });
  const row = raw.prepare('SELECT rep, member FROM npc_roll WHERE char_id = ? AND faction_id = 40').get(R.id);
  assert.deepEqual({ ...row }, { rep: 10, member: 0 });
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM npc_rep_events').get().n, 0);
});

test('CHAP1 the tenure: the service stamps a member the first time it sees one, keeps the stamp through a rank change, ends it when the member leaves and stamps again on a return (mutants: the stamp moved on a rank change)', async () => {
  const { env, who, R } = await stand();
  const ctx = (s) => ({ db: env.DB, nowS: s });
  const player = { id: who.id };
  await readRoll(ctx(T0), player, { character: R.id, lease: R.lease, seed: { factions: { 41: 30 }, members: [{ f: 41, rank: 2 }] } });   // PIN MOVED (AUDIT CHAP S5): a rank needs its reputation on the Roll
  const claim = (s, rid, members) => claimRoll(ctx(s), player, { character: R.id, lease: R.lease, rid, deltas: {}, members });
  let r = await claim(T0 + 10, 'tenure-001', [{ f: 41, rank: 2 }, { f: 40, rank: 0 }]);
  assert.deepEqual(r.roll.members, [{ f: 40, rank: 0, since: T0 + 10 }, { f: 41, rank: 2, since: T0 }]);
  r = await claim(T0 + 20, 'tenure-002', [{ f: 41, rank: 3 }, { f: 40, rank: 0 }]);
  assert.deepEqual(r.roll.members.find((m) => m.f === 41), { f: 41, rank: 3, since: T0 }, 'a promotion keeps the tenure');
  r = await claim(T0 + 30, 'tenure-003', [{ f: 40, rank: 0 }]);
  assert.deepEqual(r.roll.members.map((m) => m.f), [40], 'expelled');
  r = await claim(T0 + 40, 'tenure-004', [{ f: 41, rank: 0 }, { f: 40, rank: 0 }]);
  assert.equal(r.roll.members.find((m) => m.f === 41).since, T0 + 40, 'a return is a new tenure');
});

test('CHAP1 whose character, under whose lease: another tab\'s lease 409, another account\'s character 404, a claim before the read 409, a tombstone 410, a malformed claim 400 (mutants: the lease unread)', async () => {
  const { call, who, R, raw, registered } = await stand();
  const body = (extra = {}) => ({ character: R.id, lease: R.lease, rid: 'claim-guard', deltas: { 40: 5 }, members: [], ...extra });
  assert.deepEqual([(await call(CLAIM, body(), who.secret)).status, (await call(CLAIM, body(), who.secret)).body.error], [409, 'roll-unseeded']);
  await call(ROLL, { character: R.id, lease: R.lease, seed: { factions: {}, members: [] } }, who.secret);
  const other = await call(CLAIM, body({ lease: 'f'.repeat(32) }), who.secret);
  assert.deepEqual([other.status, other.body.error], [409, 'lease']);
  const stranger = await registered('Strangr');
  const theirs = await call(CLAIM, body(), stranger.secret);
  assert.deepEqual([theirs.status, theirs.body.error], [404, 'no-realm-character']);
  const bad = await call(CLAIM, body({ deltas: { 510: 5 } }), who.secret);
  assert.deepEqual([bad.status, bad.body.error], [400, 'roll-claim']);
  assert.equal((await call(CLAIM, body(), who.secret)).status, 200);
  raw.prepare('UPDATE realm_characters SET dead_at = ? WHERE id = ?').run(T0, R.id);
  const dead = await call(CLAIM, body({ rid: 'claim-guard2' }), who.secret);
  assert.deepEqual([dead.status, dead.body.error], [410, 'dead']);
});

test('CHAP1 a realm character deleted takes its Roll with it - the head, the rows and the record', async () => {
  const { call, who, R, raw, env } = await stand();
  await call(ROLL, { character: R.id, lease: R.lease, seed: { factions: { 40: 5 }, members: [] } }, who.secret);
  await call(CLAIM, { character: R.id, lease: R.lease, rid: 'claim-gone1', deltas: { 40: 5 }, members: [] }, who.secret);
  assert.equal((await rollViewOf(env.DB, R.id)).factions[40], 10, 'a Roll stands to be deleted');
  const del = await call('/v1/realm/delete', { id: R.id }, who.secret);
  assert.equal(del.status, 200);
  for (const t of ['npc_roll', 'npc_roll_heads', 'npc_rep_events']) assert.equal(raw.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n, 0, t);
});

// ── THE PLAYING TAB ─────────────────────────────────────────────────

/** A door that answers as the service would, keeping its own Roll - or refusing as it is told. */
/** PIN MOVED (AUDIT CHAP2 T: the fake answered no `seq`, `from` or `seeded`, and wrote a null book over the Roll's): shaped
 *  as the service answers - `seq` the claim sequence, moved by a claim that credits a line. */
function fakeDoor() {
  const calls = [];
  let roll = null;
  const view = () => ({ seq: roll.seq, factions: { ...roll.factions }, members: roll.members });
  const door = {
    calls, refuse: null, credit: (d) => d,
    async read(character, lease, seed) {
      calls.push({ kind: 'read', character, lease, seed });
      if (door.refuse) return { ok: false, error: door.refuse };
      if (!roll) {
        roll = { seq: 0, factions: rollSeedOf(seed.factions, 100), members: seed.members ?? [] };
        return { ok: true, data: { roll: view(), from: 0, seeded: true } };
      }
      return { ok: true, data: { roll: view(), from: roll.seq } };
    },
    async claim(character, lease, rid, deltas, members) {
      calls.push({ kind: 'claim', rid, deltas, members });
      if (door.refuse) return { ok: false, error: door.refuse };
      const credited = {};
      for (const [f, d] of Object.entries(deltas)) { credited[f] = door.credit(d); roll.factions[f] += credited[f]; }
      if (Object.keys(deltas).length) roll.seq += 1;
      if (members) roll.members = members;
      return { ok: true, data: { roll: view(), credited } };
    },
  };
  return door;
}

function playing(door, start = { 40: 10 }) {
  let t = 1_000_000;
  const held = { ...start };
  let members = [{ f: 40, rank: 1 }];
  const said = [], stops = [];
  const tracker = createRollTracker({
    io: door, character: () => 'r0123456789abcdef0123', lease: () => 'a'.repeat(32),
    read: () => ({ ...held }), write: (v) => Object.assign(held, v), members: () => members,
    now: () => t, rid: (() => { let n = 0; return () => `rid-${String(++n).padStart(6, '0')}`; })(),
    onCeiling: (f) => said.push(f), onStop: (e) => stops.push(e),
  });
  const settle = () => new Promise((r) => setTimeout(r, 0));
  return { tracker, held, said, stops, settle, at: (ms) => { t += ms; }, join: (m) => { members = m; } };
}

test('CHAP1 the tab: the first read seeds and adopts; nothing is claimed until something moves, then at most once a minute; the answer adopted with what moved meanwhile (mutants: the minute ignored, the read never seeded)', async () => {
  assert.deepEqual([ROLL_CLAIM_MS, ROLL_RETRY_MS], [60_000, 30_000]);
  const door = fakeDoor();
  const p = playing(door);
  p.tracker.tick(); await p.settle();
  assert.deepEqual(door.calls.map((c) => c.kind), ['read']);
  assert.deepEqual(door.calls[0].seed, { factions: { 40: 10 }, members: [{ f: 40, rank: 1 }] });
  assert.equal(p.tracker.held, true);
  p.at(120_000); p.tracker.tick(); await p.settle();
  assert.equal(door.calls.length, 1, 'nothing moved: nothing asked');
  p.held[40] = 15;
  p.tracker.tick(); await p.settle();
  assert.deepEqual(door.calls[1].deltas, { 40: 5 });
  p.held[40] = 18;
  p.at(10_000); p.tracker.tick(); await p.settle();
  assert.equal(door.calls.length, 2, 'inside the minute: held for the next claim');
  p.at(60_000); p.tracker.tick(); await p.settle();
  assert.deepEqual(door.calls[2].deltas, { 40: 3 });
  assert.equal(p.held[40], 18);
});

test('CHAP1 the tab: the day\'s bound cuts a gain, the service\'s number stands and the cut line is said; a lost claim is sent again as it was; a shut Roll ends the asking (mutants: a lost claim minted anew, the stop list ignored)', async () => {
  const door = fakeDoor();
  door.credit = (d) => Math.min(d, 2);
  const p = playing(door);
  p.tracker.tick(); await p.settle();
  p.held[40] = 20;
  p.tracker.tick(); await p.settle();
  assert.equal(p.held[40], 12, 'the service credited 2 of 10');
  assert.deepEqual(p.said, [[40]]);
  door.refuse = 'offline';
  p.held[40] = 15;
  p.at(60_000); p.tracker.tick(); await p.settle();
  const lost = door.calls.at(-1);
  const sent = door.calls.length;
  door.refuse = null;
  p.held[40] = 16;
  p.at(ROLL_RETRY_MS); p.tracker.tick(); await p.settle();
  assert.equal(door.calls.length, sent + 1, 'asked again after the wait, inside the minute: it is the same claim');
  const again = door.calls.at(-1);
  assert.deepEqual([again.rid, again.deltas], [lost.rid, lost.deltas], 'the same claim, the same id');
  door.refuse = 'chapters-closed';
  p.held[40] = 30;
  p.at(120_000); p.tracker.tick(); await p.settle();
  const n = door.calls.length;
  p.at(3_600_000); p.tracker.tick(); await p.settle();
  assert.equal(door.calls.length, n, 'stopped');
  assert.deepEqual(p.stops, ['chapters-closed']);
});

// PIN MOVED (AUDIT CHAP C1/T1): the page's last claim never went - the lease is given up first; what was not claimed rides
// the save (test/net/audit_chap1.test.js holds the kept adoption)
test('CHAP1 the tab: a membership that moves is claimed with no reputation line, and the tab has no claim as the page goes (mutants: a membership move unclaimed)', async () => {
  const door = fakeDoor();
  const p = playing(door);
  p.tracker.tick(); await p.settle();
  p.join([{ f: 40, rank: 1 }, { f: 21, rank: 0 }]);
  p.tracker.tick(); await p.settle();
  assert.deepEqual([door.calls[1].deltas, door.calls[1].members], [{}, [{ f: 40, rank: 1 }, { f: 21, rank: 0 }]]);
  assert.equal('leave' in p.tracker, false);
});

test('CHAP1 the store\'s twenty-two, read off the DFU store\'s dict; none before FACTION.TXT stands', () => {
  const dict = new Map([[40, { rep: 33 }], [510, { rep: 9 }], [21, { rep: -4 }]]);
  assert.deepEqual(rollValuesOf({ dict }), { 21: -4, 40: 33 });
  assert.equal(rollValuesOf(null), null);
});

// ── THE WIRING ──────────────────────────────────────────────────────

test('CHAP1 the wiring: built online for a realm character alone, ticked in the online frame, its last adoption kept in the save; the switch ships at dev; the version moved; the delete takes the tables', () => {
  const world = hostText('src/scenes/world.js');
  assert.match(world, /const rollTracker = onlineOn && realmSession \? createRollTracker\(\{/);
  assert.match(world, /lease: \(\) => realmSession\.lease,/);
  assert.match(world, /\.\.\.rollEntityDoors\(\(\) => playerEntity\),/);
  assert.match(world, /kept: \(\) => rollKept,\n\s*keep: \(k\) => \{ rollKept = k; \},/);
  assert.match(world, /registerModSaveData\(ROLL_KEPT_VENDOR, \{/);
  assert.match(world, /renownTracker\?\.tick\(\);[^\n]*\n\s*rollTracker\?\.tick\(\);/);
  assert.doesNotMatch(world, /rollTracker\.leave/, 'PIN MOVED (AUDIT CHAP C1/T1): no claim as the page goes');
  assert.match(src('src/systems/realmSaves.js'), /get lease\(\) \{ return lost \? null : lease; \},/);
  assert.match(src('server-account/wrangler.toml'), /^CHAPTERS_OPEN = "on"$/m);   // PIN MOVED: CHAPTERS-ON - shipped "dev", opened to everyone
  assert.match(src('server-account/src/service.js'), /export const ACCOUNT_VERSION = 'acct176';/);   // PIN MOVED: acct176, STAFF-PANEL-SPEED (the staff panel pages answer in fewer database round trips: reads and the audit row folded together, two indexes; migrations 0161-0162); PIN MOVED: acct175, STAFF-PANEL5 (the staff panel relay half: follow tokens, Message on screen, the staff feeds, hidden staff, freeze and staff chat; acct174 on its branch, renumbered past STAFF-PANEL2-6 at its merge; migrations 0157-0160); PIN MOVED: acct174, STAFF-PANEL2-6 (the staff panel server side: reports and claims, Mute and Ban from the panel, notes, watchlist, settings, server notice, players, trade holds, item removals, economy, census, status tiles and Home; acct171 on its branch, then acct172, renumbered past AUDIT COLLECTIONS-II, SEA VENTURES and LOST-SPOILS at the merges; migrations 0149-0156); PIN MOVED: acct173, LOST-SPOILS (a boss's floor's leftovers to the post from the Lost and Found - /v1/post/lost; acct168 on its branch, renumbered past STAFF-PANEL1, CRAFT-PAYS, PISTOLET, AUDIT COLLECTIONS-II and SEA VENTURES at the merge; no migration); PIN MOVED: acct172, SEA VENTURES (acct168 on its branch, then acct169, renumbered past STAFF-PANEL1, CRAFT-PAYS, PISTOLET and AUDIT COLLECTIONS-II at the merges - the Eltheric Ocean ventures, one release: item law 11 and the nine records of the Eltheric Tidemail; the season boards of the sea, its bounties and the prizes of its wrecks; migrations from 0146); PIN MOVED: acct171, AUDIT COLLECTIONS-II (the glyph and icon doors answer the honours and the titles of a Charter; acct169 on its branch, renumbered past CRAFT-PAYS and PISTOLET at the merge); PIN MOVED: acct170, PISTOLET (the item law moved to 10 - the Dwarven Pistolet known to the judge, the Sunken Sovereign lawful as a gilded Pistolet and as the saber minted before; acct168 on its branch, renumbered past STAFF-PANEL1 and CRAFT-PAYS at the merge); PIN MOVED: acct169, CRAFT-PAYS and CRAFT-WRITS, one release (a Novice brew answers two potions; the crafting writs - craftWrits.js, /v1/writs/craft, migration 0145; acct168 and migration 0144 on its branch, renumbered past STAFF-PANEL1 at the merge); PIN MOVED: acct168, STAFF-PANEL1 (the staff panel sign-in - a password, a key only the Staff Panel extension holds and the role lists; staff keys, invites, sessions and an append-only audit, migration 0144); PIN MOVED: acct167, CAKE-CAP-SAID (a festival find answers the cakes found that day, and capped once they are all found; the account festival answers them too; acct166 on its branch, renumbered past ESSENCE-LOOSE and SOUL-LAW at the merge); PIN MOVED: acct166, ESSENCE-LOOSE (Arcane Essence of a piece made of loose goods is loose, never gold, and the Reforge spends it; migration 0142) and SOUL-LAW (item law 9 - a soul of the Enemy Expansion fifty lawful in a Soul Gem or Azura Star; migration 0143 lifts the holds law 8 laid on one), one release; PIN MOVED: acct165, WITCH1 (the Witches Festival - Soul Cakes, the Wyrd Sister sales, the Hearth Offerings, the profile icon) and STAR7 (the fallen stars held - /v1/star/claim, the star_spoils and stars_held of migration 0141, the star under the combat cap), one release; PIN MOVED: acct164, LEAN-READS (LEAN-WITNESS, YARD-SNAP, VENDOR-BOARD, WRIT-BOARD, ARENA-BOARD and SLOW-SHED - a hall's and a seat's late answers read no more, a town's yards, a region's traders and a season's arena board each one row, the writs by owner, a slow database shed as an overloaded one; migrations 0135-0139; acct159, acct160, acct161, acct162 then acct163 and 0133-0137 then 0134-0138 on its branch, renumbered past QL12, WB14, JUNGLE-WOODS, NAME-WORDS and PURSE-MEND at the merges); PIN MOVED: acct163, PURSE-MEND and COMPANION-DROP (staff mend a purse below nothing - realm-mend, the hold it made lifted - and a death in the zone takes the packs at the side off the record, a tab that never says it reads them refused; acct162 on its branch, renumbered past the acct162 of NAME-WORDS at the merge); PIN MOVED: acct162, NAME-WORDS (the name filter reads two more words anywhere - a handle holding either is refused; migration 0134 renames the account that held them); PIN MOVED: acct161, JUNGLE-WOODS (a jungle pixel stands 48 trees a day, every slot a tree, the service counting them as the law does; acct159 then acct160 on its branch, renumbered past QL12 and WB14 at the merges); PIN MOVED: acct160, WB14g (a kill receipt says its night portents, and a portent receipt rolls the Weir Key at the rite odds; acct159 on its branch, renumbered past the acct159 of QL12 at the merge); PIN MOVED: acct159, QL12 (the questlines claim - /v1/ql/claim, the five titles and the Covens Hoard key on the row; migration 0133; acct157 on its branch, renumbered past PLAN-1000 and FOE-BOUNDS, acct157 and acct158, at the merge); PIN MOVED: acct158, FOE-BOUNDS (cases from the relay count - records it stripped, asks past a budget; one line an account a batch; the Discord card says the spawn grants opened it); PIN MOVED: acct157, PLAN-1000 (PRIMARY-FOLD - the door reads in one statement, the spend one step over its row, a week kept, a chapter claim reads in one batch - and SESSION-SIGN, a pass on the hot routes; no migration; acct155 on its branch, renumbered past GRANT2 and TOWN-ECON TE2 at the merge); PIN MOVED: acct156, TOWN-ECON TE2 (the town economy share - /v1/towns/*, migration 0132; LAW-3 counterPaid in the item law); PIN MOVED: acct155, GRANT2 (the spawn grant measure kept - /v1/mod/grant-feed, /v1/mod/realm-grants; migration 0131); PIN MOVED: acct154, PRIVATE-REPORT (the private reports - /v1/report/*, a reader count on the post box; migration 0129 - acct152 then acct153, and 0126 then 0127, on its branch, renumbered past SAFE and INT16-INT19 at the merges); PIN MOVED: acct153, INT16-INT19 (the progression claims' seat and play line, the legacy record's law, a crafted piece out of its seller's record; migrations 0127 and 0128 - acct151 then acct152, and 0125 then 0126 and 0127, on its branch, renumbered past KEY-LAW and SAFE at the merges); PIN MOVED: acct152, SAFE (the chat safety arc and its audit - blocks, reports and cases, bans, the reviewer, Discord; migration 0126 - acct150 and 0125 on its branch, renumbered past WIKIMAID and KEY-LAW at the merge); PIN MOVED: acct151, KEY-LAW (item law 7 - the Weir Key's row known to the service's law, so a key holds no trade; migration 0125 - acct150 on its branch, renumbered past WIKIMAID at the merge); PIN MOVED: acct150, WIKIMAID (the WikiMaid title, its glyph and the Lilac Warren granted by name - titles.js WIKIMAID_HANDLES, no migration); PIN MOVED: acct149, EG-PLAY (the Elite Breach's Weir Keys, open, admission and claims, migration 0124 - 0112, 0113, 0114, 0116, 0117, 0119, 0120, 0121 then 0123 on its branch, renumbered past SEAT-FACTS' 0112, LAMP-KEEPER II's 0113, FIRMAMENT-ON's 0114, KG6's 0115, POI-1's 0116, SUMMON-REPAIR's 0117, PVP-ESCROW's 0118, SERPENT5's 0119, AUTO-HOLD's 0120, FIELD BUGS 2026-10-16b's 0121 and 0122 and MAKER-KEPT's 0123; acct119 on its branch, renumbered past GATHER-SPEED + MARKET-SPEED, D1-LOAD, BAL9, NAME-AS, HACKED-GOLD, ETHER-NODES, AUDIT ETHER-OW, MINE-PERKS, HOMES-SHED, BUSY-GATE, CRAFT-PROCS, SCHOOLS5, RECOVERY-SET, REVIVE, LAMP-KEEPER II, KG6, POI-1 and SUMMON-REPAIR + PVP-ESCROW + QUEST-HOME at the merges; acct141 at the fifth merge, renumbered past AUTO-HOLD, DECOR-BATCH, BOOKMARK-SPIRAL, BUSY-HEART and SHED-LONG at the sixth, then acct146, renumbered past STOLEN-GOODS AUDIT and REZ-BLOODLINE AUDIT R1 at the seventh, then acct148, renumbered past MAKER-KEPT at the eighth); PIN MOVED: acct148, MAKER-KEPT (item law 6 - a maker-era Aetheric piece keeps its maker's rows; migration 0123); PIN MOVED: acct147, REZ-BLOODLINE AUDIT R1 (the realm holds a Bloodline fall for a Resurrect of the party - the hold of realmDie, the new /v1/realm/raise and the rez-holds close each minute, legacy.js; migration 0121; acct141 on its branch, acct142 at the first merge, renumbered past the SHED-LONG acct145 of main at the second); PIN MOVED: acct146, STOLEN-GOODS AUDIT (a patron of a town takes no stolen piece off a hired trader - net/patronLaw.js patronTakes; no migration); PIN MOVED: acct145, SHED-LONG (BOOKMARK-SPIRAL rolled back, the shed 10 s - service.js, busyLaw.js; no migration); PIN MOVED: acct144, BUSY-HEART (the heartbeat and the motherlodes stand back while the database is overloaded - busyLaw.js; no migration); PIN MOVED: acct143, BOOKMARK-SPIRAL (the polled display reads with no bookmark off any instance, a missed session lookup asks the primary - service.js, accounts.js; no migration); PIN MOVED: acct142, DECOR-BATCH (a home room one request, a shunned home shop one more - decor.js; no migration); PIN MOVED: acct141, AUTO-HOLD (a copy locks its piece, never the character; the third law hold is timed - migration 0120; acct139 on its branch, renumbered past PRIMARY-TRIPS and AUDIT GUILD-WORDS at the merge); PIN MOVED: acct140, AUDIT GUILD-WORDS (a new membership recorded off the standing before a claim loss or after it, and every Roll answer saying what it paid of what was owed - npcRoll.js, no migration; acct139 on its branch, renumbered past PRIMARY-TRIPS acct139 at the merge); PIN MOVED: acct139, PRIMARY-TRIPS (the account primary round trips cut - the seats list, a checkpoint and a badge honours each one batch, the yards off a replica, a heartbeat reads before its beat, a hall bump off its own key rows; no migration); PIN MOVED: acct138, CART-AWAY (a wagon away from a death in the zone keeps its cargo - wild.js, no migration); PIN MOVED: acct137, SERPENT5 (Coilbreaker and The Maelstrom rolled on a dealing ship serpent kill first write - serpents.js, migration 0119; acct135 on its branch, renumbered past POI-1 acct135 and SUMMON-REPAIR acct136 of main at the merge); PIN MOVED: acct136, SUMMON-REPAIR + PVP-ESCROW + QUEST-HOME (staff mend one realm character - a FactionFile flag bit cleared and gold given back as a letter of credit, once a ticket; bible/06-Systems/Integrity-Arc.md INT6; migration 0117, 0113 on its branch and 0114 on the integration; a killer worn piece held in escrow until collected - wild_escrow and three wild routes; bible/11-Multiplayer/Wild-Zone.md section 4; migration 0118, 0113 on its branch and 0115 on the integration; the layouts read names every home by its building, so no quest picks a player home in a town never walked into; bible/01-Overview/bugs/Field-Bugs-2026-10-14.md QUEST-HOME; no migration; acct133 on each branch, one bump past LAMP-KEEPER II at the merge, acct134 on the integration, renumbered past KG6 acct134 and POI-1 acct135 at the merge of main); PIN MOVED: acct135, POI-1 + POI-4b + AUDIT POI (the POI store and the library's shelf - builders draft, an approver decides, the feed is live revisions only; bible/06-Systems/POI-Editor-Arc.md; migration 0116 - acct133, then acct134, and 0113, then 0114, on its branch, renumbered past LAMP-KEEPER II's and KG6's at the merges); PIN MOVED: acct134, KG6 (The King's Gambit's season board and its Grandmaster - gambit.js, the escrow's King's Gambit arm in cards.js; migration 0115 (0114 on its branch, renumbered past main's FIRMAMENT-ON 0114 at the merge); acct133 on its branch, renumbered past LAMP-KEEPER II's acct133 at the merge); PIN MOVED: acct133, LAMP-KEEPER II (I Love Lamp laid on the row) - before it acct132, REVIVE (a death taken back holds - putLineage takes the stored copy revived stamps into every copy sent; bible/06-Systems/Legacy-Arc.md REVIVE; no migration); PIN MOVED: acct131, RECOVERY-SET (eight recovery codes, each spent alone, and a new set from the profile behind the password and one current code - /v1/account/recovery-codes, recoveryLeft on the account view; bible/06-Systems/Accounts-And-Cloud-Saves-Arc.md RECOVERY-SET; no migration, the same column); PIN MOVED: acct130, SCHOOLS5 (the specialisation a save carries judged - a path the table holds, both its schools mastered; bible/06-Systems/Arcane-Specialisations.md section 7; no migration; acct127 on its branch, renumbered past HOMES-SHED, BUSY-GATE and CRAFT-PROCS at the merge); PIN MOVED: acct129, CRAFT-PROCS (a crafted piece record carries its mint version - stamped at the craft, kept by a temper, read by the market piece; no migration; acct126, acct127, then acct128, on its branch - renumbered past MINE-PERKS, HOMES-SHED and BUSY-GATE at the merges); PIN MOVED: acct128, BUSY-GATE (the reads busyLaw names stand back while the database is overloaded - the client holds them, the isolate sheds them a moment, every overload answer says its Retry-After; no migration); PIN MOVED: acct127, HOMES-SHED (the homes of a town and its Open Gates one request to the database where they were two; the siege blackout question answering a throw as every route does - an overload a 503; no migration); PIN MOVED: acct126, MINE-PERKS (a Surveyor's own surface veins and their gem on unwitnessed ground, the Deep Delver's x2 - bible/06-Systems/Professions-Arc.md 43; no migration); PIN MOVED: acct125, AUDIT ETHER-OW (C2-1: a Motherlode site is a pixel a Watch receipt can name - never past the Veil, where none is minted; no migration); PIN MOVED: acct124, ETHER-NODES (an Eltheric isle's node, a haul and its pixels' witnesses taken - the nodes' ground the Eltheric Ocean's box beside the Bay's map; no migration); PIN MOVED: acct123, HACKED-GOLD (a purse, a letter of credit or a coin pile past one DFU int a law finding; staff read who gained past the bucket and whom a character traded with; no migration; acct121 then acct122 on its branch, renumbered past BAL9 and NAME-AS at the merges); PIN MOVED: acct122, NAME-AS (the account name or the played realm character name as the name the room reads, chosen on the profile card, migration 0111; a letter to a friend and a board note author found by account; acct121 on its branch, renumbered past BAL9 at the merge); PIN MOVED: acct121, BAL9 (item law 3 - the potency and wellspring lines and the arcane three lawful; no migration); PIN MOVED: acct120, D1-LOAD (the seat registry read from the kept rows of the isolate by every caller, the lease read before it is written; no migration; acct119 on its branch, renumbered past GATHER-SPEED + MARKET-SPEED at the merge); PIN MOVED: acct119, GATHER-SPEED + MARKET-SPEED (a harvest's, the professions' state's and a market read's reads batched into a few round trips; the seats' places off the isolate's kept rows for a Levy, a Tithe and a board's listings; no migration; acct118 on its branch, renumbered past SEAT-LEASE at the merge); PIN MOVED: acct118, SEAT-LEASE (the Turning settled by one request at a time under a lease, migration 0110); PIN MOVED: acct117, YARD-SWEEP + HANDLE-EMAIL (the yard pieces above the height cap swept, migration 0109, and none served; a username never an email address, one chosen before read as its guest name); PIN MOVED: acct116, CRAFT-HOLD (the exploit audit: the INT3 hold follows a crafted piece, a held character with crafts at the account neither deleted nor depositing nor supplying, and the CRAFT-WORTH patron worth; no migration; acct115 on its branch, renumbered past BR5 at the merge); PIN MOVED: acct115, BR5 (the Patreon link page titled by the product name; acct113 on its branch, renumbered past GUILD-SEEN and GUILD3 at the merge); PIN MOVED: acct114, GUILD3 (the guilds made plain: the silver lines by kind and way, the whole list of holds, the Failing fall, the High Master by the band; no migration; acct112 then acct113 on its branch, renumbered past SCALE4f-h and GUILD-SEEN at the merges); PIN MOVED: acct113, GUILD-SEEN (the guild roster says when each member was last online); PIN MOVED: acct112, SCALE4f + SCALE4g + SCALE4h (acct111 on its branch, renumbered past HOME-VOTE at the merge); PIN MOVED: acct111, HOME-VOTE (a town's votes on its homes, migration 0108 - acct109, then acct110, on its branch, renumbered past PATRON-LOAD and PATRON-LOAD II at the merges); PIN MOVED: acct110, PATRON-LOAD II (the region's traders read by its own indexes - D1 overloaded; migration 0107); PIN MOVED: acct109, PATRON-LOAD (the region's traders read reckons no patrons - D1 overloaded; no migration); PIN MOVED: acct108, TECH1 (the item law's version 2 - a weapon's technique line, after LW15 took acct107; bible/05-Combat/Weapon-Techniques.md); PIN MOVED: acct107, LW15 (THE PATRONS, migration 0106 - acct105, then acct106, on its branch, renumbered past INT11-INT14 and SCALE4d at the merges); PIN MOVED: acct106, SCALE4d (the token's mint on a D1 session, no migration); PIN MOVED: acct105, INT11-INT14 (the INTEGRITY arc's lane 3, migration 0105); PIN MOVED: acct104, INT7-INT10 (the INTEGRITY arc's lane 2, migration 0104 - acct102 on its branch, renumbered past the Chapters' acct103 at the merge); PIN MOVED: acct103, the Chapters past UNWITNESSED-ORE's acct102 at the merge of main; PIN MOVED: acct102, the Chapters past BAG-CRAFT's acct101 and INT1-INT6's acct100 at the merge of main; PIN MOVED: acct100, the Chapters past CARDS9 and CARDS10's acct99 at the merge of main; PIN MOVED: acct99, the Chapters past PERMADEATH-HOUSES' acct98 at the merge of main; PIN MOVED: acct98, the Chapters (CHAP1-CHAP5b) past SERVER-POST and HOURS-FIRST's acct97 at the merge of main; PIN MOVED: acct97, the Chapters past TAVERN CARDS' acct96 at the merge; PIN MOVED: acct96, the Chapters past SCALE4's acct95 at the merge; PIN MOVED: acct95, the Chapters past SD9b at the merge; PIN MOVED: CHAP2a's acct94
  assert.match(src('server-account/migrations/0098_npc_roll.sql'), /CREATE TABLE IF NOT EXISTS npc_roll \(/);
  const realm = src('server-account/src/realm.js');
  for (const t of ['npc_roll', 'npc_roll_heads', 'npc_rep_events']) assert.match(realm, new RegExp(`DELETE FROM ${t} WHERE player = \\? AND char_id = \\?`));
});
