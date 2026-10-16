# FIELD BUGS 2026-09-28b - the gate in the rock

From a Discord thread through Mac, with a screenshot of the held map: a ring near the middle of Daggerfall's sheet
labelled *Oblivion Gate* and nothing more. The player:

1. *"gate under the rock didnt go away stayed there"* - then, asked by Mac *"Like after it ended?"*: *"Yep"*, *"Never
   left"*.
2. *"add a discord channel that tells the gates in real time itll create hype and make more join"* (a suggestion).

Mac: *"Apparently the gate persisted after the event ended and the gate can spawn inside the rock geometry from world of
daggerfall"*. Shown the reading below and asked what the sealed hours should do, Mac: *"Count down to collapse. I also
want to add a tooltip to the map for these type of events. I think we should fold in the raid PR in the repo, since it
has a new type of world event also"*. Then, of the player's suggestion, *"Discord live gates?"* - and the moments
*"Omen (15 min before), Boss slain"*, *"Ping an opt-in role"*, and for the place *"What do you need for discord"*.

What each became:

| # | what | here |
|---|---|---|
| 1a | the gate stood inside World of Daggerfall's rock | **GATE-CLEAR** - the rock yields to the gate |
| 1b | "never left" | **THE READING** (no leak: the sealed hours), then **GATE-COLLAPSE** - they count down to the collapse |
| - | a tooltip on the map for world events | **EVENT-TIP** - the gate's ring and a raided town answer a hover with a card |
| - | fold in the raid PR | **THE FOLD** - #414 merged into this branch |
| 2 | a Discord channel that tells the gates live | **DISCORD-GATES** - the relay posts each gate's omen and its kill |

## THE READING: what "never left" was

The gate's times are the clock's alone (`net/gate/gateLaw.js`; the bible's own section 1 table), so the report can be read
against them. The report came at 10:46 on Mac's clock - EDT, the clock this bible's field pages keep (Field-Bugs
2026-09-24) - which is 14:46 UTC: game day 538, whose gate had its omen at 14:17:30, rose at 14:27:30, opened at 14:32:30,
**sealed at 14:42:30**, and met its wrath at 14:52:30, gone ten seconds later. At the report the gate was in its SEALED
HOURS - the phase the patch notes promised ("10 minutes after that, a boss still standing unleashes Dagon's Wrath and
the gate collapses") - and the screenshot says the same thing: the map's label is the ring's own, and a label with no
countdown is `gateCountdown` answering null, which it did in the `closed` phase alone. The player's "Never left", at
10:53, came a few seconds after the collapse.

No code path keeps a gate past its end. Every drawer derives the phase from the clock: the pool's `gatePlacement` (the
stone, the fire and the beacon, the collider off the same place), the omen's `frame` (the ring, the compass, the sky),
the Broker off the pool's place; a stale `current` in the omen would freeze the ring's LABEL, and the omen's frame runs
every online frame the player stands in (`onlineFrame`, before the dead return). What made this gate run its whole
schedule was the rock: its collider takes the press's ray and the walking body before the fire, so nobody entered, no
kill collapsed it early (a kill collapses the gate at once), and it stood through the sealed hours saying nothing -
"has sealed" in the chat, "Oblivion Gate" on the map, "Sealed" on the plaque - for ten real minutes.

## GATE-CLEAR: the rock yields to the gate (1a)

`systems/gate/gateSite.js` keeps a gate off every location's neighbourhood and every spawned dungeon, and World of Daggerfall
stands a site on 114,087 of the pixels left - rock fields ~500 m across, mountains ~1.9 km, every model with its own
collider. Nothing kept the two apart. Measured over the shipped lists: of 6,000 of the gate's own spots (`gateSpotLocal`)
laid on the 146,446 pixels the lists name, **198 stood within 24 m of an object the mod stands** (a floor - a boulder's
mesh reaches further than its centre).

The gate does not move: its spot is a function of the day and the map files alone, so every client rolls the same one
(GATE-SEEN), where the mod's sites land with region packs fetched at their own pace. So the ROCK yields, ROADS-CLEAR's
shape (`world/gate/gateClearance.js`):

- **the clearing**: 24 m about the gate's foot - its plinth (8.2) and horns, the way home's landing (10), the Broker's
  post (~12.4), and the room to walk round them;
- **the pick**: a camp, fort, shrine, ruin, cave or nature spot whose objects (at the road test's 8 m site margin) reach
  the clearing is refused whole, after the road test - a `continue`, so a later instance may take the pixel;
- **the placement**: any other piece whose own mesh box reaches the clearing is not stood (no mesh, no collider), and a
  flat whose base is within it, with ROADS-CLEAR's 2 m;
- **which gate**: the one the clock is about (`gateAt`: from the last gate's collapse to this one's), off the omen's own
  scan and roll, so the land is clear some 85 real minutes before the omen names it; online alone (the gate is online's,
  and online the mod is the room's, forced on - every client that sees a gate stands the same rock and refuses the same
  pieces); read ONCE by each build, at its pick, and held to by its placements;
- **the turn**: when the gate the clock is about turns, the streamer's sweep (`sweepGateClear`, the late WoD sweep's
  shape - `createGateClearSweep` its decision) asks every built pixel once, between builds: one the old clearing cost a
  site or a piece is built again (the rock comes back), one standing a piece that reaches the new clearing is built again
  (the rock goes), any other is marked current; a pixel building across the turn is asked as it publishes.

A port departure from World of Daggerfall 1:1, on the mod's page (`03-World/World-Of-Daggerfall.md` GATE-CLEAR) and in
Ledger section A. Pinned in `test/world/gate/gateclear.test.js` (8), mutants `tools/mutants/gateclear.json` (23, all dead).
ROADS-CLEAR's site pin and record read the composed line now (`roadsclear.json` still all dead).

## GATE-COLLAPSE: the sealed hours count down to the collapse (1b)

Mac's call: *"Count down to collapse"* - the schedule stays, and the sealed hours say when they end.

- `gateCountdown`'s `closed` arm counts to the wrath (`{to: 'collapse'}`); `countdownWords` is the one home for "opens
  in", "seals in" and "collapses in". Collapsing - the wrath, or a kill inside - counts nothing.
- The map's label: *Oblivion Gate - sealed, collapses in 6:12*. The banner near the gate the same. The plaque:
  *Sealed* / *Collapses in 6:12*. A press on the sealed gate: *The gate has sealed. It collapses in 6:12.*
- The chat's seal line says when it goes: *The Oblivion Gate near Copperham has sealed. It collapses at 00:00 (14:52
  your time).*

