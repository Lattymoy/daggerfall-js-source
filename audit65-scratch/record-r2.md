### The skills page and the player's body (constants: CV-1, CV-2)

- `TextProvider.GetSkillSummary` (`TextProvider.cs:489-529`) formats
  its value token as `GetLiveSkillValue(skill)` at `:503`, and
  `ShowSkillsDialog` builds EVERY row from that one member
  (`DaggerfallCharacterSheetWindow.cs:288/:296/:301`) - the permanent
  value is never read on that path. The port drew the row off the
  permanent `entity.skills` array while the hand-to-hand damage row four
  lines below it (AUDIT 63 F34) already read live, so a lycanthrope read
  `Hand-to-Hand 30%` on one line and a damage range computed from 60 on
  the next. `charsheet.js:659` and `enhancedCharSheet.js:126` read
  `skillValue` now, which moves the enhanced skin's meter with its
  number (`enhancedMenu.js:1547-1548`) - correctly, since the attribute
  bars beside it were already live. The art-less `_drawFallback` pane
  still prints `''` for an absent skill (both refuters: decide the
  blank case first); DFU has no such pane.
- DFU's area and contact queries meet whatever collider each entity
  wears (`DaggerfallMissile.cs:481`, `:339`), and the two prefabs
  differ: `PlayerAdvanced.prefab:81-85` is 1.8 / 0.35 / 0.06 against the
  enemy's 1.8 / 0.4 / 0.05, and neither `PlayerHeightChanger` nor
  `SetupDemoEnemy` ever writes a radius. One module constant measured
  both bodies, so the player carried a body 0.10 wider than DFU's on
  every missile, arrow and blast. `sphereOverlapsCapsule` /
  `missileHitsCapsule` take a `bodyRadius` - at the axis inset as well
  as the compare - defaulting to the foe's; `PLAYER_BODY_RADIUS` is
  `player/motor.js`'s own `CAPSULE_RADIUS`, imported not restated (skin
  width is PhysX's penetration allowance; DFU casts at the raw
  `controller.radius`). Five player sites pass it. THIS STRIKES
  `Characters-Arc.md`'s "sweeps the player's own capsule ... exactly as
  the foe arm does" and narrows `Testing.md`'s arrowfoes row to each
  body's own radius. The foe's 0.45 stays: the refuters split on it (A:
  skin-inflated, the query radius is 0.40; B: AUDIT 62's record pins
  it), and a split is a refutation.
- *Review round:* clean. Thirteen mutants, thirteen red - the motor.js
  import is load-bearing (0.35 -> 0.36 reddens three CV-2 tests), and
  the axis inset is pinned separately from the compare, the half the
  finder warned could be missed. The reviewer's own sweep found the two
  doc sentences above and one more thing left (below).

### The reference cites (cites: RC-1, RC-2, RC-3)

- Comment-only and line-count-neutral in every file: RC-1's one wrong
  FILE copied to four sites (the ReservedKeys law is
  `InputManager.cs:73`'s empty array, exposed `:174-177` and consulted by
  `DaggerfallControlsWindow.cs:410`, whose own `:73` is a brace - both
  files carry something at :73, which is how the slip survived); RC-2's
  invented member (`IsAlreadyPlaced` is not DFU's name for anything -
  the double-injection guard is `IsAlreadyInjected`,
  `GameObjectHelper.cs:978`, called `:950`, over the list at `:926`,
  where worldModes cited a BLANK `:917` at both of its collectors while
  dungeonContext already had `:926` - two siblings on one list,
  disagreeing); RC-3's five single-line cites that QUOTE the line they
  name, each one digit off (`StaticNPC.cs:155`, `:158`;
  `DaggerfallStartNewGameWizard.cs:571-572`, `:574`;
  `SerializableEnemy.cs:116`). The pin is in two parts, as both
  refuters required: a text half that holds without a checkout (the
  invented name is walked for; the ReservedKeys wording at all four
  sites) and a resolve half behind its OWN `missingDfu` gate, so a
  missing `.cs` cannot silently skip ROAD-G G4's slice either.
