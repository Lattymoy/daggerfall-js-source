// VC7c - THE RAIN CURTAINS (2026-09-23, Mac: "improve the volumetric cloud system to be more immersive" - rain
// shafts, one of the four chosen; then "Whatever is the most visually detailed and immersive").
//   - a cell whose weather falls hangs a veil from its base to the ground: a cylinder of CURTAIN_SHARE of its
//     radius, rain's own extinction (Koschmieder's 3.0 over five kilometres), thinning to its rim, reaching up into
//     its cell and thinning to nothing there;
//   - streaked around its axis in two octaves, each faded to its mean where the sky map could not hold it;
//   - the rim's streaks stopping short of the ground each by its own amount (virga), the core's reaching it;
//   - composited IN FRONT of the slab along the ray, on every row the map writes;
//   - and the stride the march takes over empty air now asks density() whether its zero holds for a stride -
//     VC7e's cells made two that do not, and the crowns of distant clouds were specked with sky.
// What it looks like is the sky lab's (`?cloudcell=`, before/after in the arc); these pin the law and the plumbing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CURTAIN_SHARE, CURTAIN_EXT, CURTAIN_STREAKS, CURTAIN_FIBRE, CURTAIN_VIRGA, CURTAIN_STREAK_TEXELS, CURTAIN_INTO, CURTAIN_FADE_M,
  CURTAIN_FALL, SKIP_ROOM, DECK_COVER_LO, DECK_COVER_HI, VC_PROFILE, MAX_CELLS, MARCH_FS, SHADOW_FS, CLOUD_FIELD_GLSL, MARCH_UNIFORMS,
  cellOf, grownCell, packCells, VolumetricClouds,
} from '../src/render/volumetricClouds.js';

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
  // a full fall across a thunder core's chord is near opaque - which is why a real shaft reads from far off
  const chord = 2 * 6000 * CURTAIN_SHARE;
  assert.ok(Math.exp(-CURTAIN_EXT * CURTAIN_FALL.thunder[0] * chord * 0.675) < 0.05, 'a storm\'s core passes under a twentieth, at the streaks\' mean weight');
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

// the shader's chord law, term for term: the length at full weight below the base, and linearly thinning from the
// base up to its top inside the cell (curtains(), from `float tB` on)
function chordLen(ta, tb, yb, yt, dy) {
  const tB = yb / dy, t1 = Math.max(ta, tB);
  return Math.max(Math.min(tb, tB) - ta, 0) + (tb > t1 ? (tb - t1) * (yt - 0.5 * dy * (tb + t1)) / Math.max(yt - yb, 1) : 0);
}

test('VC7c: THE CHORD - full below the base, thinning to nothing at its top inside the cell: the integral, not a guess', () => {
  const weight = (y, yb, yt) => (y <= yb ? 1 : Math.max(0, (yt - y) / (yt - yb)));
  for (const [ta, tb, yb, yt, dy] of [[0, 20000, 600, 840, 0.05], [5000, 9000, 500, 944, 0.08], [9000, 12000, 600, 840, 0.01], [100, 400, 600, 840, 0.9], [12000, 16000, 500, 944, 0.06]]) {
    const tEnd = Math.min(tb, yt / dy);   // the shader's tb is already cut at the top
    let num = 0; const n = 20000, h = (tEnd - ta) / n;
    for (let k = 0; k < n; k++) num += weight(dy * (ta + (k + 0.5) * h), yb, yt) * h;
    const got = chordLen(ta, tEnd, yb, yt, dy);
    assert.ok(Math.abs(got - num) <= 1e-6 * Math.max(1, num) + 1e-3, `[${ta}, ${tb}] at ${dy}: ${got.toFixed(3)} against ${num.toFixed(3)}`);
  }
  const c = fnBody(MARCH_FS, 'vec4 curtains(vec3 cam, vec3 dir)');
  assert.ok(c.includes(`float yb = uCellA[i].x, yt = yb + ${lit(CURTAIN_INTO)} * (uCellA[i].y - yb);`), 'the base, and a share of the cell\'s depth above it');
  assert.ok(c.includes('float ta = max(-b - hw, 0.0), tb = min(-b + hw, yt / up);'));
  assert.ok(c.includes('float tB = yb / up, t1 = max(ta, tB);'));
  assert.ok(c.includes('float len = max(min(tb, tB) - ta, 0.0) + (tb > t1 ? (tb - t1) * (yt - 0.5 * dir.y * (tb + t1)) / max(yt - yb, 1.0) : 0.0);'));
  assert.ok(c.includes(`float rad = uCell[i].z * ${lit(CURTAIN_SHARE)};`), 'the fall comes out of the core, not the skirt');
  assert.ok(c.includes('float h2 = dot(o, o) - b * b * dd;') && c.includes('if (h2 >= rad * rad) continue;') && c.includes('float hw = sqrt((rad * rad - h2) / dd);'), 'the ray against the cylinder, analytic');
  assert.ok(c.includes('float core = 1.0 - h2 / (rad * rad);'), 'thinning to the rim');
  assert.ok(c.includes(`float ti = ${lit(CURTAIN_EXT)} * F.x * len * core * streak * near;`));
  assert.ok(c.includes('float near = smoothstep(0.5 * rad, 1.5 * rad, length(o));'), 'gone as the eye comes under it - the falling rain takes over there');
  assert.equal((c.match(/texture/g) || []).length, 0, 'no texture read: eight cells a sample cost arithmetic alone');
});

