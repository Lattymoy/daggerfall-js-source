// @ts-check
// WEAPON-GLOW1 (2026-10-16, Mac: "What if we designed our own sort of animated outline for each element? And even
// introduced the same, more detailed design for the morrowind weapons?" ... "this is your baby. I want you to make the
// decisions"): WHAT A WEAPON'S GLOW SAYS. bible/05-Combat/Weapon-Glow.md is the page.
//
// Daggerfall says one thing about a weapon in the hand: enchanted or not. ItemHelper.ConvertItemToAPIWeaponType
// promotes an enchanted item to its *_Magic type and the rig swings the WEAPO1xx sheet, the same frames painted with a
// glow (combat/fpsWeapon.js weaponTypeForItem). The loot ladder's weapons carry more than that - a blow of fire, frost
// or shock (LOOT4's `elemental` line, a Ruby's or a Sapphire's gem) - and the hand said none of it: a Magic blade with
// "+3 Fire damage" swung the plain sheet (it carries no DFU enchantment), and every Morrowind weapon swung bare.
//
// THE LAW, decided here once for every drawer (the classic sprite's outline, render/renderer.js drawScreenQuadGlow; the
// Morrowind weapon's rings and charge, render/renderer.js _drawWeaponGlow - their drawing render/weaponGlowGlsl.js):
//   1. THE ELEMENT IS THE BLOW'S. A weapon's element is what its blow carries - its `elemental` lines, rolled or
//      socketed, read as the blow reads them (lootRarity.js readLines: a gem's line within its piece's cap). Nothing
//      else names one: a Legendary's power (Venom, Dragonfire, Chain Lightning) is its record's own, and a
//      cast-when-strikes enchantment is a spell.
//   2. ONE ELEMENT SHOWS - the most of it; a tie goes in PROC_ELEMENTS' order (fire, frost, shock).
//   3. ITS STRENGTH IS THE BAND ITS TOTAL READS IN: 1 to 3, 2 to 6, 3 past 6 - a Legendary line above its floor, or a
//      line and its gems together (a Rare line of 3 reads 1, a Legendary's floor 2 - the total says it, not the tier).
//   4. THE OUTLINE SAYS NO MORE THAN THE CARD. An unidentified piece's "Unidentified" hides every line (lootRarity.js
//      rarityKnown), and the hand hides its element with it: the classic rig swings what DFU swings (the WEAPO1xx
//      sheet, it is enchanted), the Morrowind hand the arcane glow.
//   5. ARCANE IS THE MORROWIND HAND'S OWN: an enchanted weapon with no element showing takes the enchanted look the
//      classic hand takes off its WEAPO1xx sheet - the Morrowind models have no second sheet, so it is drawn. It is
//      DFU's enchantment that answers (inventory.js isEnchanted), the ladder's switch or not: a MAGIC.DEF blade glows
//      with the ladder off as its sheet does. An Aetheric piece carries none, so with no element it swings bare.
//   6. THE SWITCH: `weaponGlow` (the Features row, systems/features.js), on by default; `?weaponglow=off` the kill door.
//      The loot ladder's own switch answers first - off, no line is read (lootPowers.js linesOf), so no element shows.
//   7-8. ARMORY's weapon piece (armoryWeaponLook), and GILDED-GLOW's crimson over every other look (GILDED_LEVEL).

import { readLines, validAffix, PROC_ELEMENTS, lootRarityOn, rarityKnown, RARITIES } from './loot/lootRarity.js';
import { isEnchanted } from './inventory.js';
import { isHandWraps } from '../characters/handWrapsIds.js'; // HAND-WRAPS: the fists' arcane outline
import { getPref } from './uiPrefs.js';
import { pageParam } from './pageQuery.js';
import { GLOW_SPRITE_WINDOW } from '../render/weaponGlowGlsl.js'; // the sprite's search window - a leaf with no imports
import { ownArmory } from './ownGlyphs.js'; // ARMORY: the Aura Armory kit this device's player wears
import { armoryKitPieces } from '../net/armoryLaw.js';
import { isGilded } from './gilded.js'; // GILDED-GLOW: law 8, the rung's own look

/** The pref the Features row stores. */
export const WEAPON_GLOW_PREF = 'weaponGlow';

/** The switch: the pref, and no kill door on the URL. Injectable for tests. */
export function weaponGlowOn(search = globalThis.location?.search ?? '', pref = getPref(WEAPON_GLOW_PREF)) {
  if (pageParam('weaponglow', search) === 'off') return false;
  return pref !== false;
}

