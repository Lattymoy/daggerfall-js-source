# FIELD BUGS 2026-09-30b - two screenshots: the immortal at zero, the respawn that still fell

*The same letter, twice (the merge of PR #488 with main, 2026-10-01): these two were written on main (PR #489) while
part two - five screenshots and Mac's "you can get instakilled when fishing" - was written on PR #488's branch under
the same name. The merge keeps both here, so every cite of this page stands; part two's numbers (1-7) and its pins'
`#N` are its own.*

Two #bug-reports threads of the same day, after the morning's batch (`Field-Bugs-2026-09-30.md`, PR #468) merged. Both
were root-caused on the real modules with a reproduction before anything changed; each fix is pinned red on the code
before it.

| | Report | Reporter | What it was | Done |
|---|---|---|---|---|
| 1 | "If you cure a disease and die at the same time you will became immortal" (the HUD at HEALTH 0%, MAGICKA 0%, FATIGUE 3%) | Niwy | not the cure: the death was lost. The damage door raises a death once, on the blow that crosses to zero, and the death lives in its screen; a temple priest's Talk indoors closes into his service window by a raw write over the building's slot, and a player killed under the talk had their death screen replaced by it - the cure was bought at zero, and nothing ever raised the death again | fixed (DEATH-KEPT) |
| 2 | "Spawned in the air after dying. One time I died in a dungeon, and for some reason I respawned high enough in the air to kill me with fall damage." | BrixBlox | most likely the morning's RESPAWN-GROUND on a build from before it (the report is undated, and a tab left open keeps its code); but one road stood after it: the teleport's awaited build stepped the motor for a dungeon death, and a body stood over the new pixel at the dungeon's own height fell onto the models' colliders as each went in | fixed (RESPAWN-HELD) |

## DEATH-KEPT: a player at zero is dying, whatever took the screen (1)

**Reproduced first** (the real `hurtPlayer`, the plague, `statMods`, townTalk, the window stack, `DeathScreen` and
`buildCureDiseaseFlow`; the building's slot rules transcribed from `worldModes.js`, which needs ARENA2 to construct): a
plague-weakened player at the temple (HEALTH 16%, live STR/END 11/6), the priest's popup up, Talk pressed. Indoors the
popup comes down and the talk opens in townTalk's slot with a close that mounts the popup again. A blow lands under the
talk - a building's foes keep their clock under a window (WINFOE1) - and the building's presenter puts its `DeathScreen`
into its own slot, beneath the talk. The talk closed: its callback's `mountServiceWindow` writes the popup over the
screen, and the next reconcile replaces the stack's top with it. Cure Disease, Yes, "You are cured": the dialogs close
and play resumes at HEALTH 0%, MAGICKA 0% (the plague's drain), FATIGUE 9% (the cure lifted the STR/END drains, so the
maximum grew under the same fatigue - the screenshot's 3%). Ten 50-point blows, five more plague days to live STR/END 0
and six seconds of the stat-zero kill: no death.

**Why.** `hurtPlayer` raises a death on the TRANSITION (AUDIT 21 - a still-ticking effect re-presenting the screen
once per round was the fault it closed): once at zero, `wasAlive` is false for every later blow, and the stat-zero kill
and the exhaustion collapse both stand down at zero. So the death lived in its screen alone, and a screen is a window:
the popup's Talk callback writes the building's slot raw, and the stack's `reconcile` swaps its top in place without
asking `holdsTop` (RISE-STUCK's rule is the push's alone). Online the D12 gate reads the screen, not the health, so the
player at zero rejoined the room alive and no respawn ever came. DFU cannot be here: `PlayerDeath.deathInProgress` is no
window, and nothing but the reset clears it.

**The fix** (`scenes/world.js`, the frame; `characters/playerEntity.js` `presentPlayerDeath`): every frame, after the
video hold and above every mode gate, a player at zero with no death screen up - townTalk's or the mode's - and the
world not moving is presented again. The presenters already refuse a second screen over their own, so a death on
screen is untouched; a load restores the save's health under its latch and a respawn heals first, so neither is caught
mid-way. It covers every door that can take the screen, not only the priest's: the stack's replace, the surrender box
("O1 - the replace door", `Field-Bugs-2026-09-27c.md`), a journey's level-up box over a death on the road. `presentPlayerDeath`
is no blow - the saves, the shield and AvoidDeath were asked on the transition, once. `test/systems/fb0930b_deathkept.test.js` (3).
`tools/mutants/fb0930b_deathkept.json` (8, all dead).

Found on the way, not changed: the doors themselves still take the screen for a frame, and the death presented again
starts its fall and (online) its minute over; closing them one by one - `mountServiceWindow` over a death, `reconcile`
honouring `holdsTop`, `townTalk.showOverlay` over a screen that holds the top - is the tidier half and touches every
host's slot, so it is left for its own slice. Stendarr's AvoidDeath restores `trunc(MaxHealth * 0.1)`, which is zero
below ten maximum (a werewolf's unsated urge floors it at 4): DFU leaves that player at zero until the next blow re-asks;
here the next frame presents the death.

## RESPAWN-HELD: an arrival holds the motor while its destination builds (2)

**Reproduced first** (the real StreamingWorldState, Collider, PlayerMotor, floorLanding and applyFallLanding, the host's
heightAt and the RESPAWN-GROUND eye lines lifted): a dungeon at 300,250 whose entrance keep (18 units) stands at the
location's centre, the exterior carrying a vertical recentre (`compensation[1]` -150 - ResetStreamingWorld keeps it
across `state.init`), the body revived at 60 of 120. The keep's collider goes in 0.6 s into the build and the pixel
publishes at 2.2 s: the body, stood on the new pixel's centre at the dungeon's height (-3.5, 31.5 above the roof), falls
onto the roof at 1.67 s - a 28.5-unit fall, 117 health, dead. Held, the same respawn lands on the ground with nothing
billed. Died 16 units into a fall in the dungeon: 44.5, 197 stepped; nothing held.

**Why.** The frame steps the motor unless an overlay or the season's re-skin holds it, and bills every landing. An
outdoor death's screen is townTalk's and stays up for the whole of the respawn's await (AUDIT CONTRIB A6), so its motor
was held; a dungeon's (or a building's) is the mode's own, and `respawnOnlinePlayer` leaves the mode - its screen with it -
before it awaits `_teleportToPixel`. The next overlay goes up only at the tail. For the build's frames nothing held the
body: RESPAWN-GROUND's eye fix stands it over the pixel's centre (the location's, where its models are) at the
interior's own height, a location model's collider is added between breathing frames before the terrain publishes, and
wherever that height stood above a roof in the new world's vertical frame the body fell onto it and the frame billed
the fall before the landing's `player.spawn` re-anchored it. Where it stood below the ground (no recentre carried) the
body fell unseen under the half-built world and the landing stood it up - the common case, which is why the morning's
fix read as whole.

**The fix** (`scenes/world.js`, the frame): the motor is held while the arrival's latch (`_seasonStraightening`) is up -
`_teleportToPixel` raises it before its first await and drops it in the build's `finally`, and nothing is awaited
between that and the landing, so the latch is exactly the build's frames. A held frame steps nothing and bills nothing
(`holdFrame`); the landing's `player.spawn` re-anchors the fall, so a death mid-fall carries none of it across. It
covers every teleport's build - the respawn, Recall, the cemetery, a quest's teleport, the court's release, fast travel
and the loads - none of which walks the player during it. `test/player/fb0930b_respawnheld.test.js` (2); `seasoncalendar`'s
hold pin re-aimed (PIN MOVED). `tools/mutants/fb0930b_respawnheld.json` (2, both dead).

Found on the way, not changed: a checkpoint (the two-minute realm checkpoint, the page-hide save) is not refused while
the world moves, so one composed during a build records the body where it waits - over the pixel's centre at the old
place's height - and a later load stands it there (with FALL-KEPT's fall, if one rode). Held, the body no longer falls
in the wait, but the height is still not the ground's. FALL-KEPT chose not to refuse the quiet saves in the air (a
refusal loses their progress); refusing them mid-move is the same trade and is Mac's call.

## Part two - the fishing death, the tools that gathered nothing, the werewolf's bank, the falling foe, the unmarked residence, the Overworld's surf

Five screenshots of the Discord's #support and #general, and one line of Mac's own beside them: *"Also you can get
instakilled when fishing"*. The rule for a batch like it: every report root-caused on the real modules, the port's own
faults fixed and pinned, and what was Daggerfall's own (or a mod's) fixed wherever it failed the player - Mac, on this
batch's first answer, which had left the drowning collapse and the tools' Foraging use as the source's: *"I dont care
about DFU. We're our own thing now."* So SWIM-SPENT and TOOL-USE, and nothing here is offered back. Six
investigations ran first, each on the real modules with a reproduction; the fixes were built and pinned one to a tag.
The letter is this batch's own: 30's page is PR #468's.

