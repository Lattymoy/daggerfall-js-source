// @ts-check
// EG-E3 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 5, "The dungeon's
// find"): A DUNGEON ELITE'S WEIR KEY, ASKED BY ITS KILLER. No relay witnesses an ordinary dungeon, so when an elite foe
// (`eliteFoe`, systems/eliteFoes.js promoteEliteFoe) dies in a dungeon online, the client whose blow it was asks the
// account service (`/v1/eg/find`, net/accountClient.js accountEg's `find`) with the dungeon's tier (systems/dungeon/dungeonTier.js
// - 'regular', 'elite', or 'super', the player's Abyss Dungeon), and the service rolls with its own die, capped a tier a
// real day and a week (server-account/src/eg.js findEg). A forged ask is bounded there, never believed here.
//
// WHO ASKS (section 5, step 1): the foe's OWNER kills it - a joiner's blow is applied by the owner, so the death and its
// handlers (scenes/corpseMarker.js raiseEnemyDeath, the seam CARDS9's card uses - systems/card/cardSources.js dropFoeCard) run
// there, and the owner names the striking joiner on the foes stream (`_killedBy`, the record's `v`, for KILLED_BY_MS -
// scenes/dungeonContext.js). So:
//   - on the owner, the death handler asks when its own blow killed (`by` null - the record's `v` null - or its own id),
//     and leaves a joiner's kill to the joiner;
//   - on the joiner, the record naming it (`struck`, at the door that says its own kill) asks.
// One ask a body, whichever door hears it twice.
//
// A YES: the key is the account's balance (section 5 - every answer restacks the pack to it), and the find throws its
// face from the body as a card is thrown (dropFoeCard: onto the body's items) - the host's `throwKey(entity, keys)`;
// `egFindThrow` is the throw itself: one key onto the body, the pack restacked to the balance less that one, so the
// body's key taken up makes the pack the balance.
//
// A ROOM'S BODY (PARTY-LOOT, the merge of main into PR #800): online, a dungeon body is the room's base - every client in
// the room rolls it, death's subscribers and all, on the room's dice (scenes/roomLootHost.js roomBodyBase, its raise
// marked `room`), and shows that list, not the copy's own items. So the find never answers the room's raise (it is no
// kill, and every client makes it); the kill asks it at the host (`egFindKill`, the striker the foes stream names) and the
// joiner's door as before, and a key found on a room's body goes to the pack whole (`throwKey(null, keys)`) - a key on
// the copy's items is a key nobody sees, and on the base it would be the room's.
//
// PURE OF THE HOSTS: `registerEgFind` takes its doors as arguments, so it runs without world.js. Not a DFU member: DFU has
// no Weir Key and no online. Ledger A (ELITE-GATES).
import { registerEnemyDeathHandler } from '../../scenes/corpseMarker.js';
import { restackWeirKeys, throwWeirKeyFace, setWeirKeyFacesHere } from './weirKey.js'; // RPT1026-CLIENT: the face thrown is kept as lying
import { DUNGEON_TIERS, dungeonTier } from '../dungeon/dungeonTier.js';

/** The death handler's name (corpseMarker.js registerEnemyDeathHandler). */
export const EG_FIND_HANDLER = 'eg-find';
/** What a find says. */
export const EG_FIND_TEXT = Object.freeze({ found: 'A Weir Key falls from the body.' });

/** Whether a death is a find's to ask: an elite foe, in a dungeon of a tier, online. */
export const egFindAsks = (/** @type {any} */ entity, /** @type {any} */ tier, /** @type {any} */ online) =>
  online === true && entity?.eliteFoe === true && DUNGEON_TIERS.includes(tier);

/**
 * THE THROW: one Weir Key onto the body's items (as dropFoeCard puts a card there) and the pack restacked to the balance
 * `keys` less every face still lying on a body, this one among them (systems/eliteGates/weirKey.js restackWeirKeys -
 * RPT1026-CLIENT: less this one alone, a second find before the first body was looted showed a key too many).
 * @param {any} entity the fallen foe @param {any[]} pack the player's items @param {number} keys the account's balance
 */
export function egFindThrow(entity, pack, keys) {
  if (Array.isArray(entity?.items)) throwWeirKeyFace(entity.items); // PARTY-LOOT: no body (a room's) - the pack holds the whole balance
  restackWeirKeys(pack, keys);
}

/** AUDIT RPT1026 K1: WHERE THE FIND STANDS - the world host's door (scenes/world.js registerEgFind's `placeNow`): in a
 *  dungeon, its tier and the VISIT, the dungeon's context the world's modes build new at every entry (worldModes.js
 *  `dungeonCtx`), which the faces thrown in it are kept against (weirKey.js setWeirKeyFacesHere); null anywhere else.
 *  @param {string|undefined|null} mode the world's mode @param {any} modes the world's modes */
