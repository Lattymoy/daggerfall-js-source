# FIELD BUGS 2026-09-23 — DISC6, five from Discord, the known limit and one of Mac's

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
  loops held their last street gain and their clocks stopped. A night that
  fell while you were inside never reached you.
- Better Ambience's muffled indoor rain (its InteriorAmbientSoundSource)
  played on top of the street's full-volume loop. The two copies of one
  rain made it louder than the street.

**Fix.**
- Both hosts tick `ambience.update` in the modal frame, with `{inside,
  underground, indoorRainSource}`. The hour goes with it (the night's
  preset). The weather word and the rain's gain stay the street's last:
  the weather front does not tick indoors, as DFU's WeatherManager does
  not (corrected by AUDIT DISC7 B1, below).
- Inside a BUILDING, the street's loops are heard through the walls:
  - The rain plays at `INDOOR_RAIN_GAIN` (0.35) of the street's own
    gain, or at 0 while Better Ambience's indoor rain
    (`indoorRainPlaying()`) is the rain you hear.
  - The night's cricket chorus played at `INDOOR_CRICKETS_GAIN` (0.35).
    Superseded by DISC8-A (Mac: "no crickets indoors please"): the chorus
    stops at a building's door as it does underground, its clock held.
  - The one-shots (birds, thunder, the cemetery) stay outdoor things.
- Underground, the rain loop carries on at the street's gain (DFU's
  verbatim carry-over), and the crickets stop.
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
`tools/mutants/disc7.json` (38, all dead), plus eighteen older records
re-aimed by content (quickloot 6, worldhover 5, peerplaque 4, el8 2,
soc1 1) and two retired with the prompt they covered. DISC6 re-aimed
four of its own (worldhover 2, cricketdungeon 1, cricketquiet 1).

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
- (Revised by AUDIT DISC7 A2/A4, below: a player's list starts unlit, and
  every act the card offers is listed, a refused one with its reason.)
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

---

# AUDIT DISC7 - four lenses before the merge

Mac: *"Do an audit before we merge"*. Four read-only lenses went over
everything on the branch since main (DISC6 + DISC7):
- A: the verbs on the plaque
- B: audio, the riders and the wire
- C: the torch, the lights and the quest
- D: the evidence, the records and the hygiene

Every verified finding is paid below. The pins are `test/auditdisc7.test.js`
(10, by execution) and additions to `test/disc6.test.js`,
`test/disc7.test.js` and `test/peerplaque.test.js`. The mutants are
`tools/mutants/auditdisc7.json` (35), and the older records were re-aimed
by content. Nine older source pins followed the new shapes without
changing their law: the two exit ladders' anchors (`tryExit(`,
`tryExitDungeon(` - they now take the press's `pressCast`) in AUDIT 28
W2c, AUDIT 65 HP-2/3, DQ1, JAN1, QG1 and TS1; SC1's cadence (now
`nearestRank`); AUDIT-EL F18's bail (now clears `prevValid`); MWBODY1's
sync call (now hands `poseAgeMs`). The 3D handedness claim was proven with the real renderer
matrices and the WebAudio azimuth law at every yaw and pitch, and it
holds.

## The verbs on the plaque (A)

- **A1, major.** A touch spell's release still runs the activation (DFU's
  own exception), and the plaque's player arm fired on it: every touch
  heal on a party mate also sent the lit act. The activate gate now says
  when a release ended a press that cast (`pressCast`), and the player arm
  never fires on one.
- **A2, major.** The list started lit at row 0, so a plain click on
  another player sent a friend request or a trade, and a player in a
  doorway took every click meant for the door. A player's list starts
  UNLIT now, and a click passes to the ladder until the wheel or F lights
  a row. F on an unlit list lights its first row. My horse's and wagon's
  lists still open lit on Ride, the mod's default.
- **A3.** The lit row kept its index when the list changed under it, so a
  second click pressed the verb that slid into the slot. The highlight
  follows its verb by id.
- **A4.** The card's refusal reasons were unreachable on the desktop, and
  a refused press was silent. The plaque lists every act the card offers.
  A refused one is shown in italics with its reason ("Add friend (request
  sent)"), and pressing it says the reason on the chat tab.
  `ui/socialMenu.js socialPlaqueRows` / `plaqueRowFor` build both
  surfaces off the card's own rows.
- **A6.** The player pick had no wall test: a player behind a wall was
  named, lit and pressed. `peerInSight` runs the live mode's collider
  along the ray.
- **A7.** A single lit verb no longer eats the wheel, which goes back to
  the camera.
- **A8.** Every door that takes the plaque down now folds the highlight
  away: the hide, the contained fault and the skin gate.
- **A9.** The press re-picks the player on its own ray. A verb lit on the
  last frame is for the player under the crosshair now.
- **A10.** A parked wagon over a team left hitched reads "Drive the
  wagon", as the horse's row does for the same hitch.
- **A11.** Indoors and underground, the player arm moved inside
  `tryExit` / `tryExitDungeon`, after QG1's non-consuming quest click and
  the tap's lock, as the street orders them.
- **Recorded, not changed: A5.** Indoors in third person, the plaque's
  race measures the ground from the camera and the press from the eye
  (the loot plaque shares this; it predates DISC7). With A2 and A9 a
  player act needs a lit row and a fresh pick on the press's own ray, so
  it cannot take a click it was not aimed at.

## Audio, the riders and the wire (B)

- **B1, major.** DISC6's modal branch forced the rain's gain to 1 and the
  word to the raw weather. Under the enhanced front the street's gain can
  be 0.15, so a tavern at 0.35 was louder than the street, which is the
  Discord report again. A dungeon was up to 6.7 times louder. The word
  and the gain now stay the street's last, and only the hour is re-read.
  A building is at most the street, and underground equals it.
- **B2.** `hs` was sent as 1 during the move hold after every stop
  (standing reads "slow"). It is latched off frames that moved.
- **B3.** A rider whose poses stopped (a background tab, a crash) clopped
  in place until the peer timed out. A pose older than
  `PEER_RIDE_STALE_MS` stands the horse.
- **B4.** The riding loop and the neigh are made only within earshot.
  A rider first seen already mounted (a room join, a cell crossing) keeps
  the ordinary neigh cadence instead of UpdateMode's mount neigh.
- **B6.** The riders' loops move with the floating origin in the frame it
  moves (`rebaseSounds`), with no one-frame dropout per crossing.
- **B7.** A named loop whose clip could not play (switched off, not
  loaded) is re-armed by its owner's next set. A clip that cannot play
  builds no panner.
- **B8.** The wire takes `hs` by `uint` (as `rd` and `rv`), and the
  sender omits it rather than sending 0.
- **Recorded, not changed: B5.** HRTF costs more per source than equal
  power. Torches are culled to 5 m and peers to 30 m, but windmill hums
  and dropped torches are not distance-culled. No overload was found.
  The one mitigation on offer (warming the HRTF database) rests on an
  unverified browser claim, so it is not shipped.

## The torch, the lights and the quest (C)

- **C1, major.** Turning Handheld Torches off disposes its component,
  and turning it on runs the same component again. The light listener
  was made once at birth, so after one toggle the DISC7 fix was gone for
  the page. The component now subscribes on its update, as HT6 re-arms
  its hand law.
- **C2.** A shared-quest resync rebuilt the resources under standing
  quest people, items and foes. Their behaviours kept the old symbol
  object, so the next Place mount's `isAlreadyInjected` stood them again.
  The machine now keeps weak references to its behaviours, and the resync
  relinks every one on its quest at once, symbol included. Save/load is
  untouched (the mount's documented DFU quirk).
- **C3.** The resync's shorter queues under a behaviour's cursors
  re-added a foe's whole item queue and re-cast spells. This world's
  longer queue is kept.
- **C6.** With the keep margin, the every-frame shadow redraw could go to
  a held caster that was farther away. It goes to the two truly nearest
  (`nearestRank`).
- **C7.** A frame that bailed on a zero viewport left the next frame
  pairing two-frame-old matrices with last frame's depth. The bail now
  clears the previous frame.
- **Recorded, not changed.**
  - C4: kills split across two worlds are not summed (max, not sum).
    That only matters if a Foe's spawns are shared, and they are
    per-world.
  - C5: the per-frame nearest-N light cut (48 enhanced, 16 classic) is
    pre-existing and stable on ties. It is not the shop flashing.

## Evidence, records and hygiene (D)

- **D2.** The claim "a shower that begins while you are inside reaches
  you" was false. It is corrected in the code comments, the ambience
  header, this page and Port-Ledger A.
- **D3.** The press's re-read is a pure function now (`plaqueRowFor`),
  run by the tests and covered by mutants.
- **D4, D5, D13.** The re-aim counts, the Port-Status ordinals and the
  counts in titles are corrected.
- **D6.** Stale docs describing the prompt and the card are updated: the
  socialPick header, world.js's SOC5 block, Social-Party-Arc,
  Online-Arc, the PEER-PLAQUE1 Testing row and test title.
- **D7.** The resync ORed back `restrained`, which the quest's own
  actions set and clear. A partner's clear could be undone. Only this
  world's events are kept now: an injury, and a pending kill (no save
  state carries it).
- **D8, D9, D11, D12, D15.**
  - D8: the peer file's comments are back on their imports and class.
  - D9: a malformed Settings-Screen-Spec cite is fixed.
  - D11: the tests dispose their torch components.
  - D12: the TransportManager cite is :255-269.
  - D15: the HCC activators name their parameter `mode` throughout.
- **D10.** el8's prepare-prev-is-current record is left as re-aimed: it
  still kills by the view-projection law.
- **D14.** horseCartLaw's claim is scoped: the horse's rows are the mod's
  decision, and the wagon's two rows are its two modes.

RELAY_VERSION stays world100. Its law row was re-hashed, because world100
has never been deployed and `hs`'s door changed under it. Not verified in
a browser or online.


---

# DISC8 - the second round from Discord

