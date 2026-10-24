# CHAT SAFETY - blocks, witnessed reports, bans, a reviewer and the moderators' queue

Opened 2026-10-17. A Patreon supporter wrote in the community's channel that they had stopped using the world chat:
homophobic "jokes" about pride flags, asexual players called "attention sluts", aggression that slid past a moderation
team of three. Mac: *"This absolutely hurts my soul. We need to find ways to combat this without the need of ingame
moderation, although we do need a report function. Any good ideas? Maybe integrating an AI moderator?"* A plan was laid
out - block, a report the relay witnesses, a moderators' queue in Discord with a record and a ban, an AI reviewer that
sorts and never bans, a written code of conduct, a new voice's pace - and Mac answered: *"Lets do every single thing
here. I want a full fledged future proof system."*

Not a DFU member: Daggerfall Unity has no chat. Ledger A row ONLINE, its CHAT SAFETY bracket (AUDIT SAFE DOC-15).

The slices, one arc and one deploy of each end:

| Slice | What | Where |
|---|---|---|
| SAFE1 | A player's block list | `server-account/src/safety.js`, `src/scenes/chatSafetyHost.js`, `src/net/chat.js`, `src/net/social.js` |
| SAFE2 | The line's witness: the relay stamps every chat line | `src/net/safety/chatStamp.js`, `server/src/index.js` |
| SAFE3 | A report, its case, and the automatic mute | `src/net/safety/safetyLaw.js`, `server-account/src/safety.js`, `src/ui/chatPanel.js` |
| SAFE4 | The record, the ladder, the ban - and the service's door to the relay | `server-account/src/sanctions.js`, `src/net/identityToken.js`, `server/src/index.js` |
| SAFE5 | The reviewer: the relay's feed and an AI model's verdicts | `src/net/safety/chatFeed.js`, `server-account/src/modAi.js`, `server-account/src/safetyClock.js` |
| SAFE6 | A new voice's pace | `src/net/wire.js`, `server/src/index.js` |
| SAFE7 | The code of conduct | `src/net/safety/conduct.js`, `src/ui/conductCard.js`, `privacy/index.html`, `terms/index.html` |
| SAFE8 | The moderators' queue in Discord | `server-account/src/discord.js`, `server-account/src/discordCommands.js`, `tools/discordModCommands.mjs` |

The relay is `world215`, the account service `acct152`, migration `0126_chat_safety.sql` - `world214`, `acct150` and `0125` on
its branch, renumbered past main's WIKIMAID (`world214`, `acct150`) and KEY-LAW (`acct151`, `0125`) at the merge. The ban
frame is the relay's from `world215` (`BAN_RELAY_MIN`).

**AUDIT SAFE** (the same day, the owner: *"Lets audit everything and ensure perfection"*): six lanes read the arc cold -
the relay, the service, the reviewer, Discord, the client, the record - and every finding was fixed or decided; the
findings and their verdicts are `01-Overview/audits/Audit-Chat-Safety.md`. What the audit changed is written into the
sections below as they now stand, each marked with its finding's id.

## 1. Why - what a word list cannot do

TEXT-F1 (2026-10-07, `06-Systems/Online-Arc.md`) stars the words a list names, inside `sanitizeChat`, at both ends. The
lines that drove this arc had no listed word in them, or kept their meaning with one starred: "attention *****" about
asexual players reads exactly as it was meant. Intent is not a spelling. The arc keeps TEXT-F1's mask as the first wall
and adds four more, each answering a different failure:

1. **The player's own wall** (SAFE1): whoever is being harassed can make it stop for themselves, now, with no moderator.
2. **Evidence** (SAFE2, SAFE3): a report a moderator can trust, because the relay - not the reporter - says what was said.
3. **Moderators who need not be in the game** (SAFE8), working from **a record that is never cleared** (SAFE4).
4. **A reviewer that reads intent** (SAFE5) - which sorts the queue and, only when told to, mutes for half an hour.

And two cheap levers beside them: **a written code** every player agrees to before their first line (SAFE7), so the line
is never unwritten, and **a new voice's pace** in public channels (SAFE6), so a throwaway account cannot flood them.

## 2. SAFE1 - the block list

An account's own list of accounts it no longer hears: `blocks` (migration 0126), at most `BLOCKS_MAX` (200), read and
written through `POST /v1/safety/blocks | block | unblock`. Kept by the service so it follows the player to every device;
applied by the client, because the relay fans a line to everyone and what one hearer hides is that hearer's business.

