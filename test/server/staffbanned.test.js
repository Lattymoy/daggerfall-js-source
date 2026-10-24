// STAFF-BANNED (2026-10-23, mob: "player that are banned need to be taken out of staff panel list of players we need a
// tab for banned players as well", "add a ban status as well to player list", "so we can filter them") - THE PLAYERS
// LIST'S BAN STATUS AND FILTER (server-account/src/staffPlayers.js /v1/staff/players `ban`) and THE BANNED TAB
// (server-account/src/staffCases.js /v1/staff/banned), driven through the real Worker on the node:sqlite database every
// account pin stands on (test/accountDb.mjs): a banned account out of the list unless asked for, a lapsed ban none, the
// cursor paging the filtered list, the Banned tab's rows, order, cursor and Unban, its audit row, and both reads on
// migration 0164's index.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { staffWords, STAFF_SESSION_HEADER } from '../../server-account/src/staff.js';
import { PLAYERS_PAGE, BAN_FILTERS } from '../../server-account/src/staffPlayers.js';
import { CASE_ROUTES, CASES_PAGE } from '../../server-account/src/staffCases.js';
import { STAFF_ROUTES } from '../../server-account/src/service.js';
import { BAN_FOREVER } from '../../src/net/safety/safetyLaw.js';
import { PLAY_GRACE_S } from '../../src/net/playClock.js';
import { countTrips } from './staffTrips.mjs';

const { subtle } = globalThis.crypto;
const enc = new TextEncoder();
const nowS = () => Math.floor(Date.now() / 1000);
const PASSWORD = 'a good long one';
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

/** The Worker with the panel set up: mob (an Admin and owner) and Asynian (a Moderator) signed in. `player(handle, cols)`
 *  lays an account in by hand (a handle, or a guest's name with `handle: null`), its ban among `cols`. */
async function stand() {
  const mobKey = await extensionKey();
  const s = await standService({ DEVELOPER_HANDLES: 'SirMcMobdon', MODERATOR_HANDLES: 'Asynian', OWNER_HANDLES: 'SirMcMobdon', OWNER_KEYS: `SirMcMobdon:${mobKey.pub}` });
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
  assert.ok(asy.session && mob.session);
  const raw = s.env.DB._raw;
  let n = 0;
  const player = (handle, cols = {}) => {
    const row = { id: `pb${String(++n).padStart(6, '0')}`, guest_name: `Guest ${n}`, handle, handle_lc: handle?.toLowerCase() ?? null, created_at: 1, last_seen: 1, ...cols };
    raw.prepare(`INSERT INTO players (${Object.keys(row).join(', ')}) VALUES (${Object.keys(row).map(() => '?').join(', ')})`).run(...Object.values(row));
    return row;
  };
  const idOf = (h) => raw.prepare('SELECT id FROM players WHERE handle = ?').get(h).id;
  const audits = (act) => raw.prepare('SELECT detail, role FROM staff_audit WHERE act = ? ORDER BY id').all(act).map((r) => ({ ...r }));
  return { ...s, raw, staff, mob, asy, player, idOf, audits };
}

/** Every page of a list, its cursor handed back as the panel's scroller hands it. */
async function pages(s, path, body, token) {
  const out = [];
  let from = null;
  for (let i = 0; i < 20; i++) {
    const r = await s.staff(path, { ...body, ...(from ? { from } : {}) }, token);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    out.push(r.body);
    from = r.body.next;
    if (from == null) return out;
  }
  throw new Error('no end to the pages');
}

test('STAFF-BANNED: the doors are listed among the staff panel\'s, and the Banned tab opens to a staff session alone', async () => {
  assert.ok(CASE_ROUTES.includes('/v1/staff/banned') && STAFF_ROUTES.has('/v1/staff/banned'));
  assert.deepEqual(BAN_FILTERS, ['not-banned', 'banned', 'all']);
  const s = await stand();
  const troll = await s.registered('Troll');
  assert.deepEqual([(await s.staff('/v1/staff/banned', {})).status, (await s.staff('/v1/staff/banned', {}, troll.secret)).status], [401, 401], 'no session; a game secret is none');
});

