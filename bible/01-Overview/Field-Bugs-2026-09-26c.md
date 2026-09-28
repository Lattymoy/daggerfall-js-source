# FIELD BUGS 2026-09-26 (c) — SquidKamer on the sea's encounters

SquidKamer (Kamer - the author of Warm Ashes - Ships, `03-World/Warm-Ashes-Ships.md`) in the Discord's
`#developer-chat`, relayed by Mac ("Can you look into this"):

1. *"Just sp you know if the wa ships allies aren't attacking then my other modsmay have issues. I can work around it
   but other mods doing the same thing will lead to issues. So say we port some quests packs in ... We can use wa ships
   to test tge issue"*.
2. *"Also puddle no more (I suspect spawning enemies) are causing massive performance issues. So ship encounters you
   drop to 1 fps for a few seconds and get jumped by everyone"*.
3. *"I suspect enemies spawning in enhanced is more aggressive than dfu. That's cause no collision on monsters ≈ free
   space to spawn enemy always. Probably why puddle and wa encounters are so more aggressive in general"*; *"Even then I
   think puddle no more is too aggressive on top of the free area spawn. I jumped in last night and it summoned an army
   of everything."*

## WA-ALLIES: `change foe ... infighting` lands, so a quest's allies fight (report 1)

WAQ_SHIP_SMALLRAID (`vendor/warm-ashes-ships/Quests/`) musters the ship's crew with `change foe _ally_ team 1`
(PlayerAlly) and `change foe _X_ infighting true` for every foe, re-applied every quest tick by an always-on
`daily from 00:00 to 24:00` task. The team landed. The infighting flag never did: `ChangeFoeInfighting`
(`systems/quest/actions.js`) wrote `inst.behaviour`, and the hosts' instance walk (`questFoeInstances`, world.js /
exterior.js / worldModes.js `liveQuestFoes`) answers foe RECORDS, which keep the QuestResourceBehaviour as
`questBehaviour` (`scenes/questFoeHost.js bindQuestFoeHost`; `behaviour` is the name only on a spawn handle). The
write was skipped and the action completed anyway, silently. So every quest foe stayed one that targets only the player
and that nobody may target (EnemySenses.GetTargets :806-807, :814-815, the port's `enemyTargets.js getTargets`): the
crew stood idle, and the raiders fought the player alone. Every host was affected, and every quest using the action.

Each half had been pinned apart: `test/enemyinfighting.test.js` wrote to fixtures shaped `{ behaviour }`, and
`test/dungeoninfighting.test.js` read `questBehaviour`. No test ran the action against a real record. The action now
writes the record's `questBehaviour`, the fixtures are the record's shape, and `test/waallies.test.js` runs the author's
own quest through the machine over records of the exterior pool's shape, then the real target machine: the crew takes
a raider and the raider the crew, and neither ever targets the player's side wrongly.

As in DFU, with "Enemies fight each other" off the allies still stand idle: the else-arm reads the mobile's own team,
which `change foe ... team` does not touch (EnemySenses.cs :801). The setting ships on.

`test/waallies.test.js` (3); `test/enemyinfighting.test.js` re-aimed; `tools/mutants/waallies.json` 3, 3 dead.

## What the spawns are (reports 2 and 3), read before anything was changed

Two read-only passes, each over the port and the mod's own law (the IPNM assembly's IL, DFU's CreateFoe.cs,
FoeSpawner.cs, EnemySenses.cs, EnemyMotor.cs), found this:

- **Iliac Puddle No More's army is the mod's own, ported faithfully.** Its pulse runs whenever the player is outdoors
  within 200 m of a sea pixel (not only in the water): 58 attempts a pixel at the default frequency 0.3, every one
  landing in 9.5 m of water standing one foe, capped at 128 live, one stood a frame - about two seconds from nothing
  to full - and each made hostile to the player the moment it stands, told where the player is. Only the treasure
  guards keep a distance, and they have no caller yet. Online the room forces 0.3 and 128 on everyone.
- **The port makes it worse.** Foes are not in the collider, so nothing crowds one off another and every foe reaches
  melee at once. A foe's AI cost grows with the pool (a sight ray every step, a line-of-sight ray per rival every
  target pass), and a slow frame multiplies it: the fixed-step catch-up runs up to six steps a foe a frame at the
  host's 0.1 s clamp. Texture decodes and uploads at a species' first stand are unbudgeted.
- **The ship's raid lands thirteen foes in one quest tick**, while its `say 1013` box holds the player and the quest
  machine but not the foes (WINFOE1 keeps the pools running under a window), so the `change foe` actions cannot turn
  the new crew until the box closes.
- **SquidKamer's free-space reading is half right.** DFU's OverlapSphere(0.65) meets placed foes' capsules, and a spot
  that is taken makes the foe wait a tick - it limits how FAST a wave appears, never how many (CreateFoe retries with
  no give-up). The port's placement saw only foes that had LANDED, so a wave of one tick saw none of its own.

## CAMP-SEA: the land's camps stand down over the deep (report 3)

