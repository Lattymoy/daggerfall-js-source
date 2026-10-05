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
  region's largest city, from its own MAPS.BSA. With nobody to count, it rises by one of the Bay's great cities.
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
  own modules are not changed: SERPENT1's rule (`Sea-Serpent.md`), so the ~60 suites and ~700 mutant records that pin
  the gate's bytes stay as they are.
- **A puzzle the relay judges** - the Orrery of Endings, a geared lock over twelve hours whose answer is written in
  riddles that change with every Hollow (section 8); **a course the clock drives** - the Unmoored Steps, drifting,
  phasing and crumbling platforms over the void (section 9); **a fight that tests a build** - the Brass Remnant, three
  phases, a damage race, a coordination check and a timer (section 10).
- **The chance, not the promise.** The kill pays gold and gear to everyone who earned it; a piece of the new set, THE
  BRASS OF NUMIDIUM, one time in three; the title *Hourbreaker* one time in four and the aura *The Turning Hour* one time
  in eight, each rolled once by the account service from the relay's own seed (section 11).
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
 every client: site = sdSite(s, r, MAPS.BSA) ─► the Hollow stands at its pixel (a spawned dungeon, Super)
   column of light on the horizon · a line in sight · taverns of the city speak of it
   │ the first player at its door ─► `found` to the cell ─► the hub: ph 'found', fanned: "<who> found a Super dungeon"
   ▼
 the DUNGEON (whole, Super foes) ── its END: the RIFT (to the realm) + the RETURN (to the entrance)
   │ the Rift, pressed ─► the realm room `sd:<s>` admits ─► the SHATTERED HOUR (a made level)
   ▼
 THRESHOLD ─► ORRERY OF ENDINGS (puzzle: relay-judged) ─► UNMOORED STEPS (platforming: the shared clock)
   ─► THE LAST MOMENT (the Brass Remnant: relay brain, 250 ms beat)
   │ the kill ─► RECEIPT `h1` per earner ─► spoils rolled on the receipt's seed; the account claims title/aura chance
   ▼
 COLLAPSE: ph 'fell' ─► 3 minutes ─► 'gone' (every client: the Hollow sinks, anyone inside is cast out) ─► cooldown
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
| `fellAt`, `top`, `n` | when its boss fell, the top fighter's name, how many earned the feat |
| `until` | when an unbeaten Hollow fades: `at + SD_LIFETIME_MS` |
| `next` | when the next may rise: `fellAt + SD_COLLAPSE_MS + SD_COOLDOWN_MS` (or `until + SD_COOLDOWN_MS`) |

The director runs on the hub's one alarm (multiplexed after `_sweepHub`, re-armed through the hub's own arm), and on
the internal doors below. Its law is pure (`net/sdLaw.js`, section 14) - the hub only stores and fans.

Numbers: `SD_LIFETIME_MS` 48 h, `SD_COLLAPSE_MS` 3 min, `SD_COOLDOWN_MS` 2 h, `SD_FIRST_RISE_MS` 10 min after a hub
with no record first beats (so a fresh deploy does not raise one the instant it wakes).

Clients learn the record from the hub's welcome (`sd` beside EVENT1's `ev`) and from `{t:'sd',k:'ev',...}` on every
change. An old client never sees a `sd` frame: the hub sends it only to a hello that says it reads them (`sdv`).

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
is not on every client - HUB1's rule):

1. The candidates are the populated places of region `r` - its cities first, then towns - ranked by size: the city's
   RMB block count, then its building count (the ranking `systems/regionHubs.js` already makes, with the same
   tie-breaks). With `r = -1` the candidates are the Bay's eight largest cities, and the slot's hash picks one.
2. Around the chosen city, the site is a land pixel at Chebyshev distance 2 to 5, with no location on it or its eight
   neighbours, not a spawned dungeon's pixel, and not under water (the gate's own site tests, `systems/gateSite.js`).
   The slot's hash picks among the pixels that pass; with none, the next city down the ranking is tried.

The relay never knows the pixel - it has no map data - and needs not: everything that must be judged is judged by pose
against the slot's law (section 4) or in the realm's own frame (sections 8-10).

## 4. A random find - the omen, the sighting, the finding

