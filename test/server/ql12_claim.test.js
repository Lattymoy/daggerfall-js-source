// QL12 (2026-10-19, the owner: "New questlines tying into and introduced the oblivion gates, abyss dungeons, elite
// dungeons and elite breaches"; bible/06-Systems/Questlines-Arc.md sections 1 (decision 8) and 5.3): THE QUESTLINES'
// CLAIM, as the account service pays it - `POST /v1/ql/claim` (server-account/src/questlines.js claimQl). Pinned here:
// a step opened by its first claim and witnessed by a later one only against the place's own receipt row written at or
// after the opening (each witness kind - the rite, the breach, a Redoubt and no Rehearsal's, three of them, a Valkynaz's,
// an Hour, the Sea Serpent); a line's title once, and only behind its earlier witnessed steps; the Covens' Hoard's Weir
// Key once an account, kept, behind the Burning Doors' breach; a guest writes nothing; a bad body, a step paid nothing,
// the switch shut or at `dev`; the route listed and reachable; the vocabulary, its words and its colours. The real
// Worker over node:sqlite with every migration (test/accountDb.mjs), each receipt minted by its own producer and
// claimed through its own route, so the SQL itself is what is tested.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService, T0 } from '../accountDb.mjs';
import { mintReceipt } from '../../src/net/gate/gateReceipt.js';
import { mintEgReceipt } from '../../src/net/eliteGates/egReceipt.js';
import { mintSdReceipt } from '../../src/net/superDungeon/sdReceipt.js';
import { mintSerpentReceipt } from '../../src/net/serpent/serpentReceipt.js';
import { mintStarReceipt } from '../../src/net/starfall/starReceipt.js';   // STAR8: the fallen stars' witness
import { STAR_HOUR_MS } from '../../src/net/starfall/starfallLaw.js';
import { egValkRedoubt } from '../../src/net/eliteGates/egPay.js';
import { QL_SERVICE_LINES, QL_TITLES, QL_WITNESS_KINDS, qlTitleBit, qlStepClaimed } from '../../src/net/questlineClaims.js';
import { claimQl, QL_WITNESS_SQL, QL_STATUS, qlTitleSteps, qlSwitchOf, questlinesOpenFor, qlStepsBefore, qlInOrderSql, QL_PURSES } from '../../server-account/src/questlines.js';
import { titlesHeld } from '../../server-account/src/titles.js';
import { ROUTES, OPEN_ROUTES } from '../../server-account/src/service.js';
import { TITLES, verifyToken } from '../../src/net/identityToken.js';
import { TITLE_TEXT, TITLE_RGBA, cssRgba } from '../../src/ui/playerBadge.js';
import { honourEntry } from '../../src/ui/lootBanner.js';
import { accountQuestlines, SESSION_KEY, SERVICE_KEY } from '../../src/net/accountClient.js';
import { createLineRunner, STEP_GAP_S, CLAIM_RETRY_MS, CLAIM_TRIES, CLAIM_SLOW_MS } from '../../src/systems/questlines/qlLineRunner.js';
import { setPref } from '../../src/systems/uiPrefs.js';
import { QUESTLINES_PREF } from '../../src/systems/questlines/qlLaw.js';
import { ACCEPTED } from '../../src/net/legalLaw.js';
import { FESTIVALS, QL_STARWARDEN_CAKES } from '../../src/net/festivalLaw.js';
import { questlineService, hearPurse } from '../../src/scenes/quest/questlineHost.js';   // T-B: the purse's client door
import { bindFestival, _resetFestivalClientForTests } from '../../src/systems/festival/festivalClient.js';
import { soulCakesHeld } from '../../src/systems/festival/soulCake.js';
const FESTIVAL_FROM_MS = FESTIVALS[0].fromMs;   // the Witches' Festival's first day, the Starfall's own (net/festivalLaw.js)
const FEST_S = Math.floor(FESTIVAL_FROM_MS / 1000) + 3600;   // T-B: a second inside the festival's days

const { subtle } = globalThis.crypto;
const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const CH = 'char-0001';

/** A service standing with the questlines open (unless `extra` says otherwise), the clock at T0 and moved by `at`; each
 *  receipt minted by its producer at the clock's second and carried to its own route. */
async function stood(t, extra = {}) {
  let clock = T0 * 1000;
  t.mock.method(Date, 'now', () => clock);
  const S = await standService({ QUESTLINES_OPEN: 'on', ...extra });
  const raw = S.env.DB._raw;
  const now = () => Math.floor(clock / 1000);
  const at = (s) => { clock = s * 1000; };
  /** A step's `open`, and its `end` (with the outcome's choice, where it has one). */
  const open = (who, line, step) => S.call('/v1/ql/claim', { line, step, phase: 'open' }, who.secret);
  const ql = (who, line, step, choice) => S.call('/v1/ql/claim', { line, step, phase: 'end', ...(choice !== undefined ? { choice } : {}) }, who.secret);
  let day = 600, slot = 7, rq = 0;
  /** A Dagon's Breach receipt claimed - a fighter's ('dealt'), a rite's own ('rite'), a fighter who broke the rite (r 1). */
  const gate = async (who, x = 'dealt', r = undefined) => {
    const res = await S.call('/v1/gate/claim', { receipt: await mintReceipt({ d: day++, b: 'ruhn', s: who.id, c: 4242, x, ...(r ? { r } : {}) }, S.gatePriv, { subtle, nowS: now() }) }, who.secret);
    assert.equal(res.body.recorded, true, `the gate's row is written (${JSON.stringify(res.body)})`);
    return res.body;
  };
  /** An Elite Breach opened (a key staked, or the day's Rehearsal), its live breach cleared so the next may open. */
  const breach = async (who, rh = 0) => {
    const o = (await S.call('/v1/eg/open', { rq: `rq${String(++rq).padStart(16, '0')}`, ...(rh ? { rh: 1 } : {}) }, who.secret)).body;
    assert.match(o.b ?? '', /^[0-9a-f]{16}$/, `opened (${JSON.stringify(o)})`);
    raw.prepare('UPDATE players SET eg_live_b = NULL, eg_live_until = 0 WHERE id = ?').run(who.id);
    return { b: o.b, ez: o.ez, rh };
  };
  /** A Redoubt's receipt claimed (its `eg_redoubts` row), a Rehearsal's carrying `rh`. */
  const redoubt = async (who, br, w) => {
    const receipt = await mintEgReceipt({ q: 'w', b: br.b, s: who.id, z: br.ez, c: 77 + w, w, h: w * 5, t: 900, n: 1, ew: 0, l: 12, ...(br.rh ? { rh: 1 } : {}) }, S.gatePriv, { subtle, nowS: now() });
    const res = await S.call('/v1/eg/claim', { receipt }, who.secret);
    assert.equal(res.body.recorded, true, `the Redoubt's row is written (${JSON.stringify(res.body)})`);
  };
  /** A breach's end claimed - a Rehearsal's carries `rh` onto its `eg_runs` row. */
  const end = async (who, br) => {
    const receipt = await mintEgReceipt({ q: 'x', b: br.b, s: who.id, z: br.ez, c: 5, h: 5, t: 960, n: 1, ew: 0, l: 12, why: br.rh ? 'rehearsal' : 'home', ...(br.rh ? { rh: 1 } : {}) }, S.gatePriv, { subtle, nowS: now() });
    assert.equal((await S.call('/v1/eg/claim', { receipt }, who.secret)).body.recorded, true);
  };
  /** An Hour broken - a Brass Remnant's receipt claimed (its `sd_kills` row). */
  const hour = async (who) => {
    const res = await S.call('/v1/sd/claim', { receipt: await mintSdReceipt({ d: slot++, s: who.id, c: 1, x: 'dealt', l: 30 }, S.gatePriv, { subtle, nowS: now() }) }, who.secret);
    assert.equal(res.body.recorded, true);
  };
  /** The Sea Serpent slain - its receipt claimed (its `serpent_kills` row). */
  const serpent = async (who, d = 363) => {
    const res = await S.call('/v1/serpent/claim', { receipt: await mintSerpentReceipt({ d, b: 'sethrakul', s: who.id, c: 99, x: 'dealt', h: 4, l: 20 }, S.gatePriv, { subtle, nowS: now() }), character: CH, name: who.handle }, who.secret);
    assert.equal(res.body.recorded, true, `the serpent's row is written (${JSON.stringify(res.body)})`);
  };
  /** STAR8: a fallen star held - its receipt claimed (its `stars_held` row), each one a star of its own, a night's three
   *  and the next night's after them. */
  let held = 0;
  const STAR_N = Math.ceil(FESTIVAL_FROM_MS / STAR_HOUR_MS) + 5;
  const star = async (who) => {
    const i = held++;
    const receipt = await mintStarReceipt({ n: STAR_N + Math.floor(i / 3), k: i % 3, s: who.id, c: 7, l: 14 }, S.gatePriv, { subtle, nowS: now() });
    const res = await S.call('/v1/star/claim', { receipt, character: CH, name: who.handle }, who.secret);
    assert.equal(res.body.recorded, true, `the star's row is written (${JSON.stringify(res.body)})`);
  };
  const row = (who) => ({ ...raw.prepare('SELECT eg_keys, ql_titles, ql_key FROM players WHERE id = ?').get(who.id) });
  const steps = (who) => raw.prepare('SELECT line, step, opened_at, done_at, seen_at, choice FROM ql_steps WHERE account = ? ORDER BY line, step').all(who.id).map((r) => ({ ...r }));
  return { S, raw, at, now, open, ql, gate, breach, redoubt, end, hour, serpent, star, row, steps };
}

