// WINDFALL1 (2026-10-08, Mac: "We have permission to use and implement everything into the codebase. These should be
// on by default and integrate into our enhanced environments seamlessly") - WINDFALL 1.0.0 (demifiend000), ported off
// its assembly (vendor/windfall/). THE MODEL: WindNaturalPlanner, WindRecordWeights and WindMod's state machine, pinned
// against a C# reference that runs the decompiled method bodies themselves (the session's harness: WindCore.cs, the
// planner's and the weights' own sources, System.Random) - two trace hashes and a table hash, float bits and all.
// bible/07-Rendering/Windfall.md is the record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  WINDFALL_VENDOR, WINDFALL_NATURE, RECORD_WEIGHTS, RESPONSE, NATURAL, PRESENTATION, DEBUG_MODE, WINDFALL_BUILT_IN,
  plannerStableHash, hashUnit, buildNaturalPlan, effectiveChance, cooldownMultiplier, isWithinWindow, scaleAutomaticDelay, scaleGust,
  responseByte, responseByteForAtlas, seasonHelperAtlasName, windfallResponse, seasonWindChance, geographyWindMultiplier,
  windfallSettings, windfallWeather, createWindfall, windfallStatusText, windfallOn, WINDFALL_COMMAND,
} from '../src/systems/windfall.js';
import { MOD_SETTINGS, modSetting, setModSetting } from '../src/systems/modSettings.js';
import { archivePrefix } from '../src/systems/seasonsIliacBay.js';
import { WEATHER_TYPES } from '../src/world/weather.js';
import { lerpF } from '../src/systems/mathf.js';

