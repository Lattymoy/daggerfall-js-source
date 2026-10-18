# AUDIT PRIVATE-REPORT (2026-10-17) - the private reports, audited

Mac, of PRIVATE-REPORT (`06-Systems/Private-Reports.md`; pull request #991, branch `ccr-342cb647-0ui0li` at
7959d3354): **"Audit this"**. This page is the findings, each with its verdict. What the audit changed is written into
the record's sections as they now stand, each marked AUDIT PRIVATE-REPORT and its id.

## How it was run

Five lanes, each a cold adversarial reader of a FROZEN snapshot (a worktree at 7959d3354 - `Home.md`'s DO NOT FIX WHILE
THE VERIFIER IS READING: the fixes went into the tree while the lanes read the snapshot), each told to prove a finding
- a repro run against the real code, or the code quoted with a concrete trace - before reporting it; then the author's
pass, every finding reproduced or traced before it was acted on:

| Lane | Over | How |
|---|---|---|
| SVC - the service | `server-account/src/reports.js`, the five routes and the send's body bound (`index.js`), migration 0127 (0129 since the merge of INT16-INT19), `src/net/reportLaw.js`, the reader's count (`post.js`, `heartbeat.js`) | the real Worker over the test D1 (`test/accountDb.mjs`); probe tests; a module hook serving a mutated copy of one file, so the snapshot stayed untouched |
| CLI - the client's state | `net/privateReport.js` `ReportDesk`, `net/serverPost.js` `PostBox`, `chatCommands.js`'s `/bug`, the world host's line | probe tests over the real service: an account switched on one sitting, answers landing out of order, the counts |
| UI - the window | `ui/enhanced/enhancedReport.js`, `enhancedPost.js`, `enhancedMenu.js`'s landing and keys, `pauseDoor.js`, `enhancedStyle.js` | headless Chromium on a probe page over the real modules: a face rebuilt mid-typing, keys held and pressed, focus after every act, the accessibility tree, contrast, 320 to 1280 px |
| DOC - the record | `Private-Reports.md`, `SECURITY.md`, the README, the index lines, the PR's text, all 67 new rows in each of the 13 languages | every claim against the code and the repository's settings; every row read |
| TEST - the pins | both test files, `privatereport.json` and the 13 re-aimed records, the Testing.md rows | probe mutants against the tests; recounts by the manifest's method |

What reached a player: nothing (the pull request is unmerged and its account version undeployed). On the branch: the pause face
rebuilt mid-typing took the player's place and the next Space changed the report's kind (UI-1); Escape did nothing
anywhere in the form `/bug` lands in (UI-2); another account on the same sitting found the last one's draft, its list
and a reader's opened reports (CLI-1); a title with emoji in it could be refused as a full queue (SVC-1); and the
reader's notice sent them to the form, not the inbox (CLI-6).

After the fixes the UI lane's Chromium probes were run again on the fixed tree (a probe server over the working tree):
the face re-render keeps the words' focus and caret, Escape leaves from every field, a held Space or Enter types five
times, the inbox's focus, counts and failed look are as written below. That run found one residual of UI-3 and UI-4 -
a send answered in a face rebuilt mid-send was said in the new form with the focus left on the page's body - fixed:
the pane that says a send's end gives the focus (`composePane`'s `focusFor`), pinned.

## Findings

### Lane SVC - the service

| # | Sev | Finding | Verdict |
|---|---|---|---|
| SVC-1 | MED | The law counted UTF-16 units, the table's `length()` code points, and `INSERT OR IGNORE` skipped a row a CHECK refused: two emoji passed the law as a title of four, the table refused it, and the send answered `report-full` | FIXED: `charsOf` (code points) on both ends and in the form's counter; `ON CONFLICT (from_id, rid) DO NOTHING`, so a CHECK that ever refuses is said aloud; pinned (emoji titles at both edges, a race at the open bound), mutants |
| SVC-2 | LOW | A second, private character law: zero-width spaces, soft hyphens and a direction override passed | FIXED: `wire.js` `visibleText`, line by line, a tab a space first; pinned, mutants |
| SVC-3 | LOW | A send refused for a full queue cost one of the hour's five, so a report closed meanwhile was still refused `report-rate` | FIXED: the full queue is said before the hour is counted; the insert keeps its own bound for a race; pinned, mutants |
| SVC-4 | LOW | The inbox was one page of 100: past it, the oldest unopened report was reached only by closing the noise above it | FIXED: `page` and `more` (`REPORT_INBOX_PAGES` bounds the offset); the window's **Show older reports**; pinned on both ends, mutants |
| SVC-5 | LOW | "Nobody else's box costs a statement" was unpinned | FIXED: a reporter's box and heartbeat run no statement naming `private_reports`, a reader's does; mutant |
| SVC-6 | NIT | Opening a report again stamped it read, so an unread report told its reporter "Read by the developers" | FIXED: `open` reads nothing (`CASE`); pinned, mutant |
| SVC-7 | NIT | Two `REPORT_BODY_MAX` exports in one Worker, one characters and one bytes | FIXED: `REPORT_WORDS_MIN`/`MAX` |

