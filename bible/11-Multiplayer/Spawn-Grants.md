# SPAWN GRANTS - the relay decides which foes may exist (GRANT0, the design record)

**Status: DESIGN RECORD (2026-10-17; revised 2026-10-18 for the relay's cost), BEING BUILT (Mac, 2026-10-18: "Lets
build the plan"). Section 8's reader fixes are BUILT (2026-10-18, the owner: "Quick fixes first"); GRANT1, the law, is
BUILT (section 11); GRANT2, the relay's asks MEASURED from its deploy, is BUILT (section 12; relay world218, account
service acct155). Next: GRANT3, the readers' check.** The relay
signs a grant when a foe is made and never reads the foe stream; every reader checks the grant. Section 4.11 keeps the
first draft, in which the relay read every record, as a fallback. Section 10's questions are answered (2026-10-18).
Section 7 orders the slices. Each one measures before it enforces, as the Integrity arc does.

## The words

- KPbICA, on the Discord, 2026-10-17, read against FOE-FORGE (`06-Systems/Integrity-Arc.md` section 8): **"For now I'd
  suggest to just ban people for this until we find some anti-cheat solution"**. Then, having read the code: **"Looking
  into logic it looks like there is no good solution with current state of project. You can close this exact symptom by
  reducing the amount of elites and etc, but the problem is that modified client has an ability to have an impact to the
  server ... This is bad because it's electron and it's open-source"**.
- Mac handed that on. Asked to choose between a relay referee for foe frames, making strangers' foes harmless, a plan for
  spawns the server rolls, and a written reply, Mac chose **"Plan server-rolled spawns"**.
- Mac, 2026-10-18, on the first draft, whose relay read every foe record: **"So this would definitely affect
  performance..."**. Asked whether the relay should sign at spawn time only and leave the checking to each player's
  game: **"Lets do that"**.

## How to read this page

| Mark | Meaning |
|---|---|
| **FACT** | Read off the code at this record's commit. Each one cites the file and the member. |
| **PROPOSED** | This record's design. It binds nothing until the owner decides (section 10). |
| **OPEN** | A question the measure or the owner answers. |

## 1. Why FOE-FORGE is not the end (FACT)

KPbICA is right about the shape of the problem. In the open world every player's client owns the foes it spawns and
streams them to the cell (`scenes/exteriorFoes.js` foesFrame). The relay fans those records out and reads none of them
(`server/src/index.js`, the `foes` and `own` arms: "the relay reads none of it"). Each reader then decides what to
believe (applyFoes). FOE-FORGE tightened what a reader believes. It cannot make a reader know the truth, because nothing
in the system knows it: the foe exists only on the machine that made it up.

What a reader does with each field of a stranger's foe record today:

| Field | The reader | Where |
|---|---|---|
| `t` species | trusts any species with art | applyFoes: `!ENEMY_BASICS[r.t]` is the only refusal |
| `l` level | takes a class foe's level exactly, up to 100 (`FOE_LEVEL_MAX`); recomputes a monster's | makeEnemyEntity `exactLevel: !!puppet` |
| `w` weapon | trusts any template up to 1023 and any material | applyPuppetRecord, createWeapon |
| `h`, `k` health | trusts them, up to 1e5 (`FOE_HEALTH_MAX`); the reader's blows go to the owner | applyPuppetRecord |
| `z` elite (x3 blows) | believes it for at most 8 of an owner's foes (`PEER_ELITE_PUPPETS_MAX`) | FOE-FORGE |
| `cp` champion (up to x1.875) | believed it uncapped; since section 8, for at most 17 of an owner's foes (`PEER_CHAMPION_PUPPETS_MAX`) | FOE-FORGE's own open list; GRANT0 |
| `gg` Greater Giant (x4) | believes it only on a giant, one per index | FOE-FORGE |
| `nm` and the feud fields (`rb` up to x4, `p2` x1.2) | believes them for at most 9 of an owner's foes | FOE-FORGE |
| `n` fighters (up to x1.7 on me) | trusts it, 2 to 8 | partyHit |
| the wind-up's signature bit (x2) | believed it on any foe; since section 8, on a foe stood as a revenant alone | below |
| `e` heir | **takes over any foe whose record names me**, with no check that its owner is dying or leaving | applyFoes, adopt |

Found while planning, outside FOE-FORGE's record:

- **The signature bit is believed on every foe.** `applyBlowRecord` (`ai/puppetBlows.js`) gives a blow `sig.MULT` (x2)
  whenever the record's `wk` carries `WIRE_SIG` and a signature table is handed in. Both callers always hand one in
  (`exteriorFoes.js` and `dungeonContext.js`: `sig: SIG`), so the bit is never limited to revenants.
- **The dungeon's own lane trusts more than the street.** A room member's loose stands and quest foes go through
  `dungeonContext.js` applyFoeRecord. There a cast is looked up in the whole spell table
  (`spellsByIndex?.get(p.cast)`), with no check of the foe's own list, its range or a paralysis. Its `rb` and `p2` have no
  revenant cap, and each owner is allowed `LOOSE_PUPPETS_MAX` (24) loose stands (DESYNC-ZERO). Integrity-Arc section 8's
  "`dungeonContext.js` needs nothing here" misses this.

Section 8 closed both (2026-10-18).

What one modified client stands at every honest reader today: 64 foes of any species, 8 of them elites and 17
champions, and class foes at level 100 holding any weapon. Before section 8: any champion trait on every one, and blows
doubled by the signature bit. That is per session. A guest
session costs nothing (`server/src/index.js` `_named`: "A GUEST IS NOT SHUT OUT"), and nothing ever happens to the
sender.

## 2. What a spawn depends on (FACT)

Every roll that decides what a foe IS, and where each input comes from:

| Roll | Where | Inputs | From the map files? |
|---|---|---|---|
| An encounter's species | `systems/encounters.js` chooseRandomEnemy | `ENCOUNTER_TABLES` (`characters/encounterTables.js`, baked from DFU's RandomEncounters.cs); the climate index; whether the spot is inside a location's rect; day or night; the player's level | **only the climate index** (`formats/mapsFile.js` getClimateIndex, CLIMATE.PAK) **and the location rect** (MAPS) |
| A camp's or a pack's members | `systems/campEncounters.js` rollGroupComposition | a seed species from the same table, then its faction-mates; `CAMP_SIZE` 3-5, `PACK_SIZE` 2-4 | the same two |
| Elite | `systems/eliteFoes.js` rollOverworldElite | `ELITE_FOE_OVERWORLD_CHANCE` (0.05), Renown 5 online, level 3, not on a location's ground | the location rect |
| Champion | `systems/champions.js` rollStreetChampion | a hash of the feet, the species and `_streetN`, **a counter local to the client** | no |
| A class foe's level | `scenes/exteriorFoes.js` spawnFoe | `effectiveLevel(playerEntity)`, the player's level or a mentor's group level | no |
| Its weapon and health | `equipEnemy`, makeEnemyEntity | the level, the career's CFG, `Math.random` | the careers' CFG |

Everything except the climate index, the location rect and the careers' numbers is code or a fact the relay already
holds under a signature. The identity token's `cl` (the judged level) and `lv` (Renown) are signed by the account service
(`net/identityToken.js`; Integrity-Arc INT7). The world minute is a pure function of wall time that both ends share
(`net/wire.js` sharedClassicMinutes). The owner's map pixel is the relay's own reading of its pose (`net/wire.js`
mapPixelOfWire).

**A socket's id is safe inside a room.** A client names its own id in its hello (`net/online.js` peerId, one per tab).
The room keeps the id's secret from the first hello, and a later hello with the same id and another secret is refused
(`server/src/index.js`: "the id's secret (A3): the first hello mints it, a later one must match", `'id taken'`). The
relay stamps the sender's id on every frame it fans out. So within one room, no socket streams under another's id.

## 3. Precedents in this tree (FACT)

- **A relay signature carried on a foes frame and checked by strangers.** Elite Gates: the hub signs an arch's call
  (`net/eliteGates/egCallSig.js` signEgCall), the opener carries it on its foes frame (`ea`), and every stranger checks it
  on their own machine (`scenes/eliteGates/egArch.js`, verifyEgCall, with a verdict cache and a cap per cell). The public
  half comes from the account service as `rk` (`/v1/eg/keys`). A grant travels and is checked the same way.
