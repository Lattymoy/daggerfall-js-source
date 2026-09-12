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
(~~the court backdrop~~ **CLOSED at ROAD-B B5**, ~~the combo held-order~~
**CLOSED at ROAD-G G3 2026-09-04**, ~~the prison accelerator~~
**CLOSED at ROAD-B B5**) ~~wait on B1's window stack~~ - B1 landed
2026-09-01 and B5 landed on it the same day (see the B5 bullet below).

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
  UpdateNpcPresence on pop, the toggle-binding close - and, on the same
  stack, the two recorded stages Wave A routed here: the courtroom
  backdrop, ONE window on CORT01I0 with every box of the trial pushed
  over it (`ui/prisonScreen.js:62`, `scenes/arrestFlow.js:121`), and
  the prison screen's held-Back accelerator, DFU's raw Escape poll
  rather than a binding (`ui/prisonScreen.js:68`). Both pinned by
  `test/roadb_court_backdrop.test.js` (10).

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
  town moved). ~~Residue, all at `ui/exteriorAutomapWindow.js`'s
  header: the residence-with-active-quest plate arm, the eight button
  tooltips, the two reveal-buildings console verbs.~~ **CLOSED: the
  plate arm and the tooltips at ROAD-D D5, the two console verbs at
  ROAD-E E3** - that header narrates both closures
  (`ui/exteriorAutomapWindow.js:79` and `:100`). CORRECTED with the
  strike: the shipped tooltip table is TEN rects
  (`ui/automapText.js:167`) - nine buttons and the compass PANEL - not
  eight; the header says TEN too.

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
E7 took `GetValue`'s empty-string arm (`systems/talkMacros.js:289`);
E5 took the docked bar's occlusion (`ui/hudLarge.js:75`); and E1
narrowed while E3 closed the two console verbs
(`ui/exteriorAutomapWindow.js:96` - the site id the flag list was
measured on; the closure narrates at `:100` today) by building the
console host they were waiting on. The SHIP LANDING then took a seventh
(`scenes/world.js:3581`, the two ship pixels): the owner supplied the
real MAPS.BSA, the pixels turned out to carry the two "Your Ship"
locations rather than open sea, and the boarding became an ordinary
location arrival. **ROAD-F then took three more**: GS1 closed the
guild-service popup above ground (`scenes/worldModes.js:1921`) with the
replace-mode mount door plus the sweep of the subtree under it, and GS2
reworded `systems/skills.js:164` - a RETIREMENT RECORD whose only claim
on the list was that it wrote the marker down in the past tense.
DR1 (2026-09-03) took another
(`scenes/dungeonContext.js:1896`, the standalone dungeon host's two
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
loaded pixel all ship). That leaves **6** open flags as
of this wave - the count `node tools/regenOpenFlags.mjs --check`
answers, and the only count this page may state - each with its
blocker named at the site: no asset in the repo (the PlayerTorch
prefab), a DFU original that does not exist (the enhanced menu's
keyboard), or the owner's call (the gamepad layer, the pause
dropdown's mod rows).

## Wave G - the audit's deliberately-left remainder - CLOSED 2026-09-04

AUDIT 58's record ended with a list of things it had measured and left
on purpose, each "a separate slice". Wave G ran that list as seven lanes
on worktrees cut from main, two adversarial review rounds (G1-G4, then
G5-G7: 77 findings judged, 60 confirmed, 17 refuted) and seven review-fix
lanes, integrated in order and squashed one commit per lane.

- **G1 the foe pools** - `createCityGuards` takes `makeAreaHostile`, so a
  struck PASSIVE watchman turns the area in every host that mints guards
  (GameManager.MakeEnemiesHostile); the watch transforms under the
  Wabbajack through `removeGuard` and the pool-membership router in both
  the street and the building; SoulBound's break release and the Sanguine
  Rose's Daedroth stand INDOORS through the interior pool
  (PlaceFoeBuildingInterior). The review struck a false "live defect"
  rationale from seven places and made the guard aggro door reachable
  from a zero-damage ARROW in all three arrow hosts.
