# DELVE II - the dungeon's encounters: wave rooms, puzzle rooms and curated blocks

2026-10-28, the owner: "So one thing I want to work on that's been far too pushed off is improving the overall dungeon
experience. Implementing new curated blocks, implementing some new functionalities like coming upon a wave based
encounter, or puzzle solving like you find in some of our world events (not the clock puzzle) and really breathing life
into an overall system we havent really dived into." Then: "I want to go all out, be extremely detailed, not break
anything and really kill this."

The first Delve arc (`Delve-Arc.md`, 2026-10-05) answered "removing esoteric nature of dungeons", "(no logical
interaction moments)" and "way to detect interactables" with legibility: the look round, the chain's echo, the way out.
DELVE II answers the second point with things to do: rooms a party comes upon and fights through or works out, each
opening a vault. Status: DLV0, the design, recorded here. Nothing below is built yet.

## 1. The owner's four decisions (2026-10-28)

Asked as four questions, each with a recommendation. Every answer took the recommendation.

| Question | Answer |
|---|---|
| Where should wave fights and puzzle rooms appear first? | "Every dungeon (Recommended)": a few sites in large rooms the layout already has, in all of Daggerfall's dungeons, identical on every machine, no layout changed |
| Curated (hand-made) blocks: how far? | "Game-made dungeons only (Recommended)": spawned, Elite and lair dungeons, which the game lays out itself; Daggerfall's own dungeons keep their layouts |
| Online: who runs an encounter, and how is griefing stopped? | "Server tracks, party owns (Recommended)": the relay keeps each encounter's progress and says who earned its vault; only the party that started a puzzle can work it |
| What should finishing an encounter give? | "Vault chest (Recommended)": a guaranteed chest rolled on the dungeon's own loot at its tier. Looks, titles, questline progress and shortcuts were offered and not chosen |

## 2. What already stands (read 2026-10-28)

Read cold in three lanes before anything was designed: the dungeon system, the events' puzzles and waves, and the
bible's record of dungeons. What DELVE II stands on:

- **The layout and its markers.** `world/dungeon/dungeonLayout.js` `layoutDungeon` (DaggerfallDungeon) lays
  Daggerfall's blocks; `world/rdbLayout.js` `layoutRdbBlock` (RDBLayout) gives each block's models, doors, flats and
  editor markers. Quests, treasure and foes hang off those markers.
- **The precedent for a site.** `world/dungeon/dungeonFires.js` `dungeonFirePlan` (REST3) places campfires in rooms
  the layout already has: a pure law over the layout, the collider's answers handed in, the same on every client. Its
  rules - squared distances, literal ray bearings, a seeded tie - are the site law's too.
- **The vault's roll.** `scenes/dungeonContext.js` `rollPileItems` rolls a random treasure pile: the dungeon's own
  tables at its type and tier, the Elite and Abyss odds, LOOT-GATE's rarity, and PARTY-LOOT's shared base online.
- **The spawn doors.** `buildDungeonContext`'s `spawnLooseFoe` stands a foe beside the layout's, on a spawn grant
  online (GRANT4), riding the room's own lane (OWN1) to everyone in it.

The events' reusable laws, each read whole:

- **Runes in order:** the Spellmaster's Examination (`net/eliteGates/egLords.js` `examination`, `errandTick`,
  `EG_RUNE_STAND_M`), with THE ERRAND FLOOR (`net/eliteGates/egShape.js` `egErrandMs`).
- **Carry and bank:** the Sky-Ketch's Starved Engine (`net/ketch/ketchBrain.js` `voyageWord` pick/bank/drop,
  `dropCell`, `ktLeastMs`, `KT_CARRY_PACE`), its carrier slowed by `player/motor.js` `registerFootSpeedMod`.
