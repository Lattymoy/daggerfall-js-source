// HUD-MOVE (2026-10-01, Mac: "for the enhanced plus UI can you make chat, hp mana stamina bar segment and all the
// element moveable and add a reset UI and lock UI in the settings (lock should be on by default)? Also make the
// additional uis on the overworld movable too.") - THE MOVABLE HUD.
//
// ONE SEAM, NO HOST EDITS. Every piece is found by its selector, so the modules that build them (enhancedHud,
// chatPanel, questTracker, partyPanel, travelViewHud, enhancedTravelControl...) learn nothing: a piece built late or
// rebuilt after a scene change is picked up on the next sweep. A piece is moved by the CSS `translate` property,
// which composes with whatever `transform` its sheet already gives it (centring, the HUD scale), so the sheet's own
// placement is untouched and a reset is simply "no translate". The rule is written against the piece's own
// selector, so a node carried out of its place (the hotbar under a window, the travel bar docked into the Overworld
// block) is not dragged along with an offset that was meant for somewhere else.
//
// DATA ATTRIBUTES, NOT CLASSES: several hosts rewrite `className` whole (the quest tracker, the party cards), which
// would strip a class; an attribute survives.
//
// LOCKED (the default, uiPrefs.hudLocked) nothing here takes the pointer and the HUD is as it always was. UNLOCKED,
// every visible piece is outlined and takes the pointer; a drag moves it, a double-click puts it back, and a banner
// at the top says how to free the mouse and offers Lock and Reset.
import { getPref, setPref } from '../../systems/uiPrefs.js';
import { isEnhanced } from '../../systems/uiSkin.js';   // ENHANCED PLUS ONLY: no other UI is customisable
import { seatHudPlacer } from './hudPlacer.js';   // MOVED-NOTICE: a piece's builder places it at once, through the leaf
import { t } from '../../systems/textManager.js';   // L10N4: a piece's name in the player's language, read as it is read (HUD-SADDLE's the first)


export const HUD_LOCK_PREF = 'hudLocked';
export const HUD_LAYOUT_PREF = 'hudLayout';
export const HUD_BARS_SPLIT_PREF = 'hudBarsSplit';
export const HUD_SNAP_PREF = 'hudSnap';
/** How near (screen px) an edge or centre must come to another's to catch on it. */
export const SNAP_PX = 8;

/** The pieces, in the order the banner would name them. `sel` must match only while the piece stands in its place. */
export const HUD_PIECES = Object.freeze([
  // the gameplay HUD
  // TURN1 (Dudey: "let the players rotate the compass with alt + u"): `turn` - the piece can be turned over in the editor
  // (its own press, beside the X); a dress that draws a compass with a top and a bottom (DFO Grimoire's, hung from the
  // screen's top) stands it up again when it is turned. The flag rides the piece's layout and Reset clears it
  { id: 'compass', sel: '.hud .hud-compass', name: 'Compass', len: true, turn: true },
  // AUDIT C&C S3: the temperature plate stands INSIDE another piece in the page but is its own piece, as the status
  // widget is the quick block's - the outer piece's move and size undone on it, its own X. UI-CALM (2026-10-14): it stands
  // in the bottom-left corner now, the quick block's caption (ui/enhanced/enhancedHud.js), so the quick block is its outer piece
  { id: 'temp', sel: '.hud .hud-temp', name: 'Temperature', inside: 'quick' },
  // `dummy`: hidden until there is something to show (no foe targeted) - while unlocked it stands as a preview to move
  { id: 'foe', sel: '.hud .hud-foe', name: 'Target bar', dummy: true, len: true },
  { id: 'hotbar', sel: '.hud .hb', name: 'Hotbar' },
  { id: 'breath', sel: '.hud .hud-breath', name: 'Breath bar', len: true, dummy: true },
  // the three bars move as ONE piece, or (hudBarsSplit) each on its own - `edit` says in which mode a piece takes a
  // drag; its offset always stands, so bars moved apart keep their places when they are joined again
  { id: 'vitals', sel: '.hud .hud-bars', name: 'Health, magicka and fatigue', edit: 'joined', len: '--hml-g' },
  { id: 'magicka', sel: '.hud .hud-bars .hud-magicka', name: 'Magicka bar', edit: 'split', len: '--hml-b' },
  { id: 'health', sel: '.hud .hud-bars .hud-health', name: 'Health bar', edit: 'split', len: '--hml-b' },
  { id: 'fatigue', sel: '.hud .hud-bars .hud-fatigue', name: 'Fatigue bar', edit: 'split', len: '--hml-b' },
  { id: 'renown', sel: '.hud .hud-renown', name: 'Renown bar', len: true, dummy: true },
  // SKILL-READY / FIRM-STARS (Dudey: "should also be movable with alt + u"): the two tiles beside the Renown bar
  // (ui/hud/hudAdvance.js) - each its own piece, standing in the bar's row, so they ride it until moved on their own
  { id: 'skillsReady', sel: '.hud .hud-adv-skill', get name() { return t('menu.hud.piece.skillsReady', 'Skills ready'); }, dummy: true },
  { id: 'starsUnspent', sel: '.hud .hud-adv-firm', get name() { return t('menu.hud.piece.starsUnspent', 'Firmament stars'); }, dummy: true },
  { id: 'quick', sel: '.hud .hud-quick', name: 'Quick slots' },
  // `inside`: the status widget stands INSIDE the quick-slot block in the page, but is its own piece - the block's move
  // and size are undone on it (paintInside), so moving the quick slots leaves the buffs where they are
  { id: 'status', sel: '.hud .hud-stat', name: 'Buffs, debuffs, hunger & thirst', dummy: true, inside: 'quick' },
  { id: 'chat', sel: '.dfchat', name: 'Chat' },
  { id: 'tracker', sel: '.qtrack', name: 'Quest tracker', dummy: true, ghost: 'tracker' },
  { id: 'party', sel: '.dfparty', name: 'Party', dummy: true, ghost: 'party' },
  { id: 'notices', sel: '.notice-stack', name: 'Notifications', dummy: true, ghost: 'notices' },
  { id: 'boss', sel: '.wb-boss-bar', name: 'Boss bar', dummy: true, ghost: 'boss', len: true },   // HUD-LEN: and its length
  { id: 'revenant', sel: '.rvncard-stack', name: 'Revenant taunts', dummy: true, ghost: 'revenant' },   // REVENANT-CARD
  { id: 'loot', sel: '.lootbanner-stack', name: 'Loot banners', dummy: true, ghost: 'loot' },   // LOOT-BANNER
  // HUD-SADDLE (FIELD BUGS 2026-10-14, Discord: "Riding Window is not able to be edited in the HUD Editor (Alt+U)"): the
  // saddle panel's bar (ui/enhanced/enhancedSaddle.js) - its layer is the whole screen, so the piece is the bar inside it; a
  // preview while nobody rides (its stand-in is that layer, the bar inside it the piece - ghostOf). No `dummy`: the
  // panel is built only when there is a ride to show, and a window over the HUD covers it as it covers the HUD
  { id: 'saddle', sel: '.saddlepanel .saddlepanel-bar', get name() { return t('menu.hud.piece.saddle', 'Riding panel'); }, ghost: 'saddle' },
  // HUD-HELM (2026-10-15, Mac: "Yes, same branch"): the helm panel's bar (ui/enhanced/enhancedHelm.js), the saddle's twin - its
  // layer the whole screen, the piece the bar inside it, a preview while nobody is at a helm; the sea's target card
  // stands under the bar wherever it is moved (ui/naval/navalHud.js drawNavalHud's `under`)
  { id: 'helm', sel: '.helmpanel .helmpanel-bar', get name() { return t('menu.hud.piece.helm', 'Helm panel'); }, ghost: 'helm' },
  { id: 'fps', sel: '#fps-counter', name: 'FPS counter' },
  { id: 'midtext', sel: '#enhanced-midtext, .hudmid[data-hm-ghost="midtext"]', name: 'Screen messages', dummy: true, ghost: 'midtext' },
  { id: 'netstatus', sel: '#enhanced-netstatus, .hudstatus[data-hm-ghost="netstatus"]', name: 'Online status', dummy: true, ghost: 'netstatus' },
  // the Overworld
  { id: 'overworld', sel: '#travel-view .tview-bar', name: 'Overworld panel' },
  { id: 'overworldFilters', sel: '#travel-view .tview-side', name: 'Overworld filters' },   // FILTERS-LEFT
  { id: 'travel', sel: '#enhanced-travel .travelpanel-bar', name: 'Travel controls' },
  { id: 'junction', sel: '.travelpanel-junction', name: 'Junction map' },
].map(Object.freeze));

