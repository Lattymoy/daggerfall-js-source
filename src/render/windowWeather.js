// @ts-check
// WINDOW-WEATHER (2026-10-18, a player's request: inside the caravan and the buildings the windows show the street,
// but seeing the rain and the thunder through them would add a great deal to the immersion): THE WEATHER THROUGH THE
// GLASS - an add-on to the real windows (render/realWindows.js), wired beside them and changing nothing of theirs.
//
// WHAT THE VIEW OUT LEFT OUT. The view out draws the street through a building's glass (realWindows.js viewOutFrame,
// renderer.outsideViewFrame): its buildings, ground, water and standing flats, lit by the clock and the weather - a
// rainy noon is grey. But nothing FALLS in it, and no storm flashes: the rain program draws in the street frame alone,
// and the street frame sleeps while the player is indoors.
//
// THE RAIN, EVERY FRAME, IN THE ROOM'S OWN PASS - never in the view out. The view out is a second pass over the street,
// kept while the camera is still and drawn again every VIEW_MAX_AGE_MS (250 ms): rain drawn into it would fall at four
// frames a second, and drawing the street every frame to fix that would double the cost of standing at a window. So the
// street stays cached and the drops are drawn over it by the interior frame, after the room's own draws: the lab's
// rain program (render/precipitation.js LAB_WX_VS / LAB_WX_FS - the enhanced skin's own drops, byte for byte) with
// three lines added, under the far-plane trick the sky and the far ring use (farRing.js: depthRange(1, 1), LEQUAL,
// no depth write). Every fragment then lands at the far plane, so a drop draws only where nothing in the room wrote a
// depth - the glass texels the real windows cut, the street behind them. The lines added keep the drops honest:
//   - a drop inside the room's box (the interior collider's bounds, WW_ROOM_MARGIN past them) is discarded - it is
//     on the room's side of the glass. The interior's own walls are its box's faces (DFU's interior is laid out apart
//     from the house, and its glass is on its outer walls), so what is outside the box is outside the window;
//   - and a fragment outside the view out's rectangle is discarded (the rectangle the renderer cuts glass in -
//     renderer.setGlassView's own pixels), so a gap in a room's walls never rains.
// The volume round the eye is WW_BOX metres, not the street's LAB_BOX - through a pane the drops past the next house
// are a few pixels each - and the count is the street's DENSITY over it (wwDropCount), so a shower is the same shower
// on both sides of the glass. The fall's clock is re-origined as the street's is (precipitation.js RAIN-CLOCK).
// A SANDSTORM is the wisps' program in the sand's look (render/windWisps.js WISP_VS / WISP_FS, SAND_LOOK - WEATHER2d's
// own), with the same three lines added and drawn the same way, at the street's sand density over the same volume.
//
// WHAT FALLS: the street's word and level as the outdoor frame last wrote them (systems/weather/weatherSim.js
// fallingWeather - WET-FALL's one truth, the ear's and the skin's), mapped by the world's own law
// (world/weather.js precipitationForWeather). Indoors the front does not tick (DISC9), so the shower stands as the
// player left it, as the rain the player hears through the walls does. The wind does not tick either: its stand-in is
// the weather map's own field read at the room (systems/weather/weatherMap.js windAt) and held, at WW_WIND's speed for
// what falls - no clock is read (TIME1: the drawn weather walks the event clock, and indoors nothing of it walks).
//
// THE STORM. A thunder word runs DFU's own lightning schedule (world/weather.js LightningPlayer - AmbientEffectsPlayer's
// waits and flash runs) on an instance of this module's, ticked once a frame before the room is lit (`light`). On a lit
// frame the room takes the flash through its window - the renderer's own lightning channel (renderer.setFlashLight,
// Dynamic Skies' LightningFlash seam, composed after the room's lamps are stored), a cold light standing just inside
// the glass the player last looked through (a ray from the eye through the view out's rectangle to the room's
// collider, WW_FLASH_INSET short of the wall) - and the panes flash a cold white (an additive strip over the view
// out's rectangle, the same far-plane trick: only the glass takes it). DS1's own flash stands 20-40 m over the player
// with a range of 500-1000: indoors that is through the roof, so the light is the window's instead.
// The thunder's SOUND stays an outdoor thing (systems/ambientEffects.js DISC6) - this add-on draws, it does not play.
//
// THE SWITCH: the real windows' own - Full (the view out) on the enhanced skin (realWindowsMode); Rooms only and Off
// cut no glass, so there is nothing to see weather through. `?windowweather=off` is this add-on's own kill door.
//
// Not a DFU member: DFU draws no street through an interior's glass (DaggerfallInterior.cs:473 lays it out under
// WindowStyle.Disabled), so it shows no weather there either. The port's own presentation (Port-Doctrine).

