# AUDIT COLLECTIONS-II (2026-10-22) - the Collections page, audited

The owner, of COLLECTIONS-II (the Collections page's every title, aura, profile icon and glyph, and how each is had -
`10-UI/Collections.md`; branch `ccr-5d2f25da-pmm6z0` at b73dfa01e): **"Audit this"**. This page is the findings, each
with its verdict. What the audit changed is written into the record's sections as they now stand (`10-UI/Collections.md`,
its section 8 the older records it moved).

## How it was run

Six lanes, each a cold adversarial reader of a FROZEN snapshot (a worktree at b73dfa01e - `Home.md`'s DO NOT FIX WHILE
THE VERIFIER IS READING: the fixes went into the tree only after the lanes had read the snapshot), each told to prove a
finding - a repro run against the real code, or the code quoted with a concrete trace - before reporting it; then the
author's pass, every finding reproduced before it was acted on, and every fix pinned:

| Lane | Over | How |
|---|---|---|
| 1 - is the catalogue true? | every entry's words of how and its availability against the code that grants the thing | each entry rendered in node; the real `titles.js` wardrobeOf, `egHonours.js`, `townSeatLaw.js`, `festival.js`, `serpents.js`, `founderLink.js` driven with rows built to each claim |
| 2 - the code | the page's read of the account, its presses, its landings, the service's answers | node repros over the real `AccountFlow`; a dev server in Chromium (Playwright) |
| 3 - what a player sees and touches | every part at 1280, 390 and 320; every Plus theme and the Grimoire dress; keyboard and pad | Chromium frames, computed contrast over each theme's ground, `plusPad.js` spatialStep driven |
| 4a, 4b - the translations | the 127 `coll.*` rows in all 25 languages | each row formatted through the real `textManager.js` with the game's real arguments (questline givers, prices, dates) |
| 5 - the pins and the record | every sentence the slice wrote against the code; every moved pin; every re-aimed record | 36 mutants of its own run against the slice's tests; the slice's 25 and the re-aimed records run again; the probe run in en and de |

What reached a player: nothing yet (the branch is unmerged, the service undeployed). On the branch, the page told a
player things the service does not do - that Founder can no longer be had (three routes still give it), that a guild's
crown earns Crowned at this Season's end (Season 0 crowns no one), that a hearth's own cakes count - and the account card
and the page could each show another account's wardrobe after the card changed it (L2-1); a keyboard or a pad lost its
place after every Wear (L2-2); and on the Stone theme half the names could not be read (L3-5).

## Findings

### Lane 1 - is the catalogue true?

