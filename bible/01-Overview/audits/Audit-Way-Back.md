# AUDIT WAY-BACK (2026-10-17) - the way back into a guild, read cold

Mac, of WAY-BACK (`01-Overview/bugs/Field-Bugs-2026-10-16d.md`, pull request #965 at d059595c): **"Audit this"**. This
page is the audit: the law the words state, the three places they are said, every word in English and the thirteen
whole languages, the tests, the mutants and the records. Each finding has its verdict here. What it changed is written
into the pages it touched, marked `AUDIT WAY-BACK` with the finding's id, and in the code beside the fix.

## How it was run

Four lanes, each a cold adversarial reader of a FROZEN head (d059595c, detached worktrees - Home.md's DO NOT FIX WHILE
THE VERIFIER IS READING; the mutation lane had a worktree of its own, since a mutant edits files in place), told to
reproduce a finding before reporting it and to end on what it checked and found sound:

| Lane | Over | How |
|---|---|---|
| L1 | the law: Glade's road end to end online - the click, the service gate, the offer flow, the pool, the +5's faction, the Roll's credit for a stranger, the drift, the join's bars, wayBackLines' gates and arithmetic | 4 findings and 2 notes, through the real modules in node; the count checked over 900 cases (rep -100..-1 x 9 owed) |
| L2 | the surfaces: the enhanced hall's well, the join's refusal on both skins (row shapes, alignment, height), the host's ceiling, the Standing page's rows for every group, the two books | 2 findings and 4 notes; the classic box laid out with a glyph stand-in, the refusal rendered through the enhanced notice |
| L3 | the words: the four English strings against the law and the catalog, 52 translated rows - placeholders, CLDR plurals, agreement, each file's own terms and register | 16 findings, every row rendered through the game's own formatter for n and owed across the plural classes |
| L4 | the pins and the record: the test's fixtures against their producers, 31 new one-site mutants beyond the 13 recorded, the 102 recorded mutants of the touched files, every claim in the records, the bible gates, 322 test files around the change | 10 findings; 13/13 recorded dead, 101/102 of the touched files' (one equivalent as recorded), 12 new survivors (5 gaps, 7 equivalent) |

Every finding was verified against the code before anything was fixed. L1-1 was reproduced by the existing pin
(`test/net/chap2_halls.test.js`, a hall writ credited to a Roll with no membership) and the SQL in `professions.js`; L2-2
by rendering the refusal through `noticeFrame`; L3's grammar by rendering each row; L4's gaps by their surviving mutants.

## What it found, and what was done

| Id | Finding | Verdict |
|---|---|---|
| L1-1 | "Online it rises at most 15 a real day" was false: the 15 bounds the Roll's claims (quests, the drift), and a chapter writ delivered at a notice board credits its guild +2 beyond it, member or not (`professions.js`, HALL_WRIT_REP) - up to three a day, so a stranger can rise 21 in a UTC day, and the writ is a road the words never named | FIXED: the pace line says what the 15 bounds and names the chapter writ's +2 beyond it (`guild.wayBack.paced`); the record's "shortest way" corrected (three days with the writs) |
| L1-2 | The drift line said "your own time" alone; online a load pays the absence on the world's clock (`save.js` payAbsenceWhenHeard -> `normalizeAcross`) - the very fact Glade asked ("wait IRL weeks") | FIXED: online the line adds "and so does time logged off" (`ctx.online`, the host's `sharedClockOn()`) |
| L1-3 | A hall a Crackdown shut (CHAP6d) told a stranger to ask its quest-giver, whose Get Quest refuses for the Season | FIXED: the shut, asked once as the popup opens (`shutAtOpen`), adds "This hall is shut this Season - the guild's halls in other regions still give work."; not read each frame, since `chapterHere` may refresh the guild book |
| L1-4 | Below 0 AND short of the guild skills, the refusal is the reputation's and the words promised 0 as the whole bar - at 0 the join refuses again, for the skills, and the line went silent | FIXED: wayBackLines takes the entity and, where rank 0's skill bars fail (`numHighLowSkills`), says them with the guild's own skills (`guild.wayBack.skills`) |
| L1-5 | The pace line shows while the Roll's first word is still awaited (`rollPaceOf` answers a live tracker) | RECORDED: ROLL-PACE's own stance - the pace applies once the claims land; no change |
| L1-6 | Unverifiable here: that every hall's block stands a Quests NPC (block data), and a temple whose building faction is a child of its god pays the god the full +5 only from the root down | RECORDED: ARENA2 only. `factionRep.js` propagateReputationChange gives the full amount to the faction the change starts at and to a parentless root - a hall whose building faction is the god's own pays the god in full; a templar order's building pays the god in full only if the player's FACTION.TXT has the god parentless, which guildVariants.js' corpus pin (type God, one child) does not say |
| L2-1 | THE FOUR HOSTS RULE: the record wired a seam into worldModes.js and named no host | FIXED: the record's THE FOUR HOSTS paragraph (with L4-5) |
| L2-2 | On the enhanced skin the refusal went through `noticeFrame`, which centres DFU's `{ text, center }` rows and sets plain strings left - one panel, two alignments | FIXED: the refusal carries the lines on the classic skin alone (`isEnhanced()`); the enhanced hall's well already says them (L2-5) |
| L2-3 | The page counted the Roll's owed (`isOnlinePage()`) where the hall did not (`rollPace`, null after a lease's stop that keeps the owed) - 9 quests against 11 | FIXED: the owed is read ungated (`standingOwedOf`, 0 offline), only the pace line waits on `paced` |
| L2-4 | The enhanced notice clips a long box (`.notice-body` overflow hidden) on a landscape phone | FIXED with L2-2: the enhanced refusal is DFU's record alone. `.notice-body` is the toasts' too (TOAST-SPLIT), and is not touched |
| L2-5 | Enhanced: the lines twice at once, the well and the refusal | FIXED with L2-2 |
| L2-6 | = L1-3 | FIXED there |
| L3-1 | "Your standing with this guild ... takes members at 0" - necessary, not sufficient (the skills), and "this guild" under a temple's or an order's record | FIXED: "Your standing here is ...", and the skills line (L1-4) |
| L3-2 | The drift line: "mends" odd beside the code's "recovers", "it" meaning the guild one line and the standing the next, the log-off unsaid, `{days}` unpluralised | FIXED: "Below 0 your standing also recovers a point {days, plural, ...} of your own time - rests and journeys count{, and so does time logged off}" |
| L3-3 | "- 2 more is on the way" | FIXED: "- # more standing on the way", the catalog's own `pause.guilds.owed` |
| L3-4 | de: "noch 1 sind unterwegs" | FIXED: "noch # ausstehend", the file's own `reputationOwed` |
| L3-5 | cs: "dalších 1 je na cestě" | FIXED: "ještě # na cestě" |
| L3-6 | it: "altri 1 in arrivo" | FIXED: "ancora # in arrivo" |
| L3-7 | bg: "още 2 е на път" | FIXED: "още # на път" |
| L3-8 | nb: "hvert fullførte" (weak form), "deres" for the guild, "1 oppdrag til når 0", "På nett" where the file says Online | FIXED |
| L3-9 | ru: " - " where the file uses " — ", "В сети" where it says "Онлайн", "её задания" feminine under a temple or an order | FIXED |
| L3-10 | The quests row's possessive, worst on the Standing page under a temple or an order: fr "son donneur", it "le sue", es "sus", ro "îi dă", pt-BR "dela", bg "ѝ", ko "길드의", da "dets", de "ihren" | FIXED: each says "there" (y, lì, allí, acolo, ali, там, 그곳의, dér, dort, der, di sana, tamního) |
| L3-11 | da: "1 opgave mere når 0" | FIXED: "for at nå" |
| L3-12 | `{days}` unpluralised in every language ("every 1 days") | FIXED: a plural in English and in all thirteen, each with its own day word |
| L3-13 | "A stranger may ... your standing" switches person | FIXED: "As a stranger you may still ask ..." |
| L3-14 | DFU's "reputation" in the record above "Your standing" in the lines | RECORDED: the catalog's split - "standing" in sentences, "Reputation" as a label |
| L3-15 | The record quoted the 11-quests line beside the 10-owed pace line, a pair that cannot appear together | FIXED: the record says 9 beside 10 owed |
| L3-16 | es uses " - " where the file prefers parentheses | FIXED: es sets the count, the log-off and the owed in parentheses |
| L4-1 | Nothing pinned the book the Standing page reads (`activeMemberships`): `{}` survived, under which Mara's member read Arkay's way in | FIXED: pinned (Mara's member, Arkay below 0, no line); mutant recorded |
| L4-2 | Nothing pinned the page's online owed | FIXED: the owed is ungated (L2-3) and the page's count pinned with 10 owed |
| L4-3 | The "offline nothing is owed" pin called without a ctx, which no real caller does | FIXED: superseded by L2-3; every pin names its ctx, the offline cases by omission and the online ones by `{ online, paced }` |
| L4-4 | The stranger's pool pin read back its own input: a hand-built guild surface and `getGuildFactionId: () => factionId` | FIXED: the bridge's own `offerGuildSurface` and the host's `guildFactionIdOfGroup`; mutant recorded (the group's faction 0) |
| L4-5 | = L2-1, and exterior.js builds the modes too, with no Roll | FIXED there |
| L4-6 | A stitched quote of ROLL-PACE ("a stranger's quests ... banked it before the membership began") | FIXED: its own sentence, "the stranger banked it before the membership began" |
| L4-7 | A bare C# line in the Ledger row beside our own cites | FIXED: `DaggerfallGuildServicePopupWindow.cs:497-525` |
| L4-8 | "Not under a kingdom" was pinned only by fb1009e's fixture | FIXED: the page pin carries a Province row below 0; mutant recorded (the null guild gate) |
| L4-9 | `quest.js`'s re-export of the two constants has no importer; the one-home ratchet reads only `^export (const\|let\|function\|class)`, so a plain `const` duplicate passes | RECORDED: the re-export keeps `quest.js`'s exports as they were; the ratchet's blind spot is older than this slice |
| L4-10 | The host pins are exact source lines - strict, and brittle to a reformat | RECORDED: the house's own form for a host's wiring (PROMO-NOW's, ROLL-PACE's) |

## After

`test/systems/guild/fb1016d_wayback.test.js`: 7 (6 before). `tools/mutants/fb1016d_wayback.json`: 24 records, 24 dead
(13 before - the records whose lines moved re-aimed, eleven new, among them the five gaps L4 found). Six port strings
(two new: `.skills`, `.shut`), all six redrafted in the thirteen whole languages, each row rendered through the game's
formatter across its plural classes before it was merged.
