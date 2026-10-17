// AUDIT EG IV (2026-10-13, the Elite Gates arc's fourth audit; bible/11-Multiplayer/Elite-Gates.md sections 5, 20 and 23) -
// THE NET GROUP'S SERVICE HALF, PINNED against the account service's real Worker (test/accountDb.mjs - every migration
// applied, the relay's receipts minted with its own key, the open's orders verified with the service's):
//   lane3 #1   an open whose answer was lost: asked again by its request id (`again`), the stake it took answered as an order
//              its void can name, none taken for an id that never landed; the key back by the void, the account free;
//   lane3 #4 / lane9 #24  the launch gift's letter, sent by migration 0113 beside its key;
//   lane3 #6   the stake clock's letter true where the first breach's mercy held the stake;
//   lane3 #11  the opener's 'empty' end (the first wake's) clears their `eg_live`;
//   lane3 #13  Spire Champion kept once a season's late ends are claimed;
//   lane3 #16  a gate kill's Weir Key in its claim's own batch;
//   lane3 #18  the service's route comment names what the open reads and what the admission refuses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService, T0 } from '../../accountDb.mjs';
import { mintEgReceipt, egCompanyTag, EG_RECEIPT_TTL_S } from '../../../src/net/eliteGates/egReceipt.js';
import { verifyEgOpenAnyAge } from '../../../src/net/identityToken.js';
import { arenaSeasonOf, arenaSeasonEndsS } from '../../../src/net/arena/arenaLaw.js';
import { POST_SENDER, postWhole } from '../../../src/net/postLaw.js';
import { EG_STAKE_POST, EG_STAKE_POST_HELD, EG_STAKE_CLOCK_S, EG_LAUNCH_POST, spendLapsedStakes, openEg, admitEg } from '../../../server-account/src/eg.js';
import { egHonoursOf, _resetEgHonoursCache } from '../../../server-account/src/egHonours.js';
import { readPost } from '../../../server-account/src/post.js';

const { subtle } = globalThis.crypto;
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
async function stood(t) {
  let clock = T0 * 1000;
  t.mock.method(Date, 'now', () => clock);
  const S = await standService();
  return { S, at: (s) => { clock = s * 1000; }, now: () => Math.floor(clock / 1000) };
}
const keysOf = (S, id) => S.env.DB._raw.prepare('SELECT eg_keys AS k FROM players WHERE id = ?').get(id).k;
const liveOf = (S, id) => S.env.DB._raw.prepare('SELECT eg_live_b AS b FROM players WHERE id = ?').get(id).b;
const stakeOf = (S, ez) => S.env.DB._raw.prepare('SELECT state FROM eg_stakes WHERE ez = ?').get(ez)?.state;

