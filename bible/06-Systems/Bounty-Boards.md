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

- **Half of a town's boards are its bounty boards** (`systems/bountyBoard.js` questBoardIndices). FACT: a town's blocks
  place its bulletin boards (`BULLETIN_BOARD_MODEL_ID`, `world/rmbLayout.js`). The boards are sorted by position (x,
  then z, then y) and every other one is taken, from the first: two give one, four give two, five give two. A town with
  one board keeps it for DFU's rumour. Every client picks the same half, whatever order its blocks were laid.
- **It names itself** "Bounty Board" on hover (`scenes/worldModes.js`); DFU's is "Bulletin Board". Its press opens
  the board window (`ui/bountyWindow.js` through `ui/bountyDoor.js`) in the Enhanced Plus stone and brass on every
  skin - the window lays its own sheet on the classic skins, the Broker's precedent. The other boards open DFU's
  rumour exactly as before (`systems/bulletinBoard.js`; the ROAD A9 pins hold).
  SPAM-TAKE (`01-Overview/Field-Bugs-2026-10-10.md`): a take moves the window's card on to the next open notice, so
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
- **The piece** (`systems/bountyReward.js`): one weapon or armour piece, never ammunition. Levels 1-3 white at half
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
- **The map**: a held bounty's pixel is a BLACK circle on both maps (`ui/bountyMapMark.js`; the held map's ink,
  `ui/inkMap.js` paintBountyRing; the classic region page's texels) - black because green is the party's.

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
   (`systems/bountyJournal.js`, a leaf the lazy journal chunks reach without a cycle). Given up and taken again the same
   day, a bounty goes on from its kills and its live beasts are the hunt's again - never a fresh pack (AUDIT 28 B2).

## 5. The farms (BOUNTY-FARM, `scenes/bountyFarms.js`)

A notice whose words name a farm (granary, orchard, harvest, cattle, shepherd) stands a real Daggerfall farmstead on
its pixel: the first RMB block of one of the 8 game-owned HomeFarms locations nearest the hunt, the notice's pick,
climate-dressed by the pixel it stands on, solid (its own collider bucket). The spot is the flattest of sixteen rolls
clear of roads, the sea and towns and of any farm that already stands (AUDIT 28 B13 - two notices on one pixel stood two
farms in one another), and each model sits on the ground under itself. The first group waits in the
farmyard, 10 to 18 metres from the farmhouse, and stands within 150 metres.

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

`test/bounty1.test.js` (17, the archive's) - the ladder, the board every client reads, the half, a hunt Take to
payday, the party, the wire, the circle, the dungeons, the farms, the journal, the two groups, the tiers.
`test/auditbounty1.test.js` (5) - B1 to B4, and the wiring (the press, the plaque, the host alone).
`tools/mutants/bounty1.json` - 25 mutations (the bounties' 20 and DEATH-PENALTY's 5), 25 dead.
`test/audit28_bounty.test.js` (12) - section 11; `tools/mutants/audit28.json` B1-B13, dead.

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
