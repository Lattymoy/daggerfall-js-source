# The Dwarven Dragon - a world boss in the sky, and a mount for the few who bind one (DRAGON)

> Design page, written 2026-10-29 before the code, and the record of each slice as it lands (section 12). The code's
> comments cite this page by section number; where the page and a pin disagree, the pin is what runs.

## What the owner asked for

The owner, 2026-10-29, after PR #1359 brought the Dwarven Dragon in as a staff monster and an Admin's ride:

> *"1. Other players should see you ride obviously 2. The dragon itself will be part of a new rare random world
> encounter, a sort of world boss when found anywhere in the world. This needs to be an extremely hard encounter with
> Telegraph and unique attack patterns, different movement and aerial integration. 3. On death, the dragon falls and
> is deactivated on the ground. Dropping loot and one super rare chance of taming.*

> *4. If tamed, the dragon becomes a players mount they can summon, just like their horse/carriage. With the ability to
> name, use as storage and upkeep using the same horse care system 5. This should increase overworld travel speed, fly
> in the air and negate road travel 6. The dragon in non overworld view should be able to walk and fly if the player chooses. Simply jumping and
> holding should enable flight 7. Rare chance of a "shiny" varient to spawn with different colors. This needs to be
> extremely detailed and a brand new addition to our world"*

Asked four questions, the owner chose each recommended answer the same day:

- **Online only.** The relay runs the fight and signs each kill, as it does the gate's, the serpent's and the Ketch's.
  The account service rolls the tame, so no client can mint a dragon. Offline there is no dragon fight.
- **Hidden, seen in the sky.** No chat line and no map ring. A dragon comes down at a random wild place near a town,
  anywhere in the world, a few times a day. It circles high and is seen and heard from far off; a player who comes
  near is told once.
- **Tame 1 in 100, shiny 1 in 20.** Each player who dealt damage has a 1 in 100 chance to tame it, at most one dragon
  a character. One dragon in 20 is the shiny. A tamed shiny keeps its colours.
- **The mount's pace.** On the ground it walks and gallops as a horse does. In the air it flies 25 m/s. On the travel
  map it is twice as fast as a horse and flies straight over water and mountains.

The mount's pace is faster than any player's pace today. THE CEILING HOLDS asks the owner's quoted word for a stronger
number (`05-Combat/Power-Ceiling.md` section 9); the answer above is that word, and section 9 quotes it.

Daggerfall has no other players, no world boss and no flying mount, so none of this is a DFU member. Its Ledger A row
is DRAGON.

## 1. The lore - canon, and the port's own

**Canon**: the Rourken, the Dwemer clan that went west to Hammerfell; the Dwemer gone in a day, their constructs still
at their tasks; aetherium, the Dwemer's blue crystal. **The port's own**, said as such: the Rourken built clockwork
dragons as outriders for their sky-ketches (`11-Multiplayer/Sky-Ketch.md` section 1). The Mzunthar's still fly the
patrols they were last given. A dragon comes down where the land's buried brass calls it, circles while its governor
judges what it found, and fights what comes near. Imrah Bel-Tavir's reading, never the canon's: the same lodestone law
that keeps the Mzunthar over the Bay. One dragon in twenty runs on an aetherium heart instead of a brass coil. Sailors
call it **Aetherbright**: its plates are the blue of the crystal, its wings the violet of its light.

## 2. When and where - a function of the clock

Like the gate and the serpent, a dragon is a fact of the shared world that every client and the relay compute from wall
time alone (DRAGON-LAW, net/dragon/dragonLaw.js):

- **The watch.** The real clock is cut into watches of `DRAGON_WATCH_MS` (one hour). Each watch draws, from a hash of
  its number and `DRAGON_SALT`, whether a dragon comes down: one watch in three (`DRAGON_WATCH_ONE_IN`), about eight a
  day, at times nobody is told.