| # | Sev | Finding | Verdict |
|---|---|---|---|
| L1-1 | HIGH | Founder said "no longer obtainable": a guest from before the date earns it by registering, a character from before it brought onto an account counts (`founderLink.js`), the name list grants it; and the instant is noon UTC on 25 September, not "before" it | FIXED: availability `closed` ("Closed to newcomers…"), its how the three routes and the instant; pinned to FOUNDER_UNTIL |
| L1-2 | HIGH | Crowned and Keeper said "You can earn it now": Season 0 crowns no one (`seasonTitles`) and the seats are wiped at its end | FIXED: "from Season 1 on (Season 0, the beta, crowns no one)"; pinned to seasonTitles |
| L1-3 | MED | Spire Champion said it passes to whoever takes your place: it is the last season's Descent board, held through the next season, its runs unwagered, from Hall 1, never a Rehearsal | FIXED: its own availability line, the Descent's rules in its how; pinned to `egHonours.js` |
| L1-4 | MED | The Unfallen said "with no one falling": the receipt's `fl` is the member's own falls, so a member who never fell holds it | FIXED: "without falling yourself"; DIVERGENCE recorded - the Elite-Gates record says a company with no fall (section 19 carries the note); which is meant is the owner's |
| L1-5 | MED | Hearthkeeper said "give 25 Soul Cakes": `fest_given` counts the cakes OTHER players take from your offering | FIXED; pinned to `festival.js` |
| L1-6 | MED | The Serpent's roll said "for each ship that wounds": it is each registered player whose own fire dealt a real share of their ship's (a `dealt` claim) | FIXED; pinned to `serpents.js` |
| L1-7 | MED | A guest saw "Held by your account" and "You can earn it now" on rows every grant refuses a guest | FIXED: a guest's own line |
| L1-8 | MED | The seats' four glyphs could never show as held - they are signed per character into the token, never into the account's wardrobe; the Seats group read 0/4 and Not held listed them | FIXED: `scope: 'character'` - "Per character", uncounted, never Not held, its own opened line; Warden and Protector say the guildmaster's character |
| L1-9 | LOW | The Arena's, Iliac Hand's and The King's Gambit's champions left out their boards' floors (10 against 5 different opponents), and "passes to whoever takes your place" is false below one | FIXED: the floors said, read from `arenaLaw.js` and pinned to `iliac.js` and `gambit.js`; the line "Held only while you stay on top." |
| L1-10 | LOW | The Broker's embers said only "closing Dagon's Breaches" - the purse is gates, serpents and Redoubts | FIXED; pinned to EMBERS_EARNED_SQL |
| L1-11 | LOW | "Comes with" left out the glyph↔aura pairs of six one-player grants | FIXED; the pin holds every pair of each group |
| L1-12 | MED | After a Show/Hide or an icon worn the ranked honours vanished from the page - the service's glyph and icon doors answered without them | FIXED in the service (see L2-4) |
| L1-S1 | - | High Master followed Chapter Master's holding whatever the chapter's band (latent: CHAPTER_TITLES is off) | LEFT, written (`Collections.md` section 7): dormant while the switch is off |
| L1-S2 | - | A guild with a palace and a crown wears the crown's title over Warden's | LEFT, written (section 7) |
| L1-m | LOW | Minor: the Patreon how ignored the name lists; the sprout tagged Obtainable; the Masters, Unfallen, Lone Beacon and Spire Champion silent on Rehearsals; two questlines named no giver; "Rare drop" on a 1-in-4 roll; the Royal Tourney held only when proclaimed | FIXED, each (the sprout `auto`; "By chance"; the giver last in every questline's how) |

### Lane 2 - the code

| # | Sev | Finding | Verdict |
|---|---|---|---|
| L2-1 | HIGH | The page never heard what the account card did - a wear, a sign-out, another account signed in - and pressed Wear with the new account's secret over the old one's wardrobe | FIXED: the card closing asks the page's read again (`rereadCollectionsAccount`), at once while idle, else once its press is answered |
| L2-2 | HIGH | Keyboard and pad focus fell to the page's body after Wear (the press `disabled` while out) and after a "comes with" | FIXED: `aria-disabled` and a press refused while one is out; the row a "comes with" opens focused |
| L2-3 | MED | A Wear answered after the page was left and reopened was lost, and a second Wear raced it | FIXED: the read is the menu visit's - leaving the page keeps it |
| L2-4 | MED | The service's glyph and icon doors answered a wardrobe without the arena's, Iliac Hand's, the Gambit's and the Spire's honours, the glyph's without a Charter's and a chapter's titles | FIXED: ARENA_HONOUR_PATHS gains both doors, the glyph's door reads `withSeatTitles` (acct171 - acct169 on its branch, renumbered past CRAFT-PAYS and PISTOLET at the merge); pinned in `arena4_service.test.js` |
| L2-5 | MED | The seats' glyphs never held (L1-8) | FIXED with L1-8 |
| L2-6 | LOW | A landing by a wardrobe part's name opened the System tab | FIXED: every `COLLECTION_PARTS` id lands |
| L2-7 | LOW | Every visit and every rail press read the whole `/v1/account` | FIXED with L2-3: once a visit |
| L2-8 | LOW | AUDIT HOLDINGS C6's empty-rail line could no longer appear, and its pin certified dead text | FIXED: the branch and AH-C6 retired (`Collections.md` section 8) |
| L2-9 | LOW | A refusal that signed the player out was swallowed; a service too old to send auras showed 0 | FIXED the first (the flow's sentence before "Sign in…"); LEFT the second - as designed, the dash is for no wardrobe |

### Lane 3 - what a player sees and touches

| # | Sev | Finding | Verdict |
|---|---|---|---|
| L3-1 | HIGH | A gradient title showed its first colour alone - the paint spread over the whole cell, 451px for a 91px word | FIXED: the word painted inline on a plate as wide as its letters |
| L3-2 | MED | A "comes with" landed 1,800px below the pane's view | FIXED: the row scrolled to the top and focused |
| L3-3 | MED | The pad's step down from an opened row skipped its Wear (230px left of centre) | FIXED: the presses in a foot across the box, centred; the probe steps to it |
| L3-4 | MED | Keyboard focus lost after Wear and "comes with" (L2-2) | FIXED with L2-2 |
| L3-5 | HIGH | The Stone theme: Kynbane at 1.2:1, the headings 2.3:1, not-held names all under 4.5:1 | FIXED: the theme's own sheet - each name on a dark plate, the words in bone |
| L3-6 | HIGH | The Grimoire dress: names vanished on the parchment (the dress's ink never reaches an inline paint) | FIXED: each paint's colours inked as the dress inks its sheets |
| L3-7 | MED | Not-held names at 0.55 read under 3:1 on every dark theme | FIXED: 0.8 |
| L3-8 | MED | A row opened at a phone's pane foot showed nothing of its box | FIXED: the box brought into view |
| L3-9 | MED | Unread: the dividers said 0/13, Held found nothing, Not held listed all; a failed read had no way to ask again | FIXED: a dash, the two filters hidden, Try again |
| L3-10 | LOW | A Wear's note followed the player to the other parts | FIXED: said on its own kind's part |
| L3-11 | LOW | Mixed languages: the Codex part all English; the crown's how named the kingdom in English; title names English beside translated glyph labels | FIXED the first two (the Codex through the text core; the crown's how names no kingdom - its glyph does); LEFT the third, written (`Collections.md` section 7) |
| L3-12 | LOW | The sprout tagged Obtainable | FIXED: `auto`, "Automatic" |
| L3-13 | LOW | The tiles' 5px meters read empty and partial alike | FIXED: 8px |
| L3-14 | LOW | An aura's, icon's or glyph's opened box never named it | FIXED: every kind's name on top |
| L3-15 | LOW | Six tiles wrapped 5 + 1 at 1280 | FIXED: 84px tiles |
| L3-16 | LOW | An opened Codex row a bare list beside the wardrobe's panels | FIXED: a panel |
| L3-17 | LOW | A busy Wear faded with no word | FIXED: "Asking your account…" |
| L3-18 | LOW | An opened row's name stayed dimmed | FIXED |
| L3-19..22 | - | An aura's ring in its title's paint against its look; arrow keys; the pad not scrolling; the rail's English labels | LEFT, written (`Collections.md` section 7): the account card's paint; the whole menu's behaviour; older than this page |

### Lanes 4a and 4b - the translations

| # | Sev | Finding | Verdict |
|---|---|---|---|
| L4-1 | MED | "The Turning Hour" translated in `coll.look.firsthour` in 20 languages, "Chapter Master" in `coll.how.highmaster` in 15 - names the page draws in English, so the sentence pointed at nothing on screen; the glossaries recorded the translated names | FIXED: the names kept in English in every language; each glossary given the names as the page draws them (the seat's own term kept for the rows that name the seat) |
| L4-2 | MED | A questline's giver (a name and its office) mid-sentence left its apposition open (de, es, ru, and others): "…bietet sie Ysolde Marnhel, Meisterbeschwörerin der Magiergilde von Wayrest an." | FIXED at the English: the giver last ("Offered by {giver}."), every language redrafted to match |
| L4-3 | LOW | Each language's own: zh's Latin text unspaced, its fractions split and its dashes ASCII; hu's period; bg's and fi's "bestowed"; ro's plural "de"; id's, ja's and ro's lamp read as a shopkeeper's lamp; tr's Spire Champion a top of players, not companies | FIXED, each, in the redraft |
| L4-4 | - | The 43 rows whose English the audit changed | REDRAFTED in all 25 languages |

### Lane 5 - the pins and the record

| # | Sev | Finding | Verdict |
|---|---|---|---|
| L5-1 | HIGH | A flow built every draw survived the pins (in the game an endless loop of reads) | FIXED: pinned (draws counted, one construction) |
| L5-2 | MED | A questline's level, the line it follows, and the line itself unpinned | FIXED: each title's line found by the service's own table (QL_SERVICE_LINES), its name, giver, level or predecessor said |
| L5-3 | MED | Which number each entry says unpinned (the Hourbreaker saying the aura's odds, Spirewalker another Redoubt, every patron the Disciple) | FIXED: each entry's own number and name |
| L5-4 | MED | Sources and availabilities outside a sample unpinned | FIXED: the whole map against a literal, the sources' order too |
| L5-5 | MED | FESTIVAL_OPEN, QUESTLINES_OPEN and SEATS_OPEN never read | FIXED: read from the config |
| L5-6..11 | LOW | The dividers' counts, a signed-out row's ownership line, a "comes with" under a filter, the reset, the meter, the codex's and the cards' counts, the sheet in the document, aria states - unpinned | FIXED: each pinned |
| L5-12 | LOW | The record said landings name every part - only two did | FIXED in the code (L2-6) |
| L5-13 | LOW | Tavern-Cards section 26 kept the retired sentence with a note appended | FIXED: the sentence replaced |
| L5-14 | LOW | The festival's date written "7 November" - English shows "November 7" | FIXED in the record |
| L5-15 | LOW | The C6 branch dead under a live pin (L2-8) | FIXED with L2-8 |
| L5-16 | LOW | "The codex's three English lines" understated - eight | FIXED: all through the text core |
| L5-17 | LOW | The probe claimed a filter and a Wear it never pressed, and its count check could not fail | FIXED: it presses and asserts them (`Collections.md` section 6) |
| L5-18 | LOW | AC5-D-C07's retirement unrecorded | FIXED (`Audit-Cards-5.md`, `Collections.md` section 8) |
| L5-19 | LOW | The founder instant (L1-1) | FIXED with L1-1 |

## The mutants

`tools/mutants/collections2.json` - 78 records: the slice's 25, lane 5's survivors written as records against the fixed code, and one
for each fix of the audit's own (a retry that asks nothing, the note on every part, the Stone theme never laid, the
Grimoire never inked, the presses at the text's left, a held filter kept unread, the Codex in English, a questline's
another line...). The first run of the fixed tree killed 76; two lived - the Held filter kept after the read went, and
the Codex's dividers written in English (the l10n ratchet does not count a template's words) - each pinned at its own
now (the page drawn under the pseudo-locale). All 78 dead. The records the account version's move went stale on
(`bal9`, `br5`, `crafthold`, `fb1004d_knight_house`, `gatekeys`, `hackedgold`, `nameas`, `tech1`, `wb14g`) and the
re-aimed `auditcards5` and `cardsplus` records - 22 - all dead.
