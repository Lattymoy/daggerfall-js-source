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

### It WAS the presence session's roster - ROSTER-G made it the channel's

CHAT-R1 wired the panel to `online`, the presence session, because the
chat links (`presence: false`) held no peers then: the relay's channel
welcome said `peers: []` and announced nobody. But the presence session
is the player's own map CELL - so the list beside a world-wide chat was
a list of the street, and Mac's first report on it was "Players dont
show in online". See ROSTER-G below; the pin now says the panel reads the
tab's own link, with `online` as the stand-in until that link exists.

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
  It checks the *effective* name through `entryVerdict`, which walks the
  host's own ladder - the field, then **the chosen character's** name -
  so a character called Cum is told here rather than discovering a
  silent rename in the world. An **empty** ladder is not a refusal:
  empty is Traveller, which is what the line beside the field promises
  and what `sanitizeName` really does. A name that was *typed* and has
  no letters in it (`___`) still is.
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

## AUDIT-CHATR - what the audit found

Eight findings. The first is the one that mattered: **the feature was
inert in the only host that has one.**

### F1 - the frame undid the Hide button, every frame

`createChatPanel`'s `render` took an option called `hidden`, meaning
*a window is over the HUD right now*. The closure it was declared
inside already had a `hidden` - the player's **put-it-away** state - so
the parameter **shadowed** it, and the one line the CSS actually reads:

```js
if (root.dataset.hidden !== (hidden ? '1' : '0')) root.dataset.hidden = hidden ? '1' : '0';
```

wrote the host's word into the player's slot. `render` only reaches that
line when the host's word is `false`, so **every drawn frame set
`data-hidden="0"`**. A player pressed Hide and the panel came back
before their finger was off the button.

The option is now `covered`, which is what it means. The two words are
different things and they may never share a name here again.

