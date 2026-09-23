# project-dagger

**Daggerfall Enhanced** - an open-source reimplementation of The Elder Scrolls II: Daggerfall (BR1, 2026-09-13; the public name was DAGGERFALL JAVASCRIPT from U60 until then). A 1:1 port, built the way we build: hand-rolled WebGL2, Vite, Node ESM, no framework. Data layer and game logic ported faithfully from Daggerfall Unity's reverse-engineered C#; presentation rebuilt on our stack; characters rebuilt on our voxel system.

Read `01-Overview/Port-Doctrine.md` before touching anything.

## Process

Doc edits are part of the change: every scripted bible edit must ASSERT
the needle matched (a silent `.replace` no-op shipped a stale
Rendering.md queue in the M6 audit and was only caught in the M7 audit).
Verify doc diffs in `git diff` before committing, same as code.
Sprite-orientation checks must compare close-up render crops against
the raw record art - a distant screenshot passed a vertically flipped
billboard shader for six milestones (caught by Mac after M8).
Playwright probes of the live frame loop must frame-sync on the
shot-mode __frame counter, never sleep - SwiftShader renders the
streaming scene at seconds per frame, so sleeps sample stale state
(M9 audit probe initially reported zero crossings for a real flight).
Unity asset values (prefab lights, AnimationCurve keys) are groundable
without widening the sparse clone: git show HEAD:Assets/Prefabs/....prefab
reads the YAML from the object store (used to verify the R5 constants).
When a renderer change diffs against a baseline and theory stalls,
build a screen-projection ground-truth probe: rebuild the scene's data
+ exact camera in Node, project known world points to screen, and read
the framebuffer pixels - single far pixels are rounding-limited, so
verify laws on NEAR tiles (a shot-mode override hook can force test
bytes). The R9 HLSL-row-major/GLSL-column-major transpose was only
provable this way. But probes verify what they sample: R9 initially
shipped with every building missing because the probes only ever read
terrain fragments - when a diff spans a large frame fraction, check
full-frame composition (every draw pass still present?) before
explaining the diff away. Draw entry points must own their program
binding; interleaving a new pass exposed drawMesh's assumption.
DO NOT FIX WHILE THE VERIFIER IS READING (17l). An adversarial
review reads the WORKING TREE. Fixing its findings while its
verify pass is still running makes every verdict come back
"refuted - the code you quote does not exist", which is
indistinguishable from "the finding was wrong". 17l's eighteen
verdicts all landed that way and had to be re-read by hand to
tell the two apart (one of them says outright that the DFU
reading was accurate). Either let the verify pass finish before
touching the tree, or hand the verifiers a snapshot.

THE FOUR HOSTS RULE (17e). Four files own a motor:
scenes/exterior.js, scenes/world.js, scenes/worldModes.js
(interiors), scenes/dungeonContext.js. A slice wiring a seam into
one must NAME ALL FOUR in its record - each either wired or FLAGGED
by name. U8h enumerated "both exterior hosts" and flagged the
dungeon; the interior host owns a fourth weapon rig and went
unmentioned, so buildings still swing the interim dagger. The same
omission produced the missing FOV gate and the unshifted guards in
?world.

THE MODAL CONTRACT (17e). A function whose return value gates a
host frame must return the same type from EVERY exit. One branch of
ten in worldModes.frame() returned undefined; the hosts read that
as "not handled" and ran a whole exterior frame on top of the
dungeon. Assert the contract in a test, not a comment.

ONE DFU MEMBER, ONE EXPORT (17e; restated after U8f's near-miss and
violated by the very next slice). Before porting a DFU class or
method, grep the tree for its name AND its constants. U8h rebuilt
GetMaterialArmorValue in systems/equip.js and drifted; droppedLoot.js
re-declared the treasure table the 2026-07-06b audit had already
single-sourced. If two files legitimately need it, one exports and
the other imports - never two literals.

A PIN MUST FAIL (17e). Every assertion claiming to pin a DFU law
must fail under a one-character mutation of that law. Three shipped
pins did not: `assert.ok(bows >= 8)` survives promoting any weapon
to two-handed; `Math.trunc((100-55)/5) === 9` touches no port code;
and `ANSWERS_TO_DIRECTIONS[15] === 7261` certified the WRONG table
and would have blocked its own fix. Prefer deepEqual against DFU
literals over spot checks and inequalities, and mutation-check new
pins.

TEST THE SHAPE THE PRODUCER MINTS (17e). A test that hand-builds an
item/entity literal can pass while nothing in the running game
satisfies it. Three suites asserted on `{ enchanted: true }` - a
property no producer writes - so the enchanted paths were dead in
the shipping game and green in CI. Build fixtures from the real
producer, or assert the producer's own output.

THE SLOT IS EMPTIED BEFORE THE OCCUPANT IS TOLD (from play,
2026-08-29). A host slot that holds ONE thing - an overlay, a
context, a live window - must be nulled BEFORE the thing in it is
disposed, closed or notified, because a teardown runs the
occupant's code and the occupant may ask the host to clear the
slot. townTalk disposed first and cleared after, S40 had opened a
door for exactly that callback (DFU's PopToHUD before
RaiseSkills), and the re-entrant close read a slot still pointing
at the window being disposed: fifty frames of
closeOverlay -> onClose -> _close -> dispose -> closeOverlay, on
EVERY close path of the rest window, off the live site. Clearing
first makes the re-entrant call answer with the truth - the slot
IS free - and it is the same law for a REPLACEMENT: put the
successor in the slot before telling the outgoing occupant, so
its identity guard sees the new one and leaves it alone. The
occupant owes the other half: a close that dispatches a callback
dispatches it ONCE, however many doors call it, so a window is
safe to close from either side and no future host has to know the
rule. Pin both halves against the other being broken, or the next
window finds the half nobody fixed.

ASYNC NEVER DROPS (17e). DFU is synchronous; where the port awaits,
a request arriving mid-flight must be COALESCED, never discarded.
refreshPaperDoll's boolean re-entrancy guard silently threw away
equip updates, leaving the doll and its click mask stale.