/** The looks, by the code the shaders read (`uGlowLook`): 0 is none. */
export const GLOW_LOOKS = Object.freeze(['none', 'fire', 'frost', 'shock', 'arcane', 'brand', 'edge', 'gilded']); // ARMORY: the Aura Armory's two weapon pieces; GILDED-GLOW: the rung's (law 8) last
export const GLOW_CODE = Object.freeze(Object.fromEntries(GLOW_LOOKS.map((k, i) => [k, i])));

/** Law 3: the strength a total reads at - the elemental bands' own edges (lootRarity.js AFFIX_RANGES.elemental). */
export const GLOW_LEVEL_EDGES = Object.freeze([3, 6]);
export const glowLevel = (total) => (total <= GLOW_LEVEL_EDGES[0] ? 1 : total <= GLOW_LEVEL_EDGES[1] ? 2 : 3);

/** Law 1 and 2 as the hot path asks them - every frame, for the held weapon and every peer's - so no object is built:
 *  the index in PROC_ELEMENTS of the element a weapon's blow carries, or -1, its total left in `_total`. Law 4: -1 for
 *  a piece whose lines are not yet known, and with the ladder off. */
const _sums = PROC_ELEMENTS.map(() => 0);
let _total = 0;
function elementIndex(item, ladder) {
  _total = 0;
  if (!ladder || !item || !Array.isArray(item.affixes) || !rarityKnown(item)) return -1;
  _sums.fill(0);
  for (const a of readLines(item)) {
    if (a?.id !== 'elemental' || !validAffix(a)) continue; // validAffix: its param one of PROC_ELEMENTS, its value in band
    _sums[PROC_ELEMENTS.indexOf(a.param)] += a.value;
  }
  let best = -1;
  for (let i = 0; i < _sums.length; i++) if (_sums[i] > 0 && (best < 0 || _sums[i] > _sums[best])) best = i;
  if (best >= 0) _total = _sums[best];
  return best;
}

/**
 * Law 1 and 2: the element a weapon's blow carries, and how much - `{ element, total }`, or null.
 * @param {any} item
 * @param {{ ladder?: boolean }} [opts]
 */
export function weaponElement(item, { ladder = lootRarityOn() } = {}) {
  const i = elementIndex(item, ladder);
  return i < 0 ? null : { element: PROC_ELEMENTS[i], total: _total };
}

/** The spec a weapon wears, or null - the hot path: no object built, the switches read only for a weapon in hand. */
function specOf(item, arcane, on, ladder) {
  if (!item || !(on ?? weaponGlowOn())) return null;
  if (item.glowSet) {
    const set = glowFromWord(item.glowSet);
    if (set) return set;
  } // GLOW-SET: law 9, a staff's pick, first
  if (isHandWraps(item)) return fistGlow(undefined, true); // WRAPS-AURA (as the owner asked): wraps glow by the weapon aura alone
  if (isGilded(item) && (ladder ?? lootRarityOn())) return glowSpec('gilded', GILDED_LEVEL); // GILDED-GLOW: law 8, first
  const i = elementIndex(item, ladder ?? lootRarityOn());
  if (i >= 0) return glowSpec(PROC_ELEMENTS[i], glowLevel(_total));
  const worn = armoryWeaponLook(); // ARMORY: law 7 - the Aura Armory's weapon piece, where no element shows
  if (worn) return glowSpec(worn, ARMORY_LEVEL);
  return arcane && isEnchanted(item) ? glowSpec('arcane', ARCANE_LEVEL) : null;
}
/** Law 7's one strength. */
export const ARMORY_LEVEL = 2;
/** ARMORY (2026-10-28; bible/04-Characters/Aura-Armory.md section 5): THE WEAPON PIECE'S LOOK - law 7. A weapon in this
 *  player's hand wears the Aura Armory's weapon piece their kit holds (systems/ownGlyphs.js ownArmory): the Brand of the
 *  Breach a molten fire running down it, the Eternal Edge a blue-violet line with a light running along it. An element
 *  shows first - it is the blow's truth (law 1) - and the piece before the arcane look. Every hand is this player's (the
 *  classic sheet, the Morrowind hands, the look a peer is sent), so one read serves them all. */
export const ARMORY_GLOW = Object.freeze({ breachbrand: 'brand', eternaledge: 'edge' });
export function armoryWeaponLook(kit = ownArmory()) {
  const key = armoryKitPieces(kit).weapon;
  return key ? (ARMORY_GLOW[/** @type {keyof typeof ARMORY_GLOW} */ (key)] ?? null) : null;
}
/** ARMORY-FISTS (2026-10-30, as the owner asked): law 7
 *  on a BARE fist. A fist in Hand Wraps already wears it through the wraps; one with nothing wears the kit's weapon
 *  piece itself. `kit` is mine by default, a peer's as their token says it. */
