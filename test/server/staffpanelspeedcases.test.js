// STAFF-PANEL-SPEED (2026-10-23, mob: "slow when moving in menus", "The click takes a while before the new page shows
// (it's waiting on the server)") - THE REPORTS' DOORS (server-account/src/staffCases.js) PINNED TO THEIR D1 ROUND TRIPS:
// what a click waits on is each statement awaited after the last, times the network to D1, so the reads a door makes
// together share one trip (a batch, a Promise.all) and the audit row lands in the batch of its page's last statements.
// Each pin counts a door's trips on the real Worker (test/server/staffTrips.mjs countTrips), the staff session's own
// lookup among them, and checks the door still answers what it answered.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { countTrips } from './staffTrips.mjs';
import { staffWords, STAFF_SESSION_HEADER } from '../../server-account/src/staff.js';
import { CLAIM_S } from '../../server-account/src/staffCases.js';
import { SAFE_LAW_PATH } from '../../src/net/wire.js';
import { SPROUT_S } from '../../server-account/src/titles.js';

const { subtle } = globalThis.crypto;
const enc = new TextEncoder();
const nowS = () => Math.floor(Date.now() / 1000);
const PASSWORD = 'a good long one';
const RELAY = 'https://relay.example' + SAFE_LAW_PATH;
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

/** staffpanel2.test.js's stand: mob (an Admin and owner) and Asynian and Tabbyvish (Moderators) signed in, Troll and
 *  Sylvia two players, the relay's door answered - and `trips(path, body, token)`, a door's answer with its trips (no
 *  token: the game's own door, as Asynian). */
