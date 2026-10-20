# THE KING'S GAMBIT - armies and kings at the tavern's card table (KG0, the design record)

**Status: DESIGN RECORD, DECIDED (the owner, 2026-10-13: "Make the best and most detailed decisions. We also have
permission") - section 10 answers section 9 and decides every point the record had left open. KG1 SHIPPED (the law,
section 11); KG2 SHIPPED (the innkeeper's play, section 12); AUDIT KG (section 13: the law, the play and this record
read cold, every finding fixed) - and section 14 binds the table's UI, KG3's and KG4's, to Enhanced Plus, the house's
own coat and plain words. KG-SET SHIPPED (section 15: the nine in the Iliac set, and the set's words in the player's
language). KG3 SHIPPED (section 16: the evening offline - the first playable game, at a tavern's card table against its
regulars).** The owner handed over a
Daggerfall Unity mod, `thekingsgambit.dfmod`, and asked how to build it as a new minigame on the Iliac Bay card system -
the tavern card table `Tavern-Cards.md` built: the table and its seat, the deck of the Iliac Bay, Iliac Hand's painted
cards, the regulars, the panel, the relay's tables. Sections 1-2 read the mod off its assembly; sections 3-7 lay it on
the card table; section 8 slices it; section 9 asked and section 10 decides. Every DECIDED below binds the slices; a
slice that ships one records any change here first.

## The words

- The owner, 2026-10-13, handing over `thekingsgambit.dfmod`: **"How can we implement this using the illiac bay card
  system. A new minigame"**.

## How to read this page

| Mark | Meaning |
|---|---|
| **THE MOD'S** | What the mod does, read off its assembly - the law a slice ports verbatim (Port-Doctrine's translation rule, held to a mod as the registry holds every mod it carries). |
| **DECIDED** | The record's proposal. Binding on the slices once the owner answers section 9; the owner may overrule any of it. |
| **FACT** | What the tree does today, read off the file named. |
| **MEASURE** | A number this page cannot know yet; the named slice measures it before it builds on it. |

Not a DFU member: Daggerfall Unity ships no such game - the mod does. Its port is a mod's (`01-Overview/Mod-Registry.md`,
the way Meaner Monsters and Windfall came in from their compiled assemblies), and each slice that ships opens or narrows
its Ledger section A row.

## 1. The bundle (FACT - read off the file the owner handed over)

- `thekingsgambit.dfmod`, 52,512 bytes, sha256 `60b9400b1a8ea93cfdf140ff11d44af713188244f4a262d58a122983171539cd`:
  UnityFS 7 from Unity 2019.4.41f2, one LZ4HC block, one serialized file holding TWO assets:
  - the manifest `TheKingsGambit.dfmod.json` - ModTitle `TheKingsGambit`, ModVersion `1`, DFUnity_Version `1.1.1`, GUID
    `e3406109-b550-43e4-ae70-51e32850e225`. Its Files list names `Scripts/TheKingsGambit.cs`, which the bundle does not
    carry;
  - the compiled `TheKingsGambit.dll`, 89,600 bytes, sha256
    `e1eb5e05747e31bb51e09486f380bded2961d8b04a23b18104a91955fe723036`: `TheKingsGambit` (a MonoBehaviour - the whole game,
    its IMGUI and its network link `NetLink`) and `TheKingsGambitWindow` (an empty 320 x 200 DaggerfallPopupWindow the game
    pushes so DFU pauses under it, then draws over).
- No author, no licence, no readme (section 9, Q6).
- Read with ilspycmd 9.1 (the C#) and its IL. The C# view shows the stake multipliers `{1, 2, 5}` and the online stakes
  `{0, 10, 50, 200, 1000, 5000}` as initialisers; three arrays the static constructor fills from RVA data it cannot show -
  the three sound tables (section 2.10), read off the IL (AUDIT KG C10: this line had counted the stakes among them).
- Its particle art is NOT in the bundle. `LoadModTexture` asks the mod for `circle_05`, `flame_05`, `star_06`, `smoke_07`
  and `circle_03`, finds none, warns, and uses its own procedural soft circle (`MakeSoftCircle`, 32 px): the shipped
  game's fire and poison are particle systems of that one blob, and with no particle shader at all it draws
  `DrawHazard`'s rectangles.

## 2. The game, as the mod plays it (THE MOD'S)

"A game of armies and kings. Protect yours." Two sides, each a free king and up to twelve units bought with points from
Daggerfall's own bestiary, on a board fifteen columns by thirteen rows; a turn is two actions; a side whose king falls,
or that has no piece left, loses. Played against the innkeeper (four tiers) for a gold stake, or against a friend online.

### 2.1 The board

- 15 columns by 13 rows (`Cols`, `Rows`). A cell is Floor, Wall, Pillar or Water (`MapTile`). Only Floor is walked
  (`IsPassable`); a Wall or a Pillar blocks a sight line (`BlocksSight`), Water does not ("Water: cannot be crossed on
  foot, but ranged attacks pass over it.").
- The host's side is the board's foot (rows 10-12, the king on column 7 of row 12); the guest's is its head, every cell
  mirrored through the centre, (c, r) to (14 - c, 12 - r). Each client draws its own side at the foot.
- THE MAP IS POINT-SYMMETRIC: `SetTile` writes a cell and its mirror, and only in rows 3-9 (`ZoneTop`, `ZoneBottom`) -
  the deployment rows 0-2 and 10-12 are always floor.
- `BuildMap`: up to 30 tries. Each clears the board, picks a layout (`Rand(0, 4)`), lays three ACTIVE hazard pairs (2.6),
  and keeps the board if it is playable (`MapIsPlayable`: the head's king cell (7, 0) reachable from the foot's (7, 12)
  over floor alone - pieces block nothing there - and at least 97% of the floor reachable). Thirty failures lay the Open
  field.

  | layout | floor tones A / B (RGB) | what it lays |
  |---|---|---|
  | Pillared hall | 0.27 0.27 0.30 / 0.36 0.36 0.40 | a pillar on columns 1, 4, 7, 10 and 13 of rows 3, 5, 7 and 9; RandomChunks(2) |
  | Guard rooms | 0.30 0.23 0.17 / 0.40 0.31 0.22 | row 5 a wall but at k, 7 and 14 - k, k = Rand(1, 4) - mirrored, so row 7 as well; a wall at (5, 6), so at (9, 6); RandomChunks(2) |
  | Ruined keep | 0.24 0.29 0.20 / 0.32 0.38 0.26 | RandomChunks(8) |
  | Moat and bridges | 0.40 0.35 0.24 / 0.49 0.43 0.30 | row 6 water but at k, 7 and 14 - k, k = Rand(2, 6); RandomChunks(3) |
  | Open field (the thirtieth failure) | 0.24 0.29 0.20 / 0.32 0.38 0.26 | no wall; three active hazard pairs |

- `RandomChunks(n)`, n times: c = Rand(1, 14), r = Rand(3, 7), shape = Rand(0, 5); a wall at (c, r), with (c + 1, r) for
  shape 1, (c, r + 1) for 2, both for 3, (c - 1, r) and (c + 1, r) for 4. A wall cell is laid only on floor in columns
  1-13 of rows 3-9 (`PlaceWallCell`), mirrored.
- `Rand(a, b)` is `System.Random.Next(a, b)`, a draw in [a, b), off the game's seeded source.

### 2.2 The units and the roster

- A unit (`MakeUnit`) is a row of DFU's EnemyBasics: level the row's Level (a calling 6, a king 8); hp (MinHealth +
  MaxHealth) / 2 truncated, at least 1 (a calling 30, a king 70); attack RoundToInt(level x 2 x (ranged ? 0.75 : 1)), at
  least 1; cost RoundToInt(sqrt(hp x attack) x (ranged ? 1.35 : 1)), at least 6 (`MinCost`; a king 0). Computed at
  float32, and Unity's RoundToInt rounds a half to even. The declared DamagePerLevel 2, RangedDamageFactor 0.75, CostScale
  1 and RangedCostFactor 1.35 are those literals. Its name is TextManager's (`GetLocalizedEnemyName`).
- THE ROSTER (`BuildRoster`): every row with a MaleTexture - the 42 monsters, all melee (no monster row has
  HasRangedAttack1), and of the callings only the four of `RangedClasses` (Mage 128, Sorcerer 131, Archer 141, Ranger 142),
  ranged. 46 units, sorted by cost, then by name (ordinal).
- THE KINGS: the host's the Knight (145), the guest's the Barbarian (143) - two sprites over one set of numbers: level 8,
  70 hp, attack 16, free.
- THE TABLE, computed off the port's own `characters/enemy/enemyBasics.js` (ENEMY_BASICS, DFU's rows) at float32 and at
  float64, with half to even and with half up: every unit the same - the vanilla rows meet no half. The last column is
  FACT: the card each creature already is (`cardSources.js:"export const FOE_CARDS = Object.freeze({"`).

  | id | unit | level | hp | attack | cost | reach | its Iliac card |
  |---|---|---|---|---|---|---|---|
  | 0 | Rat | 1 | 12 | 2 | 6 | melee | Rat |
  | 1 | Imp | 2 | 14 | 4 | 7 | melee | Imp |
  | 3 | Giant Bat | 3 | 19 | 6 | 11 | melee | Giant Bat |
  | 2 | Spriggan | 3 | 19 | 6 | 11 | melee | Spriggan |
  | 4 | Grizzly Bear | 4 | 23 | 8 | 14 | melee | none |
  | 5 | Sabretooth Tiger | 4 | 23 | 8 | 14 | melee | none |
  | 6 | Spider | 4 | 23 | 8 | 14 | melee | none |
  | 7 | Orc | 5 | 23 | 10 | 15 | melee | Orc |
  | 8 | Centaur | 5 | 30 | 10 | 17 | melee | Centaur |
  | 10 | Nymph | 6 | 32 | 12 | 20 | melee | Nymph |
  | 12 | Orc Sergeant | 7 | 32 | 14 | 21 | melee | Orc Sergeant |
  | 11 | Slaughterfish | 7 | 32 | 14 | 21 | melee | none |
  | 141 | Archer | 6 | 30 | 9 | 22 | ranged | none |
  | 128 | Mage | 6 | 30 | 9 | 22 | ranged | Mages Guild Apprentice |
  | 142 | Ranger | 6 | 30 | 9 | 22 | ranged | none |
  | 131 | Sorcerer | 6 | 30 | 9 | 22 | ranged | Mages Guild Battlemage |
  | 9 | Werewolf | 6 | 41 | 12 | 22 | melee | Werewolf |
  | 14 | Wereboar | 8 | 41 | 16 | 26 | melee | Wereboar |
  | 41 | Dreugh | 16 | 23 | 32 | 27 | melee | Dreugh |
  | 15 | Skeletal Warrior | 9 | 41 | 18 | 27 | melee | Skeletal Warrior |
  | 13 | Harpy | 8 | 50 | 16 | 28 | melee | Harpy |
  | 34 | Dragonling | 16 | 28 | 32 | 30 | melee | Dragonling |
  | 40 | Dragonling | 16 | 28 | 32 | 30 | melee | Dragonling |
  | 18 | Ghost | 11 | 41 | 22 | 30 | melee | Ghost |
  | 16 | Giant | 10 | 46 | 20 | 30 | melee | Giant |
  | 19 | Mummy | 11 | 41 | 22 | 30 | melee | none |
  | 20 | Giant Scorpion | 12 | 46 | 24 | 33 | melee | Giant Scorpion |
  | 42 | Lamia | 16 | 37 | 32 | 34 | melee | Lamia |
  | 17 | Zombie | 10 | 59 | 20 | 34 | melee | Zombie |
  | 21 | Orc Shaman | 13 | 46 | 26 | 35 | melee | Orc Shaman |
  | 22 | Gargoyle | 14 | 50 | 28 | 37 | melee | Gargoyle |
  | 24 | Orc Warlord | 16 | 55 | 32 | 42 | melee | Orc Warlord |
  | 23 | Wraith | 15 | 60 | 30 | 42 | melee | Wraith |
  | 35 | Fire Atronach | 16 | 77 | 32 | 50 | melee | Fire Atronach |
  | 37 | Flesh Atronach | 16 | 77 | 32 | 50 | melee | Flesh Atronach |
  | 38 | Ice Atronach | 16 | 77 | 32 | 50 | melee | Ice Atronach |
  | 36 | Iron Atronach | 16 | 77 | 32 | 50 | melee | Iron Atronach |
  | 25 | Frost Daedra | 17 | 77 | 34 | 51 | melee | none |
  | 26 | Fire Daedra | 17 | 82 | 34 | 53 | melee | none |
  | 27 | Daedroth | 18 | 86 | 36 | 56 | melee | Daedroth |
  | 29 | Daedra Seducer | 19 | 86 | 38 | 57 | melee | Daedra Seducer |
  | 28 | Vampire | 19 | 91 | 38 | 59 | melee | Vampire |
  | 30 | Ancient Vampire | 20 | 100 | 40 | 63 | melee | Ancient Vampire |
  | 32 | Lich | 20 | 100 | 40 | 63 | melee | Lich |
  | 33 | Ancient Lich | 21 | 100 | 42 | 65 | melee | Ancient Lich |
  | 31 | Daedra Lord | 20 | 122 | 40 | 70 | melee | Daedra Lord |

### 2.3 Recruiting

- 300 points (`PointBudget`), at most 12 units (`MaxUnits`), a unit as often as the points allow; the king is free. A
  card clicked recruits (`TryAdd`: refused at 12 units or past the points); an army row clicked is removed; Clear empties
  the army; Auto-fill fills it.
- `AutoFill(army, budget)`, at most 200 rounds while the army is under 12: the units the points left still buy (none:
  stop); while the army holds fewer than two ranged units, one time in two only the ranged among them (if any); two of
  those drawn at random, the dearer kept; added, its cost spent.
- The screen's words: "Click a card to recruit it, or press Auto-fill. Click an army row to remove it. Cost = sqrt(HP x
  Attack), ranged units x1.35."

### 2.4 The deployment (`PlaceArmy`)

- The king on (7, 12). Then the units dearest first (a tie by id): a melee unit takes the next free cell of row 11, else
  of row 10, else of row 12; a ranged unit row 12, else 10, else 11. Each row is taken centre-out (`CenterOut`: 7, 6, 8,
  5, 9 ... 0, 14), row 12 without the king's column. The guest's army is placed the same way and mirrored. Pieces are
  numbered in that order, the host's first.

### 2.5 A turn

- The host moves first. A turn is two actions (`ActionsPerTurn`), each a move, an attack or a potion, by any piece, in
  any order; End turn spends what is left. A command is legal (`IsLegal`) only in its side's turn, with an action left, no
  turn ending and no game over:
  - MOVE: one's own piece to a cell of `GetReachable` - breadth-first over floor, at most 3 steps (`MoveRange`), through
    no piece, never its own cell;
  - ATTACK: one's own piece on a foe in range (`InRange`) - Manhattan distance 1 (melee), or 1 to 4 (ranged,
    `RangedRange`); past 1 a ranged blow needs a sight line (`HasLineOfSight`: four samples a cell along the longer axis,
    each rounded half away from zero (`RoundDiv`); a Wall or a Pillar on any sampled cell but the two ends blocks it);
  - POTION: one's own hurt piece, a potion left (3 a side, `PotionsPerSide`; the innkeeper's side the tier's count). It
    heals the least of 30 (`PotionHeal`) and what the piece lacks.
- A BLOW (`Attack`): attack x (0.8 + 0.4u), u one draw off the game's seeded source (`NextDouble`), at float32, rounded
  half to even, at least 1. A piece at 0 hp or below is destroyed.
- THE TURN'S END, 0.9 s after its last action (`TurnEndDelay`): the side that moved takes its hazards (2.6); after the
  guest's turn the round counts on (from 1) and every even round the hazards tick; the other side's turn begins, two
  actions.
- THE END (`CheckGameOver`, after every blow and every hazard's bite): a side with no king or no piece loses - "The
  innkeeper's king has fallen." / "Your king has fallen." (the opponent's fall read first).

### 2.6 Hazards

- Fire 8, Spikes 6, Poison 5 (`FireDamage`, `SpikeDamage`, `PoisonDamage`). A pair is point-symmetric and of one kind
  (`SpawnHazardPair`: up to 40 tries of c = Rand(0, 15), r = Rand(3, 10); not the centre; both cells floor, no hazard, no
  piece; then the kind, Rand(0, 3)).
- Three ACTIVE pairs at the start (`HazardPairsAtStart`). At a turn's end every piece of the side that moved standing on an
  active hazard takes its damage (`ApplyHazards` - "damage to a piece that ends its turn here").
- Every second round (`HazardSpawnEvery`, after the guest's turn) every warning turns active, and a new WARNING pair is
  laid while the board would hold at most 14 (`MaxHazards`) - "New hazards are appearing. Watch the warning markers." A
  warning hurts nobody until it turns.

### 2.7 The innkeeper

- THE TIERS (`Tiers`), the mod's own words:

  | tier | least stake | points | potions | blunders | blurb |
  |---|---|---|---|---|---|
  | Amateur | 10 | 220 | 2 | 35% | He has had a few drinks and barely knows the rules. |
  | Seasoned | 50 | 300 | 3 | 15% | He plays most nights and knows what he is doing. |
  | Veteran | 200 | 360 | 3 | 5% | A shrewd tactician who rarely makes a mistake. |
  | Grandmaster | 1000 | 450 | 4 | 0% | Legendary across the Iliac Bay. Bring your best army. |

- The tier (`TierFor`) is the innkeeper's faction's: ((factionID x 73856093) ^ 0x127409F) mod 100 as a C# int (the
  product wraps; the remainder is made positive) - under 40 Amateur, under 75 Seasoned, under 93 Veteran, else
  Grandmaster. The innkeeper's army is Auto-filled to the tier's points.
- THE INNKEEPER'S TURN (`AiTurnRoutine`): 1.2 s (`EnemyPause`), then up to two actions 1.2 s apart; an action it cannot
  find ends the turn.
- AN ACTION (`AiAction`) - the first rule that answers:
  1. with the tier's chance, a BLUNDER (`AiBlunder`): a random piece attacks a random foe in its range one time in two,
     else moves to a random cell it reaches;
  2. a potion, while one is held, on the piece with the least health in hand at or below its line (a king a half, any
     other piece three tenths);
  3. a piece on an active hazard that would die of it - or any, on the turn's last action - steps off (`TryEscape`: to the
     reachable cell with no hazard, warning or active, farthest from the player's pieces for a king and nearest for
     anything else, by the player's pieces' walking distances over floor (`PathMap`, `NearestPath`), ties broken by a draw
     in [0, 0.1];
  4. the best blow: attack + a draw in [0, 1], +40 on the player's king, +30 on a foe whose hp is at most the attack;
  5. the best move, scored for each piece and each cell it reaches: a king moves only to get farther when a foe is within
     4 steps (the gain x 5, else -100); any other piece, from a cell that puts a foe in range, 50, +20 with the player's
     king among them, and for a ranged piece + 0.5 x min(its distance from the nearest foe, 20); from any other cell its
     gain in nearness x 3; less 8 for a warning under the cell and 40 for an active hazard; + a draw in [0, 0.1]. Only a
     score above 0 moves.
- Its choices draw from Unity's shared `Random` (unseeded; `Random.value` a float in [0, 1], both ends included - AUDIT
  KG B7); the game's dice - the map, the hazards, a blow - from the game's own `System.Random(seed)`.

### 2.8 The stake

