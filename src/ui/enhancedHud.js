// PX30 - THE GAMEPLAY HUD.
//
// Mac's reference is ESO's Clean UI: a compass strip across the top, a
// named target bar under it, three vitals along the bottom, and the
// effects beneath them. This is that reading in the pixel language
// this arc has built - the same Bayer-dithered ground, the same
// Pixelify face, the same brass and bone and the classic shadowed
// pair, the same square 2px frames, and states that SNAP.
//
// IT IS A READOUT, NOT A WINDOW. Nothing here takes a click, nothing
// registers with the overlay stack, and Tab does not close it: it is
// the game's own face. That is why it does not go through a door.
//
// AND IT IS DRAWN FROM THE ONE HOST-AGNOSTIC CALL. `drawHud` is what
// all four hosts already make, "last, over the viewmodel" - so the
// enhanced HUD rides it exactly as the damage flash does, and no host
// can forget it or run it twice. The classic HUD is untouched and
// still draws for the classic skin; this replaces it for the enhanced
// one, which is what a skin is.
//
// UPDATED, NOT REBUILT. A per-frame innerHTML is the entrance-replay
// bug (PX19k) at sixty times a second. The DOM is made once and each
// frame writes only what CHANGED - a width, a number, a name - so a
// still frame costs four string compares.
//
// ── QS3: THE QUICKSLOT DIAMOND, AND ITS TWO DEPARTURES ───────────
//
// Mac's second reference is the bottom-left diamond of the Demon's
// Souls remake: four diamond cells in a larger diamond - the off hand
// on the left, the weapon on the right, two consumables above and
// below - each with the item's own art, a durability strip on the
// hands, a count on the consumables, and the key that presses it at
// the outer point. It REPLACES the "Ready"/"Hand" plaques PX30b put
// under the vitals: those said the same two things in words, in a
// place the eye does not go, and could say nothing at all about a
// potion. The model is systems/quickslots.js; this draws it.
//
// DEPARTURE 1 - AN EMPTY CELL IS A SOCKET, NOT AN ABSENCE. PX30b's
// law is that a plaque draws only when filled, because an empty one is
// PX14's drawn door. That law stands where it was made and does not
// reach here, because THE SHAPE IS THE READOUT: four cells at four
// points ARE the diamond, and a diamond with a corner missing is not a
// diamond - it is a wedge the player has to re-read every time the
// last potion is drunk. An empty cell is drawn as a SOCKET (the frame
// at a third of its alpha, nothing inside), which is not a door that
// opens nothing: it says a slot exists and that filling it is the
// inventory tooltip's job. The lead records it in the bible.
//
// DEPARTURE 2 - ON A PHONE, THE CELLS TAKE A TAP. "Nothing here takes
// a click" is this file's own first law and it is kept everywhere else
// - the `.hud` root is still `pointer-events: none` and nothing
// registers with the overlay stack. But under `pointer: coarse` the
// four cells take one, because a phone has no Digit1, no Digit2 and no
// Digit3, and AUDIT SOC C9 is the lesson this repeats: SOC5's F had no
// phone control for a whole arc and online on a phone could open
// neither door it led to. A control a platform cannot reach is a
// feature that platform does not have. The handlers are bound ONCE in
// build() and read the live options bag from a module variable, so a
// frame still costs no listener work.
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { mountHitNumbers } from './hitNumbers.js';   // HN1
import { activeSpellIcons, maxRoundsRemaining } from './hudActiveSpells.js';
import { liveBundles } from '../systems/mysticism.js';   // PX30: the ONE bundle walk the HUD already uses
import { getPref } from '../systems/uiPrefs.js';   // PX30c: the port's own prefs, not DFU's settings
import { survivalHudChips } from '../systems/survival/status.js';   // SURV5: the needs strip
import { liveVampirism } from '../systems/racialLive.js';   // AUDIT SURV C: no hunger or sleep chip on a vampire
import { survivalOn } from '../systems/survival/switch.js';
import { worldMinutes } from '../systems/worldTick.js';
import { compassScroll, breathShortThreshold, compassMarkerLerp, DETECT_MARKER_RGB } from './hud.js';
import { maxBreath, maxFatigue, liveStat } from '../systems/statMods.js';   // PX30b/PX30d: DFU's own ceilings
// QS3: the quickslot diamond. The MODEL is systems/quickslots.js and
// nothing about it is restated here; the ICON is the one the inventory
// window draws (ui/itemIconUrl.js, moved out of that 2200-line screen
// rather than importing it); the TAGS are their own pure module.
import { quickslotView, quickslotKey, cycleQuickslot, quickslotCycling, spellQuickslot,
  QUICK_HOLD_MS, QUICK_STEP_MS } from '../systems/quickslots.js';   // QS6: the phone's own hold - a finger cycles a slot the way a held key does
import { modelIconUrl } from './itemIconUrl.js';
import { fpArm } from '../combat/fpArm.js';   // the Morrowind ground mesh the inventory takes through its deps bag
import { requestIcon } from './textureCanvas.js';
import { inventoryItemImage } from '../systems/itemTemplates.js';
import { quickslotTag, quickslotOffTag, quickslotSpellTag, tagKey, CELL_ACTIONS } from './quickslotTags.js';   // QS6: the caption's spell chip names its own action
import { glyphSvg, padFamily } from './padGlyphs.js';
import { controllerLook } from '../player/lookFilter.js';   // GP1's own latch: "the last input was the pad"
import { bindings } from './input.js';
// (breathShortThreshold lives in hud.js, imported below with compassScroll)
import { foeTarget, tickFoeTarget } from './hudFoeTarget.js';
// PX32: the reticle's LAWS are the classic module's - which setting shows
// a crosshair, which style makes the mode word the crosshair, which
// styles show a corner word - imported rather than restated.
import { crosshairEnabled, interactionIconStyle, iconReplacesCrosshair, modeIconEnabled, MODE_LABEL } from './hudCrosshair.js';
import { getInteractionMode } from '../player/interactionMode.js';
import { setEnhancedMidTextScale } from './enhancedHudText.js';   // AUDIT FONT F2: the mid-screen label is a layer beside this one, not inside it (the popup column it once scaled too is a toast in the notice stack since ENH-NOTICE3)

