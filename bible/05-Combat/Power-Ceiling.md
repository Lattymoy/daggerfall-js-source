# Power Ceiling

The rule that keeps progression horizontal: no new content makes a character's gear obsolete by being bigger. There is
no item level and no gear score; each line is capped at the Legendary band's top, and the places where powers stack
have composite ceilings set at what the strongest legal kit reaches. The player meets it as gear that stays worth
wearing.

## How it works

- **Lines.** No line of any piece goes above the Legendary band's top (`AFFIX_RANGES`, `validAffix` in
  `src/systems/loot/lootRarity.js`). The tops by kind: damage 40, armour 20, attribute 15, resistance 50, skill 30,
  carrying capacity 50, elemental 10, leech 10, thorns 10, focus 10, slayer 30, standing 8, warmth 10, weatherproof 50,
  casting speed 15, potency 15, wellspring 10, technique 50; a weapon's sigil 12.
- **The ladder** has seven rungs: Common, Magic, Rare, Legendary, Aetheric, Artifact, Gilded. Three are rolled bands
  (Magic, Rare, Legendary); nothing has a band above Legendary.
- **Power numbers.** Every number a Legendary, Gilded or set power, a path or a Firmament channel carries has a role
  (`FIELD_ROLES`, `powerNumbers`, `pathNumbers`, `skyNumbers` in `tools/powerCeiling.mjs`), held to its band's top or
  to today's strongest power of its role. A number with no role fails until it is measured.
- **Composite ceilings** (`src/systems/powerCeiling.js`). Each registry asks for its room under its own name
  (`blowRoom`, `guardRoom`) before it adds its share; the runners (`weaponBlowMods` in `src/systems/entityMods.js`,
  `playerDamageMods` in `src/characters/playerEntity.js`) open the product for each blow and each hurt. A registry is
  cut at its own top, so a power that grows past it costs no other registry anything.
  - The blow (`BLOW_TOPS`): sigil +12%, sets +200%, loot +240%, Firmament +50%, mastery +400%, martial paths +40%;
    together `BLOW_MOST`.
  - The guards (`GUARD_TOPS`): loot 55% off, sets 50%, Firmament 15%, martial path 30%, arcane path 20%; together a
    hurt keeps at least `GUARD_LEAST` (about 10.7%) of what reached the guards.
- **Outside the products**, each held by its own record: flat numbers, pools of points, blows turned aside whole,
  caps by health, death saves and second blows.
- **Going sideways costs less** (SET-CATCHUP). A set piece below the highest stage that set has reached for this
  character drinks `CATCH_UP_MULT` (3) times the Renown XP until it reaches that stage
  (`src/systems/sigil/setReach.js`); the set's card says so.

## Rules

- THE CEILING HOLDS (the owner, no exceptions and no band-aids): no line past the Legendary top; seven rungs; new
  content adds sideways (a set for another build, a power that changes play, a look, a way in), never higher numbers.
- A new rung, a higher band, a stronger number or a higher composite needs the owner's explicit approval, recorded
  under Approvals below before the change merges.
- Each top is a blow reachable in play, not a paper sum.
- `node tools/powerCeiling.mjs` prints the tables and each kit.

## Approvals

- The tamed Dwarven Dragon's pace (the owner chose: fly 25 m/s, travel 2x horse). A pace, not a power: no line, band
  or rung moves.

## Code and tests

- `src/systems/powerCeiling.js` - the composite ceilings
- `src/systems/sigil/setReach.js` - set catch-up
- `tools/powerCeiling.mjs` - the measure and the roles
- `test/combat/powerceiling_walk.test.js` - the rungs, bands and tops; every record and honestly minted item walked
- `test/combat/powerceiling.test.js`, `test/combat/powerceiling_rooms.test.js` - the products by execution, every
  registry asks and spends its room
- `test/systems/sigil/setcatchup.test.js` - catch-up

## Open

- A line and its gems of one kind on one piece can sum past one line's top (each keeps its own law).
- Spells compose under their own caps (loot 50, sky 30); no composite spell ceiling is measured yet.
- The offline bench (`src/scenes/exterior.js`) earns no Renown, so set catch-up never drinks there.
