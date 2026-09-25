# World Bosses - the Oblivion Gate (WB)

> Design page, written before any code (2026-09-25). The slices at the foot are the order it ships in; each is
> shippable and verifiable without the next. Where the page and a shipped slice disagree, the slice's own record
> (`06-Systems/Online-Arc.md`, WB rows) is what runs.

## What Mac asked for

Mac, 2026-09-25, on online content: *"introducing online content like world bosses and instanced difficulty
dungeons"*, then, choosing the trust model and the scope - *"1. Option B 2. Lets just focus on world bosses for
now"* - and the picture:

> *"I was thinking at any point in the world, on the timer, a large area would be shown on the map, also in chat
> like you suggested. A gate model would be spawned with a timer that leads to a completely different area, a gate
> of oblivion which takes place in a large boss arena with an oversized enemy with telegraphed attacks (like wind
> ups, etc) On death the boss would physically spew out per player loot and bounce (sort of how dropping a torch
> works) and have a sort of rarity glow attached to it. This is something ive wanted to build for a long time and be
> as detailed as possible. Like really develop this content properly"*

**Option B**, as offered and chosen: the relay's Durable Object is the authority over the boss. It keeps the boss's
health from the players' hit frames, runs its attacks, stamps the kill, and hands each player who earned it a
SIGNED kill receipt that the account service honours. This is the first place the relay reads a game frame - co-op's
trust law (`Multiplayer.md` "Trust": a client's damage claim is applied as sent) stays everywhere else.

Instanced difficulty dungeons are NOT this arc. They are named so they are not mistaken for missing.

## The shape, end to end

```
 the shared clock ──► the OMEN (17:00) ──► the GATE rises (19:00) ──► OPEN (20:00-22:00) ──► the ARENA
   (no frame)          map ring + chat       sealed, a countdown         step through           gate:<day> room
                                                                                                   │
   the account ◄── redeem ◄── RECEIPT (signed) ◄── the KILL (the relay stamps it) ◄── the FIGHT ◄─┘
   service                        │                                                  relay-run boss,
                                  └──► the SPEW: per-player loot, bouncing, glowing   telegraphs, hits
```

One gate a game day, at dusk. Every client and the relay compute when and where from wall time alone - the
shared clock's own law (WORLD5: `wire.js sharedClassicMinutes`, no frame) - so the omen, the map ring and the gate
cost the relay nothing. The relay is spoken to only inside the arena.

## 1. The schedule - a function of the clock (WB1)

The online world's clock runs at TimeScale 12 (`ONLINE_MINUTES_PER_MS`): a game day is two real hours. The gate is
a game-day event, so its times are clock times every player can read off the game's own clock, and real times
every player's machine can compute.

| game time | real time | what |
|---|---|---|
| 17:00 | T - 15 min | **the omen**: the sky over the site burns; the map ring and the chat line |
| 19:00 | T - 5 min | **the gate rises**, sealed, counting down |
| 20:00 | **T** | **the gate opens**; the arena room admits |
| 22:00 | T + 10 min | **the gate seals**: no one else gets in; whoever is inside fights on |
| 24:00 | T + 20 min | **the wrath**: a boss still standing razes the arena and the gate collapses |

With the clock's epoch (2026-09-14T00:00Z is game 13:30), T falls at **HH:32:30 UTC for every even hour HH**. The
event's number is the GAME DAY `D = floor(sharedClassicMinutes / 1440)`, the gate opens at classic minute
`D*1440 + 1200`, and `wallMsForClassicMinutes` (OL3) turns every row above into relay-clock milliseconds. Pure law,
one home, both ends: `net/gateLaw.js`, imported by the client and by the relay (which checks a boss room's
window with it). Constants: `GATE_OPEN_MINUTE` (1200), `OMEN_LEAD_MINUTES` (180), `RISE_LEAD_MINUTES` (60),
`GATE_OPEN_MINUTES` (120), `GATE_WRATH_MINUTES` (240), `GATE_EVERY_DAYS` (1 - one a game day; Mac tunes it).

Offline there is no gate: the schedule is a fact about the shared world, and a solo world keeps its own clock.

### Where - the site

The site is the client's to find and every client finds the same one: a hash of the day over the world's own data,
spawned dungeons' law (`world/spawnedDungeons.js`: "every player rolls the same pixels ... No relay word is needed").

- **The region**: `hash32(GATE_SALT, D, 1)` over the regions that hold enough suitable pixels, never the previous
  day's.
- **The pixel**: `hash32(GATE_SALT, D, 2)` over that region's suitable pixels - LAND (above the water line, not an
  ocean climate), NO LOCATION on it or its eight neighbours, and REACHABLE: 2 to 4 pixels from the nearest town a
  traveller can fast-travel to (online a trip arrives at once - OL2 - so the gate is a ride from a town, not a
  march across a province). The town is named in the omen.
