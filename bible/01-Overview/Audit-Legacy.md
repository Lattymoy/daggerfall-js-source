# AUDIT LEGACY - Project Legacy, LEGACY1-LEGACY4, 2026-10-05

Mac: *"Let's do a deep comprehensive audit on this. Needs to be perfection"*, of PR #631 (`06-Systems/Legacy-Arc.md`,
LEGACY1-LEGACY4: the family, the two models, the heir born, heirlooms and the death quest, the Family tab). Five lenses,
each an independent reviewer over the pushed head, read-only, every claim reproduced (a headless drive of the real host
and save records, Chromium for the windows):
- **A - the family law and the host's state machine** (`systems/legacy/`, `scenes/legacyHost.js`);
- **B - the world's wiring** (the death paths of the four hosts, the birth boot, online);
- **H - heirlooms, the remains and the estate** (duplication and loss);
- **U - the windows** (Enhanced Plus, a phone, the keyboard and the pad);
- **F - fidelity and the records** (the mod's IL against the port; the docs against the code).

Thirty-four rows of findings after the duplicates were folded (AUDIT LEGACY II F11 corrected the count, which said
thirty-five, and named the retirement's heirloom row H10 - H9 had been given twice). Every one was verified against the
code before it was fixed, and is pinned by a test that fails on the code as it stood (A9 and U9 were not, until AUDIT
LEGACY II pinned them in `test/auditlegacy2.test.js`): `test/auditlegacy.test.js` (by id), with the host's own
pins in `legacy1_family`, `legacy4_heirloom` and `legacy3_familytab` brought to the new law. Mutation-proven:
`tools/mutants/auditlegacy.json`. Each fix carries an `AUDIT LEGACY` comment.

## THE ROOT - two authorities, one of them asked everything

Most of A and H were one defect: the store's copy of the family was the authority for EVERYTHING, and the live entity
wrote into it without being asked who it was. A reload undid what should stand (a death, decided at the screen's reset,
was undone by an F11 under the screen) and kept what should rewind (an estate marked paid, an heirloom marked taken,
before the save that held them). The fix is a law, stated once in `scenes/legacyHost.js` and pinned:

- **The store answers the world's facts** - who lived, who died, Arkay's toll, who is played, which remains exist. A
  death is decided AT THE DOOR (`characters/playerEntity.js setDeathListener`, DFU's `PlayerEntity.OnDeath`, which the
  mod itself subscribed to), before any screen, mode exit or reload; a fall leaves its Succession waiting ON THE RECORD
  (`family.pending`).
- **A save answers what its character was given** - the estate and bequest paid, the remains opened, taken or laid to
  rest (`mergeFamily`). A reload rewinds them with the bag they went into.
- **The past is played back as the past** - a dead or retired member's save, under either model, is refused for as long
  as it stands, and the line's Succession (or its living) is offered until answered.

## Findings

| ID | Sev | Finding | Fix |
|---|---|---|---|
| A1/B3 | Critical | **A permadeath was undone by F11** (or a closed tab) under the death screen: the death was decided only at the screen's reset; `onDeathPresented` was dead code. The same press skipped Arkay's toll. | Decided at the door - `onDeath`, a death listener on every host's one damage door, idempotent per death (the door and the DEATH-KEPT re-ask are one decision). The reset presents it (`deathOutcome`). |
| B1/U1 | Critical | **Every Bloodline fall stranded the line**: the Succession replaced the death screen, the player stayed at zero, and the next frame's DEATH-KEPT backstop raised a new death screen over it; its reset found the member dead and ended the run (online: respawned a dead member). | The Succession IS the death's screen: the backstop and both exit autosaves read `successionOpen()`. |
| H1 | Critical | **The heirloom duplicated** at every visit and every reload: a world pile was laid again whenever the heir came back, the same heirloom in each. | No world pile: the remains are a list the RECORD owns, opened as a container where they lie (`openLootList` on each mode, the inventory window over the list); what is left stays with the remains. |
| A2/B2 | High | **A dead member's save overwrote the heir**: the dead-load notice was one-shot and dropped under another window; then a save wrote the dead's character into the heir and a death recorded the heir dead. | The past is a lasting state: nothing of it is written, it dies for no one, and the window is asked every tick until shown. |
| A3 | High | **A save made before its family founded a second house** (and a dead founder played again). | `adopt` and `found` find the family a character is of in the store first. |
| A4/B7 | High | **An unanswered Succession stranded the line** (tab closed, crash, a birth whose files failed); the estate was lost with it. The birth handoff was taken at the read. | The fall waits on the record (`family.pending`, estate and bequest with it); the dead-load window offers the full Succession; a living member's load takes the mantle. The handoff is read, cleared at the born member's first save; a failed birth goes back to the menu, said, the line waiting. |
| A5/H2 | High | **Enduring dead-of-years and retired elders were playable** by loading their saves (and collected their own remains). | Any `died` or `retired` member is the past, under either model; the elder retires BEFORE the save that carries it. |
| A6/H3 | High | **Grants lost on a reload**: the estate, the heirloom taken and the rest were written to the store before any save held what they gave. A born heir's F5 before the first save lost the character. | `mergeFamily`: a save's grants to its character are the save's (`estatePaid`, `bequestPaid`, the remains' list/state/claim). The born member is saved at birth (`onBorn`), and the page's address becomes that save's load. |
| B4/F1 | High | **Online, a Bloodline death dropped the player offline** (the heir's boot lost `realm`) and permadeath was not enforced. | Until LEGACY7: online a house is Enduring (the question shows Bloodline shut; `found` forces it); an online Bloodline death is the room's respawn; a spent Enduring life rises at the last breath; no Succession is answered online. |
| H4 | High | **The death quest stuck** once the bones left the bag (sold, dropped, left on a body, put in the wagon). | The bones are always somewhere: in the list, or carried (pack, wagon, bag); gone from both, they lie again where the fallen fell. |
| U2 | High | **The tree could not be clicked** with a mouse or a finger: the view captured the pointer at the press. | Captured only once a drag passes four pixels (Chromium: a plate, a zoom button, a touch tap, a drag). |
| U3 | High | **The Succession was not answerable by keyboard** (only the first heir; nothing with no heirs). | `walkButtons`: the arrows and Tab move, Enter and Space press; focus kept across redraws, the line's end lit when no one is left. |
| B5 | Medium | **An offline Enduring death in Privateer's Hold** teleported a new character out of the tutorial. | The start-marker arm takes a death Project Legacy will raise, offline too; no online penalty offline; the toll said. |
| B6 | Medium | A switch and a retirement **went on without their save** (a deck, the descent, a full disk). | `saveNow` answers; both refuse without it, the retirement undone. |
| H5 | Medium | **An artifact** (minted `artifact: true`, no `rarity`) or a **summoned** piece could become an heirloom. | `rarityOf` and `isSummoned` in `heirloomEligible`. |
| H6 | Medium | The remains' purse was lost if not looted on the first visit. | The purse is in the list (H1). |
| H7 | Medium | The remains' gold had no ceiling; `ESTATE_MAX` was the realm birth ceiling itself (a born heir 10,100). | `REMAINS_GOLD_MAX` 2,500; `ESTATE_MAX` 9,900 (the ceiling less `STARTING_GOLD`). |
| F4/H10 | Medium | **An elder's retirement handed no heirloom down** (the arc said always one). | The bequest: the elder's heirloom, paid to whoever takes the mantle. The arc's "no quest at home" rule is corrected to what is built: every final death leaves remains. |
| F5 | Medium | "Always have descendants" no longer meant always: read only at a birth. | `newbornAllowed` reads the setting at the death too (IL_17ce). |
| U4 | Medium | A refused "Pass the mantle" closed the pause silently. | `mantleRefusal` on the card before the press; a refusal after it is said on the HUD. |
| U5 | Medium | Five tabs wrapped the pause window's strip at every desktop size. | The tab spacing a step tighter (Chromium: one row at 1280 and 1920). |
| U6 | Medium | The tree's tools sat below the fold. | The tree no taller than its own height, its tools at the top. |
| A7 | Low | A damaged record threw inside a tick and the Succession's choose. | `readFamily` holds every nested list to its shape (groups, remains, pending). |
| A8 | Low | An ended line's members played on in a closed house. | A living member's load reopens the line, said. |
| A9 | Low | Host state survived a load. | `adopt` resets the visit's state. |
| B8 | Low | The remains' rings stayed on the map with the mod off. | Gated on the switch. |
| H8 | Low | One rest offer per temple visit for every remains, and set even when not shown. | Per remains, set only when shown. |
| H9 | Low | The heirloom's name read "Dwarven Hlaalu's Longsword"; the tree showed nothing of the quest. | The house before the whole long name (`itemNameParts`, the maker's mark's shape); chips: Lies unclaimed, Carried home, At peace, Has an heir. |
| U7 | Low | The model question always said the Standard toll. | The toll a death will charge. |
| U8 | Low | An armed act waited for the way back. | `disarmFamilyPages` on every rail and tab press. |
| U9 | Low | The Succession's cards were cramped on a phone. | A two-column card under 520 px. |
| U10 | Low | Zoom buttons named by glyphs; no `aria-modal`; a header claimed the stack registration. | Named; `aria-modal`; the header corrected. |
| F2/F3/F6-F10 | Records | The arc described a classic 1:1 family window, `ui/legacyWindow.js` on G, a House page with standing and heirlooms, a Hall with a tree, an age on the character sheet, vendored pictures, `applyHeadlessChargen`/`handoff.js`, a fixed-city flag in section 3 - none of it built; the bug table's D1, S3, U2 wording; slices with no status. | `06-Systems/Legacy-Arc.md` corrected to what is built, with a status column; the README, the Registry row and the Ledger row with it. The age on the character sheet was built since (LEGACY-SHEET, 2026-10-06: `ui/familyPages.js sheetHouse` on the pause window's Stats page). |
| F8 | Departure | Max Siblings 0 with a non-zero chance makes one sibling in the mod (`Random.Range(1, 1)`); the second-key chord and the "Unknown" partner dropped; the mod's heir kept the whole purse. | Recorded (Ledger row and the arc's section 1). |

## Not changed, and why

- **The fixed city** (`?exterior`, a dev route) keeps DFU's death - FLAGGED in `scenes/world.js` and now said in the arc's
  section 3 and the Ledger row: it streams no world for an heir to be born into.
- **Online permadeath** waits on LEGACY7 (the realm's lineage and tombstone): until then the guard above stands, recorded.
