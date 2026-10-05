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
  // WB13d: a blow into the gate boss's ward lands nothing (the relay refuses it) - it says so, never a number
  if (r.target?.warded) return { kind: 'warded', text: 'Warded', tag: null };
  const dmg = Math.max(0, Math.round(r.damage || 0));
  if (dmg === 0) return { kind: 'absorbed', text: '0', tag: null };
  if (r.backstab) return { kind: 'crit', text: String(dmg), tag: 'Backstab' };
  if (r.critical) return { kind: 'crit', text: String(dmg), tag: null };
  return { kind: 'hit', text: String(dmg), tag: null };
}

/** PARTY-BUFFS (Tabitha: "I'd also like floating Heal numbers"): a heal I TOOK - my health between two frames the
 *  HUD drew, as "+N" in green on this same layer, a little under the reticle where the blows rise. Only a RISE, and
 *  only from a frame the HUD saw (`prev` null is the first frame back from a window - a night's rest, a level-up, a
 *  load or a death - so what those windows restored is never floated as a heal). Pure; pinned. */
export function healNumberFor(prev, now) {
  const a = Number(prev), b = Number(now);
  if (prev == null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  const n = Math.round(b - a);
  return n > 0 ? { kind: 'heal', text: `+${n}`, tag: null } : null;
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

// ── TELL9: THE WORDS ON THE HIT (bible/12-Enhanced-AI/Feud-Arc.md 11.2) ──
/** What a telegraphed blow's fight adds to a number: my blow on a wind-up that broke into a STAGGER, one that HOLDS, one
 *  on an overreached foe it could not stagger (OPEN); a PERFECT dodge, a word alone; a revenant's WEAKNESS (RVN3's). */
export const HIT_TAGS = Object.freeze({ stagger: 'Stagger', hold: 'Holds', open: 'Open', perfect: 'Perfect', weakness: 'Weakness' });
/** A door's word joins the number my blow raised this long before it (the same frame: the formula reports, then the
 *  door decides). */
export const TAG_JOIN_MS = 250;
/** The number my last blow that HIT raised: `{ target, node, at }`. */
let _lastHit = null;

/** A word alone on the layer - `kind` its class (`word`, `perfect`): only while the enhanced HUD has mounted the numbers. */
export function showWord(text, kind = 'word') {
  if (!registered || !text) return null;
  return showNumber({ kind, text: String(text), tag: null });
}

/** A word on the number my blow on `target` just raised (a hit, inside TAG_JOIN_MS); none such - a spell's landing
 *  raises no number, another foe's is not this one's - and the word rises alone. Nothing without the enhanced HUD. */
export function tagHit(target, word, { now = Date.now() } = {}) {
  if (!word) return null;   // unmounted: no number joined (`_lastHit` is the mounted hook's), and showWord draws none
  const l = _lastHit;
  if (l && target != null && l.target === target && now - l.at <= TAG_JOIN_MS && l.node?.isConnected) {
    const tag = document.createElement('small');
    tag.className = 'hitnum-tag';
    tag.textContent = String(word);
    l.node.append(tag);
    return l.node;
  }
  return showWord(word);
}

let registered = false;
/** Register with the formula seam - the enhanced HUD calls this once. */
export function mountHitNumbers() {
  if (registered) return;
  registered = true;
  setPlayerAttackHook((r) => {
    const node = showNumber(numberFor(r));
    _lastHit = node && r?.hit && !r.ineffective ? { target: r.target ?? null, node, at: Date.now() } : null;   // TELL9: the door's word joins it
  });
}
/** For tests and the classic skin's guarantee: nothing registered. */
export function unmountHitNumbers() {
  if (!registered) return;
  registered = false;
  _lastHit = null;
  setPlayerAttackHook(null);
  if (layer) { layer.remove(); layer = null; }
}