- **The spot**: the pixel's centre plus `hash32(GATE_SALT, D, 3)`'s offset, up to 200 m, on the ground the terrain
  sampler answers.

The relay never needs the site: it keys the arena by the day.

## 2. The omen - the map and the chat (WB1)

**The map ring.** From the omen until the gate collapses, the map draws a LARGE AREA, not the spot: a ring of
`OMEN_RING_PIXELS` (2 map pixels, ~1.6 km) whose centre is the spot pulled up to 1.2 pixels off by the hash - so
the map says where to go and the land says where exactly (the beacon, below). Enhanced held map: a burning ring and
a hatched fill painted in `inkMap.js paintInkOverlay` beside the party rings, with the label *Oblivion Gate - opens
at 8 in the evening (14:32)* and its countdown. Classic region page: the ring written into the region's texel page
after `_drawPartyMarks`, when the site's region is the one open. Online data reaches the maps the way the party's
does - a function in the travel map's dependency bag - so neither map learns the net.

**The chat.** Local system lines on the World tab (`ChatLog.push`, `system: true`), each client printing its own at
the clock's moments - the relay sends none of them:

| when | line |
|---|---|
| 17:00 | *The sky burns over the wilds near Wayrest, in the Wayrest region. An Oblivion Gate opens there at 8 in the evening (14:32).* |
| 19:00 | *An Oblivion Gate has risen near Wayrest. It opens in five minutes.* |
| 20:00 | *The Oblivion Gate near Wayrest stands open. It seals at 10 in the evening (14:42).* |
| 22:00 | *The Oblivion Gate near Wayrest has sealed.* |
| 24:00 | *The Oblivion Gate near Wayrest collapses. Valkynaz Ruhn returns to the Deadlands.* (not after a kill) |

The ONE line that needs the relay is the fall, said to everyone online: *Valkynaz Ruhn has fallen at the gate near
Wayrest - slain by Ann, Bran and 12 others.* The arena's object tells the hub (`chat:world`, the one room every
player is in) through an internal door, HCC-PARK's shape (`_parkInternal`), and the hub fans it once. One
object-to-object request a kill.

