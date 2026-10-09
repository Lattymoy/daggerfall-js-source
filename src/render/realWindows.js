// @ts-check
// RW1 (2026-10-09, Mac: "The implementation of the real window overhaul, allowing players to see inside/outside of
// house windows"): REAL WINDOWS - the law, the shader text and the view out's arithmetic, in one home.
//
// FROM THE STREET, A ROOM. Every exterior window's glass - DFU's own table (climateSwaps.isExteriorWindow), its texels
// the palette's 0xff (getWindowColors32), the mask the R2 emission already uploads - shows a ROOM behind it: interior
// mapping in the solid shader. The wall's texture frame comes off the screen derivatives (no tangents in the vertex
// format), the glass's tile is one room's facade, and a ray from the eye through the texel is marched out of a box
// behind the wall - back wall, side walls, floor, ceiling, a piece of furniture, curtains - painted from the numbers in
// world/windowRoomArt.js. By day the room is dim behind the glass's own sky-blue (the window style's day colour, which
// stays on top as the reflection); at night it takes the night style's amber as its lamp, and some rooms stand dark
// (ROOM_LIT_SHARE). The room fades back into the classic glass with distance (ROOM_FADE_*), under the scene's fog.
// The rooms are a FRAME's: an exterior host asks for them after its beginFrame (renderer.setWindowRooms), so an
// interior, a dungeon, a panel or a map never draws one.
//
// FROM INSIDE, THE WORLD. While the player stands in a building, the glass of its windows shows the real exterior:
// the street drawn from the interior camera into a target of its own (renderer.outsideViewFrame - the exterior's
// light, fog, lanterns and window style; the exterior host decides what it draws), cropped to the screen rectangle
// the glass covered last frame (the glass's own frustum: a small pane is a small pass), at half the world's
// resolution, and kept while the camera is still (VIEW_MAX_AGE_MS). The interior frame paints it as its background
// inside that rectangle (renderer.setGlassView) and the glass texels are CUT - the interior is drawn over the world
// with normal depth, so whatever hole the room has shows the street behind it. A picture uploaded `{ cutout: true }`
// has holes wherever its alpha is under a half, in every solid pass and in the shadows' too.
//
// Which interior texels are glass: an exterior window record drawn inside a building (DFU lays interiors out with the
// same window table - DaggerfallInterior.cs:473/:517/:1270 apply WindowStyle.Disabled to them), and a building
// interior's own texture whose record carries the palette's 0xff texels (world/interiorGlass.js). A context that is not
// ARENA2's declares its own glass with renderer.uploadGlassMask (white = glass) or with a cutout picture.
//
// Not a DFU member: the port's own presentation (Port-Doctrine, the renderer rebuilt on our stack).

import { getPref } from '../systems/uiPrefs.js';
import { isEnhanced } from '../systems/uiSkin.js';
import { pageParam } from '../systems/pageQuery.js';
import {
  ROOM_TEXELS_PER_M, ROOM_STYLES, ROOM_PIECES, ROOM_FABRICS, ROOM_LIT_SHARE, ROOM_CURTAIN_SHARE, ROOM_HEARTH_GLOW,
  roomColorTable,
} from '../world/windowRoomArt.js';

// ---------------------------------------------------------------------------------------------------------------
// THE SWITCH
// ---------------------------------------------------------------------------------------------------------------

/** THE SWITCH, ONE HOME (enhancedLighting.js enhancedLightingOn's shape): the enhanced skin, the Features row
 *  (systems/features.js 'real-windows', the pref `realWindows`: 'full' the rooms and the view out, 'rooms' the rooms
 *  alone - the view out is a second pass over the street, the costly half - 'off' the classic glass), and
 *  `?windows=off|rooms|full` - the kill door, which wins over the row. The classic skin is Daggerfall's glass. */
export function realWindowsMode(search = globalThis.location?.search ?? '') {
  if (!isEnhanced(search)) return 'off';
  const door = pageParam('windows', search);
  const v = door === 'full' || door === 'rooms' || door === 'off' ? door : getPref('realWindows');   // RW1 (AUDIT): a door it does not know (`?windows=0`, a typo) is no door - the row's word stands
  return v === 'rooms' || v === 'off' ? v : 'full';
}

// ---------------------------------------------------------------------------------------------------------------
// THE SUB-MESH'S MODE
// ---------------------------------------------------------------------------------------------------------------

/** What a sub-mesh's emission unit holds: nothing of glass, an exterior window's mask (DFU's table), or an interior's
 *  declared glass (renderer.uploadGlassMask). */
export const GLASS_NONE = 0;
export const GLASS_EXTERIOR = 1;
export const GLASS_INTERIOR = 2;

/** uWinMode: 0 plain, 1 a room behind the glass, 2 an interior's glass (no window style - it never glows), 3 an
 *  interior's glass cut to the view out. */
export const WIN_MODE = Object.freeze({ plain: 0, room: 1, glass: 2, cut: 3 });

/** THE LAW, per sub-mesh. `rooms`: this frame asked for rooms (an exterior frame); `cut`: this frame paints the view
 *  out (an interior frame). An exterior window is a room outdoors and glass to cut indoors; an interior's declared
 *  glass never wears a window style, cut or not. */
