// @ts-check
// WB9a (2026-09-30, Mac: "Can we add the modifers below his health bar? Allow people to see the modifers/trial as a
// popup before it starts."): THE WARDEN'S MARKS, SEEN. WB8b gave him an aspect and two trials every gate and said them
// in words - the omen's chat line, the map's card, a line as a fighter steps through, the names joined on a line of the
// bar. None of it said what a mark DOES while the fight was on, and nothing showed them before the step. Now:
//
//   - UNDER HIS BAR, a row of the night's marks: each its sign, its name and its one line (his aspect's element in its
//     own colour first, then his two trials) - read at a glance, all fight long (ui/gateBossBar.js draws the row from
//     `marksViewOf`).
//   - THE MARKS' CARD, a popup over the screen: near the gate before it is entered (while it stands, from the omen's
//     ground - scenes/gatePool.js), and as a fighter steps into the court, before he moves (net/gateBrain.js OPENING_MS
//     is the time to read it). Each mark with its sign, its line, and how to meet it. GATE-UX: never over the middle of
//     the screen - to the side in both places (MARKS_CARD_CSS).
//
// A READOUT, NOT A WINDOW (the gate banner's and the bar's law): no click, no overlay stack, no key taken - a popup that
// can never trap a fighter in a fight. One node made on the first card and UPDATED, NOT REBUILT: each part written only
// when the marks it shows change; hidden with the HUD.
//
// The signs are the port's own, drawn as paths (no font, no raster): the flame, the snowflake, the bolt and the drop for
// the aspects; a sign for each trial. Pure where it can be - `marksViewOf` and `marksCardModel` are the pins' door.
//
// Not a DFU member. Ledger A (WB).
import { readGateMods } from '../net/gateMods.js';
import { ASPECT_COLORS, EMBER_COLOR } from '../world/gateBoss.js';
import { injectEnhancedFonts } from './enhancedStyle.js';   // WB13c: the classic face, loaded by the gate's own screens

/** The element each aspect's blows carry, as a player names it. */
export const ASPECT_ELEMENT = Object.freeze({ burning: 'Fire', rime: 'Frost', storm: 'Lightning', venom: 'Poison' });
/**
 * HOW TO MEET EACH MARK - one line a mark, the card's advice (the tables' own `text` says what it does; this says what to
 * do about it). An aspect's is the saving throw WB8b made real: a resistance to its element softens every elemental blow
 * and all his ground (net/gateStrike.js blowOf, scenes/world.js GATE_SAVES).
 */
export const MARK_TIPS = Object.freeze({
  burning: 'Resist fire to blunt his flames and burning ground.',
  rime: 'Resist frost to blunt his frost and rime.',
  storm: 'Resist shock to blunt his lightning and scorched ground.',
  venom: 'Resist poison to blunt his venom and poisoned ground.',
  colossal: 'Give his Ground Slam a wider berth.',
  unyielding: 'Save your heaviest blows for when his ward falls.',
  vengeful: 'Heal before you run low.',
  scarring: 'Fight clear of the scarred floor.',
  grudge: 'If you hit hardest, expect him.',
  soulhungry: 'Keep each other standing.',
  favoured: 'Keep moving from the first phase.',
  echoing: 'Move as each meteor lands.',
  legion: 'Stop the Atronachs. Break the Ward-Bearers.',   // WB11a (AUDIT WB11 U1: as short as the others - 138 characters made the tallest card, off a landscape phone)
});

const hex = (c) => `#${c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('')}`;
/** An aspect's colour on the screen: his ember under it (world/gateBoss.js - the court's own fire for the Burning). */
export const aspectCss = (id) => hex(ASPECT_COLORS[id]?.ember ?? EMBER_COLOR);

/**
 * THE SIGNS - one path each on a 24-unit box, drawn in the text's colour. `fill` marks a solid sign (the rest are
 * stroked). The port's own shapes; nothing is loaded.
 */
