// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
//
// BAY-LEFT-GROUND (2026-10-26, bible/03-World/Landforms.md "BAY-LEFT-GROUND"; the audit "no system left behind in the
// Bay", D5): THE LIFT PAST THE BAY. `landformLiftAt` answered 0 off the Bay's 1000 x 500, so a height a record wrote past
// the Bay was in the shaped frame, not DFU's - and a save, a scene cache or an anchor loaded with the Landforms row off
// kept the lift there (AUDIT LANDFORMS C1/B4's own case: a fall of over 100 HP). The lift answers on every pixel of the
// world's grid now, through the place its build stands (the host's `_liftLocationAt`: past the Bay the build's own
// answer), its book kept by the sites past the Bay's generation (D1 moves the ground there as the places land). And the
// FRAME'S LAW IS STAMPED (world/terrain/terrainSampler.js GROUND_FRAME_LAW, RECORD_GROUND_STAMP): a record without it,
// past the Bay, was written under the old law - its height the shaped ground of its day plus its own `off` - so it is put
// into DFU's frame by that day's lift first (`before`: the landforms with the Bay's table alone, the host's
// `landformsHere({ before: true })`), then stood again as any record is: the lift is never put on twice. On the Bay a record was DFU's
// frame already. The law is `recordFrame` (below), run over the lift this host makes.
//
// RELIEF-PEAKS (2026-10-27, bible/03-World/Tamriel.md RELIEF-PEAKS; GROUND_FRAME_LAW 3): DFU'S OWN GROUND MOVED PAST THE
// BAY - its large map is WOODS.WLD's law of the small byte, where it stood a swell about 4.5 (a third of the land's height
// left out). A record written before it past the Bay is in DFU's frame of its day, so it rides its ground's own move
// (`movedAt`: world/landforms.js groundMovedField over today's reader and the one it was written on, tamrielGround.js
// groundBefore) before the lift goes on - its height over the ground kept - and the old law's lift it takes off is the one
// with no ranges (the host's `landformsHere({ before: true })`): the ranges were not there when it was written.
import { DEFAULT_TERRAIN_SCALE, HEIGHTMAP_DIMENSION, STREAMING_TERRAIN_SCALE, TERRAIN_SIZE, GROUND_FRAME_LAW, LIFT_FRAME_LAW } from '../world/terrain/terrainSampler.js';
import { landformLiftField, groundMovedField } from '../world/landforms.js';
import { setLocationTiles } from '../world/terrain/terrainTiles.js';
import { inWorldGrid } from '../world/worldWide/worldGrid.js';   // BAY-LEFT-GROUND: the lift on the world's grid
import { inBay } from '../world/tamriel/tamrielFrame.js';

/** The map pixel under a scene point of the stream's frame (`state`: its origin and its compensation). */
export function framePixelAt(state, x, z) {
  const c = state.compensation;
  return [state.mapOrigin.x + Math.floor((x - c[0]) / TERRAIN_SIZE), state.mapOrigin.y - Math.floor((z - c[2]) / TERRAIN_SIZE)];
}

/**
 * THE FRAME'S LAW - what a record's height is written as and read back as (LANDFORM1, AUDIT LANDFORMS C1/B4,
 * TERRAIN-SCALE1, BAY-LEFT-GROUND D5), over the lift at a scene point (`liftAt(x, z, { before })`, world units; `before`
 * the lift under the frame's old law - the ground past the Bay before its sites), the ground the stream stands
 * (`heightAt`, with the frame's compensation), the frame (`state`: its compensation and its natives) and the Landforms
 * row (`landform`); `bayAt(x, z)` whether a scene point's pixel is the Bay's; RELIEF-PEAKS `movedAt(x, z)` how far DFU's
 * own ground there moved under a record written before GROUND_FRAME_LAW 3 (world units; none, nothing moved).
 * @param {{ landform: boolean, liftAt: (x: number, z: number, o?: { before?: boolean }) => number,
 *   heightAt: (x: number, z: number) => number, state: any, bayAt: (x: number, z: number) => boolean,
 *   movedAt?: ?((x: number, z: number) => number) }} o
 */
