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

## 2. When and where - the relay's secret, told near its cell

DRAGON-HIDDEN (the owner: "people are able to predict the dragon spawn by looking at source code"): the rolls were a
public salt's, so anyone could count every dragon to come. Every roll now takes an omen `{w, s}` (net/dragon/dragonLaw.js),
its seed an HMAC of the relay's `GATE_SIGNING_KEY` under its own label (net/dragon/dragonSeed.js). DRAGON-CELL: the relay
told the seed to every screen at the landing, and the seed named the pixel; now only a player near its cell is told.

- **The watch.** The real clock is cut into watches of `DRAGON_WATCH_MS` (one hour). A watch holds `DRAGON_CELLS_A_WATCH`
  (4) omens, each seed its own HMAC (`dragonOmenSeeds`, `dragonCandidates`), so one told says nothing of another. One
  omen in `DRAGON_WATCH_ONE_IN` (3) brings a dragon down where its cell has ground: at most 8.9 a day, up to four a watch.
- **When.** An omen's landing is a whole second its seed rolls in the watch's first `DRAGON_LAND_SPAN_MS` (20 minutes,
  DRAGON-HIDDEN-TIME), so the clock tells nobody when.
- **Where.** An omen picks a cell (`dragonCellOf`): one of the relay's 16-pixel world cells in the continent's frame at
  its authored fit (`DRAGON_CELLS`), a box the relay knows with no map; it holds the land at the shipped fits. The client
  finds the site in it over the world's own data (`systems/dragon/dragonSite.js`): the Bay's gate scan's ground where the
  cell has any, which every screen holds; else the gate's law over the towns about the cell past the Bay, the
  countryside's among them (`scenes/gate/gateLanes.js` groundIn, read in idle slices once the countryside stands). Its
  own roll picks one pixel. A cell with no ground brings no dragon. An omen within two cells of an earlier one is dropped.
- **Told near its cell.** A client asks (`ask`) for this watch and the last, down whatever room it stands in. The relay
  judges a pose in a cell room (in a cell the socket covers) and in a battle (on its map frame); another room answers
  nothing. It tells a dragon's omen only to a socket posed within `DRAGON_TELL_PX` (6 pixels, the dragon's sight) of its
  cell, once it has landed and the socket has stood `DRAGON_TELL_DWELL_MS` (20 s) in its room. Any other is told null,
  no sooner than a quiet watch (`dragonQuietAt`). The client asks again outside a told omen's reach, and after a null
  from another pixel, or the same one a minute on. No secret, no dragon.
- **Its life.** It stays until slain or `DRAGON_STAY_MS` (40 minutes) after its landing, then climbs away. Up to four may
  stand at once, three cells apart at least. An account is rewarded for one a watch: the account service keys a kill by
  watch and account (AUDIT DRAGON-CELL D4, put to the owner).
- **The shiny.** One omen in `DRAGON_SHINY_ONE_IN` (20) is the Aetherbright. The fight, its receipt and the account's
  row carry it.
- **The fight's site.** The relay holds a fight at the site an `in` names in its own cell, at most `DRAGON_SITES_MAX` a
  watch, at a pixel's centre in the cell of an omen of that watch (`dragonCandidateOf`, `dragonSiteOk`). A forged site
  within that stands a fight of its own that nobody else draws (the serpent's AUDIT SERPENT S1 law).

No line in chat and no ring on the map. The dragon is found by being seen.

## 3. Seen in the sky - before anyone fights it

From its landing until a player comes within `DRAGON_ADMIT_R` (600 m), the dragon roosts in the air: it circles its
site at `ROOST_ALT` (70 m) on a path that is a function of the clock and its omen (`net/dragon/dragonBody.js`), so every
screen told the omen draws it in the same place with no frame sent.

- **Drawn** to `DRAGON_SIGHT_R` (4 km), in the view's own fog, as the Dwarven Dragon's own sprite at `DRAGON_SCALE`
  (1.6 - a wingspan near 19 m), its idle frames in the air.
- **Heard**: a roar once in every `DRAGON_ROAR_MS` (40 s) of the clock, placed at it, carrying `DRAGON_ROAR_R` (3 km).
- **Told once**, after a player has been within `DRAGON_NOTICE_R` (1.5 km) of a roosting dragon for
  `DRAGON_NOTICE_WAIT_MS` (6 s): *"A dragon circles in the sky to the north-east."* (the way from the player to it, a
  whole phrase of its own in each language: `dragon.way.*`, never an English compass word inside a translation). The wait is longer than the cell's pace for its whole state, so a dragon its cell says slain is never told.

## 4. The fight - who runs it

The serpent's model (`11-Multiplayer/Sea-Serpent.md` section 6): the fight lives in the CELL ROOM its site stands in,
never a room of its own. The brain (`net/dragon/dragonBrain.js`) is pure law, plugged into the boss seam
(`net/bossSeam.js` `DRAGON_SEAM`), stepped on the cell's alarm every `DRAGON_TICK_MS` (250), checkpointed every two
seconds, and forgotten two hours after it ends.

- **The join** (`in`): the watch, the site, the brain's law `bv`, the level (never above the token's `cl`). Refused:
  an older law (*reload*); another watch or a watch with no dragon (*the dragon is gone*); a site its dragon could not
  stand at (*gone*); a pose past `DRAGON_ADMIT_R` (*too far*); a site in another cell (junk); a dragon slain or gone.