| | Report | Reporter | What it was | Done |
|---|---|---|---|---|
| 1 | "you can get instakilled when fishing" | Mac | on a lake the net works only while the angler swims, and a swimmer holding still pays the swim's fatigue (8 or 33 a game minute); at 0 in the water DFU's collapse is death whatever the health, said after it - the day's forty hauls take about as long as a 6,400 bar lasts at Swimming 5, and nine seeded days in twenty died inside them | fixed (FISH-TIRED, SWIM-SPENT) |
| 2 | "I've been chopping wood but it doesn't look like anything about the logging profession is changing"; "using my sickle to gather herbs in the wild, but I dont get any exp"; "I fish, or use the axe and I get no exp ... I just physically get lumber in the misc tab" ("Skinning is working though") | midijamz, Maevin, 名無しの人 | a tool used from the pack or the hotbar is Foraging's own gesture (FORAGE0 law 4) - the mod's yields into the pack, its quest, no profession - and nothing said so; the professions gather only at their nodes | fixed (TOOL-SAID, then TOOL-USE) |
| 3 | "is it normal when u become a werewolf you loose the gold in your bank and u have to rejoin fighters guild~?" | Guppy | the curse takes nothing (walked on the real tick, a save and a load with it); online every bank is "The Bank of the Empire" but a deposit lives in its region's account, and the teller in another region read "Account balance 0" | fixed (BANK-REGION); the rest said |
| 4 | "constant fps drop in overworld? Resets after saving\loading, heard its from an enemy endlessly falling through the ground somewhere" | ReynBlackwinter | a World of Daggerfall camp's foe (never culled) re-minted by a load over a pixel not built falls for ever, and every fixed step of the fall costs more collider work - 2,560 capsule resolves a frame from 201.6 s, one foe | fixed (FALL-HOLD) |
| 5 | "a couple quests that take place a <someone>'s residence. People aren't marking it on the map ... every door looks like just a house I can buy" | midijamz | three: the Enhanced town sheet never rang a residence an NPC had marked (it is override-named at its discovery); DFU's 35% roll marks 26 questions in 100; a nameless house drew no plaque, so its HOME2 verbs never showed and the first click at any house asked "Buy it?" | fixed (RES-RING, RES-MARK, HOME-PLAQUE) |
| 6 | a screenshot: the Overworld over a coast, the sea laid over with light-blue rectangles | (no words) | Come Sail Away's breaker strips, surf from a ground eye, seen whole from the travel view's 150-450 m | fixed (TV-SURF) |
| 7 | "If i battle I'll die / And I was trying to sail to Privateers hold" ("I can't fix it without battling") | ItMustBeMonday | answered in the thread by Mac ("Okay I got you"); the words do not say what the fight is | asked |

