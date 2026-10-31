# DELVE II - the dungeon's encounters: wave rooms, puzzle rooms and curated blocks

2026-10-28, the owner: "So one thing I want to work on that's been far too pushed off is improving the overall dungeon
experience. Implementing new curated blocks, implementing some new functionalities like coming upon a wave based
encounter, or puzzle solving like you find in some of our world events (not the clock puzzle) and really breathing life
into an overall system we havent really dived into." Then: "I want to go all out, be extremely detailed, not break
anything and really kill this."

The first Delve arc (`Delve-Arc.md`, 2026-10-05) answered "removing esoteric nature of dungeons", "(no logical
interaction moments)" and "way to detect interactables" with legibility: the look round, the chain's echo, the way out.
DELVE II answers the second point with things to do: rooms a party comes upon and fights through or works out, each
opening a vault. Status: DLV0 to DLV2 built (the law, the sites and the game offline - sections 4 and 12) and audited
(AUDIT DELVE II, `01-Overview/audits/Audit-Delve-II.md`); DLV3 to DLV6 to come.

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
2. **NEVER IN THE WAY.** No site stands on a door, a mover, the way in, or a start, treasure or quest marker, and a
   foe's marker never at its heart. A puzzle guards a vault, never a passage. A ward holds no player: a player may
   always walk out, and the room is never sealed.
3. **ONE TO EIGHT.** Every encounter is won by one character of the floor build (law 7) and scales to a party of
   eight: a wave's size reads the party in the ward as the wave stands, and a timed window the party at its start.
4. **THE SAME ON EVERY CLIENT.** Sites are a pure function of the layout, the collider's answers and the dungeon's
   seed, under `dungeonFires.js`'s determinism rules. Nothing about where a site stands rides the wire.
5. **THE PARTY OWNS, THE RELAY COUNTS.** Online, the relay keeps each started encounter's ledger in the dungeon's room.
   The first word starts it for the speaker's party; only that party may work its puzzle; its vault is that party's.
6. **ONE CHEST, SIDEWAYS.** The reward is a vault chest: the dungeon's own pile (`rollPileItems`), and since DELVE-VAULT
   gold and one known piece Magic or better (section 6). No new rung or band: POWER-CEILING holds and LOOT-GATE applies
   as to any dungeon chest.
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
| Floor | a face that looks up within 4 m below, level to 0.25 m on rings at 1.5, 3 and 4 m on the eight bearings (the outer ring asked first), and on every piece's own spot: the tier's plates, the gates, the vault's four | a room's floor, never a stair, a ramp or a tabletop; a room may hold furniture between the bearings, never under a piece |
| The disc | radius 4 m; no mover, door or other piece not the dungeon's own reaching into it, 2.5 m over its floor (its box at the build pose: `Collider.bucketBoxes`); the eight chest-height rays clear past it; a ceiling within 12 m; walls on at least four rays within 30 m; the body fits | room to fight or work, inside a room, never on its roof, in an open hall or in a sliding wall's path |
| Clear of | doors 4.5 m; an enemy marker's own spot 2 m; start, treasure and quest markers 4 m (both on their storey); the way in 20 m; every fire 12 m; water by 0.5 m | law 2. The halls the foes stand in are the rooms a site wants, so a foe's marker refuses only its own spot |
| The small room | where the large rooms leave the count short: a 3 m disc on a 2 m grid, rings at 1.5 and 3 m, doors 3.5 m, items 3 m, the way in 12 m, fires 8 m, 60 m from the sites already stood; a candidate certainly within 60 m of one (its floor lands at most 4 m under its storey) never probed | a small dungeon's rooms |
| How many | non-border blocks / 2, at least 1, at most 3 | 4,221 of the 4,232 dungeons have one to four inner blocks: a four-block dungeon stands a wave and a puzzle |
| None in | a palace (`isPalaceLayout`), Privateer's Hold, the made levels (court, Hour, Spire, Ketch, arenas), the Abyss Hollow | a court is no dungeon; the Hold is the tutorial; the made levels have their own law |
| Choice | the deepest first (height counted twice), then farthest-point 60 m apart, a storey with none first, ties by `hash32(seed, i)` | spread through the dungeon, the same everywhere |
| Kind | seeded by the dungeon's id and the site's index; the second site takes the family the first did not | variety in one dungeon, the same for every visitor |
| Vault | a Hold's toward the nearest wall of the four axis bearings (the walls to the centimetre: a nearer by less is a tie, the first bearing), the disc's radius less 0.6 m out; a Litany's at its heart | a Hold's gates stand on the diagonals and a Litany's plates on the axes: the chest stands on neither; no last bit of an engine's trig moves it |

