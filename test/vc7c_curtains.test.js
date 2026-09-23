// VC7c - THE RAIN CURTAINS (2026-09-23, Mac: "improve the volumetric cloud system to be more immersive" - rain
// shafts, one of the four chosen; then "Whatever is the most visually detailed and immersive").
//   - a cell whose weather falls hangs a veil from its base to the ground: a cylinder of CURTAIN_SHARE of its
//     radius, rain's own extinction (Koschmieder's 3.0 over five kilometres), thinning to its rim, reaching up into
//     its cell and thinning to nothing there;
//   - streaked around its axis in two octaves, each faded to its mean where the sky map could not hold it;
//   - the rim's streaks stopping short of the ground each by its own amount (virga), the core's reaching it;
//   - cut where the slab begins: the veil before it laid over everything, on every row the map writes; the veil past
//     it put in among the slab's lit samples at its depth (AUDIT-VC7);
//   - in its cell's own outline and inside its clip (AUDIT-VC7), its depth the integral of its declared density;
//   - and the stride the march takes over empty air now asks density() whether its zero holds for a stride -
//     VC7e's cells made two that do not, and the crowns of distant clouds were specked with sky.
// What it looks like is the sky lab's (`?cloudcell=`, before/after in the arc); these run the laws on the shader's own
// functions (cloudSky.mjs) and pin the plumbing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CURTAIN_SHARE, CURTAIN_EXT, CURTAIN_STREAKS, CURTAIN_FIBRE, CURTAIN_VIRGA, CURTAIN_STREAK_TEXELS, CURTAIN_INTO, CURTAIN_FADE_M,
  CURTAIN_FALL, SKIP_ROOM, DECK_COVER_LO, DECK_COVER_HI, VC_PROFILE, MAX_CELLS, MARCH_FS, SHADOW_FS, CLOUD_FIELD_GLSL, MARCH_UNIFORMS,
  cellOf, grownCell, packCells, VolumetricClouds,
} from '../src/render/volumetricClouds.js';
import { shapeFactor, shapeBound } from '../src/systems/weatherMap.js';
import { marchFns, fieldFns, unit } from './cloudSky.mjs';

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
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

test('VC7c: the constants - rain\'s own extinction, and what falls under which word', () => {
  assert.deepEqual([CURTAIN_SHARE, CURTAIN_STREAKS, CURTAIN_FIBRE, CURTAIN_VIRGA, CURTAIN_STREAK_TEXELS, CURTAIN_INTO, CURTAIN_FADE_M], [0.55, 40, 0.4, 0.6, 3, 0.12, 40000]);
  // Koschmieder: visibility = 3.0 / extinction, and moderate rain sees five kilometres. The first cut took a fifth of
  // it and a storm's curtain was a smear on the horizon
  assert.equal(CURTAIN_EXT, 3.0 / 5000);
  // a full fall across a thunder core is near opaque - which is why a real shaft reads from far off: on the shader, a
  // low ray through a storm's axis at 20 km passes about a tenth, at the streaks' mean weight (AUDIT-VC7: the
  // integral of the core's declared profile; the first chord took its axis weight all the way, and read a twentieth)
  const T = veils(marchFns([{ ...cellOf('thunder', 0, 0, 6000), dark: 0 }], FLAT), [-20000, 0, 0], unit([1, 0.02, 0])).front[3];
  assert.ok(T > 0.05 && T < 0.12, `a storm's core passes ${T.toFixed(3)}`);
  assert.deepEqual(CURTAIN_FALL, { rain: [1, 0], thunder: [1.3, 0], snow: [0.7, 1] });
  assert.ok(Object.isFrozen(CURTAIN_FALL) && Object.values(CURTAIN_FALL).every(Object.isFrozen));
});

test('VC7c: A CELL CARRIES ITS FALL - every word, rain\'s kind or snow\'s, nothing where nothing falls; young rain is young too', () => {
  for (const w of Object.keys(VC_PROFILE)) {
    const c = cellOf(w, 1, 2, 3000);
    assert.deepEqual([c.fall, c.fallKind], CURTAIN_FALL[w] ?? [0, 0], `${w}`);
  }
  assert.equal(cellOf('no-such-word', 0, 0, 1), null);
  const cell = cellOf('thunder', 0, 0, 6000);
  assert.equal(grownCell(cell, 1), cell, 'grown, the fall it was');
  for (const e of [0, 0.25, 0.5, 0.9]) assert.equal(grownCell(cell, e).fall, CURTAIN_FALL.thunder[0] * e, `a system at ${e} of its life rains ${e} of its fall`);
  assert.equal(grownCell(cell, 0).fallKind, 0, 'its kind never grows');
  assert.equal(grownCell({ ...cell, fall: undefined }, 0.5).fall, 0, 'a cell from before VC7c falls nothing');
});

