# Abyss Dungeons (Super Dungeons)

An online-only world event. A Hollow - a hard, whole dungeon - rises by a city where players are thickest. The first
player to reach its door finds it for everyone. At its far end a Rift leads to the Shattered Hour, the place the Warp in
the West left behind. There a party solves the Orrery of Endings, crosses the Unmoored Steps and fights the Brass
Remnant for gold, gear, the Brass of Numidium set, a title and an aura. The code says Super (`super`, `sd*`); the player
reads **Abyss Dungeon** everywhere.

## How it works

**The director.** The hub keeps one record a lane (`sdev`, a province's `sdev:<lane>`), run by the pure law in
`src/net/superDungeon/sdLaw.js`. Its phases are `risen`, `found`, `fell` and `gone`. A Hollow stands
`SD_LIFETIME_MS` (48 h) unbeaten, then fades. The next rises `SD_COOLDOWN_MS` (2 h) after it is gone; a hub with no record
waits `SD_FIRST_RISE_MS` first. Each lane's slots start at its own base (`SD_LANE_SPAN`), so a slot names one Hollow
everywhere: its seed, its rooms, its receipts.

**Where it rises.** At each rise the hub asks its lane's region channels for a census of distinct linked accounts and
takes the fullest with at least `SD_CENSUS_MIN`; ties go by the slot's hash, and the last region is skipped when
another qualifies. A region with no town is never chosen (`SD_TOWNLESS_REGIONS`, which includes the sea). With no
region qualifying, it rises by one of the Bay's great cities. Every client then places it the same way from its own map
files (`src/systems/superDungeon/sdSite.js`): the region's best-ranked city, then a suitable dry pixel two to four
pixels from it. The relay never knows the pixel.

**Every theatre.** The Bay and each province with a lane (`SITE_EVENT_LANES`) keep a Hollow of their own. A province's
census is its own region, and its words name the province. A province raises one only on its front's turn, and at most
`SD_FRONT_HOLLOWS` stand past the Bay at once (`sdFrontFrom`). Cyrodiil's open zone has none. The page runs one host a
lane (`src/scenes/superDungeon/sdLanes.js` `createSdLanes`).

**The find.** A column of brass light marks it from 12 pixels; the city's taverns speak of it; crossing into its pixel
gives a sight line. There is no map or compass mark until it is found. The first player within `SD_FOUND_NEAR_M` of its
door sends `found` to its cell; the cell checks the pose against `SD_FOUND_RADIUS_M`, and the hub names the finder to
everyone online. From then on it shows on the map, the compass, the Timers window and the notice boards, and the
Discord herald posts its rise, find, fall and fade (`src/net/superDungeon/sdHerald.js`).

**The dungeon.** A spawned dungeon cloned from a large labyrinth or keep the slot picks, always laid whole
(`src/world/superDungeon/sdDungeon.js`): foes at x4 health and x2.5 damage, level 24 or more, six elites, loot +50%
in drop and quality, no fires. Its end is the enemy marker farthest from the entrance (`dungeonEndOf`). There stand the
**Rift** (to the Hour) and the **Return** (back to the entrance until the boss falls). Once anyone has entered the Hour,
a smaller **Way Through** opens beside everyone in the Hollow and leads straight in (`src/scenes/superDungeon/sdThrough.js`).
It is pressed, never walked into. No Mark can be set in a Hollow.

**Party copies.** The Hollow's walk, find and Rift are shared; the Hour is not. Each party has its own copy,
`sd:<slot>.<owner>` (`sdRoomKey`), and at most eight fight in it. The page picks the copy it fought in, else its party
leader's, else its own (`src/scenes/superDungeon/sdCopy.js` `sdCopyChoice`). The door (`server/src/sdCopy.js`
`sdCopyRight`) admits the owner, staff and the owner's party. Players in no party share a public Hour of
`SD_PUB_SEATS` (40) seats that are never freed (`sdOpenDoor`). On entry the page says who may enter, or how many are in.