/**
 * PX30c (Mac: "is there anyway I can adjust the sizing?"): THE HUD'S
 * SCALE, as a setting rather than a constant.
 *
 * NAMED `enhancedHudScale`, not `hudScale`: the classic HUD already
 * declares a `hudScale(canvas)` of its own - the canvas fit - and
 * audit24's one-home pin caught the collision on the first full run.
 * Two functions with one name in one UI is exactly what that pin is
 * for.
 *
 * It lives in the PORT'S OWN PREFS (`uiPrefs`), not in DFU's settings,
 * and two pins said so before I listened: settingsDefaults.js is BAKED
 * from DFU's vendored ini and nothing hand-edits it, and the tier
 * map's own law is that every key in it "is a real DFU setting". This
 * is not one - DFU has no HUD of this shape to scale - so it sits
 * beside the other things only this port has.
 *
 * Clamped, because a HUD is not a place to let a typo hide the game:
 * half size still reads, and double fills a phone.
 */
export const HUD_SCALE_MIN = 0.5;
export const HUD_SCALE_MAX = 2;
export const enhancedHudScale = () => {
  const v = Number(getPref('hudScale'));
  if (!Number.isFinite(v) || v <= 0) return 1;
  return Math.max(HUD_SCALE_MIN, Math.min(HUD_SCALE_MAX, v));
};

/** The compass strip's eight points, in the order a turning player
 *  meets them. DFU's own compass is a scrolling strip of the same
 *  circle; this is that circle written in letters. */
export const COMPASS_POINTS = Object.freeze([
  ['N', 0], ['NE', 0.125], ['E', 0.25], ['SE', 0.375],
  ['S', 0.5], ['SW', 0.625], ['W', 0.75], ['NW', 0.875],
]);

/** How much of the circle the strip shows at once. A quarter is the
 *  reference's own bite: wide enough that two points are always in
 *  view, narrow enough that turning MOVES. */
export const COMPASS_SPAN = 0.25;

/** QS5: the wear gauge is SVG, and an SVG node minted with
 *  `createElement` is an unknown HTML element that draws nothing - the
 *  namespace is the whole of the difference. */
const SVG_NS = 'http://www.w3.org/2000/svg';
const svgEl = (doc, tag, cls) => {
  const n = doc.createElementNS(SVG_NS, tag);
  if (cls) n.setAttribute('class', cls);
  return n;
};

// FOEBAR1: the blade face's two pictures RIDE THE MODULE. `new URL(...,
// import.meta.url)` is the pattern the workers use (ai/navClient.js): vite
// serves it in dev and bundles it with the page's base in a build, and
// node resolves it to a file URL it never fetches. public/ was wrong for
// this: it is served at the root alone, and the game runs at /play/, where
// a page-relative ./hud/ is the SPA page and a root-absolute /hud/ is not
// under the build's './' base.
const BLADE_EMPTY_URL = new URL('./assets/foe-blade-empty.png', import.meta.url).href;
const BLADE_FULL_URL = new URL('./assets/foe-blade-full.png', import.meta.url).href;
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/**
 * Where a heading sits on the strip, as 0..1 across it, or null when
 * it is off the visible span. Pure - the whole geometry of the
 * compass, and the only thing here worth testing without a browser.
 *
 * `heading01` is the player's own heading, the same 0..1 the classic
 * compass scrolls by (hud.js compassScroll).
 */
export function compassPlace(point01, heading01, span = COMPASS_SPAN) {
  // Shortest way round the circle: a point at 0.98 is just LEFT of a
  // player facing 0.02, not most of a turn to the right.
  let d = point01 - heading01;
  d -= Math.round(d);
  const half = span / 2;
  if (d < -half || d > half) return null;
  return (d + half) / span;
}

// AUDIT 39 F133 - THE DETECT MARKERS RIDE THIS COMPASS TOO.
// The three Detect effects draw nothing themselves: each registers
// with the compass and HUDCompass.Draw runs DrawCompass() then
// DrawTrackedObjects() (:198-252), one marker per detected object. So
// a skin that REPLACES the classic compass owes the player the
// markers, or a Detect costs spell points and shows nothing.
// The bearing is the classic box's own (hud.js compassMarkerLerp) with
// Mathf.Lerp's clamp, and it lands on this strip because both windows
// are the same quarter turn: 64/258 of the classic strip, COMPASS_SPAN
// here. The SHAPE is this skin's - a 5x3 triangle in DFU's own
// (154,24,8), drawn as a CSS border wedge.
//
// LAZY, and for the reason hud.js's own ToolTip is: hud.js imports
// this module, so reading its exports at THIS module's top level runs
// before hud.js has evaluated them. Built on first marker instead.
const detectMarkCss = () => 'position:absolute;bottom:0;width:0;height:0;margin-left:-3px;'
  + 'border-left:3px solid transparent;border-right:3px solid transparent;'
  + `border-top:4px solid rgb(${DETECT_MARKER_RGB[0]},${DETECT_MARKER_RGB[1]},${DETECT_MARKER_RGB[2]});`
  + 'pointer-events:none';

/** The marker row, pooled: nodes are made once and re-placed, the same
 *  updated-not-rebuilt law the rest of this HUD keeps. */
function drawDetectMarkers(detected, playerXZ, heading01) {
  const list = (detected && playerXZ) ? detected : [];
  while (parts.detectMarks.length < list.length) {
    const node = el('i', 'hud-detect');
    node.style.cssText = detectMarkCss();
    parts.compass.append(node);
    parts.detectMarks.push(node);
  }
  for (let i = 0; i < parts.detectMarks.length; i++) {
    const node = parts.detectMarks[i];
    if (i >= list.length) {
      if (node.style.display !== 'none') node.style.display = 'none';
      continue;
    }
    if (node.style.display === 'none') node.style.display = '';
    const at = Math.min(1, Math.max(0, compassMarkerLerp(list[i], playerXZ, heading01)));
    const l = `${(at * 100).toFixed(1)}%`;
    if (node.style.left !== l) node.style.left = l;
  }
}

/** The effects row: name, rounds left, and whether it is going. */
export function effectRows(entity) {
  const { self, other } = activeSpellIcons(entity);
  // THE SAME WALK activeSpellIcons makes, from the same module - the
  // first draft invented a second one that read a shape nothing
  // produces, and the effects row came back empty. `liveBundles` folds
  // a cast's entries into one bundle and is what the HUD, the Dispel
  // picker and this all read.
  const rounds = new Map();
  for (const b of liveBundles(entity)) {
    if (b?.showIcon) rounds.set(String(b.name ?? '').replace(/^!+/, ''), maxRoundsRemaining(b));
  }
  return [...self, ...other].map((i) => ({
    name: i.displayName,
    rounds: rounds.get(i.displayName) ?? null,
    expiring: i.expiring,
    item: i.isItem,
  }));
}