test('VC7c: THE PACK - each cell\'s fall in its own vec4, the rest of the slot zero, and none past the count', () => {
  const cells = [cellOf('rain', 0, 0, 5000), cellOf('cloudy', 9000, 0, 5000), cellOf('snow', 0, 9000, 4000)];
  const out = packCells(cells, MAX_CELLS);
  assert.equal(out.f.length, MAX_CELLS * 4);
  assert.deepEqual(Array.from(out.f.slice(0, 12)), [1, 0, 0, 0, 0, 0, 0, 0, Math.fround(0.7), 1, 0, 0]);
  const again = packCells([cellOf('thunder', 0, 0, 5000)], MAX_CELLS, out);
  assert.equal(again, out, 'the frame\'s own arrays, reused');
  assert.deepEqual(Array.from(out.f.slice(0, 4)), [Math.fround(1.3), 0, 0, 0]);
  assert.deepEqual(Array.from(packCells([cellOf('rain', 0, 0, 1)], 0).f.slice(0, 4)), [0, 0, 0, 0], 'a tier that takes no cells packs no fall');
  // the march takes them with the cells it packed this frame
  assert.ok(MARCH_UNIFORMS.includes('uCellF'));
  const upd = fnBody(VolumetricClouds.toString(), 'update(viewport)');
  const pack = upd.indexOf('this._fieldUniforms(u);'), up = upd.indexOf('if (this._packed?.count > 0) gl.uniform4fv(u.uCellF, this._packed.f);');
  assert.ok(pack > 0 && up > pack, 'uploaded AFTER the field packs this frame\'s cells');
  assert.ok(MARCH_FS.includes('uniform vec4 uCellF[8];') && !SHADOW_FS.includes('uCellF'), 'the sky\'s alone - a veil casts no ground shadow of its own');
});