import { buildProgram } from './glProgram.js';
import { LAB_WX_VS, LAB_WX_FS, LAB_BOX, LAB_COUNTS, LAB_FALL, PRECIP_REST_S, PRECIP_CLOCK_MAX_S } from './precipitation.js';
import { realWindowsMode, VIEW_BG_VS, VIEW_RELEASE_MS } from './realWindows.js';
import { WISP_VS, WISP_FS, SAND_LOOK, WISP_GUST_DIV, wispCount, wispClock } from './windWisps.js';
import { LightningPlayer, precipitationForWeather } from '../world/weather.js';
import { fallingWeather } from '../systems/weather/weatherSim.js';
import { windAt } from '../systems/weather/weatherMap.js';
import { WIND_STEP_DT_MAX } from '../systems/wind/windDrive.js';
import { pageParam } from '../systems/pageQuery.js';
import { multiply } from '../world/mat4.js';
import { invert4 } from '../player/tapRay.js';

// ---------------------------------------------------------------------------------------------------------------
// THE NUMBERS
// ---------------------------------------------------------------------------------------------------------------

/** The rain's volume round the eye indoors, metres - a pane shows the street to the next house; past this a drop is a
 *  few pixels. The street's is LAB_BOX (42). */
export const WW_BOX = 24;
/** The sand's volume: its streaks are a metre or two long and read from further than a drop - at the drops' 24 m the
 *  storm stopped twelve metres out and a pane held a streak or two. Twice the drops' (the scatter is cut for both from
 *  one buffer: a seed in [0, 48) taken mod 24 is still even over [0, 24)). The street's is SAND_LOOK.box (70). */
export const WW_SAND_BOX = 48;
/** A drop this far past the room's box is still the room's (a wall's thickness, a window's frame). */
export const WW_ROOM_MARGIN = 0.35;
/** The room's box is read again this often (a door that swings moves the collider's bounds). */
export const WW_ROOM_REFRESH_MS = 1000;
/** The wind's stand-in, metres a second down the weather map's wind at full share, by what falls - and the least share
 *  of it (a calm reading still leans the rain a little). */
export const WW_WIND = Object.freeze({ rain: 2.5, storm: 6, snow: 1.5, sand: 6 });
export const WW_WIND_FLOOR = 0.35;
/** A lit frame of the storm: the panes' cold white (added over the street), and the light through the window - its
 *  colour x intensity, its range, how far short of the glass it stands, how far the ray to the glass may reach, and how
 *  often the glass is found again while the storm is on. */
export const WW_FLASH_GLASS = Object.freeze([0.42, 0.46, 0.56]);
export const WW_FLASH_COLOR = Object.freeze([0.75, 0.82, 1.05]);
export const WW_FLASH_RANGE = 10;
export const WW_FLASH_INSET = 1.2;
export const WW_FLASH_REACH = 40;
export const WW_FLASH_FIND_MS = 250;
/** Unused this long, the add-on's programs and buffers are freed (the view out's own wait). */
export const WW_RELEASE_MS = VIEW_RELEASE_MS;
/** DFU's schedule's seed for this module's instance (world.js seeds the street's from `?wseed`, else 1). */
export const WW_LIGHTNING_SEED = 1;

// ---------------------------------------------------------------------------------------------------------------
// THE LAWS (pure)
// ---------------------------------------------------------------------------------------------------------------

/** The add-on's switch: the real windows at Full (the street cut into the glass) and no `?windowweather=off`. */
export function windowWeatherOn(search = globalThis.location?.search ?? '') {
  return realWindowsMode(search) === 'full' && pageParam('windowweather', search) !== 'off';
}

