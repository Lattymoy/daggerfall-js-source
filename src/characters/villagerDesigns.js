// THE VILLAGER DESIGNS - the 25 wandering-townsperson variations as
// data for the neutral-body rig (tools/neutral's viewer is the editor).
//
// Mac's call: these are FULLY REDESIGNED, not traced from the classic
// sprites. tools/neutral/README.md retired the 1:1 silhouette pin and
// the sprite-trace architecture for this model, and the villagers
// follow it. The classic archives still decide the ROSTER - which race,
// which gender, how many - because SetPerson spawns by that table, and
// tools/villagerSheet.mjs renders them all if you want the old look
// beside the new one.
//
// THE ROSTER IS NOT OURS TO CHOOSE: mobilePerson.js's PERSON_TEXTURES
// is 3 races x 2 genders x 4 archives, plus the city guard. Every
// archive needs a design or the town spawns a villager with none, and
// test/villagerdesigns.test.js fails if the two ever drift apart.
//
// ── the format ────────────────────────────────────────────────────
// Each design is consumed by buildNeutralBody(ramps, opts):
//   opts.clothZones - the garment zones, each a body region + a
//     vertical band + a thickness; the rig THICKENS its own surface
//     there and recolours it (armor-as-body: no separate mesh, and it
//     animates with the body for free).
//   opts.mats       - material name -> ART_PAL ramp.
// A design's `drape` is NOT a zone: see below.
// Colour is an ART_PAL INDEX SPAN, never free RGB: the rig snaps each
// face to a ramp step, which is what makes the blocky look. The spans
// below are real blocks of the loaded palette (16 blocks of 16, most
// running light -> dark), so every garment is a classic colour.
//
// ── hanging cloth is NOT a zone ───────────────────────────────────
// A skirt, gown, robe or surcoat hangs AWAY from the body, and
// armor-as-body cannot make one: a zone spanning [body, legL, legR]
// thickens EACH LEG about its own centre, so the render came back as a
// tunic plus a pair of shorts, never a gown. That is a property of
// `displace`, not a tuning mistake - it pushes a group's faces out
// from that group's axis, which is exactly what you want for a sleeve
// and exactly wrong for a hem that bridges two legs.
//
// pieces/draped.js already solves it, and did before these designs
// existed: DRAPED_NAMES is a garment list with a standoff grid per
// name, driven by clothSim.js so the hem swings. So a design's hanging
// cloth is a `drape: { name, mat }` - `name` picks the garment out of
// DRAPED_NAMES, `mat` names one of the design's own ART_PAL ramps so
// the drape is dyed from the same palette as the rest of the outfit
// rather than draped.js's built-in DRAPE_MATERIAL colour. Everything
// that lies ON the body stays a zone.
//
// ── the engine seam ───────────────────────────────────────────────
// neutralBody.js's cloth loop used to hardcode its material:
//     displace(z.groups, z.yLo, z.yHi, z.th ?? 0.008, cxFor, 1, 'cloth')
// so a whole outfit resolved to ONE colour. It now passes
// `z.mat || 'cloth'`, matching the armour loop directly above it. That
// is the only engine change these designs needed, and it is inert for
// the game: no src/ caller passes clothZones at all.

/** ART_PAL ramps as [firstIndex, lastIndex], light -> dark. The palette
 *  is laid out in 16 blocks of 16 and MOST blocks are a clean ramp, so
 *  a span inside one block shades with no hand-picking.
 *
 *  TWO BLOCKS ARE NOT, and both bit on the first pass:
 *  - block 11 restarts mid-block. 176-181 falls 126 -> 91, then 182
 *    JUMPS BACK to 105 and falls again to 25. A span across that seam
 *    lights the middle of the garment brighter than its top, so
 *    terracotta takes the second half only.
 *  - block 13 is a CLIFF, not a ramp: 208-215 covers just 130 -> 100
 *    and then 216 drops to 40. Too flat to shade with either side of
 *    it, so leather comes from block 4 instead, which runs the full
 *    245 -> 45 in one piece.
 *  - block 1 is a MIXED block, and it slipped through the first pin
 *    because its LUMINANCE is monotone: it alternates gold
 *    (206,159,73) with neutral grey (165,156,156), so a garment cut
 *    from it shades in speckles rather than a ramp. The colour proof
 *    (tools/villagerDesignSheet.mjs) showed it immediately where the
 *    numbers had not, and the pin now measures HUE coherence too.
 *  The pin in test/villagerdesigns.test.js walks every span on the real
 *  palette and fails on a non-monotone or flat ramp, so this cannot
 *  quietly regress. */
