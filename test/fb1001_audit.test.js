// AUDIT 2026-10-01 part four (Mac: "let's do a comprehensive audit on this and also ensure the other professions are
// sound") - what the adversarial re-read of part four found in its own fixes, each pinned red on the code before it.
//
// NODE-SHUT. CLIMB-NODE's hold reads the gathering host's target (scenes/world.js `hold`), and the host's frame returned
// early while the professions were shut - its act ended, its prompt gone, its target LEFT: a node under the look when the
// book shut (a sign-out, another account, the service's switch) held the free climb's walk-in start everywhere, for as
// long as they stayed shut. Now a shut frame clears the target.
//
// STICK-TAP. ACT-TOUCH made a tap mid-act the act's strike - asked before the tap's lock-only flag, so TS1's thumb
// re-placed on the move stick (ui/touch.js, "the lock pick and nothing below it") struck the vein, the notch or the
// Basket's glint at a moment the player never chose (every strike counts toward the node's; one off the glint loses the
// clean finish). Now the stick's tap is no strike.
//
// CLICK-LIFT. ACT-CLICK made the click an act's strike on its PRESS; the activation fires on the RELEASE (A8 fact 1),
// and both ladders gated it on an act playing at the release. The strike that finishes the act ends it in its own frame,
// so the finishing click lifted into the world: the door, the chest, the body or the lever under the look was
// activated by the stroke that felled the tree. Now the click an act took is the act's to its release
// (scenes/gatherHost.js clickTaken; the street's ladder, scenes/world.js; the dungeon's, scenes/worldModes.js
// tryExitDungeon). The real gathering host over a stood pixel (test/fb1001_mining.test.js's), the real activation gate,
// and the world host's own lines run over a scope.
//
// CURE-ENDS. CURE-ALL cures a drain through the guild's stat reset (guildServiceFlow.js cureAllAttributes), which zeroed
// it and left it - and a foe's drain spell is bundled, so the HUD kept it as a debuff that did nothing, blinking as
// expiring and never ending, on the party's cards and in the dispel list, through every save. Now a cured drain ends,
// and one a save kept at nothing ends at the load door. CURE-FILL. The turn filled the pools before the cures, so a
// drained Endurance left fatigue at the drained maximum; now the pools are filled last. The real applySpell, the
// vampire's own constructor, snapshotPlayer and restorePlayer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createGatherHost, aimAt } from '../src/scenes/gatherHost.js';
import { herbKind } from '../src/scenes/herbHost.js';
import { mineKind } from '../src/scenes/mineHost.js';
import { treeKind } from '../src/scenes/treeHost.js';
import { trees, veins, utcDayOfMs } from '../src/net/nodeLaw.js';
import { MINE_ACT } from '../src/net/professionLaw.js';
import { createForagingItem, setForagingHost } from '../src/systems/foragingInstall.js';
import { FT } from '../src/systems/foragingLaw.js';
import { createActivateGate, activateFrame } from '../src/systems/activateGate.js';
import { CLIMATES, LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { applySpell } from '../src/systems/effects.js';
import { liveBundles } from '../src/systems/mysticism.js';
import { createVampirismCurse } from '../src/systems/vampirism.js';
import { VAMPIRE_CLANS } from '../src/systems/infection.js';
import { endOldLifeEffects } from '../src/systems/lycanthropy.js';
import { cureAllAttributes } from '../src/systems/guildServiceFlow.js';
import { maxFatigue, liveStat } from '../src/systems/statMods.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../src/world/terrainSampler.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const WORLD = read('src/scenes/world.js');
const MODES = read('src/scenes/worldModes.js');
const WOODS = CLIMATES.Woodlands, GLENUMBRA = 59;
const PX = 405, PY = 150;
const NOON_MS = (20500 * 86_400 + 43_200) * 1000;
const DAY = utcDayOfMs(NOON_MS);
const tick = () => new Promise((r) => setImmediate(r));
const WILD = Object.freeze({ inside: false, insideDungeon: false, insideCastle: false, locationType: LOCATION_TYPES.None, inLocationRect: false,
  hour: 12, climate: WOODS, region: GLENUMBRA, enemiesNear: false, carriedWeight: 10, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' });

function pixelEntry() {
  const law = veins({ x: PX, y: PY, day: DAY, climate: WOODS, region: GLENUMBRA });
  const rocks = law.map((v) => [v.u * TERRAIN_SIZE - 2, 0, v.v * TERRAIN_SIZE + 4, v.u * TERRAIN_SIZE + 2, 6, v.v * TERRAIN_SIZE + 8]);
  const flats = trees({ x: PX, y: PY, day: DAY, climate: WOODS }).map((t, i) => ({ id: i, group: '504_12', i, x: t.u * TERRAIN_SIZE + 1, y: 0, z: t.v * TERRAIN_SIZE }));
  const batch = { archive: 504, record: 12, size: { w: 4, h: 8 } };
  const forest = { base: 504, archive: 504, trees: flats, groups: new Map([['504_12', { batch, centers: flats.map((f) => [f.x, f.y, f.z]), size: batch.size }]]) };
  return { px: PX, py: PY, samples: new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.5), tilemap: new Uint8Array(128 * 128).fill(2), locationRect: null, batches: [], rocks, forest };
}

/** A player with the Pick-Axe, Mining at 100, the professions open; `S.input` is the host's input, the frame's. */
async function stage() {
  const S = { asked: [], said: [], meter: null, prompt: null };
  S.e = { stats: { intelligence: 60, agility: 60, strength: 55, endurance: 50, luck: 50 }, items: [createForagingItem(FT.PickAxe)], wagonItems: [] };
  S.book = {
    state: { open: true, today: {}, caps: { stores: 5000 } },
    stale: () => false, refresh: async () => ({ ok: true }), pixel: () => ({ state: 'none' }), askPixels: async () => [], pump: () => {},
    dungeon: () => null, askDungeon: async () => false, held: () => 0, taken: () => false, counting: () => false,
    track: () => ({ rank: 100, specs: { 50: null, 100: null } }),
    harvest: (h) => { S.asked.push(h); return new Promise(() => {}); },
  };
  const feet = [400, 0, 400];
  const view = { yaw: 0, pitch: 0 };
  S.input = { held: false, attack: false, choice: false };
  const rad = Math.PI / 180;
  const eye = () => ({ pos: [feet[0], feet[1] + 1.6, feet[2]], dir: [Math.sin(view.yaw * rad) * Math.cos(view.pitch * rad), Math.sin(view.pitch * rad), Math.cos(view.yaw * rad) * Math.cos(view.pitch * rad)] });
  const renderer = { createBillboardBatch: () => ({}), destroyBatch: () => {}, moveBillboardBatch: () => true };
  const entry = pixelEntry();
  const built = new Map([[`${PX},${PY}`, entry]]);
  S.host = createGatherHost({
    book: S.book, kinds: [herbKind({ book: S.book }), mineKind({ book: S.book }), treeKind({ book: S.book, renderer })],
    hud: {
      setPrompt: (p) => { S.prompt = p; }, setMeter: (a) => { S.meter = a ? a.state.kind : null; S.act = a ?? S.act; },
      toast: (t) => S.said.push(t), banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {},
    },
    renderer, getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {}, billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => built, pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; },
    pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs: () => NOON_MS,
    eye, view: () => view, feet: () => feet, entity: () => S.e,
    keyLabel: () => 'E', input: () => S.input, active: () => true, activeDungeon: () => false,
  });
  setForagingHost({ world: () => WILD, monthValue: () => 5, entity: () => null, startQuest: () => true, professionsOpen: () => true, keyLabel: () => 'E', professionUse: () => false });
  S.host.onBuilt(entry);
  await tick(); await tick();
  S.vein = S.host.nodesOf(PX, PY).find((n) => n.kind === 'mine' && n.what === 'vein');
  S.face = (n) => {
    const [x, y, z] = n.local;
    feet[0] = x; feet[1] = y; feet[2] = z - 1.5;
    const a = aimAt([x, y + 1.6, z - 1.5], [x, y + (n.lift ?? 0.3), z], { yaw: 0, pitch: 0 });
    view.yaw = -a.yaw; view.pitch = -a.pitch;
    S.host.tick(0.016);
  };
  S.done = () => { S.host.dispose(); setForagingHost(null); };
  return S;
}

test('NODE-SHUT: the professions shut with a vein under the look - the host keeps no target, so nothing holds the free climb; open again, the vein is the target again (mutants: the shut frame keeps the target)', async () => {
  const s = await stage();
  try {
    s.face(s.vein);
    assert.equal(s.host.target?.node.key, s.vein.key, 'open: the vein is the target - CLIMB-NODE holds the walk-in start');
    s.book.state.open = false;
    s.host.tick(0.016);
    assert.equal(s.host.target, null, 'shut: no target');
    assert.equal(s.prompt, null, 'and no prompt, as before');
    // the world host's hold is the act or the target (test/fb1001_climbnode.test.js pins its wiring)
    const hold = () => !!s.host && (s.host.acting() || !!s.host.target);
    assert.equal(hold(), false, 'the free climb is not held');
    s.book.state.open = true;
    s.host.tick(0.016);
    assert.equal(s.host.target?.node.key, s.vein.key, 'open again: the vein again');
  } finally { s.done(); }
});

/** world.js's tap hook (inputHooks.tap), lifted out of the source and run over a scope. */
function tapRig(acting) {
  const m = WORLD.match(/\n    tap: (\(x, y, opts = null\) => \{\n[\s\S]*?\n    \}),\n/);
  assert.ok(m, 'the touch layer\'s tap hook');
  const strikes = [];
  const scope = {
    _tapArmed: 0, _tapPoint: null, _tapLockOnly: false,
    modes: null, yards: null, canvas: { clientWidth: 320, clientHeight: 200 }, worldViewportRect: () => null,
    ndcFromScreen: (x, y) => (y > 180 ? null : [0, 0]),   // the docked bar's strip: the bottom twenty pixels, off the world's view
    gatherHost: { acting: () => acting, strike: (h) => strikes.push(h) },
  };
  return { scope, strikes, tap: new Function('__s', `with (__s) { return (${m[1]}); }`)(scope) };
}

test('STICK-TAP: mid-act a thumb re-placed on the move stick strikes nothing - it arms the lock pick as before; a tap in the docked bar\'s strip is nothing; a tap on the look\'s half strikes once and arms nothing (mutants: the stick\'s tap struck; the bar\'s tap struck)', () => {
  const r = tapRig(true);
  r.tap(40, 150, { lockOnly: true });
  assert.deepEqual(r.strikes, [], 'the stick\'s lock-only tap: no strike');
  assert.deepEqual([r.scope._tapArmed, r.scope._tapLockOnly], [2, true], 'the lock pick armed, as before the act (the ladder holds it off mid-act)');
  const l = tapRig(true);
  l.tap(250, 100);
  assert.deepEqual(l.strikes, [true, false], 'the look\'s half: one strike');
  assert.equal(l.scope._tapArmed, 0, 'and no activation armed');
  const idle = tapRig(false);
  idle.tap(250, 100);
  assert.deepEqual([idle.strikes, idle.scope._tapArmed], [[], 2], 'no act: the tap is the activation\'s, as ever');
  const bar = tapRig(true);
  bar.tap(250, 190);
  assert.deepEqual([bar.strikes, bar.scope._tapArmed], [[], 0], 'a tap in the docked bar\'s strip mid-act: nothing, as with no act');
});

/** The street's ladder, its two lines lifted out of world.js: the act's click asked, and the ladder's condition. */
function streetLadder() {
  const ask = WORLD.match(/\n\s*const _actClick = (gatherHost\?\.clickTaken\(_activateDown\) \?\? false);\n/);
  const cond = WORLD.match(/\n\s*if \((\(\(_act\.activate && [^\n]*?\) \|\| \(useEdge && !nodeTook\)\)) && !modes\.transitioning && !_holdFire\) \{/);
  assert.ok(ask && cond, 'the street ladder\'s act click and condition');
  const askFn = new Function('gatherHost', '_activateDown', `return ${ask[1]};`);
  const condFn = new Function('_act', 'gatherHost', 'useEdge', 'nodeTook', '_actClick', 'nodeClicked', `return ${cond[1]};`);   // PROF-MENU: a node's lit row's click, none here
  return { cond: cond[1], frame: (gate, host, down, now) => { const a = activateFrame(gate, { down, now }); const c = askFn(host, down); return condFn(a, host, false, false, c, false); } };
}

test('CLICK-LIFT: a vein mined by left clicks to its end - no click of the act reaches the street\'s ladder, the last one\'s release included; a click after it, with no act, does (mutants: the latch never held; the latch never let go; the ladder never asks it)', async () => {
  const s = await stage();
  try {
    const street = streetLadder();
    s.face(s.vein);
    assert.equal(s.host.press(), true, 'E starts the act');
    s.host.tick(0.016);
    const gate = createActivateGate();
    let t = 100, ran = 0, clicks = 0;
    for (let i = 0; i < 40 && s.host.acting(); i++) {
      // the press: the gate sees it down, the act takes it as its strike (ACT-CLICK: the host's input().attack)
      if (street.frame(gate, s.host, true, t += 0.016)) ran++;
      s.input = { held: false, attack: true, choice: false }; s.host.tick(0.016); s.input = { held: false, attack: false, choice: false };
      // the release, a frame on
      if (street.frame(gate, s.host, false, t += 0.016)) ran++;
      s.host.tick(MINE_ACT.swingS);
      clicks++;
    }
    assert.equal(s.host.acting(), false, `the vein mined in ${clicks} clicks`);
    assert.equal(s.asked.length, 1, 'the ore asked');
    assert.equal(ran, 0, 'no click of the act ran the ladder - the finishing one\'s release included');
    // with no act, a click is the world's on its release - and once
    assert.equal(street.frame(gate, s.host, true, t += 0.016), false, 'the press: nothing (A8: the release activates)');
    assert.equal(street.frame(gate, s.host, false, t += 0.016), true, 'the release: the ladder');
    assert.equal(street.frame(gate, s.host, false, t += 0.016), false, 'once');
  } finally { s.done(); }
});

test('CLICK-LIFT: the latch is the press\'s - pressed mid-act it is taken to its release and let go after; pressed with no act it is never taken; held into an act it is taken (mutants: the latch never held; the latch never let go)', async () => {
  const s = await stage();
  try {
    assert.deepEqual([s.host.clickTaken(true), s.host.clickTaken(false), s.host.clickTaken(false)], [false, false, false], 'no act: never');
    s.face(s.vein);
    s.host.press();
    s.host.tick(0.016);
    assert.equal(s.host.clickTaken(true), true, 'down mid-act');
    s.host.cancel();   // the act ends with the button still down (Escape, or the strike that finished it)
    assert.equal(s.host.acting(), false);
    assert.equal(s.host.clickTaken(true), true, 'still down: still the act\'s');
    assert.equal(s.host.clickTaken(false), true, 'the release frame: the act\'s');
    assert.equal(s.host.clickTaken(false), false, 'let go after');
    assert.equal(s.host.clickTaken(true), false, 'a new press with no act: the world\'s');
    assert.equal(s.host.clickTaken(false), false);
  } finally { s.done(); }
});

test('CLICK-LIFT: underground the dungeon\'s ladder holds the act\'s click to its release - the modal frame asks it every frame with the button\'s level, the world host hands the gathering host\'s, and tryExitDungeon stops on it (mutants: the dungeon never asks)', () => {
  assert.match(MODES, /\n\s*const _activateDown = held\(keys, 'ActivateCenterObject'\) \|\| !!host\.activateDown\?\.\(\);\n\s*const _act = activateFrame\(\(latch\.activate \?\?= createActivateGate\(\)\), \{\n\s*down: _activateDown,/, 'the gate\'s press is the level the latch is asked with');
  assert.match(MODES, /\n\s*const actClick = host\.profClickTaken\?\.\(_activateDown\) \?\? false;[^\n]*\n\s*if \(\(_act\.activate \|\| useEdge\) && !overlayHeld\) \(mode === 'dungeon' \? tryExitDungeon : tryExit\)\(\{ pressCast: _act\.pressCast, interact: useEdge, actClick \}\);/, 'asked every frame, before the ladder, and handed to it');
  assert.match(MODES.slice(MODES.indexOf('  function tryExitDungeon(')), /\n\s*if \(!interact && \(actClick \|\| host\.profActing\?\.\(\)\)\) return true;/, 'tryExitDungeon: the act\'s click, or an act playing, stops the ladder');   // PIN MOVED (INDOOR-SKIN): the building's ladder has its own, above
  assert.match(WORLD, /\n\s*profClickTaken: \(down\) => gatherHost\?\.clickTaken\(down\) \?\? false,/, 'the world host hands the gathering host\'s latch');
});

// ─── CURE-ENDS, CURE-FILL ───────────────────────────────────────────

const PLAYER = () => ({
  isPlayer: true, name: 'Skaadi', level: 10, activeEffects: [], spells: [], items: [], skills: {},
  stats: { strength: 50, agility: 50, endurance: 50, speed: 50, willpower: 50, intelligence: 50, personality: 50, luck: 50 },
  health: 100, maxHealth: 100, magicka: 80, maxMagicka: 80, fatigue: 6400,
});
/** A foe's Sap Strength, cast at range: Drain Strength 6, bundled as every cast is. */
const SAP = { name: 'Sap Strength', element: 4, rangeType: 2, icon: 3, effects: [{ type: 7, subType: 0, magnitudeBaseLow: 6, magnitudeBaseHigh: 6, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 0, durationBase: 0, durationMod: 0, durationPerLevel: 0, chanceBase: 0, chanceMod: 0, chancePerLevel: 0 }] };
const sapped = () => {
  const p = PLAYER();
  applySpell(SAP, 10, p, {}, () => 0.99, { entity: { level: 10, stats: { willpower: 50 } } });
  assert.equal(liveStat(p, 'strength'), 44, 'drained by 6');
  assert.deepEqual(liveBundles(p).map((b) => [b.name, b.showIcon]), [['Sap Strength', true]], 'its debuff on the HUD');
  return p;
};

test('CURE-ENDS: a foe\'s drain cured by the vampire\'s turn, or by the guild\'s stat reset, leaves the HUD - it ends, never a debuff that does nothing (mutants: the cure leaves it)', () => {
  const v = sapped();
  createVampirismCurse(v, VAMPIRE_CLANS.Lyrezi, { now: 0 });
  assert.equal(liveStat(v, 'strength'), 50, 'healed');
  assert.deepEqual(liveBundles(v).map((b) => b.name), [], 'no debuff left after the turn');
  const g = sapped();
  assert.equal(cureAllAttributes(g), 1, 'one contribution cured');
  assert.deepEqual(liveBundles(g).map((b) => b.name), [], 'nor after the stat reset');
});

test('CURE-ENDS: a save that kept a cured drain at nothing loads without it - the load door ends it; a drain with something left loads as it was (mutants: the load door keeps it; it ends a live drain)', () => {
  const p = sapped();
  const left = PLAYER();
  applySpell(SAP, 10, left, {}, () => 0.99, { entity: { level: 10, stats: { willpower: 50 } } });
  for (const a of p.activeEffects) if (a.kind === 'drainAttribute') a.magnitude = 0;   // as the reset and the turn left it before
  const reload = (e) => { const q = { isPlayer: true }; restorePlayer(q, JSON.parse(JSON.stringify(snapshotPlayer(e, { classicMinutes: 1000 })))); return q; };
  const q = reload(p);
  assert.deepEqual(liveBundles(q).map((b) => b.name), [], 'the zombie drain is gone at the load');
  const r = reload(left);
  assert.deepEqual(liveBundles(r).map((b) => b.name), ['Sap Strength'], 'a live drain loads as it was');
  assert.equal(liveStat(r, 'strength'), 44);
});

test('CURE-FILL: the turn with Endurance and Strength drained fills the pools to the maximums the cure gives back - fatigue full, not the drained full (mutants: filled before the cure)', () => {
  const p = PLAYER();
  p.activeEffects.push({ kind: 'drainAttribute', stat: 'endurance', magnitude: 20, permanent: true }, { kind: 'drainAttribute', stat: 'strength', magnitude: 10, permanent: true });
  assert.equal(maxFatigue(p), 70 * 64, 'drained: (40 + 30) x 64');
  p.fatigue = 100;
  endOldLifeEffects(p);
  assert.equal(maxFatigue(p), 100 * 64, 'cured: (50 + 50) x 64');
  assert.equal(p.fatigue, maxFatigue(p), 'and full to it');
});

// ─── REFUSALS-LEARNED, at the host ─────────────────────────────────

test('REFUSALS-LEARNED at the host, CAP-OFF (2026-10-07, Mac: "Remove the cap on life skills"): the account\'s day in a craft closes nothing - a book that says `account:mining` is closed (the word the day\'s cap left) leaves the vein ready, its prompt the rank\'s, and E starts the act; the unvouched dungeons\' door stands (test/fb1001_ground.test.js) (mutants: the host asks the account\'s day again)', async () => {
  const s = await stage();
  try {
    s.face(s.vein);
    assert.match(s.prompt?.rest ?? '', /^Mining 100/, 'open: ready');
    // PIN MOVED (CAP-OFF): the account's Mining day closed, the prompt said "120 today across your characters", E passed
    // on and said it, and nothing started
    s.book.closed = (k) => k === 'account:mining';
    s.host.tick(0.016);
    assert.match(s.prompt?.rest ?? '', /^Mining 100/, 'still ready');
    assert.equal(s.host.press(), true, 'E is the vein\'s');
    assert.equal(s.host.acting(), true, 'the act starts');
  } finally { s.done(); }
});

// ─── PAD-PULSE ───────────────────────────────────────────────────────

test('PAD-PULSE: the Plus pad\'s gesture swing holds RT four seconds mid-act - one strike, the act still playing (it re-draws the stroke every 0.4 s for the rig, and each was a press); the next press strikes again (mutants: the repeat a strike; the pad says no repeat)', async () => {
  const { createBindings, resetDefaults } = await import('../src/systems/inputActions.js');
  const { setBindings } = await import('../src/ui/input.js');
  const { attachGamepad } = await import('../src/ui/gamepadInput.js');
  const { setPref, _resetForTests: resetPrefs } = await import('../src/systems/uiPrefs.js');
  const { _resetForTests: resetSettings, setValue } = await import('../src/systems/settings.js');
  const hadWindow = 'window' in globalThis, prevW = globalThis.window;
  globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
  resetPrefs(); resetSettings();
  setPref('plusPadLayout', 0);
  const store = createBindings(); resetDefaults(store); setBindings(store);
  const s = await stage();
  const pad = { connected: true, mapping: 'standard', id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  try {
    for (const mode of ['0', '1']) {   // gesture, then Click-or-Hold (shipped)
      setValue('Controls', 'WeaponSwingMode', mode);
      s.face(s.vein);
      assert.equal(s.host.press(), true, 'E starts the act');
      s.host.tick(0.016);
      const canvas = { dispatchEvent() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), style: {} };
      // the world host's hook, its first line (scenes/world.js inputHooks.attack)
      const gp = attachGamepad(canvas, { overlayActive: () => false, paused: () => false, attack: (dx, dy, h, o = null) => s.host.strike(h, o?.repeat === true), look() {} },
        { getPads: () => [pad], dispatch() {}, makeEvent: (type, init) => ({ type, ...init }) });
      gp.tick(1 / 60);
      pad.buttons[7] = { pressed: true, value: 1 };
      for (let i = 0; i < 240 && s.host.acting(); i++) { gp.tick(1 / 60); s.host.tick(1 / 60); }
      assert.deepEqual([s.act.state.strikes, s.host.acting()], [1, true], `mode ${mode}: RT held four seconds - one strike, the act playing`);
      pad.buttons[7] = { pressed: false, value: 0 }; gp.tick(1 / 60); s.host.tick(1);
      pad.buttons[7] = { pressed: true, value: 1 }; gp.tick(1 / 60); s.host.tick(1 / 60);
      assert.equal(s.act.state.strikes, 2, `mode ${mode}: let go and pressed again - the second strike`);
      pad.buttons[7] = { pressed: false, value: 0 }; gp.tick(1 / 60);
      s.host.cancel();
      gp.dispose();
    }
  } finally { s.done(); if (hadWindow) globalThis.window = prevW; else delete globalThis.window; resetPrefs(); resetSettings(); }
});
