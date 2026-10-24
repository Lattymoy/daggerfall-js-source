// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PRECIP4 (2026-10-19, the owner: "If its snowing in one area and raining in the next, the transition should be seamless
// both in ground texture and everything else. This needs to be accurate and as detailed as possible") - THE SNOW ON THE
// GROUND, about the player: a module the world host wires (HOST-SPLIT, bible/01-Overview/Host-Split.md: scenes/fishHost.js
// is the shape), never grown into bootWorld. bible/07-Rendering/Biome-Precipitation.md is the record.
//
// DFU dresses the whole world in its winter archive on the calendar (TerrainMaterialProvider's +1, the climate swaps'
// winter textures, the nature sets' winter records - climateSwaps.js) and the streaming host re-skins every pixel at the
// flip (world.js tickSeason). On the SNOW LANE (`owns`: the enhanced lane's precipitation law - weatherSim.js
// precipLawOn) the ground keeps what fell instead (systems/weather/snowpack.js), read here into a window of SNOWLINES
// about the player - a lattice point every two pixels' corners - and handed to:
//   - THE GROUND: the frame's lines, one small texture every terrain fragment reads at its own place (`frame()`,
//     renderer.js setSnowFrame, render/snowCoverGlsl.js), and its set's TWIN (`arrayOf`, `winterOf`: its summer records
//     and its winter ones, one array), so each fragment of ground wears its own climate's winter tile in the share of the
//     snow at its own height (SNOW-FACE: a steep face's too - render/snowCoverGlsl.js SNOW_GROUND): a white peak over a
//     green valley, a snowline wandering with the weather, a thaw's patches, the jungle's rain stopping at the snow;
//   - THE BUILD: a pixel's buildings, its town's climate swaps and its windmills wear the season of the snow at its
//     middle, and each of its trees and plants the season of the snow at its own foot against a draw of its own
//     (`flatDraw`) - across a snowline the woods whiten tree by tree, never a pixel's square at once. Read off the snow
//     as it lay at the last step of the pack's grid (the `build` lines - pure in the place and the minute, the same on
//     every client: AUDIT PRECIP HOST-8), and every decision kept on the pixel as it was taken (`recorder`);
//   - THE SWEEP: a standing pixel any one of whose decisions the snow now takes otherwise (`sweep`, at every step of the
//     grid and every lattice cell the window moves; the frame's walked a slice a frame within the snow's budget -
//     SNOW-SWEEP) is re-skinned where it stands - every one due, nearest first, a pump's turn each
//     (world/seasonReskin.js `skin`, scenes/pixelBuild.js reskinPixelNow: AUDIT PRECIP HOST-7 - its season's parts made
//     again, never the pixel torn down);
//   - THE PLAYER'S FEET AND THE GRASS: whether snow lies where they stand, as the ground draws it (`winterAt`, `buries`:
//     render/snowCoverGlsl.js snowCoverAt, the fragment's own cover on the CPU).
// One clock (`now`): the frames, a build's wait and the feet all read the snow at one minute (AUDIT PRECIP HOST-2: a fast
// travel's arrival is the arrival's minute while the trip's own time has not yet run). Off the lane every answer is
// DFU's: the season the host holds, the set as it is, no snow in the draw.
import { SnowpackLattice, snowlineOf, coverAtHeight, latticeKey, yearOriginOf, SNOWPACK } from '../systems/weather/snowpack.js';
import { SEA_LEVEL_M } from '../systems/weather/airTemperature.js';
import { TERRAIN_SIZE as PIXEL_M } from '../world/terrain/terrainSampler.js';
import { getTerrainGroundArchive, groundIsSnowy, SEASON } from '../world/climateSwaps.js';
import { ecoOrigin } from '../world/ecotone.js';
import { snowCoverAt, SNOW_TILE_ROW0 } from '../render/snowCoverGlsl.js';

/**
 * THE HOST'S NUMBERS. `spacing` the lattice's (map pixels: 1.6 km - the snowline's field is smooth over that, its fall's
 * systems tens of kilometres across) and `radius` its points either side of the player's (five: ten pixels, the land
 * view's six and the blend's corners past them); `budgetMs` a frame's integration while the player plays and `arriveMs`
 * while the world stands up about them (no ground under their feet yet); `nowMinutes` how often the pack now is read
 * again for the frames (game minutes - the cover moves over hours); `ease` the seconds a shown line takes to reach a new
 * one (the line walks with the weather, never jumps; a point first read shows its own); `winter` the cover a pixel's
 * buildings wear winter from. SNOW-BUDGET: `frameMs` - the asks within that much of the clock of the first of them are
 * one frame's, and share its budget (createSnowCoverHost's `budgetFor`).
 */
