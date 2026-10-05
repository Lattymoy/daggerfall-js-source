// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DECOR1d (2026-09-25) — THE DECORATOR, AS THE ROOM'S HOST RUNS IT.
//
// Mac: "A UI element that can be clicked to open the decorate panel.
// Allows free cam mode for placement and an intuitive scrolling menu
// with filters"; decor "Gold per placement", priced "By size"; online
// and offline ("kept in the save"). This is the part that joins them:
// the button stands where the player may decorate, the panel lists the
// catalogue the scan reads out of the game's own blocks, and a piece
// chosen is placed from a FREE CAMERA - the body stands still, the eye
// flies, the piece stands where the eye meets a surface - and paid for.
//
// THE FREE CAMERA is not a window: the room keeps running and the mouse
// keeps looking (the pointer stays locked). Every key PRESS is the
// decorator's while it flies - taken before the host sees it, so the
// body is handed no movement and a swing, a spell or a door never fires
// under a placement - and the decorator reads each press as the action
// it is bound to (the controls registry's, rebindable): the walk keys
// move the eye (Jump up, Crouch down, Run faster) within forty metres of
// where it began, Turn Left/Right turn the piece, Float Up/Down lift it,
// Interact places it and Escape goes back. A key's RELEASE is left to
// the host, so a key held into the flight is let go of there. A window
// that opens over the flight (a message, a death) suspends it until the
// window goes. A press while the pointer is NOT locked (the browser
// freed it) only takes the pointer back, as every host's click does; it
// never places.
//
// PAYING: the price is the law's (net/decorLaw.js decorPrice, by the
// piece's measured size and scale), paid from the purse and then the
// region's bank account, as HOME1's homes are. An ONLINE home writes
// first - the account service is the room's truth - and pays once the
// service has it, with the gold asked again after the answer (HOME1's
// buyOnlineHome order): short then, the piece is taken back out. The
// offline house or ship pays and stands the piece at once; the room's
// scene carries it into the save (scenes/decorRoom.js, DECOR1c). A
// room holds DECOR_CAP pieces either way.
//
// DECOR1e - THE ROOM'S OWN PIECES. The panel's "In this room" view
// lists what stands; a piece chosen there is MOVED by the same flight
// (from its own turn and scale - free, or a resize's difference paid or
// half given back), LIT or put out, made to HOLD THINGS or not, or
// REMOVED for half of what it cost - never one that holds anything,
// which would take what it holds with it. On a TOUCH SCREEN the stick
// flies the eye (its analog throw read over the walk keys it presses
// too, and the body handed none of it), the bar's Fly up and Fly down
// are held as Jump and Crouch are, and a tap or a swipe does nothing
// under the flight - the bar's Place places.
//
// DECOR2a - THE PLAYER'S OWN THINGS. The panel's "Your things" lists
// what in the pack can stand (systems/decorItems.js); one is set down
// by the same flight, free, as its own world picture, and the thing
// itself leaves the pack into the room's keeping (by the piece's id) -
// online only once the account service has the piece. "Take down" puts
// it back in the pack, whole. Moved or resized it stays free.
//
// DECOR2b - THE FURNISHER'S FURNITURE. What the Furniture Store sold is
// delivered, never carried (systems/decorFurnish.js), and listed among
// "Your things". A pillow stands as its own picture; any other piece is
// set down as whichever of Daggerfall's own pieces of its kind the
// owner picks in the panel's look view - the look's shape, the
// furniture's own name and numbers, free. Taken down, it is delivered
// again: back among "Your things", never the pack.
//
// DECOR2c - THE MOUNTS. A weapon or a piece of armour among "Your things" is
// HUNG: the flight sets it flat on the surface the eye meets (the ray's
// own normal - scenes/decorRoom.js frames it), the turn spins it there,
// and the ghost is the picture itself, hanging where it will hang. No
// surface in reach, nothing to hang it on.
//
// HOME-DOORS (2026-09-30) - A DOOR IN A DOORWAY. A catalogue door
// (systems/decorDoorways.js) is never set down where the eye meets a
// surface: the house's doorways are found (the room finder's links,
// looked across), every free one is MARKED on the decal pass - green,
// and the one the eye looks at gold - and the door is fitted whole into
// the one looked at, a turn swinging it the other way. The bar says how
// many are free while none is looked at, or that the house has none.
// A door put in, moved or taken out changes the house's rooms, which are
// found again.
// ═══════════════════════════════════════════════════════════════════

import { createDecorScan } from '../systems/decorScan.js';
import { decorModsLive, DECOR_MODS_LIVE_S } from '../systems/decorMods.js';   // AUDIT 05b A3: the mods' pieces offered while they stand
import { createDecorRooms } from '../systems/decorRooms.js';   // DECOR-ROOMS: a house's rooms, found in its own walls
import { createDecorDoorways, decorDoorwaysFree, decorDoorwayAimed, decorDoorFit, decorDoorwayQuad, decorIsDoor } from '../systems/decorDoorways.js';   // HOME-DOORS
import { writeDecalQuad, clearDecalQuad, DECAL_FLOATS } from '../combat/bloodDecals.js';   // HOME-DOORS: the doorways' marks, on the decal pass
import { rentRoomsView, rentAnchorOfRoom } from '../systems/homeRent.js';   // HOME-RENT: the owner's rooms, offered to rent
import { goldSum, EMPIRE_ACCOUNT_WORDS } from '../systems/homeWords.js';   // AUDIT HOME-PRICE E4: the rent's sums and account, as the door says them
import { createDecorPlacer, DECOR_TURN_STEP, DECOR_TURN_FINE, DECOR_RAISE_STEP, DECOR_RAISE_FINE } from '../systems/decorPlacer.js';
import { createDecorButton, createDecorPanel, createDecorBar, decorWhyNot } from '../ui/decorPanel.js';
import { DECOR_CAP, DECOR_PRICE_PER_METRE, DECOR_HIDDEN_CAP, decorPrice, decorPieceOf, decorRefund, decorRescale, mintDecorId, DECOR_STATIONS, DECOR_STATION_FEES, DECOR_STATION_NAMES } from '../net/decorLaw.js';
import { decorKey, DECOR_KINDS, decorFlatLight, modelKind, flatKind, decorRoomEntries } from '../systems/decorCatalogue.js';
import { decorOwnEntry, decorItemName, decorMountDye, decorMountDyeTarget } from '../systems/decorItems.js';
import { decorFurnishingEntry, isFurnishing } from '../systems/decorFurnish.js';
import { itemLongName } from '../systems/itemInfo.js';
import { decorMatrix, decorKeyOf, loadMountPicture, decorMountQuad, decorMountFloats, DECOR_MODEL_RETRY_MS, MW_STAND_ARCHIVE } from './decorRoom.js';
import { decorIsMount, decorFlatMirrored } from '../net/decorLaw.js';
import { SEAT_HALL_TEXT } from '../net/townSeatLaw.js';   // SEAT-HALL: the Charter Room's rule, in its words
import { forgeOffered, PROF_STATIONS, stationColdLine } from '../ui/profPages.js';   // AUDIT 29 B2; PROF4: the workbench too
import { VENDOR_STATION, VENDOR_COLD_LINE } from '../net/vendorLaw.js';   // HOME-VENDOR: a trader, sold only where it trades
/** HOME-STATIONS: an online home whose service does not keep a station yet (one from before this) - said, and nothing paid. */
export const DECOR_STATION_UNKEPT = 'Your home could not keep a station yet - nothing was paid.';
/** AUDIT HOME-STATIONS S2: the gold went while the station was being made (spent elsewhere mid-write) - nothing paid. */
export const DECOR_STATION_GOLD_WENT = 'Your gold ran short while the station was being made - nothing was paid.';
import { localAabb, transformedAabb } from '../render/frustum.js';
import { billboardSize } from '../world/rmbFlats.js';
import { lookAt, perspective, mirrorProjectionX, trs, multiply } from '../world/mat4.js';
import { isTextEntryTarget } from '../ui/input.js';
import { walletReserve } from '../net/realmGoldLaw.js';   // MARKET-AUDIT: a refusal gives back exactly what the payment took
import { drawnFlat } from '../characters/nudeFlats.js';   // NUDE-DECOR: a nude figure shows its clothed stand-in while Show Nudity is off

/** The free camera's pace, metres a second; Run's pace; and how far it may go from where it began. */
export const DECOR_FLY_SPEED = 3;
export const DECOR_FLY_FAST = 7;
export const DECOR_FLY_LEASH = 40;
/** How far the eye looks for a surface; with none, the piece hangs this far ahead. */
export const DECOR_EYE_REACH = 12;
export const DECOR_FLOAT_AT = 3;
/** The preview's turn, degrees a second. */
export const DECOR_PREVIEW_SPIN = 30;
/** How long the service's refusal of a placement stays on the bar, milliseconds. */
export const DECOR_REFUSAL_MS = 4000;
/** RENT-FRESH (FIELD BUGS 2026-10-01): how old the owner's rooms may grow while the rooms view is up before they are read
 *  again, milliseconds - a tenant pays at the door while the owner stands in the house. */
export const RENT_VIEW_FRESH_MS = 30_000;
/** DECOR2c: what the bar says while a mount has nothing to hang on. */
export const DECOR_MOUNT_NO_SURFACE = 'Look at a wall to hang it on.';
/** HOME-DOORS: what the bar says while a door is being placed - the doorways still being found, none in the house, or
 *  how many are free while none is looked at. */
export const DECOR_DOOR_FINDING = 'Finding the doorways...';
/** HOME-DOORS (AUDIT): how far short of a doorway's middle a wall may be met and the doorway still seen - half the
 *  deepest wall a doorway is found in (systems/decorDoorways.js DOORWAY_DEPTH_MAX). */
export const DOOR_SIGHT_SPARE = 0.6;
export const DECOR_DOOR_NONE = 'This house has no open doorway for a door.';
/** HOME-DOORS (AUDIT): what the bar says when the free doorways are all wider than the door can close. */
export const DECOR_DOOR_TOO_WIDE = 'The free doorways here are too wide for this door to close.';
export const decorDoorAimLine = (n) => `Look at a marked doorway to hang the door (${n} free) - turn to swing it the other way.`;
/** HOME-DOORS: the most doorways marked at once, and their marks' colours - a free one, and the one looked at. */
export const DECOR_DOOR_MARKS = 32;
export const DECOR_DOOR_MARK_FREE = Object.freeze([0.35, 1, 0.45, 0.55]);
export const DECOR_DOOR_MARK_AIMED = Object.freeze([1, 0.8, 0.3, 0.85]);
/** HOME-DOORS: the mark's picture - a bright frame round a faint fill, sixteen texels square. */
export function decorDoorMarkPixels(size = 16) {
  const colors = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const edge = x < 2 || y < 2 || x >= size - 2 || y >= size - 2;
      const o = (y * size + x) * 4;
      colors[o] = colors[o + 1] = colors[o + 2] = 255;
      colors[o + 3] = edge ? 255 : 90;
    }
  }
  return { width: size, height: size, colors };
}
/** HOME-YARD: the lot's marked edge, a soft blue - never a doorway's green. */
export const DECOR_LOT_MARK = Object.freeze([0.45, 0.75, 1, 0.5]);
/** FB1001 ROAD-LOT: the most bands the lot's edge is marked in - four sides, and the road's sides where it cuts in. */
export const DECOR_LOT_MARKS = 64;
/** DECOR1e: the light a piece with none of its own is given when the owner lights it - a warm lamp's. */
export const DECOR_DEFAULT_LIGHT = Object.freeze({ color: Object.freeze([1, 0.85, 0.6]), range: 6, intensity: 1 });

/** DECOR1e: A PLACED PIECE'S CHANGE, priced - moved or turned it is free; resized, the law's difference (decorRescale:
 *  grown, paid; shrunk, half back). DECOR2a: the player's own item is free whatever is done to it. */
export function decorEditPrice(radius, was, scale) {
  if (was?.item) return { pay: 0, refund: 0, paid: 0 };
  return decorRescale(radius, was.paid, scale);
}
/** What a placed piece's change says on the bar: free, what it costs, or what comes back. */
export const decorEditText = ({ pay, refund }) => (pay > 0 ? `${pay} gold` : refund > 0 ? `${refund} gold back` : 'free');

/** DECOR2b: ONE'S FURNITURE SET DOWN AS A LOOK - the catalogue piece's shape, the furniture's own name and numbers, free;
 *  never the look's light or holding (a piece of one's own holds nothing - net/decorLaw.js). */
export const decorLookEntry = (furn, look) => ({
  key: furn.key, kind: 'own', own: furn.own, furnishing: true, name: furn.name, item: furn.item, count: furn.count,
  model: look.model ?? null, flat: look.flat ?? null, light: null, storage: false, look: look.key,
});