**The compass.** Within the ring the enhanced HUD's compass strip carries the gate as a marker of its own colour
(`drawDetectMarkers`' pool, a second list) - the beacon is seen, the compass says which way it is when it is not.

## 3. The gate - in the exterior (WB2)

A model of the port's own, built in code: no Daggerfall record looks like an Oblivion gate, and Morrowind's data is
the player's own and optional (MWA4), so nothing here may lean on it.

- **The shape**: two horned pillars of black volcanic stone curving toward each other over a threshold, spined
  along their backs, on a cracked plinth, ~14 m tall. Low, square-pixelled textures of the port's own made at boot
  under a pseudo-archive (`bloodArt.js`'s law: `BLOOD_ATLAS_ARCHIVE` 38001 - the gate's are 38101+), so it sits in
  Daggerfall's pixel world rather than over it.
- **The membrane**: the portal between the pillars, a foreign pass (`duelWall.js`'s law: added light, no depth
  written, its geometry fixed and its motion on uniforms, every rate whole cycles over its clock period): a slow
  fiery swirl, dark and slow while sealed, bright and fast while open, gone when it collapses.
- **The beacon**: a column of red light straight up from the gate, several hundred metres tall, added onto the
  frame and fogged thin but never out - the gate is found by looking up.
- **Light and sound**: a red point light (the per-light colour `setPointLights` already takes), embers rising, and a
  low roar looped at the gate.
- **The countdown**: looked at, the World Tooltips plaque names it *Oblivion Gate - opens in 3:12* / *closes in
  8:41*; within 60 m the same words stand as a line at the top of the screen.
- **States**, all read off the clock: *rising* (19:00, it climbs out of the ground over 20 s), *sealed*, *open*,
  *sealed after* (22:00: the membrane darkens, the arena's players still inside), *collapsing* (the kill or the
  wrath: it sinks over 10 s and the beacon goes out).
- **Entering**: press activate at the membrane, or walk through it while it is open. A relay that cannot hold a boss
  room (`relaySupportsBoss(v)`, the look/park/cast gates' shape) makes the gate say *The gate will not open to you
  yet.* and nothing else.

## 4. The arena - a completely different place (WB3)

**The Burning Court.** A disc of black flagstones 36 m across, cut with a ring of glowing runes, standing over a sea
of fire under a red sky; jagged spires around its rim with braziers between them; a broken bridge to the south where
the player arrives, and on it the way home - a second, smaller membrane. Nothing on the disc: no pillar, no step, no
wall to hide behind. The only cover is distance and the boss's back.

**Which host.** Not a fifth. The four-hosts law (`Multiplayer.md` "Constraints") exists because every host has
been missed at least once, and an arena that needs combat, spells, the HUD, the inventory, other players, a death
and a way out is a host's whole job. So the arena is a DUNGEON - the dungeon host (`buildDungeonContext`) with a
level made in code:

- **A made location**, `gateArenaLocation(day)` (`world/gateArena.js`, the shape `synthesizeDungeonLocation` makes
  for spawned dungeons): one starting block, a map id no real place has, and a flag the room key and the exits read
  (`gate: day`).
- **An empty block.** `layoutDungeon` reads a block by name from the blocks file and throws on a name it does not
  know; the arena hands it a blocks file that answers ONE extra name with a made block holding nothing but its start
  marker (the editor flat 199.10) - no model, no door, no foe marker, no water. Every system that walks the level
  walks an empty one.
- **The court itself** is added the way the runtime pools add theirs (`horseCartPool.js`, `camps.js`): its meshes by
  `renderer.createMesh` over the port's own geometry and its own textures (pseudo-archives 38111+), its floor, rim
  and spires to the collider by `collider.addMesh`, its braziers to the light list. The court is built once per
  context and destroyed with it.
- **The sky and the fire below** are passes of their own (the duel wall's law), and the dungeon's fog and clear
  colour turn the red of the Deadlands for as long as the context stands.
- **The edge** keeps the player on the disc with the motor's own clamp (`motor.arena` - DUEL1's `_keepInArena`,
  which exists for exactly this: a ring the body cannot leave that stops no arrow and no spell) at the court's
  radius; the fire below is never reached.
- **The way out** is the south membrane: activate it and the player leaves as from a dungeon, landing at the gate's
  spot outside (the exit's landing asks the location's gate before it looks for an entrance door). Death is cast out
  (below) through the same landing.
- **The room**: `roomKeyFor` answers the arena's own key, `gate:<day>`, for a gate location - not `dungeon:m...`,
  so none of the dungeon's world-room law (the host's memory, the foes stream) runs there: `isWorldRoom` refuses it,
  and the arena's foe is the relay's.
- **What the arena turns off**: rest (an enemy is near - always), the travel map's journeys, Recall's mark (a mark in
  a place that ends in twenty minutes), the dungeon's automap (an empty level), and saving inside it - a save made in
  the court would load into a place that no longer exists. A load of such a save is refused by the gate's own check
  and lands the player at the gate's spot.

## 5. The boss (WB3 relay, WB4 client)

**Valkynaz Ruhn, Warden of the Burning Gate.** A Daedra Lord drawn at three times its size (~5.5 m), in Daggerfall's
own sprite - the frames every client already has. The kind is a table (`GATE_BOSSES`), picked by the day, so a
Daedroth or a Fire Daedra can take a later day without a new mechanism; v1 ships one.

### Who runs it - the relay

The co-op law says the host's browser is the server because a Durable Object running the simulation would be a
second copy of the game (`Multiplayer.md`). The boss is the exception that proves it: the ARENA is built so that a
boss needs no game to run. It stands on a flat disc with nothing to path around, so its whole world is a point, a
facing, a health bar and a clock. The relay can run that - a brain of a few hundred lines of pure law
(`net/gateBrain.js`, pinned in node with fake time), stepped by the object's alarm every `BRAIN_TICK_MS` (250)
while the fight lives, and never otherwise. Its costs are the frames it sends and the seconds it is awake; the
players' poses keep it awake anyway (RELAY-H1: a Durable Object bills its awake seconds).

The brain knows where every player stands without a new frame: each socket's last pose rides its attachment
already (the range gate reads it). It targets from those, and it never trusts a pose for more than it is: a place
to aim at.

### The fight's numbers

Nothing the relay can check says how strong a player is: saves are the player's. So the fight is scaled by a claim
that cannot be used to cheat, because the same claim bounds what the claimant may deal:

- **The level claim.** Each player entering says its level once (`{t:'gate', k:'in', lv}`, 1-60).
- **The reference damage.** `dpsRef(lv) = 5 + lv` damage a second - the port's own formulas at a normal swing rate
  (level 1 with an iron longsword lands ~8-12 a blow once a second at ~60%; level 20 with a daedric dai-katana ~26-37
  at ~85%).
- **The health a player brings**: `BOSS_TTK_S * dpsRef(lv)` (`BOSS_TTK_S` 240), added while the gate is open, at the
  boss's current fraction - so the fight grows with the crowd and a late arrival does not heal it.
- **The damage a player may deal**: a bucket per player refilling at `3 * dpsRef(lv)` a second, `15 * dpsRef(lv)`
  deep, and no single blow over `12 * dpsRef(lv)`. Over it the blow is CLIPPED, not refused, and counted.

So a claim of level 1 brings less health and may deal less; a claim of 60 brings more and may deal more. At every
claim the fastest possible kill is `BOSS_TTK_S / 3` of full-rate damage - eighty seconds of the whole room at the cap.
A modified client can still refuse to take damage (a player owns their body - co-op's law); it cannot kill the boss
alone, faster, or for anyone else.

### A blow on the boss

A player's swing, shaft or spell at the boss is the game's own formula on the player's own machine, as at any foe;
the number goes to the arena room as `{t:'gate', k:'hit', q, d, r}` (a sequence, the damage, melee/shaft/spell).
The room ACCEPTS it only if: the socket entered this fight and is alive (its pose carries no `dd`); the boss is not
shielded (a phase change); for melee, the pose stands within the boss's radius plus the reach plus a slack for the
pose's age; the socket's hit rate holds (`GATE_HIT_HZ_MAX`); and the bucket above has it. The health falls, the
blow is credited to the socket's VERIFIED ACCOUNT (the token's `sub`), and the room says the health at most
`GATE_HP_HZ` (4) a second.

On the player's screen the boss is a target the melee reach, the arrows and the spells already know how to hit - a
body of its own radius and height, standing where the relay says - and a blow on it says a number, bleeds and
sounds as any.

### Its attacks - every one telegraphed

The fight is about READING the boss. Nothing in the game can dodge (there is no dodge key, `inputActions.js` Slide is
declared and dead), so every attack is escaped by MOVING: a player runs 7.6 m/s, and every wind-up is long enough to
run out of its shape from its middle. Each attack is a wind-up the relay announces, a moment it lands, and a
recovery:

| attack | shape on the ground | wind-up | hits for | phase |
|---|---|---|---|---|
| **Cleave** | a cone, 110°, 9 m, before him | 1.4 s | 30% | 1+ |
| **Ground Slam** | a disc, 7 m, around him | 1.6 s | 35% | 1+ |
| **Charge** | a lane, 3.5 m wide, to the target and 22 m on; he runs it | 1.2 s | 25% | 1+ |
| **Hellfire** | a 3.5 m disc under each of up to 5 players, where they stood | 2.0 s | 30% fire | 2+ |
| **Flame Nova** | a ring from 4 m to 18 m - safe only at his feet | 2.2 s | 40% fire | 2+ |
| **Dagon's Wrath** | the whole arena | 6 s | 999% | the wrath |

*Hits for* is a share of the struck player's OWN maximum health, resolved by the struck player's own machine against
its own feet at the landing moment - co-op's law ("an enemy's strike on a client is applied by that client"),
scaled so a level-1 and a level-30 read the same fight. Fire honours the player's fire resistance through the
game's own `savingThrow` (a Resist Fire potion is a real answer to Hellfire), and a Shield spell soaks it through
`hurtPlayer`'s own pool.

**On the ground**: every shape is drawn where it will land - a dim outline at once, filling toward the edge as the
wind-up runs, bright at the landing - a decal pass on the floor (`render/gateTelegraph.js`, the duel wall's law of
fixed geometry and uniforms). **On him**: the sprite holds its attack frame's first half through the wind-up, glows
the attack's colour, and his voice gives the wind-up's cue; at the landing the attack frames play out. **In the
ears**: each attack has its own wind-up sound, placed at him.

**Phases**: at 66% and 33% he roars, stands shielded for 3 s (blows glance, the room refuses them), and a Flame Nova
comes with the roar. Phase 2 adds Hellfire and the Nova; phase 3 cuts every wind-up by a fifth and casts Hellfire
twice. **Targets**: an aimed attack goes 60% of the time to the player who dealt the most in the last ten seconds and
40% to a random living one - the tank is whoever hits hardest, and nobody is safe. **Movement**: between attacks he
walks at 3.2 m/s toward his next target until it is in his attack's reach; he never leaves the disc.

### Death, and the way back in

A player killed in the arena is CAST OUT: they stand up outside the gate with half their health (D-ONLINE1's respawn
door with the gate's spot as the landing, not the nearest temple), keep what they dealt, and may step back through
while the gate is open. After it seals, the fallen watch from outside.

## 6. The fall - the relay stamps the kill (WB3)

At zero the room stamps the kill once: `{k:'fell', at, top}` to everyone inside, the hub's world line, and to each
account that EARNED it a receipt. Earned: dealt at least `RECEIPT_SHARE` (2%) of the health that account's own claim
brought, or stood alive in the arena for half the fight - so a player who spent the fight healing others still earns
it. One receipt per account per day, whatever tabs it holds.

**The receipt** - the relay's first signature. Today the relay holds no secret at all (ACC1: it verifies, the account
service signs). A kill the account service will honour has to be signed by the one party that saw it, so the relay
gets ONE key, and it can sign ONE thing:

```
r1.<base64url({ d, b, s, c, x, i, e })>.<base64url(Ed25519 signature)>
    d the day   b the boss kind   s the account (the token's sub)   c the loot seed (32 bits, the relay's CSPRNG)
    x how the account earned it (dealt / stood)   i issued   e expires (i + 7 days)
```

`net/gateReceipt.js` holds the law beside `identityToken.js`'s and mirrors its ladder (the version is the
algorithm and is read first; signature first, content second; refuse, never repair). **A receipt can never pass as
an identity or an order, nor they as it**: its prefix is `r1`, which the identity verifier refuses before a byte is
parsed, and it is signed by a different key. The relay's key is a Worker secret (`GATE_SIGNING_KEY`, PKCS8, sign
only, non-extractable - `server-account/src/signing.js`'s shape); the account service holds its public half
(`GATE_PUBLIC_KEY`), and the deploy checks the pair as it checks the identity pair. A relay with no key still runs
the fight and the loot - the receipt is then unsigned and the account service declines it, and nothing else changes.

