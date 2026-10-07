// @ts-check
// SD7b (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 9): THE STEPS' ART - what the
// Unmoored Steps wear that the Hour and the hall do not already (the realm's own pseudo-archive, world/sdRealm.js
// SD_REALM_ARCHIVE, records after the hall's), made in code as theirs are: nothing ships, the same pixels every boot.
// Each `{ albedo, emission }` in the renderer's color32 shape - RGBA rows, row 0 the texture's v 0, drawn with y up.
//
//   cracked - a Crumble step's top: dark stone split by a net of cracks, the void's ember light showing through them -
//             a stone that will not hold
//   beat    - a Beat step's top: a brass plate alight, a bright rim and the twelve hours round a dark hub - a step that
//             is there on the Hour's beat
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).

/** The records, after the hall's (world/sdHallArt.js, 5-20). */
export const SD_STEPS_CRACKED_RECORD = 21;
export const SD_STEPS_BEAT_RECORD = 22;
/** The pictures' side, texels. */
export const SD_STEPS_ART_SIZE = 64;
const STONE = [40, 35, 32], STONE_DARK = [18, 16, 15], EMBER = [255, 150, 60], EMBER_GLOW = [210, 100, 34];
const BRASS_DIM = [110, 78, 34], BRASS_BRIGHT = [255, 214, 130];

const image = (S) => ({ width: S, height: S, colors: new Uint8Array(S * S * 4) });
const put = (img, x, y, rgb) => { const i = (y * img.width + x) * 4; img.colors[i] = rgb[0]; img.colors[i + 1] = rgb[1]; img.colors[i + 2] = rgb[2]; img.colors[i + 3] = 255; };
const mix = (a, b, t) => [0, 1, 2].map((k) => Math.round(Math.max(0, Math.min(255, a[k] + (b[k] - a[k]) * t))));
const scale = (c, k) => mix([0, 0, 0], c, k);
/** Every texel of an S-square picture, (u, v) in [-1, 1] with v UP, painted by `paint(u, v, x, y)` -> [albedo, emission]. */
function paintAll(S, paint) {
  const albedo = image(S), emission = image(S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const [a, e] = paint(((x + 0.5) / S) * 2 - 1, ((y + 0.5) / S) * 2 - 1, x, y);
    put(albedo, x, y, a); put(emission, x, y, e);
  }
  return { albedo, emission };
}
/** Distance from (px, py) to the segment a-b. */
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};
/** A texel's grain: a fixed hash of its place, 0 to 1 (no Math.random - the same stone every boot). */
const grain = (x, y) => ((Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263)) >>> 0) % 1000 / 1000;

/** The cracks: five wandering lines, each from a point by the plate's middle out to its edge, drawn from a fixed seed. */
export function crackLines() {
  let seed = 0x5d7b;
  const next = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const lines = [];
  for (let k = 0; k < 5; k++) {
    let x = (next() - 0.5) * 0.5, y = (next() - 0.5) * 0.5, a = (k / 5) * Math.PI * 2 + next() * 0.8;
    const pts = [[x, y]];
    for (let j = 0; j < 7; j++) {
      a += (next() - 0.5) * 1.1;
      x += Math.cos(a) * 0.2; y += Math.sin(a) * 0.2;
      pts.push([x, y]);
    }
    lines.push(pts);
  }
  return lines;
}

/** A Crumble step's top: dark grained stone, the cracks alight. */
export function crackedArt() {
  const lines = crackLines();
  return paintAll(SD_STEPS_ART_SIZE, (u, v, x, y) => {
    let d = Infinity;
    for (const pts of lines) for (let j = 1; j < pts.length; j++) d = Math.min(d, segDist(u, v, pts[j - 1][0], pts[j - 1][1], pts[j][0], pts[j][1]));
    if (d < 0.035) return [EMBER, EMBER_GLOW];
    const stone = mix(STONE_DARK, STONE, 0.45 + 0.35 * grain(x, y));
    if (d < 0.08) return [scale(stone, 0.6), scale(EMBER_GLOW, 0.15)];   // the crack's dark lip
    return [stone, [0, 0, 0]];
  });
}

/** A Beat step's top: a brass plate alight, its rim bright, twelve hours round a dark hub. */
export function beatArt() {
  return paintAll(SD_STEPS_ART_SIZE, (u, v) => {
    const edge = Math.max(Math.abs(u), Math.abs(v)), r = Math.hypot(u, v);
    if (edge > 0.86) return [BRASS_BRIGHT, BRASS_BRIGHT];
    const hour = ((Math.atan2(u, v) / (Math.PI * 2)) * 12 + 12) % 12;
    const tick = Math.abs(hour - Math.round(hour)) * (Math.PI / 6) * r;
    if (r > 0.5 && r < 0.72 && tick < 0.05) return [BRASS_BRIGHT, scale(BRASS_BRIGHT, 0.85)];
    if (r < 0.18) return [STONE_DARK, [0, 0, 0]];
    return [BRASS_DIM, scale(BRASS_BRIGHT, 0.3)];
  });
}

/** Every picture the Steps wear, by record: `[record, { albedo, emission }]`.
 * @returns {Array<[number, ReturnType<typeof paintAll>]>} */
export function stepsArt() {
  return [[SD_STEPS_CRACKED_RECORD, crackedArt()], [SD_STEPS_BEAT_RECORD, beatArt()]];
}
