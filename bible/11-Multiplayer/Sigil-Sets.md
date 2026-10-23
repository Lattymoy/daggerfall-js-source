# Sigil Sets - armour that answers to a Daedric Prince (SET)

> Design page, written before any code (2026-09-26). The slices at the foot are the order it ships in; each is
> shippable and verifiable without the next. Where the page and a shipped slice disagree, the slice's own record
> (the SET rows in `01-Overview/Port-Ledger.md`, and each slice's section here) is what runs.

## What Mac asked for

Mac, 2026-09-26: *"I wanna talk about making sigil armor sets that also come with set builds (think having multiple
of one set type grants detailed abilities)"*. Offered a shape and asked four questions, Mac chose:

- **Where they come from:** *"Sigil sets come from any source, just like weapons. Boss kills has the chance of
  dropping a rare boss themed weapon/armor set with the rarity Atheric (new). Sigil stones become a currency to trade
  for daily reset sigil items at a new NPC vendor that stands outside the oblivion gate."*
- **The tiers:** 2 / 4 / 6 pieces.
- **Growth:** *"Grow together"* - the pieces drink Renown XP, and the bonuses scale with the LOWEST stage among the
  worn pieces, so a set is levelled as a whole.
- **Where they work:** online, never in duels - the weapon sigil's own rule.

And the four defaults offered and taken ("Lets begin this ... go all out on this, just like you did with the World
Boss"): the new rarity is **Aetheric** (from Aetherius; "Atheric" is no word of the lore), between Legendary and
Artifact; the first boss set is the gate boss's own; a set's **weapon counts** as a piece; the vendor stands at each
gate **only while it stands**, the same stock for everyone that day, **one of each** a player a day.

## The shape, end to end

```
 a foe dies online ──► its armour/shield/weapon rolls a SET SIGIL ──► worn: count per set ──► 2 / 4 / 6 tiers
 (any source)            (SIGIL1's chance law)                         │                        (the set's ABILITIES)
                                                                       ▼
 a kill, a quest ──► Renown XP ──► every worn set piece DRINKS it ──► the set's STAGE = its lowest piece's
                                                                       (scales every number of every tier)
 the gate boss falls ──► the spoils may hold one AETHERIC piece of RUHN'S REGALIA (the boss's own set)
                    └──► the SIGIL STONE ──► the SIGIL BROKER beside the gate ──► the day's stock, paid in stones
```

## 1. What a set piece is - the record (SET1)

A set piece is an item whose **sigil names a set**. The weapon sigil's record (SIGIL1, `systems/sigil/sigil.js`:
`{ power, party, xp }`) grows one optional field and loses one requirement:

| field   | a weapon sigil (SIGIL1) | a set piece: armour / shield | a set piece: weapon |
|---------|-------------------------|------------------------------|---------------------|
| `power` | the blow's per cent     | -                            | the blow's per cent |
| `set`   | -                       | the set's id                 | the set's id        |
| `party` | the fight that won it   | the fight that won it        | the fight that won it |
| `xp`    | what it has drunk       | what it has drunk            | what it has drunk   |

One sigil a piece, one growth a piece: a set weapon's blow and its set share the one `xp`, so a weapon never levels
twice. `validSigil` takes a record with a `power` or a `set` (or both) - never neither - and every reader of `power`
(the blow, its lines, its card) reads a set piece's absent power as no blow at all.

**What may carry one.** A Magic, Rare, Legendary or Aetheric piece of **armour** (the seven body pieces), a
**shield**, or a **weapon** (never ammunition). Never jewellery, clothing, an artifact or a quest's item. The pieces a
set can have are the nine places it can be worn: the helm, the two pauldrons, the cuirass, the gauntlets, the
greaves, the boots, the shield and the weapon.

## 2. The tiers and the stage (SET1)

- **Counting.** The set pieces WORN (on the equip table), counted per set. Two pauldrons are two pieces. A piece in
  the pack counts for nothing. A set's WEAPON counts once: Daggerfall readies a weapon in each hand and swings one at
  a time, so two weapons of one set in the two hands are one piece, not two.
- **The tiers.** A set's tier 1 wakes at 2 pieces, tier 2 at 4, tier 3 at 6 - each tier its own named ability, the
  lower ones staying awake under it.
- **The stage.** Every piece's own stage is the weapon sigil's: the LOWER of its rank (by its `xp`: Faint 0, Kindled
  5,000, Bright 12,500, Radiant 22,500, Ascendant 37,500) and the stage the wearer's Renown opens (1 / 10 / 20 / 30 /
  40). **The set's stage is the lowest of its worn pieces'** - Mac's "grow together" - and the card names the piece
  that holds it there.
- **The numbers.** Every number a tier has is given at Faint and at Ascendant, and a stage between takes its place in
  the line: `faint + (ascendant - faint) x stage / 4`, rounded as the number reads (whole points, whole per cents,
  whole seconds). So a set is felt from its first stage and is twice to three times that at its last.
- **Asleep.** Offline, online before the page knows its Renown, and while the wearer is in a duel, every set sleeps:
  no tier is awake, no number moves, no piece drinks. The card still shows what the set would do. AUDIT 625 P2: a bout
  between players on an arena's relay sand is a duel too - the opponent stands as a Daedra Lord's stand-in for the
  formulas, no player, so the gates that refuse a blow at a player never saw one, and every set, the loot's powers and
  the weapon's sigil woke in the ring. The duel's word is ONE now, kept by SIGIL1's door (`systems/sigil/sigil.js`
  setSigilDueling; `systems/sigil/sigilSets.js` setSetsDueling and setsDueling its names here), raised by `scenes/world.js
  duelFrame` for a duel and for a live bout between players (`arenaPvpLive`), and the weapon's own blow reads it.

## 3. The four sets of the world (SET3)

Each is a build, and each answers to a Prince. Every one can land on any won piece, of any material.

### Malacath's Bulwark - the one who will not fall (tank)

