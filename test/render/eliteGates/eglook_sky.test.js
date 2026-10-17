// EG-LOOK (2026-10-15, Mac: "Literally everything, and no band aids"; bible/11-Multiplayer/Elite-Gates-Look.md section 6 and
// section 7's sky): THE SPIRE'S SKIES, PAINTED - each band's realm painted into an octahedral map a quadrant a frame by its
// own painter (render/eliteGates/egSkyMap.js), fetched by one triangle at the far plane (render/eliteGates/egSkyPass.js), SD5b's law. Pinned on
// the code the GPU runs (test/glsl.mjs runs the painters' and the fetch's own text): the horizon is the band's fog; the
// zenith is the void (L0); the realm lights the deep below; the Deadlands' spires stand black on the line, the Wellhead's
// eruptions burn on its rim, the Evergloam's moon hangs huge and low on the key light's own bearing; every live drift is
// whole cycles over the period, so the sky never jumps; the sky's pixels are Daggerfall's own sky pixel on the ring grid,
// through the pixel law; the painted underside is gone (the wreck's model is the one). The map: whole at a band's first
// paint, a quadrant a frame after, a quarter of that on the phones' tier, every GL object freed; the fetch draws nothing
// until its band is painted whole, and hands back every state it set.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { glslFunctions } from '../../glsl.mjs';
import { EG_SKY_PAINT_FS, EG_SKY_PERIOD, EG_SKY_HAZE, EG_SKY_DRIFT, EG_SKY_SPIRES, EG_SKY_ERUPTIONS, EG_SKY_MOON, EG_SKY_THORNS, EG_SKY_CAIRNS, EG_SKY_MAP, egSkyHaze, egSkyClock, EgSkyMap } from '../../../src/render/eliteGates/egSkyMap.js';
import { EG_SKY_FS, EG_SKY_VS, EgSkyPass, egSkyLift, EG_SKY_LIGHT } from '../../../src/render/eliteGates/egSkyPass.js';
import { SD_SKY_PERIOD, octEncode } from '../../../src/render/superDungeon/sdSky.js';
import { SKY_ANGLE_PER_PIXEL } from '../../../src/render/skyRenderer.js';
import { egAtmosOf, EG_ATMOS } from '../../../src/world/eliteGates/egAtmos.js';
import { EG_SKIES } from '../../../src/world/eliteGates/egLook.js';
import { createEgLookDraw } from '../../../src/scenes/eliteGates/egLookDraw.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const luma = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const dir = (az, e) => [Math.cos(e) * Math.sin(az), Math.sin(e), Math.cos(e) * Math.cos(az)];
const painter = (b, T = 40) => glslFunctions(EG_SKY_PAINT_FS[b], { uTime: T });
/** The sky a viewer sees along `d` on the classic set (the fetch's haze over the realm, at gain 1), before the dither. */
const seen = (F, d, b, cell = [7, 3]) => { const t = F.skyAt(d, cell), f = egAtmosOf(b).fog.color; return [0, 1, 2].map((i) => t[i] * (1 - t[3]) + f[i] * t[3]); };

