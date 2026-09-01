// ROAD-B (b3-exterior-water): UNDERWATER FOG.
//
// Game/UnderwaterFog.cs (MIT, Daggerfall Workshop) 1:1 - the green
// murk that closes over the camera when the eye drops below a dungeon
// block's water surface, and the fog backup/restore that puts the
// room back when it clears.
//
// WHO CALLS IT. PlayerEnterExit.Update, inside the dungeon guard and
// nowhere else (PlayerEnterExit.cs:327-352):
//
//     if (dungeon && isPlayerInsideDungeon)
//     {
//         ... blockWaterLevel = playerDungeonBlockData.WaterLevel; ...
//         if (playerBlockIndex != -1)
//             underwaterFog.UpdateFog(blockWaterLevel);
//     }
//
// So this is a DUNGEON law. There is no exterior call site: the same
// Update's else arm forces isPlayerSubmerged false above ground
// (:415-421, "Underwater swimming logic should only be processed in
// dungeons at this time" :377), and swimming an exterior lake in DFU
// never tints the screen. The module is written host-agnostic anyway -
// it takes a water level and a camera height and nothing else - so
// the day the port grows an exterior water body with a level, the
// wiring is one call.
//
// WHY IT IS NOT A THRESHOLD. The entry and exit heights are 0.02
// units apart (:44-45) and the fog RAMPS across that band rather than
// snapping: fogT is the normalised depth inside it, the density is
// lerp(0, 0.25, fogT), and the colour goes flat to waterFogColor the
// instant fogT leaves zero. Two centimetres of travel is the whole
// fade, which is why bobbing at the surface flickers the green in the
// original.

import { GLOBAL_SCALE } from '../world/meshReader.js';

/** UnderwaterFog ctor (:26-27). Color32(14, 25, 21, 255) is the fog
 *  itself; waterMapColor is the automap's water tint, read by
 *  Automap.cs:2590 (`_WaterColor`) and carried here because DFU
 *  carries it here. */
export const WATER_FOG_COLOR = Object.freeze([14 / 255, 25 / 255, 21 / 255]);
export const WATER_MAP_COLOR = Object.freeze([0.1, 0.3, 0.25, 0.4]);

/** UnderwaterFog ctor (:28-29). */
export const FOG_DENSITY_MIN = 0;
export const FOG_DENSITY_MAX = 0.25;

/** WeatherManager.DungeonFogSettings (:77) - `fogMode = Exponential,
 *  density = 0.005f, startDistance = 0, endDistance = 0` - plus the
 *  black colour SetFog forces for any interior/dungeon fog (:183-186).
 *  This is the fog UnderwaterFog backs up and restores in a dungeon,
 *  and both dungeon hosts already wrote these five values inline. */
export const DUNGEON_FOG = Object.freeze({
  mode: 'exp', density: 0.005, start: 0, end: 0, color: Object.freeze([0, 0, 0]),
});

/** The port's one fog door takes five positional arguments and a
 *  Float32Array colour; this puts a settings record through it. */
export function applyFog(renderer, s) {
  renderer.setFog(s.mode, s.density, s.start, s.end, new Float32Array(s.color));
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);   // Mathf.Lerp clamps t

/**
 * UnderwaterFog.UpdateFog's depth term (:39-54), pulled out so the
 * ramp can be pinned without the settings machinery around it.
 *
 *     float adjustedCamYPos = yPos + (50 * MeshReader.GlobalScale) - 0.95f;
 *     float waterEntryThreshold = (waterLevel * -1 * MeshReader.GlobalScale) + 0.38f;
 *     float waterExitThreshold = (waterEntryThreshold) - 0.02f;
 *     float clampedCamYPos = Mathf.Clamp(adjustedCamYPos, waterExitThreshold, waterEntryThreshold);
 *     if (waterEntryThreshold - waterExitThreshold != 0.0f)
 *         fogT = 1 - ((clampedCamYPos - waterExitThreshold) / (waterEntryThreshold - waterExitThreshold));
 *     else
 *         fogT = 0.0f;
 *
 * The `!= 0` guard can never fail (the two differ by the literal
 * 0.02), and is ported as written rather than folded away - a
 * constant that is only constant by arithmetic is exactly the kind of
 * thing a later edit turns into a divide by zero.
 *
 * The +50*GlobalScale-0.95 is the same classic-vs-Unity Y correction
 * PlayerEnterExit uses for the swim toggle (:382); the breath test at
 * :407 uses 76 instead, and neither is this one's business.
 *
 * @param {number} waterLevel  blockWaterLevel (the RDB short; 10000 is
 *   "no water", which puts the entry threshold 250 units under the
 *   deepest floor and so answers 0).
 * @param {number} camY  the camera's world Y.
 * @returns {number} fogT in [0, 1]; 0 is dry, 1 is fully submerged.
 */
