# FIELD BUGS 2026-09-30 - ten screenshots through Mac: the house sold for nothing, the woodcutter's lock, the respawn in the sky, the birth that went to the menu

Ten screenshots of the Discord - seven #bug-reports threads, a player's list sent to Mac, and a #dev-chat post - through
Mac, with no words of his own beyond them. The rule for a batch like it: every report root-caused on the real modules,
the port's own faults fixed and pinned, and what is Daggerfall's own (or a mod's) fixed as a declared departure when a
player named it a bug (Mac, of 29h's three: *"Dont worry abour DFU."*), with the call said plainly below for Mac to
take back. Six investigations ran first, each on the real modules with a reproduction; the fixes were built and pinned
one to a tag.

| | Report | Reporter | What it was | Done |
|---|---|---|---|---|
| 1 | "Sold House for 600 K, Got Nothing Back ... Got a strange message in my notes. I don't currently owe the bank anything" | Seanobi | a home customs carried into the realm (CUSTOMS-CARRY) was never paid for by a realm record (`homes.paid` 0); the door asked "Sell your home for 600100 gold?" off the client's price, the service paid the deed share of nothing and deleted the house and its pieces; the notes held "You sold your home. 0 gold went to this region's bank account." and a second press's "The account service had a problem. Try again." | fixed (HOME-CROSSED) |
| 2 | "Hardlocked in woodcutting animation after game Crash ... stuck in an endless loop of logging in" (account AteBitPixel; "Same") | Letherion, Shanewerewolf5 | not the chop: Foraging's Wood-Axe quest's online wait page ("Chop and Gather Wood...") held its quest boxes, and its end released them into a box that held itself again behind the other - a synchronous loop that hung the tab; the held record rode the save, so every login hung again | fixed (CHOP-WAIT) |
| 3 | "Respawning high in the air after death ... dying inside a dungeon and it would respawn me high above a nearby city" ("still happening", "Happened to me too") | lumin, itzHaikyuu, BEWP | a dungeon death read its pixel after the exit, through the open world's origin (a neighbour), and the teleport's frames fed the dungeon-frame eye to the streamer, which moved the new world a pixel over mid-build: the landing hung 40 up over nothing built - a 42-unit fall, 185 health | fixed (RESPAWN-GROUND) |
| 4 | "Crashing in the first dungeon after online character creation ... It did save both characters though and afterwards I could load them and play them fine" | Dwarfblood | nothing crashed: a character born online reloaded to `?online&load&realm=<id>`, which names no scene, so main.js's front door cleared it and showed the menu | fixed (REALM-BIRTH) |
| 5 | "saves dont save player velocity ... you can negate all fall damage by saving while falling right before you hit ground" | Skeptikali | DFU's own: the save keeps the feet and the pose, and every load's spawn clears the fall | fixed, a departure (FALL-KEPT) |
| 6 | "Still can't use my bag/Inventory on mobile" ("we dont really need paperdoll on phone or at least if it could be hidden") | BigBa..., QuinsmQuansm, Skeptikali | see PACK-PHONE | fixed (PACK-PHONE) |
| 7 | "Vampire hood on cloaks dont show hood is up or down making them think its a bug" | a player's list | see HOOD-SAID | fixed (HOOD-SAID) |
| 8 | "cant withdraw gold from guild over wieght limit ... should be able to take note of credit" | the same list | a treasury withdrawal was paid in coin whatever it weighed (up to 2,500 kg a move), and Roleplay & Realism's encumbrance is on online | fixed (GUILD-LETTER) |
| 9 | "Protect bystanders needs to work again - lost rep for no reason" | the same list | the menu's Protect Bystanders is DFU's MeleeAttackFriendlyProtection, which spares a pacified foe and an ally and, outside a raid, never a townsperson: a swing at a foe just past the reach landed on the townsperson on the look ray - Murder | fixed, a departure (PROTECT-FIGHT) |
| 10 | "The realm has no record of this character from before it opened ... And yes, I did go online with this one in an older build" (#dev-chat) | Dwarfblood | the designed door (decision 6 and CUSTOMS-PASS): a level-1 character that never backed up, earned Renown or held a home leaves no trace the census counts, and "ask the developers" is the staff pass; the one fault is that a character counted on ANOTHER account of the player's got the same "no record" | fixed (CUSTOMS-ELSEWHERE); a pass is Mac's |
| 11 | Climates & Calories: "The player characters temperature seems to never change ... gets to either "Scorching" or "Freezing" or "Soaked" etc and seems to never recover"; "Drinking beverages at an inn/tavern does not fill your hydration"; "Waterskins should be refillable at an inn/tavern" | the thread's author | see the C&C section | fixed, departures (CC-*) |
| 12 | "Bugged Brigandine Jerkin" | mememagikal, Rensic | PR #459 (MW-BRIG3, the steel brigandine fitted onto the wearer) - another session's, merged beside this batch | said |
| 13 | "Rep need a reset function for guilds / citys should he a base cost and become more expensive more someone had to re use" | the same list | the REP1-REP6 reputation overhaul (another session's, PR #464, merged beside this batch): a temple's penance buys five points of a region's law at 200 x n | said |
| 14 | "admin comman tp fix possibly? Have selected player cast anchor for..." | the same list | cut off in the screenshot | asked |

## HOME-CROSSED: a house no record paid for stays a house (1)

**Reproduced first** (the real `createOnlineHomes`, `sellOnlineHome`, `realmGoldAct` and `createRealmSession` over the
real Worker): the door offers "Sell your home for 600100 gold?", the service releases the house, the notebook holds the
player's two lines, and the account stays at 0.

**Why.** The door's price is the client's own (`homeRefund(housePrice(houseMeshRadius(bd)))`, worldModes.js
`openHomeSale`); the service pays `homeSaleRefund(home.paid)` (homes.js `realmRelease`, AUDIT REALM L1-F3 - never a
client-named price) and deletes the house in the same batch. CUSTOMS-CARRY carried every pre-realm home to its realm
character with `paid` 0 (migration 0020), and its note said such a house "sells for its `paid` (0)": sold for nothing,
house and pieces gone. The second line was the realm's `busy` - a second Y while the first sale was still out - which
the refusal table did not know and said as "The account service had a problem."

**The fix** - RESTORE's law for a deed (Mac: *"Keep all, can't sell"*), a home's now. The service refuses the realm
character's sale of its own house no record paid for (`home-crossed`, 409) before any record is written; another
character's house is still the batch's own `no-home`. The town's answer marks the caller's own such house `crossed`
(never another account's, never a price), the client keeps the mark, and the door says the bank's own words for a
crossed deed (`HOME_CROSSED_LINES`: "That came into the realm through customs. The bank of the Empire does not buy it
back. It stays your home.") and asks no price. A sale is one at a time a house (`sale-out`, silent - the first
answer speaks), and `busy` has its own sentence. `test/systems/online/fb0930_homecrossed.test.js` (5) drives the real service and
client; three older pins that held the zero sale were re-aimed (`auditrealm` twice, `fb0929_customs`; PIN MOVED) and
`auditrealm2_client`'s C6 mount handed the new word. `acct33`.

**Seanobi's house is gone from the database** (the release's DELETE ran). D1 Time Travel still holds it; putting it
back is Mac's (For Mac 1).

## CHOP-WAIT: a box the wait's end releases is shown (2)

**Reproduced first** (the real QuestMachine with ChopWoodQuest twice, the real `createForagingWait`, `showQuestBox`
lifted off world.js): the record after one tick is `{seconds: 24, label: 'Chop and Gather Wood', held: [box, box]}`,
and the page's end re-enters `showQuestBox` 100,000 times without opening anything - in play and after the reload.

**Why.** Online, the Wood-Axe's ChopWoodQuest raises time by 1:30 - Foraging's wait page (FORAGE4), no Escape - and
every quest box is held behind it; the held boxes ride the save (AUDIT 28 F6). The page's end released them, and a
released box is the host's `showQuestBox`, whose first question is the wait's `holds()`, true while any box is still
held: with two behind the page (two chops, each quest's find) the first went back behind the second and the second
behind the first, for ever, in one frame. The tab hung - the "crash" - and every login reopened the page and hung again
when it ran out.

**The fix** (`scenes/foragingWait.js`): `holds()` answers false while the release runs, so a box it runs is shown; one
release runs only the boxes held when it began, so it ends whatever a box does; a box that takes the slot still ends
the release, and the next is shown when the slot is free. A player already stuck sits out what is left of the page at
the next login and then reads the finds. `test/systems/quest/fb0930_chopwait.test.js` (3); two records re-aimed (FORAGE4-10,
AUDIT28-H6).

## RESPAWN-GROUND: a dungeon death wakes at its own door, on the ground (3)

**Reproduced first** (the real StreamingWorldState, floorLanding, Collider and PlayerMotor, the host's heightAt and
playerTravelPixel lifted): a dungeon at 300,250 and a body at [-20, -3.5, 12] - the pixel read after the exit is
299,250; the first frame of the wait moves the new world 819.2 over; the landing goes from 22 to 62 over an unbuilt
pixel, and the motor lands a fall of 42.00 - 185 health.

**Why - two faults of a death in a dungeon.** `respawnOnlinePlayer` read its pixel after `forceExitToExterior`, and
`playerTravelPixel` answers a dungeon's entrance only while the dungeon is mounted: after the exit it read the
dungeon's own coordinates through the open world's origin, and a body west or south of the dungeon's corner woke on the
neighbour (a nearby city). And `_teleportToPixel`'s awaited build ran frames that fed `cam.pos` - still the dungeon's
coordinates - to the streamer; outside the new pixel's square that is a pixel change, the new world moved a pixel over,
and the landing (reckoned on the pixel at its unmoved place) stood over nothing built: the floor ray found nothing and
the arrival hung ARRIVAL_LIFT up, TL2's edge landing the same. The second death, outdoors, lands right: an open-world
eye is always on its pixel.

**The fix** (`scenes/world.js`): the pixel is read with the drowned dungeon's return point, before the rise is
scheduled; and an eye off the new pixel's square is stood on its centre before the build is awaited (the body too, in
walk mode) - which covers Recall, a quest's teleport and the cemetery out of a dungeon as well. `test/player/fb0930_respawnground.test.js`
(2); `oh_abyss`'s B5 pin re-aimed.

## REALM-BIRTH: a character born online boots the Online door's Play of it (4)

**Why.** Nothing crashed. `realmBirth` makes the character at the service, saves it at sequence 1 and reloads to
`realmBootSearch`'s `?online&load&realm=<id>` - and `main.js` boots a game only on a scene door; with none the address
was the front door's, which clears every boot key and shows the menu. The make and the save had landed, so the Online
door's Play (which never reloads: it boots the world host in its own page, the classic start decided beside the
realm's three keys) booted the same character fine.

**The fix** (`systems/realmSaves.js`): `realmBootSearch` builds that Play key for key and names its host (`classic`,
`world`); the boot joins the character and takes the load arm, so the save chargen left in Privateer's Hold is the one
that loads. A reload of that page (F5) goes back into the character rather than to the menu. `test/systems/fb0930_realmbirth.test.js`
(2) runs `main.js`'s own scene doors and front-door decisions and `realmBirth`'s reload expression; `realm3` re-aimed.

## FALL-KEPT: a save taken mid-fall lands the fall (5)

DFU's own (its PlayerPositionData keeps the feet and the pose; LoadGame cancels movement, clearing the fall; DFU refuses
no save in the air - only the rappel). A 50 m fall saved in its last metre loaded as a metre's drop from rest: 0 health
where it was 225. Online the same hole was the closed tab, whose save is the realm's checkpoint.

**The fix, a declared departure** (Port-Ledger A): the motor's `fallSnapshot` records how far above the feet the fall
began and the body's speed, both composers carry it in the pose (the world's for the street and a building, the mode
machine's for a dungeon), and `restoreFall` lands it after the placement's spawn - only where the save stood (the
street, the building re-entered, the dungeon's saved position; the door-less reposition and the start-marker warp carry
none). Both are bounded by the world's tallest drop (MaxTerrainHeight x TerrainScale, 1,923.75 m) and that drop's speed
from rest, so a torn save stands no fall the world does not hold; a torn or absent record lands as every save did. The
re-skin hold's release keeps a fall across its re-anchor. Saving in the air is not refused: a refusal would skip the
quiet saves (the checkpoint, the page-hide save, the exit autosave) and lose their progress. `test/systems/save/fb0930_fallkept.test.js`
(8); ten older pins re-aimed to the pose's new field.

## PACK-PHONE: the stacked pack's region gives way, and the body is a choice on a phone (6)

**Measured first** (Chromium, the real Enhanced Plus pack, a 440x736 figure standing in for the paperdoll's 4x art):
a phone on its side (915x412) had a 0px list and no tile in reach; upright (412x915) the worn panels' columns were 0px
and the list 8px; a tablet upright and a 900px mouse window read 0px too. PX31's "THE PHONE IS NOT THIS PROBLEM" was
measured with no ARENA2 behind the page - no doll art.

**Why.** Under the 1000px column layout the pack is stacked, and PX22 held its character region at its content's
height in a window capped at `min(660px, 94dvh)`; the dock took what was left. The doll's cell is height-driven in a map
whose rows are `auto`, a height that resolves to nothing, so the sprite stood at its bitmap size and nothing was left.
U53's phone order rule had ordered nothing since PX19f wrapped `.charcol`.

**The fix** (`ui/enhanced/enhancedStyle.js`, `ui/enhanced/enhancedInventory.js`, `systems/uiPrefs.js`): under 1000px the region shrinks
and scrolls on its own, the dock grows from nothing to at least 45% (the item count never sizes it), and the doll is
capped at `min(34dvh, 240px)`. On a touch phone the body is hidden until the header's **Body** shows it, the choice
remembered on the player's own shelf (`packPhoneDoll`); the worn panels take the doll's column and keep every act, the
tab strip is one row, and on its side the phone is two columns. The dead U53 rule is gone. `test/systems/fb0930_packphone.test.js`
(5); the layout probe (`tools/enhancedPackLayoutProbe.mjs`, rebuilt - its front door was gone) measures seven phones, a
tablet, a narrow mouse window and the desk: 63/131 checks before, 131/131 after (a 915x412 list 0px to 237px; 412x915
8px to 362px; the desk unchanged at 446px).

## HOOD-SAID: a worn cloak's hood is raised and lowered on its card, and the pack says so (7)

**Why.** VAMP-HOOD opens the day to a hooded vampire, and the door's hint named a "Raise the hood" button that did not
exist. The Enhanced Plus card offered Use, which is DFU's NextVariant: a casual cloak stepped hood down, UP, UP, down,
down, UP a press at a time, `useResultAction`'s `repaint` was never read (the doll kept the old drawing), and the card
closed saying "Worn yes" whatever the hood was.

**The fix** (`systems/useItem.js` `toggleHood`, `systems/survival/temperature.js` `hoodCapable`/`hoodUp`,
`ui/enhanced/enhancedInventory.js`, `systems/vampirism.js`): a worn cloak's or plain robe's card carries **Raise hood** /
**Lower hood** in Use's place and a Hood row, as a light carries Light and Lit; a press moves the garment to the same
drape's other drawing (`variant ^ 1` - the felt temperature's tables pair the drawings, one hooded in each), says "You
raise your hood." / "You lower your hood.", redraws the doll and keeps the card up; a raised hood puts a chip on its
panel; an enchanted hooded cloak keeps its Use for its Used payload. The hint names the skin's own button. The classic
window is DFU's and unchanged - it redraws its doll at every drawing. `test/systems/fb0930_hoodsaid.test.js` (4); three older
pins and three records re-aimed.

## CC: Climates & Calories - six departures from the mod as read (11)

**Traced first** (the real `createPlayerTicker`, offline and online): the minute law is not stuck - the felt
temperature is recomputed every minute from scratch and every host feeds it (a reading of 50 outdoors went to 20 a step
inside). The rules held it in the red and amber and said nothing on the way out: indoors read half the climate and the
season and never the hour (a desert inn at 23:00 read 35, Hot, while its street read 5); clothing only ever added
warmth, at full weight in any heat (the starting kit's shirt and pants are fifteen degrees); the need lines speak only
when a stage worsens (the Tiers' third pass), so warming or drying was never said. A drink took forty off a thirst that
runs to 150 and its quarter hour climbed again: a desert inn's juice read 150, 127, 103, 80, 57 - four paid cups to leave
the red, the Casual loan owed through three. No source of the mod's (the bundle carries a DLL) names a tavern refill.

**The fixes** (`systems/survival/tavernMenu.js`, `temperature.js`, `needs.js`, `ui/tavernWindow.js`,
`ui/enhanced/enhancedTavern.js`), each a declared departure (Port-Ledger A) but one:
- **TAVERN-DRINK**: a drink quenches the thirst whole, whatever its kind, as a meal fills the stomach whole; its
  drunkenness by kind and its quarter hour stand, and the Casual loan comes back in the same pick. The desert juice:
  150 to 12.5 in one cup. `test/systems/survival/fb0930_cc_drink.test.js` (3).
- **INN-WATER**: every tavern menu - the classic picker and the enhanced list - opens its drinks with "Fill your
  waterskins", at the list's cheapest soft drink (2 gold at quality 10), the fountain's own law (`drinkAtSource`: every
  skin filled, the thirst quenched, its words, no time passed); refused before any coin moves with "You carry no
  waterskin." or "Your waterskins are full.". Tavern rows are no realm act; the water pays as the others do.
  `test/systems/survival/fb0930_cc_innwater.test.js` (4).
- **MENU-CLIMATE** - the port's own fault: `MENU_KEY_BY_CLIMATE` was written 224-233 over climates that run 223 (Ocean)
  to 232 (Haunted Woodlands), so every climate served the menu of the one before it - Sentinel's desert the bay's
  bananas, the mountains the desert's camel milk, the Ocean the default. Keyed by the enum's names now, each the menu its
  number was written for. `test/systems/survival/fb0930_cc_menuclimate.test.js` (2). [AUDIT C&C I8 (2026-10-12): the table is the mod's
  own climate fallback now, behind the region (`regionMenuDay`) - the Ocean the default, the mountains the North's.]
- **ROOF-SHELTER**: inside a building the natural temperature is the milder of the street's own now and the roofed half
  (a tie the roof's) - a roof never makes it hotter or colder than the street. The desert inn at 23:00 reads 5, at noon
  27 (warm); a mountain inn keeps its roof's -30 against a street of -60. Underground unchanged.
  `test/systems/survival/fb0930_cc_roof.test.js` (3). [AUDIT C&C T4 (2026-10-12): the milder by size picked across nought, and a
  warmer street read colder inside - it is the street's own reading softened to the roof's size now, never across
  nought and never harsher than the street. T9: the mod's published source reads the climate, the season and the hour
  indoors, with no weather and no halving, and charges no temperature indoors at all.]
- **CLOTHES-BREATHE**: above a natural ten (the warm word's line) clothing counts at half its warmth, truncated, before
  the wet eats it; the cold and armour unchanged. `test/systems/survival/fb0930_cc_breathe.test.js` (2). [AUDIT TEMP-UI E7
  (2026-10-12): the half came at once, so a warmer world read cooler - it eases in now, a degree less a degree past
  ten, never past half.]
- **WARM-SAID**: leaving scorching for a stage that is not red says "You are cooling down.", leaving freezing or deadly
  cold "You are warming up.", and a soaking dried "You have dried off." - once a recovery, the improving stages still
  silent. A Woodlands winter soak, then an inn: "You are warming up." at 22 minutes, "You have dried off." at 79, and
  comfortable. `test/systems/survival/fb0930_cc_said.test.js` (3).

Older pins re-aimed: `surv5_ui` (the drink, the menu keys), `survtiers` (the order call), `surv1_model` (the hood's two
reads), and two `survtiers` records.

## GUILD-LETTER: a withdrawal the pack cannot carry comes as a letter of credit (8)

A treasury withdrawal was paid in coin whatever it weighed: the Guild book credited the purse through `addGold`, the
service the record's through `creditSave`. The treasury now pays as the trade window does (`sellProceeds`): the wallet
weighs the coin against the live carried weight and ceiling before the service is asked, and what the pack cannot carry
comes as a letter of credit worth the whole withdrawal, no commission. One maker in the shared law (`realmLetterOfCredit`,
pinned equal to the game's own letter) writes it on the record and in the pack; the service reads nothing but `true` as
a letter and moves the lit light's index with the pack; the Guild tab says the trade window's line. The reporter's
parenthesis - gold put in before the realm - is AUDIT REALM L1-F3's law (a realm character takes out only what realm
characters put in), unchanged; its refusal now says the rule. `test/systems/fb0930_guildletter.test.js` (6); four records
re-aimed (`guild1b`, `realm5`). `acct33`.

## PROTECT-FIGHT: under the protection, a fight spares the street's walkers (9)

The menu's Protect Bystanders is DFU's MeleeAttackFriendlyProtection ("Protect Friendlies and Neutrals"), which spares
a pacified foe and a PlayerAlly - `friendlyProtected` - and, since RAID-GUARDS-NPC, a raid's walkers; outside a raid
the world host offers a swing to the watch, then the monsters, then the civilians, so a swing at a foe just past the
reach (2.6 m) landed on the townsperson on the look ray: Murder (-20 of the region's law at the arrest) or, a walking
guard, Assault, a watchman minted and every defender turned. "Again" is no regression: every change to the setting's
reach (FB0929, RAID-GUARDS, RAID-GUARDS-NPC, AUDIT 29g) widened it, for raids.

**The fix, a declared departure** (Port-Ledger A): under the protection, while enemies are near - the rest's own
GameManager.AreEnemiesNearby over both street pools (`fightHere`) - the walkers are passed by as a raid passes them,
the swing stopped on them; with none near a blow at a townsperson is meant (a vampire's feeding, the Brotherhood's
count, pinned by `disc10_lycan`/`disc10_vampire`) and DFU's rule stands, as it does with the protection off. The
fixed-city host's riding trample asks the same rule as world.js's (it took the walkers unfiltered). The passive
Conspiracy levy that followed a first mark is retired by REP1 (#464). `test/scenes/fb0930_protectfight.test.js` (2); two
RAID-GUARDS-NPC records re-aimed.

## CUSTOMS-ELSEWHERE: a character counted on another account is told so (10)

The door is as designed (Realm-Arc decisions 6 and 9): the census counts what stood before the realm (0020, 0022), and a
level-1 character that never backed up, earned Renown or held a home, guild place or raid leaves nothing it counts -
its local save proves nothing, being the client's. "Ask the developers" is the staff pass (`tools/customsPass.mjs`),
which lets it in with the loans called and the allowance applied. The one fault: the census counts a character under
the account it went online with, and one character played on two accounts (a guest in one browser, a handle in
another; the desktop app beside the web) got "no record" - sending the player for a pass they did not need. Customs
names that case now (`customs-other-account`, 403: "The realm knows this character from another account - the one you
played it online with. Sign in with that account to bring it in."), and a character already brought in from any
account is `customs-already`; the gate (customsRealm's one guarded write) is unchanged. `test/net/fb0930_customselsewhere.test.js`
(1); `realm1`'s stranger line and one `customspass` record re-aimed. `acct33`.

Pins: `test/fb0930_{homecrossed,chopwait,respawnground,realmbirth,fallkept,packphone,hoodsaid,guildletter,protectfight,
customselsewhere,cc_drink,cc_innwater,cc_menuclimate,cc_roof,cc_breathe,cc_said}.test.js` (55), each red on the code
before it. Mutants: the sixteen `tools/mutants/fb0930_*.json` of the same names, 191 records, 191 dead (FB0930-FOE-RAYS, #463,
is another session's batch of the same day). `acct33` (HOME-CROSSED, GUILD-LETTER,
CUSTOMS-ELSEWHERE); the relay is untouched.

## Said, not changed

**12 - the brigandine.** PR #459 (MW-BRIG3) fits the steel brigandine onto the wearer's Morrowind torso; another
session's, merged beside this batch.

**13 - a reputation reset.** The REP1-REP6 overhaul (another session's, PR #464, merged beside this batch) has it: a temple's penance
buys five points of a region's law at 200 x n, a standing below zero recovers a point every seven days, and the passive
Conspiracy levy - the "lost rep for no reason" that follows a first mark below -10 - is retired.

## For Mac

1. **Seanobi's house (1).** The sale deleted it and its pieces before HOME-CROSSED; D1 Time Travel still holds the rows.
   Putting it back is a restore of one home and its `home_decor` (the realm-restore workflow's machinery, aimed at one
   row), or a price paid in its place - yours to choose.
2. **Dwarfblood's Tabby the Sneaky (10).** If it was never online on another of their accounts, the realm has nothing
   of it, and the designed door is a staff pass: `node tools/customsPass.mjs <their handle>`.
3. **The departures, to take back if you want them back:** PROTECT-FIGHT (a fight spares the walkers), FALL-KEPT (the
   fall rides the save), and Climates & Calories' five (a drink quenches whole; an inn fills a skin at its cheapest soft
   drink; a roof shelters; clothes breathe above ten; a recovery is said).
4. **"admin comman tp fix possibly? Have selected player cast anchor for..." (14)** is cut off in the screenshot - the
   rest of it, and it is built.

Found on the way, not changed: the standalone `?dungeon` dev scene carries no fall in its pose (FALL-KEPT is the three
play hosts'); on a phone the pack's overall armour plaque hides with the body (each panel keeps its own number); the
Plus card no longer steps a cloak through its drapes (the classic skin's Use still does); a page born online reloads
(F5) into the character rather than to the menu.
