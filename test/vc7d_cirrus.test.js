// VC7d - THE ICE LAYER (2026-09-23, Mac: "improve the volumetric cloud system to be more immersive" - the high
// cirrus, the last of the four chosen; "Let's do the not done yet before we merge").
//   - a thin shell of ice cloud at CIRRUS_ALT_M, read once where each ray meets it over a round earth, so it runs
//     out to its own horizon instead of to infinity;
//   - streaked down the westerly jet and carried east on the game's clock at five times a fair day's surface drift -
//     never along the surface wind, whose turning would swing the whole field about the world's origin;
//   - every tile dividing the field's period, so no recenter and no wrap of the jet moves a streak;
//   - lit by the sun the ICE sees: three degrees past the ground's horizon, in the palette's colour at that
//     elevation - the last gold in a sunset sky, gone three degrees after the ground;
//   - behind the slab along the ray, so a deck or a storm hides it by itself.
// What it looks like is the sky lab's (before/after in the arc); these pin the laws and the plumbing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CIRRUS_ALT_M, CIRRUS_TAU, CIRRUS_ALONG, CIRRUS_ACROSS, CIRRUS_FIBRE_ALONG, CIRRUS_FIBRE_ACROSS, CIRRUS_FIBRE, CIRRUS_JET_RATIO,
  CIRRUS_PATCH, CIRRUS_BEND, CIRRUS_BEND_M, CIRRUS_FWD, CIRRUS_AMB, CIRRUS_WISP_TOP, CIRRUS_WISP_COVER, CIRRUS_WISP_SOFT,
  CIRRUS_JET_M_PER_MINUTE, CIRRUS_FADE_M, CIRRUS_G, CIRRUS_SUN, CIRRUS_COVER, EARTH_RADIUS_M, SHAPE_METRES, DETAIL_METRES,
  FIELD_PERIOD_METRES, WORLD_PER_DRIFT, VC_PROFILE, MARCH_FS, SHADOW_FS, MARCH_UNIFORMS, VolumetricClouds, cirrusLight, cloudLight,
  cloudClocks, horizonDip,
} from '../src/render/volumetricClouds.js';
import { skyState, paletteAt, WEATHER_SKY, WIND_SECONDS_PER_MINUTE } from '../src/render/enhancedSky.js';

const lit = (v) => (Number.isInteger(v) ? `${v}.0` : String(v));
const fnBody = (src, sig) => {
  const i = src.indexOf(sig);
  assert.ok(i >= 0, `declares ${sig}`);
  let depth = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}' && --depth === 0) return src.slice(i, k + 1);
  }
  throw new Error(`unterminated ${sig}`);
};
const close = (a, b, eps) => Math.abs(a - b) <= eps;

// the shader's intersection, term for term (cirrus(): the stable root)
const tShell = (dy, R = EARTH_RADIUS_M, H = CIRRUS_ALT_M) => (2 * R * H + H * H) / (R * dy + Math.sqrt(R * R * dy * dy + 2 * R * H + H * H));

test('VC7d: THE SHELL - where a ray from the ground meets a sphere CIRRUS_ALT_M up, out to the ice\'s own horizon', () => {
  assert.equal(CIRRUS_ALT_M, 9000, 'cirrus lives at 8 to 12 km; the slab tops out at 4200');
  for (const el of [0, 0.1, 0.5, 2, 5, 15, 45, 89.9]) {
    const dy = Math.sin(el * Math.PI / 180), dx = Math.cos(el * Math.PI / 180), t = tShell(dy);
    // the point it names is ON the shell: its distance from the earth's centre is R + H
    const r = Math.hypot(dx * t, EARTH_RADIUS_M + dy * t);
    assert.ok(close(r, EARTH_RADIUS_M + CIRRUS_ALT_M, 1e-6 * EARTH_RADIUS_M), `${el} deg: ${r.toFixed(1)}`);
  }
  assert.ok(close(tShell(1), CIRRUS_ALT_M, 1e-6), 'straight up it is H away');
  const horizon = tShell(0);
  assert.ok(close(horizon, Math.sqrt(2 * EARTH_RADIUS_M * CIRRUS_ALT_M + CIRRUS_ALT_M ** 2), 1e-6), 'along the horizon it is the ice\'s own horizon distance');
  assert.ok(horizon > 330000 && horizon < 350000, `${(horizon / 1000).toFixed(0)} km - finite where a flat earth ran to infinity`);
  // and there it has gone into the haze
  assert.ok(Math.exp(-horizon / CIRRUS_FADE_M) < 0.07, 'faded at its horizon');
  const c = fnBody(MARCH_FS, 'vec4 cirrus(vec3 cam, vec3 dir)');
  assert.ok(c.includes(`const float R = ${lit(EARTH_RADIUS_M)}, H = ${lit(CIRRUS_ALT_M)};`));
  assert.ok(c.includes('float t = (2.0 * R * H + H * H) / (R * dir.y + sqrt(R * R * dir.y * dir.y + 2.0 * R * H + H * H));'), 'the root without cancellation');
  assert.ok(c.includes(`a *= exp(-t / ${lit(CIRRUS_FADE_M)});`));
  assert.ok(c.includes('if (uCirrus.x <= 0.0 || dir.y <= 0.0) return vec4(0.0, 0.0, 0.0, 1.0);'), 'nothing below the horizon, nothing with no cover');
});