test('STAFF-BANNED: THE PLAYERS LIST says each ban - none, until when, for good - and leaves the banned out unless asked; a lapsed ban is none (mutants: the default; the filter; the lapsed; the status; the clocks\' order; the view)', async () => {
  const s = await stand();
  const t = nowS();
  const mobId = s.idOf('SirMcMobdon');
  s.player('Alpha');
  s.player('Bravo', { banned_until: t + 3600, ban_reason: 'spam', banned_by: mobId });
  s.player('Charlie', { banned_until: BAN_FOREVER, ban_reason: 'cheating', banned_by: mobId });
  s.player('Delta', { banned_until: t - 100, ban_reason: 'old', banned_by: mobId });   // lapsed
  const list = async (body) => {
    const r = await s.staff('/v1/staff/players', body, s.mob.session);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.players.map((p) => [p.handle, p.banned, p.bannedUntil, p.banForever]);
  };
  const free = (h) => [h, false, 0, false];
  assert.deepEqual(await list({}), [free('Alpha'), free('Asynian'), free('Delta'), free('SirMcMobdon')], 'not banned by default: Delta\'s ban lapsed');
  assert.deepEqual(await list({ ban: 'not-banned' }), await list({}));
  assert.deepEqual(await list({ ban: 'nonsense' }), await list({}), 'a filter it does not know is the default');
  assert.deepEqual(await list({ ban: 'banned' }), [['Bravo', true, t + 3600, false], ['Charlie', true, BAN_FOREVER, true]], 'until when, and for good');
  assert.deepEqual(await list({ ban: 'all' }), [free('Alpha'), free('Asynian'), ['Bravo', true, t + 3600, false], ['Charlie', true, BAN_FOREVER, true], free('Delta'), free('SirMcMobdon')]);
  // with the name search
  assert.deepEqual(await list({ q: 'b' }), [], 'Bravo is banned');
  assert.deepEqual(await list({ q: 'b', ban: 'banned' }), [['Bravo', true, t + 3600, false]]);
  // with "online now": the ban's clock and the play clock each in its own place
  s.raw.prepare('UPDATE players SET played_at = ? WHERE handle IN (?, ?)').run(t - 10, 'Alpha', 'Bravo');
  s.raw.prepare('UPDATE players SET played_at = ? WHERE handle = ?').run(t - PLAY_GRACE_S - 60, 'Charlie');
  assert.deepEqual((await list({ online: true })).map((r) => r[0]), ['Alpha']);
  assert.deepEqual((await list({ online: true, ban: 'banned' })).map((r) => r[0]), ['Bravo']);
  assert.deepEqual((await list({ online: true, ban: 'all' })).map((r) => r[0]), ['Alpha', 'Bravo']);
  // each filter its own view in the audit log; its pages none
  assert.deepEqual(s.audits('players-search').map((a) => JSON.parse(a.detail).ban), ['not-banned', 'banned', 'all', 'not-banned', 'banned', 'not-banned', 'banned', 'all']);
});

