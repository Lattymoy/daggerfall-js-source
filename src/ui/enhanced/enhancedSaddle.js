// @ts-check
// STEED-UI - THE SADDLE PANEL (2026-10-11, the owner: "Proper UI elements for the horse + wagon/cart (Enhanced plus)").
// Horse care (STEED1) gave the horse a breath, a hunger and a bond; wagon upkeep (WAGONS4) gave the wagon a condition
// that wears to breaking - and the only places to read them were the Stable page, a pause away, and the grip bar's
// one meter. This is the saddle on screen, in Enhanced Plus, the helm panel's kind (ui/enhanced/enhancedHelm.js, CSA-L - the
// player's ask there: "instead of an overuse of keybinds, is there a way we can instead develop enhanced plus UI
// elements?"):
//
// - WHAT IT READS, NEVER WRITES: the horse ridden (or the lead of the team driven) and the wagon, off the upkeep
//   (systems/upkeep/upkeepRuntime.js saddle): its breath while ridden, winded or not; its hunger with the hours its food has
//   left; its bond's word and how far to the next; the wagon's state and share of whole; its load against its limit.
//   The title is the rider's - "Riding <name>" or "Driving the <wagon>" - with the gait and the pace beside it.
// - EVERY BUTTON IS A DOOR THAT ALREADY EXISTS: Feed oats and the apple are the Stable page's (upkeep.act), the kit is
//   the kit's Use, Cargo is a press on the wagon (horseCart.js openWagonCargo), Stable opens the Holdings page, View is
//   the view key's toggle (mwView.js), Dismount is Horse Cart and Cargo's mount key (handleQuickMountOrDismount) or the
//   classic transport's foot. The host answers each (`hooks`), so the panel is never a second law. The keys still work,
//   and a button whose door has a key bound shows it.
// - THE HUD'S KIND OF THING, NOT A WINDOW (the helm's law): it pauses nothing - the horse runs on under it - and
//   registers with no overlay stack; only its buttons take the pointer. A window over the HUD hides it. It stands under
//   the compass, where the helm stands - a boat's helm and a saddle are never up together.
// - THE MOUSE: its buttons take a click whenever the pointer is free (the free-mouse key, a surface, a finger); while
//   the look holds the pointer, the line under the title says how to free it.
// - A FINGER: every button a finger's size (44 px), the bar clear of the stick and the corner (the helm's own place).
// - A PAD: the d-pad stays the quick slots' (a rider's potions are on it); the pad's cursor presses the buttons as the
//   mouse does (ui/gamepadInput.js PADPLUS1).
//
// Enhanced Plus only: the classic skin keeps the grip bar's meter (ui/hud/hud.js drawGripBar) and the keys.
// UPDATED, NOT REBUILT (the HUD's third law): the buttons and the meters are made again only when their set changes.
// MOVABLE (HUD-SADDLE, FIELD BUGS 2026-10-14, Discord: "Riding Window is not able to be edited in the HUD Editor
// (Alt+U)"): the bar is a HUD-MOVE piece (ui/hud/hudLayout.js HUD_PIECES 'saddle') - moved, sized and turned off as every
// other piece is, placed where the player put it the moment it is built (the leaf, ui/hud/hudPlacer.js), and stood as a
// preview while the HUD is unlocked and nobody rides (buildSaddlePreview).
//
// UI-CALM (2026-10-14, a player: "Why is there a huge, unmovable panel showing horse/cart info at the top of my screen?
// It's intrusive and ruins immersion. Put that info in a separate menu ... Show information when it's relevant."):
// THE PANEL STANDS WHEN IT IS WANTED, AND LOW (saddleShown). The whole panel - the meters, the presses - stands when its
// key puts it up (F2, SADDLE_PANEL_ACTION) or the choice is Always; its presses take a click only with the mouse free
// (the hint says how). Away, only what needs the rider stands, as ONE LINE (`note`: winded, short of breath, hungry,
// a wagon rickety or failing, a load past its limit - and its own meter beside it), and for a few seconds after mounting
// a line that says the horse's name and how to call the panel (`hello`). A finger has no free mouse: it reads a small
// plate with the name, and a tap on it opens the panel and closes it again. The Stable page (Holdings) is the separate
// menu it always was - every word of this panel is there too. The player's choice ('saddlePanel', the Horse care row's
// part): When needed (this), Always (the panel as STEED-UI stood it), Off. And it stands at the BOTTOM, over the vitals
// and the hotbar, where a rider's eye already goes - the compass and the sky above it are the world's.
import { PIXEL_STACK } from '../pixelifyFive.js';
import { injectEnhancedStyle } from './enhancedStyle.js';
import { placeHudPieces } from '../hud/hudPlacer.js';   // HUD-SADDLE: a new panel stands where HUD-MOVE put it from its first frame
import { isTouchDevice } from '../touch/touchDevice.js';   // HUD-SADDLE: the preview stands at a finger's place where the hosts' touch layer does (ui/touch/touch.js attachTouch)
import { t } from '../../systems/textManager.js';   // L10N4: the preview's name in the player's language; UI-CALM: the hello's line
import { getPref, setPref } from '../../systems/uiPrefs.js';   // UI-CALM: the player's choice of when the panel stands

export const ENHANCED_SADDLE_ID = 'enhanced-saddle';
const SADDLE_STYLE_ID = 'enhanced-saddle-style';