const f32b = new Float32Array(1), i32b = new Int32Array(f32b.buffer);
const B = (f) => { f32b[0] = f; return (i32b[0] >>> 0).toString(16).padStart(8, '0'); };
const sha = (s) => createHash('sha256').update(s).digest('hex');
const F = Math.fround;
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} vs ${b}`);

test('WINDFALL1 the planner: StableHash, HashUnit, Build, the chance, the cooldown, the delays and the gust scale, and WindRecordWeights with its Seasons of the Iliac Bay tables - every value the C# reference prints, float bits and all (mutants: the xorshift dropped; HashUnit over 2^32; the windstorm\'s 8% another; a window 60-360; a cooldown day off; a table row moved)', () => {
  let out = '';
  for (const h of [[1], [0, 0], [405, 5, 0, 12, 25, 231], [-1, -2, -3], [-2147483648, 2147483647], [123456789, 747796405]]) out += `hash ${plannerStableHash(...h)}\n`;
  for (let k = 0; k < 400; k++) {
    const key = plannerStableHash(405 + Math.floor(k / 360), Math.floor(k / 30) % 12, k % 30, k % 7, k % 5, 223 + k % 10);
    for (const f of [1, 0, 2, F(0.37)]) { const p = buildNaturalPlan(key, f, 1440); out += `${key} ${B(p.dailyRoll)} ${B(p.escalationRoll)} ${p.plannedSource} ${p.startMinute} ${p.endMinute}\n`; }
    out += `unit ${B(hashUnit(key))} eff ${B(effectiveChance(F(F(0.144) + F(k * F(0.0003))), F(1 + F((k % 3) * 0.25)), 0.5, 1.5, 1, F((k % 4) * 0.5)))}\n`;
    out += `cool ${cooldownMultiplier(k % 6, k % 3, (k % 5) - 1, k % 2)} delay ${B(scaleAutomaticDelay(F(20 + F(k * F(0.1))), F((k % 5) * 0.5)))} gust ${B(scaleGust(F(k * F(0.0031)), F(0.5 + F((k % 4) * 0.5))))}\n`;
  }
  for (let a = 495; a < 515; a++) for (let r = -1; r < 34; r++) out += `${responseByte(a, r)}${r === 33 ? '\n' : ' '}`;
  for (const at of ['SeasonHelper I TEXTURE.504', 'SeasonHelper J TEXTURE.504', 'SeasonHelper K TEXTURE.505', 'SeasonHelper D TEXTURE.506', 'SeasonHelper E TEXTURE.506', 'SeasonHelper F TEXTURE.507', 'SeasonHelper A TEXTURE.508', 'SeasonHelper B TEXTURE.508', 'SeasonHelper C TEXTURE.509', 'SeasonHelper G TEXTURE.510', 'SeasonHelper H TEXTURE.510', 'TEXTURE.504']) {
    for (let a = 503; a < 512; a++) for (let r = 0; r < 33; r++) out += `${responseByteForAtlas(a, r, at)}${r === 32 ? '\n' : ' '}`;
  }
  assert.equal(sha(out), 'de42ad230408c237a5059ae0e97a8864e350117378faaeaae3ea7806e8285bc7', 'the reference\'s planner and tables, byte for byte');
  // the reference's own first lines, as a reader can check them by eye
  assert.deepEqual(out.split('\n').slice(0, 7), ['hash 67927022', 'hash 1872727840', 'hash -799752601', 'hash -1754561397', 'hash -1783912482', 'hash 1908634347', '1504506553 3f66b831 3ef5c5f1 1 726 1079']);
  assert.equal(isWithinWindow({ startMinute: 726, endMinute: 1079 }, 726), true);
  assert.equal(isWithinWindow({ startMinute: 726, endMinute: 1079 }, 1079), false, 'the end is out');
  assert.equal(scaleAutomaticDelay(30, 0), Infinity, 'a frequency of 0 is never');
});

test('WINDFALL1 the weights: twelve rows of 32 bytes (Low 89, Medium 166, Full 255), 0 off the nature archives; Seasons of the Iliac Bay\'s atlases take the mod\'s own tables by their prefix, which is the SeasonHelper\'s ArchiveForSeason (mutants: a byte; the archive offset; the season\'s table ignored)', () => {
  assert.deepEqual(RESPONSE, { low: 89, medium: 166, full: 255 });
  assert.equal(RECORD_WEIGHTS.length, 12);
  for (const row of RECORD_WEIGHTS) { assert.equal(row.length, 32); for (const b of row) assert.ok(b === 0 || b === 89 || b === 166 || b === 255); }
  assert.deepEqual(WINDFALL_NATURE, { first: 500, last: 511 });
  assert.equal(windfallResponse(504, 11), 1, 'a temperate tree sways whole');
  assert.equal(windfallResponse(504, 0), 0, 'a rock stands');
  assert.equal(windfallResponse(500, 1), 166 / 255);
  assert.equal(windfallResponse(499, 1), 0, 'off the nature archives the mod patches nothing');
  assert.equal(windfallResponse(512, 1), 0);
  // the season's atlases: the prefix the port's SeasonHelper port names (systems/seasonsIliacBay.js archivePrefix)
  assert.equal(seasonHelperAtlasName('I', 504), 'SeasonHelper I TEXTURE.504');
  assert.equal(windfallResponse(504, 0, archivePrefix(0, 504)), 1, 'temperate fall: record 0 is a tree in the season\'s atlas (slot 0 takes record 1\'s picture)');
  assert.equal(windfallResponse(504, 0, archivePrefix(1, 504)), 89 / 255, 'temperate spring');
  assert.equal(windfallResponse(505, 8, archivePrefix(3, 505)), 1, 'temperate winter');
  assert.equal(windfallResponse(509, 0, archivePrefix(3, 509)), 1, 'haunted winter shares the spring table');
  assert.equal(responseByteForAtlas(504, 0, 'SeasonHelper K TEXTURE.504'), responseByte(504, 0), 'a prefix that is not the archive\'s season table is the stock row');
});

// The scenario the reference runs (Program.cs `wind`): 30000 frames on an integer clock, half a game minute a frame from
// the classic start, the weather, the door and the map by frame, a debug storm for 1500 frames.
function trace(settings, mode) {
  const w = createWindfall({ settings });
  let out = '', lcg = 12345, gusts = 0;
  const states = new Set();
  for (let i = 0; i < 30000; i++) {
    lcg = (Math.imul(lcg, 1103515245) + 12345) >>> 0;
    let dt = F(F(8 + ((lcg >>> 16) % 41)) / 1000);
    if (i === 7777) dt = 0;
    const minute = 523530 + Math.floor(i / 2);
    const sec = 12566016000 + minute * 60;
    const dayno = Math.floor(sec / 86400), minOfDay = Math.floor((sec % 86400) / 60);
    const year = Math.floor(dayno / 360), rem = dayno - year * 360, month = Math.floor(rem / 30), day = rem - month * 30;
    const season = (month === 11 || month === 0 || month === 1) ? 3 : (month <= 4 ? 1 : (month <= 7 ? 2 : 0));
    const weather = i < 5000 ? 0 : i < 9000 ? 4 : i < 12000 ? 5 : i < 16000 ? 1 : i < 20000 ? 6 : i < 24000 ? 2 : 0;
    const outside = !((i >= 7000 && i < 7600) || (i >= 21000 && i < 21500));
    const climate = i < 15000 ? 231 : 226;
    if (i === 26000) w.setDebugMode(DEBUG_MODE.storm);
    if (i === 27500) w.setDebugMode(DEBUG_MODE.auto);
    const r = w.tick({ dt, outside, weather, date: { year, month, day }, minuteOfDay: minOfDay, absoluteDay: Math.floor(minute / 1440), season, climate,
      mapPixel: { x: 100 + Math.floor(i / 10000) * 9, y: 200 - Math.floor(i / 13000) * 11 }, settings });
    if (r.events.length || i % 97 === 0) {
      const p = w._peek(), c = p.current;
      states.add(p.presentation);
      out += `${i} ${p.contextKey} ${p.presentation} ${B(p.gust)} ${B(c.strength)} ${B(c.swayAmplitude)} ${B(c.swayFrequency)} ${B(c.shiverAmplitude)} ${B(c.shiverFrequency)} ${B(p.swayPhase)} ${B(p.shiverPhase)} ${B(p.direction)} ${B(p.nextGustTime)} ${B(p.windTime)} ${p.lastNaturalDay} ${p.lastNaturalContext} ${p.naturalSource} ${B(r.strength)} ${B(r.gust)}`;
      for (const e of r.events) { out += ` | gust ${B(e.peak)} ${e.windy ? 1 : 0} ${e.storm ? 1 : 0}`; gusts++; }
      out += '\n';
    }
  }
  return { hash: sha(out), gusts, states, mode };
}

test('WINDFALL1 the state machine, against the reference: 30000 frames of the day\'s context, the natural plan and its cooldown, the presentation, the gusts (their schedule, rise, hold and fall, their pairs and their swing), the profile\'s ease and the phases - every float the C# holds, bit for bit, at the built-in settings and at gusty ones (mutants: the ease 3 a second another; the rain\'s 1.15; a gust\'s hold to 0.5; the pair chance; the initial delay; the indoor gust easing at 1; the context\'s cell 16 pixels)', () => {
  const plain = trace(WINDFALL_BUILT_IN, 'built-in');
  assert.equal(plain.hash, '19e6ad4f1cb2597108c391186c1314b78281791129cbb400340f011919841c1e');
  assert.equal(plain.gusts, 22);
  assert.deepEqual([...plain.states].sort(), [0, 1, 2], 'normal, windy and storm all met');
  const gusty = trace({ ...WINDFALL_BUILT_IN, gustFrequency: 2, gustStrength: 1.5, naturalWindstormFrequency: 2, overallFrequency: 2 }, 'gusty');
  assert.equal(gusty.hash, '671c655197c07c2626e1d751510bf1b1e3a74a0449e17dc74772f1893e31492c');
  assert.equal(gusty.gusts, 33);
});

test('WINDFALL1 the settings: the mod\'s keys as LoadSettings reads them - percentages x 0.01 clamped 0..2, the profiles clamped (strength 0..1.5, sway 0..8%, shiver 0..3%), its defaults the mod\'s; on by default (MO1) and `?windfall=off` the door (mutants: a percentage not scaled; a profile read from the wrong section)', () => {
  for (const k of Object.keys(MOD_SETTINGS[WINDFALL_VENDOR].keys)) assert.equal(MOD_SETTINGS[WINDFALL_VENDOR].keys[k].default !== undefined, true, k);
  assert.equal(MOD_SETTINGS[WINDFALL_VENDOR].keys.Enabled.default, true, 'on by default');
  const defaults = (k) => MOD_SETTINGS[WINDFALL_VENDOR].keys[k].default;
  const s = windfallSettings(defaults);
  assert.equal(s.enabled, true);
  assert.equal(s.overallFrequency, 1); assert.equal(s.gustFrequency, 1);
  assert.deepEqual(s.normal, { strength: F(0.2), swayAmplitude: F(F(1.4) * F(0.01)), swayFrequency: F(0.2), shiverAmplitude: F(F(0.6) * F(0.01)), shiverFrequency: F(0.6) });
  assert.deepEqual(s.windy, { strength: F(0.2), swayAmplitude: F(F(2.6) * F(0.01)), swayFrequency: F(0.6), shiverAmplitude: F(F(1.2) * F(0.01)), shiverFrequency: F(1.1) });
  assert.equal(s.gust.strength, F(0.6)); assert.equal(s.storm.shiverFrequency, F(1.7));
  assert.equal(s.presentation.leafAmount, F(2.4)); assert.equal(s.presentation.audioVolume, F(0.5));
  const wild = windfallSettings((k) => ({ 'General.GustFrequency': 500, 'Storm.SwayAmountPercent': 20, 'Normal.ShiverSpeed': 0.1, 'Windy Day.Strength': 9 })[k] ?? defaults(k));
  assert.equal(wild.gustFrequency, 2, 'a percentage clamps at 200%');
  assert.equal(wild.storm.swayAmplitude, F(0.08), 'sway 8% at most');
  assert.equal(wild.normal.shiverFrequency, 0.5, 'shiver 0.5 a second at least');
  assert.equal(wild.windy.strength, 1.5);
  // every key the mod ships, under its section, with the mod's default, range and words (the heading's offset says it is
  // INERT here - one wind); the mod's own General.Enabled is the port's switch
  const ms = JSON.parse(readFileSync(new URL('../vendor/windfall/modsettings.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
  let n = 0;
  for (const sec of ms.Sections) for (const k of sec.Keys) {
    if (sec.Name === 'General' && k.Name === 'Enabled') continue;
    const def = MOD_SETTINGS[WINDFALL_VENDOR].keys[`${sec.Name}.${k.Name}`];
    assert.ok(def, `${sec.Name}.${k.Name} declared`); n++;
    assert.equal(def.default, k.Value, `${sec.Name}.${k.Name}: the mod's default`);
    if ('Min' in k) assert.deepEqual([def.min, def.max], [k.Min, k.Max], `${sec.Name}.${k.Name}: the mod's range`);
    if (k.Name === 'WindDirectionDegrees') assert.ok(def.description.startsWith(k.Description) && /INERT here/.test(def.description), 'the heading\'s offset: the mod\'s words, and why it is inert');
    else assert.equal(def.description, k.Description, `${sec.Name}.${k.Name}: the mod's words`);
  }
  assert.equal(n, Object.keys(MOD_SETTINGS[WINDFALL_VENDOR].keys).length - 1, 'no key of the port\'s own');
  assert.equal(windfallOn(''), modSetting(WINDFALL_VENDOR, 'Enabled'));
  setModSetting(WINDFALL_VENDOR, 'Enabled', true);
  assert.equal(windfallOn(''), true);
  assert.equal(windfallOn('?windfall=off'), false, 'the kill door');
});

