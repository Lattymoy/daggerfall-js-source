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
 * @returns {boolean} true if anything was actually ended
 */
export function breakNormalPowerConcealment(entity) {
  const list = entity?.activeEffects;
  if (!list || !list.length) return false;
  const kept = list.filter((a) => !NORMAL_POWER_CONCEALMENTS.includes(a.kind));
  if (kept.length === list.length) return false;
  entity.activeEffects = kept;
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
