# The Dwarven Dragon

A Rourken clockwork dragon: a rare world boss that circles in the sky, a staff monster an Admin may ride, and a mount
for the few players who tame one. A player meets it by seeing it - a dragon over the wilds near a town, heard from
far off - then fights it in two phases of the air and the ground. It falls deactivated, drops a hoard, and one dealer
in a hundred binds it as a flying mount.

## How it works

**When** (`src/net/dragon/dragonLaw.js`). The real clock is cut into watches of `DRAGON_WATCH_MS`. A watch holds
`DRAGON_CELLS_A_WATCH` omens, each seed its own HMAC of the relay's `GATE_SIGNING_KEY` (`src/net/dragon/dragonSeed.js`
`dragonOmenSeeds`), so the source cannot predict a dragon and one omen told says nothing of another. One omen in
`DRAGON_WATCH_ONE_IN` brings a dragon down, where its cell has ground. An omen within two cells of an earlier one is
dropped (`dragonCandidates`), so up to four may stand at once, three cells apart at least. The landing is a random second
in the watch's first `DRAGON_LAND_SPAN_MS` (`dragonLandOf`). The dragon stays until slain or `DRAGON_STAY_MS`, then
climbs away. One in `DRAGON_SHINY_ONE_IN` is the Aetherbright.

**Where.** Each omen picks one of the relay's world cells in the continent's frame (`dragonCellOf`, `DRAGON_CELLS`), a
box the relay knows with no map. The client finds the site in that cell over the world's own data
(`src/systems/dragon/dragonSite.js` `dragonSiteOf`): the Bay's gate scan's ground where the cell has any, else, past the
Bay, the gate's ground over the towns about it (`src/scenes/gate/gateLanes.js` `groundIn`, read in idle slices once the
countryside stands and the land is laid). The omen's own roll picks one pixel (`dragonSitePick`). A cell with no ground
brings no dragon. The relay holds a fight at the site a join names, at most `DRAGON_SITES_MAX` a dragon, at a pixel's
centre in its omen's cell (`dragonSiteOk`, `dragonCandidateOf`). No chat line, no map ring.

