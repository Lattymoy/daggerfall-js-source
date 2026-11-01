// THE NAMES OUR DIVERSE WEAPONS SET ANSWERS, AND WHAT EACH IS BUILT FROM. A rule, not a file list: every frame is
// built at runtime from the player's own classic WEAPON*.CIF and TEXTURE records
// (combat/diverseWeapons/diverseWeaponsArt.js), so no picture ships. The names are the ones Diverse Weapons 1.7.3
// answered (RealAKP; the interface only - names, counts, records).

/** MetalTypes' names in order (itemInfo.js MATERIAL_NAMES; a leaf here, the weapon's import cycle kept out) - a stem's
 *  bit `i` is metal `i`; bit 10 is the bare stem. */
export const DIVERSE_WEAPONS_METALS = Object.freeze([
  'Iron',
  'Steel',
  'Silver',
  'Elven',
  'Dwarven',
  'Mithril',
  'Adamantium',
  'Ebony',
  'Orcish',
  'Daedric',
]);
export const DIVERSE_WEAPONS_BARE = 1 << 10;
const ALL_METALS = (1 << DIVERSE_WEAPONS_METALS.length) - 1;
const NOT_SILVER = ALL_METALS & ~(1 << DIVERSE_WEAPONS_METALS.indexOf('Silver'));

/** Our look per weapon: the classic file it is built from (plain, magic), and the rule that reshapes it. `blade`:
 *  `length` and `width` scale it about its base and centre line, `curve` bends the tip by that share of its length,
 *  `tip` 'chisel' cuts the point, `fuller` grooves it, `only` redraws the blade alone behind its hand. `bands` ring a
 *  staff with metal (in shaft widths from the tip); `head: 'single'` keeps one bit of an axe. `ramp` names a colour
 *  law other than the metal's. */
export const LOOKS = Object.freeze({
  DAGGER: { plain: 'WEAPON02.CIF', magic: 'WEAPO102.CIF', blade: { width: 1.3, fuller: true, only: true } },
  TANTO: {
    plain: 'WEAPON04.CIF',
    magic: 'WEAPO104.CIF',
    blade: { length: 0.45, width: 0.95, curve: 0.03, tip: 'chisel' },
  },
  SHORTSWORD: { plain: 'WEAPON04.CIF', magic: 'WEAPO104.CIF', blade: { length: 0.62, width: 1.15, fuller: true } },
  WAKAZASHI: { plain: 'WEAPON04.CIF', magic: 'WEAPO104.CIF', blade: { length: 0.7, width: 0.85, curve: 0.07 } },
  BROADSWORD: { plain: 'WEAPON04.CIF', magic: 'WEAPO104.CIF', blade: { length: 0.86, width: 1.45, fuller: true } },
  SABER: { plain: 'WEAPON04.CIF', magic: 'WEAPO104.CIF', blade: { length: 0.9, width: 1.05, curve: 0.16 } },
  LONGSWORD: { plain: 'WEAPON04.CIF', magic: 'WEAPO104.CIF', blade: { fuller: true } },
  KATANA: { plain: 'WEAPON04.CIF', magic: 'WEAPO104.CIF', blade: { length: 0.96, width: 0.8, curve: 0.1 } },
  CLAYMORE: { plain: 'WEAPON04.CIF', magic: 'WEAPO104.CIF', blade: { length: 1.25, width: 1.3, fuller: true } },
  DAIKATANA: { plain: 'WEAPON04.CIF', magic: 'WEAPO104.CIF', blade: { length: 1.2, width: 0.85, curve: 0.11 } },
  STAFF: {
    plain: 'WEAPON01.CIF',
    magic: 'WEAPO101.CIF',
    bands: [
      [2, 3],
      [9, 10],
    ],
  },
  MACE: { plain: 'WEAPON05.CIF', magic: 'WEAPO105.CIF' },
  FLAIL: { plain: 'WEAPON06.CIF', magic: 'WEAPO106.CIF' },
  WARHAMMER: { plain: 'WEAPON07.CIF', magic: 'WEAPO107.CIF' },
  BATTLEAXE: { plain: 'WEAPON08.CIF', magic: 'WEAPO108.CIF' },
  WARAXE: { plain: 'WEAPON08.CIF', magic: 'WEAPO108.CIF', head: 'single' },
  SHORTBOW: { plain: 'WEAPON09.CIF', bow: true },
  LONGBOW: { plain: 'WEAPON09.CIF', bow: true },
  // an artifact is enchanted, so it is drawn into the magic staff's box (FPSWeapon.cs:398-399)
  WABBAJACK: {
    plain: 'WEAPO101.CIF',
    bands: [
      [1, 2],
      [5, 6],
      [9, 10],
    ],
    ramp: 'chaos',
    artifact: true,
  },
  // the classic flail's and battle-axe's own names: a custom template asks by them (FPSWeapon.cs:642-643)
  WEAPON06: { plain: 'WEAPON06.CIF' },
  WEAPON08: { plain: 'WEAPON08.CIF' },
});

/** Each asked file name and how it is built: `<NAME>.CIF` from the plain file, `<NAME>MAGIC.CIF` from the magic one. */
export const OWN_FILES = Object.freeze(
  Object.fromEntries(
    Object.entries(LOOKS).flatMap(([name, look]) => [
      [`${name}.CIF`, Object.freeze({ look: name, base: look.plain })],
      ...(look.magic ? [[`${name}MAGIC.CIF`, Object.freeze({ look: name, base: look.magic })]] : []),
    ]),
  ),
);

/** Frames per record: a melee weapon's idle and six strikes of five, a bow's one record of seven (WeaponBasics). */
export const MELEE_SHAPE = Object.freeze([1, 5, 5, 5, 5, 5, 5]);
export const BOW_SHAPE = Object.freeze([7]);
export const shapeOf = (file) => (LOOKS[OWN_FILES[file]?.look]?.bow ? BOW_SHAPE : MELEE_SHAPE);

/** The weapon icons: inventory (233) and paper doll (234) records 0..27 by dye, and the Wabbajack's (432/433 r25). */
export const ICON_RECORDS = Object.freeze({ 233: 28, 234: 28 });
export const ARTIFACT_ICONS = Object.freeze([
  [432, 25],
  [433, 25],
]);

function stems() {
  const out = {};
  for (const file of Object.keys(OWN_FILES)) {
    shapeOf(file).forEach((frames, record) => {
      for (let frame = 0; frame < frames; frame++) out[`${file}_${record}-${frame}`] = ALL_METALS;
    });
    out[`w_${file}_0-0`] = ALL_METALS; // Weapon Widget's double-size idle
  }
  // a `_Silver` icon is never asked: Silver is Unchanged, which GetName leaves bare
  for (const [archive, records] of Object.entries(ICON_RECORDS))
    for (let record = 0; record < records; record++) out[`${archive}_${record}-0`] = NOT_SILVER | DIVERSE_WEAPONS_BARE;
  for (const [archive, record] of ARTIFACT_ICONS) out[`${archive}_${record}-0`] = DIVERSE_WEAPONS_BARE;
  return out;
}

/** Every stem the set answers, with a bit per metal in MetalTypes' order and DIVERSE_WEAPONS_BARE for the bare one. */
export const DIVERSE_WEAPONS_STEMS = Object.freeze(stems());
