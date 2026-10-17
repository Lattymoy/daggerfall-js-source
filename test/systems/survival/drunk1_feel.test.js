// DRUNK1 (2026-10-17, asked for: "Lets add that to the project") - THE DRINK, FELT (src/systems/survival/drunkFeel.js).
// The tavern's counter now sways the view, now and then lurches the walker and warms the screen's edge. Pinned here:
// the bands are the HUD chip's own, read off the record a real tavern drink writes; the sway is nothing sober and
// bounded drunk; the felt intensity eases and holds under a window; the stumble is the motor's blow push, sideways
// to the walk, only on foot on the ground, and never two inside the gap; the row's part turns all of it off; the lens
// is a ramp to the corners, painted only while the drink is felt.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  drunkShare, drunkBand, drunkStateOf, feelTarget, swayAt, stumbleChance, lensAlphaAt, lensImage, createDrunkFeel,
  DRUNK_FEEL_PREF, FEEL_FLOOR, FEEL_EASE, SWAY, STUMBLE_GAP_S, STUMBLE_SPEED, LENS_SIZE, LENS_ALPHA, LENS_BREATH,
} from '../../../src/systems/survival/drunkFeel.js';
import { tavernDrink } from '../../../src/systems/survival/tavernMenu.js';
import { survivalOf } from '../../../src/systems/survival/needs.js';
import { survivalHudChips } from '../../../src/systems/survival/status.js';
import { SURVIVAL_PREF } from '../../../src/systems/survival/switch.js';
import { FEATURES, FEATURE_PREF_DEFAULTS } from '../../../src/systems/features.js';
import { onlineForcedPref } from '../../../src/systems/online/onlineLane.js';
import { setPref, _resetForTests } from '../../../src/systems/uiPrefs.js';

afterEach(() => { _resetForTests(); });