- **The log never keeps a blocked line** (`ChatLog.hears`, set by the host from the list): no tab, no peek, no overhead
  bubble, no search shows it. A block also takes back the lines already heard (`ChatLog.forgetSpeaker`).
- **The social picture drops a blocked account's friend request, party invite and notes** (`SocialState.hears`), and
  takes back one already shown (AUDIT SAFE CLIENT-11). **A trade, duel, wedding, card or journal page asked of you by a
  blocked account is dropped** at the session (`OnlineSession.hears`, CLIENT-7), and **a letter from one is never
  delivered** - its sender answered as if it went (`letters.js`, CLIENT-7).
- **The blocked account is never told.** A sender learns nothing from being blocked - the safest answer for the person
  who blocked them.
- `/block <name>`, `/unblock <name>`, `/blocked`, and **Block** on a line's own menu (a speaker's name pressed in the
  chat). A name is resolved over the players this page holds AND the lines it heard together, and two accounts of one
  name is a refusal, never a guess (AUDIT SAFE CLIENT-3 / DOC-6: one peer of the name won over the account that spoke).
  The list keeps the name the line showed beside the account, so `/unblock` takes either (CLIENT-9); a list that failed
  to load is asked again (CLIENT-8).

**A departure from Community-Arc.** `06-Systems/Community-Arc.md` decided "No block list: a moderator's mute and the
per-reader rate are the walls" for the pages (SOC-PAGE). That held while three moderators could read everything. The
community outgrew it; the pages' own rate stands, and the block list now stands beside it.

## 3. SAFE2 - the line's witness

A report is only as good as its evidence, and a player's own chat log is that player's word: a client can write any
line into its log and "report" it. So the relay - the one party that saw the line, because it relayed it - signs every
chat line it fans out, with the key it already signs its receipts with (`GATE_SIGNING_KEY`, WB3's):

    sg = base64url(Ed25519("chat-stamp1\n" + JSON.stringify([tab, sub, name, at, text])))

`tab` is the chat tab the line is heard on (`stampTabOf`: World, Region, Lang, Trade, LFG, Party, Guild, or a place's
Local), `sub` the speaker's verified account, `at` the relay's clock. The frame already carries every field but the tab,
so a stamp costs the 86 characters of its signature. The account service checks each stamp with `GATE_PUBLIC_KEY`
(`verifyStamp`) before it keeps a word.

- **The words are the starred ones.** The relay signs what it relayed, which is what everyone read - and the client
  keeps that text verbatim for the report (AUDIT SAFE CLIENT-6 / RELAY-1: it sanitized the line again, and TEXT-F1's
  mask is not idempotent, so a line like `n fuck-i-g` failed its own stamp).
- **A reporter may leave lines out; they cannot put words in anyone's mouth.** A line of the reported account the relay
  did not relay - other words, another speaker, another tab, another moment - refuses the whole report
  (`report-unwitnessed`); another speaker's line that fails is left out, never the report (CLIENT-6).
- **A stamp is never a token, an order or a receipt:** its signed bytes begin `chat-stamp1\n`, which none of theirs do
  (AUDIT SAFE RELAY-13: `c1` was the card receipt's tag, the separation one byte).
- **Only a line that is fanned is signed** (RELAY-9): the stamp comes after the room's, the party's or the guild's budget
  and the junk checks, so a flood the budget drops costs no signature.
- **Unsigned is a real answer**, as a receipt's: a relay with no key relays its lines unstamped, and they cannot be
  reported. Rolls are not stamped.

## 4. SAFE3 - a report and its case

`POST /v1/safety/report { target, reason, note?, lines }` - the account, a reason (`REPORT_REASONS`: harassment, hate,
sexual, threat, spam, other), an optional note, and 1 to `REPORT_LINES_MAX` (16) stamped lines, at least one the
reported account's own (`reportShape`, both ends' law). A line older than a day, or more than a minute ahead, is left
out, not the report - refused only when none of the account's own is left (AUDIT SAFE CLIENT-5 / DOC-7: one day-old
context line refused a whole report); the client skips such lines too. The client picks the lines
(`ChatLog.reportLines`): a line's own **Report** carries that line and the stamped lines before it on its tab;
`/report <name> [reason]: <note>` carries everything that account said that this page heard, the account's own lines
first past the bound, and the note (DOC-13).

Reports about one account gather into **one open case** (`mod_cases`, a unique index on the open ones): its lines kept
once (`mod_case_lines`, at most `CASE_LINES_MAX`), its reporters once each (`mod_reports`). A case is what a moderator
acts on, and what the reviewer reads. **Its evidence cannot be crowded out** (AUDIT SAFE SERVICE-1): a reporter's second
report adds nothing, and when the case is full the account's own new lines take the room of others' oldest, then of its
own oldest (`keepCaseLines`) - four guest alts' small talk once filled a case, and the slur three regulars reported after
it was never kept.

