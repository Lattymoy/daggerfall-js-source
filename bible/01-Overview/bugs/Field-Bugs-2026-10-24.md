# FIELD BUGS 2026-10-24 - four Discord threads

Four threads from the Discord, handed over by the owner as phone screenshots: one from #feature-feedback, three from
#bug-reports. Read on main's `f58525b0a`, each by a cold reader of its own beside this one. The pins are named under each
fix, the mutants `tools/mutants/fb1024.json` (39, all dead), and six records of other slices re-aimed by content (egeco_pay's three, serpentset, wb9g, audit_wb9).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | #bug-reports, "Potential Bug: Regens Health: In Darkness": "`src/scenes/hostEnchant.js` defines inSunlight and inHolyPlace in createEnchantCtx(), but apparently never provides inDarkness ... the enchantment may never activate, even at night or inside dungeons" | Proven as written. RegensHealth's InDarkness arm asks `ctx.inDarkness`, and the one enchant ctx every host mounts never carried it, so the arm read `false` everywhere. No pin had ever run that arm - E1's fed the InSunlight arm a hand-built ctx | DARK-REGEN |
| 2 | #bug-reports, "Issue with deadlands ember count": "I tried to purchase my first battlemage piece ... the transaction never went through, the embers were not taken out and I didn't get the piece ... I was however locked out for the week ... I now have 52 deadlands embers on me, and it will not let me buy the aura, it says I have too few" | Proven mechanism, one cause for both halves. A sale is two ledgers, the pack's embers and the account's purse. A Panoply sale whose answer was lost, and whose question after went unheard too, gave the pack its embers back while the service had written the sale: the week's piece taken, the purse charged 20. The pack then held 20 the account would never spend, so the 50-ember aura was refused on the purse while the pack said 52 | EMBERS-OWED, then BROKER-RID (AUDIT FB1024) |
| 3 | #bug-reports, "Audio cutting out. During boss fights, or menu music." (Solved there: "If you have SteelSeries headphones try disabling steelseriesGG app ... there is still audio cutting out from time to time") | Not reproduced - no headset's driver chain here. Two mechanisms read in code: the menu theme's own context asked for the smallest buffer ('interactive') while it renders ~385 voices at peak (INTRO3b/c, four times INTRO3's); and the music scheduler's 0.25 s lookahead leaves the song silent through any main-thread stall past about half a second (`songPlayer.js` AUDIT 19 F8's skip) | THEME-BUFFER; the rest asked of the owner |
| 4 | #feature-feedback, "Inability to mix unarmed with 1H dual wielding": "you cannot mix a one handed weapon with punching, this seems like an oversight? OR maybe an issue with offhand casting?" | Not offhand casting (SPELL-HAND came a week after). TWO-HANDS' modes (`05-Combat/Two-Hands.md`) are Fists (both hands empty), Dual (two eligible weapons) and Single (anything else) - a weapon and an empty hand were never asked about, so the pair falls to Single by default, not by a decision | asked of the owner |

## DARK-REGEN (1) - `src/scenes/hostEnchant.js`, `src/systems/passiveSpecials.js`

DFU: RegensHealth.cs:97-98 regenerates on `Params.InDarkness` (2) when `PlayerEnterExit.IsPlayerInDarkness`, which is
`!isPlayerInSunlight` (PlayerEnterExit.cs:201, "Same as !IsPlayerInSunlight"). No departure, no Ledger row owed.

THE CHANGE. `playerInDarkness` (`passiveSpecials.js:"export const playerInDarkness = (nowMinutes = null) =>"`) is
`!playerInSunlight` over the same host seam, and the shared ctx answers it
(`hostEnchant.js:"inDarkness: () => playerInDarkness(),"`). The enchantment's darkness is DFU's: a roof at noon is
dark. The career's Regenerate Health: In Darkness keeps its own law (`!day || dungeon`, PassiveSpecialsEffect.cs), as
DFU has the two. Both heal, so a class with the advantage and a ring stack, as the report expected.

THE FOUR HOSTS: the ctx is `createEnchantCtx`'s, which `world.js` (and through it `worldModes.js`'s interiors),
`exterior.js` and the standalone `dungeonContext.js` all mount; the seam it reads is registered by the mode machine
(`worldModes.js`, which `world.js` and `exterior.js` build) and by `dungeonContext.js` for its own. The Ketch's open
decks and the arena floor stand on the dungeon's, which answers "inside" - AUDIT FB1024 #19, put to the owner. With no
seam registered and no clock handed in the arm idles (AUDIT FB1024 #18).

PINS: `test/systems/fb1024_darkregen.test.js` builds the ctx from the producer (TEST THE SHAPE THE PRODUCER MINTS) and
runs the real ring through the round pump - at midnight, under a roof at noon, and on the noon street; mutants DARK1-DARK2.

## EMBERS-OWED and BROKER-RID (2) - `src/systems/sigil/sigilBroker.js`, `server-account/src/brokerSales.js`

No DFU member: the Broker, her insignia and the Panoply sink are the port's own (`11-Multiplayer/World-Bosses.md` WB9g,
`11-Multiplayer/Elite-Gates.md` section 19).

