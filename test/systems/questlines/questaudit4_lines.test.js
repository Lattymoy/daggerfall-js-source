// QUEST-AUDIT IV (bible/01-Overview/audits/Quest-Audit-IV.md), the questlines' lanes: each fix held by a pin that fails on
// the code before it - the Old Coil's sea, a deed's return clock, the answers' width, the couriers met first, a named
// piece offered, the Hour broken first, the Festival's walk, the Herald's ladder, Imrah's books, the Warden's act, an
// unstamped step, a title held back, and the Sky-Ketch said.
import '../../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { lineById, lineStepOf } from '../../../src/systems/questlines/qlLines.js';
import { NEED_CHECKS, createLineRunner } from '../../../src/systems/questlines/qlLineRunner.js';
import { rollRewardChoice } from '../../../src/systems/questlines/qlRewards.js';
import { sheetFor } from '../../../src/systems/questlines/qlSheets.js';
import { SKILLS } from '../../../src/systems/skills.js';
import { noteLadderDone, ladderDoneFor, _forgetLaddersForTests } from '../../../src/systems/arena/arenaClimbSeen.js';
import { FESTIVALS } from '../../../src/net/festivalLaw.js';
import { STAR_LIFE_MS } from '../../../src/net/starfall/starfallLaw.js';
import { createKetchClaims, KT_CLAIM_RETRY_MS } from '../../../src/net/ketch/ketchClaims.js';
import { mintKetchReceipt } from '../../../src/net/ketch/ketchReceipt.js';
import { hearActs } from '../../../src/systems/questlines/qlActs.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { QUESTLINES_PREF } from '../../../src/systems/questlines/qlLaw.js';
import { patchWidthProblems } from '../../../tools/qlCheck.mjs';
import { createArenaOnline } from '../../../src/scenes/arena/arenaOnline.js';
import { qlLineDetail } from '../../../src/ui/questlines/qlJournal.js';
import { fakePage } from '../../hudPage.mjs';
import { ROOT, packMachine, parsedQuest } from '../../qlSources.mjs';
import { stepRig } from '../../qlStepRig.mjs';

const QUESTS = join(ROOT, 'src/systems/questlines/quests');
const script = (q) => readFileSync(join(QUESTS, `${q}.txt`), 'utf8');
const DAY = 86400;
afterEach(() => { setPref(QUESTLINES_PREF, true); _forgetLaddersForTests(); });

test('QUEST-AUDIT IV B1: the Old Coil\'s berths and its Serpent wait on the sea - a step whose deed cannot be done never begins to fail (mutants: either need dropped; QLOC03\'s deed)', () => {
  const steps = lineById('oldCoil').steps;
  assert.deepEqual(steps.map((s) => s.needs ?? []), [[], ['naval'], ['naval']]);
  assert.equal(steps[2].deed, '_slain_', 'AUDIT QA4 C4: the Serpent slain, the walk to Hamid\'s tavern needs no sea');
});

test('QUEST-AUDIT IV B2, AUDIT QA4 C1, C2, C5, D9: a deed done late keeps its step - it ends at the later of the 60 days and the deed plus 30, on the sheet\'s own late end, in words that say the step comes again; a deed done early keeps the 60 (mutants: `_meet_` unstarted; `_gone_` on `_meet_` alone; the late outcome dropped; the return 7 or 31 days)', () => {
  const DEEDS = {
    QLOC03: (R) => R.act('serpent-slain', 1),
    QLHR02: (R) => R.act('hour-broken', 1),
    QLBD02: (R) => R.st.pack.add(R.quest.getItem({ name: 'ritebook' }).daggerfallUnityItem),
    QLCH02: (R) => R.st.pack.add(R.quest.getItem({ name: 'weirkey' }).daggerfallUnityItem),
  };
  for (const [q, deed] of Object.entries(DEEDS)) {
    const R = stepRig(q);
    let day = 0;
    const to = (d) => { R.advance((d - day) * DAY, 6); day = d; };
    R.tick(3);
    to(0.17);
    to(55);
    deed(R);
    R.tick(6);
    to(61);
    assert.equal(R.quest.questComplete, false, `${q}: day 61, the deed done on day 55 - still to bring home`);
    to(84.5);
    assert.equal(R.quest.questComplete, false, `${q}: the return\'s 30 days not out`);
    to(85.6);
    assert.equal(R.quest.questComplete, true, `${q}: the deed plus 30`);
    assert.match(R.st.popups.at(-1) ?? '', /may (?:send for you|write to you) again\./, `${q}: never final - the line offers the step again`);
    assert.equal(R.quest.ql.outcome, 'late', `${q}: the sheet\'s late end`);
    const E = stepRig(q);
    let eday = 0;
    const eto = (d) => { E.advance((d - eday) * DAY, 6); eday = d; };
    E.tick(3);
    eto(0.17);
    eto(2);
    deed(E);
    E.tick(6);
    eto(40);
    assert.equal(E.quest.questComplete, false, `${q}: done on day 2, day 40 is inside the 60`);
    eto(61);
    assert.equal(E.quest.questComplete, true, `${q}: the 60 days`);
  }
});

