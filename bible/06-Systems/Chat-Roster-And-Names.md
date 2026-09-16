# CHAT-R and NAME-F - who is here, and what they may call themselves

Mac, 2026-09-16:

> Next up I want to implement a hide chat button, along with an
> attached sidepanel on the chat ui showing all currently online
> players in alphabetical order. Scrollable.
>
> Additionally, I want to implement a proper censoring system for
> players choosing their online name. Im seeing a lot of names like
> "Cum"

Two features, one conversation. Both land on the chat surface CHAT1
built and neither is a Daggerfall Unity member: DFU has no chat, no
roster and no online names. Ledger A row (ONLINE).

## CHAT-R - the roster

### The order is a module, not a sort call in a paint

`net/roster.js` is pure and has no DOM in it, which is the point rather
than a convenience: the panel is DOM and the session is a socket, and
the ordering law is neither. Being pure is what lets the awkward cases
be written down as tests instead of as hopes.

Three clauses, each with a reason:

- **by name, case- and number-blind.** `localeCompare` with `numeric`
  and `sensitivity: 'base'` is one call for both, so `zara` sits with
  `Zara` rather than after every capital, and `Player10` sits after
  `Player9` rather than between `Player1` and `Player2`.
- **then by tag.** Two players may share a name exactly - the panel
  shows `#tag` beside it for that reason - and a sort that left them in
  Map order would swap them whenever a pose arrived. **A list that
  reorders itself under a reader's cursor** is what this clause exists
  to prevent, and it is pinned by feeding the same peers in two
  different orders.
- **the player is IN the list, not on top of it.** A roster that pins
  you to the top is one you cannot find yourself in by reading. The row
  is marked instead.

### The column repaints on a CHANGE

`render` runs every frame and a peer's pose moves constantly. The rows
are keyed by what is actually **drawn** - id, name, self - so an
unchanged roster touches no DOM at all. Without that, a reader
scrolling the column would be fighting a rebuild sixty times a second,
which is the defect AUDIT CHAT C8 fixed for the message list. Taken
here before it shipped rather than after it was reported.

### The cap tells the truth

200 rows, and the heading counts **everyone**. A column that silently
stopped would under-report a busy room with nothing saying so - the
shape of lie this port keeps finding in its own records - so a cut list
prints `+N more`.

### It is the PRESENCE session's roster

The chat links join with `presence: false`: they carry lines and hold
no peers. A roster read off them would always be empty. `world.js`
hands the panel `online`, the session that actually holds the room's
members, and the pin says so in both directions.

## CHAT-R - the hide button

Hidden takes the peek, the hint, the open button, the status line and
the box, and leaves **one** control.

It does **not** destroy the panel. The log keeps filling, the unread
counts keep counting and the key listener stays on, because a player
who hid the chat has not left the room and the badge should be waiting
when they bring it back. The state is remembered across launches.

**And the open key stands down.** Enter is `ActivateCursor` - a key the
game itself wants - so a hidden panel must not pull the box back up on
the next press. That is the opposite of what the button was pressed
for.

## NAME-F - the filter

### The problem this is, and the one it is not

A word list is easy. **A word list that does not refuse Scunthorpe is
the whole job.**

Two failures pull opposite ways: a name that reads as a slur gets
through because it was spelled `C0ck` or `xXcumXx`; and a real name is
refused because a rude word hides inside it - Cumberland, Scunthorpe,
Penistone, Dickens, Cockburn, Assisi, Shitterton (a real Dorset
village). Mac chose the word-aware reading for exactly that reason.

### Two readings, then a soft match

1. **Normalise hard.** Fold case, map the leet alphabet, drop
   everything that is not a letter. Aggressive on purpose: it decides
   nothing, it only makes the next stage possible.
2. **A second, stretched reading** collapses runs of a letter, so
   `cccoooock` is found as `cock`.
3. **Match softly.** A word matches when it stands as a **word** - at a
   boundary, or wrapped only in the padding players actually use (`x`,
   digits, separators, a leading `the`) and a short closed set of
   English tails (`s`, `er`, `ing`…) so `Wanker` and `Tits` are caught
   while `Titus` and `Titan` are not.

The word handed to the stretched reading is the word **as written**,
never a collapsed copy. An earlier cut collapsed it too, so `coon` was
compared as `con` - and anyone called **Con** was refused as a slur.

### The cost, said plainly

It will be wrong in both directions sometimes. A determined player will
find a spelling this does not hold; the list is a speed bump, not a
wall. And one day a real name will be refused - which is why the
refusal **names the word it caught**, so a player with a legitimate
name knows what to change and can say the filter is wrong.

### Both ends, because one end is not a check

- The **pane** refuses at entry with the reason, and refuses to join.
  It checks the *effective* name: an empty field falls through to the
  character's own name, so a character called Cum is told here rather
  than discovering a silent rename in the world.
- **`sanitizeName`** replaces a refused name whatever the client sent.
  `server/src/relay.js` re-exports `wire.js` whole, so putting the
  filter **inside** that function is what carries it to the relay.
  `nameFilter.js` imports nothing, which keeps the worker's graph flat.

A check that only lived in the UI is a check a devtools console
removes.

### Chat lines are NOT filtered

Mac asked for names. A name is permanent, hangs over a player's head
and is read by everyone who never chose to talk to them; a line scrolls
away. `sanitizeChat` is untouched, and that is a decision rather than
an oversight.

## What the campaign found

36 mutants, 36 killed - **and two dead lines in the filter**, both
written as belt-and-braces and both braces on braces:

- a `stretchable` flag that read as a guard and was inert, because the
  stretched haystack has no doubled letters by construction;
- an explicit combining-mark strip, inert because NFKD splits the mark
  off and the `a-z` filter already drops it.

A pin also reddened on its **own prose** for the third time in this
port - a comment naming the thing it replaced - so the comment strip is
written into the assertion rather than learned again.

## Not seen on a GPU

No GL and no ARENA2 here. The roster's order, the hide state and every
filter verdict are driven in node; **nobody has looked at the column**.
Worth a pass on a machine that can render it: open the chat with a peer
in the room, hide it, reload, and try to name yourself something rude.
