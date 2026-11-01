# Oblivion Remaster Like Leveling

An alternative leveling system a new character can choose at creation, ported from the OpenMW Lua mod
**OblivionRemasterLikeLeveling** 0.5.3 (Nexus Morrowind 56569), vendored whole in `vendor/oblivion-remaster-leveling/`.
Every skill level-up fills a bar toward the next level; at 100 the character levels up and spends a purse of virtue
points on attributes. The player meets it as a question after character creation (`src/ui/levelingChoice.js`) and as
the virtue level-up window (`src/ui/virtueLevelUp.js`). Offline only: online, new characters level the Daggerfall way.
It is the first vendored mod that is not a Daggerfall Unity one; the Lua in `vendor/` is the source of truth.

## How it works

**The bar** (`src/systems/oblivionLeveling.js` `addSkillProgress`). Each skill level-up adds its tier's impact to the
bar (`LEVELUP_TOTAL` 100, the mod's one GMST). A skill at 100 adds nothing. Passing 100 (strictly greater) stores the
overflow in `levelRollUp`; landing on 100 stores none. It is called from `src/systems/advancement.js` inside the
skill cap gate and before the raise lands, where OpenMW calls the mod's handler.

**The roll-over** (`rollOverLevelProgress`). On commit the level goes up by one. A roll-over of 100 or more leaves the
next bar full, which offers the next level at once; otherwise the bar starts at the roll-over. One level per commit.

**The purse** (`modVirtuePurse`, `virtuePurse`). `attributePoints` (12) by default. The mod's arithmetic shrinks the
purse to what the attributes can absorb and rounds a Luck-only remainder down to whole Luck points. The port adds a
second clamp: the most a legal spend can actually place under the "at most N attributes" rule, found exactly by
`virtueSpendPlan` (a bounded knapsack over eight rows). Without it the mod can mint points its own window will not let
the player spend.

**The buttons** (`canRaiseAttribute`, `canLowerAttribute`). Plus is hidden when the purse is empty or cannot pay this
attribute's cost, the row is at its limit (`ATTRIBUTE_INCREASE_LIMIT` 5, or 1 for Luck when Luck may not rise) or 100,
or the attribute count is used up and this row is not one of them. Minus shows while the row has points to give back.
OK is refused until the purse is spent ("You must distribute all your points to continue.").

**The commit** (`commitVirtueLevelUp`). Attributes land, then health, then the level and the roll-over.

**Settings** (`src/systems/modSettings.js`, the Mods pane):

| Key | Default | Min | Max |
|---|---|---|---|
| `attributePoints` | 12 | 0 | 60 |
| `maxUpdatableAttribute` | 3 | 2 | 8 |
| `allowLuckIncrease` | true | - | - |
| `luckIncreaseCost` | 4 | 1 | 20 |
| `primarySkillsImpact` | 8 | 0 | 100 |
| `majorSkillsImpact` | 8 | 0 | 100 |
| `minorSkillsImpact` | 6 | 0 | 100 |
| `miscSkillsImpact` | 2 | 0 | 100 |

The mod declares only minimums; every maximum is the port's, because the settings store needs both bounds for a
numeric key. `primarySkillsImpact` is the port's own key for Daggerfall's extra tier.

**The two screens** draw in the port's text idiom (as the classic `LevelUpScreen` does), with no ARENA2 art, in both
skins. Neither has a DFU source. The question reads the live settings.

**The seams.**
- `src/systems/advancement.js` asks `usesVirtueLeveling` once per skill check and feeds the bar; the DFU sum still
  runs but levels nothing for a virtue character.
- `src/ui/charSheetDoor.js` mounts the virtue window in both lanes; the classic sheet's Level box reads the bar as a
  percent (`levelBarProgress`).
- `src/systems/chargenSession.js` puts the question after the wizard, so every chargen host asks it.
- `src/systems/save/save.js` saves `levelingSystem`, `levelProgress` and `levelRollUp`.
- `src/systems/classicSave.js`, the `?class=` skip and the no-font fallback set the classic system without asking. An
  absent field reads as classic, so an old save loads unchanged.
- Hosts: `world.js`, `exterior.js` and `dungeonContext.js` run chargen through `createChargenWindow`; `worldModes.js`
  runs no chargen but its level-up arms are wired.

## Rules

- On a new game the player is asked which leveling system to use (Mac).
- Online, a new character levels the Daggerfall way (Mac): `ONLINE_LEVELING_SYSTEM` is `LEVELING_CLASSIC`, applied by
  `newCharacterLevelingSystem` at every door a character is born through. Online the question is still put, with
  Oblivion's option shown shut ("Offline characters only").
- Online characters on the Oblivion bar are switched to Daggerfall's leveling (Mac). `src/systems/realmCustoms.js`
  `crossLeveling` drops the bar and re-anchors the skill sum at the start of the current level
  (`levelUpSkillSumAnchor`), so no levels pay out at once; a level-up already earned stays owed. The realm boot runs
  it and says so once.
- Offline, the save decides the system; no load path re-decides it.
- The Oghma Infinium stays on Daggerfall's own rollout in both systems: it is Daggerfall's artefact.

## Daggerfall Unity

DFU levels a character when its skill sum crosses a threshold, rolling hit points by `FormulaHelper`. The mod's
departures from Morrowind, and the port's from the mod:

1. **Health is Daggerfall's.** The mod restates Morrowind's engine rule (`Endurance * fLevelUpHealthEndMult`). The port
   uses Daggerfall's hit-points-per-level roll (`chargen.hitPointsPerLevelUp`), rolled before the attributes land, as
   `advancement.applyLevelUp` does, so both systems give the same character the same hit points.
2. **Four tiers, not three.** Morrowind has Major (5) and Minor (5); Daggerfall has Primary (3), Major (3), Minor (6)
   and Misc. Primary and major both default to the mod's major value, minor to its minor, misc to its misc.
3. **No rest to level.** Morrowind levels on sleep; the bar raises the same `readyToLevelUp` flag the Daggerfall path
   does, and every host's level-up door opens on it.
4. **The look is not ported**: Morrowind's art, pictures, tooltips and music. The port draws text and plays its own
   fanfare.
5. **The purse's second clamp** (above).
6. **Every settings maximum is the port's.**

The author's four changelog fixes (0.5.1 to 0.5.3) are kept: one impact per raise, a full bar on a large roll-over,
health on every commit, and the handler reading the skill's outgoing value.

## Code and tests

- `src/systems/oblivionLeveling.js` - the bar, tiers, purse, predicates, commit, headless spend
- `src/ui/virtueLevelUp.js`, `src/ui/levelingChoice.js` - the two screens
- `src/systems/realmCustoms.js` `crossLeveling` - the online switch
- `test/systems/orl1_leveling.test.js` - the law against the Lua, the purse's maximum against an exhaustive search,
  the screens, the seams and the online rule

## Open

- Level feeds skill speed (`skillUsesForAdvancement` multiplies by `1.04^level`), so the two systems do not pace
  skills identically at the same level.
- The author's name and the permission record are still open (`01-Overview/Mod-Registry.md`).
- The tier defaults (primary and major both 8) are the structural match; a ladder (8/6/4/2) is the other reading, a
  settings change for Mac.