export const RAMPS = Object.freeze({
  flesh:      [34, 44],    // block 2  - tan -> brown
  rose:       [48, 58],    // block 3  - pink -> mauve
  bone:       [64, 72],    // block 4  - cream -> tan (undyed linen)
  slate:      [80, 92],    // block 5  - lavender grey -> slate
  indigo:     [96, 108],   // block 6  - light blue -> deep blue
  ash:        [112, 124],  // block 7  - white -> charcoal
  teal:       [128, 140],  // block 8  - pale cyan -> deep teal
  saffron:    [144, 156],  // block 9  - yellow -> olive
  moss:       [160, 172],  // block 10 - pale green -> deep green
  terracotta: [182, 191],  // block 11 - rust -> dark brown (see below)
  sage:       [192, 204],  // block 12 - pale yellow-green -> green
  leather:    [70, 79],    // block 4  - tan -> dark brown (shares
                           //            block 4 with bone: undyed cloth and
                           //            tanned hide ARE one hue family)
  amber:      [224, 236],  // block 14 - cream -> orange
  madder:     [240, 251],  // block 15 - orange-red -> dark red
});

/** Proportion presets. The rig's own HSCALE already squashes everyone
 *  0.9 for the stocky Daggerfall build; these are bodySpec deltas on
 *  top, so a crowd is not one figure repainted 25 times. */
export const BUILDS = Object.freeze({
  slight:  { chestScale: 0.94, shoulder: 0.95, height: 0.97 },
  average: { chestScale: 1.00, shoulder: 1.00, height: 1.00 },
  broad:   { chestScale: 1.09, shoulder: 1.10, height: 1.02 },
  stout:   { chestScale: 1.12, shoulder: 1.02, height: 0.95 },
  tall:    { chestScale: 0.98, shoulder: 1.02, height: 1.06 },
});

// ── zone helpers, mirroring clothing.js's vocabulary ──────────────
// A zone is { groups, yLo, yHi, th, mat } (+ arm/leg so the rig knows
// which centre to push away from). Thicknesses: a shift is thin, a
// coat is thick, so layers read as layers.
const B = 'body', AL = 'armL', AR = 'armR', LL = 'legL', LR = 'legR';
const torso   = (mat, yLo, yHi = 1.62, th = 0.008) => ({ groups: [B], yLo, yHi, th, mat });
const sleeves = (mat, yLo, yHi = 1.62, th = 0.008) => ({ groups: [AL, AR], yLo, yHi, th, mat, arm: true });
const legs    = (mat, yLo, yHi = 1.00, th = 0.008) => ({ groups: [LL, LR], yLo, yHi, th, mat, leg: true });
const pelvis  = (mat, yLo = 0.90, yHi = 1.14, th = 0.010) => ({ groups: [B], yLo, yHi, th, mat });
const feet    = (mat, yLo = 0.00, yHi = 0.16, th = 0.012) => ({ groups: [LL, LR], yLo, yHi, th, mat, leg: true });
const sash    = (mat, yLo = 1.06, yHi = 1.20, th = 0.014) => ({ groups: [B], yLo, yHi, th, mat });
// A HOOD IS TWO ZONES, because a hood has a face opening. Gated on
// height alone it paints the skull front - the render came back with a
// green face. The rig's head runs y 1.70 -> 2.03 and z -0.155 (nape)
// -> 0.125 (brow), so: everything from the temples BACK (zHi 0.03,
// down onto the shoulders), plus the crown and forehead above the brow
// at any depth. What is left uncovered is the oval a hood frames.
const hood    = (mat, th = 0.022) => [
  { groups: ['head', B], yLo: 1.58, yHi: 2.06, th, mat, zHi: 0.03 },
  { groups: ['head'],    yLo: 1.93, yHi: 2.06, th, mat },
];
const collar  = (mat, yLo = 1.44, yHi = 1.60, th = 0.018) => ({ groups: [B, AL, AR], yLo, yHi, th, mat });

// A helper may return SEVERAL zones (a hood is a wrap plus a crown),
// so the literals below are flattened once and every consumer - the
// build, the tests, the renderer - sees one flat list.
const flattenZones = (list) => list.map((d) => ({ ...d, zones: d.zones.flat() }));

