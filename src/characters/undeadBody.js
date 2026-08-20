import { MOBILE_TYPES } from './mobileTypes.js';

// ═══════════════════════════════════════════════════════════════════
// THE UNDEAD LINE
//
// Zombie and Mummy, on the mechanism the orc line proved: a build spec
// scales the rig's loft rows and adds NO faces, so both ride the base
// figure's own face list and ship as a delta over it.
//
// WHY THESE TWO NEXT, AND NOT THE SKELETON. Of the enemies a player
// actually meets — mapChance 1 — Skeletal Warrior, Giant, Zombie,
// Mummy and Centaur are the field. The skeleton is the most wanted and
// is the one this mechanism CANNOT carry: a skeleton is not a scaled
// human, it is a different body with a ribcage and a skull where the
// flesh should be, and it needs geometry that does not exist yet. The
// giant is the opposite problem — it is an orc that is bigger, and
// proves nothing the orc line has not already proved.
//
// The undead sit exactly where the work is worth doing: the same rig,
// but pushed somewhere it has never been asked to go. A zombie is a
// human whose proportions have gone WRONG rather than large — sunken
// chest, swollen gut, one shoulder dropped — which is the first real
// test of whether a build spec can express decay rather than mass. And
// a mummy is the first figure whose clothing IS its silhouette: strip
// the wrappings and there is nothing underneath worth looking at.
//
// Both are legwork toward the skeleton rather than instead of it: what
// they establish is how far the loft can be pushed before it needs new
// geometry, which is precisely the question the skeleton answers with a
// yes.
// ═══════════════════════════════════════════════════════════════════

/** ART_PAL blocks the undead draw from. Same convention as ORC_RAMPS:
 *  [firstIndex, lastIndex] into a block that runs light to dark. */
export const UNDEAD_RAMPS = Object.freeze({
  // block 9 - yellow -> olive. Flesh that has gone, with the yellow of
  // old fat still in it. Not green: a green zombie is a cartoon.
  rotFlesh: [144, 156],
  // block 7 taken at the DARK end. Cured skin, drawn tight over bone,
  // and dark enough that the linen over it still reads as white.
  curedSkin: [120, 127],
  // block 7 - white -> charcoal, taken at the WHITE end. Linen has to
  // read as linen, and block 4 is "cream -> tan", which is leather:
  // resolved it came out 227,194,141 and she looked bandaged in
  // chamois. Two thousand years in the ground greys white; it does not
  // turn it brown.
  linen: [112, 120],
  // The same block, taken lower, so the wrappings and what is under
  // them are the same material family without being the same colour.
  linenDark: [118, 125],
  // block 11 - rust -> dark brown. Dried blood, and the stain the linen
  // has taken from what is under it.
  oldBlood: [176, 188],
  // block 2 - tan -> brown. What is left of the clothes it was buried
  // in, which is not much.
  gravecloth: [32, 44],
});

// ── ZONE HELPERS ─────────────────────────────────────────────────
// Same vocabulary as villagerDesigns.js and orcBody.js:
// { groups, yLo, yHi, th, mat } (+ arm/leg so the rig knows which
// centre to displace away from). Declared here rather than imported so
// the undead can be re-cut without disturbing the orc line.
const B = 'body',
  AL = 'armL',
  AR = 'armR',
  LL = 'legL',
  LR = 'legR';

const torso = (mat, yLo, yHi = 1.62, th = 0.012) => ({ groups: [B], yLo, yHi, th, mat });
const pelvis = (mat, yLo = 0.9, yHi = 1.14, th = 0.012) => ({ groups: [B], yLo, yHi, th, mat });
const legsTo = (mat, yLo, yHi = 1.0, th = 0.012) => ({ groups: [LL, LR], yLo, yHi, th, mat, leg: true });
const arms = (mat, yLo, yHi = 1.62, th = 0.011) => ({ groups: [AL, AR], yLo, yHi, th, mat, arm: true });
const feet = (mat, yLo = 0.0, yHi = 0.16, th = 0.014) => ({ groups: [LL, LR], yLo, yHi, th, mat, leg: true });
const skull = (mat, yLo, yHi, th = 0.014) => ({ groups: ['head'], yLo, yHi, th, mat });
const hands = (mat, yLo, yHi, th = 0.012) => ({ groups: [AL, AR], yLo, yHi, th, mat, arm: true });