- **A table built from the map files that the relay may hold.** RAID-ROLL: the client hands over the towns table, and the
  relay keeps it only when its SHA-256 equals the operator's pin (`RAID_TOWNS_SHA256`, `net/raid/raidLaw.js`). The relay
  never holds a map file (Port-Doctrine, Non-negotiables).
- **The same roll again after an eviction.** `net/eliteGates/egDurable.js` egReceiptSeed takes an HMAC over a secret the
  room keeps and never sends, so a mint repeated after an eviction or a retry gives the same answer.
- **Every client agreeing by construction.** A dungeon's layout foes are the same on every machine: its elites are chosen
  by `pickDungeonElites` seeded with the location id, and the host's stream may only address foes in that layout
  (`dungeonContext.js` `_layoutFoes`). Bands, sea raiders, the rite's faithful, the zone's giants and the Living World's
  stands already draw from a cell, a day or the shared clock.
- **Measure first, then enforce, with the switch on the relay.** INT14's `BOSS_BODY` line enforced nothing until staff set
  it. `net/relayCfg.js` is the developers' runtime switch (`bossBody`, `egDrain`), which needs no deploy.

## 4. The design (PROPOSED)

### 4.1 One sentence

**Online, a foe that rides to another player exists only on a grant from the relay. The relay rolls what needs no map
file, signs it when the foe is made, and never reads the foe stream. The owner's client builds the foe from the grant's
seed. Every reader checks the grant's signature, rebuilds the foe from the same seed, and refuses a record that
disagrees.** The simulation stays on the owner's machine (Multiplayer.md, decision 2). What changes is who decides that a
foe exists, and what it is.

### 4.2 A grant

The cell room holding the owner's socket mints it on the owner's ask. It is signed with the relay's receipt key
(`GATE_SIGNING_KEY`) under a prefix of its own (`spawn-grant1\n`, kept apart from receipts, calls and chat stamps). Its
fields:

| Field | What |
|---|---|
| `g` | the grant's number, the room's own counter |
| `o` | the owner's socket id, which readers match to the frame's sender (section 2: the room guards it) |
| `q` | the room it was minted for, which readers match to the frame's cell |
| `a` | the owner's account (the token's `s`). Only the relay reads it, on a carry or a handover |
| `k` | its kind (section 4.9) |
| `p` | the map pixel the relay read off the owner's pose at the mint |
| `m` | the world minute at the mint (sharedClassicMinutes): day or night is everyone's |
| `l`, `r` | the owner's signed level (`cl`) and Renown (`lv`) |
| `n` | how many foes it stands: an encounter's party, a camp's group |
| `s` | the seed, `rand32` |
| `e`, `c` | which members are elite, and each member's champion trait. The relay rolls both from `s`, with pinned copies of `ELITE_FOE_OVERWORLD_CHANCE` and the champions' rate, held equal to `systems/eliteFoes.js` and `systems/champions.js` by a test (the relay cannot import those modules: they reach the loot tables) |
| `x` | when it expires, about ten minutes on (OPEN: the measure sets it) |

### 4.3 The asks

Online only, so solo play does not change. Every ask is a small frame of its own (`{t:'grant', k: ...}`) that comes
when a foe is made, renewed, lost or handed on. None of them is on the foe stream.

| Ask | When | What the relay does |
|---|---|---|
| `mint` | the client's own clock decides a spawn is due (the encounter tick's catch-up loop, a camp's roll when a chunk loads) | spends the kind's bucket, checks the cell's ceiling, rolls and signs, answers the grant or `no` with a reason |
| `renew` | before a live grant's `x`, all of an owner's live grants in one ask | signs each again with a new `x` |
| `free` | a granted foe died or was culled | lowers the counts. Believed only downward: a lie costs only the liar |
| `carry` | the owner crosses into another cell | the new room checks each grant's signature and that `a` is this socket's account, then signs it again for itself (`q`) |
| `heir` | the owner hands a foe on (section 4.8) | checks `a` as for a carry, and signs the member again for the heir's id |

A spawn waits one round trip for its `mint`. Spawns stand out of view (`SPAWNER_ARMS` 10-20 m, past the line of sight;
camps at 100-150 m), so the wait is not seen.

### 4.4 The dice

A granted foe's identity is drawn from the grant's seed (`net/grantLaw.js` grantDice: `systems/eliteFoes.js` eliteRng
over eliteHash, the same law), one stream per die for each member: the species (chooseRandomEnemy at the grant's pixel,
minute and level, or the kind's own table), the level within its band, the weapon (equipEnemy), and the health dice. One
stream per die, not one stream in a pinned order (GRANT1): chooseRandomEnemy draws a variable count, and a shared stream
would shift every die after it. Elite and champion are the grant's `e`
and `c`. Movement, targets, blow timing and every other roll stay `Math.random` and stay the owner's.

### 4.5 Carrying

Each record carries `gr`: the grant's number and the member's index. The signed grant rides in the frame's list `gs`,
once on the record's first frame and again on every full frame (the cadence the look's `ls` already rides at). A grant is
about 150 bytes. A full frame of 64 foes drawn from 8 to 16 grants carries 1.2 to 2.4 KB more, against
`FOES_ROOM_BYTES_PER_S` (4 MiB a second). That figure is for the measure to confirm.

### 4.6 What the relay holds

**Nothing on the foe stream.** The relay never opens a foe frame, so its busiest path costs what it costs today. That
path is `_foesFan`, five frames a second from each socket, fanned to a crowd whose cost grows with its square (Scale-Arc
SCALE5d). Per room, the relay holds:

- each account's buckets, one per kind, spent at each mint and sized to the honest envelope the measure reads (section
  7);
- the grants not yet expired. The cell's ceiling on live granted hostile foes counts them. A foe that dies early keeps
  its grant counted until it is freed or expires, so the ceiling errs high, by at most one window.

Memory is a few numbers per live grant. Nothing goes to storage: the room secret's HMAC re-mints a grant after an
eviction.

**Why the relay does not strip records.** The first draft had the relay read every record and drop each one without a
grant. That law is stronger: a forged record never leaves the relay, and the relay's own counts are evidence. But it
reads every record of every frame in the crowded cells, where the relay is already at its limit (`_message` is past V8's
optimising ceiling, PERF-RELAY1; SCALE5d). It is kept as section 4.11, to build only if the measure shows the relay can
afford it.

### 4.7 What readers check

Every reader is the law here. It already reads every record (applyFoes, validFoeRecord), and it checks a record's grant
once per new foe:

- the grant's signature, with the key egArch already fetches (OPEN: does `/v1/eg/keys` reach a guest?);
- `o` is the frame's sender, and `q` is the frame's cell (`k`), which applyFoes already holds to the reader's cell or a
  halo's;
- the grant is not past `x`;
- the member index is under `n`, and the member stands as one live record;
- the species, the first feet within the kind's reach of `p`, and `l`, `w` and `k` all match the seed's draw. `z` and
  `cp` match `e` and `c`.

A verdict is kept per owner and grant, as egArch keeps its own. Every honest reader runs the same check on the same
bytes, so every honest reader agrees on what stands. DESYNC-ZERO refused a room-wide count because readers would
disagree; a deterministic check does not have that problem.

A reader that refuses a record counts it, by kind, reason and sender. It hands the tally to the relay every ten minutes
(`{t:'grant', k:'tally'}`), which is rare and off the foe stream. The tallies are the measure (section 7) and GRANT7's
evidence.

FOE-FORGE's caps stay underneath all of it.

### 4.8 The heir

