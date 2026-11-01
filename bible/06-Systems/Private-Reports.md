# Private reports

A player tells the developers about an exploit, a bug or a security hole from inside the game, and only the named
readers can read it. Reports go to the account service and nowhere else: no chat log, Notice Board, letter or GitHub
issue. The player meets it through `/bug` or the mailbox window's **Report a bug or exploit** button. It is built on
the server's post (the mailbox). DFU has no online service, so there is no DFU counterpart.

## How it works

**The player's side.**
- **Door.** The mailbox window has **Report a bug or exploit** for every player and **Private reports** for a reader
  (`src/ui/enhanced/enhancedPost.js` `reportDoors`). `/bug` opens the mailbox window on the form from anywhere, on
  either skin (`src/net/chatCommands.js` `mailboxCommandOf`). `/report <name>` is a different thing: chat safety's
  report of a player to the moderators.
- **Form** (`src/ui/enhanced/enhancedReport.js`). A kind (exploit, bug, or account or server security), a title, and
  what happens and how to repeat it, with a character counter. The form says what goes with the report: the username
  and the build, with whether it is the desktop app or a browser (`src/net/privateReport.js` `reportContext`).
  Nothing else is sent: no location, no user agent, no save.
- **Typing is safe.** A redraw updates only what moved; the pane is rebuilt only when `reportPaneKey` changes. Every
  control carries `data-focus`, so a rebuilt face restores focus and caret. Escape leaves from inside a field; a held
  key repeats in a field.
- **One send is one report.** The client mints a `rid` for the cleaned words. A lost answer asked again returns the
  same report (`repeat`); a changed kind, title or text is a new send. One send at a time. A send that lands clears
  the form only if it still holds the words sent. The draft lives on the post box for the sitting.
- **The desk is one account's.** Signing out or in clears the draft, the list and a reader's inbox; an answer that
  lands under another session is dropped.
- **The reporter's list.** The player's reports, newest first, with title, kind, day and state: **Sent**, **Read by the
  developers**, **Fixed**, **Won't fix** or **Duplicate**. The service never sends the words back or names the reader.
  It is re-read each time the form opens.

**The readers' side.**
- **Notice.** A reader's post box answer (`/v1/post/box` and the heartbeat's post part) carries
  `reports: { unread, open }`; nobody else's does (`server-account/src/post.js` `postBoxOf`). A rise is said on the
  world tab as a count only, with where to look, never a report's words.
- **Inbox.** Open reports, unopened first then newest; closed, last closed first. Pages of `REPORT_INBOX_MAX` (100)
  with **Show older reports**. Opening shows the words and build and stamps it read by the first reader only. A report
  can be closed as fixed, won't fix or duplicate, and reopened; reopening clears the close and the read stamp stays
  as it was. A reader removed from the list loses the inbox at the next refusal.

**The service.** Table `private_reports` (`server-account/migrations/0129_private_reports.sql`), one report per
`(from_id, rid)`, deleted with its account (`CASCADE`). Five POST routes, each needing a session: `/v1/report/send`,
`/mine`, `/inbox`, `/read`, `/close`. A guest is refused `report-needs-account` (403), since nobody could follow up a
device's report. Context is kept in its shape only (update number, build hash, `desktop` or `browser`).

## Rules

- Readers are `REPORT_READER_HANDLES` in `server-account/wrangler.toml`, read at every call
  (`server-account/src/reports.js` `isReportReader`). Being a developer or moderator gives no access; every extra
  reader is one more person who could use an exploit before it is fixed. An empty list is valid.
- Reports are never read in an Actions log: the repository and its workflow logs are public. Readers read in the game.
- Bounds, shared by both ends (`src/net/reportLaw.js`): title `REPORT_SUBJECT_MIN`..`MAX` (3-80), words
  `REPORT_WORDS_MIN`..`MAX` (10-3,000), counted in code points. `REPORT_SEND_MAX` (5) an hour (`report-rate`, 429),
  `REPORT_OPEN_MAX` (20) open (`report-full`, 409). A full queue is refused before the hour is counted, and the open
  bound is also the insert's `WHERE`, so racing sends cannot pass it. A repeat `rid` is answered before either bound.
- The send route reads up to `REPORT_BODY_BYTES` (24 KiB); the other four read the service's 4 KiB.
- Both ends clean text with `src/net/wire.js` `visibleText`; a title is one line.
- Every string goes through `t()`.
- `/bug` is read where `/mail` is. The offline town bench (`scenes/exterior.js`) has no online lane and no form.
- `SECURITY.md` names `/bug`, and GitHub's private vulnerability reporting where the Security tab offers it.

## Code and tests

- `src/net/reportLaw.js` - kinds, states, bounds, shared by client and service
- `src/net/privateReport.js` - the client desk and `reportContext`
- `src/ui/enhanced/enhancedReport.js`, `src/ui/enhanced/enhancedPost.js` - the form, the inbox, the doors
- `server-account/src/reports.js` - the routes' work, the reader check, the bounds
- `test/server/private_reports_service.test.js` - the table, sends, bounds, races, the reporter's list, the inbox,
  stamps, the reader's count
- `test/net/private_reports_client.test.js` - the desk over the real service, the form and inbox on a fake DOM, one
  account's desk, the doors

## Open

- A reader cannot write back to a reporter.
- The Privacy Policy's retention paragraph names only chat-safety reports; whether it names private reports is Mac's.
- GitHub's private vulnerability reporting switch is a repository setting, not in this tree.
