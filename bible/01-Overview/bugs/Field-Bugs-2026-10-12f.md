# FIELD BUGS 2026-10-12f - hacked gold handed out

One report, in a session: "Uhhh apparently theres people handing out hacked gold ingame". Read on the code as it stands
at main's `f5a7f183d`, by three read-only sweeps first (every channel a client's word reaches another player by, every
account-service route that moves gold between records, and what the judge does with an absurd purse), each claim that
mattered checked again by running the real modules.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "people handing out hacked gold ingame" | **The peer's word.** A room's record of an opened container, a body's grant, a foe's heir's pack and a fallen player's worn offer are a client's word, and the receiver credited the VALUE it named: a coin pile to the wire's 65,535 (AUDIT WORLD6b-iii(c) B2), a letter of credit's worth to 2^53 - bounded by nothing - and an item's price only from below (AUDIT WORLD6a B1's floor). A bank cashes a letter at its face, a counter pays a piece by its price. No record held what the word carried, so the giver was never held, measured or charged, and the receiver's budget was | LETTER-PEER, PRICE-CAP, WORN-ONLY |
| | | **The law.** A purse, a letter's worth and a coin pile's count were each any whole number to 2^53; the budget (INT5) only measures (Mac: "Measure 7 days, then enforce"), so a modified client's checkpoint of nine quadrillion was judged lawful, held nothing, and every route - a realm trade's 1e9 coins and sixteen letters of any worth, the guild vault's letter - handed it on | GOLD-INT |
| | | **The review.** While the budget measures nothing is held, so staff's `holds` listed none of the characters that made gold, nor the hands their trades reached (a trade is witnessed on both rows: no finding names its receiver) | `realm-gains`, `realm-trades` |

## Reproduced first, on the real modules

- **A body's grant** (`scenes/exteriorFoes.js`, two real pools joined by nets, the item law registered as every host
  registers it): Mac asks Bob's machine for a body; Bob's modified grant `[a letter of credit at 1,000,000,000,000, a
  65,535 coin pile]` landed whole - purse 1,000 to 66,535, letters 0 to 1e12, "You take 2 items."
- **A building's cupboard** (`world/interior/interiorShared.js` applyInteriorLoot): one word landed a 9,000,000,000,000 letter
  and 63 coin piles (4,128,705) in place, for whoever opened it next. A dungeon's and a building's word stays in the
  relay's memory thirty days (`WORLD_TTL_MS`), so one seeded container pays every later visitor.
- **The door** (`systems/loot/loot.js` validLootItem, `systems/item/itemLaw.js` itemFindings): a letter at any value to
  2^53 - 1 passed both; 64 of them pass one container's word.
- **An item's price** (`systems/tradeModes.js` counterValueOf, `systems/shopStock.js` calculateTradePrice): a counter
  pays a piece by its price - at a quality-10 counter and 50 Mercantile and Personality, half of it offline and a sixth
  online, linear to at least nine million (a dagger priced 9,000,000 sold for 1,471,656 online) before the formula's
  `>> 8` wraps (negative by twenty million).
- **The judge** (the real Worker): a purse, an account, a letter or a pile at nine quadrillion is one `measure`
  finding and no hold; the first-judgement outlier flag cannot fire after one; `holds` lists none of it; `clean`
  (verdict.js) ignores the budget, so the inflated checkpoint becomes the rollback point and the save before it is
  dropped; and measured gains become the baseline enforcement starts from.

## LETTER-PEER: a letter of credit never rides a peer's word

`src/systems/peerWord.js` (new): `isLetterOfCredit`, `neverPeerHanded` (a bound piece - SS3 - or a letter),
`peerHanded`, `letterRefusesPut`, `letterPutText`. SS3's shape, its law widened: no roll mints a letter (a letter is gold
drawn on an account), so no honest container, body or worn offer holds one but by a player putting it there - and
online a room's container and a body are everyone's. A letter passes between players by the realm's trade alone, which
settles from the giver's record.

- **Every list a peer hands over lands without one**, at every site SS3's `unbound` stood: a dungeon's container record
  and a body's items on the wire (`scenes/dungeonContext.js`), a building's container record
  (`world/interior/interiorShared.js`), a body's grant and a foe taken as its heir (`scenes/exteriorFoes.js`).
- **And no list this client says carries one**: a dungeon's record (`lootRecords`), a building's
  (`interiorLootRecords`), a foe handed to its heir; and the OWNER's grant (`grantCorpse`) keeps what never rides a
  peer's word on the body, its own - moved behind what may go, since the grant reserves from the pile's front by count
  (a naive filter there would grant one piece and keep another) - and the body's record says it holds only what a
  peer may take (`o`), so no peer is offered a body that answers nothing.
