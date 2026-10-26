// @ts-check
// ═══════════════════════════════════════════════════════════════════
// BANTHA1 (bible/03-World/Bantha-Jungle.md): THE JUNGLE'S HOST - Bantha's jungle in the streamed world, a module the
// world host wires (HOST-SPLIT, bible/01-Overview/Host-Split.md: scenes/fishHost.js is the shape) and never grows
// into bootWorld. It owns:
//   - THE FIELD: where the jungle is (world/jungle/jungleRegion.js), built from the map the first time it is asked;
//   - THE JOB: the terrain kernel's jungle for a pixel (`job` - its 3x3 of distances; world/terrain/jungleNature.js
//     lays the trees on the worker);
//   - THE TREES' DOOR (systems/jungleTreesAssets.js - Low Poly Trees' own, the owner's trees);
//   - THE HAZE: each exterior frame's (`haze`) - its share at the eye, its density by the hour, the weather and the
//     drifting banks, its floor over the ground, eased; the renderer's uniforms, the sky's, and the frame's one fog
//     colour (world/jungle/jungleHaze.js) - and what it hides (`hides`, the world host's pixel gate - its one caller; AUDIT BANTHA1 HAZE-10);
//   - VALENWOOD-CANOPY: THE CLOSED CANOPY, each exterior frame's too (in `haze`, before the haze's own switch) - its share at
//     the camera's eye off the canopy zones' own field, under the canopy's top, eased (world/jungle/jungleCanopy.js); the
//     fog's colour dimmed under it, the leaves the water mirrors (`sky.setCanopy`), and its weight (`canopy`) for the world
//     host's light;
//   - GRAHT1: THE GRAHT-OAKS that close it (scenes/grahtHost.js, `graht` - built where the canopy's zones are, `?graht=off`
//     offline its kill door): the job carries the canopy field's 3x3 (`canopy`), where the terrain worker stands them, and
//     their host culls them by this host's haze (`hides`).
// The four hosts: scenes/world.js WIRED - the streamed world, the one host that stands terrain nature; and
// scenes/exterior.js (the fixed city), scenes/worldModes.js (interiors), scenes/dungeonContext.js (dungeons) - FLAGGED: none stands the wilderness the jungle grows in
// (a fixed city's flats are its location's, an interior and a dungeon stand none), and each beginFrame of theirs clears
// the haze (render/renderer.js setJungleHaze - a frame's, armed by the exterior frame alone).
// ═══════════════════════════════════════════════════════════════════
import { jungleField, jungleFieldOf, jungleNine, jungleDepthAt, jungleAirShare, jungleShare, jungleFloorDraw } from '../world/jungle/jungleRegion.js';
import { TERRAIN_SIZE as PIXEL_M } from '../world/terrain/terrainSampler.js';   // a map pixel (m)
import { createJungleTrees } from '../systems/jungleTreesAssets.js';
import { setAirBiome, CLIMATE_AIR } from '../systems/weather/airTemperature.js';   // PRECIP1: the jungle's own air
import { CLIMATES } from '../formats/mapsFile.js';
import {
  JUNGLE_HAZE, hazeShare, hazeDayFactor, hazeWeatherFactor, hazeDrift, createHazeState, stepHaze, hazeUniforms, fogColorWith,
  hazeSkyUniform, hazeHides,
} from '../world/jungle/jungleHaze.js';
import { canopyShare, canopyUnder, createCanopyState, stepCanopy, canopyFog, canopyLeaves, JUNGLE_CANOPY } from '../world/jungle/jungleCanopy.js';   // VALENWOOD-CANOPY
import { createGrahtHost, grahtOaksOn } from './grahtHost.js';   // GRAHT1: the graht-oaks that close the canopy