export function winModeFor(kind, rooms, cut) {
  if (kind === GLASS_INTERIOR) return cut ? WIN_MODE.cut : WIN_MODE.glass;
  if (kind === GLASS_EXTERIOR) return rooms ? WIN_MODE.room : cut ? WIN_MODE.cut : WIN_MODE.plain;
  return WIN_MODE.plain;
}

// ---------------------------------------------------------------------------------------------------------------
// THE ROOM'S BOX AND ITS LIGHT
// ---------------------------------------------------------------------------------------------------------------

/** The room behind one tile of window texture, in the tile's own units (u across, the height up, 0..1 the tile): two
 *  tiles wide and centred on its own, its floor a quarter tile under the tile's foot and its ceiling a tenth over the
 *  top - so a pane sees a room it stands in the middle of, not a cupboard the size of the glass. */
export const ROOM_BOX = Object.freeze({ x0: -0.5, x1: 1.5, y0: -0.25, y1: 1.1 });
/** The room's depth behind the wall: this much of its width, metres, held to [min, max]. */
export const ROOM_DEPTH_PER_WIDTH = 0.9;
export const ROOM_DEPTH_MIN = 2;
export const ROOM_DEPTH_MAX = 7;
/** Where a room fades back into the classic glass, metres from the eye - its texels a few pixels apiece by then. */
export const ROOM_FADE_NEAR = 70;
export const ROOM_FADE_FAR = 160;
/** The glass's own reflection over the room: its share head-on by day and by night, and how much more of it a grazing
 *  look takes (Schlick's fifth power). By day the room is dim behind the sky; a lit night room shows through. */
export const ROOM_REFLECT_DAY = 0.34;
export const ROOM_REFLECT_NIGHT = 0.14;
export const ROOM_FRESNEL = 0.55;
/** The light in a room: the day outside's share (of the scene's ambient), how much of it is lost toward the back wall,
 *  and a lit night room's lamp - its gain over the night style's own amber, near the glass and its fall to the back. */
export const ROOM_DAY_SHARE = 0.7;
export const ROOM_DAY_FALLOFF = 0.5;
export const ROOM_LAMP_GAIN = 1.35;
export const ROOM_LAMP_NEAR = 1.15;
export const ROOM_LAMP_FALLOFF = 0.45;
/** Curtains hang this far behind the glass (of the room's depth). */
export const ROOM_CURTAIN_Z = 0.05;

/** The room's depth, metres, for a tile `tileW` metres wide. */
export function roomDepth(tileW) {
  return Math.min(ROOM_DEPTH_MAX, Math.max(ROOM_DEPTH_MIN, ROOM_DEPTH_PER_WIDTH * (ROOM_BOX.x1 - ROOM_BOX.x0) * tileW));
}

/** THE MARCH, the shader's own (rwRoomOver): a ray from `o` (inside the box, z 0 - the glass) along `d` (u, height
 *  and depth per metre, d.z > 0) leaves the box through one face. Answers that face ('back', 'side', 'floor',
 *  'ceiling'), the distance and the point. */
export function roomExit(o, d, box = ROOM_BOX) {
  const tx = d[0] > 0 ? (box.x1 - o[0]) / d[0] : d[0] < 0 ? (box.x0 - o[0]) / d[0] : 1e9;
  const ty = d[1] > 0 ? (box.y1 - o[1]) / d[1] : d[1] < 0 ? (box.y0 - o[1]) / d[1] : 1e9;
  const tz = 1 / d[2];
  const t = Math.min(tz, tx, ty);
  const face = t === tz ? 'back' : t === tx ? 'side' : d[1] < 0 ? 'floor' : 'ceiling';
  return { face, t, h: [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t] };
}

/** The room's light from the frame's window style (renderer._windowEmission - windowEmissionRGB's answer) and its
 *  ambient: `on` while the glass wears a style at all (Disabled is black - an interior's, where no room is drawn),
 *  `night` when the style is the warm one (the night style's amber: red over blue; day, fog and custom are not),
 *  the lamp the night style's own hue lifted to a lamp, and the day light the ambient's share. */
export function roomLightFor(emission, ambient) {
  const e0 = emission?.[0] ?? 0, e1 = emission?.[1] ?? 0, e2 = emission?.[2] ?? 0;
  const on = e0 + e1 + e2 > 0;
  const night = on && e0 > e2 + 0.05;
  const peak = Math.max(e0, e1, e2) || 1;
  const k = night ? ROOM_LAMP_GAIN / peak : 0;
  return {
    on,
    night: night ? 1 : 0,
    lamp: [e0 * k, e1 * k, e2 * k],
    day: [(ambient?.[0] ?? 0) * ROOM_DAY_SHARE, (ambient?.[1] ?? 0) * ROOM_DAY_SHARE, (ambient?.[2] ?? 0) * ROOM_DAY_SHARE],
  };
}

