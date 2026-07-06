// Minimal player entity (E3a, extended E3b). The truthful
// pre-character-creation state: classic starts at level 1, reflexes
// Average, attributes at the 50 baseline. INTERIM (loudly): flat
// skills 30 and maxHealth 50 hold the slot until character creation
// (Systems arc) rolls the real career - every combat consumer takes
// this object as input, so the swap is plumbing only. armor 0 until
// equipment (E4). LiveSpeed already lives in PlayerMotor stats.
export const playerEntity = {
  isPlayer: true,
  level: 1,
  reflexes: 2,      // 0 VeryHigh .. 4 VeryLow; 2 = Average (classic default)
  maxHealth: 50,    // INTERIM until chargen rolls career HP
  health: 50,
  armor: 0,
  skills: 30,       // INTERIM flat skills until chargen
  stats: { strength: 50, agility: 50, luck: 50 },
  items: [],        // the inventory (S2); gold rides as a Currency stack
};