The deep's own population is why the land's rolls stand down over it (SuppressVanillaWaterEncounters sets
PreventEnemySpawns in or above deep water). The lone roll honoured it. The port's chunk-load CAMP roll (CAMP1, an
original) did not: it runs on the pixel crossing, before the frame writes the flag, and the lone roll clears the flag
at its tail - so at sea it read `false` every time and stood three groups of two to five land monsters on the carved
seabed. The crossing asks the deep itself now (`scenes/world.js _deepSuppressesSpawns`, the frame's flag write asks the
same), and a swimmer too, as the lone roll's gate does.

`test/campsea.test.js` (2); `tools/mutants/campsea.json` 3, 3 dead.

## QUEST-WAVE: a wave placed in one tick sees its own stands in flight (report 3)

Every quest placement arm (the street's and the city's, the interior's and the dungeon's) holds the spot it chose until
its stand lands (`scenes/questFoeHost.js heldSpots` / `holdSpotWhile`), and asks the held spots beside the pool - so a
spot that is taken refuses the next foe of the same tick, which waits a tick, as CreateFoe's does. On a deck every ray
meets a rail and every spot of a tick falls in the same two small slivers: measured, thirteen placed at once stood with
24 to 43 pairs inside each other; now two to four stand per tick and none overlap, the rest following as the first move
off. The loose-foe door (AUDIT 68 S21) held its spots already; its set is the same one now, so a quest wave and a loose
foe see each other in flight too.

`test/questwave.test.js` (3); `tools/mutants/questwave.json` 6, 6 dead. Re-aimed: `test/audit62_hosts.test.js`,
`test/interiorfoes.test.js` (the occupancy pins), `test/qx1_exterior_host.test.js` (its two loops sample the law's
geometry, so each stand lands before the next is placed; the mount takes the two new names).

