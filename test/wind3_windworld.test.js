// WIND3 (Mac, 2026-09-14: "World space wisps that indicate the direction of wind and wind audio without being too
// loud or overbearing; tree and flora sprite movement with wind") - THE WIND SEEN AND HEARD, off ONE MAPPING.
// Three consumers arrive at once, so the wind→units mapping the hosts had written out three times (twice for the
// rain, once for the grass, the rain still on the fixed gust WIND1 had replaced) becomes one home, systems/
// windDrive.js, read once a frame; the wisps (render/windWisps.js), the loop (systems/windAudio.js) and the flats'
// sway (renderer.js BB_VS) take its numbers with the rain and the grass. Each has its row on the Features home, the
// player's own online, and a kill door.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  windDrive, legacyGust, floraSwayOf, floraSwayOn, WIND_NONE, WIND_STEP_DT_MAX, LAB_WIND_RATE, WIND_SLIDER_MAX,
} from '../src/systems/windDrive.js';
import { WindWispsRenderer, wispCount, wispsOn, WISP_MAX, WISP_FLOOR, WISP_BOX, WISP_VS, WISP_FS, WISP_LOOK } from '../src/render/windWisps.js';
import {
  createWindAudio, windGain, windClipFor, windPitchFor, windSoundOn, WIND_GAIN_MAX, WIND_SLEW_PER_S, WIND_GAIN_FLOOR, WIND_BLOW_AT, WIND_LOOP,
} from '../src/systems/windAudio.js';
import { SOUND } from '../src/systems/soundClips.js';
import { AMBIENT_SOUNDS } from '../src/systems/ambientEffects.js';
import { TALL_FLAT_HEIGHT } from '../src/world/flatDistance.js';
import { labWindSlider } from '../src/render/labGrass.js';
import { FEATURES } from '../src/systems/features.js';
import { PREF_DEFAULTS, setPref } from '../src/systems/uiPrefs.js';
import { setUiSkin, uiSkin } from '../src/systems/uiSkin.js';
import { ONLINE_PLAYERS_OWN_PREFS } from '../src/systems/onlineLane.js';
import { Renderer } from '../src/render/renderer.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const SUNNY = [0.010, 0.004];   // enhancedSky.js's sunny row - the lab's 70

/** A WebGL2 just deep enough for the wisps: every call recorded, the constructor's checks answered. */
function stubGl() {
  const calls = [];
  const consts = { VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 8, TRIANGLES: 15, BLEND: 16, SRC_ALPHA: 17, ONE_MINUS_SRC_ALPHA: 18, CULL_FACE: 19 };
  let ids = 0;
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray') return () => ++ids;
      return (...args) => { calls.push([k, ...args]); };
    },
  });
  return { gl, calls };
}

