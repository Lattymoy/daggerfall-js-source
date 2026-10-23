// AUDIT 28 (2026-09-28, Mac: "let's audit everything we have so far before we continue") - NOTICE1's findings, each
// pinned against the real Worker over node:sqlite (test/accountDb.mjs), the client's book, or the board's window on
// the minimal DOM (test/chargenDom.mjs), and each failing on the code before the fix. bible/06-Systems/
// Professions-Arc.md 10.7 (AUDIT 28).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { byClass } from '../chargenDom.mjs';
import { standService, T0, sessionStorageOf } from '../accountDb.mjs';
import { accountBoard, SESSION_KEY, REFUSALS } from '../../src/net/accountClient.js';
import { createNoticeBook, planNoteAnswer, NOTE_LETTER_START, NOTE_LETTER_LOST, NOTICE_RETRY_MS } from '../../src/net/noticeBook.js';
import { noteReplySubject, NOTE_SUBJECT_MAX } from '../../src/net/boardLaw.js';
import { mountNoticeBoard } from '../../src/ui/noticeWindow.js';
import { GUILD_FOUND_RENOWN } from '../../src/net/guild/guildLaw.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const TOWN = 1234567;
const DAY = 86400;
let _rid = 0;
const rid = () => `aud-${String(++_rid).padStart(6, '0')}`;
const noWait = () => Promise.resolve();
const tick = () => new Promise((r) => setTimeout(r, 0));

async function board(extra = {}) {
  const svc = await standService({ BOARD_OPEN: 'on', DEVELOPER_HANDLES: 'Devra', MODERATOR_HANDLES: 'Mora', ...extra });
  const read = (who, map = TOWN) => svc.call('/v1/board/read', { map }, who.secret);
  const pin = (who, extra2 = {}) => svc.call('/v1/board/pin', { map: TOWN, subject: 'Hands wanted', body: 'Meet at the gate at dusk.', days: 7, rid: rid(), ...extra2 }, who.secret);
  const seasoned = (...who) => { for (const w of who) svc.env.DB._raw.prepare('UPDATE players SET created_at = ? WHERE id = ?').run(Math.floor(Date.now() / 1000) - 15 * DAY, w.id); };
  const bookOf = (who, door = null) => createNoticeBook({ door: door ?? accountBoard({ fetch: svc.fetch, storage: sessionStorageOf(SESSION_KEY, who) }), sleep: noWait });
  return { ...svc, read, pin, seasoned, bookOf };
}

test('AUDIT 28 N1/N16: a note\'s button is answered by ONE plan, the same shape from every exit - and the letter goes through the pending door, never opened under the closing board', () => {
  const note = { from: 'Anna', subject: 'Hands wanted', button: 'party' };
  const plans = [
    planNoteAnswer(note, { mail: 'signed-in', letters: true }),
    planNoteAnswer({ ...note, button: 'duel' }, { duelHere: true, mail: 'signed-in', letters: true }),
    planNoteAnswer(note, { mail: 'guest', letters: true }),
    planNoteAnswer(note, { mail: 'signed-out', letters: true, signedOutText: 'Sign in.' }),
    planNoteAnswer(note, { mail: 'signed-in', letters: false }),
    planNoteAnswer(null),
  ];
  assert.deepEqual(plans.map((p) => p.kind), ['letter', 'duel', 'refuse', 'refuse', 'refuse', 'refuse']);
  assert.ok(plans.every((p) => p && typeof p === 'object' && typeof p.kind === 'string'), 'THE MODAL CONTRACT: an object from every exit');
  assert.ok(plans.filter((p) => p.kind === 'refuse').every((p) => typeof p.text === 'string' && p.text), 'and every refusal says why');
  assert.deepEqual(plans[0].draft, { to: 'Anna', subject: 'Re: Hands wanted', body: NOTE_LETTER_START.party });
  assert.equal(planNoteAnswer({ ...note, button: 'duel' }, { duelHere: false, mail: 'signed-in', letters: true }).kind, 'letter', 'a duel out of reach is a letter');
  const w = src('src/scenes/world.js');
  const answer = w.slice(w.indexOf('const answerNote = (note) => {'), w.indexOf('\n  };', w.indexOf('const answerNote = (note) => {')));
  assert.match(answer, /_letterPending = \{ draft: plan\.draft, at: performance\.now\(\), lost: NOTE_LETTER_LOST \}; closeNoticeDoor\(\);/);
  assert.doesNotMatch(answer, /openLetters/, 'never opened directly: the board still holds the slot this frame');
  assert.match(w, /tradeSay\(_letterPending\.lost \?\? 'Your letters could not be opened\. The page is still in your journal\.'\)/, 'a note\'s letter that cannot open says the note\'s words');
  assert.equal(NOTE_LETTER_LOST, 'Your letters could not be opened. The note is still on the board.');
});

