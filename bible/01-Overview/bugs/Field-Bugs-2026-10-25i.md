# FIELD BUGS 2026-10-25i - seven #bug-reports threads

Seven threads from the Discord's #bug-reports, handed over by the owner as phone screenshots (named 25i: main's
25b to 25h took the letters while it was open - it was 25b on its branch). Read on main's
`745ddb5c1`, with the freeware's data (`tools/fetch-data.sh`), each by a reader of its own beside this one; the owner
then asked "Audit this" (AUDIT FB1025i, below). The pins are named under each fix, the mutants
`tools/mutants/fb1025i_*.json`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | SaberGGaming, "Reforging 'Mule' items ... reverts name": "the carrying capacity doesnt get rerolled into something new if you reforge it. Not only that but if you've renamed your item it will revert it back into its original name" | Two halves. The line given its own kind back was REFORGE-REPLACE's (#1265, on main that morning). The name was this slice's: the reforge named the piece again from its template | NAME-KEPT |
| 2 | pepsiorcoke, "Player gets a bounty when defending themselves against quest NPC's who attack": "Assassin's are attacking me for escorting another NPC and I choose to defend myself and my escort target guards approach me with a hefty fee of 500+ gold" | Not the quest (measured: its attackers' deaths charge nothing). The likely path, not proven on the reporter's save: a swing past an attacker landed on a road traveller - Protect Bystanders never covered the road | ROAD-SPARE |
| 3 | Paofrenetico, "Can't buy this piece": "I did dismantle the other chest i bought days ago, but still i cant buy this one" | The law worked: today's The Warden (Mora's) was bought today; the one from 2026-10-22 was another offer (Malacath's) under the same Legendary name. The refusal's words misled | BOUGHT-YOURS |
| 4 | Mefwhesk, "Unable to turn in The Daedra's Heart": "Elyzabyth will not let me turn the quest in" | The quest's own heart counts, never a plain one (the thread's reply was right). The likely cause, found by AUDIT FB1025i: a second kind of daedra hurt after the take pulled the quest's heart OUT of the pack onto its body - DFU keeps it. And two lies of the port's: the journal struck "take its heart" on a look at the body's row, and the Enhanced pack drew the quest's heart as a plain one | HEART-KEPT, HEART-TAKEN, QUEST-MARK |
| 5 | kvassdrit, "Big trees hide resource node particles": "Needs to be size aware or have a completely different visual" | A 3D tree's crown box counted its prototype's scale twice: a temperate tree glinted on its lower half, a swamp's mostly in the air above; and a big crown's glints were a herb's six at a herb's reach (AUDIT FB1025i C1) | NODE-CROWN |
| 6 | Giljabrar, "Storage in the Decoration update may be Realm Locking items": "I placed 89 rare/legendary items in a chest ... they were all 'Realm Locked'" | The decorator's Discard wrote a snapshot of every chest back, so a piece stood in the chest and the pack and the ledger locked both; in #1223's build across rooms. No route lifted a lock | CHEST-DRAFT, COPY-LIFT |
| 7 | ajaegerson, "Caravans get caught on shop signs": "Sometimes they do when travelling through towns"; Harlander: "Even going on foot you can get hung up on shop signs and fences." | A shop sign's board, arm and brace hang over the street at 1.65-2.4 m, inside a rider's 2.6 m body (a wagon's driver is one) and the lowest inside a walker's; all of it was solid. And a split-rail fence's rail, met from the side, was read as a floor the body had sunk under, and the walker set on it, wedged | SIGN-PASS, RAIL-HANG |

## NAME-KEPT (1) - `src/systems/loot/lootRarity.js`

WHAT DFU DOES. Nothing to follow for the reforge - the Reforge is the Loot arc's own. The name the player gives is
DFU's: the item maker's RenameItem (DaggerfallItemMakerWindow.cs:761) writes the item's shortName, and nothing in DFU
names the item again.

WHAT THE PORT DID. `reforgeAffix` named a Magic or Rare piece again from its TEMPLATE on every reforge (`rarityName`),
at both doors (the Mages Guild's `reforge.js` reforgePiece and the Essence's `smithItems.js` reforgeItem - one roll).
So a name the Item Maker gave was lost; a Masterwork's own name (the maker's mark names it: "Saber's Silver Ring", its
`name` "Silver Ring") took the ladder's words its mint withholds ("Saber's Mule's Ring of the Ward" - the report's
card); and a crafted jewel lost its metal and gem ("Silver Ring" to "Ring").