// ── lane3 #1 ───────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane3 #1 AN OPEN WHOSE ANSWER WAS LOST (sections 22 and 23, "A key\'s loss"): the open took the key and set `eg_live`, and the page never heard it - a fresh ask is refused `live`; asked again by its own request id (`again`) the service answers that stake - its order signed as of the stake\'s own issue (a void\'s, opening nothing) - and the void it names gives the key back and frees the account; an id that never landed is `none` and takes no key; a settled stake is `spent` (mutants: `again` taking a key; the order as of now; `none` unsaid)', async (t) => {
  const { S, at, now } = await stood(t);
  const me = await S.registered('KeyBearer');
  await S.claim(me, 700, now());
  assert.equal(keysOf(S, me.id), 1);
  const lost = await S.call('/v1/eg/open', { rq: 'rqlostanswer0000aa' }, me.secret);
  assert.equal(lost.status, 200, 'the service took it - the answer is the one lost');
  at(now() + 30);
  const fresh = await S.call('/v1/eg/open', { rq: 'rqfreshask00000bb' }, me.secret);
  assert.deepEqual([fresh.status, fresh.body.error, fresh.body.b], [409, 'live', lost.body.b], 'a fresh ask: a breach held');
  // asked again by its own id: the stake it took
  const again = await S.call('/v1/eg/open', { rq: 'rqlostanswer0000aa', again: 1 }, me.secret);
  assert.equal(again.status, 200);
  assert.deepEqual([again.body.b, again.body.ez, again.body.keys, again.body.at], [lost.body.b, lost.body.ez, 0, now() - 30], 'the same stake, its own issue');
  const v = await verifyEgOpenAnyAge(again.body.order, S.identityPublic, { subtle });
  assert.ok(v.ok, 'signed by the service');
  assert.deepEqual([v.claims.o, v.claims.eb, v.claims.ez, v.claims.s, v.claims.i], ['egopen', lost.body.b, lost.body.ez, me.id, now() - 30], 'as of the stake\'s issue - an order that lived its minute and opens nothing now');
  // an id that never reached the service: none, and no key taken for asking
  const none = await S.call('/v1/eg/open', { rq: 'rqneverlanded000cc', again: 1 }, me.secret);
  assert.deepEqual([none.status, none.body.error], [404, 'none']);
  assert.equal(S.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM eg_stakes WHERE account = ?').get(me.id).n, 1, 'no stake written');
  // the void the order names: the key back, the account free
  const vr = await mintEgReceipt({ q: 'v', b: lost.body.b, s: me.id, z: lost.body.ez }, S.gatePriv, { subtle, nowS: now() });
  assert.equal((await S.call('/v1/eg/claim', { receipt: vr }, me.secret)).body.recorded, true);
  assert.deepEqual([keysOf(S, me.id), liveOf(S, me.id), stakeOf(S, lost.body.ez)], [1, null, 'returned']);
  const spent = await S.call('/v1/eg/open', { rq: 'rqlostanswer0000aa', again: 1 }, me.secret);
  assert.deepEqual([spent.status, spent.body.error], [409, 'spent'], 'settled');
  assert.equal((await S.call('/v1/eg/open', { rq: 'rqfreshask00000bb' }, me.secret)).status, 200, 'and a new open goes');
});

// ── lane3 #4, lane9 #24 ────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane3 #4 / lane9 #24 THE LAUNCH GIFT\'S LETTER (section 5): migration 0113 adds the key to every account with a recorded Dagon\'s Breach kill and words it in the mailbox - one piece of the server\'s post each, *From the Battlespire*, EG_LAUNCH_POST\'s words, no item; never to an account with the rite alone or none; applied again it sends nothing more (mutants: the letter unsent; sent to the rite; sent twice)', async (t) => {
  const { S, now } = await stood(t);
  const breaker = await S.registered('Breaker'), riter = await S.registered('Riter'), none = await S.registered('Nobody');
  await S.claim(breaker, 700, now());
  S.env.DB._raw.prepare("INSERT INTO gate_kills (day, account, boss, earned, at) VALUES (701, ?, 'ruhn', 'rite', ?)").run(riter.id, now());
  const mig = rd('server-account/migrations/0124_elite_breach.sql');
  const gift = mig.slice(mig.indexOf('-- THE LAUNCH GIFT (section 5)'), mig.indexOf('-- EG-E2 (2026-10-12'));
  assert.match(gift, /INSERT OR IGNORE INTO server_post/, 'the send rides the gift');
  const q = (s) => s.replace(/'/g, "''");
  assert.ok(gift.includes(`'${EG_LAUNCH_POST.batch}', '${q(POST_SENDER)}', '${q(EG_LAUNCH_POST.subject)}', '${q(EG_LAUNCH_POST.body)}', NULL,`), 'its words EG_LAUNCH_POST\'s, as SQL quotes them');
  const before = keysOf(S, breaker.id);
  S.env.DB._raw.exec(gift);
  assert.equal(keysOf(S, breaker.id), before + 1, 'the key');
  const posts = S.env.DB._raw.prepare('SELECT * FROM server_post WHERE batch = ?').all(EG_LAUNCH_POST.batch);
  assert.deepEqual(posts.map((p) => p.to_id), [breaker.id], 'the gatebreaker alone');
  assert.deepEqual([posts[0].subject, posts[0].body, posts[0].sender, posts[0].item], [EG_LAUNCH_POST.subject, EG_LAUNCH_POST.body, POST_SENDER, null]);
  assert.equal(EG_LAUNCH_POST.subject, 'From the Battlespire');
  const read = await readPost({ db: S.env.DB, nowS: now() }, { id: breaker.id }, posts[0].id);
  assert.ok(postWhole(read?.post ?? read), 'the box reads it whole');
  S.env.DB._raw.exec(gift.split('\n').filter((l) => !/^UPDATE players SET eg_keys/.test(l)).join('\n'));
  assert.equal(S.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM server_post WHERE batch = ?').get(EG_LAUNCH_POST.batch).n, 1, 'sent once');
  assert.deepEqual([keysOf(S, riter.id), keysOf(S, none.id)], [0, 0]);
});

