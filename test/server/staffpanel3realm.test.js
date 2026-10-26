// STAFF-PANEL3-REALM (2026-10-22, design doc "DFO Staff Panel: design", build step 3) - THE PANEL'S TRADE HOLDS, ROLLBACKS,
// FIXES, GAINS AND REMOVALS (server-account/src/staffRealm.js), driven through the real Worker on the node:sqlite database
// every account pin stands on (test/accountDb.mjs) with R2 beside it (test/realmSeat.mjs): the held characters most
// urgent first with why, a hold laid on one character or a whole account and lifted (saying it excused the finding and
// refilled the allowance), Roll back with what it will not undo and the staff hold kept through it, Fix account with its
// note, wealth past the allowance with gold apart from goods and XP from the progression's hours, a buy and a bid refused
// for a held or banned seller, Pull and Remove from market, Remove from a player on its own path (a copy too, its trail
// checked), the piece's ledger row taken so a save showing it again holds a copy, Put back, and the 30-day sweep.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { seatRealm, freshSave, recordOf, realmJoinAt } from '../realmSeat.mjs';
import { staffWords, STAFF_SESSION_HEADER } from '../../server-account/src/staff.js';
import {
  REALM_ROUTES, REALM_PAGE, EVIDENCE_KEEP_S, GAINS_KEEP_MS, HOME_WATCH, holdUrgency, takeOut, gainsRanked,
} from '../../server-account/src/staffRealm.js';
import { STAFF_ROUTES } from '../../server-account/src/service.js';
import { runCron, CRON_HOUR, HOUR_JOBS } from '../../server-account/src/cron.js';
import { BUDGET_DEFAULT } from '../../server-account/src/budget.js';
import { PROGRESS_LINE } from '../../server-account/src/progress.js';
import { SEIZED } from '../../server-account/src/ledger.js';
import { goodsOf, wealthOf } from '../../server-account/src/judge.js';
import { itemWorth } from '../../src/systems/item/itemLaw.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { applyRarity } from '../../src/systems/loot/lootRarity.js';
import { roadPixels } from '../../src/net/marketLaw.js';
import { seeded } from '../honestItems.mjs';
import worker from '../../server-account/src/index.js';

const { subtle } = globalThis.crypto;
const enc = new TextEncoder();
const nowS = () => Math.floor(Date.now() / 1000);
const PASSWORD = 'a good long one';
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
const DF = 17, WR = 23;
const HUBS = { [DF]: [207, 212], [WR]: [590, 166] };
void roadPixels;
let _rid = 0;
const rid = () => `sp3r-${String(++_rid).padStart(6, '0')}`;
/** A Rare dagger with its ledger id (systems/item/itemIds.js: a valuable piece's key). */
const piece = (uid, seed = 11) => ({ ...applyRarity(createWeapon(113, 1, seeded(7)), 'rare', seeded(seed)), uid });

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

/** The Worker with the panel set up: mob (an Admin) signed in, Asynian (a Moderator) invited and signed in; the market,
 *  the professions and the Marks open; realm characters seated through the service. */
