// PROF6 (2026-09-29, Mac: "continue") - GUILD WRITS, THE GUILD STORES AND COMMISSIONS AS THE SERVICE KEEPS THEM: a
// guild's writ posted from its Marks treasury by its Guildmaster, or an Officer within the week's budget; delivered from
// anyone's Stores into the guild Stores, paid pro rata less the tax; withdrawn and expired, its escrow home; the guild
// Stores' deposits and withdrawals and the own-again law; a guild keeping them refused its going; a commission naming a
// crafter and a piece, filled with a piece of their own make, which reaches the poster's pack; withdrawn, declined and
// expired; the repeats, the race, the report's escrow. Driven through the real Worker over node:sqlite with every
// migration applied (test/accountDb.mjs). bible/06-Systems/Professions-Arc.md 7, 11, 28.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import { holdPieces } from '../realmSeat.mjs';   // INT19: a commission's piece in its crafter's realm record
import { MARKS_MAX } from '../../src/net/marksLaw.js';
import { saleTax, saleTaxOn } from '../../src/net/marketLaw.js';
import { WRIT_S, GUILD_WRITS_MAX, GUILD_STORES_MAX, COMMISSIONS_MAX, writPayMax } from '../../src/net/writLaw.js';

let _now = T0;
const realNow = Date.now;
const clock = (s) => { _now = s; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
clock(T0);
let _rid = 0;
const rid = () => `wrt-${String(++_rid).padStart(6, '0')}`;
const DF = 17, WR = 23;
const P = (n) => n.toString(16).padStart(16, '0');
const OAK = 'log:oak';

async function stand(extra = {}) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', DEVELOPER_HANDLES: 'Mac', ...extra });
  const raw = s.env.DB._raw;
  const balance = (who) => Number(raw.prepare('SELECT balance FROM marks WHERE account = ?').get(who.id)?.balance ?? 0);
  const fund = (who, marks) => raw.prepare('INSERT INTO marks (account, balance) VALUES (?, ?) ON CONFLICT (account) DO UPDATE SET balance = excluded.balance').run(who.id, marks);
  const give = (who, material, origin, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, who.character, material, origin, qty);
  const held = (who, material) => Object.fromEntries(raw.prepare('SELECT origin, qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ?')
    .all(who.id, who.character, material).map((r) => [r.origin, Number(r.qty)]));
  const guildMarks = (g) => Number(raw.prepare('SELECT balance FROM guild_marks WHERE guild_id = ?').get(g)?.balance ?? 0);
  const guildHeld = (g, material) => Object.fromEntries(raw.prepare('SELECT dep_player, dep_char, qty FROM guild_prof_stores WHERE guild_id = ? AND material = ?')
    .all(g, material).map((r) => [r.dep_player ? `${r.dep_player}:${r.dep_char}` : 'guild', Number(r.qty)]));
  /** A crafted piece this account owns and made (a `prof_crafts` row names it), as the anvil writes them. PIN MOVED (INT19,
   *  Integrity-Arc section 7): a commission's fill takes the piece out of the crafter's realm record, so a realm
   *  character's piece stands there too, whole. */
  const piece = (who, provenance, { recipe = 'longsword:mithril', quality = 3, made = true } = {}) => {
    raw.prepare(`INSERT INTO products (provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at)
      VALUES (?, ?, ?, 'Silverthorn', ?, 120, 5, ?, 4242, 'p1.x', ?)`).run(provenance, who.id, who.character, recipe, quality, _now);
    if (who.at) holdPieces(s.env, who.character, [{ provenance, quality }]);
    if (made) {
      raw.prepare(`INSERT INTO prof_crafts (player, rid, char_id, recipe, quality, count, provenance, seed, xp, first, at, n)
        VALUES (?, ?, ?, ?, ?, 1, ?, 4242, 10, 0, ?, 'n')`).run(who.id, `craft-${provenance}`, who.character, recipe, quality, provenance, _now);
    }
  };
  const call = s.call;
  const list = (who, region = DF) => call('/v1/writs/list', { character: who.character, region }, who.secret);
  const post = (who, extra = {}) => call('/v1/writs/post', { character: who.character, region: DF, material: OAK, units: 100, pay: 3, rid: rid(), ...extra }, who.secret);
  const supply = (who, writ, units, extra = {}) => call('/v1/writs/supply', { character: who.character, region: DF, writ, units, rid: rid(), ...extra }, who.secret);
  const commission = (who, crafter, extra = {}) => call('/v1/writs/commission', {
    character: who.character, region: DF, crafter, recipe: 'longsword:mithril', quality: 2, pay: 900, rid: rid(), ...extra,
  }, who.secret);
  const fulfil = (who, id, provenance, extra = {}) => call('/v1/writs/fulfil', { character: who.character, region: DF, commission: id, provenance, wear: 1000, rid: rid(), ...extra }, who.secret);
  const stores = (who, kind, material, units, extra = {}) => call(`/v1/stores/guild-${kind}`, { character: who.character, material, units, rid: rid(), ...extra }, who.secret);
  /** The ledger's escrow end, in less out - what every escrow holds. */
  const escrowLedger = () => {
    const r = raw.prepare(`SELECT COALESCE(SUM(CASE WHEN dst_kind = 'escrow' THEN amount END), 0) AS i, COALESCE(SUM(CASE WHEN src_kind = 'escrow' THEN amount END), 0) AS o
      FROM marks_ledger`).get();
    return Number(r.i) - Number(r.o);
  };
  /** Minted less burnt is every balance, every guild's treasury and every escrow (MARKS1's ledger law, grown). */
  const addsUp = () => {
    const m = raw.prepare(`SELECT COALESCE(SUM(CASE WHEN src_kind = 'mint' THEN amount END), 0) AS m, COALESCE(SUM(CASE WHEN dst_kind = 'burn' THEN amount END), 0) AS b FROM marks_ledger`).get();
    const a = raw.prepare('SELECT COALESCE(SUM(balance), 0) AS s FROM marks').get().s;
    const g = raw.prepare('SELECT COALESCE(SUM(balance), 0) AS s FROM guild_marks').get().s;
    return Number(m.m) - Number(m.b) === Number(a) + Number(g) + escrowLedger();
  };
  /** A guild of four - Aldric its Guildmaster, Mara an Officer, Bran a Member, Cass a Recruit - its treasury `marks`. */
  const guild = async (marks = 20_000) => {
    const gm = await s.registered('Aldric', { renown: 10 });
    s.seedMarks(gm, 100_000, 'gm');
    const g = (await s.found(gm, { name: 'The Hound', tag: 'HND' })).body.guild;
    const join = async (handle) => {
      const w = await s.registered(handle, { renown: 1 });
      await call('/v1/guilds/invite', { character: gm.character, handle }, gm.secret);
      await call('/v1/guilds/answer', { character: w.character, guild: g.id, accept: true }, w.secret);
      return w;
    };
    const officer = await join('Mara'), member = await join('Bran'), recruit = await join('Cass');
    const roster = async () => (await call('/v1/guilds/mine', { character: gm.character }, gm.secret)).body.guild.members;
    const rank = async (who, r) => {
      const m = (await roster()).find((x) => x.name === who.handle).member;
      assert.equal((await call('/v1/guilds/rank', { character: gm.character, member: m, rank: r }, gm.secret)).status, 200);
    };
    await rank(officer, 1);
    await rank(member, 2);
    if (marks) assert.equal((await call('/v1/marks/guild/deposit', { character: gm.character, marks, rid: rid() }, gm.secret)).status, 200);
    return { gm, officer, member, recruit, g, rank };
  };
  return { ...s, raw, balance, fund, give, held, guildMarks, guildHeld, piece, list, post, supply, commission, fulfil, stores, escrowLedger, addsUp, guild };
}