async function stand() {
  const mobKey = await extensionKey();
  const s = await standService({
    DEVELOPER_HANDLES: 'Lattymoy,SirMcMobdon', MODERATOR_HANDLES: 'Asynian,Tabbyvish', OWNER_HANDLES: 'Lattymoy,SirMcMobdon',
    OWNER_KEYS: `SirMcMobdon:${mobKey.pub}`, RELAY_LAW_URL: RELAY,
  });
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => (String(url) === RELAY ? Response.json({ ok: true }) : real(url, init));
  const staff = async (path, body = {}, token = null) => {
    const res = await s.fetch(`https://accounts.invalid${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.1', ...(token ? { [STAFF_SESSION_HEADER]: token } : {}) }, body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const game = {};
  for (const h of ['SirMcMobdon', 'Asynian', 'Tabbyvish']) game[h] = await s.registered(h);
  const troll = await s.registered('Troll');
  const sylvia = await s.registered('Sylvia');
  const raw = s.env.DB._raw;
  raw.prepare('UPDATE players SET created_at = ? WHERE id = ?').run(nowS() - SPROUT_S - 60, sylvia.id);
  const mob = (await staff('/v1/staff/login', { handle: 'SirMcMobdon', password: PASSWORD, ...(await mobKey.proof('login', 'SirMcMobdon')) })).body;
  const enrol = async (handle) => {
    const inv = await staff('/v1/staff/invite', { handle }, mob.session);
    const key = await extensionKey();
    const r = await staff('/v1/staff/enroll', { handle, password: PASSWORD, invite: inv.body.invite, ...(await key.proof('enroll', handle)) });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body;
  };
  const asy = await enrol('Asynian');
  const tab = await enrol('Tabbyvish');
  let n = 0;
  /** An open case on `who`, laid in by hand as safety.js lays one, with a line and its reporters. */
  const caseOn = (who, { reports = [['harassment', 1, nowS()]], ...cols } = {}) => {
    const id = (++n).toString(16).padStart(16, 'c');
    const t = nowS();
    const row = { id, target: who.id, source: 'report', status: 'open', opened_at: t - 100 * n, updated_at: t, reports: reports.length, credible: reports.filter((r) => r[1]).length, ai_state: 'off', discord_state: 'off', ...cols };
    raw.prepare(`INSERT INTO mod_cases (${Object.keys(row).join(', ')}) VALUES (${Object.keys(row).map(() => '?').join(', ')})`).run(...Object.values(row));
    raw.prepare('INSERT INTO mod_case_lines (case_id, at, sub, name, tab, text) VALUES (?, ?, ?, ?, ?, ?)').run(id, t - 5, who.id, 'Troll', 'local', 'a line');
    reports.forEach(([reason, counted, at], i) => {
      const rep = `p_rep${n}x${i}`.padEnd(10, '0');
      raw.prepare('INSERT OR IGNORE INTO players (id, guest_name, created_at, last_seen) VALUES (?, ?, 1, 1)').run(rep, `Rep ${n} ${i}`);
      raw.prepare('INSERT INTO mod_reports (case_id, reporter, reason, at, counted, note) VALUES (?, ?, ?, ?, ?, ?)').run(id, rep, reason, at, counted, 'said so');
    });
    return id;
  };
  let m = 0;
  const player = async () => s.registered(`Target${++m}`);
  const counter = countTrips(s.env.DB);
  /** A door's answer and its trips. Every staff session was there just now, so none pays staff.js's once-a-minute
   *  `last_act` write (a slow machine's minute would otherwise add a trip to whichever door it fell on). */
  const trips = async (path, body, token) => {
    raw.prepare('UPDATE staff_sessions SET last_act = ?').run(nowS());
    counter.take();
    const r = token ? await staff(path, body, token) : await s.call(path, body, game.Asynian.secret);
    return { ...r, ...counter.take() };
  };
  return { ...s, raw, staff, trips, mob, asy, tab, troll, sylvia, caseOn, player, restore: () => { globalThis.fetch = real; } };
}


/** The game's own doors, a game session's: its lookup, the account, the case, then its lines and reports together (5
 *  before); the account, then its strikes and history together (4 before). */
const GAME_CASE_TRIPS = 4, GAME_STRIKES_TRIPS = 3;
/** The audit rows of `act` by the member signed in as `who`. */
const rowsOf = (s, who, act) => s.raw.prepare('SELECT COUNT(*) AS n FROM staff_audit a JOIN players p ON p.id = a.actor WHERE p.handle = ? AND a.act = ?').get(who, act).n;

test('STAFF-PANEL-SPEED: the open cases - urgent, newest and a later page - in 2 trips, where each was 5-6: the session, then one batch of the list\'s reads and its audit row (mutants: the batch awaited a statement at a time)', async () => {
  const s = await stand();
  try {
    const a = await s.player();
    s.caseOn(a, { reports: [['threat', 1, nowS()], ['threat', 1, nowS()]] });
    s.caseOn(s.troll);
    s.caseOn(s.sylvia, { kind: 'spawn' });
    assert.equal((await s.staff('/v1/staff/claim', { target: a.id }, s.asy.session)).status, 200);
    assert.equal((await s.staff('/v1/staff/claim', { target: a.id }, s.mob.session)).status, 200);   // taken from Asynian: her `lost`
    const urgent = await s.trips('/v1/staff/cases', {}, s.asy.session);
    assert.equal(urgent.status, 200, JSON.stringify(urgent.body));
    assert.deepEqual([urgent.body.cases.map((c) => c.target), urgent.body.total, urgent.body.high, urgent.body.lost.map((c) => [c.target, c.by])],
      [[a.id, s.troll.id], 2, 1, [[a.id, 'SirMcMobdon']]], 'a Moderator\'s chat cases, the high one first, and the case taken from her');
    assert.ok(urgent.trips <= 2, `urgent: ${urgent.trips} trips`);
    assert.equal(rowsOf(s, 'Asynian', 'cases-read'), 1, 'the page and its audit row together');
    const newest = await s.trips('/v1/staff/cases', { sort: 'newest' }, s.mob.session);
    assert.deepEqual(newest.body.cases.map((c) => c.target), [a.id, s.troll.id, s.sylvia.id], 'an Admin\'s every kind, newest first');
    assert.deepEqual(newest.body.cases[0].claim && [newest.body.cases[0].claim.mine, newest.body.cases[0].reasons], [true, ['threat']]);
    assert.ok(newest.trips <= 2, `newest: ${newest.trips} trips`);
    const later = await s.trips('/v1/staff/cases', { from: 25 }, s.mob.session);
    assert.deepEqual([later.body.cases, later.body.next, later.body.total, later.body.lost], [[], null, 3, []]);
    assert.ok(later.trips <= 2, `a later page: ${later.trips} trips`);
  } finally { s.restore(); }
});

test('STAFF-PANEL-SPEED: one case - its record, lines and reports, the holder\'s claim kept and the audit row - in 3 trips, where it was 13 (mutants: each fold undone)', async () => {
  const s = await stand();
  try {
    const id = s.caseOn(s.troll);
    assert.equal((await s.staff('/v1/staff/claim', { target: s.troll.id }, s.mob.session)).status, 200);
    s.raw.prepare('UPDATE mod_cases SET claim_until = ? WHERE id = ?').run(nowS() + 60, id);
    const one = await s.trips('/v1/staff/case', { target: s.troll.id }, s.mob.session);
    assert.equal(one.status, 200, JSON.stringify(one.body));
    assert.deepEqual([one.body.case.id, one.body.case.name, one.body.case.lines.map((l) => l.text), one.body.case.notes, one.body.record.target, one.body.claim.mine],
      [id, 'Troll', ['a line'], ['said so'], s.troll.id, true]);
    assert.ok(one.body.claim.until >= nowS() + CLAIM_S - 5, 'the holder\'s look kept the claim, and the answer reads it back');
    assert.equal(s.raw.prepare('SELECT claim_until FROM mod_cases WHERE id = ?').get(id).claim_until, one.body.claim.until);
    assert.equal(rowsOf(s, 'SirMcMobdon', 'case-read'), 1);
    assert.ok(one.trips <= 3, `a case: ${one.trips} trips`);
    const byName = await s.trips('/v1/staff/case', { name: 'Troll' }, s.asy.session);
    assert.deepEqual([byName.body.case.id, byName.body.claim.mine, byName.body.claim.name], [id, false, 'SirMcMobdon']);
    assert.ok(byName.trips <= 4, `a case by name: ${byName.trips} trips`);
    const strikes = await s.trips('/v1/staff/strikes', { target: s.troll.id }, s.asy.session);
    assert.deepEqual([strikes.body.case, strikes.body.record.strikes, strikes.body.claim.name], [undefined, 0, 'SirMcMobdon']);
    assert.ok(strikes.trips <= 3, `strikes: ${strikes.trips} trips`);
    const none = await s.trips('/v1/staff/case', { target: s.sylvia.id }, s.asy.session);
    assert.deepEqual([none.status, none.body], [404, { error: 'no-case' }]);
    assert.ok(none.trips <= 2, `no case: ${none.trips} trips`);
    // the game's own doors share the folds (safety.js modCase, sanctions.js strikesLook)
    const game = await s.trips('/v1/mod/case', { target: s.troll.id });
    assert.deepEqual([game.status, game.body.case.lines.length, game.body.case.notes], [200, 1, ['said so']]);
    assert.ok(game.trips <= GAME_CASE_TRIPS, `the game's case: ${game.trips} trips`);
    const look = await s.trips('/v1/mod/strikes', { target: s.troll.id });
    assert.deepEqual([look.status, look.body.strikes, look.body.history], [200, 0, []]);
    assert.ok(look.trips <= GAME_STRIKES_TRIPS, `the game's strikes: ${look.trips} trips`);
  } finally { s.restore(); }
});