- **The put** (online, `systems/online/onlineLane.js` isOnlinePage): a letter goes into no container but the player's own -
  the classic pack's Remove into a chest or a body refuses it in its own words ("Letter of Credit stays with you
  online - a chest or a body is everyone's. Hand it over in a trade."); the player's own pile on the ground, its storage
  (an owned house's cupboards, a ship's chest), the wagon and the ground take it; offline every place does, as DFU's.
  The enhanced pack's two gates (the stow and the drag's ghost) ask the same law - a loot session never opens the pack
  there (MAC-M2 B), so they stand where a container would be reached the day one does.
- **What it costs an honest player, asked and answered.** The session: "I dont wanna mess with honest players". Every
  part of this record was read again against it, and this is the one place an honest player can feel: online a letter
  goes into no room's container or body (the classic pack says so; the enhanced pack's loot window only ever took), and
  a letter already lying in a room's container when this lands is dropped from it. No one can tell that letter from a
  forged one: the ledger keeps no row of a piece its holder let go (INT4 `item_uids`), the relay's memory of a room is
  its host's word with no depositor in it, and a record's `t` is a client's. It was any player's to take already, and
  the room forgets it in thirty days. Asked - block new letters (this record), leave them alone (a forger's letter, up to
  GOLD-INT's two billion, reaches the honest), or a letter the service holds while it lies in a chest (days; it saves no
  letter already there) - the answer: block new ones.

## PRICE-CAP: a peer's price is held under the law's ceiling