- **Its life.** It comes down at `DRAGON_LAND_AT_MS` into the watch (a quarter past), stays until slain or
  `DRAGON_STAY_MS` (40 minutes) later, then climbs away. So at most one dragon stands at once, worldwide.
- **The shiny.** The same hash draws one dragon in `DRAGON_SHINY_ONE_IN` (20) as Aetherbright. The fight, its receipt
  and the account's row carry it.
- **Where.** The hash picks a theatre among those that stand (the gate's lanes, `03-World/World-Wide.md`) and a seed
  pixel. The client finds the site over the world's own data with the gate's scan (`systems/gate/gateSite.js`: land, no
  place in the pixel, a town two to four pixels away), its own salt, nearest the seed. The relay never reads the map:
  it holds the site the first `in` names to the pixel the seed allows, within `DRAGON_SITE_SLACK_PX`.

No line in chat and no ring on the map. The dragon is found by being seen.

## 3. Seen in the sky - before anyone fights it

From its landing until a player comes within `DRAGON_ADMIT_R` (600 m), the dragon roosts in the air: it circles its
site at `ROOST_ALT` (70 m) on a path that is a function of the clock (`net/dragon/dragonBody.js`), so every screen draws
it in the same place with no frame sent.

- **Drawn** to `DRAGON_SIGHT_R` (4 km), above the fog's reach, as the Dwarven Dragon's own sprite at `DRAGON_SCALE`
  (1.6 - a wingspan near 19 m). Its idle frame banks with its turn.
- **Heard**: a roar every so often, placed at it, carrying `DRAGON_ROAR_R` (3 km).
- **Told once**, the first time a player comes within `DRAGON_NOTICE_R` (1.5 km) of a roosting dragon: *"A dragon
  circles in the sky to the north-east."* (the compass word from the player to it).

## 4. The fight - who runs it

The serpent's model (`11-Multiplayer/Sea-Serpent.md` section 6): the fight lives in the CELL ROOM its site stands in,
never a room of its own. The brain (`net/dragon/dragonBrain.js`) is pure law, plugged into the boss seam
(`net/bossSeam.js` `DRAGON_SEAM`), stepped on the cell's alarm every `DRAGON_TICK_MS` (250), checkpointed every two
seconds, and forgotten two hours after it ends.

- **The join** (`in`): the watch, the site, the brain's law `bv`, the level (never above the token's `cl`). Refused:
  an older law (*reload*); another watch or a watch with no dragon (*the dragon is gone*); a pose past
  `DRAGON_ADMIT_R` (*too far*); a site the seed does not allow (junk); a dragon slain or gone.
- **Every word names its fight** (`id`, the watch and the site), so a client folds its own alone (the serpent's AUDIT
  SERPENT 2 F1 law).
- **The numbers** are the gate's level-claim law: a fighter brings `DRAGON_TTK_S` (200) seconds of
  `dpsRef(lv) = 5 + lv` to its health, at the fight's fraction for a late one, and may deal by a bucket refilled at
  three times the reference a second, fifteen deep, no blow over twelve. A share leaves the health when its fighter is
  gone from the fight for 45 s.
- **A blow is believed** only from a pose within `DRAGON_ENGAGE_R` (300 m) of its body, and a melee blow only within
  reach of it on the ground (section 6).

## 5. Its mind - the air and the ground

The Dwarven Dragon fights in two places, and the fight is reading which one it is in:

- **ALOFT.** It flies an orbit about its site at `CIRCLE_ALT` (30 m), banking, `ORBIT_R` 45-70 m out, at
  `FLY_V` (18 m/s). Melee cannot reach it. Arrows and spells can. Its blows from the air are lanes and discs.
- **GROUNDED.** After a Crash Landing it stands on the ground for `GROUNDED_MS` (12 s; 16 s in the third phase),
  walking at `WALK_V` (3.4 m/s) toward its target. Melee lands, and every blow on it lands at `GROUNDED_X` (1.3) - the
  Wellhead Wyrm's law (`11-Multiplayer/Elite-Gates.md`, `wyrm`). It leaves the ground by a Takeoff Gust.

