# FIELD BUGS 2026-09-28 (d) - the journey at x1, the boat nobody found, the keys that travel, and first-person travel back

From the Discord (#general), through Mac, with two screenshots:

1. Satranath: *"why does travel mode now set timescale to 1?"* - *"the menu says 10x at the top but it's moving at 1x
   and when starting or resuming travel it's 1x"*.
2. Julian: *"in my case w the large deed specifically - first attempt just didn't spawn in the boat and the deed
   disappeared. i could hear ocean bout sounds as if i was on a boat in the background. lost the boat forever. second
   attempt, spawned in a large boat deed. it spawned in after a delay but i got killed by an ocean mob before i could
   climb onto it. also lost that boat forever after respawning"*.

Mac: *"2 bugs. Also need to add the ability to travel faster with WASD"*.

## TRAVEL-X1: a journey begun from the map ran at x1 (1)

**Reproduced first** (`test/systems/comeSailAway/csa_time_audio.test.js`, red before the fix): walking, a pause (the travel map up), a
journey begun in it at x10, then the first frame after - Come Sail Away's Update put the scale back to one and said
"Time scale set to 1.".

**Why.** Come Sail Away (the Sea Update) resets a scale that is not one on the first frame after a pause, unless
Travel Options' journey runs (ComeSailAway.cs 4296-4299). Its answer is a latch LateUpdate writes (4921-4934), and
LateUpdate returns while paused. In Unity the travel map's Begin runs inside a frame whose own LateUpdate latches the
new journey before the next Update's reset; the port's click lands between frames, so the reset read the latch the
last walking frame left - "not travelling" - and every journey begun or resumed from the map ran at x1 under a panel
still saying x10. A spinner click (not a pause) set the scale again, which is why only starting and resuming showed it.
It is "now" because Come Sail Away shipped with the Sea Update.

**The fix.** The unpause reset asks Travel Options itself before it reads the flag (`latchTravelling`, LateUpdate's
own four lines, one home now). A scale nobody's journey stands behind still comes back to one. Port-Ledger A
(continued): A JOURNEY BEGUN IN A PAUSE KEEPS ITS SPEED. `tools/mutants/travel_x1.json` 1/1 dead.

## FIELD-CSA1: the Large Boat nobody found (2)

The Large Boat carries no crew, so its deed is spent on placing (the mod's law: a crewed boat's deed stays, to call its
boat to a port); whatever the placing did with the boat, the deed was gone. Read against the port, four ways a placed
boat was lost, each a C# behaviour CSA-C had kept bug for bug:

- **The seabed** (the first attempt, the likeliest reading): the placing ray takes any collider whose name says
  "DeepWaters", and Iliac Puddle No More's carved floor is one (`DeepWaters_Seafloor`). A swimmer's eye is at or under
  the surface, inside its 0.5 m trigger box, and a ray never meets a box it starts inside (Unity's law, and
  `rayBoxEntry`'s) - so the ray went on to the seabed and the boat was stood there, under the water. With Spawn Water
  Surfaces off there is no box at all. Its loop was heard anyway: Unity's logarithmic rolloff stops at the source's
  max distance, so a boat's creak is at half volume everywhere - *"ocean bout sounds as if i was on a boat in the
  background"*.
- **Far out to sea** (the same symptom, another way in): with nothing hit inside the ray's 100 m, the sea mod's arm
  meets the plane at the WaterLevel wherever the look crosses it - a look a hair under the horizon from a dock stood
  the boat hundreds of metres off, out of sight.
- **After the respawn** (the second attempt): the online respawn is a teleport, and a teleport's `state.init`
  re-anchors the scene frame with no recentre offset to ride. The camps go through natives across it (AUDIT
  SURV-TIERS); the boats did not, so the boat just placed at sea kept the old frame's numbers - it stood by the temple
  its owner woke at, under the ground - and was never where it was left again.
- **Coming back by another way**: on each recentre the C# moves a boat only when it is active before or after its
  visibility check, so a boat out of sight keeps the old origin's numbers - and the port recentres at every map pixel
  crossed. A player who left it by one pixel and came back by another found it hundreds of metres off, or never.

**The fix** (`systems/comeSailAway/comeSailAway.js`, `world/streamingWorld.js`, `scenes/world.js`), four departures, Port-Ledger A
(continued): A PLACED BOAT FLOATS, STAYS IN REACH AND KEEPS ITS PLACE.

- A "DeepWaters" hit under the sea's top floats the boat on the water over it: where the look crosses the sea, else
  straight above the floor it met (`afloatAt`).
- The sea plane is met within the ray's own 100 m, as the dungeon's water plane already is; past it "Placement
  aborted!", the deed kept. The plane and the lift stand at the sea's top in the scene - the mod's 34 over the world's
  vertical compensation (`seaTop`), where the C# read 34 bare.
- Every boat rides every recentre, in sight or not, and asks its visibility after it moved - all but a dungeon's boat
  out of sight (Persistent Dungeon Boats): it stands in its dungeon's own frame, which neither a recentre nor a
  teleport moves, and the C# never moved it either (`ridesTheWorld`).
- A teleport's new frame carries every boat by the frame's own move (`StreamingWorldState.initOffset`, world.js
  `csaReanchor` -> `OnWorldReanchored`), then shows or hides it for the new pixel; the peers' eased places and the
  boats' colliders with it. The helm is not asked.

Not changed: the deed of an uncrewed boat is still spent on placing (the mod's own law), and a first boat of a hull
still appears a moment after it is placed while its textures load from ARENA2 (the *"after a delay"*: cosmetic, its
colliders are there at once). Dying at sea leaves the boat where it was placed; the player swims or sails back to it.

Pinned in `test/systems/comeSailAway/csa_placing.test.js` (+3, and OnPositionUpdate's pin re-aimed from the kept bug to the new law) and
`test/world/field_csa1.test.js` (2: the init's move keeps any point's natives; the host's helper mounted, and called after
the init, before the first await). `tools/mutants/field_csa1.json` 14/14 dead; six CSA-C records touched - five re-aimed to the moved source (one of them
because the new "Placement aborted!" line held a second copy of its text) and one retired (its mutation is now the
law) - and one CSA-F record re-aimed (the wake's stop moved into `shiftBoat`).

## TV-WASD: the Overworld's keys travel (Mac's ask)

`06-Systems/Travel-View.md` TV-WASD. Under the Overworld the movement keys walked at walking pace; now, while the view
is up and no journey drives, a held key runs the clock at the Travel Options spinner's speed, governed by TV2's load
governor, x1 again the moment the keys are let go (or a journey begins, the view comes down, a window opens, the body
swims or takes a helm). The bar says it ("Travelling at ×10"). Decided as lead: the Overworld alone, the spinner's
speed. `test/systems/travel/tv_wasd.test.js` (6), `tools/mutants/tv_wasd.json` 13/13 dead.

## OW-TOGGLE: first-person travel, a switch (Mac's ask, before the merge)

Mac: *"bring back the original travel option as a toggle. Off by default."* - *"Travel Options was changed. The normal
first person travel accelerated was removed in favor of the overworld travel"* (the Overworld's OW-ONLY, which reached
this branch with main's round 2, merged in here). `06-Systems/Travel-View.md` OW-TOGGLE: `GeneralOptions.FirstPersonTravel`,
the port's own key on Travel Options' pane, OFF and on the tile; on, every walked trip is the mod's own first-person
journey again - a map pick begun on the ground, the mod's resume, the view neither raised with it nor stopping it, its
clock never held at x1 under a lowered view. `test/systems/travel/ow_toggle.test.js` (5), `tools/mutants/ow_toggle.json` 7/7 dead.

## AUDIT OW5: the Overworld audited before the merge (Mac's ask)

Mac: *"Before we merge. Can we do a comprehensive audit on the overworld, just want to make sure it's perfect."* Seven
read-only lenses on one snapshot; every finding verified before it was fixed; the record, finding by finding, is
`06-Systems/Travel-View.md` AUDIT OW5 - ten MAJORs fixed (the find behind a dozen found dungeons, a window freeing the
pirates, a jump walking a route back to its old leg, the lock under a risen view, E and F from under the view, a
passenger walked off the deck, a moored boat boarded for a walk inland, an own-pixel sea spot landing the boat mid-sea,
the whole map's rung cut short, the giant's shadow), the MINORs with them, and five left for Mac with their reasons.
`test/player/eyeOfTheBeholder/ow5_audit.test.js` (14) beside the suites it touched; `tools/mutants/ow5.json`.

## Found on the way, not this batch's

- The doctrine pin on `src/net/staffCommands.js` (STAFF1), red on main when this batch began, is green: main's REALM
  merge named the file in the ONLINE row.
