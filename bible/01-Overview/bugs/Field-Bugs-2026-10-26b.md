# FIELD BUGS 2026-10-26b - "First time XP bonus from the Loom still isn't working"

One thread from the Discord's #feature-feedback, handed over by the owner as a phone screenshot. Read on main's
`d5a4c9c6a`, reproduced through the real book (`net/profBook.js`) against the real Worker (`test/accountDb.mjs`).
AUDIT WOVEN-PAYS, at the end, is the slice's audit (the owner: "Audit this"); what it changed is written into the
sections above it.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | fogs: "We now have the ability to weave our own linen bolts (finally!) but I'm still not receiving the first time XP bonus when crafting clothing as if I had not woven the linen bolts myself. I have not bought any linen bolt using silver or gold". The screenshot: the Linen Champion Straps' box, "20 Outfitting experience, and 511 more the first time you make this piece at this grade from cloth you wove or spun yourself", and under it "You made a Fine Champion Straps (+20 Outfitting experience. Your first, but only cloth you wove or spun yourself earns the first-time bonus)" | The law as built, said wrong. Root Tendrils the service never counted (looted, or bought at a shop for gold - 2 gold in Daggerfall) wove into LOOSE Linen, and AUDIT 32 S1 walled loose cloth from its first. The box read the Stores and the carried count, which held none of the bolts the loom had carried out to the bag, so it promised the 511; the craft put one back in loose and paid none, and its word blamed cloth fogs had in fact woven. The owner, asked: **"Woven cloth pays"** | WOVEN-PAYS |

## WOVEN-PAYS - `src/net/recipeLaw.js`, `server-account/src/professions.js`, `market.js`, `realm.js`, `src/net/profBook.js`, `src/ui/professions/profPages.js`, `src/ui/craftXpWords.js`

WHAT DFU DOES. Nothing to follow: Daggerfall weaves nothing and has no first-make bonus (`06-Systems/Professions-Arc.md`
3.2, section 50 - the loom and its cloth are CLOTH-GEMS', a Ledger A row).

WHAT THE PORT DID. CLOTH-GEMS (2026-10-25) judged AUDIT 32 S1 by the units: a piece made wholly of Linen or Wool paid its
first-make share only where no unit it spent was bought OR LOOSE (`professions.js` craftAtAnvil's `p` over the Stores'
`loose` and `bought`). A loose unit is what a station's put-in brought that the service never counted (`bagLaw.js`
LOOSE_ORIGIN): a looted herb, one bought at a shop for gold, a friend's. A weave of loose Root Tendrils makes loose
Linen (`smeltAtForge`, `smeltOrigin`'s law), and the loom carries its bolts out to the bag (`profBook.js` smelt's
`carryOut`) - where a withdrawal gives loose units back uncounted. Measured: six uncounted Root Tendrils in the pack, a
weave of three, the bolts in the bag and none counted; the Straps' box (`profPages.js` ownSpend, which read the Stores'
bought and loose and the bought carried - none of the pack's uncounted bolts, which the craft's put-in would bring in
loose) said the 511; the craft's put-in moved one bolt in loose, and the service paid +20, `firstPaid` false. Every
craft of every pattern the same, the box unmoved after - the screenshot. A craft of the character's own woven cloth
(Root Tendrils gathered, counted) paid, and still does.

THE OWNER'S DECISION, asked: **"Woven cloth pays"** - any cloth the character wove or spun pays its first, whatever its
goods; only cloth bought with silver stays walled. The cost said with the question was "Outfitting's 152 cloth
first-makes become buyable for about 600 gold of shop Root Tendrils" - AUDIT WOVEN-PAYS C5: that gold buys the 73 Linen
keys alone (149 bolts, 298 Root Tendrils at 2 gold); the 79 Wool keys are spun of furs, which no shop sells.

