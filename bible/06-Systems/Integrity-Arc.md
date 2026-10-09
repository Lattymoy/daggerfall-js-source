# THE INTEGRITY ARC: nothing another player can see, take or be ranked against stands on a client's word (INT)

Mac, 2026-10-09, handing on a player's private report (the Discord, Vedgy): "almost all of the game is client
authoritative ... you can download the source code and modify your client to ... disable taking damage, needing spell
points, or using fatigue; do infinite damage in PvE and max damage in PvP; spawn any items you want and as much gold as
you want". Read against the code, then: "I want to do everything and do it properly".

**Status: lane 1 (the economy, INT1-INT6) BUILT on its branch (2026-10-09).** Lanes 2-4 are the plan below, each its own
pull request (Mac: "A PR per lane").

## 1. What the report found, read against the code

The report is right on its main charge. Three read-only audits of this tree (2026-10-09) found:

| Charge | Where it stood | Evidence |
|---|---|---|
| No damage, free magicka, no fatigue | TRUE in solo, co-op, duels, the wild zone and every boss fight: no server ever holds a player's health, magicka or fatigue. FALSE in the arena, a siege and the Royal Tourney (PVP-REF holds both fighters). | duels and the wild zone resolve on the defender's own machine (`net/wire.js` "THE DEFENDER RESOLVES IT", `net/wildFight.js`); a boss "never learns who was struck" (`net/gateStrike.js`, `net/serpentBrain.js`, `net/sdRemnant.js`) |
| Infinite damage in PvE | EFFECTIVELY: a co-op blow is taken up to 10,000 (a kill). A boss's blows are clipped by a cap and a bucket (`net/gateBrain.js`). A raid's kills are the client's word, one a second. | `scenes/dungeonContext.js` HIT_DMG_MAX; `net/raidLaw.js` |
| Max damage in PvP | PARTLY: the arena's cap reads the weapon the CLIENT names; a duel's or the zone's blow is never refereed at all, and a spell there has no cap. | `net/arenaBrain.js` arenaBlowCap; `net/siegeRef.js` siegeHeld |
| Any item, any gold | TRUE, AND IT REACHED OTHER PLAYERS: a realm character's checkpoint was read at its first save alone (customs' wealth) and stored unopened after; the market, a realm trade, a guild's vault and treasury, a rent and a card table's stake took goods and gold from that record as the truth; the market's listing check never asked whether the piece was one the game mints. | `server-account/src/realm.js` firstSaveRefusal; `06-Systems/Economy-Arc.md`: "'Assume infinite wealth' is already literally true" |

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
lawful, at the rate a very good honest player earns. It cannot invent impossible pieces, copy pieces, gain faster than
play allows, or carry any of it to another player while the judge holds it.

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
- **the enchantments:** rows the catalogue knows; an artifact's power on an artifact alone; on a piece no MAGIC.DEF made,
  only the rolled flavour, a record's own row and a curse's drawback; the item maker's rows within the maker's law (its
  groups, a weapon's effect on a weapon, one of a kind where the kind allows one, no excluded pair, a soul's forced set
  whole beside its soul) and their CATALOGUE cost - never the cost a row says of itself - within the item's power;
- **the rest:** a Broker's price only with its binding, a craft's provenance and quality, a potion's potency, a card the
  catalog prints, a poison only on a blade, a soul only in a trap, an artifact's index and the skeleton key's picture only
  on an artifact, a conjured item only of Create Item's rows, a classic flag only with a classic record.