// ─── THE DONE-WHEN ───────────────────────────────────────────────────

test('PROF6 DONE WHEN: a Guildmaster\'s writ for 100 Oak Logs at 3 Marks each in Daggerfall; an Officer\'s within the budget, refused past it; an outsider delivers 40 and a member 60, each paid pro rata less the tax, the logs in the guild Stores; the member\'s own deposit back own, the guild\'s bought; a crafter\'s note, a commission through its button, filled with a piece of their make, in the poster\'s pack', async () => {
  clock(T0);
  const s = await stand();
  const { gm, officer, member, g } = await s.guild(20_000);
  const out = await s.registered('Oswin');
  // the Guildmaster's writ: the whole pay held from the treasury
  const w = await s.post(gm);
  assert.equal(w.status, 200, JSON.stringify(w.body));
  assert.deepEqual([w.body.writ.units, w.body.writ.left, w.body.writ.pay, w.body.writ.escrow, w.body.guildMarks], [100, 100, 3, 300, 19_700]);
  // an Officer's within the budget the Guildmaster set, and past it refused
  assert.equal((await s.post(officer, { units: 10 })).body.error, 'writ-budget', 'no budget until set');
  const b = await s.call('/v1/writs/budget', { character: gm.character, marks: 500 }, gm.secret);
  assert.deepEqual([b.status, b.body.guild.budget, b.body.guild.left], [200, 500, 500]);
  assert.equal((await s.post(officer, { units: 100 })).status, 200);
  assert.equal((await s.post(officer, { units: 50 })).status, 200);
  assert.deepEqual([(await s.post(officer, { units: 20 })).status, (await s.post(officer, { units: 20 })).body.error], [409, 'writ-budget'], '450 + 60 > 500');
  assert.equal((await s.list(officer)).body.guild.left, 50);
  // an outsider delivers 40 - paid 120 less the tax; the member 60 (bought first), the writ filled
  s.give(out, OAK, 'own', 40);
  const d1 = await s.supply(out, w.body.writ.id, 40);
  assert.equal(d1.status, 200, JSON.stringify(d1.body));
  assert.deepEqual([d1.body.fill.pay, d1.body.fill.tax, s.balance(out)], [120 - saleTax(120), saleTax(120), 120 - saleTax(120)]);
  s.give(member, OAK, 'own', 50); s.give(member, OAK, 'bought', 20);
  const before = s.balance(member);
  const d2 = await s.supply(member, w.body.writ.id, 60);
  assert.equal(d2.status, 200, JSON.stringify(d2.body));
  assert.deepEqual([d2.body.fill.tax, s.balance(member) - before], [saleTaxOn(120, 180), 180 - saleTaxOn(120, 180)], 'the running total\'s tax');
  assert.deepEqual(s.held(member, OAK), { own: 10 }, 'bought first');
  assert.deepEqual([d2.body.writ.state, d2.body.writ.left, d2.body.writ.escrow], ['filled', 0, 0]);
  assert.deepEqual(s.guildHeld(g.id, OAK), { guild: 100 }, 'the writ\'s units the guild\'s');
  // the member deposits their own 10; an Officer withdraws 105 - the guild's 100, then the member's 5, all bought
  assert.equal((await s.stores(member, 'deposit', OAK, 10)).status, 200);
  assert.deepEqual(s.guildHeld(g.id, OAK), { guild: 100, [`${member.id}:${member.character}`]: 10 });
  // AUDIT 31 R1: a Member takes out no more than their own deposit - the rest is an Officer's or the Guildmaster's
  assert.equal((await s.stores(member, 'withdraw', OAK, 11)).body.error, 'guild-stores-mine', 'past their own 10');
  const o = await s.stores(officer, 'withdraw', OAK, 105);
  assert.deepEqual([o.status, o.body.move.own, s.held(officer, OAK)], [200, 0, { bought: 105 }]);
  // the member's own deposit comes back own - no rank asked
  const back = await s.stores(member, 'withdraw', OAK, 5);
  assert.deepEqual([back.body.move.own, s.held(member, OAK)], [5, { own: 5 }]);
  assert.deepEqual(s.guildHeld(g.id, OAK), {}, 'emptied, its rows gone');
  const moves = s.raw.prepare('SELECT delta, who FROM guild_store_ledger WHERE guild_id = ? ORDER BY seq').all(g.id).map((r) => [Number(r.delta), r.who]);
  assert.deepEqual(moves, [[40, 'Oswin'], [60, 'Bran'], [10, 'Bran'], [-100, 'Mara'], [-5, 'Mara'], [-5, 'Bran']], 'every movement on the ledger');
  // THE COMMISSION: a crafter's note with its button; a reader commissions through it; the crafter fills it
  const smith = await s.seated('Silverthorn'), ann = await s.registered('Ann');   // PIN MOVED (INT19): the crafter a realm character - the piece leaves its record
  s.seedMarks(ann, 5_000);
  const note = await s.call('/v1/board/pin', { map: 1_000, subject: 'Blades made', body: 'Mithril, to order.', days: 7, button: 'commission', rid: rid() }, smith.secret);
  assert.equal(note.status, 200, JSON.stringify(note.body));
  const c = await s.commission(ann, 'silverthorn');
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.deepEqual([c.body.commission.crafter, c.body.commission.quality, s.balance(ann)], ['Silverthorn', 2, 4_100]);
  assert.equal((await s.list(smith)).body.yours.commissions[0].forMe, true, 'the crafter sees it named');
  const PV = P(0x6a1);
  s.piece(smith, PV, { quality: 3 });
  const f = await s.fulfil(smith, c.body.commission.id, PV);
  assert.equal(f.status, 200, JSON.stringify(f.body));
  assert.deepEqual([f.body.commission.state, s.balance(smith)], ['filled', 900 - saleTax(900)]);
  assert.equal(s.raw.prepare('SELECT owner FROM products WHERE provenance = ?').get(PV).owner, ann.id, 'its owner moved');
  const road = (await s.call('/v1/market/read', { character: ann.character, region: DF, view: 'mine', hubs: {} }, ann.secret)).body.road;
  const got = road.find((x) => x.piece?.provenance === PV);
  assert.deepEqual([got.ready, got.why], [true, 'bought'], 'at once');
  const col = await s.call('/v1/market/collect', { character: ann.character, delivery: got.id, rid: rid() }, ann.secret);
  assert.deepEqual([col.status, col.body.piece.provenance, col.body.piece.quality, col.body.piece.wear], [200, PV, 3, 1000]);
  assert.equal(s.escrowLedger(), 100 * 3 + 50 * 3, 'the Officers\' two writs still hold theirs; the filled one nothing');
  assert.ok(s.addsUp());
});

