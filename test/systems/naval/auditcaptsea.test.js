// AUDIT CAPTAIN'S SEA (2026-10-11, the owner: "Lets do a comprehensive audit, enaure this is insanely detailed and
// perfection. No exceptions") - the pre-merge audit of the naval update (#781: CAPT-CREW, CAPT-LOG, CAPT-PAY, CAPT-MARQUE,
// CAPT-WATERS, CAPT-BOARD, CAPT-TRADE, CAPT-CHARTS, SPYGLASS and the Eltheric Ocean's ETHER-* slices): nine lenses, each
// finding verified by a probe and pinned here, executed wherever a seam can be stood up. Ids: C the crew, G the Eltheric
// ground, X the crossing and the chart, D traffic, law and legends, L the ledger, the save and online, H the docs' and the
// tests' honesty, S the spyglass, P the isles' places in the world, B the board, the exchange and the charts.
// bible/01-Overview/audits/Audit-Captains-Sea.md; tools/mutants/auditcaptsea.json.
import '../../modsOff.js';
import { byClass } from '../../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KNOW, glassHolds, glassCard, cargoWords, handsWords, hullWord, merchantOfHull, RETICLE_DEG } from '../../../src/systems/naval/shipKnowledge.js';
import { classById, CROWNS, classLine } from '../../../src/systems/naval/navalShips.js';
import { etherShipNames, ISLES_FLAG } from '../../../src/systems/naval/etherShips.js';
import { NIGHT_DARK_SIGHT } from '../../../src/systems/naval/shipWatch.js';
import { DEEP_TIER } from '../../../src/systems/naval/navalDirector.js';
import { GLASS_AIM_LIFT } from '../../../src/scenes/naval/navalHost.js';
import { drawSpyglass, glassFootWords, spyglassTaps, nextGlassZoom } from '../../../src/ui/spyglassView.js';
import { drawNavalHud, destroyNavalHud } from '../../../src/ui/naval/navalHud.js';
import { helmPadPrompts } from '../../../src/ui/enhanced/enhancedHelm.js';
import { createBindings, resetDefaults, setBinding, getBinding, clearBinding, addRemovedPrimaryAction, serializeKeyBinds, loadKeyBinds } from '../../../src/systems/inputActions.js';
import { attachTouch } from '../../../src/ui/touch/touch.js';
import { attachGamepad, GLASS_PAD_ZOOM } from '../../../src/ui/gamepadInput.js';
import { applyPlusPadLayout, registerCrossbar, crossbarApi, setPlusDpad } from '../../../src/ui/plus/plusPad.js';
import { setBindings } from '../../../src/ui/input.js';
import { setPref, _resetForTests as resetPrefs } from '../../../src/systems/uiPrefs.js';
import { _resetForTests as resetSettings } from '../../../src/systems/settings/settings.js';
import { sea, knowAll } from '../../navalSea.mjs';
import { hostText } from '../../hostText.mjs';   // HOST-SPLIT 2: the world host whole

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const spawn = (s, cls, range, bearing = Math.PI / 2, o = {}) => s.host._sea.get(s.host.spawnShip(cls, { range, bearing, ...o }));
const tagOf = (s, e) => s.host.tags().find((t) => t.id === e.id) ?? null;
/** The glass laid on her hull's middle from the harness eye. */
const aimAt = (s, e) => { const o = s.view.look.origin; s.view.look = { origin: o, dir: [e.ship.pos[0] - o[0], e.ship.pos[1] + GLASS_AIM_LIFT - o[1], e.ship.pos[2] - o[2]] }; };
/** The glass up on her for `seconds`, the sea stepped with it (the world's order: the glass, then the frame). */
function hold(s, e, seconds, dt = 0.1, o = {}) {
  let card = null;
  for (let t = 0; t < seconds - 1e-9; t += dt) { if (e) aimAt(s, e); card = s.host.glass(dt, { up: true, ...o }); s.run(dt, dt); }
  return card;
}
/** The first seed whose wary pirate of `cls` flies false colours (and the crown she flies). */
async function deceiver(cls = 'pirateSloop') {
  const { falseFlagOf } = await import('../../../src/systems/naval/shipKnowledge.js');
  for (let seed = 1; ; seed++) { const f = falseFlagOf(classById(cls), seed, 'wary'); if (f) return { seed, flag: f }; }
}

// ── S: the spyglass ─────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT CAPTAIN\'S SEA S1/S15: the glass comes down at every door, load and move of the world and under a video - never carried into a cabin (its window, its lens slowing the look, the wheel and the head held indoors) (mutants: the gate\'s door, the gate\'s move, the clear\'s lowering, the lowering\'s parts, the video\'s)', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /&& !townTalk\.overlayActive && !travelView\?\.active && !naval\?\.aiming && !\(townTalk\.overlay instanceof DeathScreen\)\n\s+&& !modes\?\.transitioning && !worldMoveBusy\(\);/, 'never while a door builds or the world is moved');
  assert.match(w, /const navalClear = \(\) => \{ [^\n]*drawCrewLines\(\[\]\); lowerGlass\(\); \};/, 'every door\'s and load\'s clear lowers it');
  assert.match(w, /function lowerGlass\(\) \{\n\s+spyglass\.up = false;\n\s+spyglass\.lens = 1;\n\s+spyglass\.near = GLASS_NEAR_MIN;[^\n]*\n\s+glassDoorPress = false;\n\s+mwViewHoldFirst\(false\);\n\s+naval\?\.glass\?\.\(0, \{ up: false, zoom: spyglass\.zoom \}\);\n\s+drawSpyglass\(null\);\n\s+spyglassTaps\(\);\n\s+\}/);
  assert.match(w, /travelView\?\.exit\('video', true\); if \(spyglass\.up\) lowerGlass\(\); return; \}/, 'a video over the world');
  // and the glass's window, drawn down, keeps no press a finger made while it stood
  globalThis.document ??= undefined;
});

test('AUDIT CAPTAIN\'S SEA S2: the touch corner\'s Glass and a d-pad\'s Spyglass are the host\'s own door - never K, which is the road\'s follow too (a "Spyglass (aboard)" button followed the road ashore) (mutants: the corner\'s share door, the pad\'s share door, the world\'s answer)', async () => {
  // the finger
  const prev = { d: globalThis.document, w: globalThis.window, k: globalThis.KeyboardEvent };
  const keys = [];
  const stubEl = () => ({
    id: '', textContent: '', children: [], _l: new Map(), attrs: {}, style: { cssText: '' },
    appendChild(c) { this.children.push(c); return c; }, addEventListener(t, f) { if (!this._l.has(t)) this._l.set(t, []); this._l.get(t).push(f); },
    setAttribute(k, v) { this.attrs[k] = v; }, remove() { this.removed = true; }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
    fire(t, e) { for (const f of [...(this._l.get(t) ?? [])]) f(e); },
  });
  globalThis.KeyboardEvent = class { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } };
  globalThis.document = { createElement: () => stubEl(), body: stubEl() };
  globalThis.window = { ontouchstart: null, dispatchEvent: (e) => { keys.push(e); return true; }, prompt: () => null };
  const store = createBindings(); resetDefaults(store); setBindings(store);
  assert.equal(getBinding(store, 'Spyglass'), 'KeyK', 'a share on K');
  setPref('touchButton1', 'Spyglass');
  const asked = [];
  let h = null;
  try {
    h = attachTouch(stubEl(), { look() {}, padAction: (a) => { asked.push(a); return true; } });
    const glass = h.el.children.find((c) => !c.removed && c.textContent === 'Glass');
    assert.ok(glass, 'the corner\'s Glass');
    glass.fire('touchstart', { type: 'touchstart', timeStamp: 0, preventDefault() {}, stopPropagation() {}, changedTouches: [] });
    assert.deepEqual(asked, ['Spyglass'], 'the host\'s door');
    assert.deepEqual(keys.filter((e) => e.type === 'keydown').map((e) => e.code), [], 'and no K');
  } finally { h?.dispose?.(); globalThis.document = prev.d; globalThis.window = prev.w; globalThis.KeyboardEvent = prev.k; resetPrefs(); }
  // the pad's d-pad
  const prevW = globalThis.window;
  globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
  resetPrefs(); resetSettings();
  setPref('plusPadLayout', 0);
  const ps = createBindings(); resetDefaults(ps); applyPlusPadLayout(ps); setBindings(ps);
  const wasXb = crossbarApi();
  registerCrossbar({ inForce: () => true, press() {}, setActive() {} });
  const events = [], door = [];
  const pad = { connected: true, mapping: 'standard', id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  const canvas = { dispatchEvent() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), style: {} };
  const gp = attachGamepad(canvas, { overlayActive: () => false, paused: () => false, attack() {}, look() {}, padAction: (a) => { door.push(a); return true; } },
    { getPads: () => [pad], dispatch: (t, c) => events.push(`${t}:${c}`), makeEvent: (type, init) => ({ type, ...init }) });
  try {
    gp.tick(1 / 60);
    assert.equal(setPlusDpad('up', 'tap', 'Spyglass'), true);
    events.length = 0;
    pad.buttons[12] = { pressed: true, value: 1 }; gp.tick(1 / 60);
    pad.buttons[12] = { pressed: false, value: 0 }; gp.tick(1 / 60); gp.tick(1 / 60);
    assert.deepEqual(door, ['Spyglass'], 'the host\'s door');
    assert.ok(!events.includes('keydown:KeyK'), `and no K: ${events}`);
  } finally { gp.dispose(); registerCrossbar(wasXb); globalThis.window = prevW; resetPrefs(); }
  assert.match(hostText('src/scenes/world.js'), /if \(act === 'Spyglass'\) \{ glassDoorPress = true; return true; \}/, 'the world reads it as the glass\'s press');
});

test('AUDIT CAPTAIN\'S SEA S3: at a helm the d-pad press the player gave the glass is the glass\'s (the helm\'s own gesture on it yields, its prompts say so); the look stick\'s click turns the glass\'s magnification under a pad, a finger has Magnify and Lower; the foot names the pad\'s presses (mutants: the helm\'s pass, the click\'s zoom, the click kept from its action, the round, the prompts)', () => {
  const prevW = globalThis.window;
  globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
  resetPrefs(); resetSettings();
  setPref('plusPadLayout', 0);
  const ps = createBindings(); resetDefaults(ps); applyPlusPadLayout(ps); setBindings(ps);
  const wasXb = crossbarApi();
  registerCrossbar({ inForce: () => true, press() {}, setActive() {} });
  const events = [], door = [], gestures = [];
  let zooms = 0, up = false;
  const pad = { connected: true, mapping: 'standard', id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  const canvas = { dispatchEvent() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), style: {} };
  const gp = attachGamepad(canvas, {
    overlayActive: () => false, paused: () => false, attack() {}, look() {}, padAction: (a) => { door.push(a); return true; },
    helm: { up: () => true, gesture: (dir, kind) => { gestures.push(`${dir}:${kind}`); return false; }, prompts: () => null },
    glass: { up: () => up, zoom: () => { zooms++; } },
  }, { getPads: () => [pad], dispatch: (t, c) => events.push(`${t}:${c}`), makeEvent: (type, init) => ({ type, ...init }) });
  const tap = (i, frames = 1) => { pad.buttons[i] = { pressed: true, value: 1 }; for (let f = 0; f < frames; f++) gp.tick(1 / 60); pad.buttons[i] = { pressed: false, value: 0 }; gp.tick(1 / 60); gp.tick(1 / 60); };
  try {
    gp.tick(1 / 60);
    setPlusDpad('left', 'tap', 'Spyglass');
    tap(14);   // d-pad left, tapped at the helm
    assert.deepEqual([door, gestures], [['Spyglass'], []], 'the glass\'s - the helm\'s slower yields');
    tap(14, 40);   // held: still the helm's trim
    assert.deepEqual(gestures, ['left:hold'], 'its hold the helm\'s');
    tap(15);
    assert.deepEqual(gestures, ['left:hold', 'right:tap'], 'another direction the helm\'s');
    // the look stick's click: the glass's while it is up, its own action never pressed
    const r3 = 11;   // the standard mapping's right stick click - Unity's JoystickButton9
    events.length = 0;
    tap(r3);
    assert.equal(zooms, 0, 'the glass down: the click is its own');
    assert.ok(events.some((e) => e === `keydown:${GLASS_PAD_ZOOM}` || /^keydown:/.test(e)), `its action pressed: ${events}`);
    up = true; events.length = 0;
    tap(r3);
    assert.equal(zooms, 1, 'up: one turn of the glass');
    assert.deepEqual(events.filter((e) => e.startsWith('keydown')), [], 'and nothing else hears the click');
  } finally { gp.dispose(); registerCrossbar(wasXb); globalThis.window = prevW; resetPrefs(); }
  assert.equal(GLASS_PAD_ZOOM, 'JoystickButton9');
  assert.deepEqual([nextGlassZoom(2), nextGlassZoom(4), nextGlassZoom(8)], [4, 8, 2], 'x2, x4, x8, round');
  // the helm's prompts: its own words, the glass's press in its place
  const h = { hasSails: true, squareToggle: false, manualTrim: false, timeDial: true };
  assert.deepEqual(helmPadPrompts(h, { glass: [] }), helmPadPrompts(h), 'none chosen: as they were');
  assert.deepEqual(helmPadPrompts(h, { glass: [{ dir: 'left', kind: 'tap' }] }).map(([, w]) => w), ['Sails', 'Lanterns (hold: leave the helm)', 'Spyglass (hold: normal time)', 'Faster']);
  assert.deepEqual(helmPadPrompts({ ...h, timeDial: false, manualTrim: true }, { glass: [{ dir: 'down', kind: 'hold' }] }).map(([, w]) => w), ['Sails', 'Lanterns (hold: spyglass)', 'Trim (hold)', 'Trim (hold)']);
  // the foot
  assert.equal(glassFootWords({ zoom: 4, pad: true, keys: { glass: 'D-pad left', zoom: 'Right stick click' } }), 'x4 - Right stick click: magnify - D-pad left: lower the glass');
  assert.equal(glassFootWords({ zoom: 2, touch: true, keys: { glass: 'K' } }), 'x2', 'a finger\'s presses are the foot\'s buttons');
  const w = hostText('src/scenes/world.js');
  // PIN MOVED: GILDED2's merge of main (HOST-SPLIT) - glassPadWords left bootWorld whole for src/scenes/glassPad.js
  assert.match(rd('src/scenes/glassPad.js'), /if \(m\.tap === 'Spyglass'\) return hdGlyphName\(padHand, DPAD_CODES\[dir\]\);\n\s+if \(m\.hold === 'Spyglass'\) return `Hold \$\{hdGlyphName\(padHand, DPAD_CODES\[dir\]\)\}`;/, 'a d-pad press named');
  assert.match(w, /if \(taps\.zoom && spyglass\.up\) spyglass\.zoom = nextGlassZoom\(spyglass\.zoom\);/);
  assert.match(w, /glass: \{ up: \(\) => spyglass\.up, zoom: \(\) => \{ if \(spyglass\.up\) spyglass\.zoom = nextGlassZoom\(spyglass\.zoom\); \} \},/);
});

test('AUDIT CAPTAIN\'S SEA S4: the compass marks a ship by what I know - an unknown hull\'s, false colours\' and a ship I have made out\'s true stance (a red mark told friend from foe the card withheld) (mutants: the knowledge gate, the disguise gate)', async () => {
  const s = await sea({ hull: 2 });
  const p = spawn(s, 'pirateSloop', 800, Math.PI / 2, { temper: 'bold' });
  p.plain = true;
  s.run(0.2);
  const mark = () => s.host.compassShips().find((m) => Math.abs(m.x - p.ship.pos[0]) < 1e-6 && Math.abs(m.z - p.ship.pos[2]) < 1e-6)?.kind;
  assert.equal(p.known, KNOW.hull);
  assert.equal(mark(), 'ship', 'an unknown hull: no red');
  p.known = KNOW.colours;
  assert.equal(mark(), 'hostile', 'her colours made out: her stance');
  const { seed } = await deceiver();
  const q = spawn(s, 'pirateSloop', 600, 0, { temper: 'wary' });
  q.plain = false; q.ship.seed = seed; q.known = KNOW.colours;
  s.run(0.1);
  q.ship.provoked.set('local', Number.MAX_SAFE_INTEGER);   // she would take me for an enemy - her colours still a trader's
  const qm = s.host.compassShips().find((m) => Math.abs(m.x - q.ship.pos[0]) < 1e-6 && Math.abs(m.z - q.ship.pos[2]) < 1e-6)?.kind;
  assert.equal(qm, 'ship', 'false colours: a merchantman\'s mark');
  q.blackFlag = true;
  assert.equal(s.host.compassShips().find((m) => Math.abs(m.x - q.ship.pos[0]) < 1e-6 && Math.abs(m.z - q.ship.pos[2]) < 1e-6)?.kind, 'hostile', 'the black flag up: her stance');
});

test('AUDIT CAPTAIN\'S SEA S5/D5: under false colours she passes for the merchant of her own hull - named off her seed as that trader would be, lined as that class, flying the false crown\'s colours; past the Veil the Isles\' colours and an Isles name (a Bay crown\'s colours there, and "A merchantman of X" anywhere, were the tell) (mutants: the trader\'s class, the name, the line, the Veil\'s flag, the Veil\'s names)', async () => {
  const { seed, flag } = await deceiver();
  const s = await sea({ hull: 2 });
  const e = spawn(s, 'pirateSloop', 150, Math.PI / 2, { temper: 'wary' });
  e.plain = false; e.ship.seed = seed;
  s.run(1);
  const trader = merchantOfHull(e.ship.hull);
  assert.equal(trader.id, 'merchantCoaster', 'the sloop\'s trader');
  const t = tagOf(s, e);
  assert.notEqual(t.name, `A merchantman of ${flag}`);
  assert.equal(t.line, classLine(trader));
  const card = s.host.glass(0.1, { up: true });
  void card;
  // past the Veil
  const v = await sea({ hull: 2, where: { ether: { band: 'shallows', depth: 0.1 } } });
  const x = spawn(v, 'pirateSloop', 150, Math.PI / 2, { temper: 'wary' });
  x.plain = false; x.ship.seed = seed;
  v.run(1);
  const xt = tagOf(v, x);
  assert.equal(xt.name, etherShipNames(trader, seed).name, 'an Isles trader\'s name');
  aimAt(v, x);
  const xc = v.host.glass(0.1, { up: true });
  assert.ok(xc.rows.some(([l, w]) => l === 'Colours' && w === `${ISLES_FLAG}' merchant colors`), JSON.stringify(xc.rows));
  assert.ok(!CROWNS.some((c) => xc.rows.some(([, w]) => w.includes(c.name))), 'no Bay crown past the Veil');
});

test('AUDIT CAPTAIN\'S SEA S6: the glass holds only a ship an eye could find - by night within the night\'s sight of her, never one behind the land, never one half faded out of the sea (a dark sloop 1.5 km off at night was swept up, ranged and timed) (mutants: the night gate, the sight test, the fade gate)', async () => {
  const s = await sea({ hull: 2, where: { night: true } });
  const far = spawn(s, 'pirateSloop', 1500, Math.PI / 2, { temper: 'wary' });
  far.plain = true;
  s.run(0.2);
  assert.equal(hold(s, far, 0.3), null, 'a dark ship past NIGHT_DARK_SIGHT: nothing');
  const near = spawn(s, 'merchantCoaster', NIGHT_DARK_SIGHT - 40, 0);
  s.run(0.2);
  assert.ok(hold(s, near, 0.2), 'within it: held');
  // behind the land - the world's sight test
  const d = await sea({ hull: 2 });
  let blocked = true;
  d.deps.sightBlocked = (id) => blocked && id != null;
  const b = spawn(d, 'merchantCoaster', 500, Math.PI / 2);
  d.run(0.2);
  assert.equal(hold(d, b, 0.3), null, 'behind the land: nothing');
  blocked = false;
  assert.ok(hold(d, b, 0.3), 'in sight: held');
  // half faded out of the sea
  b.retiring = true; b.fade = 0.4;
  assert.equal(hold(d, b, 0.1), null, 'the sea has let her go');
  // the world's: its own sight cache, from the eye along the land's collider
  assert.match(hostText('src/scenes/world.js'), /sightBlocked: \(id, point\) => glassSight\.blocked\(player\.collider, \[cam\.pos\[0\] \+ _dwEyeOffset\[0\], cam\.pos\[1\] \+ _dwEyeOffset\[1\], cam\.pos\[2\] \+ _dwEyeOffset\[2\]\], id, point\),/);
});