/** The registry actions whose keys the buttons name (KB1): Horse Cart and Cargo's mount (horseCart.js
 *  HCC_MOUNT_ACTION), the view's toggle, and the run - the gallop on a horse. */
export const SADDLE_ACTIONS = Object.freeze({ mount: 'HorseMount', view: 'TogglePerspective', run: 'Run' });

/** Below this pace (m/s) a horse or a wagon stands. */
export const STANDING_MPS = 0.3;
/** A breath under this share reads short (upkeepRuntime.js BREATH_LOW's twin, kept here so the panel imports no law). */
export const SADDLE_BREATH_LOW = 0.25;
/** The wagon's states' tones (wagonUpkeep.js WAGON_STATES): sound and worn read well, rickety warns, failing reads
 *  short. */
const WAGON_TONE = Object.freeze({ sound: 'ok', worn: 'ok', rickety: 'warn', failing: 'low' });
const HUNGER_TONE = Object.freeze({ fed: 'ok', hungry: 'warn', starving: 'low' });
/** HORSE-TIERS: NO RED where hunger costs nothing (Boons - Climates & Calories' RED MEANS IT COSTS): its chip stops at
 *  amber. A read that does not say (`hungerCosts` absent) is the system as it stood, which costs. */
const hungerTone = (h) => { const tone = HUNGER_TONE[h.hungerKey] ?? 'ok'; return h.hungerCosts === false && tone === 'low' ? 'warn' : tone; };
/** WAGON-TIERS: the same for the wagon - where its wear slows nothing (Boons) a failing wagon's chip stops at amber. */
const wagonTone = (w) => { const tone = WAGON_TONE[w.stateKey] ?? 'ok'; return w.wearSlows === false && tone === 'low' ? 'warn' : tone; };
/** WAGON-TIERS: a failing wagon slows its team only where its wear slows it (Hard; a read that does not say is Hard). */
const failingSlows = (w) => w?.stateKey === 'failing' && w.wearSlows !== false;

/**
 * The gait's word: standing, galloping, else the ride's own pace - a horse horse care walks walks (HORSE-WALK), DFU's
 * horse trots, a wagon rolls.
 * @param {string} mode - 'Horse' | 'Cart' @param {number|null|undefined} speed - m/s @param {boolean} [galloping]
 * @param {boolean} [walks] - the ride's own pace is a walk (upkeepRuntime.js rideWalks)
 */
export function saddleGait(mode, speed, galloping = false, walks = false) {
  if (!Number.isFinite(speed) || /** @type {number} */ (speed) < STANDING_MPS) return 'Standing';
  if (mode === 'Horse' && galloping) return 'Galloping';
  if (mode === 'Cart') return 'Rolling';
  return walks ? 'Walking' : 'Trotting';
}
/** The pace in kilometres an hour, whole; '' with none known. @param {number|null|undefined} speed - m/s */
export const saddleSpeedText = (speed) => (Number.isFinite(speed) ? `${Math.round(Math.max(0, /** @type {number} */ (speed)) * 3.6)} km/h` : '');

/** The bar's title: whose saddle - a horse's name, else the kind of the wagon driven. @param {any} s */
export function saddleTitle(s) {
  if (s.mode === 'Cart') return `Driving the ${s.wagonName || 'wagon'}`;
  return s.name ? `Riding ${s.name}` : 'Riding';
}

const pct = (share) => `${Math.round(Math.max(0, Math.min(1, share)) * 100)}%`;
/** Hours, as a rider reads them: whole hours past two, else minutes. */
export const fedText = (hours) => (hours >= 2 ? `${Math.floor(hours)}h` : `${Math.max(1, Math.round(hours * 60))}m`);

/**
 * The meters the bar shows, in order: the horse's breath (ridden only), its hunger (a team's, its hungriest horse's -
 * labelled Team), its bond; the wagon's state; its load. Each `{ key, label, text, tone, share? }` - `share` (0..1)
 * draws a bar, without one it is a chip. Pure.
 * @param {any} s
 */
export function saddleMeters(s) {
  if (!s) return [];
  const out = [];
  const h = s.horse;
  if (h) {
    if (h.breath != null) {
      const low = h.winded || h.breath < SADDLE_BREATH_LOW || h.hungerKey === 'starving';
      out.push({ key: 'breath', label: 'Breath', share: h.breath, text: h.winded ? 'Winded' : pct(h.breath), tone: low ? 'low' : 'ok' });
    }
    out.push({ key: 'hunger', label: h.team > 1 ? 'Team' : 'Hunger', text: h.hungerKey === 'fed' && h.fedHours > 0 ? `Fed ${fedText(h.fedHours)}` : h.hunger, tone: hungerTone(h) });
    // the bond: its word, and the way to the next (whole at Kindred)
    const span = h.next ? h.next.at - (h.tierAt ?? 0) : 0;
    const share = h.next ? (span > 0 ? (h.bond - (h.tierAt ?? 0)) / span : 0) : 1;
    out.push({ key: 'bond', label: 'Bond', share: Math.max(0, Math.min(1, share)), text: h.tier, tone: 'bond', title: h.next ? `${Math.floor(h.bond)} of ${h.next.at} to ${h.next.name}` : `${h.tier}: the bond is complete` });
  }
  const w = s.wagon;
  if (w) out.push({ key: 'wagon', label: w.name, share: w.share, text: `${w.state} ${pct(w.share)}`, tone: wagonTone(w) });
  const ld = s.load;
  if (ld && ld.limit > 0) {
    const share = ld.kg / ld.limit;
    out.push({ key: 'load', label: 'Load', share: Math.min(1, share), text: `${Math.round(ld.kg)}/${Math.round(ld.limit)} kg`, tone: share > 1 ? 'low' : share > 0.85 ? 'warn' : 'ok' });
  }
  return out;
}

