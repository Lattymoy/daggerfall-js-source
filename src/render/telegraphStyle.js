// @ts-check
// TELL2 (bible/12-Enhanced-AI/Feud-Arc.md section 4.4; Mac, 2026-10-04: "breath more depth into it"): A TELEGRAPH'S
// LOOK, a LEAF of GLSL importing nothing - the world boss's readable line (render/gateTelegraph.js, WB13a) at a foe's
// scale, for the foe's pass (render/foeTelegraph.js) to compose. The boss's own pass imports the boss's brain and is never
// imported whole; this is the part of its look a foe's mark needs:
//   - THE LINE: two pixels wide wherever it is seen (its width read off the outline's own screen derivative), a dark
//     KEYLINE just outside it (the blend darkens the floor there - a pale fill no longer vanishes on snow or sand) and a
//     soft glow past that;
//   - THE FILL: dim at once, deepening behind its front as the wind-up runs (`t`, the shape's own fill coordinate `s`);
//   - NOW: the last stretch before the landing brightens the line toward white and the fill with it (`nowK`);
//   - THE LANDING: white-hot at once, fading (`flash`).
// Premultiplied colour out, for the pass's blend (ONE, ONE_MINUS_SRC_ALPHA). `fogK` the fog's factor (with the near floor
// already taken), applied to both.
// TELL3 (section 5): AN IRON BLOW, never by colour alone - a second line IRON_INSET inside the first, and a diagonal
// hatch across its fill every IRON_HATCH metres (`telegraphIron`, over the style above).
// TELL9 (section 11.3): TELEGRAPH CONTRAST, the player's preference - over all of it, a line twice as thick, a WHITE
// keyline outside that, and a pattern for every guard: a poise mark's fill dotted every CONTRAST_DOTS metres (iron's
// hatch stands always) (`telegraphContrast`).
// AUDIT TELL U1: every band is pixels wide, and metres-capped - at a grazing look a pixel spans metres, and the keyline,
// the glow and the white keyline then reached past the 0.5 m the pass draws beyond an outline and were cut off there in a
// hard edge (TELEGRAPH_BAND_CAP for the style and iron's, CONTRAST_BAND_CAP for the contrast's, whose outer band ends
// at 7.5 of them). U2: the contrast keeps a dark band between its line and its white keyline - white on snow or sand
// is no edge.

/** TELL3: the iron mark's second rim, metres inside its outline. */
export const IRON_INSET = 0.25;
/** TELL3: the iron hatch's spacing along its diagonal, metres. */
export const IRON_HATCH = 0.35;
/** TELL9: the contrast dots' spacing on a poise mark's fill, and their radius, metres. */
export const CONTRAST_DOTS = 0.3;
export const CONTRAST_DOT_R = 0.06;
/** AUDIT TELL U1: the most a band's pixel unit may stand for, metres (5 of the style's inside 0.5 m; 7.5 of the contrast's). */
export const TELEGRAPH_BAND_CAP = 0.1;
export const CONTRAST_BAND_CAP = 0.0625;

