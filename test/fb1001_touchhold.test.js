// TOUCH-HOLD (2026-10-01 part four - Mac: "Interact button + knife Use", the audit's question answered). No Interact
// existed on a phone or in the pad's shipped layouts, and E is the professions' start and their hold: there a common
// herb (no tool picks it) could not be started, Hunting could not be started at all (the Skinning Knife had no Use) nor
// its line held, and the net's haul could not hold its band (299 of 300 seeded hauls slipped to a plain net). Now:
//   - THE TOUCH CORNER's third slot is Interact by default ('E', held while the finger is - ui/touchButtons.js), a choice
//     on the Touch card like any other;
//   - THE PAD: B is Interact in the world on the classic layer (systems/inputActions.js DEFAULT_SECONDARY_BINDINGS - Back
//     in a window still), LT under Enhanced Plus (ui/plusPad.js, layout 2 - Recast, which LT held, is the d-pad's right
//     held); the Controller bindings window has its row; the professions' prompts name the pad's button while it is in
//     hand (scenes/world.js actKeyWord);
//   - THE SKINNING KNIFE's Use from the hotbar or a quick slot is E at a body, and holds the knife - the line drawn with
//     no key held, as the Sickle's Use holds the steady hand (scenes/huntHost.js, systems/foragingInstall.js).
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { TOUCH_BUTTON_DEFAULTS, touchButtonChoices } from '../src/ui/touchButtons.js';
import { attachTouch } from '../src/ui/touch.js';
import { setBindings, held } from '../src/ui/input.js';
import { createBindings, setBinding, getBinding, resetDefaults } from '../src/systems/inputActions.js';
import { setPref, getPref, _resetForTests as resetPrefs } from '../src/systems/uiPrefs.js';
import { _resetForTests as resetSettings } from '../src/systems/settings.js';
import { attachGamepad } from '../src/ui/gamepadInput.js';
import { applyPlusPadLayout, ensurePlusPadLayout, plusDpadMap, PLUS_PAD_LAYOUT, PLUS_PAD_LAYOUT_VERSION } from '../src/ui/plusPad.js';
import { PLUS_BIND_ROWS } from '../src/ui/plusPadBinds.js';
import { installForaging, setForagingHost, professionToolLine, PROFESSION_TOOL_HOW } from '../src/systems/foragingInstall.js';
import { useItem, usableItem } from '../src/systems/useItem.js';
import * as qs from '../src/systems/quickslots.js';
import { createBodyStamps, bodiesOf, huntKind, KNIFE_HAND } from '../src/scenes/huntHost.js';
import { createGatherHost, aimAt } from '../src/scenes/gatherHost.js';
import { registerPlayerKillListener, reportPlayerKill } from '../src/systems/playerKills.js';
import { createProfHud } from '../src/ui/profHud.js';
import { createTraceAct } from '../src/systems/traceAct.js';
import { SKINNING_KNIFE } from '../src/net/professionLaw.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';

installForaging({ fetchBytes: async () => new Uint8Array(0) });
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ─── THE TOUCH CORNER ────────────────────────────────────────────────

