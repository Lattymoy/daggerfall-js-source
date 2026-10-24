// @ts-check
// THE ONE HEAL A POWER GIVES MY ENTITY (and SCHOOLS3: the one magicka gift, manaMine) - LOOT4's leech and its heals (systems/loot/lootPowers.js: Divine Grace, the Vigil,
// the Sanctified, Rage, the Histrionic's) and SERPENT-SET's Shed Skin (systems/sigil/sigilSetPowers.js). It lived in
// lootPowers.js until the serpent's set needed it, and lootPowers.js reads the blow's law out of sigilSetPowers.js - so
// it stands here, below both, and neither imports the other to reach it (an import cycle there would read the set
// powers' registries before they stood). Pure but for the fraction it carries.
//
// EG15 (2026-10-12, the Elite Gates arc): AND THE ONE MAGICKA A POWER RETURNS - the Legendary Arcane Conduit's
// (systems/loot/lootPowers.js lootStrike) and the Battlemage's Discipline's refund (systems/sigil/sigilSetPowers.js setStrike). It
// lived in lootPowers.js, private, until the Battlemages' set needed it: moved here whole, byte for byte, by the heal's
// own law.
//
// Not a DFU member: the port's own powers. Ledger A (LOOT4, SERPENT-SET, EG15).

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

let _manaOwed = 0;   // a magicka gift's fraction, carried to the next
/** SCHOOLS3: give MY entity `amount` magicka - the fraction carried, never past its maximum. LOOT4's (lootPowers.js
 *  gainMana, moved here when the paths' riders and passives needed it too: one home, one carry). */
export function manaMine(entity, amount) {
  if (!entity || !(amount > 0) || !Number.isFinite(entity.magicka)) return;
  const exact = amount + _manaOwed;
  const whole = Math.floor(exact + 1e-9);
  _manaOwed = exact - whole;
  if (whole > 0) entity.magicka = Math.min(Number.isFinite(entity.maxMagicka) ? entity.maxMagicka : entity.magicka + whole, entity.magicka + whole);
}

/** Tests only: no fraction carried. */
export function _resetPlayerHealForTests() { _healOwed = 0; _manaOwed = 0; }
