# AUDIT PRE-MERGE 0927b - FIELD 2026-09-27 (the phone, the backup, the drains) read before it merges, 2026-09-27

Mac: *"Audit before we merge"*. The branch carried one commit past main (`08db3b3c`, committed as FIELD 2026-09-27c:
CHARGEN-PHONE, BACKUP-NEWER, BALANCE1; its page is `Field-Bugs-2026-09-27-phone-backup-drains.md` - see the record). Main (15 commits, to `e8774228` - PR 402, the Enhanced Lighting lane and GATE-RELOAD) was
merged first (`f891104a`): one conflict, the Testing suite line; no relay, wire or account change on either side;
main adds no fatigue or wear path. Main moved twice more while the audit ran, and both were merged at the end:
PR 403 (RISE-STUCK and REST-ROUNDS) - Active-Arcs' entries, one pair of drift cites both sides had moved (checked
against the base's text), and one name both sides had written (see the record); and PR 404 (MW-TEXTHREAD, SLOTS2,
the house, gold, travel and party slices, DUNGEON-SEAMS) - seven cites both sides had moved, mapped by citeMerge
from main's side and each checked against main's text, and the suite line. Neither brings a relay, wire or account
change, or a fatigue or wear path; SLOTS2's newest-save walk leaves the store calls a restore makes as they were. Four reviewer lenses read the commit - the backup restore, the balance scales, the
phone layout, and the pins and the record - each reproducing what it reported (the backup lens drove the real menu in
Chromium against the real account Worker); every finding below was verified before it was fixed, and the backup
lens re-ran its eight repros against the fixed tree: every loss it had shown was gone.

## Fixed

**BACKUP-NEWER** (`systems/cloudSaves.js`, `ui/enhancedMenu.js`, `ui/saveTile.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| B1 | high | A restore that FAILED (a dropped connection, a full store) left the tile on its refusal line, whose one button - *Try again* - was a push: one press put the PC's older save over the Mac's newer backup, the very loss the restore exists to prevent. | The refusal remembers its act; *Try again* is that act - a restore again (on Load, while still newer), a delete again, and a push over a newer backup asks twice. |
| B2 | med | The restore decided and labelled by the card on screen, while the blob it fetched was the service's current one: another device's push between the listing and the press had the older copy removed for a save that was not the newer one, filed under the card's minute. | A restore checks the arriving blob's own minute against the card's and refuses `stale` (a new sentence) otherwise, asking the listing again; nothing is filed or removed. |
| B3 | med | The copy being replaced was never re-read: a second tab's quicksave between the two presses was removed. | The slot as DRAWN rides the restore (`replaces: { key, gameTime, realTime }`); a copy saved since is kept, the backup arriving beside it. |
| B4 | low | A skipped arrival still removed the local copy - SP1's "already here" matches the character's NAME, so a namesake's save at the backup's minute skipped it and this character's only copy went. | On a skip, the copy goes only when THIS character's own copy of the backup's save is in the store. |
| B5 | low | The two-press arming was keyed by the cloud slot and outlived its pane: two local copies of one slot shared it, and a push armed on Save fired on Load in one press. | Restore and push arm by the LOCAL key; both rails disarm on a pane change. A restore's refusal is its one copy's (a twin keeps its own line), a `stale` refusal clears when the fresh listing lands, and no refusal outlives its visit. |
| B6 | low | `newer` read two devices' clocks: a PC two hours fast read the field case as "Backed up" again. | Later by EITHER clock - the device time or the game minute, which cannot be skewed. |
| - | med | The restore's full-store path had no pin (moving the removal above the no-room answer survived the suite). | Pinned with a store that throws on write; and a renamed character's twin at the backup's minute (which SP1's name match does not see) pins the minute guard B4 had made redundant elsewhere. |

**BALANCE1** (`systems/rrRidingHost.js`, `systems/rrInstall.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| F1 | low | Enhanced Riding's charge (165 fatigue a foe) is exertion, on neither the scaled list nor the unscaled one. | x0.75 (123), and listed. |
| F2 | low | Truncating Roleplay Realism's small overloads cut far more than a quarter - 1 a minute became free, 2 became 1. | The fraction is CARRIED on the entity (transient, as the running tally's is): twenty rounds pay the scale's share to the point. |
| F3 | low | A DFU wear pin (the 20% floor roll) had no seam and passed because its 0.195 also rounded the scaled point up; three pins hard-coded the scaled numbers, so "a turn is one line" was false. | Seamed; derived from the constants - a turn is the constant and `test/balance1.test.js`'s own pins (measured by turning both). |
| - | low | Two re-aimed pins could not tell a truncation from a rounding at x0.9 (7.425, 59.4); the overhaul's roll hand-through was never read (every case whole); the overload's no-sink arm had only a source pin. | The x0.8 rows (6.6, 52.8); a fractional overhaul case with `Math.random` answering the other way; the no-sink round driven. |

