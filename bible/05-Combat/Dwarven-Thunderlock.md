# The Dwarven Thunderlock — the port's own weapon

`src/systems/thunderlock.js` + `src/characters/thunderlockIds.js` +
`src/combat/thunderlockArt.js` + `src/combat/gunSheet.js`
(Mac, 2026-09-19)

> "The weapon itself will be called Dwarven Thunderlock. Ammo: Dwemer
> Pellet. Im ready to integrate this as a new weapon type. Should work
> with the archery skill."

**This is the first item in this port that Daggerfall does not have.**
Every other weapon here is a translation; this one is ours. It was
prototyped before it was built — the gun lab (`Gun-Lab.md`) settled
the pose, the cadence, the recoil, the screenshake and the sounds
while `combat/` was untouched — and only what survived that is in the
game.

## The two claims that make a departure survivable

**The classic tables are untouched.** `itemTemplates.json` is still
DFU's 288 rows and contains neither new name; the two rows come in
through `registerCustomTemplates` at **560** (weapon) and **561**
(ammunition) — past DFU's 288 *and* past Climates & Calories' 530-541,
so neither collides. In `characters/weapons.js` the damage and skill
arms sit **ahead of** the verbatim tables as explicit, named
departures, so `CalculateWeaponMin/MaxDamage` and `GetWeaponSkillUsed`
still read exactly as DFU writes them, and the departure is one thing
a reader can see and delete.

**It reaches the game through doors that already existed.** No host
learned that a new weapon exists.

## The skill is the wiring

`isBowWeapon` is not "is this a bow" — it is `attackSkillOf(weapon)
=== SKILLS.Archery`. So naming Archery in `weaponSkillUsed` is what
makes every host's ranged gate take the Thunderlock: the loose, the
fatigue drain, the Archery-and-CriticalStrike tally, the projectile.
Mac's call and the weapon's nature agreed.

**It cost one duplicate to find out.** `hostCombat.js` carried a
*second* copy of the weapon-to-skill table — the duplicate
`test/audit24_onehome.test.js`'s ratchet had been naming for months —
and that copy answered `null`, so `isBowWeapon` said false and the gun
fell through to the melee arc in every host. The table is one table
now; `WEAPON_SKILL_BY_TEMPLATE` is derived from it so it cannot drift.

## Ranged is not Bow

A bow **draws**: StrikeUp winds up, the string holds at frame 3,
StrikeDown looses. A gun has a **trigger**. So the machine keeps the
melee one-shot (`isBow` false) and takes only the ranged half of the
bow's laws through `machine.ranged`, with six frames instead of five
through `machine.frames` — the one departure `weaponStates.js` carries,
and a machine that does not set it reads exactly the two classic
tables it always did.

| | bow | Thunderlock | melee |
| --- | --- | --- | --- |
| skill | Archery | Archery | its own |
| `isBow` | yes | **no** | no |
| frames | 4 draw / 7 loose | **6** | 5 |
| spends | Arrow | **Dwemer Pellet** | nothing |

## The ammunition is asked of the weapon

DFU has one ranged family and therefore one ammunition, so
`spendArrow` was the whole law and every host said it by name. A host
that asks "spend an arrow" while holding a gun is asking the wrong
question. `spendAmmoFor(list, weapon)` and `ammoCountFor` ask the
weapon; `ammoTemplateFor` (on the leaf) answers. Everything that is
not the Thunderlock still spends an Arrow, so no classic behaviour
moved. The out-of-ammo auto-sheathe and the quiver follow the same
door.

## Two leaves, and why

`characters/thunderlockIds.js` holds the four numbers and the
ammunition link, and imports **nothing**. `systems/thunderlock.js` is
the weapon's home, but it reaches `systems/itemTemplates.js` to
register its rows, and *that* file imports `characters/weapons.js` for
the condition ladder — so a `weapons.js` that wanted the indices from
the home would close a cycle and leave one of the three holding an
undefined const on the way up. `systems/inventory.js` is upstream too.
The leaf breaks both. Same answer as `combat/weaponAlign.js`.

## The art

Its first-person art is **a sheet, not a CIF**
(`combat/thunderlockArt.js`), sliced by the laws the lab settled
(`combat/gunSheet.js`) and handed back in the *same shape*
`loadFpsWeaponArt` answers — so `drawFpsWeapon`, the rig and Weapon
Widget's clone read it without any of them learning that a second kind
of weapon art exists. Two records: 0 is the idle pose, 1 the six fire
frames, all cropped to one union box so the flash and smoke cannot
slide the weapon around under the player's hands.

Its paperdoll layer and inventory icon are `public/art/gun-paperdoll.png`
(one sprite, both jobs — see `Gun-Lab.md`), registered under its own
archive. **A custom weapon has no female archive to be off by one
from**: ApplyWeaponMaterial's 234-becomes-233 exists because classic
art ships as a pair, and subtracting from a single registered archive
would ask for a texture nobody registered — a female character holding
an invisible gun.