async function stand() {
  const mobKey = await extensionKey();
  const s = await standService({
    DEVELOPER_HANDLES: 'Lattymoy,SirMcMobdon', MODERATOR_HANDLES: 'Asynian', OWNER_HANDLES: 'Lattymoy,SirMcMobdon', OWNER_KEYS: `SirMcMobdon:${mobKey.pub}`,
    PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on',
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
  const asyKey = await extensionKey();
  const asy = (await staff('/v1/staff/enroll', { handle: 'Asynian', password: PASSWORD, invite: inv.body.invite, ...(await asyKey.proof('enroll', 'Asynian')) })).body;
  const admin = (path, body = {}) => staff(path, body, mob.session);
  /** A checkpoint under the character's lease, one on. */
  const put = async (who, id, save, { seq = null, lease = null } = {}) => {
    const row = raw.prepare('SELECT lease, seq FROM realm_characters WHERE id = ?').get(id);
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${id}/data`, {
      method: 'PUT', headers: { authorization: `Bearer ${who.secret}`, 'x-realm-lease': lease ?? row.lease ?? '0'.repeat(32), 'x-realm-seq': String(seq ?? row.seq + 1) }, body: JSON.stringify(save),
    }), s.env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  /** A registered account seated as a realm character, `save` checkpointed over its first. */
  const seat = async (handle, save = null) => {
    const who = await s.registered(handle);
    const R = await seatRealm(s.env, who.secret, handle);
    if (save) assert.equal((await put(who, R.id, save)).status, 200, `${handle}'s save lands`);
    return { who, id: R.id };
  };
  const row = (id) => ({ ...raw.prepare('SELECT * FROM realm_characters WHERE id = ?').get(id) });
  const staffFindings = (id) => raw.prepare("SELECT detail FROM realm_findings WHERE char_id = ? AND kind = 'staff' ORDER BY id").all(id).map((r) => JSON.parse(r.detail));
  const audits = (act) => raw.prepare('SELECT act, target, detail, outcome FROM staff_audit WHERE act = ? ORDER BY id').all(act).map((r) => ({ ...r, detail: r.detail ? JSON.parse(r.detail) : null }));
  return { ...s, raw, staff, admin, mob, asy, put, seat, row, staffFindings, audits };
}

test('STAFF-PANEL3-REALM: every door is listed among the staff panel\'s, none opens without a staff session, and each is an Admin\'s - a Moderator refused and written down (mutant: the role check dropped)', async () => {
  for (const r of REALM_ROUTES) assert.ok(STAFF_ROUTES.has(r), r);
  const s = await stand();
  for (const r of REALM_ROUTES) {
    assert.deepEqual(await s.staff(r, {}), { status: 401, body: { error: 'staff-session' } }, r);
    assert.deepEqual(await s.staff(r, { id: 'r00000000000000000000' }, s.asy.session), { status: 403, body: { error: 'staff-admin' } }, `${r}: a Moderator`);
  }
  const refused = s.audits('refused');
  assert.equal(refused.length, REALM_ROUTES.length);
  assert.ok(refused.every((a) => a.outcome === 'denied' && a.detail.need === 'admin'));
});

test('STAFF-PANEL3-REALM: TRADE HOLDS - every held or flagged character with why, since and until, most urgent first (wealth past the allowance and copies over the law\'s hold over staff\'s own), or newest first; paged; the read written once (mutants: each level; the sort)', async () => {
  const s = await stand();
  const law = await s.seat('Lawless');
  assert.equal((await s.put(law.who, law.id, freshSave({ name: 'Lawless', items: [{ ...createWeapon(113, 1, seeded(7)), group: 'Gems' }] }))).body.tradeHeld, 'law');
  s.raw.prepare('UPDATE realm_characters SET held_at = ? WHERE id = ?').run(nowS() - 10, law.id);
  const mine = await s.seat('Watched');
  assert.equal((await s.admin('/v1/staff/trade-hold', { id: mine.id, note: 'watching him' })).status, 200);
  const rich = await s.seat('Rich');
  s.raw.prepare("UPDATE realm_characters SET held = 'budget', held_at = ?, wealth = 9000000, allowance = -50 WHERE id = ?").run(nowS() - 50, rich.id);
  const copier = await s.seat('Copier');
  s.raw.prepare("UPDATE realm_characters SET held = 'staff', held_at = ?, dupes = 2 WHERE id = ?").run(nowS() - 40, copier.id);
  const flagged = await s.seat('Flagged');
  s.raw.prepare("UPDATE realm_characters SET review = 'outlier' WHERE id = ?").run(flagged.id);
  // FLAW REVIEW: a later staff act's note - a mend, a take - is not the hold's: the hold's own note (or none) is said
  const act = (id, detail) => s.raw.prepare("INSERT INTO realm_findings (player, char_id, seq, at, law, kind, detail) VALUES (?, ?, 1, ?, 0, 'staff', ?)").run(s.row(id).player, id, nowS(), JSON.stringify(detail));
  act(copier.id, { act: 'mend', by: 'SirMcMobdon', note: 'ticket 42' });
  act(mine.id, { act: 'take', by: 'SirMcMobdon', note: 'duped sword' });
  const r = await s.admin('/v1/staff/trade-holds');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const names = r.body.characters.map((c) => [c.name, c.level]);
  assert.deepEqual(names, [['Copier', 'high'], ['Rich', 'high'], ['Lawless', 'medium'], ['Watched', 'low'], ['Flagged', 'low']]);
  const by = Object.fromEntries(r.body.characters.map((c) => [c.name, c]));
  assert.match(by.Lawless.why.join(' · '), /^judge finding: \w/);
  assert.equal(by.Lawless.finding.kind, 'law');
  assert.deepEqual(by.Rich.why, ['wealth 9000000 against allowance -50']);
  assert.deepEqual(by.Copier.why, ['staff hold, no note', '2 copies found']);
  assert.deepEqual(by.Watched.why, ['staff note: watching him']);
  assert.deepEqual([by.Watched.staffNote.note, by.Watched.staffNote.by, by.Watched.held], ['watching him', 'SirMcMobdon', 'staff']);
  assert.ok(by.Watched.since > 0 && by.Watched.until === null && by.Watched.playing === true);
  assert.deepEqual([by.Flagged.held, by.Flagged.review, by.Flagged.why], [null, 'outlier', ['wealth far past its level when first judged']]);
  const newest = (await s.admin('/v1/staff/trade-holds', { sort: 'newest' })).body.characters.map((c) => c.name);
  assert.deepEqual(newest.slice(0, 3), ['Watched', 'Lawless', 'Copier'].sort((a, b) => by[b].since - by[a].since));
  // paged: the panel's infinite scroll
  const owner = s.raw.prepare('SELECT player FROM realm_characters WHERE id = ?').get(law.id).player;
  for (let i = 0; i < REALM_PAGE; i++) {
    s.raw.prepare("INSERT INTO realm_characters (id, player, name, seq, bytes, created_at, updated_at, held, held_at) VALUES (?, ?, ?, 0, 0, 1, 1, 'staff', 1)")
      .run(`r${String(i).padStart(20, 'a')}`, owner, `Extra ${i}`);
  }
  const p1 = (await s.admin('/v1/staff/trade-holds')).body;
  assert.deepEqual([p1.characters.length, p1.next, p1.total], [REALM_PAGE, REALM_PAGE, REALM_PAGE + 5]);
  const p2 = (await s.admin('/v1/staff/trade-holds', { from: p1.next })).body;
  assert.deepEqual([p2.characters.length, p2.next], [5, null]);
  assert.equal(s.audits('trade-holds-read').length, 2, 'once in ten minutes a view (urgent, newest)');
});

test('STAFF-PANEL3-REALM: holdUrgency - the levels and words, pure (mutants: budget, copies, law, staff)', () => {
  assert.equal(holdUrgency({ held: 'budget', wealth: 5, allowance: 1 }).level, 'high');
  assert.equal(holdUrgency({ held: 'law', dupes: 1 }).level, 'high');
  assert.equal(holdUrgency({ held: 'law', finding: { kind: 'law', detail: { findings: [{ code: 'gold' }, { code: 'gold' }, { code: 'level' }] } } }).level, 'medium');
  assert.deepEqual(holdUrgency({ held: 'law', finding: { kind: 'law', detail: { findings: [{ code: 'gold' }, { code: 'gold' }, { code: 'level' }] } } }).why, ['judge finding: gold, level']);
  assert.deepEqual(holdUrgency({ held: 'staff', staff: { note: 'n' }, strikes: 1, law_holds: 2 }), { level: 'low', why: ['staff note: n', '1 strike', '2 law holds served'] });
  assert.equal(holdUrgency({ review: 'outlier' }).level, 'low');
});

test('STAFF-PANEL3-REALM: HOLD one character or every one of an account, and UNHOLD - which says it also excused the judge\'s finding and refilled the allowance; each written with its outcome (mutants: the account hold; the answer\'s words; the failed audit)', async () => {
  const s = await stand();
  const a = await s.seat('Holdme');
  assert.deepEqual((await s.admin('/v1/staff/trade-hold', { id: a.id, note: '  dupe ring  ' })).body, { ok: true, held: [{ id: a.id, name: 'Holdme' }] });
  assert.deepEqual([s.row(a.id).held, s.staffFindings(a.id).at(-1)], ['staff', { act: 'hold', by: 'SirMcMobdon', note: 'dupe ring' }]);
  // every living character of the account - the dead are past holding
  const who = s.raw.prepare('SELECT player FROM realm_characters WHERE id = ?').get(a.id).player;
  const secret = (await s.registered('Second')).secret;
  void secret;
  const two = await seatRealm(s.env, (await s.call('/v1/auth/login', { handle: 'Holdme', password: PASSWORD })).body.secret, 'Holdme Two');
  const three = await seatRealm(s.env, (await s.call('/v1/auth/login', { handle: 'Holdme', password: PASSWORD })).body.secret, 'Holdme Three');
  s.raw.prepare('UPDATE realm_characters SET dead_at = 1 WHERE id = ?').run(three.id);
  s.raw.prepare('UPDATE realm_characters SET held = NULL WHERE id = ?').run(a.id);
  const all = await s.admin('/v1/staff/trade-hold', { target: who, note: 'the whole account' });
  assert.deepEqual(all.body.held.map((h) => h.id).sort(), [a.id, two.id].sort());
  assert.deepEqual([s.row(a.id).held, s.row(two.id).held, s.row(three.id).held], ['staff', 'staff', null]);
  assert.deepEqual(s.audits('trade-hold').at(-1).detail, { all: true, chars: [a.id, two.id], note: 'the whole account' });
  // unhold a law hold: the finding excused, the allowance refilled, the strikes gone - and the answer says so
  const l = await s.seat('Lawman');
  await s.put(l.who, l.id, freshSave({ name: 'Lawman', items: [{ ...createWeapon(113, 1, seeded(7)), group: 'Gems' }] }));
  const sig = s.row(l.id).law_sig;
  assert.ok(sig);
  const un = await s.admin('/v1/staff/trade-unhold', { id: l.id, note: 'the law misread it' });
  assert.deepEqual(un.body, { ok: true, lifted: 'law', excused: sig, allowanceRefilled: true, strikesCleared: 1, lawHoldsCleared: 0 });
  assert.deepEqual([s.row(l.id).held, s.row(l.id).law_excused, s.row(l.id).allowance], [null, sig, null]);
  assert.deepEqual(s.audits('trade-unhold').map((x) => [x.outcome, x.detail.was]), [['ok', 'law']]);
  assert.deepEqual(await s.admin('/v1/staff/trade-unhold', { id: 'r00000000000000000000' }), { status: 404, body: { error: 'no-realm-character' } });
  assert.deepEqual(await s.admin('/v1/staff/trade-hold', { name: 'Nobody At All' }), { status: 404, body: { error: 'no-player' } });
  // FLAW REVIEW: an account the lookup cannot name is a failed hold, written down
  assert.deepEqual(s.audits('trade-hold').at(-1), { act: 'trade-hold', target: null, detail: { all: true, asked: 'Nobody At All', note: null, error: 'no-player' }, outcome: 'failed' });
});

test('STAFF-PANEL3-REALM: ROLL BACK - previewed with what it will not undo (the Stores, the Drakes, the market purse), the staff hold kept through it, refused while a removal from that character is kept (mutants: confirm; the kept removal; staff hold lifted; each of what it leaves)', async () => {
  const s = await stand();
  const c = await s.seat('Roller', freshSave({ name: 'Roller', goldPieces: 400 }));
  const cleanKey = s.row(c.id).clean_obj;
  const uploaded = new Date(1_000_000_000 * 1000);
  const get = s.env.SAVES.get.bind(s.env.SAVES);
  s.env.SAVES.get = async (k) => { const o = await get(k); return o && k === cleanKey ? { ...o, uploaded } : o; };
  for (let i = 0; i < 2; i++) await s.put(c.who, c.id, freshSave({ name: 'Roller', goldPieces: 400, items: [{ ...createWeapon(113, 1, seeded(7)), group: 'Gems' }] }));
  await s.admin('/v1/staff/trade-hold', { id: c.id, note: 'before the rollback' });
  const player = s.row(c.id).player;
  s.raw.prepare("INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, 'ore:iron', 'own', 30), (?, ?, 'ore:mithril', 'own', 5)").run(player, c.id, player, c.id);
  s.raw.prepare("INSERT INTO prof_deposits (player, rid, char_id, material, qty, at, n) VALUES (?, 'd1', ?, 'ore:iron', 12, ?, 'n1'), (?, 'd0', ?, 'ore:iron', 99, ?, 'n0')")
    .run(player, c.id, 1_000_000_100, player, c.id, 999_999_000);
  s.raw.prepare('INSERT INTO marks (account, balance) VALUES (?, 77)').run(player);
  s.raw.prepare('INSERT INTO market_gold (player, char_id, gold) VALUES (?, ?, 1234)').run(player, c.id);
  const pre = await s.admin('/v1/staff/rollback', { id: c.id });
  assert.equal(pre.status, 200, JSON.stringify(pre.body));
  assert.deepEqual({ ...pre.body, character: undefined }, {
    character: undefined, from: 4, to: 2, cleanAt: 1_000_000_000, blocked: null, removalKept: null, playing: true, held: 'staff', keepsStaffHold: true,
    wealth: { now: s.row(c.id).wealth, then: 400 },
    notUndone: { stores: { units: 35, materials: 2, sinceClean: { units: 12, deposits: 1 } }, drakes: 77, marketPurse: 1234 },
  });
  assert.equal(s.row(c.id).seq, 4, 'a preview moves nothing');
  // a removal kept from this character: roll back first, then remove
  s.raw.prepare(`INSERT INTO staff_evidence (id, kind, player, char_id, reason, note, by_id, at, until) VALUES ('ev1', 'player', ?, ?, 'other', 'n', 'x', ?, ?)`).run(player, c.id, nowS(), nowS() + 60);
  assert.equal((await s.admin('/v1/staff/rollback', { id: c.id })).body.blocked, 'staff-remove-pending');
  assert.deepEqual(await s.admin('/v1/staff/rollback', { id: c.id, confirm: true }), { status: 409, body: { error: 'staff-remove-pending' } });
  assert.equal(s.audits('rollback').at(-1).outcome, 'failed');
  s.raw.prepare("UPDATE staff_evidence SET state = 'returned' WHERE id = 'ev1'").run();
  const done = await s.admin('/v1/staff/rollback', { id: c.id, confirm: true, note: 'the gem-daggers' });
  assert.deepEqual(done.body, { ok: true, seq: 5, held: 'staff' });
  assert.deepEqual([s.row(c.id).obj, s.row(c.id).held, s.row(c.id).lease], [cleanKey, 'staff', null], 'the clean save, and the staff hold kept through it');
  assert.equal(s.audits('rollback').at(-1).outcome, 'ok');
  // a character never judged clean has nothing to roll back to
  s.raw.prepare('UPDATE realm_characters SET clean_obj = NULL WHERE id = ?').run(c.id);
  assert.equal((await s.admin('/v1/staff/rollback', { id: c.id })).body.blocked, 'no-clean');
  assert.deepEqual(await s.admin('/v1/staff/rollback', { id: c.id, confirm: true }), { status: 409, body: { error: 'no-clean' } });
});

test('STAFF-PANEL3-REALM: FIX ACCOUNT - the purse mend and the repair as buttons, a note required; the review\'s own refusal said and written failed (mutants: the note; the mend\'s answer)', async () => {
  const s = await stand();
  const c = await s.seat('Purse', freshSave({ name: 'Purse', goldPieces: -500 }));
  assert.equal(s.row(c.id).held, 'law', 'a purse below nothing holds');
  assert.deepEqual(await s.admin('/v1/staff/fix/mend', { id: c.id, ticket: 'fb-purse', was: -500, gold: 500 }), { status: 400, body: { error: 'staff-note' } });
  assert.deepEqual(await s.admin('/v1/staff/fix/repair', { id: c.id, ticket: 'fb-x', faction: 1, flag: 1, gold: 0, note: '   ' }), { status: 400, body: { error: 'staff-note' } });
  assert.deepEqual(s.audits('fix-repair').map((a) => [a.outcome, a.detail.error]), [['failed', 'staff-note']]);
  assert.deepEqual(await s.admin('/v1/staff/fix/mend', { id: c.id, ticket: 'fb-purse', was: -400, gold: 500, note: 'the wrapped sale' }), { status: 409, body: { error: 'mend-moved' } });
  assert.equal(s.audits('fix-mend').at(-1).outcome, 'failed');
  const r = await s.admin('/v1/staff/fix/mend', { id: c.id, ticket: 'fb-purse', was: -500, gold: 500, note: 'the wrapped sale' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.ok, r.body.was, r.body.gold, r.body.held, r.body.by, r.body.playing], [true, -500, 500, null, 'SirMcMobdon', true]);
  assert.equal(recordOf(s.env, c.id).goldPieces, 0);
  assert.deepEqual(s.audits('fix-mend').at(-1).detail, { char: c.id, name: 'Purse', note: 'the wrapped sale', ticket: 'fb-purse', gold: 500, was: -500, repeat: false });
});

test('STAFF-PANEL3-REALM: WEALTH PAST THE ALLOWANCE - the judge\'s gains with gold apart from goods (the verdict writes the gold), XP past the line from the progression\'s hours, most urgent first by allowances past, paged and kept five minutes; the Home roll-up (mutants: the gold; the score; the levels; the cache)', async () => {
  const s = await stand();
  const g = await s.seat('Goldy');
  // a bank loan on the books (owed 5500, the most a level 1 owes): wealthOf takes it off, so the gold of the wealth is
  // 5,004,000 + 5,000 - 5,500 and the goods the dagger alone - customs' gold (no loan off) made them 5,500 short, below nothing
  const dagger = piece('a1b2c3d4e5f60718');
  const goldy = freshSave({ name: 'Goldy', goldPieces: 5_000_000, bankAccounts: [{ accountGold: 5000, loanTotal: 5500 }], items: [dagger, { group: 'Currency', templateIndex: 276, stackCount: 4000 }] });
  assert.equal((await s.put(g.who, g.id, goldy)).status, 200);
  const f = s.raw.prepare("SELECT detail FROM realm_findings WHERE char_id = ? AND kind = 'measure'").all(g.id).map((r) => JSON.parse(r.detail));
  assert.equal(f.length, 1);
  assert.deepEqual([f[0].goods, f[0].wealth], [itemWorth(dagger), wealthOf(goldy)], 'the verdict writes the goods of the wealth beside it, in its own measure');
  assert.equal(f[0].wealth - f[0].goods, 5_003_500);
  assert.deepEqual([goodsOf(goldy), goodsOf(null), goodsOf({ items: [{ ...dagger, bound: true }] })], [itemWorth(dagger), 0, 0], 'goodsOf, pure: no coin, no bound piece');
  assert.ok(itemWorth(dagger) > 0 && itemWorth(dagger) < 5500, 'the old subtraction would read the goods below nothing');
  // a smaller gain: one allowance and a bit past
  const m = await s.seat('Middling');
  const cap = BUDGET_DEFAULT.bands[0].cap;
  s.raw.prepare("INSERT INTO realm_findings (player, char_id, seq, at, law, kind, detail) VALUES (?, ?, 2, ?, 0, 'measure', ?)")
    .run(s.row(m.id).player, m.id, nowS() - 100, JSON.stringify({ gain: cap * 2, over: Math.round(cap * 1.5), level: 1, played: 0, wealth: cap * 2, goods: cap }));
  // XP past the line, an account with no wealth found
  const xp = await s.registered('Grinder');
  const renownCap = PROGRESS_LINE.streams.renown.cap;
  s.raw.prepare("INSERT INTO progress_hours (player, stream, hour, amount, played_s, over, claims) VALUES (?, 'renown', ?, ?, 600, ?, 3)").run(xp.id, nowS() - 3600, renownCap * 2, Math.round(renownCap * 0.5));
  const r = await s.admin('/v1/staff/gains');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.gains.map((x) => [x.char?.name ?? null, x.account.name, x.level]), [['Goldy', 'Goldy', 'high'], ['Middling', 'Middling', 'medium'], [null, 'Grinder', 'low']]);
  const top = r.body.gains[0];
  assert.deepEqual([top.wealth.gold, top.wealth.items, top.wealth.now, top.wealth.times], [5_003_500, itemWorth(dagger), f[0].wealth, 1]);
  assert.ok(top.why.includes(`as last judged: gold 5003500, items ${itemWorth(dagger)}`), top.why.join(' · '));
  assert.deepEqual(r.body.gains[2].xp, { renown: { over: Math.round(renownCap * 0.5), amount: renownCap * 2 } });
  assert.deepEqual(r.body.gains[2].why, [`Renown XP ${Math.round(renownCap * 0.5)} past the line`]);
  assert.deepEqual([r.body.next, r.body.total, r.body.days], [null, 3, 7]);
  // kept five minutes: a gain found meanwhile shows after
  s.raw.prepare("INSERT INTO progress_hours (player, stream, hour, amount, played_s, over, claims) VALUES (?, 'prof', ?, 1, 600, ?, 1)").run(xp.id, nowS() - 3600, PROGRESS_LINE.streams.prof.cap * 10);
  assert.equal((await s.admin('/v1/staff/gains')).body.gains.at(-1).level, 'low', 'the kept read');
  const realNow = Date.now;
  Date.now = () => realNow() + GAINS_KEEP_MS + 1;
  try {
    const again = (await s.admin('/v1/staff/gains')).body.gains;
    assert.deepEqual(again.map((x) => x.account.name), ['Goldy', 'Grinder', 'Middling'], 'ten caps of profession XP: high, behind Goldy\'s higher score');
    assert.equal(again[1].level, 'high');
  } finally { Date.now = realNow; }
  // newest first, and the Home roll-up
  assert.deepEqual((await s.admin('/v1/staff/gains', { sort: 'newest', days: 99 })).body.days, 7, 'a window past thirty days is the default');
  const home = await HOME_WATCH.top({ db: s.env.DB, nowS: nowS() }, s.env, null, 2);
  assert.deepEqual([home.items.map((i) => [i.level, i.name]), home.high, home.total], [[['high', 'Goldy'], ['high', 'Grinder']], 2, 3]);
  assert.equal(s.audits('gains-read').length, 2);
  void gainsRanked;
});

test('STAFF-PANEL3-REALM: A HELD OR BANNED SELLER SELLS NOTHING - a buy and a bid refused market-gone; lifted, the buy goes (mutants: each check dropped)', async () => {
  const s = await stand();
  const seller = await s.seated('Seller');
  const ann = await s.registered('Ann');
  s.raw.prepare("INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, 'ore:mithril', 'own', 50)").run(seller.id, seller.character);
  s.raw.prepare('INSERT INTO marks (account, balance) VALUES (?, 100), (?, 1000)').run(seller.id, ann.id);
  const listed = await s.call('/v1/market/list', { character: seller.character, region: DF, kind: 'material', material: 'ore:mithril', units: 40, price: 8, hubs: HUBS, rid: rid() }, seller.secret);
  assert.equal(listed.status, 200, JSON.stringify(listed.body));
  const l = listed.body.listing.id;
  const buy = () => s.call('/v1/market/buy', { character: ann.character, region: DF, listing: l, units: 5, max: 100, hubs: HUBS, rid: rid() }, ann.secret);
  s.raw.prepare("UPDATE realm_characters SET held = 'staff', held_at = 1 WHERE id = ?").run(seller.character);
  assert.deepEqual((await buy()).body, { error: 'market-gone' }, 'held');
  s.raw.prepare('UPDATE realm_characters SET held = NULL WHERE id = ?').run(seller.character);
  s.raw.prepare('UPDATE players SET banned_until = ? WHERE id = ?').run(nowS() + 3600, seller.id);
  assert.deepEqual((await buy()).body, { error: 'market-gone' }, 'banned');
  s.raw.prepare('UPDATE players SET banned_until = NULL WHERE id = ?').run(seller.id);
  assert.equal((await buy()).status, 200, 'neither: sold');
  // an auction's bid, the same
  s.raw.prepare(`INSERT INTO market_auctions (id, seller, char_id, region, provenance, wear, opening, fee, at, ends_at, state, rid, n)
    VALUES ('auctionaaaaaaaaaaaaaaaaa', ?, ?, ?, 'p000000000000001', 900, 10, 1, ?, ?, 'open', 'r1', 'n1')`).run(seller.id, seller.character, DF, nowS(), nowS() + 3600);
  const bid = () => s.call('/v1/market/bid', { character: ann.character, region: DF, auction: 'auctionaaaaaaaaaaaaaaaaa', amount: 20, hubs: HUBS, rid: rid() }, ann.secret);
  s.raw.prepare("UPDATE realm_characters SET held = 'law', held_at = 1 WHERE id = ?").run(seller.character);
  assert.deepEqual((await bid()).body, { error: 'market-gone' }, 'held');
  s.raw.prepare('UPDATE realm_characters SET held = NULL WHERE id = ?').run(seller.character);
  s.raw.prepare('UPDATE players SET banned_until = ? WHERE id = ?').run(nowS() + 3600, seller.id);
  assert.deepEqual((await bid()).body, { error: 'market-gone' }, 'banned');
  s.raw.prepare('UPDATE players SET banned_until = NULL WHERE id = ?').run(seller.id);
  assert.equal((await bid()).status, 200, 'neither: the bid stands');
});

test('STAFF-PANEL3-REALM: PULL and REMOVE FROM MARKET - a reason and a note each; Pull hands the goods back, Remove keeps them 30 days with the piece\'s ledger row taken, and Put back hands them back on the seller\'s next read (mutants: keep; the evidence; the seized mark; Put back\'s guards)', async () => {
  const s = await stand();
  const seller = await s.seated('Seller');
  s.raw.prepare("INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, 'ore:mithril', 'own', 50)").run(seller.id, seller.character);
  s.raw.prepare('INSERT INTO marks (account, balance) VALUES (?, 100)').run(seller.id);
  const list = async (units) => (await s.call('/v1/market/list', { character: seller.character, region: DF, kind: 'material', material: 'ore:mithril', units, price: 8, hubs: HUBS, rid: rid() }, seller.secret)).body.listing.id;
  const stores = () => Number(s.raw.prepare("SELECT COALESCE(SUM(qty), 0) AS n FROM prof_stores WHERE player = ? AND material = 'ore:mithril'").get(seller.id).n);
  const read = () => s.call('/v1/market/read', { character: seller.character, region: DF, view: 'mine', hubs: HUBS }, seller.secret);
  const pulled = await list(10);
  assert.deepEqual(await s.admin('/v1/staff/market/pull', { listing: pulled, note: 'x' }), { status: 400, body: { error: 'staff-reason' } });
  assert.deepEqual(await s.admin('/v1/staff/market/pull', { listing: pulled, reason: 'other' }), { status: 400, body: { error: 'staff-note' } });
  assert.deepEqual((await s.admin('/v1/staff/market/pull', { listing: pulled, reason: 'other', note: 'wrong board' })).body, { ok: true });
  assert.equal(stores(), 40);
  await read();
  assert.equal(stores(), 50, 'pulled: back on the seller\'s read');
  assert.deepEqual(s.audits('market-pull').map((a) => [a.target, a.outcome, a.detail.reason, a.detail.error]),
    [[seller.id, 'failed', null, 'staff-reason'], [seller.id, 'failed', 'other', 'staff-note'], [seller.id, 'ok', 'other', undefined]], 'every refusal written failed');
  // Remove: kept, not handed back
  const removed = await list(10);
  const r = await s.admin('/v1/staff/market/remove', { listing: removed, reason: 'duplicated', note: 'duped ore' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.evidence && r.body.until > nowS() + EVIDENCE_KEEP_S - 60);
  const ev = s.raw.prepare('SELECT * FROM staff_evidence WHERE id = ?').get(r.body.evidence);
  assert.deepEqual([ev.kind, ev.player, ev.char_id, ev.source, ev.reason, ev.note, ev.state], ['listing', seller.id, seller.character, removed, 'duplicated', 'duped ore', 'kept']);
  assert.deepEqual({ ...JSON.parse(ev.detail), rn: undefined }, { kind: 'material', material: 'ore:mithril', units: 10, price: 8, currency: 'marks', provenance: null, wear: null, region: DF, rn: undefined });
  await read();
  assert.equal(stores(), 40, 'removed: kept, never handed back');
  assert.deepEqual(await s.admin('/v1/staff/market/remove', { listing: removed, reason: 'other', note: 'again' }), { status: 409, body: { error: 'market-gone' } });
  assert.equal(s.audits('market-remove').at(-1).outcome, 'failed');
  // the evidence list
  const listed = await s.admin('/v1/staff/evidence', { target: seller.id });
  assert.deepEqual(listed.body.evidence.map((e) => [e.id, e.kind, e.canPutBack]), [[r.body.evidence, 'listing', true]]);
  // Put back: a note, then the seller's next read settles the goods back; once
  assert.deepEqual(await s.admin('/v1/staff/evidence/return', { id: r.body.evidence }), { status: 400, body: { error: 'staff-note' } });
  assert.deepEqual((await s.admin('/v1/staff/evidence/return', { id: r.body.evidence, note: 'wrong call' })).body, { ok: true, evidence: r.body.evidence, kind: 'listing' });
  await read();
  assert.equal(stores(), 50, 'put back: on the seller\'s read');
  assert.deepEqual(await s.admin('/v1/staff/evidence/return', { id: r.body.evidence, note: 'twice' }), { status: 409, body: { error: 'staff-evidence-gone' } });
  assert.deepEqual(await s.admin('/v1/staff/evidence/return', { id: 'nothing', note: 'n' }), { status: 404, body: { error: 'staff-evidence' } });
  // a pack's piece listed: its ledger row taken by staff with it, and given back to the market's hands with Put back
  const item = piece('f0e1d2c3b4a59687');
  s.raw.prepare(`INSERT INTO market_listings (id, seller, char_id, region, kind, units, own, price, fee, at, expires_at, state, rid, n, currency, item)
    VALUES ('itemlistingaaaaaaaaaaaa', ?, ?, ?, 'item', 1, 1, 50, 1, ?, ?, 'open', 'ri', 'ni', 'gold', ?)`).run(seller.id, seller.character, DF, nowS(), nowS() + 3600, JSON.stringify(item));
  s.raw.prepare("INSERT INTO item_uids (uid, player, char_id, seen_seq, state, fp, at) VALUES (?, ?, '', 3, 'escrow', '113:1', 1)").run(item.uid, seller.id);
  const ri = await s.admin('/v1/staff/market/remove', { listing: 'itemlistingaaaaaaaaaaaa', reason: 'bug-reward', note: 'bug loot' });
  assert.equal(ri.status, 200, JSON.stringify(ri.body));
  const uidRow = () => ({ ...s.raw.prepare('SELECT state, char_id FROM item_uids WHERE uid = ?').get(item.uid) });
  assert.deepEqual(uidRow(), { state: 'escrow', char_id: SEIZED });
  const iev = s.raw.prepare('SELECT item, key FROM staff_evidence WHERE id = ?').get(ri.body.evidence);
  assert.deepEqual([JSON.parse(iev.item).uid, iev.key], [item.uid, item.uid]);
  await s.admin('/v1/staff/evidence/return', { id: ri.body.evidence, note: 'it was fine' });
  assert.deepEqual(uidRow(), { state: 'escrow', char_id: '' });
  assert.deepEqual({ ...s.raw.prepare('SELECT returned, rn FROM market_listings WHERE id = ?').get('itemlistingaaaaaaaaaaaa') }, { returned: 0, rn: null });
  // a removal past its 30 days cannot be put back
  const late = await list(5);
  const rl = await s.admin('/v1/staff/market/remove', { listing: late, reason: 'other', note: 'n' });
  s.raw.prepare('UPDATE staff_evidence SET until = ? WHERE id = ?').run(nowS(), rl.body.evidence);
  assert.deepEqual(await s.admin('/v1/staff/evidence/return', { id: rl.body.evidence, note: 'n' }), { status: 409, body: { error: 'staff-evidence-gone' } });
});

test('STAFF-PANEL3-REALM: REMOVE FROM MARKET asks the trail check Remove from a player asks (FLAW REVIEW: a contested piece was seized unasked) - a listed piece with a copy written down, or a claim on its row, needs `trail: true`; a copy on the seller itself its recorded check (mutants: the check; copies; the row; the seller\'s copy)', async () => {
  const s = await stand();
  const seller = await s.seated('Seller');
  const other = await s.seated('Other');
  const list = (id, uid) => {
    s.raw.prepare(`INSERT INTO market_listings (id, seller, char_id, region, kind, units, own, price, fee, at, expires_at, state, rid, n, currency, item)
      VALUES (?, ?, ?, ?, 'item', 1, 1, 50, 1, ?, ?, 'open', ?, ?, 'gold', ?)`).run(id, seller.id, seller.character, DF, nowS(), nowS() + 3600, `r${id}`, `n${id}`, JSON.stringify(piece(uid)));
    s.raw.prepare("INSERT INTO item_uids (uid, player, char_id, seen_seq, state, fp, at) VALUES (?, ?, '', 3, 'escrow', '113:1', 1)").run(uid, seller.id);
  };
  const removal = (id, extra = {}) => s.admin('/v1/staff/market/remove', { listing: id, reason: 'duplicated', note: 'duped', ...extra });
  const state = (id) => s.raw.prepare('SELECT state FROM market_listings WHERE id = ?').get(id).state;
  const uidOf = (k) => ({ ...s.raw.prepare('SELECT char_id, state FROM item_uids WHERE uid = ?').get(k) });
  // a copy another character holds, written down: contested
  list('trailcopyaaaaaaaaaaaaaa', 'aaaa000011112222');
  s.raw.prepare('INSERT INTO item_dupes (uid, char_id, at) VALUES (?, ?, 5)').run('aaaa000011112222', other.character);
  assert.deepEqual(await removal('trailcopyaaaaaaaaaaaaaa'), { status: 409, body: { error: 'staff-trail' } });
  assert.deepEqual([state('trailcopyaaaaaaaaaaaaaa'), uidOf('aaaa000011112222')], ['open', { char_id: '', state: 'escrow' }], 'nothing seized');
  assert.deepEqual(s.audits('market-remove').map((a) => [a.target, a.outcome, a.detail.key, a.detail.error]), [[seller.id, 'failed', 'aaaa000011112222', 'staff-trail']]);
  assert.equal((await removal('trailcopyaaaaaaaaaaaaaa', { trail: true })).status, 200, 'its trail confirmed');
  assert.deepEqual([state('trailcopyaaaaaaaaaaaaaa'), uidOf('aaaa000011112222')], ['removed', { char_id: SEIZED, state: 'escrow' }]);
  // a claim on the row (another record shows the piece): contested
  list('trailclaimaaaaaaaaaaaaa', 'bbbb000011112222');
  s.raw.prepare('UPDATE item_uids SET claim_char = ?, claim_at = 1 WHERE uid = ?').run(other.character, 'bbbb000011112222');
  assert.deepEqual(await removal('trailclaimaaaaaaaaaaaaa'), { status: 409, body: { error: 'staff-trail' } });
  assert.equal((await removal('trailclaimaaaaaaaaaaaaa', { trail: true })).status, 200);
  // a copy written down on the seller's own character waits for its recorded trail check - a confirm alone is not one
  list('trailownaaaaaaaaaaaaaaa', 'cccc000011112222');
  s.raw.prepare('INSERT INTO item_dupes (uid, char_id, at) VALUES (?, ?, 5)').run('cccc000011112222', seller.character);
  assert.deepEqual(await removal('trailownaaaaaaaaaaaaaaa', { trail: true }), { status: 409, body: { error: 'staff-trail' } });
  s.raw.prepare('UPDATE item_dupes SET trail_at = 6 WHERE uid = ?').run('cccc000011112222');
  assert.equal((await removal('trailownaaaaaaaaaaaaaaa', { trail: true })).status, 200);
  // the market's own unclaimed hold, no copy known: no trail asked
  list('trailnoneaaaaaaaaaaaaaa', 'dddd000011112222');
  assert.equal((await removal('trailnoneaaaaaaaaaaaaaa')).status, 200);
});

test('STAFF-PANEL3-REALM: A PULL THROUGH THE GAME\'S DOOR IS WRITTEN DOWN (FLAW REVIEW: marketRemove wrote no audit) - the shared act writes one row, ok or failed with its word, whichever door; the panel\'s door no second (mutants: the act\'s row; its outcome)', async () => {
  const s = await stand();
  const seller = await s.seated('Seller');
  s.raw.prepare("INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, 'ore:mithril', 'own', 50)").run(seller.id, seller.character);
  s.raw.prepare('INSERT INTO marks (account, balance) VALUES (?, 100)').run(seller.id);
  const list = async () => (await s.call('/v1/market/list', { character: seller.character, region: DF, kind: 'material', material: 'ore:mithril', units: 5, price: 8, hubs: HUBS, rid: rid() }, seller.secret)).body.listing.id;
  const mob = (await s.call('/v1/auth/login', { handle: 'SirMcMobdon', password: PASSWORD })).body.secret;
  const asy = (await s.call('/v1/auth/login', { handle: 'Asynian', password: PASSWORD })).body.secret;
  const l = await list();
  assert.deepEqual((await s.call('/v1/market/remove', { listing: l }, asy)).body, { error: 'not-developer' });
  assert.deepEqual(s.audits('market-pull'), [], 'a refused player is no staff act');
  assert.deepEqual((await s.call('/v1/market/remove', { listing: l }, mob)).body, { ok: true });
  assert.deepEqual((await s.call('/v1/market/remove', { listing: l }, mob)).body, { error: 'market-gone' });
  assert.deepEqual((await s.call('/v1/market/remove', { listing: '!' }, mob)).body, { error: 'bad-listing' });
  // an auction likewise
  s.raw.prepare(`INSERT INTO market_auctions (id, seller, char_id, region, provenance, wear, opening, fee, at, ends_at, state, rid, n)
    VALUES ('auctionbbbbbbbbbbbbbbbbb', ?, ?, ?, 'p000000000000002', 900, 10, 1, ?, ?, 'open', 'r2', 'n2')`).run(seller.id, seller.character, DF, nowS(), nowS() + 3600);
  assert.deepEqual((await s.call('/v1/market/remove', { listing: 'auctionbbbbbbbbbbbbbbbbb' }, mob)).body, { ok: true });
  const rows = s.raw.prepare("SELECT actor_name, role, act, target, detail, outcome FROM staff_audit WHERE act = 'market-pull' ORDER BY id").all().map((r) => ({ ...r, detail: JSON.parse(r.detail) }));
  assert.deepEqual(rows, [
    { actor_name: 'SirMcMobdon', role: 'admin', act: 'market-pull', target: seller.id, detail: { listing: l, door: 'game' }, outcome: 'ok' },
    { actor_name: 'SirMcMobdon', role: 'admin', act: 'market-pull', target: seller.id, detail: { listing: l, door: 'game', error: 'market-gone' }, outcome: 'failed' },
    { actor_name: 'SirMcMobdon', role: 'admin', act: 'market-pull', target: null, detail: { listing: '!', door: 'game', error: 'bad-listing' }, outcome: 'failed' },
    { actor_name: 'SirMcMobdon', role: 'admin', act: 'market-pull', target: seller.id, detail: { listing: 'auctionbbbbbbbbbbbbbbbbb', door: 'game' }, outcome: 'ok' },
  ]);
  // the panel's own door: one row each, written by the act - ok, then failed with its word
  const p = await list();
  assert.deepEqual((await s.admin('/v1/staff/market/pull', { listing: p, reason: 'other', note: 'wrong board' })).body, { ok: true });
  assert.deepEqual(await s.admin('/v1/staff/market/pull', { listing: p, reason: 'other', note: 'again' }), { status: 409, body: { error: 'market-gone' } });
  assert.deepEqual(s.audits('market-pull').slice(4).map((a) => [a.target, a.outcome, a.detail.note, a.detail.door, a.detail.error]),
    [[seller.id, 'ok', 'wrong board', undefined, undefined], [seller.id, 'failed', 'again', undefined, 'market-gone']]);
});

test('STAFF-PANEL3-REALM: REMOVE FROM A PLAYER - previewed, then taken on its own path: one save on, the seat taken, the piece kept and its ledger row taken, so a save that shows it again holds a copy; a contested piece needs its trail checked; Roll back waits; Put back gives it back (mutants: seq; trail; take; the seized row; Put back)', async () => {
  const s = await stand();
  const uid = 'abcdef0123456789';
  const t = await s.seat('Taker', freshSave({ name: 'Taker', items: [piece(uid)] }));
  const lease = s.row(t.id).lease;
  assert.deepEqual({ ...s.raw.prepare('SELECT char_id, state FROM item_uids WHERE uid = ?').get(uid) }, { char_id: t.id, state: 'held' });
  const pre = await s.admin('/v1/staff/item/take', { id: t.id, at: [0, 0] });
  assert.equal(pre.status, 200, JSON.stringify(pre.body));
  assert.deepEqual([pre.body.seq, pre.body.key, pre.body.contested, pre.body.playing, pre.body.at], [2, uid, false, true, [0, 0]]);
  assert.deepEqual(pre.body.trail.holder, { char: t.id, account: s.row(t.id).player, state: 'held', since: pre.body.trail.holder.since });
  assert.ok(pre.body.worth > 0);
  assert.deepEqual(await s.admin('/v1/staff/item/take', { id: t.id, key: 'ffffffffffffffff' }), { status: 409, body: { error: 'staff-no-piece' } });
  const take = { id: t.id, at: [0, 0], seq: 2, confirm: true, reason: 'duplicated', note: 'the duped dagger' };
  // FLAW REVIEW: a confirmed removal refused before its piece is read is written down failed too
  assert.deepEqual(await s.admin('/v1/staff/item/take', { ...take, at: undefined, key: 'ffffffffffffffff' }), { status: 409, body: { error: 'staff-no-piece' } });
  assert.deepEqual(s.audits('item-take').at(-1), { act: 'item-take', target: s.row(t.id).player, detail: { char: t.id, name: 'Taker', key: 'ffffffffffffffff', at: null, error: 'staff-no-piece' }, outcome: 'failed' });
  assert.deepEqual(await s.admin('/v1/staff/item/take', { ...take, reason: 'because' }), { status: 400, body: { error: 'staff-reason' } });
  assert.deepEqual(await s.admin('/v1/staff/item/take', { ...take, seq: 1 }), { status: 409, body: { error: 'seq' } });
  const r = await s.admin('/v1/staff/item/take', take);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.seq, r.body.playing], [3, true]);
  assert.deepEqual([s.row(t.id).seq, s.row(t.id).lease, recordOf(s.env, t.id).items], [3, null, []], 'one save on, the seat taken, the piece gone');
  assert.deepEqual({ ...s.raw.prepare('SELECT char_id, state FROM item_uids WHERE uid = ?').get(uid) }, { char_id: SEIZED, state: 'escrow' });
  const ev = s.raw.prepare('SELECT * FROM staff_evidence WHERE id = ?').get(r.body.evidence);
  assert.deepEqual([ev.kind, ev.char_id, ev.key, JSON.parse(ev.item).uid, ev.reason], ['player', t.id, uid, uid, 'duplicated']);
  assert.deepEqual(s.staffFindings(t.id).at(-1), { act: 'take', by: 'SirMcMobdon', note: 'the duped dagger', reason: 'duplicated', evidence: r.body.evidence, key: uid, from: 2, to: 3 });
  // the playing tab's next save is refused; its next join plays the record without the piece
  assert.deepEqual((await s.put(t.who, t.id, freshSave({ name: 'Taker', items: [piece(uid)] }), { lease })).body, { error: 'lease' });
  // Roll back waits on the kept removal
  assert.deepEqual(await s.admin('/v1/staff/rollback', { id: t.id, confirm: true }), { status: 409, body: { error: 'staff-remove-pending' } });
  // a save that shows it again holds a copy: written down and charged
  await realmJoinAt(s.env, t.who.secret, t.id);
  const again = await s.put(t.who, t.id, freshSave({ name: 'Taker', items: [piece(uid)] }));
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.deepEqual(again.body.locked, [uid]);
  assert.ok(s.raw.prepare('SELECT 1 FROM item_dupes WHERE uid = ? AND char_id = ?').get(uid, t.id));
  assert.equal(s.row(t.id).dupes, 1);
  // Put back: into the pack of the record as it stands, the ledger the record's again
  // (the record already shows it again: no second one, and the copy written against it cleared)
  const back = await s.admin('/v1/staff/evidence/return', { id: r.body.evidence, note: 'it was his' });
  assert.equal(back.status, 200, JSON.stringify(back.body));
  assert.equal(back.body.shown, true);
  assert.deepEqual(recordOf(s.env, t.id).items.map((i) => i.uid), [uid]);
  assert.deepEqual({ ...s.raw.prepare('SELECT char_id, state FROM item_uids WHERE uid = ?').get(uid) }, { char_id: t.id, state: 'held' });
  assert.equal(s.raw.prepare('SELECT 1 FROM item_dupes WHERE uid = ? AND char_id = ?').get(uid, t.id), undefined);
  assert.equal(s.raw.prepare('SELECT state FROM staff_evidence WHERE id = ?').get(r.body.evidence).state, 'returned');
  assert.equal(s.staffFindings(t.id).at(-1).act, 'put-back');
  assert.deepEqual(s.audits('item-take').map((a) => [a.outcome, a.detail.error]), [['failed', 'staff-no-piece'], ['failed', 'staff-reason'], ['failed', 'seq'], ['ok', undefined]]);
  // A CONTESTED PIECE - a copy the ledger wrote down - asks its trail checked first, and is taken whatever the ledger says
  const cuid = '0123456789abcdef';
  const u = await s.seat('Copyholder', freshSave({ name: 'Copyholder', items: [piece(cuid, 12)] }));
  s.raw.prepare('INSERT INTO item_dupes (uid, char_id, at) VALUES (?, ?, 5)').run(cuid, u.id);
  const cpre = (await s.admin('/v1/staff/item/take', { id: u.id, key: cuid })).body;
  assert.deepEqual([cpre.contested, cpre.trail.copies], [true, [{ char_id: u.id, at: 5, trail_at: null }]]);
  const ctake = { id: u.id, key: cuid, seq: s.row(u.id).seq, confirm: true, reason: 'duplicated', note: 'a copy' };
  assert.deepEqual(await s.admin('/v1/staff/item/take', ctake), { status: 409, body: { error: 'staff-trail' } });
  // ...and a copy written down on this very character waits for its recorded trail check, a confirm alone is not one
  assert.deepEqual(await s.admin('/v1/staff/item/take', { ...ctake, trail: true }), { status: 409, body: { error: 'staff-trail' } });
  assert.equal((await s.admin('/v1/staff/contested/trail', { uid: cuid, char: u.id, found: 'copier', note: 'two of one key' })).status, 200);
  const ct = await s.admin('/v1/staff/item/take', { ...ctake, trail: true });
  assert.equal(ct.status, 200, JSON.stringify(ct.body));
  assert.deepEqual(recordOf(s.env, u.id).items, []);
  assert.deepEqual({ ...s.raw.prepare('SELECT char_id, state FROM item_uids WHERE uid = ?').get(cuid) }, { char_id: SEIZED, state: 'escrow' }, 'known copies: its row kept gone, then taken');
  // put back where the record no longer shows it: into the pack, the row the record's - and (FLAW REVIEW: Put back is an
  // undo) its copy mark kept as the removal found it, its trail check with it
  const cback = await s.admin('/v1/staff/evidence/return', { id: ct.body.evidence, note: 'checked: his' });
  assert.equal(cback.status, 200, JSON.stringify(cback.body));
  assert.deepEqual([cback.body.shown, recordOf(s.env, u.id).items.map((i) => i.uid)], [false, [cuid]]);
  assert.deepEqual({ ...s.raw.prepare('SELECT char_id, state FROM item_uids WHERE uid = ?').get(cuid) }, { char_id: u.id, state: 'held' });
  assert.deepEqual({ ...s.raw.prepare('SELECT at, trail_found FROM item_dupes WHERE uid = ? AND char_id = ?').get(cuid, u.id) }, { at: 5, trail_found: 'copier' });
  assert.deepEqual(await s.admin('/v1/staff/evidence/return', { id: ct.body.evidence, note: 'again' }), { status: 409, body: { error: 'staff-evidence-gone' } });
  // a copy of a piece ANOTHER record holds: taken, and the holder's row stays the holder's
  const h = await s.seat('Holder', freshSave({ name: 'Holder', items: [piece('1111222233334444', 13)] }));
  const v = await s.seat('Victim', freshSave({ name: 'Victim' }));
  s.raw.prepare("INSERT INTO item_uids (uid, player, char_id, seen_seq, state, fp, at, claim_char, claim_at) VALUES ('5555666677778888', ?, ?, 1, 'held', '113:1', 1, ?, 1)")
    .run(s.row(h.id).player, h.id, v.id);
  const rec = recordOf(s.env, v.id);
  const obj = s.row(v.id).obj;
  s.env.SAVES._map.set(obj, new TextEncoder().encode(JSON.stringify({ ...rec, items: [piece('5555666677778888', 14)] })));
  // ...the ledger's word alone (no copy written down here) still asks the trail confirmed in the preview
  assert.deepEqual(await s.admin('/v1/staff/item/take', { id: v.id, at: [0, 0], seq: s.row(v.id).seq, confirm: true, reason: 'duplicated', note: 'a copy of Holder\'s' }), { status: 409, body: { error: 'staff-trail' } });
  const vt = await s.admin('/v1/staff/item/take', { id: v.id, at: [0, 0], seq: s.row(v.id).seq, confirm: true, trail: true, reason: 'duplicated', note: 'a copy of Holder\'s' });
  assert.equal(vt.status, 200, JSON.stringify(vt.body));
  assert.deepEqual({ ...s.raw.prepare("SELECT char_id, state, claim_char FROM item_uids WHERE uid = '5555666677778888'").get() }, { char_id: h.id, state: 'held', claim_char: null }, 'the holder\'s, its claim withdrawn');
  // PUT BACK OF THAT COPY (FLAW REVIEW: Put back handed the holder's row to the record the copy was taken from): the piece
  // back in the Victim's pack as the copy it was - the Holder's row still the Holder's, a copy mark written meanwhile kept
  const uidOf = (k) => ({ ...s.raw.prepare('SELECT char_id, state FROM item_uids WHERE uid = ?').get(k) });
  s.raw.prepare('INSERT INTO item_dupes (uid, char_id, at) VALUES (?, ?, ?)').run('5555666677778888', v.id, nowS());
  // (a checkpoint that moves the holder's row while the Put back is read refuses it whole - nothing written over it stale)
  const get = s.env.SAVES.get;
  s.env.SAVES.get = async (k) => { s.env.SAVES.get = get; s.raw.prepare("UPDATE item_uids SET at = at + 1 WHERE uid = '5555666677778888'").run(); return get(k); };
  assert.deepEqual(await s.admin('/v1/staff/evidence/return', { id: vt.body.evidence, note: 'raced' }), { status: 409, body: { error: 'seq' } });
  assert.equal(s.raw.prepare('SELECT state FROM staff_evidence WHERE id = ?').get(vt.body.evidence).state, 'kept');
  const vback = await s.admin('/v1/staff/evidence/return', { id: vt.body.evidence, note: 'the call was wrong' });
  assert.equal(vback.status, 200, JSON.stringify(vback.body));
  assert.deepEqual([vback.body.shown, recordOf(s.env, v.id).items.map((i) => i.uid)], [false, ['5555666677778888']]);
  assert.deepEqual(uidOf('5555666677778888'), { char_id: h.id, state: 'held' }, 'the holder keeps its piece');
  assert.ok(s.raw.prepare('SELECT 1 FROM item_dupes WHERE uid = ? AND char_id = ?').get('5555666677778888', v.id), 'the copy stays a copy');
  // ...a copy of a piece the market holds (a listing's): the market's row stays the market's
  const plant = async (name, k, seed) => {
    const who = await s.seat(name, freshSave({ name }));
    s.env.SAVES._map.set(s.row(who.id).obj, new TextEncoder().encode(JSON.stringify({ ...recordOf(s.env, who.id), items: [piece(k, seed)] })));
    const took = await s.admin('/v1/staff/item/take', { id: who.id, at: [0, 0], seq: s.row(who.id).seq, confirm: true, trail: true, reason: 'duplicated', note: 'a copy' });
    assert.equal(took.status, 200, JSON.stringify(took.body));
    return { ...who, evidence: took.body.evidence };
  };
  s.raw.prepare("INSERT INTO item_uids (uid, player, char_id, seen_seq, state, fp, at) VALUES ('9999aaaabbbbcccc', ?, '', 3, 'escrow', '113:1', 1)").run(s.row(h.id).player);
  const mc = await plant('Marketcopy', '9999aaaabbbbcccc', 15);
  assert.deepEqual(uidOf('9999aaaabbbbcccc'), { char_id: '', state: 'escrow' });
  assert.equal((await s.admin('/v1/staff/evidence/return', { id: mc.evidence, note: 'wrong call' })).status, 200);
  assert.deepEqual(uidOf('9999aaaabbbbcccc'), { char_id: '', state: 'escrow' }, 'the listing\'s piece stays in the market\'s hands');
  // ...and a copy of a piece staff took from its holder: put back, the row stays taken - never the copy's
  assert.equal((await s.admin('/v1/staff/item/take', { id: h.id, at: [0, 0], seq: s.row(h.id).seq, confirm: true, reason: 'duplicated', note: 'his own' })).status, 200);
  assert.deepEqual(uidOf('1111222233334444'), { char_id: SEIZED, state: 'escrow' });
  const sc = await plant('Secondcopy', '1111222233334444', 13);
  assert.equal((await s.admin('/v1/staff/evidence/return', { id: sc.evidence, note: 'wrong call' })).status, 200);
  assert.deepEqual(uidOf('1111222233334444'), { char_id: SEIZED, state: 'escrow' }, 'taken from its holder still');
  // a confirmed removal from a dead character: refused, and written down failed
  s.raw.prepare('UPDATE realm_characters SET dead_at = 1 WHERE id = ?').run(sc.id);
  assert.deepEqual(await s.admin('/v1/staff/item/take', { id: sc.id, at: [0, 0], seq: s.row(sc.id).seq, confirm: true, reason: 'other', note: 'n' }), { status: 409, body: { error: 'dead' } });
  assert.deepEqual([s.audits('item-take').at(-1).outcome, s.audits('item-take').at(-1).detail.error], ['failed', 'dead']);
});

