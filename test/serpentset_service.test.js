// SERPENT-SET (2026-10-05, Mac: "The serpent boss needs to use the currency from oblivion gate and have its own equipment
// rewards"; with SILVER-FINDS: "Silver should be more accessible in more forms of interactions ... different
// activities"): THE SERVICE'S HALF - a serpent's row says the embers its hoard paid (migration 0083), the insignia's
// purse and its sale count them with a breach's, and a serpent slain strikes its silver under the day's combat cap with
// the gates and the raids. Driven through the real Worker over node:sqlite with every migration applied
// (test/accountDb.mjs). bible/11-Multiplayer/Sea-Serpent.md section 8; bible/06-Systems/Professions-Arc.md 10.5.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, T0 } from './accountDb.mjs';
import { mintSerpentReceipt } from '../src/net/serpentReceipt.js';
import { MARKS_FAUCETS, MARKS_COMBAT, serpentStrikeOf, utcDay } from '../src/net/marksLaw.js';
import { SERPENT_EMBERS } from '../src/net/serpentHoardLaw.js';
import { INSIGNIA } from '../src/net/insignia.js';
import { ACCOUNT_VERSION } from '../server-account/src/service.js';

const { subtle } = globalThis.crypto;
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
let _now = T0;
const realNow = Date.now;
const clock = (s) => { _now = s; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
clock(T0);
const DAY = 363;   // a serpent day (SERPENT_EVERY_DAYS 2, phase 1) - +2 a serpent's next
const CH = 'char-0001';

async function stand(extra = {}) {
  const s = await standService({ MARKS_OPEN: 'on', ...extra });
  const raw = s.env.DB._raw;
  // PIN MOVED (AUDIT 625 P4): the claim says the embers its build's hoard mints (`stones`), as the production client's does
  // (net/accountClient.js claimSerpentReceipt) - `stones: null` is a build from before them, which says none
  const serpent = async (who, day, x = 'dealt', { stones = SERPENT_EMBERS, cid = null } = {}) => s.call('/v1/serpent/claim', {
    receipt: await mintSerpentReceipt({ d: day, b: 'sethrakul', s: who.id, c: 99, x, h: 4, l: 20 }, s.gateKey, { subtle, nowS: _now }), character: CH, name: who.handle,
    ...(stones != null ? { stones } : {}), ...(cid ? { cid } : {}),
  }, who.secret);
  const balance = (who) => Number(raw.prepare('SELECT balance FROM marks WHERE account = ?').get(who.id)?.balance ?? 0);
  const lines = (kind) => raw.prepare('SELECT * FROM marks_ledger WHERE kind = ? ORDER BY seq').all(kind);
  return { ...s, raw, serpent, balance, lines };
}

test('SERPENT-SET the law: a serpent strikes 40 silver, a ship that stood half; it is a combat faucet, under the day\'s 150 with the gates and the raids - the ceiling unmoved; its line a mint (mutants: the amount; the stood share; the cap\'s kinds)', () => {
  assert.deepEqual(MARKS_FAUCETS.serpent, { amount: 40, stood: 0.5 });
  assert.deepEqual([serpentStrikeOf('dealt'), serpentStrikeOf('stood'), serpentStrikeOf(undefined)], [40, 20, 40]);
  assert.deepEqual(MARKS_COMBAT, { kinds: ['gate', 'raid', 'serpent'], perDay: 150 });
  assert.equal(SERPENT_EMBERS, 1);
});

test('SERPENT-SET the claim: a counted serpent\'s row says its embers (SERPENT_EMBERS, dealt or stood); a row from before migration 0083 says none - its hoard paid none (mutants: the embers unwritten; the default)', async () => {
  clock(T0);
  const s = await stand();
  const ann = await s.registered('Anna', { character: CH });
  const bo = await s.registered('Bors', { character: CH });
  assert.equal((await s.serpent(ann, DAY)).body.recorded, true);
  assert.equal((await s.serpent(bo, DAY, 'stood')).body.recorded, true);
  const rows = s.raw.prepare('SELECT account, stones FROM serpent_kills ORDER BY account').all();
  assert.deepEqual(rows.map((r) => r.stones), [SERPENT_EMBERS, SERPENT_EMBERS]);
  s.raw.prepare('INSERT INTO serpent_kills (day, account, boss, hull, char_id, xp, nonce, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(DAY - 2, ann.id, 'sethrakul', 4, CH, 0, 'n0', T0);
  assert.equal(s.raw.prepare('SELECT stones FROM serpent_kills WHERE day = ? AND account = ?').get(DAY - 2, ann.id).stones, 0, 'a serpent from before paid no ember');
  assert.match(src('server-account/migrations/0083_serpent_embers.sql'), /^ALTER TABLE serpent_kills ADD COLUMN stones INTEGER NOT NULL DEFAULT 0;$/m);
});

test('AUDIT 625 P4: a serpent\'s row counts the embers the CLAIM says its build\'s hoard mints (`stones`, at most SERPENT_EMBERS) - a build from before them says none and is counted none, so the purse never holds an ember its pack was never given; the answer says the row\'s embers, as the gate\'s does (AUDIT WB12d A1), a repeat the row\'s own (mutants: the row\'s embers the law\'s whatever the claim says; the bound; the answer silent)', async () => {
  clock(T0);
  const s = await stand();
  const [ann, bo, cy] = [await s.registered('Anna', { character: CH }), await s.registered('Bors', { character: CH }), await s.registered('Cyra', { character: CH })];
  const now = await s.serpent(ann, DAY);
  assert.deepEqual([now.body.recorded, now.body.stones], [true, SERPENT_EMBERS], 'this build: its hoard\'s embers, said back');
  const old = await s.serpent(bo, DAY, 'dealt', { stones: null });
  assert.deepEqual([old.body.recorded, old.body.stones], [true, 0], 'a build from before the embers: none');
  const greedy = await s.serpent(cy, DAY, 'dealt', { stones: 40 });
  assert.equal(greedy.body.stones, SERPENT_EMBERS, 'never past the law');
  const rows = Object.fromEntries(s.raw.prepare('SELECT account, stones FROM serpent_kills').all().map((r) => [r.account, r.stones]));
  assert.deepEqual([rows[ann.id], rows[bo.id], rows[cy.id]], [SERPENT_EMBERS, 0, SERPENT_EMBERS]);
  const again = await s.serpent(bo, DAY);
  assert.deepEqual([again.body.recorded, again.body.why, again.body.stones], [false, 'claimed', 0], 'a repeat: the row\'s own, whatever this ask says');
  for (const bad of [-1, 1.5, '1']) assert.equal((await s.serpent(ann, DAY + 2 + 2 * [-1, 1.5, '1'].indexOf(bad), 'dealt', { stones: bad })).body.stones, 0, `${JSON.stringify(bad)}: none`);
});

test('AUDIT 625 P5: the claim in PRODUCTION\'S shape - a device\'s claim id with Marks open - is one batch: the row, the Renown, the hoard\'s row and its read, and the silver last; the claim is given its hoard and its silver, and a second device\'s claim of the same receipt neither (mutants: the hoard\'s answer read off the wrong statement; the silver\'s)', async () => {
  clock(T0);
  const s = await stand();
  const ann = await s.registered('Anna', { character: CH });
  const first = await s.serpent(ann, DAY, 'dealt', { cid: 'a'.repeat(16) });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.deepEqual([first.body.recorded, first.body.spoils, first.body.stones], [true, true, SERPENT_EMBERS]);
  assert.deepEqual(first.body.marks, { struck: 40, balance: 40, combat: { earned: 40, max: 150 } }, 'the silver, struck in the same batch');
  assert.equal(s.raw.prepare('SELECT cid FROM serpent_spoils WHERE day = ? AND account = ?').get(DAY, ann.id).cid, 'a'.repeat(16));
  const second = await s.serpent(ann, DAY, 'dealt', { cid: 'b'.repeat(16) });
  assert.deepEqual([second.body.recorded, second.body.why, second.body.spoils, second.body.marks], [false, 'claimed', false, undefined], 'the other device: no hoard, no silver');
  const asked = await s.serpent(ann, DAY, 'dealt', { cid: 'a'.repeat(16) });
  assert.deepEqual([asked.body.spoils, s.lines('serpent').length], [true, 1], 'the first device asking again is told its hoard - one line struck');
});

test('SERPENT-SET the insignia: the purse counts a serpent\'s embers with a breach\'s, and the sale reads the same sum - an account that has only fought serpents buys with them; never past them (mutants: the gates alone; the purse and the sale apart)', async () => {
  clock(T0);
  const s = await stand();
  const ann = await s.registered('Anna', { character: CH });
  const title = INSIGNIA.find((o) => o.kind === 'title');
  for (let i = 0; i < title.price; i++) s.raw.prepare('INSERT INTO serpent_kills (day, account, boss, hull, char_id, xp, nonce, at, stones) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(1001 + 2 * i, ann.id, 'sethrakul', 4, CH, 0, `n${i}`, T0, SERPENT_EMBERS);
  const bought = await s.call('/v1/account/insignia', { item: title.id }, ann.secret);
  assert.equal(bought.status, 200, JSON.stringify(bought.body));
  assert.equal(bought.body.purse, 0, 'every ember of thirty serpents spent');
  const aura = INSIGNIA.find((o) => o.kind === 'aura');
  const short = await s.call('/v1/account/insignia', { item: aura.id }, ann.secret);
  assert.deepEqual([short.status, short.body.error], [409, 'short']);
  assert.match(src('server-account/src/accounts.js'), /const EMBERS_EARNED_SQL = '\(\(SELECT COALESCE\(SUM\(stones\), 0\) FROM gate_kills WHERE account = \?1\) \+ \(SELECT COALESCE\(SUM\(stones\), 0\) FROM serpent_kills WHERE account = \?1\)\)';/);
  assert.equal((src('server-account/src/accounts.js').match(/\$\{EMBERS_EARNED_SQL\}/g) ?? []).length, 2, 'the purse and the sale, one sum');
});

test('SERPENT-SET the silver: a serpent counted strikes 40 (a ship that stood 20), said as `marks` with the day\'s combat bar; under the one cap with the gates - the day\'s last strike what it has left, then `cap`; claimed twice, struck once; its line `serpent:<day>` (mutants: the guard unread; the cap apart; the amount)', async () => {
  clock(T0);
  const s = await stand();
  const ann = await s.registered('Anna', { character: CH });
  const one = await s.serpent(ann, DAY);
  assert.equal(one.status, 200, JSON.stringify(one.body));
  assert.deepEqual(one.body.marks, { struck: 40, balance: 40, combat: { earned: 40, max: 150 } });
  assert.equal('day' in one.body || 'struck' in one.body, false, 'the service\'s own words stay home');
  const again = await s.serpent(ann, DAY);
  assert.deepEqual([again.body.recorded, again.body.why, again.body.marks], [false, 'claimed', undefined], 'claimed twice: struck once');
  assert.equal((await s.claim(ann, 500, _now)).body.marks.struck, 50);
  assert.equal((await s.claim(ann, 501, _now)).body.marks.struck, 50);
  const three = await s.serpent(ann, DAY + 2, 'stood');
  assert.deepEqual(three.body.marks, { struck: 10, balance: 150, combat: { earned: 150, max: 150 } }, 'a stander\'s 20, cut to what the day had left');
  const four = await s.serpent(ann, DAY + 4);
  assert.equal(four.body.recorded, true, 'counted all the same');
  assert.deepEqual(four.body.marks, { struck: 0, balance: 150, combat: { earned: 150, max: 150 }, why: 'cap' });
  assert.deepEqual(s.lines('serpent').map((l) => [l.amount, l.rid, l.day]), [[40, `serpent:${DAY}`, utcDay(T0)], [10, `serpent:${DAY + 2}`, utcDay(T0)]]);
  clock(T0 + 86400);
  const bo = await s.registered('Bors', { character: CH });
  assert.equal((await s.serpent(bo, DAY + 6, 'stood')).body.marks.struck, 20, 'a stander: half');
  clock(T0);
});

test('SERPENT-SET the switch and the guest: no silver while it is shut, nor for a guest - the serpent counted (or not) all the same (mutants: the switch unread; a guest struck)', async () => {
  clock(T0);
  const shut = await stand({ MARKS_OPEN: 'off' });
  const a = await shut.registered('Anna', { character: CH });
  const r = await shut.serpent(a, DAY);
  assert.deepEqual([r.body.recorded, r.body.marks], [true, null], 'counted, and silver not this account\'s');
  assert.equal(shut.lines('serpent').length, 0);
  shut.env.MARKS_OPEN = 'on';
  const retry = await shut.serpent(a, DAY);
  assert.deepEqual([retry.body.recorded, retry.body.why], [false, 'claimed']);
  assert.equal(shut.lines('serpent').length, 0, 'a claim that wrote no row strikes nothing, the switch open or not - the strike is the row\'s own');
  const s = await stand();
  const g = await s.guest();
  const gr = await s.call('/v1/serpent/claim', { receipt: await mintSerpentReceipt({ d: DAY, b: 'sethrakul', s: g.id, c: 99, x: 'dealt', h: 4, l: 20 }, s.gateKey, { subtle, nowS: _now }), character: CH }, g.secret);
  assert.deepEqual([gr.body.recorded, gr.body.why, 'marks' in gr.body], [false, 'guest', false]);
  assert.equal(s.lines('serpent').length, 0);
});

test('SERPENT-SET the deploy: acct84 in the Worker and its config (PIN MOVED: acct83 on its branch, renumbered past CRYSTAL-FIST\'s acct83 at its merge of main); the account deploy watches the hoard\'s law; the RELAY never reads it - its version untouched, its graph without it (mutants: the version unmoved; the deploy blind to the law)', () => {
  assert.equal(ACCOUNT_VERSION, 'acct100');   // PIN MOVED: acct100, the Chapters (CHAP1-CHAP7b) past CARDS9-CARDS10's acct99, PERMADEATH-HOUSES' acct98, SERVER-POST's acct97, TAVERN CARDS' acct96 and SCALE4's acct95 at the merges; PIN MOVED: YARD-SHED's acct85, then YARD-HEIGHT's acct86 (a yard's piece past 4 m refused), then LEGACY7's acct87 (the Project Legacy lines and the tombstone - acct84 on its branch, renumbered past SERPENT-SET's, YARD-SHED's and YARD-HEIGHT's at the merges), then STORM-SHED's acct88 (the second overload), then STORM-SHED 2's acct89 (its follow-ups), then TEXT-F1's acct90 (the words a player types), then CAP-OFF's acct91 (no day's cap), then FOUNDER5's acct92 (Founder on any clock, and by name), then CRAFT2-CRAFT5's acct93 (five crafts of eight, the temper and the Reforge), then SD9b's acct94 (the Hours broken - acct91 on its branch, renumbered past CAP-OFF, FOUNDER5 and CRAFT2-CRAFT5 at the merges), then SCALE4a-c's acct95 (a session and its player in one read, the service's own clock, one heartbeat - acct94 on its branch, renumbered past SD9b at the merge)
  assert.match(src('server-account/wrangler.toml'), /^ACCOUNT_VERSION = "acct100"$/m);   // PIN MOVED: acct100, the Chapters (CHAP1-CHAP7b) past CARDS9-CARDS10's acct99, PERMADEATH-HOUSES' acct98, SERVER-POST's acct97, TAVERN CARDS' acct96 and SCALE4's acct95 at the merges
  assert.match(src('.github/workflows/account-deploy.yml'), /^\s+- "src\/net\/serpentHoardLaw\.js"$/m);
  assert.match(src('server-account/src/serpents.js'), /import \{ SERPENT_EMBERS \} from '\.\.\/\.\.\/src\/net\/serpentHoardLaw\.js';/);
  assert.doesNotMatch(src('src/net/serpentLaw.js'), /SERPENT_EMBERS/, 'never in the relay\'s serpent law');
  assert.doesNotMatch(src('test/relayversion.test.js'), /serpentHoardLaw/, 'the relay\'s graph never reaches it');
});
