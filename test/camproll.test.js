// CAMP-ROLL (2026-10-04, the player: "In a party, or with other players. Every player spawns their own enemies when
// resting"; then "Do it"): ONE ROLL A CAMP. Online, members resting with the party within its 15 m who each press
// Rest elect one roller - the lowest account id among the acts open on a night, read off the pose (`restStartedAt`'s
// camp marks, `rs`) - and only that night rolls its ambush; the others wait ("Resting with Ada..."), then sleep the
// roller's night as theirs with no roll of their own, or break with the roller's ambush, or roll their own once the
// roller leaves or CAMP_WAIT_MS runs out. bible/06-Systems/Rest-Arc.md 2.6 and As built.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCampWatch, campClear, campPasses, CAMP_WAIT_MS, CAMP_OPEN_FRESH_MS } from '../src/systems/partyRestLaw.js';
import {
  CAMP_MARKS, PARTY_NIGHT_MARKS, campStamp, campMarkOf, nightStamp, nightKindOf, isNightStamp, campNightStep, carriedNightEnd,
  REST_ACT_TEXT, REST_CHANNEL_SECONDS,
} from '../src/systems/restAct.js';
import { REST_TEXT } from '../src/systems/restSession.js';
import { intermittentEnemySpawn } from '../src/systems/encounters.js';
import { createRestDeps } from '../src/scenes/shared.js';
import { setSharedClock, setOwnMinutes, advanceOwnMinutes, ownMinutes } from '../src/systems/worldTick.js';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import { SURVIVAL_STORED } from '../src/systems/survival/difficulty.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
afterEach(() => { setSharedClock(null); _resetForTests(); });

const NOW = 7_000_000_000;
const watch = (over = {}) => createCampWatch({ kindOf: nightKindOf, campOf: campMarkOf, ...over });
/** A party row as net/social.js others() hands it, its pose's three rest fields. */
const mate = (acct, { at = null, rs = 0, enemy = null, nr = 0 } = {}) => ({ acct, name: acct.toUpperCase(), p: { restStartedAt: at, rs, restEnemyAt: enemy, ...(nr ? { nr } : {}) } });
const everyone = () => true;

test('CAMP-ROLL the marks: open and done ride the night\'s field and law, distinct from every night\'s mark and never read as a night', () => {
  assert.deepEqual(CAMP_MARKS, { open: 774, done: 773 });
  for (const m of Object.values(CAMP_MARKS)) assert.ok(!Object.values(PARTY_NIGHT_MARKS).includes(m), `${m} is no night's mark`);
  for (const which of ['open', 'done']) {
    const t = campStamp(NOW + 123, which);
    assert.equal(campMarkOf(t), which);
    assert.equal(Math.floor(t / 1000), Math.floor((NOW + 123) / 1000), 'the shared clock\'s second');
    assert.equal(nightKindOf(t), null, 'no night: the party\'s night watch never carries on it');
    assert.equal(isNightStamp(t), false);
  }
  assert.equal(campMarkOf(nightStamp(NOW, 'camp')), null, 'a night is no camp mark');
  assert.equal(campMarkOf(NaN), null);
  assert.equal(campMarkOf(NOW + 1), null);
});