- *Review round:* the lane's own record row had the RC-2 evidence wrong
  ("both hosts cited a blank :917"), and the residue it did not sweep
  was in the file it edited (`Testing.md`'s audit64_layout and
  audit24_scenes rows, and RC-3's own `:149-154` for `:149-155`) - fixed
  at integration with the test and arc residue the lane had listed, and
  the pin's walk widened from `src/` to `src/`, `test/` and `bible/`,
  with the records that QUOTE the retired name (this file, `Testing.md`,
  the pin) the only files allowed to carry it. Eighteen mutants,
  eighteen red; a CI simulation without the DFU clone reddens the text
  halves and lets a resolve-only mutant through, which is the gate
  working as designed.

### The wheel (wheel: UI-5)

- AUDIT 64 F52 routed the classic pack's wheel by what the pointer is
  OVER, which is right - `BaseScreenComponent.Update`'s scroll block
  (`:725-736`) is guarded by `mouseOverComponent`, which `Update`
  recomputes from the live scaled mouse position at `:577-594` - but it
  routed by a REMEMBERED point: `nativeInventory._mouse`, seeded
  `[-1,-1]` (`:354`) and written by `hover()` alone (`:1055`), while
  every host seam handed the window a bare `wheel(dir)`. Opening the
  pack with the Inventory key releases the lock without moving the
  cursor, so the browser fires no mousemove and the first notch hit no
  rect; the same notch after a one-pixel nudge worked. The point rides
  the notch now: `wheel(dir, vx = this._mouse[0], vy = this._mouse[1])`,
  the remembered point only the fallback for a caller with none.
- THE FOUR HOSTS: `world.js` and `exterior.js` own no wheel arithmetic
  and hand the raw event on, so both are WIRED through `townTalk.js`'s
  seam and `worldModes.js`'s (BOTH arms - the interior slot and
  `dungeonCtx.overlayWheel`); `dungeonContext.js` takes
  `overlayWheel(dir, vx = -1, vy = -1)`; the standalone `dungeon.js` and
  `interior.js` are wired directly. Each host computes the point with
  its own hover arm's arithmetic, so a notch outside the letterbox now
  routes nothing - which is `mouseOverComponent == false`.
- STRUCK: `UI-Arc.md`'s F52 record ("each call
  `overlay.wheel?.(Math.sign(e.deltaY))`"), `ui/controlsWindow.js`'s
  quote of the same, `ui/saveWindow.js`'s RECORDED structural departure
  ("the port's host channel delivers a bare sign" - the hosts carry the
  point now, and that window still ignores it, having one list), and
  the three "the overlay wheel seam carries no position" sentences in
  `ui/automapWindow.js` and `ui/mouseControlsWindow.js`. FLAGGED, same
  shape, not wired: `ui/automapWindow.js`, `ui/mouseControlsWindow.js`,
  `ui/nativeTalk.js` and `ui/itemMakerWindow.js` each route a notch by
  a point seeded before the first mousemove and now discard the live
  one the hosts hand them; they seed `[0,0]`, not the leave sentinel -
  the finder's "same seeded sentinel" was wrong, and this is no
  sentinel retirement.
- *Review round:* fixup. The record row's two `nativeInventory` cites
  were wrong in every frame and the `automapWindow` feed cite had been
  moved by the lane's own comment; the wheel-block range was attached
  to the wrong verb at eight sites; the tooltip half of
  `ItemListScroller.cs:346-347`'s repoint was unpinned (a `_mouse` read
  in `_wheelRehover` survived the suite) and is pinned now; the two
  siblings the refuters named by name were flagged 2 of 4. Eleven valid
  mutants at review, ten red; the survivor is the pin added since.

### The motor's view and its climb (motor-view: XL-4, XL-5)