test('STAFF-PANEL3-REALM: the 30-day store is swept by the hour - kept or put back, past its `until` (mutant: the cutoff)', async () => {
  const s = await stand();
  const now = nowS();
  const add = (id, until, state = 'kept') => s.raw.prepare(`INSERT INTO staff_evidence (id, kind, player, reason, note, by_id, at, until, state) VALUES (?, 'player', 'p', 'other', 'n', 'x', 1, ?, ?)`).run(id, until, state);
  add('old', now - 1); add('done', now - 5, 'returned'); add('fresh', now + 60);
  const ran = await runCron(s.env, { cron: CRON_HOUR, nowS: now, jobs: HOUR_JOBS.filter(([n]) => n === 'staff-evidence') });
  assert.deepEqual(ran.map((r) => [r.name, r.ok, r.changed]), [['staff-evidence', true, 2]]);
  assert.deepEqual(s.raw.prepare('SELECT id FROM staff_evidence').all().map((r) => r.id), ['fresh']);
});

test('STAFF-PANEL3-REALM: takeOut - a piece out of wherever it lies, by identity: a list, a room\'s set-out piece, a companion\'s kit', () => {
  const a = { n: 1 }, b = { n: 2 }, c = { n: 3 }, d = { n: 1 };
  const save = { items: [d, a], sceneCache: { scenes: [{ decorOwn: { k1: b } }] }, modData: { R: { gear: { head: c } } } };
  assert.ok(takeOut(save, a));
  assert.deepEqual(save.items, [d], 'the same object, never one equal to it');
  assert.ok(takeOut(save, b));
  assert.deepEqual(save.sceneCache.scenes[0].decorOwn, {});
  assert.ok(takeOut(save, c));
  assert.deepEqual(save.modData.R.gear, {});
  assert.equal(takeOut(save, { n: 9 }), false);
});