`net/gate/gateLaw.js` is in the relay's bundle (SLAM13: the law is the whole import graph), so the words are a new relay law:
**world125** (no wire change), its row in `test/net/relayversion.test.js`, the fourteen pins of the current version moved
with it, disc7's list and soc1's S38 record. It rides the raids' own undeployed world124 deploy. Pinned in
`test/ui/wb1_gate_omen.test.js` and `test/world/gate/wb2_gate.test.js`; mutants `tools/mutants/gatecollapse.json` (9, all dead); SET7's
plaque record re-aimed by content.

## EVENT-TIP: the world's events answer a hover (Mac's tooltip)

Two kinds stand on the held map now, each answering the pointer with a CARD at the cursor (`ui/eventMapMarks.js`):

- **the gate's ring** - it marks an AREA, so anywhere inside it that is not a place's mark answers: *OBLIVION GATE* /
  *Near Copperham, Wrothgarian Mountains* / *Open - seals in 8:41* (or *Opens in*, *Sealed - collapses in*,
  *Collapsing*) / *Valkynaz Ruhn, Warden of the Burning Gate* (or *... has fallen*). The omen builds it
  (`systems/gate/gateOmen.js gateTip`, beside the label it already built), `readGateMark` carries it.
- **a town under attack** - NEW on the map: every raid RUNNING now (`raidActive`: begun, not withdrawn, not cleansed) at
  its town, a crimson ring about the town's mark with two blades crossed above it (`ui/ink/inkMap.js paintRaidMark`; a colour
  the sheet did not speak in), in the legend as *Town under attack*: *RAIDING PARTY* / *Gothway Garden, Daggerfall* /
  *Orcs attacking* / *12 of 20 driven off* (only once some deaths are known here) / *Withdraws at 12:00*. The host hands
  the map `raids` - `raidMapMarks` over `raidState()` on the raids' own clock, none while the mod is off.

The hover asks in the order the player means: a party member, a raided town, a place's mark, the gate's ring, the
province. The card stands beside the pointer, turned to the other side where the screen would cut it, never on the
pointer's way (`pointer-events: none`), in the pixel home's plaque language; it is rewritten only when its words change,
follows a STILL pointer on the map's own poll (a countdown's second, a town cleansed under it - the label with it), and
goes on leaving, on a press and when the sheet closes or changes. The classic region page is DFU's window: it keeps the
gate's ring and draws no raids and no card.