An owner hands its foe on with its grant. In the handover it asks the relay to sign the member again for the heir's id
(`heir`), and the handover frame carries that grant. A reader takes a foe over only on a grant made out to it. A forged
takeover then costs the forger one of its own grants. Today, any record naming a player takes a foe over. A foe orphaned
by a disconnect (QUEST-PARTY's pruneOwners) is taken on a fresh grant from the taker's own bucket.

### 4.9 Each source's grant

| Source | Kind | Who mints | Species law | Count law |
|---|---|---|---|---|
| Random encounters (`systems/encounters.js`) | `enc` | the cell | chooseRandomEnemy from the seed | `ROAD_PARTY_MAX` (4) |
| Camps and packs (`systems/campEncounters.js`) | `camp` | the cell | rollGroupComposition from the seed | `CAMP_SIZE`, `PACK_SIZE`, plus the party's extra |
| Bounty packs (BOUNTY1) | `bounty` | the cell | the bounty's own beast | 4-8 |
| Roaming bands (TV7b), sea raiders (OW6) | none new | already a function of the cell and the shared clock (bandOf, raiderOf); the stand's elite, champion and level move onto that seed | the band's own | the band's own; OW6L's cell ledger already keeps them |
| Naval boardings | `muster` | the cell | `musterOf(shipClass)` from the seed | `MUSTER_MAX` |
| Raiding parties (RAID1-3) | `raid` | the cell, against the raid ledger it already keeps | chooseRaider from the seed | `MAX_RAID_ENEMIES` 25 and `MAX_RAID_DEFENDERS` 8 |
| The City Watch | `watch` | the cell | Knight_CityWatch (146) only; readers check a location's ground | `CELL_WATCH_PUPPETS_MAX` (10) |
| World of Daggerfall sites | `site` | the cell, one per marker spring | the marker's arms from the seed | the marker's own |
| The rite's faithful (WB12d) | none new | already gateHash of the day | | |
| Deep water | `deep` | the cell | `DEPTH_AQUATIC_TABLE` from the seed | the deep's own cap |
| The Living World's stands | none new | already lwSeed; their elite moves onto it | | |
| Greater Giants | `giant` | the hub, which already holds the giants that are down (ZONE-GIANTS) | a giant | one per index, zone-wide; a call of ten as one grant of `n` 10 |
| Revenants | `rev` | the cell, keyed by the revenant's id | the revenant's own record | a character's three (REVENANT_MAX since UNQUIET) plus six sworn (OPEN: does the account service hold them?) |
| Loose stands, Wabbajack | `loose` | the cell | the item's own (WABBAJACK_CAREER_IDS from the seed) | a small bucket |
| Quest foes (QUEST-PARTY) | `quest` | the cell | the quest's script: party members holding the same quest check it | `QUEST_PUPPETS_MAX` (24) |
| Companions, shipmates | `ally` | the cell | the owner's word: allies fight foes, never the reader | counted |

Indoors, the interior lane's sources (quest foes, loose stands, Wabbajack, companions, the watch) take the same kinds.
A dungeon's layout stream needs no grant, because it is already right by construction. Its surplus and its own lane take
grants.

### 4.10 Later, if wanted: the relay rolls the species too

The relay could also hold the climate and location-rect slice of its own cell, handed over by a client and kept under
an operator-pinned Merkle root (RAID-ROLL's law, one root over every cell's slice). It would then roll the species
itself, and readers would only confirm. The first enforce does not need this. It is worth building if two honest
readers ever disagree on a species. It costs the relay only at a mint.

### 4.11 The fallback: the relay strips records (the first draft)

The relay reads every record of every foes frame, keeps each socket's grants bound to the records standing on them, and
drops each record that has no grant, has another account's, or disagrees with its `e` or `c`, before the fan (`fanOut`
already serialises the frame again). It is built only if the measure shows the relay can afford it. That measure is the
relay's time in `_foesFan` in its fullest cells, read before and after on the same crowd. It would bring two things the
readers' law cannot: a forged record that never leaves the relay, and counts that are the relay's own rather than the
readers'.

## 5. What it does not fix (the honest limit)

- **Behaviour stays the owner's.** A granted foe's movement, its target, its blows' timing and its health going down are
  its owner's word. A modified client can still make its granted foes unkillable or move them anywhere. The next laws,
  OPEN: a puppet's speed bounded by its species; a foe whose owner ignores every blow stands down at the reader.
- **At the granted rate, a cheater stands what an honest player stands.** It can still lead those foes to someone, as an
  honest player can.
- **A modified client still sees its own forged foes.** The readers' law decides what everyone else sees, not what the
  forger's screen shows.
- **A player on an old client checks nothing**, and stands what it is sent, as today, until it updates.
- **Each account has its own budget.** The cell's ceiling bounds the total, and guests are the owner's call
  (section 10).
- **Fishing.** A client can ask for a grant, dislike the roll and never stand it. Every ask spends the budget, so its
  elites in an hour are no more than an honest player's.

## 6. What it costs (FACT, then estimates)

- **The relay's foe stream: nothing.** It is not read.
- **The relay's asks:** one Ed25519 signature (WebCrypto, which the relay already uses for receipts) at each mint, carry
  and handover, which is a few a minute for each player, and a renewal of all of a player's grants in one ask about every
  ten minutes. A tally from each reader every ten minutes. Memory: a few numbers for each live grant.
- **Each player's machine:** one signature check for each new grant, kept, as egArch keeps its verdicts. The dice are
  re-run once for each new foe, and the puppet's build already rolls the same things. Nothing runs each frame.
- **The wire:** a new frame type, `grant`. A client asks only of a relay at `GRANT_RELAY_MIN` or later, the
  relayCfgSupported pattern. The foe frames grow by the grants they carry (section 4.5).
- **Deploys:** every relay slice bumps `RELAY_VERSION`, and `relay-deploy.yml` then drops every connected player once.
  The switch from measuring to enforcing needs no deploy: relayCfg sets it, and the welcome tells each client.
- **DFU:** online, an encounter's dice come from the relay's seed instead of `Math.random`. That is a departure from
  RandomEncounters.ChooseRandomEnemy's draw, and the slice that ships it adds its bracket to Port-Ledger section A,
  row ONLINE. The tables and the law are unchanged.

## 7. The slices (PROPOSED)

| Slice | What | Ends with |
|---|---|---|
| GRANT1 | The law, pure, in a new module (`net/grantLaw.js`, proposed): the grant's shape, its signing and its check, the dice order, the buckets' gate, the pinned rates. Nothing calls it yet. | tests and mutants |
| GRANT2 | The relay takes the asks (section 4.3) and **measures**: every ask is granted, and the refusals the buckets and the ceiling would make are counted. The welcome says the law's mode, `measure`, from relayCfg. Clients ask for encounters (the largest stream). | a relay deploy |
| GRANT3 | Readers check grants and tally what they would refuse. They still stand everything FOE-FORGE allows. | |
| GRANT4 | Every other source takes its grant, one slice per family in section 4.9. | |
| GRANT5 | The measure is read (`tools/realmReview.mjs grants`) for seven days ("Measure 7 days, then enforce", Integrity-Arc section 3, call 2): the honest asks per kind set the buckets, and any honest reader's refusal is the law's mistake, fixed before enforcing. | the numbers |
| GRANT6 | **Enforce**: staff set relayCfg to `enforce`, and the welcome tells every client. The relay refuses asks past a bucket or the ceiling, readers refuse what has no grant or disagrees with one, and FOE-FORGE's caps stay. | no deploy |
| GRANT7 | Consequence: once every source is granted, an honest client sends nothing a reader refuses. When readers on several accounts tally against one sender in a window, its account is opened as a case in the moderators' queue (Chat-Safety-Arc SAFE8), with the tallies as evidence. One reader's tally alone never counts, because a tally can be forged to frame someone. It never bans by itself: SAFE5's law. | an account deploy |
| GRANT8 | Optional, section 4.10: the relay rolls the species. | |
| GRANT9 | Fallback, section 4.11: the relay strips records, only if the measure shows it can afford it. | a relay deploy |

THE FOUR HOSTS: `scenes/world.js` (the streamed exterior) asks for grants, carries them and checks them.
`scenes/worldModes.js` does the same for the interior lane. `scenes/dungeonContext.js` does the same for its own lane and
its surplus; its layout stream needs none. `scenes/exterior.js` (the fixed city) streams nothing and reads no peer, so it
needs nothing. The asks and the checks go into a module the hosts wire, never into the hosts' own functions (HOST-SPLIT).