test('STAFF-GIVE: ADD AN ITEM - the item list from the game\'s tables; a piece minted by the game\'s producers and previewed with its findings and its enchantments\' cost against its power; given only with a reason, a note and the seq looked at, and never a piece the law finds; one save on, the seat taken, its worth witnessed and its ledger id the record\'s (mutants: the law\'s word; seq; the reason; the witness)', async () => {
  const s = await stand();
  const cat = (await s.admin('/v1/staff/item/catalogue')).body;
  const dagger = cat.items.find((t) => t.name === 'Dagger');
  assert.deepEqual([dagger.i, dagger.groups, dagger.stacks], [113, ['Weapons'], false]);
  assert.ok(cat.items.find((t) => t.name === 'Arrow').stacks);
  assert.deepEqual(cat.materials.Weapons.at(-1), [9, 'Daedric']);
  const strikes = cat.enchants.find((e) => e.key === 'CastWhenStrikes');
  assert.ok(strikes && !strikes.side && strikes.params.length > 0);
  assert.ok(cat.enchants.find((e) => e.key === 'BadReactionsFrom').side);
  assert.ok(!cat.enchants.some((e) => e.key === 'SpecialArtifactEffect'), 'an artifact\'s power is never offered');
  const g = await s.seat('Gifted', freshSave({ name: 'Gifted' }));
  const seq = s.row(g.id).seq;
  // the preview: minted, judged, nothing written
  const pre = await s.admin('/v1/staff/item/give', { id: g.id, template: 113, material: 9 });
  assert.equal(pre.status, 200, JSON.stringify(pre.body));
  assert.deepEqual([pre.body.seq, pre.body.findings, pre.body.piece.name, pre.body.piece.material, pre.body.playing], [seq, [], 'Dagger', 9, true]);
  assert.ok(pre.body.worth > 0);
  assert.equal(s.row(g.id).seq, seq, 'a preview moves nothing');
  // what the list does not take
  assert.deepEqual(await s.admin('/v1/staff/item/give', { id: g.id, template: 113, material: 0x209 }), { status: 400, body: { error: 'staff-item-template' } });
  assert.deepEqual(await s.admin('/v1/staff/item/give', { id: g.id, template: 113, count: 5 }), { status: 400, body: { error: 'staff-item-template' } }, 'a dagger never stacks');
  assert.deepEqual(await s.admin('/v1/staff/item/give', { id: g.id, template: 113, gold: 500 }), { status: 400, body: { error: 'staff-item-template' } }, 'gold rides a letter alone');
  assert.deepEqual(await s.admin('/v1/staff/item/give', { id: g.id, template: 113, enchant: [{ key: 'SpecialArtifactEffect', param: 0 }] }), { status: 400, body: { error: 'staff-item-enchant' } });
  assert.deepEqual(await s.admin('/v1/staff/item/give', { id: g.id, template: 99999 }), { status: 400, body: { error: 'staff-item-template' } });
  // past the item's power: the law's finding, shown, and never given
  const big = { id: g.id, template: 113, material: 0, enchant: [{ key: 'CastWhenStrikes', param: strikes.params[0][0] }] };
  const over = (await s.admin('/v1/staff/item/give', big)).body;
  assert.deepEqual(over.findings, ['enchantments']);
  assert.ok(over.cost > over.power);
  assert.deepEqual(await s.admin('/v1/staff/item/give', { ...big, seq, confirm: true, reason: 'event-prize', note: 'too strong' }), { status: 409, body: { error: 'staff-item-unlawful' } });
  // within it: a side effect pays for a power, as the item maker's window takes them
  const fair = { id: g.id, template: 113, material: 9, enchant: [{ key: 'EnhancesSkill', param: 0 }, { key: 'ItemDeteriorates', param: 0 }] };
  const fp = (await s.admin('/v1/staff/item/give', fair)).body;
  assert.deepEqual(fp.findings, []);
  assert.ok(fp.cost <= fp.power, "the side effect's points pay for the power");
  const give = { ...fair, seq, confirm: true, reason: 'bug-refund', note: 'lost to the bridge bug' };
  assert.deepEqual(await s.admin('/v1/staff/item/give', { ...give, reason: 'because' }), { status: 400, body: { error: 'staff-reason' } });
  assert.deepEqual(await s.admin('/v1/staff/item/give', { ...give, note: ' ' }), { status: 400, body: { error: 'staff-note' } });
  assert.deepEqual(await s.admin('/v1/staff/item/give', { ...give, seq: seq - 1 }), { status: 409, body: { error: 'seq' } });
  const wit = s.row(g.id).witnessed;
  const r = await s.admin('/v1/staff/item/give', give);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.seq, s.row(g.id).seq, s.row(g.id).lease], [seq + 1, seq + 1, null], 'one save on, the seat taken');
  const items = recordOf(s.env, g.id).items;
  assert.equal(items.length, 1);
  assert.deepEqual([items[0].name, items[0].material, items[0].enchantments.map((e) => [e.type, e.param])], ['Dagger', 9, [[10, 0], [16, 0]]]);
  assert.ok(s.row(g.id).witnessed > wit, 'the gift witnessed');
  const f = s.staffFindings(g.id).at(-1);
  assert.deepEqual([f.act, f.by, f.reason, f.note, f.from, f.to, f.item.name], ['give', 'SirMcMobdon', 'bug-refund', 'lost to the bridge bug', seq, seq + 1, 'Dagger']);
  // a stack and a letter's gold
  const more = await s.admin('/v1/staff/item/give', { id: g.id, template: 131, count: 40, seq: seq + 1, confirm: true, reason: 'testing', note: 'arrows' });
  assert.equal(more.status, 200, JSON.stringify(more.body));
  const letter = await s.admin('/v1/staff/item/give', { id: g.id, template: cat.letter, gold: 2500, seq: seq + 2, confirm: true, reason: 'compensation', note: 'his bank' });
  assert.equal(letter.status, 200, JSON.stringify(letter.body));
  const after = recordOf(s.env, g.id).items;
  assert.deepEqual([after[1].stackCount, after[2].value], [40, 2500]);
  assert.ok(/^[0-9a-f]{16}$/.test(after[2].uid), 'a letter is valuable: its ledger id minted');
  assert.deepEqual({ ...s.raw.prepare('SELECT char_id, state FROM item_uids WHERE uid = ?').get(after[2].uid) }, { char_id: g.id, state: 'held' }, 'and entered as the record\'s own');
  assert.deepEqual(s.audits('item-give').map((a) => [a.outcome, a.detail.error]),
    [['failed', 'staff-item-unlawful'], ['failed', 'staff-reason'], ['failed', 'staff-note'], ['failed', 'seq'], ['ok', undefined], ['ok', undefined], ['ok', undefined]]);
  // the player's next checkpoint carries them, and the law holds nothing
  await realmJoinAt(s.env, g.who.secret, g.id);
  const back = await s.put(g.who, g.id, { ...recordOf(s.env, g.id) });
  assert.equal(back.status, 200, JSON.stringify(back.body));
  assert.equal(back.body.tradeHeld ?? null, null, 'a gift never holds their trading');
});

