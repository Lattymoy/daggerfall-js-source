import { MOBILE_TYPES } from './mobileTypes.js';

// ═══════════════════════════════════════════════════════════════════
// THE UNDEAD LINE, AND WHAT CAME AFTER IT
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
  // block 7 at its palest. Bone, and the skeleton is nothing else.
  bone: [112, 118],
  // block 2 - tan -> brown. A giant's weathered hide, and the centaur's
  // human half, which is the same sun-cured leather as the rest of him.
  weathered: [36, 46],
  // block 5 - lavender grey -> slate, taken dark. A lich's robes: cold,
  // and nearly black in the folds. Not the black of cloth dyed black —
  // the grey of cloth that has had every other colour taken out of it.
  graveRobe: [86, 94],
  // block 5 at its darkest. What is left of a lich after another few
  // centuries: the robe has gone past grey.
  ashRobe: [90, 95],
  // block 7 near white. A vampire keeps its skin and loses everything
  // that was ever warm in it — this is the pallor, not bone.
  pallor: [113, 119],
  // block 15 - orange-red -> dark red, taken deep. Fine cloth in the
  // only colour a vampire's finery is ever the right colour in.
  bloodSilk: [244, 251],
  // block 5 - slate, mid. A vampire dresses well and darkly; this is the
  // coat under the finery rather than the finery itself.
  darkCloth: [84, 92],
  // block 6 - light blue -> deep blue, taken pale. A ghost is not white:
  // white is a sheet. It is the colour of cold air with a light behind
  // it, and it has to be BRIGHT because half of it is about to be
  // thrown away by the transparency.
  spectral: [96, 103],
  // block 6 darker. A wraith is the same thing gone further: older,
  // colder, and with more malice than light in it.
  wraithBlue: [102, 109],
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
  {
    id: MOBILE_TYPES.SkeletalWarrior,
    name: 'Skeletal Warrior',
    level: 9,
    damage: [5, 15],
    weaponTier: 1,
    // THE ONE THE OTHER TWO WERE LEGWORK FOR.
    //
    // A zombie is a human gone wrong and a mummy is a human wrapped up;
    // both ride the loft. A skeleton does not: ribs are separate bones
    // with GAPS between them, and no girth multiplier will ever put a
    // hole in a closed loft. So this is the first design whose
    // silhouette comes from a PIECE rather than from the body.
    //
    // The body is scaled to the bone underneath it — everything at the
    // floor of the clamp band — and the ribcage and pelvis are laid over
    // the top as their own geometry. What is left of the loft is the
    // limbs, which is right: an arm bone IS roughly a thin arm, and a
    // ribcage is not a thin chest.
    build: {
      torso: 0.62,
      shoulder: 0.7,
      arm: 0.6,
      hand: 0.72,
      neck: 0.6,
      skull: 0.94,
      jaw: 0.78,
      leg: 0.62,
    },
    zones: [],
    mats: {},
    hideRamp: 'bone',
    bootRamp: 'bone', // bone all the way down: it is not wearing anything
    // Geometry of its own, which no other design in this file has.
    bones: { ribs: 6, gap: 0.42 },
  },
  {
    id: MOBILE_TYPES.Centaur,
    name: 'Centaur',
    level: 5,
    damage: [5, 15],
    weaponTier: 1,
    // A SECOND BODY, WHICH IS A DIFFERENT PROBLEM FROM A SECOND PIECE.
    //
    // The skeleton's ribcage was geometry the loft could not express,
    // but it sat on the rig's own chest. A horse half is not a detail on
    // the human rig at all — and the rig has exactly one body.
    //
    // So the human half is built as normal, a shade heavier than a
    // villager because he carries the front of a horse, and the LEGS go
    // to the floor of the clamp band where the barrel swallows them.
    // buildNeutralBody cannot drop a limb group: the face list is fixed,
    // which is the whole reason every design here ships as a delta. Two
    // 0.6-girth legs inside a horse's chest cannot be seen from outside
    // it, and burying them costs nothing where teaching the rig to drop
    // a group would cost every caller that counts on the count.
    build: {
      torso: 1.1,
      shoulder: 1.14,
      arm: 1.08,
      hand: 1.06,
      neck: 1.02,
      skull: 1.0,
      jaw: 1.0,
      leg: 0.6,
    },
    zones: [],
    mats: {},
    hideRamp: 'weathered',
    bootRamp: 'weathered',
    horse: { girth: 1, len: 1, legs: 1 },
    // The rig's own legs have no job here — the horse has four of its
    // own. They cannot be dropped (the face list is fixed) so they are
    // collapsed to a point inside the barrel. See paperdollPayload.
    collapse: ['legL', 'legR'],
  },
  {
    id: MOBILE_TYPES.Giant,
    name: 'Giant',
    level: 10,
    damage: [10, 30],
    weaponTier: 0,
    // THE CHEAP ONE, AND IT IS WORTH SAYING SO. Everything a giant needs
    // is girth: this is the orc mechanism at the ceiling of the clamp
    // band and it proves nothing the orc line has not already proved.
    // It is here because it is an enemy the player MEETS — mapChance 1,
    // ten damage to thirty — and refusing to build it because it is easy
    // would be pride rather than judgement.
    build: {
      torso: 1.46,
      shoulder: 1.52,
      arm: 1.44,
      hand: 1.5,
      neck: 1.4,
      skull: 1.16,
      jaw: 1.3,
      leg: 1.4,
    },
    zones: [pelvis('pelt', 0.88, 1.14, 0.02), legsTo('pelt', 0.6, 0.94, 0.018)],
    mats: { pelt: UNDEAD_RAMPS.gravecloth },
    hideRamp: 'weathered',
  },
  {
    id: MOBILE_TYPES.Lich,
    name: 'Lich',
    level: 20,
    damage: [70, 100],
    weaponTier: 2,
    // THE MOST-MET ENEMY STILL UNBUILT — mapChance 4, higher than
    // anything else in the table — and the first design here that asks
    // whether the pieces COMPOSE.
    //
    // Every enemy so far carried one kind of thing: the orcs a tusk, the
    // skeleton a cage, the centaur a body. A lich is a skeleton IN
    // ROBES, so it needs the bones AND a drape at once, from two systems
    // that have never been asked to share a figure. If the piece table
    // and the drape path are as separable as they look, this costs a
    // design and nothing else; if they are not, better to find out on
    // the enemy the player meets most.
    build: {
      torso: 0.6,
      shoulder: 0.68,
      arm: 0.6,
      hand: 0.7,
      neck: 0.6,
      skull: 0.92,
      jaw: 0.74,
      leg: 0.6,
    },
    zones: [],
    mats: { robe: UNDEAD_RAMPS.graveRobe },
    hideRamp: 'bone',
    bootRamp: 'bone',
    // Thinner than the warrior's: what is left after centuries is less.
    bones: { ribs: 5, gap: 0.5 },
    drape: { name: 'Plain Robes', mat: 'robe' },
  },
  {
    id: MOBILE_TYPES.AncientLich,
    name: 'Ancient Lich',
    level: 21,
    damage: [70, 100],
    weaponTier: 2,
    // mapChance 4, level of the whole table. The variant is nearly free
    // and that is the point of a mechanism: the lich established that
    // bones and a drape compose, so an older one is a thinner cage and a
    // deader robe. Refusing to ship it because it is a variant would
    // leave the most-met enemy in the game at one of its two forms.
    build: {
      torso: 0.6,
      shoulder: 0.64,
      arm: 0.6,
      hand: 0.68,
      neck: 0.6,
      skull: 0.9,
      jaw: 0.7,
      leg: 0.6,
    },
    zones: [],
    mats: { robe: UNDEAD_RAMPS.ashRobe },
    hideRamp: 'bone',
    bootRamp: 'bone',
    bones: { ribs: 4, gap: 0.58 }, // fewer ribs, wider gaps: more has gone
    drape: { name: 'Priest Robes', mat: 'robe' },
  },
  {
    id: MOBILE_TYPES.Vampire,
    name: 'Vampire',
    level: 19,
    damage: [20, 50],
    weaponTier: 2,
    // AFFINITY: DARKNESS, and the only one in this file that is neither
    // rotted nor bone. A vampire keeps its body — that is the horror of
    // it — so this is the villager mechanism at its most ordinary: a
    // human build, barely touched, and everything it says it says with
    // COLOUR. Pallor where a villager has skin, and finery where a
    // villager has homespun.
    build: {
      torso: 0.96,
      shoulder: 1.0,
      arm: 0.94,
      hand: 0.96,
      neck: 0.92,
      skull: 0.98,
      jaw: 0.94,
      leg: 0.96,
    },
    zones: [
      torso('coat', 1.06, 1.62, 0.016),
      arms('coat', 0.9, 1.5, 0.014),
      pelvis('coat', 0.88, 1.1, 0.016),
      legsTo('coat', 0.4, 0.94, 0.014),
      feet('coat', 0.0, 0.18, 0.016),
      torso('silk', 1.22, 1.42, 0.02), // the shirt showing at the breast
    ],
    mats: { coat: UNDEAD_RAMPS.darkCloth, silk: UNDEAD_RAMPS.bloodSilk },
    hideRamp: 'pallor',
    bootRamp: 'darkCloth',
    drape: { name: 'Formal Cloak', mat: 'coat' },
  },
  {
    id: MOBILE_TYPES.VampireAncient,
    name: 'Ancient Vampire',
    level: 20,
    damage: [20, 60],
    weaponTier: 2,
    // Older, and it shows the way age shows on something that does not
    // age: not decay but AUTHORITY. Broader across the shoulder, and the
    // silk is the whole front of him rather than a glimpse at the collar.
    build: {
      torso: 1.02,
      shoulder: 1.1,
      arm: 1.0,
      hand: 1.0,
      neck: 0.96,
      skull: 1.0,
      jaw: 1.0,
      leg: 1.0,
    },
    zones: [
      torso('coat', 1.02, 1.62, 0.018),
      arms('coat', 0.86, 1.5, 0.016),
      pelvis('coat', 0.86, 1.1, 0.018),
      legsTo('coat', 0.36, 0.94, 0.016),
      feet('coat', 0.0, 0.2, 0.018),
      torso('silk', 1.14, 1.5, 0.024),
    ],
    mats: { coat: UNDEAD_RAMPS.darkCloth, silk: UNDEAD_RAMPS.bloodSilk },
    hideRamp: 'pallor',
    bootRamp: 'darkCloth',
    drape: { name: 'Formal Cloak', mat: 'coat' },
  },
  {
    id: MOBILE_TYPES.Ghost,
    name: 'Ghost',
    level: 11,
    damage: [10, 35],
    weaponTier: 0,
    // BEHAVIOUR: SPECTRAL — and the first design in this project that is
    // not a shape problem at all.
    //
    // Every enemy so far said what it was with geometry and colour: a
    // tusk, a rib, a horse, a robe. A ghost has nothing to add to the
    // figure and everything to take away from it. What makes it a ghost
    // is that you can see the wall through it, which is a MATERIAL
    // property, and the character path has never been asked for one.
    //
    // So the body is nearly untouched — a person's build, faded at the
    // edges — and the design carries `spectral` instead. The viewer
    // turns the body translucent for it. Nothing else changes.
    build: { torso: 0.94, shoulder: 0.96, arm: 0.92, hand: 0.92, neck: 0.9, skull: 0.96, jaw: 0.92, leg: 0.94 },
    zones: [],
    mats: {},
    hideRamp: 'spectral',
    bootRamp: 'spectral',
    // How much of it is there. Low enough to see through, high enough
    // to be a figure rather than a smear.
    spectral: { opacity: 0.42 },
    drape: null,
  },
  {
    id: MOBILE_TYPES.Wraith,
    name: 'Wraith',
    level: 15,
    damage: [10, 45],
    weaponTier: 0,
    // The same absence, gone further: colder, thinner, and LESS there.
    // A wraith at the ghost's opacity is just a blue ghost — the
    // difference between them has to be the same difference the eye
    // sees, which is how much of it is missing.
    build: { torso: 0.82, shoulder: 0.86, arm: 0.8, hand: 0.84, neck: 0.8, skull: 0.94, jaw: 0.86, leg: 0.84 },
    zones: [],
    mats: { shroud: UNDEAD_RAMPS.wraithBlue },
    hideRamp: 'wraithBlue',
    bootRamp: 'wraithBlue',
    spectral: { opacity: 0.3 },
    drape: { name: 'Plain Robes', mat: 'shroud' },
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
  // A DESIGN MAY WEAR SOMETHING. The villagers resolve their gown the
  // same way — a name and a material off the design's own table — so a
  // lich in robes goes through the drape path that already exists
  // rather than a second one built for it.
  const drape = design.drape ? { name: design.drape.name, ramp: mats[design.drape.mat] } : null;
  return {
    drape,
    // THE BOOT RAMP IS THE DESIGN'S TO CHOOSE. It was hardcoded to
    // gravecloth, which is right for a corpse that was buried in shoes
    // and wrong for a skeleton — it came out with brown feet under a
    // bone-white body, the one part of it that had not rotted.
    ramps: { skin: hide, boot: ramp(UNDEAD_RAMPS[design.bootRamp || 'gravecloth']) },
    opts: { build: design.build, clothZones: design.zones, armorZones: [], mats },
    hide,
  };
}
