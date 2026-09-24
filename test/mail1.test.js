// MAIL1 - LETTERS (2026-09-23).
//
// Addison Knox, on Discord: "An in-game mail system where players can send messages to offline players (e.g. notes,
// contracts, invitations)."
//
// ═══ WHAT THESE PINS ARE FOR ═══════════════════════════════════════
//
// A letter is words one player leaves for another who is NOT here, so every guarantee lives in the ACCOUNT SERVICE,
// and every pin below that is about the service drives the REAL worker (server-account/src/index.js) over a real
// SQLite through the migrations the deploy applies - never a stub of it. The client's box is driven against that same
// worker through a fetch that reaches it, so "the panel shows what the service keeps" is one chain, end to end. The
// panel is driven headless over a fake document; the host by its source.
//
// The claims, in the order they are pinned:
//   - THE LAW (net/letterLaw.js): the characters are the chat's (wire.js visibleText, one law), the lines are kept,
//     a letter past its bound is refused and never cut, and a maximal letter always fits the service's body cap.
//   - WHO: registered to registered, by handle; never a guest, never oneself, never while muted.
//   - HOW MUCH: an hour's letters to anyone, and to one reader; a full box refuses the SENDER, atomically.
//   - WHOSE: a reader's letters are theirs alone - listed, opened (read once), thrown away - and `no-letter` is the
//     one word for somebody else's and for nobody's.
//   - THE BOX (net/mail.js): states, the notices, a letter opened once, a refusal given before the network, `auth`
//     forgetting the session, and the poll's cadence.
//   - THE TAB (ui/socialPanel.js): the three views, the draft that no repaint can lose, the friend's Letter button.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../server-account/src/index.js';
import { openSession } from '../server-account/src/accounts.js';
import { sendLetter } from '../server-account/src/letters.js';
import { ROUTES, OPEN_ROUTES, MAX_BODY_BYTES, ACCOUNT_VERSION } from '../server-account/src/service.js';
import {
  letterWords, cleanBody, cleanSubject, LETTER_SUBJECT_MAX, LETTER_BODY_MAX, LETTER_LINES_MAX, LETTERS_INBOX_MAX,
  LETTERS_SENT_MAX, LETTERS_PAIR_MAX, LETTER_ID_RE,
} from '../src/net/letterLaw.js';
import { visibleText, sanitizeChat, CHAT_MAX } from '../src/net/wire.js';
import { HANDLE_MAX_LEN, REFUSALS, accountRefusalText, keepSession, SESSION_KEY } from '../src/net/accountClient.js';
import {
  MailBox, MAIL_POLL_MS, letterHead, letterWhole, letterAgeText, replySubject, mailNoticeText,
} from '../src/net/mail.js';
import {
  createSocialPanel, NO_LETTERS_TEXT, LETTERS_SIGNED_OUT_TEXT, LETTERS_LOOKING_TEXT,
} from '../src/ui/socialPanel.js';
import { SocialState } from '../src/net/social.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const rand = (b) => globalThis.crypto.getRandomValues(b);

// ── THE HARNESS: the real account worker over node:sqlite ──────────────────────────────────────────────────────────

const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) db.exec(src(`server-account/migrations/${f}`));
  return {
    _raw: db,
    prepare(sql) {
      const stmt = db.prepare(sql);
      let args = [];
      const api = {
        bind(...a) { args = a; return api; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
      };
      return api;
    },
  };
}

/** The service, a fetch that reaches it, and players made the way the service makes them (a row, a session). */
async function service({ env = {} } = {}) {
  const db = d1();
  const e = { DB: db, ...env };
  let calls = 0;
  const fetch = async (url, init = {}) => { calls++; return worker.fetch(new Request(url, init), e); };
  const nowS = Math.floor(Date.now() / 1000);
  const player = async (id, handle, { created = nowS } = {}) => {
    db._raw.prepare('INSERT INTO players (id, handle, handle_lc, guest_name, created_at, last_seen, registered_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, handle, handle?.toLowerCase() ?? null, `Guest ${id.slice(0, 4)}`, created, created, handle ? created : null);
    const s = await openSession({ db, subtle, rand, nowS }, id);
    return { id, handle, secret: s.secret };
  };
  const call = async (who, path, body = null, method = null) => {
    const res = await fetch(`https://svc${path}`, {
      method: method ?? (body ? 'POST' : 'GET'),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${who.secret}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, data: await res.json() };
  };
  const send = (who, to, subject = 'A note', body = 'Meet me at the Rusty Relic.') => call(who, '/v1/mail/send', { to, subject, body });
  return { db, env: e, fetch, player, call, send, calls: () => calls };
}

/** A storage the host's own shape: getItem/setItem/removeItem. */
const memStore = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; };
/** A box over the real service, its io read from a store as the host reads it. */
function boxFor(svc, who, { now = () => Date.now(), onLetter = null } = {}) {
  const storage = memStore();
  if (who) keepSession(storage, { id: who.id, name: who.handle, kind: 'linked', sessionId: 's', secret: who.secret });
  const ioOf = () => {
    const raw = storage.getItem(SESSION_KEY);
    const s = raw ? JSON.parse(raw) : null;
    return s?.secret ? { fetch: svc.fetch, base: 'https://svc', secret: s.secret, storage } : null;
  };
  return { box: new MailBox({ ioOf, now, onLetter }), storage };
}

// ── THE LAW ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('MAIL1 law: a letter carries the chat\'s characters (visibleText - one law) and keeps its lines - controls, bidi overrides and zero widths gone, a mark stack cut, the emoji joiner kept; spaces folded; a run of blank lines one; none at either end; idempotent (mutants: the lines collapsed; blank runs kept; the bidi override kept)', () => {
  const raw = '\n\n  Dear Bob,\t\r\n\r\n\r\n\u202eI owe you\u200b 20 gold.  \u2028Signed\u2029\n\n\nAnn \u{1F468}\u200d\u{1F469}\u200d\u{1F467} e\u0301\u0301\u0301\u0301\u0301\n\n';
  const b = cleanBody(raw);
  assert.equal(b, 'Dear Bob,\n\nI owe you 20 gold.\nSigned\n\nAnn \u{1F468}\u200d\u{1F469}\u200d\u{1F467} e\u0301\u0301\u0301');
  assert.equal(cleanBody(b), b, 'idempotent: what the form shows after a send is what the reader gets');
  assert.equal(cleanSubject('  A\ncontract\r\nfor\u202e you  '), 'A contract for you', 'a subject is one line');
  // THE CHAT'S LAW, NOT A COPY: sanitizeChat is visibleText, folded to one line and bounded
  for (const s of [raw, 'a\u200db', '\u{1F468}\u200d\u{1F469}', 'x'.repeat(CHAT_MAX + 9), 'a\u0300\u0300\u0300\u0300b', '\ud800lone']) {
    assert.equal(sanitizeChat(s), visibleText(s).replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX).replace(/[\uD800-\uDBFF]$/, '').trim());
  }
  const wire = src('src/net/wire.js');
  assert.match(wire, /export function sanitizeChat\(text\) \{\n  let s = visibleText\(text\)\.replace\(\/\\s\+\/g, ' '\)\.trim\(\)\.slice\(0, CHAT_MAX\);/, 'the chat line is visibleText, folded and bounded');
  // JOURNAL1 moved the letter's line law into wire.js beside visibleText (wordsLine, foldBlankLines), where the journal
  // page reads it too - one law for a player's lines, and that law is still visibleText's
  assert.match(src('src/net/letterLaw.js'), /import \{ wordsLine, foldBlankLines \} from '\.\/wire\.js';/, 'the letter reads the same law');
  assert.match(wire, /export const wordsLine = \(line\) => visibleText\(String\(line \?\? ''\)/, 'and a line of it is visibleText\'s');
});