/** The 25. Four per race+gender spanning a town's social range -
 *  labourer, tradesperson, merchant, gentry - so a crowd reads as a
 *  place with work in it rather than a costume parade. Each race keeps
 *  its own cut and palette family:
 *    REDGUARD (Hammerfell, arid)  - loose light layers, wrapped sashes,
 *      forearms bare, sandals; cream, saffron, terracotta, indigo.
 *    NORD (the cold north)        - heavy wool, hoods, layered wraps,
 *      tall boots; slate, moss, rust, leather.
 *    BRETON (High Rock, courtly)  - tailored and structured, fuller
 *      skirts, deeper dye; indigo, rose, teal, madder. */
export const VILLAGER_DESIGNS = Object.freeze(flattenZones([
  // ── Redguard, male ──────────────────────────────────────────────
  { archive: 381, race: 'Redguard', gender: 'male', name: 'Water carrier', build: 'broad',
    hair: { style: 'buzz', ramp: 'black' },
    zones: [torso('linen', 1.16), sash('sash'), pelvis('linen', 0.94, 1.16), feet('sandal', 0, 0.09)],
    mats: { linen: RAMPS.bone, sash: RAMPS.terracotta, sandal: RAMPS.leather } },
  { archive: 382, race: 'Redguard', gender: 'male', name: 'Kiln hand', build: 'broad',
    hair: { style: 'short', ramp: 'black' },
    zones: [pelvis('wrap', 0.90, 1.22, 0.020), legs('wrap', 0.74, 0.96), feet('sandal', 0, 0.09)],
    mats: { wrap: RAMPS.ash, sandal: RAMPS.leather } },   // stripped to the waist for the heat
  { archive: 383, race: 'Redguard', gender: 'male', name: 'Spice seller', build: 'average',
    hair: { style: 'medium', ramp: 'black' },
    zones: [torso('robe', 1.04), sleeves('robe', 1.30), sash('sash'), feet('sandal', 0, 0.09)],
    drape: { name: 'Plain Robes', mat: 'robe' },
    mats: { robe: RAMPS.teal, sash: RAMPS.saffron, sandal: RAMPS.leather } },
  { archive: 384, race: 'Redguard', gender: 'male', name: 'Caravan master', build: 'tall',
    hair: { style: 'ponytail', ramp: 'black' },
    zones: [collar('coat'), torso('coat', 1.10), sleeves('coat', 1.22), sash('sash'), feet('boot', 0, 0.20)],
    drape: { name: 'Anticlere Surcoat', mat: 'coat' },
    mats: { coat: RAMPS.indigo, sash: RAMPS.amber, boot: RAMPS.leather } },

  // ── Redguard, female ────────────────────────────────────────────
  { archive: 395, race: 'Redguard', gender: 'female', name: 'Well keeper', build: 'average',
    hair: { style: 'long', ramp: 'black' },
    zones: [torso('shift', 1.20), sash('sash'), feet('sandal', 0, 0.09)],
    drape: { name: 'Long Skirt', mat: 'shift' },
    mats: { shift: RAMPS.bone, sash: RAMPS.madder, sandal: RAMPS.leather } },
  { archive: 396, race: 'Redguard', gender: 'female', name: 'Dyer', build: 'slight',
    hair: { style: 'topknot', ramp: 'black' },
    zones: [torso('shift', 1.16), sleeves('shift', 1.34), sash('sash'), feet('sandal', 0, 0.09)],
    drape: { name: 'Long Skirt', mat: 'overskirt' },
    mats: { shift: RAMPS.saffron, overskirt: RAMPS.terracotta, sash: RAMPS.teal, sandal: RAMPS.leather } },
  { archive: 397, race: 'Redguard', gender: 'female', name: 'Herbalist', build: 'average',
    hair: { style: 'medium', ramp: 'black' },
    zones: [hood('veil'), torso('shift', 1.12), sleeves('shift', 1.26), feet('sandal', 0, 0.09)],
    drape: { name: 'Long Skirt', mat: 'shift' },
    mats: { veil: RAMPS.sage, shift: RAMPS.moss, sandal: RAMPS.leather } },
  { archive: 398, race: 'Redguard', gender: 'female', name: 'Silk factor', build: 'tall',
    hair: { style: 'long', ramp: 'black' },
    zones: [hood('veil'), collar('gown'), torso('gown', 1.10), sleeves('gown', 1.20), sash('sash'), feet('slipper', 0, 0.08)],
    drape: { name: 'Casual Dress', mat: 'gown' },
    mats: { veil: RAMPS.indigo, gown: RAMPS.indigo, sash: RAMPS.amber, slipper: RAMPS.rose } },

  // ── Nord, male ──────────────────────────────────────────────────
  { archive: 387, race: 'Nord', gender: 'male', name: 'Woodcutter', build: 'broad',
    hair: { style: 'medium', ramp: 'blonde' },
    zones: [torso('wool', 1.14), sleeves('wool', 1.30), legs('trews', 0.30), feet('boot', 0, 0.26)],
    mats: { wool: RAMPS.moss, trews: RAMPS.leather, boot: RAMPS.leather } },
  { archive: 388, race: 'Nord', gender: 'male', name: 'Fisher', build: 'stout',
    hair: { style: 'short', ramp: 'brown' },
    zones: [hood('hood'), torso('wool', 1.10), sleeves('wool', 1.24), legs('trews', 0.26), feet('boot', 0, 0.30)],
    mats: { hood: RAMPS.slate, wool: RAMPS.terracotta, trews: RAMPS.ash, boot: RAMPS.leather } },
  { archive: 389, race: 'Nord', gender: 'male', name: 'Smith', build: 'broad',
    hair: { style: 'topknot', ramp: 'brown' },
    zones: [torso('jerkin', 1.16, 1.56, 0.016), sleeves('wool', 1.36), pelvis('apron', 0.86, 1.18, 0.022), legs('trews', 0.30), feet('boot', 0, 0.24)],
    mats: { jerkin: RAMPS.leather, wool: RAMPS.teal, apron: RAMPS.leather, trews: RAMPS.slate, boot: RAMPS.leather } },
  { archive: 390, race: 'Nord', gender: 'male', name: 'Timber factor', build: 'tall',
    hair: { style: 'ponytail', ramp: 'blonde' },
    zones: [collar('coat'), torso('coat', 1.08), sleeves('coat', 1.22), legs('trews', 0.30), feet('boot', 0, 0.28)],
    drape: { name: 'Anticlere Surcoat', mat: 'coat' },
    mats: { coat: RAMPS.moss, trews: RAMPS.ash, boot: RAMPS.leather } },

  // ── Nord, female ────────────────────────────────────────────────
  { archive: 392, race: 'Nord', gender: 'female', name: 'Brewer', build: 'stout',
    hair: { style: 'long', ramp: 'blonde' },
    zones: [torso('wool', 1.18), sleeves('wool', 1.32), pelvis('apron', 0.88, 1.16, 0.020), feet('boot', 0, 0.20)],
    drape: { name: 'Long Skirt', mat: 'wool' },
    mats: { wool: RAMPS.slate, apron: RAMPS.bone, boot: RAMPS.leather } },
  { archive: 393, race: 'Nord', gender: 'female', name: 'Netmender', build: 'average',
    hair: { style: 'ponytail', ramp: 'brown' },
    zones: [hood('hood'), torso('wool', 1.14), sleeves('wool', 1.28), feet('boot', 0, 0.22)],
    drape: { name: 'Long Skirt', mat: 'wool' },
    mats: { hood: RAMPS.teal, wool: RAMPS.teal, boot: RAMPS.leather } },
  { archive: 451, race: 'Nord', gender: 'female', name: 'Shepherd', build: 'average',
    hair: { style: 'medium', ramp: 'blonde' },
    zones: [hood('shawl'), torso('wool', 1.12), sleeves('wool', 1.26), feet('boot', 0, 0.26)],
    drape: { name: 'Long Skirt', mat: 'wool' },
    mats: { shawl: RAMPS.moss, wool: RAMPS.sage, boot: RAMPS.leather } },
  { archive: 452, race: 'Nord', gender: 'female', name: 'Hall matron', build: 'tall',
    hair: { style: 'long', ramp: 'blonde' },
    zones: [hood('shawl'), collar('gown'), torso('gown', 1.06), sleeves('gown', 1.18), sash('sash'), feet('boot', 0, 0.18)],
    drape: { name: 'Casual Dress', mat: 'gown' },
    mats: { shawl: RAMPS.ash, gown: RAMPS.slate, sash: RAMPS.madder, boot: RAMPS.leather } },

  // ── Breton, male ────────────────────────────────────────────────
  { archive: 385, race: 'Breton', gender: 'male', name: 'Carter', build: 'average',
    hair: { style: 'short', ramp: 'brown' },
    zones: [torso('wool', 1.16), sleeves('wool', 1.30), legs('hose', 0.28), feet('shoe', 0, 0.12)],
    mats: { wool: RAMPS.terracotta, hose: RAMPS.ash, shoe: RAMPS.leather } },
  { archive: 386, race: 'Breton', gender: 'male', name: 'Cooper', build: 'stout',
    hair: { style: 'medium', ramp: 'brown' },
    zones: [torso('doublet', 1.12, 1.58, 0.014), sleeves('wool', 1.32), pelvis('apron', 0.88, 1.18, 0.020), legs('hose', 0.28), feet('shoe', 0, 0.12)],
    mats: { doublet: RAMPS.teal, wool: RAMPS.bone, apron: RAMPS.leather, hose: RAMPS.slate, shoe: RAMPS.leather } },
  { archive: 391, race: 'Breton', gender: 'male', name: 'Clerk', build: 'slight',
    hair: { style: 'short', ramp: 'blonde' },
    zones: [collar('gown'), torso('gown', 1.06), sleeves('gown', 1.16), feet('shoe', 0, 0.12)],
    drape: { name: 'Plain Robes', mat: 'gown' },
    mats: { gown: RAMPS.indigo, shoe: RAMPS.leather } },
  { archive: 394, race: 'Breton', gender: 'male', name: 'Guildmaster', build: 'broad',
    hair: { style: 'medium', ramp: 'brown' },
    zones: [hood('chaperon'), collar('coat'), torso('coat', 1.04), sleeves('coat', 1.14), sash('chain'), feet('shoe', 0, 0.14)],
    drape: { name: 'Dwynnen Surcoat', mat: 'coat' },
    mats: { chaperon: RAMPS.madder, coat: RAMPS.madder, chain: RAMPS.saffron, shoe: RAMPS.leather } },

  // ── Breton, female ──────────────────────────────────────────────
  { archive: 453, race: 'Breton', gender: 'female', name: 'Baker', build: 'stout',
    hair: { style: 'topknot', ramp: 'blonde' },
    zones: [torso('kirtle', 1.16), sleeves('kirtle', 1.30), pelvis('apron', 0.86, 1.16, 0.020), feet('shoe', 0, 0.12)],
    drape: { name: 'Long Skirt', mat: 'kirtle' },
    mats: { kirtle: RAMPS.amber, apron: RAMPS.bone, shoe: RAMPS.leather } },
  { archive: 454, race: 'Breton', gender: 'female', name: 'Seamstress', build: 'slight',
    hair: { style: 'medium', ramp: 'blonde' },
    zones: [torso('bodice', 1.18, 1.56, 0.014), sleeves('shift', 1.28), feet('shoe', 0, 0.12)],
    drape: { name: 'Long Skirt', mat: 'kirtle' },
    mats: { bodice: RAMPS.madder, shift: RAMPS.bone, kirtle: RAMPS.indigo, shoe: RAMPS.leather } },
  { archive: 455, race: 'Breton', gender: 'female', name: 'Almswoman', build: 'average',
    hair: { style: 'long', ramp: 'brown' },
    zones: [hood('coif'), torso('kirtle', 1.12), sleeves('kirtle', 1.26), feet('shoe', 0, 0.12)],
    drape: { name: 'Long Skirt', mat: 'kirtle' },
    mats: { coif: RAMPS.terracotta, kirtle: RAMPS.terracotta, shoe: RAMPS.leather } },
  { archive: 456, race: 'Breton', gender: 'female', name: 'Merchant wife', build: 'tall',
    hair: { style: 'long', ramp: 'blonde' },
    zones: [collar('gown'), torso('gown', 1.04), sleeves('shift', 1.14), sash('sash'), feet('slipper', 0, 0.08)],
    drape: { name: 'Casual Dress', mat: 'gown' },
    mats: { gown: RAMPS.rose, shift: RAMPS.ash, sash: RAMPS.saffron, slipper: RAMPS.rose } },

  // ── the city watch ──────────────────────────────────────────────
  // The one villager who is not cloth: the guard rides armorZones, so
  // its plate sits OVER a cloth layer at the armour thickness.
  { archive: 399, race: 'Guard', gender: 'any', name: 'City watch', build: 'broad',
    hair: { style: 'buzz', ramp: 'brown' },
    zones: [torso('gambeson', 1.06), sleeves('gambeson', 1.20), legs('gambeson', 0.24), feet('boot', 0, 0.26)],
    armor: [
      { groups: [B], yLo: 1.14, yHi: 1.58, th: 0.026, mat: 'steel' },                       // cuirass
      { groups: [AL, AR], yLo: 1.16, yHi: 1.50, th: 0.022, mat: 'steel', arm: true },       // pauldron + vambrace
      { groups: [LL, LR], yLo: 0.30, yHi: 0.96, th: 0.022, mat: 'steel', leg: true },       // greaves
      { groups: ['head'], yLo: 1.60, yHi: 1.96, th: 0.024, mat: 'steel' },                  // closed helm
    ],
    mats: { gambeson: RAMPS.ash, boot: RAMPS.leather, steel: RAMPS.slate } },
]));

