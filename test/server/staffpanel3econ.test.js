// STAFF-PANEL3-ECON (2026-10-22; design doc "DFO Staff Panel: design", build step 3) - THE PANEL'S ECONOMY SCREENS
// (server-account/src/staffEconomy.js), driven through the real Worker on the node:sqlite database every account pin
// stands on (test/accountDb.mjs): the market and trades stream with its flags, node activity, the economy and the guilds -
// an Admin's alone - the Home watch, and the indexes every statement stands on (migration 0153).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, d1 } from '../accountDb.mjs';
import { staffWords, STAFF_SESSION_HEADER } from '../../server-account/src/staff.js';
import { STAFF_ROUTES } from '../../server-account/src/service.js';
import {
  ECON_ROUTES, ECON_LIMITS, STREAM_PAGE, STREAM_SPAN_DAYS, ECON_DAYS_MAX, ECON_DAYS_DEFAULT, ECON_KEEP_S, HARVEST_KEEP_S, RICH_FLOOR, RICHEST,
  HOME_WATCH, economy, harvestLevel, harvestRows, tradeSideOf, usualPrices, streamPage,
} from '../../server-account/src/staffEconomy.js';
import { MARK_WORTH_GOLD, utcDay } from '../../src/net/marksLaw.js';
import { MARKET_MEDIAN_DAYS as MARKET_DAYS } from '../../src/net/marketLaw.js';
import { realmLetterOfCredit } from '../../src/net/realm/realmGoldLaw.js';

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

