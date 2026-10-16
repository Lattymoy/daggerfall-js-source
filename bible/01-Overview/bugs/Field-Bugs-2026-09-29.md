# FIELD BUGS 2026-09-29 - the realm's first evening

From the Discord (#bug-reports and #suggestions), through Mac, as eight screenshots and a ninth that came in while the
first eight were being worked:

1. EnragedBard (Tony H.: "Same thing happened to me"): *"I've previously played this character online before the current
   update ... when I press the button is says, 'Only a character you have already played online can be brought into the
   realm.'"*
2. Dracula/Valentin: *"MY GUILD IS GONE, I LOST ALL MY MONEY AND I CANT TRAVEL ... IT TOOK ALL MY MONEY BECAUSE OF LOANS
   (HOW TF WAS I SUPPOSED TO KNOW YALL WOULD FORCE THE LOANS TO BE PAID ON FUTURE UPDATE) AND IT SOMEHOW DELETED MY
   GUILD"* - and their suggestion thread, *"PLEASE allow vampires..."*: travel by day under a hood (Starempire42), which
   Sir McMobdon called a good idea.
3. Cruor: *"Bugged Mark item with an error!"* - a Mark of Featherweight reading "Cast when used: ERROR".
4. lumin: *"Vendors selling items for 0 gold"* - bandages; "There should be a hard minimum of 1 gold for anything."
5. Satranath: *"Can't free mouse on Overworld until after pressing Escape (Y doesn't work)"*.
6. Satranath: *"Defending vs raids impossible, guards arrest you"* - with "protect civilians from melee attacks" on.
7. SylviaBun: *"New Overworld map lags when fast-traveling to a distant location"* - sub-10 FPS once a far destination is
   picked on the Travel Map.
8. DoubleDutchess: *"Tiny furniture ... Benches for ants?"* - in a dungeon.

Mac answered the three calls the realm's reports asked for (`06-Systems/Realm-Arc.md` Decisions 6-8): the census admits
**"Any pre-realm trace"**, homes and guild places **"Carry them"**, and customs **"Call in all loans"** - told first.

Later the same day, Mac: *"Please activate ToxicTaco69 character for online mode. He cant access it"* (CUSTOMS-GRANT,
below - retired at the merge for main's CUSTOMS-PASS, decision 9).
And: *"GarySoup lost his house and furniture. I suspect a lot of people lost a ton of belongings"* (HOUSE-LOSS, below).
Then: *"I want people to get their stuff back"* (RESTORE, below).

## CUSTOMS-CARRY: who comes in, what comes with them, and the door says so first (1, 2)

**Reproduced first.** `test/server/fb0929_customs.test.js` drives the real Worker over the real migrations: a character with a
cloud backup from before the realm and no Renown track is refused `customs-never-online` - the field's refusal.

**Why.** Migration 0020 took the realm's census - "the characters that played online before the realm" (decision 3) - of
`renown_tracks` alone, and a track is only ever written with XP to hold (AUDIT RENOWN1 DATA-7): a first online KILL,
since RENOWN1 on 2026-09-24. A character played online before that, or one that walked the Bay online and never killed,
had no track, so the census never counted it. And AUDIT REALM2 S2 had customs carry the Renown track and nothing else:
a character's online home and guild place stayed under its offline id, which can never come online again - Dracula's
guild "deleted" (its master gone, its name and tag kept from any founding), a house exclusive to nobody who could walk
in. Customs itself did what the plan says (every loan called in, the wealth capped at the allowance), but the door said
so only after it had run, and it runs once.

**The fix.**

- **The census counts every trace from before the realm** (migration 0022): an online home, a guild place, a raid fought
  and a cloud backup, each stamped before 1790638734 (the commit that brought 0020 to main). A backup proves the
  character stood before the realm, not that it played online - Mac's call. The census stays frozen at the realm's
  start, so a Copy to offline's new id never counts (L1-F5), and "once" stays the character's on every account (L3-F2).
  The refusal names what counts.
- **Customs carries the online homes and the guild place again** (`server-account/src/realm.js` `CHARACTER_TABLES`), and
  0022 carried them for every character customs had already made - Dracula's guild comes back to their realm character.
  They are what stood before the realm (since the realm only a realm character claims, places or founds - S2's rule
  stands) and pay out nothing that was not the realm's (0020's `paid` and `realm_gold`: the carried house sells for
  nothing, the treasury's old gold stays the guild's). A realm character already in a guild keeps it.
- **Bring online asks first.** The press shows what customs will do - the loans it calls in, what the allowance leaves
  behind, the deeds that stay, that the homes and guild place cross, that the offline character keeps everything - off
  customs run on a copy, and runs it on the answer.

Pinned: `test/server/fb0929_customs.test.js` (5), `tools/mutants/fb0929_customs.json` (13 mutants, 13 dead); S2's pins flipped
to the new law and their mutants re-aimed. `06-Systems/Realm-Arc.md` CUSTOMS-CARRY.

## FEATHERWEIGHT: the Mark that read "ERROR" (3)

The item is DFU's own and whole: MAGIC.DEF's *%it of Featherweight* is one CastWhenUsed slot at classic spell 37,
Slowfalling; used, it casts Slowfalling on its user for 10 of its 1500 condition. The READER was wrong: DFU's
MagicPowers (DaggerfallUnityItemMCP.cs:345-363) names a CastWhen* spell out of the whole of SPELLS.STD, and
`itemPowers.js` asked the item maker's list for that one power - which offers Slowfalling only as Cast When Held. It
reads the SPELLS.STD registry now (and, until that lands, the catalogue's three CastWhen* lists as one table). A saved
Mark reads right on load. `test/systems/item/fb0929_featherweight.test.js` (5), `tools/mutants/fb0929_featherweight.json` (4, 4
dead). `06-Systems/Systems-Arc.md` FEATHERWEIGHT.

## FB0929: the Overworld's mouse, free from its first frame (5)

A browser answers a pointer-lock request a task later, and `releaseLook` lets go only of a lock that is HELD. A journey
begun or resumed on the map raises the Overworld on the frame after the map goes down (`world.js` `tvJourneyUp`) - the
very frame whose look gate has just asked for the lock back on the map's close edge - so the view's `freeCursor` found
nothing to release, and the lock landed under a view whose cursor is its own: the mouse captured, Y refused under the
view (TV1's law, which stands), until the browser's own Escape. The map's Overworld button never raced. A lock that
lands while the cursor is free is let go now (`player/pointerLock.js`) - which covers Y pressed while a click's relock
is in flight too. Main's AUDIT OW5 V1 found and fixed the same race the same day; at the merge its one page-wide
listener stayed and this branch's copy went, and these pins drive it. Reproduced in a
Node test and in real Chromium first. `test/scenes/fb0929_overworld_mouse.test.js` (3),
`tools/mutants/fb0929_overworld_mouse.json` (3, 3 dead). `06-Systems/Travel-View.md` FB0929.

## FB0929 (min price): a purchase is never free (4)

Daggerfall's cost law and haggle, to the bit: CalculateCost floors a piece at 2 gold, and CalculateTradePrice's buying
arm (FormulaHelper.cs:2000) scales the lot by 66/256 to 256/256 and truncates - so a piece at that floor (a bandage off
the General Store's own shelf, a candle, the parchment worth 0, a Climates & Calories apple, a cheap blade's repair)
went for nothing over about a third of the counters and hagglers it meets, and a stack for less than a gold a piece.
Reproduced with the real shelf first. Mac's word in the report ("a hard minimum of 1 gold for anything") is the law,
Port-Ledger A: `tradeModes.js` `getTradePrice` asks Buy and Repair for a gold a piece at least (`tradeCost` counts the
pieces in the walk that totals the cost) and Daggerfall's number wherever it is more. The classic and enhanced
counters, the enhanced quote and the keyed shelf and repair rows all price through it, so what a counter shows is what
it takes. The SALE is not floored - online a shop pays at most half its ask (P0.4), and a floored sale would mint gold -
so the floor only raises an ask, and it shut Daggerfall's own loop (a bandage bought for nothing and sold back for a
gold). `test/systems/fb0929_min_price.test.js` (8), `tools/mutants/fb0929.json` (17, 17 dead). `06-Systems/Systems-Arc.md`
FB0929.

## FB0929 (raids): the swing no longer finds the town's defenders (6)

The setting is DFU's MeleeAttackFriendlyProtection ("Protect Friendlies and Neutrals"). The world host offered each
swing to the watch, the monsters, then the defenders ALONE (DISC19-F), and that last pass took the nearest defender in
reach and view - Audit 28's stand-in for DFU's look ray - so every swing that met no raider fell on one. A blow on a
defender is Assault (AUDIT DISC19 W2): the squad turned, the Halt box lowered the region's standing, and the court
followed. Reproduced in node first (crime 4, both defenders hostile and hunting the player). Under the protection the
watch's pool now spares its defenders on every pass (`cityGuards.resolvePlayerHit`), as the player's spells, shafts and
torches always have, and a defender on the look ray stops the swing short of the townsperson behind. With the
protection off nothing changes. Port-Ledger A (DFU's ray would still strike an ally alone in front).
`test/scenes/fb0929_raidguards.test.js` (3), `tools/mutants/fb0929_raidguards.json` (5, 5 dead). `03-World/Raiding-Parties.md`
FB0929.

## RAID-GUARDS and RAID-REP: Mac's two follow-ups on the raids (6)

Mac, after FB0929: *"1. Raids shouldnt let you damage the guards 2. Town raids are supposed to improve the region the
player is at, need more testing but I think it improves rep in all regions kinda broken if so"*.

- **RAID-GUARDS.** While a raid is on in the town, its defenders take none of the player's blows, whatever the setting.
  `cityGuards.playerSpares` asks one question - a defender, under friendly protection or with a raid on here (the
  world host answers `raidHere` with `raidDefendingHere`) - and the swing's pass and the riding charge's list ask it,
  while the guards' damage door refuses any blow of the player's on a raid's defender by whatever road it came: it
  lands nothing and raises no Assault. The crime watch is never spared; with no raid on and the protection off, DFU's
  rule stands. Spells, shafts and thrown torches always passed a defender by. Online, a peer's watchman puppet can
  still flash under my swing, but its owner refuses the blow. `test/scenes/fb0929_raidguards.test.js` (now 5),
  `tools/mutants/raidguards.json` (8, 8 dead).
- **RAID-REP: checked, and not broken.** GrantReputation raises the raided region's legal reputation, its People and
  its first knightly order - for a player who fought and stands on the town's pixel - and no other region's. The one
  standing that is no region's is Kamer's +3 with the Fighters Guild, which the Standing page shows everywhere (the
  likely source of the impression). Pinned with the other region's factions first in the dictionary, so a law that
  forgot the region would pay them. `03-World/Raiding-Parties.md` RAID-GUARDS, RAID-REP.

## FB0929 (far route): the Overworld's line, cut to the screen (7)

The route was planned once, at the pick; the per-frame cost was its LINE. `routePath` drew one dashed SVG path through
every projected point of the journey, and a far pick is 139 legs and 557 points - a point beside the eye's plane
projects hundreds of thousands of pixels out, so the path ran about 1.5 million pixels and the browser laid some
100,000 dashes, off the screen too, and rastered them again every frame the camera moved: 383-433 ms a frame in
Chromium, the median. PERF-TV's probe had timed JavaScript and layout, never paint, over a route that stayed on the
screen. The line is cut to the screen grown by `ROUTE_CLIP_PX` now (`ui/travel/travelViewHud.js`): on the screen it is the
same line (byte for byte when it is all on screen), and a far pick draws in 16.7 ms. The planner and the journey are
untouched. `test/world/fb0929_farroute.test.js` (4), `tools/mutants/fb0929_farroute.json` (13, 13 dead),
`tools/travelViewPerf.mjs` times the frames now. `06-Systems/Travel-View.md` PERF-TV.

## VAMP-HOOD: a vampire with its hood up travels by day (2, the suggestion)

What stopped the vampire was never the sun - VAMP-DAY (2026-09-26) had already taken the burn away for a -20 by day.
It was the map's door: `vampirism.js` `racialFastTravelBlock` refuses fast travel whenever the clock says day, and the
Overworld's and Travel Options' walked journeys start behind the same door. Online the shared clock's day is one real
hour that no rest or trip shortens, and since REALM a realm character cannot slip offline to pass it - Dracula's "wait
1 hour to travel anywhere". Now `racialSunAverse` asks the hood: under a cloak or plain robes worn hood up
(`survival/temperature.js` `cloakState`, the felt temperature's one hood law) the door opens by day and an arrival is
not pushed to dusk; a bare head is refused with DFU's line and "Raise the hood of a cloak or robe to travel by day." The
day's -20 stays (it is the hour's, not the sun's). Port-Ledger A: Starempire42's suggestion, which Sir McMobdon called a good idea, sent in by Mac with the reports.
`test/systems/fb0929_vampirehood.test.js` (6), `tools/mutants/vamphood.json` (11, 11 dead). `06-Systems/Systems-Arc.md`
VAMP-HOOD.

## The benches (8): not reproduced

No code path the port owns shrinks a model in a dungeon. `rdbLayout.js` `getModelMatrix` is translation times three
rotations, as DFU's; the dungeon host adds only the block's origin and bakes it into the static batch; its only
models are the block's own placements (a custom model is one of Detailed Ships' stand-ins, none a bench); a mod's
dungeon block from JSON carries no scale; the gibs are sprites; nothing online stands furniture in a dungeon. What is
left is the data itself - the block may place a small furniture model at an angle, which DFU would draw the same way -
or a place that was not a dungeon (Detailed Ships' own records squash beds into bunks and benches to 0.58 below decks).
**Wanted: the dungeon's name, or a save standing in it**, and the block's furniture is listed against the real ARENA2
in minutes.



## CUSTOMS-GRANT: a character the census never saw, let in by a pass (Mac, later)

**What refuses him.** The only per-character gate on the way into the realm is customs' census: an offline character
comes in once, and only if the service holds a trace of it from before the realm began (migrations 0020 and 0022). The
census is frozen at the realm's start - that is what keeps a Copy to offline's new id out (AUDIT REALM L1-F5) - so a
character with no such trace is refused `customs-never-online` ("The realm has no record of this character from before it
opened"), and nobody had any way to let it in.

**Ruled out first, so a pass is not a band-aid over a bug.** Every table that holds a character id is already counted
(0022), with its time in seconds and a cloud backup's `created_at` kept across re-uploads; a cloud restore and an import
keep a character's id (only a legacy save, chargen, a classic import and Copy to offline mint one, each on purpose); and
the client's customs cap and the service's first-save check are one measure (`net/realm/realmGoldLaw.js`), so a character is
never left in a "Never saved" loop. What is left is a character the service never saw on this account - played online
with no kill, home, guild place, raid or backup, or with its traces under another account.

**The pass** (`06-Systems/Realm-Arc.md` CUSTOMS-GRANT and CUSTOMS-PASS, decision 9). This branch first let such a
character in by a handle list in the service's config (`CUSTOMS_GRANT_HANDLES`, with a `customs_grants` table). Main's
CUSTOMS-PASS (`Field-Bugs-2026-09-29b.md`, Mac: "Staff customs pass") landed the same day and does the same by a
developer's act: ONE character an account, once, through customs in full - loans, allowance, the account's bound - its
use on the record (`realm_passes`, migration 0024). The realm keeps one way past the census, not two, so the grant was
retired at the merge, never deployed, and ToxicTaco69 comes in on a pass (`node tools/customsPass.mjs ToxicTaco69`). A
character the census counts never spends one, and a character in from any account never comes in twice.

Pinned: main's `test/server/customspass.test.js`; what this branch keeps of it, the undo giving a spent pass back, is
`test/systems/house_loss.test.js`.

## HOUSE-LOSS: two roads took players' houses at customs (Mac, later)

**Reproduced first** (`test/systems/house_loss.test.js`, all seven failing before the fix), and each road run end to end on the
real Worker over the real migrations:

1. **The delete that took what customs carried - rows DESTROYED.** Customs carries the origin's online home, guild place
   and track to the realm's id in the census's own batch, before the first save is sent (CUSTOMS-CARRY). A first save can
   fail: refused (`customs-allowance`), too large (413, past 4 MiB), or lost on the way. The door then showed a "Never
   saved" tile whose one live button was Delete, and its own word for that state was "Delete it and make it again". The
   delete took the home, every piece and the hidden furniture (the tables' cascade), and left the census spent - so the
   character could never come in again. Live from 2026-09-29 03:09:50 UTC (CUSTOMS-CARRY on main) to this deploy.
2. **The deed stripped for an excess the gold could pay - the realm copy only.** Customs stripped whole deeds - a
   Daggerfall house bought at the bank, every piece bought for its room, the ship - before a coin of the bank or the
   purse (AUDIT REALM2 T3's order). Level 10, a furnished house, 60,000 in the bank: the house and all its pieces stayed
   behind, the bank stood. Any lone house at level 6 or below goes whatever the order (85,000 against 20,000 + 10,000 a
   level). The offline character keeps everything - customs runs on a copy - but customs is once.

**Fixed** (`06-Systems/Realm-Arc.md` HOUSE-LOSS): a customs whose first save never landed is undone by its delete -
home, pieces, hidden furniture and guild place back to the offline id, the census unspent, a customs pass given back - and the
door says "Undo bringing in" on its own route; and a deed goes only while the deeds by themselves are over the allowance,
the gold paying the rest - superseded the same day by RESTORE (below): customs takes no deed at all. Nothing else in the service deletes these rows (claims and placements are INSERT OR IGNORE, the
hidden list an upsert, the carries only re-key, sales and removals are the owner's own acts, no route deletes an account).

**Not the cause, but a risk to check:** the first-save check parses the whole save (about 7.5 ms a MiB in node). On
Workers' Free plan (10 ms of CPU a request) a first save past about a MiB would fail - a "Never saved" tile every time.

## RESTORE: everything the two roads took comes back (Mac, later)

Mac: *"I want people to get their stuff back"*, and, asked: the deeds **"Keep all, can't sell"**; the lost homes **"To the
offline character"** (`06-Systems/Realm-Arc.md` RESTORE, decisions 10 and 11).

- **Customs takes no deed again.** Every house, ship and piece crosses, marked; online the realm's bank buys none of it
  back, so it carries no gold past the allowance and there was never a reason to take it. Gold over the allowance is
  still the allowance's.
- **What customs took comes back from the offline save**, on evidence: customs emptied a deed's slot but left its room
  among the realm save's permanent scenes, where no sale ever leaves one - so a deed the offline character still owns
  and whose room the realm character still keeps is one customs took. Given back at the realm boot, into the save
  before anything reads it, and said once the world stands.
- **The online homes a deleted customs character took** come back from D1's history through a workflow run by hand
  (below): to the offline character, which can be brought in again, carrying them.

Pinned: `test/systems/restore.test.js` (6), `test/net/realm_restore.test.js` (5), T3's and HOUSE-LOSS's deed pins flipped;
`tools/mutants/restore.json` (45 mutants, 45 dead).

## For Mac

- **RESTORE - getting everyone's stuff back** (`06-Systems/Realm-Arc.md` RESTORE, decisions 10 and 11). Two of the
  three roads now mend themselves once this deploys; one needs you to press a button, twice.
  - **Houses, ships and furniture customs kept back** (road 2): nothing to do. When a player plays that online character
    in the browser or app that still holds its offline character, they come back - marked, so the realm's bank never
    buys them back - and the player is told. If GarySoup's house was a bank-bought one, this is his.
  - **Characters left "Never saved"**: nothing to do. Their tile says "Undo bringing in", which gives everything back.
  - **Online homes a deleted customs character took with it** (road 1): Actions tab -> **Realm restore** -> Run workflow,
    on main, at a quiet hour. Leave **apply** off the first time: the run's summary lists who gets what back, who is
    **held for you** (an account whose deleted character traded in the realm - bringing it in again would bring its
    items twice), and any building someone else bought since. Read it, then run again with **apply** on. The service is
    held for maintenance for about a minute while the database is read back to before the loss and put back; players'
    saves wait it out. If the run ever says THE PRESENT IS NOT BACK, the service stays held on purpose - type the one
    command it prints, and the next deploy lifts the hold. Needs D1 Time Travel to still hold 2026-09-29 03:09 UTC
    (thirty days on the Paid plan, seven on the Free one).
  - **Held accounts** are yours to decide; the homes of theirs the plan lists can be written by hand once you have.
- **ToxicTaco69 (CUSTOMS-GRANT, now a pass).** Grant him a customs pass, signed in as yourself (a developer):
  `DAGGER_HANDLE=<your handle> DAGGER_PASSWORD=<your password> node tools/customsPass.mjs ToxicTaco69` (the tool's header says the rest).
  Then he presses **Bring online** on his character's tile once. If what he saw was *not* "The realm has no record of
  this character..." - but "already been brought into the realm", or a "Never saved" tile - that is a different cause,
  and the pass does not touch it: say which.
- **The deploy.** Migration 0022 rides the account service's next deploy (it applies on the push to main, ACC1-CI): the
  census widens and every customs character already made takes its home and guild place at that moment.
- **Left open:** a home or guild place under an origin whose realm character was since DELETED still stands under the
  dead id (a building nobody can buy); 0022 moves nothing no realm character stands on.
- **The Fighters Guild's +3 for a cleansed town** is Kamer's and global - the one part of a raid's reward that is no
  region's. Say if it should go.
- **The hood** lifts the day's travel ban only; the -20 by day stays under it, a custom class's Damage from Sunlight is
  a chosen disadvantage and is not lifted, and no rule has guards spotting vampires, so a hood hides nothing from them.
  The unbound Overworld key never asked the sun at all.
- **A repair is floored too** (DFU groups it with Buy): a rank-9 Fighters Guild member's cheap mend costs a gold now.
  A cheap piece inside a dearer lot can still add nothing, because the lot is haggled once, as DFU does.
- **One test flaked once under load** (`test/server/realm6.test.js`'s end-to-end sale) during a full changed-files run; it
  passed alone and in 22 runs after, 16 of them at once. Noted, not explained.
- **MAGIC.DEF, not DFU's patched templates.** DFU 0.11.1+ builds magic items from its bundled MagicItemTemplates.txt;
  the port reads the player's own MAGIC.DEF. On an unpatched MAGIC.DEF a record could differ from DFU's.
