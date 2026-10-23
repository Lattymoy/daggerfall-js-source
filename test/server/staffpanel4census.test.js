// STAFF-PANEL4-CENSUS (2026-10-22, mob picked it, 04:13Z; design doc "DFO Staff Panel: design", "Item and gold census",
// "Server load" and the weak spots "Copies found misses modded dupes..." and "Census rows ride every save...") - THE ITEM
// AND GOLD CENSUS AND THE CONTESTED PIECES (server-account/src/staffCensus.js), driven through the real Worker on the
// node:sqlite database every account pin stands on (test/accountDb.mjs): the tally a checkpoint takes - on the hour's row
// and the character's latest, only when it changed, and never the checkpoint's undoing when it fails - a kind's count,
// where it sits and its holders paged, its daily trend and its jumps, the off-peak backfill, and the contested pieces
// with their first holder, claimant and trail check. Admin only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../server-account/src/index.js';
import { standService, d1 } from '../accountDb.mjs';
import { seatRealm, freshSave, layRecord } from '../realmSeat.mjs';
import { staffWords, STAFF_SESSION_HEADER } from '../../server-account/src/staff.js';
import {
  CENSUS_ROUTES, CENSUS_KINDS_MAX, CENSUS_ITEMS_MAX, CENSUS_PAGE, CENSUS_DAY_HOUR, CENSUS_QUIET_HOURS, CENSUS_DAYS_KEEP, CONTESTED_HIGH,
  TRAIL_NOTE_MAX, CONTESTED_HOME_KEEP_S, CONTESTED_PAGE, censusTally, censusStep, censusHooks, kindOf, findKinds, storeKeysOf, storeTemplateOf, censusDay, censusBackfill,
  HOME_WATCH, _forgetCensusForTests, contestedPage, staffCensus,
} from '../../server-account/src/staffCensus.js';
import { STAFF_ROUTES } from '../../server-account/src/service.js';
import { runCron, CRON_HOUR, HOUR_JOBS } from '../../server-account/src/cron.js';
import { DUPE_GRACE_S, ledgerStep, escrowSpentSteps, knownCopySteps } from '../../server-account/src/ledger.js';
import { itemWorth, lawTemplate } from '../../src/systems/item/itemLaw.js';
import { utcDay } from '../../src/net/marksLaw.js';

const { subtle } = globalThis.crypto;
const enc = new TextEncoder();
const PASSWORD = 'a good long one';
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
const realNow = Date.now;

async function extensionKey(clock) {
  const pair = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = b64url(new Uint8Array(await subtle.exportKey('raw', pair.publicKey)));
  let last = 0;
  const proof = async (what, handle, ts = Math.max(clock(), last + 1)) => {
    last = Math.max(last, ts);
    const sig = b64url(new Uint8Array(await subtle.sign({ name: 'Ed25519' }, pair.privateKey, enc.encode(staffWords(what, handle.toLowerCase(), ts)))));
    return { pub, ts, sig };
  };
  return { pub, proof };
}

/** The Worker on a clock the pin moves (`wait`), mob (an Admin and owner) and Asynian (a Moderator) signed in, three
 *  players, a realm character's checkpoint (`put`) and hand-laid rows. */
async function stand() {
  _forgetCensusForTests();
  let now = Math.floor(realNow() / 1000);
  Date.now = () => now * 1000;
  const clock = () => now;
  const mobKey = await extensionKey(clock);
  const s = await standService({
    DEVELOPER_HANDLES: 'Lattymoy,SirMcMobdon', MODERATOR_HANDLES: 'Asynian', OWNER_HANDLES: 'Lattymoy,SirMcMobdon', OWNER_KEYS: `SirMcMobdon:${mobKey.pub}`,
  });
  const raw = s.env.DB._raw;
  const staff = async (path, body = {}, token = null) => {
    const res = await s.fetch(`https://accounts.invalid${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.1', ...(token ? { [STAFF_SESSION_HEADER]: token } : {}) }, body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  for (const h of ['SirMcMobdon', 'Asynian']) await s.registered(h);
  const mob = (await staff('/v1/staff/login', { handle: 'SirMcMobdon', password: PASSWORD, ...(await mobKey.proof('login', 'SirMcMobdon')) })).body;
  const inv = await staff('/v1/staff/invite', { handle: 'Asynian' }, mob.session);
  const asyKey = await extensionKey(clock);
  const asy = (await staff('/v1/staff/enroll', { handle: 'Asynian', password: PASSWORD, invite: inv.body.invite, ...(await asyKey.proof('enroll', 'Asynian')) })).body;
  assert.ok(mob.session && asy.session, 'both signed in');
  /** A realm character made through the service (its first save a fresh one), and its checkpoint. */
  const seat = async (handle) => {
    const who = await s.registered(handle);
    const R = await seatRealm(s.env, who.secret, handle);
    return { who, R, id: R.id };
  };
  const put = async (c, save) => {
    const at = c.R.at();
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${c.id}/data`, {
      method: 'PUT', headers: { authorization: `Bearer ${c.who.secret}`, 'x-realm-lease': at.lease, 'x-realm-seq': String(at.seq + 1) }, body: JSON.stringify(save),
    }), s.env);
    assert.equal(res.status, 200, 'the checkpoint lands');
    return res.json();
  };
  const census = (id) => raw.prepare('SELECT tally, seq, at FROM item_census WHERE char_id = ?').get(id) ?? null;
  const hourRow = (id) => raw.prepare('SELECT tally, checkpoints FROM realm_wealth_hours WHERE char_id = ? AND hour = ?').get(id, Math.floor(now / 3600) * 3600) ?? null;
  /** A character laid by hand for `player` (its tally, when given, laid too). */
  let n = 0;
  const lay = (player, { tally = null, dead = false, name = null } = {}) => {
    const id = `r${(++n).toString(16).padStart(20, '0')}`;
    raw.prepare('INSERT INTO realm_characters (id, player, name, created_at, updated_at, dead_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, player, name ?? `Hero ${n}`, now, now, dead ? now : null);
    if (tally) raw.prepare('INSERT INTO item_census (char_id, player, tally, seq, at) VALUES (?, ?, ?, 3, ?)').run(id, player, JSON.stringify(tally), now - 60);
    return id;
  };
  const audits = (act) => raw.prepare('SELECT actor, act, target, detail, outcome FROM staff_audit WHERE act = ? ORDER BY id').all(act).map((r) => ({ ...r }));
  return {
    ...s, raw, staff, mob, asy, seat, put, census, hourRow, lay, audits, now: () => now,
    wait: (sec) => { now += sec; }, setNow: (t) => { now = t; },
    done: () => { Date.now = realNow; censusHooks.tallyOf = censusTally; _forgetCensusForTests(); },
  };
}

const piece = (t, extra = {}) => ({ templateIndex: t, ...extra });

