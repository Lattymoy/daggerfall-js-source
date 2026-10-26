// STAFF-PANEL-SPEED (2026-10-23, mob: "slow when moving in menus", "The click takes a while before the new page shows
// (it's waiting on the server)") - THE REALM'S, THE ECONOMY'S, THE CENSUS'S, STATUS'S AND THE FEEDS' READ PAGES PINNED TO
// THEIR D1 ROUND TRIPS (server-account/src/staffRealm.js, staffEconomy.js, staffCensus.js, staffStatus.js,
// staffMonsters.js, staffReactions.js, staffNet.js): what a click waits on is each statement awaited after the last, times
// the network to D1, so the reads a page makes together share one trip (a batch, a Promise.all) and its audit row goes
// with them. Each pin counts a page's trips on the real Worker (test/server/staffTrips.mjs countTrips), the staff
// session's own lookup among them, cold (nothing kept in the isolate), on a realm with a row in every table the page reads
// - and checks the page still answers what it answered, with its audit row written.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { countTrips } from './staffTrips.mjs';
import { staffWords, STAFF_SESSION_HEADER } from '../../server-account/src/staff.js';
import { _forgetCensusForTests } from '../../server-account/src/staffCensus.js';
import { _resetStatusForTests } from '../../server-account/src/staffStatus.js';
import { _resetReactionsForTests } from '../../server-account/src/staffReactions.js';
import { utcDay } from '../../src/net/marksLaw.js';

const { subtle } = globalThis.crypto;
const enc = new TextEncoder();
const nowS = () => Math.floor(Date.now() / 1000);
const PASSWORD = 'a good long one';
const DAY = 86_400;
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');

async function extensionKey() {
  const pair = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = b64url(new Uint8Array(await subtle.exportKey('raw', pair.publicKey)));
  let last = 0;
  const proof = async (what, handle, ts = Math.max(nowS(), last + 1)) => {
    last = Math.max(last, ts);
    const sig = b64url(new Uint8Array(await subtle.sign({ name: 'Ed25519' }, pair.privateKey, enc.encode(staffWords(what, handle.toLowerCase(), ts)))));
    return { pub, ts, sig };
  };
  return { pub, proof };
}

