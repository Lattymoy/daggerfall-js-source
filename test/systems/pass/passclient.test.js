// STOREFRONT (2026-10-29; bible/06-Systems/Battle-Pass.md section 4): THE PASS AS THE PAGE PLAYS IT
// (systems/pass/passClient.js). A kill of mine asks a find by the foe's kind - the season's constructs their own source,
// the city watch and an ally none; an act of mine by its family, one find a turn's deeds, an elite's fall never twice;
// the asks one after another; a level reached and a challenge paid told once each, the day's experience spent told once a
// day; nothing asked unbound, off line, by a guest or outside the season. The pass's words (ui/passText.js) and its card
// (net/battlePassLaw.js passCardOf) beside it.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  bindPass, passState, passLive, askPassFind, passFoeSource, grantsAt, refreshPass, _resetPassClientForTests, PASS_CONSTRUCT_MOBILES,
} from '../../../src/systems/pass/passClient.js';
import { ASK_REST_MS } from '../../../src/net/askRest.js';
import { reportPlayerKill } from '../../../src/systems/playerKills.js';
import { noteAct } from '../../../src/systems/questlines/qlActs.js';
import { KNIGHT_CITY_WATCH } from '../../../src/characters/mobile/mobileTypes.js';
import { passSeasonById, passCardOf, PASS_CHALLENGES, PASS_DAY_XP } from '../../../src/net/battlePassLaw.js';
import { passChallengeText, passBoostText, passGrantName, passGrantKind, PASS_STAGE_TEXT } from '../../../src/ui/passText.js';

const S1 = passSeasonById('s1');
const IN = S1.fromMs + 2 * 86_400_000;
const tick = () => new Promise((r) => setTimeout(r, 0));
const settle = async () => { for (let i = 0; i < 6; i++) await tick(); };

/** The service stood in: a find's answer by its source, the account's season as it climbs. */
function service({ guest = false } = {}) {
  const asked = [];
  let xp = 960, level = 0;
  return {
    asked,
    api: {
      me: () => 'acct-1', guest: () => guest,
      mine: async () => ({ ok: true, data: { season: 's1', open: true, stage: 0, xp, level, top: 17, tracks: { free: true, premium: true }, mult: 1, today: 0, challenges: [] } }),
      find: async (source) => {
        asked.push(source);
        const gained = source === 'construct' ? 40 : 12;
        xp += gained; level = Math.floor(xp / 1000);
        return { ok: true, data: { gained, xp, level, today: source === 'endgame' ? PASS_DAY_XP : 100, done: source === 'tavern' ? ['tremor-tavern'] : [] } };
      },
    },
  };
}

test('STOREFRONT the pass\'s finds: a kill of mine by the foe\'s kind - a season\'s construct its own source, the watch and an ally none, one body once; a deed by its family, one find for a turn\'s acts; the asks one after another; a level reached told with its rewards, a challenge once, the day spent once (mutants: the watch paying; a construct read as a foe; a level told twice)', async () => {
  _resetPassClientForTests();
  const svc = service(), events = [];
  bindPass({ online: () => true, nowMs: () => IN, onEvent: (e) => events.push(e), api: svc.api });
  await settle();
  assert.equal(passState().level, 0, 'the season read when bound');
  assert.ok(passLive());
  const construct = { mobileType: PASS_CONSTRUCT_MOBILES[0] };
  reportPlayerKill(construct); reportPlayerKill(construct);
  reportPlayerKill({ mobileType: KNIGHT_CITY_WATCH });
  reportPlayerKill({ mobileType: 1, team: 'PlayerAlly' });
  reportPlayerKill({ mobileType: 1 });
  await settle();
  assert.deepEqual(svc.asked, ['construct', 'foe'], 'one body once; the watch and an ally never');
  assert.equal(passFoeSource({ passConstruct: true, mobileType: 1 }), 'construct', 'a body the season stood');
  assert.deepEqual(events.filter((e) => e.kind === 'level'), [{ kind: 'level', level: 1, grants: ['icon:centurion', 'icon:aetherium'] }], 'level one, its free and premium rewards');
  noteAct('cards-won'); noteAct('gambit-won');
  await settle();
  assert.deepEqual(svc.asked.slice(2), ['tavern'], 'one turn\'s acts of one family: one deed');
  assert.deepEqual(events.filter((e) => e.kind === 'challenge'), [{ kind: 'challenge', key: 'tremor-tavern' }]);
  noteAct('elite-foe-slain');
  await settle();
  assert.equal(svc.asked.length, 3, 'an elite\'s fall is its kill\'s find, never a second');
  noteAct('breach-closed'); await settle();
  noteAct('rite-broken'); await settle();
  assert.equal(events.filter((e) => e.kind === 'full').length, 1, 'the day spent, told once');
  assert.deepEqual(grantsAt({ season: 's1', tracks: { premium: false } }, 10), ['title:brassbound'], 'a free account\'s level ten');
  _resetPassClientForTests();
});