export function fistGlow(kit = ownArmory(), on = weaponGlowOn()) {
  const look = on ? armoryWeaponLook(kit) : null;
  return look ? glowSpec(look, ARMORY_LEVEL) : null;
}
/** The look of a kit whose ONLY piece is a weapon's - the shop's stage for it is the blade's (render/weaponPiecePreview.js),
 *  since the body pass draws no weapon piece; null for any other kit. Pure. */
export const armoryWeaponStage = (/** @type {unknown} */ kit) =>
  Object.entries(armoryKitPieces(kit)).every(([s, k]) => s === 'weapon' || !k) ? armoryWeaponLook(kit) : null;
/** GLOW-SET (2026-10-30, as the owner asked): LAW 9, A GLOW SET ON THE PIECE.
 *  A staff member's `/glow` (systems/staffGlow.js) writes one of the wire's words on the weapon or Hand Wraps in hand, as
 *  `glowSet`. It shows over every other law: it is a choice, where the others are a reading. A word the wire does not
 *  take is ignored. */
export const GLOW_SET_FIELD = 'glowSet';
/** Law 5's one strength: the enchanted look has no band to read. */
export const ARCANE_LEVEL = 2;
/** GILDED-GLOW (2026-10-29, #feature-feedback: "gilded weapons should have a cool crimson glow to them to match the item
 *  picture"): LAW 8, A GILDED WEAPON WEARS THE RUNG'S CRIMSON in every hand of its owner and on its owner's look to peers.
 *  It is the piece itself, as its card's colour is, so it shows over the element (the Hourlock's shock line), the Aura
 *  Armory's piece and the arcane look. The ladder's switch off, the card shows no rung, so the hand shows none. One
 *  strength, as the arcane look has: a rung has no band to read. */
export const GILDED_LEVEL = 2;

/**
 * THE ONE ANSWER every drawer asks, as a plain pair: the look a weapon in the hand wears, `{ look, level }`, or null for
 * none. `arcane` (law 5) asks for the enchanted look where no element shows - the Morrowind hand's; the classic hand's
 * is its sheet.
 * @param {any} item
 * @param {{ arcane?: boolean, on?: boolean, ladder?: boolean }} [opts]
 */
export function weaponGlow(item, { arcane = false, on, ladder } = {}) {
  const s = specOf(item, arcane, on, ladder);
  return s ? { look: s.look, level: s.level } : null;
}

/**
 * THE LOOKS' COLOURS, the one table both drawers read: four stops each, dark to hot, linear 0..1 RGB. The sprite's
 * outline steps through them in Daggerfall's own way (a ramp of a few palette shades, never a smooth blend); the
 * Morrowind shell mixes them. Fire is an ember's red to a flame's white heart; frost a deep glacier blue to rime;
 * shock an indigo to a spark's violet-white; arcane the Thunderlock's enchanted blue-violet (thunderlockArt.js
 * MAGIC_TINT) - the one enchanted look the port already drew.
 */
export const GLOW_RAMPS = Object.freeze({
  fire: Object.freeze([
    [0.45, 0.06, 0.02],
    [0.88, 0.27, 0.04],
    [1.0, 0.62, 0.12],
    [1.0, 0.93, 0.62],
  ]),
  frost: Object.freeze([
    [0.08, 0.2, 0.52],
    [0.25, 0.55, 0.92],
    [0.6, 0.85, 1.0],
    [0.92, 0.98, 1.0],
  ]),
  shock: Object.freeze([
    [0.22, 0.1, 0.55],
    [0.48, 0.32, 1.0],
    [0.75, 0.7, 1.0],
    [0.97, 0.95, 1.0],
  ]),
  arcane: Object.freeze([
    [0.3, 0.26, 0.78],
    [0.38, 0.5, 1.0],
    [0.6, 0.76, 1.0],
    [0.88, 0.94, 1.0],
  ]),
  // ARMORY: the Brand's coal-dark crimson to a molten gold, darker than fire's; the Edge's Genesis blues and violets
  brand: Object.freeze([
    [0.3, 0.02, 0.01],
    [0.75, 0.14, 0.03],
    [1.0, 0.45, 0.08],
    [1.0, 0.82, 0.45],
  ]),
  edge: Object.freeze([
    [0.247, 0.388, 1.0],
    [0.561, 0.357, 1.0],
    [0.839, 0.722, 1.0],
    [0.957, 0.933, 1.0],
  ]),
  // GILDED-GLOW: a dark garnet to the rung's own crimson (lootRarity.js RARITIES.gilded, #ff3b4a) to a hot pink-white
  // core - where the Brand runs coal to gold
  gilded: Object.freeze([[0.45, 0.04, 0.1], [0.72, 0.08, 0.15], hexStop(RARITIES.gilded.colour), [1.0, 0.82, 0.84]]),
});

