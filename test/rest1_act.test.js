// REST1 (2026-10-03, bible/06-Systems/Rest-Arc.md; Mac: "Resting is no longer time based online with campfires, beds,
// camping sets, being the main way to rest", then "Go"): THE REST ACT ONLINE. Online the rest window opens on the act -
// refused with no rest point, or a channel held at a fire or a bed - and lands ONE NIGHT through the host's own rest
// bag: the timed rest's own session, eight hours, run in one call, so every sub-tick system sees what an eight-hour rest
// gave it. A second rest inside the night interval (two hours of the character's clock) is a short rest: it heals, and
// nothing passes. Offline the window is DFU's, byte for byte.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  NIGHT_HOURS, NIGHT_MINUTES, NIGHT_INTERVAL_MINUTES, REST_CHANNEL_SECONDS, REST_ACT_TEXT,
  nightDue, nightRealMinutesLeft, stampNight, runRestNight, topUpRest, spendRoomNight, restPricedWhole,
} from '../src/systems/restAct.js';
import { RestSession, REST_TEXT, MINUTES_PER_TICK } from '../src/systems/restSession.js';
import { REST_KIND } from '../src/systems/survival/rest.js';
import { SURVIVAL_RULES, HARD_RULES } from '../src/systems/survival/difficulty.js';
const CASUAL_RULES = SURVIVAL_RULES.casual;
import { setSharedClock, ownMinutes, advanceOwnMinutes, setOwnMinutes } from '../src/systems/worldTick.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
afterEach(() => { setSharedClock(null); });

/** A rest bag that logs what the night asks of it, in order. */
function logDeps(over = {}) {
  const log = [];
  const deps = {
    advanceMinutes: (n) => log.push(`advance:${n}`),
    tickQuests: () => log.push('quests'),
    tickVitals: () => { log.push('vitals'); return false; },
    enemiesNearby: () => false,
    dead: () => false,
    fullyHealed: () => false,
    ...over,
  };
  return { deps, log };
}

test('REST1 the law: a night is DFU\'s eight hours; the interval is two hours of the character\'s clock since the last night ended, a stamp from the future never refusing one; the Rested foot in real minutes', () => {
  assert.deepEqual([NIGHT_HOURS, NIGHT_MINUTES, NIGHT_INTERVAL_MINUTES, REST_CHANNEL_SECONDS], [8, 480, 120, 6]);
  const e = {};
  assert.equal(nightDue(e, 1000), true, 'no night yet: the first rest is a night');
  stampNight(e, 1000);
  assert.equal(e.restNightAt, 1000);
  assert.equal(nightDue(e, 1119), false, 'a minute short of the interval: a short rest');
  assert.equal(nightDue(e, 1120), true, 'two hours on: a night again');
  assert.equal(nightDue(e, 900), true, 'a clock behind the stamp (a load from another timeline): never a refused night');
  assert.equal(nightRealMinutesLeft(e, 1000), 10, 'ten real minutes of play');
  assert.equal(nightRealMinutesLeft(e, 1115), 1, 'never "0 minutes" while one is still owed');
  assert.equal(nightRealMinutesLeft(e, 1120), 0);
});

test('REST1 the yield: a bed or a fire, Casual\'s rough or the arc off end full; Hard\'s rough night keeps what its hours gave, its short rest half of what is missing', () => {
  const body = () => ({ health: 10, maxHealth: 50, fatigue: 100, magicka: 2, maxMagicka: 40 });
  const mf = () => 500;
  for (const [kind, rules] of [[REST_KIND.Bed, HARD_RULES], [REST_KIND.Camp, HARD_RULES], [REST_KIND.Rough, CASUAL_RULES], [REST_KIND.Rough, null]]) {
    const e = body();
    topUpRest(e, kind, rules, { maxFatigueOf: mf });
    assert.deepEqual([e.health, e.fatigue, e.magicka], [50, 500, 40], `${kind} under ${rules?.id ?? 'the arc off'}: full`);
  }
  assert.equal(restPricedWhole(REST_KIND.Rough, HARD_RULES), false);
  const night = body();
  topUpRest(night, REST_KIND.Rough, HARD_RULES, { night: true, maxFatigueOf: mf });
  assert.deepEqual([night.health, night.fatigue, night.magicka], [10, 100, 2], 'Hard\'s rough night: its eight hours\' own healing stands');
  const short = body();
  topUpRest(short, REST_KIND.Rough, HARD_RULES, { night: false, maxFatigueOf: mf });
  assert.deepEqual([short.health, short.fatigue, short.magicka], [30, 300, 21], 'Hard\'s rough short rest: half of what is missing');
});