- The third-person focal (MW-D25) rode `player.pos`, the collider,
  while the first-person eye rode `eyeAt()` - the interpolated, then
  low-passed position MAC1 I gave the eye against the stair-step
  quantisation. So the body camera climbed each step raw: 0.1531 of
  rise per step at 60 Hz where the eye showed 0.0514, and at 144 Hz a
  horizontal quantisation the eye no longer had. `feetAt(alpha)` sits
  beneath `eyeAt` with the same span lerp, the same snap guard and the
  same `_eyeFeetY` substitution, WITHOUT `_eyeLevel()` and WITHOUT the
  bob (the focal supplies `FOCAL_HEIGHT` itself); all nine `mwView`
  call sites in the four hosts hand it over. This is the port's own
  presentation law (EV1 / MAC1 I) applied to one camera and not the
  other - MW-D25 has no C# counterpart, so no C# line is cited for the
  defect itself. The filter's worst lag on MAC1's staircase is 0.212,
  inside `STEP_OFFSET` 0.5; `mwCamera.js` is untouched.
- `this.standing` and `movingLessThanHalfSpeed` are a port-side CACHE
  of what `PlayerMotor.cs:113-125` and `:168-181` answer live, and
  `_step`'s climb return sat above both remaining writers, so a
  grounded forward climb start carried the pre-climb `standing = false`
  into the footstep gate, MAC1 H's politeness gate and the stealth
  senses in all four hosts. `_climbStep` now writes the swim branch's
  own two lines before its `return true` - the climb is the other
  disjunct of the very statement that zeroes `moveDirection`
  (`PlayerMotor.cs:322-326`) - with the mirrored half-speed line, not a
  constant (`:168-181` still compares against the stale `UpdateSpeed`
  field). No departure is claimed: DFU refreshes `grounded` at the top
  of the next `FixedUpdate` (`PlayerMotor.cs:278`) from the
  `collisionFlags` `ClimbingMotor.cs:767` writes after the climb's own
  `controller.Move`, so the port's live `grounded` IS DFU's answer, one
  step lagged on both sides. The `freezeMotor` return stays bare on
  purpose and is asserted bare: `PlayerMotor.cs:296-306` does not zero
  `moveDirection`, so a write there would be the divergence. The
  finding's headline fatigue-band consequence was FALSE and is not
  repeated - `worldTick.js:493-494` is climb-first, matching
  `PlayerEntity.cs:406-408`.
