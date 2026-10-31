// AUDIT PASS (2026-10-29; bible/06-Systems/Battle-Pass.md section 8): THE BATTLE PASS'S SERVICE, READ COLD. The season's
// `open` the switch's word alone (2); a find a progression claim - asked of the account's seated realm character, on a
// stream of its own (3), a line staff wrote before that stream was added still standing; and a find's answer told by the
// page - PASS-PANELS: a challenge completed with its Aurum, the day's bound once (8). Driven through the real Worker
// on node:sqlite (test/accountDb.mjs), and the page's own client (systems/pass/passClient.js) on the service's answers.
// The Witches' Festival's twins of 2 and 3 beside them: its `open` the switch's alone, its find a claim of its own stream.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService } from '../accountDb.mjs';
import { passOf, findPass } from '../../server-account/src/battlePass.js';
import { festivalOf } from '../../server-account/src/festival.js';
import { FESTIVALS } from '../../src/net/festivalLaw.js';
import { PROGRESS_LINE, PROGRESS_ROUTES, progressConfig, progressConfigOf, progressSpentOf, forgetProgressConfig } from '../../server-account/src/progress.js';
import { passSeasonById } from '../../src/net/battlePassLaw.js';
import { bindPass, askPassFind, refreshPass, passState, _resetPassClientForTests } from '../../src/systems/pass/passClient.js';

const ON = { PASS_OPEN: 'on', FESTIVAL_OPEN: 'on', DEVELOPER_HANDLES: 'mac' };
const S1 = passSeasonById('s1');
const IN_TREMOR = S1.fromMs + 3 * 86_400_000 + 3_600_000;
const BEFORE = S1.fromMs - 5 * 86_400_000;

async function stand() {
  const s = await standService(ON);
  const raw = s.env.DB._raw;
  const player = (who) => raw.prepare('SELECT * FROM players WHERE id = ?').get(who.id);
  const ctx = () => ({ db: s.env.DB, nowS: Math.floor(Date.now() / 1000) });
  return { ...s, raw, player, ctx };
}

test('AUDIT PASS 2: the season\'s `open` is the switch\'s word for the account alone - on before the opening, so a page that read it then plays from the opening; off, and dev for all but a developer, shut (mutant: `open` the season\'s days again)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: BEFORE });
  const s = await stand();
  const me = await s.registered('Early');
  const mac = await s.registered('mac');
  const before = await passOf(s.ctx(), s.player(me), ON);
  assert.deepEqual([before.season, before.stage, before.open], ['s1', -1, true], 'the season to come, its days the page\'s to read');
  assert.equal((await passOf(s.ctx(), s.player(me), { ...ON, PASS_OPEN: 'off' })).open, false);
  assert.equal((await passOf(s.ctx(), s.player(me), { ...ON, PASS_OPEN: 'dev' })).open, false);
  assert.equal((await passOf(s.ctx(), s.player(mac), { ...ON, PASS_OPEN: 'dev' })).open, true);
  assert.deepEqual(await findPass(s.ctx(), s.player(me), { source: 'foe' }, ON), { error: 'closed' }, 'a find still waits for the days');
});

