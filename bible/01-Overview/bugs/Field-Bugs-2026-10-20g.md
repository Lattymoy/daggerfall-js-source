# FIELD BUGS 2026-10-20g - SWAP-CYCLE: a class skill swap cycled past the level's ceiling

Mac, 2026-10-20: *"REPEC BREAKING LEVEL LIMIT / How the swap cycling works, citing the files and lines in the game
source. / How far it goes: about level 224 / this is the problem lol"*. Read on the code as it stood at main's
`6224441d5`, and measured there with the real producers (chargen, `swapSkill`, the raise pass) before anything moved.
Named 20g: main holds 20 through 20f (20f, the Elite Breach read to its roots, landed while this was in review as 20f).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Mac: a swap cycle breaks the level limit, "about level 224" | SKILL-SWAP (`Field-Bugs-2026-10-19b.md`) moved both stored level sums by whatever a swap moved the class's sum, a drop as well as a rise. A trained class skill given up for an untrained one kept its training on the level, and its place in the class earned the same levels again: 223, measured, where the class's own lists top out at 31 | fixed (SWAP-CYCLE) |

## SWAP-CYCLE: a skill's training leaves with it

`src/systems/skillSwap.js` (`heldSum`, `swapShortfall`, `swapSkill`), `src/systems/advancement.js` (`raiseSkills`),
`src/ui/growth/specGuide.js` (the model's `shortfall`, `drawSkillSwap`'s warning).

HOW THE CYCLE WORKED. The level is Daggerfall's: `calculatePlayerLevel(starting, current)` is `floor((current -
starting + 28) / 15)`, the two stored sums anchored at creation, and the current one is the class's skills alone -
`levelUpSkillSum`, the primaries, the majors less the lowest, the highest minor. In DFU nothing changes the class's
lists, so the sum can never pass six skills at 100 (600), and the level never passes `calculatePlayerLevel(starting,
600)`. SKILL-SWAP let one unmastered class skill be traded for one outside the class, and to keep the level still it
moved BOTH sums by the swap's move (`swapSkill`, lines 85-90 at `6224441d5`: `const moved = levelUpSkillSum(entity) -
before;` and both sums `+ moved`). A rise was right - a trained outsider brought in paid no level. A drop was the bug:
give up a primary at 100 for a skill at 5, and both sums fell by 95, so the 95 points stayed credited on the level while
the primary place stood empty to credit the next 95. Train the newcomer to 100, give it up for another untrained skill,
and again. Thirty-five skills, twelve in the class: every one of the 35 could be trained once in a counted place, and
the level read the whole tally instead of the six places DFU's sum has.

HOW FAR IT WENT (the probe, real chargen and the real `swapSkill`, online so Master Skills lifts the 95 lock): a custom
class at creation (starting sum 156) tops out at level 31 with every class skill at 100. Cycling every outsider through a
primary place and training it to 100 took it to 177 (23 swaps); training every one of the 35 skills only while it
counted, then the five masteries to 200, took it to 223 (41 swaps, 4,100,000 gold). Mac's "about 224" is that ceiling.
Nothing online refused it: the judge asks of a level only that it lie between 1 and 1000 (`judge.js` characterFindings,
JUDGE_LEVEL_MAX) and agree with the summary, and every step was the save's own honest write.

THE LAW NOW. The stored current sum is the sum the level stands on: the highest the class's sum has reached. No swap
lowers it, and no raise does either - `raiseSkills` stores the class's sum only where it is higher
(`advancement.js:"if (raised.length) { const sum = levelUpSkillSum(entity); if (!(entity.currentLevelUpSkillSum >= sum)) entity.currentLevelUpSkillSum = sum; }"`).
A swap reads that sum first, caught up with the class's own where a point no raise has stored yet stands (intensive
training's SetPermanentSkillValue, `worldModes.js` applyIntensive), and moves both sums only by what it takes the class's
sum ABOVE it (`skillSwap.js:"const rise = Math.max(0, levelUpSkillSum(entity) - held);"`). So:

- a trained skill given up for a less trained one moves nothing: the level and its progress stand, and the class's skills
  make the ground up before the next level comes any closer;
- a trained outsider brought in wins back the ground an earlier swap gave up first, and only the rise above it moves
  both sums - it pays no level, as SKILL-SWAP meant;
- a swap undone is no swap at all: the ground comes back whole, a point trained between included;
- no sequence of swaps and raises takes the stored sum past the most the class's sum has ever been, and that is at most
  six counted skills' worth - so the level's ceiling is DFU's again, `calculatePlayerLevel(starting, 600)` and the
  softcap's quarter points past 100 for a mastered skill. A swap that brings a trained outsider in can only lower it
  (the starting sum rises by what it absorbs).

THE DEPARTURE IN `raiseSkills`. DFU's PlayerEntity.RaiseSkills calls SetCurrentLevelUpSkillSum, which stores the sum as
computed. Here a raise never stores it lower than it stands. For a class as made the two are the same - a permanent skill
only rises, so DFU's sum never falls - and the one other fall the port has, Master Skills switched off offline (a mastered
skill past 100 read as 100), levels at exactly the sums it did: the next level still needs the class's own sum to reach
its threshold, which lies above the stored one. What changes there is the progress bar, which stands where it stood
instead of reading a fraction of a lower level. Port-Ledger section A, SKILL-SWAP's row.

THE FORM SAYS IT. Where a swap would leave the class's skills under the sum the level stands on, the Growth tab's swap
form says how many points they make up first, beside the picks and again in the ask: *"Your level stays, but your class
skills then earn nothing toward your next level until they make up 94 points."* (`growth.swap.ground`, drafted in the
thirteen whole languages). On Oblivion's bar the sum levels nothing, and nothing is said.

NOT DONE: a character who cycled before this landed keeps the level it has - a level is never taken away (DFU's never
falls, and nothing here lowers one). Its stored sums are the old law's and stay as they are, so it earns nothing more
until its class's sum passes the one it stands on, which a cycled character's (600 at most) already is. Taking levels
back from such characters is the owner's call, not this slice's.

`test/systems/swapcycle.test.js` (6): the cycle driven through the real raise pass ends at the class's ceiling, 31; the
ground stood and made up; a swap undone; a trained skill brought in after a drop; the catch-up; the form's number. The
form's warning drawn, in the ask and beside the picks: `test/ui/growth/fb1019b_swappage.test.js` (SWAP-CYCLE THE GROUND,
SAID). SKILL-SWAP's own level pin re-pinned to this law (`test/systems/fb1019b_skillswap.test.js`, "the level does not
move"). `tools/mutants/swapcycle.json` (7, 7 dead); `tools/mutants/fb1019b_skillswap.json` re-aimed by content (10, 10
dead).
