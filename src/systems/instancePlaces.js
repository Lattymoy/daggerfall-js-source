// @ts-check
// INSTANCES (2026-10-15, Mac: "For quests and other uses, including future work, lets implement an instanced system ...
// The player approaches, should be met with an enhanced UI popup that lets them select public or instanced (if
// applicable)"; asked where: "Dungeons with your quest", "Privateer's Hold", "Building interiors"; who: "You and your
// party"; bible/11-Multiplayer/Instances.md): THE DOOR'S LAW - pure, no page. Which quests point at a place, what its
// door offers, and where a quest's things stand online - and (HEIR-WHOLE) which of the line's remains lie in it whole.
//
// The room is net/instanceRoom.js's; the popup and the digests are scenes/instanceDoor.js's; the hosts only ask.
import { SITE_TYPES } from './quest/place.js';
import { isShelved } from './quest/quest.js';
import { instanceOf, isInstanceEpoch, INSTANCE_EPOCH_HEX } from '../net/instanceRoom.js';
import { digest } from '../net/privateInterior.js';

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

/**
 * HEIR-WHOLE (FIELD BUGS 2026-10-19f): THE LINE'S REMAINS THAT LIE IN THIS DUNGEON WHOLE, where the world builds its
 * public room smaller (AUDIT FB1019f B1: `relaid` is the size built - a dungeon the world draws smaller but whose blocks
 * are at or under that size's threshold is built whole in public, and its public room stands them). A death records the
 * size its dungeon was BUILT at (world.js legacyHere's `dungeon.size`), and the remains stand only in a build of that size
 * (legacyInDungeonOf: another size is another layout). A death in an instance - or in a quest's dungeon entered whole -
 * lies in the dungeon whole, which the public room of a re-laid dungeon never is, and
 * another player's instance admits only its owner's party: so the death quest's place is "a dungeon with your quest", and
 * its door offers the heir an instance of their own - the dungeon whole, which stands them where they fell. `rows` are the
 * line's lying remains (scenes/legacyHost.js remainsWhere: `{ line, id, place }`; a place has a `dungeon` underground
 * alone); the site a dungeon's (scenes/instanceDoor.js dungeonSite - `relaid` is a dungeon site's alone), by its map id:
 * the place's `mapId` is the location the fallen stood on, both read unsigned. Remains laid in the public room's own
 * size, or in a row from before the size was kept (any build stands them), are the public room's, as they always were:
 * none here. Not a DFU member (DFU has one player and no rooms; Ledger A, INSTANCES).
 */
export function remainsWholeAt(rows, site) {
  if (site?.relaid !== true) return [];
  return (rows ?? []).filter((r) => r?.place?.dungeon?.size === 'full' && r.place.mapId === site.mapId);
}

/** HEIR-WHOLE: THE EPOCH OF THE ROOM A LINE'S REMAINS OPEN - eight hex of SHA-256 over the line's id and the row's (one
 *  row a death: `r<person>`), the Privateer's Hold's shape (net/instanceRoom.js holdEpochOf): no save to keep it in, the
 *  same on every device the line is played on, and no other remains' ever. Null for a row with no line or id. */
export async function remainsInstanceEpoch(row) {
  return row?.line && row.id ? digest(`instance:epoch:${row.line}:${row.id}:remains`, INSTANCE_EPOCH_HEX / 2) : null;
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
 * WIPE-RETURN (a field report, 2026-10-25: "Upon Death in an instance, party members and host will desync even if
 * everyone dies and goes back in"): `stood` - the instance room the relay last joined ME to (net/instanceRoom.js
 * instanceOf's `{ base, owner, epoch }`, scenes/instanceDoor.js poseWord) - is one more room, after every room a member
 * stands in, under the same law. A party that falls together respawns at the door (world.js respawnOnlinePlayer) with
 * no pose naming its room, and its members walked into rooms apart.
 * @param {any[]|null|undefined} members
 * @param {string|null|undefined} base
 * @param {(acct: string) => string|null} [ownerOf]
 * @param {{ base: string, owner: string, epoch: string }|null} [stood]
 */
export function partnerInstances(members, base, ownerOf = () => null, stood = null) {
  const out = [];
  if (typeof base !== 'string' || !base) return out;
  const list = members ?? [];
  const rooms = [...list.map((m) => (m?.p && m.online !== false ? instanceOf(m.p.ins) : null)), stood];
  for (const r of rooms) {
    if (!r || r.base !== base || out.some((o) => o.owner === r.owner && o.epoch === r.epoch)) continue;
    const owner = list.find((o) => typeof o?.acct === 'string' && ownerOf(o.acct) === r.owner);
    if (owner) out.push({ acct: owner.acct, name: typeof owner.name === 'string' ? owner.name : '', owner: r.owner, epoch: r.epoch });
  }
  return out;
}

/**
 * WHAT THE DOOR OFFERS - null for no popup (the door opens on the public room, as it always did), else the rows, in
 * this order:
 *   { kind: 'public' }                              the place's shared room - never Privateer's Hold online (HOLD-ONCE)
 *   { kind: 'join', name, acct, owner, epoch }      a party member's instance standing here now, or the one I last stood
 *                                                   in here (partnerInstances' `stood`, WIPE-RETURN)
 *   { kind: 'mine' }                                my instance - a quest of mine names the place, or the Hold
 * Offline, or at a relay that keeps no instance, there is nothing to choose. A place with no instance to offer has no
 * popup; the Hold with none still answers (its public room refused, the door says so).
 */
export function instanceOffer({ online, instanceOk, isHold = false, questHere = false, partners = [] }) {
  if (!online || !instanceOk) return null;
  const rows = [];
  if (!isHold) rows.push({ kind: 'public' });
  // The party's rooms come before mine: a member who holds a copy of the quest has an instance of their own, which is
  // another room, and taking the first instance row by habit after a death split them from the party.
  for (const p of partners ?? []) rows.push({ kind: 'join', name: p.name, acct: p.acct, owner: p.owner, epoch: p.epoch });
  if (questHere || isHold) rows.push({ kind: 'mine' });
  return rows.length > (isHold ? 0 : 1) ? rows : null;
}