**The account service** (acct9): migration 0009 `gate_kills (day, account, boss, earned, at)`, primary key
`(day, account)`, so a receipt counts once whatever happens to it. `POST /v1/gate/claim { receipt }` behind a session
whose account is the receipt's `s`. `/v1/account` carries the count, and the main menu's account card and the Inspect
card say *Gates closed: 3*. Guests fight and loot; the record is registered accounts', as the duel's is (AUDIT DUEL1
A1).

## 7. The spoils - the boss spews them (WB5)

Per player, and seen by that player alone. The seed is the receipt's `c`, so a reload never rolls again and every
player's roll is its own.

- **The roll**: gold (`250 * level`, varied by the seed) and three pieces - one Rare or better, two Magic or better
  - minted with the game's own makers (`createRandomWeapon`, `createRandomArmor`, jewellery) on
  `rolls = seededRng(c)` (`systems/wind.js`), then laddered through Loot Rarity's `applyRarity` from a source of the
  gate's own kind: `SOURCE_MULT.gate` over the boss's 2.5, a Legendary chance of 10%, the ladder's own caps otherwise.
  And a **Sigil Stone**: the gate's trophy, a gem the port names, worth a small fortune, one a kill.
- **The spew**: at the kill the boss's body bursts and each piece leaves his chest on its own arc - out and up toward
  the player's side of him, the seed choosing each angle and speed - and falls, bounces and comes to rest with the
  thrown torch's own physics (`droppedTorches.js stepProjectile`: the fixed 0.02 s step, gravity, the collider's ray,
  the bounce at 0.5, rest under a fifth of the throw's speed), one at a time over a second, each with a sound as it
  lands.