// ─── GUILD WRITS ─────────────────────────────────────────────────────

test('PROF6 service: a guild writ\'s refusals - a Member or Recruit, a material nothing yields, a pay past 1.5 x the value, the treasury short, twenty open; a delivery elsewhere, past what is left, from Stores short, past the guild Stores\' room or the Marks cap', async () => {
  clock(T0);
  const s = await stand();
  const { gm, officer, member, recruit, g } = await s.guild(1_000);
  assert.equal((await s.post(member)).body.error, 'guild-rank');
  assert.equal((await s.post(recruit)).body.error, 'guild-rank');
  assert.equal((await s.post(gm, { material: 'part:daedra-heart' })).body.error, 'bad-material', 'nothing the service counts yields it - PIN MOVED (DAEDRIC-SMELT): the forge smelts the Daedric ingot, and its heart enters the Stores loose alone, the loose door\'s as CLOTH-GEMS\' graded gems are, no writ\'s material (AUDIT 31 L6\'s own word waits for the next unyielded material)');
  assert.equal((await s.post(gm, { material: 'no-such' })).body.error, 'bad-material');
  assert.equal((await s.post(gm, { pay: writPayMax(OAK) + 1 })).body.error, 'writ-pay');
  assert.equal((await s.post(gm, { units: 5_001 })).body.error, 'bad-units');
  assert.equal((await s.post(gm, { units: 400, pay: 3 })).body.error, 'guild-marks-short', '1,200 of 1,000');
  const outsider = await s.registered('Oswin');
  assert.equal((await s.post(outsider)).body.error, 'no-guild');
  for (let i = 0; i < GUILD_WRITS_MAX; i++) {
    if (i === 10) clock(T0 + 3_601);   // the hour's twenty posts (20: "writ posts 20") are not what this pins
    assert.equal((await s.post(gm, { units: 10, pay: 1 })).status, 200);
  }
  assert.equal((await s.post(gm, { units: 1, pay: 1 })).body.error, 'guild-writs-max');
  const id = (await s.list(gm)).body.yours.guildWrits[0].id;
  s.give(outsider, OAK, 'own', 5);
  assert.equal((await s.supply(outsider, id, 5, { region: WR })).body.error, 'writ-elsewhere');
  assert.equal((await s.supply(outsider, id, 11)).body.error, 'writ-short');
  assert.equal((await s.supply(outsider, id, 6)).body.error, 'stores-short', '6 of the 10 left, 5 held');
  s.give(outsider, OAK, 'own', 4);
  assert.equal((await s.supply(outsider, id, 5)).body.error, 'stores-short');
  // the guild Stores' room
  s.raw.prepare(`INSERT INTO guild_prof_stores (guild_id, material, dep_player, dep_char, qty, moved_by, moved_at) VALUES (?, ?, '', '', ?, 'x', 1)`)
    .run(g.id, OAK, GUILD_STORES_MAX - 3);
  assert.equal((await s.supply(outsider, id, 4)).body.error, 'guild-stores-full');
  s.raw.prepare('UPDATE guild_prof_stores SET qty = 1 WHERE guild_id = ?').run(g.id);
  // a member's own deposit counts against the room too, whatever row it lands in
  s.raw.prepare('UPDATE guild_prof_stores SET qty = ? WHERE guild_id = ?').run(GUILD_STORES_MAX - 1, g.id);
  s.give(member, OAK, 'own', 2);
  assert.equal((await s.stores(member, 'deposit', OAK, 2)).body.error, 'guild-stores-full');
  s.raw.prepare('UPDATE guild_prof_stores SET qty = 1 WHERE guild_id = ?').run(g.id);
  // the deliverer's cap
  s.fund(outsider, MARKS_MAX);
  assert.equal((await s.supply(outsider, id, 4)).body.error, 'marks-full');
  s.fund(outsider, 0);
  const ok = await s.supply(outsider, id, 4);
  assert.deepEqual([ok.status, ok.body.writ.left], [200, 6]);
  // the Officer's own post withdrawn by them; another's never; the Guildmaster any
  await s.call('/v1/writs/budget', { character: gm.character, marks: 100 }, gm.secret);
  s.raw.prepare(`UPDATE guild_writs SET state = 'withdrawn', returned = 1, escrow = 0 WHERE guild_id = ? AND id != ?`).run(g.id, id);
  const mine = await s.post(officer, { units: 10, pay: 1 });
  const flags = Object.fromEntries((await s.list(officer)).body.yours.guildWrits.map((w) => [w.id, w.may]));
  assert.deepEqual([flags[mine.body.writ.id], flags[id]], [true, false], 'an Officer withdraws their own, never the Guildmaster\'s');
  assert.equal((await s.list(gm)).body.yours.guildWrits.every((w) => w.may), true, 'the Guildmaster any');
  assert.equal((await s.call('/v1/writs/budget', { character: officer.character, marks: 1 }, officer.secret)).body.error, 'guild-rank');
  assert.equal((await s.call('/v1/writs/withdraw', { character: officer.character, writ: id, rid: rid() }, officer.secret)).body.error, 'guild-rank', 'not theirs');
  const R = rid();
  const wd = await s.call('/v1/writs/withdraw', { character: officer.character, writ: mine.body.writ.id, rid: R }, officer.secret);
  assert.deepEqual([wd.status, wd.body.writ.state, wd.body.writ.escrow], [200, 'withdrawn', 0]);
  const again = await s.call('/v1/writs/withdraw', { character: officer.character, writ: mine.body.writ.id, rid: rid() }, officer.secret);
  assert.equal(again.body.repeat, true);
  const treasury = s.guildMarks(g.id);
  const gw = await s.call('/v1/writs/withdraw', { character: gm.character, writ: id, rid: rid() }, gm.secret);
  assert.deepEqual([gw.status, s.guildMarks(g.id) - treasury], [200, 6], 'what was left, home');
  // the tax is the running total's: 19 Marks untaxed, 19 more taxed a Mark (5% of 38), never nought twice
  const iron = await s.post(gm, { material: 'metal:iron', units: 40, pay: 1 });
  s.give(outsider, 'metal:iron', 'own', 38);
  const t1 = await s.supply(outsider, iron.body.writ.id, 19), t2 = await s.supply(outsider, iron.body.writ.id, 19);
  assert.deepEqual([t1.body.fill.tax, t2.body.fill.tax], [saleTax(19), saleTaxOn(19, 19)]);
  assert.deepEqual([saleTax(19), saleTax(19) + saleTaxOn(19, 19)], [0, saleTax(38)], 'split, the tax whole');
  assert.ok(s.addsUp());
});

