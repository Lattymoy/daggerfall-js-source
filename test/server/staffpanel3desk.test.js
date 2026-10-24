// STAFF-PANEL3-DESK (2026-10-22, mob picked these at 04:13Z, Moderators' share at 06:28Z; design doc "DFO Staff Panel:
// design") - THE PANEL'S DESK (server-account/src/staffDesk.js), driven through the real Worker on the node:sqlite database
// every account pin stands on (test/accountDb.mjs): staff notes, each member's own watchlist and its events, Your settings,
// and the Admins' server notice, AI check scorecard and reported board notes and market listings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { staffWords, STAFF_SESSION_HEADER } from '../../server-account/src/staff.js';
import {
  DESK_ROUTES, HOME_WATCH, STAFF_NOTES_PAGE, STAFF_NOTES_KEEP, STAFF_NOTE_MAX, STAFF_WATCH_MAX, WATCH_WINDOW_S, WATCH_PAGE, WATCH_BIG_GOLD, WATCH_BIG_MARKS,
  STAFF_SETTINGS_BYTES, AI_SCORE_DAYS_MAX, REPORTED_PAGE, settingsOf,
} from '../../server-account/src/staffDesk.js';
import { STAFF_ROUTES } from '../../server-account/src/service.js';
import { REALM_PLAYING_S } from '../../server-account/src/realm.js';
import { NOTICE_DAYS_MAX } from '../../src/net/boardLaw.js';

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