Pinned in `test/ui/eventtip.test.js` (7), mutants `tools/mutants/eventtip.json` (27, all dead). SEEN IN A REAL BROWSER:
`tools/heldMapProbe.mjs` section 8 mounts the map with the real producers (an omen on a turned clock, `raidMapMarks` over
a raid in `rollRaids`' own shape) and hovers them in Chromium - 7 checks, all passing: the raid's card and its words, the
card whole on the screen beside the pointer, the label line, the crimson ink on the sheet, the ring's card, the card
following the clock under a still pointer into the sealed hours, the card gone off every event. The probe's nine older
checks that fail (the painting is 1,648 px wide now where they expect 1,448; the stage, the thumb keying and the sea
ink that follow from it; the custom cursor; the I and H boxes) fail identically on the tree before this batch - they
are the probe's drift, not this batch's, and are left for the map's own next pass.

## THE FOLD: #414 into this branch (Mac: "fold in the raid PR")

The raids branch (`claude/unmerged-prs-review-5v3dof`, #414: RAID1-RAID4b, EM3-3D, CARD-FIT, AUDIT ONLINE world123 /
acct18, RAID-ROLL + AUDIT ONLINE 2 world124) merged whole at its head. 129 files conflicted, 256 hunks: 245 differed in
their cite numbers alone on comment lines - our side taken, then `tools/citeMerge.mjs --apply --struck` (498 moved); the
real ones by hand (the automap import both sides', main's record factory carrying the raids' `trail`, enhancedPorts'
imports both sides', the docs' both entries, the suite recounted, three SURVTIERS3 records and one overlayHover
continuation re-aimed). The merge commit says each. The raids' patch notes, which #414 still listed as to do, are not
written here.

**Deploys when this merges**: relay **world123** - the batch's world122-126, one relay past main's TV3 (the raids' world122-124 with GATE-COLLAPSE's words and DISCORD-GATES'
herald; every connected player is dropped once), account service **acct18** with migrations 0016 and 0017; `RAID_TOWNS_SHA256` in
`server/wrangler.toml` stays the operator's step (`node tools/raidTowns.mjs --arena2 <ARENA2>`).

## THE FOUR HOSTS

GATE-CLEAR: `scenes/world.js` alone - the one host that streams terrain and stands World of Daggerfall's wilderness
(the mod's page's own THE FOUR HOSTS: exterior.js flagged for the loader, worldModes.js and dungeonContext.js without
terrain), and the gate is online's, which is world.js's. GATE-COLLAPSE: the gate stands in world.js alone; its words are
the law's and the omen's. DISCORD-GATES: the hub posts; the game's word of the site is world.js's (its clearing's). EVENT-TIP: the held map is the world host's travel door; the fixed city (`?exterior`) mounts no
travel map at all (its own header says so); the building and the dungeon open the dungeon's own sheet, which answers no
card.

## DISCORD-GATES: the gates on Discord, live (2)

*"add a discord channel that tells the gates in real time itll create hype and make more join"* - Mac: *"Discord live
gates?"*. The relay's hub posts to a Discord channel's webhook (`net/gate/gateHerald.js`; the design and its words:
`11-Multiplayer/World-Bosses.md` "THE HERALD"):

- **the omen** at its own instant - fifteen real minutes before the gate opens - pinging the opt-in role (Mac: *"Ping
  an opt-in role"*, on the omen alone), its times in each reader's own clock;
- **the kill** when the gate's object tells the hub, with the court's top dealers and how many more fought - no ping.

The hub keeps no game data, so **the place is the players' word** (Mac, asked how posts should name it: *"What do you
need for discord"* - the recommended way taken): each online game says where it found the gate the clock is about
(`gate` `site`), and the hub names the place once two accounts agree; until then the post says *over the wilds*.
Nothing a player can type pings anyone or links anywhere (`allowed_mentions` is the one role; the place and the names
are plain letters).

**What the operator does, once** (nothing posts until then): make the channel's webhook (Edit Channel > Integrations >
Webhooks > New Webhook > Copy Webhook URL) and put it on the relay Worker as the SECRET `GATE_DISCORD_WEBHOOK` - the
dashboard's Settings > Variables and Secrets, or `npx wrangler secret put GATE_DISCORD_WEBHOOK` in `server/` (it
redeploys the Worker: every player dropped once); never in the repository or a chat. Make the opt-in role, turn on
*Allow anyone to @mention this role*, and its id (Developer Mode, right-click the role, Copy Role ID) goes in
`server/wrangler.toml` as `GATE_DISCORD_ROLE`.

Relay **world123** (world126 on its branch, renumbered at the merge with main). Pinned in `test/net/gate/discordgates.test.js` (11), mutants `tools/mutants/discordgates.json` (45, all
dead).