| pieces | ability | Faint -> Ascendant |
|---|---|---|
| 2 | **Orc-Hide** - armour on every body part, and Endurance | +2 -> +5 armour a part; +2 -> +6 END |
| 4 | **Spite of the Spurned** - a foe whose blow lands on you (a weapon's, a claw's, an arrow's) takes a share of it back - it wounds, never kills (BAL5) | 10% -> 30% |
| 6 | **Unbroken** - damage that would kill you leaves you at 1 health instead, and for a while all damage you take is halved; then it must recover | 4 -> 8 s halved; recovers 300 -> 150 s |

### Dagon's Brand - the one who does not stop (melee)

| pieces | ability | Faint -> Ascendant |
|---|---|---|
| 2 | **Ravager** - Strength, and Critical Strike | +2 -> +6 STR; +4 -> +12 Critical Strike |
| 4 | **Bloodfury** - your weapon blows hit harder, twice as hard again below half health | +4% -> +12% (x2 below half) |
| 6 | **Rampage** - each kill grants a stack for 12 s (a kill refreshes them all), up to three; each stack strengthens your weapon blows | +4% -> +10% a stack |

### Nocturnal's Shroud - the one who is not seen (stealth, archery)

| pieces | ability | Faint -> Ascendant |
|---|---|---|
| 2 | **Shadow's Grace** - Stealth, and Agility | +4 -> +12 Stealth; +2 -> +6 AGI |
| 4 | **Nightfall Strike** - a weapon blow (a bow's too) at a foe that has not noticed you | +25% -> +60% |
| 6 | **Eventide** - a kill wraps you in shadow: the Chameleon spell's own (a strike of yours breaks it), no save and no roll | 1 -> 3 magic rounds (5 -> 15 s online); recovers 30 -> 15 s |

### Mora's Mantle - the one who knows (magic)

| pieces | ability | Faint -> Ascendant |
|---|---|---|
| 2 | **Forbidden Lore** - Intelligence, and every school of magic | +2 -> +6 INT; +2 -> +6 each school |
| 4 | **Waters of Oblivion** - your spells cost less magicka | 5% -> 15% |
| 6 | **Eye of Mora** - a Destruction spell that strikes you is sometimes absorbed, as Spell Absorption is: nothing lands, and its magicka is yours (only when your magicka has room for its cost) | 10% -> 30% |

## 4. Where set pieces come from (SET4)

- **Any win, online** - Mac's "just like weapons": when a list is won online (a corpse at its foe's death, a treasure
  pile when it is minted - every door SIGIL1 stamps at), every Magic-or-better piece of armour and every shield rolls
  a set sigil by SIGIL1's own chance law (200 per mille alone, 40 more a fighter past the first), one of the four sets
  of the world at even odds. A weapon's sigil, when it lands, joins a set one time in three. Offline, nothing; a piece
  never gains a sigil after it is won and never loses one.
- **The boss** - Ruhn's Regalia (section 6).
- **The Broker** - section 7.

## 5. Growth - the set is levelled as a whole (SET4)

Every worn set piece drinks what the weapon in hand drinks: the Renown XP of every kill and quest, online, with the
party's bonus, never past the last stage (`SIGIL_XP_MAX`). A rise is said once for the set, not once a piece ("Your
Dagon's Brand brightens: Kindled."), and the card names the piece holding the set back. A piece swapped in fresh
pulls the set down to its stage until it catches up - the price of a new piece, and the reason to keep one.

## 6. Aetheric, and Ruhn's Regalia (SET6)

**Aetheric** is the ladder's new top rung under Artifact: a colour of its own (the aether's pale blue-white,
`#bfe8ff`), a pip (a diamond within a diamond, beside the Legendary's three), a frame, a line on the floor between the
Legendary's and the Artifact's, a price. Nothing rolls it - it is the boss's, and the Broker's.

**Ruhn's Regalia** is the set of Valkynaz Ruhn, Warden of the Burning Gate: nine Aetheric pieces of Daedric make, each
its own fixed record (a name, a line of lore, three affixes at the top of the Legendary band - every armour piece the
gate's fire resistance, which is +10 a piece and not the band's top: AUDIT FINAL) and a set sigil of its own set; the
Gatecleaver carries the widest band's top blow as well.

| piece | template |
|---|---|
| Ruhn's Gatecleaver | Battle Axe (one-handed - the War Axe takes both hands, and the shield would never be worn with it) |
| Ruhn's Horned Crown | Helm |
| Ruhn's Right Pauldron, Ruhn's Left Pauldron | Pauldrons |
| Ruhn's Warden-Plate | Cuirass |
| Ruhn's Brand-Gauntlets | Gauntlets |
| Ruhn's Greaves | Greaves |
| Ruhn's Cinder-Boots | Boots |
| Ruhn's Gate-Shield | Tower Shield |

| pieces | ability | Faint -> Ascendant |
|---|---|---|
| 2 | **The Burning Gate** - fire resistance, and your weapon blows sear | +15 -> +45 fire; +2 -> +6 fire damage a blow |
| 4 | **Cleave** - your melee blows also strike the nearest other foe within 3 m of your target (never a bow's) | 25% -> 60% of the blow |
| 6 | **Wrath of the Warden** - when a blow takes you from 30% health or more to under it (never a killing blow), a Flame Nova bursts from you, and your weapon blows deal more for 10 s; then it must recover | 10 -> 40 fire to all within 6 m; +10% -> +25%; recovers 180 -> 90 s |

**The drop.** A kill's spoils (WB5, `systems/gate/gateSpoils.js`) roll one more thing AFTER everything they roll today, so
every earlier spoils stays what it was: one Regalia piece, a sixth of the time, from the receipt's own seed.

## 6b. The raiding parties' own sets (RAID4b, 2026-09-28)

Mac, on World Events - Raiding Parties online: *"3. We can also add renown and it's own atheric + armor sets"*. Three
more Aetheric sets, one a raiding party, nine fixed records each - the seven body pieces, a shield and a ONE-HANDED
weapon, so all nine are worn at once - of the party's own make, each with three affixes at the Legendary band's
FLOOR (the Regalia's stand at its top: a boss's set over a town's thanks) and a weapon's blow at the band's floor
(7). Their Prince is the Bay's towns. Nothing drops them but a town defended online: a raid's receipt (RAID3's `w1`)
rolls a town's thanks, and a quarter of the time the last thing in it is a piece of the raiding party's own set
(`03-World/Raiding-Parties.md`, "The rewards"; `systems/raidSpoils.js`, `systems/aetheric.js` `RAID_SET_PIECES`). No
world drop, shelf or Broker rolls one.

**The Broken Oath** - the shield the town stands behind (the knights', Mithril): The Oathkeeper's Helm, the Oathbound
Pauldrons, The Watch-Captain's Cuirass, Gauntlets of the Sworn, Greaves of the Last Stand, Boots of the Long Watch,
The Last Oath (Kite Shield), Oathsunder (Longsword).

| pieces | ability | Faint -> Ascendant |
|---|---|---|
| 2 | **Oath of the Watch** - armour on every part, Willpower | +1 -> +4; +2 -> +6 |
| 4 | **Riposte** - when a foe's blow lands on you (takes health), your next weapon blow within 4 s deals more; that blow alone | +15% -> +40% |
| 6 | **Hold the Line** - while you are under half health, you take less damage (whole points, the fraction carried to the next hurt) | 10% -> 25% |

**The Thief-Taker's Garb** - the one who runs them down (the bandits', Elven): The Thief-Taker's Helm, the
Warrant-Bearer's Pauldrons, The Thief-Taker's Cuirass, Collaring Gauntlets, Chase-Greaves, Boots of the Long Pursuit,
The Reeve's Buckler, The Reeve's Warrant (Saber).

| pieces | ability | Faint -> Ascendant |
|---|---|---|
| 2 | **Keen-Eyed** - Agility, Archery | +2 -> +6; +4 -> +12 |
| 4 | **Run Them Down** - your weapon blows at a foe under half its health deal more, arrows too | +8% -> +20% |
| 6 | **No Escape** - a kill marks the nearest other foe within 12 m of you for 10 s (never an ally, a foe at peace, one a storey away or behind a wall; a kill with none in reach leaves the mark as it stood); your weapon blows deal it more | +15% -> +40% |

**Orcsbane Harness** - the one the horde breaks against (the orcs', Orcish - the horde's own metal): Tusk-Crest Helm,
the Orcsbane Pauldrons, The Horde-Breaker's Cuirass, Knuckle-Breaker Gauntlets, Orcsbane Greaves, Boots of the Held
Gate, The Warlord's Last Sight (Round Shield), The Tuskbreaker (Mace).

| pieces | ability | Faint -> Ascendant |
|---|---|---|
| 2 | **Thick-Skinned** - Endurance, Blunt Weapon | +2 -> +6; +4 -> +12 |
| 4 | **Blood for Blood** - each foe's blow that lands on you is a stack for 8 s, the newest refreshing every one, up to five: weapon damage a stack | +3% -> +8% |
| 6 | **Iron Hide** - a kill, when it is ready, wards you: the next damage you take is turned aside point for point; a ward is never piled on a ward; then it must recover | 10 -> 40 points; recovers 60 -> 30 s |

"Lands" is SET's own word (AUDIT SET L2/L3, AUDIT FINAL F10): a foe's blow that took health through my damage door - a
fall, a poison, a spell, a blow a Shield spell swallowed whole or a ward turned aside wholly arms nothing. The HUD's
chips show No Escape while a mark stands and Iron Hide's ward (its points) while it holds, then its recovery; a mark or
a ward left over from six pieces shows nothing and does nothing on four. The sounds: a drawn blade for the mark, iron
closing for the ward.

**On the card (CARD-FIT, 2026-09-28).** A set piece's card says its set in a SHORT dress: the name, the pieces worn and
the stage in one head, the nine places, what would raise it, and each tier as one row - its BRIEF (every tier's, the
three raid sets' too: "Cheat death, then half damage 4s", "Kill marks next foe: +15% (10s)"), a recovery as its own
dashed tag - with the sentence under the pointer; the sigil in two rows. The Info box says it all: the Prince and the
role, every sentence above, the sigil's notes. `01-Overview/bugs/Field-Bugs-2026-09-28c.md`.

## 6c. The sea serpent's own set (SERPENT-SET, 2026-10-05)

Mac: *"The serpent boss needs to use the currency from oblivion gate and have its own equipment rewards"*. One more
Aetheric set, **Sethrakul's Coilscale** - the Old Coil, shed and worn - and its patron no Daedra: Satakal, the
World-Skin the Redguards say sheds the world as a snake sheds its skin (`Sea-Serpent.md`). Nine fixed records of
Ebony, the deep's own black - the seven body pieces, a kite shield and a ONE-HANDED Katana, so all nine are worn at
once - each with three affixes at the Legendary band's MIDDLE (armour 16, an attribute 13, a resistance 43, a skill 25,
weight 43, damage 30) and the Fang's blow the band's middle too (10): a world boss at sea, over a town's thanks (the
floor) and under the gate's Warden (the top). One resistance of an element at most, and never frost - the 2-piece tier
carries it - so no two pieces stack an element toward the saving throw's immunity (AUDIT FINAL's lesson on the
Regalia). Nothing drops it but the serpent: a ship that DEALT Sethrakul its share finds a piece in its hoard a quarter
of the time (the raids' own share), rolled after everything the hoard rolled before (`systems/serpent/serpentSpoils.js`,
`systems/aetheric.js` `SERPENT_SET_PIECES`, `rollSerpentSetPiece`); a ship that stood, never. No world drop, shelf or
Broker rolls one - a boss's own set earned where it is fought, as the raids' are.

Sethrakul's Crest, the Coilscale Right and Left Pauldrons, The Old Coil's Hide, Constrictor's Grip, Undertow Greaves,
Tide-Walker Boots, The Maelstrom's Eye (Kite Shield), Sethrakul's Fang (Katana).

| pieces | ability | Faint -> Ascendant |
|---|---|---|
| 2 | **Sea-Scale** - frost resistance, Endurance | +10 -> +30; +2 -> +6 |
| 4 | **Constrict** - each weapon blow of yours that LANDS on a foe tightens ITS coil: weapon damage to that foe a stack, up to five, held 6 s after the last blow on it; every foe holds its own coil (AUDIT 625 P3, Mac: "A coil per foe" - one coil had moved to whichever foe was struck last, so a sweep that met two never built it), a bow's blow counts, a coiled foe's death ends its own | +3% -> +8% a stack |
| 6 | **Shed Skin** - a foe's blow that takes you under 35% of your health (from at or over it, still standing) sheds your skin: that share of your health returns at once; then it must recover. A killing blow, a fall or a spell sheds nothing - nor a killing blow a death save turned aside (AUDIT 625 P1: Unbroken, Divine Grace) | 10% -> 30%; recovers 240 -> 120 s |

Shed Skin heals through the one heal a power gives (`systems/playerHeal.js` - LOOT4's leech and its heals moved there
from `systems/loot/lootPowers.js`, which reads the blow's law out of `systems/sigil/sigilSetPowers.js` and so may not be imported
by it). The HUD's chip shows Shed Skin's recovery; its sound is a large splash, the old skin into the sea. The hoard
pays the gate's currency too - a Deadlands Ember, every hoard (section 7's Broker and the insignia take it as a
breach's; `Sea-Serpent.md` section 8).

## 6d. The Brass Remnant's own set (SD9d, 2026-10-07)

`Super-Dungeons.md` section 11: one more Aetheric set, **The Brass of Numidium** - what the Warp kept of the Walking
Brass - and its patron no Daedra: Kagrenac, the Tonal Architect who built it. Nine fixed records of Dwarven make, the
Dwemer's brass - the seven body pieces, a round shield and a ONE-HANDED Longsword, so all nine are worn at once (the
design had named a longsword, a war axe and a staff: three weapons for the one place a set counts) - every affix at the
Legendary band's TOP (armour 20, an attribute 15, a resistance 50, a skill 30, weight 50, damage 40) and the
Hour-Hand's blow the sigil's greatest (12): the hardest fight in the game pays what the gate's Warden does, the
Regalia's measure. One resistance of an element at most, and never magic or shock - the 2-piece tier carries them.
Nothing drops it but the Brass Remnant: its spoils carry a piece a third of the time, rolled after everything they
rolled before (`systems/aetheric.js` `NUMIDIUM_SET_PIECES`, `NUMIDIUM_SET_CHANCE`, `rollNumidiumPiece`; the spoils are
SD9e's). No world drop, shelf or Broker rolls one.

The Brass Visage, the Right and Left Pauldrons of the Walking Brass, The Heartcage, The Tonal Architect's Hands,
Greaves of the Unmade Stride, Boots of the Unmoored Step, The Gear-Face (Round Shield), The Hour-Hand (Longsword).

| pieces | ability | Faint -> Ascendant |
|---|---|---|
| 2 | **Dwemer Brass** - magic and shock resistance | +4 -> +10 each |
| 4 | **Gearward** - the next foe's blow that lands on you is lighter, in whole points; then the gear winds again (its recovery, the card's tag). A fall, a poison's round or a spell is never lightened and never unwinds it, nor is a blow too small to lighten by a whole point; the Brass Remnant's own blows and its Echoes' are a foe's for it, never the Hour's magic (section 8) | 15% -> 30%; recovers 18 -> 12 s |
| 6 | **The Hour Turns** - a blow that would kill you does not: you are left at 1 and that share of your health returns at once; then it must recover. A death save, as Unbroken is - a fall's death is turned back too - and never worn with the Bulwark (six and six is past nine places) | 15% -> 25%; recovers 90 -> 60 s |

The Hour Turns heals through the one heal a power gives (`systems/playerHeal.js`). The HUD's chip shows its recovery.
Their sounds are the Orrery hall's (`scenes/superDungeon/sdHall.js`): Gearward the hall's gear, The Hour Turns its low bell.

## 6e. The Spire's own set (EG15, 2026-10-12)

`Elite-Gates.md` section 19: one more Aetheric set, **The Battlemage's Panoply** - the war-gear the Imperial Battlemages
wore in the Spire, taken by the Kyn - and its patron no Daedra: the Imperial Battlemages themselves. Nine fixed records of
Mithril, light enough for a spellsword - the seven body pieces, a kite shield and a ONE-HANDED Saber, so all nine are worn
at once - every affix at the Legendary band's TOP and the Spire-Saber's blow the sigil's greatest (12): the Spire's top
drop pays what the Warden and the Brass do (the design's "No Gilded piece"). No resistance on any piece: Battlemage's
Bearing raises every one, so the set alone stands at +15 an element at most, far under the saving throw's immunity (AUDIT
FINAL's lesson). Each record's id is the pay law's (`net/eliteGates/egPay.js` `EG_PANOPLY_IDS`, `panoply-<key>`), the one the
account service's weekly sink sells by. It rolls no drop of its own: a Redoubt's spoils decide WHETHER (`systems/eliteGates/egSpoils.js`
`rollEgSpoils` - the pay law's draw and the service's pity) and `mintPanoplyPiece` picks WHICH, off one draw; the sink
mints by id (`panoplyPieceById`). No world drop, shelf or day's stock rolls one: her day's stock stays the four sets of the
world and the Regalia (`systems/aetheric.js` `PANOPLY_SET_PIECES`).

The Battlemage's Warhelm, the Battlemage's Right and Left Pauldrons, The Battlemage's Cuirass, The Battlemage's
Gauntlets, The Battlemage's Greaves, The Battlemage's Boots, The Spire-Shield (Kite Shield), The Spire-Saber (Saber).

| pieces | ability | Faint -> Ascendant |
|---|---|---|
| 2 | **Battlemage's Bearing** - every resistance, and your maximum magicka (a fold channel of its own, `magicka`, read by the live maximum beside Renown's term: never kept by a save, never under the magery's third) | +5 -> +15 each; +10 -> +30 magicka |
| 4 | **Battlemage's Discipline** - a spell you cast arms your next weapon blow with its element (that blow alone, never a fist's; a foe that resists the element takes half, an immune foe none, and the arm is spent all the same); each weapon blow that lands, a bow's too, returns a share of your last spell's cost as magicka | +20% -> +50% of the blow; 5% -> 15% of the cost |
| 6 | **Battlemage's Reprieve** - a foe's blow that takes you under 20% (from at or over it, still standing - never a killing blow, a saved one, a fall or a spell) raises a shield of a share of your maximum health for 6 s, spent point for point on whatever comes, and shields your allies within 8 m for half of it; then it must recover | 15% -> 40%; recovers 240 -> 120 s |

The cast is told by a seam of its own (`systems/playerCasts.js`, at the one cast engine's release - `scenes/hostMagic.js`
`done()`), and the return comes through the one magicka a power gives (`systems/playerHeal.js` `manaMine`: SCHOOLS3's
home of the one magicka gift, which EG15 had also moved there whole from `systems/loot/lootPowers.js`, as `gainMana`). The
allies' half is no reach of the set's: a player's vitals are their own client's (ALLY-CAST), so the host's door
(`setSetPowersAllies`) casts a Shield at each ally and their client lands it as its own pool. 6 s is no whole number of magic rounds (a round is 5 s of the shared clock online), so an ally's Shield is rounded up
to whole rounds and given one more, as Eventide's is: three rounds, at least the 6 s the card says (10 to 15). Its points
ride the cast frame's byte (255 at most). **The Spire's recovery** (`Elite-Gates.md` section 15): in an Elite Breach the
Reprieve, Unbroken, The Hour Turns and Shed Skin are no timers - spent there, each is held to the next Redoubt taken, and
its chip reads *Redoubt*; out of that breach its own timer governs again. The HUD's chip shows the Reprieve's shield (its
points) while it holds, then its recovery; its sound is a Shield spell's own cast. A Spire lord's blow is a foe's to it (section 8, AUDIT EG V).

## 6f. The Starfall's own set (STAR7, 2026-10-20)

`Starfall.md` section 6: one more Aetheric set, the law's thirteenth, **The Starspun Weave** - the coven's thread, turned
on the coven - and its patron Mephala, the Webspinner, whose covens wind black thread about a fallen star to draw its
light home: the Weave is that thread, cut from the stars they lost and laid over pale plate. Nine fixed records of Elven make, light as the thread
is - the seven body pieces, a buckler and a ONE-HANDED Shortsword, so all nine are worn at once - every affix at the
Legendary band's FLOOR (armour 12, an attribute 10, a resistance 35, a skill 20, weight 35, damage 20) and the
Spindle-Blade's blow the band's floor too (7): the raiding parties' measure, since a star is held three times an hour
while the festival runs. One resistance of an element at most, and never poison - the 2-piece tier carries it. Nothing
drops it but a held star: its spoils carry a piece a quarter of the time (the raids' own share), the Heart-Star's every
time, rolled after everything they rolled before (`systems/aetheric.js` `STARSPUN_SET_PIECES`, `STARSPUN_SET_CHANCE`,
`rollStarspunPiece`; the spoils `systems/starfall/starSpoils.js`). No world drop, shelf or Broker rolls one.

The Starspun Cowl, the Right and Left Pauldrons of the Weave, The Starspun Cuirass, The Spinner's Hands, Greaves of the
Silent Strand, Boots of the Long Fall, The Web-Buckler (Buckler), The Spindle-Blade (Shortsword).

| pieces | ability | Faint -> Ascendant |
|---|---|---|
| 2 | **Spinner's Thread** - poison resistance, Agility | +10 -> +30; +2 -> +6 |
| 4 | **Bound in Silk** - every 4th weapon blow of yours that LANDS on the same foe is the one the web holds still: that blow deals more, and its landing cuts the count back to none, whatever its weight. Only a blow that counts whole lays a strand (an off hand's part-blow lays none). Every foe holds its own count (Constrict's law), which falls away 8 s after your last blow on it; a foe's death ends its own; a bow's blow counts | +60% -> +140% |
| 6 | **Mephala's Veil** - a foe's blow that takes you under 30% of your health (from at or over it, still standing - never a killing blow, a saved one, a fall or a spell) hides you in the web: Chameleon on you, Eventide's own spell under the Veil's name, its rounds and one more (AUDIT SET M5); then it must recover. Never one of the Spire's death saves: it hides you, it saves no life | 2 -> 4 rounds (10 -> 20 s); recovers 240 -> 120 s |

Bound in Silk is read where every blow is (the BLOW modifier) and counted where a blow lands (the STRIKE listener) - the
blow after three strands is the held one, so a blow that never lands spends nothing. The held blow is the BLOW's whatever
its weight, so its landing cuts the count whatever its weight (AUDIT STAR S1: the cut had waited on a blow that counts
whole, so an off hand's part-blow on three strands took the bonus and left the three standing, and the next blow took it
again). The Veil is cast through the door Eventide's shadow takes (`systems/playerDoor.js` `castOnPlayer`), and heard as
its cast; it says what it does (*Mephala's Veil! Chameleon for 10 s.*), and its spell's name and its chip's (*Veil*) are
the player's language's (`sigilSetPowers.js` VEIL_TEXT). The HUD's chip shows the Veil's recovery.

**Every chip carries its tier** (AUDIT STAR S2): `setHudChips` sets each chip's `tier` (CHIP_TIER, the 6-piece's index),
`ui/hud/hudStatus.js` carries it onto the tile, and the hover card reads the tier by it (`ui/enhanced/enhancedHud.js`
setTileTier). It had found the tier by the chip's name as a prefix of a tier's, so *Veil* and *Reprieve* (*Battlemage's
Reprieve*) found none, and no chip named in another language found its tier at all.

**DESIGN NOTE - the full-health guard wakes the Veil** (AUDIT STAR S3). A foe's blow from full health that would kill
leaves the player standing at 1 (the guard in `characters/playerEntity.js` hurtPlayer). That is no death save - the HURT
listener hears it unsaved - so the blow crosses the Veil's line and the Veil hides the player at 1, as Shed Skin heals
them there. Kept on purpose: hiding at 1 health is what the Veil is for.

## 6g. The Witches' Festival's own set (WITCH1, 2026-10-20)

`06-Systems/Witches-Festival.md`, "The Wyrd's Raiment": the law's twelfth set, **The Wyrd's Raiment** - what the Glenmoril
Wyrd wear to the Witches' Festival, its patron the Wyrd themselves (`sigilSets.js` `wyrd`, `sigil.js` `SIGIL_SET_IDS`
before the Weave). Nine fixed records (`systems/aetheric.js` `WYRD_SET_PIECES`), Legendary at least: hood, mantles,
cuirass, gloves, greaves, boots, the Hearth-Ward shield and the Witchmoon Athame. Leather, a witch's and a caster's (the
Athame Elven). Sold by the Wyrd Sisters at the taverns' doors for Soul Cakes, BOUND to the buyer as the Broker's wares
are, and never a drop.

| pieces | ability | Faint -> Ascendant |
|---|---|---|
| 2 | **Wyrd-Sight** - Willpower and magic resistance | +2 -> +6; +5 -> +15 |
| 4 | **Tallow-Ward** - your weapon deals more to the undead, the Daedra and the atronachs (`systems/festival/festivalFoes.js` hallowedFoe) | +10% -> +30% |
| 6 | **Soul Harvest** - a kill restores a share of your health and magicka; then it must recover | 8% -> 20%; recovers 40 -> 20 s |

Through the same seams: Wyrd-Sight the FOLD, Tallow-Ward the BLOW, Soul Harvest the KILL listener (`sigilSetPowers.js`).
Its words are the festival's (`systems/festival/festivalWords.js` HARVEST_TEXT - its name, its proc, its recovery's end).