**The automatic mute, and why it is hard to reach.** `REPORT_AUTO_MUTE` (3) reporters who **count** within an hour mute
the account for the ladder's first rung - half an hour - by `auto:reports`, and never a moderator, nor an account muted or
banned already (a moderator's week is never shortened to half an hour). A reporter counts when the Notice Board's law
says they would (AUDIT 28 N3): a registered account, not muted, no sprout (older than `SPROUT_S`, fourteen days). Five
guests made a minute ago cannot mute anybody; three regulars who saw the same line can, for half an hour, and a
moderator reads why on the case. **One wave mutes once**: the case is claimed in the statement that marks it
(`auto_at`), so two reports at once mute once (SERVICE-5) - and three more who count, after that mute, may mute again
(SERVICE-2: it was once a case, and a case stood open ninety days). The mute's order goes back to the reporter's
client, which carries it to every room it holds (MOD1's carrier), and to the relay's door (section 5).

Reports are rate-bounded (`REPORT_RATE_MAX` an hour). A muted player may still report. Reports that do not count open
at most `UNCOUNTED_CASES_HOUR` new cases an hour, service-wide - a report on an open case is always taken - and the
reviewer and the cards take the cases with the most reporters who count first (SERVICE-3: a guest flood buried the real
case thirteenth in the queue).

## 5. SAFE4 - the record, the ladder and the ban

**The record.** MOD1 wrote who muted a player beside the mute, and cleared it with the mute, so a player muted every week
for a month looked like a first offender to the next moderator. Now every mute, unmute, ban, unban and dismissal is a
row in `mod_actions` that nothing clears: who acted (a moderator's account - from the game or from Discord - or the
automatic `auto:reports` / `auto:review`), on whom, until when, why, and the case it answered. MOD1's `/mute` writes it
too.

**The ladder.** A strike is a mute or a ban in the last ninety days (`STRIKE_WINDOW_S`). The next strike earns, by
`LADDER_MIN`: half an hour, then a day, then a week - and past the ladder (`LADDER_BAN_AT`) the suggestion is a ban.
A moderator may always choose otherwise; the automatic mutes only ever take the first rung. `/strikes <name>` (and
Discord's `/mod lookup`) says the strikes, the next rung, what stands now and the last acts (AUDIT SAFE DOC-10: the game's
said no standing). **A dismissed case's automatic mutes are no strikes** (SERVICE-6): dismissing it voids them
(`mod_actions.void_at` - the record keeps them, marked) and lifts one still running, so an innocent player is never
walked up the ladder one dismissed case at a time.

**The ban.** MOD1 bounded a mute at a week: "Longer is a ban, which is a different decision and not one Mac has asked
for." He has now. A ban is `players.banned_until` (1 to `BAN_DAYS_MAX` days, or `BAN_FOREVER`) and the reason the player
is shown. The service answers a banned account `{ error: 'banned', until, reason }` on **every door behind a session
but signing out, and at signing in and recovering** (AUDIT SAFE SERVICE-7: both minted a banned account a session; the
answer comes only once the password or the code is right, and the code is not spent), so it mints no token and opens no
room. `/ban <name> [days|perm]: <reason>` and `/unban <name>` in the game (SERVICE-10: the game's ban carried no reason),
the buttons and `/mod` in Discord; unbanning an account not banned is refused (`not-banned`). A moderator is never
banned, nor muted, by anyone (MOD1's `protected`). A moderator's mute or ban of an account closes its open case as their
act (SERVICE-2).

**The ban order.** `{o:'ban', s, bn, i, e}` (`mintBanOrder`) - its own kind among `ORDER_KINDS`, its field `bn` and no
other kind's (never `bu`, which the home order holds). A room that checks one hands the order to the account's hub
sockets first (`law`), then tells each of its sockets there `banned` and **closes it** (1008, `banned`), and **refuses
the account's hello** while the ban stands against a token older than it (AUDIT SAFE RELAY-4: a ban silenced chat alone,
and a banned socket kept posing, trading and duelling). The room holds its bans apart from mutes (RELAY-5: an unmute
lifted a ban's silence), and in its storage (RELAY-7: a wake forgot them), for as long as a token minted before the ban
can live. A ban lifted (`bn` 0) refuses nothing. The client, told `banned`, carries the order first, then leaves every
room and joins none again until an unban or a reload, and never retries a token the service refused as banned
(CLIENT-2: it left, and rejoined on its next frame). A ban frame goes only to a room whose welcome said `world214` or
later (`relaySupportsBan`, RELAY-3: an older relay closes the socket for good on a frame it does not know).

**The service's door to the relay.** MOD1's orders are carried by the moderator's own client. A mute or ban from Discord,
or an automatic one, has none - so the service posts its signed order to the relay's `SAFE_LAW_PATH` (`RELAY_LAW_URL`).
The Worker checks the signature with the key every room checks a token with **before the hub is woken** - its body
bounded first, its kind read from its claims so a post costs one verify, an order seen moments ago not passed on twice
(AUDIT SAFE RELAY-10) - and the hub applies it to its sockets and **hands the order to its target's own hub sockets**
(`law`), whose client carries it to every room it holds; the Worker answers ok only when the hub took it (RELAY-13). An
order older than a socket's own token is that token's to judge, not the order's (RELAY-6). **The service reaches the
door through a service binding** (`RELAY`, server-account/wrangler.toml - AUDIT SAFE RELAY S1): one Worker of an account
fetching another's workers.dev address may be refused outright (Cloudflare's error 1042), and a push that fails is
silent by design. Never the truth - the row is - only how a room already open hears it now; a push that fails lands on
the target's next connection, as MOD1's always did. A client hears `law`, `banned`, `muted` and `slowed` on a bucket of
their own, never the chat's (RELAY-2: a busy channel's lines crowded them out).

**What a modified client keeps.** A client that refuses to carry its own order keeps talking in the rooms the order did
not reach - its region, language, Trade or LFG channel - until its next connection, whose token carries the mute (a ban:
whose token is refused). The hub, and every room a moderator's or a reporter's client holds, hears it at once. MOD1 had
the same gap; this arc narrows it. Closing it whole is a relay that re-asks a fresh token of an open socket - a slice of
its own (section 11).

## 6. SAFE5 - the reviewer

**Why a model.** The lines this arc answers to carry their meaning past any list. A language model reading the code's own
rules reads intent - including "it's just a joke" - and says why in a sentence a moderator can act on.

**What it reads.** Two things, and nothing else:

1. **A reported case's lines** (focus: the reported account), when the case opens or grows.
2. **The public channels' feed** - World, Region, a language, Trade and LFG; never a party's, a guild's or a place's talk.
   The relay keeps a copy of each public line it relays (`_feedLine`), never awaited by the line, and posts a batch of
   them (`FEED_BATCH` lines, or `FEED_WAIT_MS` after the first) to `MOD_FEED_URL` through its `ACCOUNTS` service binding
   (AUDIT SAFE RELAY S1), signed with its receipt key (`sealFeed`, the bytes beginning `chat-feed1\n`). The service
   checks the signature and keeps the batch once (`mod_feed`) while the reviewer is on; off, it drops it unread. **This
   is the relay's first door to the service** (identityToken.js: "The relay never reads D1, never talks to the account
   service"): one way, off until its URL is set, never in a line's path, the public tabs alone, signed.

**When it reads.** On the service's minute clock (`safetyClock.js`, cron's `safety` job) - never in a request.
**The reports first** (AUDIT SAFE AI-3): `TRIAGE_MAX` cases a minute, the most reporters who count first, then the feed -
`FEED_READS_MAX` calls, each as many waiting batches as fit `FEED_LINES_MAX` lines (a batch of two lines no longer costs
a call of its own). Within `MOD_AI_DAILY_MAX` calls a UTC day (`mod_ai_days`), of which the feed may spend all but
`AI_REPORT_SHARE` (a quarter, kept for the reports); a call the API never answered is given back, and the day's tokens are
counted beside its calls. Each read is **claimed** in the statement that takes it (AI-9: two firings that overlapped read
one twice), asks the firing's statement budget first (AI-5), and a feed read opens at most `FEED_SPEAKERS_MAX` cases,
the worst speakers first, the rest going back to be read again. A speaker the feed's reviewer finds breaking the code at
severity 2 or worse gets a case of the reviewer's own, with the flagged line and the three before it; the feed's verdict
on a case a report holds raises its verdict but never closes the report's read (AI-6). **Nothing comes back unread and
lost** (AI-4): a read declined, cut off at `MOD_AI_MAX_TOKENS` or out of shape sends its lines back as two halves, and a
single line the model will not read is a case of its own, marked unread for the moderators.

**The call.** The Messages API over fetch - not the SDK, because the account Worker deploys from the tree without an
install step (`npx wrangler`, `account-deploy.yml`). The current Haiku (`MOD_AI_MODEL_DEFAULT`, `claude-haiku-5-5`) unless
`MOD_AI_MODEL` names another - fast and cheap enough to read every public line. The brief (`reviewerPrompt`) is the code
of conduct's own rules, the categories, the severity scale and what is allowed (trash talk about the game, swearing at no
one, roleplay violence against monsters, people talking about their own identity or using a reclaimed word about it,
and quoting, reporting or condemning abuse someone else said - AUDIT SAFE AI-8: a victim who quoted the slur was its
author to the brief); it is the same every call, so it is cached. Effort low, `MOD_AI_MAX_TOKENS` (8,192) of room - the
model's thinking counts inside it (AI-4: 2,048 cut a full batch off). The answer is held to a JSON schema
(`VERDICT_SCHEMA`): for each line that breaks the code, its category, severity 1-3, confidence and a sentence; the case
keeps the line it flagged (AI-10), and its card marks it `!`.

