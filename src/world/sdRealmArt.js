// @ts-check
// SD5a (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 7): THE SHATTERED HOUR'S ART -
// the textures its floors wear (pseudo-archive SD_REALM_ARCHIVE, world/sdRealm.js), made here in code as the court's are
// (world/gateArt.js): nothing ships, the same pixels every boot. Each `{ albedo, emission }`, the renderer's color32 shape
// (RGBA rows), the emission its own light - so the Hour's brass glows in the void where no lamp reaches it.
//
//   floor - dark stone set in brass: square flags, their joints brass, a gear's teeth engraved here and there
//   brass - the rims, the kerbs, the pillars: warm metal, rubbed bright along its grain, a little of its own light
//   root  - the islands' undersides: near-black stone, veined faintly with the Hour's gold
//   dial  - the Orrery's floor, the Hour-dial: a disc of dark stone, twelve brass hours round its rim, a ring of six
//           segments within (each stone's, which the hall lights for every stone at its true hour - SD6)
//   arena - the Last Moment's floor: brass cracked into plates, the Mantella's light glowing in the cracks
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).

/** The tiles' side, texels; the dial's (one image over the whole hall). */
export const SD_ART_SIZE = 64;
export const SD_DIAL_SIZE = 256;
export const SD_BRASS = Object.freeze([196, 146, 64]);
export const SD_BRASS_BRIGHT = Object.freeze([246, 206, 120]);
export const SD_STONE = Object.freeze([34, 30, 28]);
export const SD_STONE_DARK = Object.freeze([16, 14, 14]);
export const SD_MANTELLA = Object.freeze([150, 255, 200]);

/** mulberry32 - the port's seeded rng (world/gateArt.js's own), kept here so the art is the realm's alone. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Tileable value noise over an n x n lattice, sampled at (x, y) in texels of an S-texel tile. */
function noiseField(seed, n, S = SD_ART_SIZE) {
  const r = rng(seed);
  const lat = Float32Array.from({ length: n * n }, () => r());
  const at = (i, j) => lat[((j % n + n) % n) * n + ((i % n + n) % n)];
  const smooth = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = (x / S) * n, fy = (y / S) * n;
    const i = Math.floor(fx), j = Math.floor(fy);
    const tx = smooth(fx - i), ty = smooth(fy - j);
    const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
}
const image = (S = SD_ART_SIZE) => ({ width: S, height: S, colors: new Uint8Array(S * S * 4) });
const put = (img, x, y, rgb, a = 255) => {
  const S = img.width, i = (((y % S + S) % S) * S + ((x % S + S) % S)) * 4;
  img.colors[i] = rgb[0]; img.colors[i + 1] = rgb[1]; img.colors[i + 2] = rgb[2]; img.colors[i + 3] = a;
};
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t].map((v) => Math.round(Math.max(0, Math.min(255, v))));
const scale = (c, k) => mix([0, 0, 0], c, k);

/** The Hour's floor: four by four flags of dark stone, brass in their joints, a gear engraved on one in three. */
export function realmFloorArt(seed = 0x5d50) {
  const S = SD_ART_SIZE, albedo = image(), emission = image();
  const tone = noiseField(seed, 8), r = rng(seed + 1);
  const N = 4, cell = S / N;
  const gears = Array.from({ length: N * N }, () => r() < 0.34);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const cx = x % cell, cy = y % cell;
    const joint = cx < 1.5 || cy < 1.5;
    if (joint) { put(albedo, x, y, SD_BRASS); put(emission, x, y, scale(SD_BRASS, 0.18)); continue; }
    let c = mix(SD_STONE_DARK, SD_STONE, 0.4 + 0.6 * tone(x, y));
    const k = Math.floor(y / cell) * N + Math.floor(x / cell);
    if (gears[k]) {
      const gx = cx - cell / 2, gy = cy - cell / 2, d = Math.hypot(gx, gy), a = Math.atan2(gy, gx);
      const teeth = 4.2 + (Math.cos(a * 8) > 0 ? 1.2 : 0);
      if (Math.abs(d - teeth) < 0.7 || Math.abs(d - 1.6) < 0.5) c = mix(c, SD_BRASS, 0.55);
    }
    put(albedo, x, y, c); put(emission, x, y, [0, 0, 0]);
  }
  return { albedo, emission };
}