/** The drops for a volume of side `box`: the street's count at this level (precipitation.js drawLab's own scaling,
 *  LAB_COUNTS x the level) times the share of the street's volume this one is - one density on both sides of the
 *  glass. */
export function wwDropCount(mode, level, box = WW_BOX) {
  const full = (LAB_COUNTS[mode] ?? LAB_COUNTS.rain) * Math.min(1, Math.max(0, Number(level) || 0));
  return Math.round(full * (box / LAB_BOX) ** 3);
}

/** The sand's streaks for a volume of side `box`: the street's sandstorm (windWisps.js wispCount at this level, the
 *  sand's look) times the share of its volume this one is. */
export function wwSandCount(level, box = WW_SAND_BOX) {
  return Math.round(wispCount(Math.min(1, Math.max(0, Number(level) || 0)), /** @type {any} */ (SAND_LOOK)) * (box / SAND_LOOK.box) ** 3);
}

/** What falls past the glass for the street's word and level - the program (the lab's drops, or the wisps' sand), the
 *  lab's kind (0 a drop, 1 a flake), its fall speed and the count - or null: nothing falls. */
export function wwFall(word, level) {
  const mode = precipitationForWeather(word);
  if (!mode) return null;
  if (mode === 'sand') {
    const n = wwSandCount(level);
    return n > 0 ? { mode, sand: true, kind: 0, fall: 0, count: n } : null;
  }
  const count = wwDropCount(mode, level);
  if (count <= 0) return null;
  return { mode, sand: false, kind: mode === 'snow' ? 1 : 0, fall: LAB_FALL[mode] ?? LAB_FALL.rain, count };
}

/** The wind's stand-in for what falls: the weather map's wind at (x, z), held (its minute 0 - the street's front and
 *  gust do not tick indoors), as [vx, vz] metres a second. */
export function wwWind(mode, x, z, minutes = 0, out = [0, 0]) {
  const w = windAt(x, z, minutes);
  const mag = Math.hypot(w[0], w[1]);
  const speed = (WW_WIND[mode] ?? WW_WIND.rain) * Math.max(WW_WIND_FLOOR, Math.min(1, mag));
  out[0] = mag > 1e-6 ? (w[0] / mag) * speed : speed;
  out[1] = mag > 1e-6 ? (w[1] / mag) * speed : 0;
  return out;
}

/** The room's box from the collider's bounds (player/collider.js bounds), grown by the margin; null for none. */
export function wwRoomBox(bounds, margin = WW_ROOM_MARGIN) {
  if (!bounds?.min || !bounds?.max) return null;
  return {
    min: [bounds.min[0] - margin, bounds.min[1] - margin, bounds.min[2] - margin],
    max: [bounds.max[0] + margin, bounds.max[1] + margin, bounds.max[2] + margin],
  };
}

/** The view out's rectangle (NDC) in the world pass's pixels - renderer.setGlassView's own arithmetic, the space the
 *  glass is cut in. */
export function wwGlassRectPx(rect, vp, out = [0, 0, 0, 0]) {
  out[0] = vp[0] + (rect[0] + 1) / 2 * vp[2]; out[1] = vp[1] + (rect[1] + 1) / 2 * vp[3];
  out[2] = vp[0] + (rect[2] + 1) / 2 * vp[2]; out[3] = vp[1] + (rect[3] + 1) / 2 * vp[3];
  return out;
}

/** Where the storm's light stands: a ray from the eye through the middle of the view out's rectangle (NDC) under the
 *  frame's view-projection, to the room's collider (player/collider.js raycast), WW_FLASH_INSET short of what it meets
 *  - just inside the window. Null when the ray meets nothing within WW_FLASH_REACH. */
