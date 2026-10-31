// @ts-check
// ═══════════════════════════════════════════════════════════════════
// HOME-LOOK (2026-09-30) — A HOUSE'S OUTSIDE, WORN AS ITS OWNER CHOSE.
//
// Asked: "The introduction of exterior customization. The ability to
// choose the texture for the roof, walls, door, windows, etc". The look
// is net/homeLaw.js homeLookOf's; this is how a face wears it.
//
// A FACE'S PART is read off the texture Daggerfall gave it (its original
// archive and record, before any climate swap): the roofs' family (69,
// and its winter 70), the doors' (74 - the frame's tapestry, record 3,
// never), a window (ClimateSwaps.IsExteriorWindow), or a building set's
// wall (the families IsExteriorWindow names, record 3 aside). Anything
// else - a fence, a sign, a castle's own special sets - is the town's.
//
// WHAT IT WEARS: the part's choice put through Daggerfall's own
// ApplyClimate from the family's desert index (the family itself), so the
// season's snow falls on it where Daggerfall's falls - a wall keeps its
// record (the set's own order, as a climate swap keeps it), a window is
// the set's record 3, and a roof or a door is the one record chosen.
//
// THE REMAP is the draw-time table the climate swap already is
// (world/texRemap.js: pixels from the swapped record, UVs the original's):
// a house painted is drawn with its OWN table - the pixel's climate swaps
// and its look's over them - and a record its archive lacks is left to
// the town's (the prune texRemap.js keeps, and for the same reason).
// ═══════════════════════════════════════════════════════════════════

import { applyClimate, isExteriorWindow } from './climateSwaps.js';
import { HOME_LOOK_CLIMATES, HOME_LOOK_SETS, HOME_LOOK_DOOR_KEPT, homeLookOf } from '../net/homeLaw.js';

/** How long a town's pixel waits for its homes before it merges its buildings, milliseconds - a moment; a town heard of
 *  later has its painted homes rebuilt (world.js refreshHomeLooks). */
export const HOME_LOOK_BUILD_WAIT_MS = 1_500;
/** The roofs' and the doors' families (world/climateSwaps.js SET.Exterior_Roofs, SET.Exterior_Doors). */
export const HOME_LOOK_ROOFS = 69;
export const HOME_LOOK_DOORS = 74;
/** The building sets a wall face is read from - each family IsExteriorWindow names, and its winter one. */
export const HOME_LOOK_WALL_FAMILIES = Object.freeze(
  new Set([9, 10, 12, 13, 14, 15, 26, 27, 35, 36, 38, 39, 42, 43, 58, 59, 61, 62, 64, 65]),
);

/** The climate bases a family's archives stand at (world/climateSwaps.js BASE). */
const HOME_LOOK_BASES = new Set(/** @type {number[]} */ (Object.values(HOME_LOOK_CLIMATES)));
/** Which part of a house a face is, by the texture Daggerfall gave it - 'walls', 'windows', 'roof', 'door' or null. */
export function homeLookPart(archive, record) {
  if (!Number.isSafeInteger(archive) || !Number.isSafeInteger(record) || archive < 0 || archive >= 500) return null;
  const family = archive % 100;
  // a climate's family lives at a climate's base alone (0, 100, 300, 400) - TEXTURE.2xx are the flats' archives, and
  // 210 (the interior lights) is no castle's winter wall though 210 % 100 says 10
  if (!HOME_LOOK_BASES.has(archive - family)) return null;
  if (family === HOME_LOOK_ROOFS || family === HOME_LOOK_ROOFS + 1) return 'roof';
  if (family === HOME_LOOK_DOORS) return record === HOME_LOOK_DOOR_KEPT ? null : 'door';
  if (isExteriorWindow(archive, record)) return 'windows';
  if (HOME_LOOK_WALL_FAMILIES.has(family)) return 'walls';
  return null;
}

