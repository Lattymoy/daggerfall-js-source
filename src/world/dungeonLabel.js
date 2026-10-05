// @ts-check
// TIER1 (2026-10-05; bible/11-Multiplayer/Super-Dungeons.md section 12): WHAT A SURFACE SAYS OF A DUNGEON ONLINE - its
// tier (systems/dungeonTier.js, the leaf) and its size.
//
// THE SIZE (SD-ONLINE, Mac: "Large, medium and small should all play into account online"): online every dungeon has
// the world's own size (world/smallerDungeons.js onlineDungeonSize), and a player choosing which mouth to walk into
// wants to know it. The word is the BUILT dungeon's, by its block count - DFU's small plus is five blocks, the medium
// size eight - so a dungeon no bigger than five reads Small whatever the world drew for it, and a main-story keep
// (never re-laid) reads its own size. `dungeonSizeOnline` builds nothing the host would not: it asks the size law the
// host's own question (dungeonLocationFor, online) and counts what comes back.
//
// AND NOT EVERY "DUNGEON" IS ONE: the places the port MADE as dungeons - the Burning Court (world/gateArena.js), the
// arena's floor (world/arenaFloor.js) and its undercroft (world/arenaCity.js) - carry a dungeon so the dungeon host can
// stand them, and none is a Regular Dungeon to anyone walking in. They have no label.
//
// Not a DFU member. Ledger A (TIER1).
import { dungeonLocationFor, SMALLER_DUNGEON_THRESHOLD, MEDIUM_DUNGEON_THRESHOLD } from './smallerDungeons.js';
import { isArenaUndercroft } from './arenaCity.js';
import { isGateArena } from './gateArena.js';
import { isArenaFloor } from './arenaFloor.js';
import { dungeonTier, DUNGEON_TIER_TEXT, DUNGEON_SIZE_TEXT } from '../systems/dungeonTier.js';

/** Is this a place the port made, standing in the dungeon host - no dungeon to tier? */
export const madeDungeon = (loc) => isGateArena(loc) || isArenaFloor(loc) || isArenaUndercroft(loc);

/** A BUILT dungeon's size class by its block count: 'small' (five or fewer), 'medium' (eight or fewer), 'large' - or
 *  null when it carries no blocks (a summary row, not a built location). */
export function dungeonSizeClass(built) {
  const n = built?.dungeon?.blocks?.length ?? 0;
  if (!n) return null;
  if (n <= SMALLER_DUNGEON_THRESHOLD) return 'small';
  return n <= MEDIUM_DUNGEON_THRESHOLD ? 'medium' : 'large';
}

/** The size class of the dungeon the room builds online for `loc` (the host's own question to the size law), or null. */
export function dungeonSizeOnline(loc) {
  if (!loc?.hasDungeon || !loc.dungeon?.blocks?.length) return null;
  return dungeonSizeClass(dungeonLocationFor(loc, { online: true }));
}

/** The surfaces' answers, kept per location: a location object is the maps cache's own and its tier and online size
 *  are fixed for good (a draw on its map id), while a plaque or a hover label asks every frame it stands. */
const _labels = new WeakMap();
/** What the surfaces draw for a dungeon online: the tier (its key and words) and the size's word when it can be known -
 *  or null for a place with no dungeon, or one the port made. */
export function dungeonTierLabel(loc) {
  const tier = dungeonTier(loc);
  if (!tier || madeDungeon(loc)) return null;
  const kept = _labels.get(loc);
  if (kept) return kept;
  const size = dungeonSizeOnline(loc);
  const label = Object.freeze({ tier, text: DUNGEON_TIER_TEXT[tier], size: size ? DUNGEON_SIZE_TEXT[size] : null });
  _labels.set(loc, label);
  return label;
}