test('WIND3 windDrive: the one mapping - the classic sky is nothing; a sunny row is the lab\'s 70, a real rate, a unit direction, WIND1\'s gust, and a travel that carries the gust over a clamped frame', () => {
  // no deck: off, and every unit 0 - nothing moves, blows or sounds
  for (const sky of [null, undefined, {}, { cloudShadow: null }]) {
    const d = windDrive(sky, 10, 0.016);
    assert.equal(d.on, false); assert.deepEqual(d.w, [0, 0]); assert.deepEqual(d.dir, [1, 0]);
    assert.equal(d.slider, 0); assert.equal(d.strength01, 0); assert.deepEqual(d.windV, [0, 0]); assert.deepEqual(d.step, [0, 0]);
  }
  assert.deepEqual({ ...WIND_NONE, w: [...WIND_NONE.w] }, { on: false, w: [0, 0], dir: [1, 0], slider: 0, strength01: 0, gust: 1, windV: [0, 0], step: [0, 0] });
  // the sunny deck, with the controller's own gust
  const sky = { cloudShadow: { wind: SUNNY }, gustAt: (t) => 1.25 + t * 0 };
  const d = windDrive(sky, 10, 0.016);
  assert.equal(d.on, true);
  assert.equal(d.slider, labWindSlider(SUNNY)); assert.ok(Math.abs(d.slider - 70) < 1, `the lab's 70: ${d.slider}`);
  assert.ok(near(d.strength01, d.slider / WIND_SLIDER_MAX));
  assert.ok(near(Math.hypot(...d.dir), 1) && near(d.dir[0] * SUNNY[1], d.dir[1] * SUNNY[0]), 'a unit vector along the row');
  assert.equal(d.gust, 1.25, "the controller's envelope (WIND1) - not the fixed stack");
  assert.ok(near(d.windV[0], d.dir[0] * d.slider * LAB_WIND_RATE) && near(d.windV[1], d.dir[1] * d.slider * LAB_WIND_RATE), 'uWindV is the rate WITHOUT the gust');
  assert.ok(Math.hypot(...d.windV) > 10, 'a real push, not a whisper');
  assert.ok(near(d.step[0], d.windV[0] * 1.25 * 0.016) && near(d.step[1], d.windV[1] * 1.25 * 0.016), 'the travel carries the gust and the frame');
  // a hitch integrates at most WIND_STEP_DT_MAX; a bad dt integrates nothing
  const hitch = windDrive(sky, 10, 0.4);
  assert.ok(near(hitch.step[0], d.windV[0] * 1.25 * WIND_STEP_DT_MAX));
  assert.deepEqual(windDrive(sky, 10, NaN).step, [0, 0]); assert.deepEqual(windDrive(sky, 10, -1).step, [0, 0]); assert.deepEqual(windDrive(sky, 10).step, [0, 0]);
  // no envelope on the controller (the mod's deck, a bare deck): WX1's stack, term for term
  const bare = windDrive({ cloudShadow: { wind: SUNNY } }, 3.3, 0.016);
  assert.equal(bare.gust, legacyGust(3.3));
  assert.ok(near(legacyGust(3.3), 0.72 + 0.20 * Math.sin(3.3 * 0.31) + 0.14 * Math.sin(3.3 * 0.83 + 1.7) + 0.10 * Math.sin(3.3 * 2.10 + 0.4)));
  // the thunder row is the slider's top and strength 1
  const storm = windDrive({ cloudShadow: { wind: [0.045, 0.016] } }, 0, 0.016);
  assert.equal(storm.slider, 200); assert.equal(storm.strength01, 1);
});

test('WIND3 floraSwayOf: the climate\'s flora lean - a tree whole, a bush six tenths - and nothing else moves', () => {
  assert.equal(floraSwayOf(504, 504, TALL_FLAT_HEIGHT), 1, 'a tree (TALL_FLAT_HEIGHT and up)');
  assert.equal(floraSwayOf(504, 504, 12), 1);
  assert.equal(floraSwayOf(504, 504, TALL_FLAT_HEIGHT - 0.01), 0.6, 'a bush');
  assert.equal(floraSwayOf(504, 504, 0.5), 0.6);
  for (const other of [182, 210, 253, 255, 267, 275]) assert.equal(floraSwayOf(other, 504, 12), 0, `archive ${other} stands still`);
  assert.equal(floraSwayOf(504, 505, 12), 0, 'another season\'s nature archive is not this climate\'s');
});