export const TELEGRAPH_STYLE_GLSL = `
// edge: metres to the shape's outline (unsigned); fin: 1 inside, 0 outside; s: the fill coordinate (0 its root, 1 its far
// edge); t: how far the fill has reached; nowK: 0..1 through the last stretch; flash: the landing's 1..0; col: its colour
vec4 telegraphStyle(float edge, float fin, float s, float t, float nowK, float flash, vec3 col, float fogK) {
  float aa = min(max(fwidth(edge), 1e-4), ${TELEGRAPH_BAND_CAP.toFixed(4)});
  float core = 1.0 - smoothstep(aa, 2.2 * aa, edge);
  float keyl = (1.0 - fin) * (1.0 - core) * (1.0 - smoothstep(2.2 * aa, 5.0 * aa, edge));
  float glow = (1.0 - fin) * smoothstep(4.0 * aa, 6.0 * aa, edge) * exp(-(edge - 5.0 * aa) / (4.0 * aa + 0.08));   // past the keyline, never over it
  float fs = max(fwidth(s), 1e-4);
  float filled = fin * (1.0 - smoothstep(t - fs, t + fs, s));
  vec3 lineCol = mix(col, vec3(1.0, 0.95, 0.85), 0.45 * nowK);
  vec3 rgb = col * (fin * 0.10 + filled * (0.22 + 0.40 * t * t + 0.25 * nowK)) + lineCol * (core * (0.9 + 0.6 * nowK) + glow * 0.2);
  float a = fin * (0.20 + 0.20 * filled) + keyl * 0.55 + core * 0.6;
  if (flash > 0.0) {
    vec3 hot = mix(col, vec3(1.0, 0.96, 0.88), 0.6);
    rgb = hot * fin * (0.25 + 1.1 * flash) + lineCol * core;
    a = fin * (0.35 + 0.35 * flash) + core * 0.6;
  }
  return vec4(rgb * fogK, clamp(a, 0.0, 1.0) * fogK);
}
// TELL3: the iron mark over the style's colour - p the fragment's place in the shape's own frame (across, along)
vec4 telegraphIron(vec4 o, float edge, float fin, vec2 p, vec3 col, float fogK) {
  float aa = min(max(fwidth(edge), 1e-4), ${TELEGRAPH_BAND_CAP.toFixed(4)});
  float inner = fin * (1.0 - smoothstep(aa, 2.2 * aa, abs(edge - ${IRON_INSET.toFixed(3)})));
  float u = (p.x + p.y) / ${IRON_HATCH.toFixed(3)};
  float fu = max(fwidth(u), 1e-4);
  float hatch = fin * (1.0 - smoothstep(0.12, 0.12 + fu, abs(fract(u) - 0.5))) * step(${IRON_INSET.toFixed(3)} + 2.2 * aa, edge);
  vec3 rgb = col * (inner * 0.9 + hatch * 0.35);
  return vec4(o.rgb + rgb * fogK, clamp(o.a + (inner * 0.55 + hatch * 0.18) * fogK, 0.0, 1.0));
}
// TELL9: telegraph contrast over the style (and iron's) - the line widened to twice its width, a white keyline outside
// it, and a poise mark's fill dotted (iron 1 keeps its hatch alone); AUDIT TELL U2: a dark band between the two
vec4 telegraphContrast(vec4 o, float edge, float fin, vec2 p, float iron, vec3 col, float fogK) {
  float aa = min(max(fwidth(edge), 1e-4), ${CONTRAST_BAND_CAP.toFixed(4)});
  float thick = (1.0 - smoothstep(2.2 * aa, 4.4 * aa, edge)) * smoothstep(aa, 2.2 * aa, edge);
  float kd = (1.0 - fin) * smoothstep(4.0 * aa, 4.4 * aa, edge) * (1.0 - smoothstep(5.0 * aa, 5.4 * aa, edge));
  float kw = (1.0 - fin) * smoothstep(5.0 * aa, 5.4 * aa, edge) * (1.0 - smoothstep(7.0 * aa, 7.5 * aa, edge));
  vec2 q = (fract(p / ${CONTRAST_DOTS.toFixed(3)} + 0.5) - 0.5) * ${CONTRAST_DOTS.toFixed(3)};
  float fq = max(fwidth(length(q)), 1e-4);
  float dots = (1.0 - iron) * fin * (1.0 - smoothstep(${CONTRAST_DOT_R.toFixed(3)}, ${CONTRAST_DOT_R.toFixed(3)} + fq, length(q))) * step(0.1 + 4.4 * aa, edge);
  vec3 rgb = col * (thick * 0.9 + dots * 0.55) + vec3(1.0) * kw * 0.85;
  return vec4(o.rgb * (1.0 - kd * 0.7 * fogK) + rgb * fogK, clamp(o.a + (thick * 0.6 + kd * 0.6 + kw * 0.6 + dots * 0.3) * fogK, 0.0, 1.0));
}`;