function stubEl() {
  return {
    id: '', textContent: '', children: [], _l: new Map(), attrs: {},
    style: { cssText: '' },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(t, f) { if (!this._l.has(t)) this._l.set(t, []); this._l.get(t).push(f); },
    setAttribute(k, v) { this.attrs[k] = v; },
    remove() { this.removed = true; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
    fire(t, e) { for (const f of [...(this._l.get(t) ?? [])]) f(e); },
  };
}
const tev = (type, t) => ({ type, timeStamp: t, preventDefault() {}, stopPropagation() {}, changedTouches: [] });
/** test/touchbuttons.test.js's DOM: the keys the layer dispatches, recorded. */
function withTouchDom(fn) {
  const prev = { d: globalThis.document, w: globalThis.window, k: globalThis.KeyboardEvent };
  const keys = [];
  const live = [];
  globalThis.KeyboardEvent = class { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } };
  globalThis.document = { createElement: () => stubEl(), body: stubEl() };
  globalThis.window = { ontouchstart: null, dispatchEvent: (e) => { keys.push(e); return true; }, prompt: () => null };
  const attach = (canvas, hooks) => { const h = attachTouch(canvas, hooks); live.push(h); return h; };
  return Promise.resolve().then(() => fn(keys, attach)).finally(() => {
    for (const h of live) h?.dispose?.();
    globalThis.document = prev.d; globalThis.window = prev.w; globalThis.KeyboardEvent = prev.k;
    resetPrefs();
  });
}
const storeOf = (interact) => {
  const b = createBindings();
  for (const [c, a] of [['Escape', 'Escape'], ['KeyW', 'MoveForwards'], ['KeyS', 'MoveBackwards'], ['KeyA', 'MoveLeft'], ['KeyD', 'MoveRight'],
    ['Space', 'Jump'], ['ShiftLeft', 'Run'], ['KeyZ', 'ReadyWeapon'], [interact, 'Interact']]) setBinding(b, c, a);
  return b;
};
const live = (h) => h.el.children.filter((c) => !c.removed);
const btn = (h, label) => live(h).find((c) => c.textContent === label);
const codes = (keys, type) => keys.filter((e) => e.type === type).map((e) => e.code);

test('TOUCH-HOLD touch: the default corner draws Interact beside Jump and Ready Weapon; a finger on it holds the Interact action\'s live code to its lift, and a rebind moves it; the Touch card offers it (mutants: the third slot none; Interact a tap)', () => withTouchDom(async (keys, attach) => {
  assert.equal(TOUCH_BUTTON_DEFAULTS.touchButton3, 'Interact');
  assert.ok(touchButtonChoices().some(([id]) => id === 'Interact'), 'a choice on the Touch card, as any other');
  setBindings(storeOf('KeyE'));
  const h = attach(stubEl(), { look() {}, attack() {} });
  const e = btn(h, 'E');
  assert.ok(e && btn(h, '↑↑') && btn(h, 'Z'), 'three buttons by default: Jump, Ready Weapon, Interact');
  assert.equal(e.attrs['aria-label'], 'Interact (the use key)');
  e.fire('touchstart', tev('touchstart', 0));
  assert.deepEqual(codes(keys, 'keydown'), ['KeyE'], 'the Interact action\'s key, down');
  assert.deepEqual(codes(keys, 'keyup'), [], 'and held while the finger is - the steady hand, the knife\'s line, the haul');
  e.fire('touchend', tev('touchend', 2400));
  assert.deepEqual(codes(keys, 'keyup'), ['KeyE'], 'lifted with it');
  h.dispose();
  keys.length = 0;
  setBindings(storeOf('KeyG'));
  const g = attach(stubEl(), { look() {}, attack() {} });
  btn(g, 'E').fire('touchstart', tev('touchstart', 0));
  btn(g, 'E').fire('touchend', tev('touchend', 10));
  assert.deepEqual([codes(keys, 'keydown'), codes(keys, 'keyup')], [['KeyG'], ['KeyG']], 'rebound in Controls, the button presses what Interact is on');
}));

// ─── THE PAD ─────────────────────────────────────────────────────────