const STYLE_ID = 'hud-layout-style';
const BANNER_ID = 'hud-layout-banner';
const HANDLES_ID = 'hud-layout-handles';
const SWEEP_MS = 250;
/** How much of a piece must stay on screen (px). */
const KEEP_PX = 32;

export const hudLocked = () => getPref(HUD_LOCK_PREF) !== false;
/** ENHANCED PLUS ONLY (Mac: "what does happen when u press alt + u or activate unlock mode in other uis outside of
 *  enhanced plus, those shouldn't be customizable"): under Classic or GrimoireUI the editor never opens, Alt+U does
 *  nothing (the key passes on as it was), and no saved place, size or length is put on anything - the other UIs stand
 *  exactly as their sheets have them. The layout is kept for when Enhanced Plus is chosen again. */
const customisable = () => { try { return isEnhanced(); } catch { return false; } };
const locked = () => !customisable() || hudLocked();
/** Whether the HUD is being arranged now (its editor up: unlocked where it can be). */
export const hudArranging = () => !locked();
export const hudBarsSplit = () => getPref(HUD_BARS_SPLIT_PREF) === true;
export const hudSnap = () => getPref(HUD_SNAP_PREF) !== false;
const editable = (p) => !p.edit || (p.edit === 'split') === hudBarsSplit();

function readLayout() {
  const v = getPref(HUD_LAYOUT_PREF);
  return v && typeof v === 'object' ? v : {};
}
/** A piece's layout: offset (x, y, local px), scale (s) and length (l, a multiple of its sheet width). */
let liveOuter = null;   // the outer piece being dragged right now: its insides follow its live place, not the saved one
const layoutOf = (id) => {
  if (liveOuter && liveOuter.id === id) return liveOuter.o;
  const o = readLayout()[id] ?? {};
  const num = (v, d) => (Number.isFinite(v) ? v : d);
  return { x: num(o.x, 0), y: num(o.y, 0), s: num(o.s, 1), l: num(o.l, 1), off: o.off === true, t: o.t === true };
};
const pieceOf = (id) => HUD_PIECES.find((q) => q.id === id);
const lenVarOf = (p) => (typeof p?.len === 'string' ? p.len : '--hml');
/** Scale and length limits. */
const SCALE_MIN = 0.5, SCALE_MAX = 2.5, LEN_MIN = 0.4, LEN_MAX = 3;

const MOVED = HUD_PIECES.flatMap((p) => p.sel.split(',').map((x) => `${x.trim()}[data-hm]`)).join(',\n');
/** The editor's sheet, built once from the pieces - exported as the other sheets are, so a pin reads the rules the
 *  game injects (HUD-CLASS, test/sheetRules.mjs). */