- **Every word names its fight** (`id`, the watch and the site), so a client folds its own alone (the serpent's AUDIT
  SERPENT 2 F1 law).
- **The numbers** are the gate's level-claim law: a fighter brings `DRAGON_TTK_S` (720; 200 before DRAGON-HARDER) seconds of
  `dpsRef(lv) = 5 + lv` to its health, at the fight's fraction for a late one, and may deal by a bucket refilled at
  three times the reference a second, fifteen deep, no blow over twelve. A share leaves the health when its fighter is
  gone from the fight for 45 s.
- **A blow is believed** only from a pose within `DRAGON_ENGAGE_R` (300 m) of its body, and a melee blow only within
  reach of it on the ground (section 6).

## 5. Its mind - the air and the ground

The Dwarven Dragon fights in two places, and the fight is reading which one it is in:

- **ALOFT.** It flies an orbit about its site at `CIRCLE_ALT` (30 m), banking, 55 m out, at
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
| **Takeoff Gust** | ground to aloft | a disc 11 m about it | 2.1 s | 20% weight | 1+ |
| **Overpressure** | aloft | a ring safe within 6 m of the point under it, to 32 m | 2.4 s | 40% fire | 2+ |
| **Shrapnel Rain** | aloft | eight 4 m discs about the fighters | 2.2 s | 25% weight | 3 |

(The wind-ups here are the floors' answers at THE ESCAPE BUILD's run; the brain clamps each through `egBlowOf`, so the
table and the pins agree.) In the third phase every wind-up is cut by a fifth, never below its floor. Shock and fire
honour the player's resistances through the game's own saving throw.

**On the ground** each shape is drawn where it lands, draped over the land's own heights (section 9). **On it** the
sprite holds its attack frame through the wind-up and glows the blow's colour; each blow has its wind-up sound.

## 7. The fall - deactivated on the ground

At nought the cell stamps the kill once (`fell`, with its three best dealers and the damage chart) and signs each
earner's receipt. On every screen the dragon falls from where it was, straight down to the ground under it, and lands
with its body's thud. Then it lies **deactivated** for `DRAGON_REMAINS_MS` (10 minutes): its idle frame on the ground,
washed dark, its glow out. Its cell says its state every five seconds to anyone who comes near while it lies, and answers
a late `in` with it, so nobody sees the roosting dragon circling over a slain one. The spoils burst from it (section 8).

**Earned**: a fighter that dealt `DRAGON_DEALT_SHARE` (2.5%) of its own share is a **dealer**; one that stood within
150 m of it for a quarter of the fight is a **stander**. A dealer's party shares its kill as a stander's, as the
serpent's does.

## 8. The spoils and the tame

**The receipt** (`net/dragon/dragonReceipt.js`, version `z1`): Ed25519 under the relay's one key, refused by every other
verifier and theirs by this one. Its claims: `q` the watch, `b` the dragon (0 brass, 1 Aetherbright), `s` the account,
`c` the hoard's seed, `x` dealt or stood, `l` the level, `m` the relay's body count, `i` issued, `e` a week on.

**The claim** (`server-account/src/dragons.js` `claimDragon`, route `/v1/dragon/claim`, migration `0194_dragon.sql`, acct222).
The device carries the receipt (`net/dragon/dragonClaims.js`) with the character that fought and a claim id of its own.
The service counts one kill a (watch, account) in `dragon_kills`, and gives the hoard to the claim whose id writes the
watch's `dragon_spoils` row, so a second browser is answered no. A guest is given its hoard and nothing else. The kill is
the questline act `dragon-slain`. No Renown and no silver: the dragon pays its hoard and its tame.

**The hoard** (`systems/dragon/dragonSpoils.js`, rolled on the receipt's seed, never past the character's level), within the
ceiling's seven rungs: gold, `DRAGON_GOLD_PER_LEVEL` (180) a level, a fifth either way; a dealer one piece Rare or better
(Legendary 15% of the time) and one Magic or better; a stander the Magic-or-better piece and 60% of the gold. Every piece
takes the ladder's last pass, the sockets' and the technique's. It goes straight into the pack (`scenes/dragonRewards.js`,
the serpent's spoils pool under the dragon's own keys), and a crash hands it back at the next stand-up.

**The tame.** The service draws from its own randomness, never the receipt's seed (the serpent's honours law), 1 in
`DRAGON_TAME_ONE_IN` (100), for a dealer's first write, for a character that holds no dragon (`dragon_mounts`, UNIQUE
account and character). The draw writes the mount's row by THIS claim's kill row alone, in one batch. Every answer while
the row stands names the tame, so a lost answer is told again. The device keeps it (`dragon4.tamed`) until it is bound.

**Binding it** (DRAGON5). A tamed player sees *"Its core still turns. The Dwarven Dragon is yours."* Its item - **the
Dwarven Dragon**, in the Transportation group - goes into the pack at the claim's answer, or at the character's next
stand-up when another stood then (`scenes/dragonRewards.js` bind), once DRAGON_MOUNT_ONLINE is on (section 13, DRAGON5a).

