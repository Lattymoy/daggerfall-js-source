// @ts-check
// GUILD-SHOP (2026-10-30, the owner: "New guild furniture pieces. A guild bank vendor, unique guild furniture pieces and
// anything else applicable"; bible/11-Multiplayer/Guild-Shop.md): THE GUILD'S OWN HALL PIECES - seven models the port
// builds (customModels.js registerCustomModel), each the guild shop's ware of its id (guildShopLaw.js `model`), offered
// in the decor tool's catalogue in a guild's hall alone. Built with the yards' mesh kit under the guild art's archive
// (world/guildFurnitureArt.js): the banner and the shield faces wear the hall's own arms. Every piece stands on its foot
// at y 0, its front to +z (a wall piece's back at z 0). Pure but for the registration. Not a DFU member.
import { YARD_MESH_KIT } from './merchantYards/merchantYardModels.js';
import { registerCustomModel } from './customModels.js';
import { GUILD_ART_ARCHIVE, GUILD_ART_REC as R } from './guildFurnitureArt.js';
import { GUILD_SHOP_WARES, GUILD_FURNITURE_MODELS, guildWareOfModel } from '../net/guild/guildShopLaw.js';
import { guildWareName } from '../ui/guild/guildShopText.js'; // a piece's name, in the player's language

const { faces, box, drum, assemble } = YARD_MESH_KIT;
const solid = { under: true };
/** A picture face square to +z (or -z with `back`): (x0..x1, y0..y1) at depth z, its picture's top-left at the viewer's
 *  top-left (the yards' signboard's law - the world is left-handed). */
function picture(f, rec, x0, y0, x1, y1, z, back = false) {
  if (!back) f.quad(rec, [x1, y1, z], [x0, y1, z], [x0, y0, z], [x1, y0, z], [0, 0], [1, 0], [1, 1], [0, 1], [0, 0, 1]);
  else f.quad(rec, [x0, y1, z], [x1, y1, z], [x1, y0, z], [x0, y0, z], [0, 0], [1, 0], [1, 1], [0, 1], [0, 0, -1]);
}

/** THE GUILD BANKER: a heavy counter of dark wood under a gilt rail, the guild's shield on its front, a brass grille along
 *  its back, a ledger open on it beside a coin scale and stacks of coin. Pressed in the hall, the guild's vault. */
export function bankerModel() {
  const f = faces();
  box(f, R.darkwood, -0.8, 0, -0.3, 0.8, 1.0, 0.3, solid); // the counter
  box(f, R.gilt, -0.84, 1.0, -0.34, 0.84, 1.05, 0.34, solid); // its gilt top
  box(f, R.gilt, -0.82, 0, -0.32, 0.82, 0.08, 0.32); // the plinth
  for (const x of [-0.6, 0.6]) box(f, R.oak, x - 0.12, 0.2, 0.3, x + 0.12, 0.8, 0.32); // panels either side
  box(f, R.gilt, -0.26, 0.18, 0.3, 0.26, 0.86, 0.315); // the crest's frame
  picture(f, R.shield, -0.23, 0.22, 0.23, 0.82, 0.318); // the guild's shield
  for (let k = 0; k <= 8; k++) {
    const x = -0.76 + k * 0.19;
    box(f, R.gilt, x - 0.012, 1.05, -0.3, x + 0.012, 1.5, -0.276);
  } // the grille's bars
  box(f, R.gilt, -0.78, 1.48, -0.31, 0.78, 1.52, -0.27); // its rail
  box(f, R.leather, -0.62, 1.05, -0.05, -0.22, 1.1, 0.2); // the ledger's covers
  box(f, R.map, -0.6, 1.1, -0.03, -0.24, 1.112, 0.18); // its open pages
  box(f, R.iron, 0.34, 1.05, 0.0, 0.38, 1.36, 0.04); // the scale's post
  box(f, R.iron, 0.2, 1.34, 0.0, 0.52, 1.36, 0.04); // its beam
  for (const x of [0.22, 0.5]) drum(f, R.gilt, x, 0.02, 8, 0.06, 0.07, 1.2, 1.22); // its pans
  for (const [x, z, n] of [
    [0.1, 0.12, 5],
    [0.16, 0.2, 3],
    [0.62, 0.15, 4],
  ])
    drum(f, R.gilt, x, z, 8, 0.035, 0.035, 1.05, 1.05 + n * 0.012); // coin
  return assemble(f, GUILD_ART_ARCHIVE);
}

/** THE HERALDIC STANDARD: an iron foot, a tall pole with a gilt finial, a crossbar, and the guild's banner hung from it,
 *  its arms on both faces. */