export const HUD_LAYOUT_CSS = `
/* a piece's own place and size never pass to a piece inside it (a bar in the vitals, the buffs in the quick block) */
@property --hmx { syntax: '<length>'; inherits: false; initial-value: 0px; }
@property --hmy { syntax: '<length>'; inherits: false; initial-value: 0px; }
@property --hms { syntax: '<number>'; inherits: false; initial-value: 1; }
${MOVED} { translate: var(--hmx, 0px) var(--hmy, 0px); scale: var(--hms, 1); }
/* MOVED-NOTICE (FIELD BUGS 2026-10-03, SylviaB: "it momentarily spawns in its original location and slides in from the
   side ... changing it to a fade in/out at the updated location"): a slide is from the EDGE the sheet stands the stack
   on - moved off it, a notice or a revenant's card fades in and out where it stands (the sheets' own opacity
   transitions; the node still leaves at NOTICE_SLIDE_MS / REVENANT_SLIDE_MS, past the fade) */
.notice-stack[data-hm-moved] > .notice, .notice-stack[data-hm-moved] > .notice.notice-in,
.notice-stack[data-hm-moved] > .notice.notice-out { transform: none; }
.rvncard-stack[data-hm-moved] > .rvncard, .rvncard-stack[data-hm-moved] > .rvncard.rvncard-in,
.rvncard-stack[data-hm-moved] > .rvncard.rvncard-out { transform: none; }
/* OFF (the piece's X): gone in play; greyed while the editor is open, so it can be turned back on */
[data-hm-off]:not([data-hm-edit]) { visibility: hidden !important; }
[data-hm-off][data-hm-edit] { opacity: 0.35 !important; filter: grayscale(1) !important; outline-color: #8b8578 !important; }
/* the quick block turned off leaves the buffs (their own piece) standing, unless they are off too */
.hud-quick[data-hm-off]:not([data-hm-edit]) .hud-stat[data-hm]:not([data-hm-off]) { visibility: visible !important; }
/* AUDIT C&C S3: ...and the compass turned off leaves the temperature plate (its own piece) standing, unless it is off too */
.hud-quick[data-hm-off]:not([data-hm-edit]) .hud-temp[data-hm]:not([data-hm-off]) { visibility: visible !important; }   /* UI-CALM: the plate's outer piece is the quick block */
/* LENGTH (only once a piece's length is changed - the sheet's own widths, small-screen ones too, stand until then) */
.hud .hud-bars[data-hm-len] .hud-vital .hud-track, .hud .hud-bars .hud-vital[data-hm-len] .hud-track {
  width: calc(min(190px, 23vw) * var(--hml-g, 1) * var(--hml-b, 1)) !important; }
.hud .hud-foe[data-hm-len] .hud-foetrack { width: calc(min(280px, 40vw) * var(--hml, 1)) !important; }
.hud .hud-foe[data-hm-len] .hud-foeblade { width: calc(min(360px, 54vw) * var(--hml, 1)) !important; }
.hud .hud-breath[data-hm-len] .hud-track { width: calc(min(140px, 18vw) * var(--hml, 1)) !important; }
.hud .hud-renown[data-hm-len] { width: calc((3 * min(190px, 23vw) + 32px) * var(--hml, 1)) !important; }
.hud .hud-compass[data-hm-len] { width: calc(min(520px, 60vw) * var(--hml, 1)) !important; }
/* HUD-LEN: the boss's bar at its sheet's width (ui/gate/gateBossBar.js BOSS_BAR_WIDTH) times its length; its track is the bar's */
.wb-boss-bar[data-hm-len] { width: calc(460px * var(--hml, 1)) !important; max-width: 96vw !important; }
/* THE HANDLES: a corner square scales a piece, an edge bar changes its length */
#${HANDLES_ID} { position: fixed; inset: 0; pointer-events: none; z-index: 7; }
#${HANDLES_ID} i { position: fixed; display: block; pointer-events: auto; touch-action: none; background: #e0b070;
  border: 1px solid #3a2a14; box-shadow: 0 0 0 1px rgba(0,0,0,0.4); }
#${HANDLES_ID} i[data-hm-handle="scale"] { width: 12px; height: 12px; cursor: nwse-resize; }
#${HANDLES_ID} i[data-hm-handle="len"] { width: 6px; height: 20px; cursor: ew-resize; }
#${HANDLES_ID} i[data-hm-handle="len"][data-axis="y"] { width: 20px; height: 6px; cursor: ns-resize; }
#${HANDLES_ID} i[data-hm-handle="off"] { width: 16px; height: 16px; cursor: pointer; background: #b8402e; color: #fff;
  font: 700 12px/16px sans-serif; text-align: center; font-style: normal; }
#${HANDLES_ID} i[data-hm-handle="off"][data-on="0"] { background: #4f7a3a; }
/* TURN1: the turn-over press shows only where a dress draws a compass with a top and a bottom (the Grimoire's) */
#${HANDLES_ID} i[data-hm-handle="turn"] { display: none; width: 16px; height: 16px; cursor: pointer; background: #e0b070; color: #3a2a14;
  font: 700 12px/16px sans-serif; text-align: center; font-style: normal; }
[data-hm-edit] { pointer-events: auto !important; cursor: move !important; touch-action: none !important;
  outline: 2px dashed rgba(224,176,112,0.95) !important; outline-offset: 3px;
  user-select: none; -webkit-user-select: none; }
[data-hm-edit][data-hm-drag] { outline-style: solid !important; }
/* the TARGET BAR's preview while unlocked and nothing is targeted: a sample foe at 70%, so it can be found and moved */
.hud .hud-foe[data-hm-dummy]:not(.on) { display: flex !important; opacity: 0.85; }
.hud .hud-foe[data-hm-dummy]:not(.on) .hud-foename { color: transparent !important; position: relative; }
.hud .hud-foe[data-hm-dummy]:not(.on) .hud-foename::after { content: 'Enemy (preview)'; color: #e8dcc0; position: absolute;
  left: 50%; top: 0; transform: translateX(-50%); white-space: nowrap; }
.hud .hud-foe[data-hm-dummy]:not(.on) .hud-foetrack .hud-fill { width: 70% !important; transform: none !important; }
.hud .hud-foe[data-hm-dummy]:not(.on) .hud-ghost, .hud .hud-foe[data-hm-dummy]:not(.on) .hud-chunk { display: none !important; }
.hud .hud-foe[data-hm-dummy]:not(.on) .hud-bladefull { clip-path: inset(0 15% 0 15%) !important; }   /* the blade face's 70% */
/* HUD-PREVIEW (Mac: "show in unlocked mode all notification popups and everything else that can pop up"): every piece
   that is only there sometimes stands while unlocked - its own face where it has one, a named sample where it is empty */
.hud .hud-breath[data-hm-dummy]:not(.on) { display: flex !important; opacity: 0.85; }
.hud .hud-breath[data-hm-dummy]:not(.on) .hud-fill { width: 70% !important; }
.hud .hud-renown[data-hm-dummy]:not(.on) { display: grid !important; grid-template-columns: 36px minmax(0, 1fr) 36px; opacity: 0.85; }
.hud .hud-adv[data-hm-dummy]:not(.on) { display: flex !important; opacity: 0.85; }   /* SKILL-READY / FIRM-STARS: the tiles stand to be moved */
.hud .hud-renown:has(.hud-adv[data-hm-dummy]):not(.on) { display: grid !important; grid-template-columns: 36px minmax(0, 1fr) 36px; }
/* the Renown bar turned off leaves its two tiles (their own pieces) standing, unless they are off too */
.hud-renown[data-hm-off]:not([data-hm-edit]) .hud-adv[data-hm]:not([data-hm-off]) { visibility: visible !important; }
.hud .hud-stat[data-hm-dummy]:empty, .hud .hud-stat[data-hm-dummy].noroom { display: flex !important; align-items: center;
  justify-content: center; min-width: 200px; min-height: 36px; padding: 0 10px; box-sizing: border-box;
  background: rgba(10,12,17,0.6); border: 1px dashed rgba(224,176,112,0.6); opacity: 0.9; }
.hud .hud-stat[data-hm-dummy]:empty::before, .hud .hud-stat[data-hm-dummy].noroom::before {
  content: 'Buffs · Debuffs · Hunger · Thirst'; color: #d8cfae; font-size: 12px; white-space: nowrap; }
.wb-boss-bar[data-hm-dummy] { display: block !important; }
.qtrack[data-hm-dummy] { display: flex !important; visibility: visible !important; }
.dfparty[data-hm-dummy] { display: block !important; visibility: visible !important; }
.notice-stack[data-hm-dummy]:empty { min-width: 240px; min-height: 48px; }
.notice-stack[data-hm-dummy]:empty::before { content: 'Notifications'; display: block; padding: 14px 20px;
  background: rgba(10,12,17,0.9); border-left: 4px solid #c08a3e; color: #d8cfae; }
[data-hm-ghost] .notice { transform: none !important; opacity: 1 !important; }
#enhanced-midtext[data-hm-dummy], #enhanced-netstatus[data-hm-dummy] { display: block !important; visibility: visible !important; }
#enhanced-midtext[data-hm-dummy]:empty::before { content: 'Screen message (preview)'; }
#enhanced-netstatus[data-hm-dummy]:empty::before { content: 'Online status (preview)'; }
/* the NAMES: each outlined piece's name over its top-left corner */
#${HANDLES_ID} b { position: fixed; display: block; pointer-events: none; padding: 1px 6px; white-space: nowrap;
  font: 600 11px/1.4 var(--data, sans-serif); letter-spacing: 0.04em; color: #0e1013; background: #e0b070;
  border: 1px solid #3a2a14; box-shadow: 0 1px 3px rgba(0,0,0,0.5); }
[data-hm-edit] *:not([data-hm-edit]) { pointer-events: none !important; }
#${BANNER_ID} { position: fixed; left: 50%; top: 30%; transform: translateX(-50%);   /* off the compass (Mac: "the compass is behind the hud unlocked message") */
  z-index: 6; display: flex; align-items: center; gap: 10px; padding: 7px 10px 7px 14px; pointer-events: auto;
  background: rgba(14,16,19,0.92); border: 2px solid #c08a3e; color: #d8cfae; font: 13px/1.3 var(--data, sans-serif);
  box-shadow: 0 4px 14px rgba(0,0,0,0.5); max-width: calc(100vw - 24px); box-sizing: border-box; }
#${BANNER_ID} span { flex: 1 1 auto; cursor: move; }   /* grab the words to move the banner itself */
#${HANDLES_ID} u { position: fixed; display: block; pointer-events: none; background: #5ec8ff; box-shadow: 0 0 4px #5ec8ff; }
#${HANDLES_ID} u[data-hm-guide="x"] { top: 0; bottom: 0; width: 1px; }
#${HANDLES_ID} u[data-hm-guide="y"] { left: 0; right: 0; height: 1px; }
#${BANNER_ID} button { font: inherit; color: #0e1013; background: #c08a3e; border: 0; padding: 4px 10px; cursor: pointer; }
#${BANNER_ID} button.ghost { background: transparent; color: #d8cfae; border: 1px solid #8b8578; }
`;
function injectStyle(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = STYLE_ID;
  st.textContent = HUD_LAYOUT_CSS;
  (doc.head ?? doc.body).append(st);
}