// ── lane3 #6 ───────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane3 #6 THE STAKE CLOCK\'S LETTER IS TRUE (section 23, "The clock"; section 5, the first breach\'s mercy): a stake its opener\'s own end held for the mercy, waiting on a word that the breach ended with no Redoubt taken that never came, is spent by the clock with EG_STAKE_POST_HELD\'s words - its end reached the ledger - and a stake no word ever came for with EG_STAKE_POST\'s (mutants: the held words never chosen; chosen always)', async (t) => {
  const { S, at, now } = await stood(t);
  const held = await S.registered('Held'), silent = await S.registered('Silent');
  for (const who of [held, silent]) await S.claim(who, 700, now());
  const oh = (await S.call('/v1/eg/open', { rq: 'rqheldmercy00000aa' }, held.secret)).body;
  const os = (await S.call('/v1/eg/open', { rq: 'rqsilentopen0000bb' }, silent.secret)).body;
  // the opener's own end before the breach's word: a fall while the company played on - held for the mercy
  const x = await mintEgReceipt({ q: 'x', b: oh.b, s: held.id, z: oh.ez, c: 1, h: 2, t: 600, n: 2, ew: 0, l: 20, why: 'fall', fl: 1 }, S.gatePriv, { subtle, nowS: now() });
  assert.equal((await S.call('/v1/eg/claim', { receipt: x }, held.secret)).body.recorded, true);
  assert.equal(stakeOf(S, oh.ez), 'held', 'held for the mercy');
  at(Math.max(oh.until, os.until) + EG_STAKE_CLOCK_S + 1);
  assert.equal(await spendLapsedStakes(S.env.DB, now(), 10), 2);
  const letter = (who) => ({ ...S.env.DB._raw.prepare('SELECT subject, body FROM server_post WHERE to_id = ?').get(who.id) });
  const day = new Date(T0 * 1000).toISOString().slice(0, 10);
  assert.deepEqual(letter(held), { subject: EG_STAKE_POST.subject, body: EG_STAKE_POST_HELD.body.replace('{day}', day) }, 'its end reached the ledger: the letter says what was waited for');
  assert.deepEqual(letter(silent), { subject: EG_STAKE_POST.subject, body: EG_STAKE_POST.body.replace('{day}', day) }, 'no word ever came');
  assert.match(EG_STAKE_POST_HELD.body, /Your own end reached the Spire's ledger/);
  assert.ok(EG_STAKE_POST_HELD.body.length <= 1200);
});