**THE CENSUS** (AUDIT DELVE II, 2026-10-29, all 4,232 dungeons, four shards of about 40 s). 4,228 want sites; the
three palaces and Privateer's Hold want none. 3,838 (90.7%) stand at least one, and 1,381 stand two or three, each with
a wave and a puzzle. 390 stand none: their rooms are corridors and stairs. Of 5,698 sites wanted, 5,225 stand, 1,231 of
them in a small room; 2,645 are Holds and 2,580 Litanies. No disc holds a mover or a door (86 did before the audit).
A refused spot's first broken rule is most often no floor, then a floor not level, then a door. The large rooms alone
stand a site in 73 dungeons of a hundred: the count and the small room are the census's.

**THE COST.** The plan runs once, in the dungeon's load beside the fire plan: 7.4 ms at the median, 25 ms at the 90th percentile, 48 ms at the 99th, 101 ms
at worst (Tower Mastersley; Node, one core, every dungeon - the fire plan 1.3 ms at the median beside it).

## 5. The kinds

Each kind's numbers are starting values, held in `net/delve/delveLaw.js`, measured in the game before they ship. `n` is
the party in the ward as a wave stands (1 to 8); a foe is drawn from the dungeon's own encounter table (its place, as
its layout's foes: DEX3's `dungeonPlace`) at the player's level and the dungeon's tier (BAL3: the place sets the
threat). A dungeon whose table stands no foe stands no Hold.

### 5.1 Waves