export function wwFlashAnchor(rect, pv, eye, collider, out = [0, 0, 0]) {
  const inv = invert4(pv);
  if (!inv || !collider?.raycast) return null;
  const cx = (rect[0] + rect[2]) / 2, cy = (rect[1] + rect[3]) / 2;
  const un = (z) => {
    const x = inv[0] * cx + inv[4] * cy + inv[8] * z + inv[12], y = inv[1] * cx + inv[5] * cy + inv[9] * z + inv[13];
    const zz = inv[2] * cx + inv[6] * cy + inv[10] * z + inv[14], w = inv[3] * cx + inv[7] * cy + inv[11] * z + inv[15];
    return [x / w, y / w, zz / w];
  };
  const a = un(-1), b = un(1);
  let d0 = b[0] - a[0], d1 = b[1] - a[1], d2 = b[2] - a[2];
  const len = Math.hypot(d0, d1, d2);
  if (!(len > 0)) return null;
  d0 /= len; d1 /= len; d2 /= len;
  const hit = collider.raycast([eye[0], eye[1], eye[2]], [d0, d1, d2], WW_FLASH_REACH);
  if (!Number.isFinite(hit)) return null;
  const t = Math.max(0, hit - WW_FLASH_INSET);
  out[0] = eye[0] + d0 * t; out[1] = eye[1] + d1 * t; out[2] = eye[2] + d2 * t;
  return out;
}

/** RAIN-CLOCK, this module's own (precipitation.js clock): the seconds the fall's program is handed, re-origined - and
 *  the wind's travel zeroed - on the first draw, after a rest off the screen, on a clock that ran backwards, and at the
 *  hour. */
export function wwClock(state, seconds) {
  if (state.t0 === null || seconds < state.last || seconds - state.last > PRECIP_REST_S || seconds - state.t0 >= PRECIP_CLOCK_MAX_S) {
    state.t0 = seconds;
    state.windOff[0] = 0; state.windOff[1] = 0;
  }
  state.last = seconds;
  return seconds - state.t0;
}

// ---------------------------------------------------------------------------------------------------------------
// THE SHADERS - the lab's, with the room and the rectangle kept out
// ---------------------------------------------------------------------------------------------------------------

/** The program text this module adds to - the lab's drops and the wisps' sand - each needle found once or the build
 *  throws (a program that moved under it is said, never drawn half-patched). */
export const WW_SAND_NEEDLES = Object.freeze({
  vsOut: 'out float vT; out float vLife;',
  vsPos: 'gl_Position = uVP * vec4(p, 1.0);',
  fsIn: 'in float vT; in float vLife;',
  fsMain: 'void main(){',
});
export const WW_NEEDLES = Object.freeze({
  vsOut: 'out float vT; out float vSeed;',
  vsPos: 'gl_Position = uVP * vec4(p, 1.0);',
  fsIn: 'in float vT; in float vSeed;',
  fsMain: 'void main(){',
});

function patch(src, needle, add, where) {   // `where` names the stage and its home
  const at = src.indexOf(needle);
  if (at < 0 || src.indexOf(needle, at + needle.length) >= 0) {
    throw new Error(`[window weather] the ${where} changed - "${needle}" is not there once`);
  }
  return src.slice(0, at) + add(needle) + src.slice(at + needle.length);
}

/** A program's two stages, the room kept out: the vertex stage hands its world point on; the fragment stage discards
 *  a mark inside the room's box and a fragment outside the view out's rectangle, then colours it as its own program
 *  does. The lab's drops by default; the wisps' sand with WISP_VS, WISP_FS and WW_SAND_NEEDLES.
 * @param {string} [vs] @param {string} [fs]
 * @param {{ vsOut: string, vsPos: string, fsIn: string, fsMain: string }} [needles] */
export function windowWeatherShaders(vs = LAB_WX_VS, fs = LAB_WX_FS, needles = WW_NEEDLES) {
  const N = needles;
  let v = patch(vs, N.vsOut, (n) => `${n}\nout vec3 vWorld;   // WINDOW-WEATHER: the drop's world point`, 'vertex stage');
  v = patch(v, N.vsPos, (n) => `vWorld = p;\n  ${n}`, 'vertex stage');
  let f = patch(fs, N.fsIn, (n) => `${n}\nin vec3 vWorld;\nuniform vec3 uRoomMin, uRoomMax;   // WINDOW-WEATHER: the room's box\nuniform vec4 uGlassRect;           // and the view out's rectangle, in the world pass's pixels`, 'fragment stage');
  f = patch(f, N.fsMain, (n) => `${n}\n  if (all(greaterThan(vWorld, uRoomMin)) && all(lessThan(vWorld, uRoomMax))) discard;   // the room's side of the glass\n  if (gl_FragCoord.x < uGlassRect.x || gl_FragCoord.y < uGlassRect.y || gl_FragCoord.x >= uGlassRect.z || gl_FragCoord.y >= uGlassRect.w) discard;`, 'fragment stage');
  return { vs: v, fs: f };
}