test('REST1 a rented room\'s night: the night\'s eight hours ran off its expiry, the rest of the day goes with them - a day rented is a night slept', () => {
  const room = { expiryMinutes: 10_000 };
  spendRoomNight(room);
  assert.equal(room.expiryMinutes, 10_000 - (24 * 60 - 480));
  spendRoomNight(null);   // no room: nothing
});

test('REST1 the night is the timed rest\'s own session in one call: forty-eight sub-ticks of ten minutes, a quest tick each, the vitals each hour - the same calls, in the same order, as an eight-hour rest paced over its timer', () => {
  const night = logDeps();
  const r = runRestNight(night.deps);
  assert.equal(r.hours, 8);
  assert.equal(r.result.textId, REST_TEXT.wakeUp);
  assert.equal(night.log.filter((l) => l === `advance:${MINUTES_PER_TICK}`).length, 48);
  assert.equal(night.log.filter((l) => l === 'quests').length, 48);
  assert.equal(night.log.filter((l) => l === 'vitals').length, 8);
  // the window's own pacing, a frame at a time
  const paced = logDeps();
  const s = new RestSession('timed', 8, paced.deps);
  let res = null;
  for (let i = 0; i < 10_000 && !res; i++) res = s.tick(1 / 60);
  assert.deepEqual(night.log, paced.log, 'nothing restated: the night is the rest');
});

test('REST1 the night breaks as a rest breaks: a foe in reach at the third hour ends it there; a room that runs out mid-night ends it with the landlord\'s line', () => {
  let hour = 0;
  const foe = logDeps({ tickVitals: () => { hour++; return false; }, enemiesNearby: () => hour >= 3 });
  const r = runRestNight(foe.deps);
  assert.equal(r.result.enemyBroke, true);
  assert.equal(r.hours, 4, 'the hour the foe is found is counted, its vitals not');
  const rent = runRestNight(logDeps().deps, { rentedHours: 5 });
  assert.equal(r.result.textId, REST_TEXT.enemiesNearby);
  assert.equal(rent.result.rentExpired, true);
  assert.equal(rent.hours, 5);
});

test('REST1 createRestDeps composes the act online: the plan names the point and whether a night is due; a night moves the character\'s clock eight hours, stamps it and ends full; the next rest inside the interval is a short rest that heals and moves nothing; offline there is no act', async () => {
  const { createRestDeps } = await import('../src/scenes/shared.js');
  setSharedClock(() => 5_000_000);
  setOwnMinutes(400_000);
  const e = { health: 5, maxHealth: 60, fatigue: 0, magicka: 0, maxMagicka: 30, stats: { endurance: 50, strength: 50, willpower: 50, agility: 50 }, skills: [], career: {}, activeEffects: [] };
  const point = { kind: 'camp', where: 'fire' };
  const deps = createRestDeps(e, { restPoint: () => point, restKind: () => 'camp', advanceMinutes: (n) => advanceOwnMinutes(n), endLines: () => null });
  const plan = deps.restAct();
  assert.deepEqual(plan, { point, night: true, channelSeconds: REST_CHANNEL_SECONDS });
  deps.setResting(true);
  const before = ownMinutes();
  const r = deps.restNight();
  deps.setResting(false);
  assert.equal(r.textId, REST_TEXT.wakeUp);
  assert.equal(Math.round(ownMinutes() - before), NIGHT_MINUTES, 'eight hours on the character\'s clock');
  assert.equal(e.restNightAt, Math.floor(ownMinutes()));
  assert.equal(e.health, 60, 'a fire\'s night ends full');
  assert.equal(e.magicka, 30);
  assert.equal(deps.restAct().night, false, 'the interval: the next rest is a short one');
  e.health = 20;
  const mark = ownMinutes();
  deps.setResting(true);
  const s = deps.restShort();
  deps.setResting(false);
  assert.equal(ownMinutes(), mark, 'a short rest moves no clock');
  assert.equal(e.health, 60, 'and heals');
  assert.equal(s.text, REST_ACT_TEXT.shortRest);
  assert.equal(s.extra, REST_ACT_TEXT.nextNight(10));
  setSharedClock(null);
  assert.equal(deps.restAct(), null, 'offline: DFU\'s window, no act');
});