test('MAIL1 law: a letter past its bound is REFUSED, never cut - one word each (the service returns them verbatim, and every one has a sentence); and the widest letter a player can type always fits the service\'s 4 KiB body (mutants: a bound off by one; a letter trimmed to fit)', () => {
  assert.deepEqual(letterWords({ subject: 'Hi', body: 'There' }), { subject: 'Hi', body: 'There' });
  assert.deepEqual(letterWords({ subject: '  ', body: 'x' }), { error: 'no-subject' });
  assert.deepEqual(letterWords({ subject: 5, body: 'x' }), { error: 'no-subject' });
  assert.deepEqual(letterWords({ subject: 's', body: '\u200b\n\n' }), { error: 'no-body' });
  assert.deepEqual(letterWords({ subject: 's', body: null }), { error: 'no-body' });
  assert.deepEqual(letterWords({ subject: 's'.repeat(LETTER_SUBJECT_MAX), body: 'b' }).subject.length, LETTER_SUBJECT_MAX);
  assert.deepEqual(letterWords({ subject: 's'.repeat(LETTER_SUBJECT_MAX + 1), body: 'b' }), { error: 'subject-long' });
  assert.equal(letterWords({ subject: 's', body: 'b'.repeat(LETTER_BODY_MAX) }).body.length, LETTER_BODY_MAX);
  assert.deepEqual(letterWords({ subject: 's', body: 'b'.repeat(LETTER_BODY_MAX + 1) }), { error: 'body-long' });
  assert.equal(letterWords({ subject: 's', body: Array(LETTER_LINES_MAX).fill('l').join('\n') }).body.split('\n').length, LETTER_LINES_MAX);
  assert.deepEqual(letterWords({ subject: 's', body: Array(LETTER_LINES_MAX + 1).fill('l').join('\n') }), { error: 'body-lines' });
  assert.equal(letterWords({ subject: 's', body: Array(LETTER_LINES_MAX + 30).fill('l').join('\n\n\n') }).error, 'body-lines', 'blank runs fold to ONE blank line, which is still a line');
  for (const w of ['no-subject', 'subject-long', 'no-body', 'body-long', 'body-lines', 'mail-needs-account', 'muted', 'no-reader', 'to-self', 'inbox-full', 'no-letter', 'mail-rate']) {
    assert.ok(w in REFUSALS && accountRefusalText(w) !== REFUSALS.server, `a sentence for ${w}`);
  }
  // THE ARITHMETIC: the widest request our form can make - every unit of the body the costliest UTF-8 a unit can be
  // (three bytes), the subject the same, the longest handle - is under MAX_BODY_BYTES, so a letter the form lets a
  // player type is never refused as 'body' by the size cap.
  const widest = JSON.stringify({ to: 'h'.repeat(HANDLE_MAX_LEN), subject: '€'.repeat(LETTER_SUBJECT_MAX), body: '€'.repeat(LETTER_BODY_MAX) });
  assert.ok(Buffer.byteLength(widest) < MAX_BODY_BYTES, `${Buffer.byteLength(widest)} bytes`);
  const quotes = JSON.stringify({ to: 'h'.repeat(HANDLE_MAX_LEN), subject: '"'.repeat(LETTER_SUBJECT_MAX), body: '"\n'.repeat(LETTER_BODY_MAX / 2) });
  assert.ok(Buffer.byteLength(quotes) < MAX_BODY_BYTES, 'and the escapes JSON adds (a quote, a newline) too');
});

