// AUDIT-STOREFRONT II, lanes B and D (2026-10-29; bible/06-Systems/Battle-Pass.md section 9): THE PASS'S FINDS AND THE
// MAUL'S CLAIM, READ COLD A SECOND TIME - through the real Worker on node:sqlite (test/accountDb.mjs) and the page's own
// doors (net/accountClient.js, systems/pass/passClient.js). A find carries its own id: the page asks it again with that id
// while no answer comes back, and the service answers an id it found by as it did, counted once (B2). The Maul's claim
// answers a kept id with its own day, whatever the day or stage now, so a page gone before its save asks again (D2). The
// 'make' challenge says what it counts (B4). tools/mutants/storefront_audit2_season.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, sessionStorageOf } from '../accountDb.mjs';
import { findPass, PASS_ASK_KEEP_DAYS, BATTLE_PASS_STATUS } from '../../server-account/src/battlePass.js';
import { progressSpentOf } from '../../server-account/src/progress.js';
import { HOUR_JOBS } from '../../server-account/src/cron.js';
import { accountBattlePass, accountSeasonMaul, SESSION_KEY } from '../../src/net/accountClient.js';
import { passSeasonById, passChallengeOf } from '../../src/net/battlePassLaw.js';
import { ACT_KINDS } from '../../src/systems/questlines/qlActs.js';
import { passChallengeText } from '../../src/ui/passText.js';
import { bindPass, askPassFind, passState, _resetPassClientForTests, PASS_FIND_RETRY_MS, PASS_FIND_RETRY_MAX_MS } from '../../src/systems/pass/passClient.js';

const ON = { PASS_OPEN: 'on', DEVELOPER_HANDLES: 'mac' };
const S1 = passSeasonById('s1');
const IN_TREMOR = S1.fromMs + 3 * 86_400_000 + 3_600_000;
const IN_HEART = S1.stages[2].fromMs + 3_600_000;
const DAY_MS = 86_400_000;
const rid = (n) => n.toString(16).padStart(16, '0');

async function stand() {
  const s = await standService(ON);
  const raw = s.env.DB._raw;
  const player = (who) => raw.prepare('SELECT * FROM players WHERE id = ?').get(who.id);
  const ctx = () => ({ db: s.env.DB, nowS: Math.floor(Date.now() / 1000) });
  return { ...s, raw, player, ctx };
}

test('AUDIT-STOREFRONT II (lane B 2): a find asked again by its own id is answered as it was - counted once, its ask on the progression stream spent once; a twin racing it rolls back whole; an id that is not one refused; the ids let go past their keeping (mutants: the kept id unread; the id written outside the find\'s batch; the twin\'s refusal thrown; the sweep\'s cutoff; never swept)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: IN_TREMOR });
  const s = await stand();
  const me = await s.seated('Finder');
  const first = await s.call('/v1/pass/find', { source: 'foe', rid: rid(1) }, me.secret);
  assert.deepEqual([first.status, first.body.gained, first.body.repeat], [200, 1, undefined]);
  const again = await s.call('/v1/pass/find', { source: 'foe', rid: rid(1) }, me.secret);   // its answer lost: asked again
  assert.deepEqual(again.body, { ...first.body, repeat: true }, 'answered as it was');
  const found = () => s.raw.prepare("SELECT COALESCE(SUM(amount), 0) AS n FROM aurum_ledger WHERE account = ? AND kind = 'find'").get(me.id).n;
  assert.equal(found(), 1, 'counted once');
  assert.deepEqual({ ...s.raw.prepare('SELECT asks, aurum FROM pass_days WHERE account = ?').get(me.id) }, { asks: 1, aurum: 1 }, 'one of the day\'s asks');
  assert.deepEqual(s.raw.prepare("SELECT amount FROM progress_hours WHERE player = ? AND stream = 'pass'").all(me.id).map((r) => r.amount), [1], 'the stream spent once');
  assert.deepEqual(progressSpentOf('/v1/pass/find', again.body), [], 'a repeat spends nothing');
  assert.equal((await s.call('/v1/pass/find', { source: 'foe', rid: rid(2) }, me.secret)).body.gained, 1, 'a new id is a new find');
  assert.deepEqual((await s.call('/v1/pass/find', { source: 'foe', rid: 'nope' }, me.secret)).body, { error: 'rid' });
  assert.equal(BATTLE_PASS_STATUS.rid, 400);
  // two of one find out together (the page's retry overtaking the first): one counted, both answered
  const [a, b] = await Promise.all([findPass(s.ctx(), s.player(me), { source: 'elite', rid: rid(3) }, ON), findPass(s.ctx(), s.player(me), { source: 'elite', rid: rid(3) }, ON)]);
  assert.equal(found(), 1 + 1 + 4, 'the twin counted nothing');
  assert.deepEqual([a.gained, b.repeat], [4, true]);
  // kept PASS_ASK_KEEP_DAYS past its day, then gone with the account's first find of a later day - no hourly job
  const day = Math.floor(IN_TREMOR / DAY_MS), ids = () => s.raw.prepare('SELECT rid FROM pass_asks WHERE account = ? ORDER BY rid').all(me.id).map((r) => r.rid);
  t.mock.timers.setTime((day + PASS_ASK_KEEP_DAYS) * DAY_MS + 60_000);
  await s.call('/v1/pass/find', { source: 'foe', rid: rid(4) }, me.secret);
  assert.deepEqual(ids(), [rid(1), rid(2), rid(3), rid(4)], 'kept their days');
  assert.equal((await s.call('/v1/pass/find', { source: 'foe', rid: rid(1) }, me.secret)).body.repeat, true, 'and answered as they were');
  t.mock.timers.setTime((day + PASS_ASK_KEEP_DAYS + 1) * DAY_MS + 60_000);
  await s.call('/v1/pass/find', { source: 'foe', rid: rid(5) }, me.secret);
  assert.deepEqual(ids(), [rid(4), rid(5)], 'the day\'s first find: the older ids gone');
  assert.ok(!HOUR_JOBS.some(([n]) => /pass/.test(n)), 'no hourly job takes a share of the others\' statements');
});

