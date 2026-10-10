// @ts-check
// TECH-CARD (2026-10-10, the owner, of the card's two technique lines: "it needs its own unique glyph as its own
// element. Like how set pieces and sigils get their own sections"): THE TECHNIQUE, DRAWN - bible/05-Combat/
// Weapon-Techniques.md "The card's block".
//
// TECH1 told a technique in words - its line and what a press does, two more lines in the card's tier list in the
// affixes' own colour, so an active move on its own key read like one more "+17 Dodging", and its second line broke
// mid-clause wherever the card's width fell. This is its own block under the tier list, as the sigil's and the set's
// are: the glyph (ui/techniqueGlyph.js - the HUD's chip wears the same one) in the blue the technique's marks wear on
// the ground, the word and the technique's name, its roll and the band it was rolled in; what a press does; and a foot
// of three cells - the key and how it is pressed, the fatigue, and the recovery in the dashed frame the HUD's
// recovering chip wears. The facts are systems/lootRarity.js techniqueCardView's; this file only draws them.
//
// TWO DRESSES, the sigil's law (CARD-FIT): the CARD's block (the default) is what a glance needs; the INFO box's,
// `{ full: true }`, adds the sentences - how the power was rolled onto the technique's own blow, and how the key is
// pressed.
import { techniqueCardView } from '../systems/lootRarity.js';
import { sigilDueling } from '../systems/sigil.js';
import { TECHNIQUE_GLYPH_SVG } from './techniqueGlyph.js';

/** @param {string} tag @param {string|null} [cls] @param {string|null} [text] */
const el = (tag, cls = null, text = null) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const pct = (x) => `${Math.round(x * 100)}%`;
/** The foot's word for how the key is pressed: held to aim (gone on the release), or one press. */
export const TECH_HOW = Object.freeze({ aims: 'hold to aim', press: 'press' });
/** The foot's word where no key is bound. */
export const TECH_UNBOUND = 'no key bound';
/** The note a block wears in a duel or a bout between players - law 3: never at a player (combat/techniques.js). */
export const TECH_DUEL_NOTE = 'Sleeps in a duel: never at a player.';

/**
 * The technique's block for an item's card, or null for an item whose tier list would say nothing of one
 * (techniqueCardView). `keyWord` names the bound key ('' when none is - the foot says so). CARD-FIT: the card's dress by
 * default, the Info box's whole with `full`.
 * @param {any} item @param {{ full?: boolean, keyWord?: string }} [opts]
 */
export function techniqueCard(item, { full = false, keyWord = '' } = {}) {
  const v = techniqueCardView(item);
  if (!v || typeof document === 'undefined') return null;
  const asleep = sigilDueling();
  const box = el('section', full ? 'techbox' : 'techbox compact');
  box.dataset.state = asleep ? 'asleep' : 'ready';
  box.dataset.technique = v.id;
  box.setAttribute('aria-label', `Technique, ${v.name}`);
  // the head: the glyph beside two rows - the word with the roll and its band at the right, then the name the whole
  // width (a long one, "Headsman's Chop", never shares its row with the roll)
  const head = el('div', 'tech-head');
  const glyph = el('span', 'tech-glyph');
  glyph.innerHTML = TECHNIQUE_GLYPH_SVG;
  glyph.setAttribute('aria-hidden', 'true');
  const roll = el('span', 'tech-roll', `+${v.value}%`);
  if (v.band) { roll.append(el('span', 'tech-band', ` [${v.band[0]}-${v.band[1]}]`)); roll.title = `Rolled in ${v.band[0]}-${v.band[1]}`; }
  head.append(glyph, el('span', 'tech-word', 'Technique'), roll, el('span', 'tech-name', v.name));
  box.append(head);
  // what a press does, whole on its own line - never cut mid-clause by the price after it
  box.append(el('p', 'tech-effect', v.what));
  // the foot: the key and how it is pressed; the fatigue; the recovery
  const foot = el('div', 'tech-foot');
  const key = el('span', keyWord ? 'tech-key' : 'tech-key unbound', keyWord || TECH_UNBOUND);
  const how = el('span', 'tech-how', v.aims ? TECH_HOW.aims : TECH_HOW.press);
  const cost = el('span', 'tech-cost', `${v.fatigue} fatigue`);
  const every = el('span', 'tech-every', `${v.cooldown}s`);
  every.title = `Ready again ${v.cooldown} seconds after a use`;
  foot.append(key, how, cost, every);
  box.append(foot);
  if (full) {
    // the two numbers the card shows, tied together: the roll is on the technique's own blow
    box.append(el('p', 'tech-power', `+${v.value}% rolled${v.band ? ` (${v.band[0]}-${v.band[1]})` : ''} on its ${pct(v.base)} blow: ${pct(v.mult)} of a plain blow.`));
    box.append(el('p', 'tech-press', !keyWord
      ? 'Bind Weapon technique in Controls to use it.'
      : v.aims ? `Hold ${keyWord} to aim its mark, and let go to strike; a tap strikes where you look.` : `Press ${keyWord} to strike.`));
  }
  if (asleep) box.append(el('p', 'tech-note', TECH_DUEL_NOTE));
  return box;
}