test('QUEST-AUDIT IV B3: every answer a line\'s script asks is one line of at most 30 characters - the classic pick list draws it unwrapped from x 86 (mutants: QLBD05\'s 1031 long again)', () => {
  const problems = [];
  for (const f of readdirSync(QUESTS).filter((n) => n.endsWith('.txt')).sort()) {
    problems.push(...patchWidthProblems(f.replace('.txt', ''), [{ old: '', new: readFileSync(join(QUESTS, f), 'utf8') }]).filter((p) => /answer/.test(p)));
  }
  assert.deepEqual(problems, []);
});

test('QUEST-AUDIT IV B4: a line\'s first courier is met for the first time - its letters are taken in hand since QL-OFFERED (mutants: QLBD02\'s "again"; QLWR03\'s "same boy")', () => {
  const courier = (q) => { const t = script(q); return t.slice(t.indexOf('Message:  1012'), t.indexOf('\n\n', t.indexOf('Message:  1012'))); };
  assert.doesNotMatch(courier('QLBD02'), /\bagain\b/);
  assert.doesNotMatch(courier('QLWR03'), /\bsame\b|\bagain\b/);
  assert.match(courier('QLBD02'), /A courier of the Mages Guild finds you/);
  assert.match(courier('QLWR03'), /A boy in an oversized Guild robe/);
});

test('QUEST-AUDIT IV B5: an ending that hands a named blade over offers it to any class that may wield it - the two best weapon skills choose the plain cards alone (mutants: drawNamed\'s skills the holder\'s)', () => {
  const skills = new Array(35).fill(20);
  skills[SKILLS.Archery] = 70;
  skills[SKILLS.HandToHand] = 60;
  const archer = { name: 'Hero', level: 20, career: { weaponArmorShieldsBitfield: 0, forbiddenMaterialsFlags: 0 }, skills };
  const named = sheetFor('QLWR04').outcomes.find((o) => o.id === 'mercy').named;
  let offered = 0;
  for (let seed = 1; seed <= 20; seed++) if (rollRewardChoice({ seed, level: 20, tier: 4, entity: archer, named }).some((p) => p.named && p.item.name === named.name)) offered++;
  assert.equal(offered, 20);
});

test('QUEST-AUDIT IV B6: the Hour broken before the Prior is met - his answer pays at once, and the journal never sends the player back down (mutants: `_met_` without its click kept; `_clearclick_` without `not _broken_`; `_road_` logging regardless)', () => {
  const R = stepRig('QLHR02');
  R.tick(3);
  R.advance(4 * 3600);
  R.act('hour-broken', 1);
  R.tick(4);
  R.click('_prior_');
  R.tick(4);
  assert.equal(R.st.asked.length, 1, 'asked which power');
  R.answer(0);
  R.tick(8);
  assert.ok(R.quest.questComplete && R.quest.questSuccess, 'paid on the answer - no second visit');
  assert.ok(!R.log().some(([, id]) => id === 1020), '"Now I must reach the Hour" never filed');
});