export function recordFrame({ landform, liftAt, heightAt, state, bayAt, movedAt = null }) {
  const landformLiftAt = liftAt;
  /** AUDIT LANDFORMS C1/B4: A HEIGHT GOES INTO A RECORD IN DFU'S FRAME. With the row on the ground at (x, z) stands
   *  `landformLiftAt(x, z)` over DFU's, and every exterior height a record carries (the save, the scene cache, the ship's
   *  deck, an anchor, a dungeon's outer camps) is written without it - so a build without the row reads it as it always
   *  read one, and this one puts the lift back on (restandHeight). Written on the landforms' own ground (LANDFORM1's
   *  stamp), a record stood the lift over its ground on any build before: a save loaded on a desktop copy that has not
   *  updated, or after a revert, dropped its character - a fall of over 100 HP from 30% of the land. `y` is
   *  compensation-free, (x, z) scene coordinates. */
  const groundFrameHeight = (y, x, z) => (landform && Number.isFinite(y) ? y - landformLiftAt(x, z) : y);
  /** ...for a record in NATIVE coordinates (a pile, a foe, a guard). */
  const groundFrameNative = (nx, nz, y) => {
    if (!landform) return y;
    const [x, z] = state.localFromWorld(nx, nz);
    return groundFrameHeight(y, x, z);
  };
  // TERRAIN-SCALE1: A HEIGHT WRITTEN UNDER ANOTHER TERRAIN SCALE, STOOD
  // AGAIN ON TODAY'S GROUND. Every exterior height a save (or a scene
  // cache, or an anchor) carries is compensation-free and stood on
  // ground drawn at the scale it was written under - the prefab's 1.5
  // for anything written before the game scene's 1.25 was found. The
  // terrain is linear in the scale (sample * 1539 * scale, a location's
  // levelled ground included), so a point `off` above the ground it was
  // measured on keeps its `off`:
  //     y' = y - ground'(x, z) * (was / now - 1)
  // exact for a body on a hillside, a pile on a floor, a player on a
  // roof or up a tower's stair, wherever the ground under (x, z) is
  // built. Where it is not yet, the ratio stands in (y * now / was),
  // exact for anything that stood ON its ground and a sixth of any
  // height above it off. (x, z) are scene coordinates; `was` absent or
  // equal to today's scale is today's ground, untouched.
  //
  // LANDFORM1: and every record's height is DFU's frame (AUDIT LANDFORMS
  // C1: groundFrameHeight writes it so), so while the Landforms row is on
  // it takes the lift at its own spot (landformLiftAt) back on, beside the
  // scale's arm: on today's ground it is the ground's height there plus
  // its own `off`.
  //
  // BAY-LEFT-GROUND (D5): `frame` the record's frame's law (its `groundFrame`). One written before LIFT_FRAME_LAW, past
  // the Bay, stood the shaped ground of its day (the lift answered 0 there): its height is put into DFU's frame by that
  // day's lift first, so the lift goes on once and its `off` is exact. With the row off it comes as it always came.
  // RELIEF-PEAKS: one written before GROUND_FRAME_LAW (3), past the Bay, rides DFU's own ground's move there - with the row
  // off too: the large map is the kernel's own term, never the row's.
  const restandHeight = (y, x, z, was, frame = null) => {
    const moved = movedAt && Number.isFinite(y) && !(frame >= GROUND_FRAME_LAW) && !bayAt(x, z) ? movedAt(x, z) : 0;
    if ((!(was > 0) || was === STREAMING_TERRAIN_SCALE) && !landform) return y + moved;
    if (!Number.isFinite(y)) return y;
    if (landform && !(frame >= LIFT_FRAME_LAW) && !bayAt(x, z)) y -= landformLiftAt(x, z, { before: true });   // BAY-LEFT-GROUND: the old law's frame past the Bay, into DFU's
    y += moved;   // RELIEF-PEAKS: DFU's frame of its day onto today's
    const now = landform ? landformLiftAt(x, z) : 0;
    const r = was > 0 ? was / STREAMING_TERRAIN_SCALE : 1;
    const h = heightAt(x, z);
    if (Number.isFinite(h)) return y - (h - state.compensation[1] - now) * (r - 1) + now;
    return y * (was > 0 ? STREAMING_TERRAIN_SCALE / was : 1) + now;
  };
  /** TERRAIN-SCALE1: the scale a record without its own stamp was written on - the prefab's, before the stamp. */
  const scaleOf = (stamp) => (stamp > 0 ? stamp : DEFAULT_TERRAIN_SCALE);
  return { groundFrameHeight, groundFrameNative, restandHeight, scaleOf };
}