/** A piece standing INSIDE another (the status widget in the quick block): what to put on it so that, through the
 *  outer piece's own translate T and scale S (about the outer box's centre Cq), it lands at ITS OWN place and size -
 *  scale Ss/S about its centre Cs, and translate u = (Tstat - T + (1 - S)(Cs - Cq)) / S, all in the outer box's
 *  local pixels (the HUD's own scale is outside both and cancels). */
function insideTransform(node, p, own) {
  const o = own ?? { x: 0, y: 0, s: 1 };
  const outer = node.parentElement?.closest?.('[data-hm]');
  if (!outer || outer.dataset?.hm !== p.inside) return o;
  const q = layoutOf(p.inside);
  const S = q.s || 1;
  if (!q.x && !q.y && S === 1) return o;
  const cqx = (outer.offsetWidth || 0) / 2, cqy = (outer.offsetHeight || 0) / 2;
  const csx = (node.offsetParent === outer ? node.offsetLeft : 0) + (node.offsetWidth || 0) / 2;
  const csy = (node.offsetParent === outer ? node.offsetTop : 0) + (node.offsetHeight || 0) / 2;
  return { ...o,
    x: ((o.x || 0) - q.x + (1 - S) * (csx - cqx)) / S,
    y: ((o.y || 0) - q.y + (1 - S) * (csy - cqy)) / S,
    s: (o.s || 1) / S };
}
/** Repaint every piece standing inside `id` (its outer piece just moved or changed size). */
function repaintInsides(id) {
  const doc = docRef ?? globalThis.document;
  for (const p of HUD_PIECES) {
    if (p.inside !== id) continue;
    for (const n of doc?.querySelectorAll?.(p.sel) ?? []) paint(n, layoutOf(p.id));
  }
}

/** Write a piece's layout onto its node (or clear it). */
function paint(node, o) {
  const set = (k, v) => node.style.setProperty(k, v);
  const del = (k) => node.style.removeProperty(k);
  const p = pieceOf(node.dataset?.hm);
  const t = p?.inside ? insideTransform(node, p, o) : o;   // a piece inside another: the outer one's move undone
  if (t && (t.x || t.y)) { set('--hmx', `${t.x}px`); set('--hmy', `${t.y}px`); } else { del('--hmx'); del('--hmy'); }
  // MOVED-NOTICE: the player took it from its sheet's place - a stack that slides in from an edge fades where it stands
  if (o && (o.x || o.y)) { if (!node.hasAttribute('data-hm-moved')) node.setAttribute('data-hm-moved', ''); }
  else if (node.hasAttribute?.('data-hm-moved')) node.removeAttribute('data-hm-moved');
  if (t && t.s && t.s !== 1) set('--hms', String(t.s)); else del('--hms');
  if (o?.off) { if (!node.hasAttribute('data-hm-off')) node.setAttribute('data-hm-off', ''); }
  else if (node.hasAttribute?.('data-hm-off')) node.removeAttribute('data-hm-off');
  if (p?.turn && o?.t) { if (!node.hasAttribute('data-hm-turn')) node.setAttribute('data-hm-turn', ''); }   // TURN1
  else if (node.hasAttribute?.('data-hm-turn')) node.removeAttribute('data-hm-turn');
  if (p?.len) {
    const v = lenVarOf(p);
    if (o && o.l && o.l !== 1) { set(v, String(o.l)); if (!node.hasAttribute('data-hm-len')) node.setAttribute('data-hm-len', ''); }
    else { del(v); if (node.hasAttribute('data-hm-len')) node.removeAttribute('data-hm-len'); }
  }
}

let started = false;
let docRef = null;
let timer = null;
let lastSweep = -Infinity;
let drag = null;   // { node, id, sx, sy, ox, oy, k }
let freeKey = 'Y';

// HUD-PREVIEW: THE GHOSTS - a piece whose host builds it only when first needed (no notice yet, no quest, no party, no
// boss) has nothing on the page to move. While unlocked a stand-in with the host's own classes stands in its place
// (the sheet puts it where the real one will stand), takes the drags under the same id, and is gone at the lock.
// the boss bar's and the party's sheets come with their hosts, loaded only when a preview first needs them (no new
// static edge from the HUD into the gate or the party code)
let ghostDeps = null, ghostDepsLoading = false;
function ensureGhostDeps() {
  if (ghostDeps || ghostDepsLoading) return;
  ghostDepsLoading = true;
  Promise.all([import('../gate/gateBossBar.js'), import('../partyPanel.js'), import('../revenant/revenantCard.js'), import('../lootBanner.js'), import('../enhanced/enhancedSaddle.js'), import('../enhanced/enhancedHelm.js')])
    .then(([boss, party, revenant, loot, saddle, helm]) => { ghostDeps = { BOSS_BAR_CSS: boss.BOSS_BAR_CSS, BOSS_BAR_STYLE_ID: boss.BOSS_BAR_STYLE_ID, injectPartyStyle: party.injectPartyStyle, buildRevenantPreview: revenant.buildRevenantPreview, buildLootBannerPreview: loot.buildLootBannerPreview, buildSaddlePreview: saddle.buildSaddlePreview, buildHelmPreview: helm.buildHelmPreview }; })
    .catch(() => { ghostDeps = {}; });
}
/** HUD-SADDLE: the stand-in a node belongs to - the node itself, or the layer it stands in (the saddle panel's bar and
 *  the helm panel's are their pieces, their whole-screen layers the stand-ins); null for a host's real node. */
