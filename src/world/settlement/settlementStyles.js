// @ts-check
// RMB-CONTRACTS RMBC2 (2026-10-31, bible/03-World/RMB-Contracts.md): WHAT A GENERATED SETTLEMENT IS MADE OF, AS DATA. A
// style is a theatre's way of building (every theatre has one: the Bay and the nine provinces); an archetype is a kind of
// settlement - its layout family, its size, its services and its features. A designer adds a row; the engine
// (settlementGen.js) reads rows and never names a province. The numbers are ours: DFU's towns are RMB grids.
import { THEATRE_KEYS } from '../worldWide/worldGrid.js';

/**
 * @typedef {{ look: string, wall: string, roofArt: string, pitch: number, storeys: readonly [number, number], roof: string, frontage: readonly [number, number],
 *   depth: readonly [number, number], gap: number, street: number, lane: number, back: number, deck: number,
 *   terrace: number, temple: string, ground: string }} SettlementStyle
 *   look: TOWN_LOOK's set; wall, roofArt, ground, pitch: walls', roof's and terraces' pictures (CAPITAL_ART), gables' degrees;
 *   gap: (0 a row); street, lane, back: a band's street, side lane and yard; deck: a raised town's height (0 cut in);
 *   terrace: the most a step between pads rises; temple: the divine its temple serves (a Temple.Divines name)
 */
const style = (/** @type {SettlementStyle} */ s) => Object.freeze(s);

/** A style for every theatre (worldGrid.js THEATRE_KEYS). */
export const SETTLEMENT_STYLES = Object.freeze({
  IliacBay: style({ look: 'IliacBay', ground: 'mossStone', wall: 'facadeTimber', roofArt: 'roof', pitch: 35, storeys: [1, 2], roof: 'gable', frontage: [9, 14], depth: [9, 13], gap: 2, street: 5, lane: 3, back: 2, deck: 0, terrace: 3, temple: 'Akatosh' }),
  HighRock: style({ look: 'HighRock', ground: 'mossStone', wall: 'facadeTimber', roofArt: 'blueSlate', pitch: 40, storeys: [2, 3], roof: 'gable', frontage: [7, 11], depth: [9, 12], gap: 0, street: 5, lane: 2.5, back: 2, deck: 0, terrace: 3, temple: 'Dibella' }),
  Hammerfell: style({ look: 'Hammerfell', ground: 'sandstone', wall: 'facadeOchre', roofArt: 'terracotta', pitch: 0, storeys: [1, 2], roof: 'flat', frontage: [9, 14], depth: [10, 13], gap: 0, street: 4.5, lane: 2.5, back: 2, deck: 0, terrace: 3, temple: 'Arkay' }),
  Skyrim: style({ look: 'Skyrim', ground: 'nordStone', wall: 'facadeStone', roofArt: 'blueSlate', pitch: 50, storeys: [1, 2], roof: 'steep', frontage: [10, 16], depth: [8, 11], gap: 3, street: 5, lane: 3, back: 3, deck: 0, terrace: 3.5, temple: 'Kynareth' }),
  Morrowind: style({ look: 'Morrowind', ground: 'rock', wall: 'facadeWhite', roofArt: 'terracotta', pitch: 25, storeys: [1, 3], roof: 'dome', frontage: [8, 12], depth: [8, 12], gap: 2, street: 4.5, lane: 2.5, back: 2, deck: 0, terrace: 3.5, temple: 'Akatosh' }),
  Sumurset: style({ look: 'Sumurset', ground: 'marble', wall: 'facadeWhite', roofArt: 'terracotta', pitch: 30, storeys: [2, 3], roof: 'hip', frontage: [10, 15], depth: [10, 14], gap: 3, street: 6, lane: 3, back: 3, deck: 0, terrace: 3, temple: 'Akatosh' }),
  Valenwood: style({ look: 'Valenwood', ground: 'mossStone', wall: 'facadeTimber', roofArt: 'roof', pitch: 40, storeys: [1, 1], roof: 'gable', frontage: [7, 10], depth: [7, 9], gap: 3, street: 3, lane: 2, back: 2, deck: 4, terrace: 2, temple: 'Zenithar' }),
  Elsweyr: style({ look: 'Elsweyr', ground: 'sandstone', wall: 'facadeOchre', roofArt: 'terracotta', pitch: 0, storeys: [1, 2], roof: 'flat', frontage: [8, 12], depth: [9, 12], gap: 1, street: 4.5, lane: 2.5, back: 2, deck: 0, terrace: 3, temple: 'Akatosh' }),
  BlackMarsh: style({ look: 'BlackMarsh', ground: 'mossStone', wall: 'facadeTimber', roofArt: 'roof', pitch: 40, storeys: [1, 1], roof: 'gable', frontage: [7, 10], depth: [7, 9], gap: 3, street: 3, lane: 2, back: 2, deck: 1.4, terrace: 2, temple: 'Arkay' }),
  Imperial: style({ look: 'Imperial', ground: 'bridgeStone', wall: 'facadeBrick', roofArt: 'terracotta', pitch: 35, storeys: [2, 3], roof: 'gable', frontage: [8, 12], depth: [10, 13], gap: 0, street: 6, lane: 3, back: 2, deck: 0, terrace: 3, temple: 'Stendarr' }),
});

