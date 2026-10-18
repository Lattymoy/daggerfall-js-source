// @ts-check
// STUDIO1 (bible/07-Rendering/Studio-Art.md): THE SLOTS - the pictures of the eight models the studio covers (the
// wagons, carts and caravan, the three ships, the towns' hangings, the yards, the port, the LeFay monument), which an
// artist's picture in the studio takes the place of, named and drawn as painted.
//
// These are the pictures trashBattery meant ("the cart textures look strange ... they're not unique textures yet"):
// painted from numbers at the load under pseudo-archives of the port's own (bible/01-Overview/DF-Art.md), the wagons'
// recoloured for each paint. The port paints a few more it has no set for yet (the gate's, the Abyss's - the record's
// Not yet). Each slot is a key the studio's names use (`38181_1-0`), a name a person reads, the
// label the templates are saved under (`38181_1-0--cart-side-weathered-oak.png`) and its picture, painted on demand -
// top-down RGBA, the way a PNG is - so the studio page (studio.html) and the tool (tools/studioArt.mjs) hand an artist
// the picture they are replacing at its own size and shape. Painted here as the game paints them before DF-LOOK lays
// Daggerfall's palette on (there is no palette without the player's ARENA2): these are the port's own numbers, and a
// template of them is ours to hand out (Port-Doctrine).
//
// Daggerfall's own textures are slots too - any `<archive>_<record>-<frame>` a texture pack can name - but they are
// the player's data: the archive sheet (archive-sheet.html) reads them off the player's own ARENA2, and nothing here
// draws them.
import { wagonArt, wagonLookArt, WAGON_ARCHIVE, TEX as WAGON_TEX, LOOK_RECORDS, lookRecord, isGlassRecord } from '../../world/wagonArt.js';
import { WAGON_OUTSIDE_LOOKS, CARAVAN_INSIDE_LOOKS, LOOK_NAMES } from '../wagon/wagonLooks.js';
import { GALLEON_ARCHIVE, TEX as GALLEON_TEX, GALLEON_NIGHT, galleonArt, galleonGlow, shipStandIns } from '../../world/ships/galleonArt.js';
import { CARRACK_ARCHIVE, TEX as CARRACK_TEX, CARRACK_NIGHT, carrackArt, carrackGlow } from '../../world/ships/carrackArt.js';
import { LARGE_BOAT_ARCHIVE, TEX as BOAT_TEX, largeBoatArt } from '../../world/ships/largeBoatArt.js';
import { TOWN_PICTURE_ARCHIVE, TOWN_PICTURES } from '../../world/townPictures.js';
import { LEFAY_ARCHIVE, LEFAY_GRANITE, LEFAY_MARBLE, LEFAY_GILT, LEFAY_PLAQUE, LEFAY_BRONZE } from '../../world/lefayMonument.js';
import { lefayArt } from '../../world/lefayArt.js';
import { YARD_ARCHIVE, YARD_REC, yardArt } from '../../world/merchantYards/merchantYardArt.js';
import { PORT_ARCHIVE, PORT_REC, PORT_PAINTERS, PORT_HOW } from '../../world/portArt.js';
import { textureKey, textureName } from '../textureReplacement.js';
import { STUDIO_LABEL } from './studioArt.js';

/** A name as a file's label: lower case, words joined by dashes (`Weathered oak` -> `weathered-oak`). */
export const slotLabel = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
/** A camelCase record name read out (`caravanSide` -> `caravan side`). */
const words = (k) => k.replace(/([a-z])([A-Z0-9])/g, '$1 $2').toLowerCase();
/** A picture as a PNG holds it: top-down RGBA in `data` (the yards', the port's and the monument's paint into `colors`,
 *  top-down too - their faces are laid that way, studioArt.js paintedReplacement). */
const asRgba = (p) => (p ? { width: p.width, height: p.height, data: p.data ?? p.colors } : null);
const nameOf = (table, rec) => Object.keys(table).find((k) => table[k] === rec);

/** The wagons' records as an artist reads them (world/wagonArt.js TEX: which wagon wears what). */
const WAGON_NAMES = Object.freeze({
  floor: 'floorboards', side: 'cart side boards', inner: 'inner boards', beam: 'running gear', bench: 'bench', tyre: 'iron tyre',
  wheel: 'wheel face', iron: 'ironwork', openSide: 'open wagon side', tilt: 'open wagon tilt', tiltInner: 'open wagon tilt inside',
  caravanSide: 'caravan side', caravanFront: 'caravan front', caravanRear: 'caravan rear door', caravanRoof: 'caravan roof',
  roomSide: 'caravan room wall', roomFront: 'caravan room front', roomRear: 'caravan room rear', roomCeiling: 'caravan room ceiling',
  roomFloor: 'caravan room floor', harness: 'harness straps',
});
const wagonName = (rec) => WAGON_NAMES[nameOf(WAGON_TEX, rec)];