test('AUDIT CAPTAIN\'S SEA S7: her guns out ON ME tell her colours - never a fight with another ship far off (a pirate at a merchantman 1.2 km away was made out by it) (mutants: the target gate)', async () => {
  const s = await sea({ hull: 2 });
  const m = spawn(s, 'merchantCoaster', 1200, Math.PI / 2);
  const p = spawn(s, 'pirateSloop', 1230, Math.PI / 2, { temper: 'bold' });
  p.plain = true;
  p.ship.target = m.id; p.ship.mode = 'engage'; p.ship.runOut.set('starboard', 1);
  s.run(0.1);
  p.ship.target = m.id; p.ship.mode = 'engage';
  s.host.glass(0.1, { up: false });
  s.run(0.1);
  assert.equal(p.known, KNOW.hull, 'her fight with another: nothing told');
});

test('AUDIT CAPTAIN\'S SEA S8/S9: the glass\'s head handed back true - the travel view taken under it reads the body the player stood in, a door\'s own POV (the map\'s head) keeps the head, a load decides alone; a save under it records the player\'s own camera (mutants: the view\'s release first, the map\'s claim, the save\'s camera, the load\'s forgetting)', async () => {
  const mv = await import('../../../src/player/mwView.js');
  const { eotbCamera } = await import('../../../src/player/eyeOfTheBeholder/eotbCamera.js');
  const { mwCamera } = await import('../../../src/player/mwCamera.js');
  const { setModSetting } = await import('../../../src/systems/modSettings.js');
  // the Morrowind lane: a save under the glass
  mwCamera.restore({ firstPerson: false, baseDistance: mwCamera.baseDistance() });
  assert.equal(mv.mwViewHoldFirst(true), true);
  assert.equal(mv.mwViewSaveCamera().firstPerson, false, 'the player\'s own: third person');
  mv.mwViewLoadPose({ firstPerson: true, baseDistance: mwCamera.baseDistance() });
  assert.equal(mv.mwViewHeldFirst(), false, 'a load forgets the glass\'s hold');
  mv.mwViewHoldFirst(false);
  mv.mwViewHoldFirst(true);
  mv.mwViewNewGame(false);
  assert.equal(mv.mwViewHeldFirst(), false, 'and a new game');
  mv.mwViewHoldFirst(false);
  setModSetting('eye-of-the-beholder', 'Enabled', true);
  mv.setEotbBodyReady(() => true);
  const third = () => eotbCamera.thirdPerson();
  try {
    if (third()) eotbCamera.toggleOffset(false);
    mv.mwViewTogglePerspective();
    assert.equal(third(), true, 'the player stands in third person');
    mv.mwViewHoldFirst(true);
    mv.mwViewHoldThird(true);   // the travel view under the glass
    assert.equal(mv.mwViewHeldFirst(), false, 'the glass\'s hold handed back first');
    mv.mwViewHoldFirst(false);
    mv.mwViewHoldThird(false);
    assert.equal(third(), true, 'the view down: the third person the player stood in');
    mv.mwViewHoldFirst(true);
    mv.mwViewFirstPerson();   // MAP-POV: the map read in the head
    mv.mwViewHoldFirst(false);   // the window up: the glass down
    assert.equal(third(), false, 'the map keeps the head');
  } finally { mv.mwViewHoldFirst(false); mv.mwViewHoldThird(false); mv.setEotbBodyReady(() => false); if (third()) eotbCamera.toggleOffset(false); setModSetting('eye-of-the-beholder', 'Enabled', false); }
  assert.match(rd('src/player/mwView.js'), /if \(heldFirst\?\.lane === 'eotb' && eotbCamera\.transitionDecides\(kind\)\) heldFirst\.changed = false;/, 'a door\'s POV row the same');
});