test('CAMP-ROLL the election: the lowest account among the camp\'s acts open on a night rolls - a lower mate resting, open, fresh and here is waited on; a higher one, one resting alone, one out of the camp, one not resting, a stale or a done mark is not', () => {
  const open = campStamp(NOW - 3_000, 'open');
  const ask = (rows, inCamp = everyone, me = 'm') => { const w = watch(); w.open(rows, NOW - 4_000); return w.verdict({ me, members: rows, inCamp, now: NOW }); };
  assert.deepEqual(ask([mate('a', { at: open, rs: 1 })]), { act: 'wait', acct: 'a', name: 'A' });
  assert.deepEqual(ask([mate('z', { at: open, rs: 1 })]), { act: 'roll' }, 'a higher id waits on me');
  assert.deepEqual(ask([mate('a', { at: open, rs: 1, nr: 1 })]), { act: 'roll' }, 'resting alone: a camp of their own');
  assert.deepEqual(ask([mate('a', { at: open, rs: 1 })], () => false), { act: 'roll' }, 'out of the camp');
  assert.deepEqual(ask([mate('a', { at: open, rs: 0 })]), { act: 'roll' }, 'not resting');
  assert.deepEqual(ask([mate('a', { at: campStamp(NOW - CAMP_OPEN_FRESH_MS - 1_000, 'open'), rs: 1 })]), { act: 'roll' }, 'a stale open mark');
  assert.deepEqual(ask([mate('a', { at: campStamp(NOW - 3_000, 'done'), rs: 1 })]), { act: 'roll' }, 'done: the roller left');
  assert.deepEqual(ask([mate('a', { at: nightStamp(NOW - 60_000, 'camp'), rs: 1 })]), { act: 'roll' }, 'an old night is no open act');
  assert.deepEqual(ask([mate('c', { at: open, rs: 1 }), mate('a', { at: open, rs: 1 }), mate('b', { at: open, rs: 1 })]), { act: 'wait', acct: 'a', name: 'A' }, 'the lowest, whatever the seat order');
  const w = watch();
  assert.equal(w.verdict({ me: 'm', members: [], inCamp: everyone, now: NOW }), null, 'no watch open: no camp');
  assert.equal(w.isOpen(), false);
});

test('CAMP-ROLL the verdicts: a camp mate\'s night that lands after my open is mine to sleep at its kind; one already there at the open is not; a foe\'s break outranks it; a mate first seen after the open is a baseline; the wait ends at CAMP_WAIT_MS', () => {
  const before = nightStamp(NOW - 20_000, 'rough');
  const rows = [mate('a', { at: before, rs: 1, enemy: 5 })];
  const w = watch();
  w.open(rows, NOW - 10_000);
  assert.deepEqual(w.verdict({ me: 'm', members: rows, inCamp: everyone, now: NOW }), { act: 'roll' }, 'the night before my act is no move');
  rows[0].p.restStartedAt = nightStamp(NOW - 500, 'bed');
  assert.deepEqual(w.verdict({ me: 'm', members: rows, inCamp: everyone, now: NOW }), { act: 'night', acct: 'a', name: 'A', kind: 'bed' });
  rows[0].p.restEnemyAt = 9;
  assert.equal(w.verdict({ me: 'm', members: rows, inCamp: everyone, now: NOW }).act, 'enemy', 'their ambush breaks mine, ahead of their night');
  // a night that lands while my channel is still held counts (the open is the baseline, not the channel's end)
  const late = [mate('a', { at: campStamp(NOW - 5_000, 'open'), rs: 1 })];
  const w2 = watch();
  w2.open(late, NOW - 5_000);
  late[0].p.restStartedAt = nightStamp(NOW - 1_000, 'camp');
  assert.equal(w2.verdict({ me: 'm', members: late, inCamp: everyone, now: NOW }).act, 'night');
  // first sight after the open: a baseline
  const w3 = watch();
  w3.open([], NOW - 5_000);
  const newcomer = [mate('a', { at: nightStamp(NOW - 1_000, 'camp'), rs: 1, enemy: 3 })];
  assert.deepEqual(w3.verdict({ me: 'm', members: newcomer, inCamp: everyone, now: NOW }), { act: 'roll' });
  assert.deepEqual(w3.verdict({ me: 'm', members: newcomer, inCamp: everyone, now: NOW + 100 }), { act: 'roll' }, 'and stays one: what they bore at first sight is not a move');
  // the wait's end
  const slow = [mate('a', { at: campStamp(NOW, 'open'), rs: 1 })];
  const w4 = watch();
  w4.open(slow, NOW);
  assert.equal(w4.verdict({ me: 'm', members: slow, inCamp: everyone, now: NOW + 1 }).act, 'wait');
  assert.equal(w4.verdict({ me: 'm', members: slow, inCamp: everyone, now: NOW + CAMP_WAIT_MS - 1 }).act, 'wait');
  assert.deepEqual(w4.verdict({ me: 'm', members: slow, inCamp: everyone, now: NOW + CAMP_WAIT_MS + 1 }), { act: 'roll' }, 'my own roll: today\'s behaviour, the fail-open');
  w4.close();
  assert.equal(w4.isOpen(), false);
});