**What it may not do:**

- **It never bans.** With `MOD_AI` "on", a verdict of severity 3, in harassment, hate, sexual or threat, at confidence
  0.9 or more (`flagActs`), mutes for half an hour by `auto:review` - **only when a second read of the account's own
  lines, and nothing else, agrees** (AUDIT SAFE AI-1), on a case still open (AI-2: a dismissed case was read and muted
  after), never a moderator, the case claimed as the reports' mute claims it, the order pushed to the relay's door. Spam
  and a leak of someone's details are a moderator's to weigh.
- **With "shadow" it acts on nothing.** Its verdict is said beside every case in Discord, marked as a shadow's. Shipped
  "shadow": Mac's own law from INT5, "Measure 7 days, then enforce" - read what it says for a fortnight, then turn it on.
- **It reads data, never orders.** A player will type "ignore your instructions". The lines go in as JSON inside one
  tag, every `<` and `>` in them escaped so no line can close it; the brief says they are data and that a line is judged
  by its own words; the answer is a schema. A reviewer talked OUT of a verdict acts on nothing, which is where the game
  was before it. One talked INTO a verdict about someone else - a line that frames another, "P1's line hides a slur" -
  is the danger (AUDIT SAFE AI-1: one guest's report, and the reviewer muted the innocent player it framed), so the read
  that acts never sees another speaker's words.
- **It is told as little as it needs.** Speakers are P1, P2 - never an account id or a name; the lines' own words go as
  written, names typed in them included (DOC-9).
- **It is never in the line's path**, and a reviewer that is down, out of its day's calls or misconfigured costs nothing
  but its verdicts: its work waits for the next minute (a 4xx but 429 is said loudly in the log - a key or a model the
  configuration got wrong), and a case waits on it at most `REVIEW_WAIT_S` from its opening before its card goes out
  without one (AI-11: the wait ran from the last report, and a case reported often never posted).

## 7. SAFE6 - a new voice's pace

A guest (the verified token's kind - AUDIT SAFE RELAY-11: a guest older than `SPROUT_S` wore no sprout and was never
slowed), or an account whose token wears the sprout (younger than `SPROUT_S`), says one line in a public channel every
`NEW_VOICE_GAP_MS` (four seconds), measured on the ACCOUNT's meter at the relay (`_paces`, RELAY-8: a meter a socket let
five sockets say five lines, and a reconnect start afresh), spent only by a line the room's budget lets through
(RELAY-13). A line too soon is refused to its speaker alone with how long to wait (`{t:'slowed', ms}`), never fanned and
never struck. An ordinary conversation's pace, and a throwaway account's flood slowed to it. Party, guild and a place's
talk are never slowed. The client says so once in a while, and puts the line back in the field so nothing typed is lost
(CLIENT-12).

