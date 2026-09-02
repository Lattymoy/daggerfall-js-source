# The Road to 1:1 - the closing campaign

Opened 2026-09-01, straight off AUDIT 44's measurement
(`Port-Status-2026-09.md`). Mac's call: get all of it done. This page
is the campaign ledger - what remains between the port and a finished
1:1, organized into waves, each wave run as a worktree fleet with an
adversarial review and its own merge to main. A struck item names the
wave that closed it.

Deliberate departures stay departures and are NOT on this road: the
voxel character engine, the enhanced skin and visuals, the Morrowind
lane, mod-injection infrastructure (WorldDataReplacement, texture/mesh
replacement, custom guild/item/effect registries, quest-pack
discovery), AdvancedClimbing/Rappel/Hanging (Ledger A), the
SoundFont/Melody synth (no asset), shadow maps, and SDF fonts.

## Wave A - the slice band - CLOSED 2026-09-01

All twelve groups landed (34 slices done, 14 not-a-gap with citations,
24 precise recorded stages - the wave reports carry both lists), then
an 18-finding adversarial review round closed on top of it: the season
re-skin's ground outage, the fast-travel season ordering, the activate
gate's overlay/clickDelay/touchSpell trio (the critical: a click on an
open window activated the world behind it), the mastery-box ordering,
and four test-quality repairs. Recorded stages that belong to Wave B
(the court backdrop, the combo held-order, the prison accelerator)
wait on B1's window stack.

- **A1 season-calendar**: texture season reads the CALENDAR
  (DaggerfallDateTime.SeasonValue), not a `?season` URL param - climate
  swaps, winter sunlight term, sky selection; the param demotes to a
  debug override.
- **A2 items-economy**: daily shelf/container restock (stockedDate),
  book prices from BookFile instead of template 2500, shop-shelf
  arrows minted at condition 0, SplitStack mints a fresh template item.
