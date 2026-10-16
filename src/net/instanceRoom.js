// @ts-check
// INSTANCES (2026-10-15, Mac: "Instead of one room for houses, dungeons, etc - for quests and other uses, including
// future work, lets implement an instanced system ... The player approaches, should be met with an enhanced UI popup that
// lets them select public or instanced (if applicable)"; bible/11-Multiplayer/Instances.md): AN INSTANCE IS A WORLD ROOM
// OF ITS OWN. The public room of a dungeon or a building (net/online.js roomKeyFor - `dungeon:m<mapId>`,
// `interior:m<mapId>.<key>`) with an owner and an epoch after it:
//
//   <public room>.i<owner>.<epoch>        dungeon:m187853213.i0f1e2d3c4b5a6978.89abcdef
//
// - `owner`, 16 hex: the account's digest (instanceOwnerOf). The relay checks it against the subject its token verified,
//   never a hello field (instanceAdmits).
// - `epoch`, 8 hex: what opened the room - a quest's own, minted at random the first time its instance opens and kept
//   in the quest's save (systems/instancePlaces.js questInstanceEpoch), or Privateer's Hold's, the character's digest
//   (holdEpochOf). Mac, of what an instance remembers: "Kept per owner, 30-min respawn" and "Kept until quest ends" - a
//   quest that ends takes its epoch with it, so no later quest keys its room (a uid would: quest.js nextUid restarts past
//   the uids a save still holds), and the room's memory is forgotten INSTANCE_TTL_MS (net/wire.js) after it last drained.
//
// A DUNGEON'S INSTANCE IS THE DUNGEON WHOLE - Daggerfall's own layout, never the world's small or medium size (no `.m` /
// `.s`; smallerDungeons.js dungeonSizeFor's `whole`): every page in it builds one layout, whose foes, doors and piles
// the room's streams and memory address by index, and the layout a quest's markers are chosen on (QUEST-CAPS's caps and
// a re-laid start block that walks into one - Hold of Coppering's medium build - are the public world's alone).
//
// It is a WORLD room (net/wire.js WORLD_ROOM admits it): the host's simulation, its acts, its loot, its memory and
// RESPAWN-30's half-hour, exactly as a public room's. Who comes in is the relay's to say: its owner, staff, or a member
// of the owner's party, which the hub answers (partyHoldsOwner). Mac: "You and your party".
import { digest } from './privateInterior.js';

/** The owner's digest, in hex characters (eight bytes). */
export const INSTANCE_OWNER_HEX = 16;
/** The epoch's digest, in hex characters (four bytes). */
export const INSTANCE_EPOCH_HEX = 8;
/** The instance tag's spelling, ONE home: net/wire.js composes WORLD_ROOM from it. */
export const INSTANCE_TAG_SOURCE = '\\.i[0-9a-f]{16}\\.[0-9a-f]{8}';
/** The relay that admits an instance (net/wire.js RELAY_VERSION world208 - world206 then world207 on its branch, renumbered past SERPENT5's and ONE-BODY's at the merges): an older one keeps no memory for the key, gates
 *  nobody out of it, and drops the party pose's `ins` - so no page offers an instance until its relay says this. */
export const INSTANCE_RELAY_MIN = 208;
/** Does the relay whose welcome said `v` admit instances? */
export const relaySupportsInstances = (v) => { const m = /^world(\d+)$/.exec(typeof v === 'string' ? v : ''); return !!m && Number(m[1]) >= INSTANCE_RELAY_MIN; };

/** The hub's internal door a place room asks whether an account's party holds an instance's owner (partyHoldsOwner). */
export const INSTANCE_INTERNAL_KIN = '/internal/instance/kin';
/** How long a place room keeps the hub's YES for one account and owner, and how often it asks again for a member it let
 *  in as the owner's party while that member stays (a kick, a lapse, the owner gone out of the party) - a no is never
 *  kept, so a party just joined is heard at once. */
export const INSTANCE_KIN_KEEP_MS = 15_000;
/** The relay's refusal of an instance's door - its error frame's word, one home for both ends (the page says it: its
 *  own instance door, scenes/instanceDoor.js refused). */
export const INSTANCE_DOOR_WORD = 'private instance';