// ── THE SERVICE ────────────────────────────────────────────────────────────────────────────────────────────────────

test('MAIL1 service: four routes behind a session, none open; acct6; a GUEST can neither read nor write (mail-needs-account, 403) and cannot be written to; the wrong method is refused (mutants: the wall dropped; a route opened to strangers)', async () => {
  for (const r of ['/v1/mail/inbox', '/v1/mail/send', '/v1/mail/read', '/v1/mail/delete']) { assert.ok(ROUTES.has(r), r); assert.ok(!OPEN_ROUTES.has(r)); }
  assert.equal(ACCOUNT_VERSION, 'acct8');   // acct6 was MAIL1's letters; TITLE-N's Dungeon Master and Patreon tiers moved it on (acct7), FOUNDER2's cutoff again (acct8)
  const svc = await service();
  const ann = await svc.player('p_ann_0000000001', 'Ann');
  const guest = await svc.player('p_gst_0000000001', null);
  for (const [path, body] of [['/v1/mail/inbox', null], ['/v1/mail/send', { to: 'Ann', subject: 's', body: 'b' }], ['/v1/mail/read', { id: 'x'.repeat(24) }], ['/v1/mail/delete', { id: 'x'.repeat(24) }]]) {
    const r = await svc.call(guest, path, body);
    assert.deepEqual([r.status, r.data], [403, { error: 'mail-needs-account' }], path);
  }
  assert.deepEqual((await svc.send(ann, 'Guest p_gs')).data, { error: 'no-reader' }, 'a guest\'s generated name is not an address');
  assert.equal((await svc.call(ann, '/v1/mail/inbox', { x: 1 })).status, 405, 'the box is a GET');
  // ...and the function asks again: a wall its caller forgot is not a wall it lacks
  const guestRow = svc.db._raw.prepare('SELECT * FROM players WHERE id = ?').get(guest.id);
  assert.deepEqual(await sendLetter({ db: svc.db, rand, nowS: Math.floor(Date.now() / 1000) }, { ...guestRow }, { to: 'Ann', subject: 's', body: 'b' }), { error: 'mail-needs-account' });
  assert.equal((await svc.call(ann, '/v1/mail/send', null, 'GET')).status, 405);
  const noAuth = await svc.fetch('https://svc/v1/mail/inbox');
  assert.equal(noAuth.status, 401);
});

test('MAIL1 service: a letter goes registered to registered BY HANDLE (any case), cleaned, from the sender\'s own name - and lands in the reader\'s box as a head (no body), newest first, unread, with the sender\'s badge as the service would sign it now (mutants: the name taken from the frame; the body in the list; the order)', async () => {
  const svc = await service({ env: { DEVELOPER_HANDLES: 'Ann' } });
  const ann = await svc.player('p_ann_0000000001', 'Ann');
  const bob = await svc.player('p_bob_0000000001', 'Bob');
  const old = await svc.player('p_cid_0000000001', 'Cid', { created: Math.floor(Date.now() / 1000) - 40 * 86400 });
  const r1 = await svc.call(ann, '/v1/mail/send', { to: 'bOB', subject: '  A\u202e contract ', body: 'Line one\n\n\n\nLine two', from: 'Mallory' });
  assert.equal(r1.status, 200);
  assert.equal(r1.data.to, 'Bob', 'the reader\'s handle as THEY spell it');
  assert.match(r1.data.id, LETTER_ID_RE);
  // a later second - newest first is by the SERVICE's clock, so the service's clock is moved rather than waited for
  const realNow = Date.now;
  Date.now = () => realNow() + 5000;
  try { assert.equal((await svc.send(old, 'Bob', 'Later', 'Second letter')).status, 200); } finally { Date.now = realNow; }
  const box = await svc.call(bob, '/v1/mail/inbox');
  assert.equal(box.status, 200);
  assert.equal(box.data.unread, 2);
  assert.equal(box.data.max, LETTERS_INBOX_MAX);
  assert.deepEqual(box.data.letters.map((l) => l.subject), ['Later', 'A contract'], 'newest first');
  const [later, first] = box.data.letters;
  assert.equal(first.from, 'Ann', 'the SENDER\'s own name - a `from` in the body is read by nobody');
  assert.deepEqual(first.glyphs, ['sprout', 'dev'], 'the badge as a token would carry it: a new account\'s sprout, the developer list\'s mark');
  assert.deepEqual(later.glyphs, [], 'an account past its fortnight wears no sprout');
  assert.equal(first.read, false);
  assert.equal('body' in first, false, 'a head, never a body');
  const row = svc.db._raw.prepare('SELECT * FROM letters WHERE id = ?').get(r1.data.id);
  assert.equal(row.body, 'Line one\n\nLine two', 'kept as cleaned');
  assert.equal(row.from_name, 'Ann');
  assert.deepEqual((await svc.call(ann, '/v1/mail/inbox')).data.letters, [], 'the sender\'s own box holds nothing of it');
});