/** The design for a spawned person. `archive` is the only key that
 *  matters - race and gender ride along for readability and are pinned
 *  against PERSON_TEXTURES by the test. */
/** Skin tone per race, naming an entry of palettes.js's human list
 *  (Pale, Fair, Tan, Olive, Brown, Deep). The rig race stays Human -
 *  Redguard, Nord and Breton all are - so the tone is what carries the
 *  difference, and an undyed linen tunic needs it: on one flat tan
 *  body a cream garment is within a few ramp steps of the skin under
 *  it and the villager reads as unclothed. */
export const RACE_TONE = Object.freeze({
  Redguard: 'Deep', Nord: 'Pale', Breton: 'Fair',
  Guard: 'Tan',   // the city watch spawns for ANY race - a middle tone
});

export function designForArchive(archive) {
  return VILLAGER_DESIGNS.find((d) => d.archive === archive) ?? null;
}

/** The build options for buildNeutralBody: the cloth zones, the armour
 *  zones, and every material resolved from an ART_PAL index span to the
 *  ramp the rig snaps faces to. `pal` is a loaded DFPalette. */
export function designOpts(design, pal) {
  const ramp = ([a, b]) => {
    const out = [];
    for (let i = b; i >= a; i--) { const c = pal.get(i); out.push([c.r, c.g, c.b]); }
    return out;   // dark -> light: the rig indexes ramps by lighting intensity
  };
  const mats = {};
  for (const [name, span] of Object.entries(design.mats)) mats[name] = ramp(span);
  return { clothZones: design.zones, armorZones: design.armor ?? [], mats };
}

