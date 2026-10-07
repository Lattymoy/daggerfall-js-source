# AUDIT 657 - PR #657 audited, 2026-10-07

Mac, of PR #657 (BOARD-UI, TEXT-F1, PROFILE-UI and WALLET-UI on one branch): *"Lets do an audit on everything so
far"*. Four lenses read the branch at its merge of main (`5bd5324c`), and each finding was checked with a probe before it
was reported:

- **the board** - BOARD-UI: one Notice Board a town, the tabs' sheet, the market's early read, the Seat tab, the words;
- **the word filter** - TEXT-F1: the sentence reader, its lists, and every way a player's words reach another player;
- **the profile and the wallet** - PROFILE-UI's inspect card and WALLET-UI's ledger;
- **the docs, the pins and the merges** - every page and cite the branch wrote, every pin it moved, every mutant record
  it named, and the merge of main it carries.

The word filter's and the profile's lenses were cut short by the session's limits and were finished here by hand. The
word filter's probes ran a 274,937-word English dictionary (`an-array-of-english-words`, in the scratchpad, never the
repo) and every string literal in `src/` through the reader, and named each list word by its place in its list
(`CRUDE[k]`) - never by the word.

Twenty-five distinct findings: twelve on the board (B), nine on the docs and pins (D), four more on the filter (T2-T5;
T1 is D1); the profile's lens found nothing beyond D8. Every one was read again here before any line changed. Twenty-
three are fixed, one is decided and left (B8), and two design calls were put to Mac (below). Each fix carries an `AUDIT
657 <ID>` comment. They are pinned in `test/audit657_board.test.js` (10) and `test/audit657_filter.test.js` (7), and
mutated in `tools/mutants/audit657.json`: **24 mutants, 24 dead.** A pin a fix moved says `PIN MOVED` where it stands.

## Mac's calls

Each was put to Mac with its options and the trade-off. Until his answer is written here, the code stands as described:

