// @ts-check
// ═══════════════════════════════════════════════════════════════════
// POI-3 (2026-10-14) - THE EDITOR'S DOCUMENTS: WHAT A BUILDER IS CHANGING, AND EVERY STEP BACK.
//
// Mac: "POI Tool (General Map Editor) - Realtime editor ... I want this to be a tool my developers can use without having
// to access the codebase ... No short cuts or band aids" (bible/06-Systems/POI-Editor-Arc.md). The editor's model, pure
// (no DOM, no GL, no network) so the in-game editor (scenes/poiEditorHost.js) and the tests read it the same way:
//
//   - THE WORKING SET (`open`, `create`): each POI being edited is its document as the law keeps it (poi/poiLaw.js) -
//     opened from the live set or a draft, or made new - beside the document as it was last SAVED, so "unsaved" is a
//     comparison, never a flag someone forgot to clear.
//   - EVERY CHANGE IS ONE STEP (`edit`): the document before and after, as text, on one undo stack across the whole
//     set (the order the builder made them, whichever POI each touched), with the selection each step left. A step that
//     changes nothing is no step. A drag (`begin` / `preview` / `commit`) is ONE step however many frames it moved: each
//     preview is applied to the document as the drag found it - absolute from its start, so a long drag gathers no error
//     - and `cancel` puts it back. The stack holds POI_UNDO_DEPTH steps; the oldest go first.
//   - THE TRANSFORMS (`movePlace`, `rotatePlace`, `movePart`, ...): a POI stands in its PIXEL's frame (east x, north z,
//     metres from the south-west corner - scenes/poiHost.js), so a move is made in map metres and the place renormalised:
//     a POI dragged over a pixel's edge belongs to the next pixel, its numbers in that one's frame. A part's transform is
//     in its POI's frame (after the place's turn and size), so a world move or turn is carried into it.
//   - UNITY'S EULER ANGLES (`eulerOfQuat`, `quatOfEuler`): the inspector's three numbers, in the engine's own order - Z,
//     then X, then Y (Transform.eulerAngles) - over the quaternion the document keeps.
//
// Not a DFU member. Ledger A (POI).
// ═══════════════════════════════════════════════════════════════════

import { POI_DOC_VERSION, POI_PIXEL_M, POI_MAP, POI_PART_KEY_RE, POI_LIMITS, DEFAULT_MATERIAL, mintPoiId } from './poiLaw.js';
import { quatMultiply, quatAngleAxis, quatRotate } from '../world/quat.js';

/** The steps the undo stack keeps before the oldest is let go. */
export const POI_UNDO_DEPTH = 200;
/** A position's numbers as the editor writes them: to a tenth of a millimetre (the law takes any finite number; a
 *  document full of float noise reads badly in a review's before-and-after). */
const POS_STEP = 1e-4;
const tidy = (v, step = POS_STEP) => { const r = Math.round(v / step) * step; return Math.abs(r) < step / 2 ? 0 : Number(r.toFixed(6)); };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ── QUATERNIONS ───────────────────────────────────────────────────
/** A unit quaternion, its numbers tidied (the law's tolerance is a thousandth; these are good to a millionth). */
export function tidyQuat(q) {
  const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  let out = q.map((c) => c / n);
  if (out[3] < 0) out = out.map((c) => -c);   // the same turn, written with w >= 0 (one spelling a turn)
  return out.map((c) => { const r = Math.round(c * 1e6) / 1e6; return r === 0 ? 0 : r; });
}
const conj = (q) => [-q[0], -q[1], -q[2], q[3]];
const DEG = 180 / Math.PI;
/** AUDIT POI E4: the pitch's cosine (the rotation's own, off its matrix) under which it looks straight up or down - a
 *  pitch within ~0.0006 degrees of 90. A turn made exactly there (typed, snapped, or a gizmo's 90 about an axis) reads
 *  as the pole through a tidied quaternion's noise (a millionth a number), and a turn read either side of it comes back
 *  to within 0.0003 degrees whichever of its three numbers is typed over next. */
const POLE_COS = 1e-5;

/**
 * Unity's Transform.eulerAngles of a rotation: `[x, y, z]` in degrees, the turn made as Z, then X, then Y
 * (q = Y * X * Z), each in [0, 360) as the engine shows them.
 * @param {number[]} q [x, y, z, w]
 */