Mac, with five Discord screenshots: *"Yeah, no crickets indoors please..
also here's some bugs"*.

1. *"water momentum is also brual. If there are stairs and you weigh too
   heavy to swim then you cant get out and slopes are super slow."*
2. *"I think dungeon maps also have that strange village issue"* / *"The
   arrow is pointing in the right direction but when I go south on the
   map I go north"*
3. *"I also get stuck on the use magic item window"*
4. *"Went into building prohibiting weapon, now weapon cannot be
   equipped"*
5. *"when shooting arrows with the sprite bow it shoots sprite arrows and
   3d arrows at the same time, should be sprite arrows only"*
6. *"When I die from fall damage, for some reason I spawn in the air, and
   fall down and die"* / *"it resolved after crashing out of the game and
   reloading"*

Each was investigated to its cause in node before it was touched. The pins
are `test/disc8.test.js` (5, by execution), with re-aimed pins in
`test/disc6.test.js`, `test/friendlyspells.test.js`,
`test/jan1_field.test.js`, `test/automapsheet.test.js` and
`test/ui1_usemagicitem.test.js`. The mutants are `tools/mutants/disc8.json`
(10); the cricket records in disc6, cricketdungeon, cricketquiet and
friendlyspells were re-aimed. All die.

## DISC8-A: no crickets indoors

DISC6 took "ensure cricket noises can be heard in interiors" literally and
sang the chorus through a building's walls at 0.35. Mac: *"no crickets
indoors please"*. The chorus now stops at a building's door exactly as it
does underground (CRICKET-DUNGEON), with its clock held, so the street
takes the night up where it stood. `INDOOR_CRICKETS_GAIN` is gone. Port-Ledger
A's row says so.

## DISC8-B: the swimmer who could not climb out

**Cause.** Not a water law. The motor's swim laws are DFU's: an
over-encumbered swimmer sinks (`LevitateMotor.cs:81-84`, AUDIT 26 F027),
so the motor hands the collider a downward move every step, even standing
on the bottom. The collider's vertical phase resolved that move by
pushing the capsule out along the contact normal. On a slope that normal
leans, so each step's sink became a shove downhill (net progress
`cos²θ − sinθ·cosθ`: 40% at 26.6°, nothing at 45°). On a tread's edge it
shoved the capsule straight back off the step it had just climbed, so the
swimmer bounced at the first riser forever. A walker never shows it,
because a grounded walker moves with dy = 0.

**What DFU does.** PhysX's CharacterController (Unity's) sweeps the down
component alone with `maxIterDown = 1`: a descending controller that
meets the ground stops on it and never slides.

**Fix.** `collider.move`'s down pass is collide-and-stop. When a downward
move lands grounded and the resolve pushed it sideways, the capsule comes
down only as far as it goes unpushed (bisected), x and z untouched. Moves
with dy = 0 are bit-identical. An 80 kg swimmer now climbs a pool's stairs
in about 3.5 s, and keeps pace with a light one up a 26.6° slope.

**Recorded, not changed.** Every capsule still loses about cos²θ of its
speed walking up a slope (3.54 m/s against 4.43 flat at 26.6°); Unity's
side pass runs at the lifted height and does not. It is general, not
water's, and a separate slice. DFU's "cannotFloat" message is still
missing (Port-Status-2026-09.md:43).

## DISC8-C: the dungeon map drawn upside down

**Cause.** EM-BUG3's "village issue" was the enhanced town sheet laying
+Z down the paper, so the plan was the north-south mirror of the world.
The enhanced DUNGEON and interior sheet (`src/ui/automapSheet.js`) never
got that fix. Its `toPlan` measured y with +Z and the paper's y grows
down, so north was down the sheet, while the caret's heading
(`inkMap.js` `paintCaret`) is north-up. The arrow pointed right; the
position ran the other way. A second fault shared the seam: the
walked-this-run wash was left in world units, a level's origin away from
its own walls. The classic 3D automap is not affected.