test('WIND3 wisps: the count follows the strength with a floor; the renderer compiles two stages, draws nothing without a deck, the floor in a calm, the whole field in a gale, and keeps its travel inside one box', () => {
  assert.equal(wispCount(0), Math.round(WISP_MAX * WISP_FLOOR), 'the floor keeps the direction readable in a calm');
  assert.equal(wispCount(1), WISP_MAX);
  assert.equal(wispCount(2), WISP_MAX); assert.equal(wispCount(-1), wispCount(0));
  let last = -1;
  for (let s = 0; s <= 1.0001; s += 0.05) { const c = wispCount(s); assert.ok(c >= last, 'monotonic'); last = c; }
  assert.ok(wispCount(0.35) > wispCount(0) && wispCount(0.35) < WISP_MAX, 'a sunny day sits between');
  // the shaders: the lab's wrap, a streak along the velocity, a life fade, the strength in both stages
  assert.match(WISP_VS, /p = mod\(p - uEye \+ uBox\*0\.5, uBox\) \+ uEye - uBox\*0\.5;/, 'the lab\'s wrap - a world position wrapped around the eye');
  assert.match(WISP_VS, /p \+= vec3\(uWindOff\.x, 0\.0, uWindOff\.y\) \* gust;/, 'PROTO-19: a distance already travelled, never wind x time');
  assert.match(WISP_VS, /float ph = fract\(uTime\*rate \+ seed\*7\.0\);\n  vLife = sin\(ph \* 3\.14159\);/, 'the wisp\'s own clock (WIND5: its phase also draws the flourish on)');
  assert.match(WISP_VS, /p \+= \(vel \* \(c\.x - 0\.5\) \+ up \* c\.y\) \* len;/, 'stretched along the wind (WIND5: along the flourish\'s path, down the wind and across it in the curl\'s plane)');
  assert.match(WISP_FS, /a \*= vLife \* \(uAlpha\.x \+ uAlpha\.y \* uStrength\);/, 'never more than a breath (WEATHER2d: the look\'s alpha)');
  assert.deepEqual([...WISP_LOOK.alpha], [0.20, 0.24]); assert.deepEqual([...WISP_LOOK.color], [0.86, 0.89, 0.94]);   // DISC17-A: the alpha doubled (WIND3's 0.10, 0.12)
  assert.doesNotMatch(WISP_VS + WISP_FS, /uTime \* uWindV|uWindV \* uTime/, 'no wind x time anywhere');
  const { gl, calls } = stubGl();
  const r = new WindWispsRenderer(gl);
  assert.equal(calls.filter((c) => c[0] === 'compileShader').length, 2);
  assert.equal(calls.filter((c) => c[0] === 'vertexAttribDivisor').length, 1, 'instanced');
  const proj = new Float32Array(16).fill(0); proj[0] = proj[5] = proj[10] = proj[15] = 1;
  const view = new Float32Array(proj);
  calls.length = 0;
  r.draw(WIND_NONE, proj, view, new Float32Array([0, 0, 0]), 1);
  assert.equal(calls.filter((c) => c[0] === 'drawArraysInstanced').length, 0, 'no deck, no wisps');
  assert.equal(r.drawn, 0);
  const calm = { ...windDrive({ cloudShadow: { wind: [0.0001, 0] } }, 1, 0.016) };
  r.draw(calm, proj, view, new Float32Array([0, 0, 0]), 1);
  let dr = calls.filter((c) => c[0] === 'drawArraysInstanced');
  assert.equal(dr.length, 1); assert.equal(dr[0][4], wispCount(calm.strength01)); assert.ok(dr[0][4] >= Math.round(WISP_MAX * WISP_FLOOR));
  calls.length = 0;
  const gale = windDrive({ cloudShadow: { wind: [0.045, 0.016] }, gustAt: () => 1 }, 2, 0.016);
  r.draw(gale, proj, view, new Float32Array([5, 2, 9]), 2);
  dr = calls.filter((c) => c[0] === 'drawArraysInstanced');
  assert.equal(dr[0][4], WISP_MAX); assert.equal(r.drawn, WISP_MAX);
  const off = calls.find((c) => c[0] === 'uniform2fv' && c[1] === 'uWindOff');
  assert.ok(off && near(off[2][0], calm.step[0] + gale.step[0], 1e-5) && near(off[2][1], calm.step[1] + gale.step[1], 1e-5), 'the travel is the sum of the steps');
  assert.ok(calls.some((c) => c[0] === 'depthMask' && c[1] === false) && calls.some((c) => c[0] === 'depthMask' && c[1] === true), 'no depth write, put back');
  assert.ok(calls.some((c) => c[0] === 'blendFunc' && c[1] === 17 && c[2] === 18), 'alpha blended');
  // the travel wraps: a long walk down the wind stays inside [0, WISP_BOX)
  for (let i = 0; i < 100000; i++) r.advance([gale.windV[0] * 0.05, gale.windV[1] * 0.05]);
  assert.ok(r.windOff[0] >= 0 && r.windOff[0] < WISP_BOX && r.windOff[1] >= 0 && r.windOff[1] < WISP_BOX, `bounded: ${r.windOff}`);
  r.advance([-3, -3]);
  assert.ok(r.windOff[0] >= 0 && r.windOff[1] >= 0, 'a backward step wraps up, never negative');
});

