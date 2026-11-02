// SEAT1d (2026-10-01, Mac: "Finish the seats"; "Continue"): HOLDING A SEAT, AS THE SERVICE KEEPS IT - the Turning pays
// each Charter's upkeep (Overreach's share, the crown's scale), puts a short treasury in Neglect and lapses a Charter
// neglected twice, and reckons every row of Standing; a challenger's influence at a seat in Unrest risen a quarter; the
// Tithe set once a week and taken across its bailiwick from a sale and a courier's share; the Edicts proclaimed for the
// coming week and made law (or let fall) at the Turning - Open Gates' homes, the Levy's stockpile, the Bounty's camps.
// Driven through the real Worker over node:sqlite with every migration applied (test/accountDb.mjs).
// bible/11-Multiplayer/Seats-Arc.md 7.1-7.3, 7.6; `06-Systems/Online-Arc.md` SEAT1d.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../accountDb.mjs';
import { holdPieces } from '../realmSeat.mjs';   // INT19: a crafted piece in its seller's realm record
import { utcDay, MARKS_MAX } from '../../src/net/marksLaw.js';
import { sharedClassicMinutes } from '../../src/net/wire.js';
import { gameDayAt, gateTimes } from '../../src/net/gate/gateLaw.js';
import { boulders, nodeKey } from '../../src/net/nodeLaw.js';
import { saleTax, courierFee, roadPixels, AUCTION_S } from '../../src/net/marketLaw.js';
import {
  seatReportText, seatWeekOf, seatWeekStartMs, SEAT_MEMBER_WAIT_S, SEAT_UPKEEP, CROWN_SCALE, EDICTS,
} from '../../src/net/townSeatLaw.js';

const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const ASHFIELD = { key: 3022, name: 'Ashfield', region: 21, tier: 'palace', pixel: [470, 160] };
const ALCAIRE = { key: 3034, name: 'Alcaire Keep', region: 34, tier: 'palace', pixel: [520, 130] };
const YKALON = { key: 3040, name: 'Ykalon', region: 40, tier: 'palace', pixel: [560, 100] };
const WAYREST = { key: 5023, name: 'Wayrest', region: 23, tier: 'crown', pixel: [590, 166] };
const DAY = 86400;
const W = seatWeekOf(T0 * 1000);
const turning = (w) => Math.floor(seatWeekStartMs(w + 1) / 1000);
const AFTER = (w) => turning(w) + 3 * 3600;   // three hours past week w's Turning
const HUBS = { 21: [402, 151], 34: [520, 130] };
let _rid = 0;
const rid = () => `s1d-${String(++_rid).padStart(6, '0')}`;