let host = null;
let parts = null;
const last = {};

/** Write only when it changed - the whole reason this is cheap. */
const put = (node, key, value) => {
  if (last[key] === value) return;
  last[key] = value;
  node.textContent = value;
};
/** FOEBAR1: how far the blade's fill is clipped in from EACH tip, as a
 *  percentage of its width, for a health fraction `pct` (0..100): the
 *  two blades recede toward the hub together, so half of what is lost
 *  comes off each end. Full is 0, empty is 50 (the two clips meet at the
 *  hub), and the clamp is the same one `width` gives the plain fill. */
export const bladeInset = (pct) => (100 - Math.max(0, Math.min(100, pct))) / 2;
const clipInset = (node, key, side) => {
  const v = `inset(0 ${side.toFixed(2)}% 0 ${side.toFixed(2)}%)`;
  if (last[key] === v) return;
  last[key] = v;
  node.style.clipPath = v;
};
const width = (node, key, pct) => {
  const v = `${Math.max(0, Math.min(100, pct)).toFixed(1)}%`;
  if (last[key] === v) return;
  last[key] = v;
  node.style.width = v;
};

function build(doc) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  // HN1: the damage numbers register with the formula seam the moment
  // the enhanced HUD exists - and only then, so the classic skin never
  // has a hook installed.
  mountHitNumbers();
  const root = doc.createElement('div');
  root.className = 'hud';
  root.setAttribute('aria-hidden', 'true');   // a HUD is not a reading order

  // TOP: the compass strip, and the target under it.
  const top = el('div', 'hud-top');
  const compass = el('div', 'hud-compass');
  const strip = el('div', 'hud-strip');
  const marks = COMPASS_POINTS.map(([label, at]) => {
    const m = el('span', `hud-point${label.length === 1 ? ' hud-cardinal' : ''}`, label);
    m.dataset.at = String(at);
    strip.append(m);
    return m;
  });
  compass.append(strip, el('i', 'hud-needle'));
  top.append(compass);

  const foe = el('div', 'hud-foe');
  const foeName = el('div', 'hud-foename');
  const foeTrack = el('div', 'hud-track hud-foetrack');
  const foeFill = el('i', 'hud-fill');
  foeTrack.append(foeFill);
  // FOEBAR1 (2026-09-17, Mac, from a friend's two pictures): THE BLADE -
  // an alternate face for the same readout. Two pictures under the one
  // track: the dark twin-bladed shape with the skull hub is the empty
  // bar, the red one is the fill, and the fill is CLIPPED from both tips
  // toward the hub as the foe's health falls (bladeInset). Which face
  // shows is prefs.foeBarStyle ('bar' | 'blade'), read each draw; the
  // plain track stays exactly what it was for 'bar'.
  const foeBlade = el('div', 'hud-foeblade');
  const foeBladeEmpty = el('i', 'hud-bladeempty');
  const foeBladeFull = el('i', 'hud-bladefull');
  foeBladeEmpty.style.backgroundImage = `url("${BLADE_EMPTY_URL}")`;
  foeBladeFull.style.backgroundImage = `url("${BLADE_FULL_URL}")`;
  foeBlade.append(foeBladeEmpty, foeBladeFull);
  foe.append(foeName, foeTrack, foeBlade);
  top.append(foe);
  root.append(top);

  // BOTTOM: the three vitals, then the effects beneath them.
  const bottom = el('div', 'hud-bottom');
  // PX30b: THE BREATH BAR, above the vitals. DFU draws it only while
  // you are holding breath (HUDBreathBar: Amount 0 draws nothing) and
  // turns it RED below (endurance >> 3) + 4 - the classic's own two
  // laws, imported rather than restated. It is the one bar that draws
  // under BOTH huds in DFU, which is why it belongs here and not in
  // the branch above.
  const breath = el('div', 'hud-breath');
  const breathTrack = el('div', 'hud-track');
  const breathFill = el('i', 'hud-fill');
  breathTrack.append(breathFill);
  breath.append(el('span', 'hud-breathlabel', 'Breath'), breathTrack);
  bottom.append(breath);
  const bars = el('div', 'hud-bars');
  // PX30c (Mac: "for the status bars, can we use percentages and
  // organize them within the bar itself"): THE NUMBER GOES INSIDE.
  // A figure beside a bar is a second thing to look at; a percentage
  // ON the bar is the bar saying what it means. The label rides in
  // there too, so each bar names itself rather than relying on a
  // colour a player has to learn.
  const vital = (kind, label) => {
    const wrap = el('div', `hud-vital hud-${kind}`);
    const track = el('div', 'hud-track');
    const fill = el('i', 'hud-fill');
    const num = el('span', 'hud-num');
    track.append(fill, el('span', 'hud-vlabel', label), num);
    wrap.append(track);
    bars.append(wrap);
    return { fill, num };
  };
  // Magicka left, health centre, fatigue right - the reference's own
  // order, and DFU's own three.
  const magicka = vital('magicka', 'Magicka');
  const health = vital('health', 'Health');
  const fatigue = vital('fatigue', 'Fatigue');
  bottom.append(bars);
  const effects = el('div', 'hud-effects');
  bottom.append(effects);
  const needs = el('div', 'hud-needs');   // SURV5: the needs strip, under the effects
  bottom.append(needs);
  root.append(bottom);

  // PX32: THE RETICLE. The enhanced branch returns before the classic
  // draws its crosshair and mode word, so the enhanced skin had NEITHER
  // - a player could not see where they were aiming or which mode they
  // were in. Same laws as hudCrosshair.js, in the pixel language: a
  // square cross in bone with the classic shadow; under the styles
  // where the icon IS the crosshair, the mode's WORD stands at the
  // centre instead (Grab alone keeps the plain cross - it is the mode
  // you aim in); under the others, the word sits in the corner.
  const reticle = el('div', 'hud-reticle');
  const cross = el('i', 'hud-cross');
  const centreWord = el('span', 'hud-modeword hud-modecentre');
  reticle.append(cross, centreWord);
  root.append(reticle);

  // QS3: THE QUICKSLOT DIAMOND, bottom-left, on `root` rather than in
  // `.hud-bottom` - the bottom column is centred and this is anchored
  // to a corner, and a corner block inside a centred flex column moves
  // whenever a bar beside it changes width.
  //
  // THE MODE WORD LIVES HERE NOW. It stood at left 24 / bottom 24,
  // which is exactly where the diamond goes, so rather than move one
  // out of the other's way it becomes the diamond's CAPTION - the
  // interaction mode and the readied spell on one row above the cells,
  // which is where a player already looks. Its show/hide laws are
  // untouched (the `rk` key below); only its place changed.
  const quick = el('div', 'hud-quick');
  const cap = el('div', 'hud-qcap');
  const cornerWord = el('span', 'hud-modeword hud-modecorner');
  const readied = el('div', 'hud-readied');
  // QS6 - THE SPELL CHIP. The diamond's four corners are the two hands
  // and the two consumables; a spell is in none of them, and a fifth
  // corner is not a diamond. It belongs on the CAPTION, which is the row
  // the readied spell already stood on - so the slot's spell and the
  // spell in hand are read in one glance, at the place a player already
  // looks, with the key that changes it printed on it.
  const spellChip = el('div', 'hud-qspell');
  const spellTag = el('span', 'hud-qstag hud-qspkey');
  const spellGlyph = el('img', 'hud-qsglyph');
  spellGlyph.alt = '';
  const spellText = el('span', 'hud-qstext');
  spellTag.append(spellGlyph, spellText);
  const spellName = el('span', 'hud-qspname');
  spellChip.append(spellTag, spellName);
  cap.append(cornerWord, spellChip, readied);
  const diamond = el('div', 'hud-qdiamond');
  // A cell is FOUR elements, and the reason is the pixel language: a
  // rotated square would blur every sprite in it, so the diamond is a
  // clip-path on the frame and the ground and the content inside is
  // never rotated at all.
  const cellOf = (slot) => {
    const cell = el('div', `hud-qcell hud-q${slot}`);
    cell.append(el('i', 'hud-qframe'), el('i', 'hud-qground'));
    const body = el('div', 'hud-qbody');
    const icon = el('img', 'hud-qicon');
    icon.alt = '';
    const init = el('span', 'hud-qinit');
    body.append(icon, init);
    // QS5 (Mac: "We need a better design for durability instead of the
    // line sitting inside with the sprite"): THE CELL'S OWN LOWER EDGES
    // ARE THE GAUGE. A bar under the art was a second object in a cell
    // 84px wide, and it stole the room the sprite wanted; the diamond
    // already draws two lines under the picture - its own bottom-left
    // and bottom-right edges - and a gauge that IS the frame costs the
    // art nothing. It drains from the bottom POINT outward, so a
    // battered sword keeps a stub at the point and a fresh one is lit
    // corner to corner, and the two halves fill symmetrically because
    // the shape is symmetric.
    const gauge = svgEl(doc, 'svg', 'hud-qwear');
    gauge.setAttribute('viewBox', '0 0 100 100');
    gauge.setAttribute('shape-rendering', 'crispEdges');
    gauge.setAttribute('aria-hidden', 'true');
    const track = svgEl(doc, 'path', 'hud-qwtrack');
    track.setAttribute('d', `M ${WEAR_L} M ${WEAR_R}`);   // AUDIT SURV E: two open arms, not one path with a hole in its numbers (Chromium logged the old `d` every build and drew half the track)
    const wearL = svgEl(doc, 'path', 'hud-qwfill');
    wearL.setAttribute('d', `M ${WEAR_L}`);
    const wearR = svgEl(doc, 'path', 'hud-qwfill');
    wearR.setAttribute('d', `M ${WEAR_R}`);
    for (const p of [wearL, wearR]) { p.setAttribute('stroke-dasharray', String(WEAR_LEN)); p.setAttribute('stroke-dashoffset', '0'); }
    gauge.append(track, wearL, wearR);
    const count = el('span', 'hud-qcount');
    cell.append(body, gauge, count);
    diamond.append(cell);
    return { cell, icon, init, wear: [wearL, wearR], count };
  };
  const cells = { c1: cellOf('c1'), off: cellOf('off'), main: cellOf('main'), c2: cellOf('c2') };
  const tags = {};
  for (const [slot, at] of [['c1', 'top'], ['off', 'left'], ['main', 'right'], ['c2', 'bottom']]) {
    const tag = el('span', `hud-qstag hud-qs${at}`);
    const img = el('img', 'hud-qsglyph');
    img.alt = '';
    const text = el('span', 'hud-qstext');
    tag.append(img, text);
    diamond.append(tag);
    tags[slot] = { tag, img, text };
  }
  quick.append(cap, diamond);
  root.append(quick);
  // DEPARTURE 2 (see the header): the only listeners this readout owns.
  // Bound once, reading the LIVE options bag - a frame binds nothing.
  // AUDIT QS F8: a FINGER, not a mouse that happens to live on a
  // machine with a touchscreen - Chromium answers `pointer: coarse` for
  // one, and a mouse click on the diamond swallowed a swing.
  const finger = (e) => !(e && e.pointerType != null && e.pointerType !== 'touch' && e.pointerType !== 'pen');
  const tap = (fn) => (e) => {
    if (!finger(e)) return;
    e?.preventDefault?.(); fn();
  };
  // QS6 - THE FINGER HOLDS TOO. Mac asked for one key that does two
  // things - a tap performs the slot, a hold cycles what is in it - and
  // a phone has no key to hold. The cells ARE the phone's keys (that is
  // DEPARTURE 2's whole claim), so they carry the same pair, on the same
  // two numbers the frame's machine uses, over the model's one cycle.
  // The entity is the one the last frame drew, which is the one the
  // player is.
  // AUDIT QS6 F3 - THE FINGER'S TIMERS MUST DIE WITH THE HUD. A hold that is
  // still cycling when a host tears the HUD down (a fast travel, a scene
  // change) left its `setInterval` running for the life of the page: the node
  // is gone, so no `pointerup` can ever reach it. It is held here so
  // `destroyEnhancedHud` can stop it, which is the same law QS3 stated for
  // the listeners ("the bound-once handlers went with the nodes").
  const holdTap = (slot, act) => {
    let arm = null; let step = null; let cycled = false;
    const stop = () => { clearTimeout(arm); clearInterval(step); arm = null; step = null; };
    const turn = () => { cycleQuickslot(slot, { entity: liveEntity }); last.quick = null; last.qspell = null; };
    return {
      down(e) {
        if (!finger(e)) return;
        e?.preventDefault?.();
        stop();
        cycled = false;
        arm = setTimeout(() => { cycled = true; turn(); step = setInterval(turn, QUICK_STEP_MS); }, QUICK_HOLD_MS);
      },
      up(e) {
        if (!finger(e)) return;
        const held = cycled;
        stop();
        // A HOLD IS NOT A PRESS: the choosing was the act.
        if (!held) act();
      },
      off() { stop(); cycled = true; },   // the finger left the cell: neither press nor further turn
    };
  };
  const bindHold = (node, slot, act) => {
    const h = holdTap(slot, act);
    holds.push(h);   // AUDIT QS6 F3: a teardown has to be able to stop them
    node.addEventListener('pointerdown', h.down);
    node.addEventListener('pointerup', h.up);
    node.addEventListener('pointercancel', h.off);
    node.addEventListener('pointerleave', h.off);
  };
  bindHold(cells.c1.cell, 'c1', () => liveOpts.quickUse?.(1));
  bindHold(cells.c2.cell, 'c2', () => liveOpts.quickUse?.(2));
  bindHold(spellChip, 'spell', () => liveOpts.quickSpell?.());
  // QS4: the off cell presses what it SHOWS - the swap where it offers
  // one, the off hand's own light act everywhere else. It does NOT hold:
  // what the off hand offers is whatever is in that hand, not a list.
  cells.off.cell.addEventListener('pointerdown', tap(() => {
    if (offKind === 'swap') liveOpts.quickSwap?.(); else liveOpts.quickOffHand?.();
  }));
  // MAC-R3 (Mac: "Tapping the equip hand in the quickbar doesn't switch to
  // your other weapon in hand (still bound to H)"): the MAIN cell is the
  // weapon in hand, and a hand cell's own act is the other hand - DFU's
  // SwitchHand. It does not hold: what is in the hand is not a list.
  cells.main.cell.addEventListener('pointerdown', tap(() => { liveOpts.quickSwitchHand?.(); }));

  doc.body.append(root);
  return { root, compass, marks, detectMarks: [], foe, foeName, foeFill, foeBladeFull, magicka, health, fatigue, effects, needs,
    breath, breathFill, readied, reticle, cross, centreWord, cornerWord,
    quick, quickCells: cells, quickTags: tags,
    spellChip: { chip: spellChip, tag: spellTag, img: spellGlyph, text: spellText, name: spellName } };
}