**Fix.** The plan's y is measured south from the level's north edge (the
town sheet's `sheetY` law), and the occupancy grids cross the same seam
(rows reversed). The caret, the beacon, the notes and the teleporters all
went through `toPlan` already. The pins had restated the code (a player
at the level's exact z-centre passes either way); the home-view pin now
stands off-centre.

## DISC8-D: stuck in the Use Magic Item window

**Cause.** DFU's `AllowCancel = false` (:34-35) only switches off the
base class's Escape ("Prevent duplicate close calls"), because the
window's own Update (:68-80) closes it: the UseMagicItem key or the back
button arms on the press and closes on the release. The port read it as
"Escape does not close this one" and left the toggle to a host that never
had one. Nothing closed the window except using an item: not Escape, not
U, not the touch X, not the pad Back.

**Fix.** The window carries DFU's Update: a U or Escape press arms, the
matching release closes, using nothing. The release of the press that
opened it finds nothing armed. The backdrop is clear (:33).

**Recorded, not changed.** With nothing usable DFU says "You have no
usable magic item" (`DaggerfallUI.cs:584-585`); the port says nothing.

## DISC8-E: the weapon lost at a building's door

**Cause.** No building forbids weapons, in DFU or the port. The port has
four weapon rigs against DFU's one WeaponManager, and JAN1 (2026-09-18)
gave the doors `host.weaponPose` / `host.applyWeaponPose` to hand the
sheathe and the hand across. It put them in the INVENTORY window's deps,
which never read them. `worldModes` asks the `createWorldModes` bag,
which had neither, so no door ever handed the pose. A drawn weapon
vanished indoors (the building rig starts sheathed), and a rig left on an
empty left hand showed a fist with a sword equipped. JAN1's pin was a
text match anywhere in the file.

**Fix.** Both hosts hand the pair in the `createWorldModes` bag. The pin
now reads that bag's own braces and refuses the inventory's.

## DISC8-F: two arrows from the sprite bow - not reproduced (FOUND AND FIXED: ARROW2, below)

One loose draws one shaft, model 99800, in every host (the open world,
interiors, the dungeon), exactly as DFU's DaggerfallMissile does; there is
no arrow billboard for a bow in DFU or the port (the only flat lane is the
Thunderlock's). A real weapon rig with a Long Bow gives one hit and one
bow sound per click; a peer's echo of your own shot is refused by id.
Candidates the report could be describing: the flying arrow's own shadow
with Enhanced Lighting on, or another player's shaft online. Waiting on a
clip and the reporter's settings (online or not, Morrowind arms,
Enhanced Lighting, first or third person). Nothing changed.

## DISC8-G: the fall that killed you twice

**Cause.** The motor's landing report (`landedFallDistance`, and `jumped`)
is a per-frame flag that only `update()` cleared. The open-world host
held the motor under any pausing window but billed the landing on every
frame regardless (only the season screen was gated). The death screen
pauses, so the fatal fall was charged again every frame under it. Online,
the respawn revived the player, the respawn box paused the game, and the
next frame's charge killed them again at the respawn point, forever. A
reload built a fresh motor, which is why it "resolved after crashing out".

**What DFU does.** CheckFallingDamage bills a landing once, from
FixedUpdate, which does not run under PauseGame's timeScale 0.

**Fix.** A held frame reports nothing: `PlayerMotor.holdFrame()` clears
the report, and both open-world hosts call it on every frame they hold
the motor. `spawn()` clears it too (a teleport or load). The modal hosts
already gated their readers.

---

# DISC9 - rain in the tavern with none in the street

Mac: *"Btw now it's not raining outside and you can hear it raining
inside? Stop shipping broken fixes"*.

**Cause.** Two readers answered "is it raining here" from two different
words. On the enhanced lane the street's ear follows what is FALLING (the
front's `soundWeather`): the front eases an episode in behind the cloud's
arrival and has dry spells inside it, so a 'rain' word over a dry street is
a cloudy day to the ear and the eye. Better Ambience's indoor rain
(InteriorAmbientSoundSource) read the sim's raw word instead. Walk into a
building while the sim said rain and nothing had fallen yet, and the mod
played a shower through the walls that the street did not have. Measured:
with the cloud not yet arrived, 30 s of a 'rain' word were 30 s of nothing
falling. DISC6-C made the street's rain and the mod's share one slot
without checking they read the same weather; they did not. The fault is
older than DISC6 (the mod always read the sim's word), and DISC6 is where
it should have been caught.

**Fix.** One word for every ear: `weatherSim.heardWeather()`. The outdoor
frame of both open-world hosts writes the word the street heard
(`setHeardWeather(ambientWord)`); indoors it holds, as the front does not
tick there (DFU's WeatherManager does not); a jump (a load, a travel
landing, a respawn) lands the player under the sim's sky whole and the
held word falls back to the sim's. Better Ambience's default weather is
`heardWeather`, and the modal ambience's preset reads it too. The classic
lane is unchanged (there the ear's word IS the sim's).

**Recorded, not changed.** The music's weather (`_musicLocationType`'s
state, world.js) still reads the sim's word, so its rain songs can start
before the front's first drop; the rules (summoning, survival) read the
sim's word by design.

Pinned by execution in `test/disc8.test.js` (DISC9, with the real front,
the real sim and the mod as shipped); mutants in `tools/mutants/disc8.json`
(4 more).

---

# DISC10 - the third round from Discord

(Not the survival-tiers branch's DISC10 further down, which fixed the
cart and the map mark from a different set of reports the same day; that
round's pins are `test/disc10.test.js`, this one's are named below.)

Mac, with three Discord reports: *"Also vampries and werewolf. I think
these systems are completely broken and not wired correctly"*.

1. *"Weapons when swapped into left hand dont work showing fists"*
2. *"during character creation, once you reach name selection you can't go
   back to any previous step, forcing you to either finish creating the
   character, or restart the game."*
3. *"Maps Can't Be Looted/Potion Recipe's can't be read."*
4. Mac: vampirism and lycanthropy, end to end.

## DISC10-B: no way back from the name page

**Cause.** Driven through the real wizard, the on-screen BACK does leave
Name (to the biography method, DFU's own arm). What the player reached
for did not:
- **Escape was dead on Name, and only there.** `nameStage` focuses its box
  on every paint, and the wizard's key handler returned on any key aimed
  at a text field before mapping Escape to back (CG2's rule, which let
  the player type in the box). No field types Escape, and DFU cancels the
  name window with its TextBox focused
  (`DaggerfallPopupWindow.Update` -> `CancelWindow`).
- **The step rail looked pressable and was not.** Its finished steps were
  enabled buttons with the menu's pointer and hover, and no handler. The
  wizard's own design says the rail is a walk, not a menu.
- **Escape on the first stage did nothing in this view.** The flow raised
  `cancelled` and the view only read `done` (the classic window reads
  both).

**Fix.** A text field owns every key it can type, and never Escape. The
view follows `cancelled` to the Cancel button's own exit. The rail is a
readout: out of the tab order, `aria-disabled`, no pointer, no hover.
Pinned by execution in `test/disc10_hand_chargen_maps.test.js` over a small DOM
(`test/chargenDom.mjs`).

## DISC10-A: a weapon swapped into the left hand showed fists

**Cause.** The rigs and the doors are right: a weapon in the left hand
draws and swings, through every door (DISC8-E). The quickslot SWAP was
not: `swapQuickslot` readied into the RIGHT slot whatever hand the player
was using, and no host told it the hand. DFU draws only the hand in use
(`WeaponManager.ApplyWeapon` :741-755), so on the left hand "You ready
your Dagger." stood over bare fists, every press, in every host and both
skins.

**Fix.** The swap takes the live rig's hand door
(`weaponRig.handDoor()`: the hand in use after this frame's UpdateHands,
and ToggleHand through the rig's own SwitchHand) and readies into the
hand in use; a two-hander is the right hand's, and when the table's own
law places the weapon in the other hand, the hand follows it through
ToggleHand, DFU's one door. The building's host hands its own rig.

**Recorded, not changed.**
- The enhanced pack's Morrowind figure shows the right hand's weapon while
  the pack is open (`enhancedInventory.js` setWeapon); the first frame
  after the close corrects it.
- Online, a peer fighting left-handed is drawn with the right hand's
  weapon: the pose carries no hand bit yet.

## DISC10-C: maps could not be looted, recipes could not be read

**Maps.** A map taken off a body runs its use arm (DFU's `TransferItem`
map arm, :1471-1478): read, spent, a location discovered. The DUNGEON
host had no reveal hook (`revealMap: null`, "no region index here"), so
underground - where bodies drop maps - the use fell to "You study the
map." and the map stayed on the body. worldModes never forwarded the
outer host's `revealLocation`, which already answers underground. It
does now; the standalone `?dungeon` page keeps its null.

**Recipes.** DFU reads a recipe through Info (`ShowInfoPopup` :1602-1609:
"Recipe for Potion of %po" and the chained ingredient list); its Use arm
refuses it. The classic window had that; the ENHANCED skin (the default,
and the only one online) has no Info mode - its item card is the info -
and the card had no recipe rows, so a recipe said nothing anywhere. The
card now reads "Recipe for" and "Ingredients" from one shared
`potionRecipeIngredientNames` (MCP's PotionRecipeIngredients). The
Potion Maker already saw carried recipes.

Pinned: `test/lh1.test.js` (3) and `test/maploot1.test.js` (3), by
execution.

---

# DISC11 - rain louder inside than outside, at last at its root

Mac: *"YOU ALSO KEEP FUCKING UP ITS LOUDER ON THE INSIDE COMPARED TO THE
OUTSIDE. YOUR DIRECTIONS ARE WRONG"*.

**Cause.** What the ear hears is gain times the recording's own level, and
the three fixes before this one (DISC6-C, AUDIT DISC7 B1, DISC9) each
balanced gains without ever comparing what is heard:
- The street plays DAGGER.SND's rain loop (389) at the front's level: a
  light shower is 0.15, a downpour 1.
- Better Ambience's indoor rain (InteriorAmbientSoundSource) plays its own
  AmbientRaining.wav at the AudioSource's volume, a flat 1, whatever falls
  outside. A tavern under a drizzle played a full downpour through its
  walls, in a different and louder recording. DISC6 only silenced the
  street's loop while it played.
- Underground, DFU's carried loop and the mod's source at the exit both
  played, stacked.

**Fix.** Every rain the player hears inside is derived from the street's:
- The heard seam carries the street's rain LEVEL beside its word
  (`weatherSim.heardRainGain`, written by both open-world hosts' outdoor
  frames; the classic level after a jump).
- The mod's source takes that level, matched to the street's recording by
  measured RMS (`AudioEngine.clipLevel`, once per decoded buffer), and in
  a building the street's through-the-walls factor (`INDOOR_RAIN_GAIN`),
  with the mod's low-pass after it. It is made at the level of that
  moment; indoors the level cannot move (the front does not tick there),
  and every door, load and weather change remakes it.
- Underground the carried loop stands down while the mod's source plays at
  the exit, which is the street heard at the door. Without the mod, DFU's
  carried loop at the street's level stands, never above it.

**The 3D directions, checked again in a real browser.** The same session
measured left and right in Chromium's own WebAudio HRTF through the
port's own `audio.js` (the listener and panner code as shipped): with the
game's camera at yaw 0 and at yaw 90, a source on the screen's right
plays in the right ear and one on the left in the left (L 0.024 / R 0.086
and mirrored). The renderer's projection puts those same points on the
same sides. Nothing was changed there.

Pinned by execution in `test/disc11.test.js` (gain times level, with the
mod's recording louder than the street's, at 0.15, 0.5 and 1; the dungeon's
exit; the jump). Mutants: `tools/mutants/disc11.json` (5).

---

# DISC12 - the gaps DISC10 left open, closed

Mac: *"THose open tasks? I need you stop stop being lazy and tackle it,
including the god damn double arrows"*.

## A peer's weapon hand, online

The look carries both hands' weapons; every receiver read the RIGHT hand
(`peerBodies.peerBuildOpts`, `remotePlayers._syncAttackSound`), so a player
fighting left-handed was drawn and heard with the right hand's weapon, or a
fist. The pose carries the hand in use now (`lh`, the LEFT hand, omitted on
the right), sent off the live rig; the Morrowind body's weapon follows it
through setWeapon when the arm is quiet (`peerWeaponOf`), and the swing's
sound reads the same hand.

## A peer in beast form, online

Nothing on the wire said a player was transformed, so the others saw the
person. The pose carries the form (`wb`, 1 werewolf 2 wereboar - the
curse's own infectionType - omitted in human form); a peer in beast form
stands as the enemy's own sprite (MobileTypes 9 / 14), puppeted off the
pose like a class sprite whatever the class-sprite card says, and takes no
Morrowind body. The relay moves to **world101** (validPose, poseChanged:
each edge goes out at once; lerpPose carries both). The merge deploys it and
drops connected players once.

## The pack's figure, the hand in use

The enhanced pack handed the Morrowind figure the right hand's weapon
while it was open. Each host hands the pack the live rig's hand
(`usingRightHand`, the pose's own read indoors and underground).

## U with nothing usable

DFU says "You have no usable magic item" (DaggerfallUI.cs:584-585,
Internal_Strings.csv:959); the port opened nothing and said nothing. All
three hosts say it now.

Pinned by execution in `test/disc12.test.js` (the wire's laws, the eased
pose, the body following the hand, the beast drawn as the beast, the pack's
figure, the HUD line). Mutants: `tools/mutants/disc12.json` (9).

The version's own mutant run turned up one survivor on HEAD, soc1 S23 (the
lead handed to the newest seat when nobody is online): no pin held the
all-away arm. `test/auditparty8.test.js` now holds it (every remaining seat
away - the longest-standing leads), and S23 names that suite.

# CONTRIB - the contributor's drop, integrated and read

Mac: *"Integrate these please. My contributer made these for the codebase"* -
two zips: the hotbar, player corpses, Resurrect, the death screen, UI sounds
(85 whole files), and a sprite-fix patch.

## The integration

The drop's files came off several bases; scored against every commit, the
nearest was 2b42cadb3, and the drop was committed there verbatim (branch
`contrib-hotbar`) and merged. Its relay steps world100-102 never ran on a
relay; ours had deployed world100 and world101 (DISC7, DISC12). The merged
graph is **world102**: DISC12's pose plus the drop's death flag `dd`, the
party pose's Resurrect call `rz` and fallen body `dd`, and the look's
widened `class`. Resurrect is registered (effect 45) but not craftable, as
MorphSelf is not, and carries its own spellbook description.

**The cites.** `citeMerge` read a line both sides carry verbatim as
THEIRS and moved its numbers through their diff - and the drop's
untouched comments sat beside targets that had moved on their side
(nine cites, `spellcost.js:182` -> :181 among them). A shared line's
number was read off one side's target and the line cannot say which;
the tool now maps it from both and moves it only where the two agree,
else prints it AMBIGUOUS for a person (`test/citemerge.test.js`).

## The read: three lenses, every finding verified in the code

- **A1 - Resurrect could not be cast at a body with no foe beside it.**
  The ready-made spell is ByTouch, and CastReadySpell's touch probe sees
  foes and standing mates only - a fallen mate is neither - so the click
  was eaten silently. The body the Resurrect gate already found is the
  touch.
- **A2 - one death, several bodies.** `sendDeath` speaks down the cell's
  socket and every halo's; the first copy took the peer off the list, so
  each later copy was a fresh death (a body and a cry per copy - a
  Thief's and a Breton's, the look gone). The session delivers one death
  per life; a living pose after it is a new life.
- **A3 - a party-told body met after the death never stood.** The memo of
  "seen" was written before the room check, so a body in a dungeon walked
  into later, or one a building's walls took from the scene, never stood
  again. `remotePlayers.partyBody` keeps each death's minute from its
  first word and stands the body whenever the scene is its own, crying
  once.
- **A4 - risen, and still looking at the sky.** The dungeon's clear and
  F11's online respawn skipped the view hand-back. Every close restores
  it (and the enhanced veil goes with the screen); F11 goes through
  Enter's reset.
- **A5 - three seconds to raise a mate on the classic skin.** The online
  hold was the enhanced face's alone; the classic reset respawned the
  player and cleared the body at DFU's three seconds. Online, the hold is
  the screen's on either skin, and the classic face says the count.
- **A6 - the Resurrect snapshot outlived a respawn.** Taken through the
  teleport's await with the player already healed, it made an old call
  raise the next death at once. It is taken only while dead and dropped
  on the first living frame.
- **P1-P3 - the dying player's foes, doubled or lost.** Every survivor
  judged "nearest" against its own lagging view, so two could take one foe
  (two owners streaming it) or none. The dying owner - the one true view -
  names each foe's heir on its last frame (`e`), and the survivor named
  adopts it on that frame's arrival. The watch is never handed; the owner
  lets go of exactly what it handed and keeps the rest.
- **S1 - a Thief before the introduction.** A peer heard by pose before
  its look arrived was drawn as a Thief, then nothing, then its class.
  No look keeps the doll until the look lands.
- **U1/U2 - the UI click.** Any one-shot in the 150 ms before a click
  (a hit, the ambience) swallowed it, and a touch held on a hotbar slot
  past 150 ms sounded twice. Only a sound chosen inside an input event
  counts as the click's own, and the window opens at the press.

Also: `OnlineSession` declares `onPeerDeath` (the type check), and the
drop's trailing comments moved back onto the lines they describe.

## The hotbar (the third lens)

- **H1 - the digits were taken from everyone.** The bar read 1-0 at the
  window's capture phase and swallowed them, so a digit the player bound
  to an action in the controls pane, and Horse Cart and Cargo's mount and
  summon (shipped on 5 and 6), never reached the host. And the diamond it
  replaces was only hidden: a pad's d-pad and a rebound key still drank,
  readied and lit from slots nobody could see, and with the HUD toggled
  off the digits fell through to them. Now the diamond is put away while
  the hotbar is in force (`hotbarInForce`: its five actions route nothing,
  its hold machine taps nothing), the bar steps aside for any digit bound
  to another action and for every enabled mod's hotkey
  (`modHotkeyCodes`), and its keys follow the game's pause, not the HUD's
  visibility. **Decision for Mac:** HCC's defaults (5, 6) and the hotbar's
  slots 5 and 6 still share keys - HCC wins, as a binding should; moving
  HCC's defaults is a KEY_MIGRATIONS row if the hotbar should have them.
- **H2 - the light slot lit whatever the mod picked.** It went to the off
  hand's toggle (the last light used, else a lantern, a torch, a candle):
  a Candle slot lit the Lantern, a Lantern slot put out a lit candle, a
  slot whose light was gone lit another. It is the pack's own Use on the
  slot's kind now - that light lit, the lit one of the kind doused, none
  left refused.
- **H3 - a refused press flashed gold.** The doors answer the route
  `true` whatever the performer decided. The four performers leave their
  own answer for the bar, and `readySpell` answers as DFU's SetReadySpell
  does (false on silence, no spell points, the hands mid-cast).
- **H4 - the bar keyed the whole pack once per slot every frame.** One
  pass now.
- **H5 - the bar's icons skipped DW3's dye.** Asked with it, as the
  diamond and the pack do.

Pinned by execution in `test/auditcontrib.test.js`; mutants:
`tools/mutants/auditcontrib.json` (21, all killed).

# ARROW2 - the double arrows (DISC8-F), found

DISC8-F counted shafts and found one. The second arrow was never a shaft:
it was the SPRITE's nocked arrow, drawn while the loosed shaft flew. A
per-tick drive of the real rig, the real Weapon Widget and the real
`drawFpsWeapon` (a synthetic WEAPON09.CIF, every quad recorded) showed it
on every shot with the widget off (80 frames of the nocked idle at 60 fps)
and at many frame rates with it on. Three DFU laws the port had not carried:

1. **The bow hides itself at the end of its release.** FPSWeapon.
   AnimateWeapon sets `ShowWeapon = false` as a bow's one-shot runs off its
   last frame (FPSWeapon.cs:529-531, "so its idle frame doesn't show before
   it is hidden for its cooldown"), and WeaponManager's cooldown early
   return (:229-233) leaves it hidden. The port's F024 latch froze the TRUE
   of the shot, so the idle frame 0 - an arrow on the string - stood on
   screen for the whole 1.3 s cooldown, and the widget's clone was never
   told to stay off-screen. `spriteShown()` now carries FPSWeapon's own
   hide to the classic sprite and the widget; an un-draw (no one-shot end)
   keeps the bow shown as DFU does, and the Morrowind arm keeps `shown()`.
2. **With BowDrawback off (the default) the bow idles DRAWN.** The idle
   loop lands on frame 3 (FPSWeapon.cs:533-534) and a bow keeps its frame
   into the strike (:261-262), so the instant shot twangs at +1 tick and
   looses at +2. The port idled at 0 and played the whole draw first,
   loosing at +5 - while the widget's clone, which starts at 3 as the IL
   does, let its sprite arrow go ~170 ms before the 3D shaft existed.
3. **One step per resume.** AnimateWeapon steps once and waits
   `WaitForSeconds(animTickTime)` (:545); a coroutine never resumes twice in
   a frame and drops the overshoot. The machine carried the remainder and
   could take several ticks in one frame, running ahead of the clone (which
   then missed the hit frame and never clocked its cooldown), and one long
   frame on the release ran StrikeDown to Idle at once. The port's own gun
   (FIELD-GUN7's lab clock) is no FPSWeapon and keeps its carry.

Pinned by execution in `test/arrow2_bowhide.test.js`: one shot at 60 and
50 fps, drawback on and off, widget on and off - no nocked frame on screen
from the first frame the shaft can be drawn until the cooldown ends, and the
bow back after it; the un-draw keeps the bow; the drawn idle and the +2 tick
loose; the one-step clock and the long frame; the gun's carry. Mutants:
`tools/mutants/arrow2.json` (9, all dead). `machijp.json` MAC-I re-aimed by
content.

Not changed, and rightly: the flying shaft casts a shadow under Enhanced
Lighting (`render/shadowPass.js`). DFU's shaft is
`CreateDaggerfallMeshGameObject(99800, ...)` (DaggerfallMissile.cs:238), a
plain MeshRenderer that nothing turns off, so it casts in DFU too - a
shadow on the ground, not a second arrow.

# DISC10-D/E - the vampire and the werewolf, wired at the root

Mac: *"I think these systems are completely broken and not wired
correctly"*. They were: every finding below was confirmed in the code
before it was changed, and each is pinned by execution in
`test/disc10_vampire.test.js` (V) and `test/disc10_lycan.test.js` (L).

- **H1 - the hit hook ran before the blow landed.** RacialOverrideEffect.
  OnWeaponHitEntity sat at the tail of the damage FORMULA, before any door
  subtracted health and past the ineffective-material early return: the
  werewolf's KilledInnocent never saw a dead innocent, and a vampire's iron
  blade on a ghost never fed. It is one dispatcher now
  (`worldTick.playerWeaponHitEntity`), called at the strike sites after
  the damage, where DFU calls it (WeaponManager.cs:627-635, :514-521):
  the three pools' swings (damage and zero-damage arms), the civilian
  murder, and every host's arrow. A peer's hit never reaches it.
- **V1 - sun damage by the wrong clock.** Catch-up magic rounds read each
  PAST round's hour; they read the live clock now (the `% N` cadences
  still count rounds). A two-day trip that lands at night burns nothing.
- **V2 - the curse deployed late.** `deployInfection` now makes the curse
  itself through a deployer worldTick registers, on the host's live clock
  after the time raise; a restored pending marker lands at the live clock.
- **V3 - every vampire was of one clan.** Both bite sites carry the region
  (the exterior pool learns `regionIndex` from all three hosts; the dungeon
  reads its location's), and `clanOf` reads the player's own faction dict.
- **V4 - the cemetery transfer from inside a building or dungeon.** The
  world arm leaves to the exterior first, and the dungeon context carries
  `transferToCemetery`.
- **V5 - the sheet showed the birth race.** `liveRaceTemplate` gives DFU's
  compound race name and flags to both character sheets.
- **V8 - resting through the change.** The deploy cancels the rest first.
- **V9 - online clocks.** Going online shifts the infection's
  `startingDay` and the werewolf's kill/morph/urge stamps with the shared
  clock (and `liveLycanthropy` survives a null effect entry).
- **V11 - the dream lost on reload.** An unplayed dream is re-scheduled on
  restore, for both infections.
- **L2 - the beast struck with a marker item.** `strikingWeapon` is the
  hand's item (WeaponManager.cs:909), so claws are hand-to-hand: the bare
  hand's damage, and no material gate.
- **L3 - the pack was refused at a few doors only.** The refusal lives in
  the inventory and trade windows themselves (DFU's MessageBox), so every
  way in - loot, wagon, sheet, counters, quickslots, quick loot - refuses.
- **L4 - the urge's health limiter ratcheted.** `maxHealth` is the limited
  view of a raw value that level-ups and the save keep.

Paid in the same round, found in the fix's own report:

- **The beast's blow sounded like a weapon.** Every player-strike hit
  sound, zero-damage arm and blood now read the striking hand's item, as
  `PlayHitSound(currentRightHandWeapon)` and :611's `strikingWeapon == null`
  do. And indoors, the encounter pool's hit-sound callback had been reading
  the struck FOE as a weapon - a bare fist always rolled the weapon family,
  at the ear; one `interiorHitSound`, on the foe with the hand's item, now
  serves both interior pools as `guardHitSound` does on the street.
- **The knightly smith's gift told a beast twice.** The pack door's own
  refusal box, then "That service is not available yet.": a ready door
  that built nothing refused, and that is now a dispatch.

Mutants: `tools/mutants/disc10.json` (69, all dead). Across the 109 mutant
lists naming a changed file, five survivors also survive on the base and
are not this round's (enhnotice3 AUDIT4-A8, font1 F2, macro4 MACRO-4,
qs1 QS4, red1 RED1-12).

**Online, the other player's watchman (closed the same day, Mac: "Do the
still open stuff").** A peer's watchman is a puppet in the striker's
encounter pool; the blow goes to its owner and he dies THERE, so the
striker's OnWeaponHitEntity read a live puppet and the urge was never
satisfied by the city watch online. The owner now answers a lethal blow
with `slain` down the loot grant's own path back (`hit`, to the striker, by
the watchman's number, keyed to the cell - no wire or relay change: the
relay routes a cell `hit` by `to`, and an older client's `applyHit` reads no
`dmg` in it and refuses it whole). The striker's pool lands it only for a
puppet of THAT owner's it struck, inside the take's window, once, and runs
KilledInnocent alone on the live minute
(`worldTick.playerWeaponKillReported`) - the vampire fed on the blow and is
not fed twice. Civilians and building interiors were always local to each
client (their kills were seen dead at the striker), and no dungeon holds
the city watch. Pinned by execution in `test/disc10_online_kill.test.js`
(two clients, the blow out, the death at the owner, the report back);
mutants in `disc10.json` (79, all dead).


---

# DISC10 - three reports before the survival-tiers branch merged

Mac, with three Discord screenshots: *"Before we push this can you fix
these"*.

1. kurkku: *"two wagons appear whenever you hitch it up, visual only"* /
   *"also the Wagon tooltip can appear when it's trailing behind you and
   you're looking forward. it'll flash quickly as the wagon goes in and out
   of range"*
2. Starempire42: *"Npcs marking things on the map doesn't seem to be
   working. Npc was supposed to mark it on the map. It is not on the map
   when I look."*
3. Triage: *"im stuck in a tree?"*

Each was investigated to its cause in node, against the real modules,
before it was touched. The pins are `test/disc10.test.js`; the mutants are
`tools/mutants/disc10.json`. All die.

## DISC10-A: two carts for one Cart transport

**Cause.** Not a stale or parked copy of the wagon, and not my own team
echoed back online (both were ruled out by probes and by the relay's own
exclusions). Two vendored mods each stand a cart for the Cart transport:
Eye Of The Beholder's ShowCart (model 41239, `player/eotbWagon.js`, through
the view seam) and Horse Cart and Cargo's trailing wagon (41214). Both ship
on, EOTB's lane is open for every rider without the Morrowind body, and
neither mod's code knows the other - DFU with both installed would stand
both too. The second wagon in the reporter's first screenshot is EOTB's;
the one ahead of the horse in the second is EOTB's after a turn (it only
moves once it is 2.5 m from the rider). The plaque's "Wagon" was EOTB's
too: HCC's trailing wagon takes no activation at all, and EOTB's box was
an axis-aligned box drawn around the cart's rotated bounds, re-drawn every
frame as it turned and swayed - at a diagonal it bulged forward past the
rider, and a forward look over empty road entered it, flickering through
every turn (10-14 times a quarter turn in the probe).

**Fix.** While HCC's trailing wagon is on, EOTB's cart gives way
(`mwView.js` `setEotbCartYields`, registered by both hosts beside the
runtime it reads); with HCC off, or its wagon hidden, EOTB's cart stands
as its IL says. EOTB's activation target is the cart's OWN turned box -
`activate.js` `rayObb`, the slab test in the box's rigid frame - and it
takes no surface inside it (`noSurface`: the cart has no collider, so a
box that holds the eye names nothing by the ground or a wall). Ledger A
carries it as ONE CART FOR THE CART TRANSPORT.

## DISC10-B: "I'll mark it on your map", and the map did not

**Cause.** The port marks the building and the building lands in the
discovery store; the town map then hides it on purpose. The screenshot's
wrapped line is "The Woodfield Residence", and the town map names a
discovered RESIDENCE only by a quest Place carrying the NPC's
marked-on-map stamp, or by the quest name it learned at discovery
(ExteriorAutomap.cs:677, :693-707; PlayerGPS.cs:927, :945-959). Asked where
a PERSON is, MarkKeySubjectLocationOnMap stamps the Person's own resource
(TalkManager.cs:1283-1296), which the map never reads - so the house stayed
unnamed whenever the Place was still dialog-hidden, or the house had been
discovered as a plain residence before the quest named it (World Tooltips
discovers a door the player looks at, which makes the second case common
here). DFU has the same gap.

**Fix.** A Person's map answer marks the person's assigned Place with
them (`answerPipeline.js` `markKeySubjectLocationOnMap`). Everything else
- the knowledge roll, the 7332/7333 draw, the compass stamp - is DFU's.
Ledger A carries it as A PERSON'S "I'LL MARK IT ON YOUR MAP" MARKS THEIR
HOUSE.

**Not driven in a browser:** no game data here, so the two carts were
driven with a stand-in box for model 41239, and the map through the
real chain with the vendored text records.

## DISC10-C: stuck in a tree - not taken

Mac: *"Seems like a rare case where they got stuck in geometry"*, and
then *"Lets just merge what we have"*. The investigation was stopped
before it reached a reproduction, so no cause is claimed here. If it
comes back, the save and where it happened are what to ask for.


---

# DISC13 - four reports after the survival-tiers merge

Mac, with four Discord screenshots: *"Got some bugs for you"*.

1. icebreyker, "Lights/shadows are bugged": *"The shadows seem to flicker
   when i move"* (a dungeon corridor, a torch in hand).
2. icebreyker, "Cant heal with bandages": the pack's card for ten
   bandages showed DROP and nothing else.
3. Ilvi: *"When I'm walking with torch it looks torn down. Half of it just
   dissapeared."*
4. Sir McMobdon, "cant access my boat": they turned Travel Options' ship
   option off (*"It's off / Still dont work"*), and then *"Nether has
   options for the boat"*.

Each was traced to its cause in node, against the real modules, before it
was touched. The pins are `test/disc13.test.js`, and every one but A's
first fails on the code before the fix. The mutants are
`tools/mutants/disc13.json` (22). The run by the rule took 209 records:
this list, every record whose tests this change edited, and every record
within six lines of a changed line. One survived: MAC-R1's re-aimed
"a window with no transform", which no pin read. It is pinned now, and
all of them die.

## DISC13-A: the light in the hand slid against the view

**Cause.** This is not the shadow maps. The light in the hand casts
none by design (`casterOf = -2`, shadowPass.js), so in a torch-lit
dungeon the "shadows" are the torch's own falloff, and that is what
pulsed.

The motor steps at a fixed 60 Hz, and the camera draws from its
interpolated eye (`motor.js` `eyeAt`, EV1). Every host built the
lights in the hand off the raw stepped feet (`player.pos`):

- the torch (`playerTorchLight`), in all six light arrays across the
  four hosts;
- the Thunderlock's flash (`thunderlockMuzzleLight`), in the same
  arrays;
- the Light spell's candle (`magic.update`'s feet).

On a screen faster than 60 Hz, or a 60 Hz frame that jitters, the light
slid back and forth against the view on every frame while walking.
Standing still, it did not. Measured with the real motor and the real
torch law, the lit wall beside the torch changed frame to frame by:

- 9% at 120 Hz, alternating every frame;
- 8.5% on average at 144 Hz;
- up to 18.6% at 60 Hz with a millisecond of jitter.

The cube-shadow selection was checked walking, running and bobbing, and
is stable: DISC6's hold works. A build from before DISC6 would add that
tie-swap flicker on top.

**Fix.** The hand lights are built off the render feet (`motor.js`
`feetAt`), the positional half of the camera's own eye, at all six
sites. The candle takes the render feet as a fifth argument to
`magic.update`, and the dungeon context carries them through
`drawFoes`. The feet passed for gameplay are unchanged: missiles, blasts
and collision still meet the simulated capsule. `feetAt` carries no head
bob, as DFU's PlayerTorch is a child of the player and not of the
camera.

## DISC13-B: a bandage with no Use

**Cause.** The heal works. Roleplay & Realism: Items registers UseBandage
for the template (ItemHelper.RegisterItemUseHandler,
`rriInstall.js`), and `useItem` asks that handler ahead of its ladder
(DaggerfallInventoryWindow.cs:1703-1709). But the pack's card draws Use
only where `usableItem` says the ladder has an arm (Mac, 2026-09-18:
"hide Use for non-usables"), and that predicate was never told about
registered handlers. So the card offered Drop alone. The classic
window's Use mode still healed.

**Fix.** `usableItem` asks the registered handler first. A handler that
answers only under a switch says so with `usable`: the bandage's is RRI's
`bandaging`, so with bandaging off the card offers no Use, and the
ladder, which has no arm for a bandage, would have said nothing. The heal
is silent, as the mod's is (it only logs).

## DISC13-C: the torch cut in half at the screen's edge

**Cause.** This is the Morrowind arm's lane. The classic Handheld
Torches sprite is always drawn whole, and its resting place is the mod's
own.

The arm was rendered into a frame exactly the screen's size, and that
picture was pasted into the rect the Weapon Widget's bob, inertia and
step had moved. The bob always pushes right, so the frame's left edge
came into the screen on every stride and the torch in the left hand
ended in a straight vertical cut there. At 1920 wide that was up to
77 px walking and 126 running. With Diverse Weapons' preset (on by
default since DW-CLIP) the inertia opens either side: 170 px on the
right when backing up, and 152 when strafing. MAC-R1 had padded the top
of the frame for a raised blade. The sides never were.

**Fix.** The pass renders the pixels of the lens's own grid that the
moved rect shows on the screen (`fpArm.js` `fpFrameWindow`), and lays
them where the rect puts them. No frame edge is ever inside the screen,
the arm still slides at the widget's sub-pixel pace, and the frame is at
most a column and a row bigger than before. The top pad is retired with
it.

Two other fixes were built and checked, and both closed the gap:

- A side pad would have cost the arm a third of its resolution on a
  2560 screen.
- Moving the lens would have re-rasterised the arm, which draws at a
  third of the screen's resolution, so the bob would step it three
  pixels at a time.

Morrowind-Rules, DISC13-C, carries the law.

**Guess, not verified:** that Ilvi plays with Morrowind assets. Their
question in the same thread, about changing the models to Morrowind
ones, suggests so. The fixtures here have no torch bone and there is no
retail data.

## DISC13-D: the ship stayed dark in port

**Cause.** Roleplay & Realism's shipPorts replaces
TransportManager.ShipAvailiable (RoleplayRealism.cs:610-631): on the
ship, yes; in a loaded location, a port town and an owned ship; anywhere
else, no. The world host answered `{ loaded, portTown, onShip }` and the
delegate reads `locationLoaded`. So every port read as the wilderness,
and the Ship row was dark unless you were already aboard. This dates
from RR2 (06bdf5d6). Travel Options' OnlyFromPorts, the one they turned
off, rules the travel map's sea passage and never boarding your own
ship, so it could not help.

**Fix.** The world host answers `locationLoaded` (`world.js`
`shipLocation`). The standalone exterior host passes no shipLocation and
never did, so it answers HasShip as before.

**Main's SHIP-PORTS, the same day, from the same report.** It made the
rule ship OFF and put shipPorts on Roleplay & Realism's tile, so the
boat came back for everyone who does not ask for the port rule. This
fix is the other half: with the rule on, a port answers as a port. The
two met at the merge on the same tile line, and main's stands.

---

# DISC14 - the weapon under the horse, and Diverse Weapons' idles

Mac, with a Discord screenshot: *"Weapon shows below the horse while on
horseback. Also audit diverse weapon and ensure their idle positions are
correct."*

1. Starempire42: *"is there a way to make it so I can see my weapon above
   my horse?"* (riding, the horse's head over the hand and the root of a
   curved blade).
2. Mac: an audit of Diverse Weapons' idle positions. While it was
   running, Mac sent a screenshot of Weapon Widget's tile instead:
   *"Sorry but these need to be the default values ingame for diverse
   weapons. The current defaults are wrong on the screen"*, and stopped
   the audit.
3. Mac, after B: *"I also notice littering on the morrowind model. I feel
   like some of the diverse weapon settings arent needed because we have
   other integrations that handle them"*.

The pins are `test/disc14.test.js`; the mutants are
`tools/mutants/disc14.json`, and all thirteen die.

## DISC14-A: the horse drawn over the weapon

**Cause.** DFU draws the mount in OnGUI at `GUI.depth = 2`, "behind other
HUD elements & weapons". That is TransportManager's own comment, and
Roleplay & Realism's EnhancedRiding carries it word for word
(EnhancedRiding.cs:234-235). Both hosts that ride (`world.js`,
`exterior.js`) drew the weapon rig at the end of the walk block and the
mount later, in the HUD block, just before `drawHud`. So the horse's
head landed on the hand and the root of the blade, and on the shield,
the torch and the casting hands with them. The HUD's own order was
right: the mount went in before `drawHud`, as the comment above it
says. The weapon was the half the comment did not name.

**Fix.** The rig draws after the mount and before `drawHud`, under the
walk block's own gate. The mount stays where it was. Nothing draws
between the rig's old place and its new one (the Detect feed's tick
only reads), so no other layer changes order. Only these two hosts
build a mount rig.

**Named, not changed:** EnhancedRiding tints the mount with
`TransportManager.Tint`, "the current tint from FPS lighting". The port
lights the weapon, the shield and the torch with MAC-I's flat light
(`fpTint`) but draws the horse untinted, so at night the horse is
brighter than the hand on it.

## DISC14-B: Diverse Weapons' defaults are Mac's (REVERTED by DISC16-B, below)

**What Mac asked for** (the tile's chips and dials in the screenshot):
Swings, Ambidexterity, Offset, Bob and DoubleScaleTextures on; Inertia,
Step, TrueTextureSize and Recoil off; Swings.Speed 1, Bob.Length 100,
Inertia.Scale 0.

**What drew before.** Diverse Weapons' preset, on by default since
DW-CLIP, laid the mod's recommended Weapon Widget settings OVER the
player's: TrueTextureSize on, Inertia on at scale 1, Step and Recoil on,
a 142 bob. Weapon Widget's tile reads the player's own settings, so it
went on showing values the preset was overriding. Pressing a chip there
changed nothing that drew.

**Fix.** The preset ships off again. Weapon Widget ships its own
defaults except two, which are now Mac's: DoubleScaleTextures on (off in
the mod) and Inertia.Scale 0 (1.0 in the mod). Those twelve values are
what a fresh game draws, and the tile shows them. A press on any chip or
dial reaches the weapon, and a player can still ask for the mod's
preset.

**Three things checked on the way:**

- The Thunderlock turns Inertia on as its own departure. It keeps the
  mod's shipped scale while the player's module is off
  (`gunViewmodel.js` `GUN_INERTIA_SCALE`); otherwise the new 0 would
  have taken its sway away.
- WW1's shipped-defaults pin names the two departures, and the clone's
  benches put the shipped values back, so the clone's own laws are still
  tested against the mod.
- ARROW2's pin (the nocked bow hidden through the loose's cooldown) went
  red under the new default. One frame before the bow slides back, the
  doubled-idle bob lifted the hidden bow 0.82 rows of a 200-line screen:
  about four pixels at 1080, for 16 ms, 1.4 s after the shaft left. That
  was the first sign of DISC14-C below, and C removed it. ARROW2's law is
  pinned on the mod's shipped settings, and a fourth case holds the same
  law under the new default.