Pins: `test/fb0930b_{fishtired,swimspent,toolsaid,bankregion,fallhold,questresidence,tvsurf}.test.js` (31), each file
red on the code before (guards green both sides: `bankregion`'s walk of the curse, `fallhold`'s interior floor,
`toolsaid`'s lanes). Mutants: `tools/mutants/fb0930b_*.json`, 95 records, 95 dead; older records re-aimed by content
(`em34` EM4-14, `forage1` FORAGE1-18, `foecatchup`'s two step records, `csa_close`'s CSA-J dungeon hook, and the four
cite records of `survtiers`/`survtiers3` the cite shift moved), all dead.

## FISH-TIRED: no net in the water on the last quarter of the fatigue bar (1)

**Reproduced first** (the real gathering host, Fishing's kind and act, the real player ticker - `scenes/shared.js`
createPlayerTicker over `systems/worldTick.js` - and world.js's collapse over them): an angler in a lake, Swimming 5,
STR and END 50 (a 6,400 bar), fishing the day's forty. From a full bar nine of twenty seeded days died inside the forty
(hauls 36-39); from three quarters at haul 31 (12.6 real minutes), from half at haul 21 - each at 100 health. The same
angler on a pier at sea spends no fatigue and fishes all forty.

**Why.** The net works in its water (FORAGE0 6.4's test, `netHasWater`): swimming, or at sea - on a lake, that is
swimming. The minute's band charges a swimmer holding still the swim's price: FATIGUE-IDLE spares only `standing &&
!swimming` (`worldTick.js`), and the swim arm costs 44 on a failed Swimming roll and 11 on a passed one, times 0.75 - 33
or 8 a game minute, a game minute every five real seconds. MEASURED through the ticker: 6.34 fatigue a real second at
Swimming 5 (the bar gone in 16.8 minutes), 4.71 at Swimming 40, 1.59 at Swimming 100 or for an Argonian. At 0 in the
water DFU's collapse is death, whatever the health: PlayerEntity.OnExhausted `SetHealth(0)`s a swimmer
(`systems/rest/rest.js` exhaustionOutcome, world.js onExhaustedExterior's `hurtPlayer(entity, entity.health)`), and the only
line is the one after it. Nothing warns: no fatigue line exists in the port, only the HUD's bar - while each cast holds
the eye on its meter for 5-85 s. A Lamia's fatigue rider (damage x 128 a hit; two in twenty of the underwater table)
reaches the same death.

**The fix** (`scenes/fishHost.js`): the net keeps its angler off the collapse (the collapse itself is SWIM-SPENT's,
below): no cast in the water under a quarter of the fatigue bar (`NET_TIRED_SHARE`), and an act there ends when the bar
falls into it (the kind's frame cancels the act it started); the prompt and E say "too tired to fish in the water - get
out and rest", with a quarter of the bar to swim out on (of 6,400, four minutes of treading water at the worst rate).
The test is the collapse's own - Foraging's world's `swimming`, `isPlayerSwimming` - so a pier or a deck asks nothing.
`test/systems/fb0930b_fishtired.test.js` (3), red on the code before.

**Not chosen.** Charging a still swimmer nothing (a change to every swimmer; FATIGUE-IDLE kept the swim's price on
purpose, and it misses the Lamia); a warning alone (a toast among the haul toasts, and the trap still set).
**Found on the way, left.** At sea, an angler between 62.5 kg carried (the afloat line, weight x 4 > 250) and the net's
encumbrance check (75 kg at STR 50) casts while sinking - DFU and Deep Waters' own law, with its line ("You are
carrying too much to stay afloat.") and some 30 s of breath; a trophy (1 in 200 hauls) can push a pack over it. For Mac.

## SWIM-SPENT: a swimmer who runs out of fatigue drowns, not at once (1)

Mac, on this batch's first answer - which fixed the net and left the collapse as DFU's: *"I dont care about DFU.
We're our own thing now."*

**Why.** DFU's PlayerEntity.OnExhausted `SetHealth(0)`s a swimmer whose fatigue runs out, whatever the health, and says
so only after ("Fatigue overcomes you and sends you to a watery grave....") in a box that held the swimmer still. The
port kept it 1:1 in the three hosts a swimmer can collapse in (`scenes/world.js`, `scenes/exterior.js`,
`scenes/dungeonContext.js`). FISH-TIRED keeps the net's angler off the last quarter of the bar; the death itself stood
for every swimmer, and for a Lamia's fatigue rider.

**The fix** (`systems/rest/rest.js` exhaustionOutcome, the three hosts): in the water a drain to nothing is `drown` - a
tenth of the health pool (`EXHAUSTED_SWIM_SHARE`, never nothing), and "You are too exhausted to swim - get out of the
water!" on the HUD, with no box. The ticker drains to nothing once a game minute while the swimmer stays in the water,
so MEASURED on the real ticker: from full health a drain at 5, 10 ... 50 real seconds, dead at 50 - where it was dead at
the first. At the shore the collapse is the rest hour it always was, and on dry feet foes about still kill. Come Sail
Away hears no death of a swimmer still swimming (its OnPlayerDeath rides the collapse's two arms). The interior host
passes no swimmer and is unchanged. `test/systems/fb0930b_swimspent.test.js` (3), red on the code before; `rest`'s water case
and `csa_close`'s CSA-J dungeon pin re-aimed (PIN MOVED), `fishtired`'s stand-in for world.js given the drown arm.

## TOOL-SAID, then TOOL-USE: a profession tool is the profession's (2)

**Reproduced first** (the real `installForaging`, `useItem`, `hotbarPress` -> `useQuickslot` and an open `profBook`,
`?online=1`): Foraging is on online by default (MO1; `'foraging'` is in `ONLINE_PLAYERS_OWN_MODS`, never forced) and all
six tools offer Use. The pack's Wood-Axe says "You were able to chop and gather three Wood Bundles!", three Wood
Bundles land in the misc tab (UselessItems2), ChopWoodQuest starts and the axe wears to 49; the Sickle and the Pick-Axe
say nothing at all (a quest and its wait page, "Forage for Plants...", "Mine for Gems or Elements..."); the Fishing-Net
catches two Raw Fish into the pack - C&C's item, the Stores' haul material's name. The hotbar's axe is the same use.
Harvests asked of the service: none. Stores: empty. Logging XP: 0.

**Why.** FORAGE0 law 4, Mac's: "A Foraging tool used from the inventory is Foraging, both lanes ... Neither gesture
changes the other". The professions gather only at their nodes (E at an herb patch, a tree, a vein or a boulder, a body,
the water with a net - PROF0 law 5: every harvest an act the player plays), and nothing the player saw said so: the Use
never said what it was, the Professions page said how to gather for Hunting and Fishing alone, and the empty Stores
said "What you gather online is kept here" beside a pack filling with lumber. Skinning "works" because the Skinning
Knife has no Use: a body is its only gesture. The same misreading is 30's CHOP-WAIT ("the woodcutting animation") and
29h's report 2 (the pack's Pick-Axe beside a vein, For Mac 1).

**The first fix** (TOOL-SAID, `systems/foraging/foragingInstall.js`, `ui/professions/profPages.js`, `scenes/world.js` `setForagingHost`),
kept to laws 1 and 4: online, while the professions are the account's, a Use of the Wood-Axe, the Pick-Axe, the Sickle,
the Basket or the Fishing-Net says after the mod's own words - in the same box, which the hotbar says too - that it earns
no XP and where the profession is done, naming the node and the bound key ("No Logging XP from this. Logging is done at
a tree in the wilderness: walk up to one until the prompt shows, then press E. Only some trees can be felled each
day."); a refused Use says it after the refusal ("You cannot mine in here!"). With Foraging switched off online the Use
is still offered and says the line alone (law 6's exception: the tools are the professions'). The mod's yields, lines
and quests are kept (law 1); offline and a guest's lane are the mod's 1:1; the Spade stays Foraging's alone. The
Professions page says how Herbalism, Mining and Logging gather (`GATHER_HOW`), and the empty Stores where their goods
come from (`STORES_EMPTY_LINE`).

**The fix** (TOOL-USE - Mac, on TOOL-SAID: *"I dont care about DFU. We're our own thing now"*; laws 1 and 4 give way
online): while the professions are the account's, the Wood-Axe, the Pick-Axe, the Sickle, the Basket and the
Fishing-Net are the professions'. Their Use from the hotbar or a quick slot at a node of their own kind is E there
(`scenes/gatherHost.js` `useTool`: each kind declares its `tools`, the target is the tool's kinds' alone under E's own
cone and reach) - the Wood-Axe fells the tree, the Pick-Axe works the vein or the boulder (and a dungeon vein), the
Sickle picks the patch's herbs and the Basket searches it for food (`herbHost.js` `patchPlan`'s `only`: a tool asks
its own harvest whatever the choice key picked, and never starts the other's), the Fishing-Net casts; or the node's
need is said at once. Anywhere else, and from the open pack (its window holds the world off), the Use gives none of
Foraging's yields, quests or wear: it says where the profession is done ("Logging is done at a tree in the
wilderness: walk up to one until the prompt shows, then press E (or use the Wood-Axe)."). Foraging's own refusal
("You cannot mine in here!") is no longer said there. Offline and a guest's lane are the mod's 1:1; the Spade stays
Foraging's alone. The Sickle's Use holds the steady hand itself (no E held: Escape or walking off ends it), and the
net's Use is a tap - the shortest throw, E taking the tug. `test/systems/fb0930b_toolsaid.test.js` (10), over the real
`useItem`, `hotbarPress` and `createGatherHost` with its four kinds; red on the code before.

**Found on the way, left open.** A tree node draws no picture of its own (`treeHost.js` `flatsOf: () => []`): 6 nodes
among 1,664-4,376 tree flats a pixel (MEASURED on `layoutNature` over a grass Woodlands pixel), and E at a tree that is
no node says nothing. For Mac 2.

## BANK-REGION: the curse took nothing; the teller names its region (3)

**Reproduced first** - and the curse cleared: the werewolf turn walked on the real tick, offline and online over
LIVED1's two clocks (the bite, the dream, the turn, the beast and back, a realm save through JSON and `restorePlayer`),
leaves every account where it stood - a 5,000 loan and a second region's deposit with them - and the Fighters Guild at
rank 4, the hall showing no Join; a rank review forty days on changes nothing. Then the bank: 12,345 deposited in
Daggerfall, and the door in Wayrest says "The Bank of the Empire", the Enhanced Plus teller "Bank of the Empire /
Wayrest", "Account balance 0".

**Why.** DFU keeps one account a region (`systems/banking.js`, THE STORE IS PER REGION), and online every bank is the
Empire's (EMPIRE-BANK: the door, the teller's title) and the Empire one lender (a loan a character; a default collected
from every region's account) - so nothing said the account was the region's, and a player in another region read their
gold gone. The one list of every region's account (CreateBankingStatusBox) opens only from the classic sheet's gold
button. The guild half cannot be the curse: a member sees Join again only as a vampire (DFU's own swap to an empty guild
book, `guilds.js` activeMemberships - a cure gives the rank back) or expelled at a monthly review after a probation
notice (`guilds.js`); nothing in the lycanthropy code touches either.

**The fix** (`ui/enhanced/enhancedPorts.js`): the teller's row reads "Account in <region>", and each other region holding gold
stands beneath it ("Banked in Daggerfall 12,345"), in both lanes; the classic parchment is DFU's and unchanged.
`test/systems/fb0930b_bankregion.test.js` (2): the report red on the code before, and the curse's walk a guard.

**For Guppy** (#support): becoming a werewolf doesn't touch the bank or the guilds; each region keeps its own account,
so the gold is in the region it was deposited in (the classic sheet's gold button lists every one). If the Fighters
Guild still shows Join, a screenshot, and whether the bite was a vampire's.

## FALL-HOLD: a foe over a pixel not built is held, not stepped (4)

**Reproduced first** (the real EnemyAI, Collider and exterior pool, a load over pixels not built): a World of Daggerfall
camp's foe the save kept falls from the load's first frame and never stops - at -576 km after four minutes - and the
pool's cost climbs with it: 12 capsule resolves a frame at 1 s, 577 averaged over 30-60 s, 2,513 at 240 s (0.04 to 4.5
ms a frame, one foe, in node). Saved and loaded again, the foe starts from rest and the cost from 12 - the report's
"resets after saving\loading".

**Why.** World of Daggerfall's camp foes are spawned `placed` (standWodAction): never culled (exteriorFoes.js), and
they outlive their pixel - its teardown frees corpses; only Privateer's Hold's foes go with their block. The save keeps
every live foe where it stands and the load re-mints it there, but the load's teleport waits only for the arrival's
pixel: a camp the player rode away from has no ground built. `heightAt` answers -Infinity off a built pixel, so the
collider has no floor, the restored motor no rest latch, and gravity takes it. Nothing in EnemyAI bounds a fall (DFU's
ApplyGravity has no safeguard either - its loose objects never outlive their terrain), and each fixed step costs more:
`collider.move` sweeps in 0.2625 m pieces, 256 at most (DFU's CharacterController.Move is one sweep), ten capsule and
ninety sphere resolves a piece - 770 capsule resolves a frame at a minute's fall, 2,560 from 201.6 s; at 20 fps
FOE-CATCHUP's three steps make 7,656. The watch is saved and restored the same way, with no distance cull at all.

**The fix** (`characters/enemy/enemyMotor.js` `holdFrame`, `scenes/exteriorFoes.js`, `scenes/cityGuards.js`,
`scenes/world.js`): the streaming host's two pools take `groundStands(x, z)` - `heightAt` finite - and a foe whose
column has no built ground is held, not stepped: PlayerMotor.holdFrame's law (the host holds the player the same way,
`_seasonHoldKey`), foe-side. A held foe costs no collider work and drops the senses it latched (`detected` spared it
the cull and held the encounter cap; `inSight` kept its swings; either, or `wouldBeSpawned`, refused the player's
rest); the pixel's build stands it back on its floor, no fall billed. The column alone is asked, never the height: a
flyer, a levitator or a swimmer over built ground, and a Deep Waters swimmer (a carved cell answers its seafloor), step
as before; the interior host and the one-location host hand no law and hold nothing. A quickload's attacker across a
pixel edge still building is kept, where it used to fall and be culled. `test/scenes/fb0930b_fallhold.test.js` (8), seven red
on the code before; `foecatchup`'s two step records re-aimed by content.

## RES-RING, RES-MARK, HOME-PLAQUE: a quest's residence, found (5)

**Reproduced first** (`test/systems/fb0930b_questresidence.test.js`: the real QuestMachine with `Place _house_ local house2` in
a crafted town, the real TopicTree fed by the machine's hooks, AnswerPipeline and the talk macros, discovery.js,
`stampResidenceQuestNames` and the Enhanced town sheet): a townsperson's "Let me just mark The T'erdta Residence here on
your map" leaves the Place's hint flag at LocationWasMarkedOnMap and the house discovered under the quest's name - and
the town sheet draws it as any house (`quest: false`) with no ring. At a 0.9 roll the same question answers "north of
here". Online, a click at any other house in Grab or Talk opens "This house can be your home. It costs 4000 gold ...
Buy it?".

**Why - three faults.**
- RES-RING (the port's): every quest house the player learns of is override-named at its discovery (AUDIT 63 F49,
  `discovery.js`), and `stampResidenceQuestNames` stamped `questName` only on the other arm (ExteriorAutomap.cs's
  ladder, :676-682, which the classic plate keeps) - so the Enhanced sheet's ring and quest pen, which read
  `questName`, never drew a marked residence. EM4's ring pins set `questName` by hand on a record the game does not make.
- RES-MARK (DFU's own): TalkManager's hint marks the map on a roll of 0.35 or under, outdoors
  (:1707-1723); MEASURED over 20,000 seeded questions, a street commoner who knows a local building marks it 26 times in
  100, gives "north of here" 49 times and does not know 25 - and a residence has no sign on its door.
- HOME-PLAQUE (the port's): a private house has no name (DFU's BuildingNames names none), a nameless door draws no
  plaque (`worldTooltips.js` `staticDoorName`), and HOME2's verbs ride the plaque: "Its door lists Buy it, Go in" held
  only for a building named "House for sale". At every other house the first click fell through to HOME-OFFER's box.
  The quest's own house was named ("To The T'erdta Residence"), never for sale (`homePurchasable`,
  `isActiveQuestBuilding`), and opened - among doors that all asked to be bought.

**The fix.** RES-RING (`ui/exteriorAutomapWindow.js`, `ui/town/townSheet.js`): the stamp says `questMarked` on either arm, and
the sheet's pen and ring read it; the classic plate's ladder is unchanged. RES-MARK (Port-Ledger A,
`systems/answerPipeline.js`): a quest's own building (its row a quest resource's) is marked by one who knows, outdoors,
whatever the roll; every other building keeps DFU's roll, and indoors never marks. HOME-PLAQUE (`systems/online/onlineHomes.js`
`homeDoorName`, `scenes/worldModes.js`): a nameless house whose door has verbs to list is named with DFU's own word,
"Residence" (Internal_Strings 50): its plaque stands, "Go in" lit, and the click goes in; the quest's residence reads
apart by its name. `test/systems/fb0930b_questresidence.test.js` (3), red on the code before; `answerpipeline`'s quest-person
hint at 0.9 re-aimed to the map (PIN MOVED), `home2`, `home1` and `empirebank`'s door-name source pins re-aimed.

**Left as they are.** A quest person's generated home (`_contact_home_`) is a second quest "Residence" under General
(DFU's `Person.AssignHomeTown`). With World Tooltips off, or on a phone, a house still asks HOME-OFFER's question once a
session (Mac's HOME-OFFER). `questSiteHere` asks the quests of the town the player stands in while the offer uses the
door's own town - a quest house in a neighbouring town could be offered; read, not reproduced (For Mac).

## TV-SURF: Come Sail Away's breakers wait for the traveller's eye (6)

**Reproduced first** (the port's own passes - the Deep Waters floor and top, the Come Sail Away wave renderer with the
author's shipped paints - over a synthetic diagonal coast, rendered from 400 m at 45 degrees): pixel-aligned light-blue
dithered sheets with straight edges over the sea, the screenshot's; the same frame without the waves is a sea that
follows the coast. The screenshot's sheet is a checker at one screen pixel over the plain sea - the 29 sea #4 Bayer
discard at half coverage - its lit colour the material's tint (0.5, 0.75, 1) over near-white.

**Why.** CSA-F's breakers, ported 1:1: from each water pixel (WOODS height 2 or less, no quarter-point ray over 1 m
above the sea) a flat fan toward every land neighbour, a quarter-pixel inside the water out to the land pixel's centre
(some 614 m), 0.1 m over the sea, within Waves.Distance (2) pixels of the player. From a ground eye - DFU has no other -
it is seen edge-on, surf. Where a "land" pixel is mostly water (a bay, a coast through the pixel) the strip lies on
open water and stops in a straight line at the land pixel's centre line; MEASURED on a diagonal coast, some 70% of its
visible area lies over water more than 150 m from the shore. The travel view (TV1) is the port's own raised eye, and
its list of ground-eye passes to adapt (fog, clouds, rain, shadows, grass, billboards, the far ring) missed the waves:
`csaDrawWaves()` ran on every exterior frame.

**The fix** (`scenes/world.js`): `if (!tvf) csaDrawWaves();` - the travel view's own gate, the grass's. Only the
drawing: the waves' state (the currents, the helm's neighbours) is untouched. `test/scenes/fb0930b_tvsurf.test.js` (2);
`fbsea_water`'s order pin re-aimed at the gated line (PIN MOVED).

## For Mac (part two)

1. **The trees.** A tree node draws no picture of its own and stands 6 among 1,664-4,376 tree flats a pixel; E (or the
   Wood-Axe) at a tree that is no node says nothing, and the Logging notes say "look at a tree and press E". A node's
   own mark, or a line at a tree that is none, is a design call.
2. **TOOL-USE's two feels.** The Sickle's Use holds the steady hand without E (letting go ends nothing; Escape, walking
   off or a bruise does), and the Fishing-Net's Use throws the shortest cast (3 m) where a held E winds it farther - a
   default wind is one line.
3. **Offline.** Offline, the tools are still Foraging's 1:1 (there are no professions offline); "our own thing" may
   reach there too.
4. **A sinking angler at sea.** Between the afloat line (62.5 kg carried, whatever the STR) and the net's encumbrance
   check (75 kg at STR 50) the net casts while its angler sinks, with its line and some 30 s of breath; a trophy (1 in
   200 hauls) can push a pack over it. A trophy that would sink its swimmer could go to the Stores instead.
5. **Exhaustion with foes about** on dry feet is still DFU's death, whatever the health - no report named it, but it is
   the same shape SWIM-SPENT ended in the water.
6. **A quest house in a neighbouring town.** `questSiteHere` asks the quests of the town the player stands in while the
   home offer uses the door's own town (`homeTownOf`), so a quest house across a town line could be offered for sale -
   read, not reproduced.
7. **ItMustBeMonday (7)**: what the fight at sea was, if it was not what you answered in the thread.
