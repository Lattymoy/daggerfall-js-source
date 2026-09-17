# Oblivion Remaster Like Leveling - 1:1, and the first Morrowind mod

**ORL1, 2026-09-17.** Mac: *"So I've been analyzing morrowind mods to
integrate and the first one I'd like to add is this. On new game, I
want the player to receive a notification on which leveling system they
would like to use."*

`OblivionRemasterLikeLeveling 0.5.3` (Nexus Morrowind 56569) ported 1:1
from the author's own Lua, vendored whole in
`vendor/oblivion-remaster-leveling/`. The port is
`src/systems/oblivionLeveling.js` (the law), `src/ui/virtueLevelUp.js`
(the level-up window) and `src/ui/levelingChoice.js` (the question a new
character answers). Pinned by `test/orl1_leveling.test.js` (44); mutants in
`tools/mutants/orl1.json` (72: 67 dead, 5 equivalent as recorded). Registry row: `01-Overview/Mod-Registry.md`.

---

## THE FIRST MORROWIND MOD, AND WHAT THAT CHANGES

Every vendored MOD in the registry so far is a Daggerfall Unity mod: a
`.dfmod` bundle, a `*.dfmod.json` manifest, C# read off its IL or its
author's repository. (Eleven of the nineteen directories carry such a
manifest; the rest are not mods - Daggerfall Unity's own shipped data,
a font, Mac's own project, a road table.) This one is **OpenMW Lua for
Morrowind** - the first vendored MOD that is not a Daggerfall Unity one
- and four things follow from that:

1. **There is no decompile.** OpenMW runs the Lua as shipped, so the
   source in `vendor/` IS the mod. Every function in the port names the
   Lua member and line it restates, and a reader can check any of them
   against a file in this tree.
2. **The registry's manifest gate does not cover this row.**
   `test/hard4_registry.test.js` reads `*.dfmod.json` for the version
   and author cells and skips a directory that has none. So the version
   cell (`0.5.3`) is an unchecked assertion in that gate - and is
   checked instead by this mod's own suite, against the author's
   `README.upstream.md` changelog heading and the Lua's own defaults.
3. **THE MOD declares no maxima** - not the engine. OpenMW's `number`
   renderer takes a `max` and enforces it
   (`files/data/scripts/omw/settings/renderers.lua`, the 0.49 branch:
   `if argument.max and number > argument.max then return end`, and
   `max = nil` in its own `defaultArgument`); this mod's `settings.lua`
   simply passes a `min` and stops. The port's store reads a numeric key
   only when it has BOTH (`isIntKey`), and a key with one bound would
   silently become a checkbox. **Every maximum in the port's entry is
   therefore the port's**, and they are listed under *Departures* below.
   The first version of this page said the ENGINE had no `max` and used
   that as the warrant; the deep audit fetched the file and it does.
4. **The mod's art is Morrowind's.** Its window is MWUI flex boxes over
   `icons/k/attribute_*.dds`, a gold-coin purse bar, per-level art
   chosen by specialisation and `Music/Special/MW_Triumph.mp3`.
   Daggerfall has none of it. The port takes the mod's LAW and draws it
   in the port's own text idiom - see *The two screens*.

**Provenance is open.** The archive states no licence and names no
author: no `LICENSE`, no script header, an empty author field in the
`.omwaddon`. Mac handed the archive over, which is the act that settles
seven of the other ten `RECORD OPEN` rows (the remaining three read
"granted to Mac" with no hand-over), and the README's permission line is
still a prompt. **The author's NAME is part of what is owed
here, not only the receipt.**

---

## THE WHOLE DATA LAYER IS ONE NUMBER

`OblivionRemasterLikeLeveling.omwaddon` is 487 bytes and carries exactly
one record:

```
GMST  NAME "iLevelupTotal"  INTV 0x64
```

That is `LEVELUP_TOTAL = 100`, the size of the bar. Everything else the
mod does is in 1,314 lines of Lua (`wc -l` says 1,313: `templates.lua`
ends without a newline, so the tool does not count its last line).

---

## THE LAW, AGAINST THE LUA

### L1 - the bar (`player.lua:29-51`, `helper.lua:124-142`)