test('AUDIT-STOREFRONT II (lane B 2): the page asks a find with its own id through the one door, and asks it again with the same id while the service cannot be reached - the deeds behind it wait their turn, a refusal is never asked again, a page gone off line lets it go (mutants: the door drops the id; a new id each time; never asked again; the wait unbounded)', async () => {
  _resetPassClientForTests();
  const sent = [], waits = [];
  let down = 2, online = true;
  const door = accountBattlePass({ fetch: async (u, i) => {
    const body = JSON.parse(i.body);
    if (String(u).endsWith('/v1/pass/mine')) return new Response(JSON.stringify({ season: 's1', open: true, stage: 0, tracks: { free: true, premium: false }, bought: [], today: 0, dayMax: 100, challenges: [] }), { status: 200 });
    sent.push([body.source, body.rid]);
    if (down > 0) { down--; return new Response(JSON.stringify({ error: 'server' }), { status: 503 }); }
    if (body.source === 'loot') return new Response(JSON.stringify({ error: 'capped' }), { status: 429 });
    return new Response(JSON.stringify({ gained: 2, found: 2, today: 2 * sent.length, done: [], season: 's1' }), { status: 200 });
  }, storage: sessionStorageOf(SESSION_KEY, { id: 'acct-1', secret: 's', kind: 'registered' }) });
  try {
    bindPass({ online: () => online, nowMs: () => IN_TREMOR, api: { ...door, me: () => 'acct-1', guest: () => false }, wait: async (ms) => { waits.push(ms); } });
    const one = askPassFind('foe'), two = askPassFind('construct');
    assert.equal(await one, 2, 'found at the third ask');
    assert.equal(await two, 2);
    assert.deepEqual(sent.map(([src]) => src), ['foe', 'foe', 'foe', 'construct'], 'the deed behind it waited its turn');
    assert.match(sent[0][1], /^[0-9a-f]{16}$/);
    assert.deepEqual(new Set(sent.slice(0, 3).map(([, r]) => r)).size, 1, 'asked again with its own id');
    assert.notEqual(sent[3][1], sent[0][1], 'each find its own');
    assert.deepEqual(waits, [PASS_FIND_RETRY_MS, 2 * PASS_FIND_RETRY_MS]);
    assert.equal(await askPassFind('loot'), 0);
    assert.equal(sent.length, 5, 'a refusal is never asked again');
    // off line while it waits: let go
    down = Infinity;
    bindPass({ online: () => online, nowMs: () => IN_TREMOR + 3_600_000, api: { ...door, me: () => 'acct-1', guest: () => false }, wait: async (ms) => { waits.push(ms); if (waits.length > 12) online = false; } });
    const at = sent.length;
    assert.equal(await askPassFind('foe'), 0);
    assert.ok(waits.slice(-3).every((ms) => ms === PASS_FIND_RETRY_MAX_MS), 'the wait doubles to its most');
    assert.ok(sent.length - at > 3 && passState() !== null);
  } finally { _resetPassClientForTests(); }
});

test('AUDIT-STOREFRONT II (lane D 2): the Maul\'s claim answers a kept id with its own day - the next UTC day, past the Heart stage, past the season - while a new id is refused as ever (mutants: the kept id read on its own day alone; the kept id unread)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: IN_HEART });
  const s = await standService();
  const me = await s.seated('Hammer');
  const io = { fetch: (u, i) => s.fetch(String(u).replace(/^.*?\/v1\//, 'https://accounts.invalid/v1/'), i), storage: sessionStorageOf(SESSION_KEY, me) };
  const door = accountSeasonMaul(io);
  const day = Math.floor(IN_HEART / DAY_MS);
  assert.deepEqual((await door.claim(rid(1))).data, { ok: true, day });
  t.mock.timers.setTime(IN_HEART + DAY_MS);
  assert.deepEqual((await door.claim(rid(1))).data, { ok: true, day }, 'after midnight: its own day, not a new one taken');
  assert.deepEqual((await door.claim(rid(2))).data, { ok: true, day: day + 1 }, 'the new day\'s own Maul');
  t.mock.timers.setTime(S1.toMs + DAY_MS);
  assert.deepEqual((await door.claim(rid(1))).data, { ok: true, day }, 'the season over: a kept id answered still');
  assert.equal((await door.claim(rid(3))).error, 'closed', 'a new one refused');
  assert.equal(s.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM season_mauls WHERE account = ?').get(me.id).n, 2, 'two days, two rows');
});

test('AUDIT-STOREFRONT II (lane B 4): the \'make\' challenge says what it counts - a piece made, a gem socketed, a piece reforged - and never a find (mutant: the old words)', () => {
  const c = passChallengeOf('halls-make');
  assert.deepEqual(c.sources, ['make', 'loot']);
  const said = Object.entries(ACT_KINDS).filter(([, fam]) => c.sources.includes(fam)).map(([kind]) => kind);
  assert.deepEqual(said, ['piece-crafted', 'gem-socketed', 'piece-reforged'], 'the acts its sources are');
  assert.equal(passChallengeText('halls-make'), 'Make, socket or reforge 30 items');
  assert.doesNotMatch(passChallengeText('halls-make'), /find/i);
});