/** A realm with a row in every table these pages read, laid in by hand as the game's own routes lay them. */
function fill(raw, t) {
  const hour = Math.floor(t / 3600) * 3600;
  const pid = (s) => `p_${s}`.padEnd(10, '0');
  const chars = {};
  ['Alda', 'Brond', 'Cyra'].forEach((name, i) => {
    raw.prepare('INSERT INTO players (id, handle, handle_lc, guest_name, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?)').run(pid(name), name, name.toLowerCase(), `${name} Guest`, t - (i ? 30 : 2) * DAY, t);
    chars[name] = `r${(i + 1).toString(16).padStart(20, '0')}`;
  });
  const [A, B, C] = ['Alda', 'Brond', 'Cyra'].map(pid);
  const char = (name, cols) => {
    const row = { id: chars[name], player: pid(name), name, created_at: t - DAY, updated_at: t - 60, ...cols };
    raw.prepare(`INSERT INTO realm_characters (${Object.keys(row).join(', ')}) VALUES (${Object.keys(row).map(() => '?').join(', ')})`).run(...Object.values(row));
  };
  char('Alda', { held: 'budget', held_at: t - 100, wealth: 300_000, allowance: 1000, dupes: 1 });
  char('Brond', { held: 'staff', held_at: t - 200, wealth: 260_000 });
  char('Cyra', { review: 'outlier', wealth: 5000 });
  const finding = (name, kind, detail, at = t - 600) => raw.prepare('INSERT INTO realm_findings (player, char_id, seq, at, law, kind, detail) VALUES (?, ?, 1, ?, 0, ?, ?)')
    .run(pid(name), chars[name], at, kind, JSON.stringify(detail));
  finding('Alda', 'measure', { over: 5000, gain: 6000, level: 10, wealth: 300_000, goods: 100_000 });
  finding('Alda', 'law', { findings: [{ code: 'gold' }] });
  finding('Brond', 'staff', { act: 'hold', by: 'SirMcMobdon', note: 'looked' });
  finding('Brond', 'budget', { over: 900, gain: 1000, level: 5 });
  raw.prepare("INSERT INTO progress_hours (player, stream, hour, amount, played_s, over, claims) VALUES (?, 'renown', ?, 5000, 3600, 2000, 3), (?, 'prof', ?, 100, 3600, 50, 30)")
    .run(A, hour - 3600, C, hour - 3600);
  // the market: Drakes and gold sales of a material between three accounts (their usual prices), a fill, a trade
  let n = 0;
  const sale = (buyer, seller, currency, at) => raw.prepare(`INSERT INTO market_sales (buyer, rid, char_id, listing, seller, kind, material, provenance, units, price, total, tax, from_region, to_region, arrives_at, delivered, at, day, n, currency, fee)
    VALUES (?, ?, 'c1', ?, ?, 'material', 'ore:iron', NULL, 1, 10, 10, 1, 3, 4, ?, 1, ?, ?, 'n', ?, 1)`).run(buyer, `sale${++n}`.padEnd(10, 'x'), `l${n}`, seller, at, at, utcDay(at), currency);
  for (const [b, s] of [[A, B], [B, C], [C, A]]) { sale(b, s, 'marks', t - 300); sale(b, s, 'gold', t - 200); }
  raw.prepare(`INSERT INTO market_orders (id, poster, char_id, region, material, units, left_units, price, escrow, at, expires_at, rid, n)
    VALUES ('ord1', ?, 'c2', 7, 'ore:iron', 1, 0, 10, 0, ?, ?, 'orid1xxxxx', 'n')`).run(B, t - 400, t + DAY);
  raw.prepare(`INSERT INTO market_fills (filler, rid, char_id, order_id, poster, material, units, price, pay, tax, at, day, n)
    VALUES (?, 'fill1xxxxx', 'c3', 'ord1', ?, 'ore:iron', 1, 10, 10, 0, ?, ?, 'n')`).run(A, B, t - 100, utcDay(t - 100));
  raw.prepare(`INSERT INTO realm_trades (sid, a_player, a_char, a_lease, a_seq, a_half, b_player, b_char, state, result, created_at)
    VALUES ('sid1', ?, 'ca', 'lease', 1, '{}', ?, 'cb', 'done', ?, ?)`).run(A, B, JSON.stringify({ a: { seq: 2, items: [], gold: 0 }, b: { seq: 2, items: [], gold: 9000 } }), t - 50);
  raw.prepare(`INSERT INTO guilds (id, name, name_key, tag, ranks, treasury, founded_at, realm_gold) VALUES ('g_wolves', 'Wolves', 'wolves', 'WOLV', '[]', 500, ?, 400)`).run(t - DAY);
  raw.prepare("INSERT INTO guild_marks (guild_id, balance) VALUES ('g_wolves', 30)").run();
  raw.prepare("INSERT INTO market_gold (player, char_id, gold) VALUES (?, ?, 300)").run(A, chars.Alda);
  raw.prepare('INSERT INTO marks (account, balance) VALUES (?, 70), (?, 20)').run(A, B);
  raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('mint', NULL, 'account', ?, 'patron', 50, ?, ?, ?, 'Alda', 'mint1')`).run(A, utcDay(t), t - 60, A);
  raw.prepare("INSERT INTO realm_faucets (hour, kind, gold, n) VALUES (?, 'patron', 700, 3)").run(Math.floor(t / 3600));
  raw.prepare('INSERT INTO realm_wealth_hours (char_id, hour, player, level, gain, loss, played_s, tally) VALUES (?, ?, ?, 10, 500, 120, 3600, ?), (?, ?, ?, 10, 0, 0, 3600, ?)')
    .run(chars.Alda, hour - 7200, A, JSON.stringify({ g: 100, t113: 1 }), chars.Alda, hour, A, JSON.stringify({ g: 900, t113: 4 }));
  // the census's latest tallies and its trend, a contested piece
  for (const name of ['Alda', 'Brond']) raw.prepare('INSERT INTO item_census (char_id, player, tally, seq, at) VALUES (?, ?, ?, 3, ?)').run(chars[name], pid(name), JSON.stringify({ g: 900, t113: 4 }), t - 60);
  raw.prepare("INSERT INTO item_census_days (kind, day, carried, holders, at) VALUES ('gold', ?, 1800, 2, 1), ('t113', ?, 8, 2, 1)").run(utcDay(t) - 1, utcDay(t) - 1);
  raw.prepare("INSERT INTO item_dupes (uid, char_id, at, kind, fp, first_char, first_at) VALUES ('u_dupe000000000001', ?, ?, 'claim', '113:1', ?, ?)").run(chars.Alda, t - 500, chars.Brond, t - 9000);
  // a harvester at even gaps
  for (let i = 0; i < 8; i++) {
    const at = t - 4000 + i * 300;
    raw.prepare(`INSERT INTO node_harvests (day, node, kind, player, char_id, profession, material, qty, xp, at, rid, n)
      VALUES (?, ?, 'ore', ?, 'ch', 'mining', 'ore:iron', 1, 1, ?, ?, 'n')`).run(utcDay(at), `node${i}`, C, at, `h${i}`.padEnd(10, 'x'));
  }
  // the relay's feeds: a window with grantStrip on, a player over a limit, a monster owner, its asks and another game's refusals
  raw.prepare("INSERT INTO staff_net_batches (id, at, q, span_s, ms) VALUES ('b000000000000001', ?, 'cell:1,1', 600, 1)").run(t - 30);
  raw.prepare(`INSERT INTO staff_net_rows (batch, at, sub, frames, bytes, p10, pb10, p60, pb60, k_move, k_act, k_hit, k_trade, k_foe, k_chat, k_other, refused, junk, closes, close_why)
    VALUES ('b000000000000001', ?, ?, 900, 9000, 600, 6000, 800, 8000, 900, 0, 0, 0, 0, 0, 0, 3, 0, 0, NULL)`).run(t - 30, B);
  raw.prepare("INSERT INTO staff_foe_rows (batch, at, sub, owned, hosted, regular, elite, boss, sea, stripped) VALUES ('b000000000000001', ?, ?, 40, 0, 30, 6, 2, 2, 1)").run(t - 30, A);
  raw.prepare("INSERT INTO grant_rows (batch, at, sub, kind, asks, members, bucket, ceiling, span_s) VALUES ('g1', ?, ?, 'enc', 300, 300, 0, 0, 600)").run(t - 60, B);
  raw.prepare("INSERT INTO grant_tallies (batch, at, reader, sender, reason, n) VALUES ('g1', ?, ?, ?, 'stats', 4)").run(t - 60, C, A);
  // the bot check's episodes
  for (let i = 0; i < 3; i++) {
    raw.prepare(`INSERT INTO encounter_reactions (id, sub, at, kind, n, members, span_ms, poses, p1, p1_n, ac, ac_n) VALUES (?, ?, ?, 'enc', 1, 2, 4000, 30, 200, 1, 400, 1)`)
      .run(`e${i}`, i ? A : B, t - 100 * (i + 1));
  }
  return { A, B, C, chars };
}

/** The Worker with mob (an Admin and owner) signed in on a filled realm, nothing kept in the isolate - and
 *  `trips(path, body)`, a page's answer with its trips. */
async function stand() {
  for (const reset of [_forgetCensusForTests, _resetStatusForTests, _resetReactionsForTests]) reset();
  const mobKey = await extensionKey();
  const s = await standService({ DEVELOPER_HANDLES: 'Lattymoy,SirMcMobdon', OWNER_HANDLES: 'Lattymoy,SirMcMobdon', OWNER_KEYS: `SirMcMobdon:${mobKey.pub}` });
  const staff = async (path, body = {}, token = null) => {
    const res = await s.fetch(`https://accounts.invalid${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.1', ...(token ? { [STAFF_SESSION_HEADER]: token } : {}) }, body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  await s.registered('SirMcMobdon');
  const mob = (await staff('/v1/staff/login', { handle: 'SirMcMobdon', password: PASSWORD, ...(await mobKey.proof('login', 'SirMcMobdon')) })).body;
  const raw = s.env.DB._raw;
  const fx = fill(raw, nowS());
  const counter = countTrips(s.env.DB);
  /** Every statement the Worker prepared, in order. */
  const sent = [];
  const prepare = s.env.DB.prepare;
  s.env.DB.prepare = (sql) => { sent.push(sql); return prepare(sql); };
  const trips = async (path, body = {}) => {
    counter.take();
    const r = await staff(path, body, mob.session);
    assert.equal(r.status, 200, `${path}: ${JSON.stringify(r.body)}`);
    return { ...r, ...counter.take() };
  };
  /** The audit rows of `act`. */
  const rows = (act) => raw.prepare('SELECT COUNT(*) AS n FROM staff_audit WHERE act = ?').get(act).n;
  return { ...s, raw, fx, trips, rows, sent };
}