/** DEPARTURE 2's two module variables: the bag the bound-once handlers
 *  read, and what is standing in the off hand - a tap on that cell is a
 *  swap only while a swap is what it offers. */
let liveOpts = {};
let offKind = null;
/** The entity whose diamond this is - `inventoryItemImage` picks a
 *  clothing or armour archive by who wears it, and the inventory
 *  window passes the same identity, so the two draw the same picture. */
let liveEntity = null;
/** AUDIT QS6 F3: the finger-hold handles, so a teardown can stop a timer
 *  the removed node can no longer deliver a `pointerup` to. */
const holds = [];

/** Below this the durability strip takes the health bar's red. DFU's
 *  own repair prompt has no such line - this is the port's, and it is
 *  the one number the strip exists to warn about. */
export const QUICK_WORN_PCT = 40;

/** QS5 - THE GAUGE'S GEOMETRY, in the cell's own 100x100 box. The
 *  rhombus has its corners at the edge midpoints, so its lower two
 *  edges run (0,50) - (50,100) - (100,50); the gauge is that V drawn
 *  INSIDE the frame (a stroke on the boundary itself would be halved by
 *  the cell's clip-path), each half starting at the bottom point so the
 *  two drain together. WEAR_LEN is the half's length - the hypotenuse
 *  of a 44 by 44 triangle - and the dash offset is what the condition
 *  writes. */
