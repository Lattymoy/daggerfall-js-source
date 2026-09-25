// WEATHER3 slice D (2026-09-22): THE STORMS AT A DISTANCE - a thunderstorm
// on the horizon flashes its own cloud, and its thunder arrives its
// distance over the speed of sound later, quieter the further off
// (systems/distantStorms.js; the clouds' composite takes the bolt).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  strikesIn, thunderOf, thunderSourceAt, createDistantStorms, SPEED_OF_SOUND, THUNDER_AUDIBLE_M, THUNDER_CRACK_M,
  STRIKES_PER_MINUTE, BOLT_SECONDS, STRIKE_BACKLOG_MINUTES, THUNDER_SOURCE_M, strikeSeed, strikePlace, STRIKE_SPREAD,
} from '../src/systems/distantStorms.js';
import { boltOf, BOLT_HEIGHT, COMPOSITE_FS, COMPOSITE_UNIFORMS } from '../src/render/volumetricClouds.js';
import { AMBIENT_SOUNDS } from '../src/systems/ambientEffects.js';
import { envelope, SYSTEM_TYPES } from '../src/systems/weatherMap.js';
import { strikeOf, flickerAt } from '../src/systems/lightning.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const full = () => 1;

test('WEATHER3d: THE STRIKES are the storm\'s and the minute\'s - the same whoever asks, however the frames cut the time, as often as its life is strong', () => {
  const a = strikesIn('thunder:3:4:900:0', 1000, 1400, full);
  assert.deepEqual(strikesIn('thunder:3:4:900:0', 1000, 1400, full), a, 'replayable - every client under the shared clock sees these');
  const cut = [...strikesIn('thunder:3:4:900:0', 1000, 1123.37, full), ...strikesIn('thunder:3:4:900:0', 1123.37, 1250.5, full), ...strikesIn('thunder:3:4:900:0', 1250.5, 1400, full)];
  assert.deepEqual(cut, a, 'frame by frame is the whole at once');
  for (let i = 1; i < a.length; i++) assert.ok(a[i] > a[i - 1] && a[i] > 1000 && a[i] <= 1400);
  assert.notDeepEqual(strikesIn('thunder:3:4:900:1', 1000, 1400, full), a, 'each storm its own');
  // the rate: STRIKES_PER_MINUTE x the envelope, over many storms
  let n = 0, half = 0;
  for (let s = 0; s < 200; s++) { n += strikesIn(`t:${s}`, 0, 100, full).length; half += strikesIn(`t:${s}`, 0, 100, () => 0.5).length; }
  assert.ok(Math.abs(n / 20000 - STRIKES_PER_MINUTE) < 0.02, `${n / 20000} a minute at the height of a storm's life`);
  assert.ok(Math.abs(half / n - 0.5) < 0.08, 'half as often at half its strength');
  assert.deepEqual(strikesIn('t:1', 0, 500, () => 0), [], 'nothing before its birth or after its death');
  assert.deepEqual(strikesIn('t:1', 10, 10, full), [], 'an empty window');
});

test('WEATHER3d: THE THUNDER - its distance over the speed of sound late, quieter the further, a crack near and a roll far, and not at all past hearing', () => {
  const [, thunderClip, rollClip] = AMBIENT_SOUNDS.storm;
  const t10 = thunderOf(10000);
  assert.ok(Math.abs(t10.delay - 10000 / SPEED_OF_SOUND) < 1e-9, 'ten kilometres: half a minute after the flash');
  assert.equal(t10.clip, rollClip);
  assert.equal(thunderOf(THUNDER_CRACK_M - 1).clip, thunderClip, 'near: the crack');
  assert.ok(thunderOf(2000).volume > thunderOf(8000).volume && thunderOf(8000).volume > thunderOf(20000).volume);
  assert.equal(thunderOf(0).volume, 1);
  assert.equal(thunderOf(THUNDER_AUDIBLE_M), null, 'seen, not heard');
  // it comes from the storm's side
  const src = thunderSourceAt([100, 5, 200], 100 + 3000, 200 + 4000);
  assert.ok(Math.abs(Math.hypot(src[0] - 100, src[2] - 200) - THUNDER_SOURCE_M) < 1e-9);
  assert.ok(Math.abs((src[0] - 100) / (src[2] - 200) - 3 / 4) < 1e-9, 'toward the storm');
});

const storm = (over = {}) => ({ type: 'thunder', id: 'thunder:9:9:9:0', x: 10000, z: 0, bornAt: 0, life: 400, env: 1, bands: [[5000, 'thunder'], [8000, 'rain'], [12000, 'cloudy']], ...over });
/** Run a scheduler over the real seconds `[0, secs)` at 60 fps, the game clock at 12x from `m0`. */
function run(ds, systems, at, m0, secs) {
  const out = [];
  for (let f = 0; f < secs * 60; f++) { const s = f / 60; out.push({ s, ...ds.tick({ systems, at, minutes: m0 + s / 5, seconds: s }) }); }
  return out;
}