/** The wagons': every built record, and every paint's own record of the ones a paint repaints. */
function wagonSlots() {
  const built = new Map(wagonArt());
  const paintOf = new Map();   // a paintable record -> [list, choices]
  for (const [list, recs] of Object.entries(LOOK_RECORDS)) for (const rec of recs) paintOf.set(rec, [list, WAGON_OUTSIDE_LOOKS[list] ?? CARAVAN_INSIDE_LOOKS[list]]);
  const out = [];
  for (const [rec, pic] of built) {
    const p = paintOf.get(rec);
    out.push({ record: rec, name: p ? `${wagonName(rec)} - ${LOOK_NAMES[p[1][0]]}` : wagonName(rec), cutout: isGlassRecord(rec), picture: () => pic });
  }
  for (const [list, recs] of Object.entries(LOOK_RECORDS)) {
    const choices = WAGON_OUTSIDE_LOOKS[list] ?? CARAVAN_INSIDE_LOOKS[list];
    for (let i = 1; i < choices.length; i++) {
      const painted = new Map(/** @type {Array<[number, any]>} */ (wagonLookArt(list, i, choices[i])));
      for (const rec of recs) out.push({ record: lookRecord(rec, i), name: `${wagonName(rec)} - ${LOOK_NAMES[choices[i]]}`, cutout: isGlassRecord(lookRecord(rec, i)), picture: () => painted.get(lookRecord(rec, i)) });
    }
  }
  return out.sort((a, b) => a.record - b.record);
}

/** A ship's: each record as her stand-in builds it (a window's glass a hole by day), and each window's night twin. */
function shipSlots(archive, tex, art, night, glow) {
  const made = new Map(art());
  const entries = shipStandIns({ archive, name: 'studio', records: Object.values(tex), art: (r) => made.get(r) ?? null, night, glow });
  const dayOf = new Map(Object.entries(night).map(([day, twin]) => [twin, Number(day)]));
  return entries.map((e) => ({
    record: e.record,
    name: dayOf.has(e.record) ? `${words(nameOf(tex, dayOf.get(e.record)))} - at night` : words(nameOf(tex, e.record)),
    cutout: Object.hasOwn(night, e.record),   // a stern window by day: its glass a hole (the pool's cutOf)
    picture: () => e.build(),
  })).sort((a, b) => a.record - b.record);
}

/** The monument's names by record. */
const LEFAY_NAMES = Object.freeze({ [LEFAY_GRANITE]: 'granite steps', [LEFAY_MARBLE]: 'marble', [LEFAY_GILT]: 'gilt point', [LEFAY_PLAQUE]: 'plaque', [LEFAY_BRONZE]: 'bronze edge' });

/**
 * THE SETS: each model the port paints itself, its archive, how its pictures reach the game - `door` 'vendor' (the
 * texture door's own tier: a studio picture outranks the painted stand-in there) or 'painted' (its host paints and
 * uploads them, asking studioArt.js paintedReplacement first) - and its slots, made when asked.
 */
export const STUDIO_SETS = Object.freeze([
  { id: 'wagons', title: 'Wagons, carts and the caravan', archive: WAGON_ARCHIVE, door: 'painted', slots: wagonSlots },
  { id: 'galleon', title: 'The galleon', archive: GALLEON_ARCHIVE, door: 'vendor', slots: () => shipSlots(GALLEON_ARCHIVE, GALLEON_TEX, galleonArt, GALLEON_NIGHT, galleonGlow) },
  { id: 'carrack', title: 'The carrack', archive: CARRACK_ARCHIVE, door: 'vendor', slots: () => shipSlots(CARRACK_ARCHIVE, CARRACK_TEX, carrackArt, CARRACK_NIGHT, carrackGlow) },
  { id: 'largeboat', title: 'The large boat', archive: LARGE_BOAT_ARCHIVE, door: 'vendor', slots: () => shipSlots(LARGE_BOAT_ARCHIVE, BOAT_TEX, largeBoatArt, {}, () => null) },
  { id: 'hangings', title: "Towns' tapestries, banners and rugs", archive: TOWN_PICTURE_ARCHIVE, door: 'vendor', slots: () => TOWN_PICTURES.map((p, record) => ({ record, name: p.name, picture: () => p.draw() })) },
  { id: 'yards', title: 'The stable, wagon yard and joinery', archive: YARD_ARCHIVE, door: 'painted', slots: () => yardArt().map(([record, pic]) => ({ record, name: words(nameOf(YARD_REC, record)), picture: () => pic })) },
  { id: 'port', title: 'The shipyard and the lighthouse', archive: PORT_ARCHIVE, door: 'painted', slots: () => PORT_PAINTERS.map(([record, paint]) => ({ record, name: words(nameOf(PORT_REC, record)), cutout: PORT_HOW[record]?.cutout === true, picture: paint })) },
  { id: 'lefay', title: 'The LeFay monument', archive: LEFAY_ARCHIVE, door: 'painted', slots: () => lefayArt().map(([record, pic]) => ({ record, name: LEFAY_NAMES[record], picture: () => pic })) },
]);

/**
 * Every slot of a set, as an artist sees it: its key, its name, whether its door cuts holes where it is clear, the file
 * name a template is saved under and the studio's names may use, and its picture (top-down RGBA, painted when asked).
 * @param {typeof STUDIO_SETS[number]} set
 */
export function studioSlots(set) {
  return set.slots().map((s) => {
    const key = textureKey(set.archive, s.record, 0);
    return {
      set: set.id, archive: set.archive, record: s.record, key, name: s.name,
      cutout: s.cutout === true,   // its door uploads it a cut-out: a texel under half opaque is a hole; every other slot is drawn solid
      fileName: `${textureName(set.archive, s.record, 0)}${STUDIO_LABEL}${slotLabel(s.name)}.png`,
      picture: async () => asRgba(await s.picture()),
    };
  });
}
