# The Arena of Daggerfall (ARENA)

> Design page, written before any code (2026-10-02). The slices at the foot are the order it ships in; each is
> shippable and verifiable without the next. Where this page and a shipped slice disagree, the slice's own record
> (its Ledger row, its tests, and for the online slices this page's own ARENA4 and ARENA4b records below) is what
> runs.

## What Mac asked for

Mac, 2026-10-02, handing over Kamer's *Daggerfall Arena* 1.0 (`daggerfall_arena.rar`, one `.dfmod`):

> *"So along with this integration I want to introduce this. The new arena. This is to be a centerpoint that fits in
> the middle of Daggerfall city. Fighters from all around dagger come with the hopes of claiming the ultimate prize.*
> *1. The arena should be a centerpiece in daggerfall city*
> *2. Players can choose to watch AI fights, player fights, join a team (red and blue) and climb esclating tiers of
> opponents, or choose to matchmake for a real opponent to take on in real time.*
> *3. Joining a team comes with it's own enhanced UI where you can view your ranking and even player leaderboards*
> *4. During fights, the crowd is present and can cheer/boo you.*
> *5. Being a top rank PvE fighter comes with it's own title. Being the #1 pvp arena player comes with it's own
> temporary title/glyph*
> *I want this to be extremely detailed and authentic. All aspects and more to be integrated. I want this feature to
> be fleshed out AAA grade. All UI elements and text must be enhanced UI plus. Take your time."*

And, asked (2026-10-02): the arena takes **GEMSAL03, the city's centre-east block** (cell 4,3); a house that stood
there **moves to a new house** with everything in it; **we have Kamer's permission**; Kamer's own 32-block dungeon
becomes **the arena's undercroft**.

## What the mod is

Measured off the bundle (`scratchpad` survey, 2026-10-02; the vendor README carries the numbers):

- **Model 864102, "Castle"** - one mesh, 5,138 triangles in 23 submeshes, a non-convex collider, and DFU's own
  `RuntimeMaterials` table naming a classic texture (archive, record) for every submesh - so DFU draws it in the
  player's own art, never the bundle's. Footprint **3,396 x 3,712 Daggerfall units** (84.9 x 92.8 m), standing
  -0.6 m to 25.7 m: it fits one 4,096-unit block cell. 93% of it is Kamer's own modelling (the walls, the tiers, the
  floor, the roofs); 7% (369 triangles, the undercroft passages under the floor) are exact copies of 25 placements of
  Daggerfall's own dungeon models (62009..72006), which the port never carries - they are rebuilt from the player's
  ARCH3D (the bed-alias law, `world/customModels.js`).
- **Its two textures** are Daggerfall's water and wall records saved through DXT1 - game data, not carried (and never
  shown by DFU either: RuntimeMaterials replaces them).
- **DFARENA.RMB** - a re-saved ZLNDFLAT with no buildings: 118 classic props (the ring's banners 42512-42514 - [CORRECTED
  at ARENA5: this page called them "the seating tiers"; they are DFU's tapestry range 42500-42571, World of Daggerfall's
  "Flag" and "Flower Banner Long"] - beams, barrels, braziers), 29 light flats (torches, braziers, lanterns, lamp posts), the dirt of the arena floor, the bowl
  on the automap, and one 43600 - the stair down into the undercroft.
- **The location** - "Arena of Daggerfall", a DungeonKeep two map pixels north of the city, over a **32-block
  dungeon of Kamer's own** (no classic dungeon is its copy; none is as large).

## The shape, end to end

```
 Daggerfall city, cell (4,3) ── THE COLOSSEUM (864102 + its tiers, torches, banners, a living crowd)
   │                              │ the Arena Gate: the Herald, the Red and Blue recruiters, the bookmaker
   │                              │
   │                              ├── WATCH ──────► the stands: the bout on the floor, the crowd, a wager
   │                              ├── THE LADDER ─► join Red or Blue ► ten tiers of AI opponents ► titles
   │                              ├── CHALLENGE ──► matchmaking (online) ► a refereed bout ► the season board
   │                              └── THE UNDERCROFT (stairs) ► Kamer's 32 blocks: cells, pits, the fighters' hall
   │
   └── the ARENA WINDOW (enhanced UI plus): Bouts · Ladder · Team · Leaderboards · Records · Rules
```

## 1. The building - the colosseum in the middle of Daggerfall (ARENA1)

