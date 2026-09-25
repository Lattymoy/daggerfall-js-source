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
// ═══════════════════════════════════════════════════════════════════

import { createDecorScan } from '../systems/decorScan.js';
import { createDecorPlacer, DECOR_TURN_STEP, DECOR_TURN_FINE, DECOR_RAISE_STEP, DECOR_RAISE_FINE } from '../systems/decorPlacer.js';
import { createDecorButton, createDecorPanel, createDecorBar, decorWhyNot } from '../ui/decorPanel.js';
import { DECOR_CAP, decorPrice, decorPieceOf, mintDecorId } from '../net/decorLaw.js';
import { decorMatrix } from './decorRoom.js';
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

/**
 * The surface point the eye meets, or the point it hangs at when it meets none - `collider.raycastHit` (the room's
 * own, player/collider.js), within DECOR_EYE_REACH.
 */
export function eyePoint(collider, eye, dir) {
  let d = DECOR_FLOAT_AT;
  try {
    const hit = collider?.raycastHit ? collider.raycastHit(eye, dir, DECOR_EYE_REACH) : null;
    if (hit && Number.isFinite(hit.dist)) d = hit.dist;
  } catch { /* no surface to meet */ }
  return [eye[0] + dir[0] * d, eye[1] + dir[1] * d, eye[2] + dir[2] * d];
}

/**
 * THE TOOL. `deps` (the host's - worldModes.js):
 *   doc, win, canvas, touch
 *   renderer         - drawMesh, panelFrame, createBillboardBatch, destroyBillboardBatch
 *   pool             - the room's placed pieces (scenes/decorRoom.js)
 *   names            - the host's Map of hover names by piece key, filled once the catalogue is read
 *   room()           - where the player may decorate now: { kind: 'home'|'house'|'ship', where, mapId?, buildingKey? },
 *                      or null
 *   scanDeps()       - systems/decorScan.js's deps (the blocks, the two measures)
 *   getGpuMesh(id), cpuModels, getTexture(a), uploadRecord(a, r), iconUrl(a, r) - the pipeline's, and the DOM's door
 *   collider(), origin() - the room's collider and this visit's building origin; eye() - the camera's eye now
 *   actionOf(e)      - the action a key event is bound to, or null (ui/input.js actionOf, the registry's)
 *   locked()         - whether the pointer is locked to the canvas; cursorOff() - put away a cursor the player freed
 *                      (Enter), so the look can lock again when a placement begins
 *   now()            - the clock, milliseconds
 *   wallet()         - { gold, pay(n) } - the purse, then the region's bank
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
      onClose: () => { const s = slot; slot = null; if (s) deps.closeSlot?.(s); },
      thumbOf: (entry) => (entry.flat ? deps.iconUrl?.(entry.flat[0], entry.flat[1]) ?? null : null),
    });
    bar = createDecorBar({
      doc, touch,
      on: {
        place: () => { commit(); }, back: () => back(),
        turnLeft: () => placing?.placer?.turn(-DECOR_TURN_STEP), turnRight: () => placing?.placer?.turn(DECOR_TURN_STEP),
        raise: () => placing?.placer?.raise(DECOR_RAISE_STEP), lower: () => placing?.placer?.raise(-DECOR_RAISE_STEP),
        smaller: () => placing?.placer?.rescale(false), bigger: () => placing?.placer?.rescale(true),
        grid: () => placing?.placer?.toggleSnap(),
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

  function view() {
    const r = deps.room?.();
    const s = ensureScan();
    return {
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
  function beginPlacing(entry) {
    const s = ensureScan();
    const radius = s.radiusOf(entry);
    const eye = deps.eye?.() ?? [0, 0, 0];
    placing = { entry, radius, placer: null, fly: [...eye], start: [...eye], id: mintDecorId(), piece: null, refused: null, busy: false, batch: null, flatSize: null };
    deps.cursorOff?.();   // a cursor freed to press the button would hold the look off for the whole placement
    if (entry.model == null) {
      const p = placing;
      Promise.resolve(deps.getTexture?.(entry.flat[0])).then((t) => {
        if (placing !== p || !t || !(entry.flat[1] < t.recordCount)) return;
        deps.uploadRecord?.(entry.flat[0], entry.flat[1]);
        p.flatSize = billboardSize(t, entry.flat[1]);
        p.placer = createDecorPlacer(entry, { radius });
        if (renderer?.createBillboardBatch) p.batch = renderer.createBillboardBatch(entry.flat[0], entry.flat[1], { ...p.flatSize }, [[0, 0, 0]]);
      }, () => {});
    }
    listen(true);
  }

  /** Back to the panel (Escape, a right press, the Back button) - the piece chosen stays chosen. */
  function back() {
    const key = placing?.entry?.key ?? null;
    endPlacing();
    if (openPanel() && key) panel.select(key);
  }

  function endPlacing() {
    const p = placing;
    placing = null;
    flyHeld.clear();
    if (p?.batch) renderer?.destroyBillboardBatch?.(p.batch);
    bar?.hide();
    listen(false);
  }

  /** PLACE THE PIECE the ghost shows - paid for, and stood. */
  async function commit() {
    const p = placing;
    if (!p || p.busy || !p.piece) return false;
    const r = deps.room?.();
    if (!r) { endPlacing(); return false; }
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
      if (m) p.placer = createDecorPlacer(p.entry, { radius: p.radius, box: m.box });
    }
    const held = (a) => flyHeld.has(a);
    const move = {
      forward: (held('MoveForwards') ? 1 : 0) - (held('MoveBackwards') ? 1 : 0),
      strafe: (held('MoveRight') ? 1 : 0) - (held('MoveLeft') ? 1 : 0),
      rise: (held('Jump') ? 1 : 0) - (held('Crouch') ? 1 : 0),
    };
    p.fly = flyStep(p.fly, p.start, move, cam.yaw, cam.pitch, held('Run') ? DECOR_FLY_FAST : DECOR_FLY_SPEED, dt);
    const origin = deps.origin?.() ?? [0, 0, 0];
    p.piece = p.placer ? p.placer.pieceAt(eyePoint(deps.collider?.(), p.fly, lookDir(cam.yaw, cam.pitch)), origin, p.id) : null;
    const price = p.placer ? p.placer.price() : null;
    bar?.show({ name: p.entry.name, price, snap: !!p.placer?.state().snap, why: placingWhy(p, price) });
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
    if (!p.piece) return 'It cannot stand there.';
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
    frame, cameraOverride, draw, batches, drawPreview, close, openPanel, commit, back,
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
