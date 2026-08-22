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

**AddMovement's three arms were in the wrong order.**
LevitateMotor.cs:116-140 tests `playerSwimming && IsWaterWalking` FIRST,
unconditionally on levitation, and that arm RETURNS - so it takes no
surface clamp and it beats the levitate constant. Its speed is
`PlayerMotor.Speed`, the FIELD, which FixedUpdate's swim/levitate return
(:322-326) leaves frozen at its last GROUNDED value because UpdateSpeed
(:335) sits below it - crouch, sneak and the grounded-only run latch are
all baked in. The port tested levitation first, so a levitating
water-walker moved at the flat 4.0 constant, and it recomputed the
water-walking speed from the raw run input every step, so a sneaking
water-walker swam at full walk speed and the run key changed his speed
mid-swim.

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

## Wave 2 - the UI group (2026-08-22)

**A horse or cart could be Removed out of the pack.** The Remove arm's
call is `TransferItem(item, localItems, remoteItems, canHold, true)`
(DaggerfallInventoryWindow.cs:1999) - the fifth positional is
blockTransport, and TransferItem's first statement returns silently for
any ItemGroups.Transportation item (:1460-1462). The port had no group
test at all, so a Small_cart could be dropped on the ground, into a loot
pile, or into the wagon it is the key to - and `_hasCart()` reads the
bag, so that last one locked the player out of the wagon now holding it.

**The journal filtered on formatting names nothing emits.**
SetTextWithListEntries counts five formattings (:658-662); the port
spelled three of them with C#'s enum names - `textHighlight`,
`textAnswer`, `textQuestion` - while the notebook files
`highlight`/`question`/`answer` (notebook.js:8-9). Every note and every
finished-quest entry silently lost its date/city header: not drawn, and
not counted against the page's line budget.

**The journal body drew a black shadow at a fractional row pitch.**
questLogLabel never sets ShadowColor, so it keeps
DaggerfallDefaultShadowColor = Color32(93, 77, 12)
(MultiFormatTextLabel.cs:37, handed to every child at :232) - the port
hard-coded opaque black. And MultiFormatTextLabel.NewLine advances by
`lastLabel.TextHeight`, which is `(int)(totalHeight * textScale)`
(TextLabel.cs:146-148): at textScaleSmall 0.8 that is 5, not 5.6. The
float pitch drifted the 28th small row about 17px down, past the bottom
of the 238x138 log panel.

**Eighteen windows do not paint their letterbox at all, and there is no
dim.** ScreenDimColor lives on DaggerfallPopupWindow, not DaggerfallUI,
and it is Color.clear: the old `new Color32(0, 0, 0, 128)` is commented
out one line above the field (:26-27), the property setter DISCARDS its
argument (`set { screenDimColor = Color.clear;/*value*/; }`, :34), and
the constructor forces `a = 0` (:57). Eighteen windows assign it to
their parent panel in Setup, among them the inventory (:294), the
character sheet (:105), the talk window (:398), the journal (:95) and
the trade window (:199) - so the game view behind them shows through.
The port painted all five opaque black on a comment asserting the
inverse of what those files say, and dimmed three chargen screens 50%
where DFU dims by nothing.

This is the SECOND correction to the same law. AUDIT 19 F2 found the
port drawing a 50% dim where the base window is Color.black and made a
RULE of it, whose comment read "ScreenDimColor is used only by the few
windows that explicitly override it, and none of these is one". Those
four windows are exactly the ones that override it. The rule survives -
the backdrop goes through one shared helper - but which colour the
helper paints is each window's own C# to answer, and the pin now says
so on both sides.

**Three smaller ones.** The wagon button played two overlapping
ButtonClicks, because `_wagon()` played one of its own on top of the
click loop's - WagonButton_OnMouseClick plays exactly one, at the end
(:1242). It also never lit: ShowWagon(true) sets
`wagonButton.BackgroundTexture = wagonSelected` (:1051), a selected
state of its own, so nothing on screen distinguished wagon mode from the
ground pile. And a special-advantage label's clickable band is the
label's own Rectangle - font.GlyphHeight, and SmallFont is FONT0002,
whose FixedHeight is 5. The port used the 6px tandem row PITCH, so a
click in the 1px gap below a row removed the advantage above it.

**The book reader kept centring across a blank line.** CreateBookLabels
splits Content on newline; a line that converts to no tokens takes the
empty-line arm, which adds a Left-aligned label and then resets
alignment, colour and scale - DFU's own comment says so
(DaggerfallBookReaderWindow.cs:221-228). Stickiness holds only to the
next blank line. Without it, a centred title centred the whole book.