Open, for Mac: whether foes should stop under a quest's message box offline (DFU pauses the game there; WINFOE1 chose
otherwise), how much of Iliac Puddle No More's population the port should keep (the mod's defaults stand, and online
forces them), and whether foes should push each other apart (DFU's controllers do). The AI's cost under a crowd is the
performance half of report 2.

## SEA-CAP: at most 32 of the deep's foes by default, and online (report 3)

Mac, asked what the port should do about Iliac Puddle No More's population: "Yes, cap at 32". The mod's rules stand -
its pulse, its budgets, its table, its hostile-at-spawn - and the port's default for `General.MaxLiveEnemies` is 32
where the mod ships 128 (`systems/modSettings.js`); the room forces the same online (`systems/onlineLane.js`), where
every client stands its own deep. The mod's range stays, so a player offline may still raise it to 256. A deep-water-
only rule was weighed and not taken: a ship at sea is already over deep water, so it would not have touched the ship's
case. Ledger A row.

`test/seacap.test.js` (2); `tools/mutants/seacap.json` 3, 3 dead.

## FOE-CATCHUP: a hitch cannot snowball (report 2)

Mac, asked: "Yes, add the cap". A foe's body steps at FIXED_DT for whatever time its frame hands it, up to the world
host's 0.1 s clamp - six steps a foe at 10 fps. A step is the port's dearest work: measured over a crowd of 128 in four
teams, 54% of the time is the collider's rays, and 84% of those are ClearPathToPosition's (the path check's capsule
casts, every step a foe pursues, as DFU's EnemyMotor does in FixedUpdate); the target machine's sight rays are 14%. So
under a crowd one hitch made the next frame dearer and that one dearer still - 0.7 ms a frame at 60 fps became 43 ms
at a 0.1 s frame. The pools now hand their foes at most three steps' worth a frame (`characters/enemyMotor.js
foeFrameDt`, at the street's, the watch's and the dungeon's step): from 20 fps up nothing changes; below it foes move a
little slower than the world, instead of the world stopping. The motor's own `update(dt)` contract and the player's
jank clamp are unchanged. Ledger A row.

`test/foecatchup.test.js` (3); `tools/mutants/foecatchup.json` 5, 5 dead; `test/audit24_wave32.test.js` and
`test/exteriorfoes.test.js` re-aimed at the capped call.

## QUEST-POPUP-PAUSE: offline, a quest's box holds the foes again (report 2)

Mac, asked: "Pause them offline". DFU's message box pauses the game (UserInterfaceWindow.PauseWhileOpen), so a
quest's box held every foe; WINFOE1 (`06-Systems/Systems-Arc.md`) let the pools run under every window, so the raid's
`say 1013` box held the player and the quest machine while the thirteen raiders it announced came on. Offline, a quest
box that is open and the window on top of its slot hands the pools a zero frame again: the street's encounter pool and
watch and the town's answer (world.js, exterior.js), and the interior pool and indoor watch through the mode machine's
bag (`host.questBoxHoldsFoes`). The rule is one function, `scenes/questFoeHost.js questBoxHoldsFoes`. A rest window
keeps WINFOE1 (a foe still walks up and breaks a rest), and a rest under a box resumes with the foes when it closes;
the dungeon already held its foes under any window. Online nothing is held: the room keeps one clock for everyone.

`test/quest_popup_pause.test.js` (3: the rule, a real pool handed the zero frame, the wiring by source);
`tools/mutants/questpopuppause.json` 11, 11 dead; `test/winfoe1_foes_under_windows.test.js`, `test/disc19.test.js`,
`test/interiorfoes.test.js`, `test/qx1_exterior_host.test.js` and `test/roadb_indoor_watch.test.js` re-aimed at the held
clock.

## FOE-SPACING: a pack keeps apart (report 3)

Mac, asked: "Yes, add it". DFU's foes are CharacterControllers: one that walks into another is stopped by it, so a pack
spreads round what it hunts. The port's foes are not in the collider, so nothing stopped one at another: a pack
converged on one spot and stood there in one heap, every one of them in reach. Each pool now pushes apart, once a frame
and before it steps its foes, every two of its bodies whose capsules overlap (`characters/foeSpacing.js spaceFoes`):
each takes half the overlap, at most 3 m a second, so a heap of eight spreads in a few frames; through the collider, so
no wall is crossed; and never off an edge - a walker the push would leave with no ground under its centre (the drop the
motor's own fall check refuses) stays where it was. Flyers, swimmers and levitators keep their height. The street's
encounter pool and the watch (and so the interior pool and the indoor watch, the same factories) and the dungeon's; not
the dead, not a puppet another client poses, and in a shared dungeon not a room foe this page does not own. The push
runs on the frame the pool hands its foes (FOE-CATCHUP's cap), so nothing moves under a held frame. Measured: 0.07 ms a
frame for 32 bodies, 0.7 ms for 256 heaped in a 3 m square. A watchman and a monster, in two pools, can still stand in
one spot. Ledger A row.

`test/foespacing.test.js` (6: a pair, a heap, the skips, a wall and an edge over the real collider, a real encounter
pool, the three pools by source); `tools/mutants/foespacing.json` 13, 13 dead; `test/world2.test.js`'s loop pin re-aimed.

## DEEP-SHARE: players near each other share one sea (online)

Mac, told that each player's game stood its own deep and a reader saw at most twelve of another player's foes (the
deep's among them): "Yes" to one player standing the sea's creatures for everyone near. So two players at sea
together saw two different seas, and each stood a whole cap. Now:

- **One deep a group.** The players within the mod's populate radius (200 m) of each other stand ONE deep - the lowest
  id among them, the camps' own election (`systems/campEncounters.js amGroupRollOwner`, through
  `scenes/deepWatersHost.js standsTheDeep`). Only that player's spawner populates a pixel (world.js, the lane's
  attempts); a player that near it is inside a pixel it populates. Offline, or alone, a player stands its own.
- **No foe vanishes mid-fight.** A player who stops being the one populates no new pixel; what it stood stays until it
  dies or its pixel is left, as the mod releases it anyway.
- **Never more than one cap round a player.** A spawner's cap is the setting less the live deep foes other players
  stand within 200 m of it (`deepWatersEnemySettingsNear`, the reader's `deepPuppetsNear`) - so a handover's leftovers,
  or two players standing their own deeps in one 819 m pixel, never double the sea; at the cap the mod's own rule
  forfeits a pixel's attempts, as it does alone.
- **Everyone sees all of it.** A frame names its deep foes in `dz` (their record numbers - the frame's field, like the
  camps' `st`), and a reader stands them under their own allowance, `DEEP_PUPPETS_MAX` = 32, the room's forced cap
  (`scenes/exteriorFoes.js`). Other loose foes keep the old twelve. A whole owner (8 + 4 + 10 + 32 live) still fits one
  64-record frame. The record's law (`net/wire.js`) is untouched and the relay reads nothing inside a foes frame, so no
  relay change and no version bump; an older client ignores `dz` and stands twelve, as before. (A first cut tagged the
  record itself, which moved the wire and so the relay's version - the full check refused it.)

`test/deepshare.test.js` (5: the election, the cap, the frame's law, an owner's twenty and forty over two real pools
with a junk `dz`, by source); `tools/mutants/deepshare.json` 16, 16 dead; `test/dwe_enemies.test.js`'s lane pin and
eight older mutant records (`dwe.json`, `watch1.json`, and `survtiers3.json`'s two cites the move shifted) re-aimed.

## QUEST-PARTY phase 1: a shared quest's foes ride to the party (online)

Mac asked how quest enemies could be synced online "without it becoming an issue", and chose "Party shares them":
the ship raid's pirates (and any shared quest's foes) are now one set for the party - the member who shared the
quest stands them, the party sees and fights them, each copy counts the kills it sees, and no stranger sees, strikes
or is hunted by them. The record is `06-Systems/Online-Arc.md` (QUEST-PARTY). Phase 2 followed: a host who dies,
walks out or drops its connection hands the quest's foes to a party member, bound to that member's own copy. Phase 3
(Mac: "Dungeons and buildings") came in parts: the relay's own lane for a dungeon or a building (OWN1 - a relay deploy,
world118 - world114 on this branch, renumbered past main's world114-117 at the merge), then a building's foes on it, each player's own as a cell's are, with a quest marker's foe standing once for
the party (3b); and a dungeon's shared quest foes on it, each its spawner's whoever hosts the room (3c).