export const egFindPlace = (mode, modes) =>
  mode === 'dungeon' && modes?.dungeonLocation
    ? { tier: dungeonTier(modes.dungeonLocation), visit: modes.dungeonCtx ?? modes.dungeonLocation }
    : null;

/** The registered find (registerEgFind's), for the joiner's door the dungeon host reads (egFindStruck). */
let _registered = null;
/** THE JOINER'S DOOR (scenes/dungeonContext.js, where the owner's record names me the striker): ask for this body's find -
 *  `room` a room's body (PARTY-LOOT), whose key goes to the pack. */
export const egFindStruck = (/** @type {any} */ entity, room = false) =>
  _registered?.struck(entity, room) ?? Promise.resolve(false);
/** PARTY-LOOT: THE KILL OF A ROOM'S BODY (scenes/dungeonContext.js, where a room's body raises no death of its own): the
 *  owner's half for it (`by` the striker the host names), its key to the pack. */
export const egFindKill = (/** @type {any} */ entity, /** @type {string|null} */ by = null) =>
  _registered?.death(entity, by, true) ?? Promise.resolve(false);
/**
 * THE FIND, REGISTERED: a death handler for the owner's kills (`opts.by` the striker the host names - its `_killedBy`) and
 * the joiner's door (`struck`). `ask(tier)` is the service's call (accountEg's `find` - `{ ok, data: { found, keys,
 * asks } }`); `placeNow()` where the player stands (egFindPlace: the dungeon's tier and its visit, null outside one) - or
 * `tierNow()`, the tier alone, every stay one visit; `selfId()` this client's peer id; `online()`; `say(line)`;
 * `throwKey(entity, keys)` on a yes. Answers `{ death, struck, dispose }` - `death(entity, by)` the owner's half (the
 * handler's), `struck(entity)` the joiner's, each a promise of whether a key was found.
 * @param {{ ask: (tier: string) => Promise<any>, placeNow?: () => ({ tier: string|null, visit: unknown }|null), tierNow?: () => string|null, selfId: () => string|null, online: () => boolean, say?: (line: string) => void, throwKey: (entity: any, keys: number) => void }} doors
 */
export function registerEgFind({
  ask,
  placeNow = undefined,
  tierNow = undefined,
  selfId,
  online,
  say = () => {},
  throwKey,
}) {
  const asked = new WeakSet();
  /** AUDIT RPT1026 K1: where the player stands - the place door's answer, or the tier door's as one long visit */
  const where = () => {
    if (placeNow) return placeNow();
    const tier = tierNow?.() ?? null;
    return tier == null ? null : { tier, visit: true };
  };
  // RPT1026-CLIENT: the faces thrown lie on this dungeon's bodies - out of it, they are folded off them (weirKey.js weirKeysLying);
  // AUDIT RPT1026 K1: and out of this VISIT - the next dungeon, or this one built again, holds none of its bodies
  const here = () => where()?.visit ?? null;
  setWeirKeyFacesHere(here);
  /** @param {any} entity @param {boolean} [room] a room's body - its key to the pack (PARTY-LOOT) */
  async function find(entity, room = false) {
    const at = where(),
      tier = at?.tier ?? null;
    if (!egFindAsks(entity, tier, online()) || asked.has(entity)) return false;
    asked.add(entity);
    let a = null;
    try {
      a = await ask(/** @type {string} */ (tier));
    } catch {
      return false;
    }
    const d = a?.ok ? a.data : null;
    if (d?.found !== true || !Number.isSafeInteger(d.keys)) return false;
    // AUDIT RPT1026 K1: an answer that lands in another visit finds the body gone with the one it was asked in - its key
    // to the pack (no face on a body nobody can reach, counted as lying in the visit it landed in)
    throwKey(room || here() !== at?.visit ? null : entity, d.keys);
    say(EG_FIND_TEXT.found);
    return true;
  }
  /** @param {any} entity @param {string|null} [by] @param {boolean} [room] */
  const death = (entity, by = null, room = false) =>
    by == null || by === selfId() ? find(entity, room) : Promise.resolve(false);
  registerEnemyDeathHandler(EG_FIND_HANDLER, (/** @type {any} */ entity, /** @type {any} */ opts = {}) => {
    if (opts.room) return;
    death(entity, opts.by ?? null).catch((e) => console.warn('[eg] find failed', e?.message ?? e));
  }); // PARTY-LOOT: the room's base is no kill
  const reg = {
    death,
    struck: (/** @type {any} */ entity, room = false) => find(entity, room),
    dispose: () => {
      registerEnemyDeathHandler(EG_FIND_HANDLER, null);
      if (_registered === reg) {
        _registered = null;
        setWeirKeyFacesHere(null);
      }
    },
  };
  _registered = reg;
  return reg;
}
