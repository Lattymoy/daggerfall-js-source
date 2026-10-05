// @ts-check
// CSA-L - THE HELM PANEL (2026-09-28, the player's ask: "instead of an overuse of keybinds, is there a way we can
// instead develop enhanced plus UI elements?"). Come Sail Away's helm is nine keys - the sails, the trim and its
// modifier, the lanterns, the time scale's three and leaving - and a player at the wheel had to know every one of
// them; a phone and a pad reached none (AUDIT PRE-MERGE 0928 U4). This is the helm on screen, in Enhanced Plus:
//
// - EVERY BUTTON IS ITS KEY. A press is the registry action the key presses - its edge for a tap (ActionStarted, the
//   mod's GetKeyDown), held while the finger or the button is down for the trim (HasAction) - handed to the mod
//   through the host's one input seam (scenes/world.js csaHelmInput), so the mod's own code runs exactly as it runs
//   for the key, and the keys still work (KB1: bindable, and a press without a key bound still presses). What the
//   panel shows it reads off the mod (systems/comeSailAway.js helmPanelState) and never writes.
// - THE HUD'S KIND OF THING, NOT A WINDOW (the travel panel's law, ui/enhancedTravelControl.js): it pauses nothing -
//   the boat sails on under it - and registers with no overlay stack; only its buttons take the pointer. A window
//   over the HUD hides it. It stands under the compass, where the journey bar stands (a journey and a helm are never
//   up together: a fast travel leaves the helm).
// - THE MOUSE: its buttons take a click whenever the pointer is free - the free-mouse key (Y), a surface, a finger -
//   as the hotbar's and the spell tiles' do; while the look holds the pointer, the title says how to free it.
// - A FINGER: every button is a finger's size (44 px) and the bar stands clear of the stick and the corner.
// - A PAD: the d-pad is the helm's while it is held (ui/gamepadInput.js HELM_DPAD), and the prompt bar says so.
// - ABOARD ANOTHER'S BOAT (CSA-K): the same bar names whose deck you stand on, and holds no button - the helm is theirs.
//
// Enhanced Plus only: the classic skin keeps the mod's keys as the mod drew them (no panel of its own).
// UPDATED, NOT REBUILT (the HUD's third law): the buttons are made again only when the set of them changes.
import { PIXEL_STACK } from './pixelifyFive.js';
import { injectEnhancedStyle } from './enhancedStyle.js';
import { HELM_DPAD } from './plusPad.js';
import { HULL_NAMES } from '../systems/comeSailAwayBoat.js';
import { BOAT_ACTIONS } from '../systems/comeSailAway.js';

export const ENHANCED_HELM_ID = 'enhanced-helm';
const HELM_STYLE_ID = 'enhanced-helm-style';

/** The registry actions the panel presses - the mod's own nine and HELM-KEYS' more and less sail, by the panel's names
 *  for them (one home for the names: systems/comeSailAway.js BOAT_ACTIONS). */
export const HELM_ACTIONS = Object.freeze({
  sail: BOAT_ACTIONS.toggleSail, light: BOAT_ACTIONS.toggleLight, disembark: BOAT_ACTIONS.disembark,
  trimLeft: BOAT_ACTIONS.trimLeft, trimRight: BOAT_ACTIONS.trimRight, trimModifier: BOAT_ACTIONS.trimModifier,
  slower: BOAT_ACTIONS.timeScaleDown, faster: BOAT_ACTIONS.timeScaleUp, normal: BOAT_ACTIONS.timeScaleReset,
  more: BOAT_ACTIONS.sailUp, less: BOAT_ACTIONS.sailDown,
});
const A = HELM_ACTIONS;
const PAD_CODE = Object.fromEntries(Object.entries(HELM_DPAD).map(([code, dir]) => [dir, code]));

/**
 * CSA-L: A PAD'S D-PAD AT THE HELM (ui/gamepadInput.js reports each direction's tap, hold and let-go): up raises or
 * stows the sails - held, the square sails alone where the hull carries both kinds (the modifier's chord); down lights
 * or douses the lanterns - held, leaves the helm; left and right step the time scale down and up - held, trim the sails
 * while the trim is the player's (SailingAssist.AutoTrimming off), else left held puts the time back to one. Returns
 * true for a hold the let-go must end (the trim). HELM-TIME-ONLINE: with the time dial retired (`h.timeDial` false -
 * online) left and right step nothing, and held they only trim.
 * @param {'up'|'down'|'left'|'right'} dir @param {'tap'|'hold'|'release'} kind
 * @param {any} h - helmPanelState() @param {{ press: (a: string, w?: string) => void, hold: (a: string, on: boolean) => void }} io
 */
