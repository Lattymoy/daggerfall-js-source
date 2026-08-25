// Interior point lights. 1:1 with Daggerfall Unity's
// DaggerfallInterior.AddLight (MIT, Daggerfall Workshop):
// DaggerfallInterior.cs:927-1154, one light per archive-210 flat (when
// AmbientLitInteriors is off - the default), at the billboard's centre
// (interior AddFlat raises the transform by half the scaled height
// above the flat position) plus a per-record vertical offset tuned per
// light type; records 14/15 use +h/2 and 21 uses +h/2.4, "todo"
// records add nothing. That is AddLight's FIRST switch
// (DaggerfallInterior.cs:940-1032).
//
// Properties START at the DaggerfallLight [Interior] prefab
// ("Assets/Prefabs/Scene/DaggerfallLight [Interior].prefab":41-44 -
// m_Type 2 point, m_Color {1,1,1,1}, m_Intensity 1, m_Range 15;
// Animate OFF, interior lights do not flicker) - but AddLight's SECOND
// switch (DaggerfallInterior.cs:1034-1151, "adjust properties of light
// sources") then OVERWRITES range/intensity/colour per light type, so
// the prefab values are the base, not the answer. That whole switch is
// interiorLightProperties below and every light collected here carries
// its own range, intensity and colour.
//
// RENDERER GAP (Port-Ledger, Rendering arc): only the per-light RANGE
// reaches the GPU. Renderer.setPointLights takes a vec4 per light
// [x, y, z, range] plus ONE shared vec3 uPointColor, and the four
// fragment shaders that light a scene accumulate a scalar `pointDiff`
// before multiplying by that single colour - so per-light intensity
// and colour cannot be uploaded without a per-light colour channel in
// the light uniform (a vec3 array, and a vec3 accumulator in each of
// the four shaders). Until that lands both interior hosts pass
// INTERIOR_LIGHT_COLOR, the prefab white, for every light.
//
// Interior ambient is PlayerAmbientLight's verbatim
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

// The DaggerfallLight [Interior] prefab's own light: the base every
// record of AddLight's second switch starts from (and the value the
// switch's "todo" arms leave in place).
export const INTERIOR_LIGHT_RANGE = 15;
export const INTERIOR_LIGHT_INTENSITY = 1;
export const INTERIOR_LIGHT_COLOR = Object.freeze([1, 1, 1]);

const LIGHTS_ARCHIVE = 210;

// Verbatim per-record light offsets (world units); absent records add 0.
const RECORD_OFFSETS = new Map([
  [0, -0.1], [2, 0.1], [3, 0.1], [5, 0.15], [6, 0.6], [9, 0.4],
  [11, -0.4], [13, -0.35], [17, 0.2], [20, 0.6], [22, -0.5],
  [24, -1.85], [25, -1.0], [27, -0.02],
]);

const PREFAB_LIGHT = Object.freeze({
  range: INTERIOR_LIGHT_RANGE,
  intensity: INTERIOR_LIGHT_INTENSITY,
  color: INTERIOR_LIGHT_COLOR,
});

const prop = (range, intensity, color) => Object.freeze({
  range, intensity, color: color ? Object.freeze(color) : INTERIOR_LIGHT_COLOR,
});

// AddLight's SECOND switch, transcribed cell for cell from
// DaggerfallInterior.cs:1034-1151. Each arm assigns only some of
// range/intensity/colour and the rest keep the prefab's, so every row
// below is resolved against PREFAB_LIGHT: `light.range /= 3f` on the
// prefab's 15 is 5, `light.range *= 1.2f` is 18. The switch's twelve
// "todo" arms (records 1, 7, 10, 12, 14, 15, 16, 18, 19, 23, 28, 29)
// touch nothing and are absent here, as is any record outside 0-29 -
// the switch has NO default arm, so both fall through unchanged.
const RECORD_LIGHT_PROPS = new Map([
  // record                                       range        intensity  color
  [0,  prop(20.0, 1.1, [0.95, 0.91, 0.63])],   // Bowl with fire
  [2,  prop(15 / 3, 0.6, [1.0, 0.99, 0.82])],  // Skull candle              (range /= 3)
  [3,  prop(15 / 3, 1, null)],                 // Candle                    (range /= 3)
  [4,  prop(15 / 3, 1, null)],                 // Candle with base          (range /= 3)
  [5,  prop(7.5, 0.33, [1.0, 0.89, 0.61])],    // Candleholder with 3 candles
  [6,  prop(15.0, 0.75, [1.0, 0.93, 0.62])],   // Skull torch
  [8,  prop(15, 1, [0.68, 1.0, 0.94])],        // Turkis lamp               (colour only)
  [9,  prop(15.0, 0.65, [1.0, 0.92, 0.6])],    // Metallic chandelier with burning candles
  [11, prop(5.0, 0.5, null)],                  // Candle in lamp
  [13, prop(15 * 1.2, 1.1, [0.93, 0.84, 0.49])], // Round lamp              (range *= 1.2)
  [17, prop(15, 0.8, [1.0, 0.97, 0.87])],      // Mounted torch 1
  [20, prop(12.0, 0.75, [1.0, 0.92, 0.72])],   // Brazier torch
  [21, prop(15 / 3, 0.5, [1.0, 0.95, 0.67])],  // Standing candle           (range /= 3)
  [22, prop(15, 1.5, [1.0, 0.95, 0.78])],      // Round lantern with medium chain
  [24, prop(15, 1.4, [1.0, 0.98, 0.64])],      // Lantern with long chain
  [25, prop(15, 1.4, [1.0, 0.98, 0.64])],      // Lantern with medium chain
  [26, prop(15, 1.4, [1.0, 0.98, 0.64])],      // Lantern with short chain
  [27, prop(15, 1.4, [1.0, 0.98, 0.64])],      // Lantern with no chain
]);

/**
 * AddLight's second per-record switch: the light one archive-210
 * texture record gets, resolved against the interior light prefab.
 * @param {number} record - archive 210 texture record.
 * @returns {{range:number, intensity:number, color:readonly number[]}}
 *   frozen; unlisted records (the switch's "todo" arms, and anything
 *   outside 0-29 - there is no default arm) get the prefab's light.
 */
export function interiorLightProperties(record) {
  return RECORD_LIGHT_PROPS.get(record) ?? PREFAB_LIGHT;
}

/**
 * Collect point lights for one interior's flats.
 * @param {Array<{archive:number,record:number,x:number,y:number,z:number}>} flats
 * @param {(record:number) => {w:number,h:number}} getScaledSize -
 *   scaledBillboardSize for archive 210 records (world units).
 * @returns {Array<{x:number,y:number,z:number,range:number,intensity:number,color:readonly number[]}>}
 */
export function collectInteriorLights(flats, getScaledSize) {
  const lights = [];
  for (const f of flats) {
    if (f.archive !== LIGHTS_ARCHIVE) continue;
    const h = getScaledSize(f.record).h;
    let offset = RECORD_OFFSETS.get(f.record) ?? 0;
    if (f.record === 14 || f.record === 15) offset = h / 2;
    else if (f.record === 21) offset = h / 2.4;
    const light = interiorLightProperties(f.record);
    lights.push({
      x: f.x,
      y: f.y + h / 2 + offset,
      z: f.z,
      range: light.range,
      intensity: light.intensity,
      color: light.color,
    });
  }
  return lights;
}