test('STAFF-BANNED: THE CURSOR PAGES THE FILTERED LIST - each account once, none skipped, a ban laid or lifted between two pages moving no other row (mutants: the filter after the cut)', async () => {
  const s = await stand();
  const t = nowS();
  const made = [];
  for (let i = 0; i < 60; i++) made.push(s.player(`P${String(i).padStart(2, '0')}`, i % 2 ? { banned_until: t + 600 + i } : {}));
  const handles = (ps) => ps.flatMap((p) => p.players.map((x) => x.handle));
  const free = await pages(s, '/v1/staff/players', {}, s.mob.session);
  const banned = await pages(s, '/v1/staff/players', { ban: 'banned' }, s.mob.session);
  const every = await pages(s, '/v1/staff/players', { ban: 'all' }, s.mob.session);
  assert.deepEqual(handles(free), [...made.filter((_, i) => !(i % 2)).map((p) => p.handle), 'Asynian', 'SirMcMobdon'].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
  assert.deepEqual(handles(banned), made.filter((_, i) => i % 2).map((p) => p.handle));
  assert.deepEqual([free.length, banned.length, every.length], [2, 2, 3], 'pages of PLAYERS_PAGE');
  assert.ok(free[0].players.length === PLAYERS_PAGE && banned[0].players.length === PLAYERS_PAGE);
  assert.equal(handles(every).length, 62);
  // between two pages: a ban laid on an account the second page holds, and one lifted on the first's
  const p1 = await s.staff('/v1/staff/players', {}, s.mob.session);
  s.raw.prepare('UPDATE players SET banned_until = ? WHERE handle = ?').run(t + 600, 'P56');
  s.raw.prepare('UPDATE players SET banned_until = NULL WHERE handle = ?').run('P01');
  const p2 = await s.staff('/v1/staff/players', { from: p1.body.next }, s.mob.session);
  const seen = [...p1.body.players, ...p2.body.players].map((p) => p.handle);
  assert.equal(new Set(seen).size, seen.length, 'no account twice');
  assert.deepEqual(seen.filter((h) => h !== 'P56'), handles(free).filter((h) => h !== 'P56'), 'every other account where it was: none skipped');
  assert.ok(!seen.includes('P56') && !seen.includes('P01'), 'the newly banned left; the unbanned was behind the cursor');
});

test('STAFF-BANNED: SERVER LOAD - the banned filter and the Banned tab read migration 0164\'s index, never a walk of every account (mutants: the index; the filter beside the handle\'s range)', async () => {
  const s = await stand();
  const t = nowS();
  for (let i = 0; i < 40; i++) s.player(`L${String(i).padStart(2, '0')}`, i === 7 ? { banned_until: t + 600 } : {});
  const seen = [];
  const prepare = s.env.DB.prepare.bind(s.env.DB);
  s.env.DB.prepare = (sql) => { const st = prepare(sql); const bind = st.bind.bind(st); st.bind = (...a) => { seen.push([sql, a]); return bind(...a); }; return st; };
  await s.staff('/v1/staff/players', { ban: 'banned' }, s.mob.session);
  await s.staff('/v1/staff/banned', {}, s.mob.session);
  await s.staff('/v1/staff/banned', { sort: 'newest' }, s.mob.session);
  s.env.DB.prepare = prepare;
  const plan = ([sql, a]) => s.raw.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...a).map((r) => r.detail).join(' | ');
  const reads = seen.filter(([sql]) => /banned_until >/.test(sql));
  assert.equal(reads.length, 3);
  for (const r of reads) {
    const p = plan(r);
    assert.match(p, /players_banned/, p);
    assert.doesNotMatch(p, /SCAN (players|p)\b/, p);
  }
});