test('TOUCH-HOLD pad: on the classic layer B is Interact in the world - a fresh store and an old one\'s autofill carry the row, and B held is Interact held; in a window B is Back, as DFU\'s (mutants: no B row)', () => {
  const store = createBindings();
  resetDefaults(store);
  assert.equal(getBinding(store, 'Interact', false), 'JoystickButton1', 'a fresh store');
  const old = createBindings();
  resetDefaults(old);
  old.secondary.delete('JoystickButton1');   // a file written before this row
  resetDefaults(old, true);
  assert.equal(getBinding(old, 'Interact', false), 'JoystickButton1', 'the load\'s autofill gives an old file the row');
  setBindings(store);
  assert.equal(held(new Set(['JoystickButton1']), 'Interact'), true, 'B held is Interact held - the world\'s hosts read it so');
  assert.equal(getBinding(store, 'Interact'), 'KeyE', 'E stands beside it');
  // the poller on the classic skin: in the world B presses its code; in a window Back, as ever
  const hadWindow = 'window' in globalThis, prevWindow = globalThis.window;
  globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
  try {
    for (const overlay of [false, true]) {
      resetPrefs(); resetSettings();
      setPref('skin', 'classic');
      setBindings(store);
      const events = [];
      const canvas = { dispatchEvent: () => true, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), style: {} };
      const pad = { connected: true, mapping: 'standard', id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
      const gp = attachGamepad(canvas, { overlayActive: () => overlay, paused: () => overlay, attack() {}, look() {} },
        { getPads: () => [pad], dispatch: (type, code) => { events.push({ type, code }); }, makeEvent: (type, init) => ({ type, ...init }) });
      for (let i = 0; i < 3; i++) gp.tick(1 / 60);
      pad.buttons[1] = { pressed: true, value: 1 }; gp.tick(1 / 60);   // B
      const down = events.filter((e) => e.type === 'keydown').map((e) => e.code);
      pad.buttons[1] = { pressed: false, value: 0 }; gp.tick(1 / 60);
      gp.dispose();
      const up = events.filter((e) => e.type === 'keyup').map((e) => e.code);
      const expected = overlay ? getBinding(store, 'Escape') : 'JoystickButton1';
      // A window owns one Back gesture: raw B plus Escape advances two classic text messages.
      // In the world the original B code still holds Interact; release belongs to the same owner.
      assert.deepEqual(down, [expected], `one B owner (${overlay ? 'a window' : 'the world'})`);
      assert.deepEqual(up, [expected], 'the same owner receives exactly one release');
    }
  } finally {
    if (hadWindow) globalThis.window = prevWindow; else delete globalThis.window;
    resetPrefs(); resetSettings();
  }
});

test('TOUCH-HOLD Plus: layout 2 - LT is Interact: a store on layout 1 (LT Recast, B the pack) moves once - LT Interact, Recast off it, B the pack still; a player\'s own LT stands; the d-pad\'s right held is Recast; the bindings window has the row (mutants: LT Recast still; layout 1 never moved again)', () => {
  resetPrefs();
  try {
    assert.equal(PLUS_PAD_LAYOUT_VERSION, 2);
    assert.deepEqual(PLUS_PAD_LAYOUT.find(([c]) => c === 'JoystickAxis9Button0'), ['JoystickAxis9Button0', 'Interact']);
    const v1 = createBindings();
    resetDefaults(v1);
    applyPlusPadLayout(v1, { force: true });
    setBinding(v1, 'JoystickAxis9Button0', 'RecastSpell', false);   // layout 1's LT
    assert.equal(getBinding(v1, 'Interact', false) ?? null, null, 'layout 1: no pad Interact');
    setPref('plusPadLayout', 1);
    assert.equal(ensurePlusPadLayout(v1, { save: () => {} }), true, 'layout 1 moves again, once');
    assert.equal(v1.secondary.get('JoystickAxis9Button0'), 'Interact', 'LT is Interact');
    assert.equal(getBinding(v1, 'RecastSpell', false) ?? null, null, 'Recast off LT');
    assert.equal(v1.secondary.get('JoystickButton1'), 'Inventory', 'B the pack still - Back in a window');
    assert.equal(getPref('plusPadLayout'), 2);
    assert.equal(ensurePlusPadLayout(v1, { save: () => {} }), false, 'and only once');
    const own = createBindings();
    resetDefaults(own);
    applyPlusPadLayout(own, { force: true });
    setBinding(own, 'JoystickAxis9Button0', 'Sneak', false);   // the player's own LT
    setPref('plusPadLayout', 1);
    ensurePlusPadLayout(own, { save: () => {} });
    assert.equal(own.secondary.get('JoystickAxis9Button0'), 'Sneak', 'a row the player set themselves stands');
    const fresh = createBindings();
    resetDefaults(fresh);
    assert.equal(fresh.secondary.get('JoystickButton1'), 'Interact', 'the classic B row');
    applyPlusPadLayout(fresh);
    assert.deepEqual([fresh.secondary.get('JoystickButton1'), fresh.secondary.get('JoystickAxis9Button0')], ['Inventory', 'Interact'], 'under Plus B is the pack again and LT Interact');
    assert.deepEqual(plusDpadMap().right, { tap: 'Rest', hold: 'RecastSpell' }, 'Recast, the d-pad\'s right held');
    assert.ok(PLUS_BIND_ROWS.some((r) => r.sec === 'Interact'), 'the Controller bindings window binds it');
  } finally { resetPrefs(); }
});