- **Plates held together:** the Rampart's winch and gauntlet plates (`net/eliteGates/egBrain.js` `trial`).
- **Break them all in time:** Dagon's Reckoning crystals (`net/gate/gateBrain.js` `growCrystals`).
- **A wave a client stands, a ledger the relay keeps:** the Starfall (`net/starfall/starfallLaw.js` `newStarLedger`,
  `stepStar`, `foldStarWord`, `starEarned`; the relay's `_starFrame`).
- **A party's own:** SD-PARTY's door (`server/src/sdCopy.js` `sdCopyRight`, the relay's `_instanceKinOf`).

Excluded by the owner's word: the Orrery of Endings (`net/superDungeon/sdBrain.js`) and the Athenaeum, "the clock
puzzle".

## 3. The laws

1. **THE LAYOUT STAYS.** In Daggerfall's own dungeons an encounter stands in a room the layout already has. No block is
   added, moved or removed, so every quest marker, treasure pile and foe stands where it did, and a dungeon's online
   room keeps its key. Curated blocks stand only in game-made dungeons (section 8).
2. **NEVER IN THE WAY.** No site stands on a marker, a door or the way in. A puzzle guards a vault, never a passage. A
   wave's ward holds its foes in, never a player: a player may always walk out, and the room is never sealed.
3. **ONE TO EIGHT.** Every encounter is won by one character of the floor build (law 7) and scales to a party of
   eight: wave sizes, a puzzle's pieces and a timed window all read the party standing at the start.
4. **THE SAME ON EVERY CLIENT.** Sites are a pure function of the layout, the collider's answers and the dungeon's
   seed, under `dungeonFires.js`'s determinism rules. Nothing about where a site stands rides the wire.
5. **THE PARTY OWNS, THE RELAY COUNTS.** Online, the relay keeps each started encounter's ledger in the dungeon's room.
   The first word starts it for the speaker's party; only that party may work its puzzle; its vault is that party's.
6. **ONE CHEST, SIDEWAYS.** The reward is a vault chest rolled by the dungeon's own pile law (`rollPileItems`). No new
   odds, no new numbers: POWER-CEILING holds and LOOT-GATE applies as to any dungeon chest.
7. **NOTHING FASTER, NOTHING UNFAIR.** A timed window is never under its route walked at THE DELVE PACE (the motor's
   `runSpeed(30, 5)`, a weak character's run) plus 1.5 s: THE ERRAND FLOOR, at a slower build than the Spire's.
8. **ONCE A RESPAWN.** A won site stays won until its dungeon's respawn (`systems/dungeon/dungeonRespawn.js`: 20
   minutes, an Elite 40), and comes back with the dungeon's foes and piles.
9. **SAID PLAINLY.** Each encounter names itself in a few words when it is near (PLAIN-TEXT), lights in the look round
   (SENSE1), and routes every string through the text layer (L10N4).
10. **THE HOSTS DO NOT GROW.** All of it lives in modules `buildDungeonContext` wires in a few logical lines; where it
    needs room, something moves out in the same change (HOST-SPLIT). On the relay, a Room method of its own.

## 4. The site law (DLV1, `world/dungeon/delveSites.js`)

A site is a disc of floor in a room: a wave's arena or a puzzle's floor, its pieces stood on it by the kind's own
spots. The law is `dungeonFirePlan`'s shape, its rules widened to a room's size. Every value below was measured by the
census (DLV1, `tools/delveSiteProbe.mjs`) before it was kept.

| Rule | Value | Why |
|---|---|---|
| Candidates | a 4 m grid over every non-border block, centred, at each storey its markers stand on (heights 6 m apart) | the markers and block centres the fire law asks found a room in one dungeon of three; the grid finds the rooms between them |
| Floor | a face that looks up within 4 m below, level to 0.25 m on rings at 1.5, 3 and 4 m (the outer ring asked first) | a room's floor, never a stair, a ramp or a tabletop |
| The disc | radius 4 m; the eight chest-height rays clear past it; a ceiling within 12 m; walls on at least four rays within 30 m; the body fits | room to fight or work, inside a room, never on its roof or in an open hall |
| Clear of | doors 4.5 m; an enemy marker's own spot 2 m; start, treasure and quest markers 4 m (both on their storey); the way in 20 m; every fire 12 m; water by 0.5 m | law 2. The halls the foes stand in are the rooms a site wants, so a foe's marker refuses only its own spot |
| The small room | where the large rooms leave the count short: a 3 m disc on a 2 m grid, rings at 1.5 and 3 m, doors 3.5 m, items 3 m, the way in 12 m, fires 8 m, 60 m from the sites already stood | a small dungeon's rooms |
| How many | non-border blocks / 2, at least 1, at most 3 | 4,221 of the 4,232 dungeons have one to four inner blocks: a four-block dungeon stands a wave and a puzzle |
| None in | a palace (`isPalaceLayout`), Privateer's Hold, the made levels (court, Hour, Spire, Ketch, arenas), the Abyss Hollow | a court is no dungeon; the Hold is the tutorial; the made levels have their own law |
| Choice | the deepest first (height counted twice), then farthest-point 60 m apart, a storey with none first, ties by `hash32(seed, i)` | spread through the dungeon, the same everywhere |
| Kind | seeded by the dungeon's id and the site's index; the second site takes the family the first did not | variety in one dungeon, the same for every visitor |
| Vault | a Hold's toward the nearest wall of the four axis bearings, the disc's radius less 0.6 m out; a Litany's at its heart | a Hold's gates stand on the diagonals and a Litany's plates on the axes: the chest stands on neither |

**THE CENSUS** (2026-10-28, all 4,232 dungeons, four shards of about 40 s). 4,228 want sites; the three palaces and
Privateer's Hold want none. 3,838 (90.8%) stand at least one, and 1,382 stand two or three, each with a wave and a
puzzle. 390 stand none: their rooms are corridors and stairs. Of 5,698 sites wanted, 5,226 stand, 1,194 of them in a
small room; 2,645 are Holds and 2,581 Litanies. A refused spot's first broken rule is most often no floor (a grid point
in rock or void), then a floor not level, then a door. One site for five blocks stood one in every dungeon, and the
large rooms alone a site in 73 dungeons of a hundred: the count and the small room are the census's.

**THE COST.** The plan runs once, in the dungeon's load beside the fire plan: 6 ms at the median, 42 ms at the 95th
percentile, 76 ms at worst (Node, one core, the probe's own clock).

## 5. The kinds

Each kind's numbers are starting values, held in `net/delve/delveLaw.js`, measured in the game before they ship. `n` is
the party standing at the start (1 to 8); a foe is drawn from the dungeon's own encounter table at the dungeon's own
level and tier, so a cave's waves are a cave's and an Elite's are an Elite's (BAL3: the place sets the threat).

### 5.1 Waves

- **THE HOLD.** Survive three waves inside the ward. A wave is `3 + 2(n - 1) + (w - 1)` foes, at most 12 (one grant,
  section 7). The ward rises for 4 s before the first. A five-second breath between waves (STAR-TUNE's lesson: "The
  time between waves is too long"). A wave that runs 90 s gives way to the next. The last is a captain: an elite of
  the table with one boss trait, two in an Elite or Abyss dungeon (BOSS-TRAITS), its fall believed no sooner than 20 s.
- **THE WELLSPRINGS.** Two to four sources - a cracked tomb, a pool, a broken altar, by the dungeon's type - each
  pouring a foe every 12 s, three of its own alive at most. Break every source, then the captain. A source's health is
  sized to the party (the Spire's `egHpTeam` rule, `net/eliteGates/egBodies.js`).
- **THE VIGIL.** A relic at the disc's heart with 100 light; foes go for it before the party (`huntsStar`'s rule).
  Three waves as the Hold's; the light lost, the vigil fails and can be tried again after the respawn breath (60 s).

A wave's foes are held to the ward (the disc and 2 m round it, 3 m up or down): they never chase a player through the
dungeon, and a player who leaves the ward leaves the fight. The encounter clock runs only while a member was in the
ward within 15 s. Every member out of the ward for 30 s ends the attempt: its foes crumble, nothing is earned, the
site can be tried again.

### 5.2 Puzzles

- **THE LITANY** (runes in order - the Examination's law). Four plates 2.5 m round the disc's heart, five in an
  Elite or Abyss dungeon. They light one at a time, a second each, with a numeral and a chime, then go dark. Step on
  each in that order (within 1.2 m). A lit plate may be stood on again; a wrong one darkens all and the order plays
  again. Untimed; in an Elite or Abyss dungeon a wrong plate also wakes two foes of the table. A party silent at the
  site for 60 s lets it go.
- **THE BRAZIER RITE** (carry and bank - the Ketch's law). A source flame at the heart and three braziers at the rim,
  four for a party of four or more. Take the flame, carry it slowed (THE BURDEN, 0.72) with the weapon put up, and
  light a brazier. A carried flame gutters out after 20 s; a carrier struck drops it, and it lies 10 s to be taken up.
  Lit braziers stay lit. Foes of the table drift in while it is worked, two at a time at most.
- **THE WEIGHING** (plates held together - the winch's law). Three plates, each held by a member standing on it or by
  a stone weight carried from the room's edge (THE BURDEN again). All three held for 3 s opens the vault. One player
  carries two weights and stands on the third.
- **THE SEALS** (break them all in time - the crystals' law). Three to six seals (`2 + ceil(n / 2)`) rise round the
  disc; break all within the window, never under law 7's floor of the route between them. Failed, they sink and rise
  again 10 s later.

No puzzle hurts a player for a wrong answer, and none is the clock: no dial, no hidden coupling, no riddle text.

## 6. The vault

- A chest stands sealed from the moment the site is seen (Daggerfall's own, model 41811, the Crown Hall's): at a Hold's
  wall, at a Litany's heart. The encounter won, it opens.
- Its roll is `rollPileItems`: the dungeon's tables at its type, its Elite or Abyss odds, LOOT-GATE's rarity, the
  online party's shared base (PARTY-LOOT). Offline, the player's own roll. It is never empty: a roll with no item is
  rolled again, once, and then holds the pile's gold.
- One vault a site a respawn (law 8). Online, each earner opens its own share once.
- POWER-CEILING (`05-Combat/Power-Ceiling.md`): nothing here is a new line, rung or band.
  The vault's roll is the pile's own, which `test/combat/powerceiling_walk.test.js` walks. Patch notes, release notes
  and Discord posts say only that a vault holds the dungeon's own treasure (LOOT-GATE).

## 7. Online (DLV3)

The relay reads no game data (Port-Doctrine), so it cannot place a site. Every client can, and law 4 makes them agree.

- **THE PLAN.** Each client sends the hash of its site plan with every word. The relay keeps the first plan heard in
  the room - the sites' centres and their pieces' spots, a few hundred bytes - and refuses words under another hash. A
  client whose plan differs gets no encounter and says so (LAYOUT_MISMATCH's rule for foes).
- **THE LEDGER.** One for each started site, in the dungeon room's storage beside its world memory: the owner account,
  the phase, the wave and its deaths, the pieces' state, the earners. Starfall's machine: an encounter clock that runs
  only while the owning party stands at the site, floors on every clear, a word heard late moved as if on time.
- **THE PARTY.** The first word's speaker owns the site. A word from another account counts only if the hub says it is
  of the owner's party (`_instanceKinOf`, SD-PARTY's door). A wave's attempt that fails (section 5.1) or a puzzle let
  go (section 5.2) drops the ledger, and the site is free.
- **REACH.** A puzzle's step, carry or break is judged against the plan's spots and the speaker's last pose the room
  heard, with `ktLeastMs`'s step law at THE DELVE PACE.
- **THE WAVES.** A machine of the owning party stands the foes (Starfall's camp law) under a grant kind of its own,
  `delve`, sized to the law (12 a grant). It says the deaths of each wave; the relay bounds a clear by
  `starClearFloorMs` and a captain's fall by a least time.
- **THE VAULT.** Won, the ledger names its earners: the owning party's members who stood at the site in its last 15 s.
  Each opens its own share; the room remembers who has, until the respawn.
- **INSTANCES.** An instanced dungeon (`Instances.md`) is a room like any other: the ledger lives in it.
- A relay version (`world###`) and a client gate (`DELVE_RELAY_MIN`); an older relay stands no site online.

Strangers in the room may fight a wave's foes (they are hostile to all) and earn nothing; they may not work another
party's puzzle. Offline the same law runs in the client, its ledger saved with the dungeon.

## 8. Curated blocks (DLV5 and DLV6)

- **WHERE.** Only in dungeons the game lays out itself: spawned (`world/spawnedDungeons.js`), Elite and the lairs past
  the Bay (`world/tamrielDungeons.js`). Never in Daggerfall's 4,232, never in the Abyss Hollow (its own law).
- **WHAT.** A curated block is an RDB block in DFU's World Data JSON (`formats/worldData/worldDataReplacement.js`
  `rdbBlockFromJson`), registered at a reserved index range (`registerPortBlockFamily`, as the capitals and town walls
  are). It names Daggerfall's models and flats by id, rebuilt from the player's own files, so no game data enters the
  repository (WD1's rule). It carries every editor marker a block needs (start, foes, treasure, quest) and a side table
  of its encounter anchors, so its encounters are designed, not found.
- **HOW IN.** A game-made dungeon's plan takes curated blocks by a seeded law over its type's own pool, never the
  starting block. Its room key is already its own, so no Daggerfall dungeon's online room moves.
- **THE TOOL.** A lab page (`delve.html`, as `spire.html` and `abyss.html` are) to lay a block out of Daggerfall's
  models, set its markers and anchors, walk it, and export its JSON. There is no block editor in the tree today.
- **THE LOOK.** Daggerfall's own models and flats, and code-painted pieces under DF-LOOK (`01-Overview/DF-Art.md`):
  no render of game data ships (Port-Doctrine).

## 9. The slices

| Slice | What | Done when |
|---|---|---|
| DLV0 | This record | merged |
| DLV1 | The law: `net/delve/delveLaw.js` (kinds, numbers, the ledger machine, its words, earned) and `world/dungeon/delveSites.js` (the site law); the census probe | DONE 2026-10-28: `test/net/delve/dlv1_law.test.js` and `test/world/dlv1_sites.test.js`, 98 mutants dead (`tools/mutants/dlv1.json`); the census in section 4 |
| DLV2 | Offline in the game: `scenes/delve/delveHost.js` wired by `buildDungeonContext`; the Hold and the Litany; the vault; the HUD's words; the Features row `dungeon-encounters`; the Ledger A row | stood and won in the real game at three sizes and an Elite; save, load and respawn; frame cost measured (section 12) |
| DLV3 | Online: the relay's ledger, the party's door, the plan's hash, the `delve` grant kind | a party of two wins both kinds; a stranger refused; a relay version |
| DLV4 | The Wellsprings, the Vigil, the Brazier Rite, the Weighing, the Seals; AUDIT DELVE II | every kind stood, won and failed, solo and in a party |
| DLV5 | Curated blocks: the format, the registry, the splice law, the lab page | a curated block stood in a spawned dungeon, its encounter designed |
| DLV6 | The first curated blocks, their set pieces; AUDIT DLV5-6 | as the owner plays them |

Each slice: pins that fail under a mutation of what they pin, its mutants recorded, the bible gates, a probe in the
real game over the freeware's data, and a frame-cost measure (`npm run perf`) before it merges.

## 10. The four hosts

- `scenes/dungeonContext.js`: WIRED at DLV2 - the one host that stands a dungeon. 21 logical lines (8,436 to 8,457,
  under its 8,463 ceiling): the build after its api, the frame and the marks in drawFoes, the vault's arm in takeLoot,
  the save's word and its restore, the destroy, and the probes' door. The rest is `scenes/delve/`.
- `scenes/world.js`: WIRED at DLV3 - the online link (the ledger's frames), through a module it constructs.
- `scenes/worldModes.js`: WIRED at DLV2 - `delve:` joins its press arm's prefixes (no logical line); the rest is the
  context's.
- `scenes/exterior.js`: FLAGGED - the fixed city stands no dungeon.
- The dev bench `scenes/dungeon.js` (`?dungeon=`) stands the sites: `delve:` in its press arm and `window.__delve`, the
  probe's door (`tools/delveProbe.mjs`).

## 11. Open for the owner

Each has a default the slices follow until the owner says otherwise.

- **Strangers and waves.** Default: a stranger may fight a wave's foes and earns nothing.
- **Which dungeons.** Default: every dungeon but palaces, Privateer's Hold, the made levels and the Abyss Hollow. The 14
  main-story dungeons included: no site stands on a marker.
- **How many.** Default: one site for two blocks, one to three (the census moved it from five).
- **The switch.** Default: an Enhanced Features row, on. Offline it is the player's; online the room's sites stand for
  everyone in it, whatever the row says, as a shared dungeon's foes do.

Not a DFU member: DFU's dungeons hold no encounter rooms. Ledger A row DELVE II, written when DLV2 stands the first site.
