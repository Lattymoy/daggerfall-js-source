// @ts-check
// Skyrim plant flat catalog - archive, records, Lands picks. Pure (worker-safe): no texture door.
// Pictures and registration live in skyrimFloraArt.js.

/** Pseudo-archive for every Skyrim plant flat (world/eliteGates/pseudoArchives.js). */
export const SKYRIM_FLORA_ARCHIVE = 38362;

/**
 * @typedef {{ zone: 'pinewood'|'reach'|'frozenCoast'|'tundra', file: string, name: string, hang?: boolean }} SkyrimFloraEntry
 */
/** Every plant in record order - record i is SKYRIM_FLORA[i]. `hang`: drapes from trees/rocks, never ground cover. */
export const SKYRIM_FLORA = Object.freeze(/** @type {readonly SkyrimFloraEntry[]} */ ([
  { zone: 'pinewood', file: 'Fern_SK_A.png', name: 'Fern_SK_A' },
  { zone: 'pinewood', file: 'Fern_SK_B.png', name: 'Fern_SK_B' },
  { zone: 'pinewood', file: 'MoraTapinella_SK_A.png', name: 'MoraTapinella_SK_A' },
  { zone: 'pinewood', file: 'MoraTapinella_SK_B.png', name: 'MoraTapinella_SK_B' },
  { zone: 'pinewood', file: 'MountainFlowerYellow_SK_A.png', name: 'MountainFlowerYellow_SK_A' },
  { zone: 'pinewood', file: 'MountainFlowerYellow_SK_C.png', name: 'MountainFlowerYellow_SK_C' },
  { zone: 'pinewood', file: 'Thistle_SK_A.png', name: 'Thistle_SK_A' },
  { zone: 'pinewood', file: 'Thistle_SK_B.png', name: 'Thistle_SK_B' },
  { zone: 'reach', file: 'DeadShrub_SK_A.png', name: 'DeadShrub_SK_A' },
  { zone: 'reach', file: 'DeadShrub_SK_B.png', name: 'DeadShrub_SK_B' },
  { zone: 'reach', file: 'HangingMoss_SK_A.png', name: 'HangingMoss_SK_A', hang: true },
  { zone: 'reach', file: 'HangingMoss_SK_B.png', name: 'HangingMoss_SK_B', hang: true },
  { zone: 'reach', file: 'Juniper_SK_A.png', name: 'Juniper_SK_A' },
  { zone: 'reach', file: 'Juniper_SK_B.png', name: 'Juniper_SK_B' },
  { zone: 'frozenCoast', file: 'LichenShrub_SK_A.png', name: 'LichenShrub_SK_A' },
  { zone: 'frozenCoast', file: 'LichenShrub_SK_B.png', name: 'LichenShrub_SK_B' },
  { zone: 'frozenCoast', file: 'Snowberry_SK_A.png', name: 'Snowberry_SK_A' },
  { zone: 'frozenCoast', file: 'Snowberry_SK_B.png', name: 'Snowberry_SK_B' },
  { zone: 'frozenCoast', file: 'SpikyGrass_SK_A.png', name: 'SpikyGrass_SK_A' },
  { zone: 'frozenCoast', file: 'SpikyGrass_SK_B.png', name: 'SpikyGrass_SK_B' },
  { zone: 'tundra', file: 'Deathbell_SK_A.png', name: 'Deathbell_SK_A' },
  { zone: 'tundra', file: 'Deathbell_SK_B.png', name: 'Deathbell_SK_B' },
  { zone: 'tundra', file: 'DragonsTongue_SK_A.png', name: 'DragonsTongue_SK_A' },
  { zone: 'tundra', file: 'DragonsTongue_SK_B.png', name: 'DragonsTongue_SK_B' },
  { zone: 'tundra', file: 'Lavender_SK_A.png', name: 'Lavender_SK_A' },
  { zone: 'tundra', file: 'Lavender_SK_B.png', name: 'Lavender_SK_B' },
  { zone: 'tundra', file: 'MountainFlowerBlue_SK_A.png', name: 'MountainFlowerBlue_SK_A' },
  { zone: 'tundra', file: 'MountainFlowerBlue_SK_B.png', name: 'MountainFlowerBlue_SK_B' },
  { zone: 'tundra', file: 'MountainFlowerBlue_SK_C.png', name: 'MountainFlowerBlue_SK_C' },
  { zone: 'tundra', file: 'MountainFlowerPurple_SK_A.png', name: 'MountainFlowerPurple_SK_A' },
  { zone: 'tundra', file: 'MountainFlowerPurple_SK_B.png', name: 'MountainFlowerPurple_SK_B' },
  { zone: 'tundra', file: 'MountainFlowerPurple_SK_C.png', name: 'MountainFlowerPurple_SK_C' },
  { zone: 'tundra', file: 'MountainFlowerRed_SK_A.png', name: 'MountainFlowerRed_SK_A' },
  { zone: 'tundra', file: 'MountainFlowerRed_SK_B.png', name: 'MountainFlowerRed_SK_B' },
  { zone: 'tundra', file: 'MountainFlowerRed_SK_C.png', name: 'MountainFlowerRed_SK_C' },
  { zone: 'tundra', file: 'TundraCotton_SK_A.png', name: 'TundraCotton_SK_A' },
  { zone: 'tundra', file: 'TundraCotton_SK_B.png', name: 'TundraCotton_SK_B' },
]));

/** Tracked path of every plant PNG - doctrine allow-list. */
export const SKYRIM_FLORA_PATHS = Object.freeze(SKYRIM_FLORA.map((e) => `src/assets/skyrim/flora/${e.zone}/${e.file}`));

/** HangingMoss records - drapes only (skyrimFloraMesh.js). */
export const SKYRIM_HANGING_RECORDS = Object.freeze(
  SKYRIM_FLORA.map((e, i) => (e.hang ? i : -1)).filter((i) => i >= 0),
);
export const isSkyrimHangingRecord = (/** @type {number} */ record) => !!SKYRIM_FLORA[record]?.hang;

/** Meadow-style cards a ground plant stands on (render/grassMeadow.js MEADOW_CARDS). */
export const SKYRIM_FLORA_CARDS = 3;

/**
 * Lands cover picks for a zone: `[archive, record, weight]`. Hanging moss stays out (drapes from hosts).
 * @param {'pinewood'|'reach'|'frozenCoast'|'tundra'} zone
 * @param {number} [weight=2]
 */
export function skyrimCoverPicks(zone, weight = 2) {
  const out = [];
  for (let i = 0; i < SKYRIM_FLORA.length; i++) {
    if (SKYRIM_FLORA[i].zone === zone && !SKYRIM_FLORA[i].hang) {
      out.push(Object.freeze(/** @type {const} */ ([SKYRIM_FLORA_ARCHIVE, i, weight])));
    }
  }
  return Object.freeze(out);
}