test('AUDIT 28 N15: a reply\'s subject is never cut - "Re: " only where it fits, and never twice', () => {
  const full = 'x'.repeat(NOTE_SUBJECT_MAX);
  assert.equal(noteReplySubject('Hands wanted'), 'Re: Hands wanted');
  assert.equal(noteReplySubject(full), full, 'the note\'s own, whole');
  assert.equal(noteReplySubject('re: an answer'), 're: an answer');
  assert.equal(noteReplySubject(`${'y'.repeat(NOTE_SUBJECT_MAX - 5)}😀`), `${'y'.repeat(NOTE_SUBJECT_MAX - 5)}😀`, 'a two-unit character is never split');
});

test('AUDIT 28 N2: a note hidden by reports stays in its author\'s view, marked, and can be taken down - the place it holds is never lost', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const b = await board();
  const anna = await b.registered('Anna');
  const readers = [await b.registered('Bran'), await b.registered('Cyra'), await b.registered('Dorn')];
  b.seasoned(...readers);
  const n = (await b.pin(anna)).body.note;
  for (const r of readers) await b.call('/v1/board/report', { id: n.id }, r.secret);
  const mine = (await b.read(anna)).body;
  assert.deepEqual([mine.notes.length, mine.notes[0].hidden, mine.me.live], [1, true, 1]);
  assert.equal((await b.call('/v1/board/take-down', { id: n.id }, anna.secret)).body.live, 0);
});

test('AUDIT 28 N3: only a report from an account neither muted nor a sprout counts toward hiding a note - any report still hides it from its reporter', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const b = await board();
  const anna = await b.registered('Anna');
  const eld = await b.registered('Eld');
  const fresh = [await b.registered('Bran'), await b.registered('Cyra'), await b.registered('Dorn')];
  const n = (await b.pin(anna)).body.note;
  for (const r of fresh) await b.call('/v1/board/report', { id: n.id }, r.secret);
  assert.equal((await b.read(eld)).body.notes.length, 1, 'three accounts made this minute hide nothing');
  assert.equal((await b.read(fresh[0])).body.notes.length, 0, '...but none of them sees it again');
  const muted = [await b.registered('Gale'), await b.registered('Hale'), await b.registered('Ira')];
  b.seasoned(...muted);
  const mora = await b.registered('Mora');
  for (const m of muted) await b.call('/v1/mod/mute', { target: m.id, minutes: 60 }, mora.secret);
  const n2 = (await b.pin(anna)).body.note;
  for (const m of muted) await b.call('/v1/board/report', { id: n2.id }, m.secret);
  assert.equal((await b.read(eld)).body.notes.some((x) => x.id === n2.id), true, 'three muted accounts hide nothing');
  const aged = [await b.registered('Jory'), await b.registered('Kell'), await b.registered('Lune')];
  b.seasoned(...aged);
  for (const a of aged) await b.call('/v1/board/report', { id: n2.id }, a.secret);
  assert.equal((await b.read(eld)).body.notes.some((x) => x.id === n2.id), false, 'three seasoned readers do');
});