export const MARK_ICONS = Object.freeze({
  burning: Object.freeze({ fill: true, d: 'M12 1.5c.9 3.2-.8 4.9-2 6.6-1 1.4-1.6 2.6-1 4 .5 1.1 1.7 1.6 2.6 1.1 1.2-.7 1.2-2.2.6-3.8 3.4 1.6 5.8 4.6 5.8 8.1A6 6 0 0 1 12 23.5a6 6 0 0 1-6-6c0-3.3 2.2-5.6 3.8-7.7C11.1 8 12.6 5.6 12 1.5z' }),
  rime: Object.freeze({ fill: false, d: 'M12 2v20M3.3 7l17.4 10M20.7 7L3.3 17M12 2l-2.2 2.4M12 2l2.2 2.4M12 22l-2.2-2.4M12 22l2.2-2.4M3.3 7l.7 3.1M3.3 7l3.1-.9M20.7 17l-.7-3.1M20.7 17l-3.1.9M20.7 7l-3.1-.9M20.7 7l-.7 3.1M3.3 17l3.1.9M3.3 17l.7-3.1' }),
  storm: Object.freeze({ fill: true, d: 'M13.5 1.5L4 13.8h6.4L8.7 22.5 20 9.4h-6.6l.1-7.9z' }),
  venom: Object.freeze({ fill: true, d: 'M12 1.8c2.6 4.4 7 8.6 7 13.2a7 7 0 0 1-14 0c0-4.6 4.4-8.8 7-13.2zm-2.4 12.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zm4.3 2.6a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2z' }),
  colossal: Object.freeze({ fill: true, d: 'M2 21.5l6.2-12.3 3.3 5.4 3.4-6.9 7.1 13.8z' }),
  unyielding: Object.freeze({ fill: true, d: 'M12 1.8l8.5 3.1v6.3c0 5.3-3.7 9.6-8.5 11-4.8-1.4-8.5-5.7-8.5-11V4.9z' }),
  vengeful: Object.freeze({ fill: false, d: 'M4 4l10.5 10.5M4 4l.8 3.6M4 4l3.6.8M20 4L9.5 14.5M20 4l-.8 3.6M20 4l-3.6.8M12.5 16.5l3.5 3.5M11.5 16.5L8 20M15 19l3 3M9 19l-3 3' }),
  scarring: Object.freeze({ fill: false, d: 'M12 1.5l-2.4 6.3 4.3 3.1-3.3 5.2 2 6.4M11.6 10.9l6.2-2.4M9.6 7.8L3.8 9.3M10.6 16.1l-5.2 2.6M13.9 10.9l3.1 6' }),
  grudge: Object.freeze({ fill: false, d: 'M1.8 12S5.6 4.8 12 4.8 22.2 12 22.2 12 18.4 19.2 12 19.2 1.8 12 1.8 12zM12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z' }),
  soulhungry: Object.freeze({ fill: true, d: 'M12 1.8c-5 0-8.5 3.5-8.5 8.1 0 2.9 1.4 4.9 3.3 6.1v3.3c0 1 .8 1.9 1.9 1.9h6.6c1.1 0 1.9-.9 1.9-1.9V16c1.9-1.2 3.3-3.2 3.3-6.1 0-4.6-3.5-8.1-8.5-8.1zM8.6 8.9a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm6.8 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM12 13.6l1.3 2.4h-2.6z' }),
  favoured: Object.freeze({ fill: true, d: 'M12 1.5l3 6.9 7.4.7-5.6 4.9 1.7 7.3L12 17.5l-6.5 3.8 1.7-7.3-5.6-4.9 7.4-.7z' }),
  echoing: Object.freeze({ fill: false, d: 'M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6zM12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19z' }),
  // WB11a: Legion-Lord - his host, three figures abreast
  legion: Object.freeze({ fill: false, d: 'M12 3.2a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8zM7.6 14.6c.6-3 2.3-4.6 4.4-4.6s3.8 1.6 4.4 4.6M5.4 8.6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM2.1 18.4c.5-2.5 1.7-3.7 3.3-3.7s2.8 1.2 3.3 3.7M18.6 8.6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM15.3 18.4c.5-2.5 1.7-3.7 3.3-3.7s2.8 1.2 3.3 3.7M2 21.4h20' }),
});
/** A sign as markup - static text of the port's own (no word of a player's ever reaches it), `size` pixels square. */
export function markIconSvg(id, size = 14) {
  const I = MARK_ICONS[id];
  if (!I) return '';
  const paint = I.fill ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path ${paint} d="${I.d}"/></svg>`;
}

/** SD18b: a mark's sign - its own path when it carries one (the Hour's marks - ui/sdMarksView.js), else the table's. */
export function markIconHtml(m, size = 14) {
  if (!m?.path) return markIconSvg(m?.id, size);
  const paint = m.fill ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path ${paint} d="${m.path}"/></svg>`;
}

