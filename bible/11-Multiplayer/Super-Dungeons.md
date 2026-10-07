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
  room it stands in. The cell believes it only from its own socket's pose within SD_FOUND_RADIUS_M of the claimed
  pixel's centre (a spawned dungeon stands centred in its pixel, so the relay checks it without map data), and keeps it
  - the first finder's - until the hub answers (`/internal/sd/found`, told again on the cell's alarm). The hub believes
  it while its record says `risen` for that slot, asking the pose again; it sets `found`, keeps the finder's VERIFIED
  name, and fans it: *"<name> has found a Super Dungeon near <city>!"* From then on everyone online sees it on
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
| **The Unmoored Steps** | z 60-220 | the platforming course, three spans (section 9) |
| **The Last Moment** | z 220-272 | the boss arena, radius 26 m, four brass pillars (section 10) |

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

The law (`net/sdBrain.js` `orrery*`): the gearing is a matrix `M` over Z/12 - ONE unit-triangular matrix in a hidden
order (`M = P U P^T`), so its determinant is 1 and EVERY target is reachable, each stone turns itself exactly one hour,
and a hall can learn it by turning each stone once (SD6a: the design first named the product of a lower and an upper
unit-triangular matrix, whose diagonal is not one - a stone would turn itself two hours or none). The riddles come
first, a chain from two plain clues, each later clue a true bijection tying a new stone to one known before it, so the
true hours `T` are their unique solution (pinned by brute force over all 12^6 configurations); the start `P0` is drawn
until the shortest way from it, `t = M^-1 (T - P0)`, is 12 to 24 turns - room under the fray to learn and err. The relay holds the
stones, the fray and the Concord; a turn is `{t:'sd',k:'pz',i,a,q}` from a fighter whose pose is within reach of stone
`i`, one turn per stone per 700 ms (the gear settling), at most 3 a second per account. The Concord, once reached, is
kept for the slot.

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
   for a second, left and right by turns, its wind heard the second before.

Amended to the engine (SD7a): the design's gaps were a running leap's (4-6.5 m), and a leap flies 4.1 m at Jumping 0 -
gaps that only a trained leap crosses shut out every build that never trained it, so the gaps are a plain running
jump's at a modest build (Speed 40, Running 20: 3.1 m), the skill buying margin, not entry; the walls are run UP
(CLIMB3 runs up a wall met straight, and the engine has no run along one), so they are risers, not a corridor; and the
course is 145 m from the first step, so the Steps run to z 220 and the arena stands at z 246.

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
  change, `world172`). A dungeon built whole keeps `dungeon:m<id>`, and its memory - and shares it, rightly, with an
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