test('STAFF-PANEL4-CENSUS: the doors are the staff panel\'s, none opens without a staff session, and a Moderator is refused every one - written down (mutant: the role check dropped)', async () => {
  for (const r of CENSUS_ROUTES) assert.ok(STAFF_ROUTES.has(r), r);
  const s = await stand();
  try {
    for (const r of CENSUS_ROUTES) {
      assert.deepEqual(await s.staff(r, { kind: 'gold' }), { status: 401, body: { error: 'staff-session' } }, r);
      assert.deepEqual(await s.staff(r, { kind: 'gold', q: 'gold' }, s.asy.session), { status: 403, body: { error: 'staff-admin' } }, `${r}: Admin only`);
    }
    const refused = s.audits('refused');
    assert.equal(refused.length, CENSUS_ROUTES.length);
    assert.ok(refused.every((a) => a.outcome === 'denied' && JSON.parse(a.detail).need === 'admin'));
  } finally { s.done(); }
});

test('STAFF-PANEL4-CENSUS: THE TALLY - gold (purse and banks, never a loan taken off), each template by its units, in index order; no save, no tally; past CENSUS_KINDS_MAX the dearest kept; the walk bounded (mutants: banks dropped; stacks counted one; the cap dropped; the cheapest kept)', () => {
  const save = { goldPieces: 100, bankAccounts: [{ accountGold: 50, loanTotal: 1000 }, { accountGold: 7 }], items: [piece(200, { stackCount: 5 }), piece(113), piece(113)], wagonItems: [piece(200, { stackCount: 2 })] };
  assert.equal(censusTally(save), '{"g":157,"t113":2,"t200":7}');
  assert.equal(censusTally({ ...save, items: [...save.items].reverse() }), censusTally(save), 'the same pieces, the same text');
  assert.equal(censusTally({ goldPieces: -5, bankAccounts: [{ accountGold: 1.5 }] }), '{"g":0}', 'gold written as gold is, or nothing');
  for (const no of [null, undefined, 'x', [], 7]) assert.equal(censusTally(no), null);
  // past the cap: the kinds worth least are left out, and how many is said
  const kinds = [];
  for (let t = 0; t < 288 && kinds.length < CENSUS_KINDS_MAX + 3; t++) if (lawTemplate(t)) kinds.push(t);
  const wide = { items: kinds.map((t) => piece(t)) };
  const worth = new Map(kinds.map((t) => [t, itemWorth(piece(t))]));
  const got = JSON.parse(/** @type {string} */ (censusTally(wide)));
  assert.equal(got.more, 3);
  const kept = Object.keys(got).filter((k) => /^t\d+$/.test(k)).map((k) => Number(k.slice(1)));
  assert.equal(kept.length, CENSUS_KINDS_MAX);
  const left = kinds.filter((t) => !kept.includes(t));
  assert.ok(left.every((l) => kept.every((k) => worth.get(k) > worth.get(l) || (worth.get(k) === worth.get(l) && k < l))), 'the dearest are kept');
  // the walk stops at CENSUS_ITEMS_MAX pieces
  assert.equal(JSON.parse(/** @type {string} */ (censusTally({ items: Array.from({ length: CENSUS_ITEMS_MAX + 9 }, () => piece(113)) }))).t113, CENSUS_ITEMS_MAX);
  // what staff type
  assert.deepEqual([kindOf('gold'), kindOf('marks'), kindOf(113), kindOf('t113'), kindOf('113'), kindOf('t99999'), kindOf('x'), kindOf(-1), kindOf(5000)], ['gold', 'marks', 't113', 't113', 't113', null, null, null, null]);
  assert.deepEqual(findKinds('gold').map((k) => k.kind).slice(0, 1), ['gold']);
  assert.ok(findKinds('drake').some((k) => k.kind === 'marks'));
  assert.ok(findKinds('113').some((k) => k.kind === 't113'));
  assert.ok(findKinds(String(lawTemplate(71).name).toUpperCase()).some((k) => k.kind === 't71'), 'a name, any case');
  assert.deepEqual(findKinds(''), []);
  assert.ok(storeKeysOf(71).includes('metal:iron'));
  assert.deepEqual([storeTemplateOf('metal:iron'), storeTemplateOf('p1:12'), storeTemplateOf('food:bread-nope')], [71, 12, null]);
});

test('STAFF-PANEL4-CENSUS: A CHECKPOINT TALLIES - its latest row and the hour\'s, ONLY WHEN IT CHANGED; a new hour that changed nothing carries no tally; a dead save none (mutants: the unchanged skip dropped; the hour row overwritten with nothing)', async () => {
  const s = await stand();
  try {
    const A = await s.seat('Ann');
    const first = s.census(A.id);
    assert.equal(first.tally, censusTally(freshSave({ name: 'Ann' })), 'the first save tallied');
    const items = [piece(200, { stackCount: 3 }), piece(113)];
    await s.put(A, freshSave({ name: 'Ann', items }));
    const changed = s.census(A.id);
    assert.equal(changed.tally, '{"g":100,"t113":1,"t200":3}');
    assert.equal(changed.seq, 2);
    assert.equal(s.hourRow(A.id).tally, changed.tally, 'the hour carries it');
    s.wait(30);
    await s.put(A, freshSave({ name: 'Ann', items }));
    assert.deepEqual(s.census(A.id), changed, 'unchanged: the latest row is not written again');
    assert.equal(s.hourRow(A.id).tally, changed.tally, 'and the hour keeps its own');
    assert.equal(s.hourRow(A.id).checkpoints >= 2, true);
    s.wait(3600);
    await s.put(A, freshSave({ name: 'Ann', items }));
    assert.deepEqual({ ...s.hourRow(A.id) }, { tally: null, checkpoints: 1 }, 'a new hour that changed nothing: no tally on its row');
    await s.put(A, freshSave({ name: 'Ann', items: [piece(113)] }));
    assert.equal(s.hourRow(A.id).tally, '{"g":100,"t113":1}');
    assert.equal(s.census(A.id).tally, '{"g":100,"t113":1}');
    assert.equal(s.census(A.id).seq, 5);
    // the step itself: no save, no census
    assert.deepEqual(censusStep(s.env.DB, { player: 'p', char: A.id, seq: 9, nowS: 1 }, null, null), { steps: [], tally: null });
  } finally { s.done(); }
});

test('STAFF-PANEL4-CENSUS: A CENSUS THAT FAILS NEVER FAILS THE CHECKPOINT - the tally forced to throw: the save lands, the verdict and the hour are written, the census is not (mutant: the catch dropped)', async () => {
  const s = await stand();
  try {
    const A = await s.seat('Bea');
    const before = s.census(A.id);
    const judged = s.raw.prepare('SELECT judged_seq FROM realm_characters WHERE id = ?').get(A.id).judged_seq;
    censusHooks.tallyOf = () => { throw new Error('forced'); };
    const warn = console.warn;
    const said = [];
    console.warn = (...a) => said.push(a.join(' '));
    try {
      const r = await s.put(A, freshSave({ name: 'Bea', items: [piece(113)] }));
      assert.equal(r.ok, true);
      assert.equal(r.seq, 2);
    } finally { console.warn = warn; }
    assert.ok(said.some((w) => /census/.test(w) && /forced/.test(w)), 'said in the log');
    assert.deepEqual(s.census(A.id), before, 'the census untouched');
    assert.equal(s.raw.prepare('SELECT judged_seq FROM realm_characters WHERE id = ?').get(A.id).judged_seq, judged + 1, 'the verdict written');
    assert.ok(s.hourRow(A.id).checkpoints >= 2, 'the hour written');
    censusHooks.tallyOf = censusTally;
    await s.put(A, freshSave({ name: 'Bea', items: [piece(113)] }));
    assert.equal(s.census(A.id).tally, '{"g":100,"t113":1}', 'the next checkpoint tallies again');
  } finally { s.done(); }
});