test('EG-LOOK THE HORIZON IS THE FOG (section 6: "the horizon meets each band\'s fog colour so the far wreck melts into it"): every painter holds all of the haze on the line itself, at every azimuth - its spires, cairns, thorns, cliffs and eruptions with it - and the fetch mixes the frame\'s own fog by that share, so the line is the frame\'s fog on either lane; the haze falls away by one law each side (mutants: a painter\'s landmark kept off the haze at the line; the fetch\'s haze its own colour; the law\'s fall)', () => {
  for (let b = 0; b < 4; b++) {
    const F = painter(b);
    for (let k = 0; k < 48; k++) {
      const az = -Math.PI + (k + 0.5) * (2 * Math.PI / 48);
      assert.equal(F.skyAt(dir(az, 0), [k, 1])[3], 1, `band ${b} az ${az.toFixed(2)}: all fog on the line`);
    }
    // every landmark's own foot on the line too (the spires', the cairns' and the thorns' azimuths, the eruptions' rims)
    const feet = [...(b === 0 ? EG_SKY_SPIRES : []), ...(b === 1 ? EG_SKY_CAIRNS : []), ...(b === 3 ? EG_SKY_ERUPTIONS : [])].map((s) => s[0]);
    if (b === 2) for (const t of EG_SKY_THORNS) feet.push(EG_SKY_MOON.az + t[0]);
    for (const az of feet) assert.equal(F.skyAt(dir(az, 0), [3, 3])[3], 1, `band ${b}: a landmark's foot at ${az.toFixed(2)} in the fog`);
    for (const e of [0.05, 0.15, -0.05, -0.2]) assert.ok(Math.abs(F.hazeAt(e) - egSkyHaze(b, e)) < 1e-12, 'the painter\'s law is EG_SKY_HAZE\'s');
    assert.ok(egSkyHaze(b, 0.3) < 0.1 && egSkyHaze(b, 0.02) > 0.6 && egSkyHaze(b, -0.02) > 0.8, `band ${b}: the haze thins away from the line`);
  }
  for (const H of EG_SKY_HAZE) assert.ok(H.up > 0 && H.down > 0 && H.far > 0 && H.far < 1);
  const fetch = glslFunctions(EG_SKY_FS, { uLift: 0.59, uFog: [0.056, 0.0175, 0.0105], uSteps: 10 });
  assert.deepEqual(fetch.egSkyHazed([0.9, 0.4, 0.1, 1]), [0.056, 0.0175, 0.0105], 'the line: the frame\'s fog, whatever lies behind');
  const clear = fetch.egSkyHazed([0.9, 0.4, 0.1, 0]);
  assert.ok(clear.every((v, i) => Math.abs(v - [0.9, 0.4, 0.1][i] * 0.59) < 1e-9), 'clear of the haze: the realm\'s light at the lane\'s lift');
});

test('EG-LOOK THE VOID OVERHEAD, THE REALM BELOW (SD-LOOK\'s value ladder - the void is dark): every band\'s zenith at L0 (display luminance at or under 0.04), the air over the line under the haze band\'s 0.18; below, each realm\'s own light - the fire-sea\'s currents, the mist\'s swells, the magma\'s seams - lit far past the zenith but never past L2\'s 0.5, the Evergloam\'s dark below, its silver mist glinting (mutants: a zenith lifted; the deep\'s light gone)', () => {
  for (let b = 0; b < 4; b++) {
    const F = painter(b), S = egAtmosOf(b).sky;
    assert.ok(luma(S.zenith) <= 0.04, `band ${b}: the zenith's colour at L0`);
    assert.ok(luma(S.horizon) <= 0.18, `band ${b}: the air over the line under the haze band`);
    let zen = 0;
    for (let k = 0; k < 48; k++) zen += luma(seen(F, dir(k * 0.13, 1.35 + (k % 3) * 0.07), b, [k * 3, k])) / 48;   // its stars are points, not the void
    assert.ok(zen <= 0.04, `band ${b}: the zenith seen at ${zen.toFixed(4)}`);
    let deep = 0, mean = 0, top = 0;
    for (let k = 0; k < 96; k++) { const l = luma(seen(F, dir(k * 0.37, -0.5 - (k % 6) * 0.15), b, [k, k * 5])); deep = Math.max(deep, l); mean += l / 96; }
    for (const S2 of Object.values(S)) top = Math.max(top, luma(S2));
    if (b === 2) assert.ok(mean < 0.04 && deep > 0.05 && deep <= 0.5, `the Evergloam's dark below (${mean.toFixed(3)}), its silver mist glinting (${deep.toFixed(3)})`);
    else assert.ok(deep > 0.2 && deep <= 0.5 && mean < 0.25, `band ${b}: the realm's light below (${deep.toFixed(3)}, its mean ${mean.toFixed(3)})`);
    assert.ok(top <= 0.85, `band ${b}: no colour of the sky past L3 (${top.toFixed(3)})`);
  }
});

