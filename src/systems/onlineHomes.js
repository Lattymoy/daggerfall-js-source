// @ts-check
// ═══════════════════════════════════════════════════════════════════
// HOME1 (2026-09-25) — THE ONLINE HOMES, AS THIS CLIENT KNOWS THEM.
//
// Mac: "allowing online players to purchase housing in any location";
// asked: "Housing is exclusive"; a home is bought "At its front door"
// ("Click any unowned house's door and buy it there. Works in every
// town, including hamlets with no bank."); a house bought offline
// "Stay[s] offline only"; who walks in, "Owner chooses".
//
// The account service keeps the one registry (server-account/src/
// homes.js, its shapes net/homeLaw.js). This is the client's reading of
// it - one town at a time, asked when that town's doors are and believed
// for HOME_TOWN_TTL_MS - and the door's laws over what it holds, pure,
// so the press, the swing, the hover and the building all read ONE
// answer (worldModes.js is the host).
//
// ═══ WHERE THE SERVER'S LIST DECIDES ═══════════════════════════════
//
// Online, a building the list names is that player's home: to its
// owner their own (storage, a bed, a door open at any hour), to every
// other player a house that opens as its owner says. A building the
// list does NOT name stands under Daggerfall's own law - and that
// includes this character's own OFFLINE house. "Stay offline only" is a
// house the server never hears of, not one taken away: it keeps its
// storage and its bed for me, and anyone may still buy the building
// online, which then decides it (and my offline house is still mine
// offline - "Nobody ever loses a house to a conflict").
//
// ═══ AN ONLINE HOME KEEPS ITS OWN SCENE ════════════════════════════
//
// What I keep in my online home is saved under its OWN scene name
// (homeSceneName), never the building's. Offline the same building is a
// stranger's, and a stranger's cupboard restocks the moment it is
// opened: under one name, the first offline visit would have thrown my
// things away. The owner's offline house, the other way round, is
// never read as an online home's storage.
// ═══════════════════════════════════════════════════════════════════

import {
  HOME_ENTRIES, HOME_ENTRY_DEFAULT, homeMapIdOk, homeBuildingKeyOk, homePriceOk, homeMayEnter,
} from '../net/homeLaw.js';
import { BUILDING_TYPES, isResidence } from '../world/buildingNames.js';
import { DEED_SELL_MULT } from './banking.js';

/** How long a town's answer is believed before a door asks again. */
export const HOME_TOWN_TTL_MS = 60_000;
/** After an unanswered ask, how long before the next - a service that is down is not asked at every door. */
export const HOME_RETRY_MS = 10_000;
/** How long a door waits for a town's first answer before it goes on under Daggerfall's own law. */
export const HOME_ASK_WAIT_MS = 2_500;

/** What each entry reads as, to the owner. */
export const HOME_ENTRY_WORDS = Object.freeze({ private: 'Only me', party: 'My party', public: 'Anyone' });

/**
 * WHETHER A BUILDING CAN BE A HOME AT ALL: Daggerfall's own for-sale houses and its ordinary residences (House1-4,
 * the rows GetHousesForSale tops its list up from) - never a House2 that belongs to a faction, which Daggerfall's
 * lock law keeps for that guild's members alone (buildingLocks.js; the Thieves Guild's and the Dark Brotherhood's).
 */
export function homeCandidate(bd) {
  const t = bd?.buildingType;
  if (!homeBuildingKeyOk(bd?.buildingKey)) return false;
  if (t === BUILDING_TYPES.House2 && (bd.factionId ?? 0) !== 0) return false;
  return t === BUILDING_TYPES.HouseForSale || isResidence(t);
}

/** ...and whether one can be BOUGHT: a candidate no active quest is using (GetHousesForSale's own exclusion). */
export const homePurchasable = (bd, { isActiveQuestBuilding = null } = {}) =>
  homeCandidate(bd) && !(isActiveQuestBuilding?.(bd) ?? false);

/** The scene an online home's things are kept under - its own, never the building's (the header). */
export const homeSceneName = (mapId, buildingKey) => `OnlineHome [MapID=${Number(mapId) >>> 0}, BuildingKey=${buildingKey}]`;

/** What a home sells back for: Daggerfall's deed share (DEED_SELL_MULT) of what was paid. */
export const homeRefund = (price) => Math.trunc((Number.isSafeInteger(price) && price > 0 ? price : 0) * DEED_SELL_MULT);

