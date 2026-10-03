# FIELD BUGS 2026-09-28 - the pause key, the arrest, the shop box, Speed, the dead span, the swimmer, the dragonling, the shared quest

Mac, with eleven screenshots of the Discord's bug-reports and support threads and no words of his own. This page is
the batch's record; each fix has its own section below. The arc's own record is `06-Systems/Online-Arc.md` THE
2026-09-28 DISCORD BATCH. Mutants: `tools/mutants/disc28.json` (48, all dead).

The list, as the screenshots carried it:

1. A quest shared by a friend who then finished it (The Courier; the Buckingwing Residence) does not complete, and the
   quest's house could not be entered after the first player had entered it.
2. Dying over and over from fatigue after an online respawn - "respawn at 0% fatigue"; a second player: "it gives me a
   small portion and I collapse again" (and the older DISC24-D "death loop after level 5 online").
3. Two Mages Guild "cast the Sleep spell" jobs sent to the same house showed the first job's residence name.
4. EvoAva: "If you change the default pause key binding from escape to anything else, it allows you to open pause menu
   with that key binding, but not close it".
5. The game locks up if guards hit you the moment you fast travel.
6. Arrested again and again for Criminal Conspiracy. The DFU developer's answer in the thread: DFU's own behaviour at a
   legal reputation of -10 or lower, "should be adjusted probably".