const frame = (o = {}) => ({ dt: 0.02, outside: true, weather: 'sunny', date: { year: 405, month: 5, day: 3 }, minuteOfDay: 720, absoluteDay: 1000, season: 2, climate: 231, mapPixel: { x: 100, y: 200 }, ...o });

test('WINDFALL1 one wind: the outdoors\' heading is the trees\' - Windfall\'s slow wander (sin(t x 0.011 + key x 1e-4) x 10 degrees) and its gusts\' swing turned about it; with none handed, the mod\'s own daily heading (HashUnit x 360 + WindDirectionDegrees, Unity\'s frame); the sandstorm a storm, as Thunder (mutants: the heading ignored; the wander added twice; the sandstorm a sunny day)', () => {
  const w = createWindfall();
  const h = [0.6, 0.8];
  for (let i = 0; i < 50; i++) w.tick(frame({ heading: h }));
  const r = w.tick(frame({ heading: h }));
  const ang = Math.atan2(r.direction[1], r.direction[0]) - Math.atan2(h[1], h[0]);
  const base = f32Base(w);
  near(ang * 180 / Math.PI, w._peek().direction - base, 1e-3, 'the turn about the heading is the mod\'s wander and swing');
  assert.ok(Math.abs(ang * 180 / Math.PI) <= 10.0001, 'a normal day\'s wander, no gust: within ten degrees of the wisps\'');
  near(Math.hypot(...r.direction), 1, 1e-9, 'a unit heading');
  // none handed: the mod's own
  const own = createWindfall();
  const o = own.tick(frame());
  const a = own._peek().direction * Math.PI / 180;
  near(o.direction[0], Math.cos(F(a)), 1e-6); near(o.direction[1], Math.sin(F(a)), 1e-6);
  assert.equal(windfallWeather('sandstorm'), WEATHER_TYPES.indexOf('thunder'));
  assert.equal(windfallWeather('rain'), WEATHER_TYPES.indexOf('rain')); assert.equal(windfallWeather(6), 6);
  const sand = createWindfall();
  assert.equal(sand.tick(frame({ weather: 'sandstorm' })).presentation, PRESENTATION.storm);
});
/** the day's base heading, as RebuildDailyContext makes it */
function f32Base(w) { const key = w._peek().contextKey; return F(F(hashUnit(plannerStableHash(key, 747796405)) * 360) + 35); }

