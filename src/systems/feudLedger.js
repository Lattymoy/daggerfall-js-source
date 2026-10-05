// @ts-check
// RVN1 (bible/12-Enhanced-AI/Feud-Arc.md section 12; Mac, 2026-10-04: "more complex, less easy to accomplish and more
// detailed", then "Go"): THE LEDGER OF WOUNDS - how the player fought a foe that may become (or already is) a revenant,
// kept for the length of the fight and folded into its record's SCARS at the deed (systems/revenant.js revenantDeed).
//
// A LEAF: it imports nothing, because the brain (ai/tactics.js - its staggers and the blows dodged at me), the magic
// rounds (systems/effects.js) and the hosts' doors write to it, and none of them may bring the revenant system with
// them. What it cannot know - whether a body may be a revenant, the clock and the sky - is handed in once by
// systems/revenant.js (`setFeudGate`, `setFeudClock`).
//
// THE LEDGER LIVES ON THE FOE'S ENTITY (`entity._feud`), not on its pool record: every seam that writes it holds the
// entity (the formulas' strike listener, a spell's landing, a magic round, the brain's vitals) and the deed reads it
// there. It is opened the first time anything is written for a body the gate passes, and dies with the fight - folded
// at a deed, or gone with the body.

/** The ways the player harms a foe, as the ledger counts them. */
export const FEUD_CLASSES = Object.freeze(['blade', 'blunt', 'axe', 'h2h', 'arrow', 'fire', 'frost', 'shock', 'poison', 'magic', 'other']);
/** A spell's element (DFU's ElementTypes: Fire, Cold, Poison, Shock, Magic) as the ledger's class. */
const ELEMENT_CLASS = Object.freeze(['fire', 'frost', 'poison', 'shock', 'magic']);
export const elementFeudClass = (element) => ELEMENT_CLASS[element] ?? 'magic';
/** The counts the brain and the doors keep beside the damage. */
const COUNTS = Object.freeze(['staggers', 'dodged', 'perfect', 'backHits', 'weak']);

/** @type {null | ((entity: any) => boolean)} */
let _gate = null;
/** @type {null | ((entity: any, info: any) => boolean)} */
let _weak = null;
/** @type {null | ((entity: any, opts?: { peer?: boolean }) => void)} */
let _onWeak = null;
/** @type {null | (() => { now?: number, night?: boolean })} */
let _clock = null;
/** systems/revenant.js: which bodies keep a ledger (a revenant candidate, the switch on). */
export function setFeudGate(fn) { _gate = typeof fn === 'function' ? fn : null; }
/** systems/revenant.js: the character's minute and whether the sky reads night, when a ledger opens. */
export function setFeudClock(fn) { _clock = typeof fn === 'function' ? fn : null; }
/** RVN3: systems/revenant.js's word on whether a blow is of a body's weakness - `info` `{ cls, metal }` as the ledger's
 *  writers know it, or `{ kind, weapon, element, attacker }` as a door does - and what follows a blow of it (`onWeak`). */
export function setFeudWeakTest(fn, onWeak = null) { _weak = typeof fn === 'function' ? fn : null; _onWeak = typeof onWeak === 'function' ? onWeak : null; }
/** RVN13 (bible/12-Enhanced-AI/Feud-Arc.md 25): a PEER's blow of its weakness (the relayed hit's `wc`) - revealed to me as
 *  my own would be (the reveal's own once-a-stand and first-found law). */
export function feudRevealWeak(entity) {
  if (!entity?.revenant || !_onWeak) return;
  try { _onWeak(entity, { peer: true }); } catch { /* the reveal is no blow's business */ }   // AUDIT FEUD 2: no word of mine for it
}
/** RVN3: is this blow of `entity`'s weakness (false with no test, or for a body with none)? */
export function feudWeakBlow(entity, info = {}) {
  if (!_weak || !entity?.revenant) return false;
  try { return !!_weak(entity, info ?? {}); } catch { return false; }
}

/** `entity`'s open ledger - opened now for a body the gate passes (`open`), else null. */
export function feudOf(entity, open = true) {
  if (!entity || typeof entity !== 'object' || entity.isPlayer) return null;
  if (entity._feud) return entity._feud;
  if (!open || !_gate) return null;
  let ok = false;
  try { ok = !!_gate(entity); } catch { ok = false; }
  if (!ok) return null;
  let c = null;
  try { c = _clock?.() ?? null; } catch { c = null; }
  /** @type {Record<string, number>} */
  const dmg = {};
  for (const k of FEUD_CLASSES) dmg[k] = 0;
  const place = entity._feudPlace === 'building' || entity._feudPlace === 'dungeon' ? entity._feudPlace : 'street';
  entity._feud = { dmg, silver: 0, staggers: 0, dodged: 0, perfect: 0, backHits: 0, backstab: false, weak: 0, night: !!c?.night, place, start: Number.isFinite(c?.now) ? c.now : 0 };
  return entity._feud;
}

/** The player dealt `n` to `entity` by `cls` (FEUD_CLASSES; anything else is `other`) - `silver` when the weapon was;
 *  RVN3: a blow of its weakness (`metal` the weapon's) counts `weak`, and is told (`onWeak` - the reveal). */
export function noteFeudHarm(entity, cls, n, { silver = false, metal = null } = {}) {
  if (!(n > 0)) return;
  const l = feudOf(entity);
  if (!l) return;
  l.dmg[FEUD_CLASSES.includes(cls) ? cls : 'other'] += n;
  if (silver) l.silver += n;
  if (feudWeakBlow(entity, { cls, metal })) {
    l.weak++;
    try { _onWeak?.(entity); } catch { /* the reveal is not the blow's problem */ }
  }
}
/** One more of a count (`staggers`, `dodged`, `perfect`, `backHits`, `weak`) in `entity`'s fight. */
export function noteFeud(entity, what) {
  if (!COUNTS.includes(what)) return;
  const l = feudOf(entity);
  if (l) l[what]++;
}
/** A backstab landed in `entity`'s fight (a Watchful revenant's lesson, Feud-Arc.md 13.2). */
export function noteFeudBackstab(entity) {
  const l = feudOf(entity);
  if (l) l.backstab = true;
}
/** The fight is over: its ledger, taken (null when none was kept). */
export function takeFeud(entity) {
  const l = entity?._feud ?? null;
  if (entity && typeof entity === 'object') entity._feud = null;
  return l;
}