/**
 * @param {{ renderer: any, maps: any, mapWidth: number, mapHeight: number, stateOf: () => any, builtOf: () => Map<string, any>,
 *   heightAt: (x: number, z: number) => number, breathe?: () => Promise<void>, haze?: boolean, trees?: any,
 *   insideAt?: (x: number, y: number) => boolean, beyond?: ((x: number, y: number) => boolean)|null,
 *   zoneAt?: ((x: number, y: number) => { jungle?: boolean, canopy?: boolean }|null)|null, version?: (() => number)|null }} deps
 *   `stateOf()` the stream's state (StreamingWorldState: mapOrigin, compensation, pixelTranslation) and `builtOf()` its
 *   pixels - asked, never held: the world host builds this before its stream; `heightAt` the ground at a scene point; `haze` false - the jungle stands, its air stays clear (`?junglehaze=off`);
 *   `trees` a door to use in place of the owner's (a test's); `insideAt` the jungle's map pixels in place of the owner's area
 *   (world/jungle/banthaArea.js - a test's); TESA-BIOME: `beyond` the jungle's pixels past the Bay's map (Cyrodiil's zones,
 *   world/tamriel/tamrielBiomes.js) and `version` their stamp - the field is made again when it moves (the trace landing,
 *   a fit), so no pixel keeps a side read on the land as it was; VALENWOOD-CANOPY: `zoneAt` the zone at a pixel past the Bay
 *   (tamrielBiomeAt) in place of `beyond` - the jungle's pixels its zones' `jungle`, the canopy's their `canopy`
 */