test('PROF6 service: a guild writ past its seventh day is closed by anyone\'s Work read and its escrow home - waiting while the treasury is full; a guild keeping its Stores or a writ refused its going, its Marks unswept', async () => {
  clock(T0);
  const s = await stand();
  const { gm, g } = await s.guild(1_000);
  const w = await s.post(gm, { units: 100, pay: 2 });
  assert.equal(s.guildMarks(g.id), 800);
  const stranger = await s.registered('Oswin');
  clock(T0 + WRIT_S + 1);
  s.raw.prepare('UPDATE guild_marks SET balance = ? WHERE guild_id = ?').run(MARKS_MAX - 100, g.id);
  await s.list(stranger);
  assert.deepEqual(Object.values(s.raw.prepare('SELECT state, returned FROM guild_writs WHERE id = ?').get(w.body.writ.id)), ['expired', 0], 'the treasury full: it waits');
  s.raw.prepare('UPDATE guild_marks SET balance = 800 WHERE guild_id = ?').run(g.id);
  await s.list(stranger, WR);
  assert.deepEqual([s.raw.prepare('SELECT returned FROM guild_writs WHERE id = ?').get(w.body.writ.id).returned, s.guildMarks(g.id)], [1, 1_000], 'anyone\'s read, any region');
  // a guild keeping a writ or its Stores does not go, and its Marks stay put
  const w2 = await s.post(gm, { units: 10, pay: 1 });
  const gmBefore = s.balance(gm);
  const d = await s.call('/v1/guilds/disband', { character: gm.character }, gm.secret);
  assert.deepEqual([d.status, d.body.error, s.balance(gm), s.guildMarks(g.id)], [409, 'guild-writs', gmBefore, 990]);
  await s.call('/v1/writs/withdraw', { character: gm.character, writ: w2.body.writ.id, rid: rid() }, gm.secret);
  s.give(gm, OAK, 'own', 3);
  await s.stores(gm, 'deposit', OAK, 3);
  const d2 = await s.call('/v1/guilds/disband', { character: gm.character }, gm.secret);
  assert.deepEqual([d2.body.error, s.guildMarks(g.id)], ['guild-stores', 1_000]);
  await s.stores(gm, 'withdraw', OAK, 3);
  // a guild with no Marks at all keeps its Stores too: nothing swept, nothing lost with the cascade
  const pena = await s.registered('Pena', { renown: 10 });
  const g2 = (await s.found(pena, { name: 'The Kiln', tag: 'KLN' })).body.guild;
  s.give(pena, OAK, 'own', 2);
  await s.stores(pena, 'deposit', OAK, 2);
  assert.equal((await s.call('/v1/guilds/disband', { character: pena.character }, pena.secret)).body.error, 'guild-stores');
  assert.deepEqual(s.guildHeld(g2.id, OAK), { [`${pena.id}:${pena.character}`]: 2 }, 'kept');
  const d3 = await s.call('/v1/guilds/disband', { character: gm.character }, gm.secret);
  assert.equal(d3.status, 200, JSON.stringify(d3.body));
  assert.equal(s.balance(gm), gmBefore + 1_000, 'the Marks to the Guildmaster, as ever');
  assert.ok(s.addsUp());
});