- Against the innkeeper: "He will not sit down for less than" the tier's least stake; the player bets it x 1, x 2 or x 5
  (`StakeMultipliers`) from the purse, taken at "Start battle". A win pays twice the stake ("You collect the pot: your N
  gold back, plus N gold from the innkeeper."); a loss keeps it; LEAVING FORFEITS IT ("Leaving a match early forfeits your
  stake."). A cancelled match (online) gives it back.
- Online: the host offers 0 (friendly), 10, 50, 200, 1000 or 5000 gold each (`OnlineStakes`); the guest accepts or
  declines; each client takes its own stake and pays itself the pot.

### 2.9 Online, the mod's way

- A peer-to-peer lockstep through three PUBLIC MQTT brokers (`BrokerHosts`: broker.emqx.io, broker.hivemq.com,
  test.mosquitto.org) - port 8883 with TLS that accepts any certificate, then 1883 plain - on topics named by the host's
  six-letter room code (`kingsgambit-dfu-v1/<code>/toHost` and `/toGuest`; the code's first letter picks the broker).
  HELLO carries the version (`KG2`) and the roster's signature (`RosterSig`); OFFER and RETRACT the host's stake, ACCEPT
  and DECLINE the guest's answer; ARMY each side's unit ids at Ready; START the seed; CMD each command with a hash of the
  state after it (`StateHash`) - a hash that differs, a gap in the numbering or an illegal command cancels the match and
  returns both stakes; FORFEIT; ABORT. Both clients run the whole game, and each settles its own purse: a client that
  hears nothing from the other for 40 s in a staked battle pays itself the pot (`OnConnectionLost`, "Your opponent
  disconnected.") - whichever link failed, so a broken route pays both clients, and only a peer gone for good loses its
  stake (AUDIT KG C9: this line had said the dropped peer always lost it).

### 2.10 What a player sees and hears

- The army screen's cards (`DrawCard`, 108 x 120): the unit's attack animation looping, its name, level and hp, attack,
  "Ranged", its cost - gold, or red and dimmed past the points.
- The battle (`DrawBattle`): the board in the layout's checker; a piece's DFU sprite by facing (record 0 move, 5 attack,
  10 hurt, 15 idle, 20 a ranged calling's shot; +2 a side, mirrored, +4 north; `InvertedSideFlip` the Ghost and the
  Wraith) on its side's tint (blue 0.2 0.45 0.95, red 0.9 0.2 0.2, at 0.45), a health bar red to green, the king's gold
  outline and "K"; the selected piece yellow; its reach green, its range white, its targets red; the result's banner 1.3 s
  after the end (`ResultDelay`).
- Motion: a walk at 3.5 cells a second (`MoveSpeed`), the lunge 0.28 s (`LungeTime`), the hit's shake and flash 0.45 s
  (`HitTime`), a shot's flight 0.3 s (`ProjectileTime`), a floating number 1 s (`FloatTime`), the heal's glow 0.6 s
  (`HealTime`), the death's fade 0.6 s (`DeathFade`) from 0.27 s after the blow lands; the sprites at 6, 10 and 4 frames a
  second (`MoveFps`, `AttackFps`, `IdleFps` - DFU's own MOVE, PRIMARY_ATTACK and IDLE speeds, `characters/mobile/mobileUnit.js`).
- Sounds - DFU's SoundClips by DAGGER.SND index (FACT: the names `systems/soundClips.js` carries; the rest are unnamed in
  the port and are named from SoundClips.cs by the slice that plays them): win 32 (ArenaFanfareLevelUp), lose 458
  (`systems/arena/arenaSound.js`'s groan), coin 361 (GoldPieces), challenge 300 (DiceRoll), start 78 (DrawWeapon), click 360
  (ButtonClick), potion 365 (MakePotion), death 15 (BodyFall), a hazard's warning 1; a blow's hit 108-112 (Hit1, Hit2 and
  three unnamed), a calling's swing 105, 347, 106 (SwingLowPitch, SwingMediumPitch, SwingHighPitch); an archer's shot 3
  (ArrowShoot) and its hit 4; a mage's spell one of 81-85 and its hit 86; a calling hurt 299; fire 89, spikes 110,
  poison 87; and a monster's own move, bark and attack (ENEMY_BASICS `moveSound`, `barkSound`, `attackSound`).

## 3. The shape - a third game at the card table (DECIDED)

- `Tavern-Cards.md` section 7's refusal - "No card game from a menu. The table is the game" (Mac: "needing to be in a
  tavern"): The King's Gambit is played seated at a tavern's card table - either of its two (section 30 there) - as
  Hold'em and Iliac Hand are, one game a cloth. The Hold'em panel offers **Play The King's Gambit** beside Play Iliac Hand
  (`cardTableHud.js:"if (iliac) actions.push("`'s way), Iliac Hand's panel offers it too, and its own panel offers the
  other two back.
- The mod's two doors are not carried: the HUD's K key (a game anywhere, from a menu) and the tavern window's "Challenge
  the innkeeper" offer (its G key) - the table is the door.
- The opponent offline is a REGULAR in a free chair - the room's own, named, seeded, seated and voiced as at the other two
  games (`Tavern-Cards.md` sections 14 and 18) - not the innkeeper, who keeps the counter. The innkeeper's law moves to
  the regular whole: a tier by the mod's own hash and bands over the regular's seed (2.7), so each regular plays one
  tier every evening, its name and blurb said at the setup; "Care for a game of The King's Gambit?" is the regular's line.
- FACT: the interior host keeps one slot a game (`worldModes.js:"let iliacGame = null;"`, beside Hold'em's `cardGame`),
  each game opening by closing the other, and every road off the seat closing both
  (`worldModes.js:"function standFromCardTable({ cashOut = true } = {}) {"`). The King's Gambit takes a third slot, its
  half in its own module with Iliac Hand's handle (`iliacTableGame.js:"export function openIliacTableGame(d) {"`: press,
  frame, relay, draw, playing, staked, close).

## 4. What ports 1:1 - the law

THE MOD'S is ported the way the doctrine ports DFU: its logic verbatim, its constants and tables byte for byte, the
structure ours.

- THE LAW, `net/kingsGambit.js` (KG1) - pure, DOM-free, ONE HOME for the device and the relay, as `net/iliac/iliacHand.js` is:
  the board and its build, the hazards, the units and the roster, the deployment, the legal commands and their effect, a
  turn's end, the game's end, and each seat's view (KG1 found none to make - section 11). A refused command answers a
  refusal word and changes nothing (a relay keeps the last good state - `net/card/cardLaw.js`'s way).
- THE ROSTER IS DFU's TABLE: the units read `enemyBasics.js:"export const VANILLA_ENEMY_BASICS = deepFreeze("` (DEX1, 2026-10-19: the table's vanilla rows by name, copied before any mod writes one - Daggerfall Enemy Expansion writes its classic lines into the live table, as DFU's EnemyBasics.Enemies is written, and a client reading this module after that would have built another roster; ONE DFU
  MEMBER, ONE EXPORT - never a second literal of the levels and the health), at float32 with RoundToInt's half to even,
  pinned deepEqual against section 2.2's table. DECIDED: the vanilla rows, never a mod's overlay. Meaner Monsters is
  applied at a foe's mint (`applyMeanerMonsters`, `characters/enemy/enemyEntity.js`), not to the table, and one roster for every
  client and the relay is what the mod's own `RosterSig` asked for - two clients whose rosters differed refused to play.
- THE DICE: the mod's `System.Random(seed)` is .NET's own stream; the port draws from the `rand32` it is handed
  (`net/dice.js` drawBelow: Rand(a, b) is a + drawBelow(b - a), NextDouble is rand32 / 2^32) - the same uniform law over
  another stream. No client must agree with the relay's stream (the relay rolls, 5.8). The ORDER of the draws is the mod's
  (BuildMap's, SpawnHazardPair's, a blow's one).
- THE INNKEEPER'S PLAY (KG2), `systems/gambit/gambitPatrons.js`: AiAction, TryEscape, AiBlunder, the tiers and TierFor's
  bands, verbatim; the regular's army through the law's AutoFill (`autoFill`, KG1 - `regularArmy`; AUDIT KG C4). Unity's
  `Random.value` and `Random.Range` are the table's own source (the card table's crypto draw - never DFU's one stream).
- KEPT BUG FOR BUG, each pinned: the Dragonling twice in the roster (rows 34 and 40, one card, one set of numbers); the two
  kings one set of numbers; a king's potion line a half and every other piece's three tenths; hazards biting only the
  side that just moved. Kept too, and pinned as literals alone, because no game can tell either from its fix (section
  11; AUDIT KG A14, C19): the 97% that MapIsPlayable compares at float32, and AutoFill's 200 rounds, which never bind -
  each round buys a unit or stops, so twelve run at the most.
- PINS: deepEqual against the mod's literals (section 2's tables), whole games played through on a fixed `rand32`, every
  number mutation-checked (A PIN MUST FAIL).

## 5. What is rebuilt on our stack - the Iliac Bay card system

### 5.1 The army is a hand of Iliac cards

- THE MOD'S recruit screen is already a grid of unit CARDS (2.10). DECIDED: those cards are the Iliac set's own painted
  faces (`render/iliacCardFaces.js`, the deck builder's tile) - each unit by the card its creature already is (FOE_CARDS:
  a Rat the Rat, the Lich the Lich, the Mage the Mages Guild Apprentice, the Sorcerer the Mages Guild Battlemage) - with
  The King's Gambit's numbers on the panel beside it (level, hp, attack, cost, reach) in place of Iliac Hand's power and
  text, which are that game's. The face is painted without Iliac Hand's cost gem, power shield and rarity frame - a
  picture-only mode of `paintIliacCard`, pinned - so no Iliac number stands beside the gambit's own (AUDIT KG D12:
  `paintIliacCard` paints both on every face, the tile's included; section 14.1).
- FACT: nine of the roster's 46 wear no card (2.2's table): seven monsters with no FOE_CARDS row and no card in
  `net/iliac/iliacCards.js` - the Grizzly Bear, the Sabretooth Tiger, the Spider, the Slaughterfish, the Mummy, the Frost
  Daedra, the Fire Daedra - and the Archer and the Ranger, for whom FOE_CARDS names none. Q3.
- THE ARMY (Q2). DECIDED (section 10.2): the mod's roster whole - any unit, as often as 300 points buy - so every player
  sits down at once and the cards are the units' faces. NOT CHOSEN: an army only of the creature cards the binder holds,
  a card a unit (the collection the barracks). It would bend the mod's balance: the starter deck
  (`iliacCards.js:"export const STARTER_DECK = Object.freeze(["`) fields ten units worth 167 points - two Rats, two Giant
  Bats, two Mages Guild Apprentices, the Spriggan, the Centaur, the Dreugh and the Lamia.

### 5.2 The kings are the Bay's

- THE MOD'S kings are two sprites over one set of numbers (2.2). DECIDED: each side's king is one of the four crowns'
  kings in the deck of the Iliac Bay (`cardFaces.js:"export const SUIT_CROWNS = Object.freeze(["` - Gothryd of
  Daggerfall, Eadwyre of Wayrest, Camaron of Sentinel, Gortwog of Orsinium; the painted royal, the K of the crown's suit),
  with the mod's king's numbers. The player's crown is the player's choice at the setup; a regular's is the regular's
  seed's, never the player's. Q4.

### 5.3 The board is the cloth

- DECIDED: the board is laid on the table's felt. FACT: the felt is 1.42 by 0.92 m inside its rail
  (`cardTableProp.js:"export const CARD_TABLE_RAIL = 0.04;"`, with CARD_TABLE_W 1.5 and CARD_TABLE_D 1), and the prop's
  chairs stand two to a long side, 0.375 m either side of its middle, and one at each end (`world/card/cardTables.js`
  seatSpots).
- DECIDED (AUDIT KG C1): laid ALONG THE TABLE'S OWN AXES, square to the felt's edges, as Hold'em's board lies
  (`cardTables.js` tableFrame's axisYaw), its foot - the host's king's row - at the edge nearest the host's chair: from a
  long side, fifteen columns along it and thirteen rows across, 7.08 cm cells (a board 1.06 by 0.92 m); from an end,
  fifteen columns across and thirteen rows along, 6.13 cm cells. The guest's side is the head, whatever chair the guest
  takes (Iliac Hand's rule for the opponent's side, which "still lays its side opposite"); each viewer reads the board
  from its own chair (the lean, 10.7). NOT CHOSEN: Iliac Hand's lay, square to the line from the cloth's middle to seat
  0's chair (`iliacCloth.js:"export function iliacPlaces(frame, seat0, seat1, viewer = 0) {"`, AUDIT CARDS-6 B3), which
  this record had cited as the line between the two chairs: a long-side chair's line is 23.8 degrees off the table's
  short axis, and a board square to it lies askew on the felt in 5.13 cm cells. MEASURE (KG4): the cell from the chair.
  KG5 says where a guest's chair stands (the head faces the guest only across from the host).
- Its ground painted in code, in the layouts' own tones (the law's `floor`): each layout's two tones in a checker (2.1);
  every mark laid over it - a side, a selection, a reach, a number - is the house's coat (section 14.8); a wall a stone block a
  cell square and a few centimetres high, the mod's courses and lit top edge painted on it; a pillar a column; water a
  recessed blue with the mod's two drifting ripples; the whole a mat a few millimetres proud of the felt. THE ART IS OURS:
  no ARENA2 pixel in the board.
- Hazards: the mod's drawn effects (`DrawHazard` - what the shipped mod shows when its particles fail, and near enough
  what its blobs show when they do not): fire's base and three flickering flames, spikes' six spikes, poison's rising
  bubbles, a warning's pulsing outline and "!".
- THE PRESS IS A CELL: a press on the cloth reads the table point under it (`world/card/cardHand.js` tablePoint, CARDS3b) as a
  cell - the mod's OnCellClicked: select one's own piece, move to a lit cell, attack a ringed foe; the panel holds the
  rest. CARDS-TOUCH holds: a seated finger is the table's (`Tavern-Cards.md` section 31). Under a finger a press snaps to
  the nearest piece or lit cell and stages before it spends, and the keys and the pad reach every cell (section 14.3;
  AUDIT KG D6, D18: a column is 26 px at best on a phone held upright).

### 5.4 The pieces (Q1)

- DECIDED (section 10.1): a piece is its unit's card standing in a stand - the Iliac plate (`render/iliacTableDraw.js`'s
  atlas and `render/cardTableDraw.js` plateModel) at a cell's size, about 4.5 by 6.3 cm on a 7 cm cell, upright on a small
  turned base in its side's tone and shape (section 14.8), its face to both players alike (a standee's two faces); the
  king's base brass and its card the crown's painted King. The mod's motion is the stand's (10.1: the walk along its
  path, the blow's tip, the shake, the glow, the fall to its owner's fallen pile); its hp a bar over the card's top edge.
  Every timing is 2.10's. It is the card system's own picture, painted in code, and the cards lab can show and probe it
  without ARENA2. (AUDIT KG C2: this paragraph had kept the proposal's bar on the base and its fade, which 10.1 replaced.)
- NOT CHOSEN (section 10.1): the creature's own DFU sprite as an animated miniature - the mod's look. FACT: the
  port can draw it with what it has - a billboard batch per figure (`renderer.createBillboardBatch`, `drawBillboards` in
  the interior's pass, lit by the room as every foe is), its frames uploaded off the player's own ARENA2 at runtime
  (`scenes/dataPipeline.js` uploadRecordFrame), DFU's records by facing (`characters/mobile/mobileUnit.js`), sized by
  `world/rmbFlats.js` mobileBillboardSize scaled to the cell. `Tavern-Cards.md` 6.2 bars ARENA2 art as a CARD's picture,
  not as a piece's; A RENDER OF GAME DATA IS GAME DATA bars committing it, which a runtime read never does. It is the
  mod's picture, not the card system's, and nothing here can see it without the player's ARENA2. Its module would be its
  own: the card painters' imports are pinned (`render/iliacCardFaces.js` reads only the loot's rarities and the Bay's
  faces).
- The kings follow the pieces: the cards standing, so the Bay's Kings (5.2, section 10.4).

### 5.5 The panel

- Iliac Hand's two halves (`ui/iliacTableHud.js`): a pure model, pinned, and a painter - `ui/gambitTableHud.js`,
  `gambitHudModel` and `createGambitTableHud`. THE SETUP: the regulars in the free chairs (what makes each tier hard, and
  what is left of each one's night), the stake's three picks and what each wins or loses, the crown; THE ARMY: the grid
  of the cards (cost in points; the points left; the units held; Auto-fill, Clear; a visible Remove), the unit last
  pressed shown large, the king's line; THE TURN: the actions left in pips and in words, the round, both sides' potions,
  End turn, Forfeit (two presses); the information box, filled by a press as by a hover; the log; the result. Every
  surface, line and number is section 14's (AUDIT KG D2-D23).
- Not the native-window rule's - no DFU window stands behind it (`Tavern-Cards.md` section 14) - and no free style
  either: it wears the card tables' kit (`ui/card/cardPanelKit.js`, CARDS-PLUS), and the stone-and-brass kit paints it by
  role, as every Enhanced Plus screen (section 14.1). Its words are
  ours, plain, through the text core (14.4, 14.6); the mod's (section 2) are its record, never the screen's.

### 5.6 Sound

- The mod's clips (2.10), each by its number - and THE TRAP: `scenes/world.js` installs PEERFX1's one-shot observer, and
  `net/peer/peerFx.js` isHurtClip reads clips 108-112 at volume exactly 1 as the player struck, told to the room. The mod plays
  its hits at volume 1 through PlayOneShot, so a verbatim port would tell every peer the player was hit at each blow on
  the cloth. DECIDED: the table's sounds are played at the table (`audio.play3d` at the cloth, as the room's other sounds
  are), never through the observed flat one-shot.

### 5.7 The stake

- Offline: real gold, the purse's (Mac's "Real gold", `Tavern-Cards.md` section 9 Q3): the tier's least x 1, x 2 or x 5,
  taken at the deal and held by the table; a win pays twice it; a loss and a forfeit - every road off the seat while a game
  is under way - leave it. The save waits while a stake is down, at both of `scenes/world.js`'s doors that already hold
  Hold'em's chips and Iliac Hand's card (`world.js:"if (modes?.iliacStaked?.()) { if (!quiet) townTalk.say("` in
  worldQuickSave, and the pause's savingPrevented); a load's road settles nothing (the save predates the deal).
- DECIDED, a departure: a regular's purse is a night's, as Hold'em's regulars' are (`Tavern-Cards.md` section 16, AUDIT
  CARDS-2 H2's book): a regular who has paid a night's purse plays for fun until tomorrow. The mod's innkeeper pays
  without end - and the Amateur, who blunders 35% of its actions, takes a bet of five times its least stake every game, so
  one table would mint gold for as long as a player sat at it. Decided at 10.7 (fifteen times the least stake a day),
  and measured at KG2 (section 12): the bound stands.
- A realm character or an online page plays the regulars for fun (`Tavern-Cards.md` section 14's law: a regular's gold
  paid on the client is a faucet the realm service never sees).

### 5.8 Online - the relay runs the game

- REFUSED: the mod's link. It publishes every move through public brokers, over TLS that accepts any certificate, on
  topics any holder of a six-letter code can read; both clients run the game and each settles its own purse on its own
  word. `Tavern-Cards.md` section 7 holds: no client-dealt card online, ever - the relay deals, or nobody plays.
- DECIDED (KG5): a King's Gambit table in the relay beside Hold'em's and Iliac Hand's, its law `net/kingsGambit.js` in the
  relay's bundle (with `characters/enemy/enemyBasics.js`, 46 KB of data, and `systems/mathf.js` - the relay's graph pin,
  `test/net/relayversion.test.js` RELAY_GRAPH, gains both). A room keeps its tables at the cloth's index - one
  game a cloth, each game's sit refusing while either other game holds that index ('other game'). Two seats; each army
  told to the relay at Ready and to the other seat only when both are (the mod's ARMY at Ready); the relay builds the board
  and rolls every die from its own CSPRNG; a command is the law's (refused in words when not); the room told every event,
  so the tavern watches the board. A turn clock - the mod has none (its peer timeout 40 s) - MEASURE (KG5), first guess 60
  s (section 10.7; Iliac Hand's is 45 s, `iliacTable.js` ILIAC_TURN_MS - AUDIT KG C3: this line had kept that as the
  guess); a stand or a socket gone forfeits (the mod's FORFEIT). Friendly - no gold. A stored table's state is checked
  when the room loads it, and one the law did not mint is dropped: the law's steps trust the state they are handed, and
  throw on a malformed one (AUDIT KG A4).
- FACT, the seams it takes (Iliac Hand's, one by one): a storage key and a `Map` a room; a `parseClient` arm named in its
  doc; a frame cap and a gate bucket of its own; the relay's version bumped - its law row, the bundle's module list, and
  the pins that name the version (`wire.js:"export const ILIAC_RELAY_MIN = 182;"` is the minimum's pattern); the client's
  send, its welcome gate and its frames in `net/online.js` and `scenes/world.js`; the alarm, the socket's close and the
  room's sweep.
- BUILT (KG5, section 18): every seam above, the table's law `net/gambit/gambitTable.js`, relay world204.
- BUILT (KG6, section 19): the gold table through CARDS6's escrow (an arm of its own in `server-account/src/cards.js`,
  AUDIT KG C24), and the season board with its GRANDMASTER (CARDS10's, the Arena's way).

### 5.9 THE FOUR HOSTS

- `scenes/worldModes.js` (interiors): the slot, the cloth, the panel - wired at KG3. `scenes/world.js` and
  `scenes/exterior.js` mount it through `createWorldModes`; `world.js` hands it the relay's hooks and asks it, at both save
  doors, whether a stake is down (`modes?.iliacStaked?.()`'s way - AUDIT KG C23), `exterior.js` none (its taverns' tables play offline,
  `Tavern-Cards.md` section 22). `scenes/dungeonContext.js` stands no tavern: FLAGGED by name in each slice's record.

## 6. What the record refuses

- A game from a menu or a key (the mod's K and G).
- A client-run game online, a public broker, a purse settled on a client's word.
- ARENA2 art committed or derived (A RENDER OF GAME DATA IS GAME DATA): the board and the cards are painted in code; the
  sprites NOT CHOSEN at 10.1 would have been the player's own, read at runtime and never written down.
- Anything bought with money.

## 7. The house's rules, met in advance

- THE SLOT IS EMPTIED BEFORE THE OCCUPANT IS TOLD: the game's slot nulled before its close runs (`closeIliacGame`'s way).
- EVERY ALLOCATION HAS AN OWNER: the board's mat, its blocks, the standees' plates and the atlas made when the game opens
  and freed when it closes.
- A PIN MUST FAIL and TEST THE SHAPE THE PRODUCER MINTS: pins over the law's own states and the session's own view, never
  hand-built literals; every pin mutation-checked.
- ONE DFU MEMBER, ONE EXPORT: ENEMY_BASICS, FOE_CARDS, SUIT_CROWNS and the card painters imported, never copied.
- ASYNC NEVER DROPS: the relay's frames folded into one view, a word on its way said again (Hold'em's and Iliac Hand's
  client mirrors).
- A SLICE CLOSES ITS LEDGER ROW: each slice opens or narrows its section A row.
- THE CARD TABLES' KIT BY ROLE (AUDIT KG D1-D4, D23): the panel wears `ui/card/cardPanelKit.js`'s chrome, as Hold'em's and
  Iliac Hand's do (CARDS-PLUS), and the stone-and-brass kit paints its every surface by role (`ui/enhanced/enhancedFrame.js`
  FRAME_ROLES; PLUS-DRESS), in the pixel face (FONT1), at the type floor (FONT3) - 14.1, 14.2.
- A FINGER HAS NO HOVER, AND IT IS 44 PX: what a hover says a press says; every press a finger's size on a phone (Plain
  Words law 5; U51) - 14.3.