Checked clean: a guest refused on all five routes, a non-reader before any statement, a banned reader refused; the
readers' list read every call and case-folded; no route answers `read_by`, `closed_by` or `rid`; nothing else reads
`private_reports` (the service, the workflows, the tools, the realm exports); every value bound; the `rid` scoped to the
account and answered before every bound; the open bound atomic under a race; malformed words never counted against the
hour.

### Lane CLI - the client's state

| # | Sev | Finding | Verdict |
|---|---|---|---|
| CLI-1 | MED | The desk was never reset: another account on the same sitting found the last one's draft and titles, and a reader's opened reports answered from the copy to an account that may read none | FIXED: the box clears its desk on a sign-out and a switch, the desk clears itself at its own next call under another session, an answer that set out under one session is never taken under another (`_stale`, the box's `_take`), and `not-report-reader` drops the inbox and the opened reports; pinned, mutants |
| CLI-2 | MED | The desk's counts never moved the box's: a report read stayed on the envelope until the next look, and a new one after it was never said | FIXED: `onCounts` - the desk's counts are the envelope's; pinned (at once, and the next rise said), mutants |
| CLI-3 | LOW | A send's look at my list was folded into a look already out (ASYNC NEVER DROPS) | FIXED: coalesced - one more look after the one out; pinned, mutant |
| CLI-4 | LOW | Inbox answers were taken in the order they arrived: an older look put a report just closed back in the open list | FIXED: a look number a list; pinned, mutant |
| CLI-5 | LOW | My list was looked at once a sitting | FIXED: each time the form opens; pinned, mutant |
| CLI-6 | LOW | The reader's notice said "Type /bug", which opens the form | FIXED: "Type /mail, or open the mailbox beside the hourglass, and press Private reports."; the 13 languages redrafted; pinned |
| CLI-7 | NIT | The form's no-session refusal was the post's untranslated "...to receive post" | FIXED: the window's kit says `report.signIn` for `signed-out` |
| CLI-8 | NIT | The rid was dropped on any raw change: a space typed and deleted after a lost answer sent a second report | FIXED: the rid is keyed to the cleaned words; pinned, mutants |
| CLI-9 | NIT | A draft changed while a send was out was wiped when it landed | FIXED: emptied only if it still holds the words that went; pinned, mutant |
| CLI-10 | NIT | The desk took a negative count the box refused | FIXED: one shape check (`countsOf`) |
| CLI-11 | NIT | The record said the counter shows the characters left | Same as DOC-8 |

Checked clean: `/bug`'s grammar and its refusal of anything after it; no collision with CHAT SAFETY's words, routes or
commands; the world host's line first in `onSend`, every exit `true`, past the code of conduct's gate (a private report
reaches no player); the four hosts as written; a double Send refused `busy`; the rid kept across every failure.

### Lane UI - the window

| # | Sev | Finding | Verdict |
|---|---|---|---|
| UI-1 | HIGH | The form is rebuilt with the pause face (a quest's clock, the cloud's answer): the window's controls carried no `data-focus`, so the focus and the caret were lost, and the fresh landing then took the focus to the first kind, where the next Space changed the report's kind | FIXED: every control carries `data-focus` (`keyed`), and the landing never takes a focus already in the window; pinned, mutants; seen again in Chromium |
| UI-2 | MED | Escape did nothing anywhere in the form, where `/bug` lands the focus | FIXED: `onKey` lets Escape through from a field inside `.px-postwin`; pinned, mutant; seen again in Chromium (the draft kept) |
| UI-3 | MED | Send dropped the focus to the page's body and it never came back | FIXED: the fields given back, then the focus - the title after a send, the field a refusal names, else Send; the law's own refusals keep theirs; pinned on a fake DOM whose disabled control takes no focus, mutants |
| UI-4 | MED | A send's end was said by the window that sent it, not the one standing (a face rebuilt, the window reopened) | FIXED: the desk keeps it (`lastSend`) and the pane standing says it once, and gives the focus; pinned, mutant |
| UI-5 | MED | The reader's count went stale on the envelope and the door | Same as CLI-2 |
| UI-6 | LOW | The focus fell to the window's Close (opening the inbox, a close's button gone with its state), where a reflexive Enter shut the window | FIXED: into the pane - the Open tab, the button in the pressed one's place, else the pane's first control; pinned, mutants |
| UI-7 | LOW | "Look again" failed in silence over a list held | FIXED: said, the rows kept; pinned, mutant |
| UI-8 | LOW | The close buttons stayed live while a close was out: two closes, two reloads | FIXED: down while one is out, and the desk refuses a second `busy`; pinned, mutants |
| UI-9 | LOW | The reader's notice sent them to the form | Same as CLI-6 |
| UI-10 | LOW | The pause window's repeat guard (AUDIT LEGACY III U1) ate a held Space or Enter in the report's words | FIXED: it stands down in a text field (`isTextEntryTarget`); its pin and mutant re-aimed; seen again in Chromium (five of each) |
| UI-11 | NIT | The counter was inside the field's label, so the field was renamed at every key | FIXED: outside it, `aria-describedby` |
| UI-12 | NIT | The record said the counter shows what is left and `update` touches the Send button and the list alone | FIXED in the record |
| UI-13 | NIT | The placeholder kept the browser's grey, 4.2:1 | FIXED: `var(--dim)`, as the skin's other fields; pinned |
| UI-14 | NIT | The form always landed on An exploit, the draft's kind another | FIXED: the draft's own kind; pinned, mutant |
| UI-15 | NIT | A failed open was said after the reader had left the report | FIXED: said only while that report stands |

