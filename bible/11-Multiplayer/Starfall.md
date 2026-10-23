# The Starfall - the Witches' Festival's fallen stars (STAR0-STAR8)

> Design page and record. Written 2026-10-20 as the design (STAR0), then marked AS BUILT slice by slice. The code's
> comments cite this page by section number; where the page and a pin disagree, the pin is what runs.

## What the owner asked for

The owner, 2026-10-20, of the Halloween live event another session is finishing: *"What were going to do is build the
add ons to the event here and ill have you eventually take over their PR when they are finished."* Two additions:

1. *"A lore accurate world encounter defense mission that can pertain to the lore. I envision something coming from the
   sky and crashing into the ground, where people need to defend the objective in a wave based format with a boss
   topping off the encounter at the end."*
2. *"A new seasonal quest line that ties into the event, its functions and the new world event."*

And: *"The world event itself should have multiple encounters spread throughout the region, not just one."*, *"No band
aids, no half assed work and ensure any text implemented/ui elements are enhanced plus + not AI-like and
overexplanatory."* Every decision below was handed over (*"take autonomy"*); each is made here and named.

So, as decided here:

- **Online only.** Like the gate, the serpent and the raids, the Starfall is a fact about the shared world: the relay
  keeps each star's ledger, signs each defender's receipt, and the account service pays it. Offline there is no
  Starfall.
- **The event's own.** It runs on the Witches' Festival's own days (section 12 - `06-Systems/Witches-Festival.md`,
  `net/festivalLaw.js` `FESTIVALS`), the calendar the relay, every client and the questline read alike.
- **Three stars a night, in one coven's land.** Every real hour is a night on the sky (TimeScale 24, `Online-Time-Arc.md`),
  and each night one of the Bay's covens works the rite: three stars fall in the wilds of its region, one after another,
  near three different towns.
- **The foes are Daggerfall's own**, owned by a player's machine as every foe in the open world is (the rite's camp
  law), with Daggerfall's own AI, spells and pathing. The relay holds the ledger: the wave, the star's light, the
  master's fall, who defended. This is a departure from the world bosses' Option B, named in section 10.

Daggerfall has no other players and no fallen stars, so none of this is a DFU member. Its Ledger A row is STARFALL.

## The lore - canon, and the port's own

Each piece says which it is, as `Elite-Gates.md` section 3 does.

**Canon (the player's own data, read 2026-10-20):**

- The Witches' Festival is the 13th of Frostfall. Daggerfall's own words for the day (TEXT.RSC record 8392, 8349 plus
  the holiday's id 43): the day "when the forces of sorcery and religion clash", when "Demonologists, conjurors, lamias,
  warlocks, and thaumaturgists meet in the wilderness outside %cn, and the creatures created or summoned there may plague
  Tamriel for eons. Most wise men choose not to wander this night." (`systems/holidays.js` HOLIDAYS.Witches_Festival,
  day 0x11B = 283, every region.)
- **Day 283 is also Mephala's summoning day** (`systems/daedraSummoning.js` DAEDRA, Mephala's `dayOfYear`, DFU's
  DaedraSummoningService table). The two tables were never written to agree; they do. The Witches' Festival is
  Mephala's day.
- Daggerfall's Mephala is "the Daedra Regent of Murder and Patroness of the Dark Brotherhood" (Z0C00Y00.QRC), "Mephala,
  Queen of Oblivion" (N0B00Y09.QRC). Her incantation is in the game - "Hapisho, Malicnao, Mephala." - and reading it
  wakes a guardian: "An ancient lich! He must have been summoned to protect the scroll!" (G0B91Y01.QRC, N0B41Y24.QRC).
- The Daedra have stars. The game's rumours: "The stars of Mehrunes Dagon are blazing tonight." (Y0C00Y00.QRC), "The
  stars of Namira burned bright last night." (30C00Y00.QRC), "When the stars darken like last night, it is to mark the
  death of a daedra." and "Did you hear music in the woods last night? The witches must be celebrating." (Q0C4XY04.QRC).
- The covens are the Bay's own: fourteen coven locations in MAPS.BSA, each the home of a FACTION.TXT witches' coven
  (type 8). Glenmoril's (Ilessan Hills) serves Hircine alone - DFU: "THE GLENMORIL WITCHES always summon HIRCINE"
  (`daedraSummoning.js`) - and stands apart from Mephala's rite. Every other coven summons a prince a day. The quest
  table names each coven as a permanent place (`vendor/dfu-quests/Tables/Quests-Places.txt`, `BluffCoven`,
  `GlenmorilCoven` and the rest) and covens as a dungeon type (`dungeon7`).
- The holiday text names lamias among those who meet. Daggerfall's lamia is `Aquatic` (ENEMY_BASICS 42): it never leaves
  the water, so it stands at no star. The text's words are kept in the questline's, and nowhere does a lamia walk on
  land.

**The port's own:** that on Mephala's day the covens spin a rite to snare a star; that the stars come down bound in black
thread; that the coven's summoned drink a star's light, and a star drunk dark leaves what drank it in Tamriel; that a
star held until its thread burns sends them home; the masters' titles; Morwen of Glenmoril; the Starspun Weave;
Starfall Glass.

## The shape, end to end

```
 the live event staged ─► the NIGHT (each real hour) ─► the night's COVEN (a bag over twelve) ─► its REGION's wilds
   (section 12)             sky 18:00 to 06:00             STAR_COVENS, never twice running        three pixels, apart
                                                                                                       │
            the OMEN (90 s before each fall) ─► the FALL (a streak, the impact) ─► the FALLEN STAR ─┘
              a new star in the sky, the map mark       the crater, the stone, its thread, the beacon
                                                                 │
   a player within 55 m springs the coven's foes (the camp law) ─┤ every player within 55 m says the star's word
                                                                 ▼
          the CELL ROOM the star stands in keeps its LEDGER (net/starfall/starfallLaw.js): the wave, the light, the master
          WAVE 1 ─ breath ─ WAVE 2 ─ breath ─ WAVE 3 ─ breath ─ WAVE 4 ─ breath ─ THE MASTER ─► HELD (or LOST: light 0, or dawn)
                                                                                              │
   the account ◄── claim ◄── RECEIPT `j1` ◄── the cell mints, to each who struck and stood ◄──┘──► the hub ──► everyone
   service           │                                                                                 online hears it
                     └──► Renown, silver, "Stars held"; on the device: gold, Starfall Glass, a piece, the Starspun Weave
```

## 1. When - the festival's window, the night, the stars

**The window.** The Starfall runs on the Witches' Festival's days - 20 October to the end of 7 November 2026, UTC
(`net/festivalLaw.js` `FESTIVALS`, a row a year; `net/starfall/starfallLaw.js` `starfallRuns` asks `festivalOpen`). The
relay, every client and the questline read the same calendar off the clock; nothing is staged, and a cell needs no word
from the hub (section 10). A star counts only if it LANDS inside the festival (`starInWindow`).

**The night.** The sky turns once a real hour, its midnight on the hour (`net/skyLaw.js` SKY_SEGMENTS: TimeScale 24
since 2026-10-03, aligned). Night N is the sky's night whose midnight falls at `N * STAR_HOUR_MS`: from the sky's 18:00
(HH:45 the hour before) to its 06:00 (HH:15). The law reads wall time alone, so the relay needs no sky
(`skyLaw.js` is never the relay's); `test/net/starfall/star1_law.test.js` holds every star of a year of nights inside
the sky's dark, read off `skyLaw.js` itself.

| sky | real (UTC, every hour) | what |
|---|---|---|
| 17:24 | HH:43:30 (the hour before) | **the first omen**: a new star over the coven's region |
| 18:00 | HH:45:00 | **the first star falls** |
| 21:00 | HH:52:30 | **the second falls** (its omen at HH:51:00) |
| 00:00 | HH:00:00 | **the third falls** (its omen at HH:58:30) |
| each fall + 15 min | | that star's **deadline**: unheld, the coven takes it |
| 06:00 | HH:15:00 | dawn: the third star's deadline |

`STAR_FALLS_MS` [-900 000, -450 000, 0], `STAR_OMEN_MS` 90 000, `STAR_LIFE_MS` 900 000. A night's three stars overlap,
so a company can hold one and ride to the next.

**The Witches' Night.** On the night of the sky's own 13th of Frostfall (the sky's day 283 at its 18:00 - once a sky
year, every fifteen real days: its dusk at 11:45 UTC on 2026-10-20 and 2026-11-04 inside this window), the third star is **the Heart-Star**: its
master's circle is twice the size, and what it gives is twice as much (section 6). The client's law alone
(`systems/starfall/starfallNight.js`, which reads the sky); the relay neither knows nor needs it.

## 2. Where - the coven's region, three stars in its wilds

**The covens** (`systems/starfall/starfallCovens.js` STAR_COVENS - the coven's MAPS.BSA location, its region, its
FACTION.TXT name and what a member is called): twelve of the fourteen.

| region | coven (MAPS.BSA) | witches (FACTION.TXT) | a member |
|---|---|---|---|
| Alik'r Desert | Coven in the Marsh | The Witches of the Marsh | Witch of the Marsh |
| Dragontail Mountains | Devilrock Coven | The Witches of Devilrock | Witch of Devilrock |
| Dragontail Mountains | Coven of the Peaks | The Mountain Witches | Mountain Witch |
| Dak'fron | Kykos Coven | The Sisters of Kykos | Sister of Kykos |
| Daggerfall | Coven on the Bluff | The Sisters of the Bluff | Sister of the Bluff |
| Menevia | Tamarilyn Coven | The Tamarilyn Witches | Tamarilyn Witch |
| Alcaire | Alcaire Coven | The Witches of Alcaire | Witch of Alcaire |
| Phrygias | Skeffington Coven | The Skeffington Witches | Skeffington Witch |
| Daenia | Beldama Coven | The Beldama | Beldam |
| Shalgora | Daggerfall Coven | The Daggerfall Witches | Daggerfall Witch |
| Myrkwasa | Coven of the Tide | The Tide Witches | Tide Witch |
| Antiphyllos | Coven of Dust | The Dust Witches | Dust Witch |

Left out, and why: **Glenmoril** (Ilessan Hills) is Hircine's, and in the questline it is the side that stands against
the rite; **Wroth Coven** (the Daughters of Wroth) stands in the Wrothgarian Mountains, the open zone, where no world
event runs (`systems/wild/wildZone.js` WILD_REGION, the gate's own law). FACTION.TXT's `region:` field for the covens
does not name the MAPS.BSA region the coven stands in, so the pairs are written by name and held by
`test/systems/starfall/star2_covens.test.js` against the player's data (ARENA2-gated: every location exists in its
region as a Coven, every faction exists as type 8).

**The night's coven** is a shuffle bag over the twelve (`starfallCovenOf(N)`): every coven takes a night, in an order
each round of twelve shuffles, before any takes a second, and a round never opens on the coven the last one closed on.
So a region sees its stars about twice a real day, at a different hour each round.

**The stars' pixels** are the Oblivion Gate's own suitable pixels in the coven's region (`systems/gate/gateSite.js`
gateScanner - land, no location on the pixel or its eight neighbours, 2 to 4 pixels from a town a traveller can fast
travel to, the game's own MAPS.BSA rows alone), which is the holiday text exactly: the wilderness outside a town. Three
are drawn by hash (`STAR_SALT`, the night, the star): each at least `STAR_APART_PX` (5 pixels, about 4 km) from the
others and from the gate's site of that game day, each named by its nearest town, a different town for each where the
region has them. The spot inside the pixel is the law's (`starSpotLocal(N, k)`, up to 200 m off the pixel's heart -
the gate's), so the relay can place the star from the pixel a word names.

## 3. A fallen star - what stands, and what is seen

All of it the port's own art, made in code (`world/starfall/starArt.js` through `world/superDungeon/sdPixelKit.js`, under
pseudo-archives registered in `world/eliteGates/pseudoArchives.js`): no ARENA2 pixel is in it.