test('EG-LOOK THE REALMS\' LANDMARKS (section 6): the Deadlands\' volcano spires stand black against the glow over the line, a vent burning at a crag; the Wellhead\'s eruptions burn on the crater\'s rim; the Evergloam\'s moon hangs HUGE and LOW on the Shade\'s key light\'s own bearing (the light falls from it), its face lit and its limb hazed by its cold halo, thorns black against its lower limb; the Soul Cairn\'s stars crowd thick, cold white and cyan (mutants: the moon off the key\'s bearing; a spire lit; the eruptions\' fire gone)', () => {
  const G = painter(0);
  for (const s of EG_SKY_SPIRES) {
    const at = seen(G, dir(s[0], s[1] * 0.5), 0), air = seen(G, dir(s[0] + s[2] * 4 + 0.05, s[1] * 0.5), 0);
    assert.ok(luma(at) < luma(air) * 0.75, `a spire at ${s[0]} darker than the air beside it (${luma(at).toFixed(3)} against ${luma(air).toFixed(3)})`);
  }
  assert.ok(EG_SKY_SPIRES.some((s) => s[3] === 1) && EG_SKY_SPIRES.length >= 6, 'spires all round, vents among them');
  // the moon: the key's bearing, huge, low
  const key = egAtmosOf(2).key.dir;
  assert.ok(Math.abs(Math.atan2(key[0], key[2]) - EG_SKY_MOON.az) < 1e-12, 'on the key light\'s bearing');
  assert.ok(EG_SKY_MOON.r >= 0.18, 'huge: over 20 degrees across');
  assert.ok(EG_SKY_MOON.elev - EG_SKY_MOON.r > 0.03 && EG_SKY_MOON.elev - EG_SKY_MOON.r < 0.15, 'low: its lower limb a few degrees over the line');
  const S = painter(2), A = egAtmosOf(2).sky;
  const face = seen(S, EG_SKY_MOON.dir, 2), sky = seen(S, dir(EG_SKY_MOON.az + Math.PI, EG_SKY_MOON.elev), 2);
  assert.ok(luma(face) > 0.15 && luma(face) <= luma(A.high) + 1e-9 && luma(sky) < 0.02, `the moon's face lit (${luma(face).toFixed(3)}) in the near-black (${luma(sky).toFixed(4)})`);
  const halo = seen(S, dir(EG_SKY_MOON.az, EG_SKY_MOON.elev + EG_SKY_MOON.r + 0.02), 2);
  assert.ok(luma(halo) > luma(sky) * 2, 'its cold halo about it');
  const thorn = EG_SKY_THORNS[0], tip = EG_SKY_MOON.az + thorn[0];
  assert.ok(luma(seen(S, dir(tip, EG_SKY_MOON.elev - EG_SKY_MOON.r + 0.02), 2)) < 0.02, 'a thorn black against its lower limb');
  // the Wellhead: the eruptions' fountains burn on the rim
  const W = painter(3);
  for (const s of EG_SKY_ERUPTIONS) {
    const foot = W.rimAt(s[0]), fire = W.skyAt(dir(s[0], foot + 0.01), [1, 1]);
    assert.ok(luma(fire) > 0.45 && fire[0] > fire[2] * 3, `the eruption at ${s[0]} burns on the rim (${luma(fire).toFixed(3)})`);
  }
  // the Cairn: thick with stars, cold white and cyan - a share of the upper sky's texels lit far over its void
  const C = painter(1);
  let lit = 0, cyan = 0;
  for (let k = 0; k < 4000; k++) { const c = C.skyAt(dir(k * 0.017, 0.5 + (k % 50) * 0.02), [k % 97, Math.floor(k / 97)]); if (luma(c) > 0.12) { lit++; if (c[2] > c[0] * 1.5 && c[1] > c[0] * 1.5) cyan++; } }
  assert.ok(lit / 4000 > 0.012 && cyan > 0 && cyan < lit, `thick with soul-stars: ${(lit / 40).toFixed(1)}% of texels, ${cyan} cyan`);
});

