import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MILL_SOUND, millSoundPosition, machineryChildPos, ROTOR_HUB } from '../src/world/windmills.js';
import { MACHINERY_CHILDREN } from '../src/world/windmillMesh.js';
import { SOUND } from '../src/systems/soundClips.js';
import { identity, trs, transformPoint } from '../src/world/mat4.js';
import { AudioEngine } from '../src/systems/audio.js';

// WM4c - THE MILL HUMS. Kamer's Spin_Up.Start adds a DaggerfallAudioSource
// and sets SoundClips.ArenaFireDaemon to LoopOnAwake, on the sail and on
// the machinery's plank gear. Everything about the source but the clip
// and the preset is Unity's fresh-AudioSource default, and the pins
// below hold that profile against DFU's own code and Unity's own
// numbers, then sweep the four hosts for the start, the move, and the
// three ways it must stop.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

test('WM4c: the clip is ArenaFireDaemon, and the profile is a default DaggerfallAudioSource', () => {
  // SoundClips.cs:40 - ArenaFireDaemon = 11. Spin_Up.cs:
  //   source1.SetSound(sound, AudioPresets.LoopOnAwake)
  // with spatialBlend defaulting to 1 (DaggerfallAudioSource.cs:164).
  // The AudioSource AddComponent creates carries Unity's defaults:
  // logarithmic rolloff, minDistance 1, maxDistance 500 - and
  // DaggerfallAudioSource never touches those. Its LoopOnAwake arm sets
  // volume = Settings.SoundVolume at play, which here is the master bus.
  assert.equal(SOUND.ArenaFireDaemon, 11);
  assert.equal(MILL_SOUND.clip, 11);
  assert.equal(MILL_SOUND.refDistance, 1);
  assert.equal(MILL_SOUND.maxDistance, 500);
  assert.equal(MILL_SOUND.distanceModel, 'inverse');   // play3d's own reading of Unity's logarithmic
  assert.equal(MILL_SOUND.volume, 1);
  assert.ok(Object.isFrozen(MILL_SOUND));
});

test('WM4c: the source sits on the GameObject that carries Spin_Up - the sail outside, the gear inside', () => {
  // The exterior source is on the prefab's Blade child, which stands at
  // ROTOR_HUB; under a placement it is the hub carried through.
  const m = trs(10, 2, -7, 0, 90, 0);
  const at = millSoundPosition(m);
  const hub = transformPoint(m, ROTOR_HUB[0], ROTOR_HUB[1], ROTOR_HUB[2]);
  assert.ok(at.every((v, i) => near(v, hub[i])), 'the hum is not at the hub');
  assert.ok(!near(at[0], 10) || !near(at[2], -7), 'the hub offset was lost');
  // Inside, the flag is on the child whose script is Spin_Up and on no
  // other; the roller's script adds no source.
  const gear = MACHINERY_CHILDREN.find((c) => c.name === 'Plank_Gear');
  const roller = MACHINERY_CHILDREN.find((c) => c.name === 'Roller');
  assert.equal(gear.loopsSound, true);
  assert.equal(roller.loopsSound, false);
  const gp = machineryChildPos(identity(), gear);
  assert.deepEqual(gp.map((v) => +v.toFixed(2)), [11.02, 4.49, -2.28]);
  // And that flag is the vendored record's, not a copy.
  const json = JSON.parse(read('vendor/windmills-kamer/machinery.json'));
  assert.deepEqual(MACHINERY_CHILDREN.map((c) => c.loopsSound), json.children.map((c) => c.loopsSound));
});

