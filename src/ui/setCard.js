// @ts-check
// SET5 (2026-09-26, Sigil Sets - bible/11-Multiplayer/Sigil-Sets.md; Mac: "sigil armor sets that also come with set
// builds (think having multiple of one set type grants detailed abilities)"): THE SET, DRAWN.
//
// A set piece's card carries its set as its own block under the sigil's: the set's name in its Prince's colour (the
// Aetheric set's in its own), who it answers to and what it is for, the nine places it is worn as nine sockets - lit
// where a piece of it is worn - the stage it stands at (its lowest piece's, under my Renown: "grow together") and what
// holds it there, and its three tiers, each lit when enough pieces wake it, its numbers at the set's stage (and at
// Ascendant, under the pointer). The facts are systems/sigil/sigilSets.js's (setCardView, wornSets); this file only draws
// them. The pack's card and the Info box take the block from here; the paperdoll's column takes the strip - a line a
// worn set, a press on it showing that set's piece.
//
// CARD-FIT (2026-09-28, Discord - Cruor: "New sigil items descriptor is a bit long! ... all the buttons on it's pop-up
// card are.. off the screen"): TWO DRESSES. The CARD's block (the default) says what a glance needs - the set, the
// pieces worn and its stage in one head, the nine places, what would raise it, and each tier as ONE short row (its
// brief - sigilSets.js BRIEF_MAX), the sentence under the pointer; a set piece's card was 1,000 px tall in a 660 px
// window, the three sentences alone 250 of it. The INFO box asks `{ full: true }` and says everything: the Prince and
// the role, the stage's whole line, every tier's sentence and its Ascendant numbers.
import { setCardView, setSleepText, wornSets, wornSetPieces, setIdOf, setById, SET_PLACES } from '../systems/sigil/sigilSets.js';
import { SIGIL_STAGES } from '../systems/sigil/sigil.js';
import { sigilRuneTileUrl } from './sigilRune.js';
import { noteFirstUse } from '../systems/tutorials.js';   // TUT1: the first touch of a system pops its tutorial page

/** @param {string} tag @param {string|null} [cls] @param {string|null} [text] */
const el = (tag, cls = null, text = null) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
/** The set's colour and its light and shade, as the block's custom properties (the kit's bevel: lit top-left,
 *  shaded bottom-right) - written from the set's record, so the sheet names no set. */
const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (hex, to, t) => `#${rgbOf(hex).map((c, i) => Math.round(c + (to[i] - c) * t).toString(16).padStart(2, '0')).join('')}`;
export function setShades(colour) {
  const c = /^#[0-9a-f]{6}$/i.test(String(colour)) ? String(colour).toLowerCase() : '#b9ab93';
  return { '--set': c, '--set-hi': mix(c, [255, 255, 255], 0.45), '--set-lo': mix(c, [0, 0, 0], 0.55), '--set-rgb': rgbOf(c).join(',') };
}
/** @param {any} node @param {string} colour */
const dress = (node, colour) => { for (const [k, v] of Object.entries(setShades(colour))) node.style?.setProperty?.(k, v); return node; };
/** A picture's frame marked for its set - `data-set` and the corner rune's picture in the set's colour (the Plus sheet's
 *  rule reads --set-rune) - or unmarked, for a frame that outlives its item (the hotbar's slot, the diamond's cell). */
export function markSetFrame(node, item) {
  const set = setById(setIdOf(item));
  if (set) { node.dataset.set = set.id; node.style?.setProperty?.('--set-rune', sigilRuneTileUrl(set.colour)); }
  else { delete node.dataset.set; node.style?.removeProperty?.('--set-rune'); }
  return node;
}
/** The nine places in words, in SET_PLACES' order - a socket's hover. */
export const SET_PLACE_WORDS = Object.freeze(['Head', 'Right arm', 'Left arm', 'Chest', 'Hands', 'Legs', 'Feet', 'Shield', 'Weapon']);

/** What the set's stage line says: its stage and what holds it, why it sleeps, or what would wake it. CARD-FIT: the
 *  card's (`compact`) leaves the stage's own name to the block's head and says only what would raise it - nothing at
 *  Ascendant. */
export function setStageText(v, nameOf = (it) => String(it?.name ?? 'piece'), { compact = false } = {}) {
  if (!v) return '';
  if (v.stage >= 0) {
    const next = SIGIL_STAGES[v.stage + 1]?.name;
    const at = compact ? '' : `${v.stageName} · `;
    if (!next) return compact ? '' : v.stageName;
    // AUDIT SET U7: what it asks, as things to do - "your Boots grows" read wrong for every plural piece (boots,
    // gauntlets, greaves), and a verb that agrees with a player's own item name is no verb to trust
    const piece = v.heldPiece ? `grow your ${nameOf(v.heldPiece)}` : null;
    if (piece && v.renownNext) return `${at}${next}: ${piece}, reach Renown ${v.renownNext}`;
    if (piece) return `${at}${next}: ${piece}`;
    if (v.renownNext) return `${at}${next} at Renown ${v.renownNext}`;
    return compact ? '' : v.stageName;
  }
  const sleep = setSleepText(v.sleep);
  if (sleep) return `Inactive · ${sleep}`;
  return v.count ? '' : 'Wear 2 pieces to activate it';
}

