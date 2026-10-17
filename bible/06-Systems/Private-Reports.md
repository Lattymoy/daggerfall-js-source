# Private reports

PRIVATE-REPORT (2026-10-17, Mac: "Can we add a private disclosure method for exploits/bugs with the client"): a player
tells the developers about an exploit, a bug or a security hole from inside the game. Only the readers that
`REPORT_READER_HANDLES` names can read it. Daggerfall Unity has no online service, so it has nothing to depart from:
the feature is the port's own, built on the SERVER-POST mailbox (`06-Systems/Accounts-And-Cloud-Saves-Arc.md`
SERVER-POST, `10-UI/UI-Arc.md` SERVER-POST).

## Why private, and why in the client

Before this slice the game had no private way in: a player who found an exploit could tell it only in chat or on
Discord, where every player could read it before it was fixed. The exploit audit
(`01-Overview/audits/Exploit-Audit-2026-10-11.md`) found dupes and gold farms by reading the code; the next one may be
found by a player first. A report sent from the client goes to the account service and nowhere else. It reaches no chat
log, no Notice Board, no letter and no GitHub issue. (AUDIT PRIVATE-REPORT DOC-4: this paragraph said exploits had been
reported in chat and had spread - its cite says neither.)

**Nothing reads the reports in an Actions log.** The repository is public, and so is every workflow run's log and
summary. The operator's workflows that read D1 (`sd-clears.yml`, `server-post.yml`'s dry run) print what they read,
so a report read that way would be published. The readers read reports in the game, through routes that need their
own session.

## The player's side

- **The door.** The mailbox window has two buttons under the post: **Report a bug or exploit** for every player, and
  **Private reports** for a reader (`ui/enhanced/enhancedPost.js`, `reportDoors`). `/bug` opens the mailbox window
  on its form directly, on either skin and wherever the player stands. It is `/mail`'s own door:
  `net/chatCommands.js` `mailboxCommandOf`, `ui/pauseDoor.js`, `ui/enhanced/enhancedMenu.js` at `'report'`.
  It is `/bug` and not `/report`, because `/report <name>` is CHAT SAFETY's (SAFE3, `11-Multiplayer/Chat-Safety-Arc.md`):
  a player's chat lines sent to the moderators. The two never meet. A private report is about the game and goes to its
  readers; a SAFE3 report is about a player and goes to the moderators' queue. This slice was written as `/report` and
  renamed at the merge that brought SAFE3 in.
- **The form** (`ui/enhanced/enhancedReport.js`). It asks what the report is about (an exploit, a bug, or account or
  server security, each with a line of what it means), a short title, and what happens and how to make it happen
  (a counter under the field shows the characters used of the 3,000, counted as the law counts them - AUDIT
  PRIVATE-REPORT DOC-8 UI-11: it is the field's description, `aria-describedby`, never part of its name). Before
  anything is sent, the form says what goes with the report: the
  player's username, and the build the pause window prints (`buildTag.js`, REL8), with whether this is the desktop
  app or a browser (`net/privateReport.js` `reportContext`). Nothing else is sent: no location, no user agent and no
  save.
- **The form is never rebuilt while the player types in it.** The window draws on every change of the box or the
  desk, including the heartbeat's look every three minutes. A report pane answers a draw with `update`, which touches
  only what moved: the Send button, the fields' being down while a send is out (and their values, when a send that
  landed emptied the draft), and the list under the form. The window rebuilds a pane only when its key changes
  (`reportPaneKey`). (AUDIT PRIVATE-REPORT UI-12: this said the Send button and the list alone.)
- **A face rebuilt mid-typing keeps the caret** (AUDIT PRIVATE-REPORT UI-1). The pause face itself is rebuilt by
  anything that renders it (the cloud's answer, a quest's clock), and the window with it. Every control of the window
  carries `data-focus` (`enhancedPost.js` `keyed`), the key `ui/domRepaint.js` gives the focus and the caret back by; and
  the window's landing on a fresh open (`/bug`: the draft's own kind, else **An exploit** - UI-14) never takes a focus
  already inside it. Before the audit the landing took it to the first choice, where the next Space changed the
  report's kind.
- **Keys.** Escape leaves the window from inside a field, as the notice and arena windows let it (`enhancedMenu.js`
  `onKey` - UI-2: `/bug` lands the focus in the form, and its Escape did nothing). A held Space or Enter types in a
  field (`pauseDoor.js`'s repeat guard stands down for a text field - UI-10: the guard, AUDIT LEGACY III U1's, ate
  every repeat).