test('AUDIT PASS 3: a pass find is a progression claim - a registered account with no seated realm character refused before the route reads a word; the seated one found, one ask spent on the pass\'s own stream, never its Aurum as a profession\'s; an enforced line asks the pass\'s own bucket (mutants: the route no claim; its answer spent as profession XP; the route spends nothing; the silver finds\' stream)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: IN_TREMOR });
  const s = await stand();
  assert.deepEqual(PROGRESS_ROUTES['/v1/pass/find'], ['pass', false], 'names no character: the account\'s seat is asked, as the page names none');
  const bare = await s.registered('Scripted');
  const no = await s.call('/v1/pass/find', { source: 'foe' }, bare.secret);
  assert.deepEqual([no.status, no.body?.error], [403, 'progress-seat'], 'a session\'s secret alone, no game played');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM aurum_ledger WHERE account = ?').get(bare.id).n, 0, 'nothing found');
  const me = await s.seated('Seated');
  const yes = await s.call('/v1/pass/find', { source: 'foe' }, me.secret);
  assert.deepEqual([yes.status, yes.body?.gained], [200, 1]);
  const hours = s.raw.prepare('SELECT stream, amount, claims FROM progress_hours WHERE player = ?').all(me.id).map((r) => ({ ...r }));
  assert.deepEqual(hours, [{ stream: 'pass', amount: 1, claims: 1 }]);
  assert.deepEqual(progressSpentOf('/v1/pass/find', { gained: 60, found: 20, today: 20, done: ['tremor-endgame'] }), [['pass', 1]], 'an ask, whatever Aurum it found');
  assert.deepEqual(progressSpentOf('/v1/pass/find', { error: 'capped' }), [], 'a refusal spends nothing');
  // enforced, the pass's own bucket answers - never the silver finds' twenty a day
  const enforce = (streams) => {
    s.raw.prepare("INSERT OR REPLACE INTO realm_config (key, value, at, by) VALUES ('progress', ?, 0, 'mac')").run(JSON.stringify({ enforce: true, streams: { ...PROGRESS_LINE.streams, ...streams } }));
    forgetProgressConfig(s.env.DB);
  };
  enforce({ find: { rate: 0, cap: 0 } });
  assert.equal((await s.call('/v1/pass/find', { source: 'foe' }, me.secret)).status, 200, 'the silver finds\' bucket empty: a pass find stands');
  enforce({ pass: { rate: 0, cap: 0 } });
  const fresh = await s.seated('Fresh');   // a bucket never moved starts at its cap: none
  const dry = await s.call('/v1/pass/find', { source: 'foe' }, fresh.secret);
  assert.deepEqual([dry.status, dry.body?.error], [429, 'progress-play'], 'its own bucket empty: refused until play refills it');
});

test('AUDIT PASS 3: a line staff wrote before the pass\'s stream was added still stands, that stream read at its first line; a write still names every stream (mutant: the stored line read as written, so dropped whole)', async () => {
  const s = await stand();
  const { pass, ...older } = PROGRESS_LINE.streams;
  assert.ok(pass);
  const line = { enforce: true, streams: { ...older, renown: { rate: 3_600, cap: 1_000 } } };
  s.raw.prepare("INSERT INTO realm_config (key, value, at, by) VALUES ('progress', ?, 0, 'mac')").run(JSON.stringify(line));
  forgetProgressConfig(s.env.DB);
  const c = await progressConfig(s.env.DB);
  assert.equal(c.enforce, true, 'staff\'s enforced line, never the first line unsaid');
  assert.deepEqual(c.streams.renown, { rate: 3_600, cap: 1_000 });
  assert.deepEqual(c.streams.pass, PROGRESS_LINE.streams.pass);
  assert.equal(progressConfigOf(line), null, 'a write names every stream');
});

test('AUDIT PASS 8 (PIN MOVED, PASS-PANELS): the page tells what the service answers - a challenge completed with its Aurum, the day\'s bound once a day however many finds meet it, nothing for a find past it (mutants: a challenge told with no Aurum; the bound told at every find past it)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: IN_TREMOR });
  const s = await stand();
  const me = await s.registered('Climber');
  const events = [];
  const answer = (r) => ('error' in r ? { ok: false, error: r.error } : { ok: true, data: r });
  _resetPassClientForTests();
  try {
    bindPass({
      online: () => true, nowMs: () => Date.now(), onEvent: (e) => events.push(e),
      api: {
        me: () => me.id, guest: () => false,
        mine: async () => answer(await passOf(s.ctx(), s.player(me), ON)),
        find: async (source) => answer(await findPass(s.ctx(), s.player(me), { source }, ON)),
      },
    });
    await refreshPass();
    assert.deepEqual([passState().today, passState().tracks.premium], [0, false]);
    for (let i = 0; i < 3; i++) await askPassFind('tavern');
    assert.deepEqual(events, [{ kind: 'challenge', key: 'tremor-tavern', aurum: 60 }]);
    assert.equal(passState().today, 9, 'the day\'s Aurum kept on the page');
    events.length = 0;
    for (let i = 0; i < 6; i++) await askPassFind('endgame');
    assert.deepEqual(events, [{ kind: 'challenge', key: 'tremor-endgame', aurum: 100 }, { kind: 'full' }], 'the bound told once');
    assert.equal(await askPassFind('foe'), 0, 'past the bound: nothing');
    assert.equal(events.length, 2);
  } finally { _resetPassClientForTests(); }
});