test('STOREFRONT the pass asks nothing unbound, off line, for a guest or outside the season (mutants: a guest asking; the season\'s clock ignored)', async () => {
  _resetPassClientForTests();
  assert.equal(await askPassFind('foe'), 0, 'unbound');
  for (const [doors, why] of [[{ online: () => false, nowMs: () => IN }, 'off line'], [{ online: () => true, nowMs: () => S1.fromMs - 1 }, 'before the season'], [{ online: () => true, nowMs: () => S1.toMs }, 'after it']]) {
    const svc = service();
    bindPass({ ...doors, api: svc.api });
    await settle();
    assert.equal(await askPassFind('foe'), 0, why);
    assert.deepEqual(svc.asked, [], why);
  }
  const g = service({ guest: true });
  bindPass({ online: () => true, nowMs: () => IN, api: g.api });
  assert.equal(await refreshPass(), false);
  assert.equal(await askPassFind('foe'), 0, 'a guest');
  assert.equal(await askPassFind('nope'), 0, 'a source the law does not know');
  _resetPassClientForTests();
});

test('STOREFRONT the pass\'s words and card: each challenge said with its count, a booster with its share and levels, a reward by its name and kind; the card checked on the way in (mutants: a challenge\'s count missing; a card with a stray level)', () => {
  for (const c of PASS_CHALLENGES) assert.ok(passChallengeText(c.key).includes(c.n.toLocaleString()), c.key);
  assert.equal(passChallengeText('nope'), '');
  // PIN MOVED (AUDIT PASS 12): and that the levels past the open stage wait for the next - a paid line says so
  assert.equal(passBoostText('boost:s1heart'), '100% more season experience from every deed, for the whole season. And 8 levels at once. Levels past the open stage are kept for the next.');
  assert.equal(passBoostText('boost:s1cog'), '25% more season experience from every deed, for the whole season.');
  assert.equal(passGrantName('kill:tonal'), 'Tonal Shatter');
  assert.equal(passGrantKind('portal:brass'), 'Portal skin');
  assert.deepEqual(Object.keys(PASS_STAGE_TEXT), S1.stages.map((s) => s.key));
  assert.equal(passCardOf({ season: 'nope' }), null);
  const c = passCardOf({ season: 's1', open: true, stage: 9, xp: -5, level: 70, top: 17, tracks: { deluxe: true }, mult: 9, today: 50, challenges: [{ key: 'tremor-foes', n: 9999, paid: true }, { key: 'x', n: 3 }] });
  assert.deepEqual([c.stage, c.xp, c.level, c.mult], [-1, 0, 0, 1], 'a stray stage, experience, level and share refused');
  assert.deepEqual(c.tracks, { free: true, premium: false, deluxe: true }, 'the tracks as the service says them - a Deluxe whose Premium went back plays without it (AUDIT-STOREFRONT S1; PIN MOVED: the card read the Deluxe as the Premium too)');
  assert.deepEqual(c.challenges[0], { key: 'tremor-foes', n: 100, paid: true }, 'a count no higher than the challenge asks');
  assert.equal(c.challenges.length, PASS_CHALLENGES.length);
});