export const SNOW_COVER = Object.freeze({
  spacing: 2,
  radius: 5,
  budgetMs: 3,
  arriveMs: 40,
  nowMinutes: 5,
  ease: 0.6,
  winter: 0.5,
  frameMs: 12,
});
/** The PLACE-LRU key of a ground set's twin (renderer.js uploadTileArray: its summer records, then its winter ones). */
export const twinKey = (summer) => `twin:${summer}`;
/** A flat's own draw against the cover at its foot (0..1) - its place's hash, so a tree is snowy or not alike on every
 *  client, and the trees across a snowline go white in a scatter. Pure. */
export function flatDraw(px, py, x, z) {
  let h = (Math.imul(px, 0x27d4eb2d) ^ Math.imul(py, 0x165667b1) ^ Math.imul(Math.round(x * 8), 0x9e3779b1) ^ Math.imul(Math.round(z * 8), 0x85ebca6b)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x846ca68b) >>> 0; h ^= h >>> 16;
  return 0.15 + 0.7 * ((h >>> 8) / 16777216);   // never at the ends: a whole cover whitens every tree, none leaves them all
}
/** Two ground sets as one twin's layers (AUDIT PRECIP GROUND-2: the twin IS the set on the lane, uploaded once):
 *  `summer`'s records, then `winter`'s - each at the larger set's size (the smaller's texels repeated, nearest: a texture
 *  pack's sets may differ), their alphas (their puddles) their own. Pure. */
export function twinLayers(summer, winter) {
  const w = Math.max(summer[0].width, winter[0].width), h = Math.max(summer[0].height, winter[0].height);
  const fit = (l) => {
    if (l.width === w && l.height === h) return l;
    const colors = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      const sy = Math.floor((y * l.height) / h);
      for (let x = 0; x < w; x++) {
        const sx = Math.floor((x * l.width) / w), o = (y * w + x) * 4, i = (sy * l.width + sx) * 4;
        colors[o] = l.colors[i]; colors[o + 1] = l.colors[i + 1]; colors[o + 2] = l.colors[i + 2]; colors[o + 3] = l.colors[i + 3];
      }
    }
    return { width: w, height: h, colors };
  };
  return [...summer.map(fit), ...winter.map(fit)];
}

/**
 * @param {{ renderer: any, climateAt: (px: number, py: number) => number, mapHeight: number, stateOf: () => any,
 *   builtOf: () => Map<string, any>, owns: () => boolean,
 *   markReskin: (key: string) => void, markRebuild: (key: string) => void, now: () => number, place?: () => { px: number, py: number }, arriving?: () => boolean,
 *   clock?: () => number }} deps
 *   `climateAt` the map's climate index; `stateOf()` the stream's state and `builtOf()` its pixels (asked, never held);
 *   `owns()` whether the snow lane runs (weatherSim.js precipLawOn - the enhanced
 *   lane's law, with a host that handed the air its map); `markReskin(key)` the snow's re-skin of one pixel in place (world.js
 *   _reskin.skin - AUDIT PRECIP HOST-7); `markRebuild(key)` one pixel torn down and built again (world.js _reskin.mark -
 *   LANE-TURN, below); `now()` THE ONE CLOCK - the event minute the snow is read at; `place()` the player's pixel, for a build
 *   that asks before the first frame (`settle`); `arriving()` whether the world is still standing up (no ground under the
 *   player) - a build's wait then takes the arrival's budget (SNOW_COVER.arriveMs); `clock()` the frames' budget's clock
 *   (performance.now's - SNOW-BUDGET). OW-HITCH's `normalOf` (the drawn ground's normal, for the slope's shed) went with
 *   SNOW-FACE's slope: the snow reads no normal and no height.
 */