test('STAFF-PANEL4-CENSUS: A KIND\'S CENSUS - carried (the living characters\' latest), the Stores, guild vaults (gold: realm gold, the legacy said apart) and the market (all the service holds: listings and auctions till taken back, deliveries uncollected, goods on the road, the ledger\'s Marks escrow); holders ranked and paged; cached; written down once (mutants: the dead counted; a place dropped; the page\'s next; legacy gold counted; a held place dropped)', async () => {
  const s = await stand();
  try {
    const troll = await s.registered('Troll');
    const syl = await s.registered('Sylvia');
    const holders = [];
    for (let i = 0; i < CENSUS_PAGE + 2; i++) holders.push(s.lay(troll.id, { tally: { g: 10 * (i + 1), t71: i + 1 } }));
    s.lay(syl.id, { tally: { g: 99999, t71: 9999 }, dead: true });   // the dead hold nothing
    const big = s.lay(syl.id, { tally: { g: 5, t71: 500, t113: 2 }, name: 'Big' });
    // the Stores (a character's and a guild's), a guild's vault, and the market (a material, a piece from the pack)
    s.raw.prepare("INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, 'metal:iron', 'own', 40)").run(syl.id, big);
    s.raw.prepare("INSERT INTO guilds (id, name, name_key, tag, ranks, treasury, realm_gold, founded_at) VALUES ('g1', 'Iron Fist', 'iron fist', 'IRF', '[]', 700, 650, 1)").run();
    s.raw.prepare("INSERT INTO guild_prof_stores (guild_id, material, qty, moved_by, moved_at) VALUES ('g1', 'metal:iron', 6, 'x', 1)").run();
    s.raw.prepare(`INSERT INTO guild_vault (guild_id, slot, rec, name, count, dep_player, dep_char, dep_name, at) VALUES ('g1', 0, ?, 'Iron', 3, ?, ?, 'Big', 1)`).run(JSON.stringify(piece(71, { stackCount: 3 })), syl.id, big);
    const listing = (id, cols) => s.raw.prepare(`INSERT INTO market_listings (id, seller, char_id, region, kind, units, price, fee, at, expires_at, rid, n, ${Object.keys(cols).join(', ')})
      VALUES (?, ?, ?, 1, ?, ?, 10, 1, 1, 9999999999, ?, 'n', ${Object.keys(cols).map(() => '?').join(', ')})`).run(id, syl.id, big, cols.kind ?? 'material', cols.units ?? 1, `rid-${id}`, ...Object.values(cols));
    listing('l1', { kind: 'material', material: 'metal:iron', units: 8 });
    listing('l2', { kind: 'item', item: JSON.stringify(piece(71, { stackCount: 4 })), currency: 'gold' });
    listing('l3', { kind: 'material', material: 'metal:iron', units: 50, state: 'sold' });   // closed: not at the market
    listing('l4', { kind: 'material', material: 'metal:iron', units: 7, state: 'expired' });   // expired, not yet taken back: the market's still
    listing('l5', { kind: 'material', material: 'metal:iron', units: 60, state: 'expired', returned: 1 });   // taken back: the seller's
    // on the road: a couriered sale not yet in its buyer's Stores (one that arrived is the buyer's)
    const sale = (rid, units, delivered) => s.raw.prepare(`INSERT INTO market_sales (buyer, rid, char_id, listing, seller, kind, material, units, price, total, tax, from_region, to_region, arrives_at, delivered, at, day, n)
      VALUES (?, ?, ?, 'l0', ?, 'material', 'metal:iron', ?, 1, ?, 0, 1, 2, 9999999999, ?, 1, 1, 'n')`).run(syl.id, rid, big, troll.id, units, units, delivered);
    sale('s1', 5, 0);
    sale('s2', 90, 1);
    // crafted daggers the service holds: an auction open, one unsold not yet taken back, a listing expired likewise, a
    // delivery uncollected - and a pack's dagger stack delivered, uncollected; none of the closed, returned or collected
    const made = (prov) => s.raw.prepare("INSERT INTO products (provenance, owner, char_id, recipe, template, material, quality, seed, record, made_at) VALUES (?, ?, ?, 'r', 113, 1, 1, 1, '{}', 1)").run(prov, syl.id, big);
    const auction = (id, state, returned) => { made(`a${id}`.padEnd(16, '0')); s.raw.prepare(`INSERT INTO market_auctions (id, seller, char_id, region, provenance, wear, opening, fee, at, ends_at, state, returned, rid, n)
      VALUES (?, ?, ?, 1, ?, 1000, 5, 1, 1, 2, ?, ?, ?, 'n')`).run(id, syl.id, big, `a${id}`.padEnd(16, '0'), state, returned, `rid-${id}`); };
    auction('1', 'open', 0);
    auction('2', 'unsold', 0);
    auction('3', 'unsold', 1);
    auction('4', 'sold', 1);
    made('l6'.padEnd(16, '0'));
    listing('l6', { kind: 'piece', provenance: 'l6'.padEnd(16, '0'), wear: 1000, state: 'expired' });
    const delivery = (id, cols, collected = 0) => s.raw.prepare(`INSERT INTO market_deliveries (id, player, char_id, why, arrives_at, collected, at, ${Object.keys(cols).join(', ')})
      VALUES (?, ?, ?, 'bought', 1, ?, 1, ${Object.keys(cols).map(() => '?').join(', ')})`).run(id, syl.id, big, collected, ...Object.values(cols));
    made('d1'.padEnd(16, '0'));
    delivery('d1', { provenance: 'd1'.padEnd(16, '0'), wear: 1000 });
    delivery('d2', { item: JSON.stringify(piece(113, { stackCount: 3 })) });
    delivery('d3', { item: JSON.stringify(piece(113, { stackCount: 50 })) }, 1);
    s.raw.prepare('INSERT INTO market_gold (player, char_id, gold) VALUES (?, ?, 33)').run(syl.id, big);
    const r = await s.staff('/v1/staff/census', { kind: 't71' }, s.mob.session);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const carried = 500 + ((CENSUS_PAGE + 2) * (CENSUS_PAGE + 3)) / 2;
    assert.deepEqual(r.body.where, { carried, stores: 46, vaults: 3, market: 8 + 4 + 7 + 5 });
    assert.equal(r.body.total, carried + 46 + 3 + 24);
    assert.equal(r.body.legacyGold, undefined, 'legacy gold is gold\'s alone');
    assert.equal(r.body.holdersCount, CENSUS_PAGE + 3);
    assert.equal(r.body.name, lawTemplate(71).name);
    assert.deepEqual(r.body.holders[0], { char: big, name: 'Big', player: syl.id, handle: 'Sylvia', n: 500, at: s.now() - 60 });
    assert.deepEqual(r.body.holders.slice(1, 3).map((h) => h.n), [CENSUS_PAGE + 2, CENSUS_PAGE + 1]);
    assert.equal(r.body.holders.length, CENSUS_PAGE);
    assert.equal(r.body.next, CENSUS_PAGE);
    const p2 = await s.staff('/v1/staff/census', { kind: 't71', from: r.body.next }, s.mob.session);
    assert.deepEqual([p2.body.holders.length, p2.body.next, p2.body.holders.at(-1).n], [3, null, 1]);
    // cached: a new holder is not seen until the read is kept no longer
    s.lay(troll.id, { tally: { t71: 1000 } });
    const again = await s.staff('/v1/staff/census', { kind: 't71' }, s.mob.session);
    assert.deepEqual([again.body.at, again.body.where.carried], [r.body.at, carried]);
    s.wait(10 * 60);
    const fresh = await s.staff('/v1/staff/census', { kind: 't71' }, s.mob.session);
    assert.equal(fresh.body.where.carried, carried + 1000);
    // a kind no store holds: stores null
    const dagger = await s.staff('/v1/staff/census', { kind: 113 }, s.mob.session);
    assert.deepEqual(dagger.body.where, { carried: 2, stores: null, vaults: 0, market: 1 + 1 + 1 + 1 + 3 }, 'two auctions, a listing, a delivery, a stack of three');
    // gold: the latest purses and banks, the treasuries' realm gold (the rest unverified legacy gold, said apart and in no
    // total - the design's weak spot), what sales hold
    const gold = await s.staff('/v1/staff/census', { kind: 'gold' }, s.mob.session);
    const purses = 5 + 10 * ((CENSUS_PAGE + 2) * (CENSUS_PAGE + 3)) / 2;
    assert.deepEqual(gold.body.where, { carried: purses, stores: null, vaults: 650, market: 33 });
    assert.deepEqual([gold.body.legacyGold, gold.body.total], [50, purses + 650 + 33]);
    // Marks: the accounts', the guilds', the ledger's escrow - an open order's and a standing bid's alike, less what came back
    s.raw.prepare('INSERT INTO marks (account, balance) VALUES (?, 62), (?, 2)').run(troll.id, syl.id);   // 40 once its lines below move
    s.raw.prepare("INSERT INTO guild_marks (guild_id, balance) VALUES ('g1', 9)").run();
    s.raw.prepare(`INSERT INTO market_orders (id, poster, char_id, region, material, units, left_units, price, escrow, at, expires_at, rid, n) VALUES
      ('o1', ?, ?, 1, 'metal:iron', 5, 5, 3, 15, 1, 9999999999, 'r1', 'n')`).run(syl.id, big);
    const ledger = (src, dst, kind, amount) => s.raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, rid)
      VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`).run(src, src === 'account' ? troll.id : 'b1', dst, dst === 'account' ? troll.id : 'b1', kind, amount, troll.id, kind);
    ledger('account', 'escrow', 'order-escrow', 15);
    ledger('account', 'escrow', 'bid-escrow', 12);
    ledger('escrow', 'account', 'bid-return', 5);
    const marks = await s.staff('/v1/staff/census', { kind: 'marks' }, s.mob.session);
    assert.deepEqual(marks.body.where, { carried: 42, stores: null, vaults: 9, market: 15 + 12 - 5 });
    assert.deepEqual(marks.body.holders.map((h) => [h.player, h.handle, h.n, h.char]), [[troll.id, 'Troll', 40, null], [syl.id, 'Sylvia', 2, null]]);
    // refused words, and the reads written down once a kind in ten minutes
    assert.deepEqual((await s.staff('/v1/staff/census', { kind: 'nope' }, s.mob.session)).status, 400);
    assert.deepEqual(s.audits('census-read').map((a) => JSON.parse(a.detail).kind), ['t71', 't71', 't113', 'gold', 'marks']);
    const found = await s.staff('/v1/staff/census/find', { q: 'iron' }, s.mob.session);
    assert.ok(found.body.kinds.some((k) => k.kind === 't71'));
  } finally { s.done(); }
});

test('STAFF-PANEL4-CENSUS: THE DAY\'S TOTALS - once a UTC day at the census\'s quiet hour, every kind in every place (gold\'s vaults realm gold; the market all the service holds), old days swept; the read answers the trend (mutants: the hour gate; the once-a-day check; the sweep; legacy gold counted; a held place dropped)', async () => {
  const s = await stand();
  try {
    const syl = await s.registered('Sylvia');
    const a = s.lay(syl.id, { tally: { g: 50, t71: 4, more: 2 } });
    s.lay(syl.id, { tally: { g: 1, t71: 0 } });
    s.lay(syl.id, { tally: { g: 1000, t71: 1000 }, dead: true });
    s.raw.prepare("INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, 'metal:iron', 'own', 40)").run(syl.id, a);
    s.raw.prepare("INSERT INTO guilds (id, name, name_key, tag, ranks, treasury, realm_gold, founded_at) VALUES ('g1', 'Iron Fist', 'iron fist', 'IRF', '[]', 700, 650, 1)").run();
    s.raw.prepare('INSERT INTO marks (account, balance) VALUES (?, 40)').run(syl.id);
    // what the service holds: iron on the road, a crafted dagger at auction, a dagger stack delivered uncollected, Marks escrowed
    s.raw.prepare(`INSERT INTO market_sales (buyer, rid, char_id, listing, seller, kind, material, units, price, total, tax, from_region, to_region, arrives_at, delivered, at, day, n)
      VALUES (?, 's1', ?, 'l0', ?, 'material', 'metal:iron', 5, 1, 5, 0, 1, 2, 9999999999, 0, 1, 1, 'n')`).run(syl.id, a, syl.id);
    s.raw.prepare("INSERT INTO products (provenance, owner, char_id, recipe, template, material, quality, seed, record, made_at) VALUES ('a100000000000000', ?, ?, 'r', 113, 1, 1, 1, '{}', 1)").run(syl.id, a);
    s.raw.prepare(`INSERT INTO market_auctions (id, seller, char_id, region, provenance, wear, opening, fee, at, ends_at, rid, n)
      VALUES ('a1', ?, ?, 1, 'a100000000000000', 1000, 5, 1, 1, 2, 'r', 'n')`).run(syl.id, a);
    s.raw.prepare("INSERT INTO market_deliveries (id, player, char_id, why, arrives_at, at, item) VALUES ('d1', ?, ?, 'bought', 1, 1, ?)").run(syl.id, a, JSON.stringify(piece(113, { stackCount: 2 })));
    s.raw.prepare("INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, rid) VALUES ('account', 'x', 'escrow', 'b1', 'bid-escrow', 12, 1, 1, ?, 'b1')").run(syl.id);
    const day = utcDay(s.now());
    const at = day * 86400 + CENSUS_DAY_HOUR * 3600 + 41 * 60;
    s.raw.prepare("INSERT INTO item_census_days (kind, day, carried, holders, at) VALUES ('t71', ?, 1, 1, 1), ('t71', ?, 2, 1, 1)").run(day - CENSUS_DAYS_KEEP - 1, day - 3);
    assert.equal(await censusDay({ db: s.env.DB, nowS: at + 3600 }), 0, 'not its hour');
    const ran = await runCron(s.env, { cron: CRON_HOUR, nowS: at, jobs: HOUR_JOBS.filter(([name]) => name === 'census-day') });
    assert.deepEqual(ran.map((r) => [r.name, r.ok, r.changed > 0]), [['census-day', true, true]]);
    const row = (kind, d = day) => ({ ...s.raw.prepare('SELECT carried, stores, vaults, market, holders FROM item_census_days WHERE kind = ? AND day = ?').get(kind, d) });
    assert.deepEqual(row('t71'), { carried: 4, stores: 40, vaults: 0, market: 5, holders: 1 });
    assert.deepEqual(row('t113'), { carried: 0, stores: null, vaults: 0, market: 1 + 2, holders: 0 });
    assert.deepEqual(row('gold'), { carried: 51, stores: null, vaults: 650, market: 0, holders: 2 });
    assert.deepEqual(row('marks'), { carried: 40, stores: null, vaults: 0, market: 12, holders: 1 });
    assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM item_census_days WHERE kind = 'more'").get().n, 0, '`more` is no kind');
    assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM item_census_days WHERE day < ?').get(day - CENSUS_DAYS_KEEP).n, 0, 'old days swept');
    assert.equal(await censusDay({ db: s.env.DB, nowS: at + 60 }), 0, 'once a day');
    const r = await s.staff('/v1/staff/census', { kind: 't71', days: 7 }, s.mob.session);
    assert.deepEqual(r.body.trend.map((d) => [d.day, d.carried, d.total]), [[day - 3, 2, 2], [day, 4, 49]]);
    const one = await s.staff('/v1/staff/census', { kind: 't71', days: 1 }, s.mob.session);
    assert.deepEqual(one.body.trend.map((d) => d.day), [day], 'the range capped by `days`');
  } finally { s.done(); }
});

test('STAFF-PANEL4-CENSUS: THE BACKFILL, ONCE, OFF PEAK - only with CENSUS_BACKFILL on and in its quiet hours; every living character with a record and no tally, from its record; never over one a checkpoint wrote; done for good at the end (mutants: the switch; the hours; the dead filled; a row written over; done never kept)', async () => {
  const s = await stand();
  try {
    const A = await s.seat('Cai');
    const B = await s.seat('Dee');
    const D = await s.seat('Eve');
    layRecord(s.env, A.id, freshSave({ name: 'Cai', items: [piece(71, { stackCount: 6 })] }));
    s.raw.prepare('DELETE FROM item_census WHERE char_id IN (?, ?)').run(A.id, D.id);   // characters from before the census
    s.raw.prepare('UPDATE realm_characters SET dead_at = 1 WHERE id = ?').run(D.id);
    const kept = s.census(B.id);
    const day = utcDay(s.now()) * 86400;
    const quiet = day + CENSUS_QUIET_HOURS[1] * 3600;
    const env = { ...s.env, CENSUS_BACKFILL: 'on' };
    assert.equal(await censusBackfill({ db: s.env.DB, nowS: quiet }, s.env), 0, 'switched off');
    assert.equal(await censusBackfill({ db: s.env.DB, nowS: day + 20 * 3600 }, env), 0, 'never at peak');
    assert.equal(s.census(A.id), null);
    const ran = await runCron(env, { cron: CRON_HOUR, nowS: quiet, jobs: HOUR_JOBS.filter(([name]) => name === 'census-backfill') });
    assert.deepEqual(ran.map((r) => [r.ok, r.changed]), [[true, 1]]);
    const filled = s.census(A.id);
    assert.equal(filled.tally, '{"g":100,"t71":6}', 'from its stored record');
    assert.equal(filled.at, s.raw.prepare('SELECT updated_at FROM realm_characters WHERE id = ?').get(A.id).updated_at, 'as last saved');
    assert.deepEqual(s.census(B.id), kept, 'a checkpoint\'s own row stands');
    assert.equal(s.census(D.id), null, 'the dead are not filled');
    assert.equal(JSON.parse(s.raw.prepare("SELECT value FROM realm_config WHERE key = 'census-backfill'").get().value).done, true);
    s.raw.prepare('DELETE FROM item_census WHERE char_id = ?').run(A.id);
    assert.equal(await censusBackfill({ db: s.env.DB, nowS: quiet + 3600 }, env), 0, 'done for good');
    assert.equal(s.census(A.id), null);
  } finally { s.done(); }
});

test('STAFF-PANEL4-CENSUS: CENSUS JUMPS - the characters whose count rose most in the window, from the hours\' tallies, against their count before it (or their first in it); Marks have none (mutants: the base dropped; a fall listed)', async () => {
  const s = await stand();
  try {
    const syl = await s.registered('Sylvia');
    const [x, y, z] = [s.lay(syl.id, { name: 'X' }), s.lay(syl.id, { name: 'Y' }), s.lay(syl.id, { name: 'Z' })];
    const h = Math.floor(s.now() / 3600) * 3600;
    const hour = (c, at, t113) => s.raw.prepare('INSERT INTO realm_wealth_hours (char_id, hour, player, level, tally) VALUES (?, ?, ?, 1, ?)').run(c, at, syl.id, t113 == null ? null : JSON.stringify({ g: 1, t113 }));
    hour(x, h - 30 * 3600, 30); hour(x, h - 5 * 3600, 35); hour(x, h - 4 * 3600, null); hour(x, h - 3600, 69);   // rose 39 from before the window
    hour(y, h - 30 * 3600, 50); hour(y, h - 2 * 3600, 5);   // fell
    hour(z, h - 6 * 3600, 3); hour(z, h, 10);   // rose 7 from its first in the window (no tally before it)
    const r = await s.staff('/v1/staff/census/jumps', { kind: 't113' }, s.mob.session);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body.jumps.map((j) => [j.char, j.name, j.from, j.to, j.rise]), [[x, 'X', 30, 69, 39], [z, 'Z', 3, 10, 7]]);
    assert.equal(r.body.next, null);
    const short = await s.staff('/v1/staff/census/jumps', { kind: 't113', hours: 2 }, s.mob.session);
    assert.deepEqual(short.body.jumps.map((j) => [j.name, j.from, j.to]), [['X', 35, 69], ['Z', 3, 10]], 'a narrower window: X counted from its last tally before it');
    assert.deepEqual((await s.staff('/v1/staff/census/jumps', { kind: 'marks' }, s.mob.session)).body, { error: 'census-no-tally' });
    assert.equal(s.audits('census-jumps-read').length, 2);
  } finally { s.done(); }
});

const withId = (uid, t = 113, m = 1) => ({ templateIndex: t, material: m, rarity: 'rare', uid });

test('STAFF-PANEL4-CENSUS: CONTESTED PIECES - a claim its holder outlasted keeps its first holder and its claimant with their times and its print; a piece twice in one record its own; the list most urgent first, paged; a trail check recorded and shown (mutants: each holder field; the drop listed; the level rules; the trail\'s refusals)', async () => {
  const s = await stand();
  try {
    const A = await s.seat('Ann');
    const C = await s.seat('Cai');
    const B = await s.seat('Bea');
    const u = '3333333333333333', u2 = '4444444444444444';
    await s.put(A, freshSave({ name: 'Ann', items: [withId(u)] }));
    const heldAt = s.now();
    s.wait(10);
    await s.put(C, freshSave({ name: 'Cai', items: [withId(u)] }));
    const claimAt = s.now();
    s.wait(DUPE_GRACE_S + 1);
    await s.put(A, freshSave({ name: 'Ann', items: [withId(u)] }));
    const foundAt = s.now();
    s.wait(5);
    await s.put(B, freshSave({ name: 'Bea', items: [withId(u2, 120, 2), withId(u2, 120, 2)] }));
    const row = (uid, c) => ({ ...s.raw.prepare('SELECT first_char, first_at, claimant, claim_at, fp, kind, at FROM item_dupes WHERE uid = ? AND char_id = ?').get(uid, c) });
    assert.deepEqual(row(u, C.id), { first_char: A.id, first_at: heldAt, claimant: C.id, claim_at: claimAt, fp: '113:1', kind: 'claim', at: foundAt });
    assert.deepEqual(row(u2, B.id), { first_char: B.id, first_at: s.now(), claimant: B.id, claim_at: s.now(), fp: '120:2', kind: 'twice', at: s.now() });
    // a death's drop is the ledger's bookkeeping: never listed
    await s.env.DB.batch(knownCopySteps(s.env.DB, A.id, ['5555555555555555'], s.now()));
    assert.equal(row('5555555555555555', A.id).kind, 'drop');
    const list = await s.staff('/v1/staff/contested', {}, s.mob.session);
    assert.equal(list.status, 200, JSON.stringify(list.body));
    assert.equal(list.body.next, null);
    const mine = list.body.pieces.find((p) => p.uid === u);
    assert.deepEqual(mine, {
      uid: u, item: { t: 113, m: 1, name: lawTemplate(113).name }, kind: 'claim', foundAt, level: 'medium', why: ['no trail check'],
      copy: { char: C.id, name: 'Cai', player: C.who.id, handle: 'Cai', at: null },
      first: { char: A.id, name: 'Ann', player: A.who.id, handle: 'Ann', at: heldAt },
      claimant: { char: C.id, name: 'Cai', player: C.who.id, handle: 'Cai', at: claimAt },
      trail: null, now: { state: 'held', char: A.id },
    });
    assert.deepEqual(list.body.pieces.map((p) => p.uid), [u2, u], 'newest first among the unchecked');
    // the trail check: what staff found, and why - refused without a word that says
    const bad = [{ found: 'guilty', note: 'x' }, { found: 'copier', note: ' ' }, { found: 'copier', note: 'x'.repeat(TRAIL_NOTE_MAX + 1) }, { found: 'copier', note: 'x', uid: 'nope' }, { found: 'copier', note: 'x', char: 'nope' }];
    for (const b of bad) assert.equal((await s.staff('/v1/staff/contested/trail', { uid: u, char: C.id, ...b }, s.mob.session)).status, 400, JSON.stringify(b));
    assert.deepEqual(await s.staff('/v1/staff/contested/trail', { uid: u, char: A.id, found: 'copier', note: 'no such copy' }, s.mob.session), { status: 404, body: { error: 'no-piece' } });
    const t = await s.staff('/v1/staff/contested/trail', { uid: u, char: C.id, found: 'innocent', note: '  bought it off Ann for 900 gold, the trade log shows it  ' }, s.mob.session);
    assert.equal(t.status, 200, JSON.stringify(t.body));
    assert.deepEqual(t.body.trail, { at: s.now(), by: s.raw.prepare("SELECT id FROM players WHERE handle = 'SirMcMobdon'").get().id, byName: 'SirMcMobdon', found: 'innocent', note: 'bought it off Ann for 900 gold, the trade log shows it' });
    assert.deepEqual(s.audits('contested-trail').map((a) => [a.target, JSON.parse(a.detail).found ?? null, a.outcome]), [[null, 'copier', 'failed'], [C.who.id, 'innocent', 'ok']]);
    const after = await s.staff('/v1/staff/contested', {}, s.mob.session);
    assert.deepEqual(after.body.pieces.map((p) => [p.uid, p.level]), [[u2, 'medium'], [u, 'low']], 'checked sorts last');
    assert.deepEqual(after.body.pieces[1].trail.found, 'innocent');
    assert.deepEqual(after.body.pieces[1].why, ['trail checked: innocent']);
    assert.deepEqual((await s.staff('/v1/staff/contested', { open: true }, s.mob.session)).body.pieces.map((p) => p.uid), [u2]);
    assert.deepEqual((await s.staff('/v1/staff/contested', { char: C.id }, s.mob.session)).body.pieces.map((p) => p.uid), [u]);
    assert.deepEqual((await s.staff('/v1/staff/contested', { sort: 'newest' }, s.mob.session)).body.pieces.map((p) => p.uid), [u2, u]);
    assert.equal((await s.staff('/v1/staff/contested', { char: 'x' }, s.mob.session)).status, 400);
    for (const before of ['nope', 7, '3|1|a|b', '0|x|a|b']) assert.equal((await s.staff('/v1/staff/contested', { before }, s.mob.session)).status, 400, `a place that is none: ${before}`);
    const one = await s.staff('/v1/staff/contested', { before: `1|${s.now() + 1}|ffffffffffffffff|r`, sort: 'urgent' }, s.mob.session);
    assert.deepEqual(one.body.pieces.map((p) => p.uid), [u2, u], 'from a place: the rows behind it');
    // one piece's trail: its copies, the ledger now, the findings naming it
    const tr = await s.staff('/v1/staff/contested/piece', { uid: u }, s.mob.session);
    assert.equal(tr.status, 200, JSON.stringify(tr.body));
    assert.deepEqual(tr.body.ledger, { state: 'held', char: A.id, name: 'Ann', player: A.who.id, handle: 'Ann', at: heldAt, claim: null });
    assert.deepEqual(tr.body.copies.map((c) => c.copy.char), [C.id]);
    assert.deepEqual(tr.body.findings, [{ char: C.id, at: foundAt, contested: true, count: 1 }]);
    assert.equal(tr.body.craft, null);
    assert.deepEqual(await s.staff('/v1/staff/contested/piece', { uid: '9999999999999999' }, s.mob.session), { status: 404, body: { error: 'no-piece' } });
    assert.ok(s.audits('contested-read').length >= 1 && s.audits('contested-piece-read').length === 1);
  } finally { s.done(); }
});

test('STAFF-PANEL4-CENSUS: a character holding CONTESTED_HIGH unchecked pieces is high, first, and the Home roll-up says so; the escrow\'s and the craft\'s copies keep who held them (mutants: the high count; escrow\'s print; the craft\'s claimant)', async () => {
  const s = await stand();
  try {
    const syl = await s.registered('Sylvia');
    const troll = await s.registered('Troll');
    const many = s.lay(syl.id, { name: 'Many' });
    const one = s.lay(troll.id, { name: 'One' });
    const dupe = (uid, c, at) => s.raw.prepare("INSERT INTO item_dupes (uid, char_id, at, kind, fp) VALUES (?, ?, ?, 'claim', '113:1')").run(uid, c, at);
    dupe('a000000000000001', one, s.now());
    for (let i = 0; i < CONTESTED_HIGH; i++) dupe(`b00000000000000${i}`, many, s.now() - 100 - i);
    const list = await s.staff('/v1/staff/contested', {}, s.mob.session);
    assert.deepEqual(list.body.pieces.map((p) => [p.copy.char, p.level]), [[many, 'high'], [many, 'high'], [many, 'high'], [one, 'medium']]);
    assert.match(list.body.pieces[0].why.join(' · '), new RegExp(`${CONTESTED_HIGH} contested pieces on this character`));
    const home = await HOME_WATCH.top({ db: s.env.DB, nowS: s.now() }, s.env, null, 3);
    assert.deepEqual([home.high, home.total, home.items.length], [CONTESTED_HIGH, CONTESTED_HIGH + 1, 3]);
    // kept a few minutes (design doc, Server load: "cache them for 5-10 minutes"): a trail check is in Home's counts once
    // the answer is kept no longer, never by reading it again
    assert.ok(CONTESTED_HOME_KEEP_S >= 5 * 60 && CONTESTED_HOME_KEEP_S <= 10 * 60, 'kept 5 to 10 minutes');
    await s.staff('/v1/staff/contested/trail', { uid: 'a000000000000001', char: one, found: 'innocent', note: 'traded' }, s.mob.session);
    s.wait(CONTESTED_HOME_KEEP_S - 1);
    assert.deepEqual(await HOME_WATCH.top({ db: s.env.DB, nowS: s.now() }, s.env, null, 3), home, 'kept');
    s.wait(1);
    const later = await HOME_WATCH.top({ db: s.env.DB, nowS: s.now() }, s.env, null, 3);
    assert.deepEqual([later.high, later.total], [CONTESTED_HIGH, CONTESTED_HIGH]);
    assert.deepEqual(home.items[0], { level: 'high', why: `${lawTemplate(113).name} · no trail check · ${CONTESTED_HIGH} contested pieces on this character`, sub: syl.id, name: 'Sylvia' });
    assert.equal(HOME_WATCH.role, 'admin');
    // a piece the service sold on from escrow: the claimant's copy, held first by no record, its times and print off the ledger's row
    const e = 'e000000000000001';
    s.raw.prepare("INSERT INTO item_uids (uid, player, char_id, seen_seq, state, fp, claim_char, claim_at, at) VALUES (?, ?, '', 1, 'escrow', '120:3', ?, 222, 111)").run(e, syl.id, one);
    await s.env.DB.batch(escrowSpentSteps(s.env.DB, e, one, s.now()));
    assert.deepEqual({ ...s.raw.prepare('SELECT first_char, first_at, claimant, claim_at, fp, kind FROM item_dupes WHERE uid = ?').get(e) },
      { first_char: null, first_at: 111, claimant: one, claim_at: 222, fp: '120:3', kind: 'escrow' });
    // a crafted piece the craft's record gives the claimant: the first holder's copy, the claimant named
    const k = 'c000000000000001';
    s.raw.prepare("INSERT INTO products (provenance, owner, char_id, recipe, template, material, quality, seed, record, made_at) VALUES (?, ?, ?, 'r', 120, 3, 1, 1, '{}', 1)").run(k, troll.id, one);
    s.raw.prepare("INSERT INTO item_uids (uid, player, char_id, seen_seq, state, fp, claim_char, claim_at, at) VALUES (?, ?, ?, 1, 'held', '120:3', ?, ?, 50)").run(k, syl.id, many, one, s.now() - DUPE_GRACE_S - 5);
    const step = await ledgerStep(s.env.DB, { player: syl.id, char: many, seq: 2, nowS: s.now() }, [{ key: k, fp: '120:3' }]);
    await s.env.DB.batch(step.steps);
    assert.deepEqual({ ...s.raw.prepare('SELECT char_id, first_char, first_at, claimant, claim_at, kind FROM item_dupes WHERE uid = ?').get(k) },
      { char_id: many, first_char: many, first_at: 50, claimant: one, claim_at: s.now() - DUPE_GRACE_S - 5, kind: 'craft' });
  } finally { s.done(); }
});

/** The statements a read asks, each with its plan on the migrated schema (the planner the repo's own pins check). */
function planned(db) {
  const asked = [];
  const rec = new Proxy(db, { get(target, k) { if (k === 'prepare') return (sql) => { asked.push(sql); return target.prepare(sql); }; const v = target[k]; return typeof v === 'function' ? v.bind(target) : v; } });
  const plans = () => asked.splice(0).map((sql) => [sql, db._raw.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map((r) => r.detail).join(' | ')]);
  return { rec, plans };
}

test('STAFF-PANEL4-CENSUS: THE JUMPS, THE CONTESTED LIST AND HOME STAND ON INDEXES - the jumps on the hours\' index, never the whole of realm_wealth_hours; the list and Home on the listed rows\' own (0154), never a walk of item_dupes, whose drops are in none of them (mutants: the jumps grouped on the bare column; an index lost; the drops indexed)', async () => {
  const db = d1();
  const { rec, plans } = planned(db);
  const nowS = 1_800_000_000;
  const who = { player: { id: 'p' }, role: 'admin' };
  const audit = () => ({ run: async () => ({}) });
  _forgetCensusForTests();
  await staffCensus({ db: rec, nowS }, {}, '/v1/staff/census/jumps', { kind: 't113' }, who, audit);
  const jumps = plans();
  assert.equal(jumps.length, 1);
  assert.match(jumps[0][1], /^SEARCH h USING INDEX realm_wealth_hours_hour \(hour>\?\)/, jumps[0][1]);
  assert.doesNotMatch(jumps[0][1], /\bSCAN (h|x|f)\b/, 'no hour row walked whole');
  const place = { at: nowS, uid: 'ffffffffffffffff', char: 'r'.padEnd(21, 'f') };
  for (const o of [{ sort: 'newest' }, { sort: 'newest', open: true }, { sort: 'urgent' }, { sort: 'urgent', open: true }, { sort: 'urgent', before: { tier: 1, ...place } },
    { sort: 'urgent', before: { tier: 2, ...place } }, { sort: 'newest', before: { tier: 0, ...place } }, { sort: 'urgent', char: place.char }]) await contestedPage(rec, o);
  await HOME_WATCH.top({ db: rec, nowS }, {}, who, 3);
  const listed = plans();
  for (const [sql, plan] of listed) {
    for (const m of plan.matchAll(/\bSCAN (\w+)( USING (COVERING )?INDEX (\w+))?/g)) {
      assert.ok(['item_dupes_at', 'item_dupes_open', 'item_dupes_open_at'].includes(m[4]), `${m[0]} - item_dupes walked: ${plan}\n${sql}`);
    }
    // walked in the list's order - sorted only where the walk is a character's own rows (one character's; the high's few)
    if (!/^SEARCH d USING INDEX \w+ \(char_id=\?/.test(plan)) assert.doesNotMatch(plan, /TEMP B-TREE/, `a page sorted whole: ${plan}`);
  }
  const all = listed.map((p) => p[1]).join('\n');
  for (const ix of ['item_dupes_at', 'item_dupes_open', 'item_dupes_open_at']) {
    assert.match(all, new RegExp(`\\b${ix}\\b`), `${ix} unused`);
    assert.match(String(db._raw.prepare('SELECT sql FROM sqlite_master WHERE name = ?').get(ix).sql), /WHERE .*kind IS NULL OR kind != 'drop'\)?$/, `${ix}: a drop is in none`);
  }
  assert.match(all, /SCAN item_dupes USING COVERING INDEX item_dupes_open/, 'Home\'s counts read the index alone');
});

test('STAFF-PANEL4-CENSUS: THE CONTESTED LIST PAGES BY ITS PLACE, NEVER AN OFFSET - trail checks between pages skip nothing, in either sort, open or not; a tie at a page\'s edge is neither lost nor shown twice; the drops never listed (mutants: the place\'s tier lost; the place dropped; the place one past)', async () => {
  const db = d1();
  const raw = db._raw;
  const chars = Array.from({ length: 9 }, (_, i) => `r${String(i).padStart(20, '0')}`);
  const uid = (i) => i.toString(16).padStart(16, '0');
  // 40 pieces, four at each time (a tie at every page's edge): three characters hold nine or ten (high), six hold two
  // each; drops between
  const lay = () => {
    raw.prepare('DELETE FROM item_dupes').run();
    for (let i = 0; i < 40; i++) raw.prepare("INSERT INTO item_dupes (uid, char_id, at, kind) VALUES (?, ?, ?, 'claim')").run(uid(i), chars[i < 28 ? i % 3 : 3 + (i % 6)], 1000 + Math.floor(i / 4));
    for (let i = 0; i < 30; i++) raw.prepare("INSERT INTO item_dupes (uid, char_id, at, kind) VALUES (?, ?, ?, 'drop')").run(uid(100 + i), chars[i % 9], 1000 + (i % 10));
    raw.prepare("UPDATE item_dupes SET trail_at = 5, trail_found = 'innocent' WHERE uid IN (?, ?)").run(uid(7), uid(33));   // checked before the list opened
  };
  const P = 8;
  for (const sort of ['urgent', 'newest']) {
    for (const open of [false, true]) {
      lay();
      const want = raw.prepare(`SELECT uid FROM item_dupes WHERE kind = 'claim' ${open ? 'AND trail_at IS NULL' : ''}`).all().map((r) => r.uid);
      const seen = [];
      let before = null;
      let checked = 0;
      for (let n = 0; n < 20; n++) {
        const page = await contestedPage(db, { sort, open, page: P, before });
        assert.ok(page.pieces.length <= P);
        seen.push(...page.pieces.map((p) => p.uid));
        // staff check the first three of each page's trail before the next - the list's own workflow
        for (const p of page.pieces.slice(0, 3)) { raw.prepare("UPDATE item_dupes SET trail_at = 9, trail_found = 'copier' WHERE uid = ? AND char_id = ?").run(p.uid, p.copy.char); checked++; }
        if (!page.next) break;
        const [tier, at, u, c] = page.next.split('|');
        before = { tier: Number(tier), at: Number(at), uid: u, char: c };
      }
      assert.ok(checked > 3, 'more than one page');
      const missed = want.filter((u) => !seen.includes(u));
      assert.deepEqual(missed, [], `${sort}${open ? ' open' : ''}: every piece shown`);
      assert.ok(seen.every((u) => want.includes(u)), 'nothing but the listed');
      if (sort === 'newest' && !open) assert.equal(new Set(seen).size, seen.length, 'newest, all: each once');
      if (open) assert.ok(!seen.includes(uid(7)) && !seen.includes(uid(33)), 'open: the checked are not');
    }
  }
  // urgent: the high first, then the rest unchecked, then the checked - each newest first
  lay();
  const all = [];
  let before = null;
  for (let n = 0; n < 20; n++) {
    const page = await contestedPage(db, { sort: 'urgent', page: P, before });
    all.push(...page.pieces);
    if (!page.next) break;
    const [tier, at, u, c] = page.next.split('|');
    before = { tier: Number(tier), at: Number(at), uid: u, char: c };
  }
  assert.deepEqual([all.length, new Set(all.map((p) => p.uid)).size], [40, 40], 'a still list: each piece once');
  const rank = (p) => (p.trail ? 2 : p.level === 'high' ? 0 : 1);
  assert.deepEqual(all.map(rank), [...all.map(rank)].sort((a, b) => a - b), 'tiers in order');
  assert.ok(all.some((p) => rank(p) === 0) && all.some((p) => rank(p) === 1) && all.some((p) => rank(p) === 2));
  for (let i = 1; i < all.length; i++) if (rank(all[i]) === rank(all[i - 1])) assert.ok(all[i].foundAt <= all[i - 1].foundAt, 'newest first within a tier');
});

test('STAFF-PANEL4-CENSUS: THE BACKFILL RETRIES A RECORD R2 FAILED TO READ - the firing stops just before its character, what it filled is kept, the job is written down failed, and the next firing reads it; only a record R2 has not is passed for good (mutants: the failure taken for no record; the place past it; done though it failed; the failure unsaid)', async () => {
  const s = await stand();
  try {
    const seated = [];
    for (const h of ['Fay', 'Gil', 'Hal', 'Ivo']) seated.push(await s.seat(h));
    const ids = seated.map((c) => c.id).sort();
    for (const c of seated) layRecord(s.env, c.id, freshSave({ name: 'X', items: [piece(71, { stackCount: 2 })] }));
    s.raw.prepare(`DELETE FROM item_census WHERE char_id IN (${ids.map(() => '?').join(', ')})`).run(...ids);
    const objOf = (id) => s.raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(id).obj;
    const [, failing, , absent] = ids;
    let down = true;
    const gets = [];
    const SAVES = { get: async (k) => { gets.push(k); if (k === objOf(failing) && down) throw new Error('R2 503'); if (k === objOf(absent)) return null; return s.env.SAVES.get(k); } };
    const env = { ...s.env, CENSUS_BACKFILL: 'on', SAVES };
    const quiet = utcDay(s.now()) * 86400 + CENSUS_QUIET_HOURS[0] * 3600;
    const place = () => JSON.parse(s.raw.prepare("SELECT value FROM realm_config WHERE key = 'census-backfill'").get().value);
    const ran = await runCron(env, { cron: CRON_HOUR, nowS: quiet, jobs: HOUR_JOBS.filter(([name]) => name === 'census-backfill') });
    assert.deepEqual(ran.map((r) => r.ok), [false], 'written down failed');
    assert.equal(s.census(ids[0])?.tally, '{"g":100,"t71":2}', 'what it filled before is kept');
    assert.equal(s.census(failing), null);
    assert.deepEqual(place(), { after: ids[0], done: false }, 'its place just before the one that failed');
    assert.deepEqual(gets, [objOf(ids[0]), objOf(failing)], 'and the firing stopped there');
    down = false;
    const again = await runCron(env, { cron: CRON_HOUR, nowS: quiet + 3600, jobs: HOUR_JOBS.filter(([name]) => name === 'census-backfill') });
    assert.deepEqual(again.map((r) => [r.ok, r.changed]), [[true, 2]], 'the next firing reads it, and goes on');
    assert.equal(s.census(failing).tally, '{"g":100,"t71":2}');
    assert.equal(s.census(ids[2]).tally, '{"g":100,"t71":2}');
    assert.equal(s.census(absent), null, 'no record: nothing to tally');
    assert.equal(place().done, true, 'done - the record R2 has not is passed for good');
  } finally { s.done(); }
});