/** The classic window over a bag with an act. */
async function classic(over = {}) {
  const { RestWindow } = await import('../src/ui/restWindow.js');
  const calls = { night: 0, short: 0, finished: 0, crime: 0, closed: 0 };
  const deps = {
    setResting() {}, setLoitering() {}, enemiesNearby: () => false, endLines: (id) => [`text ${id}`],
    restAct: () => ({ point: { kind: 'camp', where: 'fire' }, night: true, channelSeconds: REST_CHANNEL_SECONDS }),
    restNight: () => { calls.night++; return { textId: REST_TEXT.wakeUp, enemyBroke: false, died: false }; },
    restShort: () => { calls.short++; return { text: REST_ACT_TEXT.shortRest, extra: 'x', enemyBroke: false, died: false }; },
    onRestFinished: () => { calls.finished++; }, commitCrime: () => { calls.crime++; }, onClose: () => { calls.closed++; },
    ...over,
  };
  return { w: new RestWindow(deps), calls, deps };
}

test('REST1 the classic window online opens on the channel - no selection page, no hours - holds it for its seconds and lands the night on the ordinary wake box, whose close is the skill raise', async () => {
  const { w, calls } = await classic();
  assert.equal(w.state, 'channel');
  assert.match(w.actLines()[0], /Resting by the fire/);
  w.tick(REST_CHANNEL_SECONDS - 0.5);
  assert.equal(calls.night, 0, 'held: not yet');
  w.tick(0.6);
  assert.equal(calls.night, 1);
  assert.equal(w.state, 'ended');
  assert.deepEqual(w.endLines, [`text ${REST_TEXT.wakeUp}`]);
  w.input('confirm');
  assert.equal(calls.finished, 1, 'closing the wake box is the advancement moment, as ever');
  const { w: s, calls: c2 } = await classic({ restAct: () => ({ point: { kind: 'bed', where: null }, night: false, channelSeconds: 6 }) });
  s.tick(7);
  assert.equal(c2.short, 1, 'inside the interval: the short rest');
  assert.deepEqual(s.endLines, [REST_ACT_TEXT.shortRest, 'x'], 'and when a night may pass again');
});

test('REST1 the classic window\'s refusals and stop: no rest point, the town\'s street (no crime - there is no rest to commit it with), a foe in reach at the channel\'s end; a channel stopped closes with nothing slept and no raise', async () => {
  const none = await classic({ restAct: () => ({ point: null, night: true, channelSeconds: 6 }) });
  assert.equal(none.w.state, 'refused');
  assert.deepEqual(none.w.refusalLines, [REST_ACT_TEXT.noPoint]);
  const town = await classic({ restPlace: () => ({ inTownOutside: true, inTownLocation: true, insideBuilding: false }) });
  assert.equal(town.w.state, 'refused');
  assert.deepEqual(town.w.refusalLines, [REST_ACT_TEXT.inTown]);
  assert.equal(town.calls.crime, 0);
  let foe = false;
  const ambush = await classic({ enemiesNearby: () => foe });
  foe = true;
  ambush.w.tick(7);
  assert.equal(ambush.calls.night, 0, 'no night with a foe in reach');
  assert.deepEqual(ambush.w.endLines, [`text ${REST_TEXT.enemiesNearby}`]);
  const stop = await classic();
  stop.w.input('back');
  stop.w.keyup('back');
  assert.equal(stop.w.done, true);
  assert.equal(stop.calls.night + stop.calls.finished, 0, 'nothing slept, nothing raised');
});

test('REST1 offline the classic window is DFU\'s: no act, the selection page', async () => {
  const { w } = await classic({ restAct: () => null });
  assert.equal(w.state, 'selection');
});