/** A `#rrggbb` colour as a ramp's stop, 0..1. */
function hexStop(hex) {
  return Object.freeze([1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255));
}

/** The ramp of a look, flat - twelve floats, the `uRamp[4]` a shader takes. Null for none. A fresh copy each ask (the
 *  probe's, a test's); the specs hold their own, frozen. */
export function glowRampFlat(look) {
  const r = Object.hasOwn(GLOW_RAMPS, look) ? GLOW_RAMPS[/** @type {keyof typeof GLOW_RAMPS} */ (look)] : null;
  return r ? new Float32Array(r.flat()) : null;
}

/** A look at a level as a drawer takes it - `{ look, code, level, word, ramp, win }` (`word` the wire's, `ramp` the
 *  twelve floats frozen, `win` the sprite's search window, render/weaponGlowGlsl.js GLOW_SPRITE_WINDOW) - every one
 *  built here, once, and frozen whole: an ask hands one back and builds nothing. */
const SPEC_TABLE = (() => {
  /** @type {Record<string, ReadonlyArray<any>>} */
  const table = {};
  for (const look of GLOW_LOOKS.slice(1)) {
    const row = [null, null, null, null];
    for (const level of look === 'arcane'
      ? [ARCANE_LEVEL]
      : look === 'brand' || look === 'edge'
        ? [ARMORY_LEVEL]
        : look === 'gilded'
          ? [GILDED_LEVEL]
          : [1, 2, 3]) {
      // law 5: the arcane look has one strength; law 7: the armory's pieces one each; law 8: the rung's one
      row[level] = Object.freeze({
        look,
        code: GLOW_CODE[/** @type {keyof typeof GLOW_CODE} */ (look)],
        level,
        word: `${look}${level}`,
        ramp: Object.freeze(GLOW_RAMPS[/** @type {keyof typeof GLOW_RAMPS} */ (look)].flat()),
        win: GLOW_SPRITE_WINDOW[/** @type {keyof typeof GLOW_SPRITE_WINDOW} */ (look)],
      });
    }
    table[look] = Object.freeze(row);
  }
  return Object.freeze(table);
})();
/** The spec of a look at a level (1-3), or null for anything else. */
export function glowSpec(look, level) {
  const row = typeof look === 'string' && Object.hasOwn(SPEC_TABLE, look) ? SPEC_TABLE[look] : null;
  return (row && Number.isInteger(level) && row[level]) || null;
}
/** Every spec, by its word - the wire's thirteen (net/wire.js LOOK_GLOW_RE takes exactly these). */
const SPEC_BY_WORD = new Map(
  Object.values(SPEC_TABLE)
    .flatMap((row) => row.filter(Boolean))
    .map((s) => [s.word, s]),
);

/** THE CLASSIC HAND'S ASK: the outline its sprite wears (law 8's crimson, an element or law 7's piece - its enchanted
 *  look is its WEAPO1xx sheet), or null. When this answers, the rig swings the PLAIN sheet (combat/fpsWeapon.js
 *  plainWeaponType): an outline round a sheet painted with the blue glow says two things at once.
 *  HAND-WRAPS: the fists have no WEAPO1xx sheet, so enchanted Hand Wraps took law 5's arcane outline here too - until
 *  WRAPS-AURA, which lights wraps by the weapon aura alone (specOf).
 *  @param {any} item @param {{ on?: boolean, ladder?: boolean }} [opts] */
export const spriteGlow = (item, opts) => specOf(item, isHandWraps(item), opts?.on, opts?.ladder);

/** THE MORROWIND HAND'S ASK: its element, or the arcane look for an enchanted weapon with none showing (law 5).
 *  @param {any} item @param {{ on?: boolean, ladder?: boolean }} [opts] */
export const meshGlow = (item, opts) => specOf(item, true, opts?.on, opts?.ladder);

/** THE WIRE'S WORD for a held weapon's glow - `fire2`, `arcane2` - and back (net/wire.js LOOK_GLOW_RE, validLookItem's
 *  `glow`): a peer's body is drawn from it, since its affixes never travel. Anything else reads as none. The words are
 *  exactly the specs' thirteen, which are exactly the words the wire's pattern takes (test/systems/weaponglow1.test.js). */
export const glowWord = (spec) => spec?.word ?? null;
export const glowFromWord = (word) => (typeof word === 'string' ? (SPEC_BY_WORD.get(word) ?? null) : null);
