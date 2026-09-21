// The Dwarven Thunderlock's numbers, and NOTHING ELSE - no imports at
// all, on purpose.
//
// systems/thunderlock.js is the weapon's home, but it reaches
// systems/itemTemplates.js to register its rows, and that file imports
// characters/weapons.js for the condition ladder. So a weapons.js that
// wanted the indices from the home would close a cycle
// (weapons -> thunderlock -> itemTemplates -> weapons) and leave one
// of the three holding an undefined const on the way up, depending on
// which the bundler reached first.
//
// A leaf breaks it. The same answer weaponAlign.js is to fpsWeapon's
// three integers: the law stays in one place, and the place has no
// dependencies to drag round behind it.

/** The two custom template indices. Past DFU's 288 and past Climates &
 *  Calories' 530-541, so registerCustomTemplates takes them and the
 *  frozen DFU table is not touched. */
export const THUNDERLOCK_TEMPLATE = 560;
export const PELLET_TEMPLATE = 561;

/** Its art archives - its own, not the classic weapon pair 233/234. */
export const THUNDERLOCK_ARCHIVE = 560;
export const PELLET_ARCHIVE = 561;

/**
 * THE AMMUNITION LINK: what does this weapon spend?
 *
 * Here on the leaf rather than with the weapon, because
 * systems/inventory.js is one of the askers and it is upstream of
 * everything systems/thunderlock.js touches - importing the home from
 * there would close a second cycle for the sake of one comparison.
 * Null for everything that spends nothing; the bow's own answer
 * (Arrow, 131) stays with the bow.
 */
export const ammoTemplateFor = (item) =>
  (item?.templateIndex === THUNDERLOCK_TEMPLATE ? PELLET_TEMPLATE : null);

/**
 * WHAT COMES OUT OF THE BARREL.
 *
 * FIELD-GUN14 (2026-09-20, Mac: "The projectile that shoots out
 * should be an orb, not an arrow").
 *
 * IT WAS AN ARROW, and by now the reason will be familiar: the shot
 * rides the port's RANGED lane, which is the bow's, and that lane
 * draws model 99800 - the arrow - oriented along its direction. A
 * lane written for the one ranged weapon Daggerfall has, asked about
 * this one, answering its default. Nothing went red, and a dwarven
 * firearm fired arrows.
 *
 * The orb is DAGGERFALL'S OWN, not new art: the spell missiles are
 * archives 375-379 (systems/spellcast.js's `missileArchive`), each an
 * animated glowing ball the game already loads and the hosts already
 * know how to draw. 378 is the SHOCK missile, and the pick is the
 * weapon's own name - a Thunderlock firing a crackling orb is the
 * thing it says on the tin. It is one constant, so it is one edit to
 * make it fire fire (375) or frost (376) instead.
 *
 * Here on the leaf with the other numbers, for the reason the file's
 * header gives: combat/arrowFlight.js and scenes/dungeonContext.js
 * are the two askers, and both are upstream of everything
 * systems/thunderlock.js touches.
 */
export const ORB_ARCHIVE = 378;
/** The flight record. Record 1 of the same archive is the IMPACT
 *  flash (AUDIT 26 F033), which is not this. */
export const ORB_RECORD = 0;

/** Does this weapon's shot fly as an orb? The archive, or null for
 *  every weapon whose shot is a shaft - which is all of DFU's. */
export const orbArchiveFor = (item) =>
  (item?.templateIndex === THUNDERLOCK_TEMPLATE ? ORB_ARCHIVE : null);

/**
 * THE ORB'S OWN COLOUR, SAMPLED RATHER THAN NAMED.
 *
 * FIELD-GUN17 (2026-09-20, Mac: "can we can the color of the muzzle
 * flash and the light emitted to the same color as the orb?").
 *
 * "The same colour as the orb" is answerable exactly or approximately,
 * and a constant here would be the approximate answer - a number
 * somebody typed after looking at a screenshot, which is then wrong the
 * day ORB_ARCHIVE changes. So the orb TELLS US: the first time its flat
 * is warmed, the archive's own texels are reduced to one colour and
 * parked, and the muzzle flash and the light it throws both read it.
 * Change the archive above and the flash follows on the next shot.
 *
 * WHITE UNTIL WARMED, which is the colour these two had before this
 * existed - so a shot fired on the frame the texture is still loading
 * looks exactly like the port did yesterday rather than like nothing.
 *
 * Here on the leaf because BOTH askers are: combat/weaponRig.js paints
 * the flash, systems/thunderlock.js answers the light, and
 * combat/arrowFlight.js is what sees the texture. A parked value and a
 * pure reducer add no imports, which is this file's whole rule.
 */
const _orb = { colour: [1, 1, 1], sampled: false };

