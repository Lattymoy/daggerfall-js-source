// HB1 - THE ENHANCED HOTBAR.
//
// Discord, 2026-09-23. LostMyLeg: "what do you think of a traditional
// hotbar? like 1-9/0". The dev: "I'll make an enhanced hotbar alongside
// keeping the current quickbar ... togglable so ppl can choose the
// lightweight quickbar or hotbar - both at the same time are too much
// clutter". And the brief: weapons, potions and torches drag onto it
// from the pack, spells from the book; a weapon key equips, a spell key
// CASTS, a potion key drinks; the key flashes; enhanced skin only,
// online included.
//
// THE MODEL IS systems/quickslots.js (the HB1 block) and nothing about
// it is restated here. This file is the PICTURE, the KEYS and the DROP.
//
// ONE NODE, TWO PLACES. In play the bar lives inside the HUD's bottom
// column, above the vitals, so it rides the HUD's scale and moves with
// the vitals when the effects row grows beneath them. While the pack or
// the book is open the HUD is hidden - and that is exactly when the bar
// is a drop target - so the same node is carried to a body-level layer
// under the window and takes the pointer there. Moving a node is one
// append; a second bar would be a second thing to keep in step.
//
// THE KEYS ARE TAKEN AT THE WINDOW'S CAPTURE PHASE, and only while the
// bar is up in play: a digit is swallowed before any host's own ladder
// can read it, so 1-4 do not ALSO press the diamond's slots the hotbar
// replaced. Under a window (the HUD hidden) the keys are the window's,
// and in a text field they are the field's.
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { PIXEL_STACK } from './pixelifyFive.js';
import { getPref } from '../systems/uiPrefs.js';
import { isTextEntryTarget, bindings, actionOf, eventModifiers } from './input.js';
import { HOTBAR_SLOT_ACTIONS } from '../systems/inputActions.js';   // KB1: the ten slots are ten registry actions
import { quickslotTag } from './quickslotTags.js';   // KB1: a slot's chip names the key its action is bound to
import {
  HOTBAR_SIZE, HOTBAR_TEXT, hotbarView, hotbarRevision, hotbarPress, hotbarReady,
  hotbarEntryForItem, hotbarEntryForSpell, setHotbarSlot, clearHotbarSlot, swapHotbarSlots, hotbarEntry,
  hotbarSlotOf, firstFreeHotbarSlot, hotbarKindOf,
} from '../systems/quickslots.js';
import { modelIconUrl } from './itemIconUrl.js';
import { fpArm } from '../combat/fpArm.js';
import { requestIcon } from './textureCanvas.js';
import { inventoryItemImage } from '../systems/itemTemplates.js';
import { cursorActive } from '../player/pointerLock.js';   // HB1c: the freed mouse (Enter / FreeMouse)
import { overlayOpen } from './enhancedOverlays.js';

/** The pref and its two words (systems/features.js 'quickbar-style'). */
export const HOTBAR_PREF = 'quickbarStyle';
export const hotbarMode = () => getPref(HOTBAR_PREF) === 'hotbar';

/** How long the press caption stands over the bar. */
const CAPTION_MS = 1100;
/** A mouse crosses into a drag at this many pixels; a finger on a HOLD. */
const MOUSE_SLOP = 4;
const TOUCH_HOLD_MS = 320;
const TOUCH_SLOP = 12;

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

let bar = null;          // the one .hb node
let slots = [];          // per slot: { node, icon, glyph, count, key, wear, wearFill, pip }
let caption = null;
let hint = null;
let dock = null;         // the HUD's own place for it
let dropLayer = null;    // the body-level place, while a window is up
const dropOwners = new Set();
let dropEntity = null;
let liveOpts = {};
let liveEntity = null;
let lastHidden = true;
let lastPaused = true;   // AUDIT CONTRIB H1: a window or the freed cursor - the keys are not the player's
let keysRev = -1;   // KB1: the bindings revision the chips were named at
let lastSig = null;
let keysBound = false;
let captionTimer = null;
const iconKeys = [];     // per slot: the kind whose picture is drawn

/** HB1c (Discord, 2026-09-23: "when mouse mode is on you can drag and
 *  remove skills"): THE FREED MOUSE EDITS THE BAR IN PLAY. With the cursor
 *  out of the look and no window up, the sockets take the pointer: a drag
 *  moves a slot, a drag off the bar or a right-click clears it, and a
 *  plain click presses it the way its key would. With the look held the
 *  bar is pointer-transparent again, as the whole HUD is. */
const mouseMode = () => !!bar && hotbarMode() && !lastHidden && !dropOwners.size && cursorActive() && !overlayOpen();
/** Can the sockets be dragged right now - under a window, or in mouse mode? */
const editable = () => hotbarAcceptsDrops() || mouseMode();
const HINT_DROP = 'Drag a weapon, potion, torch or spell onto a slot. Drag a slot off the bar to clear it.';
const HINT_EDIT = 'Click a slot to use it. Drag to move it, drag it off the bar or right-click to clear it.';