**What it cannot prove:** a DFU magic item's rows, uses and price are MAGIC.DEF's and SPELLS.STD's - the player's own
ARENA2, which this tree never carries (Port-Doctrine). Those are held to what holds for every row (the classic range, the
artifact's power on an artifact) and bounded by the budget and the ids, never proven.

**Value is not a finding:** honest prices sit on both sides of any formula (a book's printed price, a shelf potion at
double, a deed at its house). `itemWorth` - what the wealth measure counts - takes the smaller of the price and a generous
ceiling (`worthCeiling`); a forged price buys gold only at a counter, and gold is the budget's to bound.

**Pinned against the producers themselves:** `test/honestItems.mjs` mints through every item home this tree has - 108,126
items from 83 producers at its full setting: every loot table at every level, the ladder at every source with its last,
curse and socket passes forced, every foe's kit and death, the spoils, 400 of the Broker's days, every Aetheric and Gilded
record, the Reforge's reforge, hone, gem and imprint, every shop at every quality, chargen for every class and race, all
815 recipes at every quality, the item maker driven as its window drives it, and every port item home - and
`test/int1_itemlaw.test.js` asserts no finding on any of it, in the save and on the wire. The first sweep found six
places the law disagreed with honest play, each fixed in the law or the schema, never in the producer: a food stage's
textures written `undefined`; the maker's single-setting arm adding a many-instance effect twice; the maker enchanting a
Dwemer Pellet (its window refuses only the Arrow); gold piles past the wire's bound; a quest's gold stack; and
`itemFields.js` validRepairData refusing every honest repair ticket (its shop key is a number) - a wire bug the law found.

### INT2 - every checkpoint judged (`server-account/src/judge.js`, `verdict.js`)

`checkpointRealm` opens every checkpoint (never the first alone) and the verdict lands in the batch that moves the row,
so a checkpoint that loses its race writes no verdict either:

- **the character law:** a level the realm reads; a tile claiming the save's own level when it claims one (the tile's
  level is the token's `cl`, which the ladder's health reads); attributes to `MAX_STAT_VALUE`, skills to `SKILL_HARD_CAP`;
- **every item** wherever it lies (`judgedItemLists`: the pack, the wagon, the bag, the furnisher's and the repairer's
  lists, and every list customs reads), each finding named with its list and place;
- **a craft's provenance** against the service's own `products` - one the service never minted, or minted for another
  template, is no craft;
- **the wealth** (`wealthOf`): the purse, the banks less their loans, the deeds, and the worth of what the character OWNS
  (`ownedItemLists` - its own lists, its drops, its storage and its rooms' chests, its boats and companions), never the
  world's loot it has not taken (a dungeon's chests ride the scene cache from the moment it is entered); a bound piece and
  a quest's piece worth nothing.

The answer says the hold (`tradeHeld`); the client's session keeps it and tells the player as it moves
(`systems/realmSaves.js` onTradeHeld, `systems/itemIds.js` tradeHeldNotice). The cutover (decision 3): the first
judgement is the baseline; a wealth past `OUTLIER_ALLOWANCES` of the level's customs allowance is flagged `outlier`.

### INT3 - the hold

`held` on the character's row, with its reason in order - staff's, the law's, the duplicates', the budget's
(`verdict.js` holdOf). The law's lifts at the next clean checkpoint until `STRIKES_FOR_REVIEW` (3) checkpoints carried a
finding; then, as the duplicates' and staff's, only staff lift it. Every route that hands a realm character's value to
another player says so - `prepareRealmRecord(..., { outbound: true })`: a market listing and purchase, a vault deposit, a
treasury deposit, a rent, a card table's stake, a disenchant (its Essence the market sells) - and is refused
`trade-held` while held, `record-unjudged` for a record no checkpoint has been judged since INT2 shipped (the tab
checkpoints before every act, so only a client skipping that meets it). A realm trade refuses a side that gives while
held. `test/int2_judge.test.js` sweeps the service's source: no `prepareRealmRecord` that takes goods or gold out without
`outbound`, the three sinks aside (a home and its decor bought from the realm, a guild founded).

### INT4 - the ids and the duplicate ledger (`systems/itemIds.js`, `verdict.js` ledgerStep)

