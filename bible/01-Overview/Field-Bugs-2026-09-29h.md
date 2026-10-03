# FIELD BUGS 2026-09-29h - eleven threads from #bug-reports: the palace's terms, the lost boats, the temple's shelves, the crash on a hidden window

Eleven screenshots of the Discord's #bug-reports, through Mac. The rule for a batch like it: every report root-caused
on the real modules, the port's own faults fixed and pinned, and what is Daggerfall's own (or a mod's), or a design
call, said plainly and left to Mac. The letter after the date is this batch's own: PR #452 holds 29g. Mac, on the
first answer's three "Daggerfall's own" (2, 4, 8): *"Dont worry abour DFU."* - so they are fixed too, as departures.

*The same letter, twice (the PROF7 merge, 2026-09-30): this batch of eleven was written on main while VEIN-NEED, a
batch of one, was written on the professions branch under the same name. The merge keeps both here - VEIN-NEED is part
two, below - so every cite of this page stands.*

| | Report | Reporter | What it was | Done |
|---|---|---|---|---|
| 1 | "(Mobile) Can't accept terms of entry for palaces. The onscreen keyboard won't pop up" | QuinsmQuansm | a castle is the world host's dungeon mode, and the host's `overlayActive` read the town's window slot and the travel view, never the modes' own stacks: the touch layer's nav row - its abc field (the phone's keyboard) and its Return - never stood over the guard's box | fixed (TOUCH-HELD) |
| 2 | "Boat deed not working in port towns ... it tells me I'm not near a port" | Swordsman | Come Sail Away's own IsNearPort, ported 1:1: a location MAPS.BSA flags PortTownAndUnknown (343 of 15,251) inside a square three pixels west and north of the player and one east and south; the map's harbours are Travel Options' list, 35 of whose 378 carry no flag; the refusal named no port | fixed, a departure (DEED-PORT) |
| 3 | "Boat Noises at Kinging Court ... the large boats floating underneath the town ... They'll likely need to be de-spawned" | Julian (weerdo27) | two Large Boats the port lost before FIELD-CSA1 (a respawn's teleport left them in the old frame's numbers - under the town), kept in the save where they stood and restored there, their loops heard whenever the pixel is near; the deed of a Large Boat is spent on placing | fixed (LOST-BOAT) |
| 4 | "Lycanthropy still tied to server clock ... resting did not progress the disease ... I had gotten another disease ... and had to cure it which likely wiped my lycanthropy progress" | Julian | no clock fault: the infection is stamped and read on the character's own clock and an online rest moves it (LIVED1, `test/lived1.test.js`); the cure ended it - DFU's own law, an infection is a disease bundle and Cure Disease ends every one | fixed, a departure (INFECTION-KEPT) |
| 5 | "Elite Dungeons that despawn stay on map ... no entrance anymore but are still marked on overworld map" | Cruor | the Overworld's `tvSpawnGone` excused a spawn on any BUILT pixel - and a pixel built after the spawn's clock ran out is built empty | fixed (SPAWN-PLATE) |
| 6 | "The interior lighting flickers and shadows are cast through walls. The MG is especially noticeable" (with MD-Geist: switch Enhanced Lighting off; LostMyLeg: the Improved Interior Lighting patch "as a 2nd option") | Kristian B | the same report 28f answered (DISC29-E), fixed by PR #418 the morning after it was posted; what it left is a carried light's leak through a wall; the second option shipped as Modded lighting (PR #437) | nothing new; said |
| 7 | "I hit rank 4 (Curate) in the temple of Stendarr ... Bookshelves were telling me I was the wrong rank" | ThetaDecay | the shelf read the building faction's own `ggroup` - a temple's is its divine's, None - instead of GetGuildGroup's walk to the templar child: every temple shelf refused every member at every rank | fixed (TEMPLE-SHELF) |
| 8 | "Guild rank time not advancing (online) ... traveling back and forth between towns, which took 32 total days" | ThetaDecay | the 28 days are DFU's (Guild.cs), stamped and read on the character's clock (LIVED1): an instant trip (Inns, Ship) counts its days; a walked one online (Camp Out, the Overworld) counted the real minutes it took - AUDIT LIVED1's and LIVED1b's open question; and until LIVED1 the wait never held online at all | fixed, a departure (WALK-CLOCK) |
| 9 | "Bounty targets can spawn in inaccessible parts of dungeons" | Skibbster | a dungeon hunt's lair was anchored on any of the dungeon's own foes, and a foe stands at every enemy marker of every block - sealed rooms, water, the far side of a held door | fixed (BOUNTY-LAIR) |
| 10 | "I'm stuck in a perpetual 'World: Sign in to play online' & 'World: Connecting' state ... I am currently updated" | MD-Geist | "sign in to play online" is the relay's refusal of a hello with no token; the client waited ACC1d's 2.5 s for its token, a budget set when an unsigned hello still got in - ACC1g made it a refusal and left the budget, so a token slower than 2.5 s was a refusal every time, and the World link's rejoin every thirty seconds met it again | fixed (TOKEN-WAIT) |
| 11 | "CRASH (2) ReferenceError: Cannot access 'be' before initialization" at `world-BEJ_VH7s.js:1690:4227`, from HTMLDocument | Joctaed | the realm's page-hide hook read `online` (`be`) while `bootWorld` still waited on the quest pack, 1,900 lines before `let online` | fixed (BOOT-HIDE) |

