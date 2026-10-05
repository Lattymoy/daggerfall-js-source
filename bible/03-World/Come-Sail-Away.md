# Come Sail Away - Come Sail Away 2.1 (CSA-A to CSA-L, from 2026-09-27)

RedRoryOTheGlen's **Come Sail Away 2.1** (Nexus 1131), ported 1:1 off the
compiled assembly - Mac, 2026-09-25: "All mods attached are to be
compatible and implemented 1:1." Provenance is
`vendor/come-sail-away/README.md` (its permission line is RECORD OPEN).
Mac held it on 2026-09-25 ("Let's hold off on sail away. Just finish up
and log future work") and handed the archive over again on 2026-09-26,
beside Ocean Holes'; the port read that as the hold lifted, said so, and
Mac answered "continue".

"Adds a usable boat and sailing mechanics": a boat bought as its parts
(item 1320) or its deed (1321), put in the water near a port, and sailed -
under oars, or under sails the wind fills and the player trims - with
waves around it, its cargo weighing it down, its sounds, and its position
read off the travel map at midday and midnight in clear weather.

## The slices

The line ranges are `ComeSailAway.cs` as the assembly reads back (6,808
lines, one MonoBehaviour).

| slice | what | state |
|---|---|---|
| CSA-A | THE REGISTRATION AND THE ASSETS: the vendored assembly, manifest, settings and item templates; the fifty keys; Features, credits, the registry, the online lane; the bundle's meshes, prefabs, animation, textures and audio out through the port's extraction tool (LoadSettings 787-897, Start 921-1095) | landed: registered; pictures, sounds and the boats as data carried |
| CSA-B | THE BOATS BUILT: SpawnBoat, the variants, the billboard crew and lights, the transforms a hull carries, the game textures, the skinned bake (1120-1811) | landed: built, textured, the sails baked, drawn by the streaming world (placing them is CSA-C's) |
| CSA-C | PLACING, PACKING AND THE SAVE: the placement ray, the nodes, the visibility, the saved boats (6112-6521, 3624-3820, 1923-2072) | landed: placed by the ray's five arms, kept by the nodes, the visibility and the origin, saved; four console commands (PackBoat and `giveboat` make items: CSA-H's) |
| CSA-D | SAILING: StartSailing, StopSailing, Update, FixedUpdate, the collision, the beaching, the turns (4186-5202, 5783-6071) | landed: the helm taken and left, rowed and turned, the collision and the beach, the cargo's weight, the riders, the seven activations raced (three answer: the rest are their slices'), the boat walkable; the sailing arms of death, the load and fast travel |
| CSA-E | THE SAILS AND THE WIND: UpdateWind, RotateWind, the sail power, raising and lowering, the Animator's parameters, the wind widget (3860-3941, 5216-5429) | landed: Unity's Animator restated (`world/unityAnimator.js`) and every boat's played - the sails stowed and raised, the rudder's oars and tiller, the doors; the wind rolled and turned; the sails' power, the square sails' assist, the trim (auto and by hand); the widget; the sails' and the trim's keys |
| CSA-F | THE WAVES AND THE EFFECTS: the wave textures and mesh, LateUpdate, the wake, rudder, oar and flag particles, rain and snow blown by the wind (1811, 2145-3479, 4802-5053) | landed: the coasts' breakers laid, their frames composed from the player's snow and stepped by day and night, their dithered shader; the current; Unity's particle system restated (`world/unityParticles.js`) and every boat's played - the wake and its two loops' play state, the rudder's drops and splashes, the flag; the bob; the rain's and snow's forces handed on |
| CSA-G | AUDIO, TIME AND TRAVEL: the sounds and the oars' events, the time scale, fast travel, transitions, the hour, the weather, death (1904-2126, 6071-6112, 6527-6687) | landed: the helm's time scale (its three keys, the enemies' two gates, the unpause reset, Travel Options' journey asked); Unity's AnimationEvents and a particle's start delay restated, the oars' three events; the five sounds - the two loops as Unity keeps them, the Galley's strokes, DFU's sails and door clips - and UpdateAudioSource; the boat's bed as Roleplay Realism's; the HUD's message clocks in game time (fast travel, the transitions, the load and death landed with CSA-D, the hour and the weather with CSA-E) |
| CSA-H | ITEMS, SHOPS AND CARGO: the two item classes, the shops' variants, the cargo, the ports (1095, 3820, 6521, 6687-6808) | landed: the two items (their rows, a UID of their own, their UseItem on the item-use door); the shelves through the one custom-group table (Iliac Puddle No More's fish on it too) and AssignVariantsToShopItems; PackBoat and the packed cargo; the cargo box; the variant picker; IsNearPort; `giveboat` |
| CSA-I | THE MAP AND THE WATER WALK: the position reading and its markers, OnGUI, WaterWalkingSilent (3941-4186, 5589-5778, 5966-6031) | landed: the position box's reading (the instruments' box, the two restrictions, the map a window in the mode's slot, its keys), the markers, OnGUI's map over the travel map rebuilt from the player's TRAV0I00.IMG, the debug values; the water walk on a hull, WaterWalkingSilent on the effect list and IsWaterWalking read one way |
| CSA-J | THE CLOSE: the message receiver, the compatibility arms (World of Daggerfall's terrain, Animated Water, Iliac Puddle No More; Travel Options' one message is CSA-G's), online, the audit, the patch notes (1007-1008, 1821-1890, 1973-1976) | landed: MessageReceiver whole and OnUpdateWind raised on a restore; Eye of the Beholder's boat camera and sprite; the two mods the port does not carry null in code, Iliac Puddle No More's arms checked; a sailor's boats seen by the others in a cell (`sa` on the foes frame); the audit's fixes (the load's doors, the Transport press, every mode's death, the new game's wind, the half-built hull, RuntimeMaterials' copy, the bed's offer rung); the patch notes |
| CSA-K | SAILING TOGETHER (the port's own, online - the player's ask, 2026-09-28: "I want people to be able to sail together, to walk on board as it moves"): the way on the wire, another player's boat boarded, stood on, carried by and left, the others seen on the deck | landed: below |
| CSA-L | THE HELM ON SCREEN (the port's own - "instead of an overuse of keybinds, is there a way we can instead develop enhanced plus UI elements?"): the Enhanced Plus helm panel, a pad's d-pad at the helm | landed: below |

## Cabins on owned sailing ships (SAILING-CABINS, 2026-10-03)

Requested departure: every owned large sailing ship includes its own cabin,
without buying a bank ship. Reuse the bank ship's interior through the existing
interior builder; connect entry to the sailing options already present.

| Sailing hull | Cabin layout |
|---|---|
| Small Ship (2) | Small bank ship, `SHIPAA00.RMB`, record 0 |
| Large Galley (3) | Large bank ship, `SHIPAA01.RMB`, record 0 |
| Carrack (4) | Large bank ship, `SHIPAA01.RMB`, record 0 |
| Rowboat (0), Large Boat (1) | No enclosed cabin or door on these open hulls |

An owned, placed ship's existing menu gains **Enter cabin** and **Open / close
door** beside **Open storage**. Enhanced Plus selects the cabin action when aiming
at its door; classic/touch uses the same existing list picker. The original door
animation is still reachable. Board the ship and leave the helm before entry.
The entry rechecks ownership, deck contact, travel and dismount state. No extra
key binding, bank purchase, deed consumption or helm path is introduced.

The layout is shared; the contents are not. Each boat UID names a permanent
`SailingCabin [UID=...]` scene in the existing save cache, including its containers,
placed furniture and loose items. Packing and relaunching keep that UID. Existing
boat cargo stays in its original hold. Bank ownership is untouched. The synthetic
building's negative UID distinguishes Recall identities.
Saved cabin data uses validated native coordinates and a boat-local deck position;
loading requires that boat in the loaded save, never one from the previous character.
The interior frame remains axis-aligned, matching the translation-relative decor
cache even when the boat turns between visits.

**A bank ship's cabin, linked** (`systems/boatCabinOwnership.js`, shipped with the
cabins in #574 and recorded here 2026-10-04). A player who owns a bank ship keeps
its furnished room by linking it to ONE sailing ship of its size (a Small Ship to
the small bank ship; a Large Galley or a Carrack to the large): the bank ship's
saved scene is moved intact to that ship's `SailingCabin [UID=...]` key, never
merged over a second furnished room, and the link is never reassigned. It is made
by itself only when exactly one ship of that size is held; with more, the boat's
menu offers **Link existing bank cabin**. Once linked, the bank ship's Ship
transport and its door open that ship's cabin where she lies (`world.js`
enterLinkedBankCabin, `worldModes.js` enterInteriorCore); a ship not afloat is
called from the Fleet first. The ships held are counted wherever her title is:
afloat, her parts in the pack or the wagon, and her title in the Fleet's book
(CABIN-TITLES, 2026-10-04 - HOLDINGS moved deeds out of the pack into the book,
and the count still read only the pack, so a ship laid up was no candidate: the
one ship of her size afloat was taken for the only one and given the bank cabin's
contents, and a lone ship laid up was not found at all).

**Mac's "The classic style ship is broken. its two ships clipped inside of eachother" and
"from the ship deed it spawns in a dark void outside the game world and you can move
around another ship under construction" (2026-10-04)** are the sailing cabin drawing
her own fleet through its walls - CABIN-HULL below, which fixed it on main the same
day (#579).
OPEN FOR MAC: the bank cabin link above is made WITHOUT asking when one sailing ship
matches (`boatCabinOwnership.js linkBankCabin`, from her menu, Enter cabin and every
load outdoors): the bank ship's room moves into her cabin, and Transport > Ship and the
bank ship's door then lead to her cabin, not to "Your Ship". Whether that link should
be asked first is Mac's call; it is left as it stands. (The sentence this flag first
answered - "Bank ownership and bank ship scenes stay independent" - is retired, the
link recorded in its place, by CABIN-TITLES.)

**Return to deck** goes through the same exit transition and resolves the same
live boat's deck pose. It uses feet height without snapping to the seabed. A missing
boat refuses the exit without destroying the room. Cabin entry/exit does not take
the helm, change sails, change cargo or add a second sailing simulation.