test('WEATHER3d: THE SCHEDULER - a strike lights its cloud now and is heard later, the light fading, the thunder on its own clock', () => {
  const ds = createDistantStorms();
  const frames = run(ds, [storm()], [0, 0], 200, 600);
  const strikes = strikesIn('thunder:9:9:9:0', 200, 200 + 120, (m) => envelope(SYSTEM_TYPES.thunder, m / 400));
  assert.ok(strikes.length >= 5, `${strikes.length} strikes in two game hours`);
  // the first strike: the bolt lights on its frame, gone BOLT_SECONDS later
  const first = (strikes[0] - 200) * 5;
  const lit = frames.filter((f) => f.bolt && f.s >= first && f.s < first + BOLT_SECONDS - 1 / 60);
  assert.ok(lit.length > 0, 'the cloud lights');
  const env0 = envelope(SYSTEM_TYPES.thunder, strikes[0] / 400);
  // BOLT: the light is the strike's own train of strokes (lightning.js flickerAt), from the frame that sees it
  const seed0 = strikeSeed('thunder:9:9:9:0', strikes[0]), strike0 = strikeOf(seed0);
  for (const f of lit) {
    const age = f.s - lit[0].s;   // the light starts on the frame that sees the strike
    assert.ok(Math.abs(f.bolt.strength - env0 * flickerAt(strike0, age)) < 1e-9, `the light is the strike's strokes (${f.bolt.strength} at ${age.toFixed(3)} s)`);
  }
  assert.ok(lit.at(-1).bolt.strength < lit[0].bolt.strength * 0.5, 'and fades');
  assert.equal(lit[0].bolt.x, 10000); assert.equal(lit[0].bolt.r, 5000, 'its heart');
  // the thunder: heard from where the strike LANDED (BOLT: within its storm's core), its distance / 343 seconds after the
  // flash, no sooner
  const [px, pz] = strikePlace(seed0, 10000, 0, 5000), dist = Math.hypot(px, pz);
  assert.ok(Math.hypot(px - 10000, pz) <= 5000 * STRIKE_SPREAD + 1e-6, 'inside its storm\'s core');
  const heard = frames.filter((f) => f.sounds.length);
  const firstHeard = heard[0];
  assert.ok(firstHeard.s >= first + dist / SPEED_OF_SOUND - 1 / 60 && firstHeard.s < first + dist / SPEED_OF_SOUND + 2 / 60, `heard at ${firstHeard.s}, the strike at ${first}`);
  const th = thunderOf(dist);
  assert.ok(Math.abs(firstHeard.sounds[0].volume - th.volume * envelope(SYSTEM_TYPES.thunder, strikes[0] / 400)) < 1e-9, 'as loud as its distance and its strength allow');
  assert.equal(firstHeard.sounds[0].clip, th.clip);
});

test('WEATHER3d: WHOSE STORM - the one overhead is DFU\'s, a rain band never strikes, a storm past hearing only flashes, and two clients agree', () => {
  const quiet = (systems, at) => run(createDistantStorms(), systems, at, 200, 400);
  assert.ok(quiet([storm()], [10000, 0]).every((f) => !f.bolt && !f.sounds.length), 'under its heart: the strobe and the ambience have it');
  assert.ok(quiet([storm({ type: 'rain' })], [0, 0]).every((f) => !f.bolt && !f.sounds.length), 'only thunderstorms strike');
  const far = quiet([storm({ x: THUNDER_AUDIBLE_M + 9000 })], [0, 0]);
  assert.ok(far.some((f) => f.bolt) && far.every((f) => !f.sounds.length), 'seen, not heard');
  const a = run(createDistantStorms(), [storm()], [0, 0], 200, 300), b = run(createDistantStorms(), [storm()], [0, 0], 200, 300);
  assert.deepEqual(a.map((f) => [f.bolt, f.sounds]), b.map((f) => [f.bolt, f.sounds]), 'the same map, the same clock, the same storm');
});

test('WEATHER3d: A JUMP is no backlog - a rest or a load plays no pile of strikes, and a reset forgets the thunder on its way', () => {
  const ds = createDistantStorms();
  ds.tick({ systems: [storm()], at: [0, 0], minutes: 200, seconds: 0 });
  const after = ds.tick({ systems: [storm()], at: [0, 0], minutes: 200 + STRIKE_BACKLOG_MINUTES + 60, seconds: 0.02 });
  assert.equal(after.bolt, null, 'an hour slept is not an hour of lightning in a frame');
  assert.equal(ds.pending(), 0);
  // thunder on its way, then the player travels: it is the old place's
  const ts = createDistantStorms();
  run(ts, [storm()], [0, 0], 200, 200);
  let queued = 0;
  for (let i = 0; i < 20000 && !queued; i++) { ts.tick({ systems: [storm()], at: [0, 0], minutes: 240 + i / 300, seconds: 200 + i / 60 }); queued = ts.pending(); }
  assert.ok(queued > 0, 'thunder on its way');
  ts.reset();
  assert.equal(ts.pending(), 0);
});