// ---------------------------------------------------------------------------------------------------------------
// THE SHADER TEXT - interpolated INSIDE both mesh fragment shaders (the classic FS and EL_MESH_FS: a declaration is
// visible only to its own compilation unit), so both lanes draw the same rooms and cut the same glass
// ---------------------------------------------------------------------------------------------------------------

const g = (x) => {
  const s = Number(x).toFixed(5).replace(/0+$/, '');
  return s.endsWith('.') ? `${s}0` : s;
};
const v3 = (c) => `vec3(${g(c[0] / 255)}, ${g(c[1] / 255)}, ${g(c[2] / 255)})`;

/** The block: uniforms, the tables, the room. `decode` is the lane's colour decode of an sRGB constant (`c` the
 *  classic lane's, `elDecode(c)` the Enhanced Lighting lane's). Interpolated after the lane's codec. */
export function realWindowsGlsl(decode = 'c') {
  const cols = roomColorTable();
  const pats = ROOM_STYLES.map((s) => `vec4(${s.pattern.map(g).join(', ')})`);
  return `
// RW1: THE REAL WINDOWS (render/realWindows.js) - the room behind an exterior window, an interior's glass cut to the
// view out, and a cutout picture's holes
uniform float uWinMode;    // 0 plain, 1 a room behind the glass, 2 an interior's glass, 3 an interior's glass cut
uniform float uCutout;     // the bound picture is a cutout: a texel under half alpha is a hole
uniform vec4 uGlassRect;   // the view out's rect in window pixels (x0, y0, x1, y1): glass is cut only inside it
uniform vec4 uRoomLamp;    // rgb a lit room's lamp; a the night (the window style's own warmth)
uniform vec3 uRoomDay;     // the light a room takes from the day outside
uniform mat4 uModel;       // the room's seed reads the model's own frame (a floating origin moves the world, not it)
uniform vec4 uViewClipMin; // the view out's pass: the building the player stands in, a box no fragment of it draws in
uniform vec4 uViewClipMax; //   (w on; every other pass leaves it off)
vec3 rwDecode(vec3 c) { return ${decode}; }   // the lane's colour decode of an sRGB constant
const vec3 RW_COL[${cols.length}] = vec3[${cols.length}](${cols.map(v3).join(', ')});
const vec4 RW_PAT[${pats.length}] = vec4[${pats.length}](${pats.join(', ')});
const vec3 RW_FAB[${ROOM_FABRICS.length}] = vec3[${ROOM_FABRICS.length}](${ROOM_FABRICS.map(v3).join(', ')});
const float RW_NSTYLES = ${g(ROOM_STYLES.length)};
const float RW_NPIECES = ${g(ROOM_PIECES.length)};
const float RW_NFAB = ${g(ROOM_FABRICS.length)};
float rwHash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}
float rwBand(float x, float a, float b) { return step(a, x) * (1.0 - step(b, x)); }
float rwRect(vec2 p, vec4 r) { return rwBand(p.x, r.x, r.z) * rwBand(p.y, r.y, r.w); }
bool rwInRect(vec2 w) { return w.x >= uGlassRect.x && w.y >= uGlassRect.y && w.x < uGlassRect.z && w.y < uGlassRect.w; }
// a wall at p (metres along it, metres up it) of style s
vec3 rwWall(int s, vec2 p, float n) {
  vec4 pat = RW_PAT[s];
  int wp = int(pat.x + 0.5);
  vec3 c = RW_COL[s * 8];
  if (wp == 1) c = mod(floor(p.x / 0.2), 2.0) < 0.5 ? RW_COL[s * 8] : RW_COL[s * 8 + 1];
  else if (wp == 2) {
    float row = floor(p.y / 0.3);
    float bx = p.x / 0.6 + 0.5 * mod(row, 2.0);
    float mortar = max(step(fract(p.y / 0.3), 0.12), step(fract(bx), 0.06));
    c = mix(RW_COL[s * 8], RW_COL[s * 8 + 1], step(0.5, rwHash(vec3(floor(bx), row, 3.0)))) * (1.0 - 0.35 * mortar);
  } else if (wp == 3) c = RW_COL[s * 8] * (1.0 - 0.3 * step(fract(p.x / 0.2), 0.12));
  if (pat.z > 0.5 && p.y < 0.9) c = p.y > 0.82 ? min(RW_COL[s * 8 + 2] * 1.25, vec3(1.0)) : RW_COL[s * 8 + 2] * (1.0 - 0.25 * step(fract(p.x / 0.25), 0.12));
  if (p.y < 0.1) c = RW_COL[s * 8 + 7];
  return c * (0.9 + 0.1 * n);
}
// the piece against the back wall at p, its centre cx along the wall: rgb and how much of it covers the wall
vec4 rwPiece(int k, vec2 p, float cx, vec3 wood, vec3 fab, inout float glow) {
  float x = p.x - cx, y = p.y;
  if (k == 1) {   // a bed: its frame, its blanket, its headboard
    float bed = rwRect(vec2(x, y), vec4(-0.9, 0.0, 0.9, 0.55)) + rwRect(vec2(x, y), vec4(-0.9, 0.0, -0.75, 0.95));
    vec3 c = y > 0.38 && x > -0.75 ? fab : wood;
    return vec4(c, min(bed, 1.0));
  }
  if (k == 2) {   // a table and its two legs
    float top = rwRect(vec2(x, y), vec4(-0.6, 0.7, 0.6, 0.78));
    float legs = rwRect(vec2(abs(x), y), vec4(0.48, 0.0, 0.56, 0.7));
    return vec4(wood * (1.0 + 0.2 * top), min(top + legs, 1.0));
  }
  if (k == 3) {   // a shelf of things
    float frame = rwRect(vec2(x, y), vec4(-0.5, 0.2, 0.5, 1.9));
    float board = step(fract((y - 0.2) / 0.42), 0.12);
    float thing = rwHash(vec3(floor(x * 8.0), floor((y - 0.2) / 0.42), 7.0));
    vec3 c = board > 0.5 ? wood * 1.2 : (thing > 0.55 ? mix(fab, vec3(0.7, 0.62, 0.48), thing) : wood * 0.55);
    return vec4(c, frame);
  }
  if (k == 4) {   // a hearth: its stone, its dark mouth, and at night its fire
    float stone = rwRect(vec2(x, y), vec4(-0.7, 0.0, 0.7, 1.2));
    float mouth = rwRect(vec2(x, y), vec4(-0.42, 0.0, 0.42, 0.72));
    glow = mouth * (1.0 - smoothstep(0.0, 0.7, y)) * (0.6 + 0.4 * rwHash(vec3(floor(x * 12.0), floor(y * 12.0), 9.0)));
    return vec4(mouth > 0.5 ? vec3(0.06, 0.05, 0.04) : vec3(0.42, 0.40, 0.37) * (0.85 + 0.15 * step(0.5, fract(y / 0.2))), stone);
  }
  if (k == 5) {   // a painting in its frame
    float frame = rwRect(vec2(x, y), vec4(-0.42, 1.2, 0.42, 1.8));
    float canvas = rwRect(vec2(x, y), vec4(-0.34, 1.27, 0.34, 1.73));
    return vec4(canvas > 0.5 ? mix(fab, vec3(0.45, 0.55, 0.35), step(y, 1.45)) : vec3(0.55, 0.42, 0.18), frame);
  }
  if (k == 6) {   // a wardrobe
    float body = rwRect(vec2(x, y), vec4(-0.45, 0.0, 0.45, 1.9));
    return vec4(wood * (1.0 - 0.35 * step(abs(x), 0.02)), body);
  }
  return vec4(0.0);
}
// THE ROOM: the glass's own colour (base: the classic glass, its style on top), the mask's share at this texel, and the
// screen derivatives taken at the top of main. Returns what the texel shows.
vec3 rwRoomOver(vec3 base, float glass, vec3 dp1, vec3 dp2, vec2 duv1, vec2 duv2) {
  vec3 toFrag = vWorldPos - uCamPos;
  float dist = length(toFrag);
  float fade = 1.0 - smoothstep(${g(ROOM_FADE_NEAR)}, ${g(ROOM_FADE_FAR)}, dist);
  if (glass <= 0.0 || fade <= 0.0) return base;
  vec3 V = toFrag / max(dist, 1e-4);
  vec3 cr = cross(dp1, dp2);
  float crl = length(cr);
  if (crl < 1e-12) return base;
  vec3 N = cr / crl;
  if (dot(N, V) > 0.0) N = -N;                     // the face toward the eye: the room is behind it
  float nv = -dot(N, V);
  if (nv < 0.02 || abs(N.y) > 0.5) return base;     // grazing, or glass in a roof: no room
  // the wall's texture frame (the cotangent frame): uv per metre, in the wall's plane
  float det = dot(N, cr);
  vec3 p1 = cross(N, dp1), p2 = cross(dp2, N);
  vec3 gu = (p2 * duv1.x + p1 * duv2.x) / det;
  vec3 gv = (p2 * duv1.y + p1 * duv2.y) / det;
  float lu = length(gu), lv = length(gv);
  if (lu < 1e-4 || lv < 1e-4) return base;
  float tileW = 1.0 / lu, tileH = 1.0 / lv;
  float up = gv.y >= 0.0 ? 1.0 : -1.0;              // does v run up the wall, or down it?
  float roomW = ${g(ROOM_BOX.x1 - ROOM_BOX.x0)} * tileW, roomH = ${g(ROOM_BOX.y1 - ROOM_BOX.y0)} * tileH;
  float depth = clamp(${g(ROOM_DEPTH_PER_WIDTH)} * roomW, ${g(ROOM_DEPTH_MIN)}, ${g(ROOM_DEPTH_MAX)});
  vec2 f = fract(vUV);
  vec3 o = vec3(f.x, up > 0.0 ? f.y : 1.0 - f.y, 0.0);
  vec3 d = vec3(dot(gu, V), up * dot(gv, V), nv / depth);
  float tx = d.x > 0.0 ? (${g(ROOM_BOX.x1)} - o.x) / d.x : (d.x < 0.0 ? (${g(ROOM_BOX.x0)} - o.x) / d.x : 1e9);
  float ty = d.y > 0.0 ? (${g(ROOM_BOX.y1)} - o.y) / d.y : (d.y < 0.0 ? (${g(ROOM_BOX.y0)} - o.y) / d.y : 1e9);
  float tz = 1.0 / d.z;
  float t = min(tz, min(tx, ty));
  vec3 h = o + d * t;
  // the seeds: the glass's tile, its wall's plane in the model's own frame - a street's houses differ, a house keeps them
  vec3 vn = length(vNormal) > 1e-4 ? normalize(vNormal) : N;
  vec3 nq = floor(vn * 4.0 + 0.5);
  float plane = floor(dot(vn, vWorldPos - uModel[3].xyz) * 40.0 + 0.5);   // RW1 (AUDIT): rounded to the native a wall stands on - at half metres a wall at 0.25 m sat on the boundary and the floating origin flipped its seed
  vec2 tile = floor(vUV);
  float s0 = rwHash(vec3(tile.x + 17.0 * nq.x + 3.0 * nq.z, tile.y + 29.0 * nq.y, plane));
  float s1 = rwHash(vec3(plane * 0.731, tile.x * 1.7 + nq.z, tile.y + 5.0));
  float s2 = rwHash(vec3(tile.y * 3.1 + nq.x, plane * 0.37, tile.x + 11.0));
  int s = int(min(floor(s0 * RW_NSTYLES), RW_NSTYLES - 1.0));
  int piece = int(min(floor(s1 * RW_NPIECES), RW_NPIECES - 1.0));
  vec3 fab = RW_FAB[int(min(floor(fract(s1 * 7.0) * RW_NFAB), RW_NFAB - 1.0))];
  vec3 wood = RW_COL[s * 8 + 7];
  float glow = 0.0;
  float hz = h.z;
  vec3 albedo;
  const float TPM = ${g(ROOM_TEXELS_PER_M)};
  if (t == tz) {                                     // the back wall, and what stands against it
    vec2 p = (floor(vec2((h.x - ${g(ROOM_BOX.x0)}) * tileW, (h.y - ${g(ROOM_BOX.y0)}) * tileH) * TPM) + 0.5) / TPM;
    albedo = rwWall(s, p, rwHash(vec3(p * TPM, float(s))));
    vec4 pc = rwPiece(piece, p, (0.3 + 0.4 * fract(s0 * 9.0)) * roomW, wood, fab, glow);
    albedo = mix(albedo, pc.rgb, pc.a);
  } else if (t == tx) {                              // a side wall
    vec2 p = (floor(vec2(h.z * depth, (h.y - ${g(ROOM_BOX.y0)}) * tileH) * TPM) + 0.5) / TPM;
    albedo = rwWall(s, p, rwHash(vec3(p * TPM, float(s) + 0.5))) * 0.85;
  } else if (d.y < 0.0) {                            // the floor, and a rug on some
    vec2 p = (floor(vec2((h.x - ${g(ROOM_BOX.x0)}) * tileW, h.z * depth) * TPM) + 0.5) / TPM;
    int fp = int(RW_PAT[s].y + 0.5);
    float n = rwHash(vec3(p * TPM, float(s) + 1.5));
    if (fp == 1) {
      float m = max(step(fract(p.x / 0.5), 0.08), step(fract(p.y / 0.5), 0.08));
      albedo = mix(RW_COL[s * 8 + 3], RW_COL[s * 8 + 4], step(0.5, rwHash(vec3(floor(p / 0.5), 4.0)))) * (1.0 - 0.4 * m);
    } else if (fp == 2) albedo = mod(floor(p.x / 0.5) + floor(p.y / 0.5), 2.0) < 0.5 ? RW_COL[s * 8 + 3] : RW_COL[s * 8 + 4];
    else {
      float row = floor(p.y / 0.2);
      float seam = step(fract(p.y / 0.2), 0.1) + step(fract(p.x / 1.2 + 0.37 * row), 0.03);
      albedo = RW_COL[s * 8 + 3] * (1.0 - 0.3 * min(seam, 1.0));
    }
    albedo *= 0.9 + 0.1 * n;
    if (fract(s2 * 3.0) < 0.5) albedo = mix(albedo, fab * 0.8, rwRect(p, vec4(roomW * 0.3, depth * 0.25, roomW * 0.7, depth * 0.7)));
  } else {                                           // the ceiling, and its beams
    vec2 p = (floor(vec2((h.x - ${g(ROOM_BOX.x0)}) * tileW, h.z * depth) * TPM) + 0.5) / TPM;
    albedo = RW_COL[s * 8 + 5] * (0.9 + 0.1 * rwHash(vec3(p * TPM, float(s) + 2.5)));
    if (RW_PAT[s].w > 0.5 && fract(p.y / 0.9) < 0.2) albedo = RW_COL[s * 8 + 6];
  }
  // curtains, hung just behind the glass at the tile's sides
  if (fract(s2 * 13.0) < ${g(ROOM_CURTAIN_SHARE)}) {
    float tc = ${g(ROOM_CURTAIN_Z)} / d.z;
    vec2 pc = o.xy + d.xy * tc;
    float cl = 0.18 + 0.14 * fract(s2 * 7.0), crr = 0.82 - 0.14 * fract(s2 * 5.0);
    if (tc < t && (pc.x < cl || pc.x > crr) && pc.y > -0.1 && pc.y < 1.05) {
      albedo = fab * (0.72 + 0.28 * abs(sin(pc.x * 60.0)));
      hz = ${g(ROOM_CURTAIN_Z)};
      glow = 0.0;
    }
  }
  float night = uRoomLamp.a;
  float lit = night * step(s2, ${g(ROOM_LIT_SHARE)});
  vec3 light = uRoomDay * (1.0 - ${g(ROOM_DAY_FALLOFF)} * hz) + uRoomLamp.rgb * (lit * (${g(ROOM_LAMP_NEAR)} - ${g(ROOM_LAMP_FALLOFF)} * hz));
  vec3 room = rwDecode(albedo) * light + rwDecode(${v3(ROOM_HEARTH_GLOW)}) * (glow * night);
  float F = pow(max(1.0 - nv, 0.0), 5.0);   // RW1 (AUDIT): head on, nv rounds past 1 - pow of a negative is undefined
  float r0 = mix(${g(ROOM_REFLECT_DAY)}, ${g(ROOM_REFLECT_NIGHT)}, night);
  float R = r0 + (1.0 - r0) * ${g(ROOM_FRESNEL)} * F;
  return mix(base, mix(room, base, R), glass * fade);
}
`;
}

