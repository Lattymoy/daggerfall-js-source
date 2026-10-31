# FIELD BUGS 2026-10-29f - the housing thread, the Gilded weapons, the off hand and Long Blade

Five #feature-feedback threads, handed over by the owner as screenshots: "Housing feedback & suggestions after 20 hours
of decorating" (twenty-two numbered items), "Gilded weapons lacking power", "Gilded Weapons" (a crimson glow), "long
sword, broad sword, saber don't mastering long blade", and a weapon dragged to the L-Hand slot. The owner: "No band aids.
Only return when finished". Read on main's `5995d0bb9` with the freeware's data, merged with main's `662b68634` and
`d9e485583`. Renumbered 29f at that second merge: main's FIELD BUGS 2026-10-29b to 29e took the earlier letters.

The housing thread's author struck items 1, 3, 4, 7 and 11 as done. Items 5 and 18 to 20 were not in the screenshots, so
this page says nothing of them. Item 21 (click a placed piece to move it) shipped with RPT1026-WORLD's DECOR-VERBS; its
bonus, the semi-transparent original, is DECOR-GHOST below.

| | Report | What it was | Done |
|---|---|---|---|
| 2 | "There are plants in 'outdoor', furniture in 'dungeons'" | A piece was filed by where Daggerfall stood it first | DECOR-KINDS |
| 6 | Wide Sentinel houses hold no more pieces than a small one | One cap, 200, for every house | DECOR-ROOMY |
| 8 | "Allow friends and guild members to rest in your house" | Only the owner's bed rested | REST-GUEST |
| 9 | "Make it possible to remove doors inside the houses" | Shipped; online, the door's removal lived in one save | DOOR-KEPT |
| 10 | Candles outside "shine like car lamps" | A yard candle took the street lantern's colour | CANDLE-DIM |
| 12, 14 | Buttons to move a piece along X and Z; "Allow SOME clipping" | No sideways step; a wall pushed a piece out | NUDGE |
| 13 | The "Inside the house" rule in houses with extending rooftops | The roof's walls were counted twice | EAVE-FOOT |
| 15 | A chain lamp's light inside the ceiling | The light stood at the picture's middle | LAMP-FLAME |
| 16 | "If two plots overlap ... the borders you see are just wrong" | The edge was the lot's rectangle, not its midline | YARD-BORDER |
| 17 | Two houses side by side, one owner | Their own midline split them | YARD-JOINED |
| 21 | The original semi-transparent while moving | The original vanished | DECOR-GHOST |
| 22 | Hide a stranger's decorations, for me alone | Only the town's vote hid a home | HOME-MUTE |
| - | Gilded weapons: enchantable, and a crimson glow | The item maker refused them; the glow read only the element | GILDED-MAKER, GILDED-GLOW |
| - | A weapon dropped on L-Hand moved the old off hand right | The drop wore the piece with no hand named | HAND-DROP |
| - | Longsword, broadsword and saber train no Long Blade | A one-hander alone in the left hand swung fists | HAND-FOLLOWS |

## 1. DECOR-KINDS - the catalogue by what a piece is

FOUND. `systems/decor/decorCatalogue.js` filed a piece the game files as nothing more by where it was met first: a
dungeon's piece was "Dungeon furniture", a street's "Outdoors". Over the freeware's blocks, the dungeons' 48 tables and
benches (ARCH3D 42500-42571) and 66 pieces of the house family were dungeon furniture, and the potted plants
(TEXTURE.213) and the crops and flowers (TEXTURE.301) were decorations or outdoor pieces.

FIXED. `systems/decor/decorCatalogue.js:"export function decorWhatKind(what) {"` files a piece by what it is first: each
picture archive the catalogue holds was looked at whole and named (FLAT_WHAT), the free-standing models by their editor's
tags (MODEL_WHAT), a model of the furniture families as furniture and of the exterior family as an outdoor piece. Four
kinds more: Statues, Tools, Animals, Remains. The plants join Trees and plants, as Houseplant and Crop (Daggerfall's
own words), apart from the climate's; two mixed archives are filed record by record (AUDIT FB1029f C2, C4). A street's plain piece is still a room's
to place (`inRoom`), whatever it is now filed as. The decorator's own lists file a piece the same way.

WHY THE PINS PASSED. DECOR-DUNGEON's pin held the throne and the statue as dungeon furniture: the law as written.