## 8. Reader fixes that need no grants (BUILT 2026-10-18)

The owner, asked what to build first: **"Quick fixes first"**. These are section 1's finds. Each is a reader's law alone:
no relay deploy, nobody dropped, and every player has them on their next update. They ride this record's pull request.

1. **The signature is a revenant's.** An honest owner sets it only on a revenant's blow (`ai/tactics.js`,
   `ent?.revenant?.sigBlow`). Both pools now hand the signature's numbers to a puppet's blow only when the puppet stands
   as a revenant (`sig: f.entity.revenant ? SIG : null`): at the street, inside FOE-FORGE's bound on `nm`; in the
   dungeon, inside item 2's. Every revenant of rank 1 or more streams `rb` (`REVENANT_DAMAGE_PER_RANK`), and a signature
   needs rank 2 (`SIG_RANK`), so no honest revenant loses it.
2. **The dungeon's copies.** A peer's cast is taken only if its kind casts that spell at its owner's level
   (`systems/enemySpells.js` enemySpellIndices, asked at the record's `l`), and never from a paralysed copy. The level
   matters: a copy is built at its reader's level, so its own list is the wrong one to ask. Only a caster's decision
   rides the dungeon's stream (`_castN` counts nothing else), and it draws from that same list, so no honest cast is
   refused. A revenant's fields (`rb`, `p2`, its adaptations and weakness) are believed for at most
   `PEER_REVENANT_PUPPETS_MAX` of one owner's copies - the room host's layout foes, or one sender's own lane - and
   always on the reader's own revenant. **OPEN:** the street's range band (puppetCastInBand) is not added, because a
   dungeon copy keeps no distance to its reader.
3. **Champions.** `PEER_CHAMPION_PUPPETS_MAX` is 17: the elites' allowance and the revenants' bound, because a revenant
   wears its trait as a champion. Past it a record's `cp` is not believed, and its foe stands as its plain kind. A trait
   is stood inside the build, before the puppet is indexed, so the count includes the builds in flight. Both of a
   puppet's stands count: applyFoes, and a kept orphan's (standKeptOrphan).

Pins: `test/scenes/grant0_reader.test.js` (4); `tools/mutants/grant0.json` (17, all dead). Pins moved (PIN MOVED where
each stands): `tell8_online`, `feudwire`, `rvn13_wire`, `world3`, `loot7_champions`. Eight older mutant records were
re-aimed at the text they name and run again, and seven died. `AD28Q-J2-cell-orphan-unmarked` survives, and survives on
the file from before this change too: since DESYNC-ZERO an unlinked party member stands the puppet itself, so its test no
longer reaches the kept-record stand that mutant breaks. That is a finding for QUEST-PARTY's arc, not fixed here.

A forged takeover (`e`) is not on this list. A reader cannot tell it from an honest one: OW6 hands a foe over from an
owner that is still playing (world.js handOverWalkedAway), so only a grant (section 4.8) can close it.

## 9. Where this page sits

- `06-Systems/Integrity-Arc.md` section 8 lists FOE-FORGE's open items. This page is the plan that closes them at the
  root. The integrity arc's principle (section 2) holds: the world is simulated on the player's machine, and what the
  client's word can BUY is decided where the client cannot reach.
- `11-Multiplayer/Multiplayer.md` decision 2 holds. The relay rolls a foe's identity, not its life.

## 10. Questions for the owner (ANSWERED 2026-10-18)

1. **Guests.** A guest's grants: the same budget, a smaller one, or no hostile kinds at all? Ban evasion is a new guest
   (Chat-Safety-Arc section 11). ANSWERED: **the same budget.** A guest's session mints a token like anyone's (`server/src/index.js`
   "A GUEST IS NOT SHUT OUT"), so its grants are its own account's, on the same buckets. Its grant's `l` and `r` are what
   its token carries, 0 where it carries none, and under Renown 5 the relay rolls no elite (`GRANT_ELITE_MIN_RENOWN`), as
   a guest's own street rolls none today (`systems/sigil/sigil.js` renownOpens).
2. **The consequence (GRANT7).** Open a moderators' case when readers on several accounts tally against one sender? If
   so, how many accounts, in what window? ANSWERED: **three accounts in ten minutes** - a case, never a ban.
3. **The measure's window.** ANSWERED: **seven days**, as the integrity arc's budgets had.
4. **Section 8's reader fixes.** ANSWERED 2026-10-18: "Quick fixes first" - built, section 8.
5. **The cell's ceiling** on live granted hostile foes, all senders together. ANSWERED: **on, at the number the measure
   gives** (`GRANT_CELL_CEILING`, provisional until GRANT5).

## 11. GRANT1: the law (BUILT 2026-10-18)

Mac: **"Lets build the plan"**. `net/grantLaw.js`, pure; the relay and the client import it, and nothing calls it yet.

- **The grant** (section 4.2): validGrant reads one whole or not at all - each field in its law, `n` within its kind's
  most, `e` within the members, `c` one trait or none a member and none on an elite, `a` an account or '' and `l`, `r` a
  token's or 0 (a guest). grantBytes is every field but `sg` in one fixed order behind `spawn-grant1\n`; signGrant and
  verifyGrant are egCallSig's own law (Ed25519, the relay's receipt key, `rk` to verify). An arch call signed with the
  same key verifies as no grant.
- **The marks** (grantMarks): `e` and `c` from the seed alone, three draws a member always - so a member's marks are its
  own whatever `n` - the elite's draw made before the Renown's word, an elite never a champion.
- **The dice** (grantDice): one stream per GRANT_DICE word and member, `systems/eliteFoes.js` eliteRng over eliteHash
  (the test holds them equal), a copy because the relay cannot import that module.
- **The pinned rates**: `GRANT_ELITE_CHANCE`, `GRANT_ELITE_MIN_RENOWN`, `GRANT_CHAMPION_PER_MILLE`,
  `GRANT_CHAMPION_TRAITS`, each held equal to its home by the test.
- **The kinds** (GRANT_KINDS): `enc` (most 4, `ROAD_PARTY_MAX`) and `camp` (most 8, `CAMP_SIZE`'s top and
  `PARTY_SCALE_EXTRA_MAX`), GRANT2's first stream; each other source's kind comes with its own slice (GRANT4). Their
  buckets and `GRANT_CELL_CEILING` (192) are PROVISIONAL: GRANT5's seven days set them.
- **The mint's gate** (grantMintGate): an unknown kind, a size past its kind, the cell's ceiling, then the account's
  bucket - one token an ask, `net/wire.js` tokenGate, the relay's one bucket. The ceiling is asked first, so a full cell
  spends nothing of the asker's.
- **The reader's check past the signature** (grantRefusal): the sender, the cell, the expiry (`GRANT_TTL_MS`, with
  `GRANT_SKEW_MS` for a reader's clock), the member - the first that stands. grantMarksAllow: a record's elite and trait
  only as its grant's, and either left off always believed. The reasons a tally counts are `GRANT_REFUSALS`.

Departures from section 4, each named: one stream per die (section 4.4); a bucket token is an ask, not a member, since
section 5's fishing is bounded by asks; a mark worn below its grant is believed (a reader refuses only what a grant does
not give).

Pins: `test/net/grant1_law.test.js` (7); `tools/mutants/grant1.json` (18, all dead).

## 12. GRANT2: the relay takes the asks and measures (BUILT 2026-10-18)

The owner: GRANT1 ships with it, and the law **measures from its deploy**. Relay world218, account service acct155.

- **The frame** (`net/grantLaw.js` header): a client asks its own cell `{t:'grant', k:'mint', id, kind, n}`
  (validGrantAsk: a kind of GRANT_KINDS, within its most); the cell answers `ok` with the grant, `no` with a refusal, or
  `off`. A cell's welcome says the mode (`gm`); a client asks only a relay at world218 or later (GRANT_RELAY_MIN), because
  an older one closes the socket on a frame it does not know. The relay's own per-socket bucket (grantGate) is kept at
  home too, so an honest ask is never the one it drops.