test('STAFF-BANNED: THE BANNED TAB - every account banned now, a guest too, with until when, the reason, who banned it and whether an Admin did; most urgent first (the soonest back), newest the switch; its Unban the panel\'s (mutants: the lapsed; each field; each order)', async () => {
  const s = await stand();
  const t = nowS();
  const bravo = await s.registered('Bravo');
  const charlie = await s.registered('Charlie');
  const troll = await s.guest();
  s.player('Delta', { banned_until: t - 100, ban_reason: 'old' });   // lapsed
  const echo = s.player('Echo', { banned_until: t + 30 * 86400 });   // a ban laid by hand: no act, no setter
  const ban = async (target, days, reason, token, click) => {
    const r = await s.staff('/v1/staff/ban', { target, days, reason, click }, token);
    assert.equal(r.status, 200, JSON.stringify(r.body));
  };
  await ban(bravo.id, 7, 'spam', s.asy.session, 'press-b001');
  await ban(charlie.id, 0, 'cheating', s.mob.session, 'press-b002');
  await ban(troll.id, 1, 'slurs', s.asy.session, 'press-b003');
  // the acts a second apart, the troll's first
  for (const [id, at] of [[troll.id, t - 300], [bravo.id, t - 200], [charlie.id, t - 100]]) s.raw.prepare("UPDATE mod_actions SET at = ? WHERE target = ? AND kind = 'ban'").run(at, id);
  // when the ban was laid is its newest ban act: never an older ban, never another kind of act
  s.raw.prepare("INSERT INTO mod_actions (target, kind, until, actor, at) VALUES (?, 'ban', ?, ?, ?)").run(charlie.id, t - 900, s.idOf('Asynian'), t - 1000);
  s.raw.prepare("INSERT INTO mod_actions (target, kind, until, actor, at) VALUES (?, 'mute', ?, ?, ?)").run(troll.id, t + 600, s.idOf('Asynian'), t - 10);
  const asyId = s.idOf('Asynian'), mobId = s.idOf('SirMcMobdon');
  const r = await s.staff('/v1/staff/banned', {}, s.asy.session);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.sort, 'urgent');
  assert.equal(r.body.next, null);
  const [g, b, e, c] = r.body.banned;
  assert.deepEqual(r.body.banned.map((x) => x.id), [troll.id, bravo.id, echo.id, charlie.id], 'the soonest back first, for good last; the lapsed none');
  assert.ok(g.bannedUntil >= t + 86400 && g.bannedUntil <= nowS() + 86400 && b.bannedUntil >= t + 7 * 86400 && b.bannedUntil <= nowS() + 7 * 86400);
  const guestName = s.raw.prepare('SELECT guest_name FROM players WHERE id = ?').get(troll.id).guest_name;
  assert.deepEqual({ ...g, bannedUntil: 0 }, { id: troll.id, name: guestName, handle: null, bannedUntil: 0, banForever: false, banReason: 'slurs', bannedBy: { id: asyId, name: 'Asynian' }, bannedAt: t - 300, banAdmin: false });
  assert.ok(guestName.length > 0, 'a guest by its generated name');
  assert.deepEqual({ ...b, bannedUntil: 0 }, { id: bravo.id, name: 'Bravo', handle: 'Bravo', bannedUntil: 0, banForever: false, banReason: 'spam', bannedBy: { id: asyId, name: 'Asynian' }, bannedAt: t - 200, banAdmin: false });
  assert.deepEqual(c, { id: charlie.id, name: 'Charlie', handle: 'Charlie', bannedUntil: BAN_FOREVER, banForever: true, banReason: 'cheating', bannedBy: { id: mobId, name: 'SirMcMobdon' }, bannedAt: t - 100, banAdmin: true });
  assert.deepEqual(e, { id: echo.id, name: 'Echo', handle: 'Echo', bannedUntil: t + 30 * 86400, banForever: false, banReason: null, bannedBy: null, bannedAt: null, banAdmin: false });
  // the switch back: the newest ban first, one with no act last
  const newest = await s.staff('/v1/staff/banned', { sort: 'newest' }, s.mob.session);
  assert.deepEqual([newest.body.sort, newest.body.banned.map((x) => x.id)], ['newest', [charlie.id, bravo.id, troll.id, echo.id]]);
  // Unban from the tab, the panel's own: a Moderator's ban lifted by a Moderator; an Admin's by an Admin alone (banAdmin)
  assert.equal((await s.staff('/v1/staff/unban', { target: bravo.id }, s.asy.session)).status, 200);
  assert.deepEqual(await s.staff('/v1/staff/unban', { target: charlie.id }, s.asy.session).then((x) => [x.status, x.body]), [403, { error: 'admin-sanction' }]);
  assert.equal((await s.staff('/v1/staff/unban', { target: charlie.id }, s.mob.session)).status, 200);
  assert.deepEqual((await s.staff('/v1/staff/banned', {}, s.asy.session)).body.banned.map((x) => x.id), [troll.id, echo.id], 'the unbanned leave the tab');
});