/** A design's hanging cloth, resolved: `{ name, ramp }` for
 *  drapedPiece/drapedGrid, or null if this villager wears none.
 *
 *  `ramp` is the design's own ART_PAL span turned dark -> light, which
 *  is the order shadePiece indexes by lighting intensity - the same
 *  order designOpts mints - so the drape is dyed to match the outfit
 *  instead of taking draped.js's built-in DRAPE_MATERIAL colour. */
export function designDrape(design, pal) {
  if (!design.drape) return null;
  const span = design.mats[design.drape.mat];
  if (!span) return null;
  const ramp = [];
  for (let i = span[1]; i >= span[0]; i--) { const c = pal.get(i); ramp.push([c.r, c.g, c.b]); }
  return { name: design.drape.name, ramp };
}

/** A villager as a DELTA over the bare body's face list.
 *
 *  A design's zones DISPLACE the body's own faces and recolour them -
 *  armor-as-body adds no geometry - so every villager shares the base
 *  face list and only the touched faces differ. Shipping 25 whole
 *  bodies into the standalone viewer would be megabytes; the delta is
 *  the indices that changed, their new corners, and their new colour.
 *  Normals are not carried because `displace` moves corners and leaves
 *  f.n alone.
 *
 *  Positions are quantised the same way the viewer's own payload is
 *  (round to 1/1000) so a delta face lands on exactly the value a
 *  full build would have produced. */
export function villagerDelta(baseFaces, villagerFaces) {
  const idx = [], P = [], C = [];
  for (let i = 0; i < villagerFaces.length; i++) {
    const a = villagerFaces[i], b = baseFaces[i];
    let moved = false;
    for (let k = 0; k < 12; k++) if (Math.abs(a.p[k] - b.p[k]) > 1e-6) { moved = true; break; }
    const recoloured = a.c[0] !== b.c[0] || a.c[1] !== b.c[1] || a.c[2] !== b.c[2];
    if (!moved && !recoloured) continue;
    idx.push(i);
    for (let k = 0; k < 12; k++) P.push(Math.round(a.p[k] * 1000));
    C.push(a.c[0], a.c[1], a.c[2]);
  }
  return { idx, P, C };
}