export function helmPadGesture(dir, kind, h, { press, hold }) {
  if (!h) return false;
  const trim = dir === 'left' ? A.trimLeft : A.trimRight;
  if (kind === 'release') { if (dir === 'left' || dir === 'right') hold(trim, false); return false; }
  if (kind === 'tap') {
    if (dir === 'up') { if (h.hasSails) press(A.sail); }
    else if (dir === 'down') press(A.light);
    else if (h.timeDial === false) return false;   // HELM-TIME-ONLINE: no dial to step
    else if (dir === 'left') press(A.slower);
    else if (dir === 'right') press(A.faster);
    return false;
  }
  if (dir === 'up') { if (h.squareToggle) press(A.sail, A.trimModifier); else if (h.hasSails) press(A.sail); return false; }
  if (dir === 'down') { press(A.disembark); return false; }
  if (h.manualTrim && h.hasSails) { hold(trim, true); return true; }
  if (h.timeDial === false) return false;   // HELM-TIME-ONLINE: no time to put back
  if (dir === 'left') press(A.normal); else press(A.faster);
  return false;
}
/** CSA-L: the prompt bar's rows at the helm (the pad's own glyphs, ui/plusPad.js showPrompts). */
export function helmPadPrompts(h) {
  if (!h) return null;
  const trims = h.manualTrim && h.hasSails;
  const rows = [
    [[PAD_CODE.up], h.squareToggle ? 'Sails (hold: square sails)' : 'Sails'],
    [[PAD_CODE.down], 'Lanterns (hold: leave the helm)'],
  ];
  // HELM-TIME-ONLINE: online no dial - the pair says the trim alone, where the trim is the player's
  if (h.timeDial === false) { if (trims) rows.push([[PAD_CODE.left, PAD_CODE.right], 'Trim (hold)']); }
  else rows.push([[PAD_CODE.left, PAD_CODE.right], trims ? 'Slower / faster (hold: trim)' : 'Slower / faster (hold left: normal time)']);
  return rows;
}

/**
 * The buttons the helm shows for the mod's state (helmPanelState): each `{ act, label, kind, action, withHeld?,
 * disabled? }` - a `tap` presses `action` once (the modifier held with it for the square sails, as the key's own
 * chord is), a `hold` holds it (and its modifier) while down, `hook` asks the host. Pure: the pins read it.
 */
export function helmButtons(h) {
  if (!h) return [];
  const out = [];
  // HELM-LADDER: the sails' button is the mod's own toggle (the End key's) - the arrows climb the oars' rungs first now,
  // and the button raises or strikes all her canvas as its label says, from any rung
  if (h.hasSails) out.push({ act: 'sails', label: h.sailsUp ? 'Stow sails' : 'Raise sails', kind: 'tap', action: A.sail });
  if (h.squareToggle) out.push({ act: 'square', label: h.squareUp ? 'Stow square sails' : 'Raise square sails', kind: 'tap', action: A.sail, withHeld: A.trimModifier });
  if (h.manualTrim && h.hasSails) {
    out.push({ act: 'trimLeft', label: '◀ Trim', kind: 'hold', action: A.trimLeft }, { act: 'trimRight', label: 'Trim ▶', kind: 'hold', action: A.trimRight });
    // the square sails' own trim, where the hull has both kinds (a square rig alone trims them with the brackets bare)
    if (h.hasSquare && !h.squareOnly) out.push({ act: 'squareLeft', label: '◀ Square', kind: 'hold', action: A.trimLeft, withHeld: A.trimModifier }, { act: 'squareRight', label: 'Square ▶', kind: 'hold', action: A.trimRight, withHeld: A.trimModifier });
  }
  out.push({ act: 'light', label: h.light ? 'Douse lanterns' : 'Light lanterns', kind: 'tap', action: A.light });
  // HELM-TIME-ONLINE (2026-10-04, Mac: "Remove the time dial from ships online"): the dial's three only where it turns
  if (h.timeDial !== false) out.push({ act: 'slower', label: '−', kind: 'tap', action: A.slower, disabled: !(h.timeScaleIndex > 0) },
    { act: 'normal', label: `×${h.timeScale ?? 1}`, kind: 'tap', action: A.normal, disabled: !(h.timeScaleIndex > 0) },
    { act: 'faster', label: '+', kind: 'tap', action: A.faster, disabled: !(h.timeScaleIndex < h.timeScaleMax) });
  if (h.orders) out.push({ act: 'orders', label: 'Orders', kind: 'hook' });   // SHIP-CREW: her captain's orders (the naval arc on)
  out.push({ act: 'position', label: 'Position', kind: 'hook' });
  out.push({ act: 'leave', label: 'Leave the helm', kind: 'tap', action: A.disembark });
  return out;
}

