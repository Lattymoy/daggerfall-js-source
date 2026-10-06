// @ts-check
// THE ONE HEAL A POWER GIVES MY ENTITY - LOOT4's leech and its heals (systems/lootPowers.js: Divine Grace, the Vigil,
// the Sanctified, Rage, the Histrionic's) and SERPENT-SET's Shed Skin (systems/sigilSetPowers.js). It lived in
// lootPowers.js until the serpent's set needed it, and lootPowers.js reads the blow's law out of sigilSetPowers.js - so
// it stands here, below both, and neither imports the other to reach it (an import cycle there would read the set
// powers' registries before they stood). Pure but for the fraction it carries.
//
// Not a DFU member: the port's own powers. Ledger A (LOOT4, SERPENT-SET).

let _healOwed = 0;   // a heal's fraction, carried to the next heal
/** Heal MY entity by `amount` - the fraction carried, never past its maximum, never a body. Answers what it healed. */
export function healMine(entity, amount) {
  if (!entity || !(entity.health > 0) || !(amount > 0)) return 0;
  const exact = amount + _healOwed;
  const whole = Math.floor(exact + 1e-9);
  _healOwed = exact - whole;
  if (whole <= 0) return 0;
  const max = Number.isFinite(entity.maxHealth) ? entity.maxHealth : entity.health + whole;
  const before = entity.health;
  entity.health = Math.min(max, entity.health + whole);
  return entity.health - before;
}

/** Tests only: no fraction carried. */
export function _resetPlayerHealForTests() { _healOwed = 0; }
