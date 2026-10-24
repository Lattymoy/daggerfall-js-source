# FIELD BUGS 2026-10-04e - the controller's bindings and its hotbar; the arena's quiver, its ghosts, its teams and its cellars; the Overworld's filters, carriages, names and seats; the road's encounters; the rider's facing

The Discord's #feature-feedback threads of 2026-10-03 and 04, handed over as screenshots, with two of the owner's own:
*"We need a hover tooltips for capturable cities/towns that show occupation"* and *"When on the horse in the overworld,
the sprite doesnt face the direction of travel"*. Each change below is pinned by tests that fail on the code before it,
and its pins are mutation-checked (`tools/mutants/fb1004e.json`). Nothing here was seen in a browser: this container has
no ARENA2, so every claim is the suites' and the mounted host slices'.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Sir Timbers: "Overworld and Quick Dial are missing from the controller binding options" | the Controller bindings window draws its own rows and its own d-pad list - neither held them - and the Overworld has no key, so a d-pad choice of it pressed nothing | PAD-BINDS |
| 1 | "rearranging the hot bar icons on controller is not possible ... when adding a spell/item/etc to your hotbar it could prompt you by asking what hotbar button to apply to" | under Plus the bar tucks beneath a window and rises only for a drag; a pad cannot start one on a node it cannot reach; "Add to hotbar" took the first free slot | PAD-ARRANGE |
| 2 | Draugr: "Arrows are not refunded, which causes problems" | the healers put back health, fatigue and magicka; an arrow lodged in a bout fighter (no corpse, taken at the verdict) or a remote body was gone | ARENA-ARROWS |
| 2 | "The ghosts outside are bothersome (I know they're story related)" | the Curse of Daggerfall (S0000977) stands a wraith and a ghost round the player from 19:00 to 05:00 - at the gate, in the stands, in the instance and the undercroft | CURSE-OFF-SAND |
| 2 | "The multiple npc arena fights will target each other despite being on the same team" | the bout gate keeps a teammate out of every target; an area spell's blast hit every body in it, partner included - and a Grand Melee (every fighter its own side) stood under one "vs" | ARENA-TEAMS |
| 2 | "The dungeon under the arena is also completely missing enemies" | ARENA-FIX 4 made the undercroft a hall and left all 328 of its other markers empty | UNDERCROFT-DEEP |
| 3 | Chilloutman: "Add a distance filter so players can decide how many km away they hide nodes" | the gathering groups had one switch and no reach | OW-NODE-KM |
| 3 | "Highlight fast travel hubs (cities with carriages)"; ItMustBeMonday: "WHEEL icon for carriage places" | no map said which towns stand a carriage driver | OW-HUBS |
| 3 | "Change name colors of players in your guild or friend list" | the names knew only the party | OW-KIN |
| 3 | "More filters for players in general (filter by guild, friend, level etc), both in Overworld map and travel map" | one Travellers switch on the Overworld, none on the travel map | OW-WHO |
| 4 | Private Joker: "having to completely halt my travel because 1 rat chose today to die ... the random hunting y/n prompts that stop you completely ... let it be for something important or dangerous. a roving orc patrol, a bandit holdup" | DFU's wanderer keeps its table's bottom in reach at every level, and a journey stops for every one (AUDIT OW5b E1); TO-FIELD3 rolled the hunt on the road | WILD-ROAD (the hunt's prompts: HUNT-OUT, below) |
| 5 | the owner: "hover tooltips for capturable cities/towns that show occupation" | the held map rings a seat but answers its hover with the town's name; the Overworld had no card at all; the held map's I box said "unheld" whoever held it | SEAT-TIP |
| 6 | the owner: "When on the horse in the overworld, the sprite doesnt face the direction of travel" | ARENA-FIX 14's placing (feet past PLACE_JUMP_M in a frame) fired every frame of a gallop under the time scale, and its -1 orientation was painted by the walk loop as orientation 7 | HORSE-FACE |

## PAD-BINDS (1)

`ui/plus/plusPadBinds.js` (PLUS_BIND_ROWS: `quickdial` on QuickDial, `overworld` on TravelView - both start unbound, the
row's own Bind and Unbind as every other's), `ui/plus/plusPad.js` (DPAD_CHOICES: Quick dial and Overworld for any
direction's tap or hold), `ui/gamepadInput.js` (plusFrame's `fireDpad`: an action on no key at all is the host's own
door, `hooks.padAction` - TravelView ships unbound, TV1's own pin, so a synthetic press of nothing reached nothing),
`scenes/world.js` (`travelViewKey`, the one TravelView toggle the key's arm and the pad's `padAction` both call - the
key's arm keeps its repeat guard and its place above the mode gate). Quick dial on the d-pad presses its own Tab. A
button bound to either in the window works as any secondary binding does; under the window it opens, B closes it (the
view's Escape, the dial's own). The d-pad's tap and hold choices are the crossbar's (PADPLUS10's own law: they fire
while the crossbar is in force; with it off the d-pad is the hotbar's four), and `padAction` answers the Overworld alone
- any other action on no key still presses nothing. A row with no button that takes one another row holds leaves that
row UNBOUND (it has nothing to give back), and the window now says so ("Bound. Jump is unbound now.") where it said the
other row "took the old button". THE FOUR HOSTS: the Overworld is world.js's alone (TV1's pin); the dial's door is
`ui/input.js` routeKeyAction in every host, unchanged. `test/ui/plus/fb1004e_padarrange.test.js` (the rows and their binds, the
cleared row said; the d-pad's tap and hold - the dial's Tab, the Overworld's door, once each).

## PAD-ARRANGE (1)

`ui/enhanced/enhancedHotbar.js` (`hand`, `arranging`, raiseSync, takeHotbarHand, placeHotbarHand, toggleHotbarArrange,
PAD_ARRANGE_TEXT; the crossbar API's canArrange, arranging, arrange, holding, crossbar and place), `ui/gamepadInput.js`
(plusFrame's window branch; `hotbarPrompt`), `ui/plus/plusPad.js` (HOTBAR_ARRANGE_CODE, windowPrompts' `hotbar`). With the
pad the live device and a window up:
- **LT raises the bar** to be arranged, and again lowers it. LT is the world's (Interact) and stood down under a window,
  so in one it was nothing. The prompt bar names it ("Arrange hotbar" / "Hotbar done").
- **A on a filled slot takes it in hand** (its frame lifted and lit); A on another slot puts it there - a swap, or a
  move onto an empty one; A on the same slot puts it back. Y clears a slot, the right-click it always was, and clearing
  the slot in hand empties the hand. The hand is put down on the press's CLICK, never on its pointerdown: put down on
  the press, the bar tucked under the cursor before the release, and the release and its click landed on whatever the
  bar had covered (a loot row taken, an item card shut). Only the click of a press that began on that slot puts it
  down.
- **"Add to hotbar" asks**: the item card's and the spellbook's press puts the new entry in hand and raises the bar
  ("Choose a hotbar slot for ..."), instead of taking the first free slot. A on a slot places it - or, on the crossbar,
  a bumper held and the slot's own button (the player's "what hotbar button to apply to"): the bumpers are the bar's
  while something is in hand, never the tabs', and the button that placed is the bar's until it is let go, so the A
  under LB never also clicks at the cursor.
- The last window closing lets go of the hand and lowers the bar, and so does the mouse or the keyboard taking the hands
  back (the bar would stand raised over the pack's foot with nothing able to lower it). The mouse and the finger are
  unchanged - they drag.
- **X under LB/RB is the slot's**: the bumper's placing takes X as it takes A, so LB + X places and never also wears
  the item under the cursor (PADPLUS5's quick act).
- **On the row of ten** (the crossbar off) there is no slot button to place with, so the bumpers stay the tabs' with
  something in hand; the prompt bar keeps "Tabs" there.
- The hints name no button (the prompt bar draws each in the live pad's own glyph).

All sixteen crossbar slots are reached so, where the keyboard's row of ten never could reach the six past it.
Not built: a pad's own cursor-less slot picker (the cursor and the d-pad jumps reach the risen bar). Pins:
`test/ui/plus/fb1004e_padarrange.test.js` (the prompts; the poller over a pack window's two tabs - LT, LB + A placing slot 7
with no click, a fresh A a click again, LB + X placing and never quick-acting, the bumpers turning no tab in hand on the
crossbar and turning them with nothing in hand and on the row of ten; the bar on a fake page - the pad's Add in hand and
put down on the click on crossbar slot 12 (the press alone puts nothing down), the mouse's Add on the first free slot as
before, the tucked bar risen and lowered, A's pick and swap, a click on another slot than the press's putting nothing
down, Y on the slot in hand, the crossbar API's place, the hand let go with the window and with the mouse).

## ARENA-ARROWS (2)

`systems/arena/arenaQuiver.js` (new: QUIVER_TEMPLATES, markQuiver, refundQuiver), `systems/shotTally.js` (new, a leaf: the
shots a bout loosed), `systems/inventory.js` (spendAmmoFor notes a real round's shot), `combat/arrowFlight.js`
(playerArrowHitFoe notes a shaft lodged where it can be looted), `scenes/arena/arenaBouts.js` (`markMine` where a bout sets
my bout tag - a ladder or practice bout and a relay's; `refundMine` with that bout's healers; `refundQuiver` on the
driver's face), `scenes/world.js` (a private session's bout let go before its healers - `letGoPriv`'s heal - pays
too), `systems/arena/arenaText.js` (`ammoBack`). The quiver is counted as I step into a bout: every ammunition inventory.js
spendAmmoFor spends (an Arrow, a Dwemer Pellet), real stacks only - a conjured arrow is spent first and vanishes
anyway, a quest's is never loosed - and the bout's shot tally starts. The healers hand back THE FEWER of what is
missing and what the bout LOOSED: the tally counts each real round spent from my pack, less each shaft lodged in a foe
whose pack can be looted (a bout fighter's pack goes with it at the verdict and a relay opponent's stand-in is no
corpse, so a shaft in either is lost and paid). An arrow dropped, sold or given away on the sand is no shot - before
the tally a dropped stack came back with the healers while it still lay where it fell. Handed back as inventory.js
addItem stacks it (onto the kind's stack, or a new one off the first stack's copy when it was spent to nothing), and
said ("The keepers hand back the 5 shots you loosed."). Never more than went in. The quiver is the bout's: its own heal
pays it once; a bout dismissed before its heal stops its tally and keeps the quiver for the one pay still possible - a
session's let-go, which dismisses the bout and then heals - until another bout is dismissed or marked, so a shot taken
after the bout went (in the wild) is never paid. THE FOUR HOSTS: the driver is world.js's and exterior.js's (both hand
it the same deps); every host spends through the one spendAmmoFor and lands its shafts through the one
playerArrowHitFoe (world.js, exterior.js, worldModes.js, dungeonContext.js), so the tally is the same wherever the bout
stands. A departure (Ledger A, ARENA-ARROWS). Pins: `test/systems/arena/fb1004e_arena.test.js` (the law - the drop never handed
back, no tally no pay; the tally - conjured and other packs' rounds uncounted, a lootable lodge uncounted, a bout
fighter's and a relay stand-in's counted; a ladder bout driven - seven spent, two conjured, two dropped, the five loosed
handed back and said, paid once; a bout dismissed before its heal - the let-go pays the three it loosed, not the four
after).

## CURSE-OFF-SAND (2)

`systems/arena/arenaGround.js` (new: ARENA_GROUND_QUESTS, ARENA_GROUND_M, keptOffArenaGround), asked at CreateFoe's spawn
event (`systems/quest/actions.js`: `world.foeKeptOff`, beside the hidden Foe's own return) - `scenes/world.js`'s and
`scenes/exterior.js`'s quest world answer it (outdoors: the colosseum's sand within ARENA_GROUND_M - the hosts' own
ARENA_NEAR_M, 150 m; inside, the mode machine's answer) and `scenes/worldModes.js` questFoeKeptOff answers for the
floor's instance and the undercroft (isArenaFloor / isArenaUndercroft). A curse wave there PASSES as a hidden Foe's
does: the interval spent, no wave made, nothing pending - so the curse is not lifted, its next interval's wave comes
once the player is off the grounds (and its vengeance sound with it). The first draft refused at PLACEMENT
(TryPlacement's `false`), which leaves a wave pending - and every tick a wave is pending CreateFoe raises the encounter
event, which broke a rest on the grounds every machine tick and shut Travel Options' window: the refusal moved to the
spawn event for that. A wave already pending as the player steps onto the grounds still stands (it places in a tick).
Only the curse: any other quest's foes are placed as DFU places them. THE FOUR HOSTS: world.js and exterior.js mount
the seam; worldModes.js answers for its dungeon arm; dungeonContext.js stands what worldModes.js places
(spawnQuestFoe) - nothing to wire. Recorded: online a world quest's waves are the world's (questFoeHost.js
WORLD_QUESTS), and their leash to the grounds is this client's alone - a partner off the grounds is not kept off by
mine. A departure (Ledger A, CURSE-OFF-SAND). Pins: `test/systems/arena/fb1004e_arena.test.js` (the law; a CreateFoe driven through
the machine - twelve hours on the grounds make no wave and raise no encounter event, then off them the next interval's
wave stands; the hosts' seams, and no refusal left at placement).

## ARENA-TEAMS (2)

The bout gate (characters/enemy/enemyTargets.js boutGate) was sound: a fighter never takes a teammate for a target. Two things
read as infighting. **A teammate's blast**: an area spell's burst (scenes/hostMagic.js explodeAt) met every body in it,
the caster's partner too - the two-against-one bouts (Knight + Healer, Warrior + Mage) are where an AI casts one. Now
`combat/friendlyFire.js` boutTeammates (one bout, one side) and the blast passes a teammate by; the dungeon's foe
missiles (the floor's instance is a dungeon level) carry their foe as hostMagic's own already did (`scenes/dungeonContext.js`
wCaster, fCaster, mCaster), so the blast can ask whose it is. **The Grand Melee's look**: every fighter its own side by
design ("Every fighter for themselves!"), but the HUD stood the rest in one column under "vs". `ui/arena/arenaHud.js` calls a
bout where every fighter is a side of its own "each alone" (`ARENA_TEXT.hud.eachAlone`); a team bout keeps "vs". Not
changed: the melee stays a melee - giving its fighters one side against the player is a design call, recorded for the
owner. THE FOUR HOSTS: every blast is hostMagic.js's explodeAt - world.js's, exterior.js's and dungeonContext.js's own
createPlayerMagic, and worldModes.js's interiors through the host's (`magicHooks.explodeAt`) - and dungeonContext.js's
foe missiles reach it carrying their foe, so every host asks boutTeammates. A
departure (Ledger A, ARENA-TEAMS). Pins: `test/systems/arena/fb1004e_arena.test.js`.

## UNDERCROFT-DEEP (2)

`world/arena/arenaUndercroft.js` (UNDERCROFT_DEEP_M, `deep`, `near`, deepFoesOf, undercroftHallNear), `scenes/dungeonContext.js`
(the chained beasts and the deep cellars' own foes; the rest gate). ARENA-FIX 4 made the undercroft the fighters' hall
and left every other marker empty - "the deep cellars are quiet". Now the hall is kept and, a whole RDB block (51.2 m)
from the stair and from every place the hall took, the layout's own random foe stands again at its marker - the
HumanStronghold's table the keep was laid with (collectDungeonEnemies, unchanged; only its foes at those markers stand).
A rest within the hall's reach is never broken; out in the deep it is a keep's. No champion is marked there (ARENA-FIX
4's line kept). Recorded: a deep marker the layout left without a foe stays empty (the table's own roll), and online a
deep foe may stand as an elite as any keep's does (the rank roll is the dungeon's, unchanged). ARENA-FIX 4's record in
`11-Multiplayer/Arena.md` is superseded in place. Pins:
`test/systems/arena/fb1004e_arena.test.js` (the law over a 240 m cellar; the small rig's undercroft - all of it the hall's reach -
stands nothing), `test/systems/arena/arena_fix.test.js` (PIN MOVED: the population line and the rest gate).

## OW-NODE-KM, OW-WHO, OW-KIN (3)

`systems/travel/travelViewFilters.js` (the WHO: TV_WHO_GROUPS, TV_RENOWN_STEPS, TV_NODE_KM_STEPS, travelViewWho,
toggleTravelViewWho, cycleTravelViewRenown, cycleTravelViewNodeKm, travellerKin, playerShown, TV_KIN_COLORS,
TV_KIN_LEGEND; markShown reads it), kept on the device under its own key beside the switches and read by both maps.
- **The node reach** - "Nodes: any / 0.5 / 1 / 2 km", a press for the next: a gathering group farther than it is not
  drawn (`scenes/gatherHost.js` overworldGroups gives each group its `dist`, km). GATHER-OW's groups reach 3 km.
- **The players** - Friends, Guild, Others, and the least Renown ("Any renown", 5+, 10+, 20+, 40+; Renown is online's
  level, the number boxed beside a name). A player shows while Travellers is on, their kin's switch is on and their
  Renown reaches the floor. My party is never filtered.
- **The names' colours** - a friend's in the friends' blue (net/social.js FRIEND_CSS, the chat's own), a guild-mate's
  (their tag my guild's) in violet; my party's green stays the party's.
On the Overworld (`ui/travel/travelViewHud.js`): a "Players" block under the switches (on a touch screen the switches scroll
within their section - the block stands from the top there, and a phone held landscape ran it off the foot); the
badge's name and a bare label in the kin's colour (the sprite keyed by it). On the travel map (`ui/heldMap.js`,
`ui/partyMapMarks.js`): the region's travellers carry their kin and Renown (`scenes/world.js`'s `travellers` dep), are
filtered by the same Players switches, drawn in the kin's colour; the legend names the travellers and each kin's colour
only while one is drawn (a press re-says it), and the key gains a Players row while travellers are in the book (its word
never hidden on a phone - the key's grid would shift a column).
`scenes/travelView.js` carries every new field through to the readout (the drop AUDIT NAMES N2-1 found once). Pins:
`test/ui/fb1004e_overworld.test.js`; PIN MOVED: `tv3_travellers`, `tv5_far_places`, `ows1_ships`.

## OW-HUBS (3)

`world/immersiveTravelGates.js` hasCarriageGate (one of the town's blocks a gate Immersive Travel edits, IT_GATE_FILE's
own law - a Beautiful Cities composite on one too), `ui/carriageWheel.js` (new: the wheel's one path), `scenes/world.js`
(`carriageTown`: by map id, while the mod is loaded - online always - kept per id until the location index moves).
The Overworld draws a carriage town's dot as a brass wheel and edges its plate in brass; the travel map draws the wheel
LEFT of the town's mark (the anchor stands right), clear of all its ink - the glyph, a hub's circle and a seat's ring
(markReach) - at every band, in the anchor's pens (`ui/ink/inkMap.js` carriageWheelAt, paintCarriageWheel). The names keep
off it (placeNames seeds its ground with the glyphs', and a carriage town's own name set to the left goes past it).
Pins: `test/ui/fb1004e_overworld.test.js`.

## SEAT-TIP (5)

`net/townSeatLaw.js` seatTipOf - a dressed seat's card (`{ title, lines }`, the EVENT-TIP card): the town; its Charter
and who holds it; how long and how firmly (seatHolderLine); the holder's rule (seatRuleLine); this week's battle and a
called siege. The travel map's hover over a seat answers with it (`ui/heldMap.js` `_hoverLabel`'s place branch); the
Overworld's plate under the pointer shows the same card (`ui/travel/travelViewHud.js` showMarkTip, the held map's `.hmtip`
look) - a seat town's mark carries a function that makes it while the seats are open (~~`scenes/world.js` seatTipAt~~ -
TOWN-ECON, 2026-10-16: `systems/town/townEcon.js` tipFnAt, every town's card with a seat's lines in it; one kept a town),
asked only of the plate under the pointer; the card is measured once (a layout read each frame forced
one) and moved only when it moves; over the block's own controls no plate is lit and no card shown. A seat's lines are
whole sentences that name two guilds, so they are bounded at SEAT_TIP_TEXT_MAX (160, `ui/eventMapMarks.js` readTip's
`textMax`) where every other card keeps TIP_TEXT_MAX's 80 - the card wraps them in its 320 px. And the travel map's I
box named a held seat "unheld" - `seatInfoLine(seat)` was asked with no holder; it names it now. Online alone, as the
seats are. Recorded: a touch screen has no hover, so the Overworld shows it no card (a press on a plate is the plate's
own pick, travelViewHudPickAt) - the travel map's I box says the holder there. Pins: `test/ui/fb1004e_overworld.test.js`; PIN MOVED:
`seat1a_client`.

## WILD-ROAD (4)

`systems/roadEncounters.js` (new: trivialOnRoad, roadCompany, wandererCount), `scenes/world.js` runEncounterTick
(`onTheRoad` - a Travel Options journey under way, its window up and its autopilot steering (walkJourneying's own
test), or the Overworld up; never while resting - a rest's minutes are a camp's, and its wanderer wakes the sleeper as
DFU's does), `systems/features.js` ('road-encounters', the World group). ON THE ROAD, with
Encounters on the road on (the default):
- a wanderer whose own level is a third of the traveller's or less is passed by - a Rat from level 3 ("A level 1 ...
  can take care of the rat problems"), an Imp from 6, a Giant Bat from 9, an Orc from 15, a Giant from 30, a Lich from
  60; the minute passes, nothing stands, nothing stops, and the next minute rolls on. A class foe has no level of its
  own (it is built at the traveller's) and never is. A SOLITARY kind is solitary in company (never part of a camp,
  PSCALE1), not in danger - an Imp is level 2 - so it is passed by as any other;
- the rest bring company now and then - from level 5, a chance of level/50 (two in five at most) of a patrol of their
  own kind: one more, then one more each six levels past five, three at most, never past four with the party's own
  extras (PSCALE1's law). A solitary kind comes alone.
Off the road, or the switch off, DFU's wanderer as it was. Online the party's wanderer is its roller's (PSCALE1): the
road, the level and the switch asked are the roller's, and what it stands stands for the party. THE FOUR HOSTS: the
wanderer's roll is world.js's runEncounterTick, which the mode machine rings in every mode (AUDIT 62 F11); the road is
an outdoor journey's, so exterior.js, worldModes.js and dungeonContext.js have no road to ask. A departure (Ledger A,
WILD-ROAD).

THE HUNTING PROMPTS the report named are gone whole: main's HUNT-OUT (`06-Systems/Climates-Calories.md`, 2026-10-04,
"I want to remove the text based hunting minigame entirely") removed SURV6's text hunt - its roll, its Yes/No box and
`scenes/hunting.js` - while this slice stood. The slice's HUNT-ROAD (a World switch, Hunting while travelling, holding
that roll on the road) had nothing left to hold and was taken out at the merge of main: its feature row, its `held` door
and its pins. Not changed: the roaming bands (TV7/OW6) and the camps - they are groups already and the Wilderness camps
& packs switch is theirs. Pins: `test/systems/fb1004e_road.test.js` (the law - the imp, the giant, the lich, the class foe;
runEncounterTick's head mounted - the switch's row, the rat passed by on the road and met off it, the switch, a level
2's rat, the patrol, two minutes whose rat's minute passes and the orc's stands; `onTheRoad` mounted - the window up
with no journey, a journey, the Overworld, a rest); PIN MOVED: `auditpscale1` (the mount names the road's words),
`features`, `ft18_features`, `ft8_combatvisuals`.

## HORSE-FACE (6)

`player/eyeOfTheBeholder/eotbBody.js` (faceYaw's `forceOrient`; the placing gate; `rebase`), `player/mwView.js` (mwViewRebase). Eye Of
The Beholder's body faced a PLACING (ARENA-FIX 14: feet carried past PLACE_JUMP_M, 8 m, in one frame - a door, a warp)
the view's way, and asked the next UpdateOrientation for a repaint by writing -1 into `lastOrientation`. Every repaint
the walk loop queued meanwhile painted that -1, which stateFor wraps to orientation 7 - one front-three-quarter view.
A horse under the Overworld's time scale passes 8 m a frame (about x45 at 60 fps), so it was placed every frame and the
riding clock's sixteen repaints a second beat the orientation's ten. Now the placing asks its repaint with a flag of its
own and never touches `lastOrientation`; a body moving under its own input is never placed (its facing is the move's);
and the floating origin's shift moves the sprite's own feet (an 819 m recentre read as a placing too). Pins:
`test/player/eyeOfTheBeholder/fb1004e_horseface.test.js` (a gallop at three times PLACE_JUMP_M a frame shows the slow ride's view from behind,
both sides and ahead, never -1; a placing at rest still faces the view; a strafe's gallop keeps the move's facing; the
rebase, and mwViewRebase's call). `test/systems/arena/arena_fix.test.js`'s ARENA-FIX 14 pins hold.

## The gates

Lint, the types, the bible's gates and the changed files' suites run clean before the push; `tools/mutants/fb1004e.json`
(93 records, every one dead - its audit pass added the tally's, the seam's, the road's guards, the hand's click, the
legend's and the wheel's ground). Re-aimed BY CONTENT where this slice moved their text: `pscale1.json` and `auditpscale1.json` (the
wanderer's count, roadEncounters.js wandererCount), `fb0929d_mapkey.json` (the key's signature grew the players' row),
`hub1.json` (the I box names the holder), `ows1.json`, `tv3.json`, `tv5.json` (the marks' new fields) and `arenafix.json`
(the undercroft's rest gate).
