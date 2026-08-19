// The ORC line: the four MobileTypes that share one body and differ by
// rank - Orc (7), OrcSergeant (12), OrcShaman (21), OrcWarlord (24).
// Four of the 62 roster entries off one design, which is why the orcs
// are the line the enemy rig starts on.
//
// SHAPE OF THIS FILE: data, not geometry. Every orc is the neutral rig
// under a `build` girth spec (neutralBody.js BUILD_IDENTITY) plus zones
// and palette spans, exactly as villagerDesigns.js does it. The only
// authored geometry in the whole line is pieces/orcHead.js (tusks and
// brow), because those are the two features no multiplier can express.
//
// The numbers below are anchored to ENEMY_BASICS, not invented: level,
// damage band and the weapon material tier from enemyEquipment.js are
// quoted per entry so the silhouette escalates with what the enemy
// actually does in a fight rather than by eye.
//
// ART_PAL spans are [firstIndex, lastIndex] into the loaded palette,
// resolved dark -> light by orcOpts - the order the rig indexes ramps
// by lighting intensity. Same contract as villagerDesigns.RAMPS.

import { MOBILE_TYPES } from './mobileTypes.js';

/** ART_PAL blocks the orc line draws from. `moss` and `sage` are the
 *  two green families in the palette; the orcs live in them so they sit
 *  in the game's own colour space rather than an invented green. */
export const ORC_RAMPS = Object.freeze({
  hideGreen: [160, 172],   // block 10 - pale green -> deep green (the line's base hide)
  hideOlive: [192, 204],   // block 12 - pale yellow-green -> green (older, sun-cured)
  hideAsh:   [112, 124],   // block 7  - white -> charcoal (the shaman's bloodless grey-green cast)
  leather:   [70, 79],     // block 4  - tan -> dark brown
  ironDark:  [80, 92],     // block 5  - lavender grey -> slate (crude iron)
  bloodRed:  [240, 251],   // block 15 - orange-red -> dark red (warpaint, rank cloth)
  boneWhite: [64, 72],     // block 4  - cream -> tan (fetishes, the shaman's charms)
  brassGold: [224, 236],   // block 14 - cream -> orange (a warlord's looted fittings)
});

// ── zone helpers ────────────────────────────────────────────────────
// Same vocabulary as villagerDesigns.js: { groups, yLo, yHi, th, mat }
// (+ arm/leg so the rig knows which centre to displace away from).
// Declared here rather than imported so the orc line can be re-cut
// without a change rippling into the 25 villagers.
const B = 'body', AL = 'armL', AR = 'armR', LL = 'legL', LR = 'legR';
const torso   = (mat, yLo, yHi = 1.62, th = 0.010) => ({ groups: [B], yLo, yHi, th, mat });
const sleeves = (mat, yLo, yHi = 1.62, th = 0.010) => ({ groups: [AL, AR], yLo, yHi, th, mat, arm: true });
const legs    = (mat, yLo, yHi = 1.00, th = 0.010) => ({ groups: [LL, LR], yLo, yHi, th, mat, leg: true });
const pelvis  = (mat, yLo = 0.90, yHi = 1.16, th = 0.014) => ({ groups: [B], yLo, yHi, th, mat });
const feet    = (mat, yLo = 0.00, yHi = 0.14, th = 0.014) => ({ groups: [LL, LR], yLo, yHi, th, mat, leg: true });
// THE LEG MUST BE COVERED END TO END. The rig's leg profile runs from
// the ankle at y 0.10 to the upper thigh at 0.95, so a thigh zone and a
// boot zone alone leave the whole shin, calf and knee bare - which is
// what the first pass shipped, and what Mac caught on the warlord:
// plate thigh, plate boot, naked knee between them.
//
// armorSet.js's spans (ZONES 104 greaves 0.56..1.00, 108 boots
// 0.00..0.42) are the reference, but they are NOT sufficient here and
// copying them is what the first fix attempt got wrong. Those two are
// independently equippable items, so the 0.42..0.56 gap between them is
// correct there - a player wearing boots and no greaves should have a
// bare knee. An orc is one authored outfit, so the same gap is a hole,
// and it lands on the worst possible band: the kneecap (0.50) and the
// joint pinch (0.55).
//
// So the greave drops to 0.38 and the boot rises to 0.42. The knee sits
// WELL INSIDE the greave (which is where buildGreaves puts its poleyn,
// at 0.500), and the two zones overlap across 0.38..0.42 - a straight
// stretch of shin between the calf belly (0.34) and the below-knee
// taper (0.44), so the seam never sits on a joint that bends.
const greaves = (mat, th = 0.020) => ({ groups: [LL, LR], yLo: 0.38, yHi: 1.00, th, mat, leg: true });
const boots   = (mat, th = 0.016) => ({ groups: [LL, LR], yLo: 0.00, yHi: 0.42, th, mat, leg: true });
// A robe or a legging is one garment over the whole leg, so it is a
// single zone across the same total span rather than a greave/boot pair.
const hose    = (mat, th = 0.012) => ({ groups: [LL, LR], yLo: 0.00, yHi: 1.00, th, mat, leg: true });
const bracers = (mat, yLo = 1.00, yHi = 1.24, th = 0.018) => ({ groups: [AL, AR], yLo, yHi, th, mat, arm: true });
// A pauldron zone is ARMOUR, so it thickens rather than drapes: the
// shoulder shelf only, capped under the trap line so it does not creep
// up the neck and read as a collar.
const spaulder = (mat, th = 0.026) => ({ groups: [AL, AR], yLo: 1.48, yHi: 1.66, th, mat, arm: true });