test('AUDIT 28 N4: a recruitment note recruits only while its author can still invite to that guild', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const b = await board();
  const gm = await b.registered('Aldric', { renown: GUILD_FOUND_RENOWN });
  const off = await b.registered('Ottar');
  const { guild } = (await b.found(gm, { name: 'The Hound', tag: 'HND' })).body;
  await b.call('/v1/guilds/invite', { character: gm.character, handle: 'ottar' }, gm.secret);
  await b.call('/v1/guilds/answer', { character: off.character, guild: guild.id, accept: true }, off.secret);
  const members = () => b.call('/v1/guilds/mine', { character: gm.character }, gm.secret).then((r) => r.body.guild.members);
  const ottar = (await members()).find((m) => m.name === 'Ottar').member;
  assert.equal((await b.call('/v1/guilds/rank', { character: gm.character, member: ottar, rank: 1 }, gm.secret)).status, 200, 'an officer');
  assert.equal((await b.pin(off, { button: 'guild', character: off.character })).status, 200);
  const seen = async () => (await b.read(gm)).body.notes.find((x) => x.from === 'Ottar');
  assert.deepEqual([(await seen()).button, (await seen()).guild?.tag], ['guild', 'HND']);
  await b.call('/v1/guilds/rank', { character: gm.character, member: ottar, rank: 3 }, gm.secret);
  assert.deepEqual([(await seen()).button, (await seen()).guild], [null, undefined], 'demoted to a rank that may not invite: the button and the seal go');
  await b.call('/v1/guilds/rank', { character: gm.character, member: ottar, rank: 1 }, gm.secret);
  assert.equal((await seen()).button, 'guild', 'promoted again, it recruits again');
  await b.call('/v1/guilds/remove', { character: gm.character, member: ottar }, gm.secret);
  assert.equal((await seen()).button, null, 'removed from the guild: it recruits for nobody');
});

test('AUDIT 28 N5: a pin whose every try was lost keeps its id for the next press - one note, never two', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const b = await board();
  const anna = await b.registered('Anna');
  const real = accountBoard({ fetch: b.fetch, storage: sessionStorageOf(SESSION_KEY, anna) });
  let lose = true;
  const lossy = { ...real, pin: async (n, r) => { const x = await real.pin(n, r); return lose ? { ok: false, error: 'offline' } : x; } };
  const waits = [];
  const book = createNoticeBook({ door: lossy, sleep: async (ms) => { waits.push(ms); } });
  const note = { subject: 'Hands wanted', body: 'Meet at dusk.', days: 3, button: null };
  assert.equal((await book.pin(TOWN, note)).ok, false);
  assert.deepEqual(waits, NOTICE_RETRY_MS, 'the tries wait between them');
  lose = false;
  assert.equal((await book.pin(TOWN, note)).ok, true);
  assert.equal((await b.read(anna)).body.notes.length, 1, 'one note');
});

test('AUDIT 28 N6: a board request that hangs is given up as offline, never a read that wedges the window', async () => {
  const hung = (url, init) => new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
  const door = accountBoard({ fetch: hung, storage: sessionStorageOf(SESSION_KEY, { secret: 'sek', id: 'acct-1' }), waitMs: 20 });
  const alive = setTimeout(() => {}, 5000);
  try { assert.deepEqual(await door.read(TOWN), { ok: false, error: 'offline' }); } finally { clearTimeout(alive); }
});

test('AUDIT 28 N7: a notice carries its own id - posted twice, one notice; a take-down asked again after a lost answer is done, not "no such note"', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const b = await board();
  const devra = await b.registered('Devra');
  const anna = await b.registered('Anna');
  const r = rid();
  const first = (await b.call('/v1/board/notice', { subject: 'Festival', body: 'Ale at noon.', days: 3, rid: r }, devra.secret)).body;
  const again = (await b.call('/v1/board/notice', { subject: 'Festival', body: 'Ale at noon.', days: 3, rid: r }, devra.secret)).body;
  assert.deepEqual([again.repeat, again.id], [true, first.id]);
  assert.equal((await b.read(anna)).body.notices.length, 1);
  const real = accountBoard({ fetch: b.fetch, storage: sessionStorageOf(SESSION_KEY, anna) });
  const n = (await b.pin(anna)).body.note;
  let first2 = true;
  const lossy = { ...real, takeDown: async (id) => { const x = await real.takeDown(id); if (first2) { first2 = false; return { ok: false, error: 'offline' }; } return x; } };
  const book = createNoticeBook({ door: lossy, sleep: noWait });
  const down = await book.takeDown(TOWN, n.id);
  assert.deepEqual([down.ok, down.text], [true, 'Your note is taken down.']);
  const dev = createNoticeBook({ door: accountBoard({ fetch: b.fetch, storage: sessionStorageOf(SESSION_KEY, devra) }), sleep: noWait });
  const d = dev.noticeDraft();
  Object.assign(d, { subject: 'Races', body: 'At the docks.', days: 2 });
  assert.equal((await dev.notice(TOWN, { ...d })).ok, true);
});

