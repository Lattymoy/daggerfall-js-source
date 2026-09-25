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
// DECOR2c - THE MOUNTS. A weapon or a shield among "Your things" is
// HUNG: the flight sets it flat on the surface the eye meets (the ray's
// own normal - scenes/decorRoom.js frames it), the turn spins it there,
// and the ghost is the picture itself, hanging where it will hang. No
// surface in reach, nothing to hang it on.
// ═══════════════════════════════════════════════════════════════════

import { createDecorScan } from '../systems/decorScan.js';
import { createDecorPlacer, DECOR_TURN_STEP, DECOR_TURN_FINE, DECOR_RAISE_STEP, DECOR_RAISE_FINE } from '../systems/decorPlacer.js';
import { createDecorButton, createDecorPanel, createDecorBar, decorWhyNot } from '../ui/decorPanel.js';
import { DECOR_CAP, DECOR_PRICE_PER_METRE, decorPrice, decorPieceOf, decorRefund, decorRescale, mintDecorId } from '../net/decorLaw.js';
import { decorKey, DECOR_KINDS, decorFlatLight } from '../systems/decorCatalogue.js';
import { decorOwnEntry, decorItemName } from '../systems/decorItems.js';
import { decorFurnishingEntry, isFurnishing } from '../systems/decorFurnish.js';
import { itemLongName } from '../systems/itemInfo.js';
import { decorMatrix, decorKeyOf, loadMountArt, decorMountQuad, decorMountFloats } from './decorRoom.js';
import { decorIsMount } from '../net/decorLaw.js';
import { decorMountDye } from '../systems/decorItems.js';
import { localAabb } from '../render/frustum.js';
import { billboardSize } from '../world/rmbFlats.js';
import { lookAt, perspective, mirrorProjectionX, trs, multiply } from '../world/mat4.js';
import { isTextEntryTarget } from '../ui/input.js';

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
/** DECOR2c: what the bar says while a mount has nothing to hang on. */
export const DECOR_MOUNT_NO_SURFACE = 'Look at a wall to hang it on.';
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
 *   room()           - where the player may decorate now: { kind: 'home'|'house'|'ship', where, mapId?, buildingKey? },
 *                      or null
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
 */
