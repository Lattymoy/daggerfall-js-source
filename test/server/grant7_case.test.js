// GRANT5 and GRANT7 (2026-10-18, Mac: "Do all slices"; the owner, question 2: "3 accounts / 10 min"; bible/11-Multiplayer/
// Spawn-Grants.md section 15): THE MEASURE SUGGESTS, THE READERS' WORD OPENS A CASE (server-account/src/grants.js) - the
// measure's read says each kind's rate and the cell's ceiling half again past what honest play reached; readers on three
// accounts that count, tallying what only a changed client gives against one sender inside ten minutes, open the
// moderators' case on it - a reviewer's case with one line a window, never a report, so never the reports' mute.
import test from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { newGrantMeasure, foldGrantAsk, foldGrantTally, grantMeasureBatch, sealGrantMeasure, GRANT_MEASURE_SIG_HEADER } from '../../src/net/grantMeasure.js';
import { GRANT_CASE_REASONS } from '../../src/net/grantLaw.js';
import { GRANT_FEED_PATH, GRANT_CASE_READERS, GRANT_CASE_WINDOW_S, GRANT_CASE_TAB, GRANT_SUGGEST_ROOM, grantRateSuggested, grantCeilingSuggested } from '../../server-account/src/grants.js';

const { subtle } = globalThis.crypto;
const URL_ = `https://accounts.invalid${GRANT_FEED_PATH}`;
const hex16 = () => [...crypto.getRandomValues(new Uint8Array(8))].map((x) => x.toString(16).padStart(2, '0')).join('');

async function rig() {
  const s = await standService({ DEVELOPER_HANDLES: 'Mac' });
  const raw = s.env.DB._raw;
  const aged = async (handle) => { const p = await s.registered(handle); raw.prepare('UPDATE players SET created_at = created_at - ?1 WHERE id = ?2').run(60 * 86400, p.id); return p.id; };
  /** One cell's window: each tally [reader, sender, reason, n]. */
  const post = async (tallies, rows = []) => {
    const now = Date.now(), w = newGrantMeasure(now - 60_000);
    for (const [a, b, r, n] of tallies) foldGrantTally(w, a, b, r, n);
    for (const [a, k, n, live] of rows) foldGrantAsk(w, a, k, n, null, live);
    const sealed = await sealGrantMeasure(grantMeasureBatch(w, hex16(), 'world:25,9', now), s.gatePriv, { subtle });
    const res = await s.fetch(URL_, { method: 'POST', headers: { [GRANT_MEASURE_SIG_HEADER]: sealed.sig }, body: sealed.body });
    return { status: res.status, body: await res.json() };
  };
  const cases = (target) => raw.prepare('SELECT * FROM mod_cases WHERE target = ?1').all(target);
  const lines = (target) => raw.prepare('SELECT l.* FROM mod_case_lines l JOIN mod_cases c ON c.id = l.case_id WHERE c.target = ?1').all(target);
  return { s, raw, aged, post, cases, lines };
}

test('GRANT7 THREE READERS\' ACCOUNTS IN TEN MINUTES OPEN THE CASE: two are not enough, a guest or a sprout does not count, and a timing word counts for nothing; the third opens a reviewer\'s case on the sender - one line under `grant`, the readers, the foes and why - and the Discord post due; no report is filed and nobody is muted (mutants: a guest counted; a timing word counted; the case a report\'s)', async () => {
  assert.deepEqual([GRANT_CASE_READERS, GRANT_CASE_WINDOW_S, GRANT_CASE_TAB], [3, 600, 'grant']);
  const R = await rig();
  const bad = await R.aged('Badger'), ann = await R.aged('Annie'), bo = await R.aged('Bobby'), cy = await R.aged('Cyrus');
  const fresh = (await R.s.registered('Sprout')).id, guest = (await R.s.guest()).id;
  assert.equal((await R.post([[ann, bad, 'marks', 2], [bo, bad, 'unsigned', 1], [fresh, bad, 'marks', 4], [guest, bad, 'twice', 1]])).status, 202);
  assert.deepEqual(R.cases(bad), [], 'two that count, a sprout and a guest: no case');
  await R.post([[ann, cy, 'marks', 1], [bo, cy, 'twice', 1], [bad, cy, 'dice', 9], [fresh, cy, 'expired', 1], [guest, cy, 'cell', 3]]);
  assert.deepEqual(R.cases(cy), [], 'two readers for a case\'s reasons; the third\'s word is an honest client\'s timing: nothing');
  const third = await R.post([[cy, bad, 'sender', 1]]);
  assert.equal(third.body.cases, 1);
  const [c] = R.cases(bad);
  assert.deepEqual([c.source, c.status, c.ai_state, c.reports], ['review', 'open', 'done', 0], 'a reviewer\'s case: no report, the chat reader not asked');
  const [l] = R.lines(bad);
  assert.equal(l.tab, GRANT_CASE_TAB);
  assert.equal(l.sub, bad);
  assert.match(l.text, /^3 players' games refused 4 of this account's foes in 10 minutes: /);
  for (const r of ['marks 2', 'unsigned 1', 'sender 1']) assert.ok(l.text.includes(r), r);
  assert.equal(R.raw.prepare('SELECT COUNT(*) AS n FROM mod_reports').get().n, 0, 'no report filed');
  assert.ok(!(Number(R.raw.prepare('SELECT muted_until FROM players WHERE id = ?1').get(bad).muted_until) > 0), 'nobody muted');
  R.raw.prepare('UPDATE mod_case_lines SET at = at - 60').run();   // a minute on
  await R.post([[ann, bad, 'marks', 1]]);
  assert.equal(R.lines(bad).length, 1, 'one line a window');
  assert.ok(GRANT_CASE_REASONS.includes('sender'));
});

test('GRANT5 THE MEASURE SUGGESTS: each kind\'s rate half again past its 0.999 quantile of an account\'s asks an hour, in asks a second, beside the standing one; the cell\'s ceiling half again past the most live a cell held; nothing without a measure (mutants: the room dropped; the ceiling from the quantile)', async () => {
  assert.equal(GRANT_SUGGEST_ROOM, 1.5);
  assert.equal(grantRateSuggested(120), 120 * 1.5 / 3600);
  assert.deepEqual([grantRateSuggested(null), grantRateSuggested(0), grantCeilingSuggested(null)], [null, null, null]);
  assert.equal(grantCeilingSuggested(21), 32);
  const R = await rig();
  const ann = await R.aged('Ann');
  await R.post([], [[ann, 'enc', 2, 21], [ann, 'enc', 2, 21], [ann, 'enc', 2, 21]]);
  const mac = await R.s.registered('Mac');
  const read = await R.s.call('/v1/mod/realm-grants', { days: 7 }, mac.secret);
  const enc = read.body.kinds.find((k) => k.kind === 'enc');
  assert.equal(enc.rate.standing, 1 / 60);
  assert.equal(enc.rate.suggested, grantRateSuggested(enc.perHour.quantiles.at(-1)[1]));
  assert.ok(enc.rate.suggested > 0);
  assert.equal(read.body.kinds.find((k) => k.kind === 'camp').rate.suggested, null, 'no measure, no suggestion');
  assert.equal(read.body.cells.suggested, grantCeilingSuggested(21));
});