Pins: `test/fb0929h_{boothide,touchheld,templeshelf,spawnplate,tokenwait,bountylair,lostboat,infectionkept,walkclock,
deedport}.test.js` (27), each red on the code before it. Mutants: `tools/mutants/fb0929h_*.json`, 57 records, 57 dead.

## BOOT-HIDE: the checkpoint's doors stand below what they read (11)

**Reproduced first, off the report's own build.** `npm run build` at main (3b6f2ea77, app-v0.1.4899) mints
`eotbSprite-Dj71y-pj.js` - the report's chunk, byte for byte; the world chunk's name carries the commit, and its line
1690 column 4227 is the same code: `j0e(globalThis.document,()=>{be&&Iu()})`, which is
`whenPageHides(globalThis.document, () => { if (online) onlineCheckpoint(); })` - the frame under it in the report is
`realmSaves.js`'s `visibilitychange` listener (`$8e`).

**Why.** `bootWorld` registered the realm's page-hide hook at the checkpoint (world.js, REALM P1.3) and declared
`let online` some 1,900 lines lower, with two awaits between: `await loadQuestPack()` and the first pixel's people. A
window put away while the boot waited - a phone's home button, the desktop app minimised during a load - ran the hook,
and the read of `online` threw in its dead zone: the crash overlay. Three more doors had the same shape: the exit
autosave (`beforeunload`), the saved-soon door (PROF-SAVE's `saveSoon.ready`, which runs on the next task when a change
waited) and the title exit - each reaches `online`, `seatOut` and the duel manager.

**The fix.** The four registrations stand below the duel's (THE CHECKPOINT'S DOORS, after `duelHeal`), where every
binding they reach exists before any of them can run; the exit autosave is named where it was written
(`exitAutosave`) and handed to `beforeunload` there. `whenPageGoes` stays where it was - it reads the session alone.
`test/fb0929h_boothide.test.js` (3) walks every callback `bootWorld` hands to a page door (`beforeunload`, `pagehide`,
`pageshow`, `visibilitychange`, `whenPageHides`, `whenPageGoes`, `setBeforeTitleExit`, `saveSoon.ready`) through the
functions it calls and names any binding it reaches that the boot declares past one of its own awaits - BOOTORDER's
gate walks what the boot RUNS, and a door runs whenever the page says. On the code before, it names 36 reads across
the quest pack's await (ten each for the unload and the title exit, eight each for the page put away and the saved-soon door); it names the report's shape when the hook is put back; and the crash itself is
reproduced in miniature (an `EventTarget` firing while its registrar awaits). Four older pins read the moved lines and
were re-aimed (`auditduel1`, `oneseat`, `auditrealm2_client`, `profsave`); their 148 mutants are still dead.

## TOUCH-HELD: a window on a mode's own stack holds the finger (1)