- **The mint** (`server/src/index.js` `_grantFrame`, `_grantMint` - Room methods of their own, one dispatch line in
  `_message`): only from a socket whose pose stands in the cell (a halo's pose is told `cell`); the grant made out to its
  socket, cell and account, the pixel and world minute the relay reads, the token's level and Renown (0 where it says
  none), a seed from `crypto.getRandomValues`, grantMarks, ten minutes' life, signed with GATE_SIGNING_KEY. A cell's
  counter begins anywhere in 31 bits, so a re-woken cell does not repeat its last life's numbers.
- **The gate** (grantMintGate) is asked on every ask: an account's bucket per kind, the cell's ceiling on live granted
  members. While the law **measures** every ask is granted and the refusal is only counted; while it **enforces**
  (GRANT6) the refusal is said. The bucket is kept either way, so the measure counts what enforcing would refuse.
- **The mode** is the relay setting `grantMode` (`net/relayCfg.js`, var GRANT_MODE): `measure` (and unset - grantModeOf),
  `enforce`, `off`. A hello never calls the hub for it: the welcome says the setting the cell last had, or the var. An ask
  reads it, waiting on the hub only at a cell's first ask and asking again at most every GRANT_CFG_TTL_MS (five minutes),
  since every cell a player roams asks and the hub is every tab's. A staff `off` reaches a client at its next ask (`off`).
- **The measure** (`net/grantMeasure.js`): each cell folds its asks per account and kind - asks, members, the bucket's and
  the ceiling's refusals - and the most live members it held, and posts the window every GRANT_MEASURE_MS (ten minutes)
  or at GRANT_MEASURE_ROWS rows, signed over `grant-measure1\n` with the relay's key, to GRANT_FEED_URL (the chat feed's
  door: never awaited, never retried, through the ACCOUNTS binding). The account service keeps a window once
  (`server-account/src/grants.js`, POST /v1/mod/grant-feed, migration 0131_grant_measure) and a developer reads it:
  `node tools/realmReview.mjs grants [days]` - per kind, an account's asks an hour (quantiles, most), what the buckets and
  the ceiling would have refused, and the cells' most live beside GRANT_CELL_CEILING. GRANT5 reads it after seven days.
- **The client** (`scenes/grantHost.js`, wired by `scenes/world.js`): each wanderer group the encounter tick stands and
  each camp a chunk entered stands asks its grant, never awaited. **Nothing is built from the grant yet**: the foe stands
  as it always did. Its seed builds the foe, and its record carries the grant, from GRANT3.

THE FOUR HOSTS: `scenes/world.js` wires it, at the encounter tick and the chunk's camps. `scenes/worldModes.js` (the
interior lane) and `scenes/dungeonContext.js` (its own lane and its surplus) take their sources' grants with GRANT4.
`scenes/exterior.js` streams nothing and reads no peer.

**Found while building, for GRANT3:** a guest never fetches the relay's public key - `scenes/eliteGates/egClient.js`
asks `/v1/eg/keys` only for a signed-in account (`account?.guest?.()` returns first), though the service answers any
session. Section 4.7's OPEN is answered: no. GRANT3 needs another route for a guest's key (the welcome, or a public read).

Pins: `test/net/grant2_relay.test.js` (4), `test/net/grant2_client.test.js` (2), `test/server/grant2_service.test.js` (2);
`tools/mutants/grant2.json` (19, all dead). Pins moved: RELAY_VERSION and ACCOUNT_VERSION where they stand (PIN MOVED),
the relay's graph and its law row (`test/net/relayversion.test.js`). GRANT3 replaced the encounter tick's and the camp's
asks with the pool's own (section 13), so the encounter tick is main's again.

## 13. GRANT3: the owner stands on the grant, the reader checks it (BUILT 2026-10-18)

Mac: **"Do all slices. And dont return until they are finished"**. Ships with GRANT1 and GRANT2 (world218, acct155).

- **The asks** (`net/grantLaw.js` validGrantAsk, validGrantOut; the relay's `_grantRenew`, `_grantFree`, `_grantCarry`,
  `_grantHeir`, `_grantTally`): `renew` signs my live grants again with a new `x` and passes over another's; `free`
  takes my grant off the cell's count, never another's; `carry` signs a grant this relay signed, made out to this socket
  and account, from another cell, again for this cell under its own number; `heir` signs member `i` of my grant to a
  socket in the cell, answered to THE HEIR (my handover frame goes at once), each member once, counting nothing more
  against the ceiling; `tally` folds a reader's refusals into the measure under the reader's account and the sender's
  (`grantMeasure.js` `tl`), one a reader each GRANT_TALLY_MS. The relay checks its own signature by signing the bytes
  again (Ed25519 is deterministic: grantSignedHere), so it needs no public half.
- **The grant's `h`**: -1 for a mint's; the member a handed grant stands alone. Signed, so a handed grant cannot be
  stretched to its other members.
- **The owner** (`scenes/grantHost.js`, wired by `scenes/world.js` into the pool's net): every own stand of
  `scenes/exteriorFoes.js` spawnFoe asks a member (memberFor), every stand of a kind in one turn one ask, split at the
  kind's most. The member stands as the grant says - its elite through the street's own gates (elitesAllowed, the ally,
  the quest, the building), its champion only a capped stand's - and a stand whose grant does not come in GRANT_WAIT_MS
  stands as it did. A record names its grant and member (`gr`); a frame carries each grant its records name on a full
  frame and again when it is signed again (`gs`). A member's end frees its grant at the last; a grant within
  GRANT_RENEW_LEAD_MS of its end is renewed; one carried out of its cell is signed for the cell its owner stands in.
- **The heir** (section 4.8): a foe handed on at a death or a door asks `heir`; the heir's game ties the grant to the foe
  it took, whichever lands first, waiting GRANT_HEIR_WAIT_MS before it asks a fresh grant of its own (the orphan's law).
- **The reader**: every grant a frame carries is checked once per owner, grant and signature, with the relay's public
  half from the account service's open route `/v1/relaykey` (section 12's finding: a guest's game reads it too). Every
  new foe's grant once: the signature, the sender, the cell, the expiry, the member, a member standing once (`twice`),
  its marks within its grant's (`marks`), and what a seed bounds without the owner's settings (`dice`): a class foe of an
  encounter, a camp or a band at the owner's signed level or under, an encounter's or a camp's species one its pixel's
  tables hold (grantSpeciesOf: the band's three tables). A hostile record with no grant from an owner that has carried
  one is `ungranted` (GRANT4: the City Watch's too, section 14). What it would refuse is tallied by sender and reason
  (GRANT_READER_REFUSALS) and handed to the cell every GRANT_TALLY_MS. While the law measures the foe stands; while it
  enforces the pool stands down a forged grant or none (GRANT6, section 15). A reader that cannot have the key judges nothing, and asks again after
  GRANT_KEY_RETRY_MS.

Departures from section 4, each named:
- **The reader does not re-run every die.** A foe's weapon and its health depend on its owner's own settings (the
  Roleplay & Realism assigner, the monster rows' mods, the wilds' scaling), which a seed cannot rebuild; the reader
  bounds what the seed does decide (the marks, the species table, the level) and leaves the rest to FOE-FORGE's caps.
  The owner's build draws its dice as it did; the seed decides the marks.
- **One ask per kind per turn**, not per spawn: a camp's members all start in one loop, and one ask spends one token.
- **Grants live in the pool, not at each source**: every own stand asks by its kind (section 14), so no host grows.

Pins: `test/net/grant3_asks.test.js` (3), `test/scenes/grant3_pool.test.js` (5); `tools/mutants/grant3.json` (23, all
dead). Pins moved: `test/net/grant1_law.test.js` (`h`, fifteen fields signed), `test/net/grant2_client.test.js` (the host
wired), the relay's law row; mutant records re-aimed where their text moved (`scenes/world.js`'s encounter and camp lines,
`travel/freePull.js` - the free pull moved out of bootWorld to make its room).

## 14. GRANT4: every source's grant (BUILT 2026-10-18)

- **The kinds** (GRANT_KINDS, fifteen): `enc`, `camp`, `band`, `bounty`, `loose`, `site`, `managed`, `giant`, `rev`,
  `quest`, `ally`, `watch`, `kept`, GRANT8's `encr` (section 16), and STAR-TUNE's `star` - a fallen star's coven, its
  law's largest wave in one grant (`net/starfall/starfallLaw.js` STAR_WAVE_MAX, twenty-four), its own bucket, the open
  country's alone (`bible/11-Multiplayer/Starfall.md` section 4) - asked only of a relay that mints it (AUDIT STAR-TUNE
  F1, `STAR_GRANT_RELAY_MIN` 238, `relaySupportsStarGrant`; an older relay is asked the stand's own kind). A stand's kind
  is its caller's word (`grantKind`: world.js names the encounter's, the revenant's, the camp's, the band's and the
  bounty's; the Starfall's host the star's) or its own shape (grantKindOf):
  an ally, a quest's foe, a Greater Giant, a revenant, marks its caller decided (`kept`), a stand its spawner manages,
  a loose stand, a marker's, else a capped stand (`band`). A quest's foe, an ally, a revenant, the watch and a `kept`
  stand roll no marks (GRANT_MARKLESS), and a reader believes theirs (grantMarksAllow): their own law decides them, and
  their kind's bucket bounds them. `kept` is a stand whose elite or champion its caller set - a foe a save brought back, a
  search party's leader - so a grant's marks never contradict a mark its caller decided.
- **The building's lane**: world.js hands the grants' host to the building's pool with its net (interiorFoesNet's
  `grants`), so a building's own stands ask, carry and read as the street's. The relay takes a world room's asks
  (`_grantHere`: the socket stands in its room; `streamsFoes` everywhere a cell was): its grant names no pixel (`[0, 0]` -
  its kinds roll no table a pixel decides), the open country's kinds (GRANT_OPEN_KINDS: an encounter, a camp, a bounty, a
  Greater Giant) are refused `kind`, and a grant is carried cell to cell alone - never into a room, never out of one.
  A free goes to the room that holds its grant (one left behind counts there to its expiry), and an expired grant is
  no longer the owner's to renew or free. The welcome says the law in a world room too.
- **The dungeon's own lane** (`scenes/dungeonContext.js`, wired by worldModes' `grants`): a shared quest's foe and a loose
  stand ask before they build (spawnLooseFoe - a bout, the arena's instance's own, asks nothing); the own lane's record
  names its grant and member, its frame carries the grants (`gs`); a party member's game checks a new puppet's grant (the
  room its session stands in is the cell: the own frame is keyed by the dungeon), stands down what an enforcing law
  refuses, ties a handed grant to the foe it took, and hands its own on at a death or a door; a member that dies or is
  given back ends; the clock runs in drawFoes. The own lane's records carry no marks, so a dungeon's grant bounds the
  count and the rate alone.