test('QUEST-AUDIT IV C1: the Thirteenth of Frostfall\'s walk to the coven needs no Festival once the star is held, and the last night\'s star counts while it lives past the close (mutants: the step\'s `deed`; the needs check without it; the star\'s tail)', () => {
  assert.equal(lineById('thirteenthFrostfall').steps[0].deed, '_held_');
  const close = FESTIVALS[0].toMs;
  assert.equal(NEED_CHECKS.starfall(close), false, 'the line itself opens on the Festival\'s days alone');
  const tasks = new Map([['held', { getTriggerValue: () => true }]]);
  const q = { uid: 7, questName: 'QLTF01', questComplete: false, questTombstoned: false, shelvedAt: null, tasks, getTask: (s) => tasks.get(s.name) ?? null };
  const at = (ms) => {
    const shelved = [];
    const machine = { quests: new Map([[7, q]]), questsToInvoke: [], scheduleQuestByName: () => null, shelveQuest: (uid) => { shelved.push(uid); return { ok: true }; }, reclaimQuest: () => ({ ok: true }) };
    const runner = createLineRunner({ machine, service: null, nowMs: () => ms, ctx: { level: () => 20, online: () => true, nowSeconds: () => 1e6 } });
    runner.restore({ thirteenthFrostfall: { step: 0, outcomes: {}, done: false, wait: 0, claims: {}, begun: 1, lettered: 1, taken: true } });
    runner.look();
    return shelved;
  };
  assert.deepEqual(at(close + DAY * 1000), [], 'held: the walk to the coven is never set aside');
  tasks.clear();
  assert.deepEqual(at(close + STAR_LIFE_MS / 2), [], 'not held yet, the last star still alive: not set aside under it');
  assert.deepEqual(at(close + 2 * STAR_LIFE_MS), [7], 'not held, the last star faded: set aside until the Festival comes again');
  // AUDIT QA4 D10: the tail keeps a RUNNING step alone - a step still to come waits for the Festival, and says so
  const service = { account: () => 'acct', guest: () => false, claim: async () => ({ ok: true, data: {} }) };
  const idle = createLineRunner({ machine: { quests: new Map(), questsToInvoke: [], scheduleQuestByName: () => null }, service, nowMs: () => close + STAR_LIFE_MS / 2, ctx: { level: () => 20, online: () => true, nowSeconds: () => 1e6 } });
  idle.restore({ thirteenthFrostfall: { step: 2, outcomes: { 0: { id: 'done' }, 1: { id: 'wound' } }, done: false, wait: 0, claims: {}, begun: 1, lettered: 1, taken: true } });
  assert.equal(idle.rows().find((r) => r.id === 'thirteenthFrostfall')?.opens, 'Opens during the Witches’ Festival.');
});

test('QUEST-AUDIT IV C2, AUDIT QA4 B1: the Herald\'s Call is a registered account\'s, and waits on a bout the Herald still offers - the climb\'s end kept by account, so another account never reads it and a page knows it before its board is asked (mutants: `account`; the ladder\'s need; the account unread; the device\'s memory unread)', () => {
  const l = lineById('introArena');
  assert.equal(l.opens.account, true);
  assert.deepEqual(l.steps.map((s) => s.needs), [['arenaLadder'], ['arenaLadder']]);
  const grand = { v: 1, tier: 9, won: 3, paid: 3, champs: [], grand: true, record: {} };
  assert.equal(NEED_CHECKS.arenaLadder(0, { account: 'acct-a' }), true, 'no climb heard: the ladder is open');
  noteLadderDone(grand, 'acct-a');
  assert.equal(NEED_CHECKS.arenaLadder(0, { account: 'acct-a' }), false, 'the Grand Champion beaten');
  assert.equal(NEED_CHECKS.arenaLadder(0, { account: 'acct-b' }), true, 'another account signed in reads its own');
  // a new page: the device remembers (appStorage - the page's localStorage)
  const kept = new Map();
  const was = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, String(v)) };
  try {
    noteLadderDone(grand, 'acct-c');
    _forgetLaddersForTests();
    assert.equal(ladderDoneFor('acct-c'), true, 'a page that never asked the board knows it');
    assert.equal(ladderDoneFor('acct-d'), false);
  } finally { globalThis.localStorage = was; }
  const src = readFileSync(join(ROOT, 'src/systems/questlines/qlLineRunner.js'), 'utf8');
  assert.match(src, /NEED_CHECKS\[n\]\?\.\(nowMs\(\), \{ account: service\?\.account\?\.\(\) \?\? null \}\)/, 'the runner asks for the signed-in account');
});

test('AUDIT QA4 D2: the Arena board heard tells the Herald\'s Call the account\'s climb is over - the arena\'s own client, its board read, the climb\'s answer heard too (mutants: the board\'s note dropped; the answer\'s; the account unread)', async () => {
  const grand = { v: 1, tier: 9, won: 3, paid: 3, champs: [], grand: true, record: {} };
  const hall = { status: 'open', join() {}, leave() {}, sendArena: () => true };
  const session = { status: 'open', arenaOk: true, room: 'world:1,1', sendArena: () => true };
  const A = createArenaOnline({ now: () => 0, session: () => session, makeHall: () => hall, bouts: { ask() {}, relayWord: () => true, exhibitionWord: () => true, dismiss() {}, holds: () => false, relay: () => null },
    account: { board: async () => ({ ok: true, data: { me: { ladder: grand } } }), claim: async () => ({ ok: true, data: {} }), attempt: async () => null, me: () => 'acct-board' },
    enterFloor: () => true, level: () => 12, names: () => () => ({}) });
  assert.equal(NEED_CHECKS.arenaLadder(0, { account: 'acct-board' }), true, 'before the board');
  A.model();
  await new Promise((done) => setTimeout(done, 0));
  assert.equal(NEED_CHECKS.arenaLadder(0, { account: 'acct-board' }), false, 'the board heard: no bout left');
  const src = readFileSync(join(ROOT, 'src/scenes/arena/arenaOnline.js'), 'utf8');
  assert.match(src, /board = \{ \.\.\.board, me: \{ \.\.\.board\.me, ladder: d\.ladder \} \}; noteLadderDone\(d\.ladder, deps\.account\.me\?\.\(\) \?\? null\); \}/, 'and the climb\'s answer');
});