/** main()'s four lines, interpolated at the same places in both mesh shaders. DERIVS at the head of main (the
 *  derivatives in uniform control flow, before any discard); CUTOUT after the picture's texel; GLASS between the
 *  emission and the albedo it is subtracted from (an interior's glass wears no window style); ROOM once the lighting
 *  is summed and before the fog - `lit` carries the room, so the shader's own output line stands as it was. */
export const RW_MAIN_DERIVS = '  vec3 rwDp1 = dFdx(vWorldPos), rwDp2 = dFdy(vWorldPos); vec2 rwDuv1 = dFdx(vUV), rwDuv2 = dFdy(vUV);   // RW1: the room\'s frame, in uniform control flow\n'
  + '  if (uViewClipMax.w > 0.5 && all(greaterThan(vWorldPos, uViewClipMin.xyz)) && all(lessThan(vWorldPos, uViewClipMax.xyz))) discard;   // RW1: the view out leaves out the building it is seen from';
export const RW_MAIN_CUTOUT = '  if (uCutout > 0.5 && tex.a < 0.5) discard;   // RW1: a cutout picture\'s hole (every other picture keeps INCIDENT 2026-09-04\'s no-clip law)';
export const RW_MAIN_GLASS = '  float rwGlass = texture(uEmissionTex, vUV).r;   // RW1: the glass mask\n'
  + '  if (uWinMode > 2.5 && rwGlass > 0.5 && rwInRect(gl_FragCoord.xy)) discard;   // RW1: an interior\'s glass, cut to the view out\n'
  + '  emission *= step(uWinMode, 1.5);   // RW1: an interior\'s glass wears no window style';