- **The watch**: the City Watch is stood by its own pool (`scenes/cityGuards.js`) and streamed by the street's (WATCH1),
  so the street's pool asks a watchman's grant as it first streams him (grantHost.js watchReady) and holds his record
  until it comes (or GRANT_WAIT_MS passes without one); a watchman gone from the list ends his member (watchSweep). A
  reader holds a `watch` grant to a watchman (`dice` otherwise), and the watch's records are no longer passed over.
- **The clock** runs every frame (the pool's update, the dungeon's drawFoes), not only on a frame to others: alone, a
  grant is renewed all the same.

Departures from section 4.9, each named:
- The plan's `muster`, `raid` and `deep` are not kinds of their own: a stand takes its shape's - a stand its spawner
  manages (the deep's, the Living World's) `managed`, a loose stand (a summons, a squad, a muster, a raider) `loose`, any
  other capped stand `band`. The roaming bands and sea raiders take theirs rather than none new: one law for every stand.
- **The dungeon's surplus needs no grant**: it is a host's layout foe past a reader's own layout run (DESYNC-ZERO), the
  layout's by construction. The room's shared rest encounter (REST-SYNC) is the host SEAT's, and the seat passes between
  sockets while a grant is made out to one: it stands on the layout's law, the host's seat (OPEN).
- A placed foe with no site never rides (foesFrame, AUDIT BRANCH (WoD) M1), so it asks nothing.

Pins: `test/net/grant4_relay.test.js` (3), `test/scenes/grant4_lanes.test.js` (7); `tools/mutants/grant4.json` (44, all
dead, with GRANT5-GRANT9's). Pins moved: `grant3_pool`'s kinds, `grant2_client`'s session (a world room's welcome says
the law; the law unsaid until it comes), `scale5b`'s settings; QP3C's handover mutant re-aimed past the heir's ask.

## 15. GRANT5, GRANT6, GRANT7: the measure read, enforcing, the moderators' case (BUILT 2026-10-18)

- **GRANT5, the measure read.** `node tools/realmReview.mjs grants 7` answers each kind's rate standing and SUGGESTED -
  half again past its 0.999 quantile of an account's asks an hour, in asks a second (grantRateSuggested) - and the cell's
  ceiling suggested, half again past the most live granted members any cell held (grantCeilingSuggested). **Reading
  seven days of the live measure is the staff's, after the deploy** (the owner, question 3): GRANT_KINDS' rates and
  GRANT_CELL_CEILING are set from it, and any honest reader's tally it shows is the law's mistake, fixed before enforcing.
- **GRANT6, enforcing.** The relay refuses past a bucket or the ceiling (GRANT2). An owner never stands a stand its
  grant did not come for (scenes/exteriorFoes.js spawnFoe, the dungeon's spawnLooseFoe), so an honest owner streams none.
  A stand made while its socket's welcome is owed (net/online.js: the law `null` from the socket's open to its welcome)
  waits for it, GRANT_WAIT_MS at most, so a crossed cell is never a moment of ungranted stands. A reader stands down only
  what a changed client gives - GRANT_CASE_REASONS (a signature that fails, another's, a member past it, marks past it, a
  member twice) - and a record with no grant (GRANT_STANDDOWN_REASONS); a record that beat its carry (`cell`) or its
  renewal (`expired`), a level since its checkpoint, a species off its tables (`dice`) are the measure's. A reader waits
  GRANT_VERDICT_WAIT_MS for a grant it came in after before it calls it unheard (`ungranted` - section 18; it was
  `unsigned`), and a class foe
  GRANT_LEVEL_SLACK (two) over its owner's signed level stands: the token's `cl` is the level its last judged checkpoint
  found. **The flip is the staff's: `/relay grantMode enforce`, after GRANT5** - nothing deploys.
- **GRANT7, the moderators' case** (`server-account/src/grants.js` grantCases; the owner, question 2: three accounts in
  ten minutes). A window whose tallies name a sender for a case's reason weighs its case: GRANT_CASE_READERS (three)
  readers' accounts that count, tallying those reasons against it inside GRANT_CASE_WINDOW_S (ten minutes), open its
  case - or add to the one open - with one line under the `grant` tab (how many players' games refused how many of its
  foes, and why), once a window. The case is the reviewer's kind (`review`): no report is filed, so the reports'
  automatic mute is never reached, and the chat's AI reader is not asked; the Discord post is due where it is on. A
  moderator decides. Departure: an account counts by the reports' own law (safety.js credibleReporter: registered, not
  muted, no sprout), so a ring of fresh guests opens nothing.

Pins: `test/server/grant7_case.test.js` (2), `test/scenes/grant4_lanes.test.js`'s GRANT6 three, `grant3_pool`'s reader
(an enforcing reader stands a species off its tables); `tools/mutants/grant4.json`.

## 16. GRANT8, GRANT9: the seed rolls the species, the relay strips records (BUILT 2026-10-18, OFF)

Both are relay settings, off until a developer sets them (`/relay grantRoll on`, `/relay grantStrip on`; vars GRANT_ROLL
and GRANT_STRIP), each the plan's condition for its own (sections 4.10 and 4.11).

