# THE MATERIALS BAG - what a gatherer carries (BAG1, 2026-10-03)

The port's own (DFU has no professions, so no bag for them): a bag the player buys at a General Store, carried as DFU
carries the wagon - a second list beside the pack, with a weight it may not pass - and the end of "every harvest goes
straight into the Stores". Online only; a Ledger A departure (`01-Overview/Port-Ledger.md`). Its law is
`src/net/bagLaw.js`, the save's hands `src/systems/materialsBag.js`, the book's flows `src/net/profBook.js`, the
service's count `server-account/src/professions.js` and `motherlodes.js` (migration `0076_materials_bag.sql`).

## Asked

From the Discord, LostMyLeg: "implement a crafting mats bag that gets handled like the cart in an extra slot. It
shouldnt carry unlimited weight but quite a lot" - "make the bag available in every general store for like 500g" -
"Aslong theres no bag the mats just go into the players inventory". Mac: "So I definitely like this idea instead of the
current go straight into your storage. Like having a new player actually buy the crafting bag, and still allowing
crafting materials in the inventory itself." And: "This is something I really want you be detailed on and focus."

## 1. The bag

- **An item**, template **600** (the professions' reserved range, Professions-Arc 4.8 - unused until now): "Materials
  Bag", DFU's own Backpack picture (ItemTemplates 89: TEXTURE.205 record 44 - law 6, the picture is DFU's), weightless
  as the Small Cart is (`hasNoEncumbrance`), one to a slot. **Owning one is holding one**, as DFU's HasCart reads the
  cart in the pack.
- **Bought** at every General Store, online, after the horse and the cart (`systems/shopStock.js`) - on every shelf,
  whoever stocks it, as the horse and the cart are (BAG-SHELF, section 13: the first shelf alone, left off for a
  character who carried one, hid it - a shelf's stock is the room's for the day); and it never sells out - a bag bought
  is back on its shelf, online, and no shop buys one back (ENDLESS-STOCK, section 13); one to a character - a second is
  refused by the take ladder and the keyed shelf (ONE-BAG, section 13). Its base price is **250**; DFU's shop price is 2 x (cost x (quality - 10) / 100 + cost), so **500 gold**
  at a middling shop and 456 to 550 by the shop's quality (1 to 20), before the region and the haggle - "like 500g".
- **It holds 300 kg** - two fifths of a wagon's 750 (`BAG_KG_LIMIT`): "quite a lot", never unlimited. A day's Logging
  (60 trees of 2-4 logs at 2 kg) is about 360 kg; the bag holds most of a day in one craft.
- **Only materials go in it** - an item whose group and template are those a material mints as. The map from an item
  back to its material is BUILT BY MINTING every material once (both of a food's skins, Climates & Calories on and
  off), so the bag's rule and the mint can never disagree about what an Oak Log is. A quest's piece, a summoned one, a
  worn one or an enchanted one is never a material.
- **Its own list**, `entity.bagItems`, beside `wagonItems` - in the save (`systems/save.js`: snapshotted, restored,
  repaired and swept for orphans with the rest), counted by the realm with the pack and the wagon
  (`net/realmGoldLaw.js` carriedItemLists, `systems/realmCustoms.js`). Its food rots as the pack's does
  (`survival/needs.js`), and a food on its way to putrid is no longer the material the mint makes.
- **The cart's own rule**: a bag that holds anything never leaves the pack - not dropped, stored, sold or given
  (`itemTransfer.js` planStore, `tradeModes.js` localClickDecision: "Empty your Materials Bag first."). And the bag
  never goes to another player or the guild's vault at all (`tradePack.js`, `realmTradeLaw.js` tradeableRecord): its
  list is its owner's save's.

## 2. The window

The enhanced inventory's remote pane shows the bag as it shows the wagon (`ui/enhancedInventory.js`,
`systems/inventorySession.js`): a **Materials Bag** button in the pane's header (no bag: "You have no Materials Bag.
Every General Store sells one."), the bag's list as the remote list while it shows, its 300 kg on the weight line,
**Put in bag** on a material's menu (never on what the bag refuses), a move refused past the weight in the companion's
pack's words ("Your Materials Bag cannot carry any more."). The bag and the wagon never show together; the bag is no
floor (a house's word against a drop never reaches it); no gold goes in it; it never opens over a reward tray (a piece
taken from the side window there is the reward chosen). With nothing beside the pack, the bag's button stands on the
pack's footer. `REMOTE_TARGET_TYPES.Bag` (4) is the port's own, after DFU's four.