export const UNDEAD_DESIGNS = [
  {
    id: MOBILE_TYPES.Zombie,
    name: 'Zombie',
    level: 10,
    damage: [15, 50], // ENEMY_BASICS: the hardest hitter at its level
    weaponTier: 0,
    // DECAY IS NOT MASS. The orc build spec says "bigger here"; this one
    // has to say "wrong here", which is the whole reason to build it.
    // The chest has fallen IN, the gut has gone out, and the arms have
    // wasted while the hands have not — a corpse's hands look too big
    // for it, because they have lost the least.
    build: {
      torso: 0.9,
      shoulder: 0.86,
      arm: 0.82,
      hand: 1.1,
      neck: 0.78,
      skull: 0.98,
      jaw: 0.9,
    },
    // THE SWOLLEN BELLY IS A ZONE, NOT A BUILD KEY.
    //
    // I wrote `gut: 1.24` here first. BUILD_IDENTITY is torso, shoulder,
    // arm, hand, neck, skull, jaw, leg — there is no gut, and the rig
    // spreads the spec over its OWN keys, so an invented one is dropped
    // without a word. It would have shipped a zombie with a flat
    // stomach and nothing to say why.
    //
    // A zone does the job with what exists: it displaces the body's own
    // faces outward over a height band and recolours them. Tagged with
    // the flesh material rather than a cloth one, so the belly swells
    // as SKIN, which is what has happened to it.
    zones: [
      { groups: [B], yLo: 0.98, yHi: 1.2, th: 0.03, mat: 'bloat' },
      pelvis('rag', 0.9, 1.12),
      legsTo('rag', 0.62, 0.96),
    ],
    mats: { rag: UNDEAD_RAMPS.gravecloth, bloat: UNDEAD_RAMPS.rotFlesh },
    hideRamp: 'rotFlesh',
  },
  {
    id: MOBILE_TYPES.Mummy,
    name: 'Mummy',
    level: 11,
    damage: [5, 15],
    weaponTier: 0,
    // THE WRAPPINGS ARE THE SILHOUETTE, and the first cut of this got
    // that backwards. I starved the body AND wrapped it thinly, so the
    // two worked in the same direction and she came out a narrow linen
    // post — thinner than a living woman, which is the opposite of what
    // a wound corpse looks like.
    //
    // The body underneath is starved; the LINEN puts the bulk back and
    // then some, so the net silhouette is a shade heavier than human and
    // reads as something wound rather than something wasted. Thickest at
    // the waist, where the winding overlaps most.
    build: {
      torso: 0.86,
      shoulder: 0.88,
      arm: 0.8,
      hand: 0.9,
      neck: 0.74,
      skull: 0.96,
      jaw: 0.86,
    },
    zones: [
      torso('linen', 1.12, 1.62, 0.034),
      torso('linen', 0.96, 1.12, 0.044), // the waist, wound heaviest
      arms('linen', 0.78, 1.5, 0.03), // one wrap the length of the arm
      pelvis('linen', 0.88, 1.1, 0.04),
      // THE WRAP RUNS TO THE ANKLE. At 0.5 it stopped mid-shin and left
      // a band of bare cured skin above the foot wrapping, which read as
      // grey boots rather than as a gap in the linen.
      legsTo('linen', 0.2, 0.96, 0.032),
      feet('linen', 0.0, 0.2, 0.034),
      // WRAPPED OVER THE SKULL AND DOWN THE HANDS. A bare grey head on a
      // wound body reads as a corpse in bandages rather than as a mummy:
      // the linen goes over the crown and round the jaw, and the hands
      // are wound too. What is left showing is the face, which is the
      // only part that should be.
      skull('linen', 1.62, 1.9, 0.018),
      skull('linen', 1.5, 1.62, 0.02), // round the jaw and the throat
      hands('linen', 0.6, 0.78, 0.016),

      // THE STAIN IS A BAND, NOT A SLEEVE. A second arm zone over the
      // forearms put a rust blotch across the hip instead: the arms hang
      // at the sides, so a wide band on the ARM groups at hip height
      // reads as a mark on the body behind them. One narrow band across
      // the chest instead — where something has soaked through from
      // underneath, which is where it would.
      torso('stain', 1.24, 1.34, 0.036),
    ],
    mats: { linen: UNDEAD_RAMPS.linen, stain: UNDEAD_RAMPS.oldBlood },
    hideRamp: 'curedSkin',
  },
];

/**
 * The same shape orcOpts returns, so the payload builder and the viewer
 * treat an undead exactly as they treat an orc — one delta path, not
 * two.
 *
 * @param {object} design one of UNDEAD_DESIGNS
 * @param {{get:(i:number)=>{r:number,g:number,b:number}}} pal
 */
export function undeadOpts(design, pal) {
  const ramp = ([a, b]) => {
    const out = [];
    // dark -> light: the rig indexes ramps by lighting intensity
    for (let i = b; i >= a; i--) {
      const c = pal.get(i);
      out.push([c.r, c.g, c.b]);
    }
    return out;
  };
  const mats = {};
  for (const [name, span] of Object.entries(design.mats)) mats[name] = ramp(span);
  const hide = ramp(UNDEAD_RAMPS[design.hideRamp]);
  return {
    ramps: { skin: hide, boot: ramp(UNDEAD_RAMPS.gravecloth) },
    opts: { build: design.build, clothZones: design.zones, armorZones: [], mats },
    hide,
  };
}
