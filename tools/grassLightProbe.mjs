// GRASS-LIT: THE GRASS AGAINST THE GROUND IT STANDS ON, IN NUMBERS - no GPU, no game data.
//
// The ground is drawn by the terrain programs (render/renderer.js TERRAIN_FS on the classic lane,
// render/enhancedLighting.js EL_TERRAIN_FS under Enhanced Lighting) and the grass by its own
// (render/labGrass.js GAME_GRASS_FS). This walks the day's real light (world/worldClock.js, the
// weather's own scales) through both, term for term in JS, for a grass tile of every climate
// (their measured means, below), and prints what the eye gets: the ground's displayed colour and the
// grass's at its root, its middle and its tip. `node tools/grassLightProbe.mjs`.
//
// GRASS-LIT2: and the two cases GRASS-LIT left unpaid - a hillside facing toward and away from a low sun (the blade
// lit about the ground's own normal, against straight up as it was), and a lantern at night beside the field (the
// ground lit by it, the grass now too).
import { exteriorAmbient, sunScale, sunDirection, SUN_RIG_COLOR } from '../src/world/worldClock.js';
import { weatherSunlightScale } from '../src/world/weather.js';
import { elDecode, elEncode, elTonemapRGB, elAttenuation, EL_EXPOSURE } from '../src/render/enhancedLighting.js';
import { LAB_DIM, grassLit, GRASS_TILE_MEANS, GRASS_TONES } from '../src/render/labGrass.js';