const WEAR_INSET = 44;
const WEAR_L = `50 ${50 + WEAR_INSET} L ${50 - WEAR_INSET} 50`;
const WEAR_R = `50 ${50 + WEAR_INSET} L ${50 + WEAR_INSET} 50`;
const WEAR_LEN = Math.round(Math.hypot(WEAR_INSET, WEAR_INSET) * 10) / 10;

/** The item's kind, for "has this cell's picture changed" - the
 *  quickslot model's own key, which is the fields that make two records
 *  the same thing to a player. Condition is not in it, so a weapon
 *  taking a knock does not re-request its icon sixty times. */
const iconKeyOf = (item) => (item ? quickslotKey(item) : '');

/** itemTile's own fallback (enhancedInventory.js): two letters, in the
 *  pixel face, when neither icon lands. */
const initialsOf = (name) => String(name ?? '').split(/\s+/).filter(Boolean)
  .map((w) => w[0]).join('').slice(0, 2).toUpperCase();

/**
 * One frame. Called from drawHud, with what drawHud already has.
 *
 * `vitals` is the player entity (drawHud's own argument), `heading01`
 * the same heading the classic compass scrolls by.
 *
 * `opts`, all of them optional and all of them drawHud's own:
 *   hidden          - the HUD is off or covered; the overlay is TOLD
 *   readied         - the readied spell, for the caption chip
 *   weapon          - the weapon in hand, the diamond's main cell
 *   weaponSheathed  - and whether it is put away (QS3)
 *   detected        - the Detect markers over the compass
 *   playerXZ        - where they are measured from
 *   quickUse(n)     - the phone's tap on consumable slot n (QS3)
 *   quickSwap()     - and on the off hand while it offers a swap
 *   quickOffHand()  - the off hand's own press in every other state (QS4)
 */