**The history wheel sounded.** The OpenBook one-shot belongs to the two
button handlers (:83, :92); NativePanel_OnMouseScrollDown/Up (:97-111)
page and re-layout in silence.

## Wave 3 - combat, formats, scenes, render (2026-08-22)

### combat

**The swing gate compared the wrong quantity.** DFU's Gesture keeps two
numbers: `_sum`, the vector sum, which gives the swing's ANGLE, and
`TravelDist`, the length of the trail. The field's own comment says why
they differ - "This isn't equal to the magnitude of the sum because the
trail may bend" (WeaponManager.cs:99-100) - and the attack gate at :808
compares `_gesture.TravelDist/_longestDim`. The port kept only the sum
and used it for both, i.e. the one quantity DFU explicitly says is not
the threshold. Drag 55px right then 50px left on a 1200px screen: DFU
sees a 105px trail and swings Right; the port saw 5 and refused.

**MaxGestureSeconds is a sliding window, not a hard reset.** TrimOld
(:111-123, called first by Add at :133) drops only the points older than
the window and subtracts each from the sum and the travel, so motion
from 0.9s ago still counts at t=1.0s. The port had no trail at all - it
zeroed the whole accumulator whenever the elapsed hold crossed 1s,
discarding the current frame's motion with it. A drag that quickened
after a slow first second had to earn the entire 60px again from
nothing: 40 frames where DFU takes 10.

**A cancelled bow draw was free.** Un-drawing calls
`ChangeWeaponState(Idle)` and leaves isAttacking TRUE (:355-357), so on
the next Update `IsWeaponAttacking()` is false and the reset block
charges the full bow cooldown (:220-222) - 1.327s at LiveSpeed 50. The
port let the next draw start on the following frame.

### formats

**The FLC frame delay had a branch DFU does not have.** Read() is a bare
`FrameDelay = (float)(header.FrameDelay / (float)CinematicSpeed.FLIC);`
(FlcFile.cs:135). `CinematicSpeed.FLI = 70` is declared at :588 and
referenced NOWHERE in the DFU tree; the port had wired the dead constant
up behind a fileID test, running any true .FLI 14.3x fast.

**A palette index past ColorCount now throws**, as C#'s `Color32[]`
indexer does - the same reason the port's `_put` already throws for the
frame buffer. colorInd runs across ALL packets of a COLOR chunk and C#
never bounds it, so an over-long chunk raises out of Load where a JS
typed array would drop the write and report readyToPlay.

**RumorFile.questName kept only the head.** `ReadCString(position, 9)`
passes a non-zero readLength, and that SKIPS the null-terminator scan
entirely: the return is `Encoding.UTF8.GetString(reader.ReadBytes(9))
.TrimEnd('\0')` (FileProxy.cs:380-391). Only trailing NULs come off, so
an embedded NUL and the stale tail behind it - which classic fixed-size
records leave whenever a longer name was overwritten - stay in the
string. The port truncated at the first NUL.

**A one-frame weapon-anim record answered undefined.** ReadWeaponCif
sets only `Header.FrameCount` over a default ImgFileHeader STRUCT
(CifRciFile.cs:456), so Width/Height/XOffset/YOffset are zeros, and
GetSize/GetOffset's `frameCount <= 1` arms hand those zeros back. The
port's record object carried no such keys, so the arms answered
undefined and any arithmetic on them NaN.

**The BIOG '#id' line parsed like parseInt, not int.TryParse.** TryParse
(BiogFile.cs:74) rejects the WHOLE string unless it parses cleanly:
"#4116abc", "#0x10" and "#12.5" all fall back to
defaultBackstoriesStart + classIndex, where parseInt answered 4116, 0
and 12.

### scenes

**seenByGuard was gated on a clear line of sight.** In
SpawnCityGuards(false), only `seen` sits behind the ray actually
reaching the player; `seenByGuard` is inside `if (Physics.Raycast(...))`
alone (PlayerEntity.cs:722-728), and a ray aimed at the player's eye
from at most 77.5m essentially always hits something. So a guard NPC in
range and facing a crime raises the whole watch from behind a market
stall - which, through the mass-conversion quirk the port already keeps,
turns every remaining pool NPC hostile. The port quietly downgraded that
to the civilian-witness path.

**guardsArriveCountdown drew the wrong distribution.**
`Random.Range(5, 10 + 1)` with two int literals is the INT overload -
one of {5,6,7,8,9,10}. The port drew a continuous [5,10), which is never
integral and can never reach 10.