test('STAFF-PANEL-SPEED: claim, release, Mute, Ban, Unban and Dismiss - the account and its open case read in one trip, a press\'s id and its case in one, and no claim kept on a case the act closed (mutants: each fold undone)', async () => {
  const s = await stand();
  try {
    const a = await s.player(), b = await s.player(), c = await s.player();
    const ca = s.caseOn(a), cb = s.caseOn(b), cc = s.caseOn(c);
    s.caseOn(s.troll);
    const claim = await s.trips('/v1/staff/claim', { target: a.id }, s.asy.session);
    assert.deepEqual([claim.body.ok, claim.body.case], [true, ca]);
    assert.ok(claim.trips <= 4, `claim: ${claim.trips} trips`);
    const deny = await s.trips('/v1/staff/claim', { target: b.id }, s.asy.session);
    assert.deepEqual(deny.body, { error: 'staff-one-case' });
    assert.ok(deny.trips <= 4, `claim refused: ${deny.trips} trips`);
    const release = await s.trips('/v1/staff/release', { target: a.id }, s.asy.session);
    assert.deepEqual(release.body, { ok: true, case: ca });
    assert.ok(release.trips <= 3, `release: ${release.trips} trips`);
    assert.equal((await s.staff('/v1/staff/claim', { target: a.id }, s.mob.session)).status, 200);
    const mute = await s.trips('/v1/staff/mute', { target: a.id, minutes: 30, click: 'press-1001' }, s.mob.session);
    assert.deepEqual([mute.body.ok, mute.body.case, s.raw.prepare('SELECT status FROM mod_cases WHERE id = ?').get(ca).status], [true, ca, 'actioned']);
    assert.ok(mute.trips <= 7, `mute: ${mute.trips} trips`);
    const again = await s.trips('/v1/staff/mute', { target: a.id, minutes: 30, click: 'press-1001' }, s.mob.session);
    assert.deepEqual([again.body.ok, again.body.repeat], [true, true], 'the same press sent twice is the first');
    const ban = await s.trips('/v1/staff/ban', { target: b.id, days: 3, reason: 'spam', click: 'press-1002' }, s.mob.session);
    assert.deepEqual([ban.body.ok, ban.body.case], [true, cb]);
    assert.ok(ban.trips <= 7, `ban: ${ban.trips} trips`);
    const unban = await s.trips('/v1/staff/unban', { target: b.id }, s.mob.session);
    assert.deepEqual([unban.body.ok, unban.body.until], [true, 0]);
    assert.ok(unban.trips <= 5, `unban: ${unban.trips} trips`);
    const dismiss = await s.trips('/v1/staff/dismiss', { target: c.id }, s.asy.session);
    assert.deepEqual([dismiss.body.ok, dismiss.body.case], [true, cc]);
    assert.ok(dismiss.trips <= 7, `dismiss: ${dismiss.trips} trips`);
    // a lift closes no case: the holder's act keeps the claim, as it did
    assert.equal((await s.staff('/v1/staff/claim', { target: s.troll.id }, s.mob.session)).status, 200);
    const tc = s.raw.prepare("SELECT id FROM mod_cases WHERE target = ? AND status = 'open' AND claimed_by IS NOT NULL").get(s.troll.id).id;
    s.raw.prepare('UPDATE mod_cases SET claim_until = ? WHERE id = ?').run(nowS() + 60, tc);
    const lift = await s.trips('/v1/staff/mute', { target: s.troll.id, minutes: 0, click: 'press-1003' }, s.mob.session);
    assert.deepEqual([lift.body.ok, lift.body.case], [true, undefined]);
    assert.ok(s.raw.prepare('SELECT claim_until FROM mod_cases WHERE id = ?').get(tc).claim_until >= nowS() + CLAIM_S - 5, 'the claim kept');
    assert.ok(lift.trips <= 7, `a lift: ${lift.trips} trips`);
  } finally { s.restore(); }
});