- PLAIN WORDS: what it is before its numbers, the next step, how it works, its words - every number the law's (Plain
  Words laws 1-4) - 14.4.
- COLOUR NEVER ALONE: a side, a reach, a range and a target told by shape and by words as well (AUDIT PRE-MERGE 1003
  U7) - 14.8.

## 8. The slices

Each ships alone and is verifiable without the next.

| Slice | What it builds |
|---|---|
| **KG1** SHIPPED (section 11) | THE LAW: `net/kingsGambit.js` - the board and its build, hazards, units and roster, the deployment, the turn, a blow, potions, the end (a seat's view: none to make, section 11); pins deepEqual against section 2's tables, whole games on a fixed source, mutants. |
| **KG2** SHIPPED (section 12) | THE INNKEEPER'S PLAY: `systems/gambit/gambitPatrons.js` - AiAction, TryEscape, AiBlunder, the tiers over a regular's seed, the regular's army by the law's AutoFill (AUDIT KG C4). MEASURE: each tier against an Auto-filled 300 over seeded games. |
| **KG-SET** SHIPPED (section 15) | The nine creatures painted into the set (section 10.3) - cards, emblems, Iliac Hand's numbers and text, FOE_CARDS rows (so their foes drop them, CARDS9), Iliac Hand's balance measured again; a relay version (the catalog is relay law). Before KG3, whose grid shows every unit's card. |
| **KG3** SHIPPED (section 16) | THE EVENING OFFLINE: the session (the mod's clock - the 0.9 s turn's end, the 1.2 s pauses, the 1.3 s result), the host's slot, the panel (setup, army, turn, result) to section 14 - in the card tables' kit (`ui/card/cardPanelKit.js`, CARDS-PLUS) and the roles, the face, the type, the finger, the keys, the four plain-words blocks, the phone - with its pins (14.9), the stake and the regulars' night's purse; the panel's words through the text core, `t(key, en)`, each new key with its drafts in the thirteen whole languages (L10N6's rule, the twelve drafting owing them - section 16.5; the law keeps keys, section 11); the board a flat mat with the pieces as their cards and the press as a cell, staged under a finger (14.3; AUDIT KG C13: the press had been KG4's alone, and the game cannot be played without it) - the first playable game. The mod vendored as it ships (its manifest, its IL, a README with its provenance and the owner's word - Q6) with its registry row, its credit and its Features row: the credits' test holds a credited mod to a Features row, which only the playable game has. |
| **KG4** SHIPPED (section 17) | THE BOARD ON THE CLOTH: walls, pillars and water built; the hazards' drawn effects; the pieces' motion; the press on the built board (14.3); the cloth's marks in the house's coat (14.8); the lab (`cards.html` with a King's Gambit table) and its probes - the panel's at a desktop's and a phone's size (`tools/cardPanelsProbe.mjs`, the three panels' one probe - 14.9); the frame cost on the phone probe, as CARDS3c measured it. |
| **KG5** SHIPPED (section 18) | ONLINE: the relay's table (a relay version), the wire, the client's mirror, spectators, the clock; friendly. |
| **KG6** SHIPPED (section 19) | Gold tables online (the realm's escrow) and a season board with its title (section 10.7). |

## 9. Questions for the owner (ANSWERED 2026-10-13 - section 10)

1. **The pieces.** The units' cards standing on the board (the proposal, 5.4) - or DFU's animated monster sprites as
   miniatures (the mod's look)?
2. **The army.** The mod's free roster, the cards its faces (the proposal) - or only the creature cards the binder holds?
3. **The nine with no card.** Paint them into the set (KG-SET, the proposal) - or leave them out of the roster?
4. **The kings.** The Bay's four crowned kings (the proposal) - or the mod's Knight and Barbarian?
5. **The opponent.** A regular in a free chair, the innkeeper's tiers moved to the regulars (the proposal) - or the
   innkeeper at the table?
6. **The mod's author and permission.** The bundle names no author and carries no licence; the registry records the
   owner's word for a mod handed over, as it did for the environment mods, and the author's own when it comes.

## 10. THE DECISIONS (2026-10-13)

The owner, answering section 9: **"Make the best and most detailed decisions. We also have permission"**. Every DECIDED
of sections 3-8 binds the slices as written. Section 9's six are answered here, each with its reasons, and so is every
point the record had left open. A number marked MEASURE is the first guess its slice measures before it ships.

### 10.1 The pieces - THE CARDS STANDING (Q1)

- WHY: the ask was the card system, and a standing card is that system's own piece. THE ART IS OURS holds without an
  exception: no ARENA2 pixel reaches the board, and the cards lab can show and probe every piece in CI, which no piece
  read off the player's ARENA2 allows. It uses the plate, the atlas and drawMesh, whose frame cost on a phone CARDS3c
  already measured. The mod's motion carries over to a stand whole (below). The sprites stay what 5.4 records - feasible,
  and not chosen.
- THE PLATE: the Iliac card's own (`render/cardTableDraw.js` plateModel over the Iliac atlas), scaled to its cell - 0.64
  of a cell wide (4.5 cm on a 7.08 cm cell) at the card's own 63:88 shape (6.3 cm high) - with the face painted on BOTH
  sides, as a standee is: every face is read from both chairs.
- THE STAND: a turned disc 0.84 of a cell across and 6 mm high, in its side's tone and shape - the host's (the
  player's, offline) the kit's bone, the guest's its dark stone, light against dark as a board's two sides are, and the
  guest's rim notched; a king's disc brass, ringed in its side's tone; every disc edged in the kit's outline and a bone
  line (AUDIT KG D19, D20, section 14.8: the mod's blue and red, which this line had carried, read as one grey, 1.00:1).
  The card stands upright in a slot across the disc's middle, square to the board's rows.
- ITS HEALTH: a bar over the card's top edge, turned to the viewer: the kit's meter - its well, its fill banded like the
  vitals (`meterFill`), its length the value (AUDIT KG D20: the mod's red-to-green fill says it by colour alone).
- SELECTED: the disc's rim ringed in brass, the kit's selection (the mod's yellow outline not carried); the selected card
  lifts 1 cm.
- ITS MOTION, at 2.10's timings: the walk slides the stand cell to cell along the path the move took (each step's cell in
  turn - never a straight line through a wall) at 3.5 cells a second - the port's own: the mod slides each axis straight
  at the new cell (MoveTowards), through whatever stands between; the law's move event carries its two ends, so KG4
  walks GetReachable's first-met path on the state before the move (AUDIT KG C22); a blow tips it toward its foe and back
  (the 0.28 s lunge, at its height 0.15 of a cell for a melee blow and 0.06 for a shot - the mod's lungeDir of 0.5 and
  0.2 times its 0.3; AUDIT KG C8: this line had doubled both); a hurt card shakes 0.45 s (the mod's jitter, scaled to the
  cell; none under reduced motion) and its face flashes red; a potion's 0.6 s glow is green; a destroyed card topples flat away from its attacker
  0.27 s after the blow lands, then slides to its owner's FALLEN PILE beside the board (the Hold'em muck's way) - the
  mod's 0.6 s fade becomes the fall and the slide, and the piles count the losses at a glance.
- THE MUSTER: the armies come onto the board as cards are dealt - the king first, then every unit in the deployment's own
  order (2.4) - each thrown from its owner's edge onto its cell (Iliac Hand's throw, `ILIAC_THROW_S`) and stood up in its
  stand. MEASURE (KG4): the beat between throws, first guess 0.12 s.

### 10.2 The army - THE MOD'S ROSTER WHOLE (Q2)

- WHY: the mod's balance is its roster's - its tiers field 220, 300, 360 and 450 points against the player's 300 from the
  same 46 units. A new character sits down at once (the starter deck's own principle, `Tavern-Cards.md` 6.3). Two seats
  online meet on equal armies; a binder army would make a collection a strength at a table that plays for gold. The
  collection already has its game in Iliac Hand; here its cards are the units' faces.
- THE GRID: all 46 units as their cards, in the mod's order (cost, then name; the two Dragonlings by id - the mod left
  their order to .NET's unstable sort), each tile the card's face (picture-only, 5.1) with the unit's name and numbers
  under it - level, health, attack, melee or ranged - and its cost in POINTS, never gold; a unit the points or the twelve
  refuse stays pressable and says why when pressed, its cost in the dim (section 14.5; AUDIT KG D11: the mod's DrawCard
  drew the cost in a gold colour, at a table that takes a gold stake, and a refusal red and dimmed - a colour and a fade
  alone). Within one cost, the names the player reads (getLocalizedEnemyName) order the grid, as the mod's did; the law's
  roster keeps DFU's English order, one roster for every client and the relay (AUDIT KG A15).

### 10.3 The nine - PAINTED INTO THE SET (Q3; KG-SET, before KG3)

- WHY: the mod's roster stays whole, no unit dropped. Every textured monster of DFU then wears a card (the Horse has no
  texture and no unit). Seven foes that dropped no card drop their own (CARDS9's "a rat drops a rat", completed), and the
  Archer and the Ranger drop theirs.
- THE NINE, as cards of the set. Each effect below is a valid record of Iliac Hand's language (`fxRefusal` answers null for
  every one), and its words are exactly what `fxText` says of it. Iliac Hand's numbers are MEASURE at KG-SET: its 3,000
  random games and the regulars' win rates are run again, and the curve (`net/iliac/iliacCards.js`'s header) is held.

  | id | card | tier | cost | power | tags | emblem | text | flavor |
  |---|---|---|---|---|---|---|---|---|
  | `grizzly-bear` | Grizzly Bear | common | 3 | 5 | beast | bear (new) | End of turn: this loses 1 power. | It comes down the Wrothgarian pass at a charge, and it does not charge twice. |
  | `sabretooth-tiger` | Sabretooth Tiger | common | 3 | 4 | beast | cat (new) | Reveal: the strongest enemy unit here loses 1 power. | It goes for the biggest throat in the hall. |
  | `spider` | Spider | common | 2 | 2 | beast | spider (new) | Ongoing: enemy units here that cost 1 or 2 have -1 power. | The small walk into its web; the large walk through it. |
  | `slaughterfish` | Slaughterfish | common | 1 | 3 | beast, sea | fish (new) | End of turn: this loses 1 power. | Out of the water, it has one good bite in it. |
  | `mummy` | Mummy | magic | 4 | 4 | undead | mummy (new) | End of turn: your weakest undead unit here gains +1 power. | Wrapped for the long dark, and patient in it. |
  | `frost-daedra` | Frost Daedra | rare | 5 | 6 | daedra | frost | Reveal: enemy units here lose 1 power. | Where it walks, the ale freezes in the cup. |
  | `fire-daedra` | Fire Daedra | rare | 5 | 6 | daedra | fire | Reveal: the strongest enemy unit here loses 2 power. | Its blade was forged in the Deadlands, and it is burning still. |
  | `archer` | Archer | common | 2 | 2 | human, warrior | bow (new) | Reveal: the weakest enemy unit here loses 1 power. | One arrow, for the one who cannot dodge it. |
  | `ranger` | Ranger | magic | 3 | 3 | human, warrior | bow | Reveal: the strongest enemy beast unit here loses 2 power. | The wilds have one law, and the ranger keeps it. |

- AUDIT KG C21: the Grizzly Bear had been the Dreugh's twin - 3, 4, common, the same Reveal, a beast's copy of a sea
  card - and is a 3/5 that tires now, the Slaughterfish's 1/3 and the Zombie's 2/4 one step up (its effect checked as the
  table's others are: `fxRefusal` null, `fxText` its words). KG-SET moves `test/systems/loot/cards8_catalog.test.js`'s pins: the
  cost-1 list (the Slaughterfish joins it), the kinds' and tiers' counts, the CARD_EMBLEMS literal and the digest.
- THE REST OF KG-SET: six emblems painted in code (bear, cat, spider, fish, mummy, bow - `render/iliacCardFaces.js`, the
  painter's keys pinned equal to `CARD_EMBLEMS`); FOE_CARDS rows for mobile types 4, 5, 6, 11, 19, 25, 26, 141 and 142;
  the cards in the house's packs and the regulars' decks by their tags; their worth by tier (`net/card/cardWorthLaw.js`); and a
  relay version, because the catalog is relay law.
- FOUND AT KG-SET (section 15): the set's words had no road to a player's language, and L10N4's ratchet would not let
  the nine's be written in English beside the others'. A card's rules and flavor are the display's now
  (`systems/iliac/iliacCardWords.js`, through the text core); the catalog keeps the rules and the names.

### 10.4 The kings - THE BAY'S FOUR (Q4)

- WHY: the pieces are cards, and the Bay deck's royals are the card system's own kings (CARDS-BAY's painted busts). The
  mod's Knight and Barbarian were two sprites over one set of numbers, so nothing of the rules moves.
- THE FOUR: Gothryd (Daggerfall), Eadwyre (Wayrest), Camaron (Sentinel), Gortwog (Orsinium) - the K of each crown's suit
  (`render/cardFaces.js` paintFace), stood like the units on the brass disc. The numbers are the mod's king's: level 8,
  70 hp, attack 16, melee, free. A king is said "{name}, King of {crown}" through the text core, off SUIT_CROWNS - never
  `cardTitle`'s English, nor the law's KG_KINGS names, the Knight and the Barbarian, the mod's classes, kept for the
  law's numbers alone (AUDIT KG D22).
- THE PLAYER'S CROWN: chosen at the setup from the four, and kept on the character (`gambitCrown` on the save, restored
  as one of the four or Daggerfall); Daggerfall the first time, the game's own crown.
- A REGULAR'S CROWN: their seed's (the four in the deck's suit order - Orsinium, Sentinel, Wayrest, Daggerfall - by the
  seed mod 4); when it is the player's, the next round that order.
- ONLINE: each seat brings its crown; the guest's, when it is the host's, becomes the next round the deck's order.
- THE WORDS (section 14.5; AUDIT KG D10): "Your king: Gothryd, King of Daggerfall - free. If your king falls, you lose."
  - no pronoun guessed, the mod's "Protect him!" not carried; the end's line one pattern with the regular's name its
  argument ("{name}'s king has fallen." / "Your king has fallen."), never a name glued to translated words; the log says
  the fall ("Eadwyre, King of Wayrest, falls.").

### 10.5 The opponent - A REGULAR (Q5)

- WHY: the table already has its people - named, seeded, seated in their chairs and voiced (`Tavern-Cards.md` sections
  14 and 18) - and the innkeeper keeps the counter and the rooms.
- THE CHOICE IS THE DIFFICULTY: the setup lists the regulars in the table's free chairs, each with their tier's name,
  what makes it hard - the points fielded, the potions, how often the regular blunders, the least stake - and what is
  left of the regular's night (section 14.5; AUDIT KG D13: a name and a blurb told a player nothing to choose by), and the
  player picks whom to challenge. The tiers' blurbs are said round the tier, never "He" (AUDIT KG D10: the regulars are
  of both genders, `scenes/worldModes.js` regularSeeds). A tavern's regulars decide which tiers it offers, the same every evening:
  one regular in about fourteen is a Grandmaster (the mod's band, 93-99), so about three tables in ten with five free
  chairs seat one - "Legendary across the Iliac Bay".
- THE TIER: the mod's own hash and bands over the regular's seed (2.7; `TierFor`'s arithmetic on an int32).
- THE REGULAR'S ARMY: Auto-filled to the tier's points at each deal, from the table's own source - a fresh army every
  game, as the mod's.
- THE REGULAR'S VOICE: "Care for a game of The King's Gambit?" over their head as the setup opens (CARDS4b's bark
  layer), and a word at a win and at a loss. MEASURE (KG3): the lines. MEASURED (KG3, section 16.2): the invitation the
  mod's own line; at the end one of three lines a side, by a roll.

### 10.6 Permission (Q6)

- ANSWERED (the owner, 2026-10-13): "We also have permission". Written where the registry keeps it when the mod is
  vendored (KG3): the permission cell reads "granted (the owner, 2026-10-13: "We also have permission")". The manifest
  names no author, so the README keeps the registry's placeholder for the author's own words (RECORD OPEN) until the
  owner records them, as the environment mods' do.

### 10.7 What the record had left open, decided

- THE LEAN: a battle is played from the seat leaning over the board. The seated eye moves forward over the player's own
  edge of the board and up, and pitches down until the whole board is in view; the setup, the army and the result keep the
  seat's own view. MEASURE (KG4), by the lab's probe at a desktop's and a phone's aspect - first guess, over the board's
  middle column: the eye 0.10 m back from the board's near edge and 0.62 m over the felt, pitched 55 degrees down, which
  keeps the board's whole 0.92 m in view at the default 65-degree field of view (any pitch from 48 to 63 degrees does).
  AUDIT KG C14: the first guess, 0.30 m in and 52 degrees, left the player's own four nearest rows under the eye, out of
  view. A phone held upright sees some 33 degrees across at that field of view - too little for the board's 1.06 m at
  that height - so its lean, and the panel's strip kept clear of the board (14.7), are the probe's to find.
- THE STAKE: the tier's least stake x 1, x 2 and x 5 (the mod's three buttons), each pressable and saying why when the
  purse, or the regular's night, will not cover it; what the stake wins and loses said under the picks before it is put
  down; a purse short of the least reads it on the next-step line - "{name} will not sit down for less than {stake} gold.
  Come back with more, or choose another regular." (section 14.5; AUDIT KG D10, D13, D14: a disabled press says nothing,
  and the mod's line called every regular "He").
- A REGULAR'S NIGHT: a regular pays out at most 15 times the tier's least stake a game day, net of what they won back -
  three wins at the highest bet: Amateur 150, Seasoned 750, Veteran 3,000, Grandmaster 15,000 - and past it plays for
  fun until tomorrow. It is a book on the character's save (`gambitPurses`), bounded as the Hold'em regulars' book is (24
  taverns, the oldest day first out). MEASURE (KG2, KG3): the bound, against the tiers' measured win rates. MEASURED
  (KG2, section 12, and again at AUDIT KG's measure): THE BOUND STANDS. It binds where a player is the stronger - a
  careful player nets about 49 gold a game off an Amateur at the highest bet (150 a day in some three games) and about
  118 off a Seasoned regular (750 in some six or seven) - and nowhere else: a Veteran takes a careful player's 279 a game
  on average, a Grandmaster 3,585. A game the rules leave undecided - the two kings alone, or armies still standing at
  200 rounds - counts as no gold either way; at the table the player ends it, by a win or by a forfeit (AUDIT KG B9).
- THE SAVE: refused while a stake is down, at both of `world.js`'s doors (worldQuickSave and the pause's savingPrevented).
- THE BEATS: the mod's own - 0.9 s to a turn's end, 1.2 s for the regular's pause before and between actions, 0.55 s
  between an online opponent's two actions, 1.3 s before the result's banner.
- THE CLOCK: none offline (the mod's). Online (KG5), 60 s a turn: an expired turn ends as End turn does, and three running
  stand the seat up and forfeit it (Iliac Hand's idle law). MEASURE (KG5).
- THE HIGHLIGHTS, on the mat 1 mm above it, in the house's coat and told by shape (section 14.8; AUDIT KG D19, D20: the
  mod's green reach and white range read 1.13:1 against each other, its targets' red 1.18:1 on the Pillared hall's
  floor): a selected piece's reach a filled wash, its range an outline alone over the cells a blow or a shot reaches, its
  targets the warn role's blood ring with a sword. A press on any piece shows its range, as the mod's hover does - a hover
  may preview it, a finger has none.
- THE NUMBERS: a blow's or a bite's number rises 0.8 of a cell over 1 s above its cell (the mod's float), signed - "-8" a
  loss, "+30" a heal - in the pixel face with the HUD's hard outline all round, painted from a glyph strip in code (AUDIT
  KG D19: the mod's tints told a loss from a heal by colour alone, and its loss read 1.61:1 on the Moat and bridges'
  light floor).
- THE SHOT: four bright squares on the line from the shooter to its target over 0.3 s (the mod's trail), at a card's
  mid-height.
- THE LOG: our sentences, a line an event of the law, tabled before KG3 builds them (section 14.5); the last 12 lines -
  the port's own: the mod's AddLog keeps two (AUDIT KG C15).
- THE TUTORIAL: The King's Gambit's own page in the tutorial catalogue (TUT1), shown at the first game from inside the
  panel's own painter, its words read lazily through the text core, with no number and no old game's name (the catalogue's
  pin refuses "Daggerfall", so the page names no crown); the 'tavern-cards' page names the third game (section 14.5;
  AUDIT KG D21, C16).
- THE FEATURES ROW: "The King's Gambit" on the Gameplay tab, on by default (MO1, "All mods should be enabled by
  default"); switched off, no table offers it. FOUND AT KG3 (section 16.5): no Gameplay tab holds a Features row - it
  stands on the World tab beside Windmills, titled as every mod's row is, "The King’s Gambit by Unnamed
  (thekingsgambit.dfmod)". The bundle ships no settings file, so the row is declared for the mod by
  id, as Windmills' is (WM3; AUDIT KG C18).
- THE CREDIT: `ui/credits.js`'s mods - The King's Gambit, its author as the owner names them, and until then the credits'
  own unnamed form (`credits.author.unnamed`: CR1 asks every row for an author - AUDIT KG C17), "permission granted".
- THE TABLES: offline, both of a tavern's tables play it. Online (KG5), the green table: the red one is the realm's gold
  table, which plays The King's Gambit only once KG6 brings gold.
- KG6: gold online through CARDS6's escrow at the red table, at the mod's online stakes (10, 50, 200, 1,000 and 5,000
  each), the winner's receipt carrying both stakes; and a season board the Arena's way, its Elo and its caps, whose #1
  over 10 games against 5 foes (Iliac Hand's champion's floor) wears GRANDMASTER - the mod's highest tier's name.
- THE ORDER OF THE SLICES: KG1, KG2, KG-SET, KG3, KG4, KG5, KG6 (section 8).

## 11. KG1 (2026-10-13): the law

The owner: **"Make the best and most detailed decisions. We also have permission"** - and the first slice after them.

- **THE LAW** (`net/kingsGambit.js`): pure, DOM-free and plain data, importing only `characters/enemy/enemyBasics.js`,
  `net/dice.js` and `systems/mathf.js` (Unity's RoundToInt), so the relay can carry it at KG5. Every member of section
  2's game is one of its exports:
  - the board: `buildMap` (BuildMap - its layouts `KG_LAYOUTS` and `KG_OPEN_FIELD`, RandomChunks, PlaceWallCell, SetTile,
    SpawnHazardPair), `mapIsPlayable`, `pathMap`, `tileAt`, `isPassable`, `blocksSight`;
  - the units: `makeUnit`, `KG_ROSTER`, `rosterUnit`, `KG_KINGS`;
  - the armies: `armyCost`, `armyRefusal` (ParseArmy's law), `canRecruit` (TryAdd's), `autoFill`;
  - the dice: `nextDouble` (NextDouble), `checkedRand32` (the source, checked - AUDIT KG);
  - the deployment: PlaceArmy, inside `newGambit` (BeginMatch), with `KG_CENTER_OUT`;
  - the turn: `gambitRefusal` (IsLegal), `gambitAct` (Apply and SpendAction), `reachable` (GetReachable),
    `targetInRange` (InRange), `foesInRange`, `hasLineOfSight`, `roundDiv`, `blowRoll` (Attack's roll);
  - its end: `finishTurn` (FinishTurn, ApplyHazards, HazardTick, CheckGameOver).
- **ITS FRAME IS THE HOST'S** (section 4): side 0 the host, who moves first, at the foot; side 1 the guest, mirrored. A
  client turns the picture, never the law.
- **THE DICE**: a `rand32` handed in - Rand is drawBelow's, NextDouble rand32 / 2^32 - drawn in the mod's order. The
  source is checked (`checkedRand32`): a 32-bit draw, and at most `KG_RAND_DRAWS_MAX` of them a step. A broken one deals
  no game, takes no blow ('rand') and fills no army: Auto-fill draws through the check too, and answers null (AUDIT KG A2:
  it had drawn from the source as handed, and one stuck where drawBelow throws every draw back spun it for ever).
  Unity's Random.value - Auto-fill's lean - is NextDouble at float32, compared with the C#'s 0.5f (AUDIT KG A1: the lean
  had been compared at float64, so the 64 raw draws 2147483584 to 2147483647, which round up to 0.5f, leaned where the
  mod does not).
- **EVERY STEP A NEW STATE**: `gambitAct` and `finishTurn` answer `{state, events}` or `{refused}`, and never touch the
  state they were handed (a structuredClone, cardLaw's way), so a refused or broken step changes nothing and the relay
  can keep its last good state.
- **ONE HOME, AND NAMES OF ITS OWN** (AUDIT 24's gate, `test/systems/talk/audit24_onehome.test.js`, which the first full run of the
  tests that walk `src/` failed on five names the tree already declared): Mathf.RoundToInt is `systems/mathf.js`'s
  `roundToInt`, imported, not ported a second time. A cell's index, a blow's roll and InRange take names of their own
  (`cellIndex`, `blowRoll`, `targetInRange`) beside `render/volumetricClouds.js`'s `cellOf`, `net/gate/gateStrike.js`'s
  `blowOf` and `net/wire.js`'s `inRange`, three different things. The [0, 1) draw (NextDouble) was the module's own at
  KG1, as `net/gate/gateLaw.js`'s `unit` is; KG2 exports it as `nextDouble` (the regulars' choices draw through it, section
  12), and AUDIT KG the checked source as `checkedRand32` (the regulars' steps draw through it). The ratchet stays at 42.
- **THE WORDS ARE THE CLIENT'S** (L10N4, `test/systems/l10n4_hardcoded.test.js`, which counted the layouts' five names in this
  file once main's localization arc came in): the law keeps a layout's key (`pillared-hall`, ... `open-field`) and its
  floor tones, never its name. The mod's names (section 2.1) are words a player reads, so KG3's panel says them through
  the text core, as every word of the game it shows - the refusals, the log, the banners. The law's own strings are
  identities - keys, refusal words, event types - sent and compared, never shown. The ratchet holds this file at 0.
- **A SEAT'S VIEW: NONE TO MAKE.** Section 4 planned each seat's view, as `net/iliac/iliacHand.js` has one. Nothing in a dealt
  game is hidden - both armies stand on the board, and the dice are the table's - so the state is each seat's view, and
  the guest's picture is the host's turned (the frame, above). The armies chosen before the deal are kept apart by
  whoever holds them: the relay's table at KG5.
- **WHAT THE PORT FOUND, KEPT AS THE MOD HAS IT**:
  - CheckGameOver's "no piece left" never decides: a side's king is one of its pieces, so its first clause, the king's
    fall, always decides first. Both clauses are kept verbatim.
  - PlaceArmy's fallback rows never fill. Twelve units fit one row (row 11 takes fifteen, row 12 fourteen beside the
    king), so a melee unit never reaches row 10 or 12, nor a ranged one row 10 or 11. Kept; the twelve-of-a-kind
    deployment pins the rows they fill.
  - MapIsPlayable's 97% at float32: no floor count a board can hold (147 to 195) brings 0.97 x floor within float32's
    reach of an integer, so float32 and float64 agree on every board. The C#'s float32 is kept anyway.
  - MakeUnit meets no half on DFU's rows (computed both ways). A blow does meet one: attack 5 at u = 0.25 is exactly 4.5
    at float32 and rounds to 4, and that is pinned.
  - A BLOW IS FLOAT32 AT EVERY STEP - the IL's `conv.r4` draw, its product and its sum each kept to a float, the reading
    Mono and an SSE JIT make. ECMA-335 lets a runtime keep the product wider, which differs on rare draws (raw 38348481 at
    a Gargoyle's 28: 22 narrowed, 23 wide); the relay's stream is not the mod's anyway, so the port keeps the narrow
    reading and pins it on two real attacks (AUDIT KG A6, A13).
  - THE ROSTER'S TIES are sorted by DFU's English names (`enemyDisplayName`); the mod sorted by the player's language's
    (`GetLocalizedEnemyName`), so its grid's order moved with the language. One roster for every client and the relay is
    the law's; the grid KG3 draws sorts a cost's ties by the names the player reads (10.2; AUDIT KG A15, C24).
  - THE LAW TRUSTS THE STATE IT IS HANDED: its steps refuse a command, never a state, and throw on one the law did not
    mint. KG5's relay checks a stored table's state when the room loads it (5.8; AUDIT KG A4).
- **Pins:** `test/net/kg1_law.test.js`, 18 tests: the mod's numbers; the roster's 46 rows and the kings against section 2.2's
  table, with RoundToInt's half to even; the army's law; Auto-fill on a scripted source; the Pillared hall, a sealed
  Guard rooms thrown away for a Moat and bridges, a kept Guard rooms, a Ruined keep's every chunk shape, and the Open field
  after thirty failures - each from scripted draws, its picture and its pairs; MapIsPlayable's 97% either side and the
  head's cell alone; the deployment's order; a new game's refusals and a broken source; GetReachable's order; InRange
  and HasLineOfSight's samples; a blow, its kill and its shot; potions; the turn; the turn's end (the hazards, the tick,
  the warning pair, a mirror cell under a piece, the fourteen); the end; and 250 seeded whole games between two greedy
  players, each ending lawfully. Each scripted draw is its value plus 1009 times its modulus, so a range is pinned and
  not only its value. AUDIT KG added to them (A1-A12): Auto-fill's lean at its float32 edge and a broken source's null;
  a hole in an army, a budget or a potion count refused; a moat bridged past its range's divisor, and a hazard's try on
  water; the thirty failures' 519 draws dealt through newGambit, and a negative draw refused; the sight line at two
  cells and three; the blow's float32 multiplier on two real attacks, and a ranged blow at one cell no shot; the guest's
  potions; every one of SpawnHazardPair's forty tries drawn, and a pair laid at the fortieth.
- **Mutants:** `tools/mutants/kg1.json`, 98, all dead - AUDIT KG's eighteen among them: the twelve lane A showed the 18
  tests could not fail and six over its fixes, each killed by the pin it wrote. Three survived the first pass - a chunk's rows, a Guard rooms'
  doorway and a moat's bridge, each a range mutated by one. The scripted draws' offset was then a thousand times the
  modulus, and 4 and 5 divide a thousand; it is 1009 now, a prime. Four more pins were written before the run, where the
  plan found nothing to fail a mutant: the head's king cell walled off on a board otherwise 99% reached, a hazard's try
  refused only by a piece on its mirror, the game-ending blow as a turn's second action, and the source's top draw
  (0xFFFFFFFF) taken.
- **Not yet:** the innkeeper's play (KG2), the nine cards (KG-SET), the table (KG3) and everything after.
- **Ledger:** section A row THE KING'S GAMBIT.

## 12. KG2 (2026-10-13): the innkeeper's play

The owner: **"Do KG2"**.

- **THE PLAY** (`src/systems/gambit/gambitPatrons.js`): pure and DOM-free, the regulars' own half - the relay never plays one
  (online is two players, section 5.8) - read off the law (`net/kingsGambit.js`: GetReachable, InRange, FoesInRange,
  PathMap), as the Iliac Hand's regulars read theirs (`systems/iliac/iliacPatrons.js`). Its exports:
  - the tiers: `GAMBIT_TIERS` (Tiers - each its key, least stake, points, potions and blunders), `tierFor` (TierFor),
    `GAMBIT_TIER_HASH`, `GAMBIT_TIER_BANDS`;
  - the deal: `regularArmy` and `dealRegular` (StartBattle, then BeginMatch);
  - the play: `regularAction` (AiAction - AiBlunder, the potion, TryEscape, the best blow, the best move) and its
    weights (`GAMBIT_BLUNDER_STRIKE`, `GAMBIT_POTION_LINE`, `GAMBIT_BLOW_WEIGHTS`, `GAMBIT_MOVE_WEIGHTS`,
    `GAMBIT_HAZARD_PENALTY`, `GAMBIT_JITTER`), and `regularStep` (AiTurnRoutine's step).
- **THE TIER IS THE SEED'S** (section 10.5): TierFor's hash over the regular's seed (`scenes/worldModes.js`
  regularSeeds, a uint32), read as the int32 the C# multiplies - the product wrapped, the remainder made positive. Over
  200,000 seeds the tiers fall 40, 35, 18 and 7 in a hundred, the mod's bands. A tier is its key and its numbers: its
  name and blurb (section 2.7) are words a player reads, so KG3's panel says them through the text core (section 11).
  The mod's own menu ("Play the computer for gold") drew a tier at random; it is not carried - the regulars in the free
  chairs are the opponents (section 10.5).
- **THE DEAL**: the regular's army Auto-filled to the tier's points (`regularArmy`), then the board (`newGambit`) - one
  source, in the mod's order; the player three potions and 300 points, the regular the tier's.
- **THE CHOICES' DRAWS**: a `rand32` handed in, standing for Unity's shared Random - Random.value is the law's
  `nextDouble` at float32 (exported for it), Random.Range(0, n) `drawBelow(n)` - in AiAction's order: the blunder's draw
  every action (a Grandmaster's too, whose chance is 0); a blunder's piece, then its strike's draw only when it has a foe
  in range, then its foe or its cell; an escape's draw on each clear cell; a blow's on each pair, piece by piece and foe
  by foe; a move's on each cell each piece reaches, in GetReachable's order. A step draws through the law's checked
  source (`checkedRand32`), and a source that is no source, or a tier whose share of blunders is no number in [0, 1],
  takes no step - `regularStep` answers null, never a turn passed in silence (AUDIT KG B8: the first had spun drawBelow
  for ever, the second - a tier's key handed in for the tier - played a Grandmaster's game unseen, `x < NaN` being false).
- **AT FLOAT32, AS THE C# KEEPS IT**: the blunder's chance is Random.value against the tier's float - raw draw
  1503238464 is the last Amateur blunder, and 1503238465 rounds up to 0.35f and is none (a float64 port would take 89
  draws for blunders the mod does not; the Seasoned's edge is 644245087, the Veteran's 214748360); the strike's coin, the
  same (raw 2147483647 rounds up to 0.5f, and walks); the potion's share of health against its line, kept at float32
  though no health on DFU's rows tells it from float64 (9 of 30 drinks either way - AUDIT KG B7); every score - the
  move's, the escape's and the blow's - each pinned where the rounding decides (AUDIT KG B2; THE ROUNDING DECIDES, below).
- **A STEP IS ONE ACTION**: `regularStep` takes the regular's choice through `gambitAct` (a blow's roll off the game's own
  source), or ends the turn when the regular finds none or the law refuses it (the routine's actionsLeft = 0 and
  QueueTurnEnd). EnemyPause - 1.2 s before and between the regular's actions - is the table's clock (KG3).
- **WHAT THE PORT FOUND, KEPT AS THE MOD HAS IT** (the mod's innkeeper plays a person, who ends what follows):
  - A KING NEVER CHOOSES TO WALK AT A FOE: outside a blunder it moves only to flee one within four steps, or off a
    hazard. A blunder walks any piece, a lone king too, so two kings alone end - if ever - by a blunder's walk into a
    blow or a hazard's bite, often hundreds of rounds on; two that never blunder stand for good (AUDIT KG B3, C7: this
    line had said two kings alone always stand).
  - THE HAZARD DANCE: the escape comes before the blow. A piece whose one cell in range of a foe holds an active hazard
    steps onto it (in range, 50, less the hazard's 40, is 10 - over three steps nearer, 9), and on its turn's last action
    steps off again before it strikes; two pieces played by these rules, across such a cell, take turns at it for good.
    A player strikes from the hazard and takes the bite.
  - A STEP THAT GAINS NOTHING STILL MOVES on any draw above 0 (the score is 0 plus the jitter): a blocked piece wanders.
    Only a draw of exactly 0 leaves it standing.
  - A MOVE NEVER ENDS ON AN ACTIVE HAZARD TO COME NEARER: it costs 40, more than three steps nearer are worth (9). A
    piece may pass over one, but a run of them longer than its reach holds a regular's piece back for good (the hazards
    never go, and at fourteen no more are laid).
  - THE ROUNDING DECIDES (AUDIT KG B1): a move's score is rounded to float32 once its jitter is added, so two cells of
    one score compare their draws on float32's grid at that score's size. The king's 20 moved to 19 or 21 carries a
    ranged piece's best score across 64 (on a warning, 62 and half its walk: 63.5 at three steps against 64.5, 64 at four
    against 63), where the grid doubles, and turns a tie into an order or back; a jitter of 0.2 - exactly twice 0.1f -
    parts draws that 0.1 rounds together. This record had called both changes invisible, from the scores' half-point
    grid alone, and the measure's own play had already told 0.1 from 0.2 (a Seasoned regular's first action, seed 7, game
    143). Both are kept as the mod has them, and three boards built at float32's edges pin them.
- **MEASURED** (`tools/kgMeasure.mjs`, 1,000 seeded games a tier, `node tools/kgMeasure.mjs`): the regular against an
  Auto-filled 300 and three potions, both seats played by `regularStep`, every game played to its end or to 200 rounds,
  and one undecided then counted by what stands - the two kings alone, or armies still on the board. AUDIT KG measured
  again (B3, B5): the first measure had stopped a game at the two kings alone, on the claim that neither king would move
  again, and seeded neighbouring games with first draws correlated at -0.48 (each game's seed is mixed now). Each tier's
  wins, the player's, the two kinds of undecided, and the regular's share of the decided games:

  | tier | against a careful player (no blunder) | against a careless one (15% blunders, a Seasoned regular's) |
  |---|---|---|
  | Amateur | 1.0 / 98.7 / 0.3 + 0.0 - 1.0% of the decided | 4.5 / 93.7 / 1.8 + 0.0 - 4.6% |
  | Seasoned | 20.2 / 67.4 / 12.4 + 0.0 - 23.1% | 45.7 / 41.4 / 12.9 + 0.0 - 52.5% |
  | Veteran | 59.2 / 31.3 / 9.5 + 0.0 - 65.4% | 78.9 / 13.8 / 7.3 + 0.0 - 85.1% |
  | Grandmaster | 82.0 / 10.3 / 3.2 + 4.5 - 88.8% | 95.9 / 2.8 / 1.3 + 0.0 - 97.2% |

  The tiers rise as the mod meant them to: a careless player beats an Amateur 94 games in a hundred and loses to a
  Grandmaster 96. A Seasoned regular is the careless player's own play on the same 300 points and three potions, and
  wins about half the decided games against that player (52.5%, within two standard errors of a half) - the measure's
  own check. The decided games run 21.8 to 32.1 rounds on average, and the longest 189: a Seasoned regular's lone king,
  walked by its blunders from round 48 into the careful player's. Against the careful player 45 games of 4,000 still held
  armies at 200 rounds, every one the Grandmaster's dance; a player who blunders breaks every one - none of 4,000. Two
  kings alone stood at 200 rounds in up to 13 games in a hundred (a Seasoned regular's), the fewest an Amateur's against a
  careful player (0.3).
- **THE NIGHT'S PURSE** (section 10.7), against these: the bound stands as decided - see 10.7.
- **Pins:** `test/tooling/kg2_patrons.test.js`, 11 tests: the Tiers table and TierFor against a BigInt reckoning of the C#'s
  int32 (4,008 seeds, a band's every edge, the shares over 200,000); the deal and its order of draws, and a stuck source
  refused; a blunder (each tier's float32 edge, the strike's draw taken only with a foe in range and its coin at
  float32, its foe by its place, a Grandmaster's draw taken); the potion's lines and its tie; an escape (a clear cell, a
  king's farthest, the last action, a warning's none, the bite by its kind, a boxed piece giving way to the next, the
  first of two); the best blow; the best move (a step nearer, the hazards, into range, the king's 20 against a higher
  draw, a ranged piece's distance against a higher draw, a king's flight, the first of a true tie); THE WEIGHTS AT THEIR
  EDGES - each of the mod's numbers deciding a choice on a board built for it: a corridor sealed by a row of walls for a
  fleeing king, water with one bridge for a ranged piece's long walk (16 steps, then 20 and 19); AT FLOAT32 - the
  jitter's tie, the king's 20 at three steps and at four, an escape's and a blow's tie (AUDIT KG B1, B2); a step, its
  guards with no draw taken, a broken source and an unreadable tier taking none (B8); and the measure's first sixteen
  games a tier, tally for tally, a game undecided at its cap counted by what stands, two kings alone played on, and the
  games' seeds mixed (B3, B5).
- **Mutants:** `tools/mutants/kg2.json`, 108, all dead. The three this record had called equivalent - the king's 20 at
  19 and 21, the jitter at 0.2 - were not (AUDIT KG B1), and die on the AT FLOAT32 boards; AUDIT KG added thirteen (the
  bite by kind, a boxed piece giving way, the escape's order, the move's, the escape's and the blow's scores and the
  strike's coin at float64, the blunder's foe, the unchecked source, an unread tier at either door, and the measure's
  kings and seeds), each killed by the pin it wrote. The first run's 20 survivors were the weights the scenarios' margins
  left loose; THE WEIGHTS AT THEIR EDGES pins them.
- **Not yet:** the nine cards (KG-SET), the table (KG3) and everything after.
- **Ledger:** section A row THE KING'S GAMBIT - THE INNKEEPER'S PLAY.

## 13. AUDIT KG (2026-10-13): the law, the play and this record, read cold

The owner, of KG0-KG2: **"Audit this and ensure absolute perfection. Ensure any of the UI is enhanced plus, our own coat
and easily understandable/readable"**. Four cold lanes read a frozen snapshot (3b50a59b5) - the law against the mod's C#
(A), the play and its measure against the C# (B), this record's every claim (C), the UI the record plans against
Enhanced Plus and Plain Words (D) - and every finding was read again against the code or the C# before it was acted on.
All held. The findings and their verdicts are `01-Overview/audits/Audit-Kings-Gambit.md`; what changed is written into the
sections above, each marked AUDIT KG and its id. In short:

- THE LAW (A): Auto-fill's lean at float32, as the C#'s 0.5f (A1), and drawn through the checked source, so a stuck one
  fills no army rather than spinning (A2); a hole in an army, a budget or a potion count refused (A3); twelve mutants
  the pins could not fail, killed by pins of their own (A5-A12); the relay's stored state checked when KG5 loads it
  (A4); the blow's float32 reading and the roster's English order recorded (A13, A15).
- THE PLAY (B): the three mutants recorded as equivalent were not - float32's rounding decides (B1); five rules'
  details pinned (B2); the measure plays two kings alone on and mixes its seeds, and every figure is measured again
  (B3, B5); a broken source or an unreadable tier takes no step (B8); Unity's draw is [0, 1], both ends (B7).
- THE RECORD (C): the board's lay - along the table's axes, 7.08 cm cells from a long side; the rule this record cited
  lays 5.13 cm cells askew (C1); the pieces' bar and fall one decision, 10.1's (C2); the clock's guess, AutoFill's home,
  the starter deck's ten, a dropped link's purse, the arrays the C# view shows, the lunge, the walk, the log's two
  lines, a lean that could not see the near rows, the press in the playable slice - each put right (C3-C23); the
  Grizzly Bear no longer the Dreugh's twin (C21).
- THE UI (D): no screen of the game exists yet. Section 14 is what KG3 and KG4 build, binding: the
  stone-and-brass kit by role, the pixel face, no type under 12 px and every line a reader reads at 15, a finger's 44
  px, a press for every hover, the four plain-words blocks with every number the law's, the words through the text core
  with no pronoun guessed, and the cloth's marks in the house's coat, never colour alone. Hold'em's and Iliac Hand's
  panels, which had shipped outside the kit, were dressed in it the same day by CARDS-PLUS (`Tavern-Cards.md` section
  38) through a shared kit, `ui/card/cardPanelKit.js`; the game's panel is the third to wear it (D1).
- THE RECORD'S OWN WORDS (K1, the author's): the regulars are of both genders, and this record, the KG2 module, its
  tests and its Ledger row called every one "he". Each is the regular, or the regular's name, now.

Pins: `test/net/kg1_law.test.js` 18 tests and `test/tooling/kg2_patrons.test.js` 11, every audit fix pinned; mutants 98 and 108, all
dead.

## 14. THE TABLE'S UI (AUDIT KG): Enhanced Plus, our own coat, plain words - binding KG3 and KG4

The owner: **"Ensure any of the UI is enhanced plus, our own coat and easily understandable/readable"**. This section
is what the table's panels and the board on the cloth are built to. It replaces section 5.5's first plan, which copied
Iliac Hand's painter and the mod's words and palette (AUDIT KG D2-D23); every DECIDED point of sections 5, 10.1, 10.2,
10.4, 10.5 and 10.7 that met it is changed there and marked. A slice that ships a surface proves it against this
section (14.9).

### 14.1 ONE TABLE, ONE COAT - the card tables' kit

- THE CARD TABLES' KIT (CARDS-PLUS, `Tavern-Cards.md` section 38, merged to main the same day; AUDIT KG D1). Hold'em's
  `.dfcards` and Iliac Hand's `.dfiliac` wear the stone-and-brass kit through one home, `ui/card/cardPanelKit.js`: the chrome
  both wear (`cardPanelChromeCss` - the window's box, bounded by the screen's height and scrolling inside; the header
  band `.tablehead` and its `.fold`; the `.tablenote`; the line `.msg` and its tones; the presses' row `.tableacts` and
  their kinds, `data-kind` primary, quiet and warn; the `.log`), the classic skin's copy of the kit cut to the panels
  (`cardKitCss`, `dressCardPanel`, by `isCardPanelSelector`), and the fold's words (`foldWords`). The King's Gambit's
  panel is the third to wear it, so the three are one coat by construction: KG3 lays `cardPanelChromeCss('.dfgambit')`,
  adds `dfgambit` to `isCardPanelSelector`, and gives the kit the game's own surfaces by role. AUDIT KG had planned a
  slice of its own, KG-COAT, to dress the two panels; CARDS-PLUS dressed them first, and KG-COAT is withdrawn.
- THE KIT BY ROLE. The panel is `ui/gambitTableHud.js` (KG3 writes it), Iliac Hand's two halves - `gambitHudModel` pure
  (every label, every flag and its reason, every number), `createGambitTableHud` the painter - its root `div.dfgambit`.
  The chrome's parts take the roles the other two panels' take; the game's own parts are words of their own,
  `.dfgambit-<part>` (CARDS-PLUS's sweep, `test/ui/cardsplus.test.js`, holds every panel's classes clear of the enhanced
  sheets' bare components). Each selector with a leading `body`, the panels' sheets landing after the skin's:

  | Role | The chrome's parts, as the two panels' | The game's own parts |
  |---|---|---|
  | window | `body .dfgambit` | |
  | header | `body .dfgambit .tablehead` | |
  | button | `body .dfgambit button`, `body .dfgambit .fold` | |
  | primary / warn | `body .dfgambit button[data-kind="primary"]` / `body .dfgambit button[data-kind="warn"]` | |
  | ruleTop | `body .dfgambit .log` | |
  | panel | | `body .dfgambit-sec`, `body .dfgambit-info`, `body .dfgambit-result` |
  | headerRule | | `body .dfgambit-sec > summary`, `body .dfgambit-sec > h3` |
  | tile | | `body .dfgambit-unit`, `body .dfgambit-stake`, `body .dfgambit-crown` |
  | listRow | | `body .dfgambit-regular`, `body .dfgambit-armyrow`, `body .dfgambit-piece` |
  | chip | | `body .dfgambit-chip` |
  | well / meterFill | | `body .dfgambit-face`, `body .dfgambit-meter` / `body .dfgambit-fill` |

  The panel's own sheet writes geometry and words only - an edge a width and a style, never a colour, a ground, a
  shadow or a radius on a role (the kit's law, CARDS-PLUS's: "Geometry and words only: every surface's paint is the
  kit's, by role"). So every look comes with the roles: the Plus themes (`themeCss` walks FRAME_ROLES), DFO Grimoire's
  dress (the panels its small windows, every state they mark re-said in its colours - AUDIT CARDS-PLUS B1, B4), and the
  classic skin, by `dressCardPanel`.
- THE FACE: the chrome's root wears the pixel face (`ui/pixelifyFive.js` PIXEL_FONT_CSS), and `dressCardPanel` asks for it
  on the classic skin (FONT1, the owner: "Any enhanced UI or text must be our enhanced version"); no other family and
  never `!important`, so a player's TEXT-FONT choice (`ui/textFont.js`: Sans, Monospace, Dyslexic or their own) reaches
  every word. No italics: the face has none.
- THE CARDS IN THE PANEL ARE PICTURES, NOT ILIAC HAND'S RULES (D12): a unit's face is painted without Iliac Hand's cost
  gem, power shield and rarity frame - a picture-only mode of `paintIliacCard`, pinned - so a Rat never shows Iliac's 1
  and 1 beside its 6 points, 12 health and attack 2; painted as the binder paints, at its CSS size (`cardCanvas`, a copy
  for each place it stands - CARDS-PLUS's one cache). The same face stands on the cloth (10.1).

### 14.2 TYPE AND INK - easily read

- Sizes (px; the pixel face's reading weight and tracking, PIXEL_READ_CSS). The chrome's parts at the chrome's sizes,
  as the other two panels read them: the header band 14 (capitals, brass), the line 14, a press 13, the note and the
  log 12. The game's own reading blocks - what it is, the next step's reasons, the guide, the words, a regular's line,
  the information box, the result's line - 15 at a line height of 1.55 (PLAIN-UI e's, the plain-words panels' size; the
  other two panels have no such blocks); a chip and a tile's numbers 12, the floor - nothing smaller; a unit's name under
  its tile 13, on up to two lines, whole; the result's headline 18. The panel's sheet joins FONT3's FLOOR_SHEETS
  (`test/ui/font3_readable.test.js`), so the floor's pin and the dim colour's pin hold it (`10-UI/Plain-Words.md`).
- Ink through the chrome's tokens - words in the bone, a lesser word in `--cp-dim`, a refusal's in `--cp-red`, Stone's
  lift already the chrome's - never the kit's `#7d7460` for a word, never a word faded by `opacity`. A refused press is
  `aria-disabled`, its word in the dim and its edge kept, and says why when pressed (MENU-ORDER g); the chrome's
  `:disabled` fade is a press in flight's alone.
- Focus is the other two panels' ring (2 px brass, off the edge); motion honours `prefers-reduced-motion`; the line
  (`.msg`, the next step and a refusal) is `aria-live="polite"`.

### 14.3 THE FINGER, THE KEYS AND THE PAD

- 44 BY 44: the chrome's coarse-pointer law makes every press and the fold 44 px (AUDIT CARDS-PLUS E5); the game's own
  tiles, rows and picks take the same, and on a screen 480 px wide or less too (U51's rule); with a fine pointer at least
  32 px tall. (Lane D measured the card panels at 21-26 px on a 390 px phone - D5 - before CARDS-PLUS.)
- A FINGER HAS NO HOVER (Plain Words law 5): a press on any piece - either side's - or any cell fills the information box
  and draws its reach; a hover may preview the same; a `title` is never the only place a word lives. The fold is the
  chrome's: its press folds the panel before the eye, and its words ("Collapse the panel", "Expand the panel",
  `foldWords`) are its name to a screen reader.
- THE CLOTH UNDER A FINGER (D6): fifteen columns across a 390 px screen are 26 px a column at best, so a press picks the
  nearest of the player's pieces, or of the lit cells, within 22 CSS px; on a touch device a press STAGES - it draws the
  path or the target and offers Move here, Strike {name} or Drink with Cancel, each 44 px - and the staged press commits
  (Iliac Hand's stage-then-commit); with a fine pointer the mod's click acts at once and Escape cancels. Both pinned.
- THE KEYS AND THE PAD (D18): Tab walks the panel, Enter and Space press (AUDIT CARDS-6 B10's `pressable`; Space on the
  panel the panel's, never the game's jump - AUDIT CARDS-PLUS A4), focus is kept across a redraw and never handed to a
  costly press or to what the fold hid; the armies' rows select a piece; a cell cursor on the cloth moves by the arrows or
  the d-pad, presses on Enter or the pad's A, cancels on Escape or its B, drawn in the brass ring and read in the
  information box.
- A seated finger is the table's (CARDS-TOUCH, `Tavern-Cards.md` section 31); the panel swallows its own presses and
  answers nothing while a box stands over the seat, the tutorial's page included (PLEA-LOOP).
- A PRESS THAT COSTS GOLD SAYS SO AND ASKS TWICE (D15): Forfeit, and Stand up while a game is under way, are the warn kind
  (`data-kind="warn"`, Iliac Hand's Concede and stand's role) with the cost in the label ("Forfeit - lose 100 gold"); the
  first press arms it for 4 s (`ui/seatTab.js` SEAT_RELINQUISH_ARM_MS's way), any other press disarms it.

### 14.4 PLAIN WORDS AT THE TABLE

The four blocks of PLAIN-UI a (`10-UI/Plain-Words.md`), on every stage, in this order:

- WHAT THIS IS (law 1): "The King's Gambit is a game of armies and kings, played on a board of {cols} by {rows} cells.
  Each side protects its king. Defeat the other king to win."
- THE NEXT STEP, one live sentence by the reader's state - no regular free; none chosen; a regular playing for fun
  tonight; a purse short of the least stake ("{name} will not sit down for less than {stake} gold. Come back with more,
  or choose another regular."); no stake chosen; choose your king, then your army; add a unit or Auto-fill; start the
  battle; your turn and its actions left; a piece chosen (press a lit cell to move, a ringed foe to strike, or give the
  piece a potion);
  the regular's turn; your turn is ending; the round before the warnings turn. A refusal takes the line until the next
  press (CARDS-SAID).
- HOW THE KING'S GAMBIT WORKS (law 4): seven short paragraphs - choose a regular; put down your stake; build your army;
  take your turn; strike; mind the ground; win - every number read from the law. OPEN until the player (not the
  character) has finished one game; once they fold or open it, their choice holds (`ui/seatTab.js` boardFold's press,
  never the `toggle` event - AUDIT PLAIN-UI C1).
- WHAT THE WORDS MEAN (law 2; "Words on this table" until KG3's English pass, 16.5), folded: Regular, Tier, Blunder, Minimum stake, Stake, For fun, Crown, King, Army, Points,
  Level, Health, Attack, Melee, Ranged, Auto-fill, Turn and action, Move, Potion, Round, Fire, Spikes and Poison,
  Warning, Wall, Pillar and Water, Layout, Reach, Range and Target, Fallen, Forfeit - each in brass over its meaning.
- THE NUMBERS ARE THE LAW'S (law 3): every figure in a line, the guide or the words is interpolated from its export -
  `net/kingsGambit.js` KG_COLS, KG_ROWS, KG_POINT_BUDGET, KG_MAX_UNITS, KG_MIN_COST, KG_RANGED_COST_FACTOR,
  KG_DAMAGE_PER_LEVEL, KG_RANGED_DAMAGE_FACTOR, KG_KING_LEVEL, KG_KING_HP, KG_KINGS, KG_ACTIONS_PER_TURN,
  KG_POTIONS_PER_SIDE, KG_POTION_HEAL, KG_MOVE_RANGE, KG_RANGED_RANGE, KG_BLOW_LOW, KG_BLOW_SPREAD, KG_HAZARD_KINDS,
  KG_HAZARD_DAMAGE, KG_HAZARD_PAIRS_AT_START, KG_HAZARD_SPAWN_EVERY, KG_MAX_HAZARDS, KG_AUTOFILL_RANGED,
  KG_AUTOFILL_LEAN, KG_LAYOUTS, KG_OPEN_FIELD, KG_TILE; `systems/gambit/gambitPatrons.js` GAMBIT_TIERS, GAMBIT_BLUNDER_STRIKE.
  The stake's numbers have no export yet (D9): KG3 adds them where the stake's law lives - the multipliers (1, 2 and 5),
  the win's pay (twice the stake), a regular's night (15 times the least stake) and the book's 24 taverns - and the
  session's beats and the log's 12 lines beside its other constants. A typed number is a mutant the pins kill.

### 14.5 THE SURFACES

- CHOOSING A REGULAR: a row a regular in a free chair (a list row, 44 px, `aria-pressed`, the chosen one marked in
  brass), in tier order, then by chair: the name; the tier as a chip with a four-step mark (a picture before a word,
  MENU-ORDER law 1); "An army of {points} points - {potions} potions - blunders {n}% of the time" ("never blunders" at
  0; "Fields {points} points" until 16.5);
  "Sits down for {stake} gold or more"; the tier's blurb in the dim; what is left of the regular's night ("Can still pay
  {left} gold tonight", or "Plays for fun tonight"); online, "Online, the regulars play for fun".
- THE STAKE AND THE KING: three tiles, "x{m} - {m x stake} gold", the chosen in brass; a pick past the purse or past the
  regular's night says why when pressed; under them, what the stake does before it is put down: "Win: you take back
  {pay} gold. Lose, forfeit or stand up mid-game: {name} keeps your {stake}." Then the four crowns, each the painted King
  of its crown over its name; one line, "The crown only changes how your king looks. Every king plays the same: level {level},
  {hp} health, attack {attack}." (16.5)
- THE ARMY: the header's two chips, "Points left {left} of {budget}" and "Units {n} of {max}"; THE UNIT - the last unit
  pressed, shown large (the binder's law: "a tile's own words are too small to read") beside the grid on a desktop and
  above it on a phone: its picture, name, "Level {l} - Health {hp} - Attack {atk} - Melee" or "Ranged ({range} cells)",
  "{cost} points", and the press's outcome or refusal ("The Lich costs 63 points; you have 40 left." / "Your army is
  full: 12 units."). The grid: the 46 units in the law's order (a cost's ties by the names the player reads, 10.2),
  picture-only faces, the name in words, chips for level, health, attack, melee or ranged and "{cost} pts" - points,
  never gold, never in the purse's gold; a unit the points or the twelve refuse stays pressable and says why. Your army:
  a row a unit, dearest first, a visible Remove in words. "Your king: {name}, King of {crown} (free). If your king falls,
  you lose." Presses: Auto-fill, Clear, Back, Start the battle - stake {stake} gold (primary), Stand up.
- THE TURN: the header "ROUND {r} - YOUR TURN" or "{NAME}'S TURN"; chips with pips AND words ("{n} of {actions} actions
  left"), both sides' potions, both sides' fallen; the next-step line; the information box; ARMIES (folded) - both
  sides' pieces as rows with a health meter banded like the vitals and "{hp} of {max}"; the log; the guide and the
  words, folded. Presses: Give {piece} a potion (+{healed}) (16.5) - refused in words ("{piece} is at full health.", "You
  have no potions left."); End turn (primary); Forfeit (warn, two presses); Stand up (warn while a game is under way).
- THE INFORMATION BOX: a piece - its picture, its name and side, level, attack, melee or ranged and its reach, a health
  meter and "{hp} of {max}", how far it moves, whom it can strike now (`foesInRange`), its cell's hazard; a king: "If
  this king falls, you lose." or "If this king falls, {name} loses." A cell - open floor; a wall or a pillar ("no piece walks through it, and it blocks a
  ranged shot"); water ("cannot be crossed on foot, but ranged attacks pass over it" - the mod's); an active hazard ("a
  piece that ends its turn here loses {damage} health"); a warning ("this cell becomes {kind} at the end of round {r}.
  It is harmless until then.").
- THE LOG: the chrome's - four lines in view, the newest last and scrolled into view, folded with the panel - the last
  12 kept; a sentence a line, the player in the second person and the regular by name, one pattern an event of the law
  (move, attack, a shot, a kill, potion, hazard, armed, warning, turn, over), tabled in this record before KG3 builds it
  and each written to fit one line of the panel. The chrome cuts a line too long for it (`white-space: nowrap` and an
  ellipsis, so its scroll stands on whole lines), where FONT1 F8 asks a long line wrapped whole: recorded against the
  chrome - the three panels' one home - for the card tables' next change (D16).
- THE RESULT, after the result's beat: the headline ("You win" / "You lose", "by forfeit" when one); the king's fall
  ("{name}, King of {crown}, falls."); the gold in one sentence ("You collect the pot: your {stake} gold back, plus
  {stake} gold from {name}." / "{name} keeps your {stake} gold." / "Played for fun. No gold changed hands."); when the
  regular's night ran out, that the next game is for fun; the next step. Presses: Play again (primary), Change army,
  Choose another regular, Leave the table.
- THE TUTORIAL: the page 'kings-gambit' in the catalogue (TUT1: at most sixty words; no number - the guide carries them;
  no old game's name, so no crown - the catalogue's pin refuses "Daggerfall"; no key, only actions), its first sight
  inside the panel's own painter (`noteFirstUse`, never a host closure a test lifts), its words read lazily through the
  text core; the catalogue's `page()` keeps a getter lazy (it spreads its argument today, which reads a word at load -
  D21). The 'tavern-cards' page names the third game ("Play Texas Hold'em, Iliac Hand or The King's Gambit ...": "A
  slice that changes how a system plays changes its page").

### 14.6 THE WORDS THROUGH THE TEXT CORE

- Every word a player reads goes through `t(key, en, args)` under `cards.kingsGambit.*`, read when it is shown, never at
  a module's load (`tools/l10n/ROUTE-BRIEF.md`); one sentence one pattern, plurals by ICU, never fragments glued. The new
  modules hold no hard-coded prose (the ratchet holds a new file at 0) and the files they touch hold their counts:
  `ui/card/cardTableHud.js` (80 at KG3), `ui/iliacTableHud.js` (63), `world/card/cardRegulars.js` (10), `systems/modSettings.js`
  (243), `systems/tutorialCatalogue.js` (219), and at KG3 `ui/credits.js` (86), `systems/features.js` (135),
  `scenes/worldModes.js` (84) and `scenes/world.js` (350). Every key ships its drafts in the thirteen whole languages
  (L10N6's rule; the twelve drafting owe them - 16.5).
- NAMES: a unit's name through DFU's own lookup (`systems/textManager.js` getLocalizedEnemyName), never the law's
  canonical English; a king as "{name}, King of {crown}" off the Bay deck's crowns (`render/cardFaces.js` SUIT_CROWNS) -
  never the law's KG_KINGS names (Knight, Barbarian: the mod's classes, the law's numbers only); the mod's title, the
  regulars' and the kings' own names never translated.
- NO PRONOUN GUESSED (D10): a regular is named, never "he" - the regulars are of both genders (`scenes/worldModes.js`
  regularSeeds) - so the mod's "He will not sit down ...", "He has had a few drinks ..." and "He plays most nights ..."
  are rewritten round the regular's name or the tier's own words, and a king is "your king", "this king" or a name;
  "from the innkeeper" is "from {name}" - the regular, not the innkeeper, is the opponent (section 3); "click" is
  "press", the table being a finger's (CARDS-TOUCH); the mod's cost formula is said in words (14.4), never as "sqrt(HP x
  Attack)".

### 14.7 THE PHONE

Under the touch law or at 480 px: the setup, the army and the result as a sheet from the foot (its header and presses
stuck, its body scrolling, 16 px gutters, nothing spilling sideways - PROFILE-MENU P4, AUDIT PLUS-MENU M1), three tiles a
row at 390 px; the battle as a strip at the foot no taller than a quarter of the screen - the next-step line, one row of
chips, one row of 44 px presses (the staged Move here / Strike / Drink with Cancel, else End turn, and More) - More
opening the information box, the armies, the log, the guide and the words as a sheet (Menu-Order law 4: what is not here
waits to be asked); in landscape the strip a column at the right, at most 30% of the width. Type does not shrink on a
phone. KG4's lean keeps the board's projected box clear of the strip, of the touch layer's top-left presses and, on a
desktop, of the panel's column (MEASURE, by the probe).

### 14.8 THE CLOTH'S MARKS, IN OUR OWN COAT (KG4; 10.1's and 10.7's mod palette replaced)

- THE SIDES are light and dark, as a board's two sides are - the host's discs the kit's bone, the guest's its dark stone
  - and differ in shape as well (the guest's rim notched); the information box names the side. The mod's blue and red
  read as one grey (1.00:1, D19), so colour alone never tells them.
- EVERY MARK has a double edge - the kit's outline (`#050608`) and a bone line - which reads 3.9:1 or better on all eight
  floor tones of the four layouts and the Open field.
- SELECTION is the brass ring and the 1 cm lift (not the mod's yellow outline). REACH is a filled wash, RANGE an outline
  alone, a TARGET the warn role's blood ring with a sword glyph: three shapes, never three hues alone.
- THE NUMBERS that rise over a cell are the pixel face drawn at run time with the HUD's hard outline all round, signed
  ("-8" a loss, "+30" a heal) - not the mod's tints, which read 1.61:1 on the Moat and bridges' light floor.
- THE HEALTH BAR is banded like the vitals (the kit's `meterFill`), its length the value. Reduced motion: no shake.

### 14.9 WHAT PROVES IT (KG3's and KG4's acceptance)

- `kg3_panel.test.js` (KG3 writes it) over `gambitHudModel`: every next-step arm; the guide open until a first game and its kept
  fold; every number in a line, the guide and the words equal to its export (with mutants that type a stale number);
  the regulars' rows; the stake's picks and their refusals; every refusal word of `gambitRefusal` and `armyRefusal` said
  in words; a log line for every event type; the result's three gold lines; kings named off SUIT_CROWNS; units named
  through getLocalizedEnemyName.
- THE COAT'S PINS: the panel built on `cardPanelChromeCss('.dfgambit')` and named by `isCardPanelSelector`; every
  selector of 14.1 in FRAME_ROLES beside the two panels'; `test/ui/cardsplus.test.js`'s sweeps - the classes clear of the
  bare components, each panel's classic dressing read alone, every press's kind - run over the third panel too; the
  sheet writes no paint on a role and no size under 12 px; the sheet in FONT3's FLOOR_SHEETS.
- THE WORDS' PINS: the ratchet's counts above; the tutorial's page within its limits and its seam swept both ways.
- THE PROBE: CARDS-PLUS's `tools/cardPanelsProbe.mjs`, one probe for the three panels, given a King's Gambit table in
  the cards lab - its looks (Enhanced Plus, the classic skin, DFO Grimoire), its sizes (1280, a 1000x560 window, a 390 and
  a 360 phone, an 844x390 phone under a finger) and its checks (the face, the kit's frame, nothing wider than the panel,
  no borrowed component, the fold), and the game's own: every press 44 px on the phone, the panel or the strip clear of
  the board, the cell's size on the screen (KG4's MEASURE) and the snap's radius; photographs of the guide and the words
  unfolded, and of the three panels side by side in one coat.

## 15. KG-SET (2026-10-13): the nine in the set, and the set's words in the player's language

The owner: **"Dont come back until this is completed in full"** - the slice after AUDIT KG, before the table (KG3).

- THE NINE (section 10.3, as decided): the Grizzly Bear, the Sabretooth Tiger, the Spider, the Slaughterfish, the
  Mummy, the Frost Daedra, the Fire Daedra, the Archer and the Ranger are cards of the set (`net/iliac/iliacCards.js`) - units,
  their numbers, tags and effects 10.3's table's, every effect `fxRefusal`'s null and its words `fxText`'s. Every
  textured creature of the game now wears a card, and all 46 of the roster's units have their faces. Six emblems are
  theirs, painted in code and looked at in Chromium at the tile's and the large face's sizes (`render/iliacCardFaces.js`:
  the bear's head, the sabretooth's with its two sabres, the spider let down on its thread, the slaughterfish's jaw of
  teeth, the wrapped dead, the drawn bow - the Archer's and the Ranger's); the Frost and the Fire Daedra wear frost and
  fire. Their foes drop them (`systems/card/cardSources.js` FOE_CARDS: mobile types 4, 5, 6, 11, 19, 25, 26, 141 and 142, at
  their tiers' chances); the house's packs, the regulars' decks and a card's worth take them off the catalog, as they
  take every card.
- FOUND AT THE SLICE - THE SET'S WORDS HAD NO ROAD TO A PLAYER'S LANGUAGE. L10N4's ratchet holds a file's English from
  growing (`test/systems/l10n4_hardcoded.test.js`), and the catalog held its 96 cards' rules and flavor in English (234
  literals): the nine's could not be written beside them, and no card's words reached a French or a Korean player at
  all. The root, fixed: the relay's catalog keeps the rules and the canonical names - a card's name is Daggerfall's own,
  the name fxText's summons say, and `tools/l10n/ROUTE-BRIEF.md` does not route it - and no word. Every card's rules and
  flavor are `systems/iliac/iliacCardWords.js`'s, said through the text core when they are shown (`cardRules`, `cardFlavor`;
  the keys `cards.iliacSet.<card>.rules` and `.flavor`, 210), each rules line's English pinned EXACTLY `fxText`'s, as the
  catalog's `text` was (`test/systems/loot/cards8_catalog.test.js`). The face painter takes the words beside the card
  (`paintIliacCard`'s `words`, the card's own by default); the binder's look and its tiles, a card item's lines and the
  table panel's card title read them; the binder's cached faces are painted again when a language is chosen or a
  translation's table laid (`textRevision`). The catalog's count fell to 52 - its names - and the words module holds
  none; the relay's bundle carries no word. Drafted in-session into the thirteen whole languages
  (`06-Systems/Localization-Arc.md`, "KG-SET"), each set's keywords settled once in its glossary and every face painted
  in Chromium to check its fit: no rules line cut in any of them; a flavor dropped where the box is full, as the
  painter's law drops it first - Ancient Vampire's and Ancient Lich's in most languages, Ancient Lich's in English too.
  A card's name shown through Daggerfall Unity's own name tables, and the Iliac panels' own sentences round it, stay
  L10N4's cards batch.
- FOUND AT THE DRAFTS - A NO-BREAK SPACE WAS A PLACE TO BREAK. French sets a no-break space before a colon ("Continu :"),
  and the face's wrapper split the words on every white space (`/\s+/` matches U+00A0): the colon wrapped onto the next
  line's head and the space came back a plain one. The wrapper breaks on white space but never a no-break space now
  (`iliacCardFaces.js:"export const CARD_BREAK = "`) - U+00A0, U+2007 and U+202F - and keeps it; no French rules line
  opens on its colon at any width.
- FOUND AT THE GATES - THE ACCOUNT WORKER CARRIES THE WORDS. The account service bundles `systems/iliac/iliacItems.js` (the
  item law reads a card item), so the words module a card item's lines read rides its bundle beside the text core it
  already carried; its deploy's path filter names it now (`.github/workflows/account-deploy.yml`, held to the Worker's
  own import graph by `test/server/accountdeploy.test.js`), so a change to a card's words deploys the service that bundles
  them. The relay's bundle carries none.
- THE RELAY: world203 (NOT YET DEPLOYED; world201, then world202, on its branch - renumbered past main's CHAT-TRADE world201 and FIVE-ASKS world202 at the merges) - the catalog is relay law, and a deck holding one of the nine is one an older
  relay refuses.
- MEASURE - ILIAC HAND'S BALANCE, AGAIN. `tools/iliacBalance.mjs`, committed (CARDS7's random games and AUDIT CARDS-6
  B12's regulars were measured by scripts that never were); seed 20261013, the set before the nine (85 cards) and after
  (94):

  | | before | after |
  |---|---|---|
  | 3,000 random games: seat 0 / seat 1 / drawn | 48.9% / 49.6% / 1.5% | 49.0% / 49.9% / 1.1% |
  | decided on the holdings / on power | 84.9% / 13.6% | 84.6% / 14.3% |
  | the starter deck, careful, against a village's / a town's / a city's regulars | 56.1 / 53.3 / 45.7% | 59.4 / 55.7 / 45.7% |
  | reckless | 60.3 / 58.7 / 47.2% | 62.2 / 58.2 / 49.0% |
  | sly | 56.1 / 53.7 / 43.9% | 58.8 / 55.2 / 44.3% |

  The random games are CARDS7's, reproduced: no seat's edge, eight games in ten decided on the holdings. The regulars'
  1,200 games a temper and a grade move by at most 3.3 points - inside two standard errors of a difference of two such
  rates (2 points each) - and the village's most: a village regular trades six of the starter deck's cards for their
  kind's, and the nine now stand among the trades - the Slaughterfish above all, a one-cost beast of the sea that tires,
  in most of a reckless village regular's decks (sampled over 3,000 seeds a grade). The curve holds - the tiring three sit one step
  up as the Zombie does (1/3, 2/4, 3/5), each with text that costs it power. B12's own figures came from another
  seeding; the before column is this tool's, so the two columns compare.
- Pins: `test/systems/kgset_cards.test.js` (5) - the nine as 10.3 writes them and their foes; the catalog's no word and the
  words' cover; every surface in French and back in English byte for byte, the faces painted again; a no-break space
  kept whole; the balance tool's decks and games - and the moved pins of `cards8_catalog`, `cards8_faces` (the six
  glyphs' measures), `cards8_binder`, `cards9_sources` and `auditcards5_items`. Mutants: `tools/mutants/kgset.json`, 13,
  all dead.
- THE FOUR HOSTS: no host changed - `scenes/worldModes.js`, `scenes/world.js`, `scenes/exterior.js` and
  `scenes/dungeonContext.js` untouched; the cards reach a table through the catalog alone.
- **Not yet:** the table (KG3) and everything after.
- **Ledger:** section A row THE KING'S GAMBIT - THE NINE IN THE SET.

## 16. KG3 (2026-10-13): the evening offline - the first playable King's Gambit

The owner: **"Dont come back until this is completed in full"**; asked how one starts the game, the answer is this
slice. A player sits down at a tavern's card table (any chair: the seat's own press, `Tavern-Cards.md` section 12), and
the table's panel - Hold'em's buy-in, or Iliac Hand's setup - offers **Play The King's Gambit** beside its other game
while the game's Features switch is on (Settings, the World tab: "The King’s Gambit by Unnamed (thekingsgambit.dfmod)",
on by default). The press opens the third panel on the same seat: choose a regular, put down a stake, choose a king,
build an army, play the battle on the board laid across the cloth.

- THE SESSION (`systems/gambit/gambitTableSession.js`): the law's game (KG1) dealt against a regular by the innkeeper's play
  (KG2, `dealRegular`) and run on the mod's beats - 0.9 s to a turn's end, 1.2 s before each of the regular's actions,
  1.3 s before the result (`GAMBIT_TURN_END_MS`, `GAMBIT_REGULAR_PAUSE_MS`, `GAMBIT_RESULT_MS`). A command the law refuses
  changes nothing and answers the law's word; a source that breaks is no contest - no game, no gold. The stake's numbers
  live where its law does (14.4): the picks `GAMBIT_STAKE_MULTS` (the tier's least times 1, 2 and 5), a win paying
  `GAMBIT_WIN_PAYS` (twice the stake), and A REGULAR'S NIGHT - the book on the character's save (`gambitPurses`), net by
  table, game day and name, `GAMBIT_NIGHT_MULT` (15) least stakes a night, never below nothing, a new day afresh, 24
  tables of 6 names, the oldest day out first (a tie keeping the table just booked), restored only well formed. The
  player's king is kept on the character too (`gambitCrown`, one of `GAMBIT_CROWNS` - the Bay deck's four in its suit
  order - and Daggerfall the first time). The log keeps 12 lines.
- THE HOST'S HALF (`scenes/gambitTableGame.js`): THE SETUP - the free chairs' regulars in tier order, then by chair,
  none chosen for the player; a regular chosen hears the mod's own invitation over their head; the stake picked only as
  the purse and the night allow, and read again at the deal; the king chosen and kept. THE ARMY - a unit pressed joins,
  or is refused in the law's own word (a thirteenth unit, or points the army no longer has) and shown large either way;
  Remove, Clear, Auto-fill to the points. THE DEAL - the stake leaves the purse and the table holds it; the regular's
  king their seed's crown, the next round the deck when it is the player's; the board's cursor on the player's king.
  THE BATTLE - a press on the cloth read through the frame's own lens as a cell (14.3): at once under a fine pointer,
  snapped within `GAMBIT_SNAP_PX` (22 px) and staged under a finger (Move here, or Strike {name}, with Cancel); the felt
  round the board is taken and presses nothing; another button cancels. The arrows and the d-pad walk the cursor and
  fill the information box, Enter, Space and the pad's A press its cell, Escape and the pad's B cancel - and with nothing
  to cancel Escape is the Stand up press. A PRESS THAT COSTS GOLD ASKS TWICE: Forfeit, and Stand up while a stake is
  down, arm on the first press for `GAMBIT_ARM_MS` (4 s) and act on the second. THE GOLD is settled the moment the game
  is decided - the pot paid, the regular's night booked, the guide folded once the player has finished a game - and the
  result shown after its beat. Every road off the seat forfeits a game under way (the stake the regular's); a load's
  road settles nothing (the save predates the deal); the close frees every mesh and both textures, once.
- THE PANEL (`ui/gambitTableHud.js`, `ui/gambitTableWords.js`) - section 14, built: the chrome of the card panels
  (`cardPanelChromeCss('.dfgambit')`) and the kit's roles for every surface beside the other two panels' (14.1); the
  setup, the army, the turn and the result (14.5); the four plain-words blocks, every number its export's (14.4); every
  refusal word of the law said; units named through Daggerfall Unity's own name list, kings off the Bay deck (14.6); the
  phone's sheet and strip (14.7); the tutorial's page from inside its painter.
- THE CLOTH (`world/gambitCloth.js`, `render/gambitTableDraw.js`): the board laid for the host's chair - along the
  table from an end, across it from a side - and drawn flat on the felt: the mat painted on a canvas from the law's own
  board and the house's marks over it (14.8: a side told by its ring's shape, the chosen in brass, the reach a wash, the
  range an outline, a target the blood ring), each piece its card's picture lying on its cell, its top away from its
  owner. KG4 raises the board.
- THE MOD AS IT SHIPS (10.6): `vendor/kings-gambit/` - the manifest verbatim, the assembly byte for byte, its IL, a
  README with its provenance and the owner's word; the registry's row (`01-Overview/Mod-Registry.md`, permission
  granted, RECORD OPEN for the author's own words); the credit (`ui/credits.js`, the credits' own unnamed form); the
  Features row; the tutorial's page; the 'tavern-cards' page naming the third game.

### 16.1 THE LOG, tabled (10.7, 14.5)

A line an event of the law, the player in the second person and the regular by name; a king inside a sentence is "King
{name}" (16.5). Every line, with its names in, fits one line of the panel (`kg3_panel.test.js` holds each under 64
characters).

| Event | Line |
|---|---|
| game | The board is laid: {layout}. |
| move | Your {piece} moves. / {name}'s {piece} moves. |
| a blow | Your {piece} strikes {target} for {damage}. / {name}'s {piece} strikes your {target} for {damage}. |
| a shot | Your {piece} shoots {target} for {damage}. / {name}'s {piece} shoots your {target} for {damage}. |
| a kill | ... for {damage}. It falls. |
| potion | Your {piece} drinks a potion: +{healed}. / {name}'s {piece} drinks a potion: +{healed}. |
| hazard | Fire bites your {piece} for {damage}. (Spikes, Poison; "hits ... It falls." when it kills) |
| armed | The warnings turn into hazards: {n} hazards are now active. |
| warning | Warning: fire is coming to {n} cells. (spikes are, poison is) |
| turn | Round {round}: your turn. / Round {round}: {name}'s turn. |
| end | You end your turn. / {name} ends the turn. |
| forfeit | You forfeit the game. |
| decided | You win. / {name} wins. / The game cannot go on: no contest. |
| over, result | none - the decision's own line stands |

### 16.2 THE REGULAR'S VOICE (10.5's MEASURE, answered)

The invitation is the mod's own line - "Care for a game of The King's Gambit?" - over the regular's head as the player
chooses them; at the end one of three lines by a roll, the regular's win ("A fine game, and mine.", "Better luck next
time.", "The board is mine tonight.") or loss ("Well played.", "You have my measure tonight.", "Again, and I will have
you."), each held `BARK_MS` (CARDS4b's layer, the regulars' own). The regulars stand in the chairs the setup lists them
by (`cardRegularsNow`'s branch), a player sat in a regular's chair keeping it (AUDIT CARDS-3 E-N3's law).

### 16.3 THE FOUR HOSTS (5.9)

- `scenes/worldModes.js` (interiors) - WIRED: the third slot beside the other two (each game opens by closing the
  others, and every road off the seat closes all three - `standFromCardTable`'s), the press on both panels, the cloth's
  pointer and keys taken at the capture phase while a battle is on (a press on the panel or inside its box the panel's;
  Escape the game's even from the panel), its regulars, its frame and its draw in the room's pass after the decor, and
  `gambitStaked`.
- `scenes/world.js` - WIRED: both save doors refuse while a stake is down, in words (`worldQuickSave`, the pause's
  `savingPrevented`); it mounts the interiors' modes through `createWorldModes`.
- `scenes/exterior.js` - mounts the same modes; no seam of its own (its taverns' tables are the interiors').
- `scenes/dungeonContext.js` - FLAGGED: it stands no tavern, so no card table and no King's Gambit.

### 16.4 THE COAT, AUDITED BY ITS OWN SWEEP

CARDS-PLUS's law - the words a panel writes are its own - run over the third panel (`kg3_panel.test.js`, every stage
painted, every sheet the game injects read as rules) found nothing borrowed; reading the dress and the sheet against
what the painter writes found five things wrong, each fixed at its root:

- THE GRIMOIRE DRESS'S LIT PIP named `.on` where the painter writes `dfgambit-lit` - a dead rule: an action left and a
  tier's step were never re-said in gold leaf on their wooden chip. It names the painter's word; the pin reads every
  class the sheet, the roles and the dress's own block name against what the painter writes.
- ITS INK ON THE WOOD: the rule that inks a name, a term and the result's head reached a unit's name inside its
  picture's well, which is a wooden surface - dark on dark. Scoped to the page (`IN_INK`, `NOT_WOOD`).
- ITS OWN RING on a chosen tile and row overrode the kit's own marks - a tile's gold leaf, a list row's wash (NO-BAR,
  "a row chosen is not marked with a bar"). Gone: the kit's marks stand, as on the other two panels.
- THE RESULT'S TONE: the head's win and loss were both the dress's red ink; the win is the green that is yours and the
  loss the pack's red. And the line under the panel took 'won' and 'lost', words the chrome never styles, over a next
  step: the line's tone is the chrome's three (a refusal, your turn, theirs) and the verdict the box's own.
- ONE HOME FOR THE BOUND: the landscape phone's column restated the chrome's height bound; the 70% sheet and the
  quarter strip are the portrait phone's, and landscape takes the chrome's own.

The classic cut grew with the third panel's own roles (its list rows, its meter's fill, its sections' heads): CARDS-PLUS's
weigh-in is "under half the kit's rules" now (it was a third). The cut, the face and the WARN role's pin take the third
panel; the card panels' sheets and the chrome joined FONT3's floor (`test/ui/font3_readable.test.js`).

### 16.5 FOUND AT KG3

- A KING IN A SENTENCE. The whole title glued into a sentence read "Your Gothryd, King of Daggerfall moves." and
  "Gortwog, King of Orsinium falls." - the closing comma missing, and a fragment glued (ROUTE-BRIEF: one sentence, one
  pattern). A king inside a sentence is "King {name}" now (`kingShort`) - the log's, a refusal's, a press's; the whole
  title stands in a list or a label (the crowns, the army's line, the information box's head), and the fall is its own
  sentence, "{name}, King of {crown}, falls.".
- THE ENGLISH, READ AGAIN BEFORE IT WAS DRAFTED: every count said with its noun goes through the plural ("Fields {points}
  points" became "An army of {points} points", and a unit's cost in a refusal - a Slavic language says 2, 3 and 4 in
  another form than 5); "spikes is coming to two cells" agrees in each branch and counts the event's own cells; the
  warnings that turn "burn now" were spikes and poison too - "are live now"; "You drink a potion on your Rat" is "Your
  Rat drinks a potion", the press "Give {piece} a potion"; "Your king's face." says what it means - "The crown changes
  only your king's face"; the glossary's head is "What the words mean".
- THE FEATURES ROW (10.7) stands on the World tab beside Windmills - no "Gameplay tab" holds a Features row - and is
  titled as every mod's row is, the creator in the title (AUDIT SURV E): the bundle names none, so the credits' own
  unnamed form, "The King’s Gambit by Unnamed (thekingsgambit.dfmod)", one source with the About pane.
- A MOD'S NAME IN THE DRAFTS. The house's drafting rules (`tools/l10n/TRANSLATE-BRIEF.md` rule 6) keep a mod's name in
  every language: "The King's Gambit" stays as it is, as Iliac Hand and Hold'em do on their own panels. The credit's
  title is routed through the text core all the same - the ratchet holds `ui/credits.js` at its count - and every draft
  keeps the name.
- THE LANGUAGES: 14.6's "all 25 languages" was L10N4's first rule; L10N6 (`06-Systems/Localization-Arc.md`) holds the
  thirteen whole languages to the catalog, and the twelve drafting owe a new key with the rest. KG3's 259 keys are
  drafted in-session into the thirteen, each language's new terms added to its glossary.
- A TYPED TWELVE: an army press's refusal decided "full" by a typed 12 and summed the army's cost again; it says the
  law's own word now (`armyRefusal`, `armyCost`).
- THE WARNINGS' CLOCK (found by the mutation run): the panel said when the warnings turn - the information box's round
  and the next step's "at the end of this round" - with a formula true only while `KG_HAZARD_SPAWN_EVERY` is 2. The law
  says it now (`kingsGambit.js:"export const warningsArmAt = (round) =>"`), pinned against a game played on.
- A STALE COUNT: `Tavern-Cards.md` section 40 said KG-SET's pins 4 and its mutants 12 - 5 and 13 since the no-break
  space was found.
- THREE NAMES ALREADY TAKEN (found by the whole suite at the merge of main): `cursorStep` (the gamepad cursor's,
  `systems/gamepad.js`), `pieceLines` (a crafted piece's, `net/recipeLaw.js`) and `pieceKey` (the grass lab's) were
  other modules' names, and the one-home ratchet (`test/systems/talk/audit24_onehome.test.js`) holds a name to one home. The board's
  are its own: `boardCursorStep`, `pieceInfoLines`, `pieceAtlasKey`.
- THE BOARD'S KEYS ARE THE PANEL'S (found by CI's second shard on KG3's head): the cloth read bound keys raw in two
  hosts - `scenes/gambitTableGame.js` keyed its cursor table on the arrows and `scenes/worldModes.js`'s cloth listener
  tested `e.code` for Escape, Enter and Space - which KB1 law 5 (`test/ui/kb1_keybinds.test.js`) and I2
  (`test/scenes/inputmap.test.js`) refuse in a host; and that listener's `window.addEventListener('keydown'` stood above the
  host's own, so V4 (`test/systems/modalkeys.test.js`) and U43, which read the host's handler from its registration, read the
  cloth's instead. The keys are a window's own (ui/input.js's overlayAction is the precedent): the table and its reader
  live in the panel (`gambitTableHud.js:"export const gambitBoardKey = (code) =>"`), both hosts ask it, and the cloth's
  three listeners are taken and let go as one list. The chat's claim is asked of every press key, not Enter's alone -
  the claim answers per press by ActivateCursor's binding, so a rebound open key is yielded wherever it lands.

### 16.6 Pins and mutants

`test/systems/kg3_session.test.js` (7), `test/systems/kg3_panel.test.js` (17), `test/systems/kg3_host.test.js` (13 - the last the host's
wiring: `scenes/worldModes.js`'s card block run as the six harness tests run it, and world.js's two save doors read and
run) and `test/world/card/kg3_draw.test.js` (6); the moved pins of `cardsplus`, `font3_readable`, `plusdress1`, `ft9_mods` (the
row's creator, one source with the credit), `features`, `ft18_features`, `hard4_registry`, `auditcards2_host`,
`auditcards6_e` and `l10n3e_names` (the words module a name site), and the six harness tests' scopes. Mutants: `tools/mutants/kg3.json`, 139 - 138 dead and one recorded equivalent (a draw after the close: the board's own
draw returns once it is destroyed). Ten survived the first run, each a pin that did not hold what its title claimed, and
each is strengthened: the pips after an action and on the regular's turn; the warnings' clock at both of its arms; the
regulars' order where tier and chair disagree; a second close after a load's road; the pad's A and a finger's stage,
which ran only when the king could move; the snap radius's edge, at a phone's scale where it decides; a game for fun
under way holding no save; the guest's notched ring; and a refused command's state (a shallow copy was no mutant - the
record is a refusal that ends the turn now); seven older records
re-aimed by content (`auditcards5` faces5-F23, `cardsplus` CP-warn-dropped and CP-B4-frame-off-screen, `kgset`
KGSET-painter-words-english, `navaudit_boarding` NAVB-B14, `auditcards6_e` AC6-E2-panel-box - at `insidePanelBox`, the
panel's box test's one home now - and `cards3b` C3b-host-bubble).

- **Not yet:** the board raised (KG4 - SHIPPED, section 17); online (KG5); gold online and the season board (KG6).
- **Ledger:** section A row THE KING'S GAMBIT - THE EVENING OFFLINE.

## 17. KG4 (2026-10-14): the board on the cloth

The owner, of the open pull request: "Pick up the PR working on the new minigame", and on the slices left: KG4 in this
pull request, KG5 and KG6 after it. KG3's board was a flat mat with the pieces lying on it; KG4 BUILDS it and STANDS the
cards, as sections 5.3, 5.4, 10.1, 10.7, 14.3, 14.7 and 14.8 decided.

- THE BOARD BUILT (5.3; `render/gambitTableDraw.js`): the mat a slab `GAMBIT_MAT_LIFT` proud of the felt, its edges down
  to it (`matModel`, a quad a cell); every water cell `GAMBIT_WATER_DROP` under the mat with its recess's walls, the
  mod's two ripples drifting over it; every wall a stone block a cell square and `GAMBIT_WALL_H` high, its courses and its
  lit top edge painted on it; every pillar a column `GAMBIT_PILLAR_R` of a cell round and `GAMBIT_PILLAR_H` tall
  (`stoneModel`, one model for a board, made again only for a new board). The mat stays KG3's painting, the marks of 14.8
  on it.
- THE CARDS STANDING (10.1): each piece its card upright in its stand - a turned disc (`discModel`) `GAMBIT_DISC_SHARE`
  of a cell across and `GAMBIT_DISC_H` high, the host's the kit's bone, the guest's its dark stone with its rim notched,
  a king's brass ringed in its side's tone, every rim edged in the kit's outline and a bone line, the chosen's brass; the
  card a STANDEE (`gambitPlateModel`): its picture on both faces, the back's u turned so it reads the right way round
  from behind; its face to its owner (`standingMatrix`: X x Y = Z, a rotation - a mirrored face is a culled one); the
  chosen card lifted `GAMBIT_SELECT_LIFT`; its health a bar over its top edge turned to the viewer, banded like the
  vitals, its length the value (14.8).
- THE MOTION (`world/gambitMotion.js`), every timing the mod's, read off its IL (2.10, `EffectOffset`, the attack's
  visuals): the walk along the path the move took at 3.5 cells a second - the law's own walk kept as a path
  (`kingsGambit.js:"export function reachPath(board, p, col, row) {"`, on the board before the move: AUDIT KG C22); a
  blow's impact AttackTiming's default 0.2 s after the order, its lunge from 0.1 s before it for 0.28 s, 0.15 of a cell
  for a melee blow and 0.06 for a shot, a shot's bolt 0.3 s; the hit 0.45 s - EffectOffset's knock of 0.22 of a cell
  along the blow, dying away, and its jitter of 4 px on the mod's cell at a 1080-line screen ((1080 - 190) / 13 px: 0.058
  of a cell), none under reduced motion (14.8) - and the face red the while (the atlas's hurt tint through the
  renderer's texture remap); a potion's 0.6 s glow, green; the number rising 0.8 of a cell over 1 s, signed, in a glyph
  strip painted in code (three by five, the HUD's hard outline all round); the fall 0.27 s after the blow lands, a topple
  flat away from the attacker (back from its owner, a hazard's victim) and a slide to its owner's FALLEN PILE - together
  the mod's 0.6 s - where the cards lie fanned along the board's edge and count the losses at a glance (`gambitPile`,
  `gambitPileStep`: off the board, on the felt, at the owner's right hand by its own edge); THE MUSTER at the deal, each
  side's king first and then its units in the deployment's order, one each `GAMBIT_MUSTER_BEAT_S`, thrown on Iliac
  Hand's arc from its owner's edge and stood up as it lands. A piece's motions queue: a second order waits for the first,
  a blow's foe is struck after its attacker has come.
- THE HAZARDS (DrawHazard): fire's three flickering flames, spikes' six steel spikes raised, poison's rising bubbles, a
  warning's pulsing ring and its bobbing "!" - each over KG3's painted mark.
- THE SHOT (10.7): four bright squares on the line from the shooter to its target over the bolt's 0.3 s, at a card's
  mid-height.
- THE PRESS ON THE BUILT BOARD (14.3): `gambitCloth.js:"export function gambitPressCell(places, board, eye, dir, selected = null) {"` -
  the nearest of a standing card's face (its cell), a wall's top (the wall's cell, which presses nothing), a pillar's top
  and the mat; never the cell a ray reaches on the mat behind a card. Under a finger a piece snaps by its card's middle,
  where the finger sees it.
- THE LEAN (10.7, 14.7): `gambitCloth.js:"export function gambitLean(places, { aspect, fovY, clear: given = { x0: 0, x1: 1, y0: 0, y1: 1 }, pitch = GAMBIT_LEAN_PITCH }) {"`
  - SOLVED, not guessed: pitched `GAMBIT_LEAN_PITCH` (55 degrees) down over the board, the eye moved back along its line
  of sight and slid square to it until the board's corners and its head row's cards standing fill `GAMBIT_LEAN_FILL` of
  the CLEAR screen and stand centred in it. The clear screen
  (`gambitTableGame.js:"export function gambitClear(box, { w, h, rect = null }, touch = false) {"`) is the largest of what
  lies left of the panel, right of it and above it - the desktop's column, the phone's strip, the landscape phone's
  column - under the touch layer's presses (`GAMBIT_TOUCH_TOP_PX`) on a touch device, read in the world's strip. The
  battle leans in over `GAMBIT_LEAN_S` (at once under reduced motion) from the seat's own eye and look and back out with
  the result; the setup, the army and the result keep the seat's view. The interior host lays it on the seat's eye after
  the seat's own and before the camera machine reads it (`worldModes.js:"    if (gambitLeanNow) cam.pos = gambitLeanNow.eye;"`),
  and the view looks along it.
- THE LAB (`src/tools/cardsLab.js`, `cards.html?game=gambit`): a game against a regular played on the law, its motion
  fed, drawn at a chosen moment; `cam=lean` the lean fitted to the lab's own panel, `cam=close` a close look at the cards
  standing, `chair=long` a long side's chair; `__gambitState` the board's corners and a cell's size on the screen.
  `tools/cardPanelsProbe.mjs` gives the three panels' one probe The King's Gambit's setup, army, battle and result, and
  `tools/cardsPhoneProbe.mjs` its frame cost.
- THE FOUR HOSTS (5.9; AUDIT KG II C12 - this section had named `scenes/worldModes.js` alone): `scenes/worldModes.js`
  (interiors) - WIRED: the lean (the frame's `cam.pos`), the board's draw in the room's pass, KG4b's `play3d` at the
  cloth, and since AUDIT KG II the pad's and the finger's presses at a battle (C1-C4: the Escape action, LeftClick's
  alias, `cardPressHeld`, `gambitBoardUp`). `scenes/world.js` and `scenes/exterior.js` - WIRED for C4 alone (the pad's
  `board` hook, `ui/gamepadInput.js`); both mount the same modes, no seam of their own besides. `scenes/dungeonContext.js`
  - FLAGGED: it stands no tavern, so no board to lean over.

### 17.1 THE MEASURES

- THE LEAN (10.7, 14.7), by the three panels' probe (`PROBE_ONLY=gambit node tools/cardPanelsProbe.mjs`: the battle over
  the lab's leaning board, in each look - its four scenes' 742 checks, all held): the board stands clear of the panel - its column, its
  strip - at every size and in every look, and a cell on the screen is 35.3 px at a 1280x760 desktop (51.1 with the
  panel folded); 16.7 px in a 1000x560 window under the unfolded panel (15.2 under the Grimoire dress), 36.0 folded;
  21.7 px on a 390x844 phone; 19.9 on a 360x740; 25.3 on an 844x390 phone under a finger. The snap's 22 px is the 390
  phone's whole cell (14.3 had measured 26 px a column at best before the lean). At a desktop's whole screen from a long
  side the solved eye is 0.57 m over the felt and 0.07 m back from the board's near edge - the record's first guess was
  0.62 and 0.10 - and a phone held upright lifts it to some 1.9 m over the felt, where the board's 1.06 m fits the 33
  degrees it sees across.
- THE 1000x560 WINDOW: the panel unfolded leaves the board a band 127 px tall over it; the fold gives it 36 px cells.
  RECORD OPEN: whether the battle's panel at such a window should take the strip a phone's does (14.7 is the phone's law).
- THE MUSTER'S BEAT (10.1): kept at the first guess, 0.12 s - a side's thirteen cards are all thrown and standing 1.86 s
  after the deal (twelve beats and Iliac Hand's 0.42 s throw); a first order waits for its piece's own throw.
- THE FRAME'S COST (`tools/cardsPhoneProbe.mjs`'s King's Gambit row; ten frames a run, three runs alternated - the
  probe's own thirty and seven outlast its page's half hour on this container, whose software GL takes 2.1 s for the bare
  room at a desktop's size): from the lean the board adds 724 ms to a 3.8 s room frame at 1100x640, and 191 ms to a 1.9 s
  one on a 390x844 phone at a quarter of the CPU (Iliac Hand's cloth: 18 and 7 ms); from far over the table, the board
  small on the screen, 47 ms. The cost is the board's PIXELS - the lean fills the screen with it by design, and the
  software GL shades every one on the CPU - not its draws: a ceiling, not a phone's number (CARDS3c's caveat), where a
  phone's GPU lays one more textured layer over the felt for little.

### 17.2 FOUND AT KG4

- THE BOARD'S KEYS, READ RAW (CI's second shard on KG3's head; section 16.5): the panel's own keys now, `gambitBoardKey`.
- A BEAR'S CARD IN A CORPSE-FOOD PIN: KG-SET gave the Grizzly Bear its card, and `test/systems/survival/survtiers3.test.js`'s
  CORPSE-FOOD, mounted held every item on a joiner's copy of a bear's body to raw meat "(a bear has none)" - so the
  death's card roll (`Math.random`'s) failed CI some runs. The roll is pinned to drop, and the card held to the bear's
  own, once.
- THE LEAN'S PROJECTION, PROVED THROUGH THE RENDERER'S OWN LENS: the first solver centred the board on the screen's
  mirror image (its screen's up the wrong hand) - the lab's phone showed it, and the pin that would have caught it read
  the solver's own box. The pin reads the frame's matrices now (perspective, mirrorProjectionX, lookAt), and the
  mutant that turns the up's hand dies on it.
- THE PRESS AND THE SNAP AT THE HOST: two mutants survived the first run - the flat press, and the snap at the cell's
  centre - for no host pin told them from the built board's. Each has its own now (a card's upper face over another cell
  of the mat; a point beside a card, near its middle and past its cell's centre).
- SOUND (5.6) had been left out of KG4 for want of SoundClips.cs to name the clips; the owner: "Download daggerfall if you
  need to implement things". Taken: section 17.4.

### 17.3 Pins and mutants

`test/world/kg4_board.test.js` (12): the walk's path against GetReachable's own walk; the motion on the mod's clock (the walk
round a wall, the lunge, the shot, the hit, reduced motion, the number); the fall, the pile, the potion and the muster;
the piles on the felt; the press on the built board; the lean in the clear screen and through the renderer's own lens;
the clear screen; the built board's models; the cards standing; the effects' atlas; the draw's allocations; a whole
seeded game's motion. `test/systems/kg3_host.test.js` (15): KG4's host pins - the motion fed and the lean phased, eased and laid
by the interior host; the built press and the card's-middle snap. The moved pins of `kg3_draw` (the slab; the five
textures) and `kg3_host` (the press's finger by a card's middle; the muster before every piece is drawn). Mutants:
`tools/mutants/kg4.json`, 35, all dead; `kg3.json`'s KG3-D-triangle and KG3-D-scale re-aimed (the builder's winding, the
standing card's scale), dead.

- **Not yet:** online (KG5); gold online and the season board (KG6).
- **Ledger:** section A row THE KING'S GAMBIT - THE BOARD ON THE CLOTH.

### 17.4 THE SOUNDS (KG4b, 2026-10-15)

The owner: "Download daggerfall if you need to implement things. Fucking finish everything." Daggerfall Unity's
`Assets/Scripts/SoundClips.cs` (master 2343305d) names the clips the mod's IL plays by number, and
`systems/soundClips.js` carries the ones it now plays: SpookyMid 1, ArrowHit 4, CastSpell1-5 81-85, SpellImpactMagic 86,
SpellImpactPoison 87, SpellImpactFire 89, Hit3-5 110-112, PainSound 299, Groan 458.

- WHERE THE MOD PLAYS THEM, read off its IL - PlaySound (now, or scheduled seconds on), PlayAttackSounds, HazardSoundOf,
  MovePiece, Heal, ApplyHazards, HazardTick, FinishMatch, TryAdd, AutoFill, OnCellClicked, EndTurnClicked,
  StartBattle, OpenChallenge, DrawChallenge:
  - a monster's walk: its own move clip as it sets off, and again at steps / 3.5 x 0.5 s when it walks more than a
    cell; a calling's walk none (a clip only for an id under 128 - PlayMonsterSound plays only a clip above 0);
  - a blow: a shot by an archer (ArcherClasses 141, 142) ArrowShoot at its impact and ArrowHit as it lands, by a mage
    one of CastSpell1..5 and SpellImpactMagic; a melee blow a calling's swing (SwingLowPitch, SwingMediumPitch,
    SwingHighPitch) or a monster's own attack clip as the order is given, and one of Hit1..Hit5 as it lands; then the
    struck - BodyFall 0.3 s after it lands if it fell, else a monster's bark or a calling's PainSound 0.1 s after;
  - a potion MakePotion; a hazard's bite its kind's clip (fire SpellImpactFire, spikes Hit3, poison SpellImpactPoison)
    and BodyFall 0.3 s on if it killed; a new warning pair SpookyMid; the deal DrawWeapon;
  - the table: opening the game DiceRoll; a stake put down GoldPieces; a unit joining, Auto-fill, a piece chosen and End
    turn (when the player can act) ButtonClick; the result at its 1.3 s beat - a win ArenaFanfareLevelUp and, with gold
    down, GoldPieces 0.6 s after; a loss on the board the Groan - a forfeit nothing (AUDIT KG II C11: the line had said a
    forfeit groans too; the mod's Forfeit runs ChooseArmy, whose `pendingSounds.Clear` (IL_098f) leaves FinishMatch unreached).
- ON THE MOTION'S CLOCK (`world/gambitMotion.js` - `cue`, `sounds`): every one of the game's cued against the same
  schedule the pieces move by, so a blow rings when it lands on the cloth and a queued order's sounds wait with it; the
  table's own cued there too by the host. A pick among a set is the table's own source's (`createGambitMotion`'s `pick`).
- AT THE CLOTH (5.6's trap): `scenes/gambitTableGame.js` plays each through its `play`, which the interior host lays on
  the room's 3D sound at the cue's cell, or the board's middle for the table's own
  (`worldModes.js:"      play: (clip, at) => audio?.play3d?.(clip, at, 1, { maxDistance: 16 }),"`) - never the flat
  one-shot PEERFX1's observer reads, where Hit1..Hit5 at volume 1 would tell the room the player was struck.
- PINS: `test/world/kg4_board.test.js` KG4b (the game's sounds on the clock), `test/systems/kg3_host.test.js` KG4b (the table's, the
  result's groan at its beat, the 3D sound) and the win's fanfare and coins in KG3's game played by presses. MUTANTS:
  `tools/mutants/kg4.json`'s KG4b records, 11, all dead.

## 18. KG5 (2026-10-15): online - the relay runs the game

The owner: "Download daggerfall if you need to implement things. Fucking finish everything. Weve worked on this for
days." Section 5.8's decisions, built: a King's Gambit table in the relay beside Hold'em's and Iliac Hand's, the client's
mirror, spectators, the clock; friendly.

- THE TABLE'S LAW (`net/gambit/gambitTable.js`, pure and plain data - the relay checkpoints it whole, Iliac Hand's table's
  twin): two seats of a cloth's chairs, the first the law's host (side 0, its king's row the board's foot at its chair);
  a sit names its chair and its crown (`gambitSitRefusal`'s words asked first); READY carries the army (roster ids,
  the law's `armyRefusal`) and, again, the crown - kept by the relay, never told: the room hears only that the seat is
  ready, and both ready deal GAMBIT_FIRST_MS on (`newGambit` from the relay's own CSPRNG, both armies on the board in
  the open). A COMMAND is the law's (`gambitAct`, its refusal in its own word), in the game the panel showed ('stale'
  past it); a turn ends GAMBIT_TURN_END_MS after its last action (`finishTurn` on the alarm). THE CLOCK (10.7):
  GAMBIT_TURN_MS, 60 s a turn - a turn run out ends as End turn does (`timeout`), and a seat whose turn it ended
  GAMBIT_IDLE_TURNS times running is stood up, the game the other's ('idle'); an action of its own starts its count
  again. A FORFEIT keeps its chair; a STAND - or a socket gone - leaves it; both give the game to the other seat
  (`result` with `how`: 'king', 'forfeit', 'idle', 'left', or 'void' when the relay's source broke or the room drained).
  After a game both seats are ready again only by saying so. The room's events and the whole table go to every socket in
  the building (`gambitPublicView` - nothing of a dealt game is hidden, section 11), so the tavern watches the board.
- FOUND: the law's own `end` (End turn) and the table's end of a game were one event name - the client's check refused
  every End turn frame; the table's is `result` now, the law's `end` the turn's.
- THE STORED TABLE, CHECKED (AUDIT KG A4): `gambitTableValid` / `validGambitState` - every field the law's steps read, of
  its type and in its range: the board and its hazards, each piece a roster unit or a king on the board's floor, one a
  cell, numbered apart, its health within its whole; the turn, the actions, the round, the potions, the end; a game with
  an empty seat, an unlawful army at Ready. The room drops a table this refuses as it loads it, and says so on the
  console (`server/src/index.js:"          if (gambitTableValid(v)) this._gambit.set(Number(k), v);"`).
- THE RELAY'S SEAMS (`server/src/index.js`, Iliac Hand's one by one): the `gambit` storage key and a `Map` a room
  (`_gambitOf`, `_gambitSave` - the alarm armed at the soonest clock); the `gambit` arm in the socket's dispatch, its
  gate bucket of its own (holdemGate's rate); `_gambitWord`'s ops; the alarm's third table (`gheld`); the socket's close
  (`_gambitLeave` - a socket gone forfeits); the room's sweep (`_gambitGhosts` - a drained room's game no contest, every
  seat stood). ONE CLOTH, ONE GAME, ALL WAYS: each game's sit refuses 'other game' while either other holds that index,
  and a sit at any one stands the player up from the other two. 10.7's GREEN TABLE: a sit at the realm's gold table is
  refused 'gold table' until KG6 brings gold. No table in a layer ('busy'); none outside an interior. FOUND: Hold'em's
  and Iliac Hand's own words for 'other game' named each other ("Iliac Hand is being played at this table.") - with a
  third game they say "Another game is being played at this table."
- THE WIRE (`net/wire.js`): `parseClient`'s `gambit` arm after a hello only, GAMBIT_FRAME_MAX (a Ready at its longest
  - twelve ids and a crown - fits); `validGambitIn` (each op's fields, a command's numbers in range) and
  `validGambitOut` (a refusal, the room's events by kind, the table and its game the law's). GAMBIT_RELAY_MIN 204 (AUDIT KG II B14) and
  `relaySupportsGambit` - an older relay closes the socket on the frame. RELAY world204 (world203 on its branch, renumbered past main's FIVE-ASKS world202 at the merge): `net/gambit/gambitTable.js`,
  `net/kingsGambit.js`, `characters/enemy/enemyBasics.js` and `systems/mathf.js` joined the bundle (`test/net/relayversion.test.js`
  RELAY_GRAPH); world203 is KG-SET's, renumbered past main's CHAT-TRADE world201 and FIVE-ASKS world202 at the merges.
- THE CLIENT: `net/online.js` - `sendGambit` through its own gate to a relay that runs the game, `gambitOk` at the
  welcome, a frame heard from the room the player stands in and checked by the table's law; `scenes/world.js` -
  `online.onGambit` to the modes, `host.gambitOnline` (Iliac Hand's hooks, its own send).
- THE MIRROR (`systems/gambit/gambitRemoteTable.js`): `RemoteGambitTable` - the seats, readiness, the relay's clock through the
  skew; `RemoteGambitSession` - one dealt game with the offline session's own face (`state`, `act`, `tick`, `forfeit`,
  `drain`, `playing`, `over`, `shown`, `settlement`), so the panel, the log, the motion and the cloth read it as a game
  with a regular. THE GUEST'S EYE: seat 1 reads the board turned about its middle (`flipGambitState`; the four layouts
  are point-symmetric), its commands turned back (`unflipCommand`), so it is side 0 at its own foot. A command is checked
  by the law here first (a refusal said at once), then sent - one on its way at a time, let go after GAMBIT_SENT_MS
  unanswered. The other side's actions shown GAMBIT_REMOTE_GAP_MS apart (10.7, the mod's RemoteActionGap). The relay's
  `result` decides the game, shown after GAMBIT_RESULT_MS; friendly, it pays nothing.
- THE BOARD ON THE CLOTH, ONE FOR BOTH (`world/gambitCloth.js` gambitPlaces `flip`): laid from the host's chair for
  everyone - the guest's turned, so every cell lands on the felt where the host's lies, each king's row at its own
  player's edge.
- THE SEAT (`scenes/gambitTableGame.js`): with a relay that runs the game, at the friendly table, the setup offers the
  board's two seats - Sit at the board, the crown, Play a regular instead; seated, the army and Ready (Not ready takes it
  back; a change to a ready army takes the Ready back first; Leave the board); the deal opens the battle as with a
  regular; a game under way watched by a player at the cloth unseated - the host's side as side 0, both sides named by
  their players, no log, no press of the game's, no lean; the result's own line (the other gone, away, giving up); Play
  again builds the army for another game. A new welcome asks the table again; every road off the seat stands up from the
  board, forfeiting a game under way. The panel's words through the text core, 37 keys drafted in the thirteen whole
  languages (the twelve drafting languages owe them - AUDIT KG II D23: the line had said every language the catalog keeps) (`ui/gambitTableWords.js`: GAMBIT_ONLINE_PRESS, onlineSeat, clockChip, onlineStep, onlineEnd,
  onlineRefusal, watchWin; the log's `timeout` and the other side's forfeit), the turn's clock on a chip.
- THE TAVERN WATCHES (`scenes/worldModes.js`): a King's Gambit table within CARD_WATCH_M is asked once each approach and
  its board drawn on its cloth from the host's chair (`gambitOnlineFrame`, `gambitWatchFrame`, `gambitWatchDraw`), let
  go walked away from, sat at, or with the interior.
- MEASURE (KG5, 10.7): the 60 s clock stands until a table's games are timed - the mod's own peer timeout is 40 s and
  Iliac Hand's turn 45 s; a turn of two actions read off the board with the panel's help sits well inside it.

### 18.1 Pins and mutants

`test/net/gambit/kg5_table.test.js` (9): the seats and their refusals; the armies at Ready, never told, the deal's pause and the
relay's dice; the commands, stale and refused, the turn's end on its beat and the other side's own clock; the clock's
timeouts and idle stand-up, the count started again by an action; a forfeit and a stand; a whole game at the relay to a
king's fall, every frame the client takes; the stored table checked; the wire both ways; the guest's eye (twice the
board, the law reading the turned board as the board). `test/net/kg5_relay.test.js` (5): the relay itself on the fake room -
two seated and a watcher, the alarm's deal and clock, a hibernation; a socket gone, the gold table, a hallway; one cloth
one game all ways; the stored table dropped and the sweep; the wire's arm and the version. `test/net/kg5_client.test.js`
(5): the room's table on the client; the online session (the guest's eye, the check, one command at a time, the gap,
the result's beat); the guest's board on the cloth; the client's session (the gate, the room); two pages and a watcher
over the relay - sit, Ready, the deal, a move on both boards in one place, the turn round, the watcher's board and keys,
a forfeit and its words, Play again, Play a regular instead, every mesh freed. PINS MOVED: every pin that names the
relay version (world204); `cards10_client` and `auditcards6_e`'s 'other game' words. Mutants: `tools/mutants/kg5.json`,
48, all dead (49 at KG5 - KG6 retired KG5-R-gold-table with the gold table's refusal it pinned; AUDIT KG II E6); `kg3.json`'s KG3-S-beat-turn-end (the beat's one home moved to the table's law), KG3-H-concession and
KG3-H-loads-road, `kg4.json`'s KG4-G-lean-phase and `worldhover.json`'s setMode pair re-aimed by content, dead.

- THE FOUR HOSTS (5.9; AUDIT KG II B15 - this section had not named them): `scenes/worldModes.js` (interiors) - WIRED:
  `openGambitGame`'s online hooks, the room's frames (`gambitOnlineFrame`), the watched boards (`gambitWatchFrame`,
  `gambitWatchDraw`) and a stand the link would not carry said again (`gambitStandsDue`, AUDIT KG II B12).
  `scenes/world.js` - WIRED: `online.onGambit` and `host.gambitOnline`. `scenes/exterior.js` - mounts the same modes; no
  seam of its own (its taverns' tables are the interiors'). `scenes/dungeonContext.js` - FLAGGED: it stands no tavern,
  so no board online.
- **Not yet:** gold online and the season board (KG6 - section 19).
- **Ledger:** section A row THE KING'S GAMBIT - ONLINE.

## 19. KG6 (2026-10-15): gold at the red table, and the season's Grandmaster

The owner: "Fucking finish everything." Section 10.7's last two decisions, built: "gold online through CARDS6's escrow at
the red table, at the mod's online stakes (10, 50, 200, 1,000 and 5,000 each), the winner's receipt carrying both stakes;
and a season board the Arena's way, its Elo and its caps, whose #1 over 10 games against 5 foes (Iliac Hand's champion's
floor) wears GRANDMASTER - the mod's highest tier's name."

- THE STAKES' ONE HOME (`net/gambit/gambitStakes.js`, a leaf every end imports): GAMBIT_ONLINE_STAKES, the mod's five; and
  GAMBIT_STAKE_BB, the big blind a King's Gambit stake is held at in CARDS6's escrow - 1, which no Hold'em table plays
  (`holdemTable.js` HOLDEM_BBS 2, 10, 50) - so the escrow tells the games apart, and the service's bound on a cash-out
  (`cashoutCards`: no more than every stake that came to the room, table and big blind over the receipt's life) counts
  the table's King's Gambit stakes alone, never a Hold'em buy-in at the same red table - and, since AUDIT KG II A4 (the
  sentence said "a pot's two stakes alone", which that sum is not: it is every King's Gambit stake at the table in 30
  days), a King's Gambit cash-out is no more than twice its own stake, the pot it can have won.
- THE ESCROW'S ARM (`server-account/src/cards.js` stakeCards; AUDIT KG C24, "an arm of their own"): a stake at
  GAMBIT_STAKE_BB is one of the five, at the room's gold table alone ('bad-table' elsewhere), never a top-up
  ('bad-buy-in'); held off the realm record and answered with the service's stake order, as a Hold'em buy-in is.
- THE TABLE'S LAW (`net/gambit/gambitTable.js`): a table made at the gold table is gold. Its Ready carries the stake - the
  relay's spent order's `{j, sub, amount}` - and is refused 'stake needed' without one; a friendly table's refuses one
  ('friendly table'); the second seat's must match the first's ('stake differs'); a seat says Ready once ('ready'), and
  `gambitReadyRefusal` asks all of it before anything is spent. The room is told each seat's stake and, once dealt, the
  pot - never an account. A stake never dealt goes home whole: Not ready, a stand before the deal, a deal the source
  broke ('stood', 'void'). THE POT AT THE END: the whole of it the winner's ('stood', both stakes - the winner's receipt
  carries them, 10.7), nothing the loser's ('broke', 0) - a king's fall, a forfeit, a seat the clock stood up or one
  that left alike; no contest, each stake its own ('void'). The cash-outs queue on the table (`cashouts`) for the relay
  to sign. A RATED GAME: two seats of two accounts (each seat keeps its sit's account), somebody's win - its result
  queued (`results`) with the game's id (16 hex from the relay's source at the deal). A stored table's stakes, pot,
  accounts and queues are checked as its game is (AUDIT KG A4).
- THE RELAY (`server/src/index.js`): `_gambitReady` - the service's stake order verified (its kind, its account, this
  room, this table, GAMBIT_STAKE_BB; 'stakes closed' in a layer or a room that cannot sign), the table read again after
  its await, the Ready's own refusals asked BEFORE the order is spent (refused unspent: the device's stake book voids it
  back through Hold'em's own `void`), then spent once (`cstake:`) - a refusal after the spend hands the whole stake back
  in a 'refused' cash-out. `_gambitOwedOut` at every save: each cash-out by CARDS6's own `_holdemReceipt` (kept for its
  account, sent on the card table's word - the client's stake book claims it), each rated result minted
  (`net/gambit/gambitReceipt.js` g1) and kept owed to both accounts (`gowed:`, Iliac Hand's law) until the device acks it,
  told again at a look, a sit and a hello; each off its queue only once kept - but a result that will not mint (no key
  the relay can sign with) is let go, said on the console, never kept (AUDIT KG II A7: the sentence had said none was);
  an empty table never forgotten with one unsigned. The sweep lets expired `gowed:` go.
- THE RECEIPT (`net/gambit/gambitReceipt.js`, `g1`): `{j, f, r, h, i, e}` - the game, the two accounts (the host's first), the
  winning seat (no draw: a game nobody won is no receipt), how (`king`, `forfeit`, `idle`, `left`), a week's life; the
  version inside the signed bytes, so an Iliac Hand receipt is never a King's Gambit one, nor the other way.
- THE SEASON BOARD (`server-account/src/gambit.js`, migration `0115_gambit_ladder`): Iliac Hand's board's twin for a
  game with no deck to vouch for - one row a game whichever seat carries it (`/v1/gambit/claim`), the arena's Elo and
  season, a pair's day and season capped, a rating written only while both ratings stand as read; the board
  (`/v1/gambit/board`) a top ten, the caller pinned, its #1 and what the title needs. GRANDMASTER (`grandmaster` in the
  token's titles, `titles.js`, its badge `ui/playerBadge.js` in a king's purple): the season's #1 with
  GAMBIT_CHAMPION_MIN_GAMES (10) rated games against GAMBIT_CHAMPION_MIN_FOES (5) foes, counted on the rows, kept for
  every Worker (`gambit_champions`), counted by the minute clock (`cron.js` 'gambit-champion'), laid on the badge's
  doors, letters and the notice board beside Iliac Hand's, lapsing when another takes the top - last in the token's titles, after main's I Love Lamp. ACCOUNT acct134.
- THE CLIENT: `net/online.js` takes a rated result from the room just left too; `scenes/worldModes.js` carries it
  (`host.gambitClaims` - `net/gambit/gambitClaims.js`, Iliac Hand's carrier, `net/iliac/iliacClaims.js` taught another reader and
  store) and acks it; `scenes/world.js` the door (`net/accountClient.js` accountGambit) and the town's word when a game
  counts. AT THE RED TABLE: a realm character at a relay that deals Hold'em's escrow plays another player for gold
  (anyone else plays the regulars there); the army's panel offers the five stakes - each the purse's to cover and the
  other player's to match, what it wins said under the picks - and "Ready - stake {n} gold" asks the realm service
  first (the card tables' stake book, the record's own act), then the relay with its order; the stake book is told once
  the relay sat it, and the cash-outs come home by its claim. The result says the pot (the win's both stakes, the
  loss's one), as a regular's game says its stake. The season board from either table (Season board).
- 28 keys drafted in the thirteen whole languages; the game's name kept, as everywhere.
- THE FOUR HOSTS (5.9; AUDIT KG II B15): `scenes/worldModes.js` - WIRED: the rated results carried and acked, the gold
  table's hooks (`gambitGoldOk`, the stake, the purse, `seated`, the season board). `scenes/world.js` - WIRED:
  `gambitDoor`, `gambitClaims` (and its tick, in every mode), `host.gambitSeason`. `scenes/exterior.js` - mounts the
  same modes; the claims' tick is world.js's, so a result is carried outdoors too. `scenes/dungeonContext.js` - FLAGGED:
  no tavern, no gold table; the claims' tick runs there as everywhere (world.js's).

### 19.1 Pins and mutants

`test/net/gambit/kg6_gold.test.js` (5): the stakes' law; the gold table's Ready (needed, matched, refused at a friendly table, said
once, refunded by Not ready and a stand, the pot dealt and stored); the pot at the end (a forfeit, a stand mid-game, no
contest, one account twice no rated game; the wire's `ack` and staked Ready); the relay at the gold table (the order's
checks, refused unspent, spent once, the forfeit's cash-outs and the rated result signed, owed until acked, told again
at a look, a spent order refused, Not ready's stake home); the escrow's arm and a pot's cash-out bounded by the table's
King's Gambit stakes alone. `test/net/gambit/kg6_season.test.js` (5): the receipt; the claim; the board and its Grandmaster (the
mint, the minute clock, the lapse); the carrier; the gold table's panel (the picks' bounds, the staked Ready, the book
told, the board shown). PINS MOVED: `kg5_relay`'s gold table (it seats now, its Ready a stake); every pin that names the
account version (acct134 - acct133 on its branch, renumbered past main's LAMP-KEEPER II at the merge); the relay's law row (world204, its bundle with gambitStakes.js and gambitReceipt.js).
Mutants: `tools/mutants/kg6.json`, 44, all dead; `kg5.json`'s KG5-R-gold-table retired with the gold table's
refusal it pinned (AUDIT KG II E6: the section had not said so).

- **Ledger:** section A row THE KING'S GAMBIT - GOLD AND THE SEASON.

## 20. AUDIT KG II (2026-10-15): the slices since the first audit, read cold

The owner: "Lets do last comprehensive audit and ensure perfection." Five cold lanes on a frozen snapshot (6e4441a72) -
the money and the relay, the online client, the board and the offline game and its sounds, the UI and the words in
every whole language, the record and its tests and mutants - 83 findings, every one reproduced before it was acted on;
the page is `01-Overview/audits/Audit-Kings-Gambit-II.md`, each finding with its verdict. What it changed, as the sections
above now say it:

- A STAKE IS NEVER LOST TO A PRESS (A1, B1, B8, B12, C1-C3): every stand names the game its panel showed - one naming
  the game before, heard within GAMBIT_LATE_MS of the deal and before the seat acted, lets the game go, each stake home
  (`gambitStand`'s `gameNo`, `spoke`; Iliac Hand's AUDIT CARDS-6 E13); one stake on its way at a time and none past a
  Ready, a pick the other seat's stake closed never asked of the realm; a stand the link would not carry said again
  each frame (`gambitStandsDue`); the pad's Start (an Escape action's key) and A's LeftClick alias (Mouse0) the
  board's while a battle is on, and a finger the cloth took never the touch layer's stick (`cardPressHeld`).
- THE GAME ONLINE AS THE RELAY HOLDS IT (B2, B3, B10, B11, B13, B17, B18, A2): a game ended while the socket was away
  read off the table's `last`; a watcher is one who opened the game unseated; a press made while one is on its way held
  (GAMBIT_HELD_MAX) and sent once the board is told; a watched board let go with its table; a sit on its way stood up
  when the panel goes; a new socket's look asked until it goes; no muster for a game come upon mid-way.
- THE RELAY'S MONEY LINES PINNED (A3, A8, E1-E5, E9-E12, E20): the order's room, the drained room's no contest, a
  room that cannot sign, a queue kept until signed, the stored queues' ids, a broken source no contest at a blow, a
  turn's end and the deal, the season's caps, a rating written only on the ratings read, the #1 recounted; the escrow
  holds a King's Gambit cash-out to twice its stake (A4).
- THE BOARD (C4-C9, C13, C14): the d-pad the board's cursor under the Plus crossbar (the pad's `board` hook); the lean
  never thrown away by a sheet over the whole view (GAMBIT_CLEAR_MIN); the beat after a forfeit nobody's turn; the
  chosen card pressed where it is drawn, lifted; the information box's foes by name and its cell's hazard; a regular's
  night the tavern's; a finger on a foe's card that foe; one's own piece chosen again, never toggled off (the mod's
  OnCellClicked, IL 0x4620); a forfeit silent (C11 - 17.4).
- THE PANEL AND ITS WORDS (D1-D23, B4-B7, B16): the three online presses' words put back in the thirteen whole
  languages; the phone's strip - the watcher's presses and More, the clock first; a watcher's game nobody's own and its
  pot the winner's; the guide and the words at the board online; the stake picks first; every quiet press says why;
  the relay's own words with a way forward and a command's refusal naming its piece; the realm's own stake refusals;
  the season's cap and a foe with no account said; the Grandmaster's own purple, #b438d2; plurals, range, the glossary.
  53 keys drafted in the thirteen whole languages, and 82 rows put right beside them (D1's three in each; D22's
  slips - ko, it, bg, fr, de, da, ru - and 17 French rows given the house's no-break space).
- THE RECORD (A5-A7, B14, B15, C12, E6-E8, E16-E19): the four hosts named in sections 17, 18 and 19; the relay's
  minimum 204; the dead sentences deleted; the counts and the index made true.
- **Pins:** `test/net/auditkg2_relay.test.js` (12), `auditkg2_online.test.js` (11), `auditkg2_board.test.js` (8),
  `auditkg2_panel.test.js` (6), `auditkg2_season.test.js` (3). **Mutants:** `tools/mutants/auditkg2.json`, 73, all
  dead; seventeen records re-aimed by content. RELAY world204 re-hashed in place (undeployed); ACCOUNT acct134
  (undeployed).
- **Ledger:** section A row THE KING'S GAMBIT - AUDIT KG II.