## 6h. The deep sea's own set (SEA-SET, 2026-10-22)

`03-World/Eltheric-Ocean.md` SEA-SET (the owner: "Build ever single bit of this and dont return until its perfected" - the
Eltheric Ocean's Abyss-only gear): one more Aetheric set, the law's fourteenth, **The Eltheric Tidemail** - what the deep
gives back to those who sail it - and its patron no Daedra but the Drowned Queen, Maraveth, Thrice Drowned: the sea's
legends are its makers, and every piece was taken off one of them (`sigilSets.js` `eltheric`, `sigil.js` `SIGIL_SET_IDS`
last). Nine fixed records of Adamantium, the one metal no other set wears - the seven body pieces, a round shield and a
ONE-HANDED Saber, so all nine are worn at once - every affix at the Legendary band's MIDDLE (armour 16, an attribute 13, a
resistance 43, a skill 25, weight 43, damage 30) and Maraveth's Mercy's blow the band's middle too (10): the Old Coil's
measure, since the deep is a world boss's ground. One resistance of an element at most, and never shock - the 2-piece
tier carries it (`systems/aetheric.js` `ELTHERIC_SET_PIECES`, `AETHERIC_RECORDS` last).

The Drowned Admiral's Helm, the Right and Left Pauldrons of the Deep, The Tidemail Cuirass, Gauntlets of the Wheel,
Greaves of the Sounding Line, The Hooded Pilot's Boots, The Starless Shield (Round Shield), Maraveth's Mercy (Saber).

**Where it comes from - the deep alone** (`ELTHERIC_CHANCE`, `elthericChance`, `rollElthericPiece`, each source's last roll
on its own stream, so every earlier roll stays what it was for its seed; the Shallows and the Reaches carry none):

| source | the Deep Aether | the Abyss |
|---|---|---|
| a legend sunk or taken (`navalHost.js` legendTidemail, off her seed `^ TIDEMAIL_SALT`, into the boat I sail) - the Deep's Ninefold Hunger and Lantern-Eater, the Abyss's Pale Regent and Starless; the Reaches' two carry none | 1 in 4 | every time |
| a vault of the deep's pile (SEA-VAULTS - the hall's ring the door stamps, `seaSpoils.js` seaPileSource) | 1 in 4 | 1 in 2 |
| an isle's ruin's treasure pile (`systems/sea/seaSpoils.js` seaPileMore - the layout's pile offline, a pile the room emptied, and the room's seeded base online, on its own dice) | 1 in 20 | 1 in 10 |
| the treasure fleet's flagship sunk or taken (SEA-EVENTS, `scenes/naval/treasureFleet.js` ended, off her seed `^ TIDEMAIL_SALT`, into the boat I sail) | every time | every time |
| a cask of the Aether Storm's wrack (SEA-EVENTS, `scenes/seaVenturesHost.js` gather, on the cask's own stream - `seaEvents.js` wrackOf) | 1 in 40 | 1 in 20 |

No world drop, shelf or Broker rolls one. These are the client's rolls, as a Legendary's are: no relay or service receipt
seeds the sea's legends or its ruins (the gate's, the serpent's, a star's and the Spire's sets ride one) - the item law
holds each piece to its record (item law 11, `itemLaw.js` ITEM_LAW_VERSION; acct172), never to its source.

| pieces | ability | Faint -> Ascendant |
|---|---|---|
| 2 | **Stormwrack** - shock resistance, Speed | +10 -> +30; +2 -> +6 |
| 4 | **Undertow** - your weapon deals more while you stand in the open Eltheric Ocean (the open PvP zone on the sea's ground: `wildZone.js` wildZoneKind, never Veilhaven's peace), and half of that anywhere else | +15% -> +40% (half ashore) |
| 6 | **The Captain's Due** - your ship's guns deal more, and your ship takes less from guns and rams | guns +10% -> +30%; hull -10% -> -25% |

Through the same seams and one of its own: Stormwrack the FOLD, Undertow the BLOW (a weapon's blow alone; the half carried
as every per cent is), and the Captain's Due THE SHIP'S DOOR - `sigilSetPowers.js` `captainsDue(entity)`, the player the
player's door names (`systems/playerDoor.js` player()), read by the naval host at each of my balls over her Guns refit
(`navalHost.js` gunsRefit) and at a ball's (`dueOnHull`) or a ram's hurt on a ship of mine. A serpent's blow is no gun's nor
a ram's: the tier leaves it whole, as it says. It has no timer, so no chip.

## 7. The Sigil Broker - Sigil Stones buy the day's stock (SET7)