export function standardModel() {
  const f = faces();
  for (const [x, z] of [
    [0, 0.22],
    [0.19, -0.11],
    [-0.19, -0.11],
  ])
    box(f, R.iron, Math.min(0, x) - 0.03, 0, Math.min(0, z) - 0.03, Math.max(0, x) + 0.03, 0.06, Math.max(0, z) + 0.03); // the foot
  drum(f, R.iron, 0, 0, 8, 0.09, 0.05, 0.06, 0.24); // its collar
  drum(f, R.oak, 0, 0, 8, 0.035, 0.03, 0.24, 2.7); // the pole
  drum(f, R.gilt, 0, 0, 8, 0.06, 0.0, 2.7, 2.92); // the finial
  box(f, R.gilt, -0.42, 2.55, -0.025, 0.42, 2.6, 0.025, solid); // the crossbar
  picture(f, R.banner, -0.38, 0.95, 0.38, 2.55, 0.045); // the banner, the hall's arms - its faces clear of the pole (AUDIT GUILD-SHOP R8)
  picture(f, R.banner, -0.38, 0.95, 0.38, 2.55, -0.045, true);
  return assemble(f, GUILD_ART_ARCHIVE);
}

/** THE CREST PLAQUE: the guild's shield on a board of dark wood in a gilt rim, for a wall (its back at z 0). */
export function crestPlaqueModel() {
  const f = faces();
  box(f, R.darkwood, -0.42, 0, 0, 0.42, 0.95, 0.05, solid);
  box(f, R.gilt, -0.42, 0, 0.05, 0.42, 0.04, 0.07);
  box(f, R.gilt, -0.42, 0.91, 0.05, 0.42, 0.95, 0.07);
  box(f, R.gilt, -0.42, 0, 0.05, -0.38, 0.95, 0.07);
  box(f, R.gilt, 0.38, 0, 0.05, 0.42, 0.95, 0.07);
  picture(f, R.shield, -0.34, 0.08, 0.34, 0.86, 0.072);
  return assemble(f, GUILD_ART_ARCHIVE);
}

/** THE GUILDMASTER'S SEAT: a dais, a broad seat of dark wood on velvet, gilt arms, and a tall back with the guild's
 *  shield set into it under a gilt crest. */
export function throneModel() {
  const f = faces();
  box(f, R.darkwood, -0.75, 0, -0.6, 0.75, 0.18, 0.75, solid); // the dais
  box(f, R.darkwood, -0.42, 0.18, -0.35, 0.42, 0.62, 0.4, solid); // the seat's base
  box(f, R.velvet, -0.4, 0.62, -0.33, 0.4, 0.7, 0.38, solid); // its cushion
  for (const x of [-0.5, 0.42]) {
    box(f, R.darkwood, x, 0.18, -0.3, x + 0.08, 0.92, 0.38, solid);
    box(f, R.gilt, x - 0.01, 0.92, -0.3, x + 0.09, 0.96, 0.42, solid);
  } // its arms
  box(f, R.darkwood, -0.5, 0.62, -0.42, 0.5, 2.1, -0.32, solid); // the back
  box(f, R.velvet, -0.4, 0.75, -0.321, 0.4, 1.98, -0.32);
  box(f, R.gilt, -0.3, 1.04, -0.32, 0.3, 1.82, -0.31);
  picture(f, R.shield, -0.27, 1.07, 0.27, 1.79, -0.305);
  drum(f, R.gilt, -0.45, -0.37, 6, 0.06, 0.0, 2.1, 2.32); // the finials
  drum(f, R.gilt, 0.45, -0.37, 6, 0.06, 0.0, 2.1, 2.32);
  box(f, R.gilt, -0.18, 2.1, -0.4, 0.18, 2.36, -0.34); // the crest over it
  return assemble(f, GUILD_ART_ARCHIVE);
}

/** THE WAR TABLE: a long table of oak on turned legs, a map of Tamriel spread over it, the guild's markers on it. */
export function warTableModel() {
  const f = faces();
  box(f, R.oak, -1.1, 0.82, -0.6, 1.1, 0.9, 0.6, solid); // the top
  f.quad(
    R.map,
    [-1.0, 0.903, -0.52],
    [1.0, 0.903, -0.52],
    [1.0, 0.903, 0.52],
    [-1.0, 0.903, 0.52],
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
    [0, 1, 0],
  ); // the map, one picture
  for (const x of [-0.98, 0.98]) for (const z of [-0.48, 0.48]) drum(f, R.darkwood, x, z, 6, 0.06, 0.05, 0, 0.82); // the legs
  box(f, R.darkwood, -1.0, 0.18, -0.04, 1.0, 0.24, 0.04); // the stretcher
  for (const [x, z, rec] of [
    [-0.5, 0.1, R.velvet],
    [-0.2, -0.22, R.velvet],
    [0.3, 0.18, R.iron],
    [0.62, -0.1, R.iron],
    [0.05, 0.3, R.gilt],
  ])
    drum(f, rec, x, z, 6, 0.035, 0.02, 0.905, 0.99); // the markers
  return assemble(f, GUILD_ART_ARCHIVE);
}