export const RW_MAIN_ROOM = '  if (uWinMode > 0.5 && uWinMode < 1.5) lit = rwRoomOver(lit + emission, rwGlass, rwDp1, rwDp2, rwDuv1, rwDuv2) - emission;   // RW1: the room behind the glass';

// ---------------------------------------------------------------------------------------------------------------
// THE VIEW OUT
// ---------------------------------------------------------------------------------------------------------------

/** The view out is drawn at this share of the world's pixels, no side over the cap, in a texture sized up to the
 *  bucket (a pane that grows a pixel does not reallocate). */
export const VIEW_SCALE = 0.5;
/** RW1 (AUDIT): THE STREET'S AIR BY THE CLOCK - the fog colour the last street frame kept (`kept`, at the sun's scale it
 *  was kept at, `keptSun`), dimmed or brightened by the classic haze's day factor to the light the clock gives now
 *  (`nowSun`): an evening spent indoors looks out on a night sky, a night's sleep on a day's. Each channel 0..1. */
export function clockFogColor(kept, keptSun, nowSun) {
  const day = (s) => 0.1 + 0.9 * Math.min(1, Math.max(0, (Number.isFinite(s) ? s : 0) / 0.6));
  const k = day(nowSun) / day(keptSun);
  return Float32Array.from([0, 1, 2], (i) => Math.min(1, Math.max(0, (kept?.[i] ?? 0) * k)));
}
export const VIEW_MAX_SIDE = 1024;
export const VIEW_BUCKET = 64;
/** A still camera's view out is kept this long, then drawn again (the street's people and its clock move on). */
export const VIEW_MAX_AGE_MS = 250;
/** A camera moved by more than this, in any view-matrix element, draws the view again. */
export const VIEW_MOVE_EPS = 1e-4;
/** The glass's rectangle grows by this much (NDC) on every side - last frame's rectangle, this frame's camera. */
export const GLASS_RECT_MARGIN = 0.06;
/** Unwanted this long, the target is freed (EVERY ALLOCATION HAS AN OWNER). */
export const VIEW_RELEASE_MS = 10000;
/** The streamed world's rings the view out walks: the player's pixel and the eight round it (through a pane, a town's
 *  next street is the far distance - the fog and the sky take the rest). */
