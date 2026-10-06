# AUDIT LEGACY II - Project Legacy end to end, 2026-10-05

Mac: *"let's do a deep comprehensive audit on everything so far"*, of PR #631 at `bbe5245e`: LEGACY1-LEGACY4, the first
audit's fixes (`01-Overview/Audit-Legacy.md`) and LEGACY-HOME (`06-Systems/Legacy-Arc.md` section 10b). Six lenses,
each an independent reviewer over the pushed head, read-only, every claim reproduced - headless drives of the real host,
store, save records and Living World town (scripts kept in each reviewer's scratch), Chromium for the windows:

- **A - the family law and the host's state machine** (`systems/legacy/`, `scenes/legacyHost.js`);
- **B - the world's wiring** (the four hosts' deaths, the birth boot, online, the Living World seams);
- **H - heirlooms, the remains and the estate** (duplication and loss, across reloads, members and lanes);
- **U - the windows** (desktop, phone, keyboard, pad; driven in Chromium);
- **F - fidelity and the records** (the mod's IL; every doc claim against the code; the patch notes);
- **P - persistence, performance and the tests' truth** (measured; mutants written to find what no pin holds).

Fifty-seven findings (A1-A10, B1-B6, H1-H5, U1-U14, P1-P8, F1-F14), several the same defect seen by two lenses. Every one was verified against the code before it was
fixed, and every one but the record corrections the PR description and the docs carry (F6-F10, F13) is pinned by id in
`test/auditlegacy2.test.js` (AUDIT LEGACY III F20 corrected this line: it said every one) (the host's own pins in `legacy1_family`, `legacy4_heirloom`,
`legacyhome` and `auditlegacy` brought to the new laws, each with its PIN MOVED note). Mutation-proven:
`tools/mutants/auditlegacy2.json` - 34 of 34 dead, after seven first-run survivors showed seven pins that held nothing
and were strengthened; the eleven earlier records the fixes moved were re-aimed by content and all die (72 of 72).

## THE ROOTS - what the first audit's law left open

The first audit's law stands: the store answers the world's facts, a save its character's grants. This audit found
where the CODE did not yet hold it.

- **A fact the store holds was lost by a write.** A copy behind the store's (a second tab of one line, an older save) was
  refused outright - the second tab's death silently dropped - and a write the storage refused was dropped unsaid.
  NOW a write merges the store's facts in (deaths only ever added) and is written past both; a refused write is said
  and tried at every tick (`store.js storeFamily`/`mergeFacts`; the host's `store`).
- **The record ran ahead of what stood.** A born member's character id, the fall they answered and their estate were
  written before the save that holds them; the Succession's choice settled the fall before anyone landed; the page
  that chose ticked on as if the heir were in it. NOW a birth stands only with its save, the fall is answered as the
  heir lands, and a page acts only for the character in it (`playedHere`).
- **A claim was neither the store's nor the save's.** Opening claimed; a rewind dropped the claim; a lapse left the list
  as first laid. NOW a list is claimed by the member who changes it, the claim is the store's and survives a rewind,
  and a lapse rebases the list as its claimant left it.
- **A copy between the lanes carried its original's line**, and played as their person in the store both lanes share.
  NOW both doors drop the record, and a record with no person for the character played is let go.

## Findings

| ID | Sev | Finding | Fix |
|---|---|---|---|
| A2/B1/H3 | High | **A born heir whose first save failed was orphaned for good** (and with them the estate): the id was stored, the birth door refused anyone with one, the dead-load offered only them. A member whose saves were deleted could never be played, and choosing them in the Succession settled the fall and stranded the line. | A birth stands only with its save (undone if refused, the handoff kept); the birth door and the play door ask one question - is there a save of this id (`hasSave`); the fall is answered as the heir lands (`onBorn`, `adopt`). |
| A1 | High | **After a choice handed the line on, the dying page paid the heir's estate into itself** and claimed the fallen's remains for the heir, before the boot landed. | The tick acts only when the character in the world is the one the record plays. |
| H1 | High | **A character copied between the lanes (customs, Copy to offline) played as the original's person**: its tolls aged them, its death or retirement wrote them dead in the shared store, the remains' purses entered the realm uncounted. | `offlineCopyOf` and `onlineCopyOf` drop `modData.ProjectLegacy`; `adopt` lets go of a record with no person for the played character. |
| H2/A3 | High | **One heirloom in two saves**: a rewind dropped the claim, a second member emptied the same list; a lapsed claim let an older save restore what the lapsed claimant took. | Only the claimant's save rewinds a row; the claim is the store's and stands; a lapse rebases the list as left, and is stored at once. |
| A4/P1 | Medium | **A permadeath lost to a write**: a second tab's death written at a lower rev was refused; a write the full storage refused was dropped silently - the dead played on after a reload. | The merge-on-stale write; the refused write said and retried every tick, first in the tick. |
| B2 | Medium | **The line shared a census household**: a stranger struck down turned the player's own sister against them (and blocked the meeting); the line's death turned the strangers; a census keepsake was taken by a family member. | A resident's household: the census house, or the line's own (`household`); `kinOf` compares it; no keepsake moment is the line's. |
| P3 | Medium | **Every save dressed every family resident as a stranger**: the street recycled their bodies and dressed them twice (13 to 10 visible after one save, measured). | Residents kept by what they are made of, never by the record's rev - the same objects, the same list. |
| F2/B4 | Medium | **Online the realm's homes became the line's**, contradicting the arc, and were written into the store. | No house is learned online. (LEGACY7 part five changed the arc: the realm keeps the line, and a realm character's online homes are its houses, learned with the save - `06-Systems/Legacy-Arc.md` 10b.) |
| A6 | Low-Medium | **An unsaved purchase or sale moved the line** - another member's load found it in a house that member's save does not own. | Houses learned with the save that holds the deed, and at a load. |
| A7 | Low-Medium | **A rise, or a switch whose save failed, wrote a member parked** in a house their newest save is not in. | Only a save says where a member was saved. |
| A5 | Low-Medium | **The family home moved at every switch** - the played one's rows were rebuilt last, so "the first house" was always another's. | Rows keep their places. |
| H5 | Low | **Opening the remains without taking anything took the quest from every other member.** | Claimed by the member who changes the list; another member's log says whose search it is. |
| H4 | Low | **The bones copied** when kept in a chest, a pile or the ground (no list the quest reads). | The bones leave the character's keeping only back into their own list (`planStore`, the list's non-enumerable mark). |
| B3 | Low-Medium | **A home changed took effect the next day** - the line slept in the old house; the new one stood empty. | A plan is kept by day AND home. |
| B5 | Low (records) | **"Family In World" needs the Living World**, which is the enhanced skin's - unsaid, and the card named homes nobody stood in. | The host reads it; the card says no home; the House page says why. |
| B6 | Low | **The meeting's Talk could run on a walker freed under the card** (online's clock runs). | Talk only while the body is still theirs, else "has gone on their way". |
| A8 | Low | The residents' memo served the one now played after an in-page load. | Reset at every load; keyed by content (P3). |
| A9 | Low | A damaged record's parent cycle recursed forever in the talk door. | Cut at the read; `kinOf` bounded. |
| A10 | Low | A damaged `first` became the remains' list at a rewind; every tick threw. | Held to its shape. |
| P2 | Medium (tests) | **The merge's newer-save base and its rev were held by no pin** (both mutants survived). | Pinned, a newer save and a store ahead. |
| P4/P5/P8 | Low (tests) | "The seat learns its town" asserted a fixture; the past, `markHome`'s write and the greeting held nothing; the fixture cut rolled siblings from memory alone and its save never ran the real save. | The seat taught in its town alone; the past and the mark pinned; siblings off by the setting; the fixture's save is `getSaveData`. |
| P6 | Low | The record grew without bound - a rested row kept two copies of its lists. | A rest lays what was left to rest with them. |
| P7 | Low | `homeFor` sorted the town's doors at every ask. | Listed once. |
| U1 | High | **A held Enter ended the line**: the arm and the confirm of "Let the line end" on one held press. | Repeats press nothing - the window's own capture, and `walkButtons`. |
| U2 | Medium-High | **One Space (the Jump key) at a meeting switched characters.** | Talk lit first; Play as asked twice. |
| U3 | Medium | **The keyboard could not reach the Family tab's controls in the game** - both hosts' overlay rungs prevented Tab (the pause window's, inherited). | A window that owns the focus (`data-dom-focus`) walks it (`isDomFocusWalk`, both routers). |
| U4 | Medium | Tabbing to a plate scrolled the clipped tree, the pan unaware, the tools out of sight. | The box never scrolls; a plate reached is panned to. |
| U5 | Medium | Focus invisible on plates and kin links. | `:focus-visible` rings. |
| U6 | Medium | Arming Play as or Pass the mantle dropped the focus to the page. | `data-focus` keys - and `domRepaint.giveFocus` lets a key win over a button's changed words (the root). |
| U7 | Low-Medium | "Make this the family home" moved focus to the other row's button; a second press undid the first; nothing said it. | Said, the focus on the word. |
| U8 | Low-Medium | The tree stuck in a drag. | The drag ends with the button, a cancel, a lost capture. |
| U9 | Low-Medium | Five tabs wrapped on phones and small tablets. | Tighter under 420 px and from 661 to 780 px. |
| U10 | Low | The model question's tag spilled out of its card in phone landscape. | The head row wraps. |
| U11 | Low | The meeting could print "none". | A sentence. |
| U12 | Low | A 24-letter name spilled out of the Succession at 360 px. | Names wrap; the card's column may shrink. |
| U13 | Low | Kin links were 14 px tall on a phone. | Padded to 24. |
| U14 | Info | No pressed or current state on plates; refusals and words not announced; a refused Play as skipped by the walk and its reason unheard; the pad's bar offered Back over the Succession. | `aria-pressed`/`aria-current`, a labelled tree, live words, `aria-disabled` described by its reason, no Back. |
| F1 | Medium (records) | The arc and the patch notes said the estate was capped at 10,000; it is 9,900. | Corrected. |
| F3 | Medium (records) | "Every final death leaves remains" - a kin struck down leaves none. | The exception recorded. |
| F4 | Medium (records) | Unrecorded departure: the mod switched to living siblings alone; the port to any living member. | Ledger (15). |
| F5 | Low (records) | The arc said the offline rise takes the death's purse; it takes none. | Corrected. |
| F6-F9 | Low (records) | The patch notes credited the port's own draft's fixes to the mod, named the "nearest" town as the seat, the Succession's choices too narrowly, and the tree where the House page records a killer. | Corrected in the PR description. |
| F10 | Low | The vendored DLL's abbreviated hash was wrong. | Corrected. |
| F11 | Low (records) | `Audit-Legacy.md` counted 35 findings for 34 rows, used H9 twice, and A9 and U9 were unpinned. | Recounted; H10; both pinned here. |
| F12 | Low (records) | A mod bug unlisted: "Random" after "Always" kept answering Always until restart (`LoadSettings` never clears). | Section 2, S5. |
| F13 | Low (records) | Index lines stopped at LEGACY1-4. | Active-Arcs, Home, UI.md, the Credits. |
| F14 | Low | A dead `&& false` clause in the tree's roots. | Dropped. |

## Not changed, and why

- **A kin's death leaves no remains and no quest** (F3): they fell in the street at the one played's hand - there is no
  "where they fell" to seek, and the line's record keeps who did it. Recorded in the arc, section 7.
- **The arrow keys over the pause window** (U3's second half): Tab and Shift+Tab walk it, the standard walk; the arrows
  remain the host's.
- **Disabled buttons' contrast** (U14): WCAG exempts inactive controls; their reasons are in readable red beside them.
- **A dead member's houses stay the line's**: "every house a member has held" - the record says so (section 10b).