/**
 * The buttons the bar shows for the saddle's state: each `{ act, label, action?, disabled?, why? }` - `act` the host's
 * hook that answers it, `action` the registry action whose bound key the button names, `why` what a dark one lacks (its
 * tooltip). A button that cannot act now is shown dark where its absence would hide what it needs (the oats, the kit,
 * the wagon's reach); one that can never act is not shown (no apple, a wagon a kit would not mend).
 * Pure: the pins read it.
 * @param {any} s
 */
export function saddleButtons(s) {
  if (!s) return [];
  const out = [];
  const h = s.horse;
  if (h) {
    const why = !s.near ? 'Your horse is not here' : h.full ? 'Full. It will not eat yet' : '';
    out.push({ act: 'feed', label: `Feed oats (${s.oats | 0})`, disabled: !(s.oats > 0) || !!why, why: why || (s.oats > 0 ? '' : 'No oats. Stables sell them') });
    if (s.apples > 0) out.push({ act: 'treat', label: `Apple (${s.apples | 0})`, disabled: !!why, why });
  }
  if (s.wagon && s.wagon.kitWorks) {
    const why = !(s.kits > 0) ? 'No repair kit. Wagon Yards sell them' : !s.wagonNear ? 'The wagon is out of reach' : '';
    out.push({ act: 'kit', label: `Repair kit (${s.kits | 0})`, disabled: !!why, why });
  }
  if (s.cargo != null) out.push({ act: 'cargo', label: 'Cargo', disabled: !s.cargo, why: s.cargo ? '' : 'The wagon is out of reach' });
  out.push({ act: 'stable', label: 'Stable' });
  if (s.view) out.push({ act: 'view', label: 'View', action: SADDLE_ACTIONS.view });
  out.push({ act: 'dismount', label: s.mode === 'Cart' ? 'Climb down' : 'Dismount', action: s.hcc ? SADDLE_ACTIONS.mount : null });
  return out;
}

/**
 * The line under the title: what the horse needs now (winded, starving, a wagon failing), else on a keyboard the gallop's
 * key while ridden, and while the look holds the mouse, how to free it for the buttons. A finger reads the meters.
 * @param {any} s @param {{ touch?: boolean, mouseFree?: boolean, freeKey?: string, keyOf?: (a: string) => string }} state
 */
export function saddleHint(s, state = {}) {
  const h = s.horse, w = s.wagon;
  if (h?.winded) return 'Winded. Ease off and let it breathe';
  if (h?.hungerKey === 'starving') return s.mode === 'Horse' ? 'Starving. It will not gallop until it eats' : 'Starving. Feed your horse';
  if (failingSlows(w)) return `The ${w.name.toLowerCase()} is failing. Mend it to restore its pace`;   // WAGON-TIERS: on Boons it has its pace
  if (state.touch) return '';
  const parts = [];
  const run = state.keyOf?.(SADDLE_ACTIONS.run) ?? '';
  if (s.mode === 'Horse' && h && run) parts.push(`Gallop: hold ${run}`);
  if (!state.mouseFree) parts.push(`Free the mouse (${state.freeKey || 'Y'}) to use these`);
  return parts.join(' · ');
}

/** UI-CALM: the player's choice - when the panel stands. */
export const SADDLE_PANEL_PREF = 'saddlePanel';
export const SADDLE_PANEL_MODES = Object.freeze(['auto', 'always', 'off']);
/** UI-CALM: how long the line that names the horse stands after mounting (ms). */
export const SADDLE_HELLO_MS = 6000;
/** The choice now: 'auto' (When needed) unless the player chose another. */
export const saddlePanelMode = () => { const v = getPref(SADDLE_PANEL_PREF); return SADDLE_PANEL_MODES.includes(v) ? v : 'auto'; };

/**
 * UI-CALM: what of the saddle needs the rider NOW, or null - the breath (winded, or short), the hunger (hungry or
 * starving), the wagon (rickety or failing, where its wear slows it - WAGON-TIERS), the load (past its limit). The first
 * that does, in that order. Pure.
 * @param {any} s
 */
export function saddleAlert(s) {
  const h = s?.horse, w = s?.wagon;
  if (h && (h.winded || (h.breath != null && h.breath < SADDLE_BREATH_LOW))) return 'breath';
  if (h && (h.hungerKey === 'hungry' || h.hungerKey === 'starving')) return 'hunger';
  if (w && (w.stateKey === 'rickety' || w.stateKey === 'failing') && w.wearSlows !== false) return 'wagon';   // WAGON-TIERS: on Boons its wear takes nothing
  if (s?.load && s.load.limit > 0 && s.load.kg > s.load.limit) return 'load';
  return null;
}
/** UI-CALM: the one line a `note` says - what needs the rider, and what to do (the plate's title names whose), in the
 *  player's language as the hello beside it is (AUDIT UICALM-FIRM1 L4 M8: the plate had read half translated). Pure.
 *  @param {any} s */