test('CAMP-ROLL two members press Rest at one fire: ONE of them rolls, and the other sleeps that night with no roll of their own - before, two rolls (each a party-sized pack)', () => {
  // the two poses, as each client reads the other's
  const pose = { a: mate('a'), b: mate('b') };
  const wa = watch(), wb = watch();
  const t0 = NOW;
  wa.open([pose.b], t0); pose.a.p.restStartedAt = campStamp(t0, 'open'); pose.a.p.rs = 1;
  wb.open([pose.a], t0 + 400); pose.b.p.restStartedAt = campStamp(t0 + 400, 'open'); pose.b.p.rs = 1;
  const end = t0 + REST_CHANNEL_SECONDS * 1000 + 400;
  let rolls = 0;
  const va = wa.verdict({ me: 'a', members: [pose.b], inCamp: everyone, now: end });
  const vb = wb.verdict({ me: 'b', members: [pose.a], inCamp: everyone, now: end });
  for (const v of [va, vb]) if (v.act === 'roll') rolls++;
  assert.equal(rolls, 1, 'one roller');
  assert.equal(va.act, 'roll');
  assert.deepEqual(vb, { act: 'wait', acct: 'a', name: 'A' });
  pose.a.p.restStartedAt = nightStamp(end + 50, 'camp');   // a's night lands whole (world.js setNightListener)
  assert.deepEqual(wb.verdict({ me: 'b', members: [pose.a], inCamp: everyone, now: end + 300 }), { act: 'night', acct: 'a', name: 'A', kind: 'camp' });
  // and had a foe broken it: a's enemy marker moves, and b breaks with it
  const wb2 = watch();
  pose.a.p.restEnemyAt = 1; pose.a.p.restStartedAt = campStamp(t0, 'open');
  wb2.open([pose.a], t0 + 400);
  pose.a.p.restEnemyAt = 2;
  assert.equal(wb2.verdict({ me: 'b', members: [pose.a], inCamp: everyone, now: end }).act, 'enemy');
});

test('CAMP-ROLL the step both windows take: wait, a camp mate\'s night slept through the bag\'s carried night with its words, their ambush with mine broken, my own roll; a short rest and a kneel ask the camp nothing', () => {
  const log = [];
  const deps = (v) => ({
    camp: { verdict: () => { log.push('ask'); return v; } },
    restNight: (o) => { log.push(`night:${o.rentedHours}`); return { textId: REST_TEXT.wakeUp, enemyBroke: false, died: false }; },
    restShort: () => { log.push('short'); return { text: 'short' }; },
    restCampNight: (kind, night) => { log.push(`camp:${kind}:${night}`); return { textId: REST_TEXT.wakeUp, enemyBroke: false, died: false }; },
    onEnemyBreak: () => log.push('break'),
    endLines: (id) => [`text ${id}`],
  });
  const night = { night: true, point: { where: 'fire' } };
  assert.deepEqual(campNightStep(deps({ act: 'wait', name: 'Ada' }), night), { wait: 'Ada' });
  assert.deepEqual(campNightStep(deps({ act: 'night', name: 'Ada', kind: 'camp' }), night), { r: { textId: null, text: REST_ACT_TEXT.carried('Ada'), enemyBroke: false, died: false } });
  assert.deepEqual(campNightStep(deps({ act: 'enemy', name: 'Ada' }), night), { r: { textId: REST_TEXT.enemiesNearby, enemyBroke: true, died: false } });
  assert.deepEqual(campNightStep(deps({ act: 'roll' }), night, 7).r.textId, REST_TEXT.wakeUp);
  assert.deepEqual(campNightStep(deps(null), night).r.textId, REST_TEXT.wakeUp, 'no camp (offline, a building): my own night');
  assert.deepEqual(log, ['ask', 'ask', 'camp:camp:true', 'ask', 'break', 'ask', 'night:7', 'ask', 'night:-1']);
  log.length = 0;
  campNightStep(deps({ act: 'wait', name: 'Ada' }), { night: false, point: {} });
  assert.deepEqual(log, ['short'], 'a short rest (inside my interval) rolls nothing and asks nothing');
  assert.equal(carriedNightEnd('Ada', true, { died: true }).text, null);
});

