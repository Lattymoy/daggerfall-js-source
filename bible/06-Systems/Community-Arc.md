# Community features

The players' own requests for the online game: a chat with channels, resizing, dice, actions, colours and pings; a
loot window with a tab per body; an Inspect card for a player in front of you; duels in a ring of light; letters to
players who are away; and journal pages shown or sent to others. The player meets them in the chat panel, the friends
panel's Letters tab, the F-menu on another player, and the loot window. None is a DFU member: Daggerfall Unity has no
chat or online play.

## How it works

**Channels** (`src/net/chat.js` `CHAT_TABS`; the host is `scenes/world.js`).

| Tab | Who hears | Carried by |
|---|---|---|
| World | everyone online | the World channel |
| Region | everyone in the player's politic region | a room per region, joined once the region has held `CHAT_REGION_HOLD_MS` (5 s) |
| Lang | everyone in the chosen language channel (`/lang`) | a room per language (`CHAT_LANGS`); shown only while chosen |
| Trade, LFG | those who joined (`/join`, `/leave`) | a room each; shown only while joined |
| Party | the party's members | the hub's link, `ch: 'party'`; shown only in a party |
| Guild | the guild's members online | the hub's link, `ch: 'guild'`; shown only in a guild |
| Local | bodies within `CHAT_SAY_RANGE` (60) | the presence session's room |

Each tab lists its own lines; the peek over the world draws the open tab's lines plus Party and Guild's. A game notice
is one line kept on every tab. Bubbles stand over a speaker's head for a line on any tab the hearer received, except an
out-of-character aside.

**Lines and commands** (`src/net/chatCommands.js`, pure). `/world` `/g`, `/region` `/r`, `/party` `/p`, `/local` `/l`
`/say` `/s`, `/ooc`, `/lang`, `/lc`, `/join`, `/leave`, `/help` `/?`, and `//text` for a line starting with a slash. A
line starting with a slash is a command or is refused in words, kept in the field to mend. `((text))` on any tab is an
aside out of character, drawn dimmed. `/me` says an action ("Bran looks around"); emote gestures are aimed at players
nearby (`EMOTES`). `/rp` draws a roleplay line in green italics. Emoji stay whole.

**Dice** (`src/net/dice.js`). The client asks `{t:'roll', n, m, k}` (up to `ROLL_DICE_MAX` dice of up to
`ROLL_SIDES_MAX` sides); the relay rolls from its own CSPRNG without bias and says the result as a frame no player can
send.

**The panel** (`src/ui/chatPanel.js`). Opening lands on the newest line. A corner grip drags the width (and the text's
scale with it, `width / 440` within 0.8 to 1.8) and the height; arrow keys step it and a double click resets it, saved
as `chatWidth` and `chatListHeight`. The friends panel places itself beside or below the chat's footprint. Plain lines
take their channel's colour (`src/ui/chatColours.js` `CHANNEL_COLOURS`: World white, Region green, Guild purple, Local
grey, Party teal, Language rose), each at 4.5:1 contrast or better; names are never their line's colour. A line naming
the player with `@Name` is a ping: a gold wash, a gold count until read, a chime. The roster and the hide button are
`06-Systems/Chat-Roster-And-Names.md`.

**The loot window holds the pile.** Bodies stacked in one place each get a tab in the loot window, since DFU's single
activation ray only strikes the front one.

**Inspect** (`src/ui/profileWindow.js`). The F-menu's first row on another player (`src/ui/socialMenu.js`; on touch the
HUD's button) opens their profile: glyph, name, title, stats, worn gear and duel record.

**Duels.** From the Inspect card's **Challenge**: an ask, a yes, and the challenger's start, within `DUEL_RANGE_M`
(10 m), outdoors only. A challenge stands `DUEL_ASK_TTL_MS` (30 s); a declined one is not re-sent within
`DUEL_REASK_MS`. The ring is `DUEL_RADIUS_M` (12 m) about the midpoint in the world frame; each client's motor keeps its
own body in it, and doors, maps and rest are shut. Weapons, bows and spells all count; the loser drops to 1 health and
both are healed at the end. The relay referees the bout, its blows, the ring and the end (`src/net/duel/duelRef.js`);
the record is claimed once on the account and shown on the profile and the main menu.

**Letters** (`server-account/src/letters.js`, law `src/net/letterLaw.js`). A registered player writes to another by
handle from the friends panel's Letters tab (a friend's row has **Letter**, a letter has **Reply**). The world tab says
when letters arrive. Bounds: `LETTER_SUBJECT_MAX` (60), `LETTER_BODY_MAX` (800), `LETTER_LINES_MAX` (40); refused,
never cut. `LETTERS_SENT_MAX` (20) an hour and `LETTERS_PAIR_MAX` (5) to one reader (`mail-rate`); a reader keeps
`LETTERS_INBOX_MAX` (50) and a full box refuses the sender. Guests can do neither; nobody writes to themselves; a muted
player writes to nobody.

**Journal pages.** The journal is DFU's notebook (`src/systems/notebook.js`). A note has **Share** to show it to a player
standing near, or can be sent as a letter; a page received can be kept in the reader's own journal.

## Rules

- Each request handled head-on and thoroughly (Mac).
- The Inspect card shows glyph, name, title, stats and worn gear (Mac).
- The chat is dragged to resize, with the text (Mac).
- Party chat shows only in a party; World lines do not carry over to Region (Mac).
- Bubbles over the player for chat on any tab (Mac).
- Duels: invited from Inspect, trapped in a transparent ring, weapons, bows and spells count, the loser drops to 1
  health and both are healed, a duel K/D on the profile, outdoors only, recorded per account (Mac).
- Trade and LFG channels without clutter: shown only when joined; `/rp` italicises in green (Mac).
- Chat colours must all be readable; a name is never its line's colour (Mac).
- A roll is the relay's, never a number the client chose.
- A letter is the account service's, since it outlives a session; the mute stops a letter as it stops a chat line.

## Code and tests

- `src/net/chat.js`, `src/net/chatCommands.js` - tabs, commands, lines
- `src/ui/chatPanel.js`, `src/ui/chatColours.js` - the panel, sizes, colours, pings
- `src/net/dice.js` - dice
- `src/ui/profileWindow.js`, `src/ui/socialMenu.js` - Inspect
- `src/net/duel/` - duels
- `src/net/letterLaw.js`, `src/net/mail.js`, `server-account/src/letters.js` - letters
- `test/net/chat1.test.js`, `test/net/chatchan.test.js`, `test/net/chathelp.test.js` - channels and commands
- `test/ui/chatscroll.test.js`, `test/ui/chatsize.test.js`, `test/ui/chatcolours1.test.js`, `test/ui/chattrade1.test.js`
  - the panel, sizes, colours, Trade and LFG
- `test/net/dice1.test.js`, `test/net/emote1.test.js` - dice and actions
- `test/ui/lootstack.test.js` - the loot window's tabs
- `test/ui/inspect1.test.js` - Inspect
- `test/net/duel_wire.test.js`, `test/server/duel_record.test.js` - duels
- `test/server/mail1.test.js`, `test/net/journal1.test.js` - letters and pages