test('QL12 THE LAW: every step the service pays is witnessable - by a kind this module reads or its line\'s `after` - and each kind has its SQL; a line\'s title waits on its witnessed steps before it; the switch reads off, dev and on; the Valkynaz\'s SQL is egValkRedoubt (mutants: a kind unread; the title\'s steps; the fifth)', async (t) => {
  for (const k of QL_WITNESS_KINDS) assert.equal(typeof QL_WITNESS_SQL[k], 'string', `${k} has a witness`);
  assert.deepEqual(Object.keys(QL_WITNESS_SQL).sort(), [...QL_WITNESS_KINDS].sort());
  for (const [line, l] of Object.entries(QL_SERVICE_LINES)) {
    for (let s = 0; s < l.steps; s++) {
      if (!qlStepClaimed(line, s)) continue;
      assert.ok(Object.hasOwn(l.witness, s) || l.after, `${line} step ${s}: paid, and witnessed by a receipt or its line's after - never the client's word`);
    }
  }
  assert.deepEqual(qlTitleSteps('burningDoors'), [2, 3], 'the rite, then the breach');
  assert.deepEqual(qlTitleSteps('covensHoard'), [2]);
  assert.deepEqual(qlTitleSteps('weirRoad'), [0, 1, 2]);
  assert.deepEqual(qlTitleSteps('hourThatWasNot'), [1]);
  assert.deepEqual(qlTitleSteps('oldCoil'), [2]);
  assert.deepEqual(qlTitleSteps('thirteenthFrostfall'), [0, 2], 'STAR8: the first star, then the three');   // PIN MOVED (STAR8)
  assert.deepEqual(qlTitleSteps('nope'), []);
  // AUDIT STARFALL B2: the witnessed steps an end waits on - its line's before it, the law's own numbers
  assert.deepEqual([qlStepsBefore('thirteenthFrostfall', 0), qlStepsBefore('thirteenthFrostfall', 2), qlStepsBefore('weirRoad', 2), qlStepsBefore('burningDoors', 3), qlStepsBefore('covensHoard', 2), qlStepsBefore('nope', 1)], [[], [0], [0, 1], [2], [], []]);
  assert.equal(qlInOrderSql('burningDoors', 2), '1', 'the line\'s first witnessed step waits on nothing');
  assert.equal(qlInOrderSql('weirRoad', 2), '(SELECT COUNT(*) FROM ql_steps b WHERE b.account = ?1 AND b.line = ?2 AND b.step IN (0, 1) AND b.done_at IS NOT NULL) = 2');
  // T-B: the Starwarden's purse, the one a line pays
  assert.deepEqual({ ...QL_PURSES }, { thirteenthFrostfall: 30 });
  assert.equal(QL_STARWARDEN_CAKES, 30);
  assert.deepEqual([qlSwitchOf('on'), qlSwitchOf('dev'), qlSwitchOf('off'), qlSwitchOf(undefined), qlSwitchOf('yes')], ['on', 'dev', 'off', 'off', 'off']);
  const dev = { handle: 'Mac' }, env = (v) => ({ QUESTLINES_OPEN: v, DEVELOPER_HANDLES: 'Mac' });
  assert.deepEqual([questlinesOpenFor(dev, env('on')), questlinesOpenFor({ handle: 'Ann' }, env('on'))], [true, true]);
  assert.deepEqual([questlinesOpenFor(dev, env('dev')), questlinesOpenFor({ handle: 'Ann' }, env('dev'))], [true, false], 'dev: the developers alone');
  assert.deepEqual([questlinesOpenFor(dev, env('off')), questlinesOpenFor(dev, {})], [false, false], 'off, and off by default');
  assert.deepEqual({ ...QL_STATUS }, { 'ql-closed': 403, 'ql-body': 400 });
  // the Valkynaz's witness is egPay.js egValkRedoubt in SQL - asked of the real tables, one Redoubt's row at a time, every
  // Redoubt a receipt may name to 60
  const { S, raw } = await stood(t);
  const me = await S.registered('ValkProbe');
  raw.prepare("INSERT INTO ql_steps (account, line, step, opened_at) VALUES (?, 'probe', 0, 10)").run(me.id);
  const ask = raw.prepare(`SELECT ${QL_WITNESS_SQL.valkynaz} IS NOT NULL AS ok`);
  for (let w = 1; w <= 60; w++) {
    raw.prepare('DELETE FROM eg_redoubts WHERE account = ?').run(me.id);
    raw.prepare("INSERT INTO eg_redoubts (b, account, w, h, t, at) VALUES ('0123456789abcdef', ?, ?, 1, 1, 10)").run(me.id, w);
    assert.equal(ask.get(me.id, 'probe', 0).ok === 1, egValkRedoubt(w), `w ${w}`);
  }
});

