// @ts-check
// WITCH1 (2026-10-20, the owner: "We should decorate each town with its own lore appropriate decorations"; bible/06-
// Systems/Witches-Festival.md): THE TOWNS DRESSED FOR THE WITCHES' FESTIVAL, each in its own people's way, and a Wyrd
// Sister at a tavern's door wherever one side of it is clear.
//
// THE KITS, by a town's climate and its region's people (formats/mapsTables.js REGION_RACES):
//   HIGH ROCK (Breton): turnip lanterns at the tavern's door, a straw effigy beside it, standing candles at the temples;
//     a house in three a turnip lantern on its step, now and then a skull candle.
//   HAMMERFELL (Redguard - every town of a Redguard region but its swamps and its mountains, and every desert): the
//     ancestors' lights - standing candles at the door, a bowl of fire with skull candles beside it, torches at the
//     temples, candles on the steps.
//   THE MOUNTAINS (the Wrothgarians, the Dragontails): torches on poles, a bonfire with an effigy to burn and a horned
//     skull beside it, skulls on stakes at the houses.
//   THE FENS AND THE JUNGLES (every swamp; the rainforest and the subtropics of a Breton region): ward-staves at the doors
//     and the steps, a bowl of fire between two more.
//   THE HAUNTED WOODLANDS: skull candles at the door, an effigy over a pile of skulls, turnips, skulls and bones at the
//     houses - "the dead do walk tonight" (TEXT.RSC 8387, Tales and Tallows).
// Daggerfall's own flats (TEXTURE.210's lights - each lights the street at night as the town's lanterns do -, 100's
// bones) beside the festival's three painted ones (world/festivalArt.js: the turnip lantern, the effigy, the ward-staff).
//
// WHERE: every tavern's door - a pair either side, the Wyrd Sister on one side and the kit's show piece on the other -,
// every temple's door (a pair), and a house's step where its town and its key choose it (seeded: the same houses on every
// machine). A spot is taken only where it is CLEAR: no wall between it and the door at a body's height (`blocked`, the
// pixel's own collider - scenes/pixelBuild.js asks it) and a pace from every flat and person the town already stands.
//
// PURE. The build (scenes/pixelBuild.js) logs the flats with the town's own, so they batch, light, stand solid (PROP-
// BODIES) and keep through a season's re-skin as the block's flats do, and stands the Wyrd Sisters with the street's
// people (scenes/witchesHost.js presses them). Standing only while the festival's days run (net/festivalLaw.js
// FESTIVALS, by the device's calendar - decoration needs no service). Not a DFU member. Ledger A (THE WITCHES' FESTIVAL).
import { FESTIVAL_ARCHIVE, FESTIVAL_ART } from './festivalArt.js';
import { festivalOpen } from '../net/festivalLaw.js';
import { CLIMATES, REGION_RACES } from '../formats/mapsTables.js';
import { isResidence } from './buildingNames.js';
import { homeCandidate } from '../systems/online/onlineHomes.js';
import { doorFace } from '../systems/siegeField.js';
import { RMB_SIDE } from './locationLayout.js';
import { tileWeight } from './city/cityNavigation.js';

/** The Wyrd Sister's picture: FLATS.CFG's "mysterious woman" (179.2), the covens' own witch, dressed - NUDE-FLATS'
 *  stand-in for the coven's (characters/nudeFlats.js). */
export const WYRD_SISTER_FLAT = Object.freeze({ archive: 179, record: 2 });

/** A piece: its picture and the foot it keeps clear (metres). */
const piece = (/** @type {number} */ archive, /** @type {number} */ record, r = 0.35) => Object.freeze({ archive, record, r });
const TURNIP = piece(FESTIVAL_ARCHIVE, FESTIVAL_ART.turnip, 0.3);
const EFFIGY = piece(FESTIVAL_ARCHIVE, FESTIVAL_ART.effigy, 0.45);
const WARD_STAFF = piece(FESTIVAL_ARCHIVE, FESTIVAL_ART.wardStaff, 0.3);
const BOWL_OF_FIRE = piece(210, 0, 0.55);
const BONFIRE = piece(210, 1, 0.65);
const SKULL_CANDLE = piece(210, 2, 0.25);
const POLE_TORCH = piece(210, 20, 0.25);
const STANDING_CANDLE = piece(210, 21, 0.25);
const HORNED_SKULL = piece(100, 9, 0.55);
const SKULL_PILE = piece(100, 17, 0.75);
const RIBCAGE = piece(100, 18, 0.7);
const WHITE_SKULL = piece(100, 23, 0.2);
const SKULL_STAKE = piece(100, 24, 0.3);
/** A show piece's part: a piece at [along, out] from the show's own spot (metres, along the wall and out from it). */
const at = (/** @type {any} */ p, /** @type {number} */ along, /** @type {number} */ out) => Object.freeze({ ...p, along, out });