/**
 * THE NIGHT'S MARKS AS THEY ARE SHOWN, from a fight's marks (`md` - the relay's word inside the court, the day's draw
 * outside: net/gateLaw.js gateModsOf) - or null for the Warden unmarked (an older relay's fight shows no row). The
 * aspect first, in its colour, then each trial in the tables' order as the word gave them. Made once a marks array and
 * kept (the bar asks every frame - AUDIT PRE-MERGE 0929 W2-2's law).
 * @param {unknown} md
 */
export function marksViewOf(md) {
  if (md == null || !Array.isArray(md) || !md.length) return null;
  const hit = _views.get(md);
  if (hit !== undefined) return hit;
  const { aspect, trials } = readGateMods(md);
  const view = Object.freeze({
    key: [aspect.id, ...trials.map((t) => t.id)].join(','),
    aspect: Object.freeze({ id: aspect.id, kind: 'aspect', name: aspect.name, epithet: aspect.epithet, element: ASPECT_ELEMENT[aspect.id] ?? 'Fire',
      text: aspect.omen, tip: MARK_TIPS[aspect.id] ?? '', color: aspectCss(aspect.id) }),
    trials: Object.freeze(trials.map((t) => Object.freeze({ id: t.id, kind: 'trial', name: t.name, text: t.text, tip: MARK_TIPS[t.id] ?? '' }))),
  });
  _views.set(md, view);
  return view;
}
/** The views made, by the marks array they were read from (arrays drop out with the states that hold them). */
const _views = new WeakMap();

/** The card's words. */
export const MARKS_CARD_TEXT = Object.freeze({
  title: 'The Warden\'s Marks',
  gate: (boss, epithet) => `${boss} comes ${epithet} tonight`,   // WB13b: one subtitle near the gate and inside
  arrive: (boss, epithet) => `${boss} comes ${epithet} tonight`,
  element: (el) => `His blows carry ${el.toLowerCase()}`,
});
/** The card, stepping through: how long it stands over the court before it has gone (its last MARKS_CARD_FADE_MS a fade). */
export const MARKS_CARD_ARRIVE_MS = 9000;
export const MARKS_CARD_FADE_MS = 700;
/** Where it stands - 'arrive' low on the right, clear of the crosshair and his bar (GATE-UX, 2026-10-01, Mac: "move
 *  the modifer panel that shows away from center of the screen, it's obstructive" - it stood over the middle of the
 *  court as the fight began), 'gate' to the side, under the compass line. */
export const MARKS_CARD_MODES = Object.freeze(['arrive', 'gate']);

/**
 * What the card shows now, or null (nothing to show): `mode` 'gate' near an unentered gate (no clock - it stands while
 * the player does), 'arrive' from the moment `since` a fighter stepped through, gone MARKS_CARD_ARRIVE_MS later.
 * @param {unknown} md @param {{name: string}} boss @param {{mode?: 'arrive'|'gate', since?: number, now?: number}} [o]
 */
export function marksCardModel(md, boss, { mode = 'arrive', since = 0, now = 0 } = {}) {
  const view = marksViewOf(md);
  if (!view || !boss) return null;
  let alpha = 1;
  if (mode === 'arrive') {
    const age = now - since;
    if (!(age >= 0) || age >= MARKS_CARD_ARRIVE_MS) return null;
    alpha = Math.min(1, age / 250, (MARKS_CARD_ARRIVE_MS - age) / MARKS_CARD_FADE_MS);
  }
  return {
    mode: mode === 'gate' ? 'gate' : 'arrive', key: view.key, alpha: Math.round(alpha * 100) / 100,
    title: MARKS_CARD_TEXT.title,
    sub: (mode === 'gate' ? MARKS_CARD_TEXT.gate : MARKS_CARD_TEXT.arrive)(boss.name, view.aspect.epithet),
    aspect: view.aspect, trials: view.trials,
  };
}