PINS: `test/systems/decor/decorkinds.test.js` (with a measure over every block), the DECOR-DUNGEON and DECOR1 pins
moved. Mutants `tools/mutants/decorkinds.json` (9, dead); DECORDUNGEON-kind-unset, DECORMODS-kind-unset and
DECOROUTDOOR-outside-indoors re-aimed by content, dead.

## 2. DECOR-ROOMY - a wider house holds more

FOUND. A house held DECOR_CAP, 200 pieces, whatever its size. The freeware's houses run from about 40 m2 of ground to
996 m2; Sentinel's widest are 655 and 983.

DECIDED. A room holds DECOR_CAP to 200 m2 of ground and as much more for each as much more, in tens, to DECOR_CAP_MAX
(600): `net/decorLaw.js:"export function decorCapOf"`. The ground is HOME-PRICE's measure, the one the
price is set from. The service measures nothing (it has no ARENA2), so a claim's ground is kept only where the price is
the one that ground and the town's blocks set (`net/homeLaw.js` homeGroundOk). The price and the blocks are the
client's word, as HOME-PRICE's price always was, so a forged client can name a wider ground (AUDIT FB1029f A2):
DECOR_CAP_MAX bounds it, and only the service knowing each town's blocks would close it.

FIXED. A claim keeps the ground (migration 0197). A home bought before names it once, from its owner's client, at its
first list read (`systems/decor/homeDecorCap.js`, the service's `op: 'ground'`). A home the arena moves carries its ground with its price. The list says the room's cap; a
placement and a batch hold it. An offline house holds its own ground's cap. The refusal names no number now.

PINS: `test/server/decorroomy_service.test.js`, `test/systems/decor/decorroomy.test.js`. Mutants
`tools/mutants/decorroomy.json` (29, dead).

## 3. REST-GUEST - who may rest in my home

FIXED. The owner's bar in their own online home has a chip, "Who may rest", that steps through Me, Friends, Party and
Guild. It is the home's own row among its pieces' access rows (`DECOR_REST_ID`, migration 0196), set and read as a
chest's is (`server-account/src/decorAccess.js`). A guest the row names is told so with the room's grants, and the
rest's bag stands their bed as the owner's: `systems/decor/decorGrants.js:"export const decorMayRest = (mapId, buildingKey) =>"`.
A guild's hall keeps its own law; its members already rest there. A home's rows end with it: a sale or a character's
delete clears them, a claim clears what no home holds, an arena move carries the rest row (AUDIT FB1029f A1).

PINS: `test/systems/decor/restguest.test.js`, the REST-GUEST test in `test/server/decoraccess.test.js`. Mutants
`tools/mutants/restguest.json`, dead. PIN MOVED: the four pins that read the rest's bag (homerent, seathall_client,
auditguild1d, fb1001_rent).

## 4. DOOR-KEPT - a room's doors kept online

FOUND. A swing door taken out (HOME-DOORS) was kept in the owner's save alone. Online, no visitor and no other device
saw it gone, and the service's list refused the door's name.

FIXED. A door's name rides the room's one list of what is taken out (`net/decorLaw.js` DECOR_BASE_KEY_RE takes
`intdoor:<record>`), stood whole by `scenes/decor/decorBase.js:"export function standRoomHidden(base, list) {"`. The
decorator writes the doors and the furniture in one write. The list sets the doors exactly, and an online home's save
record is never stood, so a door put back on one device is back on every one (AUDIT FB1029f A3).

PINS: the DOOR-KEPT test in `test/server/basehide.test.js`; `tools/mutants/doorkept.json`, dead.

## 5. CANDLE-DIM - a yard candle burns as a room's

FOUND. A yard's lamps were lit with the town lanterns' colour (YARD-LIGHT). A candle took it too, about four times a
room's candle on the same lane.

FIXED. A candle burns at its own colour and intensity, as a room uploads it (`render/enhancedLighting.js`
interiorLightColor), on the lane the world lights with: `scenes/homeYards.js:"function candleTone(l, on) {"`. A
lantern stays the town's.

PINS: `test/scenes/yardlight.test.js`, `test/world/audityardlight.test.js` (moved); their mutant lists re-aimed, dead.

## 6. NUDGE - sideways steps, and some clipping

FIXED. Four bar buttons and Numpad 4, 6, 8 and 2 push a piece along the level axis nearest the eye's left, right, away
and back, 5 cm a step, 1 cm with Shift or Ctrl and a grid step on the grid, at most 1 m each way (`systems/decor/decorPlacer.js:"export function decorNudgeStep"`).
The push is applied after WALL-CLEAR's clearance, so a piece may sit into a wall or another piece as far as its owner
chooses (item 14). A hung piece slides along its surface.