7. The shop: the list rows' markers drawn over the haggle/confirm box.
8. "The speed attribute only affects the third-person animation, not the first-person swing rate" (with a link to
   `characters/weaponStates.js`'s formula).
9. Veraten: (a) Atronach Hunting's kill not credited; (b) the swim physics stayed on after leaving the water, and the
   player rose "way up" through the map and fell into the void.
10. The Dragonslayer quest's dragonling stuck half in the floor.

## DISC28-A: the pause key closes what it opened (4)

The host opens the enhanced pause screen on the PAUSE ACTION (inputActions' `Escape`), but the screen's own key handler
(`ui/enhancedMenu.js` onKey) knew back only as the shared table's literal Escape (`overlayAction`). A pause rebound to P
opened the screen, and P there was an ordinary letter that nothing took. DFU's pause window closes on the action's own
binding (DaggerfallPauseOptionsWindow.cs:159 `toggleClosedBinding = GetBinding(Actions.Escape)`, :186 on key-up) as well
as the back button, and the classic window already did (`ui/pauseWindow.js`).

On the pause face the action's key is now back too (`eventMeans(e, 'Escape')`), never its auto-repeat - the held key that
just opened the screen must not close it on its first repeat. The boot menu is not the pause face and is untouched. A
mod's TextKey capture ("press a key", HT1) now owns its key ahead of the back stack, as the Controls pane's capture
already did (FIX-F): registered after the menu's handler, it ran second, so the one key it waited for walked the back
stack first - and with the pause action's key now a back key, a pause rebound to P could not have been given to a mod
key without leaving the page. Its listener has one owner and unmount removes it. (AUDIT UI-4: no page draws a TextKey
row since KB1 took the mod keys into Controls, so this stand-down guards a branch nothing reaches; it is kept as a
guard. AUDIT UI-1 and UI-2 below: the pause key now closes on a Ctrl/Alt combo too, and on its release - the "never
its auto-repeat" above held for a rebound key only until then.)

`test/disc28_pause.test.js` (9 since AUDIT UI-5, over the table the game mints): the real registry, the real input table and the mounted screen - a rebound P resumes
and is stopped there, its repeat does nothing, an unbound letter does nothing, the literal Escape still resumes, the boot
menu ignores P; the capture's stand-down and its owner by source.

## DISC28-B: a surrender box never outlives its crime (5)

Online the world runs under every window (WORLD5), so a guard's blow can raise the surrender box as the travel map
commits the journey, and the arrival clears the crime (the PostFastTravel clearer, `scenes/world.js` fastTravelTo) with
the box still standing. The box then held the damage veto, asked about a crime that no longer existed, and Y marched
the player into `startCourtFlow` - which set `arrested`, opened the modal courtroom and only THEN asked `startCourt`,
whose null (no crime: DaggerfallCourtWindow.cs:109-114 closes the court) the plead box dereferenced. The throw left a
courtroom with nothing over it and `arrested` standing - every damage veto on, nothing that could close it. The lockup.

- The trial is read before anything is armed: no crime, no court - DFU's court that closes itself, whose OnPop
  (:432-438) clears Arrested.
- The answer re-reads the crime: Y to no crime surrenders to nothing (no forced 1 health), N lands no departed guard's
  blow.
- `arrestFlow.crimeCleared()` withdraws a standing surrender question the moment the crime goes, closing the box as an
  answer does and dropping its veto; the arrival calls it where it clears the crime. A trial already under way is left
  to its release.

`test/disc28_arrest.test.js` (6) through the real flow, the real court and the one damage door. JAIL-HIT's mutant
records re-aimed (6 dead); `test/courtrescue.test.js`'s anchor re-aimed.

## DISC28-C: the shop's confirm box stands above the rows' markers (7)

The counter's Yes/No scrim (`ui/enhancedTrade.js` boxScrim, appended inside the window after the lists) stood at
z-index auto. The shelf rows' furniture climbs out of auto - the wear bar at 1 (WEAR-UI), the sigil rune and the padlock
at 2 (`ui/enhancedPlusStyle.js`) - and nothing between the lists and the scrim makes a stacking context, so every
positive layer painted over the modal whatever the DOM order: the column of dashes in the screenshot is one wear bar per
row. The three shells that raise an `.sb-ask` box (trade, spellbook, tavern) stand it at layer 10.

`test/disc28_shopbox.test.js` (4) reads every z-index the shipped stylesheets (the classic face's and Plus's) declare
under each shell and holds the box above them all.

## DISC28-D: the first-person swing reads the live Speed (8)

The formula was right - GetMeleeWeaponAnimTime, `3 * (115 - LiveSpeed) / 980` a frame (FormulaHelper.cs:830-838) - and
never saw the player. The rig built its `PlayerWeapon` with no speed (`combat/weaponRig.js`), the weapon took the default
50 as a NUMBER once, and nothing wrote it again: every player's swing clock, hit frame, swing sound and bow cooldown ran
at Speed 50, while the third-person body and the widget's clone read the live stat. DFU asks
`player.Stats.LiveSpeed` on every UpdateWeapon (FPSWeapon.cs:431, :549-556). The weapon's `liveSpeed` is now a live
read (a function, or a number for a fixed-speed weapon), and the rig hands it the entity's `liveStat(entity, 'speed')`.
Roleplay & Realism's and RR Items' registered anim-time overrides receive the same live value.

`test/disc28_speed.test.js` (4): the swing lasts five of the formula's ticks at Speed 20, 50 and 100; a Speed that
changes mid-life changes the next swing; a number still fixes it; the rig's reader by source.

SUPERSEDED FOR THE PLAYER by SWING-LAW (`05-Combat/Combat.md`, DISC29-G in `Field-Bugs-2026-09-28f.md`): the formula
is a hyperbola in the swing rate, and the player's swing is the port's own law now. AUDIT PRE-MERGE 0929 S5 moved this
file's first-person pins onto the weapon as the rig builds it - with the swing's ctx, so they time SWING-LAW's clock
(Speed 100 swings 1/0.6 as often as 50, not four times) - and kept DFU's line pinned where it still runs: a machine
with no wielder the port knows (a foe's, a peer's walker).

## DISC28-E: the dead live no minutes (2)

The online revival handed back a body the next tick killed. Two flaws:

1. **The fatigue was restored only when it was exactly zero** (AUDIT DISC19 S4). A death with a sliver left - a blow
   landing while exhausted, an online collapse that paid its eighth - stood up with the sliver, and the next walking
   drain collapsed the player beside the same foes. The respawn's fatigue is now at LEAST the health's fraction
   (`systems/deathRespawn.js` reviveForPlay); more than that is kept; a living release (no force) is untouched.
2. **The minutes spent dead were charged to the revived body.** Online the shared clock runs on under the death screen
   with nothing ticking (the hosts hold their frame under a window), so the player's markers stood at the minute of
   death and the first tick after the rise replayed the whole span - every minute of stamina drain and needs
   (runSurvivalMinutes floors only a replay's harms) and the magic rounds - against the half pool just given. Five real
   minutes on the death screen in Hard with red needs was sixty game minutes of drain: a collapse on the spot, which with
   foes about is a death, and the same bill again. DFU charges a dead player nothing: PlayerEntity.Update returns while
   CurrentHealth <= 0 (PlayerEntity.cs:352-353), before its minute loop and its marker. The revival now skips the span
   (`systems/worldTick.js` skipDeadMinutes): the player's minute marker and the round broker's move to now, the needs'
   clocks ride over it (`pauseSurvival` - hunger and wakefulness do not age in a corpse), and a 112-day normalise the span
   crossed is still paid (DISC28-F). The WORLD's markers are the world's and do not move: a room rented or a loan falling
   due runs on the world's clock through a death as through any hour. Offline there is no such span (a death is a load).
   (AUDIT TM-2/3/4 below: as first written the skip also dropped the world's calendar over the span - the day block and
   the loop's other arms - left the body's disease and poison clocks at the minute of death, and left the encounter
   loop to roll the whole span on the first frame up after a Resurrect. The span now bills the body nothing and runs
   the world's calendar through, as this paragraph says.)

[LIVED1 (2026-09-29) re-states DISC28-E as the clock's own: the character's clock stands under the death
screen, so nothing of theirs is billed or moved and no pause or shift is needed; the rise walks the world's half
of the span alone (`06-Systems/Lived-Time.md`).]

Left for Mac (below): an online collapse charges no hour (`systems/rest.js`), so a Hard player whose sleep need is
exhausted collapses every few game minutes until they rest - a survival-arc design question, not this loop. [SUPERSEDED BY
LIVED1: online the collapse's RaiseTime moves the character's own clock, so it charges its hour and pays it in full,
as offline.]

`test/disc28_fatigue.test.js` (E: 6) drives the real tick and revival: a Hard body hunted to death by its own drain,
12, 60 and 90 game minutes on the death screen, stands up at the floor and survives its first tick. AUDIT DISC19 S4's
pin re-aimed ("a sliver is raised to the floor; above the floor, fatigue left is kept") and its four mutants re-aimed.

## DISC28-F: an absence pays the reputation boundaries it crossed (6)

The conspiracy rules are DFU's to the letter (verified): `encounters.js` passiveGuardSpawns is PlayerEntity.cs:486-511's
roll - below -10 (strictly), 5% a game minute, `SpawnCityGuards(false)` - and Criminal Conspiracy's loss of 2 gives back
nothing for a served sentence (PlayerEntity.cs:2301-2303), so four arrests for one standing is DFU's behaviour. What was
NOT DFU's: the one road back. NormalizeReputations - every region's legal reputation and every faction's one point
toward zero - fires on the exact minutes that are multiples of 161280 (PlayerEntity.cs:455-459). The single-player clock
never runs while nobody plays; online it runs on through every absence, and the stamps that end one
(`alignEntityClocks` on arrival and clock correction, and now the dead span) moved the marker to now without walking the
span. At the shared clock's 12x a boundary is an instant about every nine real days, and one that fell while the player
was away was lost for good: the reputation never came back, and the player kept rolling conspiracy.

`normalizeAcross(entity, from, to)` pays each boundary in `[from, to)` once - the same minute values the per-minute
loop tests - under the prison skip's own one-jump shield. (AUDIT TM-1, Mac: "Recovery only": over an ABSENCE it pays
the recovery half alone - a reputation below zero drifts back, a standing above zero is kept; the dead span is not an
absence and pays both halves through the loop's own body.) [LIVED1: the dead span pays neither half - the drift is the
character's own, on a clock that stood under the screen.] The conspiracy roll itself is unchanged; whether to soften it
is Mac's call (below).

`test/disc28_fatigue.test.js` (F: 4): an arrival across three boundaries pays three points of recovery (a +3 kept since AUDIT TM-1), one inside an interval pays none
(DFU's `[last, now)`), the shield holds, a death across a boundary pays it.

## DISC28-G: a rising swimmer meets the ceiling, never its top face (9b)

Not a stale swim flag - every dungeon host re-reads it from the player's own block each frame, and DFU's test is height
alone against a water plane that covers the whole block (PlayerEnterExit.cs:380-392). The swimmer TUNNELLED UP THROUGH A
CEILING that was under that plane. A swimmer is crouched to 0.9 (axis 0.2) and a move steps at up to 0.2625, so the
Deep Waters stroke (Run, on by default) brought the LOWER sphere within its radius of the ceiling face while the head
was still beneath it - and PH1's one-way floor, right for a body straddling a floor, set the whole body ON the ceiling's
top. Outside the level and still under the block's water plane, the player swam on up with nothing to meet, out of the
water, and fell with no floor under the dungeon. Reproduced through the real motor, collider and stroke at 45, 30 and
20 fps. DFU's CharacterController sweeps and never crosses a plane.

The rising vertical pass (`player/collider.js` _moveStep) hands `_resolveCapsule` the body's axis: rising, a surface is
a one-way floor only below the head's centre - a floor the body straddles, PH1's own case. Otherwise it is a ceiling.
At rest, falling and moving sideways, PH1 is exactly as it was. (AUDIT MO-1 below: not a law to keep - the sideways pass
set a swimmer on a ceiling's top by another road, a wall's diagonal edge read as a floor. PH1's floor must now be a
floor-sloped face in every pass.)

`test/disc28_swim.test.js` (7). PH1's and SQUEEZE1's source pins re-aimed; ASQ-S1's mutant record re-aimed.

## DISC28-H: a flyer never starts with its feet under the floor below its marker (10)

Quest B0B70Y16 places a Dragonling (id 40, behaviour Flying) at a dungeon marker, and Meaner Monsters - on by default,
forced on online - scales its texture 2.5x. A flyer hangs on its marker as DFU's does (the transform is the sprite's
centre, RDBLayout.cs:1546-1548 grounds everything else), which puts its feet half the idle sprite below the marker: for
the dragonling, 1.5-2 m under a floor the marker stood half a metre above. DFU's CharacterController pushes a start
overlap out; the port's collider pushed the middle and head spheres DOWN from the face they were under, and the
dragonling flew on held half in the ground. Every peer's puppet mirrored those feet, and re-hung the streamed FEET as a
centre, half a sprite lower again.

`characters/enemyAnchor.js` flyerSpawnFeet floors the hang at the floor under the marker (a surface above the marker is
not the floor beneath it); a bat high under a ceiling keeps DFU's hang exactly (the ceiling-bats law). Both streamed-puppet
stands in `scenes/dungeonContext.js` build with `feetGiven`.

`test/disc28_flyer.test.js` (6 since AUDIT MO-4: the context's own `buildFoeAt` and puppet stands mounted, flown on the
real EnemyAI over the real collider). The bats pin and WORLD3's `buildFoeAt` signature pin re-aimed.

## DISC28-I: the shared quest ends for the whole party, and its house opens for its holder (1)

**The finish was never sent.** The sharer's `end quest` completes the quest and the machine tombstones it in the same
tick, which takes it out of `sharedQuestNames` - the one set the live sync walks. And the sync's measure was the log's
LENGTH, which a `killed N`, a `give pc`, a `say` or an `end quest` never changes. So:

- A finished shared copy leaves its final envelope (`machine.tombstoneQuest`, taken before the dispose;
  `takeFinishedShares`). The host sends it once, `sync` and `final` (`scenes/world.js` questSyncTick), before anything
  else in the tick can return. (AUDIT QS-1/QS-2 below: "once" lost it - the client's ten-second floor between quest
  frames refused a final that followed any sync, and the watch ran only outdoors. The final now waits on the machine
  until it has left (`nextFinishedShare`, `settleFinishedShare`), retried each frame, in every mode.)
- The receiver's standing copy is restored as the running quest it was a tick before the end, its newly-completed
  rewards re-armed as every resync's are, and ended by the quest's own EndQuest (`machine.updateSharedQuest`): the two
  ticks of grace run the re-armed `give pc` once, the reputation and the notebook entry are the receiver's own, and a
  finish a partner brought is never sent back. Restored as complete instead, it would have been tombstoned with every
  reward unpaid (a complete quest never updates).
- A final envelope never makes a copy for a member who never took the quest (`questShare.receiveSharedQuest`,
  'finished', said to nobody). (AUDIT QS-3/QS-4/QS-5: nor does an ENDING one - `shareEnvelopeEnding`; a copy already in
  its grace takes no envelope; nothing is synced from grace; and a refused final, or a sync's 'done', is said to
  nobody.)
- The sync watches `shareSignature` - the log, every task's trigger, every action's completion, each Foe's kills and
  injury, the end.
- `get item` joins the actions a receiver replays (REPLAYABLE_ONE_TIME_ACTIONS): a shared quest's items are the
  receiver's own roll, so The Courier shared after the sharer took the package now hands the receiver theirs, once.

**The door.** The lock ladder's quest rung asked the SITE LINKS, which only a placement action makes. DFU's
IsActiveQuestBuilding (PlayerActivate.cs:1315-1329) asks GetAllActiveQuestSites - every Place of every incomplete quest,
by building key and map id, House1-House6 when residencesOnly. The Exterminator names its house and places nothing in
it, so its own holder was locked out while the friend it was shared with (whose receipt links every Place) walked in.
`machine.isActiveQuestBuilding` is DFU's member; the door (`scenes/worldModes.js` questSiteHere) and the house market
ask it.

`test/disc28_quest.test.js` (9): the real machine, the real share path and the vendored A0C00Y07. QUEST-PARTY's and
PARTY8's pins and records re-aimed.

## DISC28-J: a partner's quest foe credits a linked copy (9a)

Atronach Hunting (N0B10Y01) offline was read end to end and is correct. Online, the party law stood a peer's quest foe
for any party member (`questShareSeam.accepts`), but its death credits only a copy LINKED by a share
(`sharedQuestFoe`). Two members who each took the quest (a share refused as 'active' - the sender's copy is marked shared
the moment it sends), or a copy whose link a reload dropped (the link is session state), stood the partner's atronach
beside their own and killing it counted for nothing. A peer's quest foe now stands only for a linked copy; an
independent one fights its own. (AUDIT QS-J below: that law is for STANDING a puppet only. A foe a member hands me as
its heir is taken on party membership, kept on the partner's word, and a party member's blow lands on it - narrowed
with the rest, the heir refused it and it was gone for everyone.)

## DISC28-K: a house re-picked by a later quest shows that quest's name (3)

A residence Place rolls a fresh surname on every pick (Place.cs:1219-1224, :1298-1311), and `discoverBuilding` returned
early on any building already discovered (PlayerGPS.cs:926-927) - before the live quest's name was read (:945-959).
The first job's name was never cleared: its tombstone's undiscover (Quest.cs:655) and the next job's topic-add
undiscover (TalkManager.cs:2958) both act at the CURRENT location and only on a stored name equal to the new one, so a
job ended in another town left "The X Residence" standing and the next job's "The Y Residence" never displaced it. The
quest said Y; the door and the map said X. DFU does the same. THE DEPARTURE (Port-Ledger A): a stored name the live
quest no longer gives, once the player has learned of it, is re-stamped. (AUDIT QS-K1/QS-K2: in place - the player's
own map name and the lockpick record kept, a house the player owns never renamed - and at the town map's open too.)

`test/disc28_names.test.js` (2).

## For Mac

- **Conspiracy (6).** Faithful, as the DFU developer said: below -10, 5% a game minute, and a served conspiracy
  sentence gives back nothing. DISC28-F restores the only recovery DFU has (the 112-day normalise) to online players -
  over an absence its recovery half alone (AUDIT TM-1, Mac: "Recovery only").
  Whether to soften the roll itself (the threshold, the chance, or a grace after release) is a design change and is
  yours to call. [ANSWERED by REP1 (2026-09-29, Mac: *"Challenged on sight"*; `06-Systems/Standing-Arc.md`): the roll
  is retired - a guard who sees a known criminal stops them, two game hours between stops, a day's grace after release,
  and a served Conspiracy gives its charge back.]
- **An online collapse charges no hour.** With the survival arc on Hard, an exhausted sleeper collapses every few game
  minutes until they rest, each collapse a death with foes about. The revival no longer causes this (DISC28-E); whether
  a collapse should ease the sleep need online is a design question.

## Records

- Mutants: `tools/mutants/disc28.json` (48 dead). Re-aimed: `jail_hit.json` (6), `auditdisc19.json` (four S4 records),
  `auditparty8.json` (AP-quest-echo), `auditsqueeze.json` (ASQ-S1).
- Citations: `tools/citeShift.mjs --base fe95d9592 --apply --struck`, once (264 moved); the worldModes DiscoverBuilding
  note re-aimed by hand to `discovery.js:93`; `Hardening.md:642` quotes a past mismatch as history and stands.

## AUDIT (2026-09-28, before the merge)

Mac: *"Do it"* - merge main in, audit the batch, write the patch notes, open the PR - and, the audit's findings in
hand, *"don't cut anything, definitely fix everything"*. The branch was first merged with main (#415, and #417: the
27h batch, AUDIT 27h and DIAL-LOAD - every conflict a cite number both sides had moved but two, `tools/citeMerge.mjs`
on the merged tree), then read in five lanes - the pause key and the shop box; the arrest and Speed; the dead span and
the absence; the swimmer and the flyer; the shared quest - each on a snapshot of the merged tree with DFU's own C#
beside it, every finding reproduced through the real modules before it was reported. Each lane then fixed its own on
its own branch, and every fix was read again here before it was taken. Pinned in `test/auditdisc28_ui.test.js`,
`auditdisc28_arrest`, `auditdisc28_time`, `auditdisc28_motion` and `auditdisc28_quests`, beside the batch's own
re-aimed pins; the mutants in `tools/mutants/auditdisc28_*.json`, all dead, and every older record whose site or
killer a fix touched re-run.

### The pause key and the shop box

- **UI-1**: a pause moved to a Ctrl/Alt combo, or to a bare Ctrl or Alt key (the Controls pane binds both), opened the
  pause screen and could not close it: the enhanced face refused every Ctrl/Alt key before it asked what the key meant,
  and the classic window compared the press's bare code with the binding, which for a combo is never a press's code.
  Both read the event now (`eventMeans` - DFU's GetKeyUp answers a combo through GetUnaryKey, its modifier held); every
  other Ctrl/Alt chord is still refused on the face.
- **UI-2**: "never its auto-repeat" held for a rebound key only. With the shipped Escape the held press that opened the
  enhanced face closed it on its first repeat, and the classic window armed its deferred close on the opening press's
  repeats and shut on its release. DFU closes the pause window on the key's RELEASE
  (DaggerfallPauseOptionsWindow.Update: GetKeyUp(toggleClosedBinding) || GetBackButtonUp()), and a held key never
  repeats there: the face now arms on a press it saw, swallows every repeat and acts on that press's release (the
  boot menu keeps its press); the classic window arms on a press alone.
- **UI-3** (Mac: *"Keep it"*): the pause key also closes the Enhanced F5 page, which IS the pause window since
  F5-QUESTS. DFU's sheet closes on its own key or the literal Escape. A recorded departure (Port-Ledger A).
- **UI-4**: the TextKey half of DISC28-A guards a branch no page reaches (KB1 took the mod keys into Controls, where
  FIX-F's stand-down already covers them). Kept as a guard; the section above says so.
- **UI-5**: `disc28_pause`'s key table was an empty store, so "the default binding resumes" had no binding at all, and
  a mutant reading the action off the code alone lived. Rebuilt over `resetDefaults`, with the pause shared with
  QuickLootAll on P and the shipped Escape's repeat.
- **UI-7** (older than the batch, found reading A's repeat law): the two outdoor key ladders (world.js, exterior.js) run
  no routeKey, and AUDIT KB1's repeat guard stood at their TAIL - so a held F9 quicksaved on every auto-repeat (the
  tail's own note says it cannot), a held Q recast, and a key whose window shut on its press (F5's page) opened it
  again on the next repeat. The guard is each ladder's first act now, as routeKeyAction has it; F11 under a window
  loads once per press.
- DISC28-C stands, proven in Chromium on the shipped stylesheets: as shipped every wear bar, padlock and rune is under
  the scrim; with the box forced back to z auto, seven wear bars and three padlocks paint over it. The other confirm
  boxes (the loot window's, the ported windows', the tavern's) live on body layers above the rows.

### The arrest and Speed

- **AR-1**: a LOAD carried the old game's arrest into the loaded one. DFU never loads under the court (InputManager
  .Update reads no action under a pausing window but QuickLoad during PlayerDeath.DeathInProgress); the port's F11
  loads from under any window (FIX-E, a choice every host shares, kept). Under the plea box the trial rode into the
  loaded game - `arrested` stood, the old sentence was served on the loaded clock and its release cleared the loaded
  save's own crime; under the surrender box the loaded character was asked the departed guard's question, and N landed
  that guard's blow. `arrestFlow.abandon()`, called by worldQuickLoad, ends both the way DaggerfallCourtWindow.OnPop
  ends a trial (Arrested and InPrison false, the court's windows closed) and runs nothing of ReleaseFromPrison; a
  withdrawn question and a trial no longer standing act on nothing that reaches them late.
- **AR-2**: under the boot's default mods the third-person body played two swings for one blow. Eye of the Beholder's
  GetMeleeAnimTickTime asks GetMeleeWeaponAnimTime with the PlayerEntity and the weapon's type and hands, so Roleplay &
  Realism: Items' weaponBalance times the sprite as it times the blow; the port's body asked with the Speed alone and
  took DFU's line. The rig hands the body the weapon's `animCtx`.
- **AR-3, AR-4** (pins): N after the crime clears lands no blow; a Fortify Speed cast between two swings on the real
  rig times the second to the formula (the source regex it replaces passed a rig that froze the Speed).
- **AR-5, THE FOUR HOSTS for `crimeCleared`**: world.js is wired (the fast-travel arrival); its other clearer, the
  location exit, cannot fire under the box (the motor is held). exterior.js builds its own flow but has no travel map
  and no clearer outside the court. worldModes.js raises the box through the host's flow and clears nothing itself.
  dungeonContext.js has no watch and no arrest.

### The dead span and the absence

- **TM-1** (Mac: *"Recovery only"*): DISC28-F's absence arm ran NormalizeReputations over time the player was not
  there, and that member walks EVERY reputation toward zero - a break wore every guild, temple and noble standing down
  a point per nine real days away (a Fighters Guild 40 came back 30 after 95 days, and was demoted at the next rank
  check), a cost an absence never had. An absence now pays the recovery half alone (court.js `recoveryOnly`, the
  port's online time model): a reputation below zero drifts back, a standing above zero is kept. The dead span is not
  an absence - the player is on the death screen while the world runs - and pays both halves. Port-Ledger A.
  [LIVED1: the dead span pays neither half - the drift is the character's own, on a clock that stood under the
  screen. Stamped by AUDIT LIVED1b T14.]
- **TM-2**: a party mate's Resurrect, the Privateer's Hold rise and the Burning Court's cast-out rolled every dead
  minute's encounters and the 5%-a-minute Criminal Conspiracy on the first frame up (a guard call at the rise in 46% of
  rises after twelve dead game minutes at -15): the encounter loop's marker is the host's, and only the respawn's own
  path reset it. The skip raises DFU's PreventEnemySpawns, which every host's loop reads - the next tick takes a span of
  nothing and lowers it, as PlayerEntity.Update's tail does.
- **TM-3**: the skip paid the span's normalise and dropped the rest of PlayerEntity.Update's calendar - the day block's
  room sweep and loan check (a room that ran out before the midnight a corpse lay across was held a day more) and the
  loop's faction-power, regional-condition and racial override quest arms (the werewolf's and the vampire's cure
  roll). The loop's body is one function now (`runCalendarArms`), which the tick and the skip both walk, after the day
  block, in Update's order. [LIVED1: the rise walks the WORLD's arms alone - the landlord, the loans, the drift and the
  racial quests are the character's and wait for the minutes they live.]
- **TM-4**: the body's own effect clocks stood at the minute of death: three days of a hidden tab with the Plague stood
  the player up at half health and killed them on the first tick - DISC28-E's own bug by another road. The skip carries
  them over the span with the walk an arrival already used (`carryOwnEffectClocks`); the world's markers stay put. [SUPERSEDED
  BY LIVED1: the effect clocks stand with the character's clock under the screen - there is nothing to carry, and
  `carryOwnEffectClocks` is gone.]
- **TM-5** (pin): a 100-round effect across a 60-minute death spends exactly one round at the rise.

### The swimmer and the flyer

- **MO-1**: PH1's one-way floor read the CONTACT's direction, and a wall quad's diagonal edge, nearest a sphere pressed
  just under it, reads as a floor: the lower sphere was set on the edge and, under a ceiling, then on the ceiling's
  top. The same report by the sideways pass, before DISC28-G and after it: a swimmer along a wall left the level from
  31-56 of 1404 starts per mode (60/30/20 fps, stroke off and on), a crouched walker in a crawlspace ended on the
  ceiling in 28 walks of 192, a runner sliding along a wall was thrown half a metre up. A CharacterController stands
  only on what its slopeLimit calls walkable, judged by the touched triangle's own normal: PH1's floor must now be a
  floor-sloped face (`faceNy`). After: 0 in every one; 126 ledge jumps, 36 staircase runs, 14 step-ups, 32 ramps across
  the 70-degree line and 4 side slopes identical; a 40,000-case fuzz differs in 24, none of them a new tunnel.
- **MO-2**: DISC28-G's two "PH1 still holds" pins started with the lower sphere above the floor, and PH1 deleted
  whole survived the file. They start under it now, and kill the batch's own mutants.
- **MO-3**: the Deep Waters stroke at its Swim Speed Multiplier's top (30, offline - the online lane holds 1) moved over
  a hundred metres in a slow frame, past the collider's exact sweep, and tunnelled up through any ceiling. One stroke is
  one sweep now, handed over in pieces the collider sweeps exactly (`EXACT_SWEEP_MAX`), as one CharacterController
  .Move is.
- **MO-4**: DISC28-H's builder read and puppet stands were pinned by a hand copy and source counts. The read has one
  home (`enemyAnchor.js` floorUnderHang, flyerStandFeet), and `disc28_flyer` mounts the context's own builder and
  stands and flies what they build on the real EnemyAI.
- **MO-5, THE FOUR HOSTS for DISC28-H - FLAGGED**: exterior.js, world.js and worldModes.js (interiors) stand their
  flyers through `scenes/exteriorFoes.js`'s own hang, which is not floored. An exterior's terrain catches a flyer on its
  first move; an interior's collider has no floor function. Not reproduced here (the sprites' sizes are in ARENA2); its
  own slice if it is ever seen.

### The shared quest

- **QS-1**: the finish was still lost in the common case - the Discord report, standing. The finals loop sent each
  final once through `shareQuest`, which returns false inside the client's ten-second floor between quest frames, and
  `takeFinishedShares` had already drained it: a blow, a kill or the reward synced in the seconds before the end spent
  the floor, and the partner's copy never ended. A closed socket or a refusal lost it the same way. The final now stays
  on the machine until it has left (`nextFinishedShare`, `settleFinishedShare`), retried each frame, oldest first -
  the ordinary sync's own law (AUDIT DROPS C1) - and nothing is synced from EndQuest's grace (`ticksToEnd`), which
  was what spent the floor. A final the HUB refuses as 'busy' (the room's budget - a bare social error, no id, after
  the client counted it sent) goes back on the machine when that word lands inside the hub's cooldown of the share
  (`onQuestBusy`, `pendFinishedShare`); an ordinary sync never does (sent as a final it would end the party's copies
  on the state before the end), nor a terminal word, a late one, or one after a load.
- **QS-2**: the watch ran below the exterior's modal return, and the interior and the dungeon tick the machine inside
  `modes.frame`: a shared quest finished in a house or a dungeon (The Courier's end is in the residence) told nobody
  until its player walked out. One call above the modal gate covers all three modes (THE FOUR HOSTS: world.js runs it
  for its own modes; exterior.js has no hub link; the standalone ?dungeon is offline).
- **QS-3**: a partner's final meeting a copy already finished (both delivered; a timer that ran out in every world on
  the same tick), and a receiver's ending copy synced back, put "... tried to share it, but you have already done this
  quest" on screen. A refused final and a sync's 'done' are said to nobody.
- **QS-4**: a copy in EndQuest's grace reads neither complete nor tombstoned, so a second envelope was restored over it:
  a second member's final ran endQuest again (the reputation and the notebook entry paid twice), and one from a member
  still behind untriggered the reward. A copy already ending takes no envelope; and AUDIT DROPS A2's once-per-action
  gate, which the ARMING spent (so a reward armed and not yet fired was refused by the next envelope), is retired - the
  once is the firing's, completion being monotonic across a resync.
- **QS-5**: the sharer's grace sync handed a member who joined after the share an ending quest and its reward, a copy
  that never ended. An envelope whose `end quest` has run (`shareEnvelopeEnding` - EndQuest never re-arms) makes no
  copy.
- **QS-J** (a DISC28-J regression): DISC28-J's linked-copy law also gated a HANDED foe - the owner's `heirOf` names the
  nearest party peer whatever that peer's copy, the heir refused it and the owner let it go, lost for everyone. Puppets
  still stand for a linked copy alone; a handed foe is taken on membership (`partyPeer`), kept on the partner's word
  (`_keptTag`), and a party member's blow lands on it, in both hosts that carry the pool (exteriorFoes,
  dungeonContext). And the orphan law (`adoptsOrphanQuestFoe`), which picks by party id alone, could pick an unlinked
  member, who stands no puppet: an unlinked member now KEEPS the records it refuses to stand - no puppet, nothing
  drawn, struck, counted or credited, bounded as the puppets are and ending wherever a stood record would - and,
  picked, takes the foe from one as a linked member takes its puppet.
- **QS-K1** (a DISC28-K regression): the re-stamp rebuilt the discovery record, wiping the player's own map name and
  the lockpick record, and could rename a house the player owns (a partner's shared quest picking it) - whose
  tombstone's undiscover then deleted the record. It rewrites the name in place and never touches a house the player
  owns (DaggerfallBankManager.IsHouseOwned: DFU's own data, where a new flag would be a save field no older record has).
- **QS-K2**: the town map opened on arrival drew the stored name until a door was touched; the same re-stamp runs at
  the map's own open.
- **QS-D**: the lock ladder's contract comment still called the quest rung "the siteLinks walk".

### What stands, and why

- **An absence walks no other calendar arm.** Over time away only the normalise's recovery half is paid (TM-1); the
  faction-power and regional-condition arms, the racial override quest rolls (the cure roll among them, about every
  seven real days at the shared clock's rate) and the day block are not walked - they fall only for a player online and
  alive at that minute. Every other marker SHIFTS across an absence (WORLD5 C3); walking these would make time away
  cost what it never has. The online time model's standing rule, recorded (Port-Ledger A, TM-1's row).
- **A loan reminder that fell under the death screen is not said.** The rise has no HUD sink of its own; the loan is
  settled as on any day.
- **PreventEnemySpawns at the rise** also stills world.js's chunk-load camp roll and reads "resting" to the hunting
  environment until the next encounter tick lowers it - DFU's own flag, its own side effects.
- **The hosts open the pause on the press** (DFU's GameManager opens it on the release); both pause windows absorb that
  now (UI-2).
- **UI-3** is a recorded departure (Mac: "Keep it"); **UI-4**'s stand-down guards a branch nothing reaches, kept.
- **MO-5**: exterior.js, world.js and worldModes.js stand flyers through exteriorFoes' own hang, unfloored - flagged,
  not reproduced without ARENA2.
- **The shared quest's two edges past the fix**: a sender still on an older build sends grace syncs until it reloads
  (one session, EVENT1's note); and a copy saved inside EndQuest's two ticks of grace never ends on reload (ticksToEnd
  is no save state - DFU's own). A receiver whose re-armed action fires on a copy that is not ending sends one ordinary
  sync back: harmless, it spends that receiver's floor. A member offline when the final leaves keeps a live copy they
  can finish alone (the hub fans to live sockets only).

### Also fixed here, older than the batch

- The camera's recoil sway on a world-hosted dungeon's own load, recorded by 27h's DIAL-LOAD read: the context raises
  `onStartLoad` once its own load is under way and worldModes hands it the world host's `cameraRecoilReset`
  (`test/dialload.test.js`).
- `tools/mutants/auditdisc19.json`'s AUDIT-DISC19-W3-quiet-cumulative no longer parsed (its `else` left dangling);
  re-aimed to make the stand-down clock run under a threat, and dead.

### Records (the audit)

- Mutants: `tools/mutants/auditdisc28_ui.json` (18), `auditdisc28_arrest.json` (14), `auditdisc28_time.json` (12),
  `auditdisc28_motion.json` (14), `auditdisc28_quests.json` (61), `dialload.json` (+4, 10) - all dead. Re-aimed by
  content where a fix moved their text: `disc28.json` (A, B, D, F, G, H, I, K records), `auditdrops.json`,
  `auditqp.json`, `questparty.json`, `questparty3c.json`, `soc2.json`, `auditdisc19.json`; every older record whose
  site or killer a fix touched re-run by its lane, all dead or equivalent as recorded.
- Pins re-aimed: `disc28_pause` (rebuilt), `disc28_swim`'s two PH1 pins, `disc28_flyer` (rewritten), `disc28_fatigue`'s
  F arrival and E room, `disc28_quest`, `auditdrops` A2, `disc22f_share_copy`, the questparty and cursesync pool seams,
  `ph1_physics`, `incident_ceiling_bats`, `roade_up_seam`'s E1, `fixe_deathMenu`'s FIX-E window (900 -> 1100, its
  reason beside it).
- Citations: `tools/citeMerge.mjs origin/main 408877576 --apply --struck` for the merge (224 moved); then
  `tools/citeShift.mjs --base 2a8b70b2a --apply --struck` once over the audit's fixes (318 moved); by hand, by
  content: chargenSession.js's overlayHover continuation (twice - a bare `(:N)` on its own line, which neither
  mapper can pair) and audit58_pins' `court.js:228-229`; `discovery.js:93` still names the re-discover it means.