const sleeper = () => ({ health: 5, maxHealth: 60, fatigue: 0, magicka: 0, maxMagicka: 30, stats: { endurance: 50, strength: 50, willpower: 50, agility: 50 }, skills: [], career: {}, activeEffects: [] });
/** A bag whose every rested minute asks the dungeon's resting roll with the dice at zero, counting the hits. */
const rollingBag = (e, over = {}) => {
  let hits = 0;
  const bag = createRestDeps(e, {
    restKind: () => 'rough', restPoint: () => null, endLines: () => null,
    advanceMinutes: (n) => {
      const start = Math.floor(ownMinutes());
      for (let m = 0; m < n; m++) if (intermittentEnemySpawn({ gameMinutes: start + m, inside: true, inDungeon: true, isResting: true, restAsks: 1, enemyAlertActive: true, dungeonType: 0, playerLevel: 5 }, () => 0)) hits++;
      advanceOwnMinutes(n);
    },
    ...over,
  });
  return { bag, hits: () => hits };
};

test('CAMP-ROLL the bag\'s carried night (restCampNight) rolls nothing however the dice fall, where my own night rolls; it sleeps the better of their spot and mine; every close of the rest closes the camp', () => {
  setPref('survival', SURVIVAL_STORED.hard);
  setSharedClock(() => 5_000_000);
  setOwnMinutes(400_000);
  const own = rollingBag(sleeper());
  own.bag.setResting(true); own.bag.restNight(); own.bag.setResting(false);
  assert.ok(own.hits() > 0, 'my own night asks the ambush');
  setOwnMinutes(500_000);
  const e = sleeper();
  const closed = [];
  const camp = rollingBag(e, { camp: { close: () => closed.push('close') } });
  let mid = null;
  try { camp.bag.restCampNight('camp', true); mid = closed.length; } finally { camp.bag.setResting(false); }
  assert.equal(mid, 0, 'the night\'s open closes nothing');
  assert.equal(camp.hits(), 0, 'a camp mate\'s night: no roll of mine');
  assert.equal(e.health, 60, 'by their fire - Hard\'s rough night would have left me short');
  assert.deepEqual(closed, ['close'], 'the close of the rest closes the camp');
  assert.equal(typeof camp.bag.camp.close, 'function', 'the camp rides to the window');
});

/** The classic window over a bag with an act and a camp that answers `verdicts` in turn. */
async function classic(verdicts, over = {}) {
  const { RestWindow } = await import('../src/ui/restWindow.js');
  const calls = { night: 0, camp: [], opened: [], settled: 0, broke: 0 };
  const deps = {
    setResting() {}, setLoitering() {}, enemiesNearby: () => false, endLines: (id) => [`text ${id}`],
    restAct: () => ({ point: { kind: 'camp', where: 'fire' }, night: true, channelSeconds: REST_CHANNEL_SECONDS }),
    restNight: () => { calls.night++; return { textId: REST_TEXT.wakeUp, enemyBroke: false, died: false }; },
    restCampNight: (kind) => { calls.camp.push(kind); return { textId: REST_TEXT.wakeUp, enemyBroke: false, died: false }; },
    onEnemyBreak: () => { calls.broke++; },
    camp: { open: (n) => calls.opened.push(n), verdict: () => verdicts.shift() ?? { act: 'roll' }, settle: () => { calls.settled++; } },
    ...over,
  };
  return { w: new RestWindow(deps), calls };
}

