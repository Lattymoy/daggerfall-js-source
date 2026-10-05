# Enhanced AI - tactics, cover, the crowd and telegraphed blows (TACT, proposed 2026-10-02)

Mac, 2026-10-02: *"Enhance enemy/guard AI. Proper line of sight with billboard props, enemy tactics like backing off
and knowing when to strike, and overall improvements to our enhanced AI system"*; *"Players can grief others with
guards by bringing them into interiors and blocking doorways. We need to reduce enemy clumping and also have enemies
aware of each other"*; *"Introducing new attack patterns and smaller telegraphed attacks (like our world boss) but not
overdoing it"*. His calls, asked the same day:

| | The question | Mac's call |
|---|---|---|
| Scope | Where does the smarter AI apply? | **Everywhere, Enhanced on** - dungeons, streets, interiors and guards when the Enhanced AI switch is on; classic DFU AI byte for byte when it is off |
| Cover | What do billboard props block? | **Sight and missiles** - trees, crates and decor flats block what a foe sees and stop arrows and spells (real cover, both ways) |
| Griefing | How is it done today? | **Guards blocking doors** - guards clump in a doorway so nobody can get in or out |
| Blows | How many new telegraphed attacks? | **One or two, tier-based** - small wind-up attacks on tougher foes only, used sparingly, always readable and dodgeable |

**Status: ALL FOUR BUILT 2026-10-02 - TACT3, TACT1, TACT2, TACT4 (Mac: anti-grief first); records at the foot. TACT5 (the same day): the first field report - foes walking backwards, archers kiting in circles, too hard - fixed. Not yet looked at on a real install.**

## Where it stands (measured on the code, 2026-10-02)