/** PLUS-DRESS's law: the card's look as classes, so a skin's sheet can dress it (ui/enhancedPlusStyle.js). */
export const MARKS_CARD_STYLE_ID = 'dagger-gate-marks-style';
export const MARKS_CARD_CSS = `
.wb-marks-card { position: fixed; pointer-events: none; z-index: 31; width: 400px; max-width: 86vw; box-sizing: border-box;
  padding: 12px 16px 10px; font: 600 13px 'Cormorant', Georgia, serif; letter-spacing: 0.04em; color: #f3d9c4;
  background: linear-gradient(180deg, rgba(34,6,3,0.93), rgba(14,3,2,0.9)); border: 1px solid rgba(255,120,60,0.6);
  box-shadow: 0 0 22px rgba(0,0,0,0.85), inset 0 0 18px rgba(120,20,6,0.45); text-shadow: 0 0 3px #000; }
.wb-marks-card.wb-marks-arrive { right: 18px; bottom: max(96px, 14vh); width: 340px; }
.wb-marks-card.wb-marks-gate { right: 18px; top: 104px; width: 340px; }
.wb-marks-title { font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; color: #ff8a4a; text-align: center; }
.wb-marks-sub { font-size: 16px; text-align: center; margin: 2px 0 8px; color: #ffe2c8; }
.wb-marks-row { display: flex; gap: 10px; align-items: flex-start; margin: 6px 0; }
.wb-marks-icon { flex: 0 0 22px; height: 22px; display: flex; align-items: center; justify-content: center; }
.wb-marks-body { flex: 1 1 auto; }
.wb-marks-name { font-size: 14px; letter-spacing: 0.1em; text-transform: uppercase; }
.wb-marks-text { font-size: 13px; opacity: 0.92; }
.wb-marks-tip { font-size: 13px; opacity: 0.85; color: #e9c9a6; }
/* AUDIT SD III (T3): the Hour's own - its brass and its light (ui/sdTitleCard.js), never Dagon's red */
.wb-marks-card.sd-brass { color: #f5e7c4; background: linear-gradient(180deg, rgba(30,22,8,0.93), rgba(12,9,4,0.9));
  border-color: rgba(232,192,96,0.6); box-shadow: 0 0 22px rgba(0,0,0,0.85), inset 0 0 18px rgba(110,80,20,0.45); }
.wb-marks-card.sd-brass .wb-marks-title { color: #e8c060; }
.wb-marks-card.sd-brass .wb-marks-sub { color: #fff1cf; }
.wb-marks-card.sd-brass .wb-marks-tip { color: #e6d2a6; }
/* AUDIT SD IV (T4): THE MESSAGE LINE OVER THE CARD - the card's corner reaches the line's band on a phone and on a
   laptop with the party up, and the word said as it begins (the Hour's and the court's "Your companions cannot follow")
   stood under it unread, wherever the player had moved the line: while the card stands, the line stands over it */
body:has(.wb-marks-card:not([style*="display: none"])) .hudmid { z-index: 32; }
/* WB13c: beside the party's frames where the screen holds both, never over them */
@media (min-width: 900px) {
  body:has(.dfparty:not([style*="display: none"])) .wb-marks-card { right: 220px; }
}
/* WB13c: on a phone held upright the party's frames hold the foot on the right - with them up, the card stands under
   his bar instead */
@media (max-width: 560px) {
  body:has(.dfparty:not([style*="display: none"])) .wb-marks-card.wb-marks-arrive { top: 200px; bottom: auto; }
}
/* WB13c: a phone held sideways: at the foot on the left - under his bar, clear of the crosshair and the party, never off
   the screen - the tips left to a wider one */
@media (max-height: 480px) {
  .wb-marks-card.wb-marks-arrive, .wb-marks-card.wb-marks-gate { left: 8px; right: auto; top: auto; bottom: 8px; width: min(340px, 42vw);
    max-height: calc(100vh - 16px); overflow: hidden; padding: 8px 12px 6px; }
  .wb-marks-sub { margin: 1px 0 4px; }
  .wb-marks-row { margin: 3px 0; }
  .wb-marks-tip { display: none; }
}
`;