Checked clean: a heartbeat's look, the box's errors and the desk's changes while typing keep the same field, focus and
caret; the draft across a close and a reopen; every box state's pane; Enter in the title sends nothing; every string
drawn as text (a body holding markup renders as text); no horizontal scroll at 320, 360, 390 and 1280 px with
unbroken titles and bodies and right-to-left text; both coats' contrast.

### Lane DOC - the record

| # | Sev | Finding | Verdict |
|---|---|---|---|
| DOC-1 | HIGH | SECURITY.md and the README sent a researcher with no account to GitHub's private vulnerability reporting, which is switched off for this repository (the API answered `enabled: false`) | FIXED: the page says to use the button where the Security tab shows one, and `/bug` where it does not; the README points at both. Switching it on is Mac's (Settings, Code security) |
| DOC-2 | MED | The good-faith section invited testing the Terms forbid and could be read as a promise of no action | FIXED in part: one sentence that the page does not change the Terms; how far to promise is Mac's |
| DOC-3 | MED | The notice told a reader "Type /bug" | Same as CLI-6 |
| DOC-4 | MED | The record said exploits were reported in chat and had spread; its cite says neither | FIXED: the slice's reason as it is |
| DOC-5 | LOW | `wrangler.toml`'s comment said `/report` | FIXED: `/bug` |
| DOC-6 | LOW | `serverpost_client.test.js`'s PIN MOVED comments said `/report` | FIXED |
| DOC-7 | LOW | The re-aimed records were miscounted (the record said two, the PR fourteen with one never touched) | FIXED: thirteen in eleven lists, named, in the record and the PR |
| DOC-8 | LOW | "A counter shows the characters left" - it shows the characters used | FIXED |
| DOC-9 | LOW | SECURITY.md said Marks; players read silver | FIXED |
| DOC-10 | LOW | SECURITY.md and the patch notes gave the mailbox's route as every player's; it is the enhanced skin's | FIXED: `/bug` on either skin, the mailbox on the enhanced |
| DOC-11 | LOW | "Every string goes through `t()`" was false on the no-session path | Same as CLI-7 |
| DOC-12 | LOW | `report.sentFrom`'s preposition bent the build's words into a case they lack (de, ru, cs, ro) | FIXED: a noun phrase in each |
| DOC-13 | LOW | French "de {from}" not elided before a vowel | FIXED: "envoyé par {from}" |
| DOC-14 | LOW | The Open tab was a report's state word, singular beside the plural Closed | FIXED: the list's own word, and its count (`report.tabOpen`, `report.tabOpenCount`); pinned, mutant |
| DOC-15 | LOW | The Privacy Policy's retention paragraph names the chat-safety reports alone | FIXED in the record: a private report is kept while its account is; the Policy's wording at its next revision is Mac's |
| DOC-16 | NIT | SECURITY.md said the list shows when a report was read; it shows whether | FIXED |
| DOC-17 | NIT | A private advisory is seen by its reporter too | FIXED: "only you and the maintainers" |
| DOC-18 | NIT | "The list holds titles and states only" - and kind and day | FIXED |
| DOC-19 | NIT | The record credited the table's CHECKs with what the law does | FIXED |
| DOC-20 | NIT | A "deleted account" phrase CASCADE never reaches, and wrongly cased | FIXED: such a report names nobody (`fromLine`); the key gone |

