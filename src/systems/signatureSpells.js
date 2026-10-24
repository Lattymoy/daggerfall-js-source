// @ts-check
// SCHOOLS3 (2026-10-13, bible/06-Systems/Arcane-Specialisations.md section 6): THE SIGNATURE SPELLS' RECORDS.
//
// Each path's signature spell is a ready-made record in the classic SPELLS.STD shape - the spell maker's own builder
// (spellMaker.js buildCustomSpell: three slots, the maker's defaults under what the path names), with the path it belongs
// to and its own index (arcanePaths.js SIGNATURE_INDEX_BASE). The law keeps the data and builds nothing, so the judge and
// the price read it without the maker; the shelf and the tests build the record here. A fresh record each call - a
// bought copy is the buyer's own (spellbookWindow.js confirmTrade copies it shallowly).

import { buildCustomSpell } from './spell/spellMaker.js';
import { PATH_BY_ID, pathHeld } from './arcanePaths.js';

/** The signature spell's record for path `id`, or null for no such path. */
export function signatureSpell(id) {
  const p = PATH_BY_ID[id];
  if (!p) return null;
  const s = p.spell;
  return { ...buildCustomSpell({ slots: s.slots.map((x) => ({ ...x, settings: { ...x.settings } })), rangeType: s.rangeType, element: s.element, name: s.nameEn, icon: s.icon, index: s.index }), path: p.id };   // AUDIT SCHOOLS L4 4: its canonical English name - shown in the player's language (loot.js shownSpellName)
}

/** The Buy Spells shelf's offer to this entity: its own path's signature spell, or nothing - a path HELD (mentoring
 *  takes nothing from the shelf; AUDIT SCHOOLS L2 F5). */
export function signatureOffers(entity) {
  const p = pathHeld(entity);
  const sp = p ? signatureSpell(p.id) : null;
  return sp ? [sp] : [];
}