/** The storm's flash on the panes: the view out's background strip (realWindows.js VIEW_BG_VS), one colour, added. */
export const WW_FLASH_FS = `#version 300 es
precision mediump float;
uniform vec3 uFlash;
out vec4 o;
void main() { o = vec4(uFlash, 1.0); }`;

// ---------------------------------------------------------------------------------------------------------------
// THE ADD-ON
// ---------------------------------------------------------------------------------------------------------------

const DROP_UNIFORMS = ['uVP', 'uEye', 'uRight', 'uUp', 'uTime', 'uKind', 'uBox', 'uFall', 'uWindV', 'uWindOff', 'uRoomMin', 'uRoomMax', 'uGlassRect'];
const SAND_UNIFORMS = ['uVP', 'uEye', 'uTime', 'uBox', 'uStrength', 'uWindV', 'uWindOff', 'uLen', 'uColor', 'uAlpha', 'uRoomMin', 'uRoomMax', 'uGlassRect'];

/**
 * The weather through a building's glass, for one renderer. Two calls an interior frame (scenes/worldModes.js):
 * `light({ dt })` once the room's lamps are stored (the storm's schedule ticked, its flash composed into them), and
 * `frame(...)` after the room's own draws (the drops and the panes' flash). `release()` frees what it built - a
 * building without weather does so itself after WW_RELEASE_MS.
 * @param {{ renderer: any, on?: () => boolean, falling?: () => { word: string, level: number } }} deps
 */