- **G2 the fixed-city host** - `createPlayerMagic` takes the three-arm
  pool/sinks shape; CreateFoe's OUTDOOR placement arm ships over an
  encounter pool this route mounts for the first time; the find-place
  gate answers when the place is the current location. The review found
  the cast engine deaf to the quest machine (no OnNewReadySpell /
  OnCastReadySpell doors) and seven consequential seams unpinned - all
  held now.
- **G3 the ordered held-keys ring** - GetUnaryKey / ModifierOnlyHeld
  ported; the review showed a stateless walk is NOT
  `modifierHeldFirstDict`, so the dict is ported as per-host STATE
  (raised only on a clean whole-set frame, lowered only by the modifier's
  release). The AXES + JOYSTICK half of `systems/inputActions.js` stays
  FLAGGED: no gamepad layer, an owner call.
- **G4 the overlay mouse-up seam** - the row's named remainder had
  already shipped with the E-group; what was left was the last three
  drag latches (the spellbook, the icon picker and, found by the review,
  the chargen wizard's picker bar) releasing on the button rather than
  the next hover, and the spellbook's F159/F170/F180 drag is no longer a
  departure.
- **G5 the drop icons and the bank list's scroll bar** -
  UpdateRemoteTargetIcon's two flat arms, the three cycling handlers over
  DaggerfallLootDataTables, the icon riding a dropped pile through the
  cache and the save, and the purchase list's [106,39,7,48] rail. The
  review fed the CORPSE its own flat (CreateLootableCorpseMarker) and
  turned six vacuous pins behavioural.
- **G6 the mouse/advanced controls window** -
  DaggerfallUnityMouseControlsWindow 1:1 over the controls grid's own
  staged dicts, HorizontalSlider.cs as a component with one home, the
  OnSavedKeyBinds ordering, and the sensitivity clamp widened to DFU's
  0.1..16.0 end to end. The review's two criticals were one seam: the
  grid forwarded hover but not RELEASE, so the slider latch never
  dropped. Ledger `:596`'s live clause is the joystick window alone.
- **G7 the records** - fifty stale `exterior.js:NNN` cites re-resolved
  by content and pinned as a set (the probe fleet's shared ladder cite
  resolved at both ends); the doctrine gate widened from the DEPARTURE
  shout to the `Ledger A` cite, with three owed section A rows written
  and the engine-PRNG row carrying a LIVE roster the pin measures against
  the tree; the transport window's five accelerators wired to the table
  (the exit letter had none).

The open-flag count did not move: **7** before, **7** after, because
nothing here was on the board - it was the audit's list. What the wave
left is the owner-gated set the status page already names (the torch
prefab values, the gamepad layer and its window, the enhanced menu's
keyboard, the pause dropdown's mod rows, the mod CIF door, the FaceUV
residual, the .SAV zip arm, the cross-pixel Recall), plus two things the
lanes wrote down at their sites: the watch's Wabbajack transform on the
fixed-city route above ground, and PlayerEntity.Update's per-minute
encounter roll on that route. Suite at the merge: 6,479 tests, 0 failed.

## The tail - 2026-09-05

The two things the Wave G lanes wrote down at their sites are closed:

- **The watch's Wabbajack transform on the fixed-city route.**
  `exterior.js`'s enchant arm returned for a struck watchman ("no
  remove/spawn pair to route through"); it takes the world host's
  route now - the guard pool removes its own record, the encounter
  pool re-stands (`WabbajackEffect.cs:64`, Knight_CityWatch is an
  EnemyEntity).
- **PlayerEntity.Update's per-minute loop on that route.**
  `runEncounterTick` in `exterior.js`, the world host's twin: per
  elapsed minute the intermittent roll (placed through DFU's ring with
  the arm's band, a flyer lifted 1.5), the two passive-guard rolls
  levying Criminal_Conspiracy through the witness arm, the
  once-per-Update NPC-guard conversion, the suppression flag gating
  and clearing; driven from the frame in exterior mode and from the
  rest advance. On the way: `:488-491`'s "no spawn while swimming"
  had no reader in either host - both skip the roll now (the port has
  no ship state to ask for the other half).

Pins in `test/exteriorfoes.test.js` (the loop's shape, both swimming
gates, both callers, the watch route); `test/restwhere.test.js` names
both homes of the catch-up. Open flags: 7.

Its review (two lenses, two refuters each; 3 confirmed, 0 refuted):
the vampirism turn raised the clock and never set PreventEnemySpawns
(`VampirismInfection.cs:157` sets it BEFORE the raise) - `deployInfection`
sets it now, one home for both hosts; both loops ran in exterior mode
only, so a tavern sleep or a dungeon visit was BANKED and replayed as
outdoor rolls at the door - they run in every mode and hand
`IsPlayerInside`/`IsPlayerInsideDungeon` to the roll, which skips the
indoor minutes as DFU does, with the conversion sweep held in a
dungeon (`:768-770`, no location object); and the watch-route pins had
matched the comment, not the arm - they count the arm's returns now.

## Wave H - AUDIT 62's deliberately-left remainder - CLOSED 2026-09-07

`Audit-62.md` ended, as `Audit-58.md` had, with a list of things it
measured and left on purpose. Wave H ran that list as three lanes on
worktrees cut from main after the audit merged, each lane followed by
its own adversarial reviewer and a fixup round (9 review findings, all
confirmed and applied; nothing refuted), integrated in order and
squashed one commit per lane.

- **H1 the enemy arrow origin** (`characters/enemyTargets.js`,
  `scenes/dungeonContext.js`, `scenes/exteriorFoes.js`) - both archer
  pools loosed from a hardcoded `feet + 1.2`. `GetAimPosition`'s
  non-player arrow arm is the caster transform + forward * 0.6 + the
  controller height / 3 (`DaggerfallMissile.cs:528-537`): one exported
  helper, `enemyArrowOrigin`, both pools call it. A giant bat looses at
  2.13 and a rat at 0.98 where one constant said 1.2.
- **H1b the crouch dip** - `GetAimDirection` adds 0.05 DOWN, after the
  normalisation and never renormalised, when the shaft is an arrow, the
  target is the player, and `PlayerMotor.IsCrouching` (the latched
  state, not the live height - a 0.9 controller is also the swim case).
  `arrowAimDirection` is the one body; `playerCrouching` rides
  `sensesContext` beside AUDIT 62's `playerHeight` from all four hosts.
  The review round found the "only at the PLAYER" half unpinned at the
  exterior archer (hardcoding it left the suite green) and drove it.
- **H1c the player's own arrow origin** - camera position, then 0.11
  along the camera's own -up (the drop tilts with the pitch) and 0.15 to
  the right, or the LEFT under `FPSWeapon.FlipHorizontal`
  (`:540-550`). `playerArrowOrigin` in `systems/spellcast.js`, applied at
  the two arrow SPAWN seams (`combat/arrowFlight.js` and the dungeon's
  `fireArrow`) because DFU runs `GetAimPosition` inside the missile - so
  no host can forget it and an enemy shaft is not offset twice.
- **H2 the area-of-effect sweep** - `DoAreaOfEffect` is an
  `OverlapSphere` at radius 4.0 against COLLIDERS (`:477-510`): a target
  is hit when the sphere overlaps its capsule. One helper,
  `sphereOverlapsCapsule`, reusing AUDIT 62's inset-axis arithmetic
  (`missileHitsCapsule` is now a call to it); `sweepFoes` takes it for
  foes and `explodeAt` for the player at its LIVE height, threaded from
  every caller including the enemy AreaAroundCaster arm. The review
  round pinned the two producers of that live height, which only the
  consumer had pinned.
- **H3 the seasons refresh, per key** (`world/seasonReskin.js`,
  `scenes/world.js`) - the refresh seam raised ONE flag on the first
  qualifying pixel and rebuilt the whole grid. It collects the
  qualifying KEYS now (stale install AND a batch on a managed archive -
  AUDIT 62 F4's filter, per pixel), a pixel published across an install
  marks only its own key, and the classic winter flip still marks every
  key. The review round found the lane's stated reference law INVERTED:
  `SetMaterial`'s early return keys on the archive INDEX
  (`DaggerfallBillboardBatch.cs:283-284`), which a seasonal-atlas swap
  under the same index does not change, so the mod's walk is FORCED and
  re-applies every batch on a managed archive - the port's per-key
  walk matches that, and the five places that said otherwise were
  corrected. The `_seasonHoldKey` membership guard gained the pin the
  lane had claimed it already had.
- **H4 the texture-replacement swap** (`formats/color32Order.js`,
  `systems/textureReplacement.js`) - with a user texture pack installed,
  the first swapped record THREW: `decodedTexture` answered
  `{width,height,data}` where the upload path reads `colors`; and even
  with the field right the rows were inverted (a PNG decodes top row
  first; every Daggerfall texture uploads bottom-up - AUDIT 62 F26's
  lesson). Fixed where a replacement ENTERS, so `decodedTexture` answers
  a colour32 in `getColor32` order and neither consumer arm changed;
  `toColor32Order` MOVED to a shared module (the seasons door imports
  it). The review round found the orientation pins never crossed the
  production door - dropping the flip left the suite green - so both
  upload arms now decode through the real `preloadTextureArchive`.
- **H5 the dead Rest arm** (`scenes/world.js`) - two byte-identical
  `act === 'Rest'` arms in one keydown ladder, the second unreachable.
  Deleted, its comment's substance folded into the survivor; the three
  pinned cites the shift broke were re-resolved with the law and the
  other 24 by the integration's provenance pass.
- **H7 two pin-quality defects** - AUDIT 59 F2's pin read `destroy()`
  through a 3000-character window over a 3769-character body; it walks
  the balanced braces now. `LightningFlash`'s `timeScale` option existed
  at five sites and had never been built off 1; pinned against the mod's
  own `LightningFlash.cs:52-79` at both the divide and the multiply.
- **H8 the touch code-lift guard** (`ui/touch.js`, a TI1 departure) -
  the held/held case AUDIT 62 named was already closed by F8's review
  (`liveNeeds()` covers both directions, a direct shared code included;
  pinned both ways now). The case still OPEN was the MOMENTARY one: the
  menu button's tap synthesised its keyup directly and never passed the
  guard, so a tap on a combo-bound action lifted a modifier the stick
  still held. The review round corrected the pin's derivation (the
  shared-code state is reachable through `LoadActionKeybinds`'
  raw map-set, `InputManager.cs:1950-1969`, and forbidden by
  `SetBinding` in either order) and replaced a whitespace-matching
  shape test with a structural one.

Left by the lanes and closed the same day as THE TAIL (one solo pass,
`bible/05-Combat/Combat.md`): the four point-contact sites the capsule
law had not reached (the host arrow flight's player and foe tests, the
player's shafts and spells against a foe in the dungeon and `hostMagic`)
read `missileHitsCapsule` now, the flight takes the player's live
height; the three flights cast for `displacement.magnitude +
ColliderRadius` along the unit ray through one `missileReach`, so a
crouch-dipped direction reaches as DFU's does; and the dungeon archer
takes `BowDamage`'s two-arm split - it aims at its selected target,
keys the dip on whether that is the player, and its missile remembers a
foe target for the impact fork. Still left: the M-TEX door's non-Albedo
maps have no consumer yet; and nothing here has been seen in a browser -
the loose PNG landing the right way up on a flat and a tap on hardware
are the two surfaces that want eyes.

Pins: `test/roadh_missiles.test.js` (12), `test/roadh_seasons_tex.test.js`
(5), `test/roadh_residue.test.js` (8), `test/roadh_tail.test.js` (4);
every one checked dead under a mutation that reverts its law. Open
flags: 7.

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
