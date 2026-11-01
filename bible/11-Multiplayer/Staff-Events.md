# Staff Events

An Admin stages monsters on a town or an area from the Staff Panel's Events page. Players in the place fight packs of
the chosen kinds; a hidden kill meter fills and calls a yellow-glowing mini boss; its fall pays a reward and a board.
A staff member may steer the mini boss themselves (Play as boss). It is staff work: no player patch notes describe it.

## How it works

**What staff set** (`src/net/staffEvent/staffEventLaw.js` `validStaffEvent`):

| Field | Bounds | Default |
|---|---|---|
| Place | a town (said as a city) or an area (one map pixel; `loc` `STAFF_EVENT_AREA`) | - |
| Monsters | up to `STAFF_EVENT_KINDS_MAX` kinds, any of the game's; `STAFF_EVENT_KINDS_BARRED` (39, 146) refused | - |
| How many in all | `STAFF_EVENT_TOTAL_MIN`-`STAFF_EVENT_TOTAL_MAX` | 50 |
| Kills to fill the meter | 1 to the total | 25 |
| Mini boss | any kind | the first monster picked |
| Its size | `STAFF_BOSS_SIZE_MIN`-`STAFF_BOSS_SIZE_MAX` % | `STAFF_BOSS_SIZE_DEFAULT` % |
| Its health | 1-100 x its kind's, or an exact number up to `STAFF_BOSS_HP_MAX` (the exact number wins) | 10 x |
| Ends when it falls | yes / no | yes |
| Runs for | until ended, up to `STAFF_EVENT_LONGEST_MS` | until ended |

At most `STAFF_EVENTS_MAX` events run at once. A refused staging names its field (`staffEventFault`,
`event-bad-<field>`). The page lists each event's meter, its boss's state and fighters, with **Spawn mini boss now**,
**End**, and **Clear** for events that are over. Players never see the meter.

**The path of an order.**

1. The account service (`server-account/src/staffEvents.js`, `/v1/staff/event` with `op` start, end, boss or clear,
   and `/v1/staff/events`, Admins only) checks the event by the law, stores the row and its audit row, and pushes a
   signed `sevent` order through the relay's law door. Rows keep `STAFF_EVENT_KEEP_S`. Clear touches the history only.
2. The hub (`server/src/staffEvents.js`) verifies the order, keeps the book, lapses an event past its end, and says the
   book to everyone online (`sev`). It keeps the newest `SEV_BOARDS_KEPT` boards.
3. The place's cell keeps the kill meter by a raid ledger's law: each player there says the deaths of the monsters they
   stand, credited only from a socket whose pose is on the event's pixel, under a burst cap. At each meter fill once the
   last boss fell, and at each hand call, it calls the boss. The hub ends the event when the boss falls with "ends when
   it falls", or when every monster fell and no boss stands.

**The game** (`src/systems/staffEvents.js`, `src/systems/raidingParties.js`). Each event runs as a raid of its own
(key `s.<id>`): one player in the place runs it and stands its monsters, and the rest stand them as puppets. A town's
event runs while the player is outdoors in its rect; an area's while on its pixel. Monsters come in packs of 3-5 mixed
kinds (`staffPackStep`), led from around each player in the town in turn (`staffPackPlayer`). The cap grows by
`STAFF_PACK_CAP_PER` a player to `STAFF_PACK_CAP_MAX` (`staffPackScale`). No town guards come out. Lines name a city or
an area: "The city of X is under attack!", "A mighty KIND has come to the city of X!", and an end line.

**The mini boss** (`src/systems/eliteFoes.js` `promoteStaffBoss`). An elite with staff's size and health, named "Mighty
KIND" (`src/systems/foeTitle.js`), glowing yellow (`STAFF_BOSS_GLOW`, drawn as `STAFF_BOSS_RIM` by
`src/systems/hitFlash.js`). It stands:

- at its call once every monster stood before that call is dead or gone, or after `STAFF_BOSS_CLEAR_MAX_MS`; by hand at once;
- beside the player with the biggest group within `STAFF_BOSS_GROUP_M`, ties by level (`staffBossSpot`); about the pilot
  when one steers it (`staffBossPlace`);
- again if it stands nowhere for `STAFF_BOSS_LOST_MS` (`staffBossLost`); never twice for one call while one stands.