**Told near its cell** (`server/src/dragonFights.js`). A client asks for this watch's omens and the last's, down
whatever room it stands in. The relay judges a pose in a cell room (within the socket's cover) or in a battle; a private
room's pose is never judged. A socket not yet stood `DRAGON_TELL_DWELL_MS` in the cell of its pose hears nothing. One
that has is told a landed dragon's omen within `DRAGON_TELL_PX` of its cell, and null otherwise, no sooner than a quiet
watch's time (`dragonQuietAt`). A join from a socket not yet stood is dropped too. The client asks again once outside a told omen's reach, and after
a null from another pixel, or from the same one after `DRAGON_NONE_AGAIN_MS` (`src/scenes/dragonHost.js`).

**The budget.** An account is judged in at most `DRAGON_JUDGED_CELLS_MAX` cells a watch, all its sockets together,
counted on the hub (`dragonJudgeInternal`). An ask is charged every cell its pose could be told of (`dragonReachCells`),
a join its site's cell. A fight's words reach a passer-by only once its account is granted the fight's cell.

**Seen in the sky** (`src/scenes/dragonHost.js`). Until a player comes within `DRAGON_ADMIT_R`, the dragon circles its
site at `ROOST_ALT` on a path that is a function of the clock and omen (`src/net/dragon/dragonBody.js`), so every screen
draws it in the same place with no frame sent. It is drawn to `DRAGON_SIGHT_R` at `DRAGON_SCALE`, roars every
`DRAGON_ROAR_MS` (heard to `DRAGON_ROAR_R`), and a player within `DRAGON_NOTICE_R` for `DRAGON_NOTICE_WAIT_MS` is told
once which way it circles, a whole phrase per language (`dragon.way.*`).

**The fight** (`src/net/dragon/dragonBrain.js`). The fight lives in the cell room its site stands in, as the serpent's
does, plugged into the boss seam (`src/net/bossSeam.js`), stepped every `DRAGON_TICK_MS` and checkpointed every
`DRAGON_CHECKPOINT_MS`. A join is refused for an old law (`DRAGON_BRAIN_MIN`), a gone dragon, a bad site, or a pose past
`DRAGON_ADMIT_R`. Each fighter brings `DRAGON_TTK_S` seconds of the gate's reference damage to its health and deals
through the gate's bucket; a fighter gone `DRAGON_ABSENT_RETIRE_MS` takes their share away. A blow counts only from
within `DRAGON_ENGAGE_R`, and melee only when it is grounded.

- **Aloft** it orbits at `CIRCLE_ALT`, flying `FLY_V`. Melee cannot reach it; arrows and spells can.
- **Grounded** after a Crash Landing, for `GROUNDED_MS`, walking at `WALK_V`; every blow on it lands at `GROUNDED_X`.
  It leaves by a Takeoff Gust.

It never strays past `DRAGON_ARENA_R` of its site. Threat picks its target as the gate's does; no blow more than
`DRAGON_REPEAT_MAX` times running. At 66% and 33% it roars, is warded for `DRAGON_SHIELD_MS` and enters its next phase.

**Its blows** (`DRAGON_BLOWS`). Each is a shape on the ground from the Spire's stamps
(`src/net/eliteGates/egShape.js`), laid with its wind-up and judged on each player's own feet. A hit is a share of the
struck player's maximum health; shock and fire take the player's saving throw.

| blow | where | wind-up | share | phase |
|---|---|---|---|---|
| Strafing Run | aloft, a lane | 1.6 s | 25% shock | 1 |
| Cannon Volley | aloft, a disc under each of up to five | 2.0 s | 22% shock | 1 |
| Scalding Breath | aloft hovering, a cone | 1.8 s | 30% fire | 1 |
| Crash Landing | aloft to ground, a disc | 2.2 s | 35% | 1 |
| Claw Rake | grounded, a cone before it | 1.3 s | 30% | 1 |
| Tail Sweep | grounded, a cone behind it | 1.4 s | 25% | 1 |
| Takeoff Gust | ground to aloft, a disc | 2.1 s | 20% | 1 |
| Overpressure | aloft, a ring safe near its centre | 2.4 s | 40% fire | 2 |
| Shrapnel Rain | aloft, discs about the fighters | 2.2 s | 25% | 3 |

Each wind-up is clamped through `egBlowOf` to the Spire's floor; the third phase cuts wind-ups by a fifth, never below
it. Telegraphs are the gate's renderer (`src/render/gate/gateTelegraph.js`) draped over the land's heights. The bar is
the gate's in brass: name, health and phase marks, ALOFT or GROUNDED, the blow winding up, and **MOVE** when one is on
me.

**The fall.** At nought the cell stamps the kill once and signs each earner's receipt. The dragon falls straight down
and lies deactivated for `DRAGON_REMAINS_MS`. A dealer dealt `DRAGON_DEALT_SHARE` of their share; a stander stood within
`DRAGON_STAND_R` for `DRAGON_STOOD_SHARE` of the fight. A dealer's party counts as standers.

**Spoils and the tame.** The receipt is `z1` (`src/net/dragon/dragonReceipt.js`), Ed25519 under the relay's key. It
signs its dragon's place (`p`, its cell's number, `dragonPlaceOf`), so each dragon of a watch is its own kill and a
forged site in its cell pays once. The hub keeps an account's receipts of its newest watch, one a place. The
device carries it (`src/net/dragon/dragonClaims.js`) to `/v1/dragon/claim` (`server-account/src/dragons.js`
`claimDragon`), which counts one kill a (watch, place, account) and gives the hoard to the one claim that writes that
dragon's row. A receipt with no place counts one a watch, and a placed receipt is refused where an older service
counted its watch after it was minted.

The hoard (`src/systems/dragon/dragonSpoils.js`) is rolled on the receipt's seed, never past the character's level:
`DRAGON_GOLD_PER_LEVEL` gold a level, and Magic-or-better and Rare-or-better pieces for a dealer, less for a stander.
The tame is the service's own draw, 1 in `DRAGON_TAME_ONE_IN`, for a dealer whose character holds no dragon. A tamed
player sees "Its core still turns. The Dwarven Dragon is yours." and the item goes into the pack
(`src/scenes/dragonRewards.js`).

**The mount** (`src/systems/dragon/dragonMount.js`, `src/systems/dragon/dragonKeep.js`, `src/player/dragonRide.js`).
A third mount beside horse and cart:

- summoned from the transport window, the summon key or the Stable page; it flies in from `DRAGON_COME_FROM_M` behind
  and waits `DRAGON_WAIT_BACK_M` behind its rider; it may be named and sent away; off its back it is drawn at its
  sprite's own size, the size it is ridden at (`DRAGON_KEEP_SCALE`), never the boss's `DRAGON_SCALE`;
- saddlebags of `DRAGON_BAGS_KG`, saved with the character and read by the judge as a held list;
- upkeep is horse care's (`src/systems/steedCare.js`): it drinks Dwarven Oil alone, sold at every Stable; flight and
  gallop spend its breath, and a winded dragon glides down;