- **The omen** (90 s before the fall): a new star burns over the region - a point of pale violet light, high in the
  sky toward the site, swelling as the fall nears. The map marks the site, the compass points to it, and the chat
  says where.
- **The fall** (8 s): the star tears loose and comes down at a slant, a white head and a violet trail kilometres long,
  lighting the land under it. It lands with a flash seen across the region, a ring of shock running out over the
  ground and a thunderclap that reaches each player its distance late (`systems/distantStorms.js` thunderOf). The ground
  shakes under a player within 300 m.
- **The crater** (`world/starfall/starModel.js`): a scorched bowl 14 m across, conformed to the land, its cracks
  glowing faintly; a rim of thrown earth and stone; no grass grows in it.
- **The Fallen Star**: a jagged stone of pale glass, half buried, two and a half metres of it standing out of the
  crater's heart, lit from inside. Black thread is wound about it and runs up into the dark.
- **The beacon**: a column of the star's light, rising hundreds of metres, seen across the region (the gate beacon's
  column). It rises over three seconds after the landing and dims with the star's light as the cell says it, to three
  tenths of its strength at none (`STAR_BEACON_DIM`): a star failing is seen from across the region.
- **Held**: the thread burns away, the stone turns gold-white, the beacon goes gold and thins over a minute.
- **Lost**: the stone goes dark, the beacon goes out, and the thread stays.