test('AUDIT PASS 2, THE FESTIVAL\'S TWIN: the festival\'s `open` is the switch\'s word for the account alone - on before its days, so a page that read it then plays from the first; off, and dev for all but a developer, shut (mutant: `open` the festival\'s days again)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: FESTIVALS[0].fromMs - 86_400_000 });
  const s = await stand();
  const me = await s.registered('Early');
  const mac = await s.registered('mac');
  assert.equal((await festivalOf(s.ctx(), s.player(me), ON)).open, true, 'its days are the page\'s to read');
  assert.equal((await festivalOf(s.ctx(), s.player(me), { ...ON, FESTIVAL_OPEN: 'off' })).open, false);
  assert.equal((await festivalOf(s.ctx(), s.player(me), { ...ON, FESTIVAL_OPEN: 'dev' })).open, false);
  assert.equal((await festivalOf(s.ctx(), s.player(mac), { ...ON, FESTIVAL_OPEN: 'dev' })).open, true);
  const early = await s.call('/v1/festival/find', { source: 'foe' }, (await s.seated('Seated')).secret);
  assert.deepEqual([early.status, early.body?.error], [409, 'closed'], 'a find still waits for the days');
});

test('AUDIT PASS 3, THE FESTIVAL\'S TWIN: a Soul Cake find is a progression claim - a registered account with no seated realm character refused; the seated one answered, one ask spent on the festival\'s own stream; enforced, its own bucket asked - never the pass\'s nor the silver finds\' (mutants: the route no claim; the route spends nothing; the pass\'s stream)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: FESTIVALS[0].fromMs + 3_600_000 });
  const s = await stand();
  assert.deepEqual(PROGRESS_ROUTES['/v1/festival/find'], ['festival', false], 'names no character, as the page names none');
  const bare = await s.registered('Scripted');
  const no = await s.call('/v1/festival/find', { source: 'foe' }, bare.secret);
  assert.deepEqual([no.status, no.body?.error], [403, 'progress-seat'], 'a session\'s secret alone, no game played');
  const me = await s.seated('Seated');
  const yes = await s.call('/v1/festival/find', { source: 'foe' }, me.secret);
  assert.equal(yes.status, 200);
  const hours = s.raw.prepare('SELECT stream, amount, claims FROM progress_hours WHERE player = ?').all(me.id).map((r) => ({ ...r }));
  assert.deepEqual(hours, [{ stream: 'festival', amount: 1, claims: 1 }]);
  assert.deepEqual(progressSpentOf('/v1/festival/find', { found: 0, cakes: 3, today: 3 }), [['festival', 1]], 'an ask answered, a miss too');
  const enforce = (streams) => {
    s.raw.prepare("INSERT OR REPLACE INTO realm_config (key, value, at, by) VALUES ('progress', ?, 0, 'mac')").run(JSON.stringify({ enforce: true, streams: { ...PROGRESS_LINE.streams, ...streams } }));
    forgetProgressConfig(s.env.DB);
  };
  enforce({ find: { rate: 0, cap: 0 }, pass: { rate: 0, cap: 0 } });
  assert.equal((await s.call('/v1/festival/find', { source: 'foe' }, me.secret)).status, 200, 'the other streams empty: a Soul Cake find stands');
  enforce({ festival: { rate: 0, cap: 0 } });
  const fresh = await s.seated('Fresh');
  const dry = await s.call('/v1/festival/find', { source: 'foe' }, fresh.secret);
  assert.deepEqual([dry.status, dry.body?.error], [429, 'progress-play'], 'its own bucket empty: refused until play refills it');
});