- **A3 legal-prison**: the prison screen (serving time, release), and
  the jail-skip trio - PositionPlayerAtLocationEntrance,
  preventEnemySpawns, ClearEnemies (arrestFlow's own FLAGGED list).
- **A4 save-import**: envelope stragglers (resistances,
  skillsRecentlyRaised, minMetalToHit, previousVampireClan,
  timeToBecomeVampireOrWerebeast, playerTeleportedIntoDungeon);
  classic import stragglers (building-level MAPSAVE, the native bank
  record, LegacyArtifactIndexBitfieldCheck).
- **A5 ai-residue**: enemy levitation and invisibility/Shade as live
  effect sources for the ported gates, fall damage billed to exterior
  foes and guards, the Seducer transform pair.
- **A6 motor-residue**: the -0.28 doorway head-dip
  (HeadDipHandling/StandingHeightAdjustment), PlayerMoveScanner's
  FindStep/FindHeadHit/HitSomethingInFront, controllerSwimHeight 0.30
  with DoSinking/DoUnsinking, FreezeMotor on teleports.
- **A7 ui-pickers**: a real VerticalScrollBar (draggable thumb),
  item-scroller thumb + red/green arrow states + arrow click sound,
  list-picker double-click/Return use and hover colours and the
  zeroed selected-row shadow law, the message box's scrolling variant
  and its IMAGE PANEL - and with it, paintings: the display and the
  dfRand-driven variant pick TextRsc records.
- **A8 input-parity**: the DaggerfallShortcut/HotkeySequence binding
  table, key combos through ControlsConfigManager's duplicate phases,
  the FLAGGED pointer-parity layout (Mouse0 activate/cast). Gamepad
  may record as its own follow-up if the browser mapping fights back.
- **A9 talk-residue**: bulletin boards mounted (the activation and the
  window), the questor NAME BANK behind the %pqn seam, the
  GrammarManager.ProcessGrammar pass on greetings; RUMOR.DAT's
  standalone fetch VERIFIED against DFU first (it may be
  classic-import-only there too - then it is not a gap).
- **A10 world-misc**: cross-host Recall anchors, the ship
  board/disembark CacheScene/RestoreCachedScene, DungeonLightHandler's
  per-light UnscaledBlockRange rule.
- **A11 advancement-ui**: the "master of" box (TEXT.RSC 4020) +
  ArenaFanfareLevelUp on a primary skill's 100, skillsRecentlyRaised
  + the sheet's highlight, the char sheet's own leveling arm
  (statsRollout on ReadyToLevelUp).
- **A12 combat-lefthand**: the left-hand weapon - ToggleHand /
  SwitchHand / usingRightHand, the classic import's
  usingLeftHandWeapon, the FPS draw's mirrored arm.

## Wave B - the interacting band - CLOSED 2026-09-01

B1-B4 landed and merged (PR #49, with the incident fixes aboard - see
`Incident-2026-09-01.md`): the window stack whole with the FLAGGED
single-slot refusal retired, the hostility model with the indoor watch
composed from both groups' halves, exterior swimming/drowning with
underwater fog in both hosts, and the live castle/tavern/residence
flags. B5 landed on B1's stack the same day: the prevent-rest registry
(GameManager.cs:52, :637-675) polled at TickRest's two positions, the
second top-window test with its totalHours-already-counted quirk, the
lazy prevented-message producer. The groups' recorded remainders live
in the wave reports.

- **B1 window-stack**: a real window stack in the modal hosts - the
  foundation the rest-window pause/resume and layered boxes need.
- **B2 hostility-model**: MakeEnemiesHostile as a real state - passive
  teams turn, trespass consequences, the exterior static-door bash
  arms, wandering-guard conversion
  (MakeNPCGuardsIntoEnemiesIfGuardsSpawned), and SpawnCityGuards'
  indoor lowest-outer-door arm.
- **B3 exterior-water**: a submersion model for the streaming hosts -
  deep-water detection, breath/drowning above ground, the
  OnExteriorWater/Path/StaticGeometry motor methods and their footstep
  arms, shallow-water splashes, exterior underwater fog.
- **B4 castle-interiors**: isPlayerInsideCastle live (both flavors DFU
  distinguishes), the castle questor arm, the Castle Daggerfall magic
  doors hack, IsPlayerInsideTavern/Residence flags.
- **B5 rest-residue** (after B1): the per-frame
  GetPreventedRestMessage poll, pause/resume of a running rest,
  UpdateNpcPresence on pop, the toggle-binding close.

## Wave C - the two arcs - CLOSED 2026-09-02

Both arcs landed on the branch, each through its own adversarial
review round (the C1/flight-1 round: 12 confirmed, 11 fixed, one
recorded; the flight-2 round: 30 findings verified, 27 confirmed and
all 27 fixed, three refuted - including the CRITICAL exterior
rotation-sign inversion and the injected-vs-default water tint).

- **C1 the save/load window**: the classic multi-slot UI over the
  existing slot store (thumbnails, naming, delete), classic-save
  import surfaced beside it - with its seven law closures (the loading
  defer, the SW_TEXT strings, the info clear arm, the rename green,
  the outline law, Enabled=false not drawn, the one-row wheel) and the
  pause window's save/load as a PUSH on B1's stack.
- **C2 the automap pair**, ten judged stages in two flights. Flight 1
  cut the shared halves (`systems/automapModel.js` + the AABB-shape
  fix that had left the dungeon reveal probe dead, the renderer's
  panel bracket, `ui/automapCamera.js` pure, `ui/automapChrome.js`).
  Flight 2 built the windows: S5 the native dungeon window (UNLIT
  geometry pass, DFU's controls and hotkey table, the OnPush/OnPop
  handshake), S6 the shader's above-slice half with the water tint
  and wireframe lines, S7 beacons/markers/picker/hover, S8 notes and
  teleporter connections with every click verb, S9 the
  interior-building arm with DFU's quirks reproduced at the site, S10
  the exterior town map as DFU's own composition with the plate
  anchor moved onto the building's Position (every plate in every
  town moved). Residue, all at `ui/exteriorAutomapWindow.js`'s
  header: the residence-with-active-quest plate arm, the eight button
  tooltips, the two reveal-buildings console verbs.

The whole of Waves B5 and C - plus the bow salvage and the incident
record - is the parked deploy batch: gated on the branch, waiting for
the owner's eyes before it merges to main (incident law 2 - the
automap windows are first-ever-rendered surfaces).

## The standing watches (not wave work)

- The pause architecture stays per-host; every new host takes the gate
  by hand. B1's window stack narrows the class.
- The FLAGGED/INTERIM ledger (Home.md open flags) - items above
  strike their flags as they land; what remains after Wave C is
  re-triaged.
- AUDIT 44's overflow tail - re-read, not re-found, at the next audit.