const ghostOf = (n) => (n?.hasAttribute?.('data-hm-ghost') ? n : n?.closest?.('[data-hm-ghost]') ?? null);
function buildGhost(doc, kind) {
  if ((kind === 'party' || kind === 'boss' || kind === 'revenant' || kind === 'loot' || kind === 'saddle' || kind === 'helm') && !ghostDeps) { ensureGhostDeps(); return null; }   // next sweep
  const div = (cls, text) => { const n = doc.createElement('div'); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  let g = null;
  if (kind === 'notices') {
    g = div('notice-stack');
    const a = div('notice notice-in', 'Notification (preview)');
    const b = div('notice notice-in', 'Quest updated (preview)');
    g.append(a, b);
  } else if (kind === 'midtext') {
    g = div('hudmid', 'Screen message (preview)');
  } else if (kind === 'netstatus') {
    g = div('hudstatus', 'Online status (preview)');
  } else if (kind === 'tracker') {
    g = div('qtrack');
    const head = div('qtrack-head'); head.append(div('qtrack-title', 'Quest tracker (preview)'));
    g.append(head, div('qtrack-line', 'Find the lost amulet'), div('qtrack-where', 'Daggerfall'));
  } else if (kind === 'party') {
    try { ghostDeps.injectPartyStyle?.(doc); } catch { /* its sheet or none */ }
    g = div('dfparty');
    g.append(div('dfparty-title', 'Party (preview)'), div('', 'Companion'), div('', 'Companion'));
  } else if (kind === 'boss') {
    if (ghostDeps.BOSS_BAR_CSS && doc.getElementById && !doc.getElementById(ghostDeps.BOSS_BAR_STYLE_ID)) {
      const st = doc.createElement('style'); st.id = ghostDeps.BOSS_BAR_STYLE_ID; st.textContent = ghostDeps.BOSS_BAR_CSS; (doc.head ?? doc.body)?.append(st);
    }
    g = div('wb-boss-bar');
    const track = div('wb-boss-track'); const fill = div('wb-boss-fill'); fill.style.width = '70%'; track.append(fill);
    g.append(div('wb-boss-name', 'Boss (preview)'), track);
  } else if (kind === 'revenant') {
    try { g = ghostDeps.buildRevenantPreview?.(doc) ?? null; } catch { g = null; }   // REVENANT-CARD: a card as one will stand
  } else if (kind === 'loot') {
    try { g = ghostDeps.buildLootBannerPreview?.(doc) ?? null; } catch { g = null; }   // LOOT-BANNER: a banner as one will stand
  } else if (kind === 'saddle') {
    try { g = ghostDeps.buildSaddlePreview?.(doc) ?? null; } catch { g = null; }   // HUD-SADDLE: the panel as it stands astride
  } else if (kind === 'helm') {
    try { g = ghostDeps.buildHelmPreview?.(doc) ?? null; } catch { g = null; }   // HUD-HELM: the panel as it stands at a helm
  }
  if (g) { g.setAttribute('data-hm-ghost', kind); doc.body.append(g); }
  return g;
}
function syncGhosts(doc, edit) {
  if (!doc.querySelectorAll || !doc.body?.append) return;
  for (const p of HUD_PIECES) {
    if (!p.ghost) continue;
    let all = [];
    try { all = [...doc.querySelectorAll(p.sel)]; } catch { continue; }
    const ghosts = all.map(ghostOf).filter(Boolean);
    const real = all.length - ghosts.length;
    if (!edit || real > 0) { for (const g of ghosts) g.remove(); continue; }   // locked, or the real one is here now
    if (!ghosts.length) buildGhost(doc, p.ghost);
  }
}

/** Another UI is in force: every mark, offset, preview, stand-in, handle and the banner off the page. */
function stripAll(doc) {
  if (drag) endDrag();
  syncGhosts(doc, false);
  for (const n of doc.querySelectorAll?.('[data-hm]') ?? []) {
    paint(n, null);
    for (const a of ['data-hm-edit', 'data-hm-drag', 'data-hm-dummy', 'data-hm-len', 'data-hm-name', 'data-hm-moved']) if (n.hasAttribute?.(a)) n.removeAttribute(a);
    n.removeAttribute?.('data-hm');
  }
  syncBanner(doc, false);
  syncHandles(doc, false);
}

/** Find every piece on the page, mark it, and give it its offset and the edit state. */
export function sweepHudLayout(doc = docRef) {
  if (!doc?.querySelectorAll) return;
  if (!customisable()) { stripAll(doc); return; }
  const layout = readLayout();
  const edit = !locked();
  syncGhosts(doc, edit);
  for (const p of HUD_PIECES) {
    let nodes;
    try { nodes = doc.querySelectorAll(p.sel); } catch { continue; }
    for (const n of nodes) {
      if (n.dataset.hm !== p.id) n.dataset.hm = p.id;
      if (!drag || drag.node !== n) paint(n, layout[p.id] || p.inside ? layoutOf(p.id) : null);
      if (p.dummy && !ghostOf(n)) { if (edit) { if (!n.hasAttribute('data-hm-dummy')) n.setAttribute('data-hm-dummy', ''); } else if (n.hasAttribute('data-hm-dummy')) n.removeAttribute('data-hm-dummy'); }
      if (edit && editable(p)) { if (!n.hasAttribute('data-hm-edit')) { n.setAttribute('data-hm-edit', ''); n.setAttribute('data-hm-name', p.name); } }
      else if (n.hasAttribute('data-hm-edit')) { n.removeAttribute('data-hm-edit'); n.removeAttribute('data-hm-drag'); }
    }
  }
  // a piece that left its place (the hotbar under a window) keeps no edit outline
  for (const n of doc.querySelectorAll('[data-hm-edit]')) {
    const p = HUD_PIECES.find((q) => q.id === n.dataset.hm);
    if (!p || !n.matches(p.sel) || !editable(p)) { n.removeAttribute('data-hm-edit'); n.removeAttribute('data-hm-drag'); }
  }
  syncBanner(doc, edit);
  syncHandles(doc, edit);
}

seatHudPlacer(sweepHudLayout);   // MOVED-NOTICE: the notice stack's builder sweeps through ui/hud/hudPlacer.js

// THE HANDLES' LAYER: one corner square per outlined piece (scale) and, where the piece has a length, a bar on its
// right edge. They live in their own fixed layer over the HUD - nothing is added inside a piece, whose own layout
// (a flex row, a centred column) must not change - and follow their pieces every frame while unlocked.
let handleRaf = 0;
const handleMap = new Map();   // node -> { sq, ln }
function syncHandles(doc, edit) {
  let layer = doc.getElementById(HANDLES_ID);
  if (!edit) {
    layer?.remove(); handleMap.clear();
    if (handleRaf) { (doc.defaultView ?? globalThis).cancelAnimationFrame?.(handleRaf); handleRaf = 0; }
    return;
  }
  if (!layer?.append) {
    if (!doc.createElement || !doc.body?.append) return;
    layer = doc.createElement('div'); layer.id = HANDLES_ID; doc.body.append(layer);
  }
  const live = new Set(doc.querySelectorAll('[data-hm-edit]'));
  for (const [n, h] of handleMap) if (!live.has(n)) { h.sq.remove(); h.ln?.remove(); h.tag?.remove(); h.x?.remove(); h.turn?.remove(); handleMap.delete(n); }
  for (const n of live) {
    if (handleMap.has(n)) continue;
    const p = pieceOf(n.dataset.hm);
    const sq = doc.createElement('i'); sq.setAttribute('data-hm-handle', 'scale'); sq.title = `Scale: ${p?.name ?? ''}`;
    const tag = doc.createElement('b'); tag.textContent = p?.name ?? n.dataset.hm;   // the piece's name, over its corner
    let ln = null;
    if (p?.len) { ln = doc.createElement('i'); ln.setAttribute('data-hm-handle', 'len'); ln.title = `Length: ${p.name}`; }
    const x = doc.createElement('i'); x.setAttribute('data-hm-handle', 'off'); x._hmNode = n;   // the X: off and on again
    sq._hmNode = n; if (ln) ln._hmNode = n;
    let turn = null;   // TURN1: the turn-over press, beside the X
    if (p?.turn) { turn = doc.createElement('i'); turn.setAttribute('data-hm-handle', 'turn'); turn.textContent = '\u21bb'; turn.title = `Turn over: ${p.name}`; turn._hmNode = n; }
    layer.append(tag, sq, x); if (ln) layer.append(ln); if (turn) layer.append(turn);
    handleMap.set(n, { sq, ln, tag, x, turn });
  }
  const win = doc.defaultView ?? globalThis;
  if (!handleRaf && win.requestAnimationFrame) {
    const step = () => {
      handleRaf = 0;
      if (locked()) return;
      for (const [n, h] of handleMap) {
        const r = n.getBoundingClientRect?.();
        const show = r && r.width > 2 && r.height > 2;
        h.sq.style.display = show ? '' : 'none'; if (h.ln) h.ln.style.display = show ? '' : 'none'; h.tag.style.display = show ? '' : 'none';
        h.x.style.display = show ? '' : 'none'; if (h.turn) h.turn.style.display = show ? '' : 'none';
        if (!show) continue;
        const off = n.hasAttribute('data-hm-off');
        if (h.x.dataset.on !== (off ? '0' : '1')) { h.x.dataset.on = off ? '0' : '1'; h.x.textContent = off ? '+' : '✕'; h.x.title = off ? 'Turn this back on' : 'Turn this off (hidden in play)'; }
        h.x.style.left = `${r.right - 14}px`; h.x.style.top = `${Math.max(2, r.top - 18)}px`;
        if (h.turn) { h.turn.style.left = `${r.right - 34}px`; h.turn.style.top = `${Math.max(2, r.top - 18)}px`; }
        h.tag.style.left = `${Math.max(2, r.left)}px`; h.tag.style.top = `${Math.max(2, r.top - 19)}px`;
        h.sq.style.left = `${r.right - 2}px`; h.sq.style.top = `${r.bottom - 2}px`;
        if (h.ln) {
          // HUD-LEN: a piece whose length runs up (a dress's upright vials say so: --hm-len-axis) takes it on its top edge
          const ax = lenAxisOf(n);
          if (h.ln.dataset.axis !== ax) h.ln.dataset.axis = ax;
          if (ax === 'y') { h.ln.style.left = `${r.left + r.width / 2 - 10}px`; h.ln.style.top = `${Math.max(2, r.top - 8)}px`; }
          else { h.ln.style.left = `${r.right + 2}px`; h.ln.style.top = `${r.top + r.height / 2 - 10}px`; }
        }
      }
      handleRaf = win.requestAnimationFrame(step);
    };
    handleRaf = win.requestAnimationFrame(step);
  }
}

function syncBanner(doc, edit) {
  let b = doc.getElementById(BANNER_ID);
  if (!edit) { b?.remove(); return; }
  if (b) { const sb = b.querySelector('[data-hm-bars]'); if (sb) sb.textContent = barsLabel(); const sn = b.querySelector('[data-hm-snap]'); if (sn) sn.textContent = snapLabel(); return; }
  b = doc.createElement('div');
  b.id = BANNER_ID;
  const text = doc.createElement('span');
  text.textContent = `HUD unlocked. Free the mouse (${freeKey}) and drag any outlined piece. Drag this text to move this box. Corner square: size. Edge bar: length. ✕: hide or show. Double-click: reset. Alt+U: lock.`;
  const reset = doc.createElement('button');
  reset.type = 'button'; reset.className = 'ghost'; reset.textContent = 'Reset';
  reset.addEventListener('click', (e) => { e.stopPropagation(); resetHudLayout(); });
  // the bars: together or apart (the same switch as the Interface settings row)
  const bars = doc.createElement('button');
  bars.type = 'button'; bars.className = 'ghost'; bars.setAttribute('data-hm-bars', ''); bars.textContent = barsLabel();
  bars.addEventListener('click', (e) => { e.stopPropagation(); setHudBarsSplit(!hudBarsSplit()); bars.textContent = barsLabel(); });
  // snapping on or off
  const snap = doc.createElement('button');
  snap.type = 'button'; snap.className = 'ghost'; snap.setAttribute('data-hm-snap', ''); snap.textContent = snapLabel();
  snap.addEventListener('click', (e) => { e.stopPropagation(); setPref(HUD_SNAP_PREF, !hudSnap()); snap.textContent = snapLabel(); });
  const lock = doc.createElement('button');
  lock.type = 'button'; lock.textContent = 'Lock';
  lock.addEventListener('click', (e) => { e.stopPropagation(); setHudLocked(true); });
  for (const t of ['mousedown', 'pointerdown', 'mouseup']) b.addEventListener(t, (e) => e.stopPropagation());
  // the banner moves too: grab its words and drag (for this session - it is the editor's, not the HUD's)
  text.addEventListener('pointerdown', (e) => {
    if (e.button != null && e.button !== 0) return;
    const r = b.getBoundingClientRect();
    const ox = e.clientX - r.left, oy = e.clientY - r.top;
    const move = (m) => { b.style.left = `${m.clientX - ox}px`; b.style.top = `${m.clientY - oy}px`; b.style.transform = 'none'; bannerAt = { left: b.style.left, top: b.style.top }; };
    const up = () => { removeEventListener('pointermove', move, true); removeEventListener('pointerup', up, true); };
    addEventListener('pointermove', move, true); addEventListener('pointerup', up, true);
  });
  if (bannerAt) { b.style.left = bannerAt.left; b.style.top = bannerAt.top; b.style.transform = 'none'; }
  b.append(text, bars, snap, reset, lock);
  doc.body.append(b);
}

/** The lock, from the settings row or the banner. */
export function setHudLocked(on) {
  setPref(HUD_LOCK_PREF, !!on);
  if (on && drag) endDrag();
  sweepHudLayout();
}

const barsLabel = () => (hudBarsSplit() ? 'Bars: separate' : 'Bars: together');
const snapLabel = () => (hudSnap() ? 'Snap: on' : 'Snap: off');
let bannerAt = null;
/** The three bars: one piece (false) or three (true). */
export function setHudBarsSplit(on) {
  setPref(HUD_BARS_SPLIT_PREF, !!on);
  if (drag) endDrag();
  sweepHudLayout();
}

/** Every piece back where the sheet stands it. */
export function resetHudLayout() {
  setPref(HUD_LAYOUT_PREF, null);
  const doc = docRef ?? globalThis.document;
  for (const n of doc?.querySelectorAll?.('[data-hm]') ?? []) paint(n, null);
  sweepHudLayout(doc);
}

function saveLayout(id, o) {
  const next = { ...readLayout() };
  const v = {};
  if (o?.x) v.x = Math.round(o.x);
  if (o?.y) v.y = Math.round(o.y);
  if (o?.s && Math.abs(o.s - 1) > 0.005) v.s = Math.round(o.s * 100) / 100;
  if (o?.l && Math.abs(o.l - 1) > 0.005) v.l = Math.round(o.l * 100) / 100;
  if (o?.off) v.off = true;
  if (o?.t) v.t = true;   // TURN1: turned over
  if (Object.keys(v).length) next[id] = v; else delete next[id];
  setPref(HUD_LAYOUT_PREF, Object.keys(next).length ? next : null);
}

/** HUD-LEN: which way a piece's length runs - across ('x', the sheets' bars) or up ('y': a dress that stands its bars
 *  on end says so with --hm-len-axis). */
function lenAxisOf(node) {
  try { return String((node.ownerDocument?.defaultView ?? globalThis).getComputedStyle?.(node)?.getPropertyValue('--hm-len-axis') ?? '').trim() === 'y' ? 'y' : 'x'; } catch { return 'x'; }
}
/** HUD-LEN: a size or a length taken from a piece that stood wholly on the screen keeps it there - the piece is moved
 *  back in by what it outgrew past an edge (a corner's vitals grown about their middle went off the screen's edge). */
function keepOnScreen(want) {
  const r = drag.node.getBoundingClientRect();
  const vw = globalThis.innerWidth || 0, vh = globalThis.innerHeight || 0;
  if (!vw || !vh || !drag.inView) return want;
  let dx = 0, dy = 0;
  if (r.width <= vw) { if (r.left < 0) dx = -r.left; else if (r.right > vw) dx = vw - r.right; }
  if (r.height <= vh) { if (r.top < 0) dy = -r.top; else if (r.bottom > vh) dy = vh - r.bottom; }
  if (!dx && !dy) return want;
  const out = { ...want, x: want.x + dx / drag.k, y: want.y + dy / drag.k };
  paint(drag.node, out);
  return out;
}

const handleAt = (target) => target?.closest?.('[data-hm-handle]') ?? null;
const pieceAt = (target) => (handleAt(target)?._hmNode) ?? target?.closest?.('[data-hm-edit]') ?? null;
const swallow = (e) => { e.preventDefault?.(); e.stopPropagation?.(); e.stopImmediatePropagation?.(); };

function onDown(e) {
  if (locked()) return;
  const node = pieceAt(e.target);
  if (!node) return;
  swallow(e);
  if (e.type !== 'pointerdown' || (e.button != null && e.button !== 0)) return;
  const id = node.dataset.hm;
  const o = layoutOf(id);
  const mode = handleAt(e.target)?.getAttribute('data-hm-handle') ?? 'move';   // move | scale | len | off | turn
  if (mode === 'off') { const nx = { ...o, off: !o.off }; paint(node, nx); saveLayout(id, nx); return; }   // the X: a click, no drag
  if (mode === 'turn') { const nx = { ...o, t: !o.t }; paint(node, nx); saveLayout(id, nx); return; }   // TURN1: turned over, and back
  const r0 = node.getBoundingClientRect();
  // how far one local pixel of translate moves the piece on screen (the HUD scale rides its ancestors)
  let k = 1;
  try {
    paint(node, o);   // measure from the saved layout itself, whatever was last painted
    const a = node.getBoundingClientRect().left;
    paint(node, { ...o, x: o.x + 100 });
    const b = node.getBoundingClientRect().left;
    paint(node, o);
    if (Math.abs(b - a) > 1) k = (b - a) / 100;
  } catch { /* keep 1 */ }
  const cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
  // HUD-LEN: THE HANDLE FOLLOWS THE POINTER. How far the handle's edge moves for a step of length is MEASURED, never
  // assumed: a centred piece grows both ways, a corner's grows one way, and a dress's upright vials grow up, not across
  // (the old "twice the pull across" sent a corner's handle running from the pointer, and did nothing to a stood bar)
  let axis = 'x', per = 0;
  if (mode === 'len') {
    axis = lenAxisOf(node);
    try {
      paint(node, o);
      const a = node.getBoundingClientRect();
      paint(node, { ...o, l: (o.l || 1) * 1.25 });
      const b = node.getBoundingClientRect();
      paint(node, o);
      per = (axis === 'y' ? a.top - b.top : b.right - a.right) / ((o.l || 1) * 0.25);   // px of the handle's edge per unit of length
    } catch { per = 0; }
    if (!(Math.abs(per) > 0.5)) per = axis === 'y' ? Math.max(8, r0.height) : Math.max(8, r0.width) / 2;
  }
  const vw = globalThis.innerWidth || 0, vh = globalThis.innerHeight || 0;
  const inView = r0.left >= -1 && r0.top >= -1 && r0.right <= vw + 1 && r0.bottom <= vh + 1;
  drag = { node, id, mode, free: !!e.altKey, sx: e.clientX, sy: e.clientY, ox: o.x, oy: o.y, o0: { ...o }, k, cur: { ...o }, pid: e.pointerId,
    cx, cy, d0: Math.max(8, Math.hypot(e.clientX - cx, e.clientY - cy)), w0: Math.max(8, r0.width), cap: e.target, axis, per, inView };
  node.setAttribute('data-hm-drag', '');
  try { (drag.cap ?? node).setPointerCapture?.(e.pointerId); } catch { /* ok */ }
}

function onMove(e) {
  if (!drag) return;
  swallow(e);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  let want;
  if (drag.mode === 'scale') {
    // the corner's distance from the piece's centre, against where it started: out grows, in shrinks
    const d = Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy);
    want = { ...drag.o0, s: clamp(drag.o0.s * d / drag.d0, SCALE_MIN, SCALE_MAX) };
  } else if (drag.mode === 'len') {
    // HUD-LEN: the handle's edge goes where the pointer goes - right (or up, for a stood bar) is longer
    const pull = drag.axis === 'y' ? drag.sy - e.clientY : e.clientX - drag.sx;
    want = { ...drag.o0, l: clamp((drag.o0.l || 1) + pull / drag.per, LEN_MIN, LEN_MAX) };
  } else {
    want = { ...drag.o0, x: drag.ox + (e.clientX - drag.sx) / drag.k, y: drag.oy + (e.clientY - drag.sy) / drag.k };
  }
  paint(drag.node, want);
  if (drag.mode === 'move') want = snapMove(want);
  else want = keepOnScreen(want);   // HUD-LEN: a size or a length never carries a piece off the screen
  liveOuter = { id: drag.id, o: want }; repaintInsides(drag.id); liveOuter = null;
  const r = drag.node.getBoundingClientRect();
  const vw = globalThis.innerWidth || 0, vh = globalThis.innerHeight || 0;
  const onScreen = r.right > KEEP_PX && r.left < vw - KEEP_PX && r.bottom > KEEP_PX && r.top < vh - KEEP_PX;
  if (onScreen) drag.cur = want; else paint(drag.node, drag.cur);
}

