// AUDIT 68 (2026-09-24, Mac: "a deep comprehensive audit across the entirety of the codebase"), cluster systems_a -
// src/systems audio..chargen. The behavioural fixes are pinned by execution on the real producers; the
// single-sourcing items by the ONE DFU MEMBER, ONE EXPORT law they broke (one binding, and no second body left in
// the files that had one). Namespace imports and a dynamic import where the base had no such export, so each pin
// fails on its own on the base rather than the whole file failing to link.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as W from '../src/systems/weatherSim.js';
import { createBetterAmbience, readBetterAmbienceSettings, BETTER_AMBIENCE_VENDOR, AMBIENT_RAIN_CLIP } from '../src/systems/betterAmbience.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { createActivateGate, activateFrame } from '../src/systems/activateGate.js';
import { onPlayerStruckByEnemy } from '../src/systems/artifactEffects.js';
import { equipTableOf } from '../src/systems/equip.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import * as statMods from '../src/systems/statMods.js';
import * as skills from '../src/systems/skills.js';
import * as chargen from '../src/systems/chargen.js';
import * as advancement from '../src/systems/advancement.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// the component on the real settings, an engine that can refuse a loop, and a rain clip whose fetch can be held
function rainRig({ holdRain = false, engineRunning = true } = {}) {
  const store = Object.fromEntries(Object.entries(MOD_SETTINGS[BETTER_AMBIENCE_VENDOR].keys).map(([k, d]) => [k, d.default]));
  const loops = [];
  const engine = { running: engineRunning };
  const mk = (k, v, extra) => {
    if (!engine.running) return null;   // AudioEngine.loop/loop3d: `if (!this._ready()) return null`
    const l = { k, v, stopped: false, ...extra, stop() { this.stopped = true; } };
    loops.push(l);
    return l;
  };
  let release = () => {};
  const held = new Promise((r) => { release = r; });
  const audio = {
    registerSound: async () => true, playOneShot: () => {}, setReverb: () => true, clipLevel: () => null,
    loop: (k, v, o) => mk(k, v, { o }), loop3d: (k, pos, v, o) => mk(k, v, { pos, o }),
  };
  const fetchClip = async (name) => {
    if (holdRain && name === AMBIENT_RAIN_CLIP) await held;   // the 5 MB AmbientRaining.wav, still on the wire
    return new Uint8Array([1]);
  };
  const ba = createBetterAmbience({ audio, settings: () => readBetterAmbienceSettings(() => store), random: () => 0, fetchClip, snowFree: () => false });
  const m = { entity: { items: [], activeEffects: [], maxHealth: 100 }, inside: true, inBuilding: true, inDungeon: false, grounded: true, standingStill: true, pos: [0, 0, 0] };
  return { ba, loops, engine, release, m };
}

test('AUDIT 68 S24-ba-rain-never-retried: the indoor rain starts once its clip lands or the engine runs - a first try that made no source is tried again, not stamped as handled until the next door (mutant: the weather recorded before the source is known)', async () => {
  W.resetWeatherSim();
  try {
    W.setWeather('rain'); W.setHeardWeather('rain', 0.5);
    // (1) a save loaded in a tavern while the rain clip is still decoding
    {
      const r = rainRig({ holdRain: true });
      r.ba.onLoad();
      r.ba.onTransition({ dungeon: null, building: true });
      for (let i = 0; i < 8; i++) r.ba.frame(0.016, r.m);   // the four-frame wait lands; the clip is not there yet
      assert.equal(r.ba.rainPlaying(), false, 'nothing to play yet');
      r.release(); await r.ba.settle();
      for (let i = 0; i < 3; i++) r.ba.frame(0.016, r.m);
      assert.equal(r.ba.rainPlaying(), true, 'the clip landed: the muffled rain plays');
      assert.equal(r.loops.filter((l) => !l.stopped).length, 1, 'exactly one source');
    }
    // (2) the clip is there, the AudioContext is not yet running (no gesture)
    {
      const r = rainRig({ engineRunning: false });
      r.ba.frame(0, r.m); await r.ba.settle();
      r.ba.onTransition({ dungeon: null, building: true });
      for (let i = 0; i < 8; i++) r.ba.frame(0.016, r.m);
      assert.equal(r.ba.rainPlaying(), false);
      r.engine.running = true;
      r.ba.frame(0.016, r.m);
      assert.equal(r.ba.rainPlaying(), true, 'the engine runs: the rain starts on the next frame');
      assert.equal(r.loops.length, 1, 'and it is made once, not every frame after');
    }
  } finally { W.resetWeatherSim(); }
});

