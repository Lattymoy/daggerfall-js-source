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

## Not yet wired

Said plainly so nobody assumes it: **shop stock, loot tables and
starting gear do not offer it yet**, and neither does a smith's repair
list. The rarity fields are set for when they do. There is no
enchanted variant and no `WEAPO1xx` sheet for one.