test('WM4c: loop3d takes a distance model, defaults LINEAR so the torches do not move, and its handle MOVES', () => {
  const src = read('src/systems/audio.js');
  const fn = src.slice(src.indexOf('  loop3d('), src.indexOf('  /** Per-frame listener sync'));
  assert.match(fn, /distanceModel = 'linear'/, 'the torches\' default changed');
  assert.match(fn, /pan\.distanceModel = distanceModel;/, 'the parameter is not applied');
  assert.match(fn, /move\(p\) \{\s*\n\s*pan\.positionX\.value = p\[0\]; pan\.positionY\.value = p\[1\]; pan\.positionZ\.value = p\[2\];/,
    'the handle cannot follow a floating origin');
  // Before the context exists the engine answers null and nothing
  // throws - which is what lets the hosts retry every frame.
  const engine = new AudioEngine();
  assert.equal(engine.loop3d(MILL_SOUND.clip, [0, 0, 0], 1, MILL_SOUND), null);
  // The torch call site still passes NO model, so it rides the default.
  assert.match(read('src/scenes/dungeonContext.js'), /audio\.loop3d\(SOUND\.Burning, t\.pos, TORCH_VOLUME, \{ maxDistance: TORCH_MAX_DISTANCE \}\)/);
});

test('WM4c: both exterior hosts start the hum per mill, ungated on the wind, and silence it indoors', () => {
  for (const host of ['src/scenes/exterior.js', 'src/scenes/world.js']) {
    const h = read(host);
    assert.match(h, /MILL_SOUND, millSoundPosition \} from '\.\.\/world\/windmills\.js'/, `${host}: no import`);
    assert.match(h, /if \(!w\.hum\) w\.hum = audio\.loop3d\(MILL_SOUND\.clip, (millSoundPosition\([^)]*\)|at), MILL_SOUND\.volume, MILL_SOUND\)/,
      `${host}: does not start the hum`);
    // The start is not inside the `if (wind)` gate: his source knows
    // nothing of the weather.
    const startAt = h.indexOf('w.hum = audio.loop3d');
    const windGate = h.lastIndexOf('if (wind) {', startAt);
    const windGateEnd = windGate < 0 ? -1 : h.indexOf('\n      }\n', windGate);
    assert.ok(windGate < 0 || windGateEnd < startAt, `${host}: the hum is gated on the wind`);
    // Indoors: the modal frame stops every mill (PlayerEnterExit
    // disables the exterior parent; a disabled AudioSource stops).
    assert.match(h, /if \(modes\.frame\(dt, now\)\) \{[\s\S]{0,700}w\.hum\?\.stop\(\); w\.hum = null;/, `${host}: does not silence the mills indoors`);
  }
  // The streaming host MOVES the source with its pixel and stops it
  // when the pixel is destroyed.
  const world = read('src/scenes/world.js');
  assert.match(world, /else w\.hum\.move\(at\);/, 'world.js: the hum does not follow the floating origin');
  // A1 MOVED THIS PIN: destroyPixel took a `{ collectLoose }` option so
  // a season re-skin can tear a pixel down WITHOUT running the unload's
  // loose-object sweep (DaggerfallLocation re-skins standing terrain,
  // it does not unload it). The hum law is untouched - a torn-down
  // pixel still stops its mills, whichever door it came through - so
  // the pin follows the signature rather than weakening.
  assert.match(world, /function destroyPixel\(px, py, \{ collectLoose = true \} = \{\}\) \{[\s\S]{0,600}w\.hum\?\.stop\(\); w\.hum = null;/, 'world.js: a destroyed pixel leaves its hum behind');
});

test('WM4c: both interior hosts start the gear\'s hum on the part that carries Spin_Up, and the room\'s teardown ends it', () => {
  for (const host of ['src/scenes/interior.js', 'src/scenes/worldModes.js']) {
    const h = read(host);
    assert.match(h, /machineryChildPos, MILL_SOUND \} from '\.\.\/world\/windmills\.js'/, `${host}: no import`);
    assert.match(h, /if \(r\.child\.loopsSound && !r\.hum\) r\.hum = audio\.loop3d\(MILL_SOUND\.clip, machineryChildPos\(r\.parent, r\.child\), MILL_SOUND\.volume, MILL_SOUND\)/,
      `${host}: does not start the gear's hum`);
  }
  const ctx = read('src/scenes/interiorContext.js');
  // RE-BASELINED at ROAD-C c2/S9: the interior automap record is dropped
  // in the same teardown, one statement ahead of the hum.
  assert.match(ctx, /destroy\(\) \{[\s\S]{0,700}for \(const r of rotors\) \{ r\.hum\?\.stop\(\); r\.hum = null; \}/, 'the context does not stop the hum on destroy');
});