test('WINDFALL1 the frame: indoors the shader\'s strength and gust are 0 and the gust eases out at 0.5 a second; the switch off is Update\'s else (nothing, no events); a normal day\'s profile is Normal\'s, rain 1.15x its strength, snow 1.1x, a storm\'s Storm\'s (mutants: the indoor strength kept; the snow multiplier the rain\'s)', () => {
  const w = createWindfall();
  for (let i = 0; i < 400; i++) w.tick(frame({ dt: 0.05 }));
  near(w._peek().current.strength, F(0.2), 1e-6, 'a sunny normal day eases to Normal\'s 0.2');
  const rain = createWindfall();
  for (let i = 0; i < 400; i++) rain.tick(frame({ dt: 0.05, weather: 'rain' }));
  near(rain._peek().current.strength, F(F(0.2) * F(1.15)), 1e-6);
  const snow = createWindfall();
  for (let i = 0; i < 400; i++) snow.tick(frame({ dt: 0.05, weather: 'snow' }));
  near(snow._peek().current.strength, F(F(0.2) * F(1.1)), 1e-6);
  const storm = createWindfall();
  for (let i = 0; i < 400; i++) storm.tick(frame({ dt: 0.05, weather: 'thunder' }));
  assert.equal(storm._peek().presentation, PRESENTATION.storm);
  const inside = w.tick(frame({ outside: false }));
  assert.equal(inside.strength, 0); assert.equal(inside.gust, 0);
  const off = createWindfall({ settings: { ...WINDFALL_BUILT_IN, enabled: false } });
  const r = off.tick(frame());
  assert.equal(r.on, false); assert.equal(r.events.length, 0);
});

