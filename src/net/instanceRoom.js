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
//
// DOMAIN2 (bible/11-Multiplayer/Domains.md section 6): A GUILD'S CASTLE IS AN INSTANCE OWNED BY A GUILD - its owner the
// guild's digest (instanceGuildOwnerOf, a hash domain of its own, so no account's digest is ever a guild's), its epoch the
// one the account service minted when the castle was bought. The relay admits a socket whose verified token names that
// guild (`guild`), and no guest: the owner chose one owner a castle.
import { digest } from './privateInterior.js';

/** The owner's digest, in hex characters (eight bytes). */
export const INSTANCE_OWNER_HEX = 16;
/** The epoch's digest, in hex characters (four bytes). */
export const INSTANCE_EPOCH_HEX = 8;
/** The instance tag's spelling, ONE home: net/wire.js composes WORLD_ROOM from it. */
export const INSTANCE_TAG_SOURCE = '\\.i[0-9a-f]{16}\\.[0-9a-f]{8}';
/** DOMAIN2: the relay that admits a guild's own instance - a castle's (instanceAdmission's `guild` arm): an older one
 *  refuses every member but staff, so no page offers a castle's instance until its relay says this. */
export const GUILD_INSTANCE_RELAY_MIN = 276; // world276 (the eighth merge of main into #1184, 2026-10-28: past main's world275, SD-PARTY, already live); world275 (the seventh merge of main into #1184, 2026-10-28: past main's world274, LADDER-CUT); world274 (the fourth merge of main into #1184, 2026-10-27: past main's world272 and world273); world272 (the third merge of main into #1184, 2026-10-27: past MASTER-THREE's world271, main's); world271 (the second merge of main into #1184, 2026-10-27: past CHAT-POST's world270, main's); world270 (the merge of main into TESA, 2026-10-27: #1184's world269 folded into its world270 past BOW-TOPS's world269, main's): the merged release's (world256 on TESA's, renumbered past main's world256 to world259 at the merge, then world260 past main's world260 to world268 at the next)
/** Does the relay whose welcome said `v` admit a guild's instance? */
export const relaySupportsGuildInstances = (v) => {
  const m = /^world(\d+)$/.exec(typeof v === 'string' ? v : '');
  return !!m && Number(m[1]) >= GUILD_INSTANCE_RELAY_MIN;
};
/** DOMAIN2 (AUDIT DOMAINS R2): THE ROOMS A GUILD MAY OWN - the castles', each a crown city's own dungeon whole (its key the
 *  crown seat's, the city's own location: Sentinel's, Wayrest's and Daggerfall's - world/dungeon/dungeonTextures.js
 *  MAIN_STORY_DUNGEON_IDS, measured on the freeware's MAPS.BSA). The `guild` arm admits these alone: it admitted any room
 *  a guild's digest owned, so a modified client opened its whole guild a private copy of any dungeon or building. */
export const BAY_CASTLE_MAP_IDS = Object.freeze([6634853, 630439035, 1291010263]);
/** WW7-4 (bible/04-World/World-Wide.md WW7-4): AND EACH PROVINCE'S CAPITAL'S CASTLE but Cyrodiil's (Domains.md section 6: the
 *  Imperial City never - the White-Gold Tower's halls stand open to all) - its centre's map id, the crown seat's key
 *  (world/tamrielCapitals.js capitalPlaceId(k, 0): its lane 0x341, 0x80000, its ordinal k; Solitude 1 .. Helstrom 6). */
export const PROVINCE_CASTLE_MAP_IDS = Object.freeze(
  [1, 2, 3, 4, 5, 6].map((k) => ((0x341 << 20) | 0x80000 | k) >>> 0),
);
export const CASTLE_MAP_IDS = Object.freeze([...BAY_CASTLE_MAP_IDS, ...PROVINCE_CASTLE_MAP_IDS]);
const GUILD_ROOMS = new Set(CASTLE_MAP_IDS.map((k) => `dungeon:m${k}`));
/** The relay that admits an instance (net/wire.js RELAY_VERSION world208 - world206 then world207 on its branch, renumbered past SERPENT5's and ONE-BODY's at the merges): an older one keeps no memory for the key, gates
 *  nobody out of it, and drops the party pose's `ins` - so no page offers an instance until its relay says this. */
