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

## Not fixed here, seen on the way

- The contact shadow ignores the world viewport rect when the large HUD
  is docked.
- A torch stowed from inside an open inventory keeps its sound until the
  window closes. The rig's frame is held while a window is open, and the
  loop stops on the next rig update.
