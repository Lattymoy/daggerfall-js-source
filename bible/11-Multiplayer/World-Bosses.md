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

- **The region**: drawn from a SHUFFLE BAG over the regions that hold enough suitable pixels - every province takes
  one gate, in an order each round's rolls shuffle, before any takes a second, and a round never opens on the province
  the last one closed on. So no province holds two gates running and none is left dry for days.
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
  the court would load into a place that no longer exists. A load of such a save is refused by the gate's own check
  and lands the player at the gate's spot.

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
- **Opening**: held shut for the new place's first two frames (its programs are built on first sight, and must not eat
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
| **Flame Nova** | a ring from 4 m to 30 m - safe at his feet, or far across the floor from him | 2.2 s | 40% fire | 2+ |
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
| GATEWAR1 - he wakes | phase one | 132 BPM; i-VI-iv-V under a pizzicato ostinato on every eighth, the timpani on each downbeat and the kit's low end; brass stabs join, then the Warden's theme on the brass, then the choir under it |
| GATEWAR2 - the ward breaks | phase two | 138 BPM; the choir from the first bar, the kit busier and rolling into every fourth bar, the theme dotted and high |
| GATEWAR3 - his wrath | phase three, and the last minute before the Wrath at any phase | 150 BPM; the Neapolitan Eb against D, the kick on every beat, crashes every other bar, the tritone tolled, the theme at the top of the brass |
| GATEFELL - he falls | his fall, for 12.5 s | a timpani roll into D major - fanfare, choir, bells - then quiet: the court is the Deadlands' air alone |

Nothing plays over the Wrath once it has landed. The court holds the music while it stands and lets it go the frame it
is gone; a music pack can replace any of the four by name.

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

**The account service** (acct10): migration 0009 `gate_kills (day, account, boss, earned, at)`, primary key
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
  And a **Sigil Stone**: the gate's trophy - its own item row, a gem by group but no ingredient, so it never stacks away
  its name - worth a small fortune, one a kill.
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
  the pack - a boss's reward is never lost to a door, a disconnect or a death. The spoils ride a record on the device
  from the burst until a save holds them (the court refuses the save - WB5a), so a crash between the spew and the next
  save loses nothing either.

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
| **WB4** | the boss on the client: the oversized body and its hit volume, the telegraph pass, the wind-up frames, glow and sounds, the boss bar, the player's side of every attack, cast out and back in - shipped in two: **WB4a** (he fights: the body, the telegraphs, the glow and voice, the bar, every blow he lands) and **WB4b** (he is fought: the swing, the shaft and the spell on his body) | no |
| **WB5** | the spoils: the seeded roll, the spew's physics, the beams, halos and lights, the take and the gather, the device's record until a save holds them; the account service's claim (acct10) and the cards' line | account only |
| **WB6** | the Deadlands made alive (Mac: "an oblivion masterpiece"): **WB6a** the sky and the sea and the court's own light; **WB6b** the life - islands and spires out in the fire, the floor's floating shards, embers and ash, the strike's light and its thunder, the air's sound, one clock for every screen; **WB6c** the gate's transition, a vortex of fire in and out | no |
| **WB7** | his voice and his music (Mac: "Proper boss audio during the boss fight"): the body's steps, growls, grunts, the ground's shock, thunder and his fall to the floor; the court's own score, written as notes - three war songs by his phase and a fanfare at his fall | no |

Each slice: pins in `test/` (pure law in node; the relay over its fake sockets and a fake clock; the passes' shaders
built in headless Chromium, as the duel wall's), a mutant record in `tools/mutants/`, the Testing manifest, a Port
Ledger section A row (an original online system, not a DFU member), and a row here.

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
session's `gateOk`/`sendGate`/`onGate`. RELAY_VERSION world110. What moved from the page above, each a pin's find or
a number the court's shape asked for: the court is 48 m across with the boss kept inside 16 m (a fight radius the
players can always step out of); the fastest kill is 75 s, not 80 (the bucket's first burst); the Nova's band reaches
30 m; every attack carries a minimum gap (0 but the Charge's 8) so a player standing INSIDE his body is still in reach;
a fighter outside the court (cast out, or away) is handed their receipt through the hub, and a hub hello while the gate
still stands hears of its kill. **The relay's one secret is not set yet**: `GATE_SIGNING_KEY` (an Ed25519 private key,
PKCS8 in base64, `npx wrangler secret put GATE_SIGNING_KEY` in `server/`) - until it is, the receipts go out unsigned,
the spoils roll the same, and WB5's account service will decline them. Pins `test/wb3_gate_room.test.js` (21);
mutants `tools/mutants/wb3.json` (60 dead). The arena place (WB3b) is next; until it lands the gate's door still
answers "not yet".

**WB3b (2026-09-25) - the Burning Court.** The gate's door opens at a relay that runs its room (world110): walking
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
template row (570, past the Thunderlock's 560/561): a gem by group, so the gem stores and the pawn shops buy it, and no
ingredient - every classic gem is one, an ingredient stacks, and a renamed Ruby would have merged into the Ruby in the
pack and lost its name and its price; the hosts' shared module registers it, so a save carrying one loads in any host.
Leaving the court - by the way home, a death or the day's end - gathers what is still on its floor. No receipt (a
player who neither dealt their share nor stood half the fight), and it is said the spoils are not theirs. Pins
`test/wb5_gate_spoils.test.js` (10); mutants `tools/mutants/wb5.json` (34 dead). The glow
seen headless over the court; the flats and the flight not yet with ARENA2 and a live relay. The account's record of
gates closed is WB5b.

**WB5b (2026-09-25) - the gates closed.** The receipt the relay signed at the kill is carried to the account service by
the account it names and counted there once (`server-account/src/accounts.js claimGate`, acct10): verified with the
relay's public half (`GATE_PUBLIC_KEY`, a var in `server-account/wrangler.toml`, imported once per isolate) - the
version, the signature, the claims, the week - and naming the session's own account, so nobody claims another's; one
row a (day, account) in migration 0009's `gate_kills`, so a second claim - another device, a lost answer, a replay -
lands nothing and is answered `claimed`. A guest fights and loots and is answered `guest`; it keeps its id when it
registers, so its receipt counts then, inside the week. No public half and every claim is declined `no-gate-key` (503),
the service's gap and not the player's. `POST /v1/gate/claim` is behind a session; the count rides `/v1/account` and
`/v1/duel/record` beside the duels, so the Inspect card asks once. On the device (`net/gateClaims.js`) each receipt the
relay hands the socket (`net/gateLink.js onReceipt` - again after a reconnect, and from the hub) is kept, one a day, and
offered at once; an answer that settles it lets it go (counted - said in chat with the count; counted before; not a
receipt the gate signed; another's), anything else keeps it (no session, no key, the network, a guest - told once) and
it is offered again on the gate frame no sooner than ten minutes after; an unsigned or expired receipt is never kept.
The main menu's account card has a *Gates closed* row (the count, or "None yet"), and the Inspect card says *Gates
closed: N* when there is one to say. `tools/mintGateKeys.mjs` mints the pair in one run: the private half is the
relay's secret (`npx wrangler secret put GATE_SIGNING_KEY` from `server/`), the public half goes into
`server-account/wrangler.toml`; nothing is written to disk. Until both are set the relay's receipts go out unsigned and
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