test('EG-LOOK ONLY SLOW DRIFTS, ON WHOLE CYCLES (section 6: "the sky never jumps"): every live drift of every painter is a whole number of cycles over the period (the Hour\'s), the clock handed wrapped, and a painter at the period\'s end paints what it paints at its start, everywhere; the sky moves (mutants: a drift off its whole cycles; the clock unwrapped)', () => {
  assert.equal(EG_SKY_PERIOD, SD_SKY_PERIOD, 'one clock with the Hour\'s sky');
  assert.equal(egSkyClock(EG_SKY_PERIOD + 7.5), 7.5); assert.equal(egSkyClock(-2), EG_SKY_PERIOD - 2);
  for (const D of EG_SKY_DRIFT) for (const [k, n] of Object.entries(D)) assert.ok(Number.isInteger(n) && n > 0, `${k}: ${n} whole cycles`);
  for (let b = 0; b < 4; b++) {
    const A = painter(b, 0), B = painter(b, EG_SKY_PERIOD - 1e-9), M = painter(b, EG_SKY_PERIOD * 0.37);
    let moved = 0;
    for (let k = 0; k < 40; k++) {
      const d = dir(k * 0.7, -1.2 + k * 0.065), cell = [k * 11, k * 3];
      const a = A.skyAt(d, cell), z = B.skyAt(d, cell), m = M.skyAt(d, cell);
      for (let i = 0; i < 4; i++) assert.ok(Math.abs(a[i] - z[i]) < 1e-5, `band ${b} sample ${k}: the period's end is its start`);
      if (Math.abs(a[0] - m[0]) + Math.abs(a[1] - m[1]) + Math.abs(a[2] - m[2]) > 1e-6) moved++;
    }
    assert.ok(moved > 0, `band ${b}: something drifts`);
  }
  for (const fs of EG_SKY_PAINT_FS) assert.match(fs, new RegExp(`const float PERIOD = ${EG_SKY_PERIOD.toFixed(1)};`));
});

test('EG-LOOK THE SKY\'S PIXEL (SD-LOOK\'s pixel law): the fetch snaps the ray to Daggerfall\'s own sky pixel (pi/512) on the port\'s ring grid - rows of constant elevation, square to the horizon - taps the map once at the cell\'s centre, and lays the whole through SD_PIXEL_GLSL at the cell, on the square-root ramp (so every colour it answers is a step of that ramp); the realm\'s light at the gain\'s root, the haze the frame\'s fog; one triangle at the far plane (mutants: the ray unsnapped; the dither off the cell; the lift the gain itself)', () => {
  assert.match(EG_SKY_FS, new RegExp(`const float CELL = ${SKY_ANGLE_PER_PIXEL.toFixed(8)};`));
  assert.match(EG_SKY_FS, /vec3 c = ringSnap\(normalize\(d\), CELL, cell\);/);
  assert.match(EG_SKY_VS, /gl_Position = vec4\(aPos, 1\.0, 1\.0\);/, 'at the far plane');
  assert.equal(egSkyLift(1), 1); assert.ok(Math.abs(egSkyLift(0.35) - Math.sqrt(0.35)) < 1e-12); assert.equal(EG_SKY_LIGHT.pow, 0.5);
  const taps = [];
  const store = (x, y) => { const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; const f = h - Math.floor(h); return [0.2 + 0.5 * f, 0.1 + 0.3 * f, 0.05, f > 0.5 ? 0.3 : 0]; };
  const F = glslFunctions(EG_SKY_FS, { uLift: 1, uFog: [0.16, 0.05, 0.03], uSteps: 8, texelFetch: (_s, tx) => { taps.push(tx); return store(tx[0], tx[1]); } });
  for (let k = 0; k < 64; k++) {
    const d = dir(k * 0.31, -0.4 + k * 0.012), c = F.egSkyFetch(d);
    const s = Math.sqrt(Math.max(...c));
    assert.ok(Math.abs(s * 8 - Math.round(s * 8)) < 1e-6, `sample ${k}: a step of the ramp (${s})`);
  }
  // the same cell, the same texel: two rays inside one ring cell tap one texel
  taps.length = 0;
  const d1 = dir(0.4, 0.2), centre = F.ringSnap(d1, SKY_ANGLE_PER_PIXEL, { value: [0, 0] }), mid = d1.map((v, i) => (v + centre[i]) / 2);
  F.egSkyFetch(mid); F.egSkyFetch(centre);
  assert.deepEqual(taps[0], taps[1], 'one cell, one tap');
  const uv = octEncode(centre);
  assert.deepEqual(taps[1], [Math.floor(uv[0] * EG_SKY_MAP), Math.floor(uv[1] * EG_SKY_MAP)], 'the map at the cell\'s centre');
});