export const VIEW_RINGS = 1;
/** The box the view out leaves the player's own building out by grows this much past the building's model (metres):
 *  its trim and its sills stand a hand proud of the walls the box was measured on. */
export const VIEW_CLIP_PAD = 0.25;

/** A sphere (world centre, radius) through a view-projection, as an NDC rectangle that holds it: [x0, y0, x1, y1] held
 *  to the screen, the whole screen when it reaches the eye's plane, null when it is wholly off screen or behind the eye.
 *  Conservative - the numerator's and the depth's ranges taken apart. `out` reused. */
export function sphereNdcRect(pv, x, y, z, r, out = [0, 0, 0, 0]) {
  const cx = pv[0] * x + pv[4] * y + pv[8] * z + pv[12];
  const cy = pv[1] * x + pv[5] * y + pv[9] * z + pv[13];
  const w = pv[3] * x + pv[7] * y + pv[11] * z + pv[15];
  const sw = Math.hypot(pv[3], pv[7], pv[11]) * r;
  if (w + sw <= 0) return null;                                                          // behind the eye
  if (w - sw <= 1e-6) { out[0] = -1; out[1] = -1; out[2] = 1; out[3] = 1; return out; }  // through the eye's plane
  const sx = Math.hypot(pv[0], pv[4], pv[8]) * r, sy = Math.hypot(pv[1], pv[5], pv[9]) * r;
  const n = w - sw, f = w + sw;
  const x0 = Math.min((cx - sx) / n, (cx - sx) / f), x1 = Math.max((cx + sx) / n, (cx + sx) / f);
  const y0 = Math.min((cy - sy) / n, (cy - sy) / f), y1 = Math.max((cy + sy) / n, (cy + sy) / f);
  if (x0 >= 1 || x1 <= -1 || y0 >= 1 || y1 <= -1) return null;                          // wholly off screen
  out[0] = Math.max(-1, x0); out[1] = Math.max(-1, y0); out[2] = Math.min(1, x1); out[3] = Math.min(1, y1);
  return out;
}