export function createWindowWeather({ renderer, on = () => windowWeatherOn(), falling = () => fallingWeather() }) {
  const gl = renderer.gl;
  /** @type {any} */
  let res = null;   // the programs and buffers, built on the first drop drawn
  let usedAt = -Infinity;
  const clockState = { t0: /** @type {number|null} */ (null), last: 0, windOff: [0, 0] };
  const sandOff = [0, 0];   // the sand's travel, kept inside WW_BOX x WISP_GUST_DIV (windWisps.js advance's wrap)
  const windV = [0, 0];
  const room = { collider: /** @type {any} */ (null), box: /** @type {any} */ (null), at: -Infinity };
  const lightning = new LightningPlayer(WW_LIGHTNING_SEED);
  let flash = false;
  /** The storm's light, one record (its identity kept - render/lightId.js names it once), where the window was last
   *  found in this room. */
  const flashLight = { x: 0, y: 0, z: 0, range: WW_FLASH_RANGE, color: [...WW_FLASH_COLOR] };
  const anchor = { room: /** @type {any} */ (null), at: -Infinity, ok: false, p: [0, 0, 0] };
  const pv = new Float32Array(16), rectPx = [0, 0, 0, 0], right = new Float32Array(3), eye3 = new Float32Array(3);

  const build = () => {
    const sh = windowWeatherShaders();
    const drop = buildProgram(gl, sh.vs, sh.fs);
    const u = {};
    for (const n of DROP_UNIFORMS) u[n] = gl.getUniformLocation(drop, n);
    const max = Math.max(wwDropCount('rain', 1), wwSandCount(1));
    const inst = new Float32Array(max * 4);
    let s = 0x85ebca6b;   // the scatter's own xorshift (the lab's law, precipitation.js _buildLab, on a seed of its own)
    const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    for (let i = 0; i < max; i++) { inst[i * 4] = rnd() * WW_SAND_BOX; inst[i * 4 + 1] = rnd() * WW_SAND_BOX; inst[i * 4 + 2] = rnd() * WW_SAND_BOX; inst[i * 4 + 3] = rnd(); }
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ib); gl.bufferData(gl.ARRAY_BUFFER, inst, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 16, 0); gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(null);
    const ssh = windowWeatherShaders(WISP_VS, WISP_FS, WW_SAND_NEEDLES);
    const sand = buildProgram(gl, ssh.vs, ssh.fs);
    const su = {};
    for (const n of SAND_UNIFORMS) su[n] = gl.getUniformLocation(sand, n);
    const fp = buildProgram(gl, VIEW_BG_VS, WW_FLASH_FS);
    const empty = gl.createVertexArray();
    return { drop, u, sand, su, vao, qb, ib, max, flash: fp, fRect: gl.getUniformLocation(fp, 'uRect'), fColor: gl.getUniformLocation(fp, 'uFlash'), empty };
  };

  /** EVERY ALLOCATION HAS AN OWNER: this instance, one a renderer (windowWeatherFor) - a building without weather frees
   *  them after WW_RELEASE_MS, and `release` at once. */
  const release = () => {
    room.collider = null; room.box = null;
    anchor.room = null; anchor.ok = false;
    flash = false;
    if (!res) return;
    const r = res;
    res = null;
    gl.deleteProgram(r.drop); gl.deleteProgram(r.sand); gl.deleteProgram(r.flash);
    gl.deleteVertexArray(r.vao); gl.deleteVertexArray(r.empty);
    gl.deleteBuffer(r.qb); gl.deleteBuffer(r.ib);
  };

  const roomBoxOf = (collider, now) => {
    if (!collider) return null;
    if (collider !== room.collider || now - room.at >= WW_ROOM_REFRESH_MS) {
      room.collider = collider; room.at = now;
      room.box = wwRoomBox(collider.bounds?.() ?? null);
    }
    return room.box;
  };

  /**
   * Once the room's lamps are stored (renderer.setPointLights), before its beginFrame: the storm's schedule ticks, and a
   * lit frame composes the window's light into the lamps (renderer.setFlashLight - first, under the same cap).
   * @param {{ dt: number }} f
   */
  const light = ({ dt }) => {
    const storm = on() && falling()?.word === 'thunder';
    flash = storm ? lightning.tick(Math.max(0, dt || 0)) > 1 : false;
    if (!flash || !anchor.ok) return;
    flashLight.x = anchor.p[0]; flashLight.y = anchor.p[1]; flashLight.z = anchor.p[2];
    renderer.setFlashLight?.(flashLight);
  };

  /**
   * After the room's own draws: what falls past the glass and the storm's flash on it - and, in a storm, the window
   * found again for the next lit frame's light.
   * @param {{ glass: { rect: number[], view: boolean } | null, proj: Float32Array, view: Float32Array, eye: ArrayLike<number>, dt: number, now: number, collider: any }} f
   */
  const frame = ({ glass, proj, view, eye, dt, now, collider }) => {
    if (!on()) { flash = false; if (res && now - usedAt > WW_RELEASE_MS) release(); return; }
    const fell = falling();
    const fall = wwFall(fell?.word, fell?.level);
    const box = roomBoxOf(collider, now);
    if (anchor.room !== collider) { anchor.room = collider; anchor.ok = false; anchor.at = -Infinity; }
    const seen = !!(glass?.view && glass.rect);
    if (seen) multiply(proj, view, pv);
    if (seen && fell?.word === 'thunder' && now - anchor.at >= WW_FLASH_FIND_MS) {
      anchor.at = now;
      if (wwFlashAnchor(glass.rect, pv, eye, collider, anchor.p)) anchor.ok = true;
    }
    if (!seen || !box || (!fall && !flash)) { if (res && now - usedAt > WW_RELEASE_MS) release(); return; }
    usedAt = now;
    if (!res) res = build();
    const vp = renderer.worldViewportPx ?? [0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight];
    wwGlassRectPx(glass.rect, vp, rectPx);
    // the far-plane trick (farRing.js): every fragment at the far plane, tested LEQUAL - only where the room wrote no depth
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false); gl.depthRange(1, 1);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    if (fall) {
      wwWind(fall.mode, (box.min[0] + box.max[0]) / 2, (box.min[2] + box.max[2]) / 2, 0, windV);
      const ds = Math.min(WIND_STEP_DT_MAX, Math.max(0, dt || 0));
      eye3[0] = eye[0]; eye3[1] = eye[1]; eye3[2] = eye[2];
      if (fall.sand) {
        // the sand: the wisps' own uniforms in the sand's look (windWisps.js draw), its travel wrapped as theirs is
        const period = WW_SAND_BOX * WISP_GUST_DIV;
        for (let i = 0; i < 2; i++) { const v = sandOff[i] + windV[i] * ds; sandOff[i] = ((v % period) + period) % period; }
        const u = res.su;
        gl.useProgram(res.sand);
        gl.uniformMatrix4fv(u.uVP, false, pv);
        gl.uniform3fv(u.uEye, eye3);
        gl.uniform1f(u.uTime, wispClock(now / 1000));
        gl.uniform1f(u.uBox, WW_SAND_BOX);
        gl.uniform1f(u.uStrength, Math.min(1, Math.max(0, fell?.level ?? 0)));
        gl.uniform2f(u.uLen, SAND_LOOK.len[0], SAND_LOOK.len[1]);
        gl.uniform3f(u.uColor, SAND_LOOK.color[0], SAND_LOOK.color[1], SAND_LOOK.color[2]);
        gl.uniform2f(u.uAlpha, SAND_LOOK.alpha[0], SAND_LOOK.alpha[1]);
        gl.uniform2f(u.uWindV, windV[0], windV[1]);
        gl.uniform2f(u.uWindOff, sandOff[0], sandOff[1]);
        gl.uniform3f(u.uRoomMin, box.min[0], box.min[1], box.min[2]);
        gl.uniform3f(u.uRoomMax, box.max[0], box.max[1], box.max[2]);
        gl.uniform4f(u.uGlassRect, rectPx[0], rectPx[1], rectPx[2], rectPx[3]);
      } else {
        const t = wwClock(clockState, now / 1000);
        clockState.windOff[0] += windV[0] * ds; clockState.windOff[1] += windV[1] * ds;
        right[0] = view[0]; right[1] = view[4]; right[2] = view[8];
        const u = res.u;
        gl.useProgram(res.drop);
        gl.uniformMatrix4fv(u.uVP, false, pv);
        gl.uniform3fv(u.uEye, eye3);
        gl.uniform3fv(u.uRight, right);
        gl.uniform3f(u.uUp, 0, 1, 0);
        gl.uniform1f(u.uTime, t);
        gl.uniform1f(u.uKind, fall.kind);
        gl.uniform1f(u.uBox, WW_BOX);
        gl.uniform1f(u.uFall, fall.fall);
        gl.uniform2f(u.uWindV, windV[0], windV[1]);
        gl.uniform2f(u.uWindOff, clockState.windOff[0], clockState.windOff[1]);
        gl.uniform3f(u.uRoomMin, box.min[0], box.min[1], box.min[2]);
        gl.uniform3f(u.uRoomMax, box.max[0], box.max[1], box.max[2]);
        gl.uniform4f(u.uGlassRect, rectPx[0], rectPx[1], rectPx[2], rectPx[3]);
      }
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);   // the drops' and the wisps' own blend (precipitation.js drawLab, windWisps.js draw)
      gl.bindVertexArray(res.vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, Math.min(fall.count, res.max));
    }
    if (flash) {
      gl.useProgram(res.flash);
      gl.uniform4f(res.fRect, glass.rect[0], glass.rect[1], glass.rect[2], glass.rect[3]);
      gl.uniform3f(res.fColor, WW_FLASH_GLASS[0], WW_FLASH_GLASS[1], WW_FLASH_GLASS[2]);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.bindVertexArray(res.empty);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.bindVertexArray(null);
    gl.depthRange(0, 1); gl.depthFunc(gl.LESS); gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    if (renderer.stats) renderer.stats.draws += (fall ? 1 : 0) + (flash ? 1 : 0);
    renderer.markForeignPass?.();   // the renderer's bookkeeping told: a program, a VAO and the blend were ours
  };

  return { light, frame, release, get flashing() { return flash; }, get built() { return !!res; }, get window() { return anchor.ok ? [...anchor.p] : null; } };
}

/** ONE A RENDERER (horseRigFor's shape): the interior host asks for it where it lights and where it draws, and the
 *  first ask builds it - no state of the host's own. */
const _byRenderer = new WeakMap();
export function windowWeatherFor(renderer) {
  let ww = _byRenderer.get(renderer);
  if (!ww) { ww = createWindowWeather({ renderer }); _byRenderer.set(renderer, ww); }
  return ww;
}