export function saddleNote(s) {
  const h = s?.horse, w = s?.wagon;
  switch (saddleAlert(s)) {
    case 'breath': return h.winded ? t('saddle.note.winded', 'Winded. Ease off and let it breathe') : t('saddle.note.breath', 'Short of breath. Ease off');
    case 'hunger': return h.hungerKey === 'starving'
      ? (s.mode === 'Horse' ? t('saddle.note.starvingGallop', 'Starving. It will not gallop until it eats') : t('saddle.note.starving', 'Starving. Feed your horse'))
      : t('saddle.note.hungry', 'Hungry. Feed it oats');
    case 'wagon': return w.stateKey === 'failing'
      ? t('saddle.note.failing', 'The {wagon} is failing. Mend it to restore its pace', { wagon: w.name.toLowerCase() })
      : t('saddle.note.rickety', 'The {wagon} is rickety. A repair kit or a Wagon Yard will mend it', { wagon: w.name.toLowerCase() });
    case 'load': return t('saddle.note.load', 'Overloaded. Your team pulls it more slowly');
    default: return '';
  }
}
/** UI-CALM: the panel put up or away with its key (SADDLE_PANEL_ACTION) - remembered, so the next ride keeps the
 *  player's last word; unset, the choice decides (Always up, else away). */
export const SADDLE_OPEN_PREF = 'saddlePanelOpen';
/** UI-CALM: the registry's action that puts the panel up and away (systems/inputActions.js, default F2). */
export const SADDLE_PANEL_ACTION = 'SaddlePanel';
/** UI-CALM: whether the panel is up now - the player's last press under this choice, else the choice's own (Always:
 *  up). AUDIT UICALM-FIRM1 L4 M1: a press is kept WITH the choice it was made under (`{ open, mode }`) - a press kept
 *  alone outlived the choice (Off showed the whole panel after an old F2, Always nothing), and Restore defaults left it. */
export function saddlePanelOpen(mode = saddlePanelMode()) {
  const v = getPref(SADDLE_OPEN_PREF);
  return v && typeof v === 'object' && v.mode === mode && typeof v.open === 'boolean' ? v.open : mode === 'always';
}
/** UI-CALM: the key's press (or a finger's tap on the plate) - the panel up if it was away, away if it was up. */
export function toggleSaddlePanel(mode = saddlePanelMode()) {
  const next = !saddlePanelOpen(mode);
  setPref(SADDLE_OPEN_PREF, { open: next, mode });
  return next;
}
/**
 * UI-CALM: WHAT OF THE PANEL STANDS - 'full' (the block: the meters and the presses), 'note' (one line: what needs the
 * rider), 'hello' (the name and the key that puts the panel up, the first seconds in the saddle), 'chip' (a finger's
 * plate, a tap from the panel), or 'none'. THE KEY DECIDES (a player: "we need a keybind to make it appear and
 * disappear"): up, the block stands whatever else; away, only what needs the rider - When needed - or nothing (Off).
 * `state`: { open (the key's word: saddlePanelOpen), touch, since (ms in the saddle) }. Pure.
 * @param {any} s @param {{ open?: boolean, touch?: boolean, since?: number }} state @param {string} [mode]
 */
export function saddleShown(s, state = {}, mode = 'auto') {
  if (!s) return 'none';
  if (state.open ?? mode === 'always') return 'full';
  if (mode === 'off') return state.touch ? 'chip' : 'none';
  if (saddleAlert(s)) return 'note';
  if (state.touch) return 'chip';
  return (state.since ?? Infinity) < SADDLE_HELLO_MS ? 'hello' : 'none';
}
/** UI-CALM: the hello's line under the horse's name - the key that puts the panel up. */
export const saddleHello = (s, key = '') => (key ? t('saddle.hello.key', '{key}: saddle panel', { key }) : t('saddle.hello.none', 'Saddle panel: give it a key in Controls'));