// AUDIT-VC7 (lens 4): the laws below run on the shader's OWN functions (cloudSky.mjs hands the march's text to the
// GLSL evaluator, the cells packed by the source's own packCells) - the pins quoted its lines before, and six
// wrong lines around them survived.
const GREY = [0.5, 0.5, 0.5];
// one colour everywhere - the veil's tint, the horizon it fades to - so its colour is c (1 - T) at any depth; and a
// one-texel map, where every streak is at its mean
const FLAT = { uCloudShade: GREY, uCloudLit: GREY, uHorizonColor: GREY, uMapSize: [1, 1] };
const STREAK_MEAN = 0.35 + 0.65 * 0.5;
const rain = (over = {}) => ({ ...cellOf('rain', 0, 0, 6000), dark: 0, ...over });
function veils(fns, cam, dir, split = 1e9) {
  const front = { value: null }, back = { value: null }, tBack = { value: 0 };
  fns.curtains(cam, dir, split, front, back, tBack);
  return { front: front.value, back: back.value, tBack: tBack.value };
}
const shapeOf = (a2, p2, a3, p3, a4, p4) => { const n = 1 / Math.sqrt(1 + (a2 * a2 + a3 * a3 + a4 * a4) / 2); return [n, a2 * Math.cos(2 * p2), a2 * Math.sin(2 * p2), a3 * Math.cos(3 * p3), a3 * Math.sin(3 * p3), a4 * Math.cos(4 * p4), a4 * Math.sin(4 * p4)]; };
// THE DECLARED DENSITY, integrated by brute force along the ray from t0 to t1: rain's extinction x the fall x the
// streaks' mean x how near the eye is x the core's weight across the ground (1 - (d / rad)^2, d in the outline's own
// measure - weatherMap.js's shapeFactor, not the shader's - inside its clip) x its weight up the column (whole below
// the base, thinning linearly to its top inside the cell), from the ragged foot up - the foot by the core's weight
// where the ray passes nearest the axis, within the chord of the outline's bounding circle
function tauOf(cell, cam, dir, t0 = 0, t1 = Infinity) {
  const rad = cell.r * CURTAIN_SHARE, yb = cell.base, yt = yb + CURTAIN_INTO * (cell.top - yb);
  const across = (x, z) => {
    const r = Math.hypot(x - cell.x, z - cell.z) / shapeFactor(cell.shape, x - cell.x, z - cell.z) / rad;
    let w = Math.max(0, 1 - r * r);
    if (cell.clip) { const [kx, kz, kr, ks] = cell.clip; w *= 1 - smooth(kr - cell.edge, kr, Math.hypot(x - kx, z - kz) / shapeFactor(ks, x - kx, z - kz)); }
    return w;
  };
  const o = [cam[0] - cell.x, cam[2] - cell.z];
  const near = smooth(0.5 * rad, 1.5 * rad, Math.hypot(...o) / shapeFactor(cell.shape, o[0], o[1]));
  const dd = dir[0] ** 2 + dir[2] ** 2, b = (o[0] * dir[0] + o[1] * dir[2]) / dd, h2 = o[0] ** 2 + o[1] ** 2 - b * b * dd;
  const reach = rad * shapeBound(cell.shape);
  if (h2 >= reach * reach) return 0;
  const hw = Math.sqrt((reach * reach - h2) / dd), up = Math.max(dir[1], 1e-4);
  const ta = Math.max(-b - hw, 0), tb = Math.min(-b + hw, yt / up);
  if (tb <= ta) return 0;
  const tc = Math.min(Math.max(-b, ta), tb);
  const foot = Math.min(yb * CURTAIN_VIRGA * (1 - across(cam[0] + dir[0] * tc, cam[2] + dir[2] * tc)), 0.95 * yb);
  const lo = Math.max(ta, t0), hi = Math.min(tb, t1);
  let sum = 0; const n = 40000, h = (hi - lo) / n;
  for (let k = 0; k < n && hi > lo; k++) {
    const t = lo + (k + 0.5) * h, y = cam[1] + dir[1] * t;
    if (y < foot) continue;
    sum += across(cam[0] + dir[0] * t, cam[2] + dir[2] * t) * (y <= yb ? 1 : Math.max(0, (yt - y) / (yt - yb))) * h;
  }
  return CURTAIN_EXT * cell.fall * STREAK_MEAN * near * sum;
}

test('VC7c: THE VEIL IS BEER\'S LAW OVER ITS DECLARED DENSITY - on the shader\'s own curtains(), exact on a circle', () => {
  const cell = rain();
  const east = [-20000, 0, 0];
  for (const [cam, dir, what] of [
    [east, unit([1, 0.02, 0]), 'through the axis, under the base'],
    [[-20000, 0, 1500], unit([1, 0.02, 0]), 'off the axis - the rim\'s streaks stop short'],
    [east, unit([1, 0.03, 0]), 'up into the cell, thinning to its top'],
    [[-9000, 0, -2000], unit([1, 0.06, 0.25]), 'nearer, slanting'],
  ]) {
    const { front, back } = veils(marchFns([cell], FLAT), cam, dir);
    const tau = -Math.log(front[3]), want = tauOf(cell, cam, dir);
    assert.ok(want > 0.2, `${what}: a real veil (${want.toFixed(3)})`);
    assert.ok(Math.abs(tau - want) <= 1e-6 * want, `${what}: the transmittance is exp(-tau) of the density's integral (${tau.toFixed(6)} against ${want.toFixed(6)})`);
    for (const ch of front.slice(0, 3)) assert.ok(Math.abs(ch - GREY[0] * (1 - front[3])) < 1e-9, `${what}: its colour is its tint over what it absorbs, whatever its depth`);
    assert.deepEqual(back, [0, 0, 0, 1], `${what}: with no slab to cut at, it is all in front`);
  }
  // THE CHORD LIES TOWARD THE CELL: looking away, nothing; and at twenty kilometres, the storm's reading distance, a
  // ray just under the base's elevation still meets it (the grazing floor is no floor)
  assert.deepEqual(veils(marchFns([cell], FLAT), east, unit([-1, 0.02, 0])).front, [0, 0, 0, 1], 'nothing behind the eye');
  const graze = unit([1, Math.tan(Math.atan(cell.base / 20000) * 0.8), 0]);
  const far = veils(marchFns([cell], FLAT), east, graze).front[3];
  assert.ok(far < 0.5 && Math.abs(-Math.log(far) - tauOf(cell, east, graze)) <= 1e-6 * tauOf(cell, east, graze), `a storm at 20 km, just under its base's elevation: ${far.toFixed(3)}`);
});