/** The actions whose keys, held, fly the eye - the decorator keeps their state itself (the host never sees them). */
export const DECOR_FLY_ACTIONS = Object.freeze(['MoveForwards', 'MoveBackwards', 'MoveLeft', 'MoveRight', 'Jump', 'Crouch', 'Run']);
/** The keys no action is bound to by default, which the decorator keys by code: the size, and the grid. */
export const DECOR_FREE_KEYS = Object.freeze({ Minus: 'smaller', Equal: 'bigger', Slash: 'grid' });

/** The eye's direction for a yaw and pitch - the host's own (worldModes.js eyeDir). */
export const lookDir = (yaw, pitch) => [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];

/**
 * ONE STEP OF THE FREE CAMERA: forward along the look (pitch and all - it flies where it looks), sideways along the
 * motor's own right (player/motor.js: (cos, 0, -sin)), up and down, no faster on a diagonal, and never further than
 * the leash from `start`.
 */
export function flyStep(pos, start, { forward = 0, strafe = 0, rise = 0 }, yaw, pitch, speed, dt) {
  const f = lookDir(yaw, pitch);
  const v = [f[0] * forward + Math.cos(yaw) * strafe, f[1] * forward + rise, f[2] * forward - Math.sin(yaw) * strafe];
  const len = Math.hypot(v[0], v[1], v[2]);
  if (!(len > 0) || !(dt > 0)) return pos;
  const k = (speed * dt) / Math.max(1, len);
  const next = [pos[0] + v[0] * k, pos[1] + v[1] * k, pos[2] + v[2] * k];
  const d = [next[0] - start[0], next[1] - start[1], next[2] - start[2]];
  const dl = Math.hypot(d[0], d[1], d[2]);
  if (dl <= DECOR_FLY_LEASH) return next;
  const s = DECOR_FLY_LEASH / dl;
  return [start[0] + d[0] * s, start[1] + d[1] * s, start[2] + d[2] * s];
}

/** DECOR-SHELL: how far off a face the flying eye is kept - past the near plane (0.05), so no face near it is cut open
 *  in front of it. AUDIT DECOR-SHELL 1: measured from the face (flyKeep's push), not along the step. */
export const DECOR_FLY_SKIN = 0.2;
/** AUDIT DECOR-SHELL 1: the most pushes flyKeep makes before it refuses a step; and the give of its look, a hair
 *  inside the skin - never the push's own radius, where two faces pushing the eye back and forth (a gap) can cancel to
 *  a look that moves nothing. */
export const DECOR_FLY_PUSHES = 3;
export const DECOR_FLY_GIVE = 1e-3;

/**
 * AUDIT DECOR-SHELL 1: THE END OF A STEP, KEPT OFF THE FACES. `at`, where flyClip's cut and slide leave a step from
 * `from`, is pushed out of every face within DECOR_FLY_SKIN, as a sphere of the skin - the body's own push
 * (player/collider.js _resolveSphere), through the buckets in `skip` - until a look a hair inside the skin moves
 * nothing, and answered; or `from` when the eye cannot stand there: a gap narrower than twice the skin (pushed off one
 * side, it stands against the other) or a corner the pushes cannot clear, or an end a ray from `from` does not reach
 * (a push carried it across a face). A still eye is left where it is.
 */
function flyKeep(collider, from, at, skip) {
  if (!(Math.hypot(at[0] - from[0], at[1] - from[1], at[2] - from[2]) > 1e-9)) return at;
  let end = at;
  if (typeof collider._resolveSphere === 'function') {
    const through = skip ? new Set(skip) : null;
    const pushed = (q, radius) => {
      const was = [q[0], q[1], q[2]];
      collider._resolveSphere(q, radius, {}, Infinity, false, false, through);
      return q[0] !== was[0] || q[1] !== was[1] || q[2] !== was[2];
    };
    const p = [at[0], at[1], at[2]];
    if (pushed(p, DECOR_FLY_SKIN)) {
      for (let i = 1; pushed([p[0], p[1], p[2]], DECOR_FLY_SKIN - DECOR_FLY_GIVE); i++) {
        if (i >= DECOR_FLY_PUSHES) return from;
        pushed(p, DECOR_FLY_SKIN);
      }
      end = p;
    }
  }
  const e = [end[0] - from[0], end[1] - from[1], end[2] - from[2]];
  const reach = Math.hypot(e[0], e[1], e[2]);
  if (!(reach > 1e-9)) return end;
  let hit = null;
  try { hit = collider.raycastHit(from, [e[0] / reach, e[1] / reach, e[2] / reach], reach, skip ? { skip } : null); } catch { hit = null; }
  return hit && Number.isFinite(hit.dist) && hit.dist <= reach ? from : end;
}

/** AUDIT2 DECOR-SHELL 8: whether `q` is within a world box `b` ([minX, minY, minZ, maxX, maxY, maxZ]) grown by
 *  DECOR_FLY_SKIN - near enough a piece that flyKeep pushes it, or inside it. */
const inSkin = (q, b) => [0, 1, 2].every((i) => q[i] >= b[i] - DECOR_FLY_SKIN && q[i] <= b[i + 3] + DECOR_FLY_SKIN);

/**
 * DECOR-SHELL (2026-09-26, a player over the house: "They are there / But its model disappearing / Placing models is
 * different then the ones after"): THE EYE STAYS IN THE ROOM. The free camera flew through walls, floor and ceiling -
 * nothing but the leash held it - and the room's faces are one-sided, so from outside the room it was an open
 * dollhouse: a piece set on the ceiling's top or behind a wall looked placed in the room from up there, and was gone
 * from the body's own eye, still listed, still solid, still named through the ceiling. A step from `from` to `to` is
 * cut DECOR_FLY_SKIN short of the first face of the room's collider across it (either side: the collider is
 * two-sided), and what is left of it slides along that face, once, cut the same way. `skip` the buckets the eye looks
 * through (a piece being moved).
 *
 * AUDIT DECOR-SHELL 1: THE SKIN IS KEPT FROM THE FACE. The cut is DECOR_FLY_SKIN back along the step, which a step at
 * a shallow angle to the face leaves only DECOR_FLY_SKIN x sin(angle) off it - 3.5 mm gliding along the floor looking
 * a degree down, 1.7 cm flying along a wall turned 5 degrees to it (39% of the screen past it) - and once under 1e-4
 * the ray (player/collider.js rayTriangle) no longer met that face, so the next step went through it: under the floor,
 * where a model aimed up hung from the floor's underside. Where the step ends, flyKeep keeps the eye off every face.
 */
export function flyClip(collider, from, to, skip = null) {
  if (!collider?.raycastHit) return to;
  const cut = (a, b) => {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const len = Math.hypot(d[0], d[1], d[2]);
    if (!(len > 1e-9)) return { at: b, normal: null, rest: null };
    const dir = [d[0] / len, d[1] / len, d[2] / len];
    let hit = null;
    try { hit = collider.raycastHit(a, dir, len + DECOR_FLY_SKIN, skip ? { skip } : null); } catch { hit = null; }
    if (!hit || !Number.isFinite(hit.dist) || hit.dist - DECOR_FLY_SKIN >= len) return { at: b, normal: null, rest: null };
    const k = Math.max(0, hit.dist - DECOR_FLY_SKIN);
    const at = [a[0] + dir[0] * k, a[1] + dir[1] * k, a[2] + dir[2] * k];
    return { at, normal: Array.isArray(hit.normal) ? hit.normal : null, rest: [b[0] - at[0], b[1] - at[1], b[2] - at[2]] };
  };
  const first = cut(from, to);
  if (!first.normal) return flyKeep(collider, from, first.at, skip);
  // the rest slides along the face - its part into the face taken away (the normal faces the eye)
  const n = first.normal, r = first.rest;
  const into = r[0] * n[0] + r[1] * n[1] + r[2] * n[2];
  const slide = [r[0] - n[0] * into, r[1] - n[1] * into, r[2] - n[2] * into];
  return flyKeep(collider, from, cut(first.at, [first.at[0] + slide[0], first.at[1] + slide[1], first.at[2] + slide[2]]).at, skip);
}

/** DECOR1e: A STICK'S READING ({x: strafe right +, y: forward +} - the finger's analog stick or the pad's, the host's
 *  stickAxes) as the flight's forward and strafe, each within one; null with no stick in hand. */
export function stickMove(a) {
  const unit = (v) => (Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);
  return a ? { forward: unit(a.y), strafe: unit(a.x) } : null;
}

/**
 * The surface point the eye meets, or the point it hangs at when it meets none - `collider.raycastHit` (the room's
 * own, player/collider.js), within DECOR_EYE_REACH. DECOR1e: `skip` the collider's buckets the eye looks through - a
 * piece being moved is never a surface for itself. DECOR2c: `eyeHit` answers the surface's `normal` there too (the
 * ray's own, facing the eye), or null when the eye met none.
 */
export function eyeHit(collider, eye, dir, skip = null) {
  let d = DECOR_FLOAT_AT;
  let normal = null;
  try {
    const hit = collider?.raycastHit ? collider.raycastHit(eye, dir, DECOR_EYE_REACH, skip ? { skip } : null) : null;
    if (hit && Number.isFinite(hit.dist)) { d = hit.dist; normal = Array.isArray(hit.normal) ? [...hit.normal] : null; }
  } catch { /* no surface to meet */ }
  return { point: [eye[0] + dir[0] * d, eye[1] + dir[1] * d, eye[2] + dir[2] * d], normal };
}
export const eyePoint = (collider, eye, dir, skip = null) => eyeHit(collider, eye, dir, skip).point;

/**
 * THE TOOL. `deps` (the host's - worldModes.js):
 *   doc, win, canvas, touch
 *   renderer         - drawMesh, panelFrame, createBillboardBatch, destroyBillboardBatch
 *   pool             - the room's placed pieces (scenes/decorRoom.js)
 *   names            - the host's Map of hover names by piece key, filled once the catalogue is read
 *   room()           - where the player may decorate now: { kind: 'home'|'house'|'ship', where, mapId?, buildingKey?, hall? }
 *                      (GUILD1d: `hall` - a guild's hall, an online home its keepers furnish),
 *                      or null
 *   base()           - BASE-HIDE: the room's own furniture, piece by piece (scenes/decorBase.js), or null
 *   scanDeps()       - systems/decorScan.js's deps (the blocks, the two measures)
 *   getGpuMesh(id), cpuModels, getTexture(a), uploadRecord(a, r, opts), iconUrl(a, r) - the pipeline's, and the DOM's
 *                      door (DECOR2c: uploadRecord's icon arm and the renderer's decal pass draw the mount's ghost)
 *   collider(), origin() - the room's collider and this visit's building origin; eye() - the camera's eye now
 *   stick()          - the analog stick's reading, or null (DECOR1e: the host's stickAxes - the finger's or the pad's)
 *   actionOf(e)      - the action a key event is bound to, or null (ui/input.js actionOf, the registry's)
 *   locked()         - whether the pointer is locked to the canvas; cursorOff() - put away a cursor the player freed
 *                      (Enter), so the look can lock again when a placement begins
 *   now()            - the clock, milliseconds
 *   wallet()         - { gold, pay(n), credit(n) } - paid from the purse, then the region's bank; given back to the purse
 *   pack(), identity() - DECOR2a: the items carried, and who carries them (a worn item's picture reads the body)
 *   furnishings()    - DECOR2b: the furniture delivered and standing nowhere
 *   packHas(item), packTake(item), packGive(item) - whether it is still carried; one of it out of the pack (the
 *                      moved record, as a drop moves it - or null); an item back in (DECOR2b: furniture, to the
 *                      deliveries - where it lives)
 *   homeDecor, character() - the account service's door and the character that writes (online homes)
 *   visit()          - the host's visit token (a room left between a write and its answer is not stood in)
 *   openSlot(o), closeSlot(o) - put the panel in the room's overlay slot, and take it out
 *   say(line), refusal(word) - a line to the player; the account service's refusal as a sentence
 *   doorsHere()      - HOME-DOORS: where the room's own doors stand (world points), so a doorway one hangs in is taken
 *   walls            - HOME-DOORS: the collider's filter for the room's walls alone (`{ only: [...] }`) - the doorways are
 *                      openings in its walls, never gaps between its furniture; null reads every bucket
 *   rent()           - HOME-RENT: an online home's rooms, through the service (worldModes.js decorRentDoor) - `rooms()`,
 *                      `offer({ room, anchor, price })`, `withdraw({ room })`, `collect()`, `changed()` - or null (not an
 *                      online home of the player's own)
 *   placeOk(piece)   - HOME-YARD: why a piece cannot stand where the ghost shows it (off the lot), or null; lot() - the
 *                      lot's edge as decal quads, marked while a piece is placed; yardCap - a yard's own cap. A `room()`
 *                      with `yard` is a home's yard (scenes/homeYards.js): no doors, nothing held, no light
 *   look()           - HOME-LOOK: the painter's door for the house outside - `{ current, season, preview(look), commit(look) }`
 *                      - or null
 *   flatAs(flat)     - DECOR-OUTDOOR: the picture a flat is here, [archive, record] - a yard's nature in its season
 *                      (scenes/homeYards.js); none, the flat itself
 *   flatPicture(flat) - DECOR-LPT: the picture a flat the host stands its own way WILL stand as (a yard's tree - its Low
 *                      Poly Trees picture, its season's: scenes/yardNature.js picture), a Promise of `{ archive, key,
 *                      size, mirrors, release }` at scale 1 (`release` lets go of what it holds - called when the ghost
 *                      goes), or null (none: the flat's own picture, as ever)
 *   prepareModel(gpu) - AUDIT 05b A5: the host's own law over a model before the decorator draws it with the host's table
 *                      (a yard's: its town's climate swaps written into the table its pieces draw with - scenes/homeYards.js
 *                      climateOf), a Promise or nothing; none, drawn at once
 */