async function stood() {
  const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on', PROFESSIONS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = svc.env.DB._raw;
  const witnesses = [await svc.guest(), await svc.guest(), await svc.guest()];
  for (const seat of [ANTICLERE, ASHFIELD, ALCAIRE, YKALON, WAYREST]) {
    for (const w of witnesses) raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(seat.key), w.id, seatReportText(seat), seat.region, T0 - DAY);
  }
  raw.prepare('INSERT INTO town_seat_weeks (week, settled_at) VALUES (?, ?)').run(W - 1, T0);   // the week before settled already
  const guild = async (handle, name, tag) => {
    const gm = await svc.seated(handle, { renown: 12 });
    assert.equal((await svc.found(gm, { name, tag })).status, 200);
    const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ? AND char_id = ?').get(gm.id, gm.character).guild_id;
    raw.prepare('UPDATE guild_members SET joined_at = ? WHERE guild_id = ?').run(T0 - SEAT_MEMBER_WAIT_S - DAY, gid);
    return { gm, gid };
  };
  const member = async (g, handle, rank) => {
    const m = await svc.seated(handle);
    raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, ?, ?, ?)').run(m.id, m.character, g.gid, rank, handle, T0 - 30 * DAY);
    return m;
  };
  const treasury = (gid, n) => raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('mint', NULL, 'guild', ?, 'test', ?, 1, 1, 'seed', NULL, ?)`).run(gid, n, `seed-${gid}-${n}-${Math.random().toString(36).slice(2, 10)}`);
  const purse = (gid) => Number(raw.prepare('SELECT balance FROM guild_marks WHERE guild_id = ?').get(gid)?.balance ?? 0);
  const hold = (seat, gid, o = {}) => raw.prepare(`INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at, tithe, owed)
    VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`).run(seat.key, gid, seat.region, seat.tier, W - 1, o.standing ?? 50, T0 - 7 * DAY, o.tithe ?? 6, o.owed ?? 0);
  const held = (key) => raw.prepare('SELECT * FROM town_seat_holds WHERE key = ?').get(key) ?? null;
  /** `amount` of the Watch for `gid` at `seat` in `week`, from a fresh account bound to it */
  const watch = async (gid, seat, amount = 100, week = W) => {
    const a = await svc.guest();
    raw.prepare('INSERT INTO town_seat_binds (week, account, guild_id, char_id, at) VALUES (?, ?, ?, ?, ?)').run(week, a.id, gid, 'c', T0);
    raw.prepare(`INSERT INTO town_seat_influence (week, key, guild_id, account, char_id, source, amount, region, day, ref, at)
      VALUES (?, ?, ?, ?, 'c', 'watch', ?, ?, 1, ?, ?)`).run(week, seat.key, gid, a.id, amount, seat.region, `t:${a.id}:${week}`, T0);
  };
  const lines = (kind) => raw.prepare('SELECT src_kind, src_id, dst_kind, dst_id, amount FROM marks_ledger WHERE kind = ? ORDER BY seq').all(kind)
    .map((r) => [r.src_kind, r.src_id, r.dst_kind, r.dst_id, Number(r.amount)]);
  const chronicle = (key) => raw.prepare('SELECT kind FROM town_seat_history WHERE key = ? ORDER BY seq').all(key).map((r) => r.kind);
  const list = async (who) => (await svc.call('/v1/seats/list', {}, who.secret)).body;
  return { svc, raw, guild, member, treasury, purse, hold, held, watch, lines, chronicle, list };
}

test('SEAT1d THE UPKEEP AND NEGLECT: the Turning burns a palace\'s 2,500 from its holder\'s treasury; a short week is Neglect (the debt owed, Standing -10, a Chronicle row); the next week\'s Turning takes both weeks and calls it late (-5); a second short week lapses the Charter and voids its coming Edict (mutants: the burn; the debt; the late; the lapse; the void)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const { raw, guild, treasury, purse, hold, held, watch, lines, chronicle, list } = await stood();
  const sh = await guild('Gamal', 'The Silver Hand', 'SH');
  hold(ANTICLERE, sh.gid);
  treasury(sh.gid, 2600);
  for (let w = W; w <= W + 4; w++) await watch(sh.gid, ANTICLERE, 100, w);
  now = AFTER(W);
  await list(sh.gm);
  assert.deepEqual(lines('seat-upkeep'), [['guild', sh.gid, 'burn', null, SEAT_UPKEEP.palace]], 'paid, burnt');
  assert.deepEqual([purse(sh.gid), held(ANTICLERE.key).owed, held(ANTICLERE.key).standing], [100, 0, 55], 'held unchallenged +5, a Tithe of 6 moving nothing');
  now = AFTER(W + 1);
  await list(sh.gm);
  assert.deepEqual([held(ANTICLERE.key).owed, held(ANTICLERE.key).standing], [2500, 50], 'Neglect: the week owed, Standing -10 (+5 unchallenged)');
  assert.equal(chronicle(ANTICLERE.key).at(-2), 'neglect');
  treasury(sh.gid, 4900);   // 5,000 in all: both weeks
  now = AFTER(W + 2);
  await list(sh.gm);
  assert.deepEqual(lines('seat-upkeep').map((l) => l[4]), [2500, 5000], 'paid late: both weeks at once');
  assert.deepEqual([held(ANTICLERE.key).owed, held(ANTICLERE.key).standing, purse(sh.gid)], [0, 50, 0], 'late: -5 (+5 unchallenged)');
  assert.ok(chronicle(ANTICLERE.key).includes('late'));
  now = AFTER(W + 3);
  await list(sh.gm);
  assert.equal(held(ANTICLERE.key).owed, 2500, 'Neglect again');
  // an Edict proclaimed for the week after the lapse falls with the Charter
  raw.prepare("INSERT INTO town_seat_edicts (key, week, edict, guild_id, set_by, at) VALUES (?, ?, 'market-day', ?, 'Gamal', ?)").run(ANTICLERE.key, W + 5, sh.gid, now);
  now = AFTER(W + 4);
  const seats = (await list(sh.gm)).seats;
  assert.equal(held(ANTICLERE.key), null, 'a second short week: the Charter lapses');
  assert.equal(seats.find((s) => s.key === ANTICLERE.key).holder, null);
  assert.equal(chronicle(ANTICLERE.key).at(-1), 'lapse');
  assert.equal(raw.prepare('SELECT state FROM town_seat_edicts WHERE key = ? AND week = ?').get(ANTICLERE.key, W + 5).state, 'void');
});

test('SEAT1d OVERREACH AND THE CROWN\'S SCALE: a guild holding two palaces pays each one\'s upkeep a quarter more; a crown\'s 15,000 scaled by the week\'s accounts - at its floor of 0.4 on a server of few (mutants: the extra; the share; the scale; its floor)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const { raw, guild, treasury, hold, watch, lines, list } = await stood();
  const eo = await guild('Horst', 'Ebon Oath', 'EO');
  const ic = await guild('Cyril', 'Iron Circle', 'IC');
  hold(ALCAIRE, eo.gid); hold(YKALON, eo.gid);
  hold(WAYREST, ic.gid);
  treasury(eo.gid, 10000); treasury(ic.gid, 20000);
  await watch(eo.gid, ALCAIRE); await watch(eo.gid, YKALON); await watch(ic.gid, WAYREST);
  // three accounts played in the week: the scale's floor
  for (const r of raw.prepare('SELECT id FROM players WHERE handle IS NOT NULL').all().slice(0, 3)) raw.prepare('UPDATE players SET played_at = ? WHERE id = ?').run(T0 + 3600, r.id);
  now = AFTER(W);
  await list(eo.gm);
  const paid = raw.prepare("SELECT src_id, amount FROM marks_ledger WHERE kind = 'seat-upkeep' ORDER BY seq").all().map((r) => [r.src_id, Number(r.amount)]);
  assert.deepEqual(paid.filter(([g]) => g === eo.gid).map(([, a]) => a), [3125, 3125], 'two palaces: extra 1, +25% each');
  assert.deepEqual(paid.filter(([g]) => g === ic.gid).map(([, a]) => a), [Math.floor(SEAT_UPKEEP.crown * CROWN_SCALE.least)], 'a crown at the floor');
  assert.equal(lines('seat-upkeep').length, 3);
});

test('SEAT1d STANDING\'S ROWS AND UNREST: a Tithe above three quarters of its cap -3, a week without the holder\'s own Watch -5, each gate felled in the region +2 (two), each of its writs filled there +1 (at most five), unchallenged +5 - 56 from 50; at a seat in Unrest a challenger\'s influence counts a quarter more, on the board and at the Turning (mutants: each row; each cap; the Unrest bonus)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const { svc, raw, guild, treasury, hold, held, watch, list } = await stood();
  const sh = await guild('Gamal', 'The Silver Hand', 'SH');
  hold(ANTICLERE, sh.gid, { tithe: 8 });
  treasury(sh.gid, 2500);
  // two gate days in the week whose region three claims agree is 21
  const start = seatWeekStartMs(W), end = start + 7 * DAY * 1000;
  const days = [];
  for (let d = gameDayAt(start); days.length < 3; d++) if (gateTimes(d).riseAt >= start && gateTimes(d).riseAt < end) days.push(d);
  const claimers = [await svc.guest(), await svc.guest(), await svc.guest()];
  for (const d of days.slice(0, 2)) for (const c of claimers) raw.prepare("INSERT INTO gate_kills (day, account, boss, earned, at, region) VALUES (?, ?, 'ruhn', 'x', ?, 21)").run(d, c.id, T0);
  for (const c of claimers.slice(0, 2)) raw.prepare("INSERT INTO gate_kills (day, account, boss, earned, at, region) VALUES (?, ?, 'ruhn', 'x', ?, 21)").run(days[2], c.id, T0);   // two agree: no region
  // six of its writs filled in the region this week
  for (let i = 0; i < 6; i++) {
    raw.prepare(`INSERT INTO guild_writs (id, guild_id, poster, poster_char, officer, week, region, material, units, left_units, pay, escrow, at, expires_at, state, closed_at, rid, n)
      VALUES (?, ?, ?, ?, 0, ?, 21, 'ore:mithril', 1, 0, 1, 0, ?, ?, 'filled', ?, ?, 'n')`).run(`writ-${i}`, sh.gid, sh.gm.id, sh.gm.character, W, T0, T0 + 7 * DAY, T0 + 60, `r${i}`);
  }
  now = AFTER(W);
  await list(sh.gm);
  assert.equal(held(ANTICLERE.key).standing, 50 - 3 - 5 + 4 + 5 + 5);
  // UNREST: below 20 a challenger's 5,000 counts as 6,250 - past the line
  const lo = await guild('Lorna', 'Low Tide', 'LT');
  const ch = await guild('Cyril', 'Iron Circle', 'IC');
  hold(ALCAIRE, lo.gid, { standing: 15 });
  treasury(lo.gid, 5000);
  raw.prepare('INSERT INTO town_seat_pledges (week, guild_id, region, key, set_by, at) VALUES (?, ?, ?, ?, ?, ?)').run(W + 1, ch.gid, ALCAIRE.region, ALCAIRE.key, 'x', T0);
  await watch(lo.gid, ALCAIRE, 1000, W + 1);
  for (let i = 0; i < 3; i++) await watch(ch.gid, ALCAIRE, i < 2 ? 2000 : 1000, W + 1);
  const s = (await svc.call('/v1/seats/standings', { key: ALCAIRE.key, character: ch.gm.character }, ch.gm.secret)).body;
  assert.equal(s.standings.find((x) => x.guild.id === ch.gid).influence, 6250, 'shown risen');
  assert.equal(s.standings.find((x) => x.guild.id === lo.gid).influence, 1000, 'the holder\'s own never');
  now = AFTER(W + 1);
  const b = (await list(ch.gm)).seats.find((x) => x.key === ALCAIRE.key).battle;
  assert.deepEqual([b?.kind, b?.guild.tag], ['siege', 'IC'], 'a Right of Siege it would not have won at 5,000');
});

test('SEAT1d THE TITHE: an Officer sets it, once a week, within its tier\'s cap; a Member and another guild may not; a sale pays the Tithe of the seat its listing\'s board belongs to - the nearest seat of the region, an older client\'s the region\'s first - to the holder\'s treasury, from the seller\'s proceeds (burnt where the treasury\'s cap holds); a courier pays its share to the buyer\'s board\'s seat; an auction\'s at its close; a region with no Charter pays none (mutants: the cap; the week; the rank; the bailiwick; the line; the burn; the courier\'s share; the auction\'s)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const { svc, raw, guild, member, purse, hold, lines } = await stood();
  const sh = await guild('Gamal', 'The Silver Hand', 'SH');
  const eo = await guild('Horst', 'Ebon Oath', 'EO');
  hold(ANTICLERE, sh.gid, { tithe: 0 }); hold(ASHFIELD, eo.gid, { tithe: 2 });
  const off = await member(sh, 'Ofelia', 1);
  const mem = await member(sh, 'Menno', 2);
  const tithe = (who, key, pct) => svc.call('/v1/seats/tithe', { character: who.character, key, pct }, who.secret);
  assert.equal((await tithe(mem, ANTICLERE.key, 8)).body.error, 'guild-rank');
  assert.equal((await tithe(off, ANTICLERE.key, 11)).body.error, 'bad-tithe', 'a palace\'s cap is 10');
  assert.equal((await tithe(off, ASHFIELD.key, 8)).body.error, 'seat-not-held', 'not its guild\'s');
  assert.deepEqual((await tithe(off, ANTICLERE.key, 8)).body, { ok: true, tithe: 8 });
  assert.equal((await tithe(sh.gm, ANTICLERE.key, 5)).status, 409, 'once a week');
  assert.equal(raw.prepare('SELECT tithe FROM town_seat_holds WHERE key = ?').get(ANTICLERE.key).tithe, 8);
  // the market: a seller and a buyer
  const seller = await svc.seated('Selma');
  const buyer = await svc.seated('Bruno');
  raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, 'ore:mithril', 'own', 4000)`).run(seller.id, seller.character);
  raw.prepare('INSERT INTO marks (account, balance) VALUES (?, 100000), (?, 100000)').run(seller.id, buyer.id);
  const list = async (o) => { const r = await svc.call('/v1/market/list', { character: seller.character, kind: 'material', material: 'ore:mithril', hubs: HUBS, rid: rid(), ...o }, seller.secret); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body.listing; };
  const buy = (l, units, o = {}) => svc.call('/v1/market/buy', { character: buyer.character, region: 21, listing: l.id, units, max: 1_000_000, hubs: HUBS, rid: rid(), ...o }, buyer.secret);
  const sellerGot = () => raw.prepare("SELECT amount FROM marks_ledger WHERE kind = 'market-sale' ORDER BY seq DESC LIMIT 1").get().amount;
  // at Anticlere's board: 8% to the Silver Hand
  let l = await list({ region: 21, units: 100, price: 10, board: [405, 150] });
  assert.equal((await buy(l, 10, { board: [405, 150] })).status, 200);
  assert.deepEqual([sellerGot(), purse(sh.gid)], [100 - saleTax(100) - 8, 8]);
  assert.deepEqual(lines('tithe').at(-1), ['account', buyer.id, 'guild', sh.gid, 8], 'the buyer\'s line to the holder - the seller\'s proceeds less it');
  // at Ashfield's board, the same region: Ashfield's 2% to the Ebon Oath
  l = await list({ region: 21, units: 100, price: 10, board: [468, 161] });
  await buy(l, 10, { board: [468, 161] });
  assert.deepEqual([sellerGot(), purse(eo.gid)], [100 - saleTax(100) - 2, 2], 'the bailiwick: the nearest seat of the region');
  // an older client names no board: the region's first seat
  l = await list({ region: 21, units: 100, price: 10 });
  await buy(l, 10);
  assert.equal(purse(sh.gid), 16);
  // a region with no Charter held: none
  l = await list({ region: 34, units: 100, price: 10, board: [520, 130] });
  await buy(l, 10, { region: 34, board: [520, 130] });
  assert.equal(sellerGot(), 100 - saleTax(100), 'no Tithe where no seat is held');
  // a courier from Alcaire's region to Anticlere's board: its 8% share to the Silver Hand, the rest burnt
  l = await list({ region: 34, units: 400, price: 1, board: [520, 130] });
  const before = purse(sh.gid);
  const r = await buy(l, 400, { board: [405, 150] });
  const fee = courierFee(400, roadPixels({ x: 520, y: 130 }, { x: 402, y: 151 }));
  assert.equal(r.body.sale.courier, fee);
  assert.equal(purse(sh.gid) - before, Math.floor(fee * 8 / 100), 'the courier\'s share');
  assert.equal(lines('courier').at(-1)[4], fee - Math.floor(fee * 8 / 100), 'the rest burnt');
  // a holder whose treasury its cap holds: the Tithe burnt, never lost and never refused
  raw.prepare('UPDATE guild_marks SET balance = ? WHERE guild_id = ?').run(MARKS_MAX - 1, sh.gid);
  l = await list({ region: 21, units: 100, price: 10, board: [405, 150] });
  assert.equal((await buy(l, 10, { board: [405, 150] })).status, 200);
  assert.deepEqual(lines('tithe').at(-1), ['account', buyer.id, 'burn', null, 8], 'burnt at the cap');
  raw.prepare('UPDATE guild_marks SET balance = 0 WHERE guild_id = ?').run(sh.gid);
  // AN AUCTION posted at Anticlere's board pays its Tithe at the close, out of the winning bid's escrow
  raw.prepare(`INSERT INTO products (provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at)
    VALUES ('00000000000000a1', ?, ?, 'Silverthorn', 'longsword:mithril', 120, 5, 4, 4242, 'p1.x', ?)`).run(seller.id, seller.character, now);
  holdPieces(svc.env, seller.character, [{ provenance: '00000000000000a1', quality: 4, wear: 900 }]);   // PIN MOVED (INT19): the auction takes it out of the seller's record
  const a = (await svc.call('/v1/market/auction', { character: seller.character, region: 21, provenance: '00000000000000a1', wear: 900, opening: 1000, hubs: HUBS, board: [405, 150], rid: rid() }, seller.secret)).body.auction;
  assert.equal((await svc.call('/v1/market/bid', { character: buyer.character, region: 21, auction: a.id, amount: 1000, hubs: HUBS, rid: rid() }, buyer.secret)).status, 200);
  now += AUCTION_S + 1;
  await svc.call('/v1/market/read', { character: seller.character, region: 21, view: 'mine', hubs: HUBS }, seller.secret);
  assert.deepEqual(lines('tithe').at(-1), ['escrow', lines('auction-sale').at(-1)[1], 'guild', sh.gid, 80]);
  assert.deepEqual([lines('auction-sale').at(-1)[4], raw.prepare('SELECT tithe FROM market_auctions WHERE id = ?').get(a.id).tithe], [1000 - saleTax(1000) - 80, 80]);
});