/** The rows the economy reads, laid in by hand as the game's own routes lay them. `t` the clock they are laid against. */
function fixtures(raw, t) {
  let n = 0;
  const id = (s) => `p_${s}`.padEnd(10, '0');
  const player = (name, { age = 30 * DAY, handle = name } = {}) => {
    const pid = id(name);
    raw.prepare('INSERT INTO players (id, handle, handle_lc, guest_name, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?)').run(pid, handle, handle?.toLowerCase() ?? null, `${name} Guest`, t - age, t);
    return pid;
  };
  const sale = ({ buyer, seller, at = t - 60, material = 'ore:iron', price = 10, units = 1, currency = 'marks', kind = 'material', provenance = null, from = 3, to = 4, tax = 0, fee = 0 }) => {
    const rid = `sale${++n}`.padEnd(10, 'x');
    raw.prepare(`INSERT INTO market_sales (buyer, rid, char_id, listing, seller, kind, material, provenance, units, price, total, tax, from_region, to_region, arrives_at, delivered, at, day, n, currency, fee)
      VALUES (?, ?, 'c1', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'n', ?, ?)`).run(buyer, rid, `l${n}`, seller, kind, kind === 'material' ? material : null, provenance, units, price, price * units, tax, from, to, at, at, utcDay(at), currency, fee);
    return `s:${buyer}:${rid}`;
  };
  const fill = ({ filler, poster, at = t - 60, material = 'ore:iron', price = 10, units = 1, region = 7 }) => {
    const oid = `ord${++n}`;
    raw.prepare(`INSERT INTO market_orders (id, poster, char_id, region, material, units, left_units, price, escrow, at, expires_at, rid, n)
      VALUES (?, ?, 'c2', ?, ?, ?, 0, ?, 0, ?, ?, ?, 'n')`).run(oid, poster, region, material, units, price, at - 100, at + DAY, `orid${n}`.padEnd(10, 'x'));
    const rid = `fill${n}`.padEnd(10, 'x');
    raw.prepare(`INSERT INTO market_fills (filler, rid, char_id, order_id, poster, material, units, price, pay, tax, at, day, n)
      VALUES (?, ?, 'c3', ?, ?, ?, ?, ?, ?, 0, ?, ?, 'n')`).run(filler, rid, oid, poster, material, units, price, price * units, at, utcDay(at));
    return `f:${filler}:${rid}`;
  };
  const bid = ({ bidder, seller, at = t - 60, amount = 50, region = 9 }) => {
    const aid = `auc${++n}`;
    raw.prepare(`INSERT INTO market_auctions (id, seller, char_id, region, provenance, wear, opening, fee, at, ends_at, rid, n)
      VALUES (?, ?, 'c4', ?, ?, 1000, 1, 1, ?, ?, ?, 'n')`).run(aid, seller, region, `pv${n}`.padEnd(16, '0'), at - 100, at + DAY, `arid${n}`.padEnd(10, 'x'));
    raw.prepare(`INSERT INTO market_bids (id, auction, bidder, char_id, region, amount, at, rid, n) VALUES (?, ?, ?, 'c5', ?, ?, ?, ?, 'n')`)
      .run(`bid${n}`, aid, bidder, region, amount, at, `brid${n}`.padEnd(10, 'x'));
    return `b:bid${n}`;
  };
  /** A settled trade: `aGets` what the first side received (so the second gave it), `bGets` what the second received. */
  const trade = ({ a, b, at = t - 60, aGets = { items: [], gold: 0 }, bGets = { items: [], gold: 0 }, state = 'done' }) => {
    const sid = `sid${++n}`;
    raw.prepare(`INSERT INTO realm_trades (sid, a_player, a_char, a_lease, a_seq, a_half, b_player, b_char, state, result, created_at)
      VALUES (?, ?, 'ca', 'lease', 1, '{}', ?, 'cb', ?, ?, ?)`).run(sid, a, b, state, state === 'done' ? JSON.stringify({ a: { seq: 2, ...aGets }, b: { seq: 2, ...bGets } }) : null, at);
    return `t:${sid}`;
  };
  const guild = (name, { treasury = 0, realmGold = 0, marks = null } = {}) => {
    const gid = `g_${name}`;
    raw.prepare(`INSERT INTO guilds (id, name, name_key, tag, ranks, treasury, founded_at, realm_gold) VALUES (?, ?, ?, ?, '[]', ?, ?, ?)`).run(gid, name, name.toLowerCase(), name.slice(0, 4).toUpperCase(), treasury, t - DAY, realmGold);
    if (marks != null) raw.prepare('INSERT INTO guild_marks (guild_id, balance) VALUES (?, ?)').run(gid, marks);
    return gid;
  };
  const vault = ({ guild: gid, who, at = t - 60, kind = 'put', name = 'Iron Dagger', count = 1 }) => {
    const r = raw.prepare('INSERT INTO guild_vault_log (guild_id, at, who, kind, name, count) VALUES (?, ?, ?, ?, ?, ?)').run(gid, at, who, kind, name, count);
    return `v:${String(r.lastInsertRowid).padStart(12, '0')}`;
  };
  const harvest = ({ player: pid, at, node, kind = 'ore', material = 'ore:iron' }) => raw.prepare(`INSERT INTO node_harvests (day, node, kind, player, char_id, profession, material, qty, xp, at, rid, n)
      VALUES (?, ?, ?, ?, 'ch', 'mining', ?, 1, 1, ?, ?, 'n')`).run(utcDay(at), node, kind, pid, material, at, `h${++n}`.padEnd(10, 'x'));
  const hours = (pid, fromHour, count, claims = 30) => {
    for (let i = 0; i < count; i++) raw.prepare("INSERT INTO progress_hours (player, stream, hour, amount, played_s, over, claims) VALUES (?, 'prof', ?, 100, 3600, 0, ?)").run(pid, fromHour + i * 3600, claims);
  };
  const character = (pid, name, wealth, { dead = false } = {}) => raw.prepare(`INSERT INTO realm_characters (id, player, name, created_at, updated_at, wealth, dead_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(`r${(++n).toString(16).padStart(20, '0')}`, pid, name, t - DAY, t - 60, wealth, dead ? t - 10 : null);
  return { id, player, sale, fill, bid, trade, guild, vault, harvest, hours, character };
}

/** The Worker with the panel set up: mob (an Admin and owner) signed in, Asynian (a Moderator) invited and signed in. */
async function stand() {
  const mobKey = await extensionKey();
  const s = await standService({ DEVELOPER_HANDLES: 'Lattymoy,SirMcMobdon', MODERATOR_HANDLES: 'Asynian', OWNER_HANDLES: 'Lattymoy,SirMcMobdon', OWNER_KEYS: `SirMcMobdon:${mobKey.pub}` });
  const staff = async (path, body = {}, token = null) => {
    const res = await s.fetch(`https://accounts.invalid${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.1', ...(token ? { [STAFF_SESSION_HEADER]: token } : {}) }, body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  for (const h of ['SirMcMobdon', 'Asynian']) await s.registered(h);
  const mob = (await staff('/v1/staff/login', { handle: 'SirMcMobdon', password: PASSWORD, ...(await mobKey.proof('login', 'SirMcMobdon')) })).body;
  const inv = await staff('/v1/staff/invite', { handle: 'Asynian' }, mob.session);
  const key = await extensionKey();
  const asy = (await staff('/v1/staff/enroll', { handle: 'Asynian', password: PASSWORD, invite: inv.body.invite, ...(await key.proof('enroll', 'Asynian')) })).body;
  const raw = s.env.DB._raw;
  const audits = (act) => raw.prepare('SELECT * FROM staff_audit WHERE act = ? ORDER BY id').all(act);
  return { ...s, raw, staff, mob, asy, audits, fx: fixtures(raw, nowS()) };
}

test('STAFF-PANEL3-ECON: the economy\'s doors are the staff panel\'s, shut without a session, and an Admin\'s alone - a Moderator\'s try is written down', async () => {
  const s = await stand();
  for (const r of ECON_ROUTES) {
    assert.ok(STAFF_ROUTES.has(r), r);
    assert.equal((await s.staff(r, {})).status, 401, `${r} without a session`);
    const m = await s.staff(r, {}, s.asy.session);
    assert.equal(m.status, 403, `${r} for a Moderator`);
    assert.equal(m.body.error, 'staff-admin');
    assert.equal((await s.staff(r, {}, s.mob.session)).status, 200, `${r} for an Admin`);
  }
  const refused = s.audits('refused');
  assert.equal(refused.length, ECON_ROUTES.length);
  assert.ok(refused.every((a) => a.outcome === 'denied' && a.role === 'moderator' && JSON.parse(a.detail).need === 'admin'));
  assert.deepEqual(refused.map((a) => JSON.parse(a.detail).path), [...ECON_ROUTES]);
});

test('STAFF-PANEL3-ECON: the stream is every sale, fill, bid, settled trade and vault move newest first, paged by a cursor that loses and repeats no row', async () => {
  const s = await stand();
  const { fx } = s;
  const t = nowS();
  const [a, b] = [fx.player('Alda'), fx.player('Brond')];
  const g = fx.guild('Wolves');
  const want = [];
  // one of each kind, and a crowd of sales - two of them in the same second as the fill, so the cursor breaks a tie
  want.push([fx.sale({ buyer: b, seller: a, at: t - 100 }), t - 100]);
  want.push([fx.fill({ filler: a, poster: b, at: t - 100 }), t - 100]);
  want.push([fx.sale({ buyer: a, seller: b, at: t - 100 }), t - 100]);
  want.push([fx.bid({ bidder: b, seller: a, at: t - 200 }), t - 200]);
  want.push([fx.trade({ a, b, at: t - 300, aGets: { items: [], gold: 5 }, bGets: { items: [], gold: 7 } }), t - 300]);
  fx.trade({ a, b, at: t - 310, state: 'refused' });   // nothing moved: never in the stream
  want.push([fx.vault({ guild: g, who: 'Alda', at: t - 400 }), t - 400]);
  for (let i = 0; i < STREAM_PAGE; i++) want.push([fx.sale({ buyer: b, seller: a, at: t - 500 - Math.floor(i / 3) }), t - 500 - Math.floor(i / 3)]);
  fx.sale({ buyer: b, seller: a, at: t - STREAM_SPAN_DAYS * DAY - 60 });   // past the widest window
  want.sort((x, y) => y[1] - x[1] || (y[0] > x[0] ? 1 : -1));

  const first = await s.staff('/v1/staff/econ/stream', {}, s.mob.session);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.rows.length, STREAM_PAGE);
  assert.ok(first.body.next);
  const second = await s.staff('/v1/staff/econ/stream', { before: first.body.next }, s.mob.session);
  assert.equal(second.body.next, null);
  const got = [...first.body.rows, ...second.body.rows];
  assert.deepEqual(got.map((r) => r.id), want.map((w) => w[0]), 'every row once, newest first, ties by key');
  assert.deepEqual([...new Set(got.map((r) => r.kind))].sort(), ['bid', 'fill', 'sale', 'trade', 'vault']);
  assert.ok(got.some((r) => r.kind === 'vault' && r.guild.name === 'Wolves' && r.from.name === 'Alda' && r.move === 'put'));
  const tr = got.find((r) => r.kind === 'trade');
  assert.deepEqual([tr.trade.aGave.gold, tr.trade.bGave.gold], [7, 5], 'a side gave what the other received');
  assert.equal(tr.from.name, 'Alda');
  const fl = got.find((r) => r.kind === 'fill');
  assert.equal(fl.region, 7, 'a fill stands in its order\'s region');
  assert.ok(got.every((r) => r.at > t - STREAM_SPAN_DAYS * DAY));
  // the window: since and until, and never wider than the span
  const narrow = await s.staff('/v1/staff/econ/stream', { since: t - 250, until: t - 150 }, s.mob.session);
  assert.deepEqual(narrow.body.rows.map((r) => r.kind), ['bid']);
  const wide = await s.staff('/v1/staff/econ/stream', { since: 0, kinds: ['sale'] }, s.mob.session);
  assert.ok(wide.body.since >= t - STREAM_SPAN_DAYS * DAY - 2, 'a since past the span is the span');
  // the read is written once a view, whatever its page
  assert.equal(s.audits('market-read').length, 3);
});

