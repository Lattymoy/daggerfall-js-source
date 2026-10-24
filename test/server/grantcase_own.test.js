// FOE-BOUNDS and GRANT-ASKS (2026-10-19, Mac: "Spec + B + A"; bible/11-Multiplayer/Spawn-Grants.md sections 19 and 21):
// THE RELAY'S OWN COUNT OPENS A CASE (server-account/src/grants.js) - a record the relay itself stripped because no
// builder could give it opens the case on its sender alone, its evidence on the line; an account's own asks far past its
// budget in one cell's window do too; one batch's findings on one account are ONE line (a case line is keyed by its
// second and account); the count opens no more than GRANT_OWN_CASES_HOUR cases an hour; and the Discord card says the
// spawn grants opened it, never that the chat reviewer "found nothing".
import test from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { newGrantMeasure, foldGrantAsk, foldGrantTally, grantMeasureBatch, sealGrantMeasure, GRANT_MEASURE_SIG_HEADER, GRANT_RELAY_READER } from '../../src/net/grantMeasure.js';
import { GRANT_KINDS } from '../../src/net/grantLaw.js';
import { GRANT_FEED_PATH, GRANT_CASE_TAB, GRANT_ASK_CASE_TIMES, GRANT_ASK_CASE_OVER_MIN, GRANT_OWN_CASES_HOUR, GRANT_RATE_SPAN_MIN_S, grantAskText } from '../../server-account/src/grants.js';
import { overRate } from '../../server-account/src/accounts.js';
import { caseCard } from '../../server-account/src/discord.js';

const { subtle } = globalThis.crypto;
const URL_ = `https://accounts.invalid${GRANT_FEED_PATH}`;
const hex16 = () => [...crypto.getRandomValues(new Uint8Array(8))].map((x) => x.toString(16).padStart(2, '0')).join('');
/** The most an `enc` budget lets honest play ask in a ten-minute window. */
const ENC_ALLOW = Math.ceil(GRANT_KINDS.enc.cap + GRANT_KINDS.enc.rate * GRANT_RATE_SPAN_MIN_S);

async function rig() {
  const s = await standService({ DEVELOPER_HANDLES: 'Mac' });
  const raw = s.env.DB._raw;
  const aged = async (handle) => { const p = await s.registered(handle); raw.prepare('UPDATE players SET created_at = created_at - ?1 WHERE id = ?2').run(60 * 86400, p.id); return p.id; };
  /** One cell's window: tallies [reader, sender, reason, n, evidence?], asks [account, kind, how many]. */
  const post = async (tallies, asks = []) => {
    const now = Date.now(), w = newGrantMeasure(now - 10 * 60_000);
    for (const [a, b, r, n, e] of tallies) foldGrantTally(w, a, b, r, n, e ?? null);
    for (const [a, k, times] of asks) for (let i = 0; i < times; i++) foldGrantAsk(w, a, k, 1, i >= ENC_ALLOW ? 'bucket' : null, 4);
    const sealed = await sealGrantMeasure(grantMeasureBatch(w, hex16(), 'world:25,9', now), s.gatePriv, { subtle });
    const res = await s.fetch(URL_, { method: 'POST', headers: { [GRANT_MEASURE_SIG_HEADER]: sealed.sig }, body: sealed.body });
    return { status: res.status, body: await res.json() };
  };
  const cases = (target) => raw.prepare('SELECT * FROM mod_cases WHERE target = ?1').all(target);
  const lines = (target) => raw.prepare('SELECT l.* FROM mod_case_lines l JOIN mod_cases c ON c.id = l.case_id WHERE c.target = ?1').all(target);
  return { s, raw, aged, post, cases, lines };
}

test('FOE-BOUNDS THE RELAY\'S OWN WORD OPENS THE CASE ALONE: what the relay itself stripped because no builder could give it opens a case on its sender with no reader\'s word - its count and the worst one\'s type, claim and bound on the line; nobody reported, nobody muted (mutants: the relay\'s tally weighed as a reader\'s; its evidence dropped)', async () => {
  const R = await rig();
  const bad = await R.aged('Badger');
  const res = await R.post([[GRANT_RELAY_READER, bad, 'stats', 3, { t: 0, k: 99_999, mx: 728 }]]);
  assert.deepEqual([res.status, res.body.cases], [202, 1]);
  const [c] = R.cases(bad);
  assert.deepEqual([c.source, c.status, c.reports], ['review', 'open', 0]);
  const [l] = R.lines(bad);
  assert.equal(l.tab, GRANT_CASE_TAB);
  assert.equal(l.text, 'the relay itself dropped 3 of this account\'s foes no builder could give - the worst a type 0 at 99999 health, its most 728 (Spawn-Grants FOE-BOUNDS)');
  assert.equal(R.raw.prepare('SELECT COUNT(*) AS n FROM mod_reports').get().n, 0);
  assert.ok(!(Number(R.raw.prepare('SELECT muted_until FROM players WHERE id = ?1').get(bad).muted_until) > 0), 'nobody muted');
});