export function createJungleHost({ renderer, maps, mapWidth, mapHeight, stateOf, builtOf, heightAt, breathe, haze = true, trees = null, insideAt = undefined, beyond = null, zoneAt = null, version = null }) {
  const door = trees ?? createJungleTrees({ renderer, breathe });
  beyond ??= zoneAt ? (x, y) => !!zoneAt(x, y)?.jungle : null;
  const canopyAt = zoneAt ? (x, y) => !!zoneAt(x, y)?.canopy : null;   // VALENWOOD-CANOPY: no Bay pixel's canopy closes
  let field = null, fieldVersion, canopyField = null;
  const fresh = () => {
    if (version) { const v = version(); if (v !== fieldVersion) { fieldVersion = v; field = null; canopyField = null; } }
  };
  const fieldNow = () => {
    fresh();
    return (field ??= beyond ? jungleField({ width: mapWidth, height: mapHeight, insideAt, beyond }) : jungleFieldOf(maps, mapWidth, mapHeight, insideAt));
  };
  const canopyNow = () => {
    fresh();
    return canopyAt ? (canopyField ??= jungleField({ width: mapWidth, height: mapHeight, insideAt: () => false, beyond: canopyAt, beyondMax: JUNGLE_CANOPY.fieldMax })) : null;   // AUDIT TESA II G10: its own small cap
  };
  // PRECIP1 (systems/weather/airTemperature.js): THE JUNGLE'S AIR - the rainforest's, leaned in across the jungle's line
  // over its air's own band (AUDIT PRECIP AIR-12, world/jungle/jungleRegion.js jungleAirShare: kilometres, the air warming
  // before the first tree), so what falls in it is rain whatever the land's own climate (the Dragontail foothills' Mountain), and
  // its edge is a band of sleet a walker crosses, never a line. Field metres in.
  const _airNine = new Array(9);
  setAirBiome('jungle', (fx, fz) => {
    const px = Math.floor(fx / PIXEL_M), py = mapHeight - 1 - Math.floor(fz / PIXEL_M);
    const nine = jungleNine(fieldNow(), px, py, _airNine);
    return nine ? jungleAirShare(jungleDepthAt(px, py, nine, fx - px * PIXEL_M, fz - (mapHeight - 1 - py) * PIXEL_M)) : 0;
  }, CLIMATE_AIR[CLIMATES.Rainforest]);
  const hs = createHazeState();
  const u = new Float32Array(8), skyU = new Float32Array(4), colour = new Float32Array(3);
  const _t = [0, 0, 0], _eye = [0, 0, 0], _abs = [0, 0, 0], _nine = new Array(9), _floorNine = new Array(9);
  const _floor = { px: NaN, py: NaN, field: /** @type {any} */ (null), nine: /** @type {any[]|null} */ (null) };   // BANTHA2: floorClaims' last pixel and its 3x3
  const _w = { px: 0, py: 0, lx: 0, lz: 0 };
  // VALENWOOD-CANOPY: the canopy's eased state, its eye in the world's frame, the eye's height over its ground, its leaves
  const cs = createCanopyState(), _cNine = new Array(9), _cEye = [0, 0, 0], cu = new Float32Array(4);
  let canopySent = false;
  let clock = 0;
  /** the pixel a scene point stands in and where in it (m, x east and z north - the layout's frame), in one scratch
   *  (AUDIT BANTHA1 HOST-8: no frame allocates) - read before the next ask */
  const where = (x, z) => {
    const state = stateOf(), c = state.compensation, S = PIXEL_M;
    const px = state.mapOrigin.x + Math.floor((x - c[0]) / S), py = state.mapOrigin.y - Math.floor((z - c[2]) / S);
    const t = state.pixelTranslation(px, py, _t);
    _w.px = px; _w.py = py; _w.lx = x - t[0]; _w.lz = z - t[2];
    return _w;
  };
  /** HOST-8: the eye's 3x3 of pixel keys, made when the eye's pixel changes */
  const _keys = new Array(9);
  let _kx = NaN, _ky = NaN;
  const keysAbout = (px, py) => {
    if (px !== _kx || py !== _ky) {
      _kx = px; _ky = py;
      for (let i = 0; i < 9; i++) _keys[i] = `${px + (i % 3) - 1},${py + Math.floor(i / 3) - 1}`;
    }
    return _keys;
  };
  /** the haze's floor's ground under a scene point: the ground there, or the land about it (its 3x3 of pixels' middles)
   *  where that is lower - a summit stands over the haze, a valley in it */
  const groundUnder = (x, z, px, py) => {
    const here = heightAt(x, z), state = stateOf(), built = builtOf(), keys = keysAbout(px, py);
    let sum = 0, n = 0;
    for (let i = 0; i < 9; i++) {
      const p = built.get(keys[i]);
      if (!p || !Number.isFinite(p.centerHeight)) continue;
      sum += p.centerHeight + state.pixelTranslation(p.px, p.py, _t)[1];
      n++;
    }
    return Number.isFinite(here) ? (n ? Math.min(here, sum / n) : here) : (n ? sum / n : 0);
  };
  /** AUDIT BANTHA1 HOST-1: NO HAZE - the state let go and the uniforms ZEROED with the renderer's and the sky's, so `hides`
   *  (which reads them) answers nothing: the last eased frame's stood on, and the cull with them over the whole map, for
   *  the rest of a session that walked out of the jungle. */
  const off = (fogColor, sky) => {
    hs.share = 0; hs.primed = false; u.fill(0);
    renderer.setJungleHaze(null); sky?.setHazeSky?.(null);
    return fogColor;
  };
  /** WHETHER THE HAZE HIDES a box this frame (the host's `hides`, below - and the graht-oaks', each its own box). */
  const hidesBox = (box, t) => u[4] >= 0.5 && !!box && hazeHides(u, _eye, box, t);
  /** GRAHT1: the graht-oaks' host, where the canopy's zones are and the door is open (scenes/grahtHost.js) */
  const graht = canopyAt && grahtOaksOn() ? createGrahtHost({ renderer, hides: hidesBox, breathe }) : null;
  /** VALENWOOD-CANOPY: the canopy's share at the camera's eye (`eye`, the scene's) - its zones' field, under the canopy's top -
   *  eased over `dt` (world/jungle/jungleCanopy.js stepCanopy). */
  const canopyStep = (eye, dt) => {
    if (!canopyAt) return;
    const w = where(eye[0], eye[2]);
    const nine = jungleNine(canopyNow(), w.px, w.py, _cNine);
    const over = eye[1] - heightAt(eye[0], eye[2]);
    _cEye[0] = w.px * PIXEL_M + w.lx; _cEye[1] = eye[1]; _cEye[2] = -w.py * PIXEL_M + w.lz;
    stepCanopy(cs, { dt, eye: _cEye, target: nine ? canopyShare(jungleDepthAt(w.px, w.py, nine, w.lx, w.lz)) * canopyUnder(over) : 0 });
  };
  /** VALENWOOD-CANOPY: the frame's fog colour `c` (the host's own, written in place) dimmed under the leaves, and the leaves
   *  lit by it handed to the sky for the water to mirror (`sky.setCanopy`, world/jungle/jungleCanopy.js canopyLeaves) - or
   *  taken back where the canopy has gone. GRAHT1: the leaves overhead are the graht-oaks' own - no ceiling is drawn. */
  const canopied = (c, sky) => {
    if (!(cs.w > 0) || !c) { if (canopySent) { sky?.setCanopy?.(null); canopySent = false; } return c; }
    canopyFog(c, cs.w, c);
    sky?.setCanopy?.(canopyLeaves(cs.w, c, cu));
    canopySent = true;
    return c;
  };
  const _cFog = new Float32Array(3);
  /** The haze off (`off`) with the canopy still standing: the weather's fog colour, dimmed under it into the host's own. */
  const canopiedOff = (fogColor, sky) => {
    const c = off(fogColor, sky);
    if (!(cs.w > 0)) { canopied(null, sky); return c; }
    _cFog.set(c);
    return canopied(_cFog, sky);
  };
  return {
    door,
    /** THE TERRAIN JOB'S JUNGLE for a pixel - `{ nine, hidden, canopy }` (its 3x3 of distances, whether its location is a
     *  place the woods hide, and GRAHT1: the canopy field's 3x3 where a canopy closes near it and the graht-oaks stand -
     *  null else), or null where the jungle cannot reach. */
    job(px, py, hidden = false) {
      const nine = jungleNine(fieldNow(), px, py);
      return nine ? { nine, hidden: !!hidden, canopy: graht ? jungleNine(canopyNow(), px, py) : null } : null;
    },
    /** How deep in the jungle a scene point stands (m, negative outside; -Infinity far from it). */
    depthAt(x, z) {
      const w = where(x, z);
      const nine = jungleNine(fieldNow(), w.px, w.py);
      return nine ? jungleDepthAt(w.px, w.py, nine, w.lx, w.lz) : -Infinity;
    },
    /** BANTHA2: WHETHER THE JUNGLE'S FLOOR CLAIMS a scene point - its own draw (jungleFloorDraw, of its world place) under
     *  the layout's share there (jungleShare): a floor plant stands there and no meadow grass does (scenes/
     *  jungleFloorHost.js). Asked a grass blade at a time - one scratch, nothing made. */
    floorClaims(x, z) {
      const w = where(x, z);
      // the placer asks a cell's blades in a run, most in one pixel: its 3x3 read once a pixel and a field (AUDIT TESA-BIOME
      // J: the field is made again when the zones' stamp moves - the trace landing - and the old one's 3x3 is not this one's)
      const f = fieldNow();
      if (w.px !== _floor.px || w.py !== _floor.py || f !== _floor.field) { _floor.px = w.px; _floor.py = w.py; _floor.field = f; _floor.nine = jungleNine(f, w.px, w.py, _floorNine); }
      const nine = _floor.nine;
      if (!nine) return false;
      const share = jungleShare(jungleDepthAt(w.px, w.py, nine, w.lx, w.lz));
      return share > 0 && jungleFloorDraw(w.px * PIXEL_M + w.lx, -w.py * PIXEL_M + w.lz) < share;
    },
    /**
     * THE FRAME'S HAZE, before the fog is set: eased toward the eye's share, density and floor; handed to the renderer
     * (setJungleHaze) and the sky (`sky.setHazeSky`); answers the frame's one fog colour - the weather's (`fogColor`, its row
     * `fogRow`) weighed with the haze's. `eye` the scene eye the fog is measured from (the travel view's focus where the
     * renderer holds one); `minute` of the day; `weather` its WEATHER_TYPES name; `wind` [x, z] (unit) or null.
     * @param {{ fogColor: Float32Array, fogRow: any, eye: ArrayLike<number>, dt: number, minute: number, weather: string,
     *   wind?: ArrayLike<number>|null, sky?: any }} f
     */
    haze({ fogColor, fogRow, eye, dt, minute, weather, wind = null, sky = null }) {
      const focus = renderer._focus?.[3] > 0.5 ? renderer._focus : eye;
      _eye[0] = focus[0]; _eye[1] = focus[1]; _eye[2] = focus[2];
      canopyStep(eye, dt);   // VALENWOOD-CANOPY: the trees', before the air's own switch - and from the camera, whose sky it is
      if (!haze) return canopiedOff(fogColor, sky);
      clock += Math.max(0, Math.min(dt, 1));
      const w = where(_eye[0], _eye[2]);
      const nine = jungleNine(fieldNow(), w.px, w.py, _nine);
      const share = nine ? hazeShare(jungleDepthAt(w.px, w.py, nine, w.lx, w.lz)) : 0;
      if (share <= 0 && hs.share < 1e-4) return canopiedOff(fogColor, sky);   // nowhere near the jungle: nothing to ease, nothing to send
      const density = JUNGLE_HAZE.density * hazeDayFactor(minute / 60) * hazeWeatherFactor(weather)
        * hazeDrift(w.px * PIXEL_M + w.lx, -w.py * PIXEL_M + w.lz, clock, wind);
      // AUDIT BANTHA1 HOST-2/HOST-3: THE STATE IN THE WORLD'S FRAME - the eye at its pixel and its place in it, heights
      // less the stream's vertical compensation - so a recentre (x, z or y) moves nothing, and a teleport, a fast travel
      // or a Recall is the jump it is in the world, and snaps; the floor goes back into the scene's frame as it is sent
      const cy = stateOf().compensation[1];
      _abs[0] = w.px * PIXEL_M + w.lx; _abs[1] = _eye[1] - cy; _abs[2] = -w.py * PIXEL_M + w.lz;
      stepHaze(hs, { dt, eye: _abs, share, density, floor: groundUnder(_eye[0], _eye[2], w.px, w.py) + JUNGLE_HAZE.layer - cy });
      hazeUniforms(hs, u);
      u[1] += cy;
      renderer.setJungleHaze(u[4] ? u : null);
      fogColorWith(fogColor, fogRow, u, _eye[1], colour);
      canopied(colour, sky);   // VALENWOOD-CANOPY: the air under the leaves dimmed with them, the sky's horizon with it
      sky?.setHazeSky?.(u[4] ? hazeSkyUniform(colour, u, _eye[1], skyU) : null);
      return u[4] ? colour : fogColor;
    },
    /** AUDIT BANTHA1 HAZE-7: THE EYE UNDER THE SEA (Deep Waters' own fog swapped in this frame) - no air, no haze: the
     *  renderer's, the sky's and the cull's taken off, never stacked on the water's. */
    under(sky = null) { off(null, sky); },
    /** WHETHER THE HAZE HIDES a box this frame - pixel-local `box` ([x0, y0, z0, x1, y1, z1]) at its translation `t`:
     *  every point of it sends less than JUNGLE_HAZE.cull of its light through the haze (world/jungle/jungleHaze.js
     *  hazeHides - AUDIT BANTHA1 HOST-4: the haze alone), read off the uniforms as last sent. */
    hides: hidesBox,
    /** GRAHT1: the graht-oaks' host (scenes/grahtHost.js) - null off the canopy's zones or with `?graht=off`. */
    graht,
    /** VALENWOOD-CANOPY: the canopy's weight this frame, 0..1 - the world host's light leans by it (world/jungle/
     *  jungleCanopy.js canopyLight, canopyKey, canopyMoon); 0 off its zones. */
    get canopy() { return cs.w; },
    /** The haze's uniforms as last sent (render/hazeGlsl.js uJungleHaze) and its eye - the far ring's. */
    get uniforms() { return u; },
    get eye() { return _eye; },
    /** For the tests and the probes. */
    get _state() { return hs; },
  };
}