test('QL12 THE BURNING DOORS: an `open` writes the step\'s opening; an `end` reads its witness - a receipt from before the LINE\'s first opening witnesses nothing, one at or after it does - the rite by a rite\'s own receipt or a fighter\'s that broke it, never a plain kill; the breach by a kill, never the rite alone; the Doorwarden once, on the step that completes the line\'s witnessed steps; the line\'s window, never a step\'s own; in the line\'s order (AUDIT STARFALL B2); a later step\'s receipt its ceiling (mutants: `>=` for `>`; the rite\'s embers; the breach\'s rite; the title\'s steps; the title\'s guard; QL12-step-window; QL12-order-ceiling; B2-the-order-unasked)', async (t) => {
  const { S, raw, at, open, ql, gate, row, steps } = await stood(t);
  const me = await S.registered('Doorward');
  // A RECEIPT FROM BEFORE: a breach closed and a rite broken at T0, the line opened after
  await gate(me, 'dealt', 1);
  await gate(me, 'rite');
  at(T0 + 100);
  assert.deepEqual(await open(me, 'burningDoors', 2), { status: 200, body: { opened: true } }, 'the rite\'s step opened');
  assert.deepEqual(await open(me, 'burningDoors', 2), { status: 200, body: { opened: true } }, 'an opening asked again opens once, and pays nothing');
  assert.deepEqual(await ql(me, 'burningDoors', 2), { status: 200, body: { witnessed: false } }, 'the T0 receipts predate the line: nothing witnessed');
  assert.deepEqual(steps(me), [{ line: 'burningDoors', step: 2, opened_at: T0 + 100, done_at: null, seen_at: null, choice: null }], 'one row, opened, nothing written by the unwitnessed end');
  // A PLAIN KILL IS NO RITE
  at(T0 + 200);
  await gate(me, 'dealt');
  assert.deepEqual((await ql(me, 'burningDoors', 2)).body, { witnessed: false }, 'a fighter who broke no rite');
  // THE RITE ALONE IS NO BREACH CLOSED
  at(T0 + 300);
  await gate(me, 'rite');
  assert.deepEqual((await ql(me, 'burningDoors', 2)).body, { witnessed: true }, 'the rite\'s own receipt, after the line\'s opening');
  assert.deepEqual((await open(me, 'burningDoors', 3)).body, { opened: true });
  assert.deepEqual((await ql(me, 'burningDoors', 3)).body, { witnessed: false }, 'the rite alone closes no breach - and the T0+200 kill is older than the rite that witnessed the step before');
  at(T0 + 350);
  await gate(me, 'rite');
  assert.deepEqual((await ql(me, 'burningDoors', 3)).body, { witnessed: false }, 'a second rite\'s own receipt, newer than the first: still no breach closed');
  // THE BREACH WITNESSED: the line's witnessed steps complete - the Doorwarden, told once
  at(T0 + 400);
  await gate(me, 'dealt');
  assert.deepEqual((await ql(me, 'burningDoors', 3)).body, { witnessed: true, title: 'doorwarden' }, 'the last witnessed step pays the title');
  assert.equal(row(me).ql_titles, qlTitleBit('doorwarden'));
  // PIN MOVED (AUDIT QUESTLINES SERVICE-7 (c)): laid once; a title step's later end answers it HELD, never paid again -
  // a retry of an answer lost after the commit is how the page hears it (the runner tells it once)
  assert.deepEqual((await ql(me, 'burningDoors', 3)).body, { witnessed: true, titleHeld: 'doorwarden' }, 'laid once, held after');
  assert.deepEqual((await ql(me, 'burningDoors', 2)).body, { witnessed: true, titleHeld: 'doorwarden' }, 'on any of its steps');
  assert.equal(row(me).ql_titles, qlTitleBit('doorwarden'), 'the bit laid once');
  assert.deepEqual(steps(me).map((s) => [s.step, s.done_at, s.seen_at]), [[2, T0 + 300, T0 + 300], [3, T0 + 400, T0 + 400]], 'each step the receipt that witnessed it');
  // A RECEIPT AT THE LINE'S OPENING'S OWN SECOND IS AFTER IT (PIN MOVED, AUDIT STARFALL B2: on the rite's step - the
  // breach's end waits on the rite's step, so it was the rite's own second it read)
  const me2 = await S.registered('Doorward2');
  at(T0 + 500);
  assert.deepEqual((await open(me2, 'burningDoors', 2)).body, { opened: true });
  await gate(me2, 'rite');
  assert.deepEqual((await ql(me2, 'burningDoors', 2)).body, { witnessed: true }, 'a receipt written at the opening\'s second counts - the breach not yet, so no title');
  assert.equal(row(me2).ql_titles, 0);
  // ONE FIGHT, ONE STEP (AUDIT QUESTLINES SERVICE-5): a fighter who broke the rite (two embers) witnesses the rite - and
  // that one receipt never the breach as well; the breach is its own fight's
  const f = await S.registered('RiteBreaker');
  at(T0 + 700);
  await open(f, 'burningDoors', 2);
  await gate(f, 'dealt', 1);
  assert.deepEqual((await ql(f, 'burningDoors', 2)).body, { witnessed: true }, 'a fighter\'s receipt that broke the rite');
  await open(f, 'burningDoors', 3);
  assert.deepEqual((await ql(f, 'burningDoors', 3)).body, { witnessed: false }, 'the same receipt witnesses one step');
  at(T0 + 800);
  await gate(f, 'dealt');
  assert.deepEqual((await ql(f, 'burningDoors', 3)).body, { witnessed: true, title: 'doorwarden' });
  // IN THE LINE'S ORDER, WHICHEVER END IS ASKED FIRST (PIN MOVED, AUDIT STARFALL B2): the breach's end before the rite's is
  // not witnessed - the rite's step is not done, and its receipt is the breach's floor - and asked again after the rite's
  // end, it is, and pays the title
  const o = await S.registered('OutOfOrder');
  at(T0 + 900);
  await open(o, 'burningDoors', 2);
  await gate(o, 'rite');
  at(T0 + 950);
  await gate(o, 'dealt');
  assert.deepEqual((await ql(o, 'burningDoors', 3)).body, { witnessed: false }, 'the breach\'s end first: the rite\'s step not done');
  assert.deepEqual((await ql(o, 'burningDoors', 2)).body, { witnessed: true }, 'the rite');
  assert.deepEqual((await ql(o, 'burningDoors', 3)).body, { witnessed: true, title: 'doorwarden' }, 'the breach asked again: newer than the rite');
  // THE TITLE ON THE ROW: held, on the wardrobe and worn, signed into a token
  assert.ok(titlesHeld({ handle: 'RiteBreaker', ql_titles: qlTitleBit('doorwarden') }, {}).includes('doorwarden'));
  const acct = await (await S.fetch('https://accounts.invalid/v1/account', { headers: { authorization: `Bearer ${f.secret}` } })).json();
  assert.ok(acct.wardrobe.titles.includes('doorwarden'), 'on the wardrobe');
  assert.equal((await S.call('/v1/account/title', { title: 'doorwarden' }, f.secret)).status, 200, 'and worn');
  const tok = (await S.call('/v1/auth/token', { secret: f.secret })).body.token;
  const v = await verifyToken(tok, S.identityPublic, { subtle, nowS: T0 + 950 });
  assert.ok(v.ok, v.why);
  assert.equal(v.claims.t, 'doorwarden', 'the vocabulary signs it, and the relay\'s verifier keeps it');
  // THE LINE'S WINDOW, NEVER THE STEP'S (AUDIT QUESTLINES SERVICE-2): a step whose own opening came late - its breach
  // closed before it - is witnessed from the line's first opening, the rite's receipt its floor
  const late = await S.registered('LateOpen');
  at(T0 + 1000);
  await open(late, 'burningDoors', 2);
  at(T0 + 1010);
  await gate(late, 'rite');
  assert.deepEqual((await ql(late, 'burningDoors', 2)).body, { witnessed: true });
  at(T0 + 1020);
  await gate(late, 'dealt');
  at(T0 + 1030);
  assert.deepEqual((await open(late, 'burningDoors', 3)).body, { opened: true }, 'the breach\'s step opened after its breach closed');
  assert.deepEqual((await ql(late, 'burningDoors', 3)).body, { witnessed: true, title: 'doorwarden' }, 'the line\'s window');
  // THE CEILING (SERVICE-5's order): a step's witness is older than the receipt that witnessed a later step - which only a
  // row written before B2's order can hold now (acct159-164 witnessed a later step first): a rite broken after that
  // breach's receipt witnesses no step before it (PIN MOVED, AUDIT STARFALL B2: the breach's end was asked first)
  const c = await S.registered('Ceiling');
  at(T0 + 1100);
  await open(c, 'burningDoors', 2);
  await gate(c, 'dealt');
  raw.prepare("INSERT INTO ql_steps (account, line, step, opened_at, done_at, seen_at) VALUES (?, 'burningDoors', 3, ?, ?, ?)").run(c.id, T0 + 1100, T0 + 1100, T0 + 1100);
  at(T0 + 1150);
  await gate(c, 'rite');
  assert.deepEqual((await ql(c, 'burningDoors', 2)).body, { witnessed: false }, 'a rite newer than the breach\'s receipt');
  assert.equal(row(c).ql_titles, 0);
  // and such a line, its earlier step's receipt older than the later's, still pays its title when the last of them lands
  const c2 = await S.registered('Ceiling2');
  at(T0 + 1200);
  await open(c2, 'burningDoors', 2);
  await gate(c2, 'rite');
  at(T0 + 1250);
  await gate(c2, 'dealt');
  raw.prepare("INSERT INTO ql_steps (account, line, step, opened_at, done_at, seen_at) VALUES (?, 'burningDoors', 3, ?, ?, ?)").run(c2.id, T0 + 1200, T0 + 1250, T0 + 1250);
  assert.deepEqual((await ql(c2, 'burningDoors', 2)).body, { witnessed: true, title: 'doorwarden' }, 'the rite, older than the breach\'s receipt: the line whole');
});

test('QL12 THE WEIR ROAD: a Redoubt\'s row witnesses `redoubt`, a Rehearsal\'s never (its stake says so, or its end where the stake is gone); three Redoubts newer than the one that witnessed the step before witness `redoubts3`; a Valkynaz\'s - every fifth - witnesses `valkynaz`; the Weirwalker after all three (mutants: the Rehearsal\'s stake; its end; the count; the fifth; the order)', async (t) => {
  const { S, raw, at, open, ql, gate, breach, redoubt, end, row } = await stood(t);
  const me = await S.registered('Weirwalker1');
  await gate(me);   // proven, and the first breach's key
  at(T0 + 100);
  assert.deepEqual((await open(me, 'weirRoad', 0)).body, { opened: true });
  // A REHEARSAL'S REDOUBT witnesses nothing - its stake is a Rehearsal's
  at(T0 + 200);
  const rh = await breach(me, 1);
  await redoubt(me, rh, 1);
  assert.deepEqual((await ql(me, 'weirRoad', 0)).body, { witnessed: false }, 'a Rehearsal\'s Redoubt');
  // and where its stake is gone (its opener's account gone with it), its end says so
  await redoubt(me, rh, 2);
  await end(me, rh);
  raw.prepare('DELETE FROM eg_stakes WHERE b = ?').run(rh.b);
  assert.deepEqual((await ql(me, 'weirRoad', 0)).body, { witnessed: false }, 'a Rehearsal\'s Redoubt with no stake: its end');
  // A BREACH'S REDOUBT witnesses it
  at(T0 + 86_400);
  const br = await breach(me);
  await redoubt(me, br, 1);
  assert.deepEqual((await ql(me, 'weirRoad', 0)).body, { witnessed: true });
  // THREE REDOUBTS newer than the one that witnessed the step before - that one counts not again
  at(T0 + 86_500);
  assert.deepEqual((await open(me, 'weirRoad', 1)).body, { opened: true });
  await redoubt(me, br, 2);
  await redoubt(me, br, 3);
  assert.deepEqual((await ql(me, 'weirRoad', 1)).body, { witnessed: false }, 'two newer (the first witnessed the step before)');
  await redoubt(me, br, 4);
  assert.deepEqual((await ql(me, 'weirRoad', 1)).body, { witnessed: true }, 'three');
  // A VALKYNAZ'S REDOUBT - every fifth
  at(T0 + 86_600);
  assert.deepEqual((await open(me, 'weirRoad', 2)).body, { opened: true });
  await redoubt(me, br, 9);
  assert.deepEqual((await ql(me, 'weirRoad', 2)).body, { witnessed: false }, 'the ninth is no Valkynaz\'s');
  await redoubt(me, br, 10);
  assert.deepEqual((await ql(me, 'weirRoad', 2)).body, { witnessed: true, title: 'weirwalker' }, 'the tenth is, and the line\'s three are done');
  assert.equal(row(me).ql_titles, qlTitleBit('weirwalker'));
  // the Weirwalker waits on every witnessed step before it
  const you = await S.registered('Weirwalker2');
  await gate(you);
  at(T0 + 86_700);
  await open(you, 'weirRoad', 2);
  const b3 = await breach(you);
  await redoubt(you, b3, 5);
  assert.deepEqual((await ql(you, 'weirRoad', 2)).body, { witnessed: false }, 'the Valkynaz\'s step alone: the two witnessed steps before it not done (PIN MOVED, AUDIT STARFALL B2)');
  assert.equal(row(you).ql_titles, 0);
});