test('STAFF-PANEL-SPEED: trade holds in 2 trips, where they were 3 - the read and its audit row one batch - on 0162\'s index, a tie in the order the old scan gave it; wealth past the allowance in 2, where it was 5 (mutants: each fold undone)', async () => {
  const s = await stand();
  const holds = await s.trips('/v1/staff/trade-holds');
  assert.deepEqual(holds.body.characters.map((c) => [c.name, c.level]), [['Alda', 'high'], ['Brond', 'low'], ['Cyra', 'low']]);
  assert.equal(holds.body.characters[1].staffNote.note, 'looked');
  assert.equal(s.rows('trade-holds-read'), 1, 'the page and its audit row together');
  assert.ok(holds.trips <= 2, `trade holds: ${holds.trips} trips`);
  // the held and flagged characters alone are walked, never the realm (EXPLAIN QUERY PLAN of the statement the route sent)
  const read = s.sent.find((q) => q.includes('WHERE c.held IS NOT NULL OR c.review IS NOT NULL'));
  assert.match(s.raw.prepare(`EXPLAIN QUERY PLAN ${read}`).all().map((r) => r.detail).join(' | '), /SCAN c USING INDEX realm_characters_holds\b/);
  // two holds laid in the same second list as the scan of the table listed them, the first made first
  for (const [i, name] of [[4, 'Dag'], [5, 'Eon']]) {
    s.raw.prepare("INSERT INTO realm_characters (id, player, name, created_at, updated_at, held, held_at) VALUES (?, ?, ?, 1, 1, 'law', ?)").run(`r${i.toString(16).padStart(20, '0')}`, s.fx.A, name, nowS() - 50);
  }
  const newest = await s.trips('/v1/staff/trade-holds', { sort: 'newest' });
  assert.deepEqual(newest.body.characters.map((c) => c.name), ['Dag', 'Eon', 'Alda', 'Brond', 'Cyra']);
  const gains = await s.trips('/v1/staff/gains');
  assert.deepEqual(gains.body.gains.map((g) => [g.char?.name ?? g.account.name, g.level, g.wealth?.past ?? null]), [['Alda', 'low', 5000], ['Brond', 'low', 900], ['Cyra', 'low', null]]);
  assert.equal(s.rows('gains-read'), 1);
  assert.ok(gains.trips <= 2, `gains: ${gains.trips} trips`);
});

