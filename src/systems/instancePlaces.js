// @ts-check
// INSTANCES (2026-10-15, Mac: "For quests and other uses, including future work, lets implement an instanced system ...
// The player approaches, should be met with an enhanced UI popup that lets them select public or instanced (if
// applicable)"; asked where: "Dungeons with your quest", "Privateer's Hold", "Building interiors"; who: "You and your
// party"; bible/11-Multiplayer/Instances.md): THE DOOR'S LAW - pure, no page. Which quests point at a place, what its
// door offers, and where a quest's things stand online.
//
// The room is net/instanceRoom.js's; the popup and the digests are scenes/instanceDoor.js's; the hosts only ask.
import { SITE_TYPES } from './quest/place.js';
import { isShelved } from './quest/quest.js';
import { instanceOf, isInstanceEpoch } from '../net/instanceRoom.js';

/** A quest that still runs and stands in the world: not ended, not thrown away, not set aside (QUEST-SHELF). */
const live = (q) => !!q && !q.questComplete && !q.questTombstoned && !isShelved(q);

/**
 * The running quests one of whose Places names this site - a dungeon by its map id, a building by its map id and key
 * (`site`: { siteType: SITE_TYPES.Dungeon | SITE_TYPES.Building, mapId, buildingKey }). A Place names it before anything
 * stands there (S0000018 reveals its crypt thirty days before its mummy is placed), so the door is the quest's from the
 * Place, not from a site link. A building site moved away from its key (RESEAT-GAPS' `unseated`) names none.
 */
export function questsAtSite(machine, site) {
  const out = [];
  const id = Number.isFinite(site?.mapId) ? site.mapId >>> 0 : null;
  if (id == null || !id) return out;
  const building = site.siteType === SITE_TYPES.Building;
  const key = Number.isFinite(site?.buildingKey) ? site.buildingKey >>> 0 : 0;
  if (building && !key) return out;
  for (const q of machine?.quests?.values?.() ?? []) {
    if (!live(q)) continue;
    for (const r of q.resources?.values?.() ?? []) {
      const sd = r?.isPlace ? r.siteDetails : null;
      if (!sd || sd.siteType !== site.siteType || (Number(sd.mapId) >>> 0) !== id) continue;
      if (building && (sd.unseated || (Number(sd.buildingKey) >>> 0) !== key)) continue;
      out.push(q);
      break;
    }
  }
  return out;
}

/** The quest that opens this site's instance: the oldest running quest that names it (the lowest uid) - so two quests
 *  pointing at one dungeon share one room, and the room goes when the first of them ends. Null for none. */
export function openerQuestOf(machine, site) {
  let best = null;
  for (const q of questsAtSite(machine, site)) if (Number.isSafeInteger(q.uid) && (best == null || q.uid < best.uid)) best = q;
  return best;
}

/** Eight random hex - a quest's instance epoch, from the platform's own generator. */
const randomEpoch = () => [...globalThis.crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, '0')).join('');

/**
 * A QUEST'S INSTANCE IS ITS OWN, FOR ITS LIFE: the epoch of the room `quest` opens - minted the first time it opens one
 * and kept on the quest (`instanceEpoch`, in its save: quest.js getSaveData), so every entry of its life keys one room
 * and no other quest's ever does. Never the uid: quest.js nextUid restarts past the uids a save still holds, and an ended
 * quest leaves the machine, so a later quest is minted a finished one's uid - and would have walked into its room. A
 * party member's copy is its own quest (machine.js receiveSharedQuest mints its own; a resync keeps the copy's). Null
 * for no quest.
 */
export function questInstanceEpoch(quest, random = randomEpoch) {
  if (!quest) return null;
  if (!isInstanceEpoch(quest.instanceEpoch)) quest.instanceEpoch = random();
  return isInstanceEpoch(quest.instanceEpoch) ? quest.instanceEpoch : null;
}

/** Where a quest's things stand online: a dungeon whole (an instance, a main story's keep, a dungeon the world gives
 *  its whole size, or a quest's dungeon entered whole where no instance can be had) - never a re-laid public room, whose
 *  blocks are not the ones the quest's markers name. Offline, wherever the quest's own frozen size builds (DFU's law). */
export const questMountsHere = ({ online, builtSize }) => !online || builtSize === 'full';

/** Should a quest's dungeon be entered whole in its public room - online, where no instance can be had (an older
 *  relay) and a running quest names it: Mac's first answer ("1"), folded into the instances as their fallback. */
export const questDungeonWhole = ({ online, instanceOk, questHere }) => !!(online && !instanceOk && questHere);

/**
 * The party's instances at this place: each instance a member stands in (its party pose's `ins`, the instance's room
 * key - net/wire.js validPartyPose) whose public room is `base` (net/online.js roomKeyFor's, the place's: a dungeon
 * whole, a building in its town's layout) - matched by the room itself, never by a map pixel (Castle Daggerfall and the
 * arena share one) - and whose OWNER is in the party: the relay's own law (net/instanceRoom.js instanceAdmission), so
 * the door offers what the relay admits and nothing it would refuse. `ownerOf(acct)` is a member's owner digest
 * (instanceOwnerOf, the page's work). Answers [{ acct, name, owner, epoch }], one row a room, named by its owner (who may
 * stand elsewhere); my own rooms are not here - I am not among `members` (the door's own row is mine).
 * @param {any[]|null|undefined} members
 * @param {string|null|undefined} base
 * @param {(acct: string) => string|null} [ownerOf]
 */
export function partnerInstances(members, base, ownerOf = () => null) {
  const out = [];
  if (typeof base !== 'string' || !base) return out;
  const list = members ?? [];
  for (const m of list) {
    const r = m?.p && m.online !== false ? instanceOf(m.p.ins) : null;
    if (!r || r.base !== base || out.some((o) => o.owner === r.owner && o.epoch === r.epoch)) continue;
    const owner = list.find((o) => typeof o?.acct === 'string' && ownerOf(o.acct) === r.owner);
    if (owner) out.push({ acct: owner.acct, name: typeof owner.name === 'string' ? owner.name : '', owner: r.owner, epoch: r.epoch });
  }
  return out;
}

/**
 * WHAT THE DOOR OFFERS - null for no popup (the door opens on the public room, as it always did), else the rows:
 *   { kind: 'public' }                              the place's shared room - never Privateer's Hold online (HOLD-ONCE)
 *   { kind: 'mine' }                                my instance - a quest of mine names the place, or the Hold
 *   { kind: 'join', name, acct, owner, epoch }      a party member's instance standing here now
 * Offline, or at a relay that keeps no instance, there is nothing to choose. A place with no instance to offer has no
 * popup; the Hold with none still answers (its public room refused, the door says so).
 */
export function instanceOffer({ online, instanceOk, isHold = false, questHere = false, partners = [] }) {
  if (!online || !instanceOk) return null;
  const rows = [];
  if (!isHold) rows.push({ kind: 'public' });
  if (questHere || isHold) rows.push({ kind: 'mine' });
  for (const p of partners ?? []) rows.push({ kind: 'join', name: p.name, acct: p.acct, owner: p.owner, epoch: p.epoch });
  return rows.length > (isHold ? 0 : 1) ? rows : null;
}