- **The omen.** From the moment it rises, a column of brass-gold light stands over the Hollow's pixel, seen from any
  pixel within 12 (the gate's beacon pass, its colours its own). A traveller in the city it stands by hears it in the
  taverns: *"They say the air goes brass-coloured past the walls of <city> at dusk, and a bell rings where there is no
  bell."* No map mark, no compass mark: it must be found.
- **The sighting.** Within 600 m, Elite's own sight line: *"You see a Super Dungeon 340 metres to the north-west!"*
- **The finding.** The first player to stand within 25 m of its door sends `{t:'sd',k:'found',s,px,py}` to the cell
  room it stands in. The cell believes it only from a pose inside the claimed pixel, near the slot's spot (the spot's
  offset inside the pixel is a pure function of the slot, so the relay can check it without map data), while the record
  says `risen`. It tells the hub (`/internal/sd/found`, retried until it answers); the hub sets `found`, keeps the
  finder's name, and fans it: *"<name> has found a Super Dungeon near <city>!"* From then on everyone online sees it on
  the map (its ring), the compass (inside 1 km), the Timers window and the notice boards.

A forged `found` (a client claiming a pixel that is not the site) cannot place the Hollow anywhere else - every client
places it from its own map files - and can only flip the record a little early.

## 5. The dungeon - Super

The Hollow is a spawned dungeon (`synthesizeDungeonLocation`, the Elite's), cloned from a template dungeon the slot's
hash picks from the region's (or the Bay's) labyrinths and keeps of at least 12 blocks, laid WHOLE - the world's
sizes (section 13) are not drawn for it: the feat is the longest walk its template has. It is named from the slot: *The Brass Hollow*, *The Stopped
Bell*, *The Unwound Halls*, *The Clockless Deep*, *The Hour's Wound*, *The Splintered Keep*, *The Last Bell of
<city>*, *The Hollow Under <city>*.

Its difficulty is the port's hardest:

| | Regular | Elite | Super |
|---|---|---|---|
| foes per enemy marker | 1 | 3 | 3 (the 64 KiB frame budget is Elite's own, proven at 151 markers) |
| foe health / damage | x1 / x1 | x2 / x2 | x4 / x2.5 |
| foe level band | the player's | the player's | at least 24 (the top band: Daedra, liches, ancient vampires) |
| elite foes (5x health, 3x damage) | 1 at 20% | 3-4 | 6 |
| loot | - | +20% | +50% drop and quality |
| dungeon fires | all | half | none - the Hour is cold |

The difficulty word is the location's (`loc.superTier`), read by one law (`dungeonTier`, section 12).

## 6. The end - the Rift and the Return

**The end** is the dungeon's enemy or start marker farthest from its entrance (RVN7's lair law, the one law
`dungeonEndOf` both the Rift and the Return read), on a floor the collider finds, the same on every client.

- **The Rift** - the large otherworldly portal: a 7 m ring of brass light turning slowly about a black-gold membrane,
  its sound a bell heard under water. Pressing it (or walking into it) steps the player through to the Shattered Hour
  (the veil, `ui/gateVeil.js`), if the realm room admits them (`found` or later, before `gone`). Refusals are said in
  words an old client already understands: *"The Rift will not take you yet."* / *"The Hour has closed."*
- **The Return** - a small portal of pale light beside it: it carries the player back to the dungeon's entrance (the
  start marker), and stands until the boss falls. With the kill the Hollow collapses (section 11) and the Return goes
  out with it.

## 7. The Shattered Hour - the place the Warp left

In 3E 417 the Numidium walked, and the Iliac Bay broke into every one of its endings at once: the Warp in the West, a
Dragon Break. The world mended - mostly. The Shattered Hour is what did not: the moment itself, kept outside time,
where the Bay's broken endings still turn against each other and the last of the Brass God still walks. Where the
Bay's people crowd thickest, their many souls press the world thin, and a dungeon beneath them is swallowed by a seam
of the Warp - a Hollow - whose deepest hall opens on the Hour.

The realm is a made level (`world/sdRealm.js`, the Court's pattern: a made location `0x7ffff200`, block index 900200,
pseudo-archives 38151-38159) laid along +Z in the dungeon's frame:

| stage | where | what |
|---|---|---|
| **The Threshold** | z 0 | the landing, radius 8 m; the way back through the Rift (to the Hollow's end) |
| **The Orrery of Endings** | z 24-60 | the puzzle hall, radius 18 m (section 8) |
| **The Unmoored Steps** | z 60-190 | the platforming course, three spans (section 9) |
| **The Last Moment** | z 190-250 | the boss arena, radius 26 m, four brass pillars (section 10) |

The sky (`render/sdSky.js`): a void of brass light and slow aurorae, the Bay's skylines hanging upside down in it -
Daggerfall's towers, Sentinel's domes, Wayrest's bridges - the shards of the endings, turning on the realm's clock; a
great clock-face of stars behind the arena whose hands run backwards. The realm's clock is anchored (`anchoredClock`,
the Deadlands' law) so every screen shows the same moment.

The realm refuses what the Court refuses: rest, save, map, recall, regeneration (`courtRules`).

## 8. The Orrery of Endings - the puzzle

Six Ending-stones stand on a ring in the hall, each carved with one of the Bay's endings: **Daggerfall** (the lion),
**Sentinel** (the sun), **Wayrest** (the ship), **Orsinium** (the tusk), **the Underking** (the crown of bone),
**the Blades** (the dragon). Each stone shows an hour of twelve. The hall's floor is the Hour-dial; its rim carries six
**Ledger plaques**.

- **Turning.** A player within 3 m of a stone turns it one hour (forward or back). The stones are GEARED: turning one
  turns its partners too - some forward, some back, some by two. The gearing is not shown; it is learned by turning.
- **The answer.** The Concord is reached when every stone stands at its true hour. The plaques say what the true hours
  are, in riddles: some plainly (*"Daggerfall keeps the third hour."*), most against each other (*"Wayrest keeps the
  hour Sentinel keeps, and two more."*, *"The Underking stands opposite Orsinium."*, *"Read the Blades from twelve
  backwards and you read Daggerfall."*). Together they fix every hour, and only one way.
- **What the hall tells you.** The dial lights one segment for each stone that stands at its true hour - how many, not
  which.
- **The fray.** Every turn frays the Hour. At 48 turns it snaps back: every stone returns to where it began, and the
  Hour lashes everyone in the hall (25% of their health, no save). Turning at random does not get there.
- **New every time.** The gearing, the starting hours, the true hours and the riddles are drawn from the slot's seed,
  so no Hollow's answer is another's.

The law (`net/sdBrain.js` `orrery*`): the gearing is a matrix `M` over Z/12 built as the product of a lower and an upper
unit-triangular matrix of small entries, so its determinant is 1 and EVERY target is reachable; the true hours are
`T = P0 + M t*` for a drawn `t*` whose shortest solution is at least 12 turns; the riddles are drawn as a chain from two
plain clues so `T` is their unique solution (pinned by brute force over all 12^6 configurations). The relay holds the
stones, the fray and the Concord; a turn is `{t:'sd',k:'pz',i,a,q}` from a fighter whose pose is within reach of stone
`i`, one turn per stone per 700 ms (the gear settling), at most 3 a second per account. The Concord, once reached, is
kept for the slot.

## 9. The Unmoored Steps - the platforming

With the Concord a bridge of light opens from the Orrery to the first of the Steps. Three spans over the void, each
begun at a stone checkpoint:

1. **The Drift** - eight brass platforms swinging side to side (2-4 m, periods 4-7 s), the gaps a running leap's
   (4-6.5 m; `player/parkour.js`'s range is 4-7).
2. **The Beat** - seven platforms that are there only on the Hour's beat (solid 2.4 s, gone 1.2 s, alternate stones
   half a beat apart), and two brass walls to run (CLIMB3's wall run) between them.
3. **The Crumble** - eight cracked platforms that fall 0.7 s after a foot touches them (back after 5 s), and the Warp's
   breath across them: a gust every 6 s pushing 3 m/s sideways for a second.

Falling below the course (y < -30) casts the player back to the span's checkpoint with 15% of their health lost (*"The
Hour casts you back."*). The platforms move on the realm's anchored clock, so every player sees the same Step in the
same place; crumbling is each player's own (a platform one player broke is whole for the next). The Steps are not the
relay's: a player who reaches the arena simply arrives, and the fight judges where they stand.

## 10. The Last Moment - the Brass Remnant

What the Warp kept of the Numidium: a brass colossus four times a man's height, its chest an open cage around a heart
of shattered soul-gem light - the Mantella's echo. The relay runs it (`net/sdBrain.js`), as it runs the Warden.

**Health.** Each fighter who enters brings `SD_TTK_S` (420 s) x `dpsRef(lv)` x 1.25 to its health - nearly twice the
Warden's share - added at its current fraction (the gate's `joinFight` law). The same caps on how much a blow is
believed (the gate's buckets), one seat per account, 256 fighters at most.

**Phase one - The Walking Hour (100% to 70%).**
- *Brass Stomp* - a 7 m circle, then a shock ring rolling out to 22 m that must be JUMPED.
- *The Hour-Hand* - a beam from its chest sweeping 180 degrees over 4 s; stay ahead of the hand or behind a pillar.
- *Gear Volley* - five spinning gears thrown at five fighters, 3 m circles where they land, burning brass for 6 s.
- *Mantella Pulse* - every 30 s, the whole arena: 12% of health, +2% each pulse, no save.

**Phase two - The Dragon Break (70% to 35%).** The Remnant steps outside time (it cannot be struck) and two Echoes of it
stand in the arena, the GOLD and the SILVER, each with half of what is left. They must die within 15 s of each other:
an Echo left alone for 15 s rises again with half its health. While both stand, each Echo's blows are its own phase-one
blows, faster (80% wind-ups); the Hour-Hand sweeps from both.

**Phase three - The Last Moment (35% to 0).** The Remnant returns, faster. Every 50 s it winds up THE RESET (8 s): Heart
crystals rise around the arena (3, plus one per two living fighters, at most 8). Break them all before it lands and it
is stunned for 8 s and takes 1.5x; leave one and the Reset lands - 70% of everyone's health, no save - and it heals 8%.

**The Hour Ends.** Fifteen minutes after the first blow, the Hour ends: every 2 s, 99% of everyone's health. A group that
cannot finish it in fifteen minutes does not.

**What it asks of a build.** Its blows are shares of the struck player's own health (the gate's law), so no amount of
health makes it safe; the pulses and the Reset are unresisted magic, so no resistance makes it safe; it cannot be
paralysed, slowed, charmed, reflected or soul-trapped; nothing regenerates in the Hour; the Reset is a damage race and
the Dragon Break a coordination race; the Hour Ends is a clock. It is meant to be lost, many times, before it is won.

## 11. The feat - receipts, spoils, the set, the title, the aura, the collapse

**The kill (relay).** As the gate's: kept before it is said, one fall at a time, the hub told until it answers. Each
fighter who EARNED it (dealt 2% of their own share, or stood alive half the fight - the gate's `earned`) gets a receipt
`h1` signed with the relay's key: `{d:s, b, s:account, c:seed, x, l}` - the slot, the boss, the account, the relay's
own seed, how it was earned, the admitted level. The hub keeps each as `sdrc:<sub>` for the week a receipt lives.

**The spoils (client, from the receipt's seed).** Thrown from where it fell (the gate's spoils pool, its keys its own):

| | |
|---|---|
| gold | 400 x level, +-20% |
| one piece | Legendary or better 25% of the time, else Rare |
| two pieces | Rare or better (source tier 24, luck 70) |
| THE BRASS OF NUMIDIUM | one piece, one time in three (rolled last, so the other rolls never move) |

**THE BRASS OF NUMIDIUM** - a new Aetheric set (`systems/aetheric.js`, `systems/sigilSets.js`): Dwarven pieces, the
Dwemer's brass, nine records - helm, cuirass, gauntlets, greaves, boots, pauldrons; longsword, war axe, staff. Its set
law (online only, asleep in duels, the Sigil Sets' rules):
- 2 pieces: +10% resist magic and shock;
- 4 pieces: GEARWARD - every 12 s, the next blow that lands on you is 30% lighter;
- 6 pieces: THE HOUR TURNS - once a minute, a blow that would kill you does not, and you are healed a quarter.

**The title and the aura (account service).** `POST /v1/sd/claim` verifies the `h1` receipt, writes one row per
(slot, account) and, ON THAT FIRST WRITE ONLY, rolls from the receipt's seed: the title **Hourbreaker** one time in
four, the aura **The Turning Hour** - a slow wheel of brass gears and gold light about the wearer - one time in eight.
Once held, held for good. The profile counts *Hours broken*.

**The collapse.** The kill sets the record `fell`; for `SD_COLLAPSE_MS` (3 minutes) the realm stands so the spoils can
be taken and a way home rises where the Remnant fell (to the Hollow's door, OUTSIDE). Then `gone`: on every client the
Hollow sinks into its pixel, its column of light goes out, and anyone still in the Hollow or the Hour is cast out
before its door: *"The Hour closes, and the Hollow folds in on itself behind you."*

## 12. Regular, Elite, Super - the labels

One law, `dungeonTier(loc)` (`systems/dungeonTier.js`, a leaf): `'super'` for a Hollow, `'elite'` for an Elite spawn,
`'regular'` for every other dungeon - and null for a place that is not a dungeon. Its words, `DUNGEON_TIER_TEXT`:
**Regular Dungeon**, **Elite Dungeon**, **Super Dungeon** - and, beside them since the world's sizes (section 13), the
dungeon's SIZE, **Small**, **Medium** or **Large**, by the built dungeon's block count as the room builds it online
(`world/dungeonLabel.js dungeonTierLabel`, which gives no label to the places the port made: the Burning Court, the
arena's floor, its undercroft). One phrase everywhere: *Elite Dungeon, Small*. Said online, where the tiers differ;
offline every dungeon is DFU's. Shown:

- **the entrance plaque** (World Tooltips): the title is the tier's words, the subs *To <name>* and the size - as
  Elite's already was; offline (and over the undercroft's stair) the mod's own *To <name>*;
- **the held map** (enhanced): the hover label carries the phrase after the dungeon's name, *Region : Location (Elite
  Dungeon, Small)*, and the I-key box opens with it, before DFU's own refusal;
- **the overworld plates** (TV6): a found dungeon's place plate carries the phrase under its name, a far plate before
  its distance;
- **the sight line**: *You see an Elite Dungeon 340 metres to the north-west!* - and a Super's, *a Super Dungeon*;
- **on entering**: one line, the phrase (either skin - online is the port's own game).

Not on the classic travel map, automap or logbook: they are native windows, and DFU has no such word (the NATIVE-WINDOW
RULE).

## 13. The world's dungeon sizes, the online law (SD-ONLINE)

THE DELVE ARC shipped Medium Dungeons (DSIZE1) as an Enhanced row, off by default and refused online - every peer in a
dungeon room must lay the same layout, and the settings are each player's own. Mac first made medium the online
default; then, on second thought, *"Large, medium and small should all play into account online"* - and, asked whether
that meant each player's pick or the world's, chose **the world mixing sizes**: every dungeon has ONE online size,
small, medium or large, the same for every player, most of them medium. So online the size is no setting at all but
the room's law:

- **`onlineDungeonSize`**: one draw of the port's seeded die (`systems/wind.js seededFirst`) on the dungeon's map id
  and its own salt, weighted small 1, medium 2, large 1 (`ONLINE_DUNGEON_SIZES`) - a quarter of the Bay's dungeons
  small, half medium, a quarter whole - the same on every client, every visit, for good.
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
  change, `world171`). A dungeon built whole keeps `dungeon:m<id>`, and its memory - and shares it, rightly, with an
  older page, which lays the same whole dungeon. (This page first said each frame would carry the layout's size, `lz`,
  and a receiver refuse another's; a room per layout needs no receiver to refuse anything, and an old page's blows -
  which carry no stamp - cannot reach a re-laid room at all.)
- **The Super dungeon** is always whole (section 5): the feat is the longest walk the template has.

## 14. The wire

One new frame type, `sd` (`net/wire.js`: `SD_KINDS`, `validSdIn`, `validSdOut`, `SD_RELAY_MIN`, `relaySupportsSd`,
`SD_BRAIN_V`/`SD_BRAIN_MIN`), behind a relay-version gate - the relay closes a socket on a frame it does not know.

| from -> to | kinds |
|---|---|
| client -> hub | `site {s,px,py,pl}` (the herald's vote), `spent {s}` |
| client -> cell | `found {s,px,py}` |
| client -> `sd:<s>` | `in {lv,bv}`, `pz {i,a,q}`, `hit {q,d,r}`, `ehit {e,q,d,r}` (an Echo), `xhit {c,q,d,r}` (a Heart) |
| hub -> client | `ev {s,ph,r,at,foundAt?,fb?,fellAt?,top?,n?,until,next}`, `rcpt {r}` |
| `sd:<s>` -> client | `st` (the whole state), `pz {st,f,lit,ok}`, `mv`, `atk`, `hp`, `ph`, `ec` (Echoes), `cx`/`cxb`/`stun` (Hearts), `fell`, `rcpt`, `no {m}` |

Internal doors (object to object): `/internal/sd/census`, `/internal/sd/found`, `/internal/sd/fell`. The Worker mints
an `sd:<s>` object only for the slot the hub's record names and only while it is `found` or `fell` (the gate's
`gateHolds` law, read from the hub through `/internal/sd/live`).

## 15. The four hosts

| host | what it carries |
|---|---|
| `scenes/world.js` | WIRED: the record, the omen and sighting, the found word, the Hollow at its pixel, the map/compass/timers, the realm's link, court, spoils, receipts, the veil, the ejections, the labels' entry line |
| `scenes/worldModes.js` | WIRED: `enterSdRealm` / the way home, the realm's per-frame arm (lighting, fog, sky, the Orrery, the Steps, the arena), the dungeon's exit to the Hollow's door |
| `scenes/dungeonContext.js` | WIRED: the Super difficulty, the end (`dungeonEndOf`), the Rift and the Return, the realm's bodies (the Remnant, the Echoes, the Hearts) behind the gate's three seams, the refusals |
| `scenes/exterior.js` | FLAGGED: the `?exterior` bench is offline; there is no Super dungeon offline. Its plaque reads the tier law and says Regular. |

## 16. Slices and their records

| slice | what |
|---|---|
| SD-ONLINE | section 13 |
| TIER1 | section 12 |
| SD1 | `net/sdLaw.js`: slots, the record's law, the census pick, the spot law, the room key |
| SD2 | `systems/sdSite.js` and the Hollow at its pixel: the city, the site, the clone, the omen, the sighting, the plaque |
| SD3 | the relay: the director, the census, the found word, the realm room, the wire, `RELAY_VERSION` |
| SD4 | the Super dungeon: its difficulty, its end, the Rift and the Return |
| SD5 | the Shattered Hour: the made level, its sky, the way in and out |
| SD6 | the Orrery of Endings |
| SD7 | the Unmoored Steps |
| SD8 | the Brass Remnant |
| SD9 | the feat: receipts, spoils, THE BRASS OF NUMIDIUM, the claim, Hourbreaker and The Turning Hour |
| SD10 | the collapse, the readouts, the audit |

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
RELAY_VERSION is `world171` - the arc's one version, re-hashed in place while it is undeployed.

The slice was first built as "medium everywhere online" (Mac's first word) and turned to the world's mix the same hour
on his second; nothing of the first shape shipped but the room per layout, which both needed.

Pins: `test/sdonline.test.js` (10 - the world's sizes and their weights, the size law online and off with its guards
and the stamps, the build's size, the room law at both ends, driven end to end, the hosts by source, the row, a session
in the medium and the small rooms, the relay's Room keeping each size's memory apart; MAPS.BSA whole with ARENA2);
`test/dsize1_mediumdungeons.test.js`, `test/ft1_smallerdungeons.test.js`, `test/auditworld34.test.js`,
`test/uxb1e_onlinesync.test.js`, `test/features.test.js`, `test/ft18_features.test.js` (PINS MOVED);
`tools/mutants/sdonline.json` (13) and `tools/mutants/dsize1.json` (27), all dead. Deploy: relay first (a page of this
build on a relay before `world171` joins a `.s` or `.m` room the relay keeps no world for - presence alone, every player
stepping their own foes - which is safe, and is why the order matters).

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