test('STAFF-PANEL-SPEED: the economy in 2 trips, where it was 4 - its batch, the guilds\' list and the audit row together; the market stream in 3, where it was 6 - its sources with the audit row, then its flags\' reads and both usual prices together (mutants: each fold undone)', async () => {
  const s = await stand();
  const econ = await s.trips('/v1/staff/econ/economy');
  assert.deepEqual([econ.body.richest.characters.map((c) => c.name), econ.body.richest.guilds.map((g) => g.name), econ.body.gold.held.market, econ.body.gold.leftOut.market, econ.body.marks.minted], [[], ['Wolves'], 0, 300, { patron: 50 }]);   // ECON-LEFT-OUT: Alda and Brond are held - off the richest, their market gold said apart
  assert.equal(s.rows('economy-read'), 1);
  assert.ok(econ.trips <= 2, `economy: ${econ.trips} trips`);
  const stream = await s.trips('/v1/staff/econ/stream');
  const sales = stream.body.rows.filter((r) => r.kind === 'sale');
  assert.deepEqual([stream.body.rows.length, sales.length, sales.map((r) => r.currency).sort().join(), sales.every((r) => r.usual === 10)], [8, 6, 'gold,gold,gold,marks,marks,marks', true]);
  assert.ok(stream.body.rows.find((r) => r.kind === 'trade').flags.some((f) => f.flag === 'one-sided'));
  assert.equal(s.rows('market-read'), 1);
  assert.ok(stream.trips <= 3, `stream: ${stream.trips} trips`);
});