- **A send is one report, however often it is asked.** The client mints a `rid` for the draft's CLEANED words
  (`ReportDesk.send`, keyed to `reportWordsOf`'s answer). If the answer is lost, the same send is asked again and the
  service answers with the report it already made (`repeat`) - however the raw text was touched between, a space typed
  and deleted (AUDIT PRIVATE-REPORT CLI-8). A change of the kind, the title or the words after a failure is a new send,
  never answered with the old one's report (TEST-6). One send at a time (`busy`). A send that lands empties the form
  only if it still holds the words that went (CLI-9). The draft lives on the PostBox for the sitting, so a half-written
  report survives the pause face being rebuilt, closed or reopened.
- **A send's end is said where the player is** (AUDIT PRIVATE-REPORT UI-4, ASYNC NEVER DROPS). The desk keeps how the
  last send ended (`lastSend`), and the first form standing in the page when it lands says it, once - a face rebuilt
  mid-send had the old form say it to a window no longer there. Said, the fields are given back and THEN the focus
  (UI-3: the title after a send, the field a refusal names, else Send; a focus given to a field still disabled went
  nowhere, and the press had left it on the page's body).
- **The desk is one account's** (AUDIT PRIVATE-REPORT CLI-1). The draft, the send's id, the list and a reader's inbox
  and opened reports belong to the session that asked for them. They go the moment another session stands in its
  place (the pause face's profile signs out and in) or none does: the box clears its desk, and the desk clears itself
  at its own next call. An answer that set out under one session and lands under another is nobody's, never taken -
  the desk's (`_stale`) and the box's (`_take`). Before the audit the next account's form held the last one's draft
  and listed its titles.
- **The reporter's list.** The player's own reports are listed under the form, newest first, each with **Sent**,
  **Read by the developers**, or how it was closed: **Fixed**, **Won't fix** or **Duplicate**. Each row holds the
  report's title, kind and day and its state (AUDIT PRIVATE-REPORT DOC-18: "titles and states only"). The service never
  answers with the words back, or with which reader read a report. The list is looked at each time the form opens
  (CLI-5: once a sitting, a report read or fixed since still said Sent).

## The readers' side

- **Who reads.** `REPORT_READER_HANDLES` in `server-account/wrangler.toml` lists them, read at every call the way
  `DEVELOPER_HANDLES` is (`server-account/src/reports.js` `isReportReader`, `titles.js` `handleList`). It ships as
  `Lattymoy` alone. Being a developer or a moderator gives no access: an exploit read by one more person is one more
  person who can use it before it is fixed. Adding a reader is a one-line, reviewed and deployed edit. An empty list is
  valid: the reports wait, unread.
- **Told when one comes.** For a reader, and only a reader, the post box answer (`/v1/post/box`, and the heartbeat's
  `post` part) carries `reports: { unread, open }` (`post.js` `postBoxOf`). Nobody else's box carries the key or
  costs a statement for it. The envelope counts unread reports with the post (`PostBox.waiting`). A rise is said on
  the world tab as a count only, never a report's words, because the world tab is read over shoulders and on streams
  (`postNoticeText`, `kind: 'reports'`) - and on a sitting's first look when any wait. It says where they are: "Type
  /mail, or open the mailbox beside the hourglass, and press Private reports." (AUDIT PRIVATE-REPORT CLI-6 DOC-3 UI-9:
  it said `/bug`, which opens the form.) The desk's counts are the envelope's (CLI-2): a report opened is off the count
  at once, not at the next look three minutes on, and a new one after it is said.
- **The inbox.** Open reports are listed with the unopened first, then the newest; closed reports are listed with the
  last closed first. Each row shows its kind, who sent it and when. The Open tab counts what is open, **Open (3)**
  (AUDIT PRIVATE-REPORT DOC-14: it was a report's state word). A list is a page of `REPORT_INBOX_MAX` (100), and
  **Show older reports** adds the next under the rows held (SVC-4: past a hundred, the oldest unopened report was
  reached only by closing the noise above it one at a time). A look that fails over a list held says so (UI-7), and an
  older look answering after a newer one is never taken (CLI-4). Opening a report shows its words and the build it
  came from, and stamps it read with the first reader's id - a second reader's opening stamps nothing. It can be closed
  as fixed, won't fix or duplicate, and opened again; every close is down while one is out (UI-8), and the focus lands
  on what stands in the pressed button's place (UI-6). Closing stamps when and by whom, and reads it if nobody had;
  opening it again clears the close and reads nothing (SVC-6: a report opened again unread told its reporter "Read by
  the developers"). A reader taken off the list loses the inbox and the reports they had opened at the refusal
  (CLI-1).

## The service

- **Table.** `private_reports`, migration 0129 (`server-account/migrations/0129_private_reports.sql`). One report per
  send per account (`UNIQUE (from_id, rid)`). An account that is deleted takes its reports with it (`CASCADE`), as it
  takes its letters. The table's CHECKs repeat the law's bounds; the law, asked before every insert, is what keeps a
  row the client could not read from being written (AUDIT PRIVATE-REPORT DOC-19). A CHECK that ever refused would be
  said aloud - a 500 - never read as a full queue (SVC-1: the insert was `INSERT OR IGNORE`, which skips a row a CHECK
  refuses as quietly as a twin's; it is `ON CONFLICT (from_id, rid) DO NOTHING`).
- **Routes.** Five POSTs, each needing a session, with every id in the body: `/v1/report/send`, `/v1/report/mine`,
  `/v1/report/inbox`, `/v1/report/read`, `/v1/report/close` (`index.js`, `service.js` `ROUTES`). A guest is refused
  with `report-needs-account` (403). A guest's row is a device, and nobody could follow up a report filed under it once
  storage is cleared. Every refusal word has a sentence (`net/accountClient.js` `REFUSALS`).
- **Bounds** (`src/net/reportLaw.js`, which both ends read). A title is 3 to 80 characters and the words are 10 to
  3,000 (`REPORT_SUBJECT_*`, `REPORT_WORDS_*` - SVC-7: never `REPORT_BODY_*`, CHAT SAFETY's byte bound's name in the
  same Worker). A character is a code point (`charsOf`), as the table's `length()` counts one (AUDIT PRIVATE-REPORT
  SVC-1: the law counted UTF-16 units, so an emoji counted twice - a title the table took was refused, and two emoji
  passed the law the table refused). Both ends clean the words by the house's one law, `net/wire.js` `visibleText`
  (SVC-2: a private control-character strip let zero-width spaces, soft hyphens and a direction override through):
  line by line, a tab a space first, each line's trailing space and the blank lines at either end gone; a title is one
  line, its whitespace collapsed. An account may send `REPORT_SEND_MAX` (5) an hour (`report-rate`, 429), and may hold
  `REPORT_OPEN_MAX` (20) open (`report-full`, 409). A full queue is said before the hour is counted, so a refusal for
  it costs none of the five and a report closed makes room at once (SVC-3); and the open bound is the insert's own
  `WHERE` too, so sends racing past that count cannot land past it. A send asked again under its `rid` is answered
  before either bound. The send reads its body to `REPORT_BODY_BYTES` (24 KiB), not the service's 4 KiB (`service.js`
  `MAX_BODY_BYTES`): 3,000 characters of any script past ASCII are past 4 KiB as UTF-8. The other four routes read the
  service's 4 KiB.
- **Context** is kept in its shape and nothing else (`reportContextOf`): an update number, a build hash, and
  `desktop` or `browser`. Anything else a client sends beside the words is dropped, never stored.
- **Version.** `ACCOUNT_VERSION` acct154 (acct152 then acct153, and migration 0126 then 0127, on its branch, renumbered past SAFE's and INT16-INT19's at the merges). It deploys with migration 0129 through `account-deploy.yml` on the merge to
  main. The site's form against a service not yet deployed is answered `not-found`, and the form says the service's
  sentence for a failure. Nothing is lost, because the draft stays in the form.

## The four hosts

`/bug` is read where `/mail` is. `scenes/world.js` (the streaming host's chat) asks `mailboxCommandOf`; that line
was rewritten in place, and `bootWorld` did not grow (`test/scenes/hostceiling.test.js`). `scenes/worldModes.js`
(interiors) and `scenes/dungeonContext.js` (dungeons) open their own pause at the name they are handed
(`openPauseAt`, unchanged). `scenes/exterior.js` (the fixed-city bench) runs no online lane, so it has no mailbox and
no report form, as it has no `/mail`.

## Privacy

The Privacy Policy (`privacy/index.html`, PRIVACY_VERSION 2026-10-17, SAFE's revision) already covers what a report
is: it lists "Support requests and communications with project staff" and "Error, crash, and diagnostic information"
among what is collected, and "Detect cheating, exploits, abuse, or unauthorized access" among its uses. This slice
writes no new version, and asks no account to tick again.
Reports are kept: the service deletes no account today, and a player's row removed by hand (a deletion request) takes
its reports with it (`CASCADE`). The Policy's retention paragraph names the chat-safety reports alone (deleted ninety
days after the case is resolved); a private report falls under its general rule and is kept while its account is
(AUDIT PRIVATE-REPORT DOC-15). Whether the Policy says so at its next revision is Mac's.

## Translations

Every sentence the form, the inbox, the notice, `/help` and the refusals say goes through `t()` (L10N4's ratchet) -
the form's "no session" too (AUDIT PRIVATE-REPORT CLI-7 DOC-11: it fell to the post's untranslated "...to receive
post"). The 68 new keys are drafted in-session for the thirteen whole languages (`tools/l10nInSession.mjs`). The twelve
still drafting owe them with the rest of their catalog. AUDIT PRIVATE-REPORT DOC-12 DOC-13: `report.sentFrom` is a
noun phrase where a preposition would bend the build's words into a case they lack (de, ru, cs, ro), and French's
"de {from}" is "envoyé par {from}" (no elision before a vowel). DOC-20: a report whose account is gone - which
CASCADE never leaves - names nobody, rather than a phrase each language must case (`fromLine`).

## SECURITY.md

`SECURITY.md` at the root is the public policy that GitHub shows on the Security tab. It names `/bug` in the game
(on either skin; the mailbox's door on the enhanced skin), and GitHub's private vulnerability reporting for holes in the
code or the servers that need no game account - **where the Security tab shows a Report a vulnerability button**, and
`/bug` where it does not (AUDIT PRIVATE-REPORT DOC-1: the repository's private vulnerability reporting was off when the
audit read it - the API answered `enabled: false` - and the page sent a researcher with no account to a flow that was
not there). That switch is Mac's to flip (Settings, Code security) and is not in this tree. The page also says what to
include, what counts (silver, not Marks - DOC-9), how to act in good faith under the Terms - with a sentence that it
promises nothing beyond what the Terms say (DOC-2: the wording is Mac's to strengthen) - and what happens next.

## Tests

- `test/server/private_reports_service.test.js` (12): the table and the doors, a send (its cleaning, its `rid`, its own
  body bound and the others' 4 KiB), the two bounds by number and by account and hour, a race at the open bound, the
  reporter's list, the readers alone, the inbox's order and pages, the stamps of a second reader and a close, a report
  opened again, the reader's count on the box and the heartbeat - and nobody else's box asking the table.
- `test/net/private_reports_client.test.js` (7): the desk over the real service (a lost answer asked again, the rid the
  cleaned words', a draft typed mid-send, the coalesced look), the reader's box and its notice, the form and the inbox
  in the mailbox window on a fake DOM (whose disabled control takes no focus, as a browser's), the inbox's pages, the
  desk one account's, and the doors.
- `tools/mutants/privatereport.json`: 83 mutants, all dead (29 before AUDIT PRIVATE-REPORT). The slice
  re-aimed 13 existing records in 11 lists by content at the lines it moved, all dead: the two SERVER-POST records
  (`serverpost.json`: the envelope's count, the classic skin's door), the `ACCOUNT_VERSION` lines (`bal9`, `br5`,
  `crafthold` twice, `fb1004d_knight_house`, `gatekeys`, `hackedgold`, `nameas`, `tech1`) and `HOST_COMMANDS`
  (`egaudit5_c`, `party-travel`) - DOC-7: this said two. The audit re-aimed `auditlegacy3.json`'s held-key record at
  UI-10's line, dead.
- `01-Overview/audits/Audit-Private-Report.md`: AUDIT PRIVATE-REPORT, the findings and their verdicts.

## Open

- A reader cannot write back to a reporter. A reply would be a piece of the server's post, which only the operator's
  workflow writes today, so that is a later slice.
- Whether any developer besides Mac should read reports is a line in `wrangler.toml`.
