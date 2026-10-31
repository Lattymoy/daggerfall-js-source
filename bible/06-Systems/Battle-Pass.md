# The Folios - Season One: Dwemer's Breach (STOREFRONT, PASS-PANELS)

> Design page and record (2026-10-29, reworked 2026-10-30), beside `06-Systems/Storefront.md` and `06-Systems/Aurum.md`.
> Where the page and the code disagree, the code's headers and the pins are what runs. Not a DFU member: Daggerfall Unity
> has no seasons, accounts or passes (Port-Ledger section A, STOREFRONT).

## 1. What was asked

The owner, 2026-10-29, with a developer's notes from the Discord: *"Battle Pass should not be just a Battle Pass. It
should be thematic Battle Pass like a 'Dwemer's breach'. And the whole world should change a little in relation to this.
Like new dwemer enemies, new boss, new weapon"*; *"divide the Battle Pass into 3 stages (20 days each)"*.

PASS-PANELS, the owner, 2026-10-30: *"I want to rework this to be more of a helldivers type system. Like a free panel
track and a premium panel track using our new currency to both unlock tracks and buy the items."* Asked how, the owner
chose: Aurum earned by deeds, world finds and Aurum caches; a panel opened by spending on its track; the premium track
opened with Aurum alone (the money passes retired); and tracks that never expire.

So the pass has no levels, experience, boosters or money passes. None of those had shipped: the branch that built them
was reworked before it merged.

**The name**, the owner, 2026-10-30: *"It shouldnt be called battle pass. Something more lore accurate. Also needs to be
a panel that you ope[n]. To reveal the track rewards. Like hell divers."* Asked, the owner chose **Folios**, and locked
pages that preview their items. A season's tracks are two folios the player opens and leafs through, page by page: Season
One's free track is **the Brass Folio** and its premium track **the Gilded Folio**. The player reads folio and page,
never pass, track or panel; the code keeps its `pass` names (`battlePassLaw.js`, `/v1/pass/*`), and so does this page's
file name.

## 2. The season

**Dwemer's Breach** runs 10 November 2026 to the end of 8 January 2027, UTC: sixty days in three stages of twenty
(`src/net/battlePassLaw.js` PASS_SEASONS). The Bay shakes; old Rourken works under High Rock and Hammerfell crack open to
the sky, and brass comes up out of them.

| Stage | Days | The world |
| --- | --- | --- |
| I. The Tremor | 10 Nov - 29 Nov | the ground shakes; two Brass Fissures open in each region's wilds; Spheres and Iron Golems climb out |
| II. The Brass Halls | 30 Nov - 19 Dec | three Fissures a region; Steam Centurions walk with them |
| III. The Heart Wakes | 20 Dec - 8 Jan | each region's Heart Fissure wakes the Brass Colossus |

The season's days bound its world and its challenges. Its tracks sell from its first instant for good, and the finds'
Aurum never stops (`passTracksOpen`, PASS_FINDS_FROM_MS).

## 3. The folios (the tracks)

Each season has two tracks of panels, the player's folios and their pages. **The free track** (the Brass Folio) is
every registered account's. **The premium track** (the Gilded Folio) opens once for 1,000 Aurum (PASS_PREMIUM_AURUM). Each item is bought once, for its own Aurum, in any order the open panels allow. A
panel opens when its own track has had its `open` Aurum spent on it; the first panel of each track is open from the start.
Every item is the account's for good, on every character, read off the row at every ask (`players.pass_items`).

| Track | Panel (opens at) | Items (Aurum) |
| --- | --- | --- |
| Free | I (0) | Dwemer Cog, glyph (200); Aetherium Shard, profile icon (300) |
| Free | II (300) | Tremor-Born, title (400); Brass Gate, portal skin (700) |
| Free | III (1,000) | Tonal Shatter, kill effect (700) |
| Premium | I (0) | Tonal Fork, glyph (200); Dwemer Lexicon, profile icon (300); Aetherium Coil, aura (1,000) |
| Premium | II (600) | Gearheart, profile icon (400); Brass Crown, glyph (300); Heart-Waker, title (600); Gilded Coil, aura (1,200) |
| Premium | III (2,000) | Echo of Numidium, title (800); Brass Automaton, mount look (1,600) |
| Premium | IV (6,400) | Aetherium Wings, aura (2,000) - the capstone |