test('MAIL1 service: the refusals - nobody by that name, oneself, a mute (403), each word of the law (400) - and none of them writes a letter (mutants: a muted sender heard; a letter to oneself kept)', async () => {
  const svc = await service();
  const ann = await svc.player('p_ann_0000000001', 'Ann');
  await svc.player('p_bob_0000000001', 'Bob');
  const cases = [
    [{ to: 'Zed', subject: 's', body: 'b' }, 404, 'no-reader'],
    [{ to: 'no spaces allowed', subject: 's', body: 'b' }, 404, 'no-reader'],   // not a handle's shape: refused before any rate is spent (below)
    [{ to: 'ann', subject: 's', body: 'b' }, 400, 'to-self'],
    [{ to: 'Bob', subject: '', body: 'b' }, 400, 'no-subject'],
    [{ to: 'Bob', subject: 's'.repeat(LETTER_SUBJECT_MAX + 1), body: 'b' }, 400, 'subject-long'],
    [{ to: 'Bob', subject: 's', body: '' }, 400, 'no-body'],
    [{ to: 'Bob', subject: 's', body: 'b'.repeat(LETTER_BODY_MAX + 1) }, 400, 'body-long'],
  ];
  for (const [body, status, error] of cases) {
    const r = await svc.call(ann, '/v1/mail/send', body);
    assert.deepEqual([r.status, r.data], [status, { error }], error);
  }
  assert.equal(svc.db._raw.prepare("SELECT count FROM rate_limits WHERE key = 'mail:p_ann_0000000001'").get().count, 2, 'the sender\'s rate spent on the two that reached a lookup (Zed, and herself) - not on a shape no handle has, nor on words the law refused');
  svc.db._raw.prepare('UPDATE players SET muted_until = ? WHERE id = ?').run(Math.floor(Date.now() / 1000) + 600, 'p_ann_0000000001');
  assert.deepEqual((await svc.send(ann, 'Bob')).data, { error: 'muted' });
  assert.equal((await svc.send(ann, 'Bob')).status, 403);
  assert.equal(svc.db._raw.prepare('SELECT COUNT(*) AS n FROM letters').get().n, 0, 'not one letter written');
  svc.db._raw.prepare('UPDATE players SET muted_until = ? WHERE id = ?').run(Math.floor(Date.now() / 1000) - 1, 'p_ann_0000000001');
  assert.equal((await svc.send(ann, 'Bob')).status, 200, 'a mute that has ended stops nothing');
});

test('MAIL1 service: an hour\'s letters - LETTERS_PAIR_MAX to one reader, LETTERS_SENT_MAX to anyone, `mail-rate` (429) past either; the sender\'s rate is spent BEFORE the reader is looked up, so the lookup cannot be ground (mutants: the pair rate dropped; the sender rate dropped; the lookup first)', async () => {
  const svc = await service();
  const ann = await svc.player('p_ann_0000000001', 'Ann');
  const readers = [];
  for (let i = 0; i < 6; i++) readers.push(await svc.player(`p_r${i}_000000000${i}`, `Reader${i}`));
  for (let k = 0; k < LETTERS_PAIR_MAX; k++) assert.equal((await svc.send(ann, 'Reader0')).status, 200);
  assert.deepEqual((await svc.send(ann, 'Reader0')).data, { error: 'mail-rate' }, 'one reader\'s share spent');
  assert.equal((await svc.send(ann, 'Reader1')).status, 200, 'another reader is another pair');
  let sent = LETTERS_PAIR_MAX + 1, n = 1;
  for (let i = 1; sent < LETTERS_SENT_MAX; i = (i % 5) + 1) { if ((await svc.send(ann, `Reader${i}`)).status === 200) sent++; if (++n > 60) break; }
  const past = await svc.send(ann, 'Reader5');
  assert.deepEqual([past.status, past.data], [429, { error: 'mail-rate' }], 'an hour\'s letters to anyone');
  // the sender's rate is spent on a lookup that finds nobody, too - a handle cannot be probed for free
  const bob = await svc.player('p_bob_0000000001', 'Bob');
  for (let k = 0; k < LETTERS_SENT_MAX; k++) await svc.send(bob, `Nobody${k}`);
  assert.deepEqual((await svc.send(bob, 'Reader0')).data, { error: 'mail-rate' });
  const code = src('server-account/src/letters.js');
  assert.ok(code.indexOf('`mail:${sender.id}`') < code.indexOf("SELECT id, handle FROM players WHERE handle_lc = ?"), 'the rate before the lookup');
});

test('MAIL1 service: a FULL box refuses the sender (inbox-full, 409) and keeps every letter the reader has - its oldest is never thrown away for a stranger\'s newest - and two letters racing for the last place land ONE (mutants: the bound dropped; the check apart from the write)', async () => {
  const svc = await service();
  const bob = await svc.player('p_bob_0000000001', 'Bob');
  const senders = [];
  for (let i = 0; i < 3; i++) senders.push(await svc.player(`p_s${i}_000000000${i}`, `Sender${i}`));
  const ins = svc.db._raw.prepare('INSERT INTO letters (id, to_id, from_id, from_name, subject, body, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (let i = 0; i < LETTERS_INBOX_MAX - 1; i++) ins.run(`seed${String(i).padStart(20, '0')}`, bob.id, 'p_x', 'Someone', `Old ${i}`, 'b', 1000 + i);
  // two at once for the last place: the bound is IN the write, so exactly one lands
  const [a, b] = await Promise.all([svc.send(senders[0], 'Bob'), svc.send(senders[1], 'Bob')]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409], 'one landed, one was told the box is full');
  assert.equal(svc.db._raw.prepare('SELECT COUNT(*) AS n FROM letters WHERE to_id = ?').get(bob.id).n, LETTERS_INBOX_MAX);
  const full = await svc.send(senders[2], 'Bob');
  assert.deepEqual([full.status, full.data], [409, { error: 'inbox-full' }]);
  assert.ok(svc.db._raw.prepare("SELECT 1 FROM letters WHERE id = 'seed00000000000000000000'").get(), 'the oldest letter is still the reader\'s');
  assert.match(src('server-account/src/letters.js'), /SELECT \?, \?, \?, \?, \?, \?, \? WHERE \(SELECT COUNT\(\*\) FROM letters WHERE to_id = \?\) < \?/, 'one statement');
});