test('AUDIT 28 N8: a pin that fails for any reason but its twin is the service\'s fault, asked again - never "your three notes are up"', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const b = await board();
  const anna = await b.registered('Anna');
  b.env.DB._raw.exec("CREATE TRIGGER boom BEFORE INSERT ON board_notes BEGIN SELECT RAISE(ABORT, 'the disk is full'); END");
  const r = await b.pin(anna);
  assert.equal(r.status, 500);
  assert.notEqual(r.body?.error, 'notes-full');
});

test('AUDIT 28 N9/N13: the window does one act at a time, and what is being written outlives the window', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const b = await board();
  const anna = await b.registered('Anna');
  const bran = await b.registered('Bran');
  const n = (await b.pin(anna)).body.note;
  const real = accountBoard({ fetch: b.fetch, storage: sessionStorageOf(SESSION_KEY, bran) });
  let reports = 0;
  const counting = { ...real, report: async (id) => { reports++; return real.report(id); } };
  const book = createNoticeBook({ door: counting, sleep: noWait });
  const host = document.createElement('div');
  const v = mountNoticeBoard(host, { town: { name: 'Daggerfall', mapId: TOWN }, book });
  for (let i = 0; i < 5; i++) await tick();
  const card = byClass(host, 'notice-card').find((c) => c.textContent.includes('Hands wanted'));
  card.onclick();
  const report = byClass(host, 'notice-report')[0];
  report.click(); report.click();
  for (let i = 0; i < 5; i++) await tick();
  assert.equal(reports, 1, 'a double press is one report');
  v.unmount();
  book.draft(TOWN).subject = 'Half written';
  const v2 = mountNoticeBoard(host, { town: { name: 'Daggerfall', mapId: TOWN }, book });
  for (let i = 0; i < 5; i++) await tick();
  byClass(host, 'notice-pinbtn')[0].click();
  assert.equal(byClass(host, 'notice-input')[0].value, 'Half written', 'the note is still there when the board opens again');
  v2.unmount();
});

test('AUDIT 28 N10: a forced read after a write never answers with a read that set out before it', async () => {
  let n = 0;
  let releaseFirst;
  const firstGate = new Promise((r) => { releaseFirst = r; });
  const door = { read: async () => { const k = ++n; if (k === 1) await firstGate; return { ok: true, data: { k, notes: [], notices: [] } }; } };
  const book = createNoticeBook({ door, sleep: noWait });
  const before = book.read(TOWN);
  const after = book.read(TOWN, { force: true });
  releaseFirst();
  assert.equal((await before).board.k, 1);
  assert.equal((await after).board.k, 2, 'the forced read asked again');
});

test('AUDIT 28 N11: a board no longer open to this account is DFU\'s own sign again - the switch shut, or the session gone', async () => {
  for (const error of ['board-closed', 'no-session', 'auth']) {
    let answer = { ok: true, data: { notes: [], notices: [] } };
    const book = createNoticeBook({ door: { read: async () => answer }, sleep: noWait });
    await book.read(TOWN);
    assert.equal(book.open, true);
    answer = { ok: false, error };
    await book.read(TOWN, { force: true });
    assert.equal(book.open, false, error);
  }
});

test('AUDIT 28 N12: the count over a board reads storage once, not every frame', async () => {
  let reads = 0;
  const storage = { getItem: () => { reads++; return null; }, setItem() {} };
  const book = createNoticeBook({ door: { read: async () => ({ ok: true, data: { notes: [{ at: 5 }], notices: [] } }) }, storage, sleep: noWait });
  await book.read(TOWN);
  for (let i = 0; i < 100; i++) assert.equal(book.unseen(TOWN), 1);
  assert.ok(reads <= 1, `storage read ${reads} times`);
});

test('AUDIT 28 N14: a take-down\'s and a report\'s hour spent say so in their own words', () => {
  assert.equal(REFUSALS['board-ops-rate'], 'You have done too much at the boards this hour. Try again later.');
  const x = src('server-account/src/board.js');
  assert.equal((x.match(/return \{ error: 'board-ops-rate' \}/g) ?? []).length, 2);
  assert.equal((x.match(/return \{ error: 'board-rate' \}/g) ?? []).length, 1, 'the pin\'s own');
});