**One copy for the dead, one win a Hollow.** A player who dies may return to the copy they died in, but no other copy
admits them (`SD_NO_FALLEN`). A friend's Resurrect within `SD_REZ_MS` also raises them. A player holding this slot's
receipt is refused every copy (`SD_NO_WON`). A copy whose kill has run its collapse closes to its own players
(`SD_NO_CLOSED`). The kill closes only that party's Hour; the Hollow stands for every other party until it fades.

**The Shattered Hour.** A made level (`src/world/superDungeon/sdRealm.js`) along one axis: the Threshold, the Orrery's
hall, the Steps, and the arena. Rest, saving, the map, Mark and Recall, regeneration and Levitate are refused, and no
companion comes through. Its clock is anchored, so every screen shows the same moment.

**The Orrery of Endings.** Six geared stones over twelve hours; turning one turns its partners. Riddle plaques fix the
true hours uniquely, and the dial shows how many stones stand true, not which. At `SD_FRAY_MAX` (48) turns the Hour snaps
back and lashes those whose turns did not help. The relay judges every turn (`src/net/superDungeon/sdBrain.js`
`orreryMayTurn`): a hand that has lengthened the road six times waits while others turn, counted for the whole Hollow.
Each stone names its last turner, and the snap names the unhelpful hands. Gearing, start and riddles come from the slot's
seed.

**The Unmoored Steps.** Three spans on the shared clock - the Drift (swinging), the Beat (blinking, with risers to run
up) and the Crumble (falling, with gusts) - sized for a running jump at a modest build. A fall casts the player back to
the span's checkpoint with 15% health lost. The Steps are each player's own and not the relay's.

**The Brass Remnant.** The relay runs the fight (`src/net/superDungeon/sdRemnant.js`), on the gate's laws: blows are
shares of the struck player's health, and each fighter adds `SD_TTK_S` (420 s) of reference damage at its signed level.
Phase one (100-70%): Stomp and shock ring, the sweeping Hour-Hand, the Gear Volley. Phase two (70-35%): Gold and Silver
Echoes that must fall within `SD_ECHO_PAIR_MS` of each other. Phase three: every 50 s the Reset, which Heart crystals must
break first or it lands for 70%. The Mantella Pulse beats every 30 s throughout, and the Hour Ends `SD_ENDS_MS` (15 min)
after the first blow. Each Hollow keeps one of six Endings (its element and signature) and two of nine omens
(`src/net/superDungeon/sdMarks.js`).

**The feat.** Each fighter who earned the kill gets a signed `h1` receipt (`src/net/superDungeon/sdReceipt.js`). The
spoils are rolled from its seed (`src/systems/superDungeon/sdSpoils.js`): 400 gold a level (+-20%), one piece Legendary
a quarter of the time else Rare, two Rare or better, a Brass of Numidium piece one time in three
(`NUMIDIUM_SET_CHANCE`), and the Hourlock one time in a hundred (`GILDED_CHANCE`). `POST /v1/sd/claim`
(`server-account/src/sds.js`) writes one row a slot and account and, on that first write only, rolls the title
**Hourbreaker** (1 in 4) and the aura **The Turning Hour** (1 in 8), each shown as a loot banner. After a party's kill a
way home rises, and for `SD_COLLAPSE_MS` the copy stays open for the spoils.

**Labels.** `src/systems/dungeon/dungeonTier.js` `dungeonTier` gives every dungeon one tier: **Regular**, **Elite** or
**Abyss Dungeon**. Online a dungeon also shows its world size, **Small**, **Medium** or **Large**
(`src/world/dungeon/dungeonLabel.js` `dungeonTierLabel`), on the entrance plaque, held-map hover, overworld plates,
sight line and entry line. Native windows (travel map, automap, logbook) do not show it.

**World dungeon sizes.** Online every dungeon has one size for everyone, drawn once from its map id
(`src/world/smallerDungeons.js` `onlineDungeonSize`, weights small 1, medium 2, whole 1). Five blocks or fewer is always
small, eight or fewer never more than medium, and the main story stays whole. A re-laid dungeon has its own room
(`dungeon:m<id>.s` or `.m`), so memory written for one layout is never read into another.