Every skill level-up puts points in. The handler's whole body sits
inside `if constants.MAX_SKILL_VALUE > skillbase`, so **a skill standing
at 100 contributes nothing** - that is the 0.5.3 fix, and the author's
changelog names the bug it closed ("Infinite Leveling increase and roll
over after a skill reach 100"). The value is the skill's tier. Then:

```
newProgress = progress + value
if newProgress > 100:            # STRICTLY greater
    rollUp  = newProgress - 100
    added   = value - rollUp     # the bar lands exactly on 100
else:
    added   = value
```

Landing exactly on 100 rolls nothing over; only passing it does. The
overflow accumulates in `levelRollUp` and is carried by the save.

Port: `addSkillProgress`, called from `advancement.raiseSkills` **inside
the cap gate and before the raise lands** - OpenMW calls its handler
with the value the skill is leaving, and a raise the port's cap refuses
is a skill that never levelled up, which OpenMW would not have called
the handler for at all.

### L2 - the roll-over on commit (`helper.lua:144-155`)

```
level += 1
if rollUp >= 100: progress = 100; rollUp -= 100
else            : progress = rollUp; rollUp = 0
```

A roll-over big enough to fill the next bar **leaves it full**, which is
what immediately re-offers the next level. Port:
`rollOverLevelProgress`.

### L3 - the purse, and the clamp that makes it spendable (`player.lua:638-677`)

Twelve points by default. For each attribute the mod computes what it
could absorb, in purse points: `limit * offset` when there is headroom
past the limit, `headroom * offset` when there is not, 0 when it is
maxed. Then two clamps, and the second is the subtle one:

- if the character cannot absorb the whole purse, the purse **shrinks**
  to what they can absorb;
- otherwise any part of the purse that could only go into **Luck** is
  rounded DOWN to a whole multiple of Luck's cost.

The reason is the window's own refusal: OK will not close while a single
point is unspent, so a remainder smaller than one Luck point would trap
the player in the dialog for ever. Port: `modVirtuePurse` - and see
departure 6, because **the mod's own clamp does not finish the job**.

### L4 - what the buttons allow (`player.lua:592-619`)

Plus is **hidden** - not greyed - when any of: the purse is empty; the
purse cannot pay this attribute's cost; this row is already at its limit
(5, or 1 for Luck when the mod may not raise it); this row is at 100; or
the "at most N attributes" count is used up and this row is not one of
them. Minus is shown exactly while this row has something to give back.
Port: `canRaiseAttribute` / `canLowerAttribute` - a predicate rather
than a redraw, so the window and the headless path obey one rule.

### L5 - the commit (`player.lua:532-552`)

The purse must read zero, or the OK is refused with the author's own
line ("You must distribute all your points to continue."). Then the
attributes land, then health, then the level and the roll-over. Port:
`commitVirtueLevelUp`.

### Settings (`settings.lua`, `l10n/en.yaml`)

| key | default | min | the port's max | whose |
|---|---|---|---|---|
| `attributePoints` | 12 | 0 | 60 | the mod's |
| `maxUpdatableAttribute` | 3 | 2 | 8 | the mod's |
| `allowLuckIncrease` | true | - | - | the mod's |
| `luckIncreaseCost` | 4 | 1 | 20 | the mod's |
| `primarySkillsImpact` | 8 | 0 | 100 | **the port's** |
| `majorSkillsImpact` | 8 | 0 | 100 | the mod's |
| `minorSkillsImpact` | 6 | 0 | 100 | the mod's |
| `miscSkillsImpact` | 2 | 0 | 100 | the mod's |

Descriptions in the Mods pane are the author's own English strings, as
every other mod's are. `Enabled` is the port's, as every vendored mod
carries one.

---

## WHAT MORROWIND HAS THAT DAGGERFALL DOES NOT

Three of the mod's laws have no Daggerfall twin. Each is a decision, and
each is recorded rather than smoothed over.

### 1. Skill tiers: Morrowind has three, Daggerfall has four

Morrowind: Major (5), Minor (5), Misc. Daggerfall: Primary (3), Major
(3), Minor (6), Misc (23).

**The port keeps the mod's three numbers on the tiers whose COUNTS
match.** Daggerfall's primary and major together are six skills where
Morrowind's major is five; Daggerfall's minor is six where Morrowind's
minor is five. So primary and major both default to the mod's 8, minor
to its 6, misc to its 2 - and a character's bar fills at the rate the
mod intended for a comparable spread of skills.

`primarySkillsImpact` is the port's own fourth knob so a player who
wants their primaries to outrun their majors can say so. The mod has no
such key because Morrowind has no such tier, and its description says
so in the pane.

### 2. Health: the mod's rule is Morrowind's engine, not the mod

`helper.lua:272-282` raises health by `Endurance * fLevelUpHealthEndMult`.
That is not something the mod invented - it is **Morrowind's own
level-up rule**, which the mod has to restate because it took the
level-up dialog over. Daggerfall's own rule is FormulaHelper's
hit-points-per-level roll, which this port already carries verbatim.

**So the virtue path raises health the Daggerfall way**
(`chargen.hitPointsPerLevelUp`). Porting a Morrowind constant into
Daggerfall would be importing the wrong game's engine under cover of
porting a mod.

**AND IN DAGGERFALL'S POSITION, WHICH IS NOT THE MOD'S.** The mod calls
`increaseHealth` after its attribute loop, so Morrowind's formula reads
the Endurance the player has just bought. `advancement.applyLevelUp`
does the opposite: it rolls hit points BEFORE it hands out the pool, on
the endurance the character came in with ("PERMANENT endurance,
verbatim", audit F8). The first cut of this port took the mod's ORDER
with Daggerfall's FORMULA and claimed in a comment that the two agreed -
they do not, and the review caught both the divergence and the false
claim. A virtue character who spent five points on Endurance was
collecting the hit points for them in the same breath, out-earning the
identical character on the Daggerfall path at every level whose spend
crossed a multiple of ten. The roll comes first here too, so the two
lanes hand the same character the same hit points.

### 3. When you level: Morrowind makes you sleep

The mod rides OpenMW's rest-to-level flow. Daggerfall levels you at the
character sheet the moment the skill check raises the flag, and this
port already does. **The bar therefore raises the same `readyToLevelUp`
flag the Daggerfall path raises**, and every host's existing level-up
door opens on it unchanged.

---

## THE TWO SCREENS, AND WHY NEITHER IS A NATIVE WINDOW

THE NATIVE-WINDOW RULE (`Home.md`) says every drawn element of a native
window must cite its DFU source before it ships, and that an element
whose value is unknown **does not draw**. Neither of these screens has a
DFU source: Daggerfall has no purse-of-virtues dialog, and it never
asked anyone which leveling system they wanted.

So neither claims any native geometry. Both are the **text idiom** the
port already ships for `LevelUpScreen` (`charsheet.js`): a dimmed full
screen and `drawText` rows, no ARENA2 art, the same in both skins. The
parchment box (`ui/messageBox.js`) would have been the right frame for a
question Daggerfall DID ask - but it needs `SPOP.RCI`, and a screen that
stands between a finished character and the game must not be able to
fail to draw.

**And the question reads the settings, rather than a number written into
it.** `attributePoints` is a slider from 0 to 60 that the Mods pane
exposes, and the first cut of the screen said "twelve virtues" whatever
it was set to. This is the one screen a character can never come back
to, which makes it the worst screen in the game to be wrong on; it is
built from the live settings now, and says so when the purse is zero.

**The window is not the Oghma Infinium's rollout.** That artefact is
DAGGERFALL'S OWN - thirty points, no level, no health, from a book the
mod has never heard of - so it is levelled by Daggerfall's law whichever
system the character uses. `ui/charSheetDoor.js` keeps the Oghma on the
port's own rollout in both lanes, and `CharSheet._mountStatsRollout`
carries the other half of that gate.

**THE REASON THIS DEPARTURE USED TO GIVE WAS FALSE, in four places at
once** (here, `ui/virtueLevelUp.js`, `ui/charSheetDoor.js` and the
Ledger row): that thirty points "cannot be spent under at most three
attributes, at most five each anyway". They can, at the mod's own
shipped defaults, and the port's own solver says so - Personality +5,
Speed +5 and Luck +5 at four apiece is 5 + 5 + 20 = 30, three rows,
exactly spent. The departure stands on the sentence above it, which is
the one that was always doing the work; the arithmetic was decoration,
and it was wrong. (ORL1's deep audit.)

---

## WHAT THE AUTHOR'S CHANGELOG FIXED, AND WHERE EACH ONE LIVES HERE

`README.upstream.md` is carried for this: four fixes across three
releases, and the port keeps every one. The vendor README promised that
this page named them and it named one, which ORL1's deep audit caught.

| release | the author's line | where the port keeps it |
|---|---|---|
| 0.5.1 | "Extra point added to level up progression while upgrading a major or minor skills" | `addSkillProgress` adds the tier's impact ONCE and returns what it added; the roll-over is taken out of the same value rather than added beside it |
| 0.5.1 | "Level Up progression not rolled over if the roll over is greater than one level" | `rollOverLevelProgress` leaves the bar FULL when the carry is a whole level or more, which immediately re-offers the next one |
| 0.5.2 | "No Health increase on level up" | `commitVirtueLevelUp` raises health on every commit - by Daggerfall's roll, in Daggerfall's position (departure 2) |
| 0.5.3 | the handler reads the skill's OUTGOING value | `advancement.js` calls `addSkillProgress` BEFORE the raise lands, inside the cap gate, because that is where OpenMW calls the mod's handler |

---

## THE SEAMS

| where | what it does |
|---|---|
| `systems/oblivionLeveling.js` | the law: the bar, the tiers, the purse, the predicates, the commit, the headless spend |
| `systems/advancement.js` | asks `usesVirtueLeveling` once per skill check; feeds the bar instead of the sum; the DFU arithmetic is untouched |
| `ui/charSheetDoor.js` | mounts `VirtueLevelUpScreen` in BOTH lanes for a virtue character (Oghma excepted) |
| `ui/charsheet.js` | the classic sheet's rollout stands down while a virtue level-up is owed |
| `systems/chargenSession.js` | the question, wrapped around the wizard so every chargen host gets it; `finishChargen` sets the answer beside the DFU level anchor |
| `systems/save.js` | `levelingSystem`, `levelProgress`, `levelRollUp` |
| `systems/classicSave.js` | a classic import is a classic character |
| `systems/modSettings.js`, `systems/features.js` | the eight knobs and the tile, under the new `character` group |

### THE FOUR HOSTS

- `scenes/world.js` - **wired**, through `createChargenWindow`.
- `scenes/exterior.js` - **wired**, same door.
- `scenes/dungeonContext.js` - **wired**, same door; its font-less
  level-up escape and its font-less CREATION path were both wired too.
- `scenes/worldModes.js` - **accounted for, asks nothing**: a new game
  never begins inside a building and this host runs no chargen at all.
  It does LEVEL a character, and **both** of its level-up arms were
  wired.

### The paths that are never asked

`applyHeadlessChargen` (the `?class=` skip), `chargenInputFallback` (no
font art) and the classic-save import all set the classic system
explicitly. A question nobody is there to answer must not be asked and
must not be guessed at - and `usesVirtueLeveling` reads an absent field
as classic anyway, so an old save loads as exactly the character it was.

---

## DEPARTURES, IN ONE LIST

1. **Daggerfall's hit-points-per-level** in place of
   `Endurance * fLevelUpHealthEndMult`. Reasoned above.
2. **A fourth impact knob** (`primarySkillsImpact`) for Daggerfall's
   third tier of chosen skills.
3. **Every maximum in the settings is the port's.** THE MOD declares
   only minimums - OpenMW's renderer takes a `max` and this mod does not
   pass one - and the port's store needs both bounds or a numeric key
   reads as a boolean. The chosen ceilings (`attributePoints` 60,
   `maxUpdatableAttribute` 8, `luckIncreaseCost` 20, the impacts 100)
   have no upstream warrant and clamp what a player may set.
4. **The look is not ported** - the mod's Morrowind art, its level-up
   pictures, its GMST tooltips and its triumph music are Morrowind's.
   The port plays its own level-up fanfare and draws text.
5. **The Oghma Infinium stays on Daggerfall's rollout**, in both lanes.
6. **A SECOND CLAMP ON THE PURSE, because the mod's first one can mint
   points its own window will not let you spend.** `calculateAttributepoints`
   sums what all EIGHT attributes could absorb and never looks at
   `maxUpdatableAttribute` - but the window only lets three rows be
   raised, and it refuses to close on an unspent point. With the mod's
   own defaults and Luck barred from rising, a character at 98 across
   the board is minted 12 points that three rows can take only 6 of, and
   the level-up window becomes a wall with no way out. **The mod has
   that hole; the port must not ship it.** So `modVirtuePurse` is the
   mod's arithmetic kept whole, and `virtuePurse` clamps its answer to
   the most a legal spend can actually pay for.

   **THE FIRST VERSION OF THIS CLAMP WAS ITSELF A WORSE BUG, and the
   adversarial review caught it.** It measured "what can be placed" by
   running a lowest-value-first greedy and subtracting what that greedy
   failed to place. Lowest-first is not a maximising packing under the
   mod's own predicate: at the ceiling the lowest-valued rows are the
   ones with the least headroom, so the greedy spent the three-row
   budget on rows worth a point each and called the rest unplaceable.
   Eight attributes at 98 - **the shipped defaults, no settings
   changed** - mints 12, can legally take all 12, and was handed 6. Half
   a level-up destroyed, silently, on a state any long-lived character
   reaches. The pin that was supposed to hold this asked only that the
   purse could be spent to zero, which 6 satisfies, so it could not see
   it; two of the review's four lenses found it independently.

   The clamp does not guess now. Choosing at most N rows and a delta in
   each is a bounded knapsack with a row-count constraint, over eight
   rows, at most five points apiece and a purse of at most sixty - a
   state space small enough to solve exactly, every time
   (`virtueSpendPlan`). The purse IS a reachable cost by construction,
   and the plan that reaches it is what the headless paths spend. The
   pin asks for the MAXIMUM now, against an independent exhaustive
   search, over four row budgets x four Luck prices x both Luck switches
   x five Luck values x five spreads.

---

## KNOWN INTERACTIONS, RECORDED RATHER THAN FIXED

**Level feeds skill speed.** `skillUsesForAdvancement` multiplies by
`1.04^level`. A system that levels a character faster or slower than
Daggerfall's therefore re-tunes every skill's advancement rate as a
side effect. The mod has no equivalent coupling in Morrowind, so there
is nothing to port here and nothing to correct against - it is simply
true of this port that the two systems do not pace skills identically
at the same level, and the settings are where a player tunes it.

**Online forces every mod on.** `onlineForcedModSetting` returns true
for any vendor's `Enabled` on an online page (OL1). For this mod that
means every online player is ASKED the question at creation and cannot
decline being asked. They can still answer "Daggerfall", so no online
character is forced onto the mod's rules - but the question appears.
**This is a lane rule nobody has ruled on for a leveling system, and it
is Mac's to rule on.**

**One level per commit.** The commit does `level += 1`, never a jump, as
the Daggerfall path does. A roll-over large enough to fill the next bar
leaves the bar full and the next skill check re-offers the level - the
same shape AUDIT 23's `entity-9` records for the DFU path.

---

## THE REVIEW, AND WHAT IT CHANGED

Four adversarial lenses read this slice against the vendored Lua and the
port's own doctrine - fidelity, edge cases, the seams, the pins. What
came back was not a list of nits:

- **the port's own purse clamp destroyed up to half a level-up** at the
  shipped defaults (departure 6), found by two lenses independently and
  reproduced by hand before it was believed;
- **the health roll read the endurance it had just sold you**, and the
  comment beside it claimed the opposite (departure 2);
- **the new-game question named a purse the settings might not hand
  out** - a literal "twelve virtues" over a slider;
- **the worked example that justified departure 6 did not reproduce**;
- **every citation into the vendored Lua was a few lines out**, because
  they were written off a display rather than off the file, and several
  landed inside a different function of the same file;
- **the page's headline count of the mod's size was 71 lines wrong.**

Every one is fixed above. The shape worth keeping is the first: a pin
that asks for a WEAKER property than the law needs will pass over the
law being broken. "The purse can be spent to zero" was true of a purse
half the size it should have been.

**AND THE PROGRAMME'S OWN RULE WAS BROKEN TO GET HERE, knowingly.**
`Home.md` says DO NOT FIX WHILE THE VERIFIER IS READING: an adversarial
review reads the WORKING TREE, and fixing its findings while its verify
pass is still running makes every verdict come back "refuted - the code
you quote does not exist", which is indistinguishable from "the finding
was wrong". That is exactly what happened here - the verify verdicts on
this review are worthless and are not the evidence for anything above.
What IS the evidence is that each finding was reproduced by RUNNING the
shipped code before it was believed (the purse numbers in departure 6
are measured, not argued), and that the two independent lenses agreed.
The right order next time is: let the verify pass finish, or hand the
verifiers a snapshot.

## THE DEEP AUDIT, AND WHAT IT CHANGED (2026-09-17)

Mac: *"Let's do a deep audit ensuring perfection."* Eight adversarial
lenses read the slice - the Lua against the law, the solver, the seams,
the pins, the records, the screens, the doctrine, the regression surface
- and this time the tree was FROZEN while they read, which is the rule
the first review broke. Twenty-eight findings; every one below was
reproduced by running code before it was believed.

**THE WORST TWO WERE BOTH SILENT, AND BOTH ABOUT A THING WORKING
"CORRECTLY" WHILE BEING WORTH A QUARTER OF WHAT IT SHOULD BE.**

*The question's picture and its click target were on different pixels.*
`LevelingChoiceScreen` painted from the CANVAS ORIGIN at hud scale and
hit-tested in LETTERBOXED 320x200 native units. Through `townTalk` -
which is how `world.js` and `exterior.js` both route a pointer - those
two spaces are `(ox, oy)` apart, and the offset is zero only on an exact
16:10 canvas. Measured over each painted option, pixel by pixel: on
1366x768 a click on the Oblivion option selected DAGGERFALL on 27% of
its area, on 1024x768 29%, on 1512x982 21%, and on 800x600 59% - where a
click anywhere on the Daggerfall option found it 3% of the time. **The wrong leveling system, chosen silently, on
the one screen a character can never come back to.** The first review's
pointer fix was real and this is why it did not work; the click probe
runs at 1400x900 and clicks a point that happens to fall inside the
overlap, so it could not see it. Both screens draw through
`nativeMetrics` now, which is the idiom every other clickable native
window already used.

*The exact solver maximised the wrong thing.* `virtueSpendPlan`
maximised the COST paid and, among plans that paid the same cost, kept
whichever the table reached first - the one with the fewest rows. A
Luck point costs four, so at the shipped defaults twelve of purse was
planned as **LUCK +3**: three attribute points where twelve were
affordable. The purse was right, the spend was legal, the pin asserting
maximality passed - it asked for the most PURSE and got it. Every
headless path spends that plan, the font-less escape included. The DP
carries the point total beside the delta now and prefers more points at
equal cost, checked against an independent exhaustive search.

**AND ONE THE PLAYER WOULD HAVE FELT WITHOUT EVER SEEING.**
`checkForVirtueLevelUp` opened with `if (entity.readyToLevelUp) return
false`, so an owed level was announced ONCE. DFU's own check does the
opposite deliberately, and this port's prose says why: the hosts have
ONE overlay slot, `worldModes` mounts the level-up screen only `if
(!interiorOverlay)`, so a bar that fills behind a shop window is
announced into nothing. Measured over six skill passes with the slot busy
every time, on the same character built the same way: SIX offers on the
classic lane and ONE here, and then a character playing on at a full bar
with 772 points of carry piling up, never told again.

**THE LEVEL-UP WINDOW COULD NOT BE CLOSED WITH A MOUSE.** In the classic
skin it stands in for the native sheet's rollout, which IS clickable, so
a pointer-only player - the only kind there is on a touch screen - could
open it and never close it. It has a pointer seam now: the rows select,
and three labelled zones below them press. They are their own buttons
rather than the `+`/`-` inside a row's text because FONT0003 is
PROPORTIONAL and `rowText` pads its label to twelve CHARACTERS, so those
markers land on a different pixel in every row and no fixed rect could
cover them. (That padding also ran `Intelligence` straight into a
three-digit value: `Intelligence100`. Thirteen now.)

**THE RECORDS WERE WRONG IN ELEVEN PLACES, and two of them were
arguments rather than typos.** Departure 5 justified itself four times
over with "thirty points cannot be spent under at most three attributes,
at most five each anyway" - they can, at the mod's own defaults, and the
port's own solver says so (Personality +5, Speed +5, Luck +5 at four
apiece is exactly thirty). The departure stands on the sentence beside
it; the arithmetic was decoration and it was false. And "OpenMW's
`number` renderer takes a `min` and no `max`" - the warrant for every
ceiling in departure 3 - is contradicted by OpenMW 0.49's own
`renderers.lua`, which handles `argument.max` and lists it in its
defaults. THE MOD declares no maxima; the engine is fine. The rest: the
vendor README still carried the 71-line size error the page records as
FIXED (and the corrected figure was a `wc -l` figure, which under-counts
a file that ends without a newline - it is 1,314 lines, counted off the
files by a pin now); "every other row in the registry is a Daggerfall
Unity mod" is false of seven of eighteen; "the other six RECORD OPEN
rows" - there are ten; "the mod ships eight knobs" - seven, and the
eighth is the port's own; the credits line stated three player-settable
numbers as facts, which is the exact fault the first review corrected on
the question screen; and three citations named the wrong line, one of
them landing inside code this slice had just added.

**THE PINS WERE THE ROOT OF MOST OF IT, AND THE ROOT OF THAT WAS ONE
THING: NEITHER NEW SCREEN'S `draw` HAD EVER BEEN CALLED.** Thirteen draw
mutations survived the whole suite, `draw() { return; }` among them, on
two screens whose entire defect surface is geometry. Both are drawn now -
the question on eight canvases from 375x667 to 2560x1440, the level-up
window on six from 640x400 to 1920x1080 - against a stub font with a
known pessimistic metric, and every painted glyph is read back through
the hit test it is meant to answer. The rest of that lens: the hit box was pinned against its own
arithmetic; the `1` key's branch was driven by nothing (making it answer
with the mod survived everything); `isVirtueLevelUp` was asserted on the
dungeon side only, so setting it false survived and silently dropped
every font-less level-up; the char-sheet fork was held by a REGEX, which
a local `const usesVirtueLeveling = () => false` walks straight past;
the `deltas` contract was "held" by three probes at 50 across, where
neither cap can bind; and a mutant recorded EQUIVALENT was not - the
font-less escape had simply never been driven from a partly spent
window. Nineteen pins added, two turned around, one retired. Then the FIX REVIEW below added one more and rewrote four that did not hold what they claimed. 64 pins, 94 mutants, 90 dead, 4 equivalent as recorded.

**One defect this audit looked hard for and did not find:** departure
6's promise that the level-up window is never a WALL. The shipped pin
walks it exhaustively - 576 settings and stat spreads (4 purses x 3 row
caps x both Luck switches x 3 Luck prices x 8 spreads), 1,375,685
reachable delta vectors - and there is no state with neither a legal plus
nor a legal minus. 121 of those configurations DO contain corners where
points remain and no plus is legal; every one is escapable by minus,
which is what the code comments already said, and the window names that
way out now instead of repeating an instruction its buttons have stopped
honouring.

(The first version of this paragraph said 1,296 settings, 12.9 million
vectors and 196 corners. Those came from a WIDER THROWAWAY SWEEP run
while hunting, not from the pin that ships, so nobody reading the suite
could ever have reproduced them - which is the same fault as quoting a
mod's numbers from memory instead of parsing them out of the mod. The
figures above are the pin's own. ORL1's fix review.)

## OPEN, FOR MAC

1. **The author's name and the permission record** (the README's line).
2. **The online lane** asking every online character the question.
3. **The tier mapping's defaults** - primary and major both at 8 is the
   structural match; a ladder (8/6/4/2) is the other reading, and it is
   a settings change, not a code change.