test('STAFF-PANEL3-ECON: the stream\'s filters - a player on every side, an item, a price, a region and the kinds', async () => {
  const s = await stand();
  const { fx } = s;
  const t = nowS();
  const [a, b, c] = [fx.player('Alda'), fx.player('Brond'), fx.player('Cato')];
  const g = fx.guild('Wolves');
  const asBuyer = fx.sale({ buyer: a, seller: b, at: t - 10, price: 40, from: 3, to: 4 });
  const asSeller = fx.sale({ buyer: c, seller: a, at: t - 20, material: 'ore:tin', price: 5, from: 11, to: 12 });
  const theirs = fx.sale({ buyer: c, seller: b, at: t - 30, price: 7 });
  const asPoster = fx.fill({ filler: c, poster: a, at: t - 40, region: 20, price: 8 });
  const asAuctioneer = fx.bid({ bidder: c, seller: a, at: t - 50, region: 30, amount: 90 });
  const asSecond = fx.trade({ a: c, b: a, at: t - 60, aGets: { items: [], gold: 3 }, bGets: { items: [{ templateIndex: 1, name: 'Ebony Dagger' }], gold: 0 } });
  const byName = fx.vault({ guild: g, who: 'Alda', at: t - 70, name: 'Ebony Dagger' });
  fx.vault({ guild: g, who: 'Brond', at: t - 80 });
  const ask = async (body) => (await s.staff('/v1/staff/econ/stream', body, s.mob.session)).body;
  assert.deepEqual((await ask({ name: 'alda' })).rows.map((r) => r.id), [asBuyer, asSeller, asPoster, asAuctioneer, asSecond, byName]);
  assert.deepEqual((await ask({ target: a })).rows.map((r) => r.id), [asBuyer, asSeller, asPoster, asAuctioneer, asSecond, byName]);
  assert.equal((await s.staff('/v1/staff/econ/stream', { name: 'nobody here' }, s.mob.session)).status, 404);
  // an item: a material, and a piece's name in a trade's receipt and a vault's log
  assert.deepEqual((await ask({ item: 'ore:tin' })).rows.map((r) => r.id), [asSeller]);
  assert.deepEqual((await ask({ item: 'Ebony Dagger' })).rows.map((r) => r.id), [asSecond, byName]);
  // a price: a unit's, a bid's amount, a trade's gold - and no vault move has one
  assert.deepEqual((await ask({ priceMin: 8, priceMax: 40 })).rows.map((r) => r.id), [asBuyer, asPoster]);
  assert.deepEqual((await ask({ priceMin: 90 })).rows.map((r) => r.id), [asAuctioneer]);
  assert.deepEqual((await ask({ priceMax: 3, kinds: ['trade', 'vault'] })).rows.map((r) => r.id), [asSecond]);
  // a region: either end of a sale, a fill's order, either end of a bid - trades and vaults stand in none
  assert.deepEqual((await ask({ region: 12 })).rows.map((r) => r.id), [asSeller]);
  assert.deepEqual((await ask({ region: 20 })).rows.map((r) => r.id), [asPoster]);
  assert.deepEqual((await ask({ region: 30 })).rows.map((r) => r.id), [asAuctioneer]);
  assert.deepEqual((await ask({ region: 4 })).rows.map((r) => r.id), [asBuyer, theirs]);
  assert.deepEqual((await ask({ kinds: ['vault'] })).rows.length, 2);
  assert.deepEqual((await ask({ kinds: ['fill', 'bid'] })).rows.map((r) => r.id), [asPoster, asAuctioneer]);
  const reads = s.audits('market-read');
  assert.ok(reads.some((r) => r.target === a), 'a player\'s view names the player');
});

test('STAFF-PANEL3-ECON: a price flag reads the row\'s own currency, each pair of accounts once and no account\'s sale to itself; the same two accounts again and again; a fresh account taking value', async () => {
  const s = await stand();
  const { fx } = s;
  const t = nowS();
  const P = (n, o) => fx.player(n, o);
  const [b1, s1, b2, s2, b3, s3, w1, w2, x1, x2, y1] = ['B1', 'S1', 'B2', 'S2', 'B3', 'S3', 'W1', 'W2', 'X1', 'X2', 'Y1'].map((n) => P(n));
  const fresh = P('Newbie', { age: 3600 });
  // five honest pairs at 10 to 12 Drakes; one pair washing at 1000 twenty times, which counts once; and self-sales,
  // which count never. With the page's own three pairs (x1-x2 at 13 and 60, a fresh seller at 6000) the median of the
  // eight pairs is 11.5 - the units' median would be 1000, and a self-sale counted would make it 12
  fx.sale({ buyer: b1, seller: s1, price: 10, at: t - 3 * DAY });
  fx.sale({ buyer: b2, seller: s2, price: 11, at: t - 3 * DAY });
  fx.fill({ filler: s3, poster: b3, price: 11, at: t - 3 * DAY });   // a fill is a Drakes sale too
  fx.sale({ buyer: b1, seller: s2, price: 11, at: t - 3 * DAY });
  fx.sale({ buyer: b2, seller: s3, price: 12, at: t - 3 * DAY });
  fx.sale({ buyer: b3, seller: s1, price: 1, at: t - MARKET_DAYS * DAY - 60 });   // past the median's days
  const wash = [];
  for (let i = 0; i < 20; i++) wash.push(fx.sale({ buyer: w1, seller: w2, price: 1000, at: t - 2 * DAY + i }));
  for (let i = 0; i < 5; i++) fx.sale({ buyer: x1, seller: x1, price: 5000, at: t - 2 * DAY + i });
  // gold's own table: three pairs at 100 gold (and the page's x1-x2 at 120)
  for (const [x, y] of [[b1, s2], [b2, s3], [b3, s1]]) fx.sale({ buyer: x, seller: y, price: 100, currency: 'gold', at: t - DAY });
  // a material with two pairs (one of them the page's) has no usual price
  fx.sale({ buyer: b1, seller: s1, material: 'ore:tin', price: 1, at: t - DAY });
  const honest = fx.sale({ buyer: x1, seller: x2, price: 13, at: t - 100 });
  const high = fx.sale({ buyer: x2, seller: x1, price: 60, at: t - 110 });
  const goldFair = fx.sale({ buyer: x2, seller: x1, price: 120, currency: 'gold', at: t - 120 });
  const tinFar = fx.sale({ buyer: y1, seller: x1, material: 'ore:tin', price: 1000, at: t - 130 });
  const freshSold = fx.sale({ buyer: x2, seller: fresh, price: 6000, units: 1, at: t - 140 });
  // one flag alone, far: twenty times past the usual is high by itself
  const far = fx.sale({ buyer: x1, seller: x2, price: 300, at: t - 150 });
  // a fresh account's bulk sale under five times the usual, and its bulk buy far under it: what each took past the usual
  const bulk = fx.sale({ buyer: x2, seller: fresh, price: 50, units: 200, at: t - 160 });
  const cheap = fx.sale({ buyer: fresh, seller: x2, price: 1, units: 200, at: t - 170 });
  const rows = new Map((await s.staff('/v1/staff/econ/stream', { kinds: ['sale', 'fill'] }, s.mob.session)).body.rows.map((r) => [r.id, r]));
  const flags = (k) => rows.get(k).flags.map((f) => f.flag).sort();
  assert.equal(rows.get(honest).usual, 11.5, 'the median of eight pairs - the washing pair once, the self-sales never');
  assert.deepEqual(flags(honest), []);
  assert.equal(rows.get(honest).level, null);
  assert.deepEqual(flags(high), ['price'], '60 is past five times 11.5');
  assert.equal(rows.get(high).level, 'medium');
  assert.match(rows.get(high).flags[0].why, /5\.2x the usual 12 marks/);
  assert.deepEqual(flags(wash[19]), ['price', 'repeat'], 'the washing pair is flagged twice');
  assert.equal(rows.get(wash[19]).level, 'high');
  assert.match(rows.get(wash[19]).flags.find((f) => f.flag === 'repeat').why, /^20 deals between these two accounts/);
  assert.equal(rows.get(goldFair).usual, 100, 'a gold sale is held to gold\'s sales alone');
  assert.deepEqual(flags(goldFair), []);
  assert.equal(rows.get(tinFar).usual, null, 'two pairs say no usual price');
  assert.deepEqual(flags(tinFar), []);
  // a fresh account sold one unit 5994 Drakes past the usual: about 60,000 gold
  assert.deepEqual(flags(freshSold), ['new', 'price']);
  assert.equal(rows.get(freshSold).level, 'high');
  assert.match(rows.get(freshSold).flags.find((f) => f.flag === 'new').why, /a new account took 59,885 gold past the usual price/);
  assert.equal(MARK_WORTH_GOLD, 10, 'the pin\'s arithmetic');
  assert.deepEqual(flags(far), ['price']);
  assert.equal(rows.get(far).level, 'high', 'a far price is high alone');
  assert.deepEqual(flags(bulk), ['new'], '50 is under five times the usual, and 200 of them took 77,000 gold past it');
  assert.equal(rows.get(bulk).level, 'high');
  assert.match(rows.get(bulk).flags[0].why, /took 77,000 gold past the usual price/);
  assert.deepEqual(flags(cheap), ['new', 'price'], 'a buyer takes what it paid under the usual');
  assert.match(rows.get(cheap).flags.find((f) => f.flag === 'price').why, /^a 11\.5th of the usual 12 marks/);
  // the usual price, asked directly: a pair once, and kept
  const db = s.env.DB;
  const u = await usualPrices(db, 'marks', ['ore:iron', 'ore:tin'], t);
  assert.deepEqual([u.get('ore:iron'), u.get('ore:tin')], [{ usual: 11.5, pairs: 8 }, { usual: null, pairs: 2 }]);
  assert.deepEqual((await usualPrices(db, 'gold', ['ore:iron'], t)).get('ore:iron'), { usual: 100, pairs: 4 });
});