## Rules

- Online only; offline every dungeon is Regular (Mac).
- One Hollow at a time per lane, standing until it fades (Mac; per lane: the owner).
- It rises where population is highest, and is a find: no map or compass mark before it is found (Mac).
- The Rift leads to a place from Daggerfall's lore, not Oblivion; the Return stays open until the boss falls (Mac).
- The player-facing name is **Abyss Dungeon**; the code keeps Super (Mac).
- The world mixes dungeon sizes online, the same for every player (Mac).
- The Hour is a party instance; the Hollow's walk stays shared (the owner).
- A player who dies may go back into their own party's copy (the owner).
- A party's won copy closes for them (the owner).
- Players in no party share a 40-seat Hour (the owner); a party of one counts as no party.
- No site-bound world event stands in Cyrodiil's open PvP zone (the owner).
- A Way Through opens for everyone in the Hollow once someone has entered the Hour (the owner).
- The first group to break an Abyss Dungeon holds the title **Hour's First** and the aura **The First Hour**, granted by
  name (`HOURS_FIRST_HANDLES`) (Mac).
- The relay setting `sdCollapse` (`src/net/relayCfg.js`) makes the first kill collapse the Hollow for everyone; off by
  default.
- The relay mints an `sd:` object only for a slot its hub record holds open; a hub that does not answer is busy, never
  "closed".
- The Brass Remnant reuses the gate's modules through seams whose default is the gate's own behaviour
  (`src/net/gate/gateBrain.js`); it does not fork them.

## Daggerfall Unity

DFU has no other players, no Elite or Super dungeon and no Shattered Hour, so none of this is a DFU member. Offline,
dungeon sizes follow DFU's Smaller Dungeons setting; online the quest stamp is DFU's `Disabled` (the whole dungeon).

## Code and tests

- `src/net/superDungeon/sdLaw.js` - the director, lanes, census, copies' keys, refusals
- `src/net/superDungeon/sdBrain.js`, `src/net/superDungeon/sdRemnant.js`, `src/net/superDungeon/sdMarks.js` - the Orrery, the fight, the marks
- `src/net/superDungeon/sdReceipt.js`, `src/net/superDungeon/sdClaims.js`, `src/net/superDungeon/sdHerald.js` - receipts, honour claims, Discord posts
- `server/src/sdCopy.js` - the copy door, the hub's death and win records, the public Hour walk
- `src/systems/superDungeon/sdSite.js`, `src/systems/superDungeon/sdSpoils.js`, `src/systems/superDungeon/sdScore.js` - site, spoils, music
- `src/world/superDungeon/sdDungeon.js`, `src/world/superDungeon/sdRealm.js`, `src/world/superDungeon/sdSteps.js` - the Hollow's tier, the made level, the Steps
- `src/scenes/superDungeon/sdHost.js`, `src/scenes/superDungeon/sdLanes.js`, `src/scenes/superDungeon/sdCopy.js` - the page's hosts and copy choice
- `src/systems/dungeon/dungeonTier.js`, `src/world/smallerDungeons.js` - labels and world sizes
- `server-account/src/sds.js` - the claim, title and aura
- `test/net/superDungeon/sd1_sdlaw.test.js`, `test/net/superDungeon/sdparty_relay.test.js` - the director, the copies
- `test/net/superDungeon/sd8b_fight.test.js`, `test/net/superDungeon/sd6a_orrery.test.js` - the fight, the Orrery
- `test/world/worldWide/ww5_hollows.test.js` - a Hollow in every theatre
- `test/systems/superDungeon/sd2_sdsite.test.js`, `test/systems/sd9e_spoils.test.js`, `test/server/sd9b_claim.test.js` - site, spoils, claim
- `test/world/tier1_dungeontiers.test.js` - labels

## Open

- A modified client can claim the find at the true door as soon as a Hollow rises, and open the Way Through early; no
  relay check can stop it, since every client holds the site.
- `src/scenes/worldModes.js` and `src/scenes/exterior.js` have no Hollow site of their own (offline, no Hollow).
