// ═══════════════════════════════════════════════════════════════════
// HN1: DAMAGE NUMBERS (Mac: a new feature that folds into the enhanced
// UI - damage numbers on attacking, colour-coded non-crit vs crit,
// missed text, etc.)
//
// THE NUMBERS ARE A READOUT OF THE FORMULA, NOT A SECOND OPINION. Every
// player attack that runs FormulaHelper's CalculateAttackDamage (melee,
// arrows, the whole ladder) reports its resolution through ONE seam,
// setPlayerAttackHook, and this module draws exactly what it was told:
//   hit           the damage, in the bone the HUD writes everything in
//   critical      the same damage, gold and larger - Daggerfall's own
//                 "critical strike", which is the skill's roll landing
//                 on the chance to hit (classic parity: it never
//                 multiplied damage, and these numbers do not pretend)
//   backstab      gold, larger, tagged - the one tripled hit the game has
//   miss          "Miss", dim - the hit roll failed
//   ineffective   "Ineffective", dim - the material could not bite
//   0             a hit that armour and the floor took to nothing
//
// ENHANCED ONLY. The hook is registered by the enhanced HUD's mount and
// never by the classic skin, and the node lives in the enhanced overlay
// layer. The numbers rise from just above the reticle - the point the
// player is looking at is the point they struck - with a little
// sideways scatter so a flurry does not stack into one glyph.
//
// ONE NODE PER NUMBER, REMOVED WHEN ITS ANIMATION ENDS. A pool would be
// an optimisation for a rate this feature never reaches; a leak would
// be a node per swing for the session, so the removal is the law and
// is pinned.
// ═══════════════════════════════════════════════════════════════════
import { setPlayerAttackHook } from '../combat/formulas.js';

const RISE_MS = 950;
let layer = null;
let seq = 0;

/** What a resolution report becomes on screen. Pure; pinned. */
export function numberFor(r) {
  if (!r) return null;
  if (r.ineffective) return { kind: 'ineffective', text: 'Ineffective', tag: null };
  if (!r.hit) return { kind: 'miss', text: 'Miss', tag: null };
  const dmg = Math.max(0, Math.round(r.damage || 0));
  if (dmg === 0) return { kind: 'absorbed', text: '0', tag: null };
  if (r.backstab) return { kind: 'crit', text: String(dmg), tag: 'Backstab' };
  if (r.critical) return { kind: 'crit', text: String(dmg), tag: null };
  return { kind: 'hit', text: String(dmg), tag: null };
}

/** The layer, created once, on the enhanced overlay plane. */
function ensureLayer() {
  if (layer && layer.isConnected) return layer;
  if (typeof document === 'undefined') return null;
  layer = document.getElementById('enhanced-hitnums');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'enhanced-hitnums';
    layer.setAttribute('aria-hidden', 'true');
    document.body.append(layer);
  }
  return layer;
}

/** Show one number. `scatter01` is injectable so the spawn point is
 *  deterministic under test. */
export function showNumber(n, { scatter01 = Math.random } = {}) {
  const host = ensureLayer();
  if (!host || !n) return null;
  const node = document.createElement('span');
  node.className = `hitnum hitnum-${n.kind}`;
  node.textContent = n.text;
  if (n.tag) {
    const tag = document.createElement('small');
    tag.className = 'hitnum-tag';
    tag.textContent = n.tag;
    node.append(tag);
  }
  // scatter: up to 36px either side of the reticle, so a flurry fans out
  const dx = Math.round((scatter01() * 2 - 1) * 36);
  node.style.setProperty('--dx', `${dx}px`);
  node.style.setProperty('--rise', `${RISE_MS}ms`);
  node.dataset.seq = String(++seq);
  host.append(node);
  const gone = () => { if (node.isConnected) node.remove(); };
  node.addEventListener('animationend', gone, { once: true });
  // a tab in the background does not run animations; the timer is the floor
  setTimeout(gone, RISE_MS + 250);
  return node;
}

let registered = false;
/** Register with the formula seam - the enhanced HUD calls this once. */
export function mountHitNumbers() {
  if (registered) return;
  registered = true;
  setPlayerAttackHook((r) => { showNumber(numberFor(r)); });
}
/** For tests and the classic skin's guarantee: nothing registered. */
export function unmountHitNumbers() {
  if (!registered) return;
  registered = false;
  setPlayerAttackHook(null);
  if (layer) { layer.remove(); layer = null; }
}
