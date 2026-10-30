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
// LT1 closed the renderer gap: Renderer.setPointLights carries an
// optional per-light colour array (vec3 colour x intensity beside each
// vec4 [x,y,z,range]), the four fragment shaders accumulate a vec3
// `pointAcc` weighted by `uPointColors[i]`, and both interior hosts
// pass every light's own colour and intensity from the switch below.
// A host that passes no colour array gets the shared colour splatted
// across its lights - the exterior lantern path, unchanged.
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
  d[0] /= l;
  d[1] /= l;
  d[2] /= l;
  return d;
})();

export const INTERIOR_AMBIENT = Object.freeze([0.18, 0.18, 0.18]);
export const INTERIOR_NIGHT_AMBIENT = Object.freeze([0.2, 0.18, 0.2]);
/** PlayerAmbientLight.cs:29-30, InteriorAmbientLight_AmbientOnly and InteriorNightAmbientLight_AmbientOnly: the level DFU
 *  lights a room by when its Lit Interiors setting (AmbientLitInteriors) hangs no lamp in it. */
export const INTERIOR_AMBIENT_ONLY = Object.freeze([0.8, 0.8, 0.8]);
export const INTERIOR_NIGHT_AMBIENT_ONLY = Object.freeze([0.5, 0.5, 0.5]);

/**
 * RPT1026-WORLD DARK-ROOM (two private reports, 2026-10-24 and 10-26: an inn with not one lamp lit; Westhead Moor's
 * The Howling Mug, black from wall to wall): A ROOM DAGGERFALL LIGHTS WITH NOTHING IS LIT AS DFU LIGHTS
 * A ROOM BY AMBIENT ALONE. The Howling Mug is MARKAA01.RMB's first room (classic and under Beautiful Cities alike): 27
 * models and no archive-210 flat, so AddLight hangs no lamp in it and DFU draws it at InteriorAmbientLight's 0.18 - and
 * on the Enhanced Lighting lane that is 0.027 in linear under an eye held to 1.2 (INTERIOR-DIM), black. BLOCKS.BSA has
 * 177 such rooms of its 6,832 (5 taverns of 290, 30 weaponsmiths of 55, 16 banks of 31...). A room whose own
 * lamps (`lamps`: the lamps the room was BUILT with - its archive-210 flats as the build hung them, scenes/interiorContext.js
 * `roomLamps`) are none takes DFU's own ambient-only level for the hour (`ambient`, the clock's INTERIOR_AMBIENT or
 * INTERIOR_NIGHT_AMBIENT); a room with a lamp keeps the clock's, to the bit. A departure from PlayerAmbientLight's
 * InteriorAmbientLight for those rooms alone (Port-Ledger A, DARK-ROOM). Pure.
 * AUDIT RPT1026 J1: never the room's LIVE list (`lights`) - a home's placed lamps join it and a lamp its owner takes out
 * leaves it, so one candle set down in an unlit room put it back to 0.18 (dark but for the candle), and the caravan's
 * lantern taken out lit the caravan at 0.8. Nothing a player does in a room moves the level it is lit at.
 * @param {readonly number[]} ambient @param {ArrayLike<unknown> | null | undefined} lamps
 */
export function roomAmbient(ambient, lamps) {
  if ((lamps?.length ?? 0) > 0) return ambient;
  return ambient === INTERIOR_NIGHT_AMBIENT ? INTERIOR_NIGHT_AMBIENT_ONLY : INTERIOR_AMBIENT_ONLY;
}

// The DaggerfallLight [Interior] prefab's own light: the base every
// record of AddLight's second switch starts from (and the value the
// switch's "todo" arms leave in place).
export const INTERIOR_LIGHT_RANGE = 15;
export const INTERIOR_LIGHT_INTENSITY = 1;
export const INTERIOR_LIGHT_COLOR = Object.freeze([1, 1, 1]);

const LIGHTS_ARCHIVE = 210;

