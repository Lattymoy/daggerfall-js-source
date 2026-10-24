// @ts-check
// UNQUIET (bible/06-Systems/Revenants.md section 46; the owner, 2026-10-17: "They need to become harder, rarer, revenants
// need more of a chance to flee instead of relying on player death"): THE MARK - the one thing that lets a special foe
// become a revenant. Every elite and every LOOT7 champion was one before (a kill by any of them made one); now one special
// foe in four carries the mark - "Unquiet" before its title (systems/foeTitle.js) - and only a marked foe, or a revenant
// already, may rise (systems/revenant/revenant.js revenantCandidate). The rest die where they fall, whatever they do.
//
// WHO IS MARKED. A foe made special in its own pool - an elite's promotion (systems/eliteFoes.js promoteEliteFoe, `own`)
// or a champion's trait (systems/champions.js applyChampion, `own`) - never a puppet (its owner's foe, its owner's mark).
// The draw is on the foe's voice id (the id a special foe that runs speaks with - revenant.js voiceIdOf - minted now if
// none), so it moves nobody's dice: neither DFRandom nor the pools' Math.random. A load stands its foes afresh and draws
// again - the mark is its stand's, as its voice is.
//
// THE GATE. systems/revenant/revenant.js hands in when a mark may be drawn at all (`setUnquietGate`): the arc on (the Loot
// rarity row), the page's revenants not held (RENOWN-GATE), and room for another (fewer than REVENANT_MAX hunting - the
// Unquiet are few: while three hunt the player, no other is marked, and none rises). A mark drawn before the third rose
// stays on its foe - it is what the foe is - and that foe rises only if one of the three is gone by then (revenant.js
// revenantCandidate asks the cap again). With the gate shut, or before revenant.js has loaded, nothing is marked.
// AUDIT UNQUIET (section 49): a foe of the open zone or the sand never wears it (`isUnquiet`) - it is tagged after its
// promotion drew the mark, and could never rise.
//
// A LEAF but for the id's mint: the elites' and the champions' laws import it, and neither may bring the revenant system.
import { mintCharacterId } from '../characterId.js';

/** One special foe in this many carries the mark (a share). */
export const UNQUIET_MARK = 0.25;

/** @type {null | ((entity: any) => boolean)} */
let _gate = null;
/** systems/revenant/revenant.js: whether a mark may be drawn on `entity` now (the arc on, not held, room for another, and
 *  a foe that could ever rise - not the watch, the zone's, the sand's, nor under the floor's level). */
export function setUnquietGate(fn) { _gate = typeof fn === 'function' ? fn : null; }

/** FNV-1a of a string - the mark's seed (the revenant draws' own hash, revenantFeud.js hashStr, kept here to stay a leaf). */
function fnv(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
/** Does the voice id `id` carry the mark (UNQUIET_MARK of all ids)? */
export const unquietId = (id) => typeof id === 'string' && id.length > 0 && fnv(`${id}|unquiet`) % 1000 < Math.round(UNQUIET_MARK * 1000);

/** MARK A FOE JUST MADE SPECIAL in its own pool: drawn once a body (its voice id minted now if none), and only while the
 *  gate is open. Answers whether it carries the mark. */
export function markUnquiet(entity) {
  if (!entity || typeof entity !== 'object') return false;
  if (typeof entity.unquiet === 'boolean') return entity.unquiet;
  let open = false;
  try { open = !!_gate?.(entity); } catch { open = false; }
  if (!open) return false;
  entity._voiceId ??= mintCharacterId();
  entity.unquiet = _force ?? unquietId(entity._voiceId);
  return entity.unquiet;
}
/** Does this foe carry the mark? Never one of the open zone's (`wildFoe`, `wildGiant`) or the sand's (`bout`). */
export const isUnquiet = (entity) => entity?.unquiet === true && !entity.wildFoe && !entity.wildGiant && !entity.bout;
/** Tests only: every draw answers `v` (true, false), or the id's own again (null) - a real pool's foe marked at will. */
let _force = null;
export function _forceUnquietForTests(v = null) { _force = v == null ? null : !!v; }