// the shader's streak noise, term for term (streakNoise)
function streakNoise(x, period) {
  const fract = (v) => v - Math.floor(v), mod = (a, b) => a - b * Math.floor(a / b);
  const i = Math.floor(x), f = fract(x);
  const a = fract(Math.sin(mod(i, period) * 127.1) * 43758.5453), b = fract(Math.sin(mod(i + 1, period) * 127.1) * 43758.5453);
  return a + (b - a) * f * f * (3 - 2 * f);
}

test('VC7c: THE STREAKS - two octaves that close around the axis, each faded to its mean where the map cannot hold it', () => {
  for (const period of [CURTAIN_STREAKS, 3 * CURTAIN_STREAKS]) {
    for (const u of [0, 0.013, 0.5, 0.999]) assert.ok(Math.abs(streakNoise(u * period, period) - streakNoise((u + 1) * period, period)) < 1e-9, 'a whole turn is the same streak - no seam down the curtain\'s back');
  }
  const sn = fnBody(MARCH_FS, 'float streakNoise(float x, float period)');
  assert.ok(sn.includes('float a = fract(sin(mod(i, period) * 127.1) * 43758.5453);') && sn.includes('float b = fract(sin(mod(i + 1.0, period) * 127.1) * 43758.5453);'), 'the shader\'s lattice wraps at its period, as the law above does');
  assert.ok(sn.includes('return mix(a, b, f * f * (3.0 - 2.0 * f));'));
  const c = fnBody(MARCH_FS, 'vec4 curtains(vec3 cam, vec3 dir)');
  assert.ok(c.includes('float around = atan(e.y, e.x) / (2.0 * PI) + 0.5;'), 'the angle where the ray enters, so a streak is a vertical line');
  assert.ok(c.includes(`float span = rad * uMapSize.x / (${lit(CURTAIN_STREAKS)} * max(ta, rad));`), 'a streak\'s width on the sky map, in texels');
  assert.ok(c.includes(`float s = 0.5 + ${lit(1 - CURTAIN_FIBRE)} * smoothstep(1.0, ${lit(CURTAIN_STREAK_TEXELS)}, span) * (streakNoise(around * ${lit(CURTAIN_STREAKS)}, ${lit(CURTAIN_STREAKS)}) - 0.5)`));
  assert.ok(c.includes(`+ ${lit(CURTAIN_FIBRE)} * smoothstep(1.0, ${lit(CURTAIN_STREAK_TEXELS)}, span / 3.0) * (streakNoise(around * ${lit(3 * CURTAIN_STREAKS)}, ${lit(3 * CURTAIN_STREAKS)}) - 0.5);`), 'the fibres, three to a streak');
  assert.ok(c.includes('float streak = 0.35 + 0.65 * s;'));
  // the fade, on the tiers' own maps: a storm at 20 km on the low tier keeps some of its shafts and none of its fibres
  const span = (rad, width, dist) => rad * width / (CURTAIN_STREAKS * Math.max(dist, rad));
  const lo = span(6000 * CURTAIN_SHARE, 512, 20000), hi = span(6000 * CURTAIN_SHARE, 2048, 9000);
  assert.ok(smooth(1, CURTAIN_STREAK_TEXELS, lo) > 0 && smooth(1, CURTAIN_STREAK_TEXELS, lo) < 1 && smooth(1, CURTAIN_STREAK_TEXELS, lo / 3) === 0, `lo at 20 km: ${lo.toFixed(2)} texels a streak`);
  assert.equal(smooth(1, CURTAIN_STREAK_TEXELS, hi / 3), 1, `hi at 9 km: the fibres whole (${(hi / 3).toFixed(2)} texels)`);
});

