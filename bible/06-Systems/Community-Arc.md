# The community arc - the players' own requests (COMM, opened 2026-09-23)

Mac, handing over a batch of Discord suggestions: "I wanna tackle each of these head on and be extremely thorough
and detailed", with two of his own - "For the profile suggestion. I think we develop a new enhanced UI element for the
player inspect interaction. Showing their glyph, name, title, stats and worn gear" and "I want to implement the
ability to click and drag the chat to resize/along with the text".

The requests, each with the slice that answers it:

| Who | Request | Slice |
|---|---|---|
| Starempire42 | "when you open the chat It automatically scrolls to the newest message" | CHAT-SCROLL |
| Mac | "click and drag the chat to resize/along with the text" | CHAT-SIZE |
| kurkku | "Global chat ... regional chat ... party chat" | CHAT-CHAN |
| Addison Knox | "Roleplay chat channels (IC/OOC)" | CHAT-CHAN |
| Addison Knox | "Chat dice-rolling" | DICE1 |
| Addison Knox | "Emotes, be it emojis or additional animations" | EMOTE1 |
| Janome | "a toggle key to switch between the inventories of enemies stacked on top of each other" | LOOT-STACK |
| kurkku, Mac | "a profile page that you can bring up when you're near them" / "glyph, name, title, stats and worn gear" | INSPECT1 |
| Addison Knox | "In-game mail lets players leave notes, contracts, or invitations even when the recipient is offline" | MAIL1 |
| Addison Knox | "Player journals ... shared in-world for storytelling" | JOURNAL1 |

None of these is a DFU member - Daggerfall Unity has no chat, no online and no stacked-body cycle - so every slice is
the port's own and rides Port-Ledger A's ONLINE row (the chat and the social slices) or a row of its own (LOOT-STACK).

## CHAT-SCROLL - an open lands on the newest line

Starempire42 on Discord, 2026-09-23: "Make it so when you open the chat It automatically scrolls to the newest message.
Currently when you open the chat it just stays idle so you have to manually scroll down to the newest message every
single time."

**The law it broke.** `ui/chatPanel.js paintList` decided whether the list follows the conversation by asking the list
where the reader was - "at the bottom, within 8px" - and that question was asked on the first paint after an OPEN, of a
scroller that was `display: none` until that paint. What a hidden scroller remembers is the engine's business:
Chromium keeps the offset (tools/chatScrollProbe.mjs measures it), other engines drop it to the top, and a top taller
than the box reads as "the reader scrolled up". A reader who HAD scrolled up before closing met the old place on every
open. Both are AUDIT CHAT C8's rule - keep a reader's scroll when lines arrive under them - applied to a moment it was
never written for: coming back is a new look, and the newest line is what a player opens the chat to read.

**The second cause.** The badge pass (CHAT-FIT) lays a title and glyphs into a line AFTER the list scrolled to its
bottom; a line that wraps under its badge grows, and the growth pushed the newest line under the fold on the very
paint that scrolled to it. The scroll is now the paint's last act, after every pass that can change a line's height,
and a badge that arrives on a later frame (a title equipped mid-conversation) measures the reader's place before it
re-lays a line and keeps a reader at the bottom there.

**What stands.** While the panel is open, C8 is untouched: a reader who scrolled up is left where they are. What
arrives under them is counted on a bar under the list - `N new - jump to newest` - which takes them down, and which a
reader who scrolls down on their own clears the same way. A tab change reads from its newest line (another
conversation). Both listeners are the elements' own; the panel still adds exactly one window listener (D5).

**Pins.** `test/chatscroll.test.js` (4) drives the panel over a fake that LAYS OUT - lines as tall as their text wraps,
badge parts included, a clamped scrollTop - so a hidden box that forgets its place, a badge that wraps after the
scroll and a reader who scrolled up are all real there. `tools/mutants/chatscroll.json`: 7, 7 dead.
`tools/chatScrollProbe.mjs` reads the real panel in Chromium: every open lands on the newest line, badged or not; a
reader who scrolled up keeps their place with the bar counting 3; the bar's click lands.

## CHAT-SIZE - the chat dragged to size, the text along with it

Mac, 2026-09-23: "I want to implement the ability to click and drag the chat to resize/along with the text".

**The corner.** A grip stands at the chat box's bottom-right corner - the BOX's, past the roster column (the first cut
put it at the end of the form's row, which the Chromium probe found in the middle of the box, 227px short of the
corner). A press captures the pointer to the grip, and the box is anchored at its top-left, so the grip's travel IS
the size's change: the WIDTH, and the text's scale with it - `width / 440`, the sheet's own width, bounded 0.8..1.8,
so the width runs 352..792 - and the HEIGHT, the list's lines (80px at the least, three quarters of the screen at the
most; the sheet caps it too). "Along with the text" is the width: every size the chat's TEXT is drawn at is
`calc(Npx * var(--dfchat-scale, 1))` - the lines, their tags, times, titles and glyphs, the hint, the status, the jump
bar, the roster's head, rows, tags and glyphs and its column's width, the field - so a wider chat is a bigger chat
whose lines wrap where they did, and a taller one is more history at the same size. What a THUMB presses does not
scale: the buttons and the tabs are AUDIT SOC C8's targets. Arrow keys on the focused grip step the two sizes by 20px
(stopped at the grip - the host's ring never walks), and a double click gives the sheet's own size back. A reader on
the newest line stays on it through the drag; a reader who scrolled up is not moved.

**The player's.** `uiPrefs` `chatWidth` / `chatListHeight`, CSS pixels, null for the sheet's own (so a player who never
drags gets the sheet byte for byte: nothing is written). Both are numbers, so the online lane's boolean pin (OL1) has
nothing to say about them.

**The friends panel.** `ui/socialPanel.js` stood beside the chat at a FIXED 466px (14 + 440 + 12) over 840px and under
it at a fixed 390px below that (AUDIT SOC C13, which found the two sharing a corner). A resized chat would have slid
under both numbers. The chat now publishes its footprint on the document - its width and its list height as the same
custom properties its own rules read, and `data-dfchat-fit` for the side: beside when 14 + the box + 12 + the panel's
360 + 14 fits the screen, which at the sheet's own size is exactly the old 840 - and the panel places itself off them:
beside, past the box's right edge; below, past the open box's floor (`min(220px, 34vh) + 170` IS the old 390 at the
chat's own size). The old two rules stand for a page with no chat. The fit is re-said on the frame the screen changes
(a rotate, a resized window), on a change only; the chat's one window listener stays the key's.

**Pins.** `test/chatsize.test.js` (5): the law (the scale IS the width; the fit at the sheet's size is the old
breakpoint), the drag (captured, both axes, kept across a session, published), the bounds, the keys and the reset, a
reader kept on the newest line (and one who scrolled up left alone, another pointer's move and a right press
ignored), the fit following the screen, and by source every text size on the scale and no button on it.
`tools/mutants/chatsize.json`: 13, 13 dead. Re-aimed: `chatfit.json`'s badge-pass record and `font1.json`'s chat-line
record (the line's size is the scale's now); two CSS pins moved to the new forms, `chatfit` (the roster column) and
`soc3` (the list's height), each with its default unchanged. `tools/chatSizeProbe.mjs` drags the real grip in Chromium
at 1440x900 and 900x900: 660px and 19.5px after a 220px drag, the list taller by exactly the travel, Send still 14px,
the grip clear of the Close button, the friends panel beside the box at 1440 and under it at 900 and over it at
neither, the size back after a reload, and the sheet's own size after a double click - 24 checks.

## CHAT-CHAN - four channels: World, Region, Party, Local, and the aside out of character

kurkku on Discord, 2026-09-23: "Global chat that everyone everywhere sees / regional chat that everyone in the region
can see (so players in Wayrest see messages from other players in Wayrest and so on) / party chat". Addison Knox, the
same day: "Roleplay chat channels (IC/OOC) keeps immersion intact by separating in-character dialogue from coordination
chatter".

**The four tabs, and the session each rides** (`net/chat.js` CHAT_TABS; the host is `scenes/world.js` chatStart):

| Tab | Who hears a line | What carries it |
|---|---|---|
| World | everyone online | the World channel's own link - the hub, `chat:world`, as before |
| Region | everyone in the region the player stands in | a link of its own on `chat:region.<i>`, one room per politic region (62) |
| Party | the party's members, every tab of each | the hub's link, the line naming `ch: 'party'`; the hub fans it to the seats |
| Local | those near enough to hear - within CHAT_SAY_RANGE | the presence session's own room (the cell, the building, the dungeon) |

**World** is the channel it always was. **Region** follows the player: the channel is PlayerGPS.CurrentRegionIndex's
(the politic map's word - `_questRegionIndex`, which the quests read), joined at once the first time and after a new
region has held for CHAT_REGION_HOLD_MS (5 s) - a walk along a border is not a churn of sockets - and a line on the tab
says where its channel is now. The tab keeps its short label; the region's NAME is its hover, its roster's heading
("Wayrest - 7") and the field's placeholder, because "Wrothgarian Mountains" does not fit a four-tab bar in a box that
can be 352px wide. A region room is the whole machinery of a channel (the roster, the badges, the mute, the rate, the
room's budget) with nothing new in it - which is why a region is a room and not a field on the hub's lines.
**Party** lines are said on the hub's link and fanned by the hub, which is the one room that knows the seats, to every
socket of every member - the sender's own included, which is the receipt. A party line said anywhere else is junk; a
stranger's, or one from a seat left since, says nothing. It is budgeted apart from the room's (PARTY_CHAT_ROOM_HZ_MAX):
AUDIT CHAT A2 priced the room's budget for a line whose fan is everyone online, and priced out of it one talkative party
would silence the World channel, and a busy World channel every party. The client gates party lines coming in on the
same number. A party's own news (joined, left, the lead passed) lands on the Party tab, beside its conversation.
**Local** is the presence session's room: the relay already fans a line said there to the peers in range, and a
hearer's cell and its halo are one socket each in the speaker's room, so a line is heard once across a cell edge. What
the client keeps is its own line and a line from a body it can place within CHAT_SAY_RANGE - which IS the name's range
(net/remotePlayers.js NAME_RANGE, pinned equal): whoever you can read over a head can hear you, and nobody further,
measured in the ground's plane between the two BODIES (the listener's is `player.feetAt()`, never a third-person
camera). Local is not a private channel: the relay's reach is the room's and the earshot is each hearer's own filter.

**In character, out of character.** Local is where a character SPEAKS - heard by the bodies near enough to hear it - so
it is the tab dialogue in character is said on; the other three reach people wherever they stand, which is
coordination. On any tab a line wrapped in double parentheses is an aside out of character - the tabletop's own mark,
`((brb))` - read off the speaker's own text (never a field: the mark is theirs to make), drawn dimmed and leaning, and
`/ooc text` says one on Local. The panel keeps the tabs apart while it is open; that separation is the reading.

**Bubbles.** BUBBLE1 bubbled the World tab alone because the World tab was the chat, and left the next tab "saying
nothing over a head until somebody decides it should". Mac's own words decide it - "chat bubbles above the player when
they chat" - so a line on any tab from a peer the name pass draws stands over their head (a bubble is drawn on the
hearer's screen alone, so a party's line stands only where the party heard it), the newest heard across the tabs
winning. The one line that stands over no head is an aside out of character: what is said over a head is what the
character said.

**The peek** (the lines over the world while the panel is closed) is every tab's now, in the order heard - a party
member's "help" is exactly the line that cannot wait on a badge - and a line from a tab other than the one the chat
opens on wears that tab's mark (`PARTY`, in the party's green). **A line the game says** - a restart notice, a new
build, the party's rest vote, the server's red line - is ONE line kept on every tab (ChatLog.pushAll): a player reading
any tab reads it where they are (SRV-N's law), the peek draws it once and the Chat button counts it once (unread on the
active tab alone), where one line per tab would have said a notice four times over the world and counted it four.

**Commands** (`net/chatCommands.js`, pure). `/world` `/g`, `/region` `/r`, `/party` `/p`, `/local` `/l` `/say` `/s`,
`/ooc`, `/help` `/?`, and `//text` for a line that starts with a slash. The host's own commands (`/unstuck`, `/red`,
`/mute`, `/unmute`, `/ready`) are tested first by the regexes their slices pin; the parser answers the rest. Before this
slice every line that was not one of those went to the room - a mistyped `/pary hi` was said to everyone online, slash
and all; now a line that starts with a slash is a command or it is refused in words, and a refusal keeps the line in the
field to be mended. `/help`'s answer is lines to read, so it clears the field and keeps the chat open (the panel's
third answer, `'read'`). `/red` goes down the World link from any tab: the server speaks to the whole game.

