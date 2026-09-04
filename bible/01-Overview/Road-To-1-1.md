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

The whole of Waves B5, C and D - plus the bow salvage and the incident
record - is the parked deploy batch: gated on the branch, waiting for
the owner's eyes before it merges to main (incident law 2 - the
automap windows are first-ever-rendered surfaces).

## The closeout - 2026-09-02

The campaign audit ran as AUDIT 44 did (thirteen finder lenses over
everything since `d6e9f01`, every finding adversarially verified): 56
verified, 42 confirmed and all 42 fixed, 14 refuted. The one critical
was the campaign's own: B5 handed CORT01I0 a fresh palette on the
incident's own-palette law - a law that belongs to the six palettized
IMGs and not to the courtroom - so the court screen drew solid red
while the suite stayed green, and the pin that should have caught it
asserted the defective line. The incident sweep now walks all of
`src/` for the six real names and asserts the complement. The record
is `Audit-53.md` - filed as 49, and renumbered after two lanes took
that number the same day, so `Audit-49.md` is the lab's grass and
weather audit and not this; the re-measured status is
`Port-Status-2026-09-02.md`.

The open-flag re-triage (145 entries, five chunks, every site opened
against its DFU original) found 69 STALE (the thing shipped), 24
NOT-A-GAP (DFU does the same), 42 CLOSABLE and 10 BLOCKED. The 93
stale and not-a-gap sites were rewritten at their sites to say what
shipped or to carry the DFU citation; the 42 closable became WAVE D.

## Wave D - the closable band - CLOSED 2026-09-02

Ten groups off the re-triage (`scratchpad/road/groups/wave-d.json`),
39 of 42 slices shipped and the three narrowed with evidence at their
sites; its review round confirmed 19 findings (11 major, none a wrong
law - eight pins whose claimed mutants did not die, three paraphrased
strings whose Internal_Strings rows were in the tree all along, and
the record), all fixed.

- **D1** DialogShortcuts reaches the coven, guild-service and tavern
  windows - two accelerator letters the port had guessed wrong (the
  coven's SUMMON is D, the tavern's EXIT is G), the guild popup's
  per-service middle button (Services.cs:408-459), and the tavern
  accelerators' Ledger A row struck.
- **D2** DFU's three-slice thumb art on the picker and spellbook bars.
- **D3** REST00I0/01I0/02I0 on the rest window.
- **D4** the fade layer (FadeBehaviour.cs) for teleport and travel, and
  the travel popup's key-up deferral.
- **D5** the exterior automap's quest-residence plate and its tooltips.
- **D6** the bank's shipyard arm and ship ownership live.
- **D7** the trade window's equipped filter, the INVE12I0 repair mode,
  potion recipe tokens, ingredient tooltips.
- **D8** the dungeon host's four residues: the shared arrow law, action
  flats that move, the enchant ctx hoisted into `scenes/hostEnchant.js`
  and mounted, the chargen flow as a real overlay.
- **D9** eight systems residues (ranged-spell vetoes, Skeleton's Key,
  held-bundle absorption, guard placement, knightly legacy flags,
  athleticism, the building directory over subrecords, the quest-item
  filter); gold-as-counter stays flagged, narrowed.
- **D10** book fonts, large-HUD offsets, talk OKAY selection, spellbook
  effect popups, the guild popup in both modes, the TFAC portrait; the
  docked bar's occlusion and the quest static-NPC arm stay flagged.

What remains after Wave D and the closeout tail (the spell-hand port,
`paused()` adopted by every host, six section C rows struck) was the 19
flags of `Home.md`. Wave E retired SEVEN of them (E2, landing last, took the chargen picker's scroll-bar hit) - one lane apiece, each
blind to the others until the squash: E6 took the spell hands' release
frame (`combat/fpsSpellCasting.js:178`) and the clear-path term
(`characters/enemyCasting.js:91`), closing section C's `playSound` row
with them; E4 took gold-as-a-bag-stack (`systems/inventory.js:48`);
E7 took `GetValue`'s empty-string arm (`systems/talkMacros.js:268`);
E5 took the docked bar's occlusion (`ui/hudLarge.js:75`); and E1
narrowed while E3 closed the two console verbs
(`ui/exteriorAutomapWindow.js:96`) by building the console host they
were waiting on. The SHIP LANDING then took a seventh
(`scenes/world.js:2926`, the two ship pixels): the owner supplied the
real MAPS.BSA, the pixels turned out to carry the two "Your Ship"
locations rather than open sea, and the boarding became an ordinary
location arrival. **ROAD-F then took three more**: GS1 closed the
guild-service popup above ground (`scenes/worldModes.js:1687`) with the
replace-mode mount door plus the sweep of the subtree under it, and GS2
reworded `systems/skills.js:164` - a RETIREMENT RECORD whose only claim
on the list was that it wrote the marker down in the past tense.
DR1 (2026-09-03) took another
(`scenes/dungeonContext.js:1720`, the standalone dungeon host's two
window seams) by BUILDING them: "a DFU original that does not exist"
had been that flag's stated blocker, and it was a claim about the
SCENE, not about the two windows - both of which have DFU originals
and both of which that host could already draw, tick and click.
THE FIXED-CITY HOST then took the next
(`scenes/exterior.js`'s PX3, "this test host mounts no quest bridge"):
QX1 builds one over the route's single loaded city, so the pause
window's Quests tab, the LOGBOOK button, TickRest's per-hour tick, the
Status box's macro context, a quest letter's name and the automap's
residence plates all read the machine instead of saying they cannot -
and TP2 NARROWED the flag beside it, that host's Recall, to the one
cross-LOCATION jump a route with no streamer cannot make (set-anchor,
the same-interior move and the whole cross-context arm INSIDE the
loaded pixel all ship). That leaves **7** open flags as
of this wave - the count `node tools/regenOpenFlags.mjs --check`
answers, and the only count this page may state - each with its
blocker named at the site: no asset in the repo (the PlayerTorch
prefab), a DFU original that does not exist (the enhanced menu's
keyboard), or the owner's call (the gamepad layer, the pause
dropdown's mod rows).

## The standing watches (not wave work)

- The pause architecture stays per-host - DFU has one
  UserInterfaceManager and one `isGamePaused`, the port has one window
  stack per modal host - but a new host no longer takes the GATE by
  hand. B1 landed the stack; ROAD-tail landed its PAUSE: all four
  stack-owning hosts (`scenes/worldModes.js`, `scenes/dungeonContext.js`,
  `scenes/townTalk.js` and the standalone `scenes/interior.js`) answer
  with ONE reader over `ui/windowStack.js`'s `paused()` latch, and the
  two outdoor hosts compose the union of those answers once each rather
  than at every gate. What is left of the watch is that union: a fifth
  host still has to say which stacks are live over its frame. Swept by
  `test/roadb_host_pause.test.js` (no file outside the module decides a
  pause by counting depth; the callers of `paused()` are exactly the
  stack owners).
- The FLAGGED/INTERIM ledger (Home.md open flags) - items above
  strike their flags as they land; what remains after Wave C is
  re-triaged.
- AUDIT 44's overflow tail - re-read, not re-found, at the next audit.
