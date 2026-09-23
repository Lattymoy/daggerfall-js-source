# FIELD BUGS 2026-09-23 — DISC6, six from Discord and one of Mac's

Mac, with the Discord screenshots: *"Can we tackle the known limit along
with the following bug reports. Additionally ensure cricket noises can be
heard in interiors"*.

1. *"Theres no quest notification when you killed all monsters and no
   quest update in the log"*
2. *"the rain sound in Taverns is louder than outside dont know if thats
   happening for every interior"*
3. *"we need 3d audio right now it doesnt matter where enemies are it
   always sounds like the opposite or directly in front of you while the
   mob is behind"*
4. *"interior only - outdoor lighting is fine. in shops and taverns the
   point lights in ceilings make everything flash/flickering"* and *"the
   light flashes when I move around, similar thing inside mages' guild"*
5. *"i also had an edge case bug with torches sometimes even when putting
   it away it still makes the torch sound"*
6. The known limit (`06-Systems/Horse-Cart-And-Cargo.md`): other players'
   horses make no hoof sound.
7. Mac: crickets heard in interiors.

Every one was reproduced in node before it was touched. The pins are
`test/disc6.test.js` and `test/audio3d.test.js`, and the mutant sets
`tools/mutants/disc6.json` (20) and `tools/mutants/audio3d.json` (17) all
die.

---

## DISC6-B: the kill that never counted

**Cause.** A party's shared-quest resync (`machine.updateSharedQuest`,
run on every change to a partner's log) calls `quest.restoreSaveData`,
and that call REBUILDS the live quest's resources. The foes already
standing keep a `QuestResourceBehaviour` whose `cacheTarget` resolved the
quest and the Foe once and held them. After a resync every death was
counted into the orphaned Foe, while the `killed 2 _rats_` trigger read
the new one. The last kill never fired the task, so there was no popup
and no log step. The scratch harness showed it: live killCount 0, orphan
2, popups `[]`.

**Fix.**
- `resourceBehaviour.update` lets go of a target the quest no longer
  holds and resolves it again. It checks two things: the machine's quest
  by UID, and the quest's resource by symbol.
- `updateSharedQuest` keeps THIS world's Foe counters. A kill made before
  the resync is not wiped back to the partner's number. The kill count
  takes the larger of the two copies, and the injured, restrained and
  dying flags are ORed. Action completion was already kept monotonic the
  same way.

## DISC6-C: the rain in the tavern, and the crickets indoors

**Cause.**
- The hosts' modal branch returned before the street's ambience tick. The
  loops held their last street gain and their clocks stopped. A shower or
  a night that began while you were inside never reached you.
- Better Ambience's muffled indoor rain (its InteriorAmbientSoundSource)
  played on top of the street's full-volume loop. The two copies of one
  rain made it louder than the street.

**Fix.**
- Both hosts tick `ambience.update` in the modal frame, with `{inside,
  underground, indoorRainSource}`. The weather word and the hour go with
  it.
- Inside a BUILDING, the street's loops are heard through the walls:
  - The rain plays at `INDOOR_RAIN_GAIN` (0.35), or at 0 while Better
    Ambience's indoor rain (`indoorRainPlaying()`) is the rain you hear.
  - The night's cricket chorus plays at `INDOOR_CRICKETS_GAIN` (0.35).
  - The one-shots (birds, thunder, the cemetery) stay outdoor things.
- Underground, the rain stays DFU's verbatim loop, and the crickets stop.
  CRICKET-DUNGEON's stop now actually runs; before this it sat behind the
  modal return.

This departs from DFU for buildings. The record is Port-Ledger A, THE
STREET'S AMBIENCE INDOORS.

## DISC6-D: 3D audio, the mirrored ear

**Cause.** The scene is DFU's LEFT-handed frame: x east, y up, z north,
so facing +Z the right hand is +X. The renderer turns it once
(`world/mat4.js` `mirrorProjectionX`). The audio never did, and WebAudio
is RIGHT-handed: its listener's right is forward × up, which facing +Z is
-X. Every positional sound in the port played on the mirrored side.

On top of that, the panners were equal-power, which folds every azimuth
past 90 degrees onto the front, so a foe behind sounded like one ahead.

**Fix.**
- `systems/audio.js` has one door, `audioFrame` / `placeAudio`, which
  reflects z. The listener's position and forward, every panner, and
  every loop move go through it, and every caller keeps speaking scene
  coordinates.
- Every panner is born in `_panner` with `PANNING_MODEL = 'HRTF'`.

