# FIELD BUGS 2026-09-27g - a crash box, the guild tab, the decorator, the Empire's bank

Mac, with the Discord's list and a screenshot of a crash box. This page is the batch's record; each fix has its own
section below. The arc's own record is `06-Systems/Online-Arc.md` THE 2026-09-27g DISCORD BATCH. Mutants:
`tools/mutants/fieldbugs27g.json`.

The list, as it came:

1. *"Above #49 decorations stopped working. Most sprites decorations are invisable above this number"* - and the crash
   box: *"CRASH TypeError: m.rows.map is not a function at _u ... at yu ... at qh ... at Object.Eb [as frame] ... at Kc"*
   (the streaming world's bundle; `frame` is the building host's).
2. *"Some sprites flipped (allow rotation)"*
3. *"Some sprites not assigned morrowind skin"*
4. *"Guild issues. Buttons not selectable until closed and reopened. Depositing scretchs names a lot with a syllable on
   each line"*
5. *"For a house with multiple connects, add room switching tabs"*
6. *"Make crafting stations in interiors way more expensive"*
7. *"For online mode, the bank of daggerfall becomes the bank of the empire. The empire has come and has reduced loans
   substantially (90%)"*
8. *"Players can use magic in player non owned houses"*

## STATION-ROWS: the crash box (1)

`m.rows.map is not a function`, thrown from the building host's frame three calls deep: the activation, the placed
piece pressed, and a home station's use (`scenes/worldModes.js` useDecorStation). A Spellmaking station opens the spell
maker through the guild service dispatcher (openServiceFlow), and the spell maker's arm hands its WINDOW back - a
window that keeps the host's TEXT.RSC reader as `rows`. The station took "has rows" for "is a message", mapped the
reader as a list and threw on every press. The guild popup read the same answer the same way and pushed the whole window
onto itself as a message box.

A service's answer is a box only when its rows are a LIST now (`systems/guildServiceFlow.js` isServiceBox), asked by
the station, the popup's onService, the probe door and both popups' own pushes. `test/stationrows.test.js` (3).

## DECOR-MODFLATS: "Decoration 49" onward (1)

The decorate catalogue is read out of the world's own blocks, and the ships Detailed Ships lays in them carry its own
flats (archives 1210 and 1230) and the DET flats the port stands in (10009 to 10027) - 83 decorations in the live
game where the retail blocks alone give 28, measured in a browser over the retail data. A decoration is named by its
place in id order, so the mods' pictures were "Decoration 49" onward, after 254's, the last classic one. Two things
stopped them:

- The piece law's bound. `DECOR_ARCHIVE_MAX` was 999 (the port's own item pictures, 513 to 539, under it), so a mod's
  flat was never a piece: its ghost was never drawn (the tool draws a ghost only once it is a piece) and Place did
  nothing - the report's "stopped working" and "invisable". The bound is five digits now, 99,999, on the client and
  the account service alike (both read `net/decorLaw.js`; the service needs its deploy for an online home).
- The list's pictures, a race. The panel asks the DOM door (`ui/textureCanvas.js` loadIcon) for a row's picture and
  keeps a null as "none to be had". The door read its answer four turns after the classic archive's read: enough for
  a classic record, drawn at once when its file is read, but a mod's has no classic file - its read fails at once -
  and its picture decodes in its own time, so a row asked before the scan had decoded its archive could be answered
  none for good. The door waits for the picture now, landed or missed (a throw included).

`test/decormodflats.test.js` (5); the account service's own acceptance of a Detailed Ships flat, `test/decor1.test.js`.

## DECOR-FLIP: a picture turned half round faces the other way (2)

A billboard turns to the eye whatever its record says, so a placed picture's turn did nothing - a sprite that faced
the wrong way for the room stood that way for good. A placed flat turned more than a quarter either way is now drawn
mirrored (the renderer's flip is the sign of a batch's width), the ghost as it will stand, and the bar says what a turn
does to a picture. A hung mount spins on its wall and a model turns in earnest; neither mirrors.
`net/decorLaw.js` decorFlatMirrored. `test/decorflip.test.js` (3).

## MW-ASSIGN: the pieces the Morrowind item map never asked about (3)

With Morrowind data attached, a hung weapon or piece of armour is its Morrowind picture (MW-MOUNT) - but only what the
one item map could read, which was DFU's own weapons and armour. Three kinds stood as their classic sprites:

- The Thunderlock, the port's own weapon: its shipped model is drawn in the hand, but its icon and its wall mount
  asked Morrowind's records, which hold no gun. They take its own model now (`combat/fpArm.js` iconRecordOf).