export function eulerOfQuat(q) {
  const [x, y, z, w] = q;
  // AUDIT POI E4: the rotation's matrix, every term over the quaternion's own square length (homogeneous), so a quaternion
  // tidied to a millionth - its length a millionth off one - is read as the turn it is. The pole was asked of
  // |2(wx - yz)| > 0.999999, which the tidy's own rounding missed by up to four millionths: a pitch of 90 fell into the
  // general arm, whose yaw and roll were then atan2 of rounding noise - yaw 45 at a pitch of 90 read [89.9071, 0, 0], and
  // a roll typed over those numbers committed a turn 45 degrees off what was meant.
  const n = x * x + y * y + z * z + w * w || 1;
  const sx = 2 * (w * x - y * z), m02 = 2 * (x * z + w * y), m22 = w * w - x * x - y * y + z * z, cx = Math.hypot(m02, m22);
  let ex, ey, ez;
  if (cx / n < POLE_COS) {
    // looking straight up or down: the yaw and the roll are one turn - all of it given to the yaw, read off the
    // matrix's top row as the engine reads it (Unity's MatrixToEuler), the roll nought
    const s = Math.sign(sx) || 1;
    ex = s * 90;
    ey = Math.atan2(s * 2 * (x * y - w * z), w * w + x * x - y * y - z * z) * DEG;
    ez = 0;
  } else {
    ex = Math.atan2(sx, cx) * DEG;
    ey = Math.atan2(m02, m22) * DEG;
    ez = Math.atan2(2 * (w * z + x * y), w * w - x * x + y * y - z * z) * DEG;
  }
  const wrap = (a) => { const r = ((a % 360) + 360) % 360; const t = Math.round(r * 1e4) / 1e4; return t >= 360 ? 0 : t; };
  return [wrap(ex), wrap(ey), wrap(ez)];
}
/** The rotation Unity's Quaternion.Euler(x, y, z) makes - Z, then X, then Y. @param {number[]} e degrees */
export function quatOfEuler(e) {
  const qx = quatAngleAxis(e[0], [1, 0, 0]), qy = quatAngleAxis(e[1], [0, 1, 0]), qz = quatAngleAxis(e[2], [0, 0, 1]);
  return tidyQuat(quatMultiply(qy, quatMultiply(qx, qz)));
}

// ── THE PLACE: MAP METRES AND THE PIXEL'S FRAME ───────────────────
/** A place's spot in map metres: east of the map's west edge, and north of its northern edge (so the map is
 *  [0, 1000 x 819.2) east by (-500 x 819.2, 0] north - streamingWorld.js pixelTranslation's own signs). */
export const mapMetresOf = (place) => [place.px * POI_PIXEL_M + place.x, -place.py * POI_PIXEL_M + place.z];

/** Stand `place` at map metres (X, Z): the pixel the spot falls in, and the spot in that pixel's frame - clamped to the
 *  map. Answers the place (changed in place). */
export function placeAtMapMetres(place, X, Z) {
  const S = POI_PIXEL_M;
  const maxX = POI_MAP.w * S - POS_STEP, minZ = -(POI_MAP.h - 1) * S;
  const cx = clamp(X, 0, maxX), cz = clamp(Z, minZ, S - POS_STEP);
  let px = Math.floor(cx / S), py = -Math.floor(cz / S);
  let x = tidy(cx - px * S), z = tidy(cz + py * S);
  // a spot tidied onto the edge belongs to the next pixel, at its nought
  if (x >= S) { px += 1; x = 0; }
  if (z >= S) { py -= 1; z = 0; }
  place.px = clamp(px, 0, POI_MAP.w - 1); place.py = clamp(py, 0, POI_MAP.h - 1);
  place.x = x; place.z = z;
  return place;
}

/** Move a place by a world delta (metres: east, up, north). @param {any} place @param {number[]} d */
export function movePlace(place, d) {
  const [X, Z] = mapMetresOf(place);
  placeAtMapMetres(place, X + d[0], Z + d[2]);
  place.y = tidy(clamp(place.y + d[1], -4000, 4000));
  return place;
}
/** Turn a place about a WORLD axis through its own origin. @param {any} place @param {number[]} axis @param {number} deg */
export function rotatePlace(place, axis, deg) {
  place.r = tidyQuat(quatMultiply(quatAngleAxis(deg, axis), place.r));
  return place;
}
/** Size a place by a factor (the law's 0.01 - 100, uniform). */
export function scalePlace(place, f) {
  place.s = Number(clamp(place.s * f, 0.01, 100).toFixed(6));
  return place;
}

