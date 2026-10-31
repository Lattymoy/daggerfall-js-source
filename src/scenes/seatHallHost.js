// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SEAT-HALL and CROWN-HALL, moved out of bootWorld (HOST-SPLIT, DOMAIN2 -
// bible/11-Multiplayer/Domains.md section 6): A SEAT'S HALLS AS THE MODES
// HOST ASKS THEM (scenes/worldModes.js seatHallsFrame, crownHere) - a
// palace seat's Charter Room, a crown's throne room - and, DOMAIN2, the
// guild's own castle the instance door offers (scenes/instanceDoor.js).
//
// A CASTLE IS ITS REGION'S (Domains law 3): its throne room stands its
// region's holder's banners, roster board and vault chest in the public
// castle, as CROWN-HALL built it, and in the holder's own instance of the
// castle - the one whose epoch the guild's view names - and in NO other
// instance: before DOMAIN2 a quest's private castle stood the holder's
// pieces too, because the dressing read the castle's map id alone.
//
// deps: seatHere(mapId) - the seat a location is, dressed in its holder
// (world.js, off the seats' book); guild() - this character's guild as its
// book last read it (net/guild/guildBook.js `guild`: its id, rank and,
// DOMAIN2, its castles).
// ═══════════════════════════════════════════════════════════════════
import { seatHallOf, seatBannerOf } from '../net/townSeatLaw.js';
import { guildMay } from '../net/guild/guildLaw.js'; // SEAT-HALL: a palace's keepers are a hall's; GUILD-RANKS: as the guild set them

/** @param {{ seatHere: (mapId: number) => any, guild: () => any }} deps */
export function createSeatHallHost({ seatHere, guild }) {
  /** DOMAIN2: my guild's castle whose key is `mapId` (a crown city's castle is its own location's dungeon), or null. */
  const castleOf = (mapId) => {
    const g = guild();
    const c = (g?.castles ?? []).find((x) => x?.key === mapId);
    return g?.id && c ? { guild: g.id, key: c.key, epoch: c.epoch, region: c.region } : null;
  };
  return {
    /** SEAT-HALL: a palace seat's Charter Room, as its visitor stands in it - `{ key, name, member, keeper }`, or null. */
    here(mapId) {
      const seat = seatHere(mapId);
      const g = seat?.tier === 'palace' ? (seat.holder?.guild ?? null) : null;
      if (!g?.id) return null;
      const mine = guild();
      const member = seatHallOf(seat, mine?.id ?? null);
      return {
        key: seat.key,
        name: g.name ?? '',
        member,
        keeper: member && guildMay(Number(mine?.rank), 'decorate', mine?.powers ?? null),
      };
    },
    /**
     * CROWN-HALL (7.2: "Crown: the castle is the hall"): a crown seat's castle, as its visitor stands in it - `{ key, name,
     * member, heraldry }` (the holder's guild's name; whether this character is of it; its banner), or null: no crown
     * here, none held, the seats shut to this account - or, DOMAIN2, an instance (`instance`, the room's `{ owner, epoch }`)
     * that is not the holder's own castle.
     */
    crown(mapId, instance = null) {
      const seat = seatHere(mapId);
      const g = seat?.tier === 'crown' ? (seat.holder?.guild ?? null) : null;
      if (!g?.id) return null;
      if (instance && !(castleOf(mapId)?.guild === g.id && castleOf(mapId)?.epoch === instance.epoch)) return null;
      return {
        key: seat.key,
        name: g.name ?? '',
        member: seatHallOf(seat, guild()?.id ?? null),
        heraldry: seatBannerOf(seat),
      };
    },
    /** DOMAIN2: my guild's own castle at the dungeon `mapId` - `{ guild, key, epoch, region }` - for the instance door. */
    castleAt: castleOf,
  };
}
