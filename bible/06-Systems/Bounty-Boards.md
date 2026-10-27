# BOUNTY BOARDS - the town's hunts (BOUNTY1, the record)

**Status: BOUNTY1 SHIPPED on the branch (2026-09-28) - both lanes; the party's half online from `world122`, its
AUDIT 28 fixes from `world123` (section 11) - both `world125` since the merge of main, whose TV3, THE MERGE and TV8 took
`world122`-`world124` first; neither number was deployed.** Built
under Mac's direction in its own lane and handed over as two archives ("Continue, I also want to fit these in since
they're specifically made for our codebase"); taken in and audited the same day (section 9). A Ledger A departure
(`01-Overview/Port-Ledger.md` section A, THE TOWN'S BOUNTY BOARDS). Not a DFU member and not a mod's port: the
port's own.

Marks, as the other records here: **DECIDED (Mac)**, **DECIDED** (the record's, at Mac's instruction), **FACT** (read
in this tree), **MEASURED**.

## Mac's words

Each is quoted where the code keeps it, beside the line it decided.

- The ask: **"Cities in this game have always 2 Bulletin Boards can we make it so that one of the two when opened
  gives a quest screen in Enhanced Plus UI look"**, then **"always the half of the bounty boards in every city should
  share the same quests"** and **"all players see the same boardquests and it should be shareable"**.
- The ground: **"make it 4-10 pixel around the city"** (it was 1-4); **"Dungeon bounties (notices name a nearby
  dungeon)"**; **"the pack must be smaller in dungeons 2-4"**.
- The purse and the piece: **"when the needed kills are only 4 it should give less money"**; **"an random item in
  white for players with medium durabilty lvl 1-3, 4-5 white better durabily and 6-10 full durability then with 11-14
  it should start given randomly white and blue items. Not more. And thats it till max level."**, then **"let start the
  blue items 50/50 chance at lvl 4"**.
- The map: **"board quests can be a green circle"**, then **"make the circles black green area already players on the
  map"**.
- The journal: **"i also dont see the bounty in my questlog means i cant abandon it?"**
- Two groups: **"if its 6 to 8 monster you gotta kill, can you make 2 groups out of it and give another clue where
  the group is when the first group is killed?"**
- The farms: **"can you spawn some farmhouses there it says the granary is overrun? the thing is how do those
  farmhouses despawn again"**, **"the house was on hill side stuck into a ground i was able to almost only see its
  roof, no fences"**, **"Pick from several farms ... Yes this sounds good"**.
- Underground: **"one of my quests turned into a graveyard dungeon quest where i had to kill spiders, sadly no spider
  where to be found"** (the hunt was asleep below - it ticks in the modal arm now).
- The tiers: **"Higher level players cant share their quest with lower level players ONLY when in the same tier. They
  should be still able to help"**, **"he prob gets a notifiaction that the one he wants to share to is too low
  level"**, **"can the quests also show which tier they are and what levels are put in the tier"**.
- A beast that wants silver stays on the board: the server runs without that rule (Mac).

## 1. The board

- **Half of a town's boards are its bounty boards** (`systems/bounty/bountyBoard.js` questBoardIndices). FACT: a town's blocks
  place its bulletin boards (`BULLETIN_BOARD_MODEL_ID`, `world/rmbLayout.js`). The boards are sorted by position (x,
  then z, then y) and every other one is taken, from the first: two give one, four give two, five give two. A town with
  one board keeps it for DFU's rumour. Every client picks the same half, whatever order its blocks were laid.
- **It names itself** "Bounty Board" on hover (`scenes/worldModes.js`); DFU's is "Bulletin Board". Its press opens
  the board window (`ui/bounty/bountyWindow.js` through `ui/bounty/bountyDoor.js`) in the Enhanced Plus stone and brass on every
  skin - the window lays its own sheet on the classic skins, the Broker's precedent. The other boards open DFU's
  rumour exactly as before (`systems/bulletinBoard.js`; the ROAD A9 pins hold).
  SPAM-TAKE (`01-Overview/bugs/Field-Bugs-2026-10-10.md`): a take moves the window's card on to the next open notice, so
  Take pressed again and again takes the four in order; the last take's card asks a pick before it offers a press (in a
  party, Share stood under the cursor); Give up asks twice and stands at the card's left; the window is one height.