test('QL12 THE HOUR AND THE OLD COIL: an Hour broken witnesses the Hour\'s step and a serpent slain the Coil\'s, each only after its line\'s opening - and each pays its line\'s title (mutants: the Hour\'s table; the serpent\'s; the opening ignored)', async (t) => {
  const { S, at, open, ql, hour, serpent, row } = await stood(t);
  const me = await S.registered('Witness', { character: CH });
  await hour(me);
  await serpent(me, 363);
  at(T0 + 100);
  assert.deepEqual((await open(me, 'hourThatWasNot', 1)).body, { opened: true });
  assert.deepEqual((await open(me, 'oldCoil', 2)).body, { opened: true });
  assert.deepEqual((await ql(me, 'hourThatWasNot', 1)).body, { witnessed: false }, 'the Hour broken before');
  assert.deepEqual((await ql(me, 'oldCoil', 2)).body, { witnessed: false }, 'the serpent slain before');
  at(T0 + 200);
  await hour(me);
  assert.deepEqual((await ql(me, 'oldCoil', 2)).body, { witnessed: false }, 'an Hour is no serpent');
  assert.deepEqual((await ql(me, 'hourThatWasNot', 1)).body, { witnessed: true, title: 'hourwitness' });
  at(T0 + 2 * 86_400 + 200);
  await serpent(me, 365);
  assert.deepEqual((await ql(me, 'oldCoil', 2)).body, { witnessed: true, title: 'satakalwitness' });
  assert.equal(row(me).ql_titles, qlTitleBit('hourwitness') | qlTitleBit('satakalwitness'));
  assert.deepEqual(titlesHeld({ handle: 'Witness', ql_titles: row(me).ql_titles }, {}).filter((x) => QL_TITLES.includes(x)), ['hourwitness', 'satakalwitness']);
});

test('STAR8 THE THIRTEENTH OF FROSTFALL: a star held after the line\'s first opening witnesses its first step, one held before it none; three more, each newer than that one, its third - two are not enough - and the three pay the Starwarden; the spindle\'s steps pay nothing (mutants: the star\'s table; the offset; the title\'s step)', async (t) => {
  const { S, at, open, ql, star, row } = await stood(t);
  const me = await S.registered('Starward', { character: CH });
  await star(me);
  at(T0 + 100);
  assert.deepEqual((await open(me, 'thirteenthFrostfall', 0)).body, { opened: true });
  assert.deepEqual((await ql(me, 'thirteenthFrostfall', 0)).body, { witnessed: false }, 'a star held before the line');
  at(T0 + 200);
  await star(me);
  assert.deepEqual((await ql(me, 'thirteenthFrostfall', 0)).body, { witnessed: true }, 'the first star: no title yet');
  assert.deepEqual((await ql(me, 'thirteenthFrostfall', 1, 'wound')).body, { why: 'unpaid' }, 'the Bluff is the client\'s');
  assert.deepEqual((await open(me, 'thirteenthFrostfall', 2)).body, { opened: true });
  at(T0 + 300);
  await star(me);
  await star(me);
  assert.deepEqual((await ql(me, 'thirteenthFrostfall', 2)).body, { witnessed: false }, 'two are not three');
  at(T0 + 400);
  await star(me);
  assert.deepEqual((await ql(me, 'thirteenthFrostfall', 2)).body, { witnessed: true, title: 'starwarden' });
  assert.equal(row(me).ql_titles, qlTitleBit('starwarden'));
  assert.deepEqual((await ql(me, 'thirteenthFrostfall', 3, 'burned')).body, { why: 'unpaid' }, 'the spindle\'s fate is the client\'s');
});

test('AUDIT STARFALL B2: A STAR COUNTS FOR ONE STEP, WHICHEVER END IS ASKED FIRST - QLTF03\'s three asked before QLTF01\'s star is not witnessed (its earlier witnessed step not done); QLTF01 then takes the first star, and QLTF03 the three after it: the Starwarden on four stars, never three. The Weir Road\'s three Redoubts the same, after its first (mutants: B2-the-order-unasked; B2-the-steps-before-unread)', async (t) => {
  const { S, raw, at, open, ql, star, breach, redoubt, gate, row, steps } = await stood(t);
  const me = await S.registered('OutOfOrderStars', { character: CH });
  at(T0 + 10);
  assert.deepEqual((await open(me, 'thirteenthFrostfall', 0)).body, { opened: true });
  for (const s of [20, 30, 40]) { at(T0 + s); await star(me); }
  at(T0 + 50);
  assert.deepEqual((await ql(me, 'thirteenthFrostfall', 2)).body, { witnessed: false }, 'the three before the first star\'s end: QLTF01 not done');
  assert.deepEqual(steps(me).map((s) => [s.step, s.done_at]), [[0, null], [2, null]], 'nothing written');
  at(T0 + 60);
  assert.deepEqual((await ql(me, 'thirteenthFrostfall', 0)).body, { witnessed: true }, 'QLTF01: the first star');
  assert.deepEqual((await ql(me, 'thirteenthFrostfall', 2)).body, { witnessed: false }, 'two stars after it are not three');
  at(T0 + 70);
  await star(me);
  assert.deepEqual((await ql(me, 'thirteenthFrostfall', 2)).body, { witnessed: true, title: 'starwarden' }, 'the fourth: the Starwarden');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM stars_held WHERE account = ?').get(me.id).n, 4, 'four stars held');
  assert.deepEqual(steps(me).map((s) => [s.step, s.seen_at]), [[0, T0 + 20], [2, T0 + 70]], 'one star a step: the first, and the third after it');
  assert.equal(row(me).ql_titles, qlTitleBit('starwarden'));
  // THE WEIR ROAD: `redoubts3` asked before `redoubt` waits, and its three are newer than the Redoubt that witnessed step 0
  const w = await S.registered('OutOfOrderWeir');
  await gate(w);   // proven, and the first breach's key
  at(T0 + 100);
  assert.deepEqual((await open(w, 'weirRoad', 0)).body, { opened: true });
  const br = await breach(w);
  for (const k of [1, 2, 3]) { at(T0 + 100 + k * 10); await redoubt(w, br, k); }
  at(T0 + 200);
  assert.deepEqual((await ql(w, 'weirRoad', 1)).body, { witnessed: false }, 'three Redoubts before the first Redoubt\'s end');
  assert.deepEqual((await ql(w, 'weirRoad', 0)).body, { witnessed: true });
  assert.deepEqual((await ql(w, 'weirRoad', 1)).body, { witnessed: false }, 'two after it are not three');
  at(T0 + 210);
  await redoubt(w, br, 4);
  assert.deepEqual((await ql(w, 'weirRoad', 1)).body, { witnessed: true }, 'the fourth');
});