export function fogT(waterLevel, camY) {
  const adjustedCamYPos = camY + (50 * GLOBAL_SCALE) - 0.95;
  const waterEntryThreshold = (waterLevel * -1 * GLOBAL_SCALE) + 0.38;
  const waterExitThreshold = waterEntryThreshold - 0.02;
  const clampedCamYPos = clamp(adjustedCamYPos, waterExitThreshold, waterEntryThreshold);
  if (waterEntryThreshold - waterExitThreshold !== 0.0) {
    return 1 - ((clampedCamYPos - waterExitThreshold) / (waterEntryThreshold - waterExitThreshold));
  }
  return 0.0;
}

/**
 * UnderwaterFog (:5-81) as a class, because the backup/restore IS
 * state: `oldFogT` is the "was I dry last frame" edge that decides
 * whether the current RenderSettings are worth remembering.
 *
 * DFU reads and writes Unity's RenderSettings globals directly. Here
 * updateFog is given the settings the host is about to draw with and
 * RETURNS the settings it should draw with instead - the same values,
 * through the port's one fog door (renderer.setFog) rather than a
 * global the module reaches into.
 *
 * A settings record is `{ mode, density, start, end, color }` matching
 * renderer.setFog's argument order ('off' | 'linear' | 'exp').
 */
export class UnderwaterFog {
  constructor() {
    // ctor :30-35 - "get initial (backup) values - will be overwritten
    // (this is just a safety net mechanism so we start out with some
    // values)". The port's safety net is the dungeon's own fog
    // (DungeonFogSettings: exponential 0.005, black).
    this.original = { mode: 'exp', density: 0.005, start: 0, end: 0, color: [0, 0, 0] };
    this.waterFogColor = WATER_FOG_COLOR;
    this.waterMapColor = WATER_MAP_COLOR;
    this.fogDensityMin = FOG_DENSITY_MIN;
    this.fogDensityMax = FOG_DENSITY_MAX;
    // :22 - "used to identify player transition from out of water to
    // entering water".
    this.oldFogT = 0.0;
  }

  /**
   * UpdateFog(waterLevel) (:39-81).
   *
   * @param {number} waterLevel  blockWaterLevel.
   * @param {number} camY  mainCamera.transform.position.y.
   * @param {{mode: string, density: number, start: number, end: number,
   *          color: number[]}} current  the host's live fog settings,
   *   standing in for RenderSettings.
   * @returns {{mode: string, density: number, start: number, end: number,
   *            color: number[]}} what to apply this frame.
   */
  updateFog(waterLevel, camY, current) {
    const t = fogT(waterLevel, camY);

    // :55-63 - "backup fog settings when player is out of water or
    // just entering water (oldFogT is in both cases zero)". The
    // backup is taken BEFORE oldFogT is advanced, so the frame that
    // enters the water still saves the dry room.
    if (this.oldFogT === 0.0 && current) {
      this.original = {
        mode: current.mode, density: current.density,
        start: current.start, end: current.end,
        color: current.color ? Array.from(current.color) : [0, 0, 0],
      };
    }
    this.oldFogT = t;

    // :65-71 - "if player is submerged or entering water apply
    // underwater fog". Note what is NOT written: fogStartDistance and
    // fogEndDistance are left alone here and only restored below,
    // which is DFU's own asymmetry and is kept.
    if (t > 0.0) {
      return {
        mode: 'exp',
        density: lerp(this.fogDensityMin, this.fogDensityMax, t),
        start: this.original.start,
        end: this.original.end,
        color: Array.from(this.waterFogColor),
      };
    }
    // :72-80 - "otherwise restore old fog settings".
    return {
      mode: this.original.mode, density: this.original.density,
      start: this.original.start, end: this.original.end,
      color: Array.from(this.original.color),
    };
  }
}