DEPARTURE: the classic skin's inventory is DFU's own window, every rect cited (THE NATIVE-WINDOW RULE), and it has no
slot for a bag pane - there the bag is reached from the Stores page (section 4), whose Put everything in, Take out and
**Empty your bag into your pack** work on either skin (CLASSIC-PAGES). Nothing is lost: what the bag holds counts as
held at every station, and anything in it - a food that rotted there, which no Put in takes - comes out into the pack
from the Stores page, anywhere (the second audit's H1).

## 3. Where a harvest goes

A carrying client's harvest (`carry: true`) is the bag's and the pack's - never the Stores':

- **The bag first**, as many as its weight allows; **then the pack**, as many as the character's own carry allows;
  **then the pack past its weight** - every unit the service counted is made, as a withdrawal's is (6), and said ("+4
  Oak Logs to your pack - your pack is over its weight"; beside the enhanced skin's haul card, "Your pack is over its
  weight. Put materials in your Stores in any town, or carry them in a Materials Bag."). No bag: the pack alone -
  LostMyLeg's "the mats just go into the players inventory". (PACK-OVER, section 13: what had no room was left where it
  was gathered, and a loaded character with no bag gathered goods it never saw.)
- Every gathering kind names the material its goods are (a herb by its region, a tree's logs, a vein's ore, a foe's
  hide, a haul's fish), so the request says what the bag and the pack hold of it; the Basket's food and a boulder's
  stone are the service's roll, and name none.
- The first harvest of a session says so once: "Gathered goods go into your Materials Bag, then your pack. Every General
  Store sells the bag." The haul card's tag reads **Carried 41** where it read Stores 41.
- A node whose goods have nowhere to go says **No room in your bag or pack** where it said Stores full - the act
  refused before it starts, as the Foraging mod refuses one when fully encumbered; what a started act yields is never
  weighed again.
- The service keeps the older door: a client that does not say `carry` still harvests into the Stores, as before.
- A Motherlode's strike is the same (`motherlodes.js`).

## 4. The Stores, in town

The Stores stay the character's storage - and are **kept in town** now: put in and taken out in any town, on its
streets or in any of its buildings (DFU's IsPlayerInTown with mustBeInLocationRect, not mustBeOutside; never below
ground - `scenes/world.js` `_storesReached`). Away from one the page reads, and says "Your Stores are kept in town. Go
to any town to put materials in or take them out." **The town is the client's convention, not the service's law**: the
service checks no place, and a station's shortfall is put in wherever the station stands (section 6).

The Stores page (`ui/profPages.js`; the pause menu's Holdings tab since HOLDINGS, `03-World/Holdings.md`) shows each
material's Stores count and, beside it, what is carried; for a
material, **Take out** (into the bag, then the pack) and **Put in** (from the bag, then the pack), and **Put everything
in** - every counted unit the bag and the pack hold, in one press, whatever the page's filter shows: it says how many
went in and names each material refused (its Stores full) and goes on past it; the counting-house's silence ends it.
Put in and Put everything in stop at the Stores' own room (5,000 a material, every origin), and a full material is said,
never asked; why Take out or Put in is shut is drawn under the bar, not only on a title (the second audit's U1, U14).
**Empty your bag into your pack** stands on the page, in a town or out of one, whenever the bag's list holds anything:
every piece, as much of each as the pack's weight takes, what no Put in takes first (a full pack never leaves the jam
behind).

## 5. Law 3, restated - the carried count

Law 3 (Professions-Arc 1): "a material withdrawn to the pack becomes an ordinary save item and never goes back:
nothing edited into a save can be laundered into the server's economy." A bag whose goods go back into the Stores
reopens exactly that door - unless the service knows what it handed out. So it counts:

- **`prof_carried`** - per character and material, by origin (own, bought, gold, as the Stores keep them): what the
  service handed to the save that has not come back. A carried harvest adds to it; a carried withdrawal moves units
  from the Stores into it, each under the origin it left as; a deposit moves them back, each origin as it was.
- **Every act that reads it first cuts it to what the client says it holds** (`held`, the bag's and the pack's items
  of that material together) - gold's units first, then bought, then own, the order a withdrawal fills the pack in, so
  the goods walled from every Marks act go first and a character's own (which raise a seat's influence) last. **It is
  never raised**: a pack holding more than the count adds nothing.
- So a save-edited Red Rose, a looted one and a gathered one are one item in the pack - and **only the gathered one is
  counted**. A deposit by the Stores page, a writ or the market never moves more than the count, and never gold's to a
  station. What enters the Stores from the bag by those doors is exactly what the service handed out: law 3's
  guarantee, kept with the door open one way more. A station's own put-in is the exception, by the owner's word
  (BAG-CRAFT, section 14): it moves what the pack holds past the count too, as **loose** - a station's alone (section 15).
- A lie about `held` can only cut the count, never raise it. **What it bounds and what it does not**: a client may say
  it holds more than it does - a pack that sold three Red Roses saying it still holds them - and the count is then not
  cut; those units stay counted and may be deposited. That is not prevented. It is bounded: never past what the service
  handed out, so nothing enters the Stores the service did not put into the save. The count is a ceiling, not a census.
- **Only against the count the client heard** (the audit's B2): a request says, beside `held`, `seen` - the count as
  the client last heard it - and `heldKey`, the material the held count is of. The service cuts only where its count is
  that `seen`. When the count has moved since (a kept act's units counted with its answer lost, a second request in
  flight), the pack does not yet hold units the count has, and the cut is skipped - never the units lost. The decision
  is taken once a request, at the head of its own batch (`prof_carried_gate`), and an older client that says no `seen`
  is believed as before. `held` is read when the act is asked, never when it was kept, with a deposit's units still on
  their way counted as held. The wagon counts as held too. **And never under the count as heard while another carried
  act is kept** (the second audit's K2): a state read makes `seen` the service's own, and a kept harvest's units, landed
  and not yet minted, would be cut - so while one (or a kept withdrawal of the material) waits, the book says the count
  itself as held, which cuts nothing. The act being asked is not pending for itself.
- **A carried harvest's row is kept thirty days** (`CARRIED_ROW_DAYS`; a Stores harvest's two, as before): it is the
  answer a kept harvest asked again is given, and only that answer mints its items (the second audit's S1).

## 6. Stations, writs and the potion maker

A station spends the Stores, as it always has (the service's SQL is unchanged). What it lacks, the client puts in
first from what is carried (`profBook.ensureInStores`): every input's shortfall covered before any moves, the counted
units bought before own, then (BAG-CRAFT, section 14) what the count does not hold, never gold's (`DEPOSIT_ORDERS.work`;
a writ's and the market's `spend`, the count alone); a shortfall nothing can cover moves nothing and says "You do not
have that many - in your Stores, your Materials Bag and your pack together." (`materials-short`); a put-in whose answer has
not come says so (`deposit-kept`) rather than that anything is short. Every craft and brew at a station does it
(`craft`, `brew`), a smelt at the forge (`smelt`), a Court writ's delivery (`deliver`, the shortfall the writ's card
names where the book's list has none) and a guild writ's (the host's `writBook.supply`). A smelt's product comes out
carried - as many withdrawals as the room takes, each within a withdrawal's 200 - and the smelt's line says where it
went and why any stayed ("Into your bag - 2 stay in your Stores: no room in your bag or pack."; "...: another withdrawal
was still being counted"; "4 on their way from your Stores: the counting-house has not answered yet"; a refusal's own
words). Every unit the service hands over is minted - into the bag, the pack, then the pack past its weight
(`giveCarried`), as a withdrawal always came: the service counted them carried. A station's refusal after some inputs
went in says so ("1 of the materials went into your Stores first - the next try spends them there."); a press while a
put-in of an input is unanswered says `deposit-kept` at once, and no craft is kept (the second audit's K4-K10). DFU's own potion maker reads and spends the bag
after the cart (`scenes/worldModes.js`). The guild Stores and Disenchanting read the Stores alone, as they did: a
material is given to the guild or sold back from the Stores, so it is put in first. The market's silver listing and its
buy-order fill count what is carried and put the shortfall in first, as a station does (MARKET-BAG, 2026-10-04 -
Professions-Arc 10.10: reading the Stores alone, a gatherer's List form offered nothing and every order said "0 in your
Stores"); a gold listing takes its Stores' own and gold's units alone.

## 7. Edges

- **A deposit's answer that never comes** keeps its items out of the bag and asks again with the same id at the next
  settle. The deposit is KEPT with the other acts (the audit's B17: it was memory alone), so a page closed before the
  answer still hears it. **Its take is STAMPED in the save** (the second audit's K3/K7/H2: `entity.bagTakes`, its id,
  material, units and order), and that save is the realm's - a checkpoint that LANDED - **before the deposit is asked**.
  So the save a later page boots says what happened: holding the stamp, it saw the items go, and a refusal gives back
  every unit (into the bag, the pack, past the pack's weight); without it, the deposit was never sent (its checkpoint
  never landed) and is let go, the save keeping its items. A checkpoint refused on a first ask undoes the take whole
  ("Your game could not be saved just now, so nothing went into your Stores."); on a later ask the deposit stays kept. A
  stamp no kept deposit names (its answer heard, the page gone before the checkpoint that took it off; or kept on
  another device) is asked by its own id - the service answers a deposit made as made, for good (`prof_deposits`). The
  stamp is read and taken off in one turn, so a save's items are given back once. (The `before` count this replaced
  gave back one of four when a harvest had been minted since, and two deposits' shortfalls shared one.)
- **Two tabs** settling one kept harvest mint its goods once - the tab that lets it go (AUDIT 29 C5's law).
- **A carried harvest is never let go unminted** (the audit's B1): heard under another character it waits kept for its
  own, whose next ask the service answers with the same harvest; past its ten minutes it is asked until it is answered -
  the service answers a landed one whatever its age (its row kept thirty days) - and only a refusal lets it lapse.

## 8. The threats, and the answers

| Threat | Answer |
|---|---|
| A save-edited material deposited into the Stores | Only the carried count moves; it is cut to the pack and never raised (5) |
| A looted DFU herb sold to a writ as a harvested one | It is held, never counted: a writ uses the count, not the items (5); a station works it loose, which no writ, guild or sale takes (14, 15) |
| Gold's goods spent at a station through the bag | A station's shortfall moves bought and own alone (6) |
| A client claims it holds more than it does | `held` only cuts the count; the units stay counted, bounded by what was handed out (5) |
| A stale `held` (an answer lost, a twin request) cuts units the pack is about to get | The cut only against the count the client heard, once a request, never by a twin of a landed act (5, 10) |
| A loaded bag sold or given, stranding its list | Refused while it holds anything; never traded at all (1) |
| A deposit landed and its page gone before the save that took the items out | The take is saved before the ask; a save without its stamp never sent it (7) |
| A deposit refused after a reload given back twice, or not at all | By the stamp in the save, read and taken off in one turn (7) |
| A kept harvest's units cut before they are minted | The count as heard is said as held while another carried act waits (5) |
| A harvest's units counted carried and never made (a full pack) | Every unit minted, past the pack's weight if it must (3, 13) |

## 9. Pins

`test/bag1_service.test.js` (the service, through the real Worker) and `test/bag1_client.test.js` (the law, the
save's hands, the window, the shop, the save, the book, a done-when through the real Worker); `tools/mutants/bag1.json`.
PACK-OVER's: `test/fb1004_packover.test.js`, `tools/mutants/fb1004_packover.json`.

## 10. The audit (2026-10-03, Mac: "Audit this")

Read whole before the merge, each finding reproduced against the real Worker or the real modules before it was fixed,
then pinned and its fix mutated (`tools/mutants/bag1.json`, the `AUDIT-BAG1-` records).

| # | Found | Fixed |
|---|---|---|
| B2 | A held count read when an act was kept, or before another's items were minted, cut units the service had just counted (three herbs kept offline, then pumped: counted 1 of 4) | `seen` and `heldKey`; the cut decided once a request against the count the client heard (`prof_carried_gate`, migration 0076); `held` read at the ask, a deposit still out counted (5) |
| B3 | A twin of a landed harvest or strike, racing it, cut the units the first had counted | The cut only while the request's own row is unwritten |
| B4 | No gathering kind named its material, so no carried harvest ever said `held` | Each kind names it (3) |
| B1 | A carried harvest heard under another character, or lapsed, was let go and its items never minted | Kept for its own character; a lapsed one asked once (7) |
| B17 | A deposit's answer lost with the page closed lost its units | Deposits kept; a reload's refusal gives back what the pack is short (7) |
| B5 | A withdrawal's goods with no room were counted and never minted | Into the pack, over its weight (6) |
| B6 | Herbs moved into the wagon were said as gone, the count cut under them | The wagon counts as held, taken last (5) |
| B7 | Food in the bag never rotted; a rotting one went into the Stores as fresh | The bag rots; a rotting food is no material (1) |
| B8 | A station's unanswered put-in said the materials were short | `deposit-kept` (6) |
| B9 | A Court writ read from another book's list found no shortfall to put in; a smelt said nothing of where its work went; a gem left behind was said as the harvest's | The card's word; `madeWhere`; each left material by name (3, 6) |
| H2 | The bag could not be opened from a plain pack (its button was the side window's alone) | A footer button (2) |
| H1 | Over a reward tray, a log taken out of the bag claimed the reward | No bag over a tray (2) |
| - | Put in bag offered for a dagger; Put everything in stopped at the first refusal and its button hid under a filter; the first harvest's words read as the pack only with no bag; the Work tab said a carrying book's count as the Stores' | Each fixed (2, 3, 4) |

Not changed, and why: the Stores' town is the client's convention (4) - the service checks no place, as it never did;
`held` over-reported stays bounded, not prevented (5).

## 11. The second audit (2026-10-03, Mac: "Audit again. Just want perfection")

Six reviewers read the whole PR again - the service, the book, the hands, the pages, the heraldry, the docs - and each
finding was reproduced (their repros against the real Worker and the real modules) before it was fixed, then pinned and
its fix mutated (`tools/mutants/bag1.json`, the `AUDIT2-BAG1-` records).

| # | Found | Fixed |
|---|---|---|
| S1 | A kept carried harvest asked after two days was refused `prof-day` (its row swept) and its counted units never came | Carried rows kept `CARRIED_ROW_DAYS` (30) (5) |
| K2 | A state read made `seen` current while a kept harvest's units were unminted, and the next act's cut took them (B2 half done) | The count as heard said as held while another carried act waits (5) |
| K3/K7/H2/H4/D1 | A deposit across a reload: given back one of four after a harvest's mint, one shortfall shared by two deposits, a landing with the page gone before the save kept the items too | The stamp in the save, the save the realm's before the ask (7) |
| K4/H5 | A smelt's carry-out minted through the bare mint, and units with no room by the answer were lost | Every unit given (`giveCarried`), past the pack's weight (6) |
| K10 | A product past 200 said "no room" with the bag half empty; a busy or unanswered withdrawal said as no room | As many withdrawals as the room takes; `why` said (`madeWhere`) (6) |
| K5/K6/K8/K12/K13 | A craft said "the work is kept" with none kept; a second press put a shortfall in twice; inputs moved before a refusal went unsaid; a deposit while one was out said "busy with another craft"; a smelt that threw held its id for good | `deposit-kept`, `moved` said, `deposit-busy`, the id let go (6) |
| K9 | A `carried-full` harvest refusal left the state unread | Read again, as Stores-full is |
| K11 | "+3 Oak Log to your bag" for goods that all went nowhere | "- all left where they were gathered: no room in your bag or pack" (3) |
| H1/U2 | The classic skin could not reach the bag, and a food rotted in it held the bag loaded for good | Empty your bag into your pack, on the Stores page (2, 4) |
| H3 | A take's undo wrote onto a stack sold or merged since, or into a bag that had left | The undo by each list's role, read at the undo |
| H8 | Every shelf of a General Store shelved a bag | The first shelf alone (1) - undone by BAG-SHELF (13): nobody found it |
| H11/H12 | `bagMayLeave` restated inline at five doors; Arcane Essence mintable as an item | One test; only what has a pack form is minted |
| U1/U14 | Put in offered past the Stores' room; why Take out was shut lived on a title alone; the qty field unlabelled | The room read; the reason drawn; "How many" (4) |
| U3/U6/U8/U11 | The footer's bag button grew the footer; the haul card counted what the service counted, not what came; the gold field came back over the pack after the bag; "your pack while you have none" | The gold button's rules; what came; the field put away; the words (2, 3) |
| S8 | No pin held a carried Motherlode strike or its twin | Pinned, a twin racing its first among them (`prof2b_motherlode.test.js`) |
| D3/D4 | Pins that read source a comment could fool (a host's material line, the potion maker's bag); no pin for the bag in the orphan sweep, the realm's customs or the hosts | Anchored to lines of code; the sweep and the enchanted piece driven |
| S9/D16 | The price note said 450; the law restated the Stores' bounds as literals | 456; `STORES_MAX`/`WITHDRAW_MAX` imported |

Not changed, and why: the wagon is reached from the inventory anywhere the cart is, as DFU reaches it - a design note
(H13), not a finding.

## 12. The four hosts (THE FOUR HOSTS RULE)

| Host | BAG1 |
|---|---|
| `scenes/world.js` | the book's hands (held, room, mint, give, take and the deposits' stamps, the checkpoint that landed); the Stores page; the inventory window interiors open (`bagItems`); the save |
| `scenes/exterior.js` | the inventory's bag pane (`bagItems`) |
| `scenes/dungeonContext.js` | the same, below ground |
| `scenes/worldModes.js` | DFU's potion maker reads and spends the bag after the cart; interiors' inventory is world.js's |

## 13. From play - PACK-OVER (FIELD BUGS 2026-10-04)

Mac, the day after: "People are doing gathering without a crafting bag and theyre not seeing the materials in their
inventory". Section 3 had a harvest's units with no room "left where it was gathered" - counted carried by the service
and never made, while every other door (a withdrawal, a smelt's carry-out, a refused deposit's return) mints past the
pack's weight (6, the audit's B5). A DFU pack is carried to its limit, so a character with no bag gathered goods it never
saw. The book mints a harvest through the hands' `give` now (`net/profBook.js` mintHarvest: bag, pack, then the pack past
its weight, `put.over`), as the Foraging mod's own AddItem does; the node still refuses an act with no room for one unit
before it starts. The record: `01-Overview/Field-Bugs-2026-10-04.md`.

**BAG-SHELF** (the same day, Mac: "Also nobody can find material bags in store"). The bag stood on a General Store's
first shelf alone (the second audit's H8) and was left off a shelf stocked by a character who carried one. The first
shelf is only the first shelf model the building lists, and online a shelf's stock is the room's for the day - so one
bag-owner's open hid it from everyone in the building until the next restock. It is on every shelf now, whoever stocks
it, as the horse and the cart are (`systems/shopStock.js`) - one to a character (ONE-BAG). A shelf stocked earlier the same game day keeps its stock until its restock.

**ENDLESS-STOCK** (the same day, Mac: "I want the gathering bag to be unlimited purchases in stores. It shouldnt run
out, same with campfires"). A shelf is a container, and a purchase took the bag off it for the day - for the whole
building, online. A Materials Bag or a Campfire bought is put back on its shelf now, a fresh one for each
(`systems/shopStock.js` restockEndless, called by the two purchases in `scenes/worldModes.js` - commitTrade's Buy arm
and the keyed list's doBuy - and nothing else: one stolen from a closed shop's shelf stays gone). Online alone; and online
no shop buys a bag or a Campfire back (`shopBuysItem`) - bought cheap and sold dear they were gold for nothing, and one
sold made any shelf endless. Pinned by `test/fb1004_endless.test.js`; `tools/mutants/fb1004_endless.json`.

**ONE-BAG** (the same day, Mac: "Right, you shouldnt be able to hold multiple gathering bags"). A second Materials Bag is
refused by the take ladder (`systems/itemTransfer.js` planTake: a pickup, quick loot, a container, the wagon, both trade
windows' Buy basket) and the keyed shelf (`scenes/worldModes.js` doBuy) while another is held in the pack, a trade's
basket or the wagon: "You already have a Materials Bag." One out of the character's own wagon is never refused, and the
bag is no decor piece. Pinned by `test/fb1004_onebag.test.js`; the audit's findings in the field-bug record.

## 14. From play - BAG-CRAFT (FIELD BUGS 2026-10-09c)

"People cannot craft from their bag" - and, asked whether a station should spend what the service never counted, Mac:
"I just want players to also be able to craft from their inventory, not just the store."

A station read the Stores and the service's carried count (`book.held`): every unit the bag or the pack held that the
service had not handed out - a log withdrawn before the bag (2026-10-03), a herb looted or bought at a DFU shop, a stack
traded from a friend, an heir's inheritance, goods left in a house's chest while the same material was gathered again
(the count is cut to what the pack holds, never raised) - read (0) at every station, and a press said `materials-short`.
With the count's goods the path was whole (a Steel Longsword from a bag of counted raw goods, through the real Worker).

- **A station works what is carried, counted or not** (`profBook.workable`, `bagLaw.js` carriedWorkable): the Stores
  and every unit the bag, the pack and the wagon hold, but the gold-bought units the count still names (GOLD-MARKET's
  wall). Every station's read is that (`ui/profPages.js` workOf - the anvil, the forge, the workbench, the loom, the
  mason's bench, the cook fire, the jeweller's bench, the alchemy and enchanting stations, the temper), and a craft's
  chain plans from it (CRAFT1).
- **Its put-in is the deposit's `work` order** (`DEPOSIT_ORDERS.work`, `looseOrder`) - a craft, a brew, a smelt and a
  temper: the counted units first, bought then own, as `spend` moves them, then the units the count does not hold, as
  many as `held` names past the count once cut (`server-account/src/professions.js` depositStores). Those go into the
  Stores as **loose** (`LOOSE_ORIGIN`, the Stores' fourth origin - section 15) and the count is not touched for them;
  the answer says them (`loose`). The stamp, the checkpoint before the ask and the give-back on a refusal are the
  deposit's own (section 7).
- **Loose, a station's alone** (section 15): never own (no gatherer's word - it raises no seat's influence), never
  bought (no writ, guild Stores or Drakes sale takes it), never gold's; a station spends it first, and what it makes of
  it stays walled.
- **A writ, the market and the Stores page's Put in are unchanged**: they move the service's count alone (`spend`,
  `all`; `book.held`), and a writ whose count moved since it was heard is refused `carried-short`, its units given back.

What this gives up, and the owner's call: a station's put-in takes the client's word for what the pack holds (a
deposit's 200 at a time, the professions' hourly bound on acts). A modified client can therefore craft from goods it
never had and earn the craft's XP - and nothing more: since the audit (section 15) none of those goods, nor anything a
station makes of them, reaches a writ, the guild Stores, a Drakes listing or fill, or the carried count; a piece of
them lists for gold alone, as any pack's piece does (MARKET-ANY). Law 3's guarantee stands for the economy, and
`Professions-Arc.md` law 3 says where the door is.

Pinned by `test/fb1009c_bagcraft.test.js` (the done-when: a Steel Longsword from raw goods the service never counted,
in one press through the real Worker; the law; the service's `work`, `spend` and `all` and a full Store; the book's
doors; the anvil and the forge over a real carrying book); `tools/mutants/fb1009c_bagcraft.json`. The record:
`01-Overview/Field-Bugs-2026-10-09c.md`. ACCOUNT_VERSION `acct99`.

## 15. The audit - AUDIT BAG-CRAFT (2026-10-09, Mac: "Audit this")

Three cold reviews were launched on the frozen head and stopped on a rate limit before reporting; the three lanes (the
service and the economy, the client, the tests and the docs) were then read in full, each finding reproduced against
the real Worker or the real modules before it was fixed, pinned and mutated (`tools/mutants/auditbagcraft.json`).

| # | Found | Fixed |
|---|---|---|
| A1 (HIGH) | A `work` put-in is no station's act but a request any client may send, and its units went into the Stores as **bought** - every door law 3 walls. Reproduced: 200 Mithril Ore no pack held, put in by a bare `work` deposit, listed for Drakes (100) and withdrawn counted as carried (50) - and by the same reads delivered to a Court writ, the guild Stores or a guild writ, and filled into a Drakes order. Section 14's "sell the pieces for Marks" understated it | **The stations' wall** - GOLD-MARKET's turned the other way: the Stores' fourth origin, `loose` (migration `0095_loose_origin.sql`; `bagLaw.js` LOOSE_ORIGIN, STATION_ORIGINS, WRIT_ORIGINS). A station alone spends it, first (`professions.js` workableSql and workStatements - a craft, a smelt, `alchemy.js`'s brew, a temper); a writ, the guild Stores and the market read own and bought (`spendableSql`); a withdrawal takes it after gold's and never counts it; a smelt's products of it are loose, a craft's piece of it is walled to gold (`bought_with` 'gold' - MARKET-ANY's pack-piece law: no Drakes listing, commission or auction), a temper with it walls the piece the same, a Ram Kit of it is loose (no camp's writ takes it); a brew never reckons it unbruised. The book reads it as a station's (`storesWorkable`) and no writ's (`storesHeld`); the Stores page counts it in the total and the room and says it ("from your pack", LOOSE_GOODS_LINE) |
| C1 | The book's door pins read the source with `includes`, which a comment quoting the line would satisfy | Pinned on lines of code (`codeHas`) |
| C2 | No pin held a writ's put-in reading the Stores' loose units as already in (the audit's own survivor) | Pinned: the counted unit goes in all the same |
| B1 (LOW, kept) | A craft refused by the service after its put-in (a rank, a fee) leaves the moved goods in the Stores | Not changed: they are loose there, the next station's, and Take out gives them back to the pack uncounted |

What the wall costs an honest player: a piece made of looted goods lists for gold alone, as the looted goods
themselves would from the pack; and a Ram Kit of them stays a station's. Pinned by `test/auditbagcraft.test.js` (the
wall at every door, through the real Worker - the gold wall's own test the pattern; the stations' spends and products;
the brew's unbruised count; the Stores page over a real carrying book) and `test/fb1009c_bagcraft.test.js`.