test('AUDIT CAPTAIN\'S SEA S10/S17: the glass\'s window is the world\'s strip - its centre the crosshair\'s over the docked bar, every length a share of the strip\'s shorter side; over the world\'s labels and under the HUD (mutants: the strip unread, the measure, the order)', () => {
  drawSpyglass({ card: null, zoom: 4 }, { rect: null });
  const [root] = byClass(globalThis.document.body, 'dfglass');
  const vars = {};
  root.style.setProperty = (k, v) => { vars[k] = v; };
  drawSpyglass({ card: null, zoom: 4 }, { rect: { x: 0, y: 0, w: 1920, h: 804 } });
  assert.deepEqual(['--g-x', '--g-y', '--g-w', '--g-h', '--g-m'].map((k) => vars[k]), ['0px', '0px', '1920px', '804px', '8.04px'], 'the strip over the docked bar');
  drawSpyglass({ card: null, zoom: 4 }, { rect: null });
  assert.equal(vars['--g-h'], '', 'none: the window\'s');
  drawSpyglass(null);
  const css = rd('src/ui/spyglassView.js');
  const sheet = css.slice(css.indexOf('const CSS = `'), css.indexOf('`;', css.indexOf('const CSS = `')));
  assert.deepEqual(sheet.match(/[\d.]*vmin/g), ['1vmin'], 'no length off the window but the measure\'s own fallback');
  assert.match(css, /\.dfglass \{ position: fixed; left: var\(--g-x, 0px\); top: var\(--g-y, 0px\); width: var\(--g-w, 100vw\); height: var\(--g-h, 100vh\);/);
  assert.match(css, /pointer-events: none; z-index: 4;/);
  assert.match(rd('src/ui/naval/navalHud.js'), /\.dfnaval-tags \{ position: fixed; inset: 0; pointer-events: none; z-index: 3;/);
  assert.match(rd('src/ui/wild/wildMarks.js'), /\.dfwild-marks \{ position: fixed; inset: 0; pointer-events: none; z-index: 3;/);
  assert.match(rd('src/ui/nameLayer.js'), /\.dfnames \{ position: fixed; inset: 0; z-index: 3;/);
  assert.match(hostText('src/scenes/world.js'), /rect: w > 0 && h > 0 \? worldRectPx\(worldViewportRect\(w, h\), w, h\) : null,/);
});

test('AUDIT CAPTAIN\'S SEA S11/S18/S22/S20: an unknown hull\'s glass title never red; never "about 1 hands"; the small ship\'s hull a two-master; her hold as it rides - her waters\' tiers, an emptied prize\'s none (mutants: the tone, each word, the hold\'s tiers, the emptied)', async () => {
  assert.equal(glassCard({ hull: 2, hostile: true, distance: 500, speed: 0 }, KNOW.hull).tone, 'unknown');
  assert.deepEqual([0, 1, 2, 3, 7, 12].map(handsWords), ['no hands', 'a hand', 'a hand or two', 'about 5 hands', 'about 5 hands', 'about 10 hands']);
  assert.equal(hullWord(2), 'two-master');
  assert.deepEqual([cargoWords(0), cargoWords(-1), cargoWords(1), cargoWords(9)], ['riding high - hold empty', 'riding high - hold empty', 'riding high, a light hold', 'riding deep, a rich hold']);
  const s = await sea({ hull: 2 });
  const e = spawn(s, 'merchantCoaster', 400, Math.PI / 2);
  s.run(0.2);
  e.known = KNOW.studied;
  aimAt(s, e);
  const holdRow = () => { aimAt(s, e); return s.host.glass(0.1, { up: true }).rows.find(([l]) => l === 'Hold')[1]; };
  assert.equal(holdRow(), cargoWords(e.ship.cls.cargo), 'her class\'s');
  e.deep = true;
  assert.equal(holdRow(), cargoWords(e.ship.cls.cargo + DEEP_TIER), 'the deep\'s tiers');
  e.prize = { hold: [] };
  assert.equal(holdRow(), 'riding high - hold empty', 'an emptied prize');
});

test('AUDIT CAPTAIN\'S SEA S12: see B5 (the Admiralty survey counts a ship once)', () => {});

test('AUDIT CAPTAIN\'S SEA S13: the keyboard\'s look slowed by the glass as the mouse\'s is (mutants: either axis)', () => {
  assert.match(hostText('src/scenes/world.js'), /if \(kb\.x \|\| kb\.y\) lookFilter\.add\(kb\.x \* keyboardLookRate\(\) \* dt \* glassLookScale\(spyglass\.lens\), kb\.y \* keyboardLookRate\(\) \* dt \* lookInvert\(\) \* glassLookScale\(spyglass\.lens\)\);/);
});

test('AUDIT CAPTAIN\'S SEA S14: a key file whose road follow left K (Travel Options\' O) loads with the glass seated on the free K - never on no key; a player\'s own unbinding stands (mutants: the free key\'s seat, the removed gate)', () => {
  const s = createBindings(); resetDefaults(s);
  setBinding(s, 'KeyO', 'FollowPaths');
  // an older build's file: no Spyglass anywhere in it
  const old = JSON.parse(JSON.stringify(serializeKeyBinds(s)));
  for (const d of [old.actionKeyBinds, old.secondaryActionKeyBinds]) for (const [k, v] of Object.entries(d ?? {})) if (v === 'Spyglass') delete d[k];
  if (old.sharedActionKeyBinds) for (const k of Object.keys(old.sharedActionKeyBinds)) old.sharedActionKeyBinds[k] = old.sharedActionKeyBinds[k].filter((x) => x !== 'Spyglass');
  const t = createBindings();
  loadKeyBinds(t, old);
  resetDefaults(t, true);
  assert.equal(getBinding(t, 'FollowPaths'), 'KeyO');
  assert.equal(getBinding(t, 'Spyglass'), 'KeyK', 'the glass on the free K');
  // the player's own unbinding stands
  const u = createBindings(); resetDefaults(u);
  setBinding(u, 'KeyO', 'FollowPaths');
  clearBinding(u, 'Spyglass');
  addRemovedPrimaryAction(u, 'Spyglass');
  resetDefaults(u, true);
  assert.equal(getBinding(u, 'Spyglass'), null, 'unbound by the player: unbound');
  // ...and where its partner still holds K, no share comes back over the player's own unbinding
  const v = createBindings(); resetDefaults(v);
  clearBinding(v, 'Spyglass');
  addRemovedPrimaryAction(v, 'Spyglass');
  resetDefaults(v, true);
  assert.deepEqual([getBinding(v, 'Spyglass'), getBinding(v, 'FollowPaths')], [null, 'KeyK'], 'the road\'s follow alone on K');
});

test('AUDIT CAPTAIN\'S SEA S16: a finger\'s glass has its own Magnify and Lower at its foot, wherever it is up (off the helm no Glass press stood) - each read once, none kept while it is down (mutants: the buttons unshown, the taps kept, the taps forgotten)', () => {
  drawSpyglass({ card: null, zoom: 4 }, { touch: true });
  const [root] = byClass(globalThis.document.body, 'dfglass');
  assert.equal(root.className, 'dfglass touch');
  const [zoom] = byClass(root, 'zoom');
  const [lower] = byClass(root, 'lower');
  assert.deepEqual([zoom.textContent, lower.textContent], ['Magnify', 'Lower']);
  for (const f of zoom.listeners.touchstart) f({ preventDefault() {}, stopPropagation() {} });
  for (const f of lower.listeners.touchstart) f({ preventDefault() {}, stopPropagation() {} });
  assert.deepEqual(spyglassTaps(), { zoom: true, lower: true });
  assert.deepEqual(spyglassTaps(), { zoom: false, lower: false }, 'read once');
  for (const f of zoom.listeners.touchstart) f({ preventDefault() {}, stopPropagation() {} });
  drawSpyglass(null);
  assert.deepEqual(spyglassTaps(), { zoom: false, lower: false }, 'a press made as it came down is no press');
  drawSpyglass({ card: null, zoom: 4 }, { touch: false });
  assert.equal(root.className, 'dfglass', 'no finger: no buttons');
  drawSpyglass(null);
  assert.match(hostText('src/scenes/world.js'), /const pressedNow = hccActionPressed\('Spyglass'\) \|\| navalTouchGlass\(\) \|\| glassDoorPress \|\| \(taps\.lower && spyglass\.up\);/);
});

test('AUDIT CAPTAIN\'S SEA S19: the glass holds her by her extent as she lies to the look - her beam bow-on, her length abeam - and never outside its own circle (a ship close aboard was held 20 degrees off the glass) (mutants: the aspect, the field\'s clamp)', async () => {
  assert.equal(glassHolds(0.3, 50, 30, 4), true, 'unclamped: wide');
  assert.equal(glassHolds(0.3, 50, 30, 4, 0.1), false, 'outside its circle: never');
  assert.equal(glassHolds((RETICLE_DEG * Math.PI / 180) / 4 - 1e-6, 5000, 1, 4, 0.5), true, 'the reticle\'s own reach');
  const s = await sea({ hull: 2 });
  const e = spawn(s, 'merchantGalleon', 60, Math.PI / 2);
  s.run(0.2);
  const o = s.view.look.origin;
  e.ship.yaw = Math.atan2(e.ship.pos[0] - o[0], e.ship.pos[2] - o[2]);   // bow-on to me
  const off = (deg) => { const a = Math.atan2(e.ship.pos[0] - o[0], e.ship.pos[2] - o[2]) + deg * Math.PI / 180; s.view.look = { origin: o, dir: [Math.sin(a), 0, Math.cos(a)] }; return s.host.glass(0.1, { up: true, zoom: 8 }); };
  assert.ok(off(0), 'on her');
  assert.equal(off(12), null, 'bow-on, 12 degrees off her: her beam is not there');
  e.ship.yaw += Math.PI / 2;   // abeam
  assert.ok(off(12), 'abeam: her length is');
  assert.equal(s.host.glass(0.1, { up: true, zoom: 8, field: 0.05 }), null, 'past the glass\'s own circle');
  void knowAll;
});

test('AUDIT CAPTAIN\'S SEA S21: the black flag said as she is known to me - the trader\'s name only while her colours held, her own once seen through; "is a pirate" said only where she is seen (mutants: the colours\' arm, the studied arm, the sight gate)', () => {
  const src = rd('src/scenes/naval/navalHost.js');
  assert.match(src, /deps\.say\?\.\(was === KNOW\.colours \? `False colors! \$\{disguiseOf\(e\)\?\.name \?\? 'The merchantman'\} runs up the black flag!` : was >= KNOW\.studied \? `\$\{s\.names\?\.name \?\? 'It'\} runs up the black flag!` : `\$\{withArticle\(hullWord\(s\.hull\)\)\} runs up the black flag!`, 4\);/);
  assert.match(src, /if \(held > 0 \|\| dist <= Math\.max\(reach\.eye, reach\.lookout\)\) deps\.mid\?\.\(`False colors! \$\{s\.names\?\.name \?\? 'It'\} is a pirate\.`, 4\);/);
});

test('AUDIT CAPTAIN\'S SEA S24: an unknown hull\'s hurts are no more read than her colours - GLASS-SPOT (PIN MOVED): she gives no card at all, where her card carried no bars; made out, her bar as her tag\'s (mutants: the HUD\'s)', async () => {
  const s = await sea({ hull: 2 });
  const e = spawn(s, 'merchantCoaster', 300, Math.PI / 2);
  s.run(0.2);
  e.ship.damage.restore({ hull: e.ship.damage.maxHull * 0.6, sail: e.ship.damage.maxSail, crew: e.ship.damage.maxCrew });
  const look = s.view.look;
  s.view.look = { origin: look.origin, dir: [e.ship.pos[0] - look.origin[0], 0, e.ship.pos[2] - look.origin[2]] };
  e.known = KNOW.hull;
  let card = s.host.hudModel().target;
  assert.equal(card, null, 'not made out: no card');
  e.known = KNOW.colours;
  card = s.host.hudModel().target;
  assert.ok(card.hull > 0 && card.hull < 1, `her bar: ${card.hull}`);
  // the HUD: no bars drawn for a card without them
  destroyNavalHud();
  const model = { ship: { name: 'Small Ship', hull: 1, sail: 1, crew: 1 }, armed: false, aiming: false, aim: null, board: null, boarding: null, batteries: [], notoriety: { crown: 'Wayrest', value: 0, level: 0 },
    target: { id: 'x', name: 'Unknown sloop', classLine: 'Sloop', faction: 'unknown', hull: null, sail: null, state: 'afloat', distance: 300, hostile: false, friendly: false, bound: '' } };
  drawNavalHud(model, {});
  const [card0] = byClass(globalThis.document.body, 'dfnaval-card');
  const [bar] = byClass(card0, 'hull');
  assert.equal(bar.style.display, 'none', 'no hull bar');
  drawNavalHud({ ...model, target: { ...model.target, hull: 0.6, sail: 1 } }, {});
  assert.equal(bar.style.display, '', 'made out: her bar');
  destroyNavalHud();
});

// ── G: the Eltheric ground ───────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT CAPTAIN\'S SEA G1/G10: the law answers its sea ETHER_MARGIN round the box - the far ring\'s whole reach from a ship in the box (its radius, its rebuild\'s drift, a normal\'s neighbour, the cliffs\' fade): built at the Veil over a world of land, the ring is all sea (four pixels drew the Bay\'s clamped row 0 as a ridge on the way home) (mutants: the margin)', async () => {
  const E = await import('../../../src/world/ethericSea.js');
  const { buildFarRingGrid, RING_RADIUS, RING_REBUILD_DRIFT } = await import('../../../src/render/farRing.js');
  const { CLIFF_REACH } = await import('../../../src/world/landforms.js');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  assert.ok(E.ETHER_MARGIN >= RING_RADIUS + RING_REBUILD_DRIFT + 1 + CLIFF_REACH, `${E.ETHER_MARGIN}`);
  const land = Object.create(WoodsFile.prototype);
  land.getHeightMapValue = () => 62; land.getLargeMapData = () => Array.from({ length: 5 }, () => new Uint8Array(5).fill(5));
  const woods = E.etherWoods(land);
  const { CLIMATES } = await import('../../../src/formats/mapsTables.js');
  for (const [bx, by] of [[E.ETHER_BOX.x1 - 1, E.veilhaven().py], [E.ETHER_BOX.x0, E.ETHER_BOX.y0], [E.ETHER_BOX.x1 - 1, E.ETHER_BOX.y1 - 1]]) {
    const g = buildFarRingGrid({ heightBytes: new Uint8Array(1000 * 500).fill(62), mapWidth: 1000, mapHeight: 500, climateAt: () => CLIMATES.Mountain, baseX: bx, baseY: by, relief: true,
      byteAt: (x, y) => woods.getHeightMapValue(x, y), climatePast: (x, y) => E.etherClimateIndex(() => CLIMATES.Mountain)(x, y), pastOwn: E.inEtherLaw });
    let land62 = 0;
    for (let j = 0; j < g.side; j++) for (let i = 0; i < g.side; i++) { const px = bx - RING_RADIUS + i, py = by - RING_RADIUS + j; if (!E.inEther(px, py) && !g.sea[j * g.side + i]) land62++; }
    assert.equal(land62, 0, `no land past the box on the ring at ${bx},${by}`);
  }
});

test('AUDIT CAPTAIN\'S SEA G2/P7: THE SWITCH SPLIT - the sea stands in every game (a save past the Veil loads under the classic skin and sails home), the crossing out the enhanced skin\'s and online\'s, `?ether=off` neither; a pixel the world does not stream lands at the way home (past the Veil) or the Bay\'s edge, said (mutants: each switch, the landing\'s arms, the way home\'s guard)', async () => {
  const { etherSeaOn, etherCrossOutOn } = await import('../../../src/scenes/shared.js');
  const { setPref, _resetForTests } = await import('../../../src/systems/uiPrefs.js');
  _resetForTests();
  setPref('uiSkin', 'classic');
  assert.equal(etherSeaOn('?skin=classic'), true, 'the classic skin: the sea stands');
  assert.equal(etherCrossOutOn('?skin=classic'), false, '...and its captain is never asked out');
  assert.equal(etherSeaOn('?ether=off'), false); assert.equal(etherCrossOutOn('?ether=off&online=1'), false);
  _resetForTests();
  const w = hostText('src/scenes/world.js');
  assert.match(w, /const etherOut = etherCrossOutOn\(\);/);
  assert.match(w, /if \(StreamingWorldState\.streams\(px, py\)\) return null;\n\s+const home = inEther\(px, py\) \? crossingTarget\('home', captainLedger\.crossedFrom\(\)\) : \{ px: Math\.max\(0, Math\.min\(999, Math\.floor\(px\) \|\| 0\)\), py: Math\.max\(0, Math\.min\(499, Math\.floor\(py\) \|\| 0\)\) \};/);
  assert.match(w, /_unstreamedLanding = inEther\(px, py\) \? 'ether' : 'edge';\n\s+return home;/);
  // the teleport's own resets first (AUDIT 39 #62, CLIMB-ARC F6), then the landing - before the helm's word reads `resolveArrival`
  const core = w.slice(w.indexOf('  async function _teleportToPixel('));
  const land = core.indexOf('    const unstreamed = _streamedLanding(px, py);\n    if (unstreamed) { px = unstreamed.px; py = unstreamed.py; localPos = null; resolveArrival = null; }');
  assert.ok(land > core.indexOf('climbFeel.reset();') && land < core.indexOf('if (modEvent == null && !resolveArrival) csaPreJump();') && land < core.indexOf('state.init(px, py)'), 'after the resets, before the helm and the build');
  assert.match(w, /if \(_unstreamedLanding\) \{\n\s+townTalk\.say\(_unstreamedLanding === 'ether' \? `\$\{ETHER_SEA_TITLE\} is closed\. You wake in the Bay's waters/);   // PIN MOVED (ELTHERIC): the sea's name its one home's
  const { crossingTarget } = await import('../../../src/systems/naval/etherCrossing.js');
  const { HOME_WATERS } = await import('../../../src/world/ethericSea.js');
  assert.deepEqual(crossingTarget('home', { px: 8000, py: -5000 }), { px: HOME_WATERS.px, py: HOME_WATERS.py }, 'never a way out in the sea itself');
  assert.deepEqual(crossingTarget('home', { px: 150, py: 300 }), { px: 150, py: 300 });
});

test('AUDIT CAPTAIN\'S SEA G3: the landforms\' lands past the Bay\'s table answer the Eltheric Ocean\'s own climates - an isle\'s hills never move with the Bay\'s corner pixel (999, 0), and wear its own climate\'s land (mutants: the law\'s arm, the node\'s climate)', async () => {
  const { hillsAt, landformClimates } = await import('../../../src/world/landforms.js');
  const { veilhaven, isleOfCell } = await import('../../../src/world/ethericSea.js');
  const { CLIMATES } = await import('../../../src/formats/mapsTables.js');
  const { HEIGHTMAP_DIMENSION } = await import('../../../src/world/terrain/terrainSampler.js');
  const a = landformClimates(() => CLIMATES.Mountain), b = landformClimates(() => CLIMATES.Mountain);
  b[999] = CLIMATES.Desert;   // the Bay's corner pixel, (999, 0)
  let wild = null; for (let cx = 700; cx < 800 && !wild; cx++) for (let cy = 240; cy < 260 && !wild; cy++) { const i = isleOfCell(cx, cy); if (i?.kind === 'wild' && i.peak >= 30) wild = i; }
  const span = HEIGHTMAP_DIMENSION - 1, swamp = landformClimates(() => CLIMATES.Swamp);
  // a land well over the knee (LANDFORM_KNEE 41.5 kernel units): under it every land's hills are none, and any two tables agree
  const MACRO = 100, LOW = 60;
  for (const isle of [veilhaven(), wild]) {
    let moved = 0, differs = 0, own = 0;
    for (let k = 0; k < 40; k++) {
      const gx = (isle.px + 0.5 + (k % 7) / 10) * span, gy = (500 + 0.5 - isle.py - Math.floor(k / 7) / 10) * span;
      const h = hillsAt(gx, gy, MACRO, LOW, null, a);
      if (h !== hillsAt(gx, gy, MACRO, LOW, null, b)) moved++;
      if (h !== hillsAt(gx, gy, MACRO, LOW, null, swamp)) differs++;
      if (h !== hillsAt(gx, gy, MACRO, LOW, null, null)) own++;
    }
    assert.equal(moved, 0, `${isle.name}: the Bay's corner moves nothing`);
    assert.equal(differs, 0, `${isle.name}: nor the Bay's whole table`);
    assert.equal(own, 40, `${isle.name}: the isle's own climate's land (${isle.climate}) - never the woodlands of no table`);
  }
  assert.ok(hillsAt((veilhaven().px + 0.5) * span, (500 + 0.5 - veilhaven().py) * span, MACRO, LOW, null, a) !== 0, 'hills to compare');
});

test('AUDIT CAPTAIN\'S SEA G4/G5/G6/G7/G8/G9/G14: the ring\'s climate past the map the continent\'s wherever it stands, the sea\'s in its law, the Bay edge\'s clamp else; the Overworld\'s water and its plates read the isles past the map; the ring\'s cliffs faded at their own pixel where the ground answers; Raiding Parties never at sea past the Veil; the mod\'s pick the Bay\'s alone; Masser\'s key leaned past the Veil (mutants: each seam)', async () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /climatePast: tamrielLand \? \(x, y\) => maps\.getClimateIndex\(x, y\)\n\s+: etherSea \? \(x, y\) => maps\.getClimateIndex\(\.\.\.\(inEtherLaw\(x, y\) \? \[x, y\] :/);
  assert.match(w, /pastOwn: tamrielLand \? null : inEtherLaw,/);
  const { etherWoods, inEtherLaw: lawOf } = await import('../../../src/world/ethericSea.js');
  assert.equal(etherWoods(Object.create(null)).etherLaw, lawOf, 'the composed ground answers by the law it composes by');
  // the Overworld's water law, lifted and run
  const line = w.match(/^ {2}const tvWater = \(px, py\) => [^\n]+$/m)?.[0];
  const { inEtherLaw } = await import('../../../src/world/ethericSea.js');
  const tvWaterOf = (woods) => new Function('woods', 'WATER_BYTE', `${line}\nreturn tvWater;`)(woods, 2);
  const sea = tvWaterOf({ etherLaw: inEtherLaw, getHeightMapValue: (x, y) => (x === 8068 && y === -5185 ? 6 : 0) });
  assert.equal(sea(8068, -5185), false, 'an isle past the map is land - the continent switched off');
  assert.equal(sea(8100, -5185), true, 'its sea the sea');
  assert.equal(tvWaterOf({ getHeightMapValue: () => 60 })(-1, 5), true, 'past the Bay with nothing composed: the sea, as ever');
  assert.match(w, /const ground = \(px\.x >= 0 && px\.y >= 0 && px\.x < 1000 && px\.y < 500\) \|\| !!woods\.isTamrielGround \|\| !!woods\.etherLaw\?\.\(px\.x, px\.y\);\n\s+const byte = ground \? woods\.getHeightMapValue\(px\.x, px\.y\) : 0;/);
  assert.match(w, /regionIndex: \(\) => \{ const px = playerTravelPixel\(\); return !\(etherSea && inEther\(px\.x, px\.y\)\) && politicClaimed\(/);
  assert.match(w, /if \(wod && onTheBay\(px, py\) && await wodOpened\) \{/);
  assert.match(w, /renderer\.setMoonlight\(moonNow && etherAirW \? \{ scale: moonNow\.scale, dir: moonNow\.dir, color: etherLight\(moonNow\.color, etherAirW, ETHER_KEY_TINT\) \} : moonNow\);/);
  // the ring's own-pixel fade: an isle node past the map faded by its own shore, never the clamped corner's
  const { buildFarRingGrid, RING_RADIUS } = await import('../../../src/render/farRing.js');
  const E = await import('../../../src/world/ethericSea.js');
  const { CLIMATES } = await import('../../../src/formats/mapsTables.js');
  let h = null; for (let cx = 600; cx < 800 && !h; cx++) for (let cy = 200; cy < 300 && !h; cy++) { const i = E.isleOfCell(cx, cy); if (i?.kind === 'wild' && i.peak >= 45) h = i; }   // a tall isle: a lift to fade
  const opts = { heightBytes: new Uint8Array(1000 * 500).fill(200), mapWidth: 1000, mapHeight: 500, climateAt: () => CLIMATES.Mountain, baseX: h.px, baseY: h.py, radius: 4, relief: true, byteAt: (x, y) => E.etherHeightByte(x, y) };
  const own = buildFarRingGrid({ ...opts, pastOwn: E.inEtherLaw }), clamped = buildFarRingGrid({ ...opts, pastOwn: () => false });
  const mid = (g) => g.positions[(4 * g.side + 4) * 3 + 1];
  const { ringHeight } = await import('../../../src/render/farRing.js');
  const { cliffFadeAt } = await import('../../../src/world/landforms.js');
  const want = ringHeight(E.etherHeightByte(h.px, h.py), true, cliffFadeAt((x, y) => E.etherHeightByte(x, y), h.px, h.py));
  assert.equal(mid(own), Math.fround(want), 'faded by its own shore');
  assert.notEqual(mid(clamped), mid(own), 'the clamped pixel\'s fade is another');
  void RING_RADIUS;
});

test('AUDIT CAPTAIN\'S SEA G12/D21/G11/G13: no compass point for no offset; a haunt under half a league is "hereabouts", one league a league (mutants: the zero, the near, the singular)', async () => {
  const { compassPoint, LEAGUE_PX } = await import('../../../src/world/ethericSea.js');
  const { rumourOf, legendById, hauntOf } = await import('../../../src/systems/naval/etherShips.js');
  assert.equal(compassPoint(0, 0), null); assert.equal(compassPoint(0, -0), null); assert.equal(compassPoint(0, -1), 'north');
  const l = legendById('queen'), h = hauntOf(l);
  assert.equal(rumourOf(l, { px: h.px + 1, py: h.py }), 'The Drowned Queen has been seen hereabouts.');
  assert.equal(rumourOf(l, { px: h.px, py: h.py + Math.round(LEAGUE_PX) }), 'The Drowned Queen has been seen some 1 league north of here.'.replace('some 1 league', 'some 1 league'));
  assert.match(rd('src/world/ethericSea.js'), /of fifty places charted, two share a name about one time in twenty/);
  assert.match(rd('src/world/ethericSea.js'), /Past the margin the law answers nothing: the sea is the box's, and past it nothing streams\./);
});

// ── H1, P: the isles' places in the world ───────────────────────────────────────────────────────────────────────────

test('AUDIT CAPTAIN\'S SEA H1/P2: every port isle has a harbour - its town whole on dry ground, its shore sounded within ETHER_HARBOUR_REACH through the kernel\'s own ground (an isle of two kilometres put the water past any harbour\'s reach, and no quay stood at any port of the sea) (mutants: the port\'s size, its land\'s centre, the reach)', async () => {
  const E = await import('../../../src/world/ethericSea.js');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { generateSamples, MAX_TERRAIN_HEIGHT, SCALED_OCEAN_ELEVATION, HEIGHTMAP_DIMENSION: D } = await import('../../../src/world/terrain/terrainSampler.js');
  const { findHarbour, HARBOUR_REACH } = await import('../../../src/systems/naval/shipLife.js');
  const { locationWorldRect } = await import('../../../src/world/streamingWorld.js');
  const sea0 = Object.create(WoodsFile.prototype); sea0.getHeightMapValue = () => 0; sea0.getLargeMapData = () => Array.from({ length: 5 }, () => new Uint8Array(5));
  const woods = E.etherWoods(sea0);
  const level = SCALED_OCEAN_ELEVATION / MAX_TERRAIN_HEIGHT, P = 819.2, cache = new Map();
  const samplesOf = (px, py) => { const k = `${px},${py}`; let s = cache.get(k); if (!s) { const g = generateSamples(woods, px, py, D, null); s = g.samples ?? g; cache.set(k, s); } return s; };
  const isWater = (x, z) => { const fx = x / P, fz = z / P, px = Math.floor(fx), zz = Math.floor(fz); return !(samplesOf(px, 499 - zz)[Math.round((fx - px) * (D - 1)) * D + Math.round((fz - zz) * (D - 1))] > level + 1e-6); };
  const rectOf = (isle, w, h) => { const r = locationWorldRect({ exterior: { exteriorData: { width: w, height: h, blockNames: ['X'] } } }, isle.px, isle.py); return { minX: r.minX / 40, maxX: r.maxX / 40, minZ: r.minZ / 40, maxZ: r.maxZ / 40 }; };
  const dry = (rect) => { for (let i = 0; i <= 6; i++) for (let k = 0; k <= 6; k++) if (isWater(rect.minX + (rect.maxX - rect.minX) * i / 6, rect.minZ + (rect.maxZ - rect.minZ) * k / 6)) return false; return true; };
  assert.equal(E.ETHER_HARBOUR_REACH, 900); assert.ok(E.ETHER_HARBOUR_REACH > HARBOUR_REACH);
  const { TOWN_BLOCKS } = await import('../../../src/world/etherPlaces.js');
  assert.deepEqual([TOWN_BLOCKS.port, TOWN_BLOCKS.haven], [[2, 6], [6, 12]], 'the towns cloned no wider than the ones measured dry below (P1: the game\'s hamlets of six to twelve)');
  const ports = [E.veilhaven()];
  for (let cy = 20; cy < 480 && ports.length < 7; cy += 61) for (let cx = 20; cx < 790 && ports.length < 7; cx += 13) { const i = E.isleOfCell(cx, cy); if (i?.kind === 'port' && !i.haven) ports.push(i); }
  // the widest towns each kind is cloned from, either way about (MAPS.BSA: a port's of 2x3 and 3x2 blocks at most, a
  // haven's of 4x3 and 3x4 - P1)
  for (const p of ports) {
    for (const [w, h] of p.haven ? [[4, 3], [3, 4]] : [[3, 2], [2, 3]]) {
      const rect = rectOf(p, w, h);
      assert.ok(dry(rect), `${p.name}: the town (${w}x${h}) on dry ground`);
      const hb = findHarbour({ rect, isWater, reach: E.ETHER_HARBOUR_REACH });
      assert.ok(hb?.berths?.length >= 2, `${p.name}: a harbour (${hb?.berths?.length ?? 0} berths)`);
    }
  }
  assert.equal(findHarbour({ rect: rectOf(E.veilhaven(), 4, 3), isWater }), null, 'the Bay\'s reach falls short of it - the isle\'s own is asked');
  const w = hostText('src/scenes/world.js');
  assert.match(w, /town = \{ id: `ether:\$\{isle\.key\}`, loc, x: isle\.px, y: isle\.py, name: isle\.name, reach: ETHER_HARBOUR_REACH \};/);
  // PIN MOVED (FB1020c HARBOUR-REACH): the book sounds the reach it is handed (its own, HARBOUR_REACH without one), and an
  // isle's own reach asks no farther (the port law's ring is a Bay port's - test/systems/naval/fb1020c_harbourreach.test.js)
  const book = rd('src/systems/naval/harbourBook.js');
  assert.match(book, /const own = near\.reach \?\? HARBOUR_REACH;\n\s+const sound = \(reach = own\) => findHarbour\(\{ rect: near\.rect, isWater: \(x, z, h\) => deps\.isWater\(x, z, h\), reach \}\);/);
  assert.match(book, /far = own === HARBOUR_REACH \? portRingReach\(near\.rect\) : 0;/);
  assert.match(w, /const reach = t\.reach \?\? HARBOUR_REACH;/, 'the lanes\' harbour feed sounds it as far');
});

test('AUDIT CAPTAIN\'S SEA P1 (the game\'s rows): Veilhaven\'s havens are the game\'s hamlets of six to twelve blocks - never none (MAPS.BSA\'s villages are 2 or 4 blocks, its cities 30 and more) (mutants: the types, the range)', { skip: !process.env.ARENA2_PATH && 'ARENA2_PATH not set' }, async () => {
  const { join } = await import('node:path');
  const { MapsFile } = await import('../../../src/formats/mapsFile.js');
  const { etherTemplates, TOWN_BLOCKS } = await import('../../../src/world/etherPlaces.js');
  const { LOCATION_TYPES } = await import('../../../src/formats/mapsFile.js');
  const bytes = (f) => new Uint8Array(readFileSync(join(process.env.ARENA2_PATH, f)));
  const maps = new MapsFile();
  maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const rows = [];
  for (let r = 0; r < maps.regionCount; r++) { const region = maps.getRegion(r); if (!region) continue; for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc?.exterior?.exteriorData) rows.push(loc); } }
  const t = etherTemplates(rows);
  assert.ok(t.havens.length > 100, `${t.havens.length} havens`);
  for (const l of t.havens) {
    const n = l.exterior.exteriorData.width * l.exterior.exteriorData.height;
    assert.ok(n >= 6 && n <= 12 && l.mapTableData.locationType === LOCATION_TYPES.TownHamlet, `${l.name}: a hamlet of ${n}`);
    assert.ok(Math.max(l.exterior.exteriorData.width, l.exterior.exteriorData.height) <= 4 && Math.min(l.exterior.exteriorData.width, l.exterior.exteriorData.height) <= 3, `${l.name}: within the 4x3 an isle was measured dry for (H1)`);
  }
});

test('AUDIT CAPTAIN\'S SEA P3/P12: an isle\'s place is never a spawn\'s template - a session that stood ruins past the Veil first cloned other templates than its party on every Bay pixel; its exterior names the isle\'s place in every id it carries - its record\'s header too (mutants: the filter, the exterior\'s ids)', async () => {
  const { spawnTemplates } = await import('../../../src/world/spawnedDungeons.js');
  const row = (id, o = {}) => ({ hasDungeon: true, dungeon: { blocks: [{}] }, exterior: { exteriorData: { width: 1, height: 1 } }, mapTableData: { mapId: id }, ...o });
  assert.deepEqual(spawnTemplates([row(1), row(2, { ether: '3,4' }), row(3)]).map((l) => l.mapTableData.mapId), [1, 3]);
  // P12: the exterior's every id the isle's place's (its template's named the Bay's town it was cloned from)
  const { synthesizeEtherLocation, etherPlaceId } = await import('../../../src/world/etherPlaces.js');
  const { veilhaven } = await import('../../../src/world/ethericSea.js');
  const tpl = { name: 'T', mapTableData: { mapId: 5 }, exterior: { exteriorData: { width: 2, height: 2, locationId: 5, mapId: 5 }, recordElement: { header: { locationId: 5, x: 1 } } } };
  const loc = synthesizeEtherLocation(tpl, veilhaven()), id = etherPlaceId(veilhaven());
  assert.deepEqual([loc.exterior.exteriorData.locationId, loc.exterior.exteriorData.mapId, loc.exterior.recordElement.header.locationId, loc.exterior.recordElement.header.x], [id, id, id, 1]);
  assert.deepEqual([tpl.exterior.exteriorData.locationId, tpl.exterior.recordElement.header.locationId], [5, 5], 'its template\'s untouched');
});

test('AUDIT CAPTAIN\'S SEA P4/P6/P8/P9/P10: a death past the Veil rises at the nearest port isle (never a Bay temple a crossing away) and no Bay cemetery takes a vampire there; no teleport crosses the Veil; an isle\'s quest site resolves by its region\'s own name; an isle town\'s house is no deed\'s and none is sold there; an isle\'s port is a port for ship boarding whatever Travel Options says (mutants: each seam)', async () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /else if \(etherSea && inEther\(px\.x, px\.y\)\) \{\n(?:\s*\/\/[^\n]*\n)*\s+const port = etherRisePort\(px\.x, px\.y\);\n\s+land = \{ x: port\.px, y: port\.py \}; kind = 'city';/);
  assert.match(w, /const etherRisePort = \(x, y\) => islesNear\(x, y, ETHER_RISE_PX\)\.find\(\(i\) => i\.kind === 'port'\) \?\? veilhaven\(\);/);
  const { islesNear, veilhaven, inEther } = await import('../../../src/world/ethericSea.js');
  const rise = islesNear(7900, -5300, 60).find((i) => i.kind === 'port') ?? veilhaven();
  assert.ok(rise.kind === 'port' && inEther(rise.px, rise.py), 'a port isle of the sea');
  assert.match(w, /if \(etherSea && inEther\(p\.x, p\.y\)\) \{ console\.warn\('\[infection\] past the Veil/);
  // the Veil's refusal, mounted and run
  const body = w.slice(w.indexOf('const veilRefused = (to = null) => {'), w.indexOf('\n  };\n', w.indexOf('const veilRefused = (to = null) => {')) + 4);
  const said = [];
  let here = { x: 8068, y: -5185 };
  const veilRefused = new Function('etherSea', 'playerTravelPixel', 'inEther', 'townTalk', `${body}\nreturn veilRefused;`)(true, () => here, inEther, { say: (t) => said.push(t) });
  assert.equal(veilRefused({ x: 200, y: 200 }), true, 'Recall home from the sea');
  assert.equal(veilRefused({ x: 7000, y: -5000 }), false, 'within the sea');
  assert.equal(veilRefused(), true, 'a teleport map past the Veil');
  here = { x: 200, y: 200 };
  assert.equal(veilRefused({ x: 8068, y: -5185 }), true, 'out to the sea from the Bay');
  assert.equal(veilRefused(), false, 'a teleport map in the Bay');
  assert.equal(said.length, 3);
  for (const door of ["wildTeleportRefused(plan.anchor?.pixel ?? null) || veilRefused(plan.anchor?.pixel ?? null)", 'wildTeleportRefused(pick.pixel) || veilRefused(pick.pixel)', 'wildTeleportRefused(pick.pixel ?? null) || veilRefused(pick.pixel ?? null)', 'if (veilRefused()) return null;', 'if (veilRefused()) return false;', 'if (veilRefused(pick.pixel)) return;']) assert.ok(w.includes(door), door);
  assert.match(w, /\?\? \(etherSea \? \[\.\.\.locationIndex\.values\(\)\]\.find\(\(l\) => l\?\.ether && l\.name === locationName && l\.regionName === regionName\) \?\? null : null\);/);
  assert.match(w, /regionName: REGION_NAMES\[ETHER_REGION\] \?\? ETHER_REGION_NAME/);
  const m = rd('src/scenes/worldModes.js');
  assert.match(m, /const houseOwnedAt = \(b, key\) => !isEtherPlaceId\(homeTownOf\(b\)\) && isHouseOwned\(playerEntity\.houses \?\? \[\], b\?\.regionIndex \?\? 0, key\);/);
  assert.equal((m.match(/isHouseOwned\(playerEntity\.houses \?\? \[\]/g) ?? []).length, 1, 'every town building through it');
  assert.match(m, /if \(isEtherPlaceId\(dir\.mapId\)\) return \[\];/);
  assert.match(w, /portTown: \(loc\.ether \? loc\.etherKind === 'port' : modSetting\('travel-options', 'Enabled'\) === true/);
});

test('AUDIT CAPTAIN\'S SEA P5: the Fleet never carries a ship across the Veil - no Summon to the far side, no Send away from it; laid up she keeps her side; past the Veil the nearest port is the sea\'s (mutants: the summon\'s, the away\'s, the side kept, the near port)', async () => {
  const { createFleetHost } = await import('../../../src/scenes/fleetHost.js');
  const F = await import('../../../src/systems/fleet.js');
  F._resetFleetForTests();
  F.knowShip(901, 2, 0, 1000);
  const boat = { uid: 901, hull: 2, variant: 0, crewed: true, GameObject: { activeSelf: false, position: [0, 0, 0] }, MapPixel: { X: 200, Y: 200 } };
  let apart = true;
  const host = createFleetHost({ csa: () => ({ AllBoats: [boat], isSailing: () => false, state: {}, LayUpBoat: () => true }), naval: () => null, pack: () => [], where: () => ({ inside: false, pixel: { X: 8068, Y: -5185 } }), nearPort: () => true, nearestPort: () => ({ name: 'Veilhaven', way: 'west', ether: true }), veilApart: () => apart });
  assert.deepEqual(host.act(901, 'summon'), { ok: false, text: 'This ship is on the other side of the Veil. Sail it across yourself.' });
  assert.deepEqual(host.act(901, 'away'), { ok: false, text: 'This ship is on the other side of the Veil. The crew won\'t take it across without you.' });
  apart = false;
  assert.equal(host.act(901, 'away').ok, true, 'on her own side, sent away');
  assert.deepEqual(F.fleetShip(901).port, { name: 'Veilhaven', ether: true }, 'laid up at the sea\'s port, her side kept');
  const saved = F.fleetSaveData();
  F._resetFleetForTests(); F.restoreFleetSaveData(saved);
  assert.deepEqual(F.fleetShip(901).port, { name: 'Veilhaven', ether: true }, 'and through the save');
  const w = hostText('src/scenes/world.js');
  assert.match(w, /veilApart: \(rec, boat\) => \{ const p = playerTravelPixel\(\); const hers = boat\?\.MapPixel \? inEther\(boat\.MapPixel\.X, boat\.MapPixel\.Y\) : !!rec\?\.port\?\.ether; return etherSea && inEther\(p\.x, p\.y\) !== hers; \},/);
  assert.match(w, /if \(etherSea && inEther\(here\.x, here\.y\)\) \{\n\s+const isle = etherRisePort\(here\.x, here\.y\);/);
  assert.match(w, /return \{ name: isle\.name, way: COMPASS_WAYS\[\(\(Math\.round\(turn\) % 8\) \+ 8\) % 8\], ether: true \};/, 'the sea\'s port says its side');
  assert.match(rd('src/scenes/fleetHost.js'), /setShipPort\(uid, near \? \{ name: near\.name, ether: !!near\.ether \} : null\);/, 'and the Fleet lays her up on it');
  F._resetFleetForTests();
});

// ── X: the crossing and the chart ───────────────────────────────────────────────────────────────────────────────────

/** world.js's crossing (crossGate .. etherCross, its own text) run over stand-ins: `w` the state they read, `log` what it
 *  asked of the world. */
async function crossingWorld(over = {}) {
  const ES = await import('../../../src/world/ethericSea.js');
  const EC = await import('../../../src/systems/naval/etherCrossing.js');
  const { createCaptainLedger } = await import('../../../src/systems/naval/captainLedger.js');
  const src = hostText('src/scenes/world.js');
  const text = src.slice(src.indexOf('  const crossGate = createCrossingGate();'), src.indexOf('  let _navalWasOn = null;'));
  const log = [];
  const w = { etherSea: true, etherOut: true, sailing: true, paused: false, loading: false, overlay: null, transitioning: false, mode: 'exterior', busy: false, arriving: false, px: 150, py: 300, hostile: false, passengers: 0, teleport: null, ...over };
  const ledger = createCaptainLedger();
  let boat = { name: 'boat', GameObject: { position: [10, 0, 20], rotation: [0, 0, 0, 1] } };
  const csaRuntime = {
    get state() { return { CurrentBoat: w.sailing ? boat : null }; },
    isSailing: () => w.sailing,
    StopSailing: () => { log.push('StopSailing'); w.sailing = false; },
    StartSailing: (b) => { log.push(`StartSailing(${b === boat ? 'boat' : 'other'})`); w.sailing = true; },
    RepositionBoat: (b, pos) => { log.push(`RepositionBoat(${pos.map((v) => Math.round(v)).join(',')})`); },
  };
  const townTalk = { get overlayActive() { return !!w.overlay && !w.overlay.done; }, say: (t) => log.push(`say: ${t}`), showOverlay: (o) => { w.overlay = o; log.push('asked'); } };
  class YesNoBoxWindow { constructor(o) { Object.assign(this, o); this.done = false; } answer(yes) { if (this.done) return; this.done = true; (yes ? this.onYes : this.onNo)?.(); } withdraw() { this.done = true; log.push('withdrawn'); } }
  const scope = {
    createCrossingGate: EC.createCrossingGate, CROSS_LAND_PX: ES.CROSS_LAND_PX, seaPixel: () => true,
    get etherSea() { return w.etherSea; }, get etherOut() { return w.etherOut; }, csaRuntime, CROSS_CHECK_S: EC.CROSS_CHECK_S,
    gamePaused: () => w.paused, get _loading() { return w.loading; }, townTalk, modes: { get transitioning() { return w.transitioning; } }, _mode: () => w.mode,
    worldMoveBusy: () => w.busy, get _partyArrivalPending() { return w.arriving; },
    playerTravelPixel: () => ({ x: w.px, y: w.py }), crossingWayAt: EC.crossingWayAt, CROSS_X: ES.CROSS_X, inEther: ES.inEther,
    navalHostileNear: () => w.hostile, CROSS_REFUSED: EC.CROSS_REFUSED, CROSS_STALE: EC.CROSS_STALE, CROSS_FAILED: EC.CROSS_FAILED, csaPassengersOn: () => w.passengers, YesNoBoxWindow,
    crossingRows: EC.crossingRows, captainLedger: ledger, crossingTarget: EC.crossingTarget, CROSS_DAYS: EC.CROSS_DAYS,
    hudFade: { smashHUDToBlack: () => log.push('black'), fadeHUDFromBlack: () => log.push('fade in') },
    csaCall: (fn) => fn(), cam: { yaw: 0 },
    _teleportToPixel: async (px, py, local, opts) => {
      log.push(`teleport(${px},${py})`);
      if (w.teleport) return w.teleport(px, py, opts);
      opts.resolveArrival?.([0, 0, 0]);
      w.px = px; w.py = py;
    },
    sharedClockOn: () => false, skyMinutes: () => 0, worldMinutes: () => 0,
    state: { localFromWorld: (x, z) => [x, z], worldCoords: (p) => ({ x: p[0], z: p[2] }) }, RAID_NATIVE_PIXEL: 32768, tvSeaY: () => 0,
    csaTerrainOf: () => null, csaPixelAt: () => null, setSyntheticTimeIncrease: () => {}, playerTicker: { advance: (m) => log.push(`advance ${m}`) },
    veilhaven: ES.veilhaven, setMidScreenText: () => log.push('crossed'), crossingWords: EC.crossingWords, captainSay: () => {}, console: { warn: () => {} },
  };
  const fns = new Function('scope', `with (scope) { let _etherCrossing = false;\n${text}\nreturn { etherCrossStep, etherCross, withdrawCrossing, crossGate }; }`)(scope);
  return { w, log, ledger, fns, boat0: boat, setBoat: (b) => { boat = b; }, step: (n = 1) => { for (let i = 0; i < n; i++) fns.etherCrossStep(EC.CROSS_CHECK_S); } };
}

test('AUDIT CAPTAIN\'S SEA X1/X3: a refusal said once in its waters, and the crossing asked as soon as the deck is clear (it never came back while she stayed in them); never asked while the world is being moved (mutants: the refusal\'s mark, the said-once, the move\'s gate)', async () => {
  const c = await crossingWorld({ hostile: true });
  c.step(6);
  assert.deepEqual(c.log, ['say: Not with an enemy at your heels.'], 'said once, not asked');
  c.w.hostile = false;
  c.step();
  assert.deepEqual(c.log.slice(1), ['asked'], 'the deck clear: asked');
  // waters left and come back to: said again there - once each time she is in them
  const e = await crossingWorld({ hostile: true });
  e.step(2); e.w.px = 240; e.step(2); e.w.px = 150; e.step(2);
  assert.deepEqual(e.log, ['say: Not with an enemy at your heels.', 'say: Not with an enemy at your heels.'], 'said again in waters come back to');
  const d = await crossingWorld({ busy: true });
  d.step(4);
  assert.deepEqual(d.log, [], 'the world being moved: nothing');
  d.w.busy = false; d.w.arriving = true; d.step();
  assert.deepEqual(d.log, [], 'a party member\'s helm through the arrival\'s wait: nothing');
});

test('AUDIT CAPTAIN\'S SEA X2/X9: Yes is the question as it stands NOW (a load, another helm, waters left, an enemy, a passenger: said, no voyage, asked afresh); the box is taken back at a load or a jump; a voyage that cannot be made brings ship and captain back where they set out, at the helm, the way out as it was (mutants: each of Yes\'s checks, the withdrawal, the way back)', async () => {
  const c = await crossingWorld();
  c.step();
  assert.deepEqual(c.log, ['asked']);
  c.w.px = 6068; c.w.py = -5178;   // a load: elsewhere (the sea itself)
  c.w.overlay.answer(true);
  assert.deepEqual(c.log.slice(1), [`say: ${(await import('../../../src/systems/naval/etherCrossing.js')).CROSS_STALE}`], 'no voyage from the stale question');
  assert.equal(c.ledger.crossedFrom(), null, 'and no way out kept');
  const { createCaptainLedger } = await import('../../../src/systems/naval/captainLedger.js');
  const kept = createCaptainLedger();
  kept.setCrossedFrom({ px: 8000, py: -5000 });
  assert.equal(kept.crossedFrom(), null, 'the sea itself is never kept as the way out');
  kept.restoreSaveData({ ...kept.getSaveData(), ether: { ...kept.getSaveData().ether, from: { px: 8000, py: -5000 } } });
  assert.equal(kept.crossedFrom(), null, 'nor read back from a save');
  c.w.px = 150; c.w.py = 300; c.step();
  assert.equal(c.log.at(-1), 'asked', 'asked afresh in its own waters');
  c.w.passengers = 1; c.w.overlay.answer(true);
  assert.match(c.log.at(-1), /Passengers can't cross the Veil/, 'a guest aboard since: refused');
  c.w.passengers = 0;
  // another helm, no helm, the world moving, a party's arrival: each a stale question
  const { CROSS_STALE } = await import('../../../src/systems/naval/etherCrossing.js');
  for (const [set, unset] of [[() => c.setBoat({ name: 'another', GameObject: { position: [0, 0, 0], rotation: [0, 0, 0, 1] } }), () => c.setBoat(c.boat0)],
    [() => { c.w.sailing = false; }, () => { c.w.sailing = true; }], [() => { c.w.busy = true; }, () => { c.w.busy = false; }], [() => { c.w.arriving = true; }, () => { c.w.arriving = false; }]]) {
    c.step();
    assert.equal(c.log.at(-1), 'asked');
    set(); c.w.overlay.answer(true); unset();
    assert.equal(c.log.at(-1), `say: ${CROSS_STALE}`);
  }
  c.step(); c.fns.withdrawCrossing();
  assert.equal(c.log.at(-1), 'withdrawn', 'taken back at a load or a jump');
  assert.match(hostText('src/scenes/world.js'), /const navalTransition = \(\) => \{ harbourBook\.clear\(\); navalClear\(\); withdrawCrossing\(\); \};/);
  // the way back
  const f = await crossingWorld({ teleport: async (px, py, opts) => { if (px !== 150) throw new Error('the landfall failed'); opts.resolveArrival?.([0, 0, 0]); f.w.px = px; f.w.py = py; } });
  f.ledger.setCrossedFrom({ px: 100, py: 290 });
  assert.equal(await f.fns.etherCross('out'), false);
  assert.deepEqual(f.log.filter((l) => !/^(black|fade in)$/.test(l)), ['StopSailing', 'teleport(8072,-5185)', 'teleport(150,300)', 'RepositionBoat(10,0,20)', 'StartSailing(boat)', `say: ${(await import('../../../src/systems/naval/etherCrossing.js')).CROSS_FAILED}`]);
  assert.deepEqual(f.ledger.crossedFrom(), { px: 100, py: 290 }, 'the way out as it was');
});

test('AUDIT CAPTAIN\'S SEA G2/X4: the crossing out asked only where it is this game\'s, and west of the Bay\'s mouth; home through the Veil under any skin (mutants: the out\'s switch, the mouth)', async () => {
  const c = await crossingWorld({ etherOut: false });
  c.step();
  assert.deepEqual(c.log, [], 'the classic skin: never asked out');
  const ES = await import('../../../src/world/ethericSea.js');
  c.w.px = ES.VEIL_X + 2; c.w.py = -5000; c.step();
  assert.deepEqual(c.log, ['asked'], 'but home through the Veil');
  assert.equal(ES.CROSS_X, 230);
  const d = await crossingWorld({ px: 240, py: 300 });
  d.step();
  assert.deepEqual(d.log, [], 'east of the mouth: the Bay itself');
});

test('AUDIT CAPTAIN\'S SEA X5/X10/X11/X17: no chart is sold past the charts\' room; a rumour\'s row carries no stray " - "; the legends heard where the harbourmaster\'s tab is shown; a name opening a sentence raised (mutants: the room, the join, the hearing, the capital)', async () => {
  const { createEtherHost } = await import('../../../src/scenes/etherHost.js');
  const { createCaptainLedger, ETHER_CHARTED_MAX } = await import('../../../src/systems/naval/captainLedger.js');
  const ES = await import('../../../src/world/ethericSea.js');
  const L = createCaptainLedger();
  let gold = 10000;
  const said = [];
  const host = createEtherHost({ ledger: L, day: () => 1, gold: () => gold, pay: (n) => { gold -= n; }, say: (t) => said.push(t) });
  for (let i = 0; L.charted().length < ETHER_CHARTED_MAX; i++) L.chartIsle(`cap,${i}`);
  const h = ES.veilhaven();
  const port = { px: h.px, py: h.py, ether: true, name: 'Veilhaven' };
  const o = host.chartOffer(port);
  assert.deepEqual([o.fresh, o.can, o.why], [0, false, 'Your charts can hold no more isles.']);
  assert.equal(host.buyChart(port).ok, false);
  assert.equal(gold, 10000, 'no gold taken for nothing');
  const heard = createCaptainLedger();
  const office = createEtherHost({ ledger: heard, day: () => 1 }).office(port);
  assert.deepEqual(heard.heard(), [], 'nothing heard by building the tab\'s model');
  office.hear();
  assert.equal(heard.heard().length, (await import('../../../src/systems/naval/etherShips.js')).LEGENDS.length, 'every legend heard when the tab is shown');
  const y = rd('src/ui/naval/navalYardWindow.js');
  assert.match(y, /b\.can \? b\.terms : \[b\.terms, b\.why\]\.filter\(Boolean\)\.join\(' - '\)/);
  assert.match(y, /const renderOffice = \(o\) => \{\n\s+o\.hear\?\.\(\);/);
  const { isleWords, capFirst } = await import('../../../src/ui/etherChartWindow.js');
  assert.equal(capFirst('the Sepulchre of Aelorrel'), 'The Sepulchre of Aelorrel');
  const ruin = { name: 'the Sepulchre of Aelorrel', kind: 'ruin', px: 0, py: 0 };
  assert.match(isleWords(ruin, { px: 0, py: 0 }), /^The Sepulchre of Aelorrel - a ruin - here$/);
  assert.match(rd('src/scenes/etherHost.js'), /Land ho! \$\{i\.name\.replace\(\/\^\.\/, \(c\) => c\.toUpperCase\(\)\)\}/);
});

test('AUDIT CAPTAIN\'S SEA X6/X7/X8/X12/X13/X14/X18: the chart under a finger and a pad - a pinch zooms, a tap names an isle, its own buttons zoom and find the ship; a drag ends however its press ends; the key that opened it shuts it; the bands named on their own side, the Shallows by the Veil; a haunt drawn the square it is; no name lettered over another; the wheel a step a notch (mutants: each)', async () => {
  const M = await import('../../../src/ui/etherChartWindow.js');
  const ES = await import('../../../src/world/ethericSea.js');
  const h = ES.veilhaven();
  // the labels: packed names at x8 never overlap (PIN MOVED, ETHER-CHART2: a name stands on its isle's east side or its
  // west - the model's own `box`, not a box re-derived east of the isle)
  const charted = ES.islesNear(h.px - 30, h.py, 30).map((i) => i.key);
  const m = M.chartModel({ px: h.px, py: h.py, charted, legends: [], stats: {} }, { cx: h.px - 30, cy: h.py, zoom: 3 }, 1000, 700);
  const boxes = m.isles.filter((i) => i.label).map((i) => i.box);
  for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
    const [p, q] = [boxes[a], boxes[b]];
    assert.ok(!(p[0] < q[2] && q[0] < p[2] && p[1] < q[3] && q[1] < p[3]), 'no two names over each other');
  }
  assert.ok(m.isles.some((i) => !i.label), 'a crowded chart leaves some unlettered');
  assert.ok(m.isles.filter((i) => i.kind === 'port').every((i) => i.label), 'every port lettered - placed first');
  // ports first: a port goes unlettered only under another port's name, never a lesser isle's (PIN MOVED, ETHER-CHART2:
  // on BOTH its sides - `labelBoxes` - each under a lettered port's own box)
  const over = (p, q) => p[0] < q[2] && q[0] < p[2] && p[1] < q[3] && q[1] < p[3];
  const mz = M.chartModel({ px: h.px, py: h.py, charted: ES.islesNear(h.px, h.py, 60).map((i) => i.key), legends: [], stats: {} }, { cx: h.px, cy: h.py, zoom: 0 }, 1000, 700);   // x1: x2 now letters every port of these waters on one side or the other
  const lettered = mz.isles.filter((i) => i.label);
  assert.ok(mz.isles.some((i) => i.kind === 'port' && !i.label), 'a view crowded with ports');
  for (const p of mz.isles.filter((i) => i.kind === 'port' && !i.label)) {
    for (const side of M.labelBoxes(p, M.capFirst(p.name).length * M.LABEL_CHAR_PX)) assert.ok(lettered.some((q) => q.kind === 'port' && over(side, q.box)), `${p.name}: unlettered under a port's name alone`);
  }
  // ...and the ports lettered are the ones a chart of its ports alone letters (at x8 off Veilhaven a wild isle's name, met
  // first in the chart's order, took a port's place)
  // PIN MOVED (ETHER-CHART2): and in the crowded waters seventy pixels west and thirty south, where - a name standing on
  // either side of its isle now - a lesser isle's name met first in the chart's order still takes a port's only place
  const letteredPorts = (mm) => mm.isles.filter((i) => i.kind === 'port' && i.label).map((i) => i.key).sort();
  for (const [dx, dy, reach] of [[0, 0, 45], [-70, 30, 60]]) {
    const near = ES.islesNear(h.px + dx, h.py + dy, reach);
    const at8 = (keys) => M.chartModel({ px: h.px, py: h.py, charted: keys, legends: [], stats: {} }, { cx: h.px + dx, cy: h.py + dy, zoom: 3 }, 1000, 700);
    assert.deepEqual(letteredPorts(at8(near.map((i) => i.key))), letteredPorts(at8(near.filter((i) => i.kind === 'port').map((i) => i.key))), 'the ports lettered as they would be with no lesser isle on the chart');
  }
  // the bands: the Shallows named by the Veil with no line of its own, every deeper band its bound
  const mv = M.chartModel({ px: ES.VEIL_X - 2, py: h.py, charted: [], legends: [], stats: {} }, { cx: ES.VEIL_X - 13 * ES.LEAGUE_PX, cy: h.py, zoom: 0 }, 1000, 700);
  assert.deepEqual(mv.bands.map((b) => [b.name, b.line]), [['the Shallows', false], ['the Reaches', true], ['the Deep Aether', true]]);
  // PIN MOVED (ETHER-CHART2, then AUDIT ETHER-CHART2 U2: the band names stand on the depth ruler over the chart): each
  // name lettered stands in its own water - west of its own bound, east of the next deeper band's
  const mb = M.chartModel({ px: h.px, py: h.py, charted: [], legends: [], stats: {} }, { cx: ES.VEIL_X - 30 * ES.LEAGUE_PX, cy: h.py, zoom: 1 }, 1000, 700);
  const named = mb.ruler.filter((seg) => seg.words && seg.id !== 'veil' && seg.id !== 'edge');
  assert.ok(named.length >= 2, 'names lettered in view');
  for (const seg of named) {
    const n = ES.BANDS.findIndex((b) => b.id === seg.id);
    const [east] = M.toScreen({ cx: ES.VEIL_X - 30 * ES.LEAGUE_PX, cy: h.py, zoom: 1 }, ES.VEIL_X - ES.BANDS[n].from * ES.LEAGUE_PX, 0, 1000, 700);
    const [west] = ES.BANDS[n + 1] ? M.toScreen({ cx: ES.VEIL_X - 30 * ES.LEAGUE_PX, cy: h.py, zoom: 1 }, ES.VEIL_X - ES.BANDS[n + 1].from * ES.LEAGUE_PX, 0, 1000, 700) : [-Infinity];
    const half = seg.words.length * M.LABEL_CHAR_PX / 2, mid = (seg.x0 + seg.x1) / 2;
    assert.ok(seg.x1 === Math.min(1000, east) && seg.x0 === Math.max(0, west), `${seg.id}: its water its own, bound to bound`);
    assert.ok(mid + half <= Math.min(1000, east) && mid - half >= Math.max(0, west), `${seg.id} on its deeper side of its own bound, in its own water`);
  }
  const src = rd('src/ui/etherChartWindow.js');
  assert.match(src, /if \(e\.pointerType === 'mouse' && e\.button !== 0\) return;/, 'the mouse\'s first button alone');
  assert.match(src, /if \(drag && e\.pointerType === 'mouse' && !\(e\.buttons & 1\)\) endDrag\(e\);/, 'no button held: no drag');
  assert.match(src, /canvas\.addEventListener\('lostpointercapture', endDrag\);/);
  assert.match(src, /canvas\.addEventListener\('contextmenu', \(e\) => e\.preventDefault\(\)\);/);
  assert.match(src, /const step = d \/ pinch\.d >= CHART_PINCH_STEP \? 1 : pinch\.d \/ d >= CHART_PINCH_STEP \? -1 : 0;/, 'the pinch');
  assert.match(src, /canvas\.addEventListener\('pointerup', \(e\) => \{ if \(drag && !drag\.moved && downs\.size === 1\) note\(\.\.\.local\(e\)\); endDrag\(e\); \}\);/, 'the tap');
  // PIN MOVED (L10N4, at the merge of main): the Ship press's word through the text core, its English as it was
  assert.match(src, /tool\('-', \(\) => zoomMid\(-1\)\); tool\('\+', \(\) => zoomMid\(1\)\); tool\(t\('sea\.chart\.ship', 'Ship'\), toShip\);/, 'its own presses');
  assert.match(src, /const acts = actionsForCode\(bindings\(\), e\.code\);\n\s+if \(overlayAction\(e\) === 'back' \|\| acts\.includes\('TravelMap'\) \|\| acts\.includes\('AutoMap'\)\)/, 'the key that opened it');
  assert.ok(!/e\.code === 'KeyM'/.test(src), 'no key of its own hard-coded');
  assert.match(src, /if \(Math\.abs\(wheelAcc\) < CHART_WHEEL_STEP\) return;/, 'the wheel gathered');
  assert.equal(M.CHART_WHEEL_STEP, 100);
  assert.match(src, /g\.strokeRect\(t\.x - t\.r, t\.y - t\.r, 2 \* t\.r, 2 \* t\.r\);/, 'a haunt a square');
});

test('AUDIT CAPTAIN\'S SEA X15/X16: the chart goes with the world it charts - shut at every load, jump and move (it stood over the Bay after a load); its arrow the ship\'s heading at the helm, never where the captain looks (mutants: the close, the boat\'s heading)', () => {
  const src = hostText('src/scenes/world.js');
  assert.match(src, /const navalClear = \(\) => \{[^\n]*closeNavalYard\(\); closeEtherChart\(\);/);
  const open = src.slice(src.indexOf('  function openEtherChart() {'), src.indexOf('  /** AUDIT NAV1 (the helm): the shipwright\'s window over the world'));
  const fwd = src.match(/ {2}const boatForward = \(boat\) => \{[\s\S]*?\n {2}\};\n/)[0];
  const seen = [];
  const w = { sailing: true, boat: { GameObject: { rotation: [0, Math.sin(Math.PI / 4), 0, Math.cos(Math.PI / 4)] } } };   // turned a quarter: her bow east
  const scope = {
    csaRuntime: { isSailing: () => w.sailing, get state() { return { CurrentBoat: w.boat }; } }, cam: { yaw: Math.PI },
    playerTravelPixel: () => ({ x: 6000, y: -5000 }), etherHost: { chart: (px, py, yaw) => { seen.push(yaw); return {}; } },
    createEtherChartOverlay: ({ word }) => { word(); return {}; }, townTalk: { showOverlay: () => {} },
  };
  const openEtherChart = new Function('scope', `with (scope) { ${fwd}\n${open}\nreturn openEtherChart; }`)(scope);
  assert.equal(openEtherChart(), true);
  assert.ok(Math.abs(seen[0] - Math.PI / 2) < 1e-9, `her bow's heading (east), not the camera's (south): ${seen[0]}`);
  w.sailing = false;
  openEtherChart();
  assert.equal(seen[1], Math.PI, 'off her helm, the captain\'s own facing');
});

// ── C: the crew ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT CAPTAIN\'S SEA C1: a companion back aboard while I sail works his post - her posts\' worth reads the one ashore set her deck, her card and her answering hand read (the party\'s raw roll left his post worth nothing at sea while he stood it on her deck); ashore with me, it is not worked (mutants: the one set, its sailing gate)', async () => {
  const s = await sea({ hull: 2 });
  s.boat.crewed = true;
  s.run(0.3);
  const st = s.host._myState(s.boat);
  const bosun = st.crew.hands.find((h) => h.role === 'Bosun');
  assert.ok(bosun, 'her Bosun');
  bosun.fights = 40;   // an Old Salt
  assert.ok(s.host.companions.take(42, bosun, 0), 'taken ashore');
  s.run(0.2);
  assert.ok(s.host.postsWay(s.boat) > 1.03, `at the helm he is aboard - her canvas his (${s.host.postsWay(s.boat)})`);
  assert.equal(s.host.awayOf(s.boat).size, 0, 'and none ashore on her Fleet page and card');
  s.runtime.sailing = false;
  s.run(0.2);
  assert.equal(s.host.postsWay(s.boat), 1, 'off her helm, ashore with me: no Bosun aboard');
  assert.ok(s.host.awayOf(s.boat).has(st.crew.hands.indexOf(bosun)), 'and said ashore');
});

test('AUDIT CAPTAIN\'S SEA C2: the Fleet page says a hand ashore with me so, and names the post\'s holder among those aboard - never the companion at my side with his post\'s worth (mutants: the ashore flag, the page\'s ashore set)', async () => {
  const { createFleetHost } = await import('../../../src/scenes/fleetHost.js');
  const { titleDeed, _resetFleetForTests } = await import('../../../src/systems/fleet.js');
  const { mintDeed } = await import('../../../src/systems/comeSailAway/comeSailAwayItems.js');
  const { scene, terrain } = await import('../../csaScene.mjs');
  const { drawFleetPage, resetFleetPage } = await import('../../../src/ui/fleetPage.js');
  const { setHoldingsProvider, _setHoldingsIconForTests } = await import('../../../src/ui/holdingsPages.js');
  _resetFleetForTests();
  const s = scene({ terrains: [terrain(10, 20)] });
  s.deps.items = { create: () => null, addToPlayer: () => {}, player: () => [], titles: () => [] };
  const hands = [
    { name: 'Ann Mate', role: 'First Mate', mobile: 144, fights: 0, boardings: 0 },
    { name: 'Old Gil', role: 'Gunner', mobile: 144, fights: 40, boardings: 0 },
    { name: 'Young Tam', role: 'Gunner', mobile: 144, fights: 0, boardings: 0 },
  ];
  const naval = {
    fleetStatus: () => ({ hull: 1, maxHull: 1, sail: 1, maxSail: 1, crew: 60, maxCrew: 60, wants: false, fire: false, stores: 0, inFight: false }),
    hostileNear: () => false, freeBerth: () => null, boatInPlay: () => null, crewHands: () => hands.map((h) => ({ ...h })), awayOf: () => new Set([1]),
  };
  const host = createFleetHost({ csa: () => s.rt, naval: () => naval, pack: () => [], where: () => ({ inside: false, pixel: { X: 10, Y: 20 }, feet: [0, 0, 0] }), nearPort: () => true });
  titleDeed(mintDeed(2, 0, 5, 1));
  assert.deepEqual(host.model().ships[0].hands.map((h) => h.ashore), [false, true, false]);
  _setHoldingsIconForTests(() => ({ src: 'data:x', w: 30, h: 30 }));
  const fake = (tag) => {
    const classes = new Set();
    const n = { tag, children: [], attrs: {}, value: '', title: '', selected: false, isConnected: true,
      classList: { contains: (c) => classes.has(c), add: (c) => classes.add(c) },
      set className(v) { classes.clear(); String(v ?? '').split(/\s+/).filter(Boolean).forEach((x) => classes.add(x)); }, get className() { return [...classes].join(' '); },
      _t: '', get textContent() { return n._t + n.children.map((c) => c.textContent).join(''); }, set textContent(v) { n._t = String(v ?? ''); },
      append(...cs) { n.children.push(...cs); }, setAttribute(k, v) { n.attrs[k] = v; } };
    return n;
  };
  const el = (t, c, x) => { const n = fake(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
  const all = (root, pred) => { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (pred(c)) out.push(c); walk(c); } }; walk(root); return out; };
  setHoldingsProvider({ fleet: { model: () => host.model(), offer: (u) => host.offer(u), act: (u, v, a) => host.act(u, v, a) } });
  resetFleetPage();
  const draw = () => { const d = el('div'); drawFleetPage(d, () => {}, { el, divider: (t) => el('h4', null, t), meter: () => el('div') }); return d; };
  all(draw(), (c) => c.tag === 'button' && c.textContent === 'Crew')[0].onclick();
  const lines = all(draw(), (c) => c.className === 'hld-sub').map((c) => c.textContent);
  assert.ok(lines.includes('Old Salt - 40 fights won - ashore with you'), `ashore, said so, his post's worth unsaid: ${lines.join(' | ')}`);
  assert.ok(lines.some((l) => /^Green - the guns reload/.test(l)), 'the Green gunner aboard holds the guns');
  setHoldingsProvider(null);
});

test('AUDIT CAPTAIN\'S SEA C3/C4: hands come Seasoned where they sign on in a Commodore\'s harbour - the Fleet page\'s muster too (a laid-up ship\'s hands signed on Green) - and only in one: never men pressed at sea in that crown\'s waters (mutants: the page\'s muster\'s service, the harbour\'s gate)', async () => {
  const { SEASONED_HIRE } = await import('../../../src/systems/naval/shipCrew.js');
  const s = await sea({ hull: 2 });
  s.boat.crewed = true;
  s.deps.captain = { seasonedHires: () => true };
  const hands = s.host.crewHands(s.boat);
  assert.ok(hands.length > 1 && hands.every((h) => h.prior === SEASONED_HIRE && h.fights === 0), 'the page\'s muster asks where they sign on');
  assert.match(hostText('src/scenes/world.js'), /seasonedHires: \(\) => \{ const port = navalPortHere\(\); return !!port && harbourOffice\.perksAt\(port\.crown\)\.seasoned; \},/, 'a harbour of a crown that favours me');
  const { createHarbourOffice } = await import('../../../src/scenes/harbourOffice.js');
  const { createCaptainLedger } = await import('../../../src/systems/naval/captainLedger.js');
  assert.equal(createHarbourOffice({ ledger: createCaptainLedger() }).perksAt(null).seasoned, false, 'no crown (an isle\'s freeport): none');
});

test('AUDIT CAPTAIN\'S SEA C5: her First Mate\'s hands over the rail are men she has - never past her crew\'s hands and the spirits\' one (a Small Ship\'s six men stood four; the phantoms\' falls took her real crew, her First Mate with them) (mutants: the men\'s cap)', async () => {
  const { handsOf, CREW_PER_HAND } = await import('../../../src/systems/naval/navalBoarding.js');
  const { handsBonusOf, CREW_ORDERS } = await import('../../../src/systems/naval/shipCrew.js');
  const body = rd('src/scenes/naval/navalHost.js').match(/\n {2}function myHands\(boat, st\) \{\n[\s\S]*?\n {2}\}\n/)[0];
  const myHands = new Function('handsOf', 'handsBonusOf', 'CREW_PER_HAND', `${body}\nreturn myHands;`)(handsOf, handsBonusOf, CREW_PER_HAND);
  const st = (crew, mate, morale = 100, order = CREW_ORDERS.rail) => ({ damage: { crew }, crew: { morale, order }, worth: { hands: mate } });
  assert.equal(myHands({ crewed: true }, st(6, 2)), 2, 'six men: her one hand and the spirits\' one');
  assert.equal(myHands({ crewed: true }, st(24, 2)), 5, 'four hands\' men: the four and the spirits\' one');
  assert.equal(myHands({ crewed: true }, st(60, 2)), 7, 'a full deck: her Old Salt mate\'s two past the four and one');
  assert.equal(myHands({ crewed: true }, st(60, 0, 60, null)), 4);
  assert.equal(myHands({ crewed: true }, st(3, 2)), 0, 'no hand\'s men: none');
});

test('AUDIT CAPTAIN\'S SEA C7: a hand who joins takes the post held by the fewest - a fallen or reassigned hand\'s post filled first, never a third Bosun while her Cook\'s stands empty; a whole roster dealt as it always was (mutants: the count, the order)', async () => {
  const { createShipCrew, FIRST_MATE } = await import('../../../src/systems/naval/shipCrew.js');
  const roster = (n) => Array.from({ length: n }, () => ({ mobile: 144, gender: 'male' }));
  const c = createShipCrew({ seed: 3 });
  c.sync(roster(14));
  assert.deepEqual(c.hands.map((h) => h.role), [FIRST_MATE, 'Bosun', 'Gunner', 'Carpenter', 'Lookout', 'Cook', 'Deckhand', 'Bosun', 'Gunner', 'Carpenter', 'Lookout', 'Cook', 'Deckhand', 'Bosun']);
  c.hands[5].role = 'Gunner';   // her Cook given the guns on the Fleet page
  c.hands[11].role = 'Gunner';
  c.sync(roster(13));
  const { joined } = c.sync(roster(14));
  assert.equal(joined[0].role, 'Cook', 'her galley\'s empty post');
});

test('AUDIT CAPTAIN\'S SEA C10: a wear that is no number reads none - the sea\'s clock on her spirits never poisoned (NaN stopped it for good) (mutants: the guard)', async () => {
  const { createShipCrew, SEA_DECAY_S, MORALE_START } = await import('../../../src/systems/naval/shipCrew.js');
  const c = createShipCrew({ seed: 4 });
  c.tick(SEA_DECAY_S + 1, { atSea: true, wear: NaN });
  assert.equal(c.morale, MORALE_START - 1);
  c.tick(SEA_DECAY_S, { atSea: true, wear: 2 });
  assert.equal(c.morale, MORALE_START - 1, 'twice the wear: half the clock');
});

// ── D: the Eltheric Ocean's traffic and its strands ─────────────────────────────────────────────────────────────────────

const REACHES = { band: 'reaches', bandName: 'the Reaches', depth: 20, legend: null };
/** A boat of mine at a wild isle's strand past the Veil: the world's sites and gather stood in for. */
async function strandSea(o = {}) {
  const s = await sea({ hull: 2, where: { ether: REACHES }, ...o });
  const site = { id: 'strand:300,200', kind: 'strand', px: 100, py: 101, seed: 99, n: 3 };
  const w = { sites: [site] };
  s.deps.captain = { event() {}, sites: () => w.sites };
  s.deps.ether = { gather: () => ({ items: [{ name: 'starglass' }], text: '3 shards of starglass from the strand of X.' }) };
  const casks = () => s.host._shots.floaters().filter((f) => f.lot === `site:${site.id}`);
  return { s, w, site, casks };
}

test('AUDIT CAPTAIN\'S SEA D1: a strand\'s casks float once - out of its reach and back while they float, none floats again (each return floated three more till the first was hauled: the Eltheric goods without end) (mutants: the floating check\'s stood gate)', async () => {
  const { s, w, site, casks } = await strandSea();
  s.run(1.2);
  assert.equal(casks().length, 3);
  w.sites = []; s.run(1.2);   // sailed out of its reach: the world's list leaves it
  w.sites = [site]; s.run(1.2);
  w.sites = []; s.run(1.2);
  w.sites = [site]; s.run(1.2);
  assert.equal(casks().length, 3, 'the same three afloat');
  assert.equal(s.log.say.filter((t) => /Your boat goes ashore and comes back with its haul/.test(t)).length, 1, 'said once');
  // bare from its FIRST cask hauled - one hauled days after never pushes the strand's day on
  const { createEtherHost, STRAND_SITE } = await import('../../../src/scenes/etherHost.js');
  const { createCaptainLedger } = await import('../../../src/systems/naval/captainLedger.js');
  const ES = await import('../../../src/world/ethericSea.js');
  let day = 10, wild = null;
  for (let cx = 700; cx < 800 && !wild; cx++) for (let cy = 200; cy < 300 && !wild; cy++) { const i = ES.isleOfCell(cx, cy); if (i?.kind === 'wild' && i.good) wild = i; }
  const L = createCaptainLedger();
  const host = createEtherHost({ ledger: L, day: () => day });
  assert.ok(host.gather(`${STRAND_SITE}${wild.key}`).items.length);
  day = 12;
  assert.ok(host.gather(`${STRAND_SITE}${wild.key}`).items.length, 'a cask still afloat hauled later');
  assert.equal(L.gatheredDay(wild.key), 10, 'bare from the first');
});

test('AUDIT CAPTAIN\'S SEA D2: a strand\'s haul floats alongside the boat that pulled in for it - STRAND_ALONGSIDE_M off her on open water, every cask on water (they went 700 m off on no bearing of the isle\'s, some on its beach); a swimmer breaks his open in the water, never "hauls it aboard" (mutants: the alongside point, the open water, the cask on the beach, the swimmer\'s words)', async () => {
  const { STRAND_ALONGSIDE_M, SITE_CASK_SPREAD } = await import('../../../src/scenes/naval/navalHost.js');
  const land = (x) => x > 20;   // the isle's beach to the east of her
  const { s, casks } = await strandSea({ water: (x) => !land(x) });
  s.run(1.2);
  assert.equal(casks().length, 3);
  for (const c of casks()) {
    assert.ok(!land(c.pos[0]), `on open water (${c.pos.map((v) => v.toFixed(1))})`);
    assert.ok(Math.hypot(c.pos[0], c.pos[2]) <= STRAND_ALONGSIDE_M + 6 + SITE_CASK_SPREAD, 'alongside');
  }
  // the swimmer's
  s.runtime.sailing = false;
  s.deps.swimming = () => true;
  const c = casks()[0];
  s.view.feet = [c.pos[0], 0, c.pos[2]];
  s.run(0.3);
  assert.ok(s.log.say.includes('You break open a cask in the water: 3 shards of starglass from the strand of X.'), s.log.say.join(' | '));
  assert.ok(s.log.given.some(([n, b]) => n === 1 && b === null), 'into his pack');
});

test('AUDIT CAPTAIN\'S SEA D3: an Eltheric prize\'s papers answer to no crown - burned, they wash no notoriety of mine in the Bay (the nearest Bay capital\'s waters were read for a ship of the Eltheric Ocean) (mutants: the Veil\'s gate)', async () => {
  const { GRAPPLE_S } = await import('../../../src/systems/naval/navalBoarding.js');
  const s = await sea({ hull: 2, where: { ether: REACHES } });
  const id = s.host.spawnShip('merchantGalleon', { range: 26.8, bearing: Math.PI / 2, yaw: 0 });
  const e = s.host._sea.get(id);
  e.ship.pos = [26.8, 0, 0];
  s.host.frame(0.1);
  assert.equal(e.ether, 'reaches', 'a ship of the Eltheric Ocean');
  s.host.notoriety.add('Wayrest', 40);
  s.host.notoriety.add('Sentinel', 40);
  s.host.notoriety.add('Daggerfall', 40);
  e.ship.damage.apply({ hull: Math.ceil(e.ship.damage.maxHull * 0.8), sail: 0, crew: 0 });
  s.host.frame(0.1);
  assert.equal(s.host.activate(), true, 'the grapples');
  s.run(GRAPPLE_S + 0.3);
  for (const f of s.log.foes.filter((x) => x.side === 'enemy')) f.dead = true;
  s.run(0.2);
  const m = s.log.plunder.at(-1);
  assert.ok(m, 'her window');
  const offer = m.offers().find((o) => o.id === 'papers');
  assert.deepEqual([offer.useful, offer.detail], [false, 'No one hunts you in these waters']);
  assert.equal(m.choose('papers'), true);
  assert.deepEqual(['Wayrest', 'Sentinel', 'Daggerfall'].map((c) => s.host.notoriety.get(c)), [40, 40, 40], 'the Bay\'s notoriety as it was');
  assert.ok(s.log.say.includes('You burn the ship\'s papers. No crown\'s law reaches past the Veil.'));
});

test('AUDIT CAPTAIN\'S SEA D4: a freeport\'s quay past the Veil moors the isles\' traders - never a Bay crown\'s navy; the same day\'s roll in the Bay stands its cutters (mutants: the Veil\'s gate)', async () => {
  const coast = (x, z) => !(z > 200 || (x > 300 && x < 400 && z > -300));
  const PORT = { key: 'port:2', name: 'Wayrest', rect: { minX: -100, maxX: 100, minZ: 220, maxZ: 420 } };
  const roll = async (day, ether) => {
    const h = await sea({ hull: null, water: coast, settings: { ShipsAtSea: 'few' }, where: { day, ...(ether ? { ether: REACHES } : {}) } });
    h.view.feet = [0, 0, 300]; h.deps.harbourNear = () => PORT; h.run(1);
    return [...h.host._sea.values()].filter((e) => e.ship.errand?.kind === 'moored').map((e) => [e.ship.seed, e.ship.cls.faction]);
  };
  let day = 1, bay = await roll(day, false);
  while (!bay.some(([, f]) => f === 'navy') && day < 40) bay = await roll(++day, false);
  assert.ok(bay.some(([, f]) => f === 'navy'), 'a day the Bay\'s roll moors a cutter');
  const past = await roll(day, true);
  assert.deepEqual(past.map(([sd]) => sd), bay.map(([sd]) => sd), 'the same ships by seed');
  assert.ok(past.every(([, f]) => f === 'merchant'), `traders all: ${past.map(([, f]) => f)}`);
});

test('AUDIT CAPTAIN\'S SEA D6: a legend\'s purse is paid only while she sails by this captain\'s own ledger - another\'s copy of her, sunk with a ball of mine in her, pays nothing more and never pushes her rise back (mutants: the ledger\'s gate)', async () => {
  const { createEtherHost } = await import('../../../src/scenes/etherHost.js');
  const { createCaptainLedger } = await import('../../../src/systems/naval/captainLedger.js');
  const { legendById, LEGEND_RISE_DAYS } = await import('../../../src/systems/naval/etherShips.js');
  const L = createCaptainLedger();
  L.endLegend('starless', 100);
  let day = 105, paid = 0;
  const said = [];
  const host = createEtherHost({ ledger: L, day: () => day, credit: (n) => { paid += n; }, mid: (t) => said.push(t) });
  assert.equal(host.legendEnded('starless', 'sink'), 0);
  assert.deepEqual([paid, L.legendDay('starless'), said.length], [0, 100, 0], 'no purse, her end as it was, nothing said');
  day = 100 + LEGEND_RISE_DAYS;
  assert.equal(host.legendEnded('starless', 'sink'), legendById('starless').purse, 'risen again: her purse');
  assert.deepEqual([paid, L.legendDay('starless')], [legendById('starless').purse, day]);
});

test('AUDIT CAPTAIN\'S SEA D7/D14/D22: one legend at sea - none launched while any legend sails in the sea, at any range and any stander\'s, nor by a freeport\'s quay; two standers\' copies of her met, the stander law\'s claim holds her: the lower id\'s stands, the other sails out of the world (mutants: the legends\' list, the port\'s gate, the claim, the retire)', async () => {
  const { createNavalDirector } = await import('../../../src/systems/naval/navalDirector.js');
  const { BANDS } = await import('../../../src/world/ethericSea.js');
  const want = { band: BANDS[1], legend: { id: 'queen', classId: 'legendQueen' } };
  const ctx = (o = {}) => ({ density: 4, player: [0, 0, 0], players: [[0, 0, 0]], level: 3, ships: [], isOpenWater: () => true, nearPort: false, notoriety: 0, seedBase: 1, seaY: 0, ether: want, legends: [], ...o });
  const lucky = Array.from({ length: 200 }, (_, i) => i * 104729 + 11).find((seedBase) => createNavalDirector({ random: () => 0 }).step(100, ctx({ seedBase })).spawn?.legend);
  assert.ok(lucky, 'a roll that launches her');
  assert.ok(!createNavalDirector({ random: () => 0 }).step(100, ctx({ seedBase: lucky, legends: ['wake'] })).spawn?.legend, 'another legend at sea (the Wake\'s haunt overlaps hers): none');
  assert.ok(!createNavalDirector({ random: () => 0 }).step(100, ctx({ seedBase: lucky, nearPort: true })).spawn?.legend, 'by a freeport\'s quay: none');
  // the host lists every legend, any range and any stander's
  const REACH = { band: 'reaches', bandName: 'the Reaches', depth: 20 };
  const s = await sea({ hull: 2, where: { ether: REACH } });
  const id = s.host.spawnShip('legendQueen', { range: 6000 });
  assert.match(rd('src/scenes/naval/navalHost.js'), /legends: \[\.\.\.sea\.values\(\)\]\.filter\(\(e\) => e\.legend && e\.ship\.damage\.state !== SHIP_STATES\.sunk\)\.map\(\(e\) => e\.legend\),/);
  // two standers' copies: a word from 'a' (before 'local') takes her; one from 'z' is never stood
  const { navalWireRecord } = await import('../../../src/systems/naval/navalWire.js');
  const word = (n, seed) => navalWireRecord({ ships: [{ n, classId: 'legendQueen', variant: 0, pos: [0, 0, 900], yaw: 0, speed: 3, sails: 1, hull: 1, sail: 1, crew: 1, state: 'afloat', heel: 0, seed, fire: false, gen: 0, region: 19 }] });
  s.host.applyWord('z', word(1, 77));
  assert.equal([...s.host._sea.values()].filter((e) => e.legend === 'queen' && !e.retiring).length, 1, 'z\'s copy never stood - mine holds her');
  assert.ok(!s.host._sea.get(id).retiring);
  s.host.applyWord('a', word(1, 78));
  assert.equal(s.host._sea.get(id).retiring, true, 'a\'s claim holds her - mine sails out of the world');
  assert.ok(s.host._sea.has('a:1'), 'a\'s stood');
});

test('AUDIT CAPTAIN\'S SEA D8: the deep\'s mark rides the wire - a deep ship\'s and a deep cask\'s, through the door both ways; a peer\'s copy of a deep ship the deep\'s, a peer\'s cask hauled as rich as its owner\'s (an older build\'s word reads none) (mutants: each side of the wire, the host\'s word, the copy, the cask, the claim)', async () => {
  const { navalWireRecord, validNavalRecord } = await import('../../../src/systems/naval/navalWire.js');
  const ship = (n, deep) => ({ n, classId: 'pirateBrig', variant: 0, pos: [0, 0, 100 * n], yaw: 0, speed: 3, sails: 1, hull: 1, sail: 1, crew: 1, state: 'afloat', heel: 0, seed: 10 + n, fire: false, gen: 0, region: 17, deep });
  const rec = navalWireRecord({ ships: [ship(1, true), ship(2, false)], casks: [{ id: 5, pos: [1, 0, 1], from: 'pirateBrig', lot: 'S', deep: true }, { id: 6, pos: [2, 0, 2], from: 'pirateBrig', lot: 'E' }] });
  assert.deepEqual([rec.d, rec.e], [[1], [5]]);
  const got = validNavalRecord(rec);
  assert.deepEqual(got.ships.map((x) => !!x.deep), [true, false]);
  assert.deepEqual(got.casks.map((x) => !!x.deep), [true, false]);
  assert.equal(validNavalRecord({ ...rec, d: [1, 'x'] }), null, 'a bad mark fails the word');
  assert.equal(validNavalRecord({ ...rec, e: Array(13).fill(5) }), null);
  // the host: its word says them, a peer's copy keeps them, a claimed cask is drawn the deep's
  const s = await sea({ hull: 2 });
  const tiers = [];
  s.deps.hold = (key, tier) => { tiers.push(tier); return [{ name: `${key}@${tier}` }]; };
  s.host.applyWord('peer', rec);
  assert.equal(s.host._sea.get('peer:1').deep, true, 'her copy the deep\'s');
  assert.equal(s.host._sea.get('peer:2').deep, false);
  assert.equal(s.host._shots.floater('peer:5').deep, true, 'its cask the deep\'s');
  const mine = s.host._sea.get(s.host.spawnShip('pirateBrig', { range: 400 }));
  mine.deep = true;
  assert.deepEqual(s.host.word((p) => p).d, [mine.n], 'my word says mine');
  s.host._shots.dropFlotsam({ id: '77', pos: [5, 0, 5], lot: 'S', from: 'pirateBrig', deep: true });
  s.host._shots.dropFlotsam({ id: '78', pos: [6, 0, 6], lot: 'S', from: 'pirateBrig' });
  assert.deepEqual(s.host.word((p) => p).e, [77], 'and my deep casks');
  assert.match(rd('src/scenes/naval/navalHost.js'), /pickFlotsam\(\{ lot: c\.lot, from: c\.from, deep: c\.deep, collector: c\.collector, point: c\.point \}\);/, 'the claim\'s answer drawn the deep\'s');
  assert.match(rd('src/scenes/naval/navalHost.js'), /claims\.set\(e\.id, \{ owner: e\.owner, raw, lot: e\.lot, from: e\.from, deep: !!e\.deep,/);
});

test('AUDIT CAPTAIN\'S SEA D9: a pair met in the deep waters is the deep\'s - drawn DEEP_LEVEL levels up and launched `deep`, as a single ship there is (mutants: the level, the mark)', async () => {
  const { createNavalDirector, DEEP_LEVEL } = await import('../../../src/systems/naval/navalDirector.js');
  const ctx = (o) => ({ density: 4, player: [0, 0, 0], players: [[0, 0, 0]], level: 1, ships: [], isOpenWater: () => true, nearPort: false, notoriety: 0, seedBase: 1, seaY: 0, ether: null, deep: true, ...o });
  let pairs = 0;
  for (let i = 0; i < 400 && pairs < 20; i++) {
    const out = createNavalDirector({ random: () => 0 }).step(100, ctx({ seedBase: i * 7919 + 5 }));
    if (!out.spawn?.encounter) continue;
    pairs++;
    assert.deepEqual([out.spawn.deep, out.spawn.company.deep], [true, true], 'both the deep\'s');
  }
  assert.ok(pairs >= 10, `pairs met (${pairs})`);
  assert.match(rd('src/systems/naval/navalDirector.js'), /const pair = encounterClasses\(kind, \(ctx\.level \?\? 1\) \+ \(deep \? DEEP_LEVEL : 0\) \+ \(ctx\.ether\?\.band\?\.level \?\? 0\), r\);/);
  assert.equal(DEEP_LEVEL, 3);
});

test('AUDIT CAPTAIN\'S SEA D11: the Pale Regent\'s guns load LEGEND_RELOAD_K the quicker - a `gunnery` legend\'s alone (the constant had no reader) (mutants: the reload)', async () => {
  const { createSeaShip } = await import('../../../src/systems/naval/navalAI.js');
  const { LEGEND_RELOAD_K } = await import('../../../src/systems/naval/etherShips.js');
  const reload = (classId) => { const sh = createSeaShip({ id: 'x', seed: 1, classId, variant: 0, pos: [0, 0, 0], yaw: 0, names: {} }); sh.guns.fired('starboard'); return sh.guns.left('starboard'); };
  assert.equal(LEGEND_RELOAD_K, 0.7);
  assert.ok(reload('legendQueen') > 0);
  assert.ok(Math.abs(reload('legendRegent') - reload('legendQueen') * LEGEND_RELOAD_K) < 1e-9, 'her carrack\'s reload, the quicker');
});

test('AUDIT CAPTAIN\'S SEA D10: the Ninefold Hunger boards, and boards again - her first wave thrown back, half her hands come over the rail again; the second thrown back, she is beaten as any pirate (her terror was clamped like any flagship\'s) (mutants: the second wave, its once)', async () => {
  const { GRAPPLE_S } = await import('../../../src/systems/naval/navalBoarding.js');
  const WRECKED = { v: 1, boats: { 42: { hull: 0, sail: 0, crew: 24, fire: 0, state: 'wrecked', barrels: 4 } }, notoriety: {}, day: 1, raids: [] };
  const s = await sea({ hull: 2, save: WRECKED, where: { ether: REACHES } });
  const id = s.host.spawnShip('legendHunger', { range: 20, bearing: Math.PI / 2, yaw: 0 });
  const e = s.host._sea.get(id);
  e.ship.pos = [20, 0, 0];
  const throwBack = () => {
    for (let t = 0; t < 30 && s.host.boarding?.kind !== 'repel'; t += 0.5) s.run(0.5);
    assert.equal(s.host.boarding?.kind, 'repel', 'she boards');
    s.run(GRAPPLE_S + 0.2);
    for (const f of s.log.foes.filter((x) => x.side === 'enemy')) f.dead = true;
    s.run(0.2);
  };
  const crew = e.ship.damage.crew;
  throwBack();
  assert.ok(s.log.mid.includes('The boarders are thrown back, but Ninefold Hunger sends more over the rail!'), s.log.mid.join(' | '));
  assert.ok(Math.abs(e.ship.damage.crew - crew / 2) < 1e-6, 'half her hands');
  assert.equal(e.ship.damage.state, 'afloat');
  assert.equal(s.host.boarding?.kind, 'repel', 'the second wave at once, from where she lies');
  throwBack();
  assert.ok(s.log.mid.includes('The boarders are thrown back!'), 'the second wave beaten');
  assert.equal(e.ship.damage.crew, 0, 'her hands gone over my rail');
});

test('AUDIT CAPTAIN\'S SEA D12: every captain whose sea a legend comes into hears her come - a party\'s other captain too, who stands another\'s copy of her - and once while she is in it (mutants: the stander\'s gate, the once)', async () => {
  const { navalWireRecord } = await import('../../../src/systems/naval/navalWire.js');
  const s = await sea({ hull: 2, where: { ether: REACHES } });
  const word = navalWireRecord({ ships: [{ n: 1, classId: 'legendQueen', variant: 0, pos: [0, 0, 900], yaw: 0, speed: 3, sails: 1, hull: 1, sail: 1, crew: 1, state: 'afloat', heel: 0, seed: 5, fire: false, gen: 0, region: 19 }] });
  s.host.applyWord('a', word);
  s.host.applyWord('a', word);
  const heard = () => s.log.mid.filter((t) => t.startsWith('The sea goes still. A sail on the horizon: The Drowned Queen.')).length;
  assert.equal(heard(), 1, 'the other captain hears her, once');
  s.host.spawnShip('legendWake', { range: 900 });
  assert.equal(s.log.mid.filter((t) => t.includes("Sorrow's Wake")).length, 1, 'my own said as ever');
  // her come said once while she is in my sea: another's copy of the one I stand, met (D7's claim), is not said again
  const z = await sea({ hull: 2, where: { ether: REACHES } });
  z.host.spawnShip('legendRegent', { range: 900 });
  z.host.applyWord('a', navalWireRecord({ ships: [{ n: 1, classId: 'legendRegent', variant: 0, pos: [0, 0, 950], yaw: 0, speed: 3, sails: 1, hull: 1, sail: 1, crew: 1, state: 'afloat', heel: 0, seed: 6, fire: false, gen: 0, region: 19 }] }));
  assert.ok(z.host._sea.has('a:1'), 'a\'s copy stood');
  assert.equal(z.log.mid.filter((t) => t.startsWith('The sea goes still. A sail on the horizon: The Pale Regent.')).length, 1, 'once');
});

test('AUDIT CAPTAIN\'S SEA D13: a veiled legend is hailed at the veil\'s share of the lookout\'s reach, as every other reach takes her - the Starless at 800 m unhailed, the Regent there hailed (mutants: the veil on the hail)', async () => {
  const { SAIL_HO_RANGE } = await import('../../../src/scenes/naval/navalHost.js');
  const { LEGEND_VEIL_K } = await import('../../../src/systems/naval/etherShips.js');
  const hails = async (classId) => {
    const s = await sea({ hull: 2, where: { ether: REACHES } });
    s.host.spawnShip(classId, { range: 800, bearing: Math.PI / 2 });
    s.run(3);
    return s.log.say.filter((t) => t.startsWith('Sail ho!')).length;
  };
  assert.ok(800 < SAIL_HO_RANGE && 800 > SAIL_HO_RANGE * LEGEND_VEIL_K);
  assert.equal(await hails('legendRegent'), 1, 'the Regent hailed at 800 m');
  assert.equal(await hails('legendStarless'), 0, 'the Starless not - she is veiled');
});

test('AUDIT CAPTAIN\'S SEA D15: a legend\'s hold is the richest at sea - her last LEGEND_STRONGBOXES lots her captain\'s strongboxes (a flagship\'s one beat her hold of plunder); a flagship\'s and a trader\'s as they were (mutants: the count, the tier)', async () => {
  const { holdKeys, drawHold, LEGEND_STRONGBOXES, STRONGBOX_RARITY_TIER, HOLD_RARITY_TIER } = await import('../../../src/systems/naval/navalPlunder.js');
  const tiersOf = (id) => { const got = []; drawHold(classById(id), 7, (k, t) => { got.push(`${k}@${t}`); return []; }); return got; };
  assert.equal(LEGEND_STRONGBOXES, 2);
  assert.deepEqual(holdKeys(classById('legendStarless'), 7).slice(-2), ['J', 'J']);
  assert.deepEqual(tiersOf('legendStarless').slice(-2), [`J@${STRONGBOX_RARITY_TIER}`, `J@${STRONGBOX_RARITY_TIER}`]);
  assert.deepEqual(tiersOf('pirateFlagship'), ['Q@6', 'Q@6', 'E@6', `J@${STRONGBOX_RARITY_TIER}`], 'a flagship\'s one, as it was');
  assert.ok(tiersOf('merchantCarrack').every((t) => t.endsWith(`@${HOLD_RARITY_TIER.merchant}`)), 'a trader\'s J her cargo, never a strongbox');
});

test('AUDIT CAPTAIN\'S SEA D17: the Lantern-Eater is abroad between dusk and dawn alone - day come, she sails out of the world once no fight holds her (she fought on in the sun, and stayed after it) (mutants: the dawn, the fight\'s hold)', async () => {
  const lantern = async (range) => {
    const w = { night: true };
    const s = await sea({ hull: 2, where: { ether: REACHES } });
    const where = s.deps.where;
    s.deps.where = () => ({ ...where(), night: w.night });
    const e = s.host._sea.get(s.host.spawnShip('legendLantern', { range }));
    return { s, w, e };
  };
  const far = await lantern(900);
  far.s.run(1);
  assert.deepEqual([far.e.ship.mode, far.e.retiring], ['cruise', false], 'by night she sails');
  far.w.night = false;
  far.s.host.frame(0.05);
  assert.equal(far.e.retiring, true, 'day come, no fight: she sails out of the world');
  const close = await lantern(200);
  for (let t = 0; t < 20 && close.e.ship.mode !== 'engage'; t += 0.5) close.s.run(0.5);
  assert.equal(close.e.ship.mode, 'engage');
  close.w.night = false;
  close.s.host.frame(0.05);
  assert.equal(close.e.retiring, false, 'a fight holds her');
  // a legend of the day keeps the sea by day
  const s = await sea({ hull: 2, where: { ether: REACHES } });
  const q = s.host._sea.get(s.host.spawnShip('legendQueen', { range: 900 }));
  s.run(1);
  assert.equal(q.retiring, false, 'the Drowned Queen sails by day');
});

test('AUDIT CAPTAIN\'S SEA D19/D20: in the Veil itself the plate says "The Veil" (never "The Shallows, 0 leagues past the Veil"); the Isles\' ship names two words of each trade\'s own, 256 a trade - a harbour\'s ships seldom share one (mutants: the Veil\'s word, the lists)', async () => {
  const { etherWatersWords } = await import('../../../src/ui/naval/navalHud.js');
  const { ETHER_PIRATE_NAMES, ETHER_MERCHANT_NAMES } = await import('../../../src/systems/naval/etherShips.js');
  assert.equal(etherWatersWords({ bandName: 'the Shallows', depth: 0, veil: true }), 'The Veil');
  assert.equal(etherWatersWords({ bandName: 'the Reaches', depth: 23 }), 'The Reaches, 23 leagues past the Veil');
  assert.match(rd('src/scenes/naval/navalHost.js'), /ether: w\.ether \? \{ bandName: w\.ether\.bandName, depth: w\.ether\.depth, veil: !!w\.ether\.veil \} : null,/);
  for (const list of [ETHER_PIRATE_NAMES, ETHER_MERCHANT_NAMES]) {
    assert.equal(list.length, 256);
    assert.equal(new Set(list).size, 256, 'every one its own');
    assert.ok(list.every((n) => /^\S+ \S+$/.test(n)));
  }
  let shared = 0;
  for (let h = 0; h < 200; h++) { const names = [0, 1, 2, 3].map((i) => etherShipNames(classById('merchantGalleon'), (h * 7919 + i * 104729) >>> 0).name); if (new Set(names).size < names.length) shared++; }
  assert.ok(shared <= 10, `a harbour of four sharing a name: ${shared} in 200`);
});

// ── L/B: the ledger, the board, the exchange and the charts ─────────────────────────────────────────────────────────

test('AUDIT CAPTAIN\'S SEA L1: a pirate whose boarders were thrown back is ended then - taken or sunk after, her end is logged and never paid again (the law\'s reward and the crown\'s regard came twice) (mutants: the repel\'s mark, the law\'s skip, the deed\'s crown)', async () => {
  const s = await sea({ hull: 2 });
  const legal = [], deeds = [];
  s.deps.law = { crime() {}, legal: (r, n) => legal.push([r, n]), faction() {} };
  s.deps.captain = { deed: (act, cls, o) => deeds.push([act, o?.crown ?? null]), event() {}, chartFor: () => null, marque: () => null };
  const id = s.host.spawnShip('pirateBrig', { range: 600 });
  s.host._charge('repel', id);
  assert.equal(legal.length, 1, 'the repel paid');
  assert.ok(deeds[0][1], 'her crown\'s regard');
  s.host._charge('board', id);
  assert.equal(legal.length, 1, 'taken after: no second reward');
  assert.deepEqual(deeds[1], ['board', null], 'logged, no crown\'s regard');
  const other = s.host.spawnShip('pirateBrig', { range: 700 });
  s.host._charge('sink', other);
  assert.equal(legal.length, 2, 'a pirate never thrown back paid as ever');
});

test('AUDIT CAPTAIN\'S SEA L2/B1/L8/L11: the day\'s dealing kept for every exchange dealt with (one deal at the next port over filled the first\'s stock again), another day\'s let go, an older save\'s one port read; a hostile record\'s twins, absurd counts and prototype names cleaned; the log one ship "1 pirate" (mutants: the per-port map, the day, the twins, the bounds, the own-name check, the singular)', async () => {
  const { createCaptainLedger, DEALT_PORTS_MAX, SAILED_MAX_M, MARQUE_UNTIL_MAX, logLines, newLog } = await import('../../../src/systems/naval/captainLedger.js');
  const L = createCaptainLedger();
  L.deal('wayrest', 5, 'wine', 30, 'bought');
  L.deal('near', 5, 'wine', 1, 'bought');
  assert.deepEqual(L.dealtAt('wayrest', 5).bought, { wine: 30 }, 'the first port\'s kept');
  assert.deepEqual(L.dealtAt('wayrest', 6).bought, {}, 'another day');
  L.deal('near', 6, 'wine', 2, 'bought');
  assert.deepEqual([L.dealtAt('near', 6).bought, L.dealtAt('wayrest', 5).bought], [{ wine: 2 }, {}], 'a new day\'s dealing its own, the day before let go');
  L.deal('wayrest', 5, 'wine', 30, 'bought');
  for (let i = 0; i < DEALT_PORTS_MAX + 5; i++) L.deal(`p${i}`, 5, 'wine', 1, 'sold');
  assert.equal(Object.keys(L.getSaveData().dealt.at).length, DEALT_PORTS_MAX, 'bounded');
  const M = createCaptainLedger();
  M.restoreSaveData({ dealt: { port: 'old', day: 3, sold: { iron: 4 } } });
  assert.deepEqual(M.dealtAt('old', 3).sold, { iron: 4 }, 'an older save\'s one port');
  // the hostile record
  const c = { id: 'dup', kind: 'hunt', crown: 'Wayrest', until: 9, pay: 300, days: 3, need: 2, standing: 2 };
  M.restoreSaveData({ contracts: [c, c, { ...c, id: 'neg', pay: -9999 }, { ...c, id: 'noneed', need: undefined }], charts: [{ id: 'k', seed: 1, px: 1, py: 1 }, { id: 'k', seed: 1, px: 1, py: 1 }], log: { sailed: 2e296 }, marque: { crown: 'Wayrest', until: 1e300 } });
  assert.deepEqual(M.contracts().map((x) => [x.id, x.pay]), [['dup', 300], ['neg', 0]], 'once each, no negative purse, no needless hunt');
  assert.equal(M.charts().length, 1);
  assert.equal(M.log.sailed, SAILED_MAX_M);
  assert.equal(M.getSaveData().marque.until, MARQUE_UNTIL_MAX);
  assert.equal(M.regard('constructor', 5), null);
  assert.equal(M.standing('constructor'), 0);
  const log = newLog();
  log.sunk.pirate = 1; log.sunk.navy = 2; log.contracts.bounty = 1; log.contracts.delivery = 2;
  const lines = Object.fromEntries(logLines(log));
  assert.equal(lines['Ships sunk'], '3 - 1 pirate, 2 crown\'s ships');
  assert.equal(lines['Contracts done'], '3 - 1 bounty, 2 deliveries');
});

test('AUDIT CAPTAIN\'S SEA L4: the captain\'s days cross the lanes with the clocks - a legend ended, a strand gathered, the day\'s dealing moved by the days between them, both ways (a copy taken offline found her sunk for months, "gone down today") (mutants: each map, the dealing, the vendor)', async () => {
  const { offlineCopyOf, onlineCopyOf, CAPTAIN_RECORD_VENDOR } = await import('../../../src/systems/offlineCopy.js');
  const { CAPTAIN_SAVE_VENDOR } = await import('../../../src/systems/naval/captainLedger.js');
  assert.equal(CAPTAIN_RECORD_VENDOR, CAPTAIN_SAVE_VENDOR);
  const snap = { classicMinutes: 300 * 1440 + 10, worldMinutes: 4800 * 1440 + 10, modData: { Captain: { ether: { legends: { queen: 4799 }, harvested: { '3,4': 4800 } }, dealt: { day: 4800, at: {} } } } };
  const off = offlineCopyOf(snap).modData.Captain;
  assert.deepEqual([off.ether.legends.queen, off.ether.harvested['3,4'], off.dealt.day], [299, 300, 300], 'onto the character\'s clock');
  const on = onlineCopyOf({ classicMinutes: 300 * 1440 + 10, modData: { Captain: { ether: { legends: { queen: 299 }, harvested: {} }, dealt: null } } }, 5000 * 1440 + 10).modData.Captain;
  assert.equal(on.ether.legends.queen, 4999, 'onto the world\'s');
});

test('AUDIT CAPTAIN\'S SEA L5/L10/B14/B15: the Captain page\'s meter below nothing reads what the next rank wants; a crown that keeps no favours never says its navy hunts (it hunts at twice it); "an Admiral"; the shipwright\'s discount named for what it covers, and a purse that pays for her whole offered her whole (mutants: the meter, the words, the article, the row\'s whole gold)', async () => {
  const { standingMeter, perkWords } = await import('../../../src/ui/captainPage.js');
  const { crownRankOf, RANK_PERKS } = await import('../../../src/systems/naval/captainLedger.js');
  const { officeText, yardText } = await import('../../../src/ui/naval/navalYardWindow.js');
  const { yardOffer } = await import('../../../src/systems/naval/navalYard.js');
  assert.deepEqual(standingMeter(-99, crownRankOf(-99)), { now: 0, max: 114, label: '114 to Sworn Captain' });
  assert.deepEqual(standingMeter(30, crownRankOf(30)), { now: 15, max: 35, label: '20 to Privateer' }, 'mid-rank: what the next still wants');
  const base = { port: 'Wayrest', crown: 'Wayrest', standing: 260, board: [], held: [], marque: null, admiralty: null };
  assert.match(officeText({ ...base, rank: 'Admiral' }).lede, /You are an Admiral of Wayrest/);
  assert.match(officeText({ ...base, rank: 'Commodore' }).lede, /You are a Commodore of Wayrest/);
  assert.ok(!/hunts/.test(officeText({ ...base, rank: 'Admiral', hunted: true }).lede));
  assert.ok(!/hunts you/.test(rd('src/ui/captainPage.js')));
  assert.match(perkWords(RANK_PERKS[1]), /^the shipwright's repairs and powder 5% off/);
  // a 5% discount's fractions: a purse of the bill pays her whole
  const damage = { hull: 97, maxHull: 100, sail: 50, maxSail: 50, crew: 10, maxCrew: 10 };
  const offer = yardOffer(damage, 99, 0, { discount: 0.05 });
  const bill = offer.rows.find((r) => r.id === 'hull').whole;
  const model = { offer: () => yardOffer(damage, 99, bill, { discount: 0.05 }), ship: () => ({ ...damage, barrels: 99, wrecked: false }), name: 'Galleon', hasBarrels: false };
  assert.equal(yardText(model).whole, `Repair all - ${bill} gold`);
});

test('AUDIT CAPTAIN\'S SEA L6/B5/B7: the survey counts a ship once by her seed (kept on the contract, through a save); a deed moves one contract - a bounty\'s own quarry hers, else the soonest due (three hunts were done by the same three kills) - a berth every delivery\'s (mutants: the seen seeds, the order, the break)', async () => {
  const { advance, restoreContract } = await import('../../../src/systems/naval/harbourBoard.js');
  const { createCaptainLedger } = await import('../../../src/systems/naval/captainLedger.js');
  const survey = { id: 's', kind: 'survey', crown: 'Wayrest', need: 3, done: 0, until: 100, pay: 10, days: 2, standing: 6 };
  assert.equal(advance(survey, { type: 'study', crown: 'Wayrest', seed: 7 }), null);
  assert.equal(advance(survey, { type: 'study', crown: 'Wayrest', seed: 7 }), null);
  assert.equal(survey.done, 1, 'the same ship once');
  assert.deepEqual(restoreContract(JSON.parse(JSON.stringify(survey))).seen, [7], 'kept through a save');
  const L = createCaptainLedger();
  const hunt = (id, until) => ({ id, kind: 'hunt', crown: 'Wayrest', need: 2, done: 0, until, pay: 100, days: 3, standing: 2 });
  L.holdContract(hunt('late', 900)); L.holdContract(hunt('soon', 300));
  L.holdContract({ id: 'b', kind: 'bounty', crown: 'Wayrest', until: 999, pay: 500, days: 4, standing: 6, target: { px: 1, py: 1 } });
  const end = (bounty = null) => L.contractEvent({ type: 'end', act: 'sink', faction: 'pirate', crown: 'Wayrest', bounty });
  assert.deepEqual(end('b').done.map((c) => c.id), ['b'], 'her quarry the bounty\'s alone');
  end(); end();
  assert.deepEqual(L.contracts().map((c) => [c.id, c.done]), [['late', 0]], 'the soonest done first, by its own two');
});

test('AUDIT CAPTAIN\'S SEA L9: a rank won or lost is kept back till the centred label is at rest - never wiped by the lines said in its breath - and the crowns that named the same rank the same way say it in one line (mutants: the wait, the grouping)', () => {
  const src = hostText('src/scenes/world.js');
  const text = src.slice(src.indexOf('  const _rankLines = [];'), src.indexOf('  // CAPT-BOARD (bible/03-World/Captains-Sea.md): THE HARBOUR OFFICE'));
  const said = [];
  const label = { timer: 0 };
  const changes = [];
  const scope = { captainLedger: { takeRankChanges: () => changes.splice(0) }, setMidScreenText: (t) => said.push(t), _wildMidText: label };
  const f = new Function('scope', `with (scope) { ${text}\nreturn { captainSay, captainSayFlush }; }`)(scope);
  const up = (crown) => ({ crown, from: { rank: 0, title: 'Unsworn' }, to: { rank: 1, title: 'Sworn Captain' } });
  changes.push(up('Daggerfall'), up('Wayrest'), up('Sentinel'), { crown: 'Wayrest', from: { rank: 2, title: 'Privateer' }, to: { rank: 1, title: 'Sworn Captain' } });
  f.captainSay();
  f.captainSayFlush();
  assert.deepEqual(said, [], 'the label still says the line of its breath');
  label.timer = -1;
  f.captainSayFlush(); f.captainSayFlush();
  assert.deepEqual(said, ['The crowns of Daggerfall, Wayrest and Sentinel name you Sworn Captain!', 'The crown of Wayrest no longer counts you Privateer.']);
  assert.match(src, /if \(!gamePaused\(\) && !_loading\) captainSayFlush\(\);/);
});

test('AUDIT CAPTAIN\'S SEA L12: a hold\'s own plunder counted once each, as it leaves her - never the captain\'s own things put in and taken out again (each pass counted them) (mutants: the drawn set, the once)', async () => {
  const { GRAPPLE_S } = await import('../../../src/systems/naval/navalBoarding.js');
  const s = await sea({ hull: 2 });
  const notes = [];
  s.deps.worth = (items) => items.length;
  s.deps.captain = { note: (k, n) => notes.push([k, n]), deed() {}, event() {}, chartFor: () => null, marque: () => null, prize() {} };
  const id = s.host.spawnShip('merchantGalleon', { range: 26.8, bearing: Math.PI / 2, yaw: 0 });
  const e = s.host._sea.get(id);
  e.ship.pos = [26.8, 0, 0];
  s.host.frame(0.1);
  e.ship.damage.apply({ hull: Math.ceil(e.ship.damage.maxHull * 0.8), sail: 0, crew: 0 });
  s.host.frame(0.1);
  assert.equal(s.host.activate(), true);
  s.run(GRAPPLE_S + 0.3);
  for (const f of s.log.foes.filter((x) => x.side === 'enemy')) f.dead = true;
  s.run(0.2);
  const m = s.log.plunder.at(-1);
  const drawn = m.items.length;
  assert.ok(drawn > 0);
  m.takeAll();
  const mine = { name: 'my own sword' };
  m.items.push(mine);
  m.takeAll();
  m.items.push(mine);
  m.takeAll();
  assert.deepEqual(notes.filter(([k]) => k === 'plunder'), [['plunder', drawn]], 'her own, once');
});

test('AUDIT CAPTAIN\'S SEA B2/B16: no shop buys the exchange\'s goods (a General Store paid more for a tusk than the quay that makes it asked - a money loop with no voyage); the other sea\'s goods "not sold here", listed only where the captain may sail for them or carries some (mutants: the shop\'s refusal, the words, the list)', async () => {
  const { shopBuysItem } = await import('../../../src/systems/shopStock.js');
  const { BUILDING_TYPES } = await import('../../../src/world/buildingNames.js');
  const { mintGood, GOODS } = await import('../../../src/systems/naval/tradeGoods.js');
  for (const g of GOODS) for (const t of [BUILDING_TYPES.GeneralStore, BUILDING_TYPES.PawnShop]) assert.equal(shopBuysItem(t, mintGood(g.id, 2)), false, g.id);
  const { exchangeText } = await import('../../../src/ui/naval/navalYardWindow.js');
  const row = { id: 'starglass', name: 'Starglass', unit: 'shard', units: 'shards', stand: 'wants', sell: 400, buy: 420, sells: 0, buys: 30, exotic: true, have: 0 };
  assert.match(exchangeText({ port: 'Wayrest', weight: 0, gold: 0, rows: [row] }).rows[0].words, /not sold here/);
  const { createHarbourOffice } = await import('../../../src/scenes/harbourOffice.js');
  const { createCaptainLedger } = await import('../../../src/systems/naval/captainLedger.js');
  const port = { key: '100,100', name: 'Wayrest', px: 100, py: 100, crown: 'Wayrest' };
  const office = (etherGoods) => createHarbourOffice({ ledger: createCaptainLedger(), port: () => port, day: () => 3, gold: () => 0, etherGoods: () => etherGoods });
  const ids = (o, cargo) => o.exchange({ cargo }).rows.map((r) => r.id);
  assert.ok(ids(office(true), []).includes('starglass'));
  assert.ok(!ids(office(false), []).includes('starglass'), 'the crossing out not this game\'s: not listed');
  assert.ok(ids(office(false), [mintGood('starglass', 3)]).includes('starglass'), 'unless she carries some');
  const rich = createHarbourOffice({ ledger: createCaptainLedger(), port: () => port, day: () => 3, gold: () => 1e6, etherGoods: () => true });
  assert.deepEqual(rich.exchange({ cargo: [] }).buy('starglass', 1), { ok: false, text: 'Starglass is not sold here.' }, 'the other sea\'s good: never "no more today"');
  assert.match(hostText('src/scenes/world.js'), /etherGoods: \(\) => etherOut,/, 'listed where the crossing out is this game\'s');
});

test('AUDIT CAPTAIN\'S SEA B3: the harbourmaster\'s and the exchange\'s tabs hang on a ship lying to the quay at the helm alone - the Fleet page\'s yard is the shipwright\'s (a ship laid up a port away took goods in and sold them out where she never sailed) (mutants: the quay\'s flag, the world\'s gate)', async () => {
  const s = await sea({ hull: 2 });
  s.boat.crewed = true;
  const models = [];
  s.deps.openYard = (m) => { models.push(m); return true; };
  assert.equal(s.host.openYard(s.boat), true);
  assert.equal(models[0].atQuay, false, 'the Fleet page\'s door');
  const host = rd('src/scenes/naval/navalHost.js'), w = hostText('src/scenes/world.js');
  assert.match(host, /return yardHere\(boat\) && openYard\(boat, \{ quay: true \}\);/);
  assert.match(w, /if \(model\.atQuay\) model\.office = \(\) => \{/);
  assert.match(w, /if \(model\.atQuay\) model\.exchange = \(\) => harbourOffice\.exchange\(/);
});

test('AUDIT CAPTAIN\'S SEA B4: a bounty\'s quarry gone down by another hand is never stood again - her bounty void, said, no regard lost (she came back whole and her casks floated anew each time) (mutants: the mark, the event, the void)', async () => {
  const s = await sea({ hull: 2 });
  const site = { id: 'bounty:1', kind: 'bounty', px: 100, py: 100, seed: 77, classId: 'pirateBrig', name: 'Nocturnal\'s Mark', captain: null, region: 17 };
  const events = [];
  s.deps.captain = { sites: () => [site], event: (ev) => events.push(ev), deed() {}, chartFor: () => null, marque: () => null };
  s.run(1.2);
  const q = [...s.host._sea.values()].find((e) => e.bounty === site.id);
  assert.ok(q, 'stood');
  q.ship.damage.apply({ hull: 1e6, sail: 0, crew: 0 }, 0);   // no blow of mine
  for (let t = 0; t < 40 && s.host._sea.has(q.id); t += 1) s.run(1);
  assert.ok(!s.host._sea.has(q.id), 'gone down');
  assert.ok(events.some((ev) => ev.type === 'lost' && ev.bounty === site.id), 'her bounty void');
  s.run(3);
  assert.equal([...s.host._sea.values()].filter((e) => e.bounty === site.id).length, 0, 'never stood again');
  const { advance } = await import('../../../src/systems/naval/harbourBoard.js');
  const { createCaptainLedger } = await import('../../../src/systems/naval/captainLedger.js');
  assert.equal(advance({ id: 'x', kind: 'bounty' }, { type: 'lost', bounty: 'x' }), 'void');
  const L = createCaptainLedger();
  L.holdContract({ id: 'x', kind: 'bounty', crown: 'Wayrest', until: 9, pay: 5, days: 4, standing: 3, target: { px: 1, py: 1 } });
  const r = L.contractEvent({ type: 'lost', bounty: 'x' });
  assert.deepEqual([r.voided.length, L.contracts().length, L.standing('Wayrest')], [1, 0, 0], 'off the list, no regard lost');
  // the harbour office says it
  const { createHarbourOffice } = await import('../../../src/scenes/harbourOffice.js');
  const said = [];
  const L2 = createCaptainLedger();
  L2.holdContract({ id: 'y', kind: 'bounty', title: 'The Gull\'s bounty', crown: 'Wayrest', until: 9, pay: 5, days: 4, standing: 3, target: { px: 1, py: 1 } });
  createHarbourOffice({ ledger: L2, mid: (t) => said.push(t) }).event({ type: 'lost', bounty: 'y' });
  assert.deepEqual(said, ['Bounty void - The Gull\'s bounty. Someone else sank it.']);
});

test('AUDIT CAPTAIN\'S SEA B6/B8/B10: a chart\'s port drawn again till one has open water (one in five was a dud for good), a site sought outward past the drawn reach; a raised cache\'s chart, read again, marks nothing; no site past the map\'s edge where nothing streams (mutants: the redraw, the outward walk, the raised set, the edge)', async () => {
  const { chartSite, CHART_PORT_TRIES } = await import('../../../src/systems/naval/treasureCharts.js');
  const { siteFor } = await import('../../../src/systems/naval/harbourBoard.js');
  assert.equal(CHART_PORT_TRIES, 32);
  const inland = { key: 'in', name: 'Inland', px: 500, py: 250 }, coast = { key: 'co', name: 'Coast', px: 100, py: 100 };
  const seaAt = (x) => x < 90;   // open water west of the coast port alone
  let duds = 0;
  for (let seed = 0; seed < 200; seed++) if (!chartSite(seed, [inland, coast], seaAt)) duds++;
  assert.equal(duds, 0, 'every chart finds the coast');
  const far = siteFor({ px: 100, py: 100 }, (() => { const v = [0.5, 0]; let i = 0; return () => v[i++] ?? 0; })(), (x) => x <= 93);
  assert.ok(far && far.d > 3, 'out past the drawn reach');
  const { createHarbourOffice } = await import('../../../src/scenes/harbourOffice.js');
  const { createCaptainLedger } = await import('../../../src/systems/naval/captainLedger.js');
  const { mintChart } = await import('../../../src/systems/naval/treasureCharts.js');
  const L = createCaptainLedger();
  const office = createHarbourOffice({ ledger: L, ports: () => [coast], seaAt, level: () => 1, credit() {} });
  const chart = mintChart(5);
  assert.equal(office.readChart(chart).ok, true);
  const id = L.charts()[0].id;
  assert.ok(office.raiseCache(id) > 0);
  const again = office.readChart(mintChart(5));
  assert.equal(L.charts().length, 0, 'marked nothing');
  assert.match(again.text, /raised long ago\./);
  // PIN MOVED (FIELD BUGS 2026-10-14 INLAND-PORTS, Mac: "Fix harbour seaAt too"): the office's sea is the open sea, and
  // B10's edge - past the map only where the land beyond the Bay stands - is the open sea's own (run by
  // test/systems/naval/fb1014_inlandports.test.js)
  assert.match(rd('src/scenes/world.js'), /\n {4}seaAt: openSea, {3}\/\//);
  assert.match(rd('src/scenes/world.js'), /\n {4}if \(!\(x >= 0 && y >= 0 && x < MAP_WIDTH && y < MAP_HEIGHT\)\) return tamrielLand && seaPixel\(x, y\);\n {4}_openSea \?\?= openSeaOf\(seaPixel, MAP_WIDTH, MAP_HEIGHT\);/);
});

test('AUDIT CAPTAIN\'S SEA B9/B11/B13: a cache\'s and a chart\'s things kept in an overladen pack (they went down unsaid); the exchange caps a purchase at her room before she would lie dead in the water, and says the room; "1 hour left" (mutants: the force, the room\'s cap, the lede, the noun)', async () => {
  const host = rd('src/scenes/naval/navalHost.js');
  assert.match(host, /deps\.board\?\.giveItems\?\.\(items, boat \?\? null, \{ force: true \}\)/);
  assert.match(host, /deps\.board\?\.giveItems\?\.\(\[chart\], boatInPlay\(\) \?\? null, \{ force: true \}\);/);
  const { createHarbourOffice } = await import('../../../src/scenes/harbourOffice.js');
  const { createCaptainLedger } = await import('../../../src/systems/naval/captainLedger.js');
  const { goodIn } = await import('../../../src/systems/naval/tradeGoods.js');
  const port = { key: '100,100', name: 'Wayrest', px: 100, py: 100, crown: 'Wayrest' };
  let gold = 1e6;
  const hold = [];
  const office = createHarbourOffice({ ledger: createCaptainLedger(), port: () => port, day: () => 3, gold: () => gold, pay: (n) => { gold -= n; }, stow: (h, it) => h.push(it) });
  const room = () => ({ load: 1000 + goodIn(hold, 'wine') * 10, slows: 600, stops: 1050 });   // 50 kg of room: five casks
  const x = office.exchange({ cargo: hold, room });
  assert.equal(x.room, 50);
  const r = x.buy('wine', Infinity);
  assert.equal(goodIn(hold, 'wine'), 4, 'stopped short of dead in the water');
  assert.ok(r.ok);
  const again = office.exchange({ cargo: hold, room }).buy('wine', 1);
  assert.deepEqual([again.ok, again.text], [false, 'The ship can\'t carry any more.']);
  const { exchangeText } = await import('../../../src/ui/naval/navalYardWindow.js');
  assert.match(exchangeText({ port: 'Wayrest', weight: 40, room: 10, gold: 5, rows: [] }).lede, /room for 10 kg more\)/);
  const { contractLine } = await import('../../../src/systems/naval/harbourBoard.js');
  assert.equal(contractLine({ until: 30, title: 't', words: 'w', kind: 'hunt', done: 0, need: 2, pay: 5 }, 0).left, '1 hour left');
  // Come Sail Away's own reckoning, read
  const { scene } = await import('../../csaScene.mjs');
  const sc = scene({ settings: { 'Cargo.CargoThreshold': 500 } });
  assert.match(rd('src/systems/comeSailAway/comeSailAway.js'), /cargoRoom\(boat\) \{\n\s+if \(!boat\?\.Cargo\) return null;\n\s+const \{ load, threshold \} = cargoLoad\(boat\);\n\s+return \{ load, slows: threshold, stops: 2 \* threshold \};/);
  assert.equal(typeof sc.rt.cargoRoom, 'function');
  // her room handed from the yard's model to the exchange's tab
  const s = await sea({ hull: 2 });
  const models = [];
  s.deps.openYard = (m) => { models.push(m); return true; };
  s.runtime.cargoRoom = (b) => (b === s.boat ? { load: 5, slows: 10, stops: 20 } : null);
  s.host.openYard(s.boat);
  assert.deepEqual(models[0].room(), { load: 5, slows: 10, stops: 20 }, 'the yard\'s model reads Come Sail Away\'s room');
  assert.match(hostText('src/scenes/world.js'), /if \(model\.atQuay\) model\.exchange = \(\) => harbourOffice\.exchange\(\{ uid: model\.uid \?\? null, cargo: model\.cargo\?\.\(\) \?\? null, room: \(\) => model\.room\?\.\(\) \?\? null \}\);/, 'and the exchange\'s tab hers');
});

test('AUDIT CAPTAIN\'S SEA C11: the posts\' worth executed at sea, not read off the text - her Gunner\'s quicker reload, her Carpenter\'s quicker mending, her Cook\'s slower wear on the spirits, each against the same crew with the post struck off (mutants: each seam)', async () => {
  const { FIELD_QUIET_S } = await import('../../../src/systems/naval/navalYard.js');
  const { SEA_DECAY_S, MORALE_START } = await import('../../../src/systems/naval/shipCrew.js');
  /** A crewed galleon at sea, her hand of `role` an Old Salt - or that post struck off (`without`). */
  const crewed = async (role, without = false) => {
    const s = await sea({ hull: 2 });
    s.boat.crewed = true;
    s.run(0.3);
    const st = s.host._myState(s.boat);
    for (const h of st.crew.hands) if (h.role === role) { if (without) h.role = 'Deckhand'; else h.fights = 40; }
    if (!without && !st.crew.hands.some((h) => h.role === role)) { st.crew.hands[1].role = role; st.crew.hands[1].fights = 40; }
    s.run(0.2);
    return { s, st };
  };
  // the Gunner on the reload
  const reload = async (without) => { const { st } = await crewed('Gunner', without); st.guns.fired('starboard'); return st.guns.left('starboard'); };
  const [gunner, none] = [await reload(false), await reload(true)];
  assert.ok(gunner < none * 0.9, `the Old Salt's guns quicker (${gunner.toFixed(2)} s against ${none.toFixed(2)} s)`);
  // the Carpenter on the mending, over the same quiet
  const mend = async (without) => {
    const { s, st } = await crewed('Carpenter', without);
    st.damage.apply({ hull: st.damage.maxHull * 0.8, sail: 0, crew: 0 }, -FIELD_QUIET_S);   // under the free mending's cap
    const was = st.damage.hull;
    s.run(10, 0.5);
    return st.damage.hull - was;
  };
  const [carpenter, plain] = [await mend(false), await mend(true)];
  assert.ok(carpenter > plain * 1.3, `the Old Salt's mending quicker (${carpenter.toFixed(1)} against ${plain.toFixed(1)})`);
  // the Cook on the sea's wear
  const wear = async (without) => { const { s, st } = await crewed('Cook', without); s.run(2 * SEA_DECAY_S + 1, 0.5); return MORALE_START - st.crew.morale; };
  const [cook, nocook] = [await wear(false), await wear(true)];
  assert.deepEqual([cook, nocook], [1, 2], 'an Old Salt Cook: the sea\'s clock at half the pace');
});

test('AUDIT CAPTAIN\'S SEA H9: the seams the docs promise, each held - the richest prize kept, every cask and cache hauled counted as plunder (executed); the harbour office on the captain\'s own clock, the rank\'s yard discount and sure relief, the sites\' water and the isles charted as sighted wired in the world (mutants: each seam)', async () => {
  const s = await sea({ hull: 2 });
  const notes = [], prizes = [];
  s.deps.worth = (items) => items.length;
  s.deps.hold = (key, tier) => [{ name: `${key}@${tier}` }];
  s.deps.captain = { note: (k, n) => notes.push([k, n]), prize: (name, worth) => prizes.push([name, worth]), raiseCache: () => 300, deed() {}, event() {}, chartFor: () => null, marque: () => null, sites: () => [] };
  // a cask of a sunk ship's hold
  s.host._shots.dropFlotsam({ id: '9001', pos: [0, 0, 0], lot: 'S', from: 'pirateBrig' });
  s.run(0.3);
  assert.ok(notes.some(([k, n]) => k === 'plunder' && n === 1), `a cask's haul counted (${JSON.stringify(notes)})`);
  // a chart's cache
  notes.length = 0;
  s.host._shots.dropFlotsam({ id: '9002', pos: [0, 0, 0], lot: 'site:chart:5', from: 'merchantGalleon' });
  s.run(0.3);
  assert.ok(notes.some(([k]) => k === 'plunder'), 'a cache\'s haul counted');
  assert.ok(s.log.say.some((t) => t.startsWith('You haul up the cache: 300 gold and')), s.log.say.join(' | '));
  // a prize's hold: the richest prize offered the log
  const { GRAPPLE_S } = await import('../../../src/systems/naval/navalBoarding.js');
  const id = s.host.spawnShip('merchantGalleon', { range: 26.8, bearing: Math.PI / 2, yaw: 0 });
  const e = s.host._sea.get(id);
  e.ship.pos = [26.8, 0, 0];
  s.host.frame(0.1);
  e.ship.damage.apply({ hull: Math.ceil(e.ship.damage.maxHull * 0.8), sail: 0, crew: 0 });
  s.host.frame(0.1);
  assert.equal(s.host.activate(), true);
  s.run(GRAPPLE_S + 0.3);
  for (const f of s.log.foes.filter((x) => x.side === 'enemy')) f.dead = true;
  s.run(0.2);
  assert.deepEqual(prizes.length, 1);
  assert.equal(prizes[0][0], e.ship.names.name);
  assert.ok(prizes[0][1] > 0, 'her hold\'s worth');
  // the world's wiring
  const w = hostText('src/scenes/world.js');
  const office = w.slice(w.indexOf('  const harbourOffice = createHarbourOffice({'), w.indexOf('  const harbourOffice = createHarbourOffice({') + 400);
  assert.match(office, /now: \(\) => Math\.floor\(playerTicker\.ownMinutes\),/, 'the terms on the captain\'s own clock');
  assert.match(w, /yardDiscount: \(\) => harbourOffice\.perksHere\(\)\.yard,/);
  assert.match(w, /reliefSure: \(crown\) => harbourOffice\.perksAt\(crown\)\.relief,/);
  assert.match(w, /sitePoint: \(px, py, seed\) => navalSitePoint\(px, py, seed\),/);
  assert.match(w, /if \(inEther\(p\.x, p\.y\)\) \{ etherHost\.sight\(p\.x, p\.y\); captainSay\(\); \}/);
});
