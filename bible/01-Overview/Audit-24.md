# AUDIT 24 - the full-codebase parity sweep (2026-08-21/22)

Mac asked for "a deep comprehensive bug/parity audit on the entirety of
the codebase... ensure perfect 1 to 1 parity on everything so far", with
agents. This page is the record.

## The sweep

A 145-agent workflow read the whole port against the DFU C# tree in 21
subsystem groups, covering the 161 port modules that cite a C# original.
Every claimed finding then went to TWO independent refuters - one told to
check the C# side, one the JS side, both instructed to refute by default -
and only findings that survived both are recorded here.

    audits 21   claims 62   survived both refuters 54   refuted 8
    145 agents, 0 errors, 11,006,648 subagent tokens, ~3.8 h wall clock

The 54 survivors split 15 bug / 27 parity / 12 nit. Four more were found
and fixed by hand while the verifiers ran (commits `19a414b`, `987e278`):
the `NpcInSameBuilding` YAML quoting, the invented `%pql` macro key (the
real one is `%pqp`), `RumorsDuringQuest` = 1005 not 1007, and the backstab
roll running on a MISS.

**The lesson of the fortnight**: the RumorsDuringQuest pin asserted 1007
on BOTH sides. It agreed with the bug and passed for two weeks. A pin that
restates the port instead of the source is not a pin.

## Wave 1 - the fixes (2026-08-22)

### characters

**A hovering flyer never re-anchored its fall.** ApplyFallDamage has a
SECOND arm (EnemyMotor.cs:1414-1417): `else if ((flies && !flyerFalls) ||
IsLevitating || IsSlowFalling) LastGroundedY = transform.position.y`, with
the source's own note - "for flying enemies, lastGroundedY is really
lastAltitudeControlY". A flyer rewrites the anchor to its CURRENT altitude
every FixedUpdate, so the drop it is billed for measures from the altitude
at the instant flight stopped. The port wrote lastGroundedY only on ground
CONTACT, so a bat that ground-spawned at y=0, climbed to y=8 chasing the
player and was paralyzed out of the air landed with drop = 0 and took
nothing, where DFU bills trunc(5 * (8 - 5)) = 15 HP. `flies &&
!flyerFalls` is exactly the port's hover branch - knockback and paralysis
have both returned above it - so the anchor lands there, post-move,
because ApplyFallDamage runs after TakeAction.

**The DFRandom byte stopped drawing mid-swing.** EnemyAttack.cs:81 makes
`DFRandom.rand() % speed` the LEFT operand of `... && MeleeTimer == 0`,
and FixedUpdate's only early return above it is the SeducerTransform
one-shot (MobileUnit.OneShotPauseActionsWhilePlaying:174-183) - never an
attack anim. The port's `machine.state !== 'Idle'` gate skipped the whole
tick body for the ~16 classic ticks a swing lasts, and DFRandom is ONE
shared global LCG: every later consumer in the session read a different
value. With the gate gone, two more halves of FixedUpdate come back: the
bow roll keeps its own gate (DoRangedAttack:587 wraps it in
`if (!isPlayingOneShot)`), and ResetMeleeTimer fires even when the state
change did nothing - ChangeEnemyState (MobileUnit.cs:143-146) "only
changes if in a different state", so a melee decision landing mid-melee
re-arms the timer and touches nothing else, while one landing mid-BOW
cuts the release short.

**The bow band was under-gated.** DoRangedAttack:573 is `inRange &&
TargetInSight && DetectedTarget`, and it is reached only while CanAct
holds - HandleNoAction:357-364 drops CanAct the moment GiveUpTimer hits 0.
The port's band arm had sight alone, so a Chameleoned player (detected
false on ~92% of classic updates) was shot at, and a foe that had given up
after 200 undetected ticks kept firing. The sibling spell branch in
enemyCasting.js already carried both gates and even cited the same line.

**Entry 39 (Horse) omitted `team`.** EnemyBasics.cs:1562 is
`new MobileEnemy() { ID = 39, }` - every other field takes the STRUCT
default, and MobileTeams' zero member is PlayerEnemy
(DaggerfallUnityEnums.cs:262-264). The extractor emitted `team` only when
the C# named it; it now emits the struct default, and enemyEntity's
fallback answers `'PlayerEnemy'` instead of a `'None'` the enum has no
member for.

### player