**As built (STAR4).** The art is six records under `STAR_ARCHIVE` (38301): the burned floor (its cracks lit violet), the
thrown rim, the glass, the thread, the glass held gold and the glass lost dark (`world/starfall/starArt.js`). The crater
never cuts the land's triangles (every client's pixel is the same mesh): its floor is laid ON the land, each point on
the highest ground within half a metre of it (the rite's sigil's drape) and a hand over it, with the rim's earth raised
round it to a crest at 7 m and falling away to 9.6 m, nine stones thrown onto the rim, six glass shards (the heart's
upright, two and a half metres out of the earth and sunk most of a metre into it, the rest leaning out from it) and three
strands of thread that wind up the stone and run 90 m straight up (`world/starfall/starModel.js`). Every shape is the star's
own roll, so every screen builds the same crater. The host builds it for a player within `STAR_BUILD_M` (1500 m), puts
the stone AND its crater - the floor, the rim and its stones - in the collider, keeps the grass off the crater and its
rim (`STAR_BARE_R`) and builds it again when the ground under it is built finer (`scenes/starfall/starfallHost.js`).
STAR-TUNE (2026-10-20, the owner, of the first run: "The dirt mound where the star is crashed can be walked through"):
the first build gave the collider the stone alone (`buildStarModel`'s `ground: false`), so the rim's 1.1 m of thrown
earth was drawn and never held. It is held now, as a LATE solid (`player/lateSolid.js`, ROCK-CLEAR's gate): a crater
built round a body standing on its rim is withheld until the body is clear of it, never closed on it, and the world
frame's own settle stands it behind them. AUDIT STAR-TUNE F4: and a crater built AGAIN - the ground under it read finer
as a player walks up to it - is a new solid asked of the body the same way (taken down and added); only a recentre puts
the same solid back where it is held. A foe's stand is read from over the rim's crest (`standOn`), so one stood on
the rim or the floor - the master's circle, called about a master fighting at the stone - lands on it, never under it. The sky is one foreign pass after the Hollow's omen
(`render/starfall/starfallPass.js`): the omen's glow, the streak's head and trail, the landing's flash and ring, and the
beacon, each drawn scaled about the eye to `STAR_SKY_R` (4200 m) so the far plane (6000 m) never cuts a star that burns
9 km up. The sounds are DAGGER.SND's own records, pitched (`systems/starfall/starSounds.js`).

**As built (AUDIT STARFALL, 2026-10-20).** The audit found the crater and the sky's things where the frame moved under
them, and fixed each where it lives:

- **The crater stands where its heart is.** A floating origin's recentre moves every heart and none of the ground's
  relative heights, so the model kept its key and its stone's collider stayed at the old place; and between the build
  (1500 m) and the letting go (1800 m) the crater's matrix was never placed again. Its matrix is made again whenever the
  heart moves, for every star whose crater stands, and the stone's collider stood again at every matrix that moved (the
  gate's own law, `scenes/gate/gatePool.js` standCollider) (R1).
- **The floor drawn pulled toward the eye.** The floor and its rim are a mesh of their own, drawn under the ground marks'
  polygon offset (`STAR_FLOOR_OFFSET`, `render/auraRing.js`'s fire on the stone): a hand over the land alone fought its
  depth at range (R4). The rim's stones sink from the LOWEST earth under their base's corners, their crown over the earth
  at their middle - one taken at its middle hung over the rim's outer slope (R6).
- **The beacon is a sky thing.** Its column is clamped about the eye to `STAR_SKY_R` as the omen, the streak and the
  flash are, its width, its foot and its height scaled with it: past about 6 km the far plane cut it (R2).
- **The ring of shock rides the land.** It was a flat square 0.6 m over the heart out to 98 m, and the land rises over
  that plane within 90 m of most of the map's ground (the audit's probe over WOODS.WLD: 63.5% of its land pixels). It is
  a strip of `STAR_RING_SEGS` (32) bearings now, each edge lifted to its own ground: the host reads the ground at the
  ring's inner and outer edge at each bearing, the crater's rim on it, while the ring runs (its 1.8 s alone), and hands
  them to the pass as one uniform array (`uGround`, `render/starfall/starfallPass.js` STAR_RING_VS) (R3).
- **The fog's focus.** The sky's and the ring's programs are handed the travel view's focus and the jungle's haze, as the
  beacon's always was (R5).
- **What it costs.** The coarse ground under a star on an unbuilt pixel is read once a star and again only every
  `STAR_COARSE_EVERY` (600) frames - the world's kernel is one for the gate's pixel, and three stars and a gate asking it
  in turn each frame made it again at every ask; and the pass's three programs are built at idle while the festival
  stands (PERF-COMPILE1's law, `render/warmPrograms.js`), never inside the frame of the first omen (R9).

## 4. The defense - waves, the light, the master

**Springing it.** The first player within `STAR_SAY_M` (55 m) of a fallen star springs its coven and owns their foes
(the camp law of the World of Daggerfall, `world/worldOfDaggerfall/wodShared.js`: site `px,py:star.<N>.<k>`); every
other player sees the owner's foes and fights them through the owner. An owner who leaves hands them to the next
player at the star after `STAR_ORPHAN_MS` (10 s). The relay starts the first wave `STAR_GATHER_MS` (10 s) after the
first word from the star. (The first build sprang it from `STAR_SPRING_M`, 80 m - the audit's C2, below.)

**The waves** (`STAR_WAVES` 4). The relay says each wave's start and its size (`starWaveSize(k, n)` -
`min(4 + 2(n - 1) + (k - 1), 24)`, `n` the defenders standing at the star when it starts, one at the least), so every
screen agrees: a lone defender's 4, 5, 6 and 7; two, 6 to 9; four, 10 to 13; eight, 18 to 21; ten or more, the most by
the last wave. Twenty-four is one spawn grant's most (`net/grantLaw.js`): the star stands under a grant kind of its own,
`star` (a wave of any size its law gives one ask, its bucket its own - never the camps' `site`, nine a grant, which the
first build's waves were held to; the open country's alone), and the `st` frame carries a wave that size
(`net/wire.js` `STAR_WAVE_SIZE_MAX`). Each foe is shared by those who fight it besides (`systems/party/partyScale.js`).
The most a star's owner stands at once is a wave's twenty-four, the master and two calls of the Heart-Star's circle -
forty-five (`STAR_LIVE_MAX`), a reader's allowance the same (`WOD_STAR_PUPPETS_MAX`), under one owner's frame of
sixty-four. The owner's stand rolls each place's angle and radius from blocks of its own, thirty-two a wave
(`STAR_STAND_ROLLS`), so no wave of twenty-four shares a roll with the next. The coven's foes - its waves and its circle - stand with `STAR_FOE_HEALTH` (2)
times their health, as the rite's Summoner stands with its own (`scenes/riteHost.js`): what the rite on a star calls is
no foe of the road. The master is an elite already (x5), and stands as one. The relay bounds a camp's foe by it
(`net/foeBounds.js` `FOE_BOUND.star`), so a reader never strips the coven its owner stood. STAR-TUNE (the owner, of the
first run: "the enemies are too few and die too quickly. Does this not have scaling?"; then "we should go beyond the
limit"): the first build's size was `clamp(2 + n + (k >= 3 ? 1 : 0), 3, 9)` - a lone defender's 3, 3, 4 and 4, a party
of eight's nine - and its foes the road's, the wilds' own
progression and the hero's threat alone (`scenes/exteriorFoes.js` spawnFoe). The owner stands them just past the
crater's thrown earth (`STAR_STAND_R`, 14 to 20 m - 25 to 35 in the first build, whose waves spent their first seconds
walking in), from the coven's roster for the
defenders' level - the band (`starBandOf`, the median level of the defenders the relay heard: band 1 to level 8,
band 2 to 15, band 3 from 16), because Daggerfall's monsters have fixed levels and some want silver, dwarven or mithril
to hurt (`ENEMY_BASICS` minMetalToHit), so a band never stands a foe its players cannot fight:

| wave | band 1 (to 8) | band 2 (9 to 15) | band 3 (16 and up) |
|---|---|---|---|
| 1 - the coven's hands | the coven's members: Mage, Sorcerer, Battlemage, Nightblade | the same | the same |
| 2 - what they called | Giant Spiders, Spriggans, Giant Bats | Giant Spiders, Skeletal Warriors, Zombies, Spriggans | Skeletal Warriors, Wraiths, Iron and Flesh Atronachs |
| 3 - what they made | Giant Spiders, Spriggans and members | Fire and Ice Atronachs, Skeletal Warriors and members | Fire and Ice Atronachs, Daedroths and members |
| 4 - Mephala's own | Nightblades and Giant Spiders | Nightblades, Assassins and Giant Spiders | Daedra Seducers, Assassins, Fire and Frost Daedra |

The coven's members are women (DFU: a witches' coven's people are always female - `systems/quest/person.js`), named by
their coven - *Sister of the Bluff*, *Dust Witch*. Mephala is the Patroness of the Dark Brotherhood, so her own are
murderers as well as Daedra.

A wave ends when its foes are all dead (the owner's word, never sooner than its foes shared among its defenders could
die: `starClearFloorMs`, `STAR_KILL_MIN_MS` (2.5 s) for each foe of a defender's share - AUDIT STAR-TUNE F2), or
`STAR_WAVE_MAX_MS` (100 s) after it began - then the next comes whether the last is dead or not. Between waves the
coven draws breath for `STAR_BREATH_MS` (5 s) and the star's light steadies (`STAR_BREATH_LIGHT`, 15). STAR-TUNE (the
owner: "The time between waves is too long"): the first build's breath was 12 s and its waves stood 25 to 35 m out -
some twenty seconds from a wave's last death to the next one's first blow; both are cut.

**The light.** A star has `STAR_LIGHT` (100). The coven's summoned that fight hand to hand go for the STAR, not the
defenders: the star stands in the target machine as a body of its own (the townsperson's law,
`systems/livingWorld/quarry.js` - the Starfall host's own body for it, `scenes/starfall/starfallHost.js`), hunted by its own coven's melee foes alone
(`characters/enemy/enemyTargets.js` huntsStar), and each of their blows that lands on it drinks `STAR_BLOW_LIGHT` (1).
A foe struck by a defender turns on them, as any foe does. The witches themselves - casters and archers - fight the
defenders. So the defense reads: cut down what walks to the star, and stand off the witches' spells. At 0 the star goes
dark and is LOST.

**The master** comes after the fourth wave's breath. Elite (`systems/eliteFoes.js` - five times the health, three times
the blows, larger and glowing), by band and by star:

| band | the first star | the second | the third |
|---|---|---|---|
| 1 | the Coven Mother (a Sorcerer) | the Coven Mother | the Coven Mother |
| 2 | the Coven Mother | a Flesh Atronach - *what the coven made* | the Coven Mother |
| 3 | a Daedra Lord - *what the demonologists bound* | a Daedra Seducer - *Mephala's own* | an Ancient Lich - *woken by the chant* |

At two-thirds and one-third of its health it calls its circle (`starCircleSize(n)`, `clamp(1 + ceil(n / 2), 2, 5)`,
the wave-4 roster), and **while any of its circle stands it takes a quarter of every blow** (`STAR_CIRCLE_SHARE`, 0.25 -
the gate's Ward-Bearers' lesson: break the circle to break the ward). The Heart-Star's circle is twice the size.
`exteriorFoes.js` damageFoe reads the ward off the foe (`f.circleWard`), so every blow - the owner's own and a
peer's through the owner - meets it.

The master's fall HOLDS the star. The relay believes it no sooner than `STAR_MASTER_MIN_MS` (45 s) after the master
stood. A star whose deadline passes unheld is LOST: "Dawn. The coven pulls the last light home."

**As built (STAR5).** No Imp stands in the first band's second wave: it wants steel (`minMetalToHit` 1), and the first
band stands nothing past iron. A star's foes stand under THREE sites of one owner - the waves' `px,py:star.<N>.<k>`, the
master's `.m` and the circle's `.c` (`wodShared.js` starSiteId) - so every screen tells the master and its circle apart
among the foes it sees, names them, says the circle's calls and its breaking, and draws the master's bar, the owner's
or not. The owner stands what the ledger says: each wave its size less the kills the cell already heard (a star taken
over mid-wave stands only what is left of it), stood again after `STAR_RESTAND_MS` (4 s) if none of it could stand; the
master an elite under `.m` with its circle's ward on it (`f.circleWard`); its circle at its calls. The blows the coven's
monsters land on the star are counted on the owner's device per character (`STAR_BLOWS_STORE`), so a reloaded owner
counts on from its own and the relay credits only past its last. A hunter turns on a defender once a defender's blow
lands on it (`starTurned`); until then it weighs the star `STAR_HUNT_PRIORITY` (40) over anyone beside it.

**As built (AUDIT STARFALL, 2026-10-20).** The audit found the owner's machine and the relay disagreeing, and fixed it on
the client (`scenes/starfall/starfallHost.js`):

- **The foes handed over are the star's (C1).** An owner who reloads, closes its page, goes through a door or dies hands
  its live foes to a defender beside them (`scenes/world.js` handOverSiteFoes, handOverFoes), and they came to that
  defender as its own with their site and nothing else - nothing hunted the star, the master stood unwarded, and the new
  owner stood a whole wave or a second full-health master over them. The new owner now claims them first, as the rite
  does (`scenes/riteHost.js` `if (C.ownLive) return;`): each live one under the star's three sites made the star's again
  (its hunters' star, the camp's one number, the wave standing or the next it stands), a `.m` foe taken as THE master -
  its circle's ward, its name, its calls as its health has passed them - and only what is missing stands.
- **One leash, the relay's (C2).** The relay believes a word from `STAR_REACH_M` and forgets an owner silent
  `STAR_ORPHAN_MS`; the owner's machine sprang the coven from 80 m, stood its waves to 80 m and kept the camp to 400 m, but
  said its word from 55 m alone. An owner standing off 80 to 400 m kept a camp no word moved and no peer could take (the
  star was lost at dawn), and one between 55 and 80 m stood waves the relay never heard. Now the coven is sprung, stood
  and held within `STAR_SAY_M` (55 m), where the word is said, and an owner outside it for `STAR_ORPHAN_MS` gives its
  foes up (its sites nobody's, its foes taken down) so the next defender's screen takes the star and stands only what is
  left of the wave. A master given up that way is stood again whole by the next owner.
- **A master that never stood is stood again (C4)**, `STAR_RESTAND_MS` on, as a wave is - none standing, none on its way.
- **The blows are an account's (C6).** The count is kept under the signed-in account and the character
  (`<account>|<character>|<star>`), so another account on the device counts from its own; and the cell's word of what this
  account was credited on the star (`hm`, on the copy of the ledger said to its speaker alone - the relay's half) raises
  the count and never lowers it, so a page that kept none (a private window) counts on from it and its next blow is
  credited. Never the ledger's `hc`: that is the current owner's count, and on any other screen it would credit blows
  nobody saw.
- **A star's allowance the size of its law (C7).** A star's foes can outnumber a camp's: a wave of nine, the master and two
  calls of the Heart-Star's circle of ten. Its owner never stands past `STAR_LIVE_MAX` (30) of them at once, and a reader
  stands one owner's star foes under `WOD_STAR_PUPPETS_MAX` (30), apart from its camps' sixteen
  (`scenes/exteriorFoes.js` applyFoes): under the camps' allowance the excess of a master's circle stood on its owner's
  screen alone, and warded the master still.
- **The master is a world boss.** Its body carries `entity.worldBoss` on every screen - the owner's, a handed one, a
  peer's copy - and no witch of its coven does: its fall is the star's own deed, which the festival's finds pay once as a
  held star (section 12, "one deed, one find"), never again as an elite's body.

## 5. The relay holds the star

Pure law, both ends: `net/starfall/starfallLaw.js` (no imports but the wire's, so the relay's graph stays flat). The
relay's half is `server/src/index.js` - one line in `_message` (`if (m.t === 'star') return this._starFrame(ws, a, m);`)
and Room methods of its own, the raid's and the rite's shape:

- **Where.** A star's ledger lives in the CELL its pixel stands in (`worldRoom(px, py)`), in storage
  `star:<N>.<k>@<px>,<py>` (its whole tuple, `starLedgerId`), from the first word at it to its deadline and
  `STAR_KEEP_MS` (10 min) past it. A layer keeps none (SCALE5d's law).
- **The cell's places** (`starPlaceFor`, the law's, the relay's `_starMakeRoom` calls it). A LIVE star - not held or
  lost, short of its deadline - costs a place: a cell keeps `STAR_LEDGERS_MAX` (4) live, and one account makes
  `STAR_LEDGERS_BY_MAX` (2) of them. A star OVER costs no place and counts to no account: it is kept to its end so its
  receipts are never minted twice nor its fight run again, and what a cell keeps is bounded without a cap - a ledger is
  made once, from its star's landing to its deadline, so a cell's 256 pixels by a night's three stars, one night at a
  time (a night's last is forgotten 25 minutes past its midnight, the next night's first falls 45 minutes on): 768 at
  the most, a forged pixel's holding the one or two accounts that spoke at it. The relay holds none of them in hand
  (`starSettled`: lost, or held, minted and told), so they never push a live star's copy out of its cache. Full, a new
  star takes the place of the live one stood at least lately that NOBODY STANDS AT (`starStoodAt`): an account stands
  at the star its most recent word in the cell came from, if that word came from the star within `STAR_IDLE_MS`
  (60 s) - one star an account, and the account making the new star at that one. A star somebody stands at is never put
  out, so N accounts hold at most N places, and a real star with a defender at it keeps its place; with none to give,
  the new star waits. (The Starfall's audit, 2026-10-20, its first finding: the over stars counted against both caps,
  so two accounts whose four forged stars went dark in eleven seconds held the cell from the real star for twenty-five
  minutes, and one player's two finished stars kept it from the night's third.)
- **The word** (client to cell, every `STAR_WORD_MS` (2 s) within `STAR_SAY_M` (55 m), at once on a change, never past
  the deadline): `{t:'star', n, k, px, py, lv, s, o, kw, kn, wc, hb, mf}` - the night and the star, its pixel, my
  level, whether I struck one of its foes, whether I own them, the wave I stood and am counting (`kw`, 0 none) and the
  deaths I saw of it (0 without one), the wave I saw cleared, the blows I saw land on the star (the owner's count),
  whether I saw the master fall.
- **What the relay checks.** A word for another cell is junk. One outside the window, the night's stars (`starTimes`)
  or its star's life is nothing. One from a pose further than `STAR_REACH_M` (60 m) from the star the law places in that
  pixel is heard as present but counts nothing. The ledger is made by a word from the star (its tuple: the night, the
  star, the pixel - a forged pixel makes a ledger of its own and stands in no other's way: the cell's places, above),
  and only before its deadline (`starMayMake`): `STAR_GRACE_MS` (2 s) past it the relay still hears a ledger's last
  words in flight, but makes none - a first word then would make a star already lost.
- **The owner.** The relay keeps who says they own the foes: the first `o: 1`, until that account has said nothing for
  `STAR_ORPHAN_MS`. A wave cleared, a blow count and the master's fall are believed from the owner alone.
- **The machine.** `stepStar(led, now)` moves the ledger on every word: the gathering, each wave and its breath, the
  master. The light falls by the owner's blow count, credited no faster than `STAR_BLOWS_BURST` (6) and
  `STAR_BLOWS_HZ` (9) a second; the breath's light is added once a breath. The wave's size is fixed when it starts.
  The owner's deaths are credited to the wave its word names (`kw`) alone, and a wave cleared (`wc`) likewise: the
  owner's screen says the last wave's deaths through the breath, and the word that ends the breath starts the next -
  credited there, the new wave would stand already dead and run its hundred seconds empty (the audit's second).
- **The fan.** A ledger that moved says `{t:'star', k:'st', ...}` to the cell (`starLedgerState`): the phase, the wave,
  its size and the deaths said of it, the time left in the phase on the encounter clock, the light, the defenders and
  their band, whether an owner holds the foes and the blows credited to it (an owner whose page reloads counts on from
  them), held or lost and why. A word that moved nothing is answered with the same, to its speaker alone. The copy the
  SPEAKING socket gets - in the fan and in that answer - carries its own account's credited blows (`hm`), so a
  reloaded or new device counts on from what the relay credited it, owner or not; everyone else's copy has none.
- **Dawn.** A star unheld by its deadline and `STAR_GRACE_MS` (`starLostAt`) is lost - so a master's fall said as the
  deadline came, still in flight, holds it (the audit's third: the grace let such a word in, and the star was lost at
  the deadline all the same). The cell's alarm is armed there: a star unheld by then is lost with nobody there to step
  it, and said to the cell. A cell keeping a star forgets nothing else until the star is forgotten. The client says its
  last word at the deadline (its star leaves `fallen` then - `starClockPhase`); the grace is the flight's alone.
- **Held, said once.** The master's fall mints a receipt for each account that EARNED it - struck one of the star's
  foes and said so from the star within `STAR_PRESENT_MS` (15 s) of the fall - writes the ledger with them (kept before
  it is said, AUDIT WB A10), fans `hd` to the cell, hands each earner's receipt to its account's newest socket there,
  and tells the hub (`STAR_INTERNAL_HELD`) until it answers. The alarm's sweep that meets a star mid-mint leaves it to
  the word minting it. The hub keeps the receipts (checked for their account and star, signed; the newest
  `STAR_RC_KEEP` an account, each a day) and hands each to its account wherever it stands, then says the hold to
  everyone online once and keeps the night's held stars (`STAR_HELD_KEY`) until its last star is gone
  (`starNightGoneAt`). A hello is handed both.

## 6. The receipts and the rewards

**The receipt** (`net/starfall/starReceipt.js`): `j1.<base64url({ sf, s, c, l, i, e })>.<signature>` - `sf` the night
and the star, the account, a seed from the relay's CSPRNG, the level its last word at the star said, issued and expiry
(a week). Signed by the relay's one key (`GATE_SIGNING_KEY`), the version inside the signed bytes; its six fields and no
other, so no other signed shape reads as one. The Heart-Star is not in it: it is the sky's (section 1), and every
device reads it off the receipt's night and star alike.

**The account service** (`server-account/src/stars.js`, `/v1/star/claim`, migration `stars_held`): verified with the
relay's public half, counted once a (night, star, account), at most `STAR_CLAIMS_DAY_MAX` (9) a UTC day; pays the
character three quests' Renown (the raid's `renownRaidXp` measure, for a fight about as long) and strikes
`STAR_SILVER` (30) silver under the day's combat cap; the cards say *Stars held: N*. A guest is counted once it
registers. On `recorded` the client notes the act `star-held` (the questline's witness, section 7) for the character that
held the star, and `heart-star-held` beside it for the Heart-Star.

**On the device**, rolled from the receipt's seed (`systems/starfall/starSpoils.js`, the spoils pool under keys of its
own): gold (60 a level, a fifth either way); one to three pieces of **Starfall Glass** (a trade good of the port's own,
item template 576 - pale glass that still holds some of the star's light; it sells well); one piece Magic or better, known;
and a quarter of the time a piece of **the Starspun Weave** - the Starfall's own Aetheric set (Mephala's, `sigilSets.js`
`starspun`, its powers through SET2's seams, `11-Multiplayer/Sigil-Sets.md` 6f). The Heart-Star doubles the gold and
the glass, and always gives a Starspun piece.

**As built (STAR7).** The service (`server-account/src/stars.js`, migration 0141, acct165) counts a (night, star,
account) once in `stars_held`, at most 9 on the UTC day the star FELL (a receipt claimed a day late counts on its own
day), pays the Renown on the raid's measure charged to its hour, and strikes 30 silver (`net/marksLaw.js` MARKS `star`,
`MARKS_COMBAT`'s kinds) under the day's combat cap; a guest's claim writes the spoils row alone (`star_spoils`, keyed by
the device's claim id). The device carries the receipts (`net/starfall/starClaims.js` - the serpent's carrier, its own
keys) and the Starfall host's rewards (`scenes/starfall/starRewards.js`) roll the spoils when the service says the claim
is theirs (`systems/starfall/starSpoils.js` - the raid's thanks' measure: the source a treasure pile's, halfway up the
ladder; the set piece LAST, the ladder's last pass and the technique pass after it), give them into the pack through the
world's one door under the star's own pool keys (`star7.spoils`), keep the crash's record until a save holds them (its
stand-up door and the realm save's hooks), adopt the Renown for the character that held the star alone, and say the
silver's lines and cards (`Star held`). **Starfall Glass** is template 576 (`systems/starfall/starglassRow.js`, the leaf the
item law reads headless as it reads the Weir Key's - the account service loads none of the game; `starglass.js` its name
and picture): miscellany, 0.1 kg, 400 gold, stacked, traded freely, its own painted sliver under pseudo-archive 38302
(`world/starfall/starglassArt.js`). **The Starspun Weave** is nine Elven pieces at the Legendary band's floor (the raiding
parties' measure - a star is held three times an hour): a cowl, both pauldrons, a cuirass, the hands, greaves, boots, a
buckler and the Spindle-Blade, a one-handed shortsword - no poison resistance on a piece (Spinner's Thread carries it).
Its tiers: **Spinner's Thread** (2), poison resistance and Agility; **Bound in Silk** (4), every 4th weapon hit that lands
on the same foe deals 60 to 140% more, the count each foe's own and falling away 8 s after the last hit; **Mephala's
Veil** (6), a foe's blow that takes the wearer under 30% health hides them - Chameleon for two to four rounds - recovering
in 240 to 120 s (never one of the Spire's death saves: it saves no life). The cards say *Stars held* (`enhancedAccount.js`,
`profileWindow.js`).

**AUDIT STAR (2026-10-20) - the glass's name.** STAR7 named it Starglass, the name the Eltheric Ocean's trade good already
wore (`systems/naval/tradeGoods.js`, template 1340, a ship's cargo). The harbour's exchange counts a good by its template,
so a captain carrying the star's glass read *have 0* beside a row of the same name. The star's is **Starfall Glass** now,
wherever a player reads it (its row, its card, its lines); the code keeps its `starglass` names, and the sea's good keeps
its own. No custom row's name may be another's (`test/systems/starfall/auditstar.test.js`, every home of a custom row
imported), but two mods' own fruit rows (Climates & Calories' and Foraging's Apple and Orange, their data verbatim). Its
card says what it is and what it is for (*Pale glass from a fallen star, still holding some of its light.* *Any merchant
pays well for it.*), the Soul Cake's shape, in the classic info box and on the enhanced card.

**An answer lost after the batch (AUDIT STARFALL B3, AS BUILT).** The claim's one batch is the whole of its money: the
row, the Renown, the silver and INT5's fill of the playing character's budget, which ran after the batch as the raid's
does and was lost with any failure between the two (`server-account/src/budget.js:"export function spoilsGrantStatement(db, playerId, pieces = 0, guard = null, ...binds) {"`,
held to the claim's own row by its nonce). What still runs after it is no credit: INT17's measure (a debit a lost answer
only spares), the Renown order (signed again), the silver's answer (struck in the batch). The row carries the device's
claim id (`stars_held.cid`, migration 0141), so a retry of an answer lost after the commit - a 5xx past the batch, a
dropped line - is answered `claimed` with `own: true` where the row is that device's, and with what the lost answer
said: the count and the Renown the row credited its character
(`server-account/src/stars.js:"if (!thanks || had.cid !== cid) return { recorded: false, why: 'claimed', held, spoils };"`).
The device marks a kept receipt whose attempt went unanswered (`lost`: no answer, and no refusal the service made) and,
on such a `claimed`, finishes it once - the act owed, the line said, the Renown adopted by the character that held it -
the mark cleared as it finishes, so an answer heard is never finished twice and another device's row never at all
(`net/starfall/starClaims.js:"const found = !counted && answer?.ok && answer.data?.why === 'claimed' && answer.data?.own === true && e.lost === true;"`).

**The act is the holder's (AUDIT STARFALL 7, AS BUILT).** A receipt is kept with the character that held the star, and
its act is that character's quests': noted while it stands here (`createStarClaims`'s `who`, the Starfall host's
`characterIdOf(playerEntity)`), else owed it on the device (`star7.acts`) and noted when it stands, one star a poll -
never noted for another character, never dropped (`net/starfall/starClaims.js:"function owe(e) {"`). Its Renown was
already the holder's alone.

**The Heart-Star's act (T-A, AS BUILT).** A counted Heart-Star (`systems/starfall/starfallNight.js` `heartStar`, off the
receipt's night and star) notes `heart-star-held` beside `star-held` in the same turn
(`net/starfall/starClaims.js:"const noteStar = (heart) => { noteAct('star-held'); if (heart) noteAct('heart-star-held'); };"`),
an act of the endgame family as its star's - so the festival's finds hear the two as one deed and ask one find
(`systems/festival/festivalClient.js` ONE DEED, ONE FIND). The line's scripts may ask it as an optional objective.

## 7. The questline - The Thirteenth of Frostfall (AS BUILT, STAR8)

`thirteenthFrostfall` (`systems/questlines/qlLines.js` QL_LINES), tier 3, a group of its own (`festival`), from level
6, online, a registered account, and only while the Starfall runs (`opens.event: 'starfall'`). A step whose deed is a
star waits while the Starfall is not running (`needs: ['starfall']` - "Opens during the Witches' Festival.", said once
though the opener and the first step both need it), and the window draws no line that has not begun outside its event
(UI-Calm's law); a line begun stays drawn out of season, its starred step waiting - and a star step the Festival ends
under is set aside, fail-free, until the next (AUDIT STAR8 S2, below). The giver is **Morwen, a Wyrd Sister of
Glenmoril** - of the Witches' Festival's Glenmoril Wyrd, whose sisters stand at the taverns' doors (the port's own) - met
at the Glenmoril Coven in Ilessan Hills (`permanent GlenmorilCoven`).
The villains are the Sisters of the Bluff, whose coven stands nearest the capital (`permanent BluffCoven`). The line's
own lore holds with the canon (section "The lore"): FACTION.TXT's Glenmoril Witches (#419) summon Hircine, the Sisters
of the Bluff are #423, the Order of Arkay #82.

**THE SEASON.** `opens.event` names a step need; the line opens only while it holds
(`systems/questlines/qlLines.js:"export const eventHolds = (l, probe) =>"`), and the window's rows leave out a line not
begun while it does not (`systems/questlines/qlLineRunner.js:"return QL_LINES.filter((l) => lines[l.id] ||"`). The need
`starfall` is the festival's calendar at the runner's clock
(`systems/questlines/qlLineRunner.js:"starfall: (/** @type {number} */ nowMs) => starfallRuns(nowMs),"`) - the same answer
the Starfall's host and the relay give. (As first built the need also waited on a staged live event, kept for the runner
in a leaf of its own; the festival's calendar made both unneeded when its pull request was folded in, and they are gone.)

**THE COVENS ARE OPEN AIR - the departure.** In ARENA2 both covens are location type 13 (Glenmoril Coven, locationId
0xc358, region 60; the Coven on the Bluff, 0xc360, the Daggerfall region): one RMB block, no building, no dungeon, so no
quest marker. DFU's `place npc`, `place foe` and `place item` stand a thing at a site's marker, and a coven has none for
them to take. The scripts meet there by ARRIVAL instead: `pc at _glenmoril_` (and `_bluff_`), and a `when` task that
starts the meeting's own task once (a `when` task re-arms its actions each time it clears - DFU's always-on triggers -
so the latch is the `start task`). Morwen speaks as the player reaches her fire (a message, no Person stood); the Spinner
and her three sisters are called up by `create foe ... 1 times` from the latched task - once while they stand, and again
only when the whole coven is gone unfought (AUDIT STAR8 S1, below).

| Step | What the player does | Witness |
|---|---|---|
| QLTF01 Music in the Woods | Morwen's letter from a Wyrd Sister at a tavern's door - her window opened (`ql act wyrd-met 1`) - or, a star held before any Sister is met, her raven's note; hold a fallen star (`ql act star-held 1`); reach the Glenmoril Coven, where Morwen steps out of the trees | star |
| QLTF02 The Coven on the Bluff | reach the Coven on the Bluff; the Spinner (a Sorcerer) and three Sisters (Nightblades) come; slay the Spinner - the spindle of black thread the player's as she falls, the Sisters of the Bluff's favour lost (-10) - and a coven gone unfought is called again (`ql gone`); back at Glenmoril, unwind a length to sell (`unwound`, greater pay - Morwen buys it herself rather than see it sold) or give it whole (`wound`, lesser pay, the Glenmoril Witches +3) | |
| QLTF03 Three Stars | hold three more stars (`ql act star-held 3`) - every star held is a strand the web loses; Morwen's raven brings word and purse - the line's title, Starwarden. Never a gate: the Heart-Star held while it runs (`ql act heart-star-held 1`) is `heart` - greater pay and "Heart-Star Ring" | stars3 |
| QLTF04 What the Thread Is Worth | the holiday's own clash, asked at Glenmoril: burn the spindle in Hircine's fire (`burned`, lesser pay, the Glenmoril Witches +10, "Morwen's Hunt-Charm"), sell it to a mage of the Mages Guild at a guild hall (`guild`, greater pay, "Starglass Rod"), or carry it to a priest of Arkay at a temple of Arkay (`templeArkay`; `temple`, standard pay, the Order of Arkay +5, "Thread-Cutter") | |

**THE TITLE ON THE THREE STARS - a departure from this page's first design**, which put it on QLTF04. A title is paid
only on a step the service witnessed (`qlTitleSteps`), and QLTF04's choice is the client's: the Burning Doors' law -
the service pays only what it saw. So Starwarden is laid on QLTF03's end (`titleAt: 2`), once QLTF01's star and QLTF03's
three are witnessed (`net/questlineClaims.js` QL_SERVICE_LINES).

**THE WITNESSES** (`server-account/src/questlines.js` QL_WITNESS_SQL, over `stars_held` - STAR7's claim, `stars.js`):
`star` the account's first star claimed in the step's window; `stars3` its third (`ORDER BY s.at, s.star LIMIT 1 OFFSET
2`), each newer than the earlier witnessed step's `seen_at` - so QLTF01's star is never one of QLTF03's three. AUDIT
STARFALL B2: that floor held only once QLTF01 was done, and QLTF03's end asked first read its window from the line's
opening - the first star counted for both steps, and the Starwarden was paid on three stars, not four. An end now waits
while an earlier witnessed step of its line is not done (`server-account/src/questlines.js:"export function qlInOrderSql(lineId, step) {"`):
answered `witnessed: false`, and asked again by the runner as every unwitnessed end is.

**THE STARWARDEN'S PURSE (T-B, AS BUILT).** The title's write lays 30 Soul Cakes (`net/festivalLaw.js:"export const QL_STARWARDEN_CAKES = 30;"`)
on the account's count in the same statement, under the title's own guard - once an account - while the festival is
open for the account at the claim's clock, never to a guest; answered `purse` (`06-Systems/Witches-Festival.md`, "The
Starwarden's purse").

**THE ACT.** `star-held` (`systems/questlines/qlActs.js` ACT_KINDS, the endgame family) is noted by the receipt's claim
on `recorded` (`net/starfall/starClaims.js` - STAR7's), once a receipt, for the character that held the star (section 6,
AUDIT STARFALL 7); `heart-star-held` beside it for the Heart-Star (T-A), for the line's optional objective.

**WHAT THE MACHINE GAINED.** `ql name` names a Foe as well as a Person: `ql name _foe_ <Name> [female|male]`
(`systems/questlines/qlActions.js` QlName) sets the foe's name, and the gender word sets a class enemy's
(`isClassEnemyId`) - DFU's Foe.cs SetFoeName rolls a class foe 55% male, and the Spinner and her Sisters are women. A
gender on a monster is refused with a warning. The spindle is handed over by `get item` (no reward), never `give pc`:
a `give pc` of any item is the layer's reward, and it would settle the outcome's gold scaling before the choice is made
(`questReward`, `06-Systems/Questlines-Arc.md` section 2.3). The Guild's buyer is a Person of the Mages Guild stood at a
remote guild hall; the temple's, a priest of the Order of Arkay at a remote temple; each takes the spindle by `toting
_spindle_ and _who_ clicked`.

**THE AUDIT (AUDIT STAR8, 2026-10-20) - what was fixed, and what ties the line to the Festival.**

- **S1 - the Spinner can leave the world; the spindle cannot.** The spindle was on her body alone, and she came once:
  the encounters' cull (a quest foe is not `placed`, so past 120 m it goes), a death's teleport (`exteriorFoes.js`
  clearLive) or a load could take her, and the step could never end. The spindle is now the player's as she falls (`get
  item _spindle_` in `_spinnerslain_`), and a new trigger of the questlines' own, `ql gone _spinner_ _sisters_`
  (`systems/questlines/qlActions.js` QlGone; `06-Systems/Questlines-Arc.md` section 2.3), clears the ambush once the coven
  is gone unfought: one of them stood, none stands now, the Spinner unkilled. A foe stands while its pool drives its
  behaviour within `FOE_STANDS_TICKS` (`systems/quest/machine.js` questFoeStands, the machine's `beat`) and has not
  fallen - so a second coven is never called while one of the first still stands. Its task stands between the arrival's
  and the ambush's, so the ambush is updated unset before the arrival sets it again (CreateFoe's re-arm waits on that
  edge, InitialiseOnSet).
- **S2 - a star step the Festival ends under.** Its needs were read only as it started, so its sixty days ran down on a
  deed no star was left to do. The runner sets it aside, fail-free, and takes it up at the next Festival
  (`systems/questlines/qlLineRunner.js:"function keepSeason(l, rec, q) {"`); the row waits, "Opens during the Witches'
  Festival.".
- **S4 - the priest of Arkay in Arkay's temple.** `Place _temple_ remote temple` took any god's (396 of the Bay's 2,980
  temples are Arkay's). The questlines lay a row of their own on Quests-Places, `templeArkay` (p3 21, FACTION.TXT's
  Arkay - `qlActions.js` QL_PLACE_ROWS, as Roleplay & Realism lays its own), and `systems/quest/place.js` holds a temple
  to its row's faction as DFU holds a guild hall to its (Place.cs CollectQuestSitesOfBuildingType, IsGuildFactionMatch;
  IsPlayerAtBuildingType). A DEPARTURE: DFU reads no temple's faction; its own `temple` row names none, so no DFU quest
  moves. A region with no temple of Arkay (Alcaire, Gavaudon, Betony in the player's MAPS.BSA) begins no QLTF04: the
  step waits a day and is offered again wherever the player stands (LINES-19's stall) - Betony has no Mages Guild hall
  either.
- **S5, S6 - the words.** The coven is open air (Morwen's fire lights the clearing, never a hall); one coven a night
  holds the rite, and Glenmoril and Wroth never ("The covens take turns at the same rite, a night each."); nothing is
  said twice; QLTF04's box no longer thanks Morwen's way after a mage's or a priest's purse; the unwound length Morwen
  buys herself; the sheets' objectives are short ("Hold a fallen star", "Hold 3 more fallen stars"); and the holiday is
  TEXT.RSC 8392 (8349 plus its id, 43), not 8349.
- **S8 - the Sisters' favour.** Slaying the Spinner costs the Sisters of the Bluff (#423) 10 (`change repute with`, a
  stand-in Person of their faction - A0C0XY04's `_dummymage_` way), so the Bluff's own witch no longer serves as before.
- **T1 - the Wyrd Sister hands over Morwen's letter.** Opening a Wyrd Sister's window is the act `wyrd-met`
  (`scenes/witchesHost.js` shop - the festival's module, never a host's own scope), and never a Soul Cake find
  (`systems/festival/festivalClient.js` ACT_NOT_FOUND). The raven is the fallback, but on a deed, not a clock: online
  REST8 cuts a delay to the short wait (`systems/quest/clock.js` ONLINE_DELAY_SECONDS, two real minutes of play), so a
  raven on the courier's clock would beat every Sister. A star held before any Sister is met brings the raven's note;
  one word or the other, never both. Morwen speaks of her sisters at the taverns' doors.
- **T2 - the Heart-Star.** An optional objective of QLTF03, never its gate: the act `heart-star-held` (said by the
  receipt's claim, `net/starfall/starClaims.js`, beside `star-held`) is the step's own bonus - the `heart` outcome, the
  greater pay and Morwen's "Heart-Star Ring" among the choice of three. The service's own pay on the step is the
  service's (`server-account/`).
- **T3 - the Wyrd know the Starwarden.** The Wyrd Sister's window shows the line's title among its insignia, beside
  Hearthkeeper (`ui/wyrdWindow.js` wyrdRows): held as the account's wardrobe says, worn there, never sold.
- **T4, NOT DONE** - Morwen's greeting a line of its own on the nights the dead walk. A script cannot read
  `net/festivalLaw.js` deadWalk without a new trigger reading the sky's day and the wall clock, and its timing against
  her meeting's own `end quest` (QLTF01) and question (QLTF04); not cheap, so left.

Pinned by `test/systems/questlines/star8_frostfall.test.js` (the line, the season, the hub's word, the foe's name, the
scripts run on the machine over a rig of both covens, and the covens open air in ARENA2; the audit's: the coven called
again and never twice, the letter's two ways, the Heart-Star, the step set aside, Arkay's temple, the words, and TEXT.RSC
8392 in ARENA2), `test/scenes/witch1_host.test.js` and `test/systems/festival/witch1_client.test.js` (`wyrd-met`, and
no find), `test/systems/festival/witch1_wares.test.js` (the Starwarden's row), `test/server/ql12_claim.test.js`
STAR8 (the witnesses and the title through the Worker; AUDIT STARFALL B2's out-of-order ends for this line and the Weir
Road; T-B's purse, paid once, never closed, never a guest's, and heard on the page), `tools/mutants/star8.json` and `tools/mutants/star8_audit.json`.

## 8. What a player sees and hears

The words keep WB13b's rules (`World-Bosses.md` section 20, WB13b): the event, then what to do, and stop; no "X, not Y";
no dash asides; numbers as numerals; at most one exclamation; times in the player's own local time.
STAR6's words test holds every line.

| moment | who | line |
|---|---|---|
| the omen | everyone online in the region | *A star is falling toward Gothway Garden. The Daggerfall Witches are at their rite.* |
| the fall | everyone online in the region | *A star has fallen near Gothway Garden.* |
| the first wave | at the star | *The coven comes for the star!* |
| waves 2, 3, 4 | at the star | *What the coven called comes out of the dark.* / *What the coven made comes for the star.* / *Mephala's own join the fight.* |
| a breath | at the star | *The star's light steadies.* |
| a quarter of its light left | at the star | *The star is going dark!* |
| the master | at the star | *The Coven Mother comes for the star!* (each master its own: *A Flesh Atronach rises from the crater!*, *A Daedra Lord answers the coven!*, *Mephala sends a Daedra Seducer!*, *The chant wakes an Ancient Lich!*) |
| its circle | at the star | *The Coven Mother calls her circle. Break it!* (each master its own: *The Daedra Lord calls its circle. Break it!*) |
| the circle broken | at the star | *Her circle is broken.* |
| held | at the star | *The star is held. Its thread burns away.* |
| held | everyone online | *The star near Gothway Garden is held by Ann, Bran and 2 others.* |
| lost | at the star | *The coven has taken the star.* |
| dawn | at the star | *Dawn. The coven pulls the last light home.* |
| spoils | the claimant | *The star's spoils are in your pack.* |
| the claim | the claimant | *Star recorded. Stars held: 3.* / a guest's *Star not recorded. Add a username within a week to keep it.* / *You have held enough stars for today.* |
| the day's silver met | the claimant | *No silver for this star. Today's cap of 150 silver is reached.*, and the card's *Daily silver cap reached* |
| the Veil | its wearer | *Mephala's Veil! Chameleon for 10 s.* |

**The tracker** (`ui/starfall/starTracker.js`, a readout made once and updated, never rebuilt; Enhanced Plus's kit by
role, and in every skin, as the gate's bar is - a fight is read whatever skin is worn): within `STAR_HUD_M` (400 m) of a
star - *Fallen Star*, its town, its coven, *Wave 2 of 4* or *The master* or *Held* or *Lost*, the light as a bar, and
the time to its deadline. **The master's bar** is the gate's (`ui/gate/gateBossBar.js`, theme `star`): the master's
name, *Master of the Fallen Star* (the Heart-Star's: *Heart of the Web*), its health, and *2 of her circle stand* while
the ward holds. **The map** marks each star of the night with a card; **the compass** points to the nearest within the
region; **the timers** row says the night's coven and the next fall.

**As built (STAR6).** Every line goes through the text core (`systems/starfall/starWords.js`, `t('starfall.*')`, its
names as arguments), held to WB13b's style by a law over all of them (`test/systems/starfall/star6_words.test.js`). The
Timers window shows each fallen star still undecided counting down to its deadline (*Fallen Star*, *Near Gothway
Garden*, *The coven takes it when this runs out*) and the next to fall counting down to its landing (*A star falls* - the
Heart-Star's own words - its town from its omen on, as the region hears it, and *The Daggerfall Witches are at their
rite*), the next night's first once this night's last is down (`systems/starfall/starfallClient.js` starTimerRows). The
held map's cards ride the raids' reader and a violet four-pointed star of its own (`ui/ink/inkMap.js` paintStarMark).
**The compass's door, fixed at its root**: the world host had handed `drawHud` the sea serpent's and a found Hollow's
compass marks since SERPENT1 and SD2c, and `drawHud` dropped both - neither ever showed on the enhanced strip. It
forwards them now, and the star's beside them (`ui/hud/hud.js`). The star's colours are one leaf
(`ui/starfall/starMapMark.js`), so the Timers sheet imports nothing that imports it.

**AUDIT STAR (2026-10-20; the owner: text and UI "enhanced plus + not AI-like and overexplanatory").** The words and the
plate read again, each finding fixed:
- **Each master's circle is its own line** (`systems/starfall/starCoven.js` STAR_MASTERS `circle`, beside its `call`). One
  shared line dropped a name in, and four of five read *Flesh Atronach calls its circle.*, no article.
- **The fight's calls say their own things.** *comes for the star* stood five times; it stands three (the first wave, the
  third, the Coven Mother).
- **The claim says it in the gate's shape** (*Star recorded.*, *Star not recorded. Add a username within a week to keep
  it.*), the day's bound in the festival's voice (*You have held enough stars for today.*, beside its *You have found enough
  for today.*), and the spoils' line says the spoils, gold and a piece as well as the glass.
- **The cap's line hands the language its number** (`{cap, number}` - it had handed every translation the English *150
  silver*) and stops; the haul card's cap is a label through the text core (`ui/haulCards.js` haulCappedText), its colon
  gloss gone.
- **The Veil says its effect** (`systems/sigil/sigilSetPowers.js` VEIL_TEXT): *Chameleon for 10 s.*, never *The web hides
  you.* Its spell's name and its chip's go through the text core, as Soul Harvest's do.
- **The light bar is named** *Light* (the tracker's gauge; the key was translated and never shown).
- **The plate stands in the column, not over it.** It had stood at 24% over the quest card and the party list, the same
  right-upper column. It stands under the quest card now (`--dfquest-h`), publishes its own bottom as the card does
  (`--dfstar-h`), and while it stands the party list steps under the lower of the two (`ui/starfall/starTracker.js`
  STAR_TRACKER_CSS - the party list's own rule untouched). Under 1100 wide, where the compass, the foe's frame and the
  master's bar (460, centred, from 58) share the width, it keeps its 24%, and under the bar itself while the bar stands
  (176 on a phone, 148 on a short screen); a phone keeps 16% and its list at the foot, kept under the plate. 1000 wide and
  under, the quest card steps aside while the master's bar stands over its corner, keeping its line, as it does for a
  bout's bar. Measured in
  Chromium over the real sheets (`tools/starHudProbe.mjs`), classic and Enhanced Plus, at 1920, 1280, 1024, a landscape
  phone and a portrait one: nothing in the column covers another.
- **The countdown is not read out every second**: the phase line alone is `aria-live`.
- **The master's bar says *Warded* and *Felled* in the player's language** (`model.wardedText`, `fallenText`; the ward the
  gate's half's own key).

Pinned by `test/systems/starfall/auditstar.test.js` and the STAR6 words test's column law; `tools/mutants/auditstar.json`.

**The sound** (`systems/starfall/starSounds.js`, DAGGER.SND's own records, pitched - no new clip): the omen's rising
whine, the fall's roar, the impact's thunder at its distance, the star's hum near it, a blow on the star, the thread
burning, the dark.

**As built (AUDIT STARFALL, 2026-10-20).** The stone's strike is heard its distance late with its thunder
(`starHeardAfterMs`, the storms' own speed of sound), never with the flash, and both are played from the heart as it
stands when they arrive - a recentre between the landing and its thunder moved it (R7). A first ledger is taken in
silently: a page that comes to a star mid-fight hears what moves from then on, never a wave, a loss or a hold that
happened before it came as though it happened now (R8). And the festival's last stars stand to their end: a star that
LANDED inside the festival is drawn, timed on the Timers and marked on the map past the festival's close until it is
gone (`starfallStands` - the festival open `STAR_LIFE_MS` and `STAR_AFTER_MS` ago), as the relay keeps its ledger to its
deadline; the first build tore them off every screen mid-fight at the close (C5). A star past its deadline is not dark
until the relay's grace is out (`starLostAt`): this screen's last word is at the deadline (section 5, Dawn), and a hold
that lands in the grace turns its stone and its beacon gold from lit, never from dark first (WP1's note).

## 9. The wire

| frame | way | what |
|---|---|---|
| `{t:'star', n, k, px, py, lv, s, o, kw, kn, wc, hb, mf}` | client -> cell | the star's word (section 5) - `kw` the wave its deaths `kn` belong to, 0 to `STAR_WAVES` like `wc` |
| `{t:'star', k:'st', n, s, px, py, p, w, wz, kn, wl, lt, nd, b, ow, hc, hd, lo, why, hm?}` | cell -> cell, cell -> a speaker | the ledger: phase, wave, its size and deaths, the time left in the phase, light, defenders, band, an owner and its credited blows, held, lost and why; `hm` on the speaking socket's copy alone - its own account's credited blows, a count bounded like `hb` (`STAR_BLOWS_WIRE_MAX`) |
| `{t:'star', k:'hd', n, s, px, py, at, top, c}` | cell -> cell, hub -> everyone | held, by whom (the first `STAR_TOP_MAX` named, `c` how many) |
| `{t:'star', k:'rc', r}` | cell or hub -> one | an earner's receipt |
| `{t:'star', k:'hds', l: [...]}` | hub -> a hello | the night's held stars |

`STAR_RELAY_MIN` names the first relay that speaks it (`relaySupportsStar`), and an older relay is never sent a word.
`STAR_HZ_MAX` bounds a socket's words (the rite's bucket, deeper than the client's burst). No live event gates it: the
stars keep the festival's own days (section 12).

## 10. Trust and its bounds

**The departure from Option B, and why.** The gate, the serpent and the Remnant are fought on ground the relay can see
whole: a flat disc, a sea. A star falls in the open country, among trees and slopes, with a coven of Daggerfall's own
foes - spells, bows, flight, pathing - and three stars a night across a region. A relay-run body has no path, no spell
and no melee in the open world (`World-Bosses.md` section 26: melee on a relay's body is the dungeon's alone). So the
foes are the players' machines' own, as every foe in the open world is (co-op's law, `Multiplayer.md`), and the relay
holds what it can check: the window, the cell, the pose, the order of the waves, the pace, the owner, the receipts.

**What the relay cannot check, said.** A word is its player's own. The owner's machine runs the foes, so the owner's
word moves the waves, the light and the master's fall. A modified owner could clear a wave early (never sooner than
2.5 s for each foe of a defender's share), drain the star (never faster than 9 blows a second) or call the master fallen (never sooner than 45 s
after it stood). The last pays the defenders who struck and stood there; the service bounds what a receipt is worth
(once a star, nine a day). A word for a forged pixel is a ledger of its own and stands in no other's way: once over it
costs no place, and while live it keeps one against a new star only while somebody stands at it - an account stands
at one star at a time, so N accounts hold at most N of a cell's four places, and never the place of a star a defender
stands at (section 5, the cell's places). Four accounts standing at four forged stars in one cell can still make a
fifth, real star there wait while they stand; that is the bound, said. The relay does not know whether the live event
is staged; the dated window bounds what it pays.

## 11. The hosts, and the room made in bootWorld

**THE FOUR HOSTS.** `scenes/world.js`, the streamed world, wires the Starfall (`scenes/starfall/starfallHost.js`).
`scenes/exterior.js` (the bench: no relay, no streamer), `scenes/worldModes.js` (a building's inside: no sky, no star)
and `scenes/dungeonContext.js` (underground) are named and carry none of it, by design (pinned by source, the
serpent's law).

**THE HOSTS DO NOT GROW.** `bootWorld` stood at its ceiling with no room (`test/scenes/hostceiling.test.js`). STAR0 moved
the exterior town map's door out first (`scenes/exteriorAutomapToggle.js`, by `tools/hostMove.mjs` - `01-Overview/Host-Split.md`,
STAR0's move): 67 logical lines freed (36,183 -> 36,116), the ceiling kept; the Starfall's wiring spends less than that.

**As built (STAR4-STAR7).** The Starfall's host reads the world's bindings by name (`createStarfallHost({ renderer,
state, exteriorFoes, ... })` - its settled ones by value, every live one through a getter), so its wiring in `bootWorld`
is the adapter and one hook at each door: the frame, the lights, the draw, the sky, the flash, the senses' candidates,
the compass, the held map, the Timers, the grass, the hub's event and the cell's words. The rewards (`starRewards.js`)
are made by the host on the same adapter; `bootWorld` keeps three hooks for them (the crash's door at a stand-up and the
realm save's two), and the spoils' one lock moved out of it to `scenes/spoilsPool.js` (`spoilsLock`). `bootWorld` stood at
36,170 of its 36,183 on the branch, and at 36,174 of 36,187 with main merged (2026-10-20).

**AUDIT STARFALL (2026-10-20).** Every fix above is the Starfall host's own (`scenes/starfall/starfallHost.js`, its pass,
its model and its sounds) and not a line of `bootWorld`: the world's handovers are read as they are (the host claims
what they hand), and the ring's ground, the coarse ground and the blows' account come through the bindings it already
had (`surfaceAt`, `gateGroundAt`, `storage`). The one change outside it is the star's own allowance in the foe pool's
reader (`scenes/exteriorFoes.js` livePuppetsOf, a kind of its own beside the camps', under
`world/worldOfDaggerfall/wodShared.js` WOD_STAR_PUPPETS_MAX).

## 12. The festival it belongs to (WITCH1)

The Halloween live event is the Witches' Festival (`06-Systems/Witches-Festival.md`, WITCH1), built beside this in
another session and folded into this pull request (2026-10-20), so the event and its add-ons ship as one release. Where
they meet:

- **The days.** The Starfall keeps the festival's own calendar (`net/festivalLaw.js` `FESTIVALS`, `festivalOpen`) - the
  relay, the host and the questline's need read it (the host to the last star that landed inside it - `starfallStands`,
  section 11); the first build's staged `witchfest` live event, its own two dates and the leaf that carried the hub's word
  to the questline were taken out with the merge (no build shipped them).
- **The switch.** The account service's `FESTIVAL_OPEN` (`server-account/wrangler.toml`) shuts the festival's economy -
  its finds, sales, set-outs, fills and takes - and nothing of the Starfall: the stars fall, are fought and held on the
  calendar alone, and a held star's spoils and claim are the Starfall's own (section 7). Shut, a held star's `star-held`
  asks no find (the client has heard the switch - `festivalShut`, `closed`), as no deed does; the hold itself stands. To stop the stars, the calendar is the
  lever (a release that changes `FESTIVALS`), never the switch.
- **The Soul Cakes.** A held star is the act `star-held`, of the endgame family (`systems/questlines/qlActs.js` - each a
  receipt the service holds), so the festival's finds hear it as they hear a breach closed: the service's die, the
  endgame's four cakes, twice on the nights the dead walk (`FIND_SOURCES.endgame`, `deadWalk`). One deed, one find: the
  master's body is a world boss's (`entity.worldBoss`, set by the host's `masterOf`), which asks no find of its own
  (`systems/festival/festivalFoes.js` `foeFindSource` - its elite's find beside its star's would be two for one deed).
- **The night.** The Heart-Star falls on the sky's 13th of Frostfall - the festival's own day in Daggerfall, and one of
  the two nights its finds give twice (`FESTIVAL_NIGHTS`).
- **The Glenmoril Wyrd.** The questline's giver, Morwen, is a witch of the Glenmoril Wyrd, the coven whose sisters stand
  at the taverns' doors with the festival's wares; the Starfall's covens are the rite's, never Glenmoril (section 2).
- **One release.** One relay version (world235), one account version (acct165); the festival keeps migration 0140 and
  the stars' is 0141. The titles: the questlines' six together (the Starwarden after the five), then the festival's two.
  The Aetheric sets: the Wyrd's Raiment, then the Starspun Weave.

## 13. Versions and deploy order

STAR-TUNE moves the relay alone, to **world238** (world236 on its branch, renumbered past LONE-HERALD's world236 and
FIELD BUGS 2026-10-20f's world237 at the merge with main): the wave's size and the breath are the relay's law, the `star` grant
kind its mint, the `st` frame's wave to twenty-four, and the foe bounds its strip reads (`net/foeBounds.js`); the star
word does not change, so `STAR_RELAY_MIN` stays 235, and the account service's version does not move. Relay first,
then the client - but the site goes live as soon as the account service answers its version, which STAR-TUNE does not
move, while the relay's deploy sweeps and waits out live fights first, so for an hour or more either side can be the
older (AUDIT STAR-TUNE):

- **A new client, an older relay (F1).** The client asks the `star` grant kind only of a relay that mints it
  (`net/grantLaw.js` `STAR_GRANT_RELAY_MIN` 238, the welcome's version - `online.js` `starGrantOk`); of an older one, the
  stand's own kind, main's (`site`, the master `kept`), whose waves that relay's law holds to nine. Asked `star`, world237
  answers `kind`: under `enforce` no wave stood, under `grantStrip` the coven was its owner's alone.
- **An older client, the new relay (F3).** An older client's `validStarOut` read `wz` nine at most and dropped the whole
  `st` frame past it - an older tab that owned a party's star stood its third wave on for nobody, nor the master. The
  cell says `wz` nine at most and a larger wave whole in `wx` (`net/wire.js` `STAR_WAVE_SIZE_OLD_MAX`); this client
  reads `wx` back into `wz`, an older one projects it away and stands nine (the wave still clears on its `wc`).
- **An older reader, a new owner (F3, not fixable from here).** An older reader's foe bound gives a camp's monster no
  coven's multiplier, so it removes a toughened coven foe whose health passes its old bound (silently, as a refused
  record) - by about x1.3 for the band-1 Spider, Giant Bat and type 3, x2.2-2.7 for the rest; a level-20 hero's threat
  alone is x1.48. Only its reload mends it; the bound would have had to ship a release before `toughen`.

Relay first (it signs), then the account service (its migration first), then the client. The relay's version moves for
the frame, the receipt and the hub's door - world235 (world233 on the branch, renumbered past SD-SEA's world233 and
DEX1's world234 at the merge with main, `STAR_RELAY_MIN` with it, so neither of those relays is ever sent a star's word;
then one release with WITCH1's world235); the account service's moves to acct165 for the claim and the questline's
witness (one release with WITCH1's acct165; the stars' migration 0141, after the festival's 0140). The item law's version does not move: Starfall Glass and the Starspun Weave are new records, never
minted before this, so no finding a law made could be a finding to ask again (its leaf is read beside the registry from the first).

## 14. The slices

| slice | what |
|---|---|
| STAR0 | this page; room in `bootWorld` (the serpent's block moved out) |
| STAR1 | the law: the window, the night, the stars, the waves, the light, the ledger, the receipt (`net/starfall/`) |
| STAR2 | the sites: the covens, the bag, the pixels, the Witches' Night (`systems/starfall/`) |
| STAR3 | the relay: the word, the ledger, the fan, the receipts, the hub (`server/src/index.js`, `net/wire.js`) |
| STAR4 | the world: the star's art, model and pass; the fall; the crater; the beacon; the sounds |
| STAR5 | the defense on the client: the camp, the waves, the ward, the master, the circle, the words to the cell |
| STAR6 | what a player sees: the tracker, the bar, the map, the compass, the timers, the words |
| STAR7 | the rewards: the claim, the service, the spoils, Starglass (Starfall Glass since AUDIT STAR), the Starspun Weave |
| STAR8 | the questline: The Thirteenth of Frostfall - four scripts and sheets, the `festival` group, `opens.event`, the `starfall` need on the festival's calendar, the `star-held` act, the `star`/`stars3` witnesses, Starwarden; `ql name` names a foe (`star8_frostfall`, `ql12_claim`) |
| AUDIT STAR | the words, the plate, the glass's name and the Weave's powers read again (sections 6 and 8; `Sigil-Sets.md` 6f) |
| AUDIT STAR-TUNE | STAR-TUNE read cold (pull request #1090): F1 the `star` kind asked only of a relay that mints it, F2 a wave's floor shared by its defenders, F3 an older tab's `st` kept (`wx`), F4 a crater built again asks the body again (sections 4, 10, 13; `Spawn-Grants.md` 4) |

## 15. Not done, and why

- **No Discord herald yet.** The gate's and the serpent's posts are the hub's alarm beat; a star an hour would post
  three times an hour. Left for the owner's word on how much of it the channel wants.
- **No lamia.** Daggerfall's lamia never leaves the water (section "The lore").
