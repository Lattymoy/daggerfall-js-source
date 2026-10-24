// @ts-check
// EG-G2 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 25 - EG16): THE SPIRE'S
// LOOK ON THIS SCREEN - the passes world/eliteGates/egLook.js's law draws by, held for the breach and fed a circle at a time:
//   THE SKY        render/eliteGates/egSkyPass.js - the band's realm, painted (EG-LOOK: render/eliteGates/egSkyMap.js, a quadrant a frame -
//                  `paintSky`, from the breach client's pass with the world viewport in hand) and fetched after the halls'
//                  solid geometry and before their flats (the host's sky slot - scenes/worldModes.js, where the Hour's sky
//                  stood); the Spire's underside is the wreck's model, never painted (EG-LOOK);
//   THE MIST       render/eliteGates/egMistPass.js - a Mist Stair's and the Sinking Stair's surges, and (EG-LOOK) the Cairn's mist
//                  held still under every rim, UNDER the telegraphs and the lines (section 25.6: they draw after every
//                  transparent volume);
//   THE AIR        EG-LOOK (Elite-Gates-Look.md section 5): render/eliteGates/egMotes.js - the band's motes about the hall the eye
//                  stands in, one draw, faded off every floor's top, held still under reduced motion and never quieted by
//                  THE QUIET COMPANY (the place, not a player's); and the halos (render/superDungeon/sdHalo.js - the classic set's
//                  bloom) of the lamps' fixtures and the way's beams' feet, at most 48;
//   THE LINES      render/eliteGates/egLinePass.js - THE EDGE LINE, the tracks and the Gust's streamers, OVER everything the hall's
//                  fight draws, so the gold that says "it holds" is the last thing laid on the floor;
//   THE LIGHTS     render/eliteGates/egLightPass.js (EG-ZE, sections 7, 16.2, 16.5 and 27.5) - the door's beam and the closing's
//                  ring, the Redoubt's beacon, the recall's and the pings' blue pillars, the witness's marks
//                  (world/eliteGates/egLights.js egSpireLights), added over the lines: light, never paint.
// Each pass is built the first time it is wanted and kept for the breach; a circle's edges and lamps are made once a
// circle (its static buffer), the eye's hall's floors and rim sheets once a hall the eye stands in, its streamers, mist
// sheets and halos written a frame into kept arrays (AUDIT EG V L6-4: the mist's too - it made a new list of new sheets a
// frame). `release()` frees all of it - every exit of the breach reaches it through the client's leave
// (scenes/eliteGates/egClient.js). No GL, no draw: every method answers false.
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { egCircleSpecs, egBandOfCircle } from '../../net/eliteGates/egLaw.js';
import { SD_REALM_ORIGIN } from '../../net/superDungeon/sdBrain.js';
import { egCircleEdges, egGustSections, egStreamersAt, egMistSheets, egMistSheetsAt, EG_MIST } from '../../world/eliteGates/egLook.js';
import { egCircleLights } from '../../world/eliteGates/egHall.js';
import { egAtmosOf } from '../../world/eliteGates/egAtmos.js';
import { EgLinePass, EG_LINE_PROGRAMS, EG_STREAMERS_MAX } from '../../render/eliteGates/egLinePass.js';
import { EgMistPass, EG_MIST_PROGRAMS } from '../../render/eliteGates/egMistPass.js';
import { EgSkyPass, EG_SKY_PROGRAMS, egSkyLift } from '../../render/eliteGates/egSkyPass.js';
import { EG_SKY_STEPS } from '../../render/eliteGates/egSkyMap.js';   // EG-LOOK: the sky's pixel law, a lane each
import { EgMotesPass, EG_MOTES_PROGRAMS, egHalosInto, egRimMists, EG_RIM_MIST } from '../../render/eliteGates/egMotes.js';   // EG-LOOK: THE AIR
import { SdHaloRenderer, SD_HALO_PROGRAMS, SD_HALO_GAIN } from '../../render/superDungeon/sdHalo.js';   // EG-LOOK: the classic set's bloom, the Hour's
import { skyGain } from '../../render/deadlands.js';
import { EgLightPass, EG_LIGHT_PROGRAMS } from '../../render/eliteGates/egLightPass.js';   // EG-ZE: THE SPIRE'S LIGHTS
import { isTouchDevice } from '../../ui/touch/touchDevice.js';
import { compiledPass, parallelCompile, startPrograms } from '../../render/glProgram.js';   // FIRST-USE (#1144): each pass built once its program is done