export function drawEnhancedHud(vitals, heading01, dt = 0, opts = {}) {
  const { hidden = false } = opts;
  if (typeof document === 'undefined') return;
  if (!host) { parts = build(document); host = parts.root; }
  tickFoeTarget(dt);
  if (hidden) {
    if (last.hidden !== true) { last.hidden = true; host.style.display = 'none'; }
    return;
  }
  if (last.hidden !== false) { last.hidden = false; host.style.display = ''; }

  // PX30c: the scale, as a CSS variable the whole sheet reads - so one
  // write moves every bar, chip and letter together rather than
  // thirty. Guarded, like every other write here.
  const scale = enhancedHudScale();
  if (last.scale !== scale) {
    last.scale = scale;
    host.style.setProperty('--hud-scale', String(scale));
    // HN1: the damage numbers read the same scale, on their own layer.
    document.getElementById('enhanced-hitnums')?.style.setProperty('--hud-scale', String(scale));
    // AUDIT FONT F2: ...and so does the mid-screen label, a layer of
    // its own beside this one that never INHERITED the variable - a
    // sibling of `.hud` on document.body, not a child of it. (The
    // popup column this once scaled too is a toast in the notice stack
    // since ENH-NOTICE3, at the box's size, and takes no HUD scale.)
    setEnhancedMidTextScale(scale, document);
  }

  // THE COMPASS. Each point is placed by the same shortest-way-round
  // law, and one off the span is hidden rather than clamped to an edge
  // - a marker pinned to the rim says "north is exactly there", which
  // is a lie the classic compass takes care not to tell either.
  for (const m of parts.marks) {
    const at = compassPlace(Number(m.dataset.at), heading01);
    if (at === null) {
      if (m.style.display !== 'none') m.style.display = 'none';
    } else {
      if (m.style.display === 'none') m.style.display = '';
      const l = `${(at * 100).toFixed(1)}%`;
      if (m.style.left !== l) m.style.left = l;
    }
  }
  // ...and the Detect markers over the same strip.
  drawDetectMarkers(opts.detected ?? null, opts.playerXZ ?? null, heading01);

  // THE TARGET, when there is one.
  const t = foeTarget();
  if (!t) {
    if (last.foe !== null) { last.foe = null; parts.foe.classList.remove('on'); }
  } else {
    if (last.foe !== t.name) { last.foe = t.name; parts.foe.classList.add('on'); }
    put(parts.foeName, 'foeName', t.name);
    const foePct = (t.health / t.maxHealth) * 100;
    width(parts.foeFill, 'foeFill', foePct);
    // FOEBAR1: the blade face, when the pref says so - the class picks
    // which of the two children shows, and the red picture is clipped in
    // from both tips by the same fraction the plain fill gives up.
    const blade = getPref('foeBarStyle') === 'blade';
    if (last.foeStyle !== blade) { last.foeStyle = blade; parts.foe.classList.toggle('blade', blade); }
    if (blade) clipInset(parts.foeBladeFull, 'foeBlade', bladeInset(foePct));
    const o = t.fade < 1 ? String(t.fade.toFixed(2)) : '';
    if (parts.foe.style.opacity !== o) parts.foe.style.opacity = o;
  }

  // THE VITALS. maxFatigue is the (Str+End)x64 ceiling the classic
  // bars already use; this reads the same snapshot drawHud composed.
  // PX30d (Mac: "the stamina percentage is a super large percentage"):
  // FATIGUE HAS NO FIELD, IT HAS A LAW. DFU stores fatigue x64 and
  // computes the ceiling as (Strength + Endurance) x 64 - there is no
  // `maxFatigue` on the entity at all, so `vitals.maxFatigue || 1`
  // divided by ONE and a real player read 576000%.
  //
  // The classic HUD never had this bug because it composes a snapshot
  // with `maxFatigue(vitals)` in it (hud.js's `cur`, S15's own line) -
  // and my branch returns BEFORE that snapshot is built, so it was
  // reading the raw entity while the classic read the law. The same
  // law, from the same module, is the fix.
  const rows = [
    ['magicka', parts.magicka, vitals.magicka ?? 0, vitals.maxMagicka || 1],
    ['health', parts.health, vitals.health ?? 0, vitals.maxHealth || 1],
    ['fatigue', parts.fatigue, vitals.fatigue ?? 0, maxFatigue(vitals) || vitals.maxFatigue || 1],
  ];
  for (const [key, part, now, max] of rows) {
    const pct = (now / max) * 100;
    width(part.fill, `${key}W`, pct);
    // A percentage, rounded the way a player reads it - and never 0%
    // while there is anything left, because "0%" on a living bar is
    // the same lie "0 min" would have been on the quest timer.
    // Clamped to 100 as well as floored at 1: a bar cannot be more
    // than full, and a number that says otherwise is a bug wearing a
    // percent sign rather than something a player should have to read.
    const shown = now > 0 ? Math.max(1, Math.min(100, Math.round(pct))) : 0;
    put(part.num, `${key}N`, `${shown}%`);
  }

  // THE BREATH. DFU's own two laws: drawn only while holding breath,
  // and short below (endurance >> 3) + 4.
  const held = vitals.currentBreath ?? 0;
  const showBreath = held > 0;
  if (last.breathOn !== showBreath) {
    last.breathOn = showBreath;
    parts.breath.classList.toggle('on', showBreath);
  }
  if (showBreath) {
    const mb = maxBreath(vitals) || 1;
    width(parts.breathFill, 'breathW', (held / mb) * 100);
    const short = breathShortThreshold(liveStat(vitals, 'endurance')) > held;
    if (last.breathShort !== short) {
      last.breathShort = short;
      parts.breath.classList.toggle('short', short);
    }
  }

  // THE READIED SPELL, the diamond's second caption chip. It is still
  // drawn ONLY when one is readied - PX30b's law holds for a chip that
  // carries a NAME, which says nothing at all when there is no spell.
  // (The cells below are a different case; see the header.)
  const readySpell = opts.readied ?? null;
  // QS6: ...and NOT when the spell in hand is the one the spell chip is
  // already naming. Two chips a hand's width apart carrying the same
  // word is not a readout, it is a stutter - the chip below says it is
  // readied by lighting up, which is one thing said once.
  const slotSpell = spellQuickslot();
  const doubled = !!readySpell && !!slotSpell && slotSpell.index === readySpell.index;
  const readyName = readySpell && !doubled ? String(readySpell.name ?? '') : null;
  if (last.readied !== readyName) {
    last.readied = readyName;
    parts.readied.classList.toggle('on', !!readyName);
    parts.readied.textContent = '';
    if (readyName) {
      parts.readied.append(el('span', 'hud-readykind', 'Ready'), el('span', 'hud-readyname', readyName));
    }
  }

  // ── QS3: THE QUICKSLOT DIAMOND ──────────────────────────────────
  drawQuickslots(vitals, opts);

  // THE RETICLE, on the classic's own laws. The cursor up hides it all,
  // as the classic hides its own (the whole HUD is hidden then).
  const style = interactionIconStyle();
  const asCross = iconReplacesCrosshair(style);
  const mode = getInteractionMode();
  const label = MODE_LABEL[mode] ?? '';
  const showCross = crosshairEnabled() && !(asCross && mode !== 'grab');
  const showCentreWord = crosshairEnabled() && asCross && mode !== 'grab' && !!label;
  const showCorner = !asCross && modeIconEnabled(style) && !!label;
  const rk = `${showCross}|${showCentreWord ? label : ''}|${showCorner ? label : ''}`;
  if (last.reticle !== rk) {
    last.reticle = rk;
    parts.cross.style.display = showCross ? '' : 'none';
    parts.centreWord.textContent = showCentreWord ? label : '';
    parts.centreWord.style.display = showCentreWord ? '' : 'none';
    parts.cornerWord.textContent = showCorner ? label : '';
    parts.cornerWord.style.display = showCorner ? '' : 'none';
  }

  // THE EFFECTS. Rebuilt only when the SET changes - a countdown that
  // ticks every round would otherwise rebuild the row every frame.
  const eff = effectRows(vitals);
  const key = eff.map((e) => `${e.name}:${e.rounds}`).join('|');
  if (last.effects !== key) {
    last.effects = key;
    parts.effects.textContent = '';
    for (const e of eff) {
      const chip = el('div', `hud-eff${e.expiring ? ' expiring' : ''}${e.item ? ' item' : ''}`);
      chip.append(el('span', 'hud-effname', e.name));
      if (Number.isFinite(e.rounds)) chip.append(el('span', 'hud-effrounds', String(e.rounds)));
      parts.effects.append(chip);
    }
  }
  // SURV5: THE NEEDS STRIP - one chip a felt need (survival/status.js), rebuilt when the set changes; empty while every need is met, and gone with the switch
  const chips = survivalOn() ? survivalHudChips(vitals, Math.floor(worldMinutes()), { vampire: !!liveVampirism(vitals), endurance: liveStat(vitals, 'endurance') }) : [];   // AUDIT SURV C: the vampire's strip, the page's drunk bands
  const nkey = chips.map((c) => `${c.key}:${c.text}:${c.level}`).join('|');
  if (last.needs !== nkey) {
    last.needs = nkey;
    parts.needs.textContent = '';
    for (const c of chips) parts.needs.append(el('div', `hud-need ${c.level}`, c.text));
  }
}

