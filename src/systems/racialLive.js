// VU1 - THE LIVE RACIAL-OVERRIDE PREDICATES, in their own leaf.
//
// `liveVampirism` is three lines over `entity.activeEffects` and had
// lived in systems/vampirism.js, which is where it belongs by subject.
// But combat/formulas.js needs it - DFU's GetBonusOrPenaltyByEnemyType
// asks HasVampirism() to decide whether a player target is undead - and
// importing vampirism.js from there CYCLES: vampirism -> loot ->
// combat/formulas, with the ESM binding landing in the temporal dead
// zone so `EFFECT_FLAGS` reads undefined at module-eval time and half
// the suite fails to import at all.
//
// That is the same trap formulas.js's own header has warned about since
// the rest.js/specialAdvantages split, and the same answer wave 31 gave
// for BreakNormalPowerConcealmentEffects: put the predicate in a leaf
// that imports NOTHING, and let the subject module re-export it so no
// existing consumer moves. THIS FILE MUST STAY IMPORT-FREE - one import
// of anything under systems/ and the cycle is back.
//
// It also proved something worth writing down: loading a module in
// ISOLATION does not show a cycle. `node -e "import('./formulas.js')"`
// passed cleanly with the bad import in place, because formulas.js
// happened to be the entry; the failure only appeared when another
// module got there first. Import order decides who lands in the dead
// zone, so the test that matters is the whole suite, not one load.

/** VampirismEffect's live curse entry, or null (the shape
 *  systems/vampirism.js mints and this predicate reads). */
export const liveVampirism = (entity) =>
  (entity?.activeEffects ?? []).find((a) => a.kind === 'racialOverride'
    && a.racial === 'vampirism' && !a.ended) ?? null;