A Daedra trader (the game has no Dremora sprite; a Daedra Seducer stands in) is held at each breach's faithful's
circle - BROKER-CAGE (2026-10-02, Mac: "she should be present at the site in a jailed gate, and the gate opens after all
the enemies are cleared"): caged from the omen, freed when every one of the faithful falls before the breach opens, and
standing until the Wrath's midnight either way (`11-Multiplayer/World-Bosses.md` section 19 E). The stock is the DAY's (UTC, the shared clock's), minted from the day alone, so every player in the Bay
sees the same pieces; it turns over at midnight UTC. It takes only Sigil Stones - the gate's own trophy, one a kill -
and each character may buy each offer once that day. The stones STACK, with their own kind alone, and are BOUND: never
traded between players (SS1), nor dropped or put in a container (SS3).

| slot | offer | price |
|---|---|---|
| 1-4 | a piece of each set of the world - Malacath's, Dagon's, Nocturnal's, Mora's - a body piece or a shield (a shield one place in eight), Rare, or Legendary one time in four off the base game's own records | 4 stones (a Legendary 6) |
| 5 | a set weapon of one of the four, Rare, its blow from the Rare band | 6 stones |
| 6 | a piece of Ruhn's Regalia, Aetheric | 12 stones |

The prices are twice SET7's 2 (3) / 3 / 6 (SS2, Mac: "raise the prices on the new boss vendor"), the four in the same
proportion. A receipt is a gate's, and a gate opens every two hours: a player at every one wins twelve stones a day, two
thirds of the whole stock at SET7's prices. The Regalia now costs twice the kills its own drop (a sixth of them) takes
on average.

Every piece is KNOWN, of the ladder's finer makes (Dwarven, Mithril, Adamantium, Ebony, Orcish, Daedric), and fresh at
Faint. The stock is minted from FIXED TABLES - the game's own templates and materials by index - never a roll over the
registered custom pieces or the player's level: the WB5 spoils read the player's world, and a shop every player shares
must not. The record of what a character bought rides that character's SAVE, not the device, so it travels with the
pack it describes: a save from before a sale holds its stones and its unmarked offer alike.

**The price in gold** (AUDIT SET D2, D5; re-measured at SS2; closed at SS4). A stone sold as a gem of 5,000 (the WB5
spoils' record). What it bought resold for more: over two thousand days of stock (days 0 to 1,999 of the shared clock, the
Regalia's fire at +10 a piece), 6,926 of value a stone spent - a set's armour 7,751 a stone, the Regalia 8,265, a set
weapon 1,767 - the game's own values for the finer makes (ItemBuilder's arithmetic, `itemBaseValue`), the Aetheric's
worth on top, every piece fresh (so Roleplay & Realism's condition-based prices, when on, read each at its whole
value). At SET7's prices it was twice that (13,852; 15,501, 16,531, 3,533). The gap is the design, and it stays: a
stone is worth most at its own vendor. One stone a kill and one of each offer a day bound what it can pay - the whole
stock is thirty-six stones, about 250,000 of value, of which a merchant pays its trade price. Raising the stone to
match would only pay more gold for stones never spent at the Broker. SS4 closed both counters: neither a stone nor a
ware the Broker sold is bought by any counter now (both are bound), so the figures above are a record, not a route to
gold - a stone's only worth is at its own vendor.

**The Battlemage's Panoply, once a week** (EG-E1, 2026-10-12; `11-Multiplayer/Elite-Gates.md` section 19, THE SINK).
Beside the day's stock and the insignia, the Broker sells one piece of the Spire's set of the buyer's choosing - the
Warhelm, either Pauldron, the Cuirass, the Gauntlets, the Greaves, the Boots, the Spire-Shield or the Spire-Saber - once
an account an arena week, for 20 Deadlands Embers. It is the account service's law, not her day's stock: the sale is
recorded there (`server-account/src/egEconomy.js` egSink, the table `eg_sink`), paid from the purse the insignia spend
(the Spire's embers in it), and the client takes the embers from the pack and mints the piece (`systems/sigil/sigilBroker.js`
panoplySale, the insignia's two halves). The piece carries no Broker price (`stonesPaid`): no dismantle pays its embers
back, and the day's prices (`BROKER_PRICES`) are unmoved. Her window lists the nine pieces under the insignia, their
price and their week (`ui/brokerWindow.js`).

## 8. What it does not do, said so

- No server checks a set piece, as none checks a sigil: a forged save can carry one (`Multiplayer.md` "Trust").
- A client older than SET6 knows no `aetheric` tier: a list, a trade or a grant carrying an Aetheric piece is refused
  whole there (the loot validator's tier whitelist), as a pre-SIGIL1 client refused a sigil. Every client updates
  with the deploy.
- Jewellery, clothing and artifacts are never set pieces.
- A set never works offline or in a duel.
- The gate's Warden is out of every reach power's reach (AUDIT SET P-L9): he is never one of the host door's foes, and
  his strikes land on the player without the attack formula's struck tail - so Spite, Cleave and the Nova never touch
  him, and his fall is no kill of the Rampage's or Eventide's. The court is the gate's own fight. AUDIT SETS L4: and so
  Riposte and Blood for Blood never arm off his strikes, No Escape and Iron Hide never trigger on his fall, and Run Them
  Down never reads him under half (his stand-in holds a billion); a blow his ward turns aside spends no power.
- The Brass Remnant is out of every reach power's reach as the Warden is (its strikes land through the court's door,
  no struck tail) - but one power answers it (AUDIT SD): its own set's Gearward, which would otherwise never meet the
  fight that drops it. A body's own blow - the Stomp, the Hand, the Volley, the Remnant's or an Echo's; never the Hour's
  unresisted magic over the whole floor (the Pulse, the Reset, the End), never the burning brass - is marked as a world
  boss's as it lands (`scenes/superDungeon/sdRemnantBlows.js` `bodysBlow` -> `setBossStruck`), taken by the damage door as it
  opens, and read by Gearward alone: Spite, the Wrath, Riposte, Blood for Blood and Shed Skin hear no foe in it, and the
  loot's blow listeners none. The Warden's court marks nothing (its bytes are the gate's).
- The Spire's lords and its legion (`Elite-Gates.md` section 15) strike through the dungeon context's door too, no struck
  tail - and the two hurt-listener saves the Spire holds to its next Redoubt answer them (AUDIT EG V: neither had ever
  triggered there, where the Panoply drops): a body's blow is marked as a Spire foe's as it lands (`scenes/eliteGates/egFight.js`
  landShare -> `setSpireStruck`; never a hazard's, a zone's or a drain's), taken by the damage door as it opens, and read
  by Shed Skin and the Reprieve alone. Spite, the Wrath, Riposte, Blood for Blood and the loot's blow listeners hear no foe
  in it - no foe of the door's stands behind it.
- AUDIT SETS M2: a client older than RAID4b cannot read a raid set's sigil. A room's container word it cannot read is
  now marked unreadable and never landed, claimed, closed over or opened - from this build on; a tab still running a
  build before it refuses the list and claims the container with its own roll, as it did. The relay's deploy drops
  every connected player once and the update notice asks an old tab to reload.
- A spell's price is set when it is readied (AUDIT SET P-L4): one readied just before a duel is cast once in it at
  Mora's discount. One cast; recorded.
- A Test Room character plays offline (AUDIT SET D4): the room hands its character every Legendary and the Regalia
  whole, to look at. Its saves carry the mark; the Online pane's button is dead for it, saying why; a boot that would
  bring it online by any URL boots it offline and says so.
- Stones won in a court are spent the same night only where the rite was cleared: her cage opens only by the faithful
  falling, every one, before the breach opens (BROKER-CAGE); freed, she stands until midnight - a Warden fallen early
  no longer takes her. Where the faithful passed into the breach she stays caged that night, and the stones wait for
  the next breach.
- The raiding parties' sets (6b) come from a town defended online, at a relay that keeps raids (RAID3), and from
  nothing else: offline, a town's cleanse pays RAID1's reputation alone.
- The Brass of Numidium (6d) comes from the Brass Remnant's spoils and nothing else: a Super Dungeon's last fight,
  online, at a relay that keeps the Hollows (`Super-Dungeons.md` section 11).
- A Sigil Stone is bound (SS1, SS3, SS4), and so is every piece the Broker sells (SS4): it is never traded, dropped,
  put in a container or sold - a container is the room's once it is opened online, a body is granted to whoever loots
  it, and a shop's shelf is the room's too - and a list a peer hands over lands without one. It goes into the player's
  wagon and the player's own storage (a ship's chest, an owned house's cupboards, a placed storage piece - each opens
  for its owner alone), and to a smith or a sage, because it comes back.
- A ware bought before SS4 carries no mark and stays unbound: nothing on a piece says where it was won (a set piece
  also drops from a fight, fresh and of a party of one), and the Broker's record keeps only the day's ids. For the
  same reason a ware bought before SS5 carries no price and is never dismantled.

## 9. The slices

| slice | what | shippable alone because |
|---|---|---|
| SET1 | the record, the registry, counting, tiers, the stage | the law, pure; nothing drops yet |
| SET2 | the seams the abilities need (vitals, blows at the player, kills, spells, the unaware) | each seam a no-op until read |
| SET3 | the four sets' abilities | a test set wakes them |
| SET4 | drops and growth | sets appear and grow online |
| SET5 | the card, the tiles, the paperdoll's sets | a player can read them |
| SET6 | Aetheric and Ruhn's Regalia | the boss drops it |
| SET7 | the Sigil Broker | the stones buy the day's stock |
| RAID4b | the raiding parties' three sets (6b) | a town defended pays them |
| AUDIT SET | the whole arc, audited: four lanes, every finding fixed or said here | - |
| SS1, SS2 | the Sigil Stone stacks and is bound; the Broker's prices doubled | a pack's stones fold on load, and the Broker reads the stacks |
| SS3 | a bound stone is never dropped; the portal where he fell is pressed | the pack says why; the press is the bridge's own |
| EG15 | the Spire's own set, the Battlemage's Panoply (6e), and the Spire's recovery for every death save | its records and powers stand alone; a Redoubt's spoils and the Broker's weekly sink pay it (`Elite-Gates.md` EG14) |

## 10. What shipped, slice by slice

### SET1 - the law (2026-09-26)

`systems/sigil/sigil.js`: the record grows `set` (one of `SIGIL_SET_IDS`) and `power` stops being required - `validSigil`
takes a power, a set or both, never neither; `sigilSetId`, `sigilHasBlow`; every reader of the power (the per cent,
the words, the card's model) reads a set's armour as no blow. `systems/sigil/sigilSets.js`: the five sets and their numbers
(section 3, section 6), `stageValue` (the line from Faint to Ascendant), what may be a piece (`setPieceKind`: a body
piece, a shield, a weapon - never ammunition, jewellery or clothing), the worn pieces per set (`wornSetPieces`: the
seven body slots, the shield, one weapon a set), the state (`setState`: the count, the lowest piece's stage under the
Renown's cap, `heldPiece` / `heldRenown`, the tiers awake by the count), the session (`setSetsDueling`, `setsAwake`)
and the powers' one question (`awakeTier` - my entity alone). Pinned: `test/systems/sigil/set1_law.test.js` (7);
`tools/mutants/set1.json` (15, all dead).

### SET2 - the seams (2026-09-26)

Every seam the powers read, each a no-op until registered:

- **The blow's word.** `combat/playerWeapon.js foeUnaware` (the foe's AI has not detected me; never a puppet's) is read
  where the foe RECORD is in hand - the swing (`resolveHit`) and the shaft (`arrowFlight.js`) - and carried as
  `unaware` through `calculateAttackDamage` to every blow modifier's new fifth argument (`entityMods.js
  weaponBlowMods`), and handed to a registered replacement core too.
- **PCAAO's core reads the port's layers - a bug found on the way.** PCAAO (Kirk.O's Physical Combat And Armor
  Overhaul) is ON by default with its redone armour formula, and that core replaces the stock one whole - and read
  neither of RF1's two layers: the weapon's own modifiers (a Loot Rarity damage affix) and the blow modifiers (SIGIL1's
  sigil). In a default game no damage affix and no sigil had ever landed. `pcaaoWeaponAttackDamage` reads both now, at
  the stock's own two places, so the sets' blows (and the affixes, and the sigils) land under either core.
- **The player's damage door** (`characters/playerEntity.js hurtPlayer`): `registerPlayerDamageMod` (before the
  shield), `registerPlayerDeathSave` (a live player left at 1, before the guild's avoid-death is asked),
  `registerPlayerHurtListener` (told what landed) - none asked on a SetHealth(0) door (drowning, the exhaustion
  collapse) or a duel's blow.
- **The struck listeners** (`combat/formulas.js registerPlayerStruckListener`) beside the Ring of Namira's one slot.
- **The player's own kills** (`systems/playerKills.js`): every pool's damage door tells it when MY blow killed a foe
  (never a peer's), and a puppet's owner's `slain` word tells it too.
- **A player's cast cost** (`systems/spellcost.js registerSpellCostMod`), never a foe's: the foe caster prices its
  cast with the player's skills (a recorded quirk) and asks with `portMods: false`. Never under 1.
- **The port's absorption chances** (`systems/absorption.js registerAbsorptionChance`), each its own roll under DFU's
  two gates (a Destruction effect, room in the magicka).
- **The door** (`systems/playerDoor.js`): the running host's magic engine publishes its live foes (the town's
  defenders passed by), my feet, a hurt as mine through the foe's own sinks, and a spell on me - every frame it runs.
- **The duel's word**: `scenes/world.js duelFrame` tells `setSetsDueling` (AUDIT 625 P2: kept by `systems/sigil/sigil.js`
  setSigilDueling, and raised for an arena's bout between players too).

Pinned: `test/systems/set2_seams.test.js` (8); `tools/mutants/set2.json` (20, all dead).

### SET3 - what the sets do (2026-09-26)

`systems/sigil/sigilSetPowers.js`, imported by `scenes/world.js` and registered at import - one name (`sigilSets`) at every
seam SET2 opened. Each power asks one question first (`awakeTiersOf`): is this MY entity, with the sets awake (online,
my Renown known, no duel)? For anyone else - a peer's entity here, a foe - and whenever the sets sleep, it does nothing.

- **The 2-piece tiers** are one entity fold (RF1): Orc-Hide's armour on all seven parts and its Endurance, the
  Ravager's Strength and Critical Strike, Shadow's Grace's Stealth and Agility, Forbidden Lore's Intelligence and all
  six schools, the Burning Gate's fire resistance. The fold is recomputed at every equip change and every magic round
  (RF1's own two seams) and, new here, the moment my Renown is adopted or a duel begins or ends (`world.js`), so no
  duel ever opens with a stat tier still standing.
- **The blow** (my weapon's, at a foe, under either core): Bloodfury (twice below half health), the Rampage's stacks,
  Nightfall Strike at an unaware foe (arrows too) and the Wrath's fury are per cents summed and taken of the whole
  blow, the fraction carried on the weapon (SIGIL1's own carry: no per cent is lost to rounding); the Burning Gate's
  sear is flat, after them. Fists are no weapon blow and take none of it - the tiers say "weapon".
- **Cleave**: from the same blow, the nearest other live foe within 3 m (flat) of the one struck takes its share of
  the whole blow, whole and at least 1, through the door as my hurt - a melee blow only, never a bow's or the
  Thunderlock's. A swing that strikes two foes cleaves from each.
- **Spite of the Spurned**: at the attack formula's struck tail (a weapon's, a claw's, an archer's arrow), the foe that
  struck takes its share back through the door - never its last point (BAL5, `05-Combat/Balance-Arc.md` section 11:
  `playerDoor.js` paidBack; the kill is the player's to take, so no foe is won by standing still in front of it).
- **Unbroken**: a death save on the damage door - left at 1, said and sounded, all damage halved for its seconds
  (the halving is a damage modifier, before the shield); then it recovers. Never a SetHealth(0) door, never a duel.
- **Wrath of the Warden**: a hurt listener - a blow that takes me from at or above 30% to under it (a death that
  Unbroken turned is such a blow; a killing one is not) bursts the Nova on every live foe within 6 m of my feet
  through the door, said with the count, and the fury rides my blows for 10 s; then it recovers.
- **The Rampage and Eventide** hear my kills (`playerKills.js`). The Rampage: a stack a kill, three at most, all
  refreshed by the last kill, gone 12 s after it, said as it rises ("Rampage II"). Eventide: the Chameleon spell's own
  effect (classic 23,0 - a strike of mine breaks it) cast on me through the door as a potion is (no save, no roll),
  for whole magic rounds - online a round is 5 s, so 5 -> 15 s; then it recovers.
- **Mora's Mantle**: my spells' price (whole, at least 1, never a foe's), and the Eye as a Spell Absorption chance of
  its own under DFU's two gates - a Destruction effect, and room in my magicka for its cost.
- **"Ready again"** is said at the first magic round after a recovery runs out - once; while the sets sleep it is
  forgotten, not said. The clock is real seconds (`performance.now`): online never pauses, and what a power remembers
  lives for the session - a reload starts every power ready (at most five minutes of Unbroken), no save field.
- **The voice**: a line on the HUD, and a sound by the power's name - Unbroken the parry's ring, the Wrath a fire
  cast, Eventide a magic cast, through the cast sounds' ID door (`audio.playOneShotId`, AUDIT 58's law).
- **The HUD's read** (`setPowerStates`): the Rampage's stacks and seconds, the halving, the fury and every recovery in
  whole seconds - for SET5's chips.

Two tier words were made to say what the seams do: Spite answers "a foe whose blow lands" (a claw or an arrow too),
Nightfall "a weapon blow"; and the Eye says it is absorption, with its gates.

Pinned: `test/systems/set3_powers.test.js` (16); `tools/mutants/set3.json` (55, all dead).

### SET4 - drops and growth (2026-09-26)

- **The win** (`systems/loot/lootRarity.js stampWonWeapons` - SIGIL1's name, every sigil's door now, so every place a list
  is won online stamps set pieces with no new wiring: a corpse at its foe's death outdoors, in a dungeon, a joiner's
  copy, a body the room's memory hands an arrival, the watch's kill, every pile at its mint). AFTER every weapon's own
  rolls - SIGIL1's draws stay the ones they were, and a seeded list is the same list on every machine - a fresh weapon
  sigil joins a set of the world one time in three (`rollSetJoin`), and every Magic-or-better piece of armour and every
  shield rolls a set sigil by SIGIL1's own chance law (`rollSetSigil`: 200 per mille alone, 40 more a fighter, one of
  the four sets at even odds, `{ set, party, xp: 0 }` - no blow). Never a Common piece, jewellery, clothing, a quest's
  piece, an artifact or one already marked; offline, or with the loot ladder off, nothing. The Aetheric set is never
  rolled here.
- **The drink** (`systems/sigil/sigilSets.js drinkWorn`, called by `scenes/world.js sigilDrinks` at every kill's and quest's
  Renown XP): the weapon in my hand drinks (SIGIL1's `drinkSigil`) and so does every set piece I wear - the counted
  ones, each once, the weapon in hand never twice, a piece in the pack never - each a new record, never past the last
  stage. In a duel the pieces sleep (the weapon in hand, SIGIL1's, still drinks); offline nothing does. Past the
  hour's Renown cap nothing drinks, as before.
- **The rise** is said once for a set, when its own rank - its lowest piece's - rises: "Your Dagon's Brand brightens:
  Kindled.", with "Your Renown holds it at ... until Renown ..." when the Renown is lower. The weapon in hand's own line
  is said unless its set has just said one. A fresh piece pulls its set down to its stage until it catches up. A set
  that rose has the fold recomputed at once, so its tiers' numbers move with the line.

Pinned: `test/systems/set4_drops_growth.test.js` (7); `tools/mutants/set4.json` (21, all dead). SIGIL1's stamp pins now say
armour takes a set sigil and a roll of 0 joins a weapon to a set; its mounted drink runs through `drinkWorn`; its
rise mutant is re-aimed to the law's line.

### SET6 - Aetheric, and Ruhn's Regalia (2026-09-26)

- **The rung** (`systems/loot/lootRarity.js`): `aetheric` between `legendary` and `artifact` in `RARITY_ORDER` and
  `RARITIES` (rank 4 - the Artifact moved to 5), `#bfe8ff` and a tint of its own. The ladder's roll takes the ROLLED
  tiers alone now (`applyRarity`: `ROLLED_TIERS.includes(tier)`), so nothing rolls the rung; a piece that wears it is
  never re-rolled. Every reader of the table is generic (the explorer's map, below), so the rung lands everywhere a
  tier shows: the pack's frame and pips (`ui/enhanced/enhancedPlusStyle.js`, the pip a diamond within a diamond), the name's
  colour (`ui/enhanced/enhancedStyle.js`), the native scroller's tint, the plaque, the hotbar, the quickslot diamond, the floor's
  line (`render/spoilsGlow.js`, 2.1 m, pulsing as a Legendary's does), the rare chime and light on the court's floor.
- **The Regalia** (`systems/aetheric.js`, new): nine fixed records - the Horned Crown, the two Pauldrons, the
  Warden-Plate, the Brand-Gauntlets, the Greaves, the Cinder-Boots, the Gate-Shield (a Tower Shield) and the
  Gatecleaver - one for each place a set is worn. The Gatecleaver is a BATTLE AXE: the War Axe takes both hands
  (`characters/equipRules.js WEAPON_HANDS`), and a two-handed Regalia weapon would never be worn with the Gate-Shield.
  `mintAetheric` makes a record an item through the game's own minters (CreateWeapon; SetItem and its condition):
  Daedric, whole, KNOWN, no DFU enchantment (so it breaks and stays under PCAAO's fading module), its affixes a copy,
  a sigil of the Warden's set fresh at Faint, its price its make's, its affixes' and the rung's (`AETHERIC_WORTH`).
  Its record rides a new declared item field, `aetheric` (`systems/item/itemFields.js`), as a Legendary's rides
  `legendary`; its name is its record's, never "Daedric Ruhn's ..." (`systems/item/itemInfo.js itemNameParts`); its lore is
  the card's last line (a registration, `lootRarity.js registerAethericLore` - the ladder cannot import the Regalia
  without a cycle).
- **The drop** (`systems/gate/gateSpoils.js rollSpoils`): after every roll the spoils made before - a Regalia piece a sixth
  of the time (`REGALIA_CHANCE`), the same seed choosing which - so for every seed the gold and the three graded pieces
  are exactly what they were. It leaves the boss last of the pieces, before the Sigil Stone and the gold.
- **The test room** (`systems/testRoom.js`): the loot ladder's showcase carries the Regalia whole.

Pinned: `test/systems/set6_aetheric.test.js` (6); `tools/mutants/set6.json` (20, all dead). The ladder's pins name the rung
(LR1's order and ranks, every tier's colour rule, WB5's line heights and its fourth piece, the test room's count, the
armour mints' population, rf5's every-mint coverage); QS1's key mutant is re-aimed (the quickslot key reads the record).

### SET5 - the sets on screen (2026-09-26)

- **One view** (`systems/sigil/sigilSets.js setCardView`): for a set piece and a wearer (the player by default - the host
  names it, `setSetsWearer`), the set, the nine places its pieces fill and how many, whether this piece is one, the
  stage and what holds it (the piece to grow, the Renown that opens the next), why every set sleeps (`setsSleep`:
  offline, the Renown not yet known, a duel), and its three tiers at the stage. Every surface below reads it.
- **The card** (`ui/setCard.js setCard`, after the sigil's block on the pack's card and in the Info box): the set's
  name in its Prince's colour (the Regalia's in its own), "7/9", the Prince and the role, nine sockets lit where a
  piece is worn, the stage line ("Kindled · Bright when your Helm grows and your Renown reaches 20"; "Asleep · sets
  wake online"; "Wear two pieces to wake it"), and the three tiers, each lit when awake, its numbers at the set's
  stage and Ascendant's under the pointer. Its paragraphs outrank the card's own (which centre every line at 14px).
- **The doll's strip** (`setStrip`, the character column under the accessory shelf): a line a worn set - its name,
  "7/9", three pips lit where awake, its stage; a press shows that set's first worn piece on the card.
- **The rune's colour**: a set piece's corner rune is the sigil's pixels in its set's colour (`ui/sigilRune.js
  sigilRuneTileUrl`) on every frame the pack marks, the hotbar's slot and the quickslot diamond's cell
  (`markSetFrame`; the two repaint keys read the set).
- **The words** (`setLines`), for a surface that prints lines - the classic tooltip, a plaque: the set, the places
  worn, the stage or the sleep, a line a tier with how many pieces more it wants. ASCII, as the classic font draws.
  `rarityLines` carries them; the enhanced card, which draws the block, asks without.
- **The HUD's chips** (`systems/sigil/sigilSetPowers.js setHudChips`, handed to the HUD by the host - `setHudSetChips` -
  because the HUD importing the powers closed a cycle through the magic round's ticker): after the effects, a chip a
  running window ("Rampage II 12s", "Unbroken 3s", "Wrath 10s") burning in its set's colour, and a recovery ("Wrath
  2:50", "Eventide 30s") dashed and dimmed - each only while its 6-piece tier is awake on me.
- **The sigil block for a set's armour** (`ui/sigilCard.js`): it printed "+null% damage at Ascendant" for a piece with
  no blow; it says "A set's sigil: its set grows with its lowest piece" (asleep: "it wakes online, with your Renown"),
  and a fresh one "It grows as you earn Renown wearing it."
- **Words tightened on the way**: the Wrath "takes you below 30% health" (a crossing); the Eye of Mora "absorbed 10% of
  the time - its magicka yours, if you have room for it".

Pinned: `test/systems/set5_ui.test.js` (8); `tools/mutants/set5.json` (22, all dead); the probe `tools/setUiProbe.mjs` (156
checks at a desktop, a laptop and a phone, every state photographed). The card's, the hotbar's and SIGIL-UI's pins
name the new calls; three MERGE-PLUS C8 mutants and SET3's import mutant are re-aimed.

### SET7 - the Sigil Broker (2026-09-26)

- **The law** (`systems/sigil/sigilBroker.js`): the day is the UTC day of the shared clock (the relay's time through the
  welcome's offset, never this machine's), turning at midnight UTC. The stock (`brokerStock`) is minted from the day
  alone on its own seeded stream off FIXED TABLES - the seven body places and the shield's place (one of the four
  shields), the eighteen classic weapons (never the arrow), the six finer makes, the base game's own Legendary records
  (a record a mod registered on one machine never drawn) - so every player sees the same six offers. The prices, the
  one-a-day record in the character's save (`registerModSaveData('SigilBroker')`, read back whole or not at all) and
  what an offer asks (`brokerOfferState`: bought, too few stones, another day's) are the law's. THE SALE
  (`makeBrokerSale`) is made whole or refused whole on the pack itself: the unlocked stones out (LOCK1 - a locked stone
  is never spent), the piece MINTED AGAIN off its day in (never the object the window shows, so nothing the buyer does
  to theirs reaches back into the list), the offer marked - refused, with nothing moved and nothing marked, when the
  host's carry gate (itemTransfer.js planTake, asked of the pack as the stones leave it) says it is too heavy.
- **Where she stands** (`scenes/sigilBrokerPool.js`): at a spot in the gate's own frame (6.4 m across, 10.6 m out on
  the fire's +z face - off the plinth, clear of the horns' roots, beside the approach), carried into the scene every
  frame off the gate's place (`gatePool.state().place`), so a recentre moves her with the gate; on the ground there.
  Only while the gate stands WHOLE - not while it climbs or sinks, not at a beacon alone. Her body is the Daedra
  Seducer's mortal guise (EnemyBasics 29, TEXTURE.284), its idle records by the eight orientations through the
  court's own reader (`bossFrame`), a billboard on the flats' axis; she faces out of the gate and turns to a player
  within 12 m at a walk's turn. Her post stands in the collider (a 0.6 m box under its own bucket, inside her eye's
  box so she never hides herself from the ray), restood when she moves and taken down when she goes. A sprite file
  that will not parse (the pipeline caches what `load` left) leaves her unseen - never a throw in the frame.
- **The press and the plaque**: her own family in the activation race (`player/activationRace.js broker`), right
  after the gate at a tie in the press and the plaque alike, and the ground's rival for a person behind her; her box
  at a static NPC's reach (6.4); her plaque "Sigil Broker / Trades in Sigil Stones". Info says "You see the Sigil
  Broker.", Steal "The Broker's eyes never leave her stones.", any other mode opens her window. The gate falling under
  an open window shuts it, and she says "The Sigil Broker is gone with the gate."; a sale asked of a window left open
  on a gate that fell sells nothing.
- **The window** (`ui/brokerWindow.js`, behind `ui/brokerDoor.js` - a lazy chunk through the one home, warmed with the
  doors): the purse ("3 Sigil Stones · 1 locked") and the turn of the day in its header, the last sale's word under
  it ("You buy the ... for 2 Sigil Stones." or why not - "You cannot carry any more stuff."); six rows - the piece in
  its tier's frame with its set's rune, its name, its set and tier, its price, and a Buy that says why not in a word
  that fits it ("Bought", "Need 3 more"; the whole reason in its title); the pressed piece whole beside the list - its
  tier's lines, its sigil's block and its set's block (the pack card's own), so a build is read before it is bought.
  The back key and a tap on the scrim leave through the door. A concluded sale clinks (the trade window's own sound).
- **Found on the way**: the gate's plaque never showed - `gatePool.hoverName` answered a bare string, and the hover's
  ladder takes the first answer with a `title`; it answers `{ title: 'Oblivion Gate', subs: ['Opens in 4:12'] }` now
  ("Sealed" after 22:00).

BROKER-CAGE (2026-10-02) moved her: caged at the faithful's circle from the omen to midnight, free once every one of
them fell (`11-Multiplayer/World-Bosses.md` section 19 E). Where she stands, her box, her press and her leaving above
are SET7's as built; the cage's are that section's.

Pinned: `test/systems/item/set7_broker.test.js` (8) and `test/player/set7_broker_world.test.js` (9); `tools/mutants/set7.json` (56, all
dead); the probe `tools/brokerProbe.mjs` (221 checks: the REAL renderer drawing her beside a standing gate from three
sides - a frame without her differs where she stands - and the REAL window at a desktop, a laptop and a phone with its
header and every row's pieces clear of each other; its first run caught a refusal's sentence on the Buy starving the
Regalia's name to "Ruh..." and a phone header of one word a line, both fixed). The race's two pins and WB2's plaque
and tie-order pins name the new family and the record.

### AUDIT SET - the whole arc, audited (2026-09-27)

Four lanes read the arc end to end - the Broker in the world and on screen (A), the powers and the law (B), the drops,
the economy, the wire, the saves and the tooltips (C), the powers under the other hosts and cores (D). Every finding
is fixed below or stated in section 8.

- **A - the Broker.** Her post never traps a player: a post that would stand in the player's capsule is not stood
  (`sigilBrokerPool.js postTraps`), and it is restood only when she moves. She stands only by a gate whole and fine -
  not at a coarse beacon, a rising or a collapsing one - and says she is gone only when she was there. A transition out
  of the exterior shuts her window and takes her down; a sale asked of anywhere but the exterior with her standing is
  refused ("gone"). Her words go through the town's voice. The frame reads the gate's place once (cached by origin,
  yaw and day), and a batch's size is written in place. On the classic skin (online, the skin is the player's) her
  window lays its own scoped sheet - the tier colours, the sigil's and the set's blocks, the frame kit's broker rules -
  so it is dressed whatever the skin. The window keeps its header, its note (a live region) and its scroll across a
  sale; rows are buttons to the keyboard (Enter and Space, pressed state said); a sale reads "Bought: <piece>, for 2
  Sigil Stones."; a phone scrolls the pressed piece into view. The doll's strip is a labelled group.
- **B - the powers and the law.** Cleave and the Nova spare my allies and a foe at peace (the swing's own
  `friendlyProtected`), never reach a storey away (`REACH_RISE_M` 2.5 m) or through a wall (the host's collider,
  chest to chest - `hostMagic.js burstClear`), never a foe my weapon's metal cannot bite, and the gate's fire never
  burns a fire-immune foe (the sear and the Nova). Cleave shares the blow that LANDED - a new strike tail at the attack
  formula (`formulas.js registerPlayerStrikeListener`, after either core), where it took the number before PCAAO's
  armour. Spite pays back its share of what a blow TOOK (the formula marks the foe's blow, the damage door says what it
  did - a blow a Shield swallowed pays nothing), and the Wrath wakes only on a foe's blow - never a fall or a poison.
  Unbroken halves in whole points; a voice that throws never turns its save into a death. Eventide lasts at least the
  rounds its card names (one more, for the shared clock's tick). The death of my own ally or the watch feeds no kill
  power (Renown's own rule). A blow modifier that throws is skipped. The powers read the tiers' numbers without
  building their words. The set's held piece is the one furthest behind (least XP); the stage line says what to do
  ("Kindled · Bright: grow your Helm, reach Renown 20"). In a duel a set's armour's sigil says it sleeps (a set
  weapon's blow is SIGIL1's and stays); a set's weapon drinks nothing in a duel, as its set does not; a set sigil on
  what is no set piece answers no set; an unidentified set piece's tooltip still says its sigil and its set.
- **C - drops, economy, wire, saves, tooltips.** The drink reads the weapon in the MODE's hand (indoors and
  underground the street rig is never readied), and the hour's Renown cap is the shared clock's hour, as the
  service's. An enchanted Aetheric piece breaks and stays under PCAAO, as a Legendary does. (Since AETHERIC-MAKER, FIELD BUGS 2026-10-03b, the item maker refuses an Aetheric piece - out of its list, and its
  decision answers `refused` - as salvage and the Reforge do; a piece enchanted before keeps its rows.) A Test Room character
  plays offline (section 8). The wire's item law cross-checks the marks: a set's sigil only on a piece a set counts,
  a blow only on a weapon, the Regalia's set only on an Aetheric piece and an Aetheric piece only as its record mints
  it, the sigil projected to its own keys (`aetheric.js validSetMarks`). The price in gold is section 7's. Two lore
  lines are ASCII. The pack card's sigil lines are the block's (the card's paragraph rule outranked them). A hover
  card taller than the screen sheds the tiers' words, then keeps their names alone, until it stands whole
  (`enhancedInventory.js fitTip`, measured by the probe: a Regalia shield's card was 782px on a 700px laptop). The
  item lists' classic tooltip wraps a row of the port's own - under the item's name - past 240 native pixels (a
  recorded departure - the Port-Ledger's row); DFU's rows, the name included, never wrap.
- **D - the other hosts and cores.** Under PCAAO, the default core, the port's armour points (a set's, an affix's)
  made the player EASIER to hit - its player term subtracted a channel the port writes negative; they protect now,
  the mod's own two channels kept verbatim. A joiner's killing blow in a dungeon is named on the host's streamed
  record (`v`), and the joiner it names reports its kill - the Rampage and Eventide fire underground for a joiner, as
  the exterior owner's `slain` word already made them outdoors.

Pinned: the slices' own files, each finding's lines named in its test's title; `test/systems/auditset_c.test.js` (6);
`tools/mutants/set1.json` to `set7.json` re-aimed and grown (264), `auditsetc.json` (26) and `auditsetd.json` (6),
all dead. The probes: `tools/brokerProbe.mjs` 359 checks (its classic-skin views new), `tools/setUiProbe.mjs` 174
(the hover card at three screens new).

### AUDIT FINAL - read again on the merged tree, before the merge (2026-09-27)

Main's 94 commits merged in first (the relay is **world119** - see below), then five readers: the law and the powers, the
drops/Broker/wire/saves, the UI pass, the Renown bar with the relay and the docs, and the merge itself. No blocker.

- **F7 - the dungeon's full frame could outgrow the wire.** AUDIT SET P-M3's `v` (the joiner whose blow killed a foe) rode
  a death's record for as long as the body lay, so every full frame carried every name: 453 bodies of the largest elite
  dungeon, joiners' kills most of them, broke FOES_FRAME_MAX (64 KiB), `sendFoes` refused the frame whole, and every
  frame after it was full and refused too - the host's stream stopped for good. The name rides for `KILLED_BY_MS` (4 s,
  two full frames) now; the joiner's door hears the death once, as it lands.
- **F10 - a swallowed blow's mark outlived its door.** The struck tail marks a foe's blow and only a landed hurt took the
  mark, so a blow the door swallowed (the veto, Unbroken halving 1 to 0, a Shield spell's pool) or a party weighed to
  nothing left it for the next hurt in the window: a Fireball after a shielded rat's bite woke the Wrath, a fall paid
  Spite. The door takes the mark as it OPENS (playerEntity.js `registerPlayerDoorOpen`, told first on every call), and a
  blow the party's weighing floors says so (`playerBlowCameToNothing`, the pool's melee and the arrow arm).
- **F11 - Cleave through a wall.** This page said Cleave never reaches through a wall; only the Nova asked. Cleave asks the
  host's ray too, from the struck foe, for each nearer candidate.
- **F12 - a partner's Cleave or Nova on my summon, above ground.** Their puppet of it carries no side (a cell record says
  none), so it read as a foe; the dungeon's door already refused a peer's blow on a PlayerAlly (SUMMON-SYNC D6) and the
  exterior pool's does now.
- **F8/F9 - the Test Room, by URL.** `?online&test=loot` BUILT the armory into a live session (the refusal asked only a
  loaded save); any Test Room entry is refused online now. And the check reads the boot's own pick and parse
  (`bootSnap`), where it had parsed the save a second time beside main's MW-EARLY F3 one.
- **F4 - the Broker drew her offers for a Breton man.** The picture is drawn for the window's wearer, as the pack's.
- **F1 - the set strip against main's GOLD-DROP.** A set line's press is a pick, and a pick puts the gold field away (one
  floater at a time).
- **F3 - the court's floor drew the Regalia in base metal.** Main's DYE-ICON dyes by the swatch; the floor's picture door
  (`itemIconColor32.js`) asks by it now, and keys by it.

**THE RELAY DEPLOY.** This merge ships **world119**: AUDIT SET's `v` lives in wire.js's validFoeRecord, which is in the
relay's bundle, so the bundle's bytes changed (world117 on this branch, never deployed - renumbered past main's
SHADOW-FANG world117 and OWN1 + INVIS-NET world118). relay-deploy.yml deploys the relay on a push to main whose
RELAY_VERSION differs from the live one, so the merge redeploys it and every connected player is dropped once, to
reconnect; the relay's behaviour is unchanged (it forwards a foes frame unread).

**THE GATE'S FIRE, +10 A PIECE** (Mac, asked: "Lower per piece"). Every Regalia armour piece carried the gate's fire
resistance at the top of the Legendary band, +50 (section 6), so any two worn pieces made a fire saving throw of 100 -
total fire immunity - and the Burning Gate tier's +15 to +45 added nothing. Each piece carries +10 now
(`aetheric.js REGALIA_FIRE_RESIST`): the whole body and the shield +80, and the tier is what takes a full Regalia past
immunity. No player holds a piece yet - the Regalia ships with this merge - so nothing minted before needs carrying over.

Pinned: `tools/mutants/auditfinal.json` (16 with the Regalia's fire, all dead) and the tests each names; five records re-aimed where the fixes
moved their text (MERGE-PLUS-C8, AUDIT-SET-the-killer-never-streamed, SET3-the-last-in-reach-not-the-nearest, two
SURVTIERS3 cite rots), all dead.

### SS1 and SS2 - the stones stack and are bound; the Broker's prices doubled (2026-09-27)

Mac, after the merge: "we need to make sigil stones bound items and stackable, raise the prices on the new boss vendor".

- **Bound** (`systems/item/itemBound.js`, new). Binding is the template row's own word (`bound`), so every Sigil Stone is
  bound - one minted before the row said so too - and no field on the record binds or unbinds a piece. It closes the one
  way a piece passes between players, the trade (TRADE1): `systems/tradePack.js` `tradeRefusal` never puts a bound piece
  on the table ("Bound items cannot be traded."), and `unwire` refuses a peer's lot carrying one whole - an older build
  or a forged frame - so the session ends it as the refusal it is and nothing moves. Nothing else: mail carries words,
  a ground pile and the wagon are this machine's alone, and a home's decor shows a visitor a piece by its numbers without
  handing it over, so a bound stone still drops, sells over a counter at its 5,000 and stows (SS3 closed the ground and
  SS4 the counter, below). The enhanced card says
  "Bound - it cannot be traded." in the lock's line style, without the padlock; the player's lock (LOCK1) stays its own
  word.
- **Stacking** (`systems/gate/gateSpoils.js`). The stone's row says `stackable`, the rations' flag, so a stone won joins the
  stack in the pack; a stack merges only with the same template (`inventory.js` stacksWith), so a stone never joins a
  Ruby nor a Ruby a stone - WB5's reason for a row of its own holds - and a locked stack takes only locked stones. A pack
  saved before the row stacked holds a record a stone: `restackStones` folds each into the first record before it that
  it stacks with, run by the load (`systems/save/save.js`) below its index-keyed relinks - the gold migration's own place,
  so a light lit after the stones in the saved list is the same light after it - over the pack and the wagon. The
  hotbar keys an item by its kind, so no slot points at a folded record. The spoils' crash record is kept by the burst's
  id, never by a piece, so a stone that joins a stack changes nothing there.
- **The Broker over the stacks** (`systems/sigil/sigilBroker.js`). `stoneCount` counts a stack whole (the purse, "Need N
  more", the offer's state); a sale's take is `[{ item, count }]`, first records first - a stack the price empties goes,
  one it draws on keeps the rest - and the carry gate is asked of the pack as the stones leave it, the drawn stack at
  what it keeps. The purse's locked stones are counted the same way.
- **The prices** (SS2): 4 stones a Rare set piece (a Legendary 6), 6 a set weapon, 12 the Regalia - twice SET7's, in
  the same proportion; the reasons and the price in gold are section 7's. The relay's code is untouched: no version
  moves, and the deploy drops nobody.
- **Found by the probe**: each of the window's rows is its own grid, and the price's column was sized by its text, so
  the Regalia's "12 Sigil Stones" (108px) stood 7px left of the others (101px) at a desktop and a laptop. The column is
  112px in every row now (`ui/enhanced/enhancedPlusStyle.js`, the classic skin's sheet cut from the same rules). The probe's
  pack is a stack of seven and a locked stone: 359/359.

Pinned: `test/systems/item/ss1_stones.test.js` (8), `test/systems/item/set7_broker.test.js` (the purse, the take and the sale over stacks, the
prices), `test/player/set7_broker_world.test.js` (the purse's locked count), `test/systems/item/wb5_gate_spoils.test.js` (the row stacks
with its own kind alone); `tools/mutants/ss1.json` (18, all dead), and SET7's three records the change moved re-aimed
(the price, the take, the heavy sale), all dead with the rest of SET7, WB5 and LOCK1; the probe `tools/brokerProbe.mjs`
(359).

### SS3 - a bound stone is never dropped (2026-09-27)

Mac: "They shouldnt be able to be dropped". SS1 closed the trade alone; binding now closes the WORLD too
(`systems/item/itemBound.js`): a bound piece goes nowhere but the player's pack, wagon and own storage (`BOUND_KEEPS` - a
storage piece opens for its owner alone, `worldModes.js activateDecor`; an owned house's cupboards and a ship's chest are
`loot.storage` too). The ground refuses it on both skins - the enhanced pack's Drop and its drag (whose ghost promises no
drop), the classic pack's Remove - and so does every container: a body, a chest, a shelf, a reward tray. A container is
not the player's: online it is the ROOM's once opened (WORLD4, WORLD6a - its contents ride the room's memory and land in
the next player's), and a body is GRANTED to whoever loots it (`scenes/exteriorFoes.js grantCorpse`), so a stone put in
one would reach another player. The enhanced pack is take-only over a body or a stranger's container already (MAC-M2 B);
the classic pack could put a stone in one, and refuses now. Every refusal speaks: "Sigil Stone is bound to you - it
cannot be dropped or traded." (`boundText`), and the card says "Bound - it cannot be dropped or traded." And whatever
build sent it, a list a peer hands over lands without a bound piece (`unbound`): a body's grant
(`exteriorFoes.js`), a dungeon's container records and a body's items on the wire (`dungeonContext.js`), a building's
container records (`world/interior/interiorShared.js applyInteriorLoot`). A stone still sells over a counter (SS4 closed it).

In the same change, from the players (a Discord report relayed by Mac): the way home where the Warden falls is pressed,
never walked through - `World-Bosses.md` SS3.

Pinned: `test/systems/item/ss1_stones.test.js` (13: the law, the enhanced pack's Drop and drag, the classic pack's Remove over the
ground, a chest, the wagon and the owner's storage, and the lists a peer hands over), `test/world/gate/wbx_gate_fixes.test.js`
(the portal); `tools/mutants/ss1.json` (29, all dead) and `tools/mutants/wbx.json` (24, all dead).

### SS4 - the Broker's wares are bound, and no counter buys a bound piece (2026-09-27)

Mac: "Also make the items sold by the oblivion vendor bound also. Can't be traded, dropped or sold. Sigil stones
shouldnt be able to be sold".

- **The wares** (`systems/sigil/sigilBroker.js brokerStock`). Every offer's piece carries the mark `bound: true` - a declared
  field (`systems/item/itemFields.js`), kept by a save and by a valid loot record - and a sale mints the piece it hands over
  off the same list, so the piece bought is bound. `isBound` reads the mark or the row, and no mark unbinds what the
  row binds. What SS1 and SS3 close to a stone they close to a ware: the trade, the ground, every container, a peer's
  list.
- **The counter** (`ui/enhanced/enhancedTrade.js`, `ui/native/nativeTrade.js`). Neither skin's Sell nor Sell Magic stages a bound
  piece, and the counter says why: "Sigil Stone is bound to you - it cannot be dropped, traded or sold." (`boundText`,
  the pack's own refusal; its words and the card's line say "sold" now). A shop's shelf is the room's online
  (WORLD6a), so a piece sold there would reach the next buyer. A smith's repair and a sage's identify still take a bound
  piece, because it comes back. Every sale goes through these two windows (`scenes/worldModes.js openTradeWindow`);
  the enhanced counter's quick sell is off (`isQuickSellCandidate`).
- **The Broker's card** says "Bound - it cannot be dropped, traded or sold." under each ware, before the sale.
- **Not done**: a ware bought before this change stays unbound (section 8). The relay's code is untouched: no version
  moves.

Pinned: `test/systems/item/ss1_stones.test.js` (17: the wares' mark, the Broker's card, both counters in Sell and Sell Magic, the
smith and the sage); `tools/mutants/ss1.json` (38, all dead - SS1's binding record re-aimed at the new `isBound`).

### SS5 - a ware is dismantled in the pack for Sigil Stones (2026-09-27)

Mac: "In addition, I want to implement a new functionality, currently only for broker items. The ability to dismantle in
the inventory and recieve back sigil stones".

- **The law** (`systems/sigil/sigilBroker.js`). Every ware carries its price (`stonesPaid`, a declared field, marked at the
  mint beside SS4's binding), and dismantles for half of it, rounded down (`BROKER_DISMANTLE_SHARE`): a Rare piece's 4
  give 2, a Legendary's or a weapon's 6 give 3, the Regalia's 12 give 6 - so a ware is never a free try of the day's
  stock. Both marks are read (`dismantleStones`): a piece is dismantled only if it is BOUND and priced, and no list a
  peer hands over lands a bound piece, so a price a peer wrote on a piece of its own never pays. `dismantleWare` takes
  the ware out of the pack and puts its stones in - onto the pack's unlocked stack, since a locked one takes only
  locked stones - all of it or none of it; a worn ware is taken off first and a locked one is the player's own word
  (LOCK1), each refused with nothing moved. The day's mark stays: a ware dismantled is not bought again that day.
- **The enhanced pack** (`ui/enhanced/enhancedInventory.js`). A ware's card - and its right-click menu, built from the same row -
  offers Dismantle beside Lock; a worn ware offers none (its Take off is beside it), and a locked one says why when
  pressed, as its Drop does. The press asks first, in the Info box's own stone window: "Dismantle Ruhn's Right
  Pauldron? It is gone for good, and you get 6 Sigil Stones back." - Dismantle does it and the pack says "Dismantled:
  Ruhn's Right Pauldron, for 6 Sigil Stones." (BROKER_SOLD's shape); Keep, Back or a press outside leave it. A second
  click of a pair never presses the question's Dismantle (pairGuard).
- **The classic pack** (`ui/native/nativeInventory.js`, the Classic and GrimoireUI skins). Its six buttons are DFU's art and
  its Use belongs to the ware's enchantments, so the offer comes where the player tries to be rid of a ware: Remove
  over the ground, which its binding refuses. The refusal and the offer stand in DFU's own Yes/No box
  (`ui/yesNoBox.js`) - Yes dismantles it and says so, No keeps it; a chest, a body or the wagon get the plain refusal.
  The window takes a press on the box as it takes a key (an answered box used to stand until a key came).
- **Found on the way: the classic box ran off the screen.** DFU's parchment sizes to its widest row and never wraps -
  TEXT.RSC rows come broken to fit - and SS3-SS4's refusal is a sentence the port writes: "Sigil Stone is bound to you
  - it cannot be dropped, traded or sold." is 311 px in FONT0003, and a ware's long name made it 445, where the
  320-px screen holds 288 of text. `ui/messageBox.js fitBoxRows` wraps a row wider than that under itself, in its own
  alignment, at the pack's boxes, the counter's and the Yes/No box; every row that fitted is left as it was (`Port-
  Ledger.md` section A). (AUDIT SS: DFU's own records can expand past it too - a long shop's name in a trade offer
  wraps now where DFU ran it off the panel - and a painting's box is never fitted: its picture's height would push it
  off the panel instead.)
- **Probed** on the real page (desktop and phone): the card's Dismantle, the question centred with its two buttons,
  the ware off its page after (the probe found the page left stale - the list is now rebuilt, as every act rebuilds
  it), six stones on the stack and the pack's word.

Pinned: `test/systems/item/ss1_stones.test.js` (22: the law and the price on every ware, the dismantle made and refused, the
enhanced card and its question, the classic Yes/No, the box fitted); `tools/mutants/ss1.json` (63, all dead - SS4's
ware record re-aimed where the price joined its line).

### AUDIT SS - SS1 to SS5, end to end (2026-09-27)

Mac: "audit this". Five lanes read the whole of SS1-SS5 against the code around it - the law and the economy, every way
a piece leaves its owner, the enhanced windows, the classic windows, the court and the wire - and each finding was
reproduced before it was fixed. What was found, and what it is now:

- **The court's way home could not be pressed from where the fighters stand** (medium; SS3 made the press the portal's
  only way through): `World-Bosses.md` SS3's AUDIT SS - the court's doors are pressed in their fire's own box.
- **The keyed shelf sold bound pieces** (medium): the classic skin's counter falls back to the keyed shelf when its art
  will not load, and that list and its sale (`scenes/worldModes.js showSellList`, `doSell`) asked nothing of a binding -
  or of the player's lock. Neither is offered or sold there now.
- **A counter's teardown lost what was staged on it** (medium; older than SS1, and any piece): the enhanced counter's
  door closes it straight through its view's `unmount` - the QuickDial's key, a death, a building left, a load - and
  the staged goods went with the view; the classic counter had no `dispose` for the hosts' own teardown. Both put back
  what is staged on every way out now (OnPop's ClearSelectedItems), as their own Close always did.
- **The dismantle's question**: it held no focus and answered only Escape (Keep), so a player at the keyboard could not
  say yes - it takes the focus (on Keep), is modal, and answers Y, and N, Enter or Escape to keep; a press on the dimmed
  screen closes it (the box's root IS the dimmed screen, so every press was "inside" - the Info box too); a question
  asked twice in one breath no longer leaves the first's document listeners behind to swallow every press and every
  Escape (the close cancels a pair not yet laid - the Info box too); a ware locked or worn while it is asked is refused
  in words at the press.
- **The classic question**: a right or middle click - the pack's Remove, over the paperdoll - answered its Yes and
  dismantled the ware; a box's buttons answer the left button alone now (DaggerfallMessageBox.AddButton wires
  OnMouseClick). The piece's tooltip no longer draws over it; the player's own pile on the ground is the ground (the
  offer stands there too, never for a locked ware); a reward tray refuses a bound piece in DFU's own silence.
- **The enhanced counter quoted a sale it refuses** ("Sell for 25000 gold" over five stones, and a "how many"): a locked
  or bound piece picked at Sell or Sell Magic shows neither now - the press still says why.
- **The Broker's sale took its price and its mark from the caller** (a console or a mod could buy the Regalia for one
  stone and, since SS5, dismantle it for six): `brokerSale` holds the offer to the day's own id and price.
- **Smaller**: the bound and lock lines lost the cascade on the pack's own card (`.pack-shell .card p`) and read as body
  text; a split keeps a stack's own `bound` mark (never its price); a building's and a dungeon's container records are
  written without their bound pieces (an older build connected beside this one would land them), while the container
  keeps them; the enhanced counter's dead quick-sell path refuses both; `fitBoxRows`' claim corrected (above).
- **Left as they are**: stones already in a shared container stay out of the room's lists and are not recoverable (who
  put them there is not recorded); a body's grant still reserves by position (a bound piece can only be on a body from
  before SS3, and the grant's order is its dup guard); a stone count of 0 or NaN reads as one (nothing writes one); the
  Broker's name column narrows between 720 and 900 px (older than SS2).

Pinned: `test/systems/item/ss1_stones.test.js` (29), `test/world/gate/wbx_gate_fixes.test.js` (the press), `test/systems/item/set7_broker.test.js` (the sale
held to the stock); `tools/mutants/auditss.json` (31, all dead), and ss1.json's three records the fixes moved re-aimed.

### RAID4b - the raiding parties' own sets (2026-09-28)

Section 6b, whole. The law (`systems/sigil/sigilSets.js`: `oath`, `thieftaker`, `orcsbane`, each `aetheric` and naming its
raiding party - `raidSetOf`, a party no set names and anything not a whole number answering none), their nine powers
through SET2's seams (`systems/sigil/sigilSetPowers.js` - the fold; the blow for Riposte, Run Them Down, No Escape and Blood
for Blood; the hurt listener arming Riposte and the Blood; the damage modifier for Hold the Line and Iron Hide; the
kill for No Escape's mark and Iron Hide's ward; the round's "ready again"; the chips), the twenty-seven records
(`systems/aetheric.js` - every Aetheric record now names its MAKE and a weapon its blow; `AETHERIC_RECORDS` the one list
every reader asks), and the wire's check widened (AUDIT SET D6): a raid set's sigil only on an Aetheric piece, an
Aetheric piece of its record's make alone, and its sigil its own record's set, never another's. The Test Room's loot
ladder lays out the raids' three sets after the Regalia.

Pinned: `test/systems/raid4b_sets.test.js`; `tools/mutants/raid4b.json` (67, all dead), and the 215 older records on the files it
touched run again, all dead - fifteen re-aimed where RAID4b moved their text (the two D6 marks, SET1's order, SET6's
axe blow and Test Room, RAID4's receipt, the spoils pool's seven, two SURVTIERS3 cite rots).

### AUDIT SETS - the powers and pieces online, audited (2026-09-28)

Mac: *"1. Audit this properly 2. Ensure online functionality is perfect"*. A lens read RAID4b's powers and pieces
against the running hosts and ran each doubt as an experiment; pinned in `test/systems/auditsetsonline.test.js` (8 tests, 27
mutants all dead; the stream's law in `test/net/restsync.test.js` and `test/scenes/questparty3c.test.js`, 10 more), the foe record's field riding the relay's world123 deploy:

- **M1: "under half health" was this machine's roll.** A puppet (a foe another player owns) and a dungeon guest's copy
  are rolled here - their own dice, their own level - and only the owner's HEALTH streamed, so Run Them Down read the
  owner's 40 against my roll of 100 (a raider at 57% took the bonus; an orc at 33% could miss it). The foe record now
  carries its owner's maximum health (`k`, bounded as `h` is - `net/wire.js validFoeRecord`); both pools say it and both
  copies take it. The Warden's stand-in holds a billion and is outside it (section 8). The dungeon's stream cannot carry
  it on every record (the largest elite layout's worst case would pass the wire's 64 KiB), so a full frame pays each
  foe's that its room holds - a joiner it greets learns them at once - and a delta pays at most twelve still owed (one
  that changed, one a crowded frame could not hold, one shed for room); the own lane keeps the same law.
- **M2: an older client wiped a container holding a raid piece.** A client before RAID4b cannot read a raid set's
  sigil, refused the room's whole list, and - taking the room to have said nothing - claimed the chest with its own
  roll on the open and said that roll on the close: every piece stored there gone for the room and its memory. A
  room's loot word this build cannot read now marks the container spoken and unreadable - never landed, claimed,
  closed over or (in a dungeon) opened ("Something in here is from a newer version of the game. Reload to open it.");
  a word it can read clears it. This protects every skew from here on; a tab still on a build before this one does
  what it did (the relay's deploy drops everyone once and the update notice asks old tabs to reload).
- **L1:** No Escape's mark outlived its foe - killed by me with nothing else in reach, or by a peer, its chip counted on
  over the body. The marked foe's death ends it, and a body is never a mark.
- **L2:** "Your The Broken Oath brightens" - a set whose name is "The ..." rises as itself.
- **L3:** a guard's blow the arrest flow holds back ("fight on") landed after its mark had lapsed, so Riposte, Blood for
  Blood and Spite never heard it; a blow withheld for good left its mark lying. Both hosts now hold the mark and mark
  it again as the blow lands, and a withheld blow is the door's "nothing".
- **L4:** a blow the Warden's ward turns aside spent Riposte - his ward rides his stand-in now, and a warded blow spends
  no power.
- **L5:** No Escape spoke at every kill even re-marking the same foe (a re-mark renews its time in silence); "... is
  ready again" was said with the set in the pack, and Iron Hide's over a ward still standing (now: only a power worn
  and awake, Iron Hide's once its ward is spent).
- **L6:** an Aetheric piece off the wire was held to its record's id, make and set, not its affixes or blow - a traded
  oath-helm could carry top-of-band affixes. Its affixes are now the record's kinds in its order, none past the
  record's value (the Regalia's bounded by the band alone - its fire stood at the band's top until 322370d2, and a
  piece minted then is no forgery), and a weapon's blow the record's.

### SERPENT-SET - the sea serpent's own set, and the gate's currency at sea (2026-10-05)

Section 6c, whole; the hoard's half is `Sea-Serpent.md` section 8. The law (`systems/sigil/sigilSets.js` `coilscale`,
Aetheric and naming no raiding party; `COIL_STACKS`, `COIL_SECONDS`, `SHED_BELOW`; `systems/sigil/sigil.js` names it after the
raids' three), its three powers through SET2's seams (`systems/sigil/sigilSetPowers.js` - the fold for Sea-Scale; the strike
listener tightening Constrict's coil, a bow's blow too, and the blow reading its stacks at the coiled foe alone (AUDIT
625 P3: every foe its own coil - `coilStacksAt`); the kill ending a coiled foe's coil; the hurt listener for Shed Skin,
beside the Wrath and never on a killing blow (AUDIT 625 P1: nor a saved one - the damage door's `saved`); the
round's "ready again"; Shed Skin's chip), the nine records (`systems/aetheric.js` `SERPENT_SET_PIECES`,
`SERPENT_SET_POWER`, `SERPENT_SET_CHANCE`, `rollSerpentSetPiece`; `AETHERIC_RECORDS` the Regalia, the raids' and then
these, so the Test Room's ladder and the Codex take them with no word of their own), and the one heal a power gives
moved below both power files (`systems/playerHeal.js`). The wire's check is the raid sets' (AUDIT SETS L6): a Coilscale
piece's affixes its record's kinds in its order, none past its record's value. An older build cannot read the new set's
sigil, and AUDIT SETS M2 already marks such a container unreadable rather than wiping it.

THE FOUR HOSTS. The powers ride SET2's seams, which every host's combat already calls; the one host-side wiring is
`scenes/world.js`'s - Shed Skin's splash in the sets' one voice (`setSetPowersVoice`, registered there for every mode
of the streaming page: `scenes/worldModes.js`'s interiors and `scenes/dungeonContext.js`'s dungeons sound through it),
and the serpent's hoard, its crash door and its claim's silver (the sea is the streaming world's alone).
`scenes/exterior.js`, the offline town page, has no sea and registers no sets' voice - the sets are online gear.

Pinned: `test/systems/serpentset.test.js` (the law, the records, the drop, the hoard, the powers, the heal, the host) and
`test/net/serpent/serpentset_service.test.js` (the embers on the row, the insignia's purse, the serpent's silver);
`tools/mutants/serpentset.json` (48, all dead). The older pins it moved: SET1's and RAID4b's set lists, SET3's states and
voice, SERPENT1's hoard list; their records re-aimed by content (SET1's order, SET3's bow and its two Wrath records -
Shed Skin carries the same crossing and guard - LOOT4's three heal records, now `systems/playerHeal.js`'s).

### SD9d - the Brass Remnant's own set (2026-10-07)

Section 6d, whole but for the roll that pays it (the Brass Remnant's spoils, SD9e); the record is
`Super-Dungeons.md`'s SD9d. The law (`systems/sigil/sigilSets.js` `numidium`, Aetheric and naming no raiding party;
`systems/sigil/sigil.js` names it after the serpent's), its three powers through SET2's seams (`systems/sigil/sigilSetPowers.js` -
the fold for Dwemer Brass; the damage modifier for Gearward, a foe's blow alone; a death save for The Hour Turns, tried
when no Bulwark answers, and the hurt listener's heal as the door says it saved; the round's "ready again"; its chip;
the states), the nine records (`systems/aetheric.js` `NUMIDIUM_SET_PIECES`, `NUMIDIUM_SET_CHANCE`, `rollNumidiumPiece`;
`AETHERIC_RECORDS` ends with them) and the voice (`scenes/world.js`: the Orrery hall's gear and its low bell). The
wire's check is the raid sets' (AUDIT SETS L6). Pinned: `test/systems/sd9d_numidium.test.js`; `tools/mutants/sd9d.json` (44,
all dead).

### AUDIT SD - Gearward and the world boss (2026-10-07)

`Super-Dungeons.md`'s SD10b (C7, C8). The Remnant's blows came through the court's door with no foe's mark, so Gearward
never answered the fight its set drops in; now a body's own blow (never the Hour's magic) is marked as a world boss's
(`setBossStruck`, taken as the door opens, a blow's window old at most) and Gearward alone reads it (section 8). And a
blow too small to lighten by a whole point no longer spends the winding. Pinned: `test/net/superDungeon/sd10b_audit.test.js`; `tools/mutants/sd10b.json` (its C7 and
C8 records, all dead); `tools/mutants/sd9d.json`'s Gearward records re-aimed by content.

### EG15 - the Spire's own set (2026-10-12)

Section 6e, whole but for the roll and the sink that pay it (`Elite-Gates.md` section 19: the spoils and the Broker's
weekly sink are EG-E's other slices) and the host lines that open its two doors. The law (`systems/sigil/sigilSets.js`
`panoply` and its `REPRIEVE_*` constants; `systems/sigil/sigil.js` names it after the Brass's), its three powers
(`systems/sigil/sigilSetPowers.js` - the fold for Bearing, over `systems/entityMods.js`'s new `magicka` channel, which
`systems/chargen.js` `defineLiveMaxMagicka` reads beside Renown's and `systems/renownLayer.js` `onlineMpOf` takes off for a
save and the magery; the cast listener and the blow for Discipline's arm, the strike for its return; the hurt listener,
the damage modifier and the allies' door for the Reprieve; the round's "ready again"; its chip; the states), the Spire's
recovery for every death save the file holds (`setSpireRecovery`, `spireRedoubtTaken`), the nine records
(`systems/aetheric.js` `PANOPLY_SET_PIECES`, `mintPanoplyPiece`, `panoplyPieceById`; `AETHERIC_RECORDS` ends with them),
the cast seam (`systems/playerCasts.js`, told by `scenes/hostMagic.js`) and the voice (`scenes/world.js`: a Shield
spell's cast). The wire's check is the raid sets' (AUDIT SETS L6), and the account service's judge holds an honest piece
to no finding and a forged one (an affix past its record, another template, set, make or blow) to one.

THE FOUR HOSTS. The cast is told by the one engine every host builds (`scenes/hostMagic.js` `createPlayerMagic`:
`scenes/world.js`'s - whose instance `scenes/worldModes.js`'s interiors take - `scenes/exterior.js`'s and
`scenes/dungeonContext.js`'s), so every host's casts arm the Discipline. The two doors are `scenes/world.js`'s, the
streaming page that keeps the party and the Spire, WIRED by EG-E's host wiring (`11-Multiplayer/Elite-Gates.md` section
31): `setSetPowersAllies` (the party mates within 8 m, cast at through `castAtAllyDoor`) and `setSpireRecovery` (the
breach the player stands in, `modes.egHallBreach()`), with `spireRedoubtTaken` called as the room says a Redoubt was taken
(`scenes/eliteGates/egClient.js`). `scenes/exterior.js`, the offline town page, wires neither - the sets are online gear. Section
15's Divine Grace and the Ghost-King's Vigil (`systems/loot/lootPowers.js`), the loot's saves, are held in the Spire too
(EG-ZH: `lootSpireHeld`).

Pinned: `test/systems/eliteGates/eg15_panoply.test.js` (15); `tools/mutants/eg15.json` (91, all dead). The older pins it moved: SET1's,
SD9d's and SERPENT-SET's set lists and records, SET3's states and voice, SERPENT-SET's heal imports, and the cast
engine's release tail (FIX-F's, AUDIT 36's and QG1's: the tell sits after the raise, before the clear); their records
re-aimed by content (SET1's order, SD9d's three, SERPENT-SET's four, SET3's three, AUDIT 625's Shed Skin guard, RENOWN1's
save and AUDIT RENOWN1's magery), every one dead. The records' import of the pay law brings `net/eliteGates/egPay.js` into the
account Worker's bundle, so the account deploy's path filter names it (ACC4). At the arc's merge of main #880 to #899
(a43a033e63, 2026-10-14), main's SCHOOLS3 had moved the same gift into `systems/playerHeal.js` as `manaMine`. That is its
one home now (ONE EXPORT): Discipline's return calls `manaMine`, `systems/loot/lootPowers.js` reads it as `gainMana`, and
`eg15_panoply`'s pins and EG15-return-share were re-aimed and judged dead (`Elite-Gates.md` section 31's note after
AUDIT EG IV).

### STAR7 - the Starfall's own set (2026-10-20)

**The Starspun Weave** (section 6f): the law's thirteenth set, the Wyrd's Raiment (WITCH1, section 6g) its twelfth (`sigilSets.js` `starspun`, `sigil.js` `SIGIL_SET_IDS` last), its
nine records (`aetheric.js` `STARSPUN_SET_PIECES`, `AETHERIC_RECORDS` last) and its drop (`rollStarspunPiece`, the Heart-Star's
`always`), its three powers through the seams (`sigilSetPowers.js`: the FOLD, `stranded` and the BLOW's read, `veil` on the
HURT listener, the round's "ready again", the chip). Pinned by `test/systems/starfall/star7_rewards.test.js`; the order pins of
SET1, SERPENT-SET, SD9d and EG15 moved for it. Mutants in `tools/mutants/star7.json`.

### SEA-SET - the deep sea's own set (2026-10-22)

**The Eltheric Tidemail** (section 6h): the law's fourteenth set (`sigilSets.js` `eltheric`, `sigil.js` `SIGIL_SET_IDS`
last), its nine records (`aetheric.js` `ELTHERIC_SET_PIECES`, `AETHERIC_RECORDS` last), its shares and its roll
(`ELTHERIC_CHANCE`, `rollElthericPiece`), the deep's piles (`systems/sea/seaSpoils.js`) and a legend's (`navalSeaSet.js`
legendTidemail - out of createNavalHost, AUDIT SEA VENTURES D12), its three powers (`sigilSetPowers.js`: the FOLD, the BLOW, `captainsDue` and the naval host's three
reads), item law 11 (10 on its branch, past PISTOLET's at the merge). Pinned by `test/systems/sea/seaset.test.js`; the order pins of SET1, SERPENT-SET, SD9d, EG15 and STAR7
moved for it. Mutants in `tools/mutants/seaset.json`.

### AUDIT STAR - the Weave's powers and the chips, read again (2026-10-20)

Bound in Silk's cut on the held blow's landing, whatever its weight; the Veil's words (its effect, its spell's and chip's
names through the text core); every chip's tier, which the HUD's card reads; the full-health guard's Veil kept as designed
(section 6f); the Wyrd's Raiment given its section (6g) and the Weave its right heading and count. Pinned by
`test/systems/starfall/auditstar.test.js`, and the chips' pins of SET5 and RAID4b moved for the tier. Mutants in
`tools/mutants/auditstar.json`.
