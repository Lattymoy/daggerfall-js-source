// @ts-check
// TESA-LANDS (bible/03-World/Tamriel-Lands.md): THE LANDS PAST THE BAY - the seven provinces' thirty-three zones (not
// Cyrodiil's, Valenwood's or Blackwood's) each their own land, read off the lore: GROUND its dress (groundDress.js),
// BLADES whether the enhanced grass grows, FLORA Daggerfall's own nature flats of any climate in its own share of woods
// (terrainNature.js layoutLands), PROPS its landmarks (world/lands/landProps.js). A zone the table does not name keeps
// its climate's land. Pure and worker-safe (world/ and formats/ alone): the terrain worker reads the flora and the props.
import { tamrielBiomeAt, BIOME_BY_KEY } from './tamrielBiomes.js';
import { climateNeighbourIn } from './tamrielGround.js';
import { skyrimCoverPicks } from './skyrimFlora.js'; // Skyrim plant picks (art door: skyrimFloraArt.js)

/**
 * THE FOREST FIELD'S QUANTILES (terrainNature.js forestCover), every 1%, measured over 400,000 world tiles of the
 * continent's frame (tools/landsMeasure.mjs): a zone's `woods` sets its woods' edge at the field's (1 - woods) quantile.
 * Every 5% read straight through the tail had stood the Ashlands' 2% at 0.05% (the second audit);
 * test/world/tesalands_flora.test.js holds the table to the field.
 */
export const FOREST_QUANTILES = Object.freeze([
  0.1599, 0.3096, 0.3296, 0.3422, 0.3525, 0.3609, 0.3682, 0.3748, 0.3805, 0.3859, 0.3907, 0.3954, 0.3996, 0.4039,
  0.4077, 0.4114, 0.4149, 0.4184, 0.4217, 0.4249, 0.428, 0.431, 0.4339, 0.4368, 0.4396, 0.4423, 0.445, 0.4476, 0.4502,
  0.4526, 0.4551, 0.4576, 0.4599, 0.4623, 0.4647, 0.467, 0.4693, 0.4716, 0.4738, 0.4761, 0.4783, 0.4806, 0.4828, 0.485,
  0.4872, 0.4894, 0.4916, 0.4938, 0.4959, 0.4981, 0.5002, 0.5024, 0.5046, 0.5068, 0.5089, 0.5111, 0.5133, 0.5155,
  0.5177, 0.5199, 0.5221, 0.5243, 0.5265, 0.5288, 0.531, 0.5334, 0.5356, 0.538, 0.5403, 0.5428, 0.5452, 0.5477, 0.5502,
  0.5528, 0.5554, 0.558, 0.5607, 0.5635, 0.5662, 0.5691, 0.5722, 0.5753, 0.5785, 0.5818, 0.5851, 0.5887, 0.5924, 0.5962,
  0.6003, 0.6045, 0.6089, 0.6136, 0.6189, 0.6246, 0.6309, 0.6381, 0.6465, 0.6563, 0.6696, 0.689, 0.8384,
]);
/** The field's value under which share `p` of the land falls (FOREST_QUANTILES, linear between). Pure. */
export function forestQuantile(p) {
  const f = Math.min(1, Math.max(0, p)) * (FOREST_QUANTILES.length - 1),
    i = Math.min(FOREST_QUANTILES.length - 2, Math.floor(f)),
    u = f - i;
  return FOREST_QUANTILES[i] + (FOREST_QUANTILES[i + 1] - FOREST_QUANTILES[i]) * u;
}