It never strays past `ARENA_R` (140 m) of its site. Threat picks its target as the gate's does: the most threat 60% of
the time, a random fighter otherwise. It never uses one blow more than twice running. At 66% and 33% it roars, stands
warded for `DRAGON_SHIELD_MS` (3 s), and climbs into its next phase.

## 6. Its blows - every one telegraphed

Every blow is a shape on the ground (the Spire's stamps, `net/eliteGates/egShape.js`), laid by the relay with its
wind-up and judged on each struck player's own feet at the landing (co-op's law, `egBlowVerdict`). Each wind-up is
held to the Spire's floor: long enough to run out of its shape from its middle. A share is of the struck player's own
maximum health.

| blow | where | shape | wind-up | hits for | phase |
|---|---|---|---|---|---|
| **Strafing Run** | aloft | a lane 70 m long, 6 m wide, along its dive | 1.6 s | 25% shock | 1+ |
| **Cannon Volley** | aloft | a 4 m disc under each of up to five fighters | 2.0 s | 22% shock | 1+ |
| **Scalding Breath** | aloft, hovering | a cone 70°, 20 m, under its hover | 1.8 s | 30% fire | 1+ |
| **Crash Landing** | aloft to ground | a disc 9 m where it lands | 2.2 s | 35% weight | 1+ |
| **Claw Rake** | grounded | a cone 110°, 9 m, before it | 1.3 s | 30% weight | 1+ |
| **Tail Sweep** | grounded | a cone 150°, 10 m, behind it | 1.4 s | 25% weight | 1+ |
| **Takeoff Gust** | ground to aloft | a disc 11 m about it | 1.8 s | 20% weight | 1+ |
| **Overpressure** | aloft | a ring safe within 6 m of the point under it, to 32 m | 2.4 s | 40% fire | 2+ |
| **Shrapnel Rain** | aloft | eight 4 m discs about the fighters | 2.2 s | 25% weight | 3 |

(The wind-ups here are the floors' answers at THE ESCAPE BUILD's run; the brain clamps each through `egBlowOf`, so the
table and the pins agree.) In the third phase every wind-up is cut by a fifth, never below its floor. Shock and fire
honour the player's resistances through the game's own saving throw.

**On the ground** each shape is drawn where it lands, draped over the land's own heights (section 9). **On it** the
sprite holds its attack frame through the wind-up and glows the blow's colour; each blow has its wind-up sound.

## 7. The fall - deactivated on the ground

At nought the cell stamps the kill once (`fell`, with its three best dealers and the damage chart) and signs each
earner's receipt. On every screen the dragon falls from where it was - out of its orbit on an arc to the ground under
it, or where it stood - and lands with a crash, dust and its body's thud. Then it lies **deactivated**: its idle frame
on the ground, its glow out, steam leaking from its seams, for `DRAGON_REMAINS_MS` (10 minutes). The spoils burst from
it (section 8).

**Earned**: a fighter that dealt `DRAGON_DEALT_SHARE` (2.5%) of its own share is a **dealer**; one that stood within
150 m of it for a quarter of the fight is a **stander**. A dealer's party shares its kill as a stander's, as the
serpent's does.

## 8. The spoils and the tame

**The receipt** (`net/dragon/dragonReceipt.js`, version `z1`): Ed25519 under the relay's one key, refused by every other
verifier and theirs by this one. Its claims: `w` the watch, `b` the dragon (0 brass, 1 Aetherbright), `s` the account,
`c` the hoard's seed, `x` dealt or stood, `l` the level, `i` issued, `e` a week on.

**The hoard** (systems/dragon/dragonSpoils.js, rolled on the receipt's seed, never past the character's level), within
the ceiling's seven rungs:

- gold, `DRAGON_GOLD_PER_LEVEL` (180) a level, a fifth either way;
- a dealer: one piece Rare or better (Legendary 15% of the time) and one Magic or better;
- a stander: the Magic-or-better piece and 60% of the gold.

The pieces burst from the fallen dragon with the gate's spew (World-Bosses.md section 7) and are taken by walking over
them.

**The tame** (the account service, migration `0192_dragon.sql`, route `/v1/dragon/claim`). The service counts one
kill per (fight, account) and draws, from its own randomness and never the receipt's seed (the serpent's honours law),
1 in `DRAGON_TAME_ONE_IN` (100) for a dealer whose character holds no dragon. A tame writes the account's
`dragon_mounts` row - its id, the character, its look - and answers it.

**Binding it.** A tamed player sees *"Its core still turns."* over the fallen dragon. Activating it binds it: the
dragon rises, its glow back, and kneels. Its item - **the Dwarven Dragon**, in the Transportation group - goes into the
pack, and the dragon flies off to wait for its first summons. A tame not bound at the remains is bound at the next
claim's answer instead, straight into the pack: nothing is lost to a door.

## 9. What a player sees and hears

- **The body** is the Dwarven Dragon's own sprite (`characters/dwarvenDragon.js`, archive 1800) at `DRAGON_SCALE`,
  its walk while it moves, its attack frames at a landing, its hurt frame when a share of its health goes, and the
  Aetherbright's palette when it is the shiny (section 11). Aloft it stands at its altitude over the site's ground.
- **The telegraphs** are the gate's renderer (`render/gate/gateTelegraph.js`) laid on a grid draped over the land's
  heights, so a shape on a hillside follows the hill instead of cutting through it.
- **The bar** is the gate's boss bar in brass: its name (*the Dwarven Dragon*, or *the Aetherbright Dragon*), its
  health with the two phase marks, ALOFT or GROUNDED with the seconds left on the ground, the blow it winds up and
  **MOVE** when one is laid on me, and the time until it climbs away in its last five minutes.
- **Its voice** is the game's own: the Iron Atronach's sounds pitched down for its size, a Dragonling's roar pitched
  an octave down for its roar, and the ground's shock under its landings.

## 10. The mount

A tamed dragon is a third mount beside the horse and the cart (`06-Systems/Horse-Care.md`,
`06-Systems/Horse-Cart-And-Cargo.md`):

- **Summoned** like the horse: the transport window's **Dragon** row, the summon key, or the Stable page's
  **Summon**. It flies in and lands behind the player. Dismounted, it waits where it stands; **Send away** sends it
  off until it is called.
- **Named** from the Stable page or by activating it, its name over it to every player near.
- **Storage**: saddlebags of `DRAGON_BAGS_KG` (1,000 kg - between the Small Cart and the Open Wagon), opened from the
  saddle panel while mounted or within 5 m of it waiting.
- **Upkeep** is horse care's own law (`systems/steedCare.js`): its four stats from its seed, its bond, its hunger and its
  breath, in the player's tier (Off, Boons, Hard). It eats **Dwarven Oil**, sold at every Stable, 24 hours of it a
  flask. Its breath is spent galloping and flying; a winded dragon cannot take off, and one winded in the air glides
  down to land.
- **Walk or fly.** On the ground it is ridden as a horse (`player/motor.js` ride base 375). **Hold jump** for
  `TAKEOFF_HOLD_S` (0.4 s) to take off. In the air it flies 25 m/s where the player looks; jump climbs, crouch dives,
  and it lands when it meets the ground. It flies outdoors only: a door dismounts as a horse's does.
- **Seen by others**: the pose's ride is `POSE_RIDE.Dragon` (3), its look `rc` (1 the Aetherbright), so every other
  screen draws the rider as the dragon, in the air where it flies.