test('WIND3 wind loop: the gain never passes the ceiling, is nothing in a calm and the ceiling in a gale, breathes with the gust; the clip goes from the moan to the blow; the driver slews, swaps, stops on the floor and on a modal frame', () => {
  assert.equal(windGain(0), 0); assert.equal(windGain(0.1), 0);
  assert.ok(near(windGain(1, 1), WIND_GAIN_MAX)); assert.ok(near(windGain(0.85, 1), WIND_GAIN_MAX));
  assert.ok(windGain(0.35, 1) > 0 && windGain(0.35, 1) < WIND_GAIN_MAX, 'a sunny day murmurs');
  assert.ok(windGain(0.5, 1.0) > windGain(0.5, 0.5), 'the gust is worth a fifth');
  for (let s = 0; s <= 1; s += 0.01) for (const g of [0, 0.5, 1, 1.2, 2, 10]) assert.ok(windGain(s, g) <= WIND_GAIN_MAX + 1e-12, `never above the ceiling: ${s} ${g}`);
  assert.ok(WIND_GAIN_MAX <= 0.2, "Mac's 'not too loud', as a number");
  assert.equal(windClipFor(0), SOUND.AmbientWindMoan); assert.equal(windClipFor(WIND_BLOW_AT - 0.01), SOUND.AmbientWindMoan);
  assert.equal(windClipFor(WIND_BLOW_AT), SOUND.AmbientWindBlow1); assert.equal(windClipFor(1), SOUND.AmbientWindBlow1);
  assert.ok(windPitchFor(0) < windPitchFor(1) && windPitchFor(1) <= 1.1 && windPitchFor(0) >= 0.9);
  // the driver over a fake engine
  const loops = [];
  const engine = { setLoop: (name, clip, opts) => { loops.push([name, clip, opts]); } };
  const wa = createWindAudio(engine);
  const gale = windDrive({ cloudShadow: { wind: [0.045, 0.016] }, gustAt: () => 1 }, 0, 0.016);
  wa.update(gale, 1 / 60, true);
  assert.equal(loops.length, 1); assert.equal(loops[0][0], WIND_LOOP); assert.equal(loops[0][1], SOUND.AmbientWindBlow1);
  assert.ok(near(loops[0][2].volume, WIND_SLEW_PER_S / 60), 'the first tick is one slew step, not the target - no pop');
  assert.ok(near(loops[0][2].pitch, windPitchFor(1)));
  for (let i = 0; i < 60 * 10; i++) wa.update(gale, 1 / 60, true);
  assert.ok(near(wa.gain, WIND_GAIN_MAX, 1e-9), 'and reaches the ceiling within seconds');
  assert.ok(loops.every((l) => l[2].volume <= WIND_GAIN_MAX + 1e-12));
  // the wind drops to a breeze: the clip swaps to the moan through the same setLoop (the engine swaps at the clip's end)
  const breeze = windDrive({ cloudShadow: { wind: SUNNY }, gustAt: () => 1 }, 0, 0.016);
  wa.update(breeze, 1 / 60, true);
  assert.equal(loops.at(-1)[1], SOUND.AmbientWindMoan);
  assert.ok(loops.at(-1)[2].volume < WIND_GAIN_MAX && loops.at(-1)[2].volume > windGain(breeze.strength01, 1), 'slewing down, not there yet');
  // the switch off: the gain winds down and the loop is stopped once on the floor, then nothing
  loops.length = 0;
  for (let i = 0; i < 60 * 10; i++) wa.update(breeze, 1 / 60, false);
  const stops = loops.filter((l) => l[1] === null);
  assert.equal(stops.length, 1, 'stopped once, on the floor'); assert.equal(wa.gain, 0); assert.equal(wa.playing, false);
  assert.ok(loops.slice(0, loops.indexOf(stops[0])).every((l) => l[2].volume >= WIND_GAIN_FLOOR), 'every tick before the stop was above the floor');
  assert.equal(loops.slice(loops.indexOf(stops[0]) + 1).length, 0, 'no calls after the stop');
  // the classic sky (no deck) never starts it; a modal frame stops it at once
  loops.length = 0;
  wa.update(WIND_NONE, 1 / 60, true); assert.equal(loops.length, 0);
  wa.update(gale, 1 / 60, true); assert.equal(loops.length, 1);
  wa.stop(); assert.deepEqual(loops.at(-1), [WIND_LOOP, null, undefined]); assert.equal(wa.gain, 0);
  wa.stop(); assert.equal(loops.length, 2, 'a second stop is silent');
});