**The title** (WYRM-RIDER, 2026-10-30, the owner: "we need a title thats basd ass for this DRAGON TAMER"). An account
that holds a tamed brass dragon (a `dragon_mounts` row, look 0) holds **Wyrm Rider**; one that holds an Aetherbright
(look 1) holds **Aether Rider**. The earliest tame of each look (by its time, then its id) also holds **First Wyrm
Rider** or **First Aether Rider**. A developer's tame is never a First (the owner: "DONT COUNT ADMINS"). They are
derived like the Marks of Mastery (`net/huntLaw.js` DRAGON_TITLES, `server-account/src/hunts.js` DRAGON_COUNTS_SQL),
signed into the token (relay world294) and shown in the wardrobe under the Dwarven Dragon. Each is worn on a metal
name plate (the owner: "naw just make the name plate"): brass, aetherium, and the Firsts' gold and ice
(`ui/titleFlame.js` TITLE_PLATE and plateCss).

## 9. What a player sees and hears

- **The body** is the Dwarven Dragon's own sprite (`characters/dwarvenDragon.js`, archive 1800) at `DRAGON_SCALE`,
  its walk while it moves, its attack frames at a landing, its hurt frame when a share of its health goes, and the
  Aetherbright's palette when it is the shiny (section 11). Aloft it stands at its altitude
  over the land under it.