test('T-B THE STARWARDEN\'S PURSE: QLTF03\'s witnessed end lays Starwarden and, in the same guarded write, 30 Soul Cakes on the account\'s count while the festival is open for it - answered `purse`; never twice (a re-claim answers it held), never outside the festival\'s days or with its switch off, never to a guest (mutants: T-B-the-purse-unpaid; T-B-the-days-unread; T-B-the-switch-unread; T-B-the-purse-unguarded; T-B-the-purse-said-to-every-claim)', async (t) => {
  const { S, raw, at, open, ql, star } = await stood(t, { FESTIVAL_OPEN: 'on' });
  const cakes = (who) => raw.prepare('SELECT fest_cakes FROM players WHERE id = ?').get(who.id).fest_cakes;
  /** The line run whole at `s`: its opening, a star and QLTF01's end, three stars more - answering QLTF03's end. */
  const warden = async (who, s) => {
    at(s);
    await open(who, 'thirteenthFrostfall', 0);
    await star(who);
    assert.deepEqual((await ql(who, 'thirteenthFrostfall', 0)).body, { witnessed: true });
    at(s + 10);
    for (let i = 0; i < 3; i++) await star(who);
    return (await ql(who, 'thirteenthFrostfall', 2)).body;
  };
  const me = await S.registered('Purse', { character: CH });
  raw.prepare('UPDATE players SET fest_cakes = 7 WHERE id = ?').run(me.id);
  assert.deepEqual(await warden(me, FEST_S), { witnessed: true, title: 'starwarden', purse: QL_STARWARDEN_CAKES }, 'the title and its purse');
  assert.equal(cakes(me), 7 + 30, 'onto the account\'s count');
  assert.deepEqual((await ql(me, 'thirteenthFrostfall', 2)).body, { witnessed: true, titleHeld: 'starwarden' }, 'a re-claim: held, no purse');
  assert.equal(cakes(me), 37, 'paid once');
  // OUTSIDE THE FESTIVAL'S DAYS: the title, no purse
  const late = await S.registered('PurseLate', { character: CH });
  assert.deepEqual(await warden(late, Math.floor(FESTIVALS[0].toMs / 1000) + 100), { witnessed: true, title: 'starwarden' }, 'the festival over');
  assert.equal(cakes(late), 0);
  // A GUEST: its end refused, nothing paid
  const g = await S.guest();
  at(FEST_S + 500);
  await open(g, 'thirteenthFrostfall', 2);
  assert.deepEqual((await ql(g, 'thirteenthFrostfall', 2)).body, { why: 'guest' });
  assert.equal(cakes(g), 0, 'never to a guest');
});

test('T-B THE PURSE AND THE SWITCH: inside the festival\'s days, FESTIVAL_OPEN off pays the title and no purse (mutants: T-B-the-switch-unread)', async (t) => {
  const { S, raw, at, open, ql, star } = await stood(t);
  const me = await S.registered('PurseShut', { character: CH });
  at(FEST_S);
  await open(me, 'thirteenthFrostfall', 0);
  await star(me);
  await ql(me, 'thirteenthFrostfall', 0);
  at(FEST_S + 10);
  for (let i = 0; i < 3; i++) await star(me);
  assert.deepEqual((await ql(me, 'thirteenthFrostfall', 2)).body, { witnessed: true, title: 'starwarden' }, 'the festival shut for the account');
  assert.equal(raw.prepare('SELECT fest_cakes FROM players WHERE id = ?').get(me.id).fest_cakes, 0);
});

test('T-B THE PURSE ON THE PAGE: the questlines\' door hears a paid purse - "+30 Soul Cakes" through the festival\'s doors, and the pack\'s Soul Cakes restacked to the account\'s count (festivalClient.js refreshFestival); an answer with no purse says nothing (mutants: T-B-the-door-deaf; T-B-the-pack-unrestacked)', async (t) => {
  const { S, at, open, ql, star } = await stood(t, { FESTIVAL_OPEN: 'on' });
  const me = await S.registered('PurseDoor', { character: CH });
  const kv = new Map([[SERVICE_KEY, 'https://accounts.invalid'], [SESSION_KEY, JSON.stringify({ secret: me.secret, id: me.id, kind: 'account' })]]);
  const storage = { getItem: (k) => kv.get(k) ?? null, setItem: (k, v) => kv.set(k, v), removeItem: (k) => kv.delete(k) };
  const door = questlineService({ search: '?online', fetch: S.fetch, storage });
  const entity = { isPlayer: true, items: [] };
  const said = [];
  let count = 0;
  bindFestival({ online: () => true, entity: () => entity, say: (l) => said.push(l), saved: () => {}, api: { mine: async () => ({ ok: true, data: { cakes: count } }), me: () => me.id } });
  try {
    at(FEST_S);
    await door.claim({ line: 'thirteenthFrostfall', step: 0, phase: 'open' });
    await star(me);
    assert.deepEqual((await door.claim({ line: 'thirteenthFrostfall', step: 0, phase: 'end' })).data, { witnessed: true });
    at(FEST_S + 10);
    for (let i = 0; i < 3; i++) await star(me);
    count = 30;   // the account's count as the festival's own read says it after the purse
    const a = await door.claim({ line: 'thirteenthFrostfall', step: 2, phase: 'end' });
    assert.deepEqual(a.data, { witnessed: true, title: 'starwarden', purse: 30 });
    for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r));
    assert.deepEqual(said, ['+30 Soul Cakes'], 'said as a find is');
    assert.equal(soulCakesHeld(entity.items), 30, 'the pack restacked to the count');
    await door.claim({ line: 'thirteenthFrostfall', step: 2, phase: 'end' });
    assert.deepEqual(said, ['+30 Soul Cakes'], 'a re-claim says nothing');
    assert.equal(hearPurse({ ok: true, data: { witnessed: true, title: 'starwarden' } }), false);
    assert.equal(hearPurse({ ok: false, error: 'offline' }), false);
  } finally { _resetFestivalClientForTests(); }
});

test('QL12 THE COVENS\' HOARD: its last step is witnessed only behind the Burning Doors witnessed whole (the Doorwarden held - never its breach alone); Covenbane on its END, never its opening; the Weir Key once an account - to an end that keeps it, a seal no bar to a later keep, never twice and said so (mutants: the after-gate; the opening paying; the choice; the key\'s guard; the balance; keyHeld)', async (t) => {
  const { S, at, open, ql, gate, row, steps } = await stood(t);
  /** The Burning Doors witnessed whole at `s`: the line opened, a rite, its end, a breach, its end. */
  const doors = async (who, s) => {
    at(s);
    await open(who, 'burningDoors', 2);
    await gate(who, 'rite');
    await ql(who, 'burningDoors', 2);
    at(s + 10);
    await gate(who);
    assert.deepEqual((await ql(who, 'burningDoors', 3)).body, { witnessed: true, title: 'doorwarden' });
  };
  const me = await S.registered('Keeper');
  at(T0 + 100);
  assert.deepEqual((await open(me, 'covensHoard', 2)).body, { opened: true });
  assert.deepEqual((await ql(me, 'covensHoard', 2, 'keep')).body, { witnessed: false }, 'the Burning Doors not yet witnessed');
  assert.deepEqual(row(me), { eg_keys: 0, ql_titles: 0, ql_key: 0 }, 'nothing paid');
  // ONE STEP IS NOT THE LINE WHOLE (AUDIT QUESTLINES SERVICE-4) - PIN MOVED (AUDIT STARFALL B2): the breach's end asked
  // before the rite's is not witnessed at all now; the rite's alone is, and the Doorwarden still not held
  await open(me, 'burningDoors', 2);
  at(T0 + 120);
  await gate(me, 'rite');
  at(T0 + 150);
  await gate(me);   // the first breach closed: the Spire's certain key
  assert.deepEqual((await ql(me, 'burningDoors', 3)).body, { witnessed: false }, 'the breach\'s end before the rite\'s: the line\'s order');
  assert.deepEqual((await ql(me, 'covensHoard', 2, 'keep')).body, { witnessed: false }, 'the Doorwarden not held');
  assert.deepEqual((await ql(me, 'burningDoors', 2)).body, { witnessed: true }, 'the rite witnessed');
  assert.deepEqual((await ql(me, 'covensHoard', 2, 'keep')).body, { witnessed: false }, 'the rite alone: the Doorwarden not held');
  assert.deepEqual((await ql(me, 'burningDoors', 3)).body, { witnessed: true, title: 'doorwarden' }, 'the breach, after the rite: the line whole');
  // AN OPENING ASKED AGAIN PAYS NOTHING (SERVICE-6: Covenbane was told at QLCH03's start)
  assert.deepEqual((await open(me, 'covensHoard', 2)).body, { opened: true });
  assert.equal(row(me).ql_titles & qlTitleBit('covenbane'), 0, 'no Covenbane at the opening');
  const before = row(me).eg_keys;
  const paid = (await ql(me, 'covensHoard', 2, 'keep')).body;
  assert.deepEqual(paid, { witnessed: true, title: 'covenbane', key: true, keys: before + 1 }, 'kept: the key, its balance, and Covenbane');
  assert.deepEqual(row(me), { eg_keys: before + 1, ql_titles: qlTitleBit('doorwarden') | qlTitleBit('covenbane'), ql_key: 1 });
  assert.deepEqual((await ql(me, 'covensHoard', 2, 'keep')).body, { witnessed: true, titleHeld: 'covenbane', keyHeld: true }, 'once an account - and said so (AUDIT QUESTLINES LINES-4); the title held (SERVICE-7 (c), PIN MOVED)');
  assert.equal(row(me).eg_keys, before + 1, 'no second key');
  // SEALED: the title, no key - the step's record the first end's choice; and a later character of the account who keeps
  // it is the account's key (AUDIT QUESTLINES LINES-4: a first `seal` barred the key from every character for good)
  const seal = await S.registered('Sealer');
  await doors(seal, T0 + 300);
  await open(seal, 'covensHoard', 2);
  const k0 = row(seal).eg_keys;
  assert.deepEqual((await ql(seal, 'covensHoard', 2, 'seal')).body, { witnessed: true, title: 'covenbane' });
  assert.deepEqual([row(seal).eg_keys, row(seal).ql_key], [k0, 0], 'sealed: no key');
  assert.deepEqual((await ql(seal, 'covensHoard', 2, 'keep')).body, { witnessed: true, titleHeld: 'covenbane', key: true, keys: k0 + 1 }, 'a later keep: the account\'s key (its title held - SERVICE-7 (c))');
  assert.equal(steps(seal).find((s) => s.line === 'covensHoard').choice, 'seal', 'the record keeps the first choice');
  // A STEP DONE BY AN END WITH NO CHOICE takes the next end's
  const late = await S.registered('LateKeeper');
  await doors(late, T0 + 400);
  const k1 = row(late).eg_keys;
  assert.deepEqual((await ql(late, 'covensHoard', 2)).body, { witnessed: true, title: 'covenbane' }, 'done, undecided - its opening never landed: the end opens it');
  assert.deepEqual((await ql(late, 'covensHoard', 2, 'keep')).body, { witnessed: true, titleHeld: 'covenbane', key: true, keys: k1 + 1 }, 'then kept');
});

