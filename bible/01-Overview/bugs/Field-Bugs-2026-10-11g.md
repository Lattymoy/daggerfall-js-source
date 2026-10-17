# FIELD BUGS 2026-10-11g - six Discord bug reports

Six threads from the Discord's #bug-reports, handed over as screenshots. All six are answered; five were defects in the
port and are fixed, and the sixth (6) fixed what the port said about it and leaves one check to staff.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Crash at card game" - "went all in and got this", a CRASH box: `TypeError: Cannot read properties of null (reading 'view')` in `arenaGate-*.js` under `world-*.js`'s frame (BioGud) | the relay stands a player up broke after the hand that took his last chip, and the interior frame drew the cloth through the table it had just let go | fixed (ALL-IN) |
| 2 | "Automap in dungeons not showing certain slopes" - "I believe there was an issue like this once before" (MD-Geist); "mostly not present without the use of the 'all' option" (Shabalako) | the 3D sheet's All cut called a face a climb under n.y 0.97, and Daggerfall's 1:4 ramp leans at n.y 0.97014 - every such ramp was cut at its lower storey | fixed (SLOPE-ALL) |
| 3 | "Doesn't register raid 20%ish of the time" - "I thought maybe it was because the raid would sometimes lead you way out of town, but i have had many raids end within town after 20 kills, and nothing pops up" (EvoAva) | two ways the town's ledger stood short while the raid looked over: deaths past the location's rect never said, and a jump's sweep leaving every raider "standing" under the cap; and the map's card counted this machine's share against a target the player never saw | fixed (RAID-WORD) |
| 4 | "Can't scroll loot pile / corpse" - "this problem appeared about 2 or 3 days ago. I can't scroll the item list with mouse wheel for some reason. I can still take items from list one by one to get to the bottom of it" (Boar) | the plaque drew six rows and counted the rest, and the wheel stopped at the sixth - by design since WORLD-HOVER; BAL4 (2026-10-10) brought an elite's grant, appended past the sixth row, to every game with the rarity tiers on | fixed (LOOT-SCROLL) |
| 5 | "Quest NPCs are inactive" - "I am faced with the problem of not being able to interact with the quest NPCs" (DOOM2004) | the click works and is DFU's; but World Tooltips' plaque named every person in the room except the quest's, so he stood looking unclickable | fixed (QUEST-NAME) |
| 6 | "Cant trade after yesterdays character lockout." - "It will just say something along the lines of: 'character under review'"; the goods stolen from shops; dropping them, relogging, /unstuck, re-stealing and trading gold or grey items all refused (Pokupo) | no road from stealing to a hold was found; the refusal said "a character in this trade" to both sides, and the realm checks only the sides that give | the refusal says whose and why (HELD-SIDE); staff's check below |

## ALL-IN: a broke player's cloth is drawn with no table under it (1)