test('MAIL1 service: a reader\'s letters are theirs alone - opened (the whole letter, read ONCE: the first opening\'s time kept), thrown away, and `no-letter` (404) for another\'s letter exactly as for none; and a reader who is gone takes their letters with them (mutants: the reader not in the WHERE; the read time rewritten; the cascade)', async () => {
  const svc = await service();
  const ann = await svc.player('p_ann_0000000001', 'Ann');
  const bob = await svc.player('p_bob_0000000001', 'Bob');
  const { data: { id } } = await svc.send(ann, 'Bob', 'Terms', 'Twenty gold, paid at the Rusty Relic.');
  for (const who of [ann, bob]) {
    const peek = await svc.call(who, '/v1/mail/read', { id: who === bob ? 'y'.repeat(24) : id });
    assert.deepEqual([peek.status, peek.data], [404, { error: 'no-letter' }], 'somebody else\'s, and nobody\'s: one word');
  }
  assert.deepEqual((await svc.call(bob, '/v1/mail/read', { id: '../etc' })).data, { error: 'no-letter' });
  const r = await svc.call(bob, '/v1/mail/read', { id });
  assert.equal(r.status, 200);
  assert.deepEqual({ ...r.data.letter, sentAt: 0, readAt: 0 }, { id, from: 'Ann', title: null, glyphs: ['sprout'], subject: 'Terms', body: 'Twenty gold, paid at the Rusty Relic.', sentAt: 0, readAt: 0 });
  const readAt = svc.db._raw.prepare('SELECT read_at FROM letters WHERE id = ?').get(id).read_at;
  assert.ok(readAt > 0);
  svc.db._raw.prepare('UPDATE letters SET read_at = 5 WHERE id = ?').run(id);
  assert.equal((await svc.call(bob, '/v1/mail/read', { id })).data.letter.readAt, 5, 'read ONCE: a second opening is not news');
  assert.deepEqual((await svc.call(bob, '/v1/mail/inbox')).data.unread, 0);
  assert.deepEqual((await svc.call(ann, '/v1/mail/delete', { id })).data, { error: 'no-letter' }, 'the sender cannot take it back');
  assert.deepEqual((await svc.call(bob, '/v1/mail/delete', { id })).data, { ok: true, id });
  assert.deepEqual((await svc.call(bob, '/v1/mail/delete', { id })).data, { error: 'no-letter' }, 'gone is gone');
  // the cascade: a reader's row taken away takes the reader's box; a sender's does not take what they sent
  const second = (await svc.send(ann, 'Bob', 'Again', 'Still here?')).data.id;
  svc.db._raw.prepare('DELETE FROM sessions WHERE player_id = ?').run(ann.id);
  svc.db._raw.prepare('DELETE FROM players WHERE id = ?').run(ann.id);
  const kept = (await svc.call(bob, '/v1/mail/inbox')).data.letters;
  assert.deepEqual(kept.map((l) => [l.id, l.from, l.glyphs]), [[second, 'Ann', []]], 'a sender who is gone: their letter stands, by the name it was sent under, with no badge');
  svc.db._raw.prepare('DELETE FROM sessions WHERE player_id = ?').run(bob.id);
  svc.db._raw.prepare('DELETE FROM players WHERE id = ?').run(bob.id);
  assert.equal(svc.db._raw.prepare('SELECT COUNT(*) AS n FROM letters').get().n, 0, 'and a reader who is gone takes the box');
});

// ── THE BOX ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('MAIL1 box: its states over the real service - signed out (no call made), a guest, ready - and `auth` forgets the session the service stopped honouring (mutants: a call with no session; auth kept)', async () => {
  const svc = await service();
  const { box: none } = boxFor(svc, null);
  await none.refresh();
  assert.equal(none.state, 'signed-out');
  assert.equal(svc.calls(), 0, 'no session, no call');
  const guest = await svc.player('p_gst_0000000001', null);
  const { box: g } = boxFor(svc, guest);
  await g.refresh();
  assert.deepEqual([g.state, g.error], ['guest', 'mail-needs-account']);
  const bob = await svc.player('p_bob_0000000001', 'Bob');
  const { box, storage } = boxFor(svc, bob);
  await box.refresh();
  assert.deepEqual([box.state, box.letters, box.unread, box.max], ['ready', [], 0, LETTERS_INBOX_MAX]);
  svc.db._raw.prepare('DELETE FROM sessions WHERE player_id = ?').run(bob.id);
  await box.refresh();
  assert.equal(box.state, 'signed-out');
  assert.equal(storage.getItem(SESSION_KEY), null, 'a secret the far end stopped honouring is not a session');
});

test('MAIL1 box: a look that finds letters says so ONCE - "waiting" on the first look of a sitting, "new" for each letter after it that was not there - and opening one reads it once (the service marks it; the box keeps its copy; the badge falls) (mutants: every look announces; a letter re-fetched)', async () => {
  const svc = await service();
  const ann = await svc.player('p_ann_0000000001', 'Ann');
  const bob = await svc.player('p_bob_0000000001', 'Bob');
  await svc.send(ann, 'Bob', 'First', 'One');
  const heard = [];
  const { box } = boxFor(svc, bob, { onLetter: (e) => heard.push(e) });
  await box.refresh();
  assert.deepEqual(heard.map((e) => e.kind), ['waiting']);
  assert.equal(heard[0].count, 1);
  assert.equal(mailNoticeText(heard[0]), 'You have 1 unread letter. Open Social, then Letters.');
  await box.refresh();
  assert.equal(heard.length, 1, 'the same box again is not news');
  await svc.send(ann, 'Bob', 'Second', 'Two');
  await box.refresh();
  assert.equal(heard.length, 2);
  assert.equal(heard[1].kind, 'new');
  assert.equal(mailNoticeText(heard[1]), 'A letter from Ann: "Second". Open Social, then Letters.');
  const v = box.version;
  const id = box.letters.find((l) => l.subject === 'Second').id;   // one second can hold both: find it by what it says
  const before = svc.calls();
  const r = await box.open(id);
  assert.equal(r.ok, true);
  assert.equal(r.letter.body, 'Two');
  assert.equal(box.unread, 1);
  assert.ok(box.version > v);
  await box.open(id);
  assert.equal(svc.calls(), before + 1, 'opened twice, fetched once');
  await box.refresh();
  assert.equal(box.letters.find((l) => l.id === id).read, true, 'and the service agrees it was read');
});