/** The rectangle grown by the margin and held to the screen; null when nothing of it is left. */
export function padRect(rect, margin = GLASS_RECT_MARGIN) {
  if (!rect) return null;
  const x0 = Math.max(-1, rect[0] - margin), y0 = Math.max(-1, rect[1] - margin);
  const x1 = Math.min(1, rect[2] + margin), y1 = Math.min(1, rect[3] + margin);
  return x1 > x0 && y1 > y0 ? [x0, y0, x1, y1] : null;
}

/** The camera's projection cropped to an NDC rectangle: the rectangle becomes the whole of the new clip space, so the
 *  pass draws only what the glass can show, at the pixels the glass covers. Column-major, `out` reused. */
export function cropProjection(proj, rect, out = new Float32Array(16)) {
  const sx = 2 / (rect[2] - rect[0]), sy = 2 / (rect[3] - rect[1]);
  const tx = -(rect[2] + rect[0]) / (rect[2] - rect[0]), ty = -(rect[3] + rect[1]) / (rect[3] - rect[1]);
  for (let c = 0; c < 4; c++) {
    const x = proj[c * 4], y = proj[c * 4 + 1], w = proj[c * 4 + 3];
    out[c * 4] = sx * x + tx * w;
    out[c * 4 + 1] = sy * y + ty * w;
    out[c * 4 + 2] = proj[c * 4 + 2];
    out[c * 4 + 3] = w;
  }
  return out;
}

/** The view out's lens: the interior's own (the same x and y - a direction lands on the same NDC, so the crop and the
 *  background line up with the room's frame) with its depth taken out to the street's distance - the interior lens
 *  stops at 500 m, and the street's fog runs to 2400. */
export const VIEW_NEAR = 0.3;
export const VIEW_FAR = 2400;
export function viewOutProjection(proj, out = new Float32Array(16)) {
  out.set(proj);
  out[10] = (VIEW_FAR + VIEW_NEAR) / (VIEW_NEAR - VIEW_FAR);
  out[14] = (2 * VIEW_FAR * VIEW_NEAR) / (VIEW_NEAR - VIEW_FAR);
  return out;
}

/** The view out's pixels for a rectangle of a `vw` x `vh` world: drawn `w` x `h`, in a texture `allocW` x `allocH`. */
export function viewTargetSize(rect, vw, vh, scale = VIEW_SCALE) {
  const w = Math.max(8, Math.min(VIEW_MAX_SIDE, Math.round((rect[2] - rect[0]) / 2 * vw * scale)));
  const h = Math.max(8, Math.min(VIEW_MAX_SIDE, Math.round((rect[3] - rect[1]) / 2 * vh * scale)));
  const up = (n) => Math.min(VIEW_MAX_SIDE, Math.ceil(n / VIEW_BUCKET) * VIEW_BUCKET);
  return { w, h, allocW: up(w), allocH: up(h) };
}