**CHARGEN-PHONE** (`ui/enhancedChargen.js`, `ui/enhancedStyle.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| C1 | med | The race map and the class list kept the phone block's `1fr auto` rows, and a phone on its side (844x390, 844x340) left them 0-30px - the provinces drawn at 10x11px, the class list an 8px slit - so michelle!!'s *"switching to landscape"* still stopped on the stages before the attributes. | Race and class are one scrolling column where the screen is SHORT (`stagebody stacked-short`, `(max-width: 860px) and (max-height: 500px)`). Stacked on every phone - this audit's first fix - the class stage's *"Read about the X"*, on screen before, fell under all 19 rows on a tall one; the lens measured it and a tall phone keeps the rows. A confirm sheet keeps its own scroll (made visible, *"Play as a Healer"* could not be reached). |
| C2 | med | With the review one scroller, its sticky header - the face at the scale the real host draws it, 105-175px - covered a landscape stage (136-186px) whole: none of the 40 steppers could be reached, and a short touch screen wider than 860px had 32px left under it. | The header stops pinning where the screen is short (`(max-height: 500px)`); a tall phone keeps it pinned. |
| - | low | The fix had been measured by hand, and nothing could measure it again. | `tools/chargenPhoneProbe.mjs` (`npm run chargenphone`, the lens's, not in CI - it needs Chromium): the real wizard, every row, stepper, province and primary of race, class, stats, review and the two confirm sheets reached by scrolling and answering a tap at nine sizes, and a tall screen's class primary on screen with nothing scrolled. 48 of 48 here (130 of 130 with `STATES=all`); 6 red on `08db3b3c`, 21 on `e48a38e5` (her screen among them), 3 with race and class stacked on every phone. |

## The record

- The page's name: `08db3b3c` wrote `Field-Bugs-2026-09-27c.md`, and main's PR 403 wrote its own page of that name (the
  death screen and the rest) while this audit ran, so this branch's became `Field-Bugs-2026-09-27d.md` - and main's PR
  406 then took 27d too (the curse's ghosts). It is `Field-Bugs-2026-09-27-phone-backup-drains.md` now, named for what it holds so that no
  lettered page of the day can take it again, and every reference on this side follows it; the pushed messages of
  `08db3b3c` and `54daf140` still say "FIELD 2026-09-27c" and "27d".
- Field-Bugs-2026-09-27-phone-backup-drains: the overload is 1-90 a minute (not 10-90); a blade's DFU wear is 0-2 a hit and the
  overhaul's 5-20; the scaled and unscaled lists name the riding charge; a turn is the constant and its own pins.
- Roleplay-Realism.md: the overload note sits in the encumbranceEffects row, not equipDamage's.
- The commit message of `08db3b3c` said "22 pins re-aimed"; the diff re-aimed 36 assertions in 16 tests across 11
  files, seamed 4 files and re-aimed 2 mutant records. Recorded here; a pushed message is not rewritten.
- Three older mutant records named menu lines this audit changed and were re-aimed (acc2c's ONLY-4, audit312's A312-5
  and A312-6); all three still die. The campaign's lists: `backupnewer.json` 32, `balance1.json` 24,
  `chargenphone.json` 17 - every one dead.

## Not fixed, and why

- **A restore made from the pause menu** is overwritten by the running game's next QuickSave unless the restored save
  is loaded - the same as a Download there, and no worse than before (the tile now stays "Newer backup" with the
  guarded upload, where it read "Backed up").
- **The either-clock rule's edges**: a device clock running fast still names an older-in-game backup `newer`; and a
  player who loaded an older save and saved over it sees the abandoned, further-along branch as `newer` - both acts
  ask twice there, which is the safe side of the call.
- **A Download (the cloud-only tile)** still files the arriving blob under the listing's card without reading its
  minute - ACC2c's arrival, unchanged: nothing is removed there, so a stale listing can mislabel a new slot but not
  lose one.
- **A namesake's save at the backup's minute** still blocks the arrival itself (SP1's name match) - the older copy is
  now kept, so nothing is lost; SP1's identity is left as SP1 decided it.
- **The relay test `AUDIT WORLD34 A1`** failed once in a full check run under four concurrent reviewers (it waits a
  fixed 25 ms per hello round trip) and passed alone five times and in the final check; neither side touched it.
