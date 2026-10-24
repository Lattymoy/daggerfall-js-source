# AUDIT SPEC-RESET (2026-10-18) - a specialisation given up for gold, audited

The owner, of SPEC-RESET (`10-UI/Growth.md` section 10 - an arcane or a martial path given up for 200,000 gold a
family): **"Audit this and ensure perfection"**. This page is the findings, each with its verdict. What the audit changed
is written into `10-UI/Growth.md` section 10 as it now stands, each change marked AUDIT SPEC-RESET and its id.

## How it was run

Five cold lanes, each an adversarial reader of a FROZEN snapshot (a git worktree at 231f946c5, per Home.md's DO NOT FIX
WHILE THE VERIFIER IS READING), each told to prove a finding against the code - by a node script over the real modules,
the account service driven in node, or Chromium - before reporting it; then every finding reproduced again on the live
tree before it was acted on:

| Lane | Over | How |
|---|---|---|
| L1 - the law and the economy | `specReset.js`, `court.js`'s tender, every power, cache and shelf a held path feeds, the asks, the saves, the price against the game's economy | the law over made characters through the real producers; the quiet pass (`shared.js` raisePlayerSkills) driven |
| L2 - online, the realm, integrity | the realm's checkpoints, leases and acts, the judge, the progress claims, the realm gold law, saves across builds | the account Worker in node (`test/accountDb.mjs`); the previous build's `save.js` git-archived beside this one |
| L3 - the UI, driven | the Reset press, its card and its refusal in both dresses at four screen sizes; the classic sheet's rows | Chromium over the Growth lab (`growth.html`) |
| L4 - the words | every new and changed line in English against the code it describes; the thirteen languages rendered with real fillers; the record | `textManager.js` over each language's table; the classic box measured in FONT0003's widths; the menu font in Chromium |
| L5 - the pins and the repo's rules | regressions the pins cannot fail; Home.md's Process rules; the boot bundle | `tools/mutate.mjs` over every suite that imports a touched module; the build's chunks |

The scratch scripts are the session's (`scratchpad/audit/`); none is committed.

## Findings