export const INSTANCE_RELAY_MIN = 208;
/** Does the relay whose welcome said `v` admit instances? */
export const relaySupportsInstances = (v) => {
  const m = /^world(\d+)$/.exec(typeof v === 'string' ? v : '');
  return !!m && Number(m[1]) >= INSTANCE_RELAY_MIN;
};

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
const INSTANCE_ROOM = new RegExp(
  `^(dungeon:m[1-9]\\d{0,9}|interior:m[1-9]\\d{0,9}\\.[1-9]\\d{0,7})\\.i([0-9a-f]{${INSTANCE_OWNER_HEX}})\\.([0-9a-f]{${INSTANCE_EPOCH_HEX}})$`,
);
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
/** DOMAIN2: the owner's digest of a GUILD - a castle's instance's - or null for no guild. Its own hash domain
 *  (`instance:guild:`), so it is never an account's. */
export async function instanceGuildOwnerOf(guild) {
  return identity(guild) ? digest(`instance:guild:${guild}`, INSTANCE_OWNER_HEX / 2) : null;
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
  const owner = instance?.owner,
    epoch = instance?.epoch;
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
  const owner = instance?.owner,
    epoch = instance?.epoch;
  return typeof owner === 'string' && OWNER_RE.test(owner) && isInstanceEpoch(epoch) ? `${owner}.${epoch}` : null;
}
/** The instance a party pose's `ins` names, `{ owner, epoch }`, or null. */
export function instanceOfWord(word) {
  const m = typeof word === 'string' ? /^([0-9a-f]{16})\.([0-9a-f]{8})$/.exec(word) : null;
  return m ? { owner: m[1], epoch: m[2] } : null;
}

/**
 * THE RELAY'S DOOR: by what right may the account `subject` (the token's verified subject - never a hello field) stand in
 * the instance room `key`? 'staff', 'owner', 'guild' (DOMAIN2: `guild` the guild the verified token names, whose digest
 * owns the room - a castle's, CASTLE_MAP_IDS' alone), or 'party' - asked of `kin(subject, owner)`, the hub's word (partyHoldsOwner), a member of
 * the owner's party, whom the room asks again while it stays. Null for none, and for anything but an instance's key.
 */
export async function instanceAdmission(key, subject, { staff = false, kin = null, guild = null } = {}) {
  const r = instanceOf(key);
  if (!r || !identity(subject)) return null;
  if (staff) return 'staff';
  if (r.owner === (await instanceOwnerOf(subject))) return 'owner';
  if (guild != null && GUILD_ROOMS.has(r.base) && r.owner === (await instanceGuildOwnerOf(guild))) return 'guild'; // a castle's, whole (AUDIT DOMAINS R2)
  return typeof kin === 'function' && (await kin(subject, r.owner)) ? 'party' : null;
}
/** May the account `subject` stand in the instance room `key`? (instanceAdmission's yes or no.) */
export const instanceAdmits = async (key, subject, opts = {}) => (await instanceAdmission(key, subject, opts)) != null;

/** THE HUB'S ANSWER: does the party whose members are `members` (account ids) hold `subject` and another member whose
 *  digest is `owner`? */
export async function partyHoldsOwner(members, subject, owner) {
  if (!Array.isArray(members) || !members.includes(subject) || typeof owner !== 'string' || !OWNER_RE.test(owner))
    return false;
  for (const m of members) {
    if (m === subject || !identity(m)) continue;
    if ((await instanceOwnerOf(m)) === owner) return true;
  }
  return false;
}