test('STAFF-PANEL3-ECON: the repeat flag counts sales, fills and trades between one pair inside its days, either way round; one-sided and fresh trades', async () => {
  const s = await stand();
  const { fx } = s;
  const t = nowS();
  const L = ECON_LIMITS;
  const [a, b, c, d, e, f, g] = ['Alda', 'Brond', 'Cato', 'Dov', 'Elsa', 'Fen', 'Gil'].map((n) => fx.player(n));
  const fresh = fx.player('Newbie', { age: 3600 });
  // a and b: n - 1 deals inside the days (sales both ways, a fill, a trade) and one past them - then the n-th
  fx.sale({ buyer: a, seller: b, at: t - 1000 });
  fx.sale({ buyer: b, seller: a, at: t - 1100 });
  fx.fill({ filler: a, poster: b, at: t - 1200 });
  for (let i = 3; i < L.repeat.n - 1; i++) fx.sale({ buyer: a, seller: b, at: t - 1300 - i });
  fx.sale({ buyer: a, seller: b, at: t - L.repeat.days * DAY - 10 });
  const nth = fx.trade({ a, b, at: t - 50, aGets: { items: [], gold: 10 }, bGets: { items: [], gold: 10 } });
  const under = fx.sale({ buyer: c, seller: d, at: t - 60 });
  for (let i = 1; i < L.repeat.n - 1; i++) fx.sale({ buyer: d, seller: c, at: t - 2000 - i });
  // one-sided: a letter of credit for nothing; and sixty thousand gold for nothing, to a fresh account
  const letter = fx.trade({ a: e, b: f, at: t - 70, bGets: { items: [realmLetterOfCredit(L.oneSided.gold)], gold: 0 } });
  const small = fx.trade({ a: e, b: f, at: t - 80, bGets: { items: [], gold: L.oneSided.gold - 1 } });
  const gift = fx.trade({ a, b: fresh, at: t - 90, bGets: { items: [], gold: 60_000 } });
  const even = fx.trade({ a: g, b: fresh, at: t - 95, aGets: { items: [], gold: 9000 }, bGets: { items: [], gold: 9000 } });
  // one flag alone at a time: a gift far past the one-sided line to an old account; a fresh account given exactly the
  // fresh line (two flags at their lines); a fresh account trading 100 gold for 60,000 (not one-sided)
  const bigGift = fx.trade({ a: e, b: g, at: t - 96, bGets: { items: [], gold: L.oneSided.high } });
  const fresh2 = fx.player('Newer', { age: 60 });
  const edge = fx.trade({ a: d, b: fresh2, at: t - 97, bGets: { items: [], gold: L.fresh.gold } });
  const lopsided = fx.trade({ a, b: fresh2, at: t - 98, aGets: { items: [], gold: 100 }, bGets: { items: [], gold: 60_000 } });
  const rows = new Map((await s.staff('/v1/staff/econ/stream', { kinds: ['sale', 'trade'] }, s.mob.session)).body.rows.map((r) => [r.id, r]));
  const flags = (k) => rows.get(k).flags.map((f) => f.flag).sort();
  assert.deepEqual(flags(nth), ['repeat'], `${L.repeat.n} deals inside ${L.repeat.days} days`);
  assert.match(rows.get(nth).flags[0].why, new RegExp(`^${L.repeat.n} deals`));
  assert.equal(rows.get(nth).level, 'medium');
  assert.deepEqual(flags(under), [], `${L.repeat.n - 1} deals is not again and again`);
  assert.deepEqual(flags(letter), ['one-sided'], 'a letter of credit is its value');
  assert.equal(rows.get(letter).trade.aGave.value, L.oneSided.gold);
  assert.equal(rows.get(letter).level, 'medium');
  assert.deepEqual(flags(small), []);
  assert.deepEqual(flags(gift), ['new', 'one-sided']);
  assert.equal(rows.get(gift).level, 'high');
  assert.match(rows.get(gift).flags.find((f) => f.flag === 'one-sided').why, /^Newbie gave nothing for 60,000 gold of goods/);
  assert.deepEqual(flags(even), [], 'a fresh account trading even takes nothing');
  assert.deepEqual(flags(bigGift), ['one-sided']);
  assert.equal(rows.get(bigGift).level, 'high', 'a far gift is high alone');
  assert.deepEqual(flags(edge), ['new', 'one-sided'], 'each at its line');
  assert.equal(rows.get(edge).level, 'high', 'two flags are high');
  assert.deepEqual(flags(lopsided), ['new']);
  assert.equal(rows.get(lopsided).level, 'high', 'a far take by a fresh account is high alone');
  assert.match(rows.get(lopsided).flags[0].why, /^a new account took 59,900 gold more than it gave/);
  // the goods' worth: gold, a letter at what it holds, a piece at the item law's
  const side = tradeSideOf({ items: [realmLetterOfCredit(250), { templateIndex: 9999, name: 'no such thing' }], gold: 5 });
  assert.deepEqual(side, { gold: 5, value: 255, items: 2, names: ['Letter of Credit', 'no such thing'] });
  assert.equal(tradeSideOf({ items: [realmLetterOfCredit(60000)], gold: 0 }).value, 60000, 'a letter past the item law\'s ceiling still holds all its gold');
  assert.deepEqual(tradeSideOf(null), { gold: 0, value: 0, items: 0, names: [] });
});