It is hard on purpose: no shove, Hurt, stagger or paralysis; `STAFF_BOSS_MIN_METAL` Silver to cut it and
`STAFF_BOSS_ARMOR` on every part; `STAFF_BOSS_SPELL_TAKEN` of each spell's damage; and one hit takes at most
`STAFF_BOSS_HIT_SHARE` of its maximum divided by the fighters, counted to `STAFF_BOSS_FIGHTERS_MAX` (`staffBossHit`).
Its health is exactly what staff set: the party toughness scaling skips it (`src/scenes/exteriorFoes.js`). A peer's
blow past `PEER_HIT_DMG_MAX` lands at that cap on it, and its health is said on the wire as a share of `FOE_HEALTH_MAX`.
A peer's copy is held to the event's health, not a plain elite's (`staffBossBound`).

**The reward.** At the boss's first fall the cell pays (`server/src/staffEvents.js` `payReward`). Every account with
`STAFF_EVENT_EARN_KILLS` kills of its own earns, once an event (`staffEventEarned`). The board is the top
`STAFF_EVENT_BOARD_MAX` by kills (`staffEventBoard`). Each earner gets a receipt signed with the relay's key
(`src/net/staffEvent/staffEventReceipt.js`). The spoils are rolled on the device off the receipt's seed into the pack,
from `STAFF_SPOILS_TABLE` (`src/systems/staffEventSpoils.js`): gold by level and a Magic-or-better piece for every
earner, more for the board and first place. None of Dagon's gear.

**Play as boss** (`src/systems/staffBossPilot.js`, `src/scenes/staffPilotHost.js`). The Events page posts `pilot`
through `src/net/staffHook.js`. The pilot's raid claim says `PILOT_CLAIM_AGE`, so every game hands them the run. The
boss's feet and facing follow the pilot; a left click swings at the player nearest the facing within `PILOT_TARGET_M`;
a right click lets its spell choice run for `PILOT_CAST_MS`. The pilot's own body is concealed and unsensed. The boss
bar shows its health (`src/ui/staffPilotBar.js`). Leave boss hands the boss back to its own brain. No relay or account
change: it rides words the wire already carries.

**Places past the Bay** (`src/net/staffPlaces.js`). An event's pixel is the world's (`STAFF_EVENT_PIXEL_BOUND`), so an
area event stands in any province. A town past the Bay is named by its registry location (negative) in a province
region (`STAFF_PROVINCE_REGIONS`, `staffTownPixelOk`); a town and pixel on two sides of the Bay's edge is refused. Staff
may stage one in any province's town, Cyrodiil's included.

## Rules

- Admins only; scaled by monster count, kinds, meter and boss, staged on a town or an area.
- The mini boss is one enlarged version of the event's monsters, with a yellow glow in place of the elite's blue.
- Players never see the meter; staff do.
- Every mini boss is very hard for players and cannot be stun-locked; only an event's mini boss, no other foe.
- The reward is Dagon's way without Dagon's gear; `STAFF_SPOILS_TABLE` is the one place to tune it.
- An event, a hub word and a relay older than `STAFF_EVENT_RELAY_MIN` never meet: the game sends `sev` only past it.

## Daggerfall Unity

DFU has no staff events, no other players and no unstunnable foe. The mini boss's armour and metal rule borrow Enemy
Expansion's Troll (`MonsterBase.mdb.csv` row 272); hand-to-hand still lands, as in DFU.

## Code and tests

- `src/net/staffEvent/staffEventLaw.js` - the event's shape, words and ledger, shared by service, relay and game
- `src/net/staffEvent/staffEventReceipt.js` - the reward receipt
- `server-account/src/staffEvents.js` - routes, rows, orders
- `server/src/staffEvents.js` - the hub's book, the cell's meter, the reward
- `src/systems/staffEvents.js`, `src/systems/raidingParties.js` - the event as a raid, packs, boss placement
- `src/systems/eliteFoes.js` - the mini boss's promotion and limits
- `src/systems/staffEventSpoils.js` - the drop table
- `src/systems/staffBossPilot.js`, `src/scenes/staffPilotHost.js`, `src/ui/staffPilotBar.js` - Play as boss
- `src/net/staffPlaces.js` - the place picker over the game's maps
- `tools/eventKinds.mjs` - regenerates the panel's kind list from the game's registry
- `test/server/staffevent_relay.test.js` - the relay's half

The Dwarven Dragon as a staff monster and an Admin's ride: `Dwarven-Dragon.md`.

## Open

- A kill and a stand are the player's machine's word; a forged word can bring a boss early, never stage or end an event.
- If the runner changes while a boss is being stood, two may stand for one call.
- An event past its end lapses at the hub's next touch.
- A fighter who drops at the boss's fall can miss their receipt; spoils are spent once a receipt a device, not an account.
- A pilot's boss walks at the pilot's pace; a drawn weapon still swings at a click.