export function createSnowCoverHost({ renderer, climateAt, mapHeight, stateOf, builtOf, owns, markReskin, markRebuild, now, place = null, arriving = null, clock = () => performance.now() }) {
  const lattice = new SnowpackLattice({ climateAt, spacing: SNOW_COVER.spacing });
  const S = SNOW_COVER.spacing, R = SNOW_COVER.radius, SIDE = 2 * R + 1, STEP = SNOWPACK.stepMinutes;
  /** each window point's snowlines: `target` the pack now's, `shown` eased toward it (the frames'), `build` the pack's at
   *  the last step of the grid (the builds'); by lattice key, for the window's points alone (AUDIT PRECIP PACK-5: a point
   *  that leaves the window is let go, and one that comes back is read as new - it was shown as it stood weeks before) */
  let lines = new Map();
  let window = [], centre = null, ready = false, nowRead = null, buildAt = null, gen = 0, buildGen = 0, sweptGen = -1, winT = -Infinity;
  /** the lane as the last frame read it; null until the first frame - asked of `owns` itself till then (a boot's builds) */
  let on = null;
  const lane = () => (on ?? !!owns());
  /** the standing pixels already sent to be built again for being built under the other lane (AUDIT PRECIP HOST-N1;
   *  LANE-TURN, FIELD BUGS 2026-10-21: REBUILT, never re-skinned - a lane's ground is its own archive (the summer set on
   *  the lane, DFU's season off it: `groundArchive`) and a re-skin never touches the terrain, so pixelBuild.js
   *  reskinPixelNow refuses both turns - one built off the lane keeps no `_skin`, and off it the snow is not `on`. Sent to
   *  the skin, every pixel standing at a turn wore the other lane's ground until it streamed out: in a winter, turned off
   *  the lane, its summer grass) */
  const turned = new WeakSet();
  const _pack = new Float32Array(SNOWPACK.levels.count), _line = [0, 0, 0];
  const tex = new Float32Array(SIDE * SIDE * 4);
  const out = { lines: tex, side: SIDE, origin: [0, 0], anchor: [0, 0], spacing: S * 128, altitude: 0, gen: 0 };
  const _t = [0, 0, 0];
  let texGen = -1, texI = NaN, texJ = NaN;

  /** The window about map pixel (px, py) at event minute `t`: the lattice's points (2 radius + 1)^2 about the nearest,
   *  each held for `t` (snowpack.js point: made, or made again for another year or a clock set behind it). AUDIT PRECIP
   *  HOST-N4: the centre is compared by index, and no point is made only to ask. */
  const windowAbout = (px, py, t) => {
    const [ci, cj] = lattice.indexOf(px, py);
    const moved = !centre || centre[0] !== ci || centre[1] !== cj;
    if (moved) {
      centre = [ci, cj];
      const keep = new Map();
      for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) { const k = latticeKey(ci + i, cj + j), l = lines.get(k); if (l) keep.set(k, l); }
      lines = keep;
      nowRead = null; buildAt = null; ready = false;
    }
    // the points asked again where the time may have turned a point's year or set the clock behind it
    if (!moved && window.length && t >= winT && yearOriginOf(t) === window[0].origin) { winT = t; return; }
    winT = t;
    window.length = 0;
    for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) window.push(lattice.point(ci + i, cj + j, t));
  };
  /** A point's lines at `t` - `target` off its pack now (the blend of its two step packs), `build` off its pack at the
   *  last step of the grid (`t` on the grid: its newer pack, else its older) - the first read's `shown` its own. */
  const readNow = (pt, t) => {
    const k = latticeKey(pt.i, pt.j);
    let l = lines.get(k);
    if (!l) lines.set(k, (l = { target: new Float32Array(3), shown: null, build: new Float32Array(3) }));
    snowlineOf(lattice.packNow(pt, t, _pack), _line, pt.n);
    l.target[0] = _line[0]; l.target[1] = _line[1]; l.target[2] = _line[2];
    snowlineOf(t >= pt.step ? pt.swe : pt.prev, _line, pt.n);
    l.build[0] = _line[0]; l.build[1] = _line[1]; l.build[2] = _line[2];
    if (!l.shown) l.shown = Float32Array.from(l.target);
  };
  /** SNOW-BUDGET (2026-10-20, a player via the owner: "something about our weather system affecting fps"): ONE BUDGET A
   *  FRAME, WHOEVER ASKS. The frame's tick, the feet (`winterAt`, three a frame) and the Snowfall mod's winter
   *  (`winterNear`) each integrated the window for a budget of its own - and while a window caught up its year each ran a
   *  whole step at the least (snowpack.js advance), four steps a frame. Now the asks within SNOW_COVER.frameMs of the
   *  first of them share one budget, the largest any of them asks (the tick's, or the arrival's): each spends what is
   *  left of it. A build's wait (`settle`) keeps the breather's own. `clock` performance.now's. */
  let spendFrom = -Infinity, spent = 0;
  const budgetFor = (ms) => {
    const w = clock();
    if (w - spendFrom >= SNOW_COVER.frameMs) { spendFrom = w; spent = 0; }
    return Math.max(0, ms - spent);
  };
  /**
   * THE SNOW AT `t` (AUDIT PRECIP HOST-1): the window about pixel (px, py) integrated to it within `budgetMs` (SNOW-BUDGET:
   * the frame's, shared - `force`, a build's wait, its own), and - once it stands there - its lines read at `t` whenever
   * they were read at another minute: `force` at once, the frames every SNOW_COVER.nowMinutes. Answers whether the window
   * stands at `t` and (`force`) was read there.
   */
  function at(px, py, t, budgetMs, force) {
    windowAbout(px, py, t);
    if (force) ready = lattice.advance(window, t, budgetMs, clock);
    else {
      const w0 = clock();
      ready = lattice.advance(window, t, budgetFor(budgetMs), clock);
      spent += clock() - w0;
    }
    if (!ready) return false;
    if (nowRead === null || t < nowRead || t - nowRead >= (force ? 1e-9 : SNOW_COVER.nowMinutes)) {
      nowRead = t;
      for (const pt of window) readNow(pt, t);
      const b = Math.floor(t / STEP) * STEP;
      if (b !== buildAt) { buildAt = b; buildGen++; }
    }
    return !force || nowRead === t;
  }
  const lineOf = (i, j, which) => lines.get(latticeKey(i, j))?.[which] ?? BARE_LINE;
  /** The line at field (x, z) - the lattice's bilinear between the four points about it (render/snowCoverGlsl.js
   *  snowLine, term for term: points on pixel corners, so a pixel lies inside one cell - AUDIT PRECIP HOST-5); `which`
   *  'shown' (the frames'), 'target' or 'build'. A point not read is bare ground. `out` [h10, h50, h90]. */
  function lineAt(x, z, out = [0, 0, 0], which = 'shown') {
    const fi = x / PIXEL_M / S, fj = (mapHeight - z / PIXEL_M) / S;
    const i0 = Math.floor(fi), j0 = Math.floor(fj), u = fi - i0, v = fj - j0;
    const a = lineOf(i0, j0, which), b = lineOf(i0 + 1, j0, which), c = lineOf(i0, j0 + 1, which), d = lineOf(i0 + 1, j0 + 1, which);
    for (let k = 0; k < 3; k++) out[k] = (a[k] * (1 - u) + b[k] * u) * (1 - v) + (c[k] * (1 - u) + d[k] * u) * v;
    return out;
  }
  const _l = [0, 0, 0];
  /** Field metres of a pixel-local point. */
  const fieldOf = (px, py, lx, lz) => [px * PIXEL_M + lx, (mapHeight - 1 - py) * PIXEL_M + lz];
  /** The cover at field (x, z) and `altitude` metres above the sea off the `which` lines (0..1, before the ground's
   *  patches). */
  const coverAt = (x, z, altitude, which = 'shown') => (lane() ? coverAtHeight(lineAt(x, z, _l, which), altitude) : 0);
  /** The ground's cover as it is DRAWN at pixel (px, py)'s local (lx, lz), `altitude` m above the sea
   *  (render/snowCoverGlsl.js snowCoverAt: its patches with it - AUDIT PRECIP GROUND-3). SNOW-FACE: no slope, so the
   *  stream's heights are never asked (SNOW-BUDGET had read them only under snow: four a blade the grass placed). */
  const drawnCover = (px, py, lx, lz, altitude) => {
    const [x, z] = fieldOf(px, py, lx, lz), [ox, oz] = ecoOrigin(px, py);
    return snowCoverAt(coverAtHeight(lineAt(x, z, _l), altitude), lx, lz, ox, oz);
  };
  /** A pixel's buildings' season and a flat's, as the snow at the last step of the grid takes them. */
  const seasonFor = (px, py, altitude) => {
    const [x, z] = fieldOf(px, py, PIXEL_M / 2, PIXEL_M / 2);
    return coverAt(x, z, altitude, 'build') >= SNOW_COVER.winter ? SEASON.Winter : SEASON.Summer;
  };
  const flatFor = (px, py, lx, lz, altitude, draw) => {
    const [x, z] = fieldOf(px, py, lx, lz);
    return coverAt(x, z, altitude, 'build') >= draw ? SEASON.Winter : SEASON.Summer;
  };
  /** SNOW-SWEEP (2026-10-23, after OW-HITCH's re-measure: "spread snowCoverHost's sweep across frames under the snow
   *  budget"): THE SWEEP IN HAND. The frame's sweep checked every flat of every standing pixel in one frame - 40-70 ms
   *  on an i9 at each lattice cell the window moved, the most frequent hitch of a fast Overworld journey. Now a sweep is
   *  begun (the standing pixels the snow dresses, nearest first) and walked to a deadline: each pixel found due is
   *  re-skinned as it is found, so the nearest are still the first marked. `sweepKeys` null when none is in hand. */
  let sweepKeys = null, sweepAt = 0, sweepFlat = 0, sweepSnow = null;
  /** How many flats a sweep checks between two reads of its deadline (a forest pixel stands thousands). */
  const SWEEP_FLATS_A_READ = 64;
  const beginSweep = () => {
    const state = stateOf(), cx = state.current?.x ?? 0, cy = state.current?.y ?? 0;
    const order = [];
    for (const [key, p] of builtOf()) if (p._snow) order.push([Math.hypot(p.px - cx, p.py - cy), key]);
    order.sort((a, b) => a[0] - b[0]);
    sweepKeys = order.map(([, key]) => key); sweepAt = 0; sweepFlat = 0; sweepSnow = null;
  };
  /** The sweep in hand carried on until the clock reads `deadline` - at least one pixel's first flats each call, so a
   *  frame with no budget left still moves it. A pixel let go meanwhile is passed; one built again is checked from its
   *  first flat. Answers the keys found due (each already sent to `markReskin`). */
  const sweepUntil = (deadline) => {
    const found = [];
    while (sweepKeys && sweepAt < sweepKeys.length) {
      const key = sweepKeys[sweepAt], s = builtOf().get(key)?._snow;
      if (s !== sweepSnow) { sweepSnow = s; sweepFlat = 0; }
      let turnedNow = false;
      if (s) {
        if (sweepFlat === 0 && s.pixel) turnedNow = seasonFor(s.px, s.py, s.pixel.altitude) !== s.pixel.season;
        for (let i = sweepFlat; !turnedNow && i < s.flats.length; i += 5) {
          turnedNow = (flatFor(s.px, s.py, s.flats[i], s.flats[i + 1], s.flats[i + 2], s.flats[i + 3]) === SEASON.Winter ? 1 : 0) !== s.flats[i + 4];
          // the rest of a pixel past the deadline is the next call's, from the flat it stopped before
          if (!turnedNow && (i / 5) % SWEEP_FLATS_A_READ === SWEEP_FLATS_A_READ - 1 && i + 5 < s.flats.length && clock() >= deadline) { sweepFlat = i + 5; return found; }
        }
      }
      sweepAt++; sweepFlat = 0; sweepSnow = null;
      if (turnedNow) { markReskin(key); found.push(key); }
      if (clock() >= deadline) break;
    }
    if (sweepKeys && sweepAt >= sweepKeys.length) sweepKeys = null;
    return found;
  };

  return {
    /** Whether the snow lane runs - read once a frame by `tick` (asked of the lane itself before the first). */
    get on() { return lane(); },
    /** Whether the window about the player is integrated to now. */
    get ready() { return ready; },
    /**
     * THE FRAME: the window about the player's pixel (px, py) integrated to the clock's minute
     * within the frame's budget (`arriving` - no ground under the player yet - the larger), its lines read every
     * SNOW_COVER.nowMinutes and the shown lines eased over `dt` seconds; then, at every new step of the grid (and every
     * lattice cell the window moves), the standing pixels swept - a slice a frame, within what the frame's snow budget
     * has left, while the window stands (SNOW-SWEEP: a window that moves meanwhile begins it again once it stands, on
     * the lines it then reads). And the lane asked again: a pixel built under the other lane (the "Weather as places" or the
     * enhanced environments' switch turned mid-game - AUDIT FB1021 L1-1 - or a build in flight across the turn) is built
     * again (LANE-TURN) - a turn onto the lane once the window stands.
     */
    tick({ px, py, dt = 0, arriving = false }) {
      on = !!owns();
      const t = now();
      if (on && Number.isFinite(t)) at(px, py, t, arriving ? SNOW_COVER.arriveMs : SNOW_COVER.budgetMs, false);
      // AUDIT FB1021 L1-1: a turn ONTO the lane rebuilds once the window stands - every standing pixel goes down at once (the
      // classic flip's teardown), and a rebuild's `settle` integrated a cold window in the breather's frame slices
      // meanwhile (~2.6 s of work: seconds with no ground). Till then each stands in DFU's season, as it was built
      if (!on || ready) for (const [key, p] of builtOf()) if (p._snow !== undefined && (p._snow !== null) !== on && !turned.has(p)) { turned.add(p); markRebuild(key); }
      if (!on || !Number.isFinite(t)) return;
      // ease the window's shown lines toward their targets (the snowline moving with the weather walks, never jumps)
      const k = Math.min(1, dt / SNOW_COVER.ease);
      let moved = false;
      for (const l of lines.values()) {
        if (!l.shown) continue;
        for (let q = 0; q < 3; q++) {
          const d = l.target[q] - l.shown[q];
          if (Math.abs(d) < 0.5) { if (d) { l.shown[q] = l.target[q]; moved = true; } continue; }
          l.shown[q] += d * k; moved = true;
        }
      }
      if (moved) gen++;
      if (ready && buildGen !== sweptGen) { sweptGen = buildGen; beginSweep(); }
      if (ready && sweepKeys) {
        const w0 = clock();
        sweepUntil(w0 + budgetFor(arriving ? SNOW_COVER.arriveMs : SNOW_COVER.budgetMs));
        spent += clock() - w0;
      }
    },
    /**
     * THE BUILD WAITS FOR THE SNOW: a pixel built before the window about the player stands at the clock's minute would
     * stand in another minute's season and wait for the sweep. On the lane the window about `place()` is integrated to
     * `now()` in the breather's own slices (`breather.left()` - AUDIT PRECIP HOST-N2) and read there - every time it is
     * asked at another minute (AUDIT PRECIP HOST-1: it answered at once for a window read at ANY minute, so a Recall
     * after an evening indoors, or a load, built the player's pixel in the snow of the minute they left). Builds read
     * the `build` lines, which no ease delays.
     */
    async settle(breather) {
      if (!lane() || !place) return;
      const { px, py } = place();
      if (!Number.isFinite(now())) return;
      // AUDIT PRECIP DOC-7: while the world stands up (`arriving` - no ground under the player: the boot, an arrival) the
      // snow takes the arrival's budget, as the frame's own tick does - a year's history and the summer before it at a
      // mountain's window is two seconds of work, and the boot's breath of a frame made it seven
      // FIELD BUGS 2026-10-21b SNOW-YEAR: each pass reads the clock's minute as it is - the frame's tick integrates the same
      // window to it between passes, and a minute held from the first pass across the snow year's turn (its midsummer)
      // asked another year's lattice than the tick: the two reset each other's points and the build waited for good
      while (!at(px, py, now(), arriving?.() ? Math.max(SNOW_COVER.arriveMs, breather.left()) : breather.left(), true)) await breather.breathe();
    },
    lineAt,
    coverAt,
    /** THE FRAME'S SNOW for the renderer (renderer.js setSnowFrame - AUDIT PRECIP GROUND-7): the window's shown lines as
     *  one texture's texels (rows south), its first point's world tile (the ecotone's frame) and the scene point it
     *  stands at now (`anchor` [x, z]: the frame a snow lying on the ground reads it in - GROUND-9), the lattice's spacing
     *  in tiles, the world height's offset to metres above the sea; null off the lane or before the window is read. */
    frame() {
      // AUDIT SNOW-BUDGET F2: the window's KEPT lines are drawn while it catches up after a move - a step of a lattice
      // cell (two map pixels) let every point but its new edge's keep its lines, and the frame drew no snow at all until
      // the window stood at the clock's minute again (0.4-1.2 s of summer ground, every two pixels walked; the Snowfall
      // mod's winter the calendar's meanwhile). A point not read yet is bare ground (lineOf), as it always was
      if (!lane() || !centre || !lines.size) return null;
      const i0 = centre[0] - R, j0 = centre[1] - R;
      if (texGen !== gen || texI !== i0 || texJ !== j0) {
        for (let j = 0; j < SIDE; j++) {
          for (let i = 0; i < SIDE; i++) {
            const l = lineOf(i0 + i, j0 + j, 'shown'), o = (j * SIDE + i) * 4;
            tex[o] = l[0]; tex[o + 1] = l[1]; tex[o + 2] = l[2]; tex[o + 3] = 0;
          }
        }
        texGen = gen; texI = i0; texJ = j0; out.gen++;
      }
      // the corner's world tile: the north-west corner of pixel (i0 S, j0 S) - its first tile north is (row0 - py) x 128,
      // its north edge a pixel on (world/ecotone.js ecoOrigin)
      out.origin[0] = i0 * S * 128; out.origin[1] = (SNOW_TILE_ROW0 + 1 - j0 * S) * 128;
      const state = stateOf(), tr = state.pixelTranslation(i0 * S, j0 * S, _t);   // that pixel's south-west corner; the point its north-west
      out.anchor[0] = tr[0]; out.anchor[1] = tr[2] + PIXEL_M;
      out.altitude = -(state.compensation[1] + SEA_LEVEL_M);
      return out;
    },
    /** A STANDING PIXEL'S DRAW: its first world tile (the ecotone's frame) - the one per-draw fact its snow needs; null
     *  off the lane. */
    drawOf(p) {
      if (!lane() || !p) return null;
      return (p._snowTile ??= Int32Array.from(ecoOrigin(p.px, p.py)));
    },
    /** THE TILE ARRAY a pixel's ground draws with for its summer archive `a`: on the lane its twin where it has one (its
     *  summer records are the first half - the water and the shadow pass read them as they read the set). */
    arrayOf(a) {
      if (a == null) return null;
      return (lane() ? renderer.tileArrays.get(twinKey(a)) : null) ?? renderer.tileArrays.get(a) ?? null;
    },
    /** THE BUILD'S GROUND for a climate: on the lane its summer archive (the twin dresses its winter), else DFU's for the
     *  host's `season`. */
    groundArchive(climate, season) { return getTerrainGroundArchive(climate, lane() ? SEASON.Summer : season); },
    /** THE WINTER a climate's ground set takes into its twin on the lane (its winter archive, loaded with its summer into
     *  one array - AUDIT PRECIP GROUND-2), null for one that wears none (a desert's - TerrainMaterialProvider's guard) or
     *  off the lane. */
    winterOf(climate) {
      return lane() && groundIsSnowy(climate, SEASON.Winter) ? getTerrainGroundArchive(climate, SEASON.Winter) : null;
    },
    /**
     * A BUILD'S SNOW, kept as it decides (AUDIT PRECIP HOST-6): `pixel(altitude, season)` its buildings' season (the snow
     * at its middle's ground, `altitude` m above the sea - winter from SNOW_COVER.winter), `flat(lx, lz, altitude, season)`
     * a flat's (the snow at its foot against its own draw), both off the snow at the last step of the grid, and the host's
     * `season` off the lane; `done(usesSeason)` what the sweep compares - every decision as taken (the buildings' only
     * where the pixel stands any that wear a season), or null off the lane.
     */
    recorder(px, py) {
      const flats = [], laneOn = lane();
      let pixel = null;
      return {
        pixel(altitude, season) {
          if (!laneOn) return season;
          pixel = { altitude, season: seasonFor(px, py, altitude) };
          return pixel.season;
        },
        flat(lx, lz, altitude, season) {
          if (!laneOn) return season;
          const draw = flatDraw(px, py, lx, lz), s = flatFor(px, py, lx, lz, altitude, draw);
          flats.push(lx, lz, altitude, draw, s === SEASON.Winter ? 1 : 0);
          return s;
        },
        done(usesSeason) {
          return laneOn ? { px, py, pixel: usesSeason ? pixel : null, flats: Float32Array.from(flats) } : null;
        },
      };
    },
    /** THE SWEEP, whole and at once: every standing pixel the snow now dresses otherwise than its build did - its
     *  buildings' season, or any one flat's - re-skinned, nearest first (AUDIT PRECIP HOST-3: all of them; HOST-7: in
     *  place, a pump's turn each). A pixel that stands nothing the snow dresses (the open sea) is never due (HOST-6).
     *  The frame's own sweep is the same walk a slice a frame (`tick` - SNOW-SWEEP); this one takes over any in hand. */
    sweep() {
      if (!lane()) return [];
      beginSweep();
      return sweepUntil(Infinity);
    },
    /** Whether a sweep is in hand (SNOW-SWEEP) - for the tests and the probes. */
    get sweeping() { return sweepKeys !== null; },
    /** WHETHER THE SNOW BURIES a grass blade's root at pixel-local (`lx`, `lz`) of standing pixel `p`, at scene height
     *  `y` - its own, the placer's (AUDIT PRECIP HOST-9) - the ground as drawn there (its cover and its patches) reaching
     *  the blade's own draw (flatDraw): a meadow thins into the snow the ground shows. False off the lane. (AUDIT FB1021
     *  L1-8: its scene x and z went with the slope, which alone read them.) */
    buries(p, lx, lz, y) {
      if (!lane()) return false;
      const c = drawnCover(p.px, p.py, lx, lz, y - stateOf().compensation[1] - SEA_LEVEL_M);
      return c > 0 && c >= flatDraw(p.px, p.py, lx, lz);
    },
    /** WHETHER SNOW LIES under the player at scene point `pos` - the ground as drawn there past a half: on the lane the
     *  snow's (the window read at the clock's minute first - AUDIT PRECIP HOST-N5: the feet step before the frame's
     *  tick), else `fallback` (DFU's word). The footsteps'. */
    winterAt(pos, fallback) {
      if (!lane() || !pos) return fallback;
      const state = stateOf(), c = state.compensation;
      const px = state.mapOrigin.x + Math.floor((pos[0] - c[0]) / PIXEL_M), py = state.mapOrigin.y - Math.floor((pos[2] - c[2]) / PIXEL_M);
      const t = now();
      if (Number.isFinite(t) && nowRead !== t) at(px, py, t, SNOW_COVER.budgetMs, false);
      const tr = state.pixelTranslation(px, py, [0, 0, 0]);
      return drawnCover(px, py, pos[0] - tr[0], pos[2] - tr[2], pos[1] - c[1] - SEA_LEVEL_M) >= 0.5;
    },
    /** WHETHER SNOW LIES ABOUT THE PLAYER for what keeps a winter of its own - the Snowfall mod's `winter` (its gate, its
     *  snowpack; a change resets its depths and its tracks): AUDIT PRECIP GROUND-9 - on the lane, whether the snow lies on
     *  any ground the window about the player holds (a point's zero-cover height under its cell's highest drawn ground:
     *  SnowpackLattice's `ceil`), so the mod stands wherever its tiers can find snow and lays it only where the ground
     *  wears it (render/snowCoverGlsl.js snowLaid on its surface); it was the player's own spot (HOST-4: the feet's test,
     *  a turn at every step across the line, then the pixel's middle), and the mod's snow covered a green field from a
     *  white one. The window read at the clock's minute first (indoors no frame ticks it); `fallback` off the lane or
     *  before the window is read (DFU's season). */
    winterNear(fallback) {
      if (!lane()) return fallback;
      const t = now();
      if (place && Number.isFinite(t) && nowRead !== t) { const { px, py } = place(); at(px, py, t, SNOW_COVER.budgetMs, false); }
      if (!centre || !lines.size) return fallback;   // AUDIT SNOW-BUDGET F2: the lines the window kept across a move answer while it catches up - not the calendar's
      for (const pt of window) {
        const l = lines.get(latticeKey(pt.i, pt.j))?.shown;
        if (l && l[0] - 0.25 * Math.max(1, l[1] - l[0]) < pt.ceil) return true;
      }
      return false;
    },
    /** The season the feet tread (Immersive Footsteps' climate step): winter where snow lies under them (winterAt), else
     *  the host's season with its winter taken off - the footsteps follow the snow, not the calendar; the host's off the
     *  lane. */
    footSeason(pos, season) {
      if (!lane()) return season;
      return this.winterAt(pos, season === SEASON.Winter) ? SEASON.Winter : season === SEASON.Winter ? SEASON.Summer : season;
    },
    /** For the tests and the probes. */
    get _lattice() { return lattice; },
    get _window() { return window; },
    get _lines() { return lines; },
  };
}
/** Bare ground's snowline: never under the highest level. */
const BARE_LINE = Object.freeze([SNOWPACK.levels.from + SNOWPACK.levels.step * SNOWPACK.levels.count, SNOWPACK.levels.from + SNOWPACK.levels.step * SNOWPACK.levels.count, SNOWPACK.levels.from + SNOWPACK.levels.step * SNOWPACK.levels.count]);
