# AUDIT ONESEAT - ONE-SEAT read before it merges, 2026-09-27

Mac: *"Audit this"* - ONE-SEAT (`27c52c1f`, one tab of a player online at a time; its record is
`06-Systems/Online-Arc.md` ONE-SEAT). Main had not moved since the last merge (`2fae2aa4`, PR 406). Four reviewer
lenses read the commit - the relay; the session and the browser's lock; the host and the button; the pins, the mutants
and the record - each reproducing what it reported (the relay's over the real Room, the session's end to end through
the real Room, the lock's in Chromium and over Node's own BroadcastChannel, the host's with world.js's own seat code
lifted and run). Every finding below was verified by its reproduction before it was fixed. The relay lens's
reproductions were run again on the fixed tree (R1 and R4 hold; R3 still reproduces, and is recorded); the host
lens's harnesses lift the old lines, and the suite now runs the fixed ones itself (T1).

## Fixed

**The relay** (`server/src/index.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| R1 | med | A claim that closed the hub's lone other socket left `others` empty, and the empty-room sweep deleted EVERY party in the hub (SOC1: "the parties go with the drain") - the player's own, with a friend who had stepped away, and any stranger's whose members were away. The hub never drained: a seat moved. A lone player's blip-reconnect over its own socket did the same (older than ONE-SEAT, the same root). | A seat that moved is carried (`replaced`, or a claim that closed a tab): the hello's sweep runs only for a room that really emptied. A drained hub still sweeps. |
| R4 | low | `_otherTabsOf` counted a socket the object had closed. Under AUDIT WORLD34 D1's reading the runtime drops it at once; if it lists a closing socket until the close completes, the tab that just claimed found the tab it closed still "holding", and its own blip-reconnect was refused. | A socket the object closed (`_dead`) or whose leave was said (`_gone`) holds no seat. |
| T7 | low | The comment said the claim came "once this hello has passed every refusal of its own"; two refusals come after it (an attachment too large; a welcome that cannot be sent), and the order was unpinned. | Said as it is; pinned - a claim refused 'id taken' closes nobody. |

**The session and the browser's lock** (`net/online.js`, `net/oneSeat.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| C1 | med | A claim was spent only by the hub's welcome, so a first hello that never got there (no network, a lid shut, a mint that timed out) claimed on every retry however late - and took the seat from the tab the player opened AFTER it (a laptop's retry at 668 s closed the desk that went online at 60 s). | A claim is the player's act at a moment: `claim` speaks for `CLAIM_TTL_MS` (20 s), then the hello is a reconnect - refused while another tab holds, the way back being the button. |
| C4 | low | The lock had no order: two tabs that claimed before either heard the other both gave the seat up - no tab online, both saying "you went online in another tab" (7/40 in Chromium at 0.2 ms apart; 20/20 for two simultaneous presses of Play online here). The suite's fake channel delivered inside `postMessage` and hid it (T5). | Every claim is stamped after every claim the tab has heard; a holder gives way only to a NEWER claim (ties by the page's nonce) and answers an older one with its own - which a tab whose channel opened after the holder's claim never heard. Pinned over the runtime's own BroadcastChannel. |
| H2 | med | `resume()` wrote `status 'closed'` over a live socket: every send refused, and `join()` saw its room with a socket and returned. | Only a superseded session resumes; a live one keeps its socket, its status and its sends. |