test('SEAT1d THE EDICTS: proclaimed by an Officer for the coming week, replaced or taken back until the Turning; none two weeks running but Market Day; the Turning makes it law and pays its cost (a Festival\'s 2,500 burnt, Standing +10) or lets it fall unpaid; the seats\' list names the Edict that rules; Open Gates opens the town\'s homes to all (mutants: the rank; the week; the repeat rule; the cost; the law; the fall; Open Gates)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const { svc, raw, guild, member, treasury, purse, hold, held, watch, chronicle, list } = await stood();
  const sh = await guild('Gamal', 'The Silver Hand', 'SH');
  hold(ANTICLERE, sh.gid);
  const off = await member(sh, 'Ofelia', 1);
  const mem = await member(sh, 'Menno', 2);
  const edict = (who, e, o = {}) => svc.call('/v1/seats/edict', { character: who.character, key: ANTICLERE.key, edict: e, ...o }, who.secret);
  assert.equal((await edict(mem, 'festival')).body.error, 'guild-rank');
  assert.equal((await edict(off, 'feast')).body.error, 'bad-edict');
  assert.deepEqual((await edict(off, 'curfew')).body, { ok: true, next: 'curfew' });
  assert.deepEqual((await edict(off, 'festival')).body, { ok: true, next: 'festival' }, 'replaced');
  assert.equal(raw.prepare('SELECT edict, week FROM town_seat_edicts WHERE key = ?').get(ANTICLERE.key).week, W + 1, 'for the coming week');
  treasury(sh.gid, 2500 + EDICTS.festival.cost.palace);
  await watch(sh.gid, ANTICLERE, 100, W);
  now = AFTER(W);
  const seats = (await list(sh.gm)).seats;
  assert.equal(seats.find((s) => s.key === ANTICLERE.key).holder.edict, 'festival', 'the list names the Edict that rules');
  assert.equal(purse(sh.gid), 0, 'the upkeep and the Festival paid');
  assert.equal(held(ANTICLERE.key).standing, 50 + 5 + 10, 'unchallenged, and the Festival');
  assert.ok(chronicle(ANTICLERE.key).includes('edict'));
  // the Festival again for the week after: refused; Market Day twice: allowed
  assert.equal((await edict(off, 'festival')).body.error, 'edict-twice');
  assert.deepEqual((await edict(off, 'market-day')).body.next, 'market-day');
  assert.deepEqual((await edict(off, null)).body, { ok: true, next: null }, 'taken back');
  assert.equal((await edict(off, null)).body.error, 'seat-no-edict');
  // a Festival the treasury cannot pay falls
  raw.prepare("INSERT INTO town_seat_edicts (key, week, edict, guild_id, set_by, at) VALUES (?, ?, 'open-gates', ?, 'x', ?)").run(ANTICLERE.key, W + 2, sh.gid, now);
  await watch(sh.gid, ANTICLERE, 100, W + 1);
  treasury(sh.gid, 2500);
  now = AFTER(W + 1);
  await list(sh.gm);
  assert.equal(raw.prepare('SELECT state FROM town_seat_edicts WHERE key = ? AND week = ?').get(ANTICLERE.key, W + 2).state, 'law', 'Open Gates costs nothing');
  raw.prepare("INSERT INTO town_seat_edicts (key, week, edict, guild_id, set_by, at) VALUES (?, ?, 'festival', ?, 'x', ?)").run(ANTICLERE.key, W + 3, sh.gid, now);
  // OPEN GATES: a private home in the town reads public to anyone the seats are open to; its owner sees its own choice
  const owner = await svc.seated('Hanne');
  raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) VALUES (?, 7, ?, ?, 'Hanne', 21, 'private', 1000, ?)").run(ANTICLERE.key, owner.id, owner.character, T0);
  const town = async (who) => (await svc.call('/v1/homes/town', { mapId: ANTICLERE.key, character: who.character }, who.secret)).body;
  const seen = await town(off);
  assert.deepEqual([seen.openGates, seen.homes[0].entry], [true, 'public']);
  assert.equal((await town(owner)).homes[0].entry, 'private', 'its owner\'s own choice, kept');
  await watch(sh.gid, ANTICLERE, 100, W + 2);
  now = AFTER(W + 2);
  await list(sh.gm);
  assert.equal(raw.prepare('SELECT state FROM town_seat_edicts WHERE key = ? AND week = ?').get(ANTICLERE.key, W + 3).state, 'unpaid', 'a Festival the treasury cannot pay falls');
  assert.equal(chronicle(ANTICLERE.key).at(-2), 'edict-unpaid');
  assert.equal((await town(off)).openGates, undefined, 'Open Gates over with its week');
});