test('STAFF-PANEL3-ECON: node activity puts the even-gap loop of many hours first - the day\'s run and gaps, the week\'s hours in a row', async () => {
  const s = await stand();
  const { fx } = s;
  const t = nowS();
  const H = ECON_LIMITS.harvest;
  const [bot, human, weekly, mod] = [fx.player('Botty'), fx.player('Hugh'), fx.player('Weekly'), s.raw.prepare("SELECT id FROM players WHERE handle = 'Asynian'").get().id];
  // a bot: five hours, a harvest a minute give or take two seconds, a new node each time
  for (let i = 0; i < 300; i++) fx.harvest({ player: bot, at: t - 6 * 3600 + i * 60 + (i % 3) - 1, node: `n${i}` });
  // a person: forty harvests at gaps from half a minute to fifteen, with a break
  let at = t - 20 * 3600;
  for (let i = 0; i < 40; i++) { at += [30, 400, 90, 900, 45, 200][i % 6] + (i === 20 ? 3600 : 0); fx.harvest({ player: human, at, node: `h${i}`, material: i % 2 ? 'herb:x' : 'ore:iron', kind: i % 2 ? 'herbs' : 'ore' }); }
  for (let i = 0; i < 10; i++) fx.harvest({ player: mod, at: t - 3600 + i * 7, node: `m${i}` });
  // the week: seventeen hours in a row with harvests, three days ago
  const hour0 = t - (t % 3600) - 3 * DAY;
  fx.hours(weekly, hour0, H.weekHigh + 1);
  fx.hours(weekly, hour0 + 30 * 3600, 3);
  fx.hours(human, hour0, 2);
  const r = await s.staff('/v1/staff/econ/harvests', {}, s.mob.session);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const list = r.body.players;
  assert.deepEqual(list.map((p) => p.name).slice(0, 2), ['Botty', 'Weekly'], 'the longer, evener run first');
  const b = list.find((p) => p.id === bot);
  assert.equal(b.level, 'high');
  assert.equal(b.day.harvests, 300);
  assert.equal(b.run.harvests, 300);
  assert.equal(b.run.nodes, 300);
  assert.ok(Math.abs(b.run.hours - 299 / 60) < 0.01, String(b.run.hours));
  assert.ok(b.run.even < 0.05 && Math.abs(b.run.gapMean - 60) < 1, JSON.stringify(b.run));
  assert.match(b.why[0], /^5\.0 h unbroken over 300 nodes, gaps even/);
  assert.equal(b.day.hourly.reduce((x, y) => x + y, 0), 300);
  assert.equal(b.day.hourly.length, 24);
  assert.deepEqual(b.day.materials, [{ material: 'ore:iron', harvests: 300, qty: 300 }]);
  const w = list.find((p) => p.id === weekly);
  assert.equal(w.level, 'high');
  assert.equal(w.week.streak, H.weekHigh + 1);
  assert.equal(w.week.hours, H.weekHigh + 4);
  assert.match(w.why[0], /^17 h in a row with harvests this week/);
  const h = list.find((p) => p.id === human);
  assert.equal(h.level, 'low');
  assert.equal(h.day.harvests, 40);
  assert.equal(h.week.streak, 2);
  assert.ok(h.run.even > H.evenMedium, 'a person\'s gaps are uneven');
  assert.ok(h.run.hours < 0.5 && h.run.harvests <= 6, `a gap past ${H.breakS} s ends a run: ${JSON.stringify(h.run)}`);
  assert.equal(list.find((p) => p.id === mod).staff, true, 'staff are named, so their tests are not read as bots');
  assert.equal(b.staff, false);
  assert.equal(r.body.total, 4);
  assert.equal(r.body.next, null);
  // newest first: by the last harvest
  const newest = (await s.staff('/v1/staff/econ/harvests', { sort: 'newest' }, s.mob.session)).body.players;
  assert.equal(newest[0].id, mod);
  // one player's own, by name: the day's harvests themselves, newest first
  const one = (await s.staff('/v1/staff/econ/harvests', { name: 'Botty' }, s.mob.session)).body.player;
  assert.equal(one.harvests.length, 300);
  assert.equal(one.harvests[0].node, 'n299');
  assert.equal(one.level, 'high');
  assert.equal((await s.staff('/v1/staff/econ/harvests', { name: 'nobody here' }, s.mob.session)).status, 404);
  assert.deepEqual(s.audits('harvests-read').map((a) => a.target), [null, null, bot]);
});

test('STAFF-PANEL3-ECON: a harvester\'s level at each of its limits', () => {
  const H = ECON_LIMITS.harvest;
  const run = (hours, even, nodes = H.nodesHigh) => ({ run: { hours, even, nodes }, streak: 0 });
  assert.equal(harvestLevel(run(H.runHigh, H.evenHigh)).level, 'high');
  assert.equal(harvestLevel(run(H.runHigh - 0.01, H.evenHigh)).level, 'medium');
  assert.equal(harvestLevel(run(H.runHigh, H.evenHigh + 0.01)).level, 'medium');
  assert.equal(harvestLevel(run(H.runHigh, H.evenHigh, H.nodesHigh - 1)).level, 'medium', 'a short route is no loop');
  assert.equal(harvestLevel(run(H.runMedium, H.evenMedium)).level, 'medium');
  assert.equal(harvestLevel(run(H.runMedium - 0.01, H.evenMedium)).level, 'low');
  assert.equal(harvestLevel(run(H.runMedium, H.evenMedium + 0.01)).level, 'low');
  assert.equal(harvestLevel({ run: { hours: 9, even: null, nodes: 1 }, streak: 0 }).level, 'low', 'one harvest has no gaps');
  assert.equal(harvestLevel({ run: null, streak: H.weekHigh }).level, 'high');
  assert.equal(harvestLevel({ run: null, streak: H.weekHigh - 1 }).level, 'medium');
  assert.equal(harvestLevel({ run: null, streak: H.weekMedium }).level, 'medium');
  assert.equal(harvestLevel({ run: null, streak: H.weekMedium - 1 }).level, 'low');
  assert.deepEqual(harvestLevel({ run: null, streak: H.weekMedium - 1 }).why, []);
  // the score orders inside a level: longer and more even first
  assert.ok(harvestLevel(run(6, 0.1)).score > harvestLevel(run(5, 0.1)).score);
  assert.ok(harvestLevel(run(5, 0.05)).score > harvestLevel(run(5, 0.2)).score);
});

