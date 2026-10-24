# AUDIT GROWTH (2026-10-18) - the Growth tab, its guide, its stage and its words, audited

The owner, of PR #997 (GROWTH1-GROWTH5, the TEXT pass and RVN-OWN-KNEEL, with RVN-STARS #999 merged in -
`10-UI/Growth.md`, `01-Overview/bugs/Field-Bugs-2026-10-17g.md`): **"Comprehensive audit over everything to ensure
perfection"**, beside **"Conprehensive pass on explanations and text to ensure no AI like text, over explanations, or
weird descriptions exist"**. This page is the findings, each with its verdict. What the audit changed is written into
`10-UI/Growth.md`'s sections as they now stand, each change marked AUDIT GROWTH and its id.

## How it was run

Five cold lanes, each an adversarial reader of a FROZEN snapshot (a git worktree at 9fdcde4189, per Home.md's DO NOT
FIX WHILE THE VERIFIER IS READING), each told to prove a finding against the code - by a node script over the real
modules or Chromium over the lab (`growth.html`) - before reporting it; then every finding reproduced again before it
was acted on:

| Lane | Over | How |
|---|---|---|
| L1 - the law and the model | `specGuide.js` against `arcanePaths.js`, `martialPaths.js` and `masterSkills.js`; every rewritten passive, rider and technique against its power; the Level page's rollout and its fanfare | the guide's model over made characters of every slot shape; each power's own seam read beside its words (`lane1/*.mjs`) |
| L2 - the stage and its input | `growthStage.js`, the three windows' `embed` modes, the keys and presses over the tab, the layout at nine screen sizes in both dresses | Chromium over the lab at 360x740 to 1920x1080, Plus and Grimoire (`lane2-probe/*.mjs`, `lane2-shots/`) |
| L3 - the doors, the hosts, the skins | `pauseDoor.js`, `charSheetDoor.js`, `charsheet.js`, `captainPage.js`, the four hosts, the boot bundle, the classic skin's rollout | the shipping doors over the fake document; the build's chunks; the classic sheet with a level owed (`lane3/*.mjs`) |
| L4 - the RVN-STARS merge | everything this branch changed in or around #999: `skyWindow.js`'s embed port, the doors, `captainTreeWindow.js`, the moved pins and records | the doors driven on #999's own tree and this one side by side; #999's records run whole (`l4/*.mjs`) |
| L5 - the words, the languages, the docs, the pins | every English line the tab shows, the thirteen languages, the record against the code, what the pins cannot fail | German in the lab; 13 plausible regressions run against every suite that names their module; the gates (`l5/*`) |

The scratch scripts are the session's (`scratchpad/audit/`); none is committed.

## Findings