test('SEAT1d THE LEVY AND THE BOUNTY: a harvest in a Levy seat\'s bailiwick gives the seat a tenth (the gatherer keeps the rest, at least one) - and nowhere else; a Bounty\'s set-aside escrowed at the Turning pays 20 Drakes a camp cleared in its bailiwick, a camp once a day whoever cleared it, five an account a day, never past the set-aside; what is left goes home at the next Turning (mutants: the levy; the stockpile; the bailiwick; the escrow; the pay; the caps; the return)', async (t) => {
  let now = T0 + 3600;
  t.mock.method(Date, 'now', () => now * 1000);
  const { svc, raw, guild, member, treasury, purse, hold, watch, lines, list } = await stood();
  const sh = await guild('Gamal', 'The Silver Hand', 'SH');
  hold(ANTICLERE, sh.gid);
  // THE LEVY rules this week at Anticlere
  raw.prepare("INSERT INTO town_seat_edicts (key, week, edict, guild_id, set_by, state, at) VALUES (?, ?, 'levy', ?, 'x', 'law', ?)").run(ANTICLERE.key, W, sh.gid, T0);
  const miner = await svc.seated('Moira');
  // noon on the shared clock today - the harvest keeps the daylight
  const hr = (s) => Math.floor((((Math.floor(sharedClassicMinutes(s * 1000)) % 1440) + 1440) % 1440) / 60);
  for (let s = utcDay(T0) * DAY + 3600; ; s += 30) if (hr(s) === 12 && hr(s - 60) === 12 && hr(s + 60) === 12) { now = s; break; }
  const MOUNTAIN = 226;
  const stone = (x, slot) => ({ character: miner.character, node: nodeKey({ kind: 'boulder', x, y: 150, day: utcDay(now), slot }), kind: 'stone', climate: MOUNTAIN, region: 21, act: { glints: 0 }, at: now - 2, rid: rid() });
  assert.ok(boulders({ x: 404, y: 150, day: utcDay(now), climate: MOUNTAIN }).length >= 1);
  // every draw of the service's dice at 0.098: a boulder of 3, its tenth's fraction kept (0.098 < 0.3) - one to the seat
  const real = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  t.mock.method(globalThis.crypto, 'getRandomValues', (b) => { b.fill(0x19); return b; });
  const r = await svc.call('/v1/prof/harvest', stone(404, 0), miner.secret);
  t.mock.method(globalThis.crypto, 'getRandomValues', real);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.qty, r.body.levy], [2, { qty: 1, key: ANTICLERE.key }], 'three quarried: two kept, one levied');
  assert.deepEqual({ ...raw.prepare('SELECT material, qty FROM town_seat_stockpile WHERE key = ?').get(ANTICLERE.key) }, { material: 'stone:rough', qty: 1 });
  // far from Anticlere, in Ashfield's bailiwick (unheld, no Levy): nothing levied
  t.mock.method(globalThis.crypto, 'getRandomValues', (b) => { b.fill(0x19); return b; });
  const far = await svc.call('/v1/prof/harvest', { ...stone(472, 0), node: nodeKey({ kind: 'boulder', x: 472, y: 160, day: utcDay(now), slot: 0 }) }, miner.secret);
  t.mock.method(globalThis.crypto, 'getRandomValues', real);
  assert.deepEqual([far.body.qty, far.body.levy], [3, undefined], 'outside the bailiwick: the whole yield');
  // THE BOUNTY, proclaimed for next week with 60 Drakes set aside, escrowed at the Turning
  const off = await member(sh, 'Ofelia', 1);
  assert.equal((await svc.call('/v1/seats/edict', { character: off.character, key: ANTICLERE.key, edict: 'bounty', setAside: 10 }, off.secret)).body.error, 'bad-bounty');
  assert.equal((await svc.call('/v1/seats/edict', { character: off.character, key: ANTICLERE.key, edict: 'bounty', setAside: 60 }, off.secret)).status, 200);
  treasury(sh.gid, 2500 + 60);
  await watch(sh.gid, ANTICLERE, 100, W);
  now = AFTER(W);
  await list(sh.gm);
  assert.deepEqual(lines('bounty-escrow'), [['guild', sh.gid, 'escrow', `bounty:${ANTICLERE.key}:${W + 1}`, 60]]);
  assert.equal(purse(sh.gid), 0);
  const hunters = [await svc.seated('Hugo'), await svc.seated('Ilse')];
  const camp = (who, site, region = 21) => svc.call('/v1/seats/bounty', { character: who.character, site, region }, who.secret);
  assert.deepEqual((await camp(hunters[0], '410,150:91')).body, { ok: true, paid: 20, key: ANTICLERE.key });
  assert.deepEqual((await camp(hunters[1], '410,150:91')).body, { ok: true, paid: 0, why: 'claimed' }, 'a camp once a day');
  assert.deepEqual((await camp(hunters[0], '470,160:91')).body, { ok: true, paid: 0, why: 'no-bounty' }, 'Ashfield\'s bailiwick');
  assert.deepEqual((await camp(hunters[0], 'not-a-site')).body.error, 'bad-bounty');
  assert.equal((await camp(hunters[0], '411,150:91')).body.paid, 20);
  assert.equal((await camp(hunters[1], '412,150:91')).body.paid, 20);
  assert.deepEqual((await camp(hunters[1], '413,150:91')).body, { ok: true, paid: 0, why: 'spent' }, 'never past the set-aside');
  assert.deepEqual(lines('bounty').map((l) => [l[0], l[2], l[4]]), [['escrow', 'account', 20], ['escrow', 'account', 20], ['escrow', 'account', 20]]);
  // five an account a day
  raw.prepare('UPDATE town_seat_edicts SET set_aside = 1000 WHERE key = ? AND week = ?').run(ANTICLERE.key, W + 1);
  for (let i = 0; i < 3; i++) assert.equal((await camp(hunters[0], `42${i},150:7`)).body.paid, 20);
  assert.deepEqual((await camp(hunters[0], '430,150:7')).body, { ok: true, paid: 0, why: 'day-full' });
  raw.prepare('UPDATE town_seat_edicts SET set_aside = 60 + 3 * 20 WHERE key = ? AND week = ?').run(ANTICLERE.key, W + 1);
  raw.prepare("UPDATE town_seat_edicts SET set_aside = spent + 40 WHERE key = ? AND week = ?").run(ANTICLERE.key, W + 1);
  treasury(sh.gid, 2500);
  await watch(sh.gid, ANTICLERE, 100, W + 1);
  now = AFTER(W + 1);
  await list(sh.gm);
  assert.deepEqual(lines('bounty-return'), [['escrow', `bounty:${ANTICLERE.key}:${W + 1}`, 'guild', sh.gid, 40]], 'what the escrow did not pay, home');
  assert.equal(raw.prepare('SELECT state FROM town_seat_edicts WHERE key = ? AND week = ?').get(ANTICLERE.key, W + 1).state, 'returned');
});