test('STAFF-PANEL3-ECON: the economy - where the service holds gold, the Marks, what came and went a day at a time, the richest - and its days capped', async () => {
  const s = await stand();
  const { fx, raw } = s;
  const t = nowS();
  const today = utcDay(t);
  const [a, b] = [fx.player('Alda'), fx.player('Brond')];
  raw.prepare("INSERT INTO market_gold (player, char_id, gold) VALUES (?, 'c1', 300), (?, 'c2', 200)").run(a, b);
  fx.guild('Wolves', { treasury: 1000, realmGold: 600, marks: 40 });
  fx.guild('Bears', { treasury: 50, realmGold: 50, marks: 4 });
  // Marks: struck to accounts, burnt, and into and out of escrow (the ledger's triggers move the balances)
  const line = (src, srcId, dst, dstId, kind, amount, day, rid) => raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`).run(src, srcId, dst, dstId, kind, amount, day, day * DAY, a, rid);
  line('mint', null, 'account', a, 'gather', 100, today, 'r1');
  line('mint', null, 'account', b, 'find', 30, today - 1, 'r2');
  line('mint', null, 'account', b, 'gather', 999, today - ECON_DAYS_DEFAULT, 'r3');   // a day before the window
  line('account', a, 'burn', null, 'stock', 20, today, 'r4');
  line('account', a, 'escrow', 'o1', 'order', 50, today, 'r5');
  line('escrow', 'o1', 'account', b, 'order', 15, today, 'r6');
  // gold: the service's faucets, gold's market tax and fee, and what the games made and spent
  raw.prepare("INSERT INTO realm_faucets (hour, kind, gold, n) VALUES (?, 'patron', 700, 3), (?, 'repair', 80, 1)").run(Math.floor(t / 3600), Math.floor(t / 3600) - 24);
  fx.sale({ buyer: a, seller: b, currency: 'gold', price: 1000, tax: 50, fee: 10, at: t - 60 });
  fx.sale({ buyer: a, seller: b, currency: 'marks', price: 1000, tax: 50, at: t - 60 });   // a Drakes sale's tax is the ledger's
  const rich = [];
  for (let i = 0; i < RICHEST + 2; i++) rich.push(fx.character(a, `Rich${i}`, RICH_FLOOR + i * 1000));
  fx.character(b, 'Poor', RICH_FLOOR - 1);
  fx.character(b, 'Dead', RICH_FLOOR * 10, { dead: true });
  const cid = raw.prepare("SELECT id FROM realm_characters WHERE name = 'Rich0'").get().id;
  raw.prepare('INSERT INTO realm_wealth_hours (char_id, hour, player, level, gain, loss, played_s) VALUES (?, ?, ?, 10, 500, 120, 3600), (?, ?, ?, 10, 40, 0, 3600)')
    .run(cid, t - (t % 3600), a, cid, t - (t % 3600) - DAY, a);
  raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, price, bought_at, rent_due) VALUES (1, 1, ?, 'c1', 'Alda', 1, 5000, 1, 77)").run(a);

  const r = await s.staff('/v1/staff/econ/economy', {}, s.mob.session);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const e = r.body;
  assert.equal(e.days, ECON_DAYS_DEFAULT);
  assert.equal(e.daily.length, ECON_DAYS_DEFAULT);
  assert.equal(e.daily.at(-1).day, today);
  assert.deepEqual(e.gold.held, { market: 500, guildRealm: 650, guildLegacy: 400, rent: 77 });
  assert.deepEqual(e.gold.sources.sort((x, y) => x.kind.localeCompare(y.kind)), [{ kind: 'patron', gold: 700, n: 3 }, { kind: 'repair', gold: 80, n: 1 }]);
  assert.deepEqual(e.gold.sinks, [{ kind: 'market-tax', gold: 50 }, { kind: 'market-fee', gold: 10 }]);
  assert.deepEqual(e.gold.inGames, { gain: 540, loss: 120 });
  assert.deepEqual(e.marks.minted, { gather: 100, find: 30 });
  assert.deepEqual(e.marks.burnt, { stock: 20 });
  assert.equal(e.marks.escrow, 35);
  assert.equal(e.marks.guilds, 44);
  assert.equal(e.marks.accounts, 100 - 20 - 50 + 30 + 999 + 15);
  assert.deepEqual(e.daily.at(-1), { day: today, marksMinted: 100, marksBurnt: 20, goldIn: 700, goldOut: 60, gameGain: 500, gameLoss: 120 });
  assert.deepEqual(e.daily.at(-2), { day: today - 1, marksMinted: 30, marksBurnt: 0, goldIn: 80, goldOut: 0, gameGain: 40, gameLoss: 0 });
  assert.equal(e.richest.characters.length, RICHEST);
  assert.deepEqual(e.richest.characters.map((c) => c.name), Array.from({ length: RICHEST }, (_, i) => `Rich${RICHEST + 1 - i}`));
  assert.equal(e.richest.characters[0].owner, 'Alda');
  assert.deepEqual(e.richest.guilds.map((g) => [g.name, g.gold, g.realmGold, g.legacyGold, g.marks]), [['Wolves', 1000, 600, 400, 40], ['Bears', 50, 50, 0, 4]]);
  // the days: capped, and a day counts from today back
  const wide = (await s.staff('/v1/staff/econ/economy', { days: 99 }, s.mob.session)).body;
  assert.equal(wide.days, ECON_DAYS_MAX);
  assert.equal(wide.daily.length, ECON_DAYS_MAX);
  assert.equal(wide.marks.minted.gather, 1099);
  assert.equal((await s.staff('/v1/staff/econ/economy', { days: 1 }, s.mob.session)).body.daily.length, 1);
  assert.deepEqual(s.audits('economy-read').map((x) => JSON.parse(x.detail).days), [ECON_DAYS_DEFAULT, ECON_DAYS_MAX, 1]);
});

test('ECON-LEFT-OUT and ECON-WORTH: a banned account\'s and a held character\'s gold is kept out of the economy and said apart; the worth of the rest, split purse, bank and items (mutants: the ban ignored; the hold ignored; a hold past its time on the dead kept out; the split dropped)', async () => {
  const db = d1();
  const t = 1_800_000_000;
  const fx = fixtures(db._raw, t);
  const raw = db._raw;
  const [ok, banned, holder] = [fx.player('Alda'), fx.player('Brond'), fx.player('Cyra')];
  raw.prepare('UPDATE players SET banned_until = ? WHERE id = ?').run(t + DAY, banned);
  const lapsed = fx.player('Dorn');
  raw.prepare('UPDATE players SET banned_until = ? WHERE id = ?').run(t - 1, lapsed);   // a ban over is no ban
  const idOf = (name) => raw.prepare('SELECT id FROM realm_characters WHERE name = ?').get(name).id;
  fx.character(ok, 'Good', RICH_FLOOR + 10);
  fx.character(banned, 'Banned', RICH_FLOOR * 9);
  fx.character(holder, 'Held', RICH_FLOOR * 8);
  fx.character(holder, 'Free', RICH_FLOOR + 5);   // the same account's other character, not held: counted
  fx.character(lapsed, 'Lapsed', RICH_FLOOR + 1);
  fx.character(ok, 'Unweighed', null);   // the judge never weighed it: worth its gold, no items
  raw.prepare("UPDATE realm_characters SET held = 'dupe', held_at = ? WHERE id = ?").run(t - 60, idOf('Held'));
  const census = (name, tally) => raw.prepare('INSERT INTO item_census (char_id, player, tally, seq, at) VALUES (?, (SELECT player FROM realm_characters WHERE id = ?), ?, 1, ?)')
    .run(idOf(name), idOf(name), JSON.stringify(tally), t - 60);
  census('Good', { g: 1000, b: 400, t113: 2 });
  census('Banned', { g: 50_000, b: 0 });
  census('Held', { g: 70_000, b: 10 });
  census('Free', { g: 300 });   // a tally from before the split: purse and bank one figure
  census('Lapsed', { g: 20, b: 5 });
  census('Unweighed', { g: 40, b: 0 });
  const mg = raw.prepare('INSERT INTO market_gold (player, char_id, gold) VALUES (?, ?, ?)');
  mg.run(ok, idOf('Good'), 11); mg.run(banned, idOf('Banned'), 1000); mg.run(holder, idOf('Held'), 2000); mg.run(holder, idOf('Free'), 3);
  const home = raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, price, bought_at, rent_due) VALUES (?, 1, ?, ?, 'x', 1, 1, 1, ?)");
  home.run(1, ok, idOf('Good'), 7); home.run(2, banned, idOf('Banned'), 70);
  const hour = t - (t % 3600);
  const wh = raw.prepare('INSERT INTO realm_wealth_hours (char_id, hour, player, level, gain, loss) VALUES (?, ?, ?, 10, ?, ?)');
  wh.run(idOf('Good'), hour, ok, 5, 1); wh.run(idOf('Banned'), hour, banned, 900_000, 0); wh.run(idOf('Held'), hour, holder, 800_000, 3);

  const e = await economy(db, t, 7);
  assert.equal(e.gold.held.market, 11 + 3, 'the banned and the held character\'s market gold kept out');
  assert.equal(e.gold.held.rent, 7);
  assert.deepEqual(e.gold.inGames, { gain: 5, loss: 1 }, 'their hours kept out');
  assert.deepEqual(e.richest.characters.map((c) => c.name), ['Good', 'Free', 'Lapsed'], 'the banned and the held off the list; a lapsed ban counted');
  assert.deepEqual(e.gold.leftOut, { market: 3000, rent: 70, worth: RICH_FLOOR * 17, characters: 2 });
  const total = (RICH_FLOOR + 10) + (RICH_FLOOR + 5) + (RICH_FLOOR + 1) + 40;
  assert.deepEqual(e.gold.worth, { total, characters: 4, purse: (1000 - 400) + (20 - 5) + 40, bank: 405, unsplit: 300, items: total - 1360 });
  assert.equal(e.gold.worth.purse + e.gold.worth.bank + e.gold.worth.unsplit + e.gold.worth.items, total, 'the parts make the whole');

  // a law hold whose time ran out on a character that can checkpoint no more stands no more (realm.js holdStandsSql): counted again
  const db2 = d1();
  const fx2 = fixtures(db2._raw, t);
  const p2 = fx2.player('Eld');
  fx2.character(p2, 'Gone', RICH_FLOOR + 3);
  db2._raw.prepare("UPDATE realm_characters SET held = 'law', held_until = ?, law_sig = NULL WHERE name = 'Gone'").run(t - 10);
  const gone = db2._raw.prepare("SELECT id FROM realm_characters WHERE name = 'Gone'").get().id;
  db2._raw.prepare('INSERT INTO market_gold (player, char_id, gold) VALUES (?, ?, 9)').run(p2, gone);
  assert.equal((await economy(db2, t, 7)).gold.held.market, 0, 'alive and held: kept out');
  db2._raw.prepare('UPDATE realm_characters SET dead_at = ? WHERE id = ?').run(t - 5, gone);
  assert.equal((await economy(db2, t + ECON_KEEP_S, 7)).gold.held.market, 9, 'dead, its law hold out of time: no hold stands');
});

test('STAFF-PANEL3-ECON: a heavy answer is read once and kept - the economy two trips cold and none warm, until its minutes run out', async () => {
  const db = d1();
  const fx = fixtures(db._raw, 1_800_000_000);
  const a = fx.player('Alda');
  fx.guild('Wolves', { treasury: 10 });
  let trips = 0;
  const counted = new Proxy(db, {
    get(target, k) {
      if (k === 'batch') return (list) => { trips++; return target.batch(list); };
      if (k === 'prepare') return (sql) => { const st = target.prepare(sql); return { ...st, bind: (...x) => { st.bind(...x); return { first: () => { trips++; return st.first(); }, all: () => { trips++; return st.all(); }, run: () => { trips++; return st.run(); }, _result: () => st._result() }; } }; };
      return target[k];
    },
  });
  const t0 = 1_800_000_000;
  const first = await economy(counted, t0, 7);
  assert.equal(trips, 2, 'one batch, and the guilds\' list');
  db._raw.prepare("UPDATE guilds SET treasury = 99, moved_at = 1, moved_by = 'test'").run();
  const again = await economy(counted, t0 + ECON_KEEP_S - 1, 7);
  assert.equal(trips, 2, 'kept');
  assert.equal(again, first);
  const later = await economy(counted, t0 + ECON_KEEP_S, 7);
  assert.equal(later.richest.guilds[0].gold, 99, 'read again once its minutes ran out');
  assert.equal(trips, 4);
  await economy(counted, t0 + ECON_KEEP_S, 3);
  assert.equal(trips, 5, 'another reach is its own answer (the guilds\' list kept)');
  // node activity: kept HARVEST_KEEP_S
  fx.harvest({ player: a, at: t0 - 100, node: 'n1' });
  const watch = (at) => HOME_WATCH.top({ db: counted, nowS: at }, {}, { role: 'admin' }, 5);
  await watch(t0);
  const cold = trips;
  await watch(t0 + HARVEST_KEEP_S - 1);
  assert.equal(trips, cold, 'the watch is kept');
  await watch(t0 + HARVEST_KEEP_S);
  assert.ok(trips > cold);
  // a stream page: its sources in one trip, its flags' reads in one more and a usual price a currency
  fx.sale({ buyer: a, seller: fx.player('Brond'), at: t0 - 10 });
  const before = trips;
  const page = await streamPage(counted, { player: null, kinds: ['sale', 'fill', 'bid', 'trade', 'vault'], since: t0 - DAY, until: t0, item: null, priceMin: null, priceMax: null, region: null, before: null }, t0);
  assert.equal(page.rows.length, 1);
  assert.equal(trips - before, 3);
});

test('STAFF-PANEL3-ECON: per guild - gold, its realm part and the unverified rest, Marks and the vault, sorted as asked and paged', async () => {
  const s = await stand();
  const { fx, raw } = s;
  const p = fx.player('Alda');
  const w = fx.guild('Wolves', { treasury: 1000, realmGold: 100, marks: 5 });
  fx.guild('Bears', { treasury: 500, realmGold: 500, marks: 50 });
  fx.guild('Owls', { treasury: 10, realmGold: 10 });
  raw.prepare("INSERT INTO guild_vault (guild_id, slot, rec, name, count, dep_player, dep_char, dep_name, at) VALUES (?, 0, '{}', 'Ore', 7, ?, 'c', 'Alda', 1), (?, 1, '{}', 'Gem', 2, ?, 'c', 'Alda', 1)").run(w, p, w, p);
  raw.prepare("INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, 'c', ?, 1, 'Alda', 1)").run(p, w);
  const ask = async (body) => (await s.staff('/v1/staff/econ/guilds', body, s.mob.session)).body;
  const gold = await ask({});
  assert.equal(gold.sort, 'gold');
  assert.deepEqual(gold.guilds.map((g) => g.name), ['Wolves', 'Bears', 'Owls']);
  assert.deepEqual(gold.guilds[0], { id: w, name: 'Wolves', tag: 'WOLV', gold: 1000, realmGold: 100, legacyGold: 900, marks: 5, members: 1, vault: { slots: 2, items: 9 } });
  assert.deepEqual((await ask({ sort: 'marks' })).guilds.map((g) => g.name), ['Bears', 'Wolves', 'Owls']);
  assert.deepEqual((await ask({ sort: 'realm' })).guilds.map((g) => g.name), ['Bears', 'Wolves', 'Owls']);
  assert.deepEqual((await ask({ sort: 'legacy' })).guilds.map((g) => g.name)[0], 'Wolves');
  assert.deepEqual((await ask({ sort: 'vault' })).guilds.map((g) => g.name)[0], 'Wolves');
  assert.equal((await ask({ sort: 'treasury; DROP TABLE guilds' })).sort, 'gold', 'a sort is one of the named, or gold');
  const page = await ask({ from: 2 });
  assert.deepEqual([page.guilds.map((g) => g.name), page.next, page.total], [['Owls'], null, 3]);
  assert.equal(s.audits('guilds-read').length, 5, 'once a view: gold, marks, realm, legacy and vault');
});

test('STAFF-PANEL3-ECON: the Home watch names the market\'s worst of the day and the bot-like harvesters, an Admin\'s alone', async () => {
  const s = await stand();
  const { fx } = s;
  const t = nowS();
  const L = ECON_LIMITS;
  const [a, b, c] = ['Alda', 'Brond', 'Cato'].map((n) => fx.player(n));
  const fresh = fx.player('Newbie', { age: 60 });
  const bot = fx.player('Botty');
  for (let i = 0; i < 300; i++) fx.harvest({ player: bot, at: t - 6 * 3600 + i * 60, node: `n${i}` });
  fx.trade({ a, b: fresh, at: t - 100, bGets: { items: [], gold: L.fresh.gold } });   // a gift to a fresh account
  fx.trade({ a: b, b: c, at: t - 200, aGets: { items: [], gold: L.oneSided.gold } });   // a gift the other way round
  fx.trade({ a: b, b: c, at: t - DAY - 10, aGets: { items: [], gold: L.oneSided.high } });   // yesterday's
  for (let i = 0; i < L.repeat.n; i++) fx.sale({ buyer: b, seller: a, at: t - 300 - i });
  const ctx = { db: s.env.DB, nowS: t };
  const top = await HOME_WATCH.top(ctx, s.env, { role: 'admin' }, 10);
  assert.equal(HOME_WATCH.role, 'admin');
  assert.equal(top.total, 4);
  assert.equal(top.high, 2);
  assert.deepEqual(top.items.map((i) => i.level), ['high', 'high', 'medium', 'medium']);
  const by = (sub) => top.items.filter((i) => i.sub === sub);
  assert.match(by(fresh)[0].why, /^took 5,000 gold of goods for nothing from Alda in a trade \(a new account\)/);
  assert.equal(by(fresh)[0].name, 'Newbie');
  assert.equal(by(bot)[0].level, 'high');
  assert.match(by(bot)[0].why, /unbroken over 300 nodes/);
  assert.match(by(b)[0].why, /^took 500 gold of goods for nothing from Cato/);
  const pair = top.items.find((i) => /deals with/.test(i.why));
  assert.match(pair.why, new RegExp(`^${L.repeat.n} deals with (Alda|Brond) in a day`));
  assert.equal(pair.level, 'medium');
  assert.equal((await HOME_WATCH.top(ctx, s.env, { role: 'admin' }, 1)).items.length, 1);
  assert.deepEqual(await HOME_WATCH.top(ctx, s.env, { role: 'moderator' }, 10), { items: [], high: 0, total: 0 });
});

test('STAFF-PANEL3-ECON: every statement stands on an index - no big table walked, the escrow\'s sum covered, the rich floor the index\'s own (migration 0153)', async () => {
  const db = d1();
  const t = 1_800_000_000;
  const fx = fixtures(db._raw, t);
  const P = fx.player('Alda');
  const asked = [];
  const rec = new Proxy(db, { get(target, k) { if (k === 'prepare') return (sql) => { asked.push(sql); return target.prepare(sql); }; return target[k]; } });
  const view = (o) => ({ player: null, kinds: ['sale', 'fill', 'bid', 'trade', 'vault'], since: t - 7 * DAY, until: t, item: null, priceMin: null, priceMax: null, region: null, before: null, ...o });
  fx.sale({ buyer: P, seller: fx.player('Brond'), at: t - 10 });
  await streamPage(rec, view({}), t);
  await streamPage(rec, view({ player: { id: P, handle: 'Alda' }, before: { at: t, k: 'z' } }), t);
  await streamPage(rec, view({ item: 'ore:iron', priceMin: 1, region: 3 }), t);
  await usualPrices(rec, 'gold', ['ore:tin'], t);
  await harvestRows(rec, {}, [P], t);
  await economy(rec, t, 14);
  await HOME_WATCH.top({ db: rec, nowS: t }, {}, { role: 'admin' }, 5);
  const plans = asked.map((sql) => [sql, db._raw.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map((r) => r.detail).join(' | ')]);
  const BIG = ['market_sales', 'market_fills', 'market_bids', 'market_auctions', 'market_listings', 'market_orders', 'realm_trades', 'guild_vault_log', 'node_harvests',
    'progress_hours', 'marks_ledger', 'realm_characters', 'realm_wealth_hours', 'players', 'realm_faucets'];
  const aliases = { s: 'market_sales', f: 'market_fills', d: 'market_bids', u: 'market_auctions', l: 'market_listings', o: 'market_orders', t: 'realm_trades', v: 'guild_vault_log', c: 'realm_characters', p: 'players' };
  for (const [sql, plan] of plans) {
    const ctes = new Set([...sql.matchAll(/(?:WITH|,)\s*(\w+) AS \(/g)].map((m) => m[1]));   // a statement's own steps
    for (const m of plan.matchAll(/\bSCAN (\w+)( USING (COVERING )?INDEX (\w+))?/g)) {
      if (ctes.has(m[1]) && !m[2]) continue;
      const table = aliases[m[1]] ?? m[1];
      if (m[1] === 'marks_ledger') { assert.equal(m[4], 'idx_marks_ledger_escrow', plan); assert.ok(m[3], 'the escrow\'s sum is covered'); continue; }
      assert.ok(!BIG.includes(table), `${table} walked: ${plan}\n${sql}`);
    }
  }
  const all = plans.map((p) => p[1]).join('\n');
  for (const ix of ['idx_market_sales_at', 'idx_market_fills_at', 'realm_trades_b_player', 'idx_guild_vault_log_at', 'idx_guild_vault_log_who', 'idx_market_sales_material',
    'idx_market_fills_material', 'idx_marks_ledger_escrow', 'idx_realm_characters_rich', 'idx_node_harvests_day', 'idx_node_harvests_account', 'progress_hours_hour', 'idx_marks_day', 'realm_wealth_hours_hour']) {
    assert.match(all, new RegExp(`\\b${ix}\\b`), `${ix} unused`);
  }
  // the migration's floor is the module's
  assert.match(String(db._raw.prepare("SELECT sql FROM sqlite_master WHERE name = 'idx_realm_characters_rich'").get().sql), new RegExp(`WHERE wealth >= ${RICH_FLOOR}$`));
  // and marks.js marksReport's own escrow statement takes the index as well
  const report = db._raw.prepare(`EXPLAIN QUERY PLAN SELECT COALESCE(SUM(CASE WHEN dst_kind = 'escrow' THEN amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN src_kind = 'escrow' THEN amount ELSE 0 END), 0) AS s FROM marks_ledger WHERE dst_kind = 'escrow' OR src_kind = 'escrow'`).all().map((r) => r.detail).join(' | ');
  assert.match(report, /COVERING INDEX idx_marks_ledger_escrow/);
});