- *Review round:* fixup. The "without the bob" half of the `feetAt`
  pin was vacuous - the fixture minted no bob, so both bob mutants
  survived - and mints one now; the lane's in-file "KNOWING DEPARTURE"
  (DFU returns at `:326` without refreshing `grounded`) was a false DFU
  claim adopted from one refuter against the other's correction, and
  is replaced by the refresh above; the refuters' census over the three
  `moveDirection`-zeroing returns is pinned (deleting the swim branch's
  write reddens the climb file now, not only AUDIT 64's swimmer pin).
  Thirteen mutants at review, two survived, both dead now.

### The host seams (host-seams: HP-1, MC-1, SL-2, SL-3)

- **HP-1 (= UI-2's host half = XL-3).** MAC1 J's `hooks.relock`
  reached three of the FIVE pause-hook literals, and `ui/pauseDoor.js`
  optional-chains it, so the other two failed silently and still
  relocked a frame late through the look gate - outside the transient
  activation the browser requires, which is the double-click itself.
  Three edits: `exterior.js`'s own `togglePause` literal;
  `exterior.js`'s `createWorldModes` bag, so worldModes' `relock:
  host.relock` stops resolving `undefined` on ?exterior; and
  `dungeonContext.js`'s literal, which OWNS NO CANVAS and so takes the
  relock through `opts` the way `hudMessageSink` does, handed in by
  both dungeon hosts. The dungeon door is the most-played of the six
  flows - `world.js` gates its Escape ladder on exterior mode, so
  underground the key falls to `routeKey` -> `ui/input.js`'s Escape
  case. `openPauseFlow` hands the same hooks to the classic window, so
  the three new sites feed both skins. The standalone `interior.js`
  viewer owns no pause door, no townTalk, no weapon rig and no foe
  pool, and is out of all four seams by name.
- **MC-1.** `exterior.js` never set `townTalk.hudMessageSink` - only
  `world.js` did - so on ?exterior every `PopupText` line the street
  and its shops spoke was dropped from the Notebook's Messages page, a
  page that host wires up and can open. DFU files off the
  `GameManager.Instance.PlayerEntity` GLOBAL in both tails
  (`PopupText.cs:123`, `DaggerfallHUD.cs:371`), where no host can fail
  to file. One line, same post-questBridge block and same order as
  `world.js`. The mid-screen half was never permanently dead -
  `midScreenText` is a module singleton that `dungeonContext` re-points
  on the first dungeon entry - and that is the second half of this
  item: EVERY ALLOCATION HAS AN OWNER, so the borrow is read first and
  handed BACK in `destroy()` beside the four other `_prev*` restores.
  Handed back, not nulled (one refuter said null): the previous holder
  is the outer host's own townTalk sink, set once at boot before
  `createWorldModes`, so a bare null would have re-opened MC-1 above
  ground from the first dungeon exit onward. The lane flagged the
  deviation; the reviewer upheld it and a mutant pins it.
- **SL-2.** DFU has ONE `WeaponManager` for every `WorldContext`
  (`SerializablePlayer.cs:175-176` writes the pair, `:420-421` restores
  it); the port has four rigs and IS1 routes the inside-a-building save
  to `world.js`'s composer, which read its own EXTERIOR rig
  unconditionally - so an F9 pressed in a shop recorded the street's
  sheath and hand and the load wrote them back into the street's rig,
  while the rig actually in the player's hands was in no envelope at
  all. `worldModes` gains `weaponPose()` - interior mode ONLY, null in
  exterior AND dungeon mode, where dungeonContext owns the whole pair
  already - and `applyWeaponPose(pose)`, presence-gated, flag-only (the
  rig's per-frame `syncWorn` is DFU's `UpdateHands` + `ApplyWeapon`,
  `WeaponManager.cs:699`) and deliberately UNGATED by mode, because
  `worldQuickLoad` exits to the exterior first and re-enters the
  building after. `exterior.js`'s fourth rig is named and not wired:
  that host has no save path at all (its charter). LEDGER A carries the
  row the refuters conditioned this on: the four rigs never share state
  at a transition - walking into a shop with a drawn weapon still finds
  the interior rig sheathed and right-handed, no save involved - and
  SL-2 closes the save half only.
- **SL-3.** `entity.pickpocketAttempted` is recorded in its own module
  header as living on the live foe and dying with the pool "as DFU's
  does" (`player/mobileEnemyActivate.js:44-47`), and it does for the
  re-minting pools - `exteriorFoes.js`'s `restoreWorld` goes through
  `spawnFoe`, and the interior pool is the same factory.
  `dungeonContext.applyWorld` patches the LIVE foes in place, so a
  same-dungeon reload kept a raised latch and a failed pickpocket could
  never be retried, falsifying the header. DFU's load re-instantiates
  every enemy (`SerializableStateManager.cs:404-425`, `InstantiatePrefab`
  per record), so `EnemyEntity`'s default is the loaded truth for all of
  them. The fix is a PRE-PASS over the WHOLE live pool at the top of
  `applyWorld`, not a line in the per-record loop - that loop visits
  only the indices the record carries, and a quest foe spawned after
  the save would have kept its latch. The pin mounts `applyWorld` over a
  pool longer than the record and asserts both a recorded and an
  unrecorded foe come back pickpocketable.
- *Review round:* fixup. The three NEW relock hooks were pinned for
  presence only - `relock: () => {}` survived at all three - and are
  pinned by what they relock now (each hook is called through the
  mounted literal and must reach `requestLook` with its host's canvas);
  six cite-only edits from the lane's reverted mapper pass were still on
  disk and went back to base for the one mapper run; the Ledger A row
  was a promise in the draft and is written. Twenty-five mutants at
  review, three survived, all dead now.

### The activation ladders (activation: HP-2, HP-3, MC-2)

- **HP-2.** The world-hosted dungeon's `ActivateMobileEnemy` arm mounted
  its pickpocket MessageBox into `mountInterior`, the INTERIOR window
  slot, which that host's dungeon frame never draws, ticks, keys or
  clicks; an `ActionTextBox` has no timer, so the box orphaned there and
  surfaced on the next building entry (the refuters' correction - not
  "for the rest of the session"). It goes to `dungeonCtx.hudBox` now -
  `pushDungeonWindow`, the stack the standalone `dungeon.js` already
  calls and the port's spelling of `DaggerfallUI.MessageBox`'s
  `uiManager.TopWindow` (`PlayerActivate.cs:1640/:1646` ->
  `DaggerfallUI.cs:1328-1330`), which underground is the dungeon's. One
  refuter's `mountServiceWindow` would also have worked (the same push);
  the other's named door was taken under ONE DFU MEMBER, ONE EXPORT.
  Pinned by RUNNING the shipped arm off the source with spies on all
  four candidate sinks, plus the standing rule that no `mountInterior(`
  appears in the dungeon ladder at all.
- **HP-3.** The same arm's HUD half was `say(t)`, townTalk's outdoor
  PopupText queue, so the Info line and "You are not successful." opened
  a second seven-row column over the dungeon's own - both queues paint
  on a world-hosted dungeon frame. It is `dungeonCtx.hudSay(t)` now, the
  one queue `dungeon.js` speaks to; DFU has one PopupText per HUD.
  Unconditional, no `?.` and no `??`: the refuter's correction is law
  here, and the pin asserts the townTalk spy records ZERO, which is what
  kills the `??` form (`hudText.add` is void, so the fallback fires both
  columns - and the lane's own first spy returned a value and let that
  mutant live, until mutation found it). Not pixel-verified: both
  columns are the same `HudText` class drawn at different scale seams,
  so the overprint is near-certain rather than observed.
- **MC-2.** `midScreenText.js` names eleven DFU `youAreTooFarAway`
  sites and the port could reach five, because `activate.js` pre-gated
  the PICK: a target past its own reach was dropped before any host saw
  it, so a door, action door, shelf, ladder, chest, pile or body at five
  units answered with silence and let the click fall through. DFU rays
  once to `RayDistance` and gates inside each handler. Each family now
  competes for that one ray carrying its handler's `reach`, and every
  ladder speaks the refusal and consumes - `:503`, `:688`, `:852`, `:872`
  and `:940` are ported; `:330` stays the recorded delta, and an action
  RECORD keeps the narrow pre-gate because `:380-383` is silent (levers
  and platforms gain no line). No new export: the refuters' correction
  against `pickActivatableHitFar` is followed. The mandatory companion
  landed with it: F33's near/far pair is ONE call at the ray's reach
  against the ladder's winner, since the far half ran with `nearerThan`
  Infinity. And the lane's own first draft had a regression the finished
  lane caught: the outdoor hosts kept `_dropPick = _lootPick ? null :
  pick(piles)`, inert while each pick dropped its own out-of-reach
  target, wrong once both reach for the ray - a body across the room
  suppressed a pile at arm's length; the two picks are decided by
  distance now. LEDGER A: the corpse's Info arm is still absent
  (`youSeeADead` is unported), so in Info mode a body past 3.75 now
  speaks the refusal where DFU speaks "You see a dead X" - silence
  replaced by the wrong line, not invented behaviour.
- THE FOUR HOSTS: `world.js`, `exterior.js`, `worldModes.js` (tryEnter's
  static door and both ladders), `dungeonContext.js` (its piles and
  bodies, and the hover plaque, which applies the reach itself so it
  cannot name a chest the click will refuse) and the standalone
  `dungeon.js` wired; the standalone `interior.js` flagged by name - it
  runs no activation ray at all, and a pin says so.
- *Review round:* (pending)