// ── the materials, dark to light (the page's sources; a hex the games' render as the research read it) ─────────────────
const M = Object.freeze({
  // Skyrim
  frostTundra: ['#55605f', '#86908d', '#b3bbb8', '#dee5ea'],
  shingle: ['#3f4342', '#5f6462', '#7d8280', '#a1a6a5'],
  frostGranite: ['#3e4247', '#676c71', '#94979b', '#c7ccd0'],
  tundraGrass: ['#4d4a2e', '#7a7444', '#a39a62', '#c4b98a'],
  tundraDirt: ['#4a3f2e', '#6b5d45', '#8a7a5e', '#a69779'],
  lichenRock: ['#555753', '#7d7f7a', '#a2a39d', '#c6c6bf'],
  needleLitter: ['#2c3122', '#4a5134', '#676b46', '#868661'],
  brownLitter: ['#3a2f22', '#584834', '#756247', '#917e5e'],
  forestRock: ['#4a4c4a', '#6c6e6a', '#8e908a', '#b0b1ab'],
  reachGrass: ['#4e4630', '#7a6c48', '#9a8a60', '#b9a87e'],
  reachDirt: ['#4b4034', '#6d5f4e', '#8c7c68', '#a89a86'],
  reachStone: ['#4e4740', '#7e756a', '#9a8e80', '#b8ad9e'],
  snowfield: ['#93a3b3', '#bac7d3', '#dbe3ea', '#f1f5f8'],
  scree: ['#55585c', '#7a7c7e', '#9c9ea0', '#bdbfc1'],
  darkGranite: ['#2f3134', '#55585c', '#7b7e81', '#a4a7aa'],
  // High Rock
  wrothGrass: ['#494a34', '#74724e', '#999670', '#c0c0a6'],
  wrothDirt: ['#3d362a', '#5a4f3c', '#776a52', '#938769'],
  granite: ['#4a4c50', '#6e7074', '#919397', '#b7b9bc'],
  dampOlive: ['#33361f', '#55502f', '#757048', '#958f66'],
  ochre: ['#5a3f2a', '#8e5a3a', '#b07a4a', '#c99a6a'],
  striated: ['#5e3f30', '#8a5e46', '#ad8060', '#c9a282'],
  moorGrass: ['#3a3528', '#5e5a40', '#7a7656', '#958f6e'],
  peat: ['#2a221c', '#3a3128', '#55473a', '#6e604f'],
  flint: ['#3c3e42', '#5e6166', '#7f8287', '#a0a3a7'],
  greenTurf: ['#2f4422', '#4c6a34', '#5e7a3e', '#809b5a'],
  loam: ['#4a3a28', '#6b5a40', '#8a7858', '#a89878'],
  seaRock: ['#55575a', '#77797a', '#999b9c', '#bbbcbd'],
  // Hammerfell
  duneSand: ['#a8825f', '#c9a37b', '#e0bf97', '#f3d6ae'],
  duneSand2: ['#9e7a58', '#c19a73', '#dcb68e', '#efcfa6'],
  desertOutcrop: ['#372d29', '#6c5746', '#8c7058', '#a8896c'],
  cragDust: ['#77716d', '#978f8a', '#b3aca7', '#cfc8c2'],
  cragPath: ['#5e5044', '#7a6b5a', '#978274', '#b09c8c'],
  limestone: ['#514f53', '#918983', '#c6c0bd', '#ded6cc'],
  savannaDry: ['#3c3229', '#594a3e', '#7d6d58', '#9d906e'],
  beachSand: ['#8f8273', '#afa190', '#c8b8a5', '#dac8b5'],
  honeyStone: ['#5e4a3c', '#917d6d', '#bda593', '#d4bfae'],
  mountainGrass: ['#3a3a2a', '#5a5a40', '#7a7a58', '#9a9878'],
  mountainDirt: ['#4a3e34', '#6a5c4e', '#8a7c6c', '#a89a8a'],
  greyCrag: ['#343239', '#645b5a', '#98887e', '#b8aaa0'],
  // Summerset
  vineMeadow: ['#3a4a2a', '#56663c', '#6f7c4c', '#8f9a66'],
  warmSoil: ['#5a4a38', '#7a6a52', '#957f62', '#b09a7c'],
  paleLimestone: ['#8c8780', '#aca598', '#cdc7b9', '#e7e2d6'],
  emerald: ['#2a3a20', '#4a5e34', '#6f7c55', '#8c9a6c'],
  paleDune: ['#8c8270', '#b0a690', '#d0c8b2', '#e8e0cc'],
  whiteGranite: ['#8c8a85', '#b4b1aa', '#d9d6cf', '#eeece6'],
  etonGrass: ['#3e4a36', '#5e6a4c', '#7e8868', '#a5a499'],
  etonDirt: ['#3f4652', '#5a606a', '#7a8088', '#9a9fa6'],
  etonGranite: ['#3f4652', '#666a71', '#8a8e94', '#b0b3b8'],
  // Elsweyr
  orangeTan: ['#6d4f36', '#956a47', '#b08159', '#c99e78'],
  badlandDust: ['#6d625c', '#85766d', '#a48f7e', '#bba796'],
  sandstone: ['#4e3a2c', '#7a573e', '#a0754f', '#bb946c'],
  savannaGrass: ['#5e5236', '#86744a', '#a8935e', '#c4ad76'],
  savannaDirt: ['#5e4e3e', '#7e6a54', '#9e866c', '#b8a084'],
  savannaStone: ['#6a5a48', '#8a7862', '#a8967e', '#c2b29a'],
  coastMeadow: ['#2e3430', '#5a5e44', '#808058', '#b3a770'],
  whiteSand: ['#a89a7e', '#c8b896', '#e3d3b0', '#f0e4c6'],
  greyLimestone: ['#4a4b50', '#5c5d63', '#8f8f89', '#b0b0aa'],
  leafLitter: ['#2a2219', '#3f3224', '#5a4632', '#77603f'],
  jungleFloor: ['#1f2419', '#2e3626', '#454f39', '#5f6a4d'],
  jungleMoss: ['#22281f', '#383f3a', '#4f5a45', '#68705d'],
  // Black Marsh
  heartMud: ['#151210', '#221c16', '#352b21', '#4a3d2f'],
  blackPeat: ['#241d16', '#33281e', '#4a3b2c', '#62503d'],
  bogMoss: ['#1f2a1e', '#2e3a26', '#44522f', '#5d6a3e'],
  fenPeat: ['#2a2118', '#3a2e22', '#4f4130', '#685843'],
  reedStraw: ['#4a4a30', '#6a6a42', '#8a8a55', '#a8a674'],
  fenMoss: ['#26301f', '#38442a', '#4e5a38', '#66704a'],
  // Morrowind
  ash: ['#4a4744', '#6a6662', '#8c8780', '#ada79e'],
  cinder: ['#2e2b29', '#46423e', '#5f5a55', '#7a746d'],
  basalt: ['#252322', '#3a3633', '#524d48', '#6c665f'],
  wickwheat: ['#5a5230', '#867a42', '#a89a55', '#c9b46a'],
  darkSoil: ['#2e261c', '#4a3c2c', '#64523e', '#7e6a52'],
  grazeRock: ['#4f4b44', '#6e6a64', '#8e8a83', '#aeaaa3'],
  blight: ['#2e2420', '#4a3a33', '#5e4b44', '#7a6458'],
  blightDirt: ['#2a1e1a', '#4a2a22', '#5e3a2e', '#78503f'],
  redRock: ['#1a1412', '#2a1e1a', '#4a2a22', '#664036'],
  lushGreen: ['#33461f', '#4a6230', '#5c7a3a', '#7d9852'],
  farmSoil: ['#3e3020', '#5a4630', '#776048', '#937c62'],
  paleRock: ['#5e5c56', '#8c8a80', '#a8a69c', '#c4c2b8'],
  bitterMud: ['#2a2419', '#3e3526', '#544833', '#6b5d45'],
  bitterGrass: ['#2f2c1c', '#4a4630', '#5a5a34', '#74734a'],
  bitterMoss: ['#2a3020', '#3e4630', '#5a5a34', '#747450'],
  lavaAsh: ['#36352e', '#525045', '#716e60', '#918d7d'],
  lavaField: ['#1f1d1b', '#33302d', '#4a4642', '#625d58'],
  lavaBasalt: ['#1e1b19', '#2b2724', '#3f3a36', '#55504a'],
  blackSoil: ['#1a1714', '#2e2a26', '#45403a', '#5e5850'],
  deshaanGrass: ['#2e3e22', '#4f6a35', '#6a8448', '#86a060'],
  deshaanRock: ['#33302e', '#4c4845', '#67625e', '#837e79'],
  fungalTurf: ['#3a3a26', '#5e5a3a', '#7a7650', '#98946a'],
  fungalSoil: ['#3a3024', '#5a4a36', '#7a684e', '#988668'],
  padomaicRock: ['#3a3836', '#57534f', '#77726c', '#97928b'],
  footGrass: ['#3e3e26', '#6b6a3e', '#8a8858', '#a8a678'],
  redScree: ['#4a2e24', '#7a4a3a', '#946454', '#ae7e6c'],
  greyRock: ['#4a4744', '#6e6a64', '#8e8a84', '#aeaaa4'],
  ashGrey: ['#4e4b47', '#6a6865', '#7a746c', '#9a948c'],
  velothiDirt: ['#3e3c3a', '#5a5856', '#7a7876', '#9a9896'],
  velothiRock: ['#3a3836', '#6a6865', '#8a8885', '#acaaa7'],
});
const mat = (ramp, extra = {}) => Object.freeze({ ramp: Object.freeze(ramp), ...extra });
const fleck = (colors, share) => Object.freeze({ colors: Object.freeze(colors), share });