**Not verified here:** the placement itself. The values are Mac's,
chosen against what the old defaults drew. The idle audit that was
running when the screenshot came was stopped, so no claim is made here
about any screen shape or either hand.

## DISC14-C: the Morrowind model's jitter

**Cause, measured.** Walking at 1920x1080 and 60 Hz, over 120 settled
frames of the arms' composite (`armsTransform`). The worst jerk is the
largest second difference of the rect's y, in pixels.

- **Main as shipped.** Diverse Weapons' preset was on by default
  (DW-CLIP), and it turns Step and DoubleScaleTextures on. The arms were
  pinned at the top on 25 frames, with a worst jerk of 16.9. Most of that
  is Step's snap on each footfall: with Step off it is 1 frame and 1.47.
  B turned the preset off, and Step with it.
- **B's defaults.** B kept DoubleScaleTextures on, as Mac's values have
  it. Weapon Widget's bob has a second shape for a doubled idle
  (bobStep's `xMin` and `yMax` at 0): centred on the rest, so it swings
  above it as well as below. The port gave that shape to every idle once
  the module was on. But only a `w_` texture drawn into the doubled box
  sits half its size in, low enough to swing above its rest; DW-CLIP had
  already made the half-size shift ride that doubling. Everything else
  rests on `transformRect`'s floor, which pinned the upper half of every
  sway:

| What was drawn, under B's defaults | Frames pinned at the top, of 120 | Worst jerk |
|---|---|---|
| The Morrowind arms' composite (`armsTransform`) | 53 | 3.37 (0.73 with the module off) |
| A classic sprite, or a plain hit through the fall-through | 63 | 1.26 (0.22 with the module off) |
| A Diverse Weapons idle with its doubled `w_` | 1 | 0.22 |

So the arm stopped dead at the top of each stride and snapped back into
motion.

**Fix.** The doubled idle's bob now rides the doubled hit, through one
helper (`doubledIdleNow`) shared with the half-size shift. The Morrowind
arms keep their own bob integrator on the plain shape, always, plus the
same inertia the sprite takes. With the fix, all three cases above pin
on one frame (the bob's own peak). Under the shipped defaults the arm
now moves as it does with the module off: 1 frame, 0.73. ARROW2's sliver
went with it. DW-CLIP's two mutant records named the old gate and are
re-aimed by content at the shared helper.

**Turning the preset back on** brings its Step back: 5 frames and a
worst jerk of 33.75, the same as main with DoubleScaleTextures off. That
is Weapon Widget's own Step reaching the arms, and part of the open
question below.

**What Weapon Widget does to the Morrowind model at all** (checked in
`weaponRig.js`). Only `armsTransform` reaches it: Bob, Inertia and Step
move the arms' whole picture. Swings, Ambidexterity, Offset,
DoubleScaleTextures, TrueTextureSize and Recoil drive the 2D sprite
alone. The arms swing, sheathe and change hands with their own
Morrowind clips. Whether the arms should take Weapon Widget's movement
at all is Mac's call (WW1 added it at Mac's asking), and is left open
here.


---

# MAP-LAG - the enhanced map after the weather (REMOVED by DISC17-C, below)

The weather this kept is gone from the map, and this machinery with it (DISC17-C). The record stands.

Mac: *"One bug is the enhanced map now is very laggy after we
introduced the weather changes."*

**Cause, measured** in headless Chromium on the real window, over a
synthetic 1000 x 500 bay (a stand-in climate, not CLIMATE.PAK; software
raster, so a GPU canvas is faster), paper 791 x 482. WEATHER3e/h/i put the
bay's weather on the held map, and three of its costs landed on the frame:

- **The regions were inked on every pan and zoom frame.** They rode the
  kept static ink, whose key is the view. Alone, the regions over the
  whole bay were 85-90 ms a paint at one device pixel to a CSS pixel and
  205-249 at two: the JavaScript tracing 28 (183,000 points), then the
  hatch fills, the clips and the outlines. A zoom frame was 30 ms at the
  median and 74 at worst (76 and 171 at two), a pan zoomed in 11 (48).
- **The hover read a forecast on every move:** 25 reads of the law, 3-11
  ms a pixel, 17 ms a pointer move.
- **Every open read the bay again:** the sheet is a new window each time,
  and each read the field and traced the regions (130-250 ms) before its
  first frame. An open's worst frame was 620-880 ms against 265-290 with
  the weather off.

**Fix.** Three parts, all in `ui/heldMap.js` with slices in
`ui/weatherLayer.js`:

- **The regions have a kept raster of their own**, laid under the kept
  ink by a new sheet member, `paintUnder` (`mapStrip.js`; the town and
  the automap draw nothing). It is inked at a view, the visible map
  widened by a quarter each side within the bay. A pan inside that moves
  it by whole device pixels, a zoom or a glide stretches it, and once the
  view has held still 0.2 s a raster that is not crisp for it is inked
  again. The hatch is now laid from the map's corner on a whole device
  pixel, so a moved raster and a fresh one agree.
- **The weather's work is a job, 6 ms a frame:** the field a few rows at
  a time (`weatherFieldJob`), the regions a word or a step at a time
  (`fieldRegionOf`, `fieldStepOf`), the raster a stroke at a time
  (`weatherStrokes`), into the canvas that is not being laid. A sheet's
  first weather fades in over 0.3 s. A refresh while the sheet is up
  (online, where the clock does not stand) keeps the last raster until
  the new one is laid.
- **The hover names the weather at once** (one read, the forecast's own
  first) and reads the forecast once the pointer has rested on the pixel
  0.15 s. A press puts the rest aside; a click that did not drag keeps it.
- **The last read is kept with the host's lookup** (refresh, sheet size
  and the snow-ground switch in its key), so an open inside the same ten
  minutes finds the regions traced.