**The host and the button** (`scenes/world.js`, `ui/chatPanel.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| H2 | med | `leaveSeat` said the room's last word (`worldPublish` - collectWorld, AUDIT ONCRASH1 A7's own failure) BEFORE any supersede, and marked itself left first: a throw there left every session live - the hub's heartbeat, the presence socket still the room's host - under a tab that said "offline", no frame asked again, and Play online here then wedged them (above). | The handover and the last word are contained, as pagehide's are; the supersedes, the lock and the rest always run. |
| H1 | med | Play online here swallowed only `click`: its press reached the window's mousedown as Mouse0 (ActivateCenterObject) - the readied spell cast on the press, and whatever stood at the centre (a door, a townsperson, a shelf, a corpse) used on the release. The natural flow: a player coming back to the tab clicks it. | The panel's press rule, as the Chat, Show and Social buttons carry it: `pointerdown`, `mousedown`, `click`, `touchstart` stop at the button. |
| H3 | med | Out of the seat no Renown was earned (`earning`), but the kill and quest doors' other half - the sigil's drink - was not asked, and the sigil's "online" was the page's flag: the sigil in hand drank every point, and every corpse or pile the tab won rolled sigils, both saved with the item. A second tab could grind indefinitely. The Renown layer's health and magicka stayed on too. | Out of the seat the tab is offline: the sigils sleep (`setSigilOnline(false)`), the layer is off; a Renown rise heard while out waits; Play online here puts both back. |
| H4 | med | The online exit save keyed on the session object, which an out tab still holds: closing the old tab ("this one is offline") wrote its older state into every slot of the character, over what the tab with the seat had saved - lost for good if that tab never saved again (a phone's page gets no beforeunload). | The exit save asks the seat: an out tab is offline, and writes nothing. |
| H5 | low | The others' camps (SURV3) and the cells' kept teams (HCC-PARK) are pruned by the frame's tail, which an out tab never reaches: they stood the whole time out, and a peer's camp still offered its rest. | Swept as the seat is left. |
| H6 | low | A live duel was not ended: `duelFrame` kept the player's body clamped in the ring for DUEL_GONE_MS, and the opponent waited as long. | Ended as `left` while the socket stands (the opponent told now), and its heal run - as the page's exit does. |
| C5 | low | Only the World link and the presence session told the host of a 4000: a Region link's (this tab's id taken in its channel) left it shut for the page's life, with no Play online here to open it. | Every link's close is the seat's. |
| C3 | low | The lock was claimed at online start even by a tab with no relay it could reach (a hand-set address that is none) - the other tab of the browser went offline for a tab that never could be online. | A tab with no relay takes no one's seat. (The rest of C3 is recorded below.) |

**The pins** (`test/oneseat.test.js`, `tools/mutants/`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| T1 | high | The host's seat code was pinned by its text alone: six natural mutants survived every related file - Play online here reading the link's room (null after the supersede, so the hub's link resumed without its claim and joined nothing), the last word guarded off or commented out (`indexOf` cannot tell), the puppets kept, the riders kept, and `supersede()` not terminal (a tab out of the seat walked through a gate's door). | `seatOut`, `renownAdopt`, `leaveSeat`, `seatLostNow`, `takeSeat` and the frame's seat branch are lifted VERBATIM from world.js and run over stubs that write down, in order, what they are asked; the exit save is run the same way; `supersede()` is pinned terminal. |
| T2 | med | `test/auditwbx.test.js`: ONE-SEAT's re-aim put a comment in front of `await hub.hello(h6, ...)`, so h6 never said hello and "a fighter in the court: its floor gives it" asked a socket that could not be handed anything (AUDWBX-S4's court mutant survived that file alone). | The hello is a statement again; that file kills the mutant on its own. |
| T3 | med | AUDWBX-S4-every-tab-handed-it was recorded equivalent, but its `new` also dropped WBX2 M3's spent-receipt test - not equivalent (auditwbx2.test.js kills it). | Re-aimed to change every-tab-for-newest alone; it survives the three gate files, as its `why` says. |
| T6 | low | "Not taken by Hide" was one CSS slice: the button put in the box (shut unless the chat is open), hidden in the render, or hidden by a rule after the slice all survived. | The button is pinned on the root under the status line, drawn while the chat is hidden, and named by no Hide rule anywhere. |

## Recorded, not fixed

- **R3 (low) - a stale tab in the holder's reconnect gap takes the seat.** The non-claim refusal holds only while the
  holder's hub socket is in the room. An older build's tab (it never claims, and its World link asks again every
  CHAT_REJOIN_MS) or a new tab that missed its 4000 while frozen, landing in the holder's gap (a blip, a relay deploy
  that drops everyone at once), is admitted - and the holder's own reconnect is then refused: the tab the player is
  using says "online in another tab" and one press takes the seat back. A stored seat per account would close it, but
  a deploy says no leaves (so the gap it most needs has no record to read) and the record needs its own sweep; the
  stale tabs that can reach it are frozen pages and builds from before this slice.
- **C3 (low, the older half) - a new tab's presence refused as final waits for a room change.** A presence hello
  refused as terminal (a mint that timed out, so 'sign in to play online') is not retried until the room changes - as
  before ONE-SEAT - and now the old tab has already gone. The new tab's line says why; a crossing or a reload recovers.
- **C6 (low) - a duplicated tab without BroadcastChannel.** A duplicate carries its original's peer id; if the
  original's hub socket is down when the duplicate claims, the original's reconnect replaces the duplicate's socket by
  the same-id rule. Every current browser has the channel (whose nonce is the page's), and the desktop shell is one
  window.
- **Older builds (R2/T4 - the docs corrected).** A build before this slice does not honour the hub's close: a newer
  tab's claim shuts its World link and nothing else, so it plays on in its place room and its Region channel until it
  is reloaded, and its World link asks again every 30 s (a hello and a token each time). wire.js and the Online-Arc
  said a second old-build tab was "refused (4000, which that build already reads as terminal)"; they say this now.

## The record

- world119 was still unshipped when the audit ran (main was world118): R1 and R4 ride the same deploy, its LAW hash
  re-recorded. Main's PR 407 then took world119 (AUDIT SET) and PR 408 world120 (PARTY-BUFFS + REST-OPT), and the merges renumbered
  this branch's relay world121. The merge drops every connected player once.
- `test/oneseat.test.js`: 11 -> 22. `tools/mutants/oneseat.json`: 33 -> 66 (68 at the merge with PR 407), all dead - 33 new, and 7 re-aimed at lines
  the audit changed (the seat's subject line, the lock's claim and hold, the handover's indent, every link's close).
- `test/auditwbx.test.js` (T2) and `tools/mutants/auditwbx.json` (T3): 28 dead, 1 recorded equivalent.
- Re-aimed for the fixes: `test/disc19.test.js` finds the exit save by its guard, which asks the seat now (H4) under
  a comment; H6's line is worded apart from AUDIT DUEL1 D5's exit line, so each mutant names one site; the three
  records of other lists beside the audit's edits (auditduel1 D5, event1, sigil1) were run again and still die.
- Social-Party-Arc's ONE-SEAT note said a friend's `peers` and B9's newest tab "now meet one tab of a player in the
  hub"; both are keyed by the browser-profile account, and two players signed in within one browser meet the
  client's BroadcastChannel alone (T7). Said so.
- A pre-existing flake seen by the pins lens, not ONE-SEAT's: `test/chat1.test.js`'s channel storm (on the real clock)
  failed 4 of 8 runs under 8-way load; a `--jobs` run of a list naming it can report a false kill.
- The commit message of `27c52c1f` called AUDWBX-S4 equivalent as written and said old builds read the 4000 as
  terminal; recorded here - a pushed message is not rewritten.