- **GRANT8** (section 4.10). Departure: **the relay holds no map; the grant's SEED rolls the species.** While
  `grantRoll` is on the relay answers an encounter's ask with `encr` (grantKindRolled; never asked by name), an
  encounter's bounds and marks. Its owner stands each member's species as the seed rolls it - chooseRandomEnemy at the
  grant's pixel's climate (the owner's own CLIMATE.PAK), its world minute's day or night and its owner's signed level, from
  the member's species die (scenes/grantHost.js grantSpecies) - in place of its own roll; a reader rolls the same from
  its own map and refuses any other species (`dice`), in a location's rect or out of one (the owner's place, which a
  reader cannot see). Neither owner nor forger chooses the species, every machine confirms it, and no Merkle root is
  needed: every honest reader's map is the same file. An encounter alone - a camp's composition is OPEN.
- **GRANT9** (section 4.11). While `grantStrip` is on, a foes frame (a cell's, or a world room's own lane) loses at the
  relay each record that names a grant this room does not hold as its sender's, a member past it, or marks past it, and -
  from a socket that has stood on a grant here - a live record with no grant that is not its ally (`al`, `cw`, `cp`); a
  body and a standing foe's delta pass (`_grantStripped`, a Room method, on `_foesFan`'s path). Off, the relay strips
  no foe record (section 4.6). Turn it on only when the measure shows the fan can afford the walk (section 6).
  STAFF-PANEL5-MONSTERS (2026-10-23, world249): the Staff Panel's Monster watch reads a full frame's records as it fans,
  on or off - while STAFF_NET_FEED_URL is set, and only to count them (`server/src/staffFeeds.js` staffFoesSeen); it
  drops, changes and holds nothing.

Pins: `test/net/grant4_relay.test.js`'s GRANT8 and GRANT9, `grant4_lanes`' GRANT8; `tools/mutants/grant4.json`.

## 17. AUDIT GRANT: the audit's fifteen, fixed (2026-10-18)

Mac: **"Audit this real quick"**, then **"Yes fix them"**. A cold read of GRANT1-GRANT9 before its merge found fifteen;
each is fixed here and pinned.

- **A1, a world room's answers.** The session took a grant's answer in a cell alone, so a building's and a dungeon's own
  lane asked and never heard (net/online.js): it hears every room whose foes ride (`streamsFoes`).
- **A2, a late reader.** A full frame carried the same first GRANT_FRAME_GRANTS_MAX grants every time, so a reader that
  came in late never heard the rest and tallied `unsigned` - a case's reason - against an honest owner. A full frame
  carries the grants longest unsaid first (grantHost.js frameGrants), and a reader waits three full frames
  (GRANT_VERDICT_WAIT_MS, six seconds) for a grant it has not heard.
- **A3, the watch across pools.** The street's pool and a building's share one grants' host, and a building's frame
  swept the street's watchmen off it. Each pool sweeps its own (`watchSweep(list, pool)`).
- **A4, a window overfilled.** A reader's tally folded whole could push a window past GRANT_MEASURE_ROWS, and the relay
  dropped the batch. It is posted at its bound mid-tally, and the rest begin the next window.
- **A5, idle hours as asking time.** A window began at the last post. It begins at its first fold (`_grantFrom`), so
  GRANT5's rates are asks an hour of asking.
- **A6, the machine's clock.** A grant's expiry is the relay's; the host reads it on the relay's clock (the session's
  `clockOffsetMs`).
- **A7, one bucket for every ask.** A cull's or a death's frees and heirs spent the socket's bucket a grant each, ahead
  of the next camp's mint. A turn's frees are one ask (`gs`) and its heirs one (`hs`), the heirs first.
- **A8, a relay that forgot.** A renewal named numbers, and a relay deployed or evicted held none of them. A renewal
  carries its grants whole, and the relay signs again one that is mine, this cell's, alive and its own signature.
- **A9, a closed socket's law.** The host read the last welcome's law after the socket closed, and under `enforce`
  stood nothing. A socket not open is no law.