PINS: `test/systems/decor/nudge.test.js`; `tools/mutants/nudge.json`, dead.

## 7. EAVE-FOOT - a house is its foundation

FOUND. FB1009 HOME-FOOT asked whether a roof's ground lies inside the walls by counting the upright faces a ray from it
crosses. Model 252's upper wall stands in its ground wall's plane as a face of its own, so the ray crossed that side
twice: the 2 m under its west eave read as the house. On the same models the rooms read as yard where the other side
doubled. Of the 392 models Daggerfall's town buildings stand, the law now covers more ground on 228 (rooms read as yard) and less on 52 (eaves and overhangs).

FIXED. The walls that say what is under the roof are the ground floor's, a face whose foot is below YARD_ROOF_Y, and a
plane is one crossing: `scenes/homeYards.js:"const crossed = new Set();"`. AUDIT FB1029f B7: a plane is keyed by its
line, not where the ray crosses it, so two walls meeting at a V's point stay two crossings.

WHY THE PINS PASSED. HOME-FOOT's houses were one storey, one face to a wall.

NOT CHANGED (AUDIT FB1029f B8). One ray decides, so a portico open on one side reads as the house on some big manors
(models 512, 513, 858, 729 and kin: 113 to 1,352 cells before, 330 to 1,771 after). No cheap law reads them better; a
four-ray vote does worse overall.

PINS: `test/world/eavefoot.test.js` (with models 252, 205 to 208 and 340); `tools/mutants/eavefoot.json`, dead.

## 8. LAMP-FLAME - a lamp's light at its flame

FOUND. A lit piece's light stood at its picture's middle. A lantern on a long chain hung from a ceiling put it in the
ceiling.

FIXED. A TEXTURE.210 light's light stands where its flame is, a share of its height measured off the art for the
records whose DFU light hangs in the chain or the post (`scenes/decor/decorRoom.js` DECOR_LAMP_FLAME), else where the
room's own light of that record hangs, scaled with the piece. The yard reads the same law.

PINS: `test/scenes/lampflame.test.js`; `tools/mutants/lampflame.json`, dead.

## 9. YARD-BORDER - the edge where a piece may stand

FOUND. HOME-LINE splits the ground between two houses down its middle, but the marked edge was the lot's rectangle,
drawn over the neighbour's side.

FIXED. The edge is traced where a piece may stand - the lot, the road taken out, the neighbours' side of the midline
taken out - in half-metre cells cut exactly where two walls face each other, its staircases read as their slopes:
`scenes/homeYards.js:"export function yardStandEdges(lot, roads = [], lines = []) {"`. It is traced again only when
what it is drawn from moves.

AUDIT FB1029f. B1: every pair of walls was a cut, so a Hammerfell house traced for up to 4 s on the main thread; only
walls that face are cut now, at most YARD_BORDER_CUTS_MAX of them, and Sentinel's worst trace takes 38 ms. B2: the
trace is kept while the yard is, not signed over a pixel's lines each frame. B5: every line that can win a point of
the lot is read. B6: past DECOR_LOT_MARKS bands, the slopes are read coarser. B10: a cut a hundredth of a metre from
another is the same cut, so float noise draws no hairline band. On Sentinel, Daggerfall and Wayrest, no point more
than 0.9 m from the edge disagrees with the law.

PINS: `test/scenes/yardborder.test.js` (the drawn edge and the law agree over the lot); `tools/mutants/yardborder.json`,
dead.

## 10. YARD-JOINED - two homes of one owner

FIXED. An owner's homes whose lots meet join: no midline is drawn between them, so each yard reaches its own lot's
edge, and the other house is still a house (`scenes/homeYards.js:"export function yardJoinLots(lot, mates = []) {"`).
The line to a stranger is drawn from the nearer of the owner's houses. A guild's hall, a turned lot and a lone lot join
none. A piece never stands past the service's bound (DECOR_YARD_POS_MAX).

AUDIT FB1029f B3 and B4: a piece once stood on the other house's lot too. It was its own yard's, so a sale of the other
house left it in the next owner's yard, and a joined edge reached past the service's bound. A piece stands on its own
lot alone now. B9 (recorded): a capital's slices are each a map, so two homes across a slice's border never join.

PINS: `test/scenes/yardborder.test.js` (the real decorator over two houses); `tools/mutants/yardborder.json`, dead.

## 11. DECOR-GHOST - the original while it moves