/**
 * The reduction: the CHROMA-WEIGHTED mean of the opaque texels,
 * normalised so the brightest channel is 1.
 *
 * NORMALISED, not averaged raw, because this is a LIGHT's colour and a
 * tint's direction - not its strength. The strength is
 * `GUN_FEEL.flashRange` and the muzzle curve, which are already tuned;
 * handing them a dim mean would darken the flash as a side effect of
 * asking what colour it is. A black or empty record leaves white
 * alone, because "no answer" is not "no light".
 *
 * ═══ A GREY PIXEL HAS NO OPINION ABOUT HUE ════════════════════════
 *
 * FIELD-GUN19 (Mac: "The muzzle flash texture itself needs to be blue
 * like the orb and the lighting thats emitted needs to be blue").
 *
 * FIELD-GUN17 built this whole channel and the flash still came out
 * white, and the reason is the statistic rather than the wiring. This
 * took the alpha-weighted MEAN of every opaque texel - and a glowing
 * missile sprite is a BLOWN-OUT WHITE CORE inside a coloured halo. The
 * core is the brightest thing in the record and the most opaque, so it
 * dominated the mean; peak-normalising a near-white mean makes it
 * paler still, and the answer was a lavender indistinguishable from
 * the white it replaced.
 *
 * The core is white because it is over-exposed, not because the orb is
 * white. A texel with no saturation carries no information about what
 * colour the thing is, so it is not allowed to vote: the weight is
 * alpha TIMES CHROMA (max channel minus min). What is left voting is
 * the halo, which is where a viewer reads the colour from anyway.
 *
 * FALLING BACK IS PART OF THE RULE, not a guard: a genuinely
 * greyscale record has no chromatic texel at all, and the honest
 * answer there is the plain alpha-weighted mean it always gave - a
 * white orb should answer white, not nothing.
 */
export function orbColourFrom(color32) {
  const d = color32?.colors;
  if (!d || !d.length) return null;
  let r = 0, g = 0, b = 0, w = 0;          // chroma-weighted
  let pr = 0, pg = 0, pb = 0, pw = 0;      // plain alpha-weighted, for the greyscale fallback
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (!a) continue;
    const R = d[i], G = d[i + 1], B = d[i + 2];
    pr += R * a; pg += G * a; pb += B * a; pw += a;
    const chroma = Math.max(R, G, B) - Math.min(R, G, B);
    if (!chroma) continue;
    const k = a * chroma;
    r += R * k; g += G * k; b += B * k; w += k;
  }
  if (!w) { r = pr; g = pg; b = pb; w = pw; }   // nothing chromatic: the old answer, on purpose
  if (!w) return null;
  const peak = Math.max(r, g, b);
  if (peak <= 0) return null;
  return [r / peak, g / peak, b / peak];
}

/** Park it, once. Answers whether this call is the one that did. */
export function noteOrbColour(color32) {
  if (_orb.sampled) return false;
  const c = orbColourFrom(color32);
  if (!c) return false;
  _orb.colour = c; _orb.sampled = true;
  return true;
}

/** What the flash and its light are painted in. White until the orb
 *  has been seen, which is what they were before it was asked. */
export const orbColour = () => _orb.colour;
/** Test seam: the port never un-samples, but a suite drives more than
 *  one archive through this and must not inherit the last one's. */
export function resetOrbColour() { _orb.colour = [1, 1, 1]; _orb.sampled = false; }

/**
 * How far in front of the eye a shot is born.
 *
 * FIELD-GUN17: the muzzle offset is PROPORTIONAL to this - it is the
 * ray through the barrel's own pixel, so the orb lies on the barrel at
 * any distance and this only picks how far out it starts. Half a unit
 * is a little over one step of MISSILE_SPEED at 60fps and comfortably
 * past the 0.2 near plane: near enough to read as leaving the gun, far
 * enough not to be born inside the viewmodel.
 */
export const MUZZLE_FORWARD = 0.5;

/**
 * FIELD-GUN18 (Mac: "shrink the projectile orb slighty").
 *
 * The orb flies on TEXTURE.378 record 0 - a classic MISSILE archive,
 * sized for a spell. A fireball is meant to fill the corridor it is
 * coming down; a pellet out of a barrel is not, and at the archive's
 * own size the shot read as a thrown spell rather than as ammunition.
 *
 * A SCALE, not a second size: `billboardSize` is DFU's own law
 * (RMBLayout's scaleDivisor, plus any billboard XML the player has
 * installed for that archive), and hard-coding a width here would
 * quietly opt the orb out of both. This multiplies whatever that law
 * answers, so a texture pack that resizes 378 still resizes the orb.
 *
 * Slightly, as asked: a sixth off, which is a smaller pellet and not a
 * different object.
 */
export const ORB_SCALE = 0.85;