- **Every bounty board of a town posts the SAME four hunts**, and every player reads the same four. A posting is a
  pure function of (the day, the town's pixel, the slot): where it is, which of its tier's beasts, how many, which
  story, who pinned it. The notices turn over each game day.
- **The reader brings the tier.** A level 2 hunter reads "Rats" where a level 12 reads "Giants" on the same notice,
  at the same spot. A bounty taken carries the taker's level in its id (`day.px.py.slot.level`), so a party mate it is
  shared with hunts the same pack for the same purse.

## 2. The ladder

| Tier | Levels | Beasts (ENEMY_BASICS ids) | A full pack of 8 pays |
|---|---|---|---|
| 1 | 1-3 | Rats, Giant Bats, Spiders (0, 3, 6) | 50 |
| 2 | 4-5 | Grizzly Bears, Sabretooth Tigers, Orcs (4, 5, 7) | 75 |
| 3 | 6-10 | Centaurs, Orc Sergeants, Harpies, Skeletal Warriors, Zombies (8, 12, 13, 15, 17) | 90 |
| 4 | 11-14 | Giants, Mummies, Giant Scorpions, Orc Shamans (16, 19, 20, 21) | 100 |
| 5 | 15+ | Gargoyles, Wraiths, Orc Warlords, Daedroths (22, 23, 24, 27) | 190-200 |

- **The purse** (BOUNTY-PURSE): tiers 1-4 pay the full purse times 0.6 + 0.1 a beast past four - a pack of 4 pays six
  tenths. Tier 5 pays 150 + 10 a beast past four + up to 10 for the beast's rank in its list. A dungeon's pack of 2, 3
  or 4 pays as an open pack of 4, 6 or 8 - its halls are close, not easier.
- **The piece** (`systems/bounty/bountyReward.js`): one weapon or armour piece, never ammunition. Levels 1-3 white at half
  condition; 4-5 three-quarter condition; 6 and up full condition; from level 4 a coin for Magic (blue) through the
  loot ladder's own applyRarity - never higher, and white when Loot Rarity is off.
- **The werebeasts are off the board**: a bounty is not a way to catch a curse.

## 3. Where

- **The ring**: an open-ground notice names a map pixel 4 to 10 out from the town (Chebyshev) that is land (the height
  bytes' sea test, as the gate's scan reads it), holds none of the game's OWN locations (never a mod's row - it stands
  on one client and not another) and no spawned dungeon. Four slots, four different pixels where the ground allows.
- **Dungeon bounties**: a real dungeon of the game's own 4 to 10 out (never a town's) sends slot 3 underground; two
  send slots 2 and 3, to two different dungeons. The pack is 2 to 4, and lairs at one of the dungeon's QUEST SPAWN
  MARKERS 25 to 90 metres from the hunter (the farthest when none is in that band) - where Daggerfall stands every
  dungeon quest's foe (199.11, EnumerateDungeonQuestMarkers; `systems/quest/place.js` dungeonQuestSpawnSpots) - and at
  one of its own foes' places only in a dungeon with none; stood through the dungeon's own chain (`spawnLooseFoe`, so it
  rides the room's lane online). Slots 0 and 1 always hunt the open ground. BOUNTY-LAIR (FIELD BUGS 2026-09-29h,
  Skibbster: "Bounty targets can spawn in inaccessible parts of dungeons"): the lair was any foe's place, and a foe
  stands at every enemy marker of every block - sealed rooms, water, the far side of a held door.
- **The map**: a held bounty's pixel is a BLACK circle on both maps (`ui/bounty/bountyMapMark.js`; the held map's ink,
  `ui/ink/inkMap.js` paintBountyRing; the classic region page's texels) - black because green is the party's.

## 4. A hunt, start to end (`scenes/bountyHost.js`)

1. **Taken** at the board: at most 4 held; each lapses 24 game hours after it was taken; a slot claimed today is not
   posted to that hunter again today.
2. **Stood** the first time the hunter stands on its pixel in the open (or inside its dungeon): 4 to 8 of ONE beast,
   60 to 110 metres out on a random bearing, and a line names how far and which way. The open-ground pack stands
   through the camp's own stand (the world host's `_standCampEncounter` - one home for a group in the wilderness:
   the anchor on the terrain's floor, off roads, out of town rects and the sea, never inside a rock - BOUNTY-ROCK, FIELD
   BUGS 2026-10-03: the collider's point-in-solid over every spot, the trail's and the farm's too - the camp's 60 m sight, one camp id so
   one member's alarm wakes the rest and they spare each other), fixed at the posting's count, `loose` (a board's
   hunt is not the encounter roll's to refuse) and `transient` (never saved).
3. **Counted** as corpses fall - a beast culled (walked 200 m from) or lost to a reload is no kill, and only what is
   left stands again.
4. **Two groups** (BOUNTY-TRAIL): an open pack of 6 to 8 is hunted as the first half (rounded up), then the rest at a
   spot of its own on the same pixel - the same spot for every holder of that hunt - stood once the hunter is within
   150 metres; the line names the way ("You find tracks leading away from the bodies...") and the journal keeps it.
   Which group stands is read off the kills alone - the PARTY's kills, since AUDIT 28 (each holder's pose carries its
   `k`, section 6), so a hunt handed to another holder goes on from where it stood.