test('CAMP-ROLL the classic window: the channel opens the camp; at its end a wait page names the roller, Esc stops it with nothing slept; the roller\'s night is slept as theirs (no roll of mine), their ambush breaks mine; the roller is me - my own night', async () => {
  const a = await classic([{ act: 'wait', name: 'Ada' }, { act: 'wait', name: 'Ada' }, { act: 'night', name: 'Ada', kind: 'camp' }]);
  assert.deepEqual(a.calls.opened, [true]);
  a.w.tick(REST_CHANNEL_SECONDS + 0.1);
  assert.equal(a.w.state, 'campWait');
  a.w.tick(0.1);
  assert.equal(a.w.state, 'campWait', 'still waiting');
  a.w.tick(0.1);
  assert.equal(a.calls.night, 0, 'no night of my own rolled');
  assert.deepEqual(a.calls.camp, ['camp']);
  assert.equal(a.w.state, 'ended');
  assert.deepEqual(a.w.endLines, [REST_ACT_TEXT.carried('Ada')]);
  assert.ok(a.calls.settled >= 1, 'the end settles the camp');
  const stop = await classic([{ act: 'wait', name: 'Ada' }]);
  stop.w.tick(REST_CHANNEL_SECONDS + 0.1);
  assert.equal(stop.w.state, 'campWait');
  stop.w.input('back');
  stop.w.keyup('back');
  assert.equal(stop.w.done, true);
  assert.equal(stop.calls.night + stop.calls.camp.length, 0, 'nothing slept');
  const foe = await classic([{ act: 'wait', name: 'Ada' }, { act: 'enemy', name: 'Ada' }]);
  foe.w.tick(REST_CHANNEL_SECONDS + 0.1);
  foe.w.tick(0.1);
  assert.equal(foe.calls.broke, 1, 'my break said too (the next waiter on me hears it)');
  assert.deepEqual(foe.w.endLines, [`text ${REST_TEXT.enemiesNearby}`]);
  let near = false;
  const mine = await classic([{ act: 'wait', name: 'Ada' }], { enemiesNearby: () => near });
  mine.w.tick(REST_CHANNEL_SECONDS + 0.1);
  near = true;
  mine.w.tick(0.1);
  assert.deepEqual(mine.w.endLines, [`text ${REST_TEXT.enemiesNearby}`], 'a foe in reach while waiting ends it through the channel\'s own end check');
  // LOITER-ANYWHERE (main): the channel's loiter leaves the act - and the camp is settled, so no mate waits on me
  const loit = await classic([]);
  const before = loit.calls.settled;
  loit.w.input('char:3');
  assert.equal(loit.w.mode, 'loiter');
  assert.equal(loit.calls.settled, before + 1, 'settled the moment the act became a loiter');
  const roll = await classic([{ act: 'roll' }]);
  roll.w.tick(REST_CHANNEL_SECONDS + 0.1);
  assert.equal(roll.calls.night, 1);
});

// the enhanced card under a fake document (test/rest1_act.test.js's shape)
const mkEl = (tag) => ({
  tag, className: '', textContent: '', id: '', value: '', type: '', min: '', max: '', children: [], style: {}, attrs: {},
  setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; },
  append(...c) { this.children.push(...c); }, remove() {}, replaceChildren(...c) { this.children = c; },
  addEventListener() {}, removeEventListener() {}, focus() {},
  set innerHTML(v) { if (v === '') this.children = []; }, get innerHTML() { return ''; },
});
const textsOf = (n, out = []) => { if (n.textContent) out.push(n.textContent); for (const c of n.children ?? []) textsOf(c, out); return out; };