// ── Daggerfall's nature flats the recipes draw on (TEXTURE.500-510's summer records; world/terrain/terrainNature.js
//    TREE_RECORDS the Trees among them) ─────────────────────────────────────────────────────────────────────────────────
/** @typedef {readonly [number, number, number]} Pick - a flat: [summer nature archive, record 1-31, weight] */
/** Each Skyrim zone's own undergrowth (skyrimFloraArt.js) - mixed with a few classic rocks where the ground asks. */
const SKYRIM_PINEWOOD_COVER = skyrimCoverPicks('pinewood');
const SKYRIM_REACH_COVER = skyrimCoverPicks('reach');
const SKYRIM_FROZEN_COVER = skyrimCoverPicks('frozenCoast');
const SKYRIM_TUNDRA_COVER = skyrimCoverPicks('tundra');
const PINES = /** @type {Pick[]} */ ([
  [510, 11, 3],
  [510, 12, 3],
  [510, 13, 2],
  [510, 25, 3],
  [510, 30, 2],
]);
const SMALL_PINE = /** @type {Pick[]} */ ([[510, 5, 1]]);
const MOUNTAIN_ROCKS = /** @type {Pick[]} */ ([
  [510, 1, 2],
  [510, 6, 2],
  [510, 17, 3],
  [510, 18, 2],
  [510, 27, 3],
]);
const BASALT = /** @type {Pick[]} */ ([
  [502, 4, 2],
  [502, 5, 3],
  [502, 6, 2],
]);
const SANDSTONE_ROCKS = /** @type {Pick[]} */ ([
  [503, 3, 3],
  [503, 4, 2],
  [503, 18, 2],
  [503, 19, 2],
  [503, 20, 2],
]);
const PALMS = /** @type {Pick[]} */ ([
  [501, 11, 2],
  [501, 12, 3],
  [501, 13, 3],
  [501, 16, 2],
  [501, 30, 2],
]);
const MANGROVES = /** @type {Pick[]} */ ([
  [502, 12, 2],
  [502, 13, 2],
  [502, 16, 2],
  [502, 17, 2],
  [502, 18, 2],
]);
const BROADLEAF = /** @type {Pick[]} */ ([
  [504, 12, 2],
  [504, 16, 3],
  [504, 18, 3],
]);
// THE DEAD TREES: bare in the classic picture and in Low Poly Trees' mesh alike - the desert's two snags (503:11, 503:12),
// its gnarled thorn (503:28) and the woodlands' great dead oak (504:30). Never the grey dead tree of the classic sets
// (504:24, 510:24): the mod stands both as 504:25's pine (vendor/low-poly-trees/Trees/trees.json - their prefabs' mesh
// is the pine's), and a dead wood would grow green.
/** The dead trees the recipes stand, [archive, record] (test/world/tesalands_ground.test.js holds each off the pines' meshes). */
export const DEAD_TREES = Object.freeze(
  [
    [503, 11],
    [503, 12],
    [503, 28],
    [504, 30],
  ].map((p) => Object.freeze(p)),
);

/** Freezes a value whole (the table is read on two threads and pinned: nothing writes it). */
function deepFreeze(v) {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) deepFreeze(v[k]);
  }
  return v;
}

/**
 * THE LANDS, by zone key (tamrielBiomes.js BIOMES'). Each: `ground` its dress (`{ dirt, grass, stone }` - the CLASS of the
 * climate's set, whatever it looks like there; `base` another summer set to dress), `blades`, `flora` (`woods`, `trees`
 * and `cover` [archive, record, weight] picks, `treeRate`, `coverRate`), `props` (one entry a kind: `looks`, `rate`,
 * `where` - woods, plains, any or wet - and `patch`), `lore` the land in a line.
 */