**Reproduced first.** The terms are TEXT.RSC 5464, a ShowTextWithInput (RDB action type 12): the player types one of
`TYPE_12_ANSWERS[5464]` ('yes', 'i agree', ...) and presses Return (DaggerfallAction.cs:566, `ActionInputBox`). A
castle runs in the world host's dungeon mode, so the box stands on the dungeon's window stack
(`pushDungeonWindow`). The only way a phone types into a classic box is the touch layer's nav row: its **abc** opens a
real text field inside the gesture (the phone's keyboard), replays the letters as keys, and its **⏎** is Return. The
row stands while the host's `overlayActive` says a window holds the game - and the world host's read
`townTalk.overlayActive || travelView.active`: the town's slot and the travel view, never `modes.overlayHeld` (a
building's paused stack, a dungeon's windows). With the guard's box up, the row was down: no keyboard, no Return; ≡ sent
Escape, which cancels the box. The standalone dungeon host's hook (`!!ctx.uiOverlayActive`) always read its stack.

**The fix.** The world host's hook reads `modes?.overlayHeld` too (`modes` is a `var` until the boot builds it). The
pad shares the hook (GP1): a window indoors is a cursor for it now on the classic skin as well, which PADPLUS2 had made
it under Plus alone. `test/fb0929h_touchheld.test.js` (2) lifts the host's own hook and drives the real touch layer
over a stub document: the row stands over the dungeon's box, abc raises a focused field, "yes" and ⏎ go through the
dungeon's own key route (`routeKey`) into a real `ActionInputBox`, which submits "yes" - an answer the guard's table
takes. The tv1 pin and its mutant record were re-aimed at the line.

## TEMPLE-SHELF: a temple's shelf asks its temple (7)

**Why.** DaggerfallBookshelf.ReadBook asks `GuildManager.GetGuild(factionID)`, and GetGuildGroup (GuildManager.cs:
269-291) turns a divine's faction - what a temple's building carries, `ggroup` None in FACTION.TXT - into its first
child's group, the HolyOrder. The port has that walk (`guildGroupOfFaction`, AUDIT 20) and the temple's services use it;
`openBookshelf` read the record's own `ggroup`, so `createGuildForGroup(None)` answered no guild and `bookshelfAccess`
said accessMembersOnly to every member of every temple at every rank. The rank law was right all along (Temple.cs:
466-469, Stendarr's library at 4, `guildVariants.js`).

**The fix.** `worldModes.js` `openBookshelf` asks `guildGroupOfFaction(dict, b.factionId)`. `test/fb0929h_templeshelf.
test.js` (2) runs the shelf's own lines over the real guild modules, a faction record of FACTION.TXT's shape and a
membership the real producers mint: a Curate of Stendarr reads Stendarr's shelves, an Acolyte does not, a Patriarch of
Arkay does not, a stranger does not, a Library asks no guild. A Mages Guild hall was never affected.

## SPAWN-PLATE: gone is what the ground says (5)

**Why.** A spawn's time runs out on the ledger's clocks (TTL1); the next build of its pixel takes it out of the index
and builds the pixel empty (`_locationToBuild`). A FOUND spawn is marked on the Overworld off the discovered-places
store, which files it for good (`tvFiledSpawns`), and its plate stands until `tvSpawnGone` says it is gone - which
excused any spawn on a built pixel (AUDIT OW5b D2: "one standing on built ground stands until that ground is next
built"). A pixel built after the clock ran out is built, and empty: the excuse kept the plate over bare grass, and its
walk, whenever the traveller came within the grid; from farther away it vanished, and it came back on approach.

**The fix.** Standing on the ground is the build's word: `built.get(key)?.location == null` (whether the pixel stood a location), never
`!built.has(key)`. OW5b D2 is kept - a spawn still standing on ground built before its time ran out keeps its plate
until that ground is built again. `test/fb0929h_spawnplate.test.js` (2) runs the two host functions lifted off
world.js over the real ledger through the report's sequence (found, built, seven days, built again) and the cleared
clock's; the tv6 pin that held the flawed rule now holds both halves; two OW4/OW5b records re-aimed.

## TOKEN-WAIT: the budget covers the answer (10)

**Why.** "sign in to play online" is the relay's own refusal of a hello with no token (server/src/index.js `_named`,
ACC1g: "NO TOKEN, NO ROOM"). A session mints its token as the socket opens and waits `TOKEN_WAIT_MS` for it; ACC1d set
2.5 s, when a hello without one was still admitted - "a connection that works and a name the relay will not vouch
for". ACC1g put the wall at the door and left the budget: past it there was no connection that works, only the
refusal (a policy close, terminal). The token route is eight D1 round trips from the player's edge and a preflighted
POST to a second host, three at once as the page starts; for a player it takes longer than 2.5 s, every hello was
refused, and the World link's rejoin every thirty seconds (`CHAT_REJOIN_MS`) met it again - "connecting", then "sign
in", for as long as the page stood. The presence link does not rejoin until its room changes.

**The fix.** `TOKEN_WAIT_MS` is 8 s: it covers the service's real answer and stays under the relay's `HELLO_WAIT_MS`
(10 s), past which a full room closes a socket that has said nothing. A late token and every refusal are said in the
console (`[online] no identity token within 8000 ms`, `[account] no identity token: no sign-in stored on this device`,
`[account] no identity token: <the service's word> (<status>)`), so the next report can tell a slow service from a
missing sign-in or a refused one. `test/fb0929h_tokenwait.test.js` (4); ACC1d's "under 5 s" bound re-aimed (its premise
is gone) and two ACC1d records re-aimed; MUT-AIM's carried map shrank by one (ACC1d-12 names one site now).