/** The layout and the letters; the Plus kit paints the bar, the buttons and the socket (enhancedFrame.js FRAME_ROLES). */
export const HELM_CSS = `
/* CSA-L: THE HELM PANEL (ui/enhancedHelm.js) - under the compass, above the HUD and below every window */
.helmpanel { position: fixed; inset: 0; z-index: 5; pointer-events: none; font-family: ${PIXEL_STACK}; -webkit-font-smoothing: none;
  font-variant-ligatures: none; color: #d8cfae; --hp-top: calc(18px + 28px * var(--hud-scale, 1) + 20px); }
body:has(.hud-foe.on) .helmpanel { --hp-top: calc(18px + 28px * var(--hud-scale, 1) + 20px + 46px * var(--hud-scale, 1)); }
/* AUDIT NAV1 (the presentation): as wide as its buttons (max-content) - a box placed at left: 50% shrinks to the room
   right of its left edge, so the bar wrapped at half the screen: two rows at 1920x1080, three on a phone */
.helmpanel-bar { position: absolute; left: 50%; top: var(--hp-top); transform: translateX(-50%); display: flex; flex-direction: column;
  align-items: center; gap: 6px; padding: 8px 12px; width: max-content; max-width: calc(100vw - 24px); box-sizing: border-box; border: 2px solid; border-radius: 0; }
.helmpanel-title { display: flex; flex-wrap: wrap; justify-content: center; align-items: baseline; gap: 4px 12px; }
.helmpanel-name { font-size: 15px; letter-spacing: 0.06em; color: #efe8d6; text-shadow: 1px 1px 0 #050608; }
.helmpanel-hint { font-size: 11px; letter-spacing: 0.08em; color: #a89f88; text-shadow: 1px 1px 0 #050608; }
.helmpanel-hint:empty { display: none; }
.helmpanel-btns { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 6px; }
.helmpanel-btns:empty { display: none; }
.helmpanel-btn { pointer-events: auto; display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 4px 10px;
  border: 2px solid; border-radius: 0; font: inherit; font-size: 13px; letter-spacing: 0.06em; color: #e6dec6; cursor: pointer;
  text-shadow: 1px 1px 0 #050608; touch-action: none; user-select: none; -webkit-user-select: none; }
.helmpanel-btn[disabled] { opacity: 0.45; cursor: default; }
.helmpanel-btn.held { color: rgb(243,239,44); text-shadow: 1px 1px 0 rgb(93,77,12); }
.helmpanel-accel { min-width: 52px; justify-content: center; font-variant-numeric: tabular-nums; color: rgb(243,239,44);
  text-shadow: 1px 1px 0 rgb(93,77,12); }
.helmpanel-key { font-size: 11px; letter-spacing: 0.04em; color: #a89f88; }
.helmpanel-key:empty { display: none; }
/* AUDIT NAV1 (the presentation): a finger's bar stands centred in the room right of the corner's two presses - the
   dial's and the menu's, 48 px from 16 and 72 (ui/touch.js), 120 px in past the safe area, and 8 of air - to 16 px
   from the right edge: centred on the screen its 60 px reserve left the menu's press under a bar as wide as its
   buttons (width: max-content, above), and a reserve either side wrapped a 667 px phone's buttons to three rows, the
   bar's foot on the crosshair */
.helmpanel.touch .helmpanel-bar { top: calc(8px + env(safe-area-inset-top, 0px)); left: calc(50% + 56px + (env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)) / 2);
  max-width: calc(100vw - 144px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)); }
.helmpanel.touch .helmpanel-btn { min-height: 44px; min-width: 44px; }
.helmpanel.touch .helmpanel-key { display: none; }
@media (max-width: 560px) { .helmpanel-btn { padding: 4px 7px; font-size: 12px; } }
`;

let host = null;
/** @type {any} */
let parts = null;
/** @type {any} */
let last = null;
/** The hold buttons down now: act -> the button's release. */
const holding = new Map();