test('VC7d: THE JET - westerly on the game\'s clock at five times the fair surface drift, wrapped to a tile every sample divides', () => {
  const fair = Math.hypot(...WEATHER_SKY.sunny.wind) * WIND_SECONDS_PER_MINUTE * WORLD_PER_DRIFT;   // WIND2's integral a game minute, metres
  assert.equal(CIRRUS_JET_RATIO, 5, 'a jet runs about five times the wind under it');
  assert.ok(close(CIRRUS_JET_M_PER_MINUTE, CIRRUS_JET_RATIO * fair, 1e-9), `${CIRRUS_JET_M_PER_MINUTE.toFixed(1)} m a game minute`);
  // the tiles: the patches', the bend's, the streaks' and the fibres' own - each dividing the field's period, which
  // is both the floating origin's wrap and the jet's, so neither ever moves a streak
  for (const [name, tile] of [['patches', SHAPE_METRES * CIRRUS_PATCH], ['bend', SHAPE_METRES * CIRRUS_BEND], ['streak along', SHAPE_METRES * CIRRUS_ALONG], ['streak across', SHAPE_METRES * CIRRUS_ACROSS], ['fibre along', DETAIL_METRES * CIRRUS_FIBRE_ALONG], ['fibre across', DETAIL_METRES * CIRRUS_FIBRE_ACROSS]]) {
    const n = FIELD_PERIOD_METRES / tile;
    assert.ok(close(n, Math.round(n), 1e-9), `${name}: ${tile} m divides the field's ${FIELD_PERIOD_METRES} m`);
  }
  // the clock: continuous in the minutes, wrapped to the field's period, whole at any year
  const YEAR = 405 * 360 * 1440;
  for (const m of [0, 1, 777, YEAR + 12345]) {
    const a = cloudClocks(m, [0, 0]).cirrus, b = cloudClocks(m + 1, [0, 0]).cirrus;
    assert.ok(a >= 0 && a < FIELD_PERIOD_METRES, 'wrapped');
    assert.ok(close(((b - a) % FIELD_PERIOD_METRES + FIELD_PERIOD_METRES) % FIELD_PERIOD_METRES, CIRRUS_JET_M_PER_MINUTE, 1e-3), 'a minute on, the jet has moved its own speed');
  }
  // and at ANY minute it IS the jet's travel, to the field's period - a wrap to any other length jumps every streak
  for (const m of [3, 1000, 2777, 5555.5, 88888, YEAR / 7]) {
    const a = cloudClocks(m, [0, 0]).cirrus, travel = m * CIRRUS_JET_M_PER_MINUTE;
    const off = ((a - travel) % FIELD_PERIOD_METRES + FIELD_PERIOD_METRES) % FIELD_PERIOD_METRES;
    assert.ok(off < 1e-3 * Math.max(1, travel / FIELD_PERIOD_METRES) || FIELD_PERIOD_METRES - off < 1e-3 * Math.max(1, travel / FIELD_PERIOD_METRES), `${m}: offset ${off}`);
  }
  assert.deepEqual(cloudClocks(5, [12345, -678]).cirrus, cloudClocks(5, [0, 0]).cirrus, 'the surface wind does not steer it');
  const c = fnBody(MARCH_FS, 'vec4 cirrus(vec3 cam, vec3 dir)');
  assert.ok(c.includes('vec2 q = cam.xz + dir.xz * t + uShift;') && c.includes('q.x -= uCirrus.z;'), 'the point in the world, carried east');
  assert.ok(c.includes(`float patchField = textureLod(uShape, vec3(q.x, 0.61 * SHAPE_M, q.y) / (SHAPE_M * ${lit(CIRRUS_PATCH)}), 0.0).g;`), 'where the high air holds ice: a slow round field');
  assert.ok(c.includes(`float bend = (textureLod(uShape, vec3(q.x, 0.47 * SHAPE_M, q.y) / (SHAPE_M * ${lit(CIRRUS_BEND)}), 0.0).b - 0.5) * ${lit(CIRRUS_BEND_M)};`), 'the streaks bent across the jet');
  assert.ok(c.includes(`vec4 sk = textureLod(uShape, vec3(q.x / (SHAPE_M * ${lit(CIRRUS_ALONG)}), 0.83 + uEvolve.x / SHAPE_M * 0.5, (q.y + bend) / (SHAPE_M * ${lit(CIRRUS_ACROSS)})), mip + 1.0);`), 'the streaks lie east-west, bent, boil with the field, and read a mip soft');
  assert.ok(c.includes(`float fib = textureLod(uDetail, vec3(q.x / (DETAIL_M * ${lit(CIRRUS_FIBRE_ALONG)}), 0.29, (q.y + bend) / (DETAIL_M * ${lit(CIRRUS_FIBRE_ACROSS)})), mip + 1.0).g;`), 'the striations too, a mip softer - the first cut aliased them to a dotted grain');
  // a streak is at least a few texels of its own volume across, so its edge cannot jag (the volume is 32 texels a tile
  // at mip 0, 16 at the mip it is read at): the across tile is at least a whole shape tile
  assert.ok(CIRRUS_ACROSS >= 1, 'the across tile is no finer than the volume\'s own - an 8:1 stretch over half a tile jagged every edge');
  // the bend: a streak drifts across the jet by at most CIRRUS_BEND_M over its field's features (a quarter of its tile),
  // a slope of a few percent - gentle curves; the first cut bent 5 km over 12 km and the sky ran like marbling
  assert.ok(CIRRUS_BEND_M / (SHAPE_METRES * CIRRUS_BEND / 4) < 0.1, `slope ${(CIRRUS_BEND_M / (SHAPE_METRES * CIRRUS_BEND / 4)).toFixed(3)}`);
  assert.ok(CIRRUS_ALONG / CIRRUS_ACROSS >= 12 && CIRRUS_FIBRE_ALONG / CIRRUS_FIBRE_ACROSS >= 12, 'long streaks, not fish-shaped blobs');
  assert.ok(c.includes('float mip = clamp(log2(t / 15000.0), 0.0, 4.0);'), 'a far sample reads a blurred level - no shimmer at the horizon');
});