- **THE HOLD.** Survive three waves inside the ward. A wave is `3 + 2(n - 1) + (w - 1)` foes, at most 12 (one grant,
  section 7). The ward rises for 4 s before the first. A five-second breath between waves (STAR-TUNE's lesson: "The
  time between waves is too long"). A wave that runs 90 s gives way to the next. The last is a captain: an elite of
  the table with one boss trait, two in an Elite dungeon (BOSS-TRAITS), its fall believed no sooner than one kill's
  least time (2.5 s, the Starfall's). Not fallen in 5 minutes, it outlasts the ward and the attempt ends.
- **THE WELLSPRINGS.** Two to four sources on the ward's gates (drawn off the seed and the site) - a cracked tomb, a
  pool, a broken altar, by the dungeon's type - each pouring a foe every 12 s, three of its own alive at most. Break
  every source, then the captain. A source's health is 12 s of the reference damage of the party in the ward as they
  stand, at least the gate's floor (the Spire's `egHpTeam` rule, `net/eliteGates/egBodies.js`). A blow lands by Dagon's
  crystals' caps: the member's hand and purse, a swing within reach. Unbroken in 5 minutes, they outlast the ward.
- **THE VIGIL.** A relic at the disc's heart with the Starfall's 100 light; foes go for it before the party
  (`huntsStar`'s rule), and their blows take its light at the Starfall's rate. Three waves as the Hold's, a breath
  giving 15 light back; the third wave's end is the win, with no captain. The light lost, it rests 60 s.

A wave's foes fight as any foe of the dungeon does (no leash: the AI's follower leash turns the Enhanced AI's fighting
off). The ward is the disc and 2 m round it, 3 m up or down, in its own room (past the disc, a clear line to the
heart). The encounter clock runs only while a member was in the ward within 15 s. Every member out of the ward for 30 s
ends the attempt: its foes crumble wherever they are, nothing is earned, and the ward wakes again to a step back in.

### 5.2 Puzzles

- **THE LITANY** (runes in order - the Examination's law). Four plates 2.5 m round the disc's heart, five in an
  Elite dungeon. They light one at a time, a second each, with a numeral and a chime, then go dark. Step on each in
  that order (within 1.2 m). A plate stood on counts once; it counts again only when it would light (LITANY-STAND,
  section 16). A lit plate may be stood on again; a wrong one darkens all and the order plays again. Untimed; in an Elite dungeon a wrong plate also wakes two foes of the table. A party silent at the site for 60 s lets
  it go.
The Brazier Rite and the Seals rise 3 s after the first step in, and count the party in the ward then.

- **THE BRAZIER RITE** (carry and bank - the Ketch's law). A source flame at the heart and three braziers on the
  ward's gates, four for a party of four or more. Take the flame, carry it slowed (THE BURDEN, 0.72) with the weapon
  put up, and light a brazier within 1.2 m. The flame lives 20 s off the heart, then gutters back to it. A carrier
  struck drops it, and it lies 10 s to be taken up once the carrier has stepped off it; taken up, it keeps its 20 s and
  its walk from the heart. Lit braziers stay lit. Foes of the table drift in from the rim, one each 15 s, two at most.
- **THE WEIGHING** (plates held together - the winch's law). Three plates 3 m from the heart, on the axes the vault
  does not take. Each is held by a member standing on it (their word fresh within 2.5 s) or by a stone weight carried
  from the ward's gates (THE BURDEN again). All three held for 3 s opens the vault; any let go starts the count again.
  One player carries two weights and stands on the third. A weight is taken by a press, from as far as one reaches. A
  weight lifted off a plate goes back on it only when its carrier steps off and on again.
- **THE SEALS** (break them all in time - the crystals' law). Three to six seals (`2 + ceil(n / 2)`) rise 3 m round the
  heart, each a Dagon's crystal's health for the party (`crystalHpFor`). Break all within 40 s plus law 7's floor of
  their route (measured: 24 s could not be won at a level-1 character's own blows - section 14). Failed, they sink and
  rise again 10 s later, counted anew.

A carried piece goes home - the flame to the heart, a weight to its gate - when its carrier speaks or lets go from
outside the ward, or falls silent for 15 s, so nobody stays burdened past the ward. An account's level is the one its
record was made at: a word may say it lower, never higher, while the attempt stands.

No puzzle hurts a player for a wrong answer, and none is the clock: no dial, no hidden coupling, no riddle text.

## 6. The vault

- A chest stands sealed from the dungeon's first frame (Daggerfall's own, model 41811, the Crown Hall's), solid as a
  block's chest is: at the Litany's and the Seals' heart, at a wall for every other kind. The encounter won, it opens. Its plaque names a sealed vault
  and what opens it, and lists a won one as a pile; quick loot takes from it; the look round calls it a find.
- Its roll is `rollPileItems`: the dungeon's tables at its type, its Elite odds, LOOT-GATE's rarity. With it, since
  DELVE-VAULT (section 16): one known piece Magic or better (a weapon, armour or a jewel), laddered at the dungeon's own
  pile source and the opener's level, and gold, 40 a level (0.8 to 1.2 of it). `systems/delve/delveVault.js`; each
  earner's share is rolled on its own machine. As a pile's piece it counts for the drought and online a weapon's sigil
  is rolled; as the raids' spoils, it takes no curse, socket, finder or the opener's luck.
- One vault a site a respawn (law 8). Online, each earner opens its own share once.
- POWER-CEILING (`05-Combat/Power-Ceiling.md`): nothing here is a new line, rung or band.
  The pile and the piece are laddered by `applyRarity` at rungs `test/combat/powerceiling_walk.test.js` walks. Patch
  notes, release notes and Discord posts may say a vault holds gold, a Magic or better piece and the dungeon's own
  treasure, never its odds (LOOT-GATE).

## 7. Online (DLV3)

The relay reads no game data (Port-Doctrine), so it cannot place a site. Every client can, and law 4 makes them agree.
As built (2026-10-29): `server/src/delveRoom.js`, the `dv` frame (`net/wire.js` validDelveIn and validDelveOut), the
session's door (`net/online.js` sendDelve), the one link (`net/delve/delveLink.js`) and the host's online half
(`scenes/delve/delveOnline.js`, `delveHost.js`).

- **THE PLAN.** A page says its plan - its sites, a few hundred bytes, and their hash - until the room answers. The
  room keeps up to four plans side by side (DELVE_PLANS_MAX), each with its own ledgers, so a page of another build or
  a forged plan plays alone and never stands another down. Past four, the least used with nothing at stake gives way;
  with all at stake the page waits and says its plan again every 3 s. A word under a plan the room does not keep asks
  for it, and every frame the room says names its plan (`ph`).
- **THE LEDGER.** One for each started site, in the room's storage (`dv:p:` and `dv:l:`, never `world:`), stepped by
  the next word heard at its site, whoever says it. It is read back after a hibernation, and forgotten with the room's
  memory. Its law is the client's own (`net/delve/delveLaw.js`).
- **THE PARTY.** The first word's speaker owns the site. Another account's word counts only if the hub says it is of
  the owner's party (`_instanceKinOf`, SD-PARTY's door; a guest's as any member's). The hub's no is kept 30 s and its
  silence 5 s. A stranger is told once, and its page holds its words there until the site's state moves. An account
  runs one attempt at a time in a room.
- **REACH AND LEVEL.** A step, carry or blow is judged from the pose the room last heard; the page makes it current
  before each word, as `sendPose` says it. The level is the token's, or a word's lower one (a mentor's). That pose is
  taken before the dungeon moves the player, so the page judges its walked-to acts at last frame's feet (WEIGH-POSE,
  2026-10-30: a weight said set on the frame its carrier reached a plate fell to the floor beside it).
- **THE WAVES.** The room names the foes' machine: the first word in the ward offers it, and a named machine keeps
  holding them. It stands the foes under the `delve` grant kind (12 a grant, a world room's alone). Named mid-wave, it
  stands the rest and counts on from the room's deaths. An encounter's foe is never handed on at a door.
- **THE VAULT.** Won, the ledger names its earners: the owning party's members who stood at the site in its last 15 s.
  Each asks the room for its share once; the share is rolled on the earner's machine when the room says yes.
- **INSTANCES.** An instanced dungeon (`Instances.md`) is a room like any other: the ledger lives in it.
- `world292` (DELVE_RELAY_MIN; world284, world288 then world289 on its branch, renumbered past main at the merges): a page at an older relay stands no site online. DELVE_RELAY_MIN is `world298` since AUDIT LITANY-STAND (section 16). Online a window does not hold the
  world (WINDOW-ONLINE), and the encounters run on under it.

Strangers in the room may fight a wave's foes (they are hostile to all) and earn nothing; they may not work another
party's puzzle. Offline the same law runs in the client, its ledger saved with the dungeon.

## 8. Curated blocks (DLV5 and DLV6)

- **WHERE.** Only in dungeons the game lays out itself: spawned (`world/spawnedDungeons.js`), Elite and the lairs past
  the Bay (`world/tamrielDungeons.js`). Never in Daggerfall's 4,232, a Super dungeon's Hollow (it stands no
  encounter), a zone hall (its room is its lane's law) or a made level (`curatedSplice.js curatedTakes`).
- **WHAT.** A real interior block of BLOCKS.BSA - its `base`, read as the file holds it - with objects taken out by
  name (`drop`: a model, a flat or a marker within a reach; never what acts or what an action names, an editor marker
  by its name alone, never the way in), Daggerfall's models, flats, editor markers and lights added (`add`: a light by
  its reach, 1 to 12 m, as the base's own lights are read), and one encounter's anchor. A record of ours
  (`src/assets/delve/<id>.json`, the law `world/dungeon/curatedBlocks.js`), made when first read as a capital's castle
  halls are (`registerPortBlockOf`, at 907000 and its number). DEPARTURE from the plan's whole World Data JSON: made of
  a base, its edges meet its neighbours as the base's do, and no block of the game's enters the repository (WD1's rule).
- **HOW IN.** A game-made dungeon whose type's pool holds a block takes one at CURATED_CHANCE (a half), in place of one
  interior block that is not the start, drawn off its own map id - each record weighing on its own lane, so a record
  added takes only the dungeons it outweighs. The location as built carries it, after any smaller size
  (`smallerDungeons.js dungeonLocationFor`): the layout, the quests' markers and the room read one list. The dungeon
  whole - an instance's, an online quest's - is its own blocks. Its room names the block after its size, `.c2`
  (`net/wire.js` dungeonRoomTag), since an older page lays that slot as Daggerfall's; online that public room is relaid,
  so a quest's things stand in its instance. Its anchor stands first in the site law; the law finds the rest.
- **THE FIRES AND THE WAY IN.** An anchor keeps its own ward's distance from every fire and from the way in, as a found
  site does (a 4 m ward 12 m and 20 m, a 3 m one 8 m and 12 m); one crowded gives way, and the law finds a site in its
  place. The campfire law stands none within DFIRE.anchorM (12 m) of one (`dungeonFires.js`). A record drops its
  base's own fire within that reach.
- **THE TOOL.** `delve.html` lists the shipped blocks and this browser's drafts, each by its id, and begins a new
  one. The bench's lab (`?dungeon=lab`) lays the draft (number 0) with four borders of a real dungeon of its type round
  it, as the game lays it (never as the start). Its panel (`scenes/delve/delveLab.js`) sets a model or a flat on the
  floor at the player's feet (its foot read from the player's data - `delveBench.js` labFoot), a light over them, a
  marker, a drop, an anchor or its vault. Rebuild keeps the draft, never one the law refuses, and lays it again with
  the player where they stood - with no spot, a step past the first ward, whose heart would wake it. Check asks the
  host's `landing`; Export gives the record with every type and its number.
- **THE BENCH.** `?spawn=px,py` builds a named dungeon cloned on a pixel, as the world builds a spawn.
- **THE LOOK.** Daggerfall's own models and flats, and code-painted pieces under DF-LOOK (`01-Overview/DF-Art.md`):
  no render of game data ships (Port-Doctrine).

## 9. The slices

| Slice | What | Done when |
|---|---|---|
| DLV0 | This record | merged |
| DLV1 | The law: `net/delve/delveLaw.js` (kinds, numbers, the ledger machine, its words, earned) and `world/dungeon/delveSites.js` (the site law); the census probe | DONE 2026-10-28: `test/net/delve/dlv1_law.test.js` and `test/world/dlv1_sites.test.js`, their mutants dead (`tools/mutants/dlv1.json`); the census in section 4 |
| DLV2 | Offline in the game: `scenes/delve/delveHost.js` wired by `buildDungeonContext`; the Hold and the Litany; the vault; the HUD's words; the Features row `dungeon-encounters`; the Ledger A row | DONE 2026-10-29: stood and won in the real game; save and load; frame cost measured (section 12). AUDIT DELVE II the same day. An Elite stands online alone, so DLV3 stands it |
| DLV3 | Online: the relay's ledger, the party's door, the plan's hash, the `delve` grant kind | DONE 2026-10-29: `test/net/delve/dlv3_relay.test.js` (the room through the real Room: a party of three with a guest wins a Hold and opens its shares, a stranger refused, the plans side by side), `test/scenes/delve/dlv3_online.test.js`, `test/scenes/delve/dlv3_e2e.test.js` (the real host on the real Room, every kind); `tools/mutants/dlv3.json`; `world292`; AUDIT DLV3 (`01-Overview/audits/Audit-Delve-II.md` G) |
| DLV4 | The Wellsprings, the Vigil, the Brazier Rite, the Weighing, the Seals; their audit | DONE 2026-10-29: each won in the real game (section 14); `test/net/delve/dlv4_law.test.js`, `test/scenes/delve/dlv4_host.test.js`, a party through the real Room in `dlv3_e2e`; `tools/mutants/dlv4.json`; AUDIT DLV4 (`01-Overview/audits/Audit-Delve-II.md` F) |
| DLV5 | Curated blocks: the format, the registry, the splice law, the lab page | DONE 2026-10-29: `test/world/dlv5_curated.test.js`; a spawned clone takes its block, laid as the world lays it (`dlv56_audit`); `tools/mutants/dlv5.json` |
| DLV6 | The first curated blocks, their set pieces; AUDIT DLV5-6 | BUILT 2026-10-29 (section 15): four blocks, `crypt-hall` won in the real game; `test/world/dlv6_blocks.test.js`, `dlv56_audit`; `tools/mutants/dlv6.json`, `dlv56.json`; AUDIT DLV5-6 (Audit-Delve-II H). Done as the owner plays them |

Each slice: pins that fail under a mutation of what they pin, its mutants recorded, the bible gates, a probe in the
real game over the freeware's data, and a frame-cost measure (`npm run perf`) before it merges.

## 10. The four hosts

- `scenes/dungeonContext.js`: WIRED at DLV2 - the one host that stands a dungeon. 25 logical lines (8,436 to 8,461,
  under its 8,463 ceiling): the build after its api, the frame and the marks in drawFoes, the vault's arms in takeLoot
  and lootContents, the save's word in its world record and its restore, the stamp the two replace doors carry, the
  destroy, and the probes' door. The rest is `scenes/delve/`.
- `scenes/world.js`: WIRED at DLV3 - one line, `online.onDelve = wireDelve(online)` (`net/delve/delveLink.js`): the
  session's words to the host that hears them. The context carries DLV3 in existing lines, no logical line added:
  `delve` in its loose stand's options and grant ask, and `f._delve` on the line that never hands a revenant on.
- `scenes/worldModes.js`: WIRED at DLV2 - `delve:` joins its press arm's prefixes (no logical line); the rest is the
  context's.
- `scenes/exterior.js`: FLAGGED - the fixed city stands no dungeon.
- The dev bench `scenes/dungeon.js` (`?dungeon=`) stands the sites: `delve:` in its press arm and `window.__delve`, the
  probe's door (`tools/delveProbe.mjs`).

## 11. Open for the owner

Each has a default the slices follow until the owner says otherwise.

- **Strangers and waves.** Default: a stranger may fight a wave's foes and earns nothing.
- **Which dungeons.** Default: every dungeon but palaces, Privateer's Hold, the made levels and the Abyss Hollow. The 14
  main-story dungeons included: no site stands on a quest marker.
- **How many.** Default: one site for two blocks, one to three (the census moved it from five).
- **The switch.** Default: an Enhanced Features row, on. Offline it is the player's; online the room's sites stand for
  everyone in it, whatever the row says, as a shared dungeon's foes do.

Not a DFU member: DFU's dungeons hold no encounter rooms. Ledger A row DELVE II.

## 12. DLV2: what stands (2026-10-28)

The encounters stand in the game offline. `scenes/delve/delveHost.js` makes the plan as the dungeon is built and runs
each site's ledger on the player's own words: offline the player is the whole party and the machine that stands the
foes. Online none stands until DLV3, and the row's note says so.

| Piece | How |
|---|---|
| A wave's foes | `chooseRandomEnemy` on the dungeon's own table and place (`dungeonPlace`) at the player's level, stood by `spawnLooseFoe` at the four gates (a rank 0.9 m nearer the heart each time round), facing the heart; a foe that will not stand asked three times |
| No leash | a foe of a wave fights as the dungeon's own do: the AI's follower leash would turn the Enhanced AI's fighting off (`ai/tactics.js`) |
| The count | each foe carries a stamp (`_delve`); a body that takes its place takes it (the Wabbajack's change, a rebuild in its slot); the pool is read once a frame - a kill is a foe downed (killed, executed, spared, put to flight), a foe removed by another hand is out of its wave and no kill |
| The captain | an elite where elites stand (`elitesAllowed`), its boss traits the ledger's count (`giveBossTraits`); one gone without its fall stands again after 2 s; alive 5 minutes, it outlasts the ward |
| An ended attempt | its living foes crumble (`removeLooseFoe`), wherever they are; one that stands after is taken back; the ward wakes again to a step back in |
| The plates | shown a second each, a chime rising with the numeral; a step said once as a plate is stepped onto (until LITANY-STAND, section 16) |
| The marks | the gate's telegraph pass in its lit grammar (a bright line, a dark keyline, filled where live), under the frame's fog, kept and filled in place: the ward's ring and gates, the plates by their looks, the vault's seal |
| The vault | Daggerfall's chest (41811), in the mesh list and the collider, offline from the first frame; its roll the dungeon's own `rollPileItems`, rolled once at the win; listed on the plaque, taken by quick loot, a find to the look round |
| A save | in the dungeon's world record (the envelope keeps only what it names): the plan's hash and each won site's vault; a running attempt is never saved, and a load takes every living foe a site stood |
| The clock | the dungeon's frame, so it waits under a window as the foes do; a frame of no number moves it nothing |
| The cost | the encounters' frame 0.09 ms and their marks 0.15 ms a frame at the mean over 675 frames, on the software rasteriser at 800 x 500 (`tools/delveProbe.mjs`, Bedard Laboratory: the Hold and the Litany won, each vault opened) |

The dev bench's `?class`, `?nofoes`, `?spell` and `?weapon` stood inside a comment (FOE1's bug class): every `?dungeon=`
boot opened the wizard and stood no layout foe. They are one option a line now, and `tools/delveProbe.mjs` drives the
real game through a dungeon's sites on them.


## 13. DLV3: what stands (2026-10-29)

The encounters stand online. The dungeon's room keeps each site's ledger, and each page says its words to it and reads
its state back. The row's note says a party wins an encounter together online.

| Piece | How |
|---|---|
| The frame | `dv`. From a page: `pl` its plan, `w` a word at a site, `a` an act, `x` a blow, `v` a vault's ask - 8 a second at most (the relay's bucket 16 deep). From the room: `dl` a site's state with my own part (`me`), `ev` what moved it, `v` a vault's answer, `pl?`, `no` |
| The view | the room's state made a ledger-shaped view (`delveView`), so the looks read it as they read a ledger offline: each phase from 0 on its own clock, run on between states |
| The word | every second near a site, at once when it changes: my screen's ward (`iw`), the plate stepped (said a second while the room's pose catches up - it never did: LITANY-STAND, section 16), the Vigil's blows on my machine |
| Acts and blows | said to the room, never folded at home; an act said again after 600 ms unmoved |
| The machine | the room's word (`me.fm`); named mid-wave it stands the rest, named no more its own crumble |
| The vault | an earner's press asks the room; its yes rolls the share on my machine (PARTY-LOOT's base) |
| A save | online the room keeps the won sites: a save keeps none, and a load restores none |
| The session | a word leaves a welcomed socket in a dungeon's room at a relay that keeps them, its pose made current first |
| The grant | `delve`: 12 a grant, a third a second, 8 deep, hostile - a world room's alone |
| The relay | `world292` (world284, world288 then world289 on its branch); a page at an older one stands no site online |

## 14. DLV4: what stands (2026-10-29)

Five kinds join the Hold and the Litany, in the same law (`net/delve/delveLaw.js`) and host (`scenes/delve/delveHost.js`).
Each was woken, worked and won in the real game over the freeware's data (`tools/delveProbe.mjs`), a level-1 character
kept whole by the probe, the dungeon's own foes near the site felled as a player would fell them, and its vault opened.

| Piece | How |
|---|---|
| The pieces | the sources and the seals on the dungeon's crystal seam (`scenes/delve/delveBodies.js`): a blow, an arrow or a harmful spell reaches them as it reaches Dagon's crystals; the relic joins the foes' quarry, so they go for it first |
| The props | the crystals at a room's size; Daggerfall's pedestal (74237) under each brazier and its boulder for a weight; the camp fire's flame (`scenes/delve/delveProps.js`) |
| The carry | the Ketch's hands-full law (`player/carryStep.js`): slowed to 0.72, the weapon put up; readied again, or the carrier struck, the piece is let go where they stand |
| The reach | a weight is taken by a press, from as far as one reaches (`DELVE_PRESS_M`: DFU's treasure distance to its box); the flame, the braziers and the plates are walked to, within 1.2 m. At 1.2 m for all, a press from 2 m took nothing and said nothing (Audit-Delve-II P3) |
| The measure | a level-1 character's own blows land 1.3 to 3.3 a second on a seal (`--dps`, and the run's own bursts); at a 24 s window the real game never broke three, so it is 40 s and the route's floor, and three of 20 fell in their first window |
| A party | every kind is won by a party through the real Room (`test/scenes/delve/dlv3_e2e.test.js`); failed and woken again in the law's and the host's pins |

| Kind | Dungeon | Won | The vault |
|---|---|---|---|
| The Brazier Rite | The Pit of Jubiamorgon | 262 s, three braziers lit | 2 items |
| The Weighing | Ruins of Wicksmith Court | 238 s, two weights set, the third plate stood on | 6 items |
| The Seals | The House of Baron Garulaus | 285 s, three seals in their first window | 5 items |
| The Vigil | The Aviary of Morarock | 620 s, three waves, the relic's light held | 1 item |
| The Wellsprings | Kingsly Tower | 1,915 s, both sources broken and the captain felled - on the code before DLV3's changes to the host | 2 items |

The encounters' frame cost 0.08 to 0.20 ms at the mean on the software rasteriser at 800 x 500, their marks 0.22 ms
for the Brazier Rite and the Weighing. The Seals' marks read 8.3 ms and the Vigil's 5.0 ms at the mean, the eye 1.2 m from
their crystals; the probe splits the pass by the eye's distance (`tools/delveProbe.mjs`), and that measure is still to be
taken. The Wellsprings is to be won again on the code as it stands.

## 15. DLV5 and DLV6: what stands (2026-10-29)

Four curated blocks ship. Each is a real interior block of the player's own BLOCKS.BSA with things taken out, Daggerfall's
own models and flats added round one encounter placed by hand, and its lights. A game-made dungeon of a block's types
takes one in half its draws (section 8).

| Block | Its base | Its types | Its encounter | Its set piece |
|---|---|---|---|---|
| `crypt-hall` (1) | N0000023.RDB | Crypt, Desecrated Temple, Vampire Haunt | the Hold | sarcophagi and coffins round the ward, braziers on pillars, skull candles, bones and a skeleton; the base's foes within 6 m of the ward and its fire bowl taken out |
| `mine-gallery` (2) | W0000016.RDB | Mine | the Brazier Rite | ore carts, rocks, a log and a sawhorse, ore, pole torches; the base's two coffins, a foe and its campfire taken out |
| `desecrated-chapel` (3) | W0000021.RDB | Desecrated Temple, Coven | the Seals | the crucified, blood on the floor, skull candles on the altar, bones and skeletons; the pews within 2 m of the ward taken out |
| `throne-hall` (4) | N0000008.RDB | the Orc, Human, Giant and Barbarian Strongholds, the Ruined Castle | the Weighing | braziers, skulls on the mantel, bones, stocks and a cage; a foe by the throne taken out |

| Piece | How |
|---|---|
| The records | `src/assets/delve/<id>.json`, read by `world/dungeon/curatedRecords.js`; each checked on the freeware's own geometry before it shipped - every thing on a floor, 0.5 m clear of the ward and 1.2 m of a door, each light 0.5 to 4 m over a floor, the anchor landing where the site law would stand it |
| The lab's spot | `?at` (where a Rebuild left me), else the host's floor nearest the first encounter, on its storey and a step past every ward (`delveHost.js` firstFloor): its heart would wake the ward at the boot |
| The lab's panel | `scenes/delve/delveLab.js`, beside the bench that mounts it (`delveBench.js` mountLabPanel) - a played page's module, read by AUDIT ANTICHEAT A2's sweep; the front page `src/tools/delveLabPage.js` is a tool's |
| The probe | `tools/delveProbe.mjs --lab=<id>` lays a shipped block in the bench's lab and wins its encounter in the real game, its pictures from the heart each way of the compass; `--spawn=px,py` a named dungeon cloned on a pixel, as the world builds a spawn |
| Won in the real game | `crypt-hall` in the lab: the Hold's three waves and its captain, 661 s, the vault 2 items; the set pieces seen standing (the braziers lit, the sarcophagi, the candles). The other three are checked on the freeware's geometry and their kinds won in Daggerfall's own dungeons (section 14); each is still to be won in its own block, and a spawned clone with its block (Ruins of Krofylen Court at 100,300 takes the crypt hall) is still to be probed |


## 16. LITANY-STAND and DELVE-VAULT (2026-10-31)

From play, in Discord: a player stood on a Litany's plate and nothing lit ("is it still bugged or am I dumb"). The owner,
the same day: "the rewards for these are really really bad".

**LITANY-STAND.** Online the page said a step once, on the frame its player reached a plate. The room judges a word at
the pose it last heard, which is the frame before (WEIGH-POSE), so the player was not yet on the plate there and the
step was lost. The word is said again a second later, when its one-second window had already closed. Offline, a plate
walked onto while the order played was spent before the work began.

Now every word says the plate its member stands on,
read where the room hears them. The law judges a step onto a plate; a plate the member stays on is heard again only
when it would light (`delveLaw.js` litanyWord, the account's `pl`). `world298`, and DELVE_RELAY_MIN with it: an older
relay judges every word's plate, so an Elite Litany would wake two foes at each showing while a member stood on a wrong
plate. Deploy the relay first.

**DELVE-VAULT.** A vault was one treasure pile - often a few coins or an ingredient - for minutes of work. It now holds
one known piece Magic or better, the pile, and gold at 40 a level (0.8 to 1.2 of it, half a raided town's thanks). The
piece is the raids' and the stars' spoils' shape (`spoilsBase`, `magicOrBetter`, the ladder's last pass and the
technique), laddered at the dungeon's own pile source - its type's tier, an Elite's quality, its family - with LOOT-GATE
at the opener's level. With the ladder off it comes plain (`systems/delve/delveVault.js`).

| Pin | What |
|---|---|
| `test/net/delve/dlv1_law.test.js` LITANY-STAND, AUDIT LITANY-STAND | stood on through the show, lit as the work begins; a word the room does not bear out counts on the next; a wrong plate stood on is judged once until stepped off; a party through another's wrong plate |
| `test/scenes/delve/dlv2_host.test.js` LITANY-STAND OFFLINE | the same in the host, offline |
| `test/scenes/delve/dlv3_e2e.test.js` LITANY-STAND E2E | the real host on the real Room, the room one frame behind as the page is: won, the vault my share. On the old code the first plate never lit |
| `test/systems/delve/delvevault.test.js` | the piece, the pile and the gold; the source; LOOT-GATE's hold on a young opener; the ladder off; the drought's mark and the online sigil |
| `tools/mutants/litanystand.json`, `tools/mutants/delvevault.json` | 17 mutants, all dead; six records of `dlv1`-`dlv3` re-aimed by content, and the two of the old vault's second roll and its gold floor retired with that law |
| Won in the real game | `tools/delveProbe.mjs` over the freeware's data, offline: The Agryn Prison's Litany, each plate lit as it was walked onto, 126 s, the vault 8 items; Bedard Laboratory's Hold (444 s, 4 items) and Seals (375 s, 5 items). No page error |

AUDIT LITANY-STAND (2026-10-31) read the two commits cold: `01-Overview/audits/Audit-Delve-II.md` section I.
