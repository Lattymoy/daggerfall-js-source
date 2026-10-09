# THE INTEGRITY ARC: nothing another player can see, take or be ranked against stands on a client's word (INT)

Mac, 2026-10-09, handing on a player's private report (the Discord, Vedgy): "almost all of the game is client
authoritative ... you can download the source code and modify your client to ... disable taking damage, needing spell
points, or using fatigue; do infinite damage in PvE and max damage in PvP; spawn any items you want and as much gold as
you want". Read against the code, then: "I want to do everything and do it properly".

**Status: lane 1 (the economy, INT1-INT6) BUILT on its branch (2026-10-09), and AUDITED the same day (section 4b: five
reviews, every fix pinned).** Lanes 2-4 are the plan below, each its own pull request (Mac: "A PR per lane").

## 1. What the report found, read against the code

The report is right on its main charge. Three read-only audits of this tree (2026-10-09) found:

| Charge | Where it stood | Evidence |
|---|---|---|
| No damage, free magicka, no fatigue | TRUE in solo, co-op, duels, the wild zone and every boss fight: no server ever holds a player's health, magicka or fatigue. FALSE in the arena, a siege and the Royal Tourney (PVP-REF holds both fighters). | duels and the wild zone resolve on the defender's own machine (`net/wire.js` "THE DEFENDER RESOLVES IT", `net/wildFight.js`); a boss "never learns who was struck" (`net/gateStrike.js`, `net/serpentBrain.js`, `net/sdRemnant.js`) |
| Infinite damage in PvE | EFFECTIVELY: a co-op blow is taken up to 10,000 (a kill). A boss's blows are clipped by a cap and a bucket (`net/gateBrain.js`). A raid's kills are the client's word, one a second. | `scenes/dungeonContext.js` HIT_DMG_MAX; `net/raidLaw.js` |
| Max damage in PvP | PARTLY: the arena's cap reads the weapon the CLIENT names; a duel's or the zone's blow is never refereed at all, and a spell there has no cap. | `net/arenaBrain.js` arenaBlowCap; `net/siegeRef.js` siegeHeld |
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

### INT1 - the item law (`src/systems/itemLaw.js`)

One answer to "could an honest client of this port have minted this item?", asked by both ends: the account service of
every item a realm checkpoint holds and every piece a listing, a trade or a vault takes, and the client of every item a
peer hands it (`systems/loot.js` validLootItem, through `setItemLaw` - the law registers itself there, so the loot module
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
record's (`REGULAR_MAGIC_TYPES`, `ARTIFACT_RECORDS`, held to the file by `test/int1_itemlaw.test.js` through
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
`test/int1_itemlaw.test.js` asserts no finding on any of it, in the save and on the wire. The first sweep found six
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
onTradeHeld, `systems/itemIds.js` tradeHeldNotice). The cutover (decision 3): the first judgement's baseline is the
record the realm ALREADY HELD for the character, read once from R2 - never the save the first judged checkpoint brings,
which is charged for what it adds like any other (the audit: the first judged save could hold anything, and was the
baseline); a new character's baseline is a newborn's purse, a customs character's its level's allowance. A wealth past
`OUTLIER_ALLOWANCES` of the level's customs allowance is flagged `outlier`. The verdict's reads run before the save's
object lands, so a read that fails leaves nothing in R2.

### INT3 - the hold