test('TOUCH-HOLD prompts: with a pad in hand the professions\' prompts and lines name the pad\'s button, as the sea\'s readout names its own; else the key (mutants: the key named to a pad)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /const actKeyWord = \(action\) => \{\n\s*const padHeld = controllerLook\(\) \? padFamily\(\) : null;[^\n]*\n\s*const pad = padHeld \? getBinding\(bindings\(\), action, false\) : null;\n\s*if \(pad && \/\^Joystick\/\.test\(pad\)\) return hdGlyphName\(padHeld, pad\);\n\s*const c = getBinding\(bindings\(\), action\);\n\s*return c \? tagText\(c\) : null;\n\s*\};/);
  assert.match(w, /keyLabel: \(a\) => actKeyWord\(a\) \?\? '\?',/, 'the gathering host\'s prompt and meter');
  assert.match(w, /keyLabel: \(a\) => actKeyWord\(a\),[^\n]*\n\s*professionUse: /, 'the tools\' lines');
});

// ─── THE SKINNING KNIFE'S USE ────────────────────────────────────────

const WOODS = 231, GLENUMBRA = 59;
const NOON_MS = (20500 * 86_400 + 43_200) * 1000;
const WILDS = { inside: false, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 2, climate: WOODS, region: GLENUMBRA, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' };

/** A body felled by the player's own blow before them, the knife in the pack, the professions open online - the one
 *  gathering host with Hunting's kind (test/prof7_client.test.js's), its book a stand-in that records every harvest. */
function stage({ online = true, open = true } = {}) {
  globalThis.location = { search: online ? '?online=1' : '' };
  const S = { asked: [], said: [], prompt: null, meter: null, opts: null, label: null };
  S.knife = { templateIndex: SKINNING_KNIFE.templateIndex, name: SKINNING_KNIFE.name, currentCondition: 50, maxCondition: 50 };
  S.e = { stats: { intelligence: 60, agility: 60, strength: 55, endurance: 50, luck: 50 }, items: [S.knife], wagonItems: [] };
  const stamps = createBodyStamps({ nowMs: () => NOON_MS });
  registerPlayerKillListener('touchhold-test', (e) => { stamps.stamp(e); });
  const foes = [];
  const book = {
    state: { open: true, today: {}, hunt: { hides: 0, high: 0 }, caps: { stores: 5000 } },
    stale: () => false, refresh: async () => ({ ok: true }), pixel: () => null, askPixels: async () => [], pump: () => {},
    dungeon: () => null, askDungeon: async () => false, held: () => 0, taken: () => false, counting: () => false,
    track: () => ({ rank: 100, specs: { 50: null, 100: null } }),
    harvest: (h) => { S.asked.push(h); return new Promise(() => {}); },
  };
  const feet = [0, 0, 0];
  S.view = { yaw: 0, pitch: 0 };
  S.input = { held: false, attack: false, choice: false };
  const rad = Math.PI / 180;
  const eyePos = () => [feet[0], feet[1] + 1.6, feet[2]];
  S.host = createGatherHost({
    book, kinds: [huntKind({ book, bodies: () => bodiesOf(foes, stamps, (f) => f.corpseMarker?.pos ?? f.ai?.feet) })],
    hud: {
      setPrompt: (p) => { S.prompt = p; }, setMeter: (m, l, o) => { S.meter = m; S.label = l; S.opts = o ?? null; },
      toast: (t) => S.said.push(t), banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {},
    },
    renderer: { createBillboardBatch: () => ({}), destroyBatch: () => {} }, getTexture: async () => ({ recordCount: 99 }), uploadRecord: () => {},
    billboardSize: () => ({ w: 1, h: 1 }), flatBatchAabb: () => [0, 0, 0, 1, 1, 1], built: () => new Map(),
    pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; }, pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs: () => NOON_MS,
    eye: () => ({ pos: eyePos(), dir: [Math.sin(S.view.yaw * rad) * Math.cos(S.view.pitch * rad), Math.sin(S.view.pitch * rad), Math.cos(S.view.yaw * rad) * Math.cos(S.view.pitch * rad)] }),
    view: () => S.view, feet: () => feet, entity: () => S.e, keyLabel: (a) => (a === 'ActChoice' ? 'R' : 'E'), input: () => S.input, active: () => true,
  });
  setForagingHost({
    world: () => WILDS, monthValue: () => 5, entity: () => null, startQuest: () => true, professionsOpen: () => open,
    keyLabel: (a) => (a === 'Interact' ? 'E' : a === 'ActChoice' ? 'R' : null), professionUse: (t) => S.host.useTool(t),
  });
  /** A foe felled by the player's own blow, lying `at`. */
  S.kill = (mobileType, at) => {
    const f = { entity: { mobileType, name: 'foe' }, dead: false, corpse: false, ai: { feet: [...at] } };
    foes.push(f);
    reportPlayerKill(f.entity, { kind: 'melee' });
    f.dead = true; f.corpse = true; f.corpseMarker = { pos: [...at] };
    return f;
  };
  S.lookAt = (f) => {
    const p = f.corpseMarker.pos;
    const at = aimAt(eyePos(), [p[0], p[1] + 0.2, p[2]], { yaw: 0, pitch: 0 });
    S.view.yaw = -at.yaw; S.view.pitch = -at.pitch;
    return at;
  };
  /** The hotbar's press on the knife (hotbarPress -> the quick use door -> useQuickslot -> useItem, world.js's route). */
  S.hotbar = () => {
    qs.clearHotbar();
    qs.setHotbarSlot(0, qs.hotbarEntryForItem(S.knife));
    const said = [];
    const doors = { quickUse: (n) => { qs.useQuickslot(n === 1 ? 'c1' : 'c2', { entity: S.e, items: S.e.items, hooks: {}, say: (l) => said.push(l) }); return true; } };
    const res = qs.hotbarPress(0, { entity: S.e, doors, say: (l) => said.push(l) });
    qs.clearHotbar();
    return { kind: res.kind, said };
  };
  S.done = () => { registerPlayerKillListener('touchhold-test', null); S.host.dispose(); setForagingHost(null); qs.clearHotbar(); };
  return S;
}