// ── lane3 #11 ──────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane3 #11 THE OPENER\'S EMPTY END FREES THEM (section 23, `eg_live`): the end the room owes an opener the first wake finds outside (`\'empty\'`, nothing cleared - test/net/eliteGates/egaudit4_net_relay.test.js mints it from the director) clears their live breach at once - a key\'s next open goes - and settles their stake as any end of theirs does: held by the first breach\'s mercy, spent after it (mutants: the end unread)', async (t) => {
  const { S, at, now } = await stood(t);
  const me = await S.registered('Afk');
  await S.claim(me, 700, now()); await S.claim(me, 701, now());
  S.env.DB._raw.prepare('UPDATE players SET eg_keys = 2 WHERE id = ?').run(me.id);
  const end = async (o) => S.call('/v1/eg/claim', { receipt: await mintEgReceipt({ q: 'x', b: o.b, s: me.id, z: o.ez, c: 1, h: 0, t: 0, n: 1, ew: 0, l: 1, why: 'empty', fl: 0, co: egCompanyTag(['acct-other']) }, S.gatePriv, { subtle, nowS: now() }) }, me.secret);
  const first = (await S.call('/v1/eg/open', { rq: 'rqafkopener0000aa' }, me.secret)).body;
  assert.equal(liveOf(S, me.id), first.b);
  assert.equal((await end(first)).body.recorded, true);
  assert.equal(liveOf(S, me.id), null, 'free at once, never three hours on');
  assert.equal(stakeOf(S, first.ez), 'held', 'the first breach: held for the mercy, as any early end of the opener\'s');
  at(now() + 10);
  const second = (await S.call('/v1/eg/open', { rq: 'rqafkopener0000bb' }, me.secret)).body;
  assert.ok(second.order, 'a key\'s next open goes');
  assert.equal((await end(second)).body.recorded, true);
  assert.equal(stakeOf(S, second.ez), 'spent');
});

// ── lane3 #13 ──────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane3 #13 SPIRE CHAMPION KEPT ONCE A SEASON\'S LATE ENDS ARE CLAIMED (section 20): an end issued in a season\'s last minute and claimed in the next lands in its season - until a receipt\'s life past the season\'s end the title follows the standing as it is, so the late company holds it the moment its claim lands, and past that the champions are kept with it among them (mutants: kept at the first read; the grace\'s length)', async (t) => {
  const { S, at, now } = await stood(t);
  const season = arenaSeasonOf(now()), endS = arenaSeasonEndsS(season);
  const early = await S.registered('Early'), late = await S.registered('Latecomer');
  const endOf = async (who, h, nowS) => mintEgReceipt({ q: 'x', b: (who === early ? 'a' : 'b').repeat(16), s: who.id, z: 'z'.repeat(16), c: 3, h, t: 900, n: 1, ew: 0, l: 9, why: 'home' }, S.gatePriv, { subtle, nowS });
  await S.call('/v1/eg/claim', { receipt: await endOf(early, 20, now()) }, early.secret);
  const lateR = await endOf(late, 40, endS - 60);   // issued in the season's last minute
  const champ = async (who) => (await egHonoursOf({ db: S.env.DB, nowS: now() }, { id: who.id, handle: who.handle }, now())).champion;
  at(endS + 60);
  _resetEgHonoursCache();
  assert.deepEqual([await champ(early), await champ(late)], [true, false], 'the season\'s first read: its standing as it is');
  at(endS + 3600);
  assert.equal((await S.call('/v1/eg/claim', { receipt: lateR }, late.secret)).body.recorded, true, 'claimed late, inside its life');
  _resetEgHonoursCache();
  assert.equal(await champ(late), true, 'the late company holds it as its claim lands');
  assert.equal(S.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM eg_champions WHERE season = ?').get(season).n, 0, 'nothing kept yet');
  at(endS + EG_RECEIPT_TTL_S - 1);
  _resetEgHonoursCache();
  await champ(early);
  assert.equal(S.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM eg_champions WHERE season = ?').get(season).n, 0, 'a second inside the life: still not kept');
  at(endS + EG_RECEIPT_TTL_S + 60);
  _resetEgHonoursCache();
  assert.deepEqual([await champ(early), await champ(late)], [true, true]);
  assert.deepEqual(S.env.DB._raw.prepare('SELECT account FROM eg_champions WHERE season = ? ORDER BY account').all(season).map((r) => r.account).sort(), [early.id, late.id].sort(), 'kept, the late one among them');
});

