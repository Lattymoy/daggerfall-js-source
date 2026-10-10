// CHAP1 (2026-10-07, Mac: "how could we split away from DFU, completely overhaul the NPC guild system and reputation
// system"; "This is mostly with online in mind"; asked who holds it online, "Server-owned"; on the rest, "You make the
// best decisions"): THE ROLL - a realm character's standing with Daggerfall's own guilds (the twenty-two guild
// factions' reputation and its memberships) kept by the account service. bible/11-Multiplayer/Chapters-Arc.md section 3.
//
// The law (src/net/npcChapterLaw.js) against literals; the leaf the service reads (src/systems/guildFactions.js) as the
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
} from '../src/net/npcChapterLaw.js';
import { createRollTracker, rollValuesOf, rollRid } from '../src/net/npcRollTracker.js';
import * as leaf from '../src/systems/guildFactions.js';
import { GUILDS } from '../src/systems/guilds.js';
import { DIVINES, ORDERS } from '../src/systems/guildVariants.js';
import { MIN_REPUTATION, MAX_REPUTATION } from '../src/systems/factionRep.js';
import { readRoll, claimRoll, rollViewOf } from '../server-account/src/npcRoll.js';
import { standService, T0 } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
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
  assert.doesNotMatch(src('src/systems/guildFactions.js'), /^import /m, 'a leaf: the account service\'s graph reaches it and nothing past it');
  assert.doesNotMatch(src('src/systems/guildVariants.js'), /Akatosh: 26/, 'the divines are written once, in the leaf');
  assert.doesNotMatch(src('src/systems/guilds.js'), /factionId: 4[012],|factionId: 108,/, 'the four ids are written once, in the leaf');
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
// the save (test/audit_chap1.test.js holds the kept adoption)
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
  const world = src('src/scenes/world.js');
  assert.match(world, /const rollTracker = onlineOn && realmSession \? createRollTracker\(\{/);
  assert.match(world, /lease: \(\) => realmSession\.lease,/);
  assert.match(world, /\.\.\.rollEntityDoors\(\(\) => playerEntity\),/);
  assert.match(world, /kept: \(\) => rollKept,\n\s*keep: \(k\) => \{ rollKept = k; \},/);
  assert.match(world, /registerModSaveData\(ROLL_KEPT_VENDOR, \{/);
  assert.match(world, /renownTracker\?\.tick\(\);[^\n]*\n\s*rollTracker\?\.tick\(\);/);
  assert.doesNotMatch(world, /rollTracker\.leave/, 'PIN MOVED (AUDIT CHAP C1/T1): no claim as the page goes');
  assert.match(src('src/systems/realmSaves.js'), /get lease\(\) \{ return lost \? null : lease; \},/);
  assert.match(src('server-account/wrangler.toml'), /^CHAPTERS_OPEN = "dev"$/m);
  assert.match(src('server-account/src/service.js'), /export const ACCOUNT_VERSION = 'acct106';/);   // PIN MOVED: acct106, LW15 (THE PATRONS, migration 0106 - acct105 on its branch, renumbered past INT11-INT14 at the merge); PIN MOVED: acct105, INT11-INT14 (the INTEGRITY arc's lane 3, migration 0105); PIN MOVED: acct104, INT7-INT10 (the INTEGRITY arc's lane 2, migration 0104 - acct102 on its branch, renumbered past the Chapters' acct103 at the merge); PIN MOVED: acct103, the Chapters past UNWITNESSED-ORE's acct102 at the merge of main; PIN MOVED: acct102, the Chapters past BAG-CRAFT's acct101 and INT1-INT6's acct100 at the merge of main; PIN MOVED: acct100, the Chapters past CARDS9 and CARDS10's acct99 at the merge of main; PIN MOVED: acct99, the Chapters past PERMADEATH-HOUSES' acct98 at the merge of main; PIN MOVED: acct98, the Chapters (CHAP1-CHAP5b) past SERVER-POST and HOURS-FIRST's acct97 at the merge of main; PIN MOVED: acct97, the Chapters past TAVERN CARDS' acct96 at the merge; PIN MOVED: acct96, the Chapters past SCALE4's acct95 at the merge; PIN MOVED: acct95, the Chapters past SD9b at the merge; PIN MOVED: CHAP2a's acct94
  assert.match(src('server-account/migrations/0098_npc_roll.sql'), /CREATE TABLE IF NOT EXISTS npc_roll \(/);
  const realm = src('server-account/src/realm.js');
  for (const t of ['npc_roll', 'npc_roll_heads', 'npc_rep_events']) assert.match(realm, new RegExp(`DELETE FROM ${t} WHERE player = \\? AND char_id = \\?`));
});