**Each tab's strip and roster.** The strip under the chat says why the ACTIVE tab cannot talk: its socket's own line
(labelled with the tab), "You are not in a party.", or - against a relay from before world102 - that the channel needs
the server's next update (an older relay projects `{t:'chat', text}` and would fan a party's line to everyone online,
so the client says none to it and opens no region room before the welcome says it may). The roster is the tab's own:
the channel's members (Online, or the region's name), the party's seats online, or Nearby - those in earshot.

**Found on the way, and fixed at the root.**
- The presence session's cast bucket and chat bucket were ONE field (`_cbucket`), and the relay's cast strikes and chat
  strikes one field (`cdrops`). Latent while chat rode only channel links and casts only the presence session; Local
  chat on the presence session would have made a heal cast spend a chat line, and at the relay twenty dropped casts
  (DROP_STRIKES_MAX is 200) plus one over-rate line would have closed the socket as 'too many lines' (CHAT_STRIKES_MAX
  is 20), while any passing line wiped the casts' strikes. Each is its own now (`_castBucket`, `castDrops`).
- The first cut of the relay's party arm struck a junk line off the attachment READ BEFORE the chat gate wrote it,
  refunding the line's token; the strike is written off the attachment as it stands. The test pins the exact bucket.
  (AUDIT ATTACH has since moved every meter off the attachment: the strike and the bucket are two meters of one
  record, so the class cannot recur.)
- RED1-12 (the server line's inbound gate removed) SURVIVED on the commit before this one: its pin matched `chatInGate`
  over a slice that also held the next arm. The gate is driven now (`test/red1_server_say.test.js`: a flood in one instant reaches the log at the room's rate).

**The bar.** Four tabs and the Social button asked 373px of the 350px bar in the narrowest box (tools/chatChanProbe.mjs,
its first run), pushing Social past the box's edge - and with unread counts on three tabs they asked 468px of the
sheet's own 440, where the first fix (tabs that shrink to an ellipsis) read "PARTY..." beside a clipped smear of a
badge: the probe's numbers said it fitted and its screenshot said otherwise. So: the tabs stand in a strip of their own
with the Social button beside it, OUTSIDE it, always in the box; a tab never shrinks; an UNREAD tab wears a dot, and the
count is the tab's spoken name ("Party, 3 unread" - the Chat button still counts every line while the chat is closed);
in a box under 400px (a CONTAINER query, because CHAT-SIZE lets the box be that narrow on a wide screen too) the labels
drop the capitals' spacing and the Social count becomes a dot as well (its own label still says it, AUDIT SOC C21); and
only on a phone under about 380px wide does the strip scroll sideways - a swipe, never a squeeze.

**Pins.** `test/chatchan.test.js` (16), over the real Room, the wire, a session on a fake socket, the log, the panel
on a fake document, and the host by source. `tools/mutants/chatchan.json`: 56, 56 dead - CC-parser-before-unstuck
lived from EMOTE1 on: EMOTE1 re-aimed the command-order pin to the parser over the shortcodes, and a second parser
call put BEFORE the host's commands (which reads `/unstuck`, `/red`, `/mute` and `/ready` as the host's and would
refuse every one) passed it; AUDIT ATTACH's rerun of the list found it, and the pin names the parser's first and only
call now. `tools/chatChanProbe.mjs` reads the real panel in Chromium - the bar on both skins at 440, 352 and a 320px
phone's 292, bare and with three tabs unread (no tab squeezed below its own name, judged off the text's own box; every
dot whole inside its button), the hovers, the placeholders, the aside's face, the peek's marks, `/help` keeping the
chat open - 59 checks (60 since DICE1 added a roll's look, 75 since EMOTE1's form row, picker and emoji). Re-aimed,
each to the same claim on the new shape: CHAT1's tabs, whitelist, line shape, link loop, rejoin, send and strip pins;
the roster pins (ACC3c's key, CHAT-R1's rows, ROSTER-G's and CHAT-FIT's wiring - one session still answers the badge
and the row); SOC3's tab count; SRV-N's and RED1's host pins; BUBBLE1's law (every tab, and the aside refused). The
mutant records the move touched were re-aimed by content (`chatfit`, `name1`, `red1`, `soc1`); `name1.json`'s
BUBBLE1-any-tab-speaks is retired with the law it held, which `chatchan.json`'s CC-aside-bubbles replaces. The relay
is world102 (a new LAW row - world99 when this was written: main's HCC-PARK and DISC7 took world99 and world100 while
the arc was in review, so the merge moved its frames' RELAY_MIN gates to 101 with it, and main's DISC12 took world101 before
the sixth merge, which moved them to 102); the arc's later slices ride the same
deploy and restate that row until the merge.

## DICE1 - the relay rolls

Addison Knox on Discord, 2026-09-23: "Chat dice-rolling".