## The numbers

| | |
| --- | --- |
| damage | **7-26** (Long Bow 4-18, Dai-Katana 3-21) |
| weight | 6.0 — the heaviest weapon in the game |
| price | 480 base, on the material ladder |
| condition | 90 |
| pellet | 0.2 weight, 4 base, stackable |

Harder per shot than anything classic, and paid for everywhere else:
the weight, ammunition at twice an arrow's price, and a cycle with a
visible reload in it.

## The enchanted variant

Every classic weapon has a second archive for this — `WEAPON04.CIF`
becomes `WEAPO104.CIF`, the same frames repainted with a glow — and
`ConvertItemToAPIWeaponType` promotes an enchanted item to the
`*_Magic` type that reads it. This weapon has no second sheet, so the
promotion lands in the art loader instead: **the same frames through a
shimmer**.

Not a hue rotation, which turns brass into a bruise. Luminance is
kept and the colour pulled toward a cold Dwemer blue-violet with the
**bright parts pulled hardest**, so the highlights read as charged and
the shadowed housing stays metal. The muzzle flash, already at the top
of the range, goes white-blue — which is what tells the player at a
glance that this one is enchanted. Pinned on four texels (shadowed
brass, lit brass, the flash core, a hole): each comes out cooler than
it went in, the flash *gains* blue, the lit metal takes more than the
shadowed, and alpha is never written.

## How you get one

> "This weapon wont be available for purchase and should be one of the
> rarest items to find in the game."

**Not for sale, and that takes no code.** A shop's shelf is built from
`GROUP_TEMPLATE_INDICES`, DFU's own group enum table, and a custom
template is not in it — the survival mod had to *add* its provisions
to the shelves deliberately. `test/thunderlock.test.js` pins that as a
law rather than an accident.

**Found, then** — by the port's own loot ladder (`lootRarity.js`,
LR1-LR5), as a **unique find**. That is a different question from a
rarity tier: a tier decorates an item DFU's loot roll already
produced, and no DFU roll can produce this weapon at all. So it is its
own roll — once per loot list, **adding** rather than promoting — and
it is *registered*, not named: the loot ladder has no business knowing
a gun exists, the same shape `registerCustomTemplates` already has.

**Base zero.** Below source tier 4 the chance is *nothing*, at any
luck — not "small". That is the difference between rare and gated, and
it is the half a probability alone cannot say.

| source | chance | |
| --- | --- | --- |
| anything below tier 4 | **0** | never, at any luck |
| tier-4 corpse | 1.4‰ | about 1 in 700 |
| tier-6 pile | 2.7‰ | about 1 in 370 |
| tier-8 boss, luck 100 | 6‰ (the cap) | about 1 in 170 |

**It arrives loaded.** 6-18 pellets with it: a gun found with no
ammunition is a gun that cannot be fired and cannot be bought shot
for, which reads as a broken drop rather than a rare one. Few enough
that it still sends you looking.

**And it claims its own legendary.** `The Last Lock` — 20% damage, +10
agility, +30 Archery, Cast When Strikes — marked `exclusive`, so a gun
does not roll up as *Wyrmbane*, a blade forged for a dragon hunt.
Nothing in DFU's own pool sets that flag, so the classic pairings are
exactly what they were: a dagger can still be Wyrmbane or
Nightwhisper.

## The test characters carry one

TSR-GUN (Mac, 2026-09-19: *"Put this weapon and ammo inside the test
characters"*). Every preset in the test room walks in with a Dwarven
Thunderlock and thirty Dwemer Pellets, on two rows in
`testGearRows` minted through the weapon's own two constructors.

This is the one weapon the armory could not reach any other way. Its
"one of every weapon type" loop walks `WEAPONS_ENUM`, which is DFU's
table and does not have a gun in it; the shops do not stock it; and
its only door in the running game is the rarest roll there is. Without
a row here, the way to hold one on purpose was to get lucky.

It comes loaded for the same reason the bow comes with a quiver: a
ranged weapon with no ammunition tests the refusal, not the weapon.

One pin moved to make room. `TSR1`'s "every row is a real template"
asked `ITEM_TEMPLATES[index]`, and a custom template lives above 288
in the custom map, not in the frozen DFU array — so the array answers
`undefined` for a template the game resolves fine. It asks
`templateByIndex` now, which is the question every reader in the game
asks.

And the damage pin asks `formulas.js`, not the item. AUDIT 18 F1's law
is that DFU never stores a weapon's damage *on* the item — it resolves
the template on every swing — so a `thunder.maxDamage` assertion would
have passed only for the one constructor that bakes the field and said
nothing about what the gun hits for.

## Still not wired

Said plainly so nobody assumes it: **loot *tables* and starting gear
do not offer it** (the unique find is its only door — the test room is
a door out of the game, not into it), and neither does a smith's
repair list.