export const LANDS = deepFreeze({
  // ══ SKYRIM ══════════════════════════════════════════════════════════════════════════════════════════════════════
  skyrimFrozenCoast: {
    ground: {
      grass: mat(M.frostTundra, { fleck: fleck(['#eef3f6', '#e2e9ee'], 0.05) }),
      dirt: mat(M.shingle),
      stone: mat(M.frostGranite),
    },
    blades: false,
    flora: {
      woods: 0.06,
      treeRate: 0.6,
      coverRate: 0.7,
      trees: [...SMALL_PINE, [510, 11, 2], [510, 12, 2], [510, 25, 1], [503, 12, 1]],
      cover: [...SKYRIM_FROZEN_COVER, ...MOUNTAIN_ROCKS],
    },
    props: [{ kind: 'spire', looks: ['frost'], rate: 0.05, where: 'plains' }],
    lore: "the Pale's pale white tundra and Winterhold's ice fields - frost-grey shingle, spiky grass and snowberry, a few snow-laden pines",
  },
  skyrimTundra: {
    ground: {
      grass: mat(M.tundraGrass, { fleck: fleck(['#ecead0', '#8466aa', '#4a6fb5'], 0.025) }),
      dirt: mat(M.tundraDirt),
      stone: mat(M.lichenRock),
    },
    blades: true,
    flora: {
      woods: 0.06,
      treeRate: 0.7,
      coverRate: 1.1,
      trees: [
        [510, 11, 2],
        [510, 12, 1],
        [510, 13, 1],
        [503, 11, 1],
      ],
      cover: [...SKYRIM_TUNDRA_COVER, [510, 17, 1], [510, 18, 1]],
    },
    props: [
      { kind: 'spire', looks: ['lichen'], rate: 0.04, where: 'plains' },
      { kind: 'reeds', looks: ['reed'], rate: 0.05, where: 'wet' },
    ],
    lore: "Whiterun's open plain of tawny grass, tundra cotton and lavender among lichened outcrops; Hjaalmarch's reedy salt marsh",
  },
  skyrimPinewood: {
    ground: {
      grass: mat(M.needleLitter, { fleck: fleck(['#6a5232', '#7a5a34'], 0.06) }),
      dirt: mat(M.brownLitter),
      stone: mat(M.forestRock),
    },
    blades: true,
    flora: {
      woods: 0.8,
      treeRate: 1.1,
      coverRate: 1,
      trees: [...PINES, ...SMALL_PINE],
      cover: [...SKYRIM_PINEWOOD_COVER, [510, 17, 1], [510, 8, 1]],
    },
    props: [{ kind: 'grove', looks: ['aspen'], rate: 0.09, where: 'woods', patch: 0.35 }],
    lore: "Haafingar's and Falkreath's dark misty pine and spruce over needle litter, the Rift's white-barked golden aspens",
  },
  skyrimReach: {
    ground: { grass: mat(M.reachGrass), dirt: mat(M.reachDirt), stone: mat(M.reachStone) },
    blades: true,
    flora: {
      woods: 0.12,
      treeRate: 0.8,
      coverRate: 1.2,
      trees: [
        [503, 11, 2],
        [503, 12, 1],
        [510, 16, 2],
        [510, 20, 2],
        [510, 11, 1],
      ],
      cover: [...SKYRIM_REACH_COVER, ...MOUNTAIN_ROCKS],
    },
    props: [{ kind: 'spire', looks: ['reachstone'], rate: 0.12, where: 'any' }],
    lore: "Markarth's maze of warm grey-brown crags and gorges, juniper and hanging moss, skeletal grey trees",
  },
  skyrimPeaks: {
    ground: { grass: mat(M.snowfield), dirt: mat(M.scree), stone: mat(M.darkGranite) },
    blades: false,
    flora: { woods: 0.03, treeRate: 0.4, coverRate: 0.6, trees: [...SMALL_PINE, [503, 12, 1]], cover: MOUNTAIN_ROCKS },
    props: [{ kind: 'spire', looks: ['granite'], rate: 0.06, where: 'any' }],
    lore: "the Throat of the World's blue-white snowfields broken by black granite ribs and scree",
  },
  // ══ HIGH ROCK ════════════════════════════════════════════════════════════════════════════════════════════════════
  highRockWrothgar: {
    ground: {
      grass: mat(M.wrothGrass, { fleck: fleck(['#e4eaee'], 0.03) }),
      dirt: mat(M.wrothDirt),
      stone: mat(M.granite),
    },
    blades: true,
    flora: {
      woods: 0.3,
      treeRate: 0.9,
      coverRate: 0.9,
      trees: [...PINES, ...SMALL_PINE],
      cover: [...MOUNTAIN_ROCKS, [510, 2, 2], [510, 9, 1], [510, 29, 1]],
    },
    props: [{ kind: 'spire', looks: ['granite'], rate: 0.05, where: 'plains' }],
    lore: "Wrothgar's boreal spruce climbing to wind-bare tundra and white granite peaks",
  },
  highRockBangkorai: {
    ground: { grass: mat(M.dampOlive), dirt: mat(M.ochre), stone: mat(M.striated) },
    blades: true,
    flora: {
      woods: 0.5,
      treeRate: 1,
      coverRate: 1,
      trees: [...PINES, [503, 11, 1]],
      cover: [
        [510, 8, 2],
        [510, 9, 2],
        [510, 17, 2],
        [503, 3, 1],
        [503, 10, 1],
        [510, 2, 2],
        [510, 19, 1],
      ],
    },
    props: [{ kind: 'spire', looks: ['striated'], rate: 0.07, where: 'plains' }],
    lore: "Bangkorai's damp conifer uplands falling through the pass to striated ochre and rust stone",
  },
  highRockRivenspire: {
    ground: {
      grass: mat(M.moorGrass, { fleck: fleck(['#6b4f5e', '#8a5f78'], 0.05) }),
      dirt: mat(M.peat),
      stone: mat(M.flint),
    },
    blades: true,
    flora: {
      woods: 0.15,
      treeRate: 0.9,
      coverRate: 1,
      trees: [
        [502, 24, 3],
        [508, 16, 2],
        [508, 18, 2],
        [508, 20, 1],
        [508, 25, 1],
      ],
      cover: [
        [508, 1, 2],
        [508, 3, 2],
        [508, 4, 1],
        [508, 5, 2],
        [508, 6, 1],
        [510, 28, 2],
        [504, 1, 2],
        [506, 9, 1],
        [508, 14, 2],
      ],
    },
    props: [{ kind: 'spire', looks: ['flint'], rate: 0.08, where: 'plains' }],
    lore: "Shornhelm's misty moor of olive grass and heather under flinty crags, bare trees hung with moss",
  },
  highRockNorthpoint: {
    ground: { grass: mat(M.greenTurf), dirt: mat(M.loam), stone: mat(M.seaRock) },
    blades: true,
    flora: {
      woods: 0.4,
      treeRate: 1,
      coverRate: 1,
      trees: [...BROADLEAF, [504, 14, 1]], // the second audit (lane D): no pine (504:13) - its oak and beech
      cover: [
        [504, 1, 2],
        [504, 2, 2],
        [504, 21, 2],
        [504, 22, 2],
        [504, 27, 2],
        [504, 28, 2],
        [504, 3, 1],
        [504, 4, 1],
        [504, 29, 2],
      ],
    },
    props: [],
    lore: "Northpoint's bright green headland of farms, oak and beech above clear beaches",
  },
  // ══ HAMMERFELL ═══════════════════════════════════════════════════════════════════════════════════════════════════
  hammerfellAlikr: {
    ground: null, // the desert's own ground, Sands of the Alik'r's dunes (bible/07-Rendering/Sands-Of-The-Alikr.md - named for it, worn by default)
    blades: false,
    flora: {
      woods: 0.02,
      treeRate: 0.25,
      coverRate: 0.3,
      trees: [
        [501, 12, 2],
        [501, 13, 2],
        [503, 13, 1],
      ],
      cover: [...SANDSTONE_ROCKS, [503, 1, 1], [503, 14, 1], [503, 24, 1], [503, 10, 2], [503, 17, 2]],
    },
    props: [{ kind: 'spire', looks: ['redstone'], rate: 0.05, where: 'any' }],
    lore: "the Alik'r's peach-buff dune sea broken by dark outcrops and red sandstone hoodoos, palms at its oases",
  },
  hammerfellCraglorn: {
    ground: { grass: mat(M.cragDust), dirt: mat(M.cragPath), stone: mat(M.limestone) },
    blades: false,
    flora: {
      woods: 0.04,
      treeRate: 0.5,
      coverRate: 0.5,
      trees: [
        [503, 28, 2],
        [510, 16, 2],
        [510, 11, 1],
        [503, 12, 1],
      ],
      cover: [...SANDSTONE_ROCKS, [503, 10, 2], [503, 17, 2], [510, 9, 2]],
    },
    props: [{ kind: 'spire', looks: ['limestone'], rate: 0.11, where: 'any' }],
    lore: "Craglorn's bleached grey-cream limestone crags under hazy light, lone twisted ash and juniper",
  },
  hammerfellCoast: {
    ground: { grass: mat(M.savannaDry), dirt: mat(M.beachSand), stone: mat(M.honeyStone) },
    blades: false,
    flora: {
      woods: 0.35,
      treeRate: 0.9,
      coverRate: 0.9,
      trees: [...PALMS, [504, 12, 1], [503, 5, 2]],
      cover: [
        [501, 3, 1],
        [501, 7, 2],
        [501, 8, 2],
        [501, 26, 2],
        [503, 3, 1],
        [503, 17, 2],
        [504, 21, 1],
      ],
    },
    props: [{ kind: 'spire', looks: ['honey'], rate: 0.03, where: 'plains' }],
    lore: "the Abecean shore's cream sand and honey-red rock under palms, greener and more wooded toward Hegathe",
  },
  hammerfellDragontail: {
    ground: { grass: mat(M.mountainGrass), dirt: mat(M.mountainDirt), stone: mat(M.greyCrag) },
    blades: true,
    flora: {
      woods: 0.45,
      treeRate: 1,
      coverRate: 0.8,
      trees: [...PINES, ...SMALL_PINE],
      cover: [...MOUNTAIN_ROCKS, [510, 9, 2], [510, 2, 1]],
    },
    props: [{ kind: 'spire', looks: ['granite'], rate: 0.05, where: 'plains' }],
    lore: "the Dragontail's forested, faintly volcanic grey spine above the desert",
  },
  // ══ SUMURSET ISLE ════════════════════════════════════════════════════════════════════════════════════════════════
  summersetVineCoast: {
    ground: {
      base: 302,
      grass: mat(M.vineMeadow, { fleck: fleck(['#e8a9c8', '#d8b84a', '#f2efe6'], 0.02) }),
      dirt: mat(M.warmSoil),
      stone: mat(M.paleLimestone),
    },
    blades: true, // the second audit (lane E): its meadows the temperate set's grass (`base`), its blades with them
    flora: {
      woods: 0.3,
      treeRate: 0.6,
      coverRate: 1,
      trees: [
        [510, 21, 3],
        [504, 16, 1],
        [504, 17, 1],
        [506, 14, 1],
      ],
      cover: [
        [504, 1, 2],
        [504, 2, 2],
        [504, 21, 2],
        [504, 22, 1],
        [504, 27, 2],
        [504, 28, 1],
        [501, 8, 1],
        [504, 29, 2],
      ],
    },
    props: [
      { kind: 'grove', looks: ['cherry', 'ginkgo', 'maple'], rate: 0.12, where: 'woods' },
      { kind: 'vines', looks: ['vine'], rate: 0.05, where: 'plains' },
    ],
    lore: "Alinor's green vine-striped hills under pink cherry, gold ginkgo and crimson maple, white towers on pale limestone",
  },
  summersetAuridon: {
    ground: { grass: mat(M.emerald), dirt: mat(M.paleDune), stone: mat(M.whiteGranite) },
    blades: true,
    flora: {
      woods: 0.65,
      treeRate: 1,
      coverRate: 1,
      trees: [...BROADLEAF], // the second audit (lane D): no pine (504:13) - its laurel, maple and cherry
      cover: [
        [504, 1, 2],
        [504, 21, 2],
        [504, 27, 2],
        [504, 28, 2],
        [504, 8, 2],
        [504, 26, 2],
        [504, 29, 2],
      ],
    },
    props: [{ kind: 'grove', looks: ['cherry'], rate: 0.07, where: 'woods' }],
    lore: "Auridon's untamed emerald woods of laurel, maple and cherry, ringed by white granite and pale dunes",
  },
  summersetEtonNir: {
    ground: { grass: mat(M.etonGrass), dirt: mat(M.etonDirt), stone: mat(M.etonGranite) },
    blades: true,
    flora: { woods: 0.3, treeRate: 0.9, coverRate: 0.8, trees: [...PINES], cover: [...MOUNTAIN_ROCKS, [510, 2, 1]] },
    props: [{ kind: 'spire', looks: ['granite'], rate: 0.06, where: 'plains' }],
    lore: "Eton Nir's sheer grey granite wrapped in cloud, its forest climbing high",
  },
  // ══ ELSWEYR ══════════════════════════════════════════════════════════════════════════════════════════════════════
  elsweyrAnequina: {
    ground: { grass: mat(M.orangeTan), dirt: mat(M.badlandDust), stone: mat(M.sandstone) },
    blades: false,
    flora: {
      woods: 0.05,
      treeRate: 0.5,
      coverRate: 0.5,
      trees: [
        [503, 5, 4],
        [503, 12, 1],
        [501, 30, 1],
      ],
      cover: [...SANDSTONE_ROCKS, [503, 7, 2], [503, 10, 2], [503, 17, 2], [503, 27, 1]],
    },
    props: [{ kind: 'spire', looks: ['sandstone'], rate: 0.12, where: 'any' }],
    lore: "Anequina's orange-tan canyon country of mesas, pillars and arches, dotted with acacias",
  },
  elsweyrPlains: {
    ground: { base: 302, grass: mat(M.savannaGrass), dirt: mat(M.savannaDirt), stone: mat(M.savannaStone) },
    blades: true, // the second audit (lane E): its meadows the temperate set's grass (`base`), its blades with them
    flora: {
      woods: 0.08,
      treeRate: 0.7,
      coverRate: 0.8,
      trees: [
        [503, 5, 5],
        [501, 30, 1],
      ],
      cover: [
        [503, 17, 3],
        [503, 10, 2],
        [504, 2, 1],
        [503, 7, 1],
        [503, 3, 1],
      ],
    },
    props: [
      { kind: 'spire', looks: ['mound'], rate: 0.07, where: 'plains' },
      { kind: 'reeds', looks: ['cane'], rate: 0.08, where: 'wet' },
    ],
    lore: "the High Savannah's tawny dry grass with lone flat-topped acacias and termite mounds, cane paddies by Rimmen",
  },
  elsweyrPellitine: {
    ground: {
      base: 302,
      grass: mat(M.coastMeadow, { fleck: fleck(['#b3a770', '#d8c070'], 0.02) }),
      dirt: mat(M.whiteSand),
      stone: mat(M.greyLimestone),
    },
    blades: true, // the second audit (lane E): its meadows the temperate set's grass (`base`), its blades with them
    flora: {
      woods: 0.45,
      treeRate: 1,
      coverRate: 1,
      trees: [...PALMS, [504, 12, 1]],
      cover: [
        [501, 7, 2],
        [501, 8, 2],
        [501, 25, 1],
        [500, 2, 2],
        [501, 29, 2],
        [501, 26, 1],
      ],
    },
    props: [
      { kind: 'reeds', looks: ['cane'], rate: 0.1, where: 'plains' },
      { kind: 'spire', looks: ['karst'], rate: 0.03, where: 'any' },
    ],
    lore: "the Pellitine's green flowered coast of palms and sugarcane over a calm bay, grey limestone arches",
  },
  elsweyrTenmar: {
    ground: { grass: mat(M.leafLitter), dirt: mat(M.jungleFloor), stone: mat(M.jungleMoss) },
    blades: true,
    // Daggerfall's own rainforest (TEXTURE.500) grown close: its twisted and vine-hung trees, its palms and its rain tree
    // over ferns, bulb plants and flowering spikes - the Bantha's storeys are Cyrodiil's alone (the owner's call)
    flora: {
      woods: 0.78,
      treeRate: 1.05,
      coverRate: 1.1,
      trees: [
        [500, 12, 3],
        [500, 13, 2],
        [500, 14, 2],
        [500, 15, 2],
        [500, 16, 2],
        [500, 18, 3],
        [500, 30, 3],
      ],
      cover: [
        [500, 1, 3],
        [500, 9, 3],
        [500, 10, 2],
        [500, 7, 2],
        [500, 26, 2],
        [500, 27, 2],
        [500, 2, 1],
        [500, 11, 1],
        [500, 20, 1],
        [500, 21, 1],
        [500, 22, 1],
        [500, 17, 1],
        [500, 25, 1],
      ],
    },
    props: [{ kind: 'reeds', looks: ['cane'], rate: 0.14, where: 'plains' }],
    lore: "the Tenmar's dark steamy jungle canopy over leaf litter and venerated sugarcane",
  },
  // ══ BLACK MARSH ══════════════════════════════════════════════════════════════════════════════════════════════════
  blackMarshHist: {
    ground: { dirt: mat(M.heartMud), grass: mat(M.blackPeat), stone: mat(M.bogMoss) },
    blades: true,
    flora: {
      woods: 0.6,
      treeRate: 1,
      coverRate: 1,
      trees: [...MANGROVES, [502, 24, 2], [502, 30, 1]],
      cover: [
        [502, 7, 2],
        [502, 8, 2],
        [502, 20, 2],
        [502, 28, 2],
        [502, 27, 2],
        [502, 11, 1],
        [502, 14, 1],
        [502, 3, 1],
      ],
    },
    props: [
      { kind: 'hist', looks: ['hist'], rate: 0.08, where: 'woods' },
      { kind: 'reeds', looks: ['reed'], rate: 0.05, where: 'wet' },
    ],
    lore: "the interior's black heart-mud and drowned forest of banyan roots and the colossal Hist",
  },
  blackMarshFens: {
    ground: { dirt: mat(M.fenPeat), grass: mat(M.reedStraw), stone: mat(M.fenMoss) },
    blades: true,
    flora: {
      woods: 0.15,
      treeRate: 0.8,
      coverRate: 1,
      trees: [
        [502, 30, 2],
        [502, 15, 2],
        [502, 24, 2],
        [502, 13, 1],
      ],
      cover: [
        [502, 27, 4],
        [500, 26, 2],
        [502, 8, 2],
        [502, 9, 1],
        [502, 28, 1],
      ],
    },
    props: [
      { kind: 'reeds', looks: ['reed'], rate: 0.32, where: 'plains' },
      { kind: 'hist', looks: ['hist'], rate: 0.01, where: 'woods' },
    ],
    lore: "the Shadowfen's flat fog-banked sea of head-high reeds over peat and black channels",
  },
  blackMarshMurkmire: {
    ground: { dirt: mat(M.bitterMud), grass: mat(M.fenMoss), stone: mat(M.bogMoss) },
    blades: true,
    // the swamp's mangroves and moss-hung trees (TEXTURE.502) among the rainforest's tall trees and palms (TEXTURE.500),
    // over ferns and bog plants; reeds at every water's edge, a Hist deep in its woods
    flora: {
      woods: 0.65,
      treeRate: 1,
      coverRate: 1,
      trees: [...MANGROVES, [502, 24, 2], [500, 30, 2], [500, 16, 1], [500, 13, 1]],
      cover: [
        [502, 7, 2],
        [502, 8, 2],
        [502, 20, 2],
        [502, 27, 2],
        [502, 28, 1],
        [502, 21, 1],
        [500, 1, 2],
        [500, 9, 2],
        [500, 26, 1],
      ],
    },
    props: [
      { kind: 'reeds', looks: ['reed'], rate: 0.14, where: 'wet' },
      { kind: 'hist', looks: ['hist'], rate: 0.015, where: 'woods' },
    ],
    lore: "Murkmire's steaming mangrove jungle sliding into a shallow sea",
  },
  // ══ MORROWIND ════════════════════════════════════════════════════════════════════════════════════════════════════
  morrowindAshlands: {
    ground: {
      grass: mat(M.ash, { fleck: fleck(['#a39a8e', '#8c857c'], 0.02) }),
      dirt: mat(M.cinder),
      stone: mat(M.basalt, { fleck: fleck(['#7a3a2c'], 0.012) }),
    },
    blades: false,
    flora: {
      woods: 0.02,
      treeRate: 0.4,
      coverRate: 0.55,
      trees: [
        [503, 11, 2],
        [503, 12, 2],
        [503, 28, 1],
        [510, 20, 2],
      ],
      cover: [...BASALT, [510, 1, 2], [510, 17, 1], [503, 10, 3], [503, 23, 2], [510, 2, 1]],
    },
    props: [
      { kind: 'spire', looks: ['basalt'], rate: 0.1, where: 'any' },
      { kind: 'parasol', looks: ['xylaria'], rate: 0.04, where: 'any' },
    ],
    lore: "the Ashlands' grey wind-scoured ash and cinder, black stone obelisks, dry trama thornbrush and xylaria spikes",
  },
  morrowindGrazelands: {
    ground: {
      grass: mat(M.wickwheat, { fleck: fleck(['#4a6fb5'], 0.012) }),
      dirt: mat(M.darkSoil),
      stone: mat(M.grazeRock),
    },
    blades: true,
    flora: {
      woods: 0.03,
      treeRate: 0.5,
      coverRate: 1,
      trees: [
        [504, 12, 1],
        [504, 16, 1],
      ],
      cover: [
        [510, 2, 3],
        [510, 29, 3],
        [510, 22, 2],
        [504, 28, 2],
        [504, 27, 1],
      ],
    },
    props: [],
    lore: "the Grazelands' rolling golden wickwheat under big skies, a few lone trees, stoneflower",
  },
  morrowindRedMountain: {
    ground: { grass: mat(M.blight), dirt: mat(M.blightDirt), stone: mat(M.redRock) },
    blades: false,
    flora: {
      woods: 0,
      treeRate: 0,
      coverRate: 0.45,
      trees: [[503, 12, 1]],
      cover: [...BASALT, [510, 1, 2], [510, 6, 2], [510, 17, 1], [503, 10, 1]],
    },
    props: [{ kind: 'spire', looks: ['scoria'], rate: 0.12, where: 'any' }],
    lore: "Red Mountain's dead cone of blighted ash and red-black rock",
  },
  morrowindAscadian: {
    ground: {
      grass: mat(M.lushGreen, { fleck: fleck(['#b07aa8', '#e0b83a'], 0.015) }),
      dirt: mat(M.farmSoil),
      stone: mat(M.paleRock),
    },
    blades: true,
    flora: {
      woods: 0.25,
      treeRate: 0.7,
      coverRate: 1,
      trees: BROADLEAF,
      cover: [
        [504, 1, 3],
        [504, 2, 2],
        [504, 21, 2],
        [510, 22, 2],
        [504, 28, 2],
        [504, 27, 1],
        [504, 29, 2],
      ],
    },
    props: [{ kind: 'parasol', looks: ['ascadian'], rate: 0.16, where: 'woods' }],
    lore: "the Ascadian Isles' green farmland of lakes, heather and gold kanet, and groves of emperor parasols",
  },
  morrowindBitterCoast: {
    ground: { dirt: mat(M.bitterMud), grass: mat(M.bitterGrass), stone: mat(M.bitterMoss) },
    blades: true,
    flora: {
      woods: 0.55,
      treeRate: 1,
      coverRate: 1,
      trees: [
        [502, 30, 3],
        [502, 24, 3],
        [502, 15, 2],
        [510, 16, 1],
      ],
      cover: [
        [508, 22, 2],
        [508, 23, 1],
        [504, 23, 2],
        [502, 27, 2],
        [502, 8, 2],
        [502, 20, 1],
        [502, 28, 1],
      ],
    },
    props: [
      { kind: 'reeds', looks: ['reed'], rate: 0.08, where: 'wet' },
      { kind: 'spire', looks: ['menhir'], rate: 0.02, where: 'plains' },
    ],
    lore: "the Bitter Coast's dripping foggy salt marsh of great ragged trees, moss pools, shelf fungi and reeds",
  },
  morrowindStonefalls: {
    ground: { grass: mat(M.lavaAsh), dirt: mat(M.lavaField), stone: mat(M.lavaBasalt) },
    blades: false,
    flora: {
      woods: 0.12,
      treeRate: 0.7,
      coverRate: 0.8,
      trees: [
        [510, 10, 2],
        [508, 18, 2],
        [503, 28, 1],
      ],
      cover: [...BASALT, [510, 1, 1], [510, 17, 1], [503, 10, 1], [502, 1, 1]],
    },
    props: [
      { kind: 'spire', looks: ['basalt'], rate: 0.08, where: 'plains' },
      { kind: 'grove', looks: ['ember', 'jester'], rate: 0.05, where: 'woods' },
      { kind: 'parasol', looks: ['ascadian'], rate: 0.05, where: 'woods' },
    ],
    lore: "Stonefalls' black lava fields and basalt crags with fungal pockets and orange and purple thorny cherry",
  },
  morrowindDeshaan: {
    ground: { dirt: mat(M.blackSoil), grass: mat(M.deshaanGrass), stone: mat(M.deshaanRock) },
    blades: true,
    flora: {
      woods: 0.45,
      treeRate: 0.6,
      coverRate: 1,
      trees: BROADLEAF,
      cover: [
        [504, 21, 2],
        [504, 1, 2],
        [502, 14, 2],
        [504, 28, 2],
        [504, 23, 2],
        [504, 29, 2],
      ],
    },
    props: [{ kind: 'parasol', looks: ['deshaan', 'glowstalk'], rate: 0.2, where: 'woods' }],
    lore: "Deshaan's exceptionally fertile black soil and saltrice country under glowing fungal woods",
  },
  morrowindTelvanni: {
    ground: { grass: mat(M.fungalTurf), dirt: mat(M.fungalSoil), stone: mat(M.padomaicRock) },
    blades: true,
    flora: {
      woods: 0.5,
      treeRate: 0.4,
      coverRate: 1,
      trees: [
        [504, 12, 1],
        [504, 18, 1],
      ],
      cover: [
        [502, 1, 2],
        [501, 2, 2],
        [502, 14, 1],
        [508, 22, 1],
        [504, 23, 2],
        [504, 28, 1],
      ],
    },
    props: [
      { kind: 'parasol', looks: ['telvanni', 'xylaria'], rate: 0.24, where: 'woods' },
      { kind: 'spire', looks: ['basalt'], rate: 0.03, where: 'plains' },
    ],
    lore: 'the Telvanni lowlands crowded with giant mushrooms and fire-hued fungi, rising to the Padomaic Crest',
  },
  morrowindVelothiFoot: {
    ground: { grass: mat(M.footGrass), dirt: mat(M.redScree), stone: mat(M.greyRock) },
    blades: true,
    flora: {
      woods: 0.1,
      treeRate: 0.7,
      coverRate: 1,
      trees: [
        [510, 5, 2],
        [510, 11, 1],
        [510, 10, 2],
      ],
      cover: [...MOUNTAIN_ROCKS, [510, 9, 2], [504, 27, 2], [510, 2, 2], [506, 14, 1]],
    },
    props: [{ kind: 'spire', looks: ['scoria'], rate: 0.05, where: 'plains' }],
    lore: "the Velothi Foothills' scrubby green-grey upland of red-brown scree, chokeweed and bittergreen thickets",
  },
  morrowindVelothi: {
    ground: { grass: mat(M.ashGrey), dirt: mat(M.velothiDirt), stone: mat(M.velothiRock) },
    blades: false,
    flora: { woods: 0.05, treeRate: 0.5, coverRate: 0.7, trees: [...SMALL_PINE, [503, 12, 1]], cover: MOUNTAIN_ROCKS },
    props: [{ kind: 'spire', looks: ['granite'], rate: 0.06, where: 'any' }],
    lore: "the Velothi's tall grey volcanic wall, ash-streaked on Morrowind's side",
  },
});