**The ready-spell HUD line was invented.** SetReadySpell prints
GetLocalizedText("pressButtonToFireSpell") =
"Press button to fire spell." (EntityEffectManager.cs:355). Every other
message on that path is transcribed verbatim; this one said
"<spell> readied."

**lastCastCost was stamped too early.** OnReleaseFrame assigns the
CasterOnly bundle at :2117 and stamps `lastReadySpellCastingCost` only
at :2138, so AssignBundle's absorption cap (:603, gated on
`lastReadySpellCastingCost > 0`) reads the PREVIOUS player cast's cost -
and on the session's first self-cast the gate fails outright and nothing
is capped. The port stamped before the payload, capping every self-cast
by its own cost.

### render

Two citations pointed at the wrong line - `DaggerfallSky.cs:611` is the
seam loop's closing brace (the statement is at :617), and
`DaggerfallBillboard.cs:45` is blank (framesPerSecond is :46). No
runtime difference; in a port whose comments are the parity ledger, a
citation that lands on a brace costs the next reader the whole
derivation again.

## Wave 4 - the systems tail (2026-08-22)

**DateString was invented.** DaggerfallDateTime.DateString (:417-422)
formats the en table's `dateFormatString`, '{0} the {1}{2} of {3:00}' -
DayName, the day, its ordinal suffix, MonthName, and NO year. The
{3:00} spec lands on the STRING MonthName and string.Format drops it,
the same quirk the port already documents for DateTimeString. The port
wrote "Middas, 4 Morning Star, 3E 405" where DFU writes "Middas the 4th
of Morning Star", and every %dat, %qdt and %qdat macro reads it.

**SupernaturalBeings reputation survived a reload.** GetSaveData writes
all eleven social-group reputations (SerializablePlayer.cs:158), but
RestoreSaveData assigns 0,1,2,3,4,5,7,8,9,10 and never index 6
(:321-330) - the saved value goes to disk and is silently discarded on
load. talk.js reads it on every greeting, so a supernatural NPC's
reaction really does reset over a reload in DFU. This is the port
failing to reproduce a DFU BUG rather than introducing one, and it is
reproduced now.