## 8. SAFE7 - the code of conduct

Six rules (`conductRules`, in the player's language): respect - no harassment, bullying or threats anywhere; **no hate -
never attack anyone for their race, ethnicity, nationality, religion, sex, gender identity, sexual orientation (asexuality
included), disability or age, not even as a joke**; no sexual remarks aimed at players and nothing sexual involving
minors; nobody's personal information; no spam, scams or pretending to be staff; trash talk about the game is fine,
attacking people is not. Then what follows a broken rule, and who reads a report.

The rule against hate names the joke because the joke is the form it takes in a game's chat, and a rule that left it
unsaid would be argued around in the first hour. It names asexuality because that is who was being called names.

**One text for both.** The reviewer's brief is built from these same lines in English, so a player is never held to a
rule they were not shown.

**Agreed before the first line.** The token's mint says whether the account has agreed to the code as it stands
(`conduct`), and the client's minter carries it to the host (AUDIT SAFE CLIENT-1: it built its answer field by field and
dropped this one, so the card never stood) - and an agreement made on the page is never undone by a mint that was in
flight; every way a line leaves the client asks it, a posted item's link included (CLIENT-13); the first line a player sends while it says no stands a card over the game
(`ui/conductCard.js`, on the overlay stack, Escape its Not now - CLIENT-10) and the line stays in the field. **The
agreement is the client's to ask**, not the relay's to enforce (SERVICE-8 / DOC-14): a modified client chats without it,
and the Terms say the game asks, and that the code binds every player either way. **I agree** keeps it on the account (`players.conduct_v`, `POST /v1/safety/conduct`, the
version shown - `conduct-stale` for an older one); **Not now** closes the card. `/rules` shows it again. The version is a
date (`CONDUCT_VERSION`), as the Terms' are; a new one asks every player again. An older service that says nothing is
heard as yes - a client never stops chat over a field its service does not send.

