// @ts-check
// REST-CHANNEL-HEAL (2026-10-04, from play: "the loading bar you see also heals you so you dont wake up with 1% stamina
// bar ... when it gets canceled half way through"; "not only stamina all other magicka and health aswell"): the rest
// channel's bar raises health, fatigue and magicka as it fills, toward the rest's own yield, and keeps what it paid.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openChannelHeal, stepChannelHeal, channelHealTick, REST_ACT_TEXT } from '../../../src/systems/rest/restAct.js';
import { REST_TEXT } from '../../../src/systems/rest/restSession.js';
import { REST_KIND } from '../../../src/systems/survival/rest.js';
import { HARD_RULES, SURVIVAL_STORED } from '../../../src/systems/survival/difficulty.js';
import { SURVIVAL_PREF } from '../../../src/systems/survival/switch.js';
import { setPref, _resetForTests } from '../../../src/systems/uiPrefs.js';
import { setSharedClock, setOwnMinutes } from '../../../src/systems/worldTick.js';
import { maxFatigue } from '../../../src/systems/statMods.js';

afterEach(() => { setSharedClock(null); _resetForTests(); });
const vit = (e) => [e.health, e.fatigue, e.magicka];
const body = () => ({ health: 10, maxHealth: 50, fatigue: 100, magicka: 2, maxMagicka: 40 });
const mf = () => 500;
const wake = () => ({ textId: REST_TEXT.wakeUp, enemyBroke: false, died: false });

test('REST-CHANNEL-HEAL the law: whole-priced fills to full, half-priced to half of what was missing; never lowers, never past, nothing on a kneel or a bad share', () => {
  const e = body();
  const plan = openChannelHeal(e, REST_KIND.Camp, HARD_RULES, { maxFatigueOf: mf });
  assert.equal(stepChannelHeal(e, plan, 0.5), 30);
  assert.deepEqual(vit(e), [30, 300, 21]);
  stepChannelHeal(e, plan, 7);
  assert.deepEqual(vit(e), [50, 500, 40]);
  const h = body();
  const half = openChannelHeal(h, REST_KIND.Rough, HARD_RULES, { maxFatigueOf: mf });
  h.health = 25;   // a potion while holding
  stepChannelHeal(h, half, 0.5);
  assert.deepEqual(vit(h), [25, 200, 12], 'Hard rough at half the bar; the potion kept');
  stepChannelHeal(h, half, NaN);
  assert.deepEqual(vit(h), [25, 200, 12]);
  const asked = [];
  const deps = { restChannelHeal: (f) => { asked.push(f); return 33; } };
  assert.equal(channelHealTick({ channelSeconds: 6 }, deps, 3, 10), 33);
  assert.equal(channelHealTick({ meditate: true, channelSeconds: 6 }, deps, 3, 10), 10);
  assert.deepEqual(asked, [0.5]);
});

/** The host's own bag (createRestDeps), online, at a fire - and a rest skin over it. */
async function atTheFire({ kind = REST_KIND.Camp, tier = 'casual', skin = 'classic', over = {} } = {}) {
  const { createRestDeps } = await import('../../../src/scenes/shared.js');
  _resetForTests();
  setPref(SURVIVAL_PREF, SURVIVAL_STORED[tier]);
  setSharedClock(() => 5_000_000);
  setOwnMinutes(400_000);
  const e = { health: 6, maxHealth: 60, fatigue: 0, magicka: 0, maxMagicka: 30, stats: { endurance: 50, strength: 50, willpower: 50, agility: 50 }, skills: [], career: {}, activeEffects: [] };
  const calls = { night: 0 };
  let foes = false;
  const bag = createRestDeps(e, { restPoint: () => ({ kind, where: 'fire' }), restKind: () => kind, endLines: (id) => [`text ${id}`] });
  const deps = { ...bag, enemiesNearby: () => foes, restNight: () => { calls.night++; return wake(); }, restShort: wake, ...over };
  let w, host = null;
  if (skin === 'classic') w = new (await import('../../../src/ui/restWindow.js')).RestWindow(deps);
  else { host = mkEl('div'); w = (await import('../../../src/ui/enhanced/enhancedRest.js')).mountEnhancedRest(host, deps); }
  return { e, w, host, bag, calls, half: Math.round(maxFatigue(e) / 2), max: maxFatigue(e), foesComing: () => { foes = true; } };
}