test('AUDIT 68 S24-gate-stale-presscast: a press begun inside the click delay cast nothing, so its release does not report the previous press\'s cast (the plaque\'s peer verb is not skipped for it)', () => {
  const g = createActivateGate();
  // a touch spell cast by a press and a release
  activateFrame(g, { down: true, hasReadySpell: true, touchSpell: true, now: 1 });
  assert.equal(activateFrame(g, { down: false, hasReadySpell: true, touchSpell: true, now: 1.1 }).pressCast, true);
  // a window opens and closes: the 0.3 s delay is armed
  activateFrame(g, { paused: true, now: 2 });
  // no spell readied now; the press starts inside the delay and is held past it
  activateFrame(g, { down: true, now: 2.1 });
  activateFrame(g, { down: true, now: 2.5 });
  const out = activateFrame(g, { down: false, now: 2.6 });
  assert.deepEqual(out, { cast: false, activate: true, pressCast: false });
});

test('AUDIT 68 S24-namira-duplicate-reader: the Ring of Namira is found through the one hardened artifact scan - an equipped item whose enchantments are not an array is skipped, not thrown out of every hit the player takes', () => {
  const p = { isPlayer: true, activeEffects: [], items: [], stats: {}, health: 60, maxHealth: 60 };
  equipTableOf(p).Head = { name: 'Helm', enchantments: 'abc' };   // the value AUDIT WORLD4 B1 hardened every reader against
  const orc = { mobileType: MOBILE_TYPES.Orc, health: 40 };
  assert.doesNotThrow(() => onPlayerStruckByEnemy(orc, p, 10));
  assert.equal(orc.health, 40, 'no ring, nothing reflected');
});

test('AUDIT 68 S24-drain-clamp-duplicate: DrainEffect.IncreaseMagnitude has one home, and the spell drain and the Mace of Molag Bal both raise a drain through it', () => {
  assert.equal(typeof statMods.increaseDrainMagnitude, 'function', 'statMods.js exports the clamp');
  const target = { stats: { strength: 8 } };
  const entry = { kind: 'drainAttribute', stat: 'strength', magnitude: 5 };
  statMods.increaseDrainMagnitude(target, entry, 10);
  assert.equal(entry.magnitude, 7, 'permanent - 1: the drain alone never zeroes the stat');
  for (const f of ['src/systems/effects.js', 'src/systems/artifactEffects.js']) {
    const s = rd(f);
    assert.doesNotMatch(s, /entry\.magnitude \+ amount\) < 1/, `${f} carries no copy of the clamp`);
    assert.match(s, /import \{[^}]*\bincreaseDrainMagnitude\b[^}]*\} from '\.\/statMods\.js';/, `${f} imports it`);
  }
});

test('AUDIT 68 S24-string-hash-duplicate: C#\'s string.GetHashCode has one home - the knowledge seed and the dungeon fog seed import it, neither carries the walk', async () => {
  const { stringHash } = await import('../src/formats/netRuntime.js');
  assert.equal(stringHash('abc'), 96354);
  for (const f of ['src/systems/answerPipeline.js', 'src/systems/betterAmbience.js']) {
    const s = rd(f);
    assert.doesNotMatch(s, /\(h << 5\) - h/, `${f} carries no copy of the hash`);
    assert.match(s, /import \{ stringHash \} from '\.\.\/formats\/netRuntime\.js';/, `${f} imports it`);
  }
});

test('AUDIT 68 S24-stat-keys-duplicate: DFCareer.Stats order is ONE array (chargen re-exports statMods\') and the starting fatigue is the multiplier\'s, not a second 64', () => {
  assert.equal(chargen.STAT_KEYS_ORDER, statMods.STAT_KEYS_ORDER, 'one binding, not two equal frozen arrays');
  assert.doesNotMatch(rd('src/systems/chargen.js'), /\* 64\b/, 'FATIGUE_MULTIPLIER, read from its home');
});

test('AUDIT 68 S24-levelup-sum-duplicate: SetCurrentLevelUpSkillSum\'s sum has one body - chargen\'s creation anchor calls it rather than an inline copy', () => {
  assert.equal(typeof skills.levelUpSkillSum, 'function', 'the leaf both chargen and advancement read owns it');
  assert.equal(advancement.levelUpSkillSum, skills.levelUpSkillSum, 'advancement re-exports the same function');
  assert.match(rd('src/systems/chargen.js'), /playerEntity\.startingLevelUpSkillSum = levelUpSkillSum\(playerEntity\);/, 'the anchor is the one law');
});
