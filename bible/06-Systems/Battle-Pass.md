# The Battle Pass - Season One: Dwemer's Breach (STOREFRONT)

> Design page and record (2026-10-29), beside `06-Systems/Storefront.md`. Where the page and the code disagree, the
> code's headers and the pins are what runs. Not a DFU member: Daggerfall Unity has no seasons, accounts or passes
> (Port-Ledger section A, STOREFRONT).

## 1. What was asked

The owner, 2026-10-29, with a developer's notes from the Discord: *"Battle Pass should not be just a Battle Pass. It
should be thematic Battle Pass like a 'Dwemer's breach'. And the whole world should change a little in relation to this.
Like new dwemer enemies, new boss, new weapon"*; *"Battle Pass is the MOST profitable but at the same time MOST DANGEROUS
in terms of outflow of players"*; *"booster to boost your BP progression. Maybe run a test BP for a 2 months (like 10
November to 10 Jan) ... and divide the Battle Pass into 3 stages (20 days each)"*.

The pass card: a Premium Pass at $29.99 with a fifty-level track, and a Deluxe at $49.99 with everything in Premium and
its own rewards unlocked at once. Sold here at $14.99 and $24.99, under the shop's $30 cap (`Storefront.md` section 2).

## 2. The season

**Dwemer's Breach**, 10 November 2026 to the end of 8 January 2027, UTC: sixty days in three stages of twenty
(`src/net/battlePassLaw.js` PASS_SEASONS). The Bay shakes; old Rourken works under High Rock and Hammerfell crack open to the
sky, and brass comes up out of them.

| Stage | Days | Levels open | The world |
| --- | --- | --- | --- |
| I. The Tremor | 10 Nov - 29 Nov | 1-17 | the ground shakes; two Brass Fissures open in each region's wilds; Spheres and Iron Golems climb out |
| II. The Brass Halls | 30 Nov - 19 Dec | 18-34 | three Fissures a region; Steam Centurions walk with them |
| III. The Heart Wakes | 20 Dec - 8 Jan | 35-50 | each region's Heart Fissure wakes the Brass Colossus |

A level past the open stage's top is banked: its experience is kept and counts the day the next stage opens. So a player
who plays hard is never more than a stage ahead of one who plays a little, and every stage is news for both.

## 3. The track

Fifty levels of 1,000 experience each. **The free track** is every registered account's. **The premium track** opens
with the Premium Pass or the Deluxe; a premium reward reached before the purchase is given at once. Every reward is the
account's for good, on every character, held from the level reached - read off the row at every ask (ACC3's law), never
a letter to claim.

AURUM (2026-10-29, the owner: "Ensure the reward tracks make sense. No overbundence of titles and profile icons"): the
track was cut to one title on each track and three profile icons in all, and most levels give **Aurum** instead - the
shop's currency for its daily wares (`06-Systems/Aurum.md`). The free track gives 525 Aurum over the season, the premium
1,350. A track's Aurum is counted from the level reached at every ask, never stored, so it leaves with the pass that
opened it (`src/net/aurumLaw.js` aurumTrackOf). The titles Brassbound, Tonal Architect and Brasswright and the portraits
Centurion Helm, Brass Spider, Dwarven Sphere, Brass Colossus and Numidium were cut: none had shipped.

| Level | Free | Premium |
| --- | --- | --- |
| 1 | | Tonal Fork (glyph) |
| 2, 4, 6 | | 50 Aurum each |
| 5 | 50 Aurum | |
| 8 | | Dwemer Lexicon (profile icon) |
| 10 | Dwemer Cog (glyph) | 75 Aurum |
| 12, 14 | | 50 Aurum each |
| 15 | 50 Aurum | |
| 16, 18 | | 75 Aurum each |
| 20 | Aetherium Shard (profile icon) | Tonal Shatter (kill effect) |
| 22, 26, 32, 36 | | 50 Aurum each |
| 24, 28, 38, 42, 44 | | 75 Aurum each |
| 25 | 75 Aurum | |
| 30 | 75 Aurum | Brass Gate (portal skin) |
| 34, 46, 48 | | 100 Aurum each |
| 35, 45 | 100 Aurum each | |
| 40 | 75 Aurum | Gearheart (profile icon) |
| 50 | Tremor-Born (title) | Aetherium Coil (aura), Heart-Waker (title) |

**The Deluxe Pass** gives the premium track, five levels at once, and its own three: the Gilded Coil (an aura), the
Brass Automaton (a mount look) and Echo of Numidium (a title on an animated brass plate).

## 4. Experience

The account service holds each account's season experience (`players.pass_s1`, migration 0194) and decides every find
(`server-account/src/battlePass.js`), as it decides a Soul Cake: the page asks with a deed's source, the service answers.

| Source | Experience |
| --- | --- |
| a foe my blow killed; the dead and the summoned | 12; 15 |
| an elite or a champion | 60 |
| a Dwemer construct (the season's) | 40 |
| gathering; making; the loot's laws | 8; 12; 10 |
| a tavern game won; the sea | 50; 40 |
| a world event; a quest done; a bounty paid | 120; 150; 150 |
| the endgame (a breach closed, a Redoubt, the Serpent, a star held) | 300 |

A UTC day takes 2,000 experience before a booster's share and 2,000 asks. **The challenges**, five a stage, count their
deeds while their stage is open and pay once, beside the day's bound: 6,800 in the first stage, 8,500 in the second,
10,000 in the third. A steady hour a day reaches level 50 by the season's end without a booster.

## 5. Boosters

The developer's "booster to boost your BP progression", sold as the sheet's three EXP Boosters under the shop's cap. A booster is the
season's: its share of every find's experience for the rest of it, and levels at once. The highest held counts, never
their sum. The share is on top of the day's bound, so it speeds every player.

| Booster | Price | Share | At once |
| --- | --- | --- | --- |
| Cog Booster | $2.99 | +25% | - |
| Tonal Booster | $5.99 | +50% | 3 levels |
| Heart Booster | $9.99 | +100% | 8 levels |

Levels given at once are experience like a find's: past the open stage's top they are kept for the next stage, as
section 2 says - the Deluxe's five too - and a booster's look says so (`src/ui/passText.js` passBoostText, AUDIT PASS 12).

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
- **A fissure, built** (`world/fissureModel.js`, its art `fissureArt.js`, pseudo-archive 38341): a scorched oval
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

The shop's first section is the pass: the season's name and story and its three stages, each with the day it opens or
the level it opens to; the account's level, the bar to the next, the day's experience and its booster's share; the track;
the Deluxe Pass's own three; the open stage's challenges with their counts; and a button to the Pass Boosters tab. The
Premium and Deluxe Passes are sold below the section, the three boosters on their own tab and the Seasonal Collector
under Bundles. A level reached is said once on the screen with its rewards.

The track is a column for each level with a reward (thirty-one of the fifty), free above and premium below, each reward
in its own paint. The rows' names stand at its left as it scrolls, the player's last reward reached is marked and
scrolled to, and a premium cell the account has not opened carries a padlock (AUDIT-STOREFRONT II, lane E 9).

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
- **9.** The read at bind runs in the finds' queue: a late answer put the level back, and the next level was said twice.
- **11.** A refusal stands the page back (`net/askRest.js` ASK_REST_MS): the day's asks spent until the next UTC day, a
  find called closed, a rate or an empty bucket a minute, a seat or hold refused ten minutes.
- **12.** Section 7 says what the window draws, and section 5 that levels at once wait past the open stage's top.
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
  (`pass_asks`, migration 0194), written in the find's own batch, so an id asked again is answered as it was and counted
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
