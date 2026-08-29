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
import { activeSpellIcons, maxRoundsRemaining } from './hudActiveSpells.js';
import { liveBundles } from '../systems/mysticism.js';   // PX30: the ONE bundle walk the HUD already uses
import { compassScroll } from './hud.js';
import { foeTarget, tickFoeTarget } from './hudFoeTarget.js';

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
  const bars = el('div', 'hud-bars');
  const vital = (kind, label) => {
    const wrap = el('div', `hud-vital hud-${kind}`);
    const track = el('div', 'hud-track');
    const fill = el('i', 'hud-fill');
    track.append(fill);
    const num = el('span', 'hud-num');
    wrap.append(track, num);
    wrap.title = label;
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
  root.append(bottom);

  doc.body.append(root);
  return { root, compass, marks, foe, foeName, foeFill, magicka, health, fatigue, effects };
}

/**
 * One frame. Called from drawHud, with what drawHud already has.
 *
 * `vitals` is the player entity (drawHud's own argument), `heading01`
 * the same heading the classic compass scrolls by.
 */
export function drawEnhancedHud(vitals, heading01, dt = 0, { hidden = false } = {}) {
  if (typeof document === 'undefined') return;
  if (!host) { parts = build(document); host = parts.root; }
  tickFoeTarget(dt);
  if (hidden) {
    if (last.hidden !== true) { last.hidden = true; host.style.display = 'none'; }
    return;
  }
  if (last.hidden !== false) { last.hidden = false; host.style.display = ''; }

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
  const rows = [
    ['magicka', parts.magicka, vitals.magicka ?? 0, vitals.maxMagicka || 1],
    ['health', parts.health, vitals.health ?? 0, vitals.maxHealth || 1],
    ['fatigue', parts.fatigue, vitals.fatigue ?? 0, vitals.maxFatigue || 1],
  ];
  for (const [key, part, now, max] of rows) {
    width(part.fill, `${key}W`, (now / max) * 100);
    put(part.num, `${key}N`, `${Math.round(now)}`);
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
