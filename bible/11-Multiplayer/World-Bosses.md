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

[TIME1, 2026-10-01 (`bible/06-Systems/Online-Time-Arc.md` section 7): this clock is the EVENT clock now, and the
gate keeps it - a gate every two real hours, the same real phases, the relay unchanged. The SKY a player sees runs
at its own rate (a day every real hour since SKY-SLOW), so the game-time column below is the event clock's and no
longer a time the player can read off their sky: it RETIRES from the words. The gate's lines say real local times
alone (`systems/gateOmen.js` `omenTimeLine`, `openTimeLine`, `sealTimeLine`), and the panel always did.
`net/gateLaw.js`'s own word functions stay in the relay's bundle until a relay deploy that happens anyway retires
them. WB12's merge with main (world151) retired them.]

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
window with it). Constants (AUDIT WBX R9: the names as the code has them): `GATE_OMEN_MINUTE` (1020), `GATE_RISE_MINUTE`
(1140), `GATE_OPEN_MINUTE` (1200), `GATE_SEAL_MINUTE` (1320), `GATE_WRATH_MINUTE` (1440), `GATE_EVERY_DAYS` (1 - one a
game day; Mac tunes it).

Offline there is no gate: the schedule is a fact about the shared world, and a solo world keeps its own clock.

### Where - the site

The site is the client's to find and every client finds the same one: a hash of the day over the world's own data,
spawned dungeons' law (`world/spawnedDungeons.js`: "every player rolls the same pixels ... No relay word is needed").

- **The rows**: the game's OWN locations, MAPS.BSA's (GATE-SEEN, HUB1's law): a world-data mod's additions are
  appended past them and stand only where Replace Game Artwork is on, so reading them made the suitable lists - and
  the day's spot - differ between two clients (Roleplay & Realism's fort).
- **The region**: drawn from a SHUFFLE BAG over the regions that hold enough suitable pixels - every province takes
  one gate, in an order each round's rolls shuffle, before any takes a second, and a round never opens on the province
  the last one closed on. So no province holds two gates running and none is left dry for days.