test('STAFF-BANNED: THE BANNED TAB PAGES BY ITS CURSOR in either order - each ban once, in order, a tie by the account, none skipped when a ban is laid between pages (mutants: the cursor\'s side; the page)', async () => {
  const s = await stand();
  const t = nowS();
  const made = [];
  for (let i = 0; i < 2 * CASES_PAGE + 5; i++) {
    const p = s.player(`B${String(i).padStart(2, '0')}`, { banned_until: i % 9 === 0 ? BAN_FOREVER : t + 1000 + (i % 7) * 60 });
    s.raw.prepare("INSERT INTO mod_actions (target, kind, until, actor, at) VALUES (?, 'ban', ?, ?, ?)").run(p.id, p.banned_until, s.idOf('Asynian'), t - (i % 5) * 60);
    made.push({ ...p, at: t - (i % 5) * 60 });
  }
  const byUntil = [...made].sort((a, b) => a.banned_until - b.banned_until || (a.id < b.id ? -1 : 1)).map((p) => p.id);
  const byNewest = [...made].sort((a, b) => b.at - a.at || (a.id < b.id ? 1 : -1)).map((p) => p.id);
  for (const [sort, want] of [['urgent', byUntil], ['newest', byNewest]]) {
    const got = await pages(s, '/v1/staff/banned', { sort }, s.asy.session);
    assert.deepEqual(got.map((p) => p.banned.length), [CASES_PAGE, CASES_PAGE, 5], sort);
    assert.deepEqual(got.flatMap((p) => p.banned.map((x) => x.id)), want, `${sort}: each once, in order`);
  }
  // a ban laid between two pages, sorting before the cursor: the next page moves on, nothing repeated or skipped
  const p1 = await s.staff('/v1/staff/banned', {}, s.asy.session);
  const late = s.player('Late', { banned_until: t + 500 });
  const p2 = await s.staff('/v1/staff/banned', { from: p1.body.next }, s.asy.session);
  assert.deepEqual(p2.body.banned.map((x) => x.id), byUntil.slice(CASES_PAGE, 2 * CASES_PAGE));
  assert.ok(!p2.body.banned.some((x) => x.id === late.id));
  // a cursor of no shape is the first page
  assert.deepEqual((await s.staff('/v1/staff/banned', { from: 'nonsense' }, s.asy.session)).body.banned[0].id, late.id);
});

test('STAFF-BANNED: THE BANNED TAB IS WRITTEN DOWN once in ten minutes a member and an order, in the read\'s own trip (mutants: the row; once; a trip after)', async () => {
  const s = await stand();
  const t = nowS();
  for (let i = 0; i < CASES_PAGE + 3; i++) s.player(`W${String(i).padStart(2, '0')}`, { banned_until: t + 600 + i });
  const real = { prepare: s.env.DB.prepare, batch: s.env.DB.batch };
  const c = countTrips(s.env.DB);
  const first = await s.staff('/v1/staff/banned', {}, s.mob.session);
  const trips = c.take().trips;
  Object.assign(s.env.DB, real);
  assert.equal(first.status, 200);
  assert.ok(trips <= 2, `${trips} trips: the session's, then the read with its row`);
  await s.staff('/v1/staff/banned', { from: first.body.next }, s.mob.session);
  await s.staff('/v1/staff/banned', {}, s.mob.session);
  await s.staff('/v1/staff/banned', { sort: 'newest' }, s.mob.session);
  await s.staff('/v1/staff/banned', {}, s.asy.session);
  assert.deepEqual(s.audits('banned-read').map((a) => [a.role, JSON.parse(a.detail).sort]), [['admin', 'urgent'], ['admin', 'newest'], ['moderator', 'urgent']]);
});