/**
 * QS3 - ONE FRAME OF THE DIAMOND.
 *
 * A SIGNATURE FIRST. Everything the four cells and the four tags can
 * say is folded into one string, and an unchanged string skips every
 * write below it - the same law the rest of this file keeps, applied
 * once to a block of twenty nodes rather than twenty times over.
 */
function drawQuickslots(vitals, opts) {
  liveOpts = opts;
  liveEntity = vitals ?? null;
  const view = quickslotView(vitals, { weapon: opts.weapon ?? null, sheathed: opts.weaponSheathed ?? false,
    readiedIndex: opts.readied?.index ?? null });   // QS6: the chip lights for the spell actually in hand
  offKind = view.off.kind;
  // THE PAD'S FAMILY, not the input layer's local: `controllerLook` is
  // GP1's own importable latch for "the last input was the pad", and
  // padGlyphs holds which kind of pad it is.
  const family = padFamily();
  const controller = controllerLook() && !!family;
  const tagOpts = { bindings: bindings(), controller, family: family ?? 'xbox' };
  const tags = {
    main: quickslotTag(CELL_ACTIONS.main, tagOpts),
    off: quickslotOffTag(view.off.kind, tagOpts),
    c1: quickslotTag(CELL_ACTIONS.c1, tagOpts),
    c2: quickslotTag(CELL_ACTIONS.c2, tagOpts),
    spell: quickslotSpellTag(tagOpts),   // QS6
  };
  // TI2: a FIXED virtual stick sits bottom-left at inset 36 radius 56,
  // which is this block's own corner - so the block steps right of it,
  // by a class rather than by a second set of coordinates.
  const fixedStick = getPref('touchStickAnchor') === 'fixed';
  if (last.qstick !== fixedStick) {
    last.qstick = fixedStick;
    parts.quick.classList.toggle('stickclear', fixedStick);
  }
  // THE SWITCH (systems/features.js 'quickslot-diamond'): off hides the
  // diamond and its tags, and nothing else - the caption keeps the mode
  // word, the keys keep working, the tooltip keeps filling slots. A
  // player who turned the picture off did not ask to lose the presses.
  const off = getPref('quickslots') === false;
  if (last.qoff !== off) {
    last.qoff = off;
    parts.quick.classList.toggle('nodiamond', off);
  }
  // QS6: THE SPELL CHIP, above the `off` return - it is the caption's,
  // and the caption is what the switch keeps. Its own guard, because a
  // spell name changing is not a reason to rewrite twenty cells.
  drawSpellChip(view, tags.spell);
  if (off) return;
  const pct = (c) => (Number.isFinite(c) ? String(Math.round(c)) : '');
  const m = view.main, o = view.off;
  const sig = [
    m ? `${m.name}|${pct(m.condition)}|${m.sheathed ? 1 : 0}` : '',
    `${o.kind}|${o.name ?? ''}|${pct(o.condition)}|${o.item ? 1 : 0}`,
    ...['c1', 'c2'].map((k) => (view[k] ? `${view[k].name}|${view[k].count}` : '')),
    ...['main', 'off', 'c1', 'c2'].map((k) => tagKey(tags[k])),
    // AUDIT QS6 F4: THE LAMP IS PART OF WHAT THE BLOCK SAYS. It was written
    // below the early return, so it came on with the cycle that changed a
    // name and then NEVER WENT OUT - nothing else changes when a hold ends,
    // so the signature was identical and the write was unreachable. A cell
    // left glowing is a cell that lies about what the thumb is doing.
    quickslotCycling() ?? '',
  ].join('~');
  if (last.quick === sig) return;
  last.quick = sig;

  quickCell(parts.quickCells.main, 'main', {
    item: m?.item ?? null, name: m?.name ?? null, condition: m ? m.condition : null,
    socket: !m, sheathed: !!m?.sheathed, ghost: false, count: null,
  });
  quickCell(parts.quickCells.off, 'off', {
    item: o.item, name: o.name, condition: o.condition,
    socket: o.kind === 'empty', sheathed: false, ghost: o.kind === 'swap' && !o.item && !o.bare, count: null,
  });
  for (const k of ['c1', 'c2']) {
    const c = view[k];
    quickCell(parts.quickCells[k], k, {
      item: c?.item ?? null, name: c?.name ?? null, condition: null,
      socket: !c, sheathed: false, ghost: !!c && c.count === 0, count: c ? c.count : null,
    });
  }
  for (const k of ['main', 'off', 'c1', 'c2']) quickTag(parts.quickTags[k], k, tags[k]);
  // QS6: the cell a hold is turning right now wears the lamp, so a
  // player watching the diamond sees which slot their thumb is in.
  const lamp = quickslotCycling();
  if (last.qlamp !== lamp) {
    last.qlamp = lamp;
    for (const k of ['c1', 'c2']) parts.quickCells[k].cell.classList.toggle('cycling', lamp === k);
  }
}

