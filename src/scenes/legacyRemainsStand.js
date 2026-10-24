// @ts-check
// FB1013d REMAINS-STAND (FIELD BUGS 2026-10-13d, TheHalfinStream: "Died of fatigue in wayrest palace, character aged
// past limit and remains did not appear"; bible/06-Systems/Legacy-Arc.md section 7): THE REMAINS ARE SEEN WHERE THEY LIE.
//
// AUDIT LEGACY H1 made the remains a list the RECORD owns - a world pile laid again at every visit handed the heirloom
// out twice - and the pile's picture went with it: nothing stood where the fallen fell. The list opened by itself within
// six paces of the very spot underground (sixty metres outdoors), and nothing in the world said where that spot was; in a
// castle's halls the heir walked past it. So the remains stand again, as a body in the ground pool of the host the one
// played stands in (scenes/droppedLoot.js - the street's, or a dungeon's through worldModes' droppedPool), and the body's
// list IS the record's: the same array, so the window takes from the record as the list's own window always did. The
// body is `unsaved` - no save, no scene cache and no room's memory carries it, the record is its one owner - stood afresh
// at each visit and let go when its place is left, its pool goes (a door, a load, a pixel collected), its list is taken
// home, laid to rest or emptied, or the switch is off. Nothing is laid twice.
//
// Pressed, it opens as any body or pile opens (each host's own loot door: the window, the quick door, the plaque's name,
// the line of light). It holds no find (`noFind`, systems/silverFinds.js): its list is the line's, stood afresh at every
// visit, and a find rolled at each would pay for coming back.
//
// The host hands in everything this touches - the pool it stands in now and where a place stands in it - so the pins
// drive it with a real pool and fakes for the world.

/** Who stands it (droppedLoot's `owner`). */
export const REMAINS_STAND_OWNER = 'legacy';
/** The line over it (scenes/lootLines.js pickLootLines' `mark`): bone-pale, tall, steady - seen across a hall, with the
 *  loot-rarity row on or off, as a fallen player's own remains in the open zone are (droppedLoot.js WILD_MINE_MARK). */
export const REMAINS_MARK = Object.freeze({ colour: Object.freeze([0.93, 0.88, 0.7]), h: 7, pulse: false, reach: 60 });

/**
 * @param {object} o
 * @param {() => any} o.pool                                   the ground pool of the host the one played stands in now, or null
 * @param {(place: any) => (number[]|null)} o.feetOf           where `place` stands in that pool now - the floor under the
 *   fallen's last position - or null when the one played is not where it lies (or its ground is not built yet)
 * @param {(place: any) => (string|null)} [o.pixelKeyOf]       the map pixel a street body dies with (droppedLoot collectPixel)
 * @param {{ archive: number, record: number }} o.icon         the remains' own picture (legacyHost.js REMAINS_FLAT)
 * @param {(row: any) => string} o.label                       the plaque's name for it
 */
export function createRemainsStand({ pool, feetOf, pixelKeyOf = () => null, icon, label }) {
  /** @type {Map<string, { pile: any, pool: any }>} */
  const stood = new Map();
  const unstand = (/** @type {string} */ id) => {
    const s = stood.get(id);
    if (!s) return;
    stood.delete(id);   // THE SLOT IS EMPTIED BEFORE THE OCCUPANT IS TOLD (Home.md)
    try { s.pool?.removePile?.(s.pile); } catch { /* a pool torn down already */ }
  };
  return {
    /**
     * The rows of the line still lying (legacyHost.js remainsToStand): each stood where it lies while the one played is
     * there, kept while nothing it is made of changes, let go otherwise - gone from here, another pool, its pile let go
     * under it (a pixel collected, a load's rebuild), put away emptied (releaseEmptied), or the record's list replaced
     * (a load's merge): stood again from the record. Answers how many stand.
     * @param {any[]} rows
     */
    frame(rows) {
      const p = pool();
      /** @type {Map<string, { r: any, feet: number[] }>} */
      const want = new Map();
      for (const r of rows ?? []) {
        if (!p || r?.state !== 'lying' || !Array.isArray(r.items) || !r.items.length) continue;
        const feet = feetOf(r.place);
        if (Array.isArray(feet) && feet.length === 3 && feet.every(Number.isFinite)) want.set(r.id, { r, feet });
      }
      for (const [id, s] of [...stood]) {
        const w = want.get(id);
        if (!w || s.pool !== p || s.pile.dead || s.pile.inactive || s.pile.items !== w.r.items) unstand(id);
      }
      for (const [id, { r, feet }] of want) {
        if (stood.has(id)) continue;
        const pile = p.seedPile(r.items, feet, icon, null, pixelKeyOf(r.place), { unsaved: true, owner: REMAINS_STAND_OWNER });
        if (!pile) continue;
        pile.label = label(r);   // the plaque's name for it (droppedLoot labelFor)
        pile.mark = REMAINS_MARK;   // its line of light (droppedLoot lootFinds)
        pile.noFind = true;   // no silver find (systems/silverFinds.js)
        stood.set(id, { pile, pool: p });
      }
      return stood.size;
    },
    /** Every body let go - a load's adopt replaced every list (world.js letGoRemains, AUDIT FB1013d A2). */
    clear() { for (const id of [...stood.keys()]) unstand(id); },
  };
}