test('MAIL1 box: a send is checked by the letter\'s own law BEFORE the network (no call for a letter the service would refuse), the service\'s refusal is passed on, and a letter thrown away leaves the box - also when it was already gone (mutants: the local check dropped; a stale letter kept)', async () => {
  const svc = await service();
  const ann = await svc.player('p_ann_0000000001', 'Ann');
  await svc.player('p_bob_0000000001', 'Bob');
  const { box } = boxFor(svc, ann);
  const n = svc.calls();
  assert.deepEqual(await box.send({ to: 'Bob', subject: '', body: 'b' }), { ok: false, error: 'no-subject' });
  assert.deepEqual(await box.send({ to: 'not a handle', subject: 's', body: 'b' }), { ok: false, error: 'no-reader' });
  assert.deepEqual(await box.send({ to: 'Bob', subject: 's', body: 'b'.repeat(LETTER_BODY_MAX + 1) }), { ok: false, error: 'body-long' });
  assert.equal(svc.calls(), n, 'not one call');
  assert.deepEqual(await box.send({ to: 'Zed', subject: 's', body: 'b' }), { ok: false, error: 'no-reader' }, 'the service\'s own word');
  assert.deepEqual(await box.send({ to: ' bob ', subject: ' Terms ', body: 'b' }), { ok: true, to: 'Bob' });
  const bobSession = await openSession({ db: svc.db, subtle, rand, nowS: Math.floor(Date.now() / 1000) }, 'p_bob_0000000001');
  const { box: bobBox } = boxFor(svc, { id: 'p_bob_0000000001', handle: 'Bob', secret: bobSession.secret });
  await bobBox.refresh();
  const id = bobBox.letters[0].id;
  svc.db._raw.prepare('DELETE FROM letters WHERE id = ?').run(id);   // thrown away on another device
  assert.deepEqual(await bobBox.remove(id), { ok: true });
  assert.deepEqual(bobBox.letters, []);
});

test('MAIL1 box: what the service says is checked before it is kept - a head that is not a letter\'s shape is dropped; the ages read like the friends list; a reply\'s subject is "Re:" once; the poll is due every MAIL_POLL_MS and a signed-out look is stamped, so no frame reads the store twice (mutants: an id unchecked; Re: stacked; the stamp after the session check)', async () => {
  const good = { id: 'a'.repeat(24), from: 'Ann', title: null, glyphs: ['sprout', 7], subject: 'Hi', sentAt: 1_800_000_000, read: false };
  assert.deepEqual(letterHead(good), { ...good, glyphs: ['sprout'] });
  for (const bad of [null, { ...good, id: '<img>' }, { ...good, from: 5 }, { ...good, subject: 's'.repeat(LETTER_SUBJECT_MAX + 1) }, { ...good, sentAt: 'soon' }]) assert.equal(letterHead(bad), null);
  assert.equal(letterWhole({ ...good, body: 'x'.repeat(LETTER_BODY_MAX + 1) }), null);
  assert.equal(letterWhole({ ...good, body: 'ok' }).read, true);
  const at = 1_800_000_000;
  assert.deepEqual([30, 5 * 60, 3 * 3600, 30 * 3600, 5 * 86400, 20 * 86400, 400 * 86400].map((s) => letterAgeText(at, (at + s) * 1000)),
    ['just now', '5 min ago', '3 h ago', 'yesterday', '5 days ago', '2 weeks ago', 'long ago']);
  assert.equal(replySubject('Re: RE: re:A deal'), 'Re: A deal');
  assert.equal(replySubject('x'.repeat(LETTER_SUBJECT_MAX)).length, LETTER_SUBJECT_MAX);
  let t = 1000, reads = 0;
  const box = new MailBox({ ioOf: () => { reads++; return null; }, now: () => t });
  assert.equal(box.due(), true);
  await box.refresh();
  assert.equal(box.due(), false, 'a look with no session is still a look');
  for (let f = 0; f < 60; f++) { t += 16; box.poll(); }
  assert.equal(reads, 1, 'sixty frames, one read of the store');
  t += MAIL_POLL_MS;
  assert.equal(box.due(), true);
});