**After, the same measure:** a zoom frame 4.1 ms (9.8 at worst; 9.6 and
16.7 at two), a pan zoomed in 1.3 (2.9), a pointer move 0.7. An open's
worst frame 44-50 ms the first time in a refresh and 12-21 after, the
weather laid about a second after the sheet opens. The picture is the
same: the old and new renders at three views have the same mean colour
to within 1%, the pixels that differ are the hatch's new phase, and the
crops look alike to the eye.

**Named, not changed:** when a zoom settles, the crisp raster's largest
stroke still holds one frame, 21 ms at one device pixel and 69 at two in
software. One region's fill cannot be split without changing its holes. The
first read in a session is cold for the far bay (the births the sim has
not warmed): `systemsNear` over the whole bay, 85-170 ms, is still read in
one go.

**Not verified here:** in the game. There is no game data in the
container.

The pins were `test/maplag.test.js` (8, DELETED by DISC17-C). WEATHER3e's and WEATHER3i's hover
pins now read the forecast at rest.

---

# DISC16 - sunk on hills, and Diverse Weapons' preset back

Mac, 2026-09-24: *"I notice my character is sunken into the ground on
hills"* and *"Weapon widget preset needs to be defaulted on with diverse
weapons and the changes we made to the values for the weapon widget
reverted. Its no longer smooth like how it was before diverse
weapons."*

