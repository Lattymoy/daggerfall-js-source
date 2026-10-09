// @ts-check
// SD-LOOK (2026-10-08, the Abyss Dungeon's look; bible/11-Multiplayer/Super-Dungeons-Look.md "The visual language"): THE
// HOUR'S LOOK IN ONE PLACE - its palette ramps, its five lights and what each means, the escapement every hand ticks on,
// and the hand that runs a countdown to twelve. Four rules: the void is black; metal and stone are structure and do not
// glow; light appears only where it means something; every surface reads as Daggerfall pixel art.
//
// Pure, and a leaf: the lights are the values of their homes (pinned equal by test/sd25_look.test.js - their homes keep
// them, nothing is re-pointed), copied here so a picture painter in world/ never imports a scene or a GL module.
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).

/** THE RAMPS (sRGB 0-255, dark to light) - every material at least five steps, so modern light does not flatten it. */
export const SD_RAMP = Object.freeze({
  /** The sky, the deep, the furnace at the nadir - nothing darker than its first step, so a cheap panel never crushes it. */
  void: Object.freeze([[5, 4, 3], [12, 9, 6], [24, 17, 10], [51, 38, 18], [92, 60, 24]]),
  /** Island rock, flags, the stones' shafts, pillars (its middle step world/sdRealmArt.js SD_STONE). */
  basalt: Object.freeze([[14, 12, 12], [22, 20, 19], [34, 30, 28], [50, 45, 41], [70, 63, 56]]),
  /** The Bay's street the Hollow swallowed - the Threshold alone. */
  cobble: Object.freeze([[30, 27, 25], [52, 48, 44], [74, 68, 60], [98, 90, 78], [124, 114, 98]]),
  /** The works: rims, inlay, the Rift, the Remnant (its body step SD_BRASS, its bright SD_BRASS_BRIGHT). */
  brass: Object.freeze([[48, 30, 12], [88, 58, 22], [140, 98, 40], [196, 146, 64], [228, 184, 100], [246, 206, 120]]),
  /** Only in brass recesses and seams. */
  verdigris: Object.freeze([[22, 34, 28], [36, 56, 46], [58, 88, 70], [88, 124, 98], [120, 156, 128]]),
  /** The arena's plates. */
  bronze: Object.freeze([[24, 17, 10], [40, 28, 16], [62, 44, 24], [86, 62, 34], [112, 84, 48]]),
  /** The Return's bands, the Silver Echo. */
  silver: Object.freeze([[40, 42, 46], [64, 68, 74], [106, 112, 120], [160, 166, 176], [214, 220, 228]]),
  /** The Return's arch. */
  pale: Object.freeze([[78, 75, 70], [100, 96, 90], [120, 116, 108], [150, 146, 138], [182, 178, 170]]),
  /** The earth between a torn street and the stone under it, its roots. */
  earth: Object.freeze([[18, 12, 8], [32, 22, 14], [50, 36, 22], [70, 52, 32], [92, 70, 44]]),
  /** Only inside the windows home - the only blue in the Hour: day, then dusk, then night. */
  baySky: Object.freeze([[14, 20, 44], [90, 60, 110], [210, 120, 60], [92, 140, 210], [150, 190, 235]]),
});

/** THE FIVE LIGHTS (linear rgb, as the renderer takes them), and the moment. Each means one thing, and nothing else is lit:
 *  GOLD the machine is live (on what you stand on, it holds); MANTELLA the Hour's soul, what the fight turns on; EMBER
 *  about to fail; MOON the way out, and only the way out; RED refused, or the End; MOMENT a beat lands. Their homes:
 *  world/sdRealm.js SD_LAMP_COLOR, scenes/sdFx.js SD_FX_COLOR (mantella, pale, end), world/sdHallArt.js SD_GLOW_COLORS.fray
 *  (sRGB there), render/sdBeam.js SD_BEAM_CORE. */
export const SD_LIGHT = Object.freeze({
  gold: Object.freeze([1.0, 0.78, 0.4]),
  mantella: Object.freeze([0.45, 1.0, 0.6]),
  ember: Object.freeze([1.0, 96 / 255, 40 / 255]),
  moon: Object.freeze([0.85, 0.9, 1.0]),
  red: Object.freeze([1.0, 0.32, 0.26]),
  moment: Object.freeze([1.0, 0.92, 0.62]),
});

/** THE VALUE LADDER (display luminance, measured in the lab on both lanes): what each rung may reach. Only signals and the
 *  critical may bloom; nothing on structure or ambient light exceeds 0.5. */
export const SD_LADDER = Object.freeze({ void: 0.04, haze: 0.18, structure: 0.25, ambient: 0.45, signal: 0.8, critical: 0.85 });

/** The escapement's ease (s): render/auraRing.js TURNING_STEP_S - the Turning Hour aura's own. */
export const SD_TICK_EASE_S = 0.25;
/** THE ESCAPEMENT: the machine's seconds at clock time `t` - whole at each anchored second, eased over its first
 *  SD_TICK_EASE_S and held the rest; never going back. Every hand that ticks (the Rift's gear, the sky's second hand,
 *  the back-dial, the chains) turns by this, so the Hour ticks as one clock. Smooth motion is danger: a threat moves
 *  smoothly, against it. */
export function sdTick(t) {
  const s = Math.floor(t), e = Math.min(1, (t - s) / SD_TICK_EASE_S);
  return s + e * e * (3 - 2 * e);
}
/** A countdown's hand: how far round it stands with `remaining` of `total` left - 1 at the start, 0 at twelve. Inside the
 *  Hour hands run BACK to twelve (anticlockwise as the eye sees it); on every way out they run forward - the caller
 *  turns it by the camera's one mirror (world/mat4.js). */
export const handToTwelve = (remaining, total) => (total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0);

/** THE HOUR'S GRADE on the lane (render/renderer.js setSceneGrade): the eye held down - it aims the mean at 0.12, not
 *  0.18, and opens at most 1.15x, not 1.8x, so the void stays black instead of lifting to grey-brown - with a little more
 *  bloom on what is meant to glow, a deeper vignette and a touch more contrast. Nothing on the classic set. The Hollow
 *  keeps the lane's defaults: it is a Daggerfall dungeon. */
export const SD_HOUR_GRADE = Object.freeze({ adaptKey: 0.12, adaptMax: 1.15, bloom: 0.8, vignette: 0.34, contrast: 1.08 });