test('EG-LOOK ONE UNDERSIDE, NEVER TWO (section 4: "The sky\'s painted disc goes"): no painter and no fetch paints the Spire\'s underside - it is the wreck\'s model (world/eliteGates/egVista.js) at EG_SKIES\' angular size; the skies\' colours are the band\'s air\'s (world/eliteGates/egAtmos.js - one home), the stair\'s void read from them (mutants: the disc painted again; a sky colour of its own)', () => {
  for (const fs of [...EG_SKY_PAINT_FS, EG_SKY_FS]) assert.ok(!/UNDER|underside|LEAN/.test(fs), 'no underside in the sky');
  assert.ok(!/underside|EG_SKIES/.test(rd('src/render/eliteGates/egSkyPass.js').replace(/^\/\/.*$/gm, '')), 'the fetch reads no underside');
  for (let b = 0; b < 4; b++) {
    const A = EG_ATMOS[b].sky;
    assert.equal(EG_SKIES[b].zenith, A.zenith); assert.equal(EG_SKIES[b].horizon, A.horizon); assert.equal(EG_SKIES[b].deep, A.up);
    assert.ok(EG_SKIES[b].underside > 0 && Number.isFinite(EG_SKIES[b].lean), 'the wreck\'s underside size kept');
  }
  assert.deepEqual(EG_SKIES.map((s) => s.underside), [0.34, 0.22, 0.13, 0.07], 'smaller each band');
});

/** A WebGL2 that records what is asked of it, every object it makes live until deleted. */
function recordingGl(w = 1280, h = 720) {
  const calls = [], live = new Map();
  let ids = 0, stray = 0;
  const gl = new Proxy({ drawingBufferWidth: w, drawingBufferHeight: h, VERTEX_SHADER: 'VS', FRAGMENT_SHADER: 'FS' }, { get(t, k) {
    if (k in t) return t[k];
    if (typeof k !== 'string') return undefined;
    if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
    if (k === 'getUniformLocation') return (p, n) => ({ p, n });
    if (/^create(Buffer|VertexArray|Texture|Program|Framebuffer|Shader)$/.test(k)) return (...a) => { const o = { kind: k.slice(6), id: ++ids }; live.set(o, o.kind); calls.push([k, ...a]); return o; };
    if (/^delete(Buffer|VertexArray|Texture|Program|Shader|Framebuffer)$/.test(k)) return (o) => { if (o && !live.delete(o)) stray++; };
    if (k.toUpperCase() === k) return k;
    return (...a) => { calls.push([k, ...a]); };
  } });
  const count = () => { const c = {}; for (const k of live.values()) c[k] = (c[k] ?? 0) + 1; return c; };
  return { gl, calls, count, stray: () => stray };
}

test('EG-LOOK THE MAP (render/eliteGates/egSkyMap.js): a band\'s first paint paints the whole map (four quadrants), each paint after one quadrant in turn, a new band whole again; the phones\' tier a quadrant every fourth call; the painter of each band built once, the paint hands back the frame\'s framebuffer and the caller\'s viewport; released, every texture, framebuffer, program, buffer and vertex array goes, once (mutants: the whole repainted every frame; a band\'s change kept a quadrant; the lite tier painting every call; the map\'s texture kept)', () => {
  const R = recordingGl();
  const map = new EgSkyMap(/** @type {any} */ (R.gl));
  const draws = () => R.calls.filter((c) => c[0] === 'drawArrays').length;
  const vp = [0, 0, 640, 360];
  assert.equal(map.holds(0), false);
  map.paint(0, 10, vp);
  assert.equal(draws(), 4, 'the whole map at the first paint');
  assert.equal(map.holds(0), true);
  const vps = R.calls.filter((c) => c[0] === 'viewport');
  assert.deepEqual(vps.at(-1).slice(1), vp, 'the caller\'s viewport handed back');
  map.paint(0, 10.016, vp); map.paint(0, 10.032, vp);
  assert.equal(draws(), 6, 'then a quadrant a paint');
  map.paint(2, 10.05, vp);
  assert.equal(draws(), 10, 'another band: whole again');
  assert.equal(map.holds(0), false); assert.equal(map.holds(2), true);
  assert.equal(R.calls.filter((c) => c[0] === 'createProgram').length, 2, 'a painter a band, built once');
  const progs = R.count().Program;
  map.release(); map.release();
  assert.deepEqual(R.count(), {}, 'every object freed');
  assert.equal(R.stray(), 0, 'nothing freed twice');
  assert.equal(progs, 2);
  // the phones' tier
  const L = recordingGl(), lite = new EgSkyMap(/** @type {any} */ (L.gl), { lite: true });
  for (let k = 0; k < 9; k++) lite.paint(1, k, vp);
  assert.equal(L.calls.filter((c) => c[0] === 'drawArrays').length, 4 + 2, 'whole, then a quadrant every fourth call');
  lite.release();
  assert.deepEqual(L.count(), {});
});

