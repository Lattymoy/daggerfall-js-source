// PVP-BUFFS (the PvP rework plan, Stage 1: "buffs last 1 min"): while a refereed fight may hold the player, a spell
// effect it cast for itself runs at most a minute. A magic round is a game minute (systems/worldTick.js
// runMagicRoundsFor), five seconds at DFU's 12x. A worn item's effect (`heldItem`) and a foe's harm are left whole.

/** One real minute of magic rounds. */
export const PVP_BUFF_ROUNDS = 12;
const HARM = new Set([
  'continuousDamage',
  'continuousDamageFatigue',
  'continuousDamageSpellPoints',
  'damageFatigue',
  'damageHealth',
  'damageSpellPoints',
  'drainAttribute',
  'paralyze',
  'transferAttribute',
  'transferFatigue',
  'transferHealth',
  'soulTrap',
]);

/** Cut every buff on `entity` past `rounds` to `rounds`; answers how many were cut. */
export function capPvpBuffs(entity, rounds = PVP_BUFF_ROUNDS) {
  let cut = 0;
  for (const a of entity?.activeEffects ?? []) {
    if (a.ended || a.heldItem || HARM.has(a.kind) || !(a.roundsRemaining > rounds)) continue;
    a.roundsRemaining = rounds;
    cut++;
  }
  return cut;
}