A valuable piece - a tier the ladder rolls or records, a DFU magic item or artifact, a craft, a letter of credit; never a
stack, a bound piece or a quest's - is given a 16-hex `uid` at the realm checkpoint that first sees it in the character's
own lists (`stampItemIds`, `scenes/world.js` realmCheckpoint). The wire carries it (a declared field, never stripped). The
service's `item_uids` keeps whose record held each id last: a new id taken; one let go and shown by another record moved
(no witness needed - a drop, a chest, a peer's hands); one shown while its holder still holds it CONTESTED, settled by the
holder's next checkpoint - gone, it moved; still there, a DUPE. An id twice in one record is a dupe at once. A dupe is
moved by no route again (`piece-dupe`, `realm.js` anyDupe), and `DUPES_FOR_HOLD` (3) duplicates hold the character for
staff. The client minting its ids buys a modified client nothing: a copy keeps its original's id, and a copy given a fresh
one is a new find the budget charges.

### INT5 - the wealth budget (`server-account/src/budget.js`)

Between two judgements the wealth may rise by what the service saw move in the open (`witnessed`: every service-made
change to a record - `prepareRealmRecord`, the trade's settle - adds what it moved) and by a bucket (`allowance`) that the
account's played seconds fill at the level band's rate up to its cap (`players.played_s`, measured by the service itself;
the join sets `played_at`, so time on another character fills nothing). A gain no witness explains spends it. A signed win
(a gate's, a raid's, a serpent's, an Abyss Dungeon's receipt, recorded) fills it by `spoilsGrant`. Every hour's unexplained
gain and loss and the seconds played are kept (`realm_wealth_hours`).

**MEASURE first:** `BUDGET_DEFAULT.enforce` is false; a gain past the bucket is a `measure` finding, and nothing is held.
`tools/realmReview.mjs budget 7` reads each band's quantiles of gold an hour of play and who the line standing would have
held; `budget-set` writes the line and `enforce: true`. From then a gain past the bucket holds the trade ('budget') until
play pays it back. The first numbers (`BUDGET_DEFAULT`) are a guess the measure exists to replace - **OPEN**, every one.

### INT6 - the review (`server-account/src/review.js`, `tools/realmReview.mjs`)

A developer's alone: `/v1/mod/realm-holds` (the held and flagged, each with its last finding), `realm-findings` (a
character's findings and its wealth by the hour), `realm-clear` (a hold and its strikes lifted, a flag cleared),
`realm-hold` (a hold by hand), `realm-rollback` (the record back to its last checkpoint judged clean - kept past the row's
rotation by `checkpointRealm`, `prepareRealmRecord` and the trade - its seat taken from any tab so the next join loads it)
and `realm-budget` (the measure, and the config). Every act is written among the character's findings with who did it.
The cron sweeps findings past 90 days and the hours past 30.

### What lane 1 leaves open

- Peer channels - a shared chest, a shop's shelf, a body's grant, the wild zone's remains - still move lawful pieces
  between clients unwitnessed. What enters a realm character's record that way is charged to its budget, and the ids catch
  a copy; a lawless piece no honest client takes (the wire's door is the law's). Container locks (Realm-Arc phase 2) stand
  as planned.
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

- **INT1-INT6 (2026-10-09): lane 1, the economy - built.** Migration `0095_integrity`; `ACCOUNT_VERSION` acct99. Pins:
  `test/int1_itemlaw.test.js`, `int2_judge.test.js`, `int4_itemids.test.js`, `int5_budget.test.js`; the honest sweep
  `test/honestItems.mjs`. Pins moved (each marked PIN MOVED where it stands): saves the judge reads honest in the realm
  pins (a level in every save, a tile claiming the save's own level, crafted pieces' `products` rows of their own
  template, a peer's piece in its group), the checkpoint's answer carrying `tradeHeld`, the last clean save kept past the
  rotation, the race pin's join moved to the checkpoint's batch, the version pins at acct99. The account Worker bundles the
  item law's graph (`.github/workflows/account-deploy.yml` lists it, `test/accountdeploy.test.js` holds the list).