- ridden on the ground as a horse; hold jump `TAKEOFF_HOLD_S` to fly at `DRAGON_FLY_SPEED`, outdoors only
  (`src/systems/dragon/dragonFlight.js`);
- on the travel map at `DRAGON_TRANSPORT_MODIFIER`, straight over sea and peaks; on the Overworld one `air` leg at
  `DRAGON_CRUISE_M` (`src/systems/dragon/dragonJourney.js`);
- never dropped, sold, traded or lost to a death; the service holds every dragon item to its tame's row.

Others see a rider as the dragon: the pose's ride is `POSE_RIDE.Dragon`, its look `rc` (1 the Aetherbright). Tamers
hold the Wyrm Rider or Aether Rider title, and the first of each look the First title (`src/net/huntLaw.js`
`DRAGON_TITLES`); a developer's tame is never a First.

**The Aetherbright** (`src/characters/dwarvenDragonShiny.js`). Archive 1801 is archive 1800's pictures with their palette
turned to aetherium's blue and violet at load; no new picture ships. A tamed Aetherbright keeps its colours.

**The staff dragon** (`src/characters/dwarvenDragon.js`). Kind 512, archive 1800 under `public/art/dwarven-dragon/`, the
Iron Atronach's career made a boss. No encounter table names it: staff bring it to a staff event. An Admin with the
`DRAGON_GLYPHS` rides it with `/dragon` (`src/systems/staffDragon.js`): flight at `DRAGON_FLY_MULT` times levitation's
pace, the saddle drawn by `src/scenes/staffDragonHost.js`, and cannons that take `DRAGON_BOLT_DAMAGE` off the first
monster they meet - never a player, party mate or court boss. `/dragon blue` and `/dragon brass` pick the look.

## Rules

- Online only: the relay runs the fight and signs each kill; the account service rolls the tame (the owner).
- Hidden and seen in the sky: no chat line, no map ring, a few times a day anywhere in the world (the owner).
- Tame 1 in 100 per dealer, one dragon a character; shiny 1 in 20, kept when tamed (the owner).
- The mount walks and gallops as a horse, flies 25 m/s, and travels twice a horse's pace on the map, straight over water
  and mountains (the owner). This pace is the owner's word past the power ceiling (`05-Combat/Power-Ceiling.md`).
- The spawn must not be predictable from the source (the owner): every roll is the relay's seed, told after landing.
- Cell-scoped (the owner): an omen is told only to a player near its cell, never to every screen.
- A budget of cells an account is judged in each watch, kept on the hub (the owner).
- Each dragon pays its own kill: a second dragon in one watch pays too (the owner).
- A tamer's title is worn on a metal name plate (the owner); developers' tames never count as a First (the owner).
- First Wyrm Rider is granted by name (the owner): `server-account/wrangler.toml` `FIRST_WYRM_RIDER_HANDLES` holds the
  account, read by `server-account/src/titles.js` `isNamedFirstWyrm`. While the list names anyone, only it names the
  First. First Aether Rider stays derived from the earliest tame.
- Lore: the Rourken and aetherium are canon; the clockwork dragons as sky-ketch outriders are the port's own.

## Daggerfall Unity

Daggerfall has no other players, no world boss and no flying mount; none of this is a DFU member.

## Code and tests

- `src/net/dragon/` - law, seed, body, brain, receipt, claims, the keep's wire word
- `src/systems/dragon/` - site, spoils, mount, keep, flight, journey, words
- `src/scenes/dragonHost.js`, `src/scenes/dragonKeepHost.js`, `src/scenes/dragonRewards.js` - the dragon on screen, the
  keep, the hoard
- `server/src/dragonFights.js` - the relay's half: the tell, the budget, the fight, the receipts
- `server-account/src/dragons.js` - claim, hoard, tame
- `src/systems/staffDragon.js`, `src/scenes/staffDragonHost.js` - the Admin's ride
- `test/net/dragon/` - law, relay, client, claims, service, mount, keep, care, Aetherbright, hidden omens, audits
- `test/net/dragon/dragoncell.test.js`, `dragonbudget.test.js`, `dragoneach.test.js` - the cell's tell, the budget, a
  kill a dragon
- `test/net/dragonride_wire.test.js` - the ride's relay gate and pose law
- `test/systems/travel/dragon6_flight.test.js` - the flown journey

## Open

- Under the Overworld a peer's ridden dragon is grown with the traveller and a waiting tamed dragon is not.

- Guest accounts cost nothing to make, and the cell budget is an account's, so many guests can still sweep the cells;
  the hub's count is lost when it sleeps. Put to the owner.
- A forger told an omen whose cell has no ground can fight a dragon no honest screen sees. Put to the owner.