5. **Paid** on the last kill: gold into the purse, the piece into the pack, and the payday notice (the story, then the
   reward in plain words) that holds the game until it is read - queued while ANY window holds the screen or a death
   screen is up, and put back in the queue if it is taken down unread (AUDIT 28 H12), never dropped.
6. **In the journal** (BOUNTY1's journal ask): a held bounty rides the quest log as a side quest with its clock, in
   the pause window's Quests tab and the Chronicle - the notice, the kills, the place, the purse; **Abandon** (pressed
   twice - an armed Abandon never outlives the window's visit, AUDIT 28 B11) and, in a party, **Share**
   (`systems/bounty/bountyJournal.js`, a leaf the lazy journal chunks reach without a cycle). Given up and taken again the same
   day, a bounty goes on from its kills and its live beasts are the hunt's again - never a fresh pack (AUDIT 28 B2).

## 5. The farms (BOUNTY-FARM, `scenes/bountyFarms.js`)

A notice whose words name a farm (granary, orchard, harvest, cattle, shepherd) stands a real Daggerfall farmstead on
its pixel: the first RMB block of one of the 8 game-owned HomeFarms locations nearest the hunt, the notice's pick,
climate-dressed by the pixel it stands on, solid (its own collider bucket). The spot is the flattest of sixteen rolls
clear of roads, the sea and towns and of any farm that already stands (AUDIT 28 B13 - two notices on one pixel stood two
farms in one another), and each model sits on the ground under itself. The first group waits in the
farmyard, 10 to 18 metres from the farmhouse, and stands within 150 metres.

- **The way to it is kept** (RPT1026-QUESTS BOUNTY-WAY, 2026-10-27, a private report of an orchard hunt whose rats
  never showed). Driven in the real game on the freeware's data - a board's orchard hunt held, the hunter walked onto
  its pixel: the farm stood 330 to 350 metres from where the hunter came onto the pixel, the way was said once on the
  screen in the same few seconds as the arrival's own lines (the season, the needs, the family seat), and the four rats
  stood once the hunter walked it. The way was kept in the journal for a split hunt alone (section 4's BOUNTY-TRAIL
  lines), so on a hunt of one group a hunter who missed the line stood on the right pixel with nothing to go on and no
  rat within 150 metres. Now the journal keeps the last way named for every hunt whose group waits at its spot - a
  farm's first group as a split hunt's second (`scenes/bountyHost.js` questLogEntries). The tutorial's Bounties page said
  to return for the gold, which no hunt asks (the last kill pays); it now says where a hunt is found - the middle of its
  black circle, or the dungeon it names - and that the Quests tab keeps the way (`systems/tutorialCatalogue.js`; its
  words English, as every page's - the old ones held "return", which `tools/l10nHardcoded.mjs` reads as code, so the
  ratchet counts the page once more). The port's own, Ledger A (THE TOWN'S BOUNTY BOARDS).