## BOUNTY-LAIR: the lair stands where a quest's foe would (9)

**Why.** BOUNTY1 anchored a dungeon hunt's pack on one of the dungeon's own foes 25 to 90 metres from the hunter. A
foe stands at every enemy marker of every block (RDBLayout's 199.15/16), sealed rooms, water and the far side of a door
held past any pick among them - places the game never asks anyone to reach. Daggerfall's own answer to "a target in
this dungeon" is the quest spawn marker: EnumerateDungeonQuestMarkers (Place.cs:1522) collects the 199.11 flats and a
quest's foe is stood at one (`markerScenePosition`).

**The fix.** `systems/quest/place.js` `dungeonQuestSpawnSpots` - the 199.11 markers of a laid-out dungeon in its
scene's frame, beside the quest law's own constants - answered by the dungeon context (`questSpawnSpots`); the lair is
one of them, by BOUNTY1's own band (25 to 90 m, else the farthest), and a foe's place only in a dungeon with none
(types 17-18 carry no quest markers). `test/fb0929h_bountylair.test.js` (3): the marker law (199.11 alone - not an
enemy, an item marker or a treasure flat that shares the record's number - under each block's origin), and the host's
own `_standBountyDungeonPack` lifted off world.js: a sealed room's foe in the band is never the lair when a marker is.
`06-Systems/Bounty-Boards.md` says so.

## LOST-BOAT: a boat the port lost is given back (3)

**Why.** FIELD-CSA1 (28d) closed four ways a placed boat was lost - the seabed, far out, a respawn's teleport ("it stood
by the temple its owner woke at, under the ground"), a recentre out of sight - for boats placed from then on. A boat
lost before it is in its owner's save where it stood, and ComeSailAwaySaveData restores it there verbatim; its loops
play whenever its pixel is near (the rolloff never falls under half, FIELD-CSA1's own note), and a Large Boat's deed was
spent placing it. Online there is no console to purge it.

**The fix** (the port's own; Port-Ledger A). Once the ground under a boat is built, the boat is asked ONCE: a hull
whose place is `LOST_UNDER_M` (2 m) under the ground or under the sea's top is lost, and an uncrewed one is packed into
its parts - the mod's own PackBoat, its cargo with it - for the player to place again, with a line that says so. A
crewed hull is left: its deed still calls it to a port (useBoatDeed repositions). Never a boat placed indoors, never
indoors, never the one being sailed. `test/fb0929h_lostboat.test.js` (3) over the real hulls: the report's two Large
Boats under a town given back, a boat afloat (and on a recentred sea) kept, a keel on a beach kept, a crewed hull kept,
the seabed given back, a boat whose ground is not built asked when it is, a boat asked once, the pixel's row read
against the scene's z.

## INFECTION-KEPT: a cure takes the plain diseases first (4)

**Reproduced.** Rested hours online gave the dream at 23 hours and the turn at 95 with the world's clock still: the
incubation is the character's (LIVED1), and no clock held it. The cure of the dungeon's disease ended it -
`cureAllDiseases` ends every `kind: 'disease'` bundle, as DFU's CureAllDiseases does, and an infection is a disease
bundle there (`systems/infection.js`). What stays on the world's clock is the full moon alone, by LIVED1's design.

**The fix** (Mac: *"Dont worry abour DFU."*; Port-Ledger A). A cure of disease takes the plain diseases first: while
one runs, the cure - the temple's paid and holiday arms (`guildServiceActions.js`), a Cure Disease cast or potion
(`effects.js`) - ends the plain ones and leaves a lycanthropy or vampirism infection to its turn; a cure with nothing
else to end ends the infection, so a bitten player who does not want the curse still cures it before the turn, as in
the classic game. The temple prices what the cure takes (`curableDiseaseCount`): the plague beside an infection is one
disease's price. A stranger's cast still never ends it (AUDIT SPELL-GIFT B6), and the turn's CureAll of the old life
(`lycanthropy.js` endOldLifeEffects) still ends every disease. `test/fb0929h_infectionkept.test.js` (3): the report's
sequence through the real temple (bitten, the dream, the plague, the cure, the turn on the fourth day), the escape at
the temple, on a holiday and cast, and the turn; the `infection`, `spellgift` and `audit27d` pins moved (a mate's first
cure takes the plague, a second the infection) and B6's record re-aimed.

## WALK-CLOCK: online, a journey's hours are the traveller's (8)

**Reproduced.** An instant trip of 32 days opened the wait; thirty real minutes walked at x40 online added a quarter of
a day to the character's clock (offline, ten). Before LIVED1 (from WORLD5, 2026-09-14) the wait never held online at
all - the old arrival shift clamped `lastRankChange` in the classic day's units, far under `daySinceZero`'s - so the
wait itself is new to online players.

**Why.** A guild's 28 days (Guild.cs) are stamped and read on the character's own clock (LIVED1). Online the shared
clock is the world's and moves for nobody (WORLD5), and the frame's tick read it alone, so an accelerated journey
charged the character's clock its real minutes: thirty-two days on the map were hours lived, and the guild's wait, an
infection's days and every need stood still behind them (AUDIT LIVED1 For Mac 2, AUDIT LIVED1b For Mac 5).

**The fix** (Mac: *"Dont worry abour DFU."*; Port-Ledger A). Online, while the clock is accelerated (a Travel Options
journey, the Overworld's walk, the helm's time scale), the frame raises its minutes past the world's on the
character's own clock (`walkRaise`, handed to `playerTicker.tick` - LIVED1's door a rest already uses, so the needs,
the rounds and the letters walk them); the world's clock still moves its real minutes alone, and offline nothing
changes. No faster than a rest already moves it. `test/fb0929h_walkclock.test.js` (2): the frame's own raise lifted off
world.js, and thirty-two days at x40 through the real ticker - the character lives them and a rank's wait opens.

## DEED-PORT: the deed asks the map's harbours, round the player (2)

**Why.** Come Sail Away's IsNearPort, ported loop for loop by CSA-H (`03-World/Come-Sail-Away.md`, Variants and
ports): from X - range while below X + range - 1 on each axis - three pixels west and north at the default, one east
and south, so a flagged port two pixels east or south was never near - asking MAPS.BSA's PortTownAndUnknown byte, which
343 of 15,251 locations carry. What the map draws as a harbour is Travel Options' list (`systems/travelPorts.js`), and
35 of its 378 carry no byte. The refusal said nothing of where to go. No water is asked: the reporter's guess (the
coast pushed back) is not it.