test('CAMP-ROLL the enhanced card: the wait card names the roller and is built once, Stop closes it with nothing slept; the roller\'s night ends it as theirs', async () => {
  const prev = [globalThis.document, globalThis.window, globalThis.requestAnimationFrame];
  globalThis.document = { createElement: mkEl, createTextNode: (t) => ({ text: t, className: '' }), getElementById: () => null, head: mkEl('head'), body: mkEl('body'), addEventListener() {}, removeEventListener() {}, pointerLockElement: null, exitPointerLock() {}, querySelector: () => null };
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.requestAnimationFrame = () => 0;
  try {
    const { mountEnhancedRest } = await import('../src/ui/enhancedRest.js');
    const mount = (verdicts) => {
      const calls = { night: 0, camp: [], opened: [] };
      const host = mkEl('div');
      const overlay = mountEnhancedRest(host, {
        setResting() {}, setLoitering() {}, enemiesNearby: () => false, endLines: (id) => [`text ${id}`],
        restAct: () => ({ point: { kind: 'camp', where: 'fire' }, night: true, channelSeconds: 6 }),
        restNight: () => { calls.night++; return { textId: REST_TEXT.wakeUp, enemyBroke: false, died: false }; },
        restCampNight: (kind) => { calls.camp.push(kind); return { textId: REST_TEXT.wakeUp, enemyBroke: false, died: false }; },
        camp: { open: (n) => calls.opened.push(n), verdict: () => verdicts.shift() ?? { act: 'roll' }, settle() {} },
      });
      return { overlay, host, calls };
    };
    const a = mount([{ act: 'wait', name: 'Ada' }, { act: 'wait', name: 'Ada' }, { act: 'night', name: 'Ada', kind: 'bed' }]);
    assert.deepEqual(a.calls.opened, [true]);
    a.overlay.tick(6.1);
    assert.equal(a.overlay.state, 'campWait');
    assert.ok(textsOf(a.host).includes(REST_ACT_TEXT.campWait('Ada')));
    const card = a.host.children[0];
    a.overlay.tick(0.1);
    assert.equal(a.host.children[0], card, 'the same roller: the card is not rebuilt (RESTFIX1)');
    a.overlay.tick(0.1);
    assert.equal(a.calls.night, 0);
    assert.deepEqual(a.calls.camp, ['bed']);
    assert.equal(a.overlay.state, 'ended');
    const b = mount([{ act: 'wait', name: 'Ada' }]);
    b.overlay.tick(6.1);
    b.overlay.stopOrClose();
    assert.equal(b.overlay.done, true);
    assert.equal(b.calls.night + b.calls.camp.length, 0, 'nothing slept');
  } finally { [globalThis.document, globalThis.window, globalThis.requestAnimationFrame] = prev; }
});