test('VC7c: THE RAGGED FOOT - the core reaches the ground, the rim stops short, each streak its own way', () => {
  const c = fnBody(MARCH_FS, 'vec4 curtains(vec3 cam, vec3 dir)');
  assert.ok(c.includes(`float foot = min(yb * ${lit(CURTAIN_VIRGA)} * (1.0 - core) * (0.5 + s), 0.95 * yb);`));
  assert.ok(c.includes('ta = max(ta, foot / up);'));
  const foot = (core, s, yb = 600) => Math.min(yb * CURTAIN_VIRGA * (1 - core) * (0.5 + s), 0.95 * yb);
  assert.equal(foot(1, 0.9), 0, 'the core\'s streaks reach the ground');
  assert.ok(foot(0.2, 0.2) < foot(0.2, 0.8), 'two streaks at one distance from the axis stop at different heights');
  assert.ok(foot(0, 1) < 600, 'and never above the base - a curtain is never cut off from its cloud');
});

test('VC7c: IN FRONT OF THE SLAB, on every row the map writes, in their own aerial perspective', () => {
  const main = MARCH_FS.slice(MARCH_FS.indexOf('void main() {', MARCH_FS.indexOf('vec3 lightOctaves')));
  assert.ok(MARCH_FS.includes('vec4 underCurtains(vec3 col, float T, vec3 cam, vec3 dir) {'));
  const under = fnBody(MARCH_FS, 'vec4 underCurtains(vec3 col, float T, vec3 cam, vec3 dir)');
  assert.ok(under.includes('vec4 veil = curtains(cam, dir);') && under.includes('return vec4(veil.rgb + veil.a * col, T * veil.a);'), 'the veil over what is behind it, and the sky\'s share through both');
  // every exit of the march answers through it: the two early rows and the march's own end
  const exits = main.match(/outColor = [^;]*;/g);
  assert.ok(exits.length >= 3 && exits.every((e) => e.startsWith('outColor = underCurtains(')), exits.join(' | '));
  assert.ok(main.indexOf('col = mix(col, uHorizonColor * (1.0 - T), fade);') < main.lastIndexOf('outColor = underCurtains('), 'after the slab\'s own aerial fade - the curtain stands nearer than the slab');
  const c = fnBody(MARCH_FS, 'vec4 curtains(vec3 cam, vec3 dir)');
  assert.ok(c.includes(`veil = mix(veil, uHorizonColor * (1.0 - Tv), 1.0 - exp(-tNear / ${lit(CURTAIN_FADE_M)}));`), 'their own aerial perspective');
  assert.ok(c.includes('if (tau <= 0.0) return vec4(0.0, 0.0, 0.0, 1.0);'), 'no curtain, nothing changed');
  assert.ok(c.includes('tint += mix(mix(uCloudShade * (1.0 - 0.6 * uCellB[i].x), uHorizonColor, 0.3), mix(uCloudLit, uHorizonColor, 0.4), F.y) * ti;'), 'rain the cell\'s own dark grey, snow pale');
  assert.doesNotMatch(c.replace(/\/\/[^\n]*/g, ''), /\bhalf\b|\bflat\b/, 'no variable GLSL ES 3.00 reserves');
});