/**
 * WHAT A FACE WEARS under `look` in `season` - `[archive, record]` - or null (its part unchanged, or none: the town's
 * own). The choice's family goes through ApplyClimate from its desert index, so winter snows on it as on the town.
 */
export function homeLookTarget(archive, record, look, season) {
  const part = homeLookPart(archive, record);
  const choice = part ? look?.[part] : null;
  if (!choice) return null;
  const base = HOME_LOOK_CLIMATES[choice.climate];
  if (base == null) return null;
  if (part === 'walls') return [applyClimate(HOME_LOOK_SETS[choice.set], record, base, season), record];
  if (part === 'windows') return [applyClimate(HOME_LOOK_SETS[choice.set], 3, base, season), 3];
  if (part === 'roof') return [applyClimate(HOME_LOOK_ROOFS, choice.record, base, season), choice.record];
  return [applyClimate(HOME_LOOK_DOORS, choice.record, base, season), choice.record];
}

/**
 * A PAINTED HOUSE'S OWN TABLE for one model's submeshes: the pixel's climate swaps (`base`, "a_r" -> "a_r", the
 * pixel's texRemap) for its faces, the look's over them - each target uploaded as the swap uploads it, and one whose
 * archive lacks the record left to the town's. Answers a NEW Map (the renderer caches a sub-mesh's texture against the
 * remap's identity - render/renderer.js - so a changed look is always a new table). `into` a table a house's other
 * models already filled, to add to.
 * @param {Array<{textureArchive: number, textureRecord: number}>|undefined} subMeshes
 * @param {Map<string, string>} base
 * @param {any} look
 * @param {number} season
 * @param {{ getTexture: (a: number) => Promise<any>, uploadRecord: (a: number, r: number, o?: any) => void }} deps
 * @param {Map<string, string>|null} [into]
 */
export async function homeLookRemap(subMeshes, base, look, season, { getTexture, uploadRecord }, into = null) {
  const out = into ?? new Map();
  const want = homeLookOf(look);
  for (const sm of subMeshes ?? []) {
    const key = `${sm.textureArchive}_${sm.textureRecord}`;
    if (out.has(key)) continue;
    const t = want ? homeLookTarget(sm.textureArchive, sm.textureRecord, want, season) : null;
    if (t) {
      let tex = null;
      try {
        tex = await getTexture(t[0]);
      } catch {
        tex = null;
      }
      if (tex && t[1] < tex.recordCount) {
        uploadRecord(t[0], t[1], { opaque: true }); // a mesh material, as the climate swap uploads it (texRemap.js)
        out.set(key, `${t[0]}_${t[1]}`);
        continue;
      }
    }
    const swapped = base?.get?.(key);
    if (swapped) out.set(key, swapped);
  }
  return out;
}

/** The records a roof's or a door's family offers in a climate - its archive's count, bounded by the law. */
export async function homeLookRecords(part, climate, season, getTexture) {
  const base = HOME_LOOK_CLIMATES[climate];
  const family = part === 'roof' ? HOME_LOOK_ROOFS : part === 'door' ? HOME_LOOK_DOORS : null;
  if (family == null || base == null) return 0;
  try {
    return (await getTexture(applyClimate(family, 0, base, season)))?.recordCount ?? 0;
  } catch {
    return 0;
  }
}
/** THE SWATCH a part's choice shows in the painter - the archive and record its faces would wear (a wall's by its first
 *  record), or null. */
export function homeLookSwatch(part, choice, season) {
  if (!choice) return null;
  const record = part === 'walls' ? 0 : part === 'windows' ? 3 : choice.record;
  const probe = part === 'roof' ? HOME_LOOK_ROOFS : part === 'door' ? HOME_LOOK_DOORS : HOME_LOOK_SETS[choice.set];
  if (probe == null) return null;
  const t = homeLookTarget(probe, part === 'windows' ? 3 : record, { [part]: choice }, season);
  return t ? { archive: t[0], record: t[1] } : null;
}