| # | Sev | Finding | Verdict |
|---|---|---|---|
| L2-1 / L1-4 | MED | An older build's carry (a save with no `arcanePath` key) read the path back from the book (AUDIT SCHOOLS L3 F2's witness), and the reset leaves the path's signature spell there: the path came back with the 200,000 spent; reset, then a newer path chosen without its spell, the carry swapped the old path back for nothing; with both spells bought, the newer path was lost. The judge passed each | FIXED: the career's **arcane mirror** (`career.arcaneMirror` - the path or none, written on every save), read before the book; an heir's mirror or one whose schools no longer back its path is none (`save.js`) |
| L1-1 / L2-2 | MED | The reset counted coins and letters only, where the Firmament's respec on the same tab, homes, guilds, decor and the bank's ships draw on the bank too: 200,000 coins weigh 500 kg (the ceiling 150 kg at Strength 100, the bank's withdrawal TOO_HEAVY), so a player with 1,000,000 banked was told "You have 500" | FIXED: online the Empire's account pays what coins and letters leave, as the Firmament's wallet pays (`court.js` payUndoable, `realmGoldLaw.js` accountOfSave; a loan is no gold); offline an account is its region's and the pause window stands in none - coins and letters, and the refusal says "paid in coins or letters of credit" |
| L1-2 | MED | A path chosen on the guide never set its one ask's flag (only the ask sets it); after a reset the next quiet pass asked "Specialise as Warden?" - Yes chose back the path just paid away | FIXED: the reset marks the family's ask made (`pathPrompted`, `martialPrompted`) |
| L1-3 | LOW | A passive's stats (the Enchanter's Glamour, Light Step, Windborne) are folds kept on `entity._mods`, recomputed at an equip change or a magic round: they outlived the reset through the open pause window - and a Choose's arrived only at the next round | FIXED: the reset folds at once, and so does every Choose - the guide's, the one ask's Yes, the classic sheet's |
| L1-5 / L4-1 | MED | The arcane ask said "Its signature spell stays in your spellbook as an ordinary spell" to a player who never bought it - choosing grants none, the shelf sells it to the path's holder | FIXED: that line only where the book holds the path's own signature spell; else "You lose its passive, and its signature spell is no longer sold to you." |
| L4-2 | LOW | "{name} reset. You can choose a new specialisation." - false with Master Skills off (offline the reset stands, nothing can be chosen), and "new" while the list offers the same path | FIXED: "{name} is reset." - the page under it says what can be chosen |
| L4-3 | LOW | "Then you can choose: Warden." right under "Reset Warden?" read as a slip | FIXED: "Open to you after the reset: {names}." |
| L4-4 | LOW | de and pt-BR: the lose lines' possessive (ihre, dela) had no noun to agree with - the ask names only the path | FIXED: neutral articles |
| L4-5 | LOW | The several-open boxes' new sentence wrapped a lone word onto a line of the classic parchment box (288 px) in da, nb, it, de, es, fr | FIXED: the price a row of its own; the widest row now fr's at 224 px |
| L4-6 | LOW | es and pt-BR: the lead's last sentence read clipped ("Restablecer una cuesta...") | FIXED: "una de ellas", "uma delas" |
| L4-7 | LOW | The bible still said a path is permanent: the Page-Index entries, Systems.md's `arcanePaths.js` entry, Growth.md's Closed state, both Port-Ledger rows, and the two arc pages' "The choice" sentence was qualified rather than rewritten (RETIRING A FLAG DELETES THE SENTENCE) | FIXED, each; Active-Arcs entries and audit records are history and KEPT |
| L4-8 | LOW | Section 10 pointed to section 8 for the four hosts rather than naming them (THE FOUR HOSTS RULE) | FIXED: named |
| L4-9 / L2-3 | LOW | Code comments still said permanent (`charsheet.js` x2, `shared.js`, `save.js` x2, the laws' headers), and two said the judge checks signature spells (`judge.js`, `arcanePaths.js`) - it has not since AUDIT SCHOOLS L3 F2, and after a reset that book is an honest one | FIXED |
| L4-10 | NOTE | Section 10's only-path guard named spent slots and left out a class with no other masterable skill | FIXED in the record |
| L4-11 | NOTE | `refuse.none` duplicated `schools.refuse.none`'s English under a key of its own, it and ro translating it differently | FIXED: the reset reads `schools.refuse.none` |
| L4-13 | NOTE | ru: the ask quoted «{name}» where the family's rows use the colon form | FIXED: "...золота: {name}?" |
| L4-15 | NOTE | A closed path said one path of each kind and nothing of the way out | FIXED: "...; reset {name} to choose another." |
| L3-1 | MED | The gold refusal hid the permanent one: a player whose masteries could open no other path read "Resetting costs 200,000 gold. You have 199,999." and learned only at 200,000 that the reset could never help. And while a path was held every other path read Closed - a path the class can never master too, which L4-15's line then told the player to reset for | FIXED: the only-path line first, whatever the gold (L5-5 had pinned the other order; reversed and re-pinned); a path the class can never master, or whose slots are spent, reads Not for your class or No slots left whatever is held - Closed only where a reset could open it |
| L3-2 | MED | After Yes the note - the reset's only answer - stood above the pane's kept scroll, out of view at every size in both dresses (Choose the same, older), the focus fallen to the body, no live region | FIXED: the note a status line, brought into view and focused once drawn - in view at all eight sizes and dresses, for a Reset and a Choose |
| L3-3 | LOW | The Yes/No card (GROWTH's) was modal to the pointer alone: Tab and Space walked the window under it - the family switched, the tabs changed - and Y then paid a reset over the Quests tab; unnamed, not modal to a reader | FIXED: named by its rows, `aria-modal`, the window under it inert, the focus on No and given back to its opener |
| L3-4 | LOW | Three quick presses of Yes answered three times (the law paid once, the note became "no specialisation of this kind"); a Y held down before the card stood answered it by its repeat | FIXED: answered once (YesNoBoxWindow's own `done`), a repeat answers nothing |
| L3-5 | LOW | The refused press's reason was a line beside it and nothing more | FIXED: `aria-describedby` |
| L3-6 | LOW | The Grimoire's refused press read nearly as its enabled one (the page press's soft ink) | FIXED: faded as the pack's refused presses are |
| L3-7 | LOW | On a phone the press broke before its "·" in five languages (a Czech line began "· 200 000") | FIXED: the "·" binds to the word before it, in every language (code-side, so a new language needs nothing) |
| L3-8 | LOW | (L4-2's) the done note said "choose a new one" with Master Skills off | FIXED with L4-2 |
| L3-9 | NOTE | The Grimoire's phone layout (the rail in letter columns, a 130 px text column) is older than the reset | KEPT: outside this slice; recorded for the dress's own pass |
| L3-10 | NOTE | The classic skin reaches the reset through its S and W rows (two presses: the guide lands with the path closed up); with no document its chosen row keeps DFU's OK box | KEPT: GROWTH4's doors, unchanged |
| L5-1 | MED | The guide's martial half was nearly unpinned: its field drifted to the arcane one, its only-path guard dropped, its "more paths" line dropped - each survived every suite | FIXED: the martial ask pinned whole, its guard pinned on a character whose minor slot went to Mysticism |
| L5-2 | MED | The only-path guard's 'ready' arm (a skill at 100, a slot left - a Master Skills press away) unpinned: read as out of reach, a reset that could open another path would be refused | FIXED: pinned on a character with Mysticism at 100 and the minor slot free |
| L5-3 | LOW | (L1-2's) "the one ask is not asked again" held only for a path the ask had chosen | FIXED with L1-2; pinned through the real quiet pass |
| L5-4 | LOW | The guide's lead could lose its `{gold}` and read "costs undefined gold" - only the catalog's parity read it | FIXED: pinned in the window driven |
| L5-5 | LOW | The refusals' order unpinned | FIXED: pinned - in L3-1's order, the only-path line first |
| L5-6 | LOW | A new visit's dropping of the last visit's note unpinned | FIXED: pinned over a second mount |
| L5-7 | NOTE | The refusal line's class and its CSS rule unpinned | FIXED: pinned |
| L5-8 | NOTE | `pathState(bare, ...)` against `pathState(entity, ...)` is an equivalent mutant: with nothing held passed, the states read no path field | KEPT and recorded `equivalent` (`tools/mutants/specreset.json`) - the view is the one entity the list is built on |
| L5-9 | LOW | ONE DFU MEMBER, ONE EXPORT: the family's field was written twice, in the law and in the guide | FIXED: `specReset.js` resetField, the guide reads it |
| L5-10 | LOW | TEST THE SHAPE THE PRODUCER MINTS: the pins hand-built a letter of credit | FIXED: `inventory.js` letterOfCredit |
| L5-11 / L5-12 | LOW | (L4-7, L4-9's and L2-1's, found again) | FIXED with them |
| L5-13 | NOTE | A `--jobs` verdict under load can call a survivor dead (one did, with tsc beside it) | Every record here judged SERIALLY before it was counted |
| L5-14 | NOTE | `specReset.js`'s header ran a line to 135 columns | FIXED (the file rewritten); its long `t()` lines are the neighbours' habit (61 and 93 such lines in the two laws) |
| L5-15 | NOTE | The patch notes belong in the pull request's description (`## Patch notes:`), and no pull request exists yet | Carried to the pull request |
| L4-12 | NOTE | The Reset press wraps to two lines on a phone in eight languages (cs widest, 463 px on one line); nothing clips | KEPT: the guide's buttons wrap by design; cs keeps "Zrušit specializaci" ("Zrušit" alone reads as Cancel) |
| L1-6 | NOTE | Balance: 200,000 is the large ship's price, 80 average gate wins at level 10 and 27 at 30; offline a bank loan covers it five times over at level 20, online not | KEPT: the owner's number; recorded |

Checked and found sound (L1, L2): payment edge cases (no items, no purse, a partial letter, a negative purse - a NaN
purse passes as every DFU gate's does, and no save can carry one); a second Yes refused ("nothing held") and charged
once; the old signature spell cast in its own schools, its rider never firing, the shelf offering only the new path's
spell; every power reading the awake path live; mentoring, duels, beast form and Master Skills off harmless; the
realm's checkpoints, leases and acts reverting the reset and its price together on every lost write, closed tab,
second device, seizure and seat taken back; the judge and the progress claims quiet over a reset save, trade unheld;
the Worker bundle untouched; a modified client given nothing it lacked.

Checked and found sound (L5): the bible's gates, the l10n suites, the moved suites; `tsc` and the whole tree's eslint;
every cite resolving; the Worker guard (the arcane law reaching `court.js` fails `accountdeploy` and INT1's loader); the
boot bundle (main.js's closure 82 files before and after; the menu's chunk, which already held `court.js`, gains
`specReset.js` alone); no host touched; `resetSpec`'s two exits one shape, both pinned; nothing async; one home for the
price.

Checked and found sound (L3): Escape, N and Enter answer No and keep the window; one payment from every key and
press; the card fits at every size from 568x320 to 1920x1080 in both dresses; no sideways scroll anywhere; the press
one line in English Plus at every size; the refusal line's contrast (8.5:1 Plus, 5.4:1 Grimoire); after Yes the
family's paths, the switch's and the rail's counts, the Stats door and Master Skills' line; both families reset one
after the other; the console clean. Every fix above was driven again in Chromium over the live tree with the lane's own
probes - the note in view at all eight sizes, the walk under the card stopped, the repeat unanswered, the only-path
line at every gold, the "·" bound in five languages on a phone.

The pins: `test/ui/growth/specreset.test.js` (10). The mutants: `tools/mutants/specreset.json` (72: 71 dead, judged
serially, and one equivalent as recorded - L5-8); four older records re-aimed by content and judged dead again (`audit_martial.json`,
`audit_schools.json`).
