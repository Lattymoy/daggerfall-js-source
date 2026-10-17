# AUDIT PRE-MERGE 0928 - the Sea Update read before it merges, 2026-09-28

Mac: *"Audit before we merge"*. PR 413 carries the Sea Update (`claude/funny-tesla-bhzv35`, 24 commits past main):
Come Sail Away CSA-A to CSA-J, There's a Hole in the Bottom of the Ocean OH-A to OH-F, Iliac Puddle No More's DW-E5
and DW-F, FIELD-CONSOLE1, the Enhanced AI navmesh baked whole, and five ARENA2 triage re-pins. Main had been merged in
(`f2f3598a`: #393-#412, 174 files conflicted, 64 hunks by hand) and the audit begun, but the session that began it
stopped at its account's usage limit before a line of the audit was committed. This session resumed it from the PR's
head: main merged again first (`a2b5c1d0`: #415, the Discord link), the baseline taken (`npm run check` green - 13,826
tests, 250 of them data-gated skips), then the nine lenses the PR named, each over a frozen tree (nothing was fixed
while a lens read - Home.md, 17l) and each reproducing what it reported with the repo's own harnesses:

- **M** the merge's hand resolutions, and what the merge met without a conflict git could see;
- **R** rendering on a real GL (Chromium's SwiftShader), both lanes;
- **O** online and the wire;
- **S** the save and the lifecycle;
- **C** Come Sail Away 1:1 against its assembly (the IL, `tools/ilDump.py`);
- **H** Ocean Holes and Iliac Puddle No More's DW-E5/DW-F 1:1 against theirs;
- **N** the nav bake and the re-pinned tests;
- **D** the record, and the ARENA2-gated suite;
- **U** input and the UI on keyboard, gamepad and touch.

Every finding below was verified against the code before it was fixed, pinned by a test that FAILED on the unfixed
tree for the finding's reason, and mutation-proven. The fixes landed as seven clusters, each in a worktree of its own,
merged in turn; each fix carries an `AUDIT PRE-MERGE 0928 <ID>` comment.

## Fixed

Mutants: `tools/mutants/audit0928_online.json` 34, `audit0928_save.json` 31,
`audit0928_input.json` 14, `audit0928_render.json` 11, `audit0928_merge.json` 20, `audit0928_nav.json` 18 (and
`navbake.json` 17), `audit0928_oh.json` 10 - all dead. `arena2triage.json` gains the triage's 23 records (4 die here,
19 against the player's own data, each with its `why`; the list's three older records die here too).

**Online and the wire** (`systems/comeSailAway/comeSailAwayWire.js`, `systems/comeSailAway/comeSailAwayBoat.js`, `scenes/comeSailAway/comeSailAwayPeers.js`, `scenes/comeSailAway/comeSailAwayPool.js`, `scenes/world.js`, `scenes/dungeonContext.js`, `scenes/worldModes.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| O1 | high | ONE PEER'S WORD STOPPED EVERY RECEIVER'S GAME LOOP. The door took a variant 0-9 for any hull, but only the Large Boat has variants (seven); a word naming the eighth or later passed, SpawnBoat threw "Transform child out of bounds", and the throw came back every frame from the pool's frame, which nothing catches - the loop ended on the crash overlay (the mod on by default). | The door bounds a variant by its hull's own count (`HULL_VARIANT_COUNTS`, derived in the pin from the vendored prefabs; a hull with none never reads it); and a build or a variant change that throws costs that owner's word and boats alone, said once, never the frame - MWBODY A1's law for a peer's rig. |
| O3 | high | A PEER COULD FREEZE EVERY RECEIVER BY SWAPPING HULLS. Each hull change at a slot rebuilt the boat synchronously inside the socket's handler - a Large Galley 37.6 ms - with nothing bounding builds per word or per second: eight galleys and eight rowboats alternating at the foes frame's twelve a second cost 1,839 ms of handler time a second. | The handler keeps the word and builds nothing; the frame builds one boat across every owner, each owner under a bucket (eight at once, one back every FOES_FULL_MS, forgotten only when full); a reordered or packed list reuses its boats by hull, nearest first. A hull-swapper at twelve words a second now builds at most thirteen boats in ten seconds (960 before). |
| O2 | med | A sailing boat's word rode only the full foes frames, two seconds apart - a moving boat forced no frame of its own, so the others saw the sailor walk on water ahead of a boat that lurched after (8.5 m behind at 4 m/s; 42.7 m, with snaps, at the helm's higher time scales). | The moved word asks for the frame it rides (`_hccDirty \|\| csaMoved`, as the team's does): a sailing boat rides about every FOES_MS, and the record's "five times a second" is true. |
| O4 | med | An invisible sailor's boat was drawn whole - the helm crew up, the lanterns lit - and showed every peer where the invisible player stood (the pre-merge audit's I-B, never extended to the boats). | The peers take the look HCC's team does: a hidden owner's boat at the helm stands nowhere (no mesh, flats or lanterns), a concealed one's flats wear the look, a moored boat stays. |
| O6 | low | In a dungeon a joiner's hull carried foes the joiner does not step (the host's room foes, a party member's own), writing their feet while their stream pulled them back. | The hull asks the dungeon frame's own puppet test (`isPuppetFoe`, through worldModes' `insideFoeIsPuppet`) - the one the abyss now asks too (M1). |

**The save and the lifecycle** (`systems/comeSailAway/comeSailAway.js`, `systems/comeSailAway/comeSailAwayItems.js`, `systems/effects.js`, `systems/save/save.js`, `systems/modSettings.js`, `systems/inputActions.js`, `scenes/world.js`, `scenes/oceanHolesAbyss.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| S1 | med | A load that landed while a disembark still held the player (up to a second after the key) was overtaken by it: the hold pinned the loaded player to the destroyed boat's helm, and a restored helm was left unusable and later told the sail had ended. | A load's start ends a disembark in flight (StopSailing's tail - DECLARED (39)), and the hold ends raising nothing once its boat is gone, as Unity's destroyed transform ends the coroutine. |
| S2 | med | A load while placing left the parts in the loaded pack and still placed the boat - one parts item made two boats: the runtime kept the pack's array, which a load replaces. | The item is spent by its UID from the pack or wagon as they stand (the host's getters), as DFU's one ItemCollection is. |
| S3 | med | A save made while sailing, loaded with Come Sail Away off, kept "I'm On A Boat"'s water walk for about 90,000 rounds: nothing without the runtime took it off. | An effect kind is its mod's (`registerModEffectKind`); the restore skips a kind no loaded mod registered, as DFU's broker does. |
| S4, U7 | low | Two doors read the mod's switch live where the runtime reads it once at load: switched on mid-game the shelves stocked bare "Parts of"/"Deed to" rows that placed nothing; switched off, the helm ran on with its keys dead. | One load-time answer for a next-load mod (`latchModLoaded`) at every door - the shelf's rows, the keys, Iliac Puddle No More's fish rows and Travel Options' Follow Paths; a mod that takes effect at once still reads live. |
| C1 | low | Declaration (38) went wider than it said: letting go of a helm that landed elsewhere never reached StopSailing's lent-ship arm, so a player who owned no ship kept the one the crewed helm lent (a bank buys it for 85,000). | The arm (`ReturnTemporaryShip`, IL_b0e7-IL_b121) runs after the mod loop for such a record; (38) says so. |
| H/S | low | The abyss's way back and way down drop their promises (the host's doors): a teleport or a door that threw left `transitioning` - or `entering`, which every load, fast travel and Recall waits on - up for the session, with the rejection unheard. | Each is caught, said once, and leaves no descent or transition standing; a door that threw is answered as one that never opened (Ocean Holes' (8)). |

**The merge's two clashes** (`scenes/dungeonContext.js`, `scenes/worldModes.js`, `scenes/world.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| M1 | med | OH-E's abyss heard every foe built after the layout as a spawn of its own - main's shared-foe copies too (a joiner's copy of the host's rest encounter, a party member's own-lane foe) - and replaced a body by rebuilding it in its slot, leaving the room's word (`_encId` and `_sharedById`, `_loose`, `_ownFrom`) on the dead record. The host's replaced rest encounter left the room: every joiner took it down, and a Dreugh only the host could see hunted the host alone (REST-SYNC's own bug, back in the abyss). A joiner replaced its copy privately and lost the host's records; a replaced summon left the loose lane; a joiner's flame copy destroyed at its build could be revived by the next record with no batch, and the draw's `f.batch.conceal` threw. | A copy of another player's foe is built as a puppet: no OnEnemySpawn, no LoadID. A rebuilt body takes the old one's place in the room (`takeRoomPlace`), and the shared lane stands another species under the same number anew, as the own lane does. The abyss's list, destroy and replace skip a foe another player runs (`runByAnother` - the frame's own `isPuppetFoe`, O6's), so it never flags destroyed a live foe the pre-merge audit's D1 keeps. |
| M4 | low | In the drowned dungeon the others' torches and Light-spell candles burned full: the abyss put out my torch and halved my candle alone. | The dungeon's list asks for no peer torches under the abyss's torchOff and halves their candles after the tint, as mine - on every screen, as on their own. |

**Rendering** (`render/renderer.js`, `render/shadowPass.js`, `scenes/world.js`; the pins in `test/scenes/dwf_audit.test.js`, `test/render/la_cost.test.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| R1 | med | A sail re-baked in place keeps its matrix, so the lane's lantern shadow cache (SC1) kept the old sail's shadow on a still hull - a beached boat, and every boat indoors or underground, where the wind is nought and nothing bobs - for as long as nothing else near the lantern moved. | updateMeshVertices counts a generation when a bake moves a vertex (a still re-bake counts none), and the shadow pass reads a changed generation as a move under `_moved`'s 60-frame hold. |
| R2 | med | Outdoors the boats' lanterns rode the player's extras: the prefab's orange was lost (white on the classic set, the city's flame on the lane) and they took lead slots ahead of nearer street lanterns - with a galleon 42 m off, the classic cap kept eight street lanterns and the boat's eight. | They join the scene's own selection (`_csaFill`), ranked by distance with the street's, each in its own colour, by night and by day - as a building and a dungeon already took them. |
| R5 | low | The pool walked each boat's active tree three times a frame, a Float32Array per node per walk (about 2,200 a frame for one Large Galley, 1.8 ms). | One walk a frame into storage reused from frame to frame, bit for bit the old walk's order and values (landed with the online cluster, which owned the pool this round). |
| R6 | low | The pool made its flats as dynamic batches, which the shadow pass reads as always moving: every casting lantern near a still boat redrew six faces every frame. | Static batches; a bobbing boat's flats still move by their origin, which the cache already tests. |
| M3 | low | The billboard frame block's reset of the water column's switch had no pin that could fail. | A two-frame, two-call case in DW-F E-1 and the column in LA-COST1's EVERY-DRAW run. |
| N7 | low | The merge made DW-F E-1's `${HIT_FLASH_GLSL}` group optional: deleting the classic flats' declaration passed every pin, though BB_FS calls hitFlashLit and would not compile. | Required again. |

**Input and the UI** (`scenes/world.js`, `ui/touch/touch.js`, `scenes/worldModes.js`, `scenes/dungeonContext.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| U1 | med | The position map's keyup took a release it never saw pressed: the Escape that put "According to my instruments..." away on its press closed the map that box opens four frames later (held four frames or more - 67 ms at 60 fps). | The map counts a key-up only for a press it took (JAN1's law, `ui/input.js`); an Escape pressed and released on the map still closes it. |
| U2 | med | A phone could never place a boat: the placing click is ActivateCenterObject's release on the edge ring, where a tap never lands - and the `placing` left standing refused every later parts or deed until a fast travel. | A finger's tap is the placing click on the frame its press lifts (`_tapClick`), once; never the stick's lock-only tap or a quick-loot key; the mouse and the pad place as before, and E stays Interact (KB1). |
| U3 | med | At the helm the phone stick's 80% throw pressed Run, and Run with a side key is the oars' strafe - a full side push or forward diagonal never turned the boat. | The touch layer takes a host gate (`hooks.stickRuns`); the world's is false while the helm is held. |
| U8 | low | The map declared no `hidesHud`, so the large HUD stayed painted under PauseGame(true, true)'s map. | `hidesHud: true`, read by the street's, the building's and the dungeon's drawHud. |

**The nav bake and the re-pins** (`ai/nav/navBake.js`, `ai/nav/navClient.js`, `systems/handheldTorches.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| N2 | low | A player whose feet do not land (a load while swimming - the abyss is flooded whole - or levitating) beside any landed foe lost the player's own room: the anchor union took the foes alone. | The player's feet always stand in the union, by the nearest-span pick when they do not land. |
| N4 | low | The worker's own error never reached the console, and a small soup fell back to the main thread in silence. | The warning carries the worker's word; the fallback says so. |
| N5 | low | A cache hit with a dead worker re-cut a large soup's boxes on the main thread (2.8 s over a 144 m level). | The bake path's rule on the cache hit too: a dead worker on a large soup stands the classic motor. |
| N1, N3, N6, N8 | low | Laws with no pin that could fail: the worker path's anchor union; the landing ring, the walkable filter, ANCHOR_Y_TOLERANCE, the cache key's union hash and SOUP_AGENT's 0.7 m gap; the gated bake built its models without main's patchSeams; three of FIELD-CONSOLE1's four answered lines. | Each pinned, red first (`inVendoredSet` exported for the vendored set's key form; PERF-2D's warning names its opener; the read-back canvases' willReadFrequently). |
| N10 | low | Three triage commits claimed 23 mutation checks and committed none. | Committed in `arena2triage.json`. |

**Ocean Holes** (`world/deepWater/deepWaterFloor.js`, `scenes/oceanHolesHost.js`, `scenes/world.js`, `world/underwater/underwaterDecorations.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| H4 | low | The IL's terrain size is TerrainData.size, the float 819.2f; the port multiplied the double - 4,165 of 21,152 pit axes stood one float step off the IL. | `TILE_WORLD_SIZE_F32`, the one float form, at ProcessTerrain, DeformSeafloor and RestoreOceanPosition's fallback spot; DW-E2's grid, which rounded its own, reads it too. |

## Found at the integration

- The clusters' one conflict: M1's `takeRoomPlace` and O6's `isPuppetFoe`, both added under `isRoomFoe` in
  dungeonContext.js - both kept; and the two had written the same puppet test twice, so the abyss now asks the frame's
  (one expression, as `isRoomFoe` is).
- The cites the fixes moved: `tools/citeShift.mjs --base a2b5c1d0 --apply --struck`, 318 across 91 files, once; the one
  continuation it cannot move (chargenSession.js's `overlayHover` cite) re-aimed by hand; survtiers3's two cite-rot
  mutants re-aimed at the moved `world.js` cite.
- D9's wording took the Features panel past its ceiling (FT15): said in 11 more characters, and the ceiling rises by
  that and no more.
- The run after all of it: lint and types clean; 13,885 tests, the one failure FT15's (fixed, then run again green);
  250 data-gated skips. Suite: 13865 tests across 1450 files (top-of-line `test(` calls, as the manifest counts).

## The record corrected

The pages said things the code does not do: SurfaceHoleSize is a radius (H1); the flatten ring's reach is the IL's
DeformSeafloor, not the radius plus the stray (H2); the pit's entrance is a solid box, not a trigger (H3); 50 x 0.3f is
15.000000953674316 as a float, and the abyss's quota at 120 enemies is 36, not a third (H5); the wind turns to the
front from 18:00 to 07:00 (C3) and a lateen sail loses 15% on its bad tack, not a fifth (C2, a comment); the boats'
lanterns cast on the Enhanced Lighting lane (R4); Controls.md's Come Sail Away table held two of its nine rows (D2 - the page is held to the registry by a pin now);
the patch notes promised every boat saved, but one left in a dungeon's water is lost unless Persistent Dungeon Boats
is on (D3); the navmesh bug was listed open (D5); the nav cache key is v4, not v2 or 3 (D6); the ledger's two titles
skipped departures of their own rows (D7); two cites had drifted (D8); the parts go in the water anywhere, the deed near
a port (D9); Enhanced-AI-Arc.md still carried the retired "asserting nothing either way" sentence and "the feet are the
anchor", and had no record of the soup bake (N9, D4 - now its DEGENERATE-BAKE ROOT section).

DECLARED on the ledger: on the Enhanced Lighting lane Come Sail Away's waves and particles and Ocean Holes' plume and
discs are drawn outside the lane's finish, in display colours, as Iliac Puddle No More's surfaces are (R3 - item (24)
had said they were lit as the port lights its flats); Ocean Holes (20), a replaced body keeps its place in the room.

## Not fixed, and why

- **The others' boats are not culled by distance.** Eight galleys an owner still cost a receiver about 15 ms a frame
  (measured in node); a cull is a design of its own, beside the builds' bucket.
- **DW-E5's treasure guards** ride the finder's stream as the deep's managed foes, outside DEEP-SHARE's election, so the
  others see guards round a wreck only the finder sees. Noted; the loot itself is each player's own by the mod's design.
- **The helm on touch and a pad (U4) - Mac's call.** The nine helm actions (the sails, the trim, the time scale, the
  lanterns, disembark) have no touch button and no pad binding by default; a pad reaches them only through a capture on
  the enhanced Controls page. No vendored mod's actions are exposed on touch or a pad anywhere in the port (Handheld
  Torches, Horse Cart and Cargo, Travel Options, Eye of the Beholder alike), so there is no house pattern to extend - it
  is a new design. The 1000x500 map at DoNotScale also overflows a phone's canvas. ANSWERED for the nine by CSA-L
  (2026-09-28, the player's ask - `03-World/Come-Sail-Away.md` The helm on screen): Enhanced Plus's helm panel takes a
  finger and a freed mouse, and at the helm a pad's d-pad is the helm's; the classic skin and the map's size stand.
- **BoatDisembark's `'` (U6, PLAUSIBLE) - Mac's call.** It is Firefox's Quick Find key and the world leaves an unspent
  key's default to the browser (KB1). Either a new preventDefault rule for registry keys (and `swallowBrowserKey` would
  also eat `'` in the chat) or a new default key; neither is an audit's to choose.
- **The boats' speed dials online (O5) - Mac's call.** They stay each player's own, as Travel Options' journey and
  Horse Cart and Cargo are; only Iliac Puddle No More's swim multiplier is the room's (MODS-ONLINE-5).
- **The wave paints (D1) - Mac's call, and it needs the ARENA2.** The two committed paints
  (`vendor/come-sail-away/Textures/112395_2-base*.paint.png`) fold into one 64x64 tile with no conflict, in step with
  the snow texture's phase (base1 is base0 shifted the 60 rows derived.json records). An author's tileable overlay drawn
  on the same grid would do exactly that; so would a re-shaded TEXTURE record, which the CSA-A measure (exact 4x4 patches
  against every record, colour mappings against the snow alone) could not exclude. The test that settles it: fold each
  paint to its tile and fit it against every 64x64 record at every phase with a per-record colour mapping. Until then the
  record's "what the author drew over it" stands, marked open here.
- **A destroyed flame foe seen as a body (M1's edge) - a relay deploy.** A player who joins under another's seat
  without having destroyed a flame foe at its own build (a Recall into the abyss, a load's prepare) sees the runner's
  destroyed flame foe as a body: the stream can say only "dead". A "destroyed, no body" word is a wire field. Beside
  Ocean Holes' (15).
- **A transition taken from the helm.** OnTransition does not stop sailing - nor does the C#'s; whether a door is ever
  within reach of a helm was not established. Recorded.
- **The unit-6 bind (lens M, harmless as it stands).** Moving the per-call surface bind into the frame block survives
  every pin, because every foreign pass that binds unit 6 calls `markForeignPass`; a pass that rebinds it without would
  show it. Likewise `endPanelFrame` restores `_dwFog` and not `_dwColumn` - no host opens a panel mid-world-frame.
- **N2's raw fallback** keeps the pre-branch pick when nothing lands, so a player levitating under a ceiling can still
  elect the roof.

## What this audit could not see

No ARENA2 here: the 250 data-gated tests skip, and no scene could boot with real art (the lenses drove the real
modules over stand-ins and the hosts' own code sliced out of their source). No CI workflow supplies the data either, so
the gated tests run nowhere automatically - Sea-Update.md's "with ARENA2_PATH set, the whole suite passes" dates from
`04efd7e8`, before CSA-J and both merges, and was not run again at this head; the 19 gated triage mutants and N6's
bake are unexecuted. No real GPU (SwiftShader only - a mobile compiler reading WAVE_FS's 64-entry table by a runtime
index is untried), no live multi-client room, no Firefox, no phone and no pad. Both vendored assemblies' permission
lines read RECORD OPEN.

## The deploy

The relay (`server/`) and the account service (`server-account/`) are untouched: no relay deploy, nobody dropped.