## DISC16-A: the body sunk into a slope

**Cause.** DFU's body is Unity's CharacterController, a capsule of radius
0.35. A capsule on a slope rests on its rounded bottom: the sphere's
centre stands r / cos(grade) over the ground beneath it, so its lowest
point, the feet, stands r (1 / cos - 1) over that ground. That is 5 cm
at 30 degrees, 15 at 45 and 35 at 60. The collider's terrain floor
(`collider.js` `move`) took the ground beneath the centre as the feet.
So on a hill every body stood that much lower than DFU's, and the
third-person body, placed at the feet (the Morrowind body in
`fpArm.drawThird`, the Eye Of The Beholder sprite), had its uphill foot
in the slope.

Ruled out on the way:

- The drawn ground and the floor agree: the same samples at the same
  terrain scale, 1.25 (TERRAIN-SCALE1), and the triangles differ from the
  bilinear floor by at most 0.08 (BLOOD1 AUDIT 3).
- The swim sink (DoSinking) arms only on a water tile.

**Fix.** The floor is the capsule's rest, `restFloor`: the ground beneath
the centre plus r (sec - 1), the grade taken from the heightfield across
the capsule's own width. The snap onto the floor and the clamp under it
read the same height, so MAC3's downhill walk stays glued: no hop, no
landing, no rise. Flat ground is unchanged. So is the edge of a built
pixel, where there is no ground to one side to read a grade from.

