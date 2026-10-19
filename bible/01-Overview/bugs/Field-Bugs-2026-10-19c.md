# FIELD BUGS 2026-10-19c - the crafting odds, said in plain words

One question from the Discord, handed over as a screenshot of the Anvil's odds line, then the owner: "Can we make it
make more sense. More palatable". Read on the code as it stands at main's `9e00d52e9`. Renumbered 19c: main took
`Field-Bugs-2026-10-19b.md` (the #suggestions batch).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Shines, under *Your rank 28, margin 18: Standard 50 \| Fine 40 \| Superior 10. A clean heat is a step better.*: "so what does margin and the rest mean? I'm a little confused" | Not a defect in the law: the line spoke the record's words - "margin", "a step", "clean" - and no screen says what one is | PLAIN-ODDS |

## PLAIN-ODDS: every station's quality odds say what they are

`src/ui/professions/profPages.js` - `oddsText` and the seven odds lines: the Anvil's, the Workbench's, the Loom's three
(its own, a Tailor's, a Leatherworker's), the Mason's Bench's and the Jeweller's Bench's.

FOUND. Every station that rolls a quality (`06-Systems/Professions-Arc.md` 9.2) shows the roll's odds under the recipe
in one line, and the line was the record's shorthand: *margin* is the crafter's rank minus the recipe's, *a step* is one
quality up after the roll, and *clean* is the station's act with every press true (`heatAct.js`'s report: three
strikes, every one on the band). The station's rank stands in its head line (`rankLine`) and the recipe's in the
recipe's (`craftHead`), but nothing tied either to the odds, and the odds were bare numbers - "Standard 50" read as
anything but a chance in 100.

CHANGED. Each line now names itself, says which way its odds move, and says what the act asks, in the station's own
words for the act. The Anvil, as Shines saw it:

*Quality chances: Standard 50% | Fine 40% | Superior 10%. They get better the further your rank (28) is above the
recipe's (10). Land every strike while the glow is in the band to raise the result one quality.*

- `oddsText` writes each quality's chance with its `%`.
- The margin leaves the screen as a number: the line names the two numbers it is made of (`{rank}`, `{need}` - the
  recipe's rank) and says the odds rise as the first passes the second.
- "A clean X is a step better" says what makes it clean: the Workbench's *Draw the plane true to the grain* (the
  plane's own word, `prof.page.plane.clean`), the Loom's *Press every stitch on the beat*, the Mason's *Hit the marked
  line with every strike*, the Jeweller's *Stop every turn where the stone catches the light*.
- The specialisation's step is its own sentence - *Being a Tailor raises clothing one more.*, *Being a Leatherworker
  raises leather one more.* - because `qualitySteps` adds it whether or not the act is clean.
- The town Apothecary's steps move from a parenthesis after the odds to a sentence after the act's: *The town's
  Apothecary raises it one more.* (or *# more*).

No law moved: `QUALITY_ROWS`, `qualitySteps`, the service's steps and the acts are untouched. Not said, to keep the
line short: Quick craft skips the act and so its step (9.4), and Gentle acts make no act clean.

THE WORDS IN EVERY LANGUAGE. The seven keys' English moved, and their arguments with it (`{margin}` out, `{need}` in),
so every language that held them - the thirteen whole ones and fi, ja and pl, still drafting - holds them drafted again
in-session through `tools/l10nInSession.mjs`, its placeholder law checking each (112 rows, none refused). The quality
names inside `{odds}` (`QUALITY_NAMES`) stay English in every language, as they were before this slice.

PINS. The lines' old pins read the new words (`fb1018f_craftlimit`, `fb1015f_firstcraft`, `prof3_client`,
`prof10_client`, `prof11_client`), and the three that had none are pinned now: the Workbench's (`prof4_client`) and
the Loom's Tailor and Leatherworker lines, each beside the plain stitch's for the other specialisation
(`prof7_client`). A `need` taken from the margin instead (`rank - r.rank`) fails a pin at every station, each mutant
run by hand: the Anvil's in `prof3_client`, the Workbench's in `prof4_client`, the Loom's in `prof7_client`, the
Mason's in `prof11_client`, the Jeweller's in `prof10_client`. AUDIT PROF-541's mutant of the Apothecary's words
(`tools/mutants/prof10.json` PROF-541-R2-C6-unsaid) is aimed at the new sentence - the steps left unsaid - and dies, as do
its two neighbours.