`held` on the character's row, with its reason in order - staff's, the copies', the law's, the budget's (`verdict.js`
holdOf). Staff's and the copies' are staff's alone to lift - a breach of the law over a copies' hold is no way out (the
audit: a 'law' checkpoint stepped it down, and the next clean one lifted it). The law's lifts at the next clean
checkpoint until `STRIKES_FOR_REVIEW` (3) HOLDS have come - a strike a hold, never a checkpoint (the audit: one piece
carried six minutes was staff's); its finding is written once a signature. Staff who judge the law's word wrong clear it
(`law_excused`): the same signature holds nothing again, a new one does. A verdict writes over the row only as it read
it (`judge_rev`): a staff act, or a copy another's checkpoint charged, landing in between stands, and the next checkpoint
judges again.

Every route that hands a realm character's value to another player says so - `prepareRealmRecord(..., { outbound: true
})`: a market listing and purchase, a vault deposit, a treasury deposit, a rent, a card table's stake, a disenchant - and
is refused `trade-held` while held, `record-unjudged` for a record no checkpoint has been judged since INT2 shipped. A
realm trade refuses a side that gives with its own word. The routes that hand on what a character owns AT the service,
its record untouched - a crafted piece listed or auctioned, its Stores' units listed or sold into an order - ask the
same hold (`realm.js` realmHoldOf; the audit: a held character listed its craft for 900,000 gold). A piece listed or
vaulted before the law read listings is read as it is bought or taken, and goes to nobody if the law refuses it.
`test/int2_judge.test.js` sweeps the service's source: no `prepareRealmRecord` that takes goods or gold out without
`outbound`, the three sinks aside (a home and its decor bought from the realm, a guild founded); `test/int6_review.test.js`
holds the routes over HTTP, each refusal its 409.

### INT4 - the ids and the ledger (`systems/itemIds.js`, `server-account/src/ledger.js`)

A valuable piece - a tier the ladder rolls or records, a DFU magic item or artifact, a craft, a letter of credit; never a
stack, a bound piece or a quest's - is given a 16-hex `uid` at the realm checkpoint that first sees it in the character's
own lists (`stampItemIds`, `scenes/world.js` realmCheckpoint). The wire carries it. The ledger's key is a crafted piece's
PROVENANCE (the service minted it; no client mints a fresh one) or the piece's `uid`; beside it the piece's print (its
template and material) - an id on another piece is no claim to it, and the record showing it holds a forged id (a law
finding).

**The first holder keeps it.** The record that shows a key first holds it; another record showing it while the holder
still does CLAIMS it. The holder's checkpoint without it moves it to the claimant (a drop, a chest, a peer's hands - no
witness needed); still with it past `DUPE_GRACE_S` (300 s), the claim was a COPY: the CLAIMANT counts it (`dupes` on its
row; `DUPES_FOR_HOLD`, 3, hold its trade for staff), its copy is written down (`item_dupes` - that piece moves by no route
from it, and is never charged twice), and the holder's piece stays the holder's to sell. A crafted piece's copy is told
by its craft's record: the account `products` names owns it, so a seller that kept a sold piece is the copier, never the
buyer. A piece shown twice in one record is that record's copy at once. A piece let go is no row (a row kept `gone` only
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

The audit's corrections, each pinned (`test/int5_budget.test.js`): the first judgement CHARGES what a save adds to its
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

### INT6 - the review (`server-account/src/review.js`, `tools/realmReview.mjs`)

A developer's alone: `/v1/mod/realm-holds` (the held and flagged, each with its last finding), `realm-findings` (a
character's findings and its wealth by the hour), `realm-clear` (a hold and its strikes lifted, a flag cleared, the law's
finding standing excused, the bucket refilled), `realm-hold` (a hold by hand), `realm-rollback` (the record back to its
last checkpoint judged clean - kept past the row's rotation, and carried forward by a service move made ON a clean record
- its seat taken from any tab so the next join loads it; never past a move the service made since (`service-moved`: a
sold piece would come back and stand sold), never for the dead, its size the clean save's) and `realm-budget` (the
measure - asked of the database a quantile at a time - and the config, kept an isolate a minute). Every act is written
among the character's findings with who did it, and moves the row's `judge_rev`. The cron sweeps findings past 90 days
and the hours past 30.

### 4b. The audit (2026-10-09, Mac: "Lets do a comprehensive audit on this")

Five reviews ran on lane 1 as first built: the service's correctness and races, a modified client's ways round it, the
false findings against honest players, Cloudflare's limits, and the tests and the docs. What they found, and where each
fix is told above: the ledger's statements unbounded and its charge on the wrong record, a victim's id a way to freeze
them (INT4); a forged loan and the first judged save as two ways past the budget, a grant clamped away, the measure's debt,
a claimed level paying spoils (INT5, INT2); a copies' hold stepped down by a breach, strikes counted by the checkpoint,
staff's hold written over (INT3); a rollback past a sale (INT6); the market's crafted pieces and Stores past the hold, and
old stock (INT3); DFU's magic and classic pieces unproven, a worth of nothing (INT1); the lifted curse and a person's soul
found, the wire dropping whole lists, the shop's shelf judged, the budget charging a house's own pieces, a street's
piles, a rented room's chest, a craft and a market purchase (INT1, INT2, INT5); the item law's graph carrying a module
that makes URLs from `import.meta.url` as it loads into the Worker (`comeSailAwayModels.js`, through the boats' items - a
start the deploy would refuse: the hull table moved to `systems/comeSailAwayHulls.js`, a leaf, and
`test/accountdeploy.test.js` bundles the Worker with `import.meta.url` undefined and loads it); an O(n^2) walk on every
route's ids. Mutant records `tools/mutants/int_audit.json`; the arc's own records re-aimed.

### What lane 1 leaves open

- Peer channels - a shared chest, a shop's shelf, a body's grant, the wild zone's remains - still move lawful pieces
  between clients unwitnessed. What enters a realm character's record that way is charged to its budget, and the ledger
  catches a copy that keeps its key; a lawless piece no honest client takes (the wire's door drops it). Container locks
  (Realm-Arc phase 2) stand as planned.
- **Customs** brings an offline character's items in whole (RESTORE, "Keep all"); its first judgement charges what they
  add past its level's allowance to the budget, which holds nothing until staff turn it on.
- A piece's id rides only the character's own five lists' stamping: a piece set out in a room or kept in a chest since
  before INT4 carries none until it comes back to the pack, and the ledger does not follow it there.
- A temper's or a Reforge's rise in a piece's worth is charged to the budget (small; the service knows the step, not
  the worth).
- The online power rules (Realm-Arc section 5: the item maker's 25% side-effect cap, one Extra Spell Points per item, the
  rest) are balance, not integrity: the law takes what the live maker makes, and moves when those rules ship.

## 5. Lane 2 - PvP refereed everywhere (planned)

- **The gear in the token.** The account service signs the equipped weapon, its material and the worn armour - read off
  the JUDGED record - into the identity token; the arena and the siege referee take a blow's cap from it, never the
  look's claim (`net/arenaBrain.js`, `net/siegeRef.js`). The ladder's level is the judged save's.
- **Duels under PVP-REF.** A duel is the Royal Tourney's ring without its title: the relay holds both fighters' health and
  judges every blow, cast and step; the result is a relay-signed receipt, and `reportDuelLoss`'s self-report retires.
- **The wild zone under PVP-REF.** The relay holds health in the zone; a fall is the relay's word; the dropped goods are
  taken by the service from the fallen character's judged record against the receipt, never handed over by the fallen
  client.
- **Spells between players** capped by the referee, as the arena's are.

## 6. Lane 3 - boss fights (planned)

The relay holds each player's health in a gate, a serpent fight and an Abyss Dungeon and judges the boss's blows against
the poses it already holds (`net/gateStrike.js`'s test, run where the client cannot skip it). A player the relay counts
fallen is fallen - the spoils' "alive through half the fight" is the relay's word.

## 7. Lane 4 - progression claims (planned)

Renown XP, Marks from finds and harvests, bounty camps, seat influence, profession XP and raid kills: accepted only from a
seated realm character whose trade is not held, each cap per hour of PLAY the service measured rather than per hour of
the clock, and the legacy record held to its own law.

## Progress

- **INT1-INT6 (2026-10-09): lane 1, the economy - built, and audited (4b).** Migration `0095_integrity`;
  `ACCOUNT_VERSION` acct99. Pins: `test/int1_itemlaw.test.js`, `int2_judge.test.js`, `int4_itemids.test.js`,
  `int5_budget.test.js`, `int6_review.test.js`, and `accountdeploy.test.js`'s Worker load; the honest sweep
  `test/honestItems.mjs` over DFU's own magic table (`test/dfuMagicItems.mjs`). Mutants `tools/mutants/int1.json`,
  `int2.json`, `int4_int5.json` and `int_audit.json`: 111, all dead (the arc's two that first survived - a weapon's row on
  armour, a soul's set without its soul - held since by cases the one rule refuses and controls the maker lays). Pins moved (each marked PIN MOVED where it stands): saves the judge reads honest in the realm
  pins (a level in every save, a tile claiming the save's own level, crafted pieces' `products` rows of their own
  template, a peer's piece in its group), the checkpoint's answer carrying `tradeHeld`, the last clean save kept past the
  rotation, the race pin's join moved to the checkpoint's batch, the version pins at acct99. The account Worker bundles the
  item law's graph (`.github/workflows/account-deploy.yml` lists it, `test/accountdeploy.test.js` holds the list).