/** A theatre's style by its index (0 the Bay, 1..9 the provinces). @param {number} theatre */
export const styleOfTheatre = (theatre) => SETTLEMENT_STYLES[/** @type {keyof typeof SETTLEMENT_STYLES} */ (THEATRE_KEYS[theatre] ?? 'IliacBay')] ?? SETTLEMENT_STYLES.IliacBay;

/**
 * @typedef {{ type: string, near: 'plaza'|'gate'|'any', guild?: string }} Service - a building the settlement keeps,
 *   by its BUILDING_TYPES name, and where it wants to stand
 * @typedef {{ frame: 'ring'|'row'|'auto', centre: 'high'|'low'|'site'|'contour'|'water', size: readonly [number, number],
 *   bands: number, sectors: readonly [number, number], plaza: number, gates: number, islands: boolean, wall: boolean,
 *   keep: boolean, docks: boolean, wealth: number, services: readonly Service[], centreFeature: string, core?: boolean }} Archetype
 *   size: a ring's radius or a row's length, metres; bands: rings or rows of plots; islands: decks of their own, bridged
 */
const archetype = (/** @type {Archetype} */ a) => Object.freeze(a);
/** @param {string} type @param {'plaza'|'gate'|'any'} [near] @param {string} [guild] @returns {Service} */
const S = (type, near = 'any', guild = undefined) => Object.freeze({ type, near, ...(guild ? { guild } : {}) });

/** The kinds of settlement the engine lays out (the WORLD 2.0 specification's Phase 3 five, and a plain village). */
export const SETTLEMENT_ARCHETYPES = Object.freeze({
  oasis: archetype({ frame: 'ring', centre: 'low', size: [62, 80], bands: 3, sectors: [7, 9], plaza: 16, gates: 2, islands: false, wall: false, keep: false, docks: false, wealth: 0.45,
    services: [S('Tavern', 'gate'), S('GeneralStore', 'plaza'), S('Temple', 'plaza'), S('Alchemist', 'plaza')], centreFeature: 'well' }),
  mining: archetype({ frame: 'row', centre: 'contour', size: [120, 160], bands: 4, sectors: [5, 7], plaza: 0, gates: 2, islands: false, wall: false, keep: false, docks: false, wealth: 0.35,
    services: [S('Tavern', 'gate'), S('GeneralStore', 'plaza'), S('Armorer'), S('WeaponSmith'), S('Alchemist')], centreFeature: 'well' }),
  fort: archetype({ frame: 'ring', centre: 'high', size: [80, 100], bands: 4, sectors: [8, 10], plaza: 22, gates: 1, islands: false, wall: true, keep: true, docks: false, wealth: 0.6,
    services: [S('Tavern', 'gate'), S('Temple', 'plaza'), S('Armorer', 'plaza'), S('WeaponSmith', 'plaza'), S('GeneralStore'), S('GuildHall', 'any', 'FightersGuild')], centreFeature: 'statue' }),
  river: archetype({ frame: 'row', centre: 'water', size: [150, 190], bands: 3, sectors: [6, 8], plaza: 0, gates: 2, islands: false, wall: false, keep: false, docks: true, wealth: 0.65,
    services: [S('Tavern', 'plaza'), S('GeneralStore', 'plaza'), S('Bank', 'plaza'), S('ClothingStore'), S('Alchemist'), S('PawnShop', 'gate'), S('GuildHall', 'any', 'MagesGuild')], centreFeature: 'fountain' }),
  wetland: archetype({ frame: 'ring', centre: 'site', size: [55, 72], bands: 3, sectors: [6, 8], plaza: 12, gates: 1, islands: true, wall: false, keep: false, docks: false, wealth: 0.3,
    services: [S('Tavern', 'plaza'), S('GeneralStore', 'plaza'), S('Temple')], centreFeature: 'market' }),
  village: archetype({ frame: 'auto', centre: 'site', size: [48, 64], bands: 2, sectors: [6, 8], plaza: 14, gates: 2, islands: false, wall: false, keep: false, docks: false, wealth: 0.4,
    services: [S('Tavern', 'gate'), S('GeneralStore', 'plaza')], centreFeature: 'well' }),
  // RMB-CONTRACTS RMBC6: a town's outskirts - rings round its legacy core (the plaza's place, `core`), never alone
  outskirts: archetype({ frame: 'ring', centre: 'site', size: [0, 0], bands: 3, sectors: [16, 22], plaza: 0, gates: 0, islands: false, wall: false, keep: false, docks: false, wealth: 0.35,
    services: [S('Tavern', 'plaza')], centreFeature: 'none', core: true }),
});