test('TOUCH-HOLD knife: the Skinning Knife\'s Use from the hotbar at a body starts the skinning held by the Use - no key named, the knife in the hand; the line drawn by the look alone, no key held, skins it clean and wears the knife; PROF-MENU: the body\'s list offers the search beside it, and the Use skins (mutants: no Use; the Use not holding; the search taken by the Use)', () => {
  const s = stage();
  try {
    const bear = s.kill(MOBILE_TYPES.GrizzlyBear, [0, 0, 2.2]);
    s.lookAt(bear);
    s.host.tick(0.016);
    assert.equal(s.host.target?.node.kind, 'body');
    assert.deepEqual([s.prompt.verb, s.prompt.rest], ['Choose', 'Skin the Grizzly Bear / Search the Grizzly Bear'], 'PROF-MENU: no plaque - the choice E opens');
    assert.equal(usableItem(s.knife), true, 'the card offers Use');
    const r = s.hotbar();
    assert.equal(s.host.acting(), true, `the knife's Use started the skinning: ${JSON.stringify(r)} ${s.said}`);
    s.host.tick(0.001);
    assert.equal(s.meter?.state.kind, 'trace');
    assert.deepEqual([s.label, s.opts], ['', { byUse: true }], 'held by the Use: no key to name');
    assert.equal(s.host.handTool(), KNIFE_HAND, 'the knife in the hand');
    // the line, drawn by the look alone - nothing held
    const at0 = s.lookAt(bear);
    const pts = s.meter.state.points;
    for (let i = 0; i <= 40 && s.host.acting(); i++) {
      const u = (i / 40) * (pts.length - 1);
      const k = Math.min(pts.length - 2, Math.floor(u)), t = u - k;
      s.view.yaw = -at0.yaw + pts[k][0] + (pts[k + 1][0] - pts[k][0]) * t;
      s.view.pitch = -at0.pitch + pts[k][1] + (pts[k + 1][1] - pts[k][1]) * t;
      s.input = { held: false, attack: false, choice: false };
      s.host.tick(0.05);
    }
    assert.equal(s.host.acting(), false, 'drawn to the last point: done');
    assert.equal(s.asked.length, 1, 'the harvest asked');
    assert.deepEqual([s.asked[0].kind, s.asked[0].act.clean], ['hide', true], 'a hide, a clean pelt');
    assert.equal(s.knife.currentCondition, 49, 'the knife wears, as an act\'s tool does');
  } finally { s.done(); }
});

