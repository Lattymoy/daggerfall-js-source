// Interior point lights. 1:1 with Daggerfall Unity's
// DaggerfallInterior.AddLight (MIT, Daggerfall Workshop): one light per
// archive-210 flat (when AmbientLitInteriors is off - the default), at
// the billboard's centre (interior AddFlat raises the transform by half
// the scaled height above the flat position) plus a per-record vertical
// offset tuned per light type; records 14/15 use +h/2 and 21 uses
// +h/2.4, "todo" records add nothing. Properties from the
// DaggerfallLight [Interior] prefab (read from the prefab YAML): point,
// range 15, intensity 1, white, Animate OFF (interior lights do not
// flicker). Interior ambient is PlayerAmbientLight's verbatim
// InteriorAmbientLight (0.18); the night variant (0.20, 0.18, 0.20) is
// exposed for the clock.

// Directional light for interior and dungeon frames (presentation
// choice; classic has no sun indoors - a fixed oblique direction keeps
// face shading legible). Normalized once here; single-sourced at the
// P7 audit (was inlined in worldModes + both standalone scenes).
export const INTERIOR_LIGHT_DIR = (() => {
  const d = new Float32Array([0.45, 0.8, 0.35]);
  const l = Math.hypot(d[0], d[1], d[2]);
  d[0] /= l; d[1] /= l; d[2] /= l;
  return d;
})();

export const INTERIOR_AMBIENT = Object.freeze([0.18, 0.18, 0.18]);
export const INTERIOR_NIGHT_AMBIENT = Object.freeze([0.20, 0.18, 0.20]);
export const INTERIOR_LIGHT_RANGE = 15;
export const INTERIOR_LIGHT_COLOR = Object.freeze([1, 1, 1]);
const LIGHTS_ARCHIVE = 210;

// Verbatim per-record light offsets (world units); absent records add 0.
const RECORD_OFFSETS = new Map([
  [0, -0.1], [2, 0.1], [3, 0.1], [5, 0.15], [6, 0.6], [9, 0.4],
  [11, -0.4], [13, -0.35], [17, 0.2], [20, 0.6], [22, -0.5],
  [24, -1.85], [25, -1.0], [27, -0.02],
]);

/**
 * Collect point lights for one interior's flats.
 * @param {Array<{archive:number,record:number,x:number,y:number,z:number}>} flats
 * @param {(record:number) => {w:number,h:number}} getScaledSize -
 *   scaledBillboardSize for archive 210 records (world units).
 * @returns {Array<{x:number,y:number,z:number,range:number}>}
 */
export function collectInteriorLights(flats, getScaledSize) {
  const lights = [];
  for (const f of flats) {
    if (f.archive !== LIGHTS_ARCHIVE) continue;
    const h = getScaledSize(f.record).h;
    let offset = RECORD_OFFSETS.get(f.record) ?? 0;
    if (f.record === 14 || f.record === 15) offset = h / 2;
    else if (f.record === 21) offset = h / 2.4;
    lights.push({
      x: f.x,
      y: f.y + h / 2 + offset,
      z: f.z,
      range: INTERIOR_LIGHT_RANGE,
    });
  }
  return lights;
}
