// @ts-check
// LOITER-ANYWHERE (2026-10-04, Discord: "the new rest system ... has no loiter which again, another system that a lot
// of quests want you to do"; "adding loitering without a camp needed would be a solution"): online the rest window
// opens on the act (REST1) and refused with no fire or bed, in a town's street, or under a building's own law - and
// there was no Loiter anywhere. Now every refusal offers Loiter, and so does the act's channel; the loiter is classic's
// whole arm (the hours prompt, loiterLimitHours, the loiter session - which recovers nothing and still rolls the hour's
// encounter). Offline nothing changes: no act, DFU's selection page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REST_CHANNEL_SECONDS, REST_ACT_TEXT } from '../../../src/systems/rest/restAct.js';
import { REST_TEXT, loiterLimitHours } from '../../../src/systems/rest/restSession.js';

/** The classic window over an online bag (an act), every call counted. */
async function classic(over = {}) {
  const { RestWindow } = await import('../../../src/ui/restWindow.js');
  const calls = { night: 0, advance: 0, vitals: 0, loitering: [], finished: 0, crime: 0, closed: 0 };
  const deps = {
    setResting() {}, setLoitering: (b) => calls.loitering.push(b), enemiesNearby: () => false, dead: () => false, fullyHealed: () => false,
    endLines: (id) => [`text ${id}`],
    advanceMinutes: () => { calls.advance++; }, tickQuests() {}, tickVitals: () => { calls.vitals++; return false; },
    restAct: () => ({ point: null, night: true, channelSeconds: REST_CHANNEL_SECONDS }),
    restNight: () => { calls.night++; return { textId: REST_TEXT.wakeUp, enemyBroke: false, died: false }; },
    onRestFinished: () => { calls.finished++; }, commitCrime: () => { calls.crime++; }, onClose: () => { calls.closed++; },
    ...over,
  };
  return { w: new RestWindow(deps), calls };
}
const type = (w, s) => { for (const ch of s) w.input(`char:${ch}`); };
/** Run a started session to its end on the window's own clock. */
const runOut = (w) => { for (let i = 0; i < 2000 && w.state === 'resting'; i++) w.tick(0.1); };

test('LOITER-ANYWHERE: no fire or bed - the refusal offers Loiter, and 3 is the loiter prompt, the session and the loiter\'s end', async () => {
  const { w, calls } = await classic();
  assert.equal(w.state, 'refused');
  assert.deepEqual(w.refusalLines, [REST_ACT_TEXT.noPoint]);
  assert.equal(w._loiterOffer, true);
  w.input('char:3');
  assert.deepEqual([w.state, w.mode], ['hours', 'loiter']);
  w.input('backspace'); type(w, '2'); w.input('confirm');
  assert.equal(w.state, 'resting');
  assert.deepEqual(calls.loitering, [true], 'IsLoitering raised, as classic\'s loiter prompt does');
  assert.equal(w.session.mode, 'loiter');
  runOut(w);
  assert.equal(w.state, 'ended');
  assert.deepEqual(w.endLines, [`text ${REST_TEXT.loiterDone}`], 'classic\'s loiter end (TEXT.RSC 349)');
  assert.equal(calls.advance, 12, 'two hours of the character\'s own clock, ten minutes a sub-tick');
  assert.equal(calls.night, 0, 'no night slept');
  assert.equal(calls.crime, 0, 'and loitering commits no crime');
});

test('LOITER-ANYWHERE: in a town\'s street the act refuses, and Loiter is still offered - DFU never gates a loiter', async () => {
  const { w } = await classic({ restAct: () => ({ point: { kind: 'camp', where: 'fire' }, night: true, channelSeconds: 6 }), restPlace: () => ({ inTownOutside: true, inTownLocation: true, insideBuilding: false }) });
  assert.deepEqual([w.state, w.refusalLines[0], w._loiterOffer], ['refused', REST_ACT_TEXT.inTown, true]);
  w.input('char:3');
  assert.equal(w.mode, 'loiter');
});

test('LOITER-ANYWHERE: at a fire the act holds - 3 in the channel turns it into a loiter, nothing slept', async () => {
  const { w, calls } = await classic({ restAct: () => ({ point: { kind: 'camp', where: 'fire' }, night: true, channelSeconds: 6 }) });
  assert.equal(w.state, 'channel');
  assert.match(w.actLines().join('\n'), /3 - loiter instead/);
  w.input('char:3');
  assert.deepEqual([w.state, w.mode], ['hours', 'loiter']);
  w.tick(10);
  assert.equal(calls.night, 0, 'the channel is over - its night never lands');
});

test('LOITER-ANYWHERE: online every way back lands on the refusal, never on the selection page (whose Rest would start a rest with no fire); over the limit is classic\'s refusal', async () => {
  const back = await classic();
  back.w.input('char:3'); back.w.input('back');
  assert.equal(back.w.state, 'refused', 'Back: the refusal again');
  back.w.input('char:3'); back.w.input('backspace'); back.w.input('confirm');
  assert.equal(back.w.state, 'refused', 'an empty Enter: the same');
  back.w.input('char:3'); back.w.input('backspace'); type(back.w, String(loiterLimitHours() + 1)); back.w.input('confirm');
  assert.equal(back.w.state, 'hoursRefused', 'over the loiter limit: classic\'s cannot-loiter lines');
  back.w.input('confirm');
  assert.equal(back.w.state, 'refused', '...whose OK lands on the refusal, Loiter still offered');
  back.w.input('back');
  assert.equal(back.w.done, true, 'any other key closes the refusal, as before');
  const held = await classic({ restAct: () => ({ point: { kind: 'camp', where: 'fire' }, night: true, channelSeconds: 6 }) });
  held.w.input('char:3'); held.w.input('back');
  assert.equal(held.w.done, true, 'from the channel there is no refusal to go back to: out');
});