EVERY ALLOCATION HAS AN OWNER (17e). DFU relies on Destroy/GC; the
port does not. Every createBillboardBatch / uploadTexture needs a
matching free in the owning module's teardown, and that teardown
must be reachable from the path that ends the object's life.

RETIRING A FLAG DELETES THE SENTENCE (17e). When a slice closes an
INTERIM/FLAGGED site, remove the old sentence - do not append the
retiring one beneath it. The open-flags list is grep-regenerated
and lifts stale half-sentences out of their retiring context.

A SLICE CLOSES ITS LEDGER ROW (2026-08-19). Port-Ledger section C
is not a memo, it is a CLAIM that something is unported - so a
stale row is worse than a missing one: it sends the next slice off
to build what already ships. Before closing, grep section C for
the DFU members you touched and strike, narrow, or update every
row you moved. `node tools/ledgerSweep.mjs` narrows the read: it
cross-references each unstruck row against the arc docs' own
SHIPPED/CLOSED headings and against non-comment src/. Run against
the pre-sweep ledger it caught 2 of the 4, with 2 standing false
positives - A CLEAN RUN IS NOT PROOF. It missed the two that a
matcher structurally cannot catch: one where the port RENAMED the
member (MakeHouseContainer -> isHouseContainerModel) and one where
the closing slice used its own vocabulary. Those need the eye.
The failure mode is specific and it is NOT forgetfulness: all four
rows found stale in the 2026-08-19 sweep were closed by a slice in
a DIFFERENT arc from the row's Target column. P12 (Player) shipped
breath/drowning; Audio closed the transition stingers as verbatim
N/A; S2b and E2 (Systems) shipped two thirds of the interior
container row; S23/S24 moved five career flags from INERT to LIVE.
Every author updated their OWN arc doc and none thought to touch a
ledger row filed under someone else's. So the sweep is owned by the
slice, not by the arc - if you shipped a DFU member, the row naming
that member is yours to close no matter whose column it sits in.
NARROW, do not strike, when a slice ships part of a row: say what
landed and what is still open, or the next reader reads a partial
close as a whole one.

THE NATIVE-WINDOW RULE (from the 17d UI audit, after three
positioning hotfixes in two days): every drawn element of a native
window - rect, font, color, scale, alignment - must cite its DFU
source (file + member) before it ships; no free-styled geometry. If
the DFU value is unknown, the element does not draw until it is
looked up. And native-window screenshots are eyeballed against the
CLASSIC layout (the art's own frames are the ruler - an icon
crossing a baked slot border is a positioning bug even when the
code "looks right").

**THE ONE CONSTRUCTION SEAM** (AUDIT 17i). When two hosts build the
same object, every dependency it grows must be remembered twice - and
one of them will forget. The chargen flow proved it three times over
three audits. A shared thing gets ONE constructor that attaches
everything; hosts call it and never `new` it themselves, and where the
rule matters a test SWEEPS THE SOURCE to enforce it rather than
trusting the next author to recall it.

