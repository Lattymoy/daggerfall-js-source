# Spawn Grants

The relay decides which shared foes may exist. In the open world each player's client owns the foes it spawns and
streams them to others, so a modified client could stream foes nobody could have made. Online, a foe that rides to
another player stands on a **grant**: the relay signs it when the foe is made and never reads the foe stream. The
owner's client builds the foe from the grant's seed; every reader checks the signature, rebuilds the foe and refuses a
record that disagrees. Players never see grants, except as foes that a changed client streamed and that do not appear.

## How it works

**A grant** (`src/net/grantLaw.js`). Minted by the cell room holding the owner's socket, on the owner's ask, signed
with the relay's key under the prefix `GRANT_SIG_V`. It names the owner's socket and account, the room, its kind, the
map pixel the relay read off the owner's pose (anywhere in the world, `worldPixelOk`), the world minute, the owner's
signed level and Renown, how many foes it stands, a seed, which members are elite and each member's champion trait
(rolled by the relay from the seed), and its expiry (`GRANT_TTL_MS`, ten minutes).

**Asks.** Small frames of their own (`{t:'grant', k}`), never on the foe stream: `mint` when the client's clock decides
a spawn is due, `renew` before expiry, `free` when a granted foe dies, `carry` into a new cell, and `heir` when a foe is
handed on. A mint spends the kind's bucket (`GRANT_KINDS`) and checks the cell's ceiling (`GRANT_CELL_CEILING`). The
open-world kinds are `GRANT_OPEN_KINDS`, among them encounters, camps, bounties, giants and fallen stars. The relay keeps
each room's buckets and live grants in its storage (`grantGateKept`), one row an ask, no timer, so a sleeping cell
forgets nothing.

**The dice.** A granted foe's species, level, weapon and health are drawn from the grant's seed, one stream per die
(`GRANT_DICE`). Movement, targets and blow timing stay the owner's.

**Readers** (`src/scenes/grantHost.js`). Each record carries its grant's number and member; full frames carry the
grants longest unsaid first (`GRANT_FRAME_GRANTS_MAX`). A reader refuses a record for a failed or foreign signature, a
member or marks past the grant, a member twice, or stats no builder could give; those reasons can open a case
(`GRANT_CASE_REASONS`). A grant not yet heard is `ungranted`: stood down while the law enforces, judged again when the
grant arrives, never a case. A reader waits a few full frames before calling a grant unheard.

**Foe bounds** (`src/net/foeBounds.js` `foeHealthBound`). The exact legal most for a foe's maximum health, taken at the
worst of every input a reader cannot see, through the game's own builders (the street's and the dungeon's). A record
over its bound, or with a mark no builder gives its kind, is never built, updated or adopted, and a standing copy is
taken down silently: no death, body, loot or experience. It is tallied against the sender, never the receiver.

**The law's modes** (`GRANT_MODES`, the relay setting `grantMode`; unset is `measure`). `measure` counts refusals but
stands every foe; `enforce` stands nothing ungranted. Two more settings are off unless set: `grantRoll` (the seed rolls
an encounter's species from the reader's own map, and readers refuse any other) and `grantStrip` (the relay drops
records that name no grant it holds, or exceed their bound). `grantDoor` turns away a foes room's hello that does not
say its build stands on grants (`GRANT_HELLO_LAW`); every frame from a socket that says it carries the relay's word,
so readers hold that sender to grants from its first frame.

**The measure and cases** (`src/net/grantMeasure.js`, `server-account/src/grants.js`). Each cell posts readers' tallies
and its own counts to the account service in a signed batch every `GRANT_MEASURE_MS`, at its bound, or when the room's
last socket leaves. A case opens when `GRANT_CASE_READERS` (3) credible readers' accounts tally a case reason against a
sender within ten minutes, when the relay itself stripped a sender's record, or when an account's asks run far past
what honest play asks. Relay-opened cases are capped an hour. A moderator decides; no report is filed and no mute
follows automatically. `tools/realmReview.mjs grants` suggests bucket rates and the ceiling from the measure.

## Rules

- Server-rolled spawns, not a relay referee for foe frames (Mac).
- The relay signs at spawn time only and leaves checking to each player's game, to spare the relay's busiest path
  (Mac).
- A provably impossible foe at a hand-off is rejected and removed, never rescaled to a legal one; the evidence goes to
  the moderators' queue; the player it was handed to is never blamed (Mac). Limits come from the game's own code.
- Enforcing is a staff setting (`/relay grantMode enforce`), after reading the measure; nothing deploys.
- The moderators' case needs three credible readers' accounts in ten minutes, or the relay's own count (the owner).
- A grant is the provenance: what no grant names is taken at its worst, so bounds catch gross forgeries, not a few
  points of inflation.

## Code and tests

- `src/net/grantLaw.js` - grants, kinds, buckets, refusals, modes, the kept gate
- `src/net/foeBounds.js` - the exact legal health bound
- `src/net/grantMeasure.js` - the relay's signed measure
- `src/scenes/grantHost.js` - the owner's asks and the reader's judge
- `server/src/index.js` - the Room's grant asks, strip and door
- `server-account/src/grants.js` - the feed and cases
- `test/net/grant1_law.test.js`, `test/net/grant2_relay.test.js`, `test/net/grant3_asks.test.js` - the law, the relay, the asks
- `test/scenes/grant3_pool.test.js`, `test/scenes/grant4_lanes.test.js`, `test/scenes/grantunheard.test.js` - readers
- `test/net/foebounds_law.test.js`, `test/scenes/foebounds_pool.test.js` - foe bounds
- `test/net/grantdoor_relay.test.js`, `test/server/grant7_case.test.js`, `test/server/grantcase_own.test.js` - the door and cases
- `test/net/audittesa3e2_grantgate.test.js` - the gate kept across sleep

## Open

- Allies, companions and crewmen in a foes frame are not verified.
- A camp's composition is not rolled from the seed under `grantRoll`; encounters only.
- The in-game moderation panel calls a spawn grants' case "opened by the reviewer"; the Discord card names the spawn
  grants.
