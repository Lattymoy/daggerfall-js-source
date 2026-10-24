// @ts-check
// SCALE5c (2026-10-10, Mac: "lets now tackle the bigger work ... really future proof our archetecture while also
// increasing performance", then "I wanna do every single slice"; bible/11-Multiplayer/Scale-Arc.md SCALE5c): THE HUB,
// SIXTEEN WAYS. Every player online held one socket in ONE object, the hub (`chat:world`): 2,048 sockets at most, and
// every hello, leave and world line walked all of them. A player's hub link now lands on one of HUB_SHARDS shards -
// `chat:world.<k>`, k from the verified account (hubOfSubject) - which holds the sockets, their roster and their own
// joins and leaves. `chat:world` stays what it was for everything else: the world's bus. It keeps every account's
// record, the parties, the receipts and the world's state, and runs every law over them as it always did, over a
// VIRTUAL socket for each shard's (server/src/index.js ShardSocket): a shard hands it each hello, frame and close
// (HUB_INTERNAL_UP), and each shard asks it for what it says to that shard's sockets (HUB_INTERNAL_POLL - HUB-PULL: the
// bus never calls a shard), batched both ways. So nothing is migrated - the records are where they were - and a tab from before this build still joins
// `chat:world`, as a hub of its own, beside the shards.
//
// The law both ends run: the shards' keys, which an account lands on, the doors between the objects, and the frames a
// client reads.

/** How many shards the hub is split into. A shard holds about 1/HUB_SHARDS of everyone online - 625 at 10,000. */
export const HUB_SHARDS = 16;
const HUB_BUS = 'chat:world';
const SHARD_RE = /^chat:world\.(\d{1,2})$/;
/** The shard `k`'s key, or null for an index the hub does not have. */
export const chatHubRoom = (k) => (Number.isInteger(k) && k >= 0 && k < HUB_SHARDS ? `${HUB_BUS}.${k}` : null);
/** Every shard's key, in order. */
export const HUB_SHARD_ROOMS = Object.freeze(Array.from({ length: HUB_SHARDS }, (_, k) => /** @type {string} */ (chatHubRoom(k))));
/** Is `key` one of the hub's shards (never the bus itself)? */
export const isHubShard = (key) => { const m = SHARD_RE.exec(String(key ?? '')); return !!m && Number(m[1]) < HUB_SHARDS && String(Number(m[1])) === m[1]; };

