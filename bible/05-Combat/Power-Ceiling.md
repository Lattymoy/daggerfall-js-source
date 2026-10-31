# Power Ceiling - the no-treadmill rule (POWER-CEILING, 2026-10-27)

The rule that keeps the game horizontal: no new content makes a character's gear obsolete by being bigger. The rule
is written here, enforced by tests, and the two places where powers stack had no ceiling until now - they have one,
set at what today's strongest kit reaches. The same slice made a sideways set swap cheaper (SET-CATCHUP, section 6).

## 1. What was asked

A player's feedback, passed on by the owner on 2026-10-26:

> The horizontal MMO approach was working really well imo, but now that bounties, professions, and sailing have sort of
> been worked on and pushed aside, the game has gone in the direction of a theme park MMO. ... I would hate hate hate to
> see go down the path of Retail WoW, with stupid expansions that constantly overwrite your gear every single patch keeping
> you on a tread mill. Add more horizontal progression please!

The owner: "build all of it with autonomy and be as detailed as possible. No exceptions and no band aids." The four
decisions below were taken under that autonomy, in the player-feedback response's plan (its slice B).

## 2. What was found (2026-10-26)

There is no item level and no gear score. Each line was already capped, one at a time, at the top of the Legendary
band (`systems/loot/lootRarity.js:"const max = AFFIX_RANGES[a.id].legendary[1];"`), and every Aetheric set's lines sit
inside that band. But two rungs came above Legendary within about two weeks (Aetheric on 09-26, Gilded on 10-07, seven
rungs in all), ten sets are bound to one piece of content each, and "the Hourlock stays the one" Gilded became five.
The Balance arc's BAL7 (`Balance-Arc.md` section 13) recorded the guards composing "with no overall ceiling" and the
blow powers multiplying "across their three registries ... with no ceiling". And a set's stage is its lowest worn
piece's (Mac's "grow together", `11-Multiplayer/Sigil-Sets.md` sections 2 and 5), so changing a set piece for a better
one meant growing that piece from Faint again.

## 3. The rule - THE CEILING HOLDS

- **No line of any piece above the Legendary band's top.** The tops, by kind: damage 40, armour 20, attribute 15,
  resistance 50, skill 30, carrying capacity 50, elemental 10, leech 10, thorns 10, focus 10, slayer 30, standing 8,
  warmth 10, weatherproof 50, casting speed 15, potency 15, wellspring 10, technique 50. A weapon's sigil: 12.

- **The ladder is the seven rungs it has:** Common, Magic, Rare, Legendary, Aetheric, Artifact, Gilded. Three are
  rolled bands (Magic, Rare, Legendary); nothing has a band above the Legendary.

- **New content adds sideways:** a set for another build, a power that changes how you play, a look, a way in. It
  never adds higher numbers. A new power's numbers stay at or under today's strongest of their kind (section 4).
- **A new rung, a higher band or a stronger number needs the owner's explicit approval, quoted in section 9.**
- **The composites hold too:** a blow's powers together and a hurt's guards together stay inside the ceilings of
  section 5.

Home.md carries the rule beside the other Process rules.

## 4. How the rule is held

`test/combat/powerceiling_walk.test.js` pins the seven rungs, the three bands and every top above as literals, and
proves the wire's own check (`validAffix`) takes a line at its top and refuses one past it. Then it walks every fixed
record the game keeps, each as its producer mints it: the Legendaries (the thirty, the wardrobe's six, the arcane
three and a registered one, plain and Exalted), every Aetheric record and every Gilded record and era, DFU's 23
artifacts (no line, never laddered), every gem at every grade and the gems' per-piece cap, and the honest producers'
sweep (`test/honestItems.mjs`: every loot door, shelf, spoils, the Broker, every crafted recipe, gifts and keepsakes -
tens of thousands of items). A crafted Legendary of MASTER-ART's shape, every line its piece may carry at the band's very top,
passes; one point more fails. Every failure names this page.