test('WEATHER3d: THE BOLT lights its own cloud - aimed at the storm\'s middle, a cone as wide as its cloud, only on cloud', () => {
  const b = boltOf({ x: 3000, z: 4000, r: 5000, strength: 0.8 }, [0, 0]);
  assert.ok(Math.abs(Math.hypot(...b.dir) - 1) < 1e-9);
  assert.ok(Math.abs(b.dir[0] / b.dir[2] - 0.75) < 1e-9, 'toward it');
  assert.ok(Math.abs(b.dir[1] - BOLT_HEIGHT / Math.hypot(5000, BOLT_HEIGHT)) < 1e-9, 'up at the thunderhead\'s middle');
  assert.ok(boltOf({ x: 30000, z: 0, r: 5000, strength: 1 }, [0, 0]).cos > b.cos, 'a far storm fills a narrower cone');
  assert.equal(boltOf({ x: 1, z: 0, r: 5000, strength: 3 }, [0, 0]).strength, 1, 'clamped');
  assert.ok(COMPOSITE_UNIFORMS.includes('uBolt') && COMPOSITE_UNIFORMS.includes('uBoltCos'));
  assert.match(COMPOSITE_FS, /float bolt = uBolt\.w \* smoothstep\(uBoltCos, mix\(uBoltCos, 1\.0, 0\.6\), dot\(dir, uBolt\.xyz\)\);/);
  assert.match(COMPOSITE_FS, /vec3 cloud = op > 1e-4 \? dreadGrade\(c\.rgb \/ op, uDread\) \* op : c\.rgb;\s*\n\s*outColor = vec4\(cloud \* \(1\.0 \+ uFlash \* 2\.0 \+ bolt \* 3\.0\), c\.a\);/, 'on the cloud\'s own radiance - clear sky that way stays dark (EVENT1: the radiance graded by the live event, c.rgb itself without one)');
  const vc = rd('src/render/volumetricClouds.js');
  assert.match(vc, /gl\.uniform4f\(u\.uBolt, b \? b\.dir\[0\] : 0, b \? b\.dir\[1\] : 1, b \? b\.dir\[2\] : 0, b \? b\.strength : 0\); gl\.uniform1f\(u\.uBoltCos, b \? b\.cos : 1\);/, 'no strike, no light');
  assert.match(vc, /setBolt\(b\) \{ this\.bolt = b \? boltOf\(b, this\.cam\) : null; \}/);
});

test('WEATHER3d: the hosts - the scheduler on the map\'s systems, reset on a jump, the bolt to the sky, the thunder from the storm\'s side', () => {
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const h = rd(host);
    assert.match(h, /const distantStorms = createDistantStorms\(\);/, host);
    assert.match(h, /if \(jump \|\| weatherArrivalStamp\(\) !== seenArrival\) \{ distantStorms\.reset\(\); stormLights\.reset\(\); \}[^\n]*\n\s*seenArrival = weatherArrivalStamp\(\);\s*\n\s*const struckFar = \[\];[^\n]*\n\s*if \(isEnhanced\(\) && !weatherOverride\) \{\s*\n\s*const ds = distantStorms\.tick\(\{ systems: currentMapSystems\(\), at: [^\n]*, minutes: playerTicker\.classicMinutes, seconds: now \/ 1000, ground: mapGroundHere \}\);/, `${host}: enhanced only, never under a pin, reset on any landing, the ground law passed`);
    assert.match(h, /sky\.distantBolt\?\.\(bh \? \{ x: bh\[0\], z: bh\[1\], r: ds\.bolt\.r, strength: ds\.bolt\.strength \} : null\);/, `${host}: the bolt, in the host's metres`);
    assert.match(h, /for \(const s of ds\.sounds\) \{ const h = [^;]+; audio\.play3d\(s\.clip, thunderSourceAt\([\w.]+, h\[0\], h\[1\]\), s\.volume, \{ refDistance: THUNDER_SOURCE_M, maxDistance: THUNDER_SOURCE_M \* 8, far: true \}\); \}/, `${host}: the distant storms' thunder at its own volume, from its side (DISC17-B: held there from the ear)`);
  }
  assert.match(rd('src/scenes/shared.js'), /distantBolt\(b\) \{ clouds\?\.setBolt\(b\); \},/);
  assert.match(rd('src/systems/weatherSim.js'), /export const currentMapSystems = \(\) => \(weatherMapOn\(\) \? _mapNear : \[\]\);/, 'nothing off the map\'s lane');
});