- **A10, a cold cell's welcome.** The welcome reads the setting the cell last had, and a cold cell had none. A mint's
  answer says the law the relay read at the ask (`gm`) - a cold cell's ask awaits the hub - and the client takes it. The
  welcome still asks nothing (a hello is never the hub's call, GROUND-GATE).
- **A11, a stood-down foe rebuilt.** Under `enforce` a record a reader stood down was built, checked and tallied again on
  every frame. A record's refusal is kept by the grant it names (`downed`), and it is neither built nor tallied again
  on that grant - `unsigned` only until the grant is heard.
- **A12, a watchman refused for good.** He is asked again at the watch's pace (GRANT_WATCH_REASK_MS).
- **A13, a crossing during a carry.** A carry answered by nobody (a timeout, an answer gone to a socket now a halo's)
  gave every grant up, and a second crossing while one was out was never carried. The crossing is carried when the
  last lands, and an unanswered carry is asked again GRANT_CARRY_TRIES times before its grants are given up.
- **A14, an `encr` heir's fallback** asked `encr`, which is never asked; it asks `enc`.
- **A15, a member handed twice.** The relay forgot what it had handed on at a renewal, and handed on from a grant
  freed. Its handed members survive a renewal, and only a grant held live as mine hands one on.

Pins: `test/net/grantaudit_relay.test.js` (2), `test/scenes/grantaudit_host.test.js` (6), and in `grant3_asks` (the
batched asks, a forgotten grant renewed, a member handed once across a renewal and never from a grant freed) and
`grant3_pool` (a stood-down record never rebuilt); `tools/mutants/grantaudit.json` (19, all dead). Records re-aimed
where the asks moved: `grant3.json`, `grant4.json`.

## 18. GRANT-UNHEARD: a grant never heard opens no case (2026-10-18)

Mac, the first case GRANT7 opened in #mod-queue (`eaa16aa332a19547`: "3 players' games refused 6 of this account's
foes in 10 minutes: unsigned 6"): **"Is this the system working?"**, then **"Yes"** to the fix.

- **What it was.** A reader called a grant it had not heard inside GRANT_VERDICT_WAIT_MS `unsigned` - the word for a
  signature that fails, and a case's reason. Unheard is what a crowded cell makes: the relay's foes fan drops a frame past
  the room's byte budget (FOES_ROOM_BYTES_PER_S, `server/src/index.js` _foesFan), the big full frames that say every grant
  again before the small deltas, so a reader holds an owner's records and none of its grants. An honest owner was counted
  as a forger.
- **The fix** (`scenes/grantHost.js` judge): unheard is `ungranted` - a record with no grant this reader holds. It is
  stood down while the law enforces, judged anew once a frame brings the grant (the A11 memo), and opens no case.
  `unsigned` is a grant heard whose signature fails, or a malformed one: a forgery's word alone.
- **And a forgery judged once.** The A11 memo judged an `unsigned` record anew whenever its grant was held - which a
  failed signature's always is - so an enforcing reader rebuilt, checked and tallied it on every frame. It is kept, and
  counted once.
- **No relay change.** `ungranted` was already a reader's reason (GRANT_READER_REFUSALS): the relay and the account
  service read the tallies as they did, and nothing deploys but the site. A game on the build before this keeps calling
  unheard grants `unsigned` until it reloads or updates - **a case whose only reason is `unsigned`, from that build, is
  most likely this: dismiss it.**
- **A first guess, wrong, said plainly.** The fix's first diagnosis was a cell crossing - the old grant renumbered by
  its carry before a reader in the new cell heard it. A crossing's first frame there is a full one (`scenes/world.js`:
  the room change asks for it), which carries the old grant, so that reader hears it and counts `cell` at most.

Pins: `test/scenes/grantunheard.test.js` (2); `grant4_lanes`' GRANT6 wait and `grantaudit_host`'s A11 (PIN MOVED:
unheard, never `unsigned`); `tools/mutants/grantunheard.json` (3, all dead).

## 19. FOE-BOUNDS: a foe no builder could give is refused, never rescaled (2026-10-19)

Mac, after GRANT-UNHEARD: **"My friend spotted someone doing spawning and yet it didnt show through the moderation
panel"**, then **"So basically the entire grant system we built is worthless"** - against a deliberate cheat, as built, it
was: the law measured (nothing refused), a sender that never asked a grant was read as an old build for good (section
20), and a case opened only on three readers' word of a forged grant. Then a hand-off spec - **"LATTY: REJECT AND REMOVE
INVALID ENEMY HANDOFFS; DO NOT RESCALE"**: at a hand-off reject a provably impossible monster and remove its network
copy, never shrink it to a legal one, keep the evidence in the moderators' queue, and never blame the player it was
handed to - answered **"Spec + B + A"** and, for its limits, **"The game's own code"** (its tables and `modifiers.json`
were not attached).

- **The bound** (`net/foeBounds.js` foeHealthBound): every stage that builds a foe's maximum rounds once and never lowers
  it, so the highest base and every highest multiplier in the builders' own order and rounding is the exact legal most -
  each input a reader cannot see (the owner's dice, its combat standing and hero level, a revenant's rank, wrath and the
  Dread, the wild ring, a Rite's Summoner, a fallen star's coven - STAR-TUNE, any camp's foe x2, `FOE_BOUND.star`) taken
  at its worst, and each mark the record says of itself (`z`, `cp`, `nm`,
  `gg`) only raising it. Two chains: the street's (`scenes/exteriorFoes.js` spawnFoe - a building's pool is the same
  module) and the dungeon's (`scenes/dungeonContext.js` buildFoeAt - its record carries no marks, so a layout foe's worst
  and a revenant's lair stand's are both taken). A class foe's base is DFU's roll at its worst (10 + level x
  CreateCharCustomClass.cs's most hit points a level, 30); a monster's the most of its row over the three profiles a game
  can build with (vanilla, Meaner Monsters, Meaner Monsters with PCAAO's edit - online forces the last). The wild zone's
  x8 only where the zone may be about the foe (its own pixel in a cell, WILD_NEAR_PX about it; the zone under the reader's
  feet elsewhere; yes while no zone mask is loaded), the Rite's x3 only for a class foe in a camp (the frame's `cz`).
  `test/net/foebounds_law.test.js` holds each copied constant to its home and the bound EQUAL to what the game's own
  builders make at their worst - every monster, class foes at three levels, each combination of marks - the spec's
  "exact legal max and max+1".
- **Refused at the reader** (`scenes/grantHost.js` statsRefused, whenever the law is not `off`): a record over its bound,
  or a mark no builder gives its kind (an elite or a champion City Watch, a champion under level 3), is never built,
  never updated and never ADOPTED - the street's record loop and the dungeon's own lane refuse it before anything is
  stood, so a hand-off of it is refused before it is the receiver's, and it never rides as theirs; a copy already
  standing is taken down silently (exteriorFoes.js removePuppet, dungeonContext.js dropOwnPuppet: no death, no body, no
  loot, no experience). The dungeon host's stream (applyFoeRecord) does not apply such a record - the reader's copy
  stands as it was. Tallied `stats` against the SENDER, once a record, never against the receiver.
- **`stats` is a case's reason** (net/grantLaw.js GRANT_CASE_REASONS) and a reader's tally word; a reader hands it only
  to a relay at world223 or later (GRANT_STATS_RELAY_MIN - an older one refuses the whole tally).
- **The relay's strip** (GRANT9, `grantStrip` on): a record over its bound goes to nobody - the one authority every copy
  hears, so no copy stands it, adopts it or passes it on (the spec's tombstone, while the switch is on) - and is counted
  once a sender, record and claim under the relay's own name (net/grantMeasure.js GRANT_RELAY_READER, `~relay` - no
  account id is one), the worst one's evidence beside it (`{ t, k, mx }`), in the batch the relay signs.
- **THE FOUR HOSTS** (Home.md): `scenes/world.js` (the street's pool) and `scenes/worldModes.js` (a building's - the same
  createExteriorFoes) refuse in exteriorFoes.js's record loop; `scenes/dungeonContext.js` in its own lane's loop and on
  the host's stream; `scenes/exterior.js` streams no foe.

Departures from the spec, named: no per-foe spawn record holds the owner's skills, place or settings - the grant is
the provenance (relay-signed: the monster's number and member, its creator and account, its seed, its signed level and
Renown, its elite and champion marks; a hand-off is a relay-signed grant of its own), and what no grant names is taken
at its worst, so the bound proves gross forgeries, not a few points of inflation; the case is one per account a window,
its line carrying the count and the worst evidence (section 21), not one per foe; the relay's removal stands while
`grantStrip` is on, and a reader's alone otherwise; an ally, a companion and a crewman (the frame's own lists) are
unverified; the in-game moderation panel still calls a spawn grants' case "opened by the reviewer" (a localised line,
left for its own slice - the Discord card says the spawn grants opened it).

Pins: `test/net/foebounds_law.test.js` (5), `test/scenes/foebounds_pool.test.js` (5).

## 20. GRANT-DOOR: a build that says no spawn grants is turned away, and every sender is held to them (2026-10-19)

The hole section 19 names: a reader held a sender to grants only once it had heard a grant from it (`capable`), so an
older build's foes were never refused - and a changed client that never asked one was that older build, for good, even
while the law enforced.

- **The hello says it** (net/wire.js GRANT_HELLO_LAW, `gv`): a foes room's hello (a cell, a world room) says the spawn
  grants its build stands on; the relay keeps it on the socket.
- **The relay vouches** (server/src/index.js fanOut): every foes frame it fans from such a socket carries `g` 1, the
  relay's word, never the sender's; the session keeps such senders (net/online.js grantSenders) and a reader holds each
  to grants from its first frame - a record of its with none is `ungranted`, stood down while the law enforces. The strip
  (GRANT9) holds such a socket to grants as it holds one that asked.
- **The door** (`grantDoor`, var GRANT_DOOR, off unset): while on, a foes room refuses a hello that does not say it - an
  older build, or a changed one leaving it off to pass for one - with GROUND-GATE's words and GRANT_OLD_REASON, before
  anything is written; GROUND-GATE's own law - a current build's hello asks nothing, a cold room asks the hub before its
  first such hello, the hub lets anyone in. **Off until the site serves the build that says it** (the relay deploys first);
  then `/relay grantDoor on`. A player on an older build is turned away until it reloads or updates.

Pins: `test/net/grantdoor_relay.test.js` (5); the hello's pins (`online`, `world6biiib`, `fb1017f_groundgate`'s current
build) and relayCfg's keys and vars (`scale5b`) moved.

## 21. GRANT-ASKS and the relay's own count: cases with no reader's word (2026-10-19)

GRANT7's case needed three readers' accounts to tally a forgery; spawning on real grants, fast, was counted and never a
case. The account service (server-account/src/grants.js) now opens one on the relay's own count too:

- **What the relay stripped** (section 19): a `~relay` tally opens its sender's case alone - the relay saw the sender's own
  frame - its line "the relay itself dropped N of this account's foes no builder could give - the worst a type T at K
  health, its most M".
- **An account's own asks** (grantAskText): in one cell's window, GRANT_ASK_CASE_TIMES (4) times the most its budget lets
  honest play ask (the kind's `cap` and its `rate` over the window) and GRANT_ASK_CASE_OVER_MIN (16) past it. Its asks, not
  its bucket's refusals: the cell's ceiling is asked first, so a flood that filled the cell is counted `ceiling` from
  then. Both numbers ride with GRANT5's buckets.
- **One line an account a batch** (grantCaseLines): a case line is keyed by its case, second and account, so a batch's
  findings on one account - readers', the relay's, its asks - are one line, joined; one line a window as GRANT7's.
- **No flood**: the relay's own count opens at most GRANT_OWN_CASES_HOUR (30) cases an hour; a case already open takes
  its line regardless.
- **The card** (server-account/src/discord.js caseCard): a case of the spawn grants' with no reviewer's verdict is titled
  "(opened by the spawn grants)", its reports "none - the spawn grants' count opened it", and never "Reviewer: found
  nothing against the code" - which read as a verdict the chat reviewer never gave.

Departures: the spec asked for a new enemy-transfer ingress; the relay's signed batch to `/v1/mod/grant-feed` is that
receipt already, so no new route. Pins: `test/server/grantcase_own.test.js` (4). Mutants for sections 19-21:
`tools/mutants/foebounds.json`. Relay world223, account service acct158 - deploy the service with or before the relay;
nothing else orders them.

