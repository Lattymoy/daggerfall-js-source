// Minimal player entity (E3a). The truthful pre-character-creation
// state: classic starts at level 1; reflexes default Average (2).
// Character creation (Systems arc) replaces this with the real
// entity; every consumer takes these as inputs so the swap is
// plumbing only. LiveSpeed already lives in PlayerMotor stats.
export const playerEntity = {
  level: 1,
  reflexes: 2,   // 0 VeryHigh .. 4 VeryLow; 2 = Average (classic default)
};