/** EACH PEOPLE'S KIT: the pair at a tavern's door, the pair at a temple's, the show piece beside the tavern, and a
 *  house's step - each `[piece, share]`, the share of the town's houses that stand it. */
export const WITCH_KITS = Object.freeze({
  breton: Object.freeze({
    door: TURNIP, temple: STANDING_CANDLE,
    show: Object.freeze([at(EFFIGY, 0, 0), at(TURNIP, 0.8, 0.5), at(TURNIP, -0.8, 0.5)]),
    step: Object.freeze([[TURNIP, 0.32], [SKULL_CANDLE, 0.08]]),
  }),
  redguard: Object.freeze({
    door: STANDING_CANDLE, temple: POLE_TORCH,
    show: Object.freeze([at(BOWL_OF_FIRE, 0, 0), at(SKULL_CANDLE, 0.9, 0.4), at(SKULL_CANDLE, -0.9, 0.4)]),
    step: Object.freeze([[STANDING_CANDLE, 0.3]]),
  }),
  highland: Object.freeze({
    door: POLE_TORCH, temple: POLE_TORCH,
    show: Object.freeze([at(BONFIRE, 0, 0.3), at(EFFIGY, 1.2, -0.1), at(HORNED_SKULL, -1.3, 0.1)]),
    step: Object.freeze([[SKULL_STAKE, 0.28], [TURNIP, 0.1]]),
  }),
  fen: Object.freeze({
    door: WARD_STAFF, temple: STANDING_CANDLE,
    show: Object.freeze([at(BOWL_OF_FIRE, 0, 0), at(WARD_STAFF, 1.0, 0), at(WARD_STAFF, -1.0, 0)]),
    step: Object.freeze([[WARD_STAFF, 0.3], [SKULL_CANDLE, 0.08]]),
  }),
  haunted: Object.freeze({
    door: SKULL_CANDLE, temple: STANDING_CANDLE,
    show: Object.freeze([at(EFFIGY, 0, 0), at(SKULL_PILE, 1.3, 0.4), at(SKULL_STAKE, -1.0, 0)]),
    step: Object.freeze([[TURNIP, 0.3], [WHITE_SKULL, 0.15], [RIBCAGE, 0.08]]),
  }),
});

/** A town's kit's name: by its climate (maps.getClimateIndex - the world's 223..232) and its region's people - the
 *  haunted woods, the mountains and the swamps their own; then a Redguard region's, and every desert, Hammerfell's (its
 *  jungle coast too - Sentinel's own: AUDIT WITCH1 F-M3, three Hammerfell towns in four are subtropical); a Breton
 *  region's rainforest the fens'; the rest High Rock's. Pure. */
export function witchCulture(/** @type {number|null|undefined} */ climateIndex, /** @type {number|null|undefined} */ region) {
  if (climateIndex === CLIMATES.HauntedWoodlands) return 'haunted';
  if (climateIndex === CLIMATES.Mountain || climateIndex === CLIMATES.MountainWoods) return 'highland';
  if (climateIndex === CLIMATES.Swamp) return 'fen';
  if (REGION_RACES[region ?? -1] === 1 || climateIndex === CLIMATES.Desert || climateIndex === CLIMATES.Desert2) return 'redguard';
  if (climateIndex === CLIMATES.Rainforest || climateIndex === CLIMATES.Subtropical) return 'fen';
  return 'breton';
}

/** Where the pieces stand from a door - metres: a door pair beside each jamb and a pace out, the Wyrd Sister and the
 *  show piece further along and out, a step's piece close by its jamb; the heights a wall is looked for at, and the
 *  height a spot is looked down from to the lip over the street (`downFrom`, `lip`: a plinth or a step lower than the
 *  rays); and the room kept round what the town stands (`clear`, a pace) and between the dressing's own pieces (`near`). */
export const WITCH_SPOTS = Object.freeze({
  pairAlong: 0.45, pairOut: 0.5, sisterAlong: 1.3, sisterOut: 1.6, showAlong: 2.6, showOut: 1.7, stepAlong: 0.45, stepOut: 0.45,
  offeringAlong: 0.55, offeringOut: 0.55, offeringFarOut: 1.4, offeringR: 0.5,
  rayFrom: 0.35, rayHeights: Object.freeze([0.5, 1.2]), downFrom: 1.2, lip: 0.08, clear: 0.35, near: 0.1,
});