WHAT HAPPENED. `panoplySale` (and `insigniaSale`, its pattern) takes the pack's embers first, then asks the service
(`egSink`, one batch: the purse charged and the week's `eg_sink` row written). A lost answer (`insigniaUnheard`: no
answer, or a 5xx - `egSink` asks the purse again AFTER its batch commits, so a failure there answers 500 on a sale
already written) was asked after through `/v1/eg/keys`. "Not held" and "not heard either" were one branch: the embers
back. With the service down for both calls, the service kept the sale and the pack got its 20 back - the player's
"locked out for the week" (the next press is `bought`) and, the purse 20 under the pack, the aura's `short`
(`accounts.js buyInsignia` checks `EMBERS_EARNED_SQL - insignia_spent`, never the pack).

EMBERS-OWED, the slice as it first shipped (7a4dfccef), owed such a sale and settled it at the Broker's next open by
asking what the account held: an insignia owned, or a Panoply sale of the same piece in the same week (one either side
for the week's edge and a device clock). AUDIT FB1024 (below) broke that: a question about what the account holds
cannot tell THIS press from another sale. So the slice as the audit left it is BROKER-RID:

- A PRESS CARRIES A REQUEST ID (`rid`, `net/insignia.js` BROKER_RID_RE and mintBrokerRid). `egSink` and `buyInsignia`
  write it beside the sale, in the sale's own batch and only where the sale's write took (`broker_sales`, migration
  0174; `brokerSales.js` brokerSaleWrite and brokerRidFreeSql). The same press asked again answers its sale (`again`); a
  press without an id (a client before this one) sells as it always did.
- A LOST ANSWER IS ASKED AFTER BY THAT ID (`/v1/broker/settle { rid, nonce }`, settleBrokerSale). The row the id wrote
  answers `held`, its kind and item, and its FIRST ask's nonce (`by`); an id with no row is FENCED in the same batch - a
  `fence` row stands in its place, so the press, landing late, writes nothing (`fenced`). The settle of an insignia
  carries the account's wardrobe.
- Unheard too, the sale is OWED (`oweSale`): its embers stay out of the pack, `{ kind, id, embers, rid, account }` rides
  the save (`SigilBrokerOwed`; `validOwed` holds each row to its sale's own price, one a request id), and the Broker
  says so (`broker.owed`, in the twenty languages that carry the account's words). Signed out, there is no account to ask
  under: the press is refused as the door refused it. At most `OWED_MAX` (8); past it a press is refused before anything
  is taken.
- Her window's two loads settle what is owed first (`brokerOwedDoor`'s `settled`,
  `world.js:"const brokerOwed = brokerOwedDoor(playerEntity, saveSoon, panoplyPieceById, insigniaIo, settleBrokerSale);"`),
  under the account that made each sale alone, one ask a sale at once, into the pack as it stands when the answer comes
  (a save loaded meanwhile is the pack that is owed). Fenced, the embers back. A Panoply sale held, the piece - when this
  page's ask was the first (`by`, this ask or one of this page's whose answer was lost); a save loaded again after it
  was settled asks again and is told the piece was handed out. An insignia held is the account's.
- `ACCOUNT_VERSION` acct190 (the law moved; AUDIT FB1024 lane C L1 - the slice had not moved it; acct182 on its
  branch, renumbered past main's acct182-acct189 at the merges, and its migration 0167 to 0174).

LEFT, AND SAID. A settle whose answer is lost and whose page then closes before the next settle leaves that piece
handed to an ask no page remembers: the sale stands on the account and the pack has paid, but no piece comes. Two lost
answers in a row and a closed page; the price of never minting a piece twice from a saved game.

THE FOUR HOSTS: the Broker's window stands in the streamed world alone (`world.js` openBroker); `exterior.js`,
`worldModes.js` and `dungeonContext.js` open no Broker.

NOT DONE HERE. The player in the report: no owed row exists for a sale made before this change, so their account stays
20 under their pack until an operator puts the 20 back (`UPDATE players SET insignia_spent = insignia_spent - 20 WHERE
id = ?`, after reading their `eg_sink` row for that week). And the refusal does not yet say the account's own count
("Your account can pay 32 of 50") - the service answers `purse` with `short`, and the client's refusal drops it; that
is a new string in every language, left for its own slice.

PINS: `test/systems/fb1024_embersowed.test.js` - the report's case over the real Worker, the voucher closed, the fence
(the lane C repro: three presses that never landed after an honest sale), the week turning, the account's own, signed
out, the insignia, the page's races, the save; `test/server/fb1024_brokersales.test.js` - the service's law;
`egeco_broker`, `wb9g_insignia` and `auditscale2_acct` moved to settle-by-id. Mutants `tools/mutants/fb1024.json`, RID1-RID5.

## THEME-BUFFER (3) - `src/systems/introTheme.js`

The menu theme plays on its own AudioContext (`introTheme.js` makeContext), which nothing interactive shares - the
clicks and the game's sounds are the game context's (`audio.js`). It asked for `latencyHint: 'interactive'`, the
smallest buffer the device gives, with no recorded reason, while INTRO3b/c made it the heaviest score in the game (a
cold read rendered it offline: 385 voices at peak, 204 on average, against 98 and 41 at INTRO3). A small buffer is the
first to under-run when the audio thread is slow, and a headset suite that processes the stream (SteelSeries Sonar)
takes from the same deadline. It asks for `'playback'` now. The film's clock is `audibleContextTime`, which reads the
device's output timestamp (or subtracts the output latency), so the longer latency moves no frame against the score.

AT THE MERGE OF MAIN (2026-10-25): main's INTRO-REVERT (the owner: "Can we revert the intro music to the original before
we changed it") puts the film and the menu back on INTRO2's one decoded recording, so the 385-voice score is no longer
what the menu plays - the heavier cause read here is gone on its own. The playback buffer stays: the menu's context still
plays the theme alone, and the headset's chain takes from the same deadline whatever it plays.

NOT DONE HERE, put to the owner: the game context keeps the default `'interactive'` (a larger buffer delays every
blow's sound); the music scheduler's lookahead stays 0.25 s (a longer one rides out a stall but keeps that much more of
every voice's chain alive on the audio thread). Asked of the reporter: browser or desktop app, and whether the sounds cut with the music or the music
alone - the music alone is the scheduler's stall, both together the audio thread's.

PINS: `test/systems/fb1024_themebuffer.test.js`; mutants BUF1 (2, dead).

## (4) - a weapon and a fist

TWO-HANDS (`05-Combat/Two-Hands.md`; `combat/twoHands/handsLaw.js` handsModeOf) has three modes: Fists when both
hands are empty, Dual for two eligible weapons, Single for anything else, and Single strikes with the lead hand
alone. The owner's ask that made it named bare fists and two weapons; a weapon and an empty hand were never raised, and
no record says why not. DFU has no second hand at all (WeaponManager.cs ToggleHand swaps the one in use). So the
player's reading is right: an oversight, not a rule. It is a design question - whether the pair alternates, whether it
is on by default (the off hand's punch is HandToHand's skill/5+1, weaker than most weapons at low skill, so an
always-on pair would cost most characters damage), and how a readied spell's claim on the free hand (SPELL-HAND) wins -
so it is the owner's, asked with this record, and nothing changed.

## AUDIT FB1024 (2026-10-25) - the slice, read cold

The owner: "Audit this". Four lanes, each a cold reader of the frozen snapshot (`7a4dfccef`) in its own worktree - the
repository untouched while they read (DO NOT FIX WHILE THE VERIFIER IS READING) - each told to prove a finding by a repro
over the real code before reporting it: A the darkness and the theme's buffer (DFU's law fetched, every mode's seam, the
intro film in Chromium), B the owed-sale law on the client, C the service, the host and the window (the real Worker over
`standService`), D the record, the pins (its own mutants beside the slice's), the translations and the process. Every
finding below was reproduced by its lane's own script before it was acted on.

The lanes broke the owed-sale law's one idea: a sale was asked after by what the account held - the week and the piece -
and that cannot tell this press from another sale. B and C each found the week turning between a sale and its question
(the report's bug again), C an honest sale answering for presses that never landed (four pieces for one sale, over the
real Worker), B a saved game minting the piece at every load. Patching the week rules would have kept the idea; the
slice was rebuilt on the request id instead (BROKER-RID, above).

| # | Lane | Sev | Finding | Disposition |
|---|---|---|---|---|
| 1 | C H1 | HIGH | A press the service never saw, owed under the device clock's week (the window's load had failed), matched an honest sale a week before: a Panoply piece at every reopen, the week's sale still open; an insignia already owned, pressed while the load had failed, lost its stones | FIXED: settled by its request id - an id with no row is fenced and the embers come back. Pinned (THE FENCE: three presses after an honest sale, one piece) |
| 2 | B1, C M2 | HIGH | The week turning between the buy and its question: `sinkHolds` read this week's sale alone, and the refund was blind again - the report's own case | FIXED: no week is asked. Pinned (the last second of a week, settled the next) |
| 3 | B4 | MED | A save holding an owed sale, loaded again, minted the piece at every load | FIXED: the settle answers its FIRST ask (`by`); a piece goes to that ask alone. Pinned (THE VOUCHER CLOSED) |
| 4 | B2 | MED | A buy that timed out and landed after its question said "no sale": the embers back and the account charged | FIXED: the question fences the id; the press, landing late, writes nothing. Pinned (the late press `fenced`, nothing spent) |
| 5 | B3 | MED | A save loaded while a settle was asked: the embers went into the discarded pack, the restored row struck | FIXED: the answer lands in the pack and the list as they stand when it comes. Pinned (THE PAGE'S OWN RACES) |
| 6 | B11, C M3 | MED | An owed row carried no account: another signed in settled it against its own | FIXED: the row keeps its account, and only that account asks (AUDIT 28 M2's law for the Bank's kept sale). Pinned |
| 7 | C M1 | MED | A Panoply press signed out (`no-session`, no status) was owed - "unheard" - and could never settle | FIXED: `no-session` is a refusal (the door sent nothing); a press with no account to ask under is refused. Pinned |
| 8 | C L1 | LOW | `ACCOUNT_VERSION` did not move with the Worker's law, so the deploy's gate could not tell this Worker from the last | FIXED: acct182, its pins and records moved by content |
| 9 | B5, B6, C L2 | LOW | A device clock more than a week off; another character's sale of the same piece; a week left stale by a failed load | GONE with the week rules |
| 10 | B12 | NOTE | A hand-edited save's owed row could hold 1,000 embers | FIXED: each row is held to its sale's own price, one a request id. Pinned |
| 11 | C note | NOTE | While a sale was owed, any Panoply press (or the same insignia's) was refused locally even with the service up | GONE: the repeat guards are dropped - with the fence a second press is safe (the service answers `bought` or `owned` where the first landed, and gives nothing twice) |
| 12 | D M1, D M2 | MED | The door's insignia half and `sinkHolds`' piece check had no pin (mutants survived) | The insignia half pinned over the real Worker (and mutant RID5); `sinkHolds` is gone |
| 13 | D M3 | MED | World-Bosses.md kept "gives them back unless the service holds the sale" with the exception in a parenthesis - the sentence said both | FIXED: rewritten |
| 14 | D M4, D L5 | MED/LOW | `broker.owed` in Czech said "the accounting service"; Polish and Romanian used other words than their catalogs' for the account service | FIXED: "Služba účtů", "serwera kont" (and "zatrzymany"), "serviciul de conturi" |
| 15 | D L6 | LOW | Two claims false as written: "the E1 pin fed the arm a hand-built ctx" (it fed the InSunlight arm; no pin ever ran InDarkness), and `broker.owed` "in every language" (20 of 25 - tr, uk, vi and both Chinese carry none of the account's rows) | FIXED in the record and the test's header |
| 16 | D L7 | LOW | Edge mutants survived: the week windows' outer edges, the insignia's cap, the newest rows kept, the 1,000 bound | The weeks are gone; the insignia's cap, the newest kept and the price pinned (RID1, RID3) |
| 17 | D L8 | LOW | Port-Ledger's struck ENCHANTING row lists the closed ctx seams as inSunlight/inHolyPlace/moonPhase - false by omission until this slice | FIXED: inDarkness (FB1024) named there |
| 18 | A N1 | NOTE | With no passive-specials host registered, darkness answered ON (the unregistered clock reads midnight), not idle as the seam's every arm is | FIXED: idle without a host or a clock handed in. Pinned (DARK2) |
| 19 | A L1 | LOW | The Ketch's open decks and the arena floor stand on the dungeon host, whose seam answers "inside": dark at noon - for In Darkness now, and before it for In Sunlight, a sun-damaged career and the vampire's day | LEFT, put to the owner: it predates this slice, and opening those skies changes the sun's law in the raids |
| 20 | A N2 | NOTE | THEME-BUFFER's benefit is not proven on the reporter's device (headless Chromium: 'playback' gives 2.3 times 'interactive''s buffer; the film's sync held) | SAID - the report is not reproducible here |
| 21 | D note | NOTE | The record's loose words: "the seam it reads is registered by each" (worldModes registers it for world.js and exterior.js, dungeonContext its own); the DARK-REGEN pins paragraph named no mutants | FIXED |

FINE, PROVEN by the lanes: DFU's darkness (PlayerEnterExit.cs:201, :371 - no weather term, dungeons inside, the day 6 to 18); every mode's seam and its hand-back on a dungeon's destroy; `createEnchantCtx` the only enchant ctx; the career and the ring stacking, both barred in the Burning Court; nothing interactive on the theme's context, the film's audible clock monotone under the longer latency; `egSinkOf`'s query on its primary key; the deploy bundling what the Worker imports; no TDZ in the host's door; two settles at once handing one piece.

THE SUITE AFTER THE FIXES. Two things the suite asked of the rebuilt slice: every refusal word the service can say has a
sentence (ACC1e) - `fenced` now does, in the twenty languages that carry the account's words, though no client of this
build sees it (a press's id is never sent twice); and `test/net/gate/wb12d_rite_law.test.js`'s own D1 stand-in answered a
batch with its writes' counts alone, where D1 answers each statement's rows - `egSink` already read an UPDATE's RETURNING
out of a batch, and the insignia's sale does now, so the stand-in answers as D1 does.

NOT THIS SLICE'S. `test/server/founder5.test.js` (FOUNDER5 the live link, a cloud save) failed on the frozen snapshot and on
main's code alike on 2026-10-25: an account registered "today" in the fixture was stamped with today's first play
(1792886400 is 2026-10-25 00:00 UTC). A clock in a fixture, not this change - main's own FOUNDER5 (`4c548132f`, then FOUNDER5-CLOCK `2fa176f6c`) fixed it,
and it passes on the merged tree.