test('VC7c: THE OUTLINE AND THE CLIP - the curtain falls in its cell\'s own shape, and only inside its front (AUDIT-VC7 R1)', () => {
  // the weight across the ground, point by point, against weatherMap.js's own measure
  const lobed = rain({ shape: shapeOf(0.45, 0.3, 0.2, 1.1, 0.12, 2) });
  const f = marchFns([lobed], FLAT), rad = lobed.r * CURTAIN_SHARE;
  for (let k = 0; k < 48; k++) {
    const th = (k / 48) * 2 * Math.PI, m = shapeFactor(lobed.shape, Math.cos(th), Math.sin(th));
    for (const r of [0, 0.4, 0.9, 1.1, 1.6]) {
      const p = [Math.cos(th) * r * rad * m, Math.sin(th) * r * rad * m];
      assert.ok(Math.abs(f.veilAcross(0, p, rad) - Math.max(0, 1 - r * r)) < 1e-6, `bearing ${th.toFixed(2)}, ${r} of the outline`);
    }
  }
  const clipped = rain({ clip: [2500, 0, 3000, null] });
  const g = marchFns([clipped], FLAT);
  assert.equal(g.veilAcross(0, [-3000, 0], rad), 0, 'outside its front, no rain - its cloud stands only inside it');
  assert.ok(Math.abs(g.veilAcross(0, [1500, 0], rad) - (1 - (1500 / rad) ** 2) * (1 - smooth(3000 - clipped.edge, 3000, 1000))) < 1e-6, 'inside it, the core\'s own, eased in over the clip\'s rim');
  // and the veil a ray meets is that density's integral - Simpson's rule over VEIL_PANELS panels a piece, exact on a
  // circle; on a lobed outline or a clip its error, measured over these, is at worst 2.4%
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let worst = 0, n = 0;
  for (let k = 0; k < 120; k++) {
    const cell = rain({ shape: shapeOf(0.45 * rnd(), rnd() * 6.28, 0.2 * rnd(), rnd() * 6.28, 0.12 * rnd(), rnd() * 6.28), clip: rnd() < 0.5 ? [(rnd() - 0.5) * 8000, (rnd() - 0.5) * 8000, 3000 + rnd() * 5000, null] : undefined });
    const ang = (rnd() - 0.5) * 0.4, dist = 12000 + rnd() * 15000;
    const cam = [-dist * Math.cos(ang), 0, -dist * Math.sin(ang) + (rnd() - 0.5) * 4000], dir = unit([Math.cos(ang), 0.005 + rnd() * 0.04, Math.sin(ang)]);
    const want = tauOf(cell, cam, dir);
    if (want < 0.05) continue;
    n++;
    worst = Math.max(worst, Math.abs(-Math.log(veils(marchFns([cell], FLAT), cam, dir).front[3]) - want) / want);
  }
  assert.ok(n > 80 && worst < 0.03, `${n} rays, the worst ${(100 * worst).toFixed(2)}% off`);
});