test('VC7d: THE VEIL - how much, how thick, and a cover that eases with the weather', () => {
  for (const w of Object.keys(VC_PROFILE)) assert.ok(CIRRUS_COVER[w] > 0 && CIRRUS_COVER[w] < 1, `${w} carries some`);
  assert.ok(Object.isFrozen(CIRRUS_COVER));
  assert.ok(CIRRUS_COVER.sunny > CIRRUS_COVER.fog && CIRRUS_COVER.sunny > CIRRUS_COVER.sandstorm, 'a fair sky shows it; fog and dust hide the high air');
  // the thickest cirrus is still a veil: under half the blue is gone through it
  assert.ok(1 - Math.exp(-CIRRUS_TAU) < 0.5, `peak opacity ${(1 - Math.exp(-CIRRUS_TAU)).toFixed(2)}`);
  const c = fnBody(MARCH_FS, 'vec4 cirrus(vec3 cam, vec3 dir)');
  assert.ok(c.includes('float patchIn = smoothstep(1.0 - uCirrus.x - 0.12, 1.0 - uCirrus.x + 0.12, patchField);'), 'the cover says how much of the sky holds ice');
  assert.ok(c.includes('if (patchIn <= 0.0) return vec4(0.0, 0.0, 0.0, 1.0);'), 'clear air reads nothing more');
  assert.ok(c.includes(`float wispAt = ${lit(CIRRUS_WISP_TOP)} - ${lit(CIRRUS_WISP_COVER)} * uCirrus.x;`), 'the cover lowers the threshold a wisp stands above');
  assert.ok(c.includes(`float streak = smoothstep(wispAt, wispAt + ${lit(CIRRUS_WISP_SOFT)}, sk.g * 0.6 + sk.b * 0.4);`), 'wisps where the SMOOTH fbm stands high - never the Perlin-Worley, whose cell borders crazed the first cut with dark lines');
  assert.doesNotMatch(c, /sk\.r/, 'the Perlin-Worley channel is not read');
  assert.ok(c.includes(`float d = patchIn * streak * mix(1.0, fib, ${lit(CIRRUS_FIBRE)});`), 'patches of wisps, striated');
  // sparse: at a fair cover the threshold sits above the fbm's middle, so most of a patch is blue
  assert.ok(CIRRUS_WISP_TOP - CIRRUS_WISP_COVER * CIRRUS_COVER.sunny > 0.5, 'a fair sky\'s wisps are the fbm\'s upper tail');
  assert.ok(c.includes('float a = 1.0 - exp(-uCirrus.y * d);'), 'Beer through a thin layer');
  // the ease: toward the word's cover on the profile's span, and a jump takes it whole
  const vc = Object.create(VolumetricClouds.prototype);
  Object.assign(vc, { q: { cells: 8 }, cam: [0, 0], shift: [0, 0], testCellSpec: null, profile: null, cirrusCover: null });
  const st = skyState({ minuteOfDay: 720, weather: 'sunny' });
  vc.setState(st, WEATHER_SKY.sunny, 'sunny', 1, [0, 0], 0, [0, 0, 0]);
  assert.equal(vc.cirrusCover, CIRRUS_COVER.sunny, 'the first frame takes it whole');
  vc.setState(st, WEATHER_SKY.fog, 'fog', 10, [0, 0], 0, [0, 0, 0]);
  assert.ok(vc.cirrusCover < CIRRUS_COVER.sunny && vc.cirrusCover > CIRRUS_COVER.fog, 'then eases');
  vc.jump();
  vc.setState(st, WEATHER_SKY.fog, 'fog', 10, [0, 0], 0, [0, 0, 0]);
  assert.equal(vc.cirrusCover, CIRRUS_COVER.fog, 'a jump is taken whole');
});

