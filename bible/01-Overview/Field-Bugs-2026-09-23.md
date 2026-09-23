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

