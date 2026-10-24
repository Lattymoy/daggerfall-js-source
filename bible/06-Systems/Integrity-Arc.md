# THE INTEGRITY ARC: nothing another player can see, take or be ranked against stands on a client's word (INT)

Mac, 2026-10-09, handing on a player's private report (the Discord, Vedgy): "almost all of the game is client
authoritative ... you can download the source code and modify your client to ... disable taking damage, needing spell
points, or using fatigue; do infinite damage in PvE and max damage in PvP; spawn any items you want and as much gold as
you want". Read against the code, then: "I want to do everything and do it properly".

**Status: lane 1 (the economy, INT1-INT6) BUILT and AUDITED (2026-10-09, section 4b: five reviews, every fix pinned) and
merged (#730); lane 2 (PvP refereed everywhere, INT7-INT10) BUILT and AUDITED the same day (section 5, 5b) and merged
(#737); lane 3 (boss fights, INT11-INT15) BUILT and AUDITED 2026-10-10 on its branch (section 6, 6b), measuring first.** **Lane 4
(progression claims, INT16-INT18) BUILT 2026-10-17** (section 7): the seat from day one, the play-hour line measuring
first, the legacy record held to its own law - on FOE-FORGE's pull request (the owner, asked: "Add to #987"; Mac's "A PR per
lane" set aside for it). **INT19 (section 4, lane 1's open item) BUILT 2026-10-17** on the same pull request: a crafted
piece listed, auctioned or filled to a commission leaves its seller's realm record. **FOE-FORGE (section 8) BUILT
2026-10-17**: a peer's foes held to what an honest owner streams.

## 1. What the report found, read against the code

The report is right on its main charge. Three read-only audits of this tree (2026-10-09) found:

| Charge | Where it stood | Evidence |
|---|---|---|
| No damage, free magicka, no fatigue | TRUE in solo, co-op, duels, the wild zone and every boss fight: no server ever holds a player's health, magicka or fatigue. FALSE in the arena, a siege and the Royal Tourney (PVP-REF holds both fighters). | duels and the wild zone resolved on the defender's own machine (`net/wire.js`'s duel frame said "THE DEFENDER RESOLVES IT" until lane 2 retired it, `net/wild/wildFight.js`); a boss "never learns who was struck" (`net/gate/gateStrike.js`, `net/serpent/serpentBrain.js`, `net/superDungeon/sdRemnant.js`) |
| Infinite damage in PvE | EFFECTIVELY: a co-op blow is taken up to 10,000 (a kill). A boss's blows are clipped by a cap and a bucket (`net/gate/gateBrain.js`). A raid's kills are the client's word, one a second. | `scenes/dungeonContext.js` HIT_DMG_MAX; `net/raid/raidLaw.js` |
| Max damage in PvP | PARTLY: the arena's cap reads the weapon the CLIENT names; a duel's or the zone's blow is never refereed at all, and a spell there has no cap. | `net/arena/arenaBrain.js` arenaBlowCap; `net/siege/siegeRef.js` siegeHeld |
| Any item, any gold | TRUE, AND IT REACHED OTHER PLAYERS: a realm character's checkpoint was read at its first save alone (customs' wealth) and stored unopened after; the market, a realm trade, a guild's vault and treasury, a rent and a card table's stake took goods and gold from that record as the truth; the market's listing check never asked whether the piece was one the game mints. | `server-account/src/realm.js` firstSaveRefusal; `06-Systems/Economy-Arc.md`: "Assume infinite wealth" was literally true |

The bible had said so of itself: `11-Multiplayer/Multiplayer.md` "There is no anti-cheat in v1 and no plan for one", and
Realm-Arc section 4's validation (caps, budgets, item ids, quarantine) was planned and unbuilt.

## 2. The principle, and its honest limit

**The world is simulated on the player's machine, and stays so** - `11-Multiplayer/Multiplayer.md`'s first decision
("lockstep is impossible here ... a Durable Object running the simulation would be a second copy of the game in a
Worker") holds. So a kill, a chest's contents and a counter's price stay the client's word. What changes is what that word
can BUY: everything another player can see, take or be ranked against is decided where the client cannot reach it - the
account service judges what a character holds, the relay referees every blow between players, and what the client claims
is bounded by what the service measured itself (time played, signed wins).

The limit, said plainly: a modified client can still invent loot inside the law and inside its budget - pieces that are
lawful, at the rate a very good honest player earns. It cannot carry an impossible piece or a copy that keeps its id to
another player through the service while the judge holds it; and once staff turn the budget on (decision 2), it cannot
gain faster than play allows. Until then the budget only MEASURES: a gain past it is recorded for staff, and holds
nothing. A copy given a fresh id is a new piece to the ledger, and a new piece is the budget's.

## 3. Mac's calls (2026-10-09, asked)

1. **A breach:** "Freeze trading". A checkpoint that breaks the law is stored - the player loses no progress (a finding
   can be the law's mistake; `Accounts-And-Cloud-Saves-Arc.md`'s "THE CLOUD IS A BACKUP" exists because players lost
   games) - and every route that hands the character's value to another player refuses it.
2. **Budgets:** "Measure 7 days, then enforce". The wealth budget ships measuring; staff read the measure and turn it on.
   The item law holds from day one.
3. **Characters already in the realm:** "Items judged, wealth baselined". Impossible pieces hold at the first judgement;
   the wealth a character stands at is its baseline, and an extreme outlier for its level is flagged for staff, not held.
4. **Delivery:** "A PR per lane".

## 4. Lane 1 - the economy (INT1-INT6)

### INT1 - the item law (`src/systems/item/itemLaw.js`)

SOUL-LAW (FIELD BUGS 2026-10-20h, law 9, `acct166`; `01-Overview/bugs/Field-Bugs-2026-10-20h.md`; the Discord's "Soul Trap (Ogre)"):
a Soul Gem or Azura's Star may hold the soul of one of Daggerfall Enemy Expansion's fifty (the Ogre is 282), whose ids
the law reads headless from the mod's own tables (`src/systems/enemyExpansion/dexIds.js`) - law 8 took DFU's MobileTypes
alone, so every such gem was a 'soul' finding and its trapper's trade was held, with a strike. Migration 0143 lifts what
that finding alone laid, read as 0130 reads (0130's own lift, which kept strikes, ends no count), and keeps the soul's
signature, as 0125 kept the key's. TRADE-WHOLE, found on the way: a trade's pack clamps its lot whole
(`src/systems/tradePack.js` wholeLot) - a piece the law refuses is said and kept off the table, never set out on it to ride
no wire.

KEY-LAW (2026-10-17, law 7, `acct151`; `01-Overview/bugs/Field-Bugs-2026-10-17.md`; slick: "flagged by the new key
thing"): the Weir Key's row (`src/systems/eliteGates/weirKeyRow.js`, a leaf) is read beside the registry, as the rest's,
Deep Waters' fish and the two mods' are - this service loads none of the key's home, so law 6 found every Weir Key a
template no honest client mints, and held its owner's trade with a strike, the hour the Elite Breach went live. The
producer sweep's template check now runs the law in a process of its own, as the service's judge loads it. Migration
0125 lifted the holds, timed holds and strikes that finding alone had laid, written as a staff act.

KEY-LIFT (2026-10-17, migration 0130, no Worker; `01-Overview/bugs/Field-Bugs-2026-10-17f.md`; "bruhhhh it was that
keyyyyy", "like 5 other people reporting same thing"): 0125 read every law finding a character ever had, so one already
cleared (0123's Aetheric pieces) or one an older law laid kept the key's week standing. 0130 reads the findings since the
character's last act that zeroed its count (a staff `clear` or `rollback`, a lift's - never 0120's copies' `clear`), and
where the key's stand among fewer than STRIKES_FOR_TIMED others it lifts the timed hold, keeps the strikes the others
could have struck, keeps a hold another carried piece makes, and drops the key's own signature.

MAKER-KEPT (2026-10-16, law 6, `acct148`; `01-Overview/bugs/Field-Bugs-2026-10-16c.md`; Flylighter: "Grandfathered Items
triggering trade lock"): an Aetheric piece of a record the item maker took before AETHERIC-MAKER (MAKER_ERA_AETHERIC -
Ruhn's Regalia and the raiding parties' three sets) keeps the maker's rows, held to the maker's own law; law 5 held every
Aetheric piece to none, so those pieces were findings and their owners' trade held. Migration 0123 lifted the holds,
timed holds and strikes that finding alone had laid, written as a staff act.

One answer to "could an honest client of this port have minted this item?", asked by both ends: the account service of
every item a realm checkpoint holds and every piece a listing, a trade or a vault takes, and the client of every item a
peer hands it (`systems/loot/loot.js` validLootItem, through `setItemLaw` - the law registers itself there, so the loot module
owes the law's graph no import). `itemFindings(item)` answers short codes, empty for a lawful item:

- **identity:** a template the port knows (the classic 288 and every custom row - the homes that register at import are
  imported; the four whose homes pull the UI in give the law their rows from leaves: `systems/createItemRows.js`,
  `restItemRows.js`, `deepWatersFishRows.js`, and Roleplay & Realism: Items' and Foraging's existing leaves), in a group
  it stands in; a weapon's material on the ladder, an armour's one of its three makes;
- **state:** condition never past its most; a stack only of a kind that stacks (gold a count past the wire's bound, a
  quest's gold one stack); a price that is a number;
- **the ladder:** a tier only where a door rolls one; each tier's line count and band (Magic 1-2 lines, Rare 3-4, a proc
  line at most one, a curse's line in its band); no kind repeated; a Legendary's record the piece's own, its signature
  lines its record's and never past them, then one Exalted or one curse line in the top half; Exalted, reforged, honed,
  imprint, socket and curse only where their passes put them; an Aetheric or Gilded piece its record minted whole;
- **the sigil:** a weapon's power in its tier's band over the fight's floor; a set the world's (or the piece's own
  Aetheric record's); never on a common piece, an artifact, a quest's piece or a craft;
- **the enchantments:** rows the catalogue knows; an artifact's power on an artifact alone; DFU's own magic proven by
  DFU's own table (below); on a piece no MAGIC.DEF made, only the rolled flavour, a record's own row and a curse's
  drawback; the item maker's rows within the maker's law (its
  groups, a weapon's effect on a weapon, one of a kind where the kind allows one, no excluded pair, a soul's forced set
  whole beside its soul) and their CATALOGUE cost - never the cost a row says of itself - within the item's power;
- **the rest:** a Broker's price only with its binding, a craft's provenance and quality, a potion's potency, a card the
  catalog prints, one of the eight weapon poisons only on a blade, a soul - a monster's or a person's (the kill door
  traps any foe) - only in a Soul Gem or Azura's Star, an artifact's index and the skeleton key's picture only on an
  artifact, a conjured item only of Create Item's rows, a classic flag only with a classic record.

**DFU's own magic, proven (the audit):** DFU's `MagicItemTemplates.txt` ("a JSON dump of fixed MAGIC.DEF", MIT) is 36
regular magic items of ONE row each and 23 artifacts of fixed sets. The port reads the player's own MAGIC.DEF, which DFU's
fixes may differ from in a row's param - never its kinds or their count - so the law holds `magic: true` to one row of a
kind the regular items carry, and `artifact: true` to its index's record: its template, and its rows' kinds within the
record's (`REGULAR_MAGIC_TYPES`, `ARTIFACT_RECORDS`, held to the file by `test/systems/item/int1_itemlaw.test.js` through
`test/dfuMagicItems.mjs`). Before the audit both flags were legacy shapes the law took whole - ten rows at 127 on any
dagger passed. **A classic save's piece** (ten slots, `None` among them - `classicSave.js`, offline, through customs)
follows the classic item maker's law, which is not this tree's: the law takes it as it stands, and the realm keeps it its
character's - no service route hands it to another player (`piece-legacy`; RESTORE's word for what customs brings, Mac:
"Keep all, can't sell").

**Value is not a finding:** honest prices sit on both sides of any formula (a book's printed price, a shelf potion at
double, a deed at its house). `itemWorth` - what the wealth measure counts - takes the price, never past a generous
ceiling (`worthCeiling`) and never under what the piece IS - its base and its lines' worth (the audit: a forged piece
priced at nothing was worth nothing to the budget).

**Pinned against the producers themselves:** `test/honestItems.mjs` mints through every item home this tree has - 45,774
items from exactly 83 producers at the setting its pin runs (four seeds; more at its full one): every loot table at every
level, the ladder at every source with its last,
curse and socket passes forced, every foe's kit and death, the spoils, 400 of the Broker's days, every Aetheric and Gilded
record, the Reforge's reforge, hone, gem and imprint, every shop at every quality, chargen for every class and race, all
815 recipes at every quality, the item maker driven as its window drives it, and every port item home - and
`test/systems/item/int1_itemlaw.test.js` asserts no finding on any of it, in the save and on the wire. The first sweep found six
places the law disagreed with honest play, each fixed in the law or the schema, never in the producer: a food stage's
textures written `undefined`; the maker's single-setting arm adding a many-instance effect twice; the maker enchanting a
Dwemer Pellet (its window refuses only the Arrow); gold piles past the wire's bound; a quest's gold stack; and
`itemFields.js` validRepairData refusing every honest repair ticket (its shop key is a number) - a wire bug the law found.
The audit found two more the sweep had not produced, each fixed in the law and pinned: a curse the temple LIFTS keeps its
line by design (`lootCurse.js` liftCurse), so a Rare may carry one line past its count and a Legendary one top-half
number past its record without being Exalted or cursed (every lifted Legendary and 405 of 760 lifted Rares were
findings); and a person's soul in a gem. The sweep's MAGIC.DEF is now DFU's own table, never invented records. A piece
the law refuses at the wire's door is left out of its list, never the list with it (`loot.js` validLootList - one
forged piece had made a chest, a body or a shelf unreadable to every peer, "from a newer version of the game").

### INT2 - every checkpoint judged (`server-account/src/judge.js`, `verdict.js`)

`checkpointRealm` opens every checkpoint (never the first alone) and the verdict lands in the batch that moves the row,
so a checkpoint that loses its race writes no verdict either:

- **the character law:** a level the realm reads; a tile claiming the save's own level when it claims one (the tile's
  level is the token's `cl`, which the ladder's health reads); attributes to `MAX_STAT_VALUE`, skills to `SKILL_HARD_CAP`;
- **its gold** written as gold is - the purse, each account and each loan a whole number, never below nothing (the
  audit: `1e999` read as Infinity and threw the save away);
- **every item it HOLDS** (`possessedItemLists`: the pack, the wagon, the bag, the furnisher's and the repairer's lists,
  what it set out or stored in its rooms, a deed's and a rented room's chests, a boat's hold, a companion's pack), each
  finding named with its list and place - never a list the world fills (a shop's shelf, a dungeon's chest, a body: the
  audit found a piece sold online still "held" on the shop's shelf); a piece the law cannot read without throwing is a
  `shape` finding, never a 500;
- **a craft** against the service's own `products` - one the service never minted, minted for another template or
  material, or holding a lower quality than the piece claims, is no craft (a temper raises the row with the piece);
- **the wealth** (`wealthOf`): the purse, the banks less their loans - no further than the Empire lends a character of
  its level (`realmLoanOwedMax`, pinned to `banking.js`; the audit: a forged loan of ten million hid ten million) - the
  deeds, and the worth of what it holds and the piles it laid on the ground (`groundItemLists`: a pile dropped and taken
  up again is no gain); a bound piece and a quest's piece worth nothing.

The answer says the hold (`tradeHeld`) and, when the law holds it, the first piece it found (`tradeHeldWhy`: its code
and template); the client's session keeps it and tells the player as it moves, naming the piece (`systems/realmSaves.js`
onTradeHeld, `systems/item/itemIds.js` tradeHeldNotice) - and a trade refused over its own hold says that notice, the piece
named; a law hold the third strike made TIMED answers `tradeHeldWhy: { code: 'until', t, until }`, said with its end
(AUTO-HOLD, below; RING-HOLD, `01-Overview/bugs/Field-Bugs-2026-10-12.md`, had said it as staff's: it read "something" once the
Ring was gone). It answers `locked` too, the keys of the copies its record shows, which the session names to its player
once (AUTO-HOLD). The cutover (decision 3): the first judgement's baseline is the
record the realm ALREADY HELD for the character, read once from R2 - never the save the first judged checkpoint brings,
which is charged for what it adds like any other (the audit: the first judged save could hold anything, and was the
baseline); a new character's baseline is a newborn's purse, a customs character's its level's allowance. A wealth past
`OUTLIER_ALLOWANCES` of the level's customs allowance is flagged `outlier`. The verdict's reads run before the save's
object lands, so a read that fails leaves nothing in R2.

### INT3 - the hold

`held` on the character's row, with its reason in order - staff's, the law's, the budget's (`verdict.js` holdOf).
Staff's is staff's alone to lift. A copy holds no character (AUTO-HOLD, below): the copied piece is locked, and the
copies' hold - staff's alone to lift - is retired; a row still holding it lifts at its next checkpoint. The law's lifts
at the next clean checkpoint until `STRIKES_FOR_TIMED` (3) HOLDS have come - a strike a hold, never a checkpoint (the
audit: one piece carried six minutes was staff's), the same piece taken up again included - and the third is TIMED: a
week, a month each after it, a clean checkpoint inside it no way out and the first past it lifting it (AUTO-HOLD); every
law hold's notice says the holds are counting (RING-WARN, `01-Overview/bugs/Field-Bugs-2026-10-12.md`); its finding is
written once a signature. Staff who judge the law's word wrong clear it (`law_excused`): the same signature holds
nothing again, a new one does. A verdict writes over the row only as it read it (`judge_rev`): a staff act landing in
between stands, and the next checkpoint judges again.

Every route that hands a realm character's value to another player says so - `prepareRealmRecord(..., { outbound: true
})`: a market listing and purchase, a vault deposit, a treasury deposit, a rent, a card table's stake, a disenchant - and
is refused `trade-held` while held, `record-unjudged` for a record no checkpoint has been judged since INT2 shipped. A
realm trade refuses a side that gives with its own word. The routes that hand on what a character owns AT the service,
its record untouched - a crafted piece listed, auctioned, filled to a commission or disenchanted, its Stores' units
listed, sold into an order, deposited in a guild's Stores or supplied to a guild's writ - ask the same hold (`realm.js`
realmHoldOf; the audit: a held character listed its craft for 900,000 gold), and a crafted piece's the hold of the realm
character that MADE it, whatever character the act names (`realm.js` craftHoldOf, CRAFT-HOLD below). INT19 (below) took
the piece route out of that list: a listing, an auction and a commission's fill take the piece out of the acting realm
record (`prepareRealmRecord`, outbound), so the record's own hold is the one asked, and craftHoldOf stands for a
disenchant by a character with no record alone. A held character with
pieces of its make at the account is not deleted (its row is where the hold lives). A piece listed or
vaulted before the law read listings is read as it is bought or taken, and goes to nobody if the law refuses it.
`test/server/int2_judge.test.js` sweeps the service's source: no `prepareRealmRecord` that takes goods or gold out without
`outbound`, the three sinks aside (a home and its decor bought from the realm, a guild founded); `test/net/int6_review.test.js`
holds the routes over HTTP, each refusal its 409.

### INT4 - the ids and the ledger (`systems/item/itemIds.js`, `server-account/src/ledger.js`)

A valuable piece - a tier the ladder rolls or records, a DFU magic item or artifact, a craft, a letter of credit; never a
stack, a bound piece or a quest's - is given a 16-hex `uid` at the realm checkpoint that first sees it in the character's
own lists (`stampItemIds`, `scenes/world.js` realmCheckpoint). The wire carries it. The ledger's key is a crafted piece's
PROVENANCE (the service minted it; no client mints a fresh one) or the piece's `uid`; beside it the piece's print (its
template and material) - an id on another piece is no claim to it, and the record showing it holds a forged id (a law
finding).

**The first holder keeps it.** The record that shows a key first holds it; another record showing it while the holder
still does CLAIMS it. The holder's checkpoint without it moves it to the claimant (a drop, a chest, a peer's hands - no
witness needed); still with it past `DUPE_GRACE_S` (300 s), the claim was a COPY: the CLAIMANT's copy is written down
and locked (`item_dupes` - that piece moves by no route from it, and is never found twice), and the holder's piece stays
the holder's to sell. It is no strike (AUTO-HOLD): the holder's checkpoint cannot tell a copier from a receiver whose
giver's game died before its record saw the give. A crafted piece's copy is told by its craft's record: the account
`products` names owns it, so a seller that kept a sold piece is the copier, never the buyer. A piece shown twice in one
record is that record's copy at once - one strike on `dupes` a checkpoint, however many pieces, and `dupes` holds
nothing. A piece let go is no row (a row kept `gone` only
while a copy of it is known, so the copy cannot take it up); a character that dies, retires or is deleted lets go of all
it held. The service's own moves move the ledger in the same batch (`ledgerMoves`): a piece listed or vaulted is in
ESCROW, held by no record (one still showing it claims it); a piece the service hands a record is that record's; a piece
spent is no row. A route hands a piece out only as its record's own (`piecesRefusal`: `piece-dupe`, or `piece-claimed`
while a claim waits).

**What the ledger catches, and what it does not:** a copy that keeps its key - a save copied onto another character, a
dupe a bug of the game made, a piece kept after the service took it. A copy a modified client re-keys is a new piece to
the ledger, and a new piece is the budget's (INT5).

**Bounded** (the audit: a statement a key, rewritten every checkpoint, failed every save past ~985 keys for good - D1
runs at most a thousand queries an invocation - and left an object in R2 each time): one read for every row the character
holds or claims, keys it did not hear of there 90 a read; only what changed is written - a piece held still writes
nothing - 48 rows a statement; at most `LEDGER_NEW_MAX` (960) new keys a checkpoint and `LEDGER_KEYS_MAX` (6,000) read.

### INT5 - the wealth budget (`server-account/src/budget.js`)

Between two judgements the wealth may rise by what the service saw move in the open (`witnessed`: every service-made
change to a record - `prepareRealmRecord`, the trade's settle - adds what it moved) and by a bucket (`allowance`) that the
account's played seconds fill at the level band's rate up to its cap (`players.played_s`, measured by the service itself;
the join sets `played_at`, so time on another character fills nothing). A gain no witness explains spends it. A signed win
(a gate's, a raid's, a serpent's, an Abyss Dungeon's receipt, recorded) fills it by `spoilsGrant`. Every hour's unexplained
gain and loss and the seconds played are kept (`realm_wealth_hours`).

The audit's corrections, each pinned (`test/server/int5_budget.test.js`): the first judgement CHARGES what a save adds to its
baseline (INT2); a bucket a win's spoils filled past the cap is spent down, never cut to it; a win's grant reads the
level the realm TRUSTS (`verdict.js` trustedLevel: the save's, never past one more a `LEVEL_RISE_S` (300 s) of play since
it last rose - a level of 1000 in one save made a win worth two million), and lands as a change, so a grant between a
checkpoint's read and its write stands; a crafted or market-bought piece the client's pack mints is WITNESSED once, as
its owner's next checkpoint holds it (`products.credited`); and a change of the measure itself (`WEALTH_VERSION`) is no
gain - the next checkpoint measures the stored record again under the new one. A staff clear refills the bucket.

**MEASURE first:** `BUDGET_DEFAULT.enforce` is false; a gain past the bucket is a `measure` finding, and nothing is held -
and the bucket keeps no debt while it only measures, so the line staff set starts every character even.
`tools/realmReview.mjs budget 7` reads each band's quantiles of gold an hour of play and who the line standing would have
held; `budget-set` writes the line and `enforce: true`. From then a gain past the bucket holds the trade ('budget') until
play pays it back. The first numbers (`BUDGET_DEFAULT`) are a guess the measure exists to replace - **OPEN**, every one.

**HELD-SIDE (FIELD BUGS 2026-10-11g, the Discord's "Cant trade after yesterdays character lockout").** The trade's hold
refusal named "a character in this trade" to both sides, and a player whose partner was held read it as their own. The
service keeps the held side with the word (`realm_trades.why` `trade-held:a`) and tells each side `held` ('mine' or
'theirs', the word itself unchanged for an older client); the client says whose, and mine in the words of my own hold's
notice (`TRADE_HELD_NOTICES`, now in `net/realm/realmTradeLaw.js`, re-exported by `systems/item/itemIds.js`). No road from
shoplifting to a hold was found - the budget is the one measure that sees theft, and it holds only under `enforce`.
The record and staff's check: `01-Overview/bugs/Field-Bugs-2026-10-11g.md` HELD-SIDE.

### INT6 - the review (`server-account/src/review.js`, `tools/realmReview.mjs`)

A developer's alone: `/v1/mod/realm-holds` (the held and flagged, each with its last finding), `realm-findings` (a
character's findings and its wealth by the hour), `realm-clear` (a hold, its strikes and its timed holds lifted, a flag cleared, the law's
finding standing excused, the bucket refilled), `realm-hold` (a hold by hand), `realm-rollback` (the record back to its
last checkpoint judged clean - kept past the row's rotation, and carried forward by a service move made ON a clean record
- its seat taken from any tab so the next join loads it; never past a move the service made since (`service-moved`: a
sold piece would come back and stand sold), never for the dead, its size the clean save's) and `realm-budget` (the
measure - asked of the database a quantile at a time - and the config, kept an isolate a minute). HACKED-GOLD added
`realm-gains` (every character whose unexplained gain went past its bucket in a window, largest first - while the budget
measures nothing is held, so `holds` listed none of them) and `realm-trades` (one character's settled realm trades, whom
it traded with and what each gave - a trade is witnessed on both rows, so no finding names its receiver). Every act is written
among the character's findings with who did it, and moves the row's `judge_rev`. The cron sweeps findings past 90 days
and the hours past 30.

SUMMON-REPAIR (2026-10-15, acct136, migration 0117 - acct133 and 0113 on its branch, renumbered past LAMP-KEEPER II's at the merge, then acct134 and 0114 on the integration, renumbered past main's KG6 and POI-1 (acct134, acct135) and FIRMAMENT-ON's, KG6's and POI-1's 0114-0116 at the merge of main; Mac, asked how to mend the save FIELD BUGS 2026-10-14 SUMMON-OFFER
left stuck: "Operator tool") added two. `realm-characters { name }` lists an account's realm characters by its handle -
the id every act names, the dead said so. `realm-repair { id, ticket, faction, flag, gold, note? }` mends one: one of
FactionFile's flag bits (`formats/factionFile.js` FACTION_FLAGS, moved there from `systems/faction/factionRep.js`, which hands
them on, so the Worker can read them) cleared on one faction of its record, and 0 to 1,000,000 gold given back as the
game's letter of credit (`src/net/repairLaw.js`, the service's and the tool's one law: `repairOf`, `applyRepair`). The
record says whether it can be done - a faction it does not hold is `repair-no-faction`, a bit its faction does not carry
`repair-not-set` (an account holds up to six characters: one aimed at the wrong one mends and gives nothing). It is
done ONCE A TICKET: `realm_repairs` (never swept) holds a row a character and ticket, written in the record's own batch,
so the same repair asked again answers its row (`repeat`) and moves nothing, and two asked at once meet the key and one
rolls back. The record is SEIZED as the rollback and INT9's death take it (`realm.js` seizeRealmRecord): read where it
stands, written one sequence on, its seat taken from any tab - the tab playing it is refused at its next checkpoint, the
copy its device keeps follows a sequence the record has left, and its next join plays the mended record - and the gold
is witnessed (the judge charges no gain the service made) and counted as the service's own faucet, `repair`
(FAUCET_KINDS, beside the patrons'). The act is written among the findings like every other. The tool:

```sh
node tools/realmReview.mjs characters <handle>
node tools/realmReview.mjs repair <realm character id> <ticket> <faction id> <0x40 | 64 | Summoned> <gold> [note]
```

Pinned by `test/net/fb1014_summonrepair.test.js` over the real Worker and the playing tab's own session and join;
`tools/mutants/fb1014_summonrepair.json` (16, dead).

PURSE-BACK (2026-10-19, `01-Overview/bugs/Field-Bugs-2026-10-18b.md`; the owner, of a purse TRADE-WRAP left below
nothing: "Build a workflow") runs `realm-rollback` from the Actions tab: `.github/workflows/realm-rollback.yml` and
`tools/realmRollback.mjs` call `reviewAct` itself - its developer gate asked with the run's actor, its guards, its
statement and its staff finding - over the service's D1 and R2 bindings answered by wrangler with the repository's
Cloudflare token (`tools/lib/wranglerBindings.mjs`), a dry run being the act with its writes held. It asks the rollback
only for a character whose purse went below nothing and whose clean save is older than that finding: a purse set at
nothing since can make a later save clean, and the save from before the sale is then gone (`clean-after`). Pinned by
`test/tooling/realm_rollback.test.js`; `tools/mutants/purseback.json` (19, dead).

PURSE-MEND (FIELD BUGS 2026-10-19f, a player's private report: a purse of -8,000,000 and a carry weight of -19,995 kg
after a sale at 0.0.235) added a third. TRADE-WRAP (FIELD BUGS 2026-10-18b) stopped the counter paying below nothing,
and left a record it had already paid that way to "a staff repair" - which `realm-repair`, a faction's flag and a refund,
could not reach: the purse stayed below nothing, the judge's `gold` finding held the trade, and every payment found the
coins short and spent the letters first. `realm-findings` now says the purse the record holds (`character.purse` - the
wealth counts a purse below nothing as none, so nothing else said it), and `realm-mend { id, ticket, was, gold, note? }`
mends one: the record's purse, still the `was` staff reckoned from (`mend-moved` otherwise: played since, or the wrong
character), and below nothing (`mend-not-negative` otherwise), is SET to nothing - never added to - and `gold`, what the
character is owed, 0 to one int's worth, is given as ONE LETTER OF CREDIT at the front of the pack (0 gives none, and
pays no faucet - AUDIT FB1019f A3): what the trade window
itself pays for a sum the pack cannot carry (`tradeModes.js sellProceeds`), never a purse of coin (a million coins weigh
2,500 kg). The law is `src/net/repairLaw.js` (`purseMendOf`, `applyPurseMend`), the service's and the tool's. The act is
the repair's machinery (`review.js staffMend`, which both run): the dead mended never, once a ticket in `realm_repairs`
(a mend's row names no faction and no bit - 0 and 0 - `was` the purse it found, `gold` the letter; a ticket names one act,
and one of the other kind is `repair-ticket`), the record seized one sequence on with its seat taken, the gold witnessed
and the `repair` faucet's, the act written among the findings. AND THE HOLD THE PURSE MADE GOES WITH IT: when the
character's hold is the law's, the finding it stands on is the purse's alone (`PURSE_SIG`, the signature `lawSigOf`
writes for `gold`) and no timed hold stands, the mend lifts it as the next clean checkpoint would - the hold and its
signature gone, `judge_rev` one on, guarded on the judgement it read (a hold staff lay while the mend is in flight moves
nothing - `seq`, asked again it mends under staff's hold; AUDIT FB1019f A2) - and the strike stands, fading as every strike does
(which strike the purse struck, the row does not say). A hold the purse is not alone in, a timed hold and staff's own stay
for the next checkpoint and for staff. The service's acct163 (with COMPANION-DROP, `11-Multiplayer/Wild-Zone.md` section 8); no
migration: the mend's row is `realm_repairs`' own shape. The tool:

```sh
node tools/realmReview.mjs findings <realm character id>
node tools/realmReview.mjs mend <realm character id> <ticket> <was: the purse below nothing> <gold owed> [note]
```

Pinned by `test/net/fb1019f_pursemend.test.js` over the real Worker, a record the game writes (`save.js snapshotPlayer`)
after the old counter's sale, checkpointed so the judge holds it; `tools/mutants/fb1019f_pursemend.json` (28, dead - AUDIT FB1019f's four among them: the
lift's guard unread and unenforced, a letter and a faucet row of nothing).

STAFF-SET-BANK (2026-10-23, mob: "we need a set bank setting"; asked before how to adjust a player's bank, and nothing
could) added a fourth, the Staff Panel's alone: `/v1/staff/fix/bank { id, ticket, was, gold, note }`, an Admin's, with
Fix account's note (`staffRealm.js`), the review's `bank` act (`review.js bankAct`). Online a character keeps one
account, the Empire's (`banking.js` EMPIRE-ACCOUNT), and the panel's profile says the bank as one number, every
account's gold together (`staffPlayers.js` `banks`, read by `repairLaw.js bankTotalOf`, the sum the set is checked
against). The record's bank, still that total (`bank-moved` otherwise), becomes the Empire's account holding `gold` (0 to
one int's worth), every other branch folded in at nothing as `foldEmpireAccounts` folds them, every loan where it stands;
a record that keeps no Empire account is refused (`bank-none`: the game mints the table as a character loads, so its
next checkpoint carries one). The repair's machinery again: once a ticket in `realm_repairs` (a bank set's row names
faction -1, `BANK_SET_FACTION`, below every faction a repair or a mend names - no migration), the record seized one
sequence on, the wealth it moved witnessed - up or down, so the budget charges no gain the service made and a set down
hides none after it - the act written among the findings, and what it raised the bank by the `repair` faucet's (a bank
below nothing counted none). A set down pays no faucet and writes no sink: the service keeps none for staff's removals,
so the finding and the panel's audit row are its record. No hold is lifted. The service's acct177. Pinned by
`test/server/staffsetbank.test.js` over the real Worker, the game's own bank table and the panel's own profile read;
`tools/mutants/staff-set-bank.json` (31, dead).

STAFF-GIVE (2026-10-24, mob: "add yes we will work on add as well", the card's pick "Pick from the item list", "include
enchants") is Remove from a player's twin, an Admin's: `/v1/staff/item/catalogue` (the game's item list - each template
with its groups and whether it stacks, a weapon's and an armour's materials, the item maker's enchantments with their
settings and costs) and `/v1/staff/item/give { id, template, group?, material?, count?, gold?, enchant?, seq, confirm,
reason, note }` (`server-account/src/staffGive.js`). The panel never writes the piece: the service mints it with the
producers the game mints it with (`enemyEquipment.js` weaponOfMaterial and armorOfMaterial, CreateWeapon's arrow arm,
`itemTemplates.js` setItemFields and mintCondition; a letter of credit's `gold` its value), lays the enchantments as the
item maker lays them (`enchantmentCatalogue.js` pickEnchantment, a bound soul's forced rows with it, then
`enchanting.js` applyEnchantments), and asks the item law before anything moves: a gift the law would find - powers past
what the item holds - is shown with its findings and refused (`staff-item-unlawful`), so a gift never holds the trade of
the player it was given to. Given, it is Put back's write: the record seized one sequence on with the piece in the pack,
its worth witnessed, a valuable piece's ledger id minted and entered as the record's own, the act among the findings
(`give`, the piece with it). Remove takes it off again. Pinned by `test/server/staffpanel3realm.test.js` over the real
Worker, the player's next checkpoint carrying the gift unheld; `tools/mutants/staff-give.json` (10, dead).

### AUTO-HOLD - no hold waits on a person (2026-10-16, `server-account/src/verdict.js`, `ledger.js`, migration 0120)

Players on Discord, frozen "until staff have looked" because "copies of an item were found", none of them meaning to
copy; Mac: "We need to figure out a better system for trade banning. I dont want to have to manually review". Read
against the code, two paths made copies no player chose, and the hold made every one of them staff's:

- **The shop's shelf** (`world/interior/interiorShared.js` applyInteriorLoot). A building's containers are the room's, the last
  writer's word wins, and a shelf's word carries each piece's `uid`. A word from before the reader took a piece -
  another player's close of a window opened earlier, the room's memory of an earlier visit - put it back, the reader
  took it again, and the pack held one piece twice: a copy at the next checkpoint. Stealing from a vendor and selling
  the piece back met it most. Now a word never lands a piece the reader carries, nor one piece twice: its own lists'
  ledger keys and the rule that keys a piece (`systems/item/itemIds.js` carriedPieces; the rule, `ledgerKeyOf`, moved there
  from the judge, which hands it on) are handed by the host to the shelf's module, which never imports the item law -
  its registration on `systems/loot/loot.js` changes what every reader of the wire lands. A shop's shelf also never lands a
  piece the reader STOWED (AUDIT AUTO-HOLD, below). A dungeon's word - a search's find, a pile - is filtered the same
  (`scenes/dungeonContext.js` applyLoot, the reader's own lists). STILL OPEN: a second player whose window was open on
  the stale shelf can still buy or steal the piece the first already took; that buyer's copy is the contested claim
  below - locked, no strike. The scene cache's own restore of a building's containers is not filtered: it restores the
  reader's own chests as well, and a stowed piece's key must land there.
- **A giver's game killed after a chest's hand-off.** The giver's record had not seen the give (a checkpoint every 120
  s), it rejoined with the piece, and its next checkpoint past the grace proved the RECEIVER the copier - three of those
  and the receiver's trade was staff's. Reproduced over the real Worker in the session (a scratch test, not kept). The
  realm trade window is not this path: the service settles both records at once.
- **The hold itself:** `dupes` counted pieces, not incidents (one copied save of three pieces held the character at
  once), never fell, staff alone lifted it, and the player was never told which piece.

Mac's calls (asked, 2026-10-16): **a copy locks the piece only** - the character is never held for one (the cost, said
and taken: a modified client can still sell a locked copy to a shop for gold, which the budget measures and does not
hold; an honest client cannot - AUDIT AUTO-HOLD, below); **a contested claim locks the receiver's copy and is no
strike** (the first holder keeps it, so a forged claim takes no victim's piece, and a deliberate copy gains nothing) -
a holder's checkpoint outlasting a claim, and a patron buying a listed piece another record claims, alike; **the law's
third hold is timed** - a week, a month each after it, no strike counted inside one, the strikes and the timed holds
served forgotten a month after the last finding that held or the last timed hold's end (`verdict.js` lawCountOf;
`held_until`, `law_holds`, `law_at` on the row); **every copies' hold standing is lifted** - migration 0120, each
written among the character's findings as a staff act `by: 'auto-hold'`.

What the player hears: a checkpoint answers `locked`, the keys of the copies its record shows (`LOCKED_SAID_MAX`, 200,
`net/realm/realmTradeLaw.js` - the one number the service and the session read), `[]` for none - every answer, so a session
hearing no `locked` at all (an older Worker, a deploy's window) keeps the set it has; the session hands the whole set on as each
answer lands and tells each piece once ON THIS DEVICE (`systems/realmSaves.js`, `dagger.realm.locked.<id>`), and the
notice names every locked piece in the character's own lists and counts the rest (`scenes/realmHoldHost.js`, wired at
bootWorld's one line that wired the hold's notice), in the player's language: "The realm has locked your ...: it found
the same piece somewhere else too. It stays with you and cannot be traded, sold, dropped or stored where
others can take it. Your other pieces and your trading are not affected." A timed hold answers `tradeHeldWhy: { code:
'until', t, until }` and is said with its end, written the game's language's way - and, while the law still finds a
piece, that the hold stands past its end until the piece is gone; a timed hold run out with the piece still carried is
said again as the law's hold, the piece named. A route's refusal over a hold no longer promises a review.

The client's laws for a locked piece (AUDIT AUTO-HOLD): it is BOUND while it is (`systems/item/itemBound.js` isBound -
setRealmLocked from the session's set): it stays in the pack, the wagon and the player's own storage, and goes over no
counter, onto no ground, into no room's container and through no salvage, its refusals and its card's line in its own
words; a peer's word never lands one on its reader, nor any piece its reader carries (AUDIT AUTO-HOLD: a second of
one is a copy, the reader's own locked with it - `systems/peerWord.js` notCarried, the rule the session's wiring
registers: a body's grant, a room's give, a body restored off the wire). `dupes` stays, counting incidents, for staff to read; it holds
nothing. Staff's acts stand as overrides: `realm-clear` lifts a timed hold and forgets its count (the rollback too),
`realm-hold` holds by hand; `realm-holds` and `realm-findings` show a timed hold's end and the holds served.
`ACCOUNT_VERSION` acct141 (acct139 on its branch, renumbered past main's PRIMARY-TRIPS and AUDIT GUILD-WORDS at the
merge). Pinned by `test/server/autohold.test.js` (16) over the real Worker, the real session, a scripted service and the
migration's own statements; `tools/mutants/autohold.json` (73, all dead). The records it moved re-aimed by content, each
saying so, and two retired with the law they held (`INT4-dupes-never-hold`, `INTA-law-over-copies`: a copies' hold, and
its order beside the law's).

**AUDIT AUTO-HOLD (2026-10-16, Mac: "Audit this. Ensure perfection").** Five reviews ran - the service's correctness and
races, a modified client's ways round it, the honest player and the client, the process and its records, and the
shelf's fix - each finding reproduced over the real code before it counted. What they found, and what changed:

- **The migration's order and its strikes.** A law hold at three strikes that copies charged after had become 'dupe';
  lifted first, it slipped past the conversion, and its next checkpoint held it a week from THEN with no finding saying
  so - the conversion now runs first over both, written with the hold it was. The old law's strikes never fell, and a
  row with one or two came out with no `law_at`: a strike from before stood for good. Every strike standing now fades
  from its last law finding (or from the migration, where the findings were swept).
- **A hold no checkpoint can lift.** Only a checkpoint lifts a timed hold, and the dead are refused one: a maker that
  died inside its week held every craft of its make for good. `realm.js` holdStandsSql - a dead character's law hold
  whose time is out, its last judgement finding nothing that holds, stands no more - is what `craftHoldOf` and the
  patrons' seller check ask.
- **A strike inside a timed hold.** A piece dropped and taken up three times inside the week was a month's hold; no new
  hold comes inside one, so no strike is counted there.
- **The patron's claimant struck.** A patron buying a listed piece another record claimed charged that claimant a
  strike, where a player's purchase of the same piece did not - a receiver whose giver listed a piece its record had
  not seen given is that claimant. Contested now, as the other.
- **The third hold's notice, false.** It said "then opens on its own" with the Ring still carried, and named nothing;
  the week out with the piece still there, the hold stood on and nobody was told. It names the piece and says the hold
  stands until the piece is gone; the run-out is said as the law's hold. The strikes' warning says the same. A route's
  refusal said "until the review ends".
- **Locks spread through the shop.** No client stopped a locked copy being sold to a shop or left in a chest, and the
  next to take it held a second of a piece another holds - locked on them in turn, an honest buyer's purchase with it.
  A locked piece is bound while it is (above).
- **The notice accused, and repeated.** "A copy of your ... was found" read as an accusation - to a receiver, to a
  player taking a craft back from its own remains (INT9 locks that one by design, `wild.js`) - and was said at every
  join; a key the pack shows twice was "that piece". It says what happened, once a device, every piece.
- **The shelf's reach.** It kept off the pieces in the reader's own five lists, never one stowed in a ship's hold or a
  room's chest - the same copy, the same lock. A shop's shelf now reads the stowed off the last save the realm took
  (`systems/item/possessedItems.js` possessedItemLists, moved from the judge so the client reads it as the judge does) - a
  shelf alone: a room's chest may BE the stowage. A dungeon's search find raced the same and was unfiltered.
- **The records.** Five current-state sentences that still told the retired law, a Progress entry that listed pins
  wrongly, re-aimed mutant records that named the old law, and pins that a one-character mutant of their law survived
  (the owner's numbers by value, the migration's `strikes >= 3`, the date's unit, a key counted once, an end that moved,
  the staff reads' fields, the rollback through its route).
- **A key held twice, handed on.** Every route and the realm trade asked only of a key GONE from the record: one of two
  handed on left the key still there, nothing was asked, and the receiver's row took it unlocked - the copies' hold
  had capped that, and AUTO-HOLD lifted it. A key whose count falls is leaving now, and one the record held more than
  once is a copy, never handed on, whatever the ledger has written down yet (`ledger.js` leavingKeys, read by
  `realm.js` prepareRealmRecord and `realmTrade.js`).
- **Pieces planted on a reader.** A peer's body grant of a key it read on the wire, a room's give, a body restored off
  the wire each handed the reader a second of a piece it carries - a copy, and the reader's own locked with it. A
  peer's word never hands its reader a piece it carries (above).
- **A planted key, struck.** A key minted for another piece holds while it is carried (INT4: it is no claim) - and
  struck: three planted were a week's hold for whoever took them up, as a contested claim would have been, and the
  hold named nothing. It names the piece it is on now and is no strike; a finding of the save's own beside it strikes as
  ever.
- **The locked list's edges.** Forty named at most left a record's forty-first copy free on the client (the service
  refused it still); two hundred now. An answer naming none left the field out, so an older Worker's answer in a
  deploy's window unbound every locked piece: every answer names them now, and a session hearing nothing keeps its set.

Not changed, and why: a deploy runs the migration a moment before the new Worker serves, and an old Worker's
checkpoint in that window can lift a migrated hold early - the new one's first checkpoint holds it again from
`held_until`; a locked copy is locked for good (no route clears `item_dupes` - the owner's call is the piece, not a
term); the dungeon's legacy piles and bodies were not re-traced past the find; a claim costs its maker nothing now (a contested
claim is no strike - the owner's call), so a player who reads a piece's key off the wire and shows the same piece with
it stops that piece moving for the grace (`DUPE_GRACE_S`, five minutes) each time, and takes nothing - its own copy
locked.

### 4b. The audit (2026-10-09, Mac: "Lets do a comprehensive audit on this")

Five reviews ran on lane 1 as first built: the service's correctness and races, a modified client's ways round it, the
false findings against honest players, Cloudflare's limits, and the tests and the docs. What they found, and where each
fix is told above: the ledger's statements unbounded and its charge on the wrong record, a victim's id a way to freeze
them (INT4); a forged loan and the first judged save as two ways past the budget, a grant clamped away, the measure's debt,
a claimed level paying spoils (INT5, INT2); a copies' hold stepped down by a breach (that hold since retired, AUTO-HOLD), strikes counted by the
checkpoint, staff's hold written over (INT3); a rollback past a sale (INT6); the market's crafted pieces and Stores past the hold, and
old stock (INT3); DFU's magic and classic pieces unproven, a worth of nothing (INT1); the lifted curse and a person's soul
found, the wire dropping whole lists, the shop's shelf judged, the budget charging a house's own pieces, a street's
piles, a rented room's chest, a craft and a market purchase (INT1, INT2, INT5); the item law's graph carrying a module
that makes URLs from `import.meta.url` as it loads into the Worker (`comeSailAwayModels.js`, through the boats' items - a
start the deploy would refuse: the hull table moved to `systems/comeSailAway/comeSailAwayHulls.js`, a leaf, and
`test/server/accountdeploy.test.js` bundles the Worker with `import.meta.url` undefined and loads it); an O(n^2) walk on every
route's ids. Mutant records `tools/mutants/int_audit.json`; the arc's own records re-aimed.

### INT19 - a crafted piece handed on leaves its seller's record (2026-10-17, `server-account/src/craftedPiece.js`, migration 0128)

Lane 1's open item (below, as it was written), built to its plan on lane 4's pull request (the owner: "Take care of the
integrity arc"). The piece route decided on the `products` row alone and the client took the piece out of its pack only
locally, so a tab that had lost its seat to a second device listed a piece the live record still held. Now each crafted
act - a listing (`market.js` marketList `kind: 'piece'`), an auction (marketAuction) and a commission's fill (`writs.js`
fulfilCommission) - asks where the record stands before any other word (`realmActFirst`; a character with no realm
record lists, auctions and fills nothing: `realm-needed`), takes the piece out of it by its provenance in the act's own
batch (`craftedPiece.js` takeCraftedPiece: loose in the pack, never worn or bound, as the trade's own law moves it, or
among the home's furnishings; `prepareRealmRecord(..., { outbound: true })`, GUARDED by `mustChange` after the
decision), and the listing's wear is the record's, never the tab's word. The words a piece another act holds is given
(listed, on the road, standing in a home) are asked before the record moves, so they stay the ones AUDIT 31 H1 drops a
save's copy on.

- **Listed or auctioned, the market holds the piece's record** (`piece_escrow`, one row a provenance) and the ledger
  holds it the market's (`escrow: true`, INT4). **Cancelled, expired, unsold or removed**, it comes back as that very
  record - an `item` delivery its seller's record collects (`collectGood`), never minted at the pack (`pieceBackSteps`;
  a cancel answers the delivery, no `piece`). A piece on its way back names no provenance of its own, so every "a
  delivery of it waits" guard asks `pieceComingBack` too (the seller's deliveries alone). A piece listed before INT19
  holds no row and comes back as it always did.
- **Sold or won**, the buyer's piece is the craft's record's, minted at the pack as ever; the market's record of it and
  the ledger's escrow row go with the sale (`pieceSoldSteps` - a piece the service hands out is no row, and a copy that
  claims it is settled by the craft's record, as every crafted claim is).
- **Filled to a commission**, it leaves the crafter's record handed on (no escrow - the fill is the sale), whole by the
  record's own word (`commission-worn`).
- **The client** hands the piece on through the realm act (`net/marketBook.js` realmPieceAct, `postGood`'s shape): the
  save checkpointed and held, the piece out of the pack only inside the hold as the service is first asked, put back on
  a refusal (never on one that says it is elsewhere), nothing kept on silence - the record is the truth, and a join reads
  it. The writs' book is handed the market book's realm act (`scenes/world.js`, on its existing line). The lists and
  fills a tab from before INT19 kept are still asked again by the settles with their own ids.
- **CRAFT-HOLD's cost retired**: the acting record proves the piece its own, so a piece back with its account in another
  character's record lists while its maker is held; craftHoldOf stands for a disenchant with no record alone.
- **Left open:** a piece listed from the home's furnishings comes back into the pack (collectGood gives every record
  back to the pack), and the decision guards the early words now answer first (its owner aside, which a staged pin
  holds) are recorded equivalent in their mutant files - nothing can change them between the word and the decision
  without moving the record, whose own step then fails the act whole.

`test/server/int19_crafted_record.test.js` (8); `tools/mutants/int19.json`; the crafted-piece pins across the market's and
the writs' files moved (PIN MOVED: sellers seated, the piece in the record first - `test/realmSeat.mjs` holdPieces - and
the pins' own call naming the record for a crafted act, `test/accountDb.mjs`, as the client's realm act does).

### What lane 1 leaves open

- ~~**A crafted piece lists, auctions and fills a commission without its record (the exploit audit, 2026-10-11 - OPEN,
  its plan below).**~~ **CLOSED by INT19 (above, 2026-10-17), to this plan.** The piece route (`server-account/src/market.js` marketList `kind: 'piece'`, marketAuction,
  `writs.js` fulfilCommission) decides on the `products` row alone - never the seller's lease, its record or the ledger -
  and the client takes the piece out of its pack only locally (`net/marketBook.js` postPiece). So a tab that lost its
  seat to a second device (it sends no checkpoint, so it never hears `lease`) lists a piece the live record still holds:
  the gold is collected (witnessed, so no budget gain) and the piece sold to a shop inside `DUPE_GRACE_S` leaves nobody
  charged; kept past it, the copy is locked and nothing held (AUTO-HOLD: no copy holds a character). A piece realm-traded away moves the
  piece but never `products.owner`, so its maker can still list it, and the honest holder is the one the ledger
  charges. THE PLAN, the shape `alchemy.js` disenchantPiece already has ("the maker's record says where the piece is,
  never the products row"): each crafted act asks `realmActFirst`, takes the piece out of the record by provenance
  (`prepareRealmRecord(..., { outbound: true, escrow: true })`, `mustChange` in the decision's batch), and the client
  routes it through `realmGoldAct` as `postGood` does; a cancelled, expired or unsold piece comes back as an `item`
  delivery collected into the record (`collectGood`), never a client mint. CRAFT-HOLD (Progress) shipped the half that
  needed no client - and carries a cost this plan retires: `products.char_id` stays the maker's for the piece's life, so
  a piece that comes back to the account (bought back through another player) is held while its maker is.
- Peer channels - a shared chest, a shop's shelf, a body's grant - still move lawful pieces between clients
  unwitnessed (the wild zone's remains are the account service's own records since INT9, section 5). What enters a realm character's record that way is charged to its budget, and the ledger
  catches a copy that keeps its key; a lawless piece no honest client takes (the wire's door drops it). Container locks
  (Realm-Arc phase 2) stand as planned. HACKED-GOLD (Progress) narrowed it: a letter of credit never rides a peer's word,
  a peer's price is held under the law's ceiling and a worn offer lands what can be worn - a COIN PILE still does (65,535
  a pile, 64 a word: a forger's up to ~4.2 million a word, the receiver's budget's), as it is how an honest player takes
  the coin another machine rolled. Asked whether to close it (each player's own roll of that coin), the session: "I
  dont wanna mess with honest players" - it stays. So `enforce`, as built, would hold an honest player who took a
  forger's coin: the coin on a peer's word wants charging to its giver, or a witness, first
  (`01-Overview/bugs/Field-Bugs-2026-10-12f.md`, For Mac).
- **Customs** brings an offline character's items in whole (RESTORE, "Keep all"); its first judgement charges what they
  add past its level's allowance to the budget, which holds nothing until staff turn it on.
- A piece's id rides only the character's own five lists' stamping: a piece set out in a room or kept in a chest since
  before INT4 carries none until it comes back to the pack, and the ledger does not follow it there.
- A temper's or a Reforge's rise in a piece's worth is charged to the budget (small; the service knows the step, not
  the worth).
- The online power rules (Realm-Arc section 5: the item maker's 25% side-effect cap, one Extra Spell Points per item, the
  rest) are balance, not integrity: the law takes what the live maker makes, and moves when those rules ship.

## 5. Lane 2 - PvP refereed everywhere (INT7-INT10)

**Built 2026-10-09** (Mac: "I want to do everything and do it properly"). One law under every fight between players,
PVP-REF's (`net/siege/siegeRef.js`, the sieges' since 2026-10-01): the relay holds both fighters' VITALITY - the Royal
Tourney's, 300 + 2 x the Renown the token signs, never the save's health, which stays the foes' alone - and judges every
blow from the weapon the striker's look holds, clipped to the arms its token signs, every cast to one cast's most and a
rate, every reach from the places it believes at a run it allows. What a fight decides - a duel's winner, a fall in the
open zone and the drop it costs - is a receipt the relay signs and the account service settles. The defender's machine
resolves nothing any more, anywhere.

### INT7 - the arms and the level signed (`net/siege/siegeRef.js` armsOf, `server-account/src/judge.js`, `identityToken.js` `wa`)

Each checkpoint's verdict reads, off the judged pack, the most REACH any lawful weapon there has (`armsTop`: a weapon's
top damage and its material's modifier, at most `ARMS_TOP_MAX` 32, a Daedric Thunderlock's) and whether a lawful bow is
among them; migration 0104 keeps them on the row (`arms_top`, `arms_bow`), and the identity mint signs them as `wa` beside
`rc` 1. The level the token signs (`cl`) is the judge's (`level_seen`; the tile's word only before a judged checkpoint).
The relay stamps `wa` on the socket at the hello, and every referee - a siege's, a Royal Tourney's, the arena's
(`arenaBlowCap`), a duel's and the zone's - clips a weapon's blow to the signed reach and takes a shaft only from a
signed bow; a fist is every fighter's own. A token with no `wa` (a character not judged since INT7) is clipped to the
look's weapon alone, the law before it.

### INT8 - the duel refereed (`net/duel/duelRef.js`, `net/duel/duelReceipt.js`)

A duel is the Royal Tourney's ring without its title. The relay that routes it notes the ask and the yes as they pass
and sets a bout only on a start it saw asked and answered, both fighters whole; every strike and spell is judged
(`refereeBlow`, `refereeCast`) and routed to nobody; out of the ring `DUEL_REF.outMs` a fighter has left, gone
`ROYAL_RING.goneMs` it has walked over, its own end once the count has run is its loss, and the clock is a draw. The
referee speaks in its own frame (`dref`: bout, hp, end, no), and a bout won names its winner in a `d1` receipt handed to
both, which `/v1/duel/claim` counts once by its bout's id (`duel_results.rk`) inside DUEL1's bounds. DUEL1's loser's
own report retires (`/v1/duel/loss` answers 410 `retired`), its gap and its mutual draw with it, and a duel never
touches the save's health (no heal at its end). The client duels on a refereeing relay alone (world185); the referee's
word is heard on any socket the client holds, and a bout's frames go to the room that referees it (5b).
**THE FOUR HOSTS.** `scenes/world.js` WIRED (the challenge, the bout's frames, the referee's word and readout, the
receipt's carrier); `scenes/dungeonContext.js` and `scenes/worldModes.js` NO DUEL on purpose - a duel is outdoors alone
(`world.js:"if ((modes?.mode ?? 'exterior') !== 'exterior') return 'outdoors';"`), every door refuses a duellist;
`scenes/exterior.js`, the offline fixed city, NOT WIRED on purpose: no relay, no other player.

### INT9 - the open zone refereed, a death's drop taken off the record (`net/wild/wildRef.js`, `net/wild/wildReceipt.js`, `server-account/src/wild.js`)

- **Who fights.** The relay cannot see the map (the zone is the POLITIC map's region 16, cut by
  `systems/wild/wildZone.js` from the files every client holds), so a socket's zone is its own word: `zone` 1 where it stands
  in it, alive and where it fights, 0 elsewhere - said on its OWN CELL'S socket alone (a halo's is none), again at its
  welcome, at each crossing (the cell left hears 0, the one crossed into 1) and every `WILD_ZONE_KEEP_MS` while it stands
  (`net/online.js`). A fighter is a realm character in play: a token with no `ci` makes none, and the identity mint signs
  `rc` and `ci` only for a character whose lease is held (`server-account/src/realm.js` realmCharacterHeld - a tab
  playing one character named a poor other, and its deaths dropped the other's record). A blow lands only where BOTH
  fighters said so, never on kin: a party member, one under the party's truce (the hub keeps the party a record left,
  `partyWas`, for `WILD_REF.truceMs`, the client's `WILD_PARTY_TRUCE_MS`), the fighter's own duel opponent, or - MAC'S
  DECISION (2026-10-14, "Guildmates are friends") - a member of its guild, read off the two sockets' verified guilds - and
  a hub that does not answer is kin, for `WDUN_KIN_SILENT_MS` (the room asks again then). Kin is one law, the referee's
  and every client door's (`wildRef.js:"export function wildKin"`); the guild was the client's alone, and a guildmate the
  maps and nameplates counted a friend could kill. A socket's close takes its fighter out
  of the zone (`wildGone`).
- **The fight.** The Royal Tourney's vitality; every blow and cast the referee's; `wref hp` to both, `wref fell` to the
  room. NO FREE BAR: a fighter is whole again only unstruck `WILD_REF.mendMs` AND in the zone as long (its vitality alone -
  INT10), or away from the zone `WILD_REF.riseMs`; a word off and on keeps its bar. A fighter's bar is kept at the hub
  after each blow (`WILD_INTERNAL_VIT`, `wildCarry`) and taken by the next room it stands in (a step into another cell
  was a fresh bar); a fallen carried is down there too. A pose past any run is believed, and its fighter strikes nothing
  for `WILD_REF.jumpMs` (a jump was never believed, and a gallop left the place stale for good). A fallen rises whole on
  its word that it stands in the zone once `WILD_REF.riseMs` has gone by - the death screen's own wait (it rose on its
  next word, where it fell).
- **The fall.** The striker is its killer, and the referee's fall is a death on the fallen's machine whatever that says
  (`characters/playerEntity.js` forcePlayerDeath - the SetHealth(0) door's AvoidDeath and withholding stood a fallen up).
  The fallen's game shows its killer its worn gear (`worn`, under the fall's id, each record minted alone so its place
  holds); the killer's body window picks ONE (`pick`, to the room that refereed the fall, with what the offer showed
  there - `t`, `m`) within `WILD_REF.pickMs`, and the relay signs the fall - `f1` `{ f, c, k, r, w, wt, m, kc }`, the
  fallen, its realm character, the killer, the remains' id, the piece's place and what it was (and SEA-BOUNTY's, 2026-10-22:
  the room that refereed it and the killer's realm character - `03-World/Eltheric-Ocean.md` SEA-BOUNTY; an older relay's
  receipt names neither; a SHIP wrecked at another captain's guns is signed apart, `n1` - SHIP-PVP) - and hands it to
  both; one away
  hears it at its next zone word. Unpicked, it is signed without a piece; a building's or a dungeon's fall at once (no
  body is searched there); a fall waiting on its pick is kept in the room's storage (`WILD_FALL_PREFIX`) and signed by a
  room that restarted, and a full room's oldest is signed, never forgotten.
- **The drop.** `/v1/wild/fall` takes it off the fallen's JUDGED record by ONE law (`systems/wild/wildDropLaw.js`
  takeWildDeath): the killer's worn piece first (`wildPickOf` - the piece the offer showed, else none), then half the
  purse and the cart's coin, then the bag's and the cart's drop BY WORTH (a bag of junk ahead of them kept the gold and
  the valuables), fitted to one remains, every record within `WILD_RECORD_BYTES_MAX`, the rest put back where it came
  from; the record's lit light follows its piece. CART-AWAY (FIELD BUGS 2026-10-15d; Mac, 2026-10-15: "if its parked
  outside the zone nothing should be lost" - `11-Multiplayer/Wild-Zone.md` section 4): the cart's coin and its drop only
  while the wagon is with the fallen. The zone's mask is the client's, so the fallen's own tab says its wagon is away
  (`cart` 0 - `systems/wild/wildCart.js` wildCartAway), and the service takes the word only where the record it keeps says
  the wagon is parked, stabled or none by its mode (`wildDropLaw.js:"export function wildCartMayBeAway"`) - never a
  record that drives it, leads it or stands it beside them; a seizure takes no word, and a tab that says none drops the
  cart as before. The service answers what it took as the game finds it again (`took`,
  `gold` - wildTookOf), and the fallen's game takes out EXACTLY that (`wildTakeTook` - it ran the law again without the
  ledger's word, and took what the service kept). The fallen's own act at its tab's `at` (`realmGoldAct`, its answer
  needed: checkpointed as it will rise, the service asked, the room named), or its killer's SEIZURE once
  `WILD_FALL_GRACE_S` (30 s) has gone by (the record moved where it stands, its lease cleared, a dead record never), laid
  where the body fell and asked again on a word that says nothing. Once a fall (`wild_falls`, by the remains' id): a
  second asking is answered the first's records and THE SAME ORDER, issued at its first minting for its first room (`oi`,
  `wm`) and good its minute alone - and, for the fallen's own tab, where its record stands. A death to a foe has no
  receipt: the fallen's own act on its tab's nonce, its remains' id a digest of the character and the nonce.
  THE TWO-PHASE HANDOFF (MAC'S DECISION, 2026-10-14, "Yes, build it"): the fallen loses the killer's piece only once the
  killer has it. Where the tab says its room signs collects (`collect` 1), the piece leaves the record INTO ESCROW
  (`wild_escrow`, in the fall's own batch - its ledger key the service's, `ledger.js` ledgerMoves `escrow`), never a fresh
  id, its order saying so (`we`); it ends once, in one batch with the record it lands in, the escrow's row moved from
  `held` and guarded to one (`server-account/src/wild.js` endEscrow): into the killer's record on the room's signed
  collect (`/v1/wild/collect`), or back into the fallen's on its own tab's ask once a collect could no longer be signed
  and one signed at its last moment is spent (`/v1/wild/reclaim`, escrowBackAt) - two windows that never meet. An end
  asked twice is the first's answer, a batch that failed read for whether it landed (dropIfUnnamed, recordMovedOf); the
  piece is in one record or the escrow, never two, never none, whichever host restarts. Before it, the service took the
  piece off the record at the fall and the remains held it: a killer who never took it (gone before it was laid, refused -
  PVP-LOOT) left it to nobody.
- **The ledger.** Every piece the death could take is asked of the ledger before any is taken (`wildDropCandidates` -
  it asked of a dry run's fitted few); a piece it bars stays (`kept`). Each valuable piece dropped lies in the remains
  under a FRESH id, and the id it had is written down as the fallen's own copy (`ledger.js` knownCopySteps): a game that
  kept the piece holds a copy that moves by no route, where before it held the piece again and whoever took it up was
  charged for a copy. A crafted piece keeps its craft's key, written down the same. The save two back is dropped, as every
  act drops it.
- **The room.** The service signs what it took for the room - a `remains` order (`wr`, the records' digest `wh` and
  count `wn`, the room `wm`, `wk`/`wi`: the killer's piece, theirs alone, `wg`: the fallen's guild) - and the relay keeps
  a deposit only in the room the order names, its records digesting to it. A piece the order says is in escrow (`we`)
  the room never hands as a record: its killer's take is answered a signed COLLECT (`wildReceipt.js:"export async function mintWildCollect"`,
  `g1` - the remains, the killer, its realm character), signed once and kept with the remains through a restart (`wc`),
  the same collect said to every asking (`wildLaw.js:"export function collectAsk"`). An emptied remains is a TOMBSTONE while it
  lives: kept, said to nobody, never laid again (it was let go, and its order laid the same records twice), never let go
  for a newcomer younger than `WILD_TOMB_MIN_MS`. A second carrier's chunks are nothing, quietly - unless the first has
  stalled `WILD_STALL_MS`, when the second lays it afresh. The remains' guild is the order's (the killer carrying it wrote
  its own). The deposit goes in chunks bounded by the wire's frame. The killer's game asks for its piece the moment the
  room says the remains, and again until the ask leaves. The cron sweeps the falls after `WILD_FALLS_KEEP_S`.
  PVP-LOOT (FIELD BUGS 2026-10-14, `01-Overview/bugs/Field-Bugs-2026-10-14.md`): the room's friend law (PVPDUNGEONS, a
  fallen's party and guild take nothing of its remains) is the DROP's - the record the order names is its killer's
  whoever the fallen's guild or party counts them (`wildLaw.js:"export const remainsNamedFor"`), and a collect is never
  asked it. Read over that record too, it refused a guildmate's kill the piece the service had already taken off the
  record. Guildmates are kin since; it still guards a room's old take (a tab whose room signs no collect) where a party or
  a guild was joined between the fall and the take, or the hub is silent.
- **Lane 1's freeze.** A record the judge holds still loses its drop, and the room is given none of it (`burnt`, no
  order): a held character hands no value to another player. It keeps the killer's piece (Mac, 2026-10-14): that one
  goes only to its killer, who can never have it from a held record. BURNT-SAID (FIELD BUGS 2026-10-18b): the fallen's
  game took that drop out of the pack and said nothing (`dropped` 0 with no order) - its death screen now says the
  pieces were lost and that the character's trading is frozen, and names any letters of credit among them by their worth.
- **THE FOUR HOSTS.** `scenes/world.js` WIRED (the zone word, the blows, the referee's readout, the fall, the drop, the
  deposit, the seizure, the escrow - the killer's collect carried, the fallen's piece taken back, both on the zone's
  frame, `wildEscrowHost.js:"const wildEscrowFrame = () =>"`); `scenes/dungeonContext.js` (the zone's halls) WIRED through world.js's own `wildStrike` and
  `wildSpellOut`, refereed alike, its pool holding the remains, its ghost leaving once its deposit has gone; `scenes/
  worldModes.js` (a building) no fight - the zone word is 0 indoors - its pool holding the remains;
  `scenes/exterior.js`, the offline fixed city, NOT WIRED on purpose: the zone is online's alone.

### INT10 - every spell between players capped

Every place one player's spell meets another's is a referee's: the caster's own machine counts the harm on a stand-in
(`combat/siegeCombat.js` siegeSpellNumbers - a neutral one, `combat/duelCombat.js` duelStandIn, since AUDIT C&C H5: it
was a stand-in of the caster's own sheet, so its own race and willpower saved against its own spell) and sends a
number, and the relay clips it - a duel's, the
zone's and a siege's on `refereeCast` (`SIEGE_CASTS`: three a five-second window, sixty at most), the arena's on its own
law pinned equal. No target's machine applies a peer's harm: a peer's cast at a player is a gift's families alone
(`systems/allyCast.js`). A Royal Tourney's bout is blows alone - the relay refused a heal between its two but refereed a
crafted client's damaging cast as a siege's; it takes no cast now. Found while pinning: the zone's mend cleared a
caster's cast window on every blow (the striker is unstruck), so a crafted client cast past the rate - mend restores
vitality alone. **THE FOUR HOSTS.** `scenes/world.js` WIRED (the duel's, the zone's and a siege's casts, each a number
for its referee); `scenes/dungeonContext.js` WIRED - the zone's halls through world.js's own `wildSpellOut`, the arena's
rival through its own law pinned equal
(`dungeonContext.js:"castAtDuel: opts.arenaRival ? (_id, sp) => spellOnRival(sp) : (opts.wildSpellOut ? (id, sp) => opts.wildSpellOut(id, sp) : null),"`);
`scenes/worldModes.js` (a building) no spell meets another player there - no fight is struck indoors; `scenes/exterior.js`
NOT WIRED on purpose: offline, no other player.

### 5b. The audit (2026-10-09, Mac: "Lets audit this")

Five reviews ran on lane 2 as first built: the relay's referee and its races, the service and the ledger, a modified
client's ways round both, the honest player's own paths, and the tests and the docs. What they found, and where each fix
is told above: one fall's drop laid twice - an order re-minted on each asking, naming no room, and a room that let an
emptied remains go (INT9, the room); a fallen that kept a dropped piece charging its taker for a copy (the ledger); the
ledger asked of a dry run while the take ran another, and the fallen's game taking what the service kept (the drop); the
gold last behind a bag of junk, a heavy record that fit no frame, the light left on another piece, the cart's coin put
back into the purse (the drop); the pick an index into the fallen's own list (the fall); a word off and on a heal, a step
into another cell a fresh bar, a rise at once where the body fell, a jump never believed (the fight); a fall forgotten by
a full room or a restarted one, and a dungeon's signed a minute late (the fall); a closed tab a fighter for good, a hub's
silence read as strangers, a token naming a character not in play (who fights); the referee's fall turned aside by the
death door; the duel referee's word dropped on a halo, a bout's frames sent to another room, its readout drawn only at
the first blow (INT8); and in the pins, a duel's ring copied by hand, a pick window read through a signed fall, asserts
of a literal beside the value, a constant nothing read (`DUEL_RANGE_TYPES`, retired), two DUEL1 records retired whose
laws still stand (re-aimed). The four-point duel cast path in `systems/effects.js` (`duelCast`, `bundleDuel`) is
DORMANT: no caller sets it since INT8, kept as it stands and pinned so (`test/net/duel/int8_duel_ref.test.js`).

### Decisions (2026-10-09)

- **Customs** (Mac: "Your decision"): it stands as lane 1 left it - an offline character comes in whole, and its first
  judgement charges what it adds past its level's allowance to the budget, which holds nothing until staff turn it on.
- A fight between players never touches the save's health (the sieges' law since PVP-REF), and a spell between players is
  its harm alone: a paralysis, a drain or a slow from another player does not land, as a siege's never did. TWO
  DEPARTURES FROM MAC'S DUEL1 ASKS, made by this lane and told to Mac in its pull request: "Loser drops to 1HP and both
  are fully healed on duel end" - the duel's bar is the referee's vitality now, so the loser's health is never touched
  and nothing needs healing; and "weapons, bows and spells all count" - a spell counts by its harm alone (its other
  families, a paralysis or a drain, do not land on another player).
- The zone's membership is each socket's own word, and its receipts are the relay's to sign and the service's to settle.

### Decisions (2026-10-14, FIELD BUGS PVP-LOOT)

Mac, on "Equipped items Disappear after looting in PvP zone" (`01-Overview/bugs/Field-Bugs-2026-10-14.md` PVP-LOOT):

1. **"Guildmates are friends."** The referee counts one guild kin, as a party, its truce and a duel are - one law
   (`wildRef.js:"export function wildKin"`) at the relay and at every client door (INT9, who fights).
2. **"Yes, build it" - the two-phase handoff.** The fallen loses the killer's worn piece only once the killer has it:
   held by the service in escrow from the fall, the killer's when its collect lands, its fallen's again when nobody
   collects (INT9, the drop and the room).

### Decisions (2026-10-19, FIELD BUGS DUEL-BAR)

Mac, asked on a player's private report - in a duel, their own health bar did not drop when the other player hit them
(`01-Overview/bugs/Field-Bugs-2026-10-19f.md` DUEL-BAR). It was the 2026-10-09 decision above working as built: the
bar read the save's health, which a duel never touches, and the referee's vitality stood in a line of its own under the
battles' readout ("Your vitality: n / m"). **"Bar shows duel vitality."**

- **DISPLAY ONLY.** For the length of a duel the HUD's health bar, on both skins, reads the referee's vitality - my own
  entry of its word, off the duel manager's live duel (duelBar.js:"export function duelVitality") - and the save's
  again when the duel ends: won, lost, yielded, left, called off, or let go where no word of the referee's comes (a
  socket gone: the manager's own windows, as the ring and the readout end). The save's health is never written, and
  the 2026-10-09 decision stands whole: nobody is hurt or healed by a duel. The read is a leaf of the client's own:
  `net/duel/duelSession.js` is in the relay's bundle (the arena's bout reaches it), where a byte is a relay version,
  and the HUD is no relay law.
- **ONE PAIR, BOTH SKINS.** The HUD reads one health (hudVitals.js:"export function hudHealth"): drawHud's
  `healthBar`, which the world host hands it (world.js:"healthBar: duelVitality"), else the save's. The classic
  bars and the large HUD's draw off its snapshot (hud.js:"const health = hudHealth"), the enhanced HUD's off the pair
  drawHud hands on (enhancedHud.js:"const hp = opts.health"); and so does everything drawn off the HUD's health - the
  trails, the near-death tint, the blow's recoil, the lens. The turn each way is no blow and no heal
  (hudVitals.js:"if (_lastFrom !== null && _lastFrom !== from)"): the detector primes afresh, and the enhanced bar's
  held loss and its heal reading start again.
- **THE OTHER BARS, THE HEALS, THE DEATH.** The referee holds vitality alone - no fatigue, no magicka, and no heal
  between the two (duelRef.js:"last believed places") - so the fatigue and magicka bars are the save's, and a heal of
  the save's under a duel (a potion of the player's own) moves no part of the duel's bar and floats no "+N". The death
  screen reads the save's health as ever: a duel's fall is a loss, never a death, and a foe's blow that kills under a
  duel ends it (the manager's `dead`).
- **THE ARENA IS NOT THIS.** A bout between players on the arena's sand (ARENA4) writes its referee's share into the
  save's health and its healers come at the end (arenaBouts.js:"MY HEALTH IS THE"), so its bar already fell; it keeps
  its own law. The open zone is not this either: its foes hurt the save, and a bar that read the zone's referee would
  hide them.
- **THE FOUR HOSTS.** `scenes/world.js` WIRED (one entry in its one drawHud call); `scenes/worldModes.js` and
  `scenes/dungeonContext.js` NO DUEL on purpose (a duel is outdoors alone, INT8); `scenes/exterior.js` NOT WIRED on
  purpose (offline, no other player).

A departure from DFU, whose vitals read PlayerEntity alone (HUDVitals.Update) - DFU has no other player to duel.
Pinned: `test/ui/fb1019f_duelbar.test.js` (the real relay refereeing the bout into the real duel manager, read by the
real drawHud on both skins); `tools/mutants/duel_bar.json`.

### What lane 2 leaves open

- A client may OPT OUT of the zone's fights (never say `zone`): it fights nobody and drops nothing to a player. It cannot
  opt into another's fight, and an honest player outside the zone is nobody's target.
- A death to a foe is the client's own word (the world is simulated on the player's machine): a client that never dies
  to a foe drops nothing to one.
- A fall the relay signed whose fallen's tab and killer both never carry its receipt within its hour drops nothing.
- A room's referee is its memory: a relay object that restarts mid-fight forgets the fight (a fall already signed, or
  waiting on its pick, is kept); the hub keeps the bars a fighter carries in its memory too, and one that restarts sends
  each fighter whole into its next room.
- A fighter's bar is its own cell's: a blow lands only between two that stand in the same cell (a fight across a seam
  waits for one of them to cross), and the bar crosses with it.
- An order is good its minute: a deposit that never left inside it (the network gone for a minute) lays nothing, and the
  drop is lost to everyone - the record lost it either way, save the killer's piece in escrow, which comes back to its
  fallen (INT9, the drop).
- A piece in escrow comes back only when its fallen plays again: there is no clock that moves a record nobody plays. A
  fallen character deleted or dead for good while one is held has no record to take it back into; it stays the escrow's.
- A crafted piece the fallen takes back from its own remains is written down as its copy: it wears it, and never trades
  it (the craft's key cannot be minted afresh as an id is).
- A pick at a piece the fallen no longer wears (it changed between the offer and the receipt) takes none.
- Where a parked wagon stands (CART-AWAY) is the fallen's word, held to its record's mode alone: the wagon's record is
  the player's own, so a client that writes its wagon parked off the zone keeps a cart it drove in, and rises with that
  record. A seizure, its carrier holding neither the record nor the mask, takes the cart wherever it stood.
- A relay before world185 knows no `wref`, no `zone` and no `dref`: a client meets it fighting nobody and duelling
  nobody. A client from before world185 still open in a tab sends the zone's retired words (WILD1's `result` and
  `gave`) and the duel's own resolve, which the new relay refuses - it is closed for them until it reloads. The deploy
  runs the relay first (`.github/workflows/account-deploy.yml` waits on it, `deploy.yml`'s site on the service), so a
  reload meets the new client.
- Boss fights are lane 3's.

**Pins.** `test/net/arena/int7_arms.test.js`, `test/net/duel/int8_duel_ref.test.js`, `test/net/int9_wild_ref.test.js`,
`test/net/duel/int10_spells.test.js`; the pins they moved are marked PIN MOVED where they stand. Mutants:
`tools/mutants/int_lane2.json`; the records INT7-INT10 moved re-aimed by content, and fifteen of DUEL1's
(`tools/mutants/duel.json` and `auditduel1.json`) retired with the laws they checked - the defender's resolve, the
loser's report, the mutual draw, the duel's heal - which are the referee's now. Migration `0104_referee`;
`ACCOUNT_VERSION` acct104 (acct101 and migration 0097, then acct102 and 0098, on its branch - renumbered past main's
BAG-CRAFT, then past the Chapters' acct103 and migrations 0098-0103, at the merges); `RELAY_VERSION` world185 (world183,
then world184, on its branch, renumbered past CHAP4c's and PERF-RELAY1's at the merges).

## 6. Lane 3 - boss fights (INT11-INT15)

**Built 2026-10-10** (Mac: "Do it", to this plan; asked what the relay believes of the healing it cannot see: "Measure,
then enforce"). In a gate's court, an Abyss Dungeon's realm and a serpent's waters the relay judges the boss's blows
itself, on the poses it already holds, by each fight's own strike law (`net/bossRef.js`), and keeps its own count of
each fighter's body - a ship's hull at sea (`net/bossBody.js`). The count MEASURES first: each boss receipt carries what
it saw (`m`), the account service keeps it, and staff read it; nobody falls by it until staff set the relay's line. The
world stays the client's (section 2): the blow on this screen, the potion drunk, the save.

### What lane 3 found

Each fight's blows were judged on the struck player's machine alone - `net/gate/gateStrike.js` ("The relay never learns who
was struck; it did not need to"), `net/superDungeon/sdStrike.js`, `systems/serpent/serpentStrike.js` ("The relay never learns a ship's
hurts") - and the relay's one word of a death was the pose's `dd`, the client's own. So the spoils' "stood alive half the
fight" was the client's word, a client that took no blow stood every fight out, and one that took none could carry a
fight alone (the serpent: "one ship alone still can't" held only for ships that took its blows).

### The call: what the relay can believe

A boss's blows are a share of the struck player's own health, and what softens them lives on the client: a potion (no
cooldown here), a Heal, a Shield's pool, a set's halving (Malacath's Unbroken), a death save, an element's saving throw
(`systems/spellcast.js` savingThrow - a career's Immune, a resisting affix, a Resist spell, stacking to the whole), a
brace and a carpenter's patch at sea. The relay sees none of it. Asked (2026-10-10) whether to measure the healing it
cannot see first, to cap healing in boss fights as a new rule, or to enforce a generous budget at once, Mac chose
"Measure, then enforce" - lane 1's wealth budget's law (section 3, call 2).

### INT11 - the body counted (`net/bossBody.js`), the gate judged (`net/bossRef.js` judgeGate)

- **The count.** Each fighter's record in its fight keeps `bd`: the relay's count `v` (a share of the whole, 1 at its
  first blow), its mend budget, and its measure. A blow the relay judged takes its share off `v` (bodyStruck); the blow
  that takes it to nothing is the count's FALL - counted (`w`), the first one's stood time and damage kept.
- **The client's word (`vt`, thousandths of its whole).** A word that says MORE than the count claims the difference as
  a mend, believed out of a budget that fills `perS` a second to `depth` (bodySaid); what the budget cannot pay is left
  unmet, and each rise of it is claimed PAST THE LINE (`o`) once, however often the word comes. A word that says LESS
  claims nothing and lowers nothing: a blow the client took and said before the relay judged it would otherwise be taken
  twice, and a hurt the relay never counted (an element's, a pool's, a fall's) is the client's to heal. A tab that never
  says its body measures nothing (`sd` - its count would read falls that never were).
- **An ally's heal is the count's** (6b): what the gate believed of a mate's heal (GATE-HEAL's `heal`, through its own
  heal bucket - `applyHeal`), at the brain's reference health (`healRef`, generous, so the share is the least), is no
  mend of the body's own (bodyHealed). The body's word of it comes first, so the heal pays back what that word claimed:
  what was left unmet is believed and no longer past the line, what the budget paid is given back; a heal heard before
  the word stands the count up itself.
- **What is counted:** the blows no saving throw answers - a plain blow (the Cleave, the Slam, the Charge, the Leap, the
  Bound Across the Fire, a Harrier's Bite), and Dagon's Wrath and Reckoning, whole. An element's blow is the client's
  (`blowOf`'s `saved`): a lawful character can be immune, so the count takes it as the immune would - nothing. A share
  is the blow's `pct` alone; its `base` points need a maximum health the relay does not hold. Burning ground is never
  counted.
- **In the struck player's favour, always.** A landing is judged BODY_AFTER_MS (400) after it, so the first pose after it
  has come; a body is struck only standing BODY_MARGIN (1.5 m) deep in the shape both where its last pose before the
  landing put it and where its first after does (the relay's trail of the poses of the SOCKET that speaks for the body,
  BODY_TRAIL_MS - a fighter's socket alone, while its fight lives, put on it where it stands at its `in` and its hello)
  - a body that stepped out as it landed, or in after, is not struck. 6b: a trail whose every pose came after the
  landing says nothing of where it stood (posAt null), nor does a room woken within a trail's span of the landing
  (`_trailOf`'s `[]`): not known, not struck. The charge is judged down its lane each beat of its run, where
  the body stood at the beat's two ends. Each blow is judged once (its record marked, `bj`; a run's struck, `bh`), so a
  fight woken from its checkpoint judges nothing twice.
- **The census as the count has it** (bodyCensus): a death the fight saw (`dd`) is noted; alive again is a new life -
  whole, its budget full, its measure kept.

### INT12 - the Abyss Dungeon (`net/bossRef.js` judgeRemnant)

The Stomp's disc at its landing (never its rolling ring - a jump lets it pass, and a pose says no ground), the Gear
Volley's marks, the Hour-Hand over its sweep each body once (a pillar between it and where it was cast spares it, at
any height), and the Hour's own - the Mantella Pulse, the Reset while its Hearts stand at its landing, the Hour's End -
over the whole arena at once (never the Steps). A blow its Hollow's marks gave an element is the client's, as at the
gate. The census keeps SD-ONELIFE: no new life in the Hour.

### INT13 - the serpent, on her hull (`net/bossRef.js` judgeSerpent)

The count is a ship's HULL's, not a body's: every hurt the serpent does a hull is counted (a hull keeps no save) at the
fleet's share (`fleetShare` - a pair's two thirds). Its blow at its landing (the ram down its lane over its run), the
coil's grip each second on the ship it closed about - her captain's pose deep in its ring as it landed (her `esc` is her
word; the ring is the relay's) - and its crush as it lets her go crushed, and the Maelstrom's eye grinding her. Only a
ship of her own, afloat (a hand on another's deck is no hull here, a wreck is struck no more). Her place is her
captain's pose: the relay holds no footprint, so her bow and stern are never struck by it - the favour again. Her mend
line is the sea's own repairs under fire beside the free mending, twice over (BODY_DEFAULT's `hull`), and a wreck by the
count floats again past HULL_REFLOAT, the sea's FIELD_REFLOAT (pinned equal). 6b: a ship back at the fight after
SERPENT_ABSENT_RETIRE_MS (45 s) away is a NEW HULL - she sailed for her yard or came on another (bodyLife, her measure
kept); and a volley lands only from the socket that speaks for her body (her newest in the cell - the census's).

### INT14 - the measure kept and read

- Each boss receipt (`r1`, `h1`, `l1`) carries the fighter's measure as `m` (bodyMeasure): [counted, believed, claimed
  past the line] in thousandths, the count's falls, whether the receipt would have stood had its first fall been a fall
  (the fight's own earning law asked of the fighter as it stood then), and its seconds stood. Optional - a receipt before
  it carries none; every reader refuses a malformed one.
- Migration `0105_body`: each kill row (`gate_kills`, `sd_kills`, `serpent_kills`) keeps it as `body`.
- `/v1/mod/realm-bodies` (review.js bodiesMeasure, a developer's alone) answers each fight's receipts, the mends each
  claimed a minute it stood by quantile and at most, how many claimed past the line, fell by the count, and would have
  lost their receipt; `node tools/realmReview.mjs bodies [days]` asks it.
- **THE LINE IS THE RELAY'S** - its `BOSS_BODY` var (`server/wrangler.toml`), JSON `{enforce, body: {depth, perS},
  hull: {depth, perS}}` (bodyConfig). Empty is BODY_DEFAULT, which enforces nothing; a line it cannot read whole is the
  default, never something nobody chose. Its first numbers - a whole body held and one more every 20 s; the hull's above
  - are guesses the measure exists to replace: **OPEN**.

### Enforced (once staff set `enforce`)

A body the count takes to nothing is fallen by the relay's word: dead in the census (it stands no time, is chosen no
more, its fall counted and fed as a `dd` is), its blows land nothing (bodyOut), and its game is told (`bd`) - the gate's
court or the Hour's dies by the zone referee's door (`forcePlayerDeath`: no death save, no AvoidDeath). A fallen body
mends no more; a new life comes only BODY_RISE_MS (15 s) after a death the fight saw. In the Hour the count's fall takes
its one life (the realm's dead, as a `dd` does). At sea the count's wreck is a wreck (serpentWreck: her share out, her
coil let go), `bd` wrecks her own ship on her machine (her whole hull, as a blow), her own `wr 0` is not heard and her
volleys land nothing until the count floats her again. 6b: then she floats by the relay's word - her `wr 0` said while
the count held her kept for it (`wf`: her game says it ONCE, as it floats her), or the count's float alone while her game
never said a wreck of its own (`cw`). The fall is told again every BODY_TELL_MS (3 s) while its game has not taken it -
no death seen since (`dd`), at sea no `wr 1` of hers (bodyTellOwed): a fighter mid-reconnect as it fell heard nothing
and fought on a ghost.

### INT15 - the clients

Each fight's client says its body at most every BODY_SAY_MS (250), at once when it moves a thousandth, every
BODY_SAY_KEEP_MS (3 s) however still (bodySayer): the court's (`scenes/gate/gateCourt.js` sendBody) while it stands alive in
a fight that lives, the Hour's through its realm's socket while the fight answered it, the serpent's host her hull
through her cell. Only to a relay that counts (`BOSS_REF_RELAY_MIN` 188 - an older one's words know no `vt`) - 6b: the
relay of the socket the word leaves on (`net/online.js` _bodySend; her cell may be a halo's, its relay its own), on a
bucket of its own (`net/wire.js` BODY_WORD_HZ_MAX, bodySayer's pace, pinned equal; the relay's bodyWordRelayGate holds
a burst), never the fight's blows'. No brain's version moved: a tab from before it says no body, is refused nothing, and
measures nothing.

### 6b. The audit (2026-10-10, the owner: "Fix everything in the branch")

A review of lane 3 as first built found fifteen things, each fixed and pinned where it was found
(`test/net/int_lane3_audit.test.js`, mutants `tools/mutants/int_lane3_audit.json`). Live at the deploy, enforced or not: the
body's word spent the fight's own blows' bucket - four of the gate's sixteen a second, four of the serpent's ten while
her carpenters worked, so a swing's frames and a coil's `held`/`esc` (never said again) were refused; and the serpent's
host asked the PRIMARY socket's relay whether to say it, down a halo whose relay could be older (the junk that closes a
socket - AUDIT RAID R8b's class). The measure staff set the line from: the pose trail kept by account, so a second socket
of a ship's in her cell posed decoys the judge read; a trail whose every pose came after the landing read its first as
where the body stood (in after, counted); a hull's count kept through a yard's whole repair (claimed past the line, and
under enforce a wreck at seven tenths); an ally's heal charged to the healed body's own budget. Enforced: a ship the
count wrecked never floated again (her once-said `wr 0` dropped while the count held her - the INT13 pin had said it
twice); the fall said once, to the sockets of that beat; a hull's word waking a sleeping fight and returning before its
beat was armed. And the census built twice a beat, every pose of a cell whose serpent fell hours ago trailed,
review.js's quantile loop copied, a constant's doc comment orphaned, a test's clock left frozen by a throw in its setup.
Pins moved, each marked PIN MOVED: posAt's "all after" (`test/net/int11_body.test.js`), the serpent host's version check
and the INT13 pin's second `wr 0` (`test/net/int12_body_relay.test.js`), the gate's heal read by source
(`test/net/gate/gateheal.test.js`), the Hour's word routing and its census read once (`test/net/superDungeon/sd8b_fight.test.js`,
`test/net/superDungeon/sd20a_fight.test.js`), and world188's hash, re-recorded in place (undeployed).

### Decisions (2026-10-10)

1. **The healing the relay cannot see** - Mac: "Measure, then enforce" (asked; above).
2. **What the count leaves out, in the struck player's favour** (this lane's): an element's blow and its burning ground
   (a lawful character can be immune), a blow's `base` points, the Stomp's ring, a ship's bow and stern. The count is
   what a body took at the least.
3. **A silent tab measures nothing**, and no client is made to reload for this: its count is kept and its receipt carries
   no measure, so no line is set from a tab that believed no mend.

### What lane 3 leaves open

- **An element is the client's.** A modified client is as tough against a fight's element as a lawful build immune to it,
  and stands in its fire. The relay would need the judged pack's tolerances and resistances signed, as INT7 signed the
  arms - and a Resist spell cast in the fight would still be the client's.
- **The line is a guess** until the measure says otherwise; while it only measures, a client that takes no blow still
  stands the fight out - its receipt says so (`w`, `k`).
- **Once enforced, a heal past the line is a fall** while the screen says alive - the measure exists so that the line is
  set past what honest play claims.
- **A death save** (a set's turned killing blow) is a mend to the count, out of the budget like any other.
- **The serpent's venom on a body** is not counted: a body's death at sea stays its own `dd`.
- **Where a body stands is its client's word** (6b). The relay judges a landing on the poses it was sent, and in a gate's
  court, an Abyss Dungeon's realm and a serpent's waters no step is judged (a battle room's referee alone does): a
  modified client that steps its pose out of each telegraphed shape at the landing and back is never counted. The
  relay would need the fights' movement refereed as PVP-REF's is.
- **An ally's heal is the healed client's word** (6b), believed within GATE-HEAL's own heal bucket and now the count's:
  a modified client in company can claim heals its mates never cast, up to that bucket.

## 7. Lane 4 - progression claims (INT16-INT18)

The plan, as it stood: "Renown XP, Marks from finds and harvests, bounty camps, seat influence, profession XP and raid
kills: accepted only from a seated realm character whose trade is not held, each cap per hour of PLAY the service
measured rather than per hour of the clock, and the legacy record held to its own law." Built 2026-10-17 (the owner:
"Take care of the integrity arc"; asked, "Measure first", and "Add to #987" - this lane rides FOE-FORGE's pull request).

### What lane 4 found

Read against the tree (four read-only maps, 2026-10-17): no progression route asked whether its character was a realm
character, whether it held the account's lease, or whether its trade was held, and every cap counted the clock.

| Stream | Route | Before lane 4 |
|---|---|---|
| Renown XP | `/v1/renown/xp` (renownTracks.js reportRenownXp) | the client's word; any `char-...` id, a guest's too; 5,000 a report, 15,000 an account a clock hour |
| Raid kills | `/v1/raid/claim` (raids.js claimRaid) | the relay's signed receipt - but the receipt names no character, the client picks it; six a game day |
| Bounty camps | `/v1/seats/bounty` (seatHolding.js claimBounty) | the client's word ("Bounded, not witnessed"); five an account a UTC day |
| Seat influence | `/v1/seats/orc-camp`, `/v1/seats/watch` (seatInfluence.js) | an orc camp the client's word, five a day; the Watch relay-signed, sixty ticks a day |
| Marks finds | `/v1/marks/find` (marks.js findMarks) | whether a find happened is the client's (its dice are the device's); twenty a UTC day |
| Profession XP | `/v1/prof/harvest`, `smelt`, `craft`, `brew`, `disenchant`, `temper`, `/v1/writs/deliver` | any 4-64 character id - a made-up one a fresh set of nodes a day; no hourly bound at all (CAP-OFF) |
| The legacy record | `/v1/realm/lineage` (legacy.js putLineage) | its shape alone: a member's blood and hearth, an estate, and a copy that unwrote a death all landed |

### INT16 - THE SEAT (`server-account/src/progress.js`, from day one)

Every route above but the lineage asks `progressRefusal` before it reads a word (index.js, right after the account's
rate - `PROGRESS_ROUTES`): the account's realm character holding its lease (one an account, realm.js joinRealm), alive,
and - where the route names a character - the one it names. Answered `progress-seat` (403) otherwise, and `trade-held`
(403, with `held`) while that character's trade is held (verdict.js holdOf: a forged record the judge found, or staff).
A find names no character: the account's seat is asked - and the town economy's Watch (`/v1/towns/watch`, AUDIT TOWN-ECON 2
SVC-2: it had counted footsteps for an account with no seat, or one held; asked of the account's seat, spending no bucket -
a town's share is no player's progress, `06-Systems/Town-Economy-Arc.md` section 4). An honest client claims online alone (the Renown tracker, the
Marks, profession and seat books run only with `?online`), online is the realm's (REALM-DOOR), and an online realm
character's id is the realm's own (world.js sets it from the service) - so an honest player is always its seat. What it
refuses: an offline id (each a fresh set of nodes a day), another of the account's characters, a seat another device took,
a guest or account with no realm character at all, and a held character.

The clients (each book's own law for a refusal): the Renown tracker stops for the page on `progress-seat` or
`trade-held` (its PERMANENT set) - "This character is earning no Renown."; the Marks book drops the day's finds and owes
none (`FIND_DROPS`, as an account too young to find); the seat book settles the Watch's ticks (`WATCH_SETTLED`); a raid's
receipt is kept (the relay signed a real cleanse - it lands once the player is seated and unheld again); a station's act
says the refusal and loses nothing. The words: accountClient.js `progress-seat`.

### INT17 - THE PLAY THAT PAYS (measured first)

Each stream is a bucket, the wealth budget's own law (budget.js stepBudget - one law): it fills at its line's rate for
every second the account played (players.played_s - the service's own count, accounts.js creditPlay), up to its cap, and
each claim spends what it took (`progressSpentOf` reads the route's answer - Renown credited, never asked; a cleanse and the
Renown it paid; a camp; the Watch's ticks; a find; a harvest's XP and its silver; a writ's XP and Renown; nothing for a
refusal or a repeat). A first claim starts its bucket full, its play counted from there. Migration `0127_progress`:
`progress_play` (the bucket, an account a stream) and `progress_hours` (an account's claims of a stream in an hour of the
clock: the amount, the play it came in, and what it took past the bucket - `over`), swept by the cron with the wealth's hours.

The first line (`PROGRESS_LINE`) is each clock cap read per hour of play: Renown 15,000 XP an hour (renown.js
RENOWN_XP_HOUR_MAX), a raid's six cleanses a game day of two real hours (three an hour), five bounty camps, five orc
camps, a Watch tick each two minutes stood (thirty an hour, sixty held), twenty finds, thirty harvest silvers; and a guess
for the professions (10,000 XP an hour, 20,000 held), which no route bounded by the hour.

MEASURE FIRST (the owner, asked: "Measure first" - as the wealth budget and the boss fights' count were): while the line
only measures, nothing is refused, the clock caps stand as they stood, and the bucket keeps no debt - so the day staff
enforce it nobody starts in a measured week's hole. Staff read `node tools/realmReview.mjs progress 7` (each stream's
claims an hour of play: count, quantiles, most; the hours that went past the line and how many accounts), set each
stream's `rate` past its 0.999 quantile with room, and `progress-set` the line with `enforce: true`
(`/v1/mod/realm-progress`, a developer's alone; kept in `realm_config` as `progress`, read within a minute everywhere).
Enforced: a stream whose bucket holds less than one is refused `progress-play` (429) until play refills it, and a Renown
report is credited only what the bucket holds. A bucket above a cap staff lowered is spent down, never cut (the budget's
law). The clients keep what an enforced line refused and ask again (the Renown tracker's backoff, the Marks book owing the
rest, a harvest kept as `prof-rate` keeps one).

### INT18 - THE LEGACY RECORD HELD TO ITS OWN LAW (`src/systems/legacy/legacyLaw.js`)

The family law's bounds moved into a leaf the Worker reads (family.js and heirloom.js take them from it - one home each):
BLOOD_MAX, HEARTH_MAX, ESTATE_SHARE, ESTATE_MAX, REMAINS_GOLD_SHARE, REMAINS_GOLD_MAX. `lineageLawFindings` asks a copy
for a member's blood past its most or not whole (at most the eight stats), a hearth past its most or on no skill, and a
waiting estate past its ceiling; and beside the stored copy, a member, a death, a retirement or a fallen's remains gone -
the facts store.js mergeFacts only ever adds (REVIVE's stamps take a death back before this is asked: legacy.js
withoutRevived). putLineage refuses a copy that breaks it whole (`lineage-law`, 400, its findings named) and the stored
copy stands. THE STORED COPY IS ASKED ONLY OF A WRITE MADE FROM IT (`base` its rev): a copy made from an older one is
answered stale with the stored copy to merge into, as ever - refused as the law's, a device would never take another's new
member in. The client takes `lineage-law` as the record's own refusal (realmLine.js LINE_REFUSALS: said once, never sent
again this session). Not asked: a member's own estate (an heir that waits through two falls holds both - legacyHost.js
adds them; the first save's liquid ceiling bounds what reaches a record), and the remains' and a bequest's items, which
the item law and the wealth budget judge where they land - the save.

### Decisions (2026-10-17)

1. **The play-hour line: "Measure first".** The seat and hold gate enforces from day one; the line measures.
2. **Delivery: "Add to #987"** - this lane and FOE-FORGE ride one pull request (the arc's "A PR per lane" set aside, asked).

### What lane 4 leaves open

- **A seated client can still claim inside the line.** A modified client that keeps its page beating plays every hour
  the clock gives it; the line bounds a claim by the play the service counted, not by the play the player did. Until staff
  enforce it, only the clock caps hold.
- **The relay's receipts name no character.** A raid's cleanse and a Watch tick are the account's; INT16 pays them to the
  account's seat, whichever character fought.
- **Offline progression is gone from the service.** An offline id is refused - an honest client never sends one (the
  books run online alone), but the offline disenchant branch world.js still carries (`profBook.disenchant` with no realm)
  and alchemy.js disenchantPiece's craft-hold arm for a non-realm id are unreachable through the service now; CRAFT-HOLD's
  disenchant pin calls the function directly (test/server/crafthold.test.js).
- **A malformed claim's answer moved.** A report that names no character was the route's 400 (`renown-character`); the seat
  answers first now, 403 `progress-seat`.
- **The house in the token** (`hn`, `hc`, `hg`) still reads the record's own members: a forged copy with phantom
  members of one given name still climbs `hg`, bounded at HOUSE_GEN_MAX (houseLaw.js) and the name filter.
- **The born heir's first save** is held to the first save's law (firstSaveRefusal, the character law) - never to its
  roll and its blood (`bornValues`), which the service does not replay.

### Pins

`test/server/int16_progress.test.js` (9) - the line, what an answer spends, the seat at every route, measured (past the
default line and staff's own), enforced, the units, the clients. `test/server/int18_lineage_law.test.js` (5) - one home for
each bound, the family law's own producers lawful, every finding, the route (a stale copy still answered stale), the client.
`tools/mutants/int_lane4.json` (34, all dead). Pins moved (each marked PIN MOVED where it stands): seventy-eight test files whose
claims named a made-up character now claim as a seated realm character (`test/accountDb.mjs` `seated`, beside
`registered`), and where a test pinned a route's own refusal for a character that is not the caller's seat, the seat
answers first (`progress-seat`) and the route's own law is reached by the seat or called directly; the cron's hourly roll
(`auditscale`, twenty-five); the account deploy's smoke takes a realm character before its Renown report. Re-aimed by content:
`audit625.json`, `audit_seats_client.json`, `fb1001_ground.json`, `silverfinds.json`.

## 8. FOE-FORGE - a peer's foes held to what an honest owner streams (2026-10-17)

A screenshot from the Discord's #dev-chat (Starempire42, a moderator: "it seems there is a cheater in the server. I
don't believe I can do anything right now"): one player in a hamlet among about forty **Elite Daedroths**, other players
beside them. Nothing honest stands that: a town raid is at most 25 raiders and 8 defenders, all knights, bandits or orcs
(`systems/raidingParties.js`); no foe rolls elite on a town's ground (`exteriorFoes.js` spawnFoe's `!inLocation()`); the
gate's Daedroths stand only in the gate's own room. The owner, asked: "Close the foe holes" (moderator bans are not
this slice - see below).

### What a modified client could do

A cell's foes are their owner's word: each socket streams the foes it owns, and the relay reads none of the records
(`server/src/index.js`, the `foes` and `own` arms). Every reader stood them through `exteriorFoes.js` applyFoes, whose
law had four holes:

- **Each allowance was its own.** The encounter's (ENCOUNTER_PUPPETS_MAX, 32), the watch's, the camps', the deep's, a
  raid's and a shared quest's each counted apart, and a frame's tags (`dz`, `rz`, `st`) are only shape-checked. So one
  forged sender stood about a hundred hostile foes of any species at every reader near it.
- **A takeover minted without end.** A record naming the reader its heir (`e`, PDEATH-FOES) is taken over: the foe
  becomes the reader's own, driven by the reader's AI. A foe taken over left its owner's count, so the same sender could
  stand fresh records and name the reader heir again, round after round. The surrounded player may be the victim:
  their console reads `[foes] took over N foe(s) from a fallen player`, and their client then streams the horde to
  everyone near as its own.
- **`z` stood any foe as an elite** (five times the health, three times the blows), every record believed.
- **`gg` and `nm` did the same at four times the blows**: a Greater Giant's multiplier (WILD_GIANT_DAMAGE_MULT) on a
  foe of any kind, and a revenant's blows (`rb` up to 4000 per mille, `p2` on top) on any record naming one.

### What the reader holds now (`src/scenes/exteriorFoes.js`)

The reader's law alone. The wire, the relay and RELAY_VERSION are untouched, so no player is dropped, and every player
has it on their next update.

- **`PEER_PUPPETS_TOTAL_MAX` (= wire.js CELL_FRAME_RECORDS_MAX, 64)**: the most of one owner's foes a reader holds at
  once, every allowance together, with **the foes of theirs it took over that still live counted among them**
  (`heldOf`). An honest owner's live foes all ride one frame (the sender's own trim), so honest play does not meet it.
  The takeover loop is closed by the same count: a taken foe moves from the owner's puppets to the owner's taken, and
  the total does not move.
- **`PEER_ELITE_PUPPETS_MAX` (8)**: a record's `z` is believed for at most eight of one owner's foes, a taken elite
  among them. An owner rolls its own one in twenty, outside a town, so even a full frame of honest foes holds three or
  so. Past it the foe stands as its plain kind.
- **`PEER_REVENANT_PUPPETS_MAX` (9)**: the revenants a character keeps (revenant.js REVENANT_MAX, three since UNQUIET)
  and swears (revenantCompanions.js REVENANT_RETINUE_MAX, six). Past it the record's revenant fields, its blows among
  them, are not believed.
- **A Greater Giant is a giant, and one of each to an owner**: `gg` is believed only on WILD_GIANT, and only for the
  first of an owner's foes to name that index.

THE FOUR HOSTS: `world.js` (the streamed exterior) WIRED - it hands a peer's frame to this pool. `worldModes.js` WIRED -
an interior's pool is `createExteriorFoes` (`interiorFoes`). `dungeonContext.js` needs nothing here: its own lane
carries only a party's quest foes and the room's loose stands, under their allowances, and its takeover already had
its bound (AUDIT pre-merge D8, `adoptOwn`); its records stand no elite and no Greater Giant (GRANT0, 2026-10-17: but a
room member's records there cast any spell in the table, and their `rb`, `p2` and wind-up signature bit were believed
uncapped; closed 2026-10-18 - `11-Multiplayer/Spawn-Grants.md` section 8). The dungeon host's layout
stream is held to the layout every client built, and its revenants' blows ride as the host says - FLAGGED below.
`exterior.js` (the fixed city) streams nothing and reads no peer.

### What it leaves open

- **Sixty-four plain foes per forged sender.** The reader cannot tell a forged Daedroth from an honest one: the species
  a peer stands is its word, and so is its place. A sender's total is one frame, and every sender is counted apart, so
  a cheater on several guest sessions stands that many times sixty-four. A room-wide count would desync honest crowds
  (DESYNC-ZERO); it is left for a measure.
- **A champion's trait (`cp`, x1.25 to x1.875)** rides as its owner says, for at most `PEER_CHAMPION_PUPPETS_MAX` (17)
  of an owner's foes since GRANT0 (2026-10-18, `11-Multiplayer/Spawn-Grants.md` section 8): the elites' allowance and
  the revenants' bound, which honest play does not reach. Under it, which foe is a champion is still the owner's word.
- **A class foe's level (`l`, to 100) and its weapon (`w`)** are the owner's word, as the record's law has always had
  them.
- **The dungeon host's revenant blows** (FLAGGED): a seated host's layout foes carry `rb` and `p2` as the host says,
  bounded by the layout's count and, since GRANT0 (2026-10-18), by `PEER_REVENANT_PUPPETS_MAX` per owner. Under that, a
  revenant's blows are still its owner's word.
- **Moderation.** The screenshot's other half was a moderator with only `/mute` (MOD1). The owner's call for when bans
  are built (asked 2026-10-17, "Mods timed, devs permanent"): moderators `/kick`, and ban for up to thirty days;
  developers may also ban for good; nobody bans a moderator or a developer, as nobody mutes one. No ban is built here.
  CHAT SAFETY (#983, merged into this branch 2026-10-17; `11-Multiplayer/Chat-Safety-Arc.md`, Mac: "Lets do every single
  thing here") built the ban since: any moderator bans for 1 to `BAN_DAYS_MAX` (365) days or for good
  (`server-account/src/sanctions.js` banAccount), and no moderator or developer is banned. Where it parts from the call
  above - a moderator's ban past thirty days, and for good - is the owner's to settle with that arc; nothing here
  changes it.
- **The root (GRANT0, 2026-10-17).** KPbICA, on the Discord, read this section against the code: a reader can bound a
  client's word but can never know the truth, because nothing in the system knows it. Mac chose "Plan server-rolled
  spawns": `11-Multiplayer/Spawn-Grants.md` (PROPOSED, nothing built) - online, a foe that rides to another player
  exists only on a grant the relay rolls and signs when the foe is made, and every reader checks it and rebuilds the foe
  from the grant's seed (revised 2026-10-18: the relay never reads the foe stream). Planning also
  found the wind-up's signature bit (x2) believed on any foe, at the street's readers and the dungeon's (that page's
  section 1). Its section 8 closed those on 2026-10-18 (the owner: "Quick fixes first"), and caps champions.

Pins: `test/scenes/foeforge.test.js` (8) - two real pools, the forged frames a modified client's and the honest ones the
producer's own (`foesFrame`, `handOverFrame`); `tools/mutants/foeforge.json` (16, all dead). Pins moved (each marked
PIN MOVED where it stands): `revenant_card` (the puppet's name, inside the revenants' bound) and `wild2_rings` (the
Greater Giant's word, a giant's alone); `revenant.json`'s REVENANT-WIRE-the-puppet-unnamed re-aimed by content, and the
six records on the lines this slice touched run again, all dead.

## Progress

- **INT19 (2026-10-17, the owner: "Take care of the integrity arc"; on #987 with lane 4): lane 1's open item closed - a
  crafted piece handed on leaves its seller's realm record.** Section 4, INT19. A listing, an auction and a commission's
  fill ask the record first and take the piece out of it by provenance in their own batch (`server-account/src/
  craftedPiece.js`); a listed or auctioned piece's record is held by the market (`piece_escrow`, migration 0128) and
  comes back as itself, collected into the record; a sold one's goes with the sale. The client hands it on through the
  realm act (`net/marketBook.js` realmPieceAct). CRAFT-HOLD's cost retired. `test/server/int19_crafted_record.test.js`
  (8); `tools/mutants/int19.json`; the market's and the writs' crafted-piece pins moved.
- **INT16-INT18 (2026-10-17, the owner: "Take care of the integrity arc"; asked, "Measure first" and "Add to #987"): lane 4,
  progression claims - built.** Section 7. Every progression claim (Renown, a raid's cleanse, a bounty or orc camp, the
  Watch, a silver find, a profession's XP) asked of the account's seated, unheld realm character before its route reads a
  word (`server-account/src/progress.js` progressRefusal - from day one); each stream a bucket the account's play fills, the
  wealth budget's law, measured first (`progress_play`, `progress_hours`; `/v1/mod/realm-progress`, `tools/realmReview.mjs
  progress`); a line's copy held to the family's own law (`src/systems/legacy/legacyLaw.js`, legacy.js putLineage - a stale
  copy still answered stale). Migration `0127_progress`, `ACCOUNT_VERSION` acct153 (acct151 then acct152, and migrations 0125 then 0126, on its branch, renumbered past KEY-LAW and SAFE at the merges); no relay change. The account deploy's
  smoke takes a realm character before its Renown report. `test/server/int16_progress.test.js` (9),
  `test/server/int18_lineage_law.test.js` (5); `tools/mutants/int_lane4.json` (34, all dead); pins moved across the files
  whose claims named a made-up character (section 7, Pins).
- **FOE-FORGE (2026-10-17, a cheater's horde of Elite Daedroths on the Discord; the owner: "Close the foe holes"): a
  peer's foes held to what an honest owner streams.** Section 8. One owner's foes at a reader are at most one frame's
  worth, the foes taken over from it still counted (a takeover no longer mints without end); at most eight of them are
  believed elites, eleven revenants, and a Greater Giant is a giant, one of each index. The reader's law alone - no
  relay deploy, nobody dropped. `test/scenes/foeforge.test.js` (8); `tools/mutants/foeforge.json` (16, all dead); pins
  moved in `revenant_card` and `wild2_rings`.

- **AUTO-HOLD (2026-10-16, Mac: "We need to figure out a better system for trade banning. I dont want to have to manually
  review"): no hold waits on a person - and its audit (Mac: "Audit this. Ensure perfection").** Section 4, AUTO-HOLD. A
  copy locks its piece and never the character, a contested claim is no strike, and a locked piece is bound on the
  client while it is; the law's third hold is timed (a week, then a month) and lifts on its own; a checkpoint names the
  locked pieces, told once a device; the shop's shelf never lands back a piece its reader carries or stowed, nor a
  dungeon's find one it carries; a key a record holds twice never leaves it, a peer's word never hands its reader a
  piece it carries, and a key on another piece is no strike. Migration `0120_auto_hold` (the timed hold's columns; a
  hold waiting for staff on three strikes the first timed hold; every other copies' hold lifted; every strike standing
  given its fade), `ACCOUNT_VERSION`
  acct141 (acct139 on its branch, renumbered at the merge). `test/server/autohold.test.js` (16); `tools/mutants/autohold.json`
  (73, all dead). Pins moved (each marked PIN MOVED where it stands): `int2_judge`, `int4_itemids`, `ringhold`,
  `realm1`, `auditrealm2_service`, `auditrealm2_client` (every answer naming the locked pieces, `[]` for none),
  `auditworld4`, `hackedgold`, `ss1_stones` (a body restored and a peer's grant asking notCarried; `partyloot`'s lifted
  scope given it),
  `fb1011g_heldside`, `crafthold` (a staff hold where it set a copies' one), `auditlwii2_service` (a patron's claimant
  contested), `auditsetsonline` and `auditworld6a` (the interior landings hand on what the reader carries), L10N4's map
  (`net/realm/realmTradeLaw.js` 23 -> 21: two retired notices and the timed hold's through `t()`), and the version pins at
  acct141. The account Worker bundles `systems/item/possessedItems.js` (`.github/workflows/account-deploy.yml`).
- **HACKED-GOLD (2026-10-12, in a session: "apparently theres people handing out hacked gold ingame"): what a peer's
  word hands on, what the law counts, and what staff see.** `01-Overview/bugs/Field-Bugs-2026-10-12f.md`. A peer's word (a
  room's container record, a body's grant, a foe's heir's pack, a worn offer) credited value no record held - a letter
  of credit at any worth, an item's price from below alone - so a modified client handed out gold it was never charged
  for. LETTER-PEER (`systems/peerWord.js`): a letter never rides a peer's word, SS3's shape widened - every site that
  read `unbound` reads `peerHanded`, the owner's grant keeps a letter on its body, and online the classic pack puts none
  in a container but the player's own. PRICE-CAP (`systems/loot/loot.js` lawPriced): a peer's price is held under the law's
  `worthCeiling` (INT1's own measure; the honest sweep's 46,919 pieces under it but Come Sail Away's deeds, which keep
  their hull's price). WORN-ONLY: a worn offer lands what can be worn. GOLD-INT: a purse, a letter's worth and a coin
  pile's count past one DFU `int` are law findings (`itemLaw.js` GOLD_INT_MAX, `judge.js` purseWord) - the absurd holds
  from day one, the measure no longer saturates; the law's version 4, `ACCOUNT_VERSION` acct123 (TECH1's rule; 3 and acct121 on its branch, renumbered past BAL9 at the merge, acct122 past NAME-AS at the next). The
  review (INT6): `realm-gains` (who went past the bucket, largest first) and `realm-trades` (whom a character traded
  with, and what each gave). `test/systems/hackedgold.test.js` (10), and `int1_itemlaw`'s honest sweep through the projection with
  and without the ceiling - no honest price moved; `tools/mutants/hackedgold.json` (34, all dead). Read again
  against the session's "I dont wanna mess with honest players": an honest player feels it at one place alone - online
  a letter goes into no room's container or body, and one already lying there is dropped (no one can tell it from a
  forged one) - asked, and kept. Coins on a peer's word: asked, they stay. Left for Mac, on the page: the budget's
  `enforce` (what a measured week leaves behind - no debt, a rollback that cannot reach it - and, the coins staying, an
  honest taker of a forger's coin held by it), a hall's decor asking no hold, a boat's records on a peer's word.
- **CRAFT-HOLD (2026-10-11, the exploit audit; its review the same day): the hold follows the piece.** `realm.js`
  craftHoldOf - a HOLD (never `record-unjudged`) of the account's realm character a crafted piece's maker record names
  (`products.char_id`, or the offline character a customs character came in as, `origin_id`) - asked by the list, the
  auction, the commission fill (which asked no hold at all) and the disenchant (where no record proves the piece the
  actor's own), whatever character the act names: a held character's craft had listed for Drakes under `char-anything`.
  Its review added: a held character with pieces of its make at the account is not deleted (its row is where the hold
  lives; one with none goes, its Stores with it), and the guild Stores deposit and the guild writ supply ask the hold
  (they asked none). `ACCOUNT_VERSION` acct116 (acct115 on its branch, renumbered past BR5 at the merge).
  `test/server/crafthold.test.js` (7); `tools/mutants/crafthold.json` (15, all dead). Record:
  `01-Overview/audits/Exploit-Audit-2026-10-11.md`.
- **INT1-INT6 (2026-10-09): lane 1, the economy - built, and audited (4b).** Migration `0096_integrity`;
  `ACCOUNT_VERSION` acct100 (acct99 and migration 0095 on its branch, renumbered past main's CARDS9 and CARDS10 at the merge). Pins: `test/systems/item/int1_itemlaw.test.js`, `int2_judge.test.js`, `int4_itemids.test.js`,
  `int5_budget.test.js`, `int6_review.test.js`, and `accountdeploy.test.js`'s Worker load; the honest sweep
  `test/honestItems.mjs` over DFU's own magic table (`test/dfuMagicItems.mjs`). Mutants `tools/mutants/int1.json`,
  `int2.json`, `int4_int5.json` and `int_audit.json`: 111, all dead (the arc's two that first survived - a weapon's row on
  armour, a soul's set without its soul - held since by cases the one rule refuses and controls the maker lays). Pins moved (each marked PIN MOVED where it stands): saves the judge reads honest in the realm
  pins (a level in every save, a tile claiming the save's own level, crafted pieces' `products` rows of their own
  template, a peer's piece in its group), the checkpoint's answer carrying `tradeHeld`, the last clean save kept past the
  rotation, the race pin's join moved to the checkpoint's batch, the version pins at acct100. The account Worker bundles the
  item law's graph (`.github/workflows/account-deploy.yml` lists it, `test/server/accountdeploy.test.js` holds the list).
- **INT7-INT10 (2026-10-09): lane 2, PvP refereed everywhere - built, and audited (5b).** Migration `0104_referee` (the arms on the row, a
  duel's receipt's bout id, a death's drop's falls); `ACCOUNT_VERSION` acct104 and `RELAY_VERSION` world185 (acct101 and
  migration 0097 on its branch, renumbered past main's BAG-CRAFT at the merge; then acct102, migration 0098 and world183,
  renumbered past the Chapters' acct103, migrations 0098-0103 and CHAP4c's world183 at the next; then world184, past
  PERF-RELAY1's). Pins: `test/net/arena/int7_arms.test.js`,
  `int8_duel_ref.test.js`, `int9_wild_ref.test.js`, `int10_spells.test.js`. Mutants `tools/mutants/int_lane2.json`:
  122, 120 dead and 2 equivalent as recorded (a fallen struck - the referee refuses it itself; a coin put back that always
  fits) - its audit's (5b) among them, each survivor of the run pinned since; the records INT7-INT10 moved re-aimed by content (38 - 36 dead, 1 equivalent as recorded,
  `test/net/relayversion.test.js`'s own judged with its row), fifteen of DUEL1's retired with their laws. Pins moved (each
  marked PIN MOVED where it stands): DUEL1's and WILD1's defender, gift and loser's report, the duel's heal and trail,
  the deposit that needs the service's order, the token's `wa`, the order kinds, the hour's sweeps (twenty), the version
  pins at acct104 and world185. The account Worker bundles the zone's drop law (`.github/workflows/account-deploy.yml`).
- **INT11-INT15 (2026-10-10): lane 3, boss fights - built, measuring first (section 6).** Migration `0105_body` (each
  boss kill's row keeps the relay's measure); `ACCOUNT_VERSION` acct105 and `RELAY_VERSION` world188 (world186 on its branch, renumbered past SD-HERALD's world186
  and WAGONS1's world187 at the merge of main; `net/bossBody.js`,
  `net/bossRef.js`, `net/gate/gateStrike.js` with `world/segment.js`, and `systems/serpent/serpentStrike.js` join the relay's bundle;
  `net/bossBody.js` the account Worker's, through the receipts). Pins: `test/net/int11_body.test.js` (the law and the three
  judges), `test/net/int12_body_relay.test.js` (the relay over the real Room, measured and enforced; the receipts; the
  service and the review; the client's glue). Mutants `tools/mutants/int_lane3.json`: 92, all dead - the run's five
  survivors each pinned since (a sweep read at one end; the relay's pose trail; a wreck's volleys, which a lone ship's
  wreck had hidden by taking the serpent's last health out with her share; the review's lost receipts; world188 the
  first relay that counts); the nineteen older records the lane moved re-aimed by content, all dead. Pins moved (each marked PIN MOVED
  where it stands): the gate's, the Abyss Dungeon's and the serpent's word kinds (`vt` in, `bd` out), the Hour's census
  and its receipts' and the gate's receipts' mint by source, the version pins at acct105 and world188.
  AUDITED (6b, 2026-10-10): `test/net/int_lane3_audit.test.js` (16); mutants `tools/mutants/int_lane3_audit.json`: 46, all dead
  (two first survived and are pinned since); fourteen older records re-aimed by content, all dead; world188 re-hashed in
  place (undeployed); pins moved in `int11_body`, `int12_body_relay`, `gateheal`, `sd8b_fight` and `sd20a_fight`.