`test/audio3d.test.js` checks the ear against the screen, through the
renderer's own view and mirror, facing north and facing east. HRTF goes
past DFU (Unity's stereo panner has no front/back cue) at the players'
ask. The record is Port-Ledger A, THE EARS.

## DISC6-E: the ceiling lamps that flashed

**Cause.** Only the `SHADOW_POINT_CASTERS` (8) lamps nearest the eye get a
cube shadow map, and a lamp without one lights through walls and floors.
A tavern has a dozen lanterns in reach, many at nearly the same distance,
including the rooms upstairs. The bare nearest-N pick swapped near-ties
on every step and every head-bob, and the lamp that lost its map flashed
through the ceiling for a frame.

**Fix.** `render/shadowPass.js` `CASTER_KEEP_RATIO` (0.8). A lamp that
cast last frame is measured at 0.8 of its distance. Last frame's casters
are matched by position (`holdCasters`, Float64 so the match is exact),
so a newcomer must be clearly nearer to take a map. The set changes when
the player really moves, never on a tie.

## DISC6-F: the torch that burned on in the pack

**Cause.** Every host mode has its own weapon rig (the street's, the
building's, the dungeon's), and each rig's Handheld Torches component
starts and stops its own burning loop in its own update. A torch lit in
the street kept the street rig's loop sounding through a door, because
that rig no longer ticks. The building's rig started a second loop.
Stowing the torch indoors stopped only that second one.

**Fix.**
- `handheldTorches` has `silence()` and the rig has `silenceTorch()`.
- The hosts call it for the rig that leaves the frame:
  - `world.js` and `exterior.js` call it at the mode edge.
  - `worldModes.setMode` calls it for the building's rig.
- The rig that takes the frame starts its own loop if the torch still
  burns.

## DISC6-A: the peers' hooves (the known limit)

**Built.** Each riding peer runs TransportManager's riding half
(`systems/riding.js` `RidingAnimator`) off their pose. `rd` is the mount
and `mv` is moving. It drives:
- the fast clop, or the cart's own loop
- the 0.2 s stop, so a step-pause does not chop the clop
- the volume
- the neigh

The sound plays AT them, through `audio.setLoop3d`. That is a named
positional retrigger loop: DFU's ridingAudioSource, which swaps its clip
at the seam and never restarts it. The loop is moved every frame and
stopped on a dismount, a departure or the dead's empty sync.

Peer footsteps and swings play at the peer now too (`peerSound`), where
PEER-FS1 faked the falloff on a flat one-shot. All of them share
`PEER_SOUND_PROFILE` (full inside 6 m, silent past 30, linear), and the
hooves follow the peers' footsteps switch.

The pose carries no speed, so a peer's horse keeps the fast clop, which
is DFU's opening clip. The local rider's half-speed swap to HorseClop is
not reproduced for peers.

## Not fixed here, seen on the way - FIXED BY DISC7, below

- ~~The contact shadow ignores the world viewport rect when the large HUD
  is docked.~~ Fixed (DISC7).
- ~~A torch stowed from inside an open inventory keeps its sound until the
  window closes.~~ Fixed (DISC7).
- ~~The pose carries no speed, so a peer's horse keeps the fast clop.~~
  Fixed (DISC7).

---

# DISC7 - the three gaps, and the verbs on the plaque

Mac: *"1. fix the known gaps 2. for player interaction and horse
interaction, instead of using a keybind toggle, let's reuse the loot
scroll menu to select options"*. Pins: `test/disc7.test.js` (11). Mutants:
`tools/mutants/disc7.json` (38, all dead), plus fourteen older records
re-aimed by content and two retired with the prompt they covered.

## ACT-MENU: the verbs, on the loot plaque

**Before.**
- A player: F opened a card over the world (Add friend / Invite to party /
  Trade / Cancel), a pointer surface, clicked and closed by F again.
- My horse and wagon: the verb was DFU's interaction mode, set beforehand
  with F1-F4. Steal opened the wagon, Info named the horse, Talk
  commanded it, and anything else rode.

**Now, where the World Tooltips plaque stands (the enhanced skin, not on
touch).**
- The plaque lists the verbs as rows, exactly as it lists a pile's items.
  It is the same frame (`kind: 'actions'`), the same fold, the same wheel
  and the same highlight (`systems/quickLoot.js`).
- The activate key presses the lit row. On a player, F does too.
- A player's rows are the F-menu's enabled acts, in its order and words
  (`peerActionRows`). They press through the card's own door (`peerAct`),
  re-read at the press. The relation ("In your party", "Friend") stands
  under the name.
- My horse's rows are the mod's own decision
  (`horseCartLaw.js hccActionRows`):
  - Ride, or Drive the wagon for a hitched team.
  - The command the horse can take now: Follow me, Wait here, or Follow
    me with the wagon.
  - Name.
- My wagon's rows are Hitch up, or Drive the wagon when it is following,
  and Open the wagon.
- Each row carries the MODE the mod reads, and the runtime's own handler
  runs in that mode. Every refusal, reach test and line is the mod's.
- Another player's horse or wagon lists nothing. It is theirs, and a press
  still says whose it is.
- Where the plaque cannot stand (the classic skin, a touch device), the
  card and the interaction modes are as they were. The press on a
  touchscreen goes through the finger's own ray, which the plaque cannot
  name.
- A plaque that stands down (a window, a skin switch) forgets its
  highlight, so a click can never press a verb it did not show.

## The peers' clop (GAP-1)

The pose carries the rider's half-speed flag: `hs`, PlayerMotor's own
IsMovingLessThanHalfSpeed. It is sent mounted and moving only, and
omitted at 0, so every other pose keeps its bytes. Its edge goes out at
once. The receiving RidingAnimator swaps HorseClop and HorseClop2 and
halves the volume on it, as TransportManager does for the rider.
RELAY_VERSION is world100. The relay deploys itself on the merge and drops
every connected player once.

## The torch in the pack (GAP-3)

`systems/lightSource.js setLightSource` is the one door for the light in
hand. The six writers go through it:
- Use: light, douse, swap
- the transfer out of the pack
- the burn-out
- the load
- the mod's hand law

A listener in the Handheld Torches component stops its loop on the
change. Before this, the loop stopped on the rig's next tick, which a host
holds while a window is open.

## The contact shadow's rect (GAP-2)

The contact march read last frame's depth as if the world viewport were
the whole canvas. Under a docked large HUD every sample came from the
wrong row, and near the bottom from the bar's cleared strip. It maps
through the rect the depth was written under now (`holdPrevRect`,
`prevDepthUV`), as every other screen pass maps through its rect.

Not verified in a browser or online.