test('VC7c: THE STRIDE\'S EVIDENCE - a stride only over a zero that holds for one, and only a stride is backed out', () => {
  assert.equal(SKIP_ROOM, 0.02);
  // resolveAt knows whether a cell's rim is within a stride: there the column's base, top and type move
  const res = fnBody(CLOUD_FIELD_GLSL, 'void resolveAt(vec2 xz)');
  assert.match(res, /fNear = 0\.0;\n  for \(int i = 0; i < 8; i\+\+\) \{/);
  assert.ok(res.includes('float dc = shapedDist(xz - c.xy, uCellS[i], uCellU[i]);') && res.includes('if (dc < c.z + fReach) fNear = 1.0;'));
  assert.ok(res.includes('float w = 1.0 - smoothstep(c.z - c.w, c.z, dc);'), 'the weight from the same distance');
  assert.ok(CLOUD_FIELD_GLSL.includes('float fReach = 0.0;'), 'the shadow march never strides, and reaches nothing');
  assert.ok(MARCH_FS.includes('float coarse = ds * 3.0;   // VC6d: the stride over empty air\n  fReach = coarse;'), 'the sky march reaches as far as its stride');
  const den = fnBody(CLOUD_FIELD_GLSL, 'float density(vec3 p, float mip)');
  assert.match(den, /fSkip = 1\.0 - fNear;[^\n]*\n  float hr = [^\n]*\n  if \(hr <= 0\.0 \|\| hr >= 1\.0\) return 0\.0;/, 'outside the band: a stride, unless a cell\'s rim moves the band within one');
  assert.ok(den.includes('if (h <= 0.0) { fSkip = 0.0; return 0.0; }'), 'under a lane\'s lifted base the core beside it comes lower');
  assert.ok(den.includes(`float deckCells = smoothstep(${lit(DECK_COVER_LO)}, ${lit(DECK_COVER_HI)}, fCover);`));
  assert.ok(den.includes('float hn = clamp(h / max(col.y, 0.05), 0.0, 1.0);\n  float grad = heightGradient(hn, col.z);'));
  assert.ok(den.includes('bool moves = deckCells > 0.0 || fNear > 0.5 || hn < mix(0.08, 0.12, col.z);'), 'the ramp grows within a stride in a lane, a cell\'s rim, or up its own foot - which every ray of the sky map climbs');
  // the foot is where heightGradient still rises: a tower's ramp peaks at 0.08, a lid's at 0.12
  const hg = (h, lid) => { const s = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }; return (1 - lid) * s(0, 0.08, h) * (1 - s(0.5, 1, h)) + lid * s(0, 0.12, h) * (1 - s(0.25, 0.5, h)); };
  for (const lid of [0, 1]) { const peak = lid ? 0.12 : 0.08; assert.ok(hg(peak - 0.01, lid) < hg(peak, lid) && hg(peak, lid) === 1, `the ${lid ? 'lid' : 'tower'} ramp tops out at ${peak}`); }
  assert.ok(den.includes('if (grad <= 0.0) { fSkip = moves ? 0.0 : 1.0; return 0.0; }'), 'over a lowered ceiling the core beside it stands taller; with nothing moving, the ceiling moves at the variation\'s 65 km');
  assert.match(den, /float raw = remap\(s\.r, -\(1\.0 - lowFbm\), 1\.0, 0\.0, 1\.0\);\n  float base = raw \* grad;/);
  assert.ok(den.includes('float room = (1.0 - coverage) - (moves ? raw : base);'), 'where the profile moves, the shape BEFORE the height ramp - a lid\'s thin top reads far under the cut where the shape is not');
  assert.ok(den.includes(`if (base <= 0.0) { fSkip = room > ${lit(SKIP_ROOM)} ? 1.0 : 0.0; return 0.0; }`), 'under the cut only by a margin');
  assert.match(den, /if \(base <= 0\.0\) \{ fSkip[^\n]*\n  fSkip = 0\.0;/, 'inside the shape: only the erosion stands between here and cloud');
  assert.ok(MARCH_FS.includes('if (rho <= 0.0) { empty++; strode = empty > 4 && fSkip > 0.5; t += strode ? coarse : ds; continue; }'));
  assert.ok(MARCH_FS.includes('if (strode) { t -= coarse; strode = false; empty = 0; continue; }'), 'a fine step is never backed out by a stride\'s length');
  assert.doesNotMatch(SHADOW_FS.slice(SHADOW_FS.indexOf('void main()')), /fSkip|strode|fReach/, 'the shadow march walks its whole path - nothing to stride');
});

