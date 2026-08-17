// The shared player entity (E3a/E3b; chargen S3 mutates it in
// place). These initial values are the PRE-CHARGEN state only:
// createCharacter (systems/chargen) rolls the real career the first
// time a chargen-running context boots (dungeons today; the chargen
// UI later fronts it everywhere). INTERIM until then, loudly: flat
// skills 30 and maxHealth 50. armor 0 until player equipment.
// LiveSpeed lives in PlayerMotor stats.
export const playerEntity = {
  isPlayer: true,
  level: 1,
  reflexes: 2,      // 0 VeryHigh .. 4 VeryLow; 2 = Average (classic default)
  maxHealth: 50,    // INTERIM until chargen rolls career HP
  health: 50,
  armor: 0,      // legacy scalar fallback (armorValues wins in the to-hit)
  // U8h: the 7-part armor table (CharacterDocument: 100 each = no
  // armor; equip subtracts material*5 - the classic law makes an
  // UNARMORED player far easier to hit than the old armor:0 scalar)
  armorValues: [100, 100, 100, 100, 100, 100, 100],
  skills: 30,       // INTERIM flat skills until chargen
  stats: { strength: 50, agility: 50, luck: 50 },
  fatigue: 3200,    // (Str 50 + End 0) x 64 pre-chargen (INTERIM stats above); applyCharacter re-derives from the rolled stats (S15)
  items: [],        // the inventory (S2); gold rides as a Currency stack
};

/** Debug/probe surface: one place writes window.__player (audit
 *  2026-07-06b collapsed seven scattered assignments). */
export function surfacePlayer() {
  if (typeof window !== 'undefined') window.__playerEntity = playerEntity;
}