The cabin is private to the owning player, but passengers may remain on deck.
Cabin entry keeps the exterior fleet active and its existing online cell/halo
connection at the boat anchor. The kept fleet stands outside the room: every
hull, the owner's and every peer's, stays in the street's collider, and the
cabin neither draws a boat nor answers a press on one (CABIN-HULL, FIELD BUGS
2026-10-03b - the room is built at her root, so her decks had crossed it as
floors, and a press there on her ladder or her helm stood the player on her
deck in the building's frame, her hull alone in the black). The normal boat stream carries a `cabin: 1` flag;
full heartbeats continue while indoors. The exterior foes stream supplies an empty
actor envelope using its existing sequence counter. The owner's indoor position,
movement, casts and lights are not sent outside. Updated peers hide the below-deck
owner from rendered actors and interaction/target lists while retaining their
network presence for boat liveness. The cabin owner receives boat and rider
updates without spawning exterior enemies in the private room. No relay protocol
change or second connection is required; older clients retain the fleet but may
show the owner's stationary exterior avatar until updated.

If a remote owner disconnects, times out, withdraws or teleports a boat while a
local passenger is aboard, the passenger retains that occupied hull at its last
pose. Its collider and aboard identity stay until they step off; it is then
removed. A reconnect at the same berth reuses it. This is a local passenger safety
copy, never another owned ship, a shared persistent parked-ship registry, or a
boat the passenger can sail. Different clients need this patch for that safeguard.
Normal owner packing already refuses occupied boats and retains that rule. Shared
cabin visits and sailing while the owner is inside remain outside this patch.

Host coverage: `world.js` supplies ownership, menu, boat pose and save data;
`worldModes.js` builds, caches, restores and exits the cabin through the existing
interior path. Standalone `exterior.js` has no sailing runtime or world-save
composer and offers no cabin entry. `dungeonContext.js` has no exterior sailing
boat and offers no cabin entry. No second interior builder is added.

`test/fb1003b_cabinhull.test.js` pins the fleet out of the room (the street's
collider, the picks, the press, the draw) and the deck solid under the first step
back. `test/cabintitles.test.js` pins the bank cabin's count over
the book, the pack and the boats afloat, and the not-afloat refusal. `test/sailingcabins.test.js` exercises real deed launch/pack/relaunch and runtime
save data, menu routing, per-boat cache persistence, failures and the shipped host
entry/exit/restore and network functions, long-running cabin heartbeats, and
occupied-deck retention on owner loss. Actual ARENA2 rendering, doorway clearance
and live online passenger behavior still require the in-game checks in `PATCH-NOTES-Sailing-Cabins.md`.

## The settings (CSA-A)

Ten sections, fifty keys, restated key for key in `systems/modSettings.js`
under `come-sail-away` (section and name joined with a dot), with the
port's own `Enabled` in front, on. The four unnamed spacer sections
("---", "----", "-", "--") carry no keys. The mod wrote six descriptions
(PortLocationSearchRange and five of Map's) and they are the pane's; the
port wrote the rest, each from what LoadSettings does with the key.

- **Three keys ship and do nothing** - `Handling.BadTack`,
  `Handling.BadTackMultiplier`, `SailingAssist.AutoStowGaffSails`.
  LoadSettings reads none of them, and no method can: the assembly's
  string heap (#US - every literal a method names is an `ldstr` of one of
  its entries) holds every other key's name and not these three
  (`tools/lib/clrUserStrings.mjs`, pinned in `test/csa_registration.test.js`).
  They are declared as shipped, so a player's file keeps them.
- **How LoadSettings reads the numbers**, which the slices restate:
  `Waves.Length` is halved into the waves' dither end, `Waves.Fade` is a
  fraction of that length (the dither start), `Waves.Speed` is read in
  whole hundreds - `(2 - Speed / 100) * 0.125` with an INTEGER division,
  so under 100 is half speed, 100 to 199 the mod's own and 200 a frame
  every frame (kept bug for bug, CSA-F) - and `Map.BackdropOpacity` is a
  percentage (`* 0.01`).
- **The nine Controls keys are Unity KeyCode names.** Each becomes a
  registry action (`systems/inputActions.js` MOD_ACTIONS, KB1) with the
  slice that reads it, and four of the shipped defaults are already taken
  in the port's one table (one key, one action): C is Crouch, Space is
  Jump, Period is Horse Cart and Cargo's summon, and the keypad's plus is
  Eye of the Beholder's automatic view. The mod reads its keys only at
  the helm (and Disembark answers the Transport action too, Actions 15);
  how the port shares those four is decided in CSA-D and CSA-G, and
  written here: CSA-D's two, Disembark and ToggleLight, are the
  registry's `BoatDisembark` on `'` and `BoatToggleLight` on `;`
  (bible Controls.md, for Mac's read). The brackets, the backslash and the keypad's minus and
  enter are free.
- **The tile shows four** (`systems/features.js` MOD_CURATED): whether
  the sails trim themselves (the mod's one real difficulty switch), the
  wind's widget, the waves and the boat's sounds. The handling, cargo and
  map dials stay in the mod's own pane.

## The bundle

`Mods/come sail away.dfmod`, UnityFS 7 built by Unity 2019.4.41f2, 13.5 MB:
a serialized file of 10,465 objects, a `.resS` of 836 KB (three hull
meshes stream from it) and a `.resource` of 4.15 MB (the eight audio
clips, FSB5 Vorbis). In it: 228 meshes (19 skinned, one bone each),
48 prefabs - the activation objects 112400-112406, the hulls
112410-112414, the crew's billboards, the lanterns, the wake, flag, oar
and rudder effects - 143 animation clips under five controllers and 26
override controllers, four materials of its own and three shaders, and 62
textures: Unity's two particle defaults, two Bayer dither tables, and 58
of the mod's own archive 112395 (record 0 one 52x41 picture, record 1
twenty-four 128x128 frames, record 2 thirty-two 640x640 frames, record 3
one 1000x500 picture). A material named `TEXTURE.AAA_R` is Daggerfall's
archive AAA record R, loaded from the player's own files (the mod's
`ApplyGameTextures`, and the port's) and never carried.

What each record is, and which the port may carry. `tools/comeSailAwayExtract.mjs`
measures every picture against every record of every TEXTURE file of the
ARENA2 it is given before it writes anything, and refuses what fails:

- **Record 3 is Daggerfall's own art, and is never carried.** It is the
  travel map: `TRAV0I00.IMG`'s 320x160 interior - from row 12, DFU's
  `regionPanelOffset`, the snip DFU's own map overlays are cut from - scaled
  to 1000x500, one texel a map pixel (sampled at the texel centres the two
  agree to 7.3 of 765 per pixel; the residual is the author's resampling).
  The mod draws the boat's position on it (`mapTexture`, CSA-I), so the
  port builds the same picture from the player's own `TRAV0I00.IMG` at run
  time, as Iliac Puddle No More's coastline is rebuilt (DW-A).
- **Records 0 and 1 are the author's.** No record covers record 0 (a
  52x41 splash) or any of record 1's twenty-four frames (the wind widget's
  arrow, `windDirectionWidgetTextures`, four blues on a clear canvas) by
  Detailed Ships' search (`findClassicSource`: a record within a pixel of
  the size, at every offset), neither whole nor cut to its visible box,
  and no square record matches more than 17% of the visible pixels of any
  block of them (`tools/lib/classicBlocks.mjs`). They are carried as
  indexed PNGs of the bundle's pixels.
- **Record 2, the waves, is Daggerfall's snow under the author's paint.**
  Every crest pixel of the thirty-two 640x640 frames is TEXTURE.303
  record 1 - the snow - repeated across the frame: 119,409 of each
  frame's 241,396 opaque pixels, exact. The block search first missed it
  (a crest fills only 42% of a block, and a flat TEXTURE.000 swatch
  "matches" a mostly-grey block to 59%), which is why that search now
  judges visible pixels only and never lays a flat swatch; laying the
  snow itself across the frame found it. What is left - the troughs, the
  wave shapes, the few odd colours - is no record's: 6% of its 4x4
  patches occur anywhere in the TEXTURE files, scattered over unrelated
  records, and no colour mapping of the snow at any phase explains more
  than 38% of it. And the 32 frames are TWO pictures, each scrolled down
  the same sixteen steps (0, 632, 624 ... 576, then 570, 562 ... 522
  rows): the even frames the first, the odd the second, exact. So the
  port carries the author's two paints - the crests as a key colour - and
  each frame's paint, scroll and the snow's phase (`Textures/derived.json`),
  and `formats/derivedTexture.js` `composeTiledPicture` rebuilds a frame
  from the player's own TEXTURE.303: the tool checks every rebuild exact
  against the bundle's frame, and each paint, the snow taken out, passes
  the block search (19% at most). The wave shader cuts out every texel
  under alpha 0.5 (`Daggerfall/Dither/Wave`: `discard` below `_Cutoff`),
  so a clear texel's colour is never seen and is not carried.
- **Unity's own** - `Default-Particle`, `Default-ParticleSystem` (the
  engine's built-in particle pictures) and the two Bayer tables (a matrix,
  not a picture) - are not the mod's to give: the port draws its own
  particle picture, and carries the 8x8 table the waves' material names
  as the 64 thresholds it is (CSA-F).

The mod's own pictures are all in exact `ART_PAL.COL` colours - the
waves' paints need 57 RGBA values between them - which is why they carry
as indexed PNGs (`tools/lib/indexedPng.mjs`): 240 KB for everything.

## The sounds (CSA-A)

Unity imports a clip as Vorbis and stores it as an FMOD sound bank
(FSB5) in the bundle's `.resource`. FMOD keeps the audio packets and drops
the three Vorbis headers: the identification header's numbers ride in the
bank's sample header, the comment header is gone, and the setup header
(the codebooks) is replaced by its CRC32. `tools/lib/fsb5Vorbis.mjs` puts
the stream back together - the bank read as vgmstream lays it out, the
setup header whose CRC32 the bank names (`vendor/vorbis-fsb-setups/`,
vgmstream's table; one is libvorbisenc 1.3.7's own output), that header
parsed to its mode table so each packet's block size gives its granule,
and Ogg pages around the packets, untouched. On 2026-09-27 the six clips
at hand decoded in Chromium to the same PCM, sample for sample, as
libvorbis's own remux of the same banks (python-fsb5).

Five clips are carried, the five `ComeSailAway.Start` loads:
SmallShipAmbience (32 kHz, 182 s) and ShipExteriorAmbience2 (44.1 kHz,
202 s), the boat's slow and fast loops, and Oars_In, Oars_Sweep and
Oars_Out (22.05 kHz), which the oar strokes' animation events play
(`OarEvent_In/Sweep/Out`, `PlayOneShot` on the rudder's audio source).
The mod ships three more and never plays them - All_Together, and
oars_cut_1 and oars_cut_2, the latter the rudder's own source's clip,
which only ever has the three oar clips played over it.

## The boats as data (CSA-A)

`tools/lib/unityScene.mjs` reads the bundle's objects through their type
trees into what the port can draw and animate without Unity, and the
extractor writes `vendor/come-sail-away/Models/`:

- **The prefabs** the assembly asks DFU's `MeshReplacement` for - the five
  hulls (`SpawnBoat`: 112410 + hull) and the seven trigger boxes, four
  of which `GetBoatTransforms` stands under the nodes that name them
  (112400 DriveTrigger, 112401 BoardTrigger, 112402 CargoTrigger, 112403
  DoorTrigger) - as the trees the C# walks BY NAME: `Variants`, `Crewed`,
  `Packable`, `Handling*`, `WakeObject`, `RudderObject`, `IdleObject`,
  `ActiveObject`, the `Sail` and `Boom` nodes... Every node keeps its name,
  active flag, layer, local transform, components and children in Unity's
  order; a pointer becomes the node it lands on (or `{ node, component }`
  for another component, a sub-emitter's particle system), the asset's
  key, or `{ builtin }` for one of Unity's own primitives. A particle
  system's switched-off modules keep only their switch. The trireme alone
  carries 108 oar effects, so identical components are stored once (1,147
  nodes, 482 distinct components). The one script in the prefabs is DFU's
  own `RuntimeMaterials` (a submesh's material by Daggerfall archive and
  record); the mod's four behaviours are added by its code at run time.
  The Rowboat's, the Large Boat's and the Large Galley's hull roots carry
  a helper `Plane` (the Small Ship and the Carrack none; CSA-J's audit)
  (Unity's built-in 10 x 10 plane at 10x
  scale) has its renderer and collider both off, and stays so.
- **The meshes**: Unity 2019's vertex data - channels in streams, each
  stream 16-byte aligned, a channel's dimension the low nibble of its byte
  - inline, or in the `.resS` for the six largest hulls; 209 meshes,
  38,238 vertices, 18,076 triangles. Position, normal, uv0 and the
  single-bone skin index are written; the tangents and extra UV sets the
  import carried are not (no shader the boats wear reads them).
- **The animation**: Unity keeps only a Mecanim clip's compiled MUSCLE
  CLIP in a build, so a clip is read the way AssetStudio reads one -
  streamed curves (Hermite segments), then dense, then constant, numbered
  in that order, and each generic binding (a transform's position,
  quaternion, scale or euler angles) takes the next curves its attribute
  needs, its transform named by the CRC32 of the path from the Animator.
  Every binding of every clip resolves under every Animator that plays it
  (3,464 checked) but six: three of the skiff's large staysail clips
  animate a bone its rig has not got - one path in six, its position,
  rotation and scale - which Unity animates nothing for, and so will the
  port. The controllers (sail, staysail, rudder, rudder wheel, door) come
  out as their compiled state machines with every name from their own id
  table: the sails' `Stowed` bool and a 1D blend tree on `Wind` (-1..1),
  the rudder's `Sailing`, `TurnAngle`, `RowZ`, `RowX` and `RowSpeed`, the
  door's `Opened` - and the 26 overrides swap in each boat's own clips.
  The rowing clips carry the three events the assembly answers
  (`OarEvent_Sweep`, `OarEvent_Out`, `OarEvent_In`).

## The boats built (CSA-B)

A boat is the tree the C# makes and walks, over `world/prefabNode.js`: a
GameObject and its Transform in one node, its components the extractor's
records (each instance its own copy), with the Transform rules the C#
leans on - T*R*S down the chain, `activeInHierarchy`, GetComponentInChildren
on ACTIVE objects only, depth first, this one first (a switched-off
component is still found - Unity asks the object, not the component),
SetParent(p, false) keeping the local transform and `transform.parent = p`
keeping the world one (the local scale re-derived as
Transform.SetWorldRotationAndScale does: the local scale set to one, the
node's world rotation-and-scale inverted, times the one it had, the
diagonal read off). A component's node pointer (a bone, a root bone)
resolves in its own instance by the prefab's path, so a renamed root still
answers; no pointer in the files names a path two nodes share (pinned).

`systems/comeSailAwayBoat.js` is `Boat` (Boat.cs, field for field) and
SpawnBoat, ApplyBoatVariant / ReinitializeBoat / SetBoatVariant,
SetupBillboardHelper / AddBillboardLight / SetupModelHelper / SetLights and
GetBoatTransforms in the C#'s order, with DFU's own doors restated as DFU
writes them:

- **MeshReplacement.ImportCustomGameobject** (MeshReplacement.cs:99-120):
  the prefab instanced, named `DaggerfallMesh [ID=n] [Replacement]`,
  `transform.parent = parent`, moved to the player's position and
  rotation, its scale times the player's (one). Each renderer's
  RuntimeMaterials is applied as the instance is made, where Unity applies
  it at each renderer's Awake - the same answer, because every one of the
  thirty-two has ApplyClimate and UseDungeonTextureTable off (pinned).
- **GameObjectHelper.CreateDaggerfallBillboardGameObject** (:313-334) and
  **CreateDaggerfallMeshGameObject** (:147-207), `transform.parent =`
  both; a flat's Summary.Size is the record's scaled size
  (`world/rmbFlats.js` billboardSize), a model's box its vertices'.
  DFU's trigger box for a flat with a custom activation is never added:
  every registration in the sources the port carries is a model's
  (Roleplay Realism's beds 41000-41002, Eye of the Beholder's cart 41239,
  this mod's seven). The boat's bed IS model 41000, so in DFU Roleplay
  Realism's BedActivation answers it - CSA-G's to settle.
- **InstantiatePrefab(DungeonLightPrefab)** for a lantern's light: DFU's
  scene asset is not in the sources, and the mod overwrites every Light
  field it has; the prefab's DaggerfallLight reads Animate and
  InteriorLight false.

What a hull's walk finds - the active tree only, never into an inactive
object, with the chosen variant switched on first (all seven of the
skiff's are off in the prefab), and the loop reading the child count
afresh each step, so the door trigger the walk imports under the node it
is walking is walked too:

| hull | sails | lanterns | crew and other flats | triggers | effects |
|---|---|---|---|---|---|
| 0 Rowboat (`Dingy`) | none | 1 | - | drive, board | wake, 2 oars |
| 1 Large Boat (`OldSkiffHull`) | its variant's (variant 3: the small square and the large lateen) | 2 | the bow's 253/15 | drive, cargo, variant, board | wake, flag, rudder |
| 2 Small Ship (`Galleon`) | two lateens (one under a node scaled 2.83) | 18 | officers, boatswain, coxswain, master-at-arms, quartermaster, cook | all seven kinds; the door's box sized to the door | wake, flag |
| 3 Large Galley (`Trireme`) | one square | 25 | its crew and twenty rowers | all but position | wake, flag, two rudders, 108 oars |
| 4 Carrack | five (square and lateen) | 0 | - | drive, cargo, two board, seven doors | wake |

The modifiers come off the `Modifiers` nodes as the C# reads them
(Handling's position x and y, scale x and y; Audio's y and z with the
volume one whatever the node says; Cargo's x - the carrack carries no
Cargo node, so its threshold stays 0, the author's data). The five nodes
stand off the hull collider's box: centre, fore and aft by the z extent,
starboard and port by the x.

### Which texture each face wears

A renderer with DFU's RuntimeMaterials takes
`MaterialReader.GetMaterial(Archive, Record)` into slot `Index`, entry by
entry and component by component (RuntimeMaterials.cs ApplyMaterials; an
index past the slots ends that component, the next still runs). The
carrack's third mast carries two, and the second's 067_8 and 000_76 are
what it wears. A sail - a SkinnedMeshRenderer - takes the mod's
ApplyGameTextures, which reads its children's names: slot i wears the
`AAA_RRR` child i spells (`Convert.ToInt32`, so the trailing space four of
the skiff's sails carry reads as nothing; a name that will not parse, or a
missing child, is an exception out of Awake - the slots stay as they
were). Every such material is opaque (alphaIndex -1, the pipeline's
`uploadRecord(..., { opaque: true })`). A slot neither touches keeps the
bundle's material - a Standard material named after a Daggerfall texture
but holding none (DFU's FinaliseMaterials swaps one only for a loose
texture file), Unity's Default-Material, the WaterMask - and every
renderer that keeps one is hidden and stays hidden (the flag's cube, the
carrack's two dock planks, three hulls' helper plane), and the two hulls'
water masks too (CSA-F: they write colour alone, before any opaque thing
and with no depth, and the sea or the hull always draws over them). A renderer with fewer materials
than its mesh has submeshes draws only the first (the galleon's anchor,
four and two); one with more draws its last submesh again.

### The sails: FixDeformations

Each walked skinned renderer gets ApplyGameTextures and, as its last
child, a new object with FixDeformations: its Awake switches the skinned
renderer off and hangs a MeshFilter and a MeshRenderer on the holder
wearing the skinned renderer's materials, over an empty mesh; its
LateUpdate bakes when its timer passes 0.1f (Time.deltaTime, in Unity's
floats: eight frames apart at 60 fps, never while paused) - BakeMesh then
RecalculateNormals (`world/skinnedBake.js`):

- one bone per vertex (a bone index, no weights: a weight of one), its
  skinned position the bone's localToWorldMatrix times its bind pose. On
  the vendored sails this is checked against what Unity itself stored: in
  each root bone's frame the skinned mesh fills the renderer's `m_AABB`,
  the box Unity measured off this same pose, to 3.5 cm on every sail and
  exactly on most;
- the bake in the renderer's frame, its position and rotation undone and
  its SCALE KEPT - which is how the holder, parented with `transform.parent
  =` and so at a local scale of one over the renderer's, shows each sail
  exactly where the skinned renderer would have drawn it (pinned, the
  galleon's scaled lateen included);
- the normals Unity's way: each triangle's cross(b - a, c - a) - the
  outward normal for Unity's clockwise front, which the bundle's own
  imported normals agree with on 18,060 of 18,076 triangles - summed at
  its three vertex indices unnormalised, no vertex merged with another at
  its position, each sum normalised.

Since CSA-E each sail's Animator plays (below): SpawnBoat's
CrossFade("Stowed", 2) and SetBool("Stowed", true) are taken at its first
update, and the bake follows its bones each tenth of a second.

### The lanterns

A lantern is any archive-210 flat a BillboardHelper stands; its light is
Color32(255, 147, 41), intensity 1, range 20, a point light. SetLights
switches the Light and DFU's DaggerfallLight and DungeonLightHandler on
it together, and turns the flat's `_EmissionColor` white or black (the
renderer's `emissionOff`: an unlit lantern's flat binds no emission map,
and the bloom passes it by). SpawnBoat calls SetLights(LightOn = false), so
every boat stands dark; a boat with no lanterns never records the switch.
While they run, DFU's two behaviours decide the light frame by frame as
their code does: DaggerfallLight sets it to IsCityLightsOn on its first
frame and at each change of that flag, DungeonLightHandler every 0.4 s of
game time sets it to "within 51.5 m of the player on the ground plane".

### Drawn

`scenes/comeSailAwayPool.js` loads the five files once, loads what a hull
reads out of the ARENA2 before it is built (`boatAssetNeeds`: its flats,
its classic models), then lets SpawnBoat run straight through as the C#
does. Each frame the streaming world (`scenes/world.js`) ticks it just
before the horse cart's tick (the holders' LateUpdate, the lanterns' Updates), draws its
meshes in the world pass, its flats on the flats' pass (a flat's centre on
its object, sized by its record and its object's world scale) and hands
its lit lanterns to the light list (outdoors into the scene's own selection, ranked by
distance with the street's lanterns in their own colour, as a building and a dungeon
take them - AUDIT PRE-MERGE 0928 R2; they had ridden the player's extras, white on
the classic set and ahead of nearer lanterns). The `?shot` probe stands a boat
with `__csaSpawn(hull, variant, x, y, z, yaw)` (since CSA-C through the
runtime's own PlaceBoat); `__csaLights`, `__csaStat`, `__csaConsole`,
`__csaClear` (purgeboat, boat by boat), and CSA-C's `__csaReady`,
`__csaNodes`, `__csaShore` (a land tile three tiles off water, where to
stand) and `__csaRoundTrip` (the save's record out and straight back in)
beside it. Seen live (scratch renders, 2026-09-27): the rowboat and the
skiff drawn with their lanterns and stowed sails; `placeboat 1 3` from a
pond's edge in Daggerfall (the terrain arm) standing the skiff broadside
on the water, `printboats` naming it at 207, 213, and the record's round
trip standing it again where it stood. The single-location
dev scene (`scenes/exterior.js`) carries no boat, as it carries none of
Iliac Puddle No More, Ocean Holes or Warm Ashes: the mod is the streaming
world's and its modes'.

Not drawn yet, and whose: the water masks and the particle systems
(CSA-F). The colliders the ray answers are CSA-C's (below); standing on
them is CSA-D's (the boat in the world's collider, below).

**Kept bug for bug**: the doors' trigger boxes are filed under
BoardTriggers, and DoorTriggers stays empty; the variant, status and
position triggers keep the player's rotation relative to the boat at the
moment it was built (the C# never resets their local rotation); a model
helper's shift is a world-space difference added to a local position.

**Declared** (the Port-Ledger's Come Sail Away row): BakeMesh keeps the
renderer's scale (Unity 2019.4 has no `useScale`; the mod's own holder
agrees); RecalculateNormals weighs by area and merges nothing; a
collider's and a renderer's bounds are their local box's corners
transformed (the port's standing reading, `world/staticBuildings.js`); at
most the eight nearest lit lanterns reach the light list, their Hard
shadows are not cast on the classic set (on the Enhanced Lighting lane
they cast as its lanterns do - AUDIT PRE-MERGE 0928 R4), and the light a frame decides reaches the next
frame's list; DaggerfallLight's Update runs before DungeonLightHandler's
within a frame (Unity names no order).

## Placed, kept and saved (CSA-C)

`systems/comeSailAway.js` is the MonoBehaviour's placing half as one
runtime over the host's seams, statement for statement: StartPlacing /
StopPlacing, the three PlaceBoats and two RepositionBoats (the C#'s
overloads by name: the int one, the Terrain one, the DFPosition one),
both PlaceBoatAtRayHits, both SetBoatPositionAndDirections,
GetMapPixelFromTerrain, both UpdateBoatNodes, UpdateAllBoatsNodes, both
UpdateBoatVisibility, OnPositionUpdate / OnPositionUpdateBoat, OnLoad,
OnTransition, GetPlacedBoatWithUID, GetHitBoatIndex,
GetTileMapIndexAtPosition, the placing arm of LateUpdate (4957 - CSA-C
first called it Update's; CSA-D moved it where the C# has it) and
ComeSailAwaySaveData whole. What a later slice owns is named where the C#
calls it: the wake's Stop and the particles moved with the origin
(CSA-F), PlaySlow (CSA-G), the helm (CSA-D), the wind's event (CSA-E).
The runtime is made as the world mounts with the mod on, and only then
does its record ride the save (Ocean Holes' precedent: a mod DFU did not
load writes none).

### The ray and its five arms

`Physics.Raycast(camera ray, 100 m, every layer but Player and Ignore
Raycast)`, triggers taken (queriesHitTriggers, Unity's default), answered
by the host (`csaRaycast`, `scenes/world.js`) over the port's scene as its
colliders stand: the static world's meshes (the street's, the building's
or the dungeon's collider), outdoors the ground (a terrain, or Iliac
Puddle No More's carved floor - `DeepWaters_Seafloor` - where the sea is
carved: the ground walked in quarter-metre steps and the crossing halved
to the millimetre) and the mod's trigger slab over the sea
(`DeepWaters_Surface`, WaterSurfaceManager.EnsureVisibleSurface: a box
819.2 x 0.5 x 819.2 centred 0.03 over the ocean line), the foes' and the
watch's CharacterControllers, and every boat's own colliders
(`world/prefabColliders.js`: an active object's switched-on BoxCollider
from outside only, a MeshCollider from either face - the port's standing
reading of DFU's - a convex one as its mesh's hull, a trigger only when
the query takes them). Each hit carries its object's name and its Terrain
or none. The ray is the activation's own (`cam.pos` and the look), in
third person too.

1. **Iliac Puddle No More and a "DeepWaters" name** (the slab from above,
   and the carved floor, whose name carries it too): "Boat placed!"; a
   point under the sea's top - the floor - is floated to it (FIELD-CSA1:
   where the look crosses the sea, else straight above the floor it met;
   a swimmer's ray starts inside the slab and never meets it, and with
   Spawn Water Surfaces off there is no slab, so the C#'s boat stood on the
   seabed); a second ray straight down with triggers ignored names the
   Terrain under the point (none over a carved floor, which is no
   Terrain), a deed repositions the boat of its UID, else a new boat at
   the point.
2. **A dungeon's water** (blockWaterLevel not 10000 - underground, or
   outdoors while Iliac Puddle No More's forge holds one): the plane at
   `blockWaterLevel x -0.025` (Unity's floats); no intersection, or one
   past 100 m, stops placing with the C#'s own log line; a hit farther
   than the plane places a boat on the plane, marked inside - never a
   deed's lookup (kept); a nearer hit falls through to the terrain test.
3. **A Terrain whose tile under the hit is water** (TileMap `.r / 4 ==
   0`, GetTileMapIndexAtPosition's float offsets truncated and clamped):
   placed there, the deed's boat repositioned. Anything else: "Boat can
   only be placed on water!".
4. **Nothing hit, Iliac Puddle No More on**: the plane at the sea's top -
   the mod's 34 over the world's vertical compensation (FIELD-CSA1: the C#
   read 34 bare, the sea only while no vertical recentre has happened) -
   met within the ray's own 100 m, as arm 2's plane is (FIELD-CSA1: the
   C# took any crossing, and a look out to sea stood the boat hundreds of
   metres off); past it the C#'s too-far log line and "Placement aborted!"
   for 3 s, the item kept.
5. **Nothing hit, the mod off**: "Placement aborted!" for 3 s.

The boat's forward is the player's right (broadside to where they
stand); its pixel is the player's, or the hit terrain's when that is not
the player's own. The item's half (dormant until CSA-H's items call
StartPlacing): the boat takes the item's UID, the cargo packed under it
comes aboard (TransferAll, the packed collection emptied and kept), and
the item is spent unless the boat is crewed. The placing click is
ActivateCenterObject's release (a finger's tap: the frame its press lifts, the
activate gate's fire - never the stick's lock-only tap: AUDIT PRE-MERGE 0928
U2), more than 0.2 s after StartPlacing,
behind LateUpdate's pause gate and never while sailing; the hull and variant
are the item's `message / 10 % 10` and `message % 10`, logged as the C#
logs them.

### The nodes and the visibility

A boat's five nodes read their water on a terrain: inside a dungeon with
water all five are water, a dry inside reads nothing; outdoors with Iliac
Puddle No More `SampleHeight(node) < 34` (over the terrain's own y, at the
precision Unity's 16-bit heightmap holds it - FIELD-CSA2, below) is water
and anything else land; without it the tile map's record.

FIELD-CSA2 (2026-09-29, the Discord through Mac: "I can't get my boat to
work", "Ports are bugged for player boats"): the line is the sea's own
height. The terrain sampler clamps the whole sea to the ocean elevation,
27.2 x 1.25 = 34 m, and Unity holds a heightmap in steps of 1/32766 of the
terrain's height (kMaxHeight): the flat sea is 579.105 steps, held as 579 -
33.994 m, under the line. The stand-in first read the drawn ground's floats
(DW-D's reading), 34.000001 m: every node of every boat on the open sea
read land, so with the mod at its default no boat rowed (beached) or raised
a sail ("Unable to raise sail. Boat is obstructed.") and the Overworld's
crossing never launched. `scenes/world.js` `csaTerrainOf` reads
`world/terrainSurface.js` `terrainSampleHeightAt` now: each corner as its
step, the steps over the quad's two triangles (GetInterpolatedHeight, the
drawn ground's own cut), the height a step times size.y over kMaxHeight.
Declared: the port rounds a height to its step (Unity's own rounding is in
no source the port has; the sea is step 579 either way).
`01-Overview/Field-Bugs-2026-09-29c.md`. SEA-SHOAL (FIELD BUGS 2026-10-02)
had a carved cell's ground read as its seafloor; its audit struck it
(FIELD BUGS 2026-10-02b, `01-Overview/Field-Bugs-2026-10-02b.md`): Deep
Waters' real carve takes a cell only where its four corners stand at the
ocean's height, so it carved none of a sea World of Daggerfall's flatten
had lifted over the line, and every node there read land still - the ship
beached at sea, her sails refused ("Unable to raise sail. Boat is
obstructed."). The sea is kept at its source now (SEA-LEVEL,
`03-World/World-Of-Daggerfall.md`), and `csaTerrainOf` reads the
heightmap as it did. PLACE-AFLOAT (a departure): with Iliac Puddle No More
on, PlaceBoatAtRayHit refuses a water tile whose ground stands over the
line - a town's harbour basin at its ground's height - with a word
(PLACE_RAISED_TEXT), where it placed her beached; the mod off, the tile
alone decides, as the C#'s.
`01-Overview/Field-Bugs-2026-10-02.md`. The Terrain form reads the player's
terrain unless one is given; the pixel form reads its own pixel's, and
nothing where none is built. UpdateAllBoatsNodes is kept as the C# has
it: nothing calls it, and its `MapPixel == CurrentMapPixel` compares two
references, the second new each read. UpdateBoatVisibility: indoors only
a boat placed inside this pixel stands - so a building shows its
dungeon's boat (kept); outdoors a boat more than a pixel off hides, and
one placed inside hides and is destroyed unless Compatibility/
PersistentDungeonBoats keeps it; a near one stands and reads its nodes.
The one-boat form never destroys and reads the nodes whatever it
decided. It runs on OnTransition (the four doors, the Respawner's outside
arm too) and on OnLoad; on FloatingOrigin's recentre EVERY boat moves by
the offset and then asks its own visibility (FIELD-CSA1: the C# moved one
only when it was active before or after that check, and the port
recentres at every map pixel crossed, so a boat left out of sight stood
wherever the old origins had it when its player came back by another
pixel) - all but a dungeon's boat out of sight (Persistent Dungeon Boats),
which stands in its dungeon's own frame, and which the C# never moved either. A teleport's new frame (`scenes/world.js` `_teleportToPixel`:
InitWorld, no offset to ride - the respawn at a temple, a fast travel, a
load's landing) carries every boat by the frame's own move, then shows or
hides each for the new pixel, the helm not asked (`OnWorldReanchored`,
the port's own; the C# left each at the old frame's numbers).
Inside a dungeon a boat is drawn, lit and baked by the dungeon's own
frame (`host.drawModeMeshes`, `modeLights`, `extraBillboards`), and the
runtime's Update and LateUpdate and the pool's LateUpdate run in every mode.

### The console

Start's four boat commands (1082-1085), their strings verbatim:
`placeboat [hull] [variant]` (no argument: hull 0 and
`Random.Range(0, 7)`; `0` alone also rolls the variant; anything else
alone is variant 0; `Convert.ToInt32`'s exception leaves the command, as
it does in DFU), `printboats` (`i - hull at X, Y`), `identifyboat` (the
hit's root against each boat's) and `purgeboat [index]` (a negative index
is List's exception). `giveboat` makes a deed and waits for the items
(CSA-H).

### ComeSailAwaySaveData

The record is the C#'s, field for field (`worldCompensation`,
`placedBoats` with `UID`, `Hull`, `Variant`, `MapPixel`, `Position`,
`Direction`, `Items`, `lights`, `inside`; `placedMapMarkers`,
`currentBoat`, `TemporaryShip`, `sailPosition`, the two move vectors,
`windVector`, `packedCargoes`), vectors as `{x, y, z}` and items as the
port's save writes them. RestoreSaveData destroys what stands, stands
every boat again through the pixel overload with its height moved by the
vertical compensation's change since the save (the C#'s only
correction), deserialises its cargo and sets its lanterns; a field the
record lacks keeps the constructor's (FullSerializer fills a new
object). Start's first wind (`15 x Random.Range(-12, 12)` degrees off
forward) is rolled now, so the save's `windVector` is the mod's from the
first save on.

**Declared** (the Port-Ledger's Come Sail Away row): the placement ray is
the port's scene as its colliders stand - the flats', the loot's and the
fish's trigger boxes, the townsfolk and the other mods' bodies do not
answer it (dwFishRay's set, the player's own capsule masked out as the
Player layer is),
and the ground is walked, not a heightfield cast; SpawnBoat runs on what
the pool loaded for all five hulls at the world's mount, so a placement
asked before that is refused with a log line and a save loaded before it
is held - handed back whole by GetSaveData - until the first frame the
models are in, when its boats stand and OnLoad's visibility runs for
them; a convex collider is its mesh's exact hull.

## Sailing (CSA-D)

`systems/comeSailAway.js` takes the helm, statement for statement:
StartSailing, StopSailing and StopSailingDelayed's coroutine, Update's
sailing arm (4301-4768), LateUpdate's move (4936-4956), FixedUpdate's
riders (5053-5145), UpdateCurrentBoatNodes and CheckCollision
(3479-3622), UpdateBoatCargoMod (3820-3858), CanSail, IsBeached,
IsNodeOnWater and the two CanTurns, the properties (moveSpeed,
moveAccel, turnSpeed, turnAccel, wakeThreshold, HasInput, inputTarget),
ActivateRudder, BoardBoat and CheckBoatStatus, and the sailing arms of
OnStartLoad, OnPreFastTravel, OnPlayerDeath (the entity's OnDeath and
OnExhausted) and OnNewMagicRound. Unity's arithmetic is restated in its
floats: normalized under kEpsilon, `==` within kEpsilon squared,
ProjectOnPlane, the three MoveTowards, Clamp letting a NaN through,
Translate and Rotate in the boat's own space. What the C# runs in the
same methods and a later slice owns is named where it runs: the sails,
the wind, its widget, the trim and every Animator (the oars' RowZ, RowX
and RowSpeed, the rudder's TurnAngle, a door's Opened) are CSA-E's; the
wake, the bob, the flag and the current CSA-F's (FixedUpdate's current
is written only with the waves, so it is zero until then); the time
scale's keys and the sounds CSA-G's (ResetTimeScale is here - an index
nothing raises yet, or Unity's scale another mod set, back to one);
PackBoat, the cargo window, the variant picker and the ports CSA-H's;
the position reading and the water walk CSA-I's; OnUpdateSailing is
raised for the listeners CSA-J's message receiver hands it (Eye of the
Beholder's boat camera among them). CSA-E has since landed the sails,
the wind, its widget, the trim and every Animator, and CSA-F the waves,
the current, the wake, the bob and the flag (below).

### The helm

The helm's box (112400) takes the boat - through PlayerActivate's one
ray (the race below): "You control the boat!", the transport set to
foot, a crewed ship lent as the player's small one when they own none
(TemporaryShip), the player parented at the DrivePosition facing the
bow (SetFacing(0, 0) in the boat's frame), the boat's pixel theirs, the
cargo weighed, the nodes and the collision read, the idle crew swapped
for the active, the footsteps off. Each frame Update then stops the run,
keeps the transport on foot, stops a beached boat dead, walks
inputCurrent, pins the player at the DrivePosition and freezes the
motor (FreezeMotor 1, so it never runs out while the helm is held). The
oars: MoveForwards (or the autorun) rows ahead, MoveBackwards astern,
MoveRight and MoveLeft turn (reversed while backing), Run with a side
key strafes at half (a phone's stick presses no Run at the helm - the
throw's Run stands down there, `hooks.stickRuns`, so a full push turns: AUDIT
PRE-MERGE 0928 U3); a crewless boat's oars cost 11 fatigue each time
oarModeTime (1 s) runs out. TurnCurrent walks toward TurnTarget x
turnSpeed at turnAccel, MoveVectorCurrent toward MoveVectorTarget x
moveSpeed at moveAccel - the constants 2, 2, 1, 0.2, 20, 10, 10, 5
times the Handling dials, the cargo's mod and the hull's own modifiers.
LateUpdate reads the nodes and the collision again whenever the boat
moved or turned, and, not beached, translates it by velocityCurrent x
dt and turns it by TurnCurrent x dt in its own space, the player and
every rider carried with it.

The Disembark key or Transport (Actions 15) or the helm's box again
leaves it: the head at once ("You stop controlling the boat!", the
borrowed ship's scenes removed and the ship taken back, the vectors
zeroed, the crew back at rest, the footsteps on), the un-parenting at
the frame's end (SetHorizontalFacing along the world forward), then the
player held at the helm each frame's end until the motor's freeze runs
out - a second - when OnUpdateSailing(false) is raised. A death, an
exhaustion, a load's start and a fast travel leave it at once
(StopSailing: set down at the helm, the freeze lifted). A load's start also
ends a disembark still holding the player (StopSailing's tail - the freeze
lifted, OnUpdateSailing(false) once; DECLARED (39)), and a disembark whose
boat is gone ends at its next turn raising nothing, as Unity's destroyed
transform ends the coroutine (AUDIT PRE-MERGE 0928 S1). The lantern key
lights or douses the lanterns.

### The collision and the beach

CheckCollision sweeps the hull collider's half-beam (sharedMesh.bounds
.extents.x) from its world box's centre along the hull both ways, the
length between the ends' spheres; every collider met but the boat's
own, a Terrain and an entity gives the flat direction from it to the
boat. Their sum in the boat's frame, normalised, is the CollisionVector:
LateUpdate takes the bow's share of the motion off along it and adds it
back at one metre a second, so the boat backs off what it met, and a
turn that would swing it in is refused - TurnTarget flipped, and
TurnCurrent set to it at once. The nodes (CSA-C) decide the beach: more
than three off water is beached - stopped dead, no move - and CanSail
wants all five (the sails' arm, CSA-E's).

FIELD BUGS 2026-10-02 (Mac: "ships get stuck in the world of daggerfall
ocean rocks"; `01-Overview/Field-Bugs-2026-10-02.md`), as its audit left it
(FIELD BUGS 2026-10-02b, `01-Overview/Field-Bugs-2026-10-02b.md`):
- ROCK-FREE: the world host answers the sweep collider by collider
  (`player/collider.js` `hullSweepAll`) - a bucket's parts, each `addMesh`
  a MeshCollider, as World of Daggerfall's objects are, each answering
  once. The sphere itself is swept (`sweepSphereTriangle`: face, edges,
  corners), its first contact the exact one - nine rays had passed a rock
  smaller than their gaps. A part the sphere overlaps at the start answers
  once, at its nearest point to her centre (not the zero point - a
  departure), and the second sweep refuses it as it refuses the zero point;
  a STATIC part holding the sphere's centre answers nothing (Unity's sweep
  reads no back face) - a boat's collider never holds; nothing wholly under
  her KEEL LINE is met - her collider's box's foot under its centre, as she
  floats however the swell pitches her (the host had dropped an overlap
  "beneath" her, a rock awash beside her with it); her own colliders are not
  asked. An overlap straight under her sweep's centre has no side to push
  her from, and pushes nothing.
- ROCK-REACH (a departure): each sweep reaches her own end - the C#'s
  reached the whole length again past it, so a rock half a hull clear
  pushed her and refused her helm, and the push answered the sum: two
  clear astern and one clear ahead, and she sailed onto the one ahead.
- ROCK-AWAY (a departure): the response takes her way INTO what she met
  and no more - under way away from it she keeps her way, at rest or into
  it the C#'s push; the current is taken only carrying her onto it. A rock
  astern of a ship under sail had held her to a metre a second.
- BEACH-READ (a departure): a beached boat lying still has her nodes read
  again each frame (none where the player stands on no built terrain),
  her collision with them the frame she comes off - the C# reads them
  only when she moves, and a beached boat never moves.

### The cargo

UpdateBoatCargoMod weighs the cargo, and (by the Cargo switches) the
player - 120 a woman, 175 a man - what they carry, their cart's load, a
horse's 800 and a cart's 400, against Cargo.CargoThreshold times the
hull's Cargo modifier: the mod is 2 - weight / threshold clamped to one,
said once per weight ("The boat draws a little lower than usual" under
one, "You're going to need a bigger boat" under a half), and it scales
every speed and acceleration. It is weighed at the helm and every magic
round while sailing (the world host's ticker - a round indoors is the
mode's own clock and does not weigh it, DECLARED below).

### The riders

FixedUpdate casts down each live enemy's own height from its centre; a
grounded one over a boat's hull collider (the MeshCollider itself - not
a trigger, a mast or a door) rides that hull (SetParent(MeshObject)),
anything else sets it back. The port's foes carry no transform tree, so
a rider is carried by its hull's move - its centre by the rigid step, its
yaw by the turn - and its own walk stays in the world; a destroyed one
rides nothing. A load's start drops them all (the port's load rebuilds
its foes).

### The seven activations

PlayerActivate's one ray, raced with every other family (the one race,
`player/activationRace.js`, a `boat` family after Horse Cart and
Cargo's): the nearest of the boats' colliders is the hit, triggers
taken, unless the static world stands nearer. A box's name cut after
its first ']' is RegisterCustomActivation's lookup (`DaggerfallMesh
[ID=1124xx]`), within 3.2 it runs and beyond it nothing is said; the
hull or a mast is met and answers nothing, as in DFU. ActivateRudder
(112400): Steal mode packs a packable boat ("You cannot pack a boat you
are driving!" while driven; PackBoat is CSA-H's), any other mode takes
the helm or, at this boat's, leaves it - and at another boat's takes
that one without leaving the first (kept). BoardBoat (112401) stands the
player at the trigger's previous sibling (the BoardPosition), facing
its forward, and sets them on the ground within 3 m (AlignController
ToGround). CheckBoatStatus (112405): "Nice Boat!". The door (112403) answers since
CSA-E (its Animator's Opened turned over). The cargo (112402, CSA-H), the
variant (112404, CSA-H's ports) and the position (112406, CSA-I) are
raced and answer nothing yet. The street's plaque names a boat by its hull.

### The boat in the world's collider

Every active boat's switched-on, non-trigger colliders stand in the
mode's collider (the street's, a building's, a dungeon's) as buckets in
scene space: the player walks the deck and stands at the helm after
leaving it, a foe stands on it, and every ray and capsule meets it as it
meets a wall. A bucket stands again when its object's matrix moved past
half a millimetre - every frame the helm moves the boat, and on the
floating origin's shift; a hidden boat's are taken down. The placement
ray and the activation's skip them (they meet the boats' own colliders).

Seen live (scratch renders, 2026-09-27; `placeboat 1 0`, the Large Boat,
on the pond at Daggerfall's 207, 213, with Iliac Puddle No More off -
its height test reads a town pond as land): the helm taken through the
activation's own ray (box 112400 met at 1.5 m) - "You control the
boat!", the player at the DrivePosition facing the bow (north: the
placing ray's `transform.right`), frozen; D held turned the boat to 67
degrees in place, the player swung round its pivot and the view with
it, and let go TurnCurrent ran down from 20 while the boat coasted on
to 101; W rowed it 3.5 m along its heading, the player carried, until
the bow and three more nodes read land (tile 21) and the beach stopped
it dead (D held there builds TurnCurrent and turns nothing, a beached
boat does not move); the Disembark key left the helm - held there while
the freeze ran out, then stood on the boat's own collider 0.49 m up and
still there a second on; S walked them astern along the deck and off
the stern onto the pond's ground.

**Kept bug for bug** (the Port-Ledger's Come Sail Away row): the
Carrack's prefab has no Cargo modifier, so its threshold is nought - any
weight clamps its mod to 0 (it can neither row nor turn, and says it
needs a bigger boat) and no weight at all makes it NaN, which Unity's
transform refuses with its own complaint; the oars ask the node one
along - forward the centre's, back the bow's (the STERN's since ASTERN,
FIELD BUGS 2026-10-02, a departure: a bow on a shore could not back off
it), the right strafe the stern's, the left the starboard's, the port node
never; a right turn costs fatigue and a left one never; with no key held
the oars coast at the sails' 0.2; the first sweep keeps a start overlap's
zero point, a direction from the scene's origin (the world host answers
an overlap where it touches since ROCK-FREE, and each sweep reaches her own
end since ROCK-REACH, the C#'s twice that; the arm stands for any sweep
that answers zero); the borrowed ship is the small one
and the scenes taken back are the large one's (5, 5 and a building key
16777216); StopSailingDelayed's Update runs on after it, so the oars
pull again that frame and the vector is left behind until the next
helm.

**Declared**: the helm's two keys (above); the sweep is the port's scene
- the mode's buckets through `player/collider.js` sphereCastAll (the
nine-ray bundle `sphereCast` casts, one hit per bucket, so a pixel's
town counts once and the log names the bucket) and the ground asked
every half metre under the sphere's centre; the player under the boat is
carried by the boat's move (the port's player is no transform child),
the eye pinned with the body (both ends of the render span - MAC1's
step smoothing re-primed at the helm, the port's reading of
smoothFollowerLerpSpeed's 250), and the rendering path's switch has no
twin (one renderer); a rider is carried, not parented, and a foe's
isGrounded is its motor's resting read; FixedUpdate runs once a frame,
before Update, and WaitForEndOfFrame resumes at the next frame's pass
(the motor is frozen at the helm either way); a convex collider stands
in the walk as its mesh's own faces; a building's and a dungeon's ladder
take a boat's pick only when it is strictly nearer than their merged
list's, and their plaques name none; a save taken at the helm reloads
with its own look (the port lands the save's pose after the mod loop,
past StartSailing's SetFacing); a magic round indoors does not weigh
the cargo. Now ported beside it: SaveLoadManager's per-mod catch
(1524-1540) - a mod whose RestoreSaveData throws is said on the HUD
("Failed to load mod data for `<title>`. Check log for errors.") and
the load goes on.

## The sails and the wind (CSA-E)

### Unity's Animator

Every moving part of a boat is a Mecanim Animator the C# only asks -
CrossFade, SetBool, SetFloat, GetBool, GetFloat. `world/unityAnimator.js`
is that Animator over what the extraction tool carried (the five
compiled controllers, the 26 override controllers' clip swaps, the 141
clips' muscle curves), and each prefab instance gets one per Animator
component as it is instanced (`systems/comeSailAwayBoat.js`
importCustomGameobject - Unity's OnEnable). What it restates:

- a curve is a constant or streamed Hermite segments (at t the last
  segment starting at or before it: ((a dt + b) dt + c) dt + d), or dense
  samples; a clip is sampled at start + its normalized time times its
  length, wrapped when it loops and held at an end when not;
- a binding is the CRC32 of the transform's path from the Animator's node,
  one of position, rotation (a quaternion, or euler angles turned Z, then
  X, then Y) or scale; what no clip of the controller animates is left
  alone, and every state writes the default (the value at binding) of
  what it does not animate;
- the two blend trees the controllers use: Simple 1D by its parameter
  over its thresholds, and Simple Directional 2D by two (the rudder's
  RowX and RowZ over forward, back, centre, right and left) - the centre
  and the two directions bracketing the input, barycentric, the pair
  alone outside their triangle; the children on one normalized time, the
  tree as long as its children weighted;
- poses blend by weight, rotations summed on the first's hemisphere and
  normalised;
- one layer's state machine: the default state at nought when it first
  runs; each frame the time advanced by dt times the state's speed (and
  its speed parameter: the rudder's RowSpeed) over its length; the
  controller's transitions asked in order - every condition, and an exit
  time crossed that frame (below one, on every loop) - each fading over
  its duration (fixed seconds, or times the source's length);
- CrossFade: the named state faded to over its normalized duration times
  the current state's length, taken at the next update; a state already
  playing is left as it plays; a fade already running is frozen where it
  stood and the new state faded in over it;
- disabled (its node off, or the component) it stands still; enabled
  again it starts over (m_KeepAnimatorControllerStateOnDisable is false
  on every Animator here).

The Animators step once a frame at the head of the mod's LateUpdate
(after every Update, before every LateUpdate - where Unity steps them),
on Time.deltaTime. The sails' Animators blend their Stowed pose or their
Unstowed tree by Wind; the rudder's is Disembarked, Rowing (the oars) or
Sailing (the tiller or the wheel by TurnAngle), its Rowing and Sailing
joined by the controller's own transitions on its Sailing bool; a door's
is Closed or Opened. StartSailing fades the rudder to Rowing over one,
the two StopSailings to Disembarked; the oars' arm sets RowZ, RowX (the
input's walk) and RowSpeed (the speed over 20, held to 0.2-2), the sails'
arm TurnAngle; TriggerDoor (112403) turns the Opened of the door the
trigger hangs under.

### The wind

Start's wind stays (15 x Random.Range(-12, 12) degrees off forward, of
length one). UpdateWind rolls a new one - indoors none at all (both
vectors nought); outdoors a strength of Random.Range(1f, 2f), a tenth of
it in fog, half again in rain and twice in a storm, along right turned
toward the back by day and toward the front from 18:00 to 07:00 (the IL's
test is Hour <= 6 || Hour >= 18 - AUDIT PRE-MERGE 0928 C3), flipped
south of the map's row 250, then turned 15 x Random.Range(-4, 4)
degrees - on the hour (WorldTime.OnNewHour: the hour of the day asked
each frame), on a weather change (the weather coming) and on a
transition (which also puts the time scale back, without a word).
RotateWind walks the current toward it: at once and then at each frame's
end by a tenth of a radian a second (Vector3.RotateTowards, its length
by up to one a step), until the two are equal, and then raises
OnUpdateWind. The rain's and the snow's forces it sets on each step are
the particles' (CSA-F).

### The sails

GetSailPower sums each raised sail's pull by its kind and its angle to
the wind (the flat angle between the wind and the sail's forward): a
lateen from half along it to full at 135 and back to half at 165, nought
past, 15% less (x0.85) with the wind on its right; a gaff from
half to full at 135 and nought at 150, backing a quarter past; a
staysail from a fifth to four fifths at 135, nought at 150, backing a
quarter past; a square sail full before the wind, nought at 90, backing
twice past it; a small gaff a half, a small staysail three tenths and
any other small sail four tenths of that, a large one half again. The
sails' arm drives the boat forward by it times the wind's length (at
the sails' speed and acceleration) and turns it by the right and left
keys at the speed it makes times the rudder's modifier over ten (the
same refused turn as the oars').

The ToggleSail key raises them (refused while a node is off water:
"Unable to raise sail. Boat is obstructed.") or lowers them; with the
sails up, the square-sail assist off, the trim modifier held and a
lateen or a gaff aboard, it raises or lowers the square ones alone.
Raising leaves the square sails stowed with the wind more than 90 off the
bow when the assist is on; the rudder's Sailing follows the sails. Each
frame under sail: an obstructed boat lowers them and stops; each sail's
Wind walks toward its pull (by one a second: the wind's length signed by
the side it fills, a staysail's own pull) and a sail luffing head to wind
(past 150, or 165 for a lateen) flaps on a sine of the clock, each by its
place in the list; with the assist on the square sails stow and rise as
the wind goes more or less than 90 off the bow. Leaving the helm lowers
raised sails; a save taken with them up raises them as it loads.

### The trim

With the auto trim on (SailingAssist.AutoTrimming) each boom turns at 100
degrees a second toward the wind: a square one to the wind's angle off
the bow held to 45, a lateen and a gaff to the side it blows from (90
running, 45 on a beam reach, easing to nought as the wind comes ahead -
150 for a gaff, 165 for a lateen), a boat with a large square
sail and a gaff held to 30, a stowed sail's boom home, a gaff swinging
out at 300. Off, the brackets turn the fore-and-aft booms 15 degrees a
second to 90 either way, and with the modifier (or on a boat with
neither lateen nor gaff) the square ones to 45, every boom set to its
angle each frame.

### The widget

At the helm, unpaused, the wind's direction off the player's forward is
drawn as one of the mod's 24 pictures (fifteen degrees apart, the
`112395_1-*` it imports at Start), centred at WindDirectionWidget.Position
of the screen, lifted by the large HUD's height when it rides above the
horse, sized by the picture, the screen's scale (none, the height's, or
both of a 320x200) and its own Scale, tinted its Color - over the HUD, as
GUI.depth -1 draws it over DFU's, in the street, a building and a
dungeon. The debug values OnGUI prints beside it are CSA-I's, with the
rest of OnGUI.

### The keys

The sails' key is End and the trim's the mod's own brackets and
backslash (registry actions BoatToggleSail, BoatTrimRight, BoatTrimLeft,
BoatTrimModifier; `10-UI/Controls.md`): the mod's Space is Jump's. The
time keys are CSA-G's.

Seen live (scratch renders, 2026-09-27; `?shot` probes with Iliac Puddle
No More off): on the town pond at Daggerfall's 207, 213 the sails' key was
refused as the C# refuses it - two of the skiff's five nodes read land
("Unable to raise sail. Boat is obstructed."); on open sea at 208, 215 (a
probe hook, `__csaOpenWater`, finds a water tile three tiles clear all
round) all five read water, and End raised the Large Boat's lateen (its
Animator faded Stowed to Unstowed, the rudder's Sailing set) - the wind,
rolled since the boot and turning toward its target, filled it from
abaft the beam, its Wind walked to the wind's length on the lee side,
and the boat made 1.96 m/s, 6.7 m in a few seconds with the player
carried; End again stowed it and the boat coasted down; the widget's
arrow stood on its ring round the crosshair, stepping frame by frame (4
to 9) as the wind came round, its 24 pictures loaded at the first draw.

**Kept bug for bug**: every UpdateWind starts one more RotateWind, so two
running turn the wind twice as fast; GetSailPower takes the hull's angle to each
sail and drops it, and a lateen's backing arm can never be reached; the
load raises the sails before it restores the wind (the wind it loads
into decides the square sails), and never restores the target; an
obstructed frame lowers the sails and still reads their power; the
manual trim sets every boom each frame whether the sails are up or not.

**Declared** (the Port-Ledger's Come Sail Away row): the sails' key (End:
the mod's Space is Jump's); the Animator's readings of an engine the
port cannot open (CrossFade's duration against the source's length, a
state already playing left alone, a running fade frozen, the directional
blend's triangle, the blend's hemisphere sum, the euler order, the reset
on enable keeping the first binding's defaults, no animation events -
the oars' sounds are CSA-G's); the Animators stepped at the head of the
mod's LateUpdate; RotateTowards and SlerpUnclamped restated from their
documented behaviour; OnNewHour the hour of the day asked each frame (not
on the first) and OnWeatherChange the host's word changing (the port's
eighth, the sandstorm, is none of UpdateWind's three); the widget through
the renderer's screen quad over the port's HUD, its pictures the vendored
ones loaded at its first draw.

## The waves and the effects (CSA-F)

### The waves

Not the open sea's swell: a strip of breakers laid on the water along
every coast within Waves.Distance map pixels of the player
(`systems/comeSailAwayWaves.js` buildWaveMesh, UpdateWaveMesh past its
gate, 2797-3477). A map pixel is WATER when WOODS.WLD's height there is
2 or less (6 under World of Daggerfall's terrain, which the port does
not carry) and none of four rays dropped from 500 m over the vertical
compensation, a thousand long, at its quarter points (204.8 and 614.4
into it) meets anything more than a metre over the sea (`(int)WaterLevel
+ 1`, 35). Each water pixel then asks the same of its eight neighbours,
and every neighbour that is LAND gets a fan from the water pixel's inner
quarter out to the land pixel's centre (a side: five vertices, three
triangles), or the corner pieces between two (a diagonal: one wide piece
when both sides are land too, two when one is not, one small one when
neither is) - the C#'s four sides and their corners, transliterated
block for block, every vertex, uv and index in its order. The mesh is in
map pixel units round the player's own pixel; the object that carries
it stands at that pixel's centre (409.6, 409.6), a tenth of a metre over
the water and the compensation, 819.2 to a unit; Mesh.RecalculateNormals
(the sails' own, `world/skinnedBake.js`) gives every triangle up.

THE FRAME OF REFERENCE is DFU's floating origin, which the port keeps
(`world/streamingWorld.js`): after every recentre the player's own map
pixel has its corner at x = z = 0, so the C#'s absolute 204.8 and 614.4
and its object's 409.6 are the port's as they stand, and the ocean the
mod calls 34 is the port's 27.2 x 1.25.

UpdateWaveMesh clears the mesh first, then stops with the waves off, the
player inside or on their ship (TransportManager.IsOnShip); Animated
Water's vertex waves are CSA-J's. It runs on OnLoad, OnTransition and
OnPositionUpdate at once, and on OnTeleportToCoordinates a tenth of a
second of Time.time later (UpdateWaveMeshDelayed: a WaitForSeconds
coroutine, resumed after Update as Unity resumes them - the runtime's
second coroutine queue beside the end-of-frame one).

THE MATERIAL is the bundle's CurrentMaterial, which the extractor now
carries beside the prefabs' (`NAMED_MATERIALS`: the one material Start
loads by name): Daggerfall/Dither/Wave, the frame tiled ten times each
way, tinted (0.5, 0.75, 1), cut out below half its alpha. Its shader is
restated from the bundle's compiled GLSL (`render/comeSailAwayRender.js`
WAVE_FS): the raw v (the tiled one over ten) folded about a half, `1 -
x^2(3 - 2x)` of its span from _DitherStart to _DitherEnd (LoadSettings:
the Fade's share of half the Length, and half the Length) against the
8x8 Bayer threshold at the screen pixel - the texture's 64 red values
carried as the table they are (`BAYER_8X8`; the bundle's own rounding,
its ranks the Bayer order, pinned) - the cut, the tint, the light and
the world's fog (its FOG_LINEAR/EXP/EXP2 variants), opaque, its depth
written, back faces culled. Drawn with the world's cut-outs, after the
ground and before the sea's transparent top.

THE FRAMES are rebuilt, never shipped (CSA-A): each of the 32 is one of
the author's two paints scrolled down its rows, its key colour standing
for Daggerfall's snow (TEXTURE.303 record 1) tiled under it. The shader
composes the one texel a fragment samples - Unity's point sample with
Repeat, `composeTiledPicture`'s own integer arithmetic (pinned texel for
texel) - so the port uploads the two paints and the player's snow, not
32 frames of 640x640.

Update's frame step (4769-4799): the timer climbs by Time.deltaTime
until it reaches the frame time and the frame after it steps, forward by
day and back by night (six to eighteen), round the ends; the frame time
is `(2 - Speed / 100) * 0.125` with the integer division.

THE CURRENT (FixedUpdate, 5147-5198), written only with the waves on:
once any pixel in range was found water (UpdateWaveMesh's neighbours are
set there, a piece laid or not - CSA-J's audit corrected "once a mesh
was laid"), whichever quarter of the pixel the player stands in faces a
land neighbour pulls that axis to one (toward it), the wind's own
component elsewhere, normalized to half the wind's strength, reversed
where the pixel's own middle is land and again by night; before any, the
wind at half strength (nought over a dungeon block's water). OnUpdateCurrent when it changes (CSA-J's listeners). LateUpdate's
move carries the boat on it (CSA-D).

### Unity's particle system

`world/unityParticles.js` restates what the prefabs' Shuriken systems
switch on (their every module serialized in Models/prefabs.json): the
main module's duration, looping, lifetime, speed, size (per axis) and
rotation (per axis) at birth - a constant or a random between two - the
simulation space (Local: the particles ride the emitter; World: they
stay) and scaling mode Local (the object's own scale, not its parents',
scales what it emits: the wake's 10 and 20); emission over time and over
distance (the emitter's world movement from the step after Play), each
with its own accumulator, a frame's particles born at the fraction the
accumulator crossed a whole one, where the emitter then stood, and aged
the rest of the frame; bursts at their time in each loop; the Box (a
point in its volume, moving along the shape's +Z) and the Cone (a point
on its base disc, out along the cone) through the shape's own position,
rotation and scale - a direction the scale bends to nothing (a point
emitter's zero scale) keeps the shape's own axis; size over lifetime
(one curve or three, each an AnimationCurve evaluated by the port's one
home for it, `world/worldClock.js` evaluateCurve - the sun's curves' own;
the prefabs' 81 keys are unweighted, none stepped) and force over
lifetime (local or world); plane
collision (a transform's position and up, crossed within the particle's
radius - half its size - losing its lifetime by the loss fraction: all
of it here) firing the collision sub-emitters, whose bursts are born at
the point; Play and Stop reaching the children (withChildren) but never
a system that is a sub-emitter. The systems step at the head of the
mod's LateUpdate, after the Animators (PreLateUpdate's
ParticleSystemBeginUpdateAll); an inactive one stands still.

Drawn (`render/comeSailAwayRender.js`): the HorizontalBillboard quads
flat on the water, turned by each particle's rotation, no larger than
the renderer's maxParticleSize of the view's height; WakeMaterial
(Daggerfall/BillboardWaterMasked: the mod's splash, 112395_0-0, cut out
at half alpha, lit, depth written, back faces culled) with the waves;
Default-Particle (Legacy Particles/Alpha Blended Premultiply: `tex x
colour x colour.a` added over the frame, no depth, no fog, both faces)
after the sea's transparent top; the flag's Mesh particles - Unity's cube
sized per axis, turned by its system and its own 45 degrees -
FlagMaterial's orange, lit. A boat kept in a dungeon or a building
(CSA-C's) draws them in that mode's pass: the quads and the flag with its
hull (`drawModeMeshes`), the drops after the dungeon's water, or after
the room's last world draw (`csaDrawParticlesBlended`, before the first
screen quad).

### The effects

- **The wake** (Update 4737-4755): under way past the threshold with the
  fast loop silent, the wake plays and the loops crossfade to the fast
  one; slowed under it with the slow loop silent, the wake stops and the
  loops crossfade back. Every frame at the helm its particles' life is
  `speed x 0.2 / 2 x the wake's scale` (one to ten), their size `speed x
  0.2 / 2` (before the scale) and their drift a world force of a tenth of
  the current over the scale. StartSailing, both StopSailings and every
  SetBoatPositionAndDirection stop it.
- **The two loops' play state** (PlaySlow, PlayFast, FadeAudioSource,
  CrossfadeAudioSource and their coroutines, 6527-6600) land here because
  the wake reads them: each loop's AudioSource carries `isPlaying` and
  `volume`, set as the C# sets them; one `fading` coroutine for every
  boat, a crossfade dropped while one runs, a fade stopping the last. A
  placed boat plays its slow loop. What they sound is CSA-G's (the host's
  `audio` hook).
- **The rudder's drops** play at the helm and stop on leaving it: a Box
  of zero size shooting 100 m/s along the rudder effect's forward per
  metre it moves, each drop dying on the hull's helper Plane and firing a
  splash there. The oars' drops are built and carried; the oars' events
  that play them are CSA-G's.
- **OnPositionUpdateBoat** stops the wake, moves its living particles and
  every oar's splashes (its first sub-emitter's) by the offset, and at
  the helm under way plays the wake again.
- **The bob** (LateUpdate 4985-5031): every active boat, not beached, is
  rocked by the wind - Time.time plus its index over the time scale, the
  roll `sin(t x 0.5 x |wind|) x |wind|` plus the helm's lean into a turn
  (`-5 x` the turn's share, clamped to 30), the pitch `sin(t x |wind|) x
  |wind|` times modifierAnimation. Animated Water's arm is CSA-J's.
- **The flag**: its forward the wind less a tenth of the boat's way, its
  streamer's start speed half that vector's length - fifty cubes a
  second, half a second each, the pennant tapering as the size module's
  y falls from three to nought.
- **Rain and snow**: each RotateWind step sets the rain's
  ForceOverLifetime to a random between 10 and 50 times the wind (x and
  z) and the snow's between 5 and 25, handed to the host
  (`precipitationForce`).

Seen live (scratch renders, 2026-09-27; `?shot` probes with Iliac Puddle
No More off): at Daggerfall's 207, 213 no wave is laid - the city's
coastal pixels meet its slopes 48 to 220 m up at their quarter points,
so none of them is water to the rays; hopped a pixel at a time toward
the sea south-east, the world recentring on each hop, OnPositionUpdate
laid 84, 118, 152 and at 210, 218 236 vertices in 100 triangles, the
object over the player's pixel at (409.6, 34.1, 409.6) and the player's
feet on the sea at 34; looking down, the breakers lay on the water along
the coast, stippled out toward the land by the dither and tinted blue
over the snow, their frame stepping from one hop to the next. The
current read the last water pixel's neighbours (the kept bug). A skiff
spawned on open water there and rowed from the helm at its 2 m/s: each
second the runtime held the wake playing with two splashes alive (half
a particle a metre, each living two seconds at that speed), the loops
crossfaded to the fast one, the bow's spray and the rudder's drops and
splashes alive, the flag's 25 cubes, and the bob's turn changing; the
shots show the flag streaming orange at the masthead and the spray at
the waterline (the wake's own quads lie astern, under the hull from the
helm's eye).

**Kept bug for bug**: currentNeighbors is taken in every water pixel's
loop, so the current reads the LAST water pixel's neighbours (the
farthest east, then south), not the player's; the neighbour rays rise
from 500 over the world's origin while the first loop's rise from 500
over the compensation; an empty list returns before the loop, keeping
the last neighbours, and once any mesh was laid they are never cleared
(the current keeps reading them indoors); a boat's deck under a ray is
land to it; the fades set each volume before their clock steps, so they
end a step short of the volume they fade to; the bob's roll is not
scaled by modifierAnimation (the C#'s precedence); OnPositionUpdateBoat
carries the oars' splashes and not the rudder's.

**Declared** (the Port-Ledger's Come Sail Away row): Unity's particle
system restated from its documented behaviour - the draws the host's
(Math.random, as OH-C's miasma's), the curves sampled as the
AnimationCurves they are (Unity bakes them to polynomial segments), a
world force applied unscaled, the scale bending a direction and a zero
one keeping the shape's axis, rate over distance counted in any
simulation space; the waves and particles lit as the port lights its
flats (the ambient and the sun's Lambert term: no spherical harmonics,
vertex lights or screen-space shadow), the dither's phase the port's
screen pixel; the frames composed where the shader samples them; the
Bayer table carried as its 64 thresholds; the port's own soft dot for
Unity's Default-Particle picture; rain and snow keep the port's own
precipitation - its rain and snow are a shader volume
(`render/precipitation.js`), no particle system for a force to act on -
so the forces RotateWind sets are handed to a host hook the port leaves
unset; the hulls' water masks (WaterMask/Mask: colour alone, before any
opaque thing, no depth, back faces culled) are not drawn - flat outlines
at each hull's waterline, the sea or the hull always draws over them.

## Time, sounds and travel (CSA-G)

### The time scale

The helm's three keys (Update's sailing arm, 4757-4767, after the wake:
GetKeyDown each) are the registry's `BoatTimeScaleUp`, `BoatTimeScaleDown`
and `BoatTimeScaleReset` - the mod's keypad minus and enter, and, for its
keypad plus (Eye of the Beholder's AutoPerspective: one key, one action),
the keypad's star beside it (`10-UI/Controls.md`). IncreaseTimeScale
(6071-6082) refuses with enemies near - GameManager.AreEnemiesNearby(false,
false), the port's `areEnemiesNearby` over the mode's foes (WATER-FOES, below: never a foe in the water while aboard): "There are
enemies nearby..." for a second and a half - and else takes one step up
currentTimeScale's 1, 5, 10, 15, 30, to the fifth; DecreaseTimeScale one
step down, never below the first; ResetTimeScale (CSA-D's) the step, or a
Time.timeScale another mod set, back to one. SetTimeScale sets
Time.timeScale and its fixedDeltaTime - the port's one number
(`systems/timeScale.js`: the frame's dt and the motor's fixed step read
it; the boat's own Time.deltaTime is the frame's times it) - and says "Time
scale set to N." for `3 x N` seconds of game time: three real seconds.

The gates: at the helm, a step above the first with enemies near is said
and put back unsaid (4317-4321: ResetTimeScale(message: false)); Update,
the first frame after a pause, puts a Time.timeScale that is not one back
to one unless Travel Options' journey runs (4296-4299). Its answer is the
isTravelActive message, asked each LateUpdate after the pause gate
(4921-4934) - HCC's question (`travelOptionsActive`: null without the mod,
which leaves the flag as it was); `wasTravelling` follows it and nothing
reads it (kept). TRAVEL-X1 (2026-09-28, a departure): the reset asks it
again itself before it reads the flag (`latchTravelling`, LateUpdate's own
four lines) - a journey BEGUN in the pause (the travel map's Begin, its
resume) had had no unpaused LateUpdate to latch it, because the port's
click lands between frames where Unity's click frame runs its LateUpdate
first, and every journey begun from the map ran at x1 under a panel
saying x10. The beach's and the collision's resets and every event's
(the transitions, fast travel, the load, death) were CSA-D's.

THE HOST: the scale the helm sets runs everything the port runs on
Time.timeScale - the world's clock, the motor, the boat's move. The
frame's own law that a scale with no Travel Options panel behind it is a
journey over (TO1) now spares a scale the helm holds (`csaHoldsTimeScale`:
timeScaleIndex above the first step). Online the scale was Travel Options'
journey's case (TO-ONLINE): the shared clock takes nothing from dt
(`systems/worldTick.js`), so the helm sped the player's own world and
moved no room's clock - but WALK-CLOCK raised the character's own clock by
it, and the boat's speed went on the wire at the owner's scale.
HELM-TIME-ONLINE (below) retired the dial online.

### HELM-TIME-ONLINE (2026-10-04) - online the helm keeps the world's time

Mac: *"Remove the time dial from ships online."* Online (the host's
`sharedClockOn()`, the runtime's new `timeLocked` dep) the helm's time dial
is gone: the three keys - and the enhanced panel's and the pad's presses,
which ARE those keys (`BOAT_TIME_ACTIONS`) - say *"Online, time at sea
keeps the world's pace."* (`HELM_TIME_LOCKED_TEXT`, a second and a half)
and move nothing (`updateSailing` returns before the three key lines, which
stand byte for byte); `helmPanelState().timeDial` is false, so the
enhanced helm draws no `−` / `×N` / `+` (`ui/enhancedHelm.js helmButtons`),
the pad's left and right step nothing and, held, only trim
(`helmPadGesture`), and the prompt row says "Trim (hold)" or nothing
(`helmPadPrompts`). ResetTimeScale itself is untouched - it is how a
collision, a beaching, a stop, a fast travel or another mod's scale (a
journey's, RATE-LAW's x60/x100) is put back, none of them the dial. The
keys stay in the registry and in Controls (KB1: the list is never cut);
offline the dial is the mod's, as before. Pins: `test/csa_time_audio.test.js`
(HELM-TIME-ONLINE, 4 - AUDIT-A1: no key, no line, counted); `tools/mutants/helmtime.json` (10, all dead).

THE HUD'S TWO MESSAGE CLOCKS count game time, as DFU's do - a correction
the helm's messages showed: DaggerfallHUD.cs:262 and PopupText.cs:56-59
add Time.deltaTime, which the scale scales, where the port handed its HUD
the frame's real dt, so a message at a journey's or the helm's scale stood
its scale's times too long ("Time scale set to 30." for ninety seconds).
The two models take the frame's dt at Time.timeScale (`ui/midScreenText.js`,
`ui/hudText.js`).

### The oars' events

Unity's AnimationEvents, restated in `world/unityAnimator.js`: a clip's
events fire as its time passes them - each playing leaf of the current
state and, in a transition, of the state fading in, while its weight in
its blend tree is above nought; once for every loop the frame's normalized
time crossed, after the time it stood at and up to the time it reached (a
state entered from its start fires its time-0 events too; a clip that does
not loop fires its own once); each to every component on the Animator's
node with a method of its name (SendMessage), dropped when none answers.
The rudder's RudderAnimationEventListener (GetBoatTransforms, 1748)
answers OarEvent_In, OarEvent_Sweep and OarEvent_Out into the runtime
(6603-6685): at the helm only; every oar's splash system played after its
start delay (In 0.4 s, Sweep none, Out a tenth - MainModule.startDelay,
which `world/unityParticles.js` now waits out on a fresh Play; a Play while
the system still plays, its five seconds not out, starts nothing, as
Unity's); and at the first time scale the rudder's own AudioSource plays
the stroke's clip (Oars_In, Oars_Sweep, Oars_Out).

The Rowboat rows its 1-second stroke (Sweep at a sixth, Out at a third, In
at thirteen fifteenths), the Large Galley the trireme's 2-second one (In
at its start, Sweep at a quarter, Out at five eighths); only the Galley's
rudder carries an AudioSource (volume 1, pitch 1.5, spatial blend 0.9,
logarithmic from 1 to 500), so only its strokes are heard - every other
rudder's GetComponent<AudioSource> is null (kept).

### The sounds

The five clips Start loads (1022-1029) - SmallShipAmbience and
ShipExteriorAmbience2, the slow and the fast loop, and the three strokes -
are decoded from the vendored Oggs onto the audio engine's register as the
world mounts.

THE TWO LOOPS (BoatSFXSlow and BoatSFXFast: plain AudioSources at the
boat's root, looping, fully spatial, their minDistance the hull
collider's depth over four and their maxDistance twice that, Unity's
logarithmic rolloff): each is a looping positional source the host starts
from the clip's start at every Play from silence (the runtime counts them; HELM-HUSH, FIELD BUGS 2026-10-02 - a
Play on a source already playing goes on where it is, a Ledger A departure: every crossfade played the loop it fades
out, and taking the helm under way cut the boat's sound back to its first sample), its volume
the AudioSource's as CSA-F's fades set it, its rolloff Unity's own worked
out each frame over the ears' distance - full inside minDistance,
minDistance over the distance past it, and no quieter past maxDistance,
where Unity's (FMOD's inverse) rolloff stops attenuating: a boat's loops
are heard at half their volume however far off while it is active (kept)
- with the panner only placing it (`systems/audio.js` logarithmicRolloff;
the loops' handle a live volume). They live as Unity's do: an AudioSource
stops as its object goes inactive, and one left at AddComponent's
playOnAwake (true: SpawnBoat never clears it) plays again from its start
as its object comes back - so a boat back in view plays both loops, each
at the volume it last had, the fast one's its first (1) if it never faded
(kept). UpdateAudioSource (1904-1920) runs on a change of the mod's Audio
section (LoadSettings 846-850; the host asks each frame, `checkSettings`,
seeded at Start): each loop still heard takes SoundVolume times the new
volume, one faded to nothing stays there.

DFU'S CLIPS: raising and lowering the sails play SoundClips 380 and 381
from BoatSFXOneShot's DaggerfallAudioSource (PlayOneShot, fully spatial,
at SoundVolume times the mod's volume - which PlayOneShotWhenReady
multiplies by SoundVolume again: the square of it, kept); TriggerDoor
plays 94 opening a shut door and 93 closing an open one, at the trigger,
at one (PlayClipAtPoint).

THE BUS: the port's one bus carries SoundVolume (`systems/audio.js`
`_out`), the multiply DaggerfallAudioSource makes at every play - so a DFU
play hands its volumeScale over as it stands, and a plain Unity
AudioSource, which never reads the setting (the loops, the Galley's
strokes), hands its own volume over with SoundVolume divided out
(`plainSourceGain`); a bus at nought is the one level it cannot give back.

### The bed

The boat's bed is model 41000 (GetBoatTransforms'
CreateDaggerfallMeshGameObject, its MeshCollider over it), so Roleplay
Realism's BedActivation answers it as DFU's PlayerActivate would: the
hit's name cut after its first ']' is one of the three models RR
registers (41000-41002, RoleplayRealism.cs:124-129, at
DefaultActivationDistance) and none of this mod's seven. With RR's bed
sleeping on, the boat pick marks a hit on it (`csaBoat:<id>:bed`, its
reach 3.2, silent past it as every custom activation is) and its arm
opens the mode's own rest door - BedActivation's gate (487-525):
DaggerfallUI's less its GiveOffer rung, so a bed clicked leaves a pending
`give pc` offer where the R key hands it over (CSA-J's audit found the
port asking it) - then the Rest window told the bed is the
one clicked (`ignoreAllocatedBed`, which only a tavern's allocated bed
reads): `toggleRest` outdoors, `restFromBed` in a building or a dungeon.
Only the Small Ship and the Large Galley carry a bed: the other three
hulls' BedObject is inactive in their prefabs, and GetBoatTransforms
passes an inactive child by.

**Seen live** (scratch probes, the sea south-east of Daggerfall at
midday): the five clips decoded onto the register and the context
running; a placed boat's slow loop on its channel at the mod's 0.225. A
Rowboat rowed: its listener heard In, Sweep and Out through each stroke
(five of each over 240 frames), both oars' splashes alive, the loops
crossfaded to the fast one. At a Large Galley's helm, with no foe near,
the keypad's star stepped Time.timeScale to 5, 10 and 15, each "Time
scale set to N." on the mid-screen label, minus stepped it back to 10
and enter to 1; rowed, its oars' events ran and its loops crossfaded as
the skiff's. A first run found Survival's hunt opening its window at the
raised scale (game minutes running ten times as fast), and the helm held
under it as a DFU window holds a scene. Left, the Galley's bed under the
pick was `csaBoat:1:bed` (0.88 m) and its click opened the Rest window
on the deck. On the way the probe's first crewed boat found CSA-D's ship
seam reading the raw scene cache (a fresh character has none until its
first scene: AssignShipToPlayer's permanent scenes threw and left
StartSailing half run); it goes through the lazy cache now.

**Kept bug for bug**: only the Galley's strokes are heard; a boat's loops
never fall below half their volume past maxDistance; a boat back in view
plays both loops again, the fast one at 1 if it never faded; the sails'
clips at SoundVolume squared; a blend tree's clips each fire their events
(a diagonal stroke sounds both); the oars' splash Played within its five
seconds starts nothing (Unity's); wasTravelling read nowhere.

**Declared** (the Port-Ledger's Come Sail Away row): the time scale's step
up on the keypad's star (the mod's plus is Eye of the Beholder's - for
Mac's read); Unity's AnimationEvents read, not opened (a clip in a blend
tree fires while weighed above nought, a state entered from its start
fires its time-0 events, both states in a transition, events dropped when
nothing answers); the Galley's spatial blend of 0.9 played fully
positional, and the one-shots' logarithmic rolloff by the panner's inverse
model, which does not stop at maxDistance 500; a bus at nought silences
the plain sources DFU would still sound.

## Items, shelves and cargo (CSA-H)

### The two items

Start registers two classes (1079-1080: RegisterCustomItem(index,
UselessItems2, type)) - ItemBoatParts, 1320, and ItemBoatDeed, 1321 -
over the bundle's two template rows: "Parts of" (120 kg, 4,000 gold) and
"Deed to" (half a kilogram, 6,000), both rarity 1. The rows ride
`systems/comeSailAwayItems.js` field for field (the vendored file keeps
the author's trailing comma, which DFU's parser takes and a strict one
does not), registered at import as Iliac Puddle No More's fish are.
Neither class stacks (the port's rule already answers false for a plain
UselessItems2 row) and each saves under its own class name (the port's
save copies the record whole). Every writer names an item the one way -
the row's name, the hull's, and the variant's numeral in quotes ("Deed
to Large Galley 'III'") - and writes its message as hull x 10 + variant.

A UID OF THEIR OWN. DFU gives every item one at construction
(DaggerfallUnity.NextUID) and the mod keys two things off it: the boat a
deed stands for (GetPlacedBoatWithUID) and the cargo a packed boat
carries (PackedCargoes). The port's items carry none, so the mod's two
are minted with one - the host's clock in milliseconds times a thousand
and a count, unique across sessions and within one - at each door that
makes one: PackBoat's parts, `giveboat`'s deed, and the shelf's two
before AssignVariantsToShopItems rewrites them (`mintShelfBoatUids`, as
DFU's took theirs at construction, before OnLootSpawned); an item that has
one keeps it (DECLARED).

THEIR USE. DFU asks an item's own UseItem first. ItemBoatParts refuses in
a dry interior (inside with blockWaterLevel at 10000), else closes the
inventory and starts placing. ItemBoatDeed refuses indoors, closes the
inventory, and then wants a port within range unless the boat it placed
stands on this pixel - "There is no port nearby or ship is in another
location" for a boat elsewhere, "There is no port nearby" for a deed
with no boat - before it places (or repositions) its boat. The port's
items have no class, so each UseItem is a delegate on the item-use door
(`itemTemplates.js` registerItemUseHandler): the same place for these
rows, which no quest and no other delegate touches, the class's
CloseWindow carried on the use's result (DECLARED); a use that closed
nothing and placed nothing falls to the ladder's silent end, as DFU's
NextVariant does for them. Both deeds' and parts' log line is "COME SAIL
AWAY - USING BOAT PARTS!" (kept).

### The shelves

RegisterCustomItem's group puts both on DFU's shelves: the second loop
of StockShopShelf (DaggerfallLoot.cs:255-287) walks every custom row of
a group the shop sells, rarity at or under the quality and
chanceMod x 5 x (21 - rarity) / 100 to stock it - for these, rarity 1,
a General Store's UselessItems2 chance of 50 in a hundred each, a Pawn
Shop's 20. The port's shelf already walks `customItemsForGroup`, which
knew Roleplay Realism: Items' rows alone; it is one table across the
loaded mods now (`rriItems.js` registerCustomItemGroup, as DFU's
customItemGroups is), each row answering while its mod is loaded for the
game - the load-time answer, never the switch as it stands now (AUDIT
PRE-MERGE 0928 S4: a mod switched on mid-game had stocked bare "Parts of"
rows).

FOUND ON THE WAY: Iliac Puddle No More's DeepWaters.Init registers each
fish's row into the same group (a null class) - so DFU's shelf stocks
fish at their rarity 20, in a quality-20 shop selling UselessItems2, at
chanceMod x 5 / 100 each. The port had never put them on that table; they
are on it now, while that mod is loaded for the world (its latch, S4).

AssignVariantsToShopItems (6692-6717), PlayerActivate.OnLootSpawned's
subscriber (6687), rewrites what the shelf stocked: every deed a hull of
Random.Range(1, 4) - a Large Boat, a Small Ship or a Large Galley, never
a Rowboat or a Carrack (kept) - variant I, priced as the hull; every
parts a Rowboat 'I', priced and weighed as one (kept: a shelf never sells
another hull's parts). The port runs it after Roleplay Realism's shelf
subscribers at both of the shelf's doors (`worldModes.js`, the order the
two mods subscribe in); DFU's house containers raise the same event but
stock classic rows only, so a boat item never stands in one.

### Packing and the cargo

The item a use hands the runtime is spent from the pack or the wagon AS IT
STANDS - by its UID, through the host's getters - as DFU's RemoveItem
spends from the one ItemCollection a load deserializes into (AUDIT
PRE-MERGE 0928 S2: a load while placing had left the parts in the loaded
pack, and one parts item made two boats).

PackBoat (6130-6158): the boat's parts to the back of the pack - its
message, its hull's price and weight, its name - with "You store the
boat in your inventory"; a cargo aboard moves whole into PackedCargoes
under the parts' UID (Dictionary.Add: a UID already there throws) and its
weight onto the parts'. Then the boat is gone: its pixel nulled, its
object destroyed, its record off the list. Steal mode at the rudder packs
a packable boat not driven (the Rowboat and the Large Boat; CSA-D's
refusal "You cannot pack a boat you are driving!" stands), and fast
travel packs a packable boat sailed (CSA-D's OnPreFastTravel); placing
parts brings their cargo aboard again (CSA-C's arm). SHIP-PACK (below):
every hull packs now - a ship with her deed in the pack - and the parts
keep the boat's UID, her worth and a carried weight.

LOST-BOAT (the port's own, FIELD BUGS 2026-09-29h; Julian: "the large boats
floating underneath the town ... very loud boat noises but no boats to be
seen"): a boat FIELD-CSA1's four ways lost before that fix is in its owner's
save where it stood, and the restore stands it there verbatim. Update asks
each boat ONCE, when the ground under it is built (`recoverLostBoats`): a hull
whose place is `LOST_UNDER_M` (2 m) under the ground or under the sea's top
is lost, and an uncrewed one (the Rowboat, the Large Boat - their deed spent
on placing) goes through PackBoat into its parts, with "A boat of yours was
lost where no one could reach it". A crewed hull is left for its deed to call
to a port; never indoors, never a boat placed inside, never the one sailed.
Port-Ledger A.

The cargo box (OpenBoatCargo, 5575-5587) opens the boat's own
DaggerfallLoot as the inventory's loot target (OpenCargo, 6521-6525:
LootTarget, then dfuiOpenInventoryWindow) in whichever slot the mode
draws (the street's, a building's, a dungeon's: `worldModes.js`
mountWindow). The loot target is the pack's own shape
(`cargoLootTarget`): its items read live - the list the pack takes from
and stows into, the one the helm weighs - its picture the Merchant's
(InventoryContainerImages 6), the player's own; its TextureArchive is
nought, so the pack's drop-icon arms stand down, as DFU's do. A box on no
boat of the runtime's throws in OpenCargo (kept: the box is always a
boat's).

### Variants and ports

PickVariant (5491-5506): never at the helm. OpenBoatVariantPicker
(1310-1334) refuses a boat without variants ("This boat has no
variants") or without a port nearby ("There is no port nearby"), else
pushes a DaggerfallListPickerWindow with one row per variant, by its
number; a pick plays SoundClips 360, pops the picker and SetBoatVariant
(the pool's own context, `scenes/comeSailAwayPool.js` setVariant: a
reinitialize instances nothing).

IsNearPort (1095-1117) walks a square centred on the player's pixel -
range pixels every way, so the default 3 searches 7 x 7 - and a location
there answers when it is a harbour the map draws (Travel Options' list,
`systems/travelPorts.js`, 378) or its Exterior.ExteriorData.PortTownAndUnknown
is not nought (ContentReader.HasLocation and GetLocation: the host's map
dictionary and its location). PortLocationSearchRange is read live. A
refusal of the deed or the variant box names the nearest of those
harbours and the way to it ("There is no port nearby. The nearest port is
Daggerfall, to the north-west"); a host that names none says the mod's
own line.

DEED-PORT (the port's own, FIELD BUGS 2026-09-29h; Swordsman: "no matter
where I try and put it, it tells me I'm not near a port"; Mac: "Dont
worry abour DFU."): the C#'s loops ran from X - range while below
X + range - 1 - three pixels west and north at the default, one east and
south, and a range of 1 never asked the player's own pixel - over the
byte alone, which 35 of the map's 378 harbours do not carry; a refusal
said nothing of where to go. `test/fb0929h_deedport.test.js` (3).

### The console

GiveMeBoat, the first command Start registers (1081): `giveboat` with no
argument a hull of Random.Range(0, 4) (never the Carrack: kept), the
Large Boat a variant of Range(0, 7); with one, that hull (a Large Boat
still drawing its variant); with two, both; with more, a Rowboat 'I'
(no arm takes three: kept) - the deed named and to the back of the pack,
"Boat deed added to player's inventory". A hull or a variant past the
tables throws, as `hullNames[num]` does.

DrawBox (6719-6808), the file's last method, is called nowhere, and its
Debug.DrawLine draws only in the Editor's scene view: nothing of it to
port.

**Seen live** (scratch probes, midday, the sea south-east of Daggerfall
and the city's own pixel): `giveboat 2 0` put "Deed to Small Ship 'I'"
(message 20, the row's 6,000) at the back of the pack with a UID of its
own. On the sea a range of 3 found no port and a range of 10 found one:
the deed used there closed the pack and said "There is no port nearby",
and at 10 it started placing ("Place the boat in water"). Steal mode at a
Large Boat's rudder packed it - "Parts of Large Boat 'I'" at 8,000 and
120 kg, its own UID, the boat gone - and those parts' use closed the pack
and started placing. In the city (a port within 3) the cargo box opened
the pack on the boat's hold ("LOOT 0 ITEMS · 0.00 KG Empty.") and Escape
put it away; the variant box pushed the list picker - rows 0 to 6, the
Large Boat's seven - and row 3 made the boat variant 3 and popped the
picker. Two hundred General Store shelves at quality 20 stocked 105 parts
and 101 deeds (at quality 1, 100 and 101; a Pawn Shop's 37 and 32), each
with a UID, no two alike - a deed a Small Ship 'I' at the hull's 100,000,
parts a Rowboat 'I' at 4,000 and 30 kg - and with Iliac Puddle No More on,
28 fish besides. On the way the probes found the cargo box handing the
pack its hold as a list, where the pack reads a loot target's items
through a getter: the enhanced pack could not mount ("deps.loot.items is
not a function") and held the slot, so the picker never showed. The loot
target is the pack's own shape now (`cargoLootTarget`, tested through
the pack's own remoteTarget), and the picker draws over the world, as
DaggerfallPopupWindow's clear ScreenDimColor leaves it.

**Kept bug for bug**: a shelf's deed never a Rowboat or
a Carrack, its parts always a Rowboat 'I'; giveboat's Range(0, 4) never
a Carrack, its Large Boat's variant drawn even when a hull is given, and
no arm for three arguments; the deed's log line the parts'; the deed
closing the inventory before its refusals; OpenCargo on no boat throws.

**Declared** (the Port-Ledger's Come Sail Away row): the mod's two items
carry a UID of their own, minted off the clock (the shelf's two
included); the two classes' UseItem
run as delegates on the item-use door, the CloseWindow carried on the
result.

## The position reading and the water walk (CSA-I)

### The position box

CheckBoatPosition (5525-5541), the seventh activation (112406, on the
Small Ship alone: the other hulls carry no PositionTrigger), starts the
reading for the boat the box hangs under - one at a time
(StartShowBoatPosition 5589-5596: another box waits until the running
coroutine has ended, a second of game time after the map closes: kept).
ShowBoatPositionCoroutine (5598-5679) runs a frame's end at a time
(`startCoroutine`, WaitForEndOfFrame): "According to my instruments...",
and a wait while a message box is the top window (`TopWindow is
DaggerfallMessageBox`: the mode slot's occupant, `worldModes.js`
topWindow, an ActionTextBox); then the reading, got while the weather is
Sunny or Cloudy and the hour 11, 12, 23 or 0 - each restriction only on
its setting (Map/RestrictPositionReadingWeather, ...Time) - else
"...no good. I can't get a reading at this time." and its wait, and the
map up anyway, with no cross on it (kept); then the map, and every frame
until it is put away: the game paused when it is not, the number row's 1
to 8 picking the marker colour, the left button placing a marker, the
right removing one, Escape's release unpausing and putting the map away.
The boat itself is never read (the player's own pixel is: kept).

THE PAUSE IS A WINDOW. PauseGame(true, true) stops the clock and disables
the HUD with no window pushed, and the map is OnGUI's; the port pauses only
through its window stack, so the map's pause is a native window in the
mode's slot - the world held and the HUD taken away outright (the window's
hidesHud - the large HUD too, in the street, a building and a dungeon: AUDIT
PRE-MERGE 0928 U8), every key handed to it and the key-ups of the keys it took
(JAN1's law - the Escape that put the instruments' box away on its press is not
the map's: AUDIT PRE-MERGE 0928 U1) (a slot gives a native window the
raw codes: the street's, a building's and a dungeon's alike), the mouse
read off the host's own edges and position - and the window's draw is
OnGUI's map, the slot's last (DECLARED). InputManager's reads are the
host's: GetKeyDown and GetKeyUp the frame's edges (the window's keys
rotated where the host rotates its own), GetKey the held keys, and
MousePosition the pointer in the canvas's pixels, y from the bottom.

### The markers

LeftClickOnMap (5706-5736) marks the pixel under the mouse unless a
marker stands there (IsPositionMarked, 5681-5693), labelled with it and
the day - "(100, 50) - 5th of Morning Star" (DayOfMonthWithSuffix,
MonthName) - in the colour picked: Unity's Color.yellow, green, cyan,
blue, magenta, red, white and gray, named Yellow to Gray. RightClickOnMap
(5738-5776) removes the nearest marker within Map/ClickRangeThreshold,
walked from the last (of two as near, the later goes: kept). Both log the
pixel. A marker's position is the screen pixel's offset off the map's
corner, not the picture's texel (kept: only an unscaled map, ScalingMode
0, puts the two together). AddMapMarker (CSA-C's) and the save carry them.

### OnGUI's map

OnGUI (4113-4163) while the map is up, in order: the backdrop over the
whole screen, black at Map/BackdropOpacity; the picture stretched over
its rect; while a reading was got and Sin(Time.unscaledTime x 5) is above
nought, the red cross on the player's pixel, each line
Map/PositionLineThickness thick either side; the five help lines from the
screen's corner, 20 pixels apart, and "Current marker color is Cyan" 20
up from its foot, DaggerfallFont.DrawText at scale 3 in DFU's text yellow
with a black shadow three pixels off; every marker, its black outline
(Map/MarkerOutlineThickness) first; then the label of each marker within
the click range of the pixel under the mouse, ten right and twenty up of
it. Holding Left Shift zeroes the line, marker and outline thicknesses
(the three Finals, 670-705) - the label's place keeps the raw thickness
(kept). The rect is `screenRect.width x screenScaleX / 2 - map / 2`: the
screen's width scaled before it is halved, so at ScalingMode 1 or 2 the
map stands off the screen - at 1920x1080 from x 2484 at ScalingMode 1
(a scale of 5.4), 2760 at 2 (6) (kept). The
arithmetic is `systems/comeSailAwayMap.js` (mapOverlayDraws), drawn by
the host (`drawScreenQuad`, and `ui/text.js` drawText for DrawText's two
passes, the shadow first).

THE PICTURE is record 3 of the mod's archive - Daggerfall's travel map,
never carried (CSA-A): rebuilt at the first draw from the player's own
TRAV0I00.IMG, its 320x160 interior from row 12 down, nearest at each
texel's centre to 1000x500. That is the sampler the bundle's picture
matches best - a mean |RGB| of 7.3 of 765 a pixel, the rest the bundle's
DXT1 blocks (bilinear stands at 19.2) - drawn point filtered, as the
bundle's is (DECLARED: the DXT1 blocks are not remade). THE LINES are
lineTexture, TextureReader.GetTexture2D(0, 112, 0, 0): TEXTURE.000's
solid record 112, palette 112's 220,220,220, read from the player's file;
GUI.DrawTexture multiplies it by each colour, so every red line and
marker is its colour times that grey (kept).

OnGUI's debug values (4177-4182) draw with the wind widget, under its own
gate: at the helm, unpaused and not loading, with Debug/ShowValues on -
the boat's speed, the speed it makes for and the wind's strength, as
Mono's Single.ToString() prints them (seven significant digits,
`csFloatString`), at scale 5 in red, green and blue, from the screen's
corner, 500 right and 50 down.

### The water walk

LateUpdate (4963-4982) asks each active boat whether the player stands in
its hull collider's box - the mesh's own bounds, the player taken into
the hull's space before this frame's bob - with the height the box's
centre's when Iliac Puddle No More is not loaded (the box a column: a
player on deck, or above it, is in), and after the boats (5044-5051) the
walk started or ended on the answer. StartWaterwalking (5966-6011): with
an effect manager and no live bundle of its name, "I'm On A Boat" - a
Spell of one WaterWalkingSilent on the caster alone, DurationBase 90,000,
DurationPlus 0, DurationPerLevel 1 - assigned past the saving throws
(AssignBundleFlags 2). EndWaterwalking (6013-6029): the first live bundle
named "I'm On A Boat" or "Jesus Mode" removed; a water walk any other
bundle gives (a spell's) is left, and the removal asked for again every
frame it lasts off a boat (kept).

WaterWalkingSilent (WaterWalkingSilent.cs) is an incumbent of its own kind
(IsLikeKind: itself alone, so it never stacks onto the spell's Water
Walking) that raises IsWaterWalking and shows no icon: on the port's flat
effect list it is its own kind, `waterWalkingSilent`, pushed with its
first round and stamped as a bundle the way a cast is (`effects.js`
assignModBundle; RemoveBundle `removeBundleNamed`), a no-icon kind of
`liveBundles`; and IsWaterWalking is read one way at every door that
derived it (`isEntityWaterWalking`: the motor's flags, the dungeon's two
reads). Iliac Puddle No More's swim already stands down on the bundle's
name (`world/deepWaterSwim.js` isBoatEffectBundle).

**Seen live** (a scratch probe in Daggerfall, sunny, midday, 800x450):
the Small Ship's position box at 1.5 put up "According to my
instruments..."; Enter closed it, and the map came up in the slot, a
reading got - Daggerfall's travel map rebuilt from the player's
TRAV0I00.IMG under the five help lines and "Current marker color is
Yellow", the red cross blinking over the player's pixel (207, 213). The
number row's 3 made the colour Cyan; a click placed "(550, 280) - 4th of
Morning Star", its label up and to the right while the mouse stood near
it; a right click beside it took it off; another click placed (460,
230); Escape's release put the map away and the world ran on. On the
ship's deck the water walk came on ("I'm On A Boat", no icon, the motor's
flag raised) and went off away from it; at the helm, with Debug/
ShowValues on, the speed, the speed made for and the wind's strength
(1.995678) printed in red, green and blue over the HUD.

**Kept bug for bug**: the map off the screen at ScalingMode 1 or 2 (the
width scaled twice); a marker placed at the screen's offset, not the
picture's; the label's place on the raw thickness; a second reading
refused for a second of game time after the map closes; the boat never
read; the no-good box still opening the map; of two markers as near, the
later removed; the lines and markers tinted by TEXTURE.000's grey;
EndWaterwalking asked every frame a spell's water walk lasts off a boat,
and "Jesus Mode" taken off with the boat's.

**Declared** (the Port-Ledger's Come Sail Away row): the position
reading's pause a window in the mode's slot, its keys handed to it and
its draw OnGUI's map (the map shows from the frame the window mounts, one
after mapShowing, and a window pushed over it draws over it, where
OnGUI's depth -1 would not); the map's picture rebuilt from the player's
TRAV0I00.IMG without the bundle's DXT1 blocks.

## The close (CSA-J)

### The message receiver

`MessageReceiver(message, data, callBack)` (1833-1890, registered in
Awake at 918; `systems/comeSailAway.js`, on the runtime) restated whole,
its ten messages in the C#'s switch: GetWind and GetCurrent answer the two
vectors as copies (a Vector3 is passed by value); OnUpdateWind,
OnUpdateCurrent and OnUpdateSailing subscribe `data as Action` - a
function, or nothing at all; ResetTimeScale; StopSailing is
StopSailingDelayed, the Disembark key's delayed stop; IsPlayerSailing;
GetBoatGameObject and GetBoatMeshObject answer CurrentBoat's two objects
to a callback. An unknown message is logged as an error in Unity's name
for the component (`MOD_OBJECT_NAME`). Every event raises its listeners
with a copy of the vector, and RunOnUpdateEvents (the save's restore
calls it) raises OnUpdateWind as the C# does - the port had only cleared
the current's memory there. Kept: with no boat,
GetBoatGameObject and GetBoatMeshObject read CurrentBoat anyway, so a
caller with a callback meets the C#'s NullReferenceException; with no
callback nothing is read.

### Eye of the Beholder's boat

The second consumer the port carries (`player/eotbCamera.js`,
`player/eotbBillboard.js`; `06-Systems/Eye-Of-The-Beholder.md`), and its
two rows of `test/eotb_scope.test.js` are ported. ModCompatibilityChecking
finds the mod once, in Start, and subscribes OnUpdateSailing; each boot
hands the camera that boot's runtime (`player/mwView.js`
setEotbComeSailAway - DECLARED (37): the port's camera outlives a host
boot and the runtime does not), which puts the boat fields back as the
.ctor would, and a mod handed after Start subscribes at once.
OnUpdateSailing asks GetBoatMeshObject and is answered at once; the
collider's centre is kept as a vector in the object's frame, its extent
is the largest half-size, and the flag and the helm are looked for among
the object's OWN children - the walk stops once both are found, a later
child of the same name never replaces an earlier one, and with neither
the flag is the object itself (kept: three hulls carry their flag deeper
than that, so their flag is the hull itself). Both are nulled before each look, so
one camera over two sails never keeps the first boat's. The camera's boat
target (IL_1612-IL_16c5): the posOffset arm by the camera's own field;
the masthead (Target 1) plus the offset scaled by the extent; the hull
(Target 0) plus its LOCAL centre added as a world vector (kept); ashore,
or with the override off, the body's head; and the minimum distance still
floors it in the body's frame (IL_1766-IL_17da, kept). The sprite faces
the boat (IL_471c-IL_4765): its DrivePosition's forward, else the hull's,
over every turn-to-view arm, flattened; ashore, nothing. The rig's old
`sailing: false` wire is gone. Two small doors the arm needed:
`world/prefabNode.js` `inverseTransformVector` and `forward`, and
`systems/comeSailAwayBoat.js` `colliderBoundsInChildren`
(GetComponentInChildren<Collider>: the node's own first collider, then
its children's).

### The mods the port does not carry

Start looks up two mods the port has not got (1007-1008): World of
Daggerfall's TERRAIN, by its GUID `a9091dd7-...` (not the port's World of
Daggerfall, the locations mod), and Animated Water. Both lookups are
null in code (`WOD_TERRAIN`, `ANIMATED_WATER`), so every arm on them takes
its null branch: the water level 34 (100 is the terrain mod's), the mod's
own wave frames, current, rudder particles and bob, Animated Water's
getWaveHeights never sent. Compatibility/AnimatedWaterVertexWaves stays in
the pane as the mod ships it and changes nothing; its description says so.
Iliac Puddle No More is in the port, asked of the host
(`iliacPuddleNoMore`), and its arms were checked and stand: the placement
ray's hit on its DeepWaters slab (FIELD-CSA1: a hit on the carved floor
floated to the sea over it), the WaterLevel plane when the ray finds
nothing (FIELD-CSA1: within the ray's reach, at the sea's top under the
vertical compensation), the nodes' height test (CORRECTED, FIELD-CSA2: it
did not stand - read off the drawn ground's floats it took the open sea for
land, and no boat moved on it; it reads Unity's heightmap precision now,
above), the water walk's box height, and on its
own side the swim standing down on the boat's bundle. Travel Options'
one message is CSA-G's.

### The audit

Five readers against the assembly and DFU, each over its own share of the
port. Their fixes: OnStartLoad raised ahead of the save's player on both
loads (SaveLoadManager raises it at :1378, before the restore at :1497 -
the port raised it after, and its StopSailing took a loaded character's
ship); OnLoad after a same-dungeon load (:1554); the boats' models awaited
before a load's mod loop (SpawnBoat is synchronous, so a load's boats
stand at once); the Transport press leaving the helm before the street's
window opens (the mod leaves on the press, and DFU opens the window on the
release); OnPlayerDeath from a death or a collapse in a building or
underground; the oars' fatigue through the mode's own door; the modes'
frame running the mod after its motor, on the mode's own axes, none of
them gated by paralysis (InputManager has no such gate); OnPostFastTravel
(1973-1976, the scale put back to one); a load in progress holding the
mod as a pause does; the Enabled switch read once, at load, as the pane
says - at every door since AUDIT PRE-MERGE 0928: the runtime, the shelf's
rows, the mod's keys (S4, U7) and its effect's restore (S3: a boat's save
loaded with the mod not loaded restores no WaterWalkingSilent, as DFU's
broker instantiates no effect an unloaded mod registered); a new game keeping Start's rolled wind (DFU calls nothing on a
mod's save interface for a new game - `systems/modSaveData.js`'s
`newGame`, which a mod without one does not have, so it still takes its
NewSaveData); past a terrain's edge the edge's own height (Unity's
GetInterpolatedHeight clamps); a rider's hit carrying its hull; a
SpawnBoat that throws half way leaving its half-built hull standing, as
the C#'s GameObject stays in the scene; RuntimeMaterials writing into a
copy and assigning it past the loop, so an index out of range writes
nothing; the boat's bed skipping the GiveOffer rung, which Roleplay
Realism's BedActivation has not (RR1's beds too); and the waves' and
particles' pictures loaded at boot. The page's own claims were read
against the code as well; the trim, the current, the lateen, the tick
order, the helper plane, ScalingMode and the bed were corrected.

DECLARED (the Port-Ledger row): (36) the others see a sailor's boats
(Online, below); (37) the camera finds the boat each boot (above); (38) a
load that lands elsewhere leaves the helm - the port's loads can land away
from the save's place (the online wake at a temple, ONLINE-UNDERGROUND-LOAD1;
a dungeon not found or with no door; a save of elsewhere) where DFU always
re-enters it, and there the record's helm is let go (`currentBoat` -1),
because RestoreSaveData's StartSailing would pin the player to a boat
UpdateBoatVisibility then destroys - and the ship a crewed helm lent is
taken back after the mod loop, as StopSailing's lent-ship arm takes it
(IL_b0e7-IL_b121: AUDIT PRE-MERGE 0928 C1 - the let-go record never reached
it, and the character kept a ship a bank would buy for 85,000); (39) a
load's start ends a disembark still holding the player, where the C#'s
OnStartLoad stops only a sail its IsSailing sees (AUDIT PRE-MERGE 0928 S1);
(40) another player's boat is boarded, stood on and carried by, the others
aboard seen on its deck (Sailing together, CSA-K); (41) the helm is on
screen and on a pad's d-pad (The helm on screen, CSA-L).

## Online (CSA-A, CSA-J)

The player's own (`systems/onlineLane.js` ONLINE_PLAYERS_OWN_MODS): a boat
is a possession in the player's save, placed and sailed by them - Horse
Cart and Cargo's wagon's shape. Its wind is each machine's own roll
(`UpdateWind` draws from UnityEngine.Random), as it is for each DFU
player. The time scale (CSA-G) is offline's alone (HELM-TIME-ONLINE,
2026-10-04, Mac: "Remove the time dial from ships online"): online the
three keys say why and move nothing, and the helm draws no dial - it had
been Travel Options' journey's case (TO-ONLINE, OL2), speeding the player's
own world and, through WALK-CLOCK, their own clock.

CSA-J: the others in a cell SEE a sailor's boats (DECLARED (36): the mod
is single-player). `systems/comeSailAwayWire.js`: every active boat - its
hull, its variant, its root in the wire frame (to the centimetre), its turn
(to four places), its raised sails as bits (sixteen at most), the helm and
the lanterns; at most eight boats - rides the owner's own foes frame as
`sa`, beside the camps' `c` and the team's `hv`, on every full frame and
on a moved word between them - a moved word asks for the frame it rides, as
the team's does (AUDIT PRE-MERGE 0928 O2: it had waited for a full frame,
two seconds) - (`scenes/world.js` csaWord; the mod off, one
null takes the owner's away). The relay reads nothing inside a foes
frame, so the relay is unchanged. A peer's word passes the door whole or
not at all (a known hull, a variant among the hull's own - the Large
Boat's seven, none read on the rest: AUDIT PRE-MERGE 0928 O1, where a
variant past the Large Boat's count had stopped every receiver's game loop -
the pose bounds, a unit quaternion,
normalized, the bits and two flags) and lands past the room test
(`scenes/exteriorFoes.js` setOnCsa). `scenes/comeSailAwayPeers.js` stands
it: each boat built as SpawnBoat builds one, into the pool's PEER list
(`scenes/comeSailAwayPool.js`) - drawn, baked, lit and collided with as a
boat of mine (FIELD BUGS 2026-10-01b, below), and a ray's hit and an activation
only as CSA-K makes it one (its ladder and boxes pressed: below), because
the host's loops read the pool's own `boats` - and posed every frame off the word,
converted from the wire frame each frame (AUDIT HCC O1), eased toward it
(a step past twenty metres snaps: `easeToward`, the team's law) and turned
toward it by a slerp. A boat of the same hull is kept wherever the word
moved it in its list, the nearest first, its variant set in place as
SetBoatVariant sets it (AUDIT PRE-MERGE 0928 O3); the sails raise
and stow through the mod's own Animator calls, the crew's idle and active
objects follow the helm, the lanterns the owner's switch. The owner law
is the camps' and the team's: an owner's word replaces theirs alone; an
owner gone from the room, or quiet past the stale time (three full
frames, six seconds), takes their boats with them; a clear (a transition,
a fast travel, a room change) takes everyone's; the mod off stands
nothing of anyone's; before the pool's models are in a word stands
nothing. The socket's handler keeps a word and builds nothing: the frame
builds one boat across every owner, each owner under a bucket (eight at
once, one back every FOES_FULL_MS), and a build or a variant change that
throws costs that owner's word and boats alone, said once (AUDIT PRE-MERGE
0928 O3 and O1 - a peer swapping hulls at twelve words a second had held
every receiver's frame). A concealed sailor's boat at the helm stands
nowhere on the classic lane and wears the sailor's look on the enhanced,
its crew and lanterns concealed with the sailor; a moored boat is a boat in
the world (the pre-merge audit's I-B law - AUDIT PRE-MERGE 0928 O4). The
hull carries no foe another client steps (O6). Not carried: the bob,
the wake, the oars, the sounds, the trim and the wind's belly - the
owner's own frame drives those, and the wire carries the pose five times
a second, the helm's way beside it (CSA-K, below).

## Sailing together (CSA-K)

The port's own, online (DECLARED (40)): the player's ask (2026-09-28), "I
want people to be able to sail together, to walk on board as it moves".
The mod is single-player - its boats carry their own player at the helm
and nobody else, and DFU has no second player to stand on a deck - so
nothing here is a C# statement; what it reuses is named where it runs.

**The way on the wire.** A pose five times a second, eased word to word,
surges and stalls five times a second under whoever walks the deck. So
the boat at the helm says where it is going: `m` beside `b` in the owner's
`sa` word (`systems/comeSailAwayWire.js`), a place for each boat - its
velocity on the water through the wire frame (the point a second on,
converted, less the point: natives a second) and its turn in degrees a
second, each on the real clock at the owner's time scale
(`systems/comeSailAway.js` helmMotion: the world vector LateUpdate
translates the boat by and TurnCurrent; nothing while a pause holds it,
nothing beached). A moored fleet says no `m` at all, so a reader of the
older build - which reads `b` alone - reads the same record; a new reader
of an old record leads nothing. The door takes the way whole or drops the
record whole (aligned with `b`, three finite numbers, a boat's speed and
turn). The change key carries it, so a boat brought up short is said at
once. `scenes/comeSailAwayPeers.js` LEADS a boat under way instead of
chasing it: each frame it is carried on by the way's share of the frame
(what the lead grew by - none past CSA_PEER_LEAD_MAX, 0.6 s, so a late
word leads no further and the boat holds where the way took it) and eased
the rest of the way to the word led from its arrival; the turn the same,
Rotate(up x turn) in the boat's own frame. A step past the snap (20 m) is a
teleport. Each boat's frame keeps the pose before it (`moveOf`: none the
frame it is built, none across a snap) and can be peeked a frame ahead
(`poseAhead`).

**Aboard** (`scenes/comeSailAwayAboard.js`). A player comes aboard another's
boat by its own ladder - BoardBoat (112401) answers on it as on one's own:
stood at the sibling before the trigger (`boardPlaceOf`, the one export
BoardBoat reads too), facing its forward, set on the ground within 3 m
with THEIR deck among what that ray meets (`scenes/world.js` csaBoardPeer) -
by standing on it (FIELD BUGS 2026-10-01b: a deck stepped, climbed or come up
onto is aboard, its colliders standing for everyone, below) - or by landing
on its deck from above: in the air over it, the ray down
from the body's centre (the riders' own ray, CSA_ABOARD_BELOW 3 m longer
so a fall is met before it lands) meeting its colliders no higher than a
step (0.3) over the feet. A swimmer is never taken aboard by the ray - inside
a hull the ray meets its floor from within - so the ladder is the way up out
of the water, as in the mod; and a body standing on anything else (a pier
over a moored boat, the shore under a bow) is never aboard and never
dragged off by the boat's going. Aboard is the motor standing on the boat's
own colliders, or in the air over its deck; the ladder's first two frames
(CSA_ABOARD_GRACE) are its own, the motor not having stood there yet.

**Her deck stands for everyone** (FIELD BUGS 2026-10-01b, Mac: "Players
aren't colliding with other players' boats and can't stand on board").
Another player's boat stands in every player's collider as their own boats
do - its switched-on, non-trigger colliders, as buckets beside the player's
own boats' (`scenes/world.js` csaSyncColliders), carried as it moves, aboard
it or not, on the street alone. CSA-K stood them only for the one aboard
(PR-WAGON1's "Others' wagons don't block"), so to everyone else her hull was
walked and swum through and her deck was no floor; Mac's word sets that law
aside for boats (a wagon's stands). A wader and a swimmer meet her hull, her
deck is stood on, and a helm's sweep (CheckCollision's) meets her as it meets
a boat of one's own, so a boat sailed at hers backs off it. The mod's own rays
(the placing, the riders' FixedUpdate) skip those buckets and meet the
player's own boats alone, as before.

**Carried.** Once a frame, after the mod's own step and its colliders and
before the eye is taken from the body (`scenes/world.js` csaPeersFrame,
from csaUpdate; from the pool's frame when that did not run), the peers'
boats are posed, and the deck carries whoever stands aboard it by its
move: the feet kept at their place on the deck (carriedPoint - the helm's
own law for its child, one export) and the facing turned with the boat
about up (yawDelta), in the air over the deck too, so a jump on a moving
deck comes down where it left it. The body is carried rigidly
(`player/motor.js` carryBy: the body and both ends of the render span, the
smoothed eye and a fall's start with it, no motion state touched) - the
helm's carry of its child, not DFU's controller.Move - and the motor's next
step meets the world from there. Nobody is carried across a jump of the
boat's (a snap, a boat rebuilt): it puts them off.

**Off.** Walking or jumping off the side (nothing of it under the body and
nothing of it stood on), standing on something else, swimming, the boat
gone (packed, its owner gone from the room, a clear) or the host's own
leave - a transition, a fast travel, a teleport, a death, the mod off, a
mode's frame (a building's, a dungeon's) - puts the one aboard off at once,
the deck's buckets standing on; the motor falls or swims as it would.

**Seen on the deck.** My place aboard - whose boat, which of their word's
places, and my feet in that boat's own frame to the centimetre - rides my
foes frame as `ab` (`scenes/world.js` csaAboardWord), a word only when it
changes (standing still on a moving deck says nothing) and again on every
full frame, null aboard nothing; the reader takes it past the same room
test and owner law as `sa` (`scenes/exteriorFoes.js`: gone from the room or
quiet past the stale time, a clear, a teardown). The pose frame could not
carry it: the relay's `validPose` projects the pose field by field and a new
field would be a relay change (every player dropped). Every reader stands a
player aboard on their OWN copy of that boat at that place (glue, over
`online.drawable()` before every layer reads it): the owner on the boat they
sail - its move of this frame made ahead, since the online frame runs before
the mod's LateUpdate (`csaPoseAhead`) - the others on the one they lead, a
frame ahead the same way; the place eased toward each word, a new boat's
taken at once. So the deck I walk is the deck they see me on, never a
stride behind it.

**What a passenger may press.** Another's boat's pick is taken only where
none of the player's own boats is under the ray, and it YIELDS (PR-WAGON1's
`firmFirst`: anything firm under the ray takes the press first); the static
world nearer takes it, the deck I stand on skipped as my own boats' buckets
are. The ladder boards it; the status box is the mod's "Nice Boat!"
(NICE_BOAT_TEXT, one export); a door turns over through TriggerDoor's own
statements (`turnDoor`) for the one who pressed it (DECLARED: the owner's
doors are not on the wire); the position box is the player's own
instruments (StartShowBoatPosition reads no boat, kept); the bed is Roleplay
Realism's BedActivation, anyone's; the helm, the cargo and the variant are
the owner's, and the press says whose, a peer's wagon's HCC-TIP shape
("This Large Boat - owned by Ann."); past the mod's 3.2, silence. The plaque
names the hull and "Owned by Ann". The owner's pack is refused while anyone
stands aboard ("You cannot pack a boat with passengers aboard!", the
driver's refusal's shape: a pack would drop them in the sea); the owner's
leaving the room, a fast travel or a log-off still takes the boat from under
them (DECLARED: the owner's world is theirs), and they swim.

**The four hosts.** `scenes/world.js` wires it all (the exterior's frame -
the only place another player's boat stands); `scenes/worldModes.js` and
`scenes/dungeonContext.js` stand no one's boat (a building's and a
dungeon's room carry no `sa`: FLAGGED as the port's reach, not DFU's), and
their frames put the one aboard off; `scenes/exterior.js` (the standalone
street, offline) has no peers. Not carried: a foe does not ride another's
boat (the riders' FixedUpdate asks the player's own boats), nor does a peer's
avatar collide (peers never stand in the collider).

## The helm on screen (CSA-L)

The port's own (DECLARED (41)): the player's ask (2026-09-28), "instead of
an overuse of keybinds, is there a way we can instead develop enhanced plus
UI elements?" - and AUDIT PRE-MERGE 0928 U4's open question (the helm's
nine actions on a phone and a pad) with it. `ui/enhancedHelm.js`, Enhanced
Plus only; the classic skin keeps the mod's keys as the mod drew them.

- **Every button is its key.** A press is the registry action the key
  presses, handed to the mod through the host's one input seam
  (`scenes/world.js` csaHelmInput: `started` a tap's edge for that frame,
  `has` a hold until it is let go, and a chord's modifier held for the frame
  of its tap - the square sails' End with the trim modifier); the mod's step
  spends the frame's taps after its LateUpdate. So the mod's own code runs
  as it runs for the key, and the keys still work (KB1: bindable; a press
  with no key bound still presses). What the panel shows it reads
  (`helmPanelState`) and never writes: the sails and whether they stand; the
  square sails' own toggle where the key's chord would raise them alone
  (raised sails, square and fore-and-aft kinds, the assist off); the trim
  only while it is the player's (SailingAssist.AutoTrimming off), and the
  square sails' own trim where the hull carries both kinds; the lanterns;
  the time scale's three, the ends refused; the position reading (the
  position box's own reading, from the wheel - DECLARED: the box is out of
  reach there); leaving the helm.
- **The HUD's kind of thing, not a window** (the journey bar's law,
  `ui/enhancedTravelControl.js`): it pauses nothing, registers with no
  overlay stack, and only its buttons take the pointer, their presses
  swallowed (never a swing or an activation in the world). It stands under
  the compass where the journey bar stands (a journey and a helm are never
  up together), hidden under a window over the HUD, the HUD toggled off or a
  pause, and every hold is let go when it hides or goes. Once a frame from
  the frame's own top, so a dungeon's water is sailed with it too.
- **The mouse** clicks it whenever the pointer is free - the free-mouse key
  (Y), a surface, a finger - as the hotbar's and the spell tiles' do; while
  the look holds the pointer the title says how to free it. Each button
  carries its key as the Controls page names it.
- **A finger**: every button is 44 px and the bar stands at the top, clear
  of the stick and the corner; no key hints.
- **A pad**: at the helm the d-pad is the helm's (`ui/gamepadInput.js`,
  PADPLUS6's quick-loot law): up raises or stows the sails (held, the square
  sails alone), down lights or douses the lanterns (held, leaves the helm),
  left and right step the time scale (held, the trim while it is the
  player's, else left puts the time back to one) - so none of the four
  reaches the bare d-pad's own actions or a quickslot at the wheel; a bumper
  held is still the crossbar's, and the prompt bar says so. A held trim is
  let go when the helm, a window or a bumper takes the d-pad.
- **Aboard another's boat** (CSA-K) the same bar names whose deck you stand
  on ("Aboard Ann's Large Boat") and holds no button - the helm is theirs.

It is dressed by the kit (`ui/enhancedFrame.js` FRAME_ROLES: the bar a
window, the presses buttons); its own sheet only places and letters.

## The arrows are the helm (HELM-KEYS, 2026-09-29 - DECLARED)

The player: "Arrow keys should not only control your ship, but also setting
and raising your sails. I also want to find a way to make the ship controls
more intuitive instead of a bunch of buttons and key binds." The port's own,
on the mod's own states (`bible/10-UI/Controls.md` HELM-KEYS has the keys):

- **More sail and less sail** (`MoreSail`, `LessSail`; `BoatSailUp` on the up
  arrow, `BoatSailDown` on the down): stowed, raised - and where the square
  sails are the player's own (the assist's AutoStowSquareSails off, a hull
  with both kinds) all her canvas, the fore-and-aft alone, none: RaiseSails
  and ToggleSquareSails up, ToggleSquareSails and LowerSails down, each with
  the mod's own words. A step with nowhere to go says so ("All sail is set.",
  "The sails are stowed."); a sailless boat says what ToggleSails says.
- **The turn keys are the rudder's at a helm** (the world's input seam:
  `has('MoveLeft')` answers `TurnLeft` too, `horizontal()` swings the rudder
  with them), and the keyboard look leaves them be there.
- **In irons** (`IRONS_TELL_DEG` of the wind's eye, under `IRONS_TELL_WAY` of her
  own way AHEAD through the water - `MoveVectorCurrent`'s forward, so sternway counts
  too (GALLEON), never the sea's current, which under the mod's default waves is half
  the wind and kept the tell off: AUDIT NAV2 F15 - her sails up): the helm is told
  once how she comes out, again only after
  she has been out of them - under the Classic helm `IRONS_TEXT` (strike sail and
  row her round), under the Responsive one `IRONS_HELM_TEXT` (put the helm over, or
  strike sail and row: her rudder answers at rest, and the helm alone brought the
  mod's galleon 40 deg off the wind's eye in about 10 s, the new galleon in 6.4 s -
  AUDIT NAV2 F18);
  `helmPanelState().inIrons` and `.responsive` put the right advice, with the
  keys, on the panel's line while it lasts (`ui/enhancedHelm.js helmHint`).
- **The panel teaches the arrows**: its line is the helm's hand at a glance.
  HELM-LADDER (below) moved its sails' button to the mod's own toggle.

## One ladder for W, S and the arrows (HELM-LADDER, 2026-10-04 - DECLARED)

From the field: "WASD and Arrow keys should function the same when controlling. Allowing you to lower and raise
sails" - the throttle ladder chosen over a tap-or-hold split. HELM-KEYS had put the sails on the up and down arrows and
left W and S the mod's oars, held: two pairs that did different things, W and S inert once the sails were up. Now W and
the up arrow (`MoveForwards`, `BoatSailUp`) climb ONE ladder a rung a press, S and the down arrow (`MoveBackwards`,
`BoatSailDown`) come down it (`systems/comeSailAway.js` `ladderUp`, `ladderDown`):

- **The rungs**: the oars backing water (-1), the oars at rest (0), the oars pulling ahead (1), her sails (RaiseSails),
  and - where her square sails are the player's own (`squareHandled`) - all her canvas (MoreSail's step). Each rung is
  said ("Oars: backing water.", "Oars: at rest.", "Oars: pulling ahead.", the mod's own "Sail raised!"); the foot says
  "She is already backing water.", the top what MoreSail says, a rowboat's top what ToggleSails says ("Boat does not
  have any sail."). Down from her sails is LessSail's step, and from the last of them she PULLS AHEAD on her oars.
- **The oars are a rung, not a held key**: `oarThrottle` is kept until a press moves it, a sail goes up (RaiseSails
  ships them) or she leaves the helm (StartSailing and StopSailing set it at rest); never saved. The oars' stroke, its
  rudder's RowZ, the oar acceleration and the helm's answer astern (backing water turns her the other way) all read the
  rung where the mod read the held keys (Update 4301-4768, moveAccel 538-551, HasInput 582-613). `Run` with a side key
  still sidesteps. A press takes the frame it is made in (read before the stroke, as a held key was).
- **Unchanged**: A, D and the side arrows steer (HELM-KEYS); End still toggles all her canvas from any rung, and the
  helm panel's sails button is that toggle now (its key hint End) - "Raise sails" raises them, never a rung of oars;
  a journey's oars pull as the autorun does (OWS2), and under the travel view W and S stand down with the sail keys
  (AUDIT NAV2 F17's gate). The panel's line reads "Oars & sails W S ↑ ↓ · Steer A D ← →" as bound; in irons, "strike sail
  (S ↓) and row her round" - one rung down does both.

The test harnesses (`test/csa_sailing.test.js`, `test/csaScene.mjs`) take a key going down as the press it is - one held
as the helm is taken is pressed at the helm. `tools/mutants/helmladder.json`.

## The responsive helm (HELM-WAY, 2026-09-29 - DECLARED)

Mac: "Improve the overall mobility and maneuverability of ships." Measured first on the real runtime (1/60 s frames,
waves off, a 1.5 m/s beam wind - AUDIT NAV2 F20 re-measured every figure here like for like, where the first cut mixed
thresholds): a Small Ship took 25.4 s to her full way (7.61 m/s; 95% of it in 24.1 s) and, her sails struck, 25.6 s to
come down to 2.5 m/s and 38.1 s (145 m) to rest; she turned only with way on (the rudder IS her way: `TurnTarget = |v|
x rudder / 10`), 0.75 deg/s at 1 m/s and none at rest, on a 153 m circle at every speed; a Large Galley under sail
turned 0.85 deg/s (a 458 m circle); and a Carrack could neither make way nor turn - she has no `Cargo` node, so
UpdateBoatCargoMod's `2 - w / (500 x 0)` clamps every speed and turn to nothing (kept, above, as the mod's own).

**The law** (`systems/helmWay.js`, DECLARED - the Port-Ledger's HELM-WAY row): the Features row Naval Combat's drawer
has **Ship handling** (`naval-handling`: Responsive, the default, or Classic - the mod to the letter), each player's
own. The runtime is the mod unless the host hands a handling (`deps.handling`). AUDIT NAV2 F14: it is TAKEN ONCE A HELM
SESSION - read at StartSailing, let go when she stops sailing (`helmResponsive()`), so a change takes the next helm:
the hold is weighed at StartSailing and each magic round, and a Carrack under way when the row flipped to Classic lost
her hold on the next round and froze at 10.81 m/s and 7.14 deg/s for good (every acceleration x 0 - the mod's own
overloaded-hold freeze, reached through the port's switch). Under the responsive helm:

- her way comes on at `HELM_WAY.sailAccel` (3.5) of the mod's rate under sail, and off at `HELM_WAY.coast` (3) of it
  with her sails struck - every Handling dial still multiplies it; the oars are the mod's own;
- her rudder answers her STEERAGE, not her way: `steerage(v)` - `steerFloor` at rest (the wind in her canvas swings
  her), `steerPeak` at `steerPeakV`, easing toward her full way (`x e^(1 - x)`), times the rudder modifier as the mod's
  way was - so half sail turns tightest, as Black Flag's does; the helm comes over at `HELM_WAY.turnAccelSail` (2.4)
  of the mod's rate;
- a hull with no Cargo node carries `CARGO_HOLD_MISSING` (the Large Galley's hold): the Carrack makes way and turns.

Measured after, on the same runtime and wind: a Small Ship to 95% of her way in 6.9 s (24.1 s the mod's) and to her
full way in 7.25 s (25.4 s); struck, to 2.5 m/s in 8.5 s (25.6 s) and to rest in 12.7 s over 48 m (38.1 s over 145 m);
her rudder 2.25 deg/s at rest (none), 10.50 deg/s at 4.5 m/s on a 49 m circle, 9.24 deg/s at her full 7.61 m/s on 94 m
and 8.32 deg/s at 9 m/s on 124 m (153 m at every way the mod's); two seconds from rest with the helm over she swings
8.78 deg/s at 2.1 m/s (0.45 at 0.6 m/s); a Large Galley under sail 3.40 deg/s at 3.4 m/s (a 114.5 m circle; 0.85 and
458 m), her way full in 6.4 s and off in 11.3 s (22.5 and 33.8 s); a Carrack makes 9.15 m/s, full in 8.7 s, and swings
10.5 deg/s four seconds from rest (none, the mod's). Head to wind with the helm held over she comes 40 deg off its eye
in 10.1 s (the mod's stays in irons).
The heave-to's brake (NAV1's `accelScale`, ten times her own coast) is its own number now - `brake`, HEAVE_TO_DECEL
m/s^2 - so the handling choice never moves it. Pins: `test/helmway.test.js` (the harness `test/csaScene.mjs`, the
wind suite's scene, one module).

GALLEON (2026-10-01): the Small Ship is Mac's galleon now (The new galleon, below) - five sails where the mod's galleon
carried two lateens - and helmWay.js's header carries her figures, re-measured like for like (AUDIT NAV2 F20's pin
holds them): under the mod's handling she takes 29.2 s to her full way of 8.75 m/s and 43.7 s (191 m) to lose it,
0.75 deg/s at 1 m/s and 6.56 at her full way on the same 153 m circle; under the responsive helm 8.33 s to her full
way and 14.6 s (64 m) to lose it, her rudder 8.49 deg/s at her full way on a 118 m circle. AUDIT GALLEON T11, the rest
of hers like for like: to 95% of her way in 7.92 s (27.72 s the mod's handling), struck to 2.5 m/s in 10.42 s (31.25
s), head to wind with the helm held over 40 deg off its eye in 6.37 s (the mod's handling stays in irons: she swings
to about 30 deg off it in a minute and lies there, no way on); her rudder at rest, at 4.5 and 9 m/s and two seconds
from rest as the mod's galleon's above. The
mod's galleon's figures above stand for the record - she is hull 2 again whenever the new galleon's model will not
load.

## The Overworld's crossing (OWS2, 2026-09-28)

The player's ask: *"You should transition to your boat if traveling across water then back onto land when hitting
land"* - `06-Systems/Travel-View.md` OWS2 records the journey; what it asks of this mod is here, and the Port-Ledger
row's (42).
- **Two doors on the runtime.** `LaunchFromParts(item, collection, position, direction, terrain)` is the placing
  click's terrain arm aimed by the journey rather than the camera's ray: "Boat placed!", PlaceBoat with the parts'
  hull and variant (`hullFromMessage`, `variantFromMessage`), the item's half (`takePlaceItem`: the parts' UID and
  their packed cargo aboard, the parts spent from the pack as it stands), whatever the click was placing let go - PARTS
  only (a deed's boat stands where a port put it). `nodeReadingAt(point, terrain)` is the nodes' own law, one home now
  (`readNodes` reads through it): Iliac Puddle No More's height under its line, else the tile map's water - the
  journey asks it where a boat would float before it puts one there.
- **The pool's rig.** `hullRig(hull)` builds a hull once on the pool's own context (SpawnBoat, never placed or drawn)
  and keeps its five nodes in its own frame, its sails, its crew, its packing and its Cargo modifier: the launch's
  probe and the crossing's choice of boat read it.
- **The helm pressed by the journey.** An Overworld journey's hand (`systems/seaHelm.js`) presses the helm through the
  host's one input seam (`csaJourneyHelm`, read by `input.has` beside the keys and CSA-L's panel, and by the autorun):
  the rudder keys held, the ToggleSail key's edge, the oars' autorun, and at the landfall the disembark key - the mod's
  code moves, turns, beaches and leaves the boat, and PackBoat packs it. A packable boat is to hand again after its
  landfall; a crewed one is left moored - SHIP-PACK: a ship is packed too when her deed is in the pack. The Rowboat (no sail) is no crossing's boat; the Carrack (no Cargo modifier) is
  one under the Responsive helm only, which gives her a hold (`tvSeaCrosses`: AUDIT
  NAV2 F16 - she was refused under the default helm she sails best under). AUDIT
  NAV2 F17: while the journey holds the helm (the travel view up) the helm panel is
  covered and the keyboard's sail keys (More sail, Less sail, the sail toggle) stand
  down - they made and struck sail against the journey's own hand, and the panel
  said "Steer" for keys the view had; the journey's own press still sets her sails.

## A boat's menu (BOAT-MENU, 2026-09-30 - DECLARED)

Mac: *"I want to make the boat interaction like the loot menu. Being able to pick up, view storage, mount, all from a
simple menu and button press."* The mod answers a press on one of its seven boxes, each in its own place on the hull,
and the hull between them answers nothing; taking the helm and packing the boat were the same box, told apart by the
interaction mode set beforehand (Steal packs). The port's ACT-MENU already lists a namer's verbs on the plaque under
the crosshair - a horse's and a wagon's (`systems/horseCartLaw.js hccActionRows`) - and a boat of mine now lists its
own (`systems/csaBoatMenu.js`, pure):
- **The rows are the boxes the boat carries** (`boatTriggers` walks the boat's nodes for the seven): Take the helm
  (Leave the helm at her helm), Board (not while aboard her deck or at her helm), Open storage, Pick up, Change style
  (a hull with styles), Status, Position. The Rowboat lists its helm, its ladder and the pick-up; the ships their
  chest, the Small Ship and the Large Galley their status, the Small Ship alone its position (AUDIT PR478 F3).
- **Anywhere on her.** The hull lists them as the boxes do. The press goes through the mod's own `activate` on the
  verb's box (`pressBoatVerb`): its 3.2 reach from the point aimed at, silent past it; the nearer box where she has two
  (a ship's two ladders); the pick-up pressed in Steal mode and the helm in Grab, whatever mode the player has set.
- **The hot spots stand.** The lit row starts on the verb of the box under the crosshair (`boatMenuStart`; the
  plaque's `actionsStart`, `systems/worldHover.js nextSelection`'s start row): a press at the helm's box takes the helm,
  at the chest opens it, as before the menu - and Steal mode at the helm's box lights "Pick up", as the mod's press
  packs, and a mode switched there lights its own again (the helm's box under Steal is a key of its own, AUDIT PR478
  C2). On the hull the list starts unlit (C4: a plain click on the deck is no request); the wheel's first step lights
  its top row. No list at a helm (C1: the pad's d-pad is the helm's there). A door lists nothing and turns over as it did, as does a box whose
  verb the boat does not list (a ship's variant box with no styles). The wheel and the pad's d-pad move the light as
  on any plaque list.
- **A refused row is listed with its reason**, and its press says the mod's words: the pick-up at her helm ("You
  cannot pack a boat you are driving!") or with another player on her deck; a deed's ship, which the mod never packs
  ("a deed ship stays afloat" - since SHIP-PACK no hull of the mod's, and a ship's refusal is her deed not in the pack
  instead); a style at the helm.
- **Where no plaque stands** - a phone's tap, the classic skins, a building's or a dungeon's plaque (C5) - a press on a box does what it did, and a press on
  the hull opens the same rows as a list (`csaOpenBoatMenu`, the variant picker's `ListPickerWindow`), put away before
  the verb runs.
- The walk is kept per hull and style (`_csaBoxes`); whether I stand on her deck is the ground under me being one of
  her buckets (`csaStandsOn`, the aboard word's own test). Another player's boat keeps CSA-K's press (the ladder boards
  it, the rest say whose it is). Pins: `test/boatmenu.test.js`; `tools/mutants/boatmenu.json`.

## A boat left in a dungeon is kept (KEEP-BOATS, 2026-09-30 - DECLARED)

`Compatibility.PersistentDungeonBoats` ships off in the mod, and off, UpdateBoatVisibility destroys a boat placed
indoors or underground once the player is back outside: a packable boat and its hold are gone for good, and a crewed
one comes back from its deed with an empty hold. On Mac's ask that ship ownership be *"less punishing"* the port ships
the key ON (`systems/modSettings.js`); the player can still turn it off. AUDIT PR478 D2 (DECLARED): the mod stands an
`inside` boat in any interior on its pixel - a building's too, which its own default never met - so a kept boat stands in
a dungeon alone (`UpdateBoatVisibility`'s `inDungeon`, the host's `isPlayerInsideDungeon`). `test/csa_registration.test.js` DEPARTED;
`03-World/Naval-Combat.md` KEEP-PLUNDER is the other half.

## Your boats on the compass (BOAT-MARK, 2026-10-01 - DECLARED)

The field: a Large Boat put in from its deed, her owner killed aboard her and woken at a temple -
*"is there any way to know where your ships are located at?"*, then *"I want to build a compass icon that tracks your
boat"*. A packable hull's deed or parts are spent on placing (`takePlaceItem`: the item is removed unless the boat is
crewed), the boat is kept where she was left, and nothing in the game said where that was: the mod's position box
reads the map only from aboard, its `printboats` lists pixels on the developer console alone (offline), and the
compass marked the sea's ships (`scenes/navalHost.js compassShips`), never the player's own. The mod has no compass
mark; the port's (`ui/boatMarks.js`, a leaf):
- **Every boat in `AllBoats` is a point**, on the street only (buildings and dungeons steer by their own frames) and
  under the travel view, which is the street's: `boatCompassPoints(boats, current, feet, world, terrainSize)`, called
  with the streaming world's own state and no allocation but the points' pool. AllBoats is mine alone - another
  player's boats are CSA-K's peers, the sea's ships the naval host's.
- **In sight, where she floats** (`boatMarkAt`): an active boat (her pixel within one of mine - UpdateBoatVisibility's
  law) at her root's XZ, wherever that is - a boat drawn somewhere wrong is still where she is drawn.
- **Out of sight, where she floats while that stands on her own pixel.** FIELD-CSA1 made every boat out of sight ride
  every recentre and teleport (`OnPositionUpdate`, `OnWorldReanchored`), so her place is normally good in this frame;
  it is taken while it stands within `BOAT_PIXEL_SLACK_M` (120 m) of her `MapPixel`'s square under
  `pixelTranslation`. Past it - a frame a load never carried her into (RestoreSaveData compensates the height alone,
  kept) - the mark stands at her pixel's middle, the quest mark's own sum. A dungeon's boat (`inside`) is always the
  middle: her numbers are the dungeon's frame.
- **None for the boat at my helm** (`csaBoatUnderMe`), **nor one within `BOAT_MARK_NEAR_M`** (12 m, flat) of my feet:
  at her, aboard or on the quay beside her, the bearing would swing with every step.
- **The mark is a little boat** - a sail over a hull - in one sea-glass teal (`BOAT_MARK_CSS` `#20e0b0`), at least 103
  RGB from every other mark on the strip (the test holds NODE-MARKS' 75). The classic box (`ui/hud.js
  drawBoatCompassMarks`) draws it 7x5 native pixels, its foot on the box's top edge, by the Detect markers' bearing
  law (clamped: a boat behind pins to the end to turn toward), after the professions' nodes and under the Detect
  markers, the party and the ships. The enhanced strip draws the same boat as a 14x12 SVG on the strip's middle,
  where the quest's and the gate's diamonds stand, pooled and hidden, never removed.
- The world host's edit is line-neutral (the import folded beside the quest marks', the door beside the ships'): 346
  cites point into `scenes/world.js`. Pins: `test/boatmark.test.js` (8); `tools/mutants/boatmark.json` (26, all dead).
  Not verified in a browser.

## Every hull picked up (SHIP-PACK, 2026-10-01 - DEPARTURE)

The review before the merge: *"Allow larger ships to be picked up, just like smaller vessels."* The mod packs only a
hull whose prefab carries an active `Packable` node - the Rowboat and the Large Boat. The Small Ship, the Large Galley
and the Carrack carry `Crewed` alone: they stand where their deed put them, and the deed calls them to a port. The port
packs every hull (`getBoatTransforms`: `Crewed` sets `packable` too), and makes a ship's parts HER:
- **Her deed goes with her.** A deed ship (crewed, her deed's number on her) is picked up only with that deed in the
  pack (`deedMissing`); the deed is taken out and her parts go in. Without it Steal mode at her helm says *"Her deed
  must be in your pack to pick her up."* (`DEED_NOT_HELD_TEXT`), the menu's Pick up says why ("her deed is not in your
  pack"), and PackBoat itself refuses (it answers false) for every caller: a fast travel from her helm and an Overworld
  landfall leave her where she lies, as a ship always was. A deed kept elsewhere would call a second ship of hers to a
  port. A ship no item placed (number 0) packs without one.
- **Her deed comes back.** A ship's parts placed (the click, `LaunchFromParts`) are spent - the mod keeps a crewed
  hull's item, so one parts item would have stood ships without end - and her deed is given back where they lay in the
  pack (`takePlaceItem`, `mintDeed`): her number, their worth, her hull. She stands by it as a bought ship does: it
  calls her to a port, and the lost-boat rule leaves her for it.
- **Her number.** Her parts keep her UID, where the C# mints every pack a new one: her naval state
  (`scenes/navalHost.js myBoatState` - her hurts, her crew, her guns), her crew's names and her hands ashore
  (`systems/naval/crewCompanions.js`) are hers again when she stands. Under a new number every ship came back mended and
  fully crewed - a claimed prize's empty decks filled for nothing. The spent PackedCargoes entry under her number
  (TransferAll empties and keeps it) is hers to fill again; any other key already held still throws, and now before her
  hold has moved.
- **Her worth.** A boat keeps the value of the item that placed her (`itemValue`, kept by the save as `Value`), and her
  parts are worth it: a claimed prize's papers, a quarter of her hull's price, never the shelf's (Naval-Combat
  SHIP-CLAIM's OPEN, closed). A boat no item placed packs at her hull's price, as before.
- **Her weight.** The ships' table weights (2,400, 48,000 and 240,000 kg) were never an item's in the mod. Packed, a hull
  weighs no more than the Large Boat's parts (120 kg, `packedHullWeight`), her hold's weight on top as ever: in the pack
  the table's would hold the bearer under the water and sink any boat she sailed.
- The boat menu lists Pick up on every hull (`systems/csaBoatMenu.js`). The world host hands the runtime the pack
  (`items.player`) and the menu its word (`noDeed`); an Overworld landfall packs a ship only with her deed.
- Pins: `test/shippack.test.js` (8) and `test/shipclaim.test.js`'s two; `test/boatmenu.test.js`, `test/csa_boats.test.js`,
  `test/csa_items.test.js` and `test/ows2_crossing.test.js` PIN MOVED. `tools/mutants/shippack.json` (24, all dead);
  boatmenu's, csa_items', csa_placing's, ows2's and audit0928_save's records re-aimed by content and killed again. Not
  seen in a browser.

## The new galleon (GALLEON, 2026-10-01 - OURS)

Mac: *"So this model is to replace the current ingame gallon model. The doors/hatches should open and close and we will
need to give this a proper texture, along with a wheel at the helm, the sails and ropes, amd ensuring cannon fire shoots
from the cannon holes properly."* Hull 2, the Small Ship (the pirate brig's, the merchant galleon's and the navy
cutter's hull too), is Mac's own model now, fitted out round it. The Port-Ledger's GALLEON row carries the departures.

**Her model.** Mac's export is committed - `src/assets/galleon/source/New_Ship.fbx`, his second since GALLEON-2 (the
first came as three copies differing only in their creation stamps) - and `tools/bakeGalleon.mjs` bakes it to
`src/assets/galleon/galleon.json`: each of the scene's objects named to its ROLE and refused unless it stands in the
scene box it was read in, 2 cm let pass (the hull, her gun deck and main deck, two hatch covers, the castle with its
parapet and rail, the bulkhead, the two flights up the castle, the balustrades, the masts with their partners and steps,
the crow's nest and the bowsprit, her six deck beams - AUDIT GN-B5, which refuses a mirroring transform, an unread pivot
or offset and an export's other axes as well); the scene's other stations, its spare pieces and her parts' twins
skipped, each checked to be what it is said to be; the hull's five rudder faces split off to turn on their own post;
every polygon cut as Blender cuts it (`tools/fbxMesh.mjs blenderTessellate`: a float32 port of Blender 5.1's
mesh_tessellate projection and BLI_polyfill_calc - its precomputed point test and its kd-tree, node for node - on the
mesh's own corners in their own order - AUDIT GN-B1, GN2-BK1; an export written by any Blender but 5.1.x is refused by
name, since another version's fill may cut otherwise) and refused by object and
polygon unless its triangles tile it exactly, then carried into the boat's frame (0.7 of the scene, the waterline and
the midship taken off). The bake adds no vertex. Mac's faces are not all flat - his sides lean out of their planes by up
to 0.55 m where he drew the bow in - so the cut decides their shape, and it is Blender's: the first bake's own ear clip
cut her two sides unlike each other (a 22 m wedge 65 deg off its face on one, the sides 0.49 m apart) and its own fill
laid two triangles over two of her ports from inside. Five faces still stand apart from their mirrors where Blender cuts
them on other diagonals - the stern quarter's most, 0.37 m - as they do in his scene, and eleven of the cut's
triangles lie on corners he drew on one line (no area: the drawing drops them). `test/galleon_model.test.js` re-bakes it
to the byte; `test/auditgalleon_bake.test.js` and `auditgalleon2_bake` hold the cut to Blender 5.1.1's, compiled
from its own source (the first port was 5.0's fill and cut her #2 and #34 otherwise, at most 1 mm apart).

**Her prefab** (`world/galleonModel.js galleonPrefab`) is Come Sail Away's data shape built on the bake and stands in
for prefab 112412 (`systems/comeSailAwayModels.js`: her components after the mod's, her meshes decoded already, her
clips and overrides beside its own), so the mod's own SpawnBoat walks her as it walks any hull - her `NewGalleon` hull
node the boat's frame (her MeshCollider her planking and her castle's), her triggers, her lanterns, her crew's flats,
her sails, booms and rudder found by their names:
- **Her hatches and doors open and close** - the two hatch covers (Mac's fore cover is both: his aft one he left propped
  open) lift on their starboard edge and over to lie on her deck (`HATCH_OPEN_DEG`, -178, on battens 2 mm over it and
  0.18 m outboard of the hatchway - AUDIT GALLEON P9: open at -105 the aft cover stood 2.5 m up in the gaff's sweep),
  the castle's door and the bulkhead's swing aft, each on the mod's own Door Controller with a DoorTrigger the walk
  sizes to its collider; TriggerDoor turns them over as it turns the mod's. A companion ladder stands under each hatch,
  down to her gun deck, its manropes made fast under the cover (P2: they stood up through the shut covers).
- **Her wheel** on the castle's roof before the helmsman's place - DrivePosition half a capsule over the roof (0.9 m),
  where Come Sail Away pins the helmsman's capsule centre (AUDIT GALLEON P1: on the roof itself it stood his feet in the
  great cabin and his eye under the hub), his eye at 12.72 clear over the wheel (its hub 0.72 m up) and the binnacle
  (1.30) to the bow on every sight line - turned `WHEEL_TURNS` hard over each way and her rudder `RUDDER_DEG` on its
  post at her sternpost (P8: it pivoted 0.62 m inside her stern and swung through her planking), both by the mod's
  Rudder Wheel Controller's TurnAngle through her own ten clips.
- **Her sails and ropes** (`world/galleonRig.js`) - a brigantine's five by the mod's own names, so its laws read them: a
  fore course and a fore topsail and a main topsail (square, the two topsails small), a large main gaff sail and a large
  jib; on four booms pivoting on her masts' own axes (the mod's trim turns them), each canvas a grid skinned a bone a
  grid point, head row first, and baked as the mod bakes its own (FixDeformations), furled on its yard and set by the
  wind's side through her own clips over the mod's Sail and Staysail Controllers (Stowed, or Unstowed blended by Wind) -
  a square sail's head on its yard and its belly from nothing there, the topsails' half the course's; her shrouds with
  their deadeyes and ratlines on channels flush on her side, her stays (the forestay over the fore topsail's yard, the
  main stay from under the crow's nest to the fore mast's after face), backstays, bobstay (under the bowsprit to her
  stem) and flagstaff (a mesh a piece, never one box round the whole rig), her braces and sheets skinned to the yards
  and booms they work and belayed on her rails and bulwark, the mainsheet on her main deck at the castle's foot. AUDIT
  GALLEON R1-R10: inside the auto-trim's 30 degrees nothing of her rig meets anything else or passes through her (the
  least clearance 5 cm); the manual trim's extremes still cross in 19 named places, the gaff's sweep over the main
  shrouds' sector the most (13 cm at 60-90 degrees) - the mod's trim limits stand.
- **Her guns out of her ports.** Ten gunports (five a side, Mac's) carry a shutter each on the mod's Door Controller -
  fitted to her side at its own port, hinged on her side at the lintel and bent to her at the knuckle (`LID_FIT`, AUDIT
  GALLEON P6: a plumb board stood up to 47 cm off her), solid (P10: a crouching body crawled out of a shut port), swung
  up `LID_OPEN_DEG` outboard, the port side's each the starboard's mirrored (G1) - and a gun behind it on her gun deck
  (1.083 m); two chasers on swivels over her bow rail. HULL_BUILDS' Small Ship is measured off her
  (`systems/naval/navalShips.js`, `GALLEON_BATTERIES`): each broadside muzzle at its port's middle a hair outside her
  planking, so a ball leaves her through the hole it is fired from - the test shoots a line in through every port and
  meets none of her hull, and her planking a port's width aside. `systems/naval/galleonGunDeck.js` works them for every
  ship of hers in play: a battery laid (my look at the helm while it is loaded, a captain's run-out tell, another
  player's word) opens that side's shutters and runs its guns out; each gun kicks `RECOIL` inboard as its own ball
  leaves (the shot field's muzzle, its index the port's) and is hauled out over `HAUL_S`, a gun fired before it is out
  stood out at its shot with its shutter snapped open (G2); `HOLD_S` past the last word the guns run in to load and the
  shutters close. Each port's throat wears its own planking (R8: it wore the shutter's picture, iron straps and all).
- **Her texture** (`world/galleonArt.js`): twenty-three pictures, each 64 x 64 (GALLEON-2, below), painted at the
  boats' preload from numbers alone (her archive asked and her glass's glow cut before any boat stands - AUDIT
  GN2-PF3; they had been painted at her first draw, a 100-440 ms stall) - the hull's painted livery and gilt bands, her bottom, her inner planking, her deck, the castle's
  panels, the stern gallery (its glass glowing by night through the pool's emission mask), spars, iron, canvas, rope,
  gilt, the hatch gratings, the shutters' red, the doors, the beams - registered as stand-ins of archive 38131 on the
  vendor texture door, so a loose pack's `38131_<record>-0.png` would override one as it overrides any record. No file,
  no ARENA2 pixel.
- The mod's own small things are copied out of its galleon and stood in her, each clear of her (AUDIT GALLEON P3, P5,
  P12): the anchor, weighed and let go, along her bow's flare outside her planking (it stood 1.6 m into her); her cargo
  and its trigger; the stove, its flue carried to 0.14 m under her deckhead as the mod's is; the bed in the great cabin
  0.262 over her deck, the mod's galleon's own; the lantern poles on her stern rail's cap (they stood buried in it) and
  the hooks; her colours over the crow's nest, its masthead capped and its floor's underside built. Her six crew posts
  (the officer and the coxswain on the castle's roof by the wheel, the boatswain and the quartermaster on her main deck,
  the master-at-arms and the cook below). Her board triggers stand outside her side (P4: they reached into her gun
  deck), and her stair wells and the cabin's casings wear her inner planking (P7).
- **The loader never traps** (`loadComeSailAwayModels`): her model fetched beside the mod's five files
  (`GALLEON_MODEL_URL`, never among them - AUDIT GN2-PF4: it had been asked only once they answered), and built once a
  process (her bake's sha256, the same bake and mod tree - a second world's loader 0.8 ms, not 100-340); missing, or one that will not build, hull 2 is the mod's own galleon, said
  once.

**Her deck** (`systems/naval/navalDeck.js`, `systems/naval/crewLife.js`). Her castle's roof is her deck, up its two
flights - each 1.4 m wide between its well's walls, its treads 0.385 m on 0.25 m risers: four of its fourteen gaps
between two cells' centres cross two risers (0.51 m, over the motors' step), so each flight is cut three times, and the
inset leaves a cell clear in the port well and two in the starboard. So a flight finer than a cell joins over the tread
between (`linked`: a floor at the midpoint of the side two cells share, a step from each, within `FLIGHT_JOIN`), and a
raised deck the inset parted from her open deck keeps every way up to it a cell wide (`keepFlights`) - the Carrack's
forecastle up its stair joined with hers. The well's ramp under each flight is no collider of hers (it rose 2.3 cm
through the top tread). Her hands work her main deck (`spots(n, level)`; AUDIT GALLEON D10: an idle hand goes back down
to it, and a talk's place is on it), her officer and her coxswain stand at their posts on the castle (a flat on a raised
deck a station), the crew's hatch post stands beside her fore hatchway (D7: the hatchways themselves are no deck - their
covers open), and a boarding's musters stand on her main deck (T4); her castle is the walk's, up either flight - a
boarder can reach the helm. The leash keeps a body on the piece it stood on (D1: the port flight dropped boarders into
the great cabin, 192 of 1275 times), a landing comes down across from where it came from (D2), and her lookout keeps her
main deck's bow (D4).

**What it moved elsewhere.** Her guns are five a side where the mod's galleon had six, so every hull-2 class is a sixth
lighter at the guns: a wary brig outguns no sound armed boat of the player's now (a crewless Large Galley 1.10 to one; a
Small Ship hurt to four fifths and alone at her guns, 1.37), and the navy cutter's odds on the corsair galley fell to
1.23 (fought four to four). Her low gun deck (1.08 m over the sea) brought the aboard reach to a step under her main
deck, every hull's (`scenes/navalHost.js standsOn`: under it a capsule's reach of the feet - AUDIT GALLEON D3); her
canvas aback in the wind's eye drives her astern, so the in-irons tell reads her way ahead
(`systems/comeSailAway.js inIrons`); her narrower hull lies closer in to a boat she boards, so a boarding comes in on a
sounded berth unswung by the lookout and sounds the berth as wide as its legs (`systems/naval/navalAI.js boardCourse`,
`berthOpen`).

Pins: `test/galleon_model.test.js` (13, GALLEON-2's two among them); the naval suites' PIN MOVED rows (`test/auditnav2_deck.test.js`,
`auditnav2_crew`, `auditnav2_captains`, `auditnav2_helm`, `auditnav2_online`, `auditwatchkit_crew`, `deckwalk`,
`livingcrew`, `nav_a_guns`, `nav_h_host`, `navaudit_captains`, `navaudit_guns`, `navaudit_helm`,
`navaudit_presentation`, `fb1001b_peerboats`, `seapeace`); `test/csaScene.mjs` builds hull 2 on her as the game does.
`tools/mutants/galleon.json` (25, all dead) and the naval lists' GALLEON records, all dead. Drawn offline with a
scratch rasterizer over the real prefab and art (her livery, the castle and the stern gallery, the wheel, her sails
stowed, set and trimmed, the hatches and shutters open, the guns run out, the gun deck and the cabin from inside); not
seen in a browser.

### Her second model, and her pictures at 64 (GALLEON-2, 2026-10-02 - OURS)

Mac, sending `New_Ship_Even_EVEN_newer.fbx`: *"Replace it with this updated model and also textures should be 64x64."*

**The model.** Committed over `New_Ship.fbx` and read against the first, part for part (`tools/bakeGalleon.mjs`'s
header): the ship stands 36.25 m along the scene's Y now (`FRAME.centreline` - the hull object's own scene Y,
36.24673828125 to the bit, AUDIT GN-B6 - is taken off as the waterline and the midship are); her hull is new on both
sides of the wale - a deeper V on a keel 4.64 m under the sea where the first's was 3.89 (1.08 m lower in the scene),
the wale's forward corners drawn in from 8.37 m to 7.48 m off her centreline, a finer entry and a forefoot swept up to
the stem (95 faces where it was 87); six deck beams carry her main deck over the gun deck (`deckBeam`, six objects of
one role); and every other part stands where the first's did to 3 µm in her frame - her decks, ports, castle, stairs,
masts, hatch covers and shutter (cut as Blender cuts them since AUDIT GN-B1). The scene keeps a twin of most parts
standing in the same place (a Shift+D never moved), skipped and checked vertex for vertex against the part it twins
(`SKIP` `twin`), and, far along Y (`minY`), the first export's ship joined into one object with its fore hatch cover, a
hull between the two exports with her parts and beams, her current parts joined twice over, and a spare aft cover, fore
cover and gunport lid.

**Her beams** are one node (`DeckBeams`), solid, in her oak with the grain along each (`MEASURED.beams`: 0.775 m fore
and aft, their feet 5.22 m over the sea, their heads in the deck); none crosses a hatchway or a mast, and each companion
passes under them a man's height clear. Her main deck's underside wears its planks alone now (`underDeck`) - the
painted beams a metre apart stood in for the ones Mac has modelled, and stay only over the great cabin, where none of
his stand. The gun deck's three lanterns hang from the second, third and fifth beams.

**What the deeper hull moved.** HULL_BUILDS' Small Ship's keel is -4.64 (her box's floor - what a gun lays between to
strike her). Two pins took their probes deeper: AUDIT NAV2 F36's swimmer under her keel (the floor inside her V lies
within a step of -4.6; it is asked at -5.4) and FIELD BUGS 2026-09-29's frozen fish (from 2.5 m down its ray stopped
17 cm short of her bottom; it hangs at 3 m). Nothing else moved.

**Her pictures at 64** (`world/galleonArt.js`, `GALLEON_TEX_SIZE`). Every picture is 64 x 64, Daggerfall's own texture's
size. The tiling ones were that or smaller - the smaller are painted at 64: the spar's, the iron's and the gilt's tiles
doubled with them (the same texel over a face, halved round a prism), the rope's left as it was (64 texels round, where
it had 16), and the dark's (record 16) repainted as each port's throat, oxblood planks at [2, 2] (AUDIT GALLEON R8/R11:
worn by nothing, while the throats wore the shutter's picture); the whole-face ones (a sail's canvas, a door, a gunport
lid) are painted at 64 over their face. The three liveries that ran one picture keel to rail - the hull's side (64 x
256), the castle's and the stern's (64 x 128) - are painted as before and cut into 64-row slices by height (`BANDS`):
the hull's side four slices of 2.9 m (`HULL_SIDE_Y0` down to -4.2 for her new forefoot), the castle's and the stern's
two of 3.3 m, each slice a record of its own. Every face of a part a livery lies on is cut at its slices' heights,
banded or not (`world/galleonModel.js slabs`, `bandPiece` - AUDIT GALLEON R14: cutting the banded faces alone left 28
T-junctions at her ports and wells), every piece on the slice that holds it with its v that height up the slice - so the
bands run round her as they did, at the density they had (her side's texels 4.4 x 4.5 cm, the castle's 4.1 x 5.2); every
face lit flat on its polygon's own normal, as Blender draws it (B1); the stern's glass glows through both its slices.
Twenty-three records: the seventeen, the five lower slices and the deck's underside.

Pins: `test/galleon_model.test.js` THE BAKE (the six beams, the twins and stations skipped, her centreline), HER PARTS
FACE OUT (the open-topped beams face by face), HER DECK BEAMS, HER PICTURES (each 64 x 64), HER LIVERY IN SLICES;
`tools/mutants/galleon.json`'s GALLEON2 records. Drawn offline again, not seen in a browser.

### Main merged in, and HOLDINGS on her (GALLEON-HOLDINGS, 2026-10-04 - OURS)

The arc reached main by a pull request of its own, never opened before: it lived on
`claude/enhanced-ai-feedback-ygvvj6` (TACT5's branch, #544, reused), and main had moved 324 commits past it
(#547-#584). The merge: 85 files and 163 hunks, 143 of them cites alone - taken at main's line, then
`tools/citeMerge.mjs origin/main 39b19e07b --apply --struck` (211 moved; 22 struck rows both sides carry word for
word left as they stand, no gate reading them). The twenty real hunks kept both sides:

- **TOUGHER-SHIPS** (#549) toughens her as every hull: `tough(420)` and `tough(160)` on her build and on the mod's
  galleon kept as her stand-in (`MOD_SMALL_SHIP_BUILD`) alike - 672 / 256 - and `firstBuildOf` reads the build that
  stands.
- **HOLDINGS**' crew posts: a hand off her main deck walks back down first (AUDIT GN-D10), then keeps his post; a man
  at his post is no man to talk to. The posts' extent fell back on the whole deck's `ext`, which this arc renamed to her
  main deck's `mainExt` - that is what it reads.
- `navalWire.js` carries this arc's laid broadsides (`g`) beside QUAYS' `w`; both F24 station pins stand.

**HER GANGWAY** (`quays.js` `gangwaySide`). QUAYS measured where a gangway meets the Small Ship off the mod's galleon
(`[7.65, 4.14]`), and the merge left Mac's galleon's plank there: its head 2.3 m off her side and 2.6 m under her main
deck, hanging over the quay. Read off her own colliders, her waist's bulwark stands 5.33 m out to some 6.9 m up, her
entry port open in it from z -0.5 to 1.5 over 6.25 m; her main deck is 6.20 m up. So her `GANGWAY_SIDE` is
`[5.45, 6.7]` - 0.12 m off her side, half a metre over her main deck as the Carrack's and the galley's are - and
`gangwaySide(hull)` answers the mod's galleon's (`MOD_SMALL_SHIP_GANGWAY`) while hers is the build that stands (AUDIT
GN-G4); `navalHost.js` `gangwayOf` reads it. A plank from 6.7 m wants 8.8 m of quay to climb at GANGWAY_SLOPE, and a
quay is 4.5 m deep: hers stops GANGWAY_BACK short of its back, as `gangwayFoot` always had it, and climbs 47.3 degrees
over 6.94 m (the Carrack's 30 over 5.08). AUDIT HOLDINGS Q1 and QUAYS THE GANGWAY, which held every ship's at 30, are
PIN MOVED to that stop; QUAYS ALONGSIDE, which held the Small Ship at the berth's point as wide as the Carrack, to hers
2.57 m in (5.86 m a side to 8.43) and the mod's galleon at it. Steeper than any plank but the Rowboat's (49, down): a
deeper quay where she berths, or a stair at her side, is the decision it leaves.

**HER CARPENTER** (`crewLife.js` `rolePosts`). HOLDINGS stands him 1.1 m to starboard of her hatch; hers stands to port
of her open fore hatchway (AUDIT GN-D7), so the post asked in the hole found her deck across it, 3.5 m off (CREW-ROLES'
"by her hatch" failed on the merge). Where her deck lies to port of the hatch and not to starboard he stands to port,
facing it; on every other hull his post is where HOLDINGS put it.

Pins: `test/galleonholdings.test.js` (4) - every docking hull's head within 0.25 m of her side at her main deck, a
ship's half a metre over it (the mod's galleon's numbers on hers fail by 2.3 m); hers in her entry port, her bulwark
either side; the host's plank from the build that stands; the Carpenter on all four hulls with a deck.
`tools/mutants/galleonholdings.json` (13, all dead). Measured over Come Sail Away's real pool; not seen in a browser.

## A foe in the water reaches no one aboard (WATER-FOES, 2026-10-04 - DEPARTURE)

From the field: "Enemies in the water on a boat shouldn't slow down your ship or prevent you from resting when on
board." Every "enemies nearby" the port asks is GameManager.AreEnemiesNearby (`systems/encounters.js`
`areEnemiesNearby`): a hostile foe that sees the player, or stands in the classic spawn band - and outdoors that band has
no height test (`enemyMotor.js` wouldBeSpawnedInClassic: 102.4 m flat). Deep Waters' foes are the street's
(`exteriorFoes`), so a slaughterfish or a dreugh anywhere under the sea within it put the helm's time scale back to one
and refused a step up ("There are enemies nearby...", above), stopped a Travel Options journey, slowed the Overworld's
travel (OW6's threats), refused the travel view, a camp's placing and every rest aboard - though no foe in the water
comes up onto a deck (Deep Waters even freezes its swimmers while the player is on a boat). The hull's own sweep never
met them (`csaSphereCastAll` returns no entity): the "slowdown" was these gates.

So the world host latches each foe's reach every exterior frame, once the street's foes, its watch and its raids have
had their frame (`systems/foeReach.js` `markFoeReach`): ABOARD - `playerAfloat` (a helm, a deck, another player's boat, a sea ship's deck)
and not swimming - a foe IN THE WATER (an aquatic one, EnemyMotor's `swims`, or one whose controller centre stands under
the sea's top, `tvSeaY`) is `ai.unreachable`; else none is. `areEnemiesNearby` passes an unreachable foe over, strict
and resting alike, so the one sweep answers the time scale, rest and its channel, a journey, the travel view, fast
travel and a camp the same; the Overworld's threats (`travelThreat`'s list) skip it too. A boarder on her deck, a foe on
the shore, and every foe while the player swims count as before. A departure: the mod asks AreEnemiesNearby(false,
false) at its helm as ashore (Port-Ledger A, WATER-FOES). THE FOUR HOSTS: `scenes/world.js` latches it; a building
(`worldModes.js`, a ship's cabin included) has no foe in the water, a dungeon's (`dungeonContext.js`) flooded halls carry
no boat of the port's rest gate yet - FLAGGED - and the standalone street (`exterior.js`) no sea. `test/waterfoes.test.js`.

## A camp on her deck rides her (DECK-CAMP, 2026-10-04 - OURS)

From the field: "Campfires placed on a boat dont attach to a boat." A Campfire or a tent placed on a boat's deck carries
her number and its point in her deck's frame, and is posed off her every frame - hidden with her, packed back into its
owner's pack once she is gone, saved and said on the wire by its place on her. The whole law is the Rest arc's
(`06-Systems/Rest-Arc.md`, As built, DECK-CAMP); the seams here are `world.js campDeckAt` (the boat under a spot, off
her collider bucket) and `campDeckResolve` (where she is now), and `comeSailAwayPeers.js hasBoat` (whether another
player's word still names her).

## What was already waiting in the port

- Iliac Puddle No More's swim stands down on a boat
  (`world/deepWaterSwim.js` `isBoatEffectBundle`): the mod's effect bundle
  is "I'm On A Boat", and that literal is in the assembly's heap.
- Eye of the Beholder's boat camera (`CameraOverrideBoat.*`,
  `player/eotbCamera.js`) read a `sailing` state, and its
  `OnUpdateSailing` hook was a row of `test/eotb_scope.test.js` waiting for
  this mod; CSA-J ported it (The close, above).
- Item templates 1320 and 1321 are free.

## Tests

`test/csa_registration.test.js` (5): the manifest and the assembly's
hash; every shipped key declared as shipped, in order, and nothing more;
the three unread keys off the assembly's string heap; the item templates
as DFU's parser reads them; the Features row, the credit and the lane.
`test/csa_audio.test.js` (4): the setup headers to their CRC32s and mode
tables, a cut or unframed one refused; an FSB5 bank read field by field;
the pages, flags and granules of a synthetic bank's remux (clamped and
not); the five vendored streams page by page. `test/csa_textures.test.js`
(7): what is carried and what is not, the own pictures, the waves'
specs and paints, the tiled rebuild and its scroll, the block search's
rules, the indexed PNG; with the ARENA2 the frames rebuilt from the
player's own snow (and with `CSA_BUNDLE` compared with the bundle's).
`test/csa_models.test.js` (9): the twelve prefabs and the names the C# walks;
every component index and pointer lands; every mesh reads back inside its
box; the animation's clips, overrides, curves and bindings, with the six
that resolve nowhere named; the path hash against the bundle's own; the
mesh and clip decoders and the prefab walk on hand-built input; with
`CSA_BUNDLE` the tool's models equal the vendored files byte for byte.
`tools/mutants/csa.json`: 34 mutants, all dead.

`test/csa_boats.test.js` (13): the Transform rules on hand-built trees
(the chain, active in hierarchy, the active-only depth-first search and
its plural, the two SetParents and the diagonal rule, the pointer by
path); an instance's own components; a mesh to the port's shape (the
baseVertex, the normal's fourth lane, the bind pose's columns); the
materials (the carrack mast's two RuntimeMaterials, an index past the
slots, the texture names, Unity's pairing, the galleon's anchor); every
shown renderer Daggerfall-textured but the water masks; SpawnBoat on all
five hulls against expectations worked out from the prefab tree alone
(the modifiers, the sails and their six lists, booms, lanterns,
triggers, effects, the nodes off the collider's box, the loops'
distances, the stow request); the variants and SetBoatVariant; the
helpers and SetLights; the trigger boxes (the door's, the board's scale,
the player's kept turn); the fresh child count; ApplyGameTextures and
FixDeformations on every walked sail; the ARENA2 each hull needs.
`test/csa_sails.test.js` (4): the timer; BakeMesh and RecalculateNormals
on hand-built input; the imported normals' orientation; every vendored
sail against Unity's own `m_AABB` and shown where its skinned renderer
would draw it. `test/csa_pool.test.js` (7): the active walk; the
lanterns' two behaviours; a spawned boat's draws over a recording
renderer (only the Daggerfall-textured renderers, their textures
uploaded opaque first); the sails' bakes on their timer; the flats and
the lights; files that will not load; and the renderer's two new doors
(`emissionOff`, `updateMeshVertices`) over a stub GL.
`tools/mutants/csa_boats.json`: 55 mutants, all dead.

`test/csa_placing.test.js` (17): a prefab's colliders (the active and
switched-on only, a box from outside, a mesh from both faces, a hull and
its refusals, a turned and scaled node's inverse) and a built skiff's
(the chosen variant, the switched-off Plane and flag cube, the two
convex doors' hulls round every vertex); Convert.ToInt32, Plane.Raycast,
the item message, GetTileMapIndexAtPosition's floats; the ray's five
arms one by one (the sea's slab and the downward ray, a deed's
reposition and its cargo, a dungeon's plane and its three refusals, the
terrain's water tile, the WaterLevel plane, the abort, the declared
refusal); the console; the visibility, the nodes and OnPositionUpdate
(FIELD-CSA1: every boat, in sight or not); the save written, restored and
held. FIELD-CSA1 (+3): the carved floor's hit floated (a swimmer's ray,
no surface, the vertical compensation), the sea plane held to the ray's
reach with the deed kept, and OnWorldReanchored (every boat carried by a
teleport's frame, hidden for the far pixel, the helm not asked). `tools/mutants/csa_placing.json`:
58 mutants, 57 dead and one equivalent as recorded (a negative 128th floored
rather than truncated clamps to the same first column) - FIELD-CSA1 re-aimed
five to the moved source and retired the one whose mutation is now the law;
its own fourteen are `tools/mutants/field_csa1.json`, all dead.

`test/field_csa2.test.js` (6): FIELD-CSA2 - the sampler's flat sea at the
drawn ground's 34.000001; Terrain.SampleHeight at Unity's precision (the
sea at step 579 under the line, a step up land, the port's rounding, any
ground within a step of the drawn one, the far ring's stride); world.js's
own `csaTerrainOf`, mounted from its source over a real StreamingWorldState
and a vertical recentre; the runtime over the vendored hulls with Iliac
Puddle No More on - all four hulls a shelf or parts give read the sea,
raise their sails and row - and the shore still land; with the ARENA2 the
open Bay south of Daggerfall the live probe sailed (209, 216): the deed's
port found by world.js's own `csaIsPortTown`, the Small Ship's nodes on the
Bay and its sail raised, the coast's first rise (208, 215) land. Four of
the six red before the fix.
`tools/mutants/field_csa2.json`: 11 mutants, all dead; CSA-J's clamp pin and
its record re-aimed to the new call, by content.

`test/csa_sailing.test.js` (24): Unity's arithmetic in its floats;
StartSailing and the borrowed ship; rowing (the pin, the freeze, the
climb to moveSpeed, the carry, the oars' fatigue, the coast); the turns,
the reversed helm, the strafe and the nodes asked one along; the two
sweeps and their filters and the zero point; the push off and the
refused turn; the beach; the cargo's weight and the Carrack's nought
and NaN; StopSailingDelayed's three phases and StopSailing's events; the
lantern key; the seven activations; the riders; the save at the helm;
the origin; the pause gates; and the shared pieces - the collider's
sphereCastAll, the motor's pin and autorun latch, the race's boat family;
and the finer laws each a mutant found (the galleon's own oars, the turn's
cap, the crewed ship's free oars and the left turn's, the helm's pin, the
walk of inputCurrent, the CanTurnRight quadrant behind, a three-node
float, the horse's and cart's switches, a negative MoveTowards).
`tools/mutants/csa_sailing.json`: 84 mutants, all dead. CSA-K and CSA-L
added four (28): the pack refused with a passenger aboard (and the driver's
refusal first); helmMotion (the world way, the turn, none ashore or beached);
helmPanelState (none ashore, the trim's owner, the square sails, the time);
and the laws another's boat shares with mine, one export each (boardPlaceOf,
NICE_BOAT_TEXT, turnDoor's clip, carriedPoint and yawDelta).

`test/csa_animator.test.js` (17): the binding hash; the curves (a
constant, a streamed segment - a linear one and a step at its own key
included - and dense samples); a clip's time; Quaternion.Euler's order;
the two blend trees' weights; the pose blend; the bindings and write
defaults; CrossFade (its next-update take, its duration against the
source, a playing state left, a running fade frozen); a controller
transition (its conditions, its exit time on every loop and across one
long frame, a fixed duration in seconds); a speed parameter; disable and
enable; an override's swap; and on the vendored data every hull's
Animators bound, every sail Stowed, a lateen raised and the rudder rowing
into Sailing. `test/csa_wind.test.js` (19): Unity's angles and
RotateTowards; UpdateWind and RotateWind; the three events; GetSailPower
for every kind; raising, lowering and the square sails' assist; the
sails' key and its modifier; the sail arm; the trim, auto and by hand;
the widget's frame and rect; the sails at the helm's edges and on load;
the rudder's and the door's Animators. `tools/mutants/csa_wind.json`:
127 mutants, all dead.

`test/csa_waves.test.js` (18): land at once, no ray cast, and the
object's stand; the first loop's rays (their origins, order and reach,
the metre over the sea); the neighbour rays from the origin's 500
(kept); a side's fan and the small corners, and the same pieces a pixel
off the player's; a corner's two pieces and its wide one; the current
off the last water pixel's neighbours (kept); the material as the tool
carried it, and the one the assembly loads by name; the 32 frames'
specs; LoadSettings' numbers; the frame step; the wave shader's
arithmetic; the Bayer table's ranks and values (and with `CSA_BUNDLE`
the bundle's own); the frame composed where it is sampled, texel for
texel against composeTiledPicture; UpdateWaveMesh's gate and the kept
neighbours of an empty rebuild; the four events (the teleport's
WaitForSeconds); Update's step; FixedUpdate's current with and without a
coast, its quarter lines at Unity's floats. `test/csa_particles.test.js`
(9): AnimationCurve.Evaluate and MinMaxCurve's modes; an instance's
systems and their links; Play and Stop with the children; rate over
distance; Local scaling (the size, and the Box's volume); the drops (the
zero-scale Box, the Plane, the splash); a burst and a duration; a world
force and a local system; the flag's Mesh particles.
`test/csa_effects.test.js` (10): a placed boat's slow loop; the wake arm
(StartSailing's stop, both loops played by the crossfade, the scaled
life, the threshold itself, PlaySlow stopping the fast loop); slowing,
and a crossfade dropped; StopSailing; OnPositionUpdate's stop and carry
(the rudder's splashes left, kept); the bob (the roll unscaled, kept);
the flag; RotateWind's rain and snow; the systems stepped at LateUpdate's
head and a paused frame; the particles' materials and the soft dot.
`tools/mutants/csa_waves.json`: 127 mutants, all dead.

`test/csa_time_audio.test.js` (15): the helm's three time keys (the
walk up to the fifth step and down to the first, reset, each step's
Time.timeScale and its message for three times the scale of game
seconds); IncreaseTimeScale's refusal with enemies near and the helm's
unsaid put-back; Update's unpause reset and Travel Options' answer (no
mod, no answer; TRAVEL-X1: a journey begun in the pause keeps its scale); the Animator's clip events (once a loop, weighed above
nought, a fresh state's time 0, a clip that does not loop, every
answering component); the Rowboat's and the Trireme's oar events through
the rudder's listener - their times in the stroke, the splashes' start
delays, only the Galley heard and only at the first scale; a particle
system's startDelay; the sails' and the door's DFU clips; the two loops
as Unity keeps them and UpdateAudioSource; the HUD's two message clocks
in game time; Unity's rolloff and a plain source's gain over the bus;
the boat's bed (the two hulls that carry one, the name's lookup, the
host's pick and arm, the modes' rest door); the borrowed ship's scenes
through the lazy scene cache. `tools/mutants/csa_time.json`: 55 mutants,
all dead.

`test/csa_items.test.js` (11): the two rows against the bundle's file
(its trailing comma as DFU's parser reads it), neither stacking, the mint
off the row with the host's UID; GetCustomItemsForGroup answering both
after Roleplay Realism's rows while the mod is loaded, Iliac Puddle No
More's fish while it is on, the duplicate guard; AssignVariantsToShopItems
and the shelf's two given a UID; IsNearPort's square (range 3 and 1, centred since DEED-PORT);
PackBoat (the parts to the back, the cargo under the parts' UID, a UID
already keyed throwing, the boat gone); the cargo box (its loot target
read by the pack's own remoteTarget: the hold itself, live, the
Merchant's picture) and the variant picker (never at the helm, the two
refusals, the pick's sound, pop and SetBoatVariant); `giveboat`'s four arms and its two ranges; both
UseItems' refusals, closes and placing; the host's seams; the shelf's
custom loop stocking both. `tools/mutants/csa_items.json`: 63 mutants, all
dead.

`test/csa_map.test.js` (12): record 3 rebuilt from TRAV0I00.IMG and the
line texture's record; the map's rect (off the screen at ScalingMode 1:
kept), the mouse, the pixel under it, Rect.Contains's and
Bounds.Contains's edges; the marker colours, the day's suffix, the label,
Single.ToString(); OnGUI's draws in order, the blink, the scaled cross,
the outlines and Left Shift's noughts, the labels within range on the raw
thickness; the position box's coroutine through the boxes, the reading
and the map, the pause every frame, the restrictions and their settings,
the number row, the two buttons, Escape's release and the second of game
time; the debug values; the water walk (the column, the box with Iliac
Puddle No More, an inactive boat, a paused frame, a bundle already live,
"Jesus Mode", a spell's walk left); WaterWalkingSilent on the effect
list; the host's seams. `tools/mutants/csa_map.json`: 95 mutants, all
dead.

`test/csa_close.test.js` (15): MessageReceiver (the two vectors as copies,
the three events subscribed by a function and by nothing else,
IsPlayerSailing, an unknown message's error in Unity's name; ResetTimeScale's
line, StopSailing the delayed stop, the boat's two objects and the kept
NullReferenceException); Eye of the Beholder's OnUpdateSailing on every
hull, one camera over two sails, the child walk's stop and its first-found
rule, ModCompatibilityChecking's arm and a new boot's fields, the camera's
boat target and its kept floor, the sprite's heading, the hosts' seams;
the two mods the port does not carry, null in code; and the audit's fixes
(OnPostFastTravel, the Transport press, every mode's death and collapse,
the oars' fatigue door, the indoor axes, a new game's wind, the half-built
hull, the load's doors, a load that lands elsewhere, the models before the
mod loop, a load held as a pause, the switch read once, a rider's hull, a
terrain's edge). `test/csa_online.test.js` (6): my word (its fields and
their rounding, eight at most, none a null); a peer's word through the
door; the peer list (built, posed off the word, never in `boats`; the
sails, crew and lanterns); the owner law (gone, stale, a clear, the mod
off, the origin's shift); a word before the models; the hosts' seams.
`test/eotb_camera.test.js` drives the arm order through the real path,
and `test/eotb_scope.test.js`'s two rows are ported.
`tools/mutants/csa_close.json`: 126 mutants, all dead.

`test/csa_together.test.js` (20, CSA-K and CSA-L): the way on the wire (its
conversion, a turn alone, none moored, the key) and through the door; the
readers' lead (an even speed, the cap, no way, the turn) and each frame's
pose kept (moveOf, a snap, the peek); aboard by landing (never off a pier,
from the water or a boat past reach); carried (the helm's child's law, the
turn, the word, in the air); every way off; the ladder and its grace; the
others aboard (the door, the glue, the ease, the owner law, the count); the
ray on another's boat (the ladder's box, the bare hull); the host (the deck in
my collider alone, the frame's order, the carry, the gate; the `ab` word
mounted with the foes stream, the receiver, the glue, the owner's boat a
frame ahead; the press, the ladder, the plaque, the pack guard); the motor's
carry; the helm's buttons; the panel on a page; the Plus dress; the pad's
gestures and prompts; the pad layer at the helm; the host's helm seam,
mounted. `tools/mutants/csa_together.json`: 93 mutants, all dead.