**The fix** (Mac: *"Dont worry abour DFU."*; Port-Ledger A). The square is centred on the player (range pixels every
way: 7 x 7 at the default); a harbour the map draws is a port beside a flagged location (`csaIsPortTown`, which the
naval shipwright and the port traffic read too); a refusal of the deed or the variant box names the nearest harbour and
the way to it ("There is no port nearby. The nearest port is Daggerfall, to the north-west"). The range is still the
mod's slider (1-10, 3). `test/fb0929h_deedport.test.js` (3): the host's port test and nearest-port finder lifted off
world.js over the real port list, and the runtime's square and refusal; CSA-H's square pin and four of its records
re-aimed.

## Said, not changed

**6 - the lighting.** Kristian B's thread is 28f's DISC29-E; its fixes merged in PR #418 (2026-09-29, 05:55 EDT), the
morning after it was posted. A desktop build from before (macOS and the portable exe do not update themselves) shows
all of it still. What DISC29-E left is the fourth cause: a carried light (a torch, a lantern, Light's candle, a peer's
torch) has no shadow map and lights through a wall. The second option shipped as Modded lighting (PR #437), which acts
with Enhanced lighting off (its patch notes say so; its Features note does not).

## For Mac

1. **The cure's order (4).** A cure takes the plain diseases first and an infection only when it is all that is left,
   so a player with both who wants rid of the curse cures twice (the temple prices each). The other way - no cure ends
   an infection before the turn - would take away the classic escape.
2. **A carried light's shadow (6).** DISC29-E's cost question, open.
3. **A crewed hull lost before FIELD-CSA1 (3)** still plays where it stands until its deed calls it to a port.
4. **The World line (10).** If it goes on for MD-Geist after this ships, their console now says which: no sign-in
   stored, the service's refusal and its status, or a token slower than 8 s.

Found on the way, not changed: a spawn stood on the boot's own pixel before the spawn clock starts gets no ledger row,
and the index then hands it to every rebuild without one - it never expires unless it is entered (the opposite
symptom to 5). And the key ladder (`world.js`'s `keydown`, registered before the boot's awaits) reaches 28 bindings
declared past them, each behind a guard BOOT-HIDE's walker cannot see; its gate covers the page's own doors only.

## Part two - Dunkitay's Silver: the press that said nothing, and the pack's Pick-Axe

One screenshot from the Discord (Dunkitay, through Mac): *"how do i mine this, if i use the pick axe it says "you
cannot mine in here!""*. A dungeon, a vein on the wall under the crosshair, the prompt "[E] Mine Silver - needs Mining
25" above the hotbar, the chip "Mining 0 - 0 / 60 today" under the compass, a Pick-Axe on the hotbar. Mac's word with
it: "We recently implemented foraging and our new life skill system". The rule for a batch (29g's): every report
root-caused on the real modules, the port's own faults fixed and pinned, and what is a design call said plainly and
left to Mac.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "how do i mine this" - E at the vein | Silver is tier 3, which needs Mining 25 (PROF0 3.2); every vein of a dungeon nobody has confirmed is Silver (PROF0 23), and every dungeon vein is tier 3 or more. E at a node that cannot be worked passes the press on (AUDIT 29 C1), and with nothing else under the ray the press opened nothing and said nothing - the prompt's [E] a drawn door | fixed (VEIN-NEED): the node says what it needs, the player's own rank beside it |
| 2 | "if i use the pick axe it says "you cannot mine in here!"" | Foraging's own Use from the pack - the hotbar's Pick-Axe is the pack's Use (UI2) - and the mod mines only in the wilderness (FORAGE0 6.2). Its line is the mod's (FORAGE0 law 1, Mac's) | the mod's line kept; for Mac |

### VEIN-NEED: E at a node that cannot be worked says what it needs, when nothing else takes the press (1)

**Reproduced first**, on the real gathering host over a real book (`test/fb0929h_veinneed.test.js`): a dungeon nobody
has confirmed, Mining 0, a Pick-Axe in the pack, a vein under the crosshair. Every vein there is Silver at tier 3; the
prompt reads "[E] Mine Silver - needs Mining 25", the screenshot's words. `press()` answers false - the press goes on
down the dungeon's ladder - and at the ladder's foot, with nothing under the ray (`key === null`), the ladder answers
false and nothing is said. A player pressing the key the prompt names hears nothing at all; the only other gesture
they have is the pack's (2).

**Why.** PROF1 built E at a node as "an act started, or what it needs said": a node that could not be worked took the
press and toasted its need. AUDIT 29 C1 found that press stolen from the door, the chest or the foe beside a node,
"and when it could not be worked (every dungeon vein below Mining 25)", and made such a node pass the press on, so the
ladder gives it to what it was meant for (`06-Systems/Online-Arc.md` AUDIT 29). The need went with it, and the prompt
still names E. So where nothing else is under the ray the press opens nothing and says nothing - a drawn door that
opens nothing, the lie this repository names (`10-UI/UI-Arc.md` AUDIT 62 F10) - and every Novice who meets a
dungeon vein meets it.

**The fix.** The press a node passes on keeps what the node needs (`scenes/gatherHost.js` press); each ladder hands
the press back at its foot when it opened nothing else, for an E press alone - the dungeon's at `key === null`
(`scenes/worldModes.js` tryExitDungeon, through the world host's `profNeed`), the street's where the door arm answers
that nothing opened (`scenes/world.js`, before GRAVE1's epitaph) - and the node says it (`sayNeed`). C1's order stands:
every arm of both ladders comes first (the quest foe's click, the lock, the plaque's act, the foe, the boat, the loot,
the doors; on the street the ship, the gate, the camp and the wagon too), and a press no node was asked - a click, or
underground a touch spell's release - hands nothing back. The words are the prompt's, and where the rank is what is
short - the kinds' plans carry it (`needsRank`, `scenes/mineHost.js`, `herbHost.js`, `treeHost.js`) - the player's own
rank beside it:

- **"Mine Silver: needs Mining 25 - your Mining is 0"** (the report's vein), and at Mining 12, "... your Mining is 12";
- "Mine Silver: needs a Pick-Axe"; "Mine Silver: Mining 25 - 60 of 60 today"; "Mine Silver: Stores full - Silver";
  "That gathering is being counted." (PROF1's own line, from before C1);
- the same for every kind - a patch ("Pick ...: needs Herbalism 10 - your Herbalism is 3"), a tree, a boulder, a
  surface vein. A node worked today is no target, and says nothing.

One press, one line; a press with no node under the look forgets the one before. The prompt is unchanged (PROF0 8's
form): it already says what the node needs, and the press now says it too, with the rank the player holds.

`test/fb0929h_veinneed.test.js` (5). MEASURED against the code before the fix (its new doors stubbed to the old
silence), three fail - the report reproduced on the real host; each need's words off each kind's own plan; each
ladder's new line lifted off its source and run, with every arm of both ladders before it - and two hold, as they
must: the pack's line and the vein's skipped checks as they stand, and the presses that must still say nothing (the
press the node took, no press, a newer press with no node - pinned against the fix saying too much, their mutants
dead);
`tools/mutants/fb0929h_veinneed.json` (17, 17 dead). `tools/mutants/audit29.json`'s C1 record re-aimed by content
(49, 49 dead). 60 line cites into `world.js` and `worldModes.js` moved (tools/citeShift.mjs), and five struck
Ledger/Settings cites by hand.

### The pack's Pick-Axe (2)

Foraging's Use, 1:1 (`06-Systems/Foraging.md` law 1, **Mac's**: "What a tool does from the inventory ... and every
message, are the mod's"; law 4: "Neither gesture changes the other"). The mod's first check is
`IsPlayerInside || IsPlayerInsideDungeon || IsPlayerInsideDungeonCastle` (IL_1328), so underground it answers "You
cannot mine in here!" whatever stands on the wall - true of Foraging's mining, which is a wilderness quest; beside a
vein it reads as if the vein could not be mined. The vein's own act never asks that check (PROF0 23: a dungeon vein
skips inside, settlement, daylight and sea; `DUNGEON_SKIP`). Pinned as it stands, unchanged; For Mac 1.

### For Mac

1. **The pack's Pick-Axe beside a vein.** Keep Foraging's line 1:1 (law 1, yours), or, online and with a node of the
   tool's own kind under the look: (a) the Use does what E does there - the act, or what the node needs - law 4's "the
   same tool, carried to a node online, is the profession's tool" read as taking in a Use there (the pack's and the
   hotbar's); or (b) Foraging's line, and the port's own after it ("The vein takes [E]"). Anywhere else the Use stays
   Foraging's. The record's lean: (a) - "use the pick on the ore" is what a player tries first, as this one did.
2. **Every dungeon vein needs Mining 25.** Dungeon veins are tier 3 to 6 (PROF0 6) and a dungeon nobody has confirmed
   holds only Silver (PROF0 23), so a Novice finds veins in every dungeon and can work none. Mining 25 is 6,250 XP:
   MEASURED on the law (`harvestXp`), 163 clean harvests at the surface veins by day (tier 1, then tier 2 from rank
   10), 242 plain - three to four days at the cap of 60. Keep (a dungeon vein the Apprentice's reward, and the need now
   said), or a vein the Novice may work underground? The record's lean: keep.

The Mining patch notes never said a dungeon vein needs Mining 25, nor that the
pack's Pick-Axe is Foraging's mining and not the vein's; VEIN-NEED's notes say both, beside the fix.