// ── A PART: IN ITS POI'S FRAME ────────────────────────────────────
/** A world delta as a part's own offset change: the place's turn and size taken back out. */
export const worldToPlace = (place, d) => quatRotate(conj(place.r), d).map((c) => c / place.s);
/** The part's rotation in the world (the place's turn, then its own). */
export const partWorldQuat = (place, part) => quatMultiply(place.r, part.r);
/** Where a part's origin stands, relative to its place's origin, in world metres. */
export const partWorldOffset = (place, part) => quatRotate(place.r, part.t).map((c) => c * place.s);

export function movePart(place, part, d) {
  const l = worldToPlace(place, d);
  part.t = part.t.map((c, i) => tidy(clamp(c + l[i], -2000, 2000)));
  return part;
}
/** Turn a part about a WORLD axis through its own origin. */
export function rotatePart(place, part, axis, deg) {
  const local = quatRotate(conj(place.r), axis);
  part.r = tidyQuat(quatMultiply(quatAngleAxis(deg, local), part.r));
  return part;
}
/** Size a part along its own axes (the law's 0.001 - 1000 a side; a negative side mirrors it). */
export function scalePart(part, f) {
  part.s = part.s.map((c, i) => {
    const v = c * f[i], sign = Math.sign(v) || 1;
    return Number((sign * clamp(Math.abs(v), 0.001, 1000)).toFixed(6));
  });
  return part;
}

// ── MAKING THINGS ─────────────────────────────────────────────────
/** A part's key from a wanted name: the law's spelling (lower case, digits, `_` and `-`, 32 at most), made unique in the
 *  document by a number. @param {any} doc @param {string} wanted */