test('QL12 THE REFUSALS: a guest\'s opening is written and its end refused, paying nothing; a bad body - a phase missing among them - is 400; a step the service pays nothing is `unpaid` at its end, and opened (its line\'s window); the switch shut is 403 for everyone, at `dev` for all but the developers (mutants: the guest; the phase; the switch; qlStepClaimed)', async (t) => {
  const { S, raw, open, ql } = await stood(t, { DEVELOPER_HANDLES: 'DevOne' });
  const g = await S.guest();
  assert.deepEqual(await ql(g, 'burningDoors', 3), { status: 200, body: { why: 'guest' } });
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM ql_steps').get().n, 0, 'a guest\'s end writes nothing');
  assert.deepEqual(await open(g, 'burningDoors', 3), { status: 200, body: { opened: true } }, 'AUDIT QUESTLINES SERVICE-1: its opening is written - the guest who registers keeps it');
  assert.deepEqual(raw.prepare('SELECT account, done_at FROM ql_steps').all().map((r) => ({ ...r })), [{ account: g.id, done_at: null }]);
  const me = await S.registered('Plain');
  for (const bad of [{}, { line: 'nope', step: 0, phase: 'open' }, { line: 'burningDoors', step: 5, phase: 'open' }, { line: 'burningDoors', step: -1, phase: 'end' }, { line: 'burningDoors', step: '3', phase: 'end' }, { line: 'covensHoard', step: 2, phase: 'end', choice: 'KEEP' }, { line: 'burningDoors', step: 3 }, { line: 'burningDoors', step: 3, phase: 'close' }]) {
    assert.deepEqual(await S.call('/v1/ql/claim', bad, me.secret), { status: 400, body: { error: 'ql-body' } }, JSON.stringify(bad));
  }
  assert.deepEqual(await ql(me, 'burningDoors', 0), { status: 200, body: { why: 'unpaid' } }, 'the letter\'s end is the client\'s alone');
  assert.deepEqual(await ql(me, 'weirRoad', 3), { status: 200, body: { why: 'unpaid' } });
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM ql_steps WHERE account = ?').get(me.id).n, 0, 'an unpaid end writes nothing');
  assert.deepEqual(await open(me, 'burningDoors', 0), { status: 200, body: { opened: true } }, 'SERVICE-2: the letter\'s opening is the line\'s - its first letter opens the witness\'s window');
  // the switch, read as FIRMAMENT_OPEN is
  const ctx = { db: S.env.DB };
  const dev = { id: 'x', handle: 'DevOne' }, plain = { id: 'y', handle: 'Plain' };
  for (const env of [{}, { QUESTLINES_OPEN: 'off' }]) assert.deepEqual(await claimQl({ ...ctx, env }, dev, { line: 'burningDoors', step: 3, phase: 'open' }, T0), { error: 'ql-closed' });
  assert.deepEqual(await claimQl({ ...ctx, env: { QUESTLINES_OPEN: 'dev', DEVELOPER_HANDLES: 'DevOne' } }, plain, { line: 'burningDoors', step: 3, phase: 'open' }, T0), { error: 'ql-closed' });
});

test('QL12 THE SWITCH THROUGH THE WORKER: at `dev` the developers claim and nobody else; `off` is 403 for everyone (mutants: the switch; dev open to all)', async (t) => {
  const D = await stood(t, { QUESTLINES_OPEN: 'dev', DEVELOPER_HANDLES: 'DevOne' });
  const devAcct = await D.S.registered('DevOne'), other = await D.S.registered('NotDev');
  assert.deepEqual(await D.open(other, 'burningDoors', 3), { status: 403, body: { error: 'ql-closed' } });
  assert.deepEqual(await D.open(devAcct, 'burningDoors', 3), { status: 200, body: { opened: true } });
  assert.equal(D.raw.prepare('SELECT COUNT(*) AS n FROM ql_steps').get().n, 1, 'the refused claim wrote nothing');
  const Off = await standService({ QUESTLINES_OPEN: 'off' });
  const anyone = await Off.registered('Anyone');
  assert.deepEqual(await Off.call('/v1/ql/claim', { line: 'burningDoors', step: 3, phase: 'open' }, anyone.secret), { status: 403, body: { error: 'ql-closed' } });
});