// HUD-SNAP (Mac: "add a snap option in the mode so parts can snap to each other"): while a piece is moved, its left
// edge, centre and right edge catch on any other piece's left edge, centre or right edge (and the screen's edges and
// middle) within SNAP_PX - likewise top, middle and bottom - and a blue guide shows the line it caught on. Hold Alt
// while dragging to move freely for that drag.
function snapMove(want) {
  const guides = guideEls();
  const hide = () => { for (const g of guides) if (g) g.style.display = 'none'; };
  if (!hudSnap() || drag.free) { hide(); return want; }
  const doc = docRef ?? globalThis.document;
  const me = drag.node;
  const r = me.getBoundingClientRect();
  const vw = globalThis.innerWidth || 0, vh = globalThis.innerHeight || 0;
  const xs = [0, vw / 2, vw], ys = [0, vh / 2, vh];
  for (const n of doc?.querySelectorAll?.('[data-hm]') ?? []) {
    if (n === me || me.contains?.(n) || n.contains?.(me)) continue;
    const o = n.getBoundingClientRect?.();
    if (!o || o.width < 2 || o.height < 2) continue;
    xs.push(o.left, o.left + o.width / 2, o.right);
    ys.push(o.top, o.top + o.height / 2, o.bottom);
  }
  const best = (mine, targets) => {
    let d = null, at = null;
    for (const m of mine) for (const t of targets) { const v = t - m; if (Math.abs(v) <= SNAP_PX && (d === null || Math.abs(v) < Math.abs(d))) { d = v; at = t; } }
    return { d, at };
  };
  const bx = best([r.left, r.left + r.width / 2, r.right], xs);
  const by = best([r.top, r.top + r.height / 2, r.bottom], ys);
  if (bx.d === null && by.d === null) { hide(); return want; }
  const out = { ...want, x: want.x + (bx.d ?? 0) / drag.k, y: want.y + (by.d ?? 0) / drag.k };
  paint(me, out);
  if (guides[0]) { guides[0].style.display = bx.d === null ? 'none' : ''; guides[0].style.left = `${bx.at}px`; }
  if (guides[1]) { guides[1].style.display = by.d === null ? 'none' : ''; guides[1].style.top = `${by.at}px`; }
  return out;
}
let guideX = null, guideY = null;
function guideEls() {
  const doc = docRef ?? globalThis.document;
  const layer = doc?.getElementById?.(HANDLES_ID);
  if (!layer?.append) return [null, null];
  if (!guideX || !layer.contains?.(guideX)) {
    guideX = doc.createElement('u'); guideX.setAttribute('data-hm-guide', 'x'); guideX.style.display = 'none';
    guideY = doc.createElement('u'); guideY.setAttribute('data-hm-guide', 'y'); guideY.style.display = 'none';
    layer.append(guideX, guideY);
  }
  return [guideX, guideY];
}