**The capstone** (2026-10-30, the owner: *"for the final tiers we implement the developer wing aura has a light blue
style"*; asked, a page of its own at 2,000 Aurum). Page IV of the Gilded Folio opens at 6,400 Aurum spent on it, what every
item before it costs, so it opens only once all of them are bought. It holds the Aetherium Wings: the developers' Seraph
Wings - their mesh, measures, motes and beat - in aetherium's pale blue, their pool and their light on the world blue too
(`render/auraRing.js` AETHER_WING_RGB, kind 19). The developers keep the gold. A season's finds, challenges and the week's
deeds with a dedicated player's caches (six new dungeons a day, CACHES-ONCE) reach it inside the season; the folios
never close, so it waits for anyone slower.

The free track costs 2,300 Aurum, the premium 1,000 to open and 8,400 more. The owner's "No overbundence of titles and
profile icons" holds: one title free and two premium, three icons in all. The Brass Crown came with the retired Seasonal
Collector; it is the premium track's now, and no shop ware.

## 4. Aurum from deeds

The account service decides every find (`server-account/src/battlePass.js`), as it decides a Soul Cake: the page asks
with a deed's source, the service answers with the Aurum found. A UTC day pays 100 Aurum of finds at most
(PASS_DAY_AURUM), in one ledger line a day (`aurum_ledger` kind `find`), and hears 2,000 asks.

| Source | Aurum |
| --- | --- |
| a foe my blow killed; the dead; the summoned | 1 each |
| a Dwemer construct (the season's) | 2 |
| an elite or a champion | 4 |
| gathering; making; the loot's laws | 1 each |
| a tavern game won; the sea | 3 each |
| a world event | 8 |
| a quest done; a bounty paid | 10 each |
| the endgame (a breach closed, a Redoubt, the Serpent, a star held) | 20 |

**The challenges**, five a stage, count their deeds while their stage runs and pay their Aurum once, beside the day's
bound: 470 in the first stage, 560 in the second, 710 in the third (`aurum_ledger` kind `challenge`). With the week's
deeds and the caches (`06-Systems/Aurum.md`), a player who finds the day's 100 most days buys the free track in the
first month and most of the premium by the season's end. Aurum bought in packs buys the same items sooner.

## 5. Boosters (retired)

PASS-PANELS retired the Cog, Tonal and Heart Boosters with the levels they sped. They never shipped.

## 6. The world

`src/scenes/seasonHost.js`, on the bindings the world host shares with the Starfall's host; its law is
`src/systems/pass/seasonWorld.js`. Online alone, as the season is, and nothing of it stands before the relay's clock is
heard (`relayNowS`).

- **The tremor.** The first six seconds of every hour on the shared clock, in the open world: the camera kicked every
  350 ms under the player's own shake cap, swelling and dying away, harder each stage (1.5, 2.5, 4 - a gun's shot is 3);
  a rumble (`fx-season-tremor`), dust and grit shaken up about the feet, and the stage's line in the event board's news,
  a kind of its own (`season`, news alone, as the festival's).
- **Brass Fissures.** Two to each area in the first stage, three in the second and third: a Bay region, or a province's
  district past the Bay (W14, below). They stand on pixels the scan Dagon's Breaches use in their theatre finds suitable (land,
  no place near, a town close), drawn by hash from the season, the stage and the area, four pixels apart and 12 m past
  the roads' and tracks' bands (`FISSURE_ROAD_M`): every machine finds the same. A fissure gives way to its own
  theatre's gate of the day on its pixel or beside it. World of Daggerfall's rock keeps 26 m off it, and the grass off
  its scorch. On the map, the Bay's sheet or the continent's, each is a brass cog crossed by a blue crack, a Heart
  Fissure's larger and ringed, its card naming its town and what waits there.
- **A fissure, built** (`world/fissureModel.js`, its art `fissureArt.js`, pseudo-archive 38361): a scorched oval
  on the land, the crack's black depths with the aetherium's blue in them, short cracks off it, slabs of earth heaved up
  along both lips; round it a toothed cog past each end and one off the south lip, a split copper pipe, and a fallen
  brass pillar with its capital - the Sky-Ketch's metals. The slabs and wreckage are solid. Its three vents breathe
  steam, its blue lights the ground, and its hum (`fx-season-hum`) is heard beside it.
- **The constructs.** Each fissure's camp is Daggerfall Enemy Expansion's: the Centurion Sphere (289), the Iron Golem
  (270) and, from the second stage, the Steam Centurion (290) - Ketch's KT_LOOKS, on the surface. The first player
  within 90 m springs it on the camp law (`px,py:brass.<stage>.<k>`, reader-checked - no relay change); every other
  screen sees the owner's. One woken wakes the camp. Each is a find of 40. A camp is cleared on a screen whose last
  standing foes of it are all bodies now, whoever stood it; that character's fissure is then quiet twenty minutes, kept in
  the device's store across a reload (`dagger:fissureQuiet`). A camp gone without a body is no clear.
- **The Brass Colossus.** In the third stage each area's first fissure is its Heart Fissure: two Spheres and a Golem,
  and at the middle a Steam Centurion made a raid leader (half again its size, an elite's health and blows, its name),
  three times that health, and Warded, Stormproof and Blade-turning - bring a hammer; never the street's elite roll.
  Every screen names it by its site (`.h`), stands its three traits (`systems/bossTraits.js` bossTraitsMost) and bars
  it while it is near, and says its fall, with a body.
- **The Maul's day.** A character whose blow landed on the Colossus then asks the account service for **the Resonant
  Maul** (`POST /v1/season/maul`, `server-account/src/seasonClaim.js`): yes once a UTC day an account, inside the Heart
  stage, on the service's clock. The Maul is minted on that yes alone: offline, signed out or refused, none. A second
  felling that day is told why (`taken`, the account's refusal sentences, `accountClient.js` REFUSAL_WORDS). The ask is a
  progression claim, as the season's finds are (`progress.js` PROGRESS_ROUTES, the `pass` stream): the account's seated
  realm character is asked, and a session's secret alone is refused (AUDIT-STOREFRONT).
- **The Resonant Maul** (`src/systems/pass/resonantMaul.js`). A Dwarven warhammer of the Legendary rung: +30% damage, +12
  Strength, +25 Blunt Weapon, Resist Shock while held, and Resonance - +40% against the season's constructs, a bane under
  Dragonsbane's 50, inside THE CEILING HOLDS. **Unrolled**: lawful wherever the item law reads it (the account service's
  judge included), but no warhammer's roll lands on it, so every seeded roll draws from the pool it drew from before.

**Departures from the first draft.** Daggerfall Enemy Expansion has no brass spider (271 is the Blood Spider; the Ketch's
spider is a classic mobile tinted, and the surface has no tint), so the first stage's second construct is the Iron Golem.
The Colossus is not washed in brass for the same reason: its size, name, traits and bar say what it is.

**AUDIT LANE 5 (2026-10-29).** The season in the world read cold; thirteen findings, each fixed and pinned
(`seasonaudit_world.test.js`, `seasonmaul_service.test.js`, `seasonclear.test.js`, `fissureroads.test.js`). The Maul's
once-a-day bound was the page's store: a blocked store, a private window, a second browser or a clock set ahead each gave
another. Every reader capped a raid leader at two traits, so every copy and heir lost Blade-turning. One Colossus in
twenty stood the street's single elite trait. A camp taken down without a body counted as a fall. The quiet held only on
the stander's page, in memory. The clearings made each pixel's flats ask all 130 members; a box now asks the members on
its own pixels (`world/gate/gateClearance.js` setNear), the same boxes clearing: 4,000 flats 53 ms to 0.7 ms, the sweep
453 ms to 11 ms.

**A camp's stander walking off gives it up** (past `SEASON_LEAVE_M`, 260 m), with no hand-over: a Colossus half fought
stands again whole for the next player about ten seconds later. Kept on purpose, as the Starfall's leash (AUDIT STARFALL
C2): one owner holds a site, and the camp law hands a site's foes over only where the owner's pools go down at once (a
teleport, a death, the page's going - `handOverSiteFoes`). A walk-off hand-over would leave the walker's word on the site
while its heir stood it. It costs the fighters the damage done, never the Maul or the quiet, and a reset Colossus is
no easier.

**W14: the season in every theatre (AUDIT-STOREFRONT, 2026-10-29).** The fissures stood on the Iliac Bay alone: the law
walked the Bay's gate scan and named its regions, and the host asked the Bay's scan and gate. TAMRIEL-WIDE
(`01-Overview/Port-Doctrine.md`) came before STOREFRONT, so the season now stands where the Starfall's coven nights do:
the Bay and the eight provinces, Cyrodiil's open zone none (`net/wire.js` SITE_EVENT_LANES). A province's fissures are
drawn an area at a time over its theatre's scan (`systems/pass/seasonWorld.js` areaFissures), the scans warmed one
theatre at a time (`scenes/eventTheatres.js`); a pixel is read by the world's key, the region is the province's
(62..69) and the name its town's or the province's. The Bay's are the law before W14, to the byte. The camp, the
Colossus, the Maul and the tremor read no place but the fissure's own, so they work in a province unchanged.

**What a province's fissures keep off.** The roads past the Bay are laid a region at a time on each machine
(`scenes/tamrielRoadsHost.js`). A province's area is drawn once every region that may lay a road on it has landed
(`landedIn`, kept as `world/arenaRoads.js` keptArenaRoadsHost), so every machine keeps off the same roads, as the Bay's
fissures wait for Basic Roads' bytes. The band there is the one the terrain paints (`world/road/roadBand.js` nearRoad).
A province's fissure gives way to its own theatre's gate (`systems/gate/theatreGateSite.js`). The held map shows them
over the continent. The rock's clearings take them all, some 900 in the third stage on the freeware (the Bay's 129),
and the sweep reads a clearing's key once a turn. One theatre's fissures are drawn a frame: all eight at once took 8 to
44 ms. Pins: `season_tamriel.test.js`. Mutants: `tools/mutants/storefront_seasontamriel.json` (18, all dead).

## 7. The window

The shop's first section is **Folios** (`src/ui/enhanced/enhancedPass.js`). It opens on the season: its name and story,
its three stages with the day each opens, and the Aurum found today against the day's 100. Below stand the season's
folio covers, closed, side by side: each with its art, name, items, what the account owns of them, and its state - the
Brass Folio free, the Gilded Folio's unlock for 1,000 Aurum or unlocked.

A cover pressed opens its folio, as a Helldivers 2 warbond opens: the cover turns away to the folio's spread, one page
at a time, with arrows, a dot for each page, the arrow keys and a swipe; Back returns to the covers. It opens on the
first page with an item still to buy. A page's items show their art, name, kind and price, and Buy, Owned or Wear. A
locked page shows its items greyed and padlocked, with the Aurum still to spend in its folio to open it; a locked
Gilded Folio previews every page, its unlock at the spread's head. Short of an item's price, its panel offers Get Aurum.
For less motion the cover and the page change without turning.

## 8. AUDIT PASS (2026-10-29)

The pass read cold (audit lane 4). Each finding below is fixed where it starts and pinned by a test that failed before
the fix: `test/systems/pass/passclient.test.js`, `test/server/storefront_passaudit.test.js`, `ql11_acts.test.js` and
`witch1_client.test.js`. The mutants are `tools/mutants/storefront_passaudit.json`. The audit's other findings (4-7
and 10) are the shop's.

