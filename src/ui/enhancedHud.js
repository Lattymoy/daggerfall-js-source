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
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { mountHitNumbers } from './hitNumbers.js';   // HN1
import { activeSpellIcons, maxRoundsRemaining } from './hudActiveSpells.js';
import { liveBundles } from '../systems/mysticism.js';   // PX30: the ONE bundle walk the HUD already uses
import { getPref } from '../systems/uiPrefs.js';   // PX30c: the port's own prefs, not DFU's settings
import { compassScroll, breathShortThreshold, compassMarkerLerp, DETECT_MARKER_RGB } from './hud.js';
import { maxBreath, maxFatigue, liveStat } from '../systems/statMods.js';   // PX30b/PX30d: DFU's own ceilings
// (breathShortThreshold lives in hud.js, imported below with compassScroll)
import { foeTarget, tickFoeTarget } from './hudFoeTarget.js';
// PX32: the reticle's LAWS are the classic module's - which setting shows
// a crosshair, which style makes the mode word the crosshair, which
// styles show a corner word - imported rather than restated.
import { crosshairEnabled, interactionIconStyle, iconReplacesCrosshair, modeIconEnabled, MODE_LABEL } from './hudCrosshair.js';
import { getInteractionMode } from '../player/interactionMode.js';

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
  foe.append(foeName, foeTrack);
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
  // PX30b: WHAT IS IN YOUR HANDS. The reference's ability bar has no
  // Daggerfall equivalent - there are no hotkeyed abilities - but the
  // two things it would hold do exist: the spell you have READIED and
  // the weapon you are holding. Two plaques, and each only when there
  // is one.
  const hands = el('div', 'hud-hands');
  const readied = el('div', 'hud-hand hud-readied');
  const weapon = el('div', 'hud-hand hud-weapon');
  hands.append(readied, weapon);
  bottom.append(hands);
  const effects = el('div', 'hud-effects');
  bottom.append(effects);
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
  const cornerWord = el('span', 'hud-modeword hud-modecorner');
  root.append(cornerWord);

  doc.body.append(root);
  return { root, compass, marks, detectMarks: [], foe, foeName, foeFill, magicka, health, fatigue, effects,
    breath, breathFill, readied, weapon, reticle, cross, centreWord, cornerWord };
}

/**
 * One frame. Called from drawHud, with what drawHud already has.
 *
 * `vitals` is the player entity (drawHud's own argument), `heading01`
 * the same heading the classic compass scrolls by.
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
    width(parts.foeFill, 'foeFill', (t.health / t.maxHealth) * 100);
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

  // THE HANDS. Each plaque only when there is something in it - an
  // empty one is the drawn-door bug, and a HUD is the worst place for
  // furniture that says nothing.
  const readySpell = opts.readied ?? null;
  const readyName = readySpell ? String(readySpell.name ?? '') : null;
  if (last.readied !== readyName) {
    last.readied = readyName;
    parts.readied.classList.toggle('on', !!readyName);
    parts.readied.textContent = '';
    if (readyName) {
      parts.readied.append(el('span', 'hud-handkind', 'Ready'), el('span', 'hud-handname', readyName));
    }
  }
  const held2 = opts.weapon ?? null;
  const weaponName = held2 ? String(held2.name ?? '') : null;
  if (last.weapon !== weaponName) {
    last.weapon = weaponName;
    parts.weapon.classList.toggle('on', !!weaponName);
    parts.weapon.textContent = '';
    if (weaponName) {
      parts.weapon.append(el('span', 'hud-handkind', 'Hand'), el('span', 'hud-handname', weaponName));
    }
  }

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
}

/** A host tearing down. */
export function destroyEnhancedHud() {
  try { host?.remove(); } catch { /* already gone */ }
  host = null; parts = null;
  for (const k of Object.keys(last)) delete last[k];
}

export { compassScroll };