test('LOITER-ANYWHERE: offline nothing moves - no act, DFU\'s selection page, its own Loiter', async () => {
  const { w } = await classic({ restAct: () => null });
  assert.deepEqual([w.state, w._loiterOffer], ['selection', false]);
  w.input('char:3'); w.input('back');
  assert.equal(w.state, 'selection');
});

// ─── THE ENHANCED CARD, UNDER A FAKE DOCUMENT (test/systems/rest/rest1_act.test.js's shape) ───────────────────────────────────
const mkEl = (tag) => ({
  tag, className: '', textContent: '', id: '', value: '', type: '', min: '', max: '', children: [], style: {}, attrs: {},
  setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; },
  append(...c) { this.children.push(...c); }, remove() {}, replaceChildren(...c) { this.children = c; },
  addEventListener() {}, removeEventListener() {}, focus() {},
  set innerHTML(v) { if (v === '') this.children = []; }, get innerHTML() { return ''; },
});
const buttons = (n, out = []) => { if (n.tag === 'button') out.push(n); for (const c of n.children ?? []) buttons(c, out); return out; };
const button = (host, label) => buttons(host).find((b) => b.textContent === label);
async function enhanced(over, fn) {
  const prev = [globalThis.document, globalThis.window, globalThis.requestAnimationFrame];
  globalThis.document = { createElement: mkEl, createTextNode: (t) => ({ text: t, className: '' }), getElementById: () => null, head: mkEl('head'), body: mkEl('body'), addEventListener() {}, removeEventListener() {}, pointerLockElement: null, exitPointerLock() {}, querySelector: () => null };
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.requestAnimationFrame = () => 0;
  try {
    const { mountEnhancedRest } = await import('../../../src/ui/enhanced/enhancedRest.js');
    const calls = { night: 0, advance: 0 };
    const deps = {
      setResting() {}, setLoitering() {}, enemiesNearby: () => false, dead: () => false, fullyHealed: () => false, endLines: (id) => [`text ${id}`],
      advanceMinutes: () => { calls.advance++; }, tickQuests() {}, tickVitals: () => false,
      restAct: () => ({ point: null, night: true, channelSeconds: 6 }),
      restNight: () => { calls.night++; return { textId: REST_TEXT.wakeUp, enemyBroke: false, died: false }; },
      ...over,
    };
    const host = mkEl('div');
    await fn({ overlay: mountEnhancedRest(host, deps), host, calls });
  } finally { [globalThis.document, globalThis.window, globalThis.requestAnimationFrame] = prev; }
}

test('LOITER-ANYWHERE: the enhanced card - the refusal has a Loiter button (and Cancel), which opens the loiter prompt; its Back is the refusal again', async () => {
  await enhanced({}, async ({ overlay, host, calls }) => {
    assert.equal(overlay.state, 'refused');
    assert.ok(button(host, 'Cancel'), 'OK reads Cancel beside an offer');
    button(host, 'Loiter').onclick();
    assert.deepEqual([overlay.state, overlay.mode], ['hours', 'loiter']);
    button(host, 'Back').onclick();
    assert.equal(overlay.state, 'refused');
    button(host, 'Loiter').onclick();
    overlay._hoursValue = '1';
    button(host, 'Start').onclick();
    assert.equal(overlay.state, 'resting');
    for (let i = 0; i < 500 && overlay.state === 'resting'; i++) overlay.tick(0.1);
    assert.equal(overlay.state, 'ended');
    assert.equal(calls.advance, 6, 'an hour of the character\'s own clock');
    assert.equal(calls.night, 0);
  });
});

test('LOITER-ANYWHERE: the enhanced channel card has Loiter Instead; a kneel at a candle does not', async () => {
  await enhanced({ restAct: () => ({ point: { kind: 'camp', where: 'fire' }, night: true, channelSeconds: 6 }) }, async ({ overlay, host, calls }) => {
    assert.equal(overlay.state, 'channel');
    button(host, 'Loiter Instead').onclick();
    assert.deepEqual([overlay.state, overlay.mode], ['hours', 'loiter']);
    overlay.tick(10);
    assert.equal(calls.night, 0);
  });
  await enhanced({ restAct: () => ({ point: { kind: 'candle', where: 'candle' }, night: false, meditate: true, channelSeconds: 6 }) }, async ({ overlay, host }) => {
    assert.equal(overlay.state, 'channel');
    assert.equal(button(host, 'Loiter Instead'), undefined);
  });
});

test('LOITER-ANYWHERE: offline the enhanced card is the selection card it always was, its Back the selection card', async () => {
  await enhanced({ restAct: () => null }, async ({ overlay, host }) => {
    assert.equal(overlay.state, 'selection');
    assert.ok(button(host, 'Loiter'));
    button(host, 'Loiter').onclick();
    button(host, 'Back').onclick();
    assert.equal(overlay.state, 'selection');
  });
});