test('PROF6 service: a delivery asked twice is one; a post asked twice is one; a spent id refused; two deliveries of the last units at once - one stands; the week\'s budget is the seat week\'s', async () => {
  clock(T0);
  const s = await stand();
  const { gm, officer, g } = await s.guild(5_000);
  const R = rid();
  const a = await s.post(gm, { units: 10, pay: 3, rid: R });
  const b = await s.post(gm, { units: 10, pay: 3, rid: R });
  assert.deepEqual([b.body.repeat, b.body.writ.id, s.guildMarks(g.id)], [true, a.body.writ.id, 4_970]);
  const out = await s.registered('Oswin'), bran = await s.registered('Brandt');
  s.give(out, OAK, 'own', 20); s.give(bran, OAK, 'own', 20);
  const D = rid();
  const x = await s.supply(out, a.body.writ.id, 4, { rid: D });
  const y = await s.supply(out, a.body.writ.id, 4, { rid: D });
  assert.deepEqual([y.body.repeat, s.held(out, OAK).own], [true, 16]);
  // a spent id: its row pruned, its ledger line forever
  s.raw.prepare('DELETE FROM guild_writ_fills WHERE filler = ? AND rid = ?').run(out.id, D);
  assert.equal((await s.supply(out, a.body.writ.id, 1, { rid: D })).body.error, 'prof-rid');
  assert.equal(x.status, 200);
  // the races, staged: Oswin's decision waits while Brandt's whole delivery lands - two of the six left (the running
  // total Oswin's tax was taken on has moved: refused, read again), then the last four (the writ gone)
  const prep = s.env.DB.prepare.bind(s.env.DB), batch = s.env.DB.batch.bind(s.env.DB);
  let first = null;
  s.env.DB.prepare = (sql) => Object.assign(prep(sql), { _sql: sql });
  s.env.DB.batch = async (list) => {
    if (first && list.some((st) => /INSERT OR IGNORE INTO guild_writ_fills/.test(st._sql ?? ''))) { const go = first; first = null; await go(); }
    return batch(list);
  };
  let other;
  first = async () => { other = await s.supply(bran, a.body.writ.id, 2); };
  const moved = await s.supply(out, a.body.writ.id, 2);
  assert.deepEqual([other.status, moved.body.error], [200, 'writ-moved']);
  first = async () => { other = await s.supply(bran, a.body.writ.id, 4); };
  const late = await s.supply(out, a.body.writ.id, 4);
  s.env.DB.prepare = prep; s.env.DB.batch = batch;
  assert.deepEqual([other.status, late.body.error], [200, 'writ-gone']);
  assert.deepEqual(s.held(out, OAK), { own: 16 }, 'nothing of Oswin\'s taken');
  // an Officer demoted while the post is asked: the decision asks the rank itself
  await s.call('/v1/writs/budget', { character: gm.character, marks: 1_000 }, gm.secret);
  const demote = async () => {
    const m = (await s.call('/v1/guilds/mine', { character: gm.character }, gm.secret)).body.guild.members.find((x) => x.name === officer.handle).member;
    await s.call('/v1/guilds/rank', { character: gm.character, member: m, rank: 2 }, gm.secret);
  };
  s.env.DB.prepare = (sql) => Object.assign(prep(sql), { _sql: sql });
  s.env.DB.batch = async (list) => {
    if (first && list.some((st) => /INSERT OR IGNORE INTO guild_writs/.test(st._sql ?? ''))) { const go = first; first = null; await go(); }
    return batch(list);
  };
  first = demote;
  const lost = await s.post(officer, { units: 5, pay: 1 });
  s.env.DB.prepare = prep; s.env.DB.batch = batch;
  assert.equal(lost.body.error, 'guild-rank');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM guild_writs WHERE poster = ? AND units = 5').get(officer.id).n, 0);
  await s.call('/v1/guilds/rank', { character: gm.character, member: (await s.call('/v1/guilds/mine', { character: gm.character }, gm.secret)).body.guild.members.find((x) => x.name === officer.handle).member, rank: 1 }, gm.secret);
  // a post's spent id: its row pruned, its ledger line forever
  s.raw.prepare('DELETE FROM guild_writs WHERE poster = ? AND rid = ?').run(gm.id, R);
  assert.equal((await s.post(gm, { units: 10, pay: 3, rid: R })).body.error, 'prof-rid');
  // the budget counts the seat week: a new week, a new budget
  await s.call('/v1/writs/budget', { character: gm.character, marks: 30 }, gm.secret);
  assert.equal((await s.post(officer, { units: 10, pay: 3 })).status, 200);
  assert.equal((await s.post(officer, { units: 1, pay: 1 })).body.error, 'writ-budget');
  const sunday = Date.UTC(2026, 9, 4, 18, 0, 0) / 1000;   // a Turning
  clock(Math.max(T0, sunday) + 7 * 86400 * Math.ceil(Math.max(0, T0 - sunday) / (7 * 86400)) + 1);
  assert.equal((await s.post(officer, { units: 10, pay: 3 })).status, 200, 'the next seat week');
  assert.ok(s.addsUp());
});