**Not verified here:** what Mac saw. There is no game data in the
container, so which body and which view are not known. The rest is DFU's
capsule, measured; a body with no foot IK still has an uphill foot, as in
DFU. If the report was the third-person camera looking across a slope at
a low angle, the ground between hides the feet, and that is the camera's
to answer.

## DISC16-B: the weapons as they were before Diverse Weapons

The first cut reverted DISC14-B as asked: the preset on again (DW-CLIP)
and Weapon Widget's own defaults. With the preset on, the Morrowind arms
take its Step again, the footfall snap Mac had reported as jitter under
DW-CLIP. Mac, to that: *"Im so confused man. I just want it how it was
before diverse weapons."*

So the weapons move as they did before DW1:

- Diverse Weapons' preset defaults off, as at DW1.
- Weapon Widget ships the mod's own defaults: DoubleScaleTextures off,
  Inertia.Scale 1.0, Step and Inertia off, the 100 bob.
- The Thunderlock's forced inertia runs at the player's own scale
  (DISC14-B's `GUN_INERTIA_SCALE` is gone).
- DISC14-C stays: it only acts on a doubled `w_` texture, which the
  defaults never draw.

The mod itself stays on. MO1 has every mod ship on, a rule pinned with no
exemptions left, and the mod picks WHICH sprite is drawn, never how it
moves. The first reading of "before diverse weapons" turned the mod off
and broke MO1's pin, so it was not taken. The preset is the player's to
choose.

The pins are `test/disc16.test.js` (3), and MAC3's downhill pin reads
the rest. DW1 and AUDIT-DW pin the preset's default off. DISC14's three B
pins went with it. The mutants are `tools/mutants/disc16.json`, all
seven dead; DISC14-B's five records are retired.

# DISC17 - the wisps, the thunder, and the map's weather removed

Mac, 2026-09-24, in one message: *"1. I really want to give the wisps
more opacity and reduce the amount of wind wisps 2. Sometimes thunder
ends abruptly 3. Remove the enhanced map weather enhancements
entirely"*

## DISC17-A: fewer wisps, each darker

Half as many and twice as dark:

- `WISP_MAX` goes from 240 to 120. A calm keeps the same floor share,
  10 wisps where it was 19.
- `WISP_LOOK`'s alpha goes from 0.10/0.12 to 0.20/0.24. The heart of a
  flourish's ink peaks at 0.70 in a gale (0.35 before) and 0.32 in a calm.

The sandstorm's look is not the wind's mark and is unchanged. Not seen
on a screen here, since the container has no game data. The two numbers
are the dials if it wants another step either way.

## DISC17-B: thunder cut off mid-roll

**Cause.** WEATHER3d plays a distant storm's thunder from a stand-in
`THUNDER_SOURCE_M` (13 m) from the ear, toward the storm, at a 13 m
reference distance. The stand-in is a WebAudio panner, and a panner stays
where it was put. The ear moved on under a rolling clip:

- Walking, every metre was a metre off the 13 m reference.
- At every map pixel crossed, the floating origin's recentre
  (`streamingWorld.js`, 819.2 m) moved the ear over 800 m from the
  stand-in in one frame. The clip fell 35 dB (38 on a diagonal crossing)
  mid-roll, which is the abrupt end.

The storm overhead is DFU's ambience, placed at PlaySomewhereOnHorizon's
3000 m minimum distance. Neither a walk nor a recentre changes its level,
so it is left as DFU has it.

**Fix.** `play3d(..., { far: true })` keeps the shot's offset from the
listener: `setListener` moves it with the ear until its clip has run out,
then lets it go. Both exterior hosts play the distant thunder `far`.
Every other one-shot still stays where it was put.

**Also found.** `tools/citeShift.mjs` read HEAD's `world.js` with
`execFileSync`'s default 1 MiB buffer. The file passed that size, and the
throw landed in the tool's new-file catch, so its largest target was
skipped without a word. It takes `citeMerge.mjs`'s buffer now.

## DISC17-C: the map's weather removed

The travel map is the bay again:

- `ui/weatherLayer.js` is deleted.
- `ui/heldMap.js` is its pre-WEATHER3e self plus the unrelated MAP-FIELD8
  and MAP-FIT1 changes: no regions, glyphs, legend, hover weather or
  forecast, and none of MAP-LAG's raster, job or resting forecast.
- `world.js` hands it no `weather`, and its climate lookup is the plain
  `maps.getClimateIndex` again.
- The sheet contract loses MAP-LAG's `paintUnder`, and the town and
  automap sheets their empty ones.

The sim keeps every law the map read (`forecastAt`, `mapGround`,
`wornAmong`), and the three comments that named the map as a reader say
it no longer is. Retired with it:

- `test/weather3e_maplayer.test.js` and `test/maplag.test.js`, DELETED with
  their mutant lists.
- The map's tests in `weather3f` (R1's and R2's map halves, R2a),
  `weather3g` (the map, the sheet), `weather3h` (the field, the regions,
  the hand, the pen's sign) and `weather3i` (all but the law and the
  player's strength), and their 57 mutant records.
- EM1-25/26 go back to the click arm as it stands.

The pins are `test/disc17.test.js` (5). Its mutants,
`tools/mutants/disc17.json`, are all ten dead.

# DISC18 - the body's legs in the ground, not the save

Mac, 2026-09-24: *"I dont know if its my save or not, but my
characterless are in the ground. I havent recieved any reports from
other players"* ("characterless" read as "character's legs").

**Not the save.** Every host drew the third-person body at
`player.feetAt()`. That covers both bodies, the Morrowind body and Eye Of
The Beholder's sprite, since both draw through `mwViewDrawBody`.
`feetAt` is the height the CAMERA rides (AUDIT 65 XL-4): EV1's
interpolation with MAC1's low-pass over `STEP_SMOOTH_TAU` (0.06 s), so a
rung or a terrain facet does not pop the view. A low-pass trails a climb
by the climb's vertical speed times its time constant. So on every hill
the body was drawn under the ground it stood on, and over it going down.
Measured through the real motor and collider:

| Grade | Walking | Running |
|---|---|---|
| 10 degrees | 4 cm | 7 cm |
| 20 degrees | 8 cm | 14 cm |
| 30 degrees | 13 cm | 23 cm |
| 40 degrees | 19 cm | 33 cm |

On a stair it was up to a whole rung. Standing still it settles within a
few frames, which is why it read as a place or a save rather than a
motion.

DISC16-A's capsule rest was real and stands: it lifted the resting body
5 to 15 cm on a slope. This is the other half of what "sunk into hills"
looked like, and it only shows while moving.

**Fix.** `motor.js` `bodyFeetAt()` is EV1's span lerp alone: the
capsule's own interpolated feet, with the same snap guard, and it leaves
the camera's filter alone. All five body draws take it (`world.js`,
`exterior.js`, `dungeon.js`, and `worldModes.js`'s dungeon and interior
passes). The cameras keep `feetAt` and its smoothing, as do the torch
light and every gameplay reader. On a stair the body now steps up a rung
as the capsule does, and the camera glides after it.

The pins are `test/disc18.test.js` (3):

- the body on the ground to 0.1 mm on 10 to 40 degree hills, walking and
  running, up and down, at 60 and 144 Hz;
- the old placement's sink measured beside it;
- the accessor and the filter;
- the five draws and the cameras.

AUDIT 65 XL-4's and MWBODY1's host pins are re-aimed. The mutants are
`tools/mutants/disc18.json`, all seven dead.


# DISC19 - five in one message

Mac, 2026-09-24: *"1. Grass isnt affected by fog 2. Sometimes when music
tracks switch, its very abrupt instead of seamlessly fading in between
tracks 3. Horse and carts can be seen parked in the sky 4. Lightning can
be seen even when its not storming. 5. The weapon widget default toggle
unfer diverse weapons should be set to off by default"*

## DISC19-A: the grass stood out of the fog

**Cause.** The lab's grass program had no fog term, GR1 carried it byte
for byte, and the renderer's fog only reaches its own programs. So under
every fog row the ground takes (a clear day's linear 2400, the rain's exp
0.003, the heavy fog's exp 0.05, the sandstorm's exp 0.09, Dynamic Skies'
exp2 and colour) the field was drawn out to its 300 m fade, dimmed but
never fogged. In heavy fog the ground is the fog's colour past 60 m while
the grass stood out of it to 165 m.

**Fix.** `labGrass.js` `GRASSFOG_VS_EDITS`/`GRASSFOG_FS_EDITS`, applied
after the pixel style's, so the fog is not snapped to a ramp step:

- the vertex hands down its world point;
- the fragment blends to the fog colour by the terrain's own
  `fogFactorAt` (`FOG_FACTOR_GLSL`, TERRAIN_FS's text verbatim);
- the renderer uploads the five fog uniforms from `light.fog`, and mode 0
  (the lab's unfogged picture) when a host hands none;
- `world.js` hands the fog the ground took this frame, from the view's eye.

## DISC19-B: a switch cut the song off

**Cause.** DFU cuts: `DaggerfallSongPlayer.Play` calls `Stop` first, and
`Stop` is `audioSource.Stop()` or the sequencer's `NoteOffAll`. The old
song goes mid-note and the next starts at full level. The port did the
same at every switch: a weather ring crossed, dawn, a door, a new
location, a quest's PlaySong. A song that ended on its own and was
followed by the next one was the smooth case, hence "sometimes".

**Fix, a recorded departure (Port-Ledger A).** Each player runs its song
through a fader of its own under the volume (`songPlayer.js`
`rampFader`). The master stays the volume: the slider and the video mute
write it, and neither cancels a fade. `music.js`:

- a switch fades the sounding song out over `MUSIC_FADE_OUT_S` (1.5 s),
  stops it at silence, then starts the next at nothing and fades it in
  over `MUSIC_FADE_IN_S` (1 s);
- one synth voices one song, so the two play in turn, never on top of
  each other;
- the latest request during a fade is the one that plays, and the song
  fading out, asked for again, turns round from where its fade stands;
- `playing` stays up through the fade, so the director never reads it as
  a song that ended;
- a first song, and a song after one that ended, rise in at once;
- `stop()` cancels a switch in flight.

## DISC19-C: parked teams in the sky

**Cause.** A peer's HCC word carries the height the OWNER's client stood
the team at, and nothing re-read it on the viewer's ground. The one place
the two part by much is a word older than the ground:

- the relay keeps a parked team for 72 hours (HCC-PARK), and an
  identical word refreshes it;
- TERRAIN-SCALE1 lowered every ground from the prefab's 1.5 to the game
  scene's 1.25 four hours after HCC-PARK shipped (PRs #341 and #345). It
  re-stood the heights a save, a scene cache and an anchor carry, not
  this one.

So every team kept from before it, and every word from a tab still on the
old build, stood a fifth of the ground's height up: 20 m over 100 m of
ground, 60 m over 300. World of Daggerfall's levelled sites and Basic
Roads' smoothing, on for one player and off for the other, part them the
same way, by less.

Two smaller faults in the same code:

- The mod grounds its parked wagon and waiting horse once, since its
  terrain never changes under a scene. The port's can: a pixel rebuilt
  under them (the road network landing, a late World of Daggerfall pack)
  left the owner's own team on the old ground until they walked out of
  the pixel and back. By metres, on a levelled site.
- A crossing that left the parked wagon's pixel left its collider box
  behind in the old frame, 819 m off in the pixel entered: a wall no one
  could see.

**Fix.**

- `horseCartPool.js` `groundPeer` stands a peer's PARKED wagon and
  STANDING horse on the viewer's ground by the mod's own law: the wagon
  by its two-wheel solve (`DeployedWagonVisual`, the owner's heading),
  the horse by the stationary probe.
  - Once per word, with the owner's box and mine left out of the ray.
  - Kept as a delta off the word, so the floating origin and a re-anchor
    carry it.
  - Where the viewer's ground is not built yet it stands as said and is
    tried again each second (`GROUND_RETRY_SECONDS`).
  - A moving team is its owner's live word and stands as said.
- `world.js` calls the pool's `groundMoved` after every pixel is
  published, over its bounds. That re-stands the owner's own team
  (`horseCart.js` `regroundStanding`) and the peers' within the pixel. The
  hook is bound after the pool, because the boot's first pixel builds
  before it.
- `offsetAll` takes the parked wagon's box down with the old frame.

Old kept records need no purge: they stand on the ground now and expire
on their own.

## DISC19-D: lightning under a clear sky

**Cause.** Since WEATHER3g a thunderstorm is a cell of a rain front, and
it paints (its word, its cloud) only inside its front's core as the core
is now (`clip`). Cells are born out in the front's full-grown size, and
many lie wholly or partly outside it. The distant storms read the clip
only for the "under its heart" skip. So four cells in ten that paint
nothing went on striking, and 61% of strikes landed where no storm
stands. Since BOLT each drew a bolt, lit the land and thundered.
Measured on the report's kind of afternoon (a swamp, the player's word
sunny, 18 clipped cells in range): 248 strikes and 43 thunderclaps in
twenty real minutes.

**Fix.** `distantStorms.js`: a strike lands only inside its cell's clip,
and not on ground that turns it to snow where it lands. The centre's test
stays too: it is the cloud's, since a cell centred over snow is drawn a
snow squall, whole (AUDIT WEATHER3 R1). A storm with no clip strikes as
before, every client still sees the same strikes, and a far storm's
lightning is still seen from afar, as BOLT asked.

## DISC19-E: the Weapon Widget preset back to off

Diverse Weapons' Weapon Widget Preset has shipped off since DISC16-B. A
default only answers for a player who never touched the switch, though:
anyone who turned it on while DW-CLIP shipped it on, or tried it, holds a
saved value and still saw it on.

**Fix.** `modSettings.js` `SWITCH_RESETS`: on load, a stored Weapon
Widget Preset without the entry's stamp is let go and the file written
back, so the shipped off applies. `setModSetting` stamps the key when a
player sets it from now on, so a choice made after the reset is kept
across reloads, which `KEY_MIGRATIONS` (value matches) could not do. A
file that never mentioned the mod is not grown one.

## Pins

`test/disc19.test.js` (13):

- A: the grass stage run through `test/glsl.mjs` in both styles (no fog
  is the old picture to the bit, 100 m into heavy fog is the fog colour,
  each mode exactly the terrain's blend) and the fog's text and wiring.
- B: the service on fake players and a manual clock (out, then in; the
  latest request; the turn-round; the stop), a music pack's track, and
  the fader.
- C: a kept team from before TERRAIN-SCALE1 on the viewer's ground; the
  retry, the delta, a same-ground word where it was said, a moving team
  unprobed; the owner's own team re-stood; the orphaned box; the host's
  hook.
- D: a cell wholly outside its core strikes nothing, half outside only
  inside, never onto snow where it lands, and a cell centred over snow
  not even at its edge; the sunny swamp afternoon is dark.
- E: the stamped reset.

GRASS-PX's composition pin now composes both edit lists, and
`test/hccWorld.mjs`'s ground can move. The mutants,
`tools/mutants/disc19.json`, are all 34 dead. Of the 88 older records the
change reaches, 87 died as they stood; `WEATHER3f-squall-strikes` (the
centre's gate) survived, because R1's winter is snow everywhere and the
new strike-point gate stood in for it. It runs `test/disc19.test.js` too
now, which holds a squall's edge over thunder ground dark.
