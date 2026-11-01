# Chat roster and names

The chat panel's side column lists everyone online in the chat's current room, alphabetically, and a **Hide** button
folds the chat away. Online names pass a word-aware filter that refuses rude names without refusing real ones like
Scunthorpe or Cumberland. The player meets the roster beside the chat, the filter when choosing an online name, and
the same lists starring rude words in their own chat lines. DFU has no chat, roster or online names.

## How it works

**The roster order** (`src/net/roster.js`, pure, no DOM).
- By name, case- and number-blind (`NAME_ORDER`, a collator with `numeric` and `sensitivity: 'base'`), so `zara` sits
  with `Zara` and `Player10` comes after `Player9`.
- Then by tag, so two players with one name never swap places when a pose arrives.
- The player is in the list, marked, not pinned to the top.
- `#tag` is drawn only beside a name another row shares.
- At most `ROSTER_ROWS_MAX` (200) rows; the heading counts everyone and a cut list says `+N more`.
- Rows are keyed by what is drawn (id, name, self), so an unchanged roster touches no DOM.

**Which room.** The panel reads the active chat tab's link (World, Party, Guild, Nearby, Region, Trade, LFG, a
language), with the presence session standing in until the tab's link exists. A channel's welcome names its members
(`{ id, name }`, no look or pose), cut at `CHAT_ROSTER_MAX` (512) with the true count beside it, and the channel says
its joins and leaves. The header uses the room's count only when the welcome's list was cut.

**Hide.** Hiding takes away the peek, hint, open button, status line and box, leaving one control. The panel keeps
running: the log fills, unread counts count, and the badge waits. The state is remembered across launches
(`src/systems/uiPrefs.js`). While hidden, Enter (`ActivateCursor`) does not pull the box back up.

**A chat line wears no title.** A line is the time, the name, the badge (glyphs), the guild tag and the text
(`src/ui/chatPanel.js` `badgeKeyOf` keys the badge by what it draws). Titles show over the head and on the Inspect card.
The Dungeon Master's `/dm` lines keep their colour.

**A hidden staff member counts nowhere.** A staff member using Hide me is left out of every roster and count by the
relay (`server/src/staffHidden.js`), and their own client pushes no own row while its socket's token is marked hidden
(`rosterRows`, `src/net/online.js`). The guild's Members page shows them last online at the moment they hid. A player
under the Invisibility spell is still online and still counted.

**The name filter** (`src/net/nameFilter.js`, no imports so the relay's graph stays flat).
1. Normalise hard: fold case, map the leet alphabet, drop non-letters (`normaliseName`).
2. A second, stretched reading collapses repeated letters (`collapseRuns`), so `cccoooock` is found. The listed word is
   compared as written, never collapsed, so **Con** is not read as a slur.
3. Match softly (`standsAlone`): a listed word matches as a word, at a boundary or wrapped only in the padding players
   use (`x`, digits, separators, a leading `the`) and a short set of English endings. So `Wanker` is caught and `Titus`
   is not. `ANYWHERE` words are caught inside any word; `INNOCENT` words that hold a listed one pass.
4. `IMPERSONATION` refuses names like admin, moderator or server.

A refusal names the word it caught (`checkName`), so a player with a real name refused knows what to change and can
report it.

**Both ends.** The pane refuses at entry and refuses to join, checking the effective name through `entryVerdict` (the
field, then the chosen character's name). An empty ladder is not a refusal: it plays as Traveller. On the wire,
`src/net/wire.js` `sanitizeName` replaces a refused name whatever the client sent, and the relay re-exports `wire.js`,
so the relay enforces it. A character's name chosen as the online name (`06-Systems/Accounts-And-Cloud-Saves-Arc.md`)
must pass the same filter.

**Words in a line are starred.** `maskText` stars each caught word letter for letter inside `sanitizeChat`; a
name-shaped text (a rank's name, a custom class, a maker's mark, an item's new name) is refused, naming the word
(`textCaught`).

## Rules

- A hide-chat button and a scrollable, alphabetical side panel of everyone online (Mac).
- A proper filter for online names (Mac), word-aware so real names pass.
- Any human input is filtered, notes included (Mac): names are refused, sentences are starred.
- Titles do not appear in chat (Mac).
- Invisible staff do not count toward the online count (Mac).
- What a player is called online is the account name or the character name, their choice on the profile card (Mac).
- A check that lives only in the UI is no check; the wire enforces names.
- The filter is a speed bump, not a wall: a determined player will find a spelling it does not hold.

## Code and tests

- `src/net/roster.js` - order, rows, the room sources (`partyRosterSource`, `guildRosterSource`,
  `placedRosterSource`, `localRosterSource`)
- `src/net/nameFilter.js` - the lists, `checkName`, `entryVerdict`, `maskText`, `textCaught`
- `src/net/wire.js` - `sanitizeName`, `sanitizeChat`, `CHAT_ROSTER_MAX`
- `src/ui/chatPanel.js` - the column, Hide, the line layout
- `test/net/chatroster_namefilter.test.js` - the order, the hide state and the filter's verdicts
- `test/net/audit637_roster.test.js` - the roster audit's fixes
- `test/net/rosterg.test.js` - a channel's roster, its cut and count, the conditional tag
- `test/ui/chatfit.test.js` - a line without a title
- `test/net/hiddenuncounted.test.js`, `test/server/hiddenuncounted_guild.test.js` - hidden staff in no count

## Open

- A hidden joiner's welcome can read one too many where the welcome's list was cut, until the room's next count.
  Removing the joiner from the welcome's count is a relay change.
- The column has not been looked at on a GPU.