// ── THE TAB ────────────────────────────────────────────────────────────────────────────────────────────────────────

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '',
    style: {}, dataset: {}, attrs: {}, listeners: new Map(), focused: false,
    append(...cs) { for (const c of cs) { if (typeof c === 'object') { c.parent = n; n.children.push(c); } } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener() {},
    fire(t, e = {}) { const ev = { type: t, target: n, preventDefault() {}, stopPropagation() {}, ...e }; for (const fn of n.listeners.get(t) ?? []) fn(ev); return ev; },
    focus() { n.focused = true; doc.activeElement = n; },
    remove() { n.removed = true; },
  };
  return n;
}
function fakeDocument() {
  const doc = { activeElement: null };
  doc.createElement = (tag) => fakeNode(tag, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  doc.getElementById = () => null;
  return doc;
}
const fakeWin = () => ({ addEventListener() {}, removeEventListener() {} });
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
const one = (n, cls) => find(n, cls)[0];
const texts = (n) => [n.textContent, ...n.children.flatMap(texts)].filter(Boolean);
const button = (root, label) => find(root, 'dfsocial-btn').find((b) => b.textContent === label);

async function tabRig({ signedIn = true, handle = 'Bob' } = {}) {
  const svc = await service();
  const ann = await svc.player('p_ann_0000000001', 'Ann');
  const bob = handle ? await svc.player('p_bob_0000000001', handle) : await svc.player('p_bob_0000000001', null);
  const { box } = boxFor(svc, signedIn ? bob : null);
  // WAIT ON THE WORK, NOT ON THE CLOCK. The service resolves a session through crypto.subtle, which finishes on the
  // thread pool and not in a countable number of turns - so every call the box makes is tracked, and a frame waits for
  // all of them (and the panel's own `.then`s, attached first, run first).
  const pending = new Set();
  for (const k of ['refresh', 'open', 'send', 'remove']) {
    const f = box[k].bind(box);
    box[k] = (...a) => { const p = f(...a); pending.add(p); p.finally(() => pending.delete(p)); return p; };
  }
  const settle = async () => { while (pending.size) await Promise.allSettled([...pending]); await new Promise((r) => setImmediate(r)); };
  const social = new SocialState({ acct: 'acct-bob-1' });
  const doc = fakeDocument();
  const panel = createSocialPanel({ social, mail: box, doc, win: fakeWin(), overlay: () => false, touch: false });
  const frame = async () => { await settle(); panel.render(); };
  return { svc, ann, bob, box, social, panel, doc, frame };
}

test('MAIL1 tab: a third tab only where the host hands a letterbox; its badge is the unread count; the box, newest first, a brass dot on the unopened, the fill beside its name - and the sentences for a box nobody can have yet (mutants: the tab always drawn; the badge not the box\'s)', async () => {
  const bare = createSocialPanel({ social: new SocialState({ acct: 'a' }), doc: fakeDocument(), win: fakeWin(), overlay: () => false, touch: false });
  assert.deepEqual(find(bare.root, 'dfsocial-tab').map((t) => t.dataset.tab), ['friends', 'party'], 'no box, no tab');
  const { svc, ann, panel, frame } = await tabRig();
  assert.deepEqual(find(panel.root, 'dfsocial-tab').map((t) => t.dataset.tab), ['friends', 'party', 'letters']);
  await svc.send(ann, 'Bob', 'A contract', 'Terms');
  assert.equal(panel.openLetters(), true);
  assert.equal(panel.tab(), 'letters');
  await frame(); await frame();
  const tab = find(panel.root, 'dfsocial-tab').find((t) => t.dataset.tab === 'letters');
  assert.equal(one(tab, 'dfsocial-badge').textContent, '1', 'the unread count');
  const rows = find(panel.root, 'dfsocial-letter');
  assert.equal(rows.length, 1);
  assert.ok(one(rows[0], 'unread'), 'the brass dot');
  assert.deepEqual(texts(rows[0]), ['Ann', 'A contract', 'just now'], 'who, what about, how long ago');
  assert.ok(texts(panel.root).includes(`Letters (1/${LETTERS_INBOX_MAX})`), 'the fill');
  const out = await tabRig({ signedIn: false });
  out.panel.openLetters(); await out.frame(); await out.frame();
  assert.ok(texts(out.panel.root).includes(LETTERS_SIGNED_OUT_TEXT));
  const guest = await tabRig({ handle: null });
  guest.panel.openLetters(); await guest.frame(); await guest.frame();
  assert.ok(texts(guest.panel.root).includes(REFUSALS['mail-needs-account']));
  const empty = await tabRig();
  empty.panel.openLetters(); empty.panel.render();
  assert.ok(texts(empty.panel.root).includes(LETTERS_LOOKING_TEXT), 'before the first look lands');
  await empty.frame(); await empty.frame();
  assert.ok(texts(empty.panel.root).includes(NO_LETTERS_TEXT));
});

test('MAIL1 tab: a row opens the letter - its words as TEXT, its lines kept - and it is read now; Reply writes back to the handle it came from with "Re:"; Delete arms, and the second press throws it away (mutants: Delete on one press; the reply to the wrong name)', async () => {
  const { svc, ann, box, panel, frame } = await tabRig();
  await svc.send(ann, 'Bob', 'Terms', 'Twenty gold.\n\n<b>Paid</b> at the Relic.');
  panel.openLetters(); await frame(); await frame();
  one(panel.root, 'dfsocial-letter').fire('click');
  await frame(); await frame();
  assert.equal(panel.lettersView(), 'read');
  assert.equal(one(panel.root, 'dfsocial-subject').textContent, 'Terms');
  assert.equal(one(panel.root, 'dfsocial-lettertext').textContent, 'Twenty gold.\n\n<b>Paid</b> at the Relic.', 'text, never markup - and its lines');
  assert.equal(box.unread, 0);
  button(panel.root, 'Reply').fire('click');
  panel.render();
  assert.equal(panel.lettersView(), 'write');
  const [to, subject] = find(panel.root, 'dfsocial-field');
  assert.deepEqual([to.value, subject.value], ['Ann', 'Re: Terms']);
  button(panel.root, 'Cancel').fire('click');
  one(panel.root, 'dfsocial-letter').fire('click');
  await frame(); await frame();
  button(panel.root, 'Delete').fire('click');
  panel.render();
  assert.equal(box.letters.length, 1, 'one press only arms it');
  button(panel.root, 'Sure?').fire('click');
  await frame(); await frame();
  assert.deepEqual(box.letters, []);
  assert.equal(panel.lettersView(), 'list');
  assert.equal(svc.db._raw.prepare('SELECT COUNT(*) AS n FROM letters').get().n, 0);
});

test('MAIL1 tab: THE FORM - its caps are the service\'s bounds; what is typed is kept on every keystroke and NO repaint rebuilds it (a presence frame, a look landing); Send carries the draft, a refusal is said in the service\'s words and the draft stays, a letter sent says so and clears it (mutants: the form rebuilt by a frame; the draft lost on a refusal)', async () => {
  const { svc, ann, box, social, panel, frame } = await tabRig();
  panel.openLetters({ to: 'Ann' });
  panel.render();
  assert.equal(panel.lettersView(), 'write');
  const [to, subject, body] = find(panel.root, 'dfsocial-field');
  assert.deepEqual([to.maxLength, subject.maxLength, body.maxLength], [HANDLE_MAX_LEN, LETTER_SUBJECT_MAX, LETTER_BODY_MAX]);
  assert.equal(to.value, 'Ann');
  subject.value = 'Terms'; subject.fire('input');
  body.value = 'x'.repeat(10); body.fire('input');
  assert.equal(one(panel.root, 'dfsocial-count').textContent, `10/${LETTER_BODY_MAX}`);
  // a presence frame and a look landing: the SAME nodes stand
  social.version++; box.version++;
  panel.render();
  assert.equal(find(panel.root, 'dfsocial-field')[2], body, 'not rebuilt under the caret');
  to.value = 'Zed'; to.fire('input');
  button(panel.root, 'Send').fire('click');
  await frame(); await frame();
  assert.ok(texts(panel.root).includes(REFUSALS['no-reader']), 'the service\'s own sentence');
  assert.deepEqual(find(panel.root, 'dfsocial-field').map((f) => f.value), ['Zed', 'Terms', 'x'.repeat(10)], 'and the draft stands');
  const [to2] = find(panel.root, 'dfsocial-field');
  to2.value = 'Ann'; to2.fire('input');
  button(panel.root, 'Send').fire('click');
  await frame(); await frame();
  assert.equal(panel.lettersView(), 'list');
  assert.ok(texts(panel.root).includes('Your letter to Ann is on its way.'));
  const kept = svc.db._raw.prepare('SELECT subject, body, from_name FROM letters').get();
  assert.deepEqual({ ...kept }, { subject: 'Terms', body: 'x'.repeat(10), from_name: 'Bob' });
  panel.openLetters({ to: 'Cid' });
  panel.render();
  assert.equal(find(panel.root, 'dfsocial-field')[1].value, '', 'a fresh letter after one sent');
  void ann;
});

test('MAIL1 tab: a friend\'s row writes them a letter - enabled for a username, refused with its reason for a guest\'s generated name (mutants: the button on every row; a guest written to)', async () => {
  const { social, panel } = await tabRig();
  social.apply({ t: 'social', k: 'state', acct: 'acct-bob-1', name: 'Bob', peers: [], friends: [{ acct: 'acct-ann-1', name: 'Ann', online: false, seen: null, peers: [] }, { acct: 'acct-gst-1', name: 'Lysandus Tell', online: false, seen: null, peers: [] }], in: [], out: [], party: null, invites: [] });
  panel.open();
  panel.render();
  const letterBtns = find(panel.root, 'dfsocial-btn').filter((b) => b.textContent.startsWith('Letter'));
  assert.equal(letterBtns.length, 2);
  const [annBtn, guestBtn] = letterBtns;
  assert.equal(guestBtn.disabled, true);
  assert.equal(guestBtn.attrs.title, 'no username');
  annBtn.fire('click');
  panel.render();
  assert.equal(panel.tab(), 'letters');
  assert.equal(panel.lettersView(), 'write');
  assert.equal(find(panel.root, 'dfsocial-field')[0].value, 'Ann');
});

// ── THE HOST, BY SOURCE ────────────────────────────────────────────────────────────────────────────────────────────

test('MAIL1 host by source: the box is made with the panel over the ACCOUNT SERVICE - its io read from the store at each call - handed to the panel, polled from the online frame before the dead return, and a look that finds letters says so on the world tab (mutants: the box never polled; the notice dropped; the io captured once)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /import \{ MailBox, mailNoticeText \} from '\.\.\/net\/mail\.js';/);
  const made = w.slice(w.indexOf('mail = new MailBox({'), w.indexOf('socialPanel = createSocialPanel({'));
  assert.match(made, /ioOf: \(\) => \{\s*const st = appStorage\(\);\s*const s = storedSession\(st\);\s*return s \? \{ fetch: \(u, i\) => globalThis\.fetch\(u, i\), base: serviceBase\(st\), secret: s\.secret, storage: st \} : null;\s*\},/);
  assert.match(made, /onLetter: \(event\) => \{ chatLog\.push\(tab\.id, \{ text: mailNoticeText\(event\), system: true \}\); \},/);
  assert.match(w, /socialPanel = createSocialPanel\(\{\s*social,\s*mail,/);
  assert.match(w, /const onlineFrame = \(now, dt\) => \{[\s\S]{0,700}?\n\s*mail\?\.poll\(\);[^\n]*\n[\s\S]{0,300}?if \(townTalk\.overlay instanceof DeathScreen/, 'polled before the dead return');
});