test('WINDFALL1 the save record: version 1, the last natural wind\'s day and context; a record that is not version 1, or a day with no context, is none (RestoreSaveData); a restore re-reads the day (mutants: the context check dropped; the version unchecked)', () => {
  const w = createWindfall();
  assert.deepEqual(w.newSaveData(), { version: 1, lastNaturalWindAbsoluteDay: -1, lastNaturalWindContextKey: -2147483648 });
  w.restoreSaveData({ version: 1, lastNaturalWindAbsoluteDay: 1234, lastNaturalWindContextKey: 77 });
  assert.deepEqual(w.getSaveData(), { version: 1, lastNaturalWindAbsoluteDay: 1234, lastNaturalWindContextKey: 77 });
  w.restoreSaveData({ version: 1, lastNaturalWindAbsoluteDay: 1234, lastNaturalWindContextKey: -2147483648 });
  assert.deepEqual(w.getSaveData(), { version: 1, lastNaturalWindAbsoluteDay: -1, lastNaturalWindContextKey: -2147483648 }, 'a day with no context is no record');
  w.restoreSaveData({ version: 2, lastNaturalWindAbsoluteDay: 5, lastNaturalWindContextKey: 9 });
  assert.equal(w.getSaveData().lastNaturalWindAbsoluteDay, -1, 'another version is no record');
  w.restoreSaveData(null);
  assert.equal(w.getSaveData().lastNaturalWindAbsoluteDay, -1);
});