let root = null, parts = null;
let shown = { vis: '', key: '', mode: '', alpha: -1, sub: '' };

function mark(doc) {
  const n = doc.createElement('div'); n.className = 'wb-marks-row';
  const icon = doc.createElement('div'); icon.className = 'wb-marks-icon';
  const body = doc.createElement('div'); body.className = 'wb-marks-body';
  const name = doc.createElement('div'); name.className = 'wb-marks-name';
  const text = doc.createElement('div'); text.className = 'wb-marks-text';
  const tip = doc.createElement('div'); tip.className = 'wb-marks-tip';
  body.append(name, text, tip);
  n.append(icon, body);
  return { n, icon, name, text, tip };
}

function build(doc) {
  if (doc.getElementById && !doc.getElementById(MARKS_CARD_STYLE_ID)) {
    const st = doc.createElement('style');
    st.id = MARKS_CARD_STYLE_ID;
    st.textContent = MARKS_CARD_CSS;
    (doc.head ?? doc.body)?.append(st);
    if (doc.head) injectEnhancedFonts(doc);   // WB13c: Cormorant on the classic skin too (it came only if another window had asked)
  }
  root = doc.createElement('div');
  root.className = 'wb-marks-card wb-marks-arrive';
  const title = doc.createElement('div'); title.className = 'wb-marks-title';
  const sub = doc.createElement('div'); sub.className = 'wb-marks-sub';
  const rows = [mark(doc), mark(doc), mark(doc)];
  root.append(title, sub, ...rows.map((r) => r.n));
  (doc.body ?? doc.documentElement)?.append(root);
  parts = { title, sub, rows };
}

/** Write one row: a mark's sign, name and lines - or hide it (no mark for it); a trial's sign in the card's own ring
 *  colour (`look` - AUDIT SD III, T3: the Hour's omens in its brass). */
function writeRow(r, m, first, look = 'gate') {
  if (!m) { r.n.style.display = 'none'; return; }
  r.n.style.display = '';
  r.icon.innerHTML = markIconHtml(m, 20);   // SD18b: the Hour's own signs
  r.icon.style.color = m.kind === 'aspect' ? m.color : look === 'brass' ? '#e8c060' : '#ffb27a';
  r.name.textContent = m.kind === 'aspect' ? `${m.name} - ${m.element}` : m.name;
  r.name.style.color = m.kind === 'aspect' ? m.color : '';
  r.text.textContent = m.text;
  r.tip.textContent = m.tip;
  r.n.style.marginTop = first ? '0' : '';
}

/** Draw the card for a model (null hides it); `hidden` is the HUD's own hide. */
export function drawGateMarksCard(model, { hidden = false, doc = globalThis.document } = {}) {
  const want = !hidden && !!model;
  if (!root) {
    if (!want || !doc?.createElement) return;
    build(doc);
  }
  const vis = want ? 'on' : 'off';
  if (vis !== shown.vis) { shown.vis = vis; root.style.display = want ? '' : 'none'; }
  if (!want || !model) return;
  const mode = `${model.mode}${model.look === 'brass' ? ' sd-brass' : ''}`;   // AUDIT SD III (T3): the Hour's card in its own brass
  if (mode !== shown.mode) { shown.mode = mode; root.className = `wb-marks-card wb-marks-${mode}`; }
  if (model.key !== shown.key) {
    shown.key = model.key;
    parts.title.textContent = model.title;
    const all = [model.aspect, ...model.trials];
    parts.rows.forEach((r, i) => writeRow(r, all[i] ?? null, i === 0, model.look));
  }
  if (model.sub !== shown.sub) { shown.sub = model.sub; parts.sub.textContent = model.sub; }
  if (model.alpha !== shown.alpha) { shown.alpha = model.alpha; root.style.opacity = String(model.alpha); }
}

/** The page is going (a test's reset): the node leaves with it. */
export function destroyGateMarksCard() {
  root?.remove?.();
  root = null; parts = null;
  shown = { vis: '', key: '', mode: '', alpha: -1, sub: '' };
}