/**
 * WHAT A HOME'S DOOR DOES FOR THIS PLAYER, the one answer every door reads. `home` is `homeAt`'s view or null.
 *   'none'   - no player's home (or its town is not known yet): Daggerfall's own law stands
 *   'own'    - this character's own: open at any hour
 *   'enter'  - someone's home this player may walk into - its owner's other characters, anyone when it is public,
 *              the owner's party when it is theirs, and a player whose active quest is set in it (Daggerfall's own
 *              rung: "Buildings part of an active quest are always unlocked" - a quest must not strand its player)
 *   'locked' - someone's home this player may not
 */
export function homeDoorAnswer(home, { partyNames = [], questSite = false } = {}) {
  if (!home) return 'none';
  if (home.own) return 'own';
  if (homeMayEnter(home, { partyNames }) || questSite) return 'enter';
  return 'locked';
}

/** The door's name for a home, over the building's own. */
export const homeDoorTitle = (home) => (home.own ? 'Your home' : `${home.owner}'s home`);
/** What a player reads at a home's door they may not open. */
export const homeLockedLine = (home) => `This is ${home.owner}'s home. The door is locked.`;
/** What a visitor reads at a home's cupboard. */
export const homeBelongsLine = (home) => `This belongs to ${home.owner}.`;
/** The hover's line under a house anyone may buy. */
export const homeForSaleLine = (price) => `Can be your home: ${price} gold`;
/** The offer at the door. */
export const homeOfferLines = (price) => ['This house can be your home.', `It costs ${price} gold, from your purse and this region's bank account.`, 'Buy it?'];
export const HOME_BOUGHT_LINE = 'This house is your home now. Only you can enter it until you say otherwise.';
export const homeShortLine = (price) => `You need ${price} gold, in your purse and this region's bank account together.`;
/** The owner's menu at their own door. */
export const homeOwnerLines = (home) => ['This is your home.', homeEntryLine(home.entry)];
export const homeEntryLine = (entry) => `Who may enter: ${HOME_ENTRY_WORDS[entry] ?? HOME_ENTRY_WORDS[HOME_ENTRY_DEFAULT]}.`;
export const homeSaleLines = (refund) => [`Sell your home for ${refund} gold?`, "The gold goes to this region's bank account. Anything left inside is lost."];
export const homeSoldLine = (refund) => `You sold your home. ${refund} gold went to this region's bank account.`;
/** The bank's answer to Buy House online (Mac chose the door, not the bank - its list is the offline house). */
export const HOME_BANK_LINES = Object.freeze(['Online, a home is bought', 'at its own front door.']);

/**
 * THE CLIENT'S REGISTRY over `api` (net/accountClient.js accountHomes: every answer `{ ok, data }` or
 * `{ ok: false, error }`, never a throw). `character()` is the character playing - a home is ONE character's
 * (`own`), though its account may always walk in (`mine`). Answers `{ ensure, waitFor, known, homeAt, claim,
 * release, setEntry, version }`; `version` moves on every change a door would show.
 * @param {{ api: any, character?: () => (string|null), now?: () => number, ttlMs?: number }} opts
 */