- **The pixel**: `hash32(GATE_SALT, D, 2)` over that region's suitable pixels - LAND (above the water line, not an
  ocean climate: the held map's own water law, over the HEIGHT bytes as well as the climate - the boot spreads the
  land climates two pixels into the sea, AUDIT WB C1), NO LOCATION on it or its eight neighbours, and REACHABLE: 2 to 4
  pixels from the nearest town a traveller can fast-travel to (online a trip arrives at once - OL2 - so the gate is a
  ride from a town, not a march across a province). The town is named in the omen, with its own province (AUDIT WB
  C3: the nearest town can stand across a border).
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
the clock's moments - the relay sends none of them. Nothing is said, and no gate stands, until the relay's clock is
read and the hub has welcomed the player (or eight seconds on the relay's clock alone), and then `OMEN_SETTLE_MS` more,
so the hub's word of a kill lands first; a line is said only past the last one said for its day, so a clock that
steps back never says one twice (AUDIT WB C4):

[TIME1: the three lines that named a game time now say this machine's local time alone - in WB12's words since the
merge, *Dagon's faithful open a breach at 14:32 your time.*, *... The Covenant seals it at 14:42 your time.*, *... It
collapses at 14:52 your time.* The table below is the words as they stood before.]

| when | line |
|---|---|
| 17:00 | *The sky burns over the wilds near Wayrest, in the Wayrest region. An Oblivion Gate opens there at 8 in the evening (14:32).* |
| 19:00 | *An Oblivion Gate has risen near Wayrest. It opens in five minutes.* |
| 20:00 | *The Oblivion Gate near Wayrest stands open. It seals at 10 in the evening (14:42).* |
| 22:00 | *The Oblivion Gate near Wayrest has sealed. It collapses at 00:00 (14:52 your time).* (GATE-COLLAPSE, 2026-09-28: and when it goes) |
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
  frame and fogged thin but never out - the gate is found by looking up. GATE-SEEN (2026-09-26, Mac: "Somepeople
  cant see the gate spawn"): the gate stood on BUILT ground alone, and the streamed grid is the Land View
  Distance's - from the omen's town, 2 to 4 pixels off, a short view built no ground there and nothing stood, the
  beacon included. A gate on a pixel not built yet stands its beacon alone now, on the ground the pixel will be
  built from (the terrain sampler's own kernel over WOODS.WLD, `scenes/world.js` gateGroundAt): no stone, no
  collider, no light, no door, until the pixel is built and it stands whole.
- **Light and sound**: a point light over the threshold (AUDIT WBX W6: it burns in the lanterns' colour - the host's
  lights take one colour - and the embers and the roar this row planned were never built; the gate's fire, its beacon
  and, since WBX8, the sky burning over it are its signs), and the gate's own voice at its rise and collapse.
- **The countdown**: looked at, the World Tooltips plaque names it *Oblivion Gate - opens in 3:12* / *closes in
  8:41*; within 60 m the same words stand as a line at the top of the screen. Sealed for the night (22:00 to the
  wrath) it counts to the collapse - *Sealed* / *Collapses in 6:12*, the banner *Oblivion Gate - sealed, collapses in
  6:12* (GATE-COLLAPSE, 2026-09-28: the sealed hours said nothing, and a gate still standing after "has sealed" read as
  one that would never go).
- **States**, all read off the clock: *rising* (19:00, it climbs out of the ground over 20 s), *sealed*, *open*,
  *sealed after* (22:00: the membrane darkens, the arena's players still inside), *collapsing* (the kill or the
  wrath: it sinks over 10 s and the beacon goes out).
- **Entering**: press activate at the membrane, or walk through it while it is open. A relay that cannot hold a boss
  room (`relaySupportsGate(v)`, the look/park/cast gates' shape) makes the gate say *The gate will not open to you
  yet.* and nothing else.

## 4. The arena - a completely different place (WB3)

**The Burning Court.** A disc of black flagstones 48 m across, cut with a ring of glowing runes 16 m out that the
boss never crosses (so the floor past it is always a way out), standing over a sea of fire under a red sky; jagged spires around its rim with braziers between them; a broken bridge to the south where
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
  colour turn the red of the Deadlands for as long as the context stands. WB6a made them the Deadlands proper - see
  "The Deadlands" below.
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
  the court would load into a place that no longer exists. (AUDIT WBX W6: no such save is ever written - the court
  refuses every save, the exit autosave with it - so there is no load of one to refuse; closing the tab in the court
  keeps nothing of it but the spoils' own crash record.)

**The Deadlands (WB6a, 2026-09-25, Mac: "the transition and the arena needs to be an oblivion masterpiece ... the
outside bounds arent a perfect square, maybe somehow introduce distant skybox design or some other ambient detail.
Whole thing needs to feel alive").** WB3b stood the court on a SQUARE of fire 520 m across under a shell of flat
fog-red; the fog hid the square's middle and never its edge. Both are gone from the court's mesh. `render/deadlands.js`
draws what stands in their place, in the dungeon arm's world pass after the court's solid geometry and before its flats
(PERF2's law: the sea is depth-tested, the sky tested at the far plane and never written, so each burns only where it
shows):

- **The sky**, painted per pixel on one triangle: a churning overcast of smoke lit from below (domain-warped value
  noise on a cloud deck, drifting round a closed loop so the clock can wrap); Oblivion's own sign, the **vortex**, a
  whirl in the clouds over the great tower that turns whole (no shear piles up as the clock runs) and pours inward
  (two layers at a doubling scale, half a cycle apart - the endless zoom), its eye a furnace; the **beam**, a column of
  fire from the tower's crown up into the eye; the **towers**, black Daedric spires with horns from the waist and a
  crown of claws - the great one behind the boss as the players arrive, four lesser round the horizon; three rings of
  **jagged ridges**, far to near, hazier the further, lit at the crest, glowing at the foot, the near range with
  **falls of fire** pouring from notches into glowing pools; and **lightning** in the deck at seeded moments
  (`deadlandsFlash` - the same on every screen).
- **The sea**, a disc of moving fire round the court (crust plates drifting on molten channels, fine cracks glowing
  in the plates, hot rims where melt meets crust, a slow pulse), fogged by the frame's own fog, whose rim becomes
  exactly the sky's horizon - one GLSL function both passes read - so no edge is ever seen: not a square, not a circle.
- **The light**: the court is no dungeon. `courtLighting` gives it a trilight red from above and fire-orange from
  below, and the vortex's fire as a key light from behind the boss (the moon's term, the one directional light a
  dungeon frame leaves dark); the lane's dark rides the trilight as it rides the fog.

Every rate the passes run is a whole number of cycles over DEAD_CLOCK_PERIOD, and the clock is handed wrapped.

**The Deadlands' life (WB6b, 2026-09-25, the same ask - "Whole thing needs to feel alive").** What stands between the
court and the painted horizon, what moves in the air over it, and what it sounds like:

- **The land** (`world/deadlandsLand.js`): twelve islands of the gate's basalt rising out of the fire in a ring 75 to
  235 m out - a jagged mound and a cluster of black spires leaning out of it, the further the larger, so they read
  over the fog and give the eye a middle distance and parallax. The window over the great tower is left open: from
  the arrival nothing of the land crosses the sightline to it. Every island stands on the sea before its rim fades into
  the horizon, and inside the host's far plane from anywhere on the court.
- **The floor's shards**: six broken pieces of the court's own floor hanging over the fire past its rim - flagstones on
  top, the rock torn out under them, spikes hanging like roots - each bobbing and turning slowly, a whole number of
  times a period, clear of the court's spires over the whole of it, out of the tower's window and off the bridge.
- **The air's life** (`drawLife`, after the telegraph in the court's pass): embers rising off the sea from past the
  court's edge (never up through its floor), a few off each brazier, cooling from gold to red as they climb and turning
  with the drift of the air (`deadlandsWind`); ash falling through it all from high over the court to the sea. One
  vertex a mote, every life a whole number a period; depth-tested and never written, the ash laid over, the embers
  added.
- **The strike's light**: a strike the sky draws lights the court the same moment - the trilight's sky flares, and the
  key light swings toward the strike while it outshines the vortex (`courtLighting(flash)`).
- **The air** (`scenes/deadlandsAir.js`): the deep moan of the wind over the fire, breathing on the clock; the sea's roar
  (the fire's own clip pitched down); each brazier burning where it stands; the THUNDER of every strike the sky draws
  (`flashOfSlot` - the same slot, the same quarter), late by its distance at the speed of sound, the thunder near and
  the roll far; far-off roars of the Deadlands' beasts; and fire bursting on the sea below. Each event plays from a
  stand-in in its quarter with its offset from the ear held (`far`), so it keeps its bearing as the player turns. The
  dungeon's own ambience (drips, doors, a bird) is silent in the court.
- **One clock**: the Deadlands keep the relay's (`deadlandsSeconds` in `scenes/world.js` - this page's monotonic clock
  carried onto the relay's), so the sky's churn, a strike, its light, its thunder and the shards' drift are one moment
  on every screen in the court. (WB6a's claim that the lightning was "the same on every screen" held only for the law:
  the hosts handed it the page's own clock. WB6b made it true.)

**The step through (WB6c, 2026-09-25, Mac: "the transition and the arena needs to be an oblivion masterpiece").** The
door had been a cut: the street one frame, the court the next. Now the step is taken in fire (`render/gateVeil.js`, the
law and the shader; `ui/gateVeil.js`, the canvas, its loop and its sounds):

- **Closing**: flame tongues come in from past the screen's corners, spiralling toward the middle; what they have not
  taken reddens; the fire's cast roars, pitched down, over the deep wind. In 1.2 s the screen is all fire - a vortex of
  flame arms pouring into a white-hot eye, embers streaking with them.
- **Shut**: the eye breathes while the place beyond is built, however long that takes (a build that never answers is
  given 20 s, then the veil opens on whatever stands).
- **Opening**: held shut for the new place's first two frames DRAWN (AUDIT WB D5 - the host says each; its programs are built on first sight, and must not eat
  the opening), then the eye widens from the middle and the new place is seen through it, the fire swept off past the
  edges over 1.7 s, to a roll of thunder and the fire's own sound.

Both ways: the gate's door into the court (`stepThroughFire` in the mode machine - the world checked again once the fire
has closed: a door, a death or a load taken in that second and the step is off) and the way home out of it (taken at
the top of the frame after the fire has closed; and no wagon prompt at the way home - the wagon waits in Tamriel). A
court taken from the player by force - come apart at its day's end, online gone, a death cast out - is a FLASH: the fire
at once, then open. One step at a time. The veil is a canvas of its own over the game's (over the world and its HUD,
under the chat, never a pointer): it needs nothing of the world's frame, so it rides no pass of the renderer's. No
WebGL2 for it, and the step is taken unveiled.

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
claim the fastest possible kill is `(BOSS_TTK_S - BUCKET_DEPTH_X) / BUCKET_RATE_X` of full-rate damage - seventy-five
seconds of the whole room at the cap (the bucket's burst, then its rate; the pins measure it at levels 1 to 60).
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
| **Flame Nova** | a ring from 4 m to 30 m - safe at his feet, or far across the floor from him (WB13a: to 16 m - at 30 the far side was past the floor; section 20, T2) | 2.2 s | 40% fire | 2+ |
| **Dagon's Wrath** | the whole arena | 6 s | 999% | the wrath |

(AUDIT WBX F12: WB4's table, as it first shipped - section 12's WBX4 raised every share and set a base beside it, and
WBX5 added the Crushing Leap, the Meteor of Oblivion and the Spokes of Dagon; the numbers live in `net/gateBrain.js`
ATTACKS.) *Hits for* is a share of the struck player's OWN maximum health, resolved by the struck player's own machine against
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
comes with the roar (WBX5: now a sequence - the leap into the court's heart, then the Nova at the second phase and the
Spokes of Dagon twice at the third; section 12). Phase 2 adds Hellfire and the Nova; phase 3 cuts every wind-up by a fifth and casts Hellfire
twice. **Targets**: an aimed attack goes 60% of the time to the player with the most threat - the damage they dealt,
forgetting a tenth of itself a second (`THREAT_DECAY`) - and
40% to a random living one - the tank is whoever hits hardest, and nobody is safe. **Movement**: between attacks he
walks at 3.2 m/s toward his next target until it is in his attack's reach; he never leaves the disc.

### Death, and the way back in

A player killed in the arena is CAST OUT: they stand up outside the gate with half their health (D-ONLINE1's respawn
door with the gate's spot as the landing, not the nearest temple), keep what they dealt, and may step back through
while the gate is open. After it seals, the fallen watch from outside.

### His voice and his music (WB7, 2026-09-25, Mac: "Proper boss audio during the boss fight")

**His body, heard** (`scenes/gateCourt.js`, the cues in `world/gateBoss.js BOSS_CUES`): beside WB4's voice - the bark at
each word, the blow at each landing, the fire's cast and burning, the roar at a phase and the cry at his fall - a STEP
at his feet each BOSS_STRIDE_M of his walk or his charge, a body's fall pitched down to his weight; a GROWL now and then
between his attacks (every 7 to 13 s, never while he strikes); a GRUNT when a share of his health goes (no closer than
HURT_GAP_MS); the ground's SHOCK under a slam, a charge, a nova and the Wrath; THUNDER over his roar as a phase turns;
and his body MEETING THE FLOOR a moment and a half into his fall. Daggerfall's own clips, pitched for his size.

**His music** (`systems/gateScore.js`): Daggerfall has no fight music, so the court's is written, as notes, for the
game's own player and FM bank (`08-Audio/Audio.md` WB7), in D minor:

| song | when | what |
|---|---|---|
| GATEWAR1 - he wakes | phase one | 132 BPM; the villain's turn - D minor to B-flat minor and back, iv, the dominant (WB10a; it was i-VI-iv-V-i-VI-VII-V) - under a low brass pedal hammered 3-3-2 with a sigh at each bar's end, the timpani and a kit of low drums in half time; brass stabs in open fifths, then the Warden's theme on the brass, then the choir under it; a bell tolled low at each section |
| GATEWAR2 - the ward breaks | phase two | 138 BPM; the choir from the first bar, the kit in full time and rolling into every fourth bar, the theme dotted and restless, low on the brass |
| GATEWAR3 - his wrath | phase three, and the last minute before the Wrath at any phase | 150 BPM; the Neapolitan Eb against D, the kick on every beat and the toms on every offbeat, crashes every other bar, the tritone tolled low, the theme over it all and doubled two octaves down |
| GATEFELL - he falls | his fall, for 12.5 s from when it began on this screen (AUDIT WB D2: a kill heard late plays it whole), then faded out | a timpani roll into D major - fanfare, choir, bells - then quiet: the court is the Deadlands' air alone |

Nothing plays over the Wrath once it has landed. The court holds the music while it stands and lets it go the frame it
is gone; a music pack can replace any of the four by name. Each is PRESSED (WB10a, section 15): a compressor, its own
drive and a soft ceiling a decibel under the clip at the highest MusicVolume.

## 6. The fall - the relay stamps the kill (WB3)

At zero the room stamps the kill once: `{k:'fell', at, top}` to everyone inside, the hub's world line, and to each
account that EARNED it a receipt. Earned: dealt at least `RECEIPT_SHARE` (2%) of the health that account's own claim
brought, or stood alive in the arena for half the fight - so a player who spent the fight healing others still earns
it. One receipt per account per day, whatever tabs it holds.

**The receipt** - the relay's first signature. Today the relay holds no secret at all (ACC1: it verifies, the account
service signs). A kill the account service will honour has to be signed by the one party that saw it, so the relay
gets ONE key, and it can sign ONE thing (RAID3, 2026-09-27, made it two: a town raid's receipt, `w1`, in its own shape -
`03-World/Raiding-Parties.md`; the version inside the signed bytes keeps the two apart):

```
r1.<base64url({ d, b, s, c, x, i, e })>.<base64url(Ed25519 signature)>
    d the day   b the boss kind   s the account (the token's sub)   c the loot seed (32 bits, the relay's CSPRNG)
    x how the account earned it (dealt / stood; WB12d: rite - the faithful's rite broken, no part in the fight)
    l the level the fight admitted the account at (AUDIT WBX S2)   r 1 when it also broke the rite (WB12d)
    i issued   e expires (i + 7 days)
```

`net/gateReceipt.js` holds the law beside `identityToken.js`'s and mirrors its ladder (the version is the
algorithm and is read first; signature first, content second; refuse, never repair). **A receipt can never pass as
an identity or an order, nor they as it**: its prefix is `r1`, which the identity verifier refuses before a byte is
parsed, and it is signed by a different key. The relay's key is a Worker secret (`GATE_SIGNING_KEY`, PKCS8, sign
only, non-extractable - `server-account/src/signing.js`'s shape); the account service holds its public half
(`GATE_PUBLIC_KEY`). The account deploy mints both halves in one run and proves the service holds its half
(GATE-KEYS); nothing checks the relay's half against it after (AUDIT WB A5 - an earlier line here said the deploy did): a
service whose half is not the relay's refuses every receipt at the `signature` rung, and the device keeps such a
receipt for its week, so a mended pair still counts it. A relay with no key still runs the fight and the loot - the
receipt is then unsigned and the account service declines it, and nothing else changes.

**The account service** (acct11 - acct10 on its branch): migration 0014 (0009 on its branch) `gate_kills (day, account, boss, earned, at)`, primary key
`(day, account)`, so a receipt counts once whatever happens to it. `POST /v1/gate/claim { receipt }` behind a session
whose account is the receipt's `s`. `/v1/account` carries the count, and the main menu's account card and the Inspect
card say *Gates closed: 3*. Guests fight and loot; the record is registered accounts', as the duel's is (AUDIT DUEL1
A1).

## 7. The spoils - the boss spews them (WB5)

Per player, and seen by that player alone. The seed is the receipt's `c` (and, AUDIT WBX S2, its level the fight's `l`), so a reload never rolls again and every
player's roll is its own.

- **The roll**: gold (`250 * level`, varied by the seed) and three pieces - one Rare or better, two Magic or better
  - minted with the game's own makers (`createRandomWeapon`, `createRandomArmor`, jewellery) on
  `rolls = seededRng(c)` (`systems/wind.js`), then laddered through Loot Rarity's `applyRarity` from a source of the
  gate's own kind: the boss's own source (`boss: true` - lootRarity.js SOURCE_MULT.boss, 2.5; AUDIT WBX S7: no `gate`
  kind was ever made), a Legendary chance of 10%, the ladder's own caps otherwise.
  And a **Sigil Stone**: the gate's trophy - its own item row, a gem by group but no ingredient, so it never stacks away
  its name - worth a small fortune, one a kill (WB12a named it the Deadlands Ember; WB12d pays one more to each who
  broke the faithful's rite - section 19 D).
- **The spew**: at the kill the boss's body bursts and each piece leaves his chest on its own arc - out and up toward
  the player's side of him, the seed choosing each angle and speed - and falls, bounces and comes to rest with the
  thrown torch's own physics (`droppedTorches.js stepProjectile`: the fixed 0.02 s step, gravity, the collider's ray,
  the bounce at 0.5, rest under a fifth of the throw's speed), one at a time over a second, each with a sound as it
  lands.
- **The glow** (WB5's; WBX3 replaced the beam and the halo with each piece's own picture and a thin line of its tier's
  colour out of its top - section 12): each piece stood in a beam of its tier's colour (Loot Rarity's own: Magic #6f9ee8, Rare #e4c34f,
  Legendary #e07a2e, Artifact #b57bee), rising from a halo on the ground - the first place in the port a rarity is
  drawn in the WORLD - and Rare and better carry a light of that colour; a Legendary's beam is taller and pulses. The
  Rare chime (`playRareDrop`) plays when a Rare or better comes to rest.
- **The take**: activate a piece, or walk over it, and it goes into the pack through `addItem` (gold through
  `addGoldPieces`), the name said (AUDIT WBX S7: walked over, a moment after it rests - no press, and the words plain). Leaving the arena with pieces still on the floor GATHERS them into
  the pack - a boss's reward is never lost to a door, a disconnect or a death. The spoils ride a record on the device
  from the burst until a save holds them (the court refuses the save - WB5a), so a crash between the spew and the next
  save loses nothing either - one record a day and character, a list (AUDIT WB A7).
- **No floor** (AUDIT WB A2): a receipt that comes while the player is not in its court - cast out before the kill,
  gone from the game, handed it by the hub's next hello - is its spoils straight into the pack, said once, kept on the
  same record. Once a receipt (its day and account) whichever door gives them.

## 8. The wire

One frame type, `gate`, with a kind. Everything else the arena needs - the poses, the chat, the looks - is the room's
ordinary law.

| frame | way | when |
|---|---|---|
| `{t:'gate', k:'in', lv}` | client → room | once, on entering |
| `{t:'gate', k:'hit', q, d, r}` | client → room | a blow on the boss |
| `{t:'gate', k:'st', ...}` | room → client | on entering, and every 5 s: the whole state (day, boss, phase, health, where he stands, the attack in flight, the wrath's time) |
| `{t:'gate', k:'mv', x, z, tx, tz, v, at}` | room → all | he walks from here toward there from `at` |
| `{t:'gate', k:'atk', i, a, at, x, z, yw, tg}` | room → all | an attack's wind-up: which, when it lands (the relay's clock), where, its facing, its targets |
| `{t:'gate', k:'hp', h, m}` | room → all | health, at most 4 a second |
| `{t:'gate', k:'ph', n, until}` | room → all | a phase, and its shield |
| `{t:'gate', k:'fell', at, top}` | room → all | the kill |
| `{t:'gate', k:'rcpt', r}` | room → one account's sockets | the receipt |
| `{t:'gate', k:'wrath', at}` | room → all | the wrath |
| `{t:'gate', k:'no', m}` | room → one | an `in` refused, in words (GATE_NO_WORDS: sealed, closing, the court full) |
| `{t:'gate', k:'fell', at, top, n, d}` / `rcpt` | hub → everyone online / one account | the kill said to the world, and a fighter's receipt outside the court (WB3a) |

Every time is the RELAY's clock; the client reads it through the welcome's offset (WORLD5). A room key of the arena's
own, `gate:<day>`, which the relay admits only inside that day's window (refused *the gate is closed* outside it) -
a client cannot mint a boss the clock did not raise. Each day's arena is a fresh object, so nothing carries over
and nothing needs sweeping but the object's own short storage (its fight, checkpointed every two seconds so an
eviction loses two seconds, not the fight).

`RELAY_VERSION` bumps once for the lot; `relaySupportsGate(v)` gates the client, as the look, park and cast frames'
gates do. The bump redeploys the relay and drops every connected player once (RELAY-H1's F1) - so the relay half
ships in ONE slice.

## 9. What it does not do (v1), said so

- No adds. Every add would need an owner to run it; the relay could own simple ones as it owns the boss - later. (WB11:
  later came - under the Legion-Lord trial the relay runs his host, section 17; every other fight has none.)
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
| **WB4** | the boss on the client: the oversized body and its hit volume, the telegraph pass, the wind-up frames, glow and sounds, the boss bar, the player's side of every attack, cast out and back in - shipped in two: **WB4a** (he fights: the body, the telegraphs, the glow and voice, the bar, every blow he lands) and **WB4b** (he is fought: the swing, the shaft and the spell on his body) | no |
| **WB5** | the spoils: the seeded roll, the spew's physics, the beams, halos and lights, the take and the gather, the device's record until a save holds them; the account service's claim (acct11) and the cards' line | account only |
| **WB6** | the Deadlands made alive (Mac: "an oblivion masterpiece"): **WB6a** the sky and the sea and the court's own light; **WB6b** the life - islands and spires out in the fire, the floor's floating shards, embers and ash, the strike's light and its thunder, the air's sound, one clock for every screen; **WB6c** the gate's transition, a vortex of fire in and out | no |
| **WB7** | his voice and his music (Mac: "Proper boss audio during the boss fight"): the body's steps, growls, grunts, the ground's shock, thunder and his fall to the floor; the court's own score, written as notes - three war songs by his phase and a fanfare at his fall | no |

Each slice: pins in `test/` (pure law in node; the relay over its fake sockets and a fake clock; the passes' shaders
built in headless Chromium, as the duel wall's), a mutant record in `tools/mutants/`, the Testing manifest, a Port
Ledger section A row (an original online system, not a DFU member), and a row here.

## 11. The audit (AUDIT WB, 2026-09-25, Mac: "A proper audit on everything")

Four readers went over the whole feature - the gate in the world, the court on the client, the relay's room, the spoils
and the claims, the look and the sound - each finding checked against the code before it was fixed. The world's half:

| # | what was wrong | now |
|---|---|---|
| C1 | the site's scan read the CLIMATE alone for water, and the boot spreads land climates two pixels into the sea (`dilateCoastalClimate`), so a gate could stand in the water; High Rock's sea-coast politic 64 counted as a province | the scan reads the height bytes too, by the held map's own law (`gateSeaPixel` = `isWaterPixel`); 64 claims nothing |
| C2 | a fogged membrane faded its colour to black under an alpha that still hid the fogged world: a black hole in a fog bank | premultiplied, the fog colour stands in for the fire's |
| C3 | the nearest town was named with the GATE's province, and it can stand across a border | the town's own province |
| C4 | the omen spoke on the machine's clock before the relay's was read, and before the hub's word of a kill; a clock stepping back said lines again | ready on the relay's clock and the hub's welcome, a settle after, each line once past the last |
| C5 | the countdown stood over the step's fire, and froze over a held frame | hidden under the veil, cleared over a held frame |
| C6 | the vortex's angle was the clock times a rate that eased with the open: opening spun it through tens of turns in a second | the pool accumulates the spin at the rate; the shader turns by it |
| C7 | the stone's matrix, the fire's box and empty lists made every frame, the pass's arguments built with no gate; the site's one scan (~40-75 ms) in the frame that first asked | made once or on change; the scan in slices, in the browser's idle time once the relay's clock is read |

The court's half, on the client:

| # | what was wrong | now |
|---|---|---|
| B1 | a player dead in the court when it came apart (its day over, online gone) was landed before the gate at NO health - the next frame's death watcher killed them again in Tamriel and sent them to a temple | cast out alive by the death's own door (the heal first, then before the gate) |
| B2 | a way home asked through the fire was walked the frame after it closed even by a player killed while it burned | a pending exit is dropped for the dead - the death resolves it (the court's casts out before the gate) |
| B3 | a player killed in the exterior while the gate's fire closed stepped into the court dead | the door refuses the dead |
| B4 | the court knew an attack by its NUMBER, and a room woken from its checkpoint numbers its attacks from there again - the next one passed unjudged and unheard | an attack is its number and its moment |
| B5 | the door was asked once, before the fire: a gate that sealed (or whose master fell, or whose relay went) while it burned let the player into an empty court; a refused `in` and a court socket closed for good left them there, the Warden frozen | the door asked again after the fire; a refusal and a dead relay take the player out before the gate, in the relay's own words |
| B6 | after the Wrath the Warden was still a body blows met, and blows were sent the relay would never judge | no body and no blow after it |
| B7 | a player who came to the court after he fell heard his death cry then, minutes late | the cry only within `FALL_CRY_LATE_MS` of his fall, as the thud has its own |

The relay's half (RELAY_VERSION world113 - world111 on its branch, renumbered at the merge past main's EVENT1, RENOWN1 and PARTY-TRAVEL):

| # | what was wrong | now |
|---|---|---|
| A1 | a room's seat was any open socket's: sockets that never said hello filled a court's 256 seats for as long as they stood open, and every player after them was refused `room full`; one account could hold many seats of the court; and the fight counted every account that ever joined, so 256 who came and went filled it for its day | a full room first closes the sockets silent past `HELLO_WAIT_MS` (busy - a real client retries); one seat an account in a court; a full fight frees the seat of one who left without a blow or a moment stood (`freeSeat`), their share leaving the health at his fraction |
| A3 | every `in` - and every welcome says one - forced a storage write | only a newcomer's is written at once |
| A4 | the hub handed a receipt only to a fighter connected at the moment of the kill; one away heard of it only by walking back into the court while it held | the hub keeps each account's receipt for its life and hands it to that account's next hello |
| A8 | a newcomer to a fight already bled came with a full damage bucket - a string of late joiners could each spend one at once | an empty bucket after the first blow |
| A10 | the kill was fanned before it was written: an eviction between them told the court of a kill storage never kept (the wake resumed a living Warden) and re-minted every receipt on new seeds; the hub was told once, and a failed tell was never retried | minted, written, then said; the hub told until it answers (`told`, a beat every `GATE_TELL_RETRY_MS`) |
| C7 | (the client's) a day's gate times made again every frame | made once and frozen (`net/gateLaw.js` is in the relay's bundle, so it rides this version) |

The spoils and the claims:

| # | what was wrong | now |
|---|---|---|
| A2 | a fighter outside the court at the kill (cast out, gone) had a receipt and no spoils: the court's burst was the only door | a receipt that comes outside its court grants its spoils straight into the pack (`grant`) |
| A5 | the claim route dropped the verifier's rung, and the device let go of every refused receipt - a service whose public half was not the relay's pair threw away a week of everyone's gates; and this page claimed a deploy check of the pair that does not exist | the route says the rung; `signature`, `verify-threw`, `future` and `clock` are kept for the week (`GATE_CLAIM_MENDABLE`); the claim corrected |
| A6 | a storage that refused writes (a full quota, a private window) lost the receipts and the spoils' records silently | the session's memory keeps what the storage would not, one store for every reader |
| A7 | the spoils' crash record was one slot: a second burst before a save wrote over the first | a list, one a day and character |
| A9 | the spent day and the claims' queue were the device's: a second account on the device had its spoils refused and its receipts offered under the wrong sign-in (and let go as `not-yours`) | spent by day and account; receipts kept one a day and account, only the signed-in account's offered, another's kept unasked |

The look and the sound:

| # | what was wrong | now |
|---|---|---|
| D2 | the fanfare was stopped 12.5 s after his fall by the relay's clock: a kill heard late cut it short, and the quiet after it was a cut | timed from when it began here (`createCourtScore`), then faded (`MusicService.fadeOut`) |
| D3 | his grunt wanted a share of his health gone in ONE word of it, and the relay says his health in small steps: in a big fight he never grunted | the loss counted since his last grunt |
| D4 | the song player rewinds a second after a song's end (DFU's replay): the war songs fell silent a second at every loop | a song written as whole bars is `seamless` - the next pass begins on the bar line, to the tick |
| D5 | the veil's hold counted its own ticks, and a frame cap or a held frame makes a tick no frame of the new place | the host says each frame it draws (`frameDrawn`); the veil is built ahead in idle time the first frame a gate stands (`warm`) |
| D6 | a flash showed one frame of what it covers before the fire | drawn in the call itself |
| D7 | the Deadlands' clock was timeOrigin + now(): a sleep stops the page's clock and not the wall's, and it drifted from every other screen | carried on the page's clock from an anchor on the wall and the relay's offset, taken again when they part by a second (`anchoredClock`) |
| D8 | the falls' grain was read at the clock's radians, which never met themselves at the clock's wrap: the falls jumped | two layers a slide apart, each faded as it wraps, a whole number of slides a period |
| D9 | the sky's three ridges and the towers were worked out for every pixel, the zenith's too | skipped above `RIDGES_TOP` (0.42 rad) |
| D10 | the court's frame made its lists, its constant places, its braziers' lights, its fog and its light arrays anew | made once, or refilled |

## 12. After the first fights (WBX, 2026-09-26)

Mac, after the gate's first live fights: *"So we implemented the world bosses, and it is amazing. But I definitely want to
fix some bugs and make some detailed changes"* - five of his own:

> *1. None of the 3D geometry that was built including the oblivion interior/exterior gate are visible 2. The boss muusic
> phase doesn't play 3. Loot drops should show their sprite and have a small colored loot line that extrudes from the
> sprite itself 4. The boss phases need to be more defined and more detailed mechanics. 5. The oblivion portal on the
> inside should spawn inside at the end of the fight. Currently there's no way to leave after ending*

and a player's seven (Swololo on Discord, "Oblivion Gate Boss Difficulty"): the damage too low ("should be hp % based
maybe + base damage"), regeneration undoing it ("maybe disable regen in oblivion"), the boss hard to place and to read
("maybe he should have a circle under him"), weapons broken in the fight, loot "not distributed, was instantly pillaged
by others", soul trap dead - and "maybe it should be 1.5 times faster", which Mac turned down: *"I dont think making
mechanics faster is the play."* Nothing here is faster than it was.

| # | what | now |
|---|---|---|
| WBX1 | **none of the made geometry drew.** The gate's stone, the court (floor, rune ring, spires, braziers, the bridge and its way home) and the Deadlands' islands and shards were built with a `Uint16Array` of indices (under 65,536 vertices each), and every draw of a bundle reads `gl.UNSIGNED_INT` - half the bytes the draw asked for, so WebGL refused each one (`INVALID_OPERATION: Insufficient buffer size`) and nothing was there; the colliders, which read numbers and not bytes, stood the floor where it should be. Every probe had drawn the stone with its own stand-in program, never the renderer's | `renderer.createMesh` widens any element array to 32 bits once, at upload (the one index type), and the three builders hand 32 bits in. Seen through the real renderer headless: the stone, the court and the land (0 pixels before, the whole silhouette after) |
| WBX2 | **no way home after the fight** (the bridge's membrane was part of the invisible court) | once his body is gone (`PORTAL_AFTER_MS` into his fall) the gate's own fire - its arch and its beacon, without the stone, so no plinth rises over the spoils - stands where he fell and rises over `PORTAL_RISE_MS`, *The way home tears open where he fell.*; pressing it (its door is laid into the court's exit doors) is the way home - `gateWayHome`, the one door the bridge's membrane takes too. SS3 (2026-09-27): it is never WALKED through - it stands where the spoils land, and a player going for them walked out of the court |
| WBX3 | **the loot**: every piece lay as the same treasure heap in a beam 8 m tall; and "pillaged by others" - the spoils were always the player's alone, but a fighter standing where they fell had walked over them the second they landed | each item stands as its own picture on the floor - the pack's (`ui/itemIconColor32.js`, `textureCanvas.js`'s own door with the item's dye), uploaded under `SPOILS_ICON_ARCHIVE` - and its tier's colour leaves the top of that sprite as a thin line (`render/spoilsGlow.js`: 0.7-2.3 m by tier, never thinner than two pixels on the screen, brightest where it leaves the sprite); gold keeps its pile. A piece is taken only `SPOILS_TAKE_AFTER_MS` after it rests, and the burst says *...spoils spill across the floor - yours alone to take.* |
| WBX4 | **his damage and his mark** | every attack takes a larger share of the struck player's own health and `base` points beside it (Cleave 35% + 8, Slam 40% + 10, Charge 30% + 8, Hellfire 30% + 6, Nova 45% + 10, Leap 35% + 8, Meteor 50% + 12, Spokes 40% + 10) - two of his blade's or his weight's landings leave a fighter of 150 health or more low and a third ends them, and the Flame Nova and the Meteor, near half each, end anyone in two who has not healed between; and **his mark** on the floor, always: a ring about his feet a little wider than his body and a chevron before it where he faces (`render/gateTelegraph.js` kind 7), his ember, gold while the ward holds |
| WBX5 | **the phases** | each phase has a name and a shape - **The Warden** (blade and weight: Cleave, Ground Slam, Charge), **The Burning Court** (fire and reach: Hellfire and the new **Meteor of Oblivion** leave the floor BURNING - pools that bite every second a player stays in them, the first bite a second after stepping in - the Flame Nova, and the **Crushing Leap** at whoever stands more than 10 m off), **Dagon's Champion** (the **Spokes of Dagon**: four lanes of fire from his feet). A phase's turn is a sequence: he leaps into the court's heart under his ward, then casts its signature - the Nova as the ward breaks; the spokes and at once the four between them as he becomes Dagon's Champion. The bar names the phase; the turn is said over the screen. The relay's brain (`PHASE_TURN`, three new attack ids inside the `a` bound the wire always had) - world116 |
| WBX6 | **regeneration, and broken weapons** | the court keeps no regeneration (`systems/courtRules.js`, set by the world host each frame the court stands: the Regenerate effect's round, a RegensHealth enchantment's and a career's Regenerate Health heal nothing; a Heal, a potion or a friend's cast land as ever - nothing is wiped). A blow on him wears no gear (`combat/formulas.js damageEquipment` spares the stand-in's `spareGear` - a fight of hundreds of blows was breaking weapons) |
| WBX7 | **soul trap**: a Soul Trap met only a spell with a harmful family, and his stand-in forgets every lasting effect | a Soul Trap reaches him; the dungeon context lays it through `applySpell` (its rounds, its chance frozen at the cast, his save, *Trap active.*) and the court keeps it on the fight's clock (a magic round a game minute - five seconds online; a recast adds rounds and keeps its chance); at his fall a trap still running is rolled by the port's own `attemptSoulTrap` - his soul into an empty gem, *Trapped soul.* / *Trap failed.* / *You have no empty soul traps!* |

What did not change: the relay's caps (the fastest kill is still 75 s of the whole room at the cap), who earns a
receipt, the telegraph law (the ground shows exactly what lands), every wind-up (phase three's fifth is as it was).

Mac's second - *"The boss muusic phase doesn't play"* - **did not reproduce, and nothing was changed for it.** Played
whole on 2026-09-26 in a real browser against a local relay (one fighter, from the step into the court to the portal
home, `music.current` read every tick), the court held the music from its first frame: GATEWAR1 through the Warden,
GATEWAR2 from the Burning Court's turn, GATEWAR3 from Dagon's Champion's, GATEFELL at his fall, and the overworld's own
song after the step home. Not tried: a player's own music settings or a replacement pack, and a fight joined late. If
it recurs, the first questions are which phase, and whether any music played at all. **The likeliest answer came the
same day (AUDIT WBX, below): the score was too quiet to hear.** Measured through the game's own player at the default
MusicVolume, GATEWAR1 opened at -36 dBFS - about 7 dB under the dungeon song it faded out, and under a brazier a metre
and a half off. WBX9 answers it.

### After the audit: the overworld's sky, a louder score (WBX8-WBX9, 2026-09-26)

Mac, the next message: *"1. Improve the sky effect to be more like the /event dread command 2. The music needs to be
louder and more intense 3. Do a comprehensive audit on everything so far"* - and of the first: *"When I say sky effect,
I mean daggerfall, not the inside."*

| # | what | now |
|---|---|---|
| WBX8 | **the sky over a gate** - the omen has always said *The sky burns over the wilds near ...*, and the overworld's sky never did: the beacon was the gate's only mark on it | the live event's dread (`world/dreadSky.js` - the crimson grade on the sky, its fog and the land's light, the storm's deck) over the gate's site, by its life (`systems/gateOmen.js gateSkyPhaseWeight`: the omen's line kindles it at once, it deepens to the rise and the opening, burns whole while the gate stands open or sealed, and clears as the gate collapses; never a step) and by the eye's distance (`gateSkyNear`: whole within 4.1 km - the town it is reached from stands under it - thinning to nothing at 12 km); the world host takes the greater of the event's weight and the gate's. And **the red storm gathers over the gate** - the event's strikes' law on a schedule of its own (`GATE_STORM_RING`: a salt, strikes from 120 m to 4.5 km round the site, most of them at the gate itself), each thunder from its distance to the ear, so the lightning shows where the gate stands. The court (the inside) keeps the Deadlands' sky. Seen in the real game online: the sky graded crimson whole and at the omen's depth, and the gate's red strikes firing |
| WBX9 | **the score, louder and more intense** | louder: every voice's level raised and each song played at its own level over the player's (`systems/songPlayer.js` `song.level` - one gain between the channels and the fader, 1 for every song MIDI.BSA holds; `SCORE_LEVEL` 1.42 / 1.6 / 1.64 / 1.7) - measured through the real player the war now reads -25.6 / -22.1 / -21.5 dBFS and the fanfare -22.9 (they read -34.5 / -29.7 / -28.4 / -30.9; the day songs -28.7, the dungeon's -31.7 to -41), every peak under -6 dBFS so the highest MusicVolume never clips (`tools/gateScoreProbe.mjs`, 15 checks). More intense: nothing waits - the strings, the brass stabs and the whole kit from the first bar, the theme from the ninth; the ostinato driving in sixteenths as the phases turn (a bar's last beat, then every other bar's second half, then every bar whole); the orchestra hit and the timpani on more beats, the kit's fills every fourth bar; the third song's choir chanting on every beat; the fanfare's call and answer doubled by the strings. The key, the tempos, the themes and the law are as they were |

### AUDIT WBX (2026-09-26, Mac: "Do a comprehensive audit on everything so far")

Four lanes read the whole of it - the relay's fight and wire, the court on the client, the spoils and receipts, the
gate in the world with its transitions and music - each finding checked against the code end to end and most shown by
a script. What they found, and what became of it:

| # | found | now |
|---|---|---|
| R1 | **a share stayed after its fighter left**: twenty throwaway accounts that said `in` and went left the Warden unkillable before the Wrath for the ten who stayed (the only release was a full court's idle seat) | a fighter absent `ABSENT_RETIRE_MS` (30 s) takes its share out of his health at the fraction he stands at, and brings it back at the fraction he stands at when it returns; its seat, blows and claim are kept (`retireShare`/`restoreShare`) |
| R2 | one beat stood, or a blow of 1e-300, held a seat for the day - 256 accounts held the court | a seat is kept by a blow worth RECEIPT_SHARE of its share, or `SEAT_KEEP_MS` (30 s) stood |
| R3 | a fighter against the court's rim stood 6.2 m past his body - out of the cleave's 6, inside the charge's 8 - and he struck nothing all phase one | the cleave's range is 7 (its cone of 9 always reached) |
| R4 | "stood half the fight" was half the wall's time since the first `in`, a court nobody stood in counted | half of `liveMs`, the time a living fighter stood in the court |
| R5 | the bar froze through the Wrath's six-second wind-up | the wind-up says the health |
| R6 | a blow never woke the beat, and a blow after midnight with no beat to say the Wrath landed | a blow arms the beat as an `in` does; a blow at or after the Wrath's hour lands nothing |
| R7 | a tab loaded before a deploy judged every new attack a miss - immune to the leap, the meteor, the spokes | `in` carries the brain's law (`bv`, `GATE_BRAIN_V`); below `GATE_BRAIN_MIN` it is refused in words the old client knows |
| R8 | the hub kept every account's receipt until that account's own next hello - for ever, for one that never came back | the hub's sweep forgets an expired one |
| S1 | **a receipt's spoils given again on another device**: the hub handed its kept receipt to every hello for a week, and only the device that spent it knew | a receipt spent is said to the hub (`spent`, `relaySupportsGateSpent` - world116), which forgets its copy; said again whenever a spent one is offered, and said only once the spoils are safe on the device (their record held, or a save holding them) |
| S2 | the spoils rolled at the receiving character's level - a level-1 alt earned the receipt cheaply, the main collected at 50 | the receipt carries the level the fight admitted its account at (`l`); the spoils roll at `spoilsLevel` - the player's, never past it |
| S3 | the crash record was cleared by comparing two clocks - one set ahead re-gave the pieces at every boot, one set behind dropped a record no save held | a record of this build (`SPOILS_RECORD_V`, an `id`) clears when a save of its character LANDS after its pieces entered the pack (`systems/saveSlots.js onSlotSaved` → the pool's `saved`); an older build's keeps the old rule |
| S4 | two tabs of one account: the tab in town gave the spoils before the fighter's own burst on the floor, and two tabs could both give them | the hub hands a receipt to one socket an account (its newest) and not to a fighter in the court at the kill (the court's `here`); the grant outside a court runs under the Web Locks API |
| S5 | the spent mark was written before the record - a full store kept the mark and lost the record, and a crash lost the spoils | the record first; a record the store will not hold leaves the mark in memory alone, and the hub is told once a save holds the pieces |
| S6 | the floor drew each item for a Breton man | the pack's picture for its wearer (`itemIconColor32(item, { identity })`) |
| F1 | **Mehrunes' Razor on him** read his stand-in's placeholder health (1e9): the Razor broke and enchantment wear took it from the pack, and the blow was one the wire refused | the Razor's whole-health blow passes his stand-in by |
| F2 | every Strikes payload still wore the weapon on him - a Cast When Strikes blade 10 a blow, the Mace of Molag Bal the blow's damage - and a Cast When Strikes spell went nowhere | no Strikes payload bills its weapon for a blow on him (the stand-in's `spareGear`), and a Cast When Strikes spell lands on him by his own spell door (`bossSpell`) |
| F3 | at his fall the fold kept where his last word BEGAN - the body, the spoils and the portal home stood up to 30 m back at a leap's or a charge's start | the fold freezes him where he fell (the court's own `bossPlace` at the kill), and the relay settles his place by the beat's rule at the killing blow (`settleAt`) |
| F4 | a walk's word kept a finished charge in the state, so he was drawn frozen at its lane's end while he walked | the walk ends the attack before it |
| F5 | a Soul Trap at range or bursting flew through him (the missile's word was a duel spell's) | a missile may meet him when its spell is a duel's or a trap |
| F6 | a recast was rolled as a new trap against his save, and the trap was forgotten at a cast-out and a walk back in | a trap running on him is his incumbent for the recast (it stacks, no save), and it outlives a walk out and back the same day, rolled once |
| F7 | the charge struck 1.8 m from its line and was drawn at 1.75 | drawn, and judged by the static law, as it strikes |
| F8 | a frame out of the burning ground each second was never bitten | a step out shorter than a tick keeps the fire's count |
| F9 | the leap's flight played seven steps on the stone | no step while he is in the air |
| F10 | a tab asleep through midnight and the collapse was carried out alive, the Wrath never landing | the court's frame runs once first, and the Wrath lands |
| W1 | **a player standing where a horn's root rose was sealed in the stone** as it stood whole (the collider stands in one frame), out of reach of the fire, with nothing to /unstuck them | the stone standing whole under a player in a root sets them down before the gate (`inGateRoot`, the host's landing) |
| W2 | the court's songs, made in code, played nothing where MIDI.BSA did not load | a made song needs no archive |
| W3 | the fanfare's time was counted from the word of the fall, 1.56 s before its first note, and its last hit was faded under | counted from its own first note (`SCORE_STING_LEAD_MS`) |
| W4 | every online frame read and parsed the account session (a file read on the desktop) | at most once a second, and when a retry is due |
| W6 | the fire's box made every frame for the hover; this page's claims of a red light, embers and a roar at the gate, and of a refused court save | the box made when the gate moves; the page says what is there |

**Not done, and why**: F11 - the court's frame still builds its telegraph shapes, its pool shapes, its glow and its bar
model a frame (5-8 KB of garbage, bounded; the lists and the mark were D10's); W5 - a gate's spot can stand in the
sea's beach band (one day in three thousand on the ocean clamp itself): the site's scan reads the pixel's height byte,
and sampling the terrain at the spot needs the terrain sampler's kernel over the scan - a change to the site law every
client must agree on, for another slice; the gate's point light in the lanterns' colour (the host's lights take one
colour). The account service still counts a gate once a (day, account) row - untouched.

### AUDIT WBX2 (2026-09-26, Mac: "Audit this before we merge")

The branch read whole against main - both WBX commits, the relay, its wire and the receipts - and each finding checked
in the code before anything was changed. Eight were real; two were not.

| # | found | now |
|---|---|---|
| M1 | **a crash's spoils given again at every boot, offline**: the pool that keeps the crash's records (and clears one when a save of its character lands - AUDIT WBX S3) was made only online, and the crash's door hands a record back online or not - offline no save could ever clear it | the pool is made online or not; every save that lands is told to it, and every record the door hands back is adopted by it |
| M2 | **a Warden every fighter had left stood up whole**: with every share retired (all away past `ABSENT_RETIRE_MS` while some socket kept the beat) his health was 0 of 0, and the first back - or a newcomer, with a full bucket - brought him back at 100% | the fraction he stood at as the last share left is kept (`idle`, `standsAt`); a return or a newcomer finds him there, and a newcomer to a bled fight brings an empty bucket |
| M3 | **a `spent` that came before the kill's own word was lost** (a tell the hub missed is told again `GATE_TELL_RETRY_MS` later): the copy stored after it went to the account's every other device | the word is kept in the copy's place for a receipt's life - a hello is handed nothing, and the kill's word (or a tell said twice) stores no copy over it and hands none |
| M4 | **the kept copy went to a court fighter's other tab or device** before their own floor spent it - S4 covered the hub's word at the kill, not the next hello | a court fighter's copy is held from their hellos `GATE_HERE_HOLD_MS` (2 min): their floor spends it and says so within a second or two; past it, it is handed as any other (a court tab that died before its burst has them back) |
| M5 | **a kill in the air stood him in two places**: every screen flew him over the leap's last `LEAP_AIR_MS`, the relay held him at its start until it landed - the body, the spoils and the portal home stood up to half a leap apart for a late joiner, and a blow on him in the air was judged from where he had left | one law, `leapAt` (net/gateBrain.js): the beat, the kill's `settleAt` and every screen's `bossPlace` fly him alike |
| M6 | an older build's spent mark for any account, met by another account's receipt, was said spent to the hub - which forgot that account's copy everywhere | only this account's own spend is said again (`spentBy`); the old mark still refuses the spoils here. No player's store holds such a mark (WB5a and AUDIT WB A9 reached main in one merge) - closed all the same |
| M7 | the horn-root check's `first` was read after the collider was cleared - always true | the check runs at every stand, as it did, and says so: its first, and one where the gate has moved |
| M8 | the beat carried its own copy of the kill's rule for the charge and the leap - the two had already parted (a guard on the charge's end in one) | the beat asks `settleAt` |
| M9 | the hub's sweep read its receipt cursor in a second storage read | one read for the three cursors |
| M10 | the court's frame runs twice on the collapse frame | **not a fault**: the first runs the Wrath, then the court is left and the second is the court putting itself away; where the link is not left (a death's door) it runs at the same `t`, where every step is gated by time - not changed |

RELAY_VERSION world116 (never deployed; its law now holds these). It was world114 on this branch: at the merge with main
(2026-09-26) main's Enhanced Plus patch and GUILD1c had taken world114 and world115, so the gate's law - WBX5, AUDIT WBX
and AUDIT WBX2 in one deploy - is world116, and `GATE_SPENT_RELAY_MIN` is 116 with it (neither of main's relays hears
`spent`, and a frame a relay does not know closes the socket).

### GATE-RELOAD (2026-09-26, the first gate after the deploy)

volo on Discord, three minutes after day 518's gate opened (22:32 UTC): *"the oblivion gate is bugged rn"* - *"you cant
enter it"* - *"it kicks you out instantly"*. world116 (AUDIT WBX R7) went live at 21:12 UTC and refuses the `in` of a
game that does not know the brain's law, in the one refusal word such a game acts on - `the gate is closed` - and every
game loaded before the deploy is such a game: a tab left open across it, and a desktop copy (its update downloads at
launch and installs when the app QUITS, so the session after a release runs the old build; a macOS or portable copy is
only told a release exists - `app/main.cjs` DA6/DA7). Each walked into the court, sent its `in` without `bv`, was
refused, and was thrown out before the gate a second later reading *"The gate is closed."* in front of an open gate with
*"seals in 8:13"* over it. Reproduced in a real browser against the real Room (the local relay, its clock moved into day
518's window): the build before the deploy (c0093f70) is thrown out so; this build's own `in` fights, on day 518's site
and on 519's. The gate itself was never broken - R7 said the right thing in the wrong words.

The relay says `the gate is closed` in a `no` for R7 alone (a window that has ended is refused at the hello, as an
`error` that closes the socket; the join's refusals name the other three words), so the client reads the word as what it
means: `net/gateLink.js gateRefusalText` says `GATE_OUTDATED_TEXT` - *"Your game is older than this gate - save, then
reload (or update the app) to enter."* - and the host ejects in the same words (`scenes/world.js` `onRefused`). Every
other refusal keeps its own words, and the hello's refusal of an ended window still says the gate is closed. No relay
change and no RELAY_VERSION: a build from this one on says the reason at the next brain bump; the builds already out
cannot be taught a word, and are told only by the reload itself - the patch notes' *"Reload the game after the update to
fight"* is the whole answer for them.

### THE GATE IN THE ROCK (2026-09-28): GATE-CLEAR, GATE-COLLAPSE, EVENT-TIP

The field, through Mac: *"gate under the rock didnt go away stayed there"* - *"Never left"*; Mac: *"the gate can spawn
inside the rock geometry from world of daggerfall"*. The record is `01-Overview/Field-Bugs-2026-09-28b.md`; in short:

- **"Never left" was the sealed hours, not a leak.** The report (14:46 UTC) fell in day 538's `closed` phase (sealed
  14:42:30, wrath 14:52:30), which the map's countdown-less label confirms; every drawer derives the phase from the clock,
  and nothing keeps a gate past its collapse. The rock kept anyone from the fire, so no kill ended it early and it stood
  its whole schedule saying nothing.
- **GATE-CLEAR** (`world/gateClearance.js`): the gate's spot stays the clock's and the map files'; World of Daggerfall's
  rock yields - a whole site reaching 24 m of the gate's foot is refused at its pick, any other piece whose mesh box
  reaches it is not stood - for the gate the clock is about, the pixels a turn changes built again between builds.
- **GATE-COLLAPSE** (Mac: *"Count down to collapse"*): the sealed hours count down - `gateCountdown`'s `closed` arm,
  `countdownWords`, the seal line's time (the table above). World125: the words are in the relay's bundle.
- **EVENT-TIP** (Mac: *"add a tooltip to the map for these type of events"*): on the held map the gate's ring and every
  raided town (`03-World/Raiding-Parties.md`, folded in from #414) answer a hover with a card (`ui/eventMapMarks.js`,
  the omen's `gateTip`).

### THE HERALD (DISCORD-GATES, 2026-09-28): the gates on Discord, live

The field's player: *"add a discord channel that tells the gates in real time itll create hype and make more join"*;
Mac: *"Discord live gates?"*, then the moments - *"Omen (15 min before), Boss slain"* - and *"Ping an opt-in role"*
(on the omen alone). The relay's hub posts to a Discord channel's webhook (`net/gateHerald.js`, the hub's own alarm):

| When | The post | Pings |
|---|---|---|
| the omen (17:00 - fifteen real minutes before the gate opens) | **The sky burns near Copperham, Wrothgarian Mountains.** An Oblivion Gate opens *in 15 minutes* (*14:32*) and seals at *14:42*. Valkynaz Ruhn, Warden of the Burning Gate, holds it. | the opt-in role |
| the kill | **Valkynaz Ruhn has fallen** at the Oblivion Gate near Copperham, Wrothgarian Mountains - struck down by Ann, Bran, Cid and 12 others. The gate collapses. | nobody |

- **The times are Discord's** (`<t:…:R>`, `<t:…:t>`): each reader sees them in their own clock, the wait counting down.
- **When**: the omen at its own instant, armed on the hub's alarm beside the sweep's; late while the gate has not opened
  (a hub asleep through it, a deploy), never after, never twice. The kill when the gate's object tells the hub
  (`_gateFellInternal`): KEPT FIRST (`herald.owe`), the alarm armed now, posted by the alarm alone - one poster, so
  never twice however often the court tells it - once a day, while it is news (HERALD_FELL_KEEP_MS past the collapse).
  A post Discord does not take is posted again HERALD_RETRY_MS on - but not one it refuses for good (a 4xx but 429: a
  deleted webhook); and the beat writes over what storage holds then, so a kill owed while Discord answered is kept.
- **Where - the players' word.** The relay holds no map file (section 1: the site is the client's). Each online game,
  once its site scan is done, says where it found the gate the clock is about (`gate` `site` - its day, map pixel and
  place, to the hub alone; `net/online.js sendGateSite`, once a socket and day, off the clearing's own site). The hub
  folds one word an account a day and names the place the most accounts said, once at least GATE_SITE_AGREE (2) of them
  agree - one lying client names nothing. Until then the post says *over the wilds* and points at the map.
- **Safe to post**: `allowed_mentions` is the one role (the omen) or nothing (the kill), so no text can ping anyone
  else; the place (`gatePlaceWire`, both ends; the relay refuses one it would change) and a fighter's name
  (`heraldName`) are letters, digits, spaces and a little punctuation - no markdown, no link, no mention.
- **The door**: `GATE_DISCORD_WEBHOOK`, a Worker SECRET (its URL is the key to post in the channel - never in the
  repository), and `GATE_DISCORD_ROLE`, a var (`server/wrangler.toml`). No webhook, no herald: nothing posted, nothing
  kept. The role must allow anyone to @mention it, or Discord shows the ping and notifies nobody.

Relay world123 (world126 on its branch, renumbered at the merge with main). Pinned in `test/discordgates.test.js` (11); mutants `tools/mutants/discordgates.json` (45, all dead).

**At sea (SERPENT2, 2026-10-04).** The sea serpent has its own herald on the same door and channel
(`net/serpentHerald.js`; `Sea-Serpent.md` section 14). It posts its bells fifteen minutes before it rises, pinging
`SERPENT_DISCORD_ROLE` or else this role, and its kill. It keeps its own vote of where the serpent lies (a `serpent`
`site` word, folded by this law) and posts the kill AT the agreed site alone, since a cell keeps a forged site's fight
too. Its beat runs on the hub's alarm after this one. `test/discordgates.test.js` stubs it, so the pins above are the
gate's alone.

## 13. The Warden's marks (WB8, 2026-09-28)

Mac: "Make the oblivion gate boss not be able to be pacified, continue to refine and add detail to his encounters, and
give him unique and different modifers on every 2 hour spawn."

### Never swayed (WB8a)

No path swayed him before this, but only by accident: he is in no foe pool, so the language roll (DFU's EnemySenses
pacification) never met him; his spell door took harmful families and a Soul Trap alone; and the relay keeps no
hostility. Yet his stand-in is a Daedra Lord's entity (mobile 31, the Daedra group), which a Pacify Daedra matches the
moment anything routes a spell to it. Now it is his own word - `pacifyImmune` on the stand-in (`world/gateBoss.js
bossStandIn`) - and every door that could sway anything refuses a target that says it: the language seam
(`scenes/hostCombat.js tryLanguagePacification`, the edge consumed, no tongue asked), the Pacify/Charm arm
(`systems/effects.js`, no chance rolled, counted as `swayRefused`) and the flag's door (`scenes/hostMagic.js`). A sway
aimed at him now REACHES his door (`spellSways` joins his marks) to be refused there in words - "Valkynaz Ruhn cannot be
swayed." (BOSS_SWAY_TEXT, at most every BOSS_SWAY_TELL_MS, 4 s, for a Cast When Strikes rides every blow) - and the
missile is spent on him; the rest of a mixed spell lands as it would.

### The marks (WB8b)

Every gate - a game day, two real hours online - the Warden comes under ONE ASPECT and TWO TRIALS (`net/gateMods.js`,
a leaf the relay bundles):

| Aspect | Element | His elemental blows | His ground |
|---|---|---|---|
| the Burning | fire | Hellfire, Flame Nova, Meteor of Oblivion, Spokes of Dagon | Burning ground |
| the Rime-Wrought | frost | Rimefall, Frost Nova, Hailstone of Oblivion, Spokes of Rime | Rime |
| the Storm-Crowned | shock | Stormfall, Thunder Nova, Thunderbolt of Oblivion, Spokes of Storm | Storm-scorched ground |
| the Venom-Blooded | poison | Venomfall, Venom Nova, Plague Star of Oblivion, Spokes of Venom | Venom |

His blade, his slam, his charge and his leap stay plain; Dagon's Wrath is Dagon's fire whatever he wears. An aspect
is more than a colour: a struck player's SAVING THROW is the aspect's element's (`net/gateStrike.js blowOf` - any
element saved now, not fire alone; `scenes/world.js GATE_SAVES`, poison DFU's DiseaseOrPoison with the Poison flag), so
a frost-resistant character stands the Rime-Wrought better and a Breton's magic resistance meets none of them.

| Trial | Its law (net/gateBrain.js fightProfile) |
|---|---|
| Colossal | his body a quarter larger (radius 2.25 m, height 7 m - the relay's melee reach, the cone, the lane and the walk all measure from it; the Cleave's cone reaches as far past his body as it ever did, 9.45 m from his centre), each share a quarter more (the kill a quarter longer at the same bucket), his Ground Slam 8.5 m |
| Unyielding | his ward at a phase's turn holds 6 s, and every blow on him lands 15% lighter (before the caps; what it takes off is his, never counted as clipped) |
| Vengeful | his blows and his ground take a quarter more (share and base) |
| Scarring | his Ground Slam scars the floor at his feet (3 m) and his Crushing Leap where it lands (3.5 m), and all his ground lasts half again as long |
| Grudge-Bearer | his threat never fades, and he goes at the one who hurt him most 85 times in a hundred |
| Soul-Hungry | each challenger who falls in the court with a real part in the fight behind them (`hasPart`, AUDIT WBX R2's bar: a blow worth 2% of their share, or 30 s stood) feeds him 3% of the health he stands for - once an account a fight, at most five feedings a fight (GATE_FEEDS_MAX), never past his whole - said to the court (`fed`, one word a beat naming every one who fed him) |
| Dagon's Favoured | Hellfire and the meteor from the first phase, the Spokes from the second |
| Echoing | every meteor falls again a breath after the first - on the fighter it fell for, where they stand now, or where the first fell if they have fallen; an echo has no echo, and a phase's turn clears it |

THE DRAW IS A CYCLE (`net/gateLaw.js gateModsOf`): every aspect with every pair of trials ONCE each - 4 x 28 = 112
gates, nine and a third real days - in an order where no two gates running share an aspect or a trial (the cycle's own
wrap too), each round of four gates (gates 4k to 4k+3) brings all four aspects and all eight trials, and a pair of trials rests 25 gates at least,
coming back under another aspect. Built from the round-robin's seven perfect matchings of the eight trials (relabelled
by the salt's shuffle), each under the four turns of the aspects, each round's gates in its own shuffled order and its
first and last chosen depth first so the seams share nothing. A function of the day alone: every client and the relay
draw the same marks, and every screen can name them from the omen on. (WB11a: NINE trials since the Legion-Lord - a bye
seat, 4 x 36 = 144 gates, each round every aspect and eight of the nine, a pair resting 33; section 17.)

THE RELAY'S WORD: the fight is born on the day's marks (`server/src/index.js`, `newFight(..., gateModsOf(day))`) and
keeps them (`md`, checkpointed with it); every `st` says them, and the client fights the fight's own marks, whatever
the day's draw would say. A fight checkpointed before WB8, or an older relay's, is the Warden unmarked - the profile of
no marks is the constants exactly (BASE_PROFILE), so nothing about an unmarked fight moved. The brain's law was 3
(GATE_BRAIN_V, GATE_BRAIN_MIN - 4 at WB9, 5 at WB11): a game that does not know the marks would judge a colossus's slam at the old reach and
his frost as fire, so it is told to reload (GATE-RELOAD's words). Relay world128 (world126 on its branch, one relay past main's OW6L - world127 - at the merge): `net/gateMods.js` joins the bundle
(wire.js validates `md` - known words, one aspect at most - and projects `fed` field by field, the name as every name).

### The detail (WB8c)

- **Before the gate**: tonight's marks beside the first line of a gate still to be fought (the omen, else the rise,
  else the opening) - "Valkynaz Ruhn comes the Rime-Wrought tonight. His fire burns cold - frost, not flame. Colossal:
  larger and harder to fell; his Ground Slam reaches further. ..." (`net/gateLaw.js marksLine`, once a day); the map's
  card (EVENT-TIP) carries them while he stands ("The Rime-Wrought - Colossal, Unyielding"); and the Discord omen names
  them in the tables' words alone ("Tonight he comes **the Rime-Wrought**, Colossal and Unyielding.").
- **Stepping through**: his aspect's own line and his trials - "The air rimes as you step through: the Warden's fire
  burns cold tonight. His marks tonight: Colossal, Echoing." - once an entry, never to a court whose Warden has gone,
  never for an unmarked one.
- **In the fight**: his bar says his epithet after his name and his trials under it, each attack called by his
  aspect's name in its colour; his telegraphs, his glow (at his own chest), his mark and his ground wear his aspect's
  colours - ice, violet and a bolt's white, green; his elemental cues are his element's own cast, and the storm lands
  in thunder; his frost, lightning and venom land on me unflashed, each in its element's cast, as his fire always did
  in the Burning clip; a full resist says what was resisted ("You resist the frost of the Rimefall."); each phase's
  turn says the floor in his aspect's words ("the floor will freeze - keep out of the rime"); and a Soul-Hungry
  Warden's feeding is said by name ("Valkynaz Ruhn feeds on Ann's soul."; two in one beat, "feeds on the souls of Ann
  and Bran") with his growl, heard live - never one older than FED_LATE_MS (2 s).

Pinned: `test/wb8a_never_swayed.test.js` (4), `test/wb8b_gate_marks.test.js` (15 - the tables, the cycle, the profile
against the constants, each trial in the brain, every attack escapable under every set of marks, the wire, the
relay's draw), `test/wb8c_gate_detail.test.js` (10 - the strike, the ground, the court's strikes and words and body,
the look and voice, the telegraph and bar, the omen, card and herald, the fold, the seams); mutants
`tools/mutants/wb8a.json` (12, all dead), `tools/mutants/wb8b.json` (36: 35 dead, the cycle's wrap check equivalent as
recorded - belt and braces for another salt), `tools/mutants/wb8c.json` (41, all dead).

### AUDIT PRE-MERGE 0929 (2026-09-29)

Read before PR 418 merged (`bible/01-Overview/Audit-PreMerge-0929.md`, lenses W1 and W2). What moved:

- **W1-1 - a Soul-Hungry Warden fed by throwaway guests.** A fall is the fighter's own word (the pose's `dd`), and each
  fed him 3% of his whole health and outlived the fighter's share: twenty-five guests that said `in` dead and went
  took him from a fifth to all but full. Only a fall with a real part behind it feeds him now (`hasPart`), and no more
  than GATE_FEEDS_MAX (5) a fight.
- **W1-2, W2-1 - a Colossal Warden cleaving air.** The Cleave is chosen at a gap of its range past his body; Colossal
  grew the body and not the cone, and a fighter standing 9.0-9.25 m off was cleaved at 39 times in two minutes, struck
  by none, and never walked in on. The cone reaches from his body now (`A.r + BOSS_R * (size - 1)`, 9.45 m), and AUDIT
  WBX R3's law - wherever the Cleave may be chosen, a still fighter stands inside it - holds for all 112 sets.
- **W1-3** - two falls in one beat are one `fed` word naming both (`ns`); **W2-3** - a feeding is judged late by its
  age alone (FED_LATE_MS), not by whether another was heard this entry.
- **W2-2** - the profile is kept by its marks array (a WeakMap), its trials line joined once; the card's marks line
  once a day (a marked court's frame made 8.9 KB of garbage to an unmarked one's 2.5).
- **W1-4** - the cycle's words: each ROUND of four gates brings every aspect and trial; a pair rests 25 gates at least.

Pinned: `test/audit0929_gate.test.js` (3), and in `test/wb8b_gate_marks.test.js` (the part a fall needs, the ceiling,
one word a beat, the cone for all 112 sets) and `test/wb8c_gate_detail.test.js` (the court's words); mutants
`tools/mutants/audit0929_gate.json` (11, all dead).

## 14. Three courts, the Reckoning and the fall seen (WB9, 2026-09-30)

Mac: "Can we add the modifers below his health bar? Allow people to see the modifers/trial as a popup before it
starts. I want to further improve the boss also, wanna go more in depth. 1. I want to add 2 more arena's of the same
size that the boss leaps to between each phase. A walkway should form to allow players to traverse through each arena.
2. The boss should have a detailed wipe mechanic on the final phase that should require players to destroy oblivion
crystaline formations that grow anywhere within the final phase arena, which then stuns his wipe mechanic. 3. Further
improve his effects, ensure his ground affects actually cause damage and the player recieves proper feedback. 4.
Increase boss damage, further improve his telegraphs 5. Improve the loot drops that emit on his death and have them
spread out more. The player should be able to inspect and pick up the ground item, not just walk over it. 6. Add a
brand new title to the broker and a new addition (the aura), an animated burning ground aura that circles the ground
where your character stands. These items should be expensive and sought after. 7. Further improve the morrowind model
performance as it's unplayable with so many players around."

### The marks seen (WB9a)

Under his health, a row of three chips - his aspect's sign, name and element in its colour, then each trial's sign,
name and one line (`ui/gateMarksView.js marksViewOf`, made once a marks array; `ui/gateBossBar.js` writes a chip only
when the night's marks change). Before the fight, a card: beside the gate's countdown in the street while it stands
(`scenes/gatePool.js`, "Tonight's marks"), and over the court as a fighter steps in (`scenes/gateCourt.js`,
MARKS_CARD_ARRIVE_MS, 9 s, fading over MARKS_CARD_FADE_MS) - each mark's sign, name, line and how to meet it
(MARK_TIPS) - never over the step's fire (`ui/gateVeil.js`), never for a Warden already fallen.

### Three courts and the walkways (WB9b)

The court is three: the first where the players arrive, the second west of it, the third north of that (`net/gateBrain.js
COURTS` - [0, 0], [-68, -22], [-74, -94] in the court frame; clear of the great tower's window). Each is the first's
size (COURT_R 24), its own rune ring, spires and five braziers, each rim some 20 m of fire from the next. Each phase is
fought in its own: at a phase's turn (PHASE_TURN) he **bounds across the fire** (`cross`: a 2.4 s wind-up, 2 s in the
air, CROSS_HEIGHT 22 m at the top of the arc, a 7 m disc where he lands - the leap's weight - heard across all three
courts) to the next court's heart, under a ward that holds through the bound (CROSS_WARD_MAX_MS). The bound's word lays
a **walkway**: 25 slabs of the court's own flagstones and basalt rising stone by stone out of the sea of fire from the
court he left (`world/gateArena.js walkSlabs`, `slabRise`, `slabMatrix`), each whole before the laid floor reaches it
(WALK_LEAD_MS 1 s, then WALK_FORM_MS 4 s end to end; WALK_HALF_W 3.2 m either side). There he **waits** under his ward
for a living challenger to cross into his court (at most CROSS_WAIT_MAX_MS, 30 s), then holds his own ward more
(SHIELD_MS - Unyielding's 6 s) while the phase's signature is cast from its heart. He chooses, aims at and waits for
the fighters standing in his court alone; a fighter left behind is not before him.

ONE LAW OF THE FLOOR, BOTH ENDS (`onFloor`, `clampToFloor`): the first court always; a walkway as far as it is laid; a
court past a walkway laid whole. The relay refuses a blow from off it (a pose's slack beyond), and the motor keeps a
player on it (`world/gateArena.js courtArena` - one arena a frame, its crossings and the relay's clock refilled;
`player/motor.js _putBack` takes the airborne momentum off the floor away, off a walkway's side as off a rim). The
collider carries every disc and every deck; the motor is what says how much is laid.

On the wire (relay world135 - main's SOFTCAP1 took world133 and its PARTY-MAP world134 first - the brain's law 4): the state says his court (`ct`) and the crossings (`xa`, the relay
moments of the bound's words), and a bound's own word lays its walkway on every screen at once (`net/gateLink.js
crossLaid`). GATE_COURT_BOUND is the three courts' (160 m). A fight checkpointed before WB9 crosses from the first court
over every walkway up to the court it bounds to. The telegraph is drawn over the court it lands in (the Wrath's and the
Reckoning's over all three - `render/gateTelegraph.js`, one quad per court); his mark over the court he stands in; the
burning ground on each court's own quad. The braziers are lit nearest the camera first, after the fight's own lights
(`courtLightsNear` - the classic renderer's sixteen slots drop a far court's fire, never him). The Deadlands' islands
and hanging shards keep clear of every floor and walkway (`world/deadlandsLand.js floorGap`, LAND_CLEAR_M 12, and of the
spires - `courtSpireAxes`, one law for the model and the land), and four more shards hang round each new court.

### Dagon's Reckoning (WB9c)

In the last court, once Dagon's Champion's turn is done, his Reckonings are armed: the first RECKON_FIRST_MS (18 s)
later, each RECKON_EVERY_MS (60 s) after the last one ended. He leaps to the court's heart and calls **Dagon's
Reckoning** - a 22 s wind-up no phase shortens - and **crystals of Oblivion** grow out of the floor anywhere on it
(`growCrystals`: two and one for every two living challengers in his court, 3 to 8; RECKON_RING, 6 m clear of him to
3 m short of the rim; CRYSTAL_GAP_M 7 apart; the relay's CSPRNG). Each has a health sized to the court: RECKON_TEAM_S (8)
seconds of the living challengers' reference damage shared across the crystals (at least RECKON_CRYSTAL_MIN) - a court
that splits up breaks them in well under half the wind-up, one that stands together round one does not.

A blow on a crystal (`xhit`: which crystal, the blow's own sequence, its number, its kind) is judged by the same hand
and purse as a blow on him (`applyCrystalHit`: his blow rate, the damage bucket, a swing within MELEE_REACH of its body
- CRYSTAL_R 1.3 - a pose on the floor) and counts as dealt. Each broken is said at once (`cxb`, by the breaker's name);
the last BREAKS THE RECKONING: it is called off and he is **stunned** STUN_MS (8 s) - on his knees, reeling on his hurt
frames in a pale ember, no step and no blow, and every blow on him lands STUN_HIT_X (1.5) heavier, before the caps
(`stun`). Leave one standing and it lands on the whole arena, every court, answered by nothing (`isDagons`: no saving
throw, no aspect's element, no phase's cut - Dagon's, as the Wrath is); the crystals are spent in it. The Wrath at the
gate's midnight overtakes a Reckoning and a stun alike.

On every screen (`scenes/gateCourt.js`): the call said as they rise ("Dagon's Reckoning! Shatter all 5 crystals of
Oblivion before it lands!" - to a fighter come in late through the wind-up too, with what is left), each one heard
grinding up out of the stone; each a body the swing, the shaft and the spell meet by its surface as they meet him
(`scenes/dungeonContext.js gateCrystalBodies` - never in `foes`; its stand-in `world/gateBoss.js crystalStandIn`,
unarmoured and dodging nothing) once grown half out of the stone; a blow flashes it and rings the glass at once, its
number out; each broken said by name ("Ann shatters a crystal - 2 remain.") with its crash; the stun said and heard
("The Reckoning breaks! Valkynaz Ruhn is stunned - strike now!"); an unbroken Reckoning bursts every crystal still
standing as it lands. The bar says what is left and how long ("Dagon's Reckoning - 2 of 5 crystals - 13s", in the
crystals' colour), the stun its seconds, and the foot the next Reckoning's coming. Drawn by `render/courtCrystals.js`:
one faceted cluster (a great prism and five lesser, each its own piece), growing out of the floor, glowing from a
white-hot heart in his aspect's colour (Oblivion's crimson under the Burning), cracking as its health goes, flashing
white when struck, flying apart into tumbling shards when it breaks; under each a pool of its light, and from each one
standing a beam into his chest while the Reckoning winds up; a light over each standing crystal.

### His ground felt (WB9d)

Every pool bites half again what it did (POOLS: Hellfire's 8% and 3 a second, a meteor's 10% and 4; Scarring's scars
alike). The law of the bite is WBX5's (a tick after the step in - a step through is free, standing is not); what moved
is that it SAYS itself (`ui/gateGroundView.js`): the screen's rim glows in the ground's colour while I stand in it
(breathing), flares at each bite, and his elemental blows flare it in their own colour as they land on me; the ground's
name and "step out!" stand under the crosshair while I am in it; and the step in hisses at my feet at once
(`world/gateBoss.js groundStepCue` - the burning ground's hiss, or his aspect's element's cast). DFU's red flash stays a
blow's alone (spell damage never flashed - `ui/damageFlash.js`). The pools seethe in his ground's own grain.

### His blows heavier, read and seen (WB9e)

Every share and base about a third over WBX4's (the Cleave 45% and 12, the Slam 52% and 14, the Charge 40% and 12,
Hellfire 40% and 9, the Nova 58% and 14, the Leap 45% and 12, the Meteor 64% and 16, the Spokes 52% and 14): two heavy
landings end anyone who has not healed between them; no wind-up moved. The telegraph (`render/gateTelegraph.js`): an
edge at least two pixels wide however far off (`fwidth`), a soft halo outside it; a FUSE burning down its rim as the
wind-up runs, a spark where it burns; the fill throbbing faster as the landing nears (1.5 to 6.5 beats a second) and
burning at a landing's brightness through the last TELEGRAPH_NOW_MS; the grain of what lands running through it (his
weight's cracks, fire's flicker, frost's facets, the storm's crackle, venom's bubbles, Dagon's vortex); and a shockwave
thrown out past its edge as it lands. The landing itself (`render/gateFx.js`): sparks out of the stone where it lands -
grit for his weight, flame and his aspect's colours for his element, the heavy ones throwing more, further - and the
meteor seen falling out of the Deadlands' sky onto its mark through the last METEOR_FALL_MS of its wind-up, its trail
behind it.

### His spoils spread and handled (WB9f)

THE THROW (`world/gateSpew.js`): WB5 threw each piece on a bearing of its own roll inside 0.9 radians of the player's, at
7-10.5 m/s, so five pieces could leave on one line and land in one heap. Each piece now takes its own SLOT of a fan 1.6
radians either side (SPEW_SPREAD - a half-disc toward the player, never behind him), the slots dealt out in the seed's
order and each piece jittered inside its own, never within SPEW_SLOT_MARGIN of its edges (`spewLaunches`), thrown at
8-13 m/s: over 200 seeds no two of a kill's pieces rest within a metre of each other, none past a dozen metres out.
A throw that hard could carry a piece off the court's edge into the fire, so each launch is FLOWN AHEAD over the
court's floor (`restOf` - the torch's own flight over one plane, `floorRayAt`) and thrown softer (SPEW_KEEP_EASE a try,
its direction kept) until it rests inside `keep` - the court he fell in, SPEW_RIM_M in from its edge
(`scenes/gateCourt.js spoilsKeep`) - or, past SPEW_KEEP_TRIES, turned toward the centre (`keepLaunch`).

THE PRESS (`scenes/spoilsPool.js`): a resting piece is an ACTIVATION TARGET in the loot piles' own shape - a box over
its picture, won at the ray's reach (RAY_DISTANCE) and taken at the treasure's (TREASURE_ACTIVATION_DISTANCE, so "You
are too far away" is said as a chest's is) - `spoil:<i>` for an item, ITEMISED (systems/worldHover.js ITEMISED_KEYS:
the plaque lists the one item, with its tier and, under quick loot's stats, what it is), `spoilGold:<i>` for the gold
(named: "412 Gold Pieces"). The pool answers the ray (`targets` - one list refilled, each piece's target made at its
rest), the ladder (`nameOf` - the item's own word by the host's `itemName`, the loot piles' lootPileName, and its tier
below it), the plaque (`contentsOf`) and the press (`pick` - into the pack, said as a walk-over says it; once). The
court stands the family where it is stood (`scenes/worldModes.js standCourt` - the fourth `addActivationTargets`, its
namer beside it), the dungeon arm's press takes a `spoil` key through the host after the reach is judged and before
any loot rung, the context's `lootContents` asks the host for the plaque's list, and the world host hands the pool to
all four. Walking over a piece still takes it (WBX3's SPOILS_TAKE_AFTER_MS after its rest). GATE-UX (section 16): no longer - the press is the only take.

THE SIGHT (`render/gateFx.js`, `scenes/gateCourt.js`): as they leave him his chest bursts in gold (FX_KINDS.spoils) -
the sparks falling to the floor under it (a burst's `floor`: `uFloor`, `sparkAt`'s `floorRel`), not hanging at his
chest's height - and each piece's landing (the pool's `frame(onRest)`) throws its tier's sparks where it lies, a
Rare-or-better's more and brighter (spoilRest, spoilRestRare).

### The Broker's insignia (WB9g)

A day's ware (`systems/sigilBroker.js`) is an item on the pack. A piece of the INSIGNIA is worn over the name or at the
feet where every other player sees it, and a thing others see must be one no client can assert (ACC3's law) - so it is
bought ONCE and kept by the ACCOUNT (`net/insignia.js`, the law both ends read): **Gatebreaker**, a title, for 30 Sigil
Stones, and **Dagon's Fire**, an aura, for 50. A gate opens every two hours and drops one stone to a fighter, so they are
some thirty and fifty gates closed, where the day's dearest ware (a piece of Ruhn's Regalia) is twelve.

THE SALE (`server-account/src/accounts.js buyInsignia`, POST `/v1/account/insignia`) is recorded on the row (migration
0040 - main's HOUSING took 0037-0039: `insignia`, the ids bought in their order; `insignia_spent`; `aura`, the aura worn)
and paid for TWICE-CHECKED: the pack's spendable stones are taken on this side as a ware's are (`spendStones` - one hand
with the sale's `takeFromPack`),
and the service refuses a sale the account's own embers could not have paid for (gate_kills' `stones` - one a row, two
where its fighter broke the rite, WB12d - less `insignia_spent`: 409 `short`, with the `purse` they can still pay and
the `price`). ONE UPDATE is the sale - the id
joins the column and the price the spend only where the row does not hold it yet and its gates still cover it - so two
sales pressed at once never spend the same stones, and a piece is never bought twice (409 `owned`); a guest row keeps
none (403 `guest`), and the id is appended in the UPDATE itself (AUDIT WB9 I3). The Broker HOLDS the stones before it
asks the service and gives them back unless the service holds the sale - a lost answer asked after - and saves a held
sale at once (AUDIT WB9 I1/I2: `systems/sigilBroker.js insigniaSale`), so a refused sale takes nothing and no sale goes
unpaid; the account view says the purse beside the wardrobe.

HELD, WORN, SIGNED. A title bought is held as a founder's is (`server-account/src/titles.js titlesHeld` reads it off the
row) and worn through the title's own door. An aura is held off the row (`aurasHeld`) and worn through its own
(`/v1/account/aura`, `equipAura` - 403 `not-held`, 400 `no-aura` for a word the vocabulary lacks), one at a time, pressed
off as it is pressed on. The mint signs the aura worn (`au`, absent for none - `net/identityToken.js` AURAS, `claimsValid`,
`mintToken`) and says it beside the token (`aura`); the relay reads it out of the signature (`_named`, `badged`,
`readAura`) as it reads every badge (relay world135, account service acct38 - main's PROF7 took acct34-acct36 first, and its HOUSING acct37 with migrations 0037-0039). This device keeps its own on the stored
session (`net/accountClient.js adoptIdentity` - every mint's answer and every wear's, from the account card or the
Broker), so the fire at my own feet lights the moment any door changes it (`systems/ownGlyphs.js ownAura`); a peer's is
its newest hello's (`net/online.js _peer`, `_refresh`, `auraOf`), kept in the session's memory through a blip (SLAM9's
`_known`). The room sees a new one from the wearer's next hello, as it sees a title.

THE WINDOW AND THE CARD. Under the day's stock the Broker's window (`ui/brokerWindow.js`) lists the Insignia: a row a
piece in the wares' own grid (the title's word in its own fire, the aura's ring turning), a control the pad and the
keyboard reach (U10's `pressable`, one home for both kinds of row), its price or Owned or Worn, and a button that says
why not or what a press does (Buy, "Need 12 more", Wear, Take off - "Buying..." until the account answers, nothing else
pressable meanwhile); pressed, the piece's card. The account card (`ui/enhancedAccount.js`) draws an Aura row beside the
titles, in the Gatebreaker's own fire (`ui/playerBadge.js`: coal-crimson through fire to ember, edged in black).
AEGIS (2026-10-03) added a second aura that is not sold here: the Oblivion Ward, granted by name with Sureme's Aegis of
Oblivion title (`06-Systems/Accounts-And-Cloud-Saves-Arc.md`, AEGIS) and drawn by the same pass; each aura's card
button wears its own title's paint (`ui/playerBadge.js AURA_PAINT`). PRIMARCH (2026-10-04) added a third, not sold here
either: the Golden Radiance, granted by name with GA00250's Primarch title (the same arc, PRIMARCH), its button in the
Primarch's gold. SHADOW-CLOAK (2026-10-04) a fourth: the Holo Shadow Cloak, granted with SirMcMobdon's Shadow Fang title (the same
arc, SHADOW-CLOAK), its button in the Shadow Fang's black and crimson. SERAPH-WINGS (2026-10-05) a fifth: the Seraph
Wings, held by every developer (DEVELOPER_HANDLES - the same arc, SERAPH-WINGS), its button in the Founder's gold.

THE FIRE (`render/auraRing.js`), two draws a wearer. THE GROUND: one quad under the feet, answered per pixel about the
wearer - a ring band broken by value-noise fire flowing round it and outward, bright crests chasing about it, ten embers
circling in it, a glow in the stone within. THE FLAMES: a low cylinder of tongues rising out of noise scrolled up and
round, white-hot at the root, orange, red and gone at the tip, both faces burning. The duel wall's law: fixed geometry
placed by uniforms, added onto the frame (ONE, ONE), tested against the world's depth and never writing it, the ground
offset off its stone, fogged with the frame's fog and focus (AUDIT DEEP R-1). The noise's lattice wraps where the ring
closes and where the clock does, and every rate is a whole number of turns over AURA_CLOCK_PERIOD (120 s), written as
turns a second times TAU - a rounded radian rate drifts off whole by its rounding times the period and steps the picture
at the wrap. A wearer's fire kindles over AURA_KINDLE_S; a frame draws at most AURA_DRAW_MAX (16), the nearest within
AURA_RANGE_M (90 m). The world host gathers them with the peers each frame (`scenes/world.js auraFrame` - mine off the
stored session, a concealed peer's concealed with them, none under the travel view) and draws them after each mode's
opaque world through the veiled bodies' hook, under the frame's own camera (every host calls it: the street, the
dungeon's late draw, the building), a foreign pass. `tools/auraProbe.mjs` draws it in a real WebGL2 (11 checks).

### The bodies in a crowd (WB9h)

A gate is a crowd, and the other players' Morrowind bodies were its cost (`net/peerBodies.js`; the whole account is
`07-Rendering/Performance-Rig.md` section WB9h): forty players milling round the eye built 81 bodies in thirty
seconds as the nearest eight reshuffled - up to 24 in five, each a multi-second mesh parse - and skinned and drew
every body whether it was seen or not. Now a body out of the view is neither drawn nor skinned (posed the moment it is
seen), at most SKIN_BUDGET bodies are skinned a frame, a stranger's body is handed over only after SWAP_DWELL_MS, no
oftener than SWAP_EVERY_MS and never behind a build, and a body given up is kept SPARE_MS for the next player who
wears the same one. The same crowd: 11 builds, no body taken from a player standing near, a skin and a fifth a frame
where there were five (`tools/peerCrowdProbe.mjs`).

Pinned: `test/wb9a_gate_marks_seen.test.js` (7), `test/wb9b_gate_courts.test.js` (12), `test/wb9c_gate_reckoning.test.js`
(16), `test/wb9d_gate_ground.test.js` (5), `test/wb9e_gate_blows.test.js` (6), `test/wb9f_gate_spoils.test.js` (10),
`test/wb9g_insignia.test.js` (17), `test/wb9h_crowd_bodies.test.js` (7), and the audit's `test/audit_wb9.test.js` (16);
mutants `tools/mutants/wb9b.json` (19, all dead), `tools/mutants/wb9c.json` (31: 30 dead, the dead counted at the
crystals' growth equivalent as recorded - the court's living are filtered once), `tools/mutants/wb9d.json` (9, all
dead), `tools/mutants/wb9e.json` (9, all dead), `tools/mutants/wb9f.json` (24, all dead), `tools/mutants/wb9g.json` (64,
all dead), `tools/mutants/wb9h.json` (25, all dead), `tools/mutants/audit_wb9.json` (36, all dead). The older suites re-aimed
where WB9 moved their law: the phase's turn (WB3, WBX5, WB8b - the bound and the wait for the leap), the court's
geometry (WB3b, WB6b - three courts, the braziers and shards clear of the walkways), the damage numbers (WB4, WB8c),
the telegraph's text (WB4), the motor's clamp (AUDIT DUEL1), the relay's version pins (world135); and for WB9f the
burst's call (AUDIT WB A2, WBX3 - it hands the court's floor), the spew's bearing (WB5's toward-his-back mutant), the
itemised keys and the court's fourth target family (WORLD-HOVER), the pool's keys (RAID4b's mutant), the spark's floor
(WB9e); and for WB9g the title vocabulary's order and the wardrobe's shape (PENITENT, SHADOW-FANG, ACC3), the account
Worker's columns and migrations (ACC-WORKER, RENOWN-CHAR) and its version pins (acct34), the foreign passes (AUDIT 18)
and R-1's fogged programs (TV4), the Broker's rows (SET7's U10 - one `pressable`) and its stone-taking (SS1 - one
`takeFromPack`), the session writer's mutants (NAME-ADOPT, SFSKIN), and the relay's version (world135).

### AUDIT WB9 (2026-09-30, Mac: "Audit this before we merge")

The branch audited in five parts before the merge - the relay's brain (WB9b/c), the court's client and its drawing
(WB9a/c/d/e), the spoils (WB9f), the Broker's insignia (WB9g) and the bodies in a crowd (WB9h) - each finding reproduced
by a script against the real modules before anything changed, and shots of the aura and the title taken in a real
browser (the court's own floor, `render/auraRing.js`, `ui/nameLayer.js`, `ui/brokerWindow.js`, `ui/enhancedAccount.js`).
Nineteen were real.

| # | found | now |
|---|---|---|
| B1 | **blows landed from outside his court**: the relay judged a blow on the laid floor, but he chooses, aims at and waits for only those in his court - three casters at the first court's rim took him from 66% to 33% in a minute while he answered with nothing but his turn; one archer 49 m off broke a Reckoning's three crystals | no blow on him or on a crystal from outside the court he fights in (POSE_SLACK past its rim - `applyHit`, `applyCrystalHit`), and no screen sends one or offers a crystal from there (`gateCourt.js` fromHisCourt) |
| B2 | **a crystal broken after the Reckoning landed still broke it**: the relay judged a break 120 ms after the landing and stunned him - a court every screen had just wiped was told "strike now", and a screen that heard the stun before its own landing spared itself | a crystal takes no blow in the Reckoning's last RECKON_CLOSE_MS (500 ms) nor after it (`reckonOpen`), and the screens stop offering them then |
| B3 | the Wrath ended a stun on the relay alone - every screen knelt him through its wind-up | the Wrath's word ends a stun on every screen (`foldGate`) |
| B4 | a kill mid-Reckoning left its crystals in the fight - every later state carried them | the kill spends them |
| B5 | a fight woken from a pre-WB9 checkpoint laid only the last walkway on the screens (the relay laid both) | a bound's word lays every walkway up to its court (`crossLaid`) |
| C1 | **every Cleave drew a full ring at its reach behind him**, and its sides on to the floor's edge: WB9e's rim width was the edge's own derivative, and the cone's edge jumps | the rim's width is the pixel's footprint on the floor (`fwidth(vCourt)`) |
| C2 | the stun's "The Reckoning breaks!" was never read - said before the last crystal's line on the one label | said after it |
| C3 | the urgency throb beat 12-16 a second, not 1.5-6.5 (its phase is `hz * uSince`, and `uT` grows with `uSince`) | a third of the quickening: 6.5 at the landing |
| C4 | a strike or a pool at the rim reached the walkway past it - floor a fighter stands and is struck on - undrawn | his shapes and his ground go on over the laid walkways their court joins (`walks`, the strip pass), never his mark |
| S1 | **about one kill in fifty let a piece fall through the court** (the collider takes no hit nearer than 0.1 mm, and a flight step begun that close missed the floor) | a kept throw flies over the floor it was kept to as well (`flyRay`) |
| S2 | P or J pressed over a spoil stayed armed - the next E on a pile took all of it | the spoil's press spends it (`quickLootSpend`) |
| I1 | **the pack's half of an insignia sale was never saved** - the service's half written at once, a page closed within the two-minute checkpoint kept the stones | a held sale is saved at once (PROF-SAVE's `saveSoon`) |
| I2 | **the pack's half could be skipped**: the stones were taken after the service's answer, so a ware bought meanwhile (or a stack dropped or locked) left it untaken - 35 stones bought the title and a Regalia; a lost answer kept the stones and the piece | the price is held first and given back unless the service holds the sale; a lost answer (unreached, a 5xx) is asked after (`insigniaSale`); nothing else is sold while a piece is |
| I3 | two sales of two pieces at once, each reading the row first, wrote the column from that read - both paid, one held | the id is appended in the UPDATE itself |
| I4 | the Broker row's title sign read "tebreak" (36 px, the word ~55) | the word's first letter, in its fire; the card keeps the word |
| H1 | a body out of view banked its particles' time without end - a minute behind the eye threw a lantern's flame out of its sprite | at most EFFECTS_BANK_MAX_S a step |
| H2 | a hand-over allowed on a spare pushed that spare out of a full pool, and built behind another build | the spare a hand-over is for is never the one pushed out |
| H3 | a rig was built from the look its peer wore when its build was reached, keyed on the one asked for - a spare worn in the wrong armour | built from the look its key names |
| H4 | a concealed peer who took a spare was drawn open on that frame | its veil is set as it stands |

Checked and sound: the relay's fights fuzzed (300, checkpoints round-tripped - no NaN, nothing the wire refuses, every
clamp on the floor); the court's GL state, its DOM put away, its crystal targets; the spoils' keys, takes and gather;
the sale's guards and migration, the token's `au` and the relay's stamp, the aura's GL state and its whole rates; the
bodies' view planes (400k points against a clip-space test), their callers' lenses and the swap's bookkeeping.

RELAY_VERSION world135 (not yet deployed) holds these; ACCOUNT_VERSION acct38 the sale's append. Pinned in
`test/audit_wb9.test.js` (16) and `test/wb9g_insignia.test.js` (three more); mutants `tools/mutants/audit_wb9.json`
(36, all dead). Re-aimed: the WB9b walkway blow, the WB9c court's feet (in his court), the WB9e shader's rim and throb,
the WB4 telegraph's text (the strip), the WB9f spoil rung, the WB9g host's sale and its UPDATE's mutant, the WB9h bank.

## 15. The score pressed and darkened (WB10a, 2026-09-30)

Mac, after the gates had been out a while: *"The oblivion gates are an absolute fucking hit with the community.
Definitely a foundation I want to build on. First off I want to improve the boss music, make it more loud, just feel
like its too quite, and I feel like the music is too jolly"*.

**Louder.** WBX9 had raised the score by level alone, and a level cannot go further than the clip: measured through the
game's own player the war stood a decibel under it at the highest MusicVolume, its drums' peaks 15 to 19 dB over the
song's body - the headroom was spent on a few milliseconds of every kick. So a song may now carry its own PRESS
(`systems/songPlayer.js songPress`): the song's level drives a compressor (4:1 over a 12 dB knee from -18 dB, 3 ms in and
250 ms out - a section's swell evened, nothing pumping), then the song's own drive (`out`), then a soft CEILING - the
hyperbolic tangent, its top at -1 dBFS at the highest MusicVolume (`ceilingAmplitude`, over MUSIC_GAIN), so what the
compressor lets through of a drum's first milliseconds is rounded off under it. No song can pass its ceiling however hard
it is driven: that is the curve's shape, not a measurement. Every song MIDI.BSA holds carries no press and plays through
the graph it always did; a context without a compressor plays a pressed song unpressed. The court's four carry
`SCORE_PRESS` - one compressor, a drive each (5.2 / 5 / 5.8 at war, 5.6 at his fall) - and read, through the real player
at the default MusicVolume:

| song | WBX9 | WB10a | peak |
|---|---|---|---|
| GATEWAR1 | -25.6 dBFS | -15.8 dBFS | -7.7 (-1.7 at the highest volume) |
| GATEWAR2 | -22.1 | -15.4 | -7.9 |
| GATEWAR3 | -21.5 | -14.2 | -7.5 |
| GATEFELL | -22.9 | -15.6 | -7.6 |

Beside the game's own songs (-28.7 dBFS by day, -31.7 to -41 in the dungeons) the court's are now 13 dB and more over
the music it replaces. Where that lands for a player is one number a song (`SCORE_PRESS[...].out`).

**Less jolly.** What made the score bright went, each for a reason that can be named:

| was | why it was jolly | now |
|---|---|---|
| the pizzicato ostinato (GM 45) climbing the chord on every eighth - D, D, A, D, B-flat, D, A, F | a plucked arpeggio bounces; it is the sound of a caper | a PEDAL on the chord's root on low brass (GM 57, the trombone: its FM brightness holds through a short note, so the drive snarls where the pluck plinked), accented 3-3-2, its bar's last two notes a sigh leaning into the next bar (Dm's B-flat falling to A, B-flat minor's C and D-flat creeping up to D, the dominant's F falling to E). The drive's law is WBX9's: as many notes a bar as before |
| i-VI-iv-V-i-VI-VII-V, the VII a C major chord | the major chords outnumbered the minor, and VII-V is the heroic cadence | the villain's turn: D minor to B-flat MINOR and back (D against D-flat, A against B-flat - the flat-six minor), then iv, i and the dominant held two bars; no major chord but the dominant before his wrath, whose Neapolitan stays his own |
| brass stabs and orchestra hits voiced as major and minor triads at the top of the stave; the organ's pads the same | a bright triad struck on the beat is a fanfare | stabs, hits and pads in OPEN FIFTHS (root, fifth, octave), low - no third to brighten them; the thirds kept where they are held (the strings, the choir), which is where the minor is heard |
| the Warden's theme climbing the D minor chord to D5 (and to D6 in his wrath) on the brass | a rising arpeggio to the top of the brass is a hero's theme | three new themes that turn on half steps (D and C#, D-flat and C, A and B-flat, D and E-flat in his wrath) and fall where the old ones climbed, the first ending on a tritone's leap from E to B-flat over the dominant; the brass never over B-flat 4, the strings holding the line an octave over it |
| a tubular bell rung at D5 or A4 on the one | a high bell is a festival | the bell tolled at D3 (A2 between them in the ward's breaking, D3 and A-flat 2 - the tritone - in his wrath): at that pitch the FM bell's partials are a gong's |
| the hi-hat on every eighth or sixteenth and a tambourine on the backbeat | the pop groove; the tambourine is a dance | gone: the surdo and the floor tom on the one, the kick 3-3-2, the snare's one backbeat on the third in half time (two and four from the ward's breaking), the toms on the offbeats where the hat was |

The key, the tempos, the lengths, the voices and their channels, the law of which song plays, the choir's entries, the
drive's law and the fall's D major fanfare are as they were: his fall is the one moment the score is allowed its major.
Heard, as far as a machine hears: the share of the war's energy under 120 Hz - where a laptop's or a phone's speakers
give nothing back, and where the peaks were being made - was 34 to 37% in the first draft of the darker score (WBX9's:
25 to 31%); the ostinato moved from the bass family to the brass, the bass voice was taken under the rest (nearly all
of it is below 120 Hz) and the kit's 55 Hz bass drum dropped for the floor tom, which brought it to 23 to 30%.

Pinned: `test/wb10a_gate_score.test.js` (6) - the press, its graph, the ceiling by construction, the score's presses,
and the jolliness gone by structure (the voices and the writing); mutants `tools/mutants/wb10a.json` (18, all dead;
WB7's Neapolitan mutant re-aimed at the new progression). `tools/gateScoreProbe.mjs` (20 checks): the loudness floors
raised to a decibel and more under the table's, each peak under its ceiling, and one player through the whole fight - the
three war songs, the fall, then a song without a press - in one context. Not heard by a person before it shipped: the
probe's `--wav` writes each song for listening.

## 16. The court less in the way, and the damage chart (GATE-UX, 2026-10-01)

Mac: *"1. In the oblivion boss gate, move the modifer panel that shows away from center of the screen, it's obstructive
2. Remove the text below each boss health bar that shows phase details 3. Loot at the end can still be walked over and
picked up 4. Develop a detailed damage chart after the boss kill, showing and ranking everyone's damage"*.

**The marks' card to the side.** WB9a stood the card over the middle of the screen as a fighter stepped into the court
(`max(30%, 206px)` from the top, centred) for MARKS_CARD_ARRIVE_MS - over the crosshair, over the Warden, at the moment
the fight opened. The arrive mode now stands low on the right (`ui/gateMarksView.js MARKS_CARD_CSS`: 18 px in, at
`max(96px, 14vh)` from the bottom, 340 px wide), clear of the bar at the top, the chat at the top left and the party
panel at the top right; the street's card keeps its own place under the compass line. Nothing else about it moved: its
clock, its fade, its rows.

**No phase under his health.** WBX5 wrote the phase he fights in ("II - The Burning Court") first in the bar's foot. It
is gone (`ui/gateBossBar.js` - `BOSS_BAR_TEXT.phase` and the model's `phaseName` with it): the two marks cut in his
health say where the phases turn, and each turn is still said over the screen as it comes (`scenes/gateCourt.js
courtPhaseText`). The foot keeps the court's fighters, the next Reckoning (WB9c) and the Wrath's countdown.

**The spoils by the press alone.** WB9f made each resting piece an activation target and kept the walk-over beside it;
a fighter crossing the court to the piece they wanted swept up every piece in their path, unlooked at. The pool now
takes a piece when it is pressed (`scenes/spoilsPool.js pick`) and no other way: `frame` flies, clatters and rests them,
and stops there; the pool asks the host for no feet, and the world host hands it none. WBX3's wait after a rest
(SPOILS_TAKE_AFTER_MS) and the walk-over's reach (SPOILS_TAKE_M) went with it - a piece is a target only once it rests,
and the press's reach is a loot pile's (TREASURE_ACTIVATION_DISTANCE). Leaving the court still gathers what is left
(`gather`), so nothing is ever lost to a door, a death or the day's end.

**The damage chart.** The relay already counted what each fighter dealt (`dealt` - the receipts' bar and the herald's
three names, `topDealers`), and said only the three names at the kill. Now:

- THE COUNTS (`net/gateBrain.js`): each fighter's record keeps `hits` (blows that landed on him), `best` (the heaviest
  of them), `cxd` (what of `dealt` went into the crystals of Oblivion - `applyCrystalHit`) and `falls` (a fall counted
  the beat its body is first seen dead in the court, again only after it has stood up alive - `down`). A fight
  checkpointed before them reads each as none.
- THE CHART (`damageChart`): made at the kill and kept on the fall (`fell.dm`) - every fighter with a part (a blow
  landed, or a moment stood alive in the court; one who joined and did nothing is not listed), most dealt first, ties by
  the earlier to join (topDealers' own order), each row whole numbers: `n` the name, `l` the level claimed, `d` all they
  dealt, `x` the crystals' share of it, `h` the blows, `b` the heaviest, `f` the falls. At most DAMAGE_CHART_MAX (32)
  rows; `fell.n` still says how many fought.
- THE WIRE (relay world136): the court's `fell` word and the state's fall carry `dm`; the hub's word of the kill (the
  world's collapse, Discord's post) never does - it goes to everyone online, and the chart is the court's. `validGateOut`
  projects a chart of at most GATE_CHART_MAX rows (pinned equal), each row's numbers whole and bounded, the crystals and
  the heaviest no more than the whole, the rows ranked, the names cleaned as every name is - and anything else is NO
  CHART, never a refused kill: the fall's word stands without it. A relay before world136 says no chart, and none is
  drawn.
- THE FOLD (`net/gateLink.js`): the chart is kept with the fall; when the hub's chartless echo of the kill came first,
  the court's word brings it after.
- THE READOUT (`ui/gateDamageChart.js`): from DAMAGE_CHART_DELAY_MS (1.5 s) after this screen first saw the fall - his
  body's fall and the spoils' burst first - for DAMAGE_CHART_MS (a minute), in over a quarter second and out over its
  last second; to the side, where the marks' card stood (gone by the fall), never the middle; no click, no key, hidden
  with the HUD and under the step's fire. A title, "<boss> has fallen - N challengers", a head row, then each fighter:
  rank, name and level, a bar of what they dealt against the most anyone dealt (one hue - the court's fire), the number,
  the share of the court's whole, blows, best, crystals, falls. My row - by my name on the relay (`net/online.js`
  `name`, the host's `me`) - is ringed and says "(you)" in words, never in colour alone. The first DAMAGE_CHART_ROWS
  (10) are shown; when I am further down, my own row stands under them at my rank, and the fighters not shown are
  counted. One node, written only when the chart changes; dressed under Plus (`ui/enhancedPlusStyle.js`). On a narrow
  screen the blows, the best and the crystals fold away. Seen in headless Chromium in both skins and at phone width (a
  mock court of fifteen) before it shipped; not yet seen over a real fight.

Pinned: `test/gateux_gate.test.js` (11); the walk-over's own pins moved with it (`test/wb5_gate_spoils.test.js`,
`test/wb9f_gate_spoils.test.js`, `test/wbx_gate_fixes.test.js`), the bar's phase pin (`wbx_gate_fixes`), the kill's
shape (`wb3_gate_room`), every relay-version pin and the SLAM8 law row (world136). Mutants `tools/mutants/gateux.json`
(31, all dead); the walk-over's records in `wb5.json` and `wbx.json` re-aimed at the press, WB3's top-unordered at
topDealers' own sort (the chart's sort reads the same). Found on the way, not this change's: `wb3.json`'s
WB3-a-blow-from-off-the-court survives on the base too (WB9's in-court check after the floor's makes the floor's slack
unreachable from its pins).

## 17. His host - the Legion-Lord (WB11, 2026-10-01)

Asked what could build on the gates, Mac took the second idea of the list - *adds*, the thing section 9 named and left
("No adds. Every add would need an owner to run it; the relay could own simple ones as it owns the boss - later") - and,
offered three kinds (Harriers in the first phase, Sappers in the second, Ward-Bearers at each new court) and four
questions, answered: *"1. All three 2. Your choice 3. Your choice 4. Trial rotation"*. The questions were: (1) which
kinds; (2) a Sapper that reaches him - does it heal him or ward him; (3) do the Ward-Bearers replace the fixed ward at
each new court; (4) are the adds part of every fight, or a new trial in the marks' rotation. So: all three, as a TRIAL -
the ninth, **Legion-Lord** - which rebuilds the rotation; and the two calls left to this page are made below.

**The calls (Mac's "your choice").** (2) A Sapper that reaches him HEALS him - a share of the health he stands for, a
few times a fight at most. A ward would have been a second ward beside the Ward-Bearers' own, and the two would read as
one; a heal is the Soul-Hungry trial's own currency (a fight pushed toward the Wrath), and it is seen on the bar the
moment it lands. (3) Yes: under the trial, the ward at a new court holds WHILE HIS WARD-BEARERS STAND (to a cap), then
his profile's own ward while the turn's signature is cast - WB9b's order kept, the fixed wait turned into a fight.

### The trial, and the rotation for nine (WB11a)

`net/gateMods.js` GATE_TRIALS gains its ninth: **Legion-Lord** (`legion`) - *"His Imps harry whoever stands far off, his
Atronachs march to heal him, his Ward-Bearers hold his ward"* (AUDIT WB11 M1/D6: this page quoted a line the code never
carried, and the code's began "Imps", which the chat's line lowers). Its sign is three figures; its tip (MARK_TIPS) says
what to do - *"Guard the far ones from his Imps, stop each Atronach, break his Ward-Bearers."* (AUDIT WB11 U1: 138
characters made the tallest marks card of all, off a landscape phone's foot). The profile (`fightProfile`) carries `legion`; the
Warden unmarked and every set without it carry none, and NOTHING of the host runs, rolls or is said in such a fight - an
unmarked fight's beats, frames and dice are what they were.

THE ROTATION (`net/gateLaw.js marksCycle`) was built on the round-robin's perfect matchings of EIGHT trials. Nine is odd,
so the circle method sits one out: the nine trials and a BYE make ten seats, the ten make nine matchings, and each
matching is four real pairs and one trial resting. A round is still one matching under one turn of the aspects (four
gates, every aspect once, no trial twice); the nine matchings run under each of the four turns - **4 x 36 = 144 gates,
twelve real days**, every aspect with every pair of the nine once. What the eight-trial cycle promised, and what moved:

- no two gates running share an aspect or a trial (the seams' depth-first walk, the wrap included) - kept;
- each round of four gates (4k to 4k+3) brings every aspect and EIGHT of the nine trials - the ninth rests, a
  different one each round, never one two rounds running;
- a pair of trials comes back no sooner than 33 gates (66 real hours; it was 25), under another aspect each time;
- every trial stands in 32 of the 144 (22%; each of the eight stood in 28 of 112, 25%) - a Legion-Lord night about
  two and two-thirds times a real day.

The law needs `floor(trials / 2) === aspects` - eight or nine trials for four aspects (thrown on anything else; pinned).
A new cycle moves the marks of every gate to come, so the relay and every screen must agree on it: the brain's law
goes to 5 (below), and a game that does not know it is told to reload, as at every brain law before.

### The host (WB11b - the brain)

`net/gateBrain.js` HOST_KINDS, by wire id:

| id | kind | who, by his aspect | when | body | moves | health |
|---|---|---|---|---|---|---|
| 0 | **Harrier** | an Imp, whatever he wears | phase one, in waves | r 0.5, h 1.5 | 5.0 m/s at the challenger standing FARTHEST from him | HARRIER_S (3) s of the court's mean reference damage |
| 1 | **Sapper** | a Fire, Ice, Iron or Flesh Atronach (Burning, Rime, Storm, Venom) | phase two, in waves | r 0.7, h 2.3 | 1.6 m/s straight at him | SAPPER_TEAM_S (6) s of the court's whole reference damage, shared over the wave |
| 2 | **Ward-Bearer** | a Fire Daedra, a Frost Daedra, a Daedra Seducer (her winged form) or a Daedroth | rise as he lands in each new court | r 0.6, h 2.2 | stands | BEARER_TEAM_S (8) s of the court's whole reference damage, shared |

Counted by the living challengers in HIS court (`n`), as the crystals are: Harriers `clamp(1 + ceil(n/3), 2, 5)` a wave
and no more than 6 standing; Sappers `clamp(1 + floor(n/4), 1, 4)` a wave and no more than 6. Ward-Bearers
`clamp(2 + floor(n/6), 2, 4)` by every challenger of the fight in the room as he lands - they rise before anyone has
crossed after him - the fallen too (AUDIT WB11 B4/D5: this said his court's living, and the code counted the room's
living - a court wiped as he landed had two Ward-Bearers at HOST_HP_MIN, a blow each). Every health at least HOST_HP_MIN. Sized so: a Harrier is three of a challenger's own
blows; a court that splits up breaks a wave of Sappers, or the Ward-Bearers, in about their team seconds over the
groups it splits into, and one that stands together round one does not.

- **The Harriers** rise out of the fire at the first court's rim (HOST_RIM_R, 2 m in), never within HOST_SPAWN_CLEAR of a
  challenger nor HOST_GAP_M of each other - a rim too crowded for the dice is swept (RIM_SWEEP), and what no spot clears
  rises fewer, or the wave waits a beat (AUDIT WB11 B1/D4: the rest went evenly round the rim, beside whoever stood
  there): the first wave HARRY_FIRST_MS after the fight began, then one every HARRY_EVERY_MS while the first phase
  lasts. Each runs at the living challenger in his court who stands farthest from HIM - the archer, the caster, the
  healer at the edge - and keeps that mark HOST_RETARGET_MS. In reach it **Bites**: a 2 m disc about itself, a 0.9 s
  wind-up, 12% and 4, plain - stepped out of in half a second. Melee peels them; a ranged fighter who stands off is
  their mark.
- **The Sappers** rise at the second court's rim on the side away from him (SAP_SPREAD either side of the point
  opposite him), SAP_SPAWN_CLEAR of every challenger and never within SAP_FROM_HIM of him - that side crowded, the rest of
  the rim is swept (AUDIT WB11 B1), and fewer risen share the wave's health - SAP_FIRST_MS after the Burning Court's turn is done and every SAP_EVERY_MS
  after, while the second phase lasts. Each walks straight at him, its path drawn on the floor. One that reaches him
  (his body, its own and SAP_REACH_SLACK) is CONSUMED, and while his feedings last (SAP_FEEDS_MAX a fight) he drinks
  it: SAP_HEAL of the health he stands for, never past it. They strike nobody - they are the objective.
- **The Ward-Bearers** rise as the bound lands him in the second court, and again in the third: on a ring BEARER_RING_R
  about its heart, evenly. They stand. The turn's queue under the trial is the bound, the wait for a challenger
  (WB9b's), then **the bearers' wait**: from the first challenger's arrival his ward holds while one stands - BEARER_WARD
  _MAX_MS at most, when any still standing crumble - and when the last falls it breaks into his profile's own ward
  (SHIELD_MS, Unyielding's 6 s), under which the signature is cast as before. Every BEARER_PULSE_MS each one standing
  with a challenger within BEARER_PULSE_NEAR **Pulses**: a 3.5 m disc about itself, a 1.4 s wind-up, 18% and 6 of his
  aspect's element (the saving throw answers it). The ward's two words are WB9b's `ph`: at the arrival it says the
  longest the bearers can hold it, at the break the profile's ward.
- **Crumbled**: at every phase's turn every one standing crumbles (each kind is its phase's or its court's), and as the
  Wrath gathers (`adie`, crumbled, beside its word); at his fall the host is gone with him (the fall's word says it - no
  word of its own). (AUDIT WB11 R3: this said the Wrath had no word of its own either.)
- **A blow on one** (`applyHostHit`) is judged by the hand and the purse a blow on him is - his blow rate and his bucket,
  a melee blow within MELEE_REACH of its body, from the floor and from HIS court - and counts as dealt (the receipt's
  bar). It is never his threat. The chart counts it apart (`hd`, the row's `a`), as the crystals' `x`. Vengeful's weight
  is on the host's blows too; no other trial touches it.
- **Pure, and silent without the trial**: the host's dice are the rng the relay hands every beat (its CSPRNG), and a
  fight without the trial draws none of them.

### The wire (WB11b - relay world140, world138 on its branch; the brain's law 5)

| frame | way | what |
|---|---|---|
| `{k:'ahit', i, q, d, r}` | client -> room | a blow on host body `i` (a sequence, the number, its kind) |
| `{k:'ad', w, m, a: [[i, x, z]...], at}` | room -> all | a wave risen: its kind, the health each, each one's number and spot |
| `{k:'amv', m: [[i, x, z, tx, tz, v, at]...]}` | room -> all | the beat's walks said again, one word for every one that moved its goal |
| `{k:'aatk', a: [[i, at, x, z]...]}` | room -> all | the beat's blows begun - which body, when it lands, the disc's centre |
| `{k:'ah', h: [[i, h]...]}` | room -> all | the host's health, at most every HP_SEND_MS, when it has moved |
| `{k:'adie', is, w, n?, h?, m?, at}` | room -> all | gone: slain (by `n`), fed to him (his health after) or crumbled |
| the state's `lg` | room -> one at its `in`, the court every STATE_SEND_MS (AUDIT WB11 D10: it said one) | every one standing: `[i, k, h, m, x, z, tx, tz, v, at, la, lx, lz]` - its walk and the blow in flight (`la` 0, none) |

GATE_HOST_MAX (16) bounds every list (the brain's HOST_STANDING_MAX pinned under it). GATE_BRAIN_V and GATE_BRAIN_MIN
go to 5: a game that knows neither the host nor the nine-trial rotation would stand in an Imp's bite, never see an
Atronach walking, fight a ward it cannot break, and name tonight's marks wrong - it is refused at the `in` and told to
reload (GATE-RELOAD's words). The bump redeploys the relay and drops every connected player once.

### The host seen, heard and fought (WB11c - the client)

- **The fold** (`net/gateLink.js`): the host as the court holds it - each one's spot, walk, health and blow in flight,
  and the last few gone (how, and by whom) for the court to play out; cleared at his fall and the Wrath.
- **The bodies** (`world/gateBoss.js HOST_LOOKS`, `hostAct`, `hostStandIn`): Daggerfall's own sprites at their own size
  (an Imp hovers), on their own walk, attack, hurt and idle tables (the Seducer on her winged form's), each a body my
  swing, my shaft and my spell meet by its surface as they meet him (`scenes/dungeonContext.js gateHostBodies`, the
  magic host's `hostMarks`) - never in `foes`. Every metal bites; their armour is a knight's in plate, as his is.
- **The ground**: each blow's disc on the floor, wound up in the telegraph pass as his are; a Sapper's path to him a
  faint lane in his aspect's colour; a Ward-Bearer's tether to him in the ward's gold while it holds. Each blow is judged
  against my own feet at its landing (co-op's law) and lands through the same door as his.
- **The words**: a wave's rising ("Valkynaz Ruhn calls his host - Imps rise from the fire!", "Fire Atronachs march on
  Valkynaz Ruhn - cut them down before they reach him!"), the bearers' ("His Ward-Bearers hold his ward - break them to
  break it!"), a Sapper drunk ("A Fire Atronach reaches Valkynaz Ruhn - he drinks it in."), a Ward-Bearer cut down by
  name and the last ("The last Ward-Bearer falls - his ward is failing!" - his own ward follows for its breath; AUDIT WB11
  D1: it said "breaks") - each said while it is news, never a stale one.
- **The bar**: while the bearers hold his ward, its callout counts them ("Ward-Bearers - 2 of 3 stand"); the foot counts
  the rest of his host standing. The damage chart's row shows the host's share.
- **The sound**: each one's own bark rising, winding up and striking, its hurt and its fall - Daggerfall's clips; his
  growl when a Sapper is drunk.

### What it does not do, said so

- The host does not path (the courts are open discs) and never crosses a walkway: each kind lives and dies in his court.
- It carries no spoils (his are the fight's) and puts no threat on him.
- The Seducer is drawn in her winged form alone; her change is not played.
- Offline there is no gate, and so no host.

Pinned (WB11a-c): `test/wb11_gate_host.test.js`, with the rotation's own pins moved in `test/wb8b_gate_marks.test.js`;
the slices' record is under Shipped, the audit's below.

### AUDIT WB11 (2026-10-01, Mac: "Definitely want to perform a comprehensive audit on this and ensure it's perfect")

The slice audited by six lenses over a frozen tree (`94d91bdb`) before the merge - the brain's law for the host (B), the
relay and the wire on the real Room (R), the court's client - the link, the bodies, the bar and the chart (C), the
player's blows on the host - the swing, the shaft and the spell against the paths to him and the crystals (W), a real
browser - the floor's shapes, the bar, the chart and the marks' card in headless Chromium at 1280x720, 390x844 and
844x390 (U) - and the record: this section, the patch notes, the Testing row and the cite shift against the code (D).
Each finding was reproduced by a script against the real modules before anything changed, and the fixes were made in a
worktree of their own until the last lens had reported. Thirty were real; one two lenses found is written once, under
both names.

| # | found | now |
|---|---|---|
| W1 | **a Cast When Strikes blade that cut one of his host cast its spell on HIM**, wherever he stood: every stand-in of the court carried `spareGear`, and the enchant door sent any such target to his spell door - an Imp cut at the rim put Wizard's Fire on him 36 m off (his ward turning it through the bearers' wait), a Soul Trap was laid on him; a crystal's the same since WB9c | each body of his host and each crystal has a stand-in of its own, naming it (`hostI`, `crystalC`); the door hands the stand-in it met to the court's (`bossSpell(record, target)`), and the dungeon context lands the spell on the body it names (`spellOnStandIn`) |
| B1, D4 | **the rise spots ignored the clearance whenever the dice failed** (the rest went evenly round the arc): four archers on the second court's far rim had every Atronach rise inside their 8 m, and two on top of each other; a first court ringed by fourteen raised Imps beside them | a rim too crowded for the dice is SWEPT (RIM_SWEEP) - the arc, then the whole rim, never within SAP_FROM_HIM of him - and a spot is never taken unchecked: fewer rise, sharing the wave's health, or the wave waits a beat |
| W3 | **the blow rate counted bodies, not blows**: a swing through five Imps landed four - the fifth shown struck, taking nothing - and starved the next blows (a fast weapon at the same five lost half its blows) | ONE TOKEN A BLOW: the frames of one blow (the wire's `q`) on bodies it has not met ride on its token, BLOW_BODIES_MAX at most within BLOW_GROUP_MS - him, a crystal and his host alike (`spendBlow`, the one hand of all three arms); the court gives one `q` to every frame one frame of mine sends (`blowQ`); the gate's frame bucket GATE_HZ_MAX 16 (8) |
| W2 | a shaft on one of his host was judged for a backstab against a facing nobody keeps (`yaw` 0): from its -z side every shaft was x3 and a Backstabbing use; a crystal's the same since WB9c | no backstab on either (a swing on one had none already) |
| C1 | **the Imps rose and idled on animation records they do not have** (IDLE_ANIMS - an Imp has no idle frames, HasIdle false, and idles on its move loop): with an archive of fifteen records, 13% of their frames a blank billboard | his host's tables and clocks are the port's own for each mobile (`stateAnims`, the flyer's FLY_ANIM_SPEED) |
| U1 | the Legion-Lord's tip (138 characters, the next longest 81) made the tallest marks card of all - off a landscape phone's foot on every Legion night, the tip itself the part lost | a tip as short as the others' |
| D1 | "The last Ward-Bearer falls - his ward breaks!", the crumbling's line and the patch notes said his ward breaks - his own ward follows for its breath (SHIELD_MS, Unyielding's 6 s, the signature cast under it), and every blow in it still turned | "his ward is failing!"; the notes say it fails a few seconds later, and that he drinks a few times a fight at most |
| D2 | the slice's Testing row and its tests' names claimed pins its file did not hold: the purse's cap and bucket, the blow rate, the Sappers armed once the turn is done, no dice outside the trial | each pinned |
| B4, D5 | the Ward-Bearers were sized by the room's LIVING: a court wiped through the bound's wind-up had two of HOST_HP_MIN, one blow each, when it walked back in; this page said "his court's living" | every challenger of the fight in the room as he lands, the fallen too |
| B2, C4 | as Dagon's Wrath gathered his host's crumbling went out before his word, and the court read it as the bearers' cap: "His Ward-Bearers crumble - his ward breaks!" over the wind-up, his ward standing | his word first, and nothing said of his ward under the Wrath |
| B3, R2 | a blow on one of his host the beat before a wave rose was never said: the rising took the whole host's health as said, and the screens held the old until the next whole state | the rising says only its own |
| R1 | a blow on one of his host - or a crystal - did not keep the beat (AUDIT WBX R6's law, his alone): a fighter come back without a word fought a host that never moved | every blow keeps it |
| R3, D3 | this page said the Wrath takes his host with no word of its own | it crumbles (`adie`) as the Wrath gathers; only his fall is silent |
| R4 | a new game on a relay not yet deployed names the nine trials' marks over a fight the old relay runs on the eight's | the deploy, below |
| W4 | one still rising out of the stone was met whole from its first moment - a shaft stopped by nothing seen | met where it is drawn |
| W5 | its blood was laddered against its stand-in's health nothing can empty - the lowest rung at every blow | against its own whole (`bloodOf`) |
| C2 | one of his host fell facing +z whatever it faced - a side view gone to its back | as it last faced |
| C3 | two Ward-Bearers cut down between two of my frames were said with the count after both ("1 stands" twice, or "the last" twice) | each with the count it left |
| C5, U3 | after a lost socket the bar's "of how many rose" kept the last court's wave ("3 of 4 stand" where three rose) | kept only while one of that wave stands |
| C6, U4 | a Sapper's path and a Ward-Bearer's tether seethed by the page's clock in seconds - in the pass's float it moved every 128 s, and never throbbed | a clock a float holds (HOST_LANE_CLOCK_MS) |
| C7 | the winged Seducer idled at a walker's clock (4 a second; a flyer's is 10) | a flyer's |
| C8 | his host's shapes were new objects, four arrays each, every frame - the driver's own comment claimed AUDIT WB D10's law | refilled into their slots; one set of the standing; a blow's place made only when it is heard |
| C9, U5 | on a narrow screen a Legion-Lord night's chart folded its Host column away - the patch promised one on those nights | kept, in the falls' place |
| U2 | under the Burning a Ward-Bearer's Pulse - the disc that hurts - was the ward's own gold (hue 43, both), the tether beside it | the fire's orange (HOST_PULSE_FIRE) |
| M1, D6 | the trial's line began "Imps", and the chat lowers a line's first letter: "imps harry ... Atronachs"; this page quoted a line the code never carried | "His Imps harry whoever stands far off, his Atronachs march to heal him, his Ward-Bearers hold his ward" |
| D7 | behaviours no pin and no mutant held - HARRIERS_MAX standing, HOST_RETARGET_MS, SAP_HEAL past his whole, BEARER_PULSE_MS, `ah`'s HP_SEND_MS, the bearers' and the crumbling's lines, the foot's count; eight mutants the titles named and no record held; the bye's mutant dying only by a crash; the state's pin a tautology | pinned and recorded; the bye's mutant re-aimed so the cycle's pin kills it; the state read off the fight |
| D8 | the WB8b row still said 112 sets and every mark a round | as it is since WB11a |
| D9-D11 | the comments: "never all at once" (the first Pulses alone are staggered), "no other mark touches his host", "by this much more than a Harrier", "`adie` (one gone)", "its bark, its attack, its move"; the wire table's state "room -> one"; this page's section 9 ("No adds") and section 13 (eight trials, 112 gates, the law 3) in the present tense | as the code is |

Checked and sound: the rotation, by script (144 sets, every aspect with every pair once, no mark shared by two gates
running - the wrap too - every round every aspect and eight of the nine, the resting trial never twice running, each
trial 32 times, a pair back no sooner than 33 gates, under four aspects); 3,072 whole Legion-Lord fights fuzzed - every
legion set, 1-24 fighters joining, leaving and falling, blows on him, his host and the crystals, a twentieth of the beats
checkpointed through JSON and structured clone (5.86M beats, 9.38M frames: every one valid on the wire, no NaN, nothing
stuck, the checkpointed twins byte-identical); the real Room - an old game refused, nineteen malformed `ahit`s refused
and a flood closed, eight fights to the kill (46,224 frames) folded by the real link without one desync beat, the
largest state 2,152 bytes, splitting damage over him and his host no exploit (the purse bounds it), `hd` feeding the
receipt's bar and the chart, never the share; a non-Legion fight's beats, frames, dice and the court's whole draw
byte-identical to main's; the telegraph program and every host shape on the floor in a real browser, where the state
says, in its colour; the bar and the chart at three screens; no billboard left behind.

Not changed, and why: a joiner sees a body still rising already risen (the state carries no rise time - cosmetic);
several Bites may land on one challenger together (balance, as the Warden's blows can); the host does not path and may
stand inside him beside a melee mark (said so above); a Soul Trap struck into one of his host traps nothing (they carry
no soul a gem keeps). Pre-existing on main, named here: the marks' card runs off a landscape phone on most nights and
the damage chart's title on one (both UI's own pass); the bar has no plate ("Warded" 2.1:1 over a Nova-lit floor);
several cites main carries name lines that had already moved before this slice.

THE KILL RUN. With every fix in, every committed record on the gate's own files and in every gate list (693, from 61
lists) and the audit's own (60). Two were findings: `WB8b-the-wrap-unchecked`, recorded equivalent ("the walk's first
full path already closes the wrap"), now DIES - nine trials made the wrap's check load-bearing (WB11a's), so the record
is an ordinary mutant now; and `WB3-a-blow-from-off-the-court` SURVIVED, on main too - since AUDIT WB9 F1 a blow on him
must come from his court, and the floor's check is all that turns one from his new court before the walkway into it is
laid (he lands 2.4 s after the bound's word, the walkway is whole at 5 s), which no pin held: pinned (K1, below). Then
753 records: 747 dead, the six equivalents as recorded.

THE DEPLOY. RELAY_VERSION world140 holds these (world138 on the branch, its law re-hashed in place; main's HERALD and
LOOT7 took world138 and world139 first, so the merge moved it on). The relay deploys itself
on the push that carries a new version (`relay-deploy.yml`), and the site's deploy waits on the account service alone,
so the two can cross: an old game on the new relay is refused at `in` and told to reload (the law 5); a new game on a
relay still on world139 names the nine trials' marks on the omen and the gate's card while the relay fights the eight's
(the court reads the fight's own `md`, so the fight itself is right) - for the minutes the relay's job takes.

Pinned in `test/audit_wb11.test.js` (23, one a finding - twenty failed on the unfixed tree for their finding's reason;
the three of what was already so, D2/D7's and K1, were proven red by their mutants); mutants
`tools/mutants/audit_wb11.json` (60, all dead). Re-aimed: the WB11 pins' feet of a rising body, the ward's count and the state's tautology; the WB9c
court's one crystal stand-in, its relay seam and its two records; WB3's and WB4b's records of the hand and the
sequence; AUDIT WBX's beat and its door; WARDEN-STRIKE's four door records and its api pin; BLOOD1b's shaft record; WB3's off-the-court record now names the K1 pin, and WB8b's wrap record is no longer equivalent.

## 18. Healing on the round-up (GATE-HEAL, 2026-10-01)

Mac: *"Can we add a line on the damage round up showing the amount healed?"* - and asked which healing (each
challenger's, the Warden's own, or mine alone), Mac chose **each challenger's**: a Healed figure on every row; each game
reports the healing it lands, the relay totals and caps it. Then, of the figure: *"Like for healers"* - and asked
whether a fighter's own potions and self-heals should count, Mac chose **allies only**: what each challenger healed in
OTHERS, credited to the caster, so a fighter drinking potions does not look like a healer.

**What counts.** Health that MOVED on a challenger standing alive in the fight while it lives (from the first `in` to
his fall or the Wrath) by ANOTHER challenger's spell - a party mate's (ALLY-CAST) or a stranger's gift (SPELL-GIFT) -
and it is the CASTER's. Never one's own spell, potion or item; never what spilled over a full bar (the heal is the
health that moved, ALLY-CAST's own rule); never a revival (the ally-cast door turns the fallen away).

**Who measures it - the one healed.** Only the receiver knows what moved (the receiver decides - ALLY-CAST's law). The
ally-cast door (`scenes/world.js` `onCast`) tells the court (`scenes/gateCourt.js` `healedBy`) the caster's peer id and
the health that moved; the court keeps what each caster healed in me until it goes out.

**The wire (relay world140, with WB11 - world138 on their branch).** `{k:'heal', h: [[by, n], ...]}`: at most
GATE_HEAL_ROWS_MAX rows, `by` the caster's peer id in the room (each caster once), `n` whole points
(1..GATE_HEAL_WIRE_MAX), the fractions kept for the next - at most every HEAL_SEND_MS while a mate's spell has healed
me, and only to a relay that hears it (GATE_HEAL_RELAY_MIN - an older one junks an unknown gate word).

**The relay** (`net/gateBrain.js applyHeal`). The receiver must be a fighter of this fight on the laid floor (its own
pose - fallen or standing: a heal before a fall may be said just after it) while the fight lives; each row's healer is
the socket in this room its peer id names - ANOTHER fighter of this fight, else nobody is credited (never the receiver
itself). What a receiver says it was healed is BELIEVED within its own heal bucket: HEAL_REF_BASE + HEAL_REF_LV a level
- a generous reference health - refilled over HEAL_REFILL_S, HEAL_DEPTH_X of it deep, so no figure can be made absurd.
It buys nothing: no receipt, no share, no threat, no spoils - a figure on the chart, counted on the healer's record
(`healed`, kept with the checkpoint; a fight from before it reads none).

**The chart.** A row carries `hl`, what that challenger healed in others, when they healed anyone (`damageChart`;
`validGateOut` projects it whole and bounded - anything else is no chart, never a refused kill). On the round-up
(`ui/gateDamageChart.js`) a **Healed** column after the rest - after the host's on a Legion-Lord night - whenever anyone
in the court healed another, none in a court nobody did. On a narrow screen it takes the share's place (the share is
the damage over the court's whole, the bar beside it says as much; the healing is said nowhere else), as wide as the
damage's. The ranking is the damage's still - a healer stands where their damage puts them, their healing beside it.

What it does not do, said so: healing done to someone outside the fight, or by someone outside it, is nobody's; a heal
on myself is no one's; it is never a part in the fight (a healer who stood the fight earns a receipt by standing, as
before - WBX R4); a heal in the last moment before his fall may miss the chart (the word goes out once a HEAL_SEND_MS
at most, and the relay hears none after the fall).

## 19. Dagon's Breach - the gates in their year (WB12, 2026-10-01)

Mac: *"So, getting feedback that our oblivion gates arent lore friendly to the current daggerfall timeline. How can
we link it more true to lore?"* - then, shown a mock-up of the summoned frame, *"What do you think? I'd like to rename
the stones. And if we're going to do this I want it be as detailed as possible."* Asked four questions, Mac chose
**Dagon's Breach** for the name, **Deadlands Ember** for the stones, **harder and richer** for Mehrunes Dagon's day,
and **shops, libraries and the first breach** for the book. Then: *"Btw I want to do all 4. We're going balls deep
with this"* - the coven's ritual site too - and of it: the faithful stand **from the omen to the opening**, **6-8
faithful and a Summoner**, breaking the rite pays **an extra ember** to everyone who helped when the breach is closed
(the boss unchanged), and **a chest** stands in their circle.

Then, with A shipped and B under way: *"Let's forgoe the monthly raid. Instead, as we progress through this
integration, I just want to continue to improve the boss, hone in telegraphs, and just overall bring more AAA grade
polish to what is already developed. Also clean up text to be less explanatory and less AI."* So B is dropped (below),
and the polish is section 20.

### The year, and why the doors close

The game is 3E 417. Uriel Septim VII sits the Ruby Throne, the Amulet of Kings is worn, and the Dragonfires burn in
the Temple of the One: the Covenant of Akatosh and Saint Alessia bars every Prince of Oblivion from forcing his way
into Tamriel. The Oblivion Crisis - gates opening across Tamriel - comes in 3E 433, when the fires go out. So an
"Oblivion Gate" opening on its own in 3E 417 breaks the timeline; that is the feedback, and it is right.

The Covenant bars a door forced from without. It never barred a door opened from within: every conjurer who calls a
scamp proves it, and Daggerfall's own covens call the Princes themselves on their summoning days. So the gates
become **Dagon's Breaches** - wounds in the world that **Dagon's mortal faithful** tear open with their rite, which a
Dremora of his house (the Warden, Valkynaz Ruhn - valkynaz is a Dremora rank) holds open from his side. **The
Covenant fights every one**: that is why a breach only stands for its window - the Covenant **seals** it two hours
after it opens and **tears it shut** two hours after that (the seal and the collapse every gate already keeps), and
Dagon's Wrath is the door slammed on whoever is still inside. The precedent is canon: Dagon's legions took the
Battlespire in the years of the Imperial Simulacrum, a generation before the game. **No mechanic changes for the
frame**; the words do (A), and two things are added (C, D - B, Mehrunes Dagon's day, was dropped).

What stays, because it is lore-sound in 3E 417: the Deadlands (Dagon's realm), the Burning Court, the Dremora ranks,
Valkynaz Ruhn and his title **Warden of the Burning Gate** (the faithful's name for the arch the breach wears),
"the gate" for that arch of black stone (*"The gate is sealed. It opens in 3:12."*), the Gatebreaker title, Ruhn's
Regalia, Dagon's Brand, the Sigil Broker, and "Oblivion" as the name of the planes (*Meteor of Oblivion*, the
*crystals of Oblivion*). What goes is "Oblivion Gate" as the name of the event, and "Sigil Stone" - a sigil stone is
the keystone of a Crisis gate.

### A. The breach and its words (WB12a)

**The name.** The event is **Dagon's Breach** (a breach in running text, "the breach near Copperham"); a count of them
is **breaches closed**. Every player-facing line that named an Oblivion Gate says it so, and the Covenant is named
where a line says why the door closes:

| moment | was | is |
|---|---|---|
| omen (chat) | The sky burns over the wilds near P. An Oblivion Gate opens there at 20:00 (14:32 your time) - it is marked on your map. | The sky burns over the wilds near P. Dagon's faithful are calling a door to the Deadlands: the breach opens there at 20:00 (14:32 your time). It is marked on your map. |
| risen | An Oblivion Gate has risen near N. It opens in 4:07. | Dagon's Breach has torn open near N. It opens in 4:07. |
| open | The Oblivion Gate near N stands open until 22:00 (...). | Dagon's Breach near N stands open until 22:00 (...). The Covenant will not suffer it long. |
| sealed | The Oblivion Gate near N has sealed. It collapses at 00:00 (...). | The Covenant has sealed Dagon's Breach near N. It collapses at 00:00 (...). |
| collapse | The Oblivion Gate near N collapses. B returns to the Deadlands. | The Covenant tears Dagon's Breach near N shut. B is cast back into the Deadlands. |
| his fall | B has fallen at the Oblivion Gate near N - struck down by ... The gate collapses. | B has fallen at Dagon's Breach near N - struck down by ... The breach collapses. |
| banner, plaque, map legend, ring, map card | Oblivion Gate - opens in 3:12 | Dagon's Breach - opens in 3:12 |
| notice card | An Oblivion Gate | Dagon's Breach |
| marks card | Beyond this gate B waits, ... | Beyond the breach B waits, ... |
| Discord omen | ... An Oblivion Gate opens (in 2 hours) ... and seals at ... | ... Dagon's faithful open a breach (in 2 hours) ... and the Covenant seals it at ... |
| Discord fall | B has fallen at the Oblivion Gate near N ... The gate collapses. | B has fallen at Dagon's Breach near N ... The breach collapses. |
| claims, record | The gate is closed in your name. Gates closed: 4. | The breach is closed in your name. Breaches closed: 4. |
| Drakes line | The gate is on your record. ... for two gates a day. | The breach is on your record. ... for two breaches a day. |
| profile, account card | Gates closed: n | Breaches closed: n |
| Broker's title and aura | ... the ember of an Oblivion Gate closed ... closed enough Gates ... | ... the ember of a breach closed ... closed enough breaches ... |
| set power | Wrath of the Warden! The gate's fire bursts from you. | Wrath of the Warden! The breach's fire bursts from you. |
| account refusal | ... closed enough Oblivion Gates ... Each gate closed pays one Sigil Stone. | ... closed enough of Dagon's Breaches ... Each breach closed pays its Deadlands Embers. |

These are WB12a's lines. Section 20 (WB13b) rewrote every one of them, and its table is the game's.

The relay's refusal WORDS (`the gate is closed`, `the gate is sealed`, `the gate is closing`, `the court is full`) are
protocol, not prose, and keep their bytes; the sentences the client makes of them name the gate, the arch, and stay.

**Deadlands Ember.** The Sigil Stone (template 570) is the **Deadlands Ember**: *a coal of the breach's fire, carried
out when the Warden falls; it does not cool and does not go out.* Only the NAME moves - the template id, its binding,
every key, field, save vendor, salt, device key, CSS class, token claim, insignia id and database column keep their
bytes (a sale, a save, a realm record and a listing all read the same). The name lives in each record, not only the
template (a stone's `name` is written when it is minted and kept by every save), so a **load repair** renames every
template-570 record under the old name - in every list a save carries, beside the rarity names' own repair - and the
crash records' pieces and the stack fold do the same; a stone minted after the change is an ember from birth, and a
merge or a split can never leave a stack with two names. The Broker counts in embers ("4 Deadlands Embers", "Not
enough Deadlands Embers", "Trades in Deadlands Embers", "The Broker's eyes never leave her embers"); the price column,
sized for "12 Sigil Stones", is re-measured for "50 Deadlands Embers" in a real browser.

**A guard**, as DRAKES pinned the old currency's name: no shipped source names an Oblivion Gate or a Sigil Stone in
player text.

### B. Mehrunes Dagon's day (WB12b) - dropped

Dropped before it shipped (Mac: *"Let's forgoe the monthly raid"*). The design was one breach in 360 - the 20th of
Sun's Dusk, every 30 real days - with the Legion-Lord always and a third trial, and double embers. Nothing of it is in
the game: every breach is fought under the day's marks from the cycle, and pays one ember.

### C. On the Burning Doors (WB12c)

A Mages Guild conjurer's account of the breaches (the text is the appendix below): what the common folk call them,
the Covenant, the faithful and their rite, the Warden, why the doors close, the Battlespire, the embers, and counsel - which tells a reader how the game works in the world's own words.

- **The book**: id **417** (the year; above the classic ids, its low byte no classic book's, under the decor law's
  0xffff), template 277 like every book, its price the classic law's own for its title (463), plain ASCII in
  Daggerfall's book format so the reader and the raum-book skin show it as any other.
- **Where it lives**: a port registry (`systems/portBooks.js`) that encodes its pages into the BOK format's own bytes,
  as `encodeRscRecord` does for the port's text records; the classic table baked from DFU is never touched. The one
  open door reads a port book from the registry before it asks for a file.
- **Where it is found**: the **booksellers** (and the general stores and pawnshops that stock books) and the
  **library shelves** (libraries, and the guild halls and temples whose shelves the Mages Guild opens) draw it at the
  odds of any other book; dungeon loot, houses, biographies and quests stay the classic books'.
- **The first breach**: the first time a character closes a breach - the first ember that enters the pack - a copy is
  handed over: *"A Mages Guild courier finds you: 'On the Burning Doors', with the Guild's compliments."* Once a
  character (its save's own record, as the Broker's and the codex's are).

**As built (WB12c):**
- `systems/portBooks.js` writes the book into the BOK format's bytes:
  - the title in the large face a title page sets (FONT0004) and the conjurer centred on the first page, then one
    page per section, its head centred over its paragraph;
  - its price is 463, the classic law for its title, worked out without moving the classic generator.
- The text is the appendix below, word for word, and a pin holds the two together.
- The one door (`ui/bookDoor.js`) reads a port book with no file asked for. It hands the reader over a microtask
  later, as a fetched file lands, so the pack has closed first.
- The shops' book draw and the library shelves' include it (1 in 93, as any book). Houses, dungeon loot, biographies
  and quests keep the classic draw.
- `systems/breachBook.js` gives it with the first ember through the breach's spoils (the court's floor, a receipt
  outside it, or the crash's records), with the courier's line in chat. A town's thanks don't bring it. A character
  who closed breaches before this gets it with their next ember.
- Pinned in `test/wb12c_burning_doors.test.js` (7); mutants in `tools/mutants/wb12c.json` (19).

### D. The faithful's rite (WB12d)

**The site.** Each breach's faithful work their rite in a circle **90-180 m from where the breach will stand**, at
least 50 degrees off either way into the arch, at a bearing and distance the day's rolls give (`riteLocalOf(day)`,
pure, so every client and the relay agree with no word sent). The circle stands on the side of the arch toward the
heart of the gate's own map pixel, 140 m or more inside its edge (156 m the least over 200,000 days), so its ground is
the pixel the gate's scan chose: land, no town, no dungeon. The scan judges whole pixels; water inside the gate's own
pixel is not looked for, and with no map data here the real map's rate is unmeasured. No rock or tree of the World of
Daggerfall stands within 20 m of the circle, and no grass grows on its burned earth.

**The window: from the omen to the opening** (about 15 real minutes - three game hours). With the omen, a **pillar of
smoke** rises from the circle, seen across the omen's ring. When the breach opens, the faithful still standing **pass
into the breach** (gone, with a line to those near), broken or not. The circle, its fires and its chest stay until the
breach collapses: the Wrath's collapse, or an early kill's.

**The look.** **Dagon's sigil burned into the earth** - its own art: a seven-pointed star in a double ring of runes,
every cut smouldering, ragged where the burn gave out, its first point toward the gate - inside a ring of six braziers
cut from the gate's stone, each with a flame; an altar stone with the smoke's own fire on it; the faithful's casket;
and behind them their tents and a camp fire (the game's own tent and fire flat, never the court's braziers). Every
other brazier's flame is a third of its flicker from its neighbour's. One steady glow at the heart reaches past the
braziers, and the camp fire has its own light. The altar, the casket and the braziers are solid.

**The faithful.** **6-8 of Dagon's faithful and a Summoner** (the day's roll), robed casters - mages, battlemages,
healers and nightblades (Daggerfall has no witch; covens are places, not mobiles) - named *Dagon's Faithful* and *the
Summoner*, in every line that names a foe. They chant at the circle, seeing 12 m, until disturbed; one woken wakes
them all (a camp's law). The Summoner has three times a caster's health. Online every player sees the same faithful:
the first to come within 100 m springs them and owns them (the World of Daggerfall camps' law), every other sees them
as the owner's. The faithful are in no save; what a character saw of them is (the slain, by kind, and the Summoner's
fall), so a circle stood again - after a teleport, a reload, an owner who left - stands only the survivors, and never a
fallen Summoner. An owner who leaves leaves them to the player at the circle after 10 s; a teleport or a closed page
hands them to the players beside them, still chanting and still one camp.

**Breaking the rite.** The rite is broken when **the Summoner falls before the breach opens**, however he fell (a
Wabbajacked Summoner's fall breaks it too). Everyone who struck one of the faithful while standing at the circle is
**one who helped**.

**The extra ember.** When the breach is **closed** (the Warden falls - not when the Covenant tears it shut), everyone
who helped **takes one more Deadlands Ember** - whether or not they fought the Warden: a challenger's receipt says so
(`r`), and one who helped but did not fight is minted a receipt of the rite alone (`x: 'rite'`) that pays that one
ember and nothing else. The account's purse counts it (the row's `stones`); a receipt of the rite alone is **not a
breach closed** (no Drakes strike, no "breaches closed"). The boss is unchanged.

**How the relay knows.** Each player at the circle says the rite's word (`t: 'rite'`) to the circle's own cell every
5 s while the rite holds, at once on a change and once more a second after: the day, whether they struck the faithful,
whether they saw the Summoner fall. The cell believes a word only from a socket whose pose stands within 60 m of the
circle the day's law places in that pixel, from the omen until 2 s past the opening (a fall seen in the last second
still counts). It keeps each circle said in it on its own, folds the helpers by account and, when the Summoner's fall
is said, tells the hub - again as more helpers are said, retried every 5 s until it answers, let go once the breach
collapses. The hub keeps each circle told, says a broken one once to everyone online and at every hello while the
circle stands (the raids' cleanse door), and the breach's room asks it for the helpers from the opening on. At the kill
it pays the circle at the gate's agreed site (two accounts said where the gate stands), or the most struck when none is
agreed.

**Honest limit, stated.** As with a raid, a word is its player's own: the relay checks where and when it was said, not
each blow. A player at the circle can say they struck the faithful and buy themselves one ember. One can say the
Summoner fell before he did: the rite reads broken for everyone then (its chest opens, and the omen's order goes
unsaid to those who join), while the faithful still stand, and everyone who strikes them is still counted and paid. A
word for a circle no breach stands by is a circle of its own and stands in no other's way.

**The chest.** In the circle stands the faithful's chest. It opens **once the rite is broken**, for each character
**once a day**: gold, two to four reagents of the rite (Sulphur, Ichor, Ectoplasm, Lich Dust, a Daedra's Heart
rarely), and a small chance (one in twenty) at **a piece of Dagon's Brand** - a Magic piece of armour bearing the set's
sigil. Anything taken from it - a whole stack, a split, a swap - spends the character's day; the chest keeps its place
and name until it is emptied, and wears *Opened* after.

**The words** (as built; each one thing, WB13b's rules):

| moment | who hears it | line |
|---|---|---|
| the omen | chat, right after the omen's line and before tonight's marks; never once the rite is broken, nor on a relay that cannot keep it | *The faithful work their rite nearby. Kill their Summoner before the breach opens.* |
| the rite broken | everyone online, once while the rite holds and its place is known (a player who joins after hears it at hello) | *The faithful's rite is broken near N, by A, B, C and 2 others.* |
| the opening | a player near the faithful still standing, broken or not | *The faithful pass into the breach.* |
| the casket | its name and state; a press while sealed | *The Faithful's Chest*, *Sealed* / *Opened*; *Sealed by the faithful's rite.* |
| a receipt of the rite alone | the claim; its ember in the pack; on the court's floor; a guest | *Rite recorded.*; *An ember from the broken rite is in your pack.*; *Your ember from the broken rite falls to the floor.*; *Rite not recorded. Add a username within a week to keep it.* |
| the classic lines | Info, the death alert, the corpse | *You see the Summoner.*; *The Summoner just died.*; *The Summoner (dead)* |
| the Overworld | the camp's mark | *Dagon's Faithful, 7* |
| Discord | the omen post, after its times; the rite broken | *The faithful work their rite nearby. Kill their Summoner before the breach opens.*; ***The faithful's rite is broken** near N, by A, B and 3 others.* |

**As built (WB12d; AUDIT WB12d below):**
- `net/gateRite.js` is the law: the site, the faithful (the Summoner a **Sorcerer**, a caster none of the faithful is,
  so every screen knows him by his kind), the window (`riteHolds` from the omen to the opening; `riteStands` to the
  collapse, an early kill's too; `riteHeard` 2 s past the opening), the word's reach (60 m) and beat (5 s), and at most
  64 helpers a circle.
- The relay (world151): the cell keeps up to 4 circles a day and the hub 8, each on its own. One fall at a time: the
  breach's room asks the hub for the helpers every 15 s from the opening, waits 2 s at most at the kill, and keeps its
  last answer. One tell in flight, its retry armed before it goes. The rite's bucket at the relay is twice the client's
  burst. At the kill, fighters who helped carry `r`; helpers who did not fight are minted the rite's own receipt.
- acct62: `r` is two embers in the purse; the rite's own receipt one, with no breach closed and no Drakes. Every claim's
  answer carries the row's embers (`stones`).
- `scenes/riteHost.js` stands the circle on the camps' law (site `px,py:rite.<day>`): the faithful spring within 100 m,
  the word is said from within 55 m, again 1 s after a change; an orphaned circle is taken after 10 s and an empty
  stand tried again after 5 s; the casket seeds within 40 m. The ground under the circle is read every 15 frames, and
  the stone and the sigil are made again when it moves (a pixel built finer). The sigil is drawn for an eye within
  250 m. (`world/riteModel.js`: the sigil riding the land's highs, its points never further apart than twice its reach;
  six braziers, the altar and the casket, sunk at their lowest corners; `world/gateArt.js riteSigilArt`.)
- `render/riteSmoke.js`: the pillar, 340 m tall and leaning the same way every day (no wind is read). Its foot is the
  altar fire's width; its billows grow as they climb and the biggest bulge its outline; it is lit as the frame is, the
  fire glowing in its first metres. It fades in over 8 s from the omen and thins over 30 s after the opening. Far off
  each octave settles to a thick mean, and a clear day's distance fog leaves it 0.6 of itself, a dark line on the
  horizon from kilometres off; weather's fog takes it whole.
- The casket (`systems/riteChest.js`): gold (20-40 a level), two to four reagents (a Daedra's Heart 8% of draws), one
  chest in twenty a Magic piece of Dagon's Brand at Faint. The day's memory (`RiteDay`) and the chest's (`RiteChest`)
  are the character's save.
- Pins `test/wb12d_rite_law.test.js` (9), `test/wb12d_rite_relay.test.js` (12), `test/wb12d_rite_world.test.js` (27),
  `test/wb12d_rite_host.test.js` (8); mutants `tools/mutants/wb12d.json` (319); Chromium `tools/riteProbe.mjs`.

### E. The caged Broker (BROKER-CAGE, 2026-10-02)

Mac: "So with the new oblivion gate update, when does the broker spawn?" - then "I say she should be present at the
site in a jailed gate, and the gate opens after all the enemies are cleared"; asked which enemies, "The rite's
faithful"; asked what happens if they are not cleared by the opening, "Stays caged"; asked how long she stays once
free, "Until midnight".

**Where and when.** The Sigil Broker (SET7, `11-Multiplayer/Sigil-Sets.md` section 7) is the faithful's prisoner. Her
cage stands **11.5 m from the circle's heart, turned 60 degrees from its bearing to the gate** - outside the braziers,
on the gate's side, away from the casket, inside the 20 m the rock keeps off (`scenes/sigilBrokerPool.js
cageSpotLocal`, the day's alone, so every client stands her in one place). She stands there **from the omen until the
Wrath's midnight** (`net/gateRite.js cageStands`), caged or free; a Warden fallen early takes the breach and its
circle, never her (the omen's `cageSite` reads the site off the day, not off the gate's standing). On a pixel not yet
built she is not stood (GATE-SEEN's law), and nothing is shut.

**The cage** (`world/cageModel.js`): 2.2 m square and 2.7 m high, cut from the gate's own stone - corner posts capped
over its frame, door jambs under its front beam and a frame of the plinth's, bars of the gate's a hand apart on three
sides and either side of a 1 m opening on the side toward the gate, bars across the top, and a barred leaf of 0.9 m
hung on the left jamb's inner face (no face of it lies over another). Its bars reach down to the lowest ground under
its corners and 0.15 m beyond (0.5 m under her feet at the least), and its door's sill stands over the highest ground
the leaf sweeps as it swings - the ground read when she moves, the meshes made again when either moves. Its walls stand
in the collider as plain slabs a bar's thickness about the bars (no body slips between two bars), a roof over them,
its shut door as another slab; the door's slab comes down the moment it opens. A wall is never stood around a body
standing where it would rise (AUDIT SET W1's law, her post's). **Her eye's box is her cage's own**, turned with it and
just beyond its walls (player/activate.js's turned box): the ray meets it before any bar, so she is pressed and named
from every side, caged or free, from right against the bars, and from inside her open doorway; it ends at her walls,
so a body lying by her cage is looted, not her.

**The door opens when every one of the faithful has fallen** - the Summoner and each of Dagon's Faithful, as many of
each career as the day stood (`riteRosterFell`) - before the breach opens. A player who saw them all fall says so in
the rite's word (`c`, beside `s` and `f`); the Summoner's fall the hub said counts as seen, so a player who came after
him and felled the rest says it too. The circle's cell keeps it beside the broken rite (every one fallen is the
Summoner fallen) and tells the hub, which says **her cage open** (`rite` `cl`) once to everyone online and at every
hello until midnight - a word the cell could not tell before an early kill's collapse is kept and said all the same.
**At a relay that says it, the hub's word alone opens her** - every screen at once, the one who struck last a moment
after the last fall - so no screen sells where another sees her caged; at an older one (world151-152) each screen
opens her on its own character's eyes; at a relay that keeps no rite (no faithful stand) she is never caged. Once the
hub says it, no faithful is stood again at that circle for anyone, and copies a page stood before the word landed are
taken down. The word is said from within 55 m of the circle (the relay believes 60), until the opening and 2 s past
it: the last of them felled further out counts once its killer comes back in time. The door swings out over 1.5 s,
eased, and a player within 60 m who saw it shut hears **"The Sigil Broker is free."**; a page that first saw her
after the hub had opened her (or whose word came within 3 s of her first frame) finds it open and hears nothing. Not
cleared by the opening, the faithful pass into the breach and **she stays caged that night**.

**The press.** Caged, her plaque reads *Sigil Broker / Caged by Dagon's Faithful*; Info and Steal are as ever; any
other press says **"Kill all of Dagon's Faithful to free her."** while the relay still hears the rite (the opening and
2 s) and **"She stays caged tonight."** after it. Free, her plaque is her trade and a press opens her window; the sale
asks that she stands free. Midnight takes her - or a page asleep across it wakes on the next day's cage: a window open
on her is shut, and she says **"The Sigil Broker leaves for the night."**

**Honest limit, stated.** The rite's own (D above): a word is its player's own. A player at the circle can say every
one of the faithful fell before they did and open the cage for everyone; the sale itself was always the buyer's
machine's (SET7). A faithful seen to fall is counted by its career on each screen, so a copy stood again by a new owner
and killed again counts twice there. The collider's own: a body thrown at any solid at 0.74 m a move or more (a
knockback, never a walk or a run) now and then comes out inside it - a whole block of stone as well as her walls.

Relay **world154** (`net/wire.js` RELAY_VERSION, `relaySupportsCage`; world153 on its branch, renumbered past main's REVENANT-WIRE at the merge - a world153 relay never says `cl`, so it is not the cage's): the word's `c`, the cell's and the hub's `cl`,
the hello's replay until midnight. An older relay ignores `c` (`validRiteIn` projects what it knows) and never says
`cl`. An older client drops `cl` (`validRiteOut` knows `br` alone). Pinned: `test/brokercage.test.js` (8) and
`test/set7_broker_world.test.js` (13, re-pinned for the cage); mutants `tools/mutants/brokercage.json` (82), set7's,
wb12d's and soc1's records the cage moved re-aimed by content. The probe `tools/brokerProbe.mjs` draws her caged from
three sides and freed, its door swung.

### AUDIT BROKER-CAGE (2026-10-02, Mac: "Audit this")

Three lanes read the change end to end - the law, the wire and the relay (R); the client at runtime (C); the cage's
geometry, the tests, the records and the docs (G, T, D) - each finding reproduced on the change as it was, fixed,
pinned red-then-green and its mutant recorded (`tools/mutants/brokercage.json`, the `AUDIT-` records).

| # | found | fixed |
|---|---|---|
| C1 | a character who did not see the Summoner fall could never see them all fall - he is never stood again once the hub says him fallen - so a breach whose Summoner's killer left kept her caged all night for everyone | the hub's broken word counts as his fall, in the word's `c` and the cage's own-eyes answer |
| C2 | caged, her box was an axis-aligned square round any turn of the cage - a player against the bars stood inside it, where a flat's box is never pressed: no press, no plaque | her cage's own turned box, just beyond its walls, a surface of its own |
| C3 | free, her box shrank to her own inside the walls - hidden by them from all but her door, which faces away from the circle | the same turned box, caged or free; a press from her doorway meets her post |
| C4 | a relay that keeps no rite stands no faithful - she was caged all night with nobody to kill | free where the relay's welcome says it keeps no rite |
| C5 | the old box reached a metre past her walls and took presses aimed at a body lying by them | the turned box ends at her walls |
| C6 | a screen freed her on its own eyes where the relay never heard them (the last of them felled 60 m out) and sold while every other screen saw her caged | at a relay that says the cage, its word alone |
| C7 | her ground was read every frame, a key string each time; the circle key every frame she was caged | read when the land moves and every 15 frames; the key made once a circle |
| C8 | a hub's word late behind a page's first sight of her swung the door and said she was free of a cage opened long before | the word's instant: opened before the page saw her shut, it neither swings nor speaks |
| C9 | measured, not a fault of hers: any solid lets a body thrown at 0.74 m a move or more through now and then | stated (the honest limit above); thicker walls made it worse and were not kept |
| C10 | no roof in the collider: a body that levitated over the cage dropped in | its roof |
| C11 | the shared clock stepping back mid-swing drew the open door shut | an open door stays open |
| C12 | a page asleep across midnight woke on the next day's cage with yesterday's window open | a new day's Broker shuts it |
| C13 | the press said "She stays caged tonight." in the 2 s the relay still hears the last fall; copies of the faithful a page stood before the hub's word stood on | the press at the relay's grace; the copies taken down |
| R1 | a cleared word its cell could not tell before an early kill's collapse was answered and dropped by the hub - and marked told | kept and said until midnight; nothing else said past the collapse |
| R2 | a tell in flight took what was owed when it went; a cleared word said meanwhile was never told (an existing single-flight flaw the cage inherited), and a hung tell held every later one off | a tell in flight arms the retry; a tell lets go at its own retry |
| R3 | the usual order - the Summoner first, the rest later - was never pinned | pinned, the hub down and back |
| R4 | the alarm's local named `riteOwed` hid the circle's own test | renamed |
| G5 | the leaf lay over the jambs' faces, the jambs through the beam, the posts' tops in the frame's plane - faces fighting | the leaf between the jambs on the left jamb's inner face, the jambs under the beam, the posts capped |
| G6 | on a slope the downhill bars stood on air, and the door swung through rising ground | the bars to the lowest corner and beyond, the sill over the ground the leaf sweeps |
| T1-T5 | pins that could not fail: a hinge equal to its own definition, a foot equal to its constant, a bar gap of constants; the front-left wall, the swing's direction and easing, the drawn turn, the top and front bars, all unpinned | each read off the built geometry or the drawn matrices |
| D | the docs' "the bars never hide her" (they did), "below" for what is above, the Ledger's "stands only by a gate", the Testing row's pre-cage text | rewritten |
| D2 | the cage's model claims a Ledger A row and the Ledger named it nowhere - `test/doctrine.test.js` failed on the change as pushed (its own run before the commit had the file untracked, and the pin reads tracked files alone) | named in the breach's Ledger row |

### Versions and the deploy

The relay's law moves to **world151** (world141 on the branch; main's CLIMB5 and CLIMB6, FRIENDS-SYNC, ELITE FOES and
the Seats arc took world141-world150 first): the words of `gateHerald.js`, the rite's word and the receipt's `r`, and
`gateLaw.js` without the three lines that named a time (TIME1 said the next relay deploy retires them; the client says
them in local time, `systems/gateOmen.js`). The brain's law stays 5. The account service moves to **acct62** (acct46 on
the branch, past main's acct46-acct61): migration 0066's `stones` (0046 on the branch) - the rite's ember in the purse -
and the claim of `r` and of a rite alone. **The order of the two deploys does not matter**
(AUDIT WB12d A1): acct62 answers every claim with the row's embers, so a fighter's `r` that acct61 counted at one ember
is made good when it is claimed again, and the game keeps an `r` receipt until a service that answers its embers has
counted it; acct61 refuses the rite's own receipt, and the game keeps that for its week. Each deploy drops connected
players once, as every relay deploy does. A game from before world151 still fights the breach (the brain's law is
unchanged): it knows nothing of the rite, never says its word, and is paid nothing for it.

### What does not change

Every mechanic of the Warden's fight; the schedule; the rotation of marks; the spoils' dice for the fight; the Broker's
wares and prices; and the bytes of every id, key and column whose name A changed. The rite adds its own: the receipt's
`r` and `x: 'rite'`, migration 0066's `stones`, the save's `RiteDay` and `RiteChest`, the relay's `rite` key. The court
is the Burning Court; the Deadlands are the Deadlands.

### AUDIT WB12d (2026-10-02, Mac: "Audit this. Its needs to be detailed and perfection. AAA grade")

WB12d audited by seven lenses over a frozen tree (`2ab3847fe`): the account service (A), the relay on the real Room
(R), the client's host - the faithful on the camps' law, the casket and the words it says (C), the law and the wire over
200,000 days (L), the words and this record against the code (D), a mutation sweep of 113 mutants over the slice (T),
and a real browser - the circle, the smoke and the sigil in headless Chromium by day, dusk, night and fog (G). Each
finding was reproduced against the real modules before anything changed. The fixes went in four batches: the relay and
the account service, the rite in the world, the rite drawn, and the record. A finding two lenses found is written once,
under both names.

| # | found | now |
|---|---|---|
| R1, L1 | **the relay checked a circle against the client's own pixel, never where the gate stands**, and the cell kept the day's first circle, the hub the first told: a word at a fake pixel took the record, the broadcast and the pay; one `s` there dropped the true fall; an `f` lie in the omen's first second broke the rite for everyone, and every client stopped standing the faithful | each circle on its own at the cell (4 a day) and the hub (8 a day); the hub stands by the gate's agreed site, kept with no herald too: the kill pays that circle, the channel names it; a client believes the word for its own circle alone and stands the faithful after it. The honest limit is stated in D |
| R2, L2 | **the kill was re-entered while the hub was asked for the helpers**: every blow and beat ran it again, minting receipts on new seeds - 13 falls for 13 blows | one fall at a time; the helpers asked every 15 s from the opening and kept on the fight; the kill's own ask waits 2 s at most and keeps the last answer |
| C1 | **a teleport poisoned the circle's site for the page's life**: its faithful never stood again for anyone online, after any fast travel, recall, death, load or ship | the site cleared by the sweep and reclaimed; leaving drops my own faithful without poisoning; what the character saw is in the save, so a circle stood again stands only the survivors, never a fallen Summoner |
| C2 | an owner who left (a closed tab, fast travel, a death, a walk) left the circle empty for everyone until the opening | after 10 s the player at the circle stands the survivors; a teleport or a closed page hands them to the players beside them |
| C3 | a handover went to the nearest peer however far, unplaced: the heir's cull took them, and they were a 'pack' | handed only within a camp's cull distance, still placed, chanting and one camp |
| C4 | the casket's once a day was beaten by taking part of a stack or swapping a piece, and a pile gone untouched seeded again: endless chests | opened is any change in the pile, piece by piece and count by count, and the day is the character's at once |
| C5 | a save kept the faithful, and a load stood them beside a fresh set: two Summoners, a reload farm | the faithful are in no save; a save's from before are known as the rite's and not stood |
| G1 | the circle built on the far ring's coarse ground kept it once its pixel was built finer: 177 of 924 sigil points buried, the columns sunk, the flames in the air | its ground read every 15 frames; the stone, the sigil, the flames and the collider made again when it moves |
| G2 | the game's grass grew through the sigil | none on the burned earth, placed again when the circle stands and when it goes |
| G3 | up close the plume was a translucent orange funnel 9 m wide round the braziers | its foot the altar fire's width, swelling slowly, fading in over its first metre; the fire a glow in its first few |
| A1, D11 | the deploy order: CI deploys world141 before acct46 while this page said the opposite, and an acct45 counted a fighter's `r` at one ember - the client let it go, and the ember was lost | the order no longer matters: every claim answers the row's embers (`stones`); an `r` row counted at one is made good when claimed again; the game keeps an `r` receipt until a service that answers its embers has counted it |
| A2, F9 | a claim of a receipt of the rite alone answered the Drakes' strike: "No Drakes for this breach" after "Rite recorded." | a rite's own claim strikes nothing and answers no Drakes |
| A3, D7 | a guest's rite receipt was told "Breach not recorded"; the relay's comment said a guest is handed no receipt | *Rite not recorded. Add a username within a week to keep it.*; the comment says the week it is kept |
| A4 | the Broker's card and refusal said the title and the aura are paid from "breaches closed", which a rite's ember is not; the insignia law and the claim's answer named one stone a kill | *Paid from your account's embers.*; *Your account has too few embers for that.*; the comments name the row's `stones` |
| R3 | a tell the hub refused was retried every 5 s forever (2,001 tells by the third hour) | let go once its breach collapses; the hub takes a late tell silently |
| R4 | every word started its own tell: six `f` words said the rite broken six times | one tell in flight; a word that moves nothing tells nothing |
| R5 | the retry was armed only after a failed tell: a reset mid-tell never told | armed before it goes |
| R6 | the Discord post named only those known at the first tell | named when it is posted |
| R7, L7 | the circle stood to the Wrath's collapse after an early kill | `riteStands` reads the kill: the circle goes with its breach |
| R8, L4 | a fall said in the rite's last second could be lost, and the relay's bucket was the client's, so a stalled socket's bunched words were dropped | believed 2 s past the opening; the relay's burst twice the client's; the client says a change again a second later, from 55 m (the relay believes 60) |
| S1 | two tells landing together each read a fresh day, and both said it | read and written with no await between |
| S2 | the court's fight record with 64 rite receipts is 167 KB - over a Durable Object value's 128 KiB? | not so: the Room is SQLite-backed (`server/wrangler.toml` v1), whose values hold 2 MB; the world chunk's note now says the 128 KiB is the key-value backend's |
| C6 | across a seam's promotion a halo socket lost its rite word (and its raid word) | each socket keeps its own |
| C7, D1 | a page opened after the break heard "The faithful's rite in the wilds is broken", then the omen and its order | the broken word said once while the rite holds and its place is known; never the order once broken |
| C8 | the omen's order was said over a broken rite | skipped once the hub says it broken |
| C9, D8 | after a partial take the casket's target came back over the pile and swallowed presses, and the pile lost the chest's name | the casket's target gone while the pile holds anything; the pile keeps its name until it is emptied |
| C10, G10 | the stone's GPU mesh leaked at every teleport and day | freed on leaving and on remaking |
| C11 | a Wabbajacked Summoner lost his site: the rite could not break | the changed foe keeps his site and his part |
| C12 | the near line again after each teleport | the near line is cut (D5); the opening's line once a day, in the save |
| C13 | garbage every frame while the circle stood | none: fixed lights, the word made only when due, numeric keys |
| C14 | the site id had no day: one day's lost site and claims carried into the next day's circle on the same pixel | the site is `px,py:rite.<day>` |
| C15 | the faithful's bodies by class ("Sorcerer (dead)"), the Overworld's mark "Mage pack, 7" | *The Summoner (dead)*; *Dagon's Faithful, 7* |
| L3 | the helpers asked once at the kill, with no bound: a 503 lost every `r` | asked from the opening, bounded at the kill (R2) |
| L5, D9 | a WB12d client on an older relay said the omen's order and stood the faithful; its words never left; the casket stayed sealed | the order and the faithful only on a relay that keeps the rite |
| L6 | the circle could stand in a neighbour pixel's shallows (7-11% of coast days on a synthetic coast) while this page said its ground was checked | it stands toward its pixel's heart, 140 m or more inside the pixel's edge (156 m the least over 200,000 days); this page says what is and is not checked |
| L8 | `validRiteOut` cut the names to 8 before it dropped junk: 8 junk entries hid a real name | junk dropped first |
| D2 | the classic lines named the Summoner by his class: "You see a Sorcerer.", "Sorcerer just died." | *You see the Summoner.*; *The Summoner just died.*; *The Summoner (dead)* |
| D3 | the omen's order repeated the omen, explained a mechanic ("for an ember more"), came after the marks with its "nearby" dangling, and differed from the Discord post's | *The faithful work their rite nearby. Kill their Summoner before the breach opens.* - one sentence for the chat and the channel (`RITE_OMEN_LINE`), right after the omen and before the marks |
| D4 | the broken line named the long place; Discord's named no count; the names reached clients unsaid | *The faithful's rite is broken near N, by A, B, C and 2 others.*, the post the same |
| D5 | the near line said what the screen shows: "Chanting rises from the smoke." | cut |
| D6 | a broken rite's survivors vanished at the opening without a word | *The faithful pass into the breach.*, broken or not |
| D10 | this page said a game from before world141 is refused at the breach | it is not (the brain's law is 5); it fights, knows nothing of the rite, and this page says so |
| D12 | world141's version row did not name WB12d | named |
| D13 | this page said the circle's fires were lit as the court's braziers | the camp's own flame and tent, said so |
| D14 | "while the rite stands", "tells the hub once", the honest limit understated | holds; again as more are said; the limit stated |
| D15 | "What does not change" false after the rite; section 6's receipt without `l`, `r` and the rite; section 7's ember "one a kill" | each rewritten |
| D16, G13 | Rendering.md said the plume leans downwind; no wind is read | the same lean every day, said so |
| D17 | Active-Arcs had no entry for sections 19 and 20 | added |
| D18 | the word-rule test never read the rite's lines | it does |
| D19 | the record never said what was seen in a browser | Seen and Not seen, below |
| D20 | a rite's helper's ember in the court spilled with the fight's line | *Your ember from the broken rite falls to the floor.* |
| D21 | comments: the ring "first opposite the gate", the smoke "yesterday's fading beside it", the circle "until its breach collapses", the omen's "ONE line", the casket "said once", the smoke "rises over 8 s" | each says what the code does |
| D22 | "half-blind", "the claim's stones", no late joiner and no *Opened*, 19 A's table with no pointer to WB13b, the Port-Ledger's "WB12a-d", a Testing row missing a test, relay test titles naming mutants that were not there | each mended |
| F1-F7 | the sweep's 113 mutants left 102 alive on the frozen tree (85 of them real): the relay's `s` check, yesterday's helpers at today's kill, any day past the first, the Summoner's career in the tally, the site filter, the site regex, the Broker's sale against the purse | pinned in the first two batches. The sweep was run again on the finished tree: 29 died as they stood, 63 had moved and were re-aimed at the same behaviour, 8 were retired with the code they mutated (the near line, D5; the nearest three lights, G7; a broken rite stopping a stand, R1; a dead waker the tally no longer reaches) - and 37 lived. Each is pinned now: the bible's own numbers (a word from 60 m, every 5 s; the faithful within 100 m; the smoke in 8 s and out in 30; the chest's two to four, its heart 8%, its Brand one in twenty at Faint), the hub's bounds, the channel's retry, the wire's edges, a halo's own welcome. 69 dead; 4 recorded equivalent, none reachable: an older day's word, an older day's tell, the hello's replay outside the hub, an account with no subject |
| F8 | `test/fakeRoom.mjs` stored by reference where the runtime copies | stores copies, and spends an alarm as its handler begins |
| F10-F22 | the chest's save, the alarm's sooner rule, the hub told again, the swept prefixes, the rate gate, the post, the halo, the host's edges, the casket's, the near line, the chest's contents, numbers pinned only against themselves, the layout's seams | pinned with F1-F7's |
| T, weak pins | pins that could not fail: the law's site checked against itself, "behind the altar" with no geometry, the claim's verdict as two lines of its source, relay test titles naming mutants that were not there | the law's own answer for one day written down; the Summoner's place measured behind the altar; the claim driven through the device's queue; the titles mended |
| G4 | no collider: players, the faithful, arrows and the camera passed through the altar, casket and columns | solid |
| G5 | the sigil lay up to 0.285 m over a 0.3 slope, a dark plank the faithful's feet sank into | a finer drape and a nearer reach: 0.19 m at most there, no two of its points further apart than twice its reach |
| G6 | the sigil z-fought from the travel view | drawn for an eye within 250 m |
| G7 | the nearest three of seven lights changed six times a lap | two steady lights |
| G8 | the smoke unlit: a pale ghost at night | lit as the frame is, never under 6% |
| G9 | the fog's floor held in weather's fog too: a third of the plume through a whiteout | the floor in a clear day's distance alone, 0.6 of it (0.35 left a pale line at 1.5 km); far off, each octave settles to a thick mean |
| G11 | the sigil wore the plinth's flags, a paved plaza, its art unturned | its own art: Dagon's seven-pointed star in a double ring of runes, every cut smouldering, ragged at its rim; turned with the altar, its first point toward the gate |
| G12 | WoD boulders through the altar and the tents | a 20 m clearing at the circle |
| G14 | the smoke's pass built in its first draw drew nothing, so the host's foreign-pass mark never came: a stale VAO and one draw lost | built by the frame, before the renderer's, at one threshold |
| G15 | looking up from inside the old funnel, two full-screen layers of noise | the foot narrowed (G3): an eye is inside the plume only at the altar |
| G16 | the far ring cannot hide the smoke 4.5-6 km off | kept, as the gate's beacon keeps it: the far ring draws at the far plane, so it hides nothing behind it |
| G17 | the plume a corkscrew, its noise one sheet sliding at 5.7 m/s - and, seen in Chromium, cells 34 m tall on a column 2 m wide: a searchlight's streaks | its rows and noise on the billows' own height, growing as they climb; its outline bulging with its own first octave and rising with it; its edge thin where its own surface turns from the eye; each octave its own whole climb |
| G18 | a failed build retried every frame | not again until its ground moves |
| G19 | a brazier's six faces one strip of the stone and its cap a tenth of the art; the flames in lockstep; the camp's fire 0.8 of a camp fire | each face its own strip, the cap a patch as wide; every other brazier's flame its own batch, a third of the flicker apart; the camp's fire a camp fire's |

Seen in Chromium (`tools/riteProbe.mjs`, 14 checks, SwiftShader's WebGL2): the smoke's program compiles and links, its
light a live uniform; from 30 m, the fire glowing over the altar and gone a few metres up, the smoke dark there; from
400 m and 1.5 km on a clear day, a dark leaning plume whose billows grow as it climbs, 40% darker than the sky; at
night, darker than its sky; in weather's fog, gone; from under it at the altar, soft folds and no hard ring; the sigil
from above, burned earth ragged at its rim, the star's first point toward the gate, its cuts alight, the land past its
rim. Not seen: the game's own art for the flames and the tents (this container has no ARENA2), a real map's coast under
a circle, the faithful in a fight, and the hub's word and the chest on the deployed relay and service (world141 and
acct46 are not deployed).

Pinned in `test/wb12d_rite_relay.test.js` (12), `test/wb12d_rite_law.test.js` (9), `test/wb12d_rite_world.test.js`
(27), `test/wb12d_rite_host.test.js` (8, the real foe pool and the world's camp law end to end) and
`test/gateclear.test.js` (+1); mutants `tools/mutants/wb12d.json` (319, every one dead but 5 recorded equivalent).
Re-aimed: discordgates', wb5b's, wb8c's and wb13b's omen and claim pins; the auditpace, auditpscale1, cursesync,
discordgates, gateclear, loot7 and survtiers3 lists. world141 re-hashed in place (undeployed).

### Appendix - On the Burning Doors

*By Ysolde Marnhel, Master Conjurer of the Mages Guild, Wayrest.*

> Every day now, somewhere in the wilds of the Bay, the sky catches fire. Herders swear to a door of black stone that
> rises where no stone stood, its arch full of flame, and to a lord of the Deadlands who waits within. The common folk
> call these the doors of Oblivion and bar their shutters. They are right to bar them, and wrong about nearly
> everything else.
>
> **The Covenant.** Since the days of Saint Alessia, Akatosh has kept a covenant with the blood of the Emperors. While
> a Septim wears the Amulet of Kings and the Dragonfires burn in the Temple of the One, no Prince of Oblivion may force
> his way into Tamriel. Our Emperor Uriel, seventh of that name, sits the Ruby Throne, and the fires burn. No invasion
> comes. But the Covenant was made to bar a door forced from without. It was never made to bar a door opened from
> within. Every apprentice who calls a scamp into a circle proves as much, and every coven of the Bay that calls a
> Prince on his own day proves it more loudly.
>
> **The faithful.** Mehrunes Dagon, Prince of Destruction, has never lacked for worshippers in a land as quarrelsome
> as ours. His faithful keep to the wilds, and to a rite older than Wayrest. They gather about a ring of braziers, burn
> his sigil into the earth, and bleed for him. What opens is not a gate as the Daedra raise them in their own realms.
> It is a breach: a wound in the world, held open by the will of the Prince and the blood of his faithful, and by
> nothing else.
>
> **The Warden.** No Prince walks through such a wound himself. He sends a lord of his house to hold it, a Dremora of
> the rank they call valkynaz, and the one who answers most often in our Bay names himself Ruhn. Among the faithful he
> is the Warden of the Burning Gate. I have spoken with three who stood before him and lived. They agree that he is
> very large, that he burns, and that he does not tire.
>
> **Why the doors close.** Here the Covenant shows its teeth. A breach is a door the Dragonfires did not permit, and
> they will not suffer it long. From the hour it opens the Covenant presses upon it like a hand upon a wound. Within
> two hours it is sealed; two hours after, it collapses entirely, and whatever of Dagon's remains on our side is cast
> back into the Deadlands. Should the Warden fall before then, the breach fails at once. It is his will that holds the
> door.
>
> **The Battlespire.** I am asked whether the Prince has done such a thing before. He has, and worse. In the years of
> the false Emperor his legions took the Battlespire itself, where the Empire trained its battlemages, and held it
> until a single apprentice drove them out. Not since the Battlespire fell has Dagon found doors so wide as these.
>
> **The embers.** Those who close a breach carry out coals of its fire. They do not cool and they do not go out, and in
> the Guild we call them Deadlands embers. The Guild will buy them for study. A certain Broker of the wilds pays
> better, and asks fewer questions.
>
> **Counsel.** If you would close a door, find the faithful first. Their circle stands within sight of where the breach
> will open, and their smoke rises with the first omen. No one coven opens a breach - the Prince presses on that place
> from his side, and the faithful only widen the wound - so their door will open whatever you do. But cut down their
> Summoner before the rite is done, and the fire of the broken rite clings to those who broke it: when the door is
> closed, it pays each of them an ember more. What the faithful keep in their circle is yours as well. Do not go alone.
> Do not stand where the ground glows. And when the Covenant closes the door, do not be on the wrong side of it.

## 20. The polish (WB13, 2026-10-01)

Mac: *"Let's forgoe the monthly raid. Instead, as we progress through this integration, I just want to continue to
improve the boss, hone in telegraphs, and just overall bring more AAA grade polish to what is already developed. Also
clean up text to be less explanatory and less AI."*

Four lanes looked at what ships, in Chromium, before anything was changed:
- **The telegraphs:** every shape at a player's eye and from above, at each moment of its wind-up, under every aspect,
  overlapping, at a distance and on a phone.
- **The fight's feel:** beat by beat, with the screen coverage of each shape measured from where a fighter stands and
  the brain's choices simulated.
- **The HUD:** both skins at 1280x720, 390x844 and 844x390, filmed in motion.
- **The words:** 330 strings, each traced to the tests that hold it.

Six slices follow. The rule for all of them: nothing gets faster (Mac, WBX: *"I dont think making mechanics faster is
the play"*), and what a player must do is shown before it is said.

### WB13a. The telegraphs

| # | found | now |
|---|---|---|
| T1 | **burning ground drawn ten marks a group, the newest dropped** - two phase-three Hellfires on five fighters left ten live pools invisible, and they still bit | a full group starts another: every live pool is drawn |
| T2 | **the Flame Nova could not be escaped from the outer floor**: its ring ran 4-30 m on a 24 m floor, so with him at the heart (every phase turn puts him there) 26% of the floor in phase two and 47% in phase three was out of reach at 7.6 m/s. The escape law measured from the ring's middle | the ring runs **4-16 m**: safe at his feet, or past 16 m - from anywhere inside it, the nearer edge is 6 m off at most (0.8 s). The escape law walks every point of the floor |
| T3 | the fill reached the floor's edge early (the Nova and the Spokes ran 30 m on a 24 m floor; the near spoke filled at half its wind-up) | the fill runs to where the shape meets the rim, so it reaches the edge at the landing |
| T4 | **the outline dimmed as danger neared** (the fuse burned 90% of it down by 90% of the wind-up), a brighter false edge moved inside it, and it faded in over 150 ms | one outline, the brightest line of the shape, full from the first frame with a short pop; the fill eases in behind it |
| T5 | **no landing**: the last 350 ms flooded the shape at the landing's own brightness, and the Cleave, the Charge and the Spokes threw no burst | the last 180 ms brightens the rim alone; the landing flashes white-hot and decays to a scorch in about 300 ms; the Charge's flash follows his head down the lane |
| T6 | burning ground looked like a pending attack and outshone it; the Sappers' paths and the Ward-Bearers' tethers looked like fire | ground is terrain - darker, a dashed rim, a slow seethe, no halo; paths and tethers are dashes flowing toward him |
| T7 | his mark was the brightest thing on the floor, and inside a shape centred on him it read as a safe heart | a dashed, dimmer ring; the chevron kept |
| T8 | **the element replaced the danger colour**: Rime, Storm and Venom outlines went grey, mauve and olive on the red floor, and blue reads as safe | every pending outline wears one danger edge (Dagon's crimson for his own blows); the element lives in the fill and the grain |
| T9 | at the Nova's word the brightest line was the edge of its safe heart - it read as a Slam and sent fighters outward | the safe edge is cool, the danger field fills from the first frame |
| T10 | the outline was a 41 px band at the sides and thin near and far | anti-aliased by the edge's own derivative, with a dark keyline outside it |
| T11 | flashing over 3 Hz (the throb's last 45%, Storm's crackle at 12 Hz) and the frost lattice shimmering | the throb on the rim only, at 3 Hz at most; the crackle at 4 Hz; the grain fades with distance |
| T12 | every shockwave ran 9.9 m - a Bite's swept five times its size, the Nova's ran through its safe heart | the wave is sized to its shape, and never enters a safe heart |
| T13 | **in first person at sword reach the Cleave's shape is 0% of the frame** and the Slam's 8% | **in it**: while your feet stand in a pending shape, the screen's rim pulses in the danger colour and the attack's name and MOVE stand under the crosshair, with an arrow to the nearest way out |
| T14 | every pass drew the whole 49 m court - 1.65M fragments a Legion-Lord frame on a phone | a quad per shape, sized to it |

The hit law does not move except T2's ring: what lands is what the ground shows.

**As built** (`render/gateTelegraph.js`, `scenes/gateCourt.js` perilAt, `ui/gateGroundView.js`, `scenes/gateHost.js`,
`net/gateBrain.js` ATTACKS.nova):
- The shader was rewritten from the lane's prototype, rendered beside the shipped one in Chromium.
- The cone's edge is one continuous distance, so its line can be read off its own derivative (AUDIT WB9 F1's jump is
  gone).
- The blend is premultiplied (`blendFuncSeparate(ONE, ONE_MINUS_SRC_ALPHA, ZERO, ONE)`), so the frame's alpha is
  untouched.
- The line shows from the word (`alpha` is the afterglow's fade alone).
- The landing decays over 90 ms.
- The Charge's landing follows `runS`.
- Paths and tethers are `TELEGRAPH_POOL.path`.
- The quad is 0..1, laid over `telegraphQuadOver`.
- **In it** reads my feet against his blow in flight (never the whole floor's) and his host's, landing soonest first.
  It finds the way out over 24 bearings in 0.25 m steps, on the floor. It turns the way out by the camera's yaw
  (`scenes/world.js` cam.yaw), and the ground view draws it as a chevron 72 px out from the crosshair.
- Pinned: `test/wb13a_telegraphs.test.js` (13), and the re-pinned WB4, WB9d, WB9e and AUDIT WB9 laws.
- AUDIT WB9's shader harness takes every derivative the shader asks for (it took one).
- Mutants: `tools/mutants/wb13a.json` (22).
- Seven older records were re-aimed by content (the fuse's is gone with the fuse).

### WB13b. The words

Every line the feature says, traced to the tests that hold it and rewritten to say one thing and stop:
1. The event, then where, when or what to do. No second sentence that explains or comments.
2. Colons only in label rows ("Breaches closed: 4"), never "Name: explanation".
3. No "X, not Y". No dash asides; " - " only between a label and its value.
4. Lists only where there is a list. No rhythm of three for its own sake.
5. Nothing the screen already shows: the ring, the bar, the card and the countdowns carry state.
6. Orders are short imperatives, one exclamation at most.
7. The effect, not the sensation.
8. Numbers as numerals; game time with the player's own beside it (TIME1, at the merge with main: the player's own alone).
9. The lore nouns exact: Dagon's Breach, the Covenant, Dagon's faithful, the Deadlands, the Burning Court, Deadlands
   Embers, Valkynaz Ruhn.

What changes beyond the wording:
- Chat names the marks ("Valkynaz Ruhn comes the Rime-Wrought tonight, Colossal and Unyielding."); the card and the bar
  say what each does.
- The line on stepping into the court is cut: the card shows the marks at that moment.
- The card has one subtitle near the gate and inside.
- A phase turn is a title and one order (WB13e).
- A screen that never found the site says "in the wilds", as Discord does, not "near the wilds".

**As built:**
- The omen, rise and open lines say the event, where and when (*"The sky burns near Copperham. Dagon's faithful open a
  breach at 20:00 (14:32 your time)."*; since TIME1, at the merge, *"... open a breach at 14:32 your time."*).
- The rise line no longer contradicts itself ("has torn open... It opens in").
- The marks line names the marks. The aspects' omens lose their "X, not Y"; the arrival and floor words are gone.
- Every trial reads as one statement with its number ("deal 25% more", "heals him 3%"). Every tip is one order.
- The court's strike, Reckoning, host and refusal lines are one event each, the dash asides now full stops.
- The Discord omen has two sentences for the two times and the chat's marks sentence; the kill post is the chat's own
  sentence.
- The claim, Drakes and account refusals are shorter. The Broker's window, insignia, dismantle and set powers say the
  event and stop.
- The notice board's card says where and the countdown's state.
- The relay's protocol words, the save and token keys and Daggerfall's own lines are unchanged.
- Pinned:
  - `test/wb13b_words.test.js`: the style as a law over 85 lines of the tables, and the design changes.
  - 30 older pins re-aimed to the new words.
- Mutants: `tools/mutants/wb13b.json` (11); eight older records re-aimed. AUDIT WB11 M1's law (Imps capitalised) holds
  on the trial's line.

### WB13c. The HUD

**Broken, fixed first:**
- On a landscape phone the marks card and the damage chart covered his bar and ran off the top of the screen, and the
  bar's callout sat on the crosshair.
- The card near the gate and the chart covered the party frames.
- A phone could never open the map's card for the breach.
- His bar stood over the step-through fire.

**The bar:**
- A trailing damage segment (`ui/barLoss.js`, the vitals' and the foes' own), and a smooth drain in place of 180 ms
  steps.
- The ward as a state: it fades in, a gold cage, the fill dimmed under it, and a flash when it fails.
- Callouts enter and leave, with a line that fills to the landing. Dagon's Wrath and the Reckoning get a red plate, and
  MOVE shows when a blow is aimed at you.
- The phase ticks show which phases are spent.
- His name on one line, the epithet beneath it.
- The marks row is a sign and a name each.
- The foot is chips, with the Wrath's timer pulsing under a minute.
- FELLED, then the bar fades.

**The rest:**
- The Plus skin dresses the ground warning.
- Numbers are tabular.
- The classic face is loaded by the gate's own screens.
- Small classic text is larger.
- The bar sits lower on a portrait phone.
- The chart drops two columns on narrow screens and enters row by row.

**As built:**
- The bar (`ui/gateBossBar.js`):
  - A trailing segment behind the fill, held 0.55 s and drained at 70% a second (`ui/barLoss.js`). The fill eases over
    250 ms.
  - The ward is a class. The cage fades in over 160 ms, the fill dims under it, and its failing flashes the track for
    250 ms. "Warded" is in the ward's gold.
  - Callouts come in over 140 ms and fade over 160 ms, keeping their words, plate and line until they are gone. The
    line under each fills with the wind-up and is full at the landing.
  - Dagon's Wrath and the Reckoning stand on a red plate pulsing at 2 Hz.
  - MOVE stands beside his blow's name while it is aimed at your feet (`scenes/gateCourt.js` perilAt, the ground
    warning's own).
  - A phase mark flashes for 400 ms as he crosses it, then stays dim. A mark crossed before you came never flashes.
  - His name stands alone; his epithet is beneath it, in his aspect's colour. The Warden unmarked has his title there.
  - Each mark is a sign and a name. The row wraps on a narrow phone.
  - The foot is a chip each: the fighters, his host, the next Reckoning, and the Wrath's countdown, red and pulsing in
    its last minute.
  - FELLED holds for 1.2 s, then the bar fades over 0.5 s as the damage chart comes in.
  - His name and health come up on the bar's first showing in a fight. A fight that ends resets the bar.
  - Each one-shot flash is timed by the fight's clock and then removed, so showing the HUD again never replays it.
- The layouts:
  - The bar sits at 72 px on a portrait phone. On a landscape phone it sits at 44 px and drops its marks row.
  - On a landscape phone the card stands at the foot on the left without its tips. The chart stands on the left under
    the menu button, in the narrow grid.
  - The bar is hidden under the step-through fire.
  - With the party frames up, the card and the chart stand beside them on screens 900 px or wider. On a portrait phone
    the card moves under the bar and the chart to where the bar was.
  - The chart drops Blows and Best under 1000 px.
  - The chart's rows come in 40 ms apart, each bar growing over 600 ms.
- The map: tapping a mark that has a card shows the card and its label for 4 s (`ui/heldMap.js`).
- Type:
  - Every gate screen loads the classic face itself.
  - Figures are lining and tabular.
  - The card's lines and tips are 13 px and upright.
  - The Plus skin dresses the ground warning, the new parts and a lit ward cage.
- Not done from the audit: the falling chunks, a flash on my own hit before the relay's word, the gate card collapsing
  to a strip, and shorter callout words.
- Pinned: `test/wb13c_hud.test.js` (10) and the map's tap in `test/eventtip.test.js`. Seven older test files
  re-pinned.
- Mutants: `tools/mutants/wb13c.json` (29). Five older records re-aimed.
- Seen in Chromium at 1280x720, 390x844 and 844x390 in both skins.

### WB13d. The blows

- **His body:**
  - He flashes when struck, fully for your blows and lightly for the court's.
  - So does his host.
  - A blow into his ward says *Warded*, not a number.
- **Your body:** his heavy elemental blows shake the camera as his physical ones do, and so do landings near you, by
  how near. The player's own shake setting caps it.
- **Light:** each landing lights the floor where it lands, not his chest.
- **Sound:** a release sound 350 ms before each landing, and the wind-up barks spread at least four semitones apart.
- **His fire:** his cast pose for his fire, not his sword's.
- **The meteor:** seen falling, longer and lower.
- **No hit-stop:** the port has none, and a frozen frame online reads as lag.

**As built:**
- His body flashes on the game's own curve (`systems/hitFlash.js`). My blows flash him fully. The court's flash him at
  0.4: a fall in his health of 0.3% of his whole or more, as the relay reports it. His host's bodies flash the same way
  on any fall in their health. His falling body never flashes.
- A blow into his ward shows *Warded* in the ward's gold, never a number.
- His elemental blows shake the camera as his physical ones do and still never flash (`ui/damageFlash.js`
  shakePlayerDamage).
- His landings shake it by how near they fall (`world/gateBoss.js` LAND_SHAKE):
  - Slam and Leap: 2.5, fading to nothing at 12 m.
  - The bound: 4, to 25 m.
  - The Meteor: 3.5, to 15 m.
  - The Nova: 2, to 24 m.
  - The Wrath and the Reckoning: 6, everywhere.
  - The player's own shake setting caps it.
- His own landings light the floor at his feet. The Meteor and the Hellfire light the floor where they land for
  450 ms (3.0 over 16 m, 1.2 over 7 m) and leave him his ember.
- A release sound plays 350 ms before each landing: a low blade swing, a body's fall for his weight, or his fire's cast
  at 1.1 (his aspect's under an aspect).
- Wind-ups that share a clip are at least four semitones apart: Cleave 0.96, Slam 0.76, Leap 0.6 and Spokes 0.47 on his
  bark; Hellfire 0.8, Nova 0.63 and Meteor 0.5 on his cast.
- His fire uses the Daedra Lord's spell frames: frame 1 held through the wind-up, frame 3 as it lands.
- The meteor falls for 1700 ms at 35 degrees, from the same side.
- No relay change.
- Pinned in `test/wb13d_blows.test.js` (10), with WB4 and WB9e re-pinned.
- Mutants in `tools/mutants/wb13d.json` (28), with three older records re-aimed.

### WB13e. The beats

- **His wake:** the opening's end is said in the state, and a roar, a flare and his name come as he moves.
- **A phase turn:** a title card ("II - The Burning Court"), its one order kept until he lands, and the roar after
  the bark instead of over it.
- **His fall is an event:**
  - a burst, a flash and a shake;
  - he sinks into a column of embers and leaves his body;
  - the spoils come after his body meets the floor, under a banner.
- **The Wrath:** a line a minute out and another at its wind-up, the court reddening over the six seconds, then white.
- **Under 10%:** his ember sputters and the bar pulses.
- **Aimed at you:** a Meteor or a Leap aimed where you stand says so with a sting.
- **Lines that stay readable:** a line on the middle of the screen stays for its length (WB13b keeps them short).

**As built:**
- The card is `ui/gateTitleCard.js`. It sits over the middle of the screen, above the crosshair and clear of his bar,
  and hides with the HUD and under the step-through fire.
- His wake:
  - The relay's state says when the opening ends (`op`).
  - 1.2 s before then: his roar, his ember flaring over 1.5 s, and the card (his title, his name, his epithet).
  - A screen that arrives later, or an older relay, gets no wake.
- A phase turn:
  - The card shows the numeral, the phase's name and its one order ("Follow him over the walkway.", "Follow him to the
    last court.") until the bound lands.
  - Nothing is said beside it.
  - His roar comes 600 ms after the bound's bark.
- His fall:
  - At the kill: a burst of Dagon's size, the court's light white for 400 ms, and a shake of 4.
  - His hurt frames play until his body meets the floor at 1.5 s.
  - Then three ember bursts rise 250 ms apart as he sinks 1.5 m into the stone.
  - His corpse stays where he fell, at three times its size.
  - The spoils come at 1.7 s instead of 0.5 s, under a 3 s card: his name over *Felled*.
  - A screen that arrives later sees his body, and nothing is replayed.
- The Wrath:
  - A minute out (only while that is news): "Dagon's Wrath in 1:00. Bring him down!"
  - As it gathers: "Dagon's Wrath!"
  - His court's light reddens over the wind-up and turns white as it lands.
- Under 10% health his ember sputters in 90 ms steps and sheds a spark every 500 ms, and the bar pulses.
- A Meteor or a Leap called on the ground you stand on plays a sting at its word: the parry's ring, high, at your feet.
- The court's lines in the middle of the screen stay up for their length: 3.5 words a second, 1.5 to 6 s.
- Not done: marking the nearest teammate for everyone else when a blow is aimed at them, and a white screen flash
  (the court's light does it instead).
- The relay is world141, re-hashed in place for `op`. The brain's law stays 5.
- Pinned in `test/wb13e_beats.test.js` (8), with WB3, WB4, WB7, WB8c, WBX, GATE-UX and WB13b re-pinned.
- Mutants in `tools/mutants/wb13e.json` (26), with four older records re-aimed.

### WB13f. The rhythm

- **No attack more than twice running.** With the fighters spread out, phase one was the Charge in 36 of 50 attacks,
  28 of them back to back.
- **Heavy blows recover longer, in a spent pose you can punish:**
  - Slam 1.1 to 1.7 s
  - Leap 0.9 to 1.5 s
  - Nova 1.3 to 1.9 s

  Slower, never faster.

**As built:**
- The last attack is left out while anything else reaches (`REPEAT_MAX` 2). Past twice running, nothing reaches, and
  he walks at his target.
- Six seconds of walking break the run (`REPEAT_WALK_MS`, 19 m of his walk). Without that, a fighter who stayed past
  7 m in phase one would never be attacked again: only the Charge reaches that far.
- Over 40 seeded fights with three fighters spread out:
  - the Charge fell from 74% of his attacks to 58%;
  - the same attack back to back fell from 56% to 35%;
  - one fighter who keeps away is charged 10 times a minute (15 before).
- Slam, Leap and Nova recover in 1.7, 1.5 and 1.9 s. No other recovery changed.
- Spent: after the landing's three frames, the Slam and the Leap hold his swing's last frame, and the Nova its
  casting frame, until the recovery ends. My blows don't make him flinch out of it.
- The relay is world141, re-hashed in place. The brain's law stays 5: each screen holds the spent pose from its own
  table.
- Pinned in `test/wb13f_rhythm.test.js` (5), with WB4 re-pinned: the Slam's recovery is spent now, not idle.
- Mutants in `tools/mutants/wb13f.json` (14).

### Versions

The relay stays **world141**, never deployed, re-hashed in place for T2's ring, the words in its bundle, the
opening's end and the rhythm. The brain's law stays 5: each screen judges its own feet, so an older game fights the
older ring until it reloads. Nothing changes in the account service.

## Shipped

**WB1 (2026-09-25) - the omen.** `net/gateLaw.js` (the schedule, the room's key and window, the rolls, the boss table,
the chat's words), `systems/gateSite.js` (the site over the map files), `systems/gateOmen.js` (each moment's line once,
the map's mark, the compass's), `ui/gateMapMark.js` with the ring on both maps (`ui/inkMap.js paintGateRing`, the held
map's poll and legend, the classic page's texels on the open province), the compass's diamond (`ui/enhancedHud.js
drawGateMark`), and `scenes/world.js` (`gateOmen`, `gateFrame` in the online frame before the dead return,
`gateCompassMark`, the travel map's `gate`). Two changes from the page above, both the pins' finds: the province is a
SHUFFLE BAG, not a bare roll (a bare roll's "never the day before's" repeated after its own bump), and the classic
page's ring band is a whole pixel (0.75 left as few as four texels). No relay change. Pins
`test/wb1_gate_omen.test.js` (13); mutants `tools/mutants/wb1.json` (30 dead, 1 equivalent). Not seen in a browser:
this container has no ARENA2 and no relay session; the site's real-data behaviour (which provinces qualify, how many
pixels each offers) is the first thing to look at on a live omen.

**WB2 (2026-09-25) - the gate.** `world/gateModel.js` and `world/gateArt.js` (the stone and its art, all made in code -
two ridged horns rising 16 m from a stepped plinth, spines down their backs, claws gripping the step, lesser spires
round the rim clear of the ways in, basalt split by veins of fire and a ring of runes under the threshold),
`render/gatePass.js` (the fire in the arch - an ember sealed, a blaze open, masked to the opening measured off the
mesh - and the beacon from its crown, widening with distance so it still stands on the sky a kilometre off),
`scenes/gatePool.js` (the gate stood each exterior frame where the omen says, rising and sinking with the clock, its
collider once risen, its light, the eye's box on the fire alone, the door and the walk through the fire, the countdown
over the screen within 60 m - `ui/gateBanner.js`), the activation race's `gate` family, and the world host's seams.
The door answers *The gate will not open to you yet.* until WB3's relay. Pins `test/wb2_gate.test.js` (13); mutants
`tools/mutants/wb2.json` (28 dead); `tools/gatePassProbe.mjs` compiles, links and draws the pass in a real WebGL2 (9
checks). Seen in a headless browser with its own stand-in lighting (the stone, its art, the fire and the beacon); not
yet in the game with ARENA2, where the renderer's own lighting, fog and the terrain under it are the next look.

**WB3a (2026-09-25) - the boss room on the relay.** `net/gateBrain.js` (the fight as pure law, stepped by the relay's
alarm every 250 ms - the numbers a claim sets, the join, every refusal a blow meets, the walk, the six attacks, the
phases, the wrath, who earned a receipt), `net/gateReceipt.js` (the relay's first signature; unsigned without its
key), the `gate` frame both ways in `net/wire.js`, the Room's gate arm in `server/src/index.js` (the Worker's and the
hello's window, the meter, the beat, the checkpoint, the kill said once, the receipts, the hub's line), and the
session's `gateOk`/`sendGate`/`onGate`. RELAY_VERSION world110 on its branch (world113 at the merge with main, whose EVENT1, RENOWN1 and PARTY-TRAVEL took world110-112 first; GATE_RELAY_MIN 113). What moved from the page above, each a pin's find or
a number the court's shape asked for: the court is 48 m across with the boss kept inside 16 m (a fight radius the
players can always step out of); the fastest kill is 75 s, not 80 (the bucket's first burst); the Nova's band reaches
30 m; every attack carries a minimum gap (0 but the Charge's 8) so a player standing INSIDE his body is still in reach;
a fighter outside the court (cast out, or away) is handed their receipt through the hub, and a hub hello while the gate
still stands hears of its kill. **The relay's one secret** is `GATE_SIGNING_KEY` (an Ed25519 private key,
PKCS8 in base64) - put by the account deploy with its public half since GATE-KEYS; without it the receipts go out
unsigned, the spoils roll the same, and WB5's account service declines them. Pins `test/wb3_gate_room.test.js` (21);
mutants `tools/mutants/wb3.json` (60 dead). The arena place (WB3b) is next; until it lands the gate's door still
answers "not yet".

**WB3b (2026-09-25) - the Burning Court.** The gate's door opens at a relay that runs its room (world113; world110 on its branch): walking
through the fire enters the court - the dungeon host's own arm with a level made in code (`world/gateArena.js`), not
a fifth host. A made location and a blocks file answering one made block holding nothing but its start marker, laid
by the port's own `layoutDungeon`; the court stood into the built context before the marker is read - a 48 m floor of
black flagstones (a few joints glowing) on a spire of rock over a sea of fire, the rune ring 16 m out, spires and five
braziers round the edge, the broken bridge the players came by and the way home's membrane at the floor's edge (the
level's one exit door, so the exit's own ray, ladder and wagon word take it; the plaque says *The way back to Tamriel*) - with its own art (`world/gateArt.js`), its floor on the collider, the
Deadlands' red fog over a far shell of sky (the dungeon host's clear colour left alone) and the braziers' own light
(after the player's own lights, the torch's mask kept). The room is `gate:<day>`; the level claim goes out
once per welcome; the relay's words land in `net/gateLink.js`, which the world's gate reads for its collapse and the
chat for the kill line (*Valkynaz Ruhn has fallen at the Oblivion Gate near ... - struck down by ...*). The motor keeps
the player on the floor; a death is cast out before the gate; the day's end or going offline ends the court the same
way; the map, the rest, the save and the Recall mark are refused inside it. What moved from the page above: the way
home stands at the floor's edge (the motor's ring is a circle; a bridge beyond it is scenery), and the court stands
for its fighters until the gate's day ends rather than collapsing with the kill (the spoils need the time - WB5).
Pins `test/wb3b_gate_arena.test.js` (7); mutants `tools/mutants/wb3b.json` (38 dead; 37 since WB6a took the square sea away). Seen headless with a stand-in
shader (the floor, the ring, the spires and braziers, the sea of fire); not yet in the game with ARENA2 and a live
relay, where the arrival, the fog and the braziers' light are the first look. The boss is not drawn yet (WB4).

**WB4a (2026-09-25) - the boss fights back.** Valkynaz Ruhn stands in the court where the relay says - his walk carried
between its words, the charge carried down its lane and held at its end as the brain holds him - in the Daedra
Lord's own sprite at three times its size (`world/gateBoss.js`): a wind-up holds the attack clip's first frame and,
from half way, its second (the raise), and the landing plays the rest at the clip's own ten a second; the charge runs
on the walk's frames; a blow of mine makes him flinch but never breaks a wind-up; at his fall the hurt frames play
slowly and he is gone (the spoils spill there - WB5). A light at his chest rides the court's channel beside the
braziers: the attack's colour climbing through its wind-up and flaring at the landing, gold while the ward stands, a
low ember otherwise. His voice is his own mobile's, pitched down and heard across the floor: the bark at a
wind-up, the attack at a landing, the fire's cast by its sound ID and the burning under each Hellfire target, a roar
for a phase crossed. On the floor (`render/gateTelegraph.js`, the duel wall's law): one quad and the shape as the
fragment's question - dim at the word, filling toward the edge as the wind-up runs, bright at the landing, gone after
- the same law a struck player's feet are tested by, held to it point for point. His bar (`ui/gateBossBar.js`) says
his name and title over his health with the two phase marks, the ward's gold, the attack coming in its colour, and
the Wrath's countdown in the last five minutes. AND THE BLOW LANDS ON THE STRUCK PLAYER'S MACHINE (`net/gateStrike.js`,
`scenes/gateCourt.js`): at the first frame on the landing - never judged late - its feet against the shape; the
charge strikes the ground he runs over between two frames, so the lane ahead of him is safe until he gets there; a
hit takes its share of the player's own maximum health through the dungeon context's own door (`strikePlayer` - the
hit's sound, the flash, the cry; fire burns unflashed), fire through the game's saving throw (a full resist is said)
and Dagon's Wrath through nothing. Pins `test/wb4_gate_boss.test.js` (14); mutants `tools/mutants/wb4.json` (40 dead).
The telegraph's shader seen headless over the court for every attack (`tools/gateTelegraphProbe.mjs` holds it: 9
checks); the sprite not yet seen with ARENA2 and a live relay. The player's blows on him are WB4b.

**WB4b (2026-09-25) - the boss is fought.** A swing, a shaft or a harmful spell that meets him is computed on the
striker's machine by the game's own law - the same resolveHit and calculateAttackDamage a foe's blow runs, the one
player-arrow law, applySpell's own magnitudes - against his stand-in (`world/gateBoss.js bossStandIn`: his own mobile's
entity, every metal biting where a Daedra Lord's needs Mithril, a knight's armour where his is a wall: a level-1 iron
longsword lands more than half its swings for about nine, a level-20 blade nearly all), and its number goes to the
court's room as the `hit` frame (`scenes/gateCourt.js hit` - whole points, a sequence of its own, the kind), where the
relay's caps decide what lands. His body is met where it is: a swing by his skin (`bossReach` - a foe's centre law would
ask it to reach 1.8 m into him and 2.8 m up), a shaft and a missile by his whole capsule, a touch's sphere swept down
its aim, a blast at his flank (`systems/spellcast.js` measures a body that states its own radius by it; a foe that
states none is measured as it always was). He parries as his mobile does, a blow sounds and splashes at his chest and
the damage number pops as any; the ward turns a blow with the parry's ring and nothing is sent; each blow makes him
flinch. Pins `test/wb4b_gate_blows.test.js` (5); mutants `tools/mutants/wb4b.json` (22 dead).

**WB5a (2026-09-25) - the spoils.** Half a second into his fall his body bursts, and this player's spoils leave his
chest toward them one at a time (`scenes/gateCourt.js`): rolled off the seed of the receipt the relay signed for them
(`systems/gateSpoils.js` - gold by the level, three pieces by the game's own makers laddered by Loot Rarity's own
`applyRarity`: one Rare or better, a tenth of the time Legendary, and two Magic or better by a boss's chances, each
with SetItem's condition and KNOWN - the name the floor says is the pack's; and the Sigil Stone, the gate's trophy, worth
five thousand), flying the thrown torch's own flight (`world/gateSpew.js` -
gravity by the torch's drag, the bounce at its bounciness, rest under a fifth of the throw: a few metres off him in
about a second), each clattering where it lands in the treasure flat the seed dresses it in (`scenes/spoilsPool.js`).
At rest each stands in a beam of its tier's colour over a halo (`render/spoilsGlow.js`) - blue, gold, orange, the
Sigil Stone the Artifact's purple, a Legendary's taller and pulsing - and a Rare or better rings the rare chime and
carries a light. Walk over a piece and it is in the pack, its name said with its tier. What departs from the page
above, and why: a piece is taken by walking over it, not by activating it (the dungeon host's three activation
families are a law, and walking over is the whole of it); and the spoils ride a record on the device, not the save -
the court refuses the save (WB3b) - holding THE PIECES AS ROLLED (the roll reads the player's world as well as the
seed - the Unleveled Loot formula, the registered custom pieces - so a re-roll is not the same spoils), whose they are
and when, from the burst until a save of that character holds them: at each boot, online or not, a record no later
save of its character holds is handed over whole again, and one a later save holds is cleared. Beside it the device
keeps the day whose spoils left him, because the relay answers a fighter who comes back after the kill - a reconnect,
a second door - with his fall and the receipt again: a day already spent spews nothing. The Sigil Stone is its own
template row (570, past the Thunderlock's 560/561): a gem by group (the gem stores and the pawn shops bought it until
SS4 bound it from the counter), and no ingredient - every classic gem is one, an ingredient stacks, and a renamed Ruby would have merged into the Ruby in the
pack and lost its name and its price; the hosts' shared module registers it, so a save carrying one loads in any host.
SS1 (2026-09-27, `11-Multiplayer/Sigil-Sets.md`): the row stacks with its own kind alone - never with a gem - and is
bound, never handed to another player in a trade - nor (SS3) dropped or put in a container, nor (SS4) sold; a pack
saved before it stacked is folded on load.
Leaving the court - by the way home, a death or the day's end - gathers what is still on its floor. No receipt (a
player who neither dealt their share nor stood half the fight), and it is said the spoils are not theirs. Pins
`test/wb5_gate_spoils.test.js` (10); mutants `tools/mutants/wb5.json` (34 dead). The glow
seen headless over the court; the flats and the flight not yet with ARENA2 and a live relay. The account's record of
gates closed is WB5b.

**WB5b (2026-09-25) - the gates closed.** The receipt the relay signed at the kill is carried to the account service by
the account it names and counted there once (`server-account/src/accounts.js claimGate`, acct11): verified with the
relay's public half (`GATE_PUBLIC_KEY`, a Worker secret the account deploy puts (GATE-KEYS), imported once per isolate) - the
version, the signature, the claims, the week - and naming the session's own account, so nobody claims another's; one
row a (day, account) in migration 0014's `gate_kills`, so a second claim - another device, a lost answer, a replay -
lands nothing and is answered `claimed`. A guest fights and loots and is answered `guest`; it keeps its id when it
registers, so its receipt counts then, inside the week. No public half and every claim is declined `no-gate-key` (503),
the service's gap and not the player's. `POST /v1/gate/claim` is behind a session; the count rides `/v1/account` and
`/v1/duel/record` beside the duels, so the Inspect card asks once. On the device (`net/gateClaims.js`) each receipt the
relay hands the socket (`net/gateLink.js onReceipt` - again after a reconnect, and from the hub) is kept, one a day, and
offered at once; an answer that settles it lets it go (counted - said in chat with the count; counted before; not a
receipt the gate signed; another's), anything else keeps it (no session, no key, the network, a guest - told once) and
it is offered again on the gate frame no sooner than ten minutes after; an unsigned or expired receipt is never kept.
The main menu's account card has a *Gates closed* row (the count, or "None yet"), and the Inspect card says *Gates
closed: N* when there is one to say. `tools/mintGateKeys.mjs` mints the pair in one run, and the account deploy runs it once (GATE-KEYS): the private half
is the relay's secret, the public half this service's; nothing is written to disk. Until both are set the relay's receipts go out unsigned and
the spoils still roll; only the record waits. Pins `test/wb5b_gate_claim.test.js` (9); mutants
`tools/mutants/wb5b.json` (25 dead). Not run against a deployed service.

**WB6a (2026-09-25) - the Deadlands.** Mac walked the court and asked for "an oblivion masterpiece", and saw its
square edge. The square sea and the flat shell are gone from the court's mesh; `render/deadlands.js` draws a sky and
a sea in their place (see "The Deadlands" in section 4): the churning overcast, the vortex over the great tower
turning whole and pouring inward, the beam into its eye, the Daedric towers, three ranges with their falls of fire,
seeded lightning; and a disc of moving fire whose rim becomes the sky's own horizon. The court is lit as itself -
red from above, fire from below, the vortex's key light from behind the boss. One foreign pass in the dungeon arm,
after the court's solid geometry and before its flats. Pins `test/wb6a_deadlands.test.js` (8); mutants
`tools/mutants/wb6a.json` (20 dead); `tools/deadlandsProbe.mjs` compiles, links and draws the pass in a real WebGL2
(11 checks). Seen headless from the arrival, looking up into the vortex, from the rim, over the court and low
across the floor; not yet in the running game.

**WB6b (2026-09-25) - the Deadlands' life.** The court had a sky and a sea and nothing between them or over it. Now
(see "The Deadlands' life" in section 4): islands of basalt and leaning spires out in the fire, clear of the great
tower's sightline; six shards of the court's floor hanging past its rim, bobbing and turning on the clock; embers off
the sea and the braziers, turning with the air, and ash falling through it; a strike in the sky flares over the court
the same moment; and the court has its own air - the wind, the sea's roar, the braziers, the thunder of every strike
late by its distance, far roars, fire bursting below - where the dungeon's drips and doors were. The Deadlands' clock
is the relay's now, so all of it is one moment on every screen (WB6a had handed the sky the page's own clock). The
lightning's slots were made whole over the period (a 7 s slot left a 5 s stub at the wrap). Pins
`test/wb6b_deadlands_life.test.js` (8); mutants `tools/mutants/wb6b.json` (27 dead); the probe now draws the land, the
shards and the life too and links all three programs (15 checks). Seen headless from the arrival, low across the floor
and at a strike's peak; not yet heard or seen in the running game.

**WB6c (2026-09-25) - the step through.** The gate's door and the court's way home are taken in fire now (see "The step
through" in section 4): a vortex of flame closing over the screen from its corners, burning while the place beyond is
built, opening from its middle onto the new one - with the fire's roar and the deep wind closing, thunder and fire
opening; a court taken by force flashes into fire and opens. The way home offers no wagon (it waits in Tamriel), and a
forced exit now clears a dungeon exit still pending (a way home, or a wagon prompt's No, that a death, a collapse or a
load overtook would have walked the player out of the next dungeon on its first frame). Pins
`test/wb6c_gate_veil.test.js` (4); mutants `tools/mutants/wb6c.json` (22 dead); `tools/gateVeilProbe.mjs` compiles,
links and draws the veil in a real WebGL2 at the law's moments and steps the real layer through a real page (13
checks). Seen headless over the court's own frame and over a plain one; not yet taken in the running game.

**WB7 (2026-09-25) - his voice and his music.** The fight is heard now (see "His voice and his music" in section 5): his
steps, his growls between attacks, a grunt when he is hurt, the ground's shock under his heavy landings, thunder over
his roar, his body meeting the floor; and the court's own music, written as notes (`systems/gateScore.js` - three war
songs that grow with his phases and a fanfare at his fall, then quiet), played by the game's own player through a new
door of the music service (`registerSong`), holding the music while the court stands. Pins
`test/wb7_boss_audio.test.js` (7); mutants `tools/mutants/wb7.json` (19 dead); `tools/gateScoreProbe.mjs` plays the four
songs through the real song player and measures them (11 checks: every second sounding, peaks near -12 dBFS, the war
from -36 to -29 dBFS as the phases turn, the fall silent by 12 s). Heard only as offline renders; not yet in a fight.

**AUDIT WB - the world's half (2026-09-25).** C1-C7 above: `systems/gateSite.js` (the height bytes, the sea coast, the
town's province, `gateScanner`'s slices), `systems/gateOmen.js` (ready, the settle, each line once past the last),
`render/gatePass.js` (the fog colour, the spin), `scenes/gatePool.js` (the spin accumulated, the matrix and box
cached, one empty list, `stands()`), `scenes/world.js` (the scan warmed in idle slices, the omen's readiness, the
banner under the veil and the held frame, the pass built only while a gate stands). Pins `test/auditwb_world.test.js`
(10) and one in `test/wb1_gate_omen.test.js`; re-aimed: AUDIT 39's held-frame pin (the world host's countdown goes down
on the plaque's line), four of WB1's mutant records (the scan's new shape; the sea coast's record now the audit's
own, its law reversed); mutants `tools/mutants/auditwb_world.json` (20 dead, 1 equivalent).

**AUDIT WB - the court's half (2026-09-25).** B1-B7 above: `scenes/gateCourt.js` (an attack's number and moment, no
body after the Wrath, the late cry), `net/gateLink.js` (`onRefused`), `scenes/worldModes.js` (the door asked again after
the fire, no step, way home or pending exit for the dead), `scenes/world.js` (the dead cast out alive, a refused `in`
and a closed socket taking the player out, the door's refusal), `world/gateArena.js` (`COURT_TEXT.lost`). Pins
`test/auditwb_court.test.js` (7); re-aimed: WB3b's door window, WB6c's door, way-home and flash pins, AUDIT 28 W2c's and
DISC21-B's pending-exit line, five mutant records of WB4, WB6c and WB7 (the marks' new shape, the door's new line);
mutants `tools/mutants/auditwb_court.json` (18 dead).

**AUDIT WB - the relay's half (2026-09-25).** A1, A3, A4, A8, A10 and C7's times above: `server/src/index.js` (the
socket's stamp and the silent unseated, one seat an account in a court, the court's present accounts, a newcomer's `in`
alone written, the kill kept before it is said and the hub told until it answers, the hub's kept receipts and
`_gateReceiptTo`), `net/gateBrain.js` (`freeSeat`, the empty bucket), `net/gateLaw.js` (a day's times made once),
`net/wire.js` (`HELLO_WAIT_MS`, `GATE_TELL_RETRY_MS`, `gateReceiptKey`). RELAY_VERSION world111 on its branch, world113 at the merge - no file joins the
bundle; the bump drops every connected player once. Pins `test/auditwb_relay.test.js` (9); re-aimed: the exact-version
pins and soc1's version record, two WB3 mutant records (the join's `present`, the hub's answer); mutants
`tools/mutants/auditwb_relay.json` (29 dead).

**AUDIT WB - the spoils and the claims (2026-09-25).** A2, A5, A6, A7 and A9 above: `scenes/spoilsPool.js` (`grant`,
spent by `spentKey` day and account, the records a list, `spoilsStore`'s memory), `net/gateClaims.js` (the mendable
rungs, `me`, one a day and account, the memory), `net/accountClient.js` (the rung carried, `me`),
`server-account/src/index.js` (the route says the rung - a redeploy of the account service carries it; until then the
device keeps the old verdict), `scenes/gateCourt.js` (the burst's account), `scenes/world.js` (one store,
`grantSpoilsOutside`). Pins `test/auditwb_spoils.test.js` (7); re-aimed: WB5's record and spent-day pins, WB5b's queue
(the signed-in account), verdict, worker and seam pins, ten WB5/WB5b mutant records; mutants
`tools/mutants/auditwb_spoils.json` (26 dead).

**AUDIT WB - the look and the sound (2026-09-25).** D2-D10 above: `systems/gateScore.js` (`createCourtScore`, the war
songs `seamless`), `systems/music.js` (`fadeOut`), `systems/songPlayer.js` (the seamless loop), `scenes/gateCourt.js`
(the grunt's count, the lists refilled), `ui/gateVeil.js` (`frameDrawn`, `warm`, the flash drawn at once),
`render/deadlands.js` (`anchoredClock`, the falls' two layers, `RIDGES_TOP`), `scenes/spoilsPool.js` and
`world/gateArena.js` (nothing made for an empty floor, the braziers' lights once), `scenes/worldModes.js` (the court's
equator one array), `scenes/world.js` (the score's fade, the veil told and warmed, the clock, the court's hooks). Pins
`test/auditwb_sound.test.js` (10); re-aimed: WB2's pool-frame seam, WB6a's lighting and backdrop seams, WB6b's clock
and life seams, WB7's score seam, two WB6c mutant records; mutants `tools/mutants/auditwb_sound.json` (24 dead). The
Deadlands, gate-pass, veil and score probes pass (15, 9, 13 and 11 checks) - the sky's new falls and skip, and the
world half's membrane, compiled and drawn in a real WebGL2.

With this the audit's confirmed findings are all fixed - 7 of the world's, 7 of the court's, 5 of the relay's, 5 of the
spoils' and claims', 9 of the look and the sound - each pinned and mutated.

**WBX (2026-09-26) - after the first fights.** Section 12 above, whole: `render/renderer.js` (the one index type),
`world/gateModel.js`, `world/gateArena.js`, `world/deadlandsLand.js` (32-bit indices; `portalDoor`, `PORTAL_AFTER_MS`),
`scenes/gateCourt.js` (the portal, the mark, the burning ground and its bite, the turn said, the soul trap kept and
rolled), `scenes/spoilsPool.js` and `ui/itemIconColor32.js` (each piece its own picture, the take after rest),
`render/spoilsGlow.js` (the line), `render/gateTelegraph.js` (the spokes, the mark, the pools), `world/gateBoss.js` (the
leap's flight and hop, the new cues and colours, the stand-in's `spareGear` and mobile), `net/gateBrain.js` (`base`,
`POOLS`, the three attacks, `PHASE_NAMES`, `PHASE_TURN`), `net/gateStrike.js` (`spokeLanes`, `landingPools`,
`poolUnder`, `strikeDamage`'s base), `ui/gateBossBar.js` (the phase's name), `systems/courtRules.js` with
`systems/effects.js`, `systems/enchantments.js` and `systems/passiveSpecials.js` (no regeneration), `combat/formulas.js`
(no wear on him), `scenes/hostMagic.js` and `scenes/dungeonContext.js` (a Soul Trap meets him), `scenes/worldModes.js`
(`gateWayHome`, `onBossTrap`) and `scenes/world.js` (the seams). RELAY_VERSION world116 - the brain's law moved; no
frame changes shape. Pins `test/wbx_gate_fixes.test.js` (16); re-aimed: WB3's tables and phases, WB4's strike and the
driver's, WB4b's mark, WB5's glow and burst, WB6c's way home, AUDIT WB A2's burst, thirteen exact-version pins, ten
mutant records and SURVTIERS3's two cite records; mutants `tools/mutants/wbx.json` (24 dead - the take-after-rest's
survived the first run and its pin was rebuilt to stand on the piece). Seen through the real renderer headless (the
stone, the court and the land, 0 pixels before and whole after; the spoils' pictures with their lines out of each
sprite's crown) and played whole in a real browser against a local relay: the court's floor under the fighter, the mark,
the turn into the Burning Court (the leap to the heart, then the Nova) and into Dagon's Champion (the leap, the spokes
twice), the burning ground, the score by phase, the fall, each piece in the air as its own picture, the portal rising
where he fell, and the walk through it home (SS3 made it a press - the record below).

**WBX8-WBX9 and AUDIT WBX (2026-09-26) - the overworld's sky, a louder score, the audit.** Section 12's second and
third tables, whole. WBX8: `world/dreadSky.js` (the storm's ring - a salt and a centre, the event's own storm
untouched), `systems/gateOmen.js` (`gateSkyPhaseWeight`, `gateSkyNear`, `GATE_STORM_RING`, the omen's `sky`) and
`scenes/world.js` (the greater of the event's weight and the gate's through the sky, its fog and the land's light; the
gate's storm about its site). WBX9: `systems/songPlayer.js` (`songLevel`, the level between the channels and the
fader) and `systems/gateScore.js` (the new mix, `SCORE_LEVEL`, the four songs rewritten on their old key, tempos and
themes), measured by `tools/gateScoreProbe.mjs` (15 checks). AUDIT WBX: `net/gateBrain.js` (`retireShare`,
`restoreShare`, the seat's keep, `liveMs`, `settleAt`, the cleave's 7, the wind-up's health), `net/wire.js` (`spent`,
`bv`, `GATE_BRAIN_V`/`GATE_BRAIN_MIN`, `relaySupportsGateSpent`), `server/src/index.js` (the brain's door, the beat
armed by a blow, `_gateSpent`, one socket an account, the court's `here`, the receipt's `l`, the sweep),
`net/gateReceipt.js` (`l`), `net/online.js sendGateSpent`, `scenes/spoilsPool.js` (the record first, `adopt`, `saved`,
`spoilsLevel`, `SPOILS_RECORD_V`), `systems/saveSlots.js onSlotSaved`, `net/gateLink.js` (the fall's place, a walk ends
the attack), `scenes/gateCourt.js` (the trap's day and incumbent, no step in the air, the fire's count),
`systems/artifactEffects.js` and `systems/enchantments.js` with `scenes/hostEnchant.js` (the Razor, Strikes),
`scenes/hostMagic.js` (the trap's missile), `render/gateTelegraph.js` and `net/gateStrike.js` (the charge's width),
`scenes/gatePool.js` (the horn's root, the fire's box), `systems/music.js` (a made song without MIDI.BSA),
`net/gateClaims.js` (the session read once a second) and `scenes/world.js` (the seams). RELAY_VERSION world116 still
(never deployed; its law now holds these) - **the relay must be deployed with the client**: a world113 tab is refused
the court in words it knows (R7), and the hub is told a receipt is spent only by a relay that reads the word (S1). Pins
`test/wbx8_gate_sky.test.js` (5), `test/wbx9_gate_score.test.js` (4), `test/auditwbx.test.js` (14); re-aimed: DISC20's
graph, WB3's earned, hub and `in`, WB3b's `in` and collapse, WB4's frame, WB4b's missile, WB5's record, the AUDIT WB relay, spoils
and sound pins, WBX's burning ground and the missile's two quotes in AUDIT WORLD6b-iii and DUEL1; mutants `tools/mutants/wbx8.json` (11), `wbx9.json` (7), `auditwbx.json` (29),
all dead, and 29 older records in 13 lists re-aimed (EVENT1's storm, WB4's frame, WB5b's retry clock and WB7's fanfare among them). Seen in the real game online (the sky crimson whole and at the omen's depth,
the gate's red strikes) and heard through the real player (the probe's loudness and peaks).

**AUDIT WBX2 (2026-09-26) - before the merge.** Section 12's last table: `scenes/world.js` (the spoils pool made online or
not, M1), `net/gateBrain.js` (`standsAt` and the kept `idle` fraction, M2; `leapAt` and `LEAP_AIR_MS`, the beat asking
`settleAt`, M5/M8), `world/gateBoss.js` (`bossPlace` on `leapAt`), `server/src/index.js` (the spent word kept in the
copy's place, M3; a court fighter's copy held from their hellos, M4; one read for the sweep's cursors, M9),
`net/wire.js` (`GATE_HERE_HOLD_MS`), `scenes/spoilsPool.js` (`spentBy`, M6) and `scenes/gatePool.js` (M7). RELAY_VERSION
world116 still - re-hashed in place, never deployed. Pins `test/auditwbx2.test.js` (8); re-aimed: AUDIT WB A4's kept copy
(its hold), AUDIT WBX S1's spent word (an older day's forgets nothing; the mark in the copy's place), WB5's seams;
mutants `tools/mutants/auditwbx2.json` (16 dead), eleven older records re-aimed by content, and every gate record on the
files this touched run again.

**GATE-RELOAD (2026-09-26) - an outdated game told to reload.** Section 12's last part: `net/gateLink.js`
(`GATE_OUTDATED_TEXT`, `gateRefusalText`, the `no` said through it) and `scenes/world.js` (the refused `in`'s eject in
the same words). No relay change. Pins `test/gatereload.test.js` (3); re-aimed: AUDIT WB B5's seam pin and its two
mutant records; mutants `tools/mutants/gatereload.json` (6 dead), `auditwb_court.json` run again (18 dead). Seen in a
real browser against the real Room: the build before world116 thrown out of the court in *"The gate is closed."*; this
build, its `in` stripped of `bv`, thrown out in the new words; unaltered, it entered the court and fought on days 518
and 519.

### SS3 - the way home where he fell is pressed, never walked through (2026-09-27)

A player on Discord, relayed by Mac ("Oblivion gate exit on touch prevents looting"): "I was close to the guy when he
died, got zoned out by touching the gate before I could pick up loot". The portal home (WBX2) stands where he fell -
where his spoils leave his chest and land - and a step through its fire was the way home, so a player walking in for
them walked out of the court. Nothing was lost (leaving gathers the floor into the pack, `gateCourt.js leave`), but the
spoils were never seen fall and never picked up. The portal is now PRESSED, as the bridge's membrane always was: its door
stands in the court's exit doors (the ray, the plaque's "The way back to Tamriel", the press, `gateWayHome`), and its fire
is walked through freely - a piece lying in it is taken by walking over it, as anywhere on the floor. The court takes no
way home of its own any more (`scenes/gateCourt.js`; `world.js` hands it the door alone). Pinned: `test/wbx_gate_fixes.test.js`
(WBX2's walk now crosses the risen fire back and forth and stays; the seams: no way home handed or held);
`tools/mutants/wbx.json` - `SS3-the-court-handed-a-way-home-again` in place of WBX2's walk-through record, whose code is
gone.

**AUDIT SS (2026-09-27, Mac: "audit this")**: the press was the only way through, and it could not be made from where the
fighters stand. A dungeon door's press box (`player/enterExit.js doorWorldAabb`) is a square padded round any facing -
4.9 m across for the court's two ways - and a press from inside a box counts only where a collider surface meets the ray
in it (`player/activate.js`, CASTLE1), which a sheet of fire has not: from 0.6 to 2.4 m before the portal, and 1.5 m
before the bridge's membrane, looking at it, a press did nothing. The court's doors carry `court: true` now and are
pressed in their fire's own box (`world/gateArena.js courtDoorAabb`: the opening's width and height, 0.3 m either side of
its plane) - from 0.6 m to the door's reach, looking at it; looking away, nothing; past the reach, "too far". The WBX2
walk test's `home` could never fill (the court takes no way home), so the court's press is now driven end to end: the
court's real floor collider, its targets as `worldModes.js` builds them, and `pickActivatableHit`. And from the same
audit, older than SS3: leaving the court OFFLINE never gathered its floor - online the court puts itself away the frame
after an ejection (`gateCourt.leave` -> `spoils.gather`), offline nothing did until the next online frame or boot; the
offline ejection now leaves the court too (`world.js`). Pinned: `test/wbx_gate_fixes.test.js` (the press),
`test/ss1_stones.test.js` (the offline gather); `tools/mutants/auditss.json`.

**WB8 (2026-09-28) - never swayed, and marked.** Section 13 above, whole: `world/gateBoss.js` (his `pacifyImmune`, his
refusal's words, his aspect's colours and voice), `systems/effects.js`, `scenes/hostCombat.js`, `scenes/hostMagic.js`,
`scenes/dungeonContext.js` (the doors that sway anything refuse him; his door refuses in words; his elements land
unflashed in their casts), `net/gateMods.js` (the marks' tables), `net/gateLaw.js` (the cycle, the marks' line),
`net/gateBrain.js` (the fight's profile and each trial's law), `net/wire.js` (`md`, `fed`, the brain's law 3,
world128 - world126 on its branch), `server/src/index.js`, `net/gateStrike.js`, `net/gateLink.js`, `scenes/gateCourt.js`,
`render/gateTelegraph.js`, `ui/gateBossBar.js`, `systems/gateOmen.js`, `net/gateHerald.js`, `scenes/world.js`.
Not seen in a browser or on the deployed relay: the colours and the cues are the tables' until a court under each
aspect has been looked at and heard.

**WB10a (2026-09-30) - the score pressed and darkened.** Section 15 above: `systems/songPlayer.js` (`songPress`, the
press's graph - the compressor, its drive, the ceiling's soft clip - built once and rewired only as a song with or
without one starts), `systems/gateScore.js` (`SCORE_PRESS`; the war songs rewritten on their old key, tempos, lengths,
voices and law - the villain's harmony, the brass pedal, open fifths, the low bell, the kit without its hat). Measured
through the real player by `tools/gateScoreProbe.mjs`; not heard by a person before it shipped.

**GATE-UX (2026-10-01) - the court less in the way, and the damage chart.** Section 16 above: `ui/gateMarksView.js` (the
arrive card to the side), `ui/gateBossBar.js` (no phase line), `scenes/spoilsPool.js` and `scenes/world.js` (the press
the only take; no feet), `net/gateBrain.js` (the counts, `damageChart`, the chart on the fall and the state),
`net/wire.js` (GATE_CHART_MAX, the chart's projection, RELAY_VERSION world136), `server/src/index.js` (the court's
`fell` carries it), `net/gateLink.js` (the fold), `ui/gateDamageChart.js` (the readout), `scenes/gateCourt.js` (drawn
from the fall, put away on leaving), `ui/enhancedPlusStyle.js` (its dress). Not seen over a real fight or on the
deployed relay: the readout was looked at in headless Chromium over a mock court.

**WB11 (2026-10-01) - his host, the Legion-Lord.** Section 17 above, whole, in three slices on one branch:
**WB11a** - `net/gateMods.js` (the ninth trial), `net/gateLaw.js` (the rotation for nine: the bye seat, 144 gates); the
rotation's own pins moved in `test/wb8b_gate_marks.test.js`, and every pin that named a day's marks re-read against
it (`wb3_gate_room`, `wb8c_gate_detail` - its Rime-Wrought Colossal and Unyielding night is day 112 now -
`discordgates`, `eventtip`). **WB11b** - `net/gateBrain.js` (HOST_KINDS and HOST_BLOWS, the waves, the walks, the
blows, the drinking, the bearers' wait, the crumbling, `applyHostHit`, the state's `lg`, the chart's `a`; the profile's
`legion`), `net/wire.js` (the six words, GATE_HOST_MAX, the brain's law 5, RELAY_VERSION world138 - world140 at the merge), `server/src/index.js`.
**WB11c** - `net/gateLink.js` (the fold), `net/gateStrike.js` (`hostVerdict`, `hostTelegraphAt`), `world/gateBoss.js` (the
looks, the acts, the fall, the cues, the stand-in), `scenes/gateHost.js` (new: the court's host), `scenes/gateCourt.js`,
`scenes/dungeonContext.js`, `scenes/hostMagic.js`, `scenes/worldModes.js`, `scenes/world.js`, `ui/gateBossBar.js`,
`ui/gateMarksView.js`, `ui/gateDamageChart.js` (the host's column - the chart's DOM pins in `gateux_gate` took its empty
cell). What moved from the page as written: a FIRST SIMULATED COURT found a Sapper risen beside the challenger he then
leapt to, drunk 2.75 s after it rose - so each kind now RISES (HOST_RISE_MS: 0.8, 2.5, 1.5 s) before it walks or strikes
and is never drunk while rising, and a Sapper rises SAP_SPAWN_CLEAR (8 m) clear of every challenger. The swing on one of
his host is the eighteenth blood-splash site (`blood1_decals` recounted). Pins `test/wb11_gate_host.test.js` (19);
mutants `tools/mutants/wb11.json` (37, all dead - the spawn's clearance and the Pulse's "someone near" survived the first
run and have pins of their own now). Not seen in a browser or on the deployed relay: this container has no ARENA2, so the
sprites, the tethers and the sounds are the tables' until a Legion-Lord court has been looked at and heard.

**GATE-HEAL (2026-10-01) - healing on the round-up.** Section 18 above, allies only (Mac's "Like for healers"):
`scenes/gateCourt.js` (`healedBy` - what another's spell healed in me, owed to the caster; the word out at most every
HEAL_SEND_MS, fractions and a refused word kept, what is owed sent as the court is left), `scenes/world.js` (the ally-cast
door tells the court; the court's `sendHeal`), `net/online.js` (`gateHealOk` from the welcome), `net/wire.js` (`heal`,
GATE_HEAL_ROWS_MAX, GATE_HEAL_WIRE_MAX, GATE_HEAL_RELAY_MIN, the chart row's `hl`), `net/gateBrain.js` (`applyHeal` -
never the receiver itself - the heal bucket, the record's `healed`, the row's `hl`), `server/src/index.js` (the gate arm's
`heal`: the caster by peer id, the receiver's own pose), `ui/gateDamageChart.js` (the Healed column - after the host's on a
Legion-Lord night, in the share's place on a narrow screen). The first cut also counted a fighter's own potions and
spells, by a watch on its health; asked, Mac took allies only, and the watch went. RELAY_VERSION world138 (WB11's,
never deployed) re-hashed in place - world140 at the merge. Pins `test/gateheal.test.js` (10); the chart's DOM pins in `gateux_gate` took
its empty cell and WB3's closed list of gate words its `heal`; mutants `tools/mutants/gateheal.json` (30, all dead). Seen
in a real browser at 1280x720, 390x844 and 844x390 in both skins, with and without the Host column, six figures in the
Plus skin's pixel face; not yet on the deployed relay.

**The merge with main (2026-10-01).** Main's HERALD (#505) and the Loot arc's LOOT7 (#506) took world138 and world139
first, so WB11's, AUDIT WB11's and GATE-HEAL's relay law is world140: its law row over the merged bundle (HERALD's and
LOOT7's rows kept), every version pin re-chained ("WB11 moved it on last (world140 ...); before it LOOT7 moved it on
(world139 ..."), GATE_HEAL_RELAY_MIN 140, disc7's list, soc1.json's S38 and BOUNTY1 B4. Following #503 (REL6 + GROWTH1)
as #506 did, the patch notes ride the pull request: the two notes files this branch added are gone from the tree (AUDIT
WB11 D1's pin keeps the court's words; the notes on the pull request say the same), and the branch's Testing rows and
Active-Arcs entries are within GROWTH1's caps. Merging deploys world140 (`relay-deploy.yml`), which drops connected
players once.

**WB12a (2026-10-01) - Dagon's Breach and the Deadlands Ember.** Section 19 A above:
- The chat's lines, Discord's posts and every name on screen say Dagon's Breach.
- The Sigil Stone is the Deadlands Ember. A load repair (`systems/gateSpoils.js` nameEmbers) renames every old record.
- A guard test scans every shipped string for the old names.
- Relay world141 (not deployed).
- Pins `test/wb12a_breach_words.test.js` (9); mutants `tools/mutants/wb12a.json` (10), with the campaigns it re-aimed
  (162 dead).

Mehrunes Dagon's day (WB12b) was dropped before it shipped (Mac: *"Let's forgoe the monthly raid"*).

**WB13a (2026-10-01) - the telegraphs, honed.** Section 20 above, T1-T14:
- `render/gateTelegraph.js`: the shader rewritten, every pool drawn, a quad per shape.
- `net/gateBrain.js`: the Flame Nova's ring to 16 m.
- `scenes/gateCourt.js` perilAt and `ui/gateGroundView.js`: a blow to come on your feet, said with the way out.
- `scenes/gateHost.js`: paths and tethers as flowing dashes.
- world141 re-hashed in place; the brain's law stays 5.
- Pins `test/wb13a_telegraphs.test.js` (13), with WB4, WB9d, WB9e and AUDIT WB9 re-pinned; mutants
  `tools/mutants/wb13a.json` (22), with seven older records re-aimed.
- Seen in Chromium over the stand-in court: every attack, at a fighter's eye and from above, in all four aspects.
- Not seen: the game's own art and a live fight.

**WB13b (2026-10-01) - the words.** Section 20 above (Mac: *"clean up text to be less explanatory and less AI"*):
- Every line the breach, the court and the Broker say now says one thing and stops.
- The chat names the marks; the line said on stepping into the court is gone.
- One card subtitle; a phase turn is its name and two orders.
- Discord and the chat share their sentences, and a screen without the site says "in the wilds".
- world141 re-hashed in place.
- Pins `test/wb13b_words.test.js` (5), with 30 older pins re-aimed; mutants `tools/mutants/wb13b.json` (11), with eight
  older records re-aimed.

**WB13c (2026-10-01) - the HUD.** Section 20 above (Mac: *"just overall bring more AAA grade polish to what is already
developed"*):
- His bar has a trailing segment, a ward that comes and goes, callouts with a line to the landing, Dagon's plate and
  MOVE, spent phase marks, his epithet on its own line, chips in the foot, and FELLED before the fade.
- Phone layouts: nothing runs off the screen or covers the crosshair while he fights, and nothing covers the party
  frames on a wide screen.
- The bar is hidden under the step-through fire. A finger's tap shows the breach's card on the map.
- The classic face is loaded by the gate's own screens.
- No relay or account change.
- Pins `test/wb13c_hud.test.js` (10) and `test/eventtip.test.js`, with seven older files re-pinned; mutants
  `tools/mutants/wb13c.json` (29), with five older records re-aimed.

**WB13d (2026-10-01) - the blows.** Section 20 above:
- He and his host flash when struck: fully for my blows, lightly for the court's.
- A blow into his ward shows *Warded*.
- His elemental blows shake the camera, and his landings shake it by how near they fall.
- His landings light the floor where they land.
- A release sound plays before each landing, and his wind-ups are spread apart.
- His fire uses his cast pose.
- The meteor is seen falling.
- No relay or account change.
- Pins `test/wb13d_blows.test.js` (10), with WB4 and WB9e re-pinned; mutants `tools/mutants/wb13d.json` (28), with
  three older records re-aimed.

**WB13e (2026-10-01) - the beats.** Section 20 above:
- His wake: a roar, a flare and his name as the opening ends.
- A phase turn is a card held until he lands, with his roar after the bark.
- His fall is an event: a burst, a white light and a shake; he sinks and leaves his body; the spoils come after, under
  a card.
- The Wrath is said a minute out and as it gathers, and the court reddens.
- Under 10% his ember sputters and the bar pulses.
- A Meteor or a Leap aimed at you stings.
- The court's lines stay up for their length.
- world141 re-hashed in place for the state's opening end. The brain's law stays 5.
- Pins `test/wb13e_beats.test.js` (8), with seven older files re-pinned; mutants `tools/mutants/wb13e.json` (26), with
  four older records re-aimed.

**WB13f (2026-10-02) - the rhythm.** Section 20 above:
- No attack more than twice running: past that he walks in, and six seconds of walking break the run.
- The Slam, the Leap and the Nova recover longer, in a spent pose.
- world141 re-hashed in place. The brain's law stays 5.
- Pins `test/wb13f_rhythm.test.js` (5), with WB4 re-pinned; mutants `tools/mutants/wb13f.json` (14).

**WB12c (2026-10-02) - On the Burning Doors.** Section 19 above:
- The Mages Guild's account of the breaches, the port's first book of its own (id 417), in the classic format.
- Sold by booksellers, general stores and pawnshops, and found on library shelves, at the odds of any other book.
- A character's first Deadlands Ember brings a copy by courier.
- No relay or account change.
- Pins `test/wb12c_burning_doors.test.js` (7); mutants `tools/mutants/wb12c.json` (19).

**WB12d (2026-10-02) - the faithful's rite.** Section 19 above:
- Each breach's faithful work their rite in a circle near it, under a pillar of smoke, from the omen to the opening.
- Kill their Summoner before the breach opens: everyone who struck the faithful takes an ember more when the breach is
  closed, whether or not they fought the Warden.
- The faithful's chest opens once the rite is broken, once a day a character.
- world141 re-hashed in place; acct46 (migration 0046) - deploy it first. The brain's law stays 5.
- Pins `test/wb12d_rite_law.test.js` (6), `test/wb12d_rite_relay.test.js` (4), `test/wb12d_rite_world.test.js` (15);
  mutants `tools/mutants/wb12d.json` (94).

**The merge with main (2026-10-02).** Main's CLIMB5 and CLIMB6, FRIENDS-SYNC, ELITE FOES and the Seats arc took
world141-world150 and acct46-acct61 first, so WB12's and WB13's relay law is world151 and the rite's service acct62, its
migration 0066 (0046 on the branch): the law row over the merged bundle (main's ten rows kept), every version pin
re-chained ("WB12 moved it on last (world151 ...); before it SEAT2b part two (b) moved it on (world150 ..."), RITE_RELAY_MIN
151, disc7's list, soc1.json's S38, gatekeys.json's pin and BOUNTY1 B4. Main's TIME1 says the gate's times in local time
alone: the omen, the opening and the seal (`systems/gateOmen.js` omenTimeLine, openTimeLine, sealTimeLine) say WB12's
words in it, and this relay deploy retires `gateLaw.js`'s three, as TIME1 said it would. Main's SILVER: the breach's
line of the counting-houses says silver ("No silver for this breach. The counting-houses strike it for two breaches a
day."). Main's SEAT1b: a gate claim carries its region and is the war-guild's influence; a rite's own row records no
region and earns no influence, the rite alone being no kill. Main's siege tick runs before the rite's tell in a room's
alarm. The patch notes ride the pull request (REL6). Merging deploys world151 and acct62, which drops connected players
once.

## At sea - the sea serpent (SERPENT1, 2026-10-04)

The gate's law at sea: `Sea-Serpent.md`. Sethrakul, the Old Coil, rises every other game day on the event clock, at
the dawn watch so it never stands beside a gate. It hunts one of the Bay's packet lanes, and its fight is kept by the
cell room its site stands in. Like the gate it follows Option B, with the claim sets what a fighter brings and deals,
receipts under the relay's one key (`l1`), the hub's word of the kill, and the account service's one row per (day,
account). It reuses the gate's boss bar (`ui/gateBossBar.js`, theme `sea`) and its map ring's reader and painter.
SERPENT2 gave it the gate's two other features: a row in the Timers window and a Discord herald (`Sea-Serpent.md`
section 14; this page's herald, at sea).