test('VC7c: THE STREAKS - two octaves that close around the axis, each faded to its mean where the map cannot hold it', () => {
  const f = marchFns([rain()], FLAT);
  for (const period of [CURTAIN_STREAKS, 3 * CURTAIN_STREAKS]) {
    const vals = [];
    for (let u = 0; u < 1; u += 0.0137) {
      const v = f.streakNoise(u * period, period);
      vals.push(v);
      assert.ok(v >= 0 && v <= 1, 'a weight');
      assert.ok(Math.abs(v - f.streakNoise((u + 1) * period, period)) < 1e-9, 'a whole turn is the same streak - no seam down the curtain\'s back');
    }
    assert.ok(Math.max(...vals) - Math.min(...vals) > 0.5, 'and streaks, not a wash');
  }
  // AUDIT-VC7 (G4): the lattice is integer arithmetic, which GLSL ES 3.00 defines exactly - no transcendental whose
  // large arguments each GPU answers its own way
  assert.doesNotMatch(fnBody(MARCH_FS, 'float streakNoise(float x, float period)') + fnBody(MARCH_FS, 'float latticeHash(uint n)'), /\b(sin|cos)\(/);
  assert.doesNotMatch(fnBody(MARCH_FS, 'float latticeHash(uint n)'), /fract\(/, 'the hash itself all in unsigned integers');
  // the fade, on the tiers' own maps: a storm at 20 km on the low tier keeps some of its shafts and none of its fibres
  const span = (rad, width, dist) => rad * width / (CURTAIN_STREAKS * Math.max(dist, rad));
  const lo = span(6000 * CURTAIN_SHARE, 512, 20000), hi = span(6000 * CURTAIN_SHARE, 2048, 9000);
  assert.ok(smooth(1, CURTAIN_STREAK_TEXELS, lo) > 0 && smooth(1, CURTAIN_STREAK_TEXELS, lo) < 1 && smooth(1, CURTAIN_STREAK_TEXELS, lo / 3) === 0, `lo at 20 km: ${lo.toFixed(2)} texels a streak`);
  assert.equal(smooth(1, CURTAIN_STREAK_TEXELS, hi / 3), 1, `hi at 9 km: the fibres whole (${(hi / 3).toFixed(2)} texels)`);
  // on a map that holds them, the veil a ray meets varies around the axis, and averages to the mean's
  const wide = { ...FLAT, uMapSize: [2048, 512] }, cell = rain(), cam = [-9000, 0, 0];
  const ratio = [];
  for (let k = -20; k <= 20; k++) {
    const dir = unit([1, 0.03, k * 0.015]);
    ratio.push(Math.log(veils(marchFns([cell], wide), cam, dir).front[3]) / Math.log(veils(marchFns([cell], FLAT), cam, dir).front[3]));
  }
  assert.ok(Math.max(...ratio) > 1.15 && Math.min(...ratio) < 0.85, `the shafts and their gaps, against the mean: ${Math.min(...ratio).toFixed(2)} to ${Math.max(...ratio).toFixed(2)}`);
});

test('VC7c: THE RAGGED FOOT - the core reaches the ground, the rim stops short, each streak its own way', () => {
  const foot = (core, s, yb = 600) => Math.min(yb * CURTAIN_VIRGA * (1 - core) * (0.5 + s), 0.95 * yb);
  assert.equal(foot(1, 0.9), 0, 'the core\'s streaks reach the ground');
  assert.ok(foot(0.2, 0.2) < foot(0.2, 0.8), 'two streaks at one distance from the axis stop at different heights');
  assert.ok(foot(0, 1) < 600, 'and never above the base - a curtain is never cut off from its cloud');
  const c = fnBody(MARCH_FS, 'void curtains(vec3 cam, vec3 dir, float tSplit, out vec4 front, out vec4 back, out float tBack)');
  assert.ok(c.includes(`float foot = min(yb * ${lit(CURTAIN_VIRGA)} * (1.0 - core) * (0.5 + s), 0.95 * yb);`) && c.includes('ta = max(ta, foot / up);'));
  // on the shader: a ray through the core near the ground meets rain; one past the rim at the same height does not
  const cell = rain(), f = marchFns([cell], FLAT), low = unit([1, 50 / 20000, 0]);
  assert.ok(veils(f, [-20000, 0, 0], low).front[3] < 0.9, 'the core, fifty metres up at the axis');
  assert.equal(veils(f, [-20000, 0, 0.95 * cell.r * CURTAIN_SHARE], low).front[3], 1, 'the rim\'s streaks ended above it');
});

test('VC7c: THE SLAB\'S START CUTS THE VEIL - before it in front of everything, past it among the slab\'s cloud (AUDIT-VC7 B4)', () => {
  const cell = rain({ base: 900 }), f = marchFns([cell], FLAT), cam = [-20000, 0, 0], dir = unit([1, 0.04, 0]);
  const whole = veils(f, cam, dir), rad = cell.r * CURTAIN_SHARE, hxz = Math.hypot(dir[0], dir[2]);
  const ta = (20000 - rad) / hxz, tb = (20000 + rad) / hxz;
  for (const split of [ta + 500, 20000 / hxz, tb - 1500]) {
    const { front, back, tBack } = veils(f, cam, dir, split);
    assert.ok(Math.abs(front[3] * back[3] - whole.front[3]) < 1e-9, `at ${split}: the two pieces are the whole veil`);
    assert.ok(Math.abs(-Math.log(front[3]) - tauOf(cell, cam, dir, 0, split)) < 1e-6, `at ${split}: the front is the density before it`);
    assert.ok(Math.abs(-Math.log(back[3]) - tauOf(cell, cam, dir, split)) < 1e-6, `at ${split}: the back is the density past it`);
    assert.ok(tBack >= split && tBack <= tb, `at ${split}: the back hangs past the cut (${tBack.toFixed(0)})`);
    for (const ch of back.slice(0, 3)) assert.ok(Math.abs(ch - GREY[0] * (1 - back[3])) < 1e-9, 'the back\'s colour is its own, not yet in any perspective - the slab\'s takes it');
  }
  assert.deepEqual(veils(f, cam, dir, 0).front, [0, 0, 0, 1], 'a cut at the eye: all of it among the slab');
  // the march: the back goes in before the first LIT sample past it, or behind everything; the front last of all
  const main = MARCH_FS.slice(MARCH_FS.indexOf('void main() {', MARCH_FS.indexOf('vec4 cirrus(')));
  assert.ok(main.includes('curtains(cam, dir, t0, front, back, tBack);') && main.includes('bool veiled = back.a >= 1.0;'), 'cut where the slab begins');
  const lit0 = main.indexOf('    if (!veiled && tBack <= t) { col += T * back.rgb; T *= back.a; veiled = true; }');
  assert.ok(lit0 > main.indexOf('if (strode) { t -= coarse;') && lit0 < main.indexOf('float tau = lightDepth(p);'), 'at a lit sample, after a stride is backed out - only a lit sample has an order to keep');
  const after = main.indexOf('  if (!veiled) { col += T * back.rgb; T *= back.a; }');
  assert.ok(after > lit0 && after < main.indexOf('float fade = 1.0 - exp(-t0 / 14000.0);'), 'behind every lit sample, and under the slab\'s own aerial perspective');
  const exits = main.match(/outColor = [^;]*;/g);
  assert.deepEqual(exits, ['outColor = underCurtains(uHorizonColor, 0.0, cam, dir);', 'outColor = underCurtains(uHorizonColor, 0.0, cam, dir);', 'outColor = vec4(front.rgb + front.a * col, T * front.a);'], 'the rows with no slab to cut take all of it in front; the march\'s end lays the front over everything');
  const under = fnBody(MARCH_FS, 'vec4 underCurtains(vec3 col, float T, vec3 cam, vec3 dir)');
  assert.ok(under.includes('curtains(cam, dir, 1e9, front, back, tBack);') && under.includes('return vec4(front.rgb + front.a * col, T * front.a);'));
  // the front's own aerial perspective, taken at its NEAR entry
  const H = [0.9, 0.2, 0.1], g = marchFns([rain()], { ...FLAT, uHorizonColor: H, uCloudShade: GREY, uCloudLit: GREY });
  const low = unit([1, 0.02, 0]), fr = veils(g, cam, low).front, T = fr[3], entry = (20000 - rad) / Math.hypot(low[0], low[2]);
  const k = 1 - Math.exp(-entry / CURTAIN_FADE_M), tint = [0, 1, 2].map((i) => 0.7 * GREY[i] + 0.3 * H[i]);   // rain: the shade, a third of the way to the horizon
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(fr[i] - ((1 - k) * tint[i] * (1 - T) + k * H[i] * (1 - T))) < 1e-9, `channel ${i}: faded by its entry at ${entry.toFixed(0)} m`);
});

test('VC7c: UNDER THE AXIS - an eye under the rain sees no curtain, and no NaN (AUDIT-VC7 G5: atan(0, 0))', () => {
  const f = marchFns([rain()], FLAT);
  for (const dir of [unit([1, 0.1, 0]), unit([0, 1, 0.001]), unit([-0.3, 0.05, 0.9])]) {
    const { front, back } = veils(f, [0, 0, 0], dir);
    assert.deepEqual([front, back], [[0, 0, 0, 1], [0, 0, 0, 1]]);
  }
  const c = fnBody(MARCH_FS, 'void curtains(vec3 cam, vec3 dir, float tSplit, out vec4 front, out vec4 back, out float tBack)');
  const code = c.replace(/\/\/[^\n]*/g, '');
  assert.ok(code.indexOf('if (near <= 0.0) continue;') < code.indexOf('atan('), 'the bearing is taken only where the eye is off the axis');
  assert.doesNotMatch(c.replace(/\/\/[^\n]*/g, ''), /\bhalf\b|\bflat\b/, 'no variable GLSL ES 3.00 reserves');
  assert.equal((c.match(/texture/g) || []).length, 0, 'no texture read: eight cells a sample cost arithmetic alone');
});

test('VC7c: THE STRIDE\'S EVIDENCE - a zero density() vouches for holds for every column a stride can reach (AUDIT-VC7 G1)', () => {
  // the variation read (its slice sits at 0.37 of the volume) answers a chosen cells' weight `a` at one variation:
  // r makes up the rest, so the lanes and cores move and the type does not (the variation's own drift across a stride
  // is the one the docs name). The shape answers its fullest everywhere, so no zero is the coverage cut's - only the
  // band's, a lane's and the ramp's, which the evidence claims to bound.
  let a = 0.5;
  const V = 0.55;
  const textureLod = (sampler, c) => (sampler === 'uShape' && Math.abs(c[1] - 0.37) < 1e-9 ? [(V - 0.35 * a) / 0.65, 0.5, 0.5, a] : [1, 1, 1, 1]);
  const REACH = 1500, grid = [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1];
  for (const [sky, over, cells] of [
    ['a deck', { uCover: 0.94, uFlat: 0.9, uVary: 0.15, uBase: 800, uTop: 1600 }, []],
    ['a fair sky', { uCover: 0.32, uFlat: 0.1, uVary: 0.5 }, []],
    ['a storm over a fair sky, across its rim', { uCover: 0.32, uFlat: 0.1, uVary: 0.5 }, [cellOf('thunder', 9000, 2700, 6000)]],
  ]) {
    const f = fieldFns(cells, { ...over, textureLod });
    f.globals.fReach = REACH;
    let vouched = 0;
    for (const el of [0.03, 0.12, 0.4]) {
      const dir = unit([1, el, 0.3]);
      for (let t = 0; t < 40000; t += 173) {
        const p = dir.map((d) => d * t);
        if (p[1] < 400 || p[1] > 4300) continue;
        for (const a0 of [0, 0.5, 1]) {
          a = a0;
          f.resolveAt([p[0], p[2]]);
          if (f.density(p, 0) !== 0 || f.globals.fSkip < 0.5) continue;
          vouched++;
          for (const a1 of grid) {
            a = a1;
            for (let s = 0; s <= REACH; s += 50) {
              const q = p.map((x, i) => x + dir[i] * s);
              f.resolveAt([q[0], q[2]]);   // as the march does, at every step
              assert.equal(f.density(q, 0), 0, `${sky}: a zero vouched for at ${p.map(Math.round)} (cells ${a0}) holds ${s} m on, cells ${a1}`);
            }
          }
        }
      }
    }
    assert.ok(vouched > 50, `${sky}: the evidence vouches (${vouched})`);
  }
  // ...and square across a storm's rim, over a fair zone: from outside it, over the zone's band and inside it, toward
  // the storm a stride off - where the zone's ramp thins and the storm's cover takes every height up to its top
  {
    const cell = cellOf('thunder', 9000, 2700, 6000), f = fieldFns([cell], { uCover: 0.32, uFlat: 0.1, uVary: 0.5, textureLod });
    f.globals.fReach = REACH;
    const dir = unit([1, 0.05, 0]);
    let vouched = 0;
    for (let x = 9000 - 8000; x <= 9000 - 5600; x += 100) for (const y of [2600, 2900, 3100, 3300, 3600, 3900, 4100]) {
      const p = [x, y, 2700];
      for (const a0 of [0, 1]) {
        a = a0;
        f.resolveAt([p[0], p[2]]);
        if (f.density(p, 0) !== 0 || f.globals.fSkip < 0.5) continue;
        vouched++;
        for (const a1 of [0, 0.5, 1]) {
          a = a1;
          for (let s = 0; s <= REACH; s += 50) {
            const q = p.map((v, i) => v + dir[i] * s);
            f.resolveAt([q[0], q[2]]);
            assert.equal(f.density(q, 0), 0, `a zero vouched for at ${p} beside the storm holds ${s} m on (cells ${a1})`);
          }
        }
      }
    }
    assert.ok(vouched > 10, `the evidence vouches out past the rim's reach (${vouched})`);
  }
  // A LANE AND A CORE BOUND EVERY COLUMN BETWEEN THEM: the span columnAt returns holds the height under the ceiling
  // at every cells' weight, at the same variation
  const f = fieldFns([], { uCover: 0.94, uFlat: 0.9, uVary: 0.15, uBase: 800, uTop: 1600, textureLod });
  f.resolveAt([100, 200]);
  for (const y of [810, 900, 1100, 1300, 1500, 1590]) {
    a = 0.3;
    const v = { value: null }, span = { value: null };
    f.columnAt([100, y, 200], v, span);
    const [lo, hi] = span.value;
    assert.ok(hi > lo, `${y}: a deck's lanes move the column`);
    for (const a1 of grid) {
      a = a1;
      const col = f.columnAt([100, y, 200], v, { value: null });
      const hn = col[0] / Math.max(col[1], 0.05);
      assert.ok(hn >= lo - 1e-9 && hn <= hi + 1e-9, `${y}, cells ${a1}: ${hn.toFixed(4)} in [${lo.toFixed(4)}, ${hi.toFixed(4)}]`);
    }
  }
  // A CELL'S RIM: where fNear is 0, the profile is the same everywhere a stride reaches - on a lobed outline, inside
  // a lobed clip (its measure runs faster than a metre in the narrow places: packCells hands its steepest)
  const cell = { ...cellOf('thunder', 0, 0, 6000), shape: shapeOf(0.25, 0.4, 0.15, 1.3, 0.1, 2.2), clip: [2000, 0, 9000, shapeOf(0.4, 1.2, 0.2, 0.2, 0.12, 0.9)] };
  const g = fieldFns([cell]);
  g.globals.fReach = 1200;
  let still = 0, moving = 0;
  for (let x = -12000; x <= 12000; x += 400) for (let z = -12000; z <= 12000; z += 400) {
    g.resolveAt([x, z]);
    if (g.globals.fNear > 0.5) { moving++; continue; }
    still++;
    const base = g.globals.fBase;
    for (let k = 0; k < 12; k++) for (const r of [400, 800, 1200]) {
      g.resolveAt([x + r * Math.cos(k * Math.PI / 6), z + r * Math.sin(k * Math.PI / 6)]);
      assert.ok(Math.abs(g.globals.fBase - base) < 1e-6, `(${x}, ${z}) was vouched still, and ${r} m off its base is ${g.globals.fBase}`);
    }
  }
  assert.ok(moving > 0 && still > moving, `the rims move (${moving}), and the rest strides (${still})`);
  // and a cell's middle is its own terms all through - it strides, where VC7c's first cut held every step inside a
  // cell to its fine walk (AUDIT-VC7 R4)
  const round = fieldFns([{ ...cellOf('thunder', 0, 0, 6000), clip: [2000, 0, 9000, null] }]);
  round.globals.fReach = 1200;
  for (const xz of [[0, 0], [1500, -1000], [-1200, 800]]) { round.resolveAt(xz); assert.equal(round.globals.fNear, 0, `${xz}`); }
  round.resolveAt([6000 * 0.8, 0]);
  assert.equal(round.globals.fNear, 1, 'its rim moves');
  // THE PLUMBING: the sky march reaches as far as its stride and backs out only a stride; the shadow march never strides
  assert.equal(SKIP_ROOM, 0.02);
  assert.ok(CLOUD_FIELD_GLSL.includes('float fReach = 0.0;'), 'the shadow march never strides, and reaches nothing');
  assert.ok(MARCH_FS.includes('float coarse = ds * 3.0;   // VC6d: the stride over empty air\n  fReach = coarse;'), 'the sky march reaches as far as its stride');
  assert.ok(MARCH_FS.includes('if (rho <= 0.0) { empty++; strode = empty > 4 && fSkip > 0.5; t += strode ? coarse : ds; continue; }'));
  assert.ok(MARCH_FS.includes('if (strode) { t -= coarse; strode = false; empty = 0; continue; }'), 'a fine step is never backed out by a stride\'s length');
  assert.doesNotMatch(SHADOW_FS.slice(SHADOW_FS.indexOf('void main()')), /fSkip|strode|fReach/, 'the shadow march walks its whole path - nothing to stride');
});