- **Seen by its holders and by every member of their party** - a mate's farm stands for the whole party, whether or
  not they took the notice (they may help), never for a passer-by. One farm a NOTICE. (AUDIT 28 corrected "seen by its
  holders", which understated it.) A split hunt's second group never waits among a standing farm's buildings.
- **Never saved or sent**: down when its pixel unloads and stood again on return; once the bounty ends it stays until
  the hunter is 200 metres off, so it never vanishes under the eyes; a fast travel, a dungeon, a building or a load
  takes every farm down.

## 6. The party (online)

- **The pose** (`net/wire.js` validPartyPose, `world122`; `world123` since AUDIT 28; `world125` since the merge of main): `bq` - my bounties, at most 8
  rows of {i: the id, s: 1 shared, c: 1 cleared, k: the hunt's kills, a: 1 its pack stands on my machine, t: the minute
  a cleared row was paid}, a row out of its law dropped, cleared rows newest first (AUDIT 28 B7: the oldest were kept
  and today's cut) - and `lv`, my level (1..99). A relay before `world125` (`world123` on the branch) strips `k`, `a` and `t`: a clear then pays
  nobody else, and nothing breaks.
- **Share within a tier alone**: a shared bounty is taken up by every mate in its tier with a free slot; a mate in
  another tier is told why (and the sharer is told who), and may still help - they see the beasts and the farm, and
  are not paid for a bounty they cannot hold. **Join the hunt** on the board offers only hunts in the reader's tier. A
  share taken up and a hunt joined are the taker's own, rebuilt at the taker's level - the same hunt, and the piece it
  pays minted for the taker (AUDIT 28 B12: a level 6 got a mate's level-10 kit).
- **One pack a hunt**: holders of one notice in one tier are one hunt, whatever their levels inside it. A mate whose
  pack for it STANDS owns it, wherever they are (their row's `a`); else the lowest living, online account among the
  holders on its pixel - the pixel as the poses say it, underground too - stands it, and the rest fight its puppets
  (bountyPackOwner - one answer on every client). AUDIT 28 B3: by the lowest account alone, a holder arriving after
  the pack stood stood a second, one who stepped off the pixel handed the hunt to a mate who stood another, and a mate
  gone offline or dead on the pixel held it from everyone. The hunt's kills are the party's (B4): each holder takes
  the most any of them reports, so an owner who falls or walks off hands on a hunt part done. Two tiers on one notice
  are two hunts.
- **A mate's clear pays every holder of that hunt who held it BEFORE the clear** (a row's `t` against the holder's
  take - AUDIT 28 B1: taken after a mate's clear, a bounty paid on the next tick with no kill; now the board refuses a
  hunt the party has cleared - "Your party has already claimed this bounty today."). TRUST, FLAGGED by name: the clear is a peer's word (`c: 1`) and
  its pay is gold and a piece into the SAVE, which is the client's as online gold always is ("The GOLD is the
  client's, the economy being the save's" - GUILD1); a modified client can pay its own party, never a stranger, and
  nothing a server holds (no Mark) is paid. The same trust as a shared quest's.

## 7. The save

`systems/modSaveData.js`'s per-mod slot, vendor `bountyBoard`: the held rows (id, when taken, kills, shared, from
whom), the slots paid and given up (pruned past yesterday), when each was paid and what each given up had killed
(AUDIT 28), and today's paid ids for the pose. Read defensively: a row out of its law is dropped. An open-ground pack is
never saved (`transient`); a DUNGEON pack is - the dungeon's save carries every loose foe - so a load that still holds
the bounty keeps the pack it finds standing rather than stand a second beside it (AUDIT 28 B6: "a pack is never saved"
was false underground, and a same-dungeon quickload doubled it). Its kills are on the row. A bounty taken on another
clock (an offline save played online) runs from now (B10). The ways already named are named again after a load (B9).

## 8. The four hosts and the two lanes

- **The streaming world** (`scenes/world.js`) is the bounty boards' host: the boards, the packs above and below, the
  farms, the maps, the journal wrap and the pose. The bounty tick runs in the modal arm too, so a dungeon's hunt is
  awake and a purse earned indoors is told indoors.
- **The fixed city** (`scenes/exterior.js`) keeps DFU's board on every board (it hands the shared mode machine no
  `openBountyBoard` and its boxes carry no `bounty`); **the standalone dungeon** and **the interior viewer** have no
  boards and hold no bounties.
- **Both lanes**: offline a town's bounty boards post the same hunts and pay the same purse; online adds the party.

## 9. The integration (AUDIT BOUNTY1, 2026-09-28)

The archives were whole files against `main` at `59f731bf8` (the Sigil Stones merge), the second the first plus the
death penalty (`06-Systems/Online-Arc.md` DEATH-PENALTY). This branch took main in first, then the archive's diff
three ways; `world.js` merged clean. Read line by line, and run against the whole suite: 25 tests failed on it here -
line cites its growth moved and counts the bible keeps (the ordinary cost of any slice), and seven pins its edits
broke, which the whole suite on its own base would have shown. What was paid:

- **B1 - the notice stood over an indoor window.** It waited for the street's overlay slot alone, so a mate's clear
  landing while a shop or the pack was open indoors raised it on top. It waits for `modes.overlayHeld` too.
- **B2 - a second copy of the camp stand.** The bounty pack copied the member law, so CAMP-SIGHT ("set once, in the
  camp stand only") and PSCALE1 COUNT-3 counted two. It stands through `_standCampEncounter` now, which learnt three
  things: a `fixed` group is never grown by the party (the purse and the tally are the posting's), `spawnOpts` ride
  each member's stand, and it answers what it stood.
- **B3 - words that no longer said the law**: the ring "one to four pixels" and blue "from level 11" in three headers
  (4-10 and level 4 since Mac's changes).
- **B4 - the relay pins credited ONE-SEAT** with `world122`'s move; they say BOUNTY1 now.
- **The type check**, which the archive had not passed: a comment line inside the host's deps type broke its JSDoc,
  so the whole type went unread; the posting's and the rebuild's `dungeons`, the pose rows' `c`, the share's `shut`,
  the farm pick's pairs and the `far` answer were typed. No behaviour moved.
- **On the way, a leak of FORAGE3's own**: its test reset left Foraging's loot subscribers registered, so one pin failed
  a run in three (`06-Systems/Foraging.md` FORAGE3). Mended at its root; not the archive's.
- **Pins the archive broke, each kept whole**: the hub rows' one line (HUB1), the modal arm's HCC order and the
  draw's (HCC hosts), the teleport's camps hold (SURV-TIERS 3), the camp import (CAMP1, which now names the pack's
  two constants), RISE-STUCK's respawn chain (which now allows the death line); five mutant records re-aimed by
  content, each proven dead. Import comments the archive had shuffled onto the wrong lines were put back; an unused
  import was dropped.

## 10. Pins

`test/systems/bounty1.test.js` (17, the archive's) - the ladder, the board every client reads, the half, a hunt Take to
payday, the party, the wire, the circle, the dungeons, the farms, the journal, the two groups, the tiers.
`test/systems/auditbounty1.test.js` (5) - B1 to B4, and the wiring (the press, the plaque, the host alone).
`tools/mutants/bounty1.json` - 25 mutations (the bounties' 20 and DEATH-PENALTY's 5), 25 dead.
`test/scenes/audit28_bounty.test.js` (12) - section 11; `tools/mutants/audit28.json` B1-B13, dead.
`test/systems/quest/rpt1026_quests.test.js` (2, BOUNTY-WAY) - a farm hunt of one group, its way said once and kept in
the journal, walked, stood and paid at the last kill; the tutorial's page. `tools/mutants/rpt1026_quests.json` - 2, dead.

## 11. AUDIT 28 (2026-09-28, Mac: "let's audit everything we have so far before we continue")

The bounty boards' and the death penalty's lens of the branch's audit (`06-Systems/Online-Arc.md` AUDIT 28), fourteen
findings, each fixed and recorded where the section above says it: B1 a clear pays only a bounty held before it, and
the board refuses a cleared hunt; B2 a retake goes on from its kills and re-adopts its beasts; B3 one pack a party -
a standing pack owns the hunt, the gone and the dead own nothing; B4 the hunt's kills are the party's; B5 the respawn
takes what the death screen said, a Resurrect takes nothing, and the fixed city and the standalone dungeon show no loss
(`06-Systems/Online-Arc.md` DEATH-PENALTY); B6 a load keeps a standing dungeon pack; B7 the pose sends the newest clears
first; B8 underground the owner is asked on the pose's pixel (a pin caught the host handing the rule `{x, y}` where it
reads `{px, py}` - the type check found it, a behavioural pin holds it); B9 the ways are named again after a load; B10
a bounty taken on another clock runs from now; B11 the board keeps the keyboard's place through its repaint, and an
armed Abandon never outlives its visit; B12 a mate's copy taken up is rebuilt at the taker's level; B13 a farm never
stands on a farm, nor a trail spot among its buildings; B14 the claims above corrected (the farm's viewers, "1 coin"
never "a coin", the four lines). The relay moves to `world123`.

## 12. HUNTERS-MARK and MARKS-OF-MASTERY - the hunt's ledger, its rank and its sideways rewards (BUILT 2026-10-27)

A player's feedback, handed on by the owner ("build all of it with autonomy and be as detailed as possible. No
exceptions and no band aids"): *"The horizontal MMO approach was working really well imo ... Add more horizontal
progression please!"* Until this a bounty had no progression of its own. **DECIDED**: the account service keeps a
ledger of the hunt, a rank per character is read off it, and its rewards are sideways - titles, a weekly named beast, a
mounted trophy and a little seat influence. The bounty's piece keeps Mac's ceiling ("Not more. And thats it till max
level."). The port's own: DFU has no bounty boards (Port-Ledger section A, THE TOWN'S BOUNTY BOARDS).

### 12.1 The ledger (`server-account/src/hunts.js`, migration 0181)

`/v1/hunt/clear` takes `{ character, id, region? }`; `/v1/hunt/state` answers `{ clears, marks, markDone, regions,
account }`. A row is keyed by account, character, kind and key: a board notice's slot (`bountySlotKey`), so one notice
counts once a character at whatever level it was taken, or a named mark's week (`m.<week>`). A repeat is answered
`repeat`, never refused.

**A clear is the client's word: bounded, named, not closed**, as Renown's report is (`renownTracks.js`). The service
checks the id's shape (`day.px.py.slot.level`, or `m.week.px.py.level`); the event clock's window (a notice of the last
12 game days up to tomorrow's, a mark of this week or the last - `huntLaw.js` huntClearOf); the level at most two past
the level the realm trusts (`realm_characters.level_seen`) and its tier at most one below (huntTierFits); and the
account's UTC day, every character's together, under 750 clears (HUNT_CLEARS_DAY_MAX, measured - 12.10), decided in the
INSERT. A modified client can report the day's ceiling and no more.

The route is a progression claim of the seat
(`progress.js` PROGRESS_ROUTES): the `bounty` stream, spent by a recorded clear alone. The stream is a seat's Bounty
camps' too (the staff config holds the streams' set fixed); an enforced line refuses a clear as `progress-play`, which
the book keeps and asks again.

### 12.2 The book (`src/net/huntBook.js`)

The bounty host reports every bounty it pays, with its board's region (`scenes/bountyHost.js` pay, through
`scenes/huntersMark.js` cleared). Each report is kept in the device's storage, by account and character, until the
service answers it, and asked again on the pump's beat, as the professions book keeps its acts. A refusal for good
(`hunt-tier`, `hunt-id`) lets it go; a lost network, a seat this tab does not hold, a rate or no session on the device
keeps it (HUNT_KEEP). An account's full day keeps it until the service's UTC day turns (12.10). A report past the
clock's window is never kept. The state is read again every two minutes, and its answer redraws an open board.

### 12.3 The rank

Six rungs, a character's board clears each (HUNT_RUNGS): Unblooded 0, Tracker 5, Hunter 15, Stalker 40, Slayer 100,
Huntmaster 250. The board's header shows the rung and the clears, this region's tally, a bar to the next rung and the
reports still to count (`ui/bounty/huntRank.js` rankLine). The Standing page shows the same at its foot, with the named
beasts slain and the account's way to its next hunt title (statsHunt). Offline neither shows: the rank is the service's.
A guest's account keeps none: both say "Only a registered account keeps a hunter's rank." (12.10).

### 12.4 The named mark (`src/scenes/huntersMark.js`)

From Stalker, every board posts its reader the week's named beast, first in its list. It is one beast of the reader's
tier, the same at every board for the week (huntMarkOf: the beast and one of sixteen names off the week's hash), on
one of the board's own sites. Taken, it stands at its pixel through the board's pack stand: one elite, named over its
head (`raidLeader`), with the week's two boss traits (`05-Combat/Boss-Traits.md`) in place of any its stand drew as an
elite (HUNTERS-MARK-II, a raid's leader's law). Slain, it pays three full
packs' purse of its tier (huntMarkGold) and a mounted trophy under its name, never kit. Its clear is reported as a
board's; the service takes one a week a character, and only from the rung (`hunt-rung`). One is held at a time, Give
up asks twice, and a mark held past the seats' Turning lapses.

**A mate sees it named** (HUNTERS-MARK-II, 2026-10-27; it closes 12.8's FLAGGED line). A mark is a pure function of the
week and the tier, so a mate's machine reads it off what the hunter's foe record already carries (`net/wire.js`
validFoeRecord): an elite (`z`) and a leader (`rl`) that no raid tags (the frame's `rz`), of a kind that is its tier's
mark this week or last, with that week's traits' mask (`bt`). That copy stands under the hunter's own title, with the
same two traits at the same size (`systems/hunt/namedMark.js` huntMarkSeen, read where `scenes/exteriorFoes.js` names a
puppet's leader, on the event clock). Last week's still reads because a mark stood before the Turning still stands after
it: its hunt lapses, the beast stays. This week's is read first. The wire, the relay and the service are unchanged.

**DECIDED**: anyone who sees the mark reads its name, a passer-by as well as a mate. The cell's stream reaches the
whole cell, the elite and its traits were everyone's to see already, and the name is the week's own, posted on every
board. Only "Unquiet" before its title stays the hunter's own, as on any special foe (`06-Systems/Revenants.md` section 46).

**What a mate gets** (kept, not changed). The mark rides no pose: `bq` carries a bounty's id alone (`wire.js`
BOUNTY_POSE_ID_RE), so no mate holds a share of it. The hunter's machine counts the kill, whoever lands it: only the
hunter is paid (the purse and the trophy), and only the hunter's clear is reported. A mate who fought it gets what
fighting a party mate's bounty beast gives one who does not hold the hunt: the kill's Renown if a blow of theirs
landed in its last half minute, the party bonus counting who fought it (`net/renownTracker.js`), and a claim on its
body as on any peer's foe (OUTDOOR-LOOT). No purse, no trophy, no clear, no rank.

**A mark is never kit, held** (at the merge): a stand that rolled the mark an elite had laid an elite's drop on its
body beside its kind's. `systems/eliteFoes.js` grantEliteLoot keeps what each elite roll laid, and the mark's crown takes
exactly that back (`huntersMark.js` crown, `eliteFoes.js` withdrawEliteLoot) - bootWorld's stand untouched. Pinned in
`huntersmark2_wire.test.js`.

**NOT CHANGED, named**: two mates who took the same week's mark at one board each stand their own copy at its lair, and
each is paid for their own; a board's one-pack law (section 6) is not the mark's.

### 12.5 The mounted trophy

Template 601 (`src/net/trophyLaw.js`; Professions-Arc 4.8), group UselessItems2, worth 40 at a counter. Its `message`
is its beast and its `variant` a mark's name. Its pack picture is the beast's own front frame from the player's data. In
a home it hangs as a mount of its own (`decorLaw.js` decorIsTrophy): a shield of dark wood with a brass plate, drawn in
code, with that frame fitted on it and uploaded under its own key at runtime (`scenes/decor/trophyArt.js`). Nothing of
ARENA2 is kept in the tree (Port-Doctrine's non-negotiables). A visitor reads its name off its numbers. Hunting 100's
Trophy Hunter is built with it (`06-Systems/Professions-Arc.md` section 58).

### 12.6 A seat's influence (migration 0182)

A recorded clear on a board of a region where the hunter's war-guild pledged counts 25 as the `hunt` source, at most 250
an account a week (`townSeatLaw.js` HUNT_INFLUENCE, HUNT_WEEK_CAP; `seatInfluence.js` creditHunt), inside the account's
whole weekly cap: an Orc Raid's camps' weight, modest and bounded like the clears. Migration 0182 widens
`town_seat_influence`'s source check to take it. The table's row is `11-Multiplayer/Seats-Arc.md` section 4.2.

### 12.7 The Marks of Mastery

Titles derived at every ask from what the service keeps, never stored (`hunts.js` masteryMarksRead, `titles.js`):
Bloodhound, Beastbane, Grand Huntsman and Legend of the Hunt at 25, 100, 300 and 750 board clears of all the account's
characters; a profession's Master (Master Miner to Master Enchanter, ten) while a living realm character of the account
holds the track at rank 100; Serpent Hunter and Bane of the Deep at 10 and 40 Sea Serpents the account helped slay (the
relay's receipts, `serpent_kills`). They are held on the wardrobe, worn, signed into the token and shown on the boards'
names, a letter's sender and a notice-board note's author (12.10). A guest holds none.

Sailing's other records are kept by the client or swept (a captain's level, a crown's standing, the sea season, wrecks
after two hours, sea kills after the wanted days), so they earn no title. No sailing term joins a seat's influence: a
serpent names no seat's region, and a port's trade the Watch vouches for already counts there.

### 12.8 The four hosts

**The streaming world** (`scenes/world.js`) wires it: the hunt's online deps (`huntersMark.js` huntOnline), the trophy
door for the hunt's kind (`trophies.js` trophyDoor), and the gather host hands its entity to a kind's answer; bootWorld
does not grow. **The fixed city** (`scenes/exterior.js`) keeps DFU's board: no rank and no marks there, **FLAGGED**.
**The standalone dungeon** and **the interior viewer** have no boards. A mate sees the hunter's mark under its name
(HUNTERS-MARK-II, 12.4): the foe pool the hosts share reads it (`scenes/exteriorFoes.js`), so the streaming world
carries it and bootWorld wires nothing; an interior's pool (`scenes/worldModes.js`) reads alike, and no mark stands
indoors; a dungeon's own stream (`scenes/dungeonContext.js`) has none to read, as no mark stands below; the fixed city
streams no peer's foes. Offline none of it shows.

### 12.9 Pins

`test/server/huntersmark_service.test.js` (6), `test/scenes/huntersmark_client.test.js` (5),
`test/systems/huntersmark_trophies.test.js` (5), `test/tooling/huntpace.test.js` (2, the second on the game's data);
`tools/mutants/huntersmark.json`. PIN MOVED: TITLES' positions read
from its end (sixteen joined last), the catalogue's rows, the Collections parts' lists, the l10n ratchet's badge words,
the Trophy Hunter's spec (no longer waiting). Fifteen mutant records of other slices re-aimed by content.

HUNTERS-MARK-II: `test/scenes/huntersmark2_wire.test.js` (3) - the law, and the whole way between two real pools (the
real bounty host's mark crowned, its frame read, only the hunter paid, the mate's Renown); `tools/mutants/huntersmark2.json`,
13, dead. No pin moved. `auditwe_cover.json`'s puppet-leader record re-aimed by content (the line now reads a mark too),
dead. No version moves.

**The versions** (at the merge onto the wardrobe's branch): ACCOUNT_VERSION acct203 (acct201 before JEWEL-KIN,
acct202 before FIELD BUGS 2026-10-26r), its migrations 0181 and 0182 (0178 and 0179, then 0180 and 0181, on its branch). RELAY_VERSION world273 (world271 before MASTER-THREE,
world272 before FIELD BUGS 2026-10-26r): the token's TITLES gained sixteen, the bundle's files unchanged.
Either side may deploy first: a service without the routes leaves the book keeping its clears.

### 12.10 AUDIT HORIZONTAL, lane F (2026-10-27, the owner: "Audit this")

**AUDIT HORIZONTAL F3: the day's ceiling, measured.** It was 48, "four held, twelve game days a real day". Four held is
not four cleared: a hunter clears, rides on and takes four more, and all 410 cities carry a bounty board. `tools/huntPace.mjs`
walks the game's map (ARENA2): each board's notices where it posts them, in their shortest order, at the fastest legal ride
(Speed 100, Running's top with every buff, the swiftest horse, Fleetfoot III: 34.6 m/s), no time fighting, the next board
the cheapest a clear - ridden to, or by the carriage at the nearest city's gate (Immersive Travel's driver stands at every
one). MEASURED over fourteen UTC days from 2026-10-27: the best day 677 to 706 clears; without the carriage 380 to 394.
HUNT_CLEARS_DAY_MAX is 706 rounded up to the next fifty, 750.

**What it still bounds (named, not closed).** No honest day reaches 750, so the ceiling bounds a modified client alone:
it can report 750 a day - Huntmaster's 250 and Legend of the Hunt's 750 in one. The play-hour line's `bounty`
stream (`Integrity-Arc.md` INT17) bounds the pace an hour of play once staff enforce it.

**A full day waits (F3).** `day-full` is no refusal. The book (`net/huntBook.js` pump) keeps every report of the slot,
marked with the service's UTC day (the state's `account.day`), asks none again that day, and asks them once the day has
turned - each while its notice is inside the clock's window; one that leaves the window first is let go. A report made
while the day is full waits with them, unasked. The board's "still to count" counts them.

**F1, F2, F6: pinned.** The day is the account's, every character's rows together (a second character's rows fill it);
`markDone` is this week's mark, never last week's; a seat's influence counts once a clear, never once a character.

**F4: a guest.** A guest seated in the realm is answered `hunt-need-account`. The book takes it as final (`closed`),
keeps no report and asks again every five minutes (HUNT_CLOSED_MS, so a registration opens it); the board's header and
the Standing page say the refusal's own line once. The Standing page asks on the book's beat, never once a draw.

**F7.** No session on the device (`no-session`) keeps a report, as the professions book keeps its acts.

**F10: a mark's rung as its week ended.** The rung is the board clears recorded before the mark's week ended
(`hunts.js` huntClear), in the write and in the refusal's read: a character that became a Stalker this week takes this
week's mark, never last week's.

**F5: a worn Mark of Mastery on letters and notes.** The inbox, a letter opened and a board's notes lay the Marks of
Mastery as the boards' names do (`letters.js`, `board.js`, `hunts.js` withMasteryMarksAll). NOT CHANGED, named: a seat's
Charter titles and a chapter's titles are blank on letters, notes and the boards' names alike. Their readers are one
account's at a time (`seatTurning.js` seatTitlesOf, `npcChapters.js` chapterTitlesOfAccount - five reads); laying them
there is a batch reader each, those slices' own.

**Lane F's suspected items.** REPRODUCED and fixed: a profession's track whose character no realm row stands for (one
written under an offline id before INT16's seat) counted as a living Master. A Master is a realm character alive now, as
the crafting writs read it (`craftWrits.js` ranksOf), alone and in a batch. MEASURED and bounded: the Marks of Mastery's
clears read visited every hunt row of the account on each mint, wardrobe read and board row (SQLite's steps grew with
the rows: 5,000 at 1,000 clears, 250,000 at 50,000). It stops at the top title's 750 now (`hunts.js` CLEARS_READ),
flat past it. NOT CHANGED, named: the hunter's own state read (`huntStateOf`, every two minutes on an open board and each
clear) counts the character's and the account's rows whole; a counter is a migration this lane was not given.

**F8 and G3: the record's numbers.** `11-Multiplayer/Seats-Arc.md` 4.2's row names migration 0182; the Trophy Hunter's
cites in the code name `Professions-Arc.md` section 58. **G4**: 12.9's HUNTERS-MARK-II counts; `accountworker.test.js`
names `crew_signed` and `hunt_clears` beside the tables it pins. **G9**: HUNT_INFLUENCE 25 and HUNT_WEEK_CAP 250 are
pinned as the record says them.

**G6: a mark's traits, named.** The card read "It is Warded and Flameproof." - a title's words glued into an adjective's
sentence in every language. It reads "Its traits: Flameproof and Warded." (`hunt.mark.traitsList`), the names listed in
the reader's language (Intl.ListFormat, as `gambitTableWords.js` lists); `hunt.mark.traits` and `hunt.mark.and` are gone.

Pins: the tests and mutant records above, each named for its finding (`AUDIT-F*`, `AUDIT-G*` in
`tools/mutants/huntersmark.json`). PIN MOVED: the ceiling's 48 (the law's test), the traits' line (the window's test),
six records of this slice re-aimed by content; `mail1.test.js`'s D1 harness gained D1's own `batch`. The account service changed (ACCOUNT_VERSION at the merge); the relay
and the wire did not.