/** QS6 - THE CAPTION'S SPELL CHIP: the key that readies it, the name,
 *  and three states - EMPTY (nothing chosen yet, so nothing is drawn),
 *  a GHOST (a spell the book no longer holds), and READIED (it is in
 *  hand, and the same press puts it away). */
function drawSpellChip(view, tag) {
  const sp = view.spell;
  const lamp = quickslotCycling() === 'spell';
  const sig = sp ? `${sp.index}|${sp.name}|${sp.spell ? 1 : 0}|${sp.readied ? 1 : 0}|${lamp ? 1 : 0}|${tagKey(tag)}` : `-|${tagKey(tag)}`;
  if (last.qspell === sig) return;
  last.qspell = sig;
  const chip = parts.spellChip;
  chip.chip.classList.toggle('on', !!sp);
  // HOTSLOT (2026-09-22): an EMPTY slot is a socket, as the diamond's
  // cells are (departure 4) - drawn dim with its key, so the key is
  // seen and, on a phone, the first tap has a chip to land on (the
  // tap fills it from the book: spellQuickslotPress). Hidden, the slot
  // could never be filled without a keyboard.
  chip.chip.classList.toggle('empty', !sp);
  if (!sp) {
    chip.chip.classList.remove('readied', 'ghost', 'cycling');
    chip.name.textContent = 'No spell';
    quickTag(chip, 'spellcap', tag);
    return;
  }
  chip.chip.classList.toggle('readied', !!sp.readied);
  chip.chip.classList.toggle('ghost', !sp.spell);
  chip.chip.classList.toggle('cycling', lamp);
  chip.name.textContent = sp.name || '';
  quickTag(chip, 'spellcap', tag);
}

/** One cell's state, art, strip and count. Every write is guarded on
 *  its own key as well as the block's signature, because a condition
 *  that ticked is not a reason to re-request a picture. */
function quickCell(part, slot, s) {
  const cls = part.cell.classList;
  const state = `${s.socket ? 's' : ''}${s.sheathed ? 'h' : ''}${s.ghost ? 'g' : ''}`;
  if (last[`${slot}State`] !== state) {
    last[`${slot}State`] = state;
    cls.toggle('socket', !!s.socket);
    cls.toggle('sheathed', !!s.sheathed);
    cls.toggle('ghost', !!s.ghost);
  }
  quickIcon(part, slot, s.socket ? null : s.item, s.name);
  // THE DURABILITY STRIP, on the hands only - a potion has no condition
  // a player can act on and the model hands none. For a TORCH it is
  // what is left to burn: Handheld Torches burns currentCondition down,
  // so `conditionPercentage` already says exactly that.
  const hasBar = !s.socket && Number.isFinite(s.condition);
  if (last[`${slot}Bar`] !== hasBar) { last[`${slot}Bar`] = hasBar; cls.toggle('hasbar', hasBar); }
  if (hasBar) {
    // The dash hides what is GONE, from each side corner inward, so what
    // is left stands at the bottom point of the diamond.
    const off = (WEAR_LEN * (1 - Math.max(0, Math.min(100, s.condition)) / 100)).toFixed(1);
    if (last[`${slot}BarW`] !== off) {
      last[`${slot}BarW`] = off;
      for (const p of part.wear) p.setAttribute('stroke-dashoffset', off);
    }
    const worn = s.condition < QUICK_WORN_PCT;
    if (last[`${slot}Worn`] !== worn) { last[`${slot}Worn`] = worn; cls.toggle('worn', worn); }
  }
  // THE COUNT - and a ghost still draws its 0, which is the whole point
  // of a slot that keeps its kind when the pack runs out.
  put(part.count, `${slot}Count`, s.socket || s.count == null ? '' : String(s.count));
}

/** The cell's picture: the Morrowind ground mesh where the rig has one
 *  (MW-D38), else the classic icon, else the two letters. Requested
 *  only when the cell's ITEM changed; a record that lands cold marks
 *  the block dirty so the NEXT frame draws it, rather than rebuilding
 *  anything from inside a render. */
function quickIcon(part, slot, item, name) {
  const key = iconKeyOf(item);
  if (last[`${slot}Icon`] === key) return;
  last[`${slot}Icon`] = key;
  const image = item ? inventoryItemImage(item, liveEntity ?? undefined) : null;
  const src = item
    ? (modelIconUrl(item, 96, fpArm)
      || (image ? requestIcon(image.archive, image.record, { scale: 2, onReady: () => { last[`${slot}Icon`] = null; last.quick = null; } }) : null))
    : null;
  // NO WIDTH ATTRIBUTE, for enhancedInventory itemTile's own reason: a
  // dagger is tall and narrow and a cuirass wide, and forcing a square
  // squashes every one of them. The sheet caps both axes instead.
  if (src) { part.icon.src = src; part.icon.style.display = ''; }
  else { part.icon.removeAttribute('src'); part.icon.style.display = 'none'; }
  const letters = !src && item ? initialsOf(name) : '';
  part.init.textContent = letters;
  part.init.style.display = letters ? '' : 'none';
}

/** One tag chip: the pad's glyph, the key's classic name, or nothing at
 *  all. Keyed by a string, so a frame that changed neither writes
 *  neither - and an UNBOUND action writes nothing, never 'NONE'. */
function quickTag(part, slot, t) {
  const k = tagKey(t);
  if (last[`${slot}Tag`] === k) return;
  last[`${slot}Tag`] = k;
  part.tag.classList.toggle('on', !!t);
  // The chip's KIND is a class, so the touch-first sheet can hide a
  // keyboard chip on a device with no keyboard and keep a pad's glyph.
  part.tag.classList.toggle('key', !!t && t.kind === 'key');
  part.tag.classList.toggle('glyph', !!t && t.kind === 'glyph');
  if (t && t.kind === 'glyph') {
    part.img.src = glyphSvg(t.family, t.code, { size: 12 }) ?? '';
    part.img.style.display = '';
    part.text.textContent = '';
  } else {
    part.img.removeAttribute('src');
    part.img.style.display = 'none';
    part.text.textContent = t ? t.text : '';
  }
}

/** A host tearing down. */
export function destroyEnhancedHud() {
  for (const h of holds) h.off();   // AUDIT QS6 F3: a finger mid-cycle does not outlive the HUD
  holds.length = 0;
  try { host?.remove(); } catch { /* already gone */ }
  host = null; parts = null;
  liveOpts = {}; offKind = null; liveEntity = null;   // QS3: the bound-once handlers went with the nodes
  for (const k of Object.keys(last)) delete last[k];
}

export { compassScroll };