test('STOREFRONT a find asked before the season is read: the season read first, so the level it reaches is told (mutant: the find before the read)', async () => {
  _resetPassClientForTests();
  const svc = service(), events = [];
  const slowMine = svc.api.mine;
  svc.api.mine = () => new Promise((r) => setTimeout(() => r(slowMine()), 15));
  bindPass({ online: () => true, nowMs: () => IN, onEvent: (e) => events.push(e), api: svc.api });
  reportPlayerKill({ mobileType: PASS_CONSTRUCT_MOBILES[0] });   // before the bind's read lands
  await new Promise((r) => setTimeout(r, 80));
  assert.deepEqual(events.filter((e) => e.kind === 'level').map((e) => e.level), [1]);
  _resetPassClientForTests();
});

// ── AUDIT PASS (bible/06-Systems/Battle-Pass.md section 8) ─────────────────────────────────────────────────────

test('AUDIT PASS 1: the Ketch\'s lift ridden and a cell banked ask no find - said again at will, with no receipt behind them; the Warden felled is its one endgame find (mutants: the lift a find; a cell a find)', async () => {
  _resetPassClientForTests();
  const svc = service();
  bindPass({ online: () => true, nowMs: () => IN, api: svc.api });
  await settle();
  for (let i = 0; i < 3; i++) { noteAct('ketch-boarded'); await settle(); noteAct('ketch-cell-banked'); await settle(); }
  assert.deepEqual(svc.asked, [], 'seven rides filled the day and paid an endgame challenge');
  noteAct('warden-felled'); await settle();
  assert.deepEqual(svc.asked, ['endgame']);
  _resetPassClientForTests();
});

test('AUDIT PASS 2: a page that read the pass shut reads it again once its rest is over, and plays it once the switch is on - never shut until a reload; one read for the rest, not one a deed (mutants: the shut read kept for the page; the read again skipped)', async () => {
  _resetPassClientForTests();
  let now = S1.fromMs - 60_000, on = false, reads = 0;
  const svc = service();
  const mine = svc.api.mine;
  svc.api.mine = async () => { reads++; const r = await mine(); return { ...r, data: { ...r.data, open: on, stage: now >= S1.fromMs ? 0 : -1 } }; };
  bindPass({ online: () => true, nowMs: () => now, api: svc.api });
  await settle();
  now = S1.fromMs + 1_000;   // the season opens on this page's clock; PASS_OPEN still off
  assert.equal(await askPassFind('foe'), 0, 'shut, as the read said');
  assert.equal(await askPassFind('foe'), 0);
  assert.equal(reads, 1, 'no read a deed while it rests');
  on = true;   // the deploy turns PASS_OPEN on
  now += ASK_REST_MS.long;
  const answered = svc.api.mine;
  svc.api.mine = async () => { reads++; return { ok: false, error: 'offline' }; };
  assert.equal(await askPassFind('foe'), 0, 'the read again unanswered');
  assert.equal(await askPassFind('foe'), 0);
  assert.equal(reads, 2, 'a minute before it is asked again, not a read a deed');
  svc.api.mine = answered;
  now += ASK_REST_MS.brief;
  assert.equal(await askPassFind('foe'), 12, 'read again, and played');
  assert.equal(reads, 3);
  assert.equal(await askPassFind('foe'), 12, 'and played on, no read');
  assert.deepEqual([reads, svc.asked], [3, ['foe', 'foe']]);
  _resetPassClientForTests();
});