/** The layout and the letters; the Plus kit paints the bar and the buttons (enhancedFrame.js FRAME_ROLES). */
export const SADDLE_CSS = `
/* STEED-UI: THE SADDLE PANEL (ui/enhanced/enhancedSaddle.js) - above the HUD and below every window. UI-CALM: LOW, over the vitals
   and the hotbar (--sp-bottom, measured off them each few frames: placeBar), never across the compass and the sky; and
   only what is wanted stands (data-show, saddleShown) */
.saddlepanel { position: fixed; inset: 0; z-index: 5; pointer-events: none; font-family: ${PIXEL_STACK}; -webkit-font-smoothing: none;
  font-variant-ligatures: none; color: #d8cfae; --sp-bottom: calc(16px + env(safe-area-inset-bottom, 0px)); }
.saddlepanel[data-show="none"] { display: none; }
.saddlepanel-bar { position: absolute; right: calc(16px + env(safe-area-inset-right, 0px)); bottom: var(--sp-bottom); display: flex; flex-direction: column;
  align-items: stretch; gap: 8px; padding: 10px 12px; width: 300px; max-width: calc(100vw - 32px); box-sizing: border-box; border: 2px solid; border-radius: 0; }
.saddlepanel-title { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 2px 12px; }
.saddlepanel-name { font-size: 16px; letter-spacing: 0.04em; color: #efe8d6; text-shadow: 1px 1px 0 #050608; }
.saddlepanel-gait { font-size: 14px; letter-spacing: 0.04em; color: #d9c48a; text-shadow: 1px 1px 0 #050608; font-variant-numeric: tabular-nums; }
.saddlepanel-gait:empty { display: none; }
.saddlepanel-hint { font-size: 13px; letter-spacing: 0.03em; color: #bdb4a0; text-shadow: 1px 1px 0 #050608; }
.saddlepanel-hint:empty { display: none; }
.saddlepanel-hint.warn { color: #e8b04a; }
/* the block: a meter a row - its word, its bar, its reading - in one grid, so the bars stand in one column */
.saddlepanel-meters { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 5px 10px; }
.saddlepanel-meters:empty { display: none; }
.saddlepanel-meter { display: contents; font-size: 13px; letter-spacing: 0.04em; text-shadow: 1px 1px 0 #050608; }
.saddlepanel-meter > * { font-size: 13px; letter-spacing: 0.04em; text-shadow: 1px 1px 0 #050608; }
.saddlepanel-meter:not(:has(.saddlepanel-track)) .saddlepanel-mtext { grid-column: 2 / -1; }
.saddlepanel-mlabel { color: #bdb4a0; }
.saddlepanel-mtext { color: #e6dec6; font-variant-numeric: tabular-nums; }
.saddlepanel-track { position: relative; width: 100%; height: 8px; background: rgba(5,6,8,0.75); border: 1px solid #5a5446; box-sizing: border-box; }
.saddlepanel-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: #7fae5a; }
.saddlepanel-meter.ok .saddlepanel-fill { background: #7fae5a; }
.saddlepanel-meter.warn .saddlepanel-fill { background: #d9a441; }
.saddlepanel-meter.warn .saddlepanel-mtext { color: #e8b04a; }
.saddlepanel-meter.low .saddlepanel-fill { background: #c4523e; }
.saddlepanel-meter.low .saddlepanel-mtext { color: #e2735e; }
.saddlepanel-meter.bond .saddlepanel-fill { background: #c08a3e; }
.saddlepanel-meter.bond .saddlepanel-mtext { color: #f3cf86; }
/* the block's presses: two to a row, each a block of its own */
.saddlepanel-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.saddlepanel-btn:last-child:nth-child(odd) { grid-column: 1 / -1; }
.saddlepanel-btns:empty { display: none; }
.saddlepanel-btn { pointer-events: auto; display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; padding: 4px 8px;
  border: 2px solid; border-radius: 0; font: inherit; font-size: 14px; letter-spacing: 0.04em; color: #e6dec6; cursor: pointer;
  text-shadow: 1px 1px 0 #050608; touch-action: none; user-select: none; -webkit-user-select: none; }
.saddlepanel-btn { white-space: nowrap; }
.saddlepanel-btn[disabled] { opacity: 0.45; cursor: default; }
.saddlepanel-key { font-size: 12px; letter-spacing: 0.04em; color: #bdb4a0; }
.saddlepanel-key:empty { display: none; }
/* UI-CALM: a NOTE is one line - the name, what needs the rider and its own meter, no presses; the HELLO the name and how
   to call the panel; a finger's CHIP the name alone, a tap away from the panel. Each a small plate, quieter than the panel. */
.saddlepanel:is([data-show="note"], [data-show="hello"], [data-show="chip"]) .saddlepanel-btns,
.saddlepanel:is([data-show="note"], [data-show="hello"], [data-show="chip"]) .saddlepanel-gait { display: none; }
.saddlepanel:is([data-show="note"], [data-show="hello"], [data-show="chip"]) .saddlepanel-bar { width: auto; max-width: 300px; gap: 4px; padding: 6px 12px; }
.saddlepanel:is([data-show="hello"], [data-show="chip"]) .saddlepanel-meters { display: none; }
.saddlepanel[data-show="note"] .saddlepanel-meter:not(.warn):not(.low) { display: none; }
.saddlepanel[data-show="chip"] .saddlepanel-hint { display: none; }
.saddlepanel[data-show="hello"] .saddlepanel-bar { animation: saddlepanel-hello ${SADDLE_HELLO_MS}ms steps(12, end) both; }
@keyframes saddlepanel-hello { 0%, 80% { opacity: 1; } 100% { opacity: 0; } }
.saddlepanel.touch .saddlepanel-title { pointer-events: auto; cursor: pointer; min-height: 32px; align-items: center; }
/* the helm's finger place (ui/enhanced/enhancedHelm.js AUDIT NAV1): centred in the room right of the corner's two presses - the
   bottom is the sticks' */
/* a finger: the block at the right, clear of the sticks at the bottom and the corner's two presses at the top left - and
   UNDER THE COMPASS's band (--sp-top, measured: placeTouch), never across it, held above the hotbar and the vitals
   (--sp-maxh) and scrolled inside where a short screen leaves less (AUDIT UICALM-FIRM1 L4 M2) */
.saddlepanel.touch .saddlepanel-bar { bottom: auto; top: var(--sp-top, calc(8px + env(safe-area-inset-top, 0px))); right: calc(8px + env(safe-area-inset-right, 0px));
  max-width: calc(100vw - 144px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)); max-height: var(--sp-maxh, none); overflow-y: auto; }
.saddlepanel.touch .saddlepanel-btn { min-height: 44px; min-width: 44px; }
.saddlepanel.touch .saddlepanel-key { display: none; }
@media (max-width: 560px) { .saddlepanel-btn { padding: 4px 6px; font-size: 13px; } .saddlepanel-bar { width: 260px; } }
@media (prefers-reduced-motion: reduce) { .saddlepanel[data-show="hello"] .saddlepanel-bar { animation: none; } }
`;