- **B11 - the Work tab's count before the tab is opened.** BOARD-UI's tab counts read what each tab has read: the
  Notices' new notes are read as the board opens, the Work tab's writs only once its tab is pressed, so its count shows
  only after a first look. Reading the writs as the board opens (as the Market's first view is) would show it at once,
  for one more request at every opening. As it stands: the count after the first look.
- **T1 - the words with two readings.** Some listed words are also ordinary English: "a chink in the armour", "a door
  knob", "the cock crowed", "a blue tit", a donkey called an ass. T1 freed the words that are almost never the insult
  (below); these bare words stay starred in chat and notes. Freeing them in sentences (a name would still refuse them)
  lets the insult through when it is meant. As it stands: starred.

## Fixed

**The board** (`src/ui/enhancedPlusStyle.js`, `src/ui/marketTab.js`, `src/ui/noticeWindow.js`, `src/ui/vendorTab.js`,
`src/ui/workTab.js`, `src/ui/seatTab.js`, `src/systems/siegeField.js`, `src/net/boardLaw.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| B1 | minor | BOARD-UI made the tab strip scroll sideways, and a scrolling box clips what stands past it. The chosen tab's line was a border pulled 2px under the strip, so it drew nothing (the pixel under it was the strip's dark, not brass, in Chromium, on both sheets and on the Market's views at a phone's width), and the keyboard's focus ring was cut to a dark inner line. | The line is an inset shadow inside the tab, the focus ring an inset outline. Under forced colours, where a shadow is painted over, the chosen tab carries the system's Highlight as an outline (the Arena window's rule). |
| B2 | minor | At a phone's width a suppliers' counter row kept its four columns, and the name's column came to nothing: "Fairy Dragon Scales" drew one letter a line, the row 267px tall. The probe never opened the fold, so it was never measured. | At 640px and under the name spans the row, and the price, the count and the press stand under it. |
| B3 | minor | A stall's "Put up a piece" form wears the List form's dress, and BOARD-UI stood that form's fields in a column. Its select and its press stood each the window's width (982px at 1280; the form 184px tall, 65px on main). | Its fields stand under their names in one row of fields, as the List form's, the press beside them. |
| B4 | minor | The market book keeps a failed read its minute, as it keeps a good one. The board's early read (BOARD-UI's prefetch) set out the moment the board opened; if the line was down then, the first press of the Market a minute later said "The market did not load." of a market back up since. On main the press read afresh. | The early read's refusal is remembered, and the press asks again. A read still under way is joined, as before. |
| B5 | minor | The early read can hear the market is shut before its tab is pressed, and the tab went at the next redraw with no word. On main the tab stood until pressed and then said why (AUDIT 30 U11). | A Market the board showed as it opened stays for that opening; pressed, it says why. The next opening knows, and shows no tab. MARKET-AUDIT U4's arm (a tab being read stays) is pinned where B5 does not reach it: a market known shut at the opening and heard open since. |
| B6 | minor | The guild's raid contract said "Fight off a raid on a town here", dropping half of what earns it: a raid receipt goes to an account that struck a raider AND stood in the town at the cleanse (`raidLaw.js`). A defender who left before the cleanse was not paid and was no longer told. | "Strike a raider in a town here and stay until it is cleansed: paid when the raid is counted, less N tax." |
| B7 | nit | The siege field took for its Market the board nearest the town's middle, walking the boards in their order; ONE-BOARD's Notice Board walks them by position. On an exact tie the two were different boards, and the record said they were one. | The field takes the Notice Board by the one law (`bountyBoard.js` noticeBoardIndex). |
| B9 | nit | Four lines said less than the law. A gold listing said "No fee." over a sale that pays a 1% fee. An auction's late bid "adds 2" with no unit. The guide's Claim said the Charter goes to "the top guild with 6,000 influence", where the law gives it to the strongest past the line whose treasury can pay the fee. Its Earn step listed Tribute among what members earn, and Tribute is the Guildmaster's spend from the treasury. | "No fee to list... after a 1% fee and 5% tax"; "adds 2 minutes"; "goes to the strongest guild with at least 6,000 influence whose treasury can pay 8,000 silver"; "...Renown and seat writs. The Guildmaster adds Tribute from the treasury." |
| B10 | nit | Two comments disagreed with their code: the Seat tab's header put Fealty and Pacts after the Works (they are drawn in Your guild), and the board law's header said every rumour board of a town shows the same notes. | Both say what the code does. |
| B12 | nit | A shut market stood "Your silver: -" over its shut word: BOARD-UI moved the silver's strip above the body's early return. | A shut market's word stands alone under its views. |

**The word filter** (`src/net/nameFilter.js`, `src/systems/fleet.js`, `src/net/wire.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| T1 = D1 | minor | TEXT-F1 said no English word holds an ANYWHERE word, and two do: snigger and niggard, with every word made of them. Names NAME-F1 had let through (Snigger, Sniggerton, Niggardly) were refused, and so were their players' names at the relay's hello. A sentence also reads a listed word's tails (stage 2's `s`, `ed`, `y`), so the ordinary words a listed word and a tail spell were starred: "spiced wine", "a booby trap", "don't get cocky", "a cocked crossbow", "pricked his finger", a merchant's "dicker", "titter", "knobby". Of 274,937 dictionary words, 277 were starred, most of them the lists' own words and their compounds. The game's own names were hit too: the Spices shop, the Spiced ships and the tavern's Spicy Grilled Lizard, which `shownItemName` stars wherever an item carries the name. TEXT-F1's walk read only a `name:` key's literals, so it never read any of the three. | `INNOCENT` (`nameFilter.js`): twenty ordinary words, read out before the ANYWHERE words are looked for (names and sentences), and never read against the lists when a sentence's word IS one. A name's verdict on the rest is NAME-F1's, unmoved. The pin parses `src/` (acorn) and reads every capitalised literal of up to six words: 6,950 names, none starred. The cost: "cocking" and "pricking" pass in a sentence. The bare words with two readings stay listed (Mac's call, above). |
| T2 | minor | The reader split a word at a combining accent (`u` and U+0301): the accent was no word character, so a word written with one read as two halves, and the accent fold stage 1 makes never saw the whole word. 58 of the lists' 60 words passed this way. | A letter's combining marks are its word's. A one-letter word is a letter and its marks, so a spelled word with an accent on a letter is still read. |
| T3 | nit | An at sign before a word (`@word`) hid it: `@` is the leet `a`, so the word read as "aword". 52 of 60 passed. | `@` is a word's edge mark at its head: the word is read without it, and the sign stays the sentence's. Inside a word it is still the letter. |
| T4 | minor | A ship's name was judged by `checkName`, which reads a name as one word, so a name of words ("Big X Barge") carried any word the lists catch beside its others. A ship's name rides the wire to every crew that sees her (`comeSailAwayWire.js` shipNameOf), which judges it by the same verdict. | `shipNameVerdict` refuses a name the sentence reader catches, naming the word, as a rank's name is refused. |
| T5 | nit | A run of one-letter words cost a reading for every window of it: 6.9 ms for a 240-letter chat line at the relay, 22 ms for an 800-letter note, about thirty times an ordinary line of its length. | The longest window from each letter is read once first; a window holds a word only where the longest one does, so none of the others is read. 1.5 ms and 5 ms, about five times an ordinary line. Every result is unchanged. |