Internal doors (object to object): `/internal/sd/census`, `/internal/sd/found`, `/internal/sd/live`, `/internal/sd/fell`.
The Worker mints an `sd:<s>` object only for the slot the hub's record names and only while it is `found` or `fell`
(the gate's `gateHolds` law, read from the hub through `/internal/sd/live`).

SD3 shipped the first of the table: `found` (client -> cell) and `ev` (hub -> client); the rest arrive with the slices
that use them (SD6's `pz`, SD8's fight, SD9's receipts), each extending `SD_KINDS`/`SD_OUT_KINDS` under the arc's one
relay version while it is undeployed - `world176` now (`world171` on the branch, renumbered past main's CRYSTAL-FIST,
WATCH-FIX, SERPENT3, LEGACY7 and TEXT-F1 at the merges). SD6b shipped `pz` each way - the realm's out frame is the hall,
`pz {s,st,f,lit,ok,i?,a?,id?,q?,x?}` (the turn that made it so, its turner and number, and `x` when the Hour snapped
back).

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
RELAY_VERSION is `world172` - the arc's one version, re-hashed in place while it is undeployed (`world171` on its branch,
renumbered past main's CRYSTAL-FIST at the merge).

The slice was first built as "medium everywhere online" (Mac's first word) and turned to the world's mix the same hour
on his second; nothing of the first shape shipped but the room per layout, which both needed.

Pins: `test/sdonline.test.js` (10 - the world's sizes and their weights, the size law online and off with its guards
and the stamps, the build's size, the room law at both ends, driven end to end, the hosts by source, the row, a session
in the medium and the small rooms, the relay's Room keeping each size's memory apart; MAPS.BSA whole with ARENA2);
`test/dsize1_mediumdungeons.test.js`, `test/ft1_smallerdungeons.test.js`, `test/auditworld34.test.js`,
`test/uxb1e_onlinesync.test.js`, `test/features.test.js`, `test/ft18_features.test.js` (PINS MOVED);
`tools/mutants/sdonline.json` (13) and `tools/mutants/dsize1.json` (27), all dead. Deploy: relay first (a page of this
build on a relay before `world172` joins a `.s` or `.m` room the relay keeps no world for - presence alone, every player
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
claim - `systems/regionHubs.js` exports its `outranks` for it - or the Bay's eight largest cities), `findSdSite` (a
pixel the GATE's own scan calls suitable - `systems/gateSite.js scanGatePixels`, so the Hollow inherits every one of
its tests: land, no location on it or its neighbours, no spawned dungeon rolled there, a province's - whose nearest
fast-travel town is the city, two to four pixels out, by the slot's roll; a city with none passes to the next),
`sdTemplates`/`pickSdTemplate` (a labyrinth or a keep of twelve blocks or more with a spawn's clearance), and
`sdHollowLocation` (the template cloned on the site under the slot's OWN map id - `sdSalt`, 2049..4095, never
`WORLD_SALT` - so a later Hollow on the same pixel is another dungeon with another room and another memory; named;
`superTier`; a spawned dungeon's machinery). The design's "Chebyshev 2 to 5" is the gate scan's 2 to 4.

Known, recorded: a gate day may roll the Hollow's pixel for its own (the gate's site is the clock's alone, and the
Hollow is no roll the gate's scan can see) - a chance of about one in the region's suitable pixels per day of a
Hollow's life; both then stand in the pixel.

Pins: `test/sd2_sdsite.test.js` (5, over the real gate scanner); `tools/mutants/sd2.json` (13, all dead - one
survivor at first, a fixture whose cities outnumbered eight, now pinned with fewer).

The arc's Ledger row stands from here (`test/doctrine.test.js`: a file citing Ledger A has a row naming it - SD1 and
SD2a cited one before it was written, and the full suite at the merge of main said so), naming each slice's files as
they ship.

### SD3 - shipped 2026-10-05 (the relay)

Sections 2-4 and 14 on the relay - `world172` (`world171` on the branch; main's CRYSTAL-FIST took it at the merge).

- **The frame** (`net/wire.js`): `sd`, one kind each way so far - `found {s, px, py}` to a cell (`validSdIn`, behind
  `relaySupportsSd`: a relay before `world172` closes the socket on it) and `ev` from the hub (`validSdOut`: the record,
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
map files - the gate's scan, warmed if it is not ready, and the game's own rows - and stood in the location index at its
pixel while the record's phase stands it (`frame`), then taken down - never from under a player standing in it, and the
next slot's not before; the find said at its mouth - within SD_FOUND_NEAR_M of the dungeon entrance its pixel's blocks
stood - to the cell its pixel is in while the record says `risen`, again every SD_FOUND_RESEND_MS until the hub's word
moves it; and the lines everyone online hears - the find, the kill, the fading - each once, a rise to nobody, a line
whose place the scan has not found yet waiting for it (its city's name) and past SD_LINE_WAIT_MS said with the region's.

`scenes/world.js`: the host made online alone and framed every frame; the hub link's `onSd`; the Hollow's cities and
templates kept over the game's own rows before they go (`_sdCityRows` - the populated places, `hubClaim`;
`_sdTemplateRows`); its pixel built again between builds when it rises or goes on ground that stands (`_sdLate`,
`sweepSdLate` - sweepWodLate's shape, after the gate's clearing); the spawn ledger never notes a Hollow's first sight
(`_spawnSeen` - the dungeon's door and the roll's) nor its clear (`_noteSpawnCleared`): a Hollow's life is the hub's
record, not a spawn's two clocks; a Hollow is otherwise a spawned dungeon - the build, the plates, the Overworld's lists
and the sight line (TIER1's "a Super Dungeon") take it as one.

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
  exported for it), while it has risen or been found, one time in SD_RUMOR_CHANCE: *"They say the air goes
  brass-coloured past the walls of <city> at dusk, and a bell rings where there is no bell."* (`sdRumor`) - the person's
  one answer spent as the mill's own and the revenant's are, asked before both (the world host's getNewsOrRumors).
- **Once found, news.** The held map's ring on its own pixel (`sdMapMark`, SD_RING_R - a place now, not an area; the
  gate's mark's shape, read by `ui/gateMapMark.js readGateMark` and painted by `ui/inkMap.js paintGateRing` in
  `ui/sdMapMark.js`'s brass, its legend "Super Dungeon", its card its name, its city, its finder and its state); the
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
inside, `scenes/sdHost.js` casts them out once (`castOut`, the host's seam, `castOutS` its slot); the next frame finds
them outside and takes it down. The world host's cast-out is the dungeon's own way out - the mode machine's exit
(`modes.unstuck`), drained at its safe point into `exitDungeonNow`, PositionPlayerToDungeonExit's landing before its
door - with the closing line, *"The Hour closes, and the Hollow folds in on itself behind you."* (sdLaw.js
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
  the 64 KiB foe frame is the budget the Elite proved at 151 markers. Each record carries `superTier` beside the Elite's
  mark, the same on every client (the foe frame indexes the list by position).
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
  the ceiling of most of Daggerfall's halls. Its look (`scenes/sdEnd.js riftFrame`): a ring of brass light in eight
  teeth, turning an eighth of a turn every sixteen frames, about a near-black membrane with slow gold swirling in it.
  It is made once per renderer, as the companion's portal is, and is self-lit, so it glows the same underground. Its
  sound (`systems/sdRiftSound.js`) is a bell heard under water: DAGGER.SND's ship's bell slowed and pitched down near a
  sixth, its echo behind it and the bubbles faint beneath, darkened, wavering and looped at the ring's middle through
  the engine's own low-pass - made from the player's archive, as the Arena's crowd is.
- **The Return** stands beside it (`sdReturnPlace`: 1.2 m past the ring's rim on the first clear bearing, east first;
  else 1.5 m out; else on the ring's foot): a small oval of pale light. It carries the player back to the way in - the
  start marker's landing, through the dungeon's own teleport door (`actions.onTeleport`, DFU's teleport actions'
  handler). It goes out when the boss falls (`sdReturnStands`, asked once a second) and never stands again in that
  dungeon.
- **Pressed, or walked into.** Each stands in the activation ray at a door's reach (`sdrift:0`, `sdreturn:0` - the mode
  machine's press ladder routes them before the action objects) with its words on the plaque (*The Rift - To the
  Shattered Hour*, *The Return - To the way in*). A step into either is asked once - outside, then inside, the Portal
  Stones' latch - and a jump into it (a door, a teleport) or a gap in the frames is no step.
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
  between brass kerbs; the Orrery's floor the Hour-dial (twelve brass hours round its rim, a ring of six segments within
  for the stones of SD6); the arena's floor cracked brass with the Mantella's light in its seams, and its four pillars.
  Its floors go to the collider (`realmFloorTris`), its lamps (`realmLights`, warm brass on the rims) to the frame's
  lights after the player's own, its light a brass trilight with a key from the clock-face behind the arena
  (`realmLighting`), its air a thin brass haze (`SD_REALM_FOG`). Its edge keeps a player on the Threshold, the walk and
  the hall (`realmClamp`, the motor's `arena`) until SD6's bridge lays more.
- **What the Hour refuses** - the court's refusals, beside the court's own lines: rest, save (the pause's Save says
  why), map (no automap slot either), a Mark and a Recall (*"Nothing answers a Recall in the Shattered Hour."*), and
  regeneration (`courtRules`, switched on in the Hour). No drip, no door, no fire of the dungeon's own.
- **The way in** (`scenes/world.js sdEnterRealm`, the Rift's door - SD4b's `enter`): under the veil (the gate's, the
  design's), the Rift's word asked once more (the Hour can close while the veil does), the Hollow left as a teleport
  leaves a dungeon, the player put at its pixel outside (the staff teleport's way - the street streamed, so the way out
  has a door to land before), then the realm built and entered (`scenes/worldModes.js enterSdRealm`), facing the Orrery.
  Its room is the relay's realm, `sd:<s>`, whose hello asks the Rift's law again (SD3's `_sdAdmit`).
- **The way back** (`sdWayBack`): the Hollow's own Rift at the Threshold's back (*The Rift - To the Hollow*), pressed or
  walked into - under the veil, out of the Hour, to the Hollow's pixel, into the Hollow by its door, stood beside its
  Rift (the Return's place, `dungeonContext.js sdRiftLanding`). A Hollow gone meanwhile: outside, at its pixel.
- **Out by force**: a death, or the Hour's end (SD2d's cast-out reaches the Hour now - the Hollow counts a player in its
  Hour as inside it), lands before the Hollow's door (the mode machine's landing reads `sdHollow`). A room that refuses
  the player for good (the Hour full, or closed) casts them out the same way with the relay's own words, once.

THE FOUR HOSTS: `scenes/world.js` WIRED (the way in and back, the eject, the room key, the edge, Mark, Recall,
regeneration, the Hollow's count of who is inside); `scenes/worldModes.js` WIRED (`enterSdRealm`, `standSdRealm`, the
landing, the light, air and lamps every frame, the room identity, `sdRealmSlot`, `stepThroughFire` handed out);
`scenes/dungeonContext.js` WIRED (the refusals, the way back's Rift, the landing beside a Hollow's Rift);
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
over the screen at the far plane, depth-tested at LEQUAL and never written, each pixel reading its own ray
(`skyBasis`), drawn in the dungeon arm's world pass after the Hour's islands and before its flats (PERF2's law: it
burns only where nothing nearer drew), every state it touches handed back.

- **The void**: near-black brass, a glow of brass along the horizon that meets the frame's haze, and two fields of
  stars.
- **The aurorae**: slow curtains of brass light high over the islands, a pale green at their hems (the Mantella's).
- **The shards**: three of the Bay's skylines hanging upside down from the upper sky, dark against the glow with a lit
  rim - Daggerfall's towers and spires, Sentinel's domes and minarets, Wayrest's bridge on its piers - round the sides
  and behind, never over the arena's clock, each drifting its own way round the sky.
- **The clock-face**: over the arena (+z, the realm's forward), a ring of stars, its twelve hours the brightest, and
  two hands of light turning BACKWARDS, the minute hand twelve turns to the hour's one - the Hour unwinding.
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
  or a mirror through twelve (*"Read the Blades from twelve backwards and you read Daggerfall."*) - so each clue is true
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
  Hour's five records): six Ending-stones on the hall's ring, each facing its centre - a slab of dark stone under a brass
  cap, its dial at chest height with a brass notch over the twelfth hour (built, so no picture can turn it), its sign
  above (the lion's face, the sun, the ship, the tusk, the crown of bone, the dragon), and TWO HANDLES: the right (as
  you face it) turns it forward, the left back - the activation ray takes boxes, and a stone's face split in halves
  would overlap where it stands at a slant. Each stone's hand is its own mesh on its own matrix (`handMatrix`): clockwise
  as one facing the stone sees it, a proper turn, never a mirror. Six Ledger plaques of bronze on posts round the rim,
  facing in, numbered in pips as a die is (no numeral to read backwards), none on the walk in or the way on. Past the
  hall on its way on hangs the first step of the Unmoored Steps (SD7's first island).
- **The dial's light and the fray**: the six segments the Hour-dial carries, lit in the Mantella's green - one for each
  stone at its true hour, how many and not which, clockwise from the twelfth (`buildLitModel`); and an ember arc just
  inside the rim, a step a turn, all the way round at the snap (`buildFrayModel`) - each rebuilt as the realm's counts
  change.
- **Heard**: the hall reads the realm's latest word each frame (the world host keeps it - `onSdHall`). The first word is
  where the stones ARE: the hands are put there. A later one sets them going the short way round at the gear's pace (an
  hour inside the 700 ms the realm settles a stone in), with a clunk at the turned stone and a lesser one at each
  partner it moved; the snap's toll (the ship's bell, low); the Concord's chime and its line.
- **Pressed**: a handle turns its stone from within reach (the realm's own law, `stoneInReach` - else *"Stand closer to
  the stone."*), never inside its gear's settling, never after the Concord. Its plaque names the stone, its sign, its
  hour and the handle's way. A Ledger plaque's riddle shows on the plaque as the ray finds it, and is said when pressed.
- **The lash** (the world host, `sdHallHeard`): a word that says the Hour snapped back lashes me if I stand in the hall -
  a quarter of my health, no shield taking it (`hurtPlayer`'s `bypassShield`) - and *"The Hour snaps back."* is said to
  everyone in the realm.
- **The Concord's bridge**: a band of light from the hall's rim to the first step, laid as the Concord is heard. Its
  floor and the step's stand in the collider from the first; the edge keeps a body off them until the Concord adds them
  (`SD_HALL_FLOORS` - the world host widens its edge then).

THE FOUR HOSTS: `scenes/world.js` WIRED (the realm's word kept and handed to the hall, the lash, the edge widened with
the Concord, a turn sent - `sdTurn`, `sdHallWord`); `scenes/worldModes.js` WIRED (the handles' and plaques' keys routed
to the dungeon host's press, the turn and the word forwarded); `scenes/dungeonContext.js` WIRED (the hall made for the
Hour alone, stood, framed, its targets, names and presses, freed); `scenes/exterior.js` FLAGGED - no Hour opens on the
bench.

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

- **The course** (`SD_STEPS_COURSE`, `SD_CHECKPOINTS`): laid along +z from the first step's far edge (A, SD6c's, z 72).
  The Drift's eight (z 79-115, on the course's line at rest), B (z 122); the Beat's seven and its two risers (z 129-166,
  the course 2.3 m higher after each riser: y 0, 2.3, 4.6), C (z 173, y 4.6); the Crumble's eight (z 180-216), each a
  step down to the arena's floor; the course ends at the arena's near edge (`SD_COURSE_END`, z 220). Every step is a
  slab 0.6 m thick, 3 m across (the Crumble's 2.6).
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
  +x then -x by turns, its wind rising the second before.
- **The void** (`inVoid`, `spanAt`, `castBackTo`): below y -30 a body is cast back to its span's checkpoint - A over the
  Drift, B over the Beat, C over the Crumble - 15% of its health lost (`SD_CAST_BACK_LOSS`). The edge lets go from just
  inside the first step's far edge to just inside the arena's near edge (`SD_STEPS_FREE`, for SD7b's clamp).
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
