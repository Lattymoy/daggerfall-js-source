# FIELD BUGS 2026-10-21 - a green wall up a white mountain, the Enemy Expansion's animals skinned, and a sworn one abroad while you are away

Three things the owner handed over together on 2026-10-21: a screenshot of their own, of a snowy range under its woods with
a straight green band up its side ("The terrain issue in the attached image shows the side of the mountain without snow or
floral"), and two threads from the Discord's #feature-feedback, both Shines': "Monster Expansion mobs need compatibility
with Hunting" and "Revenant missions should function when offline". Each was traced on the real producers - the terrain
on the freeware's own map, the hunt through the mod's own table and the account service, the errand through the clock it
runs on. Read on the code as it stands at main's `4bba28c6c`. The calls the reports left open are taken here, under the
owner's standing word on these threads (Mac, 2026-10-19: "Stop with the decisions for me"); each section says which it took
and why. The pins are `fb1021_*`, the mutants `tools/mutants/fb1021_*.json`. AUDITED the same day, before its merge
(AUDIT FB1021, `01-Overview/audits/Audit-Field-Bugs-2026-10-21.md`, the owner: "Audit this" - four cold lanes); what it
changed is marked here with its finding's id.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | The owner's screenshot: "the side of the mountain without snow or floral" | On the snow lane a steep face shed its snow to its SUMMER tile - Daggerfall's grass, its dirt and its stone, the sets having no rock face. The landforms stand a range's flank past 52 degrees hundreds of metres wide, and DFU stands no tree past 50 | SNOW-FACE |
| - | (found on the way) | A pixel standing when the snow lane turns was sent to a re-skin that refuses it, and wore the other lane's ground - in a winter turned off the lane, its summer set | LANE-TURN |
| 2 | Shines: "the variant bats and wolves I encountered have had no option for skinning" | Hunting skinned by DFU's MobileTypes alone; the Enemy Expansion's foes are its own ids, 256-290 | DEX-HIDES (FIELD BUGS 2026-10-20h's, merged first) |
| 3 | Shines: "I'd like to see them at least progress on the real time bar when offline ... so far I haven't gotten anything from a 2-hour mission that I wouldn't have done better trying to harvest myself in a fraction of the time" | Online an errand ran on the character's own clock, which stands while they are away | OFFLINE-ROAD |

## SNOW-FACE: a steep face keeps its snow (1)

`src/render/snowCoverGlsl.js` (`SNOW_GROUND`, `snowCover`, `snowLaid`, `snowCoverAt`), `src/scenes/snowCoverHost.js`
(`drawnCover`), the five callers of the chunk (`renderer.js` TERRAIN_FS, `enhancedLighting.js` EL_TERRAIN_FS,
`waterSurface.js`'s bed, `snowfallGlsl.js`'s two), `src/scenes/world.js` (the host's wiring).

FOUND. On the enhanced lane the ground keeps what fell (PRECIP4, `07-Rendering/Biome-Precipitation.md`): every pixel's
ground set is its SUMMER one, and each fragment wears its tile's winter record in the share of the snow at its height. A
second law stood beside the height: a steep face shed the snow (`SNOW_GROUND.slope`, the normal's y from 0.8 to 0.62 - from
37 to 52 degrees - "a snow-shedding rock face is past 45"). But under a shed face there was no rock. Daggerfall's tile sets
are the same 56 records of grass, dirt, stone and their edges, so what showed was the summer set's own tile at that place:
green grass, with its orange dirt and grey stone blots. The other half of the picture is DFU's: TerrainNature stands no
tree on a tile steeper than 50 degrees (`terrainNature.js` MAX_STEEPNESS, both the classic scatter and Real Forests). So a
face past 52 degrees drew as a green band with no tree on it, and its gentler rim as green patches thinning into the snow.

The faces are real ground. Measured on the freeware's map as the pin measures it (`generateSamples` under `createLandforms`
with the climates - the world host hands them its roads and sites too, which neither reads), at the sample spacing (6.4 m,
central differences, a pixel's interior): over the 107,146 Mountain pixels about 0.08% of the samples are faces past 52
degrees, over the 6,662 with a height byte of 80 or more 0.38% (AUDIT FB1021 L1-2, L4-6: this record said 0.01% and 1.3%,
which no scan reproduces), and the Dragontail range holds whole flanks of them - 44% of the pixel beside The Bat and Cat
Pub (924,473), 40% beside The Howling Ogre Lodge (939,475), 37% beside Boorche's Guard (951,464), 40% of pixel 917,472. They run straight for kilometres along a range's flank, which is the band in the
screenshot; their steepest stand 61 to 65 degrees. With DFU's kernel alone the same four pixels hold no face past 52
degrees (their steepest 39 to 45, inside the old shed's thinning band, so a DFU face would have worn green patches, not a
band). The classic lane never showed it, since its winter is DFU's whole set, and the snow lane showed it wherever a
range stood in snow.

DECIDED: the shed goes, not the faces. A rock face that sheds its snow is real, but this ground has no rock to show: a face's
tile is grass in every season, and DFU's winter set dresses every tile white, steep or not. So the law has no slope now: a
face keeps the snow its height lays, and in snow it reads as a snowfield, white and bare of trees. Its trees stay DFU's
(none past 50 degrees; the summer face is a grassy one, as DFU draws it). AUDIT FB1021 L1-4, said plainly: so the
report's "no floral" half stands in every season - the band is bare of trees, white in winter now and green in summer
(43% of 917,472 and 49% of 924,473 stand past 50 degrees). The faces are the landforms', not DFU's (with DFU's kernel the
same pixels hold none past 45, and DFU would have stood its trees there). Kept anyway: a tree on a 60-degree face stands
out from a cliff, and reading DFU's slope under our ground for the scatter is a new law for the woods, not this fix; the
winter of the screenshot reads as a snowfield. Not taken: drawing a rock tile on a face (the sets
have none, and a stone record over a whole face is a new look for every season, not this fix), and raising the shed to a
steeper face (it would still bare green grass, on fewer faces).

FIXED. `snowCover(local, y, gx, gy)` is the cover at the fragment's height and its patches, and its twin on the CPU
(`snowCoverAt(cover, lx, lz, ox, oz)`, the grass's and the feet's) the same. No caller hands it a normal. The snow host no
longer asks the stream for heights at all (it read four a grass blade, under snow, for the slope - SNOW-BUDGET), so it takes
no `heightAt`. The Snowfall mod's own surface still thins its coat on its own steep slopes (`Surface.MaxSnowSlope`, 55
degrees - the mod's law, untouched); it lays it where the ground wears snow, which is now the face too.

Seen in play: the streaming world headless (SwiftShader, `?shot&world&class=0`, a one-square land view), at The Bat
and Cat Pub in the Dragontail Mountains in the classic start's winter, the eye 300 m over its pixel. On main's code the
range's flank beside it wore green grass with orange dirt blots and no tree, the screenshot's band. On this branch, from the
same pose, the same face stands white, the low-poly rocks of the screenshot on the ridge behind it. The pictures are
renders of the player's data and stay outside the tree (Port-Doctrine).

## LANE-TURN: a lane's turn rebuilds the pixels built under the other (found on the way)

`src/scenes/snowCoverHost.js` (`tick`, the `markRebuild` dep), `src/scenes/world.js` (its wiring to `_reskin.mark`).

FOUND, tracing the green band's other possible causes. The snow host's frame asks the lane each frame, and a standing pixel
built under the other lane (the "Weather as places" or "Enhanced environments" preference turned in play - `precipLawOn`
reads both every call, AUDIT FB1021 L1-1; the skin reloads the page - or a build in flight across the turn, AUDIT PRECIP
HOST-N1) was sent once to the snow's re-skin (`_reskin.skin`). The re-skin is `pixelBuild.js` `reskinPixelNow`, which refuses both turns: a
pixel built off the lane keeps no `_skin`, and off the lane the snow is not `on`. So it stood in the other lane's dress until
it streamed out. Its ground is the worst of it: on the lane a pixel's ground archive is the summer set (`groundArchive`),
which a re-skin never touches. Turned off the lane in a winter, every pixel standing drew its ground from an array off
the lane never loaded (the lane loads the set's twin alone, and `arrayOf` off it is the plain set or none): most likely
black, else its summer set's green if that was cached (AUDIT FB1021 L1-7: this record said its summer green). The audit's FIXED for HOST-N1 ("sent once at publish") sent it to a door that never opened.

FIXED. The host marks such a pixel for a REBUILD (`markRebuild`, the world host's `_reskin.mark`): the driver's `take` hands
it to `tickSeason`'s teardown and rebuild, as the classic flip's pixels are, and its next build reads the lane it is in.
Never the skin. Once a pixel, as before. A turn tears the whole standing grid down at once, as the classic flip's does,
and the player's own pixel's rebuild then waits on the snow's window (`settle`): so a turn ONTO the lane is marked once
the window stands (`ready` - the tick integrates it), never while a cold year's integration would be done in frame slices
(AUDIT FB1021 L1-1: 2.6 s of work, three to seven seconds of empty world at a 4-8 ms slice). A turn off it is marked at
once: off the lane nothing waits.

## DEX-HIDES: the Enemy Expansion's animals are skinned (2) - FIELD BUGS 2026-10-20h's, merged first

`src/net/professionLaw.js` (`HIDES`, `CURE_RECIPES`), `src/systems/professions/profItems.js` (`PLURAL_SAME`).

FOUND. "Monster Expansion" is Daggerfall Enemy Expansion (DEX, `04-Characters/Enemy-Expansion.md`). A body is skinned when
Hunting's table names its foe: `hideOfFoe(mobileType)`, read at the kill (`scenes/huntHost.js` `createBodyStamps` - no
hide, no stamp), for the body list (`bodiesOf` lists stamped bodies alone, so no "Skin the ..." row), for a Tracker's marks,
and by the account service (`server-account/src/professions.js` `harvestNode`, `prof-foe`). The table named DFU's
MobileTypes alone - 0, 3, 4, 5, 6, 11, 13, 20, 34, 40, 41 - and the mod numbers its monsters 256-290, a spawned foe's
mobileType its id (`makeEnemyEntity`). Its Bat (260) has the classic Giant Bat's career and was still never skinned: the
table asks the id, not the career. Its Wolf (262) had no hide at all: vanilla has no wolf, and the Werewolf is not skinned.
Nine of the mod's rows are Animal: the Bat, the Wolf, the Snow Wolf, the Dog, the Blood Spider, the Boar, the Land Dreugh,
the Mountain Lion and the Mudcrab. Their meat already dropped through Climates & Calories (`survival/loot.js` reads the
affinity), so only Hunting had missed them.

AT THE MERGE. Main merged its own DEX-HIDES before this branch (`01-Overview/bugs/Field-Bugs-2026-10-20h.md`, the same
thread): the same nine animals, the same keys, and its three hides at 681-683 where this branch had 667, 672 and 676.
Its build is taken whole and this branch's dropped (`fb1021_dexhides.test.js` and its mutants with it): main's ids may
already stand in a player's Stores, and its laws were this branch's after its audit - the Mudcrab's Raw Meat, the two
furs cut to skins, the kin's hides. Two of this branch's audit's findings held on main's build too, and are carried
(pinned in `fb1020h_dexhides.test.js`, mutants in `fb1020h_dexhides.json`):

- the Bear Hide's cure stands LAST of its tier (AUDIT FB1021 L2-1): main stood it before the Wolf Pelt and the Boar Hide,
  so a chain for 4 Cured Leather from 8 of each spent all 8 Bear Hides - the Ram Kit's input - and no pelt;
- the Stores count "3 Mudcrab Chitin", a mass, as the Scorpion's ("3 Mudcrab Chitins" on main).

The Land Dreugh shares the Dreugh's row whole on main too, so no butchery: a departure from C&C, whose corpse feeds its
body (AUDIT FB1021 L2-2), written into Professions-Arc 4.4.

## OFFLINE-ROAD: online an errand keeps the world's time (3)

`src/systems/revenant/revenantErrands.js` (`newErrand`'s `due`, `sanitizeErrand`, `errandOnWorld`),
`src/systems/revenant/revenantCompanions.js` (`sendOnErrand`, `chargeErrands`), `src/ui/companionRoster.js` (the sheet's
online word).

FOUND. A "2-hour mission" is a one-day errand: High Rock or Hammerfell (`ERRAND_PLACES`), a day on the character's own
clock, two real hours online (the wire's twelve game minutes a real minute). Online the errand moved by the lived step
alone (AUDIT RVN F1, `errandStep`): the character's own clock stands while they are away (LIVED1, `06-Systems/Lived-Time.md`
- a load restores it from the save), and a rest, a Loiter or a journey raises it, which pushes every errand back by as much.
The step was built to close a faucet: a road journey's x100 raised 906k of wealth an hour at level 30 against the band's
200k (`06-Systems/Revenants.md` section 43). Logging off was never weighed, and it fell out of the same clock. A sworn one
sent off at a logout came back no nearer, and nothing on the service clocks an errand.

The haul, worked from the law for a won day: a High Rock Sell-sword about 140 gold at level 10 (420 at 30), a Forage 5 units
of goods and about 21 gold, a Plunder a piece, about 56 gold and a unit. Hand harvesting is about 2.5 units a harvest,
45 harvests a half hour (Professions-Arc's economy model). So a two-hour Forage is a minute or two of harvesting, as
Shines says.

DECIDED: a sworn one abroad is out in the world, so online it keeps THE WORLD's time (Lived-Time.md: "Everything the world
owns reads the world's clock"). The world's clock runs on the wall whoever plays, and no raise moves it. So time away carries
an errand on, and a rest, a Loiter or a journey still never does: AUDIT RVN F1's faucet stays shut - with THE CLOCK'S
GUARD below, which the first build lacked (AUDIT FB1021 L3-1). At most two are abroad (`ERRAND.MAX`), each earning at
most its road's haul in its road's real time, as one played through does, so no hour pays a character more than the
measured rates (section 43: about 990 gold or 4,200 of item worth a real hour at level 30, two abroad, rank V, best kit,
0.5% and 2% of the band). What changes is the hours: away ones count too, and an account's other characters' with them
(AUDIT FB1021 L3-4: every realm character's errands now keep the world's time while another is played - six characters,
twelve abroad, at most six times the hour, 3% and 12% of the band; at main only the one played moved). The pieces still reach the realm only
through customs, which charges the budget. The haul is not raised. An errand's worth is the time it fills while the player
is away, and harvesting by hand is the active player's road and stays worth more an hour. Measured rates belong to the
economy's own audit, not to this record.

FIXED. Sent online with the relay's clock heard (`trustedWorldMinutes`), an errand carries `due`, the world's minute it is
back, and the save keeps it. At every wake online, once the relay's clock is heard, `errandOnWorld` writes its `until` as
many minutes past the character's own as the world has left to `due`. That is the minute the party's wake compares, so
nothing else moved. It is held to its road's days from the world's now and never before it set out. An errand with no `due`
(sent before the relay's clock was heard, or before this) takes its minutes left onto the world's clock at the first
trusted wake, from its minute as that wake's lived step charged it (AUDIT FB1021 L3-2: the first build took it from the
own clock before the step's push, so a Loiter of 96 hours open when the welcome came was paid on it - 5,043 gold where
main paid none). Until the relay's clock is heard the lived step carries it, exactly as AUDIT RVN F1 built it: a client
that never hears the relay earns no raise either. A load is a new session, and its first trusted wake returns an errand whose
`due` passed while the player was away. Offline the one clock carries it, DFU's own, unchanged. The sheet's online word is
the world's now: "Online, a mission keeps real time: it goes on while you're away, 2 real hours for each day abroad.
Resting, waiting or traveling doesn't speed it up." - its hours read from the wire's rate (`ERRAND_REAL_HOURS_A_DAY`), and
online an errand's time left is said in real minutes and hours ("back in about 2 real hours", AUDIT FB1021 L3-5: it said
"back in about 24 hours" of the event clock, two real hours, while the sky clock the HUD shows passes 48 in them).

THE CLOCK'S GUARD (AUDIT FB1021 L3-1). The client's world clock is the machine's clock plus the relay's offset, taken at
each primary welcome. So a player who set their machine's clock forward mid-session moved their world's clock with it,
and the first build returned an errand at once (ten moves of +8 hours, no real time: 14 returns and 50,701 gold, where
main's lived step held each wake to its 30 minutes). Each welcome now marks the world's minute with the session's
monotonic time (`worldTick.js hearSharedClock`, `sharedClockHeardMark`), and an errand reads no more of the world than
that minute plus the monotonic time lived since, at the wire's rate, plus a minute's slack (`revenantErrands.js
errandWorldMinute`). A machine clock moved between sessions moves nothing: a load hears the relay again, and its offset
is the relay's. Set back, the clock only resets a road from now, as before.

## THE FOUR HOSTS

- SNOW-FACE and LANE-TURN: the snow host stands in `scenes/world.js` alone. `scenes/exterior.js` hands the air no map, so
  its ground is DFU's season with no cover (the chunk's one uniform test). `scenes/worldModes.js` and
  `scenes/dungeonContext.js` draw no terrain.
- DEX-HIDES: the kill's stamp, the body list and the Tracker are `scenes/huntHost.js`'s, wired in `scenes/world.js`
  (`createBodyStamps`, `bodiesHere`) over the street's pool, `scenes/worldModes.js`'s buildings (`interiorFoes`) and
  `scenes/dungeonContext.js`'s dungeons, as PROF7 wired them. `scenes/exterior.js`, the fixed city, stands no professions -
  FLAGGED by name, as PROF7's (AUDIT FB1021 L2-8: this line named no host). Nothing in a host changed.
- OFFLINE-ROAD: the party's wake is the companion layer's (`scenes/crewAshore.js`), wired in `scenes/world.js`. Its `now`
  is unchanged.

DFU members: SNOW-FACE departs from nothing of DFU's. DFU's winter dresses every tile, and the shed was PRECIP4's own law,
so the face is back with DFU. DFU has no professions, no Enemy Expansion registry in Hunting and no Revenants. The Ledger's
BIOME PRECIPITATION row says the height alone now. Section C has no row these touch.

## PINS

- `test/render/fb1021_snowface.test.js` (3): THE CHUNK READS NO SLOPE (its signature, no normal at any of the five callers,
  a whole cover's texel the winter record's, never the summer grass); ON THE FREEWARE'S MAP (the Dragontail pixel 917,472
  under the landforms: over a third of it past 52 degrees, no tree on any of those samples by DFU's own `natureStandsAt`,
  and a whole cover whole on every one); LANE-TURN (the real `createSeasonReskin` under the host: a pixel built under the
  other lane taken for the rebuild, never sent to the skin, both turns, once, a turn onto the lane once the window stands;
  why the skin cannot serve; the world's wiring). AUDIT FB1021 L1-5: THE CHUNK holds a whole cover whole across the pixel
  at every second world tile (it read four places, and a cover held to 0.98 passed them).
- DEX-HIDES (main's, FIELD BUGS 2026-10-20h): `test/net/fb1020h_dexhides.test.js`, and this branch's AUDIT FB1021 test
  in it: THE RAM KIT'S HIDE SPENT LAST (L2-1, a chain over held hides; the Mudcrab Chitin a mass).
- `test/systems/revenant/fb1021_offlineroad.test.js` (8): THE LAW (`errandOnWorld`'s minute, its `due` taken from its
  minutes left, the clamp, never before it set out, `due` carried by a send online and kept by a save); THE ROAD WHILE AWAY
  (sent online, ten days raised carry it not a minute; a logout, half a real day away, half left at the first frame of the
  load; a whole day away, back); BEFORE THE RELAY IS HEARD (the lived step, then its day left onto the world's clock); THE
  PAGE (the online word and the wire's two hours a day; none offline). AUDIT FB1021 (4): A MACHINE CLOCK SET FORWARD PAYS
  NOTHING (L3-1: +4 days of wall clock and no monotonic time, still abroad; a load hears again and counts the time away); A
  RAISE ACROSS THE FIRST TRUSTED WAKE IS NEVER PAID (L3-2); THE PRODUCER'S SHAPES (L3-3: a fractional world minute, an
  Undying Vigil's road, a send offline); THE WORDS ONLINE ARE REAL TIME (L3-5).

Mutants: `tools/mutants/fb1021_snowface.json` (6), `fb1021_offlineroad.json` (19) - all dead, the audit's with them (it
was 4 and 8); two in main's `fb1020h_dexhides.json` (the Bear Hide in the table's place, the chitin counted); and three of PRECIP4's own lines the audit pinned in `precip1.json`
(AUDIT FB1021 L1-6: the blade's shift, the feet's height, the laid snow's footprint).

PINS MOVED.
- `precip4_snowground.test.js`: the fragment's cover reads no slope ("a cliff sheds it" and "a gentle slope whole" go with
  the law; every call drops its normal; the CPU's twin is held at 240 places, since the slope's draw left the stream and 160
  held 9 between bare and whole). The host's lane turn is held on `markRebuild` (LANE-TURN), and the world's wiring names
  it. The host takes no `heightAt`.
- `waterpuddle.test.js`: the puddle's mask reads the ground's cover with no normal (it handed the chunk an upward one).
- `snowbudget.test.js`: SNOW-BUDGET's "the slope read only under snow" is "no height asked, summer or winter" - its purpose,
  no stream reads for the grass, held whole.
- `prof7_law.test.js`, `craft1_chain.test.js` and `fb1020h_dexhides.test.js` (main's, at the merge): the loom's cures and
  the chain's works with the Bear Hide last of tier 2 (AUDIT FB1021 L2-1).
- `l10n4_hardcoded.test.js`: the ratchet's `profItems.js` +1, the Mudcrab Chitin's mass noun.
- `rvnerrand.test.js`: the page's offline negative reads the new online word. AUDIT RVN F1's own pin is unchanged and still
  passes: it runs on a shared clock not yet heard, which is the lived step's case now.
- By the audit (AUDIT FB1021): `precip4_snowground.test.js` THE HOST - a pixel built off the lane is not marked before the
  window stands (L1-1), and `buries` takes no scene x and z (L1-8); `snowbudget.test.js`'s host takes no `heightAt` and
  records its rebuilds (L1-8).

Mutant records retired with the slope: `audit_precip.json` AUDIT-PRECIP-GROUND-3-the-cpu-s-slope-unread, `precip1.json`
PRECIP4-the-slope-unread, `snowbudget.json` SB-the-slope-read-first. The law they killed is gone. Re-aimed by content, all
dead: `audit_precip.json` HOST-9-the-stream-s-ground (the blade's own height dropped, since there is no stream ground in
the host now), GROUND-9's three (the snow's chunk with no normal), `precip1.json` PRECIP4-the-turn-unmarked (at
`markRebuild`), `rvnerrand.json` RVN-ERRAND-days-unread
(the road's length, one line above where it stood).

Translations: the sheet's online word with its hours read from the wire (`{h}`) and the errand's real minutes and hours
left (`rvn.errand.left.realMinutes`, `realHours`), drafted in-session (`tools/l10nInSession.mjs`) for the thirteen
languages the catalog covers. Hunting's and Outfitting's rows are main's (FIELD BUGS 2026-10-20h), taken at the merge: its
chitin words were already each language's own (AUDIT FB1021 L2-7 found this branch's were not).