let host = null;
/** @type {any} */
let parts = null;
/** @type {any} */
let last = null;
/** UI-CALM: when this ride's panel was first drawn (ms, the hello's clock). */
let mountedAt = 0;
/** UI-CALM: the frames between two measures of where the vitals and the hotbar stand (placeBar). */
export const SADDLE_PLACE_EVERY = 15;

function injectSaddleStyle(doc) {
  if (doc.getElementById?.(SADDLE_STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = SADDLE_STYLE_ID;
  st.textContent = SADDLE_CSS;
  (doc.head ?? doc.body)?.append?.(st);
}
/** A press on the panel is the panel's - never a swing, a look or an activation in the world (the helm's law). */
const swallowPresses = (node) => {
  const swallow = (e) => e.stopPropagation();
  for (const t of ['pointerdown', 'mousedown', 'mouseup', 'click', 'touchstart', 'wheel', 'contextmenu']) node.addEventListener(t, swallow);
};
const span = (doc, cls) => { const n = doc.createElement('span'); n.className = cls; return n; };
const clear = (node) => { if (typeof node.replaceChildren === 'function') node.replaceChildren(); else node.textContent = ''; };

/** The panel's nodes, not yet on the page - the one shape the live panel and HUD-MOVE's preview are both made in. */
function build(doc) {
  try { injectEnhancedStyle(doc); } catch { /* the kit's sheet is the HUD's; a document without it still takes the panel */ }
  injectSaddleStyle(doc);
  const root = doc.createElement('div');
  root.className = 'saddlepanel';
  const bar = doc.createElement('div');
  bar.className = 'saddlepanel-bar';
  const title = doc.createElement('div');
  title.className = 'saddlepanel-title';
  const name = span(doc, 'saddlepanel-name'), gait = span(doc, 'saddlepanel-gait'), hint = span(doc, 'saddlepanel-hint');
  title.append(name, gait, hint);
  // UI-CALM: a finger's plate - the name - opens the panel, and closes it again
  title.addEventListener('click', (e) => { if (!last?.touch) return; e.preventDefault?.(); toggleSaddlePanel(last.mode); });
  const meters = doc.createElement('div');
  meters.className = 'saddlepanel-meters';
  const btns = doc.createElement('div');
  btns.className = 'saddlepanel-btns';
  bar.append(title, meters, btns);
  root.append(bar);
  swallowPresses(root);
  return { root, bar, name, gait, hint, meters, btns, buttons: new Map(), meterParts: new Map() };
}

/** `parts` the nodes build() made - the live panel's or a preview's own, never both. */
function makeMeters(doc, parts, list) {
  clear(parts.meters);
  parts.meterParts.clear();
  for (const m of list) {
    const n = doc.createElement('span');
    n.className = `saddlepanel-meter saddlepanel-m-${m.key}`;
    n.dataset.key = m.key;
    const label = span(doc, 'saddlepanel-mlabel');
    n.append(label);
    let fill = null;
    if (m.share != null) {
      const track = span(doc, 'saddlepanel-track');
      fill = span(doc, 'saddlepanel-fill');
      track.append(fill);
      n.append(track);
    }
    const text = span(doc, 'saddlepanel-mtext');
    n.append(text);
    parts.meters.append(n);
    parts.meterParts.set(m.key, { node: n, label, fill, text });
  }
}

function makeButtons(doc, parts, list, hooks) {
  clear(parts.btns);
  parts.buttons.clear();
  for (const b of list) {
    const n = doc.createElement('button');
    n.type = 'button';
    n.className = `saddlepanel-btn saddlepanel-${b.act}`;
    n.dataset.act = b.act;
    const label = span(doc, 'saddlepanel-label'), key = span(doc, 'saddlepanel-key');
    n.append(label, key);
    // AUDIT STEED-UI: a button never keeps the keyboard's focus - a focused one is clicked again by the next Space or
    // Enter the look's keys send through (a Jump's keyup spent a second kit, an hour with it), so a press never takes it
    n.addEventListener('mousedown', (e) => e.preventDefault?.());
    n.addEventListener('click', (e) => {
      e.preventDefault?.();
      n.blur?.();
      if (n.disabled) return;
      hooks[b.act]?.();
    });
    parts.btns.append(n);
    parts.buttons.set(b.act, { node: n, label, key });
  }
}

/**
 * The panel's frame. `state`: { saddle: the host's read (or null - nothing to show), covered, touch, mouseFree,
 * freeKey (the free-mouse key's label), keyOf(action) -> its key's label }. The saddle's read: { mode 'Horse'|'Cart',
 * name, wagonName, speed (m/s), galloping, walks (HORSE-WALK: its own pace a walk), horse, wagon, oats, apples, kits
 * (upkeepRuntime.js saddle), load { kg, limit }
 * | null, near, wagonNear, cargo (null: no wagon to open; else whether it can be reached), view, hcc }. `hooks`: feed,
 * treat, kit, cargo, stable, view, dismount. Returns the root, or null when nothing stands.
 */
export function drawEnhancedSaddle(state = {}, hooks = {}, { doc = globalThis.document } = {}) {
  if (!doc?.body) return null;
  const s = state.saddle ?? null;
  if (!s) { hideEnhancedSaddle(); return null; }
  const now = Number.isFinite(state.now) ? /** @type {number} */ (state.now) : (globalThis.performance?.now?.() ?? Date.now());
  if (!host) {
    last = {}; parts = build(doc); host = parts.root; mountedAt = now;
    host.id = ENHANCED_SADDLE_ID;
    doc.body.append(host);
    placeHudPieces(doc);   // HUD-SADDLE: where the player moved it (or turned it off) from its first frame - not at the next sweep
  }
  if (state.covered) {
    if (last.covered !== true) { last.covered = true; parts.root.style.display = 'none'; }
    return parts.root;
  }
  if (last.covered === true) { last.covered = false; parts.root.style.display = ''; }
  paintSaddle(doc, parts, last, state, hooks, now - mountedAt);
  return parts.root;
}

/** The panel's face for a read: `parts` its nodes, `last` what they show now (each piece written only when it moves), `since`
 *  the ms this ride's panel has stood (UI-CALM's hello). The live panel's frame and the preview's one painting. */
function paintSaddle(doc, parts, last, state, hooks, since = Infinity) {
  const s = state.saddle;
  const hud = /** @type {any} */ (doc.querySelector?.('.hud'));
  const scale = hud?.style?.getPropertyValue?.('--hud-scale') || '1';   // the HUD's scale, read off the HUD (the helm's own read)
  if (last.scale !== scale) { last.scale = scale; parts.root.style.setProperty?.('--hud-scale', scale); }
  const rootClass = `saddlepanel${state.touch ? ' touch' : ''}`;
  if (last.rootClass !== rootClass) { last.rootClass = rootClass; parts.root.className = rootClass; }
  // UI-CALM: what stands - the whole panel, a note, the hello, a finger's chip, or nothing (saddleShown)
  last.touch = !!state.touch;
  const mode = state.panel ?? saddlePanelMode();
  last.mode = mode;
  const show = saddleShown(s, { open: state.open ?? saddlePanelOpen(mode), touch: !!state.touch, since }, mode);
  if (last.show !== show) { last.show = show; parts.root.dataset.show = show; last.place = -1; }
  if (show === 'none') return;
  last.place = ((last.place ?? -1) + 1) % SADDLE_PLACE_EVERY;
  if (last.place === 0) { if (state.touch) placeTouch(doc, parts, last); else placeBar(doc, parts, last); }
  const title = saddleTitle(s);
  if (last.title !== title) { last.title = title; parts.name.textContent = title; }
  const gait = [saddleGait(s.mode, s.speed, s.galloping, s.walks), saddleSpeedText(s.speed)].filter(Boolean).join(' · ');
  if (last.gait !== gait) { last.gait = gait; parts.gait.textContent = gait; }
  // UI-CALM: a note says what needs the rider; the hello the horse's name and how to call the panel
  const said = show === 'note' ? saddleNote(s) : show === 'hello' ? saddleHello(s, state.keyOf?.(SADDLE_PANEL_ACTION) ?? '') : '';
  const hint = said || saddleHint(s, state);
  const hintWarn = show === 'note' || !!(s.horse?.winded || s.horse?.hungerKey === 'starving' || failingSlows(s.wagon));
  if (last.hint !== hint || last.hintWarn !== hintWarn) { last.hint = hint; last.hintWarn = hintWarn; parts.hint.textContent = hint; parts.hint.className = `saddlepanel-hint${hintWarn ? ' warn' : ''}`; }
  // the meters: made again only when their set changes (a bar becoming a chip is a new set)
  const meters = saddleMeters(s);
  const msig = meters.map((m) => `${m.key}${m.share != null ? '#' : ''}`).join(',');
  if (last.msig !== msig) { last.msig = msig; last.meters = {}; makeMeters(doc, parts, meters); }
  for (const m of meters) {
    const p = parts.meterParts.get(m.key);
    if (!p) continue;
    const width = m.share != null ? `${(Math.max(0, Math.min(1, m.share)) * 100).toFixed(1)}%` : null;
    const was = last.meters[m.key];
    if (!was || was.label !== m.label || was.text !== m.text || was.tone !== m.tone || was.width !== width || was.title !== m.title) {
      last.meters[m.key] = { label: m.label, text: m.text, tone: m.tone, width, title: m.title };
      p.label.textContent = m.label;
      p.text.textContent = m.text;
      p.node.className = `saddlepanel-meter saddlepanel-m-${m.key} ${m.tone}`;
      if (p.fill && width != null) p.fill.style.width = width;
      if (m.title) p.node.setAttribute?.('title', m.title); else p.node.removeAttribute?.('title');
    }
  }
  const list = saddleButtons(s);
  const sig = list.map((b) => b.act).join(',');
  if (last.sig !== sig) { last.sig = sig; last.labels = {}; makeButtons(doc, parts, list, hooks); }
  for (const b of list) {
    const p = parts.buttons.get(b.act);
    if (!p) continue;
    const key = b.action && !state.touch ? (state.keyOf?.(b.action) ?? '') : '';
    const was = last.labels[b.act];
    const why = b.disabled ? (b.why ?? '') : '';
    if (!was || was.label !== b.label || was.key !== key || was.disabled !== !!b.disabled || was.why !== why) {
      last.labels[b.act] = { label: b.label, key, disabled: !!b.disabled, why };
      p.label.textContent = b.label;
      p.key.textContent = key;
      p.node.disabled = !!b.disabled;
      p.node.setAttribute?.('aria-label', why ? `${b.label} - ${why}` : b.label);
      if (why) p.node.setAttribute?.('title', why); else p.node.removeAttribute?.('title');
    }
  }
}

/** HUD-SADDLE: the read HUD-MOVE's preview stands on - a horse ridden at a stand, fed, half way to its next bond word,
 *  with oats to hand. Named a preview on its title (buildSaddlePreview), as every stand-in is. */
const SADDLE_PREVIEW = Object.freeze({
  mode: 'Horse', name: '', wagonName: '', speed: 0, galloping: false, walks: false,
  horse: Object.freeze({ breath: 1, winded: false, hunger: 'Fed', hungerKey: 'fed', fedHours: 8, full: false, feed: 0, team: 1, tier: 'Familiar', bond: 45, tierAt: 35, next: Object.freeze({ name: 'Trusting', at: 55 }) }),
  wagon: null, oats: 1, apples: 0, kits: 0, load: null, near: true, wagonNear: true, cargo: null, view: false, hcc: false,
});

/** HUD-MOVE's preview (ui/hud/hudLayout.js): the panel as it stands astride, for the unlocked HUD while nobody rides - its
 *  own nodes, built and painted as the live panel's are, never mounted (the live panel's slot stays empty), at a finger's
 *  place on a touch device as the hosts' own panel is. Its buttons answer nothing. UI-CALM: the whole panel (`open`),
 *  whatever the player's choice of when it stands - the block is what is moved. */
export function buildSaddlePreview(doc) {
  const p = build(doc);
  paintSaddle(doc, p, {}, { saddle: SADDLE_PREVIEW, touch: isTouchDevice(doc.defaultView ?? globalThis.window), mouseFree: true, open: true }, {});
  p.name.textContent = t('menu.hud.preview.saddle', 'Riding panel (preview)');
  return p.root;
}

/** UI-CALM: THE BLOCK STANDS IN THE BOTTOM-RIGHT CORNER (a player: "in a blocky form in the bottom right") - and where
 *  a narrow screen brings the hotbar or the vitals under it (they are centred, it is a corner), just over whichever of
 *  them it would meet: the HUD's own boxes, read off the page, so no HUD scale puts it on them. */
function placeBar(doc, parts, last) {
  const vh = Number(globalThis.innerHeight);
  const me = /** @type {any} */ (parts.bar)?.getBoundingClientRect?.();
  if (!(vh > 0) || !me || !(me.width > 0)) return;
  let top = Infinity;
  for (const sel of ['.hud .hb', '.hud .hud-bottom']) {
    const r = /** @type {any} */ (doc.querySelector?.(sel))?.getBoundingClientRect?.();
    if (r && r.width > 0 && r.height > 0 && r.right > me.left - 8 && r.left < me.right + 8) top = Math.min(top, r.top);
  }
  const v = Number.isFinite(top) ? `${Math.max(12, Math.round(vh - top + 10))}px` : '';
  if (last.bottom === v) return;
  last.bottom = v;
  if (v) parts.root.style.setProperty?.('--sp-bottom', v); else parts.root.style.removeProperty?.('--sp-bottom');
}

/** AUDIT UICALM-FIRM1 L4 M2: A FINGER'S BLOCK STANDS UNDER THE COMPASS - its top at the HUD top band's foot, its height
 *  held above whichever of the hotbar and the vitals is highest, both read off the page (the plate and the block had
 *  covered the compass at every phone size, and the hotbar and the vitals in landscape). */
function placeTouch(doc, parts, last) {
  const band = /** @type {any} */ (doc.querySelector?.('.hud .hud-top'))?.getBoundingClientRect?.();
  const top = band && band.height > 0 ? Math.round(band.bottom + 6) : null;
  let floor = Infinity;
  for (const sel of ['.hud .hb', '.hud .hud-bottom']) {
    const r = /** @type {any} */ (doc.querySelector?.(sel))?.getBoundingClientRect?.();
    if (r && r.width > 0 && r.height > 0) floor = Math.min(floor, r.top);
  }
  const v = top != null ? `${top}px` : '';
  const mh = top != null && Number.isFinite(floor) && floor > top ? `${Math.max(48, Math.round(floor - top - 8))}px` : '';
  if (last.top !== v) { last.top = v; if (v) parts.root.style.setProperty?.('--sp-top', v); else parts.root.style.removeProperty?.('--sp-top'); }
  if (last.maxh !== mh) { last.maxh = mh; if (mh) parts.root.style.setProperty?.('--sp-maxh', mh); else parts.root.style.removeProperty?.('--sp-maxh'); }
}

/** Taken down: out of the saddle, the skin or the switch off, a door. */
export function hideEnhancedSaddle() {
  if (!host) return;
  try { host.remove(); } catch { /* already gone */ }
  host = null; parts = null; last = null;
}

export const enhancedSaddleMounted = () => !!host;
/** The bar standing now - mounted and not covered - or null (the helm's enhancedHelmBar's twin). */
export const enhancedSaddleBar = () => (host && last?.covered !== true && last?.show !== 'none' ? parts.bar : null);