**Who rolls.** A roll the client made would be a number the client chose - a player who wants a 20 types one. So the
client ASKS: `{t:'roll', n, m, k}`, how many dice, how many sides, what to add (`net/dice.js`, the one home both ends
read, which joined the relay's bundle through wire.js). The relay rolls them from its own CSPRNG
(`crypto.getRandomValues`) and draws UNBIASED - a draw at or past the last whole multiple of the sides below 2^32 is
thrown back, so every face is exactly as likely where a bare `x % m` favours the low faces. It says the result as a
frame of its own TYPE, `{t:'roll', id, name, n, m, k, dice, total}`, which no player can send out: a chat line that
reads "rolls 2d6+3: 12" is a chat line, drawn as one. The client checks what it is told by the same law - n dice, each
1..m, the total their sum plus k - and a roll that does not add up is no line at all, not even as the words beside it.

**Where it goes.** Where a line would: the roll is said on the channel of the tab it was typed on, through the chat's
one fan (`_sayLine`, which the relay's chat arm and roll arm now share) - the World, the region, a party's seats alone,
or Local within earshot - and the asker hears it back as everyone does (the receipt is the roll). One roll a second a
socket, struck and closed past CHAT_STRIKES_MAX like a flood of lines; a muted player's roll goes nowhere, and they are
told. Every roll is SAID, so a table sees every try.

**The grammar** is the tabletop's: `/roll 2d6+3`, `/roll d20`, `/roll 3d8-1`, `/roll d%` for a hundred, a bare `/roll
100` one die of a hundred sides (the MMO's own), and `/roll` alone a d20; `/dice` is the same command. At most 10 dice of
up to 1000 sides and a modifier within 1000, refused rather than clamped - a roll is exactly what was asked or nothing,
and a refusal is said in words with the forms. A roll is drawn in its own colour, and never over a head: what stands
over a head is what the character said, and a roll is the table's.

**Pins.** `test/dice1.test.js` (10): the grammar and its bounds, the unbiased draw over a scripted source (three draws
thrown back, two kept), the client's check; over the real Room, one roll the same numbers to everyone with the asker
included and all six faces of a d6 reached over the relay's real CSPRNG, the gate and its strikes, the mute, a party's
roll heard by the party alone; the session's door (the world102 welcome, one a second, a channel only where the channels
are) and a forged total refused; the log's roll line and its fail-closed refusal; the bubble; the host by source.
`tools/mutants/dice1.json`: 29, 29 dead. `tools/chatChanProbe.mjs` looks at a roll line in Chromium. Relay world102 -
the same deploy as CHAT-CHAN, its LAW row restated.

## EMOTE1 - an action, a gesture, and an emoji that stays whole

Addison Knox on Discord, 2026-09-23: "Emotes, be it emojis or additional animations".

**An action.** `/me looks around` says a line as what the speaker DOES: `{t:'chat', text, me: true}` - only `true`,
anything else on the field refused whole ('bad chat'), never read as an action - and the relay says it with the flag
on through the chat's one fan (`_sayLine`: the same channels, the same budget - an action costs a line). The log draws
it "Bran looks around": the name, the tag, then the words leaning, in the name's own warmth. Its kind, 'me', is the
RELAY's word from the frame and never read off the text, and it is never a system line and never bubbled - what stands
over a head is what the character SAID. An action goes only to a relay that carries one (world102, relaySupportsEmote):
an older one projects the frame to its text, and "looks around" would be said as a line of plain words - so the host
refuses it in words (EMOTE_OLD_RELAY_TEXT) and keeps the line in the field.

**A gesture.** Twenty (`EMOTES`, net/chatCommands.js): /wave /bow /nod /shrug /laugh /cheer /salute /smile /sigh /cry
/dance /clap /point /thank /greet /kneel /sit /pray /flex /facepalm, each an action line on the LOCAL tab, whichever
tab it was typed on - a gesture is the body's, and the bodies near enough to see it are the ones Local reaches. The
words are the table's own: `/wave` says "waves.", `/wave Ann` "waves at Ann." - a name after the command makes it a
gesture AT someone, bounded at 24 characters and only ever a name in the table's sentence. `/emotes` lists them, and
`/help` names `/me`, the gestures and the shortcodes.

**The animations - words only, on purpose.** The others stand in the Morrowind body (MWBODY1), and its base animation
groups are the idles (idle through idle9 - fidgets, none of them a gesture), the moves, the attacks and the casts, a
knockdown and the deaths (formats/mwAnim.js). There is no wave, no bow, no dance to play, and a gesture drawn with the
wrong clip would say something the player did not. So a gesture is a line until the bodies carry the clips; then the
pose needs one field (the gesture, and when it began) and the relay one deploy.

**An emoji that stays whole.** The one sanitizer both ends run (net/wire.js `sanitizeChat`) stripped every zero width
joiner - rightly, an invisible that splits a word a filter reads - and so broke every JOINED emoji apart: a family
arrived as a man, a woman and a girl side by side (48px of glyphs where the family is 16). It keeps the one joiner
that stands BETWEEN TWO PICTOGRAPHS now (Unicode Extended_Pictographic, across a presentation selector, a skin tone or
a keycap mark), where it hides nothing - a pictograph on each side, in plain sight - and strips it everywhere else;
the bound takes a joiner whose pictograph it cut away, and the law is idempotent under a fuzz over the emoji's own
parts. The bubble's cut (ui/nameLayer.js `graphemeCut`) falls between whole characters as a reader counts them
(Intl.Segmenter), where `slice` could halve a surrogate pair or cut a family to a man and a joiner.

**Shortcodes and the picker.** `:smile:`, `:sword:`, `:heart:` - 62 codes for 60 emoji (`SHORTCODE_LIST`, a list so the
picker keeps the written order: an object puts `100` first) - are their emoji in anything said, expanded before the
parse, so an action and a gesture's name wear them too; a code the table does not know stays as typed. On the desktop
skin a button beside the field opens a grid of the same emoji, one button an emoji named by its first code; a pick
lands at the caret and closes the grid, and Escape closes the grid before the chat. The touch skin has no button -
every phone keyboard has an emoji key, and on a 320px phone the button took the field to 67px - and neither has a
desktop box the SCREEN narrowed below any width a drag can choose (CHAT_WIDTH_MIN): there it took the field from 129px
to 93px, narrower than any the chat had before it. That is a container query, and a container query measures inside
the box's border, so the rule takes the border off (one constant draws the border and sizes the query): the first cut
hid the button at the smallest box a drag makes.

**Pins.** `test/emote1.test.js` (8): the joiner law and its fuzz; the action on the wire, over the real Room and a
session on a fake socket (asked only of a world102 relay, believed only as `true`); the log's kind; the grammar (/me;
every gesture parsed, each with its form AT a name; /emotes; every shortcode whole over the wire, a clock no code); the
bubble's cut and its refusal of an action; the picker over a fake document (its order, the caret, Escape, the close, a
group of buttons); the picker's sheet (the touch skin's rule, the narrow box's asked inside the border); the host by
source. `tools/mutants/emote1.json`: 31, 31 dead. `tools/chatChanProbe.mjs` in Chromium: the form row at 440, 352 and
292 on both skins (the field never under the narrowest the chat had before the button, the touch skin's 115px at 320),
the picker's round trip, the edge (the smallest box a drag makes keeps the button, a pixel under it does not), an
action's face, and a joined family drawn as ONE glyph after the wire - 75 checks. Relay world102 - the same deploy, its
LAW row restated.

## LOOT-STACK - the loot window holds the pile, a tab per body

Janome on Discord, 2026-09-23: "a toggle key to switch between the inventories of enemies stacked on top of each
other". The first slice answered with a key (`]`, "NextBody") that turned which body the reticle meant. Mac, on seeing
it: "that solution is better than a keybind" - of a loot window with a tab for each body. The key is gone; the window
holds the pile.

**Why a pile hid its bodies.** DFU fires ONE ray on an activation (PlayerActivate.cs:314) and the nearest thing it
strikes is the hit. Three foes cut down in one doorway leave three bodies in one place, and the ray always strikes the
front one: the two behind it could be reached only by emptying it, and a body left holding what the player did not
want - a rusty dagger, a ruined cuirass - hid the others for good. Daggerfall Unity has no answer and no vendored mod
carries one, so this is the port's own (Port-Ledger A, LOOT-STACK).

**The pile.** The bodies the one ray passes through that the player can open from where they stand: the nearest body
and, behind it on the same ray, each body inside its own reach (CorpseActivationDistance, the corpse handler's own
gate, :936-941). A body across the room is no member - its tab would earn only "You are too far away" - and one behind
a wall is none either: the walk behind the front body is the same pick the front was found by, occlusion and all. A
body is a body because its PRODUCER says so (`body: true` on `scenes/corpseMarker.js corpseLootTargets`, the two
surface pools' mint, and on the dungeon context's own), so the law reads no key's prefix.

**The pick is the nearest, always.** `player/activate.js pickActivatableHit` answers the front body exactly as DFU's
ray does, so every race the pile is in (the player's own drops, a torch, a door, a person, a foe) comes out as it
always did. The pick only NOTES the pile it stood (`player/lootStack.js noteBodyStack`); a pick over a list with no
body leaves the note alone (a host casts several picks a frame), and a lone body or a ray that met no body clears it.

**The tabs.** A press on the front body opens its loot window as before, and the window carries the pile
(`lootPile`): a tab for each body the pool can open - its name and how much it holds (`corpseMarker.js pileBody`),
never a disabled body, an empty one (its press would only say "The body has no treasure.") or a peer's (its owner's to
empty, no window here) - with the open body always among them and lit. A body alone draws no tabs. A tab CLOSES the
window and hands its body back to the host's own corpse door with the pile in hand, so the row does not move under the
player's hand and each body opens and closes as itself: the pool's refusals and the arrows pickup, the dungeon's claim
and word to the room (WORLD4), the emptied flat. Quick loot takes on a press only; a tab asks for that body's window.

**Where it lives.** One door per host - `openBodyLoot` in `world.js` and `exterior.js`, the interior arm in
`worldModes.js`, `takeLoot(key, mode, pileKeys)` in `dungeonContext.js` - which the press and the tabs both go through.
A pile may mix the encounter pool's bodies with the watch's, so each key answers to its own pool. The dungeon's
`takeLoot` no longer lets a window that has just CLOSED hold the slot against the next open: a tab closes and opens in
one click, before the frame's drain empties the slot (the reader door's own law, `openBookHook`).

**What the player sees.** The enhanced window draws a row of tabs over the loot head; it wraps rather than scrolls,
so a pile of five on a phone is two rows and never a hidden tab, and each tab is a finger's height - a phone, which
never had a key to turn with, has the pile too. The classic window has no room for a row: its body picture (the remote
target icon, which a body could never cycle - playerOwned false, :833) turns the pile instead - LEFT to the next body,
RIGHT to the one before, wrapping - with "2 of 3" drawn under it. Under the reticle the plaque says "3 bodies" below
the front body's name.

**Two defects in the plaque, found by its probe.** `tools/lootStackProbe.mjs` photographed the pile's mark drawn UNDER
the plaque's divider, as the list's first row: the divider was the title's foot, so every sub-line of a plaque with a
list stood below it - a locked chest's "Lock Level: 12" had always drawn as the first thing in the chest. The divider
is the list's top edge now, under the whole label. And the list's height cap (AUDIT-WH R7) clipped ACROSS as well as
down, cutting quick loot's highlight band off at the list's edges and the first letter of the lit name with it; on the
narrow sheet the band's fixed 14px margin also ran 2px into the border (the sheet pads 12 there), and its 12px left
padding stood the lit name 2px left of every other name - the one shift that rule exists to prevent. The cap clips
downward only now (`overflow-y: clip`, `hidden` kept as the fallback), and the band's margin and padding are the
plaque's own padding (`--wp-pad-x`) at every width. Still imprecise and left as R7 recorded it: the cap is the room
below the plaque's TOP edge and does not count the label above the list, so on a very short window a long list can
still run the plaque's foot past the screen.

**Pins.** `test/lootstack.test.js` (14): the pile over real ray geometry (its members, their reach, the world occluding
one, the order), the pick answering the nearest and noting the pile (a list with no body untouched, looking away
clearing it), the race unchanged against a pile of drops, `bodyPile` (the front's pile only, a copy), `lootPile` (the
tabs, the open body always among them, none for one body, the pile carried back, the open body's own tab inert),
`pileBody`'s three refusals, the plaque's "3 bodies", the teardown, both windows driven (the enhanced tabs on a fake
document - lit, counted, closing before the open; the classic picture's left, right and wrap, the label, the wagon and
MIDDLE untouched), the four hosts' doors by source, the key gone, the producers' word and the plaque's dress.
`tools/mutants/lootstack.json`: 39 records; with the other lists this touched, 254 dead and 0 survived. Old pins
re-aimed to the one door by content (MAC-E, U25, AUDIT 24 wave 38 and AUDIT 65 MC-2, whose harnesses now run the door's
own source; INTERIOR-BODIES, AUDIT-WH H3, WORLD4 C6, LOOT-REGEN); the action-table pins and their mutant records are
main's again. `tools/lootStackProbe.mjs` is the first slice's browser probe and was NOT carried over to the tabs.

## INSPECT1 - the profile of a player standing in front of you

kurkku on Discord, 2026-09-23: "a profile page that you can bring up when you're near them"; Mac: "For the profile
suggestion. I think we develop a new enhanced UI element for the player inspect interaction. Showing their glyph,
name, title, stats and worn gear".

**Where it opens.** From the F-menu (SOC5), which already stands over the player the F key's ray finds - so "near
them" is the menu's own reach, and the gesture is the one a player already uses to friend or invite someone. Its
first row is Inspect now (`ui/socialMenu.js`, offered by the host for every body the key finds); on touch the HUD's
☺ button is the same door. The profile (`ui/profileWindow.js`) is a pointer surface of its own, like the menu it
opens from: F again closes it, as it closes the menu; Escape closes it unless a surface stands over it (the chat and
the friends panel yield theirs to it); a window over the HUD, or a pause, takes it away.

**What it shows, and whose word each part is.**
- The TITLE above the name and the GLYPHS after it, in the name layer's order - the relay's word, off the signed
  identity token (`net/wire.js badged`), drawn through the one badge law. Never the card's: a card that carried them
  could claim a title nobody granted. Each glyph is drawn by the one SVG helper every DOM face shares now
  (`ui/playerBadge.js glyphSvgNode` - the chat panel and the name layer each had a copy).
- The NAME the room knows them by.
- Their level, race and class, the eight attributes and the three vitals' maxima - THEIR word, the card their own
  game hands over when asked (`net/profileCard.js composeCard`): what their own character sheet shows, read by the
  producers that sheet reads (the level, `liveStat` over STAT_KEYS_ORDER, fatigue at the sheet's /64 figure).
- What they WEAR, slot by slot - head to foot, then the hands, then the trinkets - named as the pack names an item
  (`itemLongName`). Off the card's look when it came, because a look rides the hello alone: a player who changed
  their armour in this room still wears the old one in the room's copy. Until the card comes, off the room's.

**The card on the wire.** One directed frame, `card`, with the cast frame's routing (`net/wire.js validCardData`):
`{to, ask: true}` asks and `{to, card}` answers, from a hello'd socket in a place room (a channel or the hub is
nowhere to stand beside someone) to the socket `to` names, the sender's id stamped by the relay. The card is whole or
nothing - the level (1 to 999), eight attributes each 0 to 100 (the sheet's live clamp, MAX_STAT_VALUE; a pin holds
the wire's bound to it, since the relay imports no game module), three vitals, the look through the room's own law.
The relay reads none of it. It meters asks and answers together on the card's own bucket (CARD_HZ_MAX, the cast's
strikes), and funnels them onto the destination through the cast arm's per-sender funnel (AUDIT ALLY-CAST B2): one
sender reaches one destination at CAST_HZ_MAX a second, whatever the directed frame. A client asks only a relay that
routes the frame (world102, CARD_RELAY_MIN - an older relay closes the socket for a frame it does not know); with an
older one the profile opens from the room's half and says the server cannot carry a card yet.

**The answering law.** An ask is answered with my card through a gate (`createCardAnswerGate`): one asker once in
CARD_ANSWER_MS however often they ask, CARD_ANSWER_ASKERS_MAX askers remembered with the stalest forgotten first - a
stranger asking over and over makes my game send once in a while, not once a frame. The link gates both ways
(CARD_HZ_MAX out, CARD_IN_HZ_MAX in, per sender) and delivers only a stamped frame addressed to me.

**The wait.** The profile stands at once from the room's half - the name, the badge, the gear in the room's look -
with "Asking Bran for their card...". An ask the link's gate held back goes on a later frame, and a card that does not
come in CARD_WAIT_MS is said not to have come: "Bran did not answer - this is what they wear." An answer is drawn only
on the profile that asked for it: one landing after the player closed it, or moved on to another's, draws nothing.

**Recorded, not built.** There is no privacy switch: anyone standing beside me can ask, and my game answers with
what my sheet shows. The numbers are the answering player's own word - a modified client can claim any sheet the
wire's bounds admit - and the profile draws them as theirs, beside the badge that is the relay's. An item is named by
its template and material, as the look carries it (an artifact's own name is not on the look).

**What the probe found in the card.** `tools/profileProbe.mjs` stands the widest card a player can be shown - a name at
NAME_MAX of the face's widest letter, the longest title, every glyph, the widest numbers the wire admits, and for every
slot the longest name the pack gives an item that EQUIPS there (DFU's own GetEquipSlot places it) - over the enhanced
sheet that online always wears and bare, at a desktop's width, a narrow window's and a phone's. Its first runs found
three faults, each fixed where it lived: on a phone the widest name broke INSIDE itself, one letter orphaned on a second
line (the narrow card now takes the name a size down, and a break inside it is the last resort); the card's max height
bounded its CONTENT box, so its padding and border stood past it and a tall card kept a 1px gutter where its sides keep
14 (`box-sizing: border-box` - the enhanced sheet's global rule had hidden it, and the card no longer leans on it); and
over the enhanced sheet the Close stood its word at the button's left edge, the sheet's global `button { text-align:
left }` reaching it (the button sets its own now). The probe's numbers had passed the second and the third; its
photographs had not.

**One glyph drawing.** The glyph's SVG was drawn twice before this slice - once by the chat panel, once by the name layer
- and a third copy was about to join them. `ui/playerBadge.js glyphSvgNode` is the one drawing now, each face saying only
how thick its stroke is.

**Found by its measurement.** Before the card's meter joined the relay, its test measured the attachment the meter would
ride - the widest a place socket can carry - and found it already past the runtime's 2 KiB, with a refused write
freezing a meter open. That was paid first, at the root, as AUDIT ATTACH (`06-Systems/Online-Arc.md`): every meter is
the Room instance's now, and the card's meter was measured with every other arm's there (`test/placeWidest.mjs`).

**Pins.** `test/inspect1.test.js` (10): the wire (an ask or an answer, never both; the card whole or nothing at every
bound, the attribute ceiling held to the sheet's live clamp; the widest card inside its frame; world102 the first relay
that routes it); the relay over the real Room (to the one socket named, stamped; a channel or the hub nowhere; a frame
at myself junk, a peer gone nothing; the cast arm's funnel shared - a card waits on the casts its sender spent,
another sender's slot its own - and the sender's own meter holding it to CARD_HZ_MAX a second across every destination
and striking a flood out on exactly the frame past its strikes); the link (only to a relay that routes it, through the
wire's projection, to a peer some socket reports; in only a stamped frame addressed to me, per sender); the card by
the sheet's own producers (live attributes under a disease and past the clamp, fatigue at /64, the look worn now); the
answering law; the view (the relay's badge never the card's, the card's look over the room's, head to foot); the
window over a fake document; the F-menu's row and the one glyph drawing; the host by source.
`tools/mutants/inspect1.json`: 48, 47 dead and 1 recorded equivalent (the link's refusal to send at my own id: no
socket of mine ever reports me, so `_socketFor` refuses it first). `tools/profileProbe.mjs` in Chromium: 127 checks,
12 photographs. Re-aimed: the chat panel's and the name layer's glyph pins (CHAT-FIT's), AUDIT WORLD2's parseClient
doc pin (DERIVED from the parser's arms now - it had fallen seven frames behind), ALLY-CAST's funnel pins and records,
and AUDIT ATTACH's measurement, which the card's arm joins. The relay is world102's (restated).

## THE MERGE with main (2026-09-23) - DISC6 to DISC9 and Horse Cart and Cargo, into the arc

Main moved while the arc was in review: HCC-PARK + RIDE (world99), DISC7 (world100), DISC6/DISC8/DISC9. Merged, not
rebased. Where the two touched the same thing, both are kept and each change below is pinned.

- **The relay is world101.** Main's world99 and world100 are deployed rows of the LAW and stay as recorded. The arc's
  frames (the party and region channels, the roll, the action line, the card) move their RELAY_MIN gates to 101,
  because a world99 or world100 relay closes the socket on each of them. The arc's tests pin the new boundary: world100
  refused, world101 routed.
- **The player's verbs are one bag.** Main's ACT-MENU lists the F-card's enabled acts as the World Tooltips plaque's
  rows and presses the lit one through the card's own door. INSPECT1 added an act to the card. The host builds the bag
  once (`peerActsFor`: the hub's acts, the trade's, and the look) for the card, the plaque's rows and the plaque's
  press, so Inspect is the plaque's first verb too and the two surfaces cannot offer different rows.
- **The plaque's seam carries both.** LOOT-STACK spends an armed turn on the reticle's own pick on both skins, before
  the plaque's skin gate. ACT-MENU folds the highlight whenever the plaque stands down (AUDIT DISC7 A8). Merged: the
  stand-down still hides (and so folds), and a turn spent on the classic skin returns before the fold. The window
  branch drops the turn and folds the highlight. The lit row's band keeps LOOT-STACK's measured margin beside main's
  refused-verb style.
- **Main's park meter joined the instance meters** with strikes of its own (Online-Arc, AUDIT ATTACH: the merge), and
  parseClient's doc names the park arm. AUDIT WORLD2's derived pin caught that omission on its first run after the
  merge.
- **Counted again:** Ledger section A has 176 rows (main's three and LOOT-STACK's). UI.md counts 189 modules (main's
  two and the profile). Port-Status section 2's row identifiers were re-resolved by content, because LOOT-STACK's row
  moved every row below it by one.

Pins re-aimed by content: `test/disc7.test.js` (the window branch, the press's bag), `test/peerplaque.test.js` (the
namer's bag), `test/inspect1.test.js` (the three reads of the one bag, plus the plaque's Inspect row and its press by
execution), `test/hcc_park.test.js` (the park bucket refilled on the instance), the RELAY_VERSION pins, and seven
mutant records (inspect1 x2, peerplaque, soc1, lootstack, worldhover x2). Every mutant list whose target or tests the
merge touched was rerun against a green baseline.

## MAIL1 - letters to a player who is away (2026-09-23, Addison Knox)

Addison Knox, on Discord: "An in-game mail system where players can send messages to offline players (e.g. notes,
contracts, invitations)."

- **Where.** The friends panel has a third tab, Letters: the box, one letter, and the form that writes one. A friend's
  row has a Letter button, and a letter has Reply. When a look finds letters, the world tab says so, in a line nobody
  spoke: "A letter from Ann: "Terms". Open Social, then Letters." On the first look of a sitting it says "You have 2
  unread letters" instead.
- **Who keeps them: the ACCOUNT SERVICE, not the relay.** A letter is for someone who is not online, and the service
  is the one thing in this port that outlives a session. It already knows every registered player by a handle nobody
  else can hold. Letters live in `server-account/src/letters.js` over migration 0007 (`letters`), until their reader
  throws them away.
- **Who writes to whom.** A registered player writes to another, by handle, in any case. A guest can do neither
  (`mail-needs-account`): a guest is a device, with no name that stays theirs and none a mute can reach. Nobody
  writes to themselves (`to-self`), and a muted player writes to nobody (`muted`): the moderator's mute stops a letter
  as it stops a chat line.
- **The law, one home for both ends (`src/net/letterLaw.js`).** A letter carries the chat's characters. Its per-character
  loop left `sanitizeChat` as `wire.js` `visibleText`, one law rather than a copy, and a chat line comes out of it
  unchanged. A letter keeps its lines, because a contract is laid out. The bounds are 60 characters for a subject, 800
  for the body and 40 lines, and a letter past them is refused, never cut: a cut contract would be words its sender did
  not send. The widest letter the form can type fits the service's 4 KiB body, and a pin does the arithmetic.
- **How much.** 20 letters an hour to anyone, and 5 to one reader. Past either the answer is `mail-rate`, a word of its
  own because the routes' `rate` sentence says "a few minutes". The rate is spent BEFORE the reader is looked up, so a
  handle cannot be probed for free. A reader keeps 50 letters, and a full box refuses the SENDER: the reader's oldest
  letter is never thrown away for a stranger's newest. The bound is in the INSERT itself, so two letters racing for
  the last place land one.
- **A reader's letters are theirs alone.** They are listed newest first, as heads with no body, each wearing the
  sender's badge as the service would sign it now. A letter is opened once (its first opening's time is kept) and
  thrown away by its reader alone. `no-letter` is one word for another's letter and for no letter. A reader who is
  gone takes their box; a sender who is gone does not take their letters.
- **The client (`src/net/mail.js`, MailBox): found, not pushed.** The box is looked at when the tab opens (a look is
  trusted for 30 s), when the host starts, and every 3 minutes from `onlineFrame`. The box's rules:
  - it announces a letter once;
  - it opens a letter once and keeps that copy;
  - it refuses what the law refuses before touching the network;
  - it forgets a session the service answers `auth`;
  - it stamps a look even with no session, so no frame reads the store twice.
- **The tab.** The draft lives in the panel's state and is written on every keystroke. No repaint rebuilds the form,
  so a presence frame or a poll landing never moves the caret. Ctrl or Cmd with Enter sends. A refusal is said in the
  service's words and the draft stays.
- **The probe found one fault.** The Letter button made a friend's row three acts wide. On a phone's touch skin, with
  each button 44px tall and its reason beside its label, the name was squeezed to one letter a line. A friend's acts
  are now one group, which wraps below the name when the row cannot hold both.
- **Recorded, not built.**
  - No block list: a moderator's mute and the per-reader rate are the walls.
  - A letter carries words only, never an item or gold. A player's things are their own client's, and the trade
    window is where things change hands.
  - No push: a letter is found at the next look.
  - No sent box: the sender keeps nothing.
- **The deploy.** The account worker moves to `acct6`, and the deploy applies migration 0007 through the ledger.
  `src/net/letterLaw.js` joins the worker's deploy paths (test/accountdeploy.test.js caught it missing). The relay
  sends no new frame, but `visibleText` moved within its bundle, so world102's LAW row is restated.

Pins: `test/mail1.test.js` (17); `tools/mutants/mail1.json` (51, all dead); `tools/mailProbe.mjs` (36 checks, 12
photographs at a desktop, a narrow window and a phone). Re-aimed: ACC1b's table list, ACC1e's refusal walk (which reads
letterLaw's words, since the service returns them verbatim), CHAT1's and AUDIT DROPS F's online-frame order, and
SOC3's host pin.

## JOURNAL1 - a page of a player's journal, held out and kept (2026-09-23, Addison Knox)

Addison Knox, on Discord: "Player journals ... shared in-world for storytelling."

- **The journal is the one the game already keeps.** That is DFU's PlayerNotebook (`systems/notebook.js`): the Notes the
  chronicle draws and its composer writes, saved with the game. A second journal beside it would be two places a
  player's story lives. So a note gets two doors, one for each way a story is passed on: shown to someone standing
  near, or sent as a letter to anyone. A page or a letter that reaches a player can be kept in their own journal.
- **Shown to someone standing near.** A note in the chronicle has a Share button; a message, a quest and the history do
  not. It is drawn only where the host has an online layer (`pageShare`, delegated into the dungeon's chronicle as
  QUEST1's hooks are). It opens a strip under the note: "Show to", and a button for each player within the reach a
  talk has (`player/socialPick.js` SOCIAL_REACH - DFU's own distance for a person, the F-menu's), in metres between two
  bodies (`net/tradeSession.js` tradeDistance), nearest first. The reach is measured again at the press, so a player
  who walked away is said to be too far. The page goes as one directed frame through the relay.
- **Held out, never pushed.** A page that reaches a player does not open over their game: a window that opened whenever
  somebody near them pressed a button would be the other player's to open, not theirs. It WAITS
  (`net/journalPage.js` PageOffers):
  - one per writer, the newest replacing the last;
  - for five minutes, and gone with its writer when they leave the room;
  - said on the social tab once in thirty seconds per writer, with how to read it: "Ann holds out a page of their
    journal - press F on them to read it" (the F-menu's own key, off the live bindings; "face them and press" the
    phone's social button on a touch device).
  The F-menu, and the World Tooltips plaque that reads the same rows, offers "Read their page" after Inspect while one
  waits.
- **Read and kept (`ui/pageWindow.js`).** The card says whose journal it is, the date and place they wrote it (the
  note's own dated head), and the page as their notebook laid it out, with a blank line where it broke. A word too long
  for the card breaks inside it. "Keep in my journal" files it as a NOTE in the reader's own journal, through the
  notebook's own AddNote(tokens): dated where and when it was kept (the notebook's own header), and opening "From the
  journal of Ann - <their date>:". It keeps once; read again, the card says it is kept. The pointer is freed and taken
  back as the profile's is, and F again, Escape or a window over the HUD puts it away.
- **Sent as a letter.** "Send as a letter" closes the chronicle and opens MAIL1's form on the page - "A page from my
  journal", its date, a blank line, its lines - to anyone the writer names. The letters open on the first frame the
  panel may stand, because the chronicle covers the HUD until its host sees it close. A page longer than a letter is
  refused in the form, never cut, and the draft stays to be cut down. A letter being read has "Keep in my journal" too:
  "A letter from Ann: Terms", a blank line, its lines.
- **The page's law (`net/wire.js` pageLaw).** A page is a player's words with their lines, which is the letter's line
  law. That law moved out of `net/letterLaw.js` into wire.js (`wordsLine`, `foldBlankLines`), so the letter and the page
  read one law: the chat's characters (visibleText), a tab and a run of spaces one space, a run of blank lines one, none
  at either end. The bounds are a head of 120, lines of 80 and 60 lines - sanity bounds over what a notebook holds (its
  line is 70, and an entry its split law files runs to about fifty lines). A page past a bound is refused whole, never
  cut, and the chronicle says why before anything is sent. The widest page the law takes, with every character one
  JSON escapes, is a frame under the relay's door, and a pin builds it.
- **The relay (world102).** The `page` frame takes the card's routing: from a hello'd socket in a PLACE room to the one
  socket `to` names, with the writer's id stamped on it and the cast arm's per-sender funnel onto the reader
  (`_senderFunnel`, one helper for the spell, the card and the page). It has a meter of its own (a page a second, its
  strikes its own `pageDrops`), and the chat's MOD1 wall: a muted player's page goes nowhere, and they are told until
  when. A page at one's own id is junk. The client sends a page only to a relay that routes one (PAGE_RELAY_MIN), and
  takes one only when it is addressed to it, projected by the same law, two a second per writer.
- **The crash it fixed at the root: `systems/notebook.js` breakableNote.** DFU's WrapLinesIntoNote throws when the first
  71 characters left to wrap carry no space. That is unreachable in DFU, whose note box stops at 70. The enhanced
  chronicle's composer takes 200, so a pasted address or one long word THREW out of its submit handler and the note was
  lost; and a page or a letter kept can carry anything. breakableNote makes text takeable before it is handed over, and
  leaves the wrap DFU's:
  - a run is what lies between SPACES, because the wrap breaks on nothing else - a tab or a no-break space is part of
    the run;
  - a run longer than the line is cut into pieces of at most 70 units with a space between each, which is the break the
    wrap then spends;
  - each cut falls between the characters a reader counts: `systems/graphemes.js`, EMOTE1's law, lifted out of the chat
    bubble so the two cuts cannot come to disagree. A joined family is never parted and a face never halved;
  - a character wider than a line (a letter under a hundred marks) goes by its code points, so no text is refused.
  The composer, a kept page and a kept letter all go through it.
- **Found on the way.**
  - The chronicle's Remove used a card's place in the list as the note's place in the notebook. An empty entry is
    dropped from the drawing, so after one, every later card's Remove took the note before it. Each entry now carries
    its notebook index, and Remove and Share act on the note the card draws.
  - **The probe found one fault.** A note's line of one long word - the seventy-column run the notebook keeps, a kept
    page's, breakableNote's own pieces - ran out of its card, and the Notes section scrolled sideways (672px in 624 at a
    desktop, 652 in 315 on a phone). The chronicle's text now breaks a word too long for its column, as the page
    window's does.
- **Recorded, not built.**
  - No block list for pages either: the mute and the reader's own gate are the walls, and nothing opens until the
    reader turns to the writer.
  - A page is words. A quest is shared through QUEST1's own door, and things change hands in the trade window.
  - The classic skin's logbook shares nothing; online is the enhanced lane.
- **The deploy.** world102's LAW row is restated, the relay's one deploy carrying the page frame. The account worker's
  behaviour does not change - its line law moved into wire.js, which it already bundled - so `acct6` stands.

Pins: `test/journal1.test.js` (14); `tools/mutants/journal1.json` (69, all dead); `tools/journalProbe.mjs` (35 checks,
15 photographs at a desktop, a narrow window and a phone). Every other list whose target or test this slice touched
was rerun (41 lists, 1,462 mutants): no survivor it caused. Re-aimed to the new code:
- MAIL1's law pin and five of its mutants, for the line law's new home;
- PX24b's composer and Remove pins;
- AUDIT DROPS F's and CHAT1's online-frame order;
- INSPECT1's and PEER-PLAQUE1's one bag, and their mutants;
- AUDIT SOC's and INSPECT1's Escape order;
- SOC3's import;
- EMOTE1's segmenter mutant, now in graphemes.js;
- AUDIT ATTACH's widest place socket, flood table and wake table, which gain the page arm.

World101's LAW row is restated, and the cites that moved with the new lines were moved (tools/citeShift.mjs).

## The roster's row menu on a phone (found by `tools/font1Probe.mjs`; older than this arc)

`tools/font1Probe.mjs` measures the enhanced surfaces for text wider than its box, on the desktop skin and the touch
skin. Through this arc it reported one spill, and main spills the same way: the chat roster's row menu on the touch
skin.
- A row button is a label and, when the act is refused, its reason beside it (AUDIT SOC C11), in a roster column 148px
  wide at the chat's own scale.
- On the touch skin the label is 13px for a thumb (AUDIT SOC C8), and "Invite to party" beside "already in a party" is
  94px of text in an 89px box, so it ran out of the button.
- The button's line wraps now: the reason drops under its label, and a label wider than the column breaks at its
  spaces. The probe passes, with the button 82px tall on the phone (over the thumb's 44).

Pinned in AUDIT SOC C8/C13's test (`test/soc3_socialpanel.test.js`); `tools/mutants/auditsoc.json` gains its mutant, dead.

## A mutant record that names two sites (found by the arc's mutation rerun; older than the arc in part)

`tools/mutate.mjs` replaces the FIRST occurrence of a record's `old`. A record whose text stands at two sites in its
file is aimed at whichever is higher up, so a copy added above the site it was written for takes its mutant without a
word. The record still applies, so AUDIT QS6 F7's sweep passes it, and the law it was written for is checked by nothing.
- **MOD1-10** (the chat's mute) survived the rerun after the fourth merge. DICE1's roll arm repeats the chat's mute line
  below it, and JOURNAL1's page arm repeats it ABOVE it, so the record muted the page's check, which MOD1's tests never
  reach.
- **CHAT-CHAN's two `sendChat` records** name a line that DICE1's `sendRoll` repeats below them. They still hit
  `sendChat`, but only because of the order. `sendRoll`'s own copy had no record; DICE1 gains two, dead. Its version
  half is not recorded, because the welcome opens `rollOk` and `chanOk` from one relay version and ROLL_RELAY_MIN is
  CHAN_RELAY_MIN.
- **Two of main's, which the PR had carried as survivors older than the arc:**
  - AUDIT4-A8 was written when the HUD line had one site. NOTICE-SPAM's repeat branch (2026-09-22) put its exact text
    above the push branch, and the record has mutated the repeat branch since.
  - AUDIT-F4 names the billboard's tint and mutated the flats'.

Each is aimed now by a line only its own site has, and dies.

**The class is closed** in `test/mutantdrift.test.js` (MUT-AIM): every record names ONE site. The 25 records that
already named more than one are carried in a map with their count of sites, so a copy added or taken away fails as
well; the map can only shrink. Two of them need more than an aim, and are recorded for their arcs:
- `el2` glsl-point-off-dark: the point guard is pinned by a regex over the whole shader, which the other copy satisfies
  whichever one is mutated.
- `macbugw5` W5-13 is named for the pool's gate and mutates the drip's. Aimed at each of the four gates in turn, only
  `place()`'s dies (14 failing). Its tests (`test/blood1_decals.test.js`) never fail the drip, the footprint or the pool
  asking for `raycastHit`, the door MAC-BUG W5 took them off.

## Two kinds of number the cite tools took for line cites (found at the sixth merge; older than the arc)

The sixth merge's conflicts showed a Ledger row whose DFU message ids read "8076/12322" here and "8076/12009" on main.
The struck row above it still reads "8076/8077", and DFU's TalkManager.cs answers with records 8075, 8076 and 8077
(:2029-2035). `tools/citeShift.mjs` and `tools/citeMerge.mjs` had been moving it for as far back as the history goes.
- **CITE-SLASH.** RF3's grammar read a bare `/N` after a cite, anywhere up to the next cite, as that cite's line. So
  "8076/8077", a sentence after `world.js:3844`, was world.js:8313 to both tools, and it moved whenever that line did.
  A bare `/N` now continues only the chain it touches: `world.js:6800/6801`, `:13/15`. The colon forms keep RF3's
  reach, because the colon says what they are.
- **CITE-CS.** RF3 ends a cite's region at a `.cs:N` cite, but DFU's members are mostly written without their file:
  "| TalkManager.GetReactionToPlayer_0_1_2 (:689-693) |" in the Ledger's DFU column, and
  "DaggerfallRestWindow.CanRest (:762-831)" in prose. A JS cite earlier in the row took each one for its own lines. Two
  more stops now end the region: a C# member just before its `(:N`, and, in a table row, each cell's edge. Run
  against the whole tree before they were written, the two stops exclude 99 continuations, and every one is C#.
- **One law, as RF3's.** Both tools read `continuationsIn` and `regionStops`. Pinned in `test/citeshift.test.js` and
  `test/citemerge.test.js`. `tools/mutants/citestops.json` has 5 mutants, all dead.

**Repaired by content.** The history (lines matched by their shape) says which loose slashes had moved:
- Port-Ledger: "Work bands to 8076/8077" (DFU TalkManager.cs:2029-2035).
- Audit-24: FixRdbData's blocks "1025/1034/1036" (DFU BlocksFile.cs:521, :576, :602).
- Active-Arcs: "Peak change 42/255". Testing.md: the road tile's corner columns "(63/64)". Each is the value the
  history begins with.
- `test/ledger.test.js` and Testing.md: "the ROADS 3/22 comment block". The two copies already disagreed (3/24 and
  3/43) in the history's first commit, so neither is a person's number. The block holds the ROADS 3 and ROADS 22
  comments, and ROADS 22 is the arc that wired Basic Roads' network there.

**The Ledger's DFU ranges, restored against DFU's source.** 42 ranges in the Ledger's DFU column and prose had moved
with a JS cite. Git cannot give their originals, because its first commit is a squash that already carried moved
values. Each was re-derived by reading DFU master 2343305, the port's reference (tools/parity clones master). Where a
row cites the same code with its `.cs` file, that cite never moved, and it anchors the range. Four read-only passes
worked a batch each, and every span was checked here against the source before it was written.
- All 42 are restored. For example, GetReactionToPlayer_0_1_2's reaction sum is TalkManager.cs:663-667 (it read
  :874-878), StockHouseContainer is DaggerfallLoot.cs:291-375 (it read :319-403), and CanRest is
  DaggerfallRestWindow.cs:542-599 (it read :762-831). DaggerfallBookshelf's permission gate is :67-77 in master. The
  same row's prose `DaggerfallBookshelf.cs:70-80` predates a change to DFU's own file, which is not drift; it is left
  for a person.
- Nine prose ranges no stop can tell apart are written with their file now, so RF3's `.cs:N` stop protects them:
  - `ResetNPCKnowledge (TalkManager.cs:546-553)`;
  - WeaponManager.cs:230-233 and :275-281;
  - PlayerGPS.cs:747 and :766-776;
  - DaggerfallTalkWindow.cs:1465-1499;
  - three JS continuations that RF3 had given to the cite before them: `guildServiceFlow.js:269`/`:270` and
    `useItem.js:322-346`/`:239-275`.
- Found by the passes and left for a person: row 735's `DaggerfallCourtWindow.cs:191` names the Dark Brotherhood
  rescue's refill, not the acquittal's (:425).

## THE SIXTH MERGE with main (2026-09-23) - Climates & Calories' tiers, DISC10 to DISC12, SHIP-PORTS, ARROW2

Main moved thirty commits while the arc was in review. Merged, not rebased; 106 files conflicted.
- **The relay is world102.** Main's DISC12 (the pose's hand-in-use and beast-form bits) took world101, and its LAW row
  stands as main recorded it. The arc's frames move their RELAY_MIN gates to 102, and the arc's pins name the new
  boundary: world101 refused, world102 routed. The arc's world101 row was never deployed; the merged bundle is
  recorded as world102.
- **The resolution, number by number.** 230 hunks changed numbers only, and a three-way rule took each number.
  - A line cite or one of its continuations follows main, and `tools/citeMerge.mjs` then maps it (386 cites).
  - Any other number keeps whichever side changed it. So CITE-SLASH's and CITE-CS's repairs stand over main's copies,
    which were still drifting: TalkManager.GetReactionToPlayer_0_1_2 read :889-893 on main.
  - Where only one side rewrote a line, the line is that side's whole, so citeMerge knew where it came from.
- **Both sides fixed AUDIT DISC7's neigh pin.** Main's AUDIT SURV-TIERS third pass pins the one draw that matters at
  0.999; the arc had fixed every draw at 0.5. Main's fix is the narrower one, and the test is main's, so it stands and
  the arc's retires.
- **Six of main's mutant records, re-aimed by content.** Each is aimed at the site its name gives, and each dies
  against a green baseline.
  - Four SURV-TIERS records mutate line cites in source comments, and the merge had moved those cites
    (`world.js:3177` is `:3188` now).
  - MUT-AIM found two that name two sites each:
    - DISC10-D-H1's stamp, which the hit's defaults and the kill's share;
    - DISC9's heard word, which DISC11's rain gain repeats below it.
- **Counted again.** Section A has 179 rows, with main's DISC10-B and DISC10-A. Port-Status section 2's fourteen
  identifiers were re-resolved by content (CD3), and the wrapped `(:6759)` in chargenSession.js by hand (CD4, CD8).
- **No new drift.** Run over the merged tree with both histories, the loose-slash and DFU-range scanners find only
  this arc's own repairs.

## CHAT-HELP - the chat says where its commands are (2026-09-23, Mac)

Mac: "a non-intrusive greeting message that says something along the lines of (use /help for commands)". The chat has
had `/help` (and `/emotes`) since CHAT-CHAN, and nothing told a player so. Each time the player goes online the chat
greets them with one line, "Welcome! Type /help for chat commands.", on its first tab. It is theirs alone (a system
line, never sent) and it is never counted unread (`net/chat.js` push's `quiet`), so it is there to read when they open
the chat and no badge asks them to. The chat box's own hint is unchanged. `test/chathelp.test.js` (3),
`tools/mutants/chathelp.json` 4 of 4 dead.


## CHAT-P and CHAT-W — the Party tab only in a party, and a channel's lines kept to its tab (2026-09-24)

Mac: "Party chat should only show if in a party", and "Messages sent in world chat shouldnt carry over to region chat".

- **CHAT-W, the root cause.** The relay keeps its rooms apart, and so does the open panel: each tab lists its own lines.
  The leak was the peek, the last five lines drawn over the world while the chat is closed. CHAT-CHAN took the peek
  from every tab, so a World line stood over the screen of a player reading Region, marked "World". The peek now draws
  the open tab's lines, plus the Party tab's (`peekAll`), because a party's line is said to the player and not to a
  room they happen to be in. Notices the game says (`pushAll`) are on every tab, so they still show. The other tabs
  signal news with their badge.
- **CHAT-P.** The Party row starts off the bar (`hidden`). The chat frame puts it on the bar while `social.party` holds
  (`ChatLog.setShown`) and takes it off otherwise.
  - While off the bar, the tab cannot be selected and its unread count is on no badge.
  - Taking it off while it is the front tab hands the front to the first tab still on the bar, which is read at once
    if the chat is open. Its lines stay as history.
  - A party note lands on the Party tab only while a party holds. The note of my own removal lands on the tab I am
    reading, whatever order it and the party frame arrive in (`net/chat.js partyNoteTab`).
- Pinned in `test/chatchan.test.js`, with re-aimed pins in `test/chat1.test.js`. Mutants: `tools/mutants/chatchan.json`
  `CHAT-W-*` and `CHAT-P-*`, all dead.

## DUEL1 - a duel between two players, in a ring of light (2026-09-24, Mac)

Mac: "So before we merge this. I want to be the foundation of pvp. When inspecting a player, they should be able to send
an invite to duel which then traps both players in a surrounding transparent hographic wall that keeps them from going
outside of the duel space." Asked, Mac chose: weapons, bows and spells all count; "Loser drops to 1HP and both are fully
healed on duel end. Add a dueling K/D to the profile menu and player inspect profile"; outdoors only; the record per
account, on the main menu's account card.

**The one door through co-op's rule.** Co-op was never PvP (`11-Multiplayer/Multiplayer.md`): no peer stands in any
melee, arrow or spell target list, a `hit` names foes alone and a `cast` lands a party mate's gift alone. The duel is the
one way through that, and it is consensual and bounded - two players who both said yes, inside one ring, until one of
them falls to 1 health (never 0: a duel kills nobody), yields, or it is called off.

**The challenge.** The Inspect card (INSPECT1) carries a Challenge button beside Close, its state the duel law's word
(`duelButtonFor`: the relay cannot carry one yet, indoors, too far, busy, sent, duelling - each says so under a disabled
button). The challenged player hears it in the chat ("... challenges you to a duel - answer on the prompt, or press F on
them") and sees a strip at the top of the screen (`ui/duelPrompt.js`, the party invitation's shape) with Accept and
Decline and the seconds left; the F-menu on the challenger reads Accept duel and Decline duel. A challenge stands
DUEL_ASK_TTL_MS (30 s); one declined (or lapsed) is answered no, unsaid and unprompted, if the same player asks again
within DUEL_REASK_MS (15 s) - a prompt over someone's game is not a thing to send again and again. THREE STEPS: ask, yes, and the challenger's START, which carries where the ring stands - so
nobody is shut in a ring the other side never confirmed (a yes that gets no start in DUEL_START_WAIT_MS lapses and says
so). Crossed challenges become one duel, as crossed trades do. Outdoors only - the streaming world's exterior - and
within DUEL_RANGE_M (10 m) of each other, measured from both ends at the ask, the answer and the start.

**The ring.** DUEL_RADIUS_M (12 m) around the midpoint of the two bodies, in the WORLD frame (natives on x and z, metres
on y - the pose's own), so it stands still under either machine's floating origin. Each client keeps ITS OWN body in it:
the motor clamps the feet after every physics step to the radius less the capsule and takes away the outward half of a
jump (`player/motor.js _keepInArena`; the host sets the ring every frame from the world frame, the motor shifts it with a
recenter and drops it on any placement). Not a mesh in the collider - that would stop arrows, foes, the camera and the
activation rays and could be climbed or levitated over. The doors a map or a bed would open out of it are shut too: a
live duel's opponent is an enemy nearby to the travel map, a Travel Options journey and rest, and a building or dungeon
door says "You cannot leave the ring while you duel." A duellist carried far past the edge anyway (a teleport) ends the
duel; so does an opponent SEEN past it for DUEL_OUT_MS, whatever their own client says.

**The wall.** `render/duelWall.js`: a cylinder of light added onto the frame (ONE, ONE - it only brightens, so it is
see-through by construction), no depth written, cut by the ground wherever the ground stands (it reaches four metres
below the centre), a grid of thin lines around it, bands rising up it and one bright sweep climbing it, gone toward its
top, fogged as the ground is, both faces drawn. Its geometry never changes; each ring is placed by uniforms. Every rate
is whole cycles over DUEL_CLOCK_PERIOD and the clock is handed wrapped (the wisps' law). Built in every skin - the
players must see the ring whatever they play in - and a shader that will not build costs the wall, never the game.
ONLOOKERS see it too: a duellist's own foes frame carries the ring (`du`, validRingRecord - the HCC's `hv` law: said on
every full frame while it stands, null once when it falls), and every client draws each duel once.

**The fight.** A DUEL_COUNTDOWN_MS count ("fight in 3 seconds!", then "Fight!"), then every blow at the opponent is a
numbered `strike` or `spell` frame and THE DEFENDER RESOLVES IT - the port's law for any blow at a body ("the host
decided the swing; I decide the hit"). The attacker sends what its sheet brings (`combat/duelCombat.js duelAttackerOf`:
level, race, the eight live attributes, the four skills a blow reads, the career's bitfields, health; the weapon's
template, material and condition) and never a damage; the defender stands that sheet up as a stub attacker (`duelStub`,
a FRESH weapon at the striker's condition) and runs the game's one formula - DFU's, or the physical-combat overhaul's -
against its own armour, dodging and luck, and a pin holds the stub equal to the striker's own entity roll for roll. The
swing reaches the opponent before any pool (the foes' own reach, view and sight test); a shaft on them is a strike off
the bow; a spell - touch, missile, blast or area - meets them as a mark in the cast engine and sends its HARMFUL families
alone (Paralyze, Continuous Damage, Damage, Disintegrate, Drain, Silence), which the defender applies as any caster's
spell at them, save and all, tagged the duel's. The defender answers each blow with a `result` (landed, the damage, its
health): the striker's HUD shows the number through the one seam, the opponent's health on the target bar, the blood and
the sound, and the striker's own weapon wears. Only the live opponent's blows are taken, this duel's, each number once,
DUEL_BLOWS_PER_S a second, and only from where the striker is seen to stand (`duelBlowPlausible`).

**The end.** A duel's blow that would take a player to zero leaves them at ONE (`characters/playerEntity.js` `spare`,
passed by the duel's doors alone - the strike, the spell's instant damage, and its damage over time off the one ticker
every host shares); that side says `end fell` and has lost. A side may yield (the F-menu's Yield the duel on the
opponent). The loser's own signed-in client reports the loss to the account service naming the winner by the account
the relay stamped on the winner's frames - nobody credits themselves a win. A duel that reaches DUEL_MAX_MS is a draw;
one called off (a player leaving, dying to something else, carried off) records nothing. Whatever ended a duel that
started, both sides are fully healed - health, fatigue, magicka - DUEL_HEAL_HOLD_MS later (the loser is seen to stand
at 1 health first), and the opponent's spells on each are stripped. A wolf in the ring still kills: only the duel's
own blows are floored.

**The wire.** One directed frame, `duel` (world107 - world105 on its branch, renumbered past main's world105 and world106 at the merge; `net/wire.js validDuelData`): ask/yes/no, start with the ring's
centre, cancel, strike, spell, result, end. Routed like a card to the one socket `to` names, from a place room, on its
own meter (DUEL_HZ_MAX) and its own per-sender funnel onto the destination - a duellist's blows never wait on the casts
or cards its sender spent there. The relay stamps the sender's VERIFIED ACCOUNT (`sub`, off the identity token) beside
its id, and stamps the card frame's answer the same way, so the Inspect card can read the record the account service
keeps for that account - never a record the card claims. That names the sender's account to the ONE socket the frame
reaches, as a chat line already names it to everyone in its channel (MOD1); a place room's roster still names none. The cast frame's spell law is shared with the duel's (one
projection, `castSpellOf`), and the cast frame is exactly what it was.

**The record.** `server-account` migration 0008: one `duel_results` row a duel that named a loser, and no counter
columns - a player's wins are the rows naming them the winner, their losses the rows naming them the loser, so the ONE
INSERT is the whole write. The loser reports at most once a DUEL_REPORT_GAP_S and one pair counts at most
DUEL_PAIR_DAY_MAX a day, both measured inside that INSERT (`reportDuelLoss`); a self-duel (two tabs of one account) and a
winner who is no account are refused. `POST /v1/duel/loss { winner }` (the session is the loser) and `POST /v1/duel/record
{ id }` sit behind a session; `/v1/account` carries the caller's own. The main menu's account card shows "Duels: 3 won,
1 lost (K/D 3.00)" (the K/D is wins over losses, and no losses reads the wins); the Inspect card shows the same line
for the player it stands for, asked by the relay's stamp and kept a minute. acct8.

**Recorded, not built.** A full heal on any duel's end is Mac's rule and it is a free heal: two players can start a duel
and yield to top themselves up - nothing here stops it. Nothing server-side sees a blow, so a modified client can refuse
to fall or to report its loss (the duel then runs to its draw), and two accounts can trade wins up to the pair's daily
bound. Mounted duellists fight as they stand (the pose carries no crouch, and a rider's capsule is the rider's). A
duel spell's reflection lands on nobody (the defender has no caster entity to send it back at). Onlookers are not held
by a ring and can walk through it.

**Pins.** `test/duel_session.test.js` (7), `test/duel_wire.test.js` (6), `test/duel_combat.test.js` (7),
`test/duel_wall.test.js` (6), `test/duel_record.test.js` (7). `tools/mutants/duel.json`: 51, all dead (three survived the
first run - an exactly lethal blow, a weapon whose skill is not a long blade's, a faded ring under the draw's cap - and
each found a test that did not look; the tests look now). The relay is world107's (`test/relayversion.test.js`'s row);
the account service acct8's. Re-aimed: the version pins (world107, acct8), the foreign-pass counts (the wall is the
world host's seventh), the moved source pins (the melee ladder, the arrows' targets, the travel map's refusal, the one
bag of acts, the card arm, the cast funnel), and seven older mutant records whose lines the change reached.

## AUDIT DUEL1 - four reviews before the merge (2026-09-24, Mac: "Do an audit on everyrhing")

Four independent reviews read DUEL1 and DISC21 end to end: the duel's trust boundaries (the wire, the relay, the
account service), its rules and combat, regressions outside it, and DISC21 with the tests and the records. Every
finding below was verified against its code path before it was fixed. `test/auditduel1.test.js` (4) pins them, with
`test/duel_record.test.js` (8) for the record's SQL; `tools/mutants/auditduel1.json` has 28 mutants, all dead.

**Blocker.**
- **A1: a record minted without a duel.** Any session could report a loss naming any account as the winner. Guest
  accounts cost a POST, so five guests posting every sixteen seconds gave an account fifty wins in a quarter of an
  hour, with no relay involved. A duel now counts only between two REGISTERED accounts (the loser's session and the
  winner's row both carry a handle), and one winner counts at most `DUEL_WINNER_DAY_MAX` (20) a rolling day, from
  anyone - inside the same one INSERT, over its own index `(winner, at)`. A guest's duel is fought, and not counted.

**Major.**
- **A2: a forged result broke the striker's weapon.** The defender's `dmg` wore the striker's own weapon uncapped (a
  99999 broke a Daedric blade with one answer). The wear now reads `duelWearDamage`: at most six times the weapon's own
  top roll with its material and the striker's strength (a backstab's three, the overhaul's critical strike's two).
- **A3: a stranger spent a duellist's budget.** Every ask, yes or start from anyone was answered, from the same 10
  frames a second a duellist's blows go on. A duellist now answers no stranger at all, and outside a duel each peer
  gets at most one refusal a `DUEL_REASK_MS`.
- **A4 + B1: a duel's drain killed.** The duel's drain is its own entry, so DFU's permanent-less-one cap counted it
  alone; over an old drain, a disease or a poison it took the live stat to 0, and a stat at 0 kills through no duel's
  floor. A duel's drain now leaves the LIVE stat at 1.
- **B2: a swing bashed out of the ring.** A swing that met no body fell through to the door bash, which the ring's
  refusal did not cover: an open door walked through, a dungeon entered, a locked door opened on the roll (and the
  watch told). The bash is refused while a duel holds.
- **B3: a duel's fatigue damage killed.** At 0 fatigue the exhaustion collapse can kill a swimmer or a player a foe
  can see. A duel's fatigue damage - instant (marked), or a round (its entry) - leaves 1, in the world host's spell
  sink and the shared ticker alike.
- **B5: a double knockout was two losses.** Each side's own fall ends its own duel, so both reported. The account
  service now takes two losses in opposite directions within `DUEL_MUTUAL_S` (4 s) as a draw: the second report
  removes the first row and counts nothing, and the one row a report can remove names its own sender the winner. The
  duel says "X fell too - the duel is a draw." when the other fall lands in the heal's hold.
- **B6: the swing's reach.** The defender measured a swing against where it stands NOW, which dropped real connects on
  a player running away; and a swing's claimed position could stand four metres from where it was seen. A swing now
  reaches if it reached any of the defender's own feet over the last `DUEL_TRAIL_MS` (500 ms, world.js `_duelTrail`),
  and its claim may stand at most `DUEL_MELEE_POS_SLACK_M` (3 m) from where it is seen (a spell keeps 4).
- **D1: a test that tested nothing.** The "yes to a lapsed ask" case lapsed the ask's own quiet with it, so no yes was
  ever sent and its mutant survived; the record's "51, all dead" was wrong. The test now waits the quiet out and pins
  the yes and the challenger's answer.

**Minor.**
- **A5:** an ask taken back and asked again at once skipped the re-ask quiet; a cancel now sets it.
- **B4 + C2:** a duel's spells were saved (F9, the exit autosave) and restored; save and load now drop them.
- **C1:** a duel ended away from a cell room (a Recall into a dungeon) forced every later foes frame full; only a cell
  room forces it now.
- **D2:** Mac's "both are fully healed" had no pin; the heal's strip and its health, fatigue and magicka are pinned.
- **D3 (DISC21-C):** a pad player's empty-quickslot line named the keyboard's key; with the pad live it names none, as
  the chip shows a glyph.
- **D4:** the clamp the tests drove (`clampToRing`) was not the one the motor ran; the motor runs it now.
- **D5:** `peerGone` and `reset` had no caller. The law's own tick now drops the asks of a peer it can no longer reach,
  and leaving the page ends a duel as `left` and heals, before the exit autosave writes.

**The limits that stand.** Still no server authority over a blow: a modified client can refuse to fall. A quick yield
is still a free full heal (Mac's rule). A pair can still count `DUEL_PAIR_DAY_MAX` a day between two registered
accounts, and a winner 20. Mounted duels, a reflected duel spell, and onlookers walking through a ring are as above.