// ── SPELL GLYPHS ──────────────────────────────────────────────────
/** A spell has no ARENA2 icon this skin reads, so it wears its NAME as a
 *  sigil: the initials of its words (the possessive dropped - "Balyna's
 *  Balm" is BB, "Fenrik's Door Jam" FDJ), two letters of a one-word
 *  name. The ELEMENT colours the stone, which is the thing a player
 *  scanning ten slots mid-fight reads first. */
export function spellSigil(name) {
  const words = String(name ?? '').replace(/['\u2019]s\b/gi, '').split(/[\s-]+/).filter((w) => /[a-z0-9]/i.test(w));
  if (!words.length) return '?';
  if (words.length === 1) {
    const w = words[0].replace(/[^a-z0-9]/gi, '');
    return (w[0] ?? '?').toUpperCase() + (w[1] ?? '').toLowerCase();
  }
  return words.slice(0, 3).map((w) => w.replace(/[^a-z0-9]/gi, '')[0] ?? '').join('').toUpperCase();
}
const ELEMENT_CLASS = ['fire', 'frost', 'poison', 'shock', 'magic'];
const RANGE_MARK = ['\u25cf', '\u270b', '\u2192', '\u25ce', '\u2735'];   // self, touch, target, area, area-at-range
const RANGE_WORD = ['Caster only', 'Touch', 'Target at range', 'Area around caster', 'Area at range'];

// ── BUILD ─────────────────────────────────────────────────────────
function build() {
  injectEnhancedStyle();
  injectEnhancedFonts();
  injectHotbarStyle();
  bar = el('div', 'hb');
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Hotbar');
  caption = el('div', 'hb-caption');
  caption.setAttribute('aria-live', 'polite');
  const row = el('div', 'hb-row');
  slots = [];
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    const node = el('div', 'hb-slot hb-empty');
    node.dataset.slot = String(i);
    const frame = el('i', 'hb-frame');
    const face = el('div', 'hb-face');
    const icon = el('img', 'hb-icon');
    icon.alt = '';
    icon.draggable = false;
    const glyph = el('span', 'hb-glyph');
    face.append(icon, glyph);
    const key = el('span', 'hb-key', hotbarKeyOf(i) ?? '');
    const count = el('span', 'hb-count');
    const pip = el('span', 'hb-pip');
    const wear = el('span', 'hb-wear');
    const wearFill = el('i', 'hb-wearfill');
    wear.append(wearFill);
    const flash = el('i', 'hb-flash');
    node.append(frame, face, wear, count, pip, key, flash);
    bindSlot(node, i);
    row.append(node);
    slots.push({ node, icon, glyph, count, key, wear, wearFill, pip });
    iconKeys[i] = null;
  }
  hint = el('div', 'hb-hint', HINT_DROP);
  bar.append(caption, row, hint);
}

/** The HUD hands the bar its place in play: the bottom column, above the
 *  vitals. Called from the enhanced HUD's build; safe to call again. */
export function mountHotbarDock(dockEl) {
  if (typeof document === 'undefined') return;
  if (!bar) build();
  dock = dockEl;
  if (!dropOwners.size && bar.parentNode !== dock) dock.append(bar);
  bindKeys();
}

function bindKeys() {
  if (keysBound || typeof window === 'undefined') return;
  keysBound = true;
  window.addEventListener('keydown', onKey, true);
}

// ── THE FRAME ─────────────────────────────────────────────────────
/**
 * One frame, from the enhanced HUD's draw - hidden or not, because a
 * hidden HUD is exactly when the bar may still be up as a drop target.
 * `opts` is drawHud's own bag: the four quickslot doors the press goes
 * through, and the readied spell.
 */
export function drawEnhancedHotbar(entity, opts = {}) {
  if (!bar) return;
  lastHidden = !!opts.hidden;
  lastPaused = opts.paused ?? !!opts.hidden;   // an older caller that says only `hidden` keeps its old gate
  if (!lastPaused) { liveOpts = opts; liveEntity = entity ?? null; }
  paint();
}

/** Where the bar is and whether it shows - then the slots, when they
 *  changed. Called by the frame and by every act that changes a slot, so
 *  a window that pauses the frame still sees its drop land at once. */
function paint() {
  if (!bar) return;
  const on = hotbarMode();
  const dropping = on && dropOwners.size > 0;
  const shown = on && (dropping || !lastHidden);
  if (dropping) {
    if (!dropLayer) { dropLayer = el('div', 'hb-droplayer'); document.body.append(dropLayer); }
    if (bar.parentNode !== dropLayer) dropLayer.append(bar);
  } else if (dock && bar.parentNode !== dock) {
    dock.append(bar);
    dropLayer?.remove(); dropLayer = null;
  }
  bar.classList.toggle('on', shown);
  bar.classList.toggle('dropping', dropping);
  const editing = shown && !dropping && mouseMode();
  if (bar.classList.contains('editing') !== editing) {
    bar.classList.toggle('editing', editing);
    if (!editing && hbDrag) dragEnd(false);   // the look taken back mid-drag: never mind
  }
  const hintText = editing ? HINT_EDIT : HINT_DROP;
  if (hint && hint.textContent !== hintText) hint.textContent = hintText;
  if (!shown) return;
  const entity = dropping ? (dropEntity ?? liveEntity) : liveEntity;
  const readiedIndex = liveOpts.readied?.index ?? null;
  const view = hotbarView(entity, { readiedIndex });
  const rev = bindings().rev;
  if (rev !== keysRev) { keysRev = rev; slots.forEach((sl, i) => { const t = hotbarKeyOf(i) ?? ''; if (sl.key.textContent !== t) sl.key.textContent = t; }); }   // KB1: a rebind renames the chips
  const sig = `${hotbarRevision()}|${dropping ? 1 : 0}|${view.map((v) => (v.empty ? '-'
    : `${v.name}|${v.count ?? ''}|${Number.isFinite(v.condition) ? Math.round(v.condition) : ''}|${v.ghost ? 1 : 0}|${v.active ? 1 : 0}|${v.item ? 1 : 0}`)).join('~')}`;
  if (sig === lastSig) return;
  lastSig = sig;
  view.forEach((v) => paintSlot(slots[v.slot], v, entity));
}

function paintSlot(s, v, entity) {
  const n = s.node;
  n.classList.toggle('hb-empty', !!v.empty);
  n.classList.toggle('hb-gone', !!v.ghost);
  n.classList.toggle('hb-active', !!v.active);
  n.classList.toggle('hb-spell', v.type === 'spell');
  for (const c of ELEMENT_CLASS) n.classList.toggle(`el-${c}`, v.type === 'spell' && ELEMENT_CLASS[v.element] === c);
  n.title = v.empty ? `Slot ${v.slot + 1}` : `${v.name}${v.type === 'spell' && RANGE_WORD[v.rangeType] ? ` (${RANGE_WORD[v.rangeType]})` : ''}`;
  if (v.empty) {
    iconFor(s, v.slot, null, entity);
    s.glyph.textContent = '';
    s.count.textContent = '';
    s.pip.textContent = '';
    n.classList.remove('hb-hasbar', 'hb-worn');
    return;
  }
  if (v.type === 'spell') {
    iconFor(s, v.slot, null, entity);
    const sig = spellSigil(v.name);
    s.glyph.textContent = sig;
    s.glyph.dataset.len = String(sig.length);
    s.count.textContent = '';
    s.pip.textContent = RANGE_MARK[v.rangeType] ?? '';
    n.classList.remove('hb-hasbar', 'hb-worn');
    return;
  }
  const drew = iconFor(s, v.slot, v.item, entity);
  s.glyph.textContent = drew ? '' : initialsOf(v.name);
  s.glyph.dataset.len = '2';
  s.count.textContent = v.count != null ? String(v.count) : '';
  s.pip.textContent = '';
  const hasBar = Number.isFinite(v.condition);
  n.classList.toggle('hb-hasbar', hasBar);
  if (hasBar) {
    const pct = Math.max(0, Math.min(100, v.condition));
    s.wearFill.style.width = `${pct}%`;
    n.classList.toggle('hb-worn', pct < 40);
  }
}

const initialsOf = (name) => String(name ?? '').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

/** The enhanced HUD's own picture ladder (quickIcon): the Morrowind
 *  ground mesh, else the classic icon, else nothing (the initials show).
 *  Requested only when the slot's KIND changed. Answers whether a
 *  picture is up. */
function iconFor(s, i, item, entity) {
  const key = item ? (hotbarEntryForItem(item)?.key ?? '') : '';
  if (iconKeys[i] === key) return !!s.icon.getAttribute('src');
  iconKeys[i] = key;
  let src = null;
  if (item) {
    src = modelIconUrl(item, 96, fpArm);
    if (!src) {
      const image = inventoryItemImage(item, entity ?? undefined);
      src = image ? requestIcon(image.archive, image.record, { scale: 2, dye: image.dye, onReady: () => { iconKeys[i] = null; lastSig = null; paint(); } }) : null;   // AUDIT CONTRIB H5: DW3's dye, as the diamond and the pack ask
    }
  }
  if (src) { s.icon.src = src; s.icon.style.display = ''; }
  else { s.icon.removeAttribute('src'); s.icon.style.display = 'none'; }
  return !!src;
}

// ── THE PRESS ─────────────────────────────────────────────────────
/** Press slot i: the model's performer through the host's own doors,
 *  then the flash. A slot that cannot act is REFUSED in the flash as
 *  well as in words - a key that looks pressed and did nothing is the
 *  drawn door this UI does not draw. */
export function pressHotbar(i) {
  if (!bar) return;
  const entity = liveEntity;
  const ok = hotbarReady(entity, i);
  let said = null;
  const res = hotbarPress(i, { entity, doors: liveOpts, say: (l) => { said = l; } });
  const good = ok && res.kind !== 'none' && res.kind !== 'refused' && res.kind !== 'empty';   // AUDIT CONTRIB H3: the performer's own answer (hotbarPress)
  strike(i, good);
  const e = hotbarEntry(i);
  showCaption(said ?? (e ? e.name : HOTBAR_TEXT.emptySlot), !good);
  lastSig = null;
  paint();
}

function strike(i, good) {
  const s = slots[i];
  if (!s) return;
  const n = s.node;
  n.classList.remove('hb-strike', 'hb-deny');
  void n.offsetWidth;   // restart the animation on a second press inside the first
  n.classList.add(good ? 'hb-strike' : 'hb-deny');
  if (good) {
    const ring = el('i', 'hb-ring');
    n.append(ring);
    ring.addEventListener('animationend', () => ring.remove(), { once: true });
    setTimeout(() => ring.remove(), 700);   // reduced motion fires no animationend
  }
  clearTimeout(n._hbT);
  n._hbT = setTimeout(() => n.classList.remove('hb-strike', 'hb-deny'), 460);
}

function showCaption(text, bad = false) {
  if (!caption) return;
  caption.textContent = text ?? '';
  caption.classList.toggle('bad', !!bad);
  caption.classList.remove('on');
  void caption.offsetWidth;
  caption.classList.add('on');
  clearTimeout(captionTimer);
  captionTimer = setTimeout(() => caption?.classList.remove('on'), CAPTION_MS);
}

/** The modifiers an event carries, as held codes - so a slot bound to a combo (Shift + 1) resolves as one. */
function onKey(e) {
  // AUDIT CONTRIB H1: gated on the GAME's pause, not the HUD's visibility - with the HUD toggled off the keys fell
  // through to the diamond the hotbar replaces (1 drank the diamond's potion), and 5-0 did nothing
  if (!bar || !hotbarMode() || dropOwners.size || lastPaused) return;
  if (e.metaKey || isTextEntryTarget(e.target)) return;
  // KB1: THE SLOTS ARE REGISTRY ACTIONS. This read `Digit1`-`Digit0` off the event and stepped aside for any digit
  // someone else held - a table of its own beside the controls pane's. The slot is whatever the key MEANS now: a
  // player who moved slot 7 to a mouse button, or a pad's d-pad on slots 1-4, presses it; a digit bound to anything
  // else is simply not a slot.
  const i = HOTBAR_SLOT_ACTIONS.indexOf(actionOf(e, eventModifiers(e)));
  if (i < 0) return;
  // The hotbar owns the digit: no host ladder below may read it too
  // (keys 1-4 are the diamond's by default, and the diamond is put away).
  e.preventDefault();
  e.stopImmediatePropagation();
  if (e.repeat) return;   // a held key presses once, as the diamond's keys do (MAC-R2)
  pressHotbar(i);
}

// ── THE DROP ──────────────────────────────────────────────────────
/**
 * A window that fills the bar says it is up (`on`) and whose pack and
 * book the slots resolve against. Owners are counted, so the pack and
 * the book can both be up without the first to close taking the bar
 * down under the other.
 */
export function setHotbarDropMode(owner, on, entity = null) {
  if (on) { dropOwners.add(owner); if (entity) dropEntity = entity; }
  else dropOwners.delete(owner);
  if (!dropOwners.size) { dropEntity = null; dragEnd(false); }
  lastSig = null;
  if (!bar && on && hotbarMode() && typeof document !== 'undefined') build();
  paint();
}

/** Is the bar up to be dropped on? The pack asks before it offers the verb. */
export const hotbarAcceptsDrops = () => !!bar && hotbarMode() && dropOwners.size > 0;

/** The slot under a point, or -1 - the pack's own drag hit-tests with it. */
export function hotbarSlotAt(x, y) {
  if (!editable()) return -1;
  const n = document.elementFromPoint?.(x, y)?.closest?.('.hb-slot');
  return n && bar.contains(n) ? Number(n.dataset.slot) : -1;
}
export function hotbarSlotNode(target) {
  if (!hotbarAcceptsDrops()) return null;
  const n = target?.closest?.('.hb-slot');
  return n && bar.contains(n) ? n : null;
}

/** Can this item go on the bar at all? */
export const hotbarTakesItem = (item) => !!hotbarKindOf(item);

export function hotbarDropItem(i, item) {
  const e = hotbarEntryForItem(item);
  if (!e || !setHotbarSlot(i, e)) return false;
  lastSig = null; paint(); strike(i, true);
  showCaption(HOTBAR_TEXT.added(e.name, i + 1));
  return true;
}
export function hotbarDropSpell(i, sp) {
  const e = hotbarEntryForSpell(sp);
  if (!e || !setHotbarSlot(i, e)) return false;
  lastSig = null; paint(); strike(i, true);
  showCaption(HOTBAR_TEXT.added(e.name, i + 1));
  return true;
}

/** The click path beside the drag, for a player who would rather press
 *  a button: on the bar already comes OFF, else it goes on the first
 *  free slot. Answers a line for the window to show. */
export function toggleHotbarItem(item) {
  const at = hotbarSlotOf(item);
  if (at >= 0) { clearHotbarSlot(at); lastSig = null; paint(); return HOTBAR_TEXT.removed(hotbarEntryForItem(item)?.name ?? 'It'); }
  const free = firstFreeHotbarSlot();
  if (free < 0) return HOTBAR_TEXT.full;
  hotbarDropItem(free, item);
  return HOTBAR_TEXT.added(hotbarEntryForItem(item)?.name ?? 'It', free + 1);
}
export function toggleHotbarSpell(sp) {
  const at = hotbarSlotOf(sp, { spell: true });
  if (at >= 0) { clearHotbarSlot(at); lastSig = null; paint(); return HOTBAR_TEXT.removed(sp?.name ?? 'It'); }
  const free = firstFreeHotbarSlot();
  if (free < 0) return HOTBAR_TEXT.full;
  hotbarDropSpell(free, sp);
  return HOTBAR_TEXT.added(sp?.name ?? 'It', free + 1);
}
/** KB1: the key a slot answers to, as its chip names it - the slot's registry action through the diamond's own tag
 *  law (ui/quickslotTags.js), so a rebound slot says so and an unbound one says nothing. */
export const hotbarKeyOf = (i) => {
  if (!(i >= 0 && i < HOTBAR_SLOT_ACTIONS.length)) return null;
  const t = quickslotTag(HOTBAR_SLOT_ACTIONS[i], { bindings: bindings() });
  return t?.kind === 'key' ? t.text : null;
};

/**
 * A DRAG THAT THIS FILE OWNS - out of the spellbook's rail, and from one
 * slot of the bar to another. The pack has its own session (its drag
 * already performs equips and moves, and carries this bar as one more
 * target); the book has none, so it borrows this one.
 *
 * Pointer events, never the HTML5 drag API (AUDIT INV1 Fb: that never
 * fires from a finger); the listeners are the WINDOW's, so a repaint of
 * the row that started it cannot strand the ghost; a finger begins on a
 * HOLD so a flick down the rail still scrolls it.
 *
 * `payload` is { kind: 'spell', spell } or { kind: 'slot', slot }.
 */
let hbDrag = null;
let hbDragged = false;
export const takeHotbarDragClick = () => { const was = hbDragged; hbDragged = false; return was; };

export function beginHotbarDrag(e, payload, { label = '', sigil = null, element = null, iconSrc = null } = {}) {
  if (hbDrag || (e.button ?? 0) > 0) return;
  const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
  hbDrag = { id: e.pointerId, payload, label, sigil, element, iconSrc, ox: e.clientX, oy: e.clientY,
    x: e.clientX, y: e.clientY, moved: false, touch, hold: null, ghost: null };
  if (touch) hbDrag.hold = setTimeout(() => { if (hbDrag && !hbDrag.moved) arm(); }, TOUCH_HOLD_MS);
  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('pointercancel', onCancel, true);
  window.addEventListener('touchmove', onTouchHold, { passive: false, capture: true });
  window.addEventListener('dragstart', onNativeDrag, true);   // HB1b: the browser's own drag never takes the press
}
const onNativeDrag = (e) => { if (hbDrag && e.cancelable) e.preventDefault(); };

function arm() {
  if (!hbDrag) return;
  hbDrag.moved = true;
  const g = el('div', 'hb-ghost');
  const tile = el('div', 'hb-ghosttile');
  if (hbDrag.iconSrc) { const im = el('img'); im.src = hbDrag.iconSrc; tile.append(im); }
  else { const s = el('span', 'hb-glyph', hbDrag.sigil ?? ''); s.dataset.len = String((hbDrag.sigil ?? '').length); tile.append(s); }
  if (hbDrag.element != null && ELEMENT_CLASS[hbDrag.element]) g.classList.add(`el-${ELEMENT_CLASS[hbDrag.element]}`);
  const verb = el('span', 'hb-ghostverb', '');
  g.append(tile, verb);
  document.body.append(g);
  hbDrag.ghost = g;
  track(hbDrag.x, hbDrag.y);
}

function track(x, y) {
  if (!hbDrag?.ghost) return;
  hbDrag.x = x; hbDrag.y = y;
  const lift = hbDrag.touch ? 52 : 0;
  hbDrag.ghost.style.left = `${x}px`;
  hbDrag.ghost.style.top = `${y - lift}px`;
  for (const s of slots) s.node.classList.remove('dragover');
  const i = hotbarSlotAt(x, y);
  const verb = hbDrag.ghost.querySelector('.hb-ghostverb');
  let text = '';
  if (i >= 0) {
    slots[i].node.classList.add('dragover');
    text = hbDrag.payload.kind === 'slot' ? (i === hbDrag.payload.slot ? '' : `Move to ${i + 1}`) : `Hotbar ${i + 1}`;
  } else if (hbDrag.payload.kind === 'slot') text = 'Clear';
  verb.textContent = text;
  verb.classList.toggle('on', !!text);
  hbDrag.ghost.classList.toggle('clearing', i < 0 && hbDrag.payload.kind === 'slot');
}

function onMove(e) {
  if (!hbDrag || e.pointerId !== hbDrag.id) return;
  const dx = e.clientX - hbDrag.ox; const dy = e.clientY - hbDrag.oy;
  if (!hbDrag.moved) {
    if (hbDrag.touch) {
      if (Math.abs(dy) > TOUCH_SLOP || Math.abs(dx) > TOUCH_SLOP * 2) { dragEnd(false); return; }
      hbDrag.x = e.clientX; hbDrag.y = e.clientY;
      return;
    }
    if (Math.abs(dx) + Math.abs(dy) <= MOUSE_SLOP) return;
    arm();
  }
  track(e.clientX, e.clientY);
}
const onUp = (e) => { if (hbDrag && e.pointerId === hbDrag.id) dragEnd(true); };
const onCancel = (e) => { if (hbDrag && (e.pointerId === undefined || e.pointerId === hbDrag.id)) dragEnd(false); };
const onTouchHold = (e) => { if (hbDrag?.moved && hbDrag.touch && e.cancelable) e.preventDefault(); };

function dragEnd(commit) {
  const d = hbDrag;
  hbDrag = null;
  if (!d) return;
  clearTimeout(d.hold);
  d.ghost?.remove();
  for (const s of slots) s.node.classList.remove('dragover');
  window.removeEventListener('pointermove', onMove, true);
  window.removeEventListener('pointerup', onUp, true);
  window.removeEventListener('pointercancel', onCancel, true);
  window.removeEventListener('touchmove', onTouchHold, { capture: true });
  window.removeEventListener('dragstart', onNativeDrag, true);
  if (!d.moved) {
    // HB1c: a click in mouse mode that never became a drag is a PRESS.
    if (commit && d.payload.tapPress) pressHotbar(d.payload.slot);
    return;
  }
  hbDragged = true;   // the click the release raises is not a pick
  if (!commit) return;
  const i = hotbarSlotAt(d.x, d.y);
  if (d.payload.kind === 'spell') { if (i >= 0) hotbarDropSpell(i, d.payload.spell); return; }
  if (d.payload.kind === 'slot') {
    const from = d.payload.slot;
    if (i < 0) {
      const name = hotbarEntry(from)?.name;
      clearHotbarSlot(from);
      if (name) showCaption(HOTBAR_TEXT.removed(name));
    } else if (i !== from) { swapHotbarSlots(from, i); strike(i, true); }
    lastSig = null; paint();
  }
}

/** A slot's own pointer: under a window it drags (move / clear) and a
 *  right-click clears; in play, a FINGER presses it - a phone has no
 *  digit row. A mouse in play never reaches it: the bar is
 *  pointer-transparent there, as the whole HUD is. */
function bindSlot(node, i) {
  node.addEventListener('pointerdown', (e) => {
    if (editable()) {
      if (!hotbarEntry(i)) return;
      const s = slots[i];
      e.preventDefault();   // no text selection, no focus theft - the press is the bar's
      beginHotbarDrag(e, { kind: 'slot', slot: i, tapPress: mouseMode() }, {
        sigil: s.glyph.textContent || null, iconSrc: s.icon.getAttribute('src'),
        element: ELEMENT_CLASS.findIndex((c) => node.classList.contains(`el-${c}`)),
      });
      return;
    }
    const finger = e.pointerType === 'touch' || e.pointerType === 'pen';
    if (!finger) return;
    e.preventDefault();
    pressHotbar(i);
  });
  // HB1c: THE PRESS IS THE BAR'S. Every host swings from a WINDOW
  // `mousedown` listener, so a click on a socket in mouse mode (and the
  // right-click that clears one) would also have swung the weapon.
  const own = (e) => { if (editable()) e.stopPropagation(); };
  node.addEventListener('mousedown', own);
  node.addEventListener('mouseup', own);
  node.addEventListener('contextmenu', (e) => {
    if (!editable()) return;
    e.preventDefault();
    const name = hotbarEntry(i)?.name;
    if (!name) return;
    clearHotbarSlot(i);
    showCaption(HOTBAR_TEXT.removed(name));
    lastSig = null; paint();
  });
}

/** A host tearing the HUD down. The bar survives in the module (its
 *  CONTENTS are the model's and the save's), but its place does not. */
export function detachHotbarDock() {
  dragEnd(false);
  if (bar && bar.parentNode === dock) bar.remove();
  dock = null;
  liveOpts = {}; liveEntity = null; lastHidden = true; lastSig = null;
}

// ── THE LOOK ──────────────────────────────────────────────────────
// The enhanced skin's own language, spent in one place. Square sockets
// on the slate ground with the brass 2px frame every window wears, the
// Pixelify face for the key and the count, and a diamond gem for the
// thing in hand - the pause window's corner gem, not a new mark. The
// one loud moment is the STRIKE: the socket sinks two pixels, a brass
// flash fills it and a diamond ring bursts outward - the key's answer,
// and nothing moves unless a key was pressed.
const HOTBAR_STYLE_ID = 'enhanced-hotbar-style';
function injectHotbarStyle(doc = document) {
  if (doc.getElementById(HOTBAR_STYLE_ID)) return;
  const s = doc.createElement('style');
  s.id = HOTBAR_STYLE_ID;
  s.textContent = HOTBAR_CSS;
  doc.head.append(s);
}

export const HOTBAR_CSS = `
.hud-hotdock { display: contents; }
.hb { --hb-cell: 50px; --hb-gap: 5px; display: none; position: relative; flex-direction: column; align-items: center;
  font-family: ${PIXEL_STACK}; -webkit-font-smoothing: none; font-variant-ligatures: none;
  color: var(--bone, #e9e4d9); pointer-events: none; }
.hb.on { display: flex; }
/* HB1b (Discord: "make only the blocks 1-0 visible, not the whole frame"):
   NO PANEL. The ten sockets stand on the world by themselves, each with
   its own shadow so it reads over snow and grass alike. */
.hb-row { display: flex; gap: var(--hb-gap); padding: 0; background: none; border: 0; box-shadow: none; }
.hb-slot { position: relative; box-sizing: border-box; width: var(--hb-cell); height: var(--hb-cell); flex: 0 0 auto;
  margin: 0; padding: 0; border: 0;
  background: rgba(10,12,17,0.78);
  background-image: radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px); background-size: 4px 4px;
  box-shadow: 0 2px 0 rgba(0,0,0,0.6), 0 0 8px rgba(0,0,0,0.35);
  transition: transform 70ms steps(2), background-color 120ms; touch-action: none; user-select: none; -webkit-user-drag: none; }
.hb-frame { position: absolute; inset: 0; border: 2px solid rgba(125,116,96,0.55); pointer-events: none; }
.hb-slot.hb-empty .hb-frame { border-color: rgba(125,116,96,0.22); border-style: dashed; }
.hb-face { position: absolute; inset: 4px; display: grid; place-items: center; overflow: hidden; }
.hb-icon { max-width: 100%; max-height: 100%; image-rendering: pixelated; filter: drop-shadow(1px 1px 0 rgba(0,0,0,0.8)); }
.hb-glyph { font-size: 15px; letter-spacing: 0.04em; color: #d8cfae; text-shadow: 2px 2px 0 rgba(0,0,0,0.9); line-height: 1; }
.hb-glyph[data-len="3"] { font-size: 12px; letter-spacing: 0; }
.hb-key { position: absolute; left: 3px; top: 1px; font-size: 10px; color: #a89f88;
  text-shadow: 1px 1px 0 #000; pointer-events: none; }
.hb-count { position: absolute; right: 3px; bottom: 1px; font-size: 11px; color: var(--bone, #e9e4d9);
  font-variant-numeric: tabular-nums; text-shadow: 1px 1px 0 #000, -1px 0 0 #000; pointer-events: none; }
.hb-pip { position: absolute; right: 3px; top: 1px; font-size: 9px; opacity: 0.85; pointer-events: none; }
.hb-wear { display: none; position: absolute; left: 5px; right: 5px; bottom: 4px; height: 3px; background: rgba(0,0,0,0.65); }
.hb-slot.hb-hasbar .hb-wear { display: block; }
.hb-wearfill { display: block; height: 100%; background: #74d9a0; }
.hb-slot.hb-worn .hb-wearfill { background: #d98074; }
.hb-slot.hb-gone .hb-face { opacity: 0.32; filter: grayscale(1); }
.hb-slot.hb-gone .hb-count { color: #d98074; }

/* IN HAND: the equipped weapon, the lit light, the readied spell. */
.hb-slot.hb-active .hb-frame { border-color: var(--brass, #c08a3e);
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.6), inset 0 0 14px rgba(192,138,62,0.35); }
.hb-slot.hb-active::after { content: ''; position: absolute; left: 50%; top: -4px; width: 7px; height: 7px;
  background: var(--brass, #c08a3e); transform: translateX(-50%) rotate(45deg); box-shadow: 1px 1px 0 #000; }

/* SPELLS: the sigil on a DARK BLUE stone (HB1b, Discord: "violet isn't
   great, make them darker blueish"), every spell alike - the element is
   a thin accent on the stone's rim and on the range pip, not its colour. */
.hb-slot.hb-spell .hb-face { inset: 6px; border: 1px solid var(--hb-acc, #6f93c4);
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.55);
  background: radial-gradient(circle at 35% 30%, #2c4a72, #15253d 62%, #0c1626); }
.hb-slot.hb-spell .hb-glyph { color: #e6eefa; }
.hb-slot.hb-spell .hb-pip { color: var(--hb-acc, #6f93c4); }
.el-fire   { --hb-acc: #d9643a; }
.el-frost  { --hb-acc: #7fcbe6; }
.el-poison { --hb-acc: #86c255; }
.el-shock  { --hb-acc: #e2cf6a; }
.el-magic  { --hb-acc: #8fb4e8; }

/* THE STRIKE. */
.hb-flash { position: absolute; inset: 0; pointer-events: none; opacity: 0;
  background: radial-gradient(circle, rgba(255,236,190,0.9), rgba(192,138,62,0.45) 55%, transparent 75%); mix-blend-mode: screen; }
.hb-slot.hb-strike { transform: translateY(2px); }
.hb-slot.hb-strike .hb-frame { border-color: #f1d49a; }
.hb-slot.hb-strike .hb-flash { animation: hb-flash 380ms ease-out; }
.hb-slot.hb-strike .hb-key { color: #fff3d0; }
.hb-ring { position: absolute; left: 50%; top: 50%; width: 100%; height: 100%; pointer-events: none;
  border: 2px solid rgba(241,212,154,0.95); transform: translate(-50%,-50%) rotate(45deg) scale(0.55);
  animation: hb-ring 420ms cubic-bezier(.2,.7,.3,1) forwards; }
@keyframes hb-flash { 0% { opacity: 1; } 100% { opacity: 0; } }
@keyframes hb-ring { 0% { opacity: 1; transform: translate(-50%,-50%) rotate(45deg) scale(0.55); }
  100% { opacity: 0; transform: translate(-50%,-50%) rotate(45deg) scale(1.35); border-width: 1px; } }
.hb-slot.hb-deny .hb-frame { border-color: var(--blood, #8c3a32); }
.hb-slot.hb-deny { animation: hb-deny 260ms steps(6); }
@keyframes hb-deny { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-3px); } 40% { transform: translateX(3px); }
  60% { transform: translateX(-2px); } 80% { transform: translateX(2px); } }

/* THE CAPTION: what the press did, over the bar. */
.hb-caption { position: absolute; bottom: 100%; margin-bottom: 6px; left: 50%; transform: translateX(-50%);
  white-space: nowrap; font-size: 12px; letter-spacing: 0.08em; padding: 3px 10px;
  background: rgba(14,16,19,0.88); border: 1px solid rgba(192,138,62,0.45); color: #e9d9b0;
  text-shadow: 1px 1px 0 #000; opacity: 0; pointer-events: none; }
.hb-caption.bad { border-color: var(--blood, #8c3a32); color: #f0b8ae; }
.hb-caption.on { animation: hb-cap ${CAPTION_MS}ms linear forwards; }
@keyframes hb-cap { 0% { opacity: 0; } 8% { opacity: 1; } 75% { opacity: 1; } 100% { opacity: 0; } }
.hb-hint { display: none; margin-top: 7px; font-size: 10px; letter-spacing: 0.06em; color: #a89f88;
  text-shadow: 1px 1px 0 #000; }

/* UNDER A WINDOW: the drop target. Body-level, under the drag ghosts (16)
   and over every door host (11-14), anchored to the gap the windows
   leave at the foot of the screen. */
.hb-droplayer { position: fixed; left: 0; right: 0; bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  z-index: 15; display: flex; justify-content: center; pointer-events: none; }
.hb.dropping { pointer-events: auto; }
.hb.dropping .hb-hint { display: block; }
.hb.dropping .hb-slot { background-color: rgba(10,12,17,0.92); }
.hb.dropping .hb-slot { cursor: grab; }
.hb.dropping .hb-slot.hb-empty { cursor: default; }
.hb-slot.dragover { background-color: rgba(78,127,114,0.35); }
.hb-slot.dragover .hb-frame { border-color: var(--verdigris, #4e7f72); border-style: solid; }

/* HB1c: MOUSE MODE - the freed cursor edits the bar where it stands. */
.hb.editing .hb-slot { pointer-events: auto; cursor: grab; }
.hb.editing .hb-slot.hb-empty { cursor: default; }
.hb.editing .hb-slot:not(.hb-empty):hover .hb-frame { border-color: rgba(192,138,62,0.85); }
.hb.editing .hb-hint { display: block; }

/* A FINGER IN PLAY: the slots are the phone's digit row. */
@media (pointer: coarse) { .hb.on .hb-slot { pointer-events: auto; } }

/* THE CARRIED SPELL OR SLOT. */
.hb-ghost { position: fixed; z-index: 16; pointer-events: none; transform: translate(-50%, -60%);
  display: grid; justify-items: center; gap: 4px; font-family: ${PIXEL_STACK};
  filter: drop-shadow(0 6px 10px rgba(0,0,0,0.55)); }
.hb-ghosttile { width: 46px; height: 46px; display: grid; place-items: center; border: 2px solid var(--brass, #c08a3e);
  background: rgba(23,27,33,0.94); }
.hb-ghost[class*="el-"] .hb-ghosttile { border-color: var(--hb-acc); background: radial-gradient(circle at 35% 30%, #2c4a72, #15253d 62%, #0c1626); }
.hb-ghosttile img { max-width: 40px; max-height: 40px; image-rendering: pixelated; }
.hb-ghostverb { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--slate, #171b21);
  background: var(--brass, #c08a3e); padding: 2px 6px; white-space: nowrap; opacity: 0; }
.hb-ghostverb.on { opacity: 1; }
.hb-ghost.clearing .hb-ghosttile { border-color: var(--blood, #8c3a32); opacity: 0.7; }
.hb-ghost.clearing .hb-ghostverb { background: var(--blood, #8c3a32); color: var(--bone, #e9e4d9); }

/* THE DIAMOND STANDS DOWN while the hotbar is up (one bar or the other). */
.hud-quick.hotbarmode .hud-qdiamond, .hud-quick.hotbarmode .hud-qspell { display: none; }

@media (max-width: 760px) { .hb { --hb-cell: 40px; --hb-gap: 3px; } .hb-glyph { font-size: 12px; } .hb-hint { display: none !important; } }
@media (max-width: 480px) { .hb { --hb-cell: 32px; --hb-gap: 2px; } .hb-key { font-size: 8px; } .hb-count { font-size: 9px; } }
@media (prefers-reduced-motion: reduce) {
  .hb-slot, .hb-slot.hb-strike, .hb-slot.hb-deny { animation: none; transition: none; transform: none; }
  .hb-ring { display: none; }
  .hb-slot.hb-strike .hb-flash { animation: none; opacity: 0.6; }
}
`;