/** The shard hash: FNV-1a, 32 bits, over a string's UTF-16 code units - the same number at both ends and on every device. */
export function shardHash(s) {
  let h = 0x811c9dc5;
  const t = String(s ?? '');
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
/** The shard an account's hub link lands on - by its VERIFIED subject (the token's `s`), so every tab of one account is
 *  on one shard and ONE-SEAT, its record's tabs and its receipts' newest socket stay one object's to judge. Null for no
 *  subject. */
export const hubOfSubject = (sub) => (typeof sub === 'string' && sub ? chatHubRoom(shardHash(sub) % HUB_SHARDS) : null);

/** SCALE5c part two (bible/11-Multiplayer/Scale-Arc.md SCALE5c): A REGION'S CHANNEL, SPLIT THE SAME WAY. The politic
 *  map's regions (wire.js CHAT_REGION_COUNT - REGION_CHANNELS here, pinned to it: wire.js imports this module) each have
 *  a channel, `chat:region.<r>`, which held every player standing in the region: 2,048 sockets, and a start region's
 *  every arrival at its one gate. A region link lands on `chat:region.<r>.<k>`, k from the verified account as the hub's
 *  is, and the region's own channel is that region's bus - its lines, its travellers' marks and its census, run over a
 *  ShardSocket for each shard's socket as the hub's bus runs its own. */
export const REGION_SHARDS = 4;
export const REGION_CHANNELS = 62;
const REGION_BUS_RE = /^chat:region\.(\d{1,2})$/;
const REGION_SHARD_RE = /^chat:region\.(\d{1,2})\.(\d{1,2})$/;
const canon = (d, n) => String(Number(d)) === d && Number(d) < n;
/** Is `key` a region's own channel - a region shard's bus? */
export const isRegionBus = (key) => { const m = REGION_BUS_RE.exec(String(key ?? '')); return !!m && canon(m[1], REGION_CHANNELS); };
/** Is `key` one of a region's shards? */
export const isRegionShard = (key) => { const m = REGION_SHARD_RE.exec(String(key ?? '')); return !!m && canon(m[1], REGION_CHANNELS) && canon(m[2], REGION_SHARDS); };
/** Region `r`'s shard `k`, or null for one the map does not have. */
export const regionShardRoom = (r, k) => (Number.isInteger(r) && r >= 0 && r < REGION_CHANNELS && Number.isInteger(k) && k >= 0 && k < REGION_SHARDS ? `chat:region.${r}.${k}` : null);
/** Every region shard's key, region by region. */
export const REGION_SHARD_ROOMS = Object.freeze(Array.from({ length: REGION_CHANNELS * REGION_SHARDS }, (_, i) => /** @type {string} */ (regionShardRoom(Math.floor(i / REGION_SHARDS), i % REGION_SHARDS))));
/** The bus a shard's key hands its frames to - `chat:world` for a hub shard, the region's own channel for a region's -
 *  or null for a key that is no shard. */
export const busOf = (key) => (isHubShard(key) ? HUB_BUS : isRegionShard(key) ? String(key).slice(0, String(key).lastIndexOf('.')) : null);
/** Is `key` a shard of any channel? */
export const isChannelShard = (key) => busOf(key) != null;
/** Is `key` a channel that has shards (the hub, each region's)? */
export const isChannelBus = (key) => key === HUB_BUS || isRegionBus(key);
/** A key's channel: a shard's bus, or the key itself. */
export const channelOf = (key) => busOf(key) ?? key;
/** The shard of the channel `bus` an account lands on, by its verified subject - null for no subject or no such bus. */
export const shardOf = (bus, sub) => {
  if (bus === HUB_BUS) return hubOfSubject(sub);
  if (!isRegionBus(bus) || typeof sub !== 'string' || !sub) return null;
  return `${bus}.${shardHash(sub) % REGION_SHARDS}`;
};

/**
 * SCALE5d part two (2026-10-11, the plan's "the gate's court ... as copies around one fight object that takes their blows
 * batched and fans the boss's state back"; bible/11-Multiplayer/Scale-Arc.md SCALE5d): A GATE'S COURT, COPIED. The court
 * (`gate:<n>`) keeps its fight and its first SOCKETS_MAX sockets as it always did; a crowd past them goes to its copies,
 * `gate:<n>#<k>` (net/wire.js layerName, k 1 to LAYERS_MAX - 1, found by the Worker's walk), each a crowd of its own - its
 * sockets see each other, never the court's - whose fight is the court's: each copy hands it its sockets' hellos, poses
 * and gate words over the shards' own machinery, and the court hands back the boss's beats, its answers and its closes.
 * The only event room whose own law admits past SOCKETS_MAX: a Super dungeon's realm admits SD_FIGHTERS_MAX accounts, a
 * siege and an arena fewer, so none of them can fill a room.
 */
export const COURT_COPY_RE = /^(gate:(?:0|[1-9]\d{0,8}))#([1-7])$/;
/** Is `name` a copy of a gate's court? */
export const isCourtCopy = (name) => typeof name === 'string' && COURT_COPY_RE.test(name);
/** The court a copy's name is one of, or null. */
export const courtOfCopy = (name) => (typeof name === 'string' ? COURT_COPY_RE.exec(name)?.[1] ?? null : null);
/** The object a shard or a copy hands up to - a channel shard's bus, a court copy's court - or null. */
export const upOf = (name) => busOf(name) ?? courtOfCopy(name);
// AUDIT SCALE II R3-1: a court copy hands its court the fight's words - a frame PARSED as `gate`, said again as one
// (server/src/index.js, the gate arm), never a frame read off its first bytes. `courtHands` read `{"t":"gate"` off the
// start, and a gate word in any other key order (`{"k":"in","t":"gate",...}`) fell through to the copy's own gate arm,
// which stood a fight of its own - one fighter's share of the boss, never beating back - whose kill told the hub the
// gate fell while the court's fight stood; and `{"t":"gate","t":"chat",...}` was handed up whole and run by the court
// as a line to its own crowd (R3-7).

/** A shard's hello, frames and closes, to the bus. */
export const HUB_INTERNAL_UP = '/internal/hub/up';
/** HUB-PULL (2026-10-16): a shard asking the bus for its sockets' frames and closes - THE BUS NEVER CALLS A SHARD. It
 *  pushed them (`/internal/hub/down`) until the live relay showed what that costs: a Durable Object charges every call it
 *  makes to the newest call it is serving (workerd io-context.h, getCurrentIncomingRequest), so the bus's push rode the
 *  shard's hand-up it was serving and the shard's next hand-up rode that push, one hop deeper each round, until the
 *  runtime refused them all (`Subrequest depth limit exceeded`, hundreds of thousands a day, and a shard whose retry
 *  re-armed inside the refused call stuck there). A shard now keeps one poll at the bus while it holds a socket; the bus
 *  answers it with every delivery the shard has not acknowledged, or with nothing after HUB_POLL_MS. Nothing the bus
 *  sends is a call, so no round trip nests in another. */
export const HUB_INTERNAL_POLL = '/internal/hub/poll';
/** HUB-PULL: how long the bus holds a shard's poll with nothing for it before it answers nothing - the shard asks again
 *  at once. */
export const HUB_POLL_MS = 20_000;
/** HUB-PULL: the most deliveries the bus keeps for one shard unacknowledged, and their bytes - past either the oldest is
 *  let go (a shard that stopped asking), and the shard's next sync heals what it missed: every socket it holds said, a
 *  close it never heard said again. HUB-PULL audit: the count holds a delivery every HUB_BATCH_MS for as long as a poll
 *  may be out (HUB_POLL_MS + ROOM_CALL_MS, its shard's deadline) - 256 let a busy shard's go after 6.4 s; the bytes keep
 *  the bus's worst, every shard of its stalled at once, a quarter of an object's 128 MB (HUB_SHARDS x 2 MiB). */
export const HUB_OUTBOX_MAX = 1024;
export const HUB_OUTBOX_BYTES = 2 * 1024 * 1024;
/** How long a shard gathers what it hands the bus, and the bus what it owes a shard, before the batch goes - a world
 *  line crosses two of them. */
export const HUB_BATCH_MS = 25;
/** How often a shard tells the bus every socket it holds, so a hello or a close lost between them heals. */
export const HUB_SYNC_MS = 60_000;
/** AUDIT SCALE II R2-4: the storage key a shard (or a copy) keeps its own name under - a woken one, its sockets gone or
 *  never read, still knows where its owed events go. */
export const HUB_KEY_KEY = 'hubkey';
/** How often at most a shard tells its sockets the hub's count when it moved (`{t:'n'}`). */
export const HUB_COUNT_MS = 1000;
/** The most events one batch from a shard (or a copy) carries; past it, the rest wait for the next. AUDIT SCALE II R2-13:
 *  this said "either way" - the bus's batch to a shard is what it said that shard in HUB_BATCH_MS, each frame once. */
export const HUB_BATCH_MAX = 512;
/** AUDIT SCALE II R2-11: and the most BYTES one carries (at least one event) - a count alone let one hand-up be 512
 *  frames of HUB_FRAME_MAX, 32 MiB the one bus held and parsed. */
export const HUB_BATCH_BYTES = 1024 * 1024;
/** AUDIT SCALE II R2-11: the most a shard holds owed the bus, bytes - past it (a bus that does not answer) a socket's
 *  frame is dropped and counted, never queued without end. */
export const HUB_UP_QUEUE_BYTES = 8 * 1024 * 1024;
/** AUDIT SCALE II R2-9: a shard (or a copy) the bus has not heard from in this long has lost its sockets (an object
 *  reset with no close said) - the bus lets go of every ShardSocket of its. Three of its syncs. */
export const HUB_SILENT_MS = 3 * HUB_SYNC_MS;
/** AUDIT SCALE II R2-5: the attachment's law the bus may change after a shard's hello - a mute, a guild worn or taken
 *  off, its ribbon, its Renown - said back to the shard (a down batch's `att`), so the shard's own attachment, which every
 *  hello it says again is made of, is the bus's word and never the token's alone. LEASE1 (net/roomLease.js): and a
 *  freeze and the time of the last word on both (`fz`, `lt`) - a hub's shard mints its sockets' leases from its own copy. */
export const SHARD_LAW_KEYS = Object.freeze(['mu', 'gi', 'gt', 'gm', 'gio', 'rb', 'lv', 'fz', 'lt']);
/** The largest frame a shard hands the bus - the largest the hub takes (a shared quest, wire.js QUEST_FRAME_MAX). */
export const HUB_FRAME_MAX = 64 * 1024;
/** The frames a second a shard hands up for one socket, and the burst - a hub link says a few a second (its party's
 *  pose, a line, a social act); past it a frame is a junk strike, as the hub's own gates strike. */
export const HUB_UP_HZ_MAX = 16;
export const HUB_UP_BURST = 32;
/** The frames a shard keeps for itself - a socket's hello, its ping, its pose - read off the frame's start, as the
 *  client writes it (`t` first); any other shape is the bus's to parse and refuse. AUDIT SCALE II R1-7: the start is
 *  the first sieve, never the verdict - JSON's last duplicate key wins, so a kept frame is parsed and, parsed as anything
 *  but the three (`{"t":"pose","t":"chat",...}`), handed up as it came (server/src/index.js `_message`): a line is the
 *  bus's to judge, a mute the bus applied with it. */
export const shardKeeps = (s) => s.startsWith('{"t":"hello"') || s.startsWith('{"t":"ping"') || s.startsWith('{"t":"pose"') || s.startsWith('{"t":"lease"');   // LEASE1: and its lease - a hub shard mints one, a region's shard reads one (net/roomLease.js)
/** The close a shard gives a socket that came to the wrong one (its `hub` frame names the right one). */
export const CLOSE_HUB = 4001;
/** The first relay with the shards (RELAY_VERSION's number). */
export const HUB_SHARDS_RELAY_MIN = 192;
/** Does the relay at version `v` keep the hub's shards? */
export const hubShardsSupported = (v) => Number(/^world(\d+)$/.exec(String(v ?? ''))?.[1]) >= HUB_SHARDS_RELAY_MIN;

/**
 * The hub's word on where a hub link belongs: `{ t: 'hub', key }`, a shard's key or the bus's. Null for anything else.
 * @param {any} m
 * @returns {string|null}
 */
export const hubHopOf = (m) => (m && typeof m === 'object' && m.t === 'hub' && (isChannelShard(m.key) || isChannelBus(m.key)) ? m.key : null);   // SCALE5c part two: a region's shard or its own channel too

/** SCALE5c (Mac's decision 2): the most names a search of everyone online answers. */
export const HUB_FIND_MAX = 32;
/** The longest search a client may send. */
export const HUB_FIND_Q_MAX = 24;
/** A name as a search folds it: lower case, apostrophes and spaces dropped. */
export const foldFind = (s) => String(s ?? '').toLowerCase().replace(/['’\s-]/g, '');
/** The searches the whole hub answers a second, whoever asks - a search walks everyone online (each socket's own
 *  bucket is a search a second besides). A search past it is answered `busy`. */
export const HUB_FIND_ROOM_HZ_MAX = 10;
/** How often at most a session asks the hub who of its guild is online (the Guild tab's list, every shard's). */
export const HUB_GUILD_WHO_MS = 30_000;
/** SCALE5c (Mac's decision 2, the list while the hub is small): how often at most a hub link on a shard asks the bus for
 *  everyone online - while the hub holds no more than a roster says (CHAT_ROSTER_MAX), so its World tab lists everyone
 *  as one hub's did; past that, its own shard's, its friends and its guild, and the search. */
export const HUB_WHO_MS = 15_000;
/** How long the bus keeps its answer - every ask inside it is the one frame, which each shard's batch carries once. */
export const HUB_WHO_KEEP_MS = 1000;
/** The most of a guild that answer says (a guild holds GUILD_MEMBERS_MAX - net/guild/guildLaw.js - so this is headroom). */
export const HUB_GUILD_WHO_MAX = 100;