/** The foot a flat or a person the town already stands keeps, and the Wyrd Sister's own - metres; and the cells what
 *  stands is filed in (wider than any two feet and the clearance between them). */
const TAKEN_R = 0.3;
const SISTER_R = 0.5;
const GRID_M = 4;

/** A small integer mix to [0, 1) - the same on every machine. */
function seeded(/** @type {number[]} */ ...ns) {
  let h = 0x811c9dc5;
  for (const n of ns) { h ^= n >>> 0; h = Math.imul(h, 0x01000193); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; }
  return (h >>> 0) / 4294967296;
}

/** The side of its door a house's step piece stands (1 or -1) - its town's and its key's; a Hearth Offering stands on
 *  the other (scenes/witchesHost.js). Pure. */
export const witchStepSide = (/** @type {number} */ mapId, /** @type {number} */ key) => (seeded(mapId, key, 3) < 0.5 ? -1 : 1);

/** A HOME'S OFFERING SPOT, pixel-local [x, z]: beside its door, on the side its step piece does not take - or, `far`,
 *  out before it. Null for a frame with no door. Pure. */
export function offeringSpot(/** @type {any} */ frame, /** @type {number} */ mapId, /** @type {number} */ key, far = false) {
  const front = doorFront(frame);
  if (!front) return null;
  const side = witchStepSide(mapId, key) * (far ? 1 : -1);
  return front.spot(side * (front.half + WITCH_SPOTS.offeringAlong), far ? WITCH_SPOTS.offeringFarOut : WITCH_SPOTS.offeringOut);
}

/**
 * A DOOR'S FRONT, pixel-local: its middle `c` [x, z], its face `out` and the wall's way `along` (unit [x, z]), its half
 * width, and where a spot `along` the wall and `out` from it lies. Null for a frame with no door. Pure.
 * @param {any} frame
 */
export function doorFront(frame) {
  const f = doorFace(frame);
  if (!f) return null;
  const d = frame.door;
  const half = Math.hypot(d.b[0] - d.a[0], d.b[2] - d.a[2]) / 2;
  const out = [f.out[0] + 0, f.out[1] + 0], along = [0 - out[1], out[0] + 0];   // (+0: never a signed zero)
  return { c: f.at, foot: Math.min(d.a[1], d.b[1]), out, along, half, spot: (/** @type {number} */ s, /** @type {number} */ o) => [f.at[0] + along[0] * s + out[0] * o, f.at[1] + along[1] * s + out[1] * o] };
}

/**
 * A wall between two pixel-local points, through the world's collider - the pixel (`px`, `py`) placed in the scene by
 * `state.pixelTranslation` into one array of its own (never one a ray) - the `blocked` the build hands witchesDressing.
 * @param {{ raycast: (o: number[], d: number[], l: number) => number }} collider
 * @param {{ pixelTranslation: (x: number, y: number, out?: number[]) => ArrayLike<number> }} state @param {number} px @param {number} py
 */
export function colliderBlocked(collider, state, px, py) {
  const t = [0, 0, 0];
  return (/** @type {number[]} */ a, /** @type {number[]} */ b) => {
    state.pixelTranslation(px, py, t);
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(d[0], d[1], d[2]);
    return l > 1e-6 && collider.raycast([a[0] + t[0], a[1] + t[1], a[2] + t[2]], [d[0] / l, d[1] / l, d[2] / l], l) < l;
  };
}

/** A ground tile's side and a block's tiles a row (an RMB's 16 x 16). */
const TILE_M = RMB_SIDE / 16;
/**
 * THE GROUND A PIECE STANDS ON (AUDIT WITCH1 D7): `(x, z) => boolean`, whether a pixel-local point is on a location's
 * dry ground - inside its blocks (outside them the ground is eased away from the street's height) and on no water (the
 * water family DFU's people never walk - world/city/cityNavigation.js tileWeight; a dock, a moat's shallows and a puddle
 * are walked on, and stood on). `blocks` the
 * location's laid blocks (each `{ x, y, dfBlock }` - world/locationLayout.js), `origin` its pixel-local origin. The RMB's
 * rows run against the world's z (world/city/cityNavigation.js setBlockData's flip). Pure.
 * @param {any[]} blocks @param {ArrayLike<number>} origin
 */