test('QUEST-AUDIT IV C3: Imrah\'s two books are the player\'s to keep - each made permanent where it is handed over (mutants: either `make ... permanent`)', () => {
  assert.match(script('QLSK01'), /_book_ task:\n\tget item _guide_\n\n/, 'the guide is the step\'s while it runs (AUDIT QA4 C3: a retaken step never doubles it)');
  assert.match(script('QLSK01'), /_paid_ task:\n\twhen _clicked_ and _boarded_\n\tsay 1013\n\tmake _guide_ permanent\n/, 'and the player\'s once paid');
  assert.match(script('QLSK02'), /\tget item _thunder_\n\tmake _thunder_ permanent\n/);
});

test('QUEST-AUDIT IV C4, AUDIT QA4 B5: the Tonal Warden\'s act is the character\'s the receipt came to - a share answered while another stands is owed it and said when they stand again; an owed act lapses in a week; the client hands who stands (mutants: the act said to whoever stands; the receipt unmarked; the owed act never paid; kept for ever; the client\'s `who`)', async () => {
  const heard = [];
  hearActs('qa4', (kind) => heard.push(kind));
  try {
    const { subtle } = globalThis.crypto;
    const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const nowS = Math.floor(Date.now() / 1000);
    const acct = 'acct0123456789abcd';
    const r = await mintKetchReceipt({ d: 1, o: '0123456789abcdef', s: acct, c: 1, x: 'dealt', l: 30 }, kp.privateKey, { subtle, nowS });
    let who = 'ch-a', ms = 1e6;
    const store = new Map();
    let answer = null;
    const claims = createKetchClaims({ claim: async () => answer, store: { get: (k) => store.get(k), set: (k, v) => store.set(k, v) }, me: () => acct, who: () => who, nowMs: () => ms, nowS: () => nowS });
    answer = { ok: false, error: 'offline' };   // the first offer goes unanswered: the receipt is kept for ch-a
    const settle = async () => { for (let i = 0; i < 12; i++) await new Promise((done) => setImmediate(done)); };
    claims.add(r);
    await settle();
    assert.equal(claims.kept()[0]?.ch, 'ch-a', 'the receipt keeps the character it came to');
    who = 'ch-b';
    answer = { ok: true, data: { share: true, recorded: true, sailed: 1 } };
    await claims.flush();
    await settle();
    assert.deepEqual(heard, [], 'answered while ch-b stands: ch-b hears nothing of ch-a\'s Warden');
    assert.deepEqual(claims.owed().map((o) => o.ch), ['ch-a']);
    who = 'ch-a';
    ms += 2 * KT_CLAIM_RETRY_MS;
    claims.tick();
    assert.deepEqual(heard, ['warden-felled'], 'said once ch-a stands');
    assert.deepEqual(claims.owed(), []);
    store.set('kt.ketchActs', [{ ch: 'gone', at: ms - 8 * DAY * 1000 }, { ch: 'here-soon', at: ms }]);
    assert.deepEqual(claims.owed().map((o) => o.ch), ['here-soon'], 'a character that never stands again: let go after a week');
    assert.match(readFileSync(join(ROOT, 'src/scenes/ketch/ketchClient.js'), 'utf8'), /paid: \(c\) => paid\(c\), who,/, 'the client hands who stands');
  } finally { hearActs('qa4', null); }
});

test('QUEST-AUDIT IV D1: a line\'s step is stamped whatever the switch says when it starts - its acts heard and its end moving the line (mutants: stamp under the switch alone; the unstamped end ignored)', () => {
  const R = stepRig('QLIT01', { on: false });
  assert.ok(lineStepOf('QLIT01'));
  assert.ok(R.quest.ql, 'stamped at its start, the switch off');
  R.quest.ql = null;   // a save from before: its step kept unstamped
  R.tick(1);
  assert.ok(R.quest.ql, 'stamped at the next look');
  const ended = [];
  const runner = R.bridge.questlines.runner;
  const was = runner.ended;
  runner.ended = (q, o) => { ended.push([q.questName, o]); return was(q, o); };
  R.quest.ql = null;
  R.bridge.questlines.ending(R.quest);
  assert.deepEqual(ended, [['QLIT01', null]], 'an unstamped step\'s end still moves its line');
});