- **1. The Ketch's lift and cells were endgame finds.** `ketch-boarded` and `ketch-cell-banked` are said again at will
  with no receipt behind them: seven rides filled a day and paid an endgame challenge. The acts no find pays are now one
  list in the leaf, `systems/questlines/qlActs.js` ACT_NOT_FOUND, read by the pass and the Witches' Festival alike (each
  had its own copy). The Warden felled stays the Ketch's endgame find, and the questlines still hear both acts.
- **2. A page loaded before the opening never played the season.** `open` was the switch and the season's days, read
  once when the page bound, so `false` outlived the opening. `open` is now the switch's word alone (`battlePass.js`
  passOf), since both ends read the days from the law. A page told the pass is shut rests ten minutes and reads it again
  on its next deed, so a switch turned on is heard without a reload.
- **3. A find needed no game.** `/v1/pass/find` is a progression claim (`progress.js` PROGRESS_ROUTES): asked of the
  account's seated realm character, which an online page always holds, and spent on a stream of its own, `pass` - a
  day's 2,000 asks for each hour of play. The silver finds' stream (twenty a day) would refuse an honest page. A line
  staff wrote before the stream existed reads its first line for it (`06-Systems/Integrity-Arc.md` INT17).
- **8.** A find answers its season, tracks and share, so a level reached after a purchase is told with its premium reward.
  PASS-PANELS: a find answers the day's Aurum and the challenges it paid, and the page tells a challenge with its Aurum.