// ─── THE ENHANCED CARD, UNDER A FAKE DOCUMENT (auditparty8's shape) ───────────────────────────────────────────────
const mkEl = (tag) => ({
  tag, className: '', textContent: '', id: '', value: '', type: '', min: '', max: '', children: [], style: {}, attrs: {},
  setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; },
  append(...c) { this.children.push(...c); }, remove() {}, replaceChildren(...c) { this.children = c; },
  addEventListener() {}, removeEventListener() {}, focus() {},
  set innerHTML(v) { if (v === '') this.children = []; }, get innerHTML() { return ''; },
});
const findAll = (n, cls, out = []) => { if (String(n.className ?? '').split(/\s+/).includes(cls)) out.push(n); for (const c of n.children ?? []) findAll(c, cls, out); return out; };
async function enhanced(over, fn) {
  const prev = [globalThis.document, globalThis.window, globalThis.requestAnimationFrame];
  globalThis.document = { createElement: mkEl, createTextNode: (t) => ({ text: t, className: '' }), getElementById: () => null, head: mkEl('head'), body: mkEl('body'), addEventListener() {}, removeEventListener() {}, pointerLockElement: null, exitPointerLock() {}, querySelector: () => null };
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.requestAnimationFrame = () => 0;
  try {
    const { mountEnhancedRest } = await import('../src/ui/enhancedRest.js');
    const calls = { night: 0, finished: 0 };
    const deps = {
      setResting() {}, setLoitering() {}, enemiesNearby: () => false, endLines: (id) => [`text ${id}`],
      restAct: () => ({ point: { kind: 'camp', where: 'fire' }, night: true, channelSeconds: 6 }),
      restNight: () => { calls.night++; return { textId: REST_TEXT.wakeUp, enemyBroke: false, died: false }; },
      onRestFinished: () => { calls.finished++; },
      ...over,
    };
    const host = mkEl('div');
    await fn({ overlay: mountEnhancedRest(host, deps), host, calls });
  } finally { [globalThis.document, globalThis.window, globalThis.requestAnimationFrame] = prev; }
}

test('REST1 the enhanced card online: the channel card with its meter, the night at its end, the wake card; Stop in the channel closes with nothing slept; with no point, the refusal', async () => {
  await enhanced({}, async ({ overlay, host, calls }) => {
    assert.equal(overlay.state, 'channel');
    overlay.tick(3);
    assert.equal(findAll(host, 'meter-fill')[0].style.width, '50%');
    overlay.tick(3.1);
    assert.equal(calls.night, 1);
    assert.equal(overlay.state, 'ended');
    overlay.stopOrClose();
    assert.equal(calls.finished, 1);
  });
  await enhanced({}, async ({ overlay, calls }) => {
    overlay.stopOrClose();
    assert.equal(overlay.done, true);
    assert.equal(calls.night + calls.finished, 0);
  });
  await enhanced({ restAct: () => ({ point: null, night: true, channelSeconds: 6 }) }, async ({ overlay }) => {
    assert.equal(overlay.state, 'refused');
    assert.deepEqual(overlay._refusalLines, [REST_ACT_TEXT.noPoint]);
  });
});

test('REST1 by source: every host that rests online names its rest point - the open road\'s fire or a pressed bed, a building (CanRest decides), a dungeon\'s fire - and the save keeps the night\'s stamp', () => {
  assert.match(rd('src/scenes/world.js'), /restPoint: \(\) => \(_restFromBed \? \{ kind: 'bed', where: null \} : camps\.restPointAt\(/);
  assert.match(rd('src/scenes/worldModes.js'), /restPoint: \(\) => \{ const p = interiorRestPlaceHere\(\); return \{ kind:/);
  assert.match(rd('src/scenes/dungeonContext.js'), /restPoint: \(\) => \(_fpFeet \? camps\.restPointAt\(_fpFeet\) : null\)/);
  assert.match(rd('src/systems/save.js'), /'restNightAt',\n\];/);
});

test('REST1 the Rested tile: a buff while the night interval runs, its real minutes at its foot, the campfire glyph; none once a night may pass', async () => {
  const { statusTiles } = await import('../src/ui/hudStatus.js');
  const [t] = statusTiles({ rested: { minutes: 7 } });
  assert.deepEqual([t.key, t.kind, t.name, t.foot, t.glyph], ['rested', 'buff', 'Rested', '7m', 'rested']);
  assert.deepEqual(statusTiles({ rested: { minutes: 0 } }), []);
  assert.deepEqual(statusTiles({ rested: null }), []);
  assert.match(rd('src/ui/enhancedHud.js'), /const rested = sharedClockOn\(\) \? \{ minutes: nightRealMinutesLeft\(vitals, ownMinutes\(\)\) \} : null;/);
});