test('QUEST-AUDIT IV D2, D3, AUDIT QA4 B4, C7: a step the service pays by the line before (the Covens\' Hoard\'s) holds the title back until it pays, the page naming that line - and the page names the Sky-Ketch among the witnessed places, an Abyss Dungeon\'s Hour by its name (mutants: `waits`; the line before unnamed; the Ketch\'s words)', () => {
  const machine = { quests: new Map(), questsToInvoke: [], scheduleQuestByName: () => null };
  const runner = createLineRunner({ machine, service: null, nowMs: () => 0, ctx: { level: () => 20, online: () => true, nowSeconds: () => 1e6 } });
  runner.restore({ covensHoard: { step: 3, outcomes: { 2: { id: 'keep', text: 'kept' } }, done: true, wait: 0, claims: { 0: 'opened', 1: 'opened', 2: 'unseen' }, begun: 1, lettered: 1, taken: true } });
  const row = runner.rows().find((r) => r.id === 'covensHoard');
  assert.deepEqual(row.steps.map((s) => !!s.waits), [false, false, true]);
  assert.equal(row.after, lineById('burningDoors').title());
  const words = (box) => box.textContent ?? '';
  const page = words(qlLineDetail(fakePage(), row, { titleText: (k) => k }));
  assert.match(page, new RegExp(`The title covenbane waits until the account service has seen every deed of ${row.after}\\.`));
  runner.restore({ covensHoard: { step: 3, outcomes: { 2: { id: 'keep', text: 'kept' } }, done: true, wait: 0, claims: { 0: 'opened', 1: 'opened', 2: 'witnessed' }, begun: 1, lettered: 1, taken: true } });
  const paid = runner.rows().find((r) => r.id === 'covensHoard');
  assert.deepEqual(paid.steps.map((s) => !!s.waits), [false, false, false], 'paid: nothing waits');
  assert.match(words(qlLineDetail(fakePage(), paid, { titleText: (k) => k })), /This questline earns the title covenbane/);
  const witnessed = words(qlLineDetail(fakePage(), { ...lineById('burningDoors'), title: 'x', lead: 'x', giver: 'x', state: 'running', steps: [{ quest: 'QLBD03', title: 'x', state: 'next', witnessed: true }] }));
  assert.match(witnessed, /or an Abyss Dungeon.s Shattered Hour\. Others are the Sea Serpent, the Sky-Ketch and the fallen stars\./);
});

test('AUDIT QA4 B2: an act a step set aside out of season waits on takes the step back, so a star held as it faded and counted late is heard - never an act it does not wait on, never a step the player set aside (mutants: the wake unread by the act; any kind wakes it; the player\'s own aside woken)', () => {
  const q = parsedQuest('QLTF01', packMachine()).quest;
  q.shelvedAt = 1;
  const reclaimed = [];
  const machine = { quests: new Map([[q.uid, q]]), questsToInvoke: [], scheduleQuestByName: () => null, reclaimQuest: (uid) => { reclaimed.push(uid); q.shelvedAt = null; return { ok: true }; } };
  const runner = createLineRunner({ machine, service: null, nowMs: () => 0, ctx: { level: () => 20, online: () => true, nowSeconds: () => 1e6 } });
  const rec = (aside) => ({ thirteenthFrostfall: { step: 0, outcomes: {}, done: false, wait: 0, claims: {}, begun: 1, lettered: 1, taken: true, aside } });
  runner.restore(rec(false));
  assert.equal(runner.wakeAside(q, 'star-held'), false, 'the player\'s own aside stays theirs');
  runner.restore(rec(true));
  assert.equal(runner.wakeAside(q, 'fish-caught'), false, 'an act it does not wait on');
  assert.equal(runner.wakeAside(q, 'star-held'), true);
  assert.deepEqual(reclaimed, [q.uid]);
  assert.equal(runner.lineState('thirteenthFrostfall').aside, false);
  const src = readFileSync(join(ROOT, 'src/systems/questlines/qlLayer.js'), 'utf8');
  assert.match(src, /if \(quest\.shelvedAt != null && !runner\.wakeAside\(quest, kind\)\) continue;/);
});