function injectHelmStyle(doc) {
  if (doc.getElementById?.(HELM_STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = HELM_STYLE_ID;
  st.textContent = HELM_CSS;
  (doc.head ?? doc.body)?.append?.(st);
}
/** A press on the panel is the panel's - never a swing, a look or an activation in the world (decorPanel.js's law). */
const swallowPresses = (node) => {
  const swallow = (e) => e.stopPropagation();
  for (const t of ['pointerdown', 'mousedown', 'mouseup', 'click', 'touchstart', 'wheel', 'contextmenu']) node.addEventListener(t, swallow);
};

function build(doc) {
  try { injectEnhancedStyle(doc); } catch { /* the kit's sheet is the HUD's; a document without it still takes the panel */ }
  injectHelmStyle(doc);
  const root = doc.createElement('div');
  root.id = ENHANCED_HELM_ID;
  root.className = 'helmpanel';
  const bar = doc.createElement('div');
  bar.className = 'helmpanel-bar';
  const title = doc.createElement('div');
  title.className = 'helmpanel-title';
  const name = doc.createElement('span');
  name.className = 'helmpanel-name';
  const hint = doc.createElement('span');
  hint.className = 'helmpanel-hint';
  title.append(name, hint);
  const btns = doc.createElement('div');
  btns.className = 'helmpanel-btns';
  bar.append(title, btns);
  root.append(bar);
  swallowPresses(root);
  doc.body.append(root);
  return { root, bar, name, hint, btns, buttons: new Map() };
}

/** Every hold let go - the panel hidden, rebuilt or gone never leaves a trim held. */
function releaseAll() {
  for (const release of [...holding.values()]) release();
  holding.clear();
}

function makeButtons(doc, list, hooks) {
  releaseAll();
  if (typeof parts.btns.replaceChildren === 'function') parts.btns.replaceChildren(); else parts.btns.textContent = '';
  parts.buttons.clear();
  for (const b of list) {
    const n = doc.createElement('button');
    n.type = 'button';
    n.className = `helmpanel-btn helmpanel-${b.act}${b.act === 'normal' ? ' helmpanel-accel' : ''}`;
    n.dataset.act = b.act;
    const label = doc.createElement('span');
    label.className = 'helmpanel-label';
    const key = doc.createElement('span');
    key.className = 'helmpanel-key';
    n.append(label, key);
    if (b.kind === 'hold') {
      const up = () => {
        if (!holding.has(b.act)) return;
        holding.delete(b.act);
        n.classList?.remove?.('held');
        hooks.hold?.(b.action, false);
        if (b.withHeld) hooks.hold?.(b.withHeld, false);
      };
      n.addEventListener('pointerdown', (e) => {
        e.preventDefault?.();
        if (n.disabled || holding.has(b.act)) return;
        try { n.setPointerCapture?.(e.pointerId); } catch { /* a pointer gone already */ }
        if (b.withHeld) hooks.hold?.(b.withHeld, true);
        hooks.hold?.(b.action, true);
        holding.set(b.act, up);
        n.classList?.add?.('held');
      });
      for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) n.addEventListener(t, up);
    } else {
      n.addEventListener('click', (e) => {
        e.preventDefault?.();
        if (n.disabled) return;
        if (b.kind === 'hook') hooks[b.act]?.();
        else hooks.press?.(b.action, b.withHeld ?? null);
      });
    }
    parts.btns.append(n);
    parts.buttons.set(b.act, { node: n, label, key });
  }
}

/**
 * The panel's frame. `state`: { helm: helmPanelState() | null, aboard: { hull, owner } | null, covered, touch,
 * mouseFree, freeKey (the free-mouse key's label), keyOf(action) -> its key's label } - `hooks`: press(action,
 * withHeld), hold(action, on), position(). Returns the root, or null when nothing stands.
 */
export function drawEnhancedHelm(state = {}, hooks = {}, { doc = globalThis.document } = {}) {
  if (!doc?.body) return null;
  const h = state.helm ?? null, aboard = h ? null : (state.aboard ?? null);
  if (!h && !aboard) { hideEnhancedHelm(); return null; }
  if (!host) { last = {}; parts = build(doc); host = parts.root; }
  if (state.covered) {
    if (last.covered !== true) { last.covered = true; parts.root.style.display = 'none'; releaseAll(); }
    return parts.root;
  }
  if (last.covered === true) { last.covered = false; parts.root.style.display = ''; }
  const hud = /** @type {any} */ (doc.querySelector?.('.hud'));
  const scale = hud?.style?.getPropertyValue?.('--hud-scale') || '1';   // the HUD's scale, read off the HUD (the journey bar's PLUS8)
  if (last.scale !== scale) { last.scale = scale; parts.root.style.setProperty?.('--hud-scale', scale); }
  const rootClass = `helmpanel${state.touch ? ' touch' : ''}${aboard ? ' aboard' : ''}`;
  if (last.rootClass !== rootClass) { last.rootClass = rootClass; parts.root.className = rootClass; }
  const title = h ? `At the helm - ${HULL_NAMES[h.hull] ?? 'Boat'}` : `Aboard ${aboard.owner ? `${aboard.owner}'s` : "another player's"} ${HULL_NAMES[aboard.hull] ?? 'boat'}`;
  if (last.title !== title) { last.title = title; parts.name.textContent = title; }
  const hint = h ? helmHint(h, state) : '';
  if (last.hint !== hint) { last.hint = hint; parts.hint.textContent = hint; }
  const list = helmButtons(h);
  const sig = list.map((b) => b.act).join(',');
  if (last.sig !== sig) { last.sig = sig; last.labels = {}; makeButtons(doc, list, hooks); }
  for (const b of list) {
    const p = parts.buttons.get(b.act);
    if (!p) continue;
    const key = b.action && !state.touch ? (state.keyOf?.(b.action) ?? '') : '';
    const was = last.labels[b.act];
    if (!was || was.label !== b.label || was.key !== key || was.disabled !== !!b.disabled) {
      last.labels[b.act] = { label: b.label, key, disabled: !!b.disabled };
      p.label.textContent = b.label;
      p.key.textContent = key;
      p.node.disabled = !!b.disabled;
      p.node.setAttribute?.('aria-label', b.label);
    }
  }
  return parts.root;
}

/**
 * HELM-KEYS (2026-09-29, the player: "make the ship controls more intuitive instead of a bunch of buttons and key
 * binds"): the bar's line under its name - in irons, how she comes out (the key that strikes sail and the one that
 * rows - under the responsive helm the rudder's keys first, AUDIT NAV2 F18); else, on a keyboard, the helm's whole
 * hand at a glance - the sails on the arrows, the rudder on the turn keys - and while the look holds the mouse, how to
 * free it for the buttons. A finger reads the buttons themselves. Every key is the one bound now (`keyOf`); one bound
 * to nothing is left out. HELM-LADDER (2026-10-04): the hand is the ladder's now - W, S and the up and down arrows her
 * oars and her sails, A, D and the side arrows her rudder; in irons, one rung down strikes sail and puts her on her oars.
 * @param {any} h - helmPanelState() @param {{ touch?: boolean, mouseFree?: boolean, freeKey?: string, keyOf?: (a: string) => string }} state
 */
export function helmHint(h, state = {}) {
  const key = (a) => (state.touch ? '' : (state.keyOf?.(a) ?? ''));
  if (h.inIrons) {
    // HELM-LADDER: one rung down strikes the last of her sail and puts her on her oars, pulling ahead
    const strike = [key('MoveBackwards'), key(A.less)].filter(Boolean).join(' ');
    const oars = `strike sail${strike ? ` (${strike})` : ''} and row her round`;
    if (!h.responsive) return `In irons - ${oars}`;
    // AUDIT NAV2 F18: the responsive helm's rudder answers at rest (HELM-WAY) - the helm alone brings her off the wind
    const steer = [key('TurnLeft'), key('TurnRight')].filter(Boolean).join(' ');
    return `In irons - put the helm over${steer ? ` (${steer})` : ''}, or ${oars}`;
  }
  if (state.touch) return '';
  const keys = (label, ...as) => { const ks = [...new Set(as.map(key).filter(Boolean))]; return ks.length ? `${label} ${ks.join(' ')}` : ''; };
  // HELM-LADDER: W and the up arrow, S and the down arrow, one ladder - her oars, then her sails; A, D and the side arrows steer
  const parts = [keys(h.hasSails ? 'Oars & sails' : 'Oars', 'MoveForwards', 'MoveBackwards', A.more, A.less), keys('Steer', 'MoveLeft', 'MoveRight', 'TurnLeft', 'TurnRight')];
  if (!state.mouseFree) parts.push(`Free the mouse (${state.freeKey || 'Y'}) to use these`);
  return parts.filter(Boolean).join(' · ');
}

/** Taken down: at the helm no longer, aboard nothing, the skin or the mod off. Every hold is let go first. */
export function hideEnhancedHelm() {
  if (!host) return;
  releaseAll();
  try { host.remove(); } catch { /* already gone */ }
  host = null; parts = null; last = null;
}

export const enhancedHelmMounted = () => !!host;
/** THE MERGE with NAV-F: the bar standing now - mounted and not covered - or null. What stands under it at the top of
 *  the screen (the naval target card, ui/navalHud.js) measures its foot, since its height is its buttons' wrap. */
export const enhancedHelmBar = () => (host && last?.covered !== true ? parts.bar : null);