- **The glow**: each piece stands in a beam of its tier's colour (Loot Rarity's own: Magic #6f9ee8, Rare #e4c34f,
  Legendary #e07a2e, Artifact #b57bee), rising from a halo on the ground - the first place in the port a rarity is
  drawn in the WORLD - and Rare and better carry a light of that colour; a Legendary's beam is taller and pulses. The
  Rare chime (`playRareDrop`) plays when a Rare or better comes to rest.
- **The take**: activate a piece, or walk over it, and it goes into the pack through `addItem` (gold through
  `addGoldPieces`), the name said in its colour. Leaving the arena with pieces still on the floor GATHERS them into
  the pack - a boss's reward is never lost to a door, a disconnect or a death. The pieces not yet taken ride the save
  (`gateSpoils: {day, pieces}`), so a crash between the spew and the take loses nothing either.

## 8. The wire

One frame type, `gate`, with a kind. Everything else the arena needs - the poses, the chat, the looks - is the room's
ordinary law.

| frame | way | when |
|---|---|---|
| `{t:'gate', k:'in', lv}` | client → room | once, on entering |
| `{t:'gate', k:'hit', q, d, r}` | client → room | a blow on the boss |
| `{t:'gate', k:'st', ...}` | room → client | on entering, and every 5 s: the whole state (day, boss, phase, health, where he stands, the attack in flight, the wrath's time) |
| `{t:'gate', k:'mv', x, z, tx, tz, v, at}` | room → all | he walks from here toward there from `at` |
| `{t:'gate', k:'atk', i, a, at, x, z, yaw, p}` | room → all | an attack's wind-up: which, when it lands (the relay's clock), where, its targets |
| `{t:'gate', k:'hp', h, m}` | room → all | health, at most 4 a second |
| `{t:'gate', k:'ph', n, until}` | room → all | a phase, and its shield |
| `{t:'gate', k:'fell', at, top}` | room → all | the kill |
| `{t:'gate', k:'rcpt', r}` | room → one account's sockets | the receipt |
| `{t:'gate', k:'wrath', at}` | room → all | the wrath |