test('WIND3 clips: the five wind records by name, the indices DFU draws as dungeon one-shots', () => {
  assert.equal(SOUND.AmbientWindMoan, 65); assert.equal(SOUND.AmbientWindMoanDeep, 66);
  assert.equal(SOUND.AmbientWindBlow1, 70); assert.equal(SOUND.AmbientWindBlow1a, 71); assert.equal(SOUND.AmbientWindBlow1b, 72);
  for (const i of [65, 66, 70, 71, 72]) assert.ok(AMBIENT_SOUNDS.dungeon.includes(i), `${i} is one of DFU's dungeon ambients`);
});

test('WIND3 rows and switches: three rows on the Features home, on by default, the player\'s own online; each switch is the enhanced skin, its pref, and its kill door', () => {
  // ES1: the wind's own row became the Enhanced sounds row - same place, same shape, the loot cues beside the loop.
  const rows = ['wind-wisps', 'enhanced-sounds', 'flora-sway'].map((id) => FEATURES.find((f) => f.id === id));
  assert.deepEqual(rows.map((r) => r?.control.key), ['windWisps', 'soundEnhancements', 'floraSway']);
  for (const r of rows) {
    assert.deepEqual(r.kinds, ['enhanced']); assert.equal(r.control.store, 'prefs'); assert.equal(r.control.initial, true); assert.equal(r.control.online, 'player');
    assert.equal(r.effect, 'Takes effect at once.'); assert.ok(r.note.length > 80);
    assert.equal(PREF_DEFAULTS[r.control.key], true, 'the shelf derives the default from the row (RF4)');
    assert.ok(ONLINE_PLAYERS_OWN_PREFS.includes(r.control.key), 'the lane leaves it to the player (RF4)');
  }
  assert.equal(FEATURES.findIndex((f) => f.id === 'wind-wisps'), FEATURES.findIndex((f) => f.id === 'loot-rarity') + 1, 'after LR1, before the packs');
  const skin = uiSkin();
  const doors = [[wispsOn, 'windWisps', 'wisps'], [windSoundOn, 'soundEnhancements', 'windaudio'], [floraSwayOn, 'floraSway', 'sway']];
  try {
    for (const [on, key, door] of doors) {
      setUiSkin('enhanced'); setPref(key, true);
      assert.equal(on(''), true, `${key}: on by default on the enhanced skin`);
      assert.equal(on(`?${door}=off`), false, `${key}: the kill door`);
      assert.equal(on(`?${door}=on`), true);
      setPref(key, false); assert.equal(on(''), false, `${key}: the pref is the switch`);
      setPref(key, true); setUiSkin('classic'); assert.equal(on(''), false, `${key}: never on the classic skin`);
    }
  } finally { setUiSkin(skin); for (const [, key] of doors) setPref(key, PREF_DEFAULTS[key]); }
});