const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const hex = (c) =>
  '#' +
  c
    .map((v) =>
      Math.round(Math.min(1, Math.max(0, v)) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
const minute = (h, m = 0) => h * 60 + m;
const CASES = [
  ['noon, sunny', minute(12), 'sunny'],
  ['9:00, sunny', minute(9), 'sunny'],
  ['18:30, sunny', minute(18, 30), 'sunny'],
  ['noon, overcast', minute(12), 'overcast'],
  ['noon, rain', minute(12), 'rain'],
  ['noon, thunder', minute(12), 'thunder'],
];
/** the terrain's displayed colour for an albedo on ground of normal `light.normal` (up when absent), with
 *  `light.points` (lanterns, display colours) at `light.root` - TERRAIN_FS / EL_TERRAIN_FS's lit line, spec aside */
function ground(tex, light, lane) {
  const n = light.normal ?? [0, 1, 0];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const diff = Math.max(dot(n, light.sunDir) / Math.hypot(...light.sunDir), 0);
  const dec = (v) => (lane ? elDecode(v) : v);
  const pt = [0, 0, 0],
    at = light.root ?? [0, 0, 0];
  for (const p of light.points ?? []) {
    const L = p.at.map((v, i) => v - at[i]),
      d = Math.hypot(...L);
    if (d >= p.range) continue;
    const k = (lane ? elAttenuation(d, p.range) : (1 - d / p.range) ** 2) * Math.max(dot(n, L) / d, 0);
    for (let i = 0; i < 3; i++) pt[i] += k * dec(p.color[i]);
  }
  const lit = tex.map((t, i) => dec(t) * (dec(light.amb[i]) + dec(light.sunCol[i]) * light.sunScale * diff + pt[i]));
  return lane ? elTonemapRGB(lit.map((v) => v * EL_EXPOSURE)).map(elEncode) : lit;
}
const old = (ground, t, light) => {
  // the shipped law (GAME_GRASS_FS before GRASS-LIT), smooth style, sun on a leaning blade ~ the flat's lambert
  const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  const ss = (a, b, x) => {
    const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return u * u * (3 - 2 * u);
  };
  let c = mix(
    ground.map((v) => v * 0.62),
    [0.13, 0.2, 0.07],
    ss(0, 0.55, t),
  );
  c = mix(c, [0.24, 0.32, 0.12], ss(0.5, 1, t));
  const lam = Math.max(light.sunDir[1], 0) * 0.9;
  return c.map(
    (v, i) => v * (light.amb[i] * 1.25 * (0.42 + 0.58 * t) + light.sunCol[i] * light.sunScale * 1.15 * lam) * light.dim,
  );
};
for (const lane of [false, true]) {
  console.log(`\n== ${lane ? 'ENHANCED LIGHTING' : 'CLASSIC'} lane ==`);
  for (const [name, m, wx] of CASES) {
    const ws = weatherSunlightScale(wx, false);
    const light = {
      amb: [...exteriorAmbient(m, 1, ws)],
      sunScale: sunScale(m) * ws,
      sunCol: [...SUN_RIG_COLOR],
      sunDir: [...sunDirection(m)],
      dim: LAB_DIM[wx] ?? 1,
    };
    const rows = [];
    for (const [climate, mean] of Object.entries(GRASS_TILE_MEANS)) {
      const g = ground(mean, light, lane);
      const o = [0.15, 0.5, 0.9].map((t) => old(mean, t, light));
      const n = [0.15, 0.5, 0.9].map((t) => grassLit(mean, t, light, lane));
      rows.push(
        `${climate.padEnd(9)} ground ${hex(g)} L${lum(g).toFixed(3)} | was ${o.map(hex).join(' ')} (${(lum(o[1]) / lum(g)).toFixed(2)}x) | now ${n.map(hex).join(' ')} (${(lum(n[1]) / lum(g)).toFixed(2)}x)`,
      );
    }
    console.log(`-- ${name}`);
    for (const r of rows) console.log('  ' + r);
  }
}

// GRASS-LIT2: the hillside and the lantern. `was` is the blade before GRASS-LIT2 (straight up, no lanterns, and on the
// classic lane GRASS_TONES - its own tones are GRASS-LIT2's) - grassLit with the case's normal and lanterns taken away;
// `now` is grassLit as it stands. AUDIT GRASS-LIT2: the classic `was` had been painted in today's classic tones.
const SLOPES = [
  ['level', [0, 1, 0]],
  ['30 deg toward the sun', [0.5, 0.866, 0]],
  ['30 deg away from it', [-0.5, 0.866, 0]],
]; // the 9:00 sun stands to +x
const LANTERN = { at: [2.5, 1.6, 0], range: 18, color: [0.98, 0.79, 0.54] };
for (const lane of [false, true]) {
  console.log(`\n== GRASS-LIT2, ${lane ? 'ENHANCED LIGHTING' : 'CLASSIC'} lane ==`);
  const m9 = minute(9);
  const base = {
    amb: [...exteriorAmbient(m9, 1, 1)],
    sunScale: sunScale(m9),
    sunCol: [...SUN_RIG_COLOR],
    sunDir: [...sunDirection(m9)],
  };
  console.log(`-- 9:00, sunny, sun ${base.sunDir.map((v) => v.toFixed(2))}`);
  for (const [name, normal] of SLOPES) {
    const mean = GRASS_TILE_MEANS.woodland,
      light = { ...base, normal };
    const g = ground(mean, light, lane),
      was = grassLit(mean, 0.5, base, lane, 1, GRASS_TONES),
      now = grassLit(mean, 0.5, light, lane);
    console.log(
      `  ${name.padEnd(22)} ground ${hex(g)} | was ${hex(was)} (${(lum(was) / lum(g)).toFixed(2)}x) | now ${hex(now)} (${(lum(now) / lum(g)).toFixed(2)}x)`,
    );
  }
  const m = minute(23, 30);
  const night = {
    amb: [...exteriorAmbient(m, 1, 1)],
    sunScale: sunScale(m),
    sunCol: [...SUN_RIG_COLOR],
    sunDir: [...sunDirection(m)],
  };
  console.log('-- 23:30, a lantern 2.5 m off at 1.6 m');
  for (const [where, root] of [
    ['under it', [2.5, 0, 0]],
    ['at 2.5 m', [0, 0, 0]],
    ['at 8 m', [-5.5, 0, 0]],
    ['at 15 m', [-12.5, 0, 0]],
  ]) {
    const mean = GRASS_TILE_MEANS.woodland,
      lit = { ...night, root, points: [LANTERN] };
    const g = ground(mean, lit, lane),
      was = grassLit(mean, 0.5, night, lane, 1, GRASS_TONES),
      now = grassLit(mean, 0.5, lit, lane);
    console.log(
      `  ${where.padEnd(22)} ground ${hex(g)} | was ${hex(was)} (${(lum(was) / lum(g)).toFixed(2)}x) | now ${hex(now)} (${(lum(now) / lum(g)).toFixed(2)}x)`,
    );
  }
}