/** The four. `build` keys are neutralBody's BUILD_IDENTITY girth
 *  multipliers - see that file for the vocabulary and the 0.6..1.6
 *  clamp band. Every orc shares the LINE's read (barrel torso, slab
 *  shoulders, thick neck, heavy jaw) and separates on rank. */
export const ORC_DESIGNS = Object.freeze([
  {
    id: MOBILE_TYPES.Orc, name: 'Orc',
    level: 5, damage: [1, 6], weaponTier: 0,   // ENEMY_BASICS id 7 / enemyEquipment 189
    // The baseline of the line: heavy but unarmoured, a brawler in hide
    // scraps. Arms read thicker than a human's at the same shoulder so
    // the reach looks wrong in the way an orc's should.
    build: { torso: 1.22, shoulder: 1.20, arm: 1.22, hand: 1.26, neck: 1.34, skull: 1.04, jaw: 1.32, leg: 1.14 },
    tusk: { size: 1.00 }, brow: { jut: 1.00 },
    zones: [pelvis('hide', 0.90, 1.18), greaves('hide', 0.014), boots('hide', 0.016), bracers('hide')],
    mats: { hide: ORC_RAMPS.leather },
    hideRamp: 'hideGreen',
  },
  {
    id: MOBILE_TYPES.OrcSergeant, name: 'Orc Sergeant',
    level: 7, damage: [5, 15], weaponTier: 1,  // ENEMY_BASICS id 12 / enemyEquipment 190
    // Damage jumps 1-6 -> 5-15 and the weapon tier steps up, so the
    // silhouette gains PLATE, not just mass: a cuirass and a spaulder.
    build: { torso: 1.28, shoulder: 1.26, arm: 1.24, hand: 1.26, neck: 1.36, skull: 1.05, jaw: 1.34, leg: 1.16 },
    tusk: { size: 1.10 }, brow: { jut: 1.05 },
    zones: [torso('iron', 1.16, 1.62), spaulder('iron'), pelvis('hide', 0.90, 1.18),
            greaves('iron'), boots('hide'), bracers('iron')],
    mats: { iron: ORC_RAMPS.ironDark, hide: ORC_RAMPS.leather },
    hideRamp: 'hideGreen',
  },
  {
    id: MOBILE_TYPES.OrcShaman, name: 'Orc Shaman',
    level: 13, damage: [2, 20], weaponTier: 0, // ENEMY_BASICS id 21 / enemyEquipment 189
    // chanceForAttack2 drops to 20 (the lowest in the line) because the
    // shaman is a CASTER - it swings least. So it is the least massive
    // orc: the bulk comes off the arms and torso and the read moves to
    // the head, the robe and the charms.
    build: { torso: 1.10, shoulder: 1.08, arm: 1.06, hand: 1.14, neck: 1.24, skull: 1.10, jaw: 1.30, leg: 1.04 },
    tusk: { size: 1.22 }, brow: { jut: 1.14 },   // oldest of the line - the tusks kept growing
    zones: [torso('robe', 1.02, 1.62), sleeves('robe', 1.16, 1.62), pelvis('robe', 0.88, 1.20),
            hose('robe'), boots('hide', 0.018)],
    mats: { robe: ORC_RAMPS.hideAsh, hide: ORC_RAMPS.leather, bone: ORC_RAMPS.boneWhite },
    hideRamp: 'hideOlive',
  },
  {
    id: MOBILE_TYPES.OrcWarlord, name: 'Orc Warlord',
    level: 16, damage: [5, 50], weaponTier: 2,  // ENEMY_BASICS id 24 / enemyEquipment 191
    // The top of the line: 5-50 damage, the best weapon material an orc
    // carries. Everything is at the heavy end of the band, and the
    // fittings go brass so rank reads at distance without a health bar.
    build: { torso: 1.38, shoulder: 1.40, arm: 1.34, hand: 1.32, neck: 1.44, skull: 1.08, jaw: 1.40, leg: 1.24 },
    tusk: { size: 1.30 }, brow: { jut: 1.20 },
    zones: [torso('plate', 1.10, 1.64), spaulder('brass', 0.032), pelvis('plate', 0.88, 1.20),
            greaves('plate', 0.024), boots('plate', 0.020), bracers('brass')],
    mats: { plate: ORC_RAMPS.ironDark, brass: ORC_RAMPS.brassGold, war: ORC_RAMPS.bloodRed },
    hideRamp: 'hideGreen',
  },
]);

/** Resolve a design to buildNeutralBody(ramps, opts) arguments.
 *  Returns { ramps, opts } - the caller passes them straight through.
 *  `pal` is a loaded DFPalette; every colour in the line comes out of
 *  ART_PAL, so an orc cannot drift out of the game's palette. */
export function orcOpts(design, pal) {
  const ramp = ([a, b]) => {
    const out = [];
    for (let i = b; i >= a; i--) { const c = pal.get(i); out.push([c.r, c.g, c.b]); }
    return out;   // dark -> light: the rig indexes ramps by lighting intensity
  };
  const mats = {};
  for (const [name, span] of Object.entries(design.mats)) mats[name] = ramp(span);
  const hide = ramp(ORC_RAMPS[design.hideRamp]);
  return {
    ramps: { skin: hide, boot: ramp(ORC_RAMPS.leather) },
    opts: { build: design.build, clothZones: design.zones, armorZones: [], mats },
    hide,
  };
}

/** Look a design up by its MobileTypes id, so a caller holding an
 *  ENEMY_BASICS key can reach the design without knowing the order. */
export function orcDesignFor(id) {
  return ORC_DESIGNS.find((d) => d.id === id) || null;
}