export function createOnlineHomes({ api, character = () => null, now = () => Date.now(), ttlMs = HOME_TOWN_TTL_MS }) {
  /** @type {Map<number, {at: number, homes: Map<number, any>}>} */
  const towns = new Map();
  /** @type {Map<number, Promise<boolean>>} */
  const asking = new Map();
  /** @type {Map<number, number>} */
  const failed = new Map();
  let version = 0;
  const idOf = (mapId) => (Number.isFinite(Number(mapId)) ? Number(mapId) >>> 0 : 0);

  /** Ask for a town unless its answer is fresh - one ask in flight a town. Resolves whether the town is known. */
  function ensure(mapId, { force = false } = {}) {
    const id = idOf(mapId);
    if (!homeMapIdOk(id)) return Promise.resolve(false);
    const had = towns.get(id);
    if (!force && had && now() - had.at < ttlMs) return Promise.resolve(true);
    const flying = asking.get(id);
    if (flying) return flying;
    if (!force && now() - (failed.get(id) ?? -Infinity) < HOME_RETRY_MS) return Promise.resolve(!!had);
    const p = Promise.resolve()
      .then(() => api.town(id))
      .then((r) => {
        const list = r?.ok ? r.data?.homes : null;
        // unanswered: what was known stands, nothing new is believed, and the next ask waits a little
        if (!Array.isArray(list)) { failed.set(id, now()); return towns.has(id); }
        const homes = new Map();
        for (const h of list) {
          if (!homeBuildingKeyOk(h?.buildingKey) || typeof h.owner !== 'string') continue;
          homes.set(h.buildingKey, {
            buildingKey: h.buildingKey, owner: h.owner,
            entry: HOME_ENTRIES.includes(h.entry) ? h.entry : HOME_ENTRY_DEFAULT,
            mine: h.mine === true, character: typeof h.character === 'string' ? h.character : null,
          });
        }
        towns.set(id, { at: now(), homes });
        failed.delete(id);
        version++;
        return true;
      }, () => { failed.set(id, now()); return towns.has(id); })
      .finally(() => { asking.delete(id); });
    asking.set(id, p);
    return p;
  }

  /** `ensure`, but a door does not wait on it longer than `ms`: resolves whether the town is known by then. */
  function waitFor(mapId, ms = HOME_ASK_WAIT_MS) {
    const id = idOf(mapId);
    /** @type {any} */
    let timer = null;
    const late = new Promise((res) => { timer = setTimeout(() => res(towns.has(id)), ms); });
    return Promise.race([ensure(id), late]).finally(() => clearTimeout(timer));
  }

  const known = (mapId) => towns.has(idOf(mapId));

  /** The home a building is, as this client last heard - `own` read against the character playing NOW - or null. */
  function homeAt(mapId, buildingKey) {
    const row = towns.get(idOf(mapId))?.homes.get(buildingKey) ?? null;
    if (!row) return null;
    const me = character();
    return Object.freeze({ ...row, own: row.mine && typeof me === 'string' && row.character === me });
  }

  /** A change I made, shown now and read back from the service after (the owner's name, the others' doors). */
  function wrote(id, buildingKey, row) {
    const t = towns.get(id);
    if (t) {
      if (row) t.homes.set(buildingKey, row);
      else t.homes.delete(buildingKey);
      version++;
    }
    ensure(id, { force: true });
  }

  async function claim({ mapId, buildingKey, region, price }) {
    const id = idOf(mapId);
    const me = character();
    const r = await api.claim({ mapId: id, buildingKey, region, character: me, price });
    if (r?.ok) {
      const had = towns.get(id)?.homes.get(buildingKey);
      wrote(id, buildingKey, { buildingKey, owner: had?.owner ?? '', entry: r.data?.home?.entry ?? HOME_ENTRY_DEFAULT, mine: true, character: me });
      return { ok: true, repeat: r.data?.repeat === true };
    }
    if (r?.error === 'home-taken') ensure(id, { force: true });   // somebody's now: the door should say whose
    return { ok: false, error: r?.error ?? 'server' };
  }

  async function release(mapId, buildingKey) {
    const id = idOf(mapId);
    const r = await api.release(id, buildingKey);
    if (r?.ok) {
      wrote(id, buildingKey, null);
      return { ok: true, price: Number.isSafeInteger(r.data?.price) ? r.data.price : 0 };
    }
    if (r?.error === 'no-home') ensure(id, { force: true });
    return { ok: false, error: r?.error ?? 'server' };
  }

  async function setEntry(mapId, buildingKey, entry) {
    const id = idOf(mapId);
    const r = await api.entry(id, buildingKey, entry);
    if (r?.ok) {
      const row = towns.get(id)?.homes.get(buildingKey);
      wrote(id, buildingKey, row ? { ...row, entry } : null);
      return { ok: true, entry };
    }
    if (r?.error === 'no-home') ensure(id, { force: true });
    return { ok: false, error: r?.error ?? 'server' };
  }

  return { ensure, waitFor, known, homeAt, claim, release, setEntry, version: () => version };
}

/**
 * BUY ONE AT ITS DOOR. The claim first - the service's one answer decides whether the building can be mine at all -
 * and the gold only once it is. `afford(price)` asks the purse and the region's bank account together, before the
 * claim and again after it (the purse can change while the answer is out); a claim the player can no longer pay for
 * is given back rather than kept unpaid. `pay(price)` takes it, purse first, as Daggerfall's own purchase does.
 * Answers `{ ok: true }` or `{ ok: false, error }` - `gold` for the purse, else the service's word.
 */
export async function buyOnlineHome(homes, { mapId, buildingKey, region, price, afford, pay }) {
  if (!homePriceOk(price)) return { ok: false, error: 'bad-home' };
  if (!afford(price)) return { ok: false, error: 'gold' };
  const r = await homes.claim({ mapId, buildingKey, region, price });
  if (!r.ok) return r;
  if (!afford(price)) {
    await homes.release(mapId, buildingKey);
    return { ok: false, error: 'gold' };
  }
  pay(price);
  return { ok: true };
}

/**
 * SELL ONE BACK: given up first, and credited only once the service agrees it is gone - Daggerfall's share
 * (homeRefund) of what the service says was paid, never of a price this client names. `credit(n)` pays it in.
 */
export async function sellOnlineHome(homes, { mapId, buildingKey, credit }) {
  const r = await homes.release(mapId, buildingKey);
  if (!r.ok) return r;
  const refund = homeRefund(r.price);
  credit(refund);
  return { ok: true, refund };
}
