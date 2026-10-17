# AUDIT TIMERS1 - the hourglass, read before it ships (2026-10-02)

Mac: *"Audit this"*, of TIMERS1 (`092cdccce`, `10-UI/UI-Arc.md` TIMERS1 - the hourglass beside the profile mark on the
pause face and its window of every shared moment). Two lenses, each reproducing with the repo's own code:

- **D** the data and the clocks - every row against the law it claims, in node over the real modules, with the
  service's own shapes (`server-account/src`);
- **UI** the window - the real `mountEnhancedMenu` in pause mode in Chromium with a fixture source, at 1280x800,
  390x844, 844x390 and 667x375, the keyboard, a pad's bumpers, a rotation, every Plus theme.

Every finding was checked before it was fixed; pins in `test/ui/enhanced/timers1.test.js` (each `AUDIT TIMERS1 <ID>`), and each fix
carries the same comment.

## Fixed

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D1 | high | Every battle row read "[object Object] against [object Object]": the service sends each side as the guild record (`{ id, name, tag, heraldry }`, `seatInfluence.js` `battlesOf`), and the pin fed strings. A revolt (`guild: null`) named no one. | Each side in the seat tab's words (`guildWords`: "Silver Hand <SH> against the Ebon Oath <EO>"); a revolt "Against" the holder. The pin feeds the service's shape. |
| D2 | med | A crown's battle over but still `scheduled` (it stays so until the Turning) skipped its Royal Tourney row - a `continue` in the battle branch - from Saturday night to the Turning. | The ended battle is skipped alone. |
| D3 | med | The whole day's raids were listed - about twenty-two across the Iliac Bay, twenty-seven rows at a day's start. | The player's own region's raids whole; every other region's as ONE row: the soonest to matter, and how many more. |
| D4 | med | "New game day" counted to the EVENT clock's day (two real hours: the bounty board, the raids), but since TIME1 the calendar the player reads turns every real hour - the row named a day that was not the HUD's. | Said as what turns: "New bounty hunts and raids". |
| D5 | med | The Reckoning and the Turning were shown to every player, and the seats are open to dev accounts alone (`SEATS_OPEN`) - "Seats change hands" for a feature closed to them. | The seat week's rows only where the service says the seats are open (`seatBook.open`); the daily row names the Watch only there. |
| D6 | med | The pause door is armed before the boot's last awaits, and `timersSource` read `online` (and the gate's two) before their declarations ran: a pause in that window threw inside the menu's render. | The source answers null until what it reads stands. |
| D7 | low | The window's countdown rounded down where the gate's banner rounds up - "4:07" beside "4:08". | Rounded up, as `countdownText`. |
| D8 | low | Until the relay's clock was heard the offset was nought and every row counted on this machine's clock. | No source (no hourglass) until the clock is heard. |
| D9 | low | A moment past the week read "Sun 18:00" - a Season's end sixteen days out did not say which Sunday. | "Sun 18 Oct 18:00" beyond six days. |
| D10 | low | The Turning's "writs reset" (only the Officers' writ budget is weekly) and the daily row's list (the Marks and hides caps missing, the Watch a seats-only cap). | Both said as they are. |
| UI-1 | med | On a phone and a short screen the timers stage took the pause stage's padding and flex-start (one class, later in the sheet): the window off-centre, its right frame clipped at 390px, pinned left in landscape. | Two classes, its own padding and centring, a short screen's own height. Measured centred at all four sizes. |
| UI-2 | med | On a landscape phone the hourglass (and, before it, the profile mark) stood over the pause window's tabs: a tap on SYSTEM's top half opened the timers. | On a short screen the pause window stands under the 56px marks and the hourglass's word goes. Measured: no mark over a tab at any size. |
| UI-3 | med-low | The hourglass was placed once: turned from portrait to landscape it stood on the profile's caption (the pause face re-renders on no resize), and a caption that changed width (the web font, a sign-in) moved under it. | Placed again whenever the profile, the face or the window changes size and when the fonts land (`anchorBeside`); disconnected with the face. Measured: 10px apart after a rotation. |
| UI-4 | med (Stone) | On the Stone theme the window takes the light panel and its dim words read 2.6:1, the where line 3.0, the section heads 2.6. | Lifted past 4.5:1 over a hard black drop (AUDIT MERGE-PLUS D3's law), pinned by contrast. |
| UI-5 | low-med | The focus stayed on the hourglass under the scrim; Tab walked out under the window, Enter on the pause face's Resume resumed, Shift+Tab opened the profile window over it; closing dropped the focus to the body. | The focus goes to Close; the pause face, the profile mark and the hourglass are `inert` while the window stands; closing hands the focus back to the hourglass. Measured. |
| UI-6 | low | No dialog semantics. | `role="dialog"`, `aria-modal`, named by its title; the hourglass `aria-haspopup`/`aria-expanded`. |
| UI-7 | low | A pad's bumpers turned the pause window's tabs under the open window. | `plusPad`'s tab strips skip an `[inert]` subtree. |
| UI-8 | low | "Nothing is scheduled." could only mean the source was gone - the days and the gate always stand while there is a clock. | "The world's clock cannot be read right now." |
| UI-9 | low | The pause face's test for the hourglass built the whole source and asked the service for the seats list on every pause. | Only the window's own read asks (`{ ask: true }`). |
| UI-10 | low | A window taken out of the page without its stop kept ticking (no live path found). | The tick stops itself on a disconnected window. |
| UI-11 | low | `timersOpen` with no window drawn spent an Escape closing nothing. | The back stack closes a DRAWN window. |

## Left, recorded

- The Royal Tourney's row follows the list's edict, which the service reports only while its guild holds the seat
  (D11); the ruling stands through the week. The hourly renown cap, the Tides as their own row and Season 0's start are
  not rows (D10's missing three); the Tides ride the Turning's line.
- The account window shares UI-5's focus and inert gaps (it predates TIMERS1).