export function dryGround(blocks, origin) {
  const at = new Map((blocks ?? []).map((b) => [`${b.x},${b.y}`, b]));
  return (/** @type {number} */ x, /** @type {number} */ z) => {
    const lx = x - origin[0], lz = z - origin[2];
    const bx = Math.floor(lx / RMB_SIDE), by = Math.floor(lz / RMB_SIDE);
    const tiles = at.get(`${bx},${by}`)?.dfBlock?.rmbBlock?.fldHeader?.groundData?.groundTiles;
    if (!tiles) return false;
    const tx = Math.floor((lx - bx * RMB_SIDE) / TILE_M), ty = 15 - Math.floor((lz - by * RMB_SIDE) / TILE_M);
    return tileWeight((tiles[tx]?.[ty]?.textureRecord ?? 0) & 0x3f) !== 0;
  };
}

/**
 * THE TOWN DRESSED: `{ flats, sisters, homes }` while the festival's days run at `nowMs`, else null - `flats` the pieces
 * (`{ archive, record, c }`, pixel-local, standing on `floorY`), `sisters` the Wyrd Sisters as the street's people's flats
 * (scenes/pixelBuild.js stands them as RMBLayout's, each marked `witch: { key }` with its tavern's building key), `homes`
 * each home's Hearth Offering spot by its key ([x, y, z], kept clear of the dressing).
 * `frames` the pixel's building frames (`homeFrames`), `taverns` and `temples` their keys; `mapId` and `climateIndex`,
 * `region` the town's; `blocked(a, b)` whether a wall stands between two pixel-local points; `ground(x, z)` whether a
 * point is ground to stand on (dryGround); `taken` the points the town's flats and people stand at. Pure.
 * @param {DressedTown} town
 */
export function witchesDressing(town) {
  const steps = dressTown(town);
  let r = steps.next();
  while (!r.done) r = steps.next();
  return r.value;
}
/** THE SAME, BREATHING (PERF7): `breathe()` awaited between buildings - a city's thousand rays never one frame's. */
export async function witchesDressingBreathing(/** @type {DressedTown} */ town, /** @type {() => Promise<unknown>} */ breathe) {
  const steps = dressTown(town);
  let r = steps.next();
  while (!r.done) { await breathe(); r = steps.next(); }
  return r.value;
}
/**
 * @typedef {{ frames: Map<number, any>|null, taverns?: number[], temples?: number[], mapId?: number, climateIndex?: number|null,
 *   region?: number|null, floorY?: number, nowMs?: number, blocked?: (a: number[], b: number[]) => boolean,
 *   ground?: (x: number, z: number) => boolean, taken?: Iterable<ArrayLike<number>> }} DressedTown
 */
