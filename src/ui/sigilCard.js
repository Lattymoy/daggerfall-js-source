// @ts-check
// SIGIL-UI (2026-09-26, Mac: "sigil weapons need a visible indicator within the info section, something that makes it
// stand out, along with progress as you use it"): THE SIGIL, DRAWN.
//
// SIGIL1 told a sigil in words - three lines in the card's tier list, the same colour as the affixes above them, so
// the rarest mark a weapon can carry read like one more "+6 Strength". This is its own block under the tier list:
// the rune in its own colour (the arcane teal no tier wears, so it never reads as a rarity), the stage it stands at in
// MY hand, the five stages as five gems - lit where it has grown, burning where my Renown lets it wake - and a bar of
// how far it has drunk toward its next stage, which moves as the weapon earns Renown XP in hand. The facts are
// systems/sigil.js's (sigilView); this file only draws them. Enhanced Plus's card, the hover card and the Info box
// all take it from here, and a tile that holds a sigil weapon wears the rune in its corner (data-sigil, the sheet's
// own rule), so the pack says which weapons carry one before a card is opened.
import { sigilView, sigilProgressText } from '../systems/sigil.js';
import { setIdOf, setsSleep } from '../systems/sigilSets.js';
import { SIGIL_RUNE_SVG } from './sigilRune.js';

export { SIGIL_RUNE_SVG, SIGIL_RUNE_TILE_SVG, SIGIL_RUNE_TILE_URL } from './sigilRune.js';

/** @param {string} tag @param {string|null} [cls] @param {string|null} [text] */
const el = (tag, cls = null, text = null) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const pctText = (p) => (Number.isInteger(p) ? `${p}` : p.toFixed(1));

/**
 * The sigil block for an item's card, or null for an item without a sigil.
 * @param {any} item
 */
export function sigilCard(item) {
  const v0 = sigilView(item);
  if (!v0 || typeof document === 'undefined') return null;
  // AUDIT SET U11: a set's armour's sigil sleeps with its set - in a duel it read "Kindled", two gems burning, beside the
  // set's own block saying the set slept (a set's weapon keeps its own: its blow is SIGIL1's, and lands on a foe in a
  // duel). U12: and only a real set piece's sigil is called a set's (a forged set sigil on a ring answers no set)
  const setPiece = !!setIdOf(item);
  const duel = setPiece && !v0.blow && setsSleep() === 'duel';
  const v = duel ? { ...v0, dormant: true, held: false, name: 'Asleep', stages: v0.stages.map((st) => ({ ...st, awake: false })) } : v0;
  const box = el('section', 'sigilbox');
  box.dataset.stage = v.dormant ? 'dormant' : String(v.stage);
  box.setAttribute('aria-label', `Sigil, ${v.name}`);
  const head = el('div', 'sigil-head');
  const rune = el('span', 'sigil-rune');
  rune.innerHTML = SIGIL_RUNE_SVG;
  rune.setAttribute('aria-hidden', 'true');
  const title = el('span', 'sigil-title');
  title.append(el('span', 'sigil-word', 'Sigil'), el('span', 'sigil-stage', v.name));
  head.append(rune, title);
  box.append(head);
  // what it gives in my hand now, and at its full growth - SET5: a set's armour carries no blow; its sigil is its
  // share of its set's stage (the set's own block, ui/setCard.js, says what the set does)
  box.append(el('p', 'sigil-effect', !v.blow
    ? (!setPiece ? 'A sigil that answers no set'
      : duel ? 'A set\'s sigil: it sleeps in a duel'
        : v.dormant ? 'A set\'s sigil: it wakes online, with your Renown' : 'A set\'s sigil: its set grows with its lowest piece')
    : v.dormant
      ? `Wakes online, with your Renown: +${v.full}% damage at Ascendant`
      : `+${pctText(v.pct)}% damage now · +${v.full}% at Ascendant`));
  // the five stages: grown = the sigil reached it; awake = my Renown lets it burn there
  const gems = el('div', 'sigil-stages');
  gems.setAttribute('role', 'list');
  for (const st of v.stages) {
    const g = el('span', `sigil-gem${st.grown ? ' grown' : ''}${st.awake ? ' awake' : ''}`);
    g.setAttribute('role', 'listitem');
    g.title = st.name + (st.awake ? '' : st.grown ? ' (held by your Renown)' : '');
    gems.append(g);
  }
  box.append(gems);
  // the drink toward the next stage
  const meter = el('div', 'sigil-meter');
  meter.setAttribute('role', 'progressbar');
  meter.setAttribute('aria-valuemin', '0');
  meter.setAttribute('aria-valuemax', '100');
  meter.setAttribute('aria-valuenow', String(Math.round(v.frac * 100)));
  meter.setAttribute('aria-label', 'Sigil growth');
  const fill = el('i', 'sigil-fill');
  fill.style.width = `${(v.frac * 100).toFixed(1)}%`;
  meter.append(fill);
  // the numbers under the bar, and the fight that won it on the same line - the block stays short enough for the
  // hover card beside a pack of one row
  const prog = el('p', 'sigil-progress');
  prog.append(el('span', null, sigilProgressText(v)));
  if (v.party > 1) prog.append(el('span', 'sigil-party', `won in a fight of ${v.party}`));
  box.append(meter, prog);
  if (v.held) box.append(el('p', 'sigil-note', `Your Renown holds it at ${v.name} - ${v.stages[v.stage + 1].name} at Renown ${v.unlock}`));
  else if (!v.dormant && v.xp === 0) box.append(el('p', 'sigil-note', v.blow ? 'It grows as this weapon earns Renown in your hand.' : 'It grows as you earn Renown wearing it.'));   // said once, while it has drunk nothing (SET5: a set's armour grows worn)
  return box;
}