Checked clean: every other claim of the record against the code; SECURITY.md's routes, readers and states; the
Privacy Policy's quotes and version; the index lines and UI.md's count; every code comment's cites; all 67 rows in
each of the thirteen languages - meanings, register, the house's words for the developers, the mailbox and the
Notice Board, `/bug` intact, plural forms.

### Lane TEST - the pins

| # | Sev | Finding | Verdict |
|---|---|---|---|
| TEST-1 | MED | "Past its bound, never read" could not fail (the oversize body broke the words' law too), and the other routes' 4 KiB was unpinned | FIXED: good words padded past the bound answer `body`; another route at 4 KiB; mutants |
| TEST-2 | MED | "An account's" and "an hour's" were unpinned | FIXED: another account sends while one is held, the hour's last second held; mutants |
| TEST-3 | MED | The inbox's order was claimed in four places and pinned in none | FIXED: unopened first, then newest; mutant |
| TEST-4 | MED | The desk never reset | Same as CLI-1 |
| TEST-5 | MED | The law's and the table's units | Same as SVC-1 |
| TEST-6 | MED | "A changed draft is a new send" was pinned for the title alone | FIXED: the kind; mutants |
| TEST-7 | LOW | The closed list's members and order, and the other two closes, unpinned | FIXED; mutants |
| TEST-8 | LOW | The first reader's stamps unpinned | FIXED: a second reader and a close keep them; mutants |
| TEST-9 | LOW | The counts after a close unpinned | FIXED; mutant |
| TEST-10 | LOW | The title's 3 and 80 unpinned | FIXED |
| TEST-11 | LOW | The bounds read by name, so a moved bound moved nothing | FIXED: by number, and the refusal's sentence says 20; mutant |
| TEST-12 | LOW | "Read by the developers" never asserted | FIXED; mutant |
| TEST-13 | LOW | The notice on a sitting's first look, and "only a rise is said", unpinned | FIXED: a first look, and a fall at another sitting silent; mutants |
| TEST-14 | LOW | The desk's bookkeeping unpinned (the closed list after a close, a head read on open, the counts from the inbox, the Open tab's count) | FIXED; mutants |
| TEST-15 | LOW | The reporter's list's limit unpinned | FIXED; mutant |
| TEST-16 | LOW | Only the shape of `REPORT_READER_HANDLES` pinned - this list alone decides who reads unfixed exploits | FIXED: `"Lattymoy"` by name; mutant |
| TEST-17 | NIT | The body's refusal focus and other window details unpinned | FIXED in part: the body's focus pinned; Back's focus from the inbox and a report, the repeat's sentence and the guest pane's key are the UI lane's Chromium probes', not the suite's |
| TEST-18 | NIT | Testing.md's row claimed the unpinned order; the record named two of the re-aimed records | FIXED with TEST-3 and DOC-7 |

Checked clean: the 29 recorded mutants dead again; the 13 re-aimed records each one site, all dead; the Testing.md
counts and Suite line; no clock bomb in the route tests' hour; no tautologies.

## What stands

- 71 findings: 62 FIXED, two FIXED in part (DOC-2, its promise Mac's; TEST-17), and seven the same as another's
  (CLI-11, UI-5, UI-9, DOC-3, DOC-11, TEST-4, TEST-5).
- `test/server/private_reports_service.test.js`: 12 tests (7 before the audit). `test/net/private_reports_client.test.js`:
  7 (5 before). `tools/mutants/privatereport.json`: 84 mutants (29 before), all dead; `auditlegacy3.json`'s held-key
  record re-aimed by content at UI-10's line, dead; `serverpost.json` run again, 33 dead. Two source pins moved, each
  marked PIN MOVED: `auditlegacy3.test.js` (U1's guard) and `ft18_features.test.js` (the menu's field rule).
- Mac's to decide: switch on private vulnerability reporting; how far SECURITY.md's good-faith section promises; who
  else reads reports (`REPORT_READER_HANDLES`); whether the Privacy Policy names private reports at its next revision.
- Not verified here: the real Worker under workerd and D1 (`npm run account` needs wrangler); the window inside the
  real pause face in a browser (the probes mount the enhanced menu over the real modules on a page of their own).