FIXED.
- THE WALL IS SILVER, AND COUNTED. A unit's origin cannot hold the owner's line (AUDIT WOVEN-PAYS A1, A2, B1, B2, B3):
  `bought` is also the loom's own cloth of silver-bought goods (`smeltOrigin`) and a guildmate's cloth out of the guild
  Stores, and `loose` is also a Weavers' bolt set down and picked up again. So the service COUNTS: every bolt of Linen
  and Wool (`recipeLaw.js` JUDGED_CLOTH) a character buys with silver - the Weavers' and the furnisher's counters
  (`professions.js` buyStock) and the Drakes market (`market.js`: a buy, a courier's load as it lands, a buy order
  filled; never a gold buy) - is one on its SILVER COUNT (`prof_silver_cloth`, migration `0177_woven_pays.sql`), and
  every bolt of it the character's stations use (a craft of any recipe, a temper) takes one off. While the count stands,
  the bolts a craft uses are those, and a piece made wholly of cloth lays no first on (`recipeLaw.js` firstCraftPays's
  `own`; `professions.js` craftAtAnvil's `silverHeld`). Whatever the units' origins: the loom's own cloth of looted,
  shop-bought or market-bought goods pays, and so does a guildmate's; a Weavers' bolt carried, set down, sold to a shop
  and bought back, or traded to the character's own pack still counts. The count starts as every bolt held as bought
  (the Stores and the carried count) - the wall the decision read until now - and goes with the character's delete.
- A PATTERN IS MADE BY THE CRAFT THAT LAID ITS FIRST ON. A craft of silver-bought cloth lays none on and takes nothing:
  the next craft of that pattern that can pay, pays (`patternMade`, `prof_crafts.first_paid`). Without it fogs's every
  pattern already sewn of loose cloth stayed spent, its share never paid; and every cloth pattern sewn of the Weavers'
  cloth before CLOTH-GEMS (when no judged first could pay) was spent the same way. A row from before the column made its
  pattern where it was the first and its XP holds the share - the least share is 500 (`FIRST_MAKE_FLOOR`) and no judged
  craft's own XP reaches it at any rank under every star of the Firmament (pinned). Every other recipe's pattern is made
  by any craft of it, as before. The most first-make XP a track can earn is unchanged: each key pays once.
- THE BOX READS THE COUNT. A cloth's Stores count carries its silver count beside it (`professions.js` storeOf, and the
  state read's `silver`), the book keeps it (`profBook.js` silver), and the loom's box says the share and its condition
  where none stands, and the count where one does (`profPages.js` silverOf, `craftXpWords.js` craftXpLine).
- THE ANSWER SAYS WHAT THE DECISION DID: `firstPaid` off `first_paid` (a row from before it read as the decision reads
  it - AUDIT WOVEN-PAYS A4).

NOT CHANGED - THE DISENCHANT. A piece wholly of cloth gives its Enchanting XP only where nothing bought or looted went
into it and it was never sold (`alchemyLaw.js` disenchantXp's `own`, `products.bought_with` none) - loose cloth gives
none, as before. Its XP comes again with every piece, so the owner's answer for a first-make (one a pattern, bounded)
does not carry to it: loose cloth of shop-bought Root Tendrils would buy Enchanting with gold, AUDIT PROF12 E2's exploit.
Its line now says the service's own test (AUDIT WOVEN-PAYS B6). The owner's call if it should follow.

KNOWN, AND THE OWNER'S CALL.
- The count is the character's. Weavers' bolts bought by one character and traded to another go into the other's pack
  uncounted, then in loose, and pay; the buyer's count stands until the buyer's own stations use as many. The same of
  another account's. Counting the account's characters together would close the first, at the cost of one character's
  purchases walling another's weaving.
- A bolt bought with silver and sold on, kept or given away still counts against the next bolt the character uses.
- A modified client may put in loose cloth it does not hold (AUDIT WOVEN-PAYS A1b): it pays as a fabricated loose unit
  of any other material has paid every non-judged first since BAG-CRAFT. The wall binds what the service counts.

THE FOUR HOSTS. The station pages are `scenes/world.js`'s (setProfessionsPages - unchanged wiring; the craft's word
through `craftXpText`, one call); `worldModes.js`, `exterior.js` and `dungeonContext.js` build no station page and no
craft word. HOST-SPLIT: no host grew.

THE WORDS. Five keys moved in English and redrafted in all 25 languages: the box's `prof.page.craft.xpFirstOwn` ("from
cloth not bought with silver") and `prof.page.craft.xpBought` ("Bolts of this cloth bought with silver and not yet used:
{silver}. Until you have used that many, no piece of it earns a first-time bonus."), the craft's
`prof.craft.xpFirstBought` ("Cloth bought with silver earns no first-time bonus, so this piece's is still yours to
earn"), the Outfitting how-to's `prof.page.how.outfitting` and the disenchant's `prof.page.enchant.cloth` ("only if
nothing bought or looted went into it and it was never sold").

THE SERVICE. ACCOUNT_VERSION acct196, migration 0177 (acct195 and 0176 on the branch, renumbered past LOCKPICK and AUDIT GATHER at the merge; the count's table, filled from the bought cloth held; a column,
NULL for every row before it). No relay change.

PINS: `test/net/fb1026b_wovenpays.test.js` (10: the law twice; the loom's line under the crafter's limit; the report through the real book and Worker; A1/B3's
bolt set down and picked up; A2/B1's cloth of silver-bought goods by the chain and by hand, and B2's guild cloth; the
count's every add and take; the Drakes market's three paths and a gold buy's none; the pattern made by the craft that
paid; the rows from before the column). PIN MOVED: `clothgems_service`, `clothgems_client`, `fb1015f_firstcraft`,
`audit32_service`, `prof7_service`, `prof5_service`, `prof12_client`, `fb1018d_crafthowto`, `profdelete` - the Weavers'
cloth bought at the counter, through the real route, where a bought row was written by hand. Mutants: see AUDIT
WOVEN-PAYS.

## AUDIT WOVEN-PAYS (the owner: "Audit this")

Three lanes read the slice cold, each in its own worktree of the pushed head (`617c2491d`), and no line was touched until
all three had reported: A, the law and its exploits; B, every other system that reads what changed; C, the record - its
tests, pins, mutants, docs and words. Every finding was reproduced on the tree before it was fixed.

| | Finding | Lane | Done |
|---|---|---|---|
| A1 | MAJOR. One character, an honest client, carried the Weavers' bolts past the wall: withdrawn (counted bought), set down while any other Linen ask cut the count to what the pack held (bought units cut first, CLAMP_ORDER), picked up again - the craft's put-in brought them in loose, and loose paid. Base `d5a4c9c6a` paid +20; the head paid +531 | A, B (B3: and sold to a shop and bought back) | FIXED: the silver count - a purchase counts, and only a station's use takes it off |
| A2 | MAJOR. Cloth the character wove or spun of goods bought with silver (Root Tendrils, pelts off the Drakes market) came out bought (`smeltOrigin`) and was walled - against "whatever its goods"; by the craft's chain the box promised the share and the craft refused it, its word blaming "cloth bought with silver" for the player's own weaving | A, B (B1), C (C1) | FIXED: the count reads no origin - such cloth pays |
| B2 | A guildmate's cloth out of the guild Stores came out bought: walled, and said as "bought with silver" though no silver was paid | B | FIXED: no origin read |
| A4 | An old row (`first_paid` NULL) was read two ways: the answer off its piece (`bought_with`), the decision off its XP - a pre-S1 Weavers' first that paid its 500 answered "still yours to earn" while the decision held the pattern made | A | FIXED: the answer reads it as the decision does |
| B4, C4, C10 | Old-law sentences standing: Professions-Arc 3.2 ("of a pack's word (loose) never does"), 4.5 ("from them alone"), 50.8's mutant count; recipeLaw's `own` ("no bought and no loose one"); the client test's header; the Port-Ledger row ("one of the counter's never does", its 500); the words' header ("a station spends bought units first") | B, C | FIXED: each sentence rewritten to the law as it stands |
| B5, C3 | The pin's carry hands were not the game's (no `heldAll`, `take` without the counter flag), and `spendOf`'s cut of the count had no killer | B, C | FIXED: the hands the game's own; `spendOf` gone with the count |
| B6 | The disenchant's line ("woven or spun from goods you gathered") missed the service's test: a temper with loose units walls the piece too | B | FIXED: "only if nothing bought or looted went into it and it was never sold" |
| C2 | The report's pin claimed to kill "the box reads the Stores alone", which its flow - the Stores empty - could not; the narrative said the box read the Stores alone | C | FIXED: the narrative says what the box read; the box's pins are the count's |
| C5 | The cost put to the owner priced the 152 keys in Root Tendrils: they buy the 73 Linen keys alone | C | SAID above, and to the owner |
| C6 | The old-row fixtures were shapes no service before the column wrote (a piece's `bought_with` cleared by hand; a Boots row at exactly 20 XP) | C | FIXED: rows as the old service wrote them, the old answers by their own ids |
| C7, A3 | A pre-0177 first whose share the crafter's limit cut reads as owed; harmless, for the limit pays the track nothing again - and new rows mark such a first paid | A, C | SAID, in the migration's header |
| C8 | The floor's `>=` edge and `first = 1` survived as mutants | C | FIXED: an old row at the floor pins the edge; `first = 1` stands as the row's own word, a non-first old row never holding a share |
| C9 | The record's "the floor moved" mutant was never written; the retired box record had no inverse; the re-aimed records shared one note | C | FIXED: each written, each note its own |

SAID, NOT CHANGED.
- A1b: a modified client's fabricated loose cloth pays (KNOWN, above).
- The count is a character's (KNOWN, above) - the owner's word asked on counting an account's characters together.

MUTANTS: `tools/mutants/fb1026b_wovenpays.json` (30, one of them an equivalent recorded - the slice's, rewritten with the count). Retired, the law they
killed gone: `clothgems.json`'s CLOTHGEMS-svc-loose-pays, CLOTHGEMS-pages-loose-unread (loose walled - their inverse
WOVEN-PAYS-svc-loose-walled-again), CLOTHGEMS-svc-bought-pays (the origin wall - WOVEN-PAYS-svc-bought-units-read-as-silver),
CLOTHGEMS-pages-bought-unread and CLOTHGEMS-pages-carried-unread (the box's put-in reading - WOVEN-PAYS-pages-count-unread).
Re-aimed by content, each its note: `clothgems.json` (5), `audit32.json` (2), `fb1015f_firstcraft.json` (5),
`fb1018f_craftlimit.json` (3), `gatherspeed.json` (1), `prof3.json` (1), `fb1018d_crafthowto.json` (1). The lists the
slice touched, judged again (`node tools/mutate.mjs --jobs 4`, eight lists, 366 records): 363 dead, 0 survived, 3
equivalent as recorded (PROF3's `NO_PACK_FORM` pair, WOVEN-PAYS-svc-old-row-first-unread), 0 stale. The run found two
survivors, each pinned and judged again dead: WOVEN-PAYS-svc-answer-old-row-read-off-its-piece (A4's answer, its fixture
no S1-era row - an S1-era row now stands, its piece written with `bought_with` NULL), and CRAFT-LIMIT-SAID-words-line-most-plain,
older than this slice (no pin held a cloth piece at a room between its own XP and its share under the crafter's limit -
now "the loom's line under the crafter's limit", with its inverse WOVEN-PAYS-words-share-beside-count).