**The swimmer measured from the wrong capsule.** LevitateMotor.cs:126
reads `controller.transform.position.y` - the centre of the LIVE capsule.
ControllerHeightChange (PlayerHeightChanger.cs:477-478) keeps the feet
planted through a height change, so that centre is feet +
controller.height/2, and a free swimmer is force-crouched (:192-198) to
0.9. The port hardcoded the STANDING half-height 0.9 and pinned the
swimmer 0.45 m below DFU's float point - eyes under the surface with no
way up. The same constant sat in both swim toggles (PlayerEnterExit.cs:382)
and both submerged/breath tests (:407). They have to move together: fix
the clamp alone and a surfacing swimmer un-swims, stands, sinks, and swims
again. All five sites now read the live half-height, and the two hosts
thread `player.height` into the dungeon context for the breath pass.

### systems

**The legal-rep clamp ran BEFORE the restore.** SaveLoadManager.cs:1545 is
the last line of RestoreSaveData, long past SerializablePlayer's
RegionData write. The port clamped at line 198 and then overwrote the map
at line 241 with the unclamped snapshot, so a -180 region loaded back at
-180 - and on a fresh entity `court.js`'s `if (!player.legalRep) return;`
made the call an outright no-op besides. Dead code standing over a comment
that claimed the behaviour it did not perform.

**A shield never reached the forbidden-MATERIAL test.**
DaggerfallInventoryWindow.cs:1345-1359 is a three-arm chain. Arms 1 and 2
split on IsShield, but arm 3 - the plate-material test - carries no shield
guard, so a shield whose TYPE bit is clear still meets it. DFU refuses a
Daedric tower shield to a career that forbids Daedric (message 1068); the
port's early return equipped it freely, and both loot.js and shopStock.js
really do mint Daedric shields.

**A Place expansion stole the pronoun context.** Place.ExpandMacro
(Place.cs:250) latches LastPlaceReferenced and NOTHING else -
LastResourceReferenced is written in exactly two places in the whole DFU
tree, Person.cs:295 and Foe.cs:157. The port latched both, so in
`_qgiver_ wants you to visit _house_. Bring %g3 the book.` the pronoun
resolved against the Place and answered QuestResource's base Male, i.e.
"his" for a female questor.

**The capitalized pronoun family was missing.** MacroHelper.cs:240-245
registers all six - %G %G1 %G2 %G2self %G3 %G4 - each CapFirst over the
same source method as its lowercase twin. The port carried only %G, on a
header comment asserting that "only %G has a capitalized handler". The
corpus's fourteen %G3 lines and one %G1 line rendered the literal
`%G3[undefined]`. The old CORPUS GATE pin counted exactly those fifteen
and called them DFU's own error shapes: it pinned the bug.

**Quest popups revealed no dialog links, and %qdt always answered the
accept date.** Message.GetTextTokens (Message.cs:174-183) has no reveal
PARAMETER - it passes the literal `true`, under Nystul's comment "reveal
dialog linked resources here on purpose (quest popups should reveal
them)". The port made it a parameter defaulting to false and no caller
ever passed true, so an offer naming a Place or Person added no talk
topic. The same method brackets the expansion with
`ParentQuest.CurrentLogMessageId = this.id;` ... `= -1;` - the only
assignment to that field in DFU - which is what makes %qdt inside a log
message answer the date THAT step was written. The port never wrote it, so
getCurrentLogMessageTime never matched and every %qdt printed the quest
start. (No try/finally around it: C# has none, so a throwing expansion -
the %di NRE trio - really does leave the id latched.)

**The macro reveal deferred its rebuild.** Both reveal arms
(QuestMacroHelper.cs:131/135/139 and :218/222/226) call the THREE-argument
overload, whose `instantRebuildTopicLists` defaults to true
(TalkManager.cs:2222), so the open talk window's listbox refreshes on the
spot. The port passed false at all six sites, stranding the rebuild flags
for whatever instant rebuild came next. Only the AddDialog quest ACTION
passes false (AddDialog.cs:73) - and actions.js still does.

## Pins

Four pins were written per finding-group and each was verified by
REINTRODUCING the bug and watching the pin fail:
`test/audit24_characters.test.js`, `test/audit24_player.test.js`,
`test/audit24_systems.test.js`, plus the corrected pins in
`test/questmacros.test.js`, `test/questoffers.test.js`,
`test/c2combat.test.js` and `test/arrows.test.js`.

Three existing pins had to be corrected rather than added to, because they
had recorded the bug as the law: the CORPUS GATE's `[undefined] 15`, the
"reveal nothing" default, and the `%qdt` fixture that hand-set
`currentLogMessageId` for a journal that was never going to set it.