test('STAFF-PANEL-SPEED: the census - gold and an item in 2 trips each, where they were 4 (the census, its trend and the audit row together), its jumps in 2, where they were 3 - and the contested pieces in 2, where they were 3 (mutants: each fold undone)', async () => {
  const s = await stand();
  const gold = await s.trips('/v1/staff/census', { kind: 'gold' });
  assert.deepEqual([gold.body.where.carried, gold.body.where.vaults, gold.body.holdersCount, gold.body.trend.map((d) => d.carried)], [1800, 400, 2, [1800]]);
  assert.ok(gold.trips <= 2, `census gold: ${gold.trips} trips`);
  const item = await s.trips('/v1/staff/census', { kind: 't113' });
  assert.deepEqual([item.body.where.carried, item.body.trend.map((d) => d.carried)], [8, [8]]);
  assert.ok(item.trips <= 2, `census item: ${item.trips} trips`);
  assert.equal(s.rows('census-read'), 2);
  const jumps = await s.trips('/v1/staff/census/jumps', { kind: 't113' });
  assert.deepEqual(jumps.body.jumps.map((j) => [j.name, j.from, j.to]), [['Alda', 1, 4]]);
  assert.equal(s.rows('census-jumps-read'), 1);
  assert.ok(jumps.trips <= 2, `census jumps: ${jumps.trips} trips`);
  const contested = await s.trips('/v1/staff/contested');
  assert.deepEqual(contested.body.pieces.map((p) => [p.uid, p.copy.name, p.first.name]), [['u_dupe000000000001', 'Alda', 'Brond']]);
  assert.equal(s.rows('contested-read'), 1);
  assert.ok(contested.trips <= 2, `contested: ${contested.trips} trips`);
});

test('STAFF-PANEL-SPEED: Home, cold, in 5 trips where it was 13 - every watch\'s first reads and the audit row together, the gains\' and the bursts\' in one, the monsters\' in two; the status tiles still 2 (mutants: each fold undone)', async () => {
  const s = await stand();
  const home = await s.trips('/v1/staff/home');
  const by = Object.fromEntries(home.body.watches.map((w) => [w.id, w]));
  assert.ok(!home.body.watches.some((w) => w.failed), JSON.stringify(home.body.watches.filter((w) => w.failed)));
  assert.deepEqual([by.gains.total, by.contested.total, by.bursts.total, by.monsters.total, by.monsters.high], [3, 1, 1, 2, 2]);
  assert.ok(by.economy.items.some((i) => i.name === 'Brond'), 'the one-sided trade');
  assert.equal(s.rows('home-read'), 1);
  assert.ok(home.trips <= 5, `home: ${home.trips} trips`);
  _resetStatusForTests();   // Home read the tiles: the status page's own read, cold
  const status = await s.trips('/v1/staff/status', { poll: true });
  assert.deepEqual(status.body.tiles.map((t) => t.id), ['players', 'load', 'activity', 'health']);
  assert.equal(status.body.tiles[2].values.sales, 6);
  assert.ok(status.trips <= 2, `status: ${status.trips} trips`);
});

test('STAFF-PANEL-SPEED: Monster watch in 3 trips where it was 7, past one statement\'s 80 ids too (its chunks asked at once); the bot check in 3 where it was 4; Network bursts in 2 where they were 4 (mutants: each fold undone)', async () => {
  const s = await stand();
  const monsters = await s.trips('/v1/staff/monsters');
  assert.deepEqual(monsters.body.players.map((p) => [p.name, p.level]), [['Alda', 'high'], ['Brond', 'high']]);
  assert.equal(monsters.body.players[0].others.readers, 1);
  assert.equal(s.rows('monsters-read'), 1);
  assert.ok(monsters.trips <= 3, `monsters: ${monsters.trips} trips`);
  for (let i = 0; i < 85; i++) s.raw.prepare("INSERT INTO staff_foe_rows (batch, at, sub, owned, hosted, regular, elite, boss, sea, stripped) VALUES ('b000000000000001', ?, ?, 1, 0, 1, 0, 0, 0, 0)").run(nowS() - 30, `p_m${String(i).padStart(7, '0')}`);
  const many = await s.trips('/v1/staff/monsters');
  assert.deepEqual([many.body.total, many.body.players.slice(0, 2).map((p) => p.name), many.body.players[0].others.readers], [87, ['Alda', 'Brond'], 1]);
  assert.ok(many.trips <= 3, `monsters past 80 ids: ${many.trips} trips`);
  const reactions = await s.trips('/v1/staff/reactions', { name: 'Alda' });
  assert.deepEqual([reactions.body.player.episodes, reactions.body.population.episodes, reactions.body.perHour.renown, reactions.body.episodes.length], [2, 3, 5000, 2]);
  assert.equal(s.rows('reactions-read'), 1);
  assert.ok(reactions.trips <= 3, `reactions: ${reactions.trips} trips`);
  const net = await s.trips('/v1/staff/net');
  assert.deepEqual([net.body.players.map((p) => [p.name, p.level]), net.body.asOf > 0], [[['Brond', 'medium']], true]);
  assert.equal(s.rows('net-read'), 1);
  assert.ok(net.trips <= 2, `net: ${net.trips} trips`);
});
