// @ts-check
// SET5 (2026-09-26, Sigil Sets - bible/11-Multiplayer/Sigil-Sets.md; Mac: "sigil armor sets that also come with set
// builds (think having multiple of one set type grants detailed abilities)"): THE SET, DRAWN.
//
// A set piece's card carries its set as its own block under the sigil's: the set's name in its Prince's colour (the
// Aetheric set's in its own), who it answers to and what it is for, the nine places it is worn as nine sockets - lit
// where a piece of it is worn - the stage it stands at (its lowest piece's, under my Renown: "grow together") and what
// holds it there, and its three tiers, each lit when enough pieces wake it, its numbers at the set's stage (and at
// Ascendant, under the pointer). The facts are systems/sigilSets.js's (setCardView, wornSets); this file only draws
// them. The pack's card and the Info box take the block from here; the paperdoll's column takes the strip - a line a
// worn set, a press on it showing that set's piece.
import { setCardView, setSleepText, wornSets, wornSetPieces, setIdOf, setById, SET_PLACES } from '../systems/sigilSets.js';
import { SIGIL_STAGES } from '../systems/sigil.js';
import { sigilRuneTileUrl } from './sigilRune.js';

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

/** What the set's stage line says: its stage and what holds it, why it sleeps, or what would wake it. */
export function setStageText(v, nameOf = (it) => String(it?.name ?? 'piece')) {
  if (!v) return '';
  if (v.stage >= 0) {
    const next = SIGIL_STAGES[v.stage + 1]?.name;
    if (!next) return v.stageName;
    // AUDIT SET U7: what it asks, as things to do - "your Boots grows" read wrong for every plural piece (boots,
    // gauntlets, greaves), and a verb that agrees with a player's own item name is no verb to trust
    const piece = v.heldPiece ? `grow your ${nameOf(v.heldPiece)}` : null;
    if (piece && v.renownNext) return `${v.stageName} · ${next}: ${piece}, reach Renown ${v.renownNext}`;
    if (piece) return `${v.stageName} · ${next}: ${piece}`;
    if (v.renownNext) return `${v.stageName} · ${next} at Renown ${v.renownNext}`;
    return v.stageName;
  }
  const sleep = setSleepText(v.sleep);
  if (sleep) return `Asleep · ${sleep}`;
  return v.count ? '' : 'Wear two pieces to wake it';
}

/**
 * The set block for a set piece's card, or null for an item that is no set piece.
 * @param {any} item @param {any} wearer the entity whose worn pieces count (the pack's) @param {(it: any) => string} [nameOf]
 */
export function setCard(item, wearer, nameOf = undefined) {
  const v = setCardView(item, wearer);
  if (!v || typeof document === 'undefined') return null;
  const box = el('section', 'setbox');
  box.dataset.set = v.id;
  box.dataset.stage = v.stage < 0 ? 'asleep' : String(v.stage);
  dress(box, v.colour);
  box.setAttribute('aria-label', `${v.name}, ${v.count} of ${v.of} worn`);
  const head = el('div', 'set-head');
  head.append(el('span', 'set-name', v.name), el('span', 'set-count', `${v.count}/${v.of}`));
  box.append(head);
  box.append(el('p', 'set-role', `${v.prince} · ${v.role}${v.aetheric ? ' · Aetheric' : ''}`));
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
  const stage = setStageText(v, nameOf);
  if (stage) box.append(el('p', 'set-stage', stage));
  // the three tiers
  for (const t of v.tiers) {
    const row = el('div', `set-tier${t.awake ? ' awake' : ''}`);
    row.append(el('span', 'set-at', String(t.at)));
    const body = el('div', 'set-tier-body');
    body.append(el('span', 'set-tier-name', t.name), el('span', 'set-tier-text', t.text));
    row.append(body);
    if (t.full !== t.text) row.title = `At Ascendant: ${t.full}`;
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
    b.title = st.tiers.map((t) => `${t.at}: ${t.name}${t.awake ? '' : ' (asleep)'}`).join('\n');
    const first = pieces.get(st.id)?.[0] ?? null;
    if (onPick && first) b.onclick = (e) => { e.stopPropagation(); onPick(first); };
    strip.append(b);
  }
  return strip;
}