test('REST-CHANNEL-HEAL classic: half the bar is half of all three, Esc keeps it; a foe at half keeps it too; held to its end the bar is full before the night', async () => {
  const a = await atTheFire();
  a.w.tick(3);
  assert.deepEqual(vit(a.e), [33, a.half, 15]);
  a.w.input('back'); a.w.keyup('back');
  assert.equal(a.w.done, true);
  assert.deepEqual(vit(a.e), [33, a.half, 15]);
  a.e.health = 6; a.bag.setResting(true); a.bag.restChannelHeal(1); a.bag.setResting(false);
  assert.equal(a.e.health, 6, 'a new rest is paid nothing on the last channel\'s plan');
  const b = await atTheFire();
  b.w.tick(3); b.foesComing(); b.w.tick(0.1);
  assert.deepEqual([b.w.endLines, vit(b.e), b.calls.night], [[`text ${REST_TEXT.enemiesNearby}`], [33, b.half, 15], 0]);
  const c = await atTheFire();
  for (let i = 0; i < 70 && c.w.state === 'channel'; i++) c.w.tick(0.1);
  assert.deepEqual([c.calls.night, vit(c.e)], [1, [60, c.max, 30]]);
});

test('REST-CHANNEL-HEAL classic: a blow after the bar healed past the open still breaks the hold; Hard rough fills to half; a kneel heals nothing', async () => {
  const a = await atTheFire();
  a.w.tick(3); a.e.health -= 5; a.w.tick(0.1);
  assert.deepEqual([a.w.endLines, a.e.health, a.calls.night], [[REST_ACT_TEXT.interrupted], 28, 0]);
  const r = await atTheFire({ kind: REST_KIND.Rough, tier: 'hard' });
  r.w.tick(6);
  assert.deepEqual(vit(r.e), [33, r.half, 15]);
  const k = await atTheFire({ over: { restAct: () => ({ point: { kind: 'candle', where: 'candle' }, night: false, meditate: true, channelSeconds: 6 }), restMeditate: wake } });
  k.w.tick(3);
  assert.deepEqual(vit(k.e), [6, 0, 0]);
});

const mkEl = (tag) => ({
  tag, className: '', textContent: '', id: '', value: '', type: '', min: '', max: '', children: [], style: {}, attrs: {},
  setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; },
  append(...c) { this.children.push(...c); }, remove() {}, replaceChildren(...c) { this.children = c; },
  addEventListener() {}, removeEventListener() {}, focus() {},
  set innerHTML(v) { if (v === '') this.children = []; }, get innerHTML() { return ''; },
});
const buttons = (n, out = []) => { if (n.tag === 'button') out.push(n); for (const c of n.children ?? []) buttons(c, out); return out; };

test('REST-CHANNEL-HEAL the enhanced card: half the bar heals half, Stop keeps it; a blow after healing still breaks', async () => {
  const prev = [globalThis.document, globalThis.window, globalThis.requestAnimationFrame];
  globalThis.document = /** @type {any} */ ({ createElement: mkEl, createTextNode: (t) => ({ text: t, className: '' }), getElementById: () => null, head: mkEl('head'), body: mkEl('body'), addEventListener() {}, removeEventListener() {}, pointerLockElement: null, exitPointerLock() {}, querySelector: () => null });
  globalThis.window = /** @type {any} */ ({ addEventListener() {}, removeEventListener() {} });
  globalThis.requestAnimationFrame = () => 0;
  try {
    const a = await atTheFire({ skin: 'enhanced' });
    a.w.tick(3);
    buttons(a.host).find((x) => x.textContent === 'Stop')?.onclick?.();
    assert.deepEqual([vit(a.e), a.calls.night], [[33, a.half, 15], 0]);
    const b = await atTheFire({ skin: 'enhanced' });
    b.w.tick(3); b.e.health -= 5; b.w.tick(0.1);
    assert.deepEqual([b.w.state, b.e.health, b.calls.night], ['ended', 28, 0]);
  } finally { [globalThis.document, globalThis.window, globalThis.requestAnimationFrame] = prev; }
});
