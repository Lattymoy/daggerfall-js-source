// @ts-check
// CHAP1 (2026-10-07, bible/11-Multiplayer/Chapters-Arc.md law 4): THE GUILD FACTIONS, A LEAF - Daggerfall's own guilds
// by their faction ids: the four that are one guild each, the eight divines' temples and the ten knightly orders.
//
// A LEAF: no imports, so the account service's graph reaches it and nothing past it (the precedent is AUDIT
// ARENA-LADDER's ai/blowShapes.js). The Roll (net/npcChapterLaw.js) keeps a realm character's standing with exactly
// these twenty-two on the service, and the service cannot import guilds.js or guildVariants.js, whose graphs reach
// the skills and the client's prefs. ONE DFU MEMBER, ONE EXPORT: each table lives here alone - guilds.js builds GUILDS
// on GUILD_FACTION_IDS, and guildVariants.js hands DIVINES and ORDERS on from here. Every value is a constant of DFU's
// MIT code, never a row of FACTION.TXT. And the reputation's bounds, which factionRep.js hands on from here for the
// same reason (its graph reaches the save).

/** PersistentFactionData's reputation bounds - Mathf.Clamp (:32-35); factionRep.js hands them on. */
export const MIN_REPUTATION = -100;
export const MAX_REPUTATION = 100;

/** The four guilds that are one guild each - their factionId (FightersGuild.cs, MagesGuild.cs, ThievesGuild.cs,
 *  DarkBrotherhood.cs; guilds.js GUILDS reads them). */
export const GUILD_FACTION_IDS = Object.freeze({
  FightersGuild: 41, MagesGuild: 40, ThievesGuild: 42, DarkBrotherhood: 108,
});

/** Temple.Divines (:49-59) - value = factionId. */
export const DIVINES = Object.freeze({
  Akatosh: 26, Arkay: 21, Dibella: 29, Julianos: 27,
  Kynareth: 35, Mara: 24, Stendarr: 33, Zenithar: 22,
});

/** KnightlyOrder.Orders (:49-61) - value = factionId. */
export const ORDERS = Object.freeze({
  Horn: 411, Dragon: 368, Flame: 410, Hawk: 417, Owl: 413,
  Rose: 409, Wheel: 415, Candle: 408, Raven: 414, Scarab: 416,
});