AUDIT HORIZONTAL D3: a minted piece's rung is its own `rarity`, as its readers take it (`it.rarity === 'gilded'`). The
walk asked `rarityOf`, which reads an unknown rung as Common or Magic, so a piece minted on an eighth rung passed it.

Every number a Legendary, Gilded or set power carries (149 today, `tools/powerCeiling.mjs:"export function powerNumbers"`)
has a role (`tools/powerCeiling.mjs:"export const FIELD_ROLES"`). A line's role is held to its band's
top: a set's Strength at most 15, Ruhn's fire at most 50. Every other role is held to today's strongest of those
powers: a blow's share 140 (Bound in Silk), a guard's 30, a heal 30, a chance 30, a splash 60, a recovery no shorter
than 10 s, and so on (the table in the test). A number with no role, or a role the table does not know, fails until
it is measured.

AUDIT HORIZONTAL D8: that walk read no path and no star, and Prismatic Ward's chance of 40 already stood past its
chance of 30. The paths' numbers (100 today, `tools/powerCeiling.mjs:"export function pathNumbers"`) have roles of
their own, their shares being fractions, each held to today's strongest path number: a blow 30 (Opening Strike), a
guard 30, a chance 40 (Prismatic Ward), a heal 25, a recovery no shorter than 120 s. Every channel the sky can carry -
its fixed ones, its families' and every key a star names (`tools/powerCeiling.mjs:"export function skyNumbers"`) -
is held at today's cap: a weapon channel 30, the blow's whole 50, a blow taken 15% lighter.

## 5. The composite ceilings

`src/systems/powerCeiling.js` holds two products. Each registry asks it for its room, under its own name, before it
adds its share, and the runners (`systems/entityMods.js:"export function weaponBlowMods"`,
`characters/playerEntity.js:"export function playerDamageMods(entity, dmg) {"`) open the product for each blow and each
hurt. Each registry is held at its own top, and each ceiling is the product of the tops, measured from the records and
laws the code reads, so no blow or hurt today is cut.

AUDIT HORIZONTAL D4: a power added later that would take its registry past its top is cut at that top, and no other
registry loses anything for it. The product alone cut whichever registry the import graph asked last: a loot power
past 240 took the martial path from 40 to 8 in `world.js`, and the sky from 50 to 16 in `exterior.js`
(`test/combat/powerceiling.test.js`, THE CUT LANDS WHERE THE POWER GREW). A room asked without a registry's name, or
under a name with no top, fails the source sweep.

**The blow** - per cent onto one blow, each registry at its best:

| registry | top | its strongest legal kit |
|---|---|---|
| the sigil | +12% | a Legendary weapon's sigil of 12 at Ascendant, Renown 40 |
| the sets | +200% | Nocturnal's Shroud 4 (Nightfall, +60% on an unaware foe) and the Starspun Weave 4 (Bound in Silk, +140% on the fourth blow) |
| the loot | +240% | Nightwhisper's Silent Death +100%, the Night Mother's Embrace +50%, the Duelist's Vambrace +60%, an Exalted slayer's line +30% |
| the sky | +50% | the Firmament's whole blow, its own cap (`BLOW_TOTAL_CAP`) |
| mastery | +400% | the climb's own +80% (an axe or a hammer at a skill of 200, which reads as 140 effective: 2% an effective point past 100) and, WEAPON-GEAR, its gear's most, +320% (0.44% a point of gear on the skill), added |
| the paths | +40% | a martial path's own cap (`MARTIAL_BLOW_MOST`) |

Together, x119.95 - x43.18 before WEAPON-GEAR (2026-10-27, mob: "Bow and weapon fix"; `Martial-Specialisations.md` section 4) raised mastery's top (`systems/powerCeiling.js:"export const BLOW_MOST"`).