/** @param {any} host */
export function createGroundFrame(host) {
  const {
    _liftLocationAt, blocks, built, heightAt, heightCell, landform, landformsHere, beyondSites, maps, terrainGen
  } = host;
  /** LANDFORM1: how far the landforms move DFU's ground at a scene point, in world units (world/landforms.js
   *  landformLift - the kernel's own shaped ground less DFU's over the network this thread holds, the cuts with the
   *  lift (AUDIT LANDFORMS B2), over the location rect of the pixel's build, so a town's levelled ground is exact).
   *  What the row puts there, read while it is on. A pixel's field is kept for the next record a save or a load stands
   *  on it - the last LIFT_FIELDS_KEPT pixels asked, the longest unasked let go first (AUDIT LANDFORMS II F3: dropped
   *  whole past eight, a save whose records stood on nine pixels made every field again - a town's is a kernel pass,
   *  146 ms for nine on the main thread and 0.4-0.6 s for sixteen - at every save, online every periodic checkpoint).
   *  AUDIT LANDFORMS B1: the rect is the build's for a pixel not built yet too - the one setLocationTiles will stamp
   *  (tvTownRects' own fallback). A load stands records before their pixels stream in (its camps anywhere in the world, a
   *  neighbour's piles), and the wild lift it took there was up to 203 m off a location's levelled ground (Tamarilyn
   *  Coven; 1,036 of 15,251 locations over a metre at the rect's centre), into a camp that is never stood again.
   *  BAY-LEFT-GROUND (D5): on every pixel of the world's grid; `before` the frame's old law's lift (the landforms with the
   *  Bay's table alone - the ground past the Bay before its sites), for a record written under it. */
  const LIFT_FIELDS_KEPT = 32;   // a town's field is 129 x 129 floats (66 KB): 2 MB at the most
  const _liftFields = new Map();
  /** ...and the rect that build will stamp, kept per pixel while the same place stands there (a spawn's clone is made
   *  afresh at each ask, so a spawn's is asked again - 50 us, against its field's kernel pass) */
  const _liftRects = new Map();
  /** The rect a pixel's build stamps (RELIEF-PEAKS: one law, the lift's and the ground's move's). */
  const liftRectAt = (px, py) => {
    const at = built.get(`${px},${py}`);
    let rect = at ? at.locationRect ?? null : null;
    if (!at) {
      const loc = _liftLocationAt(px, py), had = _liftRects.get(`${px},${py}`);
      if (had && had.loc === loc) rect = had.rect;
      else {
        if (loc?.exterior?.exteriorData && loc.mapTableData) rect = setLocationTiles(loc, maps, blocks, new Uint8Array(128 * 128)) ?? null;
        _liftRects.delete(`${px},${py}`);
        if (_liftRects.size >= LIFT_FIELDS_KEPT) _liftRects.delete(_liftRects.keys().next().value);   // the longest unasked
        _liftRects.set(`${px},${py}`, { loc, rect });
      }
    }
    return rect;
  };
  const landformLiftAt = (x, z, { before = false } = {}) => {
    const [px, py] = framePixelAt(host.state, x, z);
    if (!host.woods || !inWorldGrid(px, py)) return 0;   // BAY-LEFT-GROUND: the world's grid - it was the Bay's 1000 x 500, and 0 past it
    const t = host.state.pixelTranslation(px, py), rect = liftRectAt(px, py);
    // AUDIT LANDFORMS B2: the field follows the cuts, so it is the network's too - made again once the network lands;
    // BAY-LEFT-GROUND: and the sites past the Bay (made again as their places land), or the old law's own ground
    const key = `${px},${py},${rect ? `${rect.xMin},${rect.xMax},${rect.yMin},${rect.yMax}` : '-'},${terrainGen.roads() ? 1 : 0},${before ? 'before' : beyondSites.generation()}`;
    let field = _liftFields.get(key);
    if (field) _liftFields.delete(key);   // asked again: the last to be let go
    else {
      if (_liftFields.size >= LIFT_FIELDS_KEPT) _liftFields.delete(_liftFields.keys().next().value);   // the longest unasked
      field = landformLiftField(host.woods, px, py, rect, HEIGHTMAP_DIMENSION, landformsHere({ before }));
    }
    _liftFields.set(key, field);
    return field((x - t[0]) / heightCell, (z - t[2]) / heightCell) * STREAMING_TERRAIN_SCALE;
  };
  /** RELIEF-PEAKS (GROUND_FRAME_LAW 3): how far DFU's own ground at a scene point moved under a record written before it
   *  (world units: world/landforms.js groundMovedField - today's composed reader against the one with the large map of
   *  before past the Bay's seam), over the rect the pixel's build stamps, so a town's levelled ground moves by its level's
   *  own move. None off the continent's composition. A pixel's field kept as the lift's are. */
  const _movedFields = new Map();
  const groundMovedAt = (x, z) => {
    const [px, py] = framePixelAt(host.state, x, z), woods = host.woods;
    if (!woods?.isTamrielGround || !inWorldGrid(px, py)) return 0;
    const t = host.state.pixelTranslation(px, py), rect = liftRectAt(px, py);
    const key = `${px},${py},${rect ? `${rect.xMin},${rect.xMax},${rect.yMin},${rect.yMax}` : '-'}`;
    let moved = _movedFields.get(key);
    if (moved) _movedFields.delete(key);
    else {
      if (_movedFields.size >= LIFT_FIELDS_KEPT) _movedFields.delete(_movedFields.keys().next().value);   // the longest unasked goes
      moved = groundMovedField(woods, px, py, rect);
    }
    _movedFields.set(key, moved);
    return moved((x - t[0]) / heightCell, (z - t[2]) / heightCell) * STREAMING_TERRAIN_SCALE;
  };
  /** The stream's frame, read live (a load's teleport makes a new origin). */
  const frameNow = { get compensation() { return host.state.compensation; }, localFromWorld: (nx, nz) => host.state.localFromWorld(nx, nz) };
  const law = recordFrame({ landform, liftAt: landformLiftAt, heightAt, state: frameNow, bayAt: (x, z) => inBay(...framePixelAt(host.state, x, z)), movedAt: groundMovedAt });
  return { ...law, landformLiftAt, groundMovedAt };
}