test('AUDIT PASS 9: the season read when bound waits in the finds\' queue - answered late, it never puts the level back, so no level is said twice (mutant: the bind\'s read off the queue)', async () => {
  _resetPassClientForTests();
  const svc = service(), events = [];
  const mine = svc.api.mine;
  let n = 0, release = () => {};
  const slow = new Promise((r) => { release = r; });
  svc.api.mine = async () => { const r = await mine(); if (++n === 1) await slow; return r; };   // the bind's read, answered late
  bindPass({ online: () => true, nowMs: () => IN, onEvent: (e) => events.push(e), api: svc.api });
  const first = askPassFind('construct');   // 960 + 40: level one
  await settle();
  release();
  await first; await settle();
  assert.equal(passState().level, 1, 'the late read never lands over the find');
  await askPassFind('construct');
  assert.deepEqual(events.filter((e) => e.kind === 'level').map((e) => e.level), [1]);
  _resetPassClientForTests();
});

test('AUDIT PASS 9: a find whose bind read went unanswered reads the season first, so the level it reaches is told (mutant: the find before the read)', async () => {
  _resetPassClientForTests();
  const svc = service(), events = [];
  const mine = svc.api.mine;
  let n = 0;
  svc.api.mine = async () => (++n === 1 ? { ok: false, error: 'offline' } : mine());
  bindPass({ online: () => true, nowMs: () => IN, onEvent: (e) => events.push(e), api: svc.api });
  await settle();
  assert.equal(passState(), null, 'the bind\'s read lost');
  await askPassFind('construct');
  assert.deepEqual(events.filter((e) => e.kind === 'level').map((e) => e.level), [1]);
  _resetPassClientForTests();
});

test('AUDIT PASS 11: a refusal stands the page back - the day\'s asks spent until the next UTC day, a closed find a minute and the season read again, a rate a minute, a seat refused ten minutes; the deeds between ask nothing (mutants: no rest after `capped`; the day\'s end missed; a closed find never read again; a seat refusal asked every deed)', async () => {
  _resetPassClientForTests();
  let now = IN + 3_600_000, refuse = null, reads = 0;
  const svc = service();
  const find = svc.api.find, mine = svc.api.mine;
  svc.api.find = async (source) => (refuse ? (svc.asked.push(source), { ok: false, error: refuse, status: 429 }) : find(source));
  svc.api.mine = async () => { reads++; return mine(); };
  bindPass({ online: () => true, nowMs: () => now, api: svc.api });
  await settle();
  const asks = () => svc.asked.length;
  refuse = 'capped';
  await Promise.all([askPassFind('foe'), askPassFind('foe'), askPassFind('foe')]);
  assert.equal(asks(), 1, 'the asks queued behind the refusal ask nothing');
  now += 3_600_000; await askPassFind('foe');
  assert.equal(asks(), 1, 'the day\'s asks spent: nothing more today');
  refuse = null;
  now = (Math.floor(now / 86_400_000) + 1) * 86_400_000 - 1;
  await askPassFind('foe');
  assert.equal(asks(), 1, 'not a moment before the day turns');
  now += 1;
  await askPassFind('foe');
  assert.equal(asks(), 2, 'the next UTC day asks again');
  refuse = 'closed';
  await askPassFind('foe'); await askPassFind('foe');
  assert.equal(asks(), 3, 'closed: a minute\'s rest');
  refuse = null;
  const was = reads;
  now += ASK_REST_MS.brief;
  await askPassFind('foe');
  assert.deepEqual([asks(), reads - was], [4, 1], 'then the season read again, and asked');
  for (const [error, ms] of [['rate', ASK_REST_MS.brief], ['progress-play', ASK_REST_MS.brief], ['progress-seat', ASK_REST_MS.long], ['trade-held', ASK_REST_MS.long]]) {
    refuse = error;
    const at = asks();
    await askPassFind('foe'); await askPassFind('foe');
    now += ms - 1; await askPassFind('foe');
    assert.equal(asks(), at + 1, `${error}: one ask, then rest`);
    refuse = null;
    now += 1; await askPassFind('foe');
    assert.equal(asks(), at + 2, `${error}: asked again after ${ms} ms`);
  }
  _resetPassClientForTests();
});