// ─── COMMISSIONS ─────────────────────────────────────────────────────

test('PROF6 service: a commission\'s refusals - oneself, no such crafter, arrows, a quality where none is taken, five open, the Marks; a fill by another, elsewhere, worn, the wrong piece, one bought not made, one listed; the fill asked twice is one', async () => {
  clock(T0);
  const s = await stand();
  const smith = await s.seated('Silverthorn'), ann = await s.registered('Ann'), cid = await s.seated('Cid');   // PIN MOVED (INT19): the crafters realm characters
  s.seedMarks(ann, 5_000); s.seedMarks(cid, 5_000);
  assert.equal((await s.commission(ann, 'Ann')).body.error, 'commission-self');
  assert.equal((await s.commission(ann, 'Nobody')).body.error, 'commission-crafter');
  assert.equal((await s.commission(ann, 'Silverthorn', { recipe: 'arrows:north', quality: null })).body.error, 'commission-recipe');
  assert.equal((await s.commission(ann, 'Silverthorn', { recipe: 'kit:iron', quality: 1 })).body.error, 'bad-quality');
  assert.equal((await s.commission(ann, 'Silverthorn', { pay: 5_001 })).body.error, 'marks-short');
  const ids = [];
  for (let i = 0; i < COMMISSIONS_MAX; i++) ids.push((await s.commission(ann, 'Silverthorn', { pay: 10 })).body.commission.id);
  assert.equal((await s.commission(ann, 'Silverthorn', { pay: 10 })).body.error, 'commissions-max');
  // twenty naming one crafter, from anyone: the twenty-first refused
  for (const h of ['Dora', 'Eli', 'Fen']) {
    const w = await s.registered(h);
    s.seedMarks(w, 100);
    for (let i = 0; i < COMMISSIONS_MAX; i++) assert.equal((await s.commission(w, 'Silverthorn', { pay: 10 })).status, 200);
  }
  const gil = await s.registered('Gil');
  s.seedMarks(gil, 100);
  assert.equal((await s.commission(gil, 'Silverthorn', { pay: 10 })).body.error, 'commissions-crafter-max', '4 x 5 = 20 name Silverthorn');
  assert.equal((await s.commission(gil, 'Cid', { pay: 10 })).status, 200, 'another crafter is free');
  const id = ids[0];
  s.piece(smith, P(1), { quality: 2 });
  s.piece(cid, P(2), { quality: 4 });
  assert.equal((await s.fulfil(cid, id, P(2))).body.error, 'commission-not-yours');
  assert.equal((await s.fulfil(smith, id, P(1), { region: WR })).body.error, 'commission-elsewhere', 'AUDIT 31 L6: a commission\'s own word');
  assert.equal((await s.fulfil(smith, id, P(1), { wear: 999 })).body.error, 'commission-worn');
  s.piece(smith, P(3), { recipe: 'longsword:steel', quality: 4 });
  assert.equal((await s.fulfil(smith, id, P(3))).body.error, 'commission-piece', 'another recipe');
  s.piece(smith, P(4), { quality: 1 });
  assert.equal((await s.fulfil(smith, id, P(4))).body.error, 'commission-piece', 'under the quality asked');
  s.piece(smith, P(5), { quality: 4, made: false });
  assert.equal((await s.fulfil(smith, id, P(5))).body.error, 'commission-not-made', 'bought, not made');
  s.raw.prepare('UPDATE products SET listed = 1 WHERE provenance = ?').run(P(1));
  assert.equal((await s.fulfil(smith, id, P(1))).body.error, 'market-listed');
  s.raw.prepare('UPDATE products SET listed = 0 WHERE provenance = ?').run(P(1));
  const F = rid();
  const f = await s.fulfil(smith, id, P(1), { rid: F });
  const g = await s.fulfil(smith, id, P(1), { rid: F });
  assert.deepEqual([f.status, g.body.repeat, s.balance(smith)], [200, true, 10 - saleTax(10)]);
  assert.equal((await s.fulfil(smith, ids[1], P(1))).body.error, 'market-not-yours', 'the piece is Ann\'s now');
  assert.ok(s.addsUp());
});