/** The Worker with the panel set up: mob (an Admin and owner) and Asynian (a Moderator) signed in, and Troll and Sylvia. */
async function stand() {
  const mobKey = await extensionKey();
  const s = await standService({
    DEVELOPER_HANDLES: 'Lattymoy,SirMcMobdon', MODERATOR_HANDLES: 'Asynian,Tabbyvish', OWNER_HANDLES: 'Lattymoy,SirMcMobdon', OWNER_KEYS: `SirMcMobdon:${mobKey.pub}`, BOARD_OPEN: 'on',
  });
  const staff = async (path, body = {}, token = null) => {
    const res = await s.fetch(`https://accounts.invalid${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.1', ...(token ? { [STAFF_SESSION_HEADER]: token } : {}) }, body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  for (const h of ['SirMcMobdon', 'Asynian']) await s.registered(h);
  const troll = await s.registered('Troll');
  const sylvia = await s.registered('Sylvia');
  const raw = s.env.DB._raw;
  const mob = (await staff('/v1/staff/login', { handle: 'SirMcMobdon', password: PASSWORD, ...(await mobKey.proof('login', 'SirMcMobdon')) })).body;
  const inv = await staff('/v1/staff/invite', { handle: 'Asynian' }, mob.session);
  const key = await extensionKey();
  const asy = (await staff('/v1/staff/enroll', { handle: 'Asynian', password: PASSWORD, invite: inv.body.invite, ...(await key.proof('enroll', 'Asynian')) })).body;
  assert.ok(asy.session);
  const idOf = (h) => raw.prepare('SELECT id FROM players WHERE handle = ?').get(h).id;
  const audits = (act) => raw.prepare('SELECT actor_name, role, act, target, detail, outcome FROM staff_audit WHERE act = ? ORDER BY id').all(act).map((r) => ({ ...r }));
  let n = 0;
  const insert = (table, row) => raw.prepare(`INSERT INTO ${table} (${Object.keys(row).join(', ')}) VALUES (${Object.keys(row).map(() => '?').join(', ')})`).run(...Object.values(row));
  /** A realm character of `who`'s, its seat taken `ago` seconds back (null: no seat). */
  const character = (who, ago = null) => {
    const id = `r${(++n).toString(16).padStart(20, '0')}`;
    insert('realm_characters', { id, player: who.id, name: `${who.handle} ${n}`, created_at: 1, updated_at: 1, lease: ago === null ? null : `lease${n}`, lease_at: ago === null ? 0 : nowS() - ago });
    return id;
  };
  /** A chat case on `who` with one report `ago` seconds back, or a reviewer's case. */
  const caseOn = (who, { ago = 10, reason = 'harassment', source = 'report', ...cols } = {}) => {
    const id = `case${(++n).toString(16).padStart(12, '0')}`;
    insert('mod_cases', { id, target: who.id, source, status: 'open', opened_at: nowS() - ago, updated_at: nowS() - ago, reports: source === 'report' ? 1 : 0, credible: 0, ai_state: 'off', discord_state: 'off', ...cols });
    if (source === 'report') insert('mod_reports', { case_id: id, reporter: s.sylviaId ?? sylvia.id, reason, at: nowS() - ago, counted: 1 });
    return id;
  };
  return { ...s, raw, staff, mob, asy, troll, sylvia, idOf, audits, insert, character, caseOn };
}

test('STAFF-PANEL3-DESK: the desk\'s doors are the staff panel\'s, none opens without a staff session, and a Moderator is refused the Admins\' (mutant: the role check)', async () => {
  for (const r of DESK_ROUTES) assert.ok(STAFF_ROUTES.has(r), r);
  const s = await stand();
  for (const r of DESK_ROUTES) {
    assert.deepEqual(await s.staff(r, { target: s.troll.id }), { status: 401, body: { error: 'staff-session' } }, r);
    assert.equal((await s.staff(r, { target: s.troll.id }, s.troll.secret)).status, 401, `${r}: a game secret is no staff session`);
  }
  for (const r of ['/v1/staff/notice', '/v1/staff/ai-score', '/v1/staff/board/reported', '/v1/staff/board/moderate', '/v1/staff/market/reported']) {
    assert.deepEqual(await s.staff(r, { id: 'x'.repeat(16), act: 'remove', days: 1, subject: 'a', body: 'b', rid: 'rid-00001' }, s.asy.session), { status: 403, body: { error: 'staff-admin' } }, r);
  }
  const refused = s.audits('refused');
  assert.equal(refused.length, 5);
  assert.deepEqual(refused.map((r) => [r.role, r.outcome, JSON.parse(r.detail).need]), Array(5).fill(['moderator', 'denied', 'admin']));
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM board_notices').get().n, 0, 'nothing posted');
});

test('STAFF-PANEL3-DESK: STAFF NOTES - a Moderator adds, every staff member reads newest first and paged, the words bounded and never in the audit log, the newest STAFF_NOTES_KEEP kept (mutants: the bound; the trim; the order)', async () => {
  const s = await stand();
  const add = await s.staff('/v1/staff/notes/add', { name: 'troll', text: '  warned in person 21 Oct\n' }, s.asy.session);
  assert.equal(add.status, 200, JSON.stringify(add.body));
  assert.deepEqual({ ...add.body.note, id: 0, at: 0 }, { id: 0, at: 0, by: s.idOf('Asynian'), byName: 'Asynian', text: 'warned in person 21 Oct' });
  await s.staff('/v1/staff/notes/add', { target: s.troll.id, text: 'second' }, s.mob.session);
  const read = await s.staff('/v1/staff/notes', { target: s.troll.id }, s.asy.session);
  assert.equal(read.status, 200);
  assert.deepEqual(read.body.notes.map((x) => [x.text, x.byName]), [['second', 'SirMcMobdon'], ['warned in person 21 Oct', 'Asynian']]);
  assert.equal(read.body.next, null);
  assert.equal(read.body.name, 'Troll');
  // the words: a string, 1 to STAFF_NOTE_MAX after trimming
  for (const text of ['', '   ', 7, 'x'.repeat(STAFF_NOTE_MAX + 1)]) {
    assert.deepEqual(await s.staff('/v1/staff/notes/add', { target: s.troll.id, text }, s.asy.session), { status: 400, body: { error: 'note-text' } }, JSON.stringify(text));
  }
  assert.equal((await s.staff('/v1/staff/notes/add', { target: s.troll.id, text: 'x'.repeat(STAFF_NOTE_MAX) }, s.asy.session)).status, 200);
  assert.equal((await s.staff('/v1/staff/notes', { name: 'nobody-at-all' }, s.asy.session)).status, 404);
  // the log: the act and its target, never the note's words; the read once a member in ten minutes
  const adds = s.audits('note-add');
  // STAFF-PANEL3-DESK FIX: a refused note is written down failed, its word and never its words
  assert.deepEqual(adds.map((a) => a.outcome), ['ok', 'ok', 'failed', 'failed', 'failed', 'failed', 'ok']);
  assert.ok(adds.every((a) => a.target === s.troll.id && a.detail === JSON.stringify(a.outcome === 'ok' ? { name: 'Troll' } : { name: 'Troll', error: 'note-text' })));
  await s.staff('/v1/staff/notes', { target: s.troll.id }, s.asy.session);
  assert.equal(s.audits('notes-read').length, 1);
  // paged by `before`
  for (let i = 0; i < STAFF_NOTES_PAGE; i++) s.insert('staff_notes', { target: s.troll.id, author: s.idOf('Asynian'), author_name: 'Asynian', text: `n${i}`, at: nowS() });
  const p1 = await s.staff('/v1/staff/notes', { target: s.troll.id }, s.mob.session);
  assert.equal(p1.body.notes.length, STAFF_NOTES_PAGE);
  assert.equal(p1.body.notes[0].text, `n${STAFF_NOTES_PAGE - 1}`, 'newest first');
  const p2 = await s.staff('/v1/staff/notes', { target: s.troll.id, before: p1.body.next }, s.mob.session);
  assert.deepEqual(p2.body.notes.map((x) => x.text), ['x'.repeat(STAFF_NOTE_MAX), 'second', 'warned in person 21 Oct']);
  assert.equal(p2.body.next, null);
  // the retention: the newest STAFF_NOTES_KEEP a player, the oldest out; another player's untouched
  await s.staff('/v1/staff/notes/add', { target: s.sylvia.id, text: 'hers' }, s.mob.session);
  for (let i = 0; i < STAFF_NOTES_KEEP; i++) s.insert('staff_notes', { target: s.troll.id, author: 'x', author_name: 'x', text: `old${i}`, at: 1 });
  await s.staff('/v1/staff/notes/add', { target: s.troll.id, text: 'newest' }, s.mob.session);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM staff_notes WHERE target = ?').get(s.troll.id).n, STAFF_NOTES_KEEP);
  assert.equal(s.raw.prepare('SELECT text FROM staff_notes WHERE target = ? ORDER BY id DESC LIMIT 1').get(s.troll.id).text, 'newest');
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM staff_notes WHERE text = 'second'").get().n, 0, 'the oldest went');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM staff_notes WHERE target = ?').get(s.sylvia.id).n, 1);
});

test('STAFF-PANEL3-DESK: THE WATCHLIST - each member\'s own, added once, bounded in the statement that writes, removed, and every change written down (mutants: the bound; whose list)', async () => {
  const s = await stand();
  const add = await s.staff('/v1/staff/watch/add', { name: 'Troll' }, s.asy.session);
  assert.deepEqual(add, { status: 200, body: { ok: true, sub: s.troll.id, name: 'Troll' } });
  assert.deepEqual((await s.staff('/v1/staff/watch/add', { target: s.troll.id }, s.asy.session)).body, { ok: true, sub: s.troll.id, name: 'Troll', repeat: true });
  await s.staff('/v1/staff/watch/add', { target: s.sylvia.id }, s.mob.session);
  const mine = await s.staff('/v1/staff/watch', {}, s.asy.session);
  assert.deepEqual(mine.body.watch.map((w) => w.name), ['Troll'], 'Asynian\'s own, not mob\'s');
  assert.equal(mine.body.max, STAFF_WATCH_MAX);
  assert.deepEqual((await s.staff('/v1/staff/watch', {}, s.mob.session)).body.watch.map((w) => w.name), ['Sylvia']);
  // the bound
  for (let i = s.raw.prepare('SELECT COUNT(*) AS n FROM staff_watch WHERE staff = ?').get(s.idOf('Asynian')).n; i < STAFF_WATCH_MAX; i++) {
    const p = await s.registered(`Watched${i}`);
    s.insert('staff_watch', { staff: s.idOf('Asynian'), target: p.id, at: nowS() });
  }
  assert.deepEqual(await s.staff('/v1/staff/watch/add', { target: s.sylvia.id }, s.asy.session), { status: 409, body: { error: 'watch-full' } });
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM staff_watch WHERE staff = ?').get(s.idOf('Asynian')).n, STAFF_WATCH_MAX);
  // removed, then not there to remove
  assert.equal((await s.staff('/v1/staff/watch/remove', { target: s.troll.id }, s.asy.session)).status, 200);
  assert.deepEqual(await s.staff('/v1/staff/watch/remove', { target: s.troll.id }, s.asy.session), { status: 404, body: { error: 'not-watched' } });
  assert.equal((await s.staff('/v1/staff/watch/add', { target: s.sylvia.id }, s.asy.session)).status, 200, 'room again');
  assert.deepEqual(s.audits('watch-add').map((a) => a.outcome), ['ok', 'ok', 'failed', 'ok'], 'the repeat writes nothing; the full list is a failed act');
  assert.deepEqual(s.audits('watch-remove').map((a) => a.outcome), ['ok', 'failed']);
  assert.equal((await s.staff('/v1/staff/watch/add', { name: 'nobody-at-all' }, s.asy.session)).status, 404);
});

test('STAFF-PANEL3-DESK: THE WATCH\'S EVENTS - who is playing now, chat reports for everyone; findings, the reviewer\'s cases, big trades and sales for an Admin alone; a day back at most, newest first, paged on one pinned set (mutants: the Moderator\'s share; each threshold; the window)', async () => {
  const s = await stand();
  const t = nowS();
  for (const who of [s.mob, s.asy]) {
    await s.staff('/v1/staff/watch/add', { target: s.troll.id }, who.session);
  }
  const trollChar = s.character(s.troll, 30);   // playing now
  s.character(s.sylvia, 30);   // playing, unwatched
  s.character(s.troll, null);
  s.caseOn(s.troll, { ago: 50, reason: 'hate' });
  s.caseOn(s.sylvia, { ago: 40 });   // unwatched
  s.raw.prepare("UPDATE mod_cases SET status = 'actioned' WHERE target = ?").run(s.troll.id);
  s.caseOn(s.troll, { ago: 60, source: 'review' });
  s.insert('realm_findings', { player: s.troll.id, char_id: trollChar, seq: 1, at: t - 70, law: 1, kind: 'law', detail: '{}' });
  s.insert('realm_findings', { player: s.troll.id, char_id: trollChar, seq: 2, at: t - WATCH_WINDOW_S - 5, law: 1, kind: 'law', detail: '{}' });   // past the day
  const trade = (sid, ago, ga, gb, b = s.sylvia.id) => s.insert('realm_trades', { sid, a_player: s.troll.id, a_char: trollChar, a_lease: 'l', a_seq: 1, a_half: '{}', b_player: b, b_char: 'c', b_seq: 1,
    state: 'done', result: JSON.stringify({ a: { seq: 2, items: [], gold: ga }, b: { seq: 2, items: [{}, {}], gold: gb } }), created_at: t - ago });
  trade('trade-big', 80, WATCH_BIG_GOLD - 1, 1);
  trade('trade-small', 81, WATCH_BIG_GOLD - 2, 1);
  const sale = (rid, ago, total, currency, seller = s.troll.id, buyer = s.sylvia.id) => s.insert('market_sales', { buyer, rid, char_id: 'c', listing: 'l', seller, kind: 'material', material: 'iron',
    units: 3, price: 1, total, tax: 0, from_region: 1, to_region: 1, arrives_at: t, at: t - ago, day: 1, n: 'n', currency });
  sale('sale-gold', 90, WATCH_BIG_GOLD, 'gold');
  sale('sale-gold-small', 91, WATCH_BIG_GOLD - 1, 'gold');
  sale('sale-marks', 92, WATCH_BIG_MARKS, 'marks', s.sylvia.id, s.troll.id);
  sale('sale-marks-small', 93, WATCH_BIG_MARKS - 1, 'marks', s.sylvia.id, s.troll.id);

  const admin = await s.staff('/v1/staff/watch/events', {}, s.mob.session);
  assert.equal(admin.status, 200, JSON.stringify(admin.body));
  assert.deepEqual(admin.body.online.map((o) => o.name), ['Troll']);
  assert.deepEqual(admin.body.events.map((e) => e.kind), ['report', 'case', 'flag', 'trade', 'sale', 'sale'], 'newest first');
  const [report, , flag, tr, sold, bought] = admin.body.events;
  assert.deepEqual([report.sub, report.name, report.reason], [s.troll.id, 'Troll', 'hate']);
  assert.equal(flag.flag, 'law');
  assert.deepEqual([tr.with, tr.withName, tr.gold, tr.items], [s.sylvia.id, 'Sylvia', WATCH_BIG_GOLD, 2]);
  assert.deepEqual([sold.side, sold.total, sold.currency, sold.withName], ['seller', WATCH_BIG_GOLD, 'gold', 'Sylvia']);
  assert.deepEqual([bought.side, bought.total, bought.currency], ['buyer', WATCH_BIG_MARKS, 'marks']);
  assert.equal(admin.body.cursor, admin.body.cursor | 0);
  // a Moderator's: logins and chat reports only
  const mod = await s.staff('/v1/staff/watch/events', {}, s.asy.session);
  assert.deepEqual(mod.body.online.map((o) => o.name), ['Troll']);
  assert.deepEqual(mod.body.events.map((e) => e.kind), ['report']);
  // the seat gone stale is no longer online
  s.raw.prepare('UPDATE realm_characters SET lease_at = ? WHERE id = ?').run(t - REALM_PLAYING_S - 1, trollChar);
  assert.deepEqual((await s.staff('/v1/staff/watch/events', {}, s.asy.session)).body.online, []);
  // since and until: the next poll sends the cursor as `since`
  assert.deepEqual((await s.staff('/v1/staff/watch/events', { since: t - 55 }, s.mob.session)).body.events.map((e) => e.kind), ['report']);
  assert.deepEqual((await s.staff('/v1/staff/watch/events', { until: t - 55 }, s.mob.session)).body.events.map((e) => e.kind), ['case', 'flag', 'trade', 'sale', 'sale']);
  assert.equal((await s.staff('/v1/staff/watch/events', { since: 0 }, s.mob.session)).body.since, (await s.staff('/v1/staff/watch/events', {}, s.mob.session)).body.since, 'a day back at most');
  // a trade between two watched players is each one's event
  await s.staff('/v1/staff/watch/add', { target: s.sylvia.id }, s.mob.session);
  assert.equal((await s.staff('/v1/staff/watch/events', {}, s.mob.session)).body.events.filter((e) => e.kind === 'trade').length, 2);
  // paged
  for (let i = 0; i < WATCH_PAGE; i++) s.insert('mod_reports', { case_id: s.raw.prepare("SELECT id FROM mod_cases WHERE target = ? AND source = 'report'").get(s.troll.id).id, reporter: (await s.registered(`Rep${i}`)).id, reason: 'spam', at: t - 100, counted: 1 });
  const p1 = await s.staff('/v1/staff/watch/events', {}, s.asy.session);
  assert.equal(p1.body.events.length, WATCH_PAGE);
  assert.equal(p1.body.next, WATCH_PAGE);
  const p2 = await s.staff('/v1/staff/watch/events', { from: p1.body.next, until: p1.body.cursor }, s.asy.session);
  assert.deepEqual([p2.body.events.length, p2.body.next, p2.body.total], [1, null, WATCH_PAGE + 1]);
  // the read is written down, once in ten minutes a member
  assert.deepEqual(s.audits('watch-events').map((a) => a.actor_name), ['SirMcMobdon', 'Asynian']);
});

test('STAFF-PANEL3-DESK: HOME\'S ROLL-UP of the watchlist - each watched player with something in the last day, most urgent first, the words that say why', async () => {
  const s = await stand();
  await s.staff('/v1/staff/watch/add', { target: s.troll.id }, s.mob.session);
  await s.staff('/v1/staff/watch/add', { target: s.sylvia.id }, s.mob.session);
  s.character(s.sylvia, 5);
  s.caseOn(s.troll, { ago: 50 });
  const c = s.character(s.troll, null);
  s.insert('realm_findings', { player: s.troll.id, char_id: c, seq: 1, at: nowS() - 70, law: 1, kind: 'dupe', detail: '{}' });
  const who = { player: { id: s.idOf('SirMcMobdon') }, role: 'admin' };
  const ctx = { db: s.env.DB, nowS: nowS() };
  assert.deepEqual(await HOME_WATCH.top(ctx, s.env, who, 5), {
    items: [{ level: 'high', sub: s.troll.id, name: 'Troll', why: '1 report · 1 finding' }, { level: 'low', sub: s.sylvia.id, name: 'Sylvia', why: 'online now' }],
    high: 1, total: 2,
  });
  assert.equal((await HOME_WATCH.top(ctx, s.env, who, 1)).items.length, 1);
  const mod = await HOME_WATCH.top(ctx, s.env, { ...who, role: 'moderator' }, 5);
  assert.deepEqual(mod.items[0], { level: 'medium', sub: s.troll.id, name: 'Troll', why: '1 report' }, 'a Moderator\'s share: no finding');
  assert.deepEqual([HOME_WATCH.id, HOME_WATCH.role], ['watchlist', 'moderator']);
});

test('STAFF-PANEL3-DESK: YOUR SETTINGS - the member\'s own document, every key the design doc\'s list and its shape, bounded, back the same next time (mutants: each check)', async () => {
  const s = await stand();
  assert.deepEqual((await s.staff('/v1/staff/settings', {}, s.asy.session)).body, { settings: {}, at: null });
  const mine = {
    home: { watches: [{ id: 'reports', show: true, top: 5 }, { id: 'bursts', show: false, top: 10 }] },
    lists: { cases: { columns: ['name', 'level'], sort: 'urgent', filters: [{ name: 'new accounts, gold over 1M', q: { age: 7, gold: 1e6 } }] } },
    order: { menu: 'urgent', tabs: 'usual', lists: 'urgent' }, look: 'iliac', window: { w: 900, h: 700, docked: true, first: 'home' },
    alerts: { kinds: { report: { pop: true, sound: false } }, quiet: { from: '23:00', to: '07:00' } }, nameplates: { show: ['level', 'flag'], distance: 120 },
  };
  const save = await s.staff('/v1/staff/settings/save', { settings: mine }, s.asy.session);
  assert.equal(save.status, 200, JSON.stringify(save.body));
  const back = await s.staff('/v1/staff/settings', {}, s.asy.session);
  assert.deepEqual(back.body, { settings: mine, at: save.body.at });
  assert.deepEqual((await s.staff('/v1/staff/settings', {}, s.mob.session)).body.settings, {}, 'another member\'s are their own');
  for (const bad of [null, [], 'iliac', { look: 'neon' }, { theme: 'iliac' }, { order: { menu: 'random' } }, { order: { footer: 'urgent' } }, { home: { watches: [{ id: 'x', top: 4 }] } },
    { home: { watches: [{ top: 3 }] } }, { home: { other: 1 } }, { home: { watches: [{ id: 'x', show: 'yes' }] } }, { lists: [] }, { window: 3 }, { alerts: 'all' }, { nameplates: [] },
    { lists: { big: 'x'.repeat(STAFF_SETTINGS_BYTES - 19) } }]) {
    assert.deepEqual(await s.staff('/v1/staff/settings/save', { settings: bad }, s.asy.session), { status: 400, body: { error: 'settings-bad' } }, JSON.stringify(bad).slice(0, 80));
  }
  assert.equal(settingsOf({ lists: { big: 'x'.repeat(STAFF_SETTINGS_BYTES - 20) } }).error, undefined, 'just at the bound');
  assert.equal(settingsOf({ lists: { big: 'x'.repeat(STAFF_SETTINGS_BYTES - 19) } }).error, 'settings-bad', 'one byte past it');
  assert.deepEqual((await s.staff('/v1/staff/settings', {}, s.asy.session)).body.settings, mine, 'a refused save changes nothing');
  await s.staff('/v1/staff/settings/save', { settings: { look: '8bit' } }, s.asy.session);
  assert.deepEqual((await s.staff('/v1/staff/settings', {}, s.asy.session)).body.settings, { look: '8bit' }, 'a save is the whole document');
  // STAFF-PANEL3-DESK FIX: a refused save written down failed - once in ten minutes, as a save is
  assert.deepEqual(s.audits('settings-save').map((a) => [a.outcome, a.detail]), [['ok', null], ['failed', JSON.stringify({ error: 'settings-bad' })]], 'a save a second is one row in ten minutes');
});

test('STAFF-PANEL3-DESK: THE SERVER\'S NOTICE - an Admin\'s, on every board for 1 to NOTICE_DAYS_MAX days through the game\'s own postNotice, asked again it is the one it made, and written down', async () => {
  const s = await stand();
  const post = await s.staff('/v1/staff/notice', { subject: 'Restart', body: 'restart in 10 min', days: 1, rid: 'panel-0001' }, s.mob.session);
  assert.equal(post.status, 200, JSON.stringify(post.body));
  const row = s.raw.prepare('SELECT * FROM board_notices').get();
  assert.deepEqual([row.id, row.subject, row.body, row.author_name, row.expires_at - row.at], [post.body.id, 'Restart', 'restart in 10 min', 'SirMcMobdon', 86400]);
  assert.deepEqual((await s.staff('/v1/staff/notice', { subject: 'Restart', body: 'restart in 10 min', days: 1, rid: 'panel-0001' }, s.mob.session)).body, { ok: true, repeat: true, id: post.body.id });
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM board_notices').get().n, 1);
  const read = await s.call('/v1/board/read', { map: 1 }, s.troll.secret);
  assert.equal(read.status, 200, JSON.stringify(read.body));
  assert.deepEqual(read.body.notices.map((x) => x.subject), ['Restart'], 'every board reads it');
  for (const days of [0, NOTICE_DAYS_MAX + 1]) assert.equal((await s.staff('/v1/staff/notice', { subject: 'x', body: 'y', days, rid: `panel-d${days}` }, s.mob.session)).status, 400);
  assert.deepEqual(s.audits('notice').map((a) => [a.outcome, JSON.parse(a.detail).id ?? JSON.parse(a.detail).error]), [['ok', post.body.id], ['failed', 'bad-notice-days'], ['failed', 'bad-notice-days']]);
});

test('STAFF-PANEL3-DESK: THE AI CHECK\'S SCORECARD - the cases staff decided that the reviewer read in shadow, by category: what it said against what staff did, the clock\'s expiries and other modes left out (mutants: each count; the severity line; the window)', async () => {
  const s = await stand();
  const t = nowS();
  let k = 0;
  const decided = (status, cat, sev, { mode = 'shadow', ago = 3600, by = 'Asynian', state = 'done' } = {}) => s.insert('mod_cases', {
    id: `sc${(++k).toString(16).padStart(14, '0')}`, target: s.troll.id, source: 'report', status, opened_at: t - ago - 10, updated_at: t - ago, ai_state: state, discord_state: 'off',
    ai_category: cat, ai_severity: sev, ai_mode: mode, resolved_at: t - ago, resolved_by: by,
  });
  decided('actioned', 'hate', 3);        // said, acted: agreed
  decided('actioned', 'hate', 2);        // said, acted: agreed
  decided('dismissed', 'hate', 2);       // said, dismissed
  decided('actioned', 'harassment', 1);  // not said (severity 1), acted
  decided('dismissed', 'harassment', 1); // not said, dismissed: agreed
  decided('dismissed', null, 0);         // found nothing, dismissed: agreed
  decided('actioned', null, 0);          // found nothing, acted
  decided('dismissed', 'hate', 3, { by: 'the clock' });       // expired: nobody decided
  decided('actioned', 'hate', 3, { mode: 'on' });             // another mode
  decided('actioned', 'hate', 3, { state: 'failed' });        // never read
  decided('actioned', 'hate', 3, { ago: 31 * 86400 });        // past the window
  s.caseOn(s.sylvia, { ai_state: 'done', ai_category: 'hate', ai_severity: 3, ai_mode: 'shadow' });   // still open
  const r = await s.staff('/v1/staff/ai-score', {}, s.mob.session);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.days, r.body.mode, r.body.severity], [30, 'shadow', 2]);
  const by = Object.fromEntries(r.body.categories.map((c) => [c.category, c]));
  assert.deepEqual(by.hate, { category: 'hate', cases: 3, saidActed: 2, saidDismissed: 1, clearActed: 0, clearDismissed: 0, agreed: 2, rate: 0.667 });
  assert.deepEqual(by.harassment, { category: 'harassment', cases: 2, saidActed: 0, saidDismissed: 0, clearActed: 1, clearDismissed: 1, agreed: 1, rate: 0.5 });
  assert.deepEqual(by.none, { category: 'none', cases: 2, saidActed: 0, saidDismissed: 0, clearActed: 1, clearDismissed: 1, agreed: 1, rate: 0.5 });
  assert.deepEqual(r.body.total, { cases: 7, saidActed: 2, saidDismissed: 1, clearActed: 2, clearDismissed: 2, agreed: 4, rate: 0.571 });
  assert.deepEqual(r.body.categories.map((c) => c.category)[0], 'hate', 'most cases first');
  assert.equal((await s.staff('/v1/staff/ai-score', { days: 32 }, s.mob.session)).body.total.cases, 8, 'the window');
  assert.equal((await s.staff('/v1/staff/ai-score', { mode: 'on' }, s.mob.session)).body.total.cases, 1);
  for (const days of [0, AI_SCORE_DAYS_MAX + 1, 1.5, '30']) assert.deepEqual((await s.staff('/v1/staff/ai-score', { days }, s.mob.session)).body, { error: 'bad-days' });
  assert.deepEqual((await s.staff('/v1/staff/ai-score', { days: AI_SCORE_DAYS_MAX }, s.mob.session)).status, 200);
  assert.equal(s.audits('ai-score-read').length, 4, 'each view once in ten minutes');
});

test('STAFF-PANEL3-DESK: REPORTED NOTES AND LISTINGS - an Admin\'s list, a note hidden by its reports first and paged; Remove and Restore through the game\'s own moderateNote, written down (mutants: the order; the act)', async () => {
  const s = await stand();
  const t = nowS();
  const note = (id, hidden = 0) => s.insert('board_notes', { id, map_id: 1, author: s.troll.id, author_name: 'Troll', subject: `about ${id}`, body: 'words', at: t - 100, expires_at: t + 86400, hidden, rid: `rid-${id}` });
  const reps = [];
  for (let i = 0; i < 3; i++) reps.push((await s.registered(`Reader${i}`)).id);
  const report = (table, col, id, n) => { for (let i = 0; i < n; i++) s.insert(table, { [col]: id, reporter: reps[i], at: t - 10 * i }); };
  note('note-one-report-0'); report('board_reports', 'note_id', 'note-one-report-0', 1);
  note('note-two-reports0'); report('board_reports', 'note_id', 'note-two-reports0', 2);
  note('note-hidden-00000', 1); report('board_reports', 'note_id', 'note-hidden-00000', 1);
  note('note-unreported00');
  const r = await s.staff('/v1/staff/board/reported', {}, s.mob.session);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.notes.map((n) => [n.id, n.reports, n.hidden]), [['note-hidden-00000', 1, true], ['note-two-reports0', 2, false], ['note-one-report-0', 1, false]]);
  assert.equal(r.body.notes[0].authorName, 'Troll');
  assert.equal(r.body.next, null);
  for (let i = 0; i < REPORTED_PAGE; i++) { note(`note-more-${String(i).padStart(7, '0')}`); report('board_reports', 'note_id', `note-more-${String(i).padStart(7, '0')}`, 1); }
  const p1 = await s.staff('/v1/staff/board/reported', {}, s.mob.session);
  assert.deepEqual([p1.body.notes.length, p1.body.next], [REPORTED_PAGE, REPORTED_PAGE]);
  assert.deepEqual([(await s.staff('/v1/staff/board/reported', { from: p1.body.next }, s.mob.session)).body.notes.length], [REPORTED_PAGE + 3 - REPORTED_PAGE]);
  // Restore, then Remove
  assert.deepEqual((await s.staff('/v1/staff/board/moderate', { id: 'note-hidden-00000', act: 'restore' }, s.mob.session)).body, { ok: true, id: 'note-hidden-00000', act: 'restore' });
  assert.equal(s.raw.prepare('SELECT hidden FROM board_notes WHERE id = ?').get('note-hidden-00000').hidden, 2);
  assert.deepEqual((await s.staff('/v1/staff/board/moderate', { id: 'note-two-reports0', act: 'remove' }, s.mob.session)).body, { ok: true, id: 'note-two-reports0', act: 'remove' });
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM board_notes WHERE id = ?').get('note-two-reports0').n, 0);
  assert.deepEqual(await s.staff('/v1/staff/board/moderate', { id: 'note-two-reports0', act: 'remove' }, s.mob.session), { status: 404, body: { error: 'no-note' } });
  assert.deepEqual(await s.staff('/v1/staff/board/moderate', { id: 'note-one-report-0', act: 'hide' }, s.mob.session), { status: 400, body: { error: 'bad-act' } });
  // STAFF-PANEL3-DESK FIX: the refused act written down failed
  assert.deepEqual(s.audits('board-moderate').map((a) => [a.target, a.outcome, JSON.parse(a.detail)]), [[null, 'failed', { id: 'note-one-report-0', error: 'bad-act' }]]);
  assert.deepEqual(s.audits('board-remove').map((a) => [a.target, a.outcome]), [[s.troll.id, 'ok'], [null, 'failed']]);
  assert.deepEqual(s.audits('board-restore').map((a) => [a.target, a.outcome, a.detail]), [[s.troll.id, 'ok', JSON.stringify({ id: 'note-hidden-00000' })]]);
  // the market: open listings and auctions with reports, the most reported first
  const listing = (id, state = 'open') => s.insert('market_listings', { id, seller: s.troll.id, char_id: 'c', region: 1, kind: 'material', material: 'iron', units: 5, price: 40, fee: 1,
    at: t - 50, expires_at: t + 86400, state, rid: `rid-${id}`, n: 'n', currency: 'gold' });
  listing('listing-one-00000'); report('market_reports', 'listing', 'listing-one-00000', 1);
  listing('listing-closed000', 'sold'); report('market_reports', 'listing', 'listing-closed000', 3);
  listing('listing-quiet0000');
  s.insert('market_auctions', { id: 'auction-two-00000', seller: s.sylvia.id, char_id: 'c', region: 1, provenance: 'p'.repeat(16), wear: 10, opening: 500, fee: 1, at: t - 40, ends_at: t + 3600, rid: 'rid-a', n: 'n' });
  report('market_auction_reports', 'auction', 'auction-two-00000', 2);
  const m = await s.staff('/v1/staff/market/reported', {}, s.mob.session);
  assert.equal(m.status, 200, JSON.stringify(m.body));
  assert.deepEqual(m.body.listings.map((l) => [l.type, l.id, l.reports, l.sellerName, l.price]), [['auction', 'auction-two-00000', 2, 'Sylvia', 500], ['listing', 'listing-one-00000', 1, 'Troll', 40]]);
  assert.equal(m.body.next, null);
  assert.deepEqual(s.audits('reported-read').map((a) => a.detail), [JSON.stringify({ kind: 'board' }), JSON.stringify({ kind: 'market' })]);
});