/** A zone's land, by its biome (tamrielBiomes.js's) - null for a zone the table leaves as it stood, and for none. */
export function landOf(biome) {
  return biome ? /** @type {any} */ (LANDS[biome.key] ?? null) : null;
}

/** The zone key a Bay-coordinate pixel's land is (past the Bay, a zone the table names), or null - the Bay, the sea, and
 *  the zones the table leaves as they stood. */
export function landKeyAt(x, y) {
  const b = tamrielBiomeAt(x, y);
  return b && /** @type {any} */ (LANDS)[b.key] ? b.key : null;
}

/**
 * A PIXEL'S 3x3 OF LANDS, indexed (dz + 1) * 3 + (dx + 1) - dx east, dz north (the map row py - dz), as ECOTONE1's 3x3 of
 * climates is: `{ key, flora, props }` each (a zone the table names; `flora` its recipe or null, `props` its landmarks), null
 * for none - and a neighbour
 * the 3x3 does not read (tamrielGround.js climateNeighbourIn: a Bay pixel's off the Bay) wears the pixel's own. The terrain
 * kernel's (world/terrain/terrainGen.js): the pixel's flats are its zone's, its border's its neighbours' by ECOTONE1's law.
 * @param {number} px @param {number} py
 */
export function landsNine(px, py) {
  const out = new Array(9);
  for (let k = 0; k < 9; k++) {
    const x = px + (k % 3) - 1,
      y = py - (Math.floor(k / 3) - 1);
    const key = climateNeighbourIn(px, py, x, y) ? landKeyAt(x, y) : landKeyAt(px, py);
    const land = key ? /** @type {any} */ (LANDS)[key] : null;
    out[k] = land ? Object.freeze({ key, flora: land.flora ?? null, props: land.props ?? [] }) : null;
  }
  return out;
}