test('CAMP-ROLL by source: both windows open the camp and take the one step; the outdoor host and the dungeon carry the camp, the building none; the carry loop says nothing of a night my window takes; a rest\'s ambush keeps its band from the camp', () => {
  for (const f of ['src/ui/restWindow.js', 'src/ui/enhancedRest.js']) {
    const s = rd(f);
    assert.match(s, /deps\.camp\?\.open\?\.\(!!(this\._act|act)\.night\);/, `${f}: opened with the channel`);
    assert.match(s, /campNightStep\((this\.)?deps, (this\._actPlan|_actPlan), (this|overlay)\._remainingHoursRented\)/, `${f}: the one step`);
    assert.equal((s.match(/deps\.camp\?\.settle\?\.\(\);/g) ?? []).length, 2, `${f}: settled at the end, and when the act becomes a loiter (LOITER-ANYWHERE)`);
    assert.match(s, /state === 'campWait'\) \{ if \(channelBroken\(/, `${f}: the wait is still the hold`);
    assert.match(s, /REST_ACT_TEXT\.campWait\(/, f);
  }
  const w = rd('src/scenes/world.js');
  assert.match(w, /camp: \{ open: \(night\) => campRest\.open\(night\), verdict: \(\) => campRest\.verdict\(\), settle: \(\) => campRest\.settle\(\), close: \(\) => campRest\.close\(\) \},/, 'the outdoor bag');
  assert.match(w, /\n    campRest,   \/\/ CAMP-ROLL/, 'handed to the modes');
  assert.match(rd('src/scenes/worldModes.js'), /campRest: host\.campRest \?\? null,/, 'forwarded to the dungeon');
  assert.match(rd('src/scenes/dungeonContext.js'), /\n    camp: opts\.campRest \?\? null,\n/, 'the dungeon\'s bag');
  const wm = rd('src/scenes/worldModes.js');
  const interior = wm.slice(wm.indexOf('const interiorRestDeps = createRestDeps(playerEntity, {'), wm.indexOf('const interiorRestDeps = createRestDeps(playerEntity, {') + 6000);
  assert.doesNotMatch(interior, /\bcamp:/, 'a building rolls nothing - no camp');
  assert.match(w, /inCamp: \(m\) => memberPresent\(m\) && nearAccount\(m\.acct, m\.p\),/, 'the night\'s own reach');
  assert.match(w, /if \(!night \|\| !social\?\.party \|\| !sharedClockOn\(\) \|\| !restTogether\(\)\) \{ _campWatch\.close\(\); return; \}/, 'a party resting together, online, on a night');
  assert.match(w, /settle: \(\) => \{ if \(social && campMarkOf\(_partyRestJustStartedAt\) === 'open'\) campStampNow\('done'\); \},/, 'a night heard is never overwritten');
  assert.match(w, /if \(!act \|\| \(act === 'busy' && _campWatch\.isOpen\(\)\)\) continue;/, 'my window takes that night: no "too busy"');
  const stand = w.slice(w.indexOf('const _standEncounterFoe = (hit, feet) => {'), w.indexOf('journeyMet();   // AUDIT OW5b E1'));
  assert.match(stand, /for \(const env of campPasses\(base, campFeet\(\), hit\.minDistance\)\) \{/, 'the camp\'s band first, DFU\'s placement after');
  assert.match(w, /const campFeet = \(\) => \(playerEntity\.isResting \? /, 'only a rest\'s roll');
});

test('CAMP-ROLL the placement\'s passes: no camp, DFU\'s one; a camp, its band first (a spot DFU\'s test refuses still refused), then DFU\'s own - and the stander places through them in that order', () => {
  const env = { overlapSphere: (p) => p.x === 99, raycast: () => null };
  assert.deepEqual(campPasses(env, [], 10), [env]);
  const [camp, dfu] = campPasses(env, [[0, 0, 0]], 10);
  assert.equal(dfu, env, 'the last pass is DFU\'s own env');
  assert.equal(camp.raycast, env.raycast, 'the camp\'s pass is DFU\'s in everything else');
  assert.equal(camp.overlapSphere({ x: 5, z: 0 }, 0.65), true, 'inside a mate\'s band');
  assert.equal(camp.overlapSphere({ x: 30, z: 0 }, 0.65), false);
  assert.equal(camp.overlapSphere({ x: 99, z: 0 }, 0.65), true, 'DFU\'s own refusal kept');
  // the stander itself (test/encounterplace.test.js's run): a camp's first pass refuses its spot, DFU's stands it
  const w = rd('src/scenes/world.js');
  const at = w.indexOf('  const _standEncounterFoe = (hit, feet) => {');
  const src = w.slice(at, w.indexOf('\n  };\n', at) + 5);
  const seen = [];
  const scope = {
    exteriorFoes: { encounterRoom: () => 8, spawnFoe: () => Promise.resolve({}) },
    placeFoeEnv: () => ({ overlapSphere: () => false }), collider: {}, cam: { yaw: 0 }, fieldOfView: () => 1, entityOccupancy: () => () => false, _placingPool: () => [],
    LOOSE_FOE_PLACE_ATTEMPTS: 2, ENEMY_BASICS: {}, journeyMet: () => {}, ambushNight: () => false,
    placeFoeFreely: (e) => { const p = { x: 4, y: 0, z: 0 }; seen.push(e); return e.overlapSphere(p, 0.65) ? null : p; },
    campFeet: () => [[0, 0, 0]], campPasses,
    wildTravelling: () => false,   // WILD-ALERT: no fast traveller here - the wanderer's placement roll is test/encounterplace.test.js's
  };
  const k = Object.keys(scope);
  const stand = new Function(...k, `${src}\nreturn _standEncounterFoe;`)(...k.map((x) => scope[x]));
  assert.ok(stand({ mobileType: 7, minDistance: 10, maxDistance: 20, lineOfSightCheck: true }, [0, 0, 0]) instanceof Promise, 'stood, by DFU\'s pass');
  assert.equal(seen.length, 3, 'the camp\'s two tries, then DFU\'s first');
  assert.equal(seen[0], seen[1]);
  assert.notEqual(seen[0], seen[2]);
});

test('CAMP-ROLL the band kept from the camp: a spot inside any mate\'s band is refused, one clear of all stands', () => {
  const feet = [[0, 0, 0], [12, 3, 0]];
  assert.equal(campClear({ x: 5, z: 0 }, feet, 10), false);
  assert.equal(campClear({ x: 19, z: 0 }, feet, 10), false, 'clear of the first, within the second mate\'s band');
  assert.equal(campClear({ x: 0, z: 30 }, feet, 10), true);
  assert.equal(campClear({ x: 22, z: 0 }, feet, 10), true, 'exactly the band - clear');
  assert.equal(campClear({ x: 0, z: 0 }, [], 10), true);
});