The report's stack, mapped through a sourcemap of the same tree: `Object.ND [as frame]` is `scenes/worldModes.js`
frame's `if (cardGame?.scene) cardDrawGame(cardGame, proj, view, mwv.eye);` and the throw is
`worldModes.js:"const p = g.scene.poses(now / 1000, table?.view() ?? null,"` as it stood before this fix -
`(g.remote ?? g.session).view()`. At the relay's Hold'em table (CARDS5) a player who goes all in and loses is stood up
at the hand's end (`net/holdemTable.js` after(): `leave`, broke, the chair emptied). `systems/card/cardRemoteTable.js` reads
his id gone from the next state and loses the seat; `worldModes.js` cardRemoteFrame's `lost` branch sets `g.phase =
'over'` and lets the relay's table go (`g.remote = null`) but keeps the cloth, so the run-out's streets and the
showdown sent in that same frame can play out. The same frame then drew the cloth through `g.remote ?? g.session` -
and an online game has no session. Every lost reason but a refusal took that branch: "broke", "stood", and AUDIT
CARDS-6 E8's "other game". The offline table is untouched: its session survives a bust.

The draw reads no table as no view now - `CardScene.poses` already takes a null view (a remote table before its first
state) and draws the cards in flight with no stacks or bets. Dropping the cloth with the table was the other fix, and
it would have swept the hand that broke him off the felt the instant it was settled.

Pinned by `test/systems/auditcards6_e.test.js` (the eleventh: through the host's real card block over the relay's own table
law - seated, the broke `leave`, the frame's own draw site after it; and E8's refusal the same); `tools/mutants/fb1011g_allin.json`.

## SLOPE-ALL: Daggerfall's own ramp climbs under All (2)

The held map's 3D sheet (`ui/automap/automapSheet.js`, drawn by `ui/ink/inkDungeonGL.js`) has an All button: ALL-FLOORS cuts each
placed model at the slice of the storey it stands on, so every floor lies open, and spares a face that CLIMBS between
storeys - a ramp, a flight's tread - or a ramp would be cut at its foot. FS_A called a face a climb under a literal
`n.y < 0.97`, 14.07 degrees. Daggerfall's dungeon ramp is 1:4: 14.04 degrees, n.y 0.97014. So every such ramp failed
the test by three hundredths of a degree and was cut at its lower storey's slice plus the slice height; the rest of its
run vanished. On a single floor's view the slice is the player's feet, and standing on the upper floor the whole ramp
drew - the second reporter's "mostly not present without 'all'". Measured on the freeware ARENA2 by rebuilding the rows
as `scenes/dungeonContext.js` does: Ruins of Greenfield Grange (the report's dungeon) lost 353 m² of ramp under All -
model 61015, a 12.8 m ramp placed 17 times, the top ~41% of each; over it and the 25 dungeons of
`tools/climbDungeonProbe.mjs`, 4,627 m². None of that data is in the tree.

"An issue like this once before" is RAMP-INK (`Field-Bugs-2026-10-05c.md`): it moved the climb's LOWER bound to the
plan's floor law and left the upper one, and its pin read 30 to 65 degree ramps, never a gentle one. The bound is one
constant now, `ui/ink/inkDungeonGL.js` CLIMB_NY (0.999, 2.56 degrees - past the 1:4 ramp, short of a level floor's 0.9999),
and `climbsOf` states the shader's law in JS; FS_A reads it as a template constant beside FNY. Across the 26 dungeons
no ramp area is lost at 0.999 (0.995 still lost 23 m²). What it newly spares are small real slopes - an uneven cave
floor, a prop's top - which still stand under the global slice. Left as it was: a climbing row's side WALLS above its
lower storey's slice are still cut by the row's own storey - the ramp's floor draws whole, its upper walls do not.
Cutting a climbing row at its top storey would be a change to the sheet's design, not this fix.

Pinned by `test/ui/ink/fb1011g_slopeall.test.js` (2: FS_A's own climb expression read out of the source and run - the 1:4
ramp, 3 to 65 degrees, a level floor, a wall, a tread; the one constant and RAMP-INK's floor law untouched);
`tools/mutants/fb1011g_slopeall.json` (4).

## RAID-WORD: the deaths reach the ledger, the jump frees the raid's places (3)

At a raid relay (RAID3) the raid is the town's ledger: each player says their own deaths (`systems/raidingParties.js`
sayToRelay), the relay sums them, and its cleanse - the popup the report misses - comes when the sum reaches the day's
roll, a target of 15 to 25. Two roads left the sum short while the raid looked over on the player's screen:

- **Past the rect.** The word was said only from inside the location's rect (FindCurrentRaid's, `townHere`), while the
  relay credits a word from anywhere on the town's map PIXEL (`server/src/index.js` _raidWord's `here` - the mod's own
  reward test). A hamlet's rect is ~300 m of an 819 m pixel. A fight that drifted out tallied its deaths here and never
  said them; past the rect no raider spawns and the defenders go home, so the raid looked finished - and if the player
  did not walk back in before its two hours ran out it withdrew. Step F now says the word of a raid on the player's
  pixel that they fought (a death tallied or a blow struck) from past the rect too; spawning and claiming stay the rect's.
- **A jump's sweep.** `scenes/world.js`'s teleport and load sweep (`exteriorFoes.clearLive()` - a death's respawn, fast
  travel, Recall, /unstuck, a release from jail) empties the foe pool and marks no one dead. The raid kept every raider
  it had stood as standing, so its 25 places were held by nobody and a player back in the town stood no raider for the
  rest of it. `raidPoolCleared()` lets them go, beside the sweep; a raider that fell before it is still tallied. Every
  host that runs raids is `scenes/world.js` - the other three stand none (THE FOUR HOSTS: exterior.js's bench runs no
  raid, worldModes.js and dungeonContext.js are indoors).

And the player's "20 kills": the target is rolled, and the held map's raid card counted this machine's own share against
the raid's target - 0 for a player who is not the raid's runner. It reads the relay's ledger now where there is one
(`ui/eventMapMarks.js` raidMapMarks `relay`, handed `raidRelayState`): the town's count against the town's target.

Not fixed, and why: a raider stuck behind a wall or in water within the raid's 120 m holds its place as the mod's own
does (unmeasurable here); and `net/online.js` sendRaid reads `raidOk` without SD-HELLO's welcome gate - latent, with no
road to it found (the cell hellos do not yield).

Pinned by `test/systems/fb1011g_raidword.test.js` (5); `test/net/raid3_raidLedger.test.js`'s "out of the town: nothing" moved off
the town's pixel (PIN MOVED); `test/ui/eventtip.test.js`'s host pin carries the ledger (PIN MOVED);
`tools/mutants/fb1011g_raidword.json` (9), `tools/mutants/raid3.json` RAID3-client-word-unsaid and
`tools/mutants/eventtip.json`'s two re-aimed by content.

## LOOT-SCROLL: the plaque scrolls (4)

Nothing in the wheel's path changed in the days before the report. The plaque (`ui/worldPlaque.js`, WORLD-HOVER and
QUICK-LOOT) has always drawn six rows (`systems/worldHover.js` HOVER_MAX, "a pile is a glance, not a list") and the rest
as "and N more", and the wheel's light stopped at the sixth: the tail was a count, not rows, and the take could not
reach it. The screenshot is that: its lit row is armour (the stats panel's Armour line), the sixth, Fur Cuisse, over
"and 3 more". What changed is what a body holds: BAL4 (2026-10-10) brought elites to every game with the rarity tiers on,
and an elite's grant (`systems/eliteFoes.js` grantEliteLoot - two Magic pieces, a Common, a chance at better) is
appended to its pack, past the sixth row.

The six are a WINDOW now. The hover frame carries every row; the selection and the take index the whole pile
(`quickLoot.js` takes through `hoverItemAt(..., Infinity)`); `worldHover.js` plaqueWindow is the six the plaque draws -
the window that keeps the lit row in view, moving one row when the light passes its edge and not at all inside it,
kept per pile - with "N more above" over it and "and N more" under it. The classic skin's panel draws the same window
(`ui/classicLootPanel.js` lootPanelLines folds both counts into its one foot line). DFU's own loot window scrolls; the
plaque is the port's (Port-Ledger QUICK-LOOT), and this retires its "glance" sentence in `10-UI/UI-Arc.md`.

Pinned by `test/systems/fb1011g_lootscroll.test.js` (3: the window's law; the take past the old tail; the classic foot line) and
`test/systems/worldhover.test.js`'s 63rd (the real plaque driven: the wheel to the ninth row, the window following, the lit row
drawn the lit item, the take, the window holding while the light moves inside it); `tools/mutants/fb1011g_lootscroll.json`
(9). PIN MOVED: `test/systems/worldhover.test.js`'s "an itemised frame carries the rows" and "the same six rows are visible"
(the frame's rows are every row, the window's are six), `test/systems/quicklootstats.test.js`'s clamp (the wheel walks the whole
pile and clamps at its last row), both quick-loot suites' fixture (`frameOf` mints every row, as resolveHover does
now), `test/systems/disc22c_classic_loot.test.js`'s draw site (the window handed to the panel), and
`test/systems/resourcesafety.test.js`'s plaque slots (the window's `_winKey` and `_winFrom`, both reset by destroyWorldPlaque).

## QUEST-NAME: a quest person is named on the plaque (5)

The click was never broken. Driven through the real interior host and the real quest machine: a Talk press on a quest
Person stand stamps LastNPCClicked and runs DoClick (`worldModes.js` clickQuestFlat), and the quest's `clicked npc`
fires; and DoClick answers true for any Person a running quest holds, so StaticNPCClick returns there - in DFU too a
quest person opens no talk window, and a click the quest is not waiting for says nothing (N0B00Y09's scholar speaks once,
then waits for the notes' hand-in).

What the port had wrong is the plaque. World Tooltips (`vendor/world-tooltips/Scripts/Modded_HUDTooltipWindow.cs`) asks
its StaticNPC arm (`ret = npc.DisplayName`) BEFORE its quest-resource arm, and GameObjectHelper.AddQuestNPC gives a quest
Person's billboard a StaticNPC: in DFU with the mod a quest person is named like anyone. The port read the quest arm's
`is Item` gate alone, so both hosts' namers answered nothing for him - the one person in the room with no name over his
head, which reads as "inactive". `worldModes.js` questStandPersonName names him now, in the building's namer and the
dungeon's, before the item gate: StaticNPC.DisplayName off the stand's own layout data (questStandNpcData) with the
click's own building key, so the plaque, Info's "You see" and the click's LastNPCClicked cannot call him two things. A
quest foe's stand still answers nothing, as the mod's gate does.

FIELD BUGS 2026-10-06c (4) "The Riddle" said "World Tooltips names a quest ITEM alone"; that reading is corrected there.

Left, situational: a living-world resident standing nearer on the ray than the quest person takes the press
(`worldModes.js`'s `livingPersonsAct` before the ladder's winner) - a resident already standing where a quest person is
hot-placed after entry is not moved off. Not changed here. Wanted from the reporter: whether the quest had already
spoken once, whether anyone stood in front of the person, and the town.

Pinned by `test/systems/fb1011g_questname.test.js` (3: the host's helper, run as written over the real plaque namer; both hosts
asking it before the item gate with their clicks' own keys; the mod's own order, read from the vendored source);
`tools/mutants/fb1011g_questname.json` (6). PIN MOVED: `test/systems/audit26_talk.test.js` F016 counts eight static-NPC name
sites, the plaque's quest Person the eighth.

## HELD-SIDE: a trade's refusal says whose hold it was (6)

The message is INT3's refusal (`06-Systems/Integrity-Arc.md` section 4): `server-account/src/realmTrade.js` refuses a
trade when either side that GIVES is held by the judge (`realm.js` holdRefusal), and both sides were told "The realm is
reviewing a character in this trade". Two investigations looked for a road from the report's stealing to a hold, and
found none:

- the item law: every real steal path driven through the client online with the shipped mods - an open shop's Steal
  (`ui/native/nativeTrade.js` _doSteal), a closed shop's shelf, a house's containers - then the server's judgeSave and the
  trade's wire: ~67,000 stolen pieces a run, seven variants, no finding and no hold; and end to end through the real
  Worker - steal, checkpoint, trade the goods, drop them, checkpoint twice, steal again, trade gold - never held;
- the id ledger: stolen commons carry no `uid` (`systems/item/itemIds.js` valuablePiece), so no copy can be counted against
  them;
- the budget (INT5): the one measure that sees theft (a gain no service witnessed), and it holds only once staff turn
  `enforce` on - it ships measuring (Mac: "Measure 7 days, then enforce"). Were it on, every symptom fits: a dropped pile
  is still wealth, and stealing again deepens the overrun.

So the hold is one of: the PARTNER's (the realm checks only the sides that give, and the player read "a character" as
their own), staff's or a copy's (staff alone lift those), the law's over something else, or the budget's if enforcing.
The refusal says which now. The service keeps the held side with its word (`trade-held:a`) and tells each side `held`:
'mine' or 'theirs' (`why` stays `trade-held`, so a client from before reads what it always read; the column is free text,
no migration). The client says it (`net/realm/realmTradeLaw.js` realmTradeRefusalText): the other's - "The realm is reviewing
the other character in this trade", and "Your own trading is open" when my last checkpoint held nothing - or mine, in
the words of my own hold's notice (TRADE_HELD_NOTICES, moved into the trade law's leaf, which `systems/item/itemIds.js`
re-exports: one home for both). 'record-unjudged' says whose the same way.

**For staff, the check this cannot make:** `node tools/realmReview.mjs holds`, then `findings <id>` for the reporter's
character and their partner's - `held` and the finding codes say which. A 'budget' hold under `enforce` lifts at the
next checkpoint once `budget-set` turns enforce off; 'staff', 'dupe' and a 'law' hold past three strikes need `clear`.

Noted, not changed (the owner's call): a stolen counter piece carries no `counterBought` mark (Buy alone writes it), so a
town's patrons buy stolen goods at a player's public trader, the arbitrage LW-II-2 S1 closed for bought goods.

Pinned by `test/systems/item/fb1011g_heldside.test.js` (4: the held side second and first through the real Worker over the real
migrations; the words; the client's half carrying the side into its refusal with the session's own hold);
`test/server/int2_judge.test.js`'s refused half and its source pin carry the side (PIN MOVED); `tools/mutants/fb1011g_heldside.json`
(9), `tools/mutants/int2.json` INT3-the-trade-unheld re-aimed by content.