/** The dressing, a building a step (witchesDressing runs it whole, witchesDressingBreathing breathes between). */
function* dressTown(/** @type {DressedTown} */ { frames, taverns = [], temples = [], mapId = 0, climateIndex = null, region = null, floorY = 0, nowMs = Date.now(), blocked = () => false, ground = () => true, taken = [] }) {
  if (!frames?.size || !festivalOpen(nowMs)) return null;
  const kit = WITCH_KITS[witchCulture(climateIndex, region)];
  const S = WITCH_SPOTS;
  // what stands, filed in GRID_M cells - a city's thousands of flats, each spot asking only the nine cells about it
  /** @type {Map<string, number[][]>} [x, z, r, the room kept round it] */
  const grid = new Map();
  const cell = (/** @type {number} */ x, /** @type {number} */ z) => `${Math.floor(x / GRID_M)},${Math.floor(z / GRID_M)}`;
  const file = (/** @type {number} */ x, /** @type {number} */ z, /** @type {number} */ r, /** @type {number} */ room = S.near) => {
    const k = cell(x, z);
    let list = grid.get(k);
    if (!list) grid.set(k, (list = []));
    list.push([x, z, r, room]);
  };
  for (const p of taken) if (p && Number.isFinite(p[0]) && Number.isFinite(p[2])) file(p[0], p[2], TAKEN_R, S.clear);
  const flats = [], sisters = [];
  /** Whether a spot is clear for a foot `r`: on the ground, no wall from the door's front to it, nothing under it above
   *  the street, a pace from what stands. */
  const clear = (/** @type {any} */ front, /** @type {number[]} */ xz, /** @type {number} */ r) => {
    if (!ground(xz[0], xz[1])) return false;
    const gx = Math.floor(xz[0] / GRID_M), gz = Math.floor(xz[1] / GRID_M);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        for (const [x, z, q, room] of grid.get(`${gx + i},${gz + j}`) ?? []) if (Math.hypot(xz[0] - x, xz[1] - z) < r + q + room) return false;
      }
    }
    // from before the door at its own foot (a door up steps looks over them) to the spot's far edge, so a piece is
    // never half in a wall
    const from = front.spot(0, S.rayFrom), fromY = Math.max(floorY, Number.isFinite(front.foot) ? front.foot : floorY);
    const dx = xz[0] - from[0], dz = xz[1] - from[1], l = Math.hypot(dx, dz) || 1;
    for (const h of S.rayHeights) if (blocked([from[0], fromY + h, from[1]], [xz[0] + (dx / l) * r, floorY + h, xz[1] + (dz / l) * r])) return false;
    // and looked down on at its middle and at its edge nearest the door, so a piece never stands sunk in a house's plinth
    // or its steps, which the rays pass over (AUDIT WITCH1 G1: a turnip lantern half in a Daggerfall house's base)
    const tx = front.c[0] - xz[0], tz = front.c[1] - xz[1], tl = Math.hypot(tx, tz) || 1;
    for (const [x, z] of [xz, [xz[0] + (tx / tl) * r, xz[1] + (tz / tl) * r]]) if (blocked([x, floorY + S.downFrom, z], [x, floorY + S.lip, z])) return false;
    return true;
  };
  const stand = (/** @type {any} */ front, /** @type {any} */ p, /** @type {number} */ s, /** @type {number} */ o) => {
    const xz = front.spot(s, o);
    if (!clear(front, xz, p.r)) return false;
    file(xz[0], xz[1], p.r);
    flats.push({ archive: p.archive, record: p.record, c: [xz[0], floorY, xz[1]] });
    return true;
  };
  const pair = (/** @type {any} */ front, /** @type {any} */ p) => { for (const s of [-1, 1]) stand(front, p, s * (front.half + S.pairAlong), S.pairOut); };
  for (const key of taverns) {
    const front = doorFront(frames.get(key));
    if (!front) continue;
    pair(front, kit.door);
    // the Wyrd Sister on her side (the house's own roll), the show on the other - each tried on the far side if refused
    const first = seeded(mapId, key, 1) < 0.5 ? -1 : 1;
    let side = 0;
    for (const s of [first, -first]) {
      const xz = front.spot(s * (front.half + S.sisterAlong), S.sisterOut);
      if (!clear(front, xz, SISTER_R)) continue;
      file(xz[0], xz[1], SISTER_R);
      sisters.push({
        archive: WYRD_SISTER_FLAT.archive, record: WYRD_SISTER_FLAT.record, x: xz[0], y: floorY, z: xz[1],
        factionID: 0, flags: 0, rawX: 0, rawY: 0, rawZ: 0, recordPosition: key, witch: Object.freeze({ key }),
      });
      side = s;
      break;
    }
    for (const s of side ? [-side] : [first, -first]) {
      const base = s * (front.half + S.showAlong);
      let any = false;
      for (const p of kit.show) any = stand(front, p, base + s * p.along, S.showOut + p.out) || any;
      if (any) break;
    }
    yield;
  }
  for (const key of temples) {
    const front = doorFront(frames.get(key));
    if (front) pair(front, kit.temple);
    yield;
  }
  // EVERY HOME'S OFFERING SPOT, kept before a step is stood - the near side where it is clear, else out before the door
  /** @type {Map<number, number[]>} */
  const homes = new Map();
  for (const [key, f] of frames) {
    if (!homeCandidate({ buildingType: f?.type, factionId: f?.faction ?? 0, buildingKey: key })) continue;
    const front = doorFront(f);
    for (const far of front ? [false, true] : []) {
      const xz = offeringSpot(f, mapId, key, far);
      if (!xz || !clear(front, xz, S.offeringR)) continue;
      file(xz[0], xz[1], S.offeringR);
      homes.set(key, [xz[0], floorY, xz[1]]);
      break;
    }
    yield;
  }
  for (const [key, f] of frames) {
    if (!isResidence(f?.type)) continue;
    const roll = seeded(mapId, key, 2);
    let edge = 0;
    const p = kit.step.find((pick) => roll < (edge += /** @type {number} */ (pick[1])))?.[0];
    const front = p ? doorFront(f) : null;
    if (front) { stand(front, p, witchStepSide(mapId, key) * (front.half + S.stepAlong), S.stepOut); yield; }
  }
  return { flats, sisters, homes };
}