/** Brass: rubbed along its grain (u), bright streaks and dark, a little of its own warmth. */
export function realmBrassArt(seed = 0x5d51) {
  const S = SD_ART_SIZE, albedo = image(), emission = image();
  const grain = noiseField(seed, 16), broad = noiseField(seed + 2, 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const g = 0.6 * grain(x * 0.25, y * 4) + 0.4 * broad(x, y);
    const c = mix(scale(SD_BRASS, 0.7), SD_BRASS_BRIGHT, g);
    put(albedo, x, y, c); put(emission, x, y, scale(c, 0.12));
  }
  return { albedo, emission };
}

/** The islands' root: near-black stone, faint gold veins wandering down it. */
export function realmRootArt(seed = 0x5d52) {
  const S = SD_ART_SIZE, albedo = image(), emission = image();
  const tone = noiseField(seed, 8), vein = noiseField(seed + 3, 6);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = Math.abs(vein(x, y) - 0.5) < 0.025;
    const c = v ? mix(SD_STONE_DARK, SD_BRASS, 0.5) : mix([8, 7, 7], SD_STONE_DARK, tone(x, y));
    put(albedo, x, y, c); put(emission, x, y, v ? scale(SD_BRASS, 0.35) : [0, 0, 0]);
  }
  return { albedo, emission };
}

/** The Hour-dial, one image over the Orrery's hall: dark stone, twelve brass hours at the rim (the twelfth the brightest,
 *  toward the arena), a brass ring within, and six segments of a lesser ring - each a stone's, dark until SD6 lights it. */
export function realmDialArt(seed = 0x5d53) {
  const S = SD_DIAL_SIZE, albedo = image(S), emission = image(S);
  const tone = noiseField(seed, 16, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = ((x + 0.5) / S) * 2 - 1, v = ((y + 0.5) / S) * 2 - 1;
    const r = Math.hypot(u, v), a = Math.atan2(u, v);   // 0 toward +z (v), the twelfth hour
    let c = mix(SD_STONE_DARK, SD_STONE, 0.5 + 0.5 * tone(x, y)), e = [0, 0, 0];
    const hour = ((a / (Math.PI * 2)) * 12 + 12) % 12;
    const tick = Math.abs(hour - Math.round(hour)) * (Math.PI * 2 / 12) * r;
    if (r > 0.86 && r < 0.97 && tick < (Math.round(hour) % 12 === 0 ? 0.035 : 0.02)) { c = [...SD_BRASS_BRIGHT]; e = scale(SD_BRASS, 0.6); }
    else if (Math.abs(r - 0.82) < 0.012) { c = [...SD_BRASS]; e = scale(SD_BRASS, 0.3); }
    else if (r > 0.5 && r < 0.56 && Math.abs(((hour * 0.5) % 1) - 0.5) < 0.42) { c = mix(c, SD_BRASS, 0.35); }
    if (r > 0.99) c = [...SD_BRASS];
    put(albedo, x, y, c); put(emission, x, y, e);
  }
  return { albedo, emission };
}

/** The Last Moment's floor: brass broken into plates, the Mantella's pale green light in the cracks. */
export function realmArenaArt(seed = 0x5d54) {
  const S = SD_ART_SIZE, albedo = image(), emission = image();
  const r = rng(seed), tone = noiseField(seed + 1, 8);
  const centres = Array.from({ length: 9 }, () => [r() * S, r() * S]);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let d1 = Infinity, d2 = Infinity;
    for (const [cx, cy] of centres) for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      const d = Math.hypot(x - cx - ox, y - cy - oy);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
    if (d2 - d1 < 1.1) { put(albedo, x, y, SD_MANTELLA); put(emission, x, y, scale(SD_MANTELLA, 0.8)); continue; }
    const c = mix(scale(SD_BRASS, 0.55), SD_BRASS, tone(x, y));
    put(albedo, x, y, c); put(emission, x, y, scale(c, 0.08));
  }
  return { albedo, emission };
}

/** Every texture the realm wears, by record: `[record, { albedo, emission }]` (records as world/sdRealm.js names them). */
export const realmArt = () => [
  [0, realmFloorArt()], [1, realmBrassArt()], [2, realmRootArt()], [3, realmDialArt()], [4, realmArenaArt()],
];