Every time is the RELAY's clock; the client reads it through the welcome's offset (WORLD5). A room key of the arena's
own, `gate:<day>`, which the relay admits only inside that day's window (refused *the gate is closed* outside it) -
a client cannot mint a boss the clock did not raise. Each day's arena is a fresh object, so nothing carries over
and nothing needs sweeping but the object's own short storage (its fight, checkpointed every two seconds so an
eviction loses two seconds, not the fight).

`RELAY_VERSION` bumps once for the lot; `relaySupportsGate(v)` gates the client, as the look, park and cast frames'
gates do. The bump redeploys the relay and drops every connected player once (RELAY-H1's F1) - so the relay half
ships in ONE slice.

## 9. What it does not do (v1), said so

- No adds. Every add would need an owner to run it; the relay could own simple ones as it owns the boss - later.
- The boss does not path. The arena is an open disc so that it never needs to.
- A modified client can refuse the boss's damage to itself, and a modified client can give itself anything offline
  (saves are the player's). What Option B protects is the SHARED outcome and the RECORD: nobody kills the boss alone
  or faster than the numbers allow, nobody is credited a kill the relay did not see, and no account is credited twice.
- Instanced difficulty dungeons: the next arc.

## 10. The slices

| slice | what | relay? |
|---|---|---|
| **WB1** | `gateLaw.js` (the schedule, the site pick's pure half, the room key's window), the omen's chat lines, the map ring (both maps), the compass marker | no |
| **WB2** | the gate in the exterior: the model and its textures, the membrane and the beacon passes, its states and countdown, the plaque and the banner, the enter door (answered *not yet* until WB3's relay is live) | no |
| **WB3** | the arena place and the relay's boss room: the room key and its window, `gateBrain.js`, the `gate` frame both ways, the hit ledger, the checkpoint, the receipt and its key, the hub's world line; `RELAY_VERSION` once | **yes** |
| **WB4** | the boss on the client: the oversized body and its hit volume, the telegraph pass, the wind-up frames, glow and sounds, the boss bar, the player's side of every attack, cast out and back in | no |
| **WB5** | the spoils: the seeded roll, the spew's physics, the beams, halos and lights, the take and the gather, the save's `gateSpoils`; the account service's claim (acct9) and the cards' line | account only |

Each slice: pins in `test/` (pure law in node; the relay over its fake sockets and a fake clock; the passes' shaders
built in headless Chromium, as the duel wall's), a mutant record in `tools/mutants/`, the Testing manifest, a Port
Ledger section A row (an original online system, not a DFU member), and a row here.