**Why eleven CHAT-R2 pins passed.** They drove `setHidden` and read
`paint`'s dataset. Not one of them drove a **frame**. This is the
F-SING lesson in its sharpest cut yet - *the door is not the key, the
key is not the route, the route is not the host* - with a new rung on
the end: **a source pin on the call site cannot see what the callee does
with the name.** `chat1.test.js` *did* pin the host's `render({ hidden:
... })` call, by regex, and matched happily throughout. The pin that
catches this drives a frame and asserts the dataset survives it.

### F2 - one ladder, written twice, and a dead button

The Online pane walked the name ladder in two places: `saves[0]?.name`
for the line it paints, and **the pressed card's own save** for the
press. A player whose *second* character was called Cum saw a clean
pane, pressed Play online, and got **nothing at all** - the press was
refused, and the repaint recomputed a verdict about the **first** save,
found it fine, and wrote an empty reason. A dead button with no
explanation is worse than a refusal.

`entryVerdict(...candidates)` is now the only walker of that ladder, it
takes the save it is **about**, and the refusal repaints about the save
it refused. The pin counts the call sites: **one**.

### F3 - a false alarm on a field nobody had touched

`checkName('')` answers `empty`, which is the right answer to *"is this
a name?"* and the wrong one for an optional field. On a browser with no
saves yet, the pane painted a red **"A name needs some letters in it"**
directly beneath a line promising *"an empty name shows as Traveller"* -
and `sanitizeName('')` really does hand back `Traveller`. The pane was
refusing what the relay allows.

`entryVerdict` lets an empty ladder through. `checkName` is unchanged:
its answer was never wrong, it was being asked the wrong question.

### F4 - the gate's own holes: two rules are on for `server/src` and off for `src`

`chatPanel.js` imported `ROSTER_ROWS_MAX` and never used it, and lint
was green. `eslint.config.js` sets `no-unused-vars` in the
`server/src/**` block and **not** in the `src/**` block - so the tree
that is very nearly all of the code has never been checked for the dead
identifier class at all.

Measured on this tree: **172** violations under
`{ vars: 'all', args: 'none' }` (190 with unused arguments counted),
overwhelmingly dead imports.

**And the rule that would have caught F1 is off too.** `no-shadow` is
what a shadowed `hidden` *is*, by name, and it is not in the `src/**`
block either. Measured: **111** violations, the worst of them in
`scenes/world.js` (20) and `scenes/worldModes.js` (11).

So the two structural findings of this audit - a dead import and a
shadowed parameter - are each exactly one eslint rule that the tree's
own config already applies to `server/src` and does not apply to `src`.
That is the finding; it is bigger than this page.

Neither rule is turned on here, and that is a scope call rather than a
shrug. 283 sites across some sixty files would make a chat-roster PR
unreviewable, and **neither cleanup is mechanical**: an unused ESM
import may still be doing side-effect work (module registration), and
renaming a shadowed binding in a 9,000-line host is a behaviour change
until it is read. It wants its own slice, with its own audit. Named
here, with numbers, so it is not found a third time.

### F5 - a `whoRows()` export "for the pins" that no pin called

The panel exported an accessor whose stated justification was a use
that did not exist - the pins read the drawn column out of the fake
document, which is the stronger reading. Deleted rather than pinned
into life.

### F6 - the pane promised something the code does not do

Under the name field: *"Up to 24 plain letters and digits; anything else
is dropped."* `sanitizeName` keeps every **printable ASCII** character,
so `Bob Smith` and `Bob!!!` survive whole; what it drops is the accents
and the emoji. A player reading that line would have expected the space
in their name to vanish. The line now says what the function does, and
the pin **drives `sanitizeName`** rather than reading it.

Two more claims struck in the same pass, both true about the mechanism
and false about *this* call:

- `roster.js` said `sensitivity: 'base'` "puts accented names where a
  reader looks for them (Ä with A)". Every row has been through
  `sanitizeName` first, so an accent never reaches the sort.
- `nameFilter.js` said its accent fold is "why the ordering in roster.js
  sorts accents with their base letter" - the same non-event. The fold
  does real work, but only at the **entry pane**, which is the one place
  a name is read before `sanitizeName` has touched it.

### F7 - the Ledger named neither new file

`roster.js` and `nameFilter.js` both end with *"Ledger A row (ONLINE)"*
and **no Ledger row named either of them**. The Ledger's own law is
*"if a departure or gap is not on this page, it does not exist"*, which
is only usable as a gate while it is true - a later audit greps the
Ledger to decide *approved, or bug?* and gets the wrong answer. The
ONLINE row now carries CHAT-R, NAME-F and this audit, and links this
page.

The gate that says so (`doctrine.test.js`) was already in the tree and
already derives the answer from the source. It was simply not run to
green before the slice was called done.

### F8 - `1234` was never refused, and the file said it was

`checkName`'s own header promised *"`___` and `1234` are not names"*.
The leet map reads `1234` as **`iea`** - letters, so it passes, and
always did. The behaviour is right (a daft name is not a rude one); the
claim was wrong, which is worse than either, because the next reader
would have taken it for a law the pins enforce. What really comes to
nothing in stage 1 is the separators: `___`, `---`.

Found by writing a new comment that copied the old one's example. **A
false claim propagates by being quoted**, which is the argument for
driving every claim rather than reading it.

### Considered, and left alone

**The Hide button lives inside the open box**, so a player must press
Enter once before they can put the chat away. That reads backwards
until you notice the state is **remembered across launches**: the two
steps are paid once, ever. Adding a second control to the closed state
would put permanent chrome on screen for the player who wants *less* -
which is the opposite of the ask.

### And a pin reddened on its own prose, for the FOURTH time

Re-aiming `chat1.test.js`'s host pin at `covered:` put a four-line note
between the brace and the key explaining why the option is called that -
and the pin's `\s*` cannot step over prose, so the explanation reddened
the gate. Stripped, as the three before it were. **A pin that reddens on
its own explanation teaches the next reader to delete the explanation**,
which in a port whose records are the deliverable is the expensive
failure mode. Four occurrences is a pattern: a source pin should strip
comments *by default*, not once it has been bitten.

### The second campaign

16 further mutants against the changed code - `entryVerdict`, the
`covered`/`hidden` split, the menu's wiring, the roster's sort - **16
killed**, one after a pin was re-aimed. That pin asserted
`entryVerdict('   ', 'Cum')` was refused, which is true **both with and
without** the trim it was meant to be pinning: untrimmed, the spaces
count as a filled field and `checkName` answers `empty`. Both readings
say `ok: false`, so the pin had to ask **which** refusal it got. *A pin
that cannot tell the two answers apart is not pinning either of them.*

## Not seen on a GPU

No GL and no ARENA2 here. The roster's order, the hide state and every
filter verdict are driven in node; **nobody has looked at the column**.
Worth a pass on a machine that can render it: open the chat with a peer
in the room, hide it, reload, and try to name yourself something rude.

## ROSTER-G - the roster is everyone online (2026-09-16)

Mac: "Players dont show in online and the roster naming itself seems
hardcoded."

**What it was.** Two findings, one root. The request (CHAT-R1) was "all
currently online players"; the panel read the PRESENCE session, whose
peers are the player's own map cell, because the one room every player
is in - the world channel - had no roster: CHAT1 priced a channel as
lines alone, so its welcome named nobody and it said no join and no
leave. A friend two towns over was online, in the same chat, and absent
from the list. Verified end to end before the fix: the live relay, the
session, and the real panel in Chromium all did exactly what the code
said - the code said the wrong room.

**The relay.** A channel's hello is told who is in the channel: `{ id,
name }` - no look, no pose, nothing is drawn from a channel and the
hello path reads no storage, so it stays as cheap as CHAT1 priced it.
The list is socket order (nearest-first has no meaning in a channel),
cut at `CHAT_ROSTER_MAX` (512: above a full place room and above the
panel's own 200 rows, below the channel's 2048 sockets), and `n` beside
it is the true count. The channel says its joins (`{ id, name }`) and
its leaves; it still says no host, because it has none. `RELAY_VERSION`
is `world77`.

**The client.** A channel link holds the roster it is told through the
same `_member`/`_unmember` a place uses. `world.js` hands the panel the
ACTIVE TAB's link, with `online` as the stand-in until it exists. The
header reads the room's count only when the welcome's list was CUT (a
whole list counts itself), and while kept, every join and leave the
channel says moves it - the browser run that drove this found the
first cut: a count that outlived its rows said three when one had
left.

**The naming.** The `#tag` is the tie-breaker for two players with ONE
name - `net/roster.js`'s second sort clause, the chat line's own
suffix - and drawn beside every name it read as a code somebody had
hardcoded. It is drawn only beside a name another row shares.

**Also found on the way.** The local relay could not start:
`wrangler dev`'s workerd refuses a worker entry whose named export is
a string, and SLAM13 had re-exported `RELAY_VERSION` from
`server/src/index.js`. Production's runtime let it through, so nothing
caught it until a local relay was needed to reproduce this. Fixed as
LOCALDEV1 (`world76`): the entry exports handlers alone, every pin
reads `wire.js`.

**Driven.** `test/net/rosterg.test.js` (4): the channel's welcome by name
with the count, the join and the leave said and no host, no look in
storage; the cut at `CHAT_ROSTER_MAX` with the count uncut; a channel
link holding the roster through welcome, join and leave, the cut count
following them and a whole list counting itself; the wiring and the
conditional tag by source. And in Chromium against a local relay: two
players in other cells appear in the roster, two Bobs carry tags and
FarAway does not, a leave drops the row. Mutants:
`tools/mutants/rosterg.json` - **14 mutations, 14 dead**.

## TITLE-C - a chat line wears no title (2026-10-12)

Mac: "I also want to remove titles from appearing in the chat".

TITLE-R took the title off this page's roster and kept it on a chat line ("Titles should remain over names and within
chat itself"), where CHAT-FIT had laid it, before the name. A line now wears what a roster row wears: the name, then
the guild's tag and the glyphs. The title is worn over the head and on the Inspect card.

- `ui/chatPanel.js` badgeNodes lays the badge AFTER the name alone, and a line's parts are the time, the name, the
  badge, the tag and the text. The `.dfchat-line-title` rule went with it - a rule for no element is a rule for
  nothing - and the panel imports no title helper.
- **Keyed by what is drawn.** The badge pass compares a line's badge by what it DRAWS (`badgeKeyOf`: the glyphs and
  the tag), CHAT-R's own law for the roster's repaint, on a line: a title put on or taken off mid-conversation re-lays
  nothing.
- **Untouched**: the Dungeon Master's `/dm` lines keep the title's orange - a voice's colour, not a title on a name;
  a letter's sender line keeps its title - the letterbox, not the chat.
- **Pinned**: `test/ui/chatfit.test.js` (7), its line pins re-aimed - no title on a line or in the peek, no title rule
  in the sheet, a title alone re-laying nothing; `test/ui/enhanced/acc3wear.test.js`, `test/net/guild1c.test.js`,
  `test/ui/shadowfang.test.js` and `test/ui/chatsize.test.js` read the panel's new source. In Chromium,
  `tools/chatFitProbe.mjs`: 12 of 12, every line's title null and the glyphs where they were. Mutants:
  `tools/mutants/titlec.json` - 4, all dead; `tools/mutants/chatfit.json`'s layLine record and
  `tools/mutants/titlen.json`'s roster record re-aimed at the new source - 40 of 40 dead across the three.

## NAME-AS - what a player is called online is theirs to choose (2026-10-12)

Mac: "I want to add an option to the profile menu where players can toggle to use their account name or character
name for ingame use". The name a player is read by online is the account's, or - their choice, on the profile card -
the realm character's they play. Two things on this page carry it: NAME-F's filter is what a chosen character's name
must pass to be worn (the mint asks the token's own law, `nameIsIssuable`, and names the word it caught), and the
roster's `#tag` is still the tie-breaker for two players with one name, which characters' names make more common. The
record is `06-Systems/Accounts-And-Cloud-Saves-Arc.md` NAME-AS.

## HIDDEN-UNCOUNTED - a hidden staff member is in no count, their own included (2026-10-24)

Mac: "Invisible players dont count towards the online count". The invisible player here is a hidden staff member (Hide
me, STAFF-PANEL5-HIDDEN), not the Invisibility spell: a concealed player is still online and still counted (INVIS-NET
takes them off the Nearby list and the F key's plaque, never off the World list or its count). No DFU member:
Daggerfall has no online. Audited the next day: `01-Overview/audits/Audit-Hidden-Uncounted.md` - every sentence below
is as it stands after it.

**What it was.** The relay already left a hidden socket out of every roster and count (`server/src/staffHidden.js`,
NAMED BY NOBODY; `test/net/staffpanel5hidden_relay.test.js` pins the welcome's, the join's, the leave's and the hub's
`n`), so every other game's "Online - N" left the staff member out. Their own game did not: `rosterRows` always pushed
the player's own row and counted it, so a hidden staff member read one more than everyone else - themselves. And the
guild's Members page counted them online to every guildmate (AUDIT C1, below).

**The fix, client-side for the chat** (a relay byte is a `RELAY_VERSION` and its law's hash, for a count the relay
already gets right):

- `net/online.js` `hidden` is read off the socket that stands for the session's room NOW - its own hello's token's
  `hd` (`tokenHidden`, moved from `net/staffMap.js`, which hands the same function on): a first hello, Hide me's
  relink (`scenes/staffFollowHost.js` relinkGame, every room opened again on a fresh token), a rehello's swap and a
  halo promoted at a crossing each answer for the socket the relay holds (AUDIT L3). A session that has said no hello,
  or whose hello went without a token, is not hidden - and a tokenless hello is refused by the relay ("sign in to play
  online"), so it is counted by nobody either; its own list shows its own row, as any refused player's does.
- `net/roster.js` `rosterRows` pushes no own row while the source is `hidden`; the Party, Guild and Nearby sources
  carry their link's mark, and a placed tab's (Region, Trade, LFG, a language's) is `placedRosterSource` - out of
  `bootWorld`, which now wires one call where it built the object.
- The hub's count (`{t:'n'}`) is read without a seat of mine while hidden (`_seatN`, AUDIT L1 = C2): its rule read
  `+ 1` for a seat a hidden socket never has, so a count one past the link's own shard's was thrown away, and its
  floor of one never took a count of nobody (AUDIT L2).
- The guild: a hidden staff member reads as last online the moment they hid, to every guildmate and to themselves
  (`11-Multiplayer/Guild-Overhaul.md` GUILD-SEEN, AUDIT C1; acct183).

**Left as it is.** The relay's welcome to a hidden joiner counts the joiner (`others.length + 1`; on a hub shard
`_hubN` of it, the bus's count or the shard's own, whichever is more), and the client keeps a welcome's `n` only past
the peers it named plus one - the welcome's own `+ 1`, kept as the relay counts it. So a hidden screen reads one too
many only where that `n` has the joiner in it AND the list was cut (more than `CHAT_ROSTER_MAX` visible in the room - a
plain channel, Trade, LFG or a language's, which are not sharded, or a shard holding the hub's whole count), until the
room says its next count; and it reads one too few, for a moment, only where the bus's count is exactly one past its
own shard's at the welcome, until the next count or who-answer. Taking the joiner out of the welcome's count is a relay
change for the next `RELAY_VERSION`.

**Driven.** `test/net/hiddenuncounted.test.js` (8): over the real relay, its rooms saying their counts each
HUB_COUNT_MS and its closes reaching the game - three games on the hub's shards, a hidden staff game's World tab
reading the hub's count both players read, with no row of its own and nobody listing it, and with Hide me off a
player; a join on another shard counted at once and a count of nobody taken, with no who-answer between; Hide me and
Show myself mid-session through the real relinkGame, 3 then 2 then 3; a halo promoted at a crossing, both ways; every
tab's source carrying the mark and a placed tab keeping every field; the token's mark one function.
`test/server/hiddenuncounted_guild.test.js` (1): the guild over the real Worker. `test/net/scale5c.test.js`'s wiring
pin reads the placed tab's new home. Mutants: `tools/mutants/hiddenuncounted.json` - **24 mutations, 24 dead**; the
roster's, the guild's and the hub count's older records re-aimed by content (`acc3c.json`, `guild1c.json`,
`guild1.json`, `guildseen.json`, `scale5c.json`) - 9 of 9 dead.
