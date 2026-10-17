// PRIVATE-REPORT (2026-10-17, Mac: "Can we add a private disclosure method for exploits/bugs with the client"): THE
// SERVICE'S SIDE - migration 0129 (private_reports), server-account/src/reports.js and its five routes, the reader's
// count on the post box and the heartbeat's post part. A report is a registered player's to the readers
// REPORT_READER_HANDLES names, and nobody else lists or opens one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService, T0 } from '../accountDb.mjs';
import { ROUTES, OPEN_ROUTES } from '../../server-account/src/service.js';
import { sendReport, myReports, reportInbox, readReport, closeReport, isReportReader } from '../../server-account/src/reports.js';
import { postBoxOf } from '../../server-account/src/post.js';
import {
  REPORT_SEND_MAX, REPORT_OPEN_MAX, REPORT_WORDS_MAX, REPORT_BODY_BYTES, REPORT_WINDOW_S, REPORT_MINE_MAX, REPORT_INBOX_MAX,
  reportHead, reportInboxHead, reportWhole, reportWordsOf, charsOf,
} from '../../src/net/reportLaw.js';
import { REFUSALS } from '../../src/net/accountClient.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const ROUTE_LIST = ['/v1/report/send', '/v1/report/mine', '/v1/report/inbox', '/v1/report/read', '/v1/report/close'];
/** A send's body. */
const words = (o = {}) => ({ kind: 'exploit', subject: 'Gold doubles at the bank', body: 'Deposit, then cancel the window twice.', rid: `r${Math.random().toString(36).slice(2, 14)}`, ...o });
/** The player row a session resolves to. */
const rowOf = (svc, who) => svc.env.DB._raw.prepare('SELECT * FROM players WHERE id = ?').get(who.id);
/** A report written straight into the table - for the bounds, which the route's clock cannot be stood at. */
const lay = (svc, who, n, state = 'open') => {
  for (let i = 0; i < n; i++) {
    svc.env.DB._raw.prepare('INSERT INTO private_reports (id, from_id, rid, kind, subject, body, sent_at, state) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(`laid${who.id.slice(0, 8)}${state}${String(i).padStart(4, '0')}`, who.id, `laid-${state}-${i}`, 'bug', 'A laid report', 'Laid by the test.', T0 + i, state);
  }
};

test('PRIVATE-REPORT the table and the doors: 0129 lays private_reports - one report a send an account; five POST routes behind a session, none open; a guest refused every one (report-needs-account, 403); every word the routes answer has a sentence; the readers a list in config (mutants: a route open; the guest let in; a word with no sentence)', async () => {
  const mig = src('server-account/migrations/0129_private_reports.sql');
  assert.match(mig, /CREATE TABLE IF NOT EXISTS private_reports \(/);
  assert.match(mig, /CREATE UNIQUE INDEX IF NOT EXISTS ux_private_reports_rid ON private_reports \(from_id, rid\);/);
  assert.match(mig, /FOREIGN KEY \(from_id\) REFERENCES players\(id\) ON DELETE CASCADE/);
  for (const r of ROUTE_LIST) { assert.ok(ROUTES.has(r), r); assert.ok(!OPEN_ROUTES.has(r), r); }
  for (const w of ['report-needs-account', 'report-kind', 'report-subject', 'report-body', 'report-rid', 'report-rate', 'report-full', 'no-report', 'not-report-reader', 'report-state']) {
    assert.equal(typeof REFUSALS[w], 'string', w);
  }
  // AUDIT PRIVATE-REPORT TEST-16: the readers by name - who reads an unfixed exploit is a change a pin moves on purpose
  assert.match(src('server-account/wrangler.toml'), /^REPORT_READER_HANDLES = "Lattymoy"$/m, 'the readers are named in config');

  const svc = await standService();
  const g = await svc.guest();
  for (const r of ROUTE_LIST) assert.deepEqual(await svc.call(r, {}, g.secret), { status: 403, body: { error: 'report-needs-account' } }, r);
  const ann = await svc.registered('Ann');
  const res = await svc.fetch('https://accounts.invalid/v1/report/mine', { method: 'GET', headers: { authorization: `Bearer ${ann.secret}` } });
  assert.equal(res.status, 405, 'every one a POST');
  assert.equal((await svc.call('/v1/report/send', words())).status, 401, 'no session, no report');
});

test('PRIVATE-REPORT a send: the words cleaned and bounded by the law on both ends; the context kept in its shape and nothing else; asked again under its rid, the same report and one row; a body past the service\'s 4 KiB but within its own bound taken (mutants: the rid ignored; the context stored raw; the words stored uncleaned; the send read at 4 KiB)', async () => {
  const svc = await standService();
  const ann = await svc.registered('Ann');
  const rid = 'send-once-1234';
  const r = await svc.call('/v1/report/send', words({ rid, subject: '  Gold\r\ndoubles\u0007 ', body: 'Step one\r\nStep two\u0000', context: { update: '0.0.412', build: 'd9187c3049cb', app: 'desktop', where: 'Daggerfall', ua: 'x'.repeat(500) } }), ann.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.ok, true);
  assert.ok(typeof r.body.id === 'string' && Number.isSafeInteger(r.body.sentAt));
  const row = svc.env.DB._raw.prepare('SELECT * FROM private_reports WHERE id = ?').get(r.body.id);
  assert.deepEqual([row.from_id, row.kind, row.subject, row.body, row.state, row.read_at], [ann.id, 'exploit', 'Gold doubles', 'Step one\nStep two', 'open', null]);
  assert.deepEqual(JSON.parse(row.context), { update: '0.0.412', build: 'd9187c3049cb', app: 'desktop' }, 'its shape and nothing else');

  const again = await svc.call('/v1/report/send', words({ rid, subject: 'Something else entirely' }), ann.secret);
  assert.deepEqual(again, { status: 200, body: { ok: true, repeat: true, id: r.body.id, sentAt: r.body.sentAt } }, 'a lost answer asked again');
  assert.equal(svc.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM private_reports').get().n, 1);

  for (const [o, w] of [[{ kind: 'gossip' }, 'report-kind'], [{ subject: 'ab' }, 'report-subject'], [{ subject: 'x'.repeat(81) }, 'report-subject'], [{ body: 'too short' }, 'report-body'], [{ body: 'x'.repeat(REPORT_WORDS_MAX + 1) }, 'report-body'], [{ rid: 'no' }, 'report-rid']]) {
    assert.deepEqual(await svc.call('/v1/report/send', words(o), ann.secret), { status: 400, body: { error: w } }, w);
  }
  // 3,000 characters of a script past ASCII are past 4 KiB as UTF-8, and within the send's own bound
  const wide = 'ж'.repeat(REPORT_WORDS_MAX);
  assert.ok(Buffer.byteLength(JSON.stringify(words({ body: wide }))) > 4 * 1024);
  assert.equal((await svc.call('/v1/report/send', words({ body: wide }), ann.secret)).status, 200, 'a long report in any language');
  // AUDIT PRIVATE-REPORT TEST-1: past its bound, never read - its words GOOD, so only the bound can refuse it (a body read
  // whole would be taken); and every other report route reads the service's own 4 KiB
  const post = (path, payload) => svc.fetch(`https://accounts.invalid${path}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${ann.secret}` }, body: JSON.stringify(payload) });
  const huge = await post('/v1/report/send', words({ pad: 'x'.repeat(REPORT_BODY_BYTES) }));
  assert.deepEqual([huge.status, (await huge.json()).error], [400, 'body'], 'past its bound, never read');
  const mineHuge = await post('/v1/report/mine', { pad: 'x'.repeat(5 * 1024) });
  assert.deepEqual([mineHuge.status, (await mineHuge.json()).error], [400, 'body'], 'the others at 4 KiB');
});

test('PRIVATE-REPORT the bounds: REPORT_SEND_MAX an hour an account (report-rate, 429), and REPORT_OPEN_MAX open at once (report-full, 409) - a closed one makes room; another account\'s are not counted (mutants: the rate unasked; the open bound uncounted; the open bound counting closed reports; a send asked again counted against the rate)', async () => {
  const svc = await standService();
  const ann = await svc.registered('Ann'), bob = await svc.registered('Bob');
  const ctx = { db: svc.env.DB, rand: (b) => globalThis.crypto.getRandomValues(b), nowS: T0 };
  const ann0 = rowOf(svc, ann);
  const first = words();
  const sent = await sendReport(ctx, ann0, first);
  for (let i = 1; i < REPORT_SEND_MAX; i++) assert.equal((await sendReport(ctx, ann0, words())).ok, true, `send ${i + 1}`);
  assert.deepEqual(await sendReport(ctx, ann0, words()), { error: 'report-rate' });
  assert.deepEqual(await sendReport(ctx, ann0, first), { ok: true, repeat: true, id: sent.id, sentAt: T0 }, 'a lost answer asked again past the hour\'s bound is still its report');
  assert.equal((await sendReport({ ...ctx, nowS: T0 + 3600 }, ann0, words())).ok, true, 'the next hour');

  const bob0 = rowOf(svc, bob);
  lay(svc, bob, REPORT_OPEN_MAX - 1);
  lay(svc, bob, 3, 'fixed');
  assert.equal((await sendReport(ctx, bob0, words())).ok, true, 'the last open place');
  assert.deepEqual(await sendReport(ctx, bob0, words()), { error: 'report-full' });
  svc.env.DB._raw.prepare("UPDATE private_reports SET state = 'duplicate' WHERE id = (SELECT id FROM private_reports WHERE from_id = ? AND state = 'open' LIMIT 1)").run(bob.id);
  assert.equal((await sendReport(ctx, bob0, words())).ok, true, 'a closed one makes room');
  const r = await svc.call('/v1/report/send', words(), bob.secret);
  assert.deepEqual([r.status, r.body.error], [409, 'report-full'], 'the route says it so');
});

test('PRIVATE-REPORT a reporter\'s own: newest first, heads alone - never the words, never another\'s; read and closed as a reader leaves them (mutants: the list unscoped; the rows answered raw)', async () => {
  const svc = await standService({ REPORT_READER_HANDLES: 'Mac' });
  const ann = await svc.registered('Ann'), bob = await svc.registered('Bob'), mac = await svc.registered('Mac');
  const a1 = (await svc.call('/v1/report/send', words({ subject: 'First one', body: 'The secret steps, one.' }), ann.secret)).body.id;
  const a2 = (await svc.call('/v1/report/send', words({ kind: 'bug', subject: 'Second one' }), ann.secret)).body.id;
  svc.env.DB._raw.prepare('UPDATE private_reports SET sent_at = sent_at - 10 WHERE id = ?').run(a1);
  await svc.call('/v1/report/send', words({ subject: 'Bob\'s' }), bob.secret);

  const mine = await svc.call('/v1/report/mine', {}, ann.secret);
  assert.equal(mine.status, 200);
  assert.deepEqual(mine.body.reports.map((p) => p.id), [a2, a1], 'newest first, and only Ann\'s');
  assert.deepEqual(Object.keys(mine.body.reports[0]).sort(), ['id', 'kind', 'read', 'sentAt', 'state', 'subject']);
  assert.ok(!JSON.stringify(mine.body).includes('secret steps'), 'never the words');
  assert.deepEqual(mine.body.reports.map(reportHead), mine.body.reports, 'the client reads it through the law');

  await svc.call('/v1/report/read', { id: a1 }, mac.secret);
  await svc.call('/v1/report/close', { id: a2, state: 'fixed' }, mac.secret);
  const after = (await svc.call('/v1/report/mine', {}, ann.secret)).body.reports;
  assert.deepEqual(after.map((p) => [p.id, p.read, p.state]), [[a2, true, 'fixed'], [a1, true, 'open']]);
});

test('PRIVATE-REPORT THE READERS ALONE: a developer, a moderator or anybody the list does not name refused (not-report-reader, 403); a reader\'s inbox unopened first then newest, with who sent each; one opened - its words and its context - and stamped read; closed, moved to the closed list, and opened again (mutants: the reader check gone; read never stamped; the close unscoped to its id)', async () => {
  const svc = await standService({ REPORT_READER_HANDLES: 'Mac', DEVELOPER_HANDLES: 'Kestrel', MODERATOR_HANDLES: 'Heron' });
  const ann = await svc.registered('Ann'), mac = await svc.registered('Mac');
  const dev = await svc.registered('Kestrel'), mod = await svc.registered('Heron');
  const old = (await svc.call('/v1/report/send', words({ subject: 'Old one', context: { build: 'abcdef1' } }), ann.secret)).body.id;
  svc.env.DB._raw.prepare('UPDATE private_reports SET sent_at = sent_at - 100 WHERE id = ?').run(old);
  const neu = (await svc.call('/v1/report/send', words({ kind: 'security', subject: 'New one', body: 'Tokens never expire here.' }), ann.secret)).body.id;
  for (const who of [dev, mod, ann]) {
    for (const [r, b] of [['/v1/report/inbox', {}], ['/v1/report/read', { id: old }], ['/v1/report/close', { id: old, state: 'fixed' }]]) {
      assert.deepEqual(await svc.call(r, b, who.secret), { status: 403, body: { error: 'not-report-reader' } }, `${who.handle} ${r}`);
    }
  }
  assert.equal(isReportReader(rowOf(svc, mac), { REPORT_READER_HANDLES: ' mac ,Other' }), true, 'case and spaces as every list');
  assert.equal(isReportReader({ handle: null }, { REPORT_READER_HANDLES: 'Mac' }), false, 'a guest never');

  // AUDIT PRIVATE-REPORT TEST-3: read the NEW one - the unopened OLD one leads: unread first, never newest first
  assert.equal((await svc.call('/v1/report/read', { id: neu }, mac.secret)).status, 200);
  const inbox = await svc.call('/v1/report/inbox', {}, mac.secret);
  assert.equal(inbox.status, 200);
  assert.deepEqual(inbox.body.reports.map((p) => [p.id, p.read, p.from]), [[old, false, 'Ann'], [neu, true, 'Ann']]);
  assert.deepEqual([inbox.body.which, inbox.body.unread, inbox.body.open], ['open', 1, 2]);
  assert.deepEqual(inbox.body.reports.map(reportInboxHead), inbox.body.reports);

  const one = await svc.call('/v1/report/read', { id: neu }, mac.secret);
  assert.equal(one.status, 200);
  assert.deepEqual([one.body.report.body, one.body.report.kind, one.body.report.from, one.body.report.read], ['Tokens never expire here.', 'security', 'Ann', true]);
  assert.ok(reportWhole(one.body.report), 'a whole report by the law');
  const stamped = svc.env.DB._raw.prepare('SELECT read_at, read_by FROM private_reports WHERE id = ?').get(neu);
  assert.equal(stamped.read_by, mac.id);
  assert.ok(stamped.read_at > 0);
  assert.deepEqual((await svc.call('/v1/report/read', { id: old }, mac.secret)).body.report.context, { build: 'abcdef1' });

  assert.deepEqual(await svc.call('/v1/report/close', { id: neu, state: 'fixed' }, mac.secret), { status: 200, body: { ok: true, id: neu, state: 'fixed' } });
  assert.equal(svc.env.DB._raw.prepare('SELECT state FROM private_reports WHERE id = ?').get(old).state, 'open', 'the other untouched');
  assert.deepEqual((await svc.call('/v1/report/inbox', {}, mac.secret)).body.reports.map((p) => p.id), [old]);
  const closed = (await svc.call('/v1/report/inbox', { which: 'closed' }, mac.secret)).body;
  assert.deepEqual([closed.which, closed.reports.map((p) => [p.id, p.state])], ['closed', [[neu, 'fixed']]]);
  const row = svc.env.DB._raw.prepare('SELECT closed_at, closed_by FROM private_reports WHERE id = ?').get(neu);
  assert.equal(row.closed_by, mac.id);
  assert.deepEqual(await svc.call('/v1/report/close', { id: neu, state: 'open' }, mac.secret), { status: 200, body: { ok: true, id: neu, state: 'open' } });
  assert.deepEqual({ ...svc.env.DB._raw.prepare('SELECT state, closed_at, closed_by FROM private_reports WHERE id = ?').get(neu) }, { state: 'open', closed_at: null, closed_by: null }, 'opened again');

  assert.deepEqual(await svc.call('/v1/report/close', { id: neu, state: 'deleted' }, mac.secret), { status: 400, body: { error: 'report-state' } });
  assert.deepEqual(await svc.call('/v1/report/read', { id: 'x'.repeat(24) }, mac.secret), { status: 404, body: { error: 'no-report' } });
  assert.deepEqual(await svc.call('/v1/report/close', { id: 'not an id', state: 'fixed' }, mac.secret), { status: 404, body: { error: 'no-report' } });
});

test('PRIVATE-REPORT A READER\'S BOX SAYS ONE CAME: the post box and the heartbeat\'s post part carry `reports` - open and unopened - for a reader alone; nobody else\'s box carries the key, nor asks the table (mutants: the counts for everyone; the heartbeat without the config)', async () => {
  const svc = await standService({ REPORT_READER_HANDLES: 'Mac' });
  const ann = await svc.registered('Ann'), mac = await svc.registered('Mac');
  const box = async (who) => (await svc.fetch('https://accounts.invalid/v1/post/box', { method: 'GET', headers: { authorization: `Bearer ${who.secret}` } })).json();
  assert.deepEqual((await box(mac)).reports, { unread: 0, open: 0 });
  await svc.call('/v1/report/send', words(), ann.secret);
  const id = (await svc.call('/v1/report/send', words(), ann.secret)).body.id;
  assert.deepEqual((await box(mac)).reports, { unread: 2, open: 2 });
  await svc.call('/v1/report/read', { id }, mac.secret);
  assert.deepEqual((await svc.call('/v1/heartbeat', { post: true }, mac.secret)).body.post.reports, { unread: 1, open: 2 }, 'the heartbeat\'s part the same');
  assert.equal('reports' in (await box(ann)), false, 'a reporter\'s box says nothing of anybody\'s reports');
  assert.equal('reports' in (await svc.call('/v1/heartbeat', { post: true }, ann.secret)).body.post, false);
  // and a box asked with no config at all (an older caller) is the box as it was
  assert.equal('reports' in (await postBoxOf({ db: svc.env.DB }, rowOf(svc, mac))), false);
});

test('PRIVATE-REPORT the functions refuse alone what the routes would: a reader read and closed with no list; the reporter\'s list empty before any (mutants: a missing env read as everyone\'s)', async () => {
  const svc = await standService();
  const mac = await svc.registered('Mac');
  const ctx = { db: svc.env.DB, nowS: T0 };
  const row = rowOf(svc, mac);
  assert.deepEqual(await reportInbox(ctx, row, {}), { error: 'not-report-reader' });
  assert.deepEqual(await readReport(ctx, row, undefined, 'x'.repeat(24)), { error: 'not-report-reader' });
  assert.deepEqual(await closeReport(ctx, row, { REPORT_READER_HANDLES: '' }, { id: 'x'.repeat(24), state: 'fixed' }), { error: 'not-report-reader' });
  assert.deepEqual(await myReports(ctx, row), { reports: [], max: 20 });
});

// ── AUDIT PRIVATE-REPORT (2026-10-17, bible/01-Overview/audits/Audit-Private-Report.md) ─────────────────────────────

/** A report laid straight into the table at T0 + `at`, by `who` - the reader's lists' order, which the route's clock cannot stand at. */
const layOne = (svc, who, n, { at = n, state = 'open', read = null } = {}) => {
  const id = `lay${String(n).padStart(4, '0')}${who.id.slice(0, 12)}`;
  svc.env.DB._raw.prepare('INSERT INTO private_reports (id, from_id, rid, kind, subject, body, sent_at, state, read_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, who.id, `lay-${n}`, 'bug', `Laid ${n}`, 'Laid by the test.', T0 + at, state, read);
  return id;
};

test('AUDIT PRIVATE-REPORT SVC-1 SVC-2: A CHARACTER IS A CODE POINT on both ends - three emoji are a title of three, as the table counts them, and two are refused as the title, never as a full queue; the words cleaned by the house\'s law (wire.js visibleText): zero-width and soft hyphens, a direction override, C1 controls, a lone surrogate and a stack of marks gone, a tab a space (mutants: the law counting UTF-16 units; the words cleaned by a second law; a tab glued)', async () => {
  const svc = await standService();
  const ann = await svc.registered('Ann');
  const ok = await svc.call('/v1/report/send', words({ subject: '💰💰💰', body: '💥'.repeat(10) }), ann.secret);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.deepEqual(await svc.call('/v1/report/send', words({ subject: '💰💰' }), ann.secret), { status: 400, body: { error: 'report-subject' } }, 'too short, said so');
  assert.deepEqual(await svc.call('/v1/report/send', words({ body: '💥'.repeat(9) }), ann.secret), { status: 400, body: { error: 'report-body' } });
  assert.deepEqual([charsOf('💰💰'), '💰💰'.length], [2, 4]);
  const wide = reportWordsOf({ kind: 'bug', subject: 'x'.repeat(40) + '💰'.repeat(40), body: '0123456789' });
  assert.equal(wide.subject.length, 120, 'eighty characters - 120 UTF-16 units - taken');
  assert.equal((await svc.call('/v1/report/send', words({ subject: wide.subject }), ann.secret)).status, 200, 'and the table takes them');
  for (const sub of ['\u200b\u200b\u200b', '\u00ad\u00ad\u00ad', '\u0085\u009b\u0085']) {
    assert.deepEqual(reportWordsOf({ kind: 'bug', subject: sub, body: '0123456789' }), { error: 'report-subject' }, `${JSON.stringify(sub)} is no title`);
  }
  assert.equal(reportWordsOf({ kind: 'bug', subject: 'ab\u202ecd', body: '0123456789' }).subject, 'abcd', 'no direction override');
  assert.equal(reportWordsOf({ kind: 'bug', subject: 'abc\ud800', body: '0123456789' }).subject, 'abc', 'no half a character');
  assert.equal(reportWordsOf({ kind: 'bug', subject: 'abc', body: `e${'\u0301'.repeat(70)} and more` }).body, 'e\u0301\u0301\u0301 and more', 'marks cut to three');
  assert.deepEqual(reportWordsOf({ kind: 'bug', subject: 'A\u007F title', body: 'Step\tone\rStep two\u2028three' }), { kind: 'bug', subject: 'A title', body: 'Step one\nStep two\nthree' });
  // TEST-10: the title's bounds at their edges
  assert.equal(reportWordsOf({ kind: 'bug', subject: 'abc', body: '0123456789' }).subject, 'abc');
  assert.equal(reportWordsOf({ kind: 'bug', subject: 'x'.repeat(80), body: '0123456789' }).subject.length, 80);
});

test('AUDIT PRIVATE-REPORT SVC-3 TEST-2 TEST-11: the hour\'s bound is an ACCOUNT\'s and an HOUR\'s - another account sends while one is held, the second before the hour\'s end still held; a full queue is said BEFORE the hour is counted, so a report closed makes room at once; the route says 429; the bounds by number (mutants: one rate for everyone; the window a minute; the bound moved; the rate counted before the full queue)', async () => {
  const svc = await standService();
  const ann = await svc.registered('Ann'), bob = await svc.registered('Bob'), cal = await svc.registered('Cal'), dee = await svc.registered('Dee');
  const ctx = (n = 0) => ({ db: svc.env.DB, rand: (b) => globalThis.crypto.getRandomValues(b), nowS: T0 + n });
  assert.deepEqual([REPORT_SEND_MAX, REPORT_WINDOW_S, REPORT_OPEN_MAX, REPORT_MINE_MAX, REPORT_INBOX_MAX], [5, 3600, 20, 20, 100]);
  assert.ok(REFUSALS['report-full'].includes(String(REPORT_OPEN_MAX)), 'the sentence says the bound');
  const ann0 = rowOf(svc, ann);
  for (let i = 0; i < REPORT_SEND_MAX; i++) assert.equal((await sendReport(ctx(), ann0, words())).ok, true);
  assert.deepEqual(await sendReport(ctx(), ann0, words()), { error: 'report-rate' });
  assert.equal((await sendReport(ctx(), rowOf(svc, bob), words())).ok, true, 'Bob\'s hour is his own');
  assert.deepEqual(await sendReport(ctx(REPORT_WINDOW_S - 1), ann0, words()), { error: 'report-rate' }, 'the hour\'s last second still held');
  assert.equal((await sendReport(ctx(REPORT_WINDOW_S), ann0, words())).ok, true, 'the next hour');

  const cal0 = rowOf(svc, cal);
  lay(svc, cal, REPORT_OPEN_MAX);
  for (let i = 0; i < REPORT_SEND_MAX + 2; i++) assert.deepEqual(await sendReport(ctx(), cal0, words()), { error: 'report-full' }, `full ${i + 1}`);
  svc.env.DB._raw.prepare("UPDATE private_reports SET state = 'fixed' WHERE id = (SELECT id FROM private_reports WHERE from_id = ? LIMIT 1)").run(cal.id);
  assert.equal((await sendReport(ctx(), cal0, words())).ok, true, 'a full queue cost none of the hour');

  svc.env.DB._raw.prepare('INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, ?)').run(`report:${dee.id}`, 4_000_000_000, REPORT_SEND_MAX);
  assert.deepEqual(await svc.call('/v1/report/send', words(), dee.secret), { status: 429, body: { error: 'report-rate' } });
});

test('AUDIT PRIVATE-REPORT TEST-3 TEST-7 TEST-8 TEST-9 SVC-4 SVC-6 TEST-15: the inbox unopened first then newest; the closed list every closed state, the last closed first; the first reader\'s stamps kept by a second, a close by the reader who closed; the counts after a close; a report opened again unread stays unread; past a hundred, a next page; the reporter\'s list twenty (mutants: newest first alone; the closed list fixed alone; the closed list oldest first; a second reader\'s read stamped over the first\'s; a close\'s read over the first; the counts counting closed; the reopen reading; no next page; the limits gone)', async () => {
  const env = { REPORT_READER_HANDLES: 'Mac,Lat' };
  const svc = await standService(env);
  const ann = await svc.registered('Ann'), bob = await svc.registered('Bob'), mac = await svc.registered('Mac'), lat = await svc.registered('Lat');
  const at = (n) => ({ db: svc.env.DB, nowS: T0 + n });
  const m0 = rowOf(svc, mac), l0 = rowOf(svc, lat);
  const [a0, a1, a2] = [layOne(svc, ann, 0), layOne(svc, ann, 1), layOne(svc, ann, 2)];
  await readReport(at(10), m0, env, a2);
  const open1 = await reportInbox(at(11), m0, env, {});
  assert.deepEqual(open1.reports.map((p) => [p.id, p.read]), [[a1, false], [a0, false], [a2, true]], 'unread first, each part newest first');
  assert.deepEqual([open1.unread, open1.open, open1.page, open1.more], [2, 3, 0, false]);

  await readReport(at(20), l0, env, a2);
  const stamp = (id) => ({ ...svc.env.DB._raw.prepare('SELECT read_at, read_by, closed_at, closed_by, state FROM private_reports WHERE id = ?').get(id) });
  assert.deepEqual([stamp(a2).read_at, stamp(a2).read_by], [T0 + 10, mac.id], 'the first reader\'s read kept');
  await closeReport(at(30), l0, env, { id: a0, state: 'fixed' });
  await closeReport(at(31), m0, env, { id: a1, state: 'wontfix' });
  await closeReport(at(32), m0, env, { id: a2, state: 'duplicate' });
  assert.deepEqual(stamp(a0), { read_at: T0 + 30, read_by: lat.id, closed_at: T0 + 30, closed_by: lat.id, state: 'fixed' }, 'closed unread: read by its closer');
  assert.deepEqual([stamp(a2).read_by, stamp(a2).closed_by], [mac.id, mac.id]);
  await closeReport(at(33), l0, env, { id: a2, state: 'duplicate' });
  assert.deepEqual([stamp(a2).read_at, stamp(a2).read_by, stamp(a2).closed_by], [T0 + 10, mac.id, lat.id], 'a second close keeps the first read');
  const closed = await reportInbox(at(40), m0, env, { which: 'closed' });
  assert.deepEqual(closed.reports.map((p) => [p.id, p.state]), [[a2, 'duplicate'], [a1, 'wontfix'], [a0, 'fixed']], 'every closed state, the last closed first');
  assert.deepEqual([closed.unread, closed.open], [0, 0], 'nothing open counted');

  const a4 = layOne(svc, ann, 4);
  await closeReport(at(50), m0, env, { id: a4, state: 'open' });
  assert.deepEqual([stamp(a4).read_at, stamp(a4).read_by], [null, null], 'opened again unread, still unread');
  assert.deepEqual((await reportInbox(at(51), m0, env, {})).unread, 1);

  // a hundred and one unread from Bob: the oldest is the next page's, and asked for, it is there
  const bobs = Array.from({ length: REPORT_INBOX_MAX + 1 }, (_, i) => layOne(svc, bob, 100 + i));
  const p0 = await reportInbox(at(60), m0, env, {});
  assert.deepEqual([p0.reports.length, p0.more, p0.reports.some((p) => p.id === bobs[0])], [REPORT_INBOX_MAX, true, false]);
  const p1 = await reportInbox(at(61), m0, env, { page: 1 });
  assert.deepEqual([p1.page, p1.more, p1.reports.map((p) => p.id)], [1, false, [bobs[0], a4].filter((id) => !p0.reports.some((p) => p.id === id))]);
  assert.deepEqual((await reportInbox(at(62), m0, env, { page: -1 })).page, 0, 'a page that is none is the first');

  const mine = await myReports(at(70), rowOf(svc, bob));
  assert.equal(mine.reports.length, REPORT_MINE_MAX, 'a reporter\'s list, twenty');
});

test('AUDIT PRIVATE-REPORT SVC-5: NOBODY ELSE\'S BOX ASKS THE TABLE - a reporter\'s post box and heartbeat run no statement naming private_reports; a reader\'s does (mutants: the counts asked for every box)', async () => {
  const svc = await standService({ REPORT_READER_HANDLES: 'Mac' });
  const ann = await svc.registered('Ann'), mac = await svc.registered('Mac');
  const said = [];
  const prepare = svc.env.DB.prepare.bind(svc.env.DB);
  svc.env.DB.prepare = (sql) => { said.push(sql); return prepare(sql); };
  const asked = () => [...said, ...svc.env.DB._sessions.flatMap((x) => x.statements)].filter((q) => /private_reports/.test(q)).length;
  const box = (who) => svc.fetch('https://accounts.invalid/v1/post/box', { method: 'GET', headers: { authorization: `Bearer ${who.secret}` } });
  said.length = 0; svc.env.DB._sessions.length = 0;
  await box(ann);
  await svc.call('/v1/heartbeat', { post: true }, ann.secret);
  assert.equal(asked(), 0, 'a reporter\'s look costs no statement of the readers\'');
  await box(mac);
  assert.ok(asked() > 0, 'a reader\'s does');
});

test('AUDIT PRIVATE-REPORT SVC-1 SVC-3: THE OPEN BOUND IS THE INSERT\'S OWN - three sends racing past the count read before it, one short of the bound, land one report and are told `report-full` twice; the queue never past REPORT_OPEN_MAX (mutants: the insert unbounded, the count read alone holding it)', async () => {
  const svc = await standService();
  const cal = await svc.registered('Cal');
  lay(svc, cal, REPORT_OPEN_MAX - 1);
  const cal0 = rowOf(svc, cal);
  const ctx = { db: svc.env.DB, rand: (b) => globalThis.crypto.getRandomValues(b), nowS: T0 };
  const out = await Promise.all(['raceaaaaaaaa', 'racebbbbbbbb', 'racecccccccc'].map((rid) => sendReport(ctx, cal0, words({ rid }))));
  assert.deepEqual(out.map((r) => (r.ok === true ? 'sent' : r.error)).sort(), ['report-full', 'report-full', 'sent']);
  assert.equal(svc.env.DB._raw.prepare("SELECT COUNT(*) AS n FROM private_reports WHERE from_id = ? AND state = 'open'").get(cal.id).n, REPORT_OPEN_MAX);
});