test('QL12 THE ROUTE (AUDIT FIVE-ASKS A1\'s lesson): /v1/ql/claim is listed, behind a session and never open; a stranger is refused; the header names it; the config opens it; the migration lays its table and columns', async (t) => {
  assert.ok(ROUTES.has('/v1/ql/claim') && !OPEN_ROUTES.has('/v1/ql/claim'), 'a route the worker answers, behind a session');
  const { S } = await stood(t);
  assert.equal((await S.call('/v1/ql/claim', { line: 'burningDoors', step: 3 })).status, 401, 'a stranger claims nothing');
  const index = read('server-account/src/index.js');
  assert.match(index, /\/\/ {3}POST \/v1\/ql\/claim {4}\{ line, step, phase, choice\? \}/, 'the header\'s route list');
  assert.match(index, /if \(path === '\/v1\/ql\/claim' && request\.method === 'POST'\) \{/);
  assert.match(read('server-account/wrangler.toml'), /^QUESTLINES_OPEN = "on"$/m);
  const sql = read('server-account/migrations/0133_questlines.sql');
  assert.match(sql, /^CREATE TABLE IF NOT EXISTS ql_steps \(/m);
  assert.match(sql, /^ {2}PRIMARY KEY \(account, line, step\),$/m);
  assert.match(sql, /^ {2}seen_at {3}INTEGER,$/m, 'AUDIT QUESTLINES SERVICE-5: the receipt that witnessed a step, so no receipt witnesses two');
  assert.match(sql, /^ALTER TABLE players ADD COLUMN ql_titles INTEGER NOT NULL DEFAULT 0;$/m);
  assert.match(sql, /^ALTER TABLE players ADD COLUMN ql_key INTEGER NOT NULL DEFAULT 0;$/m);
  assert.match(read('.github/workflows/account-deploy.yml'), /^ {6}- "src\/net\/questlineClaims\.js"$/m, 'the shared law deploys the service');
});

test('QL12 THE VOCABULARY: the six join TITLES last, in QL_TITLES\' order; a registered row holds each by its bit and a guest none; their words; their colours - each its own, more than 40 from every title\'s; a title\'s loot banner (mutants: the order; the guest; a word)', () => {
  // PIN MOVED (STAR8): the five and the Starwarden of the Thirteenth of Frostfall, its bit the sixth (63 every one)
  assert.deepEqual(TITLES.slice(-8, -2) /* PIN MOVED (WITCH1): Witchwarden and Hearthkeeper joined the list last */, [...QL_TITLES]);
  assert.deepEqual([...QL_TITLES], ['doorwarden', 'covenbane', 'weirwalker', 'hourwitness', 'satakalwitness', 'starwarden']);
  for (const t of QL_TITLES) {
    assert.deepEqual(titlesHeld({ handle: 'Mac', ql_titles: qlTitleBit(t) }, {}), [t], `${t} by its bit alone`);
    assert.deepEqual(titlesHeld({ handle: null, ql_titles: 63 }, {}), [], 'a guest row holds none');
  }
  assert.deepEqual(titlesHeld({ handle: 'Mac', ql_titles: 63 }, {}), [...QL_TITLES], 'all six, in the lines\' order');
  assert.deepEqual(QL_TITLES.map((t) => TITLE_TEXT[t]), ['Doorwarden', 'Covenbane', 'Weirwalker', 'Witness of the Hour', "Satakal's Witness", 'Starwarden']);
  assert.deepEqual(QL_TITLES.map((t) => cssRgba(TITLE_RGBA[t])), ['#e8400c', '#d0aa10', '#1f5fff', '#ada530', '#12b8b8', '#7850ff'], 'the ember, the coven\'s gold, the Spire\'s blue, Akatosh\'s brass, the sea\'s teal, a falling star\'s violet');
  const apart = (a, b) => Math.hypot(...[0, 1, 2].map((i) => (a[i] - b[i]) * 255));
  for (const t of QL_TITLES) {
    for (const o of TITLES.filter((x) => x !== t)) assert.ok(apart(TITLE_RGBA[t], TITLE_RGBA[o]) > 40, `${t} apart from the ${o}'s (${apart(TITLE_RGBA[t], TITLE_RGBA[o]).toFixed(0)})`);
  }
  const e = honourEntry({ kind: 'title', key: 'satakalwitness' });
  assert.deepEqual([e.name, e.kicker, e.honour.rgba], ["Satakal's Witness", 'New Title', TITLE_RGBA.satakalwitness], 'its loot banner');
});

// ═══ AUDIT QUESTLINES (SERVICE-1, SERVICE-2, SERVICE-3, SERVICE-6, SERVICE-7): THE CLIENT'S HALF, END TO END ═══
// The real line runner (systems/questlines/qlLineRunner.js) through the real door (net/accountClient.js
// accountQuestlines) into the real Worker - no test joined them, and a door posting to the wrong path, an end dropping
// its outcome, a load not asking an open again all stayed green.

/** A runner standing on the Worker: a machine that starts and ends steps by name, the door's wire recorded, a door that
 *  can be cut (`down`), the clocks, the honours told. Only the claims of the `lines` under test reach the service (the
 *  others are answered `unpaid`, kept off the wire). */
function runnerOn(S, who, lines) {
  const kv = new Map([[SESSION_KEY, JSON.stringify({ secret: who.secret, id: who.id, kind: who.handle ? 'account' : 'guest' })], [SERVICE_KEY, 'https://accounts.invalid']]);
  const storage = { getItem: (k) => kv.get(k) ?? null, setItem: (k, v) => kv.set(k, v), removeItem: (k) => kv.delete(k) };
  const door = accountQuestlines({ fetch: S.fetch, storage });
  const R = { wire: [], down: 0, lose: 0, honours: [], clock: { s: 1000, ms: 0 }, inflight: new Set() };
  const claim = async (b) => {
    if (!lines.includes(b.line)) return { ok: true, data: { why: 'unpaid' } };
    if (R.down > 0) { R.down--; R.wire.push([b.line, b.step, b.phase, 'down']); return { ok: false, error: 'offline' }; }
    const a = await door.claim(b);
    // AUDIT QUESTLINES SERVICE-7 (c): an answer lost AFTER the service committed it (a timeout on the way back)
    if (R.lose > 0) { R.lose--; R.wire.push([b.line, b.step, b.phase, 'lost', a?.ok ? a.data : a]); return { ok: false, error: 'offline' }; }
    R.wire.push([b.line, b.step, b.phase, a?.ok ? a.data : a]);
    return a;
  };
  const service = { account: door.account, guest: door.guest, claim: (b) => { const p = claim(b); R.inflight.add(p); p.finally(() => R.inflight.delete(p)); return p; } };
  let uid = 1;
  const machine = { quests: new Map(), questsToInvoke: [],
    scheduleQuestByName(name) { const q = { uid: uid++, questName: name, questComplete: false, questTombstoned: false }; machine.questsToInvoke.push(q); return q; },
    end(name) { for (const q of machine.quests.values()) if (q.questName === name && !q.questComplete) { q.questComplete = true; q.questSuccess = true; return q; } return null; } };
  R.make = () => createLineRunner({ machine, service, nowMs: () => R.clock.ms, ctx: { level: () => 30, online: () => true, nowSeconds: () => R.clock.s, onHonour: (h) => R.honours.push(h) } });
  R.runner = R.make();
  /** A tick: the runner looks, the machine starts what it scheduled, the claims land and the runner hears them. */
  R.tick = async () => {
    R.runner.look();
    for (const q of machine.questsToInvoke.splice(0)) machine.quests.set(q.uid, q);
    while (R.inflight.size) await Promise.allSettled([...R.inflight]);
    await new Promise((r) => setImmediate(r));
  };
  /** A step ended well, with its outcome. */
  R.done = (quest, id = 'done') => R.runner.ended(machine.end(quest), { id, failure: false });
  /** Time passes - the character's and the page's. */
  R.wait = (s, ms = 0) => { R.clock.s += s; R.clock.ms += ms; };
  /** A load: the runner remade from its own save. */
  R.load = () => { const save = R.runner.snapshot(); R.runner = R.make(); R.runner.restore(save); };
  /** Ticks, an hour of the character's time apart (AUDIT QUESTLINES LINES-17: one new line an hour), until `id` begins. */
  R.begin = async (id) => { for (let i = 0; i < 20 && !R.runner.lineState(id); i++) { await R.tick(); if (!R.runner.lineState(id)) R.wait(STEP_GAP_S); } };
  /** The session's kind changed - a guest registered in place. */
  R.registered = () => kv.set(SESSION_KEY, JSON.stringify({ secret: who.secret, id: who.id, kind: 'account' }));
  return R;
}

test('AUDIT QUESTLINES SERVICE-1/-3, LINES-2: a guest\'s page begins no line the service pays (its deeds are never recorded) and says why; the guest registers in place and the Old Coil begins - through the real runner and door every claim carries its phase, each step is opened, a load asks again only what is owed, the serpent slain after it is witnessed and Satakal\'s Witness paid and told (mutants: the account gate; the door\'s path; the phase dropped)', async (t) => {
  setPref(QUESTLINES_PREF, true);
  const H = await stood(t);
  const g = await H.S.guest();
  const R = runnerOn(H.S, g, ['oldCoil']);
  for (let i = 0; i < 14; i++) { await R.tick(); R.wait(STEP_GAP_S); }
  assert.equal(R.runner.lineState('oldCoil'), null, 'a guest\'s page: the line not begun');
  const row = R.runner.rows().find((l) => l.id === 'oldCoil');
  assert.deepEqual([row.state, row.opens], ['locked', 'Opens with a registered account.']);
  assert.deepEqual(R.wire, [], 'nothing asked');
  // the guest registers - in place, the same id
  H.at(T0 + 50);
  assert.equal((await H.S.call('/v1/auth/register', { handle: 'WasGuest', password: 'a good long one', ...ACCEPTED }, g.secret)).status, 200);
  R.registered();
  const me = { ...g, handle: 'WasGuest' };
  await R.begin('oldCoil');
  for (const q of ['QLOC01', 'QLOC02']) { R.done(q); R.wait(STEP_GAP_S); await R.tick(); }
  assert.ok(R.wire.every(([, , phase]) => phase === 'open'), 'every opening says so');
  assert.deepEqual(R.wire.map(([l, s, , d]) => [l, s, d]), [['oldCoil', 0, { opened: true }], ['oldCoil', 1, { opened: true }], ['oldCoil', 2, { opened: true }]], 'each step of a line the service pays is opened');
  assert.equal(H.steps(me).length, 3, 'written');
  const asked = R.wire.length;
  R.load();
  await R.tick();
  assert.equal(R.wire.length, asked, 'a load: nothing owed - every opening was answered');
  // the serpent slain, its receipt claimed; QLOC03 ends with its outcome
  H.at(T0 + 100);
  await H.serpent(me);
  H.at(T0 + 200);
  R.done('QLOC03', 'scale');
  await R.tick();
  assert.deepEqual(R.wire.at(-1), ['oldCoil', 2, 'end', { witnessed: true, title: 'satakalwitness' }]);
  assert.deepEqual(R.honours, [{ line: 'oldCoil', title: 'satakalwitness', key: false, keys: null, keyHeld: false }], 'told once');
  assert.equal(H.row(me).ql_titles, qlTitleBit('satakalwitness'));
  assert.equal(R.runner.lineState('oldCoil').claims[2], 'witnessed');
});

test('AUDIT QUESTLINES SERVICE-7 (c): a title whose answer was lost after the service laid it is told when its retry answers it HELD - once, and after a load too; a held title is never told for an answer that arrived (another character of the account finishing the line again) (mutants: the held title never told; told for every answer; a restored end never lost)', async (t) => {
  setPref(QUESTLINES_PREF, true);
  const H = await stood(t);
  let day = 330;   // a serpent's day, each fight its own
  const toTheEnd = async (R, who, lose, load = false) => {
    await R.begin('oldCoil');
    for (const q of ['QLOC01', 'QLOC02']) { R.done(q); R.wait(STEP_GAP_S); await R.tick(); }
    await H.serpent(who, day++);
    R.lose = lose;
    R.done('QLOC03', 'scale');
    await R.tick();
    if (load) R.load();
    R.wait(0, CLAIM_RETRY_MS);
    await R.tick();
  };
  const me = await H.S.registered('LostAnswer', { character: CH });
  H.at(T0 + 10);
  const R = runnerOn(H.S, me, ['oldCoil']);
  await toTheEnd(R, me, 1);
  assert.equal(H.row(me).ql_titles, qlTitleBit('satakalwitness'), 'laid by the answer that was lost');
  assert.deepEqual(R.wire.at(-2).slice(0, 4), ['oldCoil', 2, 'end', 'lost']);
  assert.deepEqual(R.wire.at(-1), ['oldCoil', 2, 'end', { witnessed: true, titleHeld: 'satakalwitness' }]);
  assert.deepEqual(R.honours.map((h) => h.title), ['satakalwitness'], 'told on the retry, once');
  // the same loss, and a load before the retry: the save never heard the end answered
  const two = await H.S.registered('LostThenLoaded', { character: CH });
  const R2 = runnerOn(H.S, two, ['oldCoil']);
  await toTheEnd(R2, two, 1, true);
  assert.deepEqual(R2.honours.map((h) => h.title), ['satakalwitness'], 'told after the load');
  // another character of the first account finishes the line: the title held, its answer arrived - nothing told
  const R3 = runnerOn(H.S, me, ['oldCoil']);
  await toTheEnd(R3, me, 0);
  assert.ok(R3.wire.some(([l, s, ph, d]) => l === 'oldCoil' && s === 2 && ph === 'end' && d?.titleHeld === 'satakalwitness'), 'answered held');
  assert.deepEqual(R3.honours, [], 'an answer that arrived: never told again');
});

test('AUDIT QUESTLINES SERVICE-2/-3: a claim is never given up - the Hour\'s opening cut for longer than CLAIM_TRIES, the Hour broken meanwhile, the line\'s first letter its window: the end witnesses it; an end the service has not seen is `unseen` and asked again until a deed is; a load asks a current step\'s unanswered opening again (mutants: the open dropped after CLAIM_TRIES; the slow cadence; restore\'s open)', async (t) => {
  setPref(QUESTLINES_PREF, true);
  const H = await stood(t);
  const me = await H.S.registered('Witness2', { character: CH });
  const lines = ['hourThatWasNot'];
  const R = runnerOn(H.S, me, lines);
  H.at(T0 + 10);
  await R.begin('hourThatWasNot');   // QLHR01 starts: the line's first letter, opened
  assert.deepEqual(R.wire, [['hourThatWasNot', 0, 'open', { opened: true }]]);
  R.done('QLHR01');
  R.wait(STEP_GAP_S);
  R.down = CLAIM_TRIES + 1;   // the service unreachable: QLHR02's opening cut, past every quick try
  await R.tick();
  for (let i = 0; i < CLAIM_TRIES; i++) { R.wait(0, CLAIM_RETRY_MS); await R.tick(); }
  assert.equal(R.wire.filter(([, s, p, d]) => s === 1 && p === 'open' && d === 'down').length, CLAIM_TRIES, 'the quick tries, all cut');
  R.wait(0, CLAIM_RETRY_MS);
  await R.tick();
  assert.equal(R.wire.length, 1 + CLAIM_TRIES, 'after CLAIM_TRIES: the slow cadence, not the minute');
  R.wait(0, CLAIM_SLOW_MS);
  await R.tick();
  assert.equal(R.wire.at(-1)[3], 'down', 'and asked again - never given up');
  // the Hour broken while the opening is still cut
  H.at(T0 + 500);
  await H.hour(me);
  R.wait(0, CLAIM_SLOW_MS);
  await R.tick();
  assert.deepEqual(R.wire.at(-1), ['hourThatWasNot', 1, 'open', { opened: true }], 'the opening lands - after the receipt');
  H.at(T0 + 600);
  R.done('QLHR02', 'shatter');
  await R.tick();
  assert.deepEqual(R.wire.at(-1), ['hourThatWasNot', 1, 'end', { witnessed: true, title: 'hourwitness' }], 'witnessed: the line\'s first letter opened the window');
  // AN END NOT SEEN: the Old Coil's serpent claimed before the line's first letter - `unseen`, asked again, then a deed
  await H.serpent(me, 363);
  H.at(T0 + 650);
  lines.push('oldCoil');
  R.runner.restore({ ...R.runner.snapshot(), oldCoil: { step: 2, outcomes: {}, done: false, wait: 0, claims: {} } });   // a save from before its opening's answer
  await R.tick();
  assert.deepEqual(R.wire.at(-1), ['oldCoil', 2, 'open', { opened: true }], 'a load asks a current step\'s unanswered opening again');
  H.at(T0 + 700);
  R.done('QLOC03', 'scale');
  await R.tick();
  assert.deepEqual(R.wire.at(-1), ['oldCoil', 2, 'end', { witnessed: false }]);
  assert.equal(R.runner.lineState('oldCoil').claims[2], 'unseen');
  assert.equal(R.runner.rows().find((l) => l.id === 'oldCoil').steps[2].unseen, true, 'the window says so');
  H.at(T0 + 3 * 86_400);
  await H.serpent(me, 366);
  R.wait(0, CLAIM_RETRY_MS);
  await R.tick();
  assert.deepEqual(R.wire.at(-1), ['oldCoil', 2, 'end', { witnessed: true, title: 'satakalwitness' }], 'a later deed witnesses it');
  assert.equal(R.runner.rows().find((l) => l.id === 'oldCoil').steps[2].unseen, false);
});

test('AUDIT QUESTLINES SERVICE-3/-7: the Covens\' Hoard kept through the real runner - the end carries the outcome, the key is paid and its balance handed on (mutants: the end\'s outcome dropped; `keys` dropped)', async (t) => {
  setPref(QUESTLINES_PREF, true);
  const H = await stood(t);
  const me = await H.S.registered('Keeper2');
  // the Burning Doors witnessed whole, as its claims say
  H.at(T0 + 100);
  await H.open(me, 'burningDoors', 0);
  H.at(T0 + 120);
  await H.gate(me, 'rite');
  await H.ql(me, 'burningDoors', 2);
  H.at(T0 + 150);
  await H.gate(me);
  assert.deepEqual((await H.ql(me, 'burningDoors', 3)).body, { witnessed: true, title: 'doorwarden' });
  const R = runnerOn(H.S, me, ['covensHoard']);
  R.runner.restore({ burningDoors: { step: 5, outcomes: {}, done: true, wait: 0, claims: { 2: 'witnessed', 3: 'witnessed' } }, covensHoard: { step: 2, outcomes: {}, done: false, wait: 0, claims: {} } });
  await R.tick();   // QLCH03 starts
  assert.ok(R.wire.some(([l, st, p]) => l === 'covensHoard' && st === 2 && p === 'open'), 'QLCH03 opened');
  const before = H.row(me).eg_keys;
  R.done('QLCH03', 'keep');
  await R.tick();
  assert.deepEqual(R.wire.at(-1), ['covensHoard', 2, 'end', { witnessed: true, title: 'covenbane', key: true, keys: before + 1 }]);
  assert.deepEqual(R.honours, [{ line: 'covensHoard', title: 'covenbane', key: true, keys: before + 1, keyHeld: false }], 'the key\'s balance handed on, for the pack');
  assert.equal(H.row(me).ql_key, 1);
});

test('AUDIT QUESTLINES DOC-4: the door itself - accountQuestlines posts to the route the Worker answers, a refused session is forgotten, and with no session there is no account to claim for; guest() reads a guest\'s session (mutants: the route; the forgetting; account() always truthy; guest())', async (t) => {
  const { S } = await stood(t);
  const me = await S.registered('DoorKeeper');
  const g = await S.guest();
  const store = (sess) => { const kv = new Map([[SERVICE_KEY, 'https://accounts.invalid'], ...(sess ? [[SESSION_KEY, JSON.stringify(sess)]] : [])]); return { kv, getItem: (k) => kv.get(k) ?? null, setItem: (k, v) => kv.set(k, v), removeItem: (k) => kv.delete(k) }; };
  const mine = store({ secret: me.secret, id: me.id, kind: 'account' });
  const door = accountQuestlines({ fetch: S.fetch, storage: mine });
  assert.deepEqual(await door.claim({ line: 'burningDoors', step: 3, phase: 'open' }), { ok: true, status: 200, data: { opened: true } }, 'the route the Worker answers');
  assert.equal(door.account(), me.id);
  assert.equal(door.guest(), false);
  assert.equal(accountQuestlines({ fetch: S.fetch, storage: store({ secret: g.secret, id: g.id, kind: 'guest' }) }).guest(), true, 'a guest\'s session');
  const none = accountQuestlines({ fetch: S.fetch, storage: store(null) });
  assert.equal(none.account(), null, 'no session: no account to claim for');
  const dead = store({ secret: 'not-a-session-secret-at-all-000000', id: me.id, kind: 'account' });
  const a = await accountQuestlines({ fetch: S.fetch, storage: dead }).claim({ line: 'burningDoors', step: 3, phase: 'open' });
  assert.equal(a.ok, false);
  assert.equal(dead.kv.has(SESSION_KEY), false, 'a session the service refuses is forgotten');
});