- **At rest in the air it hovers** (DRAGON-HOVER, 2026-10-29, the owner: "we need a fly animation for the dragon when it
  idle"): records 20-24, eight frames a facing, the wings beating and the body bobbing, on the mobile's RangedAttack1
  table (it has no ranged blow). The world's dragon hovers while aloft and still; another screen draws a resting dragon
  rider so (`characters/dwarvenDragonId.js` `dragonHoverFrame`). Grounded, it stands on its idle.
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

- **Summoned** like the horse: the transport window's **Dragon** row (it mounts the dragon when it waits within reach),
  the summon key (when the dragon was the last mount, or there is no horse and no wagon), or the Stable page's **Call**.
  It flies in from 320 m behind its spot and 120 m up and lands 7 m behind the player (`systems/dragon/dragonKeep.js`).
  Dismounted, it waits 7 m behind where the rider stopped; **Send away** sends it climbing off until it is called.
- **Named** from the Stable page or by activating it in Info mode, its name over it to every player near.
- **Storage**: saddlebags of `DRAGON_BAGS_KG` (1,000 kg - between the Small Cart and the Open Wagon), a storage beside
  the pack, opened by activating it (Steal mode or the plaque's row) or from the Stable page while mounted or within 9 m
  of it. They save with the character, and the judge, the id ledger and customs read them as a held list.
- **Upkeep** is horse care's own law (`systems/steedCare.js`): its four stats from its seed (its tame id's last four hex),
  its bond and hunger on its item (`horseBond`, `horseFed`), its breath, in the player's tier (Off, Boons, Hard). It
  drinks **Dwarven Oil** alone, sold at every Stable (online behind `DWARVEN_OIL_ONLINE`, on since DRAGON-ON), 24 hours of it a
  flask, from the pack, then its saddlebags. Waiting or away it hunts: hungry at worst, never starving. On the ground it
  walks, and gallops on its breath; flight spends its breath too. A winded dragon will not gallop or take off, and one
  winded in the air glides down to land.
- **Walk or fly.** On the ground it is ridden as a horse (`player/motor.js` ride base 375). **Hold jump** for
  `TAKEOFF_HOLD_S` (0.4 s) to take off. In the air it flies 25 m/s where the player looks; jump climbs, crouch dives,
  and it lands when it meets the ground. It flies outdoors only: a door dismounts as a horse's does. Off it in the air
  (a flag's dismount, Foot picked) the rider is set down, sinking to the ground with no fall (`DRAGON_SET_DOWN_SINK`).
  Its takeoff is its roar an octave down, its landing the body's thud.
- **Seen by others**: the pose's ride is `POSE_RIDE.Dragon` (3), its look `rc` (1 the Aetherbright), so every other
  screen draws the rider as the dragon, in the air where it flies.
- **On the travel map**: `transportModifier` 64, twice the horse's 128 (`systems/travel/travel.js`), and every pixel
  flown at that rate, sea and mountain alike, in a straight line - no ship, no fare, no storm's sea.
- **On the Overworld** (online, where a journey over land is walked, not jumped): a journey begun on the dragon is one
  straight `air` leg (`systems/dragon/dragonJourney.js`) at the road's rate wherever it goes. The ride takes off and
  holds `DRAGON_CRUISE_M` (60 m) over the ground or the sea under it, and comes down at the end. No peak refuses it
  and no shore stops it.
- **Kept**: it cannot be dropped, sold, traded or lost to a death, the Wild included. The account service holds every
  dragon item to its `dragon_mounts` row (the judge's provenance law), so a dragon no tame made is a finding. The
  service's rows are the record (`/v1/dragon/tames`); a device's list is a copy, joined to them before a bind.

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
| **DRAGON4** | the hoard and the tame: the claim, the service's rows and draw, the hoard in the pack (the binding and the judge's provenance are DRAGON5's) | no | yes |
| **DRAGON5** | the mount: its item, the transport mode, the flight, the saddle, summon, name, bags, care and oil | no | yes (item law) |
| **DRAGON6** | the travel map: the dragon's rate, straight over sea and land | no | no |
| **DRAGON7** | the Aetherbright: the palette, the roll, its look kept | no | no |

The relay changes land in ONE version (world288 - every byte of the relay's bundle is hashed; world281, world283, world284,
world285, world286 then world287, until the merges of main renumbered it past world281 to world287), and the service's in one (acct222 -
acct211 when this page was written, renumbered past KEEP-MARK, SHED-REPLICA, the PvP rework's acct213-acct215, CRAFT-SET's
acct216, AUDIT TAMRIEL-WIDE's acct217, INSURE-ALL's acct218, YARD-CELL's acct219, UNION-CHILDREN's acct220 and
HEARTH-SIBLING's acct221). Each slice: pins in `test/`, a mutant record, its record here.

## 13. The record, slice by slice

**DRAGON1 - the ride seen (2026-10-29).** PR #1359 kept a copy of the ride's relay gate (world276) in
`systems/staffDragon.js`, and the wire's half sat on #1360, which never merged. Main's relay reached world280 with no dragon
in its pose law and clamped `rd` 3 to the cart, so other players saw an Admin on a cart. The gate now lives in
`net/wire.js` beside `POSE_RIDE` (`DRAGON_RIDE_RELAY_MIN` 288, `relaySupportsDragonRide`), and `net/remotePlayers.js` stands
a dragon's rider as the Dwarven Dragon, with no hooves and no Morrowind body. Pinned by `test/net/dragonride_wire.test.js`
(the gate and the law agree at this wire's own version); `tools/mutants/dragon1.json`, 6 dead.

**DRAGON2 - the fight's law and the relay's half (2026-10-29, world288).** `net/dragon/dragonLaw.js` (the watch, the look,
the site's roll), `net/dragon/dragonBody.js` (the plan's legs), `net/dragon/dragonBrain.js` (the fight), `net/dragon/dragonReceipt.js`
(`z1`), `net/bossRef.js` judgeDragon and `net/bossSeam.js` DRAGON_SEAM; the `dragon` frame in `net/wire.js`; the relay's half in
`server/src/dragonFights.js`, which `server/src/index.js` calls from its dispatch, its hub route and hello, its alarm (the
serpent's beat and the dragon's as one) and its trail. Pinned by `test/net/dragon/dragon2_law.test.js` (11) and
`test/net/dragon/dragon2_relay.test.js` (4); `tools/mutants/dragon2.json`, 35 dead. PIN MOVED: the serpent's alarm line
(`test/net/serpent/serpent1_relay.test.js`).

Its follow-up: a replace meant for the dragon's refusal codes had also rewritten the serpent's *it is already slain*
(`SERPENT_NO_WORDS`), so the client dropped that refusal. It is restored, and the SD9a bundle pin moved
(`test/net/superDungeon/sd9a_receipt.test.js`).

**DRAGON3 - the client (2026-10-29, world288).** `scenes/dragonHost.js` is the dragon on this screen: its sky,
the sighting, the `in`, its blows draped and judged on my feet, my shafts, spells and swings out to its cell, the bar's
model, its voice, its fall and its remains. Beside it: `net/dragon/dragonLink.js` (the fold, this site's words alone),
`systems/dragon/dragonSite.js`, `systems/dragon/dragonWords.js`, `ui/dragonBar.js` (brass) and
`render/dragon/dragonTelegraph.js` (the gate's pass on a grid over the land). `net/online.js` carries the frame;
`scenes/world.js` wires it within the room DRAGON0 freed (bootWorld 35,247). The relay now tells a fallen dragon's state
while its remains lie (`DRAGON_REMAINS_MS` moved to the law). Pinned by `test/net/dragon/dragon3_client.test.js` (7),
`test/scenes/dragon3_host.test.js` (7) and `test/net/dragon/dragon3_relay.test.js` (1); `tools/mutants/dragon3.json`, 27
dead. PINS MOVED: the serpent's marks (`serpent4`), its spell door (`fb1019f_bossdot`), NAV-H's enemies near (`nav_h_host`).

**DRAGON4 - the hoard and the tame (2026-10-29, acct222, migration 0194; acct213 and 0192 on its branch, renumbered past the PvP rework, CRAFT-SET, AUDIT TAMRIEL-WIDE, INSURE-ALL, YARD-CELL, UNION-CHILDREN and HEARTH-SIBLING at the merges of main).** `server-account/src/dragons.js` `claimDragon` behind
`/v1/dragon/claim`: one kill a (watch, account), the hoard to the device that wrote its row, the tame drawn by the
service for a dealer's first write, one a character, named at every answer while its row stands. On the device:
`net/dragon/dragonClaims.js` (the carrier), `systems/dragon/dragonSpoils.js` (the hoard), `scenes/dragonRewards.js` (the
hoard into the pack, the tame kept), made by the dragon's host on three world bindings (bootWorld 35,256). The questline
act `dragon-slain`; the hoard in the honest producers' sweep (`test/honestItems.mjs`). Pinned by
`test/net/dragon/dragon4_service.test.js` (3) and `test/net/dragon/dragon4_claims.test.js` (4); `tools/mutants/dragon4.json`,
20 dead. PINS MOVED: the account version's (acct217) and their ten mutant records, the questline acts' count, the
schema's tables, the sweep's producers (92).

Its words in the thirteen finished languages, drafted in-session (`tools/l10nInSession.mjs`). The sighting's way is now
a phrase of its own (`dragon.way.*`), so no language reads an English compass word inside its sentence (a test in
`dragon3_client.test.js`). A bad character is refused with the serpent's `renown-character`. The world frame's arrows
moved to a closure of their own (`frameArrows`, PERF-V8), bootWorld 35,258.

**DRAGON5a - the mount: its item, its ride and its flight (2026-10-29).** `systems/dragon/dragonMount.js`: the Dwarven
Dragon (template 1820), a Transportation piece bound to the pack and worth nothing to the measure, its picture the
dragon's own idle front. The item law's `dragon` finding (ITEM_LAW_VERSION 15) and the judge's `dragon-tame`
(`judge.js` judgeDragons: the tame's row, this account and character, held once). `TRANSPORT_MODES.Dragon` is riding but
never a horse ride (`isHorseRide`): no sprite, hooves or voices, and the saddle over the view (`player/dragonSaddle.js`,
the Admin's ride's too). The flight (`systems/dragon/dragonFlight.js`, `player/dragonRide.js` on the motor's ride step
and sink): jump held 0.4 s, 25 m/s aloft, the ground lands it, a fall caught after DRAGON_CATCH_S (1.2 s). Both pickers'
Dragon row; the pose's ride and look. Pinned by `test/net/dragon/dragon5_mount.test.js` (9); `tools/mutants/dragon5.json`,
26 dead.

PINS MOVED by DRAGON5a: the item law at 15 (seven pins, LAW_SERVICE's 15 acct217's, and its seven mutant records),
the modes and groups (`tr1`, `int1`), the rig's horse-only lines (eight pins, `horsevoice`), the levitation term
(`staff1`, `audit_seats_client`), the footsteps (`if1`), the pose (`hcc_park`, `coats1`).

Two calls of its own. The tame binds at the claim's answer or the next stand-up, not at the remains: the answer comes
seconds after the kill, so a walk back added nothing. And DRAGON_MOUNT_ONLINE is off for this release (REST6's law,
SHIP BEFORE ANYONE CAN SEE ONE): the tame waits on the device and in its row, and a later release turns it on. The
classic window's Dragon row is drawn under DFU's art, a departure (MOVE00I0 has four rows).

**AUDIT DRAGON (2026-10-29, the owner: "Can we audit everything and ensure perfection").** An independent review of the
whole arc found fifteen, each fixed at its root. The relay: the fight's gate is the ride's number (it stood at 281 and
opened the frame to relays that close on it); a fight whose shares all retired stands where the last left (the gate's
`idle`); the ground counts from the landing (`ma`, on the state word too); the Strafing Run's sweep rides the wire; a
kill whose receipts failed is tried again; the hub sweeps its receipts and bounds its cache. The client: the sky made
whole in `scenes/dragonHost.js` (`createDragonSky`, bootWorld 35,258); a rider set down, never dropped; the flight
heard; an Aetherbright rider washed blue on every screen; the tamed line honest while the mount waits.

The service: its tames read back (`/v1/dragon/tames`), so none is lost with a device's storage, and the dragons slain on
both cards - the Inspect card the count alone (`dragonSlainOf`), never a stranger's tames. The pass against this page found `05-Combat/Power-Ceiling.md` section 9 without the owner's word on the
pace; it is quoted. The serpent's beat shared the kill's retry gap; SERPENT-RETRY fixed it (`Sea-Serpent.md` 19). Pinned by
`test/net/dragon/dragonaudit_relay.test.js` (6), `dragonaudit_account.test.js` (4), `dragonaudit_client.test.js` (1) and
tests in `dragon5_mount` and `dragon3_host`; `tools/mutants/dragonaudit.json`. world284 re-hashed in place.

**THE MERGE OF MAIN AT 566057d51 (2026-10-29, #1386 AUDIT TAMRIEL-WIDE).** Main took world284 and acct217, so the dragon
is world285 and acct218; migration 0193 stands. `DRAGON_RIDE_RELAY_MIN` is 285 (main's world284 still clamps `rd` 3),
and the fight's gate with it. Item law 15 names acct218 (`tech1_roster` LAW_SERVICE). bootWorld measures 35,250: main
took eight lines out. PINS MOVED: the relay's and the service's versions (sixty files, each note before main's), the
ride's and the fight's gates (`dragonride_wire`, `dragon2_law`), and ten mutant records on the version lines.

**CI ON DRAGON5a (2026-10-29).** The realm's trade law did not know the Dwarven Dragon is bound
(`net/realm/realmTradeLaw.js` BOUND_TEMPLATES, now with 1820), so the service would have moved one between two realm
characters; only the client refused it. And the flight's test reset took staffDragon's name; it is `_resetDragonFlight`
(audit24's one home). PINS MOVED: AUDIT REALM F1's rows and registrars; five mutant records on the bound list, and
`DRAGON5-the-realm-trades-a-dragon` dead.

**THE MERGE OF MAIN AT bd748f03c (2026-10-29, #1419 INSURE-ALL).** Main took acct218, so the service is acct219; the
relay stays world285 and migration 0193 stands. Item law 15 names acct219. PINS MOVED: the account version's (twenty
files, the dragon's note before INSURE-ALL's), the service's history check (`auditscale2_acct`), and eleven mutant
records on the version lines.

**THE MERGE OF MAIN AT 45342d9fa (2026-10-29, #1416 CAPE-TOGGLE).** Main took world285, so the relay is world286 (the
merged bundle's hash, 11fe794e); acct219 and migration 0193 stand. `DRAGON_RIDE_RELAY_MIN` is 286 (CAPE-TOGGLE's
world285 still clamps `rd` 3), and the fight's gate with it. PINS MOVED: the relay version's (fifty files, the dragon's
note before CAPE-TOGGLE's), CAPE-TOGGLE's own (`capetoggle`), the gates' refusals (`dragonride_wire`, `dragon2_law`),
and three mutant records on the version lines.

**THE MERGE OF MAIN AT c72b366b5 (2026-10-29, #1424 TRAVIS-FOLD and #1431 FB1029).** Main took world286 (FB1029 GROUND),
acct219 (YARD-CELL YC3, migration 0193) and acct220 (UNION-CHILDREN), so the dragon is world287 and acct221, and its
migration is 0194. `DRAGON_RIDE_RELAY_MIN` is 287 (main's world286 still clamps `rd` 3), and the fight's gate with it.
Item law 15 names acct221. bootWorld measures 35,228: main took four lines out. PINS MOVED: both versions' (each note
before main's), the service's tables and history (`accountworker`, `auditscale2_acct`), the gates' refusals, and the
mutant records on the version lines.

**THE MERGE OF MAIN AT 043338ef6 (2026-10-29, #1428 AUDIT FB1029d).** No version moved. bootWorld measures 35,230: main's
deck seam put two lines in. PINS MOVED: the host's ceiling and its mutant record.

**DRAGON5b ABOARD (2026-10-29).** Reading main's deck seam against the keep found the keep's own gap: it refused a call
aboard by `deps.aboard`, which the host never passed, so a dragon could be called onto a ship. The host now passes it -
Daggerfall's ship, a Come Sail Away deck (the pair's rule, AUDIT FB1029d B1) or a sea ship's - and bootWorld measures
35,232. Pinned in `dragon5b_keep`; `DRAGON5b-a-call-onto-a-ship` and `DRAGON5b-the-host-never-says-aboard` dead.

**CI ON THE MERGES (2026-10-29).** Two of DRAGON5b's own, which the stopped local suite never reached. The keep's
places were `KEEP`, a name `scenes/dataSource.js` already declares (audit24's one home); they are `DRAGON_WHERE`. And
the foes module's setter joined the line PORTAL1 pins; it stands on its own line, the module's way, and that line is
main's again. Its dispatch sat between SURV3's camps and the frame's end; it reads beside EG-F's now. OL2's word on
the fare moved with PARTY-TRAVEL's bag, so its pin reads the host whole (`hostText`).

**THE MERGE OF MAIN AT d9e485583 (2026-10-29, #1436 FIELD BUGS 2026-10-29e).** Main took acct221 (HEARTH-SIBLING and
FAMILY-REMOVE, no migration), so the service is acct222; the relay stays world287 and migration 0194 stands. Item law 15
names acct222. bootWorld measures 35,233: main's KEYS-BLUR put one line in. PINS MOVED: the account version's (each note
before main's), the service's history check (`auditscale2_acct`), `tech1_roster`'s law, and ten mutant records on the
version lines.

**THE MERGE OF MAIN AT f2e1fe700 (2026-10-29, #1437 FRONTS, #1426, #1427).** Main took world287 (FRONTS), so the relay is
world288 (rehashed: main's bundle and the dragon's five modules); acct222 and migration 0194 stand. `DRAGON_RIDE_RELAY_MIN`
is 288 (FRONTS' world287 still clamps `rd` 3), and the fight's gate with it. bootWorld measures 35,236: main put three
lines in. PINS MOVED: the relay version's (each note before main's), the relay graph, the gates' refusals
(`dragonride_wire`, `dragon2_law`), the host's ceiling, and the mutant records on those lines.

**DRAGON-ON (2026-10-29, the owner, after #1396 merged: "you didnt add the actual dragon riding?").** `DRAGON_MOUNT_ONLINE`
and `DWARVEN_OIL_ONLINE` are on: a tame binds into its character's pack at the stand-up, the transport window rides it,
and every Stable sells the oil online. REST6's law held both off for #1396's release; on before it ships, a stale client
(a tab open across the deploy, a desktop app not yet updated) drops the dragon. Its tame row stands, so a current
client's next stand-up binds it again (`scenes/dragonRewards.js` recall, bind), with a fresh bond and hunger; its
saddlebags' load is lost. PINS MOVED: the two switches, the bind's off case (`dragon5_mount`), the tamed line
(`dragonaudit_account`), the online stock (`dragon5c_care`, `merchantyards1`); two mutants whose gate stands open now
mutate its other side (`DRAGON5c-the-oil-kept-off-online`, `AUDIT-DRAGON-the-waiting-line-with-the-ride-on`).

**DRAGON-HARDER (2026-10-29, the owner: "The dragon is way too easy to kill wtf").** A fighter's share was 200 seconds
of its reference damage (`dpsRef`, 5 + level), but the gate's bucket lets it deal three times that, fifteen deep: one
fighter at the cap took its share in about a minute, and more fighters only brought more shares. `DRAGON_TTK_S` is 720:
twelve minutes at the reference, about four at the cap - over the Ketch Warden's 600 (KETCH-LONGER, the same finding),
the rarest world boss the longest fight. Relay world293, world289, world290, world291 then world292 on its branch until HAND-WRAPS, PVP-LINGER, GILDED-GLOW and DELVE II took them (`DRAGON_RIDE_RELAY_MIN` stays 288). PINS MOVED: the relay
version's (each note before the last), `dragon2_law`'s; `DRAGON2-the-share-the-gates` mutates 720 to 600.

**DRAGON-HIDDEN (2026-10-29, the owner: "people are able to predict the dragon spawn by looking at source code").**
Every roll was `gateHash(DRAGON_SALT, w, k)`, the salt in the client, so the source counted each dragon to come, its
province and its pixel. The rolls take a watch's omen now (section 2): the relay's seed, told at its landing, never
before; the site's number is the seed's, not the watch's. A modified client still learns a site at its landing - it
must, to draw it - but never a watch ahead, and a forged site still stands a fight of its own (section 2).
`DRAGON_BRAIN_MIN` 2: an old game is told to reload. The fight's gate is 293 (292 until DELVE II took it), past the
ride's 288. Pinned by `test/net/dragon/dragonhidden.test.js` (5); `tools/mutants/dragonhidden.json`, 11 dead; eight
records re-aimed onto the omen, dead.

**AUDIT DRAGON-HIDDEN (2026-10-30, the owner: "Audit this"; `01-Overview/audits/Audit-Dragon-Hidden.md`).** Three lanes
read DRAGON-HARDER and DRAGON-HIDDEN cold. The relay holds a forged site to a pixel's centre on its omen's side of the
Bay's edge (`dragonSiteOk`), and a cell waking lets go of an unslain fight an older law made. An `ask` goes down whatever
room the player stands in - a siege's battle and a tourney drew no dragon - and is answered each time, asked again after
two seconds, so a lost answer or a clock ahead of the relay's costs no watch. The tests' omen names its look and theatre:
a run's random key drew the Aetherbright one time in twenty and failed two pins. Relay world293, re-hashed in place.

Pinned by `test/net/dragon/dragonhiddenaudit.test.js` (8); `tools/mutants/dragonhiddenaudit.json`, 17 dead. PINS MOVED:
`dragonhidden`'s answer (each time, not once a socket - `DRAGON-HIDDEN-told-twice` retired with the code) and its ask
(no cell); `dragon3_host`'s two `online.js` lines; `DRAGON3-the-hub-says-every-word` re-aimed by content. The two records
`dragonhidden`'s titles named and nobody wrote are added: `dragonhidden.json` 12, dead.

**DRAGON-CELL (2026-10-31, from Discord: a player read each dragon's pixel off the omen frame; the owner chose
"Cell-scoped").** DRAGON-HIDDEN told a watch's seed to every screen at the landing, and the seed named the pixel, so a
watcher on the desktop app's debugging port read each dragon's site. The relay has no map, so it cannot
tell who stands near a pixel. The seed picks a cell now, which the relay can judge: it tells an omen only to a socket
posed within six pixels of its cell, and null to any other at a quiet watch's time (section 2). A watch holds four
omens, because a cell holds ground about 28% of the time: on the freeware 1,220 of the Bay's 2,016 cells, and past the
Bay at most 23,281 of 86,344 (`tools/dragonCellProbe.mjs`). No host line changed. Relay world298, `DRAGON_RELAY_MIN`
298, `DRAGON_BRAIN_MIN` 3. Deploy the relay first.

Pinned by `test/net/dragon/dragoncell.test.js` (4); `tools/mutants/dragoncell.json`, 22 dead. PINS MOVED: the relay
version's 46 files and its law's row; `dragon2_law`'s site and relay floor; `dragon3_client`'s site; `dragonhidden`'s
tell and quiet watch; `dragonhiddenaudit`'s A1, B1, A3 and A6. Re-aimed by content and run, dead: DRAGON2-the-site-day-a-gates,
DRAGON3-the-gates-day and -a-site-asked-every-frame, AUDIT-DRAGON-the-gate-its-own-number, two of `dragonhidden`'s, the
three A1 of `dragonhiddenaudit`'s, and the relay version's three. Retired with their code: AUDIT-DRAGON-HIDDEN-A1-the-cells-check-dropped
and -B5-asked-after-a-null-omen (DRAGON-CELL-the-in-any-site and -the-null-asked-again-here hold their laws).
DRAGON-HIDDEN-asked-before-the-landing was alive on main too: recorded equivalent, with why. The version line carries STOREFRONT's rollback floor and kill fields, so WIREAUDIT-6 and -9 aim there.

**AUDIT DRAGON-CELL (2026-10-31, the owner: "Audit"; `01-Overview/audits/Audit-Dragon-Cell.md`).** Three lanes read
DRAGON-CELL and FIND-FOUND cold. A told omen's seed ran back to its watch's seed through gateHash, so each omen's seed is
its own HMAC now, and a quiet omen is told null. An `in` reads no omen outside its socket's cover or far from its pose.
A socket is told after 20 s in its room, a battle's pose is judged, and the client asks again outside a told omen's
reach and after a null. A cell across the Bay's edge takes the Bay's ground where it has any, and a square is read once
the countryside stands, in idle slices. Open, and put to the owner: many forged sockets at once (D3), and one reward a
watch (D4). Relay world298, re-hashed in place. Pinned by `test/net/dragon/dragoncellaudit.test.js` (9);
`tools/mutants/dragoncellaudit.json`, 18 dead.

**DRAGON7 - the Aetherbright (2026-10-29).** `characters/dwarvenDragonShiny.js` turns each PLTE colour at load - the brass
and copper to aetherium's blue, the wings' olive membrane to its violet, the greys cooled - and writes the chunk's CRC
again. Archive 1801 is 1800's ninety files so turned; no picture ships. One home for a look's pictures
(`dwarvenDragonId.js` dragonArchiveOf): the boss draws from it, in the sky too before a fight is mine (it was brass there
until its state came); a peer's rider stands in a bundle of its own (`remotePlayers.js` `_mobileFor`'s skin); the tamed
mount's pack picture and its rider's saddle are its look's. The wash is gone. Pinned by
`test/net/dragon/dragon7_aetherbright.test.js` (7); `tools/mutants/dragon7.json`, 11 dead. PINS MOVED: the picture count
and the shipped files (`dwarvenDragon`, `doctrine`), the registry's words (`l10n4_hardcoded`), the audit's wash
(`dragonaudit_client`).

**DRAGON5b - the keep (2026-10-29).** `systems/dragon/dragonKeep.js` is the tamed dragon's keep on the character
(`playerEntity.dragonKeep`, saved by `systems/save/save.js`): ridden, waiting at a native spot, or away; its name; its
saddlebags; whether it was the last mount. `scenes/dragonKeepHost.js`, made by the dragon's sky host, sees the mount and
the dismount on the motor's step, draws it waiting and flying in or out, answers its press and plaque (raced with the
mounts, `player/activationRace.js`), and puts its word on my foes frame (`dk`, `net/dragon/dragonKeepWire.js` - no relay
change). The transport window, the summon key and the Stable page ask its door. Pinned by
`test/net/dragon/dragon5b_keep.test.js` (10); `tools/mutants/dragon5b.json`, 25 dead.

PINS MOVED (DRAGON5b): the race's rows (`hard2_activationrace`), the foes frame's test (`hcc_hosts`); fourteen records
re-aimed by content. ROOM: PARTY-TRAVEL's fare bag moved out of `bootWorld` first (`01-Overview/Host-Split.md`).

**DRAGON5c - its care (2026-10-29).** Horse care's law takes the dragon: `steedCare.js` reads its seed off its tame id
(`dragonMount.js` dragonSeedOf), feeds it Dwarven Oil alone (`eatsFood`; the oil's row `upkeepItemRows.js` 1712, a Glass
Bottle's picture) and keeps it by `tendSteed`, tendHorses' body made one steed's. `upkeepRuntime.js` keeps its breath -
spent by a gallop, or by flight (`dragonRide.js` dragonAloft) - and answers its gallop gate, walk, pace, HUD bar, card and
feed; its winded word reaches the flight (`setDragonWindedSource`), which then neither takes off nor cruises, and glides.
The item law takes its bond and food on it. Pinned by `test/net/dragon/dragon5c_care.test.js` (7);
`tools/mutants/dragon5c.json`, 20 dead.

PINS MOVED (DRAGON5c): the upkeep block (`steed1_horsecare`), the Stable's stock (`merchantyards1`), the hosts' gallop
(`steed1_horsecare`); ten records re-aimed by content; the oil's row name counted English (`l10n4_hardcoded`).

**DRAGON6 - the journey flown (2026-10-29).** The travel map prices a dragon owner's trip at `DRAGON_TRANSPORT_MODIFIER`
(64), every pixel at the land's unhindered charge, sea and peaks too: no fare, no Storm Season. Online a map's pick is the
Overworld's walked journey (OW-ONLY), so there the dragon flies: mounted, the host plans `dragonFlightPlan` - one `air`
leg, no road, no boat - and the peaks' refusal stands aside. `travelOptions.js` runs a flown leg at the road's rate, its
ocean stop passes it, and each frame sets the ride's cruise (`setDragonCruise`); the motor's fly hold (`cruiseHold`)
keeps it at 60 m, then brings it down. Pinned by `test/systems/travel/dragon6_flight.test.js` (6);
`tools/mutants/dragon6.json`, 15 dead.

PINS MOVED (DRAGON6): the host's plans and peaks (`fb0929d_toroads`, `tv6_dungeons`, `ows2_crossing`, `tv2_click_to_move`,
`ow_wod`), the road's rate (`tvsmooth1`), the ocean fare's cite (`audit26_streaming2`); ten records re-aimed by content
(ow2, ow3j, ow4d, ows2, ratelaw, tide3).