// Verbatim per-record light offsets (world units); absent records add 0.
const RECORD_OFFSETS = new Map([
  [0, -0.1],
  [2, 0.1],
  [3, 0.1],
  [5, 0.15],
  [6, 0.6],
  [9, 0.4],
  [11, -0.4],
  [13, -0.35],
  [17, 0.2],
  [20, 0.6],
  [22, -0.5],
  [24, -1.85],
  [25, -1.0],
  [27, -0.02],
]);

const PREFAB_LIGHT = Object.freeze({
  range: INTERIOR_LIGHT_RANGE,
  intensity: INTERIOR_LIGHT_INTENSITY,
  color: INTERIOR_LIGHT_COLOR,
});

const prop = (range, intensity, color) =>
  Object.freeze({
    range,
    intensity,
    color: color ? Object.freeze(color) : INTERIOR_LIGHT_COLOR,
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
  [0, prop(20.0, 1.1, [0.95, 0.91, 0.63])], // Bowl with fire
  [2, prop(15 / 3, 0.6, [1.0, 0.99, 0.82])], // Skull candle              (range /= 3)
  [3, prop(15 / 3, 1, null)], // Candle                    (range /= 3)
  [4, prop(15 / 3, 1, null)], // Candle with base          (range /= 3)
  [5, prop(7.5, 0.33, [1.0, 0.89, 0.61])], // Candleholder with 3 candles
  [6, prop(15.0, 0.75, [1.0, 0.93, 0.62])], // Skull torch
  [8, prop(15, 1, [0.68, 1.0, 0.94])], // Turkis lamp               (colour only)
  [9, prop(15.0, 0.65, [1.0, 0.92, 0.6])], // Metallic chandelier with burning candles
  [11, prop(5.0, 0.5, null)], // Candle in lamp
  [13, prop(15 * 1.2, 1.1, [0.93, 0.84, 0.49])], // Round lamp              (range *= 1.2)
  [17, prop(15, 0.8, [1.0, 0.97, 0.87])], // Mounted torch 1
  [20, prop(12.0, 0.75, [1.0, 0.92, 0.72])], // Brazier torch
  [21, prop(15 / 3, 0.5, [1.0, 0.95, 0.67])], // Standing candle           (range /= 3)
  [22, prop(15, 1.5, [1.0, 0.95, 0.78])], // Round lantern with medium chain
  [24, prop(15, 1.4, [1.0, 0.98, 0.64])], // Lantern with long chain
  [25, prop(15, 1.4, [1.0, 0.98, 0.64])], // Lantern with medium chain
  [26, prop(15, 1.4, [1.0, 0.98, 0.64])], // Lantern with short chain
  [27, prop(15, 1.4, [1.0, 0.98, 0.64])], // Lantern with no chain
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
 * @returns {Array<{record:number,x:number,y:number,z:number,foot:number,w:number,h:number,range:number,intensity:number,color:readonly number[]}>}
 */
export function collectInteriorLights(flats, getScaledSize) {
  const lights = [];
  for (const f of flats) {
    if (f.archive !== LIGHTS_ARCHIVE) continue;
    const { w, h } = getScaledSize(f.record);
    let offset = RECORD_OFFSETS.get(f.record) ?? 0;
    if (f.record === 14 || f.record === 15) offset = h / 2;
    else if (f.record === 21) offset = h / 2.4;
    const light = interiorLightProperties(f.record);
    lights.push({
      record: f.record, // HEARTH1: a lantern and a brazier are one point light here and two things to the survival law (survival/hearth.js)
      x: f.x,
      y: f.y + h / 2 + offset,
      z: f.z,
      foot: f.y,
      w,
      h, // FIX-D: the sprite the light hangs on (an interior flat stands on its y), for a hearth's eye box
      range: light.range,
      intensity: light.intensity,
      color: light.color,
    });
  }
  return lights;
}
