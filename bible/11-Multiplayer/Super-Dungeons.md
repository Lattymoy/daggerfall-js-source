# Super Dungeons - the Hollows of the Hour, and the Brass Remnant (SD0-SD10)

> Design page and record of the arc, written 2026-10-05 before its first slice. The code's comments cite this page by
> section number; where the page and a pin disagree, the pin is what runs. Each slice adds its record under section 16.

## What Mac asked for

Mac, 2026-10-05, on the Delve branch (THE DELVE ARC, `03-World/Delve-Arc.md`): *"So medium dungeons will be the new by
default option thats on (online only). In addition to these changes we are going to introduce a new dungeon type that
folds in with the other 2. We have: Normal, Elite. We introduce: Super."* Then:

- *"Super dungeons are a new type of difficult content, the first iteration of extremely hard content to be added."*
- *"Super dungeons are random finds on the world map, and spawn where population is at its most. Only one can be active
  at a time."*
- *"On discovery, Super dungeons have a beginning and an end. On players discovering the end, a large otherworldly
  portal is present which transports users to a secondary location, not oblivion, something different based on the lore
  of daggerfall."*
- *"Using our existing architecture of the oblivion gate. Users will solve a complex puzzle to traverse within, encounter
  a hard platforming section, and experience a thrilling and difficult boss encounter at the end that awards the chance
  at cosmetics like a title, aura, and brand new weapons and armor set."*
- *"At the end of the Super dungeon, before entering the overworldly portal, players can take a return portal back to the
  entrance, which remains open until players defeat the final boss."*
- *"This needs to be complex, hard and challenge even the best builds that players have. It shouldnt be easy to overcome
  and should be a feat when players complete this. The Super dungeon collapses when the feat is done."*
- *"Along with this change will be a simplier addition, visible showing dungeons difficulty as Regular, Elite or Super."*
- Then, on the first slice: *"On second though. Large, medium and small should all play into account online"* - and,
  asked whether each player picks or the world mixes, *"World mixes sizes"*.
- *"You full have autonomy, and I want you to be as detailed as possible."*

So, as decided here (each decision is argued in its section):

- **Online only.** A Super dungeon is a fact about the shared world, like the Breach (`World-Bosses.md`) and the Elite
  dungeons (`06-Systems/Searchables.md`): the relay keeps the one that stands, keeps its realm's puzzle and fight, signs
  each finisher's feat, and the account service pays it. Offline there is no Super dungeon; every dungeon is Regular.
- **One at a time, until it is beaten.** The hub keeps ONE record (section 2). A Super dungeon stands until its boss
  falls - then it collapses - or until its time runs out unbeaten (48 hours) - then it fades. After either, the next
  one rises somewhere else.
- **"Where population is at its most" in both of its senses.** The relay counts the players in each of the Bay's 62
  regions at the moment one rises and picks the fullest (section 3); inside that region every client places it by the
  first of the region's cities, ranked as its hub is (a city, the one named for its region, then the largest), that has
  a suitable pixel - from its own MAPS.BSA. With nobody to count, it rises by one of the Bay's great cities.
- **A random find.** It is not announced where it is. It is seen - a column of brass light on the horizon, a line when
  it is in sight (Elite's own), a word in the taverns of the city it stands by - and FOUND by the first player to reach
  its door, whom everyone online then hears of (section 4).
- **A real dungeon, made Super.** It is a spawned dungeon (the Elite's machinery, `world/spawnedDungeons.js`) at the
  site, built whole (section 5 - the world's sizes are for the Bay's own dungeons), with the hardest foes the port stands (section 5). Its END is the
  point of the layout farthest from its entrance, where the Rift and the Return stand (section 6).
- **The Shattered Hour, not Oblivion.** The Rift opens on the place the Warp in the West left behind - Daggerfall's own
  Dragon Break of 3E 417, when the Numidium walked and the Bay broke into every ending at once (section 7).
- **The Breach's architecture, copied, not edited.** The realm is a made level like the Burning Court
  (`world/gateArena.js`); its puzzle, its fight and its feat are a pure brain the relay runs (Option B, as
  `net/gateBrain.js`); the feat is a signed receipt the account service claims (as `net/gateReceipt.js`). The gate's
  own modules are reused, not rewritten (SERPENT1's rule, `Sea-Serpent.md`): where the arc needed one to do more it
  widened a seam whose default is the gate's own bytes - `net/gateBrain.js` exports its hand and purse (`spendBlow`,
  `spendPurse` - SD8a), the boss bar cuts its marks where a model says (`ui/gateBossBar.js` - SD8c), the telegraph pass
  draws over another floor (`render/gateTelegraph.js` - SD8d), the spoils pool takes a `roll` and its own `gathered`
  words (`scenes/spoilsPool.js` - SD9e) - and the gate's records those seams moved were re-aimed by content (`wb4.json`,
  `wb4b.json`, `wb9f.json`), never weakened.
- **A puzzle the relay judges** - the Orrery of Endings, a geared lock over twelve hours whose answer is written in
  riddles that change with every Hollow (section 8); **a course the clock drives** - the Unmoored Steps, drifting,
  phasing and crumbling platforms over the void (section 9); **a fight that tests a build** - the Brass Remnant, three
  phases, a damage race, a coordination check and a timer (section 10).
- **The chance, not the promise.** The kill pays gold and gear to everyone who earned it; a piece of the new set, THE
  BRASS OF NUMIDIUM, one time in three; the Hourlock, the one Gilded piece, one time in fifty (GILDED1); the title
  *Hourbreaker* one time in four and the aura *The Turning Hour* one time in eight, each rolled once by the account
  service from the relay's own seed (section 11).
- **Regular, Elite, Super - one word, everywhere a dungeon is named** (section 12).
- **The world's dungeon sizes are the online law** - small, medium or large by each dungeon's map id, the same for
  everyone (section 13).

Daggerfall has no other players, no Elite or Super dungeon and no Shattered Hour, so none of this is a DFU member. Its
Ledger A rows are SD-ONLINE (the world's dungeon sizes online), TIER1 (the labels) and SUPER-DUNGEONS (the rest).

## 1. The shape, end to end

```
 the HUB's director (one record, `sdev`)
   │ no Super stands and the cooldown is spent ─► RISE: census of the 62 region rooms ─► region r (or -1)
   │                                                     │ fanned: {t:'sd',k:'ev',s,ph:'risen',r,...}
   ▼                                                     ▼
 every client: site = findSdSite(rec, the gate's scan, sdCities(rows, r)) ─► the Hollow stands at its pixel (a spawned dungeon, Super)
   column of light on the horizon · a line in sight · taverns of the city speak of it
   │ the first player at its door ─► `found` to the cell ─► the hub: ph 'found', fanned; every client says "<who> has found an Abyss Dungeon near <city>!"
   ▼
 the DUNGEON (whole, Super foes) ── its END: the RIFT (to the realm) + the RETURN (to the entrance)
   │ the Rift, pressed ─► the realm room `sd:<s>` admits ─► the SHATTERED HOUR (a made level)
   ▼
 THRESHOLD ─► ORRERY OF ENDINGS (puzzle: relay-judged) ─► UNMOORED STEPS (platforming: the shared clock)
   ─► THE LAST MOMENT (the Brass Remnant: relay brain, 250 ms beat)
   │ the kill ─► RECEIPT `h1` per earner ─► spoils rolled on the receipt's seed; the account claims title/aura chance
   ▼
 COLLAPSE: ph 'fell' ─► 3 minutes ─► 'gone' (every client: the Hollow is taken down, anyone inside is cast out) ─► cooldown
```

## 2. The director - one record in the hub

The hub (`chat:world`, the room every online tab holds) keeps the Super dungeon's record under the storage key `sdev`
(outside the `look:`/`secret:`/`party:`/`world:` prefixes the sweeps delete - the relay map's trap). The record:

| field | meaning |
|---|---|
| `s` | the slot: 1, 2, 3 ... - one per Super dungeon that ever rose; its seed and its room key `sd:<s>` |
| `ph` | `risen` · `found` · `fell` · `gone` (faded is `gone` with no `fellAt`) |
| `r` | the region the census chose (0..61), or -1: the Bay's great cities (section 3) |
| `at` | when it rose (relay ms) |
| `foundAt`, `fb` | when it was found, and by whom (the finder's display name; never an account id) |
| `fellAt`, `top`, `n` | when its boss fell, the top fighter's name, how many fought it (every seat in its fight - the gate's and the serpent's own count) |
| `until` | when an unbeaten Hollow fades: `at + SD_LIFETIME_MS` |
| `next` | when the next may rise: `fellAt + SD_COLLAPSE_MS + SD_COOLDOWN_MS` (or `until + SD_COOLDOWN_MS`) |

Beyond the finder and the top fighter, the record names no one. Every fighter's name is the account service's, one `sd_kills` row a claimed receipt
(section 11); the operator reads them by slot with SD-CLEARS (`06-Systems/Accounts-And-Cloud-Saves-Arc.md`).

The director runs on the hub's one alarm (multiplexed after `_sweepHub`, re-armed through the hub's own arm), and on
the internal doors below. Its law is pure (`net/sdLaw.js`, section 14) - the hub only stores and fans.

Numbers: `SD_LIFETIME_MS` 48 h, `SD_COLLAPSE_MS` 3 min, `SD_COOLDOWN_MS` 2 h, `SD_FIRST_RISE_MS` 10 min after a hub
with no record first beats (so a fresh deploy does not raise one the instant it wakes).

Clients learn the record from `{t:'sd',k:'ev',...}`: once after the hub's welcome, and again on every change. The hub
says it to every hello - an older client drops a frame type it does not know (`net/online.js`'s message arms), so no
opt-in is needed (this page first planned one, `sdv`; SD3 found it unneeded).

## 3. Where it rises - the census and the city

**The census (relay).** When a Hollow is due to rise, the hub asks each of the 62 region rooms (`chat:region.0..61`)
through `/internal/sd/census`, each call bounded by `ROOM_CALL_MS`. A region room answers the number of DISTINCT
verified, linked accounts among its sockets (a guest is not counted - one click makes a guest). The hub takes the
region with the most, at least `SD_CENSUS_MIN` (2); ties are broken by the slot's hash, and the region the last Hollow
rose in is skipped when another qualifies (the gate's bag seam rule, so one crowd does not keep every Hollow). With no
region at the minimum, `r = -1`.

The census is taken ONCE per rise, never on a timer (RELAY-H1: objects are billed for awake seconds). It is honest
about its limit, as the rite is: a region is the one a client says it stands in.

**The city (client, every client the same).** `systems/sdSite.js`, over the game's own MAPS.BSA rows (a mod's addition
is not on every client - HUB1's rule), each as MAPS.BSA holds it - a town pack's row read again past the world-data door
(LANDFORMS III B1's `classicRow`; a pack rewrites the very grid and buildings a city ranks by, and a client whose pack
failed to load stood its Hollow by another city - AUDIT SD IV S2), and the templates read the same way:

1. The candidates are the populated places of region `r`, ranked as its hub is chosen (`systems/regionHubs.js`
   `hubClaim`): a city over a hamlet over a village, then the one named for its region, then its RMB blocks, then its
   buildings. With `r = -1` the candidates are the Bay's first eight cities by that ranking (`SD_GREAT_CITIES`), and the
   slot's hash picks one.
2. Around the chosen city, the site is a pixel the gate's own scan calls suitable (`systems/gateSite.js`: land, no
   location on it or its eight neighbours, not a spawned dungeon's pixel) whose nearest fast-travel town is that city -
   two to four pixels out (`GATE_TOWN_MIN_PX`..`GATE_TOWN_MAX_PX`). The slot's hash picks among the pixels that pass;
   with none, the next city down the ranking is tried. ON DRY GROUND (AUDIT SD IV F37): the scan's one land test is the
   pixel's own height byte over the sea's, and a coast's low first land stood the Hollow on a square of sand - so the
   site is the spawns' own (`world/spawnedDungeons.js` `createSpawnGround`, SPAWN-SHORE: the plateau the build flattens
   it to above the beach band), from the slot's pick on through the city's pixels to the first dry one (the pick's own
   where it is dry); a city with none passes to the next.

The relay never knows the pixel - it has no map data - and needs not: everything that must be judged is judged by pose
against the slot's law (section 4) or in the realm's own frame (sections 8-10).

## 4. A random find - the omen, the sighting, the finding

- **The omen.** From the moment it rises, a column of brass-gold light stands over the Hollow's pixel, seen from any
  pixel within 12 (the gate's beacon pass, its colours its own). A traveller in the city it stands by hears it in the
  taverns: *"They say the air goes brass-coloured past the walls of <city> at dusk, and a bell rings where there is no
  bell."* No map mark, no compass mark: it must be found.
- **The sighting.** On first crossing into its map pixel (some 410 to 580 m from it), Elite's own sight line, once:
  *"You see an Abyss Dungeon 460 metres to the Northwest!"* (AUDIT SD II, L8 D5: it said "within 600 m" and
  "north-west").
- **The finding.** The first player to stand within 25 m of its door sends `{t:'sd',k:'found',s,px,py}` to the cell
  room it stands in. The cell believes it only from its own socket's pose within SD_FOUND_RADIUS_M of the claimed
  pixel's centre (a spawned dungeon stands centred in its pixel, so the relay checks it without map data), and keeps it
  - the first finder's - until the hub answers (`/internal/sd/found`, told again on the cell's alarm). The hub believes
  it while its record says `risen` for that slot, asking the pose again; it sets `found`, keeps the finder's VERIFIED
  name, and fans it: *"<name> has found an Abyss Dungeon near <city>!"* From then on everyone online sees it on
  the map (its ring), the compass (inside 1 km), the Timers window and the notice boards.
- **Its presence** (SD19). The air the taverns speak of is there: near a standing Hollow the land's haze and light lean
  to brass, by its column's light, whole within 1 km and gone by 8 km, a little all day and most at dusk. Within 60 m of
  its centre a banner names it and its state (*"The Stopped Bell - fades in 1d 04h"*, *"... - collapsing"* - SD20e
  T1: what it is is the card's, beside it), its marks beside it on the gate's own card, both in the Hour's brass. Its
  find is followed by its marks (*"The Stopped Bell keeps the Ending of Sentinel - Sunfall - under the Unending Reset and
  the Brazen Hide."*), a found Hollow's last hour is said
  to the realm once (*"... near Copperham will fade within the hour."*), and once one is gone the Timers count the next
  one's not-before - never where.

A forged `found` (a client claiming a pixel that is not the site) cannot place the Hollow anywhere else - every client
places it from its own map files. But it can say "found" - and open the realm - as early as the rise itself, and no check
the relay could make would stop it: every client holds the site, so a script stands its pose at the true door as easily
as at a false one (AUDIT SD II, L7 H1 - this said "a little early"). What bounds a forger past the find is the fight's
numbers, the gate's law (`World-Bosses.md` section 9: a page owns its body, and may refuse a boss's blows): one account
alone faces one share and deals at most three times its reference, so a modified client that refuses the Hour's blows
and steps over the Orrery and the Steps can fell an empty Hour's Remnant in about three minutes - and its fall collapses
the Hollow for everyone. AUDIT SD II closed what such a script would need a second account for (the stones' rights,
section 8; the signed level and the arena's share, section 10; the seats), and moderation has every name: the finder's,
each turner's, each fighter's. Whether a Hollow should need company to collapse is put to Mac (section 16, SD11).

## 5. The dungeon - Super

The Hollow is a spawned dungeon (`synthesizeDungeonLocation`, the Elite's), cloned from a template dungeon the slot's
hash picks from the Bay's labyrinths and keeps of at least 12 blocks with a spawn's clearance, never the main story's
(`systems/sdSite.js` `sdTemplates`), laid WHOLE (`world/smallerDungeons.js` `dungeonSizeFor`, by the tier law) - the
world's sizes (section 13) are not drawn for it: the feat is the longest walk its template has. It is named from the slot: *The Brass Hollow*, *The Stopped
Bell*, *The Unwound Halls*, *The Clockless Deep*, *The Hour's Wound*, *The Splintered Keep*, *The Last Bell of
<city>*, *The Hollow Under <city>*.

Its difficulty is the port's hardest:

| | Regular | Elite | Super |
|---|---|---|---|
| foes per enemy marker | 1 | 3 | 3 (the Elite's expansion; its 64 KiB foe frame was proven at 151 markers, the largest spawn template - a Hollow's templates, 12+-block labyrinths and keeps with up to two-block exteriors, are measured over MAPS.BSA and BLOCKS.BSA by `test/sd11f_scenes.test.js`, AUDIT SD II L8 D1) |
| foe health / damage | x1 / x1 | x2 / x2 | x4 / x2.5 |
| foe level band | the player's | the player's | at least 24 (the top band: Daedra, liches, ancient vampires) |
| elite foes (5x health, 3x damage) | 1 at 20% | 3-4 | 6 |
| loot | - | +20% | +50% drop and quality |
| dungeon fires | all | half | none - the Hour is cold |

The difficulty word is the location's (`loc.superTier`), read by one law (`dungeonTier`, section 12).

## 6. The end - the Rift and the Return

**The end** is the dungeon's enemy marker farthest from its entrance (RVN7's lair law, the one law `dungeonEndOf`
both the Rift and the Return read), on a floor the collider finds, the same on every client - an interior block's
first (SD-REACH: never a block's start markers, its maker's data set down anywhere, nor a border cap's, which ring the
layout and so held the farthest point - the Rift stood in pockets no walk reaches); every enemy marker with none there,
and the start markers only with no enemy marker at all. Out of the water where any is (AUDIT SD IV F38): a candidate
whose floor stands under its block's own water level is the end only when none of its kind is dry - a flooded block's
marker stood the Rift, the Return and the way back from the Hour at the bottom of the water. The Rift, the Return and the landing back from the Hour are
stood as the level is built, every door shut and every platform home, before a save or the room can open one - a door
open when they were stood moved all three, a client apart (AUDIT SD IV S1).

- **The Rift** - the large otherworldly portal: a ring of brass light up to 7 m across - as large as its hall allows,
  never under 2.6 m (`world/sdDungeon.js` `sdRiftFit`) - turning slowly about a black-gold membrane, its sound a bell
  heard under water. Pressing it (or walking into it) steps the player through to the Shattered Hour (the veil,
  `ui/gateVeil.js`), if the realm room admits them (`found` or later, before `gone`). Refusals are said in words an old
  client already understands: *"The Rift will not take you yet."* / *"The Hour has closed."* During the collapse it
  refuses a newcomer and admits again whoever went through it, as the realm keeps them - remembered on the device, the
  last eight Hours (SD11c: a reload forgot them, and the Rift shut on its own fighters). One who died in its Hour is
  refused for good: *"The Hour will not take you back."* (SD-ONELIFE). Its plaque counts its Hour under its own row
  (`world/sdDungeon.js` `sdRiftCount`): *Fades in 1d 22h*, its last day by the second - the Timers' own words, as its
  banner says it (SD20e T6) - *Collapses in 2:31* in its collapse (SD11f: a Hollow unbeaten closed on everyone in it with no count anywhere inside).
- **The Return** - a small portal of pale light beside it: it carries the player back to the dungeon's entrance (the
  start marker), and stands until the boss falls. With the kill the Hollow collapses (section 11) and the Return goes
  out with it. One back from the Hour is stood past the Return, clear of both portals' reach by more than a body
  (`world/sdDungeon.js` `sdLandingPlace`, SD_LANDING_CLEAR_M - AUDIT SD IV F35: a Return on a corner's diagonal had no
  bearing that led away from the Rift, and the way back stood them on its foot, one step from the way in). Every way out of the Hollow or its Hour lands before the Hollow's door - and, its door gone (the Hollow
  taken down at its end), where the player stood outside as they went in, never the Hour's own frame read in the
  street's (SD-LAND). The door is read in the street's own frame: the world host's door list keeps each door in its
  pixel's, and read raw it stood the player the streamer's vertical shift over the Hollow, in the sky (SD-SKY).
- **No Mark in a Hollow** (AUDIT SD IV F2): *"You cannot set a Mark in an Abyss Dungeon."* - a place that ends, as the
  court and the Hour are. A dungeon anchor knows its dungeon by its pixel alone, and a later Hollow may stand on that
  pixel in another layout: a Recall took the old one's spot there, in rock or the void.

## 7. The Shattered Hour - the place the Warp left

In 3E 417 the Numidium walked, and the Iliac Bay broke into every one of its endings at once: the Warp in the West, a
Dragon Break. The world mended - mostly. The Shattered Hour is what did not: the moment itself, kept outside time,
where the Bay's broken endings still turn against each other and the last of the Brass God still walks. Where the
Bay's people crowd thickest, their many souls press the world thin, and a dungeon beneath them is swallowed by a seam
of the Warp - a Hollow - whose deepest hall opens on the Hour.

The realm is a made level (`world/sdRealm.js`, the Court's pattern: a made location `0x7ffff200`, block index 900200,
one pseudo-archive, 38151 - records 0-4 the realm's, 5-20 the Orrery's hall, 21-22 the Steps, 23-24 the Echoes, 25-30 the
Endings' lights, 31-32 the Threshold's cobbles and the edge line, 33-35 the Rift's) laid
along +Z in the dungeon's frame:

| stage | where | what |
|---|---|---|
| **The Threshold** | z 0 | the landing, radius 8 m; the way back through the Rift (to the Hollow's end) |
| **The Orrery of Endings** | z 24-60 | the puzzle hall, radius 18 m (section 8) |
| **The Unmoored Steps** | z 60-220 | the platforming course, three spans (section 9) |
| **The Last Moment** | z 220-272 | the boss arena, radius 26 m, four brass pillars (section 10) |

The sky (`render/sdSky.js`): a void of brass light and slow aurorae, the Bay's skylines hanging upside down in it -
Daggerfall's towers, Sentinel's domes, Wayrest's bridges - the shards of the endings, turning on the realm's clock; a
great clock-face of stars behind the arena whose hands run backwards. The realm's clock is anchored (`anchoredClock`,
the Deadlands' law) so every screen shows the same moment.

The realm refuses what the Court refuses: rest, save, map, a Mark and a Recall, regeneration (`courtRules`) - and
Levitate (SD7b: a Levitate running lifts nothing in the Hour, as in a siege's room; its Steps are walked, not flown).
And as the court does (GATE-ALONE), it takes no companion through the Rift: the crew's hands and the sworn wait outside
the Hour, and come back to the player's side out of it (SD-ALONE, section 16).

**Its music** (SD13, `systems/sdScore.js`): the Hollow and the Hour have a score of their own - C minor and a clock
where the Warden's is D minor and fire. Its one motif is the Westminster quarters struck in the minor and BROKEN, the
fourth change ending on F sharp, the tritone, where the hour should strike; MENDED in C major as the Remnant falls. The
Hollow's walk; the Orrery's riddle; the Steps over the void; the Remnant's three phases, the Dragon Break's two themes
in canon (silver two beats behind gold); the Hour's last minute; the fall; the collapse. Where I stand chooses (the
hall, the Steps, the arena as near as its bar is heard), and in the arena the fight does.

**Its air** (SD14b, `scenes/sdAir.js`): four beds - the void's wind breathing, the Hour's works (a tick and a tock a
second) everywhere, the Orrery's hum in the hall, the arena's gears under its floor - and four kinds of far event on
the sky's clock: a bell tolled, a gear falling into the void, the void's moan, the shards grinding overhead. And seen
(SD14c, `render/sdMotes.js`): 1,220 motes - the hall's brass dust turning with the Orrery, sparks rising out of the
void under the Steps, the Hour's gold-green motes orbiting the arena against the clock, the shards' dust falling.

## 8. The Orrery of Endings - the puzzle

Six Ending-stones stand on a ring in the hall, each carved with one of the Bay's endings: **Daggerfall** (the lion),
**Sentinel** (the sun), **Wayrest** (the ship), **Orsinium** (the tusk), **the Underking** (the crown of bone),
**the Blades** (the dragon). Each stone shows an hour of twelve. The hall's floor is the Hour-dial; its rim carries six
**Ledger plaques**.

- **Turning.** A player within 3 m of a stone turns it one hour (forward or back). The stones are GEARED: turning one
  turns its partners too - some forward, some back, some by two. The gearing is not shown; it is learned by turning.
- **The answer.** The Concord is reached when every stone stands at its true hour. The plaques say what the true hours
  are, in riddles: some plainly (*"Daggerfall keeps the third hour."*), most against each other (*"Wayrest keeps the
  hour Sentinel keeps, and two more."*, *"The Underking stands opposite Orsinium."*, *"The Blades stands as far before
  twelve as Daggerfall stands past it."* - SD11e: it read *"Read the Blades from twelve backwards and you read
  Daggerfall."*, which also reads 13 - h). Together they fix every hour, and only one way.
- **What the hall tells you.** The dial lights one segment for each stone that stands at its true hour - how many, not
  which.
- **The fray.** Every turn frays the Hour. At 48 turns it snaps back: every stone returns to where it began, and the
  Hour lashes those in the hall whose turns since the last snap did not bring it nearer (25% of their health, no save) -
  a hand that mended another's turns, or never touched a stone, stands (AUDIT SD II, L7 H2: it was everyone in the hall,
  a griefer's weapon). Turning at random does not get there.
- **The stones' rights** (AUDIT SD II, L7 H2). The thread is the hall's, and no one hand spends it: every turn moves
  the road to the Concord by exactly one, and a turner that has turned the long way six times since the last snap is
  refused while anyone else has turned in the last minute - *"The stones will not answer you while others turn them."*
  A lone learner is never held, and a solver who knows the way never is; every guest turns as one (a guest is one
  click). One griefer spends at most a dozen turns of the forty-eight.
- **New every time.** The gearing, the starting hours, the true hours and the riddles are drawn from the slot's seed,
  so no Hollow's answer is another's.

The law (`net/sdBrain.js` `orrery*`): the gearing is a matrix `M` over Z/12 - ONE unit-triangular matrix in a hidden
order (`M = P U P^T`), so its determinant is 1 and EVERY target is reachable, each stone turns itself exactly one hour,
and a hall can learn it by turning each stone once (SD6a: the design first named the product of a lower and an upper
unit-triangular matrix, whose diagonal is not one - a stone would turn itself two hours or none). The riddles come
first, a chain from two plain clues, each later clue a true bijection tying a new stone to one known before it, so the
true hours `T` are their unique solution (pinned by brute force over all 12^6 configurations); the start `P0` is drawn
until the shortest way from it, `t = M^-1 (T - P0)`, is 12 to 24 turns - room under the fray to learn and err. The relay holds the
stones, the fray and the Concord; a turn is `{t:'sd',k:'pz',i,a,q}` from a fighter whose pose is within reach of stone
`i`, one turn per stone per 700 ms (the gear settling), at most 3 a second per account, under the stones' rights
(`orreryMayTurn` - judged and refused by the relay, which tells the refused turner alone, `w`). The Concord, once
reached, is kept for the slot.

## 9. The Unmoored Steps - the platforming

With the Concord a bridge of light opens from the Orrery to the first of the Steps. Three spans over the void, each
begun at a stone checkpoint:

1. **The Drift** - eight brass platforms swinging side to side (2-4 m from side to side, periods 4-7 s, each its own
   phase), the gaps a running jump's (2.4-3.2 m when two line up).
2. **The Beat** - seven platforms that are there only on the Hour's beat (solid 2.4 s, gone 1.2 s, alternate stones
   half a beat apart, each blinking the 0.4 s before it goes), and two brass RISERS between them: walls 2.3 m tall, run
   up (CLIMB3's wall run) or climbed, the course a riser higher after each.
3. **The Crumble** - eight cracked platforms, each a step down to the arena's floor, that shake for 0.7 s after a foot
   touches them and fall (back after 5 s), and the Warp's breath across them: a gust every 6 s pushing 3 m/s sideways
   for a second, left and right by turns, its wind heard the second before and seen from then through the gust - brass
   streaks blowing across the span the way it will push (AUDIT SD II).

Amended to the engine (SD7a): the design's gaps were a running leap's (4-6.5 m), and a leap flies 4.1 m at Jumping 0 -
gaps that only a trained leap crosses shut out every build that never trained it, so the gaps are a plain running
jump's at a modest build (Speed 40, Running 20: 3.1 m), the skill buying margin, not entry; the walls are run UP
(CLIMB3 runs up a wall met straight, and the engine has no run along one), so they are risers, not a corridor; and the
course is 145 m from the first step, so the Steps run to z 220 and the arena stands at z 246.

Falling below the course (y < -30) casts the player back to the checkpoint of the span they last stood in (a
checkpoint's island its own span's; one who stood on none, A) with 15% of their health lost (*"The Hour casts you
back."*). The platforms move on the realm's anchored clock, so every player sees the same Step in the same place;
crumbling is each player's own (a platform one player broke is whole for the next). The Steps are not the relay's: a
player who reaches the arena simply arrives, and the fight judges where they stand.

## 10. The Last Moment - the Brass Remnant

What the Warp kept of the Numidium: a brass colossus four times a man's height, its chest an open cage around a heart
of shattered soul-gem light - the Mantella's echo. The relay runs it (`net/sdRemnant.js`, beside `net/sdBrain.js` - SD8a), as
it runs the Warden.

**Health.** Each fighter who enters brings `SD_TTK_S` (420 s) x `dpsRef(lv)` x 1.25 to its health - more than twice the
Warden's share (525 s of reference damage against his 240; 1.75x a Colossal Warden's) - added at its current fraction
(the gate's `joinFight` law), at the level its token signs (`cl`, its character's own - AUDIT SD II, L7 M2: the page's
claim stands only from a service that signs none). A fighter is in the fight while its pose stands in the arena
(`SD_ARENA_SLACK`, 1.5 m past its rim - never the Steps: SD11e) and is fresh - a pose older than `SD_POSE_FRESH_MS`
(25 s: the heartbeat's 20 and five of grace) stands nowhere (SD20a: a frozen page stood there earning); one away from it
30 s takes its share out, and brings it back as it returns. Joined to a living fight and standing in the arena, a
fighter is held on its floor: the near edge, where the Steps' band lets go over the void, is a rim to it (SD20a). The same caps on how much a blow is believed (the gate's buckets), one seat per account, 256
fighters at most - and the realm's door admits 256 accounts, a full one freeing the seat of one with no socket in it
and no seat in its LIVING fight (the gate's AUDIT WB A1 law; AUDIT SD II, L3 F3: a lost or stale fight seats nobody),
guests 64 of them at most (L7 M3).

**Phase one - The Walking Hour (100% to 70%).**
- *Brass Stomp* - a 7 m circle, then a shock ring rolling out to 22 m that must be JUMPED (from the circle's rim - what
  the circle strikes the ring does not; it strikes where its front's centre crosses a body on the ground: SD11e).
- *The Hour-Hand* - a beam from its chest sweeping 180 degrees over 4 s; stay ahead of the hand or behind a pillar (below
  its top - a pillar shades nothing standing on it: SD20a). As it
  gathers, the beam stands at the edge it will sweep from (SD11e).
- *Gear Volley* - five spinning gears thrown at five fighters, 3 m circles where they land, burning brass for 6 s.
- *Mantella Pulse* - every 30 s, the whole arena: 12% of health, +2% each pulse to three quarters at most, no save
  (SD20a: under a Hollow's marks it passed the whole).

**Phase two - The Dragon Break (70% to 35%).** The Remnant steps outside time (it cannot be struck) and two Echoes of it
stand in the arena, the GOLD and the SILVER, each with half of what is left. They must die within 15 s of each other:
an Echo left alone for 15 s rises again with half its health. While both stand, each Echo's blows are its own phase-one
blows, faster (80% wind-ups); the Hour-Hand sweeps from both.

**Phase three - The Last Moment (35% to 0).** The Remnant returns, faster. Every 50 s it winds up THE RESET (8 s - never
inside a Pulse's wind-up, and a Pulse due inside it waits until 4 s past its landing: SD20a): Heart
crystals rise around the arena (3, plus one per two living fighters, at most 8). Break them all before it lands and it
is stunned for 8 s and takes 1.5x; leave one and the Reset lands - 70% of everyone's health, no save - and it heals 8%.
The Hearts rise as near as their count needs: 6 m from the centre out to 2 m more for each past the first (6-10 m for
three, 6-20 m for eight), never in its body (SD11e: they rose 8-22 m out however few, and a lone fighter in melee lost
three Resets in four to the walk).

**The Hour Ends.** Fifteen minutes after the first blow, the Hour ends: every 2 s, 99% of everyone's health. A group that
cannot finish it in fifteen minutes does not. Its word stops every body 2 s before it lands; a blow lands until its moment
and none after it, whether or not the realm's beat has said so (SD11e - the gate's midnight).

Read and amended in the law (SD8a): the Echoes' "half of what is left" is half of what is left to the break's end (35%),
so the two together are the phase, and a blow on either comes off the whole; while both stand each fights with the Stomp
and the Volley, and the Hour-Hand is the pair's - every 14 s from both at once, each holding for the other, gold turning
one way and silver the other (left to each, the two fell out of step and the Hand came from one) - but both at ONE
fighter standing beyond the two, silver turns gold's way, so the two beams cross it the same way (SD11e: from either side
they closed on it, and from the arena's south end no run escaped them); one left alone fights with all three. The Mantella Pulse is the Hour's own clock, not the Walking Hour's alone: every 30 s from the wake through
every phase, the heart beating whether it is struck or not. "The first blow" is the Remnant's own, at the opening's end
(8 s after the first fighter's `in`): a fight nobody strikes still ends. A blow cannot take it past the phase it is in
before the turn. The Hearts hold three seconds of the living's reference damage between them, each at least 20 - or one
second of the living's damage, where that is less (SD20a: a lone fighter at level one met ten seconds of its damage in
the 7.5 they stand). And a fight no living
fighter has stood in for 30 s is LOST - the next is fresh: it is meant to be lost, many times; so is one whose Hour has
Ended, 30 s after its End, whoever's last pose still stands in it. The fight's door asks the realm's Concord (no `in`
before the Orrery is set), and no blow lands once the hub's record no longer holds the slot.

**What it asks of a build.** Its blows are shares of the struck player's own health (the gate's law), so no amount of
health makes it safe; the pulses and the Reset are unresisted magic, so no resistance makes it safe; it cannot be
paralysed, slowed, charmed, reflected or soul-trapped; nothing regenerates in the Hour; the Reset is a damage race and
the Dragon Break a coordination race; the Hour Ends is a clock. It is meant to be lost, many times, before it is won.

**Its marks** (SD18a, `net/sdMarks.js`). Each Hollow's Hour keeps one of six ENDINGS - the Orrery's own stones - and two
of nine OMENS, its place in a cycle of 216 by its slot (6 Endings x 36 pairs of omens, past the gate's 144; no two
Hollows running share an Ending or an omen, and every Ending meets every pair once). The Ending sets the element of the
Remnant's and its Echoes' own blows (the Stomp, the Hour-Hand, the Volley and the brass it leaves; the Pulse, the Reset
and the End stay no-one's) and its signature: **Daggerfall**, the Lion's Roar (shock - the Stomp's ring rolls out to the
arena's rim at 13 m/s); **Sentinel**, Sunfall (fire - seven gears, the brass burning half again as long); **Wayrest**,
the Turning Tide (frost - the Hour-Hand sweeps three quarters of the arena over five seconds); **Orsinium**, the Tusk
(poison - it walks 40% faster, its Stomp 8.5 m); **the Underking**, the Hungering Heart (magic - the Mantella pulses
every 22 s); **the Blades**, the Dragon's Haste (fire - its Echoes walk a fifth faster and must fall within ten
seconds; SD20e T9: it was the Dragon's Break, one apostrophe from the phase it shapes). The omens: *the Brazen Hide* (a quarter more health), *the Quickened Gears* (its own blows wind up in 85% of
the time), *the Short Hour* (it Ends at twelve minutes), *the Hardened Hearts* (a quarter again as much - half again
until SD20a, a race no party ran), *the Burning Brass* (twice as long, a third wider), *the Fraying* (the Orrery snaps at
36 turns), *the Restless Pulse* (each four points harder than the last, to the same three quarters), *the Unending Reset* (every 40 s) and *the Twin Hands* (the pair's Hand every 10 s). The relay
runs the fight by its profile (`net/sdRemnant.js` `sdFightProfile`) and stamps each blow whose shape they change with
the change (`sh` - its radius, ring, sweep, pool, wind-up, Pulse step and element), so every screen judges, draws and
reads the blow the relay threw; the state carries the marks (`mk`) for the rest. They are seen (SD18b,
`ui/sdMarksView.js`): the gate's own marks card as a fighter steps into the Hour (its Ending's signature, element and
light, its omens, each its own sign and how to meet it - nine seconds, low on the right) and its row under the Remnant's
bar all fight long; its wake's card names the Ending it keeps; its own blows' colours lean to its element and its brass
burns in it - rimed, charged, venomed or soul-lit, the gate's own grains; a strike in its element is softened by the
struck player's resistance to it (the gate's saving throw; magic's added for the Underking); its stone glows in its
light in the Orrery's hall, and the fray's arc goes round once by the Hollow's own snap.

**How its blows are seen** (SD16, `scenes/sdFx.js`). Each landing and turn is a burst of sparks on the gate's own spark
pass (`render/gateFx.js`) in the Hour's own 17 kinds and colours - the Stomp at its feet and its ring's dust as it
rolls, the Hour-Hand's light out of the chest, the Volley's gears at each mark, the Pulse, the Reset and the End over
the arena's heart in the Mantella's green, its white and red, each Echo risen and broken in gold or silver, each Heart
risen and broken, the stun, its wake, its gears slipping under a fifth, and its fall: a burst out of its chest, a column
of brass as its body sinks, and the way home's pale light where it rises. Nine of them shake the camera by how near they
fell (the whole arena for the Hour's own), and eleven light the floor where they fall; the fall flashes the arena
white-gold. Every spark comes to rest on the arena's floor, and the floor ends at its rim (`SD_FX_EDGE`): past it a
spark rests on nothing and falls on into the void, and the ring throws no dust past it (AUDIT SD IV R3).

**How it moves** (SD17, `scenes/sdRemnantRig.js`). The Remnant and its Echoes stand in seven parts - a pelvis where the
body stands and six turned about their joints (two legs at the hips, the torso at the waist, the head at the neck and
two arms at the shoulders, riding the torso) - by a pure law of the fight, in 18 states: bowed and dormant before its
wake, flinging its arms wide as it wakes, breathing, striding a leg planted at each footfall the voice hears, a leg
raised for the Stomp and slammed at its release, its right arm raised to point and its waist turning with the
Hour-Hand's beam, its arms gathered back and thrown for the Volley as its gears leave its hands, arched for the Pulse,
its arms raised and trembling for the Reset and slammed down as it lands, spread to the sky as the Hour Ends, slumped
kneeling when stunned, its arms lowered as it rises, staggering on a seeded beat under a fifth, and toppling as it
sinks. The Volley's gears fly from between its hands to their marks, and the Hand's beam runs out of its pointing hand
along the sweep's bearing to the floor - stopped at a pillar's face, as the law shades what stands behind one.

## 11. The feat - receipts, spoils, the set, the title, the aura, the collapse

**The kill (relay).** As the gate's: kept before it is said, one fall at a time, the hub told until it answers. Each
fighter who EARNED it (dealt 2% of their own share, or stood alive half the fight - the gate's `earned`) gets a receipt
`h1` signed with the relay's key: `{d:s, b, s:account, c:seed, x, l}` - the slot, the boss, the account, the relay's
own seed, how it was earned, the admitted level. The hub keeps each as `sdrc:<sub>` for the week a receipt lives.

**The spoils (client, from the receipt's seed).** Thrown from where it fell, clear of a pillar it fell into (the gate's
spoils pool, its keys its own - SD9e: `systems/sdSpoils.js` rolls them, `scenes/sdSpoils.js` throws them a moment into
the fall from the cage of its chest toward the fighter, kept on the arena's floor; a receipt that comes outside the
realm - the hub's, heard on the hub's own link - is its spoils straight into the pack, and so is my realm's own whose
throw never came, as I leave the Hour). A fighter who dealt and one who stood are paid alike, as the gate pays them:

| | |
|---|---|
| gold | 400 x level, +-20% |
| one piece | Legendary or better 25% of the time, else Rare |
| two pieces | Rare or better (source tier 24, luck 70) |
| THE BRASS OF NUMIDIUM | one piece, one time in three (rolled after the pieces, so their rolls never move) |
| the Hourlock | one time in fifty - a Gilded Thunderlock (GILDED1, `06-Systems/Gilded.md` section 4): one draw every time, rolled after the Brass, last of all, so it never moves an earlier roll; online alone, as the Hour is |

**THE BRASS OF NUMIDIUM** - a new Aetheric set (`systems/aetheric.js`, `systems/sigilSets.js`): Dwarven pieces, the
Dwemer's brass, nine records in the places' order - the seven body pieces, a round shield and a ONE-HANDED Longsword,
so all nine are worn at once (SD9d: the design had named a longsword, a war axe and a staff - three weapons for the one
place a set counts; `Sigil-Sets.md` section 6d). Its set law (online only, asleep in duels, the Sigil Sets' rules -
every number a whole pair from Faint to Ascendant, the design's own numbers the Ascendant end):
- 2 pieces: DWEMER BRASS - +4 -> +10 resist magic and shock;
- 4 pieces: GEARWARD - the next foe's blow that lands on you is 15% -> 30% lighter; the gear winds again in 18 -> 12 s
  (the Brass Remnant's own blows and its Echoes' - never the Hour's magic - are a foe's for it alone, `Sigil-Sets.md`
  section 8);
- 6 pieces: THE HOUR TURNS - a blow that would kill you does not, and 15% -> 25% of your health returns; it recovers
  in 90 -> 60 s.

**The title and the aura (account service).** `POST /v1/sd/claim` verifies the `h1` receipt, writes one row per
(slot, account) and, ON THAT FIRST WRITE ONLY, rolls from a seed of its own drawn at the claim (SD20b - the receipt's,
which the page holds, let a guest read its roll before it registered): the title **Hourbreaker** one time in
four, the aura **The Turning Hour** - a slow wheel of brass gears and gold light about the wearer - one time in eight.
Once held, held for good. The profile counts *Hours broken*. (SD9b: the roll is its own stream, salted - never the
spoils' draws, which are the receipt's seed's alone; the grants are laid on the account's row, `players.sd_honours`, by the kill's
row alone, and read off it as the Broker's sale is - so every badge the service mints carries them with no other read.)

**The collapse.** The kill sets the record `fell`; for `SD_COLLAPSE_MS` (3 minutes) the realm stands so the spoils can
be taken and a way home rises where the Remnant fell, clear of the pillars (to the Hollow's door, OUTSIDE) - pressed,
never walked into, for it stands where the spoils land (SD11f, the gate's SS3); it rises out of the floor with the
Rift's bell tolled once, a fourth higher, and the Hour says *"The way home stands open."* Then `gone`: on every client
the Hollow sinks into its pixel, its column of light goes out, and anyone still in the Hollow or the Hour is cast out
before its door: *"The Hour closes, and the Abyss Dungeon folds in on itself behind you."* (SD10a: the way home is the Return's
pale light, risen once the Remnant's body has sunk; whoever stands in the Hollow or the Hour is told how long is left -
at the fall, then at a minute, thirty seconds and ten. The Hollow is taken down at its end, not sunk: a location's
blocks have no sink in this port.) (SD11c: one dead at the end is cast out the frame a Resurrect raises them where they
lay - never left standing in an ended Hollow; out of the Hour under its veil; and the end is judged where a player
stands, so a step under the veil that lands after it is cast out on landing.)

## 12. Regular, Elite, Super - the labels

One law, `dungeonTier(loc)` (`systems/dungeonTier.js`, a leaf): `'super'` for a Hollow, `'elite'` for an Elite spawn,
`'regular'` for every other dungeon - and null for a place that is not a dungeon. Its words, `DUNGEON_TIER_TEXT`:
**Regular Dungeon**, **Elite Dungeon**, **Abyss Dungeon** (ABYSS-NAME, below) - and, beside them since the world's sizes (section 13), the
dungeon's SIZE, **Small**, **Medium** or **Large**, by the built dungeon's block count as the room builds it online
(`world/dungeonLabel.js dungeonTierLabel`, which gives no label to the places the port made: the Burning Court, the
arena's floor, its undercroft and the Shattered Hour). One phrase everywhere: *Elite Dungeon, Small*. Said online, where
the tiers differ; offline every dungeon is DFU's. Shown:

- **the entrance plaque** (World Tooltips): the title is the tier's words, the subs *To <name>* and the size - as
  Elite's already was; offline (and over the undercroft's stair) the mod's own *To <name>*;
- **the held map** (enhanced): the hover label carries the phrase after the dungeon's name, *Region : Location (Regular
  Dungeon, Large)*, and the I-key box opens with it, before DFU's own refusal. Its marks are the Bay's own places
  (MAPS.BSA), so the phrase it says is a Regular Dungeon's: an Elite spawn stands on a pixel with no place and has no
  mark there, and a found Hollow answers by its ring and its card (AUDIT SD III, SD20e T8: this line promised *Elite
  Dungeon* on the held map, and the list below the Abyss tier's words on it);
- **the overworld plates** (TV6): a found dungeon's place plate carries the phrase under its name, a far plate before
  its distance;
- **the sight line**: *You see an Elite Dungeon 460 metres to the Northwest!* - and a Super's, *an Abyss Dungeon*;
- **on entering**: one line, the phrase (either skin - online is the port's own game).

Not on the classic travel map, automap or logbook: they are native windows, and DFU has no such word (the NATIVE-WINDOW
RULE).

ABYSS-NAME (2026-10-07, Mac: *"Btw lets rename Super Dungeons to Abyss Dungeons (Keep the code in tact, this is for
player facing putposes)"*): THE PLAYER READS **ABYSS DUNGEON** wherever the game said Super Dungeon - the tier's words
(the entrance plaque, the overworld plates, the line on entering), the sight line (*an Abyss Dungeon*),
the find's line to everyone online (`net/sdLaw.js` `sdFoundLine`), the held map's legend, the ring's card, the notice
board's note, the Timers row and its label, and a Hollow's line said before its place is known (*an Abyss Dungeon*).
The code keeps its names - the tier `super`, `superTier`, `sd*`, the SUPER-DUNGEONS arc and its slices - and so does
this page: where it says Super, the player reads Abyss.

## 13. The world's dungeon sizes, the online law (SD-ONLINE)

THE DELVE ARC shipped Medium Dungeons (DSIZE1) as an Enhanced row, off by default and refused online - every peer in a
dungeon room must lay the same layout, and the settings are each player's own. Mac first made medium the online
default; then, on second thought, *"Large, medium and small should all play into account online"* - and, asked whether
that meant each player's pick or the world's, chose **the world mixing sizes**: every dungeon has ONE online size,
small, medium or large, the same for every player, most of them medium. So online the size is no setting at all but
the room's law:

- **`onlineDungeonSize`**: one draw of the port's seeded die (`systems/wind.js seededFirst`) on the dungeon's map id
  and its own salt, weighted small 1, medium 2, large 1 (`ONLINE_DUNGEON_SIZES`) - a quarter of the DRAWS small, half
  medium, a quarter whole - the same on every client, every visit, for good. What is BUILT is not that split (AUDIT SD
  III, SD20g D2: this line said it was): a dungeon of five blocks or fewer is small whatever it draws, one of eight or
  fewer is never more than medium, and the main story stays whole - over MAPS.BSA's own sizes the Bay's labels read
  about two in five Small, a little under half Medium and one in seven Large (the draw itself 26/50/24 over forty sets
  of ids). Mac's word was that the sizes mix ("World mixes sizes"), and they do; weighting the draw by a dungeon's
  blocks, to read a quarter Large, is his call - reported, unchanged.
- **`dungeonSizeFor`**: online answers the world's size, whatever either switch or a quest's frozen copy says (the main
  story's dungeons and the arena undercroft stay whole, as they always have); offline the settings decide, as before.
- **The quest stamp** online is `ONLINE_DUNGEONS_STATE` (4, appended past the medium size's 3): "each dungeon at the
  world's size for it", so a quest started online builds its dungeons at their online sizes offline too.
- **The re-lay** (AUDIT DELVE E1) turns around: an online character's quests stamped at any other size (DFU's NotSet
  included) are re-laid on the room's builds and stamped with the world's sizes.
- **The rows**: `world-dungeon-sizes` (*Dungeon sizes as online*, Enhanced) asks for the world's sizes offline; online
  the lane forces it on and the sync copies it home, so offline play can match. Under DFU's Smaller switch, over the
  medium row, which is forced off online.
- **A dungeon's room is its layout's.** A dungeon room's memory and its streams address foes, doors and piles by their
  index in the layout, the relay keeps a room's memory for 30 days, and a page from before this still lays every
  dungeon whole - memory written by one layout would be read by index into another, foe i of one standing in a wall of
  the other, and two pages in one room would trade blows on each other's foe i. So a re-laid dungeon stands in a room
  of its own, `dungeon:m<id>.s` or `dungeon:m<id>.m`, as a building's room is its layout's (WD3): named off the BUILD
  (`builtDungeonSize`), admitted by the wire's one room law at both ends (`WORLD_ROOM`, `DUNGEON_ROOM_TAGS` - a relay
  change, `world176` - section 14). A dungeon built whole keeps `dungeon:m<id>`, and its memory - and shares it, rightly, with an
  older page, which lays the same whole dungeon. (This page first said each frame would carry the layout's size, `lz`,
  and a receiver refuse another's; a room per layout needs no receiver to refuse anything, and an old page's blows -
  which carry no stamp - cannot reach a re-laid room at all.)
- **The Super dungeon** is always whole (section 5): the feat is the longest walk the template has.

## 14. The wire

One new frame type, `sd` (`net/wire.js`: `SD_KINDS`, `validSdIn`, `validSdOut`, `SD_RELAY_MIN`, `relaySupportsSd`,
`SD_BRAIN_V`/`SD_BRAIN_MIN`), behind a relay-version gate - the relay closes a socket on a frame it does not know.

| from -> to | kinds |
|---|---|
| client -> hub | `spent {s}` |
| client -> cell | `found {s,px,py}` |
| client -> `sd:<s>` | `in {lv,bv}`, `pz {i,a,q}`, `hit {q,d,r}`, `ehit {e,q,d,r}` (an Echo), `xhit {c,q,d,r}` (a Heart) |
| hub -> client | `ev {s,ph,r,at,foundAt?,fb?,fellAt?,top?,n?,until,next}`, `rcpt {r}` |
| `sd:<s>` -> client | `st` (the whole state), `pz {st,f,lit,ok,ls?,w?}`, `mv`, `atk`, `hp`, `ph`, `ec` (Echoes), `cx`/`cxb`/`stun` (Hearts), `fell`, `rcpt`, `no {m}` |

Internal doors (object to object): `/internal/sd/census`, `/internal/sd/found`, `/internal/sd/live`,
`/internal/sd/fell`. The Worker mints an `sd:<s>` object only for the slot the hub's record names and only while it is
`found` or `fell` (the gate's `gateHolds` law, read from the hub through `/internal/sd/live`). A hub that does not
answer that ask is no answer, never "no record": the Worker mints nothing (the socket fails and the page reconnects on
its backoff), and the realm refuses a hello as busy (`CLOSE_BUSY`, which the page tries again - never *"The Hour has
closed."*, which casts a fighter out for good), leaves an `in` unanswered (the page says it again), stops no blow, and
asks again - one ask in flight, a miss not asked again for 2 s, and the last answer standing through misses five minutes
(AUDIT SD II, L3 F2: every frame asked on its own, and a miss threw a good record away); a hello is refused busy only by
a realm that never had one.

SD3 shipped the first of the table: `found` (client -> cell) and `ev` (hub -> client); the rest arrive with the slices
that use them (SD6's `pz`, SD8's fight, SD9's receipts), each extending `SD_KINDS`/`SD_OUT_KINDS` under the arc's one
relay version, re-hashed in place while it was undeployed - `world176` (`world171` on the branch, renumbered past main's
CRYSTAL-FIST, WATCH-FIX, SERPENT3, LEGACY7 and TEXT-F1 at the merges). `world176` IS DEPLOYED (2026-10-08, at #632's
merge: relay-deploy run 37771760584, "deploying world176 over world175", verified), so it is re-hashed no more: the
deploy compares the version string alone, and bytes changed under it would merge green and never reach a player. The
arc's next relay change mints a version of its own, with its own row (AUDIT SD IV (9)).
SD6b shipped `pz` each way - the realm's out frame is the hall,
`pz {s,st,f,lit,ok,i?,a?,id?,q?,x?}` (the turn that made it so, its turner and number, and `x` when the Hour snapped
back - AUDIT SD II: with `ls`, the peers its lash falls on; and `w` 1, to a turner alone, when the stones refused its
turn). SD8b shipped the fight: `in`, `hit`, `ehit {e,...}`, `xhit {c,...}` in, under the fight's own bucket (`sdFightGate`,
the gate's 16 a second) and its brain's number (`SD_BRAIN_V` 1 - `no` below `SD_BRAIN_MIN`); out, the whole fight (`st` -
`net/sdRemnant.js remnantStateOf`, numbered `fi`; SD8c: `me` 1 in the realm's answer to an `in` it counted, alone),
each body's `mv` and `atk` (its `b`: 0 the Remnant, 1 GOLD, 2 SILVER, 3 the Hour), `hp`, `ph {n,at,up}`, `ec
{e,at,d?,n?,r?}`, the Hearts' `cx`, `cxh` (their health - the gate's `cxh`, which the table above left out) and `cxb`,
`stun`, `fell`, `lost {at}` (a fight lost - the table above had none: the next `in` makes a fresh one) and `no {m}`; and
the realm's door to the hub, `/internal/sd/fell`.
SD9a shipped the receipts: `rcpt {r}` out - an `h1` (`net/sdReceipt.js`, bounded by `SD_RECEIPT_WIRE_MAX`, signed or
not, nothing else's) from the realm to each earner at the fall and again at a late `in`, and from the hub at a hello while
it is good and to an earner's seat at the fall; `spent {s}` in, to the hub alone (junk anywhere else), on the find's
bucket; the realm's tell to the hub carries its receipts (`rc`, [account, receipt] each) and who stood in the realm
(`here`).

SD-HELLO: a page says nothing into `sd:<s>` but its hello (and the runtime's own ping) until the realm welcomes the
socket. The realm's hello asks the hub (`/internal/sd/live`) before it names the socket, and a Durable Object takes the
socket's next frame while that fetch is out: a pose read then is a pose before hello, refused for good. What waits for
the welcome (`net/online.js` `_welcomed`): `_send` and all it carries, the pose and its halo copies, the last pose, the
Orrery's turns and the fight's words; and, since AUDIT SD IV (0), the look (`_flushLook` holds it while any open socket
is unwelcomed, then says the latest), every directed frame (`_socketFor`: trade, cast, card, page, duel, wed -
`reachesPeer` still counts a socket that has said its hello, so a hello's round trip ends no trade), a `who`, and the
parked team's word (said in every room joined, so it went on the first frame after every realm hello). Renown and the
guild's order wait on each socket's own welcome. The lanes of the other rooms (a cell's, a world room's, the hub's, a
gate's, a battle's, an arena's) write their own socket and never run in `sd:<s>`.

## 15. The four hosts

| host | what it carries |
|---|---|
| `scenes/world.js` | WIRED: the record, the omen and sighting, the found word, the Hollow at its pixel, the map/compass/timers, the realm's link, court, spoils, receipts, the veil, the ejections, the labels' entry line; one life a Hollow (SD-ONELIFE); the Hour's score (SD13), its voice, air and motes (SD14), the arena read and its title card (SD15), its blows seen (SD16), the Hour-Hand's beam (SD17), the marks card, the element and the save (SD18b), the taverns' word by the Ending (SD18c), the brass air, the door's banner and card (SD19 - the fog's grade through `scenes/shared.js` `setBrass`) |
| `scenes/worldModes.js` | WIRED: `enterSdRealm` / the way home, the realm's per-frame arm (lighting, fog, sky, the Orrery, the Steps, the arena), the dungeon's exit to the Hollow's door, the step through the fire under way (`stepping`, AUDIT SD III) |
| `scenes/dungeonContext.js` | WIRED: the Super difficulty, the end (`dungeonEndOf`), the Rift and the Return, the realm's bodies (the Remnant, the Echoes, the Hearts) behind the gate's three seams, the refusals; the rig's body, its parts and gears (SD17), a strike's cast by its element (SD18b), the Remnant in its Ending's light (SD18c) |
| `scenes/exterior.js` | FLAGGED: the `?exterior` bench is offline; there is no Super dungeon offline. Its plaque is the World Tooltips mod's own *To <name>* - the tiers are said online alone (section 12). |

## 16. Slices and their records

| slice | what |
|---|---|
| SD-ONLINE | section 13 |
| TIER1 | section 12 |
| SD1 | `net/sdLaw.js`: slots, the record's law, the census pick, the find's check (`sdFindBelieved`), the room key |
| SD2 | `systems/sdSite.js` and the Hollow at its pixel: the city, the site, the clone, the omen, the sighting, the plaque |
| SD3 | the relay: the director, the census, the found word, the realm room, the wire, `RELAY_VERSION` |
| SD4 | the Super dungeon: its difficulty, its end, the Rift and the Return |
| SD5 | the Shattered Hour: the made level, its sky, the way in and out |
| SD6 | the Orrery of Endings |
| SD7 | the Unmoored Steps |
| SD8 | the Brass Remnant |
| SD9 | the feat: receipts, spoils, THE BRASS OF NUMIDIUM, the claim, Hourbreaker and The Turning Hour |
| SD10 | the collapse, the readouts, the audit |
| SD11 | AUDIT SD II |
| SD-ONELIFE | one life a Hollow |
| SD13-SD19 | the detail past the gates: the score, the voice, the air and the motes, the arena read, the blows seen, the body moved, the marks, the Hollow's presence |
| SD20 | AUDIT SD III |
| SD-ALONE | no companion through the Rift |
| SD-REACH, SD-LAND | the Rift where a walk reaches; never out in the Hour's sky |
| SD-SKY | the way out of the Hour, and the find's door, in the street's own frame |
| SD-HELLO | a socket says nothing past its hello until the realm welcomes it (the page's half) |

Each slice records below what it shipped, what it pins and what it leaves.

### SD-ONLINE - shipped 2026-10-05

Section 13, whole. `world/smallerDungeons.js`: `onlineDungeonSize` (the world's size for a dungeon: one salted draw of
the seeded die on its map id, `ONLINE_DUNGEON_SIZES` small 1 : medium 2 : large 1); `dungeonSizeFor` online answers it
(AUDIT WORLD34 B2's one layout, which was the whole dungeon), and offline a quest stamped `ONLINE_DUNGEONS_STATE` - and
the `world-dungeon-sizes` ask, under Smaller and over Medium - answer it too; `smallerDungeonsStateNow` online (and
offline with the ask) answers ONLINE_DUNGEONS_STATE; `adoptLinkedDungeonSize` treats the world's sizes as a port's
size beside the medium one; `builtDungeonSize` reads the size off the build. `systems/quest/questRepair.js
relayOnlineDungeons` (it was `relayWholeDungeons`): every running quest stamped at another size - DFU's NotSet
included - has its dungeon markers enumerated again on the room's builds, its placements put back, and its stamp set to
the world's sizes; a quest one of whose dungeons cannot be read keeps its stamp. `systems/features.js`: the new
`world-dungeon-sizes` row (forced on online), the medium row forced off online, and both size rows' notes say what
online does; `systems/onlineSync.js` copies the forced rows home. The room: `net/online.js roomKeyFor` takes the
dungeon's `size`, the mode machine's identity carries `builtDungeonSize(dungeonLoc)` and the world host hands it on;
`net/wire.js` admits `dungeon:m<id>.m` and `.s` (`WORLD_ROOM`, `DUNGEON_ROOM_TAGS`, `dungeonRoomTag`), so
RELAY_VERSION is `world172` - the arc's one version, re-hashed in place while it is undeployed (`world171` on its branch,
renumbered past main's CRYSTAL-FIST at the merge; `world176` now, past WATCH-FIX, SERPENT3, LEGACY7 and TEXT-F1 at later
merges - section 14).

The slice was first built as "medium everywhere online" (Mac's first word) and turned to the world's mix the same hour
on his second; nothing of the first shape shipped but the room per layout, which both needed.

Pins: `test/sdonline.test.js` (10 - the world's sizes and their weights, the size law online and off with its guards
and the stamps, the build's size, the room law at both ends, driven end to end, the hosts by source, the row, a session
in the medium and the small rooms, the relay's Room keeping each size's memory apart; MAPS.BSA whole with ARENA2);
`test/dsize1_mediumdungeons.test.js`, `test/ft1_smallerdungeons.test.js`, `test/auditworld34.test.js`,
`test/uxb1e_onlinesync.test.js`, `test/features.test.js`, `test/ft18_features.test.js` (PINS MOVED);
`tools/mutants/sdonline.json` (13) and `tools/mutants/dsize1.json` (27), all dead. Deploy: relay first (a page of this
build on a relay before `world172` - `world176` now - joins a `.s` or `.m` room the relay keeps no world for - presence
alone, every player stepping their own foes - which is safe, and is why the order matters).

Leaves: an older page in a dungeon the world re-lays stands in the whole dungeon's room, apart from this build's
players, until it reloads. Offline, a dungeon no quest holds follows the switches unless the world's sizes are asked
for (the sync asks for them).

### TIER1 - shipped 2026-10-05

Section 12, whole, with the size beside the tier. `systems/dungeonTier.js` (the leaf: the tiers, their words, the
size words, `dungeonTier`, `tierShown`, `tierPhrase`), `world/dungeonLabel.js` (`dungeonSizeClass`,
`dungeonSizeOnline`, `dungeonTierLabel` kept per location, `madeDungeon`). The surfaces: `systems/worldTooltips.js
staticDoorName` takes a `tier` and a `size` (its old `elite` flag is the tier now); `scenes/worldModes.js` names them
over a dungeon's mouth online; `ui/heldMap.js` (the hover label and the I box, through the host's `tierAt`);
`scenes/world.js` (the seam, the place and far plates, the sight line through `world/spawnedDungeons.js
dungeonSightLine`'s tier, and one line on entering, `dungeonTierSay`, off the transition hook).

THE FOUR HOSTS: `scenes/world.js` WIRED (the plates, the held map's seam, the sight line, the entry line);
`scenes/worldModes.js` WIRED (the plaque); `scenes/dungeonContext.js` FLAGGED - it names nothing on entry (the world
host's line rides its transition hook) and its classic automap title is DFU's native window; `scenes/exterior.js`
FLAGGED - the `?exterior` bench is offline, and offline every dungeon is DFU's.

Pins: `test/tier1_dungeontiers.test.js` (5), the held map's TIER1 window test (`test/heldmap.test.js`), and the moved
pins of the plaque's, the plates' and the sight line's call sites (`test/elitedungeons.test.js`,
`test/spawneddungeons.test.js`, `test/tv6_dungeons.test.js`, `test/worldhover.test.js`, `test/arena_fix.test.js`,
`test/seat1a_client.test.js`); `tools/mutants/tier1.json` (14, all dead), and the mutant records the change moved
re-aimed by content (`hub1`, `worldhover`, `survtiers3`).

### SD1 - shipped 2026-10-05

`net/sdLaw.js`, the pure law sections 2-4 name, the relay's and every client's: the numbers; `validSdRecord` (the
record at both ends, projected); `sdPhase` and what each phase means (`sdStands`, `sdMarked`, `sdAdmits`, `sdHolds`),
all derived from the record's own instants; one function per move (`sdFirst`, `sdRise`, `sdFind`, `sdFell`, `sdGone`),
each refusing what its phase does not allow, and the director's step (`sdDue`); `pickSdRegion` (the census);
`sdFindBelieved` (a find the relay can check without map data: a pose in the MapsFile frame within SD_FOUND_RADIUS_M
of the claimed pixel's centre, where a spawned dungeon stands); `sdNameOf`; the room `sd:<s>`; the chat's words. It
imports `wire.js` and `gateLaw.js` (the port's one mix, gateHash, and a pixel's side) alone - both the relay bundle's
already.

One change from this page: the Hollow stands CENTRED in its pixel, as every spawned dungeon does
(`world/spawnedDungeons.js spawnedLocationCentreLocal`), not at a spot drawn inside it - so the find is checked against
the pixel's centre, and the slot needs no spot law.

Pins: `test/sd1_sdlaw.test.js` (9); `tools/mutants/sd1.json` (17, all dead - one survivor at first, the standing
check under an early `next`, now pinned). Wired by nothing yet: SD2 places the Hollow, SD3 runs the director.

### SD2a - shipped 2026-10-05 (the site's law)

`systems/sdSite.js`, pure over the map data every client holds: `sdCities` (a region's places ranked by the hubs' own
claim - `systems/regionHubs.js` exports its `outranks` for it - or the Bay's first eight cities by the hubs' own claim -
a city named for its region before a larger one), `findSdSite` (a pixel the GATE's own scan calls suitable -
`systems/gateSite.js scanGatePixels`, so the Hollow inherits every one of its tests: land, no location on it or its
neighbours, no spawned dungeon rolled there, a province's - whose nearest fast-travel town is the city, two to four
pixels out, by the slot's roll; a city with none passes to the next - and, AUDIT SD IV F37, on dry ground, which the
gate's scan never asks: the spawns' own test, section 3), `sdTemplates`/`pickSdTemplate` (a labyrinth or a
keep of twelve blocks or more with a spawn's clearance), and `sdHollowLocation` (the template cloned on the site under
the slot's OWN map id - `sdSalt`, 2049..4095, never `WORLD_SALT` - so a later Hollow on the same pixel is another
dungeon with another room and another memory; named; `superTier`; a spawned dungeon's machinery). The design's
"Chebyshev 2 to 5" is the gate scan's 2 to 4.

Known, recorded: a gate day may roll the Hollow's pixel for its own (the gate's site is the clock's alone, and the
Hollow is no roll the gate's scan can see) - a chance of about one in the region's suitable pixels per day of a
Hollow's life; both then stand in the pixel.

Pins: `test/sd2_sdsite.test.js` (5, over the real gate scanner); `tools/mutants/sd2.json` (13, all dead - one
survivor at first, a fixture whose cities outnumbered eight, now pinned with fewer).

The arc's Ledger row stands from here (`test/doctrine.test.js`: a file citing Ledger A has a row naming it - SD1 and
SD2a cited one before it was written, and the full suite at the merge of main said so), naming each slice's files as
they ship.

### SD3 - shipped 2026-10-05 (the relay)

Sections 2-4 and 14 on the relay - `world172` (`world171` on the branch; main's CRYSTAL-FIST took it at the merge;
`world176` now - section 14).

- **The frame** (`net/wire.js`): `sd`, one kind each way so far - `found {s, px, py}` to a cell (`validSdIn`, behind
  `relaySupportsSd`: a relay before `world172` - `world176` now - closes the socket on it) and `ev` from the hub (`validSdOut`: the record,
  a Hollow that rose). The record's projection, `validSdRecord`, moved here from `net/sdLaw.js` beside the frame that
  carries it (wire.js imports no law; the law imports it) - `sdLaw.js` re-exports it unchanged. Its own buckets
  (`sdGate`, the relay's deeper `sdRelayGate`), its doors and its storage keys (`sdev`, `sdfound`, `sdrealm` - outside
  every swept prefix).
- **The director** (`server/src/index.js`, the hub): its record through the wire's law (`_sdOf`), moved on by
  `_sdBeat` on the hub's one alarm after the sweep and the heralds - the first beat (slot 0, said to nobody), a Hollow's
  time run out (gone, fanned), a rise after the rest (fanned) - and armed for its next move (`_sdArm`, at the hub's first
  account hello and after every beat). A beat that throws tries again a minute on.
- **The census**: asked of the 62 region channels once a rise (`_sdCensus`, six at a time, each call its own
  `ROOM_CALL_MS`), each channel answering its DISTINCT REGISTERED accounts (`_sdCensusInternal`: a socket marked `lk` at
  its hello when the token says `linked` - a guest is one click; one account in two tabs is one). A channel that does
  not answer counts nobody. The record is read again after the census - a find or a fall may have landed meanwhile.
- **The find**: a cell hears `found` from its own socket's pose (`sdNearSite` - the pixel's centre, the radius), a frame
  naming another cell's pixel is junk, keeps the first finder's word (`sdfound`) and tells the hub until it answers -
  the rite's law: one tell in flight, the retry armed before it goes, a 4xx refusal let go (`_sdTellHub`, on
  `_alarmRest` beside the rite's). The hub believes it against its record (`sdFindBelieved`: the slot, `risen`, the pose
  again) and keeps the finder's verified name.
- **The realm**: the Worker refuses an `sd:` key that is not one the hub mints, and - after the socket's own check, so
  nothing else asks - one whose slot the hub's record does not hold (`sdLiveAsk`, `/internal/sd/live`, failing closed).
  The realm's own hello asks the hub too (kept ten seconds): a newcomer while found, one who entered before until it is
  gone, SD_FIGHTERS_MAX at most, one seat an account; the refusals are the Rift's words (`SD_NO_CLOSED`, `SD_NO_FULL`).
- **The client** (`net/online.js`): `sendSdFound` down the socket of the cell the pixel is in, my own or a halo's, by that
  socket's own welcome (carried across a seam's promotion, AUDIT WB12d C6's law), `SD_HZ_MAX` a second; `onSd` with the
  hub's record - from the hub alone.

Pins: `test/sd3_relay.test.js` (7 - the wire, the director end to end over fake objects, the census's rest, the find,
the realm and its Worker, the session, the seams by source); `tools/mutants/sd3.json` (28, all dead - one survivor at
first: the cell's pose check, which the hub's own check hid while the hub was up; the far claim is now said with the
hub down). PINS MOVED at the whole suite: the hub's one alarm carries the director now, so the sweep's and the heralds'
harnesses (`test/auditsoc.test.js`, `test/discordgates.test.js`, `test/serpent2_herald.test.js`) seed its record with a
rise ten years off and test their own duties alone; `test/scale2b.test.js` counts twelve calls between rooms, nine on
ROOM_CALL_MS; `test/raid3_raidLedger.test.js` pins `_alarmRest`'s raid line with the find's re-arm; and `parseClient`'s
doc names `sd` (`test/auditworld2.test.js` derives the list from its arms). Wired by nothing in the world yet: SD2b
stands the Hollow and says the find.

### SD2b - shipped 2026-10-05 (the Hollow in the world)

Sections 2-4 on every client. `scenes/sdHost.js` (`createSdHost`): the hub's record in (`heard` - an older slot's word
is no word; the first word, the welcome's, is no news), the Hollow it names found once a slot over this client's own
map files - the gate's scan, warmed if it is not ready (AUDIT SD IV F39: and asked a row at a time by the world host's
seam - unbudgeted, the first frame after the hub's word ran every row left, the hitch AUDIT WB C7 removed, and the
warm never ran), and the game's own rows - and stood in the location index at its
pixel while the record's phase stands it (`frame`), then taken down - never from under a player standing in it, and the
next slot's not before; the find said at its mouth - within SD_FOUND_NEAR_M of the dungeon entrance its pixel's blocks
stood - to the cell its pixel is in while the record says `risen`, again every SD_FOUND_RESEND_MS until the hub's word
moves it; and the lines everyone online hears - the find, the kill, the fading (a found Hollow's alone - AUDIT SD II:
one never found faded as news to nobody who had heard of it) - each once, a rise to nobody, a line whose place the scan
has not found yet waiting for it (its city's name) and past SD_LINE_WAIT_MS said with the region's.

`scenes/world.js`: the host made online alone and framed every frame; the hub link's `onSd`; the Hollow's cities and
templates kept over the game's own rows before they go (`_sdCityRows` - the populated places, `hubClaim`;
`_sdTemplateRows`); its pixel built again between builds when it rises or goes on ground that stands (`_sdLate`,
`sweepSdLate` - sweepWodLate's shape, after the gate's clearing); the spawn ledger never notes a Hollow's first sight
(`_spawnSeen` - the dungeon's door and the roll's) nor its clear (`_noteSpawnCleared`): a Hollow's life is the hub's
record, not a spawn's two clocks; a Hollow is otherwise a spawned dungeon - the build, the plates, the Overworld's lists
and the sight line (TIER1's "an Abyss Dungeon") take it as one.

Known, recorded: the Hollow's site does not ask the road network (a road-crossed pixel is the spawns' rule) - the network
lands after the boot on its own time, and a site that waited for it would differ between a client that asked before and
one that asked after; the gate's scan is what every client holds alike.

THE FOUR HOSTS: `scenes/world.js` WIRED; `scenes/worldModes.js` FLAGGED - the mode machine enters a Hollow as any spawned
dungeon (its plaque and its tier are TIER1's); `scenes/dungeonContext.js` FLAGGED - SD4's (its difficulty, its end);
`scenes/exterior.js` FLAGGED - the `?exterior` bench is offline.

Pins: `test/sd2b_world.test.js` (5); `tools/mutants/sd2b.json` (17, all dead). The pins SD2b's lines meet were kept by
keeping their lines (the ledger's guards and the sweep's frame line stand on lines of their own, the Hollow's rows above
the hubs'); `test/ow6_ledger.test.js`'s lifted ledger block is handed the index its first-sight door now asks (PIN
MOVED); `tools/citeShift.mjs` moved world.js's cites a slice down (173), CD4's gated struck cites by hand (8), and
`tools/mutants/survtiers3.json`'s two cite records re-aimed by content.
Next: the omen, the marks and the Timers row (SD2c); a save inside a Hollow and the cast-out at its end (SD2d).

### SD2c - shipped 2026-10-06 (the Hollow seen and heard of)

Section 4, whole but the sighting line (TIER1's, which a Hollow already takes as a spawned dungeon). `systems/sdOmen.js`,
pure over the hub's record and the Hollow the host stood, the relay's clock handed:

- **The omen.** A column of brass-gold light over the Hollow's pixel from its rise to its end (`sdOmenLight`: kindled over
  SD_OMEN_KINDLE_MS from the record's `at`, whole while it stands, out over SD_OMEN_FADE_MS before it is gone - `until`
  unbeaten, `fellAt + SD_COLLAPSE_MS` after the kill), seen from SD_OMEN_PX (12) map pixels round, Chebyshev
  (`sdOmenSeen`), outside alone. `render/sdOmenPass.js` draws it: the gate's beacon - its shaders and its column, which
  `render/gatePass.js` exports - built again under its own program in its own colour (SD_OMEN_COLOR, brass, never the
  gate's red), so the gate's module is untouched (SERPENT1's rule). Its foot is the built ground under the Hollow's
  centre, or on a pixel not built yet the terrain sampler's own kernel there (GATE-SEEN's law, its own memo).
- **The taverns.** "Any news?" asked in the city it stands by (the player's pixel the city's, `sdSite.js pixelOfLoc` -
  exported for it), while it has risen or been found, one time in two (SD_RUMOR_CHANCE, 0.5): *"They say the air goes
  brass-coloured past the walls of <city> at dusk, and a bell rings where there is no bell."* (`sdRumor`) - the person's
  one answer spent as the mill's own and the revenant's are, asked before both (the world host's getNewsOrRumors).
- **Once found, news.** The held map's ring on its own pixel (`sdMapMark`, SD_RING_R - a place now, not an area; the
  gate's mark's shape, read by `ui/gateMapMark.js readGateMark` and painted by `ui/inkMap.js paintGateRing` in
  `ui/sdMapMark.js`'s brass, its legend "Abyss Dungeon", its card its name, its city, its finder and its state); the
  compass's round brass mark inside SD_COMPASS_M (1 km) of its centre, outside (`ui/enhancedHud.js drawSdMark`); the
  Timers window's `super` row - "<name> stands", counting to its fading, then "<name> collapses" to the collapse's end
  (`systems/eventTimers.js`; none while it has only risen); and the notice boards' note under the red seal after the
  gate's (`sdNoticeCard`, `ui/noticeWindow.js noticeCards`'s `sd`). None of these before it is found: a Hollow that
  has only risen is a find.

`scenes/sdHost.js` reads them (`mapMark`, `omen`, `rumor`) off the record it heard and the Hollow it stood, so a ring
or a column never names a Hollow that is not standing.

THE FOUR HOSTS: `scenes/world.js` WIRED (the held map's `sd`, the Timers source's `sd`, the board's `sd`, the compass's
`sd`, the taverns, the column after the gate's fire); `scenes/worldModes.js` FLAGGED - indoors there is no sky to see a
column in, and the taverns' word rides the world host's own talk seam, which the interiors' talk already is;
`scenes/dungeonContext.js` FLAGGED - underground there is no sky and no compass of the Bay's; `scenes/exterior.js`
FLAGGED - the `?exterior` bench is offline, and offline there is no Super dungeon.

Pins: `test/sd2c_omen.test.js` (9); `tools/mutants/sd2c.json` (25, all dead). PINS MOVED: `test/serpent2_herald.test.js`'s
Timers label (the Super dungeon's row beside the serpent's) and `test/audit18_bible_docs.test.js`'s foreign-pass count
(twenty-seven call sites across twenty passes, the omen's after the rite's smoke); Rendering.md lists `sdOmenPass.js`,
UI.md counts `sdMapMark.js`, Systems.md `sdOmen.js`.

Next: a save inside a Hollow and the cast-out at its end (SD2d).

### SD2d - shipped 2026-10-06 (a Hollow's end, and a save inside one)

The ground is never pulled from under a player (SD2b) - and they do not stay in a Hollow that has ended. When its record
stops standing it (its collapse's end after the kill, its fading unbeaten, or a later slot's word) while the player is
inside, `scenes/sdHost.js` casts them out once (`castOut`, the host's seam, `castOutS` its slot - AUDIT SD II: once it
has ACTED, a refusal asked again the next frame); the next frame finds
them outside and takes it down. The world host's cast-out is the dungeon's own way out - the mode machine's exit
(`modes.unstuck`), drained at its safe point into `exitDungeonNow`, PositionPlayerToDungeonExit's landing before its
door - with the closing line, *"The Hour closes, and the Abyss Dungeon folds in on itself behind you."* (sdLaw.js
SD_CAST_OUT_LINE); a player dead inside is the death's (its own door wakes them, and the Hollow goes when they are out).

THE HOST FRAMES IN EVERY MODE NOW. SD2b framed it in the exterior's half of the world host's frame, which the modal
return never reaches: underground, nothing moved the Hollow on - its end could not have reached a player inside it, and
its lines waited for them to walk out. It runs in the online frame beside the gate's and the serpent's, above the modal
return; the find stays the street's (`feet` answers outside alone).

A SAVE INSIDE A HOLLOW is ONLINE-UNDERGROUND-LOAD1's, unchanged: an online page never puts a character back inside a
dungeon - it wakes them at the nearest temple, town or graveyard to the dungeon's pixel, and a Hollow's save names its
own (the clone stands at its site - `world/spawnedDungeons.js` gives it the site's longitude and latitude, which
`dungeonContext.js dungeonHome` writes), so the wake is by the city it stood by, whether or not the Hollow still stands.
Offline (an offline copy's load) no Hollow stands to enter, and the load lands at its door.

THE FOUR HOSTS: `scenes/world.js` WIRED (the cast-out, the frame, the find's street); `scenes/worldModes.js` WIRED by
its own door (`unstuck`, `exitDungeonNow` - no line of it changed); `scenes/dungeonContext.js` FLAGGED - the save's
dungeon home is its own, unchanged; `scenes/exterior.js` FLAGGED - the bench is offline.

Pins: `test/sd2d_castout.test.js` (4); `tools/mutants/sd2d.json` (8, all dead). `tools/mutants/sd2b.json`'s
SD2b-the-ground-pulled re-aimed by content (the guard has a line of its own beside the cast-out; all 17 dead).

The Hollow's world half is whole: SD4 makes it Super - its difficulty (SD4a), its end, the Rift and the Return (SD4b).

### SD4a - shipped 2026-10-07 (the Super difficulty)

Section 5's table, in the dungeon host. `scenes/dungeonContext.js` reads the tier ONCE (`_superTier`:
`dungeonTier(dfLocation) === 'super'` - TIER1's one law over the Hollow's location word) before its fires, and every arm
below it asks that; the numbers are `world/sdDungeon.js`'s.

- **Three foes at every enemy marker** - the Elite's own expansion (`expandEliteEnemies`, `ELITE_FOE_MULTIPLIER`), so
  the 64 KiB foe frame is the budget the Elite proved at 151 markers (the largest spawn template; a Hollow's own
  templates are measured against it over the real data - AUDIT SD II, L8 D1). Each record carries `superTier` beside the
  Elite's mark, the same on every client (the foe frame indexes the list by position).
- **x4 health, x2.5 damage** (`scaleSuperFoe`, `applyEliteScaling`'s own arm before the Elite's). The foe also wears the
  Elite Dungeon's mark, so its poise (`ai/tells.js`) and its body's loot cap (`systems/foeLootCap.js`) are an Elite
  dungeon's at the least.
- **The top band.** The layout's random foes and a rest's encounter are rolled at `superFoeLevel` - the player's level,
  never under 24 - and a class foe is built at it (a revenant's or a bout fighter's own level first).
  ChooseRandomEnemyType draws only from a table's last six rows past level 18, on both of its arms (the alternate
  arm's power is full at 20), so 24 is the top band whatever the dice say. The player's own level never moves: the loot
  tables still read it.
- **Six elites** (`pickDungeonElites`'s `count`, `SUPER_ELITE_FOES`), the same on every client. A Super dungeon's elite
  is the Elite Dungeon's stack read the same way (`systems/eliteFoes.js`): its health is the dungeon's and the elite's
  added (2 + 5 = 7 in an Elite dungeon, 4 + 5 = 9 here), its damage the dungeon's and the elite's extra over a plain
  blow (2 + 2 = 4 there, 2.5 + 2 = 4.5 here). A puppet of another player's elite takes the blows; its maximum is its
  owner's word.
- **Loot +50%**, drop and quality, on its foes' bodies (`SUPER_LOOT_OPTS`) and its treasure piles - the Elite's +20%,
  in the same shape.
- **No fire of its own** - `dungeonFirePlan`'s `cold` answers none and casts no ray: no campfire, no ward, no rest
  point, no mark. The layout's own braziers are DFU's flats, as anywhere.

A loose foe stood later (a rest's, a search's, a quest's) keeps the Elite's law: built at the band's level, not scaled -
only the layout's list is the place's own.

THE FOUR HOSTS: `scenes/dungeonContext.js` WIRED (all of it); `scenes/world.js` FLAGGED - the Hollow's location already
carries its word (SD2b); `scenes/worldModes.js` FLAGGED - nothing of the mode machine reads a tier; `scenes/exterior.js`
FLAGGED - the bench is offline, and a Super dungeon stands nowhere else.

Pins: `test/sd4a_super.test.js` (7); `tools/mutants/sd4a.json` (23, all dead). PINS MOVED: the Elite's by-source pins
read the Super's arm beside theirs - `test/elitedungeons.test.js` (the expansion, the piles' quality),
`test/elitefloor_foetitle.test.js` (the promotion's arm), `test/lr1_lootrarity.test.js`, `test/world8.test.js` and
`test/audit23_systems.test.js` (the piles' roll); `tools/mutants/revenant.json`'s ELITE-FLOOR-the-per-client-level-asked re-aimed at the promotion's new
options.

SD4b is next: the end, the Rift and the Return.

### SD4b - shipped 2026-10-07 (the end, the Rift and the Return)

Section 6, in the dungeon host.

- **The end** is the dungeon's enemy or start marker farthest from its entrance across the floor plan (the layout's
  enemy markers, an Elite copy left out, and every block's start markers - `sdEndMarks`). The law is RVN7d's lair law,
  lifted out of `scenes/dungeonContext.js` into `world/dungeonEnd.js` (`dungeonEndOf`): the lair's stand reads it now
  too, so the two are one law. Pure: the same markers give the same end on every client, and a tie keeps the first.
- **The Rift** stands on the floor the collider finds under the end - or a step or two about it, where its hall is
  widest (`sdRiftPlace`: the end itself, then eight bearings at 1.5 m and 3 m, each on the end's own floor and reached
  by a clear line at chest height). It is as wide and as tall as that hall lets it stand (`sdRiftFit`): 7 m at most,
  the hall's own height and twice its nearest wall less 0.3 m of air, never under 2.6 m - a 7 m ring would be cut by
  the ceiling of most of Daggerfall's halls. AUDIT SD IV F36: the height is its top's (it hovers a hand's breadth,
  `SD_RIFT_TOP`), and its disc is then swept as it stands, in its face's plane (`sdRiftSweep`: from its centre, across
  and up between, never below it nor along its face, shrunk by halving until each reaches its rim and its air) - the
  measure asked the ceiling straight up and the walls at chest height alone, so a raised bay or a shaft over the end
  stood a 7 m ring through a 5 m ceiling; each spot's ring is the swept one. Its look (`scenes/sdEnd.js riftFrame`): a ring of brass light in eight
  teeth, turning an eighth of a turn every sixteen frames, about a near-black membrane with slow gold swirling in it.
  It is made once per renderer, as the companion's portal is, and is self-lit, so it glows the same underground. Its
  sound (`systems/sdRiftSound.js`) is a bell heard under water: DAGGER.SND's ship's bell slowed and pitched down near a
  sixth, its echo behind it and the bubbles faint beneath, darkened, wavering and looped at the ring's middle through
  the engine's own low-pass - made from the player's archive, as the Arena's crowd is.
- **The Return** stands beside it (`sdReturnPlace`: 1.2 m past the ring's rim on the first clear bearing, east first;
  else 1.5 m out; else the same onto a lower floor - a dais's foot, down a stair or a ramp (AUDIT SD IV F34: there it
  stood on the ring's foot, inside the Rift's walk-in - a walk to it crossed the Rift's first, and a small ring's every
  walk-in was the Return's); else, boxed in, on the ring's foot): a small oval of pale light. It carries the player back to the way in - the
  start marker's landing, through the dungeon's own teleport door (`actions.onTeleport`, DFU's teleport actions'
  handler). It goes out when the boss falls (`sdReturnStands`, asked once a second) and never stands again in that
  dungeon.
- **Pressed, or walked into.** Each stands in the activation ray at a door's reach (`sdrift:0`, `sdreturn:0` - the mode
  machine's press ladder routes them before the action objects) - the Rift at its ring as drawn, a box turned with it
  (AUDIT SD IV F33: its sweep's cube, 7 m every way, took the presses at the bodies of the end's foes and at the floor
  before it) - with its words on the plaque (*The Rift - To the
  Shattered Hour*, *The Return - To the way in*). A step into either is asked once - outside, then inside, the Portal
  Stones' latch - and a jump into it (a door, a teleport) or a gap in the frames is no step: a host held for seconds
  (`SD_STEP_GAP_MS`, 2 s), never a slow frame - AUDIT SD IV F3: at 250 ms no walk-in was taken under 4 frames a second,
  nor across one hitch on the crossing, and the hosts' dt cap keeps a slow frame's feet under the jump's bound.
- **The Rift's word** (`sdRiftWord`), off the hub's record for the Hollow's slot (the world host's `superRift`, through
  the mode machine): through while the Hollow is found, and after the kill only for one who went in before (the realm's
  room keeps them until it is gone, SD3's `_sdAdmit`); before the find, or with no record heard, *"The Rift will not
  take you yet."*; gone, another slot's, or a newcomer after the kill, *"The Hour has closed."* Said mid-screen. Where
  it admits, the realm's door takes the player - SD5's (the Shattered Hour). Until SD5 there is no door, so an admitting
  Rift says it will not take you yet.

THE FOUR HOSTS: `scenes/dungeonContext.js` WIRED (the end, the Rift and the Return, their step, press, plaque and
draw); `scenes/worldModes.js` WIRED (the press arm, the `superRift` forward); `scenes/world.js` WIRED (`sdRiftOf` - the
word off the hub's record on the shared clock); `scenes/exterior.js` FLAGGED - the bench is offline, and no Super
dungeon stands there.

Pins: `test/sd4b_rift.test.js` (10 - the laws over a model hall, the art, the set over a fake renderer and engine, the
step, the bell, the host's two steps run from its own text, the hosts by source); `tools/mutants/sd4b.json` (32, all
dead - one survived at first, the bell's own darkening, which a loose bound on the darkness let pass; the bound is the
measured one now). PIN MOVED: `test/rvn7d_stand.test.js` reads the lair's stand through `dungeonEndOf`, and
`tools/mutants/rvn7d.json`'s RVN7d-the-nearest is re-aimed at the law's new home, killed there by this slice's test;
`test/nudedecor.test.js` names the new billboard host (`scenes/sdEnd.js` - a portal, no person).

SD5 is next: the Shattered Hour - the made level, its sky, the way in and out.

### SD5a - shipped 2026-10-07 (the Shattered Hour, the made level and its ways in and out)

Section 7, on the Burning Court's law (`world/gateArena.js`, World-Bosses.md section 4): the realm is a DUNGEON - the
dungeon host with a level made in code - never a fifth host.

- **The frame** (`net/sdBrain.js`, pure, for the relay's judgements to come): the Threshold at the made block's middle
  (`SD_REALM_ORIGIN`, the court's centre's place), every floor at y 0, the stages along +z - the Threshold (z 0, r 8),
  the walk (z 7-25, 4 m wide), the Orrery's hall (z 42, r 18 - z 24-60), the Steps' span (z 60-190) and the Last
  Moment's arena (z 220, r 26, its four brass pillars on the diagonals).
- **The made location** (`world/sdRealm.js sdRealmLocation`): *The Shattered Hour*, made location `0x7ffff200`, one
  made block `SDHOUR.RDB` at index 900200, map id 0 (no world room keys off it), `sdRealm` the Hollow's slot and
  `sdHollow` the Hollow it was entered from (where the way back leads). `isSdRealm` reads it; `madeDungeon` names it
  (no tier, no size). Its blocks file answers its one empty block, its start marker on the Threshold.
- **The Hour itself** (`buildRealmModel`, art made in code - `world/sdRealmArt.js`, pseudo-archive 38151): each stage an
  island hanging in the void on a root of dark stone, its floor dark stone set in brass with a brass lip; the walk
  between brass kerbs, its floor drawn from the Threshold's edge to the Orrery's and over neither (AUDIT SD II: its last
  metre lay in the dial's own plane, the two fighting for the screen; its collider and edge z 7-25 as before); the
  Orrery's floor the Hour-dial (twelve brass hours round its rim, a ring of six segments within for the stones of SD6);
  the arena's floor cracked brass with the Mantella's light in its seams, and its four pillars. Its floors, its pillars
  (SD8c) and its lamps' posts go to the collider (`realmColliderTris`); its lamps (`realmLights`, warm brass on the
  rims, each a brass post, a head of the hands' brass glow round its light inside the light's shadow's near plane, and a
  cap - `realmLampFeet`, AUDIT SD II: the lights stood on nothing) to the frame's lights after the player's own, nearest
  first, into the realm's own arrays (`realmLightsWith`), its light a brass trilight with a key from the clock-face
  behind the arena (`realmLighting`), its air a thin brass haze (`SD_REALM_FOG`). Its edge keeps a player on the
  Threshold, the walk and the hall (`realmClamp`, the motor's `arena`) until SD6's bridge lays more.
- **What the Hour refuses** - the court's refusals, beside the court's own lines: rest, save (the pause's Save says
  why), map (no automap slot either), a Mark and a Recall (*"Nothing answers a Recall in the Shattered Hour."*), and
  regeneration (`courtRules`, switched on in the Hour). No drip, no door, no fire of the dungeon's own.
- **The way in** (`scenes/world.js sdEnterRealm`, the Rift's door - SD4b's `enter`): under the veil (the gate's, the
  design's - in the Hour's own brass, its toll and its chime, AUDIT SD II), the Rift's word asked once more (the Hour
  can close while the veil does), the Hollow left as a teleport leaves a dungeon, the player put at its pixel outside
  (the staff teleport's way - the street streamed, so the way out has a door to land before) and stood before its door
  (AUDIT SD IV F40: the pixel's middle is where the Hollow itself stands, its keep's roof - a late refusal or a realm that
  would not build left the player there, and the way out's `from` was read there), then the realm built and
  entered (`scenes/worldModes.js enterSdRealm`), facing the Orrery. Its room is the relay's realm, `sd:<s>`, whose hello
  asks the Rift's law again (SD3's `_sdAdmit`).
- **The way back** (`sdWayBack`): the Hollow's own Rift at the Threshold's back (*The Rift - To the Abyss Dungeon*), pressed or
  walked into - under the veil, out of the Hour, to the Hollow's pixel, into the Hollow by its door, stood beside its
  Rift (the Return's place, `dungeonContext.js sdRiftLanding`). A Hollow gone meanwhile: outside, at its pixel; its door
  that would not open: before it (AUDIT SD IV F40).
- **Out by force**: a death, or the Hour's end (SD2d's cast-out reaches the Hour now - the Hollow counts a player in its
  Hour as inside it), lands before the Hollow's door: the Hour's end by the mode machine's landing (`returnLanding`, which
  reads `sdHollow`'s doors - `sdHollowDoors` - and `dungeonReturn.from` with none), a death by the death's own door, as
  every dungeon death wakes (the start markers of the Hollow's pixel, `RandomStartMarker` - SD2d; AUDIT SD IV F4: this
  line named the mode machine's landing for both) - a death in the Hour wakes under its veil with its own words, *"The Shattered Hour casts you out for good. You wake before the Hollow's
  door."* (SD11c: it woke with a plain dungeon's), and it is final (SD-ONELIFE, below). A room that refuses
  the player for good (the Hour full, or closed) casts them out the same way with the relay's own words, once.

THE FOUR HOSTS: `scenes/world.js` WIRED (the way in and back, the eject, the room key, the edge, Mark, Recall,
regeneration, the Hollow's count of who is inside); `scenes/worldModes.js` WIRED (`enterSdRealm`, `standSdRealm`, the
landing, the light, air and lamps every frame, the room identity, `sdRealmSlot`, `stepThroughFire` handed out);
`scenes/dungeonContext.js` WIRED (the refusals, the way back's Rift, the landing beside a Hollow's Rift - SD11c: past
its Return, never on its foot);
`scenes/exterior.js` FLAGGED - the bench is offline, and no Hour opens there.

Pins: `test/sd5a_realm.test.js` (12 - the frame, the made location and block, the mesh, the floors, the edge, the lamps
and light, the art, the hosts by source, and the world host's two steps RUN from its own text); `tools/mutants/sd5a.json` (24, all dead).
PINS MOVED: the court's by-source pins read the Hour's line beside theirs - `test/arena2_hosts.test.js` and
`test/wb3b_gate_arena.test.js` (the pause's Save), `test/arena2_hosts.test.js` and `test/wb6b_deadlands_life.test.js`
(no drip), `test/mapkeep.test.js` (no map slot), `test/disc15.test.js` (the Hour's lamps between the court's and the
shadow ask) and `test/moonlight.test.js` (the Hour's key, the fourth `setMoonlight`, straight after the court's);
`tools/mutants/wb6b.json` and `audit27h.json` re-aimed; the arc's own -
`test/sd4a_super.test.js` (the cold fire plan), `test/sd4b_rift.test.js` (the realm's Rift, the kept landing, the
door), `tools/mutants/sd4a.json`'s fires-warm.

SD5b next: the Hour's sky (`render/sdSky.js`) on the realm's anchored clock.

### SD5b - shipped 2026-10-07 (the Hour's sky)

Section 7's sky (`render/sdSky.js`), on the Deadlands' law (`render/deadlands.js`): PAINTED, NOT BUILT - one triangle
over the screen at the far plane, depth-tested at LEQUAL and never written, each pixel reading its own ray (`skyBasis`,
read into the pass's own arrays - `sdSkyBasisInto`), drawn in the dungeon arm's world pass after the Hour's islands and
before its flats (PERF2's law: it burns only where nothing nearer drew), every state it touches handed back.

- **The void**: near-black brass, a glow of brass along the horizon that meets the frame's haze, and two fields of
  stars.
- **The aurorae**: slow curtains of brass light high over the islands, whole round the sky with no seam (AUDIT SD II), a
  pale green at their hems (the Mantella's).
- **The shards**: three of the Bay's skylines hanging upside down from the upper sky, dark against the glow with a lit
  rim - Daggerfall's towers and spires, Sentinel's domes and minarets, Wayrest's bridge on its piers - each drifting its
  own way round the whole sky, hung wholly above the clock-face's highest drawn point (`SD_SHARD_TOP`), so never over
  the arena's clock (AUDIT SD II: Daggerfall's spires crossed its ring twenty seconds in every twelve minutes).
- **The clock-face**: over the arena (+z, the realm's forward), a ring of stars round on the sky (`clockFaceAt`, read on
  the sphere - AUDIT SD II: it was 7% narrow across), its twelve hours the brightest, and two hands of light turning
  BACKWARDS, the minute hand twelve turns to the hour's one - the Hour unwinding.
- **The clock**: the Deadlands' own anchored clock (`deadlandsSeconds`, anchored to the relay's), so every screen shows
  the same moment; every rate is whole cycles over `SD_SKY_PERIOD` (720 s) and the clock is handed wrapped
  (`sdSkyClock`), so the sky never jumps.
- **Its light**: display-encoded, scaled by the realm's gain (`skyGain` over `SD_REALM_FOG`), its horizon in the
  frame's haze.

The GLSL was compiled and linked in Chromium's WebGL2 (headless, the swiftshader lane) before it shipped; the tests pin
its laws, not its pixels.

THE FOUR HOSTS: `scenes/world.js` WIRED (`drawSdSky` - the pass built once, `sdSkyPassOf`, a failed build warned and
never retried; on the anchored clock, in the frame's haze, at the realm's gain; its foreign pass marked);
`scenes/worldModes.js` WIRED (the dungeon arm paints it in the Hour, after the islands and before the flats);
`scenes/dungeonContext.js` FLAGGED - the level knows nothing of its sky; `scenes/exterior.js` FLAGGED - no Hour opens on
the bench.

Pins: `test/sd5b_sky.test.js` (6 - the clock and its whole cycles, the clock-face and its backward hands, the shards,
the shaders, the draw over a recording GL, the hosts by source); `tools/mutants/sd5b.json` (22, all dead). PINS MOVED:
`test/farring.test.js`, `test/perf2.test.js` and `test/glstate.test.js` count 23 foreign passes marked in `world.js`
(the Hour's sky the 23rd), and `test/audit18_bible_docs.test.js` (AUDIT 39r) 28 across both exterior hosts, twenty-one
passes.

SD6 next: the Orrery of Endings (section 8) - the stones, the riddle, the relay's judgement and the bridge it lays.

### SD6a - shipped 2026-10-07 (the Orrery's law)

Section 8's law, pure (`net/sdBrain.js`, beside the Hour's frame; no imports - the relay takes it whole), drawn from the
slot alike on the relay and every page:

- **The stones** (`SD_STONES`): Daggerfall (the lion), Sentinel (the sun), Wayrest (the ship), Orsinium (the tusk), the
  Underking (the crown of bone), the Blades (the dragon) - on a ring of 11 m round the hall's centre at bearings 30 to
  330 degrees (`SD_STONE_POS`), none on the walk in or the way on, no place reaching two. Each shows an hour of twelve
  (`sdHourShown`: 1 to 12, none the twelfth).
- **The gearing** (`orreryOf(s).gear`): one unit-triangular matrix in a hidden order - each stone turns itself one hour,
  and each after the first turns one or two stones before it, by one or two hours either way. The first turns alone; the
  last no other turn moves. Its determinant is 1: every set of hours is reachable (`orrerySolve`, back-substituted in the
  order). Amended from the design's `L*U`, whose diagonal is not one.
- **The riddles and the truth**: two stones said plainly, then each later stone tied to one known before it - an offset
  (*"Wayrest keeps the hour Sentinel keeps, and two more."*), opposite (*"The Underking stands opposite Orsinium."*),
  or a mirror through twelve (*"Read the Blades from twelve backwards and you read Daggerfall."* - SD11e's words now,
  *"The Blades stands as far before twelve as Daggerfall stands past it."*) - so each clue is true
  by its making (`sdRiddleHolds`, `sdRiddleText`), shuffled onto the six plaques.
- **The start**: drawn until the shortest way to the truth is `SD_TRUTH_TURNS_MIN` 12 to `SD_TRUTH_TURNS_MAX` 24 turns.
- **One turn judged** (`orreryStep`, the relay's): the stone one hour, its partners by their gears, the fray one more,
  the dial's count (`orreryLit` - how many, not which); the 48th turn (`SD_FRAY_MAX`) that is not the Concord snaps the
  stones back to the start, the fray to nothing, and lashes the hall (`x`; `SD_FRAY_LASH` a quarter); the Concord is
  kept (a turn after it is nothing).
- **Reach** (`stoneInReach`): within 3 m of a stone (`SD_STONE_REACH`; the relay a metre more for a pose's lag,
  `SD_STONE_REACH_SLACK`); the lash reaches whoever stands in the hall (`inOrreryHall`). One turn a stone in 700 ms, at
  most 3 a second (`SD_STONE_SETTLE_MS`, `SD_TURN_HZ`) - the relay's gates, SD6b.

THE FOUR HOSTS: none yet - FLAGGED all four; the law is read by SD6b's relay and SD6c's hall.

Pins: `test/sd6a_orrery.test.js` (11 - the stones, the hours, the gearing over 500 slots, the riddles' truth and their
forest over 500, the brute force over all 12^6 configurations for five, the words, the start, a hall that learns the
gearing by turning each stone once and reaches the Concord inside the fray in all 500 - and a thousand random halls
that never do - one turn judged, the reach, the draw from the slot and THE GOLDEN DRAW: slot 1's order, start, truth
and plaques, so a change to the draw cannot pass unseen - it changes every Hollow's answer on the relay as on the page
and moves the relay's version with it); `tools/mutants/sd6a.json` (24, all dead - two survived at first: the solve
counting a stone's own unknown turn, which is nought - re-aimed at a gear read transposed; and a finite-number guard on
the reach that NaN already refuses - the guard is gone).

SD6b next: the relay judges the turns - the `pz` frame, the realm's stones in its storage, the Concord kept.

### SD6b - shipped 2026-10-07 (the relay judges the Orrery)

Sections 8 and 14 on the relay - still `world175`, the arc's one version while it is undeployed.

- **The frame** (`net/wire.js`): `pz` each way. A turn, `{k:'pz', i, a, q}` - the stone, 1 forward or -1 back, the
  turn's number - from a page to its realm (`validSdIn`); the hall, `{k:'pz', s, st, f, lit, ok, i?, a?, id?, q?, x?}` -
  the six hours, the fray, the dial's count, the Concord, the turn that made it so with its turner's id and number, and
  `x` when the Hour snapped back - from the realm (`validSdOut`). Its bounds are the Orrery's own numbers kept on the
  wire (`SD_PZ_STONES`, `SD_PZ_HOURS`, `SD_PZ_FRAY_MAX`, `SD_PZ_HZ` - the wire imports no law; pinned equal to
  `net/sdBrain.js`'s). Its own bucket: three turns a second from a page (`sdPzGate`), a turn deeper at the relay
  (`sdPzRelayGate`).
- **The judgement** (`server/src/index.js _sdTurn`): in a realm alone (a turn anywhere else is junk), on the hall's own
  bucket, routed before the find's; from a verified account alive in the realm, its OWN pose within reach of the stone
  (`stoneInReach`, a metre's slack for a pose's lag), the Hour still holding its slot (the hub's record, as the hello
  asks it), the stone's gear settled (700 ms since its last turn), the turn's number past the socket's last (a word
  said twice is one turn). Then the Orrery's law turns it (`orreryStep`), the hall is kept (`sdorrery`, read back when
  the object wakes), and every soul in the realm hears it. A refused turn is nothing - no word, no strike - and after
  the Concord every turn is nothing.
- **The hall at the hello**: after the world path's welcome (a realm's hello is a world room's, not a channel's), the
  realm says its hall as it stands - so a soul entering mid-puzzle, or after the Concord, sees the stones where they
  are.
- **The page** (`net/online.js`): `sendSdTurn(i, a)` down my own socket in the realm, at a relay that keeps it,
  numbered, three a second; `onSdHall` hears the hall from my own realm alone (a hub's or another room's is dropped; a
  realm never says the record).

THE FOUR HOSTS: none wired - the hall's page is SD6c's. `scenes/world.js` FLAGGED (it will hand the hall to the realm's
stones and their turns to `sendSdTurn`); `scenes/worldModes.js`, `scenes/dungeonContext.js` and `scenes/exterior.js`
FLAGGED.

Pins: `test/sd6b_hall.test.js` (6 - the wire; a turn judged end to end over the fake world: the hall at the hello, a
turn from reach kept and said to all, out of reach, the settling, a number said twice, the dead, a turn in a cell; the
fray's snap and the Concord, kept past an eviction and heard by a newcomer; the Hour closed; the session; the relay by
source); `tools/mutants/sd6b.json` (25, all dead). PINS MOVED: `test/sd3_relay.test.js` reads two kinds each way;
`test/relayversion.test.js` - `net/sdBrain.js` joins the relay's bundle, and `world175` is re-hashed in place (undeployed).

SD6c next: the hall on the page - the stones and their hands, the plaques, the dial, the lash, and the bridge the
Concord lays.

### SD6c - shipped 2026-10-07 (the Orrery's hall on the page)

Section 8 on the page - the dungeon host's set for the Hour's puzzle (`scenes/sdHall.js`), as `scenes/sdEnd.js` is for its
Rift. The realm judges every turn (SD6b); this shows what the realm says.

- **The hall, made** (`world/sdHall.js`; its art made in code, `world/sdHallArt.js`, the realm's own archive after the
  Hour's five records): six Ending-stones on the hall's ring, each facing its centre - a slab of dark stone under a
  brass cap, its dial at chest height with a brass notch over the twelfth hour (built, so no picture can turn it), its
  sign above (the lion's face, the sun, the ship, the tusk, the crown of bone, the dragon), and TWO HANDLES: the right
  (as you face it) turns it forward, the left back - the activation ray takes boxes, and a stone's face split in halves
  would overlap where it stands at a slant. Each stone's hand is its own mesh on its own matrix (`handMatrix`):
  clockwise as one facing the stone sees it, a proper turn, never a mirror (AUDIT SD II: a stone's right is the eye's
  right as the screen shows it, n x up - it was lookAt's +x, which the projection mirrors, and three o'clock stood at
  nine, the hands running back and the forward handle on the left). Six Ledger plaques of bronze on posts round the rim,
  facing in, numbered in pips as a die is (no numeral to read backwards), none on the walk in or the way on. Past the
  hall on its way on hangs the first step of the Unmoored Steps (SD7's first island).
- **The dial's light and the fray**: the six segments the Hour-dial carries, lit in the Mantella's green - one for each
  stone at its true hour, how many and not which, clockwise from the twelfth (`buildLitModel`); and an ember arc just
  inside the rim, a step a turn, all the way round at the snap for a moment (`SD_FRAY_FULL_MS`, 1.5 s - the snap's word
  itself counts none), then the word's own count (`buildFrayModel`) - each rebuilt as the realm's counts change.
- **Heard**: the hall reads the realm's latest word each frame (the world host keeps it while I am in the realm and
  forgets it as I leave - `onSdHall`). The first word is where the stones ARE: the hands are put there. A later one sets
  them going the short way round at the gear's pace (an hour inside the 700 ms the realm settles a stone in), with a
  clunk at the turned stone and a lesser one at each partner it moved; the snap's toll (the ship's bell, low); the
  Concord's chime and its line.
- **Pressed**: a handle turns its stone from within reach (the realm's own law, `stoneInReach` - else *"Stand closer to
  the stone."*) and from before its face (`beforeStone` - else *"Stand before the stone's face."*), never inside its
  gear's settling, never after the Concord. Its plaque names the stone, its sign, its hour and the handle's way - after
  the Concord, *"The Concord holds."* (AUDIT SD IV, SD26 T8: it offered the turn the press refused). A Ledger plaque's
  riddle shows on the plaque as the ray finds it, and is said when pressed.
- **The lash** (the world host, `sdHallHeard`): a word that says the Hour snapped back lashes me if I stand in the hall -
  a quarter of my health, no shield taking it (`hurtPlayer`'s `bypassShield`) - and *"The Hour snaps back."* is said to
  everyone in the realm.
- **The Concord's bridge**: a band of light from the hall's rim to the first step, laid as the Concord is heard. Its
  floor and the step's stand in the collider from the first; the edge keeps a body off them until the Concord adds them
  (`SD_HALL_FLOORS` - the world host widens its edge then). The stones (slab, cap and handles) and the plaques (post and
  tablet) stand in the collider too, one geometry with their draw (`hallSolidTris` - AUDIT SD II: a body walked through
  them); the bridge is a hidden draw until the Concord.

THE FOUR HOSTS: `scenes/world.js` WIRED (the realm's word kept while I am in the realm and handed to the hall, the lash,
the edge widened with the Concord, a turn sent - `sdTurn`, `sdHallWord`); `scenes/worldModes.js` WIRED (the handles' and
plaques' keys routed to the dungeon host's press, the turn and the word forwarded; the hall posed before the world pass,
`sdPose`); `scenes/dungeonContext.js` WIRED (the hall made for the Hour alone, stood, framed in `sdPose` before the
world pass, its targets, names and presses, freed); `scenes/exterior.js` FLAGGED - no Hour opens on the bench.

Pins: `test/sd6c_hall.test.js` (9 - the layout, the hand's turn, the models, the floors and the edge, the art, the set
over a fake renderer, the press, the world host's hall run from its own text, the hosts by source);
`tools/mutants/sd6c.json` (33, all dead). PINS MOVED: `test/relayversion.test.js` - `world175` re-hashed in place for the
hour's word (`sdHourWord`, which the riddles now speak with); `test/sd4b_rift.test.js` (the dungeon host's press and the
mode machine's route take the hall's keys too) and `test/sd5a_realm.test.js` (the edge widened with the Concord);
`tools/mutants/sd4b.json`'s press-unrouted and `sd5a.json`'s dial and edge re-aimed by content (the island builder is
exported as `realmIsland` for the first step).

SD7 next: the Unmoored Steps (section 9) - from the first step, three spans over the void on the realm's clock.

### SD7a - shipped 2026-10-07 (the Unmoored Steps' law)

Section 9's law, pure (`world/sdSteps.js`): the course from the Orrery's first step to the Last Moment's arena, in the
realm's frame. The page stands, moves and judges it (SD7b); the relay never does.

- **The course** (`SD_STEPS_COURSE`, `SD_CHECKPOINTS`): laid along +z from the first step's far edge (A, SD6c's, centred
  at z 72 - its far edge z 75). The Drift's eight (z 79-115, on the course's line at rest), B (z 122); the Beat's seven
  and its two risers (z 129-166, the course 2.3 m higher after each riser: y 0, 2.3, 4.6), C (z 173, y 4.6); the
  Crumble's eight (z 180-216), each a step down to the arena's floor; the course ends at the arena's near edge
  (`SD_COURSE_END`, z 220). Every step is a slab 0.6 m thick, 3 m across (the Crumble's 2.6).
- **Fair to the engine**: every gap is a jump (2.4 m at least), and no gap is longer than a plain running jump at a
  modest build at Jumping 0 (Speed 40, Running 20: 3.1 m, `player/motor.js`'s own speeds and gravity, at 95% of the
  closed form for the fixed step), with the capsule's reach. A riser stands against the step before it, 2.3 m higher -
  past any skill's jump (Jumping 100 rises 1.14 m; a Jump spell is a way up too) and inside the wall run's reach at skill 0 (`wallRunHeight` plus
  `PARKOUR_REACH_MIN`). The only step up is a riser, and every step down is under a metre.
- **On the realm's clock** (`deadlandsSeconds`, every screen the same): a Drift step swings across x
  (`stepAt` - `amp sin(2 pi t / period + phase)`, 1-2 m either way, 4-7 s, each its own phase); a Beat step stands 2.4 s
  of every 3.6, alternate steps half a beat apart, and blinks the 0.4 s before it goes (`beatStands`, `beatBlinks` - the
  risers always stand); a Crumble step touched shakes 0.7 s, falls under gravity and is whole again 5 s after it fell
  (`crumbleAfter`, from the touch - each player's own).
- **The Warp's breath** (`gustAt`, `inBreath`): over the Crumble alone, a gust every 6 s, a second long, 3 m/s across,
  +x then -x by turns, its wind rising the second before; `breathSeen` says which way it shows and how far through, from
  its wind's rising through the gust (AUDIT SD II).
- **The void** (`inVoid`, `spanAt`, `castBackTo`): below y -30 a body is cast back to the checkpoint of the span it last
  stood in (the page keeps it, SD7b; `spanAt` reads a span from its checkpoint's near edge) - A for the Drift, B for the
  Beat, C for the Crumble - 15% of its health lost (`SD_CAST_BACK_LOSS`). The edge lets go from just inside the first
  step's far edge to just inside the arena's near edge (`SD_STEPS_FREE`, for SD7b's clamp).
- **The frame moved** (`net/sdBrain.js`): the Steps run z 60-220 and the arena stands at z 246 (z 60-190 and 220 before)
  - the course the engine can jump is 145 m. Section 9 is amended to the engine (the gaps, the risers); the stage table
  of section 7 moves with it.

THE FOUR HOSTS: none yet - FLAGGED all four; the law is read by SD7b's page.

Pins: `test/sd7a_steps.test.js` (7 - the course; fair to the engine; the Drift; the Beat; the Crumble; the Warp's
breath; the void and the spans); `tools/mutants/sd7a.json` (22, all dead). PINS MOVED: `test/sd5a_realm.test.js` (the
Steps' span and the arena, the arena's floor probes and its nearest lamps at its new place); `test/relayversion.test.js`
- `world176` re-hashed in place (`net/sdBrain.js` is in the relay's bundle; undeployed).

SD7b next: the Steps on the page - the slabs and their colliders, moving on the realm's clock and carrying a body that
stands on one, the Beat's blink and the Crumble's fall, the breath's push, the cast-back, and the edge let go.

### SD7b - shipped 2026-10-07 (the Unmoored Steps on the page)

Section 9 on the page - the dungeon host's set for the Hour's platforming (`scenes/sdSteps.js`), as `scenes/sdHall.js` is
for its puzzle. Every screen moves the Steps on the realm's anchored clock (the sky's own, the relay's time), so every
player sees the same step in the same place; what a foot breaks is its own.

- **The steps, made** (`world/sdStepsModel.js`; their art made in code, `world/sdStepsArt.js`, records 21-22 after the
  hall's): each kind a box in its OWN frame, its top's centre the origin - the realm's frame is the dungeon's moved,
  never turned - so one mesh serves every step of a kind and each is drawn and collided by a translation alone. The
  Drift's the Hour's floor on brass; the Beat's a brass plate alight on glowing sides; a riser the floor on brass,
  reaching from its top past the step it rises from; the Crumble's cracked stone, the void's ember light in its cracks.
  Top, sides and underside are all in the collider: a body that jumps short meets a side, and a riser's face is the wall
  run up. The checkpoints B and C are islands as the first step is (`realmIsland` takes a height). The Warp's breath is
  made too: 64 brass streaks over the Crumble, faced both ways (`buildBreathModel`, `SD_BREATH` - AUDIT SD II: it was
  heard and never seen).
- **Stood and moved**: a draw and a MOVER's collider bucket for every step (`sd:step:<i>`, its translation read at every
  query - the step moves, its triangles never do), stood the first frame. Every frame each step is put where the law has
  it at the realm's now: the Drift swinging; a Beat step there or gone - its bucket sunk far under the void
  (`SD_STEP_GONE_Y`), its draw hidden - and blinking its last 0.4 s; a Crumble step shuddering from the moment my own foot
  first stands on it (its grind heard), then its bucket gone and its draw falling, whole again 5 s after.
- **Ridden BEFORE the motor**: the mode machine asks the set every frame of the dungeon, right after the action movers'
  ride (`ridePlatform`) and before the motor - so the motor sweeps against the steps where they now are - and a body
  standing on a step (`groundKey`) is carried with the step's own move, as a deck carries one (`player.carryBy`: the
  body and both ends of its render span, so a swing is no lerp). A step that went or came back carries nothing; a frame's
  hitch, or the clock put right, carries the body the step's whole move - it stays on its step.
  The steps move, and carry, under a window too - the realm's clock runs on.
- **While the motor runs**: THE WARP'S BREATH over the Crumble - the body moved through the resolver as the movers' ride
  moves it (the motor's own push stops at every edge; the breath does not), snapped to the ground only when it stands,
  never more than a tenth of a second's push in a frame - its wind (AmbientWindBlow1) heard once a gust, the second
  before, and seen - the streaks over the Crumble blowing its way from then through the gust (`breathSeen`; one draw,
  hidden between); the Beat's tick on each half beat, as its steps come back; and THE VOID - a body past y -30 is
  answered with the checkpoint of the span it last stood in, the void's moan heard (a step's own span, a checkpoint's
  island its own; none, A - AUDIT SD II, L4 F1: a run back off the first Drift step fell past A's near edge and was
  answered with nothing, and a run off a span's far end was cast on to the next checkpoint): the mode machine stands it
  there as the action teleport does (`TELEPORT_FREEZE_S`'s settle), and the world host takes 15% of its health, no
  shield taking it, and says *"The Hour casts you back."*
- **The edge let go**: with the Concord the realm's edge takes the Steps' band (`SD_STEPS_FREE`, 40 m either way - no
  fall meets its sides before the void has it) and the arena among its floors (`SD_STEPS_FLOORS`); a body over the
  Steps is the void's, and the cast-back is the edge.
- **Levitate warded**: the siege's ward on a running Levitate (AUDIT-SEATS G5) answers in the Hour too - the Steps are
  walked, not flown, and the Remnant's shock ring will be jumped (section 7 amended).
- **The engine, run** (the pins): the real motor on the real collider stands two whole swings on the widest-swinging
  Drift step, carried, never more than a few centimetres off its middle; crosses the widest gap (3.2 m) from a standing
  start on a 2.4 m step at the weakest build (Speed 10, Running 0, no parkour); runs up a riser at skill 0 with the online
  page's parkour (CLIMB3's wall run, the hold, the mantle); and falls when a Beat step goes from under it, answered with B.

THE FOUR HOSTS: `scenes/world.js` WIRED (the edge widened with the Steps' floors, Levitate warded in the Hour, the
cast-back's cost and line - `sdCastBack`); `scenes/worldModes.js` WIRED (the ride before the motor, the cast-back stood,
the realm's clock handed to the dungeon host - `sdClock`); `scenes/dungeonContext.js` WIRED (the Steps made for the Hour
alone, stood once, ridden on the outer host's clock, freed); `scenes/exterior.js` FLAGGED - no Hour opens on the bench.

Pins: `test/sd7b_steps.test.js` (12 - the steps made; the art; stood; on the realm's clock; carried; the Crumble, my own;
the Warp's breath and the Beat's tick; the void; the edge; the engine, run; the cast-back from the hosts' own text; the
hosts by source); `tools/mutants/sd7b.json` (37, all dead - a shudder pinned at float32's precision survived first: the
pin now asks for a real one). PINS MOVED: `test/sd6c_hall.test.js` (the Concord's floors take the Steps');
`test/audit_seats_client.test.js` (the ward answers in the Hour too) and `tools/mutants/audit_seats_client.json`'s world
ward re-aimed by content; `tools/mutants/sd6c.json`'s lash re-aimed by content (the cast-back takes the same two lines).

SD8 next: the Last Moment - the Brass Remnant (section 10), the relay's brain for it, three phases.

### SD8a - shipped 2026-10-07 (the Brass Remnant's law)

Section 10's law, pure (`net/sdRemnant.js`), as the Warden's is (`net/gateBrain.js`): the moment and a [0,1) source
handed in, no I/O - the relay's to run (SD8b) and every screen's to read. Its frame is the arena's (its centre the
origin - `arenaOf`).

- **The fight** (`newRemnantFight`): born with the first fighter's `in`, numbered (`fi` - every screen knows a fresh one),
  the Remnant at the far side facing the way in; it wakes 8 s on (`SD_OPENING_MS`). A share is the gate's law at its own
  numbers (`joinRemnant`: `SD_TTK_S` 420 x `dpsRef` x `SD_SHARE_X` 1.25, at the fraction it stands at, an empty bucket for
  one who comes to it bled, the first claim kept, 256 seats, an idle one freed); a fighter away 30 s takes its share out
  (the gate's `retireShare`). LOST after 30 s with no living fighter in the arena (`SD_LOST_MS`).
- **Belief** (`applyRemnantHit`, `applyEchoHit`, `applyHeartHit`): the gate's own hand and purse - `net/gateBrain.js`
  exports `spendBlow` and `spendPurse` now, and the Remnant keeps no blow rate or bucket of its own: one hand and one purse
  for every body in the fight. A pose in the arena, a melee blow within reach of the body it meets; asleep, outside time or
  past the Hour, nothing lands; a phase holds its floor; a stunned Remnant takes half again; the Last Moment's last blow
  fells it - where it stands, the fight's best three and every fighter's part (the gate's `topDealers`, `damageChart`;
  `earned` reads it as the gate's does).
- **The Walking Hour**: each body walks at its chosen (threat, then any) and strikes - the Stomp only within 5 m of its
  body, the Hour-Hand and the Volley from anywhere, and after a far blow it walks in 3 s (`SD_WALK_IN_MS`) before it
  chooses again unless its chosen comes within its Stomp; never a blow a third time running (the gate's `REPEAT_MAX`).
- **The Dragon Break**: at 70% it steps outside time; the Echoes rise at their spots 2.5 s on, each with half of what is
  left to 35%, the pool kept true as shares come and go (`rescaleEchoes`); one fallen and left alone 15 s rises with half
  its health; both fallen within it - the Last Moment, at 35%, the Remnant back at the centre after 2.5 s. The pair's
  Hour-Hand every 14 s from both at once (`pairHand`).
- **The Last Moment**: wind-ups 80%, its walk a quarter faster; the Reset 50 s after its return and 50 s after each ended
  (8 s, never shortened, called once the blow in flight is done): the Hearts rise (`heartCountFor`, on a ring 8-22 m out
  - SD11e: as wide as their count, `heartRingFor` -, 6 m apart, 3 m clear of every pillar, `heartHpFor`); all broken - stunned 8 s, x1.5, the next 50 s after the stun; one
  left - it lands and heals 8%. The Hearts take no blow in its last half second (`heartsOpen`).
- **The Hour's own blows** (body `SD_BODY.hour`): the Pulse every 30 s from the wake, numbered (`pulsePct` - 12% and 2%
  more each); the Hour Ends 15 minutes after the wake, every 2 s from then - and nothing else is done or believed.
- **The geometry both ends judge by**: the Stomp's ring rolling out (`stompRingAt`, `ringPassed` - its front's width;
  SD11e: its front's centre, `stompFrontAt`), the
  Hour-Hand's turn (`handAngleAt`, `handSwept` - the beam's width at the body's distance, its length), and a pillar's shade
  (`behindPillar` - the four squares on the diagonals, `SD_PILLARS`).
- **The frames** (the `sd` frame's kinds SD8b will carry): `atk {b, i, a, at, x, z, yw, tg, sw?, n?}`, `mv {b, ...}`,
  `hp`, `ph {n, at, up}`, `ec {e, at, d?, n?, r?}`, `cx`/`cxh`/`cxb`, `stun`, `lost`, and the whole state
  (`remnantStateOf`).

Simulated whole (the pins): eight fighters at their reference damage, splitting the Echoes and breaking every Heart, fell
it in about nine minutes (532 s); at 60% of it, still inside the Hour (879 s); at half, the Hour Ends with it standing at
14%; all on one Echo, it keeps rising and the Last Moment comes five minutes late; Hearts left, the Reset lands six
times and heals.

THE FOUR HOSTS: none yet - FLAGGED all four; the law is read by SD8b's relay and SD8c's page.

Pins: `test/sd8a_remnant.test.js` (12 - the numbers; a share and a seat; belief; the Walking Hour; the Dragon Break and
its pair's Hand, close in and from afar; the Last Moment and the Reset; the Hour's own blows; lost; the geometry; whole
fights simulated; the state; the gate's hand and purse shared); `tools/mutants/sd8a.json` (42, all dead - the pair's Hand
was each Echo's own at first, with the other joining when free, and two seeds never paired it: the Hand is the pair's
clock now, and a hold that only a close fight needs is pinned by one). PINS MOVED: `test/relayversion.test.js` -
`world176` re-hashed in place (`net/gateBrain.js` exports its hand and purse; undeployed).

SD8b next: the relay runs it - the realm's fight on its alarm, the wire's kinds, the `in` and the blows believed, the fall
told to the hub.

### SD8b - shipped 2026-10-07 (the relay runs the Brass Remnant)

Sections 10 and 14 on the relay - `world176` still, re-hashed in place while it is undeployed.

- **The wire** (`net/wire.js`): the fight's words each way (section 14), projected and bounded - the gate's own bounds for a
  level, a blow's number, damage and kind; the arena's frame (`SD_ARENA_BOUND` 40), the bodies, the blows, the Echoes, the
  Hearts and the Volley's marks at the law's own numbers (the wire imports no law: pinned equal); the whole state checked
  part by part (each body's blow its own; the Hour's blow the Hour's); four refusals (`SD_NO_WORDS`); the hub's door's tell
  (`validSdFellTell`).
- **The realm runs it** (`server/src/index.js`, the gate's shape): the fight kept in the realm's storage (`SD_FIGHT_KEY`),
  stepped by the Remnant's law on the realm's alarm (`_sdFightTick` - every 250 ms while it lives and someone is in the
  realm; the alarm is the room's other duties' once it is lost, fallen and told, or nobody is here), its frames fanned to
  every soul in the realm. An `in` from a verified account alive IN THE ARENA, whose game's brain is the realm's, the Hour
  still holding its slot, joins it and is answered with the whole fight; a fight LOST - or one no beat has moved for 30 s, a
  realm that emptied - is done, and the next `in` makes a fresh one, numbered on. A blow is believed from where the
  socket's own pose stands in the arena's frame (`dungeonToRealm`, `arenaOf`) - the dead strike nothing, and a blow before
  an `in` is junk - and keeps the beat as an `in` does. A soul entering the realm mid-fight is told the fight as it stands
  at its hello, as the hall is.
- **The fall, said once** (the gate's AUDIT WB A10 law - kept before it is said): the fight checkpointed with its `said`,
  `fell` to everyone in the realm with its damage chart, then the hub told until it answers (`/internal/sd/fell`): the hub
  moves its record to `fell` (net/sdLaw.js `sdFell` - the collapse and the rest from then) and says it to everyone online
  (SD2b's chat line). The realm refuses a newcomer from its own kill on, before the hub's word comes round.
- **The page** (`net/online.js`): `sendSdIn(lv)` (my game's brain said) and `sendSdBlow(k, fields)` down my own socket in the
  realm at a relay that keeps it, on the fight's bucket; `onSdFight` hears the fight from my own realm alone.

THE FOUR HOSTS: none wired - the fight's page is SD8c's. `scenes/world.js` FLAGGED (it will hand the fight to the arena's set
and its blows to `sendSdBlow`); `scenes/worldModes.js`, `scenes/dungeonContext.js` and `scenes/exterior.js` FLAGGED.

Pins: `test/sd8b_fight.test.js` (7 - the wire; the realm runs the fight - its `in`, its share, its beat, believed blows and
refused ones, the fight at the hello; refused `in`s; lost and fresh, through an eviction and past a sleep; the fall - said,
kept, told, the hub's record and its fan, the newcomer refused, the beat stopped; the page; the relay by source);
`tools/mutants/sd8b.json` (27, all dead). PINS MOVED: `test/sd3_relay.test.js` and `test/sd6b_hall.test.js` (the fight's kinds after
theirs); `test/relayversion.test.js` - `net/sdRemnant.js` joins the relay's bundle, `world176` re-hashed in place;
`test/scale2b.test.js` - thirteen calls between rooms, the tell of the fall on the find's own retry (still nine on
ROOM_CALL_MS); `tools/mutants/sd6b.json`'s `pz` unknown re-aimed by content (the kinds' list grew).

SD8c next: the Remnant on the page - the colossus, its Echoes and Hearts drawn, the telegraphs, the bar, the blows sent
through the three seams and the Remnant's own judged on the struck player's machine.

### SD8c - shipped 2026-10-07 (the Brass Remnant on the page)

Section 10 on the page: the fight seen and struck. Its blows on the player are SD8d's (the telegraphs, and each judged on the
struck player's own machine) - here they are named on the bar alone.

- **The fight as the page holds it** (`net/sdFightLink.js`, the gate's link's shape): the realm's words folded, pure
  (`foldSdFight`) - each body where its walk takes it (`sdBodyAt`, the law's own walk), facing its way or its aim, its blow
  in flight until it is done (`sdBlowDone` - the law says no word for a blow's end); the Dragon Break stops the Remnant
  where it stood; the Last Moment stands it at the centre, its first Reset 50 s on; an Echo falls where it stood and rises
  again at its spot; the stun clears the Hearts. Read and amended from the law, which lets two things go without a word:
  the Reset's Hearts are gone as it LANDS (`sdHeartsOf` reads them off the clock), and the Hour's End stops every body (the
  page stops them as the End is said - within a beat of the law's own moment). Pinned by whole simulated fights: every word
  the law says, through the wire, keeps the page's state the law's at every beat.
- **My place in it**: my `in` is due standing alive in the arena until the realm ANSWERS it - the realm's answer to an
  `in` it counted carries `me` 1 (section 14, SD8c), never the state it fans on the beat or says at a hello - so a page
  whose `in` the realm dropped (its pose a step behind its feet, not yet in the arena) never takes a fanned state for an
  answer and sends a blow the realm would call junk. Every 2 s at most (`SD_IN_RETRY_MS`); never into a fight fallen or
  past its Hour; again into a fight lost, or a fresh one; a refusal said once and standing for the fight it was said in
  (an older game's and a closed Hour's for the visit). The turns said over the screen as they come (the Dragon Break, an
  Echo felled by name, an Echo risen, the Last Moment, each Heart broken by name with how many stand, the stun, the
  loss) - through the Hour's voice, each its length, to whoever stands near the arena (AUDIT SD II, SD11d). Out of the
  realm, all forgotten.
- **The arena's set** (`scenes/sdRemnant.js`, the dungeon host's, as the hall's): the Remnant, the GOLD and SILVER
  Echoes and eight Hearts (`world/sdRemnantModel.js`; the Echoes' metals `world/sdRemnantArt.js`, records 23 and 24),
  each a draw placed where the fight says before the world pass draws it (`remnantPose`, `echoPose`, in `sdPose` - AUDIT
  SD II: they were placed after it, a frame late), a still body keeping its matrix and one not shown a hidden draw:
  waiting at its start with no fight to fight; walking; kneeling while stunned; gone outside time in the Dragon Break
  and risen out of the floor at the centre for the Last Moment; sinking away where it fell; an Echo rising at its spot
  and sinking where it fell; a Heart standing and turning while the Reset winds up.
- **My blows, the gate's three seams**: in the Hour the dungeon context asks the set where it asked the court - the
  Remnant as the boss (`target`: warded asleep and while it rises at its return; none outside time, fallen, past its
  Hour, or in a fight that never answered me), the Echoes as the host's bodies (`echoTargets`), the Hearts as the
  crystals' (`heartTargets`, until the Reset's last half second) - each with the gate's stand-ins over an Iron Atronach's
  look (a thing of metal, never swayed), so the swing, the shaft and the spell meet them by the port's own law; each blow's
  number out to the realm (`hit`, `ehit`, `xhit` - whole points, one number a blow across the bodies it meets).
- **The bar** (`ui/sdRemnantBar.js` - the gate's, in brass): its name over the phase it fights in; its turns cut at 70%
  and 35% (`ui/gateBossBar.js`'s marks follow the model now - they were laid once, at the gate's thirds); warded while
  it cannot be struck ("It stirs" before its wake, "Outside time" in the break); the Reset with its Hearts left and its
  seconds first, then a blow still winding up (its own, then an Echo's by name), the Hour's own, the stun, a blow landed
  (AUDIT SD II: the Hour's own came first and took the Reset's countdown); a fallen Echo's rising counted, its chip
  pulsing its last five seconds, and the Remnant's return (*"It returns - 3s"*); the Echoes' health; the next Reset; the
  Hour's end in its last five minutes; Felled, then faded. Over the screen near the arena alone. In the Hour's colours
  through and through (AUDIT SD IV, SD26 T6: the Reset and the End were called on Dagon's red plate, the omens' signs
  the gate's orange, its last minute pulsing the gate's red): its calls on a brass plate in their own colour, the omens'
  signs the card's brass, its last minute brass.
- **The pillars stand**: the arena's four pillars on the realm's collider (`world/sdRealm.js` `realmPillarTris`, one
  geometry with their draw) - the same squares the Hour-Hand's shade is judged by (`behindPillar`): a body stands behind
  one, never walks through it.

THE FOUR HOSTS: `scenes/dungeonContext.js` WIRED (the set, framed beside the hall in `sdPose`, before the world pass;
the three seams and their doors in the Hour); `scenes/worldModes.js` WIRED (the fight and the two doors handed down; the
pillars and the lamps' posts with the floors; the hall and the arena posed before the world pass, a hidden draw
skipped); `scenes/world.js` WIRED (the link, online alone; the realm's fight words from its own slot; my `in` with my
level and my blows; the fight forgotten out of the realm; the bar); `scenes/exterior.js` FLAGGED (no Hour offline).

Pins: `test/sd8c_remnant_page.test.js` (11 - the page follows the law; the fold word by word; my place in the fight; the
realm's `me`; the set; my `in` and my blows; the bar; the bar's marks; the bodies made; the pillars; the hosts by source);
`tools/mutants/sd8c.json` (53, all dead - two survived at first: a blow into a fight that never answered me, which
the opening refused anyway, and a frame ending my blow, which a second meeting of the same body hid; each pinned on its
own now). PINS MOVED: `test/wb4b_gate_blows.test.js`, `test/wb9c_gate_reckoning.test.js`,
`test/wb11_gate_host.test.js` (the three seams answered by the Remnant in the Hour); `test/sd5a_realm.test.js` (the
fight's frame after the realm's); `test/relayversion.test.js` - `world176` re-hashed in place (`me`);
`tools/mutants/wb4b.json`'s shut door re-aimed by content.

SD8d next: its blows on me - the telegraphs on the arena's floor, each judged on my own machine (the ring jumped, the
Hand outrun or shaded, the Volley's discs and its burning brass, the Pulse, the Reset, the End), its sounds, its fall.

### SD8d - shipped 2026-10-07 (the Brass Remnant's blows on me)

Section 10's blows, on the struck player's own machine - the gate's law (co-op's: an enemy's strike on a client is applied
by that client); the relay never learns who was struck.

- **Judged on my feet** (`net/sdStrike.js` `sdBlowVerdict`, pure, over the geometry the law shares - `stompRingAt`,
  `ringPassed`, `handSwept`, `behindPillar`): each part of each blow once, a share of my own maximum health and its base
  (the gate's `strikeDamage`). THE STOMP - its disc as it lands on a body within 7 m; its ring rolling out to 22 m strikes a
  body ON THE GROUND as its front passes (the motor's `grounded` - a body in the air lets it pass under, and is never struck
  after). THE HOUR-HAND - its beam strikes a body it sweeps over, within its 34 m, unless a pillar stands between the body
  and where it was cast from. THE GEAR VOLLEY - one strike however many of its discs meet me, and its brass burning at
  each mark for 6 s (`sdVolleyPools`): a bite each second I stand in it, the first a second after I stepped in (the gate's
  burning-ground law). THE HOUR'S OWN - the Pulse (its share grows with its count), the Reset as it lands (a broken one
  never does - the stun's word takes it out of flight) and the End: the whole arena and its slack, nobody on the Steps. A
  landing first seen more than 400 ms after it is not judged (the gate's `STRIKE_LATE_MS`). Every strike lands by the
  dungeon context's own door (`strikePlayer` - the hurt, the flash, the cry).
- **Seen** (`scenes/sdRemnantBlows.js` `sdTelegraphShapes`): every blow in flight - the Remnant's, each Echo's (faster),
  the Hour's own - on the arena's floor by the gate's telegraph pass (`render/gateTelegraph.js`, which now draws over
  another floor than the Burning Court's: its centre, its radius, its one court - the court's own by default): the
  Stomp's disc filling to its landing, then its ring rolling out at its front; the Hand's half-circle as it gathers, then
  its beam where it stands in its sweep; the Volley's marks; the Hour's own over the whole floor (the Reset's and the
  End's in Dagon's edge); the burning brass coming up and dying down.
- **Heard and said**: each blow's wind-up at its word and its landing where it lands (DAGGER.SND's own, pitched for a
  colossus of brass); the Reset called with its count (*"The Reset! Break all 5 Hearts!"*) and the Hour's End, each
  once; each Heart's rise, hit, shatter and ring, the gate's crystals' own cues (AUDIT SD II - they rose and broke in
  silence).
- **Its fall**: its body's thud and the line, once a fight; then the fight's damage chart (the gate's own,
  `ui/gateDamageChart.js`) from the realm's word of the fall - its column the Hearts, in the Hour's brass; the line to
  the whole Hour (AUDIT SD II).

THE FOUR HOSTS: `scenes/world.js` WIRED (the blows made online beside the link - my feet in the Hour, the motor's ground,
my entity, the dungeon context's strike door; framed in the realm, forgotten out of it; the floor's hook);
`scenes/worldModes.js` WIRED (the dungeon arm draws the floor in the Hour, after the court's); `scenes/dungeonContext.js`
unchanged (its strike door is the gate's); `scenes/exterior.js` FLAGGED (no Hour offline).

Pins: `test/sd8d_remnant_blows.test.js` (8 - the Stomp; the Hour-Hand; the Volley and the Hour's own; the floor's shapes;
the driver judging on my feet; the brass burning and the Hour striking; the fall and the floor drawn over the arena; the
hosts by source); `tools/mutants/sd8d.json` (32, all dead - at first one record did not parse, and two survived: a
second health guard behind the frame's own (dropped - one law, the frame's) and the burning brass never drawn (pinned
now)). PINS MOVED: `test/sd8c_remnant_page.test.js` (the blows forgotten with the fight); `test/audit18_bible_docs.test.js`
(AUDIT 39r - twenty-nine foreign-pass call sites: the floor's hook), and the world host's own three counts of them,
twenty-four now (`test/farring.test.js`, `test/glstate.test.js`, `test/perf2.test.js` - found by the whole suite). My copies of the court's `strike`
and `me` doors were reworded so the gate's records keep one site each (`wb4.json`'s, `gateux.json`'s).

The Brass Remnant (SD8) is whole: its law, the relay running it, the page showing it and carrying my blows, its blows on
me. SD9 next: the feat - the receipts, the spoils, the set, the title, the aura.

### SD9a - shipped 2026-10-07 (the Hour's receipt)

Section 11's kill, on the relay - `world176` still, re-hashed in place while it is undeployed.

- **The receipt** (`net/sdReceipt.js`, pure, all three ends import it): `h1.<claims>.<signature>` - the slot, the boss
  (the Remnant alone), the account, the relay's own 32-bit seed, how it was earned (`dealt` | `stood`), the level the
  fight admitted it at, issued and expires a week on - signed by the relay's one key (`GATE_SIGNING_KEY`, the gate's,
  the raid's and the serpent's). The version is inside the signed bytes, so an `h1` is refused by every other verifier
  and theirs by this one; its claims carry none of the others' own fields besides. With no key it goes out unsigned
  (`h1.<claims>.`) - the page still rolls its spoils off the seed; the account service declines it (SD9b).
- **Minted at the fall** (`server/src/index.js` `_sdFightFallOnce`, the gate's law): for each fighter who EARNED it (the
  gate's `earned` - 2% of their own share dealt, or alive in the arena half the fight), before the fall is said - kept
  with the fight (`rc`) and with who stood in the realm at the kill (`here`), then `fell` to the realm, then each
  earner's `rcpt` on their socket there, then the hub told. A late `in` after the fall is answered with the fall and
  its receipt again.
- **Kept by the hub** (`_sdKeepReceipts`, `_sdReceiptTo`, `_sdSpent` - the gate's AUDIT WB A4, WBX S4 and WBX2 M3
  laws): one key an account (`sdrc:<sub>`, its latest) for the receipt's week, never over a newer slot's or the
  account's word that this slot's is spent (that word may come first). A fighter who stood in the realm is held from
  its hellos two minutes (`SD_HERE_HOLD_MS` - the realm's floor spends it); every other earner's seat in the hub is
  handed it at once. A hello hands a good one - never a spent or expired one (forgotten there); `spent {s}` from the
  account's hub socket marks it; the hub's sweep forgets the expired (its own cursor, `sweep:sdrc`).
- **The page** (`net/online.js`): `onSdReceipt(r, room)` hears my receipt from my own realm or the hub, never a cell;
  `sendSdSpent(s)` says a slot's spoils taken to the hub, signed in, at a relay that keeps it, on the find's bucket.

THE FOUR HOSTS: none wired - the receipt's page is SD9c's (the spoils thrown from where it fell). `scenes/world.js`
FLAGGED (it will hand `onSdReceipt` to the spoils and `sendSdSpent` to their taking); `scenes/worldModes.js`,
`scenes/dungeonContext.js` and `scenes/exterior.js` FLAGGED.

Pins: `test/sd9a_receipt.test.js` (6 - the receipt; the wire; the relay signing the fall; the hub keeping them; the
page; the relay by source); `tools/mutants/sd9a.json` (55, all dead - at first three survived: an order mutant that
left the first mint in place (re-aimed, and pinned by the record as the fall was fanned), another account's receipt
kept (its pin had changed the slot as well) and the newest-socket loop, which was the gate's own copy of the rule:
the hub now hands by `_siegeSockets` (AUDIT SEATS-3 B4's one pass), the serpent's way, and the pin is ONE-SEAT's -
a new tab takes the seat, and the receipt goes to it, never the tab it closed). PINS MOVED: `test/relayversion.test.js` - `net/sdReceipt.js`
joins the relay's bundle, `world176` re-hashed in place; `test/sd3_relay.test.js` and `test/sd8b_fight.test.js` (the
kinds' lists - `spent` in, `rcpt` out; a late `in` reads the fall under its receipt; the tell's projection carries
`rc` and `here`); `test/auditwbx2.test.js` - the hub's sweep reads six cursors in its one read now, the Hour's
`sweep:sdrc` last (found by the whole suite); `tools/mutants/sd6b.json`'s `pz` unknown and `sd8b.json`'s hub-not-told
re-aimed by content. Two of
my lines were reworded so the gate's records keep one site each (`earned` as a filter; the bucket's toll).

SD9b next: the claim - the account service verifies the `h1`, writes the kill once a slot and account, and rolls
Hourbreaker and The Turning Hour on that first write.

### SD9b - shipped 2026-10-07 (the claim, the Hours broken and Hourbreaker)

Section 11's claim, on the account service - `acct94` (acct91 on its branch, renumbered past main's CAP-OFF, then
FOUNDER5 and then CRAFT2-CRAFT5 at the merges), migration 0090 (0087 until FOUNDER5's `0087_founder_live` took the number on main, 0088 until CRAFT2-CRAFT5's `0088_five_crafts` and `0089_temper_reforge` took the next two); the relay's `world176` re-hashed in place (the
token's titles).

- **The claim** (`server-account/src/sds.js` `claimSd`, `POST /v1/sd/claim` behind a session - the gate's `claimGate`
  rung for rung): the `h1` verified with the relay's public half (`GATE_PUBLIC_KEY`; none, 503), naming the session's
  account (another's, 403; a refusal 400 with its rung); one row a (slot, account) in `sd_kills` - how it was earned,
  the level, what it granted - so a receipt counts once whatever happens to it; a guest's fought and not counted,
  counted once the account registers inside the receipt's week.
- **The grants** (`sdHonoursRoll`): Hourbreaker one kill in four, The Turning Hour one in eight, off the claim's own
  draw (SD20b - the receipt's seed until then) - its own stream, salted (`SD_HONOURS_SALT`) - rolled on the row's FIRST
  write alone: the
  row stamped with the claim's nonce, the grants OR-ed onto the account's `players.sd_honours` by that row alone in the
  same batch. Once held, held for good: a later kill that grants nothing takes nothing, a second receipt for a slot
  already counted grants nothing.
- **The title** (`server-account/src/titles.js`): Hourbreaker held off the row (`sd_honours`), the Broker's sale's way
  - a registered account's alone; on the wardrobe, worn and signed into the token like every title. Its word and its
  colours (`ui/playerBadge.js`): the Remnant's brass into its bar's gold into the light of its heart, the bar's gold
  where a face draws no gradient. `net/identityToken.js` TITLES gains it, last. The aura's grant is recorded now and
  worn with its look (SD9c).
- **The count**: *Hours broken* on the account card (`sdRecordText`) and the Inspect card (`profileSdLine`, said once
  there is one), from `/v1/account` and the record the Inspect card reads (SD11c: the page's read of that record kept
  the duels and the gates alone - until AUDIT SD II the card said none of the Hours, nor the towns or the serpents).
- **The device's book** (`net/sdClaims.js`, the gate's `gateClaims.js` without its rite or embers): every receipt the
  relay hands (`onSdReceipt`) kept on the device (one a Hollow and account; ninety-six an account, 256 in all - SD11c:
  it was eight for the whole device) and offered at once, again
  every ten minutes and at once when another account signs in; counted or claimed before, let go with its lines - the
  count, *"The Hour names you Hourbreaker."*, *"The Turning Hour turns about you."*; a guest's kept and told once to
  register; a refusal the service can mend kept; an unsigned or expired one never kept; another account's waits.

THE FOUR HOSTS: `scenes/world.js` WIRED (the book made online on the account service's call and the spoils' store,
handed every receipt the relay hands, offered again each frame); `scenes/worldModes.js`, `scenes/dungeonContext.js`
unchanged; `scenes/exterior.js` FLAGGED (no Hour offline).

Pins: `test/sd9b_claim.test.js` (8 - the roll; the claim; the grants; the worker; the client's call; the device's
book; the words and the cards; the hosts and the service by source); `tools/mutants/sd9b.json` (34, all dead - at first one hung: a roll that drew once for both grants could never give the aura alone, and the pins' search for such a seed looped; it is bounded now, and fails).
PINS MOVED: `ACCOUNT_VERSION` acct91 (acct92 since the merge past CAP-OFF, acct93 since the merge past FOUNDER5, acct94 since the merge past CRAFT2-CRAFT5) in the fifteen files that hold it and
`server-account/wrangler.toml`;
`test/duel_record.test.js` (the Inspect card's record carries the Hours); the vocabulary's newest (`test/acc3titles`,
`test/aegis`, `test/primarch`, `test/crystalfist` - Hourbreaker after the Crystal Fist); `test/relayversion.test.js`
(`world176` re-hashed: the token's titles); `.github/workflows/account-deploy.yml` (the service now bundles
`net/sdReceipt.js` and `systems/wind.js` - `test/accountdeploy.test.js` walks the graph); three records from earlier
slices re-aimed by content (`fb1004d_knight_house.json`'s version and `gatekeys.json`'s empty var - acct91 -, and
`raid4.json`'s Inspect record, which carries the Hours now). Found by the whole suite: `test/accountworker.test.js`
(the schema - `sd_kills` among the tables, `sd_honours` among the row's columns) and
`test/serpent1_auditclient.test.js` (the Inspect card's facts - the Hours after the serpents).

SD9c next: The Turning Hour - the aura's look, worn.

### SD9c - shipped 2026-10-07 (The Turning Hour)

Section 11's aura - "a slow wheel of brass gears and gold light about the wearer" - drawn and worn. The relay's
`world176` re-hashed in place (the token's auras); no account version (SD9b's grant already lays it on the row).

- **Held and worn**: `net/identityToken.js` AURAS gains `turninghour`, last; `server-account/src/titles.js` holds it off
  the row's second grant (`sd_honours`, SD9b - a registered account's alone, never off the title's bit), and it is worn
  through the aura's own door and signed into the token as every aura is. Its word *The Turning Hour* and its paint
  the Hourbreaker's (`ui/playerBadge.js` - the button in the bar's gold).
- **Drawn** (`render/auraRing.js`, the aura pass's seventh look, added whole as the radiance is, in the Hourbreaker's
  own colours): THE GROUND - a brass wheel about the feet (its rim; 24 teeth out of it; its hub and six spokes) STEPPING
  on the second as a clock's escapement does (`turningWheelAngle` - eased over a quarter of each second, held the rest,
  never back - forward, clockwise as the eye sees it, against the dial; SD11f: its angle rose, and through the camera's
  one mirror the wheel stepped anticlockwise, the dial's own way - two turns over the aura's clock), a light that does
  not turn gleaming on the brass as it passes under; outside it the Hour's dial - a line of gold and its twelve marks,
  the Hour's own the longer - turning BACK, as the Hour's sky's hands do - as the eye sees it, anticlockwise through the
  game's camera (AUDIT SD II: its angle fell, and the camera's one mirror turned it clockwise on screen); gold light
  pooled at the feet, breathing. THE WALL (the pass's strip at the teeth's tips): the wheel's edge seen from the side,
  its teeth's faces passing round with it and gold along their top; gold light rising off it, gone by the knee; fourteen
  motes rising. It kindles up, as the radiance does; every rate whole over the clock, the teeth, spokes and marks whole
  round - no seam behind the wearer.

THE FOUR HOSTS: unchanged - the pass draws every wearer's look already (`scenes/world.js`, `scenes/worldModes.js`);
`scenes/dungeonContext.js`, `scenes/exterior.js` untouched.

Pins: `test/sd9c_turning.test.js` (4 - held and worn; the look's law; the wheel, the shader run; the dial and the
light, the shader run); `tools/mutants/sd9c.json` (20, all dead). The shaders compiled and linked in headless
Chromium's WebGL2 (swiftshader), and the ground and the strip were rendered to images and looked at. PINS MOVED: the
vocabulary's auras (`test/aegis`, `test/primarch`, `test/seraphwings`, `test/shadowcloak`, `test/crystalfist` - the
Turning Hour after the Crystal Resonance; `test/primarch`'s paints); `test/relayversion.test.js` (`world176`
re-hashed: the token's auras); thirteen records from the earlier auras' slices re-aimed by content - their
vocabulary's line and their paints' (`aegis`, `crystalfist`, `primarch`, `seraphwings`, `shadowcloak`), and the Broker's-first
order across the held auras, which now hold the Hour's grant too. The strip's kindling is worded apart from the
radiance's, so `primarch.json`'s kindling record keeps one site.

SD9d next: the spoils thrown from where the Remnant fell.

### SD9d - shipped 2026-10-07 (The Brass of Numidium)

Section 11's set, whole but for the roll that pays it: the spoils (SD9e) roll it last. SD9c named the spoils next;
the set came first, so the spoils' last roll is final when it is written. No relay or account change - a set is the
client's law, and the wire's check of an Aetheric piece reads every record already.

- **The law** (`systems/sigilSets.js` `numidium`; `systems/sigil.js` names it after the serpent's): Aetheric, naming
  no raiding party; its patron no Daedra but Kagrenac, the Tonal Architect who built the Walking Brass; its colour
  the Hourbreaker's brass (`ui/playerBadge.js` `HOUR_BRASS`). Dwemer Brass, Gearward and The Hour Turns at 2, 4 and 6
  pieces (`Sigil-Sets.md` section 6d). Gearward's winding is its `recover`, as every timed power's is (CARD-FIT: never
  in the brief's words - the card's own tag, and a line says it after the brief).
- **The records** (`systems/aetheric.js` `NUMIDIUM_SET_PIECES`): nine of Dwarven make in the places' order - section
  11's amendment: the design's longsword, war axe and staff were three weapons for one place, so a round shield and a
  one-handed Longsword stand where they stood. Every affix at the Legendary band's top and the Hour-Hand's blow the
  sigil's greatest - the Regalia's measure: the hardest fight in the game pays what the gate's Warden does. One
  resistance of an element at most, and never magic or shock (the 2-piece tier's). `AETHERIC_RECORDS` ends with them,
  so the Test Room's ladder and the Codex take them with no word of their own. `rollNumidiumPiece` - a third of the
  time, the same seed choosing which; one roll when nothing drops, two when a piece does - waits for the spoils.
- **The powers** (`systems/sigilSetPowers.js`, through SET2's seams): Dwemer Brass in the fold. Gearward in the damage
  modifier: while the gear is wound a foe's blow (the door's mark - never a fall, a poison's round or a spell) lands
  its share lighter in whole points, and the gear winds again. The Hour Turns a death save, tried when no Bulwark
  answers (the two are never worn at once: six and six is past nine places) - the door leaves me at 1, and the hurt
  listener returns its share through the one heal a power gives as the door says so; a fall's death is turned back
  too, as every death save's is. The round says it ready again, the HUD's chip shows its recovery, the states carry
  Gearward's winding and its recovery.
- **The voice** (`scenes/world.js`): the Orrery hall's own sounds (`scenes/sdHall.js` `SD_HALL_SOUNDS`) - the gear's
  clunk for Gearward, the low bell's toll for The Hour Turns.

THE FOUR HOSTS: as the Coilscale's - the powers ride SET2's seams, which every host's combat already calls; the one
host-side wiring is `scenes/world.js`'s voice, which `scenes/worldModes.js`'s interiors and `scenes/dungeonContext.js`'s
dungeons sound through; `scenes/exterior.js`, the offline town page, registers no sets' voice.

Pins: `test/sd9d_numidium.test.js` (8 - the law; the records; minted and checked; the drop; Dwemer Brass; Gearward;
The Hour Turns; the host); `tools/mutants/sd9d.json` (44, all dead). PINS MOVED: the sets' lists (`test/set1_law`,
`test/serpentset` - the Brass after the Coilscale, its records after the serpent's) and the powers' states and voice
(`test/set3_powers`); three records re-aimed by content (`set1.json`'s order, `serpentset.json`'s set and its
records).

SD9e next: the spoils thrown from where the Remnant fell.

### SD9e - shipped 2026-10-07 (the spoils thrown from where it fell)

Section 11's spoils, whole. No relay or account change: the receipt (SD9a) carries the seed and the level, and the hub
already keeps a receipt until a slot's spoils are said spent (`spent {s}`).

- **The roll** (`systems/sdSpoils.js`, the gate's makers on the receipt's own stream): gold 400 a level, a fifth either
  way; a first piece Legendary a quarter of the time, else Rare; two Rare or better by a boss's chances past the
  ladder's top tier with a lucky hand (`SD_SPOILS_SOURCE` - tier 24, luck 70; `rareOrBetter` cuts the Common and Magic
  shares away); every piece known; the ladder's last pass; and LAST the Brass of Numidium a third of the time (SD9d's
  `rollNumidiumPiece`), so no roll before it ever moves. `sdSpoilsList` is the pool's list - the pieces, then the gold,
  each dressed in the treasure flat its own look-stream picks. A fighter who dealt and one who stood are paid alike, as
  the gate pays them.
- **The burst** (`scenes/sdSpoils.js`, the court's burst for the arena): `SD_SPEW_AT_MS` (1.2 s) into the fall, off my
  receipt from my own realm, the spoils leave the cage of its chest where it fell - at its height as it sinks - toward
  my feet, kept on the arena's floor (`SD_SPOILS_KEEP`, two metres inside its rim: never off its edge into the void,
  over the realm's real collider with its pillars); once a fight; never off another slot's receipt; rolled at the
  level the fight admitted or mine, the lower. A fighter the realm counted in with no receipt `SD_RECEIPT_WAIT_MS` into
  the fall is told so, once; a watcher is told nothing (`net/sdFightLink.js` `counted` - the realm counted me in this
  fight, fallen or not). Leaving the Hour gathers whatever is still on the floor.
- **The pool** (`scenes/spoilsPool.js`): the burst takes a `roll` as the grant does, and a pool says its own words
  gathering (`gathered` - the Hour's said in the chat, SD11c). The Hour's pool keeps its own keys (`SD_SPOILS_KEYS`),
  its crash records (eight), each piece's own picture and the loot piles' words; a spent receipt is said to the hub as
  its slot (`sendSdSpent`) - and a word that cannot go is owed on the device and said again until it goes, on its own
  account's socket alone (SD11c).
- **The host** (`scenes/world.js`, `scenes/worldModes.js`): my realm's receipt is kept for the burst while I stand in it;
  any other (the hub's at a hello, a realm I have left) is its spoils straight into the pack, one tab at a time. The
  saves, the loads, the realm's checkpoints and the crash's door hold the Hour's pool as they hold the others. The
  floor's press, plaque and ray ask the pool of the place I stand in (`floorPool` - the court's anywhere but the Hour);
  the realm stands its pieces as targets and names them, lights them before its lamps, and draws their loot lines in
  the arena floor's pass.

THE FOUR HOSTS: the burst, the pool's floor and its press are the streaming page's - `scenes/world.js` with
`scenes/worldModes.js`'s dungeon arm, where the Hour stands; `scenes/dungeonContext.js` asks its plaque through the hooks
it already asks for the court's; `scenes/exterior.js`, the offline town page, has no Hour. A receipt granted outside
the realm is the world host's, in every mode.

Pins: `test/sd9e_spoils.test.js` (9 - the roll; the order, an oracle over 300 seeds; the list; the keys; the pool's
roll; the burst; no spoils, said; on the arena's floor, over the real collider; the host); `tools/mutants/sd9e.json`
(44, all dead). PINS MOVED: the gate's spoils seams (`test/wb9f_gate_spoils` - the floor of the place I stand in;
`test/gateux_gate` - the press), the receipt's handler (`test/sd9b_claim`), the arena floor's pass (`test/sd8d_remnant_blows`
- the spoils' lines in it), the realm's lights (`test/sd5a`), the billboards (`test/prww1_werewolf`, `test/wb4_gate_boss`,
`test/fb1003b_cabinhull`), the dungeon's target families (`test/worldhover` - eight) and the systems' module count;
seven records re-aimed by content (`raid4b.json`'s roll, `wb9f.json`'s press, `sd9b.json`'s book, `prww1.json`'s and
`wb4.json`'s billboards, `serpent1_audit.json`'s two realm hooks). The realm's target lines are worded apart from the
court's, so `wb9f.json`'s stands keeps one site.

SD10 next: the collapse, the readouts and the arc's audit.

### SD10a - shipped 2026-10-07 (the collapse: the way home and the readouts)

Section 11's collapse, as the page lives it. The record's law was SD1's (`fell` for `SD_COLLAPSE_MS`, then `gone`) and
its end SD2d's (whoever stands in the Hollow or its Hour cast out before its door, with the closing line); what the
three minutes between were missing was a way out and a clock. No relay or account change.

- **The way home** (`scenes/sdEnd.js` `standReturn`, `SD_HOME_TEXT`): the Return's pale light, stood alone and later -
  where the Remnant fell, once its body has sunk (`scenes/sdRemnant.js` `SD_REM_SINK_MS`), on the arena's floor - under
  the Hour's own words on its plaque (*The Way Home*, *To the Abyss Dungeon's door* - SD20e T15, the player's word). Walked into or pressed (SD11f: pressed
  alone - a step after the spoils carried a player out mid-loot), it carries the player out of the Hour under the veil,
  before the Hollow's door outside: the mode machine's own exit, the one the Hour's end casts a player out by
  (`scenes/world.js` `sdWayHome`); leaving gathers the floor's spoils (SD9e). The dungeon host stands it where the world
  host says (`sdHomeAt` - the fight this page holds, one place a fight) and takes it down when it says none; in the
  Hour, the Hollow's Return check (the boss fallen, the Return out) never runs.
- **The readouts** (`scenes/sdHost.js` `sdCollapseDue`, `sdCollapseLine`, `SD_COLLAPSE_WARN_MS`): whoever stands in the
  Hollow or its Hour while it collapses is told how long is left - at the fall (or the first frame they stand inside
  during it, with what is left), then at a minute, thirty seconds and ten - each once a slot, never one already passed,
  over the screen, after the fight's turns and the floor's words (the Hour's voice, SD11d); in the Hour its first names
  where the way home opens, in the Hollow the Hollow's own words. A Hollow unbeaten counts its fade the same way, at
  five minutes, one, thirty seconds and ten (`sdFadeDue`, `sdFadeReadout` - AUDIT SD II). The countdown is the gate's
  own (`countdownText` - seconds rounded up, never 0:00 while time is left). The Timers row already counted it (SD2c:
  "<name> collapses").
- **Not done, said so**: the design's "the Hollow sinks into its pixel" - a location's blocks have no sink in this port;
  at its end the Hollow is taken down (SD2b's unstand) the frame nobody stands in it, its column of light out with its
  phase (SD2c).

THE FOUR HOSTS: the way home is the dungeon host's (`scenes/dungeonContext.js`, the Hour's own Rift set) through the mode
machine's doors (`scenes/worldModes.js` `sdWayHome`, `sdHomeAt`) to the world host's (`scenes/world.js`); the readouts
are the Hollow host's, which frames in every mode (SD2d), voiced by the world host. `scenes/exterior.js` has no Hollow.

Pins: `test/sd10_collapse.test.js` (4 - the readouts' law; the readouts in the Hollow and the Hour; the way home; the
hosts by source); `tools/mutants/sd10.json` (21, all dead). PINS MOVED: the Hour's Rift set (`test/sd5a` - its way
home with it).

SD10b next: the arc's audit.

### SD10b - shipped 2026-10-07 (AUDIT SD: the arc's audit)

Four lenses over the arc as SD10a left it (`eb38ce2c`) - the page; the relay and the law; the claim, the set and the
spoils; and these pages against the code - each finding traced by hand before anything changed. What was real is fixed
and pinned; what was not is said so below. The relay stays `world176`, re-hashed in place (undeployed); no account change.

**The page**

| | what was wrong | now |
|---|---|---|
| C1 | THE HUB'S HAND OF A RECEIPT WAS DROPPED. The hub hands an earner's Hour receipt down its own socket - the chat tab's link in `chat:world`, a session apart from the world's - at the kill to one who stood outside the realm (dead and waking at a temple, gone by the way back) and at every hello for its week; that link heard the gate's, the serpent's, the rite's and the record's words but never `onSdReceipt`, so those earners had no spoils, no *Hours broken*, no Hourbreaker or Turning Hour roll, and a page that crashed before its throw had no way back to them | heard on the hub's link as the world's session hears the realm's (`scenes/world.js`), to the account service and the spoils; and a receipt my realm handed me, kept for a throw that never came (I left first), is its spoils straight into the pack as I leave the Hour (`sdReceiptsLeft`), once |
| C2 | A FRESH FIGHT'S BLOWS WERE NEVER JUDGED. The driver remembered a blow by its number alone, and the law numbers each fight's blows from 1 (`seq`): after a lost fight, every blow of the next numbered as one already judged passed through whoever stood in the Hour - unheard, unshown, never struck - and the last fight's brass kept burning | the marks and the brass are the fight's own (`scenes/sdRemnantBlows.js` - forgotten as a fresh fight is heard) |
| C3 | THE NEXT HOUR SAID NOTHING. The fall's line, thud and damage chart and the End's line were said once a fight NUMBER, and every Hollow's Hour numbers its fights from 1: the next Hollow's kill in the same page session was silent and its chart never shown; and the way home stood where the LAST Hollow's Remnant fell | the driver forgets them as the Hour is left; the way home is one place a FALL (keyed by its instant) |
| C4 | THE RIFT SHUT ON ITS OWN FIGHTERS. During the collapse the Rift refuses a newcomer and admits whoever went through before (SD4b's `entered`, as the realm keeps them) - but the host never passed `entered`, so a fighter who stepped back into the Hollow was told *"The Hour has closed."* | the host remembers the Hollows whose Hour it went through this session, and says so |
| C5 | INSIDE A PILLAR. The Remnant's walk never minds the four pillars, so where it fell can be inside one: the way home stood inside a pillar's square, out of reach, and the spoils were thrown from inside it | both put out of the square the shortest way (`scenes/sdSpoils.js` `clearOfPillars` - the way home `SD_PILLAR_CLEAR_M` clear of its side, the throw 0.3 m) |
| C6 | MADE A FRAME FOR NOTHING (AUDIT WB D10's law). The Rift's and the Return's batch list was made every draw; the Orrery's six hand matrices every frame at rest; each of the 23 Steps' places twice a frame | the list made as a portal stands or goes; a hand's matrix as it turns (and drawn where its stone is at the first word - which had ridden on the redraw); the Steps' places into one scratch (`world/sdSteps.js` `stepAt`'s `out`) |
| C7 | GEARWARD NEVER MET THE FIGHT ITS SET DROPS IN. The Remnant strikes through the court's door - no attack formula, no struck tail (AUDIT SET P-L9, SETS L4: no reach power answers a world boss) - so its own set's Gearward read every Stomp, Hand and Volley as a fall | a body's own blow (the Stomp, the Hand, the Volley - the Remnant's or an Echo's; never the Hour's unresisted magic over the whole floor, the Pulse, the Reset and the End, nor the burning brass) is marked as a world boss's as it lands (`scenes/sdRemnantBlows.js` `bodysBlow`, `setBossStruck`), and Gearward alone reads that mark (`Sigil-Sets.md` section 8); the Warden's court marks nothing - the gate's bytes are untouched |
| C8 | A CUT OF NOTHING SPENT THE GEAR. A blow too small to lighten by a whole point (3 or less at Faint) still wound the gear for 18 s, with its clunk | no cut, no winding |
| C9 | A HOLLOW WAS RE-LAID ONLINE. `dungeonSizeFor` online answered the world's size for every dungeon, the Hollow's too: of 400 slots, 92 were laid small and 196 medium - against sections 1, 5 and 13 and the feat | whole, by the tier law, online and off (`world/smallerDungeons.js`); the arc is undeployed, so no page ever laid one otherwise |

**The relay and the law**

| | what was wrong | now |
|---|---|---|
| R1 | AN ENDED HOUR WAS NEVER LOST while any fighter's last pose stood alive in the arena (a frozen tab; a page that never applies the End's blows): the realm beat on, every newcomer was told the fight is over, and no fresh one could begin until that socket closed - perhaps for the Hollow's whole life | lost `SD_LOST_MS` after its End (`net/sdRemnant.js` `stepRemnant`) |
| R2 | THE REALM'S 256 SEATS WERE FOR LIFE. Every hello - a guest's, a watcher's - took a seat on the realm's list and nothing gave it back: a few hundred guest tokens made *"The Hour is full."* for every real player until the Hollow faded | a full realm frees the seat of an account with no socket in it and no seat in its fight (the gate's AUDIT WB A1 law) |
| R3 | THE HUB'S SILENCE CLOSED THE HOUR. The realm's ask of the hub answered `null` for no answer - read as "no record", *"The Hour has closed."*, a policy close the page takes as final - and kept it 10 s: a deploy's hello storm could cast every fighter reconnecting in that window out of the fight | no answer is a busy close the page retries (`CLOSE_BUSY`), an `in` unanswered, a blow not stopped, and never kept |
| R4 | THE DIRECTOR SLEPT THROUGH THE COLLAPSE. A kill never re-armed the hub's alarm, armed for the Hour's own end or the sweep's six hours: the collapse's end and the next rise waited on it - the two hours' rest up to six | armed from the fall (`_sdFellInternal`) |
| R5 | EVERY `in` A WRITE. A known fighter's `in` again (its retry, a second tab - up to `SD_FIGHT_HZ` a second) forced the whole fight to storage (the gate's AUDIT WB A3) | written for a fresh fight or a newcomer alone |
| R6 | A KILL HEARD LATE WAS NO KILL. The hub judged the realm's word at its own hearing: a kill a moment before the Hour's end, told on the retry after it, was announced unbroken; and a page that stayed in the realm past its cast-out could still fell the Remnant | the fall at its own instant, never later than the hub's now; no blow lands once the hub's record no longer holds the slot |
| R8 | THE FIGHT SKIPPED THE PUZZLE. An `in` never asked the realm's Concord, which the relay holds: a page that never set the Orrery (the bridge is the page's) fought anyway | no `in` before the Concord |

**The docs** - fourteen places these pages said what the code does not; the first was C9, fixed in the code. Section
1's gate modules "not changed" (four slices widened a seam of the gate's - named there now); section 1's diagram, the
Hollow "sinks" (it is taken down); section 2's `n`, "how many earned the feat" (how many fought - every seat, as the
gate and the serpent count); section 3's ranking (the hubs' own claim) and its site "2 to 5" pixels out (two to four,
its nearest town the city); section 5's template "from the region's" (the Bay's, with a spawn's clearance, never the
main story's); section 6's "7 m" Rift (up to 7 m, as its hall allows); section 7's archive range (one archive, records
0-24); section 13's and the ledger's SD-ONLINE row's `world172` (`world176`; the SD-ONLINE and SD3 records keep theirs,
marked); section 14's `site` vote for a herald that was never built (struck); section 15's offline plaque (the mod's own
*To <name>*); section 16's SD1 "spot law" (the find's check); SD10a's test count (4). And the sections the fixes moved
are said as they stand now (6, 10, 11 and 14).

**Said so, not changed:**
- R7: a dead realm's storage (`sdfight` with its receipts and chart, `sdorrery`, `sdrealm`) is never cleared - small,
  one set a Hollow, and a slot is never used twice; the object sleeps. (AUDIT SD II, L5 F2: "never used twice" held
  only while the hub's record read back - the hub keeps its highest slot now, SD11b.)
- The Orrery's gearing is drawn from the public slot (`orreryOf`), so a page can compute its answer, and any account - a
  guest's too - may turn its stones and fray it. The relay judges the turns; the riddles are for the players who read
  them. (AUDIT SD II, L7 H2: one such hand held the Concord off for good - the stones' rights now, SD11b.)
- The level an `in` says is the page's, clamped - the gate's own law (a realm's socket carries no signed level, as the
  serpent's `cl` is): an account may claim the top and stand idle in the arena, its share standing while it stands.
  (AUDIT SD II, L7 M2: it did carry one - the token's `cl`, which the realm dropped - and a share stood from anywhere in
  the realm; the level is the token's now, and the share the arena's, SD11b.)
- The hub keeps a kill's receipts whether or not its record took the fall: the realm's signed word is the kill's, and
  with R6 the two agree but for a hub that did not answer at the very end.
- Gearward spends its winding in the set's damage step, before the loot's evasion and a Shield's pool: a blow then
  evaded or absorbed has spent it. Where it sits beside evasion is a design call, left as SD9d made it.
- The claim's *"The Hour names you Hourbreaker."* is said again when a later kill rolls a title already held (the
  answer is what the kill rolled, as SD9b documents).
- The Remnant's telegraph shapes and the driver's lists are made each frame - a handful of small objects while blows
  fly; the gate's court refills its own (AUDIT WB11 C8), and the arena's are left for a follow-up (AUDIT SD II: none is
  made while no blow is in flight).

Pins: `test/sd10b_audit.test.js` (17 - a fresh fight's blows; the next Hour's lines; the way home one place a fall; the
Rift's memory; the receipts wherever they come; clear of the pillars; nothing made a frame for nothing; Gearward and the
world boss; the body's blows alone; a Hollow whole; an ended Hour lost; the hub's silence; no blow past the Hour; the
fall at its instant; the seats; no write for a known `in`; past the Orrery alone); `tools/mutants/sd10b.json` (54, all
dead). RE-AIMED BY CONTENT, each still dead: `sd4b.json` (2), `sd6c.json`, `sd7a.json`, `sd7b.json`, `sd8a.json`,
`sd8b.json` (3), `sd9d.json` (3). PINS MOVED: the world host's (`test/sd4b_rift.test.js`, `test/sd5a_realm.test.js`,
`test/sd10_collapse.test.js`); the relay's (`test/sd3_relay.test.js` - the busy refusal; `test/sd8b_fight.test.js`,
`test/sd8c_remnant_page.test.js`, `test/sd9a_receipt.test.js` - their realms past the Concord);
`test/relayversion.test.js` (`world176` re-hashed in place).

### SD11 - AUDIT SD II (the arc audited again, eight lenses)

Mac, 2026-10-07: *"Let's do a deep comprehensive audit and ensure perfection"* - and, of what follows it, *"The detail
needs to exceed that of the oblivion gates. These are the pinnacle of the hardest content in the game, and the most
detail of anything we've developed thus far"*. Eight lenses over the arc as SD10b left it (`37854801`): the hosts'
lifecycle; the realm's scenes and how they render; the relay; the pure laws and the balance; the rewards and the
account; what the player reads, hears and sees; security, cheating and griefing; and these pages against the code, with
the tests' gaps found by probe mutants (66 aimed at laws no record covered; 31 lived). Each finding was reproduced on
the arc's own code - by the lens's own script, and every HIGH and MEDIUM again before it was fixed. What was real is
fixed and pinned, slice by slice below; what was not is said so. The relay stays `world176`, re-hashed in place
(undeployed).

#### SD11a - the realm's scenes and how they render

| | what was wrong | now |
|---|---|---|
| L2 F1 | THE ORRERY'S HANDS IN A MIRROR. Each stone's frame took lookAt's +x for its right, and the projection mirrors x (world/mat4.js, the one mirror on the lens): through the game's own camera a stone's third hour stood at nine o'clock, its hand ran anticlockwise, the handle that turns it forward stood on the left, and every sign and plaque read backwards - the puzzle's whole reading turned round | a stone's right is the eye's right as the screen shows it, `n x up` (the game's camRight); its faces wound out, the pictures' u left to right; the hand a proper turn (`handMatrix`); key `f` the right handle, *"Turn it forward"* (`world/sdHall.js` `stoneFrame`, `plaqueFrame`, `boxQuads`) |
| L2 F2 | THE STONES WALKED THROUGH. The stones and the plaques were drawn and never stood: a body walked through a slab, and a handle was turned from behind its stone | one geometry for the draw and the collider (`hallSolidTris` - slab, cap and handles; post and tablet), on the hall's floors; a press from behind refused, *"Stand before the stone's face."* (`beforeStone`) |
| L2 F3 | THE GLOWS IN THE WINDOWS' DAYLIGHT. An emission uploaded without `white` is multiplied by the arm's window colour - the dungeon arm's 'day', (0.175, 0.302, 0.349): every glow of the Hour (the realm's, the hall's, the Steps', the Echoes') burned at a sixth of its red and shifted blue | uploaded `white`, as the Rift's is (`standSdRealm`, `ensureSdHallArt`, `ensureSdStepsArt`, `ensureSdRemnantArt`) |
| L2 F4 | THE WALK FOUGHT THE DIAL. The walk's floor ran z 7-25 at y 0 and the dial's disc starts at z 24 at y 0: its last metre fought the dial for the screen | the walk's floor laid in strips from the Threshold's edge to the Orrery's, its sides, underside and kerbs on those edges (`walkNearZ`, `walkFarZ`); its collider and edge z 7-25 as before |
| L2 F5 | THE SIGN OVER THE DIAL. Each stone's sign stood 1.92-2.48 m, over the dial's twelfth hour (to 2.05), both a hair before the face: they fought | the sign between the dial and the cap (`SD_EMBLEM`, 2.09-2.59) |
| L2 F6 | FACES TURNED IN. The left kerb's top faced down and was culled; the walk's underside faced up; no lip had an inner side | the kerbs boxes of brass wound out on every side; the underside down; every lip's inner side |
| L2 F7 | THE AURORAE'S SEAM. Their curtain's noise read the raw azimuth, which leaps from pi to -pi behind the Threshold: a hard seam down the sky | read round a circle (`auroraCurtain`), as the Deadlands' ridges are |
| L2 F8 | BLOOD LEFT HANGING. A drip, a pool, a print or a thrown drop on a moving step was laid where the step stood, and hung in the air as the step moved on | no mark on a surface whose bucket the collider moves (`combat/bloodMarks.js` `onMover`: the Hour's steps, a deck) |
| L2 F9 | A FRAME OF THE HOUR MADE GARBAGE (AUDIT WB D10's law). Measured: the hall's targets 18 KB each ask (twice a frame), the Steps' ride 1.4 KB a frame, the Remnant's frame with no fight 0.7 KB, the End's 0.7 KB, the arm's Hour lines 8.7 KB, the blows with no fight 0.5 KB | nothing: the targets and the End's batches made once; scratches for the Steps' law; a still body keeps its matrix; squared distances; the lights into the realm's own arrays (`realmLightsWith`) and the sky's basis in place (`sdSkyBasisInto`); the blows' driver idle while none is in flight (`sdAnyInFlight`) |
| L2 F10 | POSED A FRAME LATE. The hall and the Remnant were framed in `drawFoes`, after the world pass had drawn them | posed before the frame's draws (`sdPose`), under the same window gate |
| L2 F11 | THE HIDDEN DRAWN. A step gone, the breath between gusts, a body outside time, the bridge before the Concord - each drawn somewhere hidden, with its shadow | a draw that says it is `hidden` is no draw, and casts no shadow (the world's dungeon arm) |
| L2 F12 | A POW OF A NEGATIVE. Wayrest's arches (`pow(2.0 * cell - 1.0, 2.0)`, negative over half of every span) and the Turning Hour's gleam: undefined in GLSL ES, NaN on D3D | squared; the gleam's base clamped |
| L2 F13 | THE TURNING HOUR'S DIAL TURNED FORWARD. Its angle fell, and the camera's one mirror turned it clockwise on screen - forward, where it turns BACK | its angle rises: anticlockwise as the eye sees it (`turningDialAngle`, the shader's own) |
| L2 F14 | LIGHT FROM NOWHERE. Each of the Hour's twenty lights was a pool of light 2.4 m over the rim with no lamp | a lamp at each: a brass post, a head of the hands' brass glow round the light (inside its shadow's near plane, so it shadows nothing of its own) and a cap; the posts on the collider (`realmLampFeet`, `realmLampTris`) |
| L2 F15 | THE CLOCK-FACE NARROW, A SHARD ACROSS IT. Laid out in raw azimuth and elevation, the clock-face stood 7% narrower than tall; and Daggerfall's spires crossed its ring twenty seconds in every twelve minutes | the face read on the sphere (`clockFaceAt` about `CLOCK_BASIS`); every shard hung wholly above its highest drawn point (`SD_SHARD_TOP`) |
| L2 F16 | THE FRAY NEVER FULL. The snap's word counts the fray none, so the ember arc went from all but full to empty and never showed the snap | full for a moment at the snap (`SD_FRAY_FULL_MS`, 1.5 s), then the word's own count |
| L2 F17 | AN OLD HALL'S WORD. The world host kept the realm's last word on the hall across visits: the next Hour's hall stood its stones where the last left them until its first word | forgotten as I leave the realm (`sdFightFrame`) |
| L2 F18 | THE BREATH ONLY HEARD. The Warp's breath pushed with nothing to see | 64 brass streaks over the Crumble, from its wind's rising through the gust, blowing its way (`breathSeen`, `buildBreathModel` - one draw, hidden between) |
| L4 F1 | THE VOID'S WRONG CHECKPOINT. The cast-back read the span under the body as it fell past y -30: a run back off the first Drift step fell under A's near edge (`spanAt` -1) and was never cast back; a run off Drift step 6 crossed past B's edge and was cast on to B | the span the body last stood in (`ride`'s `lastSpan` - a step's own span, a checkpoint's island its own; none, A) |

**Found, not changed** (the gate's own code - for Mac): the Burning Court's art goes up without `white` as the Hour's did
(`scenes/worldModes.js` `standCourt`), so the court's lava, runes and membrane burn in the dungeon arm's 'day' colour;
outdoors the gate's glows follow the clock's window style, which its art means ("the veins burn by night"). Whether the
court's fire should be its own colour is the gate's call.

Pins: `test/sd11a_scenes.test.js` (17 - the hall through the game's camera; the stones and plaques stand; the glows
`white`; the walk; the sign; every face out; the aurorae whole round; no pow of a negative; the clock-face and the shards
over its whole period; no blood on a mover; a frame makes nothing, measured in a child against a control (the arc's own
code - the dungeon arm's general lines and the renderer's own copies are any dungeon's); the same lights and sky made
in place; posed before the world pass and a hidden draw no draw; a lamp under every light; the hall's word
forgotten; the breath seen; the void's span); `tools/mutants/sd11a.json` (68, all dead - three dropped that cannot die:
TurboFan's escape analysis takes the allocations they put back). RE-AIMED BY CONTENT, each still dead: `blood1.json` (2),
`sd4b.json`, `sd5a.json`, `sd6c.json` (3), `sd7a.json` (5), `sd7b.json` (4), `sd8c.json` (3), `sd9c.json` (2), `sd9e.json`
- four of them now the other way, the law itself turned (`SD6C-the-right-the-left`, `SD9C-the-dial-forward-in-law`,
`SD9C-the-dial-forward`, `SD7B-the-void-before-the-first-step`). PINS MOVED: `test/sd6c_hall.test.js` (the layout on
camRight; the floors with the solids; the full fray; the bridge hidden), `test/sd7b_steps.test.js` (the void's span; the
breath's draw), `test/sd5a_realm.test.js` (one light object; six sub-meshes), `test/sd8c_remnant_page.test.js` (the
collider's posts), `test/sd9c_turning.test.js` (through the game's camera), `test/sd9e_spoils.test.js` (the spoils'
lights through `realmLightsWith`), and the dungeon arm's draw loop in `test/perf5.test.js`, `test/disc15.test.js`,
`test/wb6a_deadlands.test.js` and `test/crashreport.test.js` (a hidden draw skipped).

#### SD11b - the relay

| | what was wrong | now |
|---|---|---|
| L3 F1 | TWO `in`s, TWO FIGHTS. Two fighters' `in`s that awaited the hub together each read the fight before the await and each made a fresh one, numbered alike; the last replaced the first's fighter, whose page fought on believing itself in - its blows junk until its socket was closed for them | the fight read again after the last await and decided with none between (`_sdFightFrame`); a blow whose fight was replaced while it awaited is dropped, never junk |
| L3 F2, L7 M5 | THE HUB ASKED EVERY FRAME. Each frame, hello and turn asked the hub on its own while the realm's answer was stale - a full realm's 4,096 asks a second into the one object every tab holds, the worst when it struggled - and a miss threw a good record away: a fighter was refused busy for a record held a moment before | one ask in flight, every frame meanwhile waiting on it; a miss not asked again for 2 s (`SD_LIVE_MISS_MS`); the last answer standing through misses five minutes (`SD_LIVE_KEEP_MS` - its phases are its own instants); busy only for a realm that never had one |
| L3 F3, L7 M3 | THE SEATS WERE STILL FOR LIFE. A lost or stale fight's fighters kept their seats; and a socket idling in the realm holds its seat for as long as it stays - 256 guest sockets kept the Hour full for an hour | only a LIVING fight's fighters hold seats; guests hold at most `SD_GUEST_SEATS` (64) of the 256 (`_sdAdmit`; the realm's list keeps its guests, `gu`) |
| L3 F4 | A KILL IN THE LAST SECONDS WAS "UNBROKEN". The hub said a found Hollow's fade at its `until`, before a kill landed in the Hour's last seconds was told (the realm retries every 5 s); and a fall heard after the fade was refused | the fade said `SD_FADE_GRACE_MS` (15 s) past `until` (`net/sdLaw.js` `sdDue` - a found Hollow's alone; an unfound one has no realm), and a fall told after it, landed before `until`, taken over it at its own instant |
| L3 F5, F8 | A HELLO WOKE NOTHING. A realm that had emptied slept, its living fight frozen until someone's `in` or blow; a stale fight was told to a newcomer as if it lived; an earner whose page reloaded inside the hub's hold heard its fallen fight's receipt nowhere | a hello arms a living fight's beat, finds a stale one lost (the next `in` the fresh one), and hands a fallen one's earner its receipt (`_sdHelloFight`) |
| L3 F6 | THE FALL TOLD TWICE. The fall's own tell and the beat's retry raced, and the hub was told twice (its receipts handed twice) | one tell in flight (`_sdTellFellOnce`) |
| L3 F7, L5 F2 | A SLOT COULD BE USED TWICE. A record that would not read back (a law's bound moved; a region past the count) started the director from slot 0 again, and every realm, receipt, spent mark and claim the old numbers held answered the new Hollows - the old fall, *claimed*, no spoils | the hub keeps the highest slot it ever raised with its record, in one write (`sdslot`, wire.js `SD_SLOT_KEY`), and a first beat starts from it |
| L5 F3 | A HELD RECEIPT WAITED FOR A LATER HELLO. An earner who stood in the realm at the kill is held from the hub's hand two minutes (the floor spends it) - and nothing handed it on: a page that crashed at the kill and came back inside the hold heard of its spoils hours later | the hub keeps the held (`sdheld`, `SD_HELD_KEY`), arms its alarm for their hold's end, and hands each still unspent to its account's newest socket (`_sdHeldBeat`) |
| L7 M1 | A STRANGER SHUT THE REALM'S DOOR. The realm spent its hello gate before the token was read: forty junk tokens a second kept a fighter whose socket blinked out of her own fight (0 of 60 tries admitted), and every newcomer with her | the gate after the token, by account (`_battleHelloGate` - a battle's and a floor's law): an account the realm admitted before waits on itself alone |
| L7 M2 | A CLAIMED LEVEL, A PARKED SHARE. The `in`'s level was the page's claim though the realm's token signs the character's (`cl`): a claim of 60 from level 5 brought a 34,125 share, a claim of 1 from level 60 bought the feat's whole roll for 63 points dealt; and a fighter counted present anywhere in the realm kept its share in the Remnant from the Threshold - six such made the Hour unwinnable for eight | the level the token's (`cl`, attached at a realm's hello as at a cell's; a claim stands only from a service that signs none); a fighter seen while its pose stands in the arena (`net/sdRemnant.js` `stepRemnant`), its share out 30 s after it leaves |
| L7 M4 | A FIND TOLD EVERY FRAME. The cell told the hub again for a slot it had told and the hub had answered: one account in forty cells made forty hub requests a second | a slot told once, and a find for any slot but the one the hub's last answer named not told while that answer is fresh (`SD_FIND_KNOWN_MS`, ten minutes - the rite's AUDIT WB12d R4 law: a word that moves nothing tells nothing) |
| L7 L1 | A BLOW JUDGED AT ITS ARRIVAL. A blow waited on the hub, then spent the purse at the instant it arrived: an earlier blow's answer coming after a later one's moved the purse's clock backwards and refilled the same seconds twice (1,755 dealt over 5.25 s where the law allows 1,024) | a blow, an `in` and a turn judged at the instant they are judged |
| L7 L2 | `spent` FOR ANY SLOT. A `spent` naming a slot the hub had not raised was a storage write - one a frame for a rising slot | nothing past the hub's own slot |
| L7 H2 | ONE HAND HELD THE ORRERY. The fray is the hall's one thread, and any account could spend it: a guest turning whichever stone had settled the long way held the Concord off in every one of 200 slots against a perfect team of six, and its snaps lashed the hall to death about every thirty seconds | THE STONES' RIGHTS (section 8; `net/sdBrain.js` `orreryMayTurn`): every turn moves the road by exactly one, and a turner that has lengthened it `SD_TURN_LONG_MAX` (6) times since the last snap turns no more while another has turned in the last minute - a lone learner never held, a solver who knows the way never; every guest ONE turner; the refused told so (`w`, at most every 4 s); the snap lashes only those it names (`ls` - who turned and brought it no nearer: a mender stands) |

**The relay's untested arms** (the probe mutants that lived): the Echoes' and the Hearts' blows through the realm (G1),
the fall's tell retried until the hub hears it (G4), the dead in the arena (G8), the director's retry and its re-read
after the census (G9), the `in` refused in words, over and full (G11) - each pinned now.

**Said so, not changed:**
- L7 H1: A SCRIPT ALONE IN AN HOUR (section 4). A modified client with a guest's token can forge the find at the rise,
  solve the Orrery from the public slot, step over the Steps, refuse the Hour's blows and fell the Remnant in about three
  minutes - the fight's own numbers (one share; three times the reference), the gate's law - and its fall collapses the
  Hollow for everyone. Every fight in the port trusts a page with its body; what this audit closed is everything such a
  script would need a second account for. Whether a Hollow should need company to collapse - two registered accounts
  with a part in its fight, say - changes who can win it alone, and is put to Mac.
- L7 L3: the census can be steered by registered accounts helloing into one region's channel at the public `next` -
  section 3's stated limit.
- A determined group of REGISTERED accounts can still spend the Orrery's thread, each its own six - moderation's: every
  turn carries its turner.

Pins: `test/sd11b_relay.test.js` (22 - two `in`s, one fight, one ask; a blow whose fight was replaced; a missed answer;
a lost fight seats nobody; the guests' sixty-four; a kill told late; a hello wakes its fight; the fall told once and
until heard; a slot never used twice; a held receipt handed on; the realm's door; the level and the share, and their
law; a find told once; no spent past the hub's slot; the stones' rights, their law and the realm's; the Echoes' and the
Hearts' blows; the dead and the `in` refused; the director's retry and re-read; the relay by source; the page lashes whom
the realm names); `tools/mutants/sd11b.json` (55, all dead). RE-AIMED BY CONTENT, each still dead: `sd3.json` (2),
`sd6b.json` (3), `sd6c.json` (2), `sd8b.json` (2), `sd8c.json`, `sd10b.json` (7), `audit1003b.json`,
`audit_seats_relay.json`, `serpent1_audit.json`. PINS MOVED: `test/sd3_relay.test.js` (the realm's list keeps its guests;
the hello's gate after the token; a find told once the hub's word has grown old), `test/sd6b_hall.test.js` (the snap
names whom it lashes; `w`), `test/sd6c_hall.test.js` (the lash on whom the snap names), `test/sd10b_audit.test.js` (a
miss's back-off), `test/relayversion.test.js` (`world176` re-hashed in place).

#### SD11c - the hosts, the page and the rewards

| | what was wrong | now |
|---|---|---|
| L1 F1 | THE CAST-OUT LEFT THE WINDOW UP. The Hollow's end casts out through the dungeon's own way out (`unstuck`, drained at the modal frame's safe point whatever window holds the slot) - and that way out never popped the slot's window: a rest left `isResting` up for good (no fatigue drain; held enchantments eating their items at the rest's rate), an open pack or pause menu painted over the street with its hooks on a context destroyed | `exitDungeonNow` pops the context's own slot before it destroys the context - forceExitToExterior's OnPop, one law for both doors out (`scenes/worldModes.js`) |
| L1 F2 | THE RISEN STOOD IN AN ENDED HOLLOW. A player dead inside at the end is the death's - and the host latched "cast out" on the refused word: a Resurrect raising them where they lay left them standing in an ended Hollow or Hour that no frame would ever cast them out of | the world host's `castOut` answers whether it acted (false for the dead, and for a way out the mode machine would not take); the host latches the slot only once it acted, and asks again each frame - once a frame (`scenes/sdHost.js`) |
| L1 F3 | AN END THAT OVERTOOK A STEP. A step under the veil - into the Hour, or back into its Hollow, a whole dungeon's build - could finish after the end had taken the Hollow down, and land the player in a Hollow or an Hour no frame would ever cast them out of; the Rift's word was asked before the walk to the Hollow's pixel alone | THE END JUDGED WHERE I STAND (`standing`, the Hollow or Hour the dungeon I stand in is): one standing in a Hollow or Hour the hub's record no longer stands is cast out on the frame they land, once - judged once the hub has said its record; the Rift's word asked again after the walk (`sdEnterRealm`) |
| L1 F4, L5 C2 | "NO SPOILS" AFTER THE HUB'S HAND. A receipt for the Hour I stood in went straight into the pack when the hub's link handed it (my realm's socket blinking at the kill) - and the floor then said *"No spoils"* | kept for the throw whichever link handed it (`sdSpoilsReceipt`); anywhere else into the pack, once |
| L1 F8 | A MARK IN A HOLLOW GONE ENTERED ITS NEIGHBOUR. A save's or a Mark's dungeon whose pixel holds no dungeon of its own now (a Hollow taken down, its pixel bare) entered the first dungeon door in the stream - the nearest dungeon, at the Hollow's own position | never a neighbour's door: such a pixel enters nothing, and each caller's own "all else fails" arm wakes them (`systems/save.js` `dungeonStartDoorFor` - DFU's StartDungeonInterior builds the player's own location or fails) |
| L1 F9, L6 F4 | OUT OF THE HOUR WITH NO VEIL; A DUNGEON'S WAKING. Every way out of the Hour is taken under its veil but the end's cast-out; and a death in the Hour woke with a plain dungeon's words | the cast-out flashes the veil out of the Hour; a death there wakes under it with the Hour's own, *"The Shattered Hour casts you out. You wake before the Hollow's door."* (`SD_REALM_TEXT.died`, a respawn kind of its own - `systems/deathRespawn.js` `hour`; the respawn reads the Hour before it leaves it) |
| L1 F5, L6 F12 | "SAVE" WHERE NO SAVE IS. An older game refused at the arena was told to save - in the one place that refuses a save | *"Your game is older than this Hour. Leave it, then reload or update the app to fight."* |
| L1 | A HOLLOW KNOWN WITHOUT ITS SITE. The step through read the Hollow's site unguarded - a memo of another slot carries none (latent: no path builds one today) | no site, no step |
| L5 F1 | THE INSPECT CARD SAID NO HOURS. The account service's one answer carries the duels, the gates closed, the towns defended, the serpents slain and the Hours broken - the page's read of it kept the first two, and no host laid the other three: SD9b's *"Hours broken"* on the Inspect card was never said | each count kept (a malformed one dropped - `net/duelRecord.js`), and the world host lays all three off the same record |
| L5 F4 | A SPENT WORD SAID ONCE. A receipt's spoils taken are said to the hub, which then hands no other device that receipt - and a word that could not go (the hub's link between sockets, its bucket spent) was said again only if the hub handed this same device the receipt: past the hold another device or browser of the account was handed it, and its empty store granted the same spoils | the word owed: kept on the device under the pool's own key with its account and said again every `SPOILS_SPENT_RESEND_MS` (5 s) while the hub's link is open, until it goes - on its own account's socket alone (AUDIT WBX2 M6's law: said on another's, the hub forgets a receipt that account still holds); the gate's pool and the Hour's both (`scenes/spoilsPool.js` `resendSpent`) |
| L5 F5 | THE HOUR'S SPOILS ON THE DEVICE ALONE. The Hour refuses every save, so what its floor gave stood on the device alone until the next checkpoint, minutes on | a checkpoint asked the frame I leave the Hour (`saveSoon`) |
| L5 F6 | EIGHT RECEIPTS FOR A WHOLE DEVICE. The claims book held eight - "a week holds a few": a guest that broke nine Hours inside its week lost the first before it registered, and one account's pushed another's out on a shared device | `SD_CLAIMS_MAX` (96) an account - a week of Hollows at the fastest - its own oldest out first, never another's; `SD_CLAIMS_ALL_MAX` (256) for the device |
| L5 F7 | THE VIGIL ON A DEATH TURNED ASIDE. The Ghost-King's Vigil healed on top of a killing blow a death save had turned aside (The Hour Turns, Unbroken, Divine Grace) and spent its minute on a death that never happened | not on a saved blow (`saved`, AUDIT 625 P1's law for Shed Skin); Divine Grace's own heal stays |
| L6 F14 | THE FLOOR'S LAST WORDS OVER THE WAY HOME'S. What the floor still held, gathered as I leave, was said over the screen - a frame after the way home's line or the cast-out's, in their place | said in the chat |
| L6 F17 | THE RIFT FORGOT AT A RELOAD. Who had gone through the Hour was this session's memory: after a reload the Rift said *"The Hour has closed."* to a fighter its realm would have admitted | kept on the device, the last `SD_ENTERED_MAX` (8) slots (`SD_ENTERED_KEY`); a store that refuses keeps it in the session |
| L6 F18 | BACK ON THE RETURN'S FOOT. One back from the Hour was stood on the Return's own foot: one step off it and back carried them straight to the way in | stood `SD_LANDING_PAST_M` (1.5 m) past the Return, along the line from the Rift through it - else the first bearing that leads away from the Rift, else the Return's foot (`world/sdDungeon.js` `sdLandingPlace`) |

**The page's untested arms** (the probe mutants that lived, and the gaps the lens named): the page folds the whole state
the relay sends every five seconds, the Hearts and the stun with it (G2 - SD8c's shadow skipped every `st`; folded now,
the page stays the law's at every beat, through the Hearts, the stun and the Hour's end: nothing was wrong, and nothing
can go wrong unseen); the world host's fight seams run from their own text (G3); the Echoes' and the Hearts' belief - a
pose in the arena, a melee blow in reach (G5); the one hand every body shares (G6 - the fifth blow a second nothing on
each, one blow's number counted once across the bodies it meets); a fighter away taking its share out and back, the
Echoes rescaled with it (G7); the Hour's End in the Dragon Break, both Echoes stopped on the law and the page (G10); a
blow never thrice running (G12); a fallen Echo striking nothing, the Silver named Silver, a world with no Hollow for a
slot, and the relay's newest socket, another slot's fight and list, a hub that throws and the census's bound (G13).

**Said so, not changed:**
- L5 C1: a claim whose answer is lost (the service counted it; the page heard nothing) is let go at the next offer as
  claimed - its count's line and its titles' lines are never said for it. The count is right at the next read of the
  account; the gate's book is the same.
- A death in the Hour's last seconds of collapse wakes at the Hollow's pixel after the Hollow has gone; its words still
  say "before the Hollow's door".

Pins: `test/sd11c_page.test.js` (17 - the cast-out closes the window; cast out once it acts; the end judged where I
stand; the step asks again and the Rift remembers; the way back past the Return; a Mark in a Hollow gone; my Hour's
receipt waits; the Inspect card's four; the spent word owed; the claims book's week; no Vigil on a saved blow; the world
host's fight from its text; the Hour's death and the floor's last words; the whole state; the End stops the Echoes; the
smaller gaps; an older Hour's words), `test/sd11c_law.test.js` (4 - the Echoes' and Hearts' belief; one hand; the share
away and back; never thrice running), `test/sd11b_relay.test.js` (+1 - the relay's smaller arms);
`tools/mutants/sd11c.json` (77, all dead). RE-AIMED BY CONTENT, each still dead: `auditwb_spoils.json`, `auditwbx2.json`,
`raid4b.json`, `sd2d.json` (4), `sd9b.json`, `sd9e.json` (3), `wb5b.json`. PINS MOVED: `test/castle1.test.js`
(a pixel with no dungeon enters nothing), `test/sd2d_castout.test.js` (the cast-out answers, under the Hour's veil),
`test/sd4b_rift.test.js` and `test/sd5a_realm.test.js` (the landing past the Return; the Hour's waking words),
`test/sd9e_spoils.test.js` (the spent word answered; the receipt kept whichever link; a checkpoint as I leave),
`test/sd10b_audit.test.js` (the same), `test/wb5b_gate_claim.test.js` (the card's four), `test/world1.test.js` (the exit's
window, its slot popped first - still inside the function).

#### SD11d - what the player reads, hears and sees

| | what was wrong | now |
|---|---|---|
| L6 F1 | THE PULSE TOOK THE BAR. The bar's one callout went to the Hour's own blow first: in 40 simulated fights 123 of 320 Resets lost their countdown for 2.2 s, and 92 of 1,373 Stomps were never named | THE ONE CALLOUT BY WHAT CAN BE DONE ABOUT IT: the Reset's Hearts and seconds, then a blow still winding up (the Remnant's, an Echo's), the Hour's own, the stun, a blow landed (`ui/sdRemnantBar.js`) |
| L6 F2, F3, F13 | LINES OVER LINES. DFU's label holds one line and each write replaced the last: at the kill the fall, the collapse's first readout and the spoils took it within 1.2 s (the fall stood 144 ms); the second Echo's fall stood 250 ms under the Last Moment's; every line stood 1.5 s whatever its length (the Dragon Break's order needs 3.1) | THE HOUR'S VOICE (`scenes/sdVoice.js`): every line the arc says over the screen stands for its length (WB13e's `courtSaySeconds`) and is never cut by a less urgent one - the fight's turns, then the floor's words, then the readouts, each rank in the order said; a line that waited past its life is let go; a thread (the Hearts) says itself anew in its own place; what waits is let go as the Hour is left (AUDIT SD IV, SD26 T2: and a line a more urgent one cuts goes back to the head of its rank, its wait begun anew, unless under `SD_VOICE_READ_MS` of it was left - the way home's rising, `SD_REM_SINK_MS` after the fall, cut the kill's first readout 0.5 s into its 3.7, and the no-spoils note the frame it was said; SD26 T3: and under a window it stands still with DFU's label, which is ticked only with none up - nothing written, the line standing and the turns' and notes' waits held, a readout let go as its moment passes; it ran on, and the player met only the last line, a count stale) |
| L6 F5 | THE FADE UNCOUNTED. A Hollow unbeaten closes at its `until` and casts out whoever is in it, mid-blow - with no countdown anywhere inside | its readouts at five minutes, one, thirty seconds and ten, once each, to whoever stands in it or its Hour (`sdFadeDue`, `sdFadeReadout`) |
| L6 F6 | THE PAIR'S WINDOW UNCLOCKED. The Dragon Break's 15 s showed "Gold fallen" and no time | *"Gold rises in 12s"* on the callout and the chip, the chip pulsing its last five seconds (`hostNear`) |
| L6 F7 | THE HEARTS IN SILENCE. They rose, took blows and broke without a sound or a word, and the call gave no count | the call counts them (*"The Reset! Break all 5 Hearts!"*); the gate's crystals' cues - rise (heard live alone), hit, shatter and ring - each where its Heart stands, the last too, broken in the stun's own word; each broken said by whom and how many stand (*"Ann breaks a Heart. 2 remain."*), the last its own words, then *"The Reset breaks! Strike now!"* |
| L6 F8 | OBLIVION'S FIRE. Every step into and out of the Hour was Dagon's fire and its roar - Mac, of the Hour: *"not oblivion, something different"* | the veil takes a look (`ui/gateVeil.js` `cover(look)`, `flash(look)`; `render/gateVeil.js` `uTheme`): the Hour's in brass with the Mantella's green eye, closing on the Orrery's toll over the deep wind and opening on a gear's clunk and the Concord's chime; the gate's fire unchanged |
| L6 F10 | "STRIKE THE ECHOES" WITH NONE THERE. For the Last Moment's 2.5 s return the bar said "Outside time" | *"It returns - 3s"* |
| L6 F11 | "CRYSTALS" IN DAGON'S RED. The Remnant's damage chart named its Hearts' column "Crystals", in the court's fire | "Hearts", in the Hour's brass (`damageChartModel`'s `crystals` and `theme`) |
| L6 F15 | THE FIGHT HEARD ON THE STEPS. The fight's lines reached everyone in the Hour - the Dragon Break and the End to a body mid-jump on the Crumble | to whoever stands where the bar stands (`sdNearArena`); its fall to the whole Hour |
| L6 F20 | "IN THE BRASS HOLLOW" CAPITAL. Every Hollow's name begins "The", and kept its capital mid-sentence and on its plaque | small inside a line (`net/sdLaw.js` `sdNameIn`; the plaque's *"To the Brass Hollow"*) |
| L6 F21 | WB13b'S WORDS BROKEN. Dash asides, comment and shouting: *"The Remnant steps outside time - strike down the GOLD and SILVER Echoes together."*, *"The Reset gathers - break its Hearts!"*, *"The Hour is breaking - it collapses in 3:00. The way home stands where the Remnant fell."* (said four seconds before it rose) | the event, then what to do: *"The Dragon Break! Strike down the Gold and Silver Echoes together."*, *"The Reset! Break all 5 Hearts!"*, *"The Hour collapses in 3:00. The way home opens where the Remnant fell."*, *"The Concord! A bridge of light opens."* - a law over every line the arc says |
| L6 F23 | THE END ON THE RESET'S PITCH. Their wind-ups on one clip stood 3.2 semitones apart (WB13d asks four) | the End at 0.236 |
| L6 | AN UNFOUND HOLLOW'S FADE SAID. Its rise is said to nobody, and its fade was said to everyone | a found Hollow's fade alone |
| L2 (the gate's) | A POW OF A NEGATIVE in the shaders the Hour draws through - the veil's throat, the telegraph's lip and wave | squared |

L6 F24 (the fighters' count) was SD11b's present share. L6 F9, F16 and the Rift plaque's count (F5) are the scenes'
(SD11f); F19 and F22 are the words' and the docs'.

Pins: `test/sd11d_words.test.js` (15 - the voice; a thread; the kill read whole; the hosts through the voice, from
their text; the bar's one callout; the Echo's clock and the return; the Hearts heard and said; five Hearts in a second;
the fade counted; near the arena, from the host's text; the Hour's own veil; the chart in brass; a Hollow's name small;
WB13b's words over the arc; the End's pitch and no pow); `tools/mutants/sd11d.json` (71). RE-AIMED BY CONTENT:
`sd10.json` (4), `sd11b.json`, `sd11c.json` (6), `sd2b.json`, `sd2d.json`, `sd4b.json`, `sd5a.json` (3), `sd8c.json`,
`sd8d.json`, `wb6c.json`. PINS MOVED: `test/sd1_sdlaw.test.js` (the names), `test/sd2b_world.test.js` (a found Hollow's
fade), `test/sd2d_castout.test.js` (the cast-out under the brass), `test/sd4b_rift.test.js` (the Rift's word through the
voice), `test/sd5a_realm.test.js` (the Hour's lines and veil), `test/sd6c_hall.test.js` (the hall's say),
`test/sd7b_steps.test.js`, `test/sd8c_remnant_page.test.js` (the bar's order, the Echo's clock, the fight's lines near
the arena), `test/sd8d_remnant_blows.test.js` (the call's count, the fall to all), `test/sd10_collapse.test.js` (the
readouts' words), `test/sd10b_audit.test.js`, `test/sd11b_relay.test.js`, `test/sd11c_page.test.js` (the voice in their
rigs), `test/tier1_dungeontiers.test.js` (the plaque's article), `test/wb6c_gate_veil.test.js` (the step's look),
`test/relayversion.test.js` (`world176` re-hashed in place - `net/sdLaw.js` is in the bundle).

#### SD11e - the laws

| | what was wrong | now |
|---|---|---|
| L4 F2 | THE PAIRED HAND A PINCER. Each Echo aims at its own chosen - threat first, so often both at one fighter, and always at a solo - and gold always turned one way and silver the other: for a fighter standing beyond both (the arena's south end, where the Steps deliver everyone) the two beams closed on it from either side, and staying ahead of one ran into the other. The real law's first pair Hand at a solo there left no run and no pillar to escape at any build; an escape search over 309 geometries (six Echo pairs, the real one among them, by a 6 m grid of fighters; runs of one and two waypoints after a 0.25 s reaction, both beams judged every 1/60 s, each caster's shade its own) found none in 5 at the default build, 9 at a modest one (Speed 40, Running 20) and 30 at the weakest (Speed 10, Running 0) | BOTH AT ONE FIGHTER, THE TWO BEAMS CROSS IT THE SAME WAY: silver turns gold's way when the fighter stands beyond the two (the angle at it under square), the other way when it stands between (`net/sdRemnant.js` `pairWay`, `pairHand`) - no run now in 0, 1 and 3 of the 309. Both turned one way, the report's fix as written, is the same pincer for a fighter between them (0, 1 and 8); silver 2 s late scores 0, 0 and 1, but it splits the pair's one moment (the wind-up the page draws, the bar's callout, each Echo holding for the other) - the Hand stays from both at once |
| L4 F3 | THE END'S WIND-UP REFUSED. The End's word, 2 s before it lands, set `ended`, and every blow asked `ended`: a finishing blow 1.5 s before the End landed nothing - a race to the wire lost its last two seconds | the bodies stop at the word; a blow is refused by the clock, `now >= endsAt` (`over` - the gate's AUDIT WBX R5), and nobody new comes in from the word (`closed`); the page believes the same (`net/sdFightLink.js` `sdHourOver`: counted in, a blow goes out through the wind-up - `joined`, `scenes/sdRemnant.js` `remnantOpenAt`, `target`), and its bar counts the End down to its moment (`ui/sdRemnantBar.js` - it said *"The Hour has ended"* at the word) |
| L4 F4 | A BLOW PAST THE END. The three refusals knew the End only by the beat's word, and the relay applies a blow with no beat before it: a beat stalled 2.1 s short of the End and a blow 3 s past it felled the Remnant after its Hour, its receipts minted | the time guard in all three - the Remnant's, an Echo's, a Heart's (`over`, the gate's AUDIT WBX R6) |
| L4 F5 | THE DISC AND THE RING BOTH. The ring's band began 0.6 m inside the disc: a grounded body 6.4-7 m out at the landing took both (80% and 22) - the near-miss at the rim the heaviest hit of all | the ring rolls out from the disc's rim; what the disc strikes it does not (`ringPassed`) |
| L4 F6 | A STALE SPAN JUDGED. Only a landing was refused late; the ring and the beam took whatever span the page judged from its last frame drawn - a tab hidden across a Stomp's landing and shown 2.5 s on was struck by its ring, one 4.9 s into a Hand by its beam | a rolling part over a span that ends SD_STRIKE_LATE_MS past it is done, with no hit (`net/sdStrike.js` `sdBlowVerdict`'s `stale` - the gate's rolling charge's law) |
| L4 F7 | THE RING UNJUMPABLE RUNNING OUT WITH IT. Its 1.2 m band was judged whole, on any grounded frame inside it: a body running out with it stayed under it longer than a jump stays aloft (0.43 s) - from 7.5 m out no jump cleared it at 7.1-10.2 m/s, the default build (7.59) to Speed 80, Running 60 | judged ONCE, the frame its front's centre crosses me, on that frame's ground - where I stood the frame before kept (`ro`), so one running in through it is never past its centre unjudged (`stompFrontAt`, `ringPassed`): a jump clears it at every speed, at 60 frames a second and 30 |
| L4 F8 | A HEART IN ITS BODY. The Hearts kept from each other and the pillars, never from the Remnant: one rose inside its 2.2 m body in 4.1% of Resets, overlapping it in 8% | none within `SD_REM.r + SD_HEART.r + 1` of it (none in 1,600 Resets of eight); a floor too crowded for the dice lays its ring at the ring's middle, turned so the Remnant stands between two (`raiseHearts`) |
| L4 F9 | THE RESET A TRAVEL RACE (a design call: section 10 called it a damage race). The Hearts rose 8-22 m out however few: hearts.mjs's method (2,000 real Resets a cell, the Remnant anywhere in the 24 m square about the centre, each fighter beside it, the shortest order at reference damage) - one fighter in melee could not break its three in the 7.5 s they stand in 72% of Resets at the default build, 82% at a modest one; two in 27% and 41%; on a second draw at the weakest build, 93%, 76% and (three) 58%. Each lost is 70% of everyone's health and 8% healed | THE RING AS WIDE AS THEIR COUNT: 6 m out, 2 m more for each Heart past the first (`heartRingFor`; `SD_HEART.ring` 6-20, `per` 2 - 6-10 m for three, 6-20 m for eight): one fighter 0% at the default build and 0.7% at a modest one, two 0% and 0%; at the weakest, 19%, 3% and 9%. A ranged party never lost one |
| L4 F10 | THE HAND'S WAY UNSAID. Its wind-up drew a symmetric half-circle, and the Remnant's way is a coin's (`sw` on the wire all along): a straight run the wrong way met it in 74 of 651 geometries at the weakest build; known from the word, one straight run escaped every one | the beam stands at the edge its sweep begins from as it gathers - a `lane` beside the half-circle (`scenes/sdRemnantBlows.js` `sdTelegraphShapes`); the gate's telegraph pass (`render/gateTelegraph.js`) unchanged |
| L4 C1 | THE HAND CHOSEN PAST ITS BEAM. Its range 40 m past its body, its beam 34 m from its chest: a chosen 34-42 m off was swept by a beam that never reached it | its range the beam's length less its body (`SD_HAND_LEN`) |
| L4 C2 | THE STEPS IN THE ARENA. The gate's POSE_SLACK (3 m) reached the last Crumble step's last 0.6 m (28.4-29 m from the centre): the Pulse, the Reset and the End struck there, the realm counted the body present, and its `in` was taken - SD8d says nobody on the Steps | the arena's own slack (`SD_ARENA_SLACK`, 1.5 m - a pose's age at a run; the arena's edge is the motor's clamp, so no body on it stands past its rim): every point of every Crumble step, and a body hanging its capsule off the last, is off the arena - for the law, the page's blows and the relay's `in` |
| L4 C4, C5, C6 | `sdSalt`'s comment kept a slot's salt its own "until the 2048th Hollow after it" (the period is 2047); the mirror riddle, *"Read the Blades from twelve backwards and you read Daggerfall."*, reads 13 - h as well as the law's 12 - h; `sdNameOf` would expand a `$&` in a city's name | the comment says 2047th; *"The Blades stands as far before twelve as Daggerfall stands past it."* (`net/sdBrain.js` `sdRiddleText`); a replacer |
| docs | `sdFell`'s comment said `n` is "how many earned it"; `SD_GREAT_CITIES` the Bay's "largest" cities | `n` is every seat its fight took - the realm's `fell.n`, the gone and the cast-out with the rest (section 2's table says so already); the Bay's first eight cities by the hubs' own claim (`systems/regionHubs.js` `hubClaim` - one named for its region outranks a larger) |

L4 F1 and F1b were SD11a's, and so was C3 (`spanAt`'s comment says near edges). L4 C7 - `orreryStep` on a state with no
`f` - is unreachable: the relay's `_sdHallOf` holds `f` to a whole 0-48.

**Said so, not changed:**
- The escape search still finds no run for 1 of the 309 at a modest build - a fighter at the rim with one beam to
  reach it, the other 36 m off - and 3 at the weakest, which the old law failed in 30: the weakest build's own reach.
- In melee alone, the weakest build (Speed 10, Running 0) still loses one Reset in five: a party's reach is its own.

Pins: `test/sd11e_laws.test.js` (12 - the paired Hand by the escape search, beyond and between; the End's wind-up, the
law's and the page's; nothing past the End; the disc and the ring; the ring jumped running out and run in through once;
no stale span; no Heart in its body; the ring by count, and a lone melee fighter's every Reset made; the Hand's way as
it gathers; its range; nobody on the Steps; the words and the comments); `tools/mutants/sd11e.json` (37, all dead).
RE-AIMED BY CONTENT, each still dead: `sd1.json`, `sd11b.json`, `sd11c.json`, `sd8a.json` (4), `sd8b.json`, `sd8c.json`
(3), `sd8d.json` (3) - one now the other way, the law itself turned (`SD8A-the-ring-no-width`: the ring has no width to
lose, and its mutant puts the band back); and every other record on the files this slice touched (243) re-judged, all
still dead. PINS MOVED: `test/sd6a_orrery.test.js` (the mirror riddle's words), `test/sd8a_remnant.test.js` (the pair's
ways by `pairWay`; the ring's front's centre stops at 22 m), `test/sd8b_fight.test.js` (the relay's import of the arena's
slack), `test/sd8d_remnant_blows.test.js` (the End at the rim, within the arena's slack), `test/relayversion.test.js`
(`world176` re-hashed in place - `net/sdRemnant.js`, `net/sdLaw.js`, `net/sdBrain.js` and the relay's `in` are in the
bundle).

#### SD11f - the way home, the Rift's count, the wheel and the docs

| | what was wrong | now |
|---|---|---|
| L6 F9 | THE WAY HOME WALKED INTO (the gate's SS3, back again). It stands where the Remnant fell, where its spoils land, and a step after them carried a player out of the Hour mid-loot | pressed alone (`scenes/sdEnd.js` - the Hollow's own Return, at the way in, is walked into as before) |
| L6 F16 | THE WAY HOME ROSE UNSEEN AND UNSAID. It stood up whole, without a sound or a word, where the gate's portal rises and is said | it rises out of the floor over `SD_HOME_RISE_MS` (the gate's portal's), the Rift's bell tolled once where it rises, a fourth higher and heard across the arena (`systems/sdRiftSound.js` `tollRiftBell`), and the Hour says *"The way home stands open."* - said and tolled as it rises, never to a page that comes later (`scenes/world.js` `sdHomeAge`, handed through the mode machine to the dungeon host's `standReturn`) |
| L6 F5 | THE FADE UNCOUNTED AT THE DOOR. The Rift admitted a newcomer to the last second of a Hollow unbeaten, and its plaque said nothing of the time | its plaque's second row counts its Hour (`world/sdDungeon.js` `sdRiftCount`): *Fades in 46h 12m*, its last hour by the second, *Collapses in 2:31* in its collapse - the minutes and seconds rounded up, never less than is left |
| SD9c | THE WHEEL STEPPING BACK. The Turning Hour's wheel steps as a clock's escapement does, "never back" - and its angle rose, so through the camera's one mirror it stepped anticlockwise, the dial's own way | its angle falls: forward, clockwise as the eye sees it, against the dial turning back (`render/auraRing.js` `turningWheelAngle` and the shader's `turningWheel`) |
| L8 D1, G15 | THE HOLLOW'S FOE FRAME CLAIMED, NEVER MEASURED. 151 markers is the largest SPAWN template; a Hollow's (12+-block labyrinths and keeps, up to two-block exteriors) were never counted | said so, and measured: every Hollow template's enemy markers over MAPS.BSA and BLOCKS.BSA, the largest tripled, under `FOES_FRAME_MAX` (`test/sd11f_scenes.test.js`, skipped without the real data - not run in this session) |
| L8 D2, D3 | "THE REGION'S LARGEST CITY", "THE BAY'S EIGHT LARGEST" | the first of the region's cities ranked as its hub is (a city, the one named for its region, then the largest) with a suitable pixel; the Bay's first eight by the hubs' own claim |
| L8 D4 | "NEARLY TWICE THE WARDEN'S SHARE" | more than twice (525 s of reference damage against his 240; 1.75x a Colossal Warden's) |
| L8 D5 | THE SIGHTING "WITHIN 600 M", "NORTH-WEST" | on first crossing into its pixel (some 410 to 580 m), once, *"...to the Northwest!"* |
| L8 D6 | THE MADE PLACES WITHOUT THE HOUR | the Shattered Hour beside the court, the floor and the undercroft (section 12, TIER1's ledger and Testing rows) |
| L8 D7, D8 | `world172` IN THE sd3 ROW; THE ARC'S LEDGER ROW "building", "sections 2-7" | `world176`, renumbered past five; "built", sections 2-11 |
| L8 D9 | "NEVER OVER THE ARENA'S CLOCK" while Daggerfall's spires crossed its ring | true since SD11a (L2 F15: the shards hung above `SD_SHARD_TOP`) |
| L8 D10-D15 | section 1's diagram (`sdSite`, "found a Super dungeon"); "one time in SD_RUMOR_CHANCE"; the course "from z 72"; the refusals without a Mark; `ec` without `at`; the Worker silent on a hub that does not answer | `findSdSite` and the clients' own line; one time in two; A centred at z 72, its far edge z 75; a Mark and a Recall; `ec {e, at, d?, n?, r?}`; the Worker mints nothing and the page reconnects |
| L8 D17 | THE sd3 ROW OUT OF ORDER | after SD2d's |

L8 D16 (the code's comments on `n` and the great cities) is the laws' (SD11e).

Pins: `test/sd11f_scenes.test.js` (5 - the way home pressed alone; its rise and toll; said as it rises, from the world
host's text; the Rift's count; a Hollow's foes fit the frame, over the real data); `test/sd9c_turning.test.js` (the
wheel forward on the screen, PIN MOVED); `tools/mutants/sd11f.json` (24). RE-AIMED BY CONTENT: `sd9c.json` (the wheel's
shader), `sd10.json` (3 - the way home stood twice, and its stand; "carried off where it rises" recorded EQUIVALENT:
pressed alone, no step into it is ever taken), `sd10b.json` (2). PINS MOVED: `test/sd10_collapse.test.js` (the way home
pressed alone; its words; the hosts' stand with its age; its place said as it rises), `test/sd10b_audit.test.js` and
`test/sd11c_page.test.js` (the Rift's and the way home's rigs), `test/sd4b_rift.test.js` (the Hollow's Rift counts its
Hour).

### SD-ONELIFE - shipped 2026-10-07 (one life a Hollow)

Mac: *"A death within the rift casts you out and youre unable to re enter. You get one life to prove your worth"*. A
death in the Shattered Hour casts the player out (SD5a, under the Hour's veil, *"The Shattered Hour casts you out for
good. You wake before the Abyss Dungeon's door."*) and is final for that Hollow - its found window and its collapse alike:

- **The realm keeps its dead.** The dying pose (PCORPSE1's `dd`) that comes through a realm's room marks its account
  dead there (`server/src/index.js` `_sdMarkFallen`, kept with the realm under `SD_REALM_KEY` beside `in` and `gu`, once
  each, read back by a fresh instance - and past that list's 256, under its account's own key, `sddead:<account>`:
  SD20b). Its door (`_sdAdmit`) refuses that account's every hello after, before it asks
  whether they were in: *"The Hour will not take you back."* (`net/sdLaw.js` `SD_NO_FALLEN`) - a refusal the page takes
  as final, so it casts out with those words. A world cell's death marks nothing.
- **The page keeps the slot.** The frame I die in the Hour keeps its slot on the device (`SD_FALLEN_KEY`, the last
  SD_ENTERED_MAX, one memory with the slots gone through - `scenes/world.js` `sdSlotsKept`); the Rift asks with it
  (`world/sdDungeon.js` `sdRiftWord`'s `fallen`) and says the realm's words before the step, found or collapsing, though
  I went through.
- **No Resurrect in the Hour.** A body raised in place would stand in a fight its death has left; the death's way out
  is the Hour's.

What a fallen fighter earned stands: a part in the Remnant's kill is on its receipt (SD9a's law, the gate's), and the
spoils thrown are the world's.

Pins: `test/sd12_onelife.test.js` (3 - the realm remembers a death; the Rift's word; the page, from its text);
`tools/mutants/sd12_onelife.json` (11). RE-AIMED BY CONTENT: `sd4b.json` (2), `sd10b.json`, `sd11c.json` (2). PINS MOVED: `test/sd3_relay.test.js` (the realm's record keeps `dead`),
`test/sd4b_rift.test.js` (the Rift asked with the fallen), `test/sd5a_realm.test.js` and `test/sd11c_page.test.js` (the
death's words; the device's memory is `sdSlotsKept`), `test/sd10b_audit.test.js` (the Rift's rig),
`test/relayversion.test.js` (`world176` re-hashed in place - `net/sdLaw.js` is in the bundle).

THE FOUR HOSTS (AUDIT SD III, SD20f H3: this record had none): `scenes/world.js` WIRED (the slot of the Hour I die in
kept - `_sdFallen`, the death block's first statement - and the Rift asked with it, `sdRiftOf`; no Resurrect raising me
in the Hour); `scenes/worldModes.js` FLAGGED - the death and its door are the mode machine's as in any dungeon, worded by
the world host's respawn; `scenes/dungeonContext.js` FLAGGED - the Rift's refusal is its word off the outer host
(`superRift`), unchanged; `scenes/exterior.js` FLAGGED - the `?exterior` bench is offline: no Hour to die in.

### SD13 - shipped 2026-10-07 (the Score of the Hour)

Mac: *"The detail needs to exceed that of the oblivion gates. These are the pinnacle of the hardest content in the
game"*. The Warden has four songs, 5,529 notes (5,504 since SD20d A8 merged its 25 doubled - AUDIT SD IV, SD26 A6),
ten voices; the Hollow and the Hour had none - a dungeon's track played
under the Remnant. Now nine, written as notes for the game's own player and FM bank, pressed, chosen by a pure law:

| song | where, when | tempo / length | notes |
|---|---|---|---|
| HOURHOLW - the Hollow | inside a Hollow | 84 BPM, 32 bars | 572 |
| HOURHALL - the Orrery | the Threshold, the hall, the bridge | 96 BPM, 32 bars | 1,074 |
| HOURSTEP - the Unmoored Steps | the Steps; the arena before its fight's first word | 120 BPM, 32 bars | 1,228 |
| HOURWAR1 - the Remnant wakes | the arena, phase one | 136 BPM, 32 bars | 1,464 |
| HOURWAR2 - the Dragon Break | phase two | 142 BPM, 32 bars | 1,795 |
| HOURWAR3 - the Last Moment | phase three | 152 BPM, 32 bars | 2,856 |
| HOURLAST - the Hour ends | the fight's last minute | 160 BPM, 16 bars | 1,184 |
| HOURFELL - it falls | the fall, anywhere in the Hour: SD_SCORE_STING_MS (16.5 s) from its own first note | 88 BPM, 12 bars | 102 |
| HOURGONE - the collapse | after the fall, and in the Hollow while it collapses | 72 BPM, 24 bars | 590 |

(AUDIT SD IV, SD26 A6: the counts as SD13 shipped them. AUDIT SD III, SD20d A8 merged 33 doubled note-ons, and the
songs hold 1,068 (the Orrery), 1,222 (the Steps), 1,459, 1,793 and 2,846 (the war) and 1,180 (the Hour ends) - 10,832
in all.) 10,865 notes on thirteen voices and the kit (14 channels against the Warden's 10): the harpsichord's escapement, the
bass, strings, brass, choir, church organ, timpani, a music box for the chime, tubular bells for the hours, horns,
pizzicato, harp and the orchestra hit; the kit's woods for the clock (the tick on the hi wood block, the tock on the
low, the claves racing in the Last Moment), the gears' ride bell, the low drums. Silence from the End (its word or its
time) and on a lost fight; the fall played whole from its own first note (`createHourScore`, the gate's AUDIT WB D2 and
WBX W3), a fall heard late going straight to the collapse's. The world host's `hourScoreFrame` holds the music before
the court's and the arena's, and lets it go stopped the frame I stand in neither.

Measured through the real player in Chromium (`tools/sdScoreProbe.mjs`, 32 checks): the war at -16.4 / -15.8 / -14.6
dBFS and its last minute -14.4 (the Warden's -15.8 / -15.4 / -14.2), the fall -14.8, the places under them (-17.4 the
Steps, -19.8 the hall, -19.9 the Hollow, -19.6 the collapse); every peak under -1 dBFS at the highest MusicVolume;
every second sounding; the fall rung out before the collapse's song; one player through all nine and an unpressed song
after.

Pins: `test/sd13_score.test.js` (7 - the songs; the Hour's sound; the levels; where I stand; the law; the fall played
whole; the host, from the world host's text); `tools/mutants/sd13.json` (27).

THE FOUR HOSTS (AUDIT SD III, SD20f H3: this record had none): `scenes/world.js` WIRED (`hourScoreFrame` - the Hour's
score while I stand in a Hollow or its Hour, asked before the court's, the arena's and the director's); `scenes/worldModes.js`
FLAGGED - the music is the world host's (it reads the mode machine's place, and SD20d its `stepping`);
`scenes/dungeonContext.js` FLAGGED - the dungeon host stands the Hollow and the Hour, never their music;
`scenes/exterior.js` FLAGGED - the bench's music is the director's alone.

### SD14a - shipped 2026-10-07 (the Brass Remnant's voice)

The Warden speaks in 48 cues; the Remnant had its blows' wind-ups and landings and its fall's thud, and nothing of its
body (the inventory's own words: "no Remnant footsteps, its wake, phase turns, Echo rise / fall ... the stun, the loss,
any voice"). `scenes/sdRemnantVoice.js` reads the fight this page holds each frame and speaks 32 cues more (AUDIT SD IV,
SD26 A6: 33, and the arc's 60 below 61, from SD20d A2's knell until SD26 A4 took the quake out), in
Daggerfall's own Iron Atronach's voice (`ENEMY_BASICS` row 36: its move 222, bark 223, attack 224) pitched for a
colossus of brass - the Remnant under gold under silver:

- **Its body**: a stride on the stone every `SD_STRIDE_M` (3.2 m) walked, where it stands (a body put somewhere far is
  no stride; none outside time); a growl while it does not strike, 7 s and a seeded part of 6 more apart, held through
  a blow; a grunt for each 0.4% of its health lost, 1.4 s apart, a fighter's share joining moving the count; its wake
  (the bark, the Hour's bell under it); the Dragon Break (the Orrery's chime, low - it steps outside time) and the
  Last Moment (its deepest bark, the storm's roll); back from outside time (the gears grinding together); stunned (its
  bark, a ring) and up again (the gears); the gears slipping once under a fifth of its health; its cry at its fall; the
  ground's shock under its Stomp (AUDIT SD IV, SD26 A4: the Stomp's own landing, `SD_BLOW_CUES.land.stomp` - the
  voice's quake started the same thud a second time in the same frame, and is gone); the Hour's bell, the lowest of its
  body's, when the fight is lost (AUDIT SD IV, SD26 A6: this said "lowest" - the End's toll and its knell are the same
  bell lower).
- **Its Echoes**, each at its own pitch: risen (the chime), striding (`SD_ECHO_STRIDE_M`), hurt, broken (the shatter).
- **Each blow's release** (WB13d's law): `SD_RELEASE_MS` (350 ms) before it lands, once - the Stomp's body, the Hand's
  swing, the Volley's gears loosed, the Pulse's roll, the Reset's ring, the End's bell.
- **Aimed at me**: a Volley's mark within `SD_STING_M` (2 m) of my feet stings at its word, at my feet (WB13e).

A turn is heard as it happens: a fight first seen (a late join, a reload) is taken as it stands, and a wake or a fall
heard over 1.5 s late is never sounded. With the blows' 14, the Orrery's 4, the Steps' 4, the Hearts' 4, the Rift's bell
and the way home's toll, the arc speaks in 60 cues (the Hour's air, SD14b, past them). The world host makes it beside
the fight's link, frames it with the blows in the Hour and lets it go with the link out of it.

Pins: `test/sd14a_voice.test.js` (7 - the voice; the turns; hurt and the slip; strides and the growl; the Echoes; the
releases, the shock and the sting; forgotten and the host's); `tools/mutants/sd14a.json` (27). RE-AIMED BY CONTENT:
`sd11c.json` (the fight left once). PINS MOVED: `test/sd11c_page.test.js`, `test/sd8c_remnant_page.test.js`,
`test/sd8d_remnant_blows.test.js` (the voice framed and let go beside the blows).

THE FOUR HOSTS (AUDIT SD III, SD20f H3: this record had none): `scenes/world.js` WIRED (`sdRemVoice` - made beside the
blows, framed in the fight's frame for the living, let go with the Hour); `scenes/worldModes.js` FLAGGED - nothing of the
fight passes through it; `scenes/dungeonContext.js` FLAGGED - the Remnant's body stands there (`scenes/sdRemnant.js`),
its voice is the world host's off the fight's link; `scenes/exterior.js` FLAGGED - no Hour.

### SD14b - shipped 2026-10-07 (the Hour's air)

The Deadlands have three beds and three kinds of event; the Hour had none - its dungeon's drips and doors silenced and
nothing put back but the Rift's bell. `scenes/sdAir.js`, on the Deadlands' model (`scenes/deadlandsAir.js`):

| bed | what | where |
|---|---|---|
| the void's wind | DAGGER.SND's deep moan at 0.55 (the Deadlands' at 0.74), breathing 24 times a period between 60% and its level | everywhere in the Hour |
| the Hour's works | a tick (the Orrery's clunk at 1.6) and a tock (at 1.2) a second (0.8 and 0.6 since AUDIT SD III, SD20d A9 - `SD_WORKS_TICK`, under the Beat's own pitch; AUDIT SD IV, SD26 A6), the gears' grind faint under them - MADE at runtime out of the player's own archive, as the Rift's bell is (`buildHourWorks`) | everywhere |
| the Orrery's hum | the ship's bell slowed to a drone at a quarter, its fifth and its octave over it, darkened, swelling twice a loop (`buildOrreryHum`) | over the Orrery's centre, 50 m (never the arena) |
| the arena's gears | the grind at 0.55 | under the arena's floor, 70 m |

| event | slot (s) | share | from |
|---|---|---|---|
| a bell tolled far off | 24 | 50% | 20 m over the ear |
| a gear falling into the void | 12 | 45% | 25 m under |
| the void's moan | 30 | 40% | 15 m under |
| the shards grinding | 36 | 50% | 35 m over |

Each slot whole over the sky's period (720 s; 59 events in one), seeded and pure, each from a stand-in in its own
quarter held at its bearing (`airSourceAt`, `far`); a gap longer than `AIR_BACKLOG_S` plays none of what it passed. The
made two are registered once the archive is read and asked again until then; all four beds let go the frame I leave
the Hour, and the events still sounding fade with them (AUDIT SD IV, SD26 A5: a moan or a bell rang on at the ear in
the street - each is played under the Hour's name and `audio.js` `fadeFar` lets it go; the Deadlands' the same), one
engine's at a time. The world host frames it on the sky's clock (`deadlandsSeconds`) after the ways out
have run, beside the Deadlands' own. With the Remnant's voice (SD14a) the arc speaks in 64 cues and four beds.

Pins: `test/sd14b_air.test.js` (5 - the beds; the made sounds; the events; heard from its quarter; the world host);
`tools/mutants/sd14b.json` (16).

THE FOUR HOSTS (AUDIT SD III, SD20f H3: this record had none): `scenes/world.js` WIRED (`sdAirFrame` - the Hour's air
beside the Deadlands', on the sky's own clock, stopped out of the Hour); `scenes/worldModes.js` FLAGGED - the realm's
per-frame arm lights and fogs it, its air is the world host's; `scenes/dungeonContext.js` FLAGGED - the Hour's level
stands there, never its air; `scenes/exterior.js` FLAGGED - no Hour.

### SD14c - shipped 2026-10-07 (the Hour's motes)

The Deadlands' air carries 896 motes (embers off the sea and its braziers, ash); the Hour carried none.
`render/sdMotes.js` draws 1,220, four kinds, each a point after the realm's solid geometry - depth-tested, never
written, added, in the Hour's fog and its sky's light (the world host's `drawSdTelegraph`, the Hour's world pass):

| kind | how many | where and how |
|---|---|---|
| brass dust | 320 | round the Orrery, inside its ring and 4 m past it, 0.4-7 m up - turning once a period with the stones, bobbing; never out over the Steps |
| sparks out of the void | 360 | under the course from the first step to its end, rising from 26 m below to a body's height and gone there, cooling gold to brass |
| the Hour's motes | 300 | round the arena 4-30 m out, 1-12 m up, orbiting AGAINST the clock, breathing - the Mantella's gold-green |
| the shards' dust | 240 | the sky over everything, 14-46 m up, falling slowly |

Each is a pure function of its seeded draws and the sky's clock (`sdMoteAt`, the vertex shader's own law in JS), every
rate a whole number of turns over the period - every screen the same air at the same moment; a life's wrap falls only
where a mote is unseen. A mote under `SD_MOTE_MIN_PX` (2 px) across is drawn that wide and faded by how much smaller it
is (`sdMotePx`): the first browser run showed far motes - one-pixel points whose pixel's centre fell outside their disc
- dropped, the far air flickering and thinning.

In a real browser (`tools/sdMotesProbe.mjs`, 19 checks): the program compiles and links; from the hall, the Steps, the
arena and under the sky, at two times, the frame is lit, there is no GL error, and every mote asked (up to twelve of
each kind in view) is lit where `sdMoteAt` projects it.

Pins: `test/sd14c_motes.test.js` (5 - over a thousand; each in its place; on the Hour's clock; the shader RUN holds the
law, and the small faded; drawn, and the world host's); `tools/mutants/sd14c.json` (13). PINS MOVED:
`test/sd8d_remnant_blows.test.js`, `test/sd9e_spoils.test.js` (the Hour's world pass draws the motes beside the blows
and the loot lines).

THE FOUR HOSTS (AUDIT SD III, SD20f H3: this record had none): `scenes/world.js` WIRED (the motes - `SdMotesRenderer`,
made the first time the Hour is drawn - in the Hour's pass, in its fog and its sky's light); `scenes/worldModes.js`
FLAGGED - its per-frame arm hands the Hour's fog and sky, never the motes; `scenes/dungeonContext.js` FLAGGED - the
level stands there, the motes over it are the world host's pass; `scenes/exterior.js` FLAGGED - no Hour.

### SD15 - shipped 2026-10-07 (the arena read)

The gate tells a fighter "move!" when a blow is about to land on their feet (WB13a) and shows the fight's turns on a
card (WB13e); the Hour told neither - in first person at a colossus's feet the floor's telegraph is out of sight.
`scenes/sdArenaRead.js` and `ui/sdTitleCard.js`:

- **In it** (`sdPerilAt`): the soonest of the Remnant's and its Echoes' blows still to land on my feet - the Stomp's
  disc, the Hour-Hand's sweep (from now on, unshaded by a pillar), a Volley's mark: its name, its wind-up's share, its
  last moment, its floor colour, and the nearest way out over the arena's floor (`sdWayOut`: 24 bearings, a quarter
  metre at a time, 20 m at most, never past a metre inside the rim) as the screen turns it. Once the Stomp has landed,
  its ring rolling out within `SD_JUMP_CALL_M` (3 m) of me: *"Brass Stomp - jump!"*, no arrow. The Hour's own blows over
  the whole floor are never "in it" - no step escapes them. Drawn by the gate's own ground view (`ui/gateGroundView.js`:
  the rim pulsing in the blow's colour, the words under the crosshair, the arrow), which also feels the burning brass
  under my feet (*"Burning brass - step out!"* - the blows say `burning()`).
- **The beats** (`createSdBeats`) on the Hour's own card, in brass and the Mantella's light (the Warden's burns in
  Dagon's red): its wake (*The Brass Remnant - What the Warp kept of the Numidium*), *II - The Dragon Break* (*Gold and
  silver - fell them within 15 seconds*), *III - The Last Moment* (*Break its Hearts before the Reset lands*), *The Hour
  - Ends in one minute*, and *The Brass Remnant - Undone*; each once a fight, a wake and a fall shown live alone, a late
  page taking the fight as it stands. The card's model is the Warden's own pure one (`titleCardModel`); its node is
  made once and updated. The wake, the Break and the Last Moment are drawn where the bar stands (`sdBarNear`), the
  last minute and the fall for the whole Hour (AUDIT SD IV, SD26 T1: every turn was drawn over the Steps' jumps, the
  voice having kept it from them - L6 F15's law; the beats still follow the fight far off, so none is drawn late).

The world host reads the fight once a frame for the bar, the ground and the card, hides all three with the HUD, and
puts them away with the bar.

Pins: `test/sd15_read.test.js` (6 - the Stomp; the Hand, the Volley and the Echoes'; the way out and the ground view; the
beats; the Hour's card and the host's; the burning brass felt); `tools/mutants/sd15.json` (21). PINS MOVED:
`test/sd8c_remnant_page.test.js` (the fight read once; one hide), `test/sd11c_page.test.js` and `test/sd11a_scenes.test.js`
(the arena read in the fight's rigs).

THE FOUR HOSTS (AUDIT SD III, SD20f H3: this record had none): `scenes/world.js` WIRED (the fight's frame reads the
arena - `sdPerilAt`, `sdGroundModel`, `createSdBeats` - and draws the gate's ground view and the Hour's own title card
under one hide); `scenes/worldModes.js` FLAGGED - nothing of the read passes through it; `scenes/dungeonContext.js`
FLAGGED - the arena's level is the dungeon host's, its read the world host's; `scenes/exterior.js` FLAGGED - no Hour.

### SD16 - shipped 2026-10-07 (the blows seen)

The Warden's court throws 12 kinds of burst, shakes the camera under 7 of his landings and lights its floor where they
fall (WB13d, WB13e); the Hour threw none - its blows were a telegraph on the floor and a sound. `scenes/sdFx.js` reads
the fight this page holds each frame, as the voice does (a page that comes late takes the fight as it stands), and sees:

- **The bursts** (`SD_FX_KINDS`, 17): the Stomp's landing at its feet and its ring's dust at six points of its front,
`SD_RING_DUST.after` (400 ms) into its roll; the Hour-Hand's light out of the chest (gold for the Remnant, the Echo's
own colour for an Echo's); the Volley's gears at each mark; the Pulse, the Reset and the End over the arena's heart (a
Reset the Hearts broke throws none); each Echo risen and broken; each Heart risen and broken - the last one's break and
the Hearts' going arrive in one word (the stun's), and are seen as one; the stun; its wake (live alone); its gears
slipping once under a fifth (`SD_SLIP_FRAC`, the voice's); its fall (a burst out of its chest, then `SD_FX_COLUMN` -
three bursts of brass 1.5 s on, a quarter-second apart, as its body sinks - then the way home's pale light where
`clearOfPillars` stands it, as it rises at `SD_REM_SINK_MS`). A landing is seen once, and only within
`SD_FX_LAND_LATE_MS` (500 ms) of it; a turn within `SD_FX_LATE_MS` (1.5 s). Sixteen at most stand (the pass's
`FX_BURSTS_MAX`), the oldest given up for the newest.
- **The shakes** (`SD_SHAKE`, 9, through the gate's door - `betterAmbience.weaponKick`, under the player's own
maxShake): the Stomp (2.5 fading over 14 m), a Volley's nearest mark (1.2 over 6 m), an Echo broken (1.5 over 10 m), the
stun (1.5 over 20 m); the whole arena's for the Pulse (1.5), the wake (2), the Reset (3), the fall (4) and the End (5).
Out of the Hour, none.
- **The lights**: each lit kind's flash where it fell (`light` [intensity, reach]), fading over the gate's
`FX_LIGHT_MS`, in the Hour's own channel after the spoils' (`sdRealmLights`, `realmLightsWith`); the fall's white-gold
over the arena for `SD_FX_FLASH_MS`.

Drawn in the Hour's world pass after the motes, on the fight's clock, the pass made the first time there is a burst. In
a real browser (`tools/sdFxProbe.mjs`, 18 checks, on Vite's own server - the scene's graph reaches `import.meta.glob`):
the Stomp, a Volley, the Pulse, the Hearts and the fall each drawn by the gate's spark pass with no GL error, every
burst lit where the law stands it, the brass warm and the Hearts green about them, and a flash in the Hour's light for
each that throws one.

Pins: `test/sd16_fx.test.js` (6 - more than the gate; a landing once, where the law puts it; the Hand, the Volley, an
Echo's and the Hour's own; the turns, the Echoes and the Hearts; the fall; the bursts as the pass takes them and the
world host's); `tools/mutants/sd16.json` (28). PINS MOVED: `test/sd8c_remnant_page.test.js`,
`test/sd8d_remnant_blows.test.js`, `test/sd14a_voice.test.js`, `test/sd11c_page.test.js` (its sparks framed and left
beside the voice), `test/sd14c_motes.test.js`, `test/sd9e_spoils.test.js` (drawn after the motes; lit after the spoils);
records re-aimed by content: `sd11c.json` G3, `sd14a.json` never-let-go, `sd9e.json` unlit.

THE FOUR HOSTS (AUDIT SD III, SD20f H3: this record had none): `scenes/world.js` WIRED (`sdFx` framed in the fight's
frame, its landings' flashes in the Hour's light channel - `sdRealmLights` - and its sparks in the Hour's pass);
`scenes/worldModes.js` FLAGGED - its per-frame arm takes the Hour's lights from the world host whole;
`scenes/dungeonContext.js` FLAGGED - the bursts are drawn over its level by the world host's passes;
`scenes/exterior.js` FLAGGED - no Hour.

### SD17 - shipped 2026-10-07 (the body moved)

The Warden is a sprite of 10 states (`world/gateBoss.js`); the Remnant stood rigid in every one of its blows - one mesh
moved and turned whole. Now:

- **Seven parts** (`world/sdRemnantModel.js` `buildRemnantParts`, `SD_REMNANT_PARTS`): the pelvis (the hip - never
turned, the body's own draw, so a body stands, hides and scales where it always did), the right leg (at -x: it faces
+z), the left, the torso (cage, heart, shoulders), the head and its eyes, the right arm and the left - together
`buildRemnantModel`'s faces, every one. An Echo the same in its own metal at its own height.
- **The rig** (`scenes/sdRemnantRig.js`, pure): `remnantRig(s, who, t)` the pose of a body - the legs' swings, the
torso's bob, lean and twist, the head's nod, each arm's raise forward and outward - in 18 states (`SD_REM_STATES`);
`rigMatrices` each turned part's matrix on the body's own, every joint kept where its parent holds it, the head and the
arms riding the torso. The walk plants a leg at every `SD_STRIDE_M` walked (`SD_ECHO_STRIDE_M` an Echo's - the voice's
own, so each footfall is heard as a leg plants), eased over its first and last metre, the body dipping on the planted
foot. Every blow is moved, on the blow's own wind-up (an Echo's and the Last Moment's faster - `windupFor`): the Stomp's
leg 0.95 rad up, slammed at `SD_RELEASE_MS`; the Hand's arm level and the waist turned to the sweep's start, then with
the beam; the Volley's arms back, then thrown as the gears leave; the Reset's hands over its head, trembling more as it
nears. The rig's numbers live in typed arrays and its joints go by index (AUDIT SD II, L2 F9's law: the arc's
own code makes nothing in the Hour's frame - a number written into an object's field, or handed to a function the
engine has not taken up, is a box made).
- **The gears** (`sdGearsAt`): each Volley mark's gear thrown `gearFlightOf` (900 ms, at most 45% of the wind-up) before
it lands, from between its hands as they leave them, arcing `SD_GEAR_ARC_M` (7 m) over the straight line, spinning, down
on its mark as the Volley lands (SD16's burst takes it there); a broken Echo throws none. Fifteen draws
(`SD_GEAR_DRAWS`: five marks from each of three bodies), a brass cog of nine teeth (`buildGearModel`).
- **The beam** (`sdBeamsAt`, `sdBeamDraws`, `render/sdBeam.js`): out of the pointing hand along the sweep's bearing (the
law's own: `yw + sw (arc k - arc/2)`) to the floor at the blow's length - or to the first pillar's face (`beamReach`,
halving on `behindPillar`), as the law shades what stands behind one; its light up over the sweep's first 120 ms and out
over its last 220.

The scene stands each body's six turned parts after the Hearts and the gears after them (the bodies and the Hearts keep
their places), turns them on the body's own matrix each frame and hides them with it; the world draws the beams in the
Hour's world pass after the sparks. In a real browser (`tools/sdBodyProbe.mjs`, 37 checks): the beam's program links;
every one of 17 poses names its state, draws its body and differs from its rest by 900 to 4,000 pixels; the beam lights
the frame out of the hand. `SD_BODY_SHOT=<png>` writes the tiles.

Pins: `test/sd17_body.test.js` (6 - the parts; eighteen states, at rest the whole, the joints kept, the turns' senses;
the states as the fight turns, the walk in step and dipping; every blow moved; the gears and the beam; the scene and the
world); `tools/mutants/sd17.json` (38). Found by its own test: the falling ease read nought before its start, so the
stun's slump, the Hand's raised arm and the Volley's throw never showed - fixed before it shipped. PINS MOVED:
`test/sd8c_remnant_page.test.js`, `test/sd11a_scenes.test.js` (the draws after the Hearts), `test/sd14c_motes.test.js`,
`test/sd16_fx.test.js`, `test/sd8d_remnant_blows.test.js`, `test/sd9e_spoils.test.js` (the beam after the sparks);
`sd8c.json` SD8C-an-echo-unscaled re-aimed by content.

THE FOUR HOSTS (AUDIT SD III, SD20f H3: this record had none): `scenes/dungeonContext.js` WIRED (the Remnant it stands -
`scenes/sdRemnant.js` - is the rig's body: its parts and its gears among the context's own draws, framed and freed with
it); `scenes/world.js` WIRED (the Hour-Hand's beam drawn in the Hour's pass, `sdBeamDraws`); `scenes/worldModes.js`
FLAGGED - the body is the dungeon host's, the beam the world host's; `scenes/exterior.js` FLAGGED - no Hour.

### SD18a - shipped 2026-10-07 (the Hour's marks)

The gate's Warden wears one of four aspects and two of nine trials, a cycle of 144 (WB8b); every Hour was the same Hour.
Now each Hollow keeps one of six Endings and two of nine omens (section 10's *Its marks*):

- **The marks** (`net/sdMarks.js`, a leaf the relay bundles): `SD_ENDINGS` (the Orrery's stones, in its order - each an
element, a light for SD18b, a signature and its law), `SD_OMENS` (9), `sdMarksCycle` (216: Hollow `k` keeps pair `k mod
36` of a ring of the omens' pairs in which neighbours share no omen - `disjointRing`, a depth-first walk - and Ending
`(k + floor(k / 36)) mod 6`, the Endings' order and the omens' seats the salt's shuffles), `sdMarksOf(slot)`,
`validSdMarks`, `sdMarksLaw` (multipliers multiplied: Sunfall's and the Burning Brass's brass burns three times as
long).
- **The profile** (`net/sdRemnant.js` `sdFightProfile`, `sdProfileOf` - `profileOf` until AUDIT SD III, whose name the gate's brain already held): the numbers the relay runs the fight by - health,
wind-ups, the End, the Pulse's beat and step, the Reset's, the pair's window and Hand, the walks, Sunfall's seven, the
fray, the Stomp's disc and ring, the Hand's sweep, the pool - the table's own with no marks. The fight is born with its
marks (`newRemnantFight(s, fi, now, mk)`) and keeps them; its state says them (`mk`).
- **The stamped shape** (`shapeStamp`, `blowShape`, `atkWindup`, `pulsePctOf`): each blow whose shape the marks change
carries only the change on its own frame - `r`, `r1`, `wave`, `arc`, `active`, `pr`, `pm`, `w`, `ps`, `el` - and the
geometry both ends read (`stompRingAt`, `stompFrontAt`, `ringPassed`, `handAngleAt`, `handSwept`), the strike law
(`net/sdStrike.js` - every hit and every pool its element), the floor's telegraph, the arena read, the bar, the rig and
the beam read it. A fight with no marks frames as it always did - no `sh` anywhere.
- **The wire** (`net/wire.js`): a shape's keys each their own bound and an element the known ones' (`sdShape` - anything
else refuses the frame), a state's `mk` projected when it is a set of marks, `SD_TARGETS_MAX` 7 (Sunfall's). The link
keeps both, and reads its Reset's clock after a stun or the Last Moment's return by the profile.
- **The relay** births every fight with its slot's marks (`sdMarksOf(s)`); the Orrery frays by them
(`orreryOf(s).fray`). Relay world176 re-hashed in place (undeployed): `net/sdMarks.js` joined the bundle.

Pins: `test/sd18a_marks.test.js` (5 - the marks and the cycle; the profile and the stamps; the law under its marks; the
blow its frame says; the wire, the page, the Orrery and the relay); `tools/mutants/sd18a.json` (42, one equivalent as
recorded: the ring's closing check - the walk's first ring closes at every seat count from 6 to 12). PINS MOVED:
`test/sd8b_fight.test.js` (the Volley's marks at most Sunfall's seven), `test/relayversion.test.js` (the graph, the
hash). Records re-aimed by content (22): `sd15.json` (3), `sd17.json` (2), `sd6a.json` (2), `sd8a.json` (6),
`sd8b.json`, `sd8c.json` (3), `sd8d.json` (5) - each run again, every one dead.

THE FOUR HOSTS (AUDIT SD III, SD20f H3: this record had none): none wired - the law, the relay and the link
(`net/sdMarks.js`, `net/sdBrain.js`, `net/sdFightLink.js`); `scenes/world.js`, `scenes/worldModes.js`,
`scenes/dungeonContext.js` and `scenes/exterior.js` FLAGGED - each reads a Hollow's marks through the fight's link or its
slot (SD18b, SD18c), never the law's tables.

### SD18b - shipped 2026-10-07 (the marks seen)

The gate shows the Warden's marks on a card as a fighter steps in and in a row under his bar, and his aspect colours and
names his ground (WB9a, WB9d); SD18a gave the Hour its marks and showed none. `ui/sdMarksView.js`:

- **The view and the card** (`sdMarksViewOf`, `sdMarksCardModel`): the gate's own shapes - the Ending first (its
signature, element, light, `Resist <element> to blunt its own blows and brass.` and its own tip), then each omen - drawn
by the gate's card (`drawGateMarksCard`) and bar (`ui/gateBossBar.js`) with the Hour's own signs (`SD_MARK_ICONS` - the
six stones' and the nine omens'; `markIconHtml` draws a mark's own path, the gate's table for its own). The card stands
`SD_MARKS_ARRIVE_MS` (9 s) as a fighter steps into the Hour, coming up and fading; the world never hides it as the
street's card (the line that put the gate's card away off the street now spares the Hour). Under the bar, the row, each
mark its sign and its name (AUDIT SD III, SD20e T17: the row alone - the omens joined in a line, `trials`, were handed
to a bar that draws none); the phase's name stays over it.
- **The wake** (`sdWakeText`): *The Brass Remnant - <signature> - the Ending of <stone>*.
- **The element on the floor** (`scenes/sdRemnantBlows.js`): `sdTint` leans the Remnant's own blows' colours
`SD_TINT_LEAN` (35%) to the element's (each keeps its own, to be told apart; the Hour's own blows untouched, the Reset's
red edge kept); its brass in the element's colour, grain (`SD_ELEMENT_STYLE` - the gate's fire, frost, shock and poison;
magic the light's crackle) and name (`SD_ELEMENT_GROUND` - *Burning*, *Rimed*, *Charged*, *Venomed*, *Soul-lit brass*),
under the crosshair too (`sdGroundModel`, `burningEl`).
- **The strike** (`save`): a hit or a bite in the element is softened by the struck player's own resistance - the
world's door is the gate's saving throw (`GATE_SAVES`, magic added) - and lands as that element (its cast, its shake:
the dungeon context's strike door, magic's cast added); a plain blow never asks.
- **The hall**: the Ending's own stone lit in its light (`sdEndingStoneLight` - in the Hour's light channel, breathing
on the hall's clock), and the fray's arc round once by the Hollow's own snap (36 for the Fraying).

Pins: `test/sd18b_seen.test.js` (6 - the view; the card and the world's; the bar and the wake; the element on the floor;
the strike; the hall); `tools/mutants/sd18b.json` (25). PINS MOVED: `test/sd11a_scenes.test.js`,
`test/sd11c_page.test.js` (the marks card in the fight's rigs), `test/sd15_read.test.js` (the ground in its element),
`test/sd16_fx.test.js`, `test/sd9e_spoils.test.js` (the stone's light after the landings'); records re-aimed by content:
`sd10b.json` (3), `sd11a.json` (2), `sd15.json`, `sd8d.json` - each run again, dead.

THE FOUR HOSTS (AUDIT SD III, SD20f H3: this record had none): `scenes/world.js` WIRED (the marks card as I step into the
Hour, `sdMarksCardModel`; the element on the floor and under the crosshair; the save against its Ending's element; the
Ending's stone light in the Hour's channel); `scenes/dungeonContext.js` WIRED (a strike's cast sound by its element -
`GATE_STRIKE_CAST`, magic among them); `scenes/worldModes.js` FLAGGED - nothing of the marks passes through it;
`scenes/exterior.js` FLAGGED - no Hour.

### SD18c - shipped 2026-10-07 (the Ending's light and word)

SD18b put a Hollow's Ending on its card, its row and its floor; the colossus itself still burned the Mantella's green in
every Hollow, and no one outside the Hour heard which Ending it kept.

- **Its light** (`world/sdRemnantArt.js` `SD_REMNANT_ENDING_RECORD`, records 25-30, `endingLightArt`): one picture an
Ending - its colour, and as much again its own light - uploaded with the Echoes' metals. The Remnant's heart and eyes,
its Echoes' and the Reset's Hearts burn with it (`world/sdRemnantModel.js` `heartRecordOf`, `eyeRecordOf`;
`buildRemnantParts(metal, ending)`, `buildHeartModel(ending)`): the scene builds its bodies by the Ending the dungeon
context hands it from the realm's own slot (`sdMarksOf(dfLocation.sdRealm)[0]`); with none, the Mantella's green and the
brass's gold as they were.
- **Its sparks** (`scenes/sdFx.js` `sdHeartColorOf`): the Hearts risen and broken and the stun in the Ending's light.
- **Its word** (`systems/sdOmen.js`): the taverns tell the omen its Ending sends (`SD_ENDING_RUMOR` - a lion roars where
there is no lion; the sun goes down twice; the tide comes in where there is no sea; something heavy walks just under the
earth; the dead in their barrows turn their heads toward the walls; a dragon's shadow crosses where no dragon flies - the bell
where none is kept), and its card on the held map says *It keeps the Ending of <stone>*.

Pins: `test/sd18c_endings.test.js` (4 - the lights; the bodies and the scene; the sparks; the word);
`tools/mutants/sd18c.json` (13). PINS MOVED: `test/sd8c_remnant_page.test.js` (the art's records; the context's birth of
the scene), `test/sd2c_omen.test.js` (the map card's line, the rumor by the slot's Ending).

THE FOUR HOSTS (AUDIT SD III, SD20f H3: this record had none): `scenes/dungeonContext.js` WIRED (the Remnant burns in its
Hollow's Ending's light - the slot's marks, `sdMarksOf`, handed to the body it stands); `scenes/world.js` WIRED (the
taverns' word of a Hollow by its Ending - `getNewsOrRumors` asks `sdHost.rumor` first); `scenes/worldModes.js` FLAGGED -
nothing of the Ending passes through it; `scenes/exterior.js` FLAGGED - the bench is offline: no Hollow, no taverns'
word of one.

### SD19 - shipped 2026-10-07 (the Hollow's presence)

A gate's sky burns over its region, a banner counts it down at its fire, and the chat speaks of it eight ways
(`systems/gateOmen.js`); a Hollow had its column, three lines and a Timers row once found. SD19 gives it a presence:

- **The brass air** (`systems/sdOmen.js` `SD_AIR`, `sdAirNear`, `sdAirDusk`, `sdAirWeight`): the taverns have always
said *the air goes brass-coloured ... at dusk*; now it does. The weight is the column's own light (`sdOmenLight`) times
the eye's distance (whole within `SD_AIR.fullM` 1000 m, gone by `SD_AIR.edgeM` 8000 m, a smoothstep between) times the
hour (`SD_AIR.base` 0.45 of it all day, whole at minute 1170, a cosine window of 150 minutes each side), never past
`SD_AIR.max` 0.55. The land's haze is graded toward the brass its own brightness falls on (`sdBrassGrade`, a
three-stop `SD_BRASS_RAMP` by luminance) - last, over the sun baby's and the dread's (`scenes/shared.js` `setBrass`,
`fogColorFor`) - and both lights lean toward `SD_BRASS_TINT` (`sdBrassLight`, around the ambient and the key in
`scenes/world.js`). The world reads it each exterior frame (`sdAirNow`: none indoors, none with no Hollow standing),
before the haze is read. The grade is the CPU's, on the fog and the light - no sky shader changes.
- **The banner at its door** (`sdBannerText`, `SD_BANNER_M` 60): within 60 m of its centre while it stands (risen,
found or collapsing), outside, walking: its name, what it is and its state, on the gate's banner
(`ui/gateBanner.js`), and its marks on the gate's own card in its `'gate'` mode (`ui/sdMarksView.js`
`sdMarksCardModel(mk, { mode: 'gate' })` - no clock: it stands while the player does; none once it fell). Both are the
world's wishes (`presenceFrame`): the gate's pool sets its own (`_gateBannerWish`, `_gateMarksWish`), and it wins - its
countdown is a fire's; a Hollow's door's is drawn only where no gate asks. Indoors both are cleared, gate or Hollow.
- **The words** (`scenes/sdHost.js`): the find is followed by its marks (`sdMarksLine` - its Ending, its signature and
both omens); a found Hollow's last hour (`SD_HOUR_LEFT_MS`) is said to the realm once a slot (`sdHourLine`), near its
city once its place is known, by the region's name if the world offers no Hollow - never while it is only risen (a
find, not news), and never before the find it follows (AUDIT SD IV, SD26 T7: the frame said it before the finds it
owed, and a Hollow found in its last hour faded in chat before it was found).
- **The next one's rise** (`systems/eventTimers.js`): once a Hollow is gone - beaten, collapsed or faded unfound - the
Timers count the next slot's not-before (`rec.next`), never where; the row goes once it may rise.

Pins: `test/sd19_presence.test.js` (6 - the air's law; the grade and the light; the sky and the light by source; the
banner and the card; the words; the next rise); `tools/mutants/sd19.json` (34). PINS MOVED: `test/sd2b_world.test.js`
and `test/sd11c_page.test.js` (the marks line after the find), `test/sd2c_omen.test.js` (the gone state's next-rise row),
`test/wb2_gate.test.js` and `test/wb9a_gate_marks_seen.test.js` (the banner and the card as wishes, cleared indoors for a
Hollow too), `test/wbx8_gate_sky.test.js`, `test/sunbaby1_event.test.js`, `test/sunbaby2_phases.test.js` and `test/event1_live_event.test.js` (the lights under `sdBrassLight`, the haze's dread grade now `d`), `test/auditwb_world.test.js` (the banner a wish, hidden by the same three). Records
re-aimed by content: `EVENT1-controller-fog-ungraded`, `SD18B-the-card-never-fades`, `SUNBABY1-host-light-unlifted`,
`WB2-the-banner-follows-indoors`.

THE FOUR HOSTS (AUDIT SD III, SD20f H3: this record had none): `scenes/world.js` WIRED (the brass air near a standing
Hollow - `sdAirNow`, `sdBrassLight`, and the fog's grade through `scenes/shared.js` `setBrass`; the banner and its marks
card at its door - `presenceFrame`, the gate's wish first; its marks and its last hour said through `sdHost`);
`scenes/worldModes.js` FLAGGED - the presence is the street's, cleared indoors by the world host; `scenes/dungeonContext.js`
FLAGGED - inside the Hollow nothing of it stands; `scenes/exterior.js` FLAGGED - the bench is offline: its fog's brass
stays 0 (`setBrass` never asked).

### SD20 - AUDIT SD III (the arc audited a third time)

Mac, 2026-10-07: *"So I want to do a deep comprehensive audit over everything, ensuring absolute polish and perfection.
This has to be the most beautiful, hardest and polished content to date."* Seven lenses over the arc as SD19 left it
(`dc0eb1bf`): the realm's scenes and how they render; its sound; the fight and its balance; the hosts' lifecycle; what
the player reads; the relay and the account; and the Delve arc's dungeons beside it. Each finding was reproduced by the
lens's own script on the arc's own code before it was fixed. Part one (`2cd80943`) was the merge's: the ten reds the
first full run of the suite on main's merge found - the detail arc (SD13-SD19) had never run in CI, the branch having
conflicted with main since SD13. The relay stays `world176`, re-hashed in place (undeployed).

#### SD20a - the fight

| | what was wrong | now |
|---|---|---|
| F1 | THE PULSE HAD NO CEILING. The table's own climb stays under the whole (its thirtieth Pulse 70%), but a Hollow's marks quicken and steepen it: the Underking's 22 s clock under the Restless Pulse's four points a step passed 100% of everyone's health eight minutes in - eight Hollows of every 216 (slots 2, 20, 43, 90, 96, 148, 160, 166) a wall a group at reference damage, needing nine minutes, could not pass | three quarters at most (`net/sdRemnant.js` `SD_PULSE_MAX`), the table's step and a Restless one on the wire (`pulsePctOf`) alike; the omen says so - *"Each Mantella Pulse climbs twice as fast, to three quarters of your health at most."* (SD20e T13's words) |
| F2 | A STEP OFF THE ARENA DODGED THE HOUR. The Concord's band lets go of the arena's near edge as of the Steps' far one, and a step back over it was a fall the Steps cast back to the Crumble's checkpoint - out of the arena, and so out of every blow of the whole arena, for the void's 15%: a 70% Mantella Pulse, the Reset or the End walked off a moment before it landed | THE ARENA HOLDS WHAT IT HAS TAKEN (`world/sdRealm.js` `arenaHolds`, `SD_ARENA_FLOORS`): joined to a living fight (`net/sdFightLink.js` `joined`) and standing inside the rim, the motor's edge is the disc alone - the near edge a rim. A fighter leaves the fight by its end, by death or by the way home (the unstuck word, SD10's `sdWayHome`) - never by the rim; anyone else walks the Concord's floors as before |
| F3 | A HIDDEN TAB, A FROZEN PAGE. A landing first seen late is not judged (the gate's law) - so a tab hidden across a Pulse's landing and shown again was never struck: Ctrl+Tab and back through 70% of everyone's health. And the relay's census read a fighter's LAST pose however old: a page frozen in the arena (a hidden tab draws and poses nothing) stood there for good - its share counted standing, and half a fight of it earned the receipt by `stood` | the whole arena's blows judged however late (`net/sdStrike.js`: a blow of the whole arena has no place a late frame could misjudge - a hidden page does not move - so where I stand when I first see it is where I stood when it landed, and it lands then, once; never on the Steps); the realm stamps an Hour's pose as it takes it (`pAt`), and the fight's census counts a body only while its pose is fresh (`SD_POSE_FRESH_MS`, 25 s - the pose heartbeat's 20 and five of grace; a closed socket's law past it: absent, its share out at `ABSENT_RETIRE_MS`) |
| F4 | THE END KILLED THE REFUSED. The Hour's End throws 99% every two seconds for half a minute, and a page that walked into the arena in that tail - its `in` refused, the fight closed to it - was struck dead by a fight it could never join: with one life a Hollow, its slot gone for good | a blow strikes a FIGHTER (`scenes/sdRemnantBlows.js`): a page the realm has not counted in its fight (`link.counted()`) is shown every blow and judged by none, nor by the brass |
| F5 | THE HARDENED HEARTS WERE A RACE NO PARTY RAN. Half again as much made the Hearts four and a half seconds of a party's reference damage of the seven and a half they stand - the run between them in the three left lost at every build the lens tried | a quarter again (`net/sdMarks.js` the Hardened Hearts, `heartX` 1.25): the Hearts at most half the time they stand open, the other half the run between them |
| F6 | A PULSE IN THE RESET'S RACE. The Pulse's clock ran through the Reset: one wound up inside the Hearts' eight-second race (a party running from Heart to Heart at 70% of its health) or landed on the heels of the Reset's own, and a Reset called inside a Pulse's wind-up lost its first seconds to it | two of the fight's no-save blows never one atop the other: a Pulse due inside a Reset waits until `SD_PULSE_CLEAR_MS` (4 s) past its landing, and its clock counts on from there; a Reset due inside a Pulse's wind-up waits for it to land |
| F7 | THE RIM WAS STOMP-PROOF. A body kept 18 m from the arena's centre, and a fighter hugging the rim (the arena's 26 m less its body's 0.35) stood 5.45 m past the Remnant's body and 5.95 past an Echo's - beyond the Stomp's 5: melee's punisher never chose the one place it could not reach | `SD_REM.keep` 19: the gaps are 4.45 and 4.95 - a lone fighter at the rim is stomped |
| F8 | A PILLAR'S TOP, HAND-PROOF. Fourteen metres up, a Levitate's reach, the top of a pillar was the one place the Hour-Hand never struck: the beam's shade is the pillar's square, and a body on its top stood inside it | a pillar shades only what stands below its top (`SD_PILLAR_OVER_Y`, half a metre under it): the verdict's `over` (`net/sdStrike.js`), the rig's feet (`scenes/sdRemnantBlows.js` `over()`) and the read's (`scenes/sdArenaRead.js` `sdPerilAt`, the world host passing the rig's) |
| F9 | THE HEARTS' FLOOR WALLED THE WEAKEST. Each Heart held at least 20: a lone fighter at level one or two (6-7 a second at reference) met three Hearts of 20 - ten seconds of its damage in the 7.5 they stand - and every Reset landed and healed: the Last Moment could not be won | the floor never more than one second of the living's damage (`heartHpFor`): a lone fighter's three are three seconds; a strong fighter's floor is 20 as ever |
| F10 | THE HOUR'S COSTS KILLED. The void's cast-back (15%) and the Orrery's lash took their share through `bypassShield` alone - the SetHealth(0) door, which no death save answers: with one life a Hollow, a setback was the end of it | both leave a body at one (`characters/playerEntity.js` `hurtPlayer`'s `spare`, the duel's floor): a setback, never the death that ends a Hollow |

Pins: `test/sd20a_fight.test.js` (10 - the Pulse's ceiling over a whole Restless Hour under the Underking; the arena
holding, its floors and the host's choice by its own text; the whole arena's blows judged however late; a frozen page
absent from the relay's census and back at its next pose; a blow strikes a fighter; the Reset's race - the Hardened
Hearts' share of their window, a Pulse deferred, a Reset waiting, eight minutes of a Last Moment with neither atop the
other; the rim stomped; a pillar's top in the verdict, the rig and the read; the Hearts' floor; the void and the lash at
one, through the real `hurtPlayer`); `tools/mutants/sd20a.json` (30, all dead). RE-AIMED BY CONTENT, each still dead:
`sd5a.json` (`SD5A-the-edge-lost`), `sd6c.json` (`SD6C-the-lash-shielded`, `SD6C-the-edge-never-widened`), `sd7b.json`
(`SD7B-world-the-shield-takes-it`), `sd8a.json` (`SD8A-the-pulse-unchanging`, `SD8A-the-reset-never`), `sd8d.json`
(`SD8D-the-pillars-shade-forgotten`, `SD8D-the-arena-reaching-the-steps`), `sd11e.json` (`SD11E-C2-struck-on-the-steps`),
`sd15.json` (`SD15-the-shade-ignored`, `SD15-the-beams-past-read`). PINS MOVED: `test/sd5a_realm.test.js` and
`test/sd6c_hall.test.js` (the arena's edge, the held rim first), `test/sd8a_remnant.test.js` (the Hearts' floor),
`test/sd8b_fight.test.js` (the relay's import), `test/sd11e_laws.test.js` (the whole arena's blow, judged however late),
`test/sd15_read.test.js` (the read told `over`; its stub link a fighter's), `test/sd18a_marks.test.js` (the Hardened
Hearts a quarter again), `test/relayversion.test.js` (`world176` re-hashed in place).

THE FOUR HOSTS: `scenes/world.js` WIRED (the held arena, `sdArenaHeld` and `_realmArenaHeld`; the cast-back and the lash
at one; the read's `over`); `scenes/worldModes.js` FLAGGED - the mode machine casts back and rides the Steps as before
(SD7b), and the arena's edge is the world host's motor arena; `scenes/dungeonContext.js` FLAGGED - the realm's floors and
the blows' rig are the world host's, the dungeon host stands the Hour's level alone; `scenes/exterior.js` FLAGGED - the
`?exterior` bench is offline, and there is no Hour offline.

#### SD20b - the relay and the account

| | what was wrong | now |
|---|---|---|
| R1 | A WORD AHEAD OF THE HUB POISONED THE CELL. A cell keeps the slots it has told and the hub answered (AUDIT SD II, L7 M4), and a slot told AHEAD of the hub's - a guest's word for the next Hollow, said at its pixel's centre before it rose - was kept with them: once that Hollow rose there, its real find was never told from that cell (an hour of an honest finder's words at the door, dropped; a fresh cell instance alone forgot) | a slot ahead of the hub's own is never kept as told (`_sdTellHub`): its Hollow had not risen, and the hub's answer judged nothing of it |
| R3 | THE NEW HOLLOW HELD NINE MINUTES. While the hub's last answer is fresh (`SD_FIND_KNOWN_MS`, ten minutes) a cell tells no other slot's find - and a word for the old slot told a minute before the rise held the new Hollow's every find at that door for nine minutes | the hub's answer says when the next may rise (`next`, its record's not-before), and from then the next slot's find is told; a slot two ahead is held as ever |
| R2 | ONE LIFE LAPSED AT 256. The realm's list of the dead stopped recording at `SD_FIGHTERS_MAX`: 256 guests (a click each) walked in and died, and the 257th account died and came straight back | past the list each death is kept under its account's own key (`net/wire.js` `sdDeadKey`), read at the door once the list is full |
| R4 | THE HONOURS WERE READ BEFORE THEY WERE CLAIMED. Hourbreaker and The Turning Hour were rolled off the receipt's seed, which the page holds: a guest computed its roll before it registered, and could register only the accounts whose receipts rolled both | rolled at the claim off four bytes the service draws (`server-account/src/sds.js` `claimSd`): nothing the page holds beforehand decides them. The row's nonce law is unchanged - the first write's roll is the one the account holds |

The relay stays `world176`, re-hashed in place; the account service stays `acct94` (both undeployed - the arc's own).

Pins: `test/sd20b_relay.test.js` (4 - a premature word for the next slot and the real find after the rise; the next
slot told from `next`, two ahead held; a death past the list refused at the door; the honours the claim's own draw);
`tools/mutants/sd20b.json` (8, all dead). RE-AIMED BY CONTENT, each still dead: `sd11b.json`
(`SD11b-L7M4-the-hubs-slot-unread`), `sd12_onelife.json` (`SD12-ONELIFE-unread-at-the-door`, `SD12-ONELIFE-twice-over`),
`sd9b.json` (`SD9B-the-guest-counted`). PINS MOVED: `test/sd9b_claim.test.js` (the claims roll by their own draw - a
`rand` that answers the claim's four bytes with a chosen seed; the worker's claim under a mocked draw),
`test/relayversion.test.js` (`world176` re-hashed in place).

THE FOUR HOSTS: none wired - the relay (`server/src/index.js`) and the account service (`server-account/src/sds.js`)
alone. `scenes/world.js`, `scenes/worldModes.js`, `scenes/dungeonContext.js` and `scenes/exterior.js` FLAGGED: a cell's
tell, a realm's door and a claim's roll are the servers' - no host reads them differently.

#### SD20c - the Hour seen

| | what was wrong | now |
|---|---|---|
| V1 | THE SPARKS RESTED IN THE AIR. The gate's spark pass rests a burst's spent sparks on the `floor` the burst says, and at its own height when it says none: eleven of the Hour's seventeen kinds said none - the Pulse's, the Hearts', an Echo's, the stun's, the fall's - and their spent sparks lay on unseen panes 1.2-4.4 m in the air | every burst on the arena's floor (`scenes/sdFx.js` `SD_FX_FLOOR_Y`, the dungeon's frame) |
| V2 | THE BEAM PASSED OVER THE HEADS IT STRUCK. The Hour-Hand's light ran from the hand 5.9 m up to a metre over the floor at its reach, 0.55-1.6 m across; the law strikes a band 3 m across on the ground, from its body out to 34 m - a fighter it struck stood under the light, outside its width | the band it sweeps laid flat on the floor (`render/sdBeam.js` `uFlat`: from its body's rim to its reach, the law's width across, level and never narrowed or widened by the eye, its rims bright - `scenes/sdRemnantRig.js` `sdBeamsAt`'s `f0`, `f1`, `w`); the light out of the hand falls to the floor `SD_BEAM_DROP_M` (6 m) past the hand's own reach (`SD_BEAM_FLOOR_Y`) |
| V3 | THE LIGHTS STOOD INSIDE THE STONE. The Ending's stone light stood at its slab's foot-centre 2.4 m up - inside the solid stone, a hand's breadth under its cap, the face it was to light the one place it never reached; the Hour-Hand's flash stood at its chest a metre up, inside the Remnant's heart crystal | the stone's light 0.6 m before its face at its dial's height (`ui/sdMarksView.js` `SD_STONE_LIGHT`, `world/sdHall.js` `stonePoint`); the Hand's flash `SD_HAND_FLASH_OUT` (1.2 m) out of its chest along the beam's first bearing |
| V4 | THE WHOLE ARENA'S SHAKES SHOOK THE HALL. A blow of the whole arena - the Pulse, the Reset, the End, the fall, the wake - shook every camera in the Hour, the Hall's and the Steps' too, where it strikes nobody | felt on the arena alone (`felt`: within its rim and the law's slack, `SD_ARENA_SLACK`); a blow with a reach shakes by its nearness wherever I stand, as the gate's landings do |
| V5 | A FRAME OF THE FIGHT MADE KILOBYTES. Measured in a child (a 64 MB young space, the least of six windows): the arena read with a blow over my feet 10.7-32 KB a frame (each place of its way out's walk a call through a closure that boxed its numbers, and `Math.hypot`'s builtin its own), a Volley's mark 3 KB more (its walk's metres stepped by adding, a number that boxed itself every step), the beam 3.4 KB, the gears 1.7 KB, the Hour's lines past the cap 1.4 KB, the stone's light 1.1 KB, the blows seen 0.5 KB, the set 0.24 KB | the read walks its own sums - one plain walk a shape, the Hand's ground in plain numbers (`scenes/sdArenaRead.js` `handSweepOf` and `handSweepHas`, pinned equal to the law's `handSwept` and its shade), each walk a whole count of steps; the law's `behindPillar`, `keepInArena` and `inArena` in plain numbers (in the relay's bundle: `world176` re-hashed in place); the beams, the gears and the Hour's lights into lists kept and filled in place (`scenes/sdRemnantRig.js` `sdKeptList`), the stone's light, the bodies' places and each landing's light into kept records. Now nothing a frame for the blows seen, their lights, the Hour's lines, a body's walk, the keep, the pillars and the floor; 16 B the stone's light; 40-370 B the read under a blow; 0.3 KB the gears, 0.5 KB the beam and its pass, 0.14-0.4 KB the set |
| V6 | THE BODIES SNAPPED. Each body faced each new aim in a frame - up to 120 degrees at once; it dropped its 1.6 m kneel in a frame and stood from it in one; a lost fight's Remnant stood at its start at once | its drawn facing turned toward the law's at `SD_TURN_RATE` (3.5 radians a second, the short way round - a half-turn in 0.9 s, inside the quickest wind-up of a blow that needs its facing, so the drawn facing is the law's by any landing; `scenes/sdRemnant.js` `sdTurnToward`); the kneel eased down and up over `SD_KNEEL_EASE_MS` (400 ms); a lost fight's Remnant sinks where it stood and rises at its start, and an Echo standing as the fight is lost sinks where it stood |
| V7 | THE MOTES WOUND THE WRONG WAY. The Hour's motes run against the clock and the hall's dust with its stones - and both turned the other way round on every screen: the pin read the raw angle, and the camera's one mirror (`world/mat4.js` `mirrorProjectionX`) turns it | both senses flipped, the JS and the GLSL alike (`render/sdMotes.js`); the pin measures each as the eye sees it, through the game's own camera |
| V8 | THE BRASS AIR MET THE SKY A STEP APART. SD19 graded the land's haze toward the brass near a standing Hollow and left the sky as it was: at the skyline the fogged land met the sky a step apart - 15/-4/-34 on a clear noon's horizon, 23/-6/-48 under an overcast dusk | `world/sdBrassSky.js`: one ramp - its JS for the haze and the water's sky (`systems/sdOmen.js` re-exports it, SD19's door), its GLSL generated from the same stops for the four passes that draw the sky (the classic, the enhanced, the dynamic skies, the clouds' composite), each grading its final colour by its own `uBrass` after the dread's; `scenes/shared.js` `setBrass` tells each pass its weight |
| V9 | A BUSY MOMENT PUT OUT THE LAMPS. Past the frame's sixteen lights the Hour's own - the spoils', every landing's flash, the stone's - went first, and in a busy moment the lamps nearest the player went dark | sorted in with the lamps by how far the eye stands outside each one's reach (`world/sdRealm.js` `SD_LIGHTS_CAP`, `realmLightsWith`) |
| V10 | THE HEARTS AND THE BRIDGE POPPED. The Hearts the Reset's landing spent left the air with nothing to show for it; the Concord's bridge stood whole in a frame | the spent Hearts burst as they go (`scenes/sdFx.js`); the bridge laid out across the void from the hall's rim over `SD_BRIDGE_LAY_MS` (900 ms), easing in (`scenes/sdHall.js` `bridgeLayMatrix`) - one that held before I came stands whole |
| V11 | IT POINTED WITH ITS LEFT. The Remnant's right arm and leg were built at -x - the side its own left shows on through the camera's mirror: every screen saw it sweep the Hour-Hand with its left hand | its right at +x (`world/sdRemnantModel.js`; `scenes/sdRemnantRig.js` - its joints, its hands, each arm rolling out to its own side) |
| V12 | THE GEARS FLEW FLAT. The Volley's gears flew flat to the arena's z whichever way they were thrown | on edge along their flight, rolling forward (`gearMatrix`'s `yaw`, `sdGearsAt`'s bearing) |
| V13 | THE PASSES COMPILED MID-FIGHT. The beam's, the sparks' and the floor's telegraph's programs were each built on their first use - a stall in the frame its first blow landed in | built as the Hour is first stood in (`scenes/world.js` `_sdPassesWarm`; `warm` on the blows seen and the blows' driver), a pass that will not build tried once |
| V14 | REVERSED SMOOTHSTEP. GLSL leaves `smoothstep(a, b, x)` undefined for a >= b: the beam's ends, the Hour's shards and its clock - and ten more across the port: the Deadlands' horizon and channels, the enhanced sky's near horizon (and its CPU twin), the gate veil's sparks, the ink dungeon's hatching, the sun baby's skin, shadow and horns | every one rising, its fall written `1 - smoothstep(...)` - the same curve |
| V15 | THE BRASS LIGHT MADE A LIST. `sdBrassLight` made a new list every outdoor frame, near a Hollow or not | at nought the light handed in is handed back (`systems/sdOmen.js`) |

SAID SO, and left: while a blow is in flight the rig's own numbers (a walk, a blow's pose) and the read's answer make a few
hundred bytes a frame - numbers boxed across the rig's calls, and the answer's own three objects; a young space takes them
in a scavenge no frame notices.

Pins: `test/sd20c_render.test.js` (12 - every burst on the floor and the gate's pass reading it; the whole arena's shakes
on the arena, a reach's anywhere; the band drawn rim to reach at the law's width, run on the vertex stage itself, its
uniform's precision one; the turn, the short way round, and the lost fight's bodies where they stood; the gears on edge,
rolling forward; the brass GLSL equal to its JS on the GLSL evaluator and every sky pass grading by it; no reversed
smoothstep in any module or in the Hour's shaders as built; the brass light at nought; the passes built as the Hour is
stood in, tried once; the lights sorted in by their reach's edge; the read's plain-number law equal to the law's over
20,000 places and moments, its ways out to `sdWayOut`'s; a frame of the fight measured in a child, each path under its
bound); `tools/mutants/sd20c.json` (53, all dead). RE-AIMED BY CONTENT, each still dead: `event1.json`
(`EVENT1-composite-premultiplied`), `sd11a.json` (`SD11A-L2F9-the-remnant-pose-made`, `SD11A-L2F9-the-echo-poses-made`),
`sd14c.json` (`SD14c-the-orbit-with-the-clock`, `SD14c-the-shader-off-the-law`), `sd15.json` (`SD15-the-disc-unread`,
`SD15-no-way-out`, `SD15-the-ring-never-called`, `SD15-the-shade-ignored`, `SD15-the-beams-past-read`,
`SD15-the-echoes-unread`, `SD15-the-latest-of-two`, `SD15-the-pulse-in-it`), `sd16.json` (`SD16-a-landing-seen-twice`,
`SD16-a-landing-seen-however-late`, `SD16-the-hand-at-its-feet`, `SD16-the-last-heart-unseen`,
`SD16-a-heart-broken-every-frame`, `SD16-a-fall-seen-however-late`; and `SD16-hearts-broken-by-the-reset`, renamed
`SD16-hearts-spent-by-the-reset-unseen` - what it made is the law now, so it puts back the stun's gate), `sd17.json`
(`SD17-the-arms-off-the-torso`, `SD17-the-right-arm-rolls-inward`, `SD17-the-legs-swapped`, `SD17-the-beam-never-fades`,
`SD17-gears-not-from-the-hands`, `SD17-gears-flat`, `SD17-the-beam-through-pillars`, `SD17-the-gears-never-flown`,
`SD17-the-beam-writes-depth`), `sd18a.json` (`SD18A-the-read-the-tables`), `sd18b.json` (`SD18B-the-stone-the-first`,
`SD18B-no-stone`), `sd19.json` (`SD19-sky-brass-unclamped`; `SD19-the-grade-one-brass`, `SD19-the-grade-unweighted` and
`SD19-the-grade-in-place`, moved with the ramp to `world/sdBrassSky.js`), `sd20a.json` (`SD20A-F8-the-read-shaded`),
`sd6c.json` (`SD6C-the-bridge-never-laid`), `sd8a.json` (`SD8A-no-shade`), `sd8c.json` (`SD8C-no-kneel`,
`SD8C-an-echo-unscaled`), `sd9e.json` (`SD9E-unlit`), `wb6a.json` (`WB6a-the-horizon-not-the-skys`). PINS MOVED:
`test/sd14c_motes.test.js` (each sense through the game's camera), `test/sd16_fx.test.js` (the Hand's flash out of its
chest, the fall's feet on the arena, the spent Hearts' burst, the Hour's lights into one kept list),
`test/sd17_body.test.js` (its right at +x, the band and the light's drop, the world's kept beams), `test/sd18b_seen.test.js`
(the stone's light before its face, into the world's kept light), `test/sd19_presence.test.js` (`setBrass` telling the sky's
passes), `test/event1_live_event.test.js`, `test/enhancedSky.test.js`, `test/sunbaby1_event.test.js` and
`test/weather3d_distantstorms.test.js` (each sky pass's final colour, the brass after the dread; the water's sky),
`test/sd8c_remnant_page.test.js` (the kneel eased), `test/sd9e_spoils.test.js` (the Hour's lights composed into the kept
list), `test/sd11a_scenes.test.js` (the lights sorted in past the cap), `test/sd11c_page.test.js` (its harness's warm
flag), `test/sd6c_hall.test.js` (the bridge laid), `test/audit39_render.test.js` and `test/wb6a_deadlands.test.js` (the
rising edges), `test/relayversion.test.js` (`world176` re-hashed in place).

THE FOUR HOSTS: `scenes/world.js` WIRED (the passes built as the Hour is stood in; the Hour's lights, the stone's light
and the beams into kept lists; the read's feet); `scenes/worldModes.js` FLAGGED - the mode machine draws none of the Hour's
passes; `scenes/dungeonContext.js` FLAGGED - the realm's set and its draws are the world host's, the dungeon host stands
the Hour's level alone; `scenes/exterior.js` FLAGGED - the `?exterior` bench draws the sky's passes, which take the brass
weight the controller sets (none there: there is no Hollow offline).

#### SD20d - the Hour heard

| | what was wrong | now |
|---|---|---|
| A1 | THE STREET'S SONG IN THE RIFT. A Rift's step forces the world outside while it walks to the Hollow's pixel and builds the realm (`sdEnterRealm`, `stepThroughFire`), and the Hour let the music go there: the director's song came up between the Hollow's and the hall's, cut both ways | the Hour holds the music while a step through the fire or a door's build moves the world under its veil (`scenes/worldModes.js` `stepping`, `transitioning`); then the hall's song takes the Hollow's as one song takes another |
| A2 | THE END SOUNDED WHOLE EVERY TWO SECONDS. After its first landing the law strikes the whole arena every `SD_END_EVERY_MS` until the fight is lost, half a minute, and each strike sounded whole - its roll, its toll and its fire: forty-five cues, the Remnant growling through them | heard whole once; each strike after it a knell - a third of its toll (`net/sdFightLink.js` `sdEndAgain`; `scenes/sdRemnantVoice.js` `knell`), no roll and no fire; no growl once the Hour has ended |
| A3 | THE BEDS STUTTERED. The Hour's four beds rode `setLoop`'s re-armed one-shot - a gap of the main thread's dispatch at every seam - and the void was one moan looped, the same swell in the same place every 5.8 s | named beds the engine loops (`systems/audio.js` `setBed`, `setBed3d` - the Audio record); all four MADE - the void the deep moan laid over itself at a spread of low pitches round 23 s (`buildVoidWind`), the gears the grind round 13 s (`buildArenaGears`) - each darkened as a loop (`lowpassLoop`), as the works, the hum and the Rift's bell now are; the Deadlands' beds on the same doors |
| A4 | EVERY SCORE CUT. The Hour's, the court's and the arena's scores let the music go with `music.stop()` - a song cut at its level | each fades it (`music.fadeOut`), and the director's song comes up as the fade ends |
| A5 | THE WAR OVER THE DEAD. One life a Hollow, and as a player lay dead in its arena the war song played on and the Remnant growled, stepped and barked at the body | the score fades to nothing while I am dead; the Remnant's voice is framed for the living alone |
| A6 | A PAGE BACK HEARD EVERYTHING AT ONCE. A tab put away while the fight turned sounded every turn it missed - the Dragon Break, the Last Moment, the stun - on its first frame back | a fight unheard `SD_VOICE_AWAY_MS` (4 s) is taken again as it stands, in silence - as a blow's landing seen late always was; a hitch shorter than that still hears its turns |
| A7 | THE RIFT'S BELL ASKED ONCE. Asked for as the Rift stood, and a Rift stood before the archive was read or a context stood (no gesture yet) stood silent for good | asked again each `SD_BELL_ASK_MS` (1 s) while it stands without one (`scenes/sdEnd.js`), its toll built once (`systems/sdRiftSound.js`), faded as the dungeon goes |
| A8 | TWO NOTES AS ONE. The Last Moment's and the last minute's war kit crashed on the songs' own crashes, and a theme's note fell on its bar's own chord tone - thirty-three doubled note-ons in the Hour's nine songs (twenty-five in the Warden's) | the song writers merge a note laid where the same voice strikes it into one note, its loudest and longest (`systems/sdScore.js`, `systems/gateScore.js`) |
| A9 | A THIRD CLOCK OVER THE BEAT. The Hour's works ticked the Steps' own clunk at the Beat's own pitch (1.6), a second apart, where the Beat's half beat - the time a jump is taken by - is 1.8 s | the works' tick and tock are their own pitches (`SD_WORKS_TICK`, 0.8 and 0.6 - under the Beat's, apart from the hall's turns), and on the Beat's span the works duck to a quarter, eased in and out |
| A10 | THE SONGS FLICKERED AT THE ARENA'S REACH, AND THE END WAS THE ARENA'S ALONE. A step back and forth at the bar's reach switched the war and the Steps' song every few strides; and the Steps and the hall played their own songs to the End's last toll | a place's song holds `SD_SCORE_HOLD_M` (4 m) past the edge it began at (`sdScorePlace`'s `was`); the Hour's last minute and its End are the whole Hour's (`hourScoreFor`) |
| A11 | THE WORKS BUILT EVERY FRAME. With the archive read and no context to make them on, the works and the hum were built anew every frame - 2.2 ms | built once; only the registration is asked again |
| A12 | THE HEARTS A LANDED RESET TOOK, UNHEARD. A Reset that lands breaks no Heart (SD11d), and the ones left standing went in silence while they burst in its light (SD20c, V10) | each rings low as it goes, live - the crystal's ring, never its shatter (`scenes/sdRemnantBlows.js`); a stun heard late still shatters nothing |

Pins: `test/sd20d_audio.test.js` (12 - the Hour's song held through the veil, from the world host's own text; every
score let go by a fade; no war over the dead; the place's hold and the whole Hour's End; the End whole once and its knells
over a whole half minute; a page away hears nothing it missed; the Hearts a landed Reset takes; the named beds on a fake
context - looped by the engine, kept, live, risen, faded, moved; the made beds, their seams and their one build; the
works under the Beat; the Rift's bell asked until it stands; no note struck twice as one in either score);
`tools/mutants/sd20d.json` (38, all dead). RE-AIMED BY CONTENT, each still dead: `field_wind1.json`
(`FIELD-WIND1-engine-pitch-dead` - `loop`'s own door, by its comment), `sd11d.json` (`SD11D-the-last-unheard`,
`SD11D-a-late-stun-shatters`), `sd13.json` (`SD13-music-over-the-end`, `SD13-no-last-minute`,
`SD13-the-arena-by-its-rim-alone`, `SD13-the-steps-from-the-hall`, `SD13-the-score-never-let-go`,
`SD13-the-hollow-unheard`, `SD13-the-place-askew`), `sd14a.json` (`SD14a-no-release`, `SD14a-never-framed`,
`SD14a-the-growl-while-striking`), `sd14b.json` (`SD14b-no-tock`, `SD14b-one-left-looping`,
`SD14b-the-gears-never-stood`, `SD14b-the-hum-bright`, `SD14b-the-old-air-left`), `sd4b.json`
(`SD4B-the-bell-undarkened`), `sd8d.json` (`SD8D-no-landing-heard`, `SD8D-the-wind-up-unheard`), `wb6b.json`
(`WB6b-stop-leaves-a-bed-looping`), `wb7.json` (`WB7-the-courts-song-left-playing-outside`). PINS MOVED:
`test/sd13_score.test.js` (the host's harness - the living, the step, where I stood; let go by a fade, counted),
`test/sd14a_voice.test.js` (the knell among the cues; the voice framed for the living; a growl's wait framed - one step
that long is a page away), `test/sd14b_air.test.js` (the beds named native loops, all four made, nothing before the
archive), `test/wb6b_deadlands_life.test.js` (the Deadlands' beds named native loops), `test/wb7_boss_audio.test.js` (the
court's song let go by a fade).

THE FOUR HOSTS: `scenes/world.js` WIRED (the Hour's score held under the veil, faded, silent over the dead, where I stood
remembered; the court's and the arena's faded; the voice for the living); `scenes/worldModes.js` WIRED (`stepping`, the
step through the fire's own flag); `scenes/dungeonContext.js` FLAGGED - the Hour's sound is the world host's and its
air's, the dungeon host stands the Hour's level; `scenes/exterior.js` FLAGGED - the `?exterior` bench has no Hour, no
court and no arena bout, and its music is the director's alone.

#### SD20e - what the player reads

| | what was wrong | now |
|---|---|---|
| T1 | THE DOOR'S BANNER RAN OFF A PHONE. *"The Hollow Under Glenpoint Foothills - an Abyss Dungeon - fades in 1d 04h"* on one line (`white-space: nowrap`) ran off both sides of a 390 px screen | the banner says its name and its state (`systems/sdOmen.js` `sdBannerText`) - what it is is the card's, beside it; it wraps inside the screen (`ui/gateBanner.js`, `max-width: calc(100vw - 32px)`) |
| T2 | THE TITLE CARD ON THE BAR. On a phone held upright the Hour's card stood at 30%, on the Remnant's bar's foot and its chips; held sideways the way out's chevron rode its 72 px ring onto the bar's plate | upright, the card under the bar's foot (`ui/sdTitleCard.js`, 40%); sideways, at 46% with the foot's chips stepping aside while a beat stands, and the chevron on a 36 px ring (`ui/gateGroundView.js` `PERIL_ARROW_R_LOW`) |
| T3 | AN ABYSS DUNGEON IN DAGON'S RED. Its door's banner and the Hour's marks card - at its door and in the Hour - wore the gate's red, the omens' signs the gate's orange | the Hour's brass: the banner's `look` (`SD_BANNER_BRASS`, outlined on the Plus skin as the gate's is), the card's (`sdMarksCardModel`'s `look`, `ui/gateMarksView.js`'s `sd-brass`), the omens' signs in it |
| T4 | THE HOUR'S CARD IN THE SERIF. On the Plus skin the gate's title card wore the HUD's face; the Hour's stood in Cormorant, the one readout of the fight's that did | `ui/enhancedPlusStyle.js`'s `.sd-title-*`, the HUD's face in the Hour's brass and light |
| T5 | THE ECHO'S CALLOUT CAME IN EACH SECOND. *"Gold rises in 12s"* - the bar brings a callout in afresh when its head changes, and the count was in the head | *"Gold rises - 12s"*: the count after the dash, as every countdown the bar calls (`ui/sdRemnantBar.js`); the chip keeps *"rises in 7s"* |
| T6 | TWO COUNTS OF TIME. The Rift's plaque counted *"Fades in 46h 12m"* beside the banner's, the card's and the Timers row's *"fades in 1d 22h"* | the plaque in the Timers' own words (`world/sdDungeon.js` `sdRiftCount`, `timerText`) - its own count (`sdLongCount`) gone |
| T7 | THE RING'S CARD UNREACHABLE. A found Hollow stands two to four pixels out from its city; at a far zoom the city's mark (16 px of reach) took the whole of its ring, and its card answered nowhere; and a ring at a far zoom answered only its map radius, not all the paper draws of it | a ring's centre nearer the pointer than the nearest mark answers as the ring (`ui/heldMap.js` `_ringCoreAt`), and a ring answers all it is drawn over (`ui/inkMap.js` `GATE_RING_MIN_PX`, 10 px) |
| T8 | THE PAGE PROMISED *ELITE DUNGEON* ON THE HELD MAP. Section 12 listed the held map among the tier's surfaces with *(Elite Dungeon, Small)*, and ABYSS-NAME among the Abyss tier's - but its marks are the Bay's own places: an Elite spawn has none, and a Hollow is its ring | section 12 says so - the held map's phrase is a Regular Dungeon's, a Hollow's word its ring's card |
| T9 | THE DRAGON'S TWO NAMES. The Blades' signature, *the Dragon's Break*, stood one apostrophe from the phase it shapes, *the Dragon Break* | *the Dragon's Haste* (`net/sdMarks.js`) |
| T10 | THE GATE'S WORD FOR THE HOUR'S FALL. The Remnant fallen, the bar said the Warden's *Felled* | *Undone* - the Hour's word (`SD_BAR_TEXT.undone`, the bar's `fallenText`); the gate's bar keeps *Felled* |
| T11 | CAPITALS INSIDE THE LINE. *"... keeps the Ending of the Blades - The Dragon's Break - under The Quickened Gears and The Hardened Hearts."* | each mark's article small inside it (`sdMarksLine`, `net/sdLaw.js` `sdNameIn`) |
| T12 | A RUMOUR TURNED TOWARD NOTHING. The Underking's: *the dead in their barrows turn their heads toward it* - toward what? | *toward the walls* |
| T13 | THE RESTLESS OMEN GARBLED. *"Each Mantella Pulse climbs twice as steeply - to three quarters of your health."* | *"Each Mantella Pulse climbs twice as fast, to three quarters of your health at most."* |
| T14 | THE WINDOW SAID FOUR WAYS. The beat's sub, the Blades' tip and omen, and the turn's line (*"Strike down the Gold and Silver Echoes together"* - "together" said no window) | one form, by the fight's own window: *"Fell Gold and Silver within N seconds of each other"* - the beat (`sdBreakSub`), the tip, the omen, and the turn's line (`SD_FIGHT_TEXT.dragonBreak(pairMs)`, the Blades' ten) |
| T15 | THE CODE'S WORD TO THE PLAYER. The readouts, the way home, the way back, the death and the cast-out said *the Hollow* - the code's word - to a player who reads *Abyss Dungeon* (ABYSS-NAME); and the readout said an unbeaten end *closes* where its banner, ring, notice and Timers say it *fades* | the Abyss Dungeon throughout (`scenes/sdHost.js`, `scenes/sdEnd.js`, `world/sdRealm.js`, `net/sdLaw.js` `SD_CAST_OUT_LINE`); *"The Abyss Dungeon fades in 0:30."* - in the Hour, *"The Hour closes in 0:30."* |
| T16 | THE FEATURES ROWS READ AS SLIPS. *"Smaller dungeons wins when both are on, this over medium"*; the world-sizes row left out that a quest keeps its size; *"switching to Info mode"* (asking again works); *"its World Tooltips label says which way a lever works"* | said plainly (`systems/features.js`): *"If Smaller dungeons is on too, it wins; this row wins over Medium dungeons. A quest keeps the size it was set up at."*, *"selecting Info mode"*, *"a lever's World Tooltips label says which way it works"*. The title *Dungeon sizes as online* stays - "Online dungeon sizes" would read as a switch for online play |
| T17 | AN OMENS' LINE NEVER DRAWN. The bar's model handed it `trials`, and this page said "under the bar, the row and the omens' line" - the bar draws the row alone | the row alone, the page and the model (`sdOmensLine` gone) |
| T18 | THE HOUR'S READOUTS UNDER THE VEIL. Stepping into the Hour, the bar and the marks card drew under the veil (the court's hide there), and the card's nine seconds ran out beneath it - met half gone | hidden under it as the court's are, and the card's nine seconds from the veil's opening (`scenes/world.js`) |
| T19 | A REGION AFTER "NEAR". With no city known, the find and the last hour said *"near Alik'r Desert"* - the region's bare name | *"in the Alik'r Desert region"* (`net/sdLaw.js` `sdWhere`, the find's and the last hour's one door) |
| T20 | *Abyss* is also in Ocean Holes' names (`world/oceanHoles.js`) - REPORTED to Mac, unchanged: the name is the player's word, and his to give | - |

The relay stays `world176`, re-hashed in place (undeployed): its bundle carries `net/sdLaw.js`'s and `net/sdMarks.js`'s
words and never sends them.

Pins: `test/sd20e_text.test.js` (12 - the banner's words, wrap and brass, by its own draw and the world's ask; the card's
brass, its class and its signs, the gate's kept; the title card's places and the foot stepping aside, the chevron's ring,
the Plus skin's card; the callout's still head, *Undone* drawn and the gate's *Felled*; one count of time over a sweep of
times; the ring's centre and drawn reach on a real held map; the Dragon's names and the window's one form; the lines said
plainly over every slot's marks; the player's word in every line; a region as a region; the Features rows; the readouts
waiting for the veil, run from the world host's own text); `tools/mutants/sd20e.json` (41, all dead). RE-AIMED BY
CONTENT, each still dead: `eventtip.json` (`EVENT-TIP-a-square-ring`), `sd11c.json` (`SD11c-G13-no-Hollow-no-region`),
`sd11d.json`
(`SD11D-the-chip-says-fallen`, `SD11D-the-old-dragon-break`, `SD11D-the-fade-in-the-hollows-words`), `sd11f.json`
(`SD11f-the-hours-by-the-second`, `SD11f-the-minutes-rounded-down`, `SD11f-the-collapse-uncounted`), `sd18b.json`
(`SD18B-no-row`), `sd19.json` (`SD19-the-banner-nameless`, `SD19-the-banner-stateless`, `SD19-the-marks-line-one-omen`,
`SD19-world-door-over-the-gate`), `sd20a.json` (`SD20A-F1-the-omens-old-words`), `sd8c.json` (`SD8C-the-turns-unsaid`),
`wb1.json` (`WB1-the-ring-lost-at-the-far-zoom`). PINS MOVED: `test/auditwb_world.test.js` and
`test/sd19_presence.test.js` (the banner's look; its words, the marks line's articles, the last hour's region),
`test/sd10_collapse.test.js`, `test/sd1_sdlaw.test.js`, `test/sd2d_castout.test.js`, `test/sd5a_realm.test.js` and
`test/sd12_onelife.test.js` (the player's word), `test/sd11a_scenes.test.js` and `test/sd11c_page.test.js` (the veil
in the fight frame's harness; the death's words; the region as a region), `test/sd11d_words.test.js` (the callout's
count after the dash, the fade's words, the Dragon Break's window), `test/sd11f_scenes.test.js` (the Rift's count in the
Timers' words), `test/sd18a_marks.test.js` (the callout), `test/sd18b_seen.test.js` (no omens' line; the card's clock
from the veil; its brass), `test/sd20a_fight.test.js` (the Restless omen's words), `test/sd8c_remnant_page.test.js` (the
Dragon Break's window; the hide under the veil), `test/features.test.js` (the notes' ceiling, +57 - the growth and no
more), `test/relayversion.test.js` (`world176` re-hashed in place).

THE FOUR HOSTS: `scenes/world.js` WIRED (the banner's brass asked for a Hollow's door alone; the Hour's readouts under
the veil and the card's clock from its opening); `scenes/worldModes.js` FLAGGED - the mode machine says nothing the
player reads of the Hour but through the world host's and the dungeon host's words; `scenes/dungeonContext.js` FLAGGED -
the dungeon host stands the Rift and the way home, whose plaques' words are `world/sdDungeon.js`'s and `scenes/sdEnd.js`'s;
`scenes/exterior.js` FLAGGED - the `?exterior` bench is offline: no Hollow, no banner, no Hour.

#### SD20f - the hosts and the lifecycle

| | what was wrong | now |
|---|---|---|
| H1 | ONE LIFE A HOLLOW WAS THE DEVICE'S. The Hollows I died in (and the ones I went through) were kept under one key for the whole device, read once at boot: one account's death refused another account on the same device a Hollow its realm would admit (the realm keeps its dead by the token's account), and a second tab wrote its boot-time copy back over the first's | kept under the signed-in account's own key (`scenes/world.js` `sdSlotsKept`, `<key>:<id>`; with no session the device's, as it was), read as it is asked - another tab's write merged, never written over - and a read the store has not changed not parsed again |
| H2 | eight host pins red on the merge | fixed in part one (`2cd80943`) |
| H3 | THE FOUR HOSTS RULE BROKEN FOR TWELVE RECORDS. SD-ONELIFE and SD13-SD19 wire the world host and the dungeon host and said so nowhere; section 15's table named none of their seams | each record says its four hosts; section 15's table carries their seams, and section 16's table the slices since SD10 |
| H4 | THE CAST-OUT LATCHED ONCE A SLOT. The end casts me out and the exit is taken a frame later; a death in that frame (a lethal landing) drops it, and a party's Resurrect raised me where I lay - in an ended Hollow no frame would cast me out of, its slot latched as done | once a STAY (`scenes/sdHost.js`): asked again while I still stand there `SD_CAST_OUT_AGAIN_MS` (2 s) on, never sooner; the stay over as I stand nowhere it could cast me out of - back in by its door while it is still listed, I am cast out at once |
| H5 | THE WAY OUT'S WORDS LET GO. The first frame outside the Hour let go of everything waiting to be said: *"The way home carries you out of the Hour..."* waits behind *"The way home stands open."*, and a press inside its second and a half lost it unread - the cast-out line too, behind any turn standing | leaving lets go of the Hour's readouts and the floor's notes alone (`scenes/sdVoice.js` `leave`); its turns, the way out's words among them, still come in their order |
| H6 | A RIFT STEP SPENT UNDER ANOTHER'S VEIL. A step under way refuses a second (the mode machine's one at a time), and the Rift took the refusal as entered: walked into during the way back's landing (its veil still opening) its walk-in was spent, nothing said, the Rift dead under my feet | the world answers "not yet" (null) while a step is under way (`sdEnterRealm`, `sdWayBack`); the dungeon host hands it back untaken, nothing said (`sdRiftStep`); the Rift keeps its walk-in armed and asks again each frame I stand in it (`scenes/sdEnd.js`) |
| H7, H8 | the Hour's per-frame garbage; the street's song between the Hollow's and the Hour's | SD20c (V5) and SD20d (A1) |
| H9 | THE VEIL COLD FOR A HOLLOW. The step's veil was built ahead only when a gate stood (AUDIT WB D5): a session no gate stood in compiled it as the first Rift step began | built ahead as a Hollow stands (`warmGateVeil` in the Hollow host's `stand`) |
| H10 | /unstuck IN THE HOUR. It left by the dungeon's door - no veil, none of the Hour's words, the one way out of the Hour that was neither | the Hour's own way out (`sdWayHome`): under its veil, in its words; refused there (the dead's is the death's), nothing more said |

Pins: `test/sd20f_hosts.test.js` (5 - the kept slots by account over one store and two tabs, run from the world host's
own text; the cast-out once a stay on the real Hollow host over the world's own doors, asked again, never sooner, and at
once on a new stay; the Hour's voice leaving its turns; the step under another's veil - the world's two doors, the dungeon
host's answer and the Rift's walk-in kept armed; the veil warmed, and /unstuck in the Hour run from its own text);
`tools/mutants/sd20f.json` (17, all dead). RE-AIMED BY CONTENT, each still dead: `sd11c.json`
(`SD11c-L1F2-latched-on-the-refusal`, `SD11c-L1F3-never-judged-where-I-stand`, `SD11c-L6F17-never-kept`,
`SD11c-L6F17-never-read`, `SD11c-L6F17-unbounded`), `sd11d.json` (`SD11D-the-leave-never-letting-go`), `sd2d.json`
(`SD2D-never-cast-out`, `SD2D-cast-out-every-frame`), `sd4b.json` (`SD4B-the-word-unasked`). PINS MOVED:
`test/sd11c_page.test.js` and `test/sd12_onelife.test.js` (the kept slots' harness handed the signed-in account - none:
the device's), `test/sd11d_words.test.js` (the voice's frame leaves, it no longer clears), `test/tr2_riding.test.js` (CI's second shard
found it red from SD20d on: "no true-loop source on this channel" read the whole engine, and took SD20d's named beds - a
looped source, its pitch beside it - for the riding channel; read now on the channel's own code,
`SD20F-the-riding-channel-looped` its mutant, dead).

THE FOUR HOSTS: `scenes/world.js` WIRED (the kept slots by account; "not yet" from the Rift's two steps; the veil warmed
as a Hollow stands; the voice's leave; /unstuck in the Hour); `scenes/dungeonContext.js` WIRED (the Rift's step handed
back untaken while another is under way); `scenes/worldModes.js` FLAGGED - its `stepping` (SD20d) is read, its exit and
its one-step-at-a-time unchanged; `scenes/exterior.js` FLAGGED - the `?exterior` bench is offline: no Hollow, no Hour.

#### SD20g - the delve arc and the dungeons' sizes

| | what was wrong | now |
|---|---|---|
| D1 | A FALL WAS A STAIR. The trail's fill laid a fall as a column of cells half a metre apart, and the way out (a step either way) walked the player back up drops of two, four and six metres they could not climb - at a walk and at a run; no rule on the cells alone told a fall from a steep stair (both rules tried broke 45-degree stairs) | the motor's own fall reaches the trail (`fallFrom`, its fallStart, through each dungeon host's `motorState`): a sample taken in the air is not stood in, and a landing more than `TRAIL_FALL_M` (the way out's own step) below where its fall began is not filled (`systems/automap.js`); a stair walked on the ground, thirty to fifty-three degrees, is a way both ways. And a DROP IS A WAY DOWN: kept on the record as a one-way step (`drops`, saved with the trail, gone with it on another layout or a hidden map, `TRAIL_DROPS_MAX` at most) and handed to the way out with the walked teleporters (`automapWaySteps`) |
| D2 | THE SPLIT SAID AS DRAWN. Section 13 said a quarter of the Bay's dungeons small, half medium, a quarter whole; what is built and labelled is about two in five Small, a little under half Medium and one in seven Large (a dungeon of five blocks or fewer is small whatever it draws, one of eight or fewer never more than medium) | the page says what is built; weighting the draw by a dungeon's blocks, to read a quarter Large, is Mac's call - reported, unchanged |
| D3 | AN ENDED QUEST STILL MARKED. A tombstoned quest stays in the machine a game week, its stands standing and its behaviours bound to it: the Exact tier marked its item, people and foes, and the compass pointed at them | a quest complete or tombstoned marks nothing (`systems/questGuidance.js` `questEnded`) |
| D4 | THE WAY OUT BUILT WHOLE EACH SECOND. Exploring, the player always stood on a fresh cell - off the field - and it was built whole each second (5-14 ms at 8,000 cells); a long trail loaded whole asked its 2,000 wall rays in one build (31 ms) and built again each second until every step was asked | new cells attached as they come (`attachCells`, by the field's own step and the walls' word); off the field it is built at most each `WAY_FIELD_S`, then two, four, eight seconds, up to `WAY_REFIELD_S`; an aim asks at most `WAY_ASK_MS` (2 ms) of rays - the rest taken as clear and asked in the aims that follow, the field built again only when a step it walks proves walled |
| D5 | A SHARED QUEST UNLAID. An older page lays every dungeon whole, and a quest it shared pointed into blocks this page's world-sized build has not, until this player's next online load | each shared copy laid on this page's sizes as it arrives and as it is kept in step (`systems/questShare.js`, `relayQuestOnline`) - a quest item the player carries never laid again |
| D6 | A LINK'S STAMP ONLINE. `adoptLinkedDungeonSize` ran online, where a quest's markers are always the world's: a link's older stamp could take the place of its own, and offline the copy built a layout its markers do not know | never online (`world/smallerDungeons.js`) |
| D7 | THE TIER READ EACH POINTER MOVE. The maps hand a fresh location each ask, so the tier label's own memory never held one, and every pointer move over a dungeon on the held map read its record again (a large one's layout drawn again) | kept by place for the page (`scenes/world.js` `_tierLabels`) |
| D8 | the Smaller dungeons row said a quest's dungeon keeps its full size | *"a quest keeps the size it was set up at"* - the law (a quest started with the switch on builds small after it is turned off) |
| D9 | `systems/quest/quest.js`'s stamp comment said "online, Disabled" | the world's sizes (`ONLINE_DUNGEONS_STATE`) |

Pins: `test/sd20g_delve.test.js` (7 - a fall one way at a walk and a run, two to six metres, and walked down it; a step
down and a hop filled, its air not; stairs both ways; the hosts handing the motor's fall; the drop kept, once, capped,
saved and loaded, gone with another layout and a hidden map; the split said as built; an ended quest's item, foe and
person unmarked; a hundred new cells and one build, the back-off's gaps, the asks paced by the clock and a walled step
it walked building it again; a shared copy laid, a link's stamp never taken online; the tier read once a place; the
Smaller dungeons row); `tools/mutants/sd20g.json` (24, all dead). RE-AIMED BY CONTENT, each still dead: `dsize1.json`
(`AUDIT-DELVE-E1-agreeing-markers-relaid`, `AUDIT-DELVE-E1-the-stamp-kept`, `AUDIT-DELVE-E1-nothing-put-back`,
`SD-ONLINE-E1-a-world-sized-quest-relaid`, `SD-ONLINE-E1-an-unread-dungeon-restamped`), `guide8.json`
(`GUIDE8-the-taken-marked`, `GUIDE8-the-hidden-marked`, `GUIDE8-the-dead-foe-marked`, `AUDIT-DELVE-E6-the-away-marked`),
`wayout1.json` (`WAYOUT1-rebuilt-every-frame`, `AUDIT-DELVE-B1-the-step-unfilled`, `AUDIT-DELVE-B1-a-teleport-filled`,
`AUDIT-DELVE-C4-a-step-and-a-half`, `AUDIT-DELVE-C4-reset-forgets-nothing`, `AUDIT-DELVE-C9-asked-every-build`,
`AUDIT-DELVE-C9-no-budget`, `AUDIT-DELVE-C9-the-rest-never-asked`, `AUDIT-DELVE-B2-built-whenever-it-grows`),
`sd20f.json` (`SD20F-H6-the-step-unseen`, `SD20F-H6-the-way-back-unseen` - the step's read guarded on the object, as
audit24 wave37's law holds every read above `var modes`), `em3mapchoice.json` (`EM3-TRAIL-kept-across-a-new-layout`,
`EM3-TRAIL-HideAll-keeps-the-trail` - the drops cleared on the same lines). PINS MOVED: `test/wayout1_wayout.test.js` (new cells attached
at once - the way out along them within the second, the field built once; the build counted by `builds()`, the refield
every WAY_REFIELD_S; the host hands the drops with the teleporters; and its pins on how many steps are asked hold the
clock - CI's slower runner spent `WAY_ASK_MS` mid-build and asked the rest in the next aim, 98 for 76, so those pins
read the count alone, and the clock's pace is `sd20g_delve`'s own), `test/tier1_dungeontiers.test.js` (the tier kept by
place), `test/playerdeath.test.js` and `test/audit39_dungeonshared.test.js` (the bench's and the world's motor state
carry the fall), `test/ft1_smallerdungeons.test.js` (the Smaller dungeons row's law), `test/features.test.js` (the
notes' ceiling, +1).

THE FOUR HOSTS: `scenes/worldModes.js` WIRED (its `motorState` hands the fall under way); `scenes/dungeonContext.js`
WIRED (the trail tick given the fall; the way out given the drops); `scenes/world.js` WIRED (a shared quest laid with
the item I carry; the tier kept by place); `scenes/exterior.js` FLAGGED - the `?exterior` bench has no dungeon, no trail
and no way out (the `?dungeon` bench, `scenes/dungeon.js`, hands its motor's fall as the world's dungeon lane does).

### SD-ALONE - shipped 2026-10-08 (no companion through the Rift)

Mac: *"We need to make sure companions dont enter the rift"*. A player's companions - the crew's hands ashore
(CREW-COMPANIONS) and the sworn revenants (REVENANT-COMPANION) - followed them through the Rift as through any door:
the companion layer (`scenes/crewAshore.js`) stands its party in whatever place the player is in, and the Hour is a
dungeon. The Burning Court had kept them out since GATE-ALONE (`World-Bosses.md` section 21); the Hour, made on the
court's pattern, never took that rule. Now it has the court's law whole:

- The place the layer asks for (`scenes/world.js companionPlace`) is none while the player stands in the Hour
  (`sdRealmSlot`), asked beside the court's, for the crew's layer and the sworn's alike. The layer lifts every companion
  as the player steps through - a door's own lift, the health and the spells carried - and stands none inside, however
  long. Out of the Hour (the way back to the Abyss Dungeon's Rift, the way home, a death or the end cast out) the next
  place stands them behind the player again, through their portals. The Abyss Dungeon itself, before its Rift, still
  takes them.
- They stay the player's: the party, the slots, the sworn's loyalty and their rest are untouched.
- The party panel draws no card for them in the Hour (`partyCompanions`).
- The Hour says so once as a player steps through with any at their side - *"Your companions cannot follow you through
  the Rift."* (`world/sdRealm.js SD_REALM_TEXT.noCompanions`) - through its own voice, once the step's veil has opened
  (`sdAloneFrame`, in the Hour's frame after the realm's own): never through the door, under the veil or under a
  window, and owed again the next time through. (AUDIT SD IV, SD26 T4: it began with the marks card, whose corner
  covered the line on a phone and on a laptop with the party up - while the card, or the kill's chart, stands the
  line stands over it, `ui/gateMarksView.js` and `ui/gateDamageChart.js`, the court's too.)

No relay change (`world/sdRealm.js` is the page's alone) and nothing in the account service.

Pins: `test/sd21_alone.test.js` (4 - the place, through the real companion layer, the party panel, the word);
`tools/mutants/sd21_alone.json` (13, all dead). PINS MOVED: `test/sd5a_realm.test.js` (the realm's words carry the
companions' refusal; the Hour's frame says it after the realm's own).

THE FOUR HOSTS: `scenes/world.js` WIRED (the place none in the Hour, the party's cards none there, the word);
`scenes/worldModes.js` FLAGGED - its `sdRealmSlot` answers the world host, unchanged; `scenes/dungeonContext.js`
FLAGGED - the layer stands its bodies in the dungeon's pool through the place the world host answers, unchanged;
`scenes/exterior.js` FLAGGED - the `?exterior` bench is offline: no Hour, and no Rift to step through.

### SD-REACH and SD-LAND - shipped 2026-10-08 (the Rift where a walk reaches; never out in the Hour's sky)

The Discord, of a live Abyss Dungeon (ValenValarys, with two pictures - the Rift and its Return in a small walled room,
and the same room alone in the dark): *"In a place with absolutely no connection to the other blocks... was this done
on purpose?"*; asked how they got there: *"ahh it first warped me in a room I ve never seen before but suddenly I am
flying"* (a third picture: high over the forest by the Hollow's column of light). Mac: *"The return teleport is bugged
also."* Two defects, each read off the code:

| | what was wrong | now |
|---|---|---|
| R1 | THE RIFT IN A SEALED POCKET. SD4b's end was the farthest of the layout's enemy markers AND every block's start markers. DFU reads start markers off the starting block alone (FindMarkers), and a block's first carries its water level and castle flag (SetRDBResourceData) - its maker's data, set down anywhere; and the border blocks, the caps DFU closes a layout with (names beginning B), ring it, so the point farthest from the way in all but always stood in one - a cap's pocket that no corridor reaches. A 7 m ring stood there could show through its walls, be stepped into from the corridor, and the way back from the Hour landed inside the pocket | the candidates are the layout's enemy markers, an interior block's first (`world/sdDungeon.js` `sdEndMarks`, `SD_BORDER_BLOCK_RE`: a marker is the block's whose square holds it); every enemy marker with none there; a block's start markers only with no enemy marker at all - a Rift somewhere, never none |
| R2 | OUT IN THE HOUR'S SKY. The way out of a dungeon lands before its door (PositionPlayerToDungeonExit); out of the Hour, before the Hollow's (`sdHollowDoors`). With no door found - the Hollow taken down at its end, its door gone with it - the landing was nothing and the exit never moved the player: they stood at the dungeon's own coordinates read in the street's frame, the Hour's islands high over the Hollow's pixel | every dungeon entry keeps where the player stood outside as they went in (`scenes/worldModes.js` `dungeonReturn.from`, the door landing's own shape, taken before the start marker moves them in), and the door's way out lands there when it finds no door - the arena floor's law (AUDIT PRE-MERGE 1003b C7) for every dungeon |

The Return itself carries the player to the start marker, the walk-in's own point (DE1's TransitionDungeonInterior), as
it did; it was the Rift's pocket that made it a room never seen, and the exit's empty landing that put them in the sky.
Not changed: an interior enemy marker can still stand somewhere only a teleporter or a lever's door reaches - a
reachability walk over the collider would answer that, and the navmesh's bake (5-11 s and up to 1.3 GB on the largest
whole layouts, ENHANCED AI 3b) is no price for every player's Rift; recorded here should a report come.

Pins: `test/sd22_reach.test.js` (7 - no start marker beside the enemy markers; an interior block's first, the
screenshot's layout; which block holds a marker; a Rift somewhere, never none; the host's call unchanged; the way out
with no door found; the spot outside taken before the player is moved in); `tools/mutants/sd22_reach.json` (13, all
dead). PINS MOVED: `test/sd4b_rift.test.js` (the candidates: no start markers beside the enemy markers, those placed
alone when there is none), `test/sd5a_realm.test.js` (the way out of the Hour: its door's landing, else `from`). The gate's records rerun beside them: `wb3b.json` 36 of 37 dead - its
`WB3b-the-omen-deaf-to-the-kill` survives on main alone too (main's own gap, not this slice's).

THE FOUR HOSTS: `scenes/dungeonContext.js` WIRED (the end asked over the new candidates - its call unchanged);
`scenes/worldModes.js` WIRED (the record's `from`, the way out's last resort); `scenes/world.js` FLAGGED - its Hollow's
doors (`sdHollowDoors`) answer as before, the fallback is the mode machine's; `scenes/exterior.js` FLAGGED - the
`?exterior` bench has no dungeon, and `scenes/dungeon.js` (the `?dungeon` bench) exits to no street.

### SD-SKY - shipped 2026-10-08 (the way out of the Hour in the street's own frame)

The Discord again, with SD-REACH and SD-LAND live (the deployed page's build tag was 1978e937, their merge): maya,
*"WHY DID I GET TPED HERE WHEN I WENT INTO THE RIFT"*, and ValenValarys, *"now I really find the portal but portal keep
teleporting me out of dungeon"* - each picture high over the Hollow by its column of light, maya's under its door's own
banner, *The Clockless Deep - fades in 1d 20h*, her sworn companion stood back at her side on the ground below. The
Hollow stood, so SD-LAND's empty landing could not be it: the door was FOUND, in the wrong frame.

| | what was wrong | now |
|---|---|---|
| K1 | THE WAY OUT IN THE PIXEL'S FRAME. The world host's door list (`buildingDoors`) keeps each door in its PIXEL's frame; `doorTargets` hands the mode machine every door moved by its pixel's translation (`shiftedDoor`, AUDIT 68 S22), and `sdHollowDoors` read the list raw. The way out of the Hour (`returnLanding`, `exitDungeonNow`) stood the player at the door's native height - the streamer's vertical shift (`StreamingWorldState.compensation[1]`: minus the eye's height at each recentre past 500 m, and kept through every teleport) over the Hollow. Every way out did it: the realm room's refusal (`sdRealmFrame`), the end's cast-out, the way home, `/unstuck` in the Hour. SD-LAND's picture was this one - the Hollow it came from was standing, and SD-LAND's FOUR HOSTS line left `sdHollowDoors` "as before" | `sdHollowDoors` maps the list through `shiftedDoor`, as `doorTargets` does; the list's own doors stay their pixel's (the living world and the talk read them so) |
| K2 | THE FIND'S DOOR IN THE PIXEL'S FRAME. The sdHost's `door` seam measured the feet (the scene's) against the door read raw - right only on the pixel the player stands in, whose translation is the vertical shift alone; a Hollow's door on the pixel beside it stood a pixel's width off, and no find was said from beside it | the same `shiftedDoor` (its cache keyed on the door generation, which every origin move bumps) |

Not changed, and why:
- WHAT SENT THEM OUT was the realm room's hello, refused under the page's own first pose - SD-HELLO, below.
- TWO PLAYERS, TWO RIFTS (ValenValarys: *"player cant see what I see"*, the other player standing in the ring) were two
  builds: a tab kept open from before SD-REACH stands the Rift in its old pocket. The end reads the layout alone. The
  species stood at its markers differ by client (the level's band, Varied Dungeon Monsters), but the water-species veto
  that drops a marker fires on a fixed marker alone, the same everywhere: only the underwater table holds a water
  species, and a random marker that draws from it stands under the water the veto asks it to be above.
- THE COMPANION in maya's picture was stood beside her because she was outside the Hour (SD-ALONE, as designed).

Pins: `test/sd23_sky.test.js` (3 - the world host's own `shiftedDoor`, `sdHollowDoors` and `door` seam read off its
text, over a streamer shifted 560 m down and a Hollow entrance the real `getStaticDoors` mints: the way out on the
ground before the door, the raw door 560 m up; the same through the mode machine's own `returnLanding`, its door gone
where I went in, a Hollow a pixel east by that pixel's translation; the find's door a pixel's width off beside mine);
`tools/mutants/sd23_sky.json` (4, all dead). PINS MOVED: `test/sd5a_realm.test.js` (`sdHollowDoors` through
`shiftedDoor` - the old pin held the raw list's text, the defect itself).

THE FOUR HOSTS: `scenes/world.js` WIRED (both of the Hollow's door seams through `shiftedDoor`);
`scenes/worldModes.js` FLAGGED - `returnLanding` asks the world host's doors as before, now the street's;
`scenes/dungeonContext.js` FLAGGED - the end and the Rift unchanged (the layout's markers, every client's);
`scenes/exterior.js` FLAGGED - the `?exterior` bench is offline: no Hollow, no Hour.

### SD-HELLO - shipped 2026-10-08 (the page's half: a socket says nothing past its hello until the realm welcomes it)

What threw the Discord's players out of the Hour (SD-SKY's pictures: *"portal keep teleporting me out of dungeon"*, on
every try) - found by a model of the relay's own objects, each line of it read again in the tree:

1. The page's socket opens; it says its hello and counts itself open (`net/online.js` `_bind`, `status` 'open'), so the
   very next frame's pose goes down it (`sendPose` asked only that).
2. The realm's hello asks the hub for its record before it names the socket (`server/src/index.js` `_sdAdmit` ->
   `_sdLiveOf` -> `sdLiveAsk`, a fetch to the hub's object; the socket's id is attached only at the hello's end).
3. A Durable Object takes the socket's next frame while a fetch is out (its input gate closes for storage alone). The
   pose, read then, found no id on its socket: *pose before hello* (`net/wire.js` `parseClient`), refused with
   `CLOSE_POLICY` - a terminal close.
4. The page, terminal in the Hour, was cast out (`scenes/world.js` `sdRealmFrame`) with *"The way to the Shattered Hour
   is lost."* - before SD-SKY, into the sky.

The realm keeps the hub's answer 10 s (`SD_LIVE_FRESH_MS`), so a step taken minutes after the last asked again and lost
again - every try - while a player stepping in within 10 s of another got in. The court never raced: its admission reads
storage alone (`_gateAdmit`). And a fighter whose socket blinked in the arena said its `in` and its blows the same way
(`sdOk` is the last welcome's, never reset).

| | what was wrong | now |
|---|---|---|
| H1 | A FRAME AHEAD OF ITS WELCOME. A socket said whatever came next the moment it had said its hello | `net/online.js` keeps the sockets their room has welcomed (`_welcomed`, a WeakSet - the mark travels with the socket through a halo's promotion and AURA-LIVE's replacement): `_send` holds every frame but the hello and the runtime's ping until it, and so do the pose's halo copies, the last pose, a cell's foes, the Orrery's turns and the fight's words |

Not changed: THE RELAY'S HALF. A tab kept open from before this build still races (the build's own notice asks it to
reload). The relay could take a frame that comes during a hello as after it (each socket's frames in their order), or
keep the hub's ask off the hello's path - a relay change, which moves `RELAY_VERSION`, and its deploy drops every
connected player once: Mac's call, open.

Pins: the five that sent ahead of a welcome now deliver one and say what waits - `test/online.test.js` (ONLINE1: a pose
before the welcome held), `test/chat1.test.js` (CHAT1: a line before it held), `test/relayh1.test.js`,
`test/htwaistnet_peers.test.js` and `test/invisnet.test.js` (the real Room's own welcome handed to the sender);
`tools/mutants/sd24_hello.json` (3 - the gate gone, the hello held by it, the welcome marking nothing - all dead).
Unpinned beside them: the gate at the pose's halo copies, the last pose, a cell's foes and the realm's own words, the same
law at each. RE-AIMED BY CONTENT: `tools/mutants/sd6b.json`'s `SD6B-a-turn-from-a-cell` (the Orrery's turn guard grew the
welcome; still dead).

THE FOUR HOSTS: none touched - the session is the hosts' one (`net/online.js`); `scenes/world.js`'s `sdRealmFrame` casts
out on a terminal close as before, and no longer meets one of its own page's making.