/**
 * The set block for a set piece's card, or null for an item that is no set piece. CARD-FIT: the card's dress by default,
 * the Info box's whole one with `full`.
 * @param {any} item @param {any} wearer the entity whose worn pieces count (the pack's) @param {(it: any) => string} [nameOf]
 * @param {{ full?: boolean }} [opts]
 */
export function setCard(item, wearer, nameOf = undefined, { full = false } = {}) {
  const v = setCardView(item, wearer);
  if (!v || typeof document === 'undefined') return null;
  noteFirstUse('sigil-sets');   // TUT1: the first set piece read
  const box = el('section', full ? 'setbox' : 'setbox compact');
  box.dataset.set = v.id;
  box.dataset.stage = v.stage < 0 ? 'asleep' : String(v.stage);
  dress(box, v.colour);
  box.setAttribute('aria-label', `${v.name}, ${v.count} of ${v.of} worn`);
  const head = el('div', 'set-head');
  // the card's head carries the stage too, so the stage line can say only what would raise it
  head.append(el('span', 'set-name', v.name), el('span', 'set-count', full || v.stage < 0 ? `${v.count}/${v.of}` : `${v.count}/${v.of} · ${v.stageName}`));
  box.append(head);
  if (full) box.append(el('p', 'set-role', `${v.prince} · ${v.role}${v.aetheric ? ' · Aetheric' : ''}`));
  // the nine places, lit where a piece of the set is worn
  const places = el('div', 'set-places');
  places.setAttribute('role', 'list');
  v.places.forEach((on, i) => {
    const p = el('span', `set-place${on ? ' on' : ''}`);
    p.setAttribute('role', 'listitem');
    p.title = `${SET_PLACE_WORDS[i] ?? SET_PLACES[i]}${on ? ' - worn' : ''}`;
    places.append(p);
  });
  box.append(places);
  const stage = setStageText(v, nameOf, { compact: !full });
  if (stage) box.append(el('p', 'set-stage', stage));
  // the three tiers - the card's a row each, its brief; the Info box's the whole sentence
  for (const t of v.tiers) {
    const row = el('div', `set-tier${t.awake ? ' awake' : ''}`);
    row.append(el('span', 'set-at', String(t.at)));
    const body = el('div', 'set-tier-body');
    body.append(el('span', 'set-tier-name', t.name));
    // the card's recovery: its own tag on the name's line, in the dashed frame a recovering power wears on the HUD (the
    // sentence says it in words)
    if (!full && t.recover != null) { const tag = el('span', 'set-tier-every', `${t.recover}s`); tag.title = `Recovers in ${t.recover} s`; body.append(tag); }
    body.append(el('span', 'set-tier-text', full ? t.text : t.brief));
    row.append(body);
    const whole = full ? '' : t.text;
    const top = t.full !== t.text ? `At Ascendant: ${t.full}` : '';
    if (whole || top) row.title = [whole, top].filter(Boolean).join('\n');
    box.append(row);
  }
  return box;
}

/**
 * THE PAPERDOLL'S STRIP: a line a worn set - its name, the pieces worn of nine, three pips for its tiers (lit when
 * awake) and its stage - a press on a line handing that set's first worn piece to `onPick`. Null while no set is worn.
 * @param {any} wearer @param {{ onPick?: ((item: any) => void) | null }} [opts]
 */
export function setStrip(wearer, { onPick = null } = {}) {
  if (typeof document === 'undefined') return null;
  const sets = wornSets(wearer);
  if (!sets.length) return null;
  const pieces = wornSetPieces(wearer);
  const strip = el('div', 'setstrip');
  strip.setAttribute('role', 'group');   // AUDIT SET U14: a label names a group, not a bare div
  strip.setAttribute('aria-label', 'Sets worn');
  for (const st of sets) {
    const b = el('button', 'setline');
    b.setAttribute('type', 'button');
    b.dataset.set = st.id;
    dress(b, st.set.colour);
    b.append(el('span', 'setline-name', st.set.name), el('span', 'setline-count', `${st.count}/${SET_PLACES.length}`));
    const pips = el('span', 'setline-pips');
    for (const t of st.tiers) pips.append(el('i', t.awake ? 'on' : null));
    b.append(pips, el('span', 'setline-stage', st.stage < 0 ? 'Asleep' : st.stageName));
    b.title = st.tiers.map((t) => `${t.at}: ${t.name}${t.awake ? '' : ' (inactive)'}`).join('\n');
    const first = pieces.get(st.id)?.[0] ?? null;
    if (onPick && first) b.onclick = (e) => { e.stopPropagation(); onPick(first); };
    strip.append(b);
  }
  return strip;
}