/** FIRST-USE (#1144): THE LOOK'S SIX PROGRAMS - the lines', the sky's, the mist's, the motes', the lights' and the halos'. */
export const EG_LOOK_PROGRAMS = /** @type {ReadonlyArray<readonly [string, string]>} */ (Object.freeze([...EG_LINE_PROGRAMS, ...EG_SKY_PROGRAMS, ...EG_MIST_PROGRAMS, ...EG_MOTES_PROGRAMS, ...EG_LIGHT_PROGRAMS, ...SD_HALO_PROGRAMS]));
/** FIRST-USE (#1144): started as a hall loads (scenes/eliteGates/egSpan.js createEgSpan), where the driver compiles beside the
 *  frames - the look is made in the first frame drawn in the Spire, and its passes were built in it, each a whole compile
 *  inside that frame. Answers whether it started them. @param {any} gl */
export function startEgLookPrograms(gl) {
  if (!gl || !parallelCompile(gl)) return false;
  startPrograms(gl, EG_LOOK_PROGRAMS);
  return true;
}

/**
 * @param {{ gl?: WebGL2RenderingContext | null, lite?: boolean }} deps `lite` the phones' tier (ui/touch/touchDevice.js - the
 *   sky's paint a quadrant every fourth frame, half the motes)
 */