test('STAFF-PURGE-DUPES: one confirm destroys every copy marked on the character, in the pack and the wagon and that account\'s chests, and leaves another home\'s row', async () => {
  const s = await stand();
  const a = 'a100000000000001';
  const c = 'c100000000000003';
  const keep = 'd100000000000004';
  const gear = 'e100000000000005';
  const doubled = piece(a);
  const t = await s.seat('Flagged', freshSave({
    name: 'Flagged', items: [doubled, { ...doubled }, piece(keep)], wagonItems: [piece(c)],
    modData: { Revenant: { list: [{ sworn: true, companion: { gear: { helm: piece(gear) } } }] } },
  }));
  s.raw.prepare('INSERT INTO item_dupes (uid, char_id, at) VALUES (?, ?, ?)').run(c, t.id, nowS());
  s.raw.prepare('INSERT INTO item_dupes (uid, char_id, at) VALUES (?, ?, ?)').run(gear, t.id, nowS());
  const player = s.row(t.id).player;
  s.raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) VALUES (11, 11, ?, ?, 'Flagged', 17, 'private', 1, 1)").run(player, t.id);
  s.raw.prepare("INSERT INTO decor_bin (map_id, building_key, piece_id, uid, item) VALUES (11, 11, 'chest', ?, '{}')").run(a);
  const other = await s.seat('Neighbour');
  s.raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) VALUES (22, 22, ?, ?, 'Neighbour', 17, 'private', 1, 1)").run(s.row(other.id).player, other.id);
  s.raw.prepare("INSERT INTO decor_bin (map_id, building_key, piece_id, uid, item) VALUES (22, 22, 'chest', ?, '{}')").run(a);
  const pre = await s.admin('/v1/staff/item/purge-dupes', { id: t.id });
  assert.equal(pre.status, 200, JSON.stringify(pre.body));
  assert.deepEqual([pre.body.dupes, pre.body.held, pre.body.bins, pre.body.playing], [3, 4, 1, true]);
  const ask = { id: t.id, confirm: true, reason: 'duplicated', note: 'clear the chest flags', seq: pre.body.seq };
  assert.deepEqual(await s.admin('/v1/staff/item/purge-dupes', { ...ask, reason: 'because' }), { status: 400, body: { error: 'staff-reason' } });
  assert.deepEqual(await s.admin('/v1/staff/item/purge-dupes', { ...ask, seq: 1 }), { status: 409, body: { error: 'seq' } });
  const r = await s.admin('/v1/staff/item/purge-dupes', ask);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.playing, false);
  const save = recordOf(s.env, t.id);
  assert.deepEqual(save.items.map((i) => i.uid), [keep]);
  assert.deepEqual(save.wagonItems, []);
  assert.deepEqual(save.modData.Revenant.list[0].companion.gear, {});
  assert.equal(s.row(t.id).lease, null);
  assert.equal(s.row(t.id).seq, pre.body.seq + 1);
  assert.equal(s.raw.prepare('SELECT 1 FROM item_dupes WHERE char_id = ?').get(t.id), undefined);
  assert.equal(s.raw.prepare('SELECT 1 FROM item_uids WHERE uid = ? AND char_id = ?').get(a, t.id), undefined);
  assert.equal(s.raw.prepare('SELECT 1 FROM decor_bin WHERE map_id = 11').get(), undefined);
  assert.ok(s.raw.prepare('SELECT 1 FROM decor_bin WHERE map_id = 22').get());
  assert.equal(s.staffFindings(t.id).at(-1).act, 'purge-dupes');
  assert.deepEqual(await s.admin('/v1/staff/item/purge-dupes', { ...ask, seq: r.body.seq, note: 'again' }), { status: 409, body: { error: 'no-dupes' } });
  // a mark that lives only in a chest still seizes the record, so a withdraw racing the purge cannot land the piece after it
  const only = 'f100000000000006';
  const chest = await s.seat('Chested');
  s.raw.prepare('INSERT INTO item_dupes (uid, char_id, at) VALUES (?, ?, ?)').run(only, chest.id, nowS());
  s.raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) VALUES (33, 33, ?, ?, 'Chested', 17, 'private', 1, 1)").run(s.row(chest.id).player, chest.id);
  s.raw.prepare("INSERT INTO decor_bin (map_id, building_key, piece_id, uid, item) VALUES (33, 33, 'chest', ?, '{}')").run(only);
  const bare = await s.admin('/v1/staff/item/purge-dupes', { id: chest.id });
  assert.deepEqual([bare.body.dupes, bare.body.held, bare.body.bins], [1, 0, 1]);
  const gone = await s.admin('/v1/staff/item/purge-dupes', { id: chest.id, confirm: true, reason: 'duplicated', note: 'the chest copy', seq: bare.body.seq });
  assert.equal(gone.status, 200, JSON.stringify(gone.body));
  assert.equal(s.row(chest.id).seq, bare.body.seq + 1);
  assert.equal(s.row(chest.id).lease, null);
  assert.equal(s.raw.prepare('SELECT 1 FROM decor_bin WHERE map_id = 33').get(), undefined);
  assert.equal(s.raw.prepare('SELECT 1 FROM item_dupes WHERE char_id = ?').get(chest.id), undefined);
});