FIXED. A piece picked up to move stays drawn where it stood, dithered to DECOR_HELD_SHOWN (a model through the
renderer's dissolve, a flat through its batch's), casting no shadow, until it is set down or the move is undone. A
hung piece shows no ghost: the decal pass has no dither (AUDIT FB1029f C5).

PINS: `test/scenes/decorghost.test.js`; `tools/mutants/decorghost.json`, dead.

## 12. HOME-MUTE - a stranger's home hidden for me

FIXED. At a stranger's door a row hides its decorations for this player alone: its paint, its yard and its room stand as
a shunned home's do (`systems/online/homeMute.js`). It is kept on the device by town, building and owner, so a new
owner's home is seen again. A player's own home and their guild's hall are never hidden.

PINS: `test/systems/online/homemute.test.js`; `tools/mutants/homemute.json`, dead. PIN MOVED: the HOME-VOTE, GUILD-YARD,
HOME-LOOK and DECOR1 host pins that read the old test.

## 13. GILDED-MAKER and GILDED-GLOW

FOUND. Since MAKER-RARE the item maker took an identified Rare, but a Gilded piece was refused three times: by name
(`itemMakerRefuses`), on the wire (`validGildedMarks`) and by the item law (`makerFindings`). In the hand its glow read
only its element.

FIXED. A Gilded piece is the item maker's, as a Rare is: its record's lines stay as minted, the maker's own rows are
laid beside them, and it keeps its name (`systems/enchanting.js:"export function gildedKeeps(item) {"`). A Gilded weapon
wears a crimson look of its own over its element, the Aura Armory's piece and the arcane look (weapon glow law 8,
`05-Combat/Weapon-Glow.md`; `06-Systems/Gilded.md` section 11). ITEM_LAW_VERSION 16, the account service acct225, the relay
world291 (law 15, acct220 to acct223 and world286 to world290 on its branch, renumbered at the merges of main). No line, rung or power number moves.

PINS: `test/systems/gildedmaker.test.js`, `test/systems/gildedglow.test.js`; `tools/mutants/gildedmaker.json` and
`gildedglow.json`, dead.

## 14. HAND-DROP - a drop on a hand fills that hand

FOUND. A pack weapon dropped on a hand's panel was worn with no hand named: DFU's GetEquipSlot put it in the first open
hand, else the right, and the drop then traded the whole pair. With both hands full, a drop on L-Hand replaced the main
weapon and moved the old off hand right.

FIXED. `equipItem` takes a hand, held to one hand law (`systems/equip.js:"export function mayHold"`); the drop names it,
and a piece the panel's hand cannot hold goes to the hand that holds it (AUDIT FB1029f D5). A held piece dragged to the other hand still trades places.

PINS: `test/ui/enhanced/offhanddrop.test.js`; `tools/mutants/offhanddrop.json`, dead.

## 15. HAND-FOLLOWS - Long Blade

FOUND. The three weapons are Long Blade's in the item table and train it. A one-handed weapon alone in the left hand -
a second weapon's free hand, an H swap, a drop on L-Hand - was never swung: the hand in use stayed the empty right, and
the classic lane swung fists, training Hand-to-Hand.

FIXED. When what the hands hold changes, an empty hand in use gives way to a lone weapon in the other
(`combat/playerWeapon.js:"if (changed && !restored) this.followHeldHand();"`). H still picks the bare hand after, and a
hand restored from a save is kept - one saved before this follows once. The swap key sets the hand where the
weapon lands, never toggles it, and its bare hands stay bare (AUDIT FB1029f D1, D2, D4).

PINS: `test/combat/handfollows.test.js`; `tools/mutants/handfollows.json`, dead. PIN MOVED: the left-hand, pistolet,
MW-HAND and JAN1 pins.

## The four hosts

HAND-FOLLOWS is the rig's own law (`combat/playerWeapon.js`), read by every host's rig. The housing fixes stand where
online homes stand: `scenes/world.js` (the paint, the yards) and `scenes/worldModes.js` (the room, the door).
`scenes/exterior.js` and `scenes/dungeonContext.js` stand no online home. `questFlatTargets` moved out of
`createWorldModes` to `systems/quest/sceneMount.js` to keep the host under its ceiling.

## The words

The twelve new lines (the nudges, the rest chip, HOME-MUTE's five, the full room's refusal) go through `t()` and are
drafted in every language that keeps a table, through `tools/l10nInSession.mjs`. The old refusal, which named the one
cap of 200, is gone from every table.