AUDIT HORIZONTAL D7: mastery's row read as 200%. The skill pays through the soft cap, so a raw 200 is 140 effective
and pays 40 points (`tools/powerCeiling.mjs:"export const masteryBlowTop"`; a measure that read the raw skill
fails the measured tops).

**The guards** - the share each registry's guards take off one hurt, at their strongest:

| registry | off | its strongest legal kit |
|---|---|---|
| the loot | 55% | the Witch-Sisters' Ring's Hex, the Mountain's Root's five stacks of Bedrock, the Warden's Last Stand |
| the sets | 50% | Malacath's Bulwark 6, Unbroken's half |
| the sky | 15% | the Firmament's `blowTaken` at its least |
| the martial path | 30% | the Brawler's Knockout |
| the arcane path | 20% | the Warden's Living Aegis |

Together, a hurt keeps at least 10.71% of what reached the guards (89.29% off).

What stands outside the products, each held by its own record and the walk: a flat number (a sear, Serpent's Kiss,
Bulwark's 5), a pool of points (Iron Hide's ward, the Reprieve's shield, a Shield spell), a blow turned aside whole
(Dawnward, the Raven, Foresight, Dancer's Step, the sky's evade), a cap by health (Unyielding, FULL-GUARD), a death
save, and a second blow (Cleave, Chain Lightning, Earthshaker, Dragonfire, Hammerfall, Many Endings, Open Hand, the
paths' riders).

**The measurement.** `node tools/powerCeiling.mjs` prints both tables and each kit. BAL7's kit harness was never
committed (the tree holds BAL11's `tools/heroMeasure.mjs`), so this is a new measure, on BAL7's model: the strongest
legal kit, minted by its own producers. No one blow meets every registry's best moment at once (First Blood is a
foe's first blow, Bound in Silk its fourth), so no blow today reaches x119.95. By execution, the sigil, the sets and
the loot together reach x11.42 through the real runner, whole (`test/combat/powerceiling.test.js`). The ceiling is a
ratio, so BOW-TOPS' new bow tops (17 and 19, `Balance-Arc.md` section 18) move the blow it multiplies, not the ceiling.

**Each top is a blow in play** (AUDIT HORIZONTAL, the lane's suspected item: a foe struck three times is likely aware).
The sets' +200% wants a foe still unaware at the web's fourth blow. True Invisibility gives it: a struck foe that
cannot see me stays unaware, and a True concealment outlasts the blow where a Normal one ends with it (pinned, THE
SETS' TOP IS A BLOW IN PLAY). The loot's +240% wants a foe I have never struck, under the Night Mother's line and
unaware - a spell cast first under True Invisibility gives it (reasoned, not pinned). Neither top is loosened.

## 6. Going sideways costs less (SET-CATCHUP)

A set's stage is still its lowest worn piece's. A piece below the highest stage that set has stood at for this
character drinks three times the Renown XP until it reaches that stage, and never faster past it
(`systems/sigil/setReach.js:"export const CATCH_UP_MULT"`). The set's card says so beside the piece holding it:
"Kindled: grow your Helm (3x XP to Radiant)". The record is `11-Multiplayer/Sigil-Sets.md` section 5 and its SET-CATCHUP
section.

## 7. Recorded, not changed

- **A kind summed on one piece.** A line and its gems of the same kind together read up to the Legendary top plus the
  Rare top (a weapon's +40% damage and +25% from Diamonds). Each line keeps the law; Gem-Sockets.md law 6 caps the gems.
- **Spells compose under their own caps:** the loot's `SPELL_POWER_MOST` 50 and `SPELL_CUT_MOST` 50, the sky's 30.
  No composite ceiling is measured for them yet - a watch item.
- **A fight's own moments are the fight's, not the gear's:** the technique's multiplier (its line is held per line),
  a staggered or overreached foe (`systems/blowTaken.js`), a critical strike.
- **The +damage line** is folded at the weapon's roll, not among the blow powers; the per-line law holds it.
- **The item maker's rows are no line** (GILDED-MAKER, 2026-10-29; `06-Systems/Gilded.md` section 11). They are DFU's
  own enchantments, on a plain piece, a Rare or a Gilded piece alike, each held to the maker's law and paid from the
  piece's own points, which are its make's (`systems/item/itemLaw.js:"function makerFindings("`). A Gilded piece's
  record lines stay at the Legendary top beside them; no line, rung, band or power number moves.

## 8. The four hosts, the service and the save

No host is wired. The two runners sit under the formulas every host calls (`combat/formulas.js`, `combat/pcaao.js`,
`playerEntity.js hurtPlayer`), so all four hosts - `scenes/world.js`, `scenes/exterior.js`, `scenes/worldModes.js`,
`scenes/dungeonContext.js` - are held without an edit. The catch-up rides `drinkWorn`, which world.js's `sigilDrinks`
already calls for every kill and quest in the streamed world, indoors and underground (SET4). `exterior.js` is
FLAGGED as it was: the offline bench earns no Renown, so nothing drinks there.

The account service's routes and tables, the relay and the wire are not changed. The account Worker bundles
`lootRarity.js`, and through it the two new leaves (`powerCeiling.js`, `sigil/setReach.js`); neither runs there, and
`account-deploy.yml`'s path filter names both (ACC4, `accountdeploy.test.js`). The save gains one mod record, `SigilSetReach`
(`systems/modSaveData.js`), additive: `SAVE_VERSION` does not move, and a save without it reads as no reach.

## 9. Approvals

The owner's explicit approval for a new rung, a higher band, a stronger number or a higher composite is quoted here,
with its date, before the change that uses it merges. Apart from the one below, none has been given; the ceiling stands
as measured on 2026-10-27.

- **The tamed Dwarven Dragon's pace** (DRAGON, 2026-10-29; `11-Multiplayer/Dwarven-Dragon.md` section 10). Asked "How
  fast should a tamed dragon mount be?", the owner chose *"Fly 25 m/s, travel 2x horse"*: "On the ground it walks and
  gallops like a horse. In flight it goes about 1.5 times a galloping horse. On the travel map it is twice as fast as a
  horse and flies over water and mountains in a straight line." A pace, not a power: no line, band or rung moves.

## 10. Pins

`test/combat/powerceiling.test.js` (9): the measured tops and the law's tables, every tier and power kind measured,
the room, the blow and the guards by execution, the sets' top as a blow in play, the sets' other guards, a sweep of
the source - every blow modifier asks `blowRoom`, every damage modifier but the three vetoes (`eg-witness`,
`poi-editor`, `kt-down`) asks `guardRoom`, each under its registry's name - and the cut landing on the registry past
its top. `test/combat/powerceiling_walk.test.js` (9): section 4. `test/combat/powerceiling_rooms.test.js` (4): below.
`test/systems/sigil/setcatchup.test.js` (6): section 6. `tools/mutants/power-ceiling.json` (79, all dead). PIN MOVED:
none of the ceiling's - it cuts nothing a player has.
The mutant records that quoted the lines the room calls now sit in are re-aimed by content and judged dead again:
`audit_schools.json` (the Living Aegis's carry), `loot5.json` (the Last Stand), `set3.json` (Unbroken's half, two) and
`set4.json` (the drink, five).

AUDIT HORIZONTAL D2: the sweep proved each registry asks for its room, not that it spends what it is given - one that
asked and then added its raw per cent passed every pin. `test/combat/powerceiling_rooms.test.js` (4) runs the sky's,
mastery's and the martial path's blows, and the sky's, the martial path's, the Living Aegis's and Unbroken's guards,
each power awake and minted by its own producers: whole with room, nothing once the product is spent. The sweep reads
every registration to its closing paren, takes only a named function with a braced body, and holds each veto to
`(e, d) => (cond ? 0 : d)`.
