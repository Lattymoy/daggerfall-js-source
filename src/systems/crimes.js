// PlayerEntity.Crimes (PlayerEntity.cs:118-135), verbatim - and a LEAF
// module on purpose.
//
// GUARD1 (2026-09-15): the enum used to live in `court.js`, which
// imports `talk.js` (the region-people lookup), so `talk.js` could not
// import it back. The pickpocket law needed one member of it and could
// not reach it, and wrote the STRING 'Pickpocketing' into
// `crimeCommitted` instead - the one field in the port that every
// other writer fills with a NUMBER. `arrestFlow.crimeId()` grew a
// `typeof c === 'string'` arm to translate it back, and
// `systems/classicSave.js` had no such arm: it writes
// `saveVars.crimeCommitted` straight into a save byte, so a caught
// pickpocket saved a string where classic keeps an integer.
//
// A cycle is not a reason to change a value's TYPE. The enum is a leaf
// - no imports, no behaviour - so both sides can have it, and
// `court.js` re-exports it so no other caller moved.
export const CRIMES = Object.freeze({
  None: 0, Attempted_Breaking_And_Entering: 1, Trespassing: 2,
  Breaking_And_Entering: 3, Assault: 4, Murder: 5, Tax_Evasion: 6,
  Criminal_Conspiracy: 7, Vagrancy: 8, Smuggling: 9, Piracy: 10,
  High_Treason: 11, Pickpocketing: 12, Theft: 13, Treason: 14,
  LoanDefault: 15,
});