test('TOUCH-HOLD knife: away from a body the Use says where Hunting is done; offline, and with the professions shut, the knife has no Use (mutants: the line unsaid; the knife usable offline)', () => {
  const s = stage();
  try {
    assert.equal(professionToolLine(SKINNING_KNIFE.templateIndex), PROFESSION_TOOL_HOW[SKINNING_KNIFE.templateIndex]('E'));
    assert.match(professionToolLine(SKINNING_KNIFE.templateIndex), /^Hunting is done at a body your own blow felled: walk up to it until its acts show, then press E \(or use the Skinning Knife\)\.$/);   // PROF-MENU: its acts - the list, or the prompt
    const r = useItem(s.knife, s.e.items, { entity: s.e });
    assert.deepEqual([r?.kind, r?.refused, r?.text], ['foraging', true, professionToolLine(SKINNING_KNIFE.templateIndex)], 'no body: the way said');
    assert.equal(s.host.acting(), false);
  } finally { s.done(); }
  for (const [online, open] of [[false, true], [true, false]]) {
    const t = stage({ online, open });
    try {
      assert.equal(usableItem(t.knife), false, `${online ? 'online, shut' : 'offline'}: no Use on the card`);
      assert.equal(useItem(t.knife, t.e.items, { entity: t.e })?.kind === 'foraging', false, 'and a press of it is nothing of the professions\'');
    } finally { t.done(); }
  }
});

test('TOUCH-HOLD meter: a trace the knife\'s Use holds says aim and draw, never a key to hold; E\'s says its key (mutants: the Use\'s meter naming a key)', () => {
  const hud = createProfHud({ doc: document });
  try {
    const meter = () => document.body.querySelector('.prof-meter');
    hud.setMeter(createTraceAct({ tier: 1 }), '', { byUse: true });
    assert.match(meter().textContent, /aim the knife at the first point/);
    assert.doesNotMatch(meter().textContent, /hold/);
    hud.setMeter(createTraceAct({ tier: 1 }), 'LT');
    assert.match(meter().textContent, /hold LT on the first point/, 'a pad in hand: its button');
    const gentle = createTraceAct({ tier: 1, gentle: true });
    hud.setMeter(gentle, '', { byUse: true });
    assert.match(meter().textContent, /skinning\.\.\./);
  } finally { hud.dispose(); }
});