**The Terms and the Privacy Policy** moved with it, both to 2026-10-17: the Terms' conduct section names hate by what it
attacks and makes the code part of the Terms; the Policy says the stamped messages and reports (shown to the moderators
in the game and in Discord), the reporters' automatic mute, the automated review by a third-party AI provider (the
writers labelled, never named, though the lines' own words go as written; the public channels and reported lines alone;
a second review before any mute; never a ban), the block list (a blocked player's letters undelivered) and the record,
and how long each is kept - the Discord copies of a case's lines included (AUDIT SAFE DOC-1, DOC-9, DOC-12). A new version refuses an older build's sign-up (`terms-stale`, TERMS1's law) for
the minutes between the two deploys - the price of never recording an agreement to words nobody showed the player.

## 9. SAFE8 - the moderators' queue in Discord

A moderator need not be in the game. Every case is a **card** in a private Discord channel: the lines (the reported
account's marked `>`, the line the reviewer flagged `!`), the reports, their reasons and notes, the reviewer's verdict (a
shadow's says so), what stands against the account now, its strikes and the next rung, and what was done automatically
- with buttons: **Mute 30 min, Mute 1 day, Mute 7 days, Ban 30 days, Dismiss**. A press claims the case (AUDIT SAFE
DISCORD-3: a double click acted twice), acts - never shortening what stands (DISCORD-5) - records the act against the
case, resolves it, answers Discord with the card redrawn, and pushes the order to the relay's door AFTER the answer (the
Worker's `waitUntil`, DISCORD-4: Discord gives three seconds); the clock redraws the card besides, so an answer Discord
gave up on still ends in the true card (DISCORD-8). Dismiss voids the case's automatic mutes. `/mod lookup | mute |
unmute | ban | unban <player>` does the same by **account id first**, then name (DISCORD-1: an id is a valid handle, and
a decoy named after the reported player's id took the ban), and a mute or ban closes the account's open case.

**The clock posts and redraws** (`postCards`): a case opened while the queue was off is posted once it is on
(DISCORD-6); a post carries the case's id as its nonce, enforced, so a lost answer never posts it twice (DISCORD-7); a
message gone is posted anew, a card Discord refuses is marked and passed over, and only an unreachable Discord waits the
minute out (DISCORD-2: one refused card held the whole queue). Every call carries Discord's `DiscordBot` User-Agent
(DISCORD-10); every name and reason outside a code block has its markdown escaped (DISCORD-9).

**In the game too** (AUDIT SAFE DOC-4: a report reached no moderator until Discord was set up, though the code of conduct
said moderators read every one): `/cases` lists the open cases, the most reporters who count first; `/case <name>` reads
one - its lines (the account's `>`, the flagged `!`), reasons, notes and the reviewer's verdict; `/dismiss <name>`
dismisses it and carries its unmute order as `/mute`'s is carried; `/modhelp` lists them. A moderator may name an account
as `#<account id>`, which `/cases` shows beside each name, where two players share one. The routes are
`POST /v1/mod/cases`, `/v1/mod/case` and `/v1/mod/dismiss`, a moderator's alone.

**Who may act is the game's question.** `DISCORD_MODERATORS` pairs a Discord user's id with a game handle; a press is that
account's act and only while it holds `MODERATOR_HANDLES` or `DEVELOPER_HANDLES` (or, SHADOW-FANG-MOD, a title in
`MOD_TIERS` - Shadow Fang's list). Taking a handle off the list takes the
buttons with it; a Discord role grants nothing; the record names the moderator's own account, "(Discord)".

**Every interaction is signed** by the Discord application's Ed25519 key; the service checks the signature over the exact
bytes, and a timestamp more than five minutes old, before reading a byte (`discordSigned`). The bot pings nobody and a
player's words are drawn in a code block, so no line is markdown.

**The setup**, once (Mac):

1. In the Discord Developer Portal, make an application with a bot. Invite the bot to the server, and give it, in the
   private moderators' channel, View Channel, Send Messages, Embed Links and Use Application Commands.
2. Put the bot's token in the repository's secrets as `DISCORD_BOT_TOKEN`, and an Anthropic API key as
   `ANTHROPIC_API_KEY` (the reviewer). The account deploy puts both on the Worker (`account-deploy.yml`, "Put the chat
   safety's secrets") and names, in its summary, the Interactions Endpoint URL to give the application.
3. In `server-account/wrangler.toml`: `DISCORD_MOD_CHANNEL` (the channel's id), `DISCORD_PUBLIC_KEY` (the application's
   public key) and `DISCORD_MODERATORS` (`<discord id>:<handle>` for each moderator).
4. Nothing more: the account deploy's last step (DISCORD-SETUP, 2026-10-17, Mac: "Can you set the discord end up for
   me"; `account-deploy.yml`, "Point Discord at the service") does the Discord end with the bot's token alone, on every
   deploy. `tools/discordModCommands.mjs --setup` reads the application's id and public key from Discord
   (`GET /applications/@me`), refuses a `DISCORD_PUBLIC_KEY` that is not the application's (naming the right one), reads
   the server off the moderators' channel, sets the Interactions Endpoint URL to `<account service>/v1/discord/interactions`
   only when it differs (Discord signs a ping to it, which the service answers; offered four times, ten seconds apart,
   while an old instance may still answer), and writes `/mod` over whatever was registered there. A refusal turns the
   deploy red and says which step Discord refused; an unset token, channel or key skips it, said. By hand, the same:
   `DISCORD_BOT_TOKEN=... DISCORD_MOD_CHANNEL=... DISCORD_PUBLIC_KEY=... DISCORD_INTERACTIONS_URL=... node
   tools/discordModCommands.mjs --setup` (pinned: `test/server/discord_setup.test.js`; mutants
   `tools/mutants/discord_setup.json`).

**Discord is code** (DISCORD-CODE, 2026-10-17, Mac: "Is there a way we can set up something where you can handle all
future discord integrations and changes yourself?", then "Do it"; the rule is in `CLAUDE.md`). Every Discord change is a
change to the repository, merged, that the account deploy applies:

- **The commands are declared once**, beside the service that answers them: `DISCORD_COMMANDS` in
  `server-account/src/discordCommands.js`. The deploy writes the WHOLE list (Discord's bulk overwrite), so a command
  added there appears in the server, one taken out is gone, and one made by hand in the Developer Portal is written
  over. `discord.js` builds its usage text from the declared subcommands, so the declaration and its handler ship in
  one Worker; the test drives every declared command and subcommand through the service and holds each to a handler.
- **A change to any of it deploys.** The commands live under `server-account/`, and the deploy's path filter lists the
  setup tool's own import graph (`tools/discordModCommands.mjs`, `tools/lib/isMain.mjs`), held to it by the test - a
  change to `/mod` alone used to deploy nothing, so reached Discord only with some later change to the service.
- **The bot's hands are checked.** After the URL and the commands, the deploy reads the server's roles and the bot's,
  computes its permissions in the moderators' channel the way Discord does (its Permissions page: `@everyone` and the
  bot's roles, Administrator for everything, then the channel's overwrites - `@everyone`'s, its roles' together, its
  own - each denying before it allows; `channelPermissions`), and turns red naming what the cards need and it lacks
  (`MOD_CHANNEL_NEEDS`: View Channel, Send Messages, Embed Links). Before, a card simply never came.
- **What stopped it is said where it is read.** What the step did and what stopped it both go to the deploy's summary.
  The first live run (2026-10-17, after #993) was refused at the channel: `DISCORD_MOD_CHANNEL` was answered 404 Unknown
  Channel - no channel at all, where one the bot cannot see answers 403 - so the id copied was another thing's (a
  server's, a user's and the application's ids look the same). A 404 there now says so, and how to copy the channel's.

What stays a person's: making the application and its bot, inviting the bot to the server (an administrator's consent),
granting it roles and channel permissions, rotating its token (the `DISCORD_BOT_TOKEN` secret), and naming the
moderators (`DISCORD_MODERATORS`, which a pull request then writes).

With none of it set, the cases still gather, the reviewer still reads (with its key), and the game's `/cases`, `/case`,
`/dismiss`, `/mute`, `/ban` and `/strikes` still answer - the queue is simply not posted to Discord.

## 10. Retention

The relay's feed batches are kept for a day (`FEED_KEEP_S`). A case's lines, its reports' notes and the reviewer's
reason go ninety days after the case is resolved (`RESOLVED_LINES_KEEP_S`) - and its card in the moderators' channel is
redrawn without them (AUDIT SAFE DOC-1, DOC-12: the Discord copy outlived the policy's ninety days); a case left open
ninety days closes as expired (`CASE_OPEN_MAX_S`), its card redrawn; the reviewer's daily counts a month. The case
itself, the reasons chosen and the record of acts are kept for enforcement. Everything is the hour's sweep's
(`safetySweep`), each statement a page asked again while full and the budget holds (AI-7 / DOC-3: one page of 500 an
hour kept a busy day's feed past its day). An account that is deleted takes its blocks, its cases, their lines and
reports, and the record of acts on it (CASCADE) - no route deletes an account today.

## 11. Open, on purpose

- **Ban evasion.** A banned player can make a new guest. A guest's reports never count, and a new voice is slowed - but
  stopping a returning player is a device or network question, not a chat one, and is a slice of its own if it is needed.
- **A socket kept open past its order** (section 5): a relay that re-asks a fresh token of an open socket every few
  minutes would close the last gap. Its cost is a token mint a socket a few minutes, which SCALE4's storm law prices.
- **A word TEXT-F1 stars that a community uses about itself.** The list stars `dyke`, which queer players use of
  themselves; the reviewer is told reclaimed words about one's own identity are allowed, the mask is not. Unstarring a
  slur is a policy call, Mac's.
- **Guild invites from a blocked account** come through the guild book (`/v1/guilds/invites`), which names the inviter by
  name, not by account; filtering them needs the service to name the account.
- **The feed's timer and hibernation** (AUDIT SAFE RELAY S2): the relay's 30-second batch timer probably holds a quiet
  channel's object awake until it fires, and a batch is lost if the object is evicted first - the reviewer is an
  assistant, and a line it missed is a line a player can still report.
- **A mute landing while a line is being signed** (RELAY S3) is not read again for that one line; a ban landing then is
  (the room's sockets are closed, and `_stamped` answers nothing for a closed one).
- **TEXT-F1's mask is not idempotent** (RELAY-1): the client now keeps the relay's own text for the stamp, so reports hold;
  the mask itself is TEXT-F1's, unchanged.

## 12. Files and pins

- The law: `src/net/safety/chatStamp.js`, `src/net/safety/chatFeed.js`, `src/net/safety/safetyLaw.js`,
  `src/net/safety/conduct.js`; the ban order in `src/net/identityToken.js`; the frames and `NEW_VOICE_GAP_MS` in
  `src/net/wire.js`.
- The relay: `server/src/index.js` - `_newVoice`, `_newVoiceWait`, `_newVoiceSpends`, `_stamped`, `_feedLine`,
  `_feedFlush`, `_banFrame`, `_lawInternal`, `_takeOrder`, `_banClose`, `_bannedHello`, `_loadBans`, `_saveBans`, and the
  Worker's `lawDoor` (`lawKindOf`, `lawSeen`, `bodyCapped`); its `ACCOUNTS` binding in `server/wrangler.toml`.
- The service: `server-account/src/safety.js` (and the moderators' `modCases`, `modCase`, `modDismiss`),
  `server-account/src/sanctions.js`, `server-account/src/modAi.js`, `server-account/src/discord.js`,
  `server-account/src/safetyClock.js`, `letters.js`'s block, migration `0126_chat_safety.sql`; its `RELAY` binding in
  `server-account/wrangler.toml`.
- The client: `src/scenes/chatSafetyHost.js` (what `bootWorld` wires), `src/ui/conductCard.js`, the line menu in
  `src/ui/chatPanel.js`, `src/net/chat.js`, `src/net/social.js`, `src/net/online.js`, `src/net/accountClient.js`.
- The pins: `test/net/safety/safe_law.test.js`, `test/net/safety/safe_relay.test.js`,
  `test/net/safety/safe_relay_audit.test.js`, `test/net/safety/safe_client.test.js`, `test/server/safe_service.test.js`,
  `test/server/safe_review.test.js`, `test/server/safe_audit.test.js`, and the mutants in `tools/mutants/safe.json`,
  `safe_audit_relay.json`, `safe_audit_service.json` and `safe_audit_client.json`.