- **On the travel map**: `transportModifier` 64, twice the horse's 128 (`systems/travel/travel.js`), and every pixel
  flown at that rate, sea and mountain alike, in a straight line - no ship needed and no road followed.
- **Kept**: it cannot be dropped, sold, traded or lost to a death, the Wild included. The account service holds every
  dragon item to its `dragon_mounts` row (the judge's provenance law), so a dragon no tame made is a finding.

## 11. The Aetherbright - the shiny

The dragon's pictures are indexed PNGs, so the Aetherbright is the same pixels under another palette: archive 1801,
whose pictures are 1800's with their PLTE chunk rewritten at load (characters/dwarvenDragonShiny.js). The brass goes
the blue of aetherium and the wings the violet of its light. No new picture ships. A tamed Aetherbright keeps its
colours, under the player and on every other screen.

## 12. The slices

| slice | what | relay | service |
|---|---|---|---|
| **DRAGON0** | room in `bootWorld` for the wiring, by a move (`01-Overview/Host-Split.md`) | no | no |
| **DRAGON1** | the ride seen: one relay gate in `net/wire.js` beside `POSE_RIDE`, the Dragon ride and its look, every screen drawing the rider as the dragon | yes | no |
| **DRAGON2** | the law, the body, the brain, the receipt; the cell's fight; the `dragon` frame | yes | no |
| **DRAGON3** | the client: the roost in the sky, the fight, the telegraphs draped, the bar, its voice, my blows on it, its blows on me, the fall and the remains | no | no |
| **DRAGON4** | the hoard and the tame: the claim, the service's row and draw, the binding, the judge's provenance | no | yes |
| **DRAGON5** | the mount: its item, the transport mode, the flight, the saddle, summon, name, bags, care and oil | no | yes (item law) |
| **DRAGON6** | the travel map: the dragon's rate, straight over sea and land | no | no |
| **DRAGON7** | the Aetherbright: the palette, the roll, its look kept | no | no |

The relay changes land in ONE version (world281 - every byte of the relay's bundle is hashed), and the service's in one
(acct211). Each slice: pins in `test/`, a mutant record, its record here.

## 13. The record, slice by slice

**DRAGON1 - the ride seen (2026-10-29).** PR #1359 kept a copy of the ride's relay gate (world276) in
`systems/staffDragon.js`, and the wire's half sat on #1360, which never merged. Main's relay reached world280 with no dragon
in its pose law and clamped `rd` 3 to the cart, so other players saw an Admin on a cart. The gate now lives in
`net/wire.js` beside `POSE_RIDE` (`DRAGON_RIDE_RELAY_MIN` 281, `relaySupportsDragonRide`), and `net/remotePlayers.js` stands
a dragon's rider as the Dwarven Dragon, with no hooves and no Morrowind body. Pinned by `test/net/dragonride_wire.test.js`
(the gate and the law agree at this wire's own version); `tools/mutants/dragon1.json`, 6 dead.

**DRAGON2 - the fight's law and the relay's half (2026-10-29, world281).** `net/dragon/dragonLaw.js` (the watch, the look,
the site's roll), `net/dragon/dragonBody.js` (the plan's legs), `net/dragon/dragonBrain.js` (the fight), `net/dragon/dragonReceipt.js`
(`z1`), `net/bossRef.js` judgeDragon and `net/bossSeam.js` DRAGON_SEAM; the `dragon` frame in `net/wire.js`; the relay's half in
`server/src/dragonFights.js`, which `server/src/index.js` calls from its dispatch, its hub route and hello, its alarm (the
serpent's beat and the dragon's as one) and its trail. Pinned by `test/net/dragon/dragon2_law.test.js` (11) and
`test/net/dragon/dragon2_relay.test.js` (4); `tools/mutants/dragon2.json`, 35 dead. PIN MOVED: the serpent's alarm line
(`test/net/serpent/serpent1_relay.test.js`).

