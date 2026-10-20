# FIELD BUGS 2026-10-18b - "Letter of Credit vanishing from wallet"

One thread from the Discord's #bug-reports, handed over as a screenshot. shaman: *"I LOST NEARLY 2 million worth of
GOLD in letter of credits, they simply VANISHED from my wallet, i wish i had proof but this seriously cannot OVERLOOK"*,
then *"i grinded tens of dungeons for daedric items to sell just for it to simply vanish cuz the game is bugged? ... all i
have left is this"* over the Bank of the Empire's window. Online. Read on the code as it stands at main's `138604baa`.

The wallet (`06-Systems/Wallet.md`, WALLET1) holds nothing of its own: it shows the letters of credit in the pack
(`entity.items`, template 275), so a letter "vanishing from the wallet" is a letter that left the pack. Every door that
takes one out was read, the client's and the account service's. One takes letters the player never chose to give and is
a bug (LETTERS-HOME, below). One takes them by a law the owner chose but SAID NOTHING (BURNT-SAID, below). One spends
every letter on a price that is no number (NO-NAN-PAY, below). And the counter the reporter sold at could pay a big lot
of Daedric pieces as millions of gold BELOW nothing (TRADE-WRAP, below) - the sale itself vanishing. The others are the
player's own acts or a law the owner chose, said where they happen. Which of them took this player's letters is not
proven: the report names no death, no deposit and no sale's price. What would prove it is under "What would prove which
door it was", below.