test('VC7d: THE ICE\'S OWN SUN - three degrees past the ground\'s horizon, in the palette\'s colour at the elevation the ice sees it', () => {
  const dipDeg = horizonDip(CIRRUS_ALT_M) * 180 / Math.PI;
  assert.ok(dipDeg > 2.9 && dipDeg < 3.2, `the ice sees ${dipDeg.toFixed(2)} degrees past the ground`);
  let lastDeck = 1, lastIce = 1, iceAfterDeck = 0;
  for (let m = 1060; m <= 1110; m += 0.5) {
    const s = skyState({ minuteOfDay: m, weather: 'sunny' });
    const ice = cirrusLight(s), deck = cloudLight(s);
    assert.ok(ice.day >= deck.day - 1e-12, `${m}: the ice holds the sun at least as long as the deck`);
    if (ice.day === 1) {
      // in full sun the ice takes the palette's sun at the elevation IT sees it - nothing of the moon
      const want = paletteAt(s.elevDeg + dipDeg).sun;
      for (let i = 0; i < 3; i++) assert.ok(close(ice.color[i], want[i], 1e-12), `${m}: channel ${i}`);
    }
    if (deck.day === 0 && ice.day > 0) iceAfterDeck += 0.5;
    assert.ok(deck.day <= lastDeck + 1e-12 && ice.day <= lastIce + 1e-12, 'both only go out');
    lastDeck = deck.day; lastIce = ice.day;
  }
  assert.ok(iceAfterDeck >= 5, `the ice is lit ${iceAfterDeck} game minutes after the deck has gone out`);
  // gold, not white, while the ground's sun is at the horizon
  const set = cirrusLight(skyState({ minuteOfDay: 1084, weather: 'sunny' }));
  assert.ok(set.color[2] < 0.6 * set.color[0], 'warm');
  // noon: the palette is flat up there, so the ice's sun is the sun
  const noon = skyState({ minuteOfDay: 720, weather: 'sunny' });
  assert.deepEqual(cirrusLight(noon).color.map((x) => +x.toFixed(9)), paletteAt(noon.elevDeg + dipDeg).sun.map((x) => +x.toFixed(9)));
  // night: the moon, exactly as the deck takes it
  const night = skyState({ minuteOfDay: 0, weather: 'sunny', phases: { masser: 0.5, secunda: 0.5 } });
  assert.deepEqual(cirrusLight(night), cloudLight(night, { base: CIRRUS_ALT_M, top: CIRRUS_ALT_M }));
  // lit hard forward: ice crystals
  assert.ok(CIRRUS_G >= 0.6 && CIRRUS_SUN > 0 && CIRRUS_SUN <= 1);
  const c = fnBody(MARCH_FS, 'vec4 cirrus(vec3 cam, vec3 dir)');
  assert.ok(c.includes(`float phase = min(hg(dot(dir, uCirrusDir), ${lit(CIRRUS_G)}) * 4.0 * PI, 4.0);`));
  assert.ok(c.includes(`vec3 c = uCirrusLight * ${lit(CIRRUS_SUN)} * mix(1.0, phase, ${lit(CIRRUS_FWD)}) + uCloudLit * ${lit(CIRRUS_AMB)};`));
  // away from the sun it is still brighter than the clear sky behind it: at noon, looking straight away, the veil's
  // own colour outshines the zenith in every channel (the first cut drew dark contours round every streak)
  const noonSt = skyState({ minuteOfDay: 720, weather: 'sunny' }), L = cirrusLight(noonSt);
  const hgAway = (1 - CIRRUS_G ** 2) / (4 * Math.PI * Math.pow(1 + CIRRUS_G ** 2 + 2 * CIRRUS_G, 1.5)) * 4 * Math.PI;
  const away = [0, 1, 2].map((i) => L.color[i] * CIRRUS_SUN * (1 + (hgAway - 1) * CIRRUS_FWD) + noonSt.cloudLit[i] * CIRRUS_AMB);
  for (let i = 0; i < 3; i++) assert.ok(away[i] > noonSt.zenith[i], `channel ${i}: ${away[i].toFixed(2)} against the zenith's ${noonSt.zenith[i].toFixed(2)}`);
});