export function createDecorTool(deps) {
  const { renderer, pool } = deps;
  /** @type {any} */ let button = null;
  /** @type {any} */ let panel = null;
  /** @type {any} */ let bar = null;
  /** @type {any} */ let scan = null;
  /** @type {any} */ let slot = null;
  /** @type {any} */ let placing = null;
  let spin = 0;
  let named = false;
  let listening = false;
  /** @type {Set<string>} the flight's own held actions - its presses never reach the host */
  const flyHeld = new Set();
  /** @type {Map<number, {gpu: any, box: any}|null>} */
  const models = new Map();

  function modelFor(id) {
    if (models.has(id)) return models.get(id) ?? null;
    models.set(id, null);
    Promise.resolve(deps.getGpuMesh?.(id)).then((gpu) => {
      const cpu = deps.cpuModels?.get?.(id);
      if (gpu && cpu?.positions) models.set(id, { gpu, box: localAabb(cpu.positions) });
    }, () => {});
    return null;
  }

  function ensureDom() {
    if (panel || !deps.doc) return;
    const { doc, win, touch = false } = deps;
    button = createDecorButton({ doc, touch, onPress: () => openPanel() });
    panel = createDecorPanel({
      doc, win,
      onPlace: (entry) => beginPlacing(entry),
      onPlaceLook: (furn, look) => beginPlacing(decorLookEntry(furn, look)),   // DECOR2b
      onClose: () => { const s = slot; slot = null; if (s) deps.closeSlot?.(s); },
      thumbOf: (entry) => {
        if (entry.icon) return deps.iconUrl?.(entry.icon.archive, entry.icon.record, entry.icon.dye ?? null) ?? null;   // DECOR2a: the pack's own picture
        return entry.flat ? deps.iconUrl?.(entry.flat[0], entry.flat[1]) ?? null : null;
      },
      onMove: (piece) => beginPlacing(entryOf(piece), piece),
      onRemove: (piece) => { removePiece(piece); },
      onToggle: (piece, what) => { togglePiece(piece, what); },
    });
    bar = createDecorBar({
      doc, touch,
      on: {
        place: () => { commit(); }, back: () => back(),
        turnLeft: () => placing?.placer?.turn(-DECOR_TURN_STEP), turnRight: () => placing?.placer?.turn(DECOR_TURN_STEP),
        raise: () => placing?.placer?.raise(DECOR_RAISE_STEP), lower: () => placing?.placer?.raise(-DECOR_RAISE_STEP),
        smaller: () => placing?.placer?.rescale(false), bigger: () => placing?.placer?.rescale(true),
        grid: () => placing?.placer?.toggleSnap(),
        fly: (dir) => { if (placing) placing.rise = dir; },   // DECOR1e: a touch screen's Fly up/down, held
      },
    });
  }

  const ensureScan = () => { scan ??= createDecorScan(deps.scanDeps()); return scan; };
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
  /** A placed piece's catalogue entry - or, until the catalogue is read, the piece's own shape as one. DECOR2a: a piece
   *  of the owner's own is its own entry, free. */
  function entryOf(piece) {
    if (piece.item) {   // DECOR2b: furniture stands as a look - a model as often as a flat
      return {
        key: `own-piece:${piece.id}`, kind: 'own', model: piece.model ?? null, flat: piece.flat ?? null, item: piece.item, name: ownName(piece), count: 0,
        storage: false, light: decorFlatLight(piece.flat), mount: decorIsMount(piece),   // DECOR2c: a hung one moves as it hangs
      };
    }
    const key = decorKey(piece);
    const e = scan?.entries()?.find((x) => x.key === key);
    if (e) return e;
    return {
      key, model: piece.model ?? null, flat: piece.flat ?? null, kind: piece.model != null ? 'furniture' : 'decor',
      name: deps.names?.get(key) ?? DECOR_KINDS[piece.model != null ? 'furniture' : 'decor'], count: 0, storage: !!piece.storage, light: piece.light ?? null,
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
    return {
      placed: pool.list().map((piece) => {
        const entry = entryOf(piece);
        return { piece, entry: entry.count ? entry : null, name: entry.name, holds: !!pool.holdsAny?.(piece.id), own: !!piece.item };
      }),
      // DECOR2a: what in the pack can stand here - free, and back to the pack when taken down
      own: ownEntries(),
      where: r?.where ?? '',
      entries: s.entries(),
      progress: s.progress(),
      ready: s.phase() === 'done',
      radiusOf: (e) => s.radiusOf(e),
      priceOf: (e) => { const rad = s.radiusOf(e); return rad ? decorPrice(rad, 1) : null; },
      gold: deps.wallet?.().gold ?? 0,
      count: pool.size(),
      cap: DECOR_CAP,
    };
  }

  /** THE BUTTON'S PRESS: the panel opens over the room (paused, the pointer freed - the slot's doing). */
  function openPanel() {
    if (!deps.room?.() || placing || panel?.isOpen()) return false;
    ensureDom();
    if (!panel) return false;
    slot = panel.open(view());
    if (slot) deps.openSlot?.(slot);
    return !!slot;
  }

  // ── THE FREE CAMERA ───────────────────────────────────────────────
  /** A new piece from the catalogue, or (DECOR1e) `editing`, a placed piece moved - its own id, turn, scale, light and
   *  storage; its size, when the scan has not read it yet, is what it was priced at. */
  function beginPlacing(catalogueEntry, editing = null) {
    const s = ensureScan();
    const entry = editing ? { ...catalogueEntry, light: editing.light ?? null, storage: !!editing.storage } : catalogueEntry;
    const free = entry.kind === 'own';   // DECOR2a: the player's own item - no price, whatever its size
    const radius = free ? null : s.radiusOf(catalogueEntry) ?? (editing ? editing.paid / (DECOR_PRICE_PER_METRE * editing.scale) : null);
    const eye = deps.eye?.() ?? [0, 0, 0];
    placing = {
      entry, radius, editing, free, placer: null, fly: [...eye], start: [...eye], id: editing ? editing.id : mintDecorId(), piece: null,
      refused: null, busy: false, batch: null, flatSize: null, rise: 0, art: null, decal: null,
    };
    deps.cursorOff?.();   // a cursor freed to press the button would hold the look off for the whole placement
    if (entry.mount) {   // DECOR2c: the picture itself hangs where it will hang
      const p = placing;
      Promise.resolve(loadMountArt({ getTexture: deps.getTexture, uploadRecord: deps.uploadRecord, renderer }, entry.flat[0], entry.flat[1], decorMountDye(entry.item))).then((art) => {
        if (placing !== p || !art) return;
        p.art = art;
        p.decal = renderer?.createDecalBatch?.(1) ?? null;
        p.placer = createDecorPlacer(entry, { radius, from: editing, free });
      }, () => {});
    } else if (entry.model == null) {
      const p = placing;
      Promise.resolve(deps.getTexture?.(entry.flat[0])).then((t) => {
        if (placing !== p || !t || !(entry.flat[1] < t.recordCount)) return;
        deps.uploadRecord?.(entry.flat[0], entry.flat[1]);
        p.flatSize = billboardSize(t, entry.flat[1]);
        p.placer = createDecorPlacer(entry, { radius, from: editing, free });
        if (renderer?.createBillboardBatch) p.batch = renderer.createBillboardBatch(entry.flat[0], entry.flat[1], { ...p.flatSize }, [[0, 0, 0]]);
      }, () => {});
    }
    listen(true);
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
    if (decorWhyNot({ price, ready: true, gold: deps.wallet().gold, count: pool.size(), cap: DECOR_CAP })) return false;   // the bar says why
    p.busy = true;
    p.refused = null;
    const piece = p.piece;
    try {
      if (r.kind === 'home') {
        const visit = deps.visit?.();
        const res = await deps.homeDecor?.place?.({ mapId: r.mapId, buildingKey: r.buildingKey, character: deps.character?.(), piece });
        if (!res?.ok) { p.refused = { text: deps.refusal?.(res?.error) ?? 'The piece could not be placed.', at: now() }; return false; }
        const wallet = deps.wallet();
        if (wallet.gold < price) {   // the gold went while the service was asked: the piece is taken back out
          await deps.homeDecor.remove?.({ mapId: r.mapId, buildingKey: r.buildingKey, character: deps.character?.(), id: piece.id });
          return false;
        }
        wallet.pay(price);
        if (deps.visit?.() === visit) pool.put(decorPieceOf(res.data?.piece) ?? piece);
      } else {
        deps.wallet().pay(price);
        pool.put(piece);
      }
      deps.say?.(`${p.entry.name} placed for ${price} gold.`);
      p.id = mintDecorId();   // the next of the same piece is a new piece
      return true;
    } finally {
      p.busy = false;
    }
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
  const placeOf = (piece) => ({ pos: piece.pos, rot: piece.rot, scale: piece.scale, light: piece.light, storage: piece.storage, paid: piece.paid });

  /** Write a placed piece's change - through the account service in an online home, into the room's pool (and so the
   *  save) elsewhere - and answer the piece as it now stands, or null (the bar or the line says why). */
  async function writeChange(r, piece) {
    if (r.kind !== 'home') return piece;
    const res = await deps.homeDecor?.move?.({ mapId: r.mapId, buildingKey: r.buildingKey, character: deps.character?.(), id: piece.id, place: placeOf(piece) });
    if (!res?.ok) { deps.say?.(deps.refusal?.(res?.error) ?? 'The piece could not be changed.'); return null; }
    return decorPieceOf(res.data?.piece) ?? piece;
  }

  /** DECOR1e: MOVE A PLACED PIECE to where the ghost shows it - free, or its resize's difference paid or half given
   *  back - then back to the room's view with the piece chosen. */
  async function commitMove(p, r) {
    const was = p.editing;
    const price = decorEditPrice(p.radius, was, p.piece.scale);
    if (price.pay > (deps.wallet?.().gold ?? 0)) return false;   // the bar says why
    p.busy = true;
    const next = { ...p.piece, paid: price.paid };
    const visit = deps.visit?.();
    try {
      const stood = await writeChange(r, next);
      if (!stood) return false;
      if (price.pay > (deps.wallet?.().gold ?? 0)) {   // the gold went while the service was asked: it stands as it was
        await writeChange(r, was);
        return false;
      }
      if (price.pay > 0) deps.wallet().pay(price.pay);
      if (price.refund > 0) deps.wallet().credit?.(price.refund);
      if (deps.visit?.() === visit) pool.put(stood);
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
    if (r.kind === 'home') {
      const res = await deps.homeDecor?.remove?.({ mapId: r.mapId, buildingKey: r.buildingKey, character: deps.character?.(), id: piece.id });
      if (!res?.ok) { deps.say?.(deps.refusal?.(res?.error) ?? 'The piece could not be removed.'); return false; }
      paid = decorPieceOf(res.data?.piece)?.paid ?? paid;   // the service's own record of what it cost
    }
    if (deps.visit?.() === visit) pool.remove(piece.id);
    const back = decorRefund(paid);
    if (back > 0) deps.wallet?.().credit?.(back);
    deps.say?.(`${entryOf(piece).name} removed - ${back} gold back.`);
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

  // THE KEYS AND PRESSES WHILE THE CAMERA FLIES, taken before the host sees them
  const turn = (e, dir) => placing?.placer?.turn(dir * (e.shiftKey ? DECOR_TURN_FINE : DECOR_TURN_STEP));
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
      nameFromCatalogue();
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
    p.fly = flyStep(p.fly, p.start, move, cam.yaw, cam.pitch, held('Run') ? DECOR_FLY_FAST : DECOR_FLY_SPEED, dt);
    const origin = deps.origin?.() ?? [0, 0, 0];
    const through = p.editing ? [decorKeyOf(p.editing.id)] : null;   // DECOR1e: a moved piece is no surface for itself
    const hit = eyeHit(deps.collider?.(), p.fly, lookDir(cam.yaw, cam.pitch), through);
    p.piece = p.placer ? p.placer.pieceAt(hit.point, origin, p.id, hit.normal, cam.yaw) : null;   // DECOR2c: a mount reads the surface
    if (p.decal && p.art) {   // DECOR2c: the ghost hangs where the mount will - or, with nothing to hang on, nowhere
      const quad = p.piece ? decorMountQuad(p.piece, origin, { w: p.art.w * p.piece.scale, h: p.art.h * p.piece.scale }) : null;
      renderer?.writeDecalSlot?.(p.decal, 0, decorMountFloats(quad));
    }
    const price = p.placer ? p.placer.price() : null;
    const edit = p.editing && p.placer ? decorEditPrice(p.radius, p.editing, p.placer.state().scale) : null;
    bar?.show({
      name: p.editing ? `Moving ${p.entry.name}` : p.entry.name, price, priceText: edit ? decorEditText(edit) : p.free ? 'free' : null,
      snap: !!p.placer?.state().snap, why: placingWhy(p, price),
    });
    if (p.batch && p.piece && p.flatSize) {
      const sc = p.piece.scale;
      p.batch.origin = [origin[0] + p.piece.pos[0], origin[1] + p.piece.pos[1], origin[2] + p.piece.pos[2]];
      p.batch.size = { w: p.flatSize.w * sc, h: p.flatSize.h * sc };
      if (p.batch.bounds) p.batch.bounds[3] = Math.hypot(p.batch.size.w, p.batch.size.h) * 0.5;
    }
  }

  /** What the bar says under the piece: the service's refusal (a while), why it cannot be placed now, where it cannot
   *  stand, or that the look is off - the first that holds. */
  function placingWhy(p, price) {
    if (p.refused && now() - p.refused.at < DECOR_REFUSAL_MS) return p.refused.text;
    if (!p.placer) return 'Loading...';
    if (!p.piece) return p.entry.mount ? DECOR_MOUNT_NO_SURFACE : 'It cannot stand there.';
    if (p.editing) {   // a move is never refused for the room's count; a resize may be for the gold
      const { pay } = decorEditPrice(p.radius, p.editing, p.placer.state().scale);
      const gold = deps.wallet?.().gold ?? 0;
      if (pay > gold) return `You need ${pay - gold} more gold.`;
      return !deps.touch && !deps.locked?.() ? 'Click to look around again.' : null;
    }
    if (p.free && !deps.packHas?.(p.entry.own)) return p.entry.furnishing ? 'It is no longer among your things.' : 'It is no longer in your pack.';   // DECOR2a (DECOR2b: furniture)
    const why = decorWhyNot({ price, ready: true, gold: deps.wallet?.().gold ?? 0, count: pool.size(), cap: DECOR_CAP });
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
    if (!m) return false;
    r?.drawMesh?.(m.gpu, decorMatrix(p.piece, deps.origin?.() ?? [0, 0, 0]), texRemap);
    return true;
  }
  const batches = () => (placing && !placing.suspended && placing.piece && placing.batch ? [placing.batch] : []);
  /** DECOR2c: the mount being hung, on the host's decal pass (the room's own mounts' call). */
  function drawMounts(r = renderer) {
    const p = placing;
    if (!p || p.suspended || !p.piece || !p.decal || !p.art) return false;
    r?.drawDecals?.(p.decal, p.art.tex);
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
    if (!m || !box || !c || !(c.width > 0) || !(c.height > 0)) return false;
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
    /** Whether the camera flies - the host hands the body no movement while it does. */
    flying: () => !!placing && !placing.suspended,
    panelOpen: () => !!panel?.isOpen(),
    /** The piece the ghost shows, or null (the pins' window onto a placement). */
    ghost: () => placing?.piece ?? null,
    placer: () => placing?.placer ?? null,
    /** What the bar says now, or null. */
    why: () => (placing ? placingWhy(placing, placing.placer ? placing.placer.price() : null) : null),
    destroy() {
      close();
      listen(false);
      button?.destroy(); panel?.destroy(); bar?.destroy();
      button = panel = bar = null;
    },
  };
}