THE HISTORY WAS REWRITTEN ON 2026-08-27, before the repository went
public as daggerfall-js-source (Mac's call, with the MIT licence and
DFU's notice). Four paths that had once been committed and later
deleted still sat in every old commit - the classic BODY00I0 sprite
under src/characters/paint/, the AUDIT 21 gallery frames under
public/visual-changes/, and the two traced-silhouette JSONs under
src/characters/backs/ - and a public repository publishes its
history, not its tree. `git filter-repo` removed those paths from
every commit on every ref; 1,420 commits changed sha. Every sha this
bible cited was rewritten to its new value from the commit map (36
of them; the map itself is NOT committed - it is a list of the old
shas, which is the one thing that must not be published). The
previous repository was kept private under another name. If a sha
cited anywhere fails to resolve, that is why, and Mac holds the map.

## Sections

- `01-Overview/` - vision, port doctrine, phase plan, Port-Ledger (departures/quirks/unported)
- `02-Formats/` - binary format readers (BSA, TEXTURE, IMG/CIF, ARCH3D, BLOCKS, MAPS, SND, SKY)
- `03-World/` - block assembly, terrain, location layout, streaming
- `04-Characters/` - voxel rigs, paperdoll-as-outfits, NPCs
- `05-Combat/` - FormulaHelper port, weapons, hit resolution
- `06-Systems/` - quests, items, magic, guilds, calendar, save format
- `07-Rendering/` - WebGL2 renderer, palettes, lighting, sky
- `08-Audio/` - music (HMI/XMI), sound effects, audio state machine
- `09-Testing/` - test doctrine, harnesses, data validation
- `10-UI/` - HUD, menus, native Daggerfall UI reproduction
- `11-Multiplayer/` - co-op: the three locked decisions, the architecture, the arc (the design the ONLINE arc grows into - presence, then chat, then the room's memory (WORLD1), then the room's simulation (WORLD2), then the room's events (WORLD3), then the room's loot (WORLD4) - `06-Systems/Online-Arc.md`)
- `01-Overview/Active-Arcs.md` - ACTIVE ARCS, one line per arc, each naming its own page (HARD5, 2026-09-15: moved out of this file, which was 291 KB)
- `01-Overview/Audit-Log.md` - THE AUDIT LOG, newest first: every audit that has no page of its own (HARD5, same move)
- `06-Systems/Morrowind-Assets.md` - THE MORROWIND ASSET LAYER's own page (opened by MW-LOAD, 2026-09-08, Mac: "improve the load time when Morrowind assets are enabled"): the load path from attach to the built arm, the measurements (a 300 MB archive cloned whole out of IndexedDB is 1-3 s; as a Blob its directory is 5 ms and an entry 1 ms), and the fix - archives stored as Blobs and opened by range, entries loaded when a reader needs them, the arm reporting its stage timings.
- `06-Systems/Weapon-Sheathing.md` - WEAPON SHEATHING (WS1, 2026-09-17, Mac: "Can we implement this for the morrowind model") - Greatness7's Weapon Sheathing 1.6: the seventy-one scabbards and three skeleton addons vendored (credit and no fee, the mod's own permission), the OpenMW mechanism ported for the port's Morrowind third-person body - the addon's thirteen marked bones injected into the skeleton under their addon parent's name, the sheathed weapon at its type's sheathing bone in its scabbard (shown while the hand is empty, the scabbard always), a quiver of the pack's arrows on a bow; `?` none - the Features row `mod-weapon-sheathing`, on by default. AUDITED (AUDIT-WS, same day) against the OpenMW source fetched at 0.48: six findings fixed (the one-handed axe's bone, injection by the BONE marker, thrown weapons, the round on the string, bare holstered meshes, the eager asset table). Not seen on a GPU here.
- `03-World/Windmills.md` - WINDMILLS OF DAGGERFALL, Kamer's mod, 1:1 with permission - the page the WM1-WM4c arc (World-Arc.md) never had, written by the MODS AUDIT of 2026-09-08: the law table against his archive, the seams, the rotor re-anchored on the wind model's fair day, four items recorded (the roller's node matrix, his AutoMapData edit - the mill is not on the automap and NPCs walk through it, the building bound, the interior file's header counts - an open question for Mac, who has the rar).
- `03-World/Roads.md` - roads and tracks: HIS DATA, 1:1 with permission (2026-09-02) - Basic Roads' four arrays vendored in `vendor/roads-hazelnut/` and credited - with OUR network from the player's own map as the fallback. Always on in both lanes; Port-Ledger section A carries the row
- `07-Rendering/Dynamic-Skies.md` - DYNAMIC SKIES, 1:1 WITH PERMISSION (DS1, 2026-09-04, Mac: "implement this mod 1:1... compatible with our current implementation") - BadLuckBurt and carademono's Dynamic Skies 2.3.4 vendored in `vendor/dynamic-skies/` (presets, fog, light curve, the textures the presets name, the shader sources) and credited; `BLBSkybox.cs` ported to `systems/dynamicSkies.js` + `dynamicSkiesRuntime.js` with its quirks kept, the shader to `render/dynamicSkiesRenderer.js` line for line (linear colour space, sRGB textures, the output encoded); the ENHANCED LANE'S SKY while the mod's own `Enabled` switch is on (Mods pane, on by default until VC1, 2026-09-07 - the port's own dome is the lane's sky now and the mod is the player's choice; `?sky=dynamic` / `?sky=enhanced` / `?sky=retro` the doors), beside ES1's dome on the one seam - the ease, wind, front, rain, grass, mills and the moonlight term all keep working under it. The mod's fog settings replace DFU's (the renderer learnt Unity's ExponentialSquared), its light curve replaces the rig's for the whole world (`worldClock.setLightCurve`), its lightning is a point light on `renderer.setFlashLight` from `AmbientEffects.onPlayEffect`, its pixel snow its own program over the lab's flakes. Lab door `sky.html?sky=dynamic`; `tools/dynamicSkiesProbe.mjs` 11/11; `test/dynamicSkies.test.js` 21 pins. Ledger row A; the texture-provenance question is Mac's to rule on
- `07-Rendering/Seasons-Iliac-Bay.md` - SEASONS OF THE ILIAC BAY, 1:1 WITH PERMISSION (SIB1, 2026-09-05, Mac: "The next mod I want to implement 1:1 is this. also have permission") - RosyTheRascal's seasonal nature flats: the script ported off its IL, the textures the player's to supply (re-shaded classic flats, the doctrine's own case) through the texture pick - the `.dfmod` itself, read by the port's new UnityFS reader, or the mod's folders.
- `05-Combat/Blood-Arc.md` - BLOOD, THE PORT'S OWN (BLOOD1, opened 2026-09-19, Mac: "this mod we do not have permission to integrate. So instead I really want to try and build our own version as close to 1:1 as possible", then "I really want you to read in how their module works so we can achieve our own type of parity") - persistent blood decals, gibs, overkill and player bleeding, built on the port's own seams. DaggerBlood 1.0.6a (Excoriated) is the reference for the FEEL and NOTHING ELSE: it is not vendored, has no Mod-Registry row, and neither its code nor its thirteen textures ship. The port's 1:1 mod slices transcribe a DLL's IL method by method and every one carries a permission line; this has none, so that route is closed. What the page records instead is the set of BEHAVIOURAL FACTS - the five-rung rate ladder off damage over max health, the 175% overkill threshold (the mod's own setting text says 200 and is wrong), the fixed decal pool recycled oldest-first, the 2..5s bleed cadence and its ramp to 40 particles at 1% health - with no transcription and no `[IL]` citation into his assembly anywhere in this tree. Found on the way: its bloodless-enemy set is ids 15, 18, 19, 23, 32, 33, which is EXACTLY the six carrying `bloodIndex: 2` in `characters/enemyBasics.js` off DFU (MIT), so that table is already ours. The decal source is TEXTURE.380 out of the player's own ARENA2, varied procedurally - no new asset. Three slices, each behind its own feature row: BLOOD1a the decal pool, BLOOD1b overkill and gibs, BLOOD1c bleeding.
- `05-Combat/Weapon-Widget.md` - WEAPON WIDGET, 1:1 (WW1, 2026-09-14, Mac: "This is our next mod I want to add 1:1 while also having it work with morrowind's first person view") - RedRoryOTheGlen's FPSWeaponClone read off its IL method by method: the nine modules (Swings, Ambidexterity, Offset, Bob, Inertia, Step, DoubleScaleTextures, TrueTextureSize, Recoil) as a component the weapon rig runs beside the machine, its three coroutines as generators on Unity's own clock, its Position and Scale channels moving the Morrowind arms' composite through a screen transform (the Offset slide the sprite's alone); the 173 double-scale textures the player's to supply through the textures pick (renders of ARENA2, the doctrine's own case), read by the SIB1 bundle door under the mod's GUID.
- `06-Systems/Climates-Calories.md` - CLIMATES & CALORIES, OVERHAULED (SURV, 2026-09-18, Mac: "we have been given permission to completely overhaul this mod ... tackle everything here properly") - Ralzar's mod read off its DLL's IL and rebuilt as the port's own survival arc: a felt temperature from climate, season, hour, weather, clothes and armour; hunger, thirst, sleep and wetness as needs on the world minute; food that spoils; the mod's items as custom templates above DFU's 288 with its icons through a vendor-only archive; camps and campfires as shared world objects, a costed rest, hunting (the later slices); all of it behind one switch, on by default.
- `06-Systems/Handheld-Torches.md` - HANDHELD TORCHES, 1:1 (HT1, 2026-09-14, Mac: "Next mod to integrate 1:1 is this") - RedRoryOTheGlen's four MonoBehaviours read off the IL method by method: the hand law over the player's light (no free hand stows or drops it, a hand freed lights it again, the `== LeftOnly` quirk kept), the ignite / drop / throw keys as Unity KeyCode names, the first-person hand sprite on Weapon Widget's Bob and Inertia laws, the dropped and thrown torches burning on the world clock and picked back up, the foe set alight with DFU's own Continuous Damage-Health; the mod's 39 textures vendored (the author's own art, not a render of ARENA2); TextKey and the two Tuple kinds new to the Mods pane; and the answer to Mac's Morrowind question (a LIGH mesh on the `torch` group - the lane's own work, pending).
- `06-Systems/Ambient-Text.md` - AMBIENT TEXT, 1:1 (AT, 2026-09-15, Mac: "I now want to implement this as our next mod. 1:1") - Regnier's Ambient Text 1.8 recovered off the DLL's IL with stub assemblies: the unscaled-time tick and its two intervals, the chance roll, the key built out of where and when you are (the dungeon's type underground; the location RECT's type, and one of the climate / the hour / the hour-and-sky, above), ClimateKey's nine arms with Ocean as the default, WeatherKey's load-bearing ladder. The mod IS its 918 lines of prose, carried verbatim after checking the vendored JSON key for key against the Hashtable baked into the DLL; THE TABLE IS SPARSE AND THAT IS THE DESIGN - the gaps are the author's frequency curve, and the pin that holds it generates the reachable key set from the port's own law so a line that falls out of reach reddens. `weatherFlags` gives the port ONE home for WeatherManager's four booleans; one component claimed by whichever host owns the outermost motor, because lastIndex and the pace have to survive a door.
- `06-Systems/Online-Arc.md` - ONLINE (ONLINE1, 2026-09-12, Mac: "the basic bones of multiplayer ... being able to see and traverse with other players"). The port's own (DFU has none): a Cloudflare relay in `server/` (one Durable Object per room, storing a world room's memory since WORLD1), the streaming world sharded into 16-pixel cells with a 3-pixel range, towns, dungeons and interiors rooms by location; `net/online.js` the session (a pose at 10 Hz when moved, the peers eased between poses), `net/remotePlayers.js` every peer as their paperdoll at their feet with the name over the head; the front door's ONLINE brings the most recent save in. MWBODY1 put every peer in the Morrowind body on the enhanced skin (`net/peerBodies.js`); CHAT1 added the live chat (`net/chat.js` the log, `ui/chatPanel.js` the enhanced skin's panel - one World tab on a `chat:world` channel of the same relay, Enter to type). WORLD2 made the layout's foes one simulation per room - the host's, streamed; a joiner's are puppets, its blows go to the host, and the seat's handover makes them live (AUDIT WORLD and AUDIT WORLD2 audited both). WORLD3 made the live world events: a dungeon's doors, levers and platforms move for everyone (an act from whoever touched them), the host's foes hunt every player in the room, a puppet resolves the host's foe's blows against its own player, the roster is the room's, the hit carries the striker (AUDIT WORLD3 audited it: the one root was that a peer counts as a player, so four guards that meant MY player read another's). WORLD4 made a dungeon's loot the room's - a container nobody has opened is each client's own, and one anyone opens is the room's from then on. ONCRASH1 (2026-09-15, Mac: "reports of player browser crashing when online") closed the two ways a relay frame could end somebody ELSE's run: every handler out of `_receive` is contained, counted and said (it ran inside `onmessage` with nothing between a throw and the crash overlay, so one player's bad frame crashed every reader), and the port's four hand-rolled `while (d > Math.PI)` angle wraps are one step (`world/mat4.js` wrapAngle) with the wire's door bounding a peer's yaw besides - at a large finite yaw that loop never falls and the reader's tab hangs until the browser kills it. NAME1 + BUBBLE1 (2026-09-16): the names over the others anchored above the head in screen pixels, sized by depth (a far name is the small one), occluded by the player's own collider (one ray per drawn peer, terrain excepted), drawn in the pixel face by `ui/nameLayer.js`; and a line a peer says in the world channel stands over their name for six seconds as a bubble - the Online arc's NAME1 + BUBBLE1 section.
- `06-Systems/Immersive-Footsteps.md` - IMMERSIVE FOOTSTEPS, 1:1 (IF1, 2026-09-16, Mac: "Next mod we will be adding 1:1") - Kirk.O's two MonoBehaviours read off the author's published MIT sources: footsteps by the ground (the exterior climate-and-tile ladder, a building's floor off its own material names, a dungeon's water off the live capsule centre, boots of leather, chain or plate on stone), armour sway by what you wear, the mod's own landings and splash; the 210 clips vendored in both qualities; the stride handed to the mod once its clips decode and the classic machine kept running beside it.
- `06-Systems/Better-Ambience.md` - BETTER AMBIENCE, 1:1 (BA1, 2026-09-16, Mac: "Next mod to integrate 1:1 ensuring compatibility") - Joshua Steinhauer's six modules read off the sources the bundle carries: the hit shake in the view matrix, a dungeon's own fog colour and trilight rolled from its name, a stone reverb on the master bus, rain heard indoors, its own stride with an armour clank - shipped off beside Immersive Footsteps as that mod's author asks, with his warning box ported for the player who turns both on. BA2 (2026-09-17, Mac: the dungeons were "properly dark" before the mod): the module's Trilight ambient ships off - the classic flat 0.12 is the dungeon's dark again; the fog and the reverb stay.
- `10-UI/Held-Map-Arc.md` - THE HELD MAP (MAP0, opened 2026-09-18, Mac: "A complete replacement of the current enhanced map... in a hand drawn format, with roads and all"): Mac's own sprite of two hands holding a parchment as the enhanced map's window, the Iliac Bay drawn onto the paper at runtime in ink from the port's own data (never a painted asset), one page with pan and zoom bands, click to select, the one card over TO1's pure laws; the 3D relief map retired whole, the classic window untouched; the Morrowind arms to hold it as the first custom rig change. MAP1 SHIPPED 2026-09-18: `src/ui/heldMap.js` + `src/ui/inkMap.js` on the enhanced skin, the relief map and its renderer RETIRED; MAP2 SHIPPED the same day (Travel Options' additions on the sheet, each through the classic window's own function); AUDIT-MAP the same day (three lenses, a browser probe, twenty-two fixed, five departures recorded); MAP3 SHIPPED the same day (the Morrowind arms hold the sheet: `src/combat/heldPose.js` deltas over the idle and a paper piece at the eye, `src/ui/quadMap.js` laying the ink over the paper's projected corners; the pose deltas default to zero, tuned live through `window.__heldPose`); AUDIT-MAP2 the same day (the last audit before merge: three lenses and the hands lane in a real browser on the fixture rig - thirty-two findings, twenty-five fixed, the quaternion packing and the click-eating lane class among them).
- `06-Systems/Travel-Options.md` - TRAVEL OPTIONS, 1:1 (TO1, 2026-09-17, Mac: "This is the next daggerfall mod we are to implement 1:1... an enhanced version of the UI for enhanced mode... ensure the compatibility is sound with basic roads") - Hazelnut's Travel Options 1.11 (MIT; the autopilot Jedidia's, from Tedious Travel) read off the author's own sources at ajrb/dfunity-mods and checked against the shipped DLL before a line was ported (78 of its 80 method names resolve in the DLL's string table, and the keys the source reads are exactly the keys its `modsettings.json` declares). An accelerated journey is a REAL WALK: the autopilot aims the body at the destination rect every frame and pushes it forward, the world clock and the traveller alone run at the chosen multiplier (`systems/timeScale.js`, read inside `player/motor.js` so one physics step a frame covers fifty times the ground), and the journey stops itself for a foe, a dawn, a level-up or an inn. `systems/travelPaths.js` is the compass and the map-pixel geometry, `systems/travelAutopilot.js` the walk, `systems/travelOptions.js` the mod's Update loop in the mod's own order, `systems/travelPorts.js` the 417 port ids, `systems/travelOptionsText.js` its 44 strings; `ui/travelControlUI.js` is his 320x27 strip rect for rect, `ui/travelJunctionMap.js` the HUD mini-map at a fork, `ui/travelPathsOverlay.js` the five-times-bigger region page the paths are drawn into, `ui/travelMapOptions.js` + the travel map window's additions (ports filter, middle-click mark, I and H, the coordinates popup, the resume prompt, the Mages Guild teleport). BASIC ROADS IS THE COMPATIBILITY MAC ASKED FOR and it is explicit: `world/terrainGenClient.js` now says which network it handed over (`source`, at all three assembly sites), and path following takes Hazelnut's vendored arrays ALONE - never the port's own generated fallback, which has no junctions to follow. THE ENHANCED PANEL is the port's own, not his (`ui/enhancedTravelControl.js`): the same five controls in the enhanced skin's brass and bone, with the hours still to go, the distance out, what the journey is following, and the junction map as a real canvas - on the HUD layer, never the overlay slot, because an overlay holds the motor and the clock. Nine departures recorded; `test/to1_travelOptions.test.js` 41 pins, `tools/mutants/to1.json` 81 mutants (79 dead, 2 equivalent). Not seen in a browser. AUDIT-TO1 (2026-09-18, Mac: "Please do a comprehensive audit on this"): the journey was DEAD in the shipping host - the host's `isPlayerOnHUD` was `!gamePaused()` and every pin passed the flag by hand - plus three unread mod classes, a default skin that could not start a journey, an inverted ship restriction, white bars for art, an invisible junction map, the follow key on F; all fixed and pinned with the host's own expressions (55 pins, 113 mutants), five departures added.
- `07-Rendering/Enhanced-Lighting-Arc.md` - ENHANCED LIGHTING (EL, opened 2026-09-17, Mac: "enhance our lighting system tenfold", tiers 1-3) - EL1 SHIPPED: the lit world on a linear pipeline behind the `enhanced-lighting` switch - the renderer's four world fragment shaders and the far ring's replaced as a unit (two programs, never one with a switch), texels and scene colours decoded from sRGB, forty-eight lanterns on a windowed inverse square with a flame's warmth, exposure and an extended Reinhard that keeps the dark end and blooms a torch's near field, the fog glowing where a lantern's light crosses it, the fog colour blended so a fogged fragment is the sky's; `?lighting=classic` and `?exposure=` the doors. EL2 SHIPPED: shadows - what the world pass draws is recorded and replayed depth-only from the light at the next frame's start, a two-cascade sun map outdoors and a cube map from the nearest lantern indoors, read by the lane's shaders with PCF; casters the frame did not draw, the character rigs and the water are recorded limits. EL3 SHIPPED: depth and air - a depth image of the world from the camera off the same records, and on it ambient occlusion in the corners, bloom sourced from the windows, the self-lit records and a glare at every lantern the depth does not hide, and the sun's shafts, composited by the frame's first screen draw; EL4 SHIPPED (Mac: "Proper darker dungeons. The goal isnt a half visioned system"): the departure closed - a frame-target law every pass restores to, the whole world drawn into a frame image and resolved once (bloom from its bright pixels, a vignette, a touch of contrast), eye adaptation off the frame's mean luminance that opens slowly into a dungeon and closes fast into daylight and stops at a ceiling so the dark stays dark, the dungeon ambient cut to a third under the lane, a glint from every lantern on stone. `?air=off`. AUDITED (AUDIT-EL, same day, Mac: "Audit"): twenty findings fixed and pinned - among them the terrain that would have vanished under `?air=off` (two sampler types on one unit), the travel map that never reached the canvas, the forty-eight lanterns the light composer still cut to sixteen, the flats drawn edge-on into the camera's depth image, the shade-concealed foes drawn black, the fog wall brighter than the dark walls, the shadow biases in the wrong space, the eye measuring its own output. NOT SEEN ON A GPU. EL5 THE FIELD (2026-09-17): the first report from the game (a town gate at night - lanterns glaring through walls, the framerate) - the glare's occlusion in world units, every replay culled by the records' bounding spheres (`render/bounds.js`), four lantern casters in one depth array, the resolve's contrast in display space (it crushed the darks); `tools/enhancedLightingProbe.mjs` draws the lane on a real GPU and fails on the field's checks. EL6 (2026-09-17, Mac's four): flame flats never cast from lanterns, the SSAO rotation ordered to its blur and both encodes dithered, the bloom's emitters occluded by the frame's depth, and the air's images drawn at the resolve off the frame's own depth (the camera depth replay gone, no AO fetch in the world shaders), six casters. EL7 (2026-09-17, Mac's #7 and the floating ball): a glare needs a flame under it and none for the light in the hand, three cascades by view distance, the rigs cast, the water receives, the AO blur depth-aware, `glslFloat` for every whole constant a shader takes. EL8 (2026-09-17, Mac: contact shadows and performance): every lantern without a caster slot marches toward its light through the previous frame's depth (`AIR_CONTACT_*`, two depth textures ping-ponged on the frame, `?contact=off`), light i's caster slot in one lookup (`uCasterOf`), the far cascade every other frame and the far casters every third, staggered and at once when a slot's light changes, `?perf` a GPU-timed line with the lane's counts (`render/perfMeter.js`). BUGS-5 (2026-09-17, Mac's five): the light in the hand never casts nor is marched (`SHADOW_CASTER_MIN_DISTANCE` 1.5), the march reprojects its point first, things on the ground cast no standing card (`noShadow`, archive 216, flats under half a unit), the glare's band a quarter unit, the far cascade skips casters under two of its texels and the march four steps within seven tenths of a range; F1 the thrust's reverse latched (`05-Combat/Weapon-Widget.md`).
- `06-Systems/Accounts-And-Cloud-Saves-Arc.md` - ACCOUNTS AND CLOUD SAVES (ACC0, opened 2026-09-21, Mac: "cloud storage and account creation needed for accessing online mode") - THE DESIGN RECORD, nothing shipped. The arc's own first finding is that SOC1 already built accounts and no page called them that, so this is not "add accounts" but give the existing one a provider link and somewhere to keep saves. Mac's wall is at CLOUD SAVES ALONE - a guest connects, is seen and chats under a generated name; a linked account gets its own name and its saves, so the only people who can take a name are the people who can be banned. D1 owns identity (a provider link is a lookup by somebody else's id, which a Durable Object cannot index); R2 holds the save blob and D1 its card; the cloud is a BACKUP and the local save stays authoritative. The new seam is a signed token the relay verifies instead of the client-asserted `name` it sanitises today. Two Workers, settled by SLAM8's raw-byte bundle hash. Lifts `fight-life-source/server/src/auth.js`, three migrations and the hydrated mirror from `Lattymoy/fight-life-source`; its `handle` needs a uniqueness constraint it does not have there.
- `06-Systems/Community-Arc.md` - THE COMMUNITY ARC (COMM, opened 2026-09-23, Mac with a batch of Discord suggestions: "I wanna tackle each of these head on and be extremely thorough and detailed") - the players' own requests, a slice each: the chat that opens on its newest line (CHAT-SCROLL), a chat box dragged to size with its text (CHAT-SIZE), world/region/party/local channels with in-character speech (CHAT-CHAN), dice the relay rolls (DICE1), emotes (EMOTE1), a key through stacked bodies (LOOT-STACK), the inspect card (INSPECT1), mail for the offline (MAIL1) and journals shared in-world (JOURNAL1).
- `06-Systems/Social-Party-Arc.md` - THE SOCIAL ARC (SOC, 2026-09-16, Mac: "A social button next to the chat UI ... friend other users, see if they are online/last online + be able to invite friends or other individuals to the new 4 person party system"). The port's own, on the ONLINE arc: the world channel's Durable Object is THE HUB (`server/src/index.js`, `world78`) - an ACCOUNT id and secret beside the tab's peer pair (a friend is a person, a peer is a tab), friends and requests, presence and last-seen, four-seat parties with a seat kept five minutes for a dropped member, the party pose fanned to the party alone; `net/social.js` the client's picture (pure); `ui/socialPanel.js` the friends + party panel behind the Social button beside the chat; `ui/partyPanel.js` the party HUD (the game's own face art, three bars); the names over bodies green for my party; F on a body for Add friend / Invite to party; the party on the overworld map wherever they are. Audited the same day (AUDIT SOC, four lenses over the merged arc, `world79`): the hub's cooldowns and paged sweep, pending rows without presence, by-account acts for relations alone, the newest tab speaking for the seat; the link's inbound gates; the host's counted pointer surfaces and F inside; the surfaces' and the maps' findings - the arc page's AUDIT SOC section.
- `07-Rendering/Water-Arc.md` - ENHANCED WATER (WATER1, 2026-09-08, Mac: "develop proper water shader for the oceans/rivers/ponds of daggerfall"). Water was record 0 of the tile array drawn as dirt is drawn - flat, opaque, unmoving. `render/waterSurface.js` + `drawWaterSurface`: the pixel's own terrain grid drawn again, lifted, every non-water texel discarded, the rest a surface - waves on the eased wind, the dome reflected by Fresnel, the sun's and the moon's glints, the cloud deck's shadow, rain, the shore feathered off a water-corner table that inverts the marching squares. Switch `enhancedWater` (on by default), `?water=off` the kill switch; the classic lane untouched. On the way: the ocean band's compare was the double's, not float32's, so no corner anywhere was ever water and every sea tile this port drew was beach - fixed at the source, the jitter and the constant with it. Audited the same day (WATER-AUDIT, two adversarial lanes: the wave trains by rotation, the point lights on the water, the water's own index set, the table pinned through the producer). Seen in the water lab (`water.html`, 10/10 probe checks), not on a real GPU. WATER2-5 (2026-09-11: the basin, the swell and the foam, the art's own water, per texel) were REVERTED the next day on Mac's call ("revert to our original implementation before the depth" - Water-Arc.md, THE REVERT); the surface is WATER1's with MAC2's darker look, puddle tiles and swim law kept.
- `07-Rendering/Enhanced-Combat-Visuals.md` - ENHANCED COMBAT VISUALS (ECV1, 2026-09-07, Mac: "ill let you lead this. This can fold into a new toggle Enhanced Combat Visuals") - what the enhanced skin DRAWS for a magically concealed enemy. An imp casts Chameleon on itself (its classic spell list) and DFU's EntityConcealmentBehaviour disables its renderer: gone, still acting, still hittable - Mac: "goes invisible and still can be attacked", which reads as a bug and is the rule. `systems/combatVisuals.js` (pure) + the billboard pass's blended phase (spectral and concealed batches together, back to front): a chameleoned foe shimmers at low opacity with a ripple, a shadow-spell foe is a dark silhouette, invisibility stays hidden, and a hit on an unseen foe flashes it for a third of a second. The switch `enhancedCombatVisuals` (on by default), `?combatvisuals=off` the kill switch; the classic skin and the switch off take the A5 skip verbatim in all three foe hosts. The rules - the cast, the senses, the hits, the break - are untouched. Not seen in a browser.
- `07-Rendering/Volumetric-Clouds-Arc.md` - CLOSED 2026-09-07, opened the same day (Mac: "remove the pixelated sky look and overhaul the cloud visuals... true volumetric clouds that move across the sky, build during weather... on top of real cloud shadows that reflect on the ground"). The map first: the default lane's pixelation was entirely the Dynamic Skies mod's (NEAREST 512-pixel cloud sheets, its own posterise) and under the mod the ground had no cloud shadow at all; our dome snapped to ES1e's retro pixel by default. VC1 SHIPPED the same day: our dome is the lane's default sky, smooth by default (`?sky=retro` the door back), the mod a choice in the Mods pane. VC2 SHIPPED: `render/renderTarget.js` under the upload law and `render/cloudNoise.js`, two tiling 3D noise volumes generated on the GPU, with a lab door and a 10-check probe. VC3 SHIPPED: `render/volumetricClouds.js` - the raymarched slab in a sky-space map a stripe per frame, composited over the dome by transmittance, shaped by the eased row and a profile on the same clock, drifted by the one wind integral, lit by the sun or the moon; scattered cumulus at noon, a mottled lid at overcast, a dark storm, seen in the lab. VC4 SHIPPED: the SAME field marched from the ground into a world-space shadow map on the 819.2 grid, sampled by the terrain, the models, the characters and the flats through one block - the projection of the bank overhead, the old noise shadow and the global sun dim gone. VC5 SHIPPED: the close - the tiers on the lab's panel, a 15-check probe each claim paired against a bare-dome shot, the three marched programs under one uniform pin, the square by value, the Opus review's findings taken (the floating origin the HIGH one: every sample at the absolute position, the map kept across a recenter) and the refuted ones recorded. Not seen on a real GPU or with ARENA2 - Mac's eye is the next gate; the tier by measurement is his machine's.
- `07-Rendering/Weather-Arc.md` - THE WEATHER ARC (WEATHER2, 2026-09-14, Mac: "it can rain when theres snow on the ground... a dynamic world space event system where weather can be traveled out of and into... a new sand storm weather event"). A: no rain over snow (the sim's word through the ground it falls on, enhanced lane); C: cloud types by place (cells in the one volumetric field); B: the weather field (the day's words as drifting cells, walked into and out of, the clouds' cells); D: the sandstorm (the port's eighth word, walls over the desert on a cloudy or thunder day, the wisps' program in a tan look). The arc closed 2026-09-14 with three residuals named.
- `03-World/Clock-Arc.md` - CLOSED 2026-09-08, opened the same day (Mac, after the clouds: "we need to change our weather/day and night system to be in sync with the world clock to enhance everything"). The map first: the sun, the moons, the stars, the light rig and the weather SIM already ran on game minutes, but the whole weather PRESENTATION ran on the wall - the 14 s ease, the front's stretch of it with the time scale hard-coded at 12, the cloud drift integral, the cloud profile's ease - so an eight-hour rest swept the sun across the sky in six real seconds while the clouds stood still and a change of weather still took fourteen real seconds. CLK1 SHIPPED: ONE CLOCK - the presentation differences the host's classicMinutes (a stopped clock freezes the sky, a rest is a time-lapse, a jail term moves the clouds by the hours of wind they missed), the ease said in game minutes (2.8, the same look at the default scale), the stretch minutes over minutes, the drift through one constant that keeps the rows' units, the clouds' two unbounded integrals wrapped to the field's common period at upload; the Dynamic Skies mod keeps its real frame (1:1). CLK2 SHIPPED: the weather EVOLVES within the day on the enhanced lane - at every game hour, wherever the player is, each of the six zones re-rolls from DFU's own table with a 12% chance by a seeded generator (never the classic sequence; replayable), and a change lands through DFU's own drain flag as a front under the sky or a jump out of sight (DFU rolls once a day and shipped its hourly poll commented out; the classic lane keeps that); Ledger row. CLK3 SHIPPED: the moon's phase continuous on the clock for the enhanced dome (DFU's 32-day ratio with the minute of the day added, never a ring step from the ladder every system still reads) - a moon that jumped 45 degrees at midnight, and the moonlight with it, walks there through the day; the dome's sun and the rig's light found to be one curve already and pinned so. CLK4 SHIPPED: the Opus review's fifteen findings taken - the sim's stale clock per zone, a loaded save never evolved off, the lane's door live, the moonlight ramping on the daylight curve, the dome's deck given a lattice period so its drift wraps seamlessly, the resting page a veil over the world on the enhanced skin (the time-lapse a thing the player watches; classic keeps DFU's black), the pins that could not fail rewritten. Not seen in a real browser - Mac's eye is the next gate.

## Active arcs

Moved to `01-Overview/Active-Arcs.md` (HARD5, 2026-09-15) - 172 KB of it,
in 89 lines. One line per arc, each naming its own page.

## Open flags (regenerated 2026-08-19, AUDIT 18)

Regenerated mechanically at the AUDIT 18 close, from the FLAGGED/INTERIM
sites themselves. The audit retired 30+ flags whose text had gone false and
the eleven fix domains moved many more, so every line number and quotation
here was re-derived rather than edited. test/audit18_bible_docs.test.js now
pins this list BOTH ways: a citation that drifts, a flag retired without its
sentence, or a new flag never listed all fail the suite.

AUDIT 18: "Line numbers refreshed" used to close this paragraph as a hand
kept promise, and six of the 109 citations had already drifted (up to 41
lines) when 9036e49 moved chargenArt.js. The promise is gone; the list is
now checked mechanically both ways by test/audit18_bible_docs.test.js -
every citation's quoted text must sit on the cited line, and every
FLAGGED/INTERIM site in `src/` must appear here. A slice that moves a
flagged site turns that test red until the list is regenerated.

AUDIT 18 (combat) RETIRED the racial/proficiency half of
playerWeapon.js's INTERIM sentence and DELETED it: chargen writes the
DFU-numbered raceId, so CalculateRacialModifiers is ported and LIVE
(formulas.js). What still pends there is CalculateProficiencyModifiers
alone, flagged at its new site inside calculateAttackDamage. The
combat line numbers below are refreshed with it.

- `src/combat/fpsSpellCasting.js:101` - * FLAGGED: TextureReplacement.TryImportCifRci (:179) - the loose-file
- `src/scenes/dungeonContext.js:1154` - REPORTS ARE THIS ONE LINE, and it is FLAGGED rather than fixed because the fix is a slice,
- `src/scenes/exterior.js:2067` - TP2 INTERIM - THE ONE ARM THIS HOST CANNOT TAKE: a jump to an anchor on ANOTHER map pixel. Teleport.cs:145-163 respawns at the anchor's world position, which is StreamingWorld's job (scenes/world.js's `_teleportToPixel`, the door `teleportPrompt -> teleportTo` opens); `?exterior` loads ONE fixed city and runs no streamer, so there is no arrival to build - and it says so instead of eating the cast, the way the standalone dungeon says so about its two windows.
- `src/systems/playerTorch.js:12` - arm is FLAGGED here rather than guessed - see the note below.
- `src/systems/playerTorch.js:51` - FLAGGED (blocked on data this reference tree does not carry): the
- `src/ui/enhancedMenu.js:3324` - FLAGGED: the rest of the keyboard. The wizard walks to `done` with
- `src/ui/pauseWindow.js:65` - FLAGGED: PauseOptionsDropdown (:83-84) - DFU's own quick-settings

## Audits

Moved to `01-Overview/Audit-Log.md` (HARD5, 2026-09-15) - the running log,
newest first, of every audit that has no page of its own. The ones that do
are in `01-Overview/Active-Arcs.md`.

## Deploy

Production is GitHub Pages via `.github/workflows/deploy.yml` (push to
main or manual dispatch), gated on `npm run check` - a red suite never
ships. Builds contain NO game data (Port-Doctrine: ARENA2 is
non-redistributable). The runtime data path is
`src/scenes/dataSource.js`: getBytes resolves memory -> IndexedDB ->
network `./arena2/*` (the dev middleware unchanged); on the deployed
site a boot overlay asks for the local ARENA2 folder ONCE (directory
input or drag-drop) and persists it in IndexedDB. Every reader routes
through the fetchBytes seam, signature unchanged.

## Repo layout

`src/main.js` is the entry point and scene router - no longer thin: it
builds the Renderer, holds the ARENA2 data gate, installs the cursor,
the settings/skin front-door choice and the stale-chunk recovery, then
dispatches on the query string to the scene boots it imports. Those live
in `src/scenes/` (exterior, interior, dungeon, world) with shared helpers
in `src/scenes/shared.js`; each file carries its milestone header. Data
readers in `src/formats/`, world assembly in `src/world/`, GL in
`src/render/`. `main.js` is one of the modules the module-body smoke
cannot import (`import.meta.glob` is a bundler transform), so its body is
held by text pins - tdz_selfreference.test.js is the standing guard.

## Ground rules carried from project-final

- Desktop-first. A mobile touch layer (`src/ui/touch.js`: virtual stick +
  look/attack drag + button row speaking the desktop input language) ships
  for on-device testing and is wired into all four hosts - Port-Doctrine.md:19,
  approved by Mac 2026-08-13. (AUDIT 18: this bullet denied the touch
  layer outright for six days after it landed (approved 2026-08-13). The
  open-flags list below is grep-regenerated from `src/`, so it can never catch
  a false claim in this file's own prose.)
- Bible is flat under `bible/`. This file is the index. No Dashboard.md.
- Prototype HTMLs at repo root must register in `vite.config.js` rollupOptions.input.
- One feature at a time. Grep first. str_replace over rewrites.