test('WIND3 the flats\' sway in the renderer: BB_VS declares the wind and the share, leans the crown by the square of the height with the grass\'s wave, and stands still at uSway 0; one wind upload a call, the share per batch', () => {
  const r = rd('src/render/renderer.js');
  const vs = r.slice(r.indexOf('const BB_VS = `'), r.indexOf('`;', r.indexOf('const BB_VS = `')));
  assert.match(vs, /uniform vec4 uFlatWind;/); assert.match(vs, /uniform float uSway;/);
  assert.match(vs, /if \(uSway > 0\.0\) \{/, 'the shader\'s off switch');
  assert.match(vs, /float gust = sin\(uFlatWind\.z \* 1\.7 - along \* 0\.35 \+ ph\) \* 0\.5 \+ 0\.5;/, 'the grass\'s wave (labGrass.js: 1.7, -along*0.35)');
  assert.match(vs, /float push = wl \* \(0\.55 \+ gust \* 0\.75\) \* 0\.0015 \* uSway;/, 'the grass\'s 0.55/0.75, scaled to a trunk');
  assert.match(vs, /float top = aCorner\.y \+ 0\.5;\s*\n\s*world\.xz \+= wdir \* push \* top \* top \* uSize\.y;/, 'the root stands, the crown moves');
  assert.ok(vs.indexOf('uUp * ((aCorner.y + 0.5) * uSize.y);') < vs.indexOf('if (uSway > 0.0)') && vs.indexOf('if (uSway > 0.0)') < vs.indexOf('vBBWorld = world;'), 'after the quad is placed, before the world position is handed on (the shadow and the fog read the leaned position)');
  assert.match(r, /this\.bbUFlatWind = gl\.getUniformLocation\(this\.bbProgram, 'uFlatWind'\);/);
  assert.match(r, /this\.bbUSway = gl\.getUniformLocation\(this\.bbProgram, 'uSway'\);/);
  assert.match(r, /setFlatWind\(v\) \{\s*\n\s*const fw = this\._flatWind \?\?= new Float32Array\(4\);\s*\n\s*if \(v\) \{ fw\[0\] = v\[0\] \|\| 0; fw\[1\] = v\[1\] \|\| 0; fw\[2\] = v\[2\] \|\| 0; fw\[3\] = v\[3\] \|\| 0; \} else fw\.fill\(0\);/);
  // the METHOD's body, found by its own closing brace rather than by a
  // count of characters: the fixed 6,000-char window this replaces slid
  // off the end the moment PERF-CROWD2 added the frustum test above these
  // lines, and a pin that stops covering its subject because the subject
  // moved is a pin that fails for the wrong reason.
  const dbStart = r.indexOf('  drawBillboards(batches, camRight, camUp) {');
  const db = r.slice(dbStart, r.indexOf('\n  }\n', dbStart));
  assert.equal((db.match(/gl\.uniform4fv\(this\.bbUFlatWind, this\._flatWind \?\? ZERO_FLAT_WIND\);/g) || []).length, 1, 'one wind upload a call');
  assert.match(db, /const sw = b\.sway \|\| 0;[^\n]*\n\s*if \(sw !== lastSway\) \{ gl\.uniform1f\(this\.bbUSway, sw\); lastSway = sw; \}/, 'the share per batch, uploaded when it changes');
  assert.match(db, /let lastSway = null;/, 'the first batch always uploads');
  // executed: the prototype's setFlatWind holds four numbers and clears to zero
  const bare = Object.create(Renderer.prototype);
  bare.setFlatWind([1.5, -2, 30, 1.1]);
  assert.deepEqual([...bare._flatWind], [1.5, -2, 30, 1.100000023841858]);
  bare.setFlatWind(null);
  assert.deepEqual([...bare._flatWind], [0, 0, 0, 0]);
  bare.setFlatWind([undefined, NaN, null, 2]);
  assert.deepEqual([...bare._flatWind], [0, 0, 0, 2], 'a bad number is 0, never NaN in the shader');
});

test('WIND3 the hosts: both exterior hosts read the one wind once a frame, feed the rain\'s rate and travel from it, draw the wisps after the rain as a foreign pass, tick the loop beside the ambience and stop it on the modal frame, hand the flats the wind before their draw, and tag the flora batches - and hold no copy of the mapping', () => {
  for (const [host, eye] of [['src/scenes/world.js', 'cam.pos'], ['src/scenes/exterior.js', 'eye']]) {
    const s = rd(host);
    const one = (re, what) => assert.equal((s.match(re) || []).length, 1, `${host}: ${what}`);
    one(/const wd = windDrive\(sky, now \/ 1000, dt\);/g, 'the one read');
    one(/precip\.windV\[0\] = wd\.windV\[0\]; precip\.windV\[1\] = wd\.windV\[1\];/g, 'the rain\'s rate');
    one(/precip\.windOff\[0\] \+= wd\.step\[0\]; precip\.windOff\[1\] \+= wd\.step\[1\];/g, 'the rain\'s travel');
    assert.ok(!/_lastNow|labWindSlider|Math\.sin\(tsec \* 0\.31\)/.test(s), `${host}: no copy of the mapping, no private rain clock`);
    const wisp = s.indexOf('if (wisps && wd.on && wispsOn()) {');
    assert.ok(wisp > 0 && wisp > s.indexOf('precip.draw(precipShown, proj, view'), `${host}: the wisps after the rain`);
    assert.ok(s.slice(wisp, wisp + 300).includes(`wisps.draw(wd, proj, view, new Float32Array(${eye}), now / 1000);\n      renderer.markForeignPass();`), `${host}: their own program is a foreign pass`);
    one(/const wisps = sky\.enhanced \? new WindWispsRenderer\(renderer\.gl\) : null;/g, 'built on the enhanced lane at boot');
    one(/const windAudio = createWindAudio\(\);/g, 'the loop\'s driver');
    const amb = s.indexOf('ambience.update(dt, { playerPos:');
    assert.ok(s.slice(amb, amb + 400).includes('windAudio.update(wd, dt, windSoundOn());'), `${host}: the loop ticks beside DFU's ambience`);
    const modal = s.indexOf('if (modes.frame(dt, now)) {');
    assert.ok(s.slice(modal, modal + 900).includes('windAudio.stop();'), `${host}: silent indoors`);
    assert.ok(s.indexOf('windAudio.stop();') < s.indexOf('windAudio.update(wd, dt, windSoundOn());'), `${host}: the modal branch returns before the exterior tick`);
    one(/renderer\.setFlatWind\(floraSwayOn\(\) && wd\.on \? \[wd\.windV\[0\], wd\.windV\[1\], now \/ 1000, wd\.gust\] : null\);[^\n]*\n\s*renderer\.drawBillboards\(/g, 'the flats\' wind, right before their draw');
    assert.equal((s.match(/batch\.sway = floraSwayOf\(archive, natureArchive, (sib\.)?size\.h\);/g) || []).length, 2, `${host}: the season's batch and the classic one tagged`);
    for (const imp of ["from '../systems/windDrive.js'", "from '../render/windWisps.js'", "from '../systems/windAudio.js'"]) assert.ok(s.includes(imp), `${host}: imports ${imp}`);
  }
  assert.match(rd('src/scenes/world.js'), /\{ dir: wd\.dir, speed: wd\.slider \* wd\.gust, windV: wd\.windV \}/, 'the grass takes the same answer');
});

test('WIND3 records: the rendering page, the features arc, the ledger\'s wind row and the testing row', () => {
  assert.match(rd('bible/07-Rendering/Rendering.md'), /\*\*WIND3 \(2026-09-14\) THE WIND\s+SEEN AND HEARD\.\*\*/, 'the heading wraps on the page');
  assert.match(rd('bible/10-UI/Features-Arc.md'), /^## WIND3 - THE WIND'S THREE ROWS \(2026-09-14\)/m);
  assert.match(rd('bible/01-Overview/Port-Ledger.md'), /\*\*THE WIND \(WIND1, 2026-09-02\)\*\*[^\n]*WIND3 \(2026-09-14\): the wind is seen and heard/);
  assert.match(rd('bible/09-Testing/Testing.md'), /^\| wind3_windworld\.test\.js \| \d+ \| WIND3/m);
});
