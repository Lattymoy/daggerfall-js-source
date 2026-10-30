// @ts-check
// URBANIZER U2 (bible/03-World/Urban-Fabric.md section 3) - THE TOWNS' PICTURES' RECORDS: their pseudo-archive, the
// styles a province's streets and walls are laid in, and each picture's record - a leaf (no import), so the capitals'
// landmarks (world/capitalSolitude.js and its kin, which world/capitalModels.js builds) name these pictures without
// reading the module that paints them (world/urban/urbanArt.js).

/** The towns' pictures' pseudo-archive - past the capitals' (38400) and every other of the port's own (38990 the lab's). */
export const URBAN_ARCHIVE = 38500;

/** A style's four pictures, by their offset in its eight records. */
export const URBAN_KINDS = Object.freeze({ setts: 0, flags: 1, cobbles: 2, wall: 3 });
/** The shared pictures (the capitals' landmarks', and the woodpile's), past every style's records. */
export const URBAN_ART = Object.freeze({
  brick: 200,
  halfTimber: 201,
  ashlar: 202,
  ochreAshlar: 203,
  whiteAshlar: 204,
  sandBrick: 205,
  logEnds: 206,
});

/** A picture's [archive, record] - a shared one by its URBAN_ART name, a style's by its index and kind. */
export const urbanArt = (name) => [URBAN_ARCHIVE, URBAN_ART[name]];
export const styleArt = (style, kind) => [URBAN_ARCHIVE, URBAN_STYLE_KEYS.indexOf(style) * 8 + URBAN_KINDS[kind]];

/**
 * THE STYLES: each its stone's ramp (dark to light, the paving's), its wall's law and ramp, and how its streets are laid -
 * `carriage` whether a main street's middle is set in stone (the planks' styles lay its pavements alone, a boardwalk each
 * side of the forest floor), `side` whether a city's side streets are cobbled, `yard` how its yards are closed: Daggerfall's
 * own fence (`fence` - its timber rails and posts, ARCH3D 41206/41208/41209) or a low wall of the style's (`wall`).
 */
export const URBAN_STYLES = Object.freeze({
  granite: Object.freeze({
    stone: [
      [40, 44, 50],
      [86, 92, 100],
      [130, 136, 142],
      [176, 180, 184],
    ],
    wall: 'rubble',
    wallRamp: [
      [34, 34, 32],
      [76, 76, 72],
      [116, 116, 110],
      [156, 154, 146],
    ],
    carriage: true,
    side: true,
    yard: 'fence',
  }),
  breton: Object.freeze({
    stone: [
      [52, 46, 40],
      [100, 90, 78],
      [146, 134, 116],
      [188, 176, 156],
    ],
    wall: 'brick',
    wallRamp: [
      [62, 26, 18],
      [118, 52, 34],
      [158, 82, 56],
      [196, 124, 92],
    ],
    carriage: true,
    side: true,
    yard: 'fence',
  }),
  sandstone: Object.freeze({
    stone: [
      [110, 82, 50],
      [168, 134, 92],
      [206, 172, 124],
      [236, 210, 164],
    ],
    wall: 'adobe',
    wallRamp: [
      [120, 92, 60],
      [176, 144, 104],
      [212, 182, 138],
      [236, 214, 176],
    ],
    carriage: true,
    side: true,
    yard: 'wall',
  }),
  redstone: Object.freeze({
    stone: [
      [104, 58, 34],
      [160, 100, 64],
      [200, 140, 96],
      [228, 182, 136],
    ],
    wall: 'adobe',
    wallRamp: [
      [118, 70, 44],
      [170, 116, 80],
      [206, 156, 112],
      [230, 196, 152],
    ],
    carriage: true,
    side: true,
    yard: 'wall',
  }),
  limestone: Object.freeze({
    stone: [
      [118, 116, 108],
      [176, 174, 164],
      [214, 212, 202],
      [242, 240, 232],
    ],
    wall: 'ashlar',
    wallRamp: [
      [150, 146, 136],
      [196, 192, 180],
      [226, 222, 210],
      [246, 244, 236],
    ],
    carriage: true,
    side: true,
    yard: 'wall',
  }),
  ochre: Object.freeze({
    stone: [
      [84, 64, 42],
      [140, 112, 76],
      [186, 154, 110],
      [222, 194, 150],
    ],
    wall: 'adobe',
    wallRamp: [
      [110, 76, 40],
      [164, 120, 70],
      [204, 160, 104],
      [232, 198, 146],
    ],
    carriage: true,
    side: true,
    yard: 'wall',
  }),
  imperial: Object.freeze({
    stone: [
      [64, 64, 66],
      [108, 106, 104],
      [148, 144, 138],
      [184, 180, 172],
    ],
    wall: 'brick',
    wallRamp: [
      [66, 28, 20],
      [124, 56, 38],
      [166, 88, 60],
      [204, 132, 98],
    ],
    carriage: true,
    side: true,
    yard: 'wall',
  }),
  planks: Object.freeze({
    stone: [
      [40, 26, 16],
      [86, 58, 36],
      [130, 94, 60],
      [172, 132, 88],
    ],
    wall: 'stakes',
    wallRamp: [
      [30, 22, 14],
      [70, 52, 34],
      [112, 86, 58],
      [150, 120, 84],
    ],
    carriage: false,
    side: false,
    yard: 'fence',
  }),
});
/** The styles in their records' order (a style's eight records from its index times eight). */
export const URBAN_STYLE_KEYS = Object.freeze(Object.keys(URBAN_STYLES));

/** A province's style (tamrielLand.js's keys) - its own stone. */
export const PROVINCE_STYLE = Object.freeze({
  Skyrim: 'granite',
  HighRock: 'breton',
  Hammerfell: 'sandstone',
  Sumurset: 'limestone',
  Valenwood: 'planks',
  Elsweyr: 'redstone',
  BlackMarsh: 'planks',
  Morrowind: 'ochre',
  Imperial: 'imperial',
});
/** A province's style, the Empire's where none is named. */
export const styleOf = (province) => PROVINCE_STYLE[province ?? ''] ?? 'imperial';