export function createEgLookDraw({ gl = null, lite = isTouchDevice() } = {}) {
  /** @type {EgLinePass|null} */ let lines = null;
  /** @type {EgMistPass|null} */ let mist = null;
  /** @type {EgSkyPass|null} */ let sky = null;
  /** @type {EgLightPass|null} */ let lights = null;   // EG-ZE
  /** @type {EgMotesPass|null} */ let motes = null;   // EG-LOOK
  /** @type {SdHaloRenderer|null} */ let halo = null;   // EG-LOOK
  let key = '', band = 0, sections = [], sheets = [], edgeCount = 0, trackCount = 0;
  /** AUDIT EG V (L3-7): the five halls the circle's look was made from (net/eliteGates/egLaw.js egCircleSpecs - each its own object) */
  let made = /** @type {any[]} */ ([]);
  const streamers = new Float32Array(EG_STREAMERS_MAX * 6), alphas = new Float32Array(EG_STREAMERS_MAX), sheetsAt = [];
  // EG-LOOK: THE AIR's own - the circle's lamps (world/eliteGates/egHall.js egCircleLights, once a circle) and the order they are
  // sorted in, the hall the eye stands in (its index in `made`; its floors handed to the motes when it changes), its rim
  // sheets, the halos (kept slots, an array-like), the sky's clock and the air's (held under reduced motion)
  let lamps = /** @type {any[]} */ ([]), order = new Int32Array(0), hallAt = -1, hallMotes = -1;
  const rims = /** @type {any} */ ({ length: 0 }), halos = /** @type {any} */ ({ length: 0 });
  let skyT = NaN, airT = NaN, skySteps = /** @type {number} */ (EG_SKY_STEPS.lane);
  // FIRST-USE (#1144): each pass through its door (render/glProgram.js compiledPass), built once its program is done. The
  // lines are asked as needed - the circle's edges are where a player falls - so they are built the frame they are wanted
  // whatever the driver says; the sky, the mist, the motes, the halos and the lights stand a few frames late instead.
  const fail = (name) => (e) => console.warn(`[eg] the ${name} would not build`, e?.message ?? e);
  const doorsOf = () => (gl ? {
    lines: compiledPass(gl, EG_LINE_PROGRAMS, () => new EgLinePass(gl), fail('lines')),
    sky: compiledPass(gl, EG_SKY_PROGRAMS, () => new EgSkyPass(gl, { lite }), fail('sky')),
    mist: compiledPass(gl, EG_MIST_PROGRAMS, () => new EgMistPass(gl), fail('mist')),
    motes: compiledPass(gl, EG_MOTES_PROGRAMS, () => new EgMotesPass(gl, { lite }), fail('motes')),
    lights: compiledPass(gl, EG_LIGHT_PROGRAMS, () => new EgLightPass(gl), fail('lights')),
    halo: compiledPass(gl, SD_HALO_PROGRAMS, () => new SdHaloRenderer(gl), fail('halo')),
  } : null);
  let doors = doorsOf();
  /** @param {'lines'|'sky'|'mist'|'motes'|'lights'|'halo'} name @returns {any} */
  const build = (name) => doors?.[name](name === 'lines') ?? null;
  /** EG-LOOK: the hall `eye` (the scene's frame) stands in - the nearest of the circle's along the level - and, when it
   *  changes, its rim sheets (the Cairn's). */
  const standAt = (eye) => {
    if (!made.length || !eye) return null;
    const ex = eye[0] - SD_REALM_ORIGIN[0];
    let h = 0;
    for (let j = 1; j < made.length; j++) if (Math.abs(made[j].x0 - ex) < Math.abs(made[h].x0 - ex)) h = j;
    if (h !== hallAt) { hallAt = h; egRimMists(made[h], band, rims); }
    return made[h];
  };
  return {
    /** The circle the screen stands in (its seed, number and span decrees): its edges made once, its streamers' and mist's
     *  places kept. Answers whether it changed. AUDIT EG V (L3-7; section 22, THE LAW PIN): made again when its halls are no
     *  longer the ones it was made from - a breach of another law's halls, given by the room after my own law drew the circle
     *  (net/eliteGates/egLaw.js egSpecGive: egHallOf answers the given hall from then), so THE EDGE LINE, the Gust's streamers and the
     *  mist stand where the breach's own platforms do. */
    setCircle(seed, c, geo = 0) {
      const k = `${seed >>> 0}:${c}:${geo | 0}`, specs = egCircleSpecs(seed, c, geo);
      if (k === key && specs.every((s, j) => s === made[j])) return false;
      key = k; band = egBandOfCircle(c); made = specs;
      const edges = egCircleEdges(seed, c, geo);
      sections = egGustSections(specs); sheets = egMistSheets(specs);
      edgeCount = edges.edge.length / 6; trackCount = edges.track.length / 6;
      lines ??= build('lines');
      lines?.setCircle(edges);
      lamps = egCircleLights(seed, c, geo); order = new Int32Array(lamps.length);   // EG-LOOK: the halos' lamps, once a circle
      hallAt = -1; hallMotes = -1;
      return true;
    },
    /** THE SKY: the band's, fetched from its painted map (`gain` the realm's light against its fog, `fog` the frame's - its
     *  colour the haze over the realm) - nothing until the map holds the band (paintSky). EG-LOOK: `seconds` the sky's
     *  clock, kept for the paint; the pixel law's steps the lane's the paint was last told. */
    drawSky(proj, view, seconds, fog = null, gain = 1) {
      if (!key) return false;
      sky ??= build('sky');
      skyT = seconds;
      return !!sky?.draw(proj, view, band, gain, fog?.color ?? egAtmosOf(band).fog.color, skySteps);
    },
    /** EG-LOOK (Elite-Gates-Look.md section 6): THE SKY'S PAINT - the band's map's next quadrant (the whole map for a new
     *  band or lane) on the sky's clock (the one drawSky was handed; `ts` until it has been), `vp` the world viewport to
     *  hand back (renderer._worldViewportPx - null the canvas's), `lane` the lit lane (its steps). Answers whether it painted. */
    paintSky(vp = null, lane = true, ts = 0) {
      if (!key) return false;
      sky ??= build('sky');
      skySteps = lane ? EG_SKY_STEPS.lane : EG_SKY_STEPS.classic;
      return !!sky?.paint(band, Number.isFinite(skyT) ? skyT : ts, vp);
    },
    /** THE MIST, before the telegraphs and the lines: each sheet at its surge's line on the shared clock `ts` (s); EG-LOOK:
     *  and the Cairn's sheets under the rims of the hall the eye stands in, held still at their heights. */
    drawUnder(proj, view, eye, ts, fog = null) {
      if (!key) return false;
      standAt(eye);
      let drew = false;
      if (sheets.length) {
        const at = egMistSheetsAt(sheets, ts, sheetsAt);   // AUDIT EG V (L6-4): written into its kept list
        if (at.length) {
          mist ??= build('mist');
          drew = !!mist?.draw(proj, view, eye, at, EG_MIST.color, ts, fog);
        }
      }
      if (rims.length) {
        mist ??= build('mist');
        if (mist?.draw(proj, view, eye, rims, EG_RIM_MIST.color, Number.isFinite(airT) ? airT : ts, fog)) drew = true;
      }
      return drew;
    },
    /**
     * EG-LOOK (Elite-Gates-Look.md section 5): THE AIR, after the mist and before the fight's pass - the band's motes about
     * the hall `eye` stands in (one draw, on the shared clock `ts`, held where it stood while `still` - reduced motion) and
     * the halos of the lamps' fixtures and the way's beams' feet (`list` world/eliteGates/egLights.js egSpireLights's answer), in the
     * frame's fog (`fog` the renderer's), the motes at the realm's light the sky takes (render/eliteGates/egSkyPass.js egSkyLift of
     * the band's gain against its fog - they are light, not ambient); `lane` the lit lane (the halos' gain), `viewH`
     * the world image's height in pixels (0: the drawing buffer's). Answers whether anything drew.
     */
    drawAir(proj, view, eye, ts, fog = null, lane = true, still = false, list = null, viewH = 0) {
      if (!key || !eye) return false;
      const spec = standAt(eye);
      if (!still || !Number.isFinite(airT)) airT = ts;
      motes ??= build('motes');
      let drew = false;
      if (motes && spec) {
        motes.setBand(band);
        if (hallMotes !== hallAt) { motes.setHall(spec); hallMotes = hallAt; }
        drew = motes.draw(proj, view, eye, airT, fog, egSkyLift(skyGain(fog?.color, egAtmosOf(band).fog.color)), viewH);   // the realm's light, as the sky's
      }
      egHalosInto(halos, lamps, list, eye, order);
      if (halos.length) {
        halo ??= build('halo');
        if (halo?.draw(proj, view, halos, fog, /** @type {any} */ (lane ? SD_HALO_GAIN.lane : SD_HALO_GAIN.classic))) drew = true;
      }
      return drew;
    },
    /** THE LINES, last: the circle's edges and tracks, and the Gust's streamers on the shared clock `ts` (s). AUDIT EG III
     *  (lane4 #5): `pal` the danger palette they are drawn in (render/eliteGates/egLinePass.js palette). AUDIT EG V (L6-3): `vp` the
     *  world image's rect in pixels (the renderer's `_worldViewportPx` - Retro Picture Mode's 320x200 or 640x400; null: the
     *  canvas's) - the line's two pixels are the image's, as the spans' ghosts drawn in the same pass are (scenes/eliteGates/egSpan.js
     *  drawPass). AUDIT EG V (h; section 8.2): `trail` THE TRAIL's `tn` segments (world/eliteGates/egLook.js egTrailSegs), or none. */
    drawOver(proj, view, eye, ts, fog = null, pal = null, vp = null, trail = null, tn = 0) {
      if (!key || !lines) return false;
      lines.palette(pal);
      const n = sections.length ? egStreamersAt(sections, ts, streamers, alphas) : 0;
      return lines.draw(proj, view, eye, ts, fog, streamers, n, alphas, vp?.[2] ?? 0, vp?.[3] ?? 0, trail, tn);
    },
    /** EG-ZE: THE LIGHTS, after the lines: `list` world/eliteGates/egLights.js egSpireLights's answer for this frame, `still` reduced
     *  motion. The pass is built the first time a light stands. */
    drawLights(proj, view, eye, ts, fog = null, list = null, still = false) {
      if (!key || !list?.length) return false;
      lights ??= build('lights');
      return !!lights?.draw(proj, view, eye, ts, fog, list, still);
    },
    /** EG-ZE: the lights' pass as it stands (tests, stats): built, and how many vertices it drew last. */
    lightState: () => ({ pass: !!lights, drawn: lights?.drawn ?? 0 }),
    /** EG-LOOK: THE AIR and THE SKY as they stand (tests, stats, the lab): the passes built, the motes laid and drawn, the
     *  halos and rim sheets of the frame, the hall the eye stands in, the band and quadrants the sky's map holds. */
    airState: () => ({ motes: !!motes, halo: !!halo, sky: !!sky, laid: motes?.count ?? 0, drawn: motes?.drawn ?? 0, halos: halos.length, rims: rims.length, hall: hallAt, lamps: lamps.length, map: sky ? { band: sky.map.band, painted: sky.map.painted } : null }),
    /** What the look holds (tests, stats). */
    state: () => ({ key, band, edges: edgeCount, tracks: trackCount, gusts: sections.length, mists: sheets.length, passes: { lines: !!lines, mist: !!mist, sky: !!sky } }),
    /** Out of the breach: every pass freed. */
    release() {
      for (const p of [lines, mist, sky, lights, motes, halo]) { if (p) { try { p.destroy(); } catch { /* gone */ } } }
      lines = null; mist = null; sky = null; lights = null; motes = null; halo = null;
      doors = doorsOf();   // FIRST-USE: the next breach's passes through fresh doors
      key = ''; sections = []; sheets = []; made = [];
      lamps = []; order = new Int32Array(0); hallAt = -1; hallMotes = -1; rims.length = 0; halos.length = 0; skyT = NaN; airT = NaN; skySteps = EG_SKY_STEPS.lane;
    },
  };
}