test('EG-LOOK THE FETCH AND THE LOOK\'S SKY (render/eliteGates/egSkyPass.js, scenes/eliteGates/egLookDraw.js): nothing is drawn until the map holds the band whole; then one triangle where nothing nearer drew (LEQUAL, the depth never written), every state handed back; the look keeps drawSky\'s word (world.js calls it), paints from the breach client\'s pass with the world viewport in hand and the lane\'s steps, and frees the fetch and its map at the breach\'s end (mutants: a sky drawn before its map; the depth written; the map kept past release)', () => {
  const R = recordingGl();
  const sky = new EgSkyPass(/** @type {any} */ (R.gl));
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  assert.equal(sky.draw(I, I, 0, 1, [0.1, 0.05, 0.02]), false, 'no map: no sky');
  sky.paint(0, 5, [0, 0, 640, 360]);
  R.calls.length = 0;
  assert.equal(sky.draw(I, I, 0, 0.35, [0.056, 0.0175, 0.0105], 10), true);
  const at = (k, ...a) => R.calls.findIndex((c) => c[0] === k && a.every((v, i) => c[i + 1] === v));
  const tri = at('drawArrays', 'TRIANGLES', 0, 3);
  assert.ok(tri > 0 && at('depthMask', false) < tri && at('depthFunc', 'LEQUAL') < tri && at('depthFunc', 'LESS') > tri && at('depthMask', true) > tri && at('enable', 'CULL_FACE') > tri);
  const u = (n) => R.calls.find((c) => /^uniform/.test(c[0]) && c[1]?.n === n)?.slice(2);
  assert.ok(Math.abs(u('uLift')[0] - Math.sqrt(0.35)) < 1e-9, 'the realm\'s light at the gain\'s root');
  assert.deepEqual([...u('uFog')[0]], [0.056, 0.0175, 0.0105], 'the haze the frame\'s fog');
  assert.equal(sky.draw(I, I, 1, 1, null), false, 'another band than the map holds: nothing');
  sky.destroy(); sky.destroy();
  assert.deepEqual(R.count(), {}, 'the fetch and its map freed, once');
  // the look
  const D = rd('src/scenes/eliteGates/egLookDraw.js');
  assert.match(D, /drawSky\(proj, view, seconds, fog = null, gain = 1\) \{/, 'world.js\'s word kept');
  assert.match(rd('src/scenes/eliteGates/egClient.js'), /const painted = !!L\?\.paintSky\(vp, lane, ts\);/, 'painted from the client\'s pass');
  const Q = recordingGl(), look = createEgLookDraw({ gl: /** @type {any} */ (Q.gl), lite: false });
  look.setCircle(7, 1, 0);
  assert.equal(look.drawSky(I, I, 40, null, 1), false, 'the first frame: no map yet');
  assert.equal(look.paintSky(null, true, 40), true);
  assert.equal(look.drawSky(I, I, 40, null, 1), true, 'then the sky');
  assert.deepEqual(look.airState().map, { band: 0, painted: 4 });
  look.release();
  assert.deepEqual(Q.count(), {}, 'released: everything');
});