- **The enhanced AI is a pathfinder, and only in dungeons.** `EnhancedEnemyAI` (`ai/enhancedMotor.js`) overrides one
  question - where a foe walks next - on the navmesh. Senses, decisions and attacks are DFU's (`characters/enemyMotor.js`
  `_classicTick`): walk in to 2.25 m and swing; never strafe, back off, circle or wait. The only retreat is `flee()`,
  whose one caller is a guard frightened by a werewolf. Streets, interiors, guards and exterior foes always run the
  classic motor (`dungeonContext.js` is the switch's only reader).
- **Sight sees through every billboard.** `canSeeTarget` casts one eye-to-eye ray through the collider, and the
  collider holds meshes alone: no flat, tree or decor sprite is in it. Missiles fly the same collider.
- **Foes know each other only as overlapping capsules.** `characters/foeSpacing.js` pushes apart foes of ONE pool;
  the dungeon's, the street guards', the exterior encounters' and the interior watch's are separate pools, so a guard and
  a bandit stand in each other. The navmesh's `syncNavObstacles` and RVO `avoidHeading` are ported and called nowhere
  (the arc's 4b). Nothing keeps a foe out of a doorway.
- **Telegraphs exist for the world boss alone** (`net/gateBrain.js`, `net/gateStrike.js`, `render/gateTelegraph.js`):
  shaped wind-ups resolved by where the feet stand at the landing. Ordinary foes swing on DFU's clock, with no tell.

## The design: four slices, each behind the Enhanced AI switch

### TACT1 - cover (sight and missiles)
- Every billboard that reads as solid - trees, crates, barrels, statues, decor flats over a size floor - gets a
  **cover proxy**: an upright box of its drawn width and height (a tree: its trunk's width to its crown's height),
  kept in a cover index beside the collider, never in it (walking is unchanged).
- `canSeeTarget` and `canHearTarget`'s line test, and every missile (arrows, thrown, spell bolts - the player's and the
  foes'), test the cover index after the collider. A target behind cover is unseen; a missile that meets cover stops
  there. Area spells still burst where they land.
- Grass, flowers, small clutter and see-through sprites (fences drawn as flats, hanging signs) are not cover - a list
  by archive/record, with a size floor.
- Classic lane untouched: with the switch off, nothing reads the index.

### TACT2 - tactics (the brain)
A thin decision layer over the motor, per foe, the motor still doing the walking:
- **Engage ring.** A melee foe holds a ring just outside the target's reach (by both reaches), not in its face.
- **The strike window.** It steps in to strike when the target is open - mid-swing recovery, casting, drinking, turned
  away, or staggered - and backs out after its own blow. A foe never waits forever: a patience clock forces an attack.
- **Backing off.** Hurt past a share of its health, or caught by a combo, a foe backs out of reach and circles before
  coming back; at low health a coward class flees (DFU's flee), a brave one fights on.
- **Circling and flanking.** Foes waiting their turn strafe round the ring; two or more spread to flank.
- **Ranged kiting.** Archers and casters keep their stand-off band, back away from a closing melee target, and seek a
  clear line (cover-aware, TACT1) rather than shoot into a crate.
- **Guards** use the same brain, with the watch's own rule: they arrest on yield, they hold a door's outside, never its
  threshold (TACT3).
- Every number is a constant on one table; the class's DFU stats (speed, skill, level) scale it.

### TACT3 - the crowd and the door (anti-grief)
- **One spacing over all pools.** `foeSpacing` takes every live foe near the player - guards, encounters, the
  dungeon's, the watch - in one pass.
- **Attack tokens.** At most N foes (2 melee, 2 ranged by default) hold a token to attack one target; the rest hold the
  ring, circle and wait (this is most of "aware of each other", and most of the clumping).
- **Slots on the ring.** Each waiting foe takes its own angle on the ring, so they spread rather than stack.
- **Doorways are no place to stand.** A threshold zone at every door (both sides). A foe never idles, waits or holds a
  ring slot in it; one in it with nothing to do steps out to the nearer side within a second. A foe passing through
  passes through. Guards in an interior spread into the room from the door on arrival.
- **No guard wall.** The interior watch spawns past the threshold and spreads; guards that cannot reach their target
  for a while give up the door rather than hold it.
- Applies with the switch on; the cross-pool spacing and the doorway rule are cheap enough to consider for the classic
  lane later (Mac's call).

### TACT4 - telegraphed blows (one or two, tier-based)
- Three small shapes, the world boss's language at foe scale: **the lunge** (a short lane ahead), **the sweep** (a
  front cone), **the slam** (a small disc at the foe's feet or just ahead). Each a short wind-up (0.6-0.9 s) with the
  boss's floor telegraph, scaled down and fainter; resolved by where the feet stand at the landing (`gateStrike`'s law).
- **Who gets them:** foes of a tier (level, or the meaner-monsters tier) and up, one or two shapes by family (a beast's
  lunge, a warrior's sweep, a giant's slam). Weaker foes: DFU's blows alone.
- **Sparingly:** a cooldown per foe (8-15 s), at most one telegraph from any foe near a player at a time, never two in
  a row from one foe, and only from the engage ring (TACT2) - a foe in a corridor never sweeps the wall.
- **Fair:** damage is the foe's own blow scaled, armor and skill as DFU's; dodgeable by moving out; a block halves it.
- Online: the foe's owner (each client for its own foes, the dungeon host for the dungeon's) decides and resolves it;
  the wind-up rides the existing foe stream so peers near it see the same telegraph. (Not built - see TACT4's record.)

## Order and proof

TACT1 -> TACT3 -> TACT2 -> TACT4: cover first (everything else reads it), the crowd second (the grief is live), the brain
third (it needs both), the blows last (they need the ring). Each slice: pins first, a real-collider harness in a real
dungeon and town block, a mutation list, an audit before merge, patch notes in its PR.

## Mac's calls, the second set (2026-10-02)

| | The question | Mac's call |
|---|---|---|
| Attack tokens | How many foes attack one player at once? | **2 melee + 2 ranged**; the rest hold the ring, circle and wait |
| Fleeing | Who breaks and runs when badly hurt? | **Animals and the cowardly human classes**; undead, daedra, constructs and guards fight to the death (the others back off and circle) |
| Classic lane | The anti-grief fixes with Enhanced AI off? | **Always on**: the cross-pool spacing and the doorway rule apply on the classic lane too (the grief works whatever the victim's setting) |
| Telegraph tier | Who gets a telegraphed blow? | **Level 10 and up, or an elite (meaner-monsters) foe** |

**Status: DESIGNED - all calls made.** Built slice by slice; Mac moved TACT3 first ("anti-grief first").

## TACT3 - BUILT 2026-10-02 (always on, both lanes)

Every version of the door grief, fixed without asking further (Mac: "stop asking me questions"):
- **a. Across pools** - `characters/foeSpacing.js spaceAcross`: the street's watch and encounters (`scenes/world.js`), and a
  building's foes and the watch called in (`scenes/worldModes.js`), push apart pair by pair across pools, the same
  capsule gap, push speed and edge rule as a pool's own `spaceFoes`; another player's foe (`_ownFrom`) is its owner's.
- **b. No foe holds a doorway** - `clearDoorways` over `doorSpotsNear` (the street's building doors within 40 m; a
  building's own doors within 30 m): a threshold 1.4 m deep each side and 1.2 m either way across; a foe in it is eased
  along the door's normal to its own side's edge at 1.6 m/s - unless its way lies through the door (AUDIT TACT C2: no
  other exemption - one fighting someone on the sill fights from the edge, which is in its reach). Through the
  collider: never through a wall or off an edge; another storey is not this door's. AUDIT TACT C6/C7: the inner swing
  doors and a dungeon's or castle's doors too (`actionDoorSpots`, each door's closed pose).
- **c. No guard wall** - `scenes/cityGuards.js indoorWatchSpot`: PlayerEntity's 2-5 watchmen no longer stand at ONE
  point in the door; each walks from that point 2.0 m into the room and out to its own lane (0, -0.9, +0.9, -1.8,
  +1.8 m), the collider stopping it at a wall.
- **d. The door click** - `player/mobileEnemyActivate.js yieldsToDoor` and `player/activate.js peacefulFoePass`: a foe
  NOT hostile to the player standing between the crosshair and a door (or the ladder's other winner) within the door's
  3.2 m reach no longer takes the press, and the plaque names the door it opens; a hostile foe is still DFU's one hit.
- Not built from the slice: attack tokens and ring slots (they need TACT2's ring); guards giving up a door they cannot
  pass (the doorway rule makes it moot for now).
- Pins `test/tact3.test.js` (15); mutants `tools/mutants/tact3.json` (23), all dead.

## TACT1 - BUILT 2026-10-02 (the Enhanced AI switch on, every host)

- **The proxy** - `ai/cover.js`: a flat at least 1.2 m tall and 0.5 m wide is cover (not the editor's markers 199, the
  animals 201, the lights 210 or treasure 216); its proxy an upright cylinder of 0.35 x its drawn width in radius and
  0.9 x its drawn height, at its BASE. A ray that starts inside one is not stopped by it (a foe in a thicket sees out).
- **The index** rides the collider (`collider.cover`, `createCoverIndex`), never in it: walking, the navmesh and every
  ground probe are unchanged. Sets are keyed like buckets and leave with them (`Collider.removeBucket`); a set's points
  are the batches' own base arrays by reference in its frame, so a recentre moves them and a felled tree sinks its own.
  A 4 m grid per set is the broad phase.
- **Stood by** the streamed world (each pixel's flats - classic, seasonal and scaled - under the pixel's bucket key in
  its translation), the dungeon (its RDB flats at the base - an RDB y is the centre), the interior (its grouped flats;
  a furnishable room's own pieces, which can be taken out, are not), and the single-location exterior host.
- **Read by** `canSeeTarget` (both arms; a tree is never a door to open), the foe's clear shot
  (`hasClearPathToShootProjectile` - an archer behind a trunk holds its shot), every missile (`ArrowFlight`, the
  hosts' bolts in `hostMagic`, the dungeon's arrows and bolts - an area spell bursts on the cover), and the watch's two
  witness rays (a townsperson does not witness a crime behind a stall's crates; a guard NPC facing it still raises the
  watch whatever the ray meets - DFU's seenByGuard quirk, kept: AUDIT TACT B6). Hearing is not cover (Mac's call: sight
  and missiles).
- **Off** - with the switch off `coverDistance` answers Infinity before the index is asked: DFU's sight to the bit.
- The switch's Features note says it (+63 chars). Not looked at on a real install yet.
- Pins `test/tact1.test.js` (9); mutants `tools/mutants/tact1.json` (23), all dead.

## TACT2 - BUILT 2026-10-02 (the Enhanced AI switch on, every host)

- **Where** - `ai/tactics.js tacticsStep`, called from the motor's classic tick (`EnemyAI._classicTick`, after the
  destination, ahead of the ranged stand-off), for a foe that SEES its target within 14 m (a shooter: DFU's 51.2 m
  band) and is not detouring or following; otherwise the classic ladder (and the dungeon's navmesh) pursues. The
  motor still walks: the brain sets `_tacDir` (a step back or round the ring, facing the target, at a share of the
  walk - a wall or a drop behind stops it) and the gates `_tacStrike` (melee and touch spells) and `_tacShoot` (the
  bow roll and the ranged spell roll). With the switch off none is set: DFU to the bit (pinned on a five-foe crowd).
- **Tokens** - one board per target (the local player one key, a peer by its owner, a foe by itself): 2 melee and 2
  ranged (Mac). A holder walks in and swings on DFU's clock; after its blow it STANDS it (0.7 s), steps back to the
  ring for 0.8-1.6 s and hands the token on - to the foe that has waited longest. A foe waiting past 6 s goes in
  regardless (patience). A holder not ticked for 1.5 s (despawned, unloaded) loses its token.
- **The ring** - the waiting stand 1.5 m outside their reach (+-0.6), circle slowly toward their own slot angle (each
  its own, drifting), never swinging. A target whose back is turned on a waiting foe at the ring is open: it goes in.
  (The local player's feet and facing, noted by the world host each frame - `noteLocalPlayer`.)
- **Backing off** - a quarter of its health lost inside 3 s: it holds its own ring 2 m past the waiting ring for 2 s,
  circling there, then back in the queue (AUDIT TACT A5).
- **Fleeing** - animals and the cowardly classes (Mage, Sorcerer, Healer, Bard, Burglar, Acrobat, Thief) below a
  fifth of their health run, once (DFU's own `flee`, 8 s); the watch, undead, daedra, constructs and every other class
  fight on. The hosts hand each foe's entity (`vitals`) for the read.
- **Kiting** - a shooter holding a ranged token backs away from a target inside DFU's own bow band's near edge (6 m)
  until it stands 7 m off, then shoots; a wall at its back corners it and it fights hand to hand for 3 s; a shot hands
  the token on (and one held 5 s without a shot is a lease run out); a shooter without one holds its fire (AUDIT TACT
  A1/A2).
- **Not built** - the player's other open moments (mid-swing recovery, casting, drinking, staggered) are not read;
  ranged foes do not yet seek a clear line round cover; guards giving up a door is TACT3's doorway rule.
- The switch's Features note says it. Not looked at on a real install yet.
- Pins `test/tact2.test.js` (15); mutants `tools/mutants/tact2.json` (25), all dead.

## TACT4 - BUILT 2026-10-02 (the Enhanced AI switch on, every host)

- **The law** - `ai/foeBlows.js`: three shapes, the world boss's language at a foe's scale - the LUNGE (a lane 4.5 m
  ahead, 0.6 m either side, x1.5, 0.7 s), the SWEEP (a 3.2 m cone of +-65 degrees, x1.25, 0.8 s), the SLAM (a 2 m disc
  1 m ahead, x1.75, 0.9 s). The families: beasts lunge; brutes (giants, the Orc Warlord, Daedroth, the Daedra Lord,
  atronachs, gargoyles, dreugh) slam and sweep; blades (orcs, skeletons, mummies, vampires, frost and fire daedra,
  seducers, lamias, centaurs, every class but the three casters, the watch) sweep and lunge; the casters, the spectral,
  the small and the flying none. The tier (Mac): level 10 and up, or an elite (since TELL7 a champion and a revenant
  too, and four more shapes since TELL6 - the ring, the charge, the leap, the aimed shot: `Feud-Arc.md` sections 8-9).
- **When** - from the brain (`ai/tactics.js`): a melee-token holder in reach of the local player, its cooldown (8-15 s;
  since TELL7 by its tier, `Feud-Arc.md` section 9)
  spent, no other foe winding up within 20 m of the player, a 1-in-10 roll a classic tick. It STANDS the wind-up, its
  aim locked; a paralysis, or a shove no blow's door wrote (a charging horse's), breaks it - a landed blow does not
  since TELL1 (`Feud-Arc.md` section 3): it holds, and weighs on the foe's poise until the wind-up breaks and the foe is
  staggered. Once begun it is committed - it lands where it was aimed though the target slips out of its sight.
- **The landing** - where the player's feet stand (noted each frame) is the verdict; the swing comes at once (the
  attack component's forced swing, past DFU's clock and reach - since TELL2 the swing began with the wind-up and
  stood held at its raised arm, and the landing releases it, `Feud-Arc.md` section 4.1; since TELL4 a miss leaves
  its foe overreached, open to an answer, section 6); the host's own hit resolution asks `blowConnects`
  in place of its reach test and `blowScaled` on DFU's damage roll (armour, skill, the party's weighing and all) - in
  the street's encounters, the watch, and the dungeon (the interior's foes are the street's pool). A blow was only
  ever at the local player until TELL8 (`Feud-Arc.md` section 10): a wind-up rides the foe stream, a foe winds up at
  the peer it hunts, and each client judges its own feet - and, since AUDIT ARENA-LADDER (2026-10-05, the owner:
  "Ensure AI enemies sometimes recieve telegraphed attacks"), on the arena's sand at a BOUT-MATE: a fighter of the same
  live bout on another side (`ai/tactics.js` `targetFeet` - main's `blowAim`, one law with TELL8's since FEUD's merge of
  main), its verdict where that fighter stands, judged here (`judgedHere` - a peer's is the peer's own), and the
  foe-vs-foe hit paths asking `blowConnects` and `blowScaled` as the player's do; a dodge is told
  (`registerBlowDodgedListener`), a miss for the judges. The relay's ladder fighters throw the same shapes
  (`net/arenaBrain.js`, the families in the leaf `ai/blowShapes.js`). A verdict is its mark's (AUDIT ARENA-LADDER 2,
  `_blowFor`): a holder whose target changed before its damage frame swings the classic swing, unweighed; on the relay
  one fighter winds up at a time. Street infighting and a peer's foe still see none. The record:
  `bible/01-Overview/Audit-Arena-Ladder.md`.
- **The ground** - `render/foeTelegraph.js` (`renderer.drawFoeTelegraphs`): one flat quad at the foe's feet, the shape
  the fragment's own `inBlow` (pinned point for point), a dim rim at once, filling outward through the wind-up, a
  flash at the landing (since TELL2 the world boss's readable line - a keyline, a brighten "now", premultiplied over
  the floor, never lost near the player, `Feud-Arc.md` section 4.4); depth-tested, unwritten; drawn under the bodies beside the blood marks in the street,
  the building, the dungeon and both standalone hosts.
  `tools/foeTelegraphProbe.mjs` compiles, links and draws the three shapes in a real WebGL2 context (Chromium) and
  reads the frame back: lit inside, the ground untouched beside and behind, dimmer through the wind-up (12 held at
  TACT4; 34 since AUDIT TELL - every shape, the keyline, iron, the contrast, the shatter).
- **Not built** - a block halving it (the port has no player block). (Online - a peer seeing another's foe's
  telegraph, a blow at a peer - was built by TELL8, `Feud-Arc.md` section 10.)
- Pins `test/tact4.test.js` (13); mutants `tools/mutants/tact4.json` (30), all dead.
- **Next:** `Feud-Arc.md` (FEUD, 2026-10-04: "player's can easily stun these enemies") - poise and the stagger, a held
  swing with a glint and cues, iron blows, the punish window, feints and chains, four new shapes, and the wind-ups on
  the foe stream: TELL1-TELL9 and AUDIT TELL shipped; its records there are the law from them on.

## AUDIT TACT - 2026-10-02 (Mac: "Audit this and ensure perfection")

Four lenses over the four slices - the brain, cover, the crowd and the door, the hosts and the ground - each finding
reproduced on the TACT4 head, pinned red (`test/audittact.test.js`) and fixed. With the switch off DFU's motor was
proven unchanged by a seeded run against the pre-TACT tree (same hash, same 440 draws).

- **The brain (A).** A1 an archer between 5 and 6 m jittered forever, never shooting or swinging (the kite band ended
  inside DFU's bow band's edge), and froze with a wall behind it - it now backs out past the edge (6 -> 7 m) and,
  cornered, fights. A2 the 2-ranged-token cap broke after 6 s (tokens were never handed back) - a shot hands it on, a
  5 s lease. A3/D1 the wind-up's knock test was a wall-clock gap, so below ~22 fps (or on one 90 ms hitch, or a pause)
  no blow ever landed - the motor now says when it could not act (`_tacSkipped`), and the brain's clock is the foes'
  own time (`ai/tacticsClock.js`, ticked by each host with the frame's foe step: a held fight freezes the brain with
  it). A4/D5 an archer shot mid-wind-up, and its landing was parked under the bow band and fired seconds later on a
  stale verdict - it holds fire, the forced swing sits above the band and is spent if it cannot come at once, and the
  verdict's life is a swing's (1 s) on the brain's clock without a host passing one. A5 a backing-off foe jittered on
  the ring's edge - it holds its own farther ring. A6 a detour walked a committed wind-up away - it stands. A7 / D4 the
  token boards held every dead foe target forever, and a dead foe's wind-up was drawn and blocked others - an emptied
  board goes, a blow whose foe is no longer stepped goes. A4/D6 a wind-up whose foe turned on another left its verdict
  and weight for the next swing at me - none is set. An opportunist (no token) no longer telegraphs.
- **Cover (B).** B1 a felled tree kept its cover (felling builds new arrays) - the original centre carries `sunk`.
  B2 standing inside a tree's 1 m proxy was one-way invisibility (see out, never seen) - a tree is a body-wide trunk
  and a crown over the heads, and a line of sight that ENDS in cover is not hidden by it. B3 people were cover in the
  dungeons and the location host - never now. B5 at 20 fps a shaft or a bolt was lost on the tree behind a player half
  a metre before it - missiles meet cover by touch (`coverStep`), the bodies before it tested first. B6 the record's
  witness claim corrected (above). Not done: a record-level table of see-through flats (fences, banners, hanging decor)
  - the repo carries no game data to measure them by; the size floor stands.
- **The crowd and the door (C).** C1 THE GRIEF ITSELF: another player's watch, streamed to me as puppets, is minted
  hostile, so my click never passed it - "hostile" is hostile to ME (`hostileToMe`: a puppet on me). C2 the sill
  exemption kept a griefer's guards in the doorway, forever after he left (a stale destination) - removed. C3 the
  indoor watch still stacked: a real door's centre is a metre over the sill and the walk refused both legs - floored
  first. C4 the street mapped every door every frame (up to 1 ms) - once a door generation, nothing with no foes.
  C5 the pass took my companion's pack and turned a pickpocket into a lockpick, and indoors passed to a shelf - it is
  a DOOR's (`doorDistanceOf`), never a companion's or a Steal click's. C6/C7 inner swing doors, dungeons, castles and
  the standalone hosts were unwired - all are now.
- **The hosts and the ground (D).** D2 the location host never noted the player indoors - before every frame branch
  now. D3 a recentre left live wind-ups and the noted player in the old frame - `offsetTactics`. D8 the mark was flat
  at the feet - fitted to the ground under it (sampled at its foot, ahead and across, to 45 degrees). (TELL6c found the sample met no ground outdoors - a ray of meshes alone - and it asks the collider's ground too, `Feud-Arc.md`'s TELL6c record.) D9 it glowed
  through fog - fogged as the ground. D7 the switch's effect line said the next dungeon - the tactics, cover and blows
  are at once; only the navmesh waits. D11 the cover's broad phase built a string a cell a ray - numeric keys, no
  allocation a test. `tools/foeTelegraphProbe.mjs` now holds the fog and the tilt too (14 held).
- Pins `test/audittact.test.js` (32); mutants `tools/mutants/audittact.json` (47), all dead. The four slices' own lists re-run over the fixes.

## TACT5 - THE FIRST FIELD REPORT (2026-10-02, the Enhanced AI switch on)

The #general channel, through Mac (a screenshot): lumin, *"New monster AI is painful."* - *"Yes...a little too hard I
think. The archers that just keep kiting you in a circle"*; maya, *"They keep walking backwards"*.

**Why.** Every TACT2 pin drove a player who stood still; the field's player chases. The brain moved a foe along
`_tacDir` while it kept facing its target, so every step away played the front view's walk going the other way, and
four of its rules stepped away from a player who pressed:
- a WAITING foe inside the ring's near edge stepped back to the ring - for as long as the player kept coming, so a foe
  without a token could be chased round the room and never fought;
- the RECOVER beat walked back to the ring for its whole 0.8-1.6 s, the player following;
- a hurt foe BACKED OFF every time a quarter of its health went in 3 s - every two blows on a weak foe;
- a shooter KITED from 6 m to 7 m whenever a target came inside 6 m, again and again, with no cap (caught, it kept
  backing and never swung - its back-step is not a swing's yaw); a shooter WITHOUT a ranged token held a ring at 5.75 m,
  inside its own bow band's near edge, and circled the player toward its slot.

**The fix** (`ai/tactics.js`, the table's FEEDBACK rows):
- **Pressed, it fights.** A target inside the ring's near edge (reach + 0.9 m) has walked up to the foe: it is open, as
  a turned back is - the foe engages without a token. The tokens ration who comes IN, never who answers.
- **A hop, not a retreat.** After its blow a holder backs out for at most `RECOVER_HOP` (0.4 s), then holds its ground
  through the rest of the beat. `holdRing` backs out only while a back-step lasts (`backUntil`); spent, it stands.
- **A foe walks the way it faces.** A hurt foe's retreat and an archer's kite `walkAway`: turn first (in place, 0.35
  rad a classic tick, the brain's square-up rate), step only within `WALK_FACE_DEG` (45) of the way, at the old 0.7 of a
  walk. Turned away, the foe is out of its own 180-degree sight; the walk is held to its end (`away`) and for
  `FACE_BACK` (1 s) after it to turn round, rather than the classic motor turning it back each tick (a 0.35 rad
  oscillation on the FOV edge, found on the first run).
- **Backing off once a cooldown.** `BACKOFF_COOLDOWN` (10 s) between back-offs.
- **One kite a cooldown.** A shooter inside 6 m - token or not; the token is the shot's - walks out one burst of at most
  `KITE_MAX` (2 s); reaching 7 m it turns back and stands off; caught (the burst's clock) or cornered (the wall) it
  fights hand to hand, and it kites again only `KITE_COOLDOWN` (8 s) after a burst ended. Inside the band with its kite
  spent it is a MELEE fighter (DFU's own fallback - a bow foe out of its band walks in) and takes the melee board's
  turns; past 6 m it is an archer again.
- **No ring for a shooter.** Without a ranged token it stands off (the classic stand-off, its fire held); it never
  circles. A token of the kind a foe no longer fights as is handed back (a shooter that fought hand to hand kept its
  melee token for good).
- **The motor** (`characters/enemyMotor.js _walkStep`): a brain step met by a wall also stops the walk for the rest of
  the classic tick - the next fixed steps walked on the way the foe FACED, which, turned to walk away, is into the wall,
  and started a classic detour along it.

Unchanged: the token counts, the patience, the strike window's other rules, fleeing, the telegraphed blows; with the
switch off, DFU's motor to the bit (TACT2's five-foe pin).

- Pins `test/tact5_feedback.test.js` (8): a waiting foe walked up to fights within 1.2 s and gives at most a hop a
  blow; pressed, a holder never backs past its hop; a hurt foe walks away facing its way, never backwards, once a
  cooldown; a chased archer kites once, facing its way, then fights hand to hand and hands its melee token back past
  the band; an archer walked up to without a token never circles (its slot pinned a quarter turn round, the case that
  circled); one walled in is cornered by the wall (not the clock) without a detour along it; one left alone walks out
  past the edge and shoots, never walking back in. All 8 red on the TACT head.
  `test/tact2.test.js`'s source pin follows the motor line.
- Mutants `tools/mutants/tact5.json` (13), all dead; `tact2.json` and `audittact.json` records re-aimed at the moved
  lines (and two audit records widened to the new pins, which kill them where the audit's alone no longer can); the
  four TACT lists re-run, 161 dead.
- Not looked at on a real install yet.