test('PROF6 service: a commission withdrawn by its poster, declined by its crafter, expired, or its crafter gone - each pay back once, under the cap; the Work read shows this region\'s and "yours"; the report\'s escrow is the ledger\'s', async () => {
  clock(T0);
  const s = await stand();
  const smith = await s.registered('Silverthorn'), ann = await s.registered('Ann'), mac = await s.registered('Mac');
  s.seedMarks(ann, 5_000);
  const a = await s.commission(ann, 'Silverthorn', { pay: 100 });
  const b = await s.commission(ann, 'Silverthorn', { pay: 200 });
  const c = await s.commission(ann, 'Silverthorn', { pay: 300, region: WR });
  const d = await s.commission(ann, 'Silverthorn', { pay: 400 });
  assert.equal(s.balance(ann), 4_000);
  const view = (await s.list(ann)).body;
  assert.deepEqual(view.commissions.map((x) => x.pay).sort(), [100, 200, 400], 'this region\'s');
  assert.equal(view.yours.commissions.length, 4, 'yours, every region');
  // withdrawn at the cap: it stands withdrawn, its pay home on a read with room
  const held0 = s.balance(ann);
  s.fund(ann, MARKS_MAX);
  const capped = await s.call('/v1/writs/cancel', { commission: a.body.commission.id, rid: rid() }, ann.secret);
  assert.deepEqual([capped.status, capped.body.commission.state, capped.body.commission.returned], [200, 'withdrawn', false]);
  s.fund(ann, held0);
  await s.list(ann);
  assert.equal(s.balance(ann), 4_100, 'home on the read');
  assert.equal((await s.call('/v1/writs/cancel', { commission: a.body.commission.id, rid: rid() }, ann.secret)).body.repeat, true);
  assert.equal((await s.call('/v1/writs/decline', { commission: b.body.commission.id, rid: rid() }, ann.secret)).body.error, 'no-writ', 'the poster declines nothing');
  const dec = await s.call('/v1/writs/decline', { commission: b.body.commission.id, rid: rid() }, smith.secret);
  assert.deepEqual([dec.body.commission.state, s.balance(ann)], ['declined', 4_300]);
  // a full balance: the return waits for room
  const had = s.balance(ann);
  s.fund(ann, MARKS_MAX);
  clock(T0 + WRIT_S + 1);
  await s.list(ann);
  assert.equal(s.raw.prepare('SELECT returned FROM commissions WHERE id = ?').get(c.body.commission.id).returned, 0);
  s.fund(ann, had);
  await s.list(ann);
  assert.equal(s.balance(ann), had + 300 + 400, 'both expired, both home');
  // a crafter gone: the poster's read declines it and returns it
  const e = await s.commission(ann, 'Silverthorn', { pay: 50 });
  s.raw.prepare('DELETE FROM players WHERE id = ?').run(smith.id);
  await s.list(ann);
  assert.deepEqual([s.raw.prepare('SELECT state FROM commissions WHERE id = ?').get(e.body.commission.id).state, s.balance(ann)], ['declined', had + 700]);
  assert.equal(d.status, 200);
  // the report's escrow: the ledger's end
  const g2 = await s.commission(ann, 'Mac', { pay: 70 });
  const rep = await s.call('/v1/marks/report', {}, mac.secret);
  assert.deepEqual([rep.body.circulation.escrow, s.escrowLedger()], [70, 70]);
  assert.equal(g2.status, 200);
  assert.ok(s.addsUp());
});