**The docs, the pins and the mutants** (`bible/`, the PR's description, `test/`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D2 | minor | The sweep of the claims ONE-BOARD made false missed six: Professions-Arc 10.7 ("every rumour board in a town shows the same notes"; "stood two" where five or six boards stood three) and its status table, Testing.md's town_marks row, the Port-Ledger's SEAT1a row, Rendering.md's banner line and Online-Arc's SEAT1a banners (the retired sentence kept, the correction in parentheses). | Each says the town's one Notice Board; the retired sentence is gone. |
| D3 | minor | A patch note said each challenger's bar shows "how close it is to claiming the Charter or winning a siege"; the bar measures the Right of Siege. | "...or winning the Right of Siege." |
| D4 | minor | The Seat guide's fold kept open across redraws had no pin: `guide.open = false` survived every test. The suppliers' fold had one. | Pinned, and a record added. |
| D5 | nit | 10.11 and the PR said every seam reads the one memo a pixel; the pennant calls the law at the build. | The same inputs, the same board: the record says which seam reads what. |
| D6 | nit | The guide's "every number the law's own" was not so: "7 days" was written in, and the hours are words. | The members' wait is the law's (`SEAT_MEMBER_WAIT_S`); the record says the hours are the week line's words. |
| D7 | nit | TEXT-F1's PIN MOVED list left out F077's pin (`audit26_questitem`, b8ded8cb), and twelve of BOARD-UI's moved pins carried no PIN MOVED mark. | Each is marked where it stands, and the list names F077's. |
| D8 | nit | Five claims overreached: "ten re-aimed records" (eleven, in ten lists); a select's height in a labelled field called pre-existing (the field was the branch's own); "pairs such as two rings on one line" (one row, the names one under the other); "ten such pairs to a full look" (eight); "opening it the first time no longer waits" (the window is the tenth of thirteen warmed chunks, one an idle callback - a press in the boot's first moments can still wait). | Each says what is so. |
| D9 | nit | "The line's length stands" is not exact: a letter past the Basic Plane is two UTF-16 units and one star. | "It never grows." The bound is what matters, and it holds. |

## Decided, not changed

- **B8 - the Seat tab asks for the works beside the standings, even when the standings fail.** The parallel read is the
  speed asked for. When the standings fail, the works' answer is dropped: one request.
- **A word spelled a letter at a time is starred to the first window that reads as a listed word.** A listed word whose
  first letters are a listed word of their own is starred to those letters. Starring to the longest window would star
  the innocent letters after an ANYWHERE word - the whole run of twelve. The word is caught and starred from its start
  either way.
- **The arms race.** Measured over the lists' 60 words, these pass and are left to NAME-F1's "speed bump, not a wall": a
  word glued to another (55), split by a space (51), in Cyrillic look-alike letters (40), every letter doubled where the
  word has a double letter (14), typed in digits alone (3 - "a number is a number"). A zero-width mark or a soft hyphen
  inside a word passes the reader (59) but never reaches it: the wire's `visibleText` takes both out first, on every
  path.
- **The party pose's place label** (`wire.js` sanitizeLabel) is read whole, as a ship's name was. Only a modified client
  writes one, and its fix is the relay's bundle - a version of its own. Left to the next relay change.
- **Notes are starred at read time for moderators too.** A caught word starred harms nobody, and what a moderator
  decides on is what the filter missed, which they see as written. A note has no edit flow to carry stars back.
- **The profile and the wallet**: the card's parts, its pairs (seven merge, Legs' two being in different parts), its
  plaques' words, the 11px floor; the ledger's states (a count, `none`, the silver's why), the classic box's lines
  unchanged; a peer's look carries no item name to mask (`validLookItem`).

## Found on the way, not this PR's

- **PROF4-ram-kit-made** (`tools/mutants/prof4.json`) survives on main too (`c266acae`, run there with the same tool): no
  recipe has carried `later` since SEAT2b part two made the ram kit, so recipeOpen's `!r.later` decides nothing. The
  record needs a pin with a recipe marked `later`, or retiring with the flag.

## The versions

The relay's `world175` and the account service's `acct90` are TEXT-F1's and are not deployed, so the filter's fixes
ship under them: `world175` is re-hashed in place (`test/relayversion.test.js` - bytes `008c8756...` before it, the
LAW's own precedent for an undeployed row), and `acct90`'s comment names them. No pin moved for a version.

## The mutation sweep

- **The 223 records on the code the branch's second commit touched** (TEXT-F1, PROFILE-UI, WALLET-UI), judged at the
  merge's head: 222 dead, and PROF4-ram-kit-made (above).
- **The 27 records on the lines this audit changed**: 17 dead as they stood; 10 re-aimed by content, each keeping the
  fault it was written for (`audit31` AUDIT31-tab-hint-add-late, `board_ui` the read after the settle, the wallet at the
  foot and the guide a palace's always, `marketaudit` U4, `prof5` the market always, `seat2a4` the field's bounty and
  nearest, `text_filter` the ANYWHERE words in a sentence and in a name) - 9 dead, AUDIT31-tab-hint-add-late equivalent
  as recorded. MARKET-AUDIT U4 survived its re-aim: B5 left its arm one case, and the case is pinned.
- **The audit's own list**, `audit657.json`: 24 of 24 dead.

## Not verified here

There is no ARENA2 and no GPU in this container. The board's sheet (B1, B2, B3) was measured by the lens in Chromium on
main and on the branch before the fix, and the fixes are pinned by their rules and the DOM harness, not photographed
again. The filter's relay and service paths were driven through the real parse and the real Worker over sqlite, not
deployed.