function endDrag() {
  if (!drag) return;
  if (guideX) guideX.style.display = 'none';
  if (guideY) guideY.style.display = 'none';
  const { node, id, cur, pid, cap } = drag;
  drag = null;
  node.removeAttribute('data-hm-drag');
  try { (cap ?? node).releasePointerCapture?.(pid); } catch { /* ok */ }
  saveLayout(id, cur);
  repaintInsides(id);
}

function onUp(e) {
  if (!drag) { if (!locked() && pieceAt(e.target)) swallow(e); return; }
  swallow(e);
  endDrag();
}

function onDouble(e) {
  if (locked()) return;
  const node = pieceAt(e.target);
  if (!node) return;
  swallow(e);
  paint(node, null);
  saveLayout(node.dataset.hm, null);   // place, scale and length back
}

/** ALT+U (Mac: "alt + U should also open the UI unlocked editor"): unlock the HUD, or lock it again. Taken in the
 *  capture phase and swallowed, so the plain U beneath it (Use Magic Item) never fires with it; never while a text box
 *  has the keys (the chat - and Option+U is the umlaut's dead key on a Mac keyboard). */
export const HUD_EDITOR_KEY = Object.freeze({ code: 'KeyU', alt: true, label: 'Alt+U' });
function typingIn(t) {
  const tag = t?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!t?.isContentEditable;
}
function onKey(e) {
  if (e.code !== HUD_EDITOR_KEY.code || !e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  if (!customisable()) return;   // another UI: the key is not ours
  if (typingIn(e.target)) return;
  swallow(e);
  if (e.repeat) return;
  setHudLocked(!hudLocked());
}

/** Start once (the enhanced HUD's first frame, the Overworld's first open): the first sweep at once, every one after it
 *  the interval's (SWEEP_MS). The tick sweeps on its own clock only on a page the start set no interval for (PERF-HUD1). */
export function tickHudLayout(doc = globalThis.document, now = (globalThis.performance?.now?.() ?? Date.now())) {
  if (!doc?.body) return;
  if (!started) {
    started = true;
    docRef = doc;
    injectStyle(doc);
    const win = doc.defaultView ?? globalThis;
    try {
      // the FreeMouse key's name, for the banner (the default is Y)
      import('../quickslotTags.js').then((m) => import('../input.js').then((inp) => {
        const t = m.quickslotTag?.('FreeMouse', { bindings: inp.bindings() });
        if (t?.text) freeKey = t.text;
      })).catch(() => {});
    } catch { /* keep Y */ }
    if (typeof win?.addEventListener !== 'function') return;   // a page without events (a test's stub document): nothing to move
    win.addEventListener('keydown', onKey, true);   // ALT+U: the editor, open and shut
    win.addEventListener('pointerdown', onDown, true);
    win.addEventListener('mousedown', (e) => { if (!locked() && pieceAt(e.target)) swallow(e); }, true);
    win.addEventListener('click', (e) => { if (!locked() && pieceAt(e.target)) swallow(e); }, true);
    win.addEventListener('pointermove', onMove, true);
    win.addEventListener('pointerup', onUp, true);
    win.addEventListener('pointercancel', onUp, true);
    win.addEventListener('mouseup', (e) => { if (!locked() && pieceAt(e.target)) swallow(e); }, true);
    win.addEventListener('dblclick', onDouble, true);
    win.addEventListener('contextmenu', (e) => { if (!locked() && pieceAt(e.target)) swallow(e); }, true);
    // an interval, not the HUD's frame: the chat, the Overworld block and the rest are built by their own hosts and
    // stand while the HUD itself is hidden
    timer = setInterval(() => sweepHudLayout(doc), SWEEP_MS);
    timer?.unref?.();   // never what keeps a process alive (Node's timers; a browser's is a number)
    lastSweep = now; sweepHudLayout(doc);   // PERF-HUD1: the first sweep at once; the interval takes every one after it
    return;
  }
  // PERF-HUD1 (PERF-NEXT item 5): ONE CLOCK. This tick swept on its own clock beside the interval's - about eight sweeps
  // of 34 querySelectorAll a second where four were meant (the real game's profile: the HUD's sweeps 1.4 ms a second of
  // this container's CPU). The interval is the clock where it runs; the tick sweeps only where none does (a page
  // without events - a test's stub document - whose start returned above before an interval was set).
  if (!timer && now - lastSweep >= SWEEP_MS) { lastSweep = now; sweepHudLayout(doc); }
}

/** Tests: forget the started state. */
export function _resetHudLayoutForTests() { if (timer) clearInterval(timer); timer = null; started = false; docRef = null; drag = null; lastSweep = -Infinity; }   // PERF-HUD1: the clock too