test('GRANT-ASKS AN ACCOUNT\'S OWN ASKS FAR PAST ITS BUDGET OPEN THE CASE: in one cell\'s ten minutes, GRANT_ASK_CASE_TIMES times what its budget lets honest play ask - and GRANT_ASK_CASE_OVER_MIN past it - opens it; one fewer does not; its asks, not its bucket\'s refusals, are read (a flood that filled the cell is counted `ceiling`) (mutants: the bucket read in place of the asks; the floor dropped)', async () => {
  assert.deepEqual([GRANT_ASK_CASE_TIMES, GRANT_ASK_CASE_OVER_MIN, ENC_ALLOW], [4, 16, 16]);
  const at = GRANT_ASK_CASE_TIMES * ENC_ALLOW;
  assert.equal(grantAskText({ k: 'enc', asks: at - 1, bucket: 0, ceiling: at - 1 }, 600), null);
  assert.match(grantAskText({ k: 'enc', asks: at, bucket: 0, ceiling: at }, 600), /^the relay's own count: this account asked 64 enc grants in 10 minutes, 4 times the most its budget lets honest play ask \(16\)/, 'a ceiling-counted flood is still its asks');
  assert.equal(grantAskText({ k: 'kept', asks: 15, bucket: 12, ceiling: 0 }, 600), null, 'a budget of three: not a case at its fifteenth (the floor)');
  const R = await rig();
  const fast = await R.aged('Speedy'), slow = await R.aged('Steady');
  await R.post([], [[fast, 'enc', at], [slow, 'enc', at - 1]]);
  assert.equal(R.cases(fast).length, 1);
  assert.deepEqual(R.cases(slow), [], 'one ask short: nothing');
});

test('FOE-BOUNDS ONE BATCH\'S FINDINGS ON ONE ACCOUNT ARE ONE LINE, AND THE COUNT OPENS NO FLOOD OF CASES: readers\' tallies, the relay\'s strip and its own asks against one account write one line (two of one second would keep the first alone); past GRANT_OWN_CASES_HOUR new cases an hour the relay\'s own count opens none - a case already open still takes its line (mutants: a line a finding; the hour\'s cap unread)', async () => {
  const R = await rig();
  const bad = await R.aged('Badger'), ann = await R.aged('Annie'), bo = await R.aged('Bobby'), cy = await R.aged('Cyrus');
  await R.post([[ann, bad, 'marks', 1], [bo, bad, 'stats', 1], [cy, bad, 'unsigned', 1], [GRANT_RELAY_READER, bad, 'stats', 2, { t: 0, k: 50_000, mx: 91 }]], [[bad, 'enc', GRANT_ASK_CASE_TIMES * ENC_ALLOW]]);
  const ls = R.lines(bad);
  assert.equal(ls.length, 1, 'one line');
  for (const part of ['3 players\' games refused 3', 'the relay itself dropped 2', 'the relay\'s own count: this account asked 64 enc']) assert.ok(ls[0].text.includes(part), part);
  assert.equal(GRANT_OWN_CASES_HOUR, 30);
  const ctx = { db: R.s.env.DB, nowS: Math.floor(Date.now() / 1000) };
  for (let i = 0; i < GRANT_OWN_CASES_HOUR; i++) await overRate(ctx, 'grant-own-cases', GRANT_OWN_CASES_HOUR, 3600);
  const late = await R.aged('Latecomer');
  await R.post([[GRANT_RELAY_READER, late, 'stats', 1, { t: 0, k: 50_000, mx: 91 }]]);
  assert.deepEqual(R.cases(late), [], 'past the hour\'s cap: no new case');
  R.raw.prepare('UPDATE mod_case_lines SET at = at - 700').run();   // the window on
  await R.post([[GRANT_RELAY_READER, bad, 'stats', 1, { t: 0, k: 50_000, mx: 91 }]]);
  assert.equal(R.lines(bad).length, 2, 'an open case still takes its line');
});

test('FOE-BOUNDS THE CARD SAYS THE SPAWN GRANTS OPENED IT: a case whose lines are the spawn grants\' and that no reviewer judged is titled so, its reports "none - the spawn grants\' count opened it", and never "found nothing against the code"; a chat reviewer\'s case reads as it did (mutants: every review case renamed; the old words kept)', () => {
  const c = { id: 'c1', target: 'acct-bad', source: 'review', status: 'open', reports: 0, credible: 0, ai_state: 'done', ai_category: null };
  const spawn = caseCard({ c, name: 'Badger', lines: [{ at: 1, sub: 'acct-bad', name: 'Badger', tab: GRANT_CASE_TAB, text: 'the relay itself dropped 1' }], reasons: [], strikes: 0 }).embeds[0];
  assert.equal(spawn.title, 'Case c1 (opened by the spawn grants)');
  assert.equal(spawn.fields.find((f) => f.name === 'Reports').value, 'none - the spawn grants\' count opened it');
  assert.ok(spawn.fields.some((f) => f.name === 'Spawn grants'));
  assert.ok(!spawn.fields.some((f) => /found nothing against the code/.test(f.value)));
  const chat = caseCard({ c, name: 'Badger', lines: [{ at: 1, sub: 'acct-bad', name: 'Badger', tab: 'chat', text: 'hi' }], reasons: [], strikes: 0 }).embeds[0];
  assert.equal(chat.title, 'Case c1 (opened by the reviewer)');
  assert.ok(chat.fields.some((f) => f.value === 'found nothing against the code.'));
});