| # | Sev | Finding | Verdict |
|---|---|---|---|
| L3-1 | HIGH | CI red on the frozen head: two door pins (`slots1`'s menu mounts, PX28's `registerOverlay(close)`) | FIXED before the audit closed (4ddaceefde - the F5 door's two mounts, its QuickDial arm `dialClose`) |
| L3-2 | HIGH | Classic skin with a level owed: the S/W rows opened the Growth window over the sheet's rollout with the host's whole pause bag - its Save wrote the level with the points gone, its Pack, Spellbook or Chronicle took the slot and dropped the sheet's unspent pool (the Oghma's 30 too), past DFU's CheckIfDoneLeveling | FIXED: no Growth window while the rollout stands (`charsheet.js` `_growth`, the rows' guide); the rows keep DFU's boxes then |
| L1-1 / L5-3 | MED | The guide judged each skill of a pair alone: two minor schools (one minor slot), or two majors with one major slot left, read "Needs mastering" / "Within reach" - a path that can never open, the player led to spend a permanent mastery on it | FIXED: the pair counted as `masterableCount` counts it - a new state, **No slots left**, with the Requirements line saying why ("Illusion and Mysticism are both minor skills, and you can master only one more minor skill") |
| L1-2 / L5-8 | LOW | Master Skills off: a mastered pair was told to "raise both skills to 100", and a skill past 100 showed its raw 150 where the game reads 100 | FIXED: "Turn Master Skills on to unlock this path."; the value `masterCappedSkill` reads |
| L1-3 / L5-8 | LOW | The chosen path said "It works while both its skills stay mastered" (always true) while its powers were off (Master Skills off, mentoring, a duel, the beast) | FIXED: "Your specialisation." - and, asleep, why its powers are off |
| L1-4 / L5-8 | LOW | "Not for your class" when the player's own masteries spent the slots; the family headline the same | FIXED: **No slots left** apart from **Not for your class**; the headline says the slots left can't hold a pair when the class could |
| L1-5 / L5-9 | LOW | The Brawler's rider said the dazed enemy deals less damage; only its blows do (`martialGuardPct` reads `pendingPlayerBlow`) | FIXED: "blows from the enemy it hits deal {pct}% less damage to you" |
| L1-6 | LOW | The Bloodmage's rider said the target must "drop below" 30%; one already under takes it too | FIXED: "If the target is below {pct}% health after the hit" |
| L1-7 | NOTE | The Berserker's leech said "every blow"; arrows pay it too (the strike listener) | FIXED: "every blow or arrow you land" |
| L1-8 / L2-12 / L3-10 | LOW | The level-up fanfare replayed on every visit to the Level page for a level the strip never announced (one loaded from a save, an Oghma level) - LV2's one event, one sound | FIXED: `charSheetDoor.js` levelUpScreenFor plays it once a level (DFU plays it once a level too - its sheet cannot be closed with points unspent) |
| L1-9 | NOTE | The guide opened on the family holding a path while the other had paths waiting | FIXED: a family with a choice waiting first (`firstFamily`) |
| L1-10 | NOTE | The rail's mark summed paths (three schools mastered: "3" for one choice), and built the whole guide to count | FIXED: a choice per family, from `pathChoices` / `martialChoices` |
| L1-11 | NOTE | "Buy it at the Mages Guild" (the temples sell it too); "a weapon with its own technique uses that instead" (false with the loot ladder off) | FIXED: "wherever spells are sold"; the ladder's sentence only while it is on |
| L1-12 | NOTE | "Raise both skills" when one was mastered | FIXED: the line names the skill that still needs it |
| L1-13 | NOTE | The arc riders do not say an immune foe takes none of the share | KEPT: the share obeys the element as every spell does; the old words left it out too |
| L2-1 | MED | The embedded faces answered keys under the account window: letters lost from its fields, its Enter accepted the captain's pending stars (a save write) | FIXED: deaf while a window over the pause window holds the stage inert |
| L2-2 / L3-3 | MED | The Level face took every Enter in the window: Enter on the Stats tab pressed Ascend | FIXED: a focused button's Enter is the button's in the tab (the skies' own rule) |
| L2-3 / L3-4 / L5-7 | MED | A tap on the scrim beside the widened window, and a timers row's door, resumed without asking the face - unaccepted stars dropped | FIXED: both ask (GROWTH5) |
| L2-4 / L3-8 | MED | The leave-ask was armed once a face: stars taken by the pointer after it were dropped unasked | FIXED: the ask is for the stars it named - re-armed when they change |
| L2-5 / L3-6 | MED | A phone's face, its full screen left, said its ask into a detached box: the first press looked dead, the second discarded | FIXED: it is opened full screen to ask |
| L2-6 / L4-6 | MED | The skies' line was placed in screen coordinates inside the pane: 200 px low, or off a short stage | FIXED: under the bar in the root's frame, again on every resize |
| L2-7 / L3-5 / L4-1 | MED | F5 or the pack key over a sworn revenant's sky dropped its unaccepted stars unasked (#999's own hole; GROWTH5 asked only the stage) | FIXED: `revenantStarsOver`'s `asks`, the sheet's key asks it; the leave words, not "Close again" |
| L2-8 | MED | The Ascension in the pane: its figure flattened to 0-28 px at 1280x720 and 1366x768, the stars on each other; Ascend clipped at 1024x600; the Grimoire's book overlapping at every size | FIXED: drawn in the pane only where it holds it (a Plus window 1000 px tall); elsewhere the phone's Open door, the face full screen as it is over the world - measured at eight sizes in both dresses |
| L2-9 | LOW | The Grimoire's book outranked the strip rail over a face: the sky a third shorter | FIXED |
| L2-10 | LOW | The stage loaded its faces outside MENU1's chunk door: no retry, and "try again" for a chunk a deploy took | FIXED: once more, then RELOAD_TEXT |
| L2-11 / L3-7 / L5-11 | LOW | The view's Close in the tab redrew the same view | FIXED: no Close in the tab |
| L2-12 (part) | LOW | The Level page dropped placed points on leaving, the lead promising "your points will wait" | FIXED: the lead says the points stay and are placed again |
| L2 N1 | NOTE | Over full screen the second Escape leaves full screen before the third discards | KEPT: more careful than its words |
| L2 N2 | NOTE | Tab walked under the full-screen box to the window's tabs | FIXED: the focus stays in the box |
| L2 N3 | NOTE | "Leave full screen" sat on the skies' summary panel and the Ascension's Ascend | FIXED: a strip of its own under the face |
| L2 N4 | NOTE | A face left before its chunk landed was still built (a dropped Level face drew its pool) | FIXED: built only while its page stands |
| L2 N5 | NOTE | A phone's waiting face keeps its frame loop on a detached canvas | KEPT: a waiting face is a page's, dropped with it; nothing drawn reaches the screen |
| L2 N6 | NOTE | The lab's dead `data-dress` line | FIXED |
| L2 N7 | NOTE | Save from the classic child relocks the pointer under the sheet | FIXED (L3-14) |
| L3-9 | LOW | The guide's Yes/No card: Escape closed the card and the window; F5 left the card over the running game, its Y still choosing a permanent path (Master Skills' cards since SOFTCAP) | FIXED: the card owns its keys while it stands and goes with the window |
| L3-11 | NOTE | The classic sheet forwarded no dispose to its child | FIXED |
| L3-12 | NOTE | The classic rows showed a dormant path as in force | FIXED: the chosen row only while it is |
| L3-13 | NOTE | Doc drift: interiors and dungeons entered from the world show four pages; the captain page's fallback; the classic level-up spent in the Ascension through another landing, unnamed; a stale comment | FIXED: Growth.md sections 3, 7 and 8 (the departure named); the comment |
| L3-14 | NOTE | Save or Load from the classic child relocked under the sheet | FIXED |
| L4-2 | LOW | The revenant sky's note said health changes "the next time it is called"; AUDIT RVN-STARS S1 rescales it at Accept | FIXED: "Its health and damage change at once." |
| L4-3 / L5-15 / L5-16 | LOW | Four docs called `firmamentOver.js` DELETED (it keeps RVN-STARS' door - the false mark kept AUDIT 18's path gate quiet); the ledger's counts and embed file stale | FIXED |
| L4-4 | LOW | The captain's embedded mode was unpinned (five survivors) | FIXED in the pins |
| L4-5 | NOTE | Stale comments, a test title and a cite left by the round trip | FIXED |
| L5-1 | MED | The Level and Firmament faces were skipped by the TEXT pass: their lines poetic ("Choose what rises", "Warms merchants, judges and anyone else weighing what you are worth", "That star is not in the heavens") and hard-coded English in every language | FIXED: both through `t()` (`levelup.*`, `firmament.*`), said plainly, each checked against its code; drafted into the thirteen. KEPT open: the Firmament's tree and law (star names, the service's refusals) - Audit-UICalm-Firm1 L5 M1's owner's pass |
| L5-2 | MED | The translated leads named "Aufsteigen" and "Annehmen" over English buttons | FIXED: the buttons translated, and the leads and asks take the button's own word (`{ascend}`, `{accept}`) |
| L5-4 | MED | The tab's main features were source regexes: 13 plausible regressions survived every suite, two the browser probe too | FIXED in the pins: the real Firmament, captain's sky and Ascension driven on the stage over the fake document |
| L5-5 | MED | A vacuous pin: `doesNotMatch(/cannot/)` over "can't" | FIXED |
| L5-6 | MED | The Master Skills page told every class to "unlock a specialisation" - AUDIT SCHOOLS L4 8 undone | FIXED: the line only for a family still to reach or a path held |
| L5-10 | LOW | "or do that again to discard them" read in Spanish as "press Accept again" | FIXED: "or leave again" / "or close again" |
| L5-12 | LOW | open / available / unlock; "Specialisations (S)" beside "Martial paths (W)"; "Bow:" over "With Archery:"; the Weapon Technique key's name; "mastery slots" against the page's "chosen"; German alone mixed two names | FIXED: "available"; "Arcane paths (S)"; the technique texts' weapon words; German's one name. KEPT: the key's name (the action's own, as Controls lists it) and "slots" (the guide's own word, defined where it stands) |
| L5-13 | LOW | Over-explained lines | FIXED: the Firmament's offline line, the Level lead, "See them all", Lightbringer's "% of the damage", the revenant's "brings back nothing if it returns hurt", "Not yet" for "Within reach", the permanence said once. KEPT: the Wardwright's "if you have room for the magicka" (exact: `absorption.js` refuses past the room); the spell lines (the spellbook's own reading, SB-FX) |
| L5-14 | LOW | The captain's "one point per captain level" (the law: after the first) | FIXED, and the refusal beside it |
| L5-17 | LOW | The specialisation pages still described the deleted cards and `specCard` | FIXED |
| L5-18 | LOW | ascendanytime's "the same bonus pool" pin passed one time in three when broken | FIXED: the remembered pool read |
| L5-19 | LOW | The captain page's fallback, said to be reachable | FIXED: said as it is - kept for a caller without the tab, none today |
| L5 N1 | NOTE | Re-aimed record names describe a law since moved | KEPT: the names are the history the notes explain |
| L5 N2 / N3 / N5 / N8 / N9 | NOTE | A pin's message, a test's title, Testing.md's present tense, "foes" in the revenant sky, the lab's comment | FIXED |
| L5 N4 | NOTE | Three counts for the TEXT pass's strings | FIXED: Growth.md's count as the code stands |
| L5 N6 | NOTE | The classic boxes' rewritten words are seen only headless | KEPT: known; the classic rows open the guide where a document stands |
| L5 N7 | NOTE | Decimal points stay English in every language ("2.5 Metern") | OPEN: the raw number goes into ICU unformatted - older than this PR, every arc's numbers |

## Pinned

`test/ui/growth/growth1_tab.test.js` - every FIXED finding above whose law is code: the guide's slots, states, lines,
family and count; the riders; the fanfare; the stage's edges (a dropped face never built, the chunk retried, the door,
the detached ask); the classic sheet's edges; the tab driven with its real faces (a star taken on the Firmament and
the captain's sky, each leave asked once then let go, nothing set; the Level page's owed rollout); the Yes/No card and
the Master Skills line driven. `test/systems/revenant/rvnstars.test.js` - the sheet's keys asking a sworn one's sky, the
note's words. `test/ui/enhancedLevelUp.test.js` - the Ascension's words read in the player's language when drawn.
`tools/mutants/audit_growth.json` - each of the audit's laws as a mutant, every one dead; the records the fixes moved
were re-aimed by content and run again.