const STATS = Object.freeze({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
/** A drinker at the bar, the record the minute law mints, the counter raised by the tavern's own pour. */
const drinker = (cups = [], endurance = 50) => {
  const p = { isPlayer: true, health: 40, maxHealth: 40, fatigue: 100, magicka: 10, maxMagicka: 20, stats: { ...STATS, endurance }, activeEffects: [], items: [] };
  const s = survivalOf(p, 0);
  for (const strength of cups) tavernDrink(s, strength, { endurance });
  return p;
};
/** A walker the motor would make: on the ground, moving, turned by `moveYaw`, its pushes recorded. */
const walker = (over = {}) => ({
  grounded: true, jumping: false, swimming: false, levitating: false, riding: false, climb: null, freezeMotor: 0,
  moveForward: 1, moveStrafe: 0, moveYaw: 0, pushes: [], isDown: () => false,
  blowPush(vx, vz) { this.pushes.push([vx, vz]); }, ...over,
});

test('DRUNK1: the bands are the HUD chip\'s own - Drunk past half the endurance, Very drunk past the endurance less ten', () => {
  const rows = [0, 25, 26, 40, 41, 50].map((drunk) => {
    const p = drinker([], 50);
    p.survival.drunk = drunk;
    const chip = survivalHudChips(p, 0, { endurance: 50 }).find((c) => c.key === 'drunk');
    return [drunk, drunkBand(drunk, 50), chip?.text ?? null];
  });
  assert.deepEqual(rows, [
    [0, 'sober', null], [25, 'sober', null], [26, 'drunk', 'Drunk'], [40, 'drunk', 'Drunk'], [41, 'veryDrunk', 'Very drunk'], [50, 'veryDrunk', 'Very drunk'],
  ]);
  assert.deepEqual([25, 30, 37.5, 50, 80].map((d) => drunkShare(d, 50)), [0, 0.2, 0.5, 1, 1]);
});

test('DRUNK1: the state is read off the record a tavern drink writes, at the live endurance - and sober with the arc off', () => {
  assert.deepEqual(drunkStateOf(drinker([25])), { band: 'sober', share: 0 }, 'one strong ale is half the endurance, not past it');
  assert.deepEqual(drunkStateOf(drinker([25, 12])), { band: 'drunk', share: 0.48 });
  assert.deepEqual(drunkStateOf(drinker([25, 12], 80)), { band: 'sober', share: 0 }, 'a stouter drinker is not drunk on the same two');
  setPref(SURVIVAL_PREF, false);
  assert.deepEqual(drunkStateOf(drinker([25, 12])), { band: 'sober', share: 0 }, 'Climates & Calories off: no drink is felt');
  assert.deepEqual(drunkStateOf(null), { band: 'sober', share: 0 });
});

test('DRUNK1: the felt intensity - nothing sober, the floor at the Drunk line, one at the endurance', () => {
  assert.equal(feelTarget({ band: 'sober', share: 0 }), 0);
  assert.equal(feelTarget({ band: 'drunk', share: 0 }), FEEL_FLOOR);
  assert.equal(feelTarget({ band: 'veryDrunk', share: 1 }), 1);
});

test('DRUNK1: the sway is nothing at no intensity, and bounded by its table at full', () => {
  const still = swayAt(12.3, 0);
  assert.deepEqual([...still.rot, ...still.pos].map((v) => v + 0), [0, 0, 0, 0, 0, 0]);   // + 0: a zero's sign is no sway
  const peak = [0, 0, 0];
  for (let t = 0; t < 120; t += 0.05) {
    const { rot } = swayAt(t, 1);
    for (let i = 0; i < 3; i++) peak[i] = Math.max(peak[i], Math.abs(rot[i]));
  }
  const limits = [SWAY.pitch.deg, SWAY.yaw.deg, SWAY.roll.deg];
  for (let i = 0; i < 3; i++) {
    assert.ok(peak[i] <= limits[i] + 1e-9, `axis ${i} stays inside ${limits[i]} degrees (${peak[i]})`);
    assert.ok(peak[i] > limits[i] * 0.6, `axis ${i} is felt (${peak[i]} of ${limits[i]})`);
  }
});

test('DRUNK1: the feel eases toward its target, holds under a window, and folds nothing into a sober view', () => {
  const p = drinker([25, 25]);   // fifty on fifty: Very drunk, the share one
  const feel = createDrunkFeel({ rng: () => 0.99 });
  const view = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  assert.equal(feel.view(view), view, 'before the first frame the view is the frame\'s own');
  feel.frame(0.5, { entity: p });
  assert.equal(feel.intensity, FEEL_EASE * 0.5);
  feel.frame(0.5, { entity: p, paused: true });
  assert.equal(feel.intensity, FEEL_EASE * 0.5, 'a window holds the drink where it stands');
  feel.frame(5, { entity: p });
  assert.equal(feel.intensity, 1, 'never past its target');
  assert.notDeepEqual([...feel.view(view)], [...view], 'drunk, the view sways');
  p.survival.drunk = 0;
  feel.frame(1, {});
  assert.equal(feel.intensity, 1 - FEEL_EASE, 'it wears off at the same pace, from the entity it was last handed');
  feel.frame(5, {});
  assert.equal(feel.intensity, 0);
  assert.equal(feel.view(view), view);
});

test('DRUNK1: the stumble is the motor\'s blow push, sideways to the walk, and never two inside the gap', () => {
  const p = drinker([25, 25]);
  const feel = createDrunkFeel({ rng: () => 0 });   // every roll stumbles, to the left
  const w = walker({ moveYaw: 0 });
  feel.frame(STUMBLE_GAP_S * 2, { entity: p, player: w });   // eases to the full intensity in one long step
  assert.equal(w.pushes.length, 1);
  const speed = STUMBLE_SPEED.base + STUMBLE_SPEED.perIntensity * 1;
  assert.deepEqual(w.pushes[0].map((v) => Math.round(v * 1000) / 1000 + 0), [-speed, 0], 'yaw 0 walks along -z: the push is along x, the right vector (cos, 0, -sin) flipped');
  feel.frame(STUMBLE_GAP_S / 2, { entity: p, player: w });
  assert.equal(w.pushes.length, 1, 'inside the gap: none');
  feel.frame(STUMBLE_GAP_S, { entity: p, player: w });
  assert.equal(w.pushes.length, 2, 'past it: the next');
});

test('DRUNK1: no stumble standing still, off the ground, in the saddle, in the water, on a wall - or with the part off', () => {
  const p = drinker([25, 25]);
  for (const over of [{ moveForward: 0, moveStrafe: 0 }, { grounded: false }, { riding: true }, { swimming: true }, { levitating: true }, { climb: { isClimbing: true } }, { moveYaw: NaN }]) {
    const feel = createDrunkFeel({ rng: () => 0 });
    const w = walker(over);
    feel.frame(STUMBLE_GAP_S * 2, { entity: p, player: w });
    assert.equal(w.pushes.length, 0, JSON.stringify(over));
  }
  setPref(DRUNK_FEEL_PREF, false);
  const feel = createDrunkFeel({ rng: () => 0 });
  const w = walker();
  feel.frame(STUMBLE_GAP_S * 2, { entity: p, player: w });
  assert.equal(w.pushes.length, 0);
  assert.equal(feel.intensity, 0, 'the part off: no sway, no lens either');
  assert.deepEqual(feel.state(), { band: 'veryDrunk', share: 1 }, 'the drink itself still stands - the words read it');
});

test('DRUNK1: the stumble is a Poisson rate - none at no intensity, more the drunker', () => {
  assert.equal(stumbleChance(1, 0), 0);
  assert.equal(stumbleChance(0, 1), 0);
  assert.ok(stumbleChance(1 / 60, 1) > stumbleChance(1 / 60, FEEL_FLOOR));
});

test('DRUNK1: the lens - clear at the middle, full at the corners, painted only while felt', () => {
  const img = lensImage();
  const a = (x, y) => new Uint8Array(img.colors.buffer)[(y * LENS_SIZE + x) * 4 + 3];
  assert.equal(img.width, LENS_SIZE);
  assert.equal(a(LENS_SIZE / 2, LENS_SIZE / 2), 0);
  assert.equal(a(0, 0), 255);
  assert.ok(a(0, LENS_SIZE / 2) > 0 && a(0, LENS_SIZE / 2) < 255, 'an edge\'s middle is on the ramp');
  assert.equal(lensAlphaAt(3, 0), 0);
  assert.ok(Math.abs(lensAlphaAt(0, 1) - LENS_ALPHA) < 1e-12);
  assert.ok(lensAlphaAt(1.25, 1) <= LENS_ALPHA + LENS_BREATH + 1e-12);

  const quads = [];
  const renderer = { uploadTexture: () => 'tex', drawScreenQuad: (...args) => quads.push(args) };
  const canvas = { width: 800, height: 600 };
  const feel = createDrunkFeel();
  assert.equal(feel.drawLens(renderer, canvas), false, 'sober: nothing painted');
  feel.frame(3, { entity: drinker([25, 25]) });
  assert.equal(feel.drawLens(renderer, canvas), true);
  assert.deepEqual(quads[0][1], { x: 0, y: 0, w: 800, h: 600 });
  assert.equal(quads[0][4].blend, true);
});

test('DRUNK1: the part rides the Climates & Calories row, on by default and each player\'s own online', () => {
  const row = FEATURES.find((f) => f.control?.key === SURVIVAL_PREF);
  assert.ok(row, 'the row');
  assert.deepEqual(row.control.also.find((a) => a.key === DRUNK_FEEL_PREF), { store: 'prefs', key: DRUNK_FEEL_PREF, initial: true, online: 'player' });
  assert.ok(row.control.parts.some((pt) => pt.key === DRUNK_FEEL_PREF && pt.label === 'Drunken sway'));
  assert.equal(FEATURE_PREF_DEFAULTS[DRUNK_FEEL_PREF], true);
  assert.equal(onlineForcedPref(DRUNK_FEEL_PREF, '?online=1'), undefined, 'online, never forced: each player\'s own eye');
});

test('DRUNK1: the four hosts\' one view call folds the drink after the shake - the game\'s feel, through betterAmbience.view', async () => {
  const { betterAmbience } = await import('../../../src/systems/betterAmbience.js');
  const { drunkFeel } = await import('../../../src/systems/survival/drunkFeel.js');
  const view = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -5, 1]);
  drunkFeel.frame(5, { entity: { survival: { drunk: 0 } } });
  assert.equal(betterAmbience.view(view), view, 'sober: the frame\'s own view, untouched');
  drunkFeel.frame(5, { entity: drinker([25, 25]) });
  const swayed = betterAmbience.view(view);
  assert.notDeepEqual([...swayed], [...view], 'drunk: the same call sways it');
  assert.deepEqual([...swayed], [...drunkFeel.view(view)], 'and by the feel\'s own fold');
  drunkFeel.frame(5, { entity: { survival: { drunk: 0 } } });
});

test('DRUNK1: THE FOUR HOSTS drive the feel beside Better Ambience\'s frame, each on its own pause', async () => {
  const { readFileSync } = await import('node:fs');
  const at = (f) => readFileSync(new URL(`../../../src/scenes/${f}`, import.meta.url), 'utf8');
  const PAUSE = { 'exterior.js': '_overlayHeld', 'world.js': '_overlayHeld || _seasonHeld', 'worldModes.js': 'overlayHeld', 'dungeon.js': 'overlayHeld' };
  for (const [f, paused] of Object.entries(PAUSE)) {
    const src = at(f);
    const ba = src.indexOf('betterAmbience.frame(dt, {');
    const feel = src.indexOf(`drunkFeel.frame(dt, { entity: playerEntity, player, paused: ${paused} });`);
    assert.ok(ba > 0 && feel > ba && feel - ba < 1500, `${f}: the feel's frame follows the ambience's`);
  }
  const send = at('world.js');
  const slur = send.indexOf("if (tabId === 'local' && !me) text = chatSaid('local', text);");
  assert.ok(slur > 0 && send.indexOf("if (tabId === 'local') return online?.sendChat(text, { me }) ?? false;") > slur, 'a Local line said aloud slurs before it is sent; a gesture never');
});