/** THE WEAPON RACK: a frame of oak against a wall, three swords and two spears in it, the guild's shield over them. */
export function weaponRackModel() {
  const f = faces();
  for (const x of [-0.7, 0.62]) box(f, R.oak, x, 0, 0, x + 0.08, 1.8, 0.12, solid); // the uprights
  for (const y of [0.25, 0.95, 1.55]) box(f, R.oak, -0.7, y, 0, 0.7, y + 0.07, 0.12, solid); // the rails
  for (const x of [-0.45, -0.15, 0.15]) {
    box(f, R.iron, x - 0.025, 0.32, 0.13, x + 0.025, 1.35, 0.15);
    box(f, R.gilt, x - 0.09, 1.3, 0.12, x + 0.09, 1.33, 0.16);
    box(f, R.leather, x - 0.018, 1.33, 0.13, x + 0.018, 1.5, 0.15);
  } // swords: blade, guard, grip
  for (const x of [0.38, 0.52]) {
    drum(f, R.oak, x, 0.14, 6, 0.018, 0.018, 0.27, 1.9);
    drum(f, R.iron, x, 0.14, 4, 0.035, 0.0, 1.9, 2.08);
  } // spears
  box(f, R.gilt, -0.24, 1.62, 0.12, 0.24, 2.12, 0.14); // the crest's frame
  picture(f, R.shield, -0.21, 1.65, 0.21, 2.09, 0.142);
  return assemble(f, GUILD_ART_ARCHIVE);
}

/** THE GUILD BRAZIER: an iron bowl on three legs, its coals glowing, gilt bands round its rim. Its light is the decor's
 *  own (the catalogue entry's `light`). */
export function brazierModel() {
  const f = faces();
  for (const a of [0, 2.094, 4.189]) {
    const x = Math.sin(a) * 0.22,
      z = Math.cos(a) * 0.22;
    box(f, R.iron, x - 0.025, 0, z - 0.025, x + 0.025, 0.7, z + 0.025);
  } // the legs
  drum(f, R.iron, 0, 0, 12, 0.14, 0.34, 0.62, 0.86, R.coals); // the bowl, its coals on top
  drum(f, R.gilt, 0, 0, 12, 0.345, 0.345, 0.84, 0.88); // its rim
  drum(f, R.coals, 0, 0, 12, 0.3, 0.12, 0.88, 0.96); // the heaped coals, over the rim's plate (AUDIT GUILD-SHOP R8)
  return assemble(f, GUILD_ART_ARCHIVE);
}

/** Each ware's model builder, by its key. */
export const GUILD_FURNITURE_BUILDS = Object.freeze({
  banker: bankerModel,
  standard: standardModel,
  crestplaque: crestPlaqueModel,
  throne: throneModel,
  wartable: warTableModel,
  weaponrack: weaponRackModel,
  brazier: brazierModel,
});

/** The guild brazier's light (decorLaw.js decorLightOf's shape): warm, a room's reach. */
export const GUILD_BRAZIER_LIGHT = Object.freeze({ color: [1.0, 0.62, 0.3], range: 9, intensity: 1.6 });
/**
 * THE GUILD'S PIECES IN THE DECOR CATALOGUE (decorCatalogue.js HALL_BOARD_ENTRY's shape): one an owned ware, offered in a
 * guild's hall alone (`hall`), priced in no gold (`guild` - its ware, the stock the guild shop keeps). The banker opens
 * the vault; the brazier lights.
 */
export const GUILD_FURNITURE_ENTRIES = Object.freeze(
  GUILD_SHOP_WARES.filter((w) => w.model != null).map((w) =>
    Object.freeze({
      key: `m${w.model}`,
      model: w.model,
      flat: null,
      kind: 'furniture',
      get name() {
        return guildWareName(w.key);
      },
      guild: w.key,
      count: 0,
      storage: false,
      light: w.key === 'brazier' ? GUILD_BRAZIER_LIGHT : null,
      hall: true,
    }),
  ),
);
/** Whether a placed piece is the guild's banker (scenes/worldModes.js: its press opens the vault). */
export const isGuildBanker = (/** @type {any} */ piece) =>
  guildWareOfModel(piece?.model)?.key === 'banker' && !piece?.item;

let _registered = false;
/** Once: the seven pieces on the model door (scenes/dataPipeline.js asks it before ARCH3D). */
export function registerGuildFurniture() {
  if (_registered) return;
  _registered = true;
  for (const id of GUILD_FURNITURE_MODELS) {
    const build =
      GUILD_FURNITURE_BUILDS[/** @type {keyof typeof GUILD_FURNITURE_BUILDS} */ (guildWareOfModel(id)?.key)];
    registerCustomModel(
      id,
      () => build(),
      () => true,
      { climateFree: true },
    );
  }
}