**A looted arrow arrived at full condition.** CreateRandomWeapon's arrow
branch makes three writes (ItemBuilder.cs:395-398): the stack,
`currentCondition = 0` ("not sure if this is necessary, but classic does
it") and `nativeMaterialValue = 0`. maxCondition stays the template's
hitPoints because the branch never runs ApplyWeaponMaterial. The port
kept the stack and the material and dropped the zero, then let the loot
pile's mintCondition fill the stack in at 100%.

**Five members of BuildingTypes did not exist.**
CheckBuildingTypeInSkipList (TalkManager.cs:2919-2938) names AllValid
and Special1-4 by hand, and the port's BUILDING_TYPES stopped at Ship.
All five expressions were `undefined`, so the Set really held twelve
values and one `undefined` - and the predicate answered TRUE for
undefined, which C# has no equivalent for. The enum tail
(DFLocation.cs:133-139) is ported now.

**The saving throw drove its element and its flag off one predicate.**
SavingThrow(IEntityEffect, target) computes them from DIFFERENT sources
(FormulaHelper.cs:1568-1569). GetEffectFlags (:1592-1623) looks only at
Paralyze/DiseaseEffect and then switches on the PARENT BUNDLE's element;
it never consults AllowedElements. Only GetElementType (:1630-1634)
applies the magic-only override. So a concealment inside a Fire bundle
folds in `Career.Fire` tolerance while resisting as element Magic - the
port folded in `Career.Magic` plus BiographyResistMagicMod instead.

And the predicate itself was a hand-picked list of families that missed
the alteration and thaumaturgy buffs: Levitate, Slowfall, WaterWalking,
WaterBreathing, FreeAction, Jumping, Climbing and the detects all set
ElementFlags_MagicOnly, and three of them are TargetFlags_All, so touch
and ranged casts of them really exist. MAGIC_ONLY_KEYS is now the whole
72-key set, read off the effect classes.

**Four smaller ones.** The %di local-place separator is a comma and TWO
spaces (Internal_Strings id 424, verified with cat -A), not one.
GetBuildingNameForBuildingKey swallowed both of the throws its sibling
reproduces. WhenNpcIsAvailable and WhenReputeWith swallowed
Person.GetFactionData's missing-record throw behind a `factionData &&`
guard, so a quest naming an individual with no faction record minted a
task that read false forever where DFU error-terminates at parse. And
%god had no region-temple fallback: DFU reads
`MapsFile.RegionTemples[CurrentRegionIndex]` (PlayerGPS.cs:495-498) and
rolls a random divine only when that answers 0 or the Fighters Guild, so
the port named a DIFFERENT god on every expansion outside a temple.
Temple.GetDivine's templar-order arm (resolve through the faction
record's parent) came with it, and the unwired `divineOfTempleFaction`
host seam is gone.

## The eight that did not survive

Refuted by one or both lenses, and recorded so the same claim is not
re-filed later:

- formats: Unknown block type: C# LoadBlock still succeeds, port returns failure -- Both sides read and confirmed. The quoted C# is verbatim: ReadBlock (BlocksFile.cs:659-693) is `void` and its final else at :688-692 is `{ DiscardBlock(block); return; }`; Read (:637-652) only catches exceptions and so returns true at :651; LoadBlock therefore skips the `if (!Read(block))` discard (:327-331), stores in the lookup, sets lastBlock, and returns true (:340). DiscardBlock (:354-355) blanks BlockRecord.Name and sets DFBlock.Type=Unknown but leaves DFBlock.Name/Position/Index set from :317/323/324, so GetBlock (:381-397) hands back a populated-header DFBlock (DFBlock is a struct, so the C# failure sentinel is `new DFBlock()`, never null). BsaFile.GetRecordProxy (BsaFile.cs:332-343) cannot return null for a valid index, so there is no earlier escape. The port's `_read` default arm (blocksFile.js:300-301) returns false, loadBlock discards and returns false (:191-194), and getBlock returns null (:213-216). The divergence is real and not marked RECORDED/FLAGGED/PENDING anywhere — on the contrary, test/blocks.test.js:63-67 and bible/02-Formats/Readers-Arc.md:46 assert this is what DFU does. Two details of the claim are wrong (see correctedClaim): there is no ArgumentException, and the path IS reachable with vanilla data.
- formats: FixRdbData's synthesized objects get actionResource -1 sentinels the C# leaves at 0 -- Both quoted sides are accurate on their face — I confirmed BlocksFile.cs:563-573/586-596/613-623 are plain struct initializers (DFBlock.cs:925 `struct RdbObject`, :1070 `struct RdbActionResource`, PreviousObjectOffset :1094 / NextObjectIndex :1101, so the synthesized objects keep the 0 default), that the -1s appear only at BlocksFile.cs:1213-1214 (link-back at :1295-1296), and that blocksFile.js:901/926/955 use defaultResources() whose defaultActionResource() (:56-67) hard-codes previousObjectOffset:-1 / nextObjectIndex:-1. But the divergence is already RECORDED in the port's own ledger: /home/user/project-dagger/bible/01-Overview/Port-Ledger.md:94-104, under "BLOCKS vs the C#, MEASURED at AUDIT 18 ... 5,411,170 values compared, NINE differ, and all nine are inert and accounted for", item (b) states it verbatim — "FixRdbData's three SYNTHESIZED objects in blocks 1025/1034/1036 - C# leaves ActionResource.PreviousObjectOffset and NextObjectIndex at the struct default 0 where the port's defaultActionResource() uses -1. Dead data: those objects carry Flags = 0, so HasAction is false and RDBLayout.AddActionModelHelper - the only reader of PreviousObjectOffset - never runs for them." The finding, including its own inertness rationale, restates an already-measured and accepted ledger entry rather than surfacing anything new. (I independently confirmed the gating: rdbLayout.js:137 hasAction = flags !== 0, matching RDBLayout.cs:769-774; the only prevKey read is rdbLayout.js:308 / RDBLayout.cs:886.)
- formats: FntFile.glyphWidth returns 0 on out-of-range index where C# returns -1 -- Read both sides. C# FntFile.cs:170-177 is quoted verbatim — GetGlyphWidth returns -1 for !IsLoaded and -1 for index<0||index>=MaxGlyphCount (MaxGlyphCount=240, FntFile.cs:27), and its XML doc states "Pixel width of glyph or -1 on error." JS fntFile.js:54-56 is quoted verbatim — out-of-range yields 0 and there is no not-loaded arm. They genuinely differ. It is not a deliberate seam: the sibling getGlyphPixels (fntFile.js:36) faithfully preserves C#'s null sentinel from FntFile.cs:203-209 and test/fnt.test.js:36 pins it, so the port is internally inconsistent rather than making an architectural choice. No RECORDED/FLAGGED/PENDING marker on the line; the file header calls itself a verbatim port. Cited DFU callers verified (DaggerfallFont.cs:644 inside CreateGlyph, driven by the 0..MaxGlyphCount loop at :606-609; ImageProcessing.cs:924 and :945) — all pass 0..239, so the sentinel is unreachable in DFU. Real but cosmetic today; one factual detail in the consequence paragraph needs correcting.
- systems: CreateFoe spawn-failure throw formats foe.foeType where C# formats the action's own (null) Symbol -- Both quotes are textually accurate and my lens (the C# side) checks out: CreateFoe.cs:169-174 reads `pendingFoeGameObjects = GameObjectHelper.CreateFoeGameObjects(...); if (... .Length != foe.SpawnCount) { SetComplete(); throw new Exception(string.Format("create foe attempted to create {0}x{1} GameObjects and failed.", foe.SpawnCount, Symbol.Name)); }`, and `Symbol` really is the inherited QuestResource.Symbol (QuestResource.cs:20/33, protected setter) which CreateFoe never assigns — it only sets `foeSymbol` (CreateFoe.cs:28/76); ActionTemplate (QuestAction.cs:120+) never assigns it, and the action save envelope (ActionSaveData_v1: type/isComplete/flags/debugSource/actionSpecific) does not carry QuestResource's symbol. So C# does NRE while evaluating the format argument. The finding still fails, on two grounds.

(1) Its load-bearing premise is false. The claim says the port "deliberately preserves the identical C# quirk 25 lines above" at the foe==null throw, making 2029 inconsistent with the port's own doctrine. It does not preserve it: actions.js:2011 is `throw new Error(\`create foe could not find Foe with symbol name ${this.symbol?.name}\`)` — optional chaining, so the port renders "...symbol name undefined" and throws a normal Error. It never reproduces C#'s NullReferenceException (JS would have thrown a TypeError there anyway, a different failure). Same shape at CastSpellOnFoe (actions.js:2086, `this.symbol?.name`). So NEITHER port throw site reproduces the C# NRE — both render a message where C# blows up on the null argument. Line 2029 is not inconsistent with 2011; it is the same choice with different filler text.

(2) The port RECORDS the quirk and states the doctrine covering both sites. actions.js:2008-2010: "C# formats the action's own never-assigned Symbol (NREs before the message renders) - the same quirk as CastSpellOnFoe; either way the quest error-terminates", and the CastSpellOnFoe class docstring lists it among "Two C# QUIRKS KEPT". The recorded position is that these throws are equivalent because the quest error-terminates regardless of exception text/type — which is precisely the finding's own admitted consequence ("Message-text only"). The branch also sits behind the injected `world.createFoeGameObjects` seam and is reachable only when a host adapter mints the wrong count.
- systems: Quest-start rumor reads message 1007 (RumorsPostSuccess) instead of 1005 (RumorsDuringQuest) -- The C# half of the claim is accurate, but the JS half is not — the port does not contain the code the finding quotes, so the two sides already agree.

C# (tools/parity/dfu/Assets/Scripts/Game/TalkManager.cs:2069-2074) is exactly as quoted:
  public void AddQuestTopicWithInfoAndRumors(Quest quest)
  {
      // Add RumorsDuringQuest rumor to rumor mill
      Message message = quest.GetMessage((int)QuestMachine.QuestMessages.RumorsDuringQuest);
      if (message != null)
          AddOrReplaceQuestProgressRumor(quest.UID, message);
and QuestMachine.cs:260-271 does define RumorsDuringQuest = 1005 / RumorsPostSuccess = 1007.

The port at src/systems/topicTree.js:229 reads:
  const message = quest.getMessage(QUEST_MESSAGES.RumorsDuringQuest);
It does not use a literal 1007. QUEST_MESSAGES is imported at src/systems/topicTree.js:66 from ./quest/quest.js, whose frozen enum (src/systems/quest/quest.js:36-47) has RumorsDuringQuest: 1005 and RumorsPostSuccess: 1007 — matching the C# enum one-for-one. So the port resolves 1005, same as DFU.

The claim also misreads the doc comment on src/systems/topicTree.js:221-227. It does not assert "RumorsDuringQuest = 1007"; it says the opposite, in the past tense, as a record of the fix: "The id is QuestMessages.RumorsDuringQuest = **1005** (QuestMachine.cs:267). This read 1007 - RumorsPostSuccess - so ACCEPTING a quest seeded the mill with the rumor that belongs to finishing it... Taken from the enum now rather than written out." The finding appears to have been written against a pre-fix revision of the file.

Grep over src/ confirms only two RumorsPostSuccess uses remain and both are legitimate: src/systems/quest/quest.js:274 (the tombstone success/failure rumor pick) and the prose in the topicTree comment. Nothing in src/ reads a bare 1007 at quest start, so the claimed consequences (post-success text seeded at accept time, missing during-quest rumor, double-write with tombstone) do not occur.
- systems: TALK_STRINGS.NpcInSameBuilding carries stray YAML quote characters -- The C# half of the claim is accurate (TalkManager.cs:1859 does string.Format the "NpcInSameBuilding" localized text with caption and building.name, and Internal_Strings_en.asset:1937-1938 holds id 396 = '{0} is around here in {1}.' with YAML-syntax quotes). But the JS half is not what the file says. src/systems/answerPipeline.js:200 reads `NpcInSameBuilding: '{0} is around here in {1}.',` — a single-quoted JS literal whose contents contain NO apostrophes. Lines 194-199 (the line the claim cites) are a comment that already states the exact YAML-quoting reasoning and describes the quoted form in the past tense as a bug that was removed. The consequence is false too: test/answerpipeline.test.js:530 pins `getAnswerWhereIs(person) === 'Sirien is around here in The Inn.'` (unquoted), and test/answerpipeline.test.js:1050-1065 is a dedicated test that rejects any TALK_STRINGS value wrapped in ' or " and asserts NpcInSameBuilding equals '{0} is around here in {1}.'. Port and DFU therefore agree exactly; the defect was fixed in commit 19a414b and is guarded by a regression test.
- systems: Potential-questor-location macro is registered as %pql; DFU's key is %pqp -- The C# half of the claim is accurate — MacroHelper.cs:163 really is `{ "%pqp", PotentialQuestorLocation }, // Potential Quest Giver's Location`, with %pqn on :162 — but the JS half is not what the file says, so the two sides already agree. src/systems/talkMacros.js:140 reads `'%pqp': () => ctx.session?.getQuestorLocation() ?? '',` and TALK_MACROS at line 27 lists `'%pqn', '%pqp'`. The claim's grep is inverted: the sole occurrence of '%pql' in all of src/ is line 136, inside the handler's own doc comment, which exists to warn against exactly this error — "The location's key is **%pqp** - MacroHelper.cs:163 ... Not %pql, which is not a macro at all and would have left every record carrying the real one unresolved." `git log -S'%pql' -- src/systems/talkMacros.js` shows %pql was introduced in c026765 (TK-v) and removed in 19a414b ("AUDIT: three real bugs in the talk arc, every one of them mine"), so the finding is stale against HEAD. There is no dead handler and no "You can find him in ." output: Work answers expand %pqp through a live handler.
- ui: Journal page drops the trailing blank line when the entry filled the page -- Both quotes are literally accurate — C# :601-603 and :672-674 do emit the separator NewLineToken unconditionally (guards only at :579/:586 and :648/:654, maxLinesQuests=20 :34, maxLinesSmall=28 :35), and src/ui/questJournal.js:169 does add `if (out.length >= this.maxLines) break;` before `out.push('')`. But the divergence has no observable effect, so the two agree in behaviour. The suppressed element is always the LAST one (the break also ends the outer loop in C# on the next iteration), and it is the empty string. pageLines() has exactly one consumer, draw() at :193, whose loop does `if (line) { drawText… }` then `y += rowH` — a trailing '' paints nothing and displaces no preceding row; the other reader, `lines.some((l) => l)`, is likewise unaffected by a trailing ''. Nothing in the port measures off lines.length. On the DFU side nothing shifts either: questLogLabel is top-anchored at Position (30,38) (:150) and SetTextWithListEntries force-sets questLogLabel.Size = (x, 138) immediately after SetText (:678), so the three list pages have a fixed height regardless of the extra row. The only real thing DFU's trailing token buys is the extra entryLineMap slot consumed by HandleClick (:387-396) for line→entry hit-testing — and the port implements no entryLineMap at all (click() handles only the arrow/dialog/exit rects), which is a separate architectural seam rather than this finding. The stated consequence ("one row of vertical offset for anything measured off the page height") is false on both sides.

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

## The re-read (2026-08-22): one more, found by reading the fix

The arc's own rule - the real bugs surface AFTER the pins are green -
paid once more. Re-reading characters-2's fix turned up the same defect
one layer up.

**A pacified foe still burns its byte.** DFU's non-hostile mode is a
TARGET DROP, not an action skip: EnemySenses.Update:321-327 nulls
`target` (and secondaryTarget) whenever
`NoTargetMode || !motor.IsHostile` and the player is it, and a null
target takes :410-414 - `targetInSight = false; detectedTarget = false;
return;`. The foe reads BLIND, and that is what refuses it every gate
that asks about sight. EnemyAttack.FixedUpdate itself has no hostility
test at all (:55-56 gates on `DisableAI || IsParalyzed` and nothing
else), so the component keeps ticking and keeps drawing its DFRandom
byte.

The port had held the whole component at the host
(`(_fParalyzed || !f.ai.isHostile) ? [] : f.attack.update(...)`) and
left the senses at their geometric values. Same consequence as
characters-2 and the same cause: a law left with the host. Every classic
tick a foe stood pacified dropped a draw off the one shared global
stream.

The CASTING gate stays where it is: DFU's spell paths hang off the
MOTOR's TakeAction, behind CanAct, which HandleNoAction:357-364 drops
the moment the target is null - so a pacified foe really does take no
spell rolls.

## The regeneration gate

The magic-only defect was not a wrong key. It was a hand-picked list of
FAMILIES - heal, cure, fortify, transfer, regenerate, the concealments -
which missed levitate, slowfall, free action, jumping, climbing and both
water buffs. No spot-check pin catches that: every key the list DOES
contain is right.

So the pin rebuilds the set from the source. It walks every effect class
under Game/MagicAndEffects/Effects, reads each
`properties.AllowedElements` (ElementFlags_MagicOnly IS
ElementTypes.Magic, EntityEffectBroker.cs:47), and compares the whole
set both ways against the port's 72 keys. Ninety-one classic-keyed
classes; none extra, none missing. Drop a single key and it names it.

That is the shape any table ported from a source tree wants, and it is
the same discipline as the quest CORPUS GATE. Where the source is
gitignored the gate skips, under the headless charter the ARENA2-backed
pins already run under.

## Closed

All 54 confirmed findings are fixed and pinned, in four waves
(`25079ed`, `70da995`, `e8c83a5`, `4db7769` and this one). Each pin was
verified by REINTRODUCING its bug and watching the pin fail - the only
proof a pin is a pin.

FOUR EXISTING PINS HAD RECORDED THE BUG AS THE LAW and had to be
corrected rather than extended:

- the CORPUS GATE's `[undefined] 15`, which counted the corpus's %G3
  and %G1 lines and called DFU's error shape what was really a missing
  handler table;
- the "reveal nothing" default on Message.GetTextTokens;
- the %qdt fixture that hand-set `currentLogMessageId` for a journal
  that was never going to set it;
- AUDIT 19 F2's letterbox rule, whose comment asserted that the char
  sheet, talk, trade and inventory windows do not override
  ScreenDimColor. They are exactly the ones that do - and F2 had
  "corrected" that line in the wrong direction a fortnight earlier.

A pin that restates the port instead of the source is not a pin. That
is the standing lesson of this audit, and it is worth more than any
single fix in it.

## Reopened

The audit did not stay closed. Sixteen more waves ran after the section
above was written, driven by two multi-agent sweeps: the SEVEN-SLICE
adversarial re-read of the quest slices (151 agents, three lenses per
slice, two independent refuters per claim) and a twelve-slice sweep of
the non-quest systems. Each wave is written up in full in
`bible/06-Systems/Quest-Arc.md`; the short version:

| wave | what it found |
|---|---|
| 20 | `StaticNPCClick`'s quest-resource early return was missing, and `setupIndividualStaticNPC` had **no caller anywhere in `src/`** - no building NPC ever carried a QuestResourceBehaviour |
| 21 | `ShowMessagePopup` read its tokens at pop time, not queue time; no 22-line chunker; a host that kept one box out of every drain |
| 22 | Six seams ported and never reached - the notebook message ring, the TG/DB map note, the 128-vs-256 reach, the `flatPosition` hash, `menu:false` + spymaster, and `{0:00}` rounding |
| 23 | Generator gates. `enemyBasics.js` hid **nine columns** behind a tool nobody ran; then five duplicated tables, one of them written by wave 22 |
| 24 | *One DFU member, one export* as a standing gate. Under a stale `SetLayoutData` twin: `GetDisplayName` ported and never called, so **every static NPC in the game was nameless** |
| 25 | `StartQuest` dropped its tail (the questor carried no behaviour, so `hide npc` at startup did nothing); the rumour mill cloned where DFU freezes in place |
| 26 | The seam gate's **alias hole** - it scanned for `world.` and `questMacros.js` writes `const w = hooks?.world`, hiding three unmounted seams |
| 27 | Wave 26's own scout, landing after it, found two bugs IN wave 26 - a misread C# loop pinned as law, and a third copy of the compass law written two waves after the gate against duplicates |
| 28 | The twelve-slice non-quest sweep lands (60 agents, 37 confirmed, 16 high). First two: an unarmoured character contributed **0** to CalculateArmorToHit where DFU contributes **100**, so enemies essentially could not hit a fresh character; and MaxMagicka was a chargen snapshot where DFU recomputes it from LiveIntelligence on every read |
| 29 | GetWeaponSkillUsed keyed on the item NAME, so a Wakizashi, a Dai-katana and every renamed magic weapon hit the `Skills.None = -1` default and were refused by every restricted career; and the broken-item equip gate (`currentCondition < 1`) was missing entirely |
| 30 | The rest window moved the clock and fired **no magic rounds** - `dungeon.js` returns at the overlay gate before the tick, so a rested night froze every disease, poison and effect and dumped the backlog in one burst after the healing had landed; and `OnMonsterHit` was never passed above ground, so no exterior encounter could infect, paralyse or drain the player |
| 31 | `BreakNormalPowerConcealmentEffects` unported at all four of its doors, so the cheap Invisibility/Chameleon/Shadow survived every hit you landed - clear a dungeon unseen, or be killed by a Nightblade you never see; and `UpdateEntityMods`' "kill host if any stat is reduced to 0 live total" was missing, so a stat drained to zero was merely a stat at zero |
| 32 | ONE BROKER, MANY SUBSCRIBERS - and above ground there were none. Neither exterior foe pool ran a magic round, a poison round or the stat-zero kill, and both passed a literal `false` for the motor's paralyzed argument, so a paralysed watchman kept chasing and swinging and the paralysis never expired to boot; the dungeon's own foe loop had neither the broker's catch-up nor its 2880 cap; and PlayerEntity's uncapped per-minute loop, filed inside the broker's by AUDIT 23, had inherited its `+1` and normalised a minute late |
| 33 | `EnemyMotor.HandleParalysis` sets `mobile.FreezeAnims = true` inside its guard and `false` on the line after the closing brace - a dead store with no other writer in the tree - so a paralysed enemy is never frozen in DFU and keeps turning to face you; the port froze frame AND facing, quoting the cancelled comment. And the damage marker is a LATCH cleared only by `EnemyAttack.Update`, which returns before the clear while paralysed - so DFU delays the blow to the moment paralysis breaks where the port dropped it |
| 34 | The twelve-agent host-parity sweep lands (61 agents; its synthesist voids three of its own confirmed findings because waves 32-33 closed them). Its number one: DFU's whole `AttemptMove` probe/detour machine unported - the translation is the ELSE arm of `if (fallDetected || ObstacleDetected)`, so the port's foes pressed into walls and walked off ledges. ObstacleCheck, FallCheck and FindDetour ported into `EnemyAI` so all three pools inherit them, on a new `collider.capsuleCast`; and a module-level constant exposed a second import cycle (`motor` <-> `enemyMotor`) that had been latent since wave 24 |
| 35 | `DoRangedAttack`'s `return true` unported, so archers and ranged casters closed to melee and the port's own 6-51.2m band never fired outside the charge; and `GetDestination`'s other two arms - the `ClearPathToPosition` gate and the `LastKnownTargetPos + LastPositionDiff * searchMult` search, with the LOS-timer guard that keeps a stealth detection from overwriting the memory. A scout run alongside the wave re-read waves 32-34 and found **four real defects in them**: the aim offset applied twice (and to the detour destination), a door recorded with no 22.5-degree yaw gate, the stop distance measured to the player rather than the destination, and the damage-frame consumers written arrow-first as two independent ifs |

THE STANDING LESSON HELD, and grew a second half. "A pin that restates
the port instead of the source is not a pin" was caught four more
times, once in a pin that *argued its case* - it asserted that flooring
`{0:00}` was right "because C#'s Hour/Minute/Second are ints", and
`Second` is a `float`, so DFU really does print `13:30:60`.

The second half is newer and cost more to learn:

**A PORTED FUNCTION WITH NO CALLER IS A COMMENT.** Three times in seven
waves - `setupIndividualStaticNPC`, `notebook.addMessage`,
`staticNpcName` - each a careful, correct, fully-tested port of a named
DFU member that nothing in the game ever invoked. The tests were green
because the tests called them. Coverage counted the lines because the
fixtures reached them. A fixture that reaches a line the game cannot
reach tells you the function works, not that it runs.

**AND A GATE HAS A BLIND SPOT UNTIL SOMEBODY LOOKS FOR IT FROM THE
OTHER SIDE.** The seam gate exists precisely to catch that class of
bug, and it had been missing an entire module since it was written.