/** THE GROUND SET'S KEY for a zone's dress of a climate's ground archive (renderer.tileArrays', the ground maps') - a
 *  string, so it never meets an archive's number. */
export const groundSetKey = (zone, archive) => `lands:${zone}:${archive}`;
/**
 * A PIXEL'S GROUND SET: its zone's dress of `archive` (of its `base` in its stead) where `archive` is a SUMMER set
 * (TEXTURE.002, .102, .302, .402 - the winter's snow is the snow's) or a winter `snowless` names (the page's door,
 * climateSwaps.js winterSetSnowless - this module stays world/'s alone); else `archive` itself. Bay pixel (x, y).
 * @param {number} x @param {number} y @param {number|string} archive @param {(archive: number) => boolean} [snowless]
 */
export function landGroundSet(x, y, archive, snowless = () => false) {
  // TESA-LANDS' second audit (lane C): a winter set drawn without snow (Vanilla Enhanced's Snowless Swamps and Jungles,
  // SNOWLESS1 - the swamps' and the jungles' 403) is its summer's ground, dressed as it: the snow lane draws its summer set
  // there (no snow lies on it), and off that lane the Hist Swamps had worn the add-on's undressed set every winter
  const summer = typeof archive === 'number' && archive % 100 === 3 && snowless(archive) ? archive - 1 : archive;
  if (typeof summer !== 'number' || summer % 100 !== 2) return archive;
  const k = landKeyAt(x, y),
    g = k ? /** @type {any} */ (LANDS)[k].ground : null;
  return g ? groundSetKey(k, g.base ?? summer) : archive;
}
/** A ground set key's zone and archive, or null for an archive's own (a number, or a twin's key). */
export function parseGroundSetKey(key) {
  const m = typeof key === 'string' ? /^lands:([A-Za-z]+):(\d+)$/.exec(key) : null;
  return m ? { zone: m[1], archive: Number(m[2]) } : null;
}

/** Every zone the table names is one of tamrielBiomes.js's (a misspelt key would stand no land). */
for (const k of Object.keys(LANDS)) if (!BIOME_BY_KEY.has(k)) throw new Error(`tamrielLands: no zone ${k}`);