- **9.** The read at bind runs in the finds' queue: a late answer put the level back, and the next level was said twice.
  PASS-PANELS: a late answer would put the day's Aurum back, and the day's bound would be said twice.
- **11.** A refusal stands the page back (`net/askRest.js` ASK_REST_MS): the day's asks spent until the next UTC day, a
  find called closed, a rate or an empty bucket a minute, a seat or hold refused ten minutes.
- **12.** Section 7 says what the window draws. (Section 5's levels at once were retired with the boosters.)
- **The Witches' Festival's twins of 2 and 3.** The festival's finds had both faults. Its `open` is now the switch's word
  alone too (`festival.js` festivalOf), and `/v1/festival/find` is a progression claim on a stream of its own,
  `festival` - an honest page asks a Soul Cake and a pass find for one kill, so a shared bucket would refuse it. The
  rest after a shut word or a refusal is one rule for both pages, `src/net/askRest.js` (createAskRest), as the acts no
  find pays are one list. A town's `open` is no longer taken as the switch's word: it counts the festival's days too.

## 9. AUDIT-STOREFRONT II, lanes B and D (2026-10-29)

The pass's finds and the season in the world read cold a second time. Each finding is fixed where it starts and pinned
by a test that failed before the fix: `test/scenes/storefront_audit2_world.test.js` and
`test/server/storefront_audit2_pass.test.js`. The mutants are `tools/mutants/storefront_audit2_season.json` (42, all
dead); lane 5's `SEASONAUDIT-a-lost-answer-refused` is aimed at the kept id's line now.

- **B1, D1. One fall counted again.** The Colossi read were kept on the fissure's own record, which is made again when
  the relay's clock is lost a moment or the player walks off and back. The same body then said its fall again and asked
  for the Maul again, and after midnight the service gave a second. A fall is kept by the foe pool's record, one for the
  body's life (`seasonHost.js:"const fallen = new WeakSet();"`).
- **B2. A find lost to a dropped answer.** Off line or a 5xx, the find was dropped, and with no id it could not be asked
  again safely. A find now carries its own id, sixteen hex, and is asked again with it while the service cannot be
  reached: 4 s on, doubling to a minute, the deeds behind it waiting. The service keeps the id with its answer
  (`pass_asks`, migration 0201), written in the find's own batch, so an id asked again is answered as it was and counted
  once (`server-account/src/battlePass.js:"const kept = rid ? await passAskOf(db, player.id, rid) : null;"`). An
  account's ids go two days after their own, at its first find of a later day: an hourly job would take a share of
  every other job's statements (`cron.js` runCron).
- **B4. The 'make' challenge said "Make or find".** It counts a piece made, a gem socketed and a piece reforged, and says
  so now, in every language that held the row.
- **D2. A Maul lost with its page.** The claim is spent at the service's yes, and the Maul was safe only once a save held
  it. It is kept on the device from its mint (`dagger:maulHeld`; its id the claim's, which is the piece's ledger id too)
  until a save of the character made after the mint lands: a realm checkpoint the composers' sink put
  (`src/scenes/shared.js:"export function hearRealmSaves(fn)"`), or a slot written. At the next stand-up a Maul held and
  not in the pack is asked again by its id, and the service answers a kept id with its own day, whatever the day or the
  stage now (`server-account/src/seasonClaim.js:"if (kept) return { ok: true, day: kept.day };"`). A load in the session
  is a stand-up, as for the spoils pools.
- **D2, the save at the mint.** The mint asks a checkpoint of the next standing frame, so the realm holds the Maul at
  once, not at the period's end: the checkpoint clock's own door, with no host binding
  (`src/systems/online/onlineCheckpointClock.js:"export function askCheckpoint()"`).
- **D3. The map's held poll made every card again**, four times a second: 0.8 ms and some 40 kB a poll for the Bay's 186,
  more with the provinces'. The cards are made once while the stage's fissures, each theatre's gate of the day and the
  language stand, and the map's reader keeps its marks and their key for the same list and box: 0.005 ms a poll.
- **D4. Constructs stood in the wreckage.** The ring was laid in the world's frame while the model is turned by its yaw,
  so its angle was off by twice the yaw: one construct in eleven, and half the Colossi, stood within a body's width of a
  slab, a cog, the pipe or the pillar. The camp stands on the model's own free ground
  (`fissureModel.js:"export function fissureStands("`, over footprints that hold every solid face): each construct 0.6 m
  clear on the ring, the Colossus 1 m clear on the crack's axis past its end.