- Roleplay & Realism Items' two weapons and twelve pieces of armour (templates 513-526): no row knew them, so they hung
  as their classic pictures, drew EMPTY HANDS in Morrowind first person and were bare skin when worn. Each resolves as
  the classic item of its shape (`formats/mwFirstPerson.js` MOD_WEAPON_TO_MW, `formats/mwItemMap.js` MOD_ARMOR_ROWS;
  a vambrace asks for a bracer, one side), worn too, and the census counts them.
- One's own garment set down stood as the classic pile of cloth (TEXTURE.204) though the item has a Morrowind record.
  It stands as its Morrowind picture on the billboard pass now, its ghost with it (`scenes/decorRoom.js`
  MW_STAND_ARCHIVE); a thing with no Morrowind record, and everything without a build, stands as its world picture.

`test/mwassign.test.js` (4). Chain armour other than the cuirass and greaves stays as the item map recorded it:
retail Morrowind has no such pieces, and the map says so rather than standing a wrong metal in.

## GUILD-LIVE and GUILD-WRAP: the Guild tab (4)

The Guild tab of the online Social panel. Its draft buttons - Found, Invite, Deposit, Withdraw, Rename ranks - were
enabled once, when the tab was built, and a keystroke rebuilds nothing under the caret: an amount typed left Deposit
dead until the panel was shut and opened, which is the only thing that rebuilt it. Each is a live button now, its state
read on every keystroke and on the live pass, and what a press does reads the draft at the press (Deposit had captured
the amount at the build). A roster row's buttons are one group that wraps below the name - the friends row's own fix
(MAIL1) - so a deposit, which puts "a moment" beside every button while it is out, no longer squeezes a guildmaster's
roster names to a syllable a line. `ui/socialPanel.js`. `test/guildlive.test.js` (3).

## DECOR-ROOMS: a house's rooms, as tabs (5)

The decorator's free camera starts at the eye, is leashed, and stops at every face (DECOR-SHELL), so a room behind a
shut door was furnished by shutting the decorator, walking there and opening it again. The house's rooms are found in
its own collider now, a few hundred rays a frame while the panel is up (`systems/decorRooms.js`): floors a body stands
on, joined where the rise is a step and nothing stands between them at waist height - a wall, or a door as it stands,
which is what the flight cannot pass. A house of two rooms or more gets a tab a room in the panel: the eye's own room is
chosen first, the room's placed pieces and own furniture are listed (and "Take all out" means the room's), and the next
flight begins over the chosen room's floor - a piece moved flies from its own room. `test/decorrooms.test.js` (5).

## STATION-FEES: crafting stations cost ten times as much (6)

DECOR_STATION_FEES: Alchemy 50,000 gold, Spellmaking 100,000, Enchanting 200,000 (were 5,000, 10,000 and 20,000). The
licence is still paid once and never refunded. `test/homestations.test.js`.

## EMPIRE-BANK: online, the Bank of the Empire (7)

Online, every bank is "The Bank of the Empire" - its door, the talk directory, the Enhanced Plus teller's title (its
town beneath), and a bank discovered before shows the name now on its door and its automap plate (the save keeps the
name a building was discovered by, so it is read live for a bank). The Empire lends a tenth of what the region's bank
lent: a tenth of DFU's level x 50,000, or of Roleplay & Realism's per-level loan (on by default, and kept on online),
rounded down. Interest (10%) and the year to repay are unchanged; offline, the bank is Daggerfall's.
`world/buildingNames.js`, `systems/banking.js`, `systems/discovery.js`, `ui/enhancedPorts.js`.
`test/empirebank.test.js` (4). Port-Ledger section A.

## HOME-MAGIC: a visitor casts nothing in another's home (8)

A visitor in someone else's online home - HOUSE-DROP's own test, a character of the same account included - readies no
spell (a free one, an item's, included), fires none (a spell readied outside is not fired inside) and casts no item's
spell on themselves: "You cannot cast spells in another's home." An item refused so spends no durability. Potions are
drunk as ever. The owner's own home, an offline house and every other building are as they were.
`scenes/hostMagic.js` castRefusal, `scenes/worldModes.js` visitorMagicRefusal, `systems/enchantments.js`.
`test/homemagic.test.js` (3). Port-Ledger section A.

## THE FOUR HOSTS

`world.js` hands its cast engine the building's word (HOME-MAGIC) and names its banks (EMPIRE-BANK, through the talk
directory, like `exterior.js`); `worldModes.js` (a building) carries the station, the decorator's flip, rooms and
standing pictures, the visitor's refusal and the bank's door name; `dungeonContext.js` has no home, bank door or
decorator and carries none of it, its own cast engine asking nothing; `exterior.js` (the offline viewer) has no online
homes and is offline, so its engine asks nothing and its banks are the region's. DECOR-MODFLATS is the piece law and
the DOM door, which every host reads alike.
