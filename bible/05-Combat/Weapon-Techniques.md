# Weapon Techniques

A weapon found on the loot ladder (or a pair of Gauntlets, for bare hands) may carry a technique: one line naming one
of twelve techniques its weapon family knows, done by its own key. A Volley of arrows on an aimed disc, a Leap Strike
onto a foe, a Shadowstep behind one, a Whirlwind all round. Each costs fatigue, has a cooldown, and is a real blow
resolved by DFU's damage formula. The player meets it as a line on found gear and the **Weapon technique** key.

## How it works

- **The roster** (`TECHNIQUES`, `src/combat/technique/techniqueRoster.js`). The multiplier is `base * (1 + value/100)`
  (`techniqueMult`), applied to DFU's damage for the weapon in hand. Each plays a DFU swing state, so its swing
  modifiers ride along.

  | Technique | Family | Does | Base | To hit | Fatigue | Cooldown |
  | --- | --- | --- | --- | --- | --- | --- |
  | Volley | bows | six arrows fall on an aimed disc | 0.5 each | the shot's | 6 | 16 s |
  | Piercing Shot | bows, Thunderlock | one fast shot through up to five foes | 1.2 | the shot's | 4 | 10 s |
  | Leap Strike | long blades | leap onto an aimed foe, strike all near the landing | 1.4 | +20 | 5 | 12 s |
  | Whirlwind | long blades | strike every foe all round | 1.0 | +15 | 5 | 10 s |
  | Shadowstep | short blades | dash behind an aimed foe and strike | 1.2 | +20 | 4 | 9 s |
  | Lunge | short blades | dash along the look, strike every foe in the lane | 1.1 | +15 | 4 | 8 s |
  | Cleave | axes | strike every foe in a half-arc ahead | 1.2 | +15 | 5 | 9 s |
  | Headsman's Chop | axes | one blow, harder the more wounded the foe | 1.2 | +20 | 5 | 11 s |
  | Ground Slam | blunt | strike every foe all round | 0.9 | +15 | 6 | 12 s |
  | Skull Crack | blunt | one heavy blow on the nearest foe in view | 1.6 | +30 | 5 | 10 s |
  | Flying Kick | bare hands | leap onto an aimed foe, from the ground or the air | 1.3 | +20 | 4 | 10 s |
  | Haymaker | bare hands | one heavy blow on the nearest foe in view | 1.8 | +30 | 4 | 9 s |

- **Families** are the skill a piece swings with (`techniqueFamily`). The Thunderlock is a family of its own (Piercing
  Shot, never a Volley). Arrows take none. Bare hands ride Gauntlets (`GAUNTLETS_TEMPLATE`, 103) worn while unarmed. A
  werebeast's claws know no technique.
- **The line** (`AFFIX_KINDS.technique`, `src/systems/loot/lootRarity.js`) is rolled in its own pass, last at every
  loot door, so earlier draws are unchanged. Bands (`TECHNIQUE_BANDS`): Magic 5-15, Rare 15-30, Legendary 30-50.
  Chance a piece (`TECHNIQUE_PER_MILLE`): 120, 300, 450 per mille. Never on a Common, an Aetheric set piece or a Gilded
  record. It has no slot and never changes the piece's name. The Reforge turns it only into another of its family;
  the Hone walks its value to the band's top. The item law (`src/systems/item/itemLaw.js`) allows at most one.
- **The keys** (`src/systems/inputActions.js`). **Weapon technique** (`WeaponTechnique`), default `Mouse3` (the mouse's
  back side button), answers the line on the weapon in hand, or, when the weapon has none, a held martial path's
  signature. **Martial technique** (`SignatureTechnique`, unbound) always answers the path's signature. Phones and pads
  have buttons for both. A technique that aims shows its mark while held and goes on release; a tap goes at once.
- **The runner** (`stepTechnique`, `src/combat/techniques.js`): one state for the player (cooldowns, aim, act in
  flight), stepped by the weapon rig ahead of its gesture. The blow (`src/combat/technique/techniqueBlow.js`) gives
  `resolveHit` in `src/combat/playerWeapon.js` its reach and multiplier; shafts go through `playerArrowHitFoe`.
- **Backstab and cancel.** A foe whose back is to the player at the press is a backstab's chance for the blow
  (`backsAt`); a Shadowstep that lands behind takes it from behind. A swing in flight and the attack cooldown do not
  block the key: the strike cuts them, and the cut swing's hit is lost. A gun's shot or reload still holds the key.
- **The feel** (`src/combat/technique/techniqueFx.js`): code-driven bursts, camera shake and sound for each technique.
  The card shows the line as its own block with a glyph (`src/ui/techniqueCard.js`, `src/ui/techniqueGlyph.js`).

## Rules

- The formula decides: a technique is a multiplier on DFU's own damage, never a flat number, and a miss is a miss.
- Found, never chosen or trained (the owner's design). Shops and quest rewards do not roll one.
- With the loot ladder off nothing rolls one and a found line sleeps; the key says why. A martial path's signature
  needs no ladder.
- Never at a player: a technique's blow on a player's body takes a plain swing's test and number, and its shaft passes
  them by (`playerBody`). In a duel or bout between players the key refuses.
- Nothing outruns the referee: a leap or dash moves at most `TECHNIQUE_MAX_SPEED` (12 m/s); a Volley's shafts fall
  0.27 s apart.
- Paid like a swing: fatigue through the host's drain, one arrow a shaft, a skill tally a shaft, then the cooldown.
  The key refuses a price that would leave the body exhausted.
- One runner, every host: `src/scenes/exterior.js`, `src/scenes/world.js`, `src/scenes/worldModes.js` and
  `src/scenes/dungeonContext.js` hand the rig a door (motor, arrows, fatigue, facing, effects); none performs a part
  of it itself.
- Werewolf form keeps no technique (the owner).

## Daggerfall Unity

DFU has no second verb on a weapon and no key for one. Techniques are the port's own departure, hung off the loot
ladder's switch.

## Code and tests

- `src/combat/technique/techniqueRoster.js` - the roster, bands, chances, families
- `src/combat/techniques.js` - the runner
- `src/combat/technique/techniqueBlow.js`, `techniqueFx.js` - the blow, the feel
- `src/ui/techniqueCard.js`, `src/ui/techniqueGlyph.js` - the card's block
- `test/systems/tech1_roster.test.js`, `tech1_runner.test.js`, `tech1_audit.test.js` - roster, line, runner, laws
- `test/scenes/tech1_hosts.test.js` - the four hosts, the keys
- `test/systems/techfx1.test.js`, `test/ui/techcard1.test.js` - the feel, the card

## Open

- A peer does not see a Volley's falling shafts or the aim marks; that needs a wire field.
- No foe has a technique; no spell has one; no armour but Gauntlets carries one.
- The classic HUD has no technique chip; the message line reports readiness and refusals.