test('WINDFALL1 the console: windfall <auto|normal|windy|storm|gust|bright|ruffle|leaves|status>; a test mode holds the presentation over the weather; a gust on demand is StartGust\'s, its sound handed on; status is GetDebugStatus\'s seven lines (mutants: the storm mode windy; the test mode under the weather)', () => {
  assert.deepEqual(WINDFALL_COMMAND, { name: 'windfall', description: 'Windfall support and diagnostic controls.', usage: 'windfall <auto|normal|windy|storm|gust|bright|ruffle|leaves|status>' });
  const w = createWindfall();
  w.tick(frame());
  w.setDebugMode(DEBUG_MODE.storm);
  assert.equal(w.tick(frame()).presentation, PRESENTATION.storm);
  w.setDebugMode(DEBUG_MODE.windy);
  assert.equal(w.tick(frame()).presentation, PRESENTATION.windy);
  w.setDebugMode(DEBUG_MODE.normal);
  assert.equal(w.tick(frame({ weather: 'thunder' })).presentation, PRESENTATION.normal, 'a test mode over the weather');
  const g = w.triggerGust();
  assert.ok(g.peak >= 0.12 && g.peak <= 0.27 && g.normal, 'a normal-day breeze');
  assert.equal(w.takeEvents().length, 1, 'StartGust\'s PlayWindEvent, for the host to hand on');
  const text = windfallStatusText(w.status());
  assert.equal(text.split('\n').length, 7);
  assert.match(text, /^override=normal weather=Thunder season=Summer geography=Woodlands/);
  assert.match(text, /planned=(WindyPeriod|NaturalWindstorm) window=\d\d:\d\d-\d\d:\d\d/);
  assert.equal(lerpF(1, 2, 0.5), 1.5);
  assert.equal(NATURAL.windstorm, 2);
  assert.equal(seasonWindChance(3), F(0.18)); assert.equal(geographyWindMultiplier(226), F(1.7)); assert.equal(geographyWindMultiplier(999), 1);
});
