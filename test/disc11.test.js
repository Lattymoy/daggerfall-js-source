// DISC11 (2026-09-23, Mac: "YOU ALSO KEEP FUCKING UP ITS LOUDER ON THE INSIDE COMPARED TO THE OUTSIDE. YOUR
// DIRECTIONS ARE WRONG"). What the ear hears is gain x the recording's own level; indoors must never outplay the
// street. 01-Overview/Field-Bugs-2026-09-23.md. Pinned by execution with the real component and the real ambience.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as W from '../src/systems/weatherSim.js';
import { createBetterAmbience, readBetterAmbienceSettings, BETTER_AMBIENCE_VENDOR, baSoundKey, AMBIENT_RAIN_CLIP } from '../src/systems/betterAmbience.js';
import { AmbientEffects, AMBIENT_RAIN_LOOP } from '../src/systems/ambientEffects.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';

// The two recordings at levels that differ, the mod's the LOUDER (as a modern WAV against an 8-bit SND is)
const LEVEL = { [AMBIENT_RAIN_LOOP]: 0.05, [baSoundKey(AMBIENT_RAIN_CLIP)]: 0.3 };

function rig() {
  const store = Object.fromEntries(Object.entries(MOD_SETTINGS[BETTER_AMBIENCE_VENDOR].keys).map(([k, d]) => [k, d.default]));
  const loops = [];
  const mk = (k, v, extra) => { const l = { k, v: Math.max(0, Math.min(1, v)), stopped: false, ...extra, stop() { this.stopped = true; }, setVolume(x) { this.v = Math.max(0, Math.min(1, x)); } }; loops.push(l); return l; };
  const audio = {
    registerSound: async () => true, playOneShot: () => {}, setReverb: () => true,
    loop: (k, v, o) => mk(k, v, { o }), loop3d: (k, pos, v, o) => mk(k, v, { pos, o, spatial: true }),
    clipLevel: (k) => LEVEL[k] ?? null,
  };
  const ba = createBetterAmbience({ audio, settings: () => readBetterAmbienceSettings(() => store), random: () => 0, fetchClip: async () => new Uint8Array([1]), snowFree: () => false });
  const street = new AmbientEffects({ minWait: 5, maxWait: 25 }, {
    loop: (i, v) => mk(i, v), play3d: () => 0, playOneShot: () => {},
  }, () => 0.5);
  const entity = { items: [], activeEffects: [], maxHealth: 100 };
  const m = (o) => ({ entity, inside: false, inBuilding: false, inDungeon: false, grounded: true, standingStill: true, isRunning: false, movingLessThanHalfSpeed: true, levitating: false, swimming: false, motorSwimming: false, pos: [0, 0, 0], centreY: 0.9, waterSurfaceY: null, onExteriorWater: false, onExteriorWaterAny: false, onExteriorPath: false, onStaticGeometry: false, onFoot: true, winter: false, climateIndex: 231, loadInProgress: false, ...o });
  // what reaches the ear: every live rain loop's gain x its recording's level
  const heard = () => loops.filter((l) => !l.stopped && (l.k === AMBIENT_RAIN_LOOP || l.k === baSoundKey(AMBIENT_RAIN_CLIP))).reduce((t, l) => t + l.v * LEVEL[l.k], 0);
  return { ba, street, m, loops, heard };
}

test('DISC11: rain heard in a building is quieter than the same rain in the street - a drizzle, a shower, a downpour; the mod\'s louder recording is matched to the street\'s and takes the through-the-walls factor, and the street\'s loop stands down for it (mutants: the mod at its flat 1; the recordings not matched; no through-the-walls factor)', async () => {
  for (const level of [0.15, 0.5, 1]) {
    W.resetWeatherSim();
    try {
      W.setWeather('rain');
      const { ba, street, m, heard } = rig();
      ba.frame(0, m({})); await ba.settle();
      // the street, raining at this level
      W.setHeardWeather('rain', level);
      street.setPreset('rain'); street.rainGain = level;
      street.update(0.016, { inside: false, playerPos: [0, 0, 0] });
      ba.frame(0.016, m({}));
      const outside = heard();
      assert.ok(Math.abs(outside - level * LEVEL[AMBIENT_RAIN_LOOP]) < 1e-12, `the street at ${level}`);
      // into the tavern: the mod's source starts; the host ticks the street's ambience with it
      ba.onTransition({ dungeon: null, building: true }); ba.settleTransition(); ba.frame(0.016, m({ inside: true, inBuilding: true }));
      street.update(0.016, { inside: true, indoorRainSource: ba.rainPlaying() });
      const inside = heard();
      assert.ok(inside > 0, 'the rain is heard inside');
      assert.ok(inside < outside, `level ${level}: inside ${inside.toFixed(5)} must be quieter than outside ${outside.toFixed(5)}`);
    } finally { W.resetWeatherSim(); }
  }
});

test('DISC11: in a dungeon the street\'s carried loop stands down while the mod\'s rain plays at the exit, and that source is the street heard at the door - never two rains stacked above the street (mutant: the carried loop keeps playing)', async () => {
  W.resetWeatherSim();
  try {
    W.setWeather('rain');
    const { ba, street, m, loops, heard } = rig();
    ba.frame(0, m({})); await ba.settle();
    W.setHeardWeather('rain', 0.5);
    street.setPreset('rain'); street.rainGain = 0.5;
    street.update(0.016, { inside: false, playerPos: [0, 0, 0] });
    const outside = heard();
    ba.onTransition({ dungeon: { regionName: 'x', name: 'y', inCastle: () => false, exitPos: [1, 2, 3] } }); ba.settleTransition();
    ba.frame(0.016, m({ inside: true, inDungeon: true }));
    street.update(0.016, { inside: true, underground: true, indoorRainSource: ba.rainPlaying() });
    const exit = loops.find((l) => l.spatial && !l.stopped);
    assert.ok(exit, 'the mod\'s rain at the exit');
    assert.ok(heard() <= outside + 1e-12, `underground ${heard()} never above the street ${outside} (at the exit itself; distance only lowers it)`);
    assert.equal(loops.find((l) => l.k === AMBIENT_RAIN_LOOP && !l.stopped)?.v ?? 0, 0, 'the carried loop is silent while the exit\'s rain plays');
  } finally { W.resetWeatherSim(); }
});

test('DISC11: the street\'s level holds indoors (the front does not tick there) and a jump falls back to the classic level (mutant: the level outlives a jump)', () => {
  W.resetWeatherSim();
  try {
    W.setHeardWeather('rain', 0.2);
    assert.equal(W.heardRainGain(), 0.2);
    W.restoreWeather('rain');
    assert.equal(W.heardRainGain(), 1, 'after a jump, the classic level');
  } finally { W.resetWeatherSim(); }
});
