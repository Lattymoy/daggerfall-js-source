// The concealment BREAK, and nothing else.
//
// This is a leaf on purpose. EntityEffectManager.BreakNormalPowerConcealment-
// Effects is called from the combat formula's tail (any attack that lands
// damage) and from the effect spine's FromSource damage doors, and
// combat/formulas.js cannot import systems/effects.js: effects.js imports
// spellcast.js, spellcast.js imports formulas.js, and the resulting cycle
// leaves effects.js reading EFFECT_FLAGS before spellcast.js has initialised
// it. So the law lives here, with no imports at all, and systems/effects.js
// re-exports it for the readers that already speak to that module.

/** The three ConcealmentEffect subclasses whose concealmentFlag is a
 *  *Normal* one - ChameleonNormal (23,0), InvisibilityNormal (13,0) and
 *  ShadowNormal (24,0). The TRUE variants (23,1 / 13,1 / 24,1) are the
 *  expensive spells and survive an attack, which is the whole point of
 *  DaggerfallEntity's normal/true split. */
export const NORMAL_POWER_CONCEALMENTS = Object.freeze(['chameleonNormal', 'invisNormal', 'shadeNormal']);

/**
 * EntityEffectManager.BreakNormalPowerConcealmentEffects (:1652-1670):
 *
 *     if (entity.HasConcealment(BlendingNormal))  manager.EndIncumbentEffect<ChameleonNormal>();
 *     if (entity.HasConcealment(InvisibleNormal)) manager.EndIncumbentEffect<InvisibilityNormal>();
 *     if (entity.HasConcealment(ShadeNormal))     manager.EndIncumbentEffect<ShadowNormal>();
 *
 * The three HasConcealment guards are what DFU's own
 * `IsMagicallyConcealedNormalPower` gate at each call site already
 * establishes; ending an effect that is not there is a no-op either way,
 * so the filter below is the same law with the guards folded in - which
 * is also why the port has no separate IsMagicallyConcealedNormalPower
 * member: it would be a ported function with no caller.
 *
 * HELD-CONCEAL (FIELD BUGS 2026-10-19f, a player's private report: a
 * worn item's Invisibility stopped working until it was taken off and
 * put on again). EndIncumbentEffect<T> (:759-766) ENDS the effect -
 * `RoundsRemaining = 0; End()` - and removes nothing. A spell's bundle
 * then has no rounds left and goes at the next DoMagicRound, so the
 * port's removal is the same end, a round sooner. A WORN ITEM'S bundle
 * does not go: DoMagicRound keeps a bundle "alive until item breaks or
 * is unequipped" (:1739-1742), the ended effect inside it sets no
 * concealment flag (DoConstantEffects skips HasEnded at :1693, and
 * DaggerfallEntity.ClearConstantEffects clears the flags every frame),
 * and its item stays scheduled for the reroll that recasts it fresh
 * (:1750-1753, RerollItemEffects :2001-2034). So an item-pinned entry is
 * ENDED in place - `ended`, its rounds 0 - and keeps its pin: every reader of
 * the concealment sees it broken (effects.js hasActiveEffect, the HUD's
 * liveBundles), and enchantments.js's reroll still visits its item.
 * Removed outright, as it was, the pin went with it, the reroll never
 * visited the item again, and the concealment was gone for as long as
 * the piece was worn.
 *
 * Every LIVE normal power ends at once. DFU's EndIncumbentEffect<T>
 * ends the first effect of its type that FindIncumbentEffect<T> meets
 * (:666-678), an ended one included - so a worn item's and a spell's
 * Invisibility both live took one blow each, and once the worn one was
 * ended it shielded the spell's from every blow until the reroll. The
 * port ends each live one, and never counts an ended one as concealing.
 *
 * @returns {boolean} true if anything was actually ended
 */
export function breakNormalPowerConcealment(entity) {
  const list = entity?.activeEffects;
  if (!list || !list.length) return false;
  const broken = list.filter((a) => NORMAL_POWER_CONCEALMENTS.includes(a.kind) && !a.ended);
  if (!broken.length) return false;
  for (const a of broken) {
    if (a.heldItem) { a.roundsRemaining = 0; a.ended = true; }
  }
  entity.activeEffects = list.filter((a) => a.heldItem || !broken.includes(a));
  return true;
}

/** DaggerfallEntityBehaviour.HandleAttackFromSource (:196-201) - the shared
 *  post-attack logic run on the SOURCE of any FromSource damage (health,
 *  magicka or fatigue), which for an effect is the effect's Caster. Only the
 *  concealment half is ported; the rest of that method is the player's
 *  crime-reporting arm, which lives in the court/guard slice. A null source
 *  is DFU's own case (`if (sourceEntityBehaviour && ...)`) and no-ops. */
export function handleAttackFromSource(source) {
  return breakNormalPowerConcealment(source ?? null);
}