export function createDecorTool(deps) {
  const { renderer, pool } = deps;
  /** NUDE-DECOR, DECOR-OUTDOOR: THE PICTURE A FLAT DRAWS HERE - the host's (a yard's tree in its season), and a nude figure's
   *  clothed stand-in while Show Nudity is off - what the room stands it as, so what the ghost and the lists show. */
  const drawnHere = (flat) => drawnFlat(...(deps.flatAs?.(flat) ?? flat));
  /** @type {any} */ let button = null;
  /** @type {any} */ let panel = null;
  /** @type {any} */ let bar = null;
  /** @type {any} */ let scan = null;
  /** @type {any} */ let slot = null;
  /** @type {any} */ let placing = null;
  let spin = 0;
  let named = false;
  let listening = false;
  // DECOR-ROOMS (2026-09-27, Discord: "For a house with multiple connects, add room switching tabs"): the house's rooms,
  // found in the room's own collider a few rays a frame while the panel is up (systems/decorRooms.js) - found again for
  // another interior - and the one the owner chose (null: the one the eye stands in)
  /** @type {any} */ let rooms = null;
  /** @type {any} */ let roomsFor = null;
  /** @type {number|null} */ let roomPick = null;
  // HOME-DOORS: the house's doorways, found from its rooms' links (for the collider they were found in)
  /** @type {any} */ let doorways = null;
  /** @type {any} */ let doorwaysFor = null;
  /** @type {any} */ let doorRooms = null;   // HOME-DOORS (AUDIT): the rooms found with the placed doors seen through - the doorways' links
  /** @type {any} */ let markTex = null;
  // HOME-RENT: the service's word on this home's rooms - read once a visit while the panel is up, and after each change
  const rentState = { visit: /** @type {any} */ (undefined), list: /** @type {any[]|null} */ (null), due: 0, now: 0, busy: false, asked: 0, at: -Infinity };   // RENT-FRESH: the last read's number and when it was asked
  /** @type {Set<string>} the flight's own held actions - its presses never reach the host */
  const flyHeld = new Set();
  /** @type {Map<number, {gpu: any, box: any}|null>} */
  const models = new Map();
  /** @type {Map<number, number>} AUDIT DECOR-SHELL 3: when each model last failed to load */
  const modelFailed = new Map();
  const offRefresh = pool?.onRefresh?.(() => refreshGhost()) ?? null;   // AUDIT DYE-ICON r3 1: the room tells the ghost when its pictures go

  /** AUDIT DECOR-SHELL 3: a model that would not load is asked again DECOR_MODEL_RETRY_MS on (the frame asks every
   *  frame) - it was remembered as nothing for the session: the bar said "Loading..." for good, no ghost, the preview
   *  blank, though the pipeline's own cache builds a failed mesh again. */
  function modelFor(id) {
    if (models.has(id)) return models.get(id) ?? null;
    if (now() - (modelFailed.get(id) ?? -Infinity) < DECOR_MODEL_RETRY_MS) return null;
    models.set(id, null);
    const failed = () => { models.delete(id); modelFailed.set(id, now()); };
    Promise.resolve(deps.getGpuMesh?.(id)).then((gpu) => {
      const cpu = deps.cpuModels?.get?.(id);
      if (gpu && cpu?.positions) models.set(id, { gpu, box: localAabb(cpu.positions) });
      else failed();
    }, failed);
    return null;
  }

  /** AUDIT 05b A5: A MODEL DRAWN IN THE HOST'S LAW - `deps.prepareModel` asked once for each table the decorator draws a
   *  model with (the host hands it the table: a yard's pixel's, built again in a new season, is a new one), and the model
   *  drawn with it only once it answered: the ghost and the preview as the piece will stand, never in the textures a moment
   *  and the town's the next (a yard's ghost flew in the base climate's wood, then stood in the desert's). */
  /** @type {WeakMap<object, Map<any, boolean>>} */
  const inLawOf = new WeakMap();
  function inLaw(gpu, texRemap) {
    if (!deps.prepareModel || !texRemap) return true;
    let seen = inLawOf.get(texRemap);
    if (!seen) inLawOf.set(texRemap, (seen = new Map()));
    if (seen.has(gpu)) return seen.get(gpu);
    seen.set(gpu, false);
    Promise.resolve().then(() => deps.prepareModel(gpu)).catch(() => {}).then(() => { seen.set(gpu, true); });
    return false;
  }

  function ensureDom() {
    if (panel || !deps.doc) return;
    const { doc, win, touch = false } = deps;
    button = createDecorButton({ doc, touch, onPress: () => openPanel() });
    panel = createDecorPanel({
      doc, win,
      onPlace: (entry) => beginPlacing(entry),
      onPlaceLook: (furn, look) => beginPlacing(decorLookEntry(furn, look)),   // DECOR2b
      onClose: () => { const s = slot; slot = null; if (s) deps.closeSlot?.(s); deps.look?.()?.preview?.(undefined); },   // HOME-LOOK: a look tried and not painted is put away
      thumbOf: (entry) => {
        if (entry.icon) return deps.iconUrl?.(entry.icon.archive, entry.icon.record, entry.icon.dye ?? null, entry.icon.dyeTarget ?? null) ?? null;   // DECOR2a: the pack's own picture
        // AUDIT DYE-ICON 1: a hung one "In this room" is the pack's picture too, dyed off its numbers as it hangs - asked
        // bare, an Ebony blade previewed as the base metal's (Mac's "daedric but show steel", in the panel)
        if (decorIsMount(entry)) return deps.iconUrl?.(entry.flat[0], entry.flat[1], decorMountDye(entry.item), decorMountDyeTarget(entry.item)) ?? null;
        return entry.flat ? deps.iconUrl?.(...drawnHere(entry.flat)) ?? null : null;   // NUDE-DECOR, DECOR-OUTDOOR: the picture it stands as
      },
      // NUDE-DECOR: a picture drawn as another is kept under that other's key - the panel keeps a picture for the session,
      // and the setting turned off after a nude figure's was drawn would go on showing it in "In this room" (DECOR-OUTDOOR:
      // and a yard's tree its summer self in winter)
      thumbKeyOf: (entry) => {
        const drawn = entry.flat && !entry.icon ? drawnHere(entry.flat).join('.') : null;
        return drawn && drawn !== entry.flat.join('.') ? `${entry.key}>${drawn}` : entry.key;
      },
      onMove: (piece) => beginPlacing(entryOf(piece), piece),
      onRemove: (piece) => { removePiece(piece); },
      onToggle: (piece, what) => { togglePiece(piece, what); },
      onBase: (keys, out) => { setBase(keys, out); },   // BASE-HIDE
      onRoom: (id) => { roomPick = id; if (panel?.isOpen()) panel.update(view()); },   // DECOR-ROOMS
      onRent: (what, row, price) => { rentAct(what, row, price); },   // HOME-RENT
      onPaint: (what, look) => { paintAct(what, look); },   // HOME-LOOK
    });
    bar = createDecorBar({
      doc, touch,
      on: {
        place: () => { commit(); }, back: () => back(),
        turnLeft: () => turnPiece(-DECOR_TURN_STEP), turnRight: () => turnPiece(DECOR_TURN_STEP),   // HOME-DOORS: a door swings the other way
        raise: () => placing?.placer?.raise(DECOR_RAISE_STEP), lower: () => placing?.placer?.raise(-DECOR_RAISE_STEP),
        smaller: () => placing?.placer?.rescale(false), bigger: () => placing?.placer?.rescale(true),
        grid: () => placing?.placer?.toggleSnap(),
        fly: (dir) => { if (placing) placing.rise = dir; },   // DECOR1e: a touch screen's Fly up/down, held
      },
    });
  }

  const ensureScan = () => { scan ??= createDecorScan(deps.scanDeps()); return scan; };
  // AUDIT 05b A3: THE MODS' PIECES THE PORT STANDS NOW (systems/decorMods.js decorModsLive) - the offer's own
  // (decorCatalogue.js decorRoomEntries), asked as the panel opens, as the catalogue first stands and every
  // DECOR_MODS_LIVE_S it is up; never once a session (a mod turned off left its pieces for sale that stood nowhere, one
  // turned on was never offered). A piece that stands only now is measured then, so priced (decorScan.js remeasure).
  let modsLive = new Set(), modsLiveIn = 0, modsLiveOf = null;
  function liveMods() {
    const s = ensureScan(), list = s.entries();
    if (modsLiveIn > 0 && modsLiveOf === list) return modsLive;
    modsLiveIn = DECOR_MODS_LIVE_S;
    modsLiveOf = list;
    const now = decorModsLive(list);
    if (now.size !== modsLive.size || [...now].some((k) => !modsLive.has(k))) { modsLive = now; s.remeasure(now); }
    return modsLive;
  }

  /** DECOR-ROOMS: the finder for this interior - a new one for another interior's collider (a new visit), the choice
   *  forgotten with the house it was made in. */
  function ensureRooms() {
    const c = deps.collider?.() ?? null;
    if (rooms && roomsFor === c) return rooms;
    roomsFor = c;
    roomPick = null;
    const box = typeof c?.bounds === 'function' ? c.bounds() : null;
    rooms = createDecorRooms({ raycastHit: (o, d, m) => c.raycastHit(o, d, m), box });
    return rooms;
  }
  /** DECOR-ROOMS: the house's rooms once found - two or more, since one room is no choice - else null. */
  function roomList() {
    if (!rooms || roomsFor !== (deps.collider?.() ?? null) || !rooms.done()) return null;
    const found = rooms.rooms();
    return found && found.length > 1 ? found : null;
  }
  /** HOME-DOORS: the doorway finder for this interior, once its rooms are found - null until then. */
  function ensureDoorways() {
    const c = deps.collider?.() ?? null;
    if (doorways && doorwaysFor === c) return doorways;
    const r = ensureRooms();
    if (!r.done()) return null;
    // AUDIT: A PLACED DOOR STANDS SHUT ACROSS ITS DOORWAY, so the rooms' links never passed it and its doorway was never
    // found again - the door could not be moved within it, nor turned, on any later visit. The links come from the
    // rooms found once more with the placed doors seen through (their host bucket, or the pool's own where the host
    // hangs none); the room tabs keep them as the walls they are. freeDoorways counts the doorways they stand in taken.
    let src = r;
    const skip = pool.list().filter((piece) => decorIsDoor(piece)).flatMap((piece) => [`act:decor:${piece.id}`, decorKeyOf(piece.id)]);
    if (skip.length) {
      const sig = skip.join('|');
      if (!doorRooms || doorRooms.for !== c || doorRooms.sig !== sig) {
        const box = typeof c?.bounds === 'function' ? c.bounds() : null;
        doorRooms = { for: c, sig, rooms: createDecorRooms({ raycastHit: (o, d, m) => c.raycastHit(o, d, m, { skip }), box }) };
      }
      if (!doorRooms.rooms.done()) { doorRooms.rooms.step(); return null; }
      src = doorRooms.rooms;
    }
    doorwaysFor = c;
    const only = deps.walls ?? null;
    doorways = createDecorDoorways({ raycastHit: (o, d, m) => c.raycastHit(o, d, m, only), links: src.links?.() ?? [] });
    return doorways;
  }
  /** HOME-DOORS: THE DOORWAYS NO DOOR STANDS IN, once found (else null) - the room's own doors and the placed ones, a
   *  door being moved (`except`) aside. */
  function freeDoorways(except = null) {
    const list = doorways?.done() && doorwaysFor === (deps.collider?.() ?? null) ? doorways.doorways() : null;
    if (!list) return null;
    const placed = pool.list().filter((piece) => decorIsDoor(piece) && piece.id !== except).map(piecePoint);
    return decorDoorwaysFree(list, [...(deps.doorsHere?.() ?? []), ...placed]);
  }
  /** HOME-DOORS: a door put in, moved or taken out parts the house's rooms anew - found again (its doorways too, but for
   *  a door put in, whose doorway is only taken). */
  function forgetRooms(keepDoorways = false) {
    rooms = null;
    roomsFor = null;
    if (!keepDoorways) { doorways = null; doorwaysFor = null; }
  }
  /** HOME-DOORS (AUDIT): the free doorways the door being placed closes - its model fitted whole, one no wider than it
   *  fills (null while they are found; every free one while its model is still fetched). */
  function closableDoorways(p) {
    const free = freeDoorways(p.editing?.id ?? null);
    const m = free && p.entry?.model != null ? modelFor(p.entry.model) : null;
    return m?.box ? free.filter((w) => decorDoorFit(w, m.box)?.fills) : free;
  }
  /** HOME-YARD (AUDIT): THE GROUND A PIECE COVERS, as offsets from where it stands in the room's frame - its model's box
   *  turned and sized as it stands (a flat's width, square), so a lot is asked about all of it, not its middle alone. */
  function footprintOf(p) {
    const piece = p?.piece;
    if (!piece) return [];
    const s = piece.scale ?? 1;
    const m = piece.model != null ? modelFor(piece.model) : null;
    if (m?.box) {
      const [x0, , z0, x1, , z1] = m.box;
      const yaw = ((piece.rot?.[0] ?? 0) * Math.PI) / 180, c = Math.cos(yaw), sn = Math.sin(yaw);
      return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([lx, lz]) => [(c * lx + sn * lz) * s, (-sn * lx + c * lz) * s]);   // mat4 trs: local x to (cos, -sin), z to (sin, cos)
    }
    const r = (p.radius ?? 0) * s;
    return r > 0 ? [[-r, -r], [r, -r], [r, r], [-r, r]] : [];
  }
  /** Where a placed piece stands, in this visit's frame. */
  const piecePoint = (piece) => { const o = deps.origin?.() ?? [0, 0, 0]; return [o[0] + piece.pos[0], o[1] + piece.pos[1], o[2] + piece.pos[2]]; };
  /** SEAT-HALL (Seats-Arc 7.2: "the Charter Room - the palace's largest room"; "the decor tool refuses a piece within 2 m
   *  of any NPC or quest marker"): why the piece being placed cannot stand in a palace's Charter Room, or null - outside the
   *  palace's largest room (its rooms once found: the most floor), or too near the court (the host's `charterClear`). Null
   *  in every other room. */
  function charterWhyNot(p) {
    const r = deps.room?.();
    if (!r?.charter || !p?.piece) return null;
    const at = piecePoint(p.piece);
    const list = roomList();
    if (list) {
      const big = list.reduce((a, b) => (b.cells > a.cells ? b : a));
      if (rooms.roomOf(at)?.id !== big.id) return SEAT_HALL_TEXT.room;
    }
    return deps.charterClear?.(at) ?? null;
  }
  /** Why the piece cannot stand where the ghost shows it: off a yard's lot (HOME-YARD), outside the Charter Room's rule
   *  (SEAT-HALL), or null. */
  const whyNotHere = (p) => deps.placeOk?.(p.piece, footprintOf(p)) ?? charterWhyNot(p);
  /** The room chosen: the owner's pick, else the one the eye stands in, else the first. */
  const roomChosen = (list) => list.find((r) => r.id === roomPick) ?? rooms.roomOf(deps.eye?.() ?? null) ?? list[0];
  /** DECOR-ROOMS: WHERE A FLIGHT BEGINS - over the floor of the room chosen (a piece being moved: its own room's) when
   *  that is not the room the eye stands in; else at the eye, as ever. */
  function flightStart(editing) {
    const eye = deps.eye?.() ?? [0, 0, 0];
    const list = roomList();
    if (!list) return eye;
    const want = editing ? rooms.roomOf(piecePoint(editing)) : roomChosen(list);
    const here = rooms.roomOf(eye);
    return want && (!here || here.id !== want.id) ? [...want.eye] : eye;
  }
  /** The hover names (the host's Map), filled once the catalogue stands; a step of the scan until then. */
  function nameFromCatalogue() {
    if (named) return;
    const s = ensureScan();
    if (!s.entries()) { s.step(); return; }
    for (const e of s.entries()) deps.names?.set(e.key, e.name);
    named = true;
  }

  /** DECOR2a: a piece of the owner's own - named by the item the room keeps for it (the owner's own view), else by its
   *  descriptor (what any client can name). */
  const ownName = (piece) => {
    const kept = pool.ownOf?.(piece.id) ?? null;
    return (kept ? itemLongName(kept) : null) || decorItemName(piece.item) || DECOR_KINDS.decor;
  };
  /** A placed piece's entry IN THE CATALOGUE, or null - one of the owner's own is none of the catalogue's, and none is
   *  found before the catalogue is read. AUDIT 05b A2: asked for itself - the placed list read an entry's `count` as
   *  "found", and a tree, a plant or a hall's board is the catalogue's own at a count of 0 (a row of its kind's letters,
   *  never its picture). */
  const catalogued = (piece) => (piece.item ? null : scan?.entries()?.find((x) => x.key === decorKey(piece)) ?? null);
  /** A placed piece's catalogue entry - or, until the catalogue is read, the piece's own shape as one. DECOR2a: a piece
   *  of the owner's own is its own entry, free. */
  function entryOf(piece, known = catalogued(piece)) {
    if (piece.item) {   // DECOR2b: furniture stands as a look - a model as often as a flat
      return {
        key: `own-piece:${piece.id}`, kind: 'own', model: piece.model ?? null, flat: piece.flat ?? null, item: piece.item, name: ownName(piece), count: 0,
        storage: false, light: decorFlatLight(piece.flat), mount: decorIsMount(piece),   // DECOR2c: a hung one moves as it hangs
      };
    }
    if (known) return known;
    const key = decorKey(piece);
    // the catalogue not read yet: its kind by its model all the same (AUDIT: a door moved in the first moments of a visit
    // flew as furniture - set on any surface, at any turn - and was still hung as a door)
    const kind = piece.model != null ? modelKind(piece.model) : 'decor';
    return {
      key, model: piece.model ?? null, flat: piece.flat ?? null, kind,
      name: deps.names?.get(key) ?? DECOR_KINDS[kind], count: 0, storage: !!piece.storage, light: piece.light ?? null,
    };
  }

  /** DECOR2a: the pack's rows, each item's worked out once (the frame asks every frame while the panel is up) and
   *  again only when its count, whether it is worn or whether it is known (its name) changes. Keyed by the ITEM, not its
   *  place in the pack: the panel keeps each row's picture by its key, and a thing set down moves every place after it.
   *  DECOR2b: then the furniture delivered, the same way. */
  /** @type {WeakMap<object, {id: number, n: number, slot: any, known: any, entry: any}>} */
  const ownCache = new WeakMap();
  let ownSeq = 0;
  function ownEntries() {
    const out = [];
    const rows = (list, make) => {
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (!item || typeof item !== 'object') continue;
        const n = item.stackCount ?? 1;
        let c = ownCache.get(item);
        if (!c || c.n !== n || c.slot !== item.equipSlot || c.known !== item.isIdentified) {
          c = { id: c?.id ?? ++ownSeq, n, slot: item.equipSlot, known: item.isIdentified, entry: make(item, i) };
          ownCache.set(item, c);
        }
        if (c.entry) out.push({ ...c.entry, key: `own:${c.id}`, count: n });
      }
    };
    rows(deps.pack?.() ?? [], (item, i) => decorOwnEntry(item, i, deps.identity?.() ?? undefined));
    rows(deps.furnishings?.() ?? [], (item, i) => decorFurnishingEntry(item, i));
    return out;
  }

  function view() {
    const r = deps.room?.();
    const s = ensureScan();
    const list = roomList();   // DECOR-ROOMS
    return {
      placed: pool.list().map((piece) => {
        const known = catalogued(piece);
        return { piece, entry: known, name: entryOf(piece, known).name, holds: !!pool.holdsAny?.(piece.id), own: !!piece.item, room: list ? rooms.roomOf(piecePoint(piece))?.id ?? null : null };
      }),
      // DECOR-ROOMS: a house of two rooms or more - each one's name, and the one chosen (the panel's tabs, and its lists)
      rooms: list ? list.map((room) => ({ id: room.id, name: room.name })) : null,
      roomId: list ? roomChosen(list).id : null,
      // DECOR2a: what in the pack can stand here - free, and back to the pack when taken down; GUILD1d: never in a guild's
      // hall, which holds the catalogue's pieces alone (a keeper's own thing would be whose at its sale?)
      own: r?.hall ? [] : ownEntries(),
      base: baseRows(),   // BASE-HIDE: the room's own furniture
      where: r?.where ?? '',
      hall: !!r?.hall,   // AUDIT GUILD1d A9: a hall's piece gives its half to the guild's treasury (the panel says so)
      entries: decorRoomEntries(s.entries(), r, null, liveMods()),   // HOME-YARD: a door hangs in a doorway, never in a yard; GUILD1e: a hall's board in a hall alone; AUDIT 05b A3: a mod's piece while it stands
      yard: !!r?.yard,
      progress: s.progress(),
      ready: s.phase() === 'done',
      sized: s.lateSized(),   // AUDIT 05b A3: a piece measured since - its price, listed
      radiusOf: (e) => s.radiusOf(e),
      priceOf: (e) => { const rad = s.radiusOf(e); return rad ? decorPrice(rad, 1) : null; },
      gold: deps.wallet?.().gold ?? 0,
      count: pool.size(),
      cap: capHere(r),
      doorways: freeDoorways()?.length ?? null,   // HOME-DOORS: how many doorways a door may hang in, once found
      paint: deps.look?.() ?? null,   // HOME-LOOK: the house outside, to paint - or null
      rent: rentView(r),   // HOME-RENT: an online home's rooms to rent, or null
    };
  }

  /** HOME-YARD: how many pieces this place holds - a yard its own, a room DECOR_CAP. */
  const capHere = (r) => (r?.yard && Number.isSafeInteger(deps.yardCap) ? deps.yardCap : Number.isSafeInteger(r?.cap) ? r.cap : DECOR_CAP);   // SEAT-HALL: a room's own cap (the Charter Room's hundred)
  /** HOME-LOOK: A LOOK TRIED ON THE HOUSE (`preview`, the owner's own screen), PUT AWAY (`reset`), or PAINTED (`commit` -
   *  written to the service, said). */
  async function paintAct(what, look) {
    const door = deps.look?.() ?? null;
    if (!door) return false;
    if (what === 'preview') { door.preview(look ?? null); return true; }
    if (what === 'reset') { door.preview(undefined); return true; }
    if (what !== 'commit') return false;
    // GUILD-YARD: a hall painted by its keeper. AUDIT GUILD-YARD C2: whose it is, read before the write - the decorator
    // shut and its keeper off the lot while the answer was out, the room was nobody's and a hall said "Your house"
    const hall = !!deps.room?.()?.hall;
    const whose = hall ? 'Your guild\'s hall' : 'Your house';
    const r = await door.commit(look ?? null);
    deps.say?.(r?.ok ? (look ? `${whose} is painted.` : `${whose} wears the town's own look again.`) : (deps.refusal?.(r?.error) ?? (hall ? 'The hall could not be painted.' : 'The house could not be painted.')));
    return !!r?.ok;
  }
  /** HOME-RENT: THE OWNER'S ROOMS TO RENT - each room the house's walls part it into beside its offer (and an offer whose
   *  room the walls no longer make), the rent held, the service's clock. Null where there is no service door (a house
   *  or a ship, or someone else's home).
   *  RENT-FRESH (FIELD BUGS 2026-10-01, "Room renting is buggy"): READ AGAIN as the panel opens (the view the opening
   *  asks for is asked with the panel shut) and while the rooms view stays up past RENT_VIEW_FRESH_MS - it was read once
   *  a visit, so a tenant who paid while the owner stood in the house was never shown ("No rent to collect").
   *  RENT-ORPHANS: the rows once the finder is done, a house of ONE room's included - its offers are listed to withdraw
   *  (a door taken down made one room of two, and the offers in it, tenants and all, vanished from the owner's view
   *  while every visitor could still rent them); `finding` while it works (the view said "a house of one room"). */
  function rentView(r) {
    const door = r?.kind === 'home' ? deps.rent?.() ?? null : null;
    if (!door) return null;
    const visit = deps.visit?.();
    if (rentState.visit !== visit) { rentState.visit = visit; rentState.list = null; rentState.due = 0; refreshRent(door); }
    else if (!rentState.busy && (!panel?.isOpen() || (panel.mode?.() === 'rent' && now() - rentState.at >= RENT_VIEW_FRESH_MS))) refreshRent(door);
    const found = roomsFound();
    const list = found && found.length > 1 ? found : null;
    const origin = deps.origin?.() ?? [0, 0, 0];
    return {
      rows: found ? rentRoomsView(list ?? [], rentState.list ?? [], (p) => rooms.roomOf(p), origin) : [],
      rooms: !!list, finding: !found, loaded: rentState.list != null, due: rentState.due, now: rentState.now || Math.floor(now() / 1000), busy: rentState.busy,
    };
  }
  /** RENT-ORPHANS: the house's rooms once the finder is done for this interior - one room or none among them - else null. */
  function roomsFound() {
    if (!rooms || roomsFor !== (deps.collider?.() ?? null) || !rooms.done()) return null;
    return rooms.rooms() ?? [];
  }
  function refreshRent(door = deps.rent?.() ?? null) {
    if (!door) return Promise.resolve(false);
    const visit = rentState.visit;
    const ask = ++rentState.asked;   // RENT-FRESH: only the latest read stands - an older one landing late is not the rooms now
    rentState.at = now();
    return Promise.resolve(door.rooms()).then((res) => {
      if (rentState.visit !== visit || ask !== rentState.asked || !res?.ok) return false;
      rentState.list = res.rooms;
      rentState.due = res.due ?? 0;
      rentState.now = res.now ?? 0;
      return true;
    }, () => false);
  }
  /** HOME-RENT: A ROOM OFFERED (or its price changed), WITHDRAWN, or THE RENT COLLECTED - one at a time, said, and the
   *  rooms read again. */
  async function rentAct(what, row, price) {
    const door = deps.rent?.() ?? null;
    if (!door || rentState.busy) return false;
    rentState.busy = true;
    try {
      let res = null;
      if (what === 'offer') {
        const anchor = row?.eye ? rentAnchorOfRoom(row, deps.origin?.() ?? [0, 0, 0]) : null;
        if (!anchor || !row.offerable) return false;
        res = await door.offer({ room: row.number, anchor, price });   // AUDIT: its offer's own number (homeRent.js rentRoomsView), never the finder's
        if (res?.ok) deps.say?.(`${row.name} is offered to rent at ${goldSum(price)} gold a day.`);
      } else if (what === 'withdraw') {
        if (!row?.offer || (!row.offer.listed && row.offer.taken)) return false;
        res = await door.withdraw({ room: row.offer.room });
        if (res?.ok) deps.say?.(res.data?.gone === false ? `Room ${row.offer.room} is still rented - offered to nobody once its days run out.` : `Room ${row.offer.room} is no longer offered to rent.`);
      } else if (what === 'collect') {
        res = await door.collect();
        if (res?.ok) deps.say?.(`You collected ${goldSum(res.gold)} gold in rent. It went to ${EMPIRE_ACCOUNT_WORDS}.`);
      }
      if (!res?.ok) { if (res) deps.say?.(deps.refusal?.(res.error) ?? 'The room could not be changed.'); return false; }
      door.changed?.();
      await refreshRent(door);
      return true;
    } finally {
      rentState.busy = false;
    }
  }

  /** BASE-HIDE: THE ROOM'S OWN FURNITURE, nearest the eye first - each piece named by the catalogue once it is read (its
   *  kind until then), how far it stands, whether it is out and whether it holds anything. */
  function baseRows() {
    const b = deps.base?.();
    if (!b) return [];
    const eye = deps.eye?.() ?? null;
    return b.list().map((p) => {
      const shape = decorKey(p);
      const kind = p.model != null ? modelKind(p.model) : flatKind(p.flat[0]);
      const dist = eye && p.at ? Math.hypot(p.at[0] - eye[0], p.at[1] - eye[1], p.at[2] - eye[2]) : null;
      const list = roomList();   // DECOR-ROOMS: the room it stands in, where the house has more than one
      return { key: p.key, shape, model: p.model, flat: p.flat, kind, name: deps.names?.get(shape) ?? DECOR_KINDS[kind], hidden: p.hidden, holds: p.holds, dist, room: list && p.at ? rooms.roomOf(p.at)?.id ?? null : null };
    }).sort((a, b2) => (a.dist ?? Infinity) - (b2.dist ?? Infinity));
  }

  /** BASE-HIDE: THE ROOM'S OWN FURNITURE TAKEN OUT (`out`) OR PUT BACK - free. An online home writes the room's whole list
   *  first (the account service is the room's truth, and every visitor's) and stands it once the service has it; the
   *  house and the ship stand it at once (the room's scene carries the list into the save). A piece that holds anything
   *  is never taken out: what it holds would go with it. */
  async function setBase(keys, out) {
    const r = deps.room?.();
    const b = deps.base?.();
    if (!r || !b || !Array.isArray(keys)) return false;
    const rows = new Map(b.list().map((p) => [p.key, p]));
    const moving = keys.filter((k) => { const p = rows.get(k); return p && p.hidden !== out && !(out && p.holds); });
    if (!moving.length) return false;
    const next = new Set(b.hidden());
    for (const k of moving) { if (out) next.add(k); else next.delete(k); }
    if (next.size > DECOR_HIDDEN_CAP) { deps.say?.('No more of this room\'s own furniture can be taken out.'); return false; }
    const visit = deps.visit?.();
    if (r.kind === 'home') {
      const res = await deps.homeDecor?.hidden?.({ mapId: r.mapId, buildingKey: r.buildingKey, character: deps.character?.(), keys: [...next].sort() });
      if (!res?.ok) { deps.say?.(deps.refusal?.(res?.error) ?? 'The room could not be changed.'); return false; }
    }
    if (deps.visit?.() !== visit) return false;
    for (const k of moving) { if (out) b.hide(k); else b.show(k); }
    const one = moving.length === 1 ? (baseRows().find((row) => row.key === moving[0])?.name ?? null) : null;
    deps.say?.(one ? `${one} ${out ? 'taken out' : 'put back'}.` : `${moving.length} pieces ${out ? 'taken out' : 'put back'}.`);
    return true;
  }

  /** THE BUTTON'S PRESS: the panel opens over the room (paused, the pointer freed - the slot's doing). */
  function openPanel() {
    if (!deps.room?.() || placing || panel?.isOpen()) return false;
    ensureDom();
    if (!panel) return false;
    modsLiveIn = 0;   // AUDIT 05b A3: the switches asked again as it opens
    slot = panel.open(view());
    if (slot) deps.openSlot?.(slot);
    return !!slot;
  }

  // ── THE FREE CAMERA ───────────────────────────────────────────────
  /** A new piece from the catalogue, or (DECOR1e) `editing`, a placed piece moved - its own id, turn, scale, light and
   *  storage; its size, when the scan has not read it yet, is what it was priced at. */
  function beginPlacing(catalogueEntry, editing = null) {
    const s = ensureScan();
    const yard = !!deps.room?.()?.yard;   // HOME-YARD: outside, nothing is held and no piece gives light
    const entry0 = editing ? { ...catalogueEntry, light: editing.light ?? null, storage: !!editing.storage, station: editing.station ?? null } : catalogueEntry;   // AUDIT HOME-STATIONS S1: a moved station stays one
    const entry = yard ? { ...entry0, storage: false, light: null, station: null } : entry0;
    const free = entry.kind === 'own';   // DECOR2a: the player's own item - no price, whatever its size
    const radius = free ? null : s.radiusOf(catalogueEntry) ?? (editing ? editing.paid / (DECOR_PRICE_PER_METRE * editing.scale) : null);
    const eye = flightStart(editing);   // DECOR-ROOMS: in the room chosen - else at the eye, as ever
    placing = {
      entry, radius, editing, free, placer: null, fly: [...eye], start: [...eye], id: editing ? editing.id : mintDecorId(), piece: null,
      refused: null, busy: false, batch: null, flatSize: null, rise: 0, art: null, decal: null, inside: [], mirrors: true, release: null,   // DECOR-LPT: the host's picture's
      door: entry.kind === 'door', flip: false, marks: null, markSig: '',   // HOME-DOORS: hung in a doorway, its marks
      lotMarks: null, lotSig: '',   // HOME-YARD: the lot's edge
    };
    deps.cursorOff?.();   // a cursor freed to press the button would hold the look off for the whole placement
    if (entry.mount) {   // DECOR2c: the picture itself hangs where it will hang
      askGhostArt(placing);
    } else if (entry.model == null) {
      const p = placing;
      // MW-ASSIGN: one's own thing set down shows the Morrowind picture it will stand as (the room's own door and cache,
      // scenes/decorRoom.js standPicture) - else its own world picture, as ever
      const mw = entry.kind === 'own' && entry.item ? Promise.resolve(pool.standPicture?.(entry.item) ?? null).catch(() => null) : Promise.resolve(null);
      const [ga, gr] = drawnHere(entry.flat);   // NUDE-DECOR: a figure moved shows the stand-in the room stands it as; DECOR-OUTDOOR: a tree, its season
      // DECOR-LPT: a flat the host stands its own way shows the picture it will stand as (a yard's tree, Low Poly Trees')
      const hosted = Promise.resolve(deps.flatPicture?.(entry.flat) ?? null).catch(() => null);
      // AUDIT 05b A6: each ask fails on its own - a texture that would not load threw the three answers away together,
      // the host's held picture with them (never let go, no ghost)
      const tex = Promise.resolve().then(() => deps.getTexture?.(ga)).catch(() => null);
      Promise.all([tex, mw, hosted]).then(([t, pic, own]) => {
        if (placing !== p) { own?.release?.(); return; }
        if (own) {
          p.flatSize = { ...own.size };
          p.mirrors = own.mirrors !== false;   // a tree turns in earnest - its picture never mirrors
          p.release = own.release ?? null;
          p.placer = createDecorPlacer(entry, { radius, from: editing, free });
          if (renderer?.createBillboardBatch) p.batch = renderer.createBillboardBatch(own.archive, own.key, { ...p.flatSize }, [[0, 0, 0]]);
          return;
        }
        if (pic) {
          p.flatSize = { w: pic.w, h: pic.h };
          p.placer = createDecorPlacer(entry, { radius, from: editing, free });
          if (renderer?.createBillboardBatch) p.batch = renderer.createBillboardBatch(MW_STAND_ARCHIVE, pic.key, { ...p.flatSize }, [[0, 0, 0]]);
          return;
        }
        if (!t || !(gr < t.recordCount)) return;
        deps.uploadRecord?.(ga, gr);
        p.flatSize = billboardSize(t, gr);
        p.placer = createDecorPlacer(entry, { radius, from: editing, free });
        if (renderer?.createBillboardBatch) p.batch = renderer.createBillboardBatch(ga, gr, { ...p.flatSize }, [[0, 0, 0]]);
      }, () => {});
    }
    listen(true);
  }

  /** DECOR2c: THE GHOST'S PICTURE, and its placer once it lands. MW-MOUNT: the room's own door - the Morrowind picture
   *  while a build stands. AUDIT DYE-ICON r3 1: asked through the room (pool.mountPicture - its cache and its keys) where
   *  the room offers it, so the texture a refresh lets go is never the ghost's still: a hung piece's ghost shared the
   *  room's, drawn after it was gone, and a cancelled ghost's own upload was never let go. The answer to an older ask
   *  hangs nothing. */
  function askGhostArt(p) {
    const { entry } = p;
    const ask = pool.mountPicture?.(entry.flat, entry.item)
      ?? loadMountPicture({ getTexture: deps.getTexture, uploadRecord: deps.uploadRecord, renderer, mwPicture: deps.mwPicture }, entry.flat, entry.item);
    p.ask = ask;
    Promise.resolve(ask).then((art) => {
      if (placing !== p || p.ask !== ask || !art) return;
      p.art = art;
      p.decal ??= renderer?.createDecalBatch?.(1) ?? null;
      p.placer ??= createDecorPlacer(entry, { radius: p.radius, from: p.editing, free: p.free });
    }, () => {});
  }
  /** AUDIT DYE-ICON r3 1: the room asked its mounts' pictures again and let the old ones go (decorRoom.js onRefresh) -
   *  the ghost draws none until its own new answer lands. */
  function refreshGhost() {
    if (!placing?.entry?.mount) return;
    placing.art = null;
    askGhostArt(placing);
  }

  /** Back to the panel (Escape, a right press, the Back button) - the piece chosen stays chosen; a move goes back to
   *  the room's view, the piece untouched; DECOR2a: one's own item back to the pack's list, still chosen. */
  function back() {
    const key = placing?.entry?.key ?? null;
    const moved = placing?.editing ?? null;
    const own = !moved && placing?.entry?.kind === 'own';
    const look = own ? placing?.entry?.look ?? null : null;   // DECOR2b: furniture back to its look view, the look still chosen
    endPlacing();
    if (!openPanel()) return;
    if (moved) panel.showRoom(moved.id);
    else if (look) panel.showLook(key, look);
    else if (own) panel.showOwn(key);
    else if (key) panel.select(key);
  }

  function endPlacing() {
    const p = placing;
    placing = null;
    flyHeld.clear();
    if (p?.batch) renderer?.destroyBillboardBatch?.(p.batch);
    if (p?.decal) renderer?.destroyDecalBatch?.(p.decal);   // DECOR2c
    if (p?.marks) renderer?.destroyDecalBatch?.(p.marks);   // HOME-DOORS
    if (p?.lotMarks) renderer?.destroyDecalBatch?.(p.lotMarks);   // HOME-YARD
    p?.release?.();   // DECOR-LPT: what the host's picture held (a tree's far picture)
    bar?.hide();
    listen(false);
  }

  /** PLACE THE PIECE the ghost shows - paid for, and stood. */
  async function commit() {
    const p = placing;
    if (!p || p.busy || !p.piece) return false;
    const r = deps.room?.();
    if (!r) { endPlacing(); return false; }
    if (p.editing) return commitMove(p, r);
    if (p.entry.kind === 'own') return commitOwn(p, r);
    const price = p.piece.paid;
    if (decorWhyNot({ price, ready: true, gold: deps.wallet().gold, count: pool.size(), cap: capHere(r), yard: !!r?.yard, hall: !!r?.hall })) return false;   // the bar says why
    if (whyNotHere(p)) return false;   // HOME-YARD: off the lot; SEAT-HALL: out of the Charter Room - the bar says why
    p.busy = true;
    p.refused = null;
    const piece = p.piece;
    try {
      const act = r.kind === 'home' && price > 0 ? deps.realm?.() : null;
      if (act) {
        // REALM P2.2b: a realm character's piece and what it cost are one write on the service - the purse pays at once
        // and gets it back on a refusal (systems/realmSaves.js realmGoldAct)
        const visit = deps.visit?.();
        const wallet = deps.wallet();
        // MARKET-AUDIT: a refusal and a repeat give back exactly what the payment took (purse, letters, account)
        const paid = walletReserve(wallet, price);
        const res = await act({
          reserve: paid.reserve,
          // AUDIT REALM: a placement answered as the piece already standing (`repeat`) moved no gold on the record - the
          // reserve comes back, or the next checkpoint would write the price paid twice
          apply: (/** @type {any} */ a) => { if (a.data?.repeat) paid.back(); },
          call: (/** @type {any} */ at) => deps.homeDecor.place({ mapId: r.mapId, buildingKey: r.buildingKey, character: deps.character?.(), piece, realm: at }),
        });
        if (!res?.ok) { p.refused = { text: deps.refusal?.(res?.error) ?? 'The piece could not be placed.', at: now() }; return false; }
        if (deps.visit?.() === visit) standRound(p, decorPieceOf(res.data?.piece) ?? piece);
      } else if (r.kind === 'home') {
        const visit = deps.visit?.();
        const res = await deps.homeDecor?.place?.({ mapId: r.mapId, buildingKey: r.buildingKey, character: deps.character?.(), piece });
        if (!res?.ok) { p.refused = { text: deps.refusal?.(res?.error) ?? 'The piece could not be placed.', at: now() }; return false; }
        const wallet = deps.wallet();
        if (wallet.gold < price) {   // the gold went while the service was asked: the piece is taken back out
          await deps.homeDecor.remove?.({ mapId: r.mapId, buildingKey: r.buildingKey, character: deps.character?.(), id: piece.id });
          return false;
        }
        wallet.pay(price);
        if (deps.visit?.() === visit) standRound(p, decorPieceOf(res.data?.piece) ?? piece);
      } else {
        deps.wallet().pay(price);
        standRound(p, piece);
      }
      deps.say?.(`${p.entry.name} placed for ${price} gold.`);
      if (p.door) forgetRooms(true);   // HOME-DOORS: a door shut in its doorway parts the rooms either side
      p.id = mintDecorId();   // the next of the same piece is a new piece
      return true;
    } finally {
      p.busy = false;
    }
  }

  /** AUDIT2 DECOR-SHELL 8: STAND A PIECE THE FLIGHT GOES ON FROM - and one that stands round the eye (its box within
   *  the skin of it) is flown and looked through until the eye is out of it: the room's collider is two-sided, so every
   *  step from inside was cut at the piece's own faces, and a wardrobe placed looking down at the eye's feet shut the
   *  eye in it until Escape. */
  function standRound(p, piece) {
    pool.put(piece);
    const box = piece.model != null ? models.get(piece.model)?.box : null;
    if (!box) return;
    const b = transformedAabb(box, decorMatrix(piece, deps.origin?.() ?? [0, 0, 0]));
    if (inSkin(p.fly, b)) p.inside.push({ key: decorKeyOf(piece.id), box: b });
  }

  /** DECOR2a: SET ONE'S OWN ITEM DOWN where the ghost shows it - free. Online the account service has the piece first
   *  and only then does the item leave the pack; the room gone, or the item gone from the pack, while the service was
   *  asked, the piece is taken back out and the item never leaves. One item, one piece: then back to the pack's list. */
  async function commitOwn(p, r) {
    const item = p.entry.own;
    if (pool.size() >= DECOR_CAP || !deps.packHas?.(item)) return false;   // the bar says why
    p.busy = true;
    p.refused = null;
    const piece = p.piece;
    const online = r.kind === 'home';
    const at = online ? { mapId: r.mapId, buildingKey: r.buildingKey, character: deps.character?.() } : null;
    const undo = async () => { if (online) await deps.homeDecor.remove?.({ ...at, id: piece.id }); };
    let stood = piece;
    try {
      if (online) {
        const visit = deps.visit?.();
        const res = await deps.homeDecor?.place?.({ ...at, piece });
        if (!res?.ok) { p.refused = { text: deps.refusal?.(res?.error) ?? 'It could not be set down.', at: now() }; return false; }
        if (deps.visit?.() !== visit || !deps.packHas?.(item)) { await undo(); return false; }
        stood = decorPieceOf(res.data?.piece) ?? piece;
      }
      const moved = deps.packTake?.(item);
      if (!moved) { await undo(); return false; }
      pool.put(stood);
      pool.keepOwn(stood.id, moved);
      deps.say?.(`${p.entry.name} set down.`);
    } finally {
      p.busy = false;
    }
    if (placing === p) { endPlacing(); if (openPanel()) panel.showOwn(); }
    return true;
  }

  /** The place half of a piece - what a move rewrites (net/decorLaw.js decorPlaceOf; what it IS never changes). */
  const placeOf = (piece) => ({ pos: piece.pos, rot: piece.rot, scale: piece.scale, light: piece.light, storage: piece.storage, paid: piece.paid, ...(piece.station ? { station: piece.station } : {}) });   // HOME-STATIONS: the craft, when it serves one

  /** Write a placed piece's change - through the account service in an online home, into the room's pool (and so the
   *  save) elsewhere - and answer the piece as it now stands, or null (the bar or the line says why). */
  async function writeChange(r, piece) {
    if (r.kind !== 'home') return piece;
    const res = await deps.homeDecor?.move?.({ mapId: r.mapId, buildingKey: r.buildingKey, character: deps.character?.(), id: piece.id, place: placeOf(piece) });
    if (!res?.ok) { deps.say?.(deps.refusal?.(res?.error) ?? 'The piece could not be changed.'); return null; }
    return decorPieceOf(res.data?.piece) ?? piece;
  }

  /** REALM P2.2b: A PLACED PIECE'S CHANGE THAT MOVES GOLD, for a realm character in an online home - the piece and its gold
   *  one write on the service (systems/realmSaves.js realmGoldAct): `pay` out of the purse at once and back on a refusal,
   *  `refund` in on the answer. Answers the piece as it now stands, or null (the line says why). */
  async function writeChangeRealm(r, piece, act, { pay = 0, refund = 0 } = {}) {
    const wallet = deps.wallet();
    const res = await act({
      reserve: pay > 0 ? walletReserve(wallet, pay).reserve : null,   // MARKET-AUDIT: a refusal gives back exactly what it took
      // AUDIT REALM L1-F3: a shrink's half comes back as the SERVICE paid it (`gold`: half of what records paid for the
      // piece - nothing for a piece from before the realm), never this client's half of a cost the record never paid;
      // and a shrink that landed with its answer lost cannot know it, so it ends the session instead (`needsAnswer`)
      needsAnswer: refund > 0,
      apply: refund > 0 ? (/** @type {any} */ a) => { const g = Number(a.data?.gold) || 0; if (g > 0) deps.wallet().credit?.(g); } : null,
      call: (/** @type {any} */ at) => deps.homeDecor.move({ mapId: r.mapId, buildingKey: r.buildingKey, character: deps.character?.(), id: piece.id, place: placeOf(piece), realm: at }),
    });
    if (!res?.ok) { deps.say?.(deps.refusal?.(res?.error) ?? 'The piece could not be changed.'); return null; }
    return decorPieceOf(res.data?.piece) ?? piece;
  }

  /** DECOR1e: MOVE A PLACED PIECE to where the ghost shows it - free, or its resize's difference paid or half given
   *  back - then back to the room's view with the piece chosen. */
  async function commitMove(p, r) {
    const was = p.editing;
    if (whyNotHere(p)) return false;   // HOME-YARD: off the lot; SEAT-HALL: out of the Charter Room - the bar says why
    const price = decorEditPrice(p.radius, was, p.piece.scale);
    if (price.pay > (deps.wallet?.().gold ?? 0)) return false;   // the bar says why
    p.busy = true;
    const next = { ...p.piece, paid: price.paid };
    const visit = deps.visit?.();
    try {
      const act = r.kind === 'home' && (price.pay > 0 || price.refund > 0) ? deps.realm?.() : null;   // REALM P2.2b
      const stood = act ? await writeChangeRealm(r, next, act, price) : await writeChange(r, next);
      if (!stood) return false;
      if (!act) {
        if (price.pay > (deps.wallet?.().gold ?? 0)) {   // the gold went while the service was asked: it stands as it was
          await writeChange(r, was);
          return false;
        }
        if (price.pay > 0) deps.wallet().pay(price.pay);
        if (price.refund > 0 && !r.hall) deps.wallet().credit?.(price.refund);   // AUDIT GUILD1d A4: a hall's half is the treasury's, the service's
      }
      if (deps.visit?.() === visit) pool.put(stood);
      if (decorIsDoor(stood)) forgetRooms();   // HOME-DOORS: a door moved frees one doorway and takes another
    } finally {
      p.busy = false;
    }
    if (placing === p) { endPlacing(); if (openPanel()) panel.showRoom(was.id); }
    return true;
  }

  /** DECOR1e: REMOVE A PLACED PIECE - half of what it cost back to the purse. One that holds anything stays (the panel
   *  says so): what it holds would go with it. */
  async function removePiece(piece) {
    const r = deps.room?.();
    if (piece.item) return takeDown(piece, r);
    if (!r || pool.holdsAny?.(piece.id)) return false;
    const visit = deps.visit?.();
    let paid = piece.paid;
    const act = r.kind === 'home' && decorRefund(paid) > 0 ? deps.realm?.() : null;
    let back = 0;
    let toGuild = 0;   // GUILD1d: a hall's piece gives its half to the guild's treasury, never to the purse
    if (act) {
      // REALM P2.2b: the piece's going and its half back are one write on the service; the purse takes the service's half
      const res = await act({
        // AUDIT REALM L1-F3: the half the SERVICE paid the record (`gold`: half of what records paid for the piece), never
        // this client's half of a cost the record may never have paid; a removal that landed with its answer lost cannot
        // know it, and ends the session instead
        needsAnswer: true,
        apply: (/** @type {any} */ a) => {
          back = Math.max(0, Number(a.data?.gold) || 0);
          toGuild = Math.max(0, Number(a.data?.treasury) || 0);
          if (back > 0) deps.wallet?.().credit?.(back);
        },
        call: (/** @type {any} */ at) => deps.homeDecor.remove({ mapId: r.mapId, buildingKey: r.buildingKey, character: deps.character?.(), id: piece.id, realm: at }),
      });
      if (!res?.ok) { deps.say?.(deps.refusal?.(res?.error) ?? 'The piece could not be removed.'); return false; }
    } else {
      if (r.kind === 'home') {
        const res = await deps.homeDecor?.remove?.({ mapId: r.mapId, buildingKey: r.buildingKey, character: deps.character?.(), id: piece.id });
        if (!res?.ok) { deps.say?.(deps.refusal?.(res?.error) ?? 'The piece could not be removed.'); return false; }
        paid = decorPieceOf(res.data?.piece)?.paid ?? paid;   // the service's own record of what it cost
        toGuild = r.hall ? Math.max(0, Number(res.data?.treasury) || 0) : 0;
      }
      back = r.hall ? 0 : decorRefund(paid);   // AUDIT GUILD1d A4: a hall's half is the treasury's, never the purse's
      if (back > 0) deps.wallet?.().credit?.(back);
    }
    if (deps.visit?.() === visit) pool.remove(piece.id);
    if (decorIsDoor(piece)) forgetRooms();   // HOME-DOORS: its doorway open again, the rooms either side one
    deps.say?.(toGuild > 0 ? `${entryOf(piece).name} removed - ${toGuild} gold back to the guild's treasury.` : `${entryOf(piece).name} removed - ${back} gold back.`);
    return true;
  }

  /** DECOR2a: TAKE ONE'S OWN ITEM DOWN - back into the pack, whole (DECOR2b: furniture, among "Your things"; online the
   *  account service lets the piece go first). A piece whose item this save does not hold (a save older than the
   *  placing) is only taken down. The room gone before the answer, the item waits in the room's record, and the next
   *  visit gives it back (worldModes.js). */
  async function takeDown(piece, r) {
    if (!r) return false;
    const name = ownName(piece);
    const visit = deps.visit?.();
    if (r.kind === 'home') {
      const res = await deps.homeDecor?.remove?.({ mapId: r.mapId, buildingKey: r.buildingKey, character: deps.character?.(), id: piece.id });
      if (!res?.ok) { deps.say?.(deps.refusal?.(res?.error) ?? 'It could not be taken down.'); return false; }
    }
    if (deps.visit?.() !== visit) return false;
    pool.remove(piece.id);
    const item = pool.takeOwn?.(piece.id) ?? null;
    if (item) deps.packGive?.(item);
    // DECOR2b: furniture is delivered again - back among "Your things", never the pack
    deps.say?.(!item ? `${name} taken down.` : isFurnishing(item) ? `${name} taken down - set it down again from Your things.` : `${name} is back in your pack.`);
    return true;
  }

  /** DECOR1e: A PLACED PIECE LIT OR PUT OUT, or made to hold things or not - free. Its light, lit, is its catalogue
   *  piece's own (Daggerfall's), else a warm lamp's; one that holds anything goes on holding it. */
  async function togglePiece(piece, what) {
    const r = deps.room?.();
    if (!r) return false;
    // HOME-DOORS (AUDIT): a door is a door - it is no station (whose licence it could never use: a door is never a
    // decor target), holds nothing and gives no light
    if (decorIsDoor(piece) && (what === 'light' || what === 'storage' || (typeof what === 'string' && what.startsWith('station:')))) return false;
    if (typeof what === 'string' && what.startsWith('station:')) return setStation(r, piece, what.slice(8));
    let next;
    if (what === 'light') {
      const own = entryOf(piece).light;
      next = decorPieceOf({ ...piece, light: piece.light ? null : (own ?? DECOR_DEFAULT_LIGHT) });
    } else if (what === 'storage') {   // DECOR2a: the law answers no piece for one's own item made to hold things
      if (piece.storage && pool.holdsAny?.(piece.id)) return false;
      next = decorPieceOf({ ...piece, storage: !piece.storage });
    }
    if (!next) return false;
    const visit = deps.visit?.();
    const stood = await writeChange(r, next);
    if (!stood) return false;
    if (deps.visit?.() === visit) pool.put(stood);
    return true;
  }

  /** HOME-STATIONS: a piece a station cannot be made in for want of gold. */
  const decorStationGoldLine = (kind) => `${DECOR_STATION_NAMES[kind]}: ${DECOR_STATION_FEES[kind].toLocaleString('en-US')} gold, and you have not that much.`;

  /** HOME-STATIONS: A PLACED PIECE MADE A CRAFTING STATION, or unmade - `kind` one of DECOR_STATIONS, or 'none'. The
   *  licence is paid once (DECOR_STATION_FEES) and never comes back; a piece that holds things, or one's own item, is
   *  no station (the law says no piece). An online home's service that does not keep the craft is paid nothing. */
  async function setStation(r, piece, kind) {
    const want = kind === 'none' ? null : kind;
    if (want !== null && !DECOR_STATIONS.includes(want)) return false;
    if (PROF_STATIONS.includes(want) && !forgeOffered()) { deps.say?.(stationColdLine(want)); return false; }   // AUDIT 29 B2: never sold where it cannot work (PROF4: nor a workbench)
    if (want === VENDOR_STATION && !forgeOffered()) { deps.say?.(VENDOR_COLD_LINE); return false; }   // HOME-VENDOR: nor a trader
    // AUDIT HOME-STATIONS S2: ONE CHANGE AT A TIME, ON THE PIECE AS IT STANDS. A second press while the account service
    // was still answering the first paid the licence twice, or - short of twice the gold - wrote the pre-station piece
    // back over the one just paid for; and the panel's piece is a snapshot of an earlier frame.
    if (stationBusy.has(piece.id)) return false;
    const cur = pool.list().find((p) => p.id === piece.id) ?? piece;
    if ((cur.station ?? null) === want) return false;
    const fee = want ? DECOR_STATION_FEES[want] : 0;
    if (fee > (deps.wallet?.().gold ?? 0)) { deps.say?.(decorStationGoldLine(want)); return false; }
    const next = decorPieceOf({ ...cur, station: want });
    if (!next) return false;
    stationBusy.add(piece.id);
    try {
      const visit = deps.visit?.();
      const act = r.kind === 'home' && fee > 0 ? deps.realm?.() : null;   // REALM P2.2b: the licence on the record, with the piece
      const stood = act ? await writeChangeRealm(r, next, act, { pay: fee }) : await writeChange(r, next);
      if (!stood) return false;
      if ((stood.station ?? null) !== want) { deps.say?.(DECOR_STATION_UNKEPT); return false; }   // an older home service drops it: nothing is paid
      if (!act && fee > (deps.wallet?.().gold ?? 0)) {   // the gold went while the service was asked: it stands as it was, and says so
        await writeChange(r, cur);
        deps.say?.(DECOR_STATION_GOLD_WENT);
        return false;
      }
      if (!act && fee > 0) deps.wallet().pay(fee);
      if (deps.visit?.() === visit) pool.put(stood);
      const name = entryOf(cur).name ?? 'The piece';
      deps.say?.(want ? `${name}: ${DECOR_STATION_NAMES[want]}.` : `${name} is no longer a station.`);
      return true;
    } finally {
      stationBusy.delete(piece.id);
    }
  }
  /** AUDIT HOME-STATIONS S2: the pieces whose craft is being changed right now. */
  const stationBusy = new Set();

  /** A turn of the piece being placed - HOME-DOORS: a door is turned by its doorway, and a turn swings it the other way. */
  function turnPiece(deg) {
    if (!placing) return;
    if (placing.door) { placing.flip = !placing.flip; return; }
    placing.placer?.turn(deg);
  }

  // THE KEYS AND PRESSES WHILE THE CAMERA FLIES, taken before the host sees them
  const turn = (e, dir) => { if (!e.repeat || !placing?.door) turnPiece(dir * (e.shiftKey ? DECOR_TURN_FINE : DECOR_TURN_STEP)); };
  const lift = (e, dir) => placing?.placer?.raise(dir * (e.shiftKey ? DECOR_RAISE_FINE : DECOR_RAISE_STEP));
  /** A press read as its action - held, a turn, a lift or a size goes on; a place, a back or the grid is once. */
  function arm(e) {
    const act = deps.actionOf?.(e) ?? null;
    const once = !e.repeat;
    switch (act) {
      case 'TurnLeft': turn(e, -1); return;
      case 'TurnRight': turn(e, 1); return;
      case 'FloatUp': lift(e, 1); return;
      case 'FloatDown': lift(e, -1); return;
      case 'Interact': if (once) commit(); return;
      case 'Escape': if (once) back(); return;
      default: break;
    }
    if (act && DECOR_FLY_ACTIONS.includes(act)) { flyHeld.add(act); return; }
    const free = act ? null : DECOR_FREE_KEYS[e.code];
    if (free === 'smaller') placing?.placer?.rescale(false);
    else if (free === 'bigger') placing?.placer?.rescale(true);
    else if (free === 'grid' && once) placing?.placer?.toggleSnap();
  }
  const suspended = () => !placing || placing.suspended;
  const now = () => deps.now?.() ?? Date.now();
  function onKeyDown(e) {
    if (suspended() || isTextEntryTarget(e.target)) return;
    e.preventDefault?.();
    e.stopImmediatePropagation?.();
    arm(e);
  }
  /** A release is the host's too - a key held into the flight is let go of there - and ends a held flight key. */
  function onKeyUp(e) {
    const act = deps.actionOf?.(e) ?? null;
    if (act) flyHeld.delete(act);
  }
  function onPress(e) {
    if (suspended() || deps.touch) return;
    if (!deps.locked?.()) return;   // the press that takes the pointer back is the host's, never a placement
    e.preventDefault?.();
    e.stopImmediatePropagation?.();
    if (e.type !== 'mousedown') return;
    if (e.button === 0) commit();
    else if (e.button === 2) back();
  }
  function onWheel(e) {
    if (suspended()) return;
    e.preventDefault?.();
    e.stopImmediatePropagation?.();
    turn(e, (e.deltaY ?? 0) > 0 ? 1 : -1);
  }
  const swallowRest = (e) => { if (!suspended() && !deps.touch && deps.locked?.()) { e.preventDefault?.(); e.stopImmediatePropagation?.(); } };
  function listen(on) {
    const w = deps.win;
    if (!w?.addEventListener || on === listening) return;
    listening = on;
    const f = on ? 'addEventListener' : 'removeEventListener';
    w[f]('keydown', onKeyDown, true);
    w[f]('keyup', onKeyUp, true);
    w[f]('mousedown', onPress, true);
    w[f]('mouseup', swallowRest, true);
    w[f]('click', swallowRest, true);
    w[f]('contextmenu', swallowRest, true);
    w[f]('wheel', onWheel, { capture: true, passive: false });
  }

  // ── THE HOST'S FRAME ──────────────────────────────────────────────
  /**
   * @param {{ dt: number, cam: {pos: number[], yaw: number, pitch: number}, overlayUp: boolean, interior: boolean }} f
   */
  function frame({ dt, cam, overlayUp, interior }) {
    // the names: a room with pieces in it reads the catalogue for them, whoever stands in it (a visitor points at
    // the owner's chairs too) - a few blocks a frame, and never again once read
    if (interior && !named && pool.size() > 0) nameFromCatalogue();
    const r = interior ? deps.room?.() : null;
    if (!r) {
      if (placing) endPlacing();
      if (panel?.isOpen()) panel.close();
      button?.render(false);
      return;
    }
    if (!button && deps.doc) ensureDom();
    button?.render(!overlayUp && !placing);
    spin = (spin + (dt > 0 ? dt : 0) * DECOR_PREVIEW_SPIN) % 360;
    if (panel?.isOpen()) {
      ensureScan().step();
      ensureRooms().step();   // DECOR-ROOMS: a few rays a frame until the house's rooms are found
      ensureDoorways()?.step();   // HOME-DOORS: then its doorways, so a door's line can say how many are free
      nameFromCatalogue();
      modsLiveIn -= dt > 0 ? dt : 0;   // AUDIT 05b A3
      panel.update(view());
      const pointed = panel.pointed();
      if (pointed?.model != null) modelFor(pointed.model);
    }
    if (!placing) return;
    placing.suspended = overlayUp;
    if (overlayUp) { bar?.hide(); return; }
    const p = placing;
    if (p.entry.model != null && !p.placer) {
      const m = modelFor(p.entry.model);
      if (m) p.placer = createDecorPlacer(p.entry, { radius: p.radius, box: m.box, from: p.editing, free: p.free });
    }
    const held = (a) => flyHeld.has(a);
    const stick = stickMove(deps.stick?.() ?? null);   // DECOR1e: an analog stick in hand is read over the walk keys
    const move = {
      forward: stick ? stick.forward : (held('MoveForwards') ? 1 : 0) - (held('MoveBackwards') ? 1 : 0),
      strafe: stick ? stick.strafe : (held('MoveRight') ? 1 : 0) - (held('MoveLeft') ? 1 : 0),
      rise: Math.max(-1, Math.min(1, (held('Jump') ? 1 : 0) - (held('Crouch') ? 1 : 0) + p.rise)),
    };
    const origin = deps.origin?.() ?? [0, 0, 0];
    // DECOR1e: a moved piece is no surface for itself; AUDIT2 DECOR-SHELL 8: nor one just placed round the eye, until it is out
    p.inside = p.inside.filter((c) => inSkin(p.fly, c.box));
    const skips = [...(p.editing ? [decorKeyOf(p.editing.id)] : []), ...p.inside.map((c) => c.key)];
    const through = skips.length ? skips : null;
    const next = flyStep(p.fly, p.start, move, cam.yaw, cam.pitch, held('Run') ? DECOR_FLY_FAST : DECOR_FLY_SPEED, dt);
    p.fly = flyClip(deps.collider?.(), p.fly, next, through);   // DECOR-SHELL: never through the room's own faces
    const hit = eyeHit(deps.collider?.(), p.fly, lookDir(cam.yaw, cam.pitch), through);
    if (deps.lot) markLot(p);   // HOME-YARD: the lot's edge, marked while a piece is placed
    if (p.door) doorFrame(p, origin, cam);   // HOME-DOORS: fitted into the doorway looked at, never where the eye meets a surface
    else p.piece = p.placer ? p.placer.pieceAt(hit.point, origin, p.id, hit.normal, cam.yaw) : null;   // DECOR2c: a mount reads the surface
    if (p.decal && p.art) {   // DECOR2c: the ghost hangs where the mount will - or, with nothing to hang on, nowhere
      const quad = p.piece ? decorMountQuad(p.piece, origin, { w: p.art.w * p.piece.scale, h: p.art.h * p.piece.scale }) : null;
      renderer?.writeDecalSlot?.(p.decal, 0, decorMountFloats(quad));
    }
    const price = p.door && p.piece ? p.piece.paid : p.placer ? p.placer.price() : null;   // HOME-DOORS: a door's price is its fit's
    const edit = p.editing && p.placer ? decorEditPrice(p.radius, p.editing, p.door && p.piece ? p.piece.scale : p.placer.state().scale) : null;
    bar?.show({
      name: p.editing ? `Moving ${p.entry.name}` : p.entry.name, price, priceText: edit ? decorEditText(edit) : p.free ? 'free' : null,
      snap: !!p.placer?.state().snap, why: placingWhy(p, price),
    });
    if (p.batch && p.piece && p.flatSize) {
      const sc = p.piece.scale;
      p.batch.origin = [origin[0] + p.piece.pos[0], origin[1] + p.piece.pos[1], origin[2] + p.piece.pos[2]];
      p.batch.size = { w: p.flatSize.w * sc * (p.mirrors !== false && decorFlatMirrored(p.piece) ? -1 : 1), h: p.flatSize.h * sc };   // DECOR-FLIP: the ghost faces the way it will stand (DECOR-LPT: a tree never mirrors)
      if (p.batch.bounds) p.batch.bounds[3] = Math.hypot(p.batch.size.w, p.batch.size.h) * 0.5;
    }
  }

  /** HOME-DOORS: A DOOR'S FRAME OF THE FLIGHT - the house's rooms and doorways found a few rays a frame, the door fitted
   *  into the free doorway the eye looks at (or none), and every free doorway marked. */
  function doorFrame(p, origin, cam) {
    const r = ensureRooms();
    if (!r.done()) r.step();
    else ensureDoorways()?.step();
    const free = closableDoorways(p);
    // AUDIT: only a doorway the eye sees - a ray to its middle meets no wall short of it (half a thick wall's depth
    // spared: the middle stands inside the wall's thickness)
    const c = deps.collider?.() ?? null;
    const seen = c ? (mid, dist) => {
      const d = [(mid[0] - p.fly[0]) / dist, (mid[1] - p.fly[1]) / dist, (mid[2] - p.fly[2]) / dist];
      const hit = c.raycastHit(p.fly, d, dist, deps.walls ?? null);
      return !(typeof hit?.dist === 'number' && hit.dist < dist - DOOR_SIGHT_SPARE);
    } : null;
    const aimed = free ? decorDoorwayAimed(free, p.fly, lookDir(cam.yaw, cam.pitch), DECOR_EYE_REACH, seen) : null;
    const m = p.placer ? modelFor(p.entry.model) : null;
    const fit = aimed && m ? decorDoorFit(aimed, m.box, p.flip) : null;
    p.piece = fit ? decorPieceOf({
      id: p.id, model: p.entry.model, flat: null, pos: [fit.pos[0] - origin[0], fit.pos[1] - origin[1], fit.pos[2] - origin[2]],
      rot: [fit.yaw, 0, 0], scale: fit.scale, light: p.editing?.light ?? null, storage: false,
      paid: p.free ? 0 : decorPrice(p.radius ?? 0, fit.scale),
    }) : null;
    markDoorways(p, free ?? [], aimed);
  }
  /** HOME-YARD: THE LOT'S EDGE, as upright bands on the decal pass - written only when the lot moved. */
  function markLot(p) {
    const quads = deps.lot?.() ?? [];
    const sig = quads.map((q) => q.pos.map((v) => v.toFixed(2)).join(',')).join('|');
    if (sig === p.lotSig || !renderer?.createDecalBatch) return;
    p.lotSig = sig;
    p.lotMarks ??= renderer.createDecalBatch(DECOR_LOT_MARKS);   // FB1001 ROAD-LOT: the edge along the road's sides too
    markTex ??= renderer.uploadTexture?.('decor', 'doorway-mark', decorDoorMarkPixels(), { mips: false }) ?? null;
    const out = new Float32Array(DECAL_FLOATS * DECOR_LOT_MARKS);
    for (let i = 0; i < DECOR_LOT_MARKS; i++) {
      if (quads[i]) writeDecalQuad(out, i * DECAL_FLOATS, { ...quads[i], tint: DECOR_LOT_MARK, wet: 0 });
      else clearDecalQuad(out, i * DECAL_FLOATS);
    }
    renderer.writeDecalSlot?.(p.lotMarks, 0, out);
  }
  /** HOME-DOORS: the doorways' marks, written only when what they show changed. */
  function markDoorways(p, free, aimed) {
    const sig = `${free.map((w) => w.id).join(',')}|${aimed?.id ?? ''}`;
    if (sig === p.markSig) return;
    p.markSig = sig;
    if (!renderer?.createDecalBatch) return;
    p.marks ??= renderer.createDecalBatch(DECOR_DOOR_MARKS);
    markTex ??= renderer.uploadTexture?.('decor', 'doorway-mark', decorDoorMarkPixels(), { mips: false }) ?? null;
    const out = new Float32Array(DECAL_FLOATS * DECOR_DOOR_MARKS);
    for (let i = 0; i < DECOR_DOOR_MARKS; i++) {
      const w = free[i];
      if (!w) { clearDecalQuad(out, i * DECAL_FLOATS); continue; }
      writeDecalQuad(out, i * DECAL_FLOATS, { ...decorDoorwayQuad(w), tint: w === aimed ? DECOR_DOOR_MARK_AIMED : DECOR_DOOR_MARK_FREE, wet: 0 });
    }
    renderer.writeDecalSlot?.(p.marks, 0, out);
  }

  /** What the bar says under the piece: the service's refusal (a while), why it cannot be placed now, where it cannot
   *  stand, or that the look is off - the first that holds. */
  function placingWhy(p, price) {
    if (p.refused && now() - p.refused.at < DECOR_REFUSAL_MS) return p.refused.text;
    if (!p.placer) return 'Loading...';
    if (p.door && !p.piece) {   // HOME-DOORS
      const free = closableDoorways(p);
      if (!free) return DECOR_DOOR_FINDING;
      if (!free.length) return freeDoorways(p.editing?.id ?? null)?.length ? DECOR_DOOR_TOO_WIDE : DECOR_DOOR_NONE;   // AUDIT: free, but wider than this door closes
      return decorDoorAimLine(free.length);
    }
    if (!p.piece) return p.entry.mount ? DECOR_MOUNT_NO_SURFACE : 'It cannot stand there.';
    const lotWhy = whyNotHere(p) ?? null;   // HOME-YARD: the lot; SEAT-HALL: the Charter Room
    if (lotWhy) return lotWhy;
    if (p.editing) {   // a move is never refused for the room's count; a resize may be for the gold
      const { pay } = decorEditPrice(p.radius, p.editing, p.door ? p.piece.scale : p.placer.state().scale);
      const gold = deps.wallet?.().gold ?? 0;
      if (pay > gold) return `You need ${pay - gold} more gold.`;
      return !deps.touch && !deps.locked?.() ? 'Click to look around again.' : null;
    }
    if (p.free && !deps.packHas?.(p.entry.own)) return p.entry.furnishing ? 'It is no longer among your things.' : 'It is no longer in your pack.';   // DECOR2a (DECOR2b: furniture)
    const why = decorWhyNot({ price, ready: true, gold: deps.wallet?.().gold ?? 0, count: pool.size(), cap: capHere(deps.room?.()), yard: !!deps.room?.()?.yard, hall: !!deps.room?.()?.hall });
    if (why) return why;
    return !deps.touch && !deps.locked?.() ? 'Click to look around again.' : null;
  }

  /** While the camera flies, the eye is the camera's own, not the body's. */
  function cameraOverride(cam) {
    if (placing && !placing.suspended) cam.pos = [...placing.fly];
  }

  /** The piece being placed, drawn where it will stand (a model; a flat is `batches`). */
  function draw(r = renderer, texRemap = null) {
    const p = placing;
    if (!p || p.suspended || !p.piece || p.entry.model == null) return false;
    const m = modelFor(p.entry.model);
    if (!m || !inLaw(m.gpu, texRemap)) return false;   // AUDIT 05b A5: in the host's law first
    r?.drawMesh?.(m.gpu, decorMatrix(p.piece, deps.origin?.() ?? [0, 0, 0]), texRemap);
    return true;
  }
  const batches = () => (placing && !placing.suspended && placing.piece && placing.batch ? [placing.batch] : []);
  /** DECOR2c: the mount being hung, on the host's decal pass (the room's own mounts' call). */
  function drawMounts(r = renderer) {
    const p = placing;
    if (p && !p.suspended && p.marks && markTex) (r?.drawDecalPicture ?? r?.drawDecals)?.call(r, p.marks, markTex);   // HOME-DOORS: the doorways
    if (p && !p.suspended && p.lotMarks && markTex) (r?.drawDecalPicture ?? r?.drawDecals)?.call(r, p.lotMarks, markTex);   // HOME-YARD: the lot's edge
    if (!p || p.suspended || !p.piece || !p.decal || !p.art) return false;
    (r?.drawDecalPicture ?? r?.drawDecals)?.call(r, p.decal, p.art.tex);   // WEAPON-MOUNT: the ghost is the picture it will hang as
    return true;
  }

  /** THE PANEL'S PREVIEW: the pointed model, turning - drawn by the automap's and the bank's second camera pass
   *  (renderer.panelFrame) into the game canvas's rect under the preview's box, then copied into the preview's own
   *  canvas. A flat's preview is its picture, the panel's own. */
  function drawPreview(texRemap = null) {
    if (!panel?.isOpen() || !renderer?.panelFrame) return false;
    const e = panel.pointed();
    if (e?.model == null) return false;
    const m = modelFor(e.model);
    const box = panel.previewRect();
    const c = deps.canvas?.getBoundingClientRect?.();
    if (!m || !box || !c || !(c.width > 0) || !(c.height > 0) || !inLaw(m.gpu, texRemap)) return false;   // AUDIT 05b A5
    const sx = deps.canvas.width / c.width;
    const sy = deps.canvas.height / c.height;
    const rect = { x: (box.left - c.left) * sx, y: (box.top - c.top) * sy, w: box.width * sx, h: box.height * sy };
    if (!(rect.w >= 8) || !(rect.h >= 8)) return false;
    const [x0, y0, z0, x1, y1, z1] = m.box;
    const rad = Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2 || 1;
    const fov = 40 * (Math.PI / 180);
    const dist = (rad / Math.sin(fov / 2)) * 1.05;
    const proj = mirrorProjectionX(perspective(fov, rect.w / rect.h, Math.max(0.05, dist - rad * 1.5), dist + rad * 1.5));
    const eyeAt = lookAt([0, 0, -dist], [0, 0, 0], [0, 1, 0]);
    const model = multiply(trs(0, 0, 0, 0, spin, 0), trs(-(x0 + x1) / 2, -(y0 + y1) / 2, -(z0 + z1) / 2, 0, 0, 0));
    renderer.panelFrame({
      proj, view: eyeAt, lightDir: new Float32Array([0, 0.707, -0.707]), rect, clear: [0.055, 0.063, 0.075, 1],
      setup: () => { renderer.setFog?.('off'); renderer.setLighting?.(new Float32Array([0.8, 0.8, 0.8]), 0); },
    }, () => renderer.drawMesh(m.gpu, model, texRemap));
    // the card over the game is opaque, so the pass is copied into the preview's own canvas - in this frame, while the
    // game's drawing buffer still holds it (ui/screenshot.js reads it the same way)
    const pc = panel.previewCanvas?.();
    const ctx = pc?.getContext?.('2d');
    if (ctx) {
      const pw = Math.max(1, Math.round(rect.w));
      const ph = Math.max(1, Math.round(rect.h));
      if (pc.width !== pw || pc.height !== ph) { pc.width = pw; pc.height = ph; }
      try { ctx.drawImage(deps.canvas, rect.x, rect.y, rect.w, rect.h, 0, 0, pw, ph); } catch { /* a lost context copies nothing */ }
    }
    return true;
  }

  /** The room goes (the host's three teardowns): the flight ends, the panel closes, the button stands down. */
  function close() {
    if (placing) endPlacing();
    if (panel?.isOpen()) panel.close();
    button?.render(false);
  }

  return {
    frame, cameraOverride, draw, batches, drawMounts, drawPreview, close, openPanel, commit, back,
    setBase,   // BASE-HIDE: the room's own furniture out or back - the panel's door (and the pins')
    rentAct,   // HOME-RENT: a room offered, withdrawn, or the rent collected - the panel's door (and the pins')
    paintAct,   // HOME-LOOK: a look tried, put away or painted - the panel's door (and the pins')
    /** Whether the camera flies - the host hands the body no movement while it does. */
    flying: () => !!placing && !placing.suspended,
    panelOpen: () => !!panel?.isOpen(),
    /** The piece the ghost shows, or null (the pins' window onto a placement). */
    ghost: () => placing?.piece ?? null,
    placer: () => placing?.placer ?? null,
    /** What the bar says now, or null. */
    why: () => (placing ? placingWhy(placing, placing.door && placing.piece ? placing.piece.paid : placing.placer ? placing.placer.price() : null) : null),
    destroy() {
      close();
      listen(false);
      offRefresh?.();
      button?.destroy(); panel?.destroy(); bar?.destroy();
      button = panel = bar = null;
    },
  };
}