export function uniqueKey(doc, wanted) {
  const taken = new Set((doc.parts ?? []).map((p) => p.key));
  let base = String(wanted ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-').replace(/^[^a-z0-9]+/, '').replace(/-+$/, '').slice(0, 28);
  if (!base) base = 'part';
  if (!taken.has(base) && POI_PART_KEY_RE.test(base)) return base;
  for (let n = 2; ; n++) { const k = `${base}-${n}`; if (!taken.has(k)) return k; }
}
/** A name as the law takes it: printable, trimmed, bounded. */
// AUDIT POI (the lead's; lane A's S13): every character the law now refuses in a name (poiLaw.js UNSAID_RE - controls, a
// lone half of a pair, the line and paragraph separators, the bidirectional controls) made a space - a name pasted with
// one was tidied here and refused at the save - and the cut to its length never leaves half a pair at its end
const NAME_UNSAID_G = /[\p{Cc}\p{Cs}\u{2028}\u{2029}\u{202a}-\u{202e}\u{2066}-\u{2069}]/gu;
export const lawName = (s, max = /** @type {number} */ (POI_LIMITS.name)) => String(s ?? '').replace(NAME_UNSAID_G, ' ').replace(/\s+/g, ' ').trim().slice(0, max).replace(/[\uD800-\uDBFF]$/, '').trim();

/** A material as the document keeps it: the default's every field, `over` laid on it. */
export const newMaterial = (over = {}) => ({ ...structuredClone(DEFAULT_MATERIAL), ...structuredClone(over) });

/**
 * A part over a mesh: at its POI's origin, unturned, its size one, collided and shadowed, a material a submesh (the
 * import's own, or the default's).
 * @param {any} doc @param {{ mesh: string, submeshes: number, name?: string, materials?: any[], t?: number[], r?: number[], s?: number[] }} o
 */
export function newPart(doc, { mesh, submeshes, name = '', materials = null, t = [0, 0, 0], r = [0, 0, 0, 1], s = [1, 1, 1] }) {
  const n = Math.max(1, submeshes | 0);
  const mats = Array.from({ length: n }, (_, i) => newMaterial(materials?.[i] ?? {}));
  const nm = lawName(name);
  return { key: uniqueKey(doc, nm || 'part'), ...(nm ? { name: nm } : {}), mesh, t: t.map((c) => tidy(c)), r: tidyQuat(r), s: [...s], collide: 'mesh', shadow: true, materials: mats };
}
/** A light at a POI's origin: warm, five metres, steady. */
export const newLight = (t = [0, 2, 0]) => ({ t: t.map((c) => tidy(c)), color: [1, 0.85, 0.6], radius: 5, intensity: 1, flicker: false });

/** A fresh document at a spot: no parts yet (the law asks for one before a save - the editor says so), standing on the
 *  ground, unmarked. `name` the editor's, in the builder's language (poi/poiText.js).
 *  @param {{ id: string, px: number, py: number, x: number, z: number, y?: number, name: string }} o */
export function newPoiDoc({ id, px, py, x, z, y = 0, name }) {
  const place = { px, py, x: 0, z: 0, y: tidy(y), ground: 'snap', r: [0, 0, 0, 1], s: 1 };
  placeAtMapMetres(place, px * POI_PIXEL_M + x, -py * POI_PIXEL_M + z);
  return { v: POI_DOC_VERSION, id, name: lawName(name), place, parts: [], lights: [], marker: { show: false } };
}

// ── THE WORKING SET AND ITS UNDO ──────────────────────────────────
const text = (d) => (d == null ? null : JSON.stringify(d));
const sameSel = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * @typedef {{ id: string, part?: string | null, light?: number | null } | null} PoiSelection
 * @typedef {{ doc: any, saved: string | null, base: number | null, rev: number | null, state: string }} PoiEntry
 *   `saved` the document as last saved (null: never - a new POI); `base` the live revision it was made from; `rev` its
 *   own draft's revision once saved; `state` the service's word for that revision ('new' until it has one)
 */

/**
 * @param {{ rand?: (b: Uint8Array) => Uint8Array, depth?: number }} [opts] `rand` fills bytes (crypto.getRandomValues)
 */
export function createPoiEdit({ rand = (b) => { globalThis.crypto.getRandomValues(/** @type {any} */ (b)); return b; }, depth = POI_UNDO_DEPTH } = {}) {
  /** @type {Map<string, PoiEntry>} */
  const docs = new Map();
  /** @type {Array<{ id: string, label: string, before: string | null, after: string | null, selBefore: PoiSelection, selAfter: PoiSelection, entryBefore?: any, entryAfter?: any }>} */
  let undo = [], redo = [];
  /** @type {PoiSelection} */
  let sel = null;
  /** @type {{ id: string, label: string, start: string, selBefore: PoiSelection } | null} */
  let drag = null;
  let gen = 0;
  /** POI-6: what this screen shows in a POI's place instead (showAs). @type {Map<string, any>} */
  const shown = new Map();
  const listeners = new Set();
  const changed = () => { gen++; for (const fn of listeners) { try { fn(); } catch (e) { console.warn('[poi] an editor listener threw', e); } } };

  const setDoc = (id, json, entry = null) => {
    if (json === null) { docs.delete(id); if (sel?.id === id) sel = null; return; }
    const e = docs.get(id);
    if (e) e.doc = JSON.parse(json);
    else docs.set(id, { doc: JSON.parse(json), saved: null, base: null, rev: null, state: 'new', ...(entry ?? {}) });
  };
  /** An entry's own fields - what a step that takes it out of the set keeps, to put it back as it was. */
  const entryFields = (id) => { const e = docs.get(id); return e ? { saved: e.saved, base: e.base, rev: e.rev, state: e.state } : undefined; };
  const push = (step) => {
    undo.push(step);
    if (undo.length > depth) undo.splice(0, undo.length - depth);
    redo = [];
  };
  /** A selection that still names something (an undo may take away the part it named). */
  const validSel = (s) => {
    if (!s) return null;
    const e = docs.get(s.id);
    if (!e) return null;
    if (s.part != null && !e.doc.parts.some((p) => p.key === s.part)) return { id: s.id, part: null, light: null };
    if (s.light != null && !(s.light < (e.doc.lights?.length ?? 0))) return { id: s.id, part: null, light: null };
    return { id: s.id, part: s.part ?? null, light: s.light ?? null };
  };

  const api = {
    /** Open a document for editing - from the live set or a draft. Not a step (nothing was changed). */
    open(/** @type {string} */ id, /** @type {{ doc: any, saved?: any, base?: number | null, rev?: number | null, state?: string }} */ { doc, saved = doc, base = null, rev = null, state = 'live' }) {
      if (drag) api.commit();
      docs.set(id, { doc: structuredClone(doc), saved: text(saved), base, rev, state });
      changed();
    },
    /** Let a document go from the working set (its unsaved changes with it - the editor asks first). Its steps go too. */
    close(/** @type {string} */ id) {
      if (drag?.id === id) drag = null;
      docs.delete(id);
      undo = undo.filter((s) => s.id !== id); redo = redo.filter((s) => s.id !== id);
      if (sel?.id === id) sel = null;
      changed();
    },
    has: (/** @type {string} */ id) => docs.has(id),
    ids: () => [...docs.keys()],
    docOf: (/** @type {string} */ id) => docs.get(id)?.doc ?? null,
    entryOf: (/** @type {string} */ id) => docs.get(id) ?? null,
    /** Whether a document differs from what was last saved (a new one always does). */
    dirty(/** @type {string} */ id) { const e = docs.get(id); return !!e && text(e.doc) !== e.saved; },
    /** The service took the document: what it now holds is what was saved. */
    markSaved(/** @type {string} */ id, /** @type {{ rev?: number | null, state?: string, base?: number | null, doc?: any, unheld?: boolean }} */ { rev = null, state = 'draft', base, doc, unheld = false } = {}) {
      const e = docs.get(id);
      if (!e) return;
      // `unheld`: the store's draft is a document this editor does not hold - all of this one is a change to save
      e.saved = unheld ? null : text(doc ?? e.doc); e.rev = rev; e.state = state;
      if (base !== undefined) e.base = base;
      changed();
    },
    /** A counter that moves with every change (the host's cheap "anything new?"). */
    generation: () => gen,
    onChange(/** @type {() => void} */ fn) { listeners.add(fn); return () => listeners.delete(fn); },

    selection: () => sel,
    select(/** @type {PoiSelection} */ s) { const v = validSel(s); if (!sameSel(v, sel)) { sel = v; changed(); } },

    /** A new POI at a spot, selected - one step (undone, it is gone). `fill` lays what it stands up with into the new
     *  document - AUDIT POI E11: a model placed with no POI held stands in a new one as ONE step, the POI and the model
     *  together, as POI-4b says (it was the create and then an edit: two undos for one click). `select` the selection it
     *  leaves (else the POI). Answers its id. */
    create(/** @type {{ px: number, py: number, x: number, z: number, y?: number, name: string }} */ at, /** @type {((doc: any) => void) | null} */ fill = null, /** @type {PoiSelection | ((id: string) => PoiSelection) | undefined} */ select = undefined) {
      if (drag) api.commit();
      const id = mintPoiId(rand);
      const doc = newPoiDoc({ id, ...at });
      fill?.(doc);
      const selBefore = sel;
      setDoc(id, text(doc));
      sel = validSel((typeof select === 'function' ? select(id) : select) ?? { id, part: null, light: null });
      push({ id, label: 'create', before: null, after: text(doc), selBefore, selAfter: sel, entryAfter: { saved: null, base: null, rev: null, state: 'new' } });
      changed();
      return id;
    },

    /** Take a document out of the working set as a step (a new POI thrown away; undone, it is back, as it was). */
    remove(/** @type {string} */ id, /** @type {string} */ label = 'remove') {
      if (drag) api.commit();
      const e = docs.get(id);
      if (!e) return false;
      const { saved, base, rev, state } = e;
      const selBefore = sel;
      const before = text(e.doc);
      setDoc(id, null);
      push({ id, label, before, after: null, selBefore, selAfter: sel, entryBefore: { saved, base, rev, state } });
      changed();
      return true;
    },

    /**
     * One step: `fn` changes the working document (a copy - the step is kept only if it changed something). `select`
     * the selection the step leaves (else the one it found). Answers whether anything changed.
     * @param {string} id @param {string} label @param {(doc: any) => void} fn @param {PoiSelection} [select]
     */
    edit(id, label, fn, select = undefined) {
      if (drag) api.commit();
      const e = docs.get(id);
      if (!e || shown.has(id)) return false;   // AUDIT POI E17: shown as another (showAs), its working copy is not what is seen - not changed unseen
      const before = text(e.doc);
      const doc = JSON.parse(before);
      fn(doc);
      const after = text(doc);
      const selBefore = sel;
      if (after === before) { if (select !== undefined) api.select(select); return false; }
      e.doc = doc;
      sel = validSel(select === undefined ? sel : select);
      push({ id, label, before, after, selBefore, selAfter: sel });
      changed();
      return true;
    },

    /** A drag's start: what `preview` applies its change to, every frame, until `commit` or `cancel`. */
    begin(/** @type {string} */ id, /** @type {string} */ label) {
      if (drag) api.commit();
      const e = docs.get(id);
      if (!e || shown.has(id)) return false;   // AUDIT POI E17: nor dragged while another stands in its place
      drag = { id, label, start: text(e.doc), selBefore: sel };
      return true;
    },
    /** The drag as it stands now: `fn` applied to the document as the drag found it. */
    preview(/** @type {(doc: any) => void} */ fn) {
      if (!drag) return false;
      const e = docs.get(drag.id);
      if (!e) { drag = null; return false; }
      const doc = JSON.parse(drag.start);
      fn(doc);
      e.doc = doc;
      changed();
      return true;
    },
    /** The drag kept: one step, if it moved anything. */
    commit() {
      if (!drag) return false;
      const d = drag; drag = null;
      const e = docs.get(d.id);
      if (!e) return false;
      const after = text(e.doc);
      if (after === d.start) return false;
      push({ id: d.id, label: d.label, before: d.start, after, selBefore: d.selBefore, selAfter: sel });
      changed();
      return true;
    },
    /** The drag let go: the document as the drag found it. */
    cancel() {
      if (!drag) return false;
      const d = drag; drag = null;
      setDoc(d.id, d.start);
      changed();
      return true;
    },
    dragging: () => !!drag,

    canUndo: () => undo.length > 0 && !drag,
    canRedo: () => redo.length > 0 && !drag,
    undoLabel: () => undo.at(-1)?.label ?? null,
    redoLabel: () => redo.at(-1)?.label ?? null,
    /** One step back: its document as it was, and the selection it found. Answers its label, or null. A drag under way
     *  is the step taken back (AUDIT POI E9: it was let go AND the step before it undone - one press, two steps). */
    undo() {
      if (drag) { const label = drag.label; api.cancel(); return label; }
      const s = undo.pop();
      if (!s) return null;
      // AUDIT POI E8: a create undone takes the POI out of the set - what it is now (saved, its revision, its state) goes
      // with the step, as a remove's does, so its redo brings back a POI that knows it was saved (it came back 'new' and
      // never saved: thrown away, the store's draft was left behind)
      if (s.before === null) s.entryAfter = entryFields(s.id);
      setDoc(s.id, s.before, s.entryBefore);
      sel = validSel(s.selBefore);
      redo.push(s);
      changed();
      return s.label;
    },
    /** One step forward again (a drag under way is let go, and nothing more - as undo). */
    redo() {
      if (drag) { api.cancel(); return null; }
      const s = redo.pop();
      if (!s) return null;
      if (s.after === null) s.entryBefore = entryFields(s.id);   // AUDIT POI E8: a remove redone - what it is now, for its undo
      setDoc(s.id, s.after, s.entryAfter);
      sel = validSel(s.selAfter);
      undo.push(s);
      changed();
      return s.label;
    },

    /** The working set as the feed's overlay (poi/poiFeed.js setOverlay): every open document, drawn on this screen in
     *  place of its live revision - unless it is SHOWN AS another (`showAs`: a document, or null for nothing there). */
    overlay() {
      const out = new Map();
      for (const [id, e] of docs) out.set(id, { doc: e.doc, rev: e.rev ?? 0 });
      for (const [id, d] of shown) out.set(id, d === null ? null : { doc: d, rev: 0 });
      return out;
    },
    /** POI-6: what this screen shows for a POI, whatever is open or live - `doc` that document, `null` nothing (a POI not
     *  yet in the world, a retirement), `undefined` as it would be. The approver's before and after; no step, no save. */
    showAs(/** @type {string} */ id, /** @type {any} */ d) {
      if (d === undefined) shown.delete(id); else shown.set(id, d === null ? null : structuredClone(d));
      changed();
    },
    shownAs: (/** @type {string} */ id) => shown.get(id),
  };
  return api;
}