// ── lane3 #16 ──────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane3 #16 A GATE KILL\'S WEIR KEY IN ITS CLAIM\'S OWN BATCH (section 5): the roll is written in the transaction that writes the kill\'s row - a failure between them takes both, so the claim asked again records the kill and rolls the account\'s certain first key (it was lost: the row stood and the roll never ran); a claim asked again of a recorded kill rolls nothing (mutants: the roll after the batch; the roll on a claim that wrote no row)', async (t) => {
  const { S, now } = await stood(t);
  const me = await S.registered('FirstKill');
  const real = S.env.DB.prepare.bind(S.env.DB);
  let fail = 1;
  S.env.DB.prepare = (sql) => {
    const st = real(sql);
    if (!(fail > 0 && /^\s*UPDATE players SET eg_keys/.test(sql) && sql.includes('eg_key_miss'))) return st;
    fail--;
    const boom = () => { throw new Error('D1_ERROR: the roll failed'); };
    const api = { bind: () => api, first: async () => boom(), all: async () => boom(), run: async () => boom(), _result: () => boom() };
    return api;
  };
  const warn = console.warn, err = console.error; console.warn = () => {}; console.error = () => {};
  try {
    const failed = await S.claim(me, 700, now());
    assert.equal(failed.status, 500, 'the roll failed');
  } finally { console.warn = warn; console.error = err; }
  assert.equal(S.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM gate_kills WHERE account = ?').get(me.id).n, 0, 'and took the row with it');
  const again = await S.claim(me, 700, now());
  assert.deepEqual([again.body.recorded, again.body.weir], [true, { found: true, keys: 1 }], 'asked again: the kill and its certain first key');
  const thrice = await S.claim(me, 700, now());
  assert.deepEqual([thrice.body.recorded, thrice.body.weir, keysOf(S, me.id)], [false, undefined, 1], 'a recorded kill asked again rolls nothing');
  assert.equal(S.env.DB._raw.prepare('SELECT eg_key_miss AS m FROM players WHERE id = ?').get(me.id).m, 0);
});

// ── lane3 #18 ──────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane3 #18 THE SERVICE\'S ROUTE COMMENT IS THE ROUTES\' (server-account/src/index.js): the open\'s line names every field openEg reads and every refusal it answers, and the admission\'s every refusal admitEg answers (mutants: a field unsaid)', () => {
  const S = rd('server-account/src/index.js'), E = rd('server-account/src/eg.js');
  const line = (route) => S.split('\n').find((l) => l.startsWith(`//   POST ${route} `));
  const fn = (f) => { const src = String(f); return { reads: [...new Set([...src.matchAll(/body\?\.(\w+)/g)].map((m) => m[1]))], refuses: [...new Set([...src.matchAll(/error: '([\w-]+)'/g)].map((m) => m[1]))] }; };
  const open = fn(openEg), admit = fn(admitEg);
  assert.ok(open.reads.includes('again') && open.reads.includes('wg'));
  for (const f of open.reads) assert.match(line('/v1/eg/open').split('->')[0], new RegExp(`\\b${f}\\??\\b`), `the open's \`${f}\``);
  for (const w of open.refuses.filter((x) => x !== 'no-signing-key')) assert.ok(line('/v1/eg/open').includes(w), `the open's refusal ${w}`);
  for (const w of admit.refuses.filter((x) => x !== 'no-signing-key')) assert.ok(line('/v1/eg/admit').includes(w), `the admission's refusal ${w}`);
  assert.ok(E.includes('export async function openEg'));
});