test('PROF6 service: the notes\' rebuild for the fourth button keeps every note and its reports, and a note gone still takes its reports (0034_writs.sql over a board that stood before it)', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const { readdirSync, readFileSync } = await import('node:fs');
  const dir = new URL('../../server-account/migrations/', import.meta.url);
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    if (f === '0034_writs.sql') {
      db.exec(`INSERT INTO players (id, handle, handle_lc, guest_name, created_at, last_seen) VALUES ('p1', 'Ann', 'ann', 'A b', 1, 1), ('p2', 'Bob', 'bob', 'B c', 1, 1)`);
      db.exec(`INSERT INTO board_notes (id, map_id, author, author_name, subject, body, button, at, expires_at, rid) VALUES ('n1', 5, 'p1', 'Ann', 's', 'b', 'duel', 1, 999, 'rid00001')`);
      db.exec(`INSERT INTO board_reports (note_id, reporter, at) VALUES ('n1', 'p2', 2)`);
    }
    db.exec(readFileSync(new URL(f, dir), 'utf8'));
  }
  assert.deepEqual(db.prepare('SELECT note_id, reporter FROM board_reports').all().map((r) => [r.note_id, r.reporter]), [['n1', 'p2']], 'the report kept');
  assert.deepEqual(db.prepare('SELECT id, button FROM board_notes').all().map((r) => [r.id, r.button]), [['n1', 'duel']]);
  db.exec(`INSERT INTO board_notes (id, map_id, author, author_name, subject, body, button, at, expires_at, rid) VALUES ('n2', 5, 'p1', 'Ann', 's', 'b', 'commission', 1, 999, 'rid00002')`);
  db.exec(`DELETE FROM board_notes WHERE id = 'n1'`);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM board_reports').get().n, 0, 'the cascade stands');
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});