/** The public rooms an instance may stand beside: a dungeon whole and a building - the two world rooms of a place. */
const PUBLIC_ROOM = /^(?:dungeon:m[1-9]\d{0,9}|interior:m[1-9]\d{0,9}\.[1-9]\d{0,7})$/;
const INSTANCE_ROOM = new RegExp(`^(dungeon:m[1-9]\\d{0,9}|interior:m[1-9]\\d{0,9}\\.[1-9]\\d{0,7})\\.i([0-9a-f]{${INSTANCE_OWNER_HEX}})\\.([0-9a-f]{${INSTANCE_EPOCH_HEX}})$`);
const OWNER_RE = new RegExp(`^[0-9a-f]{${INSTANCE_OWNER_HEX}}$`);
const EPOCH_RE = new RegExp(`^[0-9a-f]{${INSTANCE_EPOCH_HEX}}$`);
/** An account's or a character's id, as the private rooms read one (net/privateInterior.js). */
const identity = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{4,64}$/.test(v);

/** Is `v` an epoch's spelling - eight lower-case hex? */
export const isInstanceEpoch = (v) => typeof v === 'string' && EPOCH_RE.test(v);

/** The owner's digest of an account, or null for no account. */
export async function instanceOwnerOf(account) {
  return identity(account) ? digest(`instance:account:${account}`, INSTANCE_OWNER_HEX / 2) : null;
}
/** The epoch of a character's instance of Privateer's Hold - no quest opens it, the Hold itself does (HOLD-ONCE: online
 *  its public room is entered once), so it is the character's for good - or null for no character. */
export async function holdEpochOf(character) {
  return identity(character) ? digest(`instance:epoch:${character}:hold`, INSTANCE_EPOCH_HEX / 2) : null;
}

/** The instance `{ owner, epoch }` of the public room `publicKey` - its key, or null for a room no instance stands beside
 *  (a re-laid dungeon's `.m` / `.s`, a cell, an owned room) or a malformed owner or epoch. */
export function instanceRoomOf(publicKey, instance) {
  if (typeof publicKey !== 'string' || !PUBLIC_ROOM.test(publicKey)) return null;
  const owner = instance?.owner, epoch = instance?.epoch;
  if (typeof owner !== 'string' || !OWNER_RE.test(owner) || !isInstanceEpoch(epoch)) return null;
  return `${publicKey}.i${owner}.${epoch}`;
}
/** An instance room's parts - `{ base, owner, epoch }`, `base` its public room - or null for any other key. */
export function instanceOf(key) {
  const m = typeof key === 'string' ? INSTANCE_ROOM.exec(key) : null;
  return m ? { base: m[1], owner: m[2], epoch: m[3] } : null;
}
/** Is this key an instance's room? */
export const isInstanceRoom = (key) => instanceOf(key) != null;
/** A party pose's word for the instance a member stands in (`ins`: its owner and epoch, 25 characters), or null. */
export function instanceWord(instance) {
  const owner = instance?.owner, epoch = instance?.epoch;
  return typeof owner === 'string' && OWNER_RE.test(owner) && isInstanceEpoch(epoch) ? `${owner}.${epoch}` : null;
}
/** The instance a party pose's `ins` names, `{ owner, epoch }`, or null. */
export function instanceOfWord(word) {
  const m = typeof word === 'string' ? /^([0-9a-f]{16})\.([0-9a-f]{8})$/.exec(word) : null;
  return m ? { owner: m[1], epoch: m[2] } : null;
}

/**
 * THE RELAY'S DOOR: by what right may the account `subject` (the token's verified subject - never a hello field) stand in
 * the instance room `key`? 'staff', 'owner', or 'party' - asked of `kin(subject, owner)`, the hub's word
 * (partyHoldsOwner), a member of the owner's party, whom the room asks again while it stays. Null for none, and for
 * anything but an instance's key.
 */
export async function instanceAdmission(key, subject, { staff = false, kin = null } = {}) {
  const r = instanceOf(key);
  if (!r || !identity(subject)) return null;
  if (staff) return 'staff';
  if (r.owner === await instanceOwnerOf(subject)) return 'owner';
  return typeof kin === 'function' && await kin(subject, r.owner) ? 'party' : null;
}
/** May the account `subject` stand in the instance room `key`? (instanceAdmission's yes or no.) */
export const instanceAdmits = async (key, subject, opts = {}) => (await instanceAdmission(key, subject, opts)) != null;

/** THE HUB'S ANSWER: does the party whose members are `members` (account ids) hold `subject` and another member whose
 *  digest is `owner`? */
export async function partyHoldsOwner(members, subject, owner) {
  if (!Array.isArray(members) || !members.includes(subject) || typeof owner !== 'string' || !OWNER_RE.test(owner)) return false;
  for (const m of members) {
    if (m === subject || !identity(m)) continue;
    if (await instanceOwnerOf(m) === owner) return true;
  }
  return false;
}