FIXED (as AUDIT FB1025i left it - the first cut parsed a name by the lines it had, A1-A5 below). A name is the ladder's
- at most one of its tier's prefix words and one suffix word around the piece's BASE, read off the piece: a crafted
jewel's recipe name, a Masterwork's bare template, else the RRI word and the template, and an older save's bare
template besides (`lootRarity.js:"export function linesName(item, tier, was = item) {"`) - or it is the piece's own and
stands. A reforge builds the ladder's again from the piece's own lines (never a set gem's - AUDIT GEM), a Masterwork's
its base alone. The Imbue keeps a name of the piece's own (a questline's named reward), and a load gives a crafted
piece the old law broke its base's name back (`repairCraftedNames` - the reporter's ring is "Saber's Silver Ring"
again), never a found one (a curse's line is added after its name by design).

NOT DONE. A name already reverted to the ladder's cannot be given back: nothing kept the player's.

PINS: `test/systems/loot/fb1025i_namekept.test.js` (9: the report's ring through the jeweller's mint and the Item
Maker's window at both doors; a Masterwork's name; a ladder name's words round "Silver Ring"; an old gem word, set and
unset; a cursed piece; the old law's damage, at a reforge and on load; renames that keep a ladder word; the Imbue).
Mutants `tools/mutants/fb1025i_namekept.json` (14: 13 dead, 1 equivalent as recorded - a Masterwork's RRI word, '' with
the mods off). Re-aimed by content: gem1's AUDIT-GEM-named-by-the-gem, loot9's LOOT9-name-stays.

## ROAD-SPARE (2) - `src/scenes/livingWorld/roadStrike.js`, `src/scenes/world.js`

WHAT DFU DOES. HandleAttackFromSource charges a crime for a civilian MobilePersonNPC struck (Assault, or Murder on the
kill) and a city watch killed; a hostile foe struck or killed is no crime, so a quest's Assassins killed in
self-defence charge nothing. MeleeAttackFriendlyProtection never spares a mobile NPC (C# from memory; the quest
scripts are vendored).

WHAT THE PORT DID. The quest as DFU's: A0C00Y17 ("The Escort") through the real quest machine, its four hunter
branches answered, its Assassin wave killed in the real encounter pool - no crime, the law untouched (only its warrant
branch refused is `legal repute -20`, DFU's own). But a melee swing that met no foe in reach and no townsperson went
on to the living world's ROAD travellers (LW7), and PROTECT-FIGHT's law (`cityGuards.js` playerSparesPerson - with
Protect Bystanders on, a fight passes the townspeople by) was asked of the street's walkers and never of the road's.
In an escort's fight a swing at an attacker just past reach killed the traveller on the look line - a caravan's own
merchant in an LW11 escort - in one hit; the road reported a Murder (`caravanHost.js` slain), the region's law fell 20
at the town, and the watch, knowing the face under -10, asked 500 + 5 x 20 = 600 gold. The reporter's save was not
read: the road is the LIKELY cause, not a proven one (AUDIT FB1025i D1). The one other path to the same fine is DFU's
own and stands: the warrant branch refused (`_S.01_`'s two Warriors, `_S.17_`'s `legal repute -20`) - measured to -20,
a face the watch knows and its stop's 600 gold, pinned as intended.

FIXED. The road's strike is its own module (out of `bootWorld`, 9 logical lines), and asks the street's law: a
traveller it spares stops the swing - nothing killed, nothing reported, no door behind them bashed (AUDIT 29g)
(`roadStrike.js:"if (cityGuards.playerSparesPerson(near.entry.person)) return ROAD_SPARED;"`). No fight, or the
protection off, and a blow at a traveller is DFU's one-hit civilian. AUDIT FB1025i D2: a stood traveller (LW7b) another
hand cut down - a beast, a peer, an ally - is KILLED, never the player's slain (no report): the pool's death door names
whose hand (`exteriorFoes.js` `killedBy`, the watch pool's own word) and `roadStands.js` slays on the player's kill
alone. D3: the fight that spares is a fight near the player (`encounters.js` `fightNear`: AreEnemiesNearby's answer,
or a hostile foe in the classic spawn band of the player's feet whatever its target), so a party member's foes - puppets
in this pool, which run no senses of this player's - count; the rest gate keeps its own law. Both street hosts ask it.
A departure, PROTECT-FIGHT's extended (its Port-Ledger section A row, the one home). THE FOUR HOSTS: `world.js` wired
(the strike, the stands' other hand, the fight); `exterior.js` the fight (it stands no living roads); `worldModes.js`
and `dungeonContext.js` never hold a road traveller and spare no street walker.

NOT DONE. A0C00Y17's warrant branch (`_S.17_`, -20 for refusing the watch) is DFU's design and stays. The deep's
companies (`dungeonDivers.js`): a hostile member cut down by another hand is still the player's slain - the lives' turn
and the company's regard, never a report, so no fine comes of it; the dungeon's pool names no killer.

PINS: `test/systems/livingWorld/fb1025i_roadspare.test.js` (6). Mutants `tools/mutants/fb1025i_roadspare.json` (22, all
dead). Moved: `lw7_deeds`', PVP-BLOOD's, `lw7b_beyond`'s, `lwfix4_turns`' and PROTECT-FIGHT's host pins. Re-aimed by
content: LW7's five road records, AUDIT29g-spared-surfaces, LW7b-friend-died-unmade and LW7b-host-died-unwired,
PROTECT-FIGHT's two host records, HOST-SPLIT-a-ceiling-under-its-host. bootWorld's ceiling 36,389 -> 36,365.

## BOUGHT-YOURS (3) - `src/systems/sigil/sigilBroker.js`

WHAT DFU DOES. Nothing to follow: the Sigil Broker, her day's stock and its one-a-day mark are the port's own
(`11-Multiplayer/Sigil-Sets.md` section 7).

WHAT THE PORT DID. The screenshot is day 20751's stock exactly (`brokerStock(20751)` named through `itemLongName`: its
six rows by name, set and tier; "New stock in 3h 31m" is 20:29 UTC). Its "8" on The Warden and the mace and its "90"
on the Gatebreaker are the window's 6s and 30, misread at phone size - the Gatebreaker's own "Need 10 more" on a purse
of 20 is 30 - 20. The Warden is a Legendary's base-record name: day 20748's (2026-10-22) slot 0 was Malacath's chest,
day 20751's slot 3 Mora's. A mark is its offer's own id, the day in it, in a record of one day, made only by
`makeBrokerSale` after the stones are out and the piece is in; so the older sale never marks today's, its dismantle
frees nothing (SS5), and "Bought" on `20751:3` is a sale of today's Warden on that character. The refusal's word,
"Bought today", named no buyer, and a player holding the older Warden read it as "you have one already".

FIXED. The refusal reads "You bought this one today. You can buy each piece once a day." - the note a press of Bought
says, and the button's title and name; the button keeps "Bought". AUDIT FB1025i A8: a dismantle names the ware's set - "Dismantle
The Warden (Mora's Mantle)?" (`sigilBroker.js` wareName, both packs), since either reading of "I did dismantle the
other chest" leaves the screenshot as it is.

NOT DONE. The Broker's words are still English literals (L10N4's count for the file unchanged).

PINS: `test/systems/item/fb1025i_brokerbought.test.js` (3); set7_broker's two pins of the old word moved, and ss1_stones'
five of the dismantle's words (A8). Mutants `tools/mutants/fb1025i_brokerbought.json` (9, all dead).

## HEART-TAKEN, HEART-KEPT and QUEST-MARK (4) - `src/systems/questlines/sheets/`, `src/systems/item/itemTransfer.js`, `src/ui/enhanced/enhancedInventory.js`

WHAT DFU DOES. Q0C4XY04's `Item _heart_ daedra_heart` is the quest's own. Each of its four kinds is given it as one is
first hurt (`injured <foe>` then `give item _heart_ to <foe>`), and every instance of a kind given it takes a CLONE onto
its body - Foe.GetClonedItemQueue's ItemCollection.CloneAll, each a UID of its own. GiveItem then takes the quest's own
record out of the pack if the player holds it (GiveItem.cs:117-121, Contains(DaggerfallUnityItem): by UID), never a
clone the player took off a body. `toting _heart_ and _questgiver_ clicked` asks the pack for the quest's item
(ItemCollection.Contains(Item): the quest's uid and the item's symbol, a clone included) and the hand-in releases every
held copy (ReleaseQuestItemForReoffer). Any other Daedra's Heart is no quest's. `clicked item _heart_` fires on any press
of the heart's row in a body's list - the remote list sends the click before the take (DaggerfallInventoryWindow.cs:2027-2037).
The classic list paints a quest item's cell green (questItemBackgroundColor).

WHAT THE PORT DID. Three faults of its own, the first the report's likely cause (AUDIT FB1025i B1). The host's
playerHasItem read a quest's item by its quest and symbol alone (`world.js`'s `_heldItemIndex`, AUDIT 24's, so a save's
two restored copies still meet), so the heart taken off the first kind's body was pulled out of the pack onto the
second kind the player hurt: the pack held no quest heart, the witches asked nothing, and the journal stayed struck -
the switch on or off. The questlines sheet struck "take its heart" on `_S.01_` and opened "Bring the heart" with it, so
a take refused (a full pack) or a menu closed unused told the player the heart was theirs while it lay on the body. And
the Enhanced pack - the default - drew the quest's heart exactly as a plain one, where a Daedra Seducer's own loot leaves
a plain heart on the same body about half the time (201 of 400 bodies through spawnEnemyLoot). The screenshots: the line
struck and one "Daedra's Heart" row ("3.00 kg", if read right, is three hearts, and a quest's item never stacks).

FIXED. HEART-KEPT (B1, a return to DFU's law): a foe's clone says it is one (`questClone`, declared in `itemFields.js`,
`foe.js:"return this.itemQueue.map((it) => (it?.questItem ? { ...it, questClone: true } : { ...it }));"`), and the read of
a quest's own record in the pack is one law beside keepsQuestItem
(`itemTransfer.js:"export function heldQuestRecordIndex(items, dfItem, { clones = false } = {}) {"`) - the record, or a
restored copy that is no clone; playerHasItem never takes a clone for it
(`world.js:"playerHasItem: (dfItem) => _heldItemIndex(dfItem, false) >= 0,"`), and Item.Dispose's sweep
(removeItemFromPlayer) still finds one, own copy first. bootWorld 6 logical lines out (36,364 -> 36,358), its ceiling
down by them. `toting` reads a clone as held (Contains(Item)) and the hand-in takes every held copy, as before. THE FOUR
HOSTS: `world.js` wires both hooks (fixed); `exterior.js` (?exterior) wires no item seam (its own FLAG); `worldModes.js`
and `dungeonContext.js` run `world.js`'s bridge. HEART-TAKEN: the sheet's first line is done, and its second opened, by
the quest's heart held now or the hand-in (`{ any: [ { item: _heart_ }, { task: _qlask_ } ] }` - a party copy's resync
carries `_qlask_`). The same lie stood in three more sheets - a line struck on a `clicked item` of an item a foe's body
holds - and each is struck now by the item held: N0B00Y06's wrappings or its `_reward_`, R0C20Y07's sapphire or its
`_pcgetsgold_` (each `toting`, reached only holding it; B5: the two next lines open on the item alone, their own done
showing them), S0000503's hoard by its `_item_` alone (B3: `_S.30_` asks on DFU's click, `when _S.05_ and not _S.16_`,
so a look and a walk out reached `_S.28_`, `take _item_ from pc`, and `_S.29_`; a party copy has the latch by the merge,
`qlState.js` mergeSharedState). A SAVE FROM BEFORE (B4): each rebound objective names its mend (`"reread":"fb1025i"`), and
a state that has not taken it forgets that objective's latch once at its first read
(`qlLaw.js:"const unmended = (st, o) => !!o?.reread && !(st?.reread ?? []).includes(o.reread);"`); a fresh state takes it
at once, and a latch this build wrote stands through a load (`06-Systems/Questlines-Arc.md` 2.2). QUEST-MARK: a quest's
item says "quest item" on its row and names its quest on its card in the Enhanced pack and a body's list
(`enhancedInventory.js:"quest: item?.questItem ? (deps.getQuest?.(item.questUID)?.displayName ?? '') : null,"`) - "Quest
item" bare where no quest of this world holds it - and on the counter's and the player trade's rows (B6), in the catalog
and the thirteen whole languages (`inventory.quest.word`, `.of`, `.item`; no key added since).

NOT DONE. Accepting any Daedra's Heart is the owner's call and is not built: the quest's own words refuse a Lord's
("Any daedra heart will do but that of a Lord") and ask one "recently plucked and by thou", and a heart carries no
record of the body it came from. A clone left on a body may still be taken while its quest stands, and the load's
orphan sweep takes it out of the pack once the quest is tombstoned (SaveLoadManager.RemoveAllOrphanedItems) - DFU's own.
A resync from a partner still on a build before this one can merge an old latch back once (mergeSharedState takes the
union; the mend is per state). An older save loaded in S0000503's "kept" window (`_S.29_` made the item permanent, the
mage not yet down) reads the hoard open until the quest ends.

PINS: `test/systems/questlines/fb1025i_daedraheart.test.js` (15; the rig reads the host's own law, B2). PIN MOVED:
`test/scenes/audit24_lifetimes.test.js` (the held read, now in itemTransfer.js), `test/systems/fb1011_tradeloc.test.js`
(the player trade's row words). Mutants `tools/mutants/fb1025i_daedraheart.json` (39, all dead); re-aimed by content:
`fb1011_tradeloc.json` TRADE-LOC-II-a, `hostsplit.json` HOST-SPLIT-a, `ql4_flow.json` AUDIT-QL-FLOW-REWARD-15 (all dead).

## NODE-CROWN (5) - `src/render/nodeGlint.js`

WHAT DFU DOES. DFU has no gathering nodes and nothing that marks them: NODE-GLINT is the port's own (Professions-Arc
47). The tree it lights is drawn as DFU draws a terrain tree a mod's model replaces: the prefab's own scale under the
terrain's 0.6-1.4 (`MeshReplacement.ImportNatureGameObject`, from memory) - Low Poly Trees draw it so (`bbVertexShader`'s
mesh mode). No departure, no Ledger row owed.

WHAT THE PORT DID. A Logging node within 120 m is its 3D tree (Low Poly Trees, on by default, draws every wild tree
within 140 m). The glint boxed its crown at the run's standing size times the tree's row scale times the prototype's
scale - and the standing size already carries that scale (`world/lowPolyTrees.js` readLowPolyTrees, `m.max[1] * sy`).
The climates stand 95 Tree records (with the woodland sets' winter archives), 93 with a prototype, 74 of those scaled
(AUDIT FB1025i C2: this said 88 of 116, the pin loop's count): the temperate and mountain woods' mostly 0.5-0.8 glinted
only to half to four fifths of their height (504_16's 16 m tree to 8 m, its upper crown never), the swamp's, the
desert's and a winter wood's 15 (1.1-4.2) over a box up to four times their height, most of their glints' tries in the
air. Not the depth: the light is drawn after the trees. And (AUDIT FB1025i C1, the report's "size aware") a big crown's
glints were a herb's - six at most at a herb's reach: the light of their cores a picture's pixel 12 times sparser than a
near herb's at 30 m, 53 times at 12 m (the audit lane's probe, the real door's tree with the player's atlases).

FIXED. The crown is as tall as the tree its run draws (`h = t.run.size[1] * row[4]`). A 3D crown's glints grow with its
size on screen (`nodeGlint.js:"export const glintCrownGrowth = (rows, crownPx) =>"`): its side against the side a herb's
glint stops growing at, to the two thirds (their light, count times reach squared, as its area), up to twice as many
reaching twice as far - twelve at 28 px at 1080 rows, the room round it its own. After: 1.4 and 7 times sparser than the
herb at 30 and 12 m, the tree's hearts a frame 2.8 to 6.1 and 2.4 to 4.7. A herb, a vein, a boulder, a school and a far
flat keep six at a picture's reach, pixel for pixel. A glint's life is one law both stages read (`glintLife`), so twelve
glints take the varyings six and their turns took.

NOT DONE. A near tall crown past the screen's top spends about a tenth of its tries off the screen (C4); a small crown's
count steps a glint at a time as the eye nears; the crown box's depth is `reach` (C5).

PINS: `test/scenes/fb1025i_nodecrown.test.js` (4: the report's 504_16 through the loader, the shader and the pass; every
climate's Tree records at a row scale of 0.8 and 1.2, their counts by value; the growth's law; 504_16 at 30 and 12 m, its
far flat, a herb and a small far crown); `tools/nodeGlintProbe.mjs` (33: a half-scale prefab's top two fifths lit; the
big crown twelve at twice the reach, its hearts more than the herb's). Mutants `tools/mutants/fb1025i_nodecrown.json`
(24, all dead). Moved: nodeglint's boxes, programs and draw pins; nodeglint.json's seed and room records re-aimed.

## CHEST-DRAFT and COPY-LIFT (6) - `src/scenes/decor/decorTool.js`, `server-account/src/ledger.js`, `server-account/src/staffRealm.js`

WHAT DFU DOES. Nothing to compare: Daggerfall has no decorator, no online home and no realm ledger.

WHAT THE PORT DID. The decorator's draft (DECOR-BATCH, #1223) kept a snapshot of every chest when it opened, and its
Discard wrote the snapshot back. A piece taken out since stood in the chest and the pack, so the ledger read one key
twice in one record and locked both copies (`twice`); a piece put in since was gone. In #1223's build the draft
outlived the room: a Discard in the ship's, caravan's, offline house's or palace's decorator ("These changes are not
kept. Leave them behind?" over changes nobody made) stood the home's chests there with a copy of every stored piece,
so every piece was locked while it sat untouched in the home - the report. #1262 closed the cross-room path; the
within-visit one stayed. And no lock could lift: a known copy is never judged again, and staff's purge destroyed both.

FIXED. The draft stages pieces and its own moves of the owner's things, never chest contents; a chest the draft placed
and Discard removes gives its goods back to the pack, and says so. AUDIT FB1025i (lane E): the owner's moves are one
ordered journal, undone last first (`decorTool.js:"for (const [i, m] of [...d.moves.entries()].reverse()) {"`) - a
thing set down and taken down in one draft stays in the pack (the pack's door refuses a record it holds, and the take
that followed lost the only copy; a ruby given again joined its stack, four of three), a thing taken down joins the
stack it landed on and Discard takes one off that stack, and one gone from the pack since (stored, sold, dropped, or
worn - `decorPack.js:"if (!pack.includes(item) || item?.equipSlot != null) return null;"`) stays down for Confirm,
said. The doors are the host's own, out of it (`systems/decor/decorPack.js`), so the pins stand on them. A staged
chest's Access set before Confirm goes through the record's act (`decorTool.js:"const act = kind === 'storage' ? deps.realm?.() : null;"`):
the service moves what the chest holds now, and the save's list empties only on its word - it had been cleared on an
ok that moved none of what was stored since the last checkpoint. A kept chest's Access pressed mid-draft moves its
goods into the bin, and a Discard after leaves the chest as it lies. A draft left by the door (an offline house, a
ship, a caravan - the exit pressed, the page closed) wrote its staged own things and chests' goods under pieces the
saved room never stands; the next visit gives them back to the pack, said
(`worldModes.js:"if (!(interiorHome || _seatHallVisit)) returnUnstood(interiorDecor, placed, decorPackGive, say);"`).
COPY-LIFT: a record's own `twice` copy is lifted only by staff's purge with `keep: true`, and (AUDIT FB1025i lane F)
only where the act itself leaves the record one: the keep finds every copy the save holds wherever it lies - a
deserter's take, the ground, a shop's shelf (`staffRealm.js:"export function copiesOfKeys(save, keySet) {"`, said as
`hidden`) - keeps the ledger's own piece (the first of its row's print) and destroys the rest, and lifts where its batch
destroyed a copy or staff's Remove keeps one; its row the record's own, held and unclaimed and of the piece kept, no
other record's copy, no trail check or one found innocent - never `unclear`
(`ledger.js:"export async function ownCopiesLiftable(db, char, pieces) {"`). The finding and the answer say what the
batch lifted; a checkpoint landing between the act's read and its seizure refuses it `seq`; a keep empties the
account's chests only of what it lifts. No revenant takes a realm-locked piece (`revenant.js:"&& !isRealmLocked(item)"`).
No checkpoint lifts a copy: a slice that did was found launderable before it merged - a copy moved where the record
lists nothing (a deserting revenant's take, a counter, the ground) and brought back would have freed the other. The
account service's law moved: `ACCOUNT_VERSION` acct193 (acct191 on its branch, renumbered past main's YARD-TOWN acct191 and ECON-LEFT-OUT acct192 at the merge); no migration, and the purge's answer only gains `hidden`.

FOR THE REPORTER. Staff run `/v1/staff/item/purge-dupes` with `keep: true` on the character (preview first); their tab
loses its seat and they rejoin with one of each, unlocked. The staff panel needs a "keep one" choice that sends it.

NOT DONE. #1223's cross-room Discard also stood the home's pieces in the other room in place of its own (each refunds
half its cost if removed), and wrote the home's own-things record over the other room's: the other room's own things
were lost, and each home thing standing there stood in two rooms - a pair the ledger locks, which the keep repairs (it
walks the whole save, the rooms' own-things records with it). A lost own thing is in no record: staff give it back
fresh (Add an item, `/v1/staff/item/give`) on the player's word - a rollback reaches only the last clean checkpoint.
The shared settle's "already in this save" check
reads the pack alone. A copy sold at a counter before the keep is gone from the save: nothing lifts on that word, the
sale's gold stays, and the piece bought back is a second of one, locked again. A copy staff took more than 30 days
before (its evidence deleted) is no copy the keep can count. A copy of any other kind stays locked for good.

PINS: `test/server/fb1025i_chestlock.test.js` (17), `test/server/staffpanel3realm.test.js` (the keep, and lane F's
seven: the deserter's take, the ground, a triple, the ledger's print, a claim's chest, the race, the seizure's read),
`test/systems/decor/decordraft.test.js` (a copy's Access through the act). Mutants `tools/mutants/fb1025i_chestlock.json`
(64, all dead); the bug's own two-site shape (the open's picture, the Discard's write-back) run by hand: three pins fail. `test/decorFakes.mjs`'s chests are the real `createDecorRoom`
store now - the fake's no-op `setItems` was why "Discard puts the room back" passed while the bug shipped.

## SIGN-PASS and RAIL-HANG (7) - `src/world/signSolid.js`, `src/player/collider.js`, `src/player/lateSolid.js`, `src/scenes/pixelBuild.js`, `src/scenes/exterior.js`, the yards' models and hosts, `src/characters/enemy/enemyMotor.js`

WHAT DFU DOES. A shop's sign (ARCH3D 43700-43755, three frames of nineteen boards) is a town block's misc model; all 668
in BLOCKS.BSA are. RMBLayout.AddProps combines it into the block's mesh, and CreateCombinedMeshGameObject gives that
mesh one MeshCollider, so the whole sign is solid to bodies and rays alike. A CharacterController stands on nothing it
does not fit over.

WHAT THE PORT DID. Both town hosts collided the sign whole. Its board, arm and brace hang over the street from 1.65 m
(43718-43736), 2.1 m (43700-43717) and 2.4 m (43737-43755), inside a rider's 2.6 m capsule (`RIDE_HEIGHT`; a wagon's
driver is one) and the lowest inside a walker's 1.8 m. Measured through the real motor on TVRNBM04, MARKAA00 and
GEMSAM00, 545 of 2,927 open lines past their signs stopped a rider and 131 a walker; a journey's feelers, at the knee,
saw none of it. The port's own gate boards, 2.4 m up under their beams, kept every Cart out of the Stable, the Joinery
and the Shipyard. Separately, PH1's one-way floor set a body on a split-rail fence's rail (41206-41208) met from the
side: a walker from behind ON the lower rail's back edge (0.39 m, wedged under the upper rail - 130 of 130 stations), a
runner from the street on its under slope in a 0.28 m band a panel.

FIXED. A sign's triangle whose every corner stands `signSolid.js:"export const SIGN_HANG_M = 1;"` over the sign's foot
hangs: it stays in the collider as a ray's (addMesh's `sight`), met by every ray and sweep - an arrow, a spell, a foe's
look, the camera, a click, a walker's eye - and by no body (the resolve, the overlap, the contact, the parity and a
body's own rays, `BODY_RAY`, pass it). The posts stand. The range is HOUSE-SIGN's one export (`houseSigns.js`
`isShopSignModel`). Both town hosts hand the marks
(`pixelBuild.js:"late.add(gateKey, cpu.positions, cpu.indices, local,"` through the late gate, which carries them;
`exterior.js`): 51 rider and 83 walker stops remain, every one at a post. The yards' boards hang the same way (the
signboard and assemble's `sight`, both yard hosts). A walking step - no fall in it, or EnemyMotor's walk from the ground
(move's `onGround`) - takes PH1's floor only where the body stands once set on it, its height clear over that floor
(`collider.js:"    this._walk = dy === 0 || this._onGround ? height : 0;"`, `_standsOn`: a ray up from just inside the
floor's edge, at the way in and either side of it along the edge), in every pass of the step; where it does not, that
floor is a wall to the sphere, as SH1's is. A fall's lip catch is as it was. No station of either side of the three
fences hangs, square or slantwise (the game's own, square: 26, 26 and 25 of 72 before, none after), and a foe chasing
the player across a fence stays on the ground. THE FOUR HOSTS: world.js and exterior.js wired; worldModes.js's interiors
and dungeonContext.js place no sign (0 of BLOCKS.BSA's 668); the Collider's law is all four's. SIGN-PASS is a departure
(Port-Ledger section A); RAIL-HANG is not.

AUDIT FB1025i (lane G) moved the law twice. G1/G2: the first reading capped PH1's walking floor at SH1's stand ceiling
and asked its plane over the sphere's centre; the ceiling made a jump or a wall of every 0.5-0.7 m top walkers had
stepped onto (benches 41105/41106, beds, N0000037's throne seat) and stopped walkers dead at the dungeon blocks' seam
connectors, their lip 0.501-0.505 m over the feet (1,597 seam crossings over ten dungeons in the parent, 1,139 under the
ceiling), and the plane test asked nothing the headroom does not. Both are gone: the seams cross as the parent did
(1,597), the benches and the seat are walked onto again (the throne's pin a walk again), and the sweeps' differences
from the parent are the law's own cases (a fence's rail; RESIAM02's railing 41409, its lower bar under its upper;
N0000037's wall base 63035 under its overhang; a table, 41108, climbed from its chair where no body stands on its top;
the throne 41123's arm rests, five lines the parent set on an arm - the seat between them 0.68 m, narrower than a body).
G5: the board was out of the collider for everything; it is every ray's now. G6: EnemyMotor's walk carried gravity's
fall, so `dy === 0` never named it; its walk hands its ground. G7: the plane test's survivors went with it; `< hang`
against `<= hang` is recorded equivalent (no sign corner stands on the line). G8: a throw out of a move leaves no
walking pass behind it. And three more the audit's sweeps turned up on the way: a refused floor given the plain push let
a water walker pressed to a ceiling slip through a rib (it is a wall now); the walk's vertical pass, left out of the
law, set a wagon sliding along TVRNBM04's 41207 on its rail; one headroom ray at the way in ran along a rail's end, so a
runner sliding off it rode up its last centimetres (three rays across the footprint now). And one kept as the law has
it: a body stood inside a closed solid whose top no body stands on - a sweep's station on W0000005's altar plinth,
inside the altar block 41831, 1.25 m under the ceiling - meets the block's faces from inside, as DFU's controller meets
a MeshCollider's, where PH1 had lifted it onto the block (16 of 66,144 runs; no body walks into the block). An exemption
for a body begun inside a solid was measured and dropped: insideSolid's parity reads a dungeon room, a shell open below
its ceiling, as solid at 1,378 of W0000005's 2,191 open floor stations, and asked of the floor's own model it still
undid 32 of N0000037's refusals at its rooms' own ledges.

NOT DONE. A walker's eye (1.7 m) passes through the 1.65 m boards' lowest 5 cm for three or four frames as it walks
under one - the boards stay a ray's, never a walker's, because a walker's capsule there is the report's own snag. A
foe's walk probes (AttemptMove's obstacle cast) meet a board as DFU's controller is met, so a foe may detour round a low
board its body would pass. A POI-authored 437xx model (poiHost) is not marked. One run of 34,464 in N0000037 stops at
63030's corner where the parent slid round it through a PH1 lift onto a 45-degree face under an overhang. Two runs in
RESIAM02's interior 4 now end on a chair (41102): refused the table behind it, which the parent climbed onto from the
chair, they stay on the chair.

PINS: `test/world/fb1025i_signsnag.test.js` and `test/player/fb1025i_railhang.test.js`, on made meshes and on ARENA2's
own signs, fences, benches, TVRNBM04, Privateer's Hold and W0000005's altar, through the real PlayerMotor, EnemyAI and
Collider; mutants `tools/mutants/fb1025i_signsnag.json`. PIN MOVED: arena1_model, fb1019f_rockclear, squeeze1 and
incident_ceiling_bats (the foe's walk hands its ground; move's `onGround`), fb1014b_doorjam.json and fbsea.json
re-aimed; audit0929_actions back to the walk it was; strengthened: fb0929d_waterwalk (WW-LID S, L, B),
auditdisc28_motion (MO-1).

## AUDIT FB1025i (2026-10-25/26) - the slices, read cold

The owner: "Audit this". Seven cold lanes, A-F on the frozen head `225ab25c9` and G on `e2d83ca560` once item 7 landed
(Home.md's DO NOT FIX WHILE THE VERIFIER IS READING: each read its own worktree, nothing edited), each reproducing its
findings against the real modules, the real Worker and the freeware's data before reporting them. The fixes came after
every lane of a slice had reported, each by the slice's own author but lane A's (the lead's own slice). Verdicts:

| Id | Severity | Finding | Verdict |
|---|---|---|---|
| A1 | should-fix | NAME-KEPT parsed a name by the lines it had: a cursed Rare's curse line (added after its name) froze its name stale, about a fifth to a quarter of them | FIXED: a name is the ladder's when it is its words around the piece's BASE, read off the piece (linesName) |
| A2 | should-fix | A name an older reforge gave a set gem's word kept it for good once the gem was unset, sometimes doubled | FIXED: the same law |
| A3 | should-fix | Names the old law had broken stayed broken - the reporter's own ring | FIXED: the same law at a reforge, and on load for a crafted piece (repairCraftedNames) |
| A4 | should-fix | The Imbue still named a questline's reward from its template (on main before) | FIXED: the Imbue asks linesName |
| A5 | should-fix | A partial rename ("Porter's Pride") read as the ladder's and cut | FIXED: the same law |
| A6 | nit | Four mutants of NAME-KEPT survived | FIXED: the law rewritten, its 14 mutants 13 dead, 1 equivalent as recorded |
| A7 | nit | The record the pins cited did not exist at the head | FIXED: this record |
| A8 | nit | A dismantle asked of either Warden read alike | FIXED: wareName names the set, both packs |
| A9 | nit | The Broker's words are English literals | OPEN: as they were (L10N4's count) |
| B1 | blocker | A second kind of daedra hurt after the take pulled the quest's heart OUT of the pack onto its body (the host matched by quest and symbol; DFU's GiveItem by the record) - the report's likely cause | FIXED: HEART-KEPT - a foe's copy is marked `questClone`, and the held read is the quest's own record's (`itemTransfer.js` heldQuestRecordIndex, out of bootWorld) |
| B2 | should-fix | The pin's rig hand-built the held read, so it could not see B1 | FIXED: the rig reads the host's own law |
| B3 | should-fix | S0000503's hoard struck on a look and a walk out | FIXED: struck by its item held alone |
| B4 | should-fix | A save from before kept the old latch | FIXED: each rebound objective names a mend (`reread`), read again once |
| B5 | nit | Pin gaps; two redundant open terms | FIXED |
| B6 | nit | The Enhanced trade rows drew a quest item unmarked | FIXED |
| B7 | nit | No record | FIXED: this record, Questlines-Arc 2.2 |
| C1 | should-fix | The report's "size aware" was left open, called the owner's call on no record | FIXED: a 3D crown's glints grow with its size on screen, bounded at twice (6 to 12, up to 28 px at 1080 rows); herbs and flats unchanged pixel for pixel |
| C2 | nit | The doc's counts were the pin loop's | FIXED: 95 records, 93 with a prototype, 74 scaled |
| C3 | nit | A clamp of the row's scale survived | FIXED: 0.8 and 1.2 pinned |
| C4 | nit | A crown past the top of the screen spends a tenth of its tries off it | OPEN: named |
| C5 | nit | The crown box's depth is its reach (before this branch) | OPEN: named |
| D1 | should-fix | A0C00Y17's watch branch refused is the same 600-gold stop with no stray blow | FIXED: the road named the likely cause, not a proven one; the branch pinned as DFU's own |
| D2 | should-fix | A stood hostile road traveller killed by anyone was the player's Murder | FIXED: the pool names whose hand (`killedBy`); a slaying on the player's kill alone |
| D3 | should-fix | Online, a fight on a party member near me was no fight to PROTECT-FIGHT | FIXED: `encounters.js` fightNear, a peer's puppets in the classic spawn band too |
| D4 | nit | The strike's `open()` gate was held by a text pin alone | FIXED |
| D5 | nit | bootWorld's ceiling did not come down | FIXED: at the host as measured |
| D6 | nit | Two Ledger rows for one departure | FIXED: one row, PROTECT-FIGHT's |
| E1 | blocker | An own thing the draft set down and took down again was LOST on Discard (on main before) | FIXED: the owner's moves one journal, undone in reverse (`systems/decor/decorPack.js`) |
| E2 | blocker | flushStagedUse deleted a staged chest's goods on Confirm (#1223) | FIXED: its Access through the realm's act |
| E3 | should-fix | Discard stood a piece again with no item behind it | FIXED: the take-down kept staged, said |
| E4 | should-fix | #1223's cross-room Discard also replaced the other room's pieces and own things | FIXED (docs): named; the keep covers own-thing pairs |
| E5, E6, E7 | nit | A mutant's why; the give-back unsaid; a second path unpinned | FIXED |
| E8 | unproven | A draft left mid-flight stranded a caravan's staged goods | FIXED: proven by reading; returnUnstood at the restore |
| E9 | unproven | A thing taken down and then equipped was pulled out while worn | FIXED: proven; decorPackTake refuses it |
| F1 | blocker | The keep could launder a copy: it lifted on the possessed lists' count, and a copy off them (a deserter's take, the ground) survived it | FIXED: the keep walks the whole save and lifts only where its own act leaves one, or on a staff Remove's evidence; `revenantMayTake` refuses a realm-locked piece |
| F2 | should-fix | `lifted` said what the re-check refused | FIXED: written by the DELETE's own rule, re-read after |
| F3 | should-fix | The confirm's seq guard read the preview's row (on main before) | FIXED |
| F5 | should-fix | The keep could delete the account chest's only live piece | FIXED: a bin copy is an extra only where the lift is the record's |
| F6 | should-fix | The kept copy's print was unpinned, and a wrong-print copy could be kept | FIXED: the first whose print is the row's |
| F7 | nit | Two survivors | FIXED: `unclear` does not lift; no lift, no finding |
| F8 | nit | acct190's history line overwritten | FIXED |
| F9 | doc | The docs false under F1, F2, F5 | FIXED |
| G1 | blocker | RAIL-HANG's cap stopped walkers at the dungeons' block-seam ramps (0.501-0.505 m under the next floor) - 458 of 1,597 crossings over ten dungeons lost, Privateer's Hold among them | FIXED: the cap is gone; 1,597 of 1,597 cross, pinned on Privateer's Hold's own seam |
| G2 | should-fix | The cap made every bench (0.55 m), bed (0.61 m) and the throne a jump, and a gutter trapped | FIXED: the law is the headroom alone - PH1 sets a walking body on a floor only where it fits standing (`collider.js` `_standsOn`, three body rays), else the floor is a wall; benches, beds and the throne as before |
| G3 | should-fix | signSolid.js re-declared #1241's sign range | FIXED: it imports `houseSigns.js` isShopSignModel |
| G4 | should-fix | SIGN-PASS's departure had no Ledger row | FIXED: the row, Port-Status's tally, 19 cites moved by citeShift and the rest by hand |
| G5 | should-fix | Every ray passed the boards: activation, arrows, spells, foe sight, the camera | FIXED: a hung board is a sight triangle - every ray meets it, no body does |
| G6 | should-fix | Foes (gravity in every step) still hung on fences | FIXED: `move` takes `onGround`, EnemyMotor's walk passes it (20 of 20 to 0) |
| G7, G8 | nit | Survivors; `_floorCeil` without finally | FIXED |

Found sound, among the lanes' own checks: REFORGE-REPLACE (#1265) replaces carrying capacity at both doors; the Broker's
sale law marks nothing it did not give, on every save, clock and checkpoint path, and the screenshot is 2026-10-25's
stock; Q0C4XY04's waves, its foes' heart and `toting` as DFU's; `run.size` scaled on every path that builds a run;
ROAD-SPARE's swing tail identical in 20 cases; the decorator's Discard after CHEST-DRAFT keeps every chest as it lies;
ledgerStep byte for byte main's, and the lift's SQL re-asked inside its own DELETE; the 1 m sign line parts all 56
records.