/** Is the view out owed this frame? Never drawn, the rectangle moved, the camera moved, or the still picture aged. */
export function viewOutDue(state, view, rect, now) {
  if (!state.drawn) return true;
  for (let i = 0; i < 4; i++) if (state.rect[i] !== rect[i]) return true;
  for (let i = 0; i < 16; i++) if (Math.abs(state.view[i] - view[i]) > VIEW_MOVE_EPS) return true;
  return now - state.at >= VIEW_MAX_AGE_MS;
}

/** A building's view out, one per interior host (scenes/worldModes.js): what was drawn, when, and from where. */
export function createViewOut() {
  return { drawn: false, rect: [0, 0, 0, 0], view: new Float32Array(16), proj: new Float32Array(16), at: -Infinity, lastWanted: -Infinity };
}

/**
 * THE INTERIOR FRAME'S HALF, before its beginFrame: is there glass to look through (the rectangle the last frame's
 * glass and holes covered, renderer.takeGlassRect), is the street owed, and if so draw it (`draw` - the exterior
 * host's, inside renderer.outsideViewFrame). Answers what renderer.setGlassView takes after the beginFrame: null (no
 * glass on screen, or glass and no holes with the street off - the room draws as it always did), or the rectangle and
 * whether the street is in it (`view`: the glass is cut) or only the sky (a cutout's holes with the street off).
 */
export function viewOutFrame(state, { renderer, mode, proj, view, now, scene }) {
  const seen = renderer.takeGlassRect?.() ?? null;
  const rect = padRect(seen?.rect ?? null);
  const street = mode === 'full' && typeof scene?.draw === 'function';
  if (!rect || (!street && !seen.holes)) {
    if (state.drawn && now - state.lastWanted > VIEW_RELEASE_MS) { renderer.releaseOutsideView?.(); state.drawn = false; }
    return null;
  }
  state.lastWanted = now;
  if (!street) return { rect, view: false };
  if (viewOutDue(state, view, rect, now)) {
    const ok = renderer.outsideViewFrame?.(rect, viewOutProjection(proj, state.proj ??= new Float32Array(16)), view, scene);
    if (!ok) return { rect, view: false };
    state.drawn = true; state.at = now;
    state.rect[0] = rect[0]; state.rect[1] = rect[1]; state.rect[2] = rect[2]; state.rect[3] = rect[3];
    state.view.set(view);
  }
  return { rect, view: true };
}

/** The sky the view out stands under where it drew nothing (and the whole of a hole with the view off): the horizon
 *  is the fog's own colour (the classic distance haze the street fades into), the zenith a deeper blue of it. */
export function viewSkyFrom(fogColor) {
  const h = [fogColor?.[0] ?? 0.53, fogColor?.[1] ?? 0.7, fogColor?.[2] ?? 0.92];
  return { horizon: h, zenith: [h[0] * 0.72, h[1] * 0.82, Math.min(1, h[2] * 1.0)] };
}

/** The background: the view out over the glass's rectangle, the sky where it drew nothing. A strip of four from
 *  gl_VertexID - no vertex buffer. The texture is the view out's premultiplied picture (cleared to nothing). */
export const VIEW_BG_VS = `#version 300 es
uniform vec4 uRect;
out vec2 vT;
void main() {
  vec2 c = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1));
  vT = c;
  gl_Position = vec4(mix(uRect.xy, uRect.zw, c), 0.0, 1.0);
}`;
export const VIEW_BG_FS = `#version 300 es
precision highp float;
in vec2 vT;
uniform sampler2D uView;
uniform vec2 uViewScale;   // the drawn share of the texture
uniform float uHasView;    // 0: the sky alone
uniform vec4 uRect;
uniform vec3 uRayX;        // a world ray from NDC: ndc.x * uRayX + ndc.y * uRayY + uRayZ
uniform vec3 uRayY;
uniform vec3 uRayZ;
uniform vec3 uZenith;
uniform vec3 uHorizon;
out vec4 outColor;
void main() {
  vec2 ndc = mix(uRect.xy, uRect.zw, vT);
  vec3 d = normalize(ndc.x * uRayX + ndc.y * uRayY + uRayZ);
  vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 0.45, d.y));
  vec4 v = uHasView > 0.5 ? texture(uView, vT * uViewScale) : vec4(0.0);
  outColor = vec4(sky * (1.0 - v.a) + v.rgb, 1.0);
}`;

/** The background's ray from the camera: the rows of the view's rotation over the projection's two scales (a
 *  symmetric perspective, mirrored or not - mat4.js mirrorProjectionX negates the first scale, and the ray with it). */
export function viewRays(proj, view) {
  const p0 = proj[0] || 1, p5 = proj[5] || 1;
  return {
    x: [view[0] / p0, view[4] / p0, view[8] / p0],
    y: [view[1] / p5, view[5] / p5, view[9] / p5],
    z: [-view[2], -view[6], -view[10]],
  };
}