**The cell.** Daggerfall's 8 x 8 grid keeps its 64 cells; cell (4,3) - GEMSAL03, the same block in Daggerfall's own
layout and under Beautiful Cities - becomes **ARENADAG.RMB**, the port's own block: DFARENA's props and lights (its
43600 kept, now the undercroft's stair), the colosseum, and the gate's people. Every other cell, the Palace, the
temple, the guilds and the banks stand where they stand.

**How it is laid.** Not a world-data file and not a layout mod: the arena is not a switch, it is the city. A
location read of Daggerfall (17/1231) - Daggerfall's own or a pack's - has cell (4,3) named ARENADAG.RMB and the
location's building list stripped of exactly the entries GEMSAL03's named buildings drew (so every other building
of the city keeps its name, its faction and its quality - `talkTopics.js` `mergeNamedBuildings` draws in block
order, so the strip is computed by the same draw). The city keeps its MapId, LocationId 50026 and its castle
dungeon 50027; the quest tables' permanent places (DaggerfallCity1/2, DaggerfallCastle/1/2) are untouched.

**The model.** Vendored as data, no textures: the mesh (Kamer's 93%), the 23-slot texture table, the collider, and
the 25 classic placements rebuilt from the player's ARCH3D. Drawn through `registerCustomModel(864102)`, textures
from the player's ARENA2, climate-free as RuntimeMaterials says. A collider so the player walks the tiers and the
floor, and the walls hold.

**The gate.** The gate opens onto the market (cell 4,4), to the north (the game's compass calls +z north; the market's
cell lies north of the arena's). At the gate, as flats in person archives so the ray meets them (`isNpcFlat`):
- **the Herald of the Arena** - the one door to everything (the Arena window), and the voice of every bout;
- **the Red Banner's recruiter** and **the Blue Banner's** - to join a team;
- **the bookmaker** - wagers on the bout on the floor (gold, house edge, odds from the fighters' records);
- **the gate wardens** - two guards (the city watch's own), so a brawl at the gate is a crime like any other.

**The undercroft.** Kamer's 32 blocks, entered by the 43600 stair inside the colosseum (and by the Herald: "Go down
to the fighters' hall"). A dungeon of the arena's own location record kept OFF the travel map (it is under the
city), so the city's castle dungeon is untouched. Its people are fighters at rest, the arena's keepers and the
caged beasts of the beast tiers; it holds the ladder's training pit (an unranked bout against a dummy-fighter) and
the Hall of Champions - a plaque wall naming every Grand Champion this save (offline) or this realm (online).

**On the town map (ARENA-MAP, 2026-10-03, the owner, live: "Arena doesn't show on town map").** Both town maps draw a
cell off its block's own 64 x 64 automap bytes and name only the buildings of the location's list. Kamer's automap
draws the bowl in byte 117 - BuildingTypes.Special1 + 1, "never displayed on automap" (the classic window shows it in
its Extra and All views alone, the enhanced sheet never) - and the colosseum is no building, so the cell read as empty
street with no name. The block served now carries `arenaAutoMap` (`world/arenaCity.js`): the bowl's pixels inside the
colosseum's own box and off its sand take a guild hall's byte, so both maps draw the walls and the stands as they draw
the guilds and temples (the temple quarter's colour), a ring round the sand - which keeps Kamer's 117, an open court as
a temple's courtyard is. The navgrid asks nonzero alone, so nothing walks differently. And the block's row on the town
map carries a landmark (`arenaTownLandmark`, handed by both exterior hosts): "Arena", lettered at the colosseum's place
by the building plates' own law (`ui/exteriorAutomapWindow.js` buildPlates, `ui/townSheet.js` named), always - there is
no door to discover it by and no record to rename. `scenes/worldModes.js` and `scenes/dungeonContext.js` open no town
map. Tests: `test/arena_townmap.test.js` (4); mutants: `tools/mutants/arena_map.json` (14, all dead).

**What it displaces (Mac: "Move them to a new house").** GEMSAL03 stood 19 buildings - a tavern, two gem stores,
fifteen houses and a house of the Academics. With ARENADAG.RMB laid no building has a key in cell (4,3), so every
record keyed there is moved, once, at the first load that stands the arena (offline) and once by the service
(online):
- a **house** (offline deed): to an unowned house of the same type elsewhere in Daggerfall, chosen by the market's
  own law; its scene - decor, the furniture taken out, the chests, the floor - moved with it; a letter from the
  Daggerfall Bank says so. **Online homes**: the account service moves each home row (and its decor, look, yard and
  rents) to a free house of the city, in one migration, and the owner's next login says so;
- a **rented room** at the gem-store block's tavern: honoured at any inn of the city (already the law: `recordStands`);
- an **item at a smith**: none stood there (gem stores do not repair);
- a **quest site**: chosen again (`reseatMovedSites`);
- an **inside save / Recall anchor**: stands the player outside (already the law);
- **discovered buildings** of the cell: forgotten (the cell has none to find).

## 2. The fights (ARENA2)

Every bout is fought **on the colosseum's floor**, the space between the four braziers (about 37 m x 8 m of the
author's dirt, widened to the bowl's sand by a clamp ring - the motor's `arena`, the duel's own), with the crowd in
the tiers. Four kinds:

| Kind | Who fights | Where | Offline | Online |
|---|---|---|---|---|
| **Exhibition** | two AI fighters | the city floor, on the hour | yes | yes - the relay runs it, every client sees one bout |
| **The Ladder** | you vs AI opponents, tier by tier | an instance of the floor (your bout) | yes | yes - relay-run opponent, signed result |
| **Challenge** | you vs a player | an instance of the floor | - | matchmaking, refereed (PVP-REF) |
| **Spectate** | anyone | the stands of an instance or the city floor | exhibitions, your ladder replay | any live bout, from the Arena window's list |

**An instance of the floor.** As the Oblivion Gate's Burning Court is a made dungeon level, an arena bout is a made
level: the colosseum, its tiers and its crowd, built on its own (`world/arenaFloor.js`), entered from the gate and
left to the gate - so two bouts never share a floor, the city cell never fills with fights, and an online bout is
its own relay room (`arena:<id>` - built as `arena:b<id>`, and the hour's exhibition `arena:x<hour>`, ARENA4/ARENA4b).

**The bout.** Every bout runs one law (`systems/arenaBout.js`, pure, clock injected - on this screen the world's, held
while a window pauses the game and a frame clamped as the foes' own, AUDIT PRE-MERGE 1003 B1): the Herald's call and the
fighters' walk to their marks; **3 - 2 - 1 - Fight!**; the fight (no doors, no rest, no travel - the duel's law); the
end - a **yield** (at 15% health a fighter may yield; an AI does by its temper), a **fall** (the 1 HP floor - nobody
dies on the arena's sand; `hurtPlayer`'s `spare`, held from the word to the healers - AUDIT PRE-MERGE 1003 B5 - and a
new foe floor), a **ring-out** (carried off the sand past
the clamp's slack), or the **time limit** (3 minutes; then the judges - damage dealt, hits landed, fewer misses);
the Herald's verdict; healing to full (the duel's own); the purse.

**AI fighters.** Daggerfall's own class enemies (`CLASS*.CFG`, `characters/mobileTypes.js`) and monsters, spawned
for the bout (`spawnFoe` - `loose`, `transient`, `managed`, no loot), on their own **bout team** (a new isolation
seam beside `campId` in `characters/enemyTargets.js` - a bout's fighters fight each other alone; the city watch and
the passers-by never join), with the **foe yield floor** (a new seam in `exteriorFoes.damageFoe`: a bout fighter at
the floor yields - no corpse, no loot, no renown, the same 1 HP the player keeps). Names from Daggerfall's own name
generator by race; an epithet and a home town from the bout's seed ("Gorlak gro-Mazgul of Wayrest, the Unbroken").

**The Ladder - ten tiers.** A tier is three bouts; a fourth, the **Tier Champion**, opens when three are won. Losing
a bout breaks the tier's run - back to its first bout, three to win again before its champion (AUDIT ARENA-LADDER, the
owner: "Lose the tier's run"; it had cost only the purse, so every step fell to retries) - and a tier's champion,
who fights as an ELITE FOE (the owner: "Elite champions"), beaten moves you up for good. Opponents scale with the tier, never with
you - the ladder is a fixed mountain, as the Arena of TES I was:

| Tier | Name | Opponents (Daggerfall's own) | Level | Champion |
|---|---|---|---|---|
| 1 | The Pit | Thief, Rogue, Barbarian apprentices | 1-3 | a Barbarian |
| 2 | Bloodied | Warrior, Monk, Archer | 3-5 | a Knight |
| 3 | Sworn | Spellsword, Nightblade, Ranger | 5-7 | a Battlemage |
| 4 | Gladiator | Knight, Barbarian, Healer | 7-9 | an Assassin |
| 5 | Myrmidon | Battlemage, Sorcerer, Warrior | 9-11 | two Warriors at once |
| 6 | Bloodsworn | beasts: Grizzly Bear, Sabertooth Tiger, Giant Scorpion | - | a Spriggan |
| 7 | Hero | Knight, Spellsword, Nightblade | 13-15 | an Orc Warlord |
| 8 | Champion | Assassin, Battlemage, Monk | 15-17 | a Daedra Seducer |
| 9 | Paragon | two-against-one: Knight + Healer, Warrior + Mage | 17-19 | a Vampire |
| 10 | The Grand Melee | the Tier 9 champions' survivors, then **the Grand Champion** | 20+ | an Iron Atronach |

**Purses** in gold, on Daggerfall's scale (a tier-1 win 50 gp, a Grand Champion's 10,000 gp), and the **crowd's
favour** (below) raising them. Online, renown too, within the renown law's own hourly cap.

## 3. The teams - the Red Banner and the Blue Banner (ARENA3)

Two companies of the arena, red and blue, as old as the Iliac Bay's tourneys. Joining is at the recruiters, free,
and changing costs a season (you may leave at once and join the other at the next season). A team gives:
- **its colours** on your ladder bouts (your banners on your side of the floor, the crowd's half in your colour);
- **team points**: every ladder bout won is a point, a tier champion three, a Grand Champion ten, a refereed PvP win
  two; the season's standings are the two banners' points;
- **the season** (8 weeks online, matching `Seats-Arc` 9.1's planned seasons; offline, the in-game year): the winning
  banner's fighters wear its laurel for the next season, and the crowd favours them at the start of every bout.

## 4. The crowd (ARENA2)

The tiers hold a crowd - **Daggerfall's own people** (the animated gesturing man 182:0, the dancers and musicians
182:47-53, the courtiers 180:1-3, the nobles 183/185, the region's commoners), batched billboards on the seating
tiers, hundreds at a sold-out bout. They live:
- **Sound**: a bed of Daggerfall's own crowd voices (DAGGER.SND AmbientPeople1-10, unused until now), and cheers,
  boos and applause **built at runtime** from those voices and filtered noise (`audio.registerSamples` - nothing new
  ships); the gasp at a crit (386/387), the groan at a knockdown (458), drums before the call (28, 374), the bell
  (107), the fanfare of victory (32) and of a title (33).
- **Mood** - a number from boo to roar, moved by the bout: a big hit, a crit, a comeback raises it; stalling (no blow
  for 8 s), fleeing, a yield taken early, an unfair beast tier lowers it. **Favour** - per fighter: the crowd's
  darling and its villain. A fighter the crowd loves earns more; one it hates is booed every time they strike.
- **Sight**: the gesturers flip faster at a roar, the tiers hop at a crit; flowers and refuse thrown onto the sand at
  the verdict (flats from Daggerfall's own archives).
- **Words** - the crowd's barks, the Herald's calls and the verdicts, in one frozen `ARENA_TEXT` table: "Blood! Blood
  on the sand!", "Get up, you dog!", "Wayrest, Wayrest!", "Is that a sword or a spoon?"

## 5. The Arena window (enhanced UI plus) (ARENA3)

One window, opened by the Herald (and from the pause menu's Arena entry once you have joined), the kit's own
(`ui/enhancedFrame.js` roles, the Plus sheet, the pixel face, `role="tab"` so the pad turns its tabs):
- **Bouts** - the live and coming bouts: the exhibition on the city floor, players' bouts to watch, the ladder's next;
  each a card with the two fighters, their records, the odds, Watch / Wager / Fight.
- **Ladder** - the ten tiers as a column, your place, each tier's three opponents and its champion, cleared marks,
  the next fight's purse.
- **Team** - your banner, its season standing against the other, your contribution, the roster's top ten.
- **Leaderboards** - PvE (highest tier, fastest Grand Champion), PvP (season rating), Team; your row pinned under the
  top ten ("you"), as the gate's damage chart does.
- **Records** - your bouts: wins, losses, yields, falls, best streak, purses; the last twenty bouts.
- **Rules** - the arena's law in plain words.

In the bout, HUD readouts that take no key and do not pause (the gate bar's kind): the **versus bar** (both fighters'
names, banners, health; your stamina), the **crowd meter**, the **timer**, the Herald's lines mid-screen.

## 6. Titles and the laurel (ARENA3, ARENA4)

- **Grand Champion** (PvE) - beat the Tier 10 Grand Champion. A title for good. Offline: your character's title,
  shown on the character sheet and in the arena; online: a token title (`grandchampion`) derived from the account
  service's own ladder record - which only a relay-signed tier-10 result writes.
- **Tier titles** - each tier's champion beaten: "Bloodied", "Gladiator", ... shown on your arena card.
- **Arena Champion and the Laurel** (PvP) - the #1 of the season's refereed PvP board wears the title `arenachampion`
  and the **laurel glyph** while they are #1: derived at the token's mint from the board (as Sprout is derived from
  an account's age), so it passes to whoever takes the top and lapses by itself. Not shown offline (no PvP offline).
  AUDIT ARENA-LADDER: the #1 wears it over ten rated bouts against five different accounts at least, and a pair's rated
  bouts are counted ten a season (`net/arenaLaw.js` ARENA_CHAMPION_MIN_BOUTS, ARENA_CHAMPION_MIN_FOES, ARENA_PAIR_SEASON_MAX).

## 7. Online (ARENA4)

- **The trust law.** PvE ladder results and PvP results that award a title are **refereed by the relay**: a ladder
  bout's opponent is relay-run (the gate's `gateBrain` pattern, on the floor's flat ground - no pathing needed), and
  a PvP bout runs under **PVP-REF** (`Seats-Arc.md` 6.1, built here): the relay holds both fighters' health, checks
  every blow claim against reach, rate and a damage bucket from DFU's own weapon tables, and signs the result. A
  casual bout (unranked) may run under DUEL1's defender-resolved law.
- **Matchmaking** - a queue in the arena's hall room (`arena:hall`), by season rating (Elo, 1,000 to start, K 32),
  the band widening every 10 s; a pair found is offered a bout (both accept in 20 s), a room `arena:<id>` minted (`arena:b<id>`); [ARENA4b: and a casual queue beside it - the records below].
- **Spectators** - join a bout's room without a body (Seats-Arc 6.6's spectator), seated in the tiers; up to 60.
- **The records** - account-service tables (migration 0047+ - built as 0074: 0070 at the merge onto main, 0072 at the second, 0074 at the third): ladder results (one row a tier won), PvP results (one
  row a bout, both ratings), team membership and season; leaderboards counted from rows (`/v1/arena/board`).
- **The relay version** - one bump for the whole online slice (new frames, the arena brain, the titles and the
  glyph), so it costs one reconnect.
- **Private sessions** (ARENA6 - the record below) - a host's own room, `arena:p<code>`: members join by a six-character
  code (letters and digits), the host picks the Red and the Blue and calls their bout (casual, refereed, every fighter equally whole), the
  rest watch from the stands.

## Recorded, not built (named so they are not mistaken for missing)

- Team-vs-team battles (5v5 Red against Blue) - the siege design's slice, after PVP-REF stands.
- Betting on player bouts online with Marks.
- A mounted joust.

## Slices

| Slice | What ships | Verifiable by |
|---|---|---|
| **ARENA1** (SHIPPED 2026-10-02 - the record below) | the colosseum in cell (4,3) of Daggerfall (both layouts), the model vendored and drawn, ARENADAG.RMB, the building list strip, the gate's people (Herald opens a placeholder card), the undercroft dungeon, the displaced records moved (offline) | ARENA2 data: the city's grid, the strip, the model's mesh and collider, the move of a deed |
| **ARENA2** (SHIPPED 2026-10-02 - the record below) | the bout law, AI fighters (bout team, foe yield floor), exhibitions on the city floor, the instance of the floor, the ladder's ten tiers offline, the crowd (sound, sight, mood, words), the Herald, the HUD | the bout law's tests, a bout played through headless |
| **ARENA3** (SHIPPED 2026-10-02 - the record below) | the teams, the Arena window (all tabs, offline records), tier titles and Grand Champion offline, purses, the bookmaker | UI probes, the window's model tests |
| **ARENA4** (SHIPPED 2026-10-02, finished at ARENA4b - the records below) | online: the account service tables and board, the relay's arena rooms, matchmaking, PVP-REF, the relay-run ladder opponent, spectators, the online titles and the laurel glyph, the online home move | the relay over fake sockets, the service over node:sqlite |
| **ARENA4b** (SHIPPED 2026-10-03 - the record below) | the online half finished: the relay's exhibition, the ladder's trust (`cl`), the players' blows, the banners billed, the stands' cheer, the realm's Hall and Records, the laurel online, the gate online, a bout's Renown, the displaced online homes, the casual bout | the relay over fake sockets, the service over node:sqlite, the client headless, the UI probes |
| **ARENA5** (SHIPPED 2026-10-03 - the record below) | the audit: every slice re-read against this page, the probes, the mutants; and what it found unbuilt - the banners on the sand, the Hall's plaque wall, your ladder replay | the mutant lists of every slice, the UI probes, the browser list in its record |
| **ARENA6** (SHIPPED 2026-10-03 - the record below) | private sessions: a host opens a session under a code, members join by it, the host picks who fights and calls the bout, everyone else watches; equal health; accounts fight, guests watch | the relay over fake sockets, the client end to end on the real Room, the window's model |
| **ARENA-COPY** (2026-10-03 - the record below) | the plain-words pass: every line and press of the arena's own text said short and plain | the words pin (`test/arena2_hud.test.js`), the suites that name the lines |

## ARENA1 record (2026-10-02) - SHIPPED

**What stands.** Daggerfall's cell (4,3) is **ARENADAG.RMB** in every read of the city - MAPS.BSA's, Beautiful
Cities', a pinned town's, and with Replace Game Artwork off (`src/world/arenaCity.js`; the door's new `editLocation`
seam, run by `MapsFile.getLocation` after the location is read with its indices set, never by `readClassicLocation`,
which a pack's edit is taken against). The block is the port's own, served by `registerPortBlock` behind no switch at
the fixed index **900100** (the gate court's 900000 is the precedent), so DFU's new-block sequence - the first mod
block at BsaFile.Count, RR3b's pin - and every pack's indices are untouched. The building list loses exactly the
entries the old block's named buildings DREW (`talkTopics.drawNamedBuildings`, the readers' own draw, which now also
answers each block's draws).

**Measured with ARENA2** (`test/arena1_city.test.js`): classic - 316 entries to **313** (GEMSAL03's tavern and two gem
stores; its sixteen houses draw nothing), the city's 647 buildings to **628** (19 gone, none left in the cell), and
**all 628 others unchanged** in name, faction, quality, type and seed; Beautiful Cities - 566 to **563**, 566 buildings
to **547**, **all 547 unchanged**. Both: LocationId 50026, the castle 50027 (16 blocks), MapId unchanged, the Palace
(faction 201) standing.

**The model** (`src/world/arenaModel.js`, `vendor/daggerfall-arena/`, `tools/daggerfallArenaExtract.mjs`): Kamer's
4,773 triangles carried; **365** that are copies of Daggerfall's dungeon models left out and rebuilt from the player's
ARCH3D as **18 placements** of 8 models (62209, 63000, 63004, 63007, 63024, 63028, 63035, 72006; 13 whole, 39
triangles under another of Daggerfall's pictures as Kamer gave them). Rebuilt and merged it is the bundle's mesh again,
**5,138 of 5,138 triangles** - corners, uvs, winding and picture (`test/arena1_extract.test.js`). The design page's
"25 placements" were the survey's overlapping matches; the tool claims each triangle once, so 18 carry all 365.
Registered as 864102 climate-free (RuntimeMaterials' `ApplyClimate` 0) with the pieces it reads
(`registerCustomModel(..., { climateFree, needs })`; `dataPipeline` loads their pictures, then hands the build
`classicModel`). The bundle's two textures are Daggerfall's own and are not carried.

**The four hosts.** `scenes/world.js` - WIRED: the colosseum drawn and merged by an empty table (`NO_CLIMATE_REMAP`,
never the pixel's climate swap), its mesh collider (every placed model's: the tiers, the floor and the walls), the
43600 stair handed the undercroft (`arenaDoorTarget`, its own exit group `<pixel>:undercroft`), the quest location
underground the undercroft's own record (`_questLoc`), the displaced deed moved at load (`moveArenaDeed`, before the
pins). `scenes/exterior.js` (Daggerfall's own city host) - WIRED: the same draw table, collider and stair; FLAGGED: it
builds no save doors, so no deed is moved there. `scenes/worldModes.js` (interiors, and the exterior press both hosts
share) - WIRED: the Herald's click, and an inside save or anchor in a building the arena took stands outside.
`scenes/dungeonContext.js` - FLAGGED: the undercroft is an ordinary dungeon there (no code of its own); 864102 never
stands underground.

**The gate's people** (`ARENA_GATE_PEOPLE`): the Herald (183:5, the Court of Daggerfall 595), two wardens (183:2,
183:3, the Royal Guard 372), the Red and Blue recruiters (182:25, 182:28) and the bookmaker (182:24) - the People of
Daggerfall 518 - just outside the north arch, between Kamer's lamp posts. The Herald's click opens `ARENA_TEXT`'s
notice through the one box (the enhanced notice panel; the parchment on the classic skin); the others talk as the
city's people do. Placeholders for ARENA2/3.

**The undercroft**: Kamer's 32 blocks (start N0000077), laid out from BLOCKS.BSA; its record carries his location id
55398 and map id 211207 under the city's region, climate and pixel, off the travel map. A save made below re-enters it
(`dungeonStartDoorFor` by `dungeon:55398`); the castle's own doors are another exit group.

**Displaced records, offline.** `layoutPins.recordStands` answers false for a record keyed to the cell
(`arenaRecordDisplaced`), so: a rented room is honoured at any inn of the city (`findRentedRoom`), a ticket at any smith
(`isBeingRepairedAt`), a quest site is chosen again (`Place.reseatMovedSite`, run in `applyLayoutPins`), an inside save
or a Recall anchor stands outside (`restoreInterior`'s new guard - the old block index alone could have matched another
town's GEMSAL03). A house deed is moved once (`systems/arenaMove.js`): to a free house of its type in the city (any
house when none is free), never one another record holds or an active quest's, by the market's xorshift seeded by the
map id and old key; its scene renamed with it (`sceneCache.renameScene` - the entry, its other layouts' visits, their
permanence; SUPERSEDED at ARENA2: the old scene is emptied into the new house by what it held, `emptyArenaScene`, and
`renameScene` is gone); the cell's discoveries forgotten, the new house discovered as the player's residence, the Daggerfall
Bank's letter and a notebook line. Verified with ARENA2 in both layouts: a GEMSAL03 House2 deed lands on a House2 of
the city outside the cell.

**ARENA4 - the online homes' migration** (written down, not built) [BUILT at ARENA4b, decided by Mac: the owner's
client picks the house by `arenaHouseFor` and the service checks it; what moves follows the offline law below, not
this paragraph's re-keying - see the ARENA4b record]. The account service owns online homes: `homes`
(PK map_id, building_key; 0010, `layout` 0073_home_layout), `home_decor` (0011, `yard` 0039), `home_hidden` (0015) and `home_rooms`
(0037), each keyed (map_id, building_key) with `ON DELETE CASCADE` from `homes`. One migration (the next free number) and
one service pass must, for every `homes` row whose map_id is Daggerfall's (1291010263) and whose building_key is in cell
(4,3) (`key >> 16 = 4 AND (key >> 8) & 255 = 3`): pick the new key by `arenaHouseFor` over the city as its row's
`layout` stands it, excluding every building_key a `homes` row of that map already holds; insert the new `homes` row
(every column carried, `look`, `rent_due` and `layout` with it), re-key its `home_decor`, `home_hidden` and `home_rooms`
rows (tenants keep their rooms), then delete the old `homes` row - in that order, in one transaction, so the cascade
never takes the children; and leave the owner a notice for the next login (the Daggerfall Bank's letter). Idempotent: a
row already outside the cell is never touched. The relay's `interior:m<map>.<key>` rooms follow the key.

**Not done / open.** Not seen in a browser or on a GPU: the colosseum's look, the tiers' walkability under the port's
collider, and the gate people's footing on the terrain at the block's edge are unverified by eye. Smaller Dungeons (a
setting) may trim the undercroft as it trims any keep [FIXED at ARENA5: it never does -
`world/smallerDungeons.js useSmallerDungeon`; see the ARENA5 record]. The Herald's line is a placeholder until
ARENA2's bouts and ARENA3's Arena window. [ARENA2: the Herald's choice stands; the displaced deed's scene is EMPTIED
into the new house rather than renamed onto it - see the ARENA2 record.]

## ARENA2 record (2026-10-02) - SHIPPED

**The bout law** (`src/systems/arenaBout.js`, pure - the clock and the dice handed in, so ARENA4's relay runs the same
law): call (a beat for the bout's line and one per fighter, each cried) - walk (every fighter on their mark, or
WALK_MAX_MS) - count (the duel's three seconds, said 3, 2, 1) - fight - end (END_HOLD_MS) - verdict (VERDICT_MS) - heal
(the duel's DUEL_HEAL_HOLD_MS) - done. A side is out when all of it is; the bout ends when one side (or none) stands, so
a two-against-one and a Grand Melee (every fighter a side) are the same law. Endings: YIELD at 15% or under (the
player's by choice - sheathing the blade at the line; refused above it with the Herald's "not yet"; an AI's by its
TEMPER, one roll a second, `temper x 0.45`, none for a beast, a daedra or a vampire), FALL at the 1 HP floor, RING-OUT
past the ring plus the duel's 4 m slack for its 2 s, TIME (3 min) and the judges: damage, then hits, then fewer misses,
level on all three a draw. Events: call, crier, walk, count, fight, hit, crit, miss, knockdown (a quarter of the struck's
health in one blow, or driven under the line), comeback (once low at 35%, drawn level), stall (no blow for 8 s, once a
stall), flee (outside the line inside the slack 1.5 s), yield, fall, ringout, timeout, end, verdict, heal, done. The purse:
favour -1..1 raises it by up to half or cuts it by up to a quarter.

**The fighters** (`src/scenes/arenaBouts.js` the driver, `src/systems/arenaFighters.js` who they are). Daggerfall's
own class enemies and monsters, a name drawn by DFU's NameHelper over the bank of their home (High Rock's Bretons,
Hammerfell's Redguards, Skyrim's Nords, ... Orsinium's orcs on the monster bank) on DFRandom seeded by the bout and put
back as it stood, an epithet and the town, all from the seed. THE BOUT TEAM is a seam beside `campId` in
`characters/enemyTargets.js` (`boutGate`, `entity.bout` `{ id, side, out, hold, hooks }`, `setPlayerBout`): a bout's
pair skips the team, ally, infighting and hostility chain (two orcs of one bout fight, infighting off or on); anyone
else meets no fighter and no fighter meets them (the watch, a passer-by, another foe); the player is a target only as
the bout's opponent; nobody is a target before the word or once out; the target machine drops a target the gate
refuses (the striker MakeEnemyHostileToAttacker writes in). THE FOE YIELD FLOOR in both damage doors
(`scenes/exteriorFoes.js damageFoe`, `scenes/dungeonContext.js damageFoe`), before every death arm: held at 1, no corpse,
no loot, no renown (not even the strike's credit), no death notice, no soul trap, the bout told the floor once and every
blow (`hooks.hurt`). A player's blow on an EXHIBITION fighter (no bout of theirs) turns no area (`handleAttackFromPlayer`'s
guard): the bout's `intrude` hook warns through the Herald, then commits Assault and calls the watch by the street's own
law (`setCrimeCommitted` + `_crimeResponse`). Spawned through the pools' own doors - the exterior's `spawnFoe` (`loose`,
`transient`, `managed`, `champion: null`, `level`), the dungeon's `spawnLooseFoe` (new `level` and `bout`: no
progression scaling, no loot, never the room's) - at their marks facing the middle (the walk is the stand: a fighter
stands on its mark at once - a walk-to-mark steer is the motor's to add, recorded) [SUPERSEDED at ARENA-FIX 8: they walk in
from the gates as the Herald cries them]. Exhibition fighters are not hostile
(no rest refused near the colosseum); ladder opponents are. The crowd's "crit" is a blow of 15% of the struck's health
(the critical-strike roll is the formula's, never seen at the damage door). Misses: the law counts them, but no host door
reports a swing that connects nothing yet - the judges' third count is live only where a host says so (recorded).
[SUPERSEDED at ARENA-FIX 9/10: the misses are heard and the crit is the formula's own roll - the record below.]

**The floor's instance** (`src/world/arenaFloor.js`, the Burning Court's law: a made DUNGEON level, no fifth host).
ARENADAG.RMB's 118 misc models carried into a made RDB block at `(X, Y + 4, Z + 4096)` (so each lands where the RMB put
it; the undercroft's 43600 stair and the gate's people stay in the city), its 29 light flats as flats (centred by their
measured half heights) and as dungeon Light objects, a start marker by kind - the ladder fighter on their mark on the sand
(-6, 0), a watcher on the lower terrace (0, -21.8, 6.9 up). The sand: the colosseum's model floor (y -4.68 in its frame,
a 19.5 m disc measured off the mesh); the ring 14 m (the motor's clamp, `player.arena`, the duel's own), ring-out at 18 m
before the wall. Its ways out: the sand's north gate and the terrace's stair (exit doors), shut while my bout stands
(`ARENA_TEXT.refuse.door`), landing before the Herald. No rest, save or map there (`dungeonContext`'s refusals); no
dungeon drip; an open-sky torchlit ambient and a thin night fog (`worldModes`). Entered by the Herald's Fight or Watch
(`enterArenaFloor`); the fighters' hall is the undercroft's stair taken as a door (`enterArenaUndercroft`).

**Exhibitions** (`exhibitionFor`): one an hour of the gates' hours (08:00-21:00), open for its first 20 game minutes, two
fighters of one tier's roster (beast against beast in the beast tier) drawn from `arenaHash(hour)` - the same hour the same
bout on every screen, so ARENA4's relay runs the schedule on the shared clock [BUILT at ARENA4b: `net/arenaExhibition.js`, `arena:x<hour>`]. On the CITY floor (world.js
`arenaCityStage`: the colosseum block's origin in its built pixel plus the RMB colosseum's place less its sand) while the
player stands within 150 m (dismissed past 260 m, unsaid, and restarted from its call on return inside the window); and
in the instance when Watch is chosen.

**The ladder** (`src/systems/arenaLadder.js`) is the design table row for row; Tier 9's third bout is Knight + Mage (the
table names two pairs for three bouts); Tier 10's three Grand Melees are Knight/Warrior/Healer at 20, Assassin/Battlemage/
Monk at 21, and the champions' survivors (Vampire, Daedra Seducer, Orc Warlord), then the Iron Atronach. Purses: bouts
50-1,800, champions 200-5,400, the Grand Champion 10,000. The save's `arena` (versioned `v: 1`; any older or broken shape
reads back whole; a pre-ARENA2 save climbs from the Pit). Titles (Pit Fighter ... Paragon, Grand Champion) offline: in
the Herald's lines and the character sheet's Arena section (`ui/enhancedCharSheet.js arenaSheetLine`).

**The crowd** (`systems/arenaCrowd.js`, `systems/arenaSound.js`). Mood -1..1 (boo, jeer, murmur, cheer, roar), each event's
push, settling over 7 s; favour per fighter (Daggerfall's own start loved; the beast tier starts sour and pities the
player); a fighter at -0.3 or worse is booed at every blow. Sight: billboards of 182:0, 182:47-53, 180:1-3, 183 and the
High Rock commoners (182, 184) on seats sought by a down-ray over the tiers (5 to 14.5 m above the sand, never a roof),
140 at an exhibition up to 420 at the Grand Champion; the gesturers flip at 5 fps rising to 12 at a roar, the tiers hop
at a crit or a fall, flowers (TEXTURE.254's roses and flowers) or refuse (its teeth) thrown at the verdict by favour.
TEXTURE.185's records stand 6 m tall (mounted figures) and are not seated [CORRECTED at ARENA-FIX 13: they WERE seated, 6 m
tall - TEXTURE.185 is TEXTURE.183's court at +128 scale; they sit at 183's -128 now]. Sound: the bed and the cheer, roar, boo and
applause synthesised at runtime from DAGGER.SND 441-450 (`audio.samplesOf`, a new read-only door) and filtered noise and
registered (`audio.registerSamples`); gasps 386/387, groan 458, drums 28/374, bell 107, fanfares 32/33 as they are; the
bed's gain by mood and distance. Words: barks gapped 2.6 s, never repeated twice running, a town's chant.

**Music** (`systems/arenaScore.js`): ARENAMAR (B-flat march, 116 BPM, 16 bars) through the call and the fight, ARENAWIN
for 9 s from the verdict, then quiet; held by world.js beside the court's score.

**The HUD** (`ui/arenaHud.js`, a readout like the gate bar): the versus bar (names, banner marks for ARENA3, health, the
darling and villain marks, Yielded/Down/Out), my stamina, the crowd's meter and its word, the clock, the crowd's shout,
the yield hint; the Herald's calls and 3 - 2 - 1 - Fight! mid-screen (`setMidScreenText`). Its own sheet in the pixel face
(both skins), dressed on Plus by the kit's roles (`.arena-plate` a panel, `.arena-timer`/`.arena-tag` chips) and
`ONLINE_DRESS_CSS`'s fills; textContent only, widths alone inline, reduced motion, touch sizes.

**The Herald** (`systems/arenaHerald.js`): a ChoiceWindow (the enhanced dialog on Plus, the panel on classic) - Watch,
Fight, the fighters' hall, Leave; a choice that cannot be taken is not offered and his lines say why (no bout until the
hour, not fit to fight under half health, the ladder done).

**The fix from ARENA1** (`systems/arenaMove.js emptyArenaScene`): the old house's scene is emptied into the new one by
what it held - the owner's own things back to the furnishings or the pack, the catalogue's placed pieces paid back whole
into Daggerfall's bank account, the furniture marks dropped, every chest's, storage piece's and floor pile's item into the
new house's `container:0` (a crate set down where the owner first walks in when the house has none). A torch left burning
on the old floor is not carried (recorded) [SUPERSEDED at ARENA-FIX 11: it is put out and carried].

**The four hosts.** world.js WIRED (the driver, the city stage and schedule, the instance's stage through the modes,
the crowd in both billboard passes, the music, `duelEnemyNear` and the ring, the Herald's doors, the move's doors).
worldModes.js WIRED (the Herald's click, the instance, its gates and landing, its light and fog, the crate fallback).
dungeonContext.js WIRED (the yield floor, the fighter's level and loot, the spare, rest/save/map). exterior.js FLAGGED
(no driver: the Herald keeps ARENA1's notice there) [SUPERSEDED at ARENA-FIX 12: WIRED]. Solo elsewhere is unchanged: nothing runs off Daggerfall's cell.

**Verified.** Nine suites (`test/arena2_*.test.js`, 74 tests), 77 mutants, all dead (`tools/mutants/arena2.json`). The UI
probe (`tools/arenaHudProbe.mjs`) draws the HUD - a duel with the widest names, a three-way melee with a yield - and the
Herald's choice at 1440, 800 and 390 wide on both skins: inside the viewport, nothing spilling, in the pixel face. The
world probe (`tools/arenaProbe.mjs`, Chromium on a software GPU, the player's data) boots in Daggerfall, finds the sand
in the city, runs the hour's exhibition from the call into the fight with the crowd drawn, opens the Herald's choice
(Watch / Fight / Hall / Leave), goes down to the floor's instance, starts a ladder bout there, ends it by a fall to the
verdict and the healers, and reads the ladder's count back (one win, a 56 gp purse) - no arena error on the page. A
software GPU runs a frame or two a second, so a whole fight is not watched blow by blow there; the blows, the yield,
the stall, the ring-out and the judges are the law suites'. After the fall the HUD's clock stands where the fight ended
(the probe's verdict frame read 0:00 before that fix).

## ARENA-FIX record (2026-10-02) - the QA round

A visual QA pass over ARENA1 and ARENA2 in the browser (the `?exterior&shot&play` host, SwiftShader, the player's ARENA2)
and the ARENA2 builder's own open items. Every item fixed and pinned (`test/arena_fix.test.js`, 20 tests; the arena1/arena2
suites updated where the law moved); mutants `tools/mutants/arenafix.json` (43, all dead).

1. **The stairs walk** (`world/arenaModel.js withStairRamps`). The gate courtyard's flight up to the ring failed: its foot
   stands 0.62 m over the courtyard's ground (the mesh floats 0.22 m over the city's terrain - past stepOffset 0.5) and its
   risers are 0.37 m on 0.40 m treads, so the capsule caught their lips and the enhanced climb took the stair for a wall.
   Every stair run of 864102 is read off its faces (`arenaStairRuns`: vertical faces 0.1-0.48 m high, chained one on
   another the same way a tread apart, three or more, sharing 0.5 m of width) - five: the gate's two flights (19 and 14
   risers, 7.35 and 6.9 m wide), the east twin (14) and the south terrace's two (10 each); the wall walk's 0.58/0.72 m
   parapet steps are no stair - and each is given a RAMP over its nosings' upper hull, 2 cm up, run on 0.6 m under its first
   riser's foot (so the gate's floating foot meets it under the ground). The ramp's triangles follow the drawn ones in the
   index list and in no submesh: every host draws a model by its submeshes (and the static batches and the automap's wire
   walk submeshes) and builds every collider from the whole list - so no host changed. Walked in the browser up and down
   all five, holding W (a scratch script of the QA round, `climbwalk.sh`, not kept in the tree): grounded every sample,
   never the climb.
2. **The gate's people by office** (`arenaGatePersonName`, `ARENA_TEXT.gateNames`): the plaque, "You see ..." and the
   talk window ask one seam (`worldModes.js officeName`): The Herald of the Arena, Arena Warden, Red Banner Recruiter,
   Blue Banner Recruiter, The Bookmaker.
3. **The paving and the plazas** (`arenaGroundTiles`, `ARENA_PLAZA_FLATS`/`MODELS`). The whole cell is the climate set's
   flagstone (record 46 - every street of the city round it; the climate's own archive draws it, its winter set in the
   snow) in its four lays: the gate's approach, its passage, the courtyard, the aprons. At the three blind sides, where
   ARMRAL02's (west), CUSTAA02's (east) and LIBRAL03's (south) streets meet the walls: Daggerfall's street lamps (210:29)
   either side of each street's end, benches (41105/41106) along the walls, the arena's stores by the south towers
   (41832, 41822), a signpost (212:6) where the streets come in. Looked at from all four streets and from the air.
4. **The undercroft is the fighters' hall** (`world/arenaUndercroft.js`, `dungeonContext.js`, `worldModes.js`). Its stair
   names it ("To The Arena Undercroft"); its record's name is "The Arena Undercroft" (the header keeps Kamer's for the
   record's identity). No random foe stands at its 343 markers (it had stood a HumanStronghold's table) and no rest is
   broken there [NARROWED at FIELD BUGS 2026-10-04e UNDERCROFT-DEEP: so within the hall's reach; the deep cellars past it
   stand the keep's own foes again, below]. Out from the stair by distance: the Pit Master (357:3) at the training pit, its straw dummy (211:20) and a
   brazier (210:19); the Keeper of the Hall (183:12) at the Hall of Champions, its cups (200:1, 200:5) and arms (207:2, 8,
   12) beside her and a brazier; nine people at rest (the pit fighters 357:10/11 and 357:7, 334:11 at his lute; the
   armourer at his anvil 334:14, the cook 184:16, 334:7, 334:17, 334:18), every one lit; then four chained beasts (a
   Grizzly Bear, a Sabertooth Tiger, a Giant Scorpion, a bear - real bodies, passive, each its own always-held bout tag:
   they target nobody, nobody them; struck, held at the yield floor and the keepers' warning said); the deep cellars
   quiet [SUPERSEDED at FIELD BUGS 2026-10-04e UNDERCROFT-DEEP, `01-Overview/Field-Bugs-2026-10-04e.md`: a whole RDB
   block from the stair and from every place the hall took, the keep's own foes stand again; no rest within that reach
   is broken]. The Pit Master's choice opens the PRACTICE BOUT: the bout law over a pit stage (`arenaPitStage` - the pit's
   centre, a 6 m ring, the fighters along its passage), a sparring fighter of the player's tier (`practiceBout`), no purse,
   no ladder step, no crowd, no music, his own call and his word after. The Keeper reads the Hall (`hallOfChampions`):
   this save's Grand Champion, each tier whose champion fell (its number and name, the title it gave), or "No name is cut
   here yet". Seen in the browser: the hall's people and beasts stood (4 foes, all chained, none hostile), the Pit
   Master's plaque and choice, a practice bout fought (the HUD with no crowd row).
5. **One submesh a picture** (`composeArenaModel`): 85 submeshes for 23 pictures became 23; every triangle under its own
   picture, the extraction's exactness test unchanged.
6. **The seams** (`sealArenaSeams`, run on the rebuilt mesh at registration): the hairline of sky down the wall/gatehouse
   junction was a T-JUNCTION crack (860 corners standing on other faces' edges; each face cut at them - a fan from the
   opposite corner, or from the incentre - its uv and normal interpolated); the inner wall's streaks were Z-FIGHTING
   (seven same-facing coplanar overlaps - 109_0 over 109_1, 171_3 boards laid twice - the plane's lesser picture set back 6
   mm); 317 corners a hair apart welded. Before and after shots at one pose: the line of sky dots on the gatehouse pillar
   gone (`cmp_B`).
7. **The gate's compass**: the gate opens onto the market, to the NORTH (the design page said south).
8. **The walk in** (`enemyMotor.js walkTo`, `arenaBouts.js walkIn`): each fighter stands at its side's gate under the tiers
   and walks to its mark (the pursuit's own walk, 0.7 of its pace) as the Herald cries its name; the count waits for every
   fighter on its mark (or the walk's limit). A pit has no gates: its fighter stands on its mark. The pace is the walk's
   own step's (AUDIT PRE-MERGE 1003 D1: it was a field the motor put back only at its own arrival, and the bout ends every
   walk in itself, at its mark or the walk's limit - so every fighter that walked in fought its bout at 0.7 of its speed;
   `test/audit1003_record.test.js`).
9. **The misses** (`formulas.js registerAttackResolutionListener`, `playerWeapon.js registerPlayerSwingListener`): every
   attack's resolution is told; between two fighters of a live bout on different sides, no damage is the striker's miss,
   and the player's swing that reached nobody is the player's - the judges' third count is live.
10. **The crits**: the crowd's crit is the formula's own critical-strike roll, told with the resolution and matched to
    the blow the damage door hears within 400 ms; the 15%-of-health stand-in only where no resolution was told (a spell).
11. **The torch**: a light left burning on a moved house's floor is put out and carried into the new house's chest, the
    item picking it up gives (`droppedLightItem`).
12. **The four hosts**: `scenes/exterior.js` runs the bout driver (the city's exhibitions, the Herald's choice, the floor's
    instance, the pit, the crowd in its billboard passes, the ring, the misses) - verified in the browser (an exhibition
    on the city floor, the Herald's choice, down to the undercroft, a practice bout). Home.md's open flag closed.
13. **The court's nobles**: TEXTURE.185's lords and ladies (0, 1, 5-8) sit in the stands at TEXTURE.183's scale.
14. **The big woman** in the ARENA2 shots was the PLAYER'S OWN SPRITE (Eye of the Beholder's PlayerBillboard, third person
    by default, the Light Fighter set), facing the lens: the mod faces the sprite along its last walk, and a body placed
    without walking (a fighter stood on its mark, a probe's pose) kept a stale facing or none (the zero vector - its front
    to the camera). A placing now faces the body the way the view was placed (`eotbBody.js faceYaw`, a frame's jump past
    8 m). With it, a giant noble (13) seated near the probe's camera was the other figure.
15. **The streaming host**: `?world` (the real game) does reach play here - `__shotReady` is the `?exterior` host's
    flag; the world host's readiness is `__mode()` and `__streamIdle()` (what `tools/arenaProbe.mjs` waits on). The
    probe ran all ok on it after the fixes: booted in Daggerfall, the colosseum's sand in the city, the hour's
    exhibition from its call into the fight (59 crowd batches, the fighters walking in from the gates), the Herald's
    choice (Watch / Fight / the fighters' hall / Leave), down to the floor's instance, a ladder bout fought to a fall,
    the verdict and the healers, the ladder counting one win and a 56 gp purse, no arena error on the page. Its shots
    are the ARENA2 shots retaken at the same poses: the player's own sprite with its back to the camera, no giant noble.

Not done / open: the probes run on a software GPU at a frame or two a second, so a whole walk-in is watched in the
headless suite (real motors on a flat floor) and only its first metre in the browser.

## ARENA3 record (2026-10-02) - SHIPPED

**The banners** (`src/systems/arenaLeague.js`, pure - the game minute handed in). The season offline is the game's year
(3E 405 at a new game; its day the day of the year). Joining is at the recruiters, free; quitting is at once and asked
twice; the OTHER banner is refused until the next season ("you quit the Red Banner this season"), the banner quit takes
you back at once. Team points: a ladder bout won 1, a tier champion 3, the Grand Champion 10, to the banner worn (none
unworn - the bout is still kept). The season closes on the first read past it (`rollLeague`): the roster's whole season
plus the player's points, its winner, the side the player fought on, kept for the Team board (twelve seasons); the
laurel to the winning banner for the next season - the crowd's favour +0.25 from the first bell for a fighter in it (the
player in a ladder bout when they wear it; an exhibition's fighter in its colours); a level season none; seasons passed
unread each closed, the player's points only in the first. THE ROSTER: 24 fighters a banner a season, Daggerfall's 18
classes, named by the bouts' own law (`fighterIdentity` - NameHelper over their home's bank on a seeded DFRandom stream),
each climbing the same ten tiers one bout every 7 to 20 days by a talent against the tier (`rosterWinChance`, 4% to 96%):
measured over 3E 405-410, a Grand Champion in some seasons and none in most, the banners' totals ~800 at the close and a
few dozen apart, so a whole ladder climbed in a season (67 points) can turn it. The roster is the leaderboards' field, the banners' points and the Hall's names.

**The gate** (`src/scenes/arenaGate.js`, one home for both hosts that stand the colosseum - world.js and exterior.js;
worldModes.js finds the person by office): the Red and Blue Banners' recruiters (`recruiterChoice` - the pitch, the
season's day and standing, join / quit / the Arena window / leave, every refusal a line; joining opens the window on its
Team page), and the bookmaker. The Herald's choice carries "A - The Arena window" (the ARENA2 pin moved, its reason in
the test) and names the banner you fight under, or the laurel.

**The bookmaker** (`src/systems/arenaBook.js`). An exhibition fighter's record (6 to 35 bouts) and form come from the
bout's own seed; its strength is its level (the tier's, or Daggerfall's own for a beast) and its form; the chances are
the two strengths apart. The price is the fair price less the house's tenth, rounded DOWN the bookmaker's ladder of 40
prices ("5 to 6" on an even bout, 1 to 5 the shortest, 10 to 1 the longest - a favourite shorter than 1 to 5 is laid no
price at all, AUDIT PRE-MERGE 1003 B4); a winning stake pays itself and the price
in whole gold. One wager a bout, 10 to 1000 gold (DFU's payment law - coins, then letters of credit), taken while the
bout is open and until the fight's word. Settled by the verdict seen on this screen (the driver's `exhibitionVerdict`),
or - nobody here saw it - by the house's seeded record by the same chances once its hour is out (never while its bout
stands here); a draw returns the stake. A bout of this screen's walked away from after its word, its verdict unsaid, is
the house's - the stake lost whichever fighter led (a fall already standing is its verdict); the book on an hour seen
here, to its verdict or left, takes no wager after, and the Herald's Watch does not fight it again (AUDIT PRE-MERGE 1003
B3). Winnings wait at the stall ("C - Collect your 175 gold"): he pays in person.

**The Arena window** (`src/ui/arenaWindow.js` over `src/systems/arenaBoard.js`; `src/ui/arenaDoor.js`, the Reforge's
door's shape). Bouts (the hour's exhibition or the next - the Red's fighter against the Blue's, each with pennant, home,
epithet, class and level, record, price and the favourite; Watch and Wager - whom, how much, placed; the players' bouts
said online; the ladder's next - Fight; every press refused at the press with its reason under it: at the gate only
(60 m of the Herald), not until its hour, the book shut, rest first; what the bookmaker owes). Ladder (the ten tiers as
a column, three pips and a crown each, cleared / you are here / ahead; a tier picked opens whole - its three bouts' and
its champion's opponents, beaten and next marked, its purses, the title it gives, the beasts and the melee said; your
titles). Team (the season on one split bar with the laurel marked; joined: your banner's crest, motto and lore, your
points and bouts won for it, the roster's top ten by points with you pinned under it at your true rank; unjoined: both
banners, their best three and where to join). Leaderboards (the highest tier - this season's field and you, the Grand
Champions first; the fastest Grand Champion - days from the first bout, every season this save has seen; the season's
rating - online, said; the banners by season with the side you fought on). Records (ten stats, your titles, the last
twenty bouts with date, tier, opponent, result, how, purse and points; your wagers). Rules (five sections in plain
words). Six `role="tab"` tabs the pad turns, 1-6 a page, the arrows on a tab; textContent only. The kit's roles on Plus
(`FRAME_ROLES` - the window, the cards, the presses, the header, the chips, the tiers); the classic skin lays its own
sheet (`ARENA_WINDOW_CSS` and the kit cut to `aw-`). Opened by the Herald, the recruiters, the bookmaker, and - once a
banner is worn - the pause window's Stats page and the F5 page ("Arena", beside Pack, Spellbook and Chronicle) in every
host (the street, an interior, a dungeon - the undercroft too).

**The titles** offline: the Herald cries you by the ladder's title on the sand ("Aldric, Grand Champion!"); the window's
card and the leaderboard show it; the character sheet's Arena lines carry the banner worn. The Hall of Champions
(`hallOfChampions`, the Keeper's) reads every Grand Champion this save has seen: yours first, then the banners' who took
the title, each season since the save first saw the arena (`since`), the newest first, home and banner.

**The versus bar** (`ui/arenaHud.js`): each fighter of a banner wears its pennant before the name (`data-team`) - mine in
a ladder bout under one, an exhibition's Red against Blue; the house's fighters none. ARENA2's `data-banner` unchanged.

**The save**: `arenaLeague` (versioned `v: 1`, beside ARENA2's `arena`): the banner, the quit, the season's points, the
laurel, the closed seasons, the last twenty bouts, the first bout's and the Grand Champion's minute, and the book (twenty
wagers, the verdicts seen, what is owed). Any older or broken shape reads back to a fighter of no banner.

**Verified.** Four suites (`test/arena3_*.test.js`, 27 tests), 62 mutants all dead (`tools/mutants/arena3.json`). The
window probe (`tools/arenaWindowProbe.mjs`) draws every page and the wager open at 1440, 800 and 390 wide on both skins
over a save with something on every page: inside the viewport, nothing sideways, the pixel face, the kit's frame (301 checks, all ok; on a phone the tab strip runs past the edge and scrolls inside the window, the page itself never sideways). The
world probe (`tools/arena3Probe.mjs`, Chromium on a software GPU, the player's data): booted in Daggerfall, the Red
Banner's recruiter's choice at the gate (Join / the window / Leave), joined - the window opening on its Team page - every
page standing in the viewport over the real save, Escape; the bookmaker's stall (its book shut on the probe's hour - the 12:00 bout already on the sand - so the wager placed and paid is the window probe's and the gate-flow test's); the Herald's choice with the window's
door; the pause window's Arena door once joined; down to the floor's instance for a ladder bout - the red pennant on the
versus bar - fought to a win, kept for the Records page with its point for the Red Banner (every check ok, no arena error on the page).

**Not done / open.** Recorded, not built: the banners' colours ON THE SAND (banners on your side of the floor, the crowd's
half in your colour - Arena.md 3) wait on a tint the billboard pass does not take and on hangings the floor's instance
does not stand; the HUD's pennant is this slice's mark of them [BUILT at ARENA5: the wash and the hangings - its
record]. The exhibition fighters are the bouts' own (ARENA2's
`exhibitionFor`), not the roster's, so a wager's record and form are the bout's and not a roster fighter's season. The
online half - the season's 8 weeks, the PvP board, `arenachampion` and the laurel glyph, the relay's arena rooms - is
ARENA4's; the audit is ARENA5's [both SHIPPED - their records below].

## ARENA4 record (2026-10-02) - SHIPPED, finished at ARENA4b (2026-10-03)

ARENA4 shipped its code in three commits on its branch (the account's records, the relay's rooms, the client) and no
record; ARENA5's audit found its online half short of this page and the ARENA4b slice built what was missing (the
record after this one). What ARENA4 itself stood:

**The account's records** (`server-account/src/arena.js`, migration `0074_arena.sql` - 0047 on its branch, 0070 at
the merge past main's 0047-0068, 0072 past PROF9's and PROF12's 0069_cooking and 0070_alchemy at the second, 0074 past SILVER-WAYS' 0071_silver_ways and PROF2b's 0072_motherlodes at the third). Three tables: `arena_pve` (one row a bout the relay refereed: the tier and step, won or
lost, how, the banner worn; one WIN a step, so a climb cannot hold the same bout twice), `arena_pvp` (one row a bout
between players whoever claims it, both accounts, the result, both ratings before and after, rated or kept-unrated) and
`arena_members` (the banner, the season joined, the banner quit and when). `POST /v1/arena/claim` takes a relay-signed
receipt (`src/net/arenaReceipt.js`, `a1`: a ladder receipt names one account, a players' two different ones; its claims
disjoint from the gate's and the raid's; a week to be carried): a ladder WIN is kept only as the account's next bout (in
the write - the INSERT is ordered, the service is the arbiter), a loss whatever its order, a receipt once whoever carries
it. `/v1/arena/board` counts every board from the rows - the season's ratings and its #1, the climb (every account's
highest bout won), the fastest Grand Champions, the banners' points this season and last, each banner's roster, the Hall
- each a top ten and the caller pinned under it; `/v1/arena/team` joins (free), quits (at once) and refuses the other
banner until the next season. The season is eight weeks from Monday 2026-09-28 (`src/net/arenaLaw.js arenaSeasonOf`);
the rating is Elo, 1,000 to start, K 32, held between 100 and 4,000; team points a ladder bout 1, a tier champion 3, the
Grand Champion 10, a refereed players' win 2. Past five rated bouts in a day between the same two accounts, a bout is
kept and not rated (the pair's day).

**The titles** (`server-account/src/titles.js`, `src/net/identityToken.js`, `src/ui/playerBadge.js`): `grandchampion`,
for good, from the account's own climb - forty refereed wins in order, written only by in-order verified receipts;
`arenachampion` and the LAUREL glyph for the season's #1 with at least three rated bouts, derived at the token's mint
from the board as Sprout is from an account's age, so it passes to whoever takes the top and lapses by itself (each
Worker caches the #1 for 60 s).

**The relay's rooms** (`server/src/index.js`, `src/net/arenaBrain.js`, `src/net/arenaLaw.js`; RELAY_VERSION world155 -
world142 on its branch, renumbered past main's world154 at the merge, `ARENA_RELAY_MIN` 155). THE HALL (`arena:hall`): a
registered account's queue word with its season rating (the token's `ar`; a guest is refused), paired inside a band of
100 that widens by 100 every 10 s, offered a bout both must accept within 20 s, a pair that declined not offered again for
60 s; a bout's room is `arena:b<16 hex>` (the page's `arena:<id>`). PVP-REF: the relay runs the bout law
(`systems/arenaBout.js`, pure, the clock and the dice handed in) and holds both fighters' health (300 + 2 a level); a blow
claim is held to reach (2.5 m and 3 m of slack, a bow 60 m), the poses' speed, four blows a second, a damage cap off DFU's
own weapon and material tables and a bucket of 40 a second 120 deep; spells three casts in five seconds; the verdict a
signed receipt. A fighter gone from a live fight past 15 s forfeits; a matched bout nobody comes to is void at 45 s. THE
LADDER ON THE RELAY: the fighter's own `in` opens a ladder bout against the relay's fighters (`ARENA_LADDER_SPEC`, the
game's ladder row for row, pinned: Tier 5's champion two Warriors on one side, the beast tier's bodies, Tier 9 two
against one, Tier 10's Grand Melee every fighter a side, then the Iron Atronach), who walk at the fighter, telegraph and
land by the relay's word. THE STANDS: a spectator takes a seat (60 a bout) and sees the whole bout - a body on every
screen in the room, the fighters' and the other spectators', as they are on its own (HOTFIX 1003f; ARENA4 drew the
fighters alone, and every watcher stood in an empty arena).

**The client** (`src/net/arenaLink.js` the hall's fold and the mirror of a relay's bout in the bout law's own shape;
`src/net/arenaClaims.js` the receipts carried - kept a week, offered for the signed-in account alone, retried every five
minutes; `src/scenes/arenaOnline.js` the host's glue; `src/scenes/arenaBouts.js startRelay`/`relayWord` - the relay's
bout stood on the floor's instance as puppets, the Herald and the HUD driven from its events, my health the relay's, my
yield and misses told; `src/systems/arenaBoard.js` the window online - the Bouts page's live bouts with Watch, Find a
match, Leave the queue, Accept/Decline on a 20 s clock, the rating and rank chips, the Rules page's "The realm").

**Verified.** `test/arena4_client.test.js` (8), `test/arena4_relay.test.js` (7) and `test/arena4_service.test.js` (7):
the relay over fake sockets, the service over node:sqlite with every migration, the client headless. Its mutants were
named in its tests but no list was written; ARENA5 wrote `tools/mutants/arena4.json` (the record below).

## ARENA4b record (2026-10-03) - SHIPPED: the online half finished

ARENA5's audit read ARENA4's code against this page and found its online half short in eleven places, and two more
the merge of the streams turned up (the blows' sequence, the banners billed); this slice built every one, in three streams
merged onto the arena branch (the relay, the client, the account service) and the casual bout after them.

**1. The hour's exhibition is the relay's** (section 2: "the relay runs it, every client sees one bout"). The schedule's
law moved out of `systems/arenaLadder.js` into `src/net/arenaExhibition.js` (`exhibitionFor`, `exhibitionOpening`,
`exhibitionAdmits`, `arenaHash`, `hourIndexOf` - re-exported where it stood), so the relay draws the same pair from the
same hour. Its room is `arena:x<hour>` (the game hours since the epoch, `floor(sharedClassicMinutes / 60)`); the Worker
admits an hour from 25 back to one ahead. The first watcher inside its window (08:00-21:00, the first 20 game minutes)
opens it (`openBout({ kind: 'ex' })`); a fighter's `in` never does. Its `st` names the sides Red and Blue, both the
relay's AI; no receipt is owed; it is kept two real hours (a game day) after its verdict, so a late ask hears the result.
On the client (`scenes/arenaOnline.js` `exhibitions`, `watchCity`, `watchExhibition`, `exhibitionVerdict`;
`scenes/arenaBouts.js startExhibitionRelay`/`exhibitionWord`/`cityBodiesFrame`): online with a relay that runs it, the
city floor's bout is the relay's, mirrored on the exterior's own bodies while the player stands within 150 m; the Herald's
Watch and the Bouts page's list take the instance as its room; the bookmaker settles by the relay's verdict
(`arenaGate.js settle`), and by the house's record only for an hour the relay ran no bout in. Offline, on an older relay
and on the `?exterior` host (no online session) the local seeded exhibition runs as before.

**2. The ladder's trust.** A relay ladder bout's vitality no longer trusts the word: a new signed token claim `cl` - the
character's level, a whole number 1..1000 from the realm character's own tile (`server-account/src/realm.js
realmLevelOf`), minted only for the calling account's realm character, validated by `identityToken.js
characterLevelIssuable` - carried by the relay's `_named` and read in place of the word's (`arenaLaw.js ladderVitality`:
25 + 30 a level, 10..2,000); the word's `mh` is ignored and no longer sent. A token from an older service (no `cl`) falls
back to its claimed level. EITHER LEVEL is capped at the tier's top opponent's level plus five (`ladderLevelCap`: 8 at
the Pit to 26 at the Grand Melee) - about two tiers, so an honest over-levelled fighter fights near their level and a
forged level reaches the Pit at the Pit's cap, 265 health, signed or not. The signature says whose the level is, not
that it is true: the tile's `level` is the summary the client writes itself (`/v1/realm/create`'s and every
checkpoint's), never read against the save - this record first said the signed level was read alone and uncapped, and
a token signing a thousand fought the Pit at 2,000 health (AUDIT PRE-MERGE 1003 S2). The relay still does not check a
ladder bout is the account's next - the service's ordered write is the arbiter, as ARENA4 had it.

**3. The players' blows.** Each swing carries one sequence `q` (`dungeonContext.js nextArenaQ`) shared by every body it
meets, each arrow its own, so a cleave is one blow to the rate check; a spell that strikes a player rival goes to the
referee as a spell (`spellOnRival`), and one on a relay fighter is claimed as a spell (it was claimed as a melee hit,
held to sword reach), one number a cast.

**4. The banners billed.** A fighter's queue word and ladder `in` carry the account's banner (`bannerClaim`: anything
but red or blue dropped, never refused); the relay bills it (`_bill`, the live list); the exhibition's sides are Red and
Blue. Cosmetic only - a banner's points come from the service's own `arena_members` rows.

**5. The stands' cheer** (section 4). A watcher of a relay bout has two presses under the plate (`ui/arenaHud.js` -
Cheer and Boo, 36 px, 48 on touch; the `=` and `-` keys, never in a text field, with a modifier or on a held repeat), one
shout every 1.75 s (the relay's 1.5 s and a quarter second); my shout moves my crowd at once and the relay's echo plays
only the others'.

**6. The realm's Hall of Champions** (section 1: "this realm (online)"): the window's Leaderboards page draws the board's
Hall under the fastest Grand Champions (`arenaBoard.js hallBoardOnline`, `arenaWindow.js hallCard`), my own row by the
name the realm uses for me; the Keeper reads the realm's names online (`host.arenaHall`).

**7. The laurel and the banners online.** In a relay bout the laurel is the realm's (+0.25 favour from the first bell to
a fighter in its banner) and the pennants are the relay's bills; local exhibitions online take the realm's laurel
(`arenaBouts.js setRealm`, `relayBanners`).

**8. The Records page online** reads the account (`arenaBoard.js recordsPageOnline` over the board's new `me.record` and
`me.recent` - `server-account/src/arena.js arenaRecordsOf`: the record and the last twenty bouts, the opponent by name
and badge, never an id; an older service's board falls back to the climb); before the board arrives it says the realm's
record is on its way. The header's purses chip shows only a purse.

**9. The gate online.** Joining a banner is the account's law (`arenaGate.js recruiterChoiceOnline`, the save's league
untouched); the Herald's Fight and the window's read the account's climb, and wait for it - no Fight before the board is
in (`arenaOnline.js climb`); a ladder purse is paid only for a win the service kept (`owe`/`answered`/`settleOwed`, a
lost answer settled by the receipt's own result), held at most ten minutes. Fastest-Grand-Champion rows show each row's
own season.

**10. A bout's Renown** (section 2: "Online, renown too, within the renown law's own hourly cap"). `/v1/arena/claim`
credits the fighting character through `reportRenownXp` (its hourly cap) once per account and bout (`arena_renown`): a
ladder win one quest's Renown at its tier's top level, a tier champion two, the Grand Champion three, a rated players' win
one at level 30, each capped at three levels over the character's Renown (measured at Renown 30: the Pit 165, Tier 10
705, the Grand Champion 2,115, a players' win 975); a pledged war-guild takes influence in Daggerfall's region; a rise
answers its signed order, applied by the one plan every Renown answer takes (`renownAnswer`).

**11. The displaced online homes** (the ARENA1 record's "written down, not built"). DECIDED by Mac: the owner's client
picks, and what moves follows the offline law. Migration `0075_arena4b.sql` (`home_moves`, `arena_renown`; 0071 before the second merge onto main, 0073 before the third).
`POST /v1/homes/arena-move { mapId, from, to, character }` (`homes.js arenaMoveHome`): `from` the caller's home (or a
hall they keep) in Daggerfall's cell (4,3), `to` outside it, a valid key and nobody's - the trust `claimHome` has; moved
once (a second post answers the first). The row moves whole in one batch (`HOME_MOVE_CARRIED`, pinned to the table's
columns; a hall's `guild_id` set after the old row goes, so the one-hall index never sees two); a running tenancy is
carried unlisted and anchorless (its tenant still enters and rests - the door and the bed read the tenancy), an offered
room withdrawn, hidden pieces and placed items deleted, the catalogue's and the yard's pieces refunded whole onto the
owner's record in the same batch (a hall's into its treasury). The client (`arenaMove.js arenaHomeFor` - `arenaHouseFor`
filtered by `homeCandidate`; `onlineHomes.js moveArenaHomes`; world.js `moveArenaHomesOnline`) runs once a boot after the
homes' towns land: picks, posts inside a realm act, empties the old scene into the new one (`emptyArenaScene`), the
Daggerfall Bank's letter and the notebook line, and marks the move read only once a checkpoint holds the emptied scene.
`claimHome` and `buyHall` refuse a key in the cell (`home-arena`) - an old build still stands GEMSAL03. The relay needs
nothing: its interior rooms carry no loot and expire.

**12. The casual bout** (section 7: "A casual bout (unranked) may run under DUEL1's defender-resolved law"). Built
refereed rather than defender-resolved - PVP-REF holds both fighters either way, so nothing is gained by trusting the
defender: the hall's queue word carries `u`, `pairQueue` pairs like with like (a casual seeker never with a rated one, at
any rating), the offer, the call, the listing and the bout's `st` say so, and its room owes no receipt (`arenaBrain.js
receiptsOwed`) - no rating, no points, no record. The window's Challenge card has Casual bout beside Find a match; its end
says nothing was counted.

**Verified.** Fourteen suites, 67 tests: `test/arena4b_{exhibition,trust,blows,mirror,banners,casual}.test.js` (the relay's,
29), `test/arena4b_{gate,stands,window}.test.js` (the client's, 14), `test/arena4b_{homes,homeclient,records,renown,token}.test.js`
(the service's, 24); 256 mutants across fourteen `tools/mutants/arena4b_*.json` lists, all dead. The UI probes draw the
stands' presses (`tools/arenaHudProbe.mjs`) and Records and the Hall online (`tools/arenaWindowProbe.mjs`), all ok.

**Not done / open.** Past the relay's 60 seats, a watcher on the city's sand sees no exhibition (it retries every 30 s).
A guild hall's other keepers keep their own items in their own saves' old scene (a hall's sale does the same today). A
re-claimed bout answers no Renown (the level arrives with the next token). Not seen in a browser online - the probes are
headless and the relay is not deployed.

## ARENA5 record (2026-10-03) - SHIPPED: the audit, and what it built

Every slice re-read against this page (sections 1-7 and the four records), the probes run, the mutants written and run.
What the audit found it closed - ARENA4's online gaps in ARENA4b (the record above), the rest here.

**What the page promised and no slice had built:**
- **The banners' colours on the sand** (section 3; the ARENA3 record's "Recorded, not built"). The crowd's half in your
  colour: a per-batch wash the billboard pass now takes (`uBatchTint`, multiplied in after both maps are sampled - the
  classic lane's BB_FS and Enhanced Lighting's EL_BB_FS; white for every other batch, so nothing else changes), the west
  half of the tiers side 0's and the east side 1's (`systems/arenaCrowd.js crowdHalfOf`/`crowdHalves`, `CROWD_WASH` - red
  [1, 0.8, 0.74], blue [0.78, 0.86, 1]), split only when a half has a banner (the save's offline, the realm's online; an
  exhibition red against blue). The hangings: on a bannered side, Kamer's ring banners at least 6 m from the middle line
  take the banner's cloth at his own hang points (`world/arenaFloor.js hangingModel`, `ARENA_BANNER_MODEL` red 42557,
  blue 42558 - the latter World of Daggerfall's "Banner_Blue_Large"; the red is the large banner beside it, UNSEEN), nine a
  side; the bout asked for the floor names its banners (`arenaBouts.js floorBanners`).
- **The Hall of Champions' plaque wall** (section 1). A row of plaques on the wall by the Keeper, found as `crownHallPlan`
  finds its wall (`world/arenaPlaques.js hallPlaquePlan`: the nearest of eight ways to a wall at 1.65 m within 7 m, 1 m
  apart, centred on her, doorways and corners skipped, at most ten, left to right as you face them), two models of
  Daggerfall's own dark frame-back wood (864110 a champion's, carrying one of its framed pictures; 864111 bare), each
  click a `plaque:` target reading its champion (name, banner, season, "Grand Champion") or the Keeper's "No name is cut
  here yet" (`worldModes.js standArenaWall`/`readPlaque`); the save's names offline, the realm's online
  (`arenaBoard.js hallPlaques`, `arenaGate.plaques` - nothing online before the board, never the save's).
- **Your ladder replay** (section 2's table: Spectate offline, "your ladder replay"). The last three ladder bouts kept in
  the save (`systems/arenaReplay.js`, `snap.arena.replays`, versioned; an older save reads back none): 10 Hz, 0.1 m and
  1/256-turn steps as one signed byte a change, health, strikes and the law's events when they happen; at most four
  minutes, four fighters, 64 KB (measured: a 200 s duel moving every tick 20,190 bytes, a capped Grand Melee 47,964).
  Played back through the relay mirror's own door (`askReplay`/`replayFrame` feeding `relayWord`) - the fighters as
  puppets (the player as their career's class enemy), the crowd, the HUD, the music and the verdict from the recording,
  nothing paid or counted, the gates never held. Offered by the Herald ("R - Watch your last bout again") and the Records
  page ("Watch the replay"), at the gate, offline.
- **The casual bout** (section 7: "A casual bout (unranked) may run under DUEL1's defender-resolved law") - built in
  ARENA4b, refereed rather than defender-resolved.

**What the audit corrected:**
- The undercroft no longer shrinks under Smaller Dungeons (`world/smallerDungeons.js useSmallerDungeon` - the ARENA1
  record's open item): the fighters' hall stands by distance over Kamer's 32 blocks.
- `buildCrowd` read the bout's tier before its first await and threw for a relay bout with no ladder step or exhibition
  (a watched or fought players' bout), so those stands stood empty - fixed and pinned.
- At the merge of the streams, the client's `relayBanners` wiped a relay exhibition's Red/Blue sides and its laurel -
  caught by the mirror suite, fixed (`ARENA4b-MIR-EX-SIDES-WIPED`).
- The page's "What the mod is" called DFARENA's 42512-42514 "the seating tiers": they are banners (DFU's tapestry range
  42500-42571; World of Daggerfall's catalogue names 42512 "Flag" and 42514 "Flower Banner Long") - corrected here and in
  `vendor/daggerfall-arena/README.md`. Section 7's "migration 0047+" is 0074 and its `arena:<id>` is `arena:b<id>`.
- `test/arena2_hosts.test.js`'s header still called exterior.js FLAGGED (ARENA-FIX 12 wired it).
- ARENA4 shipped no record, no Ledger row, no Testing.md rows and no mutant list: all written (the records above,
  Port-Ledger's ARENA4 row at the merge and the ARENA4b/ARENA5 row now, `tools/mutants/arena4.json`).

**The wardens** (section 1: "so a brawl at the gate is a crime like any other"): read and pinned, not changed. A crime at
the gate takes the street's own path in both hosts with no arena condition anywhere (the bout driver's crime door,
`setCrimeCommitted(Assault)`, `_crimeResponse`, `_spawnGuards`, `cityGuards.spawnCityGuards` over the walkers' pool);
the wardens are static Royal Guard people, and DFU's SpawnCityGuards converts mobile walkers only, so the watch coming
from their posts would depart from DFU (`test/arena5_wardens.test.js`).

**The mutants.** Every list of the arc, by slice: `arena1.json` 26, `arena2.json` 77, `arena3.json` 62,
`arenafix.json` 43 (as their records say; measured again in a tree without the player's data at AUDIT PRE-MERGE
1003: all 26 of arena1's and 42 of arenafix's die there, and the one survivor, `ARENAFIX-RAMPS-UNREGISTERED`, is killed
only by ARENA-FIX 1's stair survey, gated on ARENA2 - judged dead where the data stands, as its record was),
`arena4.json` 203 (written by this audit - 40 survived its first run, each a gap in the tests, six of them mutants
ARENA4's titles claimed and never killed: a purse on a loss, the decliner kept, a lapse queueing the silent one,
the bucket unspent, a blow out of reach landed, the rating's floor; all closed by assertions in the ARENA4 suites, no
source bug), the fourteen `arena4b_*.json` lists (256, all dead) and `arena5*.json` (67, all dead).

**The probes.** The data-free UI probes run here (Chromium at /opt/pw-browsers): `tools/arenaHudProbe.mjs` 70 checks
(the stands' presses clicked and keyed) and `tools/arenaWindowProbe.mjs` 391 (Records and the Hall online, the replay
press), all ok. The world probes (`tools/arenaProbe.mjs`, `tools/arena3Probe.mjs`) need the player's ARENA2 data, which
this tree does not hold - their last runs are ARENA-FIX's and ARENA3's.

**Look at in the browser** (nothing of ARENA4b/ARENA5 has been seen there):
1. A ladder bout under a banner: your half of the tiers lightly red or blue; the nine ring banners on the west in the
   banner's cloth - that 42557 reads red, that they hang right and do not clip.
2. An exhibition: a red half and a blue half.
3. The undercroft: the row of framed plaques on the wall by the Keeper; a click reads a champion's line.
4. A ladder bout, then the Herald's R or the Records page's press: your own bout from the terrace, the gates open.
5. Online (once the relay and service are deployed): the hour's exhibition the same on two screens; Find a match and a
   casual bout between two accounts; the stands' Cheer; an online home on the arena's block moved at login.

**Not done / open.** The replay stands the player as their career's class enemy, not their own body. Past the relay's
60 seats a watcher on the city's sand sees no exhibition. The wardens' posts are not where the watch comes from (DFU's
own law). Team-vs-team battles, Marks wagers on players' bouts and a mounted joust stay recorded, not built (the page's
own list).

## AUDIT PRE-MERGE 1003 (2026-10-03) - what the audit changed in the arena's law

Mac: *"I want to do a comprehensive audit over it and make sure its perfect"*. Every finding and its fix is
`01-Overview/Audit-PreMerge-1003.md`; what it changed in the arena's own rules, here:

- **The bout's clock is the world's** (B1): a pause, a window or a hidden tab runs no bout's time, stall or yield.
- **The sand is no place to fix a bout** (B2): a blow from the stands on an exhibition's fighter is made good; the
  Herald warns, then the watch.
- **The book** (B3, B4, O3): leave an exhibition after its word and the bookmaker keeps the stake whoever led; no wager
  on an hour seen (offline, the verdict seen here; online, any word of its fight heard); the Herald never stages an hour
  again once its word is given; no price shorter than 1 to 5 - a fighter likelier than that is not laid.
- **The spare** (B5) holds from the word to the healers - a blow in flight after a yield or a fall kills nobody.
- **Online** (S1-S8, O1-O10): a seat is a socket's once; a level, signed or claimed, is held to the tier's cap; a rated
  bout's vitality is the token's Renown level; a kept bout pays only its own receipt (`reused` otherwise); a fighter
  back inside the keep hears the end and the receipt; the healers' heal stands; online is the session's fact, never the
  socket's this frame; the arena's own links are ticked; a tab that lost its seat leaves the arena.
- **The floor's instance stands on the city's paving** (W1, `ARENA_GROUND_MODEL` 864103), walled at the cell's edge and
  the passage's mouth, and **a third way out** stands at that mouth, where the Herald stands in the city.
- **The deploy moved** (M1): the account service is acct72, its migrations `0073_home_layout`, `0074_arena`,
  `0075_arena4b` (main's SILVER-WAYS took acct71 and 0071-0072); the relay stays world155, hashed again in place.

## ARENA6 record (2026-10-03) - SHIPPED: private sessions

The owner: *"I also want to add a way to simply host private matches. In this case, a streamer is hosting a tournement
later today and I want them to be able to open a session where people can join, watch, participate, and allow the host
of the session to choose who is fighting and who is in the crowd."* Decided with the owner: **every fighter of a
session's bout equally whole** (not by level); **registered accounts fight, guests watch**; the host is a registered
account. Online only (a session is the relay's); nothing of the offline game changes. Read again before it merged by
AUDIT PRE-MERGE 1003b (`01-Overview/Audit-PreMerge-1003.md`, its second pass) - what that pass changed is written in
below, each at its place, and listed at the end.

**The room.** `arena:p<code>` (`net/arenaLaw.js` `arenaPrivateRoom`, `ARENA_PRIVATE_ROOM_RE`): six characters of
`ARENA_PRIVATE_CODE_ALPHABET` - letters and the digits 2-9, no I, L, O, 0 or 1, so a code read off a stream is typed
right (`privateCodeTyped` takes it upper-cased, its spaces and dashes gone). A fresh code is drawn on the host's screen
from the CSPRNG (`arenaPrivateCode`, a byte at or past 248 thrown back so no letter is likelier). The room is an arena
floor room (`isArenaFloorRoom`): the screen enters the floor's instance as it does for any bout
(`arenaFloorRoomOf('p<code>')`), its sand holds the two fighters, its stands everyone else - every member a body drawn
to every other, its pose fanned to them (HOTFIX 1003f, live: "people join and are alone" - the stands drew nobody). The
floor is the session's members' (1003b R4): a socket in the room that is no member (a stranger with the code, a member
removed) is drawn to nobody and drawn nobody, hears no pose and its own reaches nobody, is welcomed to a roster of
nobody, and neither speaks to the session's room chat nor overhears it; a socket made a member is shown every member
here then and shown to each (`_sessionShow`); a member gone, removed or the session ended is said gone to the others
(`_sessionUnshow` at the end), and a fighter back in the stands when its bout clears stays drawn. Its door
(1003b R2): a floor room's hello gate is spent after the token, by account - a member or a fighter waits on itself
alone, anyone else on the stands' bucket - so tokenless hellos never shut it. A socket replaced by its own reconnect
keeps the seat or the place on the sand it held (1003b R5).

**The session** (`net/arenaBrain.js` `openSession` / `sessionJoin` / `sessionPick` / `sessionGoFighters` / `sessionKick`
/ `sessionWord`; `server/src/index.js` `_sessionWord` and its helpers; kept in the room's storage, `arenasession`):
- `ps open` - the first registered account's opens it and hosts it (a guest's: `host guest`; another's on an open
  session: `taken`). `ps join` - a member back, or a newcomer while it has room and is not locked; a removed account is
  refused for the session's life (`removed`). At most `ARENA_PRIVATE_MEMBERS_MAX` members (the stands' 60 and the two on
  the sand); a newcomer to a full one takes the place of the member longest gone, never of one here (`session full`
  otherwise). A member's repeated join changes nothing and is answered to it alone - no write, no fan - and a member's
  changing joins are taken `ARENA_PRIVATE_JOIN_HZ` (1) a second, two at once (1003b R1).
- The host's alone (`host only` to a member, `removed` to one the host removed, `not member` to anyone else): `pick` the
  Red and/or the Blue (member ids; a guest cannot be picked - `guest fighter` - nor one member on both sides, nor a
  member not here; never while a bout stands - `bout on`), `go` (both picked and here), `void` (the bout ends with no
  result, nothing kept - only while it has no result; after it, `has result`), `kick` (the member told `removed`, its
  body said gone to every screen, taken off the sand or out of the stands, refused again; a fighter's bout void while it
  has no result), `lock` (1003b S4: no newcomer while locked - `locked` - a member coming back always let in; a removal
  is the account's, and a guest account is a press away, so the lock is what keeps a removed guest out), `close`.
- Every change is every member's `pss` word - the code, the host's name, the members as `m1`, `m2` ... (never an
  account's id) with their name, guest, here, title and banner, the picks, the bout standing and its phase, the last
  `ARENA_PRIVATE_HIST_MAX` (20) results, and `lo` the lock.
- **The bout** the host calls is the casual players' bout (ARENA4b), refereed by PVP-REF as every relay bout is - no
  receipt, no rating, nothing kept by the realm, never on the hall's list (`priv`) - with every fighter
  `ARENA_PRIVATE_VITALITY` (360, a rated bout's level-30 vitality - the middle of the 302-420 a rated bout spans) whole
  whatever their levels (`openBout`'s `equal`). Its result enters the session's results the moment it is in; the bout is
  kept `ARENA_PRIVATE_KEEP_MS` (5 s) past the healers (`doneAt`, 1003b R7), then cleared: the fighters back to the
  stands, the session back to choosing. Both fighters of a players' bout gone `ARENA_GONE_MS` together is no contest -
  void, `no contest`, nothing kept (1003b S9; a ladder's one player gone is still its forfeit).
- **Its ends**: the host's `close` (`closed`); its host gone `ARENA_PRIVATE_HOST_GONE_MS` (15 min - a blink or a walk to
  the gate keeps it) or its life out, `ARENA_PRIVATE_LIFE_MS` (8 h) (`ended`; `privateSessionOver`, armed on the room's
  alarm). Every member's screen leaves the floor's instance on the word.

**The client** (`scenes/arenaOnline.js` `enterSession` / `sessionTick` / `sessionState` / `sessionAct`;
`systems/arenaBoard.js sessionCard`; `ui/arenaWindow.js`; `scenes/arenaGate.js` routes the `priv*` presses). The Arena
window's Bouts tab carries a **Private session** card - first on the page while in one (1003b U6), spanning it (U1):
out of one, *Host a session* (a registered account's) and a labelled code box with *Join* (and *Rejoin session <code>*
for a session this screen stepped out of - C8 - with the last word the session said, a wrong code's included - U3/U8);
in one, its code spelled large (and letter by letter for a screen reader, in a span it reads - U10) to read out, the
members with each one's role in words (You, Host, Red, Blue, Guest, Away) and their own banner's pennant and, to the
host, *Make Red* / *Make Blue* / *Remove* on every row, each that cannot be pressed now saying why and keeping the
keyboard's focus (`aria-disabled`, a `data-focus` key a press - U4), and *Start bout* / *End bout (no result)* / *Lock
session* / *Close session*; a member's *Leave session*; the session's last word (a refusal the relay sent - U3); the
recent results in words, a draw a draw (U9/S7). A fighter called (the host's Start bout) is taken out of the window
(C5) and stood on the made level's own arrival mark for the side (`worldModes.js standOnArenaMark` - Red the ladder's,
Blue the rival's), and back to the stands when the bout clears - or is void for an opponent who never came (C1) - healed
by the healers' heal whenever the bout is let go before them (a void, a removal, a close, the seat lost - C2); the relay
mirror (ARENA4b's) draws the bout under the session's own Red and Blue, never a realm banner or laurel over a side (C4),
and the Herald calls it a friendly bout, nothing counted (S6). A screen standing in a session's room with no session
on it (its seat taken back after another tab's, a slow floor) adopts the session (C3). A refusal that ends it here
(`closed`, `ended`, `removed`, `no session`, `taken`, `host guest`, `session full`, `locked` - C6) takes the screen out
of the floor. In a session the queue and the casual challenge wait (`You are in a private session`); queued, Host and
Join wait for the queue (U7); the pause menu's Arena opens on the session. Host and Join are pressed outdoors (the
floor's door is the exterior's); pressed indoors, the press says so (`privOutdoors`) and nothing is held. They want an
account held and the socket open (HOTFIX 1003f: `privSignIn` otherwise - a tokenless hello is refused at the relay's
door, ACC1g, and the floor stood empty around a player who was not online). The floor's
way out lands before the Herald, or - the Herald not streamed in, a session joined away from Daggerfall - back where the
floor was entered (`arenaFrom`, C7). The relay's version: world155 (one deploy with the rest of the arc); HOTFIX 1003f's stands, world156.

**The four hosts.** `scenes/world.js` WIRED (the online half handed the instance's mark, its way out and the healers'
heal - `standOnMark` / `leaveFloor` / `heal`; the pause window's Arena door and the modes' `makeArenaWindow` /
`arenaJoined` open on the session's page). `scenes/worldModes.js` WIRED (`standOnArenaMark`, `leaveArenaFloor`, the
floor's `arenaFrom`; the floor's instance is its dungeon arm). `scenes/dungeonContext.js` needs nothing (the instance's
pause door is `opts.makeArenaWindow`, world.js's, through worldModes.js). `scenes/exterior.js` FLAGGED: it mounts no
arena online (its arena gate has no `online`), so it draws no session card; private sessions are ?world's alone, as the
rest of the arena online is.

**Tests.** `test/arena6_private.test.js` (10): the relay over fake sockets and fake objects - the door and the code,
the session opened, the host's words and their refusals, the bout with equal health refereed and kept, void, kick, the
host's absence and the session's ends, the seats, the wire both ways (the lock and its words); the client end to end on
the real Room (two screens: host, join by code, pick, go, both screens' bout, the host's void sending both fighters back
to the stands, Close taking both screens out of the instance); the client's refusals and the card; the hosts' seams.
AUDIT PRE-MERGE 1003b's: `test/audit1003b_relay.test.js` (11), `test/audit1003b_client.test.js` (10 - fourteen as run, C2 four ways),
`test/audit1003b_ui.test.js` (5 - the window mounted). Mutants: `tools/mutants/arena6.json`, `tools/mutants/audit1003b.json`
(the counts in Testing.md's rows). HOTFIX 1003f's: `test/hotfix1003_stands.test.js` (3), `tools/mutants/hotfix1003f.json`
(10), and the records whose laws it turned re-aimed by content (arena4.json, arena4b_exhibition.json, audit1003b.json).

**Not done / open.** A session's bout is one against one (the tournament's own format - brackets, rounds - is the
host's to run by hand). No spectating a session from outside it: the code is the door. The session lives in its room's
storage, so a deploy of the relay mid-session ends nothing but reconnects every member (one reconnect). A blow's damage
is still the fighter's own claim, capped by the weapon and material it claims (PVP-REF's law, ARENA4): the health is
equal, a modified client can always strike at the cap. Seats are a socket's: one account's two tabs in the stands take
two (ONE-SEAT keeps two tabs online apart). Tab still closes the window (PX28b's house rule - the owner's call).

## ARENA-COPY record (2026-10-03) - the plain-words pass

The owner: "Do a comprehensive pass on any overexplained text and button text. Ensure simplicity and easy
understanding. Don't let it seem like AI." Words only - no key, signature, template parameter or behaviour changed.

**What was said again.** `src/systems/arenaText.js` (ARENA_TEXT: the Herald's, recruiters' and bookmaker's choices and
lines, the refusals, the notices, the window's pages and presses, the online cards and the private session's lines, the
Rules). The house
rules for them: a press is one to three words, a verb first where it acts ("Host", "Join", "Leave", "Find match",
"Place bet", "Cancel bout", "Replay"); a line is one short sentence, with no clause hung on " - ", no semicolon, no
hedge and no word about the machinery ("relay", "socket", "the realm keeps..."); a refusal still says what is wrong.
The crowd's barks, the Herald's calls on the sand, the verdicts, the tiers, titles and epithets kept their voice. The
bookmaker's "wager" is a "bet" on every press and line. `ui/arenaWindow.js`, `ui/arenaHud.js`,
`ui/arenaSessionButton.js` and `systems/arenaBoard.js` draw these words and needed none of their own changed.

**Tests.** The suites that pinned a line by its words now pin the new words (`arena2_hud`, `arena3_book`,
`arena3_window`, `arena5_plaques`, `arena_fix`, `audit1003b_client`); no test added or removed. Mutant records whose
text moved re-aimed by content (`audit1003_ui.json` AUDIT-1003-U10-lapsed-unsaid, `audit1003b.json`
AUDIT1003b-U9-DRAW-NO-RESULT; both dead).

## FIELD BUGS 2026-10-04e - the first tournament's report

Draugr, after the first tournament: arrows spent on the sand were never handed back (ARENA-ARROWS - the quiver is counted
as a bout begins and what the bout loosed is handed back with the healers, `systems/arenaQuiver.js`, `systems/
shotTally.js` - never an arrow dropped there); the Curse of Daggerfall's ghosts came for fighters at the gate
(CURSE-OFF-SAND - its waves are kept off the grounds and the arena's two levels at CreateFoe's spawn event, so a rest
there is never broken, `systems/arenaGround.js`); a two-against-one's pair seemed to fight each other (ARENA-TEAMS - an area spell's blast passes
a bout teammate by, and a Grand Melee's HUD says "each alone"); the undercroft held no enemies (UNDERCROFT-DEEP, above).
The record: `01-Overview/Field-Bugs-2026-10-04e.md`.

## AUDIT ARENA-LADDER (2026-10-05) - fighters telegraph at each other; the climb costs; the bout's holes closed

The owner, before the merge: "Ensure AI enemies sometimes recieve telegraphed attacks, ensure climbing the PvE ladder
isnt an easy feat, and look at where we can make improvements"; asked, "Lose the tier's run", "No cheese spells or
potions", "Elite champions", "Relay and service". Four read-only lenses (the telegraphs, the climb, the bout's
correctness, the online trust), every finding reproduced and fixed here:

- **Telegraphs between fighters.** On the sand a token holder of TACT4's tier winds up at its BOUT-MATE (a fighter of
  the same live bout on another side, `ai/tactics.js` `blowAim`), the verdict where that fighter stands, the foe-vs-foe
  hit paths asking `blowConnects`/`blowScaled`; drawn for the stands to 100 m. A dodged telegraph is a miss for the
  judges (`registerBlowDodgedListener`). The relay's ladder fighters throw the same shapes (`net/arenaBrain.js`, the
  families moved to the leaf `ai/blowShapes.js`), the `atk` word carrying the shape, its facing and its origin.
- **The climb.** A loss breaks the tier's run (`systems/arenaLadder.js` `ladderAfter`, said); every tier's champion an
  elite (offline and on the relay); the sand's kit law (`systems/arenaKit.js`: no potion, no Invisibility, Levitate,
  Chameleon, Shadow, Charm or Teleport, those already on the fighter stripped, a ceiling 4 m over the sand); on the
  relay the fighters run (5.0 / 6.0 m/s), a time-out is the fighter's card unless the player took half its whole
  health (`LADDER_JUDGES_SHARE`), and a ladder bout opens only for the account service's attempt ticket - an attempt
  never claimed is a loss (migration 0082, `arena_attempts`, `arena_pve.voided`).
- **The bout's holes.** The sand's collapse is a fall, never a death; a dispel or a Wabbajack takes no fighter, and a
  body gone without falling voids the bout; the player's tag is held live (out of a Grand Melee, out of its fight);
  my damage is the striker's the formula named; bodies come off the stage they stood on; no Recall off the sand.
- **The laurel.** Ten rated bouts against five accounts, a pair's rated bouts ten a season.
- **AUDIT ARENA-LADDER 2 (2026-10-05, the owner: "Audit this").** The audit of the audit, four lenses again: a ticket
  is one bout (asked for its room, refused past `ARENA_ATTEMPT_LIFE_S`, migration 0082's `room`); a run broken under a
  beaten champion no more (it had bricked the climb); the ticket asked once the floor is entered, the receipts carried
  first (`flush`'s `idle`, a kept ladder receipt holding the ask); the service's `order` reaching the client; A STEP
  WON AGAIN PAYS NOTHING (no purse, no banner points, no Renown - the ladder's `paid`); the ladder online for a
  registered account alone; Calm barred and every fighter `pacifyImmune`; no fighter a revenant; a gone body after my
  yield the loss it was; a held ring's effect restored after the strip; the kit law the ladder's alone; a collapse in
  the call a breath; a landed verdict its mark's (`_blowFor`); on the relay one wind-up at a time, the mark landing
  on the relay's clock, a tie a draw, a champion stood elite, an old client's ladder `in` answered `no bout`.

Deploy order: the account service (acct82, migration 0082) BEFORE the relay (world169), BEFORE the site. The record:
`01-Overview/Audit-Arena-Ladder.md`.