`src/systems/loot/loot.js` `lawPriced`, applied by `validLootItem` and `validLootList`; `systems/item/itemLaw.js` registers its
`worthCeiling` with the law (`setItemLaw(itemFindings, worthCeiling)`). AUDIT WORLD6a B1's "THE PRICE IS NOT THE
WIRE'S" built the floor; this is its other half: a peer's price is at most the law's own ceiling on an honest price
(its base four times over, its lines', a tier's, a margin - the wealth measure's ceiling). Swept against the honest
producers (`test/honestItems.mjs`, four seeds): of 46,919 pieces, the 30 over the ceiling were Come Sail Away's boat
deeds alone (their hull's price, 100,000 to 200,000+). So a record whose `value` is no price - a letter (its worth IS
it) and a boat's parts or deed (`net/realm/realmTradeLaw.js` VALUE_IS_IDENTITY_TEMPLATES, BOAT_TEMPLATES) - is left as it
came, and the floor still stands under it. Lawful loot handed on by a peer is still the budget's (Integrity-Arc 2, "the
limit, said plainly"); a dagger priced at millions is not.

## WORN-ONLY: a fallen player's worn offer lands what can be worn

`scenes/world.js` wildBodyArrived. An honest offer is its fallen's worn pieces alone (`systems/wild/wildDropLaw.js`
wornOffer). A coin pile in a modified one went through the choose-one window's gold arm, which pays the purse and answers
before the choice (DFU's own `return`, `systems/item/itemTransfer.js` applyTransfer), so the killer was paid up to sixteen
piles - a million gold - and the choice never made. Each record is minted alone in its place (AUDIT INT9 - the pick is an
index) and kept only when it can be worn (`systems/equip.js` wearableItem).

## GOLD-INT: a purse, a letter's worth and a coin pile's count are each one DFU int

`systems/item/itemLaw.js` `GOLD_INT_MAX` (2,147,483,647 - PlayerEntity.cs:64 `int goldPieces`, DaggerfallUnityItem.cs:40
`int value`, DaggerfallUnityItem.cs:51 `int stackCount`, read from DFU's own source) and `CLASSIC_VALUE_MAX` (a classic
save's record, its save tree's unsigned 32 bits - `formats/save/saveTreeFile.js` getUint32); `server-account/src/judge.js`
`purseWord`. The port's producers keep under it - the bank's amount field is nine digits
(DaggerfallBankingWindow.cs:188-190), an estate is `| 0`, the realm's own credits at most a hundred million - so a count
past it is no honest one: a law finding, which holds the trade from day one (INT3), where the budget, measuring, held
nothing. A bank account is left as it was: its type in DFU's record was not read here. The law's version moved to 4 (a
finding names its law), `ACCOUNT_VERSION` acct123 with it (TECH1's rule: a law names the first service that carries
it) - 3 and acct121 on its branch, renumbered past BAL9 (which took them for its caster's lines) at the merge, and
acct122 past NAME-AS (which took that for the name the room reads) at the next. The honest sweep (`test/systems/item/int1_itemlaw.test.js`) still finds nothing.

## The review: realm-gains and realm-trades

`server-account/src/review.js` `gainsMeasure` (`/v1/mod/realm-gains`, `node tools/realmReview.mjs gains [days]`): every
character whose unexplained gain went past its bucket in the window (a `measure` finding, or `budget` once enforced),
largest first - its account, its hold, its wealth now, how many times, its largest gain. `tradesOf`
(`/v1/mod/realm-trades`, `... trades <id>`): one character's settled realm trades the service still keeps (seven days),
newest first - the character and account on the other side, and what each gave: gold, letters at their worth, pieces.
A developer's alone, as every review route.

## The four hosts

- `scenes/world.js` - WIRED: the worn offer; its street's foe pool (the grant, the heir) through `exteriorFoes.js`.
- `scenes/worldModes.js` (interiors) - WIRED: a building's containers through `world/interior/interiorShared.js`; its foe pool
  through `exteriorFoes.js`; the classic pack's put through `ui/native/nativeInventory.js`.
- `scenes/dungeonContext.js` - WIRED: its three sites (a record said, a record heard, a body on the wire).
- `scenes/exterior.js` - NOT WIRED on purpose: the offline fixed city has no relay and no other player; its pack's put
  reads DFU's law offline.

## Pinned

`test/systems/hackedgold.test.js` (10): the law of a peer's word; a body's grant both ways (the field's forged grant, the
owner's body keeping a letter, its count); a building's word heard and said; every other site by its line; the price
held under the ceiling (an honest one, a letter, a deed, the floor); the worn offer; the put on the classic pack online
and off, and the enhanced pack's gates; GOLD-INT's bounds; GOLD-INT over the real service (a letter of a trillion and a
purse past one count held by the law, the realm trade refusing it as its own); the review (`gains` past the bucket while
`holds` is empty, `trades` both ways, 403 to anyone else). And `test/systems/item/int1_itemlaw.test.js`'s HACKED-GOLD PRICE-CAP
(added at the merge past BAL9, after the session's "I dont wanna mess with honest players"): every piece the honest
sweep mints comes off the wire's projection at the price it did without the ceiling registered - BAL9's caster lines
and arcane Legendaries among them, and a deed priced past the ceiling at its own price - so the cap can take value from
no honest player, and a new honest piece past the ceiling fails here before it ships. `tools/mutants/hackedgold.json`
(34, all dead - one first survived: the building's pin used the field's nine trillion, which GOLD-INT now refuses at
the door before the peer's law is asked, so it pinned nothing; it carries a letter the law takes. The two the
honest-price pin answers, alone: an honest price capped, the ceiling halved; a deed capped). PIN MOVED: SS3's, PORTAL1's and AUDIT SS's
source pins and their seven records (`unbound` to `peerHanded` at the sites, re-aimed by content, all dead); WORLD4's,
WORLD8's and AUDIT WORLD4's; WORLD6b-iii(c)'s body count; CORPSE-GOLD's lifted scope; the law version's (INT1, TECH1);
the account version's (acct123, its six records re-aimed, all dead; at the merges past BAL9 and NAME-AS they and the version records of BAL9 and NAME-AS were re-aimed again, all dead). Six more records re-aimed by content, all dead:
INT1's gold under the wire's bound and AUDIT INT's purse and dropped-piece records (the law's new lines), INT14's tool
days (the bodies' branch shared with the gains), TECH1's law version and AUDIT WATCH1's watch body (the new pile count).

## For Mac

- **The budget is the brake on what a forger's own record hands on, and it only measures** (your "Measure 7 days, then
  enforce", 2026-10-09; day 3). GOLD-INT holds the absurd from day one, but a modified client that writes its purse at
  two billion is lawful, and a realm trade carries a billion coins and sixteen letters (two billion each) a trade. Turning
  `enforce` on stops a gain past the bucket at the checkpoint that shows it. `node tools/realmReview.mjs gains 7` names
  who went past it; `budget 7` gives the quantiles to set the line from. Two things to know before you choose:
  - **What was made this week stays.** While the budget measures the bucket keeps no debt (by design - a week's debt
    would have held everyone in it), and a measured gain becomes the baseline enforcement starts from.
  - **A rollback cannot take it back.** `clean` (verdict.js) counts the law and the copies, never the budget, so the
    inflated checkpoint is the clean one, and a rollback is refused past any move the service made since
    (`service-moved`). What staff can do today: `gains` to find them, `hold` to freeze them, `trades <id>` to find
    whom they paid. A measure-aware clean point is a design change of INT6's; asked, not built.
  - **Enforced as built, it holds the honest.** The budget charges the record that shows the gain, and a coin pile
    still rides a peer's word (below): an honest player who takes a forger's coin from a seeded chest is the one past
    the bucket. The session's rule ("I dont wanna mess with honest players") wants the coin on a peer's word charged to
    its giver, or witnessed, before `enforce` is on; asked, not built.
- **Coins on a peer's word - answered: they stay.** A coin pile still rides one (at most 65,535 a pile, 64 a word): it
  is how an honest player takes the coin another player's machine rolled - a body its foe's owner grants, a chest
  another player opened first. Closing it means each player's own roll of that coin (as a shared quest's gold already
  is), which multiplies a party's gold; leaving it, a forger hands out up to ~4.2 million a container word, charged to
  the receiver's budget. The session: "I dont wanna mess with honest players" - an honest party's looting stays as it
  is.
- **Small, found on the way, left open**: a guild hall's decor asks no hold (`decor.js`, a sink to the realm; half of
  what was paid goes to the guild's treasury when the piece is taken out - about 200 gold a piece); a boat's deed or
  parts on a peer's word (a deed handed on is a second boat - AUDIT REALM2 T1 closed the trade alone).
