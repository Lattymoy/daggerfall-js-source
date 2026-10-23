# FIELD BUGS 2026-10-19f - the private reports, read to their roots

The 56 reports open in the private-report inbox (PRIVATE-REPORT, `server-account/src/reports.js` - 51 bugs and 5
exploits, sent 2026-10-18 and 2026-10-19 from updates 0.0.233 to 0.0.260), read on the code as it stands at main's
`9e00d52e9` (update 0.0.265). The owner: "Look into the bugs as one PR". The inbox is private - a report is read by the
handles `REPORT_READER_HANDLES` names and nobody else - and this repository is public, so this page names no reporter and
quotes none of their words; an exploit is described only as far as its fix needs. Each report was traced end to end on
the real producers, most with a repro; several were already fixed by a record newer than the build they were sent from
(the update a report carries is its build - REL8 numbers every merge to main).
Renumbered 19f at the merges of main: main's FIELD BUGS 2026-10-19b (the #suggestions batch), 19c (the crafting odds), 19d
(the Gauntlet's slain Casters) and 19e (LORD-SHARES) took the earlier letters, so this record's pins are `fb1019f_*` and its mutants
`fb1019f_*.json`.
At the second merge, main's PLAIN-SWEEP (`10-UI/Plain-Words.md` section 6, its law 6) was in force: the nine lines
this record added that hung a clause off a dash or spoke in the house's words were said plainly - the staff mend's three
refusals (`account.refusal.mendNotNegative`, `mendMoved`, `repairTicket`), DISENCHANT-SAID's reason
(`prof.page.enchant.under`), STEED-KEPT's line (`rvn.took.home`), TOWN-EXIT's shut gates (`travel.gatesShut`, retired since with TOWN-EXIT) and
COMPANION-DROP's three (`wild.companion.stays`, `away`, `left`) - drafted again in every language that holds them,
their pins moved to the new words and their mutants re-run dead. The quotes below are the words as they now stand.

Twenty-two fixes, below - twenty-one standing: TOWN-EXIT was retired at the fifth merge of main for main's OW-TOWN-WALK,
which walks the same way out (its section says so). Eight of them are the owner's calls, asked and answered on 2026-10-19 (each section says so):
SIDE-ONCE, DISENCHANT-SAID, COMPANION-DROP, STEED-KEPT, BOSS-DOT, DUEL-BAR, DISEASE-UNWELL and ROCK-CLEAR. What is
not fixed here - not proven, the design as chosen, or a restore only staff can make - is under "What is not fixed
here", with what would prove each.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Exploit: a Weir Key moved to the wagon is back in the pack at the next sign-in; and a bug: a pack of eight Weir Keys lost on using one | The pack's key is only the FACE of the account's balance, restacked off the pack alone - a face in the wagon was never seen, the pack was minted another, and one use reset the pack to the balance far below (the "lost" keys were never the account's) | KEY-FACE |
| 2 | Exploit (two reports): one side effect's setting picked again and again in the item maker, each copy paying into the budget; and an effect with every option taken left in the list | DFU's own rule (`UserTakesDamage.cs`, `ItemDeteriorates.cs` allow a setting twice), ported as it was | SIDE-ONCE (the owner's call) |
| 3 | Exploit: a companion's bag shelters the pack from a death in the open zone | The zone's drop takes the pack and the cart; a companion's bag was never read, and sending him off from inside the zone took it out | COMPANION-DROP (the owner's call) |
| 4 | Exploit and bug (two reports): entering a home, the furniture moved and boxed the player in; a table loaded in around the player | An online home's own pieces land after entry, each solid as its model loads, on the player wherever they stand | DECOR-CLEAR |
| 5 | Disintegrate deals nothing to the breach bosses, the Abyss's Remnant or the arena's rival | The relay's bodies are local stand-ins of 1e9 health; a Disintegrate claims all of it, and every wire refuses the claim | STAND-IN-WHOLE |
| 6 | Continuous Damage lands only its first hit on a breach boss | The stand-in forgets every lasting effect; Soul Trap alone was carried (WBX7) | BOSS-DOT (the owner's call) |
| 7 | A Legendary bow's power shows nothing | Chain Lightning's arc hurt its foe silently; Cast When Strikes is DFU's spell on the target, with no missile | CHAIN-SEEN; an element's colour and a strike's visual are requests (below) |
| 8 | The Gauntlet ("Silence the casters") stuck at three though every caster was silenced and killed | A caster was silenced by standing on its plate alone; nothing marked the plates or named them (WINCH-PLATES fixed the Winch, not this) | GAUNTLET-PLATES; and main's GAUNTLET-SLAIN (`Field-Bugs-2026-10-19d.md`) made a slain caster silenced |
| 9 | The town map's Find me goes to the town's lower right, wherever the player stands | Find me knew the world map only: the town map got the world map's middle pixel as the player | FINDME-TOWN |
| 10 | Pathfinding out of a walled town traps the player in a corner | A journey from inside the start pixel's town had no leg out by a gate: it aimed through the wall | TOWN-EXIT, retired for main's OW-TOWN-WALK (below) |
| 11 | Stuck in a lift; /unstuck on its cooldown | A mover re-placed every frame carries only a body standing on it, and only as far as the world lets it - a rider meeting a lip is left inside the lift | MOVER-BODY; the cooldown is PVPUNSTUCK's (below) |
| 12 | Clipped out of a dungeon when a floor lowered onto them underwater | The same mover law: a swimmer is never "on" it and is driven through the floor; a dungeon had no void rescue | MOVER-BODY, VOID-DUNGEON |
| 13 | Fast travel left the character inside a mountain | UNSTUCK-OUT's open question: rocks built after the body stands are not pushed off it | ROCK-CLEAR (the owner's call) |
| 14 | Can't buy spells at the Mages Guild (two reports) | Under the default skin the shop's "no spellbook" and "not enough gold" notices drew on a renderer that paints nothing, and stayed up unseen, swallowing the next press | SPELLSHOP-SAID |
| 15 | A guild offers no quest - "That service is not available yet" (two reports) | DFU's rule (a questor with a quest open offers nothing), told in words that say the service is unbuilt | QUESTOR-SAID |
| 16 | An item's invisibility stops after travel until worn again | A landed blow breaks concealment - and deleted the item's held entry with it, so DFU's reroll never cast it again | HELD-CONCEAL |
| 17 | A disease warned of at rest, with no tile or name until the character died of it | DFU's incubation law: a disease shows once incubation is over; a long rest or journey passes it with the HUD hidden | DISEASE-UNWELL (the owner's call) |
| 18 | In a duel the player's own health bar never drops | The design: a duel never touches the save's health, its vitality the referee's (Integrity-Arc 5) - shown only as a small line | DUEL-BAR (the owner's call) |
| 19 | Greaves and pauldrons can't be disenchanted | PROF12's law: 50 and 40 points make no Essence (100 makes one), and the station hid them without a word | DISENCHANT-SAID (the owner's call) |
| 20 | A horse gone after a death in a dungeon | A revenant's kill may take one of the pack's most valuable pieces - a horse or a deed among them | STEED-KEPT (the owner's call) |
| 21 | Gold and carry weight below zero after a big sale | TRADE-WRAP (`Field-Bugs-2026-10-18b.md`, update 0.0.249) fixed the wrap; a purse already below zero could not be mended - the staff repair takes no purse | PURSE-MEND |
| 22 | An ancestor's inheritance missing where they died, in another player's dungeon | The remains lie in the build they fell in - an instance is built whole - and show only in a build of that size, which the heir's public visit never is | HEIR-WHOLE; the bank's share is ESTATE-WIDER, the owner's open (below) |
| 23 | A revenant missing from its lair (four reports) | Fixed after these builds: LAIR-REACH, LAIR-HOME, LAIR-WALK (`Field-Bugs-2026-10-19.md`) | already fixed |
| 24 | At sea, "enemies nearby" refuses the Overworld after a fight | Fixed after this build: RAID-WON (`Field-Bugs-2026-10-19.md`) | already fixed |
| 25 | Two million in letters of credit gone | All four doors `Field-Bugs-2026-10-18b.md` closed were open in this build (update 0.0.241); which took them is not proven | already fixed; a restore is staff's (below) |
| 26 | Twenty-three more | Not proven, the design as chosen, or a restore | "What is not fixed here", below |

## KEY-FACE: a Weir Key's face never leaves the pack

`src/systems/eliteGates/weirKeyRow.js` (the row), `src/systems/eliteGates/weirKey.js` (`foldStrayWeirKeys`),
`src/systems/save/save.js` (`restorePlayer`), and the Elite Gates arc's section 5 (`11-Multiplayer/Elite-Gates.md`).

FOUND, on the code. The account's count (`players.eg_keys`) is the balance. The pack's Weir Key stack is only its FACE
(EG-PLAY, section 5). The client restacks the face to the balance by reading the PACK alone
(`egClient.js:"    if (restackWeirKeys(entity.items, n)) saved();"`). That happens at sign-in and every
`EG_KEYS_EVERY_MS`, ten minutes (`egClient.js:"      if (Date.now() - keysAt >= EG_KEYS_EVERY_MS) askKeys();"`), and
on every preflight, open and claim answer. A pack that holds no face is given a fresh stack
(`weirKey.js:"  if (n > 0) items.push(weirKeys(n));"`). But a face could leave the pack. The row was `bound` and not
`packOnly`, and a bound piece goes to the player's wagon and storage
(`itemBound.js:"export const BOUND_KEEPS = Object.freeze(['wagon', 'storage']);"` - a home's chest, a ship's hold and a
companion's pack are all the pack's `storage`). So a key stowed in the wagon disappeared from the pack. At the next ask
the pack was given a new face, and every ten minutes that happened again. Driven on the real client (`createEgClient`,
one key held): seven stows over seventy minutes left the wagon holding seven faces and the pack one. Emptied back, the
pack showed eight. Then one use staked the one real key, and the answer (balance 0) took every face the pack showed:
*The key turns to rust.* (`egClient.js:"if (weirKeysHeld(entity.items) - spent - opensKept().filter((p) => p.s === me()).length > n) say(EG_TEXT.rust);"`).
To the player, that was eight keys lost at one use. Nothing the account held was lost: the service's count was right
all along, and the rust took the faces it never counted. The same thing happened through every place a bound piece is
allowed to go.

THE FIX - THE FACE IS THE PACK'S ALONE. The row is pack-only
(`weirKeyRow.js:"  packOnly: true,   // KEY-FACE: the face never leaves the pack"`), the Wallet's and the Card Binder's
law (WALLET1, `06-Systems/Wallet.md`; `itemBound.js:"export const isPackOnly = "`). Every door that already reads it
now keeps the face in the pack:
- both skins' put to the wagon, to storage, to a container, to the ground and to a reward tray, and the enhanced pack's
  drag and its bulk Store, which refuse it with *Weir Key stays in your pack.*;
- the shift-drop (`physicalItems.js` `shiftDrop`);
- a room's decoration (`decorItems.js` `decorStandOf`, AUDIT 625 W1 - a face could stand as a piece before: its painted
  archive passes the decor bounds);
- a revenant's take (`revenant.js` `revenantMayTake`, W2).

Every other way out of the pack already refused it as a bound piece, and still does: the trade (`tradePack.js`), both
counters' Sell and the keyed shelf, the realm market (`marketLaw.js` `boundRecord`), a death in the zone
(`wildDropLaw.js` `wildCanLose` -> `tradeableRecord`), a peer's lists (`unbound`), the salvage, the Reforge, the fleet's
melt and the junk sweep. The rest never take one: the repairer takes a damaged piece and nothing wears a key; the court
takes stolen pieces; letters carry words alone; an heirloom is a worn weapon or armour. Several lists hold faces from
before the fix: the wagon, a storage piece, a chest, a ship's hold, a companion's pack, a room's own things, or a body
the find threw one on (`egFind.js:"  if (onBody) entity.items.push(weirKeys(1));"`) that the player never took up. Such
a save loads with every face out of the pack folded away
(`save.js:"const strayKeys = foldStrayWeirKeys("`). The fold runs beside the load's item repairs, over every list the
save holds but the pack (the one walk, `savedItemLists`) and over each scene's `decorOwn` (one item a piece, no list).
It runs before the scene cache and the hosts take their copies. SS1's `restackStones` is the shape: a load-time fold in
the save. The pack keeps its own face, and the balance restacks it whole at sign-in. A face out of the pack counts
nothing, so nothing of the account's is lost. A taken-down piece whose own thing was folded is "only taken down"
(DECOR2a's own arm for a piece whose item the save does not hold).

The item law reads no `packOnly` (`itemLaw.js` `lawTemplate` reads the row for its worth and its group), so no law
version moves and the service's judge is untouched. `int1_itemlaw`'s leaf-equals-registered-row pin holds as it stands,
because both rows carry the mark. No host grew: the fold is `weirKey.js`'s, and the load calls it.

Left open, the arc's call: the find's own throw is the one face still made outside the pack. A face thrown on a body
(pack at the balance less one) and taken up only after a later answer restacked the pack to the full balance makes the
pack one over, and the next answer says *The key turns to rust.* for that one face. The account loses nothing. A load
in between folds it (above). A fix needs EG-E3's throw changed: either the restack counts the faces still lying on the
bodies the find threw onto, or a face taken into the pack is folded to the last balance heard. That is the arc's call.

- **Pinned**: `test/net/eliteGates/fb1019f_keyface.test.js` (5 tests):
  - the row: pack-only, the leaf's and the registered row's; every place refuses a face while a bound ember still goes
    to the wagon and storage; a room's decoration stands no face (its picture and its numbers would stand it) and a
    revenant takes none;
  - both skins: DFU's Remove into the wagon and into storage on the classic skin, and the card's *Stow in wagon* and
    *Store* on the enhanced pack, each refused in its own words with the face kept;
  - the bug's record on the real client: seven stows through DFU's Remove over seventy minutes of balance asks, then the
    wagon emptied back. One face, and a use stakes it with no rust;
  - the fold by itself: lists and records, nothing else touched, each face counted once;
  - the load: a save holding faces in the wagon, a storage piece, a chest, a room's own things, a ship's hold, a
    companion's pack and a body the find's own throw put one on. It loads with all 16 folded and said, everything beside
    them kept, and the pack's own face kept. No list but the pack shows a face, and the balance then makes the pack eight
    and a use says no rust.

  PIN MOVED: none. `tools/mutants/fb1019f_keyface.json` (13 mutants, all dead): the row not pack-only; the load folding
  nothing, folding the pack too, or not reading the room's own things; the fold leaving a list, blind, leaving a record,
  counting a face twice or counting records; and each door's reading of the mark (both skins, the decoration, the
  revenant's take).

## SIDE-ONCE: a side effect's setting is picked once

`src/systems/enchantmentCatalogue.js` (`ITEM_MAKER_EFFECT_FLAGS`, `primaryPickerList`), `src/systems/item/itemLaw.js`
(makerFindings' `many` - a comment only, the law unchanged).

FOUND, on the code and on the real `ItemMakerWindow` (the item law and the magic round beside it). A player's private
report: the item maker let the same side effect's same setting be picked again and again up to the ten-row guard, each
copy adding its negative cost to the budget. It is DFU's own rule, ported
faithfully: UserTakesDamage and ItemDeteriorates set `AllowMultiplePrimaryInstances | AllowMultipleSecondaryInstances`
(`UserTakesDamage.cs:35`, `ItemDeteriorates.cs:37`), and the secondary picker leaves an already-picked setting out only
when the Secondary flag is absent (`DaggerfallItemMakerWindow.cs:849-855`); the port carried both (both effects
`1 | 2` in `ITEM_MAKER_EFFECT_FLAGS` at main's 9e00d52e9, and the same test in primaryPick's filter), and the item law
counts the maker's rows by effect, so the stacked blade carried no finding. Its cosmetic sibling, the same
window: an effect whose every setting is taken - Health Leech with all three, Bad Reactions From with all three - stayed
in the side-effect list and opened an empty chooser, because the primary filter asks whether the EFFECT may be taken
again, never whether a setting is left (`DaggerfallItemMakerWindow.cs:644`, `:689`; `HealthLeech.cs:37` allows more
than one primary).

THE FIX (the owner, 2026-10-19: "One copy per setting"). A departure from DFU (Port-Ledger A, below): neither effect
carries `AllowMultipleSecondaryInstances` now (`ITEM_MAKER_EFFECT_FLAGS` gives both `1`), so `primaryPick` hides a taken
setting as it hides every other effect's - in sunlight AND in holy places is still two rows, in holy places twice is
not; no effect carries the flag (a setting a bound soul's forced set brought in counts as taken, as it always did for
every other effect; the other order - the setting picked first, then a soul whose forced set carries it - still lays
the setting again as a FORCED row, DFU's own (`DaggerfallItemMakerWindow.cs:869-906` adds the forced set with no
dedupe), for no budget: a forced row costs nothing (`totalEnchantmentCost` leaves forced rows out), AUDIT FB1019f A4).
And `primaryPickerList` drops an effect whose `primaryPick` would offer nothing, so an
effect with every setting taken leaves the list (User Takes Damage once both are on, Item Deteriorates once all three
are). One list serves both skins: the Enhanced skin's Add side effect presses the classic button, and its list draws the
classic picker's rows (`ui/enhanced/enhancedPicker.js`) - driven both ways in the pin.

A PIECE MADE BEFORE KEEPS ITS COPIES (the owner chose no refund and no fold). The law is not tightened: makerFindings
still counts by effect (`many` reads the primary flag, which both still carry), so a piece enchanted under the old rule
passes in the save and on the wire - a law tightened after the fact would read those honest pieces as forged and hold
their owners' trade, which is MAKER-KEPT (`01-Overview/bugs/Field-Bugs-2026-10-16c.md`).

WHAT IT LEAVES. The service does not yet tell a piece made after SIDE-ONCE from one made before - the owner's open, below.

- **Pinned**: `test/systems/fb1019f_sideonce.test.js` (4, on the real window, the classic picker and the Enhanced skin's
  'Add side effect' and list side by side: a taken setting gone from its chooser and the effect's other settings still
  offered (User Takes Damage, Item Deteriorates); the report - "in holy places" asked for ten times lands once, the label
  -1000/1800; Health Leech, Bad Reactions From, User Takes Damage and Item Deteriorates each gone from the list with
  every setting taken; the item maker's own write of a setting taken nine times, its powers past the blade's budget,
  passing the law in the save, on the wire and `lawfulItem`). PIN MOVED: `test/systems/enchantmentcatalogue.test.js`
  ("the flags": no effect allows the same secondary twice, both flags `1` - was `['ItemDeteriorates',
  'UserTakesDamage']`; "the secondary list": Item Deteriorates' chooser without its taken setting, `[1, 2]` - was
  `[0, 1, 2]`, "all three stay"). `tools/mutants/fb1019f_sideonce.json` (6, all dead: either flag given back DFU's
  `1 | 2`; the empty chooser listed again; the last setting read as none; the law counting by the secondary flag; the
  law tightened to one copy per setting). The honest sweep (`test/honestItems.mjs` makerSession) drives the same
  `primaryPickerList`/`primaryPick`, so its makers follow the new rule; `int1_itemlaw` and the server judges green.
  Doc: `10-UI/UI-Arc.md` M4, "SIDE-ONCE".

## COMPANION-DROP: a companion at your side drops his pack in the zone, and none is sent off from inside it

`src/systems/wild/wildDropLaw.js` (`WILD_REVENANTS_MAX`, `wildSwornAtSide`, `WILD_PACK`, `wildPacks`, `wildPacksOf`;
`takeWildDeath`, `takeWildGold`, `wildDropCandidates` and `wildTakeTook` read the packs), `server-account/src/wild.js`
(`answerOf`'s `gold.packs`), `src/net/realm/realmGoldLaw.js` (`NAVAL_VENDOR`, `REVENANT_VENDOR` exported),
`src/systems/naval/crewCompanions.js` (`heldAtSide`, `packStaysAshore`), `src/scenes/naval/navalHost.js` (`companionPress`'s
one line, `stowPack`'s boat), `src/systems/revenant/revenantCompanions.js` (`swornAtYourSide`, `leaveRefusal`, the party,
`sendRevenantAway`, `errandRefusal`, `giveSwornGear`, the knock's `leftWithYou`), `src/ui/companionRoster.js` (Send away),
`src/scenes/world.js` (`wildDropTaken`'s take, the slots' hold), `src/systems/wild/wildZone.js` (the words).

FOUND, on the code. A death in the open zone takes what the account service takes off the fallen's record
(`takeWildDeath`, INT9) - and that law read the bag and the cart alone
(`wildDropLaw.js` takeWildDeath's `bag` and `cart`, no list beside them). Nothing read
a companion: a crew hand's pack (COMPANION-KIT, saved in the sea's record, `party`) and a sworn revenant's pack and kit
(REVENANT-COMPANION, RVN-GEAR, in the feud's record, `list`) were outside the drop, and no companion code asked where the
player stood - sending a hand back aboard stowed his pack in his boat's hold (`stowPack`), sending a sworn one away or
on an errand took its pack and kit out of the zone with it, and a knock-out did the same. So the pack's loot and spare
gear put in a companion's keeping came through a zone death whole. The owner's precedent, CART-AWAY (2026-10-15):
storage WITH the player drops, storage parked outside the zone keeps.

THE FIX - THE OWNER'S DECISION (Mac, 2026-10-19, answering this session's questions): "Bag drops; no send-off in zone".
- AT THE SIDE, as CART-AWAY's cart is with the player: every crew hand ashore - he walks with the player through every
  door, so he is where they fall (with the naval arc switched off too: his record still says ashore, as the mod-off
  wagon goes where its owner goes) - and the sworn walking with them, in the zone the first `WILD_REVENANTS_MAX` the
  record lists (`wildSwornAtSide`; the zone's party stands that same one, `swornAtYourSide` - PVPDUNGEONS' "the rest
  wait outside it"). `WILD_REVENANTS_MAX` moved to the drop's law (the Worker's leaf), `revenantCompanions.js` re-exports it.
- THE DROP (`wildPacks`, one shape at both ends): each pack at the side is read as the cart is - its pieces join the drop
  by worth through the same `wildCanLose` (a letter drops, LETTERS-DROP; a bound, quest, wallet or kept-back piece and the
  consumables stay), a piece the ledger keeps stands aside in its pack, its coin's share joins the one gold pile, and what
  a full remains will not take goes back to its own pack. DECIDED here, named: a sworn one's KIT drops as its pack does -
  its pieces are the player's, given from the pack and taken back at will, worn by the companion and never by the player,
  so the player's own worn law (kept on a death to a foe, the killer's one pick) is not theirs; left out, the kit would be
  ten slots of shelter.
- THE RECORD DECIDES, NO WORD: the service reads who is at the side off the record it keeps (`wildPacksOf`: the sea's
  `party.party`, the feud's `list`), so a tab cannot keep a companion's pack by saying anything; its answer names each
  piece's pack (`from`: `crew:<boat>:<name>`, `sworn:<id>`, `kit:<id>`) and each pack's coin share (`gold.packs`), and the
  fallen's game takes exactly that out of its own live lists (`wildTakeTook`'s `packs`, world.js `wildDropTaken`) - a
  piece whose pack is not there is left, never another list's piece of the same marks.
- NO SEND-OFF IN THE ZONE, in the companion modules: a hand ashore is never sent back aboard (`heldAtSide` - the host's
  one line in `companionPress`), the sworn one at the side never sent away nor on an errand (`leaveRefusal`, in
  `sendRevenantAway` itself and `errandRefusal`; the roster says it; the slots' hold picks another), each said plainly
  (PLAIN-SWEEP, `10-UI/Plain-Words.md` section 6): "Bran stays at your side until you leave the Wrothgarian Mountains."
  (`WILD_TEXT.companionStays`, through the text core). Nothing of mine is given as kit to a sworn one waiting outside the
  zone (`WILD_TEXT.companionAway`).
- CARRIED OFF IN THE ZONE - the same exploit by a knock-out: a hand knocked out or fallen from her roster gives his pack
  up into my pack, never her hold (`packStaysAshore`, read in the host's `stowPack` - every way his pack leaves him goes
  through it), and the sworn one at the side knocked out hands me its pack and its kit before it goes, said once
  (`leftWithYou`, `WILD_TEXT.companionLeft`).
- Not changed: a desertion or a betrayal in the zone (RVN11b/c) keeps its split - what it keeps is its own, won back only
  by felling it, never a shelter. Hosts: `createNavalHost` +2 logical lines (the refusal's `if` and its return) and one
  expression; `bootWorld` +1 (the slots' hold's filter) - `test/scenes/hostceiling.test.js` holds. THE FOUR HOSTS: the
  companions ride one layer (`crewAshore.js`) in the street, buildings and dungeons; the drop is the account service's and
  `world.js`'s one `wildDropTaken`; `exterior.js` stands no companion - FLAGGED, as CREW-COMPANIONS is.

FOUND, NOT FIXED (the owner's call - each is the same shelter by a door that is no companion's): CARGO-ANYWHERE
(`scenes/holdDoor.js`, the owner 2026-10-17: "Cargo should be able to be accessed at any time") opens a ship's hold from
anywhere, the zone included - a pack stored there from inside the zone is outside the drop, as a companion's was; and a
boat placed on the zone's water keeps her hold through a death there, where CART-AWAY drops a cart parked on the zone's
ground.

- **Pinned**: `test/systems/fb1019f_companiondrop.test.js` (7: who is at the side on the real naval host's party and the
  real feud's sworn, a hostile record listed ahead of them never at her side (AUDIT FB1019f B3) - the zone's party the same one; the law over the record - each pack's pieces by worth and by name,
  what never changes hands kept, the coin's share, the kept piece, the full remains, the twin record by default; through
  the real account service and back into the live lists; no send-off - the boat's picker, send away, an errand, a gift
  outside the zone, the one waiting outside free to go, all as before outside the zone; carried off in the zone - the
  hand's pack into mine, the sworn one's pack and kit handed over and said once, neither outside it, and one carried off empty-handed saying nothing
  (B4); a tab from before the word refused a take of the packs, a seizure taking it whole, a fall with no pack's piece taken
  as before, and a companion's coin alone said to the risen (B2, B5)). PIN MOVED:
  `test/net/int9_wild_ref.test.js` (the game's take names its companions' packs), `test/systems/revenant/revenant_audit.test.js`
  (the slots' hold never the one at my side in the zone), `int9_wild_ref`, `fb1014_pvpescrow` and `fb1015_cartaway` (the call
  read through `wildFallWords`, B2). `tools/mutants/fb1019f_companiondrop.json` (59: 58 dead, 1
  equivalent - a pack's coin put back, as the cart's, never runs: the gold is the second record and always fits).
  Re-aimed by content (each re-judged: dead): `fb1015_cartaway.json`'s CART-AWAY-the-gold-share-still-taken (onto
  `takeWildGold(entity, { cart: withCart, packs })`), `revenantaudit.json`'s AUDIT-A5-the-pack-destroyed (the release's
  hand-back, now `handBack`), `rvngear.json`'s RVN-GEAR-release-forgets (the release's own line - the knock's hand-over
  reads the same pack and kit), `auditwatchkit_net.json`'s LD-H-stow-empty-said (`stowPack`'s boat line); for B2, `fb1014_pvpescrow.json`'s
  ESCROW-the-escrow-asked-of-any-room and `fb1015_cartaway.json`'s CART-AWAY-the-host-says-nothing (both dead).
  ACCOUNT DEPLOY (acct163, with PURSE-MEND - AUDIT FB1019f A1): the Worker's leaf, one field of its answer (`gold.packs`)
  and one of the fallen's ask (`packs` 1) - no relay frame, no migration; the two deploy in either order.

A TAB FROM BEFORE IT (AUDIT FB1019f B2). The fallen's own ask says its game reads the packs (`packs` 1, `wildDropLaw.js`
WILD_FALL_PACKS, said beside the wagon's word by `wildDeath.js` wildFallWords). A game from before the word read every
piece not the cart's as the bag's and no pack's coin: handed a take of a pack, it stripped a piece of the bag (a worn one
too) that matched the companion's, and left his piece and his coin in his pack after the record had dropped them - his
coin back twice at its next checkpoint. A take of a pack (a piece or a coin share, `wildTakesPacks`) asked without the
word is refused (`not-found`, the old build's word every shipped game shows as "The game may need updating"), and nothing
moves. The take is never made smaller: a missing word that shrank the drop would let any tab keep its companions' packs by
leaving it out. A fall at another's hand so refused is taken whole by the killer's seizure after the grace; a death to a
foe drops nothing until the tab says the word, as a game that never asks keeps already. A risen player whose take was a
companion's coin alone is told so (`wildDeath.js` wildTookAny, B5).

THE ZONE'S WORDS A LEAF OF THEIR OWN (found at the integration). The fix first had the companions read
`WILD_REVENANTS_MAX` and `wildSwornAtSide` from `wildDropLaw.js`, and STEED-KEPT had a revenant's take read
`WILD_NEVER_GROUPS` there - pulling the drop law's whole graph, the item law among it (which installs itself on the
wire's door, `loot.js setItemLaw`), into every client graph that stands a revenant: SIGIL1's, CURSE-SYNC's and SET4's
wire pins went red on their hand-built pieces. The three words need no graph: `wild/wildLeaf.js` holds them with no
imports (`wildLeaf.js:"export const WILD_NEVER_GROUPS = Object.freeze(new Set(['Transportation', 'Deeds', 'QuestItems', 'Currency']));"`),
`wildDropLaw.js` re-exports them for its readers and the account service, and the two modules read the leaf. Two of
this list's records follow their lines to the leaf (52 dead, 1 equivalent as recorded, with STEED-KEPT's).

## DECOR-CLEAR: a home's late furniture never closes on the player

`src/player/lateSolid.js` (new: `lateSolidCloses`, `lateSolidsOf`), `src/scenes/decor/decorRoom.js` (put's `solid`, unmount,
restand, draw), `src/scenes/decor/decorBase.js` (show, hide), `src/player/enterExit.js` (`heldInSolid`'s height),
`src/player/collider.js` (`SKIN` exported), the wiring: `src/scenes/worldModes.js`, `src/scenes/world.js`,
`src/scenes/homeYards.js`.

FOUND, on the code. Two players' private reports: walking into an online home, its furniture moved and boxed them in;
inside one, talking to its hired trader, a table loaded in round them and held them. An online home's room first stands
as Daggerfall furnished it; the owner's pieces are asked for only after the entry
(`worldModes.js:"loadHomeDecor();   // DECOR1c: an online home's pieces"`), the save's copy set aside
(`worldModes.js:"if (interiorHome || _seatHallVisit) interiorDecor.keep(placed)"`), the ask retried from 2 s to 30 s
(`decorRoom.js:"export const DECOR_LIST_RETRY_MS = 2_000;"`) and asked again later still when the homes' layouts land
(`worldModes.js:"homeLayoutsLanded() { loadHomeDecor(); },"`). Its answer stands the owner's pieces
(`worldModes.js:"interiorDecor.set(pieces);"`) and hides the room's own the owner took out
(`worldModes.js:"interiorCtx?.base?.setHidden(Array.isArray(r.data.hidden)"` - the furniture that "moved"). Each placed
model turned solid the moment its model loaded (put's `solid`: `collider?.()?.addMesh?.(decorKeyOf(piece.id), ...)` at
main's 9e00d52e9), and a hired trader (HOME-VENDOR) is a flat that stands before any model does; a piece of the room's own
put back (`decorBase.js` show) was solid again at once. Nothing asked where the player stood. The collider holds both
faces of every triangle, so a body a solid lands round is held by its inner walls: on the real motor and collider, a
1.0 x 0.6 x 2.0 m piece added round a standing body held it - four seconds of walking and jumping every way moved it 0 to
0.12 m - and a piece 0.9 m tall or lower threw the body onto its top. Daggerfall Unity never meets this:
`PlayerEnterExit.TransitionInterior` runs `interior.DoLayout` first ("This needs to be done first",
`PlayerEnterExit.cs:721`) and only then sets the player to the landing and `SetStanding` (`PlayerEnterExit.cs:794-795`) -
no solid ever arrives after the body. The late arrival is DECOR1c's own departure, and the hole was ours. The same hole
stood in every yard (DECOR-OUTDOOR, the same pool outdoors): a yard's piece landing round a passer-by. The port's one
guard against a late arrival was the fast-travel landing's (UNSTUCK-OUT, `heldInSolid` / `openGroundNear`).

THE FIX - A LATE SOLID NEVER CLOSES ON A BODY. One gate a collider (`player/lateSolid.js` `lateSolidsOf(collider)`, made on
its first asking, a WeakMap's - gone with the collider), through which a late solid's triangles go in:
- **The law** (`lateSolidCloses(probe, body)`, over a Collider holding the solid alone; `body` the motor's own `pos` and
  `height`): never a solid whose box misses the capsule's (a piece hung wholly over the head, open beneath, holds nothing,
  though a line up from the feet crosses its skin once); else one of its faces deeper in the capsule than the resolve's
  skin (`collider.js` SKIN, now exported - a face a body rests on or leans against stands at the radius, so a piece stood
  again under the feet, by the room's list again or a recentre, stands at once and the body stays on it), or the body's
  feet or head inside a closed part of it (`heldInSolid`, UNSTUCK-OUT's parity law, which now takes the body's own height
  - a crouched head is lower; the landing's call is unchanged) - deep in a big piece no face is near.
- **The gate**: `add` stands the triangles at once where the body is clear of them, else WITHHOLDS them - the piece still
  draws, is met by the eye at its box, is no solid: the body walks out of it as out of air. `settle(body)`, asked by the
  room's draw (the host's existing per-frame decor call, `decorRoom.js` draw), makes that body the one the gate GUARDS and
  stands every withheld solid it is now clear of - the first frame it is, solid behind them. A solid that names no body
  is checked against the guarded one, so the room's own furniture put back (`decorBase.js` show) needs no body of its own
  and `interiorContext.js` no new wiring; `null`, or a gate no body has settled yet (a bench, a test), stands it at once, as
  every solid always stood. A withheld key stays withheld through a recentre (`restand`, moved with it); one taken down
  (`unmount`) or taken out (`hide`) while withheld is forgotten. A box test first spares the probe's build for every piece
  nowhere near the body (a town's yards stand two thousand).
- **The body** is the motor itself, `body: player` - never the eye's low-passed feet (`feetAt` trails a step by up to
  0.5 m) - handed by the hosts to the room's placed pieces (`worldModes.js`, one entry) and to every yard (`world.js`, one
  entry; `homeYards.js` passes it to each pool). createWorldModes stood at 10,997 of its 10,998 logical lines: this takes
  the last one (bootWorld 36,191 of 36,233).
- **Four hosts**: `worldModes.js` WIRED (a home's placed pieces, and through their draw its own furniture); `world.js`
  WIRED (the yards); `exterior.js` (the bench) and `dungeonContext.js` stand no placed piece - nothing late to gate.
- **Other players** are not this collider's concern: it moves this client's body alone, and each player's own client
  stands the same piece through its own gate, held back from them. While a piece is withheld it is no solid for
  anything - a foe or a resident could walk through it for the moments the player stands in it.
- **Not through the gate** (the same class, other fixes): a placed DOOR (HOME-DOORS) hangs through the action system as the
  room's movers do; lifts and other movers (another fix of this record); a neighbour pixel's World of Daggerfall rocks
  built round a body (UNSTUCK-OUT's open note). Each can stand through the gate with one `add` where a frame of its
  collider settles it.
- **Why not hold the entry fade until the list answers (with a timeout).** The list can answer 30 s on, or after the homes'
  layouts land; each model then loads on its own after the answer; the owner puts a piece back, another player edits
  their yard, and a yard streams in, with no entry at all. A held fade would bound one arrival of five, keep every
  visitor at the door for the account service's round trip (and its timeout when the service is down), and still leave
  the late model. The gate stands where every late solid passes.
- Departure: DFU never stands a solid after the body (`PlayerEnterExit.TransitionInterior`); ours does, and withholds it
  from the body until clear - its Port-Ledger section A row.
- **For the next late solid** (the owner, 2026-10-19: "Apply to rocks too"): the rule is `player/lateSolid.js`'s two
  exports - the law, `lateSolidCloses(probe, body)`, and the gate, `lateSolidsOf(collider)` with `add` / `remove` /
  `settle` / `withheld`. A caller hands its triangles to `add` in place of `addMesh`, and something holding the body
  settles that collider's gate every frame.

- **Pinned**: `test/scenes/decor/fb1019f_decorclear.test.js` (7, on the REAL `PlayerMotor` and `Collider`, pieces minted
  by the service's law `decorPieceOf`, the room's own by its build's key `decorBaseModelKey`: a wardrobe landing on the
  body - drawn, withheld, the body walks out to the room's wall, solid the first frame the body is clear of it (frame
  derived from the law), never stood twice, walked back into it stops the body at its face; a low piece round the feet
  does not throw the body onto it, and one stood again under a body resting on it stands at once, the body still on it;
  a piece too big for any face to be near (the parity), a crouched body under a shelf and under a slab its standing head
  would be in (the height, by the contact and by the parity), a canopy over the head (the box); a recentre and a removal
  while withheld; the room's own put back, stood by the placed pieces' draw,
  and taken out again while withheld; the gate's body laws; the hosts' wiring). PIN MOVED: `test/server/decor1.test.js`
  (the room's host's createDecorRoom call: and `body: player`). `tools/mutants/decorclear.json` (28: 27 dead, 1
  equivalent as recorded - the gate's box first, which only spares the probe's build). Re-aimed by content:
  `basehide.json`'s BASEHIDE-out-but-solid and BASEHIDE-back-but-a-ghost, `fb1001_yard.json`'s
  YARD-RECENTRE-the-bucket-left-behind, -the-bucket-never-stood-again and -its-model-never-kept, `unstuckout.json`'s
  UO-held-by-the-head-unasked (basehide 29, fb1001_yard 34, unstuckout 7: all dead).

## ROCK-CLEAR: an Overworld rock built after the body stands never closes on it

`src/player/lateSolid.js` (the gate: the bucket's translation through `add` and its probe, as many parts a key as its
bucket holds, `replace`, `forget`, a guard that may be a getter), `src/player/collider.js` (`late`, removeBucket's
`forget`), `src/scenes/pixelBuild.js` (every solid of the build through the gate), `src/scenes/world.js` (the frame's
settle - one line; the yards' `body` entry gone), `src/scenes/homeYards.js` and `src/scenes/decor/decorRoom.js` (a pool
naming no body goes by its collider's gate; the recentre through `replace`).

FOUND, on the code. A player's private report: a fast travel left the character inside a mountain, and they could not
leave. The jump's landing pixel builds whole before the body stands - `_teleportToPixel` awaits it - and UNSTUCK-OUT's law
reads it: a floor inside a rock is no landing, the nearest open ground instead
(`world.js:"if (walkMode && (!local || ground) && heldInSolid(collider, pos)) {"`). Only the landing pixel: the pixels about
it build after the body stands, over the frames that follow, and World of Daggerfall's mountains are meshes scaled by
hundreds that reach past their own pixel. The rock stage files each piece into the pixel's one bucket as the build runs,
pixel-local on the floating origin's provider
(`pixelBuild.js:"const wodBucket = onFloatingFrame(host.state, ((o) => () => host.state.pixelTranslation(px, py, o))([0, 0, 0]));"`),
and asked nothing of the body: a neighbour's rock filed round a body standing in its own built pixel held it by its inner
faces (the collider holds both). The same for any of the pixel's solids round a body that outran the stream - a journey's
since MOUNTAINS WALKABLE (`11-Multiplayer/Wild-Zone.md` section 19) crosses massifs, and its pixels ahead build as it walks.
UNSTUCK-OUT left this open by name ("a body a neighbour pixel's rocks are built round after it stands is not ejected on
its own"); the owner, 2026-10-19: "Apply to rocks too". World of Daggerfall, the Daggerfall Unity mod, stands the same
objects as each terrain promotes (LocationLoader.AddLocation's object loop, `LocationLoader.cs:232-252`, a MeshCollider each
through CreateDaggerfallMeshGameObject), and DFU's StreamingWorld a location's models as its terrain places - wherever
the player stands.

THE FIX - DECOR-CLEAR'S GATE IS THE AFTER-LANDING LAW. The landing keeps UNSTUCK-OUT's (`heldInSolid`, `openGroundNear`).
- **Every solid of the pixel build through the world collider's gate** (`pixelBuild.js`, `const late = lateSolidsOf(collider)`,
  `late.add(key, ..., { translation })`): the mills, the town's models and gates, Gothway's boards, World of Daggerfall's
  pieces (rocks, mountains, camps, ruins) and the Hold's camp, each with its bucket's own provider. A part that would close
  on the body is drawn (its draw is the pixel's, untouched) and held back; the rest of the bucket stands as it did.
- **The gate's three extensions** (`lateSolid.js`): the provider rides `add`, the probe and the probe's box (pixel-local
  triangles - a recentre moves a held part with the body, and it stands where the recentre put it); a key holds as many
  parts as its bucket does, a held one beside those that stood; and the collider's own `removeBucket` asks the gate to
  forget a bucket's held parts (`this.late?.forget(bucketKey)`, beside TACT1's cover hook), so a pixel streamed out
  (destroyPixel's and releaseFailedBuild's `collider.removeBucket(key)`, untouched) stands none of them later. A
  recentre of a decor piece goes through `replace` (taken down and stood again, or held still in its place) - the
  collider's hook would otherwise forget a held piece at the take-down. The gate's own cost to a build: a box test a part
  (a model's own box kept by its positions array), the probe built only for a part whose box meets the body's -
  measured, 0.17 ms for 1,000 parts beside the collider's own filing of them (100-180 ms on the loaded machine).
- **The body**: the world frame settles the gate after the motor's step with a getter - the motor while it walks the
  world, none while a jump is under way (`worldMoveBusy()`, up from the jump's first statement) - read the moment a part
  is asked. So the landing's pixel, built while the jump runs, is filed whole for the landing's law; a plain body handed
  then would be the body where it stood before the jump, in the old frame, and could hide a building or a rock from
  floorLanding and heldInSolid. The yards' pools no longer hand a body of their own (DECOR-CLEAR's `body: player` on the
  yards, removed): a pool naming none goes by its collider's gate, so the frame's getter is the world's one body.
- **What is covered where.** The landing pixel - its town, its walls, its rocks: the landing law (TL2's edge landing,
  heldInSolid / openGroundNear), built whole before the body stands. Every pixel built after the body stands - a
  neighbour's mountain reaching in, a town or a camp round a body that outran the stream, a pixel rebuilt under the body
  for a season's turn: the gate. A yard's piece: the gate, by the world frame's body. Trees carry no collider (billboards
  and Low Poly Trees alike): nothing to close. NOT through the gate (each its own module; each can stand through it with
  one `add`): the hill patch (ground - a body under a landform's mound is the resolve's floor law, not a solid's), a city
  gate's dusk-and-dawn swap (a mover's, MOVER-BODY's family), and the open world's other placed solids - POIs, quays, the
  Oblivion Gate, merchant yards, shipyards, carts.
- **Four hosts**: `world.js` WIRED (the frame's settle; the pixel build is its module); `exterior.js` builds its one city
  before the body stands - nothing late; `worldModes.js` and `dungeonContext.js` build their rooms and blocks before it
  too (DECOR-CLEAR gates a home's pieces). bootWorld: 36,181 to 36,182 logical lines of 36,219 (+2 the settle, -1 the
  yards' entry); createWorldModes untouched.
- Departure: DFU files those colliders as the terrain promotes, the body where it may; ours holds back the ones that
  would close on it until it is clear - DECOR-CLEAR's Port-Ledger row, extended (section A).
- UNSTUCK-OUT's open sentence is closed: its two decided items deleted (the rocks built round a body, and the route
  walking into a massif - a journey meets a massif's face as a wall, and a pixel built round it is the gate's); what is
  left open, the collider's bilinear floor under the drawn landform ground, stands as its own sentence.

- **Pinned**: `test/world/worldOfDaggerfall/fb1019f_rockclear.test.js` (6, on the REAL `PlayerMotor`, `Collider` and
  `StreamingWorldState`, the providers in the pixel build's own shape: a neighbour's mountain and a boulder built round the
  standing body held back while the pixel's house stands, the body walks out, both solid the first frame it is clear
  (frame derived from the law), walked back into, the rock stops it at its face; a recentre while held - it rides the
  provider with the body and stands where the recentre put it; a bucket removed by the collider forgets its held rock;
  a jump's landing filed whole - heldInSolid sees it, openGroundNear moves the landing to the first open spot past the
  rock - and a neighbour's rock held back once the body walks again; a yard's piece by the same gate; the build's five
  sites, the hill patch alone direct, the frame's settle after the motor's step, the collider's hook). PIN MOVED:
  `test/world/worldOfDaggerfall/fb1001_wodrock.test.js`, `wod4_privateershold.test.js`, `test/world/terrain/wod2_loader.test.js`,
  `wodbush.test.js`, `test/world/arena/arena1_model.test.js` (the pixel build's sites, through the gate),
  `test/scenes/decor/fb1019f_decorclear.test.js` (the yards name no body; the gate's options bag).
  `tools/mutants/rockclear.json` (16, all dead). Re-aimed by content: `decorclear.json` (26: 22 dead, 4 equivalent as
  recorded - the box-first record as before, and three forgettings the collider's own hook now makes: the gate's for a
  collider with none), `fb1001_yard.json`'s YARD-RECENTRE-the-bucket-left-behind and -the-bucket-never-stood-again and
  `hostseam.json`'s BLOOD1-HOSTSPLIT2-a-bucket-the-build-lays-allocating-per-call (with -its-model-never-kept: 4 dead).

## STAND-IN-WHOLE: a Disintegrate lands on every body the relay holds

`src/world/gate/gateBoss.js` (STAND_IN_WHOLE, standInBlowCap, the factories' `blowX`), `src/scenes/gate/standInSpell.js` (new:
the one spell door), `src/scenes/dungeonContext.js` (its four spell doors out, the module wired where they stood),
`src/scenes/eliteGates/egFight.js` (`myBlowX`), `src/combat/blood/bloodDecals.js` (bloodHit), `src/systems/artifactEffects.js`
(the Razor's reason), `test/scenes/hostceiling.test.js`.

FOUND, on the code (reproduced on main against the real `bossStandIn`, `hostStandIn`, `crystalStandIn`, `duelSpellOf`,
`applySpell` and every validator). Every body a relay runs - the Warden, his crystals and his host; the Abyss Dungeon's
Remnant, its Echoes and Hearts; every lord, add and struck object of an Elite Breach; the sea serpent; my opponent in a
refereed bout - is struck on this machine against a stand-in whose health stood at a placeholder nothing empties, 1e9.
A Disintegrate deals its target the health it has left
(`effects.js:"if (left > 0 && sinks.hurt) { out.damage += left; sinks.hurt(left, { whole: true }); }"`), so the cast
claimed 1e9 - and every wire refuses that: the gate's `hit`, `ahit`, `xhit` and the Abyss's at GATE_DMG_WIRE_MAX
(`wire.js:"if (!finite(m.d) || m.d <= 0 || m.d > GATE_DMG_WIRE_MAX) return null;"`, 100,000), an Elite Breach's at 1e6
(`validEgIn`), a bout's at 10,000 (`arenaLaw.js:"const d = num(m.d, 10000), r = int(m.r, 0, 2);"`). The relay dropped the
whole cast while the spell door popped `Math.round(dealt)`: a nine-digit number, a bar that never moved. The relay caps
a blow anyway (`gateBrain.js:"const got = Math.max(0, Math.min(want, HIT_CAP_X * ref, p.bucket, f.hp, H ? H.h * f.max : Infinity));"`, spendPurse
the same, an Elite Breach's bucket grown by the Vestiges' declared factor up to 1.25) - so the number was never what a
whole blow can land, at most ~300 at level 20 and 780 at 60. Duels had met the same and solved it at the stand-in
(`combat/duelCombat.js` DUEL_STAND_IN, whole at the wire's vital ceiling). Mehrunes' Razor, the other whole-body producer,
had been patched at its own producer (AUDIT WBX F1).

THE FIX - ONE WHOLE, ONE DOOR.
- **The whole** (`gateBoss.js:"export const STAND_IN_WHOLE = HIT_CAP_X * dpsRef(LV_MAX) * EG_BUCKET_X_MAX;"`, 975), at the
  stand-in (`gateBoss.js:"e.maxHealth = e.health = STAND_IN_WHOLE;"`): the most one blow lands at any relay - the gate's cap
  at LV_MAX (780) grown by the most a breach's bucket grows - over the serpent's (182) and a bout's (122), under the least
  ceiling nobody clamps (the bout's 10,000) with the rest of a spell's room beside it. A Disintegrate counts it whole, every
  wire carries it, and the relay weighs and clips it by its own law (a stun heavier; an Unyielding ward 15% lighter, 975 of
  it still past the cap at the level cap; the bucket). Pinned against the real constants and every validator.
- **The number** says what can land (`standInSpell.js:"const shown = standInShown(dealt, standInBlowCap(body.entity, player.level));"`):
  min(the claim, my one-blow cap at my level) - an Elite Breach's grown by my Vestiges' declared factor, which egFight hands its
  stand-ins (`egFight.js:"const myBlowX = () =>"`, at most EG_BUCKET_X_MAX); on my opponent the referee's spell cap
  (ARENA_SPELL_MAX, 60). The paths' riders are told the same (`took` - what the foe could lose, AUDIT SCHOOLS L1 M6). The claim
  still goes out whole: clipped here, it would lose what the relay weighs before its cap.
- **The door is one** (HOST-SPLIT): `spellOnBoss`, `spellOnCrystal`, `spellOnHost` and `spellOnRival` were four copies in
  `buildDungeonContext`; they are `src/scenes/gate/standInSpell.js` (`createStandInSpell`), wired where they stood
  (`dungeonContext.js:"} = createStandInSpell({"`).
  `buildDungeonContext` 8,450 -> 8,312 logical lines, its ceiling 8,601 -> 8,463.
- **Nothing local reads the whole as a body.** Every reader of a stand-in's health was read again: the spell door's sinks
  only count, a swing's and a shaft's formula takes nothing (the number is sent), every lasting family is forgotten - pinned
  on every factory (two Disintegrates and a swing, the whole untouched). `healthShare` and the masteries read the relay's
  word (`relayHealth`, RELAY-SHARE). The blood ladder read the placeholder and bled the bottom rung every blow; at 975 it
  would bleed a body of 975's rungs, so it measures no whole on a stand-in
  (`bloodDecals.js:"maxHealth: Number.isFinite(entity?.maxHealth) && !entity?.relayHealth ? entity.maxHealth : 0,"`) - the same
  rung, by law. Berserker's leech reads `min(damage, target.health)`: unchanged under 975.
- **Mehrunes' Razor stays passed by** (`artifactEffects.js:"if (!target || !item || target.spareGear) return null;"`). Its two
  reasons were the 1e9 billed to its condition and a blow the wire refused. The wire carries the whole now and no Strikes
  payload bills wear on a stand-in (AUDIT WBX F2) - and that is why it must stay: the Razor's kill is paid in its own condition,
  the health it removes (DFU `MehrunesRazorEffect`), and on a body the relay runs nothing would pay it - a free whole blow every
  failed save, its number the whole on top of the swing's.

THE FOUR HOSTS: `dungeonContext.js` wired; `world.js` and `exterior.js` unchanged (their `bossSpell` mounts call the context's
`spellOnBoss`, the same api); `worldModes.js` unchanged. The serpent's own spell door (once `world.js serpentSpellOn` in
`bootWorld`; since BOSS-DOT `standInSpell.js` `createSerpentSpell`) pops no number, as it never did, and tells its riders what a
hand's purse can land (SERPENT_HIT_CAP_X of SERPENT_HAND_REF, 21; AUDIT FB1019f C3) - its whole is 975 now (its send held it
to 5,000 already). A
departure from DFU (`Disintegrate.MagicRound`: `SetHealth(0)`): on a body the relay runs it is the most one blow lands.

- **Pinned**: `test/net/gate/fb1019f_standinwhole.test.js` (5: the whole against the real constants - every relay's cap under
  it, every wire carrying it and refusing 1e9, the purses landing their caps; a real Disintegrate on every factory's stand-in,
  nothing local taking from it, out through the real court to the wire and the brain - his bar moves by a blow's cap; the number
  on each door - 300 at level 20, a breach's 375, a bout's 60, a bolt of 10 itself, 780 and 975 at the cap - the riders told the
  same, the claim whole; the readers - the ladder's bottom rung, no share but the relay's; the hosts - the context's wiring, no
  copy left, and an Elite Breach's real fight (a yard's objects, a span's Harriers) handing its stand-ins my Vestiges' factor).
  PIN MOVED: `wb4b_gate_blows.test.js` (his whole; his door in the module), `fb1018f_relayshare.test.js` (the placeholder's
  value), `auditwbx.test.js` (F1 on his real stand-in, a failed save too; F6's trap through the module), `audit_wb11.test.js`
  (W1's router), `wb9c_gate_reckoning.test.js`, `wb8a_never_swayed.test.js`, `wbx_gate_fixes.test.js`, `audit_schools.test.js`
  (L2 F4: the riders told what can land), `arena4b_blows.test.js`, `fb1018f_turnedblow.test.js` (the three doors' numbers by
  the body they met, now driven on the module). `tools/mutants/fb1019f_standinwhole.json` (20, all dead). Re-aimed by content
  (13, all dead): `arena4b_blows.json`'s ARENA4b-BLOW-SPELL-AS-SWING, `audit_schools.json`'s AUDIT-SCHOOLS-L2-F4-a-stand-in-untold,
  `audit_wb11.json`'s AUDIT-WB11-W1-every-stand-in-to-him, `wb8a.json`'s three, `fb1018f_turnedblow.json`'s
  TURNED-BLOW-host-spell-number-blind (the crystal's and the Warden's records retired with the copies they named - the three
  doors' line is one), `blood1.json`'s BLOOD1b-the-hit-shape-lets-a-NaN-through, `fb1018f_relayshare.json`'s five.

## BOSS-DOT: a spell's lasting harm is carried on the bodies the relay holds

`src/scenes/gate/standInSpell.js` (`carriedOnStandIn`, `countOnStandIn`'s rounds, `createStandInRounds`, the doors' keys and
`standInRound`, `createSerpentSpell`), `src/scenes/dungeonContext.js` (the round asked in `drawFoes`; `landOnHost`'s `tick`),
`src/scenes/eliteGates/egFight.js` (hostHit's `tick`), `src/scenes/world.js` (the serpent's door out, its frame),
`test/scenes/hostceiling.test.js`.

FOUND, on the code (reproduced against the real `bossStandIn`, `duelSpellOf`, `applySpell` and `tickActiveEffects`). A
Continuous Damage spell on any body a relay runs landed its cast's round alone: the stand-in forgot every lasting family
the moment the count was done (STAND-IN-WHOLE's one door, and the serpent's own copy in bootWorld), so a level-20 Burn
dealt one round and its other 24 went nowhere - all damage over time on the Warden, his crystals and host, the Remnant,
its Echoes and Hearts, every Elite Breach body and the sea serpent. No owner decision ever made it design: WB4b's comment
said "continuous families are not his to carry", and WBX7 ("his stand-in forgets every lasting effect") carried the Soul
Trap alone. THE DECISION (the owner, 2026-10-19): "Carry DoTs".

THE FIX - CARRIED, AS THE TRAP IS.
- **What is carried** (`standInSpell.js:"export const carriedOnStandIn = (a) =>"`): Continuous Damage on health (1,0, DFU's
  ContinuousDamageHealth) with a round to run. Its fatigue and magicka siblings (1,1 and 1,2) have nothing to fall on - a
  relay body is health alone - and the duel's other lasting families (Paralyze, Silence, Drain) are the relay brain's to
  know, never a claim: not carried.
- **Kept a body** (`standInSpell.js:"export function createStandInRounds({ now = Date.now, rolls = Math.random } = {}) {"`):
  him `b`, one of his host `h<i>`, a crystal `c<n>` (the Hour's Remnant, Echoes and Hearts and an Elite Breach's bodies
  through the same seams). A cast lays the body's running rounds on its stand-in first, as copies - the incumbent a recast
  RENEWS (`renewRounds`, STACK-CAP; a renewal fires no first round, as DFU's AddState) - and keeps what the cast leaves only
  when its claim went: a spell the ward or the ground turns, or whose claim is refused, lays and renews nothing.
- **Ticked on the court's clock**, COURT_ROUND_MS (the soul trap's: one game minute online, five seconds): one round for
  every body together, as DFU's broker raises one for every entity; never this machine's magic round, which a rest, a wait
  or a court sentence moves in a burst. A round runs the entries against the body's stand-in by `tickActiveEffects` (the save
  rolled fresh, its caster's power) and sends the sum through the door a spell's claim takes, marked a round
  (`dungeonContext.js:"standInRound();"`, in `drawFoes` beside the foes' own rounds): a Spell claim, the relay's caps and its
  blow rate deciding what lands. Every body's round leaves in one frame - in the court one blow's sequence (AUDIT WB11 W3),
  one token of the hand. A round into his ward is lost and the rest run on; a stalled frame's rounds go as one claim.
- **They end** with the body (fallen, withdrawn, the fight over - the seams stop offering it), my death, and the context (the
  court left). A walk to another of his courts: the court refuses every claim from there (AUDIT WB9 brain F1), so its rounds
  are lost while I stand there, as my blows would be.
- **An Elite Breach** weighs a round as no blow: the host door carries its mark (`tick`) to `egFight.js` hostHit, where it
  takes no Momentum, builds none and rolls no Arcane Echo (a cast does all three); the relay weighs it as any spell's claim.
- **The sea serpent's door** left `bootWorld` (`createSerpentSpell` - the count, the riders told what a hand's purse can land,
  the claim to `serpentHost.handStruck`), its Continuous Damage carried the same, each round to the segment it last met,
  ended with the fight (`serpentSpell.frame(fight)`). `bootWorld` 36,181 -> 36,157 logical lines, its ceiling 36,219 ->
  36,195; `buildDungeonContext` 8,315 -> 8,317 (its wiring), under 8,463.
- **A refereed bout carries none** (BAL8: the referee's blow alone - it counts every spell claim a cast, and OPEN-HAND drops
  what a follow-up owes a player).

THE FOUR HOSTS: `dungeonContext.js` wired (the round's frame, the host door's mark); `world.js` wired (the serpent's door
and frame); `exterior.js` and `worldModes.js` unchanged (they hand the opts and the `bossSpell` mount through). No relay or
wire change: a round is a spell's claim on the wire as it stands.

- **Pinned**: `test/net/gate/fb1019f_bossdot.test.js` (8: round for round what DoMagicRound deals the same body; the round's
  law - a stall, a renewal claiming nothing at its cast, a turned recast and a refused claim laying nothing, the ward's round
  lost, a body gone and back carrying none, my death, health alone, the bout, a bolt over a running Burn; the keeper's clock,
  and a round of one sent (AUDIT FB1019f G7); a turned recast on a Spire body, whose ward rides on its stand-in alone
  (`egFight.js` turnStandIn), renewing nothing (C4); the Burn's figure, 8 of its 200 at even dice (C3);
  the real court - him and his host in one sequence, the wire, his fall; the serpent; an Elite Breach's real fight - a round
  takes no Momentum and rolls no Echo; the hosts by source). PIN MOVED: `arena4b_blows.test.js`, `audit_wb11.test.js`,
  `fb1019f_standinwhole.test.js` (the context's destructure), `wb11_gate_host.test.js`, `fb1012g_openhand.test.js` (landOnHost's
  mark), `wb4b_gate_blows.test.js`, `wb9c_gate_reckoning.test.js` (the count and the doors' keys), `audit_schools.test.js` and
  `serpent4.test.js` (the serpent's door). `tools/mutants/fb1019f_bossdot.json` (26, all dead). Re-aimed by content (4, all
  dead): `fb1019f_standinwhole.json`'s the-claim-clipped and the-count-takes, `egz_vestiges.json`'s EGZR-stacks-any-body,
  `hostsplit.json`'s HOST-SPLIT-a-ceiling-under-its-host.

## CHAIN-SEEN: Chain Lightning's arc says its harm

`src/systems/loot/lootPowers.js` (`reachOn`, `arc`, `quake`, `dragonfire`, the strike's three cases).

FOUND, on the code. A player's private report: a Legendary bow's Chain Lightning shows nothing. It works: each of the
bow's arrows that lands arcs half its damage, as shock, to the nearest other foe within 6 m. But the arc lands through that
foe's own pool's door, which runs no formula, and HN1's numbers are the formula's readout (`10-UI/UI-Arc.md`) - so the arc
raised no number and said no word (its last line at 9e00d52e9, in `lootPowers.js`: `if (best && n > 0) door.hurtFoe(best, n);`), where its
neighbour `again()` has raised its follow-up's own number since ROSE-SEEN (`Field-Bugs-2026-10-15e.md`). Every reach of a
blow on ANOTHER foe in the file was the same omission: Earthshaker's quake (a quarter to every other foe within 3 m) and
Dragonfire's burst (a third to every other Daedra within 3 m) landed silent, and Dragonfire's own second burn on the struck
one rose with no name (`again(target, amount)` - the only `again` without its power's word).

THE FIX. One door for a blow's reach on another foe (`lootPowers.js:"function reachOn(door, f, n, word) {"`): its number
rises through `showFollowUp`, tagged with its power's name, then the foe takes it - Chain Lightning's arc, Earthshaker's
quake (a number for each foe it reaches) and Dragonfire's burst; Dragonfire's burn on the struck one is tagged as Many
Endings' echo is. Enhanced only, as HN1 is (the classic skin registers no numbers; the harm lands there as before); none
where nothing lands (no foe in reach, one proof against shock). The number is what the power carries, before a shared
foe's toughness, as the first blow's and ROSE-SEEN's are. NOT the same omission, left and named: thorns (an Armor affix
line, `lootLanded`) answer a foe's blow where its attacker stands, not a reach of my blow at the reticle - as the sigil
sets' Spite of the Spurned does, a number of its own is the owner's call; and the arcane paths' arcs outside this file
(`arcanePowers.js` `arcOn`/`hurt`: Rift Lance, the Elementalist's own signature Chain Lightning, Blood Boil, Dawnbolt's
burn) land as silently - a follow-up, flagged. Not a DFU member (LOOT5's powers are the port's).

- **Pinned**: `test/systems/fb1019f_chainseen.test.js` (2: the Legendary bow's arc through the real lootStrike, on HN1's
  layer on a stub document - nothing on the classic skin and the arc still landing, then `20 Chain Lightning`, none on a
  shock-proof foe or with none in reach; Orsinium's Anvil's quake a number per foe it reaches, the Dragonfire Oath's burn and
  burst each `30 Dragonfire`). No pin moved (`loot5_powers`, `auditloot`, `fb1015e_rose`, `gilded2_world` pass as they
  were). `tools/mutants/fb1019f_chainseen.json` (9, all dead). Re-aimed by content: `gilded2.json`'s GILDED2-every-foe-burns,
  GILDED2-the-elements-share-taken, GILDED2-the-struck-one-spared and GILDED2-AUDIT-reach-past-3m (4, all dead).

## GAUNTLET-PLATES: the Gauntlet's plates are marked and named

`src/net/eliteGates/egBrain.js` (the Gauntlet's wake and its arm of trialStep), `src/scenes/eliteGates/egFight.js`
(`gauntletPlates`, `egPlateY`), `src/ui/eliteGates/egHud.js` (`egObjectiveText`, `egProgressText`),
`src/ui/eliteGates/egSpireHud.js`, `src/net/eliteGates/egLaw.js` (`EG_OBJECTIVES`'s note), and the Elite Gates arc's
sections 8.3 and 27.3 (`11-Multiplayer/Elite-Gates.md`). Relay world232.

FOUND, on the code and on the real director (`egBreachNew`, `egStep`, `egBlow`; seed 1, hall 66, solo, laws 9 and 10). A
Gauntlet Rampart's trial is won only by standing `EG_SILENCE_MS` (3 s) on each Caster's plate (section 8.3). The relay
counts a plate held by any member within `EG_TOUCH_M` of it in plan
(`egBrain.js:"const pl = g.p.plate, on = pl && here.concat(inHall).some((b) => dist(b.x, b.z, pl[0], pl[1]) <= EG_TOUCH_M);"`),
and only a plate held lowers the count (`egBrain.js:"F.pg.left = F.gauntlet.filter((g) => !g.done).length;"`): a Caster
slain by blows is gone without `done`. With all three Casters slain by real blows the line still said *Casters left: 3*
and the trial ran on; with each plate then stood on for 3 s, nought were left, *A caster is silenced.* was said three
times, and the door opened. So the law held, and everything that tells it pointed the company the wrong way:
- The words: the objective was `gauntlet: 'Silence the casters.'` (`EG_OBJECTIVES`) and the line
  `` `Casters left: ${pg.left ?? 0}` `` (`egProgressText`). Neither named a plate, and "left" read as a body count.
- The screen: nothing on the client read `spots.pillar[].plate`. WINCH-PLATES (2026-10-18d) marked the Winch's plates
  (`egFight.js:"  function winchPlates(F, t) {"`) and recorded the Gauntlet's as left, "on sloped stairs where a flat quad
  would cut the slope". That was law 9's lay. From spec law 10 (THE BROKEN WAY) each plate stands on its pillar's flat top,
  beside its stair's head.

THE FIX.
- THE ROOM SAYS EACH PLATE. The Gauntlet's progress word carries `silenced`, plate by plate in `spots.pillar`'s order, 1
  once that plate's Caster is silenced. It is said from the wake
  (`egBrain.js:"P.obj = 'gauntlet'; P.left = F.gauntlet.length; P.silenced = F.gauntlet.map((g) => g.done);"`) and at
  every beat (`egBrain.js:"      F.pg.silenced = F.gauntlet.map((g) => g.done);"`). The wire's `egProgress` already
  passes a short list of numbers (DUEL-RING's `ring` rides the same way), and `left` is unchanged.
- THE SCREEN MARKS THEM. `egFight.js:"  function gauntletPlates(F, t) {"`, beside `winchPlates`, draws each plate in play
  as the Winch's are drawn through the trial: gold, `EG_TOUCH_M` about, on its own surface. Its height is its ground's,
  `egFight.js:"export function egPlateY(spec, q) {"`: the pillar's top (2 m) from law 10, the stair's height under it at
  laws 8 and 9, and the walkway's floor before them. A plate whose word says silenced dims to the unlit rune's 0.35
  (`egFight.js:"sh.alpha = said?.[j] ? 0.35 : 0.85;"`), so a company sees which plates are still to hold. A pillar the
  company was not given is not marked (the hall lays six, and a company of n is given `2 + ceil(n/2)`). A screen facing a
  relay before world232 gets no `silenced`, so it draws every plate the hall lays while `left` is above nought
  (`egFight.js:"    if (!said && !(F.pg.left > 0)) return;"`).
- THE WORDS NAME BOTH WAYS. The objective is *Silence each caster: stand on its plate, or slay it.* and the line is
  *Casters left: 3. Hold a plate 3 s or slay its caster*, its seconds `EG_SILENCE_MS`'s. Both are said in the player's language through the catalog
  (`eg.objective.gauntlet`, `eg.progress.gauntlet`). The objective goes through `egHud.js:"export const egObjectiveText = (spec) =>"`,
  which the tracker's line, the Spire HUD's chip and the arrival card all read. It is the first objective said in the
  player's language; the rest stay the law's English. The English catalog was regenerated (`tools/l10nExtract.mjs`), the
  thirteen finished languages were drafted in-session (`tools/l10nInSession.mjs`, recorded as the machine's), and the
  L10N4 ratchet's count for `egHud.js` fell from 39 to 38.
- THE LAW'S WORD STAYS AS LAID. `EG_OBJECTIVES.gauntlet` is still *Silence the casters.*, now unshown. Every spec carries
  its hall's objective, so the words are a hall's bytes: section 22's law pin hashes every law's halls whole
  (`egSpecDigest`), and a client compares the room's digest of the hall it stands in with its own (`egClient.js`
  `digestOff`). The slice first moved the word in the law. Three law pins failed (`eg6a_span`, `egaudit3_law`,
  `egaudit5_f`), and `egfrag_client` failed with them. Shipped that way, every Gauntlet would have disagreed with its room
  across the deploy's skew, and its halls would have been asked of the room. The word went back, and `EG_OBJECTIVES`'s
  note says why. The new words belong to the screen.
- A SLAIN CASTER IS SILENCED. At the merge of main, GAUNTLET-SLAIN (`01-Overview/bugs/Field-Bugs-2026-10-19d.md`, a
  report from the Discord) had made a Caster slain its pillar silenced - the question this record had left open. Its `done`
  is the plate's word, so a slain Caster's plate dims on the relay's next beat as a held one does, and the words name both.

THE RELAY. `egBrain.js` and `egLaw.js` ride the relay's bundle, so this is world232 (world224 on its branch, renumbered past
main's world224 - LAYERED-GEAR and VOICE2 - world225 - GAUNTLET-SLAIN - world226 - LORD-SHARES - world227 - PLAIN-SWEEP -
world228 - QL12 - world229 - WB14b - world230 - OW-CHASE-RANGE - and world231 - NAME-WORDS - at the merges). The version pins moved (PIN MOVED: world232), disc7's list grew by one, and soc1's S38-version-not-bumped was
re-aimed by content. Either end may deploy first. An older client passes `silenced` through `egProgress` and reads
nothing from it; it draws no plate, as before. A newer client facing world231 or older marks every plate the hall lays
while a Caster is left.

Left: at laws 8 and 9 the plate stands on its sloped stair, and its flat mark crosses the slope at its middle, half under
the stair. No such breach can be live: a breach lives three hours, and every breach opened since world219 lays law 10.

- **Pinned**: `test/scenes/eliteGates/fb1019f_gauntletplates.test.js` (4). The first runs the real director for a
  company of three and a company of one, through the wire, folded: the plates marked, a held plate dimmed, a Caster slain
  by `egBlow` silenced on the next beat and its plate dimmed too (GAUNTLET-SLAIN's law), the door, and no mark before or
  after the trial - a crumbled Caster's undrawn body disc no plate's mark. The second is an older
  relay. The third is `egPlateY` at laws 10, 9 and 7. The fourth is the words: the law's word and the hall's bytes as
  laid, the screen's naming the plates, and the catalog's in both trackers, the chip and the arrival card. PIN MOVED: the
  relay-version pins (world232), `test/systems/disc7.test.js`'s list, and `test/systems/l10n4_hardcoded.test.js`'s
  count for `egHud.js`. `tools/mutants/fb1019f_gauntletplates.json` (23, all dead - its record of a slain Caster's plate dimmed retired at the merge,
  GAUNTLET-SLAIN's law now and `fb1019d_gauntletslain.json`'s to hold). Re-aimed by content: `soc1.json`'s
  S38-version-not-bumped onto `export const RELAY_VERSION = 'world232';` (run alone: dead).

## FINDME-TOWN: the town map's Find me finds the player

`src/ui/heldMap.js` (`_findMe`, `_paint`, the world sheet's `me`/`findMe`, the constructor's pixel),
`src/ui/town/townSheet.js` (`me`, `findMe`, `FIND_ME_BLOCKS`), `src/ui/automap/automapSheet.js` (`backToMe`, `me`,
`findMe`), and the arc's section (`10-UI/Enhanced-Maps-Arc.md` FINDME-TOWN; `11-Multiplayer/Wild-Zone.md`'s FINDME
points at it).

FOUND, on the code. FINDME built Find me for the bay: glide to the player's world pixel at FOCUS_SCALE and blink a red
cross over it for three seconds, the cross painted by the world sheet's own overlay. FINDME-SHEET (`10-UI/Overhauls.md`)
kept the button on the town's sheet. But the town map opens through `townMapDoor.js:"...(deps.travel ?? {}),"`, and
neither host passes a `travel` bag: world.js and exterior.js deliberately hand the town window no bay (EM4's decision,
DFU's open-time travel guards). So the window had no `getPlayerPixel`, and its constructor stood the bay's middle in for
it (`const p = deps.getPlayerPixel?.() ?? { x: this._size.width >> 1, y: this._size.height >> 1 };`, main `9e00d52e9`).
`_findMe` read that stand-in as the player and aimed at (500.5, 250.5) on the TOWN sheet, whose space is its own layout
pixels (gridW*64 by gridH*64). `_focusOn` clamped it to the town's bounds, so every press landed on the town's right
edge, at one spot per town size wherever the player stood. At a 1280x800 screen, a 4x4 town always centred (179, 209),
an 8x8 town (435, 251). The red cross was drawn by the bay's overlay alone, so the town got none. Yet the town sheet
already knew where the player stood (`playerOnSheet`, what its own rest view centres on). The dungeon's sheet, where
every dress but the grimoire's shows the button, did the same: the same stand-in, aimed at its plan.

THE FIX - FIND ME ASKS THE SHEET THAT IS UP. Two optional members join the sheet contract beside `meView` and `panBox`.
`findMe(limits, view)` answers the view on the player in the sheet's own space, or null where no player stands on it.
`_findMe` (`heldMap.js:"_findMe() {"`) refreshes the pixel where the host hands one, asks the live sheet, and glides to
its answer clamped. With no answer it moves nothing and blinks nothing.
- The bay's answer is its pixel's middle at FOCUS_SCALE or nearer (the zone map at its own zoom), as it was.
- The town's is the player's own caret (`playerOnSheet`, EM-BUG3's one seam) at street zoom: `FIND_ME_BLOCKS` (two)
  blocks across the paper's short side, or nearer where the plan is zoomed past it
  (`townSheet.js:"findMe(limits, view = null) {"`).
- The dungeon's is its own Me: back to the player's floor, then `meView`. The Home key, the Me button and Find me share
  one `backToMe` (`automapSheet.js:"function backToMe() {"`), lifted out of the two copies the key and the button held.

`me()` says where the player stands on the sheet. The cross is the WINDOW's now, painted after the sheet's overlay
through that point (`heldMap.js:"const me = this._findMeT > 0"`). So it crosses the caret on the streets and on the
dungeon's floor as it crossed the pixel on the bay. On the bay it now draws over the wild zone's crows and flames, where
it drew under them.

A missing position is never read as one. A window whose host hands no pixel holds none
(`heldMap.js:"const p = deps.getPlayerPixel?.() ?? null;"`). The stand-in misled nothing else a player reaches: the
pixel's other readers (the bay's caret, the zone map's ring, ZONE-FIRST's centring, MAP2's journey centring, the party
poll) are the travel map's, and its bag always carries the pixel (`playerTravelOrigin`).

DFU reference: `DaggerfallExteriorAutomapWindow.ActionFocusPlayerPosition` puts the camera on the player marker at its
own zoom. The classic window keeps it whole (`exteriorAutomapWindow.js:"actionFocusPlayerPosition() {"`). The held map's
Find me departs from it as FINDME did on the bay, on the enhanced skin alone, under the held map's own Port-Ledger row
(MAP1): it zooms in to the street, never out, and blinks the cross. No host was touched.

AUDIT FB1019f E4: from the fields outside the town's blocks Find me lands on the town's nearest edge, and the cross was
drawn off the paper; it holds the paper's edge on the player's side
(`heldMap.js:"const cx = clamp(fx, edge, paperW - edge), cy = clamp(fy, edge, paperH - edge);"`) - on their row or
column, or the corner. A sheet with no player still answers nothing.

- **Pinned**: `test/ui/town/fb1019f_findme_town.test.js` (7; AUDIT FB1019f E4's player off the paper, four ways and the
  world map dragged away). Every window is built through its real door
  (`createTownMapWindow`, `createAutomapWindow`, the held map's constructor for the bay), on a town of real house bytes,
  and pressed through the chrome's own Find me button.
  - The town, 8x8 and 4x4, the player in the south-west corner, the north-east corner and the middle. The caret the plan
    itself inks lands on the paper, centred or against the town's own edge on its side, and dead centre in the middle.
    Opposite corners land on opposite sides of the paper. The zoom is two blocks across the paper's short side. The
    cross goes through the caret, blinks, and is gone after three seconds.
  - Zoomed in past the street already, Find me keeps the zoom and centres the caret.
  - No player on the sheet (a town handed none, a bay handed no pixel): no glide, no cross.
  - The bay as it was: the pixel as it stands at the press, its middle at FOCUS_SCALE, the cross through it.
  - The flat dungeon map, looking at the floor above: Find me brings back the player's floor, centres them and crosses
    them.
  - The 3D dungeon map: Find me, the Me button and the Home key each bring back the player's floor and turn about them.

  All but the bay's fail on main. PIN MOVED: none. `test/systems/fb1010_findfirst.test.js` (FIND-FIRST),
  `test/ui/grim1_dress.test.js` (FINDME-SHEET) and `test/ui/heldmap.test.js` (U61) stand unchanged and green.
  `tools/mutants/findme_town.json` (23, all dead). Re-aimed by content: none - no record aimed at a moved line.

## TOWN-EXIT: a journey from inside a walled town leaves by a gate - RETIRED at the merge of main

FOUND, on the code (kept for the record). A player's private report: leaving a town by the Overworld's journey, the way
out failed wherever the traveller stood far from a gate, and left them caught in a corner of the wall. A route's legs are
its pixels after the first, and OW-TOWN-RING rings only a town the route passes THROUGH - the start pixel never gets the
ring (travelRoute.js:"const rings = pixels.map"). So the first leg aimed at the next pixel's middle, or at OW-ROADSIDE's
join on the line from the town's own middle - straight across the town and through its wall - with only TRAVEL-NAV1's
local steering between the traveller and the wall. Flown over Kaloguja's own walls: reproduced.

RETIRED. While this record was out, main took THE OVERWORLD REVISITED (#1074) and its OW-TOWN-WALK
(`06-Systems/Travel-View.md` OW-TOWN-WALK, read cold by its own AUDIT OW-REVISITED): a journey in a town walks the
town's own grid - each open gate's passage carved through it, its way asked of the piece of the grid the traveller
stands in - and stops with its own word at a gate shut for the night (`travel.nav.gatesShut`). That is this report's
way out, and one way out has one home, so TOWN-EXIT was retired at the fifth merge of main (AUDIT FB1019f G1): its
module (`townExit.js`), pins (`fb1019f_townexit.test.js`), mutants, shut-gate word (`travel.gatesShut`, in the 25
languages that held it) and its move of `tvJoinedLegs` out of `bootWorld` went back to main's, with the travel pins and
mutant records it had re-aimed (`tv2_click_to_move`, `ow_wod`, `fb0929d_toroads`, `ow2.json`, `ow3j.json`,
`owwod.json`) and its Host-Split section. AUDIT FB1019f lane E's findings against it (a start in the town's fields or
in a gate's passage still walked through the town, E1; its pin gaps and two doc claims, E2 and E3) went with it: the
first is a question of the town walk's own now, which plans from the traveller's piece of the grid (its pins:
`ow_townwalk.test.js` THE WALLS AND THEIR GATES, `audit_owrevisited_walk.test.js` L1-4).

## MOVER-BODY: a lift or a lowering floor never closes on the player

`src/player/moverBody.js` (new: `meetBody`, `moverSteps`, `moverPresses`, `carriedBy`, `MOVER_PRESS`, `MOVER_STEP`,
`MOVER_STEPS_MAX`), `src/world/actionSystem.js` (`update(dt, body)`, `_standMover`; `frameDelta` gone),
`src/scenes/shared.js` (`ridePlatform` gone), `src/scenes/worldModes.js` (the dungeon's and the building's movers handed
the player; the ride line gone), `src/scenes/dungeon.js` (the standalone dungeon's movers handed the walking player; its
ride line gone).

FOUND, on the code (repros on the real Collider and PlayerMotor, synthetic geometry). A mover's collider bucket was stood
again at every frame's pose (`actionSystem.js` update, "Standing collision follows the mover every frame") and asked
nothing of the body. The ride was the host's (`shared.js ridePlatform`): a body STANDING on the mover was moved the next
frame by the mover's last delta, through `collider.move`, which stops at whatever blocks the body - and the mover itself
never stopped. A rider whose head met a 0.6 m lip stopped while its lift rose on: feet 2.72 with the lift's top at 4,
inside the lift and the floor above, held by both their inner faces (the collider is two-sided) - every walk and jump
moved it nothing. A swimmer is never on the mover, so the ride did nothing for it: a force-crouched swimmer under a 0.5 m
slab lowering to the floor ended with its feet at -0.35 (the floor's top 0), and a stroke down from there reached -9.5,
out of the world (a walker in the same case was thrown up on top of the slab). DFU has no rule here: TweenToEnd /
TweenToStart hand iTween a linear MoveTo and RotateBy and the tween plays out whatever stands in the way
(DaggerfallAction.cs); PlayerGroundMotor.MoveWithMovingPlatform carries the body its controller last landed on - the
platform's point under it, moved (`activePlatform.TransformPoint(activeLocalPlatformPoint)`), through one
CharacterController.Move - and a body the mover meets otherwise is left to PhysX's overlap recovery.

THE FIX - THE MOVER MEETS THE BODY WHERE IT STEPS, in the one place every mover's pose is stood (`_standMover`, every
'action' mover of every host's action system). The action system takes the body (`update(dt, body)`); each step's new
pose is asked whether it presses the body (`moverPresses`: a face more than `MOVER_PRESS`, 1 mm, inside the capsule's
chain) or carries it (the motor's `groundKey`). Such a body is carried by the mover's own motion at its centre
(`carriedBy`: MoveWithMovingPlatform's adhesion - a turn's sweep as well as a slide - from any side: pushed up, down or
aside), in one bare Move (no ground snap - a snap took a rider off a plate coming down flush with the floor) through
everything but the mover, its own stance, its render span and its fall with it (`carryBy`, the deck's and the Steps'
carry). If the pose still presses the body after the carry - the sweep stopped short, the body pinned between the mover
and the world - THE MOVER HOLDS at its last pose that closed on nobody, its `t` with it: the tween waits, and plays on
once the body is clear (a step off the lip's side, a stroke out from under the slab); a body the mover already pressed
where it stood (a load, a snap) is no reason to hold it. A frame's step is met in pieces no longer than `MOVER_STEP`
(half the capsule's radius) of its motion at the body (at most `MOVER_STEPS_MAX`, 16), so a fast mover in a starved frame
crosses no body unmet; a body nowhere its step could reach costs it nothing past its own stand. The host-side ride is
gone (`ridePlatform`, and the `frameDelta` only it read): the carry is the mover's, in either host's order. A DEPARTURE
from DaggerfallAction's tween, which never stops (Port-Ledger A, below).

Measured after, through the real motor: a rider carried up, down and aside to the bit and grounded at every frame (60 Hz
and 0.1 s frames, either host's order); the lift under the lip holds with the rider's head at the lip (feet 2.2, t 0.55)
and, the rider stepped toward the shaft's middle, finishes at 4 carrying it; the slab holds over the swimmer's head (0.9)
and over a walker's (1.8) and settles once they are clear; a rotating deck (30 and 60 degrees about its hinge, 60 Hz and
0.1 s frames) carries its rider to its end. Left as it was: a door is not met (its swing is a trigger while it moves and
solid only closed, DFU's MakeTrigger; a Move-flagged door's record carries its closed bucket as before), a zero-duration
flip and a load's or a peer's snap are placements, not motion, and a foe is neither carried nor holds a mover (EnemyMotor
rides no platform). A body pinned where it has no way out (a lid lowering into a closed pit) holds the mover until it
moves; `/unstuck` leaves by the door. THE FOUR HOSTS: `scenes/worldModes.js` wired (the dungeon's movers and the
building's - for `world.js` and `exterior.js`, which reach both through createWorldModes); `scenes/dungeonContext.js`
builds the dungeon's action system and needs nothing; the standalone `scenes/dungeon.js` wired. Host lines:
createWorldModes 10,997 logical lines before and after (the ride's two out, the void's two in -
`test/scenes/hostceiling.test.js` holds).

- **Pinned**: `test/world/fb1019f_moverbody.test.js` (9 of its 12: the lift report - the record of the bug, then the
  lift held under the lip with its rider on top, its tween at the pose it holds, finishing once the rider steps clear;
  the lowering report - the record, then a swimmer and a walker never through the floor, the slab held over each head
  and settling once clear; the carry up, down, aside, starved and in either order, and onto a floor flush with a plate;
  the stance under a low roof; the edges - a body already held, a rider in the skin over a 1 mm step, a wall pinning a
  body against a pillar; the steps - a thin floor dropping 1.5 m a frame onto a swimmer, nine pieces, none for a far
  body and one stand of its bucket; the press; carriedBy; the wiring), every mover minted by `layoutRdbBlock` and
  registered as `dungeonContext.js` registers one. PIN MOVED: `test/scenes/audit18_hosts_outer.test.js` (the ride is the
  movers' own - a rider carried by the step itself, a body on the static shell no rider; both dungeon hosts and the
  building's hand their movers the body; the dungeon movers' update line), `test/player/ph1_physics.test.js` (the ride's
  own stance: the carry's line in `moverBody.js`), `test/scenes/waveD_dungeonHost.test.js` (a flat is no platform - it
  has no bucket; its null `frameDelta` gone), `test/world/superDungeon/sd7b_steps.test.js` (the Steps ride before the
  motor, after the frame's axes - the movers' ride beside them is their own update now). `tools/mutants/moverbody.json`
  (35 with VOID-DUNGEON's; MOVER-BODY's 26, all dead). Re-run by content: `auditwb_court.json`'s
  AUDWB-B2-a-pending-exit-walked-by-the-dead (its line now carries VOID-DUNGEON's else) - dead.

## VOID-DUNGEON: a body below everything a dungeon stands on stands again at its way in

`src/player/enterExit.js` (`dungeonVoidRescue`, `DUNGEON_VOID_TEXT`, `dungeonVoidText`), `src/scenes/dungeonContext.js`
(the context's `voidRescue`), `src/scenes/worldModes.js` (the dungeon arm's drain), `src/scenes/dungeon.js` (the
standalone dungeon's frame), `locales/*/Port_Strings.csv` (`player.dungeonVoid`).

FOUND, on the code. VOID-ENTRY's failsafe (FIELD BUGS 2026-10-04d) is a building's: its record is made at the building's
transition (`worldModes.js` "ctx.voidRescue = interiorVoidRescue(ctx.collider, floored)") and asked in the building's
frame. A dungeon had none. Its collider has no ground (`heightAt` -Infinity), so a body out of its floor - the lowering
floor's swimmer (MOVER-BODY), a save made there - fell or swam on for good, in the black, and `/unstuck`, which leaves a
dungeon by its door, waits out its 30-minute cooldown (PVPUNSTUCK's).

THE FIX. The dungeon context keeps VOID-ENTRY's record (`voidRescue`, one entry of `buildDungeonContext`'s api - the law
is `enterExit.js dungeonVoidRescue`): made the first time a frame asks, so the floors a host stands into the dungeon after
its build (the Burning Court's) are under it, and kept - where the dungeon stands a body it places (`startSpawn`: its
start marker's landing, by the way in, else its enter marker's) and `INTERIOR_VOID_DROP` (10 m) under its lowest
triangle; none with no such spot or no triangle, and none in a realm that casts its own void back - the Hour's Unmoored
Steps (SD7b) and an Elite Breach's spans (EG section 8) cost what their own laws say. Both dungeon hosts' frames ask it -
`worldModes.js`, the else of the dungeon arm's drain (VOID-ENTRY's own shape, before the movers), and the standalone
`dungeon.js`, where the motor walks - and stand such a body there, its fall cleared (`standFromVoid`), with a line of the
port's own in the player's language: `player.dungeonVoid`, "There was no floor beneath you. You are back at the
entrance." (drafted in-session for the thirteen whole languages). DFU has no failsafe (Port-Ledger A, below). THE FOUR
HOSTS: `scenes/dungeonContext.js` keeps the record; `scenes/worldModes.js` asks it (for `world.js` and `exterior.js`);
the standalone `scenes/dungeon.js` asks it. Host lines: buildDungeonContext 8,450 -> 8,453 logical lines (ceiling
8,601); createWorldModes unchanged (MOVER-BODY's).

- **Pinned**: `test/world/fb1019f_moverbody.test.js` (3 of its 12: the law - made at the first ask, the court's floor
  under it, kept, a realm's spot never asked, none with no spot or no triangle; the context - the start marker's
  landing though an enter marker stands, else the enter marker's, none in the Hour or a Breach, its entry lifted out of
  `dungeonContext.js` and run; the hosts - the lowering report's swimmer, driven under the floor as the code before did,
  swum down out of the dungeon: left alone above the depth, stood at the way in below it, its fall cleared and told, both
  hosts' own frame lines lifted out of their source and run). `tools/mutants/moverbody.json` (VOID-DUNGEON's 9, all
  dead).

## SPELLSHOP-SAID: the spell shop says why Buy refused

`src/ui/spellbookWindow.js` (the book's own box draw, `NOTES`/`ASKS`, `_close`), `src/ui/enhanced/enhancedPort.js` (the
port's dismiss), `src/ui/enhanced/enhancedNotice.js` (`noticeShown`).

FOUND, on the code. Two players' private reports: at the Mages Guild's spell shop, Buy did nothing - no confirmation,
no gold spent. Buy refuses in two cases, each with DFU's click-anywhere box (`DaggerfallSpellBookWindow.BuyButton_OnMouseClick`,
a `DaggerfallUI.MessageBox` for no spellbook and for not enough gold), and the window raised both:
`spellbookWindow.js:"if (!hasBook) { this.top = 'noSpellbook'; return; }"` and the gold check under it. But under
Enhanced Plus, the default skin, the shop is the classic SpellbookWindow in buy mode inside the port (SHOP-PLUS,
`enhancedPorts.js` spellShop), and the port runs the classic draw onto a renderer that paints nothing
(`enhancedPort.js:"try { win.draw(quietRenderer(renderer), canvas, font, ...rest); }"`). Only a box with buttons takes an
enhanced face of its own (`messageBox.js` drawMessageBox's enhanced dialog); a box with none was laid out as parchment
onto that renderer - nothing on screen. Every other service window routes such a box through ENH-NOTICE2's seam
(`noticeFrame`): ENH-NOTICE2's survey had counted the spellbook among the windows the enhanced skin replaces with a DOM
twin, which the cast book still is - SHOP-PLUS brought the buy-mode book back onto the enhanced skin without the seam.
And the hidden box STAYED UP: the port's dismiss asked `win.box`, which the book does not keep (its box is `top` and
`_box`), so the next press - Leave - went to putting away a box nobody could see. An effect's description (the chosen
spell's "What it does") was the same box, the same way. THE SWEEP: of the windows the port wraps, the bank, the potion
maker, the item maker and the spell maker keep their box in `box` and draw it through the seam; the house and ship lists,
the transport picker and the daedra raise none; the guild's and the coven's draw theirs through the seam but keep it in
`top` - the port's dismiss never saw them either, so a click on the window's ground did nothing and a row that calls the
window's own method (Heal Curse, the Reforge, the lifting) acted under the notice.

THE FIX. The book is the ninth window on ENH-NOTICE2's seam:
`spellbookWindow.js:"if (noticeFrame(this, NOTES.includes(this.top) ? this._boxRows() : null)) {"` - the click-anywhere
tops named once beside the ones that ask (`const NOTES = Object.freeze(['noSpellbook', 'notEnoughGold', 'note']);`,
`ASKS` the delete, the sort and the trade, which the draw's buttons and the click's Yes/No hit-test now share), BOX1's
single read unchanged, the panel released when the box clears (the next draw) and in `_close`. And the port's dismiss
asks the seam rather than a field: `enhancedPort.js:"if (noticeShown(win)) { win.click?.(-1, -1); return; }"` - the
notice is the panel the window raised (`enhancedNotice.js:"export const noticeShown = (owner) => owner?._noticeKey != null && panels.has(owner._noticeKey);"`),
up exactly while the player can read it, whatever field holds the box; so the guild's and the coven's notices take the
first click too, and nothing under any notice acts. The four windows that kept `box` answer as before. No DFU behaviour
changes (DFU shows each box; the notice at the edge is ENH-NOTICE1's Ledger A row).

- **Pinned**: `test/ui/fb1019f_spellshopsaid.test.js` (7: through the real port on the repo's DOM, the records through
  the real TEXT.RSC reader - a no-book Buy and a no-gold Buy put up the record as the notice with no parchment, BOX1's
  read once; the next click, Leave or the window's ground, takes it down with nothing under it acting, a key too, and
  Leave then leaves; an effect's description is the notice; the haggle stays the enhanced dialog, a click does not put it
  away, and its Yes buys; `_close` releases; the classic skin keeps its parchment and mints nothing; the guild's and the
  coven's notices take the first click, a Heal Curse press under one healing nothing; `noticeShown` itself). PIN MOVED:
  `test/ui/enhancedNotice.test.js` (THE ROSTER - nine windows, the port the seam's one more importer) and
  `test/ui/enhanced/dropsaudit.test.js` (DROPS-AUDIT F6's dismiss line). `tools/mutants/spellshop_said.json` (12, all
  dead). Re-aimed by content: `dropsaudit.json`'s DA-F6-notice-lets-tiles-act onto the `noticeShown` line (re-run: 15,
  all dead). Recorded in `10-UI/UI-Arc.md`, under ENH-NOTICE2.

## QUESTOR-SAID: a guild with your quest open says so

`src/systems/quest/offerFlow.js` (`questorBusy`, the guild's and the coven's doors), `src/systems/quest/machine.js`
(`lastNPCClickedQuestorOf`, the one scan), `src/scenes/quest/questBridge.js` (`offerBoxes`, `questorBusyRows`),
`src/scenes/worldModes.js` (the quest door's silent close, the two makers' hand-back - wiring lines only).

FOUND, on the code. Players' private reports: a guild - the Fighters Guild, the Knights of the Dragon - refused a new
quest with "That service is not available yet." while one of its quests was still open. DFU's rule is ported: a questor
whose quest is open offers nothing (`DaggerfallGuildServicePopupWindow.GetQuest`, `DaggerfallGuildServicePopupWindow.cs:550-553`:
`IsLastNPCClickedAnActiveQuestor(guild)`, then CloseWindow), and the door answered `{ kind: 'close' }`. DFU closes in
silence; the bridge boxed a close as nothing, the guild's quest arm read the empty chain as no window, and the popup's
null face is `worldModes.js:"if (!flow) return { rows: ['That service is not available yet.'] };"` - words that say the
service is unbuilt. GQL1 (`06-Systems/Quest-Arc.md`) had named this path and left it. The coven's door
(`DaggerfallWitchesCovenPopupWindow.cs:125-129`) closed silently. Every other way to the sentence, read: a service no
destination maps (genuinely unbuilt), a window whose art or SPELLS.STD has not come in, no teleport map, the inventory
door not ready, no quest machine or no FACTION.TXT - all a service that is not there in that moment, the sentence true.
Two were not: the guild quest door's empty chain also covered a drawn quest with no QuestorOffer message (DFU shows
nothing); and the potion and item makers mounted their window and answered null, which pushed the sentence onto the popup
they had just replaced (unseen in an interior's one slot, but the same null the book and the repair arm had already
been fixed for).

THE FIX. The popups' doors close saying why and naming the quest still open:
`offerFlow.js:"export function questorBusy(machine) {"` - `{ kind: 'close', reason: 'activeQuestor', quest }`, the quest
off the very scan `IsLastNPCClickedAnActiveQuestor` makes (`machine.js:"lastNPCClickedQuestorOf() {"`; the DFU member
answers from it, its mcp stamp, log line and QUEST-SHELF's set-aside skip unchanged). The bridge boxes it
(`questBridge.js:"case 'close': return step.reason === ACTIVE_QUESTOR ? [{ rows: questorBusyRows(step.quest) }] : [];"`):
"You have not finished the work you were given here: <quest>." - the quest by the name the journal gives it, the work
alone where it has none; the text core's (`quest.offer.questorBusy`, `quest.offer.questorBusyUnnamed`), in the English
catalog and drafted in-session for the thirteen whole languages. The guild popup and the coven show it as a one-box flow
over the closed popup - DFU's CloseWindow, then a box. The social door (DaggerfallQuestOfferWindow) keeps C#'s bare
close: its talk session declines an active questor before the door (`npcSession.isNpcOfferingQuest`). The guild quest
door's remaining empty chain is C#'s silent close, a dispatch of nothing
(`worldModes.js:"flow = boxes.length ? new ServiceFlowWindow(boxes, { onClose: () => closeSelf() }) : DOOR_REFUSED;"`), and
the two makers hand back the window they mounted (`return mountServiceWindow(potionWin);`, `...(itemWin)`), as the book
and the repair list do. "That service is not available yet." still answers a service that is not there. The host's
logical lines: -3 (`createWorldModes` 10,997 to 10,994; `test/scenes/hostceiling.test.js` holds). DEPARTURE (named in
`offerFlow.js` and `06-Systems/Quest-Arc.md` QUESTOR-SAID): DFU's two GetQuest closes say nothing; the port says why.
AUDIT FB1019f F1: on the classic skin in FONT0003 the busy line ran past both edges of the 320-pixel panel for 177 of
178 guild-quest titles; the service flow wraps a long row
(`guildServiceWindows.js:"this._box = layoutMessageBox(font, fitBoxRows(font, t.rows), buttons);"`), and the service
flows' TEXT.RSC rows that fit are laid as before.

- **Pinned**: `test/systems/quest/fb1019f_questorsaid.test.js` (7: through the real quest bridge on the guide world, the
  questor bound by the machine at the accept off the click the bridge stored - the guild's close carries its reason and
  the very quest, its box through the real ServiceFlowWindow names it, and the door opens again once the quest is done;
  a quest with no DisplayName says the work alone; the coven's door the same, the social door's bare close boxed as
  nothing; the words in French and every whole language's `{quest}`; what still reaches "not available yet", the quest
  door's silent close and the makers' hand-back; AUDIT FB1019f F1's box inside the screen, in a synthetic font and in
  the real FONT0003 for all 178 titles and the unnamed line). PIN MOVED: `test/systems/quest/covenwindow.test.js` (CW1 - the
  coven's active-questor close carries its reason and its quest). `tools/mutants/questor_said.json` (16, all dead).
  Recorded in `06-Systems/Quest-Arc.md` (QUESTOR-SAID).

## HELD-CONCEAL: a worn item's concealment a blow broke comes back

`src/systems/concealment.js` (`breakNormalPowerConcealment`), `src/systems/effects.js` (`hasActiveEffect`),
`src/systems/enchantments.js` (the reroll's note).

FOUND, on the code. A player's private report: an item that makes its wearer invisible while worn (Cast When Held)
stopped working after Overworld travel, and worked again only once it was taken off and put on again. Travel alone does
not end it - on the real equip door and the real magic-round pump the worn pin rode 37 hours of travel rounds and the
six-hour reroll untouched. One landed blow does. AUDIT 24 wave 31's break - at the attack formula's tail,
`formulas.js:"if (damage > 0) breakNormalPowerConcealment(attacker);"`, and at every FromSource damage door
(`handleAttackFromSource`) - ran a filter that DELETED every normal-power concealment entry, a spell's and a worn item's
alike, and the worn one's pin went with it. The reroll that recasts a worn item's spell visits only an item that still
holds a pin (`enchantments.js:"if (!entity.activeEffects.some((a) => a.heldItem === item)) continue;"`), so the piece
stood worn and inert until it came off: 48 hours after the blow, still worn, not invisible, no pin. A blow in a
journey's ambush is the likely travel trigger - not proven, and the fix does not need it. DFU never lost it:
EndIncumbentEffect<T> (EntityEffectManager.cs:759-766) ENDS the effect - `RoundsRemaining = 0; End()` - and removes
nothing; a worn item's bundle is kept "alive until item breaks or is unequipped" (EntityEffectManager.cs:1739-1742),
its ended effect sets no flag (DoConstantEffects skips HasEnded, EntityEffectManager.cs:1693, and
DaggerfallEntity.ClearConstantEffects clears the flags every frame), and the item stays scheduled for
RerollItemEffects, which strips the bundle and recasts it. The port had departed, unrecorded and unpinned.

THE FIX, at the one door every breaker goes through - the blow (WeaponManager.cs:549-552, EnemyAttack.cs:255-257 and
EnemyAttack.cs:316-318, all at the formula's tail), the FromSource damage of a spell (HandleAttackFromSource,
DaggerfallEntityBehaviour.cs:196-201) and Silence's aggro; casting a spell breaks nothing, in DFU or here.
`breakNormalPowerConcealment` ends every LIVE normal power (Invisibility, Chameleon, Shadow; the TRUE three never): a
spell's entry is removed, as before - DFU's end, a round sooner - and a worn item's is ENDED in place and keeps its pin,
`concealment.js:"if (a.heldItem) { a.roundsRemaining = 0; a.ended = true; }"`. `hasActiveEffect` reads an ended entry
as absent (DFU's HasEnded skip), so IsInvisible, IsBlending and IsAShade, the senses' closures and the pose's
concealment bits all read it broken; `mysticism.js` liveBundles already skipped an ended entry, so the HUD's icon goes
with it. The reroll recasts it once the item's six hours since its last roll are out (REROLL_MINIMUM_HOURS, E2's
cadence, unchanged); taking the piece off sweeps the ended entry with its item, and putting it on again casts it at
once. A spell's concealment keeps today's behaviour. The other readers of an ended entry, checked: the HUD's status rows
skip it; effectsAlreadyOnTarget counts it, as EnemyMotor's own does (no HasEnded test there); the arena's sand strip
reads hasActiveEffect and takes a recast off on the next frame; the save never carries a pin. THE FOUR HOSTS: none
touched - the break, its readers and the reroll are modules every host already reaches.

DEPARTURES, named (Port-Ledger A): every live normal power ends on one break, where EndIncumbentEffect<T> ends the first
effect of its type FindIncumbentEffect<T> meets (EntityEffectManager.cs:666-678), an ended one included - so a worn
Invisibility already ended shielded a spell's from every blow until the reroll; and the HUD shows no icon for a worn
bundle whose concealment is ended, where HUDActiveSpells.ShowIcon keeps an equipped item's up whatever its effects.
Left as they were: a load recasts every worn piece's spells fresh (ENCHANT-LOAD's restartHeldEnchantments - the save
carries no pin), a broken concealment included, where DFU's save keeps `effectEnded` - as re-wearing the piece does,
free inside the six hours (HELD-REWEAR); and the reroll runs at the round that finds the six hours out, where DFU
flushes the items DoMagicRound flagged at a sleep's end or a synthetic time jump's (RerollItemEffects' two callers,
EntityEffectManager.cs:2170-2178).

- **Pinned**: `test/systems/fb1019f_heldconceal.test.js` (5, on the real equip door, a real blow, a real spell's damage,
  the real magic-round pump and the HUD's icon row: a worn Invisibility a landed blow broke is not invisible, sends no
  concealment bits, shows no icon and stands ended on its item, a miss breaks nothing, a second break finds nothing,
  and one round short of the six hours it is still broken and at the six it is back, fresh; a spell's broken stays
  broken, and with a worn one beside it one blow ends both and the reroll brings back only the worn one; taken off,
  the ended entry goes with its item, nothing recasts it, and worn again it is cast at once; the six kinds - the normal
  three ended on their item, the true three untouched, the three back at the reroll; a spell's damage the wearer lands
  ends the worn one as a blow does). No pin moved: wave 31's break pins (`audit24_wave31.test.js`) hold - every entry
  they break is a spell's. `tools/mutants/fb1019f_heldconceal.json` (9, all dead: the worn one left live, its rounds
  not zeroed, the pin deleted as before, the spell kept, an ended one broken again, the true Shadow broken,
  hasActiveEffect reading an ended entry, the HUD showing it, the reroll passing a broken item). The arc:
  `06-Systems/Systems-Arc.md` HELD-CONCEAL.

## DISEASE-UNWELL: a disease incubating shows an unnamed tile

`src/systems/diseases.js` (`diseaseIncubating`), `src/ui/hud/hudStatus.js` (`afflictionRows`, `unwellTileText`),
`src/systems/healthStatus.js` (`healthStatusRows`, `UNWELL_LINE_TEXT`), `locales/*/Port_Strings.csv` (two rows).

FOUND, on the code - reproduced on the real `startDisease` -> magic rounds path (a rest's hours on the character's own
clock). A player's private report: after catching a disease, the rest and travel warnings said they were diseased, and
no disease's tile or name appeared until after the character died of it. Two DFU laws, both kept, disagreed. The
warnings count every live disease, one still incubating too: the rest's (`restWarning.js:"const plainDiseases"`) and
the travel popup's, DFU's own (`travelPopUp.js:"DiseaseCount > 0"`, DaggerfallTravelPopUp `DiseaseCount > 0 ||
PoisonCount > 0`). The HUD's status widget (`hudStatus.js` afflictionRows) and the Status box (`healthStatus.js`
healthStatusRows) show a disease only once its incubation is over - DFU's `CreateHealthStatusBox`, which appends a
disease's contracted message only `if (disease.IncubationOver)`, and that flag rises on the first magic round past the
day's turn (`DiseaseEffect.UpdateDisease`), on the character's own clock online (LIVED1). The classic skin shows a
disease never: every classic disease sets `ShowSpellIcon = false` (`Plague.cs` SetProperties), so DFU's
`HUDActiveSpells.ShowIcon` leaves it out (the port's row reads bundles alone - `mysticism.js` liveBundles - and a
disease carries none). A long rest or journey catches the days up while the HUD is hidden, so a disease could be caught,
take hold and run its course with nothing on screen but the warning; a player asking the Status box was told "You are
healthy." beside a travel warning that said diseased. Put to the owner.

THE FIX - the owner's decision (Mac, 2026-10-19): "Unnamed 'Unwell' tile", a departure from DFU. One law of a disease
still incubating (`diseases.js` diseaseIncubating: a disease entry, live, of a classic type, its incubation not over -
never a vampirism or lycanthropy infection, which carries no type, DFU's Diseases.None). While one incubates, the status
widget shows ONE tile of no name, "Unwell", on the disease tile's own spore glyph (the art the named tile wears), framed
a debuff, where the first of them stands among the named; the Status box both skins open says "You feel unwell." once
in its place, in the shape the host's own rows take (the healthy line's: a `{ text, center }` record on the street, a
plain string underground). Once incubation is over, the named tile and the contracted message as before; cured (the
temple's, a spell's or a potion's cure), nothing. A named disease and one incubating show both. The word and the line
go through the catalog (`hud.status.unwell` "Unwell", `status.health.unwell` "You feel unwell.", read when drawn),
drafted in-session for the thirteen whole languages (bg, cs, da, de, es, fr, id, it, ko, nb, pt-BR, ro, ru; the
drafting languages owe them as they owe the rest). Checked: the classic skin keeps DFU's - no disease icon, named or not
(it never drew from afflictionRows) - and its Status box, the same box, says unwell; the infections stay as they were
(no tile, no line; the rest's warning leaves them out too, while the travel popup, the held map's travel confirm and
the journey prompt's `unwell` count one through `diseaseCount`, as DFU's `DiseaseCount` does - AUDIT FB1019f F2); the
warnings are unchanged. Recorded in `10-UI/Slots-Hotbar-Status.md`
("DISEASE-UNWELL").

- **Pinned**: `test/ui/fb1019f_unwell.test.js` (5: on the real producer - startDisease on the real player, its own clock
  behind the world's, the rest's hours of magic rounds: incubating, the warning and the unnamed tile and line; past the
  own midnight (19 hours, not the world's 14), the named tile and message; cured, none. One tile however many incubate,
  where the first stands, beside a named one; an ended one and an infection none. The tile a debuff on the spore, the
  classic row no disease icon either way. The enhanced HUD executed: Unwell, then Plague, then nothing. The word and the
  line the catalog's, a language's row speaking them). PIN MOVED: `test/ui/enhanced/ui3_status.test.js` (UI3 the
  afflictions: an incubating disease is the Unwell tile and the box's one line, where it showed nothing),
  `test/systems/bookshelf.test.js` (F198: the incubating arm is the unwell line, not the healthy one).
  `tools/mutants/disease_unwell.json` (13, all dead).

## DUEL-BAR: the health bar shows the duel's vitality while a duel is on

`src/net/duel/duelBar.js` (`duelVitality`, new), `src/ui/hud/hudVitals.js` (`hudHealth`, the detector's turn),
`src/ui/hud/hud.js` (drawHud's `healthBar`), `src/ui/enhanced/enhancedHud.js` (the bar's pair, its held loss, falling
piece and heal reading at the turn), `src/scenes/world.js` (its import and the one entry in its drawHud call).

FOUND, on the code. A player's private report: in a duel, their own health bar did not drop when the other player hit
them. Not a defect - INT8's law, `06-Systems/Integrity-Arc.md` section 5, "Decisions (2026-10-09)": a fight between
players never touches the save's health, and "the duel's bar is the referee's vitality now". The relay's referee
(`net/duel/duelRef.js`) holds both fighters' vitality - the Royal Tourney's, 300 + 2 x Renown - and says it to both on
every blow (`dref` `hp`); a blow on me played its flash, its sound and my voice, "my save's health untouched (a duel is
the referee's bar)" (`world.js` duelHpIn). The referee's bar was the battles' readout (`duelHudSay`): the opponent's
vitality on its bar, mine a 13px line in the corner, "Your vitality: n / m" - while the HUD's health bar, on both skins,
went on reading the save's health, which no duel moves. A blow that landed looked, on the bar the player watches, like a
blow that missed. Put to the owner.

THE FIX - the owner's decision (Mac, 2026-10-19): "Bar shows duel vitality". DISPLAY ONLY. `duelVitality` reads my own
entry of the referee's word off the duel manager's live duel (`{ health, maxHealth }`; null before the bout is set,
once the duel is over - won, lost, yielded, left, called off, or let go where no word of the referee's comes, a dropped
socket's case, on the manager's own windows as the ring and the readout end - and outside a duel). It is a client leaf
of its own, not a getter on the manager: `net/duel/duelSession.js` is in the relay's bundle (the arena's bout reaches
it), where a byte changed is a relay version and a deploy - the first cut put it there and SLAM8
(`test/net/relayversion.test.js`) refused it. The world host hands it to drawHud, one entry in its one call
(`healthBar: duelVitality(duelMgr.live, online?.id ?? '')`, the readout's own id), and the HUD reads ONE health for both
skins - `hudHealth`: that pair while one is handed in, else the save's, and which (`from`). The classic small bars and
the large HUD's draw off drawHud's snapshot, the enhanced HUD's off the pair drawHud hands on; and so does everything
drawn off the HUD's health - the trails, the near-death tint, the blow's camera recoil, blood on the lens. The turn each
way is no blow and no heal: the vitals detector primes afresh (the large-HUD toggle's ResetVitals), and the enhanced
bar's held loss, its falling piece and its heal reading start again - so a save's heal under the duel (a potion of the
player's own; the referee takes no heal between the two) moves no part of the duel's bar and floats no "+N". The save's
health is never written. Checked: the fatigue and magicka bars stay the save's (the referee holds neither); the death
screen reads the save's health as ever (a duel's fall is a loss, never a death; a foe's blow that kills under a duel
ends it, the manager's `dead`); the arena's bout between players is not this - its referee's share is written into the
save's health and its healers come at the end (`arenaBouts.js`, "MY HEALTH IS THE RELAY'S"), so its bar already fell;
nor is the open zone (its foes hurt the save, and a bar that read its referee would hide them). The readout keeps its
"Your vitality" line. THE FOUR HOSTS: `scenes/world.js` WIRED (the one entry); `scenes/worldModes.js` and
`scenes/dungeonContext.js` NO DUEL on purpose (a duel is outdoors alone, INT8 - every door refuses a duellist);
`scenes/exterior.js` NOT WIRED on purpose (offline, no other player). The host's code lines: +1
(`test/scenes/hostceiling.test.js` holds). A departure from DFU, whose vitals read PlayerEntity alone (HUDVitals.Update)
- DFU has no other player to duel. Recorded in `06-Systems/Integrity-Arc.md` section 5, "Decisions (2026-10-19, FIELD
BUGS DUEL-BAR)".

- **Pinned**: `test/ui/fb1019f_duelbar.test.js` (4: on the real relay Room refereeing a real bout into a real duel
  manager - my vitality none before the bout, the bout's whole, what a blow leaves, none once it is over though the
  manager holds it a moment yet; the classic HUD's bar read off it and the save's again at its end, the turn each way no
  loss and no gain to the detector, a save's heal under the duel no change of the bar; the enhanced HUD's fill and figure
  the same, the turn breaking no piece off, holding no pale loss and floating no heal, a heal after the duel floating as
  ever; the host's one entry by my own id, the leaf outside the relay's bundle, the readout's line, no host writing the
  referee's word into a health). PIN MOVED: `test/ui/enhanced/enhancedHud.test.js` (PX30d: the enhanced HUD's health
  row reads drawHud's pair). `tools/mutants/duel_bar.json` (15, all dead).

## DISENCHANT-SAID: the Enchanting Station says why a piece gives nothing

`src/ui/professions/profPages.js` (`disenchantableOf`, `drawEnchantingStation`, `ENCHANT_UNDER_LINE`), `src/scenes/world.js`
(the `disenchantable` hook - one wiring line now), `locales/*/Port_Strings.csv` (`prof.page.enchant.under`).

FOUND, on the code and on the real producers (`smithItems.js` mintPiece, `alchemyLaw.js` piecePoints and essenceOf). A
player's private report: crafted greaves and pauldrons could not be disenchanted. That is PROF12's law
(`06-Systems/Professions-Arc.md` 9.3 and section 37): a piece's points are its DFU template's enchantment points
(`itemTemplates.json`), one Arcane Essence a hundred - the Greaves 50, either Pauldron 40, so none at any metal, of chain
or of leather (42 recipes; most of DFU's garments too, 5 to 80 points) - and the service refuses them
(`server-account/src/alchemy.js:"if (essence < 1) return { error: 'prof-no-essence' };"`). What was wrong was the
silence. The station's list was made in the host and dropped every piece under one Essence (`.filter((x) => x.essence >
0)` in bootWorld's professions hooks at main's 9e00d52e9), and the page explained only a list with nothing on it
(`profPages.js:"t('prof.page.enchant.none'"`) - so a player holding a cuirass and greaves saw the cuirass alone, and
one holding only greaves was told no piece carried enough enchantment, the greaves never named.

THE FIX (the owner, 2026-10-19: "List them greyed with the reason"). No change to the law or the service. The list
keeps a piece whose form carries enchantment points under a hundred, its `essence` 0; the page draws it greyed
(`prof-smelt prof-locked`, the house's greyed row), `{points} points. One Arcane Essence needs 100.`
beside it (`prof.page.enchant.under`, the hundred the law's `ESSENCE_POINTS`, drafted in-session in the sixteen languages
that carry the station's lines), and its Disenchant disabled with no press wired - the page never asks the service for
it. The line for nothing to take apart now stands while no piece GIVES Essence, so the greaves alone are named beneath
it. A form with no points at all - a dish, a tool, a Repair Kit, a fishing net, the mason's stone - is no enchanter's
piece and stays off the list as before (a judgment within the decision: the report was the armour, and a station
listing every stew as "under one Essence" would bury it). HOST-SPLIT: the list is made by the page's own module,
`disenchantableOf(items, { kept, book })` - the pack's crafted pieces (a provenance and a recipe) that may leave the pack
(`tradeRefusal`, `isLocked`) and carry no market act (`kept`, the host's `pieceKept`), each its points, its Essence (a
Disenchanter's twice, read off `book`'s Enchanting) and its recipe (AUDIT PROF12 E2). `world.js` keeps one line,
`world.js:"disenchantable: () => disenchantableOf(playerEntity.items, { kept: pieceKept, book: profBook }),"`, and its
alchemyLaw import went with the list: bootWorld 36,190 -> 36,182 logical lines, its ceiling 36,233 -> 36,225
(`test/scenes/hostceiling.test.js`). The four hosts: the station's hooks are bootWorld's alone (worldModes' `enchantHere`
says where the station stands and is untouched; exterior.js and dungeonContext.js draw no station) - none other wired.

- **Pinned**: `test/systems/fb1019f_disenchantsaid.test.js` (3: the list on real crafted pieces - Iron Greaves 50/0,
  both Pauldrons 40/0, a Cuirass 400/4 and Boots 175/1 as before, all 42 Greaves and Pauldron recipes under one, a
  Disenchanter's 8 and 2 and still 0, a dish, a tool, loot, a worn, a locked and a kept piece left off; the page - the
  Greaves and Pauldron rows greyed, the reason exact, their Disenchant disabled and unwired, the Cuirass taken apart
  pressed twice and asked once, the none line with the greaves alone and not beside the Boots' one Essence; the host's
  one wiring line, no filter or Essence of its own). PIN MOVED: `test/systems/prof12_client.test.js` (AUDIT PROF12 E2's
  host-text pin on `essence: essenceOf(points, profBook...), recipe: it.recipe` - now the real ring through
  `disenchantableOf`, 2160 points, 21 Essence, a Disenchanter's 42, and the wiring line). `tools/mutants/fb1019f_disenchantsaid.json`
  (13, all dead). Re-aimed by content: `prof12.json`'s PROF12-E2-world-no-recipe onto `profPages.js` (the list re-run:
  211 - 210 dead, PROF12-spends-no-hash equivalent as recorded), `hostsplit.json`'s HOST-SPLIT-a-ceiling-under-its-host onto the 36,225 ceiling (8, all dead).
  Doc: `06-Systems/Professions-Arc.md` section 37, "DISENCHANT-SAID".

## STEED-KEPT: a revenant never takes a horse, a cart or a deed - and one it took comes home

`src/systems/revenant/revenant.js` (`revenantMayTake`; `ensureMirror`'s hand-back, `tookHomeLine`).

FOUND, on the code (a player's private report: their horse vanished after a death in a dungeon - not in the pack, not at
the stable). A revenant's kill takes one piece at the respawn (RVN8, `12-Enhanced-AI/Feud-Arc.md` section 19), drawn
among the equipped weapon and the pack's five most valuable pieces it may take
(`revenant.js:"export const revenantMayTake = (item) =>"`) - and that law refused letters, quest items, summoned
pieces, gold, the Materials Bag, pack-only and locked pieces, but not a vehicle or a deed. Owning a horse or a cart IS
having it in the pack (DFU's `Items.Contains(Transportation, Horse)`; the stable and the wagon yard sell them into it,
`merchantYards.js yardStock`), and a stable's horse is worth more than most of a pack. Reproduced on the real module
(`pickTaken`, 1,000 ids): a stable-minted horse beside a worn steel longsword and four spare weapons was drawn 165
times - "X took your Horse." - while the open zone's own law already calls a vehicle and a deed pieces that never
change hands (`wildLeaf.js:"export const WILD_NEVER_GROUPS = Object.freeze(new Set(['Transportation', 'Deeds', 'QuestItems', 'Currency']));"`).
The same law let it take a ship's deed or her packed parts (Come Sail Away's own two, filed under UselessItems2, which
the trade never hands on - a deed handed on is a second boat), a deed as Daggerfall files one (House_Deed, Ship_Deed -
MiscItems, not the Deeds group), and the spellbook (KEEP-SPELLBOOK: "Your spellbook never leaves you").

THE FIX - THE OWNER'S DECISION (Mac, 2026-10-19, answering this session's questions): "Exclude, and return taken ones".
- `revenantMayTake` refuses what never changes hands, as the open zone's death reads it (`wildCanLose`): A VEHICLE OR A
  DEED (the zone's own groups, `WILD_NEVER_GROUPS`; and the decor's kept-back list, `decorLaw.js DECOR_OWN_KEPT_BACK` -
  a house's or a ship's deed as Daggerfall files them, and the spellbook with them), and A SHIP'S DEED OR PARTS
  (`realmTradeLaw.js BOAT_TEMPLATES`). The pick, the take and a deserter's or a betrayer's split (`splitPack`, which asks
  the same law) all follow it - a deserter's ship's deed comes back to the pack.
- BOUND PIECES, DECIDED here, named (the decision left them to this slice): NOT refused - they stay RVN8's own, as AUDIT
  625 W2 already pinned ("a bound ember is still the feud's (RVN8 names its own exclusions)",
  `test/systems/audit625_wallet.test.js`). By the zone's reasoning: the zone keeps a bound piece at a death because a
  death's remains are anyone's (the trade's refusal, `tradeableRecord`) - and what a revenant takes never rides to another
  player: its body hands what it carried to its owner alone (`bodyLoot.js shareableRecord` -> `peerWord.js
  neverPeerHanded`, a bound piece among them). By RVN8's own: it refuses what must never leave the pack at all - the
  pack-only wallet, itself bound (AUDIT 625 W2) - and a slain, executed or spared one gives the rest back. (The first cut
  of this slice refused bound pieces too; the wallet audit's pin failed on it, and its reasoning holds.)
- RETURN TAKEN ONES: LETTERS-HOME's hand-back at the mirror's merge (`ensureMirror`, the first ask after a load, from
  the save's own copy of `took` - the pack it came out of is that save's, so never twice) now hands home EVERY piece
  `revenantMayTake` refuses - a horse, a cart, a deed, a ship's deed or parts, the spellbook, a letter - into the pack,
  which is where the game keeps owned transport: the horse is the very horse the stable sold (its `horseSeed`). What it
  may take stays its own. SAID ONCE, as the owner asked: one line a piece, "Grushnak the Butcher could not keep your Horse.
  It is back in your pack." (`tookHomeLine`, through the text core), handed to the HUD once the world can speak
  (`notify.js hudTextWhenShown` - the merge can run before a host stands). DECIDED here, named: a returning letter is said
  now too (LETTERS-HOME handed it back silently) - one law, one word.
- Repro after the fix: 0 of 1,000. No host touched.

- **Pinned**: `test/systems/revenant/fb1019f_steedkept.test.js` (4: the law over every producer's piece - the stable's
  horse, the yard's three carts, a prize's deed and a yard's parts, the starting kit's spellbook refused; Portal Stones
  (bound) and a sword still taken; the repro's pack never drawing the horse in 1,000, and three deaths through the real
  door taking none of the horse, a caravan or a ship's deed; a deserter's ship's deed back; the load - the horse, a cart,
  a ship's deed and the spellbook home from the save's copy, each said once, the saber kept by its taker, none twice and
  nothing said at the next save's load). Unmoved and green: `test/systems/rvn8_took.test.js`,
  `test/systems/revenant/fb1018b_letters.test.js`, `test/systems/audit625_wallet.test.js`.
  `tools/mutants/fb1019f_steedkept.json` (7, all dead). Re-aimed by content: `fb1018b_letters.json`'s
  LETTERS-HOME-handback-dropped and LETTERS-HOME-handback-kept-on-record (onto the hand-back of every refused piece);
  its LETTERS-HOME-letter-takeable is now `equivalent` (the letter is refused through a second door, the kept-back list,
  which names Letter_of_credit - both gone is the bug, and THE LAW's pin fails it).

## PURSE-MEND: staff mend a purse a wrapped sale left below nothing

`src/net/repairLaw.js` (`purseMendOf`, `applyPurseMend`), `server-account/src/review.js` (`staffMend`, `mendAct`,
`realm-findings`' purse), `server-account/src/index.js` and `service.js` (the route and its refusals' statuses),
`tools/realmReview.mjs` (`mend`), `src/net/accountClient.js` and `locales/` (the refusals said, drafted in-session in
the thirteen languages that carry the whole catalog); and two leftovers,
`src/systems/guild/guildServiceActions.js` (`cureOfferMessageOffset`) and `src/ui/reforgeWindow.js`.

FOUND, on the code. A player's private report: after a sale of a lot worth over 18 million at 0.0.235, the purse read
-8,000,000 and the carry weight -19,995 kg. TRADE-WRAP (FIELD BUGS 2026-10-18b, in 0.0.249) fixed the wrap itself. Read
again with 0.0.235's own counter against main's, every lot that wrapped offline paid exactly 16,777,216 short (2^32 over
CalculateTradePrice's 256); online the shortfall varies with the lot - 150 Daedric claymores at a quality-10 counter,
Mercantile and Personality 100, paid -7,489,216 where main pays 2,592,000 - and the old online arithmetic could overpay
too (a 25-million lot at a quality-10 counter, Mercantile and Personality 40, paid 483,509,028 where main pays
3,965,297). The weight is the purse's:
`inventory.js:"export const GOLD_PIECE_WEIGHT_KG = 0.0025;"` times -8,000,000 is -20,000 kg, beside about 5 kg of
pieces, and the purse's write is unclamped, as DFU's setter is (`inventory.js:"entity.goldPieces = goldPiecesOf(entity) + amount;"`).
A purse already below nothing stays there. Every price is more than it, so every payment spends the letters first
(`court.js:"const loc = items.find((it) => it.templateIndex === LETTER_OF_CREDIT_TEMPLATE);"`), and the judge finds it
at every checkpoint (`judge.js:"if (!purseWord(save?.goldPieces)) out.push({ code: 'gold' });"`): the trade held, and a
death in the zone burnt (BURNT-SAID). 18b left such a character to "a staff repair (`review.js`)", and none could be
made. The review's one repair took a faction's flag or nothing (`repairLaw.js:"if (!REPAIR_FLAGS.includes(flag)) return null;"`)
and never reached the purse. `clear` lifts the hold but EXCUSES its signature (`review.js:"law_excused = law_sig"`), so
a later purse below nothing would hold nothing. A rollback loses every hour played since the clean checkpoint. And staff
could not see the purse at all: the wealth counts a purse below nothing as none.

THE FIX. The review's third act on one character, `realm-mend { id, ticket, was, gold, note? }`
(`review.js:"async function mendAct(ctx, row, by, note, body) {"`; its law
`repairLaw.js:"export function applyPurseMend(save, { was, gold }) {"`, the service's and the tool's). The record's
purse, still the `was` staff reckoned from (`mend-moved` otherwise: played since, or the wrong character) and below
nothing (`mend-not-negative` otherwise), is SET to nothing - never added to - and `gold`, what the character is owed (0
to one int's worth), comes as ONE LETTER OF CREDIT at the front of the pack. That is what the trade window itself pays
for a sum the pack cannot carry (`tradeModes.js:"export function sellProceeds(tradePrice,"`, DaggerfallTradeWindow's
sell arm), so it is how an honest sale of a lot that big pays; a purse of coin would weigh tonnes. The act shares the
repair's machinery, which both run now (`review.js:"async function staffMend(ctx, row, kind, ticket, change, steps, answer) {"`):
a developer's alone, the dead never, once a ticket in `realm_repairs` (a mend's row names no faction and no bit, 0 and 0,
`was` the purse it found and `gold` the letter - so no migration; a ticket names one act, and the other kind's is
`repair-ticket`), the record seized one sequence on with its seat taken from any tab, the gold witnessed and counted as
the `repair` faucet, the act written among the findings. AND THE HOLD THE PURSE MADE GOES WITH IT. When the hold is the
law's, the finding it stands on is the purse's alone (`PURSE_SIG`, `lawSigOf` of the judge's `gold`) and no timed hold
stands, the mend lifts it as the next clean checkpoint would
(`review.js:"const lift = row.held === 'law' && row.law_sig === PURSE_SIG && !(row.held_until > nowS);"`): the hold
and its signature go, `judge_rev` moves one on, guarded on the judgement the act read. The strike stands and fades as
every strike does - which strike the purse struck, the row does not say. Any other hold stands: the law's beside another
finding and a timed one are the next checkpoint's, and staff's own is staff's. `realm-findings` says the purse
(`character.purse`), and `tools/realmReview.mjs mend <id> <ticket> <was> <gold> [note]` is the door, checked by the same
law before it is sent.

THE LEFTOVERS, both what they seemed. The haggle message reads its band off `cost >> 1` and `cost - (cost >> 2)`
(`guildServiceActions.js cureOfferMessageOffset`, the temple's and the trade window's one home). Past 2^31 the shift
wrapped int32 to a negative half, so a lot that big never got the cheerful line and a bought one could get the wrong
grudging one: 25,000 Daedric claymores at a quality-10 counter named the wrong band in three of four modes and skills.
Halved and quartered by division now (`guildServiceActions.js:"if (Math.floor(costBeforeBargaining / 2) <= cost) {"`),
the shifts' band for every cost an int holds. DFU's `cost` is C#'s int (DaggerfallTradeWindow.ShowTradePopup), which a
lot that big had wrapped already - TRADE-WRAP's departure at one more site. The Reforge said its purse as
`Math.max(0, gold | 0)` of the coins and the letters together (`court.js totalGoldAmount`), so two letters of one int's
worth each read "0 gold". It says the gold whole now
(`reforgeWindow.js:"const goldSaid = (gold) => Math.max(0, Math.trunc(gold) || 0);"`), the guild's pages and the
temple's alike.

What PURSE-MEND does not reach. A purse a payment has since set to nothing is no longer below nothing. The service's
payFromSave counts a purse below nothing as none, and where the letters fall short it pays the rest from the bank and
writes the purse 0 (`realmGoldLaw.js:"else { owed -= purse; save.goldPieces = 0; }"`). The sale's loss then stands with
nothing in the record to show it, the mend refuses it (`mend-not-negative`), and no act gives gold alone: the repair's
needs a faction's flag. An offline character's purse is its own device's save, which no judge reads and no staff act
reaches. And an online lot the old arithmetic overpaid left a purse above nothing, with no finding; the budget's measure
(`realmReview.mjs gains`) shows the gain, and the mend is not for it.

- **Pinned**: `test/net/fb1019f_pursemend.test.js` (8), over the real Worker and migrations (`test/accountDb.mjs`). Its
  record is a made character's save (`save.js snapshotPlayer`) after the field's sale as 0.0.235 paid it (150 Daedric
  claymores, -7,489,216 into the purse), checkpointed so the judge holds it. It pins the mend (the purse and the letter,
  the record, the row, the hold lifted and the strike kept, the faucet, the finding, the next checkpoint clean); the holds
  that stand (the purse beside a ring no craft made, the third strike's timed hold, staff's own); the refusals (403 and
  401, eight bodies 400, `mend-moved`, `mend-not-negative`, 404, the dead); once a ticket, twice at once, and a ticket of
  either kind; the command and `findings`' purse; and the leftovers (the bands past 2^31 against the halves and below
  it against DFU's shifts; the Reforge's purse on both pages); the lift guarded on the judgement it read (staff's hold laid while a mend is in
  flight moves nothing, `seq`, and asked again it mends under staff's hold - AUDIT FB1019f A2); a mend of 0 gold giving no
  letter and no faucet row and lifting the hold (A3). PIN MOVED: none.
  `tools/mutants/fb1019f_pursemend.json` (28, all dead). ACCOUNT DEPLOY: acct163, with COMPANION-DROP; no migration
  (AUDIT FB1019f A1). Re-aimed by content: `fb1014_summonrepair.json`'s
  SUMMON-REPAIR-no-finding, -the-row-out-of-the-batch and -the-ticket-unread onto the shared `staffMend` and the repair's
  `steps(seq)`; -the-gold-as-coin and -the-gold-unchecked-by-the-tool onto their own copies (the mend's law and door
  carry the same text now). That list re-run: 16, all dead.

## HEIR-WHOLE: an heir can reach remains that lie in a whole-built dungeon

`src/systems/instancePlaces.js` (`remainsWholeAt`, `remainsInstanceEpoch`), `src/scenes/instanceDoor.js` (`questHere`,
`mine`, `stillHeld`), `src/scenes/legacyHost.js` (`remainsWhere`, `remainsLying`), `src/scenes/world.js` (the door's
`remains` dep - its one wiring line).

FOUND, on the code (reproduced first on the real producers - the Legacy host's death at the one damage door, the real
instance door, the build an entry makes off worldModes.js's own text, the world host's remains reads off world.js's):
a death records the size its dungeon was BUILT at (`world.js:"dungeon: dl ? { regionIndex: dl.regionIndex,"`'s
`builtDungeonSize`, AUDIT FB1013d B1), and the remains stand and open only in a build of that size
(`world.js:"const legacyInDungeonOf = (h, place) =>"` - another size is another layout). An instance is always the dungeon
whole (`smallerDungeons.js:"if (online) return whole ? 'full' : onlineDungeonSize(dfLocation);"`), and the online world
draws three dungeons in four small or medium in public (SD-ONLINE), and builds 2,005 of the 4,232 smaller. The fallen died in another player's instance, so the
row said `size: 'full'`; the heir's door offered an instance only where a quest of theirs named the place
(`instanceOffer`'s `questHere`), and none did, so every visit was the public room - for a ruin laid medium, the door
answered `{ instance: null, whole: false }`, the build was `medium`, and on the very spot `legacyAtPlace` was false and no
body stood (while a whole build of the same ruin stood her at `[10, -5.4, 30]`). The one room that held a whole build,
the other player's instance, admits only its owner, their party and staff (`instanceAdmission`). `Instances.md` never
named the remains. Present at 0.0.245 and on main.

THE FIX. The death quest is a quest of the heir's: where the line's lying remains were laid in the dungeon whole and the
world lays that dungeon's public room smaller, its place is "a dungeon with your quest" (Mac's INSTANCES "Where"). One
law, `remainsWholeAt(rows, site)` beside `questsAtSite` - the rows the Legacy host would stand (`remainsWhere`: `{ line,
id, place }`, the slow tick's own guards in one home, `remainsLying`, and no list made ready: the door is asked during a
load's awaits, when AUDIT FB1013d A2's world-moved rule holds the lists), whose `dungeon.size` is `'full'` and whose
`mapId` is the site's, at a site the world re-lays (`dungeonSite`'s `relaid`). The door's `questHere` asks it beside the
quest machine, so everything a quest's place has follows from the one predicate: the popup (Public, Your instance) with
QUEST-ELSEWHERE's line before the choice, every other way in (`entryFor`), and the older relay's fallback, the public room
laid whole. The heir's room is their own account's (`myOwner`) with the remains' epoch - `remainsInstanceEpoch`, four
bytes of SHA-256 over `instance:epoch:<line>:<remains id>:remains`, the Hold's shape: nothing to save, the same on every
device the line is played on, one room a death - unless a quest of theirs names the place, whose room (the dungeon whole
too) stands them as well; `stillHeld` keeps it while they lie there whole (a save made in it loads back into it; the bones
taken up, the public room laid whole, as an ended quest's). A whole build of one dungeon is one layout whoever builds it -
`dungeonLocationFor(..., whole)` is the location itself, drawn from nothing, and the build is its copy - so the heir's
instance stands the remains on the floor under the recorded spot. Nothing else gains access: the relay is unchanged (the
other player's room still refuses the heir; the heir's admits its owner and their party, the INSTANCES law), and only
the heir's own line's rows reach their door. Unchanged: remains laid in the public room (any size - its own build stands
them; made true by AUDIT FB1019f B1), a row from before the size was kept, and the reverse - a death in a smaller public room is not stood in a whole
build (its floor position is the other layout's), and Public stands it. Not a DFU member (DFU has one player and no
rooms; Ledger A, INSTANCES); Project Legacy's remains are the port's own (Legacy-Arc section 7). The host: bootWorld
+2 logical lines (36,190 to 36,192 under 36,233), the door's one dep; no relay or account file changed (net/instanceRoom.js
untouched - RELAY_VERSION unmoved).

AUDIT FB1019f B1: `relaid` read the size the world draws (`dungeonSizeFor` online), not the size it builds, and a
dungeon at or under its size's threshold is never laid anew, so its public room is the dungeon whole. At 1,128 dungeons
(196 of five blocks drawn small, 391 of five and 541 of eight drawn medium) a death in the public room recorded `size:
'full'`, the door offered the heir a private instance under "The shared dungeon is smaller and has none of it", and
`entryFor` took them into it, while the public room stood the remains; QUEST-ELSEWHERE's line was false there too (the
mount stood the quest's things). `relaid` is now the size built
(`smallerDungeons.js:"export function builtSizeFor(dfLocation, deps = {}) {"`: no build and no DFRandom draw, off the
build's own `laidAnew` test), so every one of the 4,232 sites agrees with its build.

- **Pinned**: `test/systems/legacy/fb1019f_heirwhole.test.js` (7: the report - the death in another player's instance of
  a ruin laid medium, the heir's popup and its line, Public standing none, their own instance (their account, the
  remains' exact epoch) standing the body over the record's list on the floor under the spot and opening it there, Ann's
  room still refused to the heir and the heir's to Ann; the room kept while they lie - one room every entry, a save's,
  every other way in, a quest's room first and standing them too, the older relay's whole public room, the bones taken up
  and the offer gone; public-room remains as they were - medium, whole, a row with no size, another ruin, another line's
  door, and a whole build standing none of a medium death; one whole layout whoever builds it; AUDIT FB1019f B1's drawn-against-built table, a death in a five-block public room
  offering nothing, and the whole MAPS.BSA corpus behind ARENA2). PIN MOVED: `test/systems/quest/instances3_door.test.js`
  (QUEST-ELSEWHERE: a ruin of thirteen blocks, where it had none); `test/systems/fb1013d_remains.test.js` unchanged and
  green. `tools/mutants/fb1019f_heirwhole.json` (16, all dead; re-aimed for B1: `dsize1.json`'s
  DSIZE1-the-threshold-off-by-one and `fb1016c.json`'s QUEST-ELSEWHERE-relaid-never, re-run with their neighbours, 7 dead). Re-aimed by content: `fb1013d_remains.json`'s
  FB1013d-REMAINS-STAND-the-list-not-made-ready (onto `return remainsLying().map(...)`) and FB1013d-AUDIT-C3-every-row-stood
  (onto `remainsLying`'s `return openRemains().filter(...)`) - re-run, 64 dead, 2 equivalent as recorded.

## What is not fixed here

Each was traced on the code at `9e00d52e9`; none changed in this pull request. A report a reply to its sender would settle
says what to ask.

### Not proven

- **A dungeon empty, nothing activating** (update 0.0.258). A shared online dungeon keeps the foes another player killed
  dead for twenty minutes (DUNGEON-RESPAWN), and another player's puppets stand still until their updates come - empty by
  design; activation is held by `overlayHeld` (the dungeon's window stack, the street's, `staffTeleportHeld`), and a frame
  that throws before both would give both symptoms. Nothing between 0.0.256 and 0.0.258 touched dungeon activation. Ask:
  the dungeon, online or in a party, whether they could attack, the console.
- **Maximum health 134 to 34 on entering a castle.** `maxHealth` is a getter (`chargen.js`: own + Renown + Spire); exactly
  -100 fits the whole online layer going off - `leaveSeat` on a superseded room link
  (`world.js:"setSigilOnline(false); setRenownLayer(playerEntity, null); computeEntityMods(playerEntity);"`) - or Firmament health sleeping while mentoring in a party. Ask:
  the sheet before and after, any "another tab" line, the party.
- **An Elite Breach finished with no rewards.** A Rehearsal pays nothing (Elite-Gates 27.7), a Redoubt already paid that
  arena week pays gold only (19), a tear, wipe or fall loses every Reliquary (16.3). The rows that decide it: `eg_stakes`
  (`rh`), `eg_redoubts` for the breach (paid, stones, key), `eg_runs` (`why`, `h`), `eg_reliqs`.
- **Remains gone after a death to monsters in the zone** (update 0.0.236). Three candidates: the record held, the drop
  burnt and nothing said (BURNT-SAID, fixed in 0.0.249); the remains' twelve minutes (`WILD_REMAINS_MS`) run out before
  the rise came back; the deposit given up at fifty seconds after the socket left the room. The `wild_falls` row (`burnt`,
  `items`, `at`) against the time they came back decides it.
- **A guild's quest that will not turn in; a quest letter that never dropped; standing going to another region; standing
  falling despite quests done; a quest item that does nothing when given.** Each matches a path of Daggerfall's own
  scripts (the kill and the click both owed; the letter given to the quest's own foe in the quest's own dungeon, never a
  Public room's; reputation spreading to a faction's allies at half, DFU's `ChangeReputation`; OWED-PACE's fifteen a day
  online, losses in full; a delivery target's one-time line) - which one needs the save or the quest's name. The misleading
  "not available yet" is QUESTOR-SAID's.
- **A raid's monsters take no damage.** In a raided town every monster may be another player's copy; a blow is a claim
  its owner can refuse (the cell, the quest party, `exteriorFoes.js applyHit`'s bounds), rolled back on the striker's
  screen. Which refusal fired needs the relay's counters for that cell.
- **"Damage from holy places" never bites.** Both drawbacks - the class disadvantage and the item side effect - bite on
  the real round in a registered temple (`isHolyPlace`: a Temple building or the Fighter Trainers' faction, DFU's pair).
  Ask which, where and how long.
- **Endless enemies in a flooded dungeon while invisible.** No spawner reads invisibility, and a replaced foe never fires
  the spawn hook again; a quest's CreateFoe at its interval would pile foes on an invisible player who is never attacked -
  unproven. Ask the dungeon and the quests.
- **Firefox's mouse look in steps.** The look path is floating point throughout; nothing changed in it across the report's
  window. Firefox turning raw input (`unadjustedMovement`, which the port has asked for since MAC1) on by default would
  change the feel overnight - a hypothesis. Ask the Firefox version, and to retry with
  `dom.pointer-lock.unadjusted-movement.enabled` off.
- **A menu on right-click at the desktop window's edge (Linux, GNOME).** Not the page's (`installContextMenuGuard`) nor
  the shell's (no handler, a framed window); a free cursor can reach the frame, and right-click swings whether the
  pointer is locked or not. Ask whether the cursor shows while looking around, and `XDG_SESSION_TYPE`.
- **A name shown with a "1" after it.** `sanitizeName`, `checkName`, `nameIsIssuable` and `wornNameRefusal` pass the
  name unchanged, and nothing on the path adds a suffix. A screenshot would show where it stands.
- **Firmament's bonuses not applying.** The stars are in force online with a sign chosen, sleep while mentoring, and a
  selection waits for Accept; a refused commit is said once. Ask online or not, Accept, the party.

### The design as chosen

- **Level progress past 100** (two reports) - SOFTCAP1 (2026-09-29): a point past 100 counts a quarter toward the level
  sum, a skill at a time, rounded down (`skillSoftcap.js`), and +2 at 125. The reporter's numbers reproduce exactly on the
  real chargen and mastery; nothing is lost over time (every four points still give one), and the ceiling is higher than
  feared. The rule is recorded only in code and `06-Systems/Systems.md`'s SOFTCAP line - no ledger row, no pin of the
  level sum: a gap for the arc, not changed here.
- **The road slowing with no enemy near** - TV2's load cap (the owner's "Cap it to what loads cleanly"): the cap cuts fast
  and climbs one step every four seconds of built ground, and leaving the view resets it - which is why leaving and coming
  back seemed to cure it. OW-BUILD (the owner's choice after QUEUE-OWED) reached main the update after the report.
- **A Smuggling contact gone from the room** - Daggerfall's own K0C00Y03: one branch hides the contact and lays an ambush;
  a letter with the second contact's name comes hours later, as in DFU.
- **Twelve Mages Guild quests paying no gold** - Daggerfall's data: a non-member's four (N0C00Y10-13) end in `give pc
  nothing`, and most members' pay an item.
- **Camping Equipment keeping its charges** - REST2: placing spends nothing; a night slept at your own lit camp does (a
  rest of six hours or more offline, REST1's night online).
- **A "permanent" poison** - DFU's `CompletePoison`: a completed poison stays until the attribute it took is healed
  (Drothweed's strength - so the pack is overloaded). Cure Poison, a temple, or Heal Strength ends it.
- **Crafted jewellery enchanted again** - PROF10 J2 (`06-Systems/Professions-Arc.md` 36, the owner: "Item maker can add to
  it"): its rows count against the budget and the ten-row guard; not an exploit.
- **/unstuck's cooldown** - PVPUNSTUCK (`11-Multiplayer/Wild-Zone.md` 17): thirty minutes, sixty in the zone.
- **An element's colour on a damage number, a visual for Cast When Strikes** - requests: the numbers tell normal from
  critical only, and Cast When Strikes is DFU's spell straight onto the target (`CastWhenStrikes.cs`), Weapon-Glow law 1.

### A restore only staff can make

Seven reports ask for something back - keys, a run's keys, letters of credit, a purse, a character, a horse, an
inheritance. KEY-FACE, PURSE-MEND, STEED-KEPT and HEIR-WHOLE make four of them reachable (a horse taken comes home at the
next load; an heir is offered their own whole build); the rest are staff's, from the account's rows - `eg_stakes` and
`players.eg_keys` for keys, `wild_falls` and the save's `modData.Revenant.list[].took` for letters, `realm_findings` and
`realm_characters.held` for a purse, `realm_characters.dead_at`/`dead_why` and `lineages` for a character
(`tools/reviveRealmCharacter.mjs`, Legacy-Arc REVIVE).

### Open for the owner

- **The estate's bank and wagon** (ESTATE-WIDER, Legacy-Arc 5 - "the owner's call"): an heir takes a quarter of the gold
  the dead carried; their bank's balance does not pass.
- **A piece made after SIDE-ONCE told from one made before** - the account service judges a piece by the same law,
  which counts a side effect by its effect (an old piece's copies stand), and keeps no record of when a piece's rows
  were laid; telling the two apart takes a record the service keeps (SIDE-ONCE).
- **The arcane paths' arcs** (`arcanePowers.js`) hurt their foes without a number of their own, as Chain Lightning's did
  before CHAIN-SEEN - the same omission outside the loot powers, left for its arc.
- **Two shelters the zone's drop does not reach** (COMPANION-DROP; AUDIT FB1019f B6): CARGO-ANYWHERE's hold door opens a
  ship's hold from inside the zone (`scenes/holdDoor.js`, the owner 2026-10-17: "Cargo should be able to be accessed at
  any time"), and a boat placed on the zone's water keeps her hold through a death there - each the shelter a companion's
  bag was, by a door that is no companion's. Closing either changes an owner's rule (the hold's any-time access, a boat's
  hold), so both are the owner's.
- **The collider's bilinear floor under drawn landform ground** - the part of UNSTUCK-OUT's open sentence "Apply to rocks
  too" did not decide (ROCK-CLEAR).