test('VC7d: BEHIND THE SLAB - the march lays it under what it found, and uploads what it reads', () => {
  const main = MARCH_FS.slice(MARCH_FS.indexOf('void main() {', MARCH_FS.indexOf('vec4 cirrus(')));
  const fade = main.indexOf('  if (!veiled) { col += T * mix(back.rgb, uHorizonColor * (1.0 - back.a), fade); T *= back.a; }');   // SLAB-SPAN: the slab's last word, each span in its own aerial perspective
  const ice = main.indexOf('vec4 ice = cirrus(cam, dir);'), add = main.indexOf('col += T * ice.rgb;'), thru = main.indexOf('T *= ice.a;');
  const out = main.lastIndexOf('outColor = vec4(front.rgb + front.a * col, T * front.a);');
  assert.ok(fade > 0 && fade < ice && ice < add && add < thru && thru < out, 'after the slab, weighted by what the slab let through, before the curtains in front of it');
  assert.ok(!SHADOW_FS.includes('cirrus('), 'no ground shadow: a veil that thin casts none worth a march');
  for (const n of ['uCirrus', 'uCirrusLight', 'uCirrusDir']) { assert.ok(MARCH_UNIFORMS.includes(n)); assert.ok(MARCH_FS.includes(`uniform ${n === 'uCirrus' ? 'vec4' : 'vec3'} ${n};`)); }
  const upd = fnBody(VolumetricClouds.toString(), 'update(viewport)');
  assert.ok(upd.includes('const ice = cirrusLight(s);'));
  assert.ok(upd.includes('gl.uniform4f(u.uCirrus, this.cirrusCover ?? 0, CIRRUS_TAU, this.clocks?.cirrus ?? 0, 0);'));
  assert.ok(upd.includes('gl.uniform3fv(u.uCirrusLight, ice.color); gl.uniform3fv(u.uCirrusDir, ice.dir);'));
  assert.doesNotMatch(fnBody(MARCH_FS, 'vec4 cirrus(vec3 cam, vec3 dir)').replace(/\/\/[^\n]*/g, ''), /\bhalf\b|\bflat\b|\bsample\b|\binput\b|\boutput\b/, 'no word GLSL ES 3.00 reserves');
});