| | Door | What it does to a letter | Verdict |
|---|---|---|---|
| 1 | A revenant's kill (RVN8, `revenant.js revenantTakes`) | took one of the pack's five most valuable pieces - and a letter, worth its face, is the most valuable piece a pack holds | **BUG - LETTERS-HOME, fixed** |
| 2 | A death in the open zone (WILD1, `wildDropLaw.js wildCanLose`) | every letter drops into the remains, most valuable first, takeable by anyone for ten minutes after the respawn's wait | the owner's law (LETTERS-DROP, 2026-10-09: "letter of credits should be dropped") - unchanged; the letters now named on the death screen (BURNT-SAID) |
| 2b | The same death, the record HELD (`server-account/src/wild.js`, Lane 1's freeze: `burnt`) | every letter taken off the record and laid nowhere - and the death screen said nothing | the freeze is the arc's law, unchanged; **the silence a bug - BURNT-SAID, fixed** |
| 3 | The bank's Deposit LOC (`banking.js depositAllLetters`) | every letter at face into the Empire's account; a defaulted loan garnishes it | DFU's DepositAll_LOC - the gold is in the account |
| 4 | A payment the coins cannot cover (`court.js deductGold`; the service's `realmGoldLaw.js payFromSave`, pinned equal) | the letters pay first, then the coins (DFU's DeductGoldAmount); what the service pays back (a card table's cash-out, a home sold, rent) goes to the bank | DFU's order; every caller gates on coins plus letters |
| 4b | The same, given a price that is no number (`court.js deductGold`) | every letter spent, the coins kept, "paid" answered | **BUG - NO-NAN-PAY, fixed** (no producer of such a price was found) |
| 4c | A counter's sale of a big lot (`shopStock.js calculateTradePrice`) | the price wrapped int32: millions of gold below nothing into the purse, after which every payment draws on the letters | **BUG - TRADE-WRAP, fixed** |
| 5 | A staff rollback or repair (`server-account/src/review.js`) | the record goes back to its last clean checkpoint | staff's act, recorded in `realm_findings` |

## LETTERS-HOME: a revenant never takes a letter of credit

FOUND. RVN8's law (`12-Enhanced-AI/Feud-Arc.md` section 19, `06-Systems/Revenants.md` section 24) says a revenant that kills
the player takes one piece, "never a quest item, a summoned piece, the Materials Bag, gold or a locked piece". The code
read "gold" as the coin alone (`isGoldPieces`), and a letter of credit IS gold - its `value` is the gold it stands for, and
HACKED-GOLD treats it so everywhere else (`itemLaw.js` GOLD-INT, `peerWord.js`, the judge's wealth). So a letter was
takeable. The pick (`pickTaken`) draws among the equipped weapon and the five most valuable takeable pieces, by
`itemValueOf` - a letter's face - so a pack carrying letters from a run of daedric sales offered them as most of the
pool. A revenant holds three. Reproduced on the real module: a pack holding an equipped longsword, a dagger and three
letters of credit (650,000, 700,000 and 600,000) drew a letter on 583 of 1,000 ids (three of the pool's five), and 0 of
1,000 with the fix. The pins' take test is red on the unfixed law: three kills took letters out of the pack, onto the
record and into the standing body.

A letter taken that way was hard to get back. A slain body hands over what it carried, but only to its owner
(`bodyLoot.js:"if (!piece || neverPeerHanded(piece)) return null;"` - a letter never rides a peer's word). A fallen
record whose body never carried it kept it for good, and one that escaped kept it.

CHANGED:
- `revenantMayTake` refuses a letter of credit (`revenant.js:"export const revenantMayTake = (item) =>"`, through
  `peerWord.js isLetterOfCredit`, the one test HACKED-GOLD reads). The pick, the take and a deserter's or a betrayer's
  split (`splitPack`, which asks the same law) all follow it. A deserter's letter now comes back to the pack with its gold.
- A letter a record already holds comes home at the mirror's merge (`ensureMirror`, the first ask after a load). It is
  read off the save's own copy of `took`, as RVN8 already reads it. That pack is the one the letter came out of, so it
  is never handed back twice. Living records, fallen ones whose body never carried it, and deserters are all covered.
  The record's other pieces stay its own.
- DECIDED here, named: the letter is handed back silently at the load, as AUDIT FEUD's hand-back on the line above it is
  (`revenant.js:"if (player && s?.took?.length && !s.defeated && !s.sworn && (r.gone || r.defeated || r.sworn))"`). It
  is the player's own letter returning to their wallet, not a find.
- Not changed: the wealth measure (`server-account/src/judge.js wealthOf`) never counted a revenant's `took`. A letter
  coming home therefore reads as a gain at the next checkpoint, as a piece won back off a revenant's body always has.
  The budget measures it and enforces nothing unless staff turned `enforce` on (`budget.js` BUDGET_DEFAULT).

THE FOUR HOSTS: no host line. The law and the merge are `systems/revenant/revenant.js`. The take runs at
`world.js respawnOnlinePlayer` (worldModes.js and dungeonContext.js die through it). exterior.js has no online respawn,
so it takes nothing, as Feud-Arc section 32 records.

Pinned by `test/systems/revenant/fb1018b_letters.test.js` (4): the law over the shop's, the bank's and the service's
letters; the pick and three kills' take through the real door (no letter drawn, taken, on the record or in the body,
the pack's letters whole); the deserter's letter back; and the load (a living and a fallen record each holding a letter
from before; both come home from the save's copy, the sword stays the revenant's, and a second load brings none
twice). `tools/mutants/fb1018b_letters.json` (3, all dead).

## BURNT-SAID: a held record's drop is said, and every zone death names its letters

FOUND (the service read, lane 2's freeze). A record the judge holds (`realm.js holdRefusal`: a law finding, the budget
once enforced, staff, or a record never judged) still loses its drop at a death in the zone, and the room is given none
of it (`server-account/src/wild.js`, `burnt`, no order - Integrity-Arc, Lane 1's freeze). The service's answer said
`burnt: true`; the fallen's game read no such word. It took the drop out of the pack (`wildTakeTook`) and set the death
screen's count to the order's (`dropped: d.order ? n : 0`), and the screen prints no line for none. So a held
character's letters - every one, most valuable first - left the wallet with nothing said at all. Holds were reported
the day before this report (KEY-LAW, `Field-Bugs-2026-10-17.md`: new characters held over their Weir Key), and a run of
sales worth ~2,000,000 is the gain the wealth budget is built to notice. Reproduced through the real service: a held
record dying to a foe with two letters (650,000 and 700,000) answered `burnt`, no order; both left the pack, and the
death screen's lines were the two-minute wait alone.

CHANGED:
- The death screen says it (`wildZone.js:"deathBurnt: (n) =>"`): "3 things you carried were lost where you fell - this
  character's trading is frozen, so nothing is left for anyone to take." A fall that found the fallen risen says the
  held case its own way (`burntLate`). The three lines go through the text core (L10N4: `wild.death.burnt`,
  `wild.death.letters`, `wild.death.burntLate`), in the English catalog (`tools/l10nExtract.mjs`) and drafted in-session for
  the thirteen languages that cover it whole (`tools/l10nInSession.mjs`, recorded as the machine's).
- Every death in the zone names the letters of credit it took, by their worth (`wildZone.js:"deathLetters: (n, gold) =>"`):
  "2 letters of credit worth 1,350,000 gold left your wallet." A letter's loss was "a thing you carried", whatever it
  stood for.
- The host hands both on in its one line, in place (`world.js:"if (dd) setWildDeath({ killer: dd.killer, dropped: d.order ? n : 0, claimed, held, burnt: d.burnt ? n : 0, letters: out });"`) - no line added: the host does not grow.
- Not changed, PUT TO THE OWNER: whether a held record's drop should burn at all. The freeze's reason holds (a held
  character hands no value to another player), but a hold can be the law's mistake (INT2: "the player loses nothing
  they played, because a finding can be the law's mistake"), and the burn is a loss no later clean checkpoint gives back.
  Keeping the drop on the fallen would honour both; it is the arc's call, not this fix's.

THE FOUR HOSTS: world.js WIRED (the answer's one reader). dungeonContext.js (the zone's halls) dies through world.js's
`wildDropTaken` and reads the same death screen. worldModes.js has no fight in the zone (the zone word is 0 indoors).
exterior.js is offline, and the zone is online alone, NOT WIRED on purpose (Wild-Zone.md).

Pinned by `test/systems/fb1018b_burntsaid.test.js` (3): the held death and the clean one through the real service and
the fallen's own take-out, and the words, the host's line and the risen line. `tools/mutants/fb1018b_burntsaid.json`
(4, all dead). PIN MOVED: `fb1014_pvpescrow.test.js` (the host's death-screen line, its new fields beside the escrow's).

## TRADE-WRAP: a lot's price never wraps

FOUND (the client sweep). CalculateTradePrice (`shopStock.js:"export function calculateTradePrice("`) haggles a lot ONCE,
as DFU does: the whole basket's cost (`tradeModes.js tradeCost`, CalculateCost summed) times the haggle's factor, then
`>> 8` - C#'s `int` in DFU, JS's int32 here. Past 2^31 the product wraps. Measured on the real counter: the first wrong
price comes at a cost of 9.65 million (a quality-1 shop, Mercantile and Personality 100) to 18 million (quality 10,
skills 40), and it is about -8.4 million gold. A Daedric claymore costs about 92,000 at a quality-10 counter, so 150 of
them sold there for -7,489,216; the online sale (`ONLINE_SALE_SHARE`, MERC-SLOPE) wrapped with it, its half and its top
read off the same arithmetic. A negative price is coin (`sellProceeds` weighs it as none), and `addGoldPieces` does not
clamp, so the purse went millions below nothing while the pieces left the pack. The wallet shows the purse as
`Math.max(0, ...)` - nothing - and from then on every payment found the coins short and spent the letters first. A
purchase as large wrapped the same way and paid the buyer.

CHANGED: the last step divides (`Math.floor(product / 256)`), the same number to the gold for every lot that never
wrapped - for a product under 2^31, `x >> 8` and `Math.floor(x / 256)` agree - and the right one for every lot that did.
A departure from FormulaHelper.CalculateTradePrice, named in Port-Ledger A: DFU's int wraps the same.

Not changed: a purse already below nothing. A save carries it as it is, and the judge reads a negative purse as a law
finding (`judge.js purseWord`) - which holds trade, and at a death in the zone burns the drop (BURNT-SAID). A character
it happened to is a staff repair (`review.js`), not a migration this change can know to be right - run from the Actions
tab since PURSE-BACK, below.

## NO-NAN-PAY: a price that is no number takes nothing

FOUND (the client sweep). deductGold (`court.js:"export function deductGold(player, amount) {"`, PlayerEntity.DeductGoldAmount)
given NaN or undefined: `amount <= purse` is false, so the letters pay - and NaN is never under a letter's value, so
EVERY letter is spliced, `owed > 0` is false, and it answers 0, paid. All the letters gone, the coins untouched: the
report's own shape. A negative amount added coin. The sweep traced every price producer it could find (trade, repair,
travel, training, the tavern, spells, enchanting, cures) and found none that is NaN today; the guard is there for the
next one. CHANGED: nothing owed is nothing taken (`if (!(amount > 0)) return 0;`), as the service's `payFromSave` already
refused both (`realmGoldLaw.js`, `Number.isSafeInteger(amount) && amount >= 0`). A departure from DeductGoldAmount, named
in Port-Ledger A.

Pinned by `test/systems/fb1018b_tradewrap.test.js` (4): the sale of 250 Daedric claymores past every shop's old wrap,
online and offline, paid in paper; DFU's price to the gold for every lot that never wrapped, bought or sold, over shops
and skills; the purchase; and the payment's refusals with DFU's order kept. `tools/mutants/fb1018b_tradewrap.json` (4,
all dead).

## PURSE-BACK: a purse the wrap left below nothing, rolled back from the Actions tab

ASKED (2026-10-19, the owner: "We need to restore Kurasawa's account to before they were in a negative balance"; offered
a developer's sign-in from a machine or a workflow: "Build a workflow"). TRADE-WRAP stops new wraps and left the purses
it had wrapped as they stood, for staff. A purse below nothing is a law finding (`judge.js purseWord`, code `gold`), so
its character is held and no checkpoint after it is judged clean - and the review's rollback (`server-account/src/review.js`,
INT6: the record back to its last clean checkpoint) puts such a character back to its last save before the sale, with the
pieces it sold and the letters spent since. That act is a developer's, signed in (`tools/realmReview.mjs rollback`); no
developer's session is a secret this repository holds, and none should be.

BUILT:
- `.github/workflows/realm-rollback.yml`, by hand from the Actions tab: `handle`; `character`, only when more than one of
  the account's purses went below nothing; `apply`, off for a dry run. It runs `tools/realmRollback.mjs` in
  `server-account/` and puts what the act answered on the run's page. It needs no maintenance hold and no rewind - the
  act is one guarded statement over the row as it read it, as the route runs it live - and it queues in the deploy's group.
- `tools/realmRollback.mjs` runs THE REVIEW'S OWN ACT - `reviewAct` itself: `characters` by the handle, `findings` for
  each, then `rollback` - over `tools/lib/wranglerBindings.mjs`, the service's D1 and R2 bindings answered by `wrangler d1
  execute` and `wrangler r2 object` with the repository's CLOUDFLARE_API_TOKEN. Nothing of the act's law is copied: its
  developer gate (asked with the run's actor against the deployed `DEVELOPER_HANDLES`), its guards (`dead`, `no-clean`,
  `service-moved`), its statement and its staff finding are the route's own. No line of the account service moved, so no
  deploy and no version.
- THE CHECK THE ROUTE CANNOT MAKE (`purseReach`): the clean save must be older than the earliest law finding naming
  `gold`. A purse below nothing can be set at nothing again - a payment the letters could not cover (`court.js` deductGold),
  a fare (deductGoldPieces), a death in the zone (`wildDropLaw.js`), a house bought through the bank - and the next
  checkpoint is then judged clean, and the save from before the sale left the bucket when the clean one moved past it. A
  rollback would land after the sale, undo the play since and give nothing back, so the run refuses (`clean-after`); a run
  applied twice says so (`rolled-back`, off the staff finding the first wrote).
- THE DRY RUN IS THE ACT WITH ITS WRITES HELD: the bindings read the live database and bucket and hold every write, so
  each refusal is the act's own, said before anything is written, and the page names the writes an apply makes.
- WRANGLER TAKES NO PARAMETERS: a statement's binds are written into it as literals (`literalSql`, through
  `tools/lib/sqlLit.mjs` - `realmRestore.mjs`'s `lit`, moved there and handed on). Wrangler says nothing of a write's rows
  (its local JSON's meta is `{ duration }`), so a write asks `SELECT changes()` in its own command: a guarded statement
  that moved nothing answers as the route's does (`no-clean`, and no finding).
- THE PAGE IS PUBLIC (a public repository's run): it names the account by the handle typed and its characters by name
  and realm id; never an account's id, a save's key or a statement - a failure says wrangler's words and its exit, never
  its command.

PROVEN against wrangler 4 itself (`--local`: its D1 with all 132 migrations, its R2, and a wrapped character made by the
real service): the dry run wrote nothing; the apply put the record back to its clean save (25,000 in the purse, three
Daedric claymores, both letters), lifted the hold, took the seat, wrote the staff finding with the actor and the run, and
dropped the save before the one rolled away; a second run refused `rolled-back`, a name off the list `not-developer`.
Not provable from a session: the live run - it holds no Cloudflare token, and the workflow does.

For the reporter: Actions, "Realm rollback (a purse below nothing)", Run workflow on main with `handle` Kurasawa and
apply off; read the page; run again with apply on. What was played after the save it goes back to is undone - the
check names that save, and the page the purse, the letters and the pieces it holds against the record's now.

THE FOUR HOSTS: no host line - an operator's tool over the account service's own act.

Pinned by `test/tooling/realm_rollback.test.js` (7) over the real service and migrations, its wrangler answered by the
service's own database and bucket, every statement run as the literal the tool writes; `tools/mutants/purseback.json`
(19, all dead).

## What would prove which door it was

- A death in the open zone is recorded by the account service: `wild_falls` keeps each fall's records
  (`server-account/src/wild.js`, its `items` column) and whether they burnt (`burnt` 1 - a held record's: laid nowhere).
  A row for the reporter's character carrying template 275 says the zone took them, and when. `realm_characters.held`
  says whether the character is held now.
- A revenant's theft is in the character's own record: the realm save's `modData.Revenant.list[].took`. A letter there
  comes home at the reporter's next load with this change.
- A deposit is in the account: the Empire's account (`bankAccounts[17]`) holds the gold.
- A card table's stake is `card_stakes` (status `held` until its cash-out is claimed); a staff rollback is a
  `realm_findings` row with act `rollback`.
- A wrapped sale is a purse below nothing in the record (`goldPieces` negative), and a law finding on it.

What the reporter is owed: a revenant that killed you could take a letter of credit, which the game's own rule ("never
gold") was meant to forbid - that is fixed, and a letter one is still holding comes back to your wallet when you next
load. If your letters went at a death in the open zone, that drop is the zone's law - and if your character was under a
trading freeze then, they were lost outright with no word on screen, which was a bug: the death screen says so now and
names the letters it took. The service's record of that fall will say which it was. And if you sold a large batch of
Daedric gear in one go and got nothing for it, the counter's arithmetic wrapped and paid you millions below nothing -
that is fixed too, and a purse left below nothing is for staff to repair (PURSE-BACK: back to your last save before the
sale).
