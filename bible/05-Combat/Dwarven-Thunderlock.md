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

## FIELD-GUN: the two the audit walked past

Mac, the first time he held one:

> 1. the inventory sprites dont have their sprites
> 2. It doesnt let me equip

Both are the audit's own species — a DFU table or a pipeline flag with
no row for the port's own weapon — and both were live on `main` when
it merged.

**FIELD-GUN2, the equip.** `getItemHands` ends
`WEAPON_HANDS[templateIndex]` → shields → `ITEM_HANDS.None`, and
`WEAPON_HANDS` is the generated table over DFU's 113-130. Index 560
fell past it to `None`. `GetEquipSlot`'s weapon arm maps `None` to
`EQUIP_SLOTS.None`, and that is what `equipItem` refuses on its first
line. Not a wrong hand — **no hand**, so no slot, so no way to hold the
weapon at all. It is the THIRD departure of exactly the shape
`characters/weapons.js` already carries twice, and nobody wrote it.

**FIELD-GUN1, the icons.** They registered without `standIn: true`.
That flag is not a hint, it is the registration: archives 560 and 561
exist *only* as this art, and `standIn` is what tells `isVendorArchive`
not to go looking for a `TEXTURE.560` that cannot exist, and what gives
`vendorRecordCount` a record for the `record < tex.recordCount` gate
that **every** icon door in the port checks before it uploads —
`itemScroller`, `nativeInventory`, `paperDoll`. So the icon resolved to
560/0 exactly as the audit said it would, and then every door refused
to draw it.

This is SURV-ART one mod over — *"the sprites aren't showing at all"* —
and `textureReplacement.js` says so in the comment directly above the
function. The audit read that file to take the URL law out of it for
F7 and walked past the flag four lines away.

### Why eight findings missed both

Every pin the audit wrote asks whether something is **registered**. Not
one of them picked the weapon up, put it in a hand, or asked a door to
draw it — and a registration pin cannot fail for a weapon that
registers perfectly and then cannot be held. The lesson is narrower
than "test more": a departure needs a pin that performs *the player's
verb*. `FIELD-GUN1` and `FIELD-GUN2` equip it and draw it.

## FIELD-GUN3/4/5/6: the first play

Three reports, four faults, and the shape of all of them is the same
as FIELD-GUN1 and 2 the hour before: **the weapon reaches a pipeline
that has no row for it, and the pipeline answers with its default
rather than an error.**

### "The sprite is upside down"

HT3's law, paid a **third** time. `toColor32` is a *flip* — right for a
Unity texture, whose rows are stored bottom-up — and wrong for a
decoded PNG, whose row 0 already is the picture's top. Which one is
right depends on where it is drawn, and the two answers are opposite:
a world billboard wants the flip, a **screen quad** does not.
`drawFpsWeapon` ends in `drawScreenQuad`. `toScreenOrder` now, the same
door the held torch (HT3) and the shield mod (SW4) take — and both of
those were found the same way, by a person looking at the picture.

### "The paperdoll doesn't equip the texture"

Two faults stacked, and the first hid the second.

**FIELD-GUN5.** `characters/paperdoll.js`'s `getTemplate` is a `Map`
built once from the frozen DFU JSON, so it is blind to
`registerCustomTemplates` — and `composeDoll` filters the worn list on
it answering. The gun was dropped from the draw list before anything
downstream could even fail. It asks the one home now.

**FIELD-GUN4.** Under that, the vendor stand-in returned
`getDFBitmap: () => ({ …size, data: null })` — "a bitmap the swap arm
never reads", which was true of every door that existed when SURV-ART
wrote it, because that mod's art is never *worn*. The paper doll is the
one door that reads the bitmap itself. Our art is truecolor and has no
palette index to give, so the stand-in hands back RGBA and the doll
composites it on alpha, with neither dye nor helm mask — and **top-down**,
because `_decoded` holds the bottom-up color32 order while the doll
composites into a top-down buffer. The same HT3 fork as the sprite, one
pipeline over, in the same afternoon.

And a **place**: a classic weapon record carries its paper-doll offset
inside its CIF and this one has none, so the registration supplies it
(`PAPERDOLL_OFFSET`). Without it the blit lands off the panel's left
edge, which is the other half of drawing nothing. That number is a
placement, not a law — there is no DFU value to be right against — so
it is one named constant for Mac to move.

**FIELD-GUN9: and he moved it.** *"Close, really close, but not quite
on the mark"* — the grip hung three pixels below the hand, so the
sprite rises by that much. `y` is the only number that changed, and
the panel origin stays spelled out beside it (`8 + 93`, not `101`),
because the second form says nothing about where on the doll it is.

### "This isn't 1 to 1 with the prototype"

The largest of the three, and the one that says most about how this
was built. **The lab settled the recoil, the shake and the reload
lower, and then kept them.** `combat/weaponRig.js` — the thing that
actually draws the weapon, in all four hosts — had none of the three.
The sprite arrived, the sounds arrived, and the weapon sat dead still
while it fired.

So the two machines moved to `combat/gunFeel.js` and the lab
re-exports them, exactly as `combat/gunSheet.js` already works for the
slicing laws. Tuning the lab now tunes the game, because there is one
copy of each number.

- **The recoil** is a displacement, not an impulse: the barrel is
  already up on the frame the trigger breaks and the spring is the
  ride down. A second shot into the recovery stacks on what is left,
  which is why it is a spring at all.
- **The shake moves the room**, not the weapon, because the camera
  carries the weapon — the lab's own finding. The port has exactly one
  camera shaker (Better Ambience's, already wired through all four
  hosts by `view()`), so the gun borrows it through a `weaponKick`
  door rather than threading a second one through four scenes.
- **The reload lower** eases down and back on the cooldown's own
  clock. There is no reload *animation* to play, and a weapon that
  drops out of frame and rides back up reads as one.

All three reach **both** draw paths — the mod's clone and the classic
sprite — because the weapon's feel is the weapon's, not a mod's: a
player with Weapon Widget off must not be holding a different gun.

**Still not carried:** the lab turns the Widget's Inertia module *on*
as a declared departure ("this art IS high resolution, so the lab is
the case the warning is about"). The game leaves it at the mod's own
default, which is off. Forcing a third-party module on for one weapon
is the player's setting to make, not this weapon's.

### What these five have in common

FIELD-GUN1 through 6 are one fault wearing six coats: **a lookup keyed
over DFU's own range, asked about an index outside it.** `WEAPON_HANDS`,
`ITEM_TEMPLATES[...]`, `getTemplate`'s map, the stand-in's `data: null`,
`toColor32` — each answered its default, and a default is not an error,
so nothing anywhere went red. The audit's eight findings were all
*registration*; a registration pin cannot fail for a weapon that
registers perfectly and is then dropped by the next table down.

## FIELD-GUN10: why byte-level parity kept failing

Mac, a fourth time: *"It's still not 1:1. I don't get why it's so hard
to have byte level parity."*

The honest answer is not that it is hard. It is that **there are two
implementations of the placement, and every round before this one
checked their inputs instead of their output.**

The lab lays the rect out with `placeSprite` + `unionDrawRect`. The
game lays it out inside `drawFpsWeapon`. Those are different
functions. Copying numbers between two functions cannot converge —
it only moves the chance of being wrong around, and each round of
"still not the proto" was me moving it somewhere new.

### What was actually left

Measured by driving both paths with the same inputs and diffing the
rect:

```
LAB  x=652.8 y=475.0 w=628.3 h=357.0
GAME x=652.0 y=452.0 w=628.0 h=356.0
DELTA dx=-0.8 dy=-23.0 dw=-0.3 dh=-1.0
```

**Twenty-three pixels high.** `offsetHeight` is in SCREEN pixels — it
is `weaponOffsetHeight()`, the large HUD bar's own drawn height — and
the lab's `raise` is in NATIVE 320×200 units, which is what the panel
means by `-8`. Passed raw it applied at a *quarter* of its size on an
800px-tall window. Everything else already agreed to within rounding.

### The pin is the point

`FIELD-GUN10` is that measurement, kept. It drives both paths and
compares all four coordinates, with a tolerance **derived** from the
one honest source of disagreement — `loadThunderlockArt` rounds the
record to whole native pixels where the lab keeps a float, and the
surface scale multiplies that by four — so a real divergence cannot
hide inside it.

Run against the code before the fix it says so in its own words:

```
the game's y is -22.98px from the prototype's, past the 2.5px
rounding can explain (game 452.00, lab 474.98)
```

That is the lesson of all ten FIELD-GUN rounds in one line: **pin the
output, not the inputs.** `GUN7` pins the machine's timeline against
the lab's machine, `GUN8` pins every knob on the panel against the
lab's own source, and `GUN10` pins the drawn rect against the lab's
drawn rect. Between them there is no number left that can be copied
wrongly without a test saying so.

## FIELD-GUN11: the path nobody was testing

Mac, a fifth time: *"Thats not the only issue. How many times do I
have to say 1:1"*.

FIELD-GUN10 pinned **one frame of one path**, and it was the path a
player is *not* on. **Weapon Widget ships enabled**, so the draw goes
through the clone's `getWeaponRect`, and the clone reads
`weaponOffsetHeight()` for itself — the HUD bar and nothing else. The
raise never reached it.

Measured on that path:

```
at rest    LAB y=475.0   CLONE y=444.0   dy=-31.0
sheathing  LAB y=575.3   CLONE y=550.8   dy=-24.5
```

**Thirty-one pixels high** — and feeding the raise through closed only
part of it, because a second divergence sat underneath.

### The clone was transforming the wrong box

The lab lays out and transforms the **anchor** — the gun with no flash
on it — and derives the drawn rect from it. The game handed Weapon
Widget the **union**, which is 21 native pixels taller. Everything in
that transform proportional to the rect's height came out ~6% large,
so the Offset module's slide was 7.5px adrift the moment the weapon
moved.

`thunderlockArt.js` hands over an **anchor-sized record** now, with
the union beside it, and both draw sites expand at the moment of
drawing — exactly the shape the lab has always had. `unionDrawRect`
moved into `combat/gunSheet.js` so the lab reads the game's copy
rather than keeping its own.

And the raise moved onto `_tlAdjust`, the one channel **both** draws
read, instead of an `offsetHeight` only one of them sees.

### After

Both paths, four channel states across a cycle:

```
at rest         dy=-1.5    sheathing    dy=-1.1
mid-bob         dy=-1.5    reload dip   dy=-0.7
classic sprite  dy=-1.5
```

All inside the rounding the record's integer size can explain.

### The pin

`FIELD-GUN11` is that whole matrix — both paths, every channel — with
a derived tolerance. Run against either fault it names it: `clone, at
rest: y is -33.52px out` for the missing raise, `clone, sheathing: y
is -15.07px out` for the union base.

**Five rounds of "not 1:1" and the cause was the same every time: I
pinned one path, one frame, one number at a time.** The matrix is what
should have existed at the first integration.

## FIELD-GUN12: the prototype, ported

Mac, the sixth time: *"Port the god damn prototype verbatim"*.

**He is right, and the five rounds before this one are the argument.**

The lab composed its frame one way and the game composed it another,
and every round was me making the two *agree* about one more thing —
the size, the raise, the frame clock, the cooldown, the hit frame, the
volume, the pitch, a module's switch, the units of an offset, which
box the transform is applied to. Each fix was correct. **The approach
was not.** Two implementations of one thing do not converge by being
corrected; they converge by becoming one implementation.

### What moved

`gun-proto.html`'s draw block is `combat/gunViewmodel.js` now, and
both sides call it:

| was | is |
| --- | --- |
| lab's `createWidgetRig` / `widgetRigStep` | `createGunRig` / `gunRigStep` |
| lab's `labMotion` / `labWidgetSettings` | `gunMotion` / `gunWidgetSettings` |
| lab's `placeSprite` | `combat/gunPlacement.js` |
| lab's `unionDrawRect` | `combat/gunSheet.js` |
| the lab's draw block | `gunFrameRect` |

The lab imports every one of them back. **It is no longer a thing the
game resembles — it is a thing the game runs.**

### What the gun stopped going through

For this weapon the rig no longer calls `drawFpsWeapon` or Weapon
Widget's clone. Both are 1:1 ports — of DFU, and of
RedRoryOTheGlen's mod — written for the weapons those two things
have, and this weapon is neither's. Five rounds were spent making a
rect built for a CIF record come back right for a contact sheet.

It still **runs** the mod's three modules, on the mod's own settings;
`gunViewmodel.js` imports them rather than imitating them, which is
what the lab always did. And both of those files are now **untouched
by this weapon** — the `adjust` parameter, the union expansion and the
`_tlAdjust` channel are all gone from them, which is the other half of
what this bought.

### The pin is identity, not agreement

Every round before ended with a numeric pin: drive both, diff, assert
the difference is small. That is the right pin when two
implementations must exist. It is the wrong *fix* when they need not —
and each time one passed, the next thing the two composed differently
was still waiting.

`FIELD-GUN12` asserts the lab's exports **are** the game's function
objects. Not "they agree" — the same function. It cannot drift, cannot
round differently, and cannot be one path out of two.

### One thing the move fixed on its own

The frame's motor — camera, local velocity, look — was assembled
*inside* `if (widgetOn() || _torchesOn || shieldOn())`. Fine while the
three mods were its only readers; the gun's viewmodel is a fourth, and
it must see the same numbers whether or not any mod is enabled. It is
assembled above the gate now, `_lastEye` included.

### The whole lesson, twelve rounds in

**A prototype is not a specification to copy. It is code to move.**
Every round of "it still isn't 1:1" was the distance between those two
sentences.

## FIELD-GUN13: the flash, the clack and the draw

Mac, 2026-09-19, the first play *after* the prototype was ported rather
than resembled — three asks in one message:

> 1. The muzzle flasg itself shouldnt be affected by the darkening
>    lighting. It should produce lighting
> 2. The sound for holstering is a sword
> 3. The weapon should come up from the bottom screen into frame when
>    unholstering, not pop in

None of the three is a feel argument. FIELD-GUN12 ended those. All
three are the same fault the twelve rounds before them were, and it is
worth naming one more time because it is the fault this weapon will
keep producing:

> **A law written over DFU's own range, asked about index 560,
> answering its default — and a default is not an error, so nothing
> goes red.**

### #2 — the sword in the scabbard

`equipSoundFor` is `DaggerfallUnityItem.GetEquipSound` (:839-867), a
switch over DFU's nineteen weapon templates whose `default:` arm is
`SoundClips.None`. That answer is **correct**: Daggerfall has no row
for this weapon, so its table has nothing to say about it. The
departure is one line further out, in `rawToggleSheath`, where the
port had written DFU's own fallback:

```js
audio.playOneShot(equipSoundFor(playerWeapon.weapon) ?? SOUND.DrawWeapon);
```

`SOUND.DrawWeapon` is `FPSWeapon.DrawWeaponSound = 78`, the declared
default `WeaponManager.SetWeapon` (:780) overwrites whenever
`GetEquipSound` answers — and it is a blade coming out of a scabbard.
A gun has no scabbard.

**The departure is a named arm ahead of the verbatim call**, not a row
inside it. `equipSoundFor`'s domain is `SoundClips`; this weapon's clip
is a registered *string key* through the mod-sound door (MW-D40), and
widening a 1:1 port's return type to carry one departure is exactly how
a table stops being a table. The clip is `thunderlock:close` — the
lock-up clack the reload already closes on, which is what this weapon
does instead of a scabbard, going out and coming back alike.

DFU plays this only on the **unsheathe** (`toggleSheath()` answers
truthy on the draw), and that law stands: putting the weapon away is
silent, as it is for every classic weapon.

### #1 — the flash was being darkened, and lit nothing

**Why it was darkened:** `fpTint` is MAC-I's flat light, the room's
answer at the camera, and it multiplies the whole quad. A dungeon at
0.15 drew the brightest thing in the room at 0.15. There is no second
draw call to exempt — **the barrel and the fire coming out of it are
one texture**.

So the tint rises on the muzzle curve instead. The prototype composes
its room as `state.room * (1 + muzzleLight(...) * state.light * 1.9)`,
and at the lab's own room level (0.62) that **saturates** — its flash
frame really is drawn white. A multiply in a black room stays black,
which is the half of the ask that would quietly go missing, so the port
**lerps toward white** on the same two numbers. Same answer where the
lab was; the asked-for answer everywhere else.

It is the right shape anyway: the thing lighting the gun on those two
frames *is* the gun. Barrel, hand and flash brighten together and fall
away over the smoke — one lamp switching on, not a sprite special-cased.

**Why it lit nothing:** because the curve lived in `src/tools/`. It has
moved to `combat/gunFeel.js` with the rest of the feel (`MUZZLE_CURVE`,
`muzzleGlow`), and the lab's own `muzzleLight(state, frame)` now asks
the same question in its machine's words — one home, two spellings.

The emission is **`playerTorchLight`'s own shape**, deliberately. That
function is the port's one worked example of a light the player
carries: a module-level read of state the frame already parked on the
entity, answering the `{x, y, z, range, carried}` record
`magicCandle.withPlayerLights` prepends to a host's array. Written that
way, six light arrays across four hosts gain one argument each and no
host learns that a weapon can be a lamp.

Yaw only, for the reason the torch is: the offset is in the player
*body*'s space and the pitch belongs to the camera. A gun does not fire
into the ceiling because you glanced up — the shot's trajectory is the
ranged lane's business, and this is only where the flash sits.

No colour: `withPlayerLights` gives a light with no `color` the white
of the shared channel, and a muzzle flash is white-hot. Saying nothing
beats inventing a temperature.

### #3 — `shown()` is a boolean and a slide is not

The draw ladder's `if (!shown()) return;` is FPSWeapon's own
`ShowWeapon`. DFU's sprite has no draw animation — it is there or it is
not — so there was never anything to ease, and the port inherited the
cut.

The mod that *does* have one was already running on this weapon. Weapon
Widget's **Offset module** is what the reload lower rides
(`shown: false`, `hiddenTarget`), and it was being handed
`shown: !reloading` — so it eased the pump beautifully and never saw
the sheathe at all. The holster was decided one gate above it.

Two distances, one easing:

| | target | why |
|---|---|---|
| reload dip | `hiddenTarget` `[0, 0.55]` | the weapon has to stay readable while the pump runs |
| holster | `sheathTarget` `[0, 1]` | it has to **leave** — past `widgetTransformRect`'s floor clamp, which parks the sprite's top on the bottom edge |

The draw is the same curve run backwards, for free. At the mod's own
settings it takes 0.2s. The holster wins when both are true: a shot
fired on the frame the weapon is put away leaves, it does not dip.

**And the gate lets it — the sheathe leg alone.** This is the fourth
relaxation of `if (paralyzed || (!shown() && ...)) return;`, after
TORCH-VIS's lit hand, MAP-FIELD's held sheet and SW1-GATE's shield, and
it follows AUDIT-FIELD F1's rule for the reason that finding exists:
`shown()` is false for **four** things and only one of them is the
sheathe. A readied spell, a cast in flight and an equip countdown all
mean *empty hands by construction*, and a gun sliding out of frame
across them would be the port inventing a state DFU has never drawn. So
`thunderlockSliding()` tests `playerWeapon.sheathed` **positively** —
a leg added to `shown()` later cannot be relaxed here by accident — and
the other three are re-stated at the gate, with both lanes' bodies
(`!eotbHidesWeapon()`, `!fpArm.active()`) beside them. Below the gun's
own arm, `if (gunSliding && !shown()) return;` stops the clone and the
classic sprite, so every other weapon's ladder is byte-for-byte what it
was.

## FIELD-GUN14: the projectile is an orb

Mac, 2026-09-20: *"The projectile that shoots out should be an orb, not
an arrow."*

It was an arrow, and the reason is the one this weapon keeps finding:

> **A law written over DFU's own range, asked about index 560,
> answering its default.**

`isBowWeapon` is "scored on Archery", and that is the whole reason
every host's ranged gate took this weapon without being told it exists
(FIELD-GUN's own finding, one file over). The cost of that door is that
the weapon inherited the bow's **picture** along with the bow's
physics: `combat/arrowFlight.js` and `dungeonContext.js`'s missile
system each draw exactly one thing for a shaft — model **99800**,
oriented along its flight — because until now a shaft was the only
thing either of them carried.

### The orb is Daggerfall's own

Archives **375–379** are the spell missiles (`spellcast.js`'s
`missileArchive`), each an animated glowing ball the game already loads
and both flight systems already know how to draw. **378 is the shock
missile**, and the pick is the weapon's own name: a *Thunder*lock
firing a crackling orb is the thing it says on the tin. It is one
constant on the leaf, so it is one edit to make it fire (375) or frost
(376) instead.

No new art. Nothing committed. The port picks one of the game's own
flats rather than drawing a sixth.

### One question, asked of the weapon, in one place

`characters/thunderlockIds.js` — the leaf with no imports of its own,
for the reason its header gives: the two askers are
`combat/arrowFlight.js` and `scenes/dungeonContext.js`, and both are
upstream of everything `systems/thunderlock.js` touches.

```js
export const orbArchiveFor = (item) =>
  (item?.templateIndex === THUNDERLOCK_TEMPLATE ? ORB_ARCHIVE : null);
```

**The flight does not change.** Same speed, same swept raycast, same
contact law, same lifespan, same damage, same recovery rules. What
forks is the draw, and it forks on the weapon the record already
carries.

### Two flight systems, two shapes of the same fork

| | how a shaft draws | how the orb draws |
|---|---|---|
| `combat/arrowFlight.js` (world, exterior, worldModes) | `getGpuMesh(99800)`, `drawMesh` in the mesh pass | a billboard through the host's **own `hitEffects` pool** |
| `dungeonContext.js`'s S5 missiles (the fourth host) | `ensureArrowModel`, `dynamicDraws` | `ensureMissileBatch`, riding the batch's origin |

The dungeon needed almost nothing: that system **already** draws both
kinds, because a spell missile is a billboard and an arrow is a mesh.
One field — `flatArchive` — says which, and everything else about the
arrow stays the arrow's.

`ArrowFlight` had no billboard lane at all, and the temptation was to
build one. It did not need one either: every host already constructs a
`createHitEffects` pool, already ticks it, and already pushes its
batches into a billboard pass every frame. So the pool grew **one**
new kind of entry.

### A flat that flies

Every other entry in `hitEffects` is a one-shot: it plays where it was
born and ends on its own animation. A projectile is neither. So
`showFlyingFlat` adds a **tracked** entry, and `tracked` is one word
rather than two on purpose — a projectile loops *by the same fact* that
makes it caller-retired. There is no "end" for an animation to reach;
the flight ends it.

It rides `batch.origin` rather than rebuilding, which is the dungeon
missile's own trick and zero GL churn, and the recenter carries it: a
floating-origin shift rebuilds the batch from its baked centres, so the
flight's delta has to be put back or the orb snaps to the muzzle it
left.

And it has to be taken down by whoever took the shot down. Two places
drop a flight: the record dying mid-update (`arrows` is not compacted
until *every* record is dead, so a spent orb released only by that
sweep hangs in the world for as long as anything else is in the air),
and worldModes swapping buildings, which used to empty the array
directly — now `ArrowFlight.clear()`, because that host keeps one
`hitEffects` pool across every room the player walks through.

Campaign `tools/mutants/fieldgun14.json`: 14 mutants, 13 dead, 1
recorded equivalent.

### And a gun leaves no shaft to pull out

Found while wiring the above, in the same function. `BowDamage`
(`DaggerfallMissile.cs:679-687`) adds the arrow back to whatever it
struck **because an arrow survives being shot** — that is what makes it
recoverable. The port had that keyed on the **lane** rather than on the
**round**, so every foe the Thunderlock struck gained Arrows it had
never been shot with. A Dwemer Pellet is spent. Said off the same leaf
the orb is, so the two answers cannot drift apart.

**One residual, named rather than half-fixed:** the multiplayer wire
carries a hit's `kind` (`'arrow'`), not its weapon, so a peer-owned
puppet struck by a Thunderlock still gains a shaft on its owner's
client (`exteriorFoes.js:2002`, `dungeonContext.js:3707`, both gated on
`data.ar === 1`). Fixing it means widening the hit packet, which is a
protocol change and not this slice's.

### Not carried

The **impact** is untouched. `showImpactFlash` is gated on the
missile's `spell` (an arrow never flashes — `DoCollision`'s own
`elementType != None` arm), and an orb is still an arrow as far as the
impact is concerned. A crackling ball that vanishes into a wall with
nothing is a fair thing to want next; it is a second decision, and this
one is the projectile.

## FIELD-GUN15: the three picks, and the sentence that was true by luck

Mac, 2026-09-20, with the lab's panel open on his phone — a screenshot
of the three sound dropdowns and: *"Use these sounds."*

| slot | was | is |
|---|---|---|
| fire | `fire-shotgun` (shotgun, clean crack) | **`fire-dry`** (dry, no room) |
| reload open | `open-winchester` (winchester cock) | **`open-gunrack`** (gun rack, dark) |
| reload close | `close-ready` (ready, snaps shut) | **`close-shell`** (shell home) |
| volume | 0.7 | **1** |
| pitch vary | 0.06 | **0.19** |

Not the obvious picks, and they hang together. `fire-shotgun` carries a
real room's tail; this weapon is fired in a dungeon the engine
reverberates for itself, so the tail was a room played over a room.
`fire-dry` is the flat crack with nothing after it — and a drier,
quieter sample wants the gain back (hence 1) and has **nothing to hide
a repeat behind**, which is what three times the pitch jitter is for.
The two sliders moved *because* the clips did.

### The sentence nobody was keeping

`SFX_CANDIDATES`'s own header has said since it was written that the
dropdowns open on the first entry, *"which is the pick"*. It was true.
It was true because the same person typed the pick into
`systems/thunderlock.js`'s `SFX_FILES` on the same afternoon — two
places holding one decision, agreeing because nothing had yet made them
disagree.

That is the exact drift class this weapon has paid for at every round
since FIELD-GUN6, and the whole lesson of FIELD-GUN12 (*a prototype is
not a specification to copy; it is code to move*). So the sentence is a
**pin** now: the game's three clips must be the head of their candidate
list, and the panel must open on that head. Reordering the audition is
how you change what ships, which is what the header always claimed.

The volume and the jitter needed nothing new — FIELD-GUN8's panel pin
already reads the lab's own `state` literal and requires the game to
agree with it, so moving one without the other is already red.

### And a comment that was lying

`TL_CLOSE_LEAD = 0.42` said it was *"the clip's own length, so the
lock-up is finishing as the sprite arrives"*. The clip it was written
for, `close-ready`, is **98ms**. The 420 is the prototype's own
(`gun.cooledMs >= state.cool - 420`) — a judgement about where in the
pump the mechanism should sound, and the only reason it is this number
rather than another. Corrected in place and pinned both ways, because a
comment that explains a number with a fact that isn't true is worse
than no comment: the next person tunes the clip and expects the lead to
follow.

Campaign `tools/mutants/fieldgun15.json`: 7 mutants, 7 dead.

## FIELD-GUN16: the pellet was the size of a helmet

Mac, 2026-09-20: *"Shrink the inventory icon for the pellet ammo."*

`gun-ammo.png` was **22x22**. It is **16x16** now.

### Fitting the cell was never the question

The list cell is 50x38, and `makeIconDrawer` (`src/ui/itemScroller.js`)
never *enlarges*:

```js
const fit = Math.min(1, (CELL_W - CELL_MARGIN * 2) / size.width, ...);
```

So an icon is drawn at **its own size**, exactly as a classic record
is — the art's size *is* the icon's size. 22x22 fit the cell perfectly
well and still read as a pellet the size of a helmet, 44% of the row's
width.

The pin that was there could not have caught it: `ammo.w <= 50 &&
ammo.h <= 38` only says *not bigger than the cell*, and the defect was
a thing that fit and was still too big. A bound cannot catch that, so
the pin is the **size** now, with the cell's own numbers beside it
stating what fraction of the row it is.

### Why 16

Baked at 22, 18, 16, 14 and 12 and looked at them side by side in a
50x38 cell at 6x. 16 is where the dwarven banding and the central boss
still read at 1:1 on the classic surface; 14 starts eating the
engraving and 12 is a brown dot. The source is 1254px square, so every
one of those is a clean downscale rather than a resample of a resample
— nothing was lost, and going back up is one flag away.

### The tool's default is the shipped size

`tools/gunPaperdoll.mjs --ammo` defaulted to 22, which is now what
*isn't* in `public/art`. It defaults to 16, and that is pinned.

This is the same law FIELD-GUN15 had just made a pin of for the sound
picks, one round earlier, for the same reason: **a tool whose default
is not what shipped is a trap laid for whoever runs it next** — they
re-bake for an unrelated reason and quietly restore the thing that was
fixed. `gun-paperdoll.png` came out byte-identical across the re-bake,
which is the other half of that claim.

Campaign `tools/mutants/fieldgun16.json`: 2 mutants, 2 dead.

## FIELD-GUN17: the orb came out above the barrel, and the flash was the wrong colour

Mac, 2026-09-20: *"On the thunderlock, the orb doesnt allign with the
barrel when firing. Its above the barrel. Also can we can the color of
the muzzle flash and the light emitted to the same color as the orb?"*

Two halves, one fault class — and it is this port's oldest one:

> a law written over DFU's own range, asked about **this** weapon,
> answering its **default** — and a default is not an error, so
> nothing goes red.

### Where the shot leaves

The orb left from `playerArrowOrigin`, which is DFU's `GetAimPosition`
(`DaggerfallMissile.cs:540-550`): the eye, 0.11 down the camera's own
up and 0.15 to the bow hand. That is exactly right about the one
ranged weapon Daggerfall has, because it is *the nock of a drawn bow*.

The Thunderlock reaches this lane the way it reaches every other one —
`isBowWeapon` is "scored on Archery", which is why no host had to be
told the gun exists. It inherited the shaft's physics (right), its
picture (FIELD-GUN14 forked that) and its **origin** (this). The gun
is drawn low and to the right with its barrel lower still, so the orb
came out well above it.

**The answer is where the gun is drawn, not a number.** A baked offset
would be right at one canvas, one aspect and one field of view and
wrong at every other, and it would not move with the bob, the sway,
the recoil or the handedness mirror. So:

1. **The art measures its own muzzle.** `thunderlockArt.muzzlePoint`
   takes the idle frame and the fired frame — which are the same
   picture except where the flash is — and answers the *brightness-
   weighted centroid of the difference*, in fractions of the union
   box, y from the top. `MUZZLE_GAIN` is the threshold that makes it a
   flash rather than a compression wobble. No flash to find is `null`,
   not a muzzle at (0,0).

2. **`muzzleRay` turns that point into a direction.** It is the rig's
   whole arithmetic, exported on its own so it can be driven with a
   rect and a canvas and no renderer in the room: the drawn rect, the
   canvas, the mirror, and the player's live FOV, out to a camera-space
   `{right, up, forward}`. It is a **ray**, proportional to `forward`
   on purpose, so the orb lies on the barrel at whatever distance the
   caller chooses to start it from — `MUZZLE_FORWARD` (0.5) only picks
   how far out.

3. **`playerMuzzleOrigin` composes it onto the world**, on the same
   basis `playerArrowOrigin` rebuilds. No handedness term here: the
   mirror is a fact about the *drawn rect* and `muzzleRay` has already
   applied it, where `PLAYER_ARROW_SIDE` is a bare number that has to
   be flipped at the point of use.

4. **Both missile lanes fork, they do not replace.** A supplied muzzle
   wins; nothing supplied keeps `GetAimPosition` verbatim — which is
   every bow, at every host, untouched. And all four hosts hand it
   over (the FOUR HOSTS RULE, which this weapon has paid for at every
   round it forgot one): `world.js`, `exterior.js`, `worldModes.js`,
   `dungeonContext.js`.

The rig's door refuses for anything that is not this weapon, and for a
frame it has not drawn. A bow keeps the verbatim arm because it is
handed **nothing** — not because the fork spells the gun's name.

### What colour the flash is

The muzzle flash and the point light it throws were white, because
white is what a powder flash is. This gun does not fire powder; it
fires the orb, and the flash should be the orb going off.

**The orb tells us its colour** rather than a hex being typed in two
places and kept in step by hand. `hitEffects` grew one door —
`onTexture`, a callback about a *texture*, not about guns — and the
two places the orb is uploaded (`arrowFlight`, `dungeonContext`) hand
the decoded sprite to `noteOrbColour` the one moment it is warm.

`orbColourFrom` is an **alpha-weighted mean, peak-normalised**: a dim
orb and a bright orb of the same hue give the same answer, because
this is a *tint*, not a brightness. Transparent pixels weigh nothing
(the clear half of a sprite is most of a sprite and must not drag the
mean towards black), and a sample that answers nothing does not count
as the sample — otherwise a clear first frame would lock the gun to
white for ever. It takes **once**: a second archive does not get to
repaint the weapon.

Both consumers read the one leaf. The frame *lerps* toward the orb
rather than being assigned it, so an unlit room still darkens the gun;
and `thunderlockMuzzleLight` carries the same colour out to the world,
so the wall the shot lights up is lit in the orb's colour too.

White until something is sampled — a default, and this time it is the
right one.

Campaign `tools/mutants/fieldgun17.json`: 19 mutants, 17 dead, 2
equivalent (both recorded with their reason: the centroid's brightness
weighting, which no fixture in the tree can distinguish from a count,
and the alpha weighting, which is a no-op on the binary-alpha sprites
every classic archive decodes to).

## FIELD-GUN18: two sizes, and a branch that had never run

Mac, 2026-09-20: *"1. shrink the projectile orb slighty  2. Shrink the
orb pellet ammo sprite in the inventory. It's too large"*

### The orb

It flies on TEXTURE.378 record 0 — a classic **missile** archive,
sized for a spell. A fireball is meant to fill the corridor it is
coming down; a pellet out of a barrel is not, and at the archive's own
size the shot read as a thrown spell rather than as ammunition.

`ORB_SCALE` is **a scale, not a size**. `billboardSize` is DFU's own
law — RMBLayout's `scaleDivisor`, plus any billboard XML the player
has installed for that archive — and a width typed into the leaf would
quietly opt the orb out of both. Multiplying whatever that law answers
means a texture pack that resizes 378 still resizes the orb. 0.85: a
sixth off, which is *slightly*, as asked.

Both lanes take it, and the fourth host takes it **twice over**: its
missiles build their own batch and never touch `hitEffects`' pool, so
the pool's `scale` cannot reach them and the multiply is written a
second time — gated on the same `flatArchive` the picture and the
colour already fork on, so that a spell missile is not shrunk with it.

### The branch that had never run

Handing the orb to the pool's `scale` walked into a bug in that knob.
`billboardSize` answers a `{w, h}` **record**, and the branch applying
`scale` read:

```js
Array.isArray(size) ? size.map(v => v * scale) : size * scale
```

An object is not an Array, so every scaled flat took the second arm —
**object times number, which is `NaN`**. And a `NaN` size is not a
visibly wrong size: it is `size.w === undefined` at the batch and a
quad with `NaN` corners, so the flat is not drawn at all.

The one caller that used it is `showMissEffect`, whose scale is **2 by
default** and which all four hosts wire to the weapon widget's
DoClang/DoThud. So that effect has drawn nothing, at every host, since
WW1 shipped — a shape the value never had, in a branch nothing
measured. The pin asserts the shape *where it is produced* now, so it
cannot rot back into a guess about what `billboardSize` answers.

### The pellet icon, again

12px, down from 16, down from 22.

FIELD-GUN16's note in `tools/gunPaperdoll.mjs` claimed that "14 starts
eating the engraving and 12 is a brown dot". **That judgement was
wrong**, and it is worth saying why rather than quietly moving the
number: it was made against an 8× *preview* in a container with no
game in it, where a sprite is inspected instead of glanced at. At 12
the dwarven banding and the central boss both still read — and the
person with the game says 16 does not.

A judgement made at 8× about a thing seen at 1× is a guess. The
default in the baker is the shipped size, as ever, so a re-bake
reproduces what is committed.

Campaign `tools/mutants/fieldgun18.json`: 11 mutants, 11 dead.

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

## FIELD-GUN-MW1: in Morrowind mode the gun is not there

2026-09-20, Mac, uploading `Pellet_Shot.fbx`: *"Next up is texturing
and rigging this for the morrowind model (We recently integrated a new
weapon called Thundershot)."*

**THE WEAPON IS INVISIBLE IN THE MORROWIND ARM, AND THE PORT ALREADY
SAYS SO.** `resolveWeaponParts` (`src/combat/fpArm.js`) resolves the
held weapon through `dfWeaponToMw`, which walks `characters/weapons.js`'s
`WEAPONS` table and looks the name up in `DF_TO_MW_WEAPON`. The
Thunderlock is in neither — it is template 560, registered at runtime
by `registerCustomTemplates`, and `WEAPONS` is DFU's own frozen list —
so the lookup answers `MW_WEAPON_TYPE.None`, the function falls to its
last arm, and the note it pushes is verbatim:

> `weapon: Morrowind has no weapon type for what you are holding`

No part is pushed. In Morrowind first person the player holds **empty
hands**. This is not a bug in the resolve: it is the resolve being
exactly right about a weapon Morrowind does not have. Every mesh in
that lane comes out of the PLAYER'S OWN INSTALL by search token
(`pickWeaponRecord`), and no search token finds a dwemer firearm in
data that has none. Nothing in `mwItemMap.js` can fix it either — its
"TOTAL, AND HONEST" coverage walk enumerates `WEAPONS` x
`WEAPON_MATERIALS`, so the one weapon in the port that is genuinely
unmapped is the one weapon its census never asks about. **A rule
enforced by an enumeration is a rule enforced by memory**, and this is
the enumeration's blind spot, named here so the next slice can close
it rather than re-find it.

**SO THE MODEL HAS TO BE OURS**, which is why Mac sent an FBX — and
the file, despite its name, is **the gun**: 124 polygons, and rendered
(`tools/meshSheets.mjs --preview`) it is unmistakably a short
pistol-grip firearm, barrel forward, sight on top. `Bolt Shot.blend`
is its Blender source.

### The bake, and why it is a tool and not a format

`tools/fbxRead.mjs` reads the binary FBX container; `tools/fbxMesh.mjs`
bakes one Geometry/Model pair into **the shape `flattenNif` already
emits** (`src/formats/mwNifMesh.js:385-387` — positions / normals /
uvs / colors / indices / material). Not a second mesh format: the same
one, so the Morrowind lane's whole downstream needs no new consumer.

Nothing FBX ships to a player. `src/formats/` holds the runtime's
parsers because the bytes they read are on the player's disk; an FBX
exists once, on Mac's machine, and the game never sees it. The
precedent is `tools/gunPaperdoll.mjs` one dimension down — raw art in
`scratch/` (ignored), the port's own asset out, the source never
committed.

Four things the bake does, each one a place a wrong answer looks
plausible on screen:

- **Triangulates.** FBX stores n-gons, ended by a ones'-complement
  index. A fan is only a triangulation of a CONVEX polygon, so a
  concave one is **refused by name** rather than folded inside out —
  the shard of stray geometry that is invisible in a diff.
- **Welds on the (position, normal, uv) TRIPLE.** 543 corners, 199
  positions, 539 vertices: a hard edge and a UV seam are splits that
  have to survive, and a shared corner is a split that must not.
- **Bakes the scale, drops the placement.** Blender exported with the
  transform unapplied, and the scale is NON-UNIFORM (43.75 / 35.45 /
  84.59), so it is geometry and not a scalar a caller can carry.
  Normals take the **inverse transpose**, or an 8:1 stretch tilts every
  highlight on the barrel. `Lcl Rotation` and `Lcl Translation` are
  where the object sat in Mac's scene and are dropped — recorded as
  dropped, not silently ignored.
- **Lands in a stated frame.** `--forward` / `--up` name which local
  axes become Morrowind's +Y and +Z; the third is their CROSS PRODUCT,
  which is what makes a mirrored basis impossible to write by accident.
  The default is MEASURED: sliced along its long axis one half is a
  uniform 0.12 x 0.14 tube and the other carries everything 0.21 and
  0.26 deep — a barrel and a receiver — so forward is `-Z`; and `-X`
  up is the one of the two signs that renders as a firearm the right
  way up. Then centred on its own bounds and scaled so the longest
  axis is 1, so the port sizes it with ONE number.

### What the bake found in the asset

Verified, not assumed:

- **No texture exists.** The FBX carries `Geometry` and `Model` and
  nothing else — no `Material`, `Texture`, `Video`, `Deformer`, `Skin`,
  `Cluster`, `LimbNode`, `BindPose` or `AnimationCurve`. There is a UV
  unwrap (`UVMap`, exactly 0..1) and no image to put on it. So
  `tools/meshSheets.mjs --uv` draws the unwrap at texture resolution:
  that sheet is the deliverable to paint on, and it is the only half of
  "texturing" this side can do.
- **No bones.** Nothing to skin to, which means "rigging" here is the
  ATTACH — `parts.push({ slot: 'weapon', bones: [bone] })` against the
  arm's weapon bone — and not a skin cluster.
- **The mesh is OPEN.** 410 edges are shared by two triangles and
  **65 by one**; 65 of its 199 positions sit on a boundary, at the
  rear and around the receiver. Winding is consistent (295 of 295
  faces agree with their normals) and no face is degenerate, so this
  is holes and not a broken bake. Backface culling will see through
  them.

### The pins

The fixture is **written by the test**, not recorded: a forty-line
binary-FBX writer, so the pin drives the reader against bytes and no
blob nobody can read in a diff enters the tree. 9 pins, 29 mutants, 29
killed — **after two of them were re-aimed, both for being vacuous**.
The handedness assertion recomputed `f x u` from `f` and `u`, which the
mirror mutant never touched, so a flipped cross product passed; and the
weld fixture varied only ONE part of its key, so a key that dropped
either of the other two passed. Both now ask the thing that actually
moves.

### What is not done

The bake exists; **nothing draws it yet**, on purpose. The wiring needs
a texture that does not exist, an answer on the open boundary, and an
orientation settled against a real Morrowind weapon bone rather than
guessed — and a mesh in `public/` that nothing loads is the dead seam
this project keeps deleting.

## FIELD-GUN-MW2: the gun is in the hand

2026-09-20, Mac: *"Continue. Figure this out yourself."*

MW1 said the bake existed and nothing drew it. This draws it.

### The mesh becomes a NIF, because that is where a part goes in

`bindPartsInto` (`src/formats/mwFirstPerson.js`) does
`parseNif(part.bytes)` and hands the result to `bindPart`. **A part IS
NIF bytes.** The obvious alternative — teach the bind to take
pre-flattened batches beside NIF bytes — is the wrong one, and this
file's own history says why: *"MW7 failed by carrying a second port of
one rule, and two copies of a rule drift."* Everything a part gets on
the way in is behind that door: rule 34's discarded root transform,
rule 14's BoneOffset, rule 13's mirror, the property chain, the attach.
A second entrance would have to re-implement or skip every one of them,
for ever, for one mesh.

So `tools/nifWrite.mjs` writes a Morrowind 4.0.0.2 NIF, and the port's
own weapon is a part like any other. The check is the strictest one
available: the pin parses what the writer wrote with **the port's own
`parseNif`** and flattens it with **the port's own `flattenNif`**. A
4.0.0.2 stream carries no record sizes, so one byte wrong anywhere
desynchronises the rest of the file, and `parseNif`'s own
trailing-byte check means a writer four bytes out cannot produce a file
that parses at all.

Seven records, each there for a reason: an `NiNode` root (rule 34 wipes
record 0's transform **in the parser**, so identity is not a
simplification, it is the only thing that survives), a **nameless**
`NiTriShape` (MW-D6: a nameless shape binds once for the part, a named
one binds once per side and is filtered), the geometry, a white
material (the texture carries the colour; a tint here would be a second
place to change it), the texturing property, an external
`NiSourceTexture`, and an `NiStencilProperty` with **DrawMode 3
(Both)** — rule 65's only two-sided value, and the honest answer to a
shell with 65 single-shared edges. Morrowind's own artists reach for
exactly that record when a model has an open side, and the alternative
— inventing geometry to close somebody else's mesh — is worse than
drawing what they made.

### The FBX has no unwrap at all

This is the finding the slice turns on, and it is a measurement rather
than an opinion. The export carries a `LayerElementUV` named "UVMap",
which looks like an unwrap until it is counted:

> **45 distinct UV coordinates** over 539 vertices, every one on an
> exact eighth, and the triangles' UV areas **totalling 8.49** — the
> atlas covered eight and a half times over. Every single covered texel
> is claimed by more than one triangle, and one texel by **thirty-nine**.

That is Blender's factory cylinder mapping: the UVs a `Cylinder`
primitive is born with. Every section extruded or duplicated to build
the gun inherited the same eight strips, so the barrel, the receiver
and the grip all sit on top of each other in texture space, and **any
texture at all puts the same pixels on every part of the weapon.** The
first bake proved it — four deliberately different bands came back
within three levels of each other on all four, because the last
triangle to rasterise a texel won and which one that was is arbitrary.

So `tools/meshUnwrap.mjs` computes one. Islands by shared edge and a
66-degree fold — walked over **welded position indices**, because the
export splits a vertex at every hard edge and UV seam and a walk by
vertex index would make every face its own island. Each island
projected onto the plane of its area-weighted average normal, rotated
to its minimum-area bounding rectangle, and shelf-packed at **one
global scale**, so a texel is the same size in world units everywhere
on the gun. 49 islands, coverage 8.49 → 0.57, nothing overlapping.

### The texture is baked off the geometry, not painted blind

There is no image in the FBX and no image to bake from. Painting one by
hand into an atlas, sight unseen, is guessing where the barrel is.

A texel is not a blank square: the mesh says exactly which point of
which triangle it covers. `tools/meshTexture.mjs` rasterises the model
**into its own UV space**, so every texel knows its position, its
normal and how enclosed it is — and those three answer the questions a
metal texture asks. Position along the long axis separates muzzle from
barrel from receiver from grip. **Ambient occlusion, cast for real**
against the mesh's own triangles, is the one shading term that belongs
in a texture: it is view- and light-independent, where a baked
highlight would fight the renderer's own lighting and follow the gun
around the room. The normal gives the lengthwise brushing on a turned
barrel and keeps the top plates cleaner than the undersides, which is
where a carried weapon actually wears.

Deterministic throughout — a fixed integer hash, no seeded RNG, no
clock — so the same mesh bakes the same bytes.

**Three bugs the pins caught that an eye would have called art:**

- the packer's scale bisection was **capped at its starting bound**,
  returning exactly 1 for a mesh whose longest axis is 1 by
  construction, and leaving sixty per cent of the atlas empty;
- the bands were measured from the axis **minimum** — which after the
  MW1 bake is the butt — so the sooted-muzzle band painted the grip.
  Both ends are dark, so it looked plausible and only the two middle
  bands were visibly wrong;
- the palette was typed in screen values. Linear 0.30 encodes to sRGB
  0.59, so it came out pale and chalky.

**And one thing was taken out rather than tuned.** A verdigris keyed on
occlusion fired over most of the gun (this mesh's mean AO is 0.60, so
"the deepest crevices" was nearly all of it); tightening the threshold
moved the green blotches without removing them, because the recessed
plates along the barrel are exactly the places that are both occluded
*and* the most visible surface on the weapon. There is no threshold
that tells "a crevice" from "a machined channel" out of occlusion
alone. A patina on the parts a player looks at all day is worse than no
patina.

### It reaches the arm through the doors that already exist

Three seams, and not one of them is new machinery:

1. **`src/characters/ownWeaponModels.js`** — the weapons Morrowind does
   not have, by template index. A **table, not a branch**: the
   Thunderlock is explicitly *"THE FIRST ONE OF ITS KIND"*, and the
   second one must not be a second `if` in somebody else's function. A
   leaf, for the same reason `thunderlockIds.js` is one. It hangs on
   **"Weapon Bone"**, the reference's own untyped fallback — the typed
   left/right names belong to Morrowind's weapon *types* (MW-D32,
   npcanimation.cpp:787-795) and this weapon has none.
2. **`src/systems/ownMwAssets.js`** — the NIF and the DDS, through
   Vite's glob door, as WS1's vendored scabbards already are. It mounts
   in `dataSource.js`'s archive list **after the player's loose files**
   (MW-D40's data-files-over-BSA law, so Mac dropping his own texture
   in replaces ours without a rebuild) and **before every .bsa**, where
   these names do not exist.
3. **`src/systems/urlArchive.js`** — `makeVendoredArchive`, moved out
   of `weaponSheathing.js` body-unchanged and re-exported from there so
   no caller moved. Twice is a law: a generic archive living inside one
   vendored mod's module is a home that only looks like one until
   something else needs it.

`resolveWeaponParts` gains one arm, **before** the type lookup rather
than after it, so the note below it — "Morrowind has no weapon type for
what you are holding" — stays true of the items it is actually about.
It cannot shadow a Morrowind weapon: `ownWeaponModelFor` answers only
for template indices `registerCustomTemplates` minted, which are past
every DFU index, and the pin walks all eighteen to say so. When our own
file is missing, the note blames **the build** and not the player's
archives — sending somebody hunting through a Morrowind install for a
file that was never going to be there is its own bug.

### Two gates were blind, and both are paid

**`itemMapCoverage` never asked about the gun.** Its population was
`WEAPONS` — DFU's frozen eighteen — so the one weapon in the port that
genuinely had no Morrowind model was the one weapon the census never
walked. It reported total coverage while the gun drew empty hands, for
every player, for the life of the arc. This file's header promises a
row "must SAY it, never fall through silently"; an item outside the
population cannot even fall through. It now walks the port's own table
too, and the pin's count is **derived off that table** rather than
typed, because being outside a hand-counted population was the defect.

**The allow-list was only checked one way for `src/assets/`.** AUDIT 27
added the reverse read precisely because *"the list was only ever read
one way"* makes it mean less than it claims — and its own comment says
the intro "ships from src/assets through Vite. Read each row's own
directory so bundled art has the same ownership check as public/." The
reverse read did. The forward read did not, so a new file bundled out
of `src/assets/` needed no row at all. It covers both directories now.

### What ships, and what it is

`src/assets/mw/meshes/thunderlock.nif` (19 KB) and
`src/assets/mw/textures/thunderlock.dds` (256×256, nine mip levels —
Morrowind's own weapon-texture size). **Both are Bethesda formats
containing no Bethesda data**, which is the distinction the allow-list
exists for: the mesh is Mac's model and the texture is generated from
that mesh's own geometry with no image input at all. Re-run the chain
on the same `.fbx` and the same bytes come out.

The texture is **a material, not artwork** — believable dwemer bronze
with its own occlusion, so the gun reads as a solid object in the hand.
`tools/meshSheets.mjs --uv` still draws the unwrap for painting over,
and now it is an unwrap worth painting.

## FIELD-GUN-MW3: "and this is rigged properly?"

2026-09-20, Mac, in as many words. **No — it was attached, which is not
the same thing.** Three gaps, each measured rather than guessed, and
all three now closed.

### It was a centimetre and a half long

Morrowind is **69.99 units to the metre** (`MW_UNITS_PER_METER`). MW2's
bake normalised the mesh to a longest axis of exactly 1, which is a
tidy number for a *mesh* and a meaningless one for a *weapon*: the gun
was **1.43 cm**, about 1/38th of what a hand could hold.

The bake takes `--units` now and `tools/bakeThunderlock.mjs` asks for
**0.75 m × 69.99 = 52.5 units**. That length is the weapon's own row,
not a preference: `isOneHanded: false` (both hands on it in the art the
lab settled) and `baseWeight` 6.0, the heaviest weapon in the game — a
short two-handed carbine. Longer would out-reach a claymore; shorter
would be a pistol, and the port already decided it is not one.

### The fist closed around the receiver

The bone it hangs on is a **hand**, and MW2 pivoted the mesh on its
bounds centre — so the middle of the weapon sat at the bone and the
hand gripped the receiver. `--origin=grip` puts the origin at the
**centroid of the rearmost band of the long axis**, derived from the
geometry rather than typed. The muzzle now sits 47.4 units ahead of the
hand and the butt 5.1 behind it.

### The arms were punching

This is the one that "it attaches to the right bone" hides completely.
`resolveWeaponParts` returned `MW_WEAPON_TYPE.None`, and
`animWeaponType` turns None into **HandToHand** (`fpArm.js:286`) —
correct for empty hands, absurd for a man holding a dwemer firearm. The
rig played unarmed stances and the gun went along for the ride:
`composeWeaponGroup` returned no group at all, `weaponShortGroup` the
empty string.

**A weapon TYPE is not a MODEL.** The model had to be ours because
Morrowind has no gun; the *animation* does not, because Morrowind has
something shaped exactly like this act. The row names a type to
**borrow** — `MarksmanCrossbow` — and it matches on every axis the
animation system asks about:

| | Thunderlock | MarksmanCrossbow |
|---|---|---|
| hands | `isOneHanded: false` | two-handed |
| motion | fired, not swung | `shootsRatherThanSwings` true |
| cycle | a visible reload (the lab's finding) | `reloadsItself` true — and it is the **only** type that is |
| ammunition | a Dwemer Pellet | a bolt |

It resolves to the `crossbow` group, the `shoot start` / `shoot max
attack` / `shoot release` keys, and a left hand that carries nothing.
**Its ammunition is not borrowed**: `ammoTypeFor(crossbow)` is Bolt,
and the arm would instance a Morrowind quarrel on the arrow bone, so
the resolve returns before that arm and `borrowsAmmo: false` on the row
says so where somebody changing this will read it.

### And a fourth thing the model found on the way

Re-baking at the right size put a **black rectangle on the receiver**.
Not a texture bug — an unwrap bug, and a bad one.

MW2's island walk compared each face to **the neighbour it joined
across**. Fold tolerance *chains*: on an eight-sided barrel every
adjacent pair is 45° apart, comfortably inside 66°, so the walk went all
the way round and made the whole ring **one island**. The average normal
of a closed ring is nearly zero, so the far side projects on top of the
near side and the faces at right angles to it **collapse to a line** —
**78 of 295 triangles with real 3D area and zero UV area**, the largest
fifty square units. A triangle with no UV area samples one texel and
paints its whole face with it.

Islands grow against their **own running average** now — which is what
Blender's Smart UV Project does, and what makes the projection sound by
construction: every face is within the threshold of the plane it is
actually projected onto, so under 90° nothing can collapse. 49 islands
became 74, and the count of collapsed faces is 0.

### The pin that makes every other pin load-bearing

A mutation campaign over the bake chain left **six survivors**, and they
had one cause between them: **the committed `.nif` and `.dds` are the
output of a run that already happened.** Islands could go back to
growing against the neighbour, the scale back to a normalised 1, the
pivot back to the bounds centre — and the suite stayed green, because
every pin was reading an artefact rather than a derivation.

So **Mac's `.fbx` is committed** (17 KB, at `src/assets/mw/source/`)
and the suite re-runs the entire chain over it and compares the result
to the shipped bytes, twice, so determinism is asserted too. That is a
departure from `tools/gunPaperdoll.mjs`, whose thousand-pixel PNGs stay
in the ignored `scratch/`, and it is made on purpose: the allow-list row
for these files claims *"re-run the chain on the same .fbx and the same
bytes come out"*, and **a derivation you cannot re-run is a claim you
cannot check.** All six survivors died the moment that pin existed.

60 mutants over the two slices, 60 killed.

### What is still not done

The gun is the right size, hangs from its grip, and plays the crossbow's
animations. What nobody has done is **look at it in the arm**: the
`BoneOffset` a Morrowind weapon can carry to nudge itself on the bone is
absent, so the grip sits exactly at the bone's origin, and whether that
reads as *held* rather than *floating* is a question for eyes on a
running build, not for a pin.

## FIELD-GUN19: the flash was white and the shot came out high

2026-09-20, Mac: *"The muzzle flash texture itself needs to be blue like
the orb and the lighting thats emitted needs to be blue"* and *"the orb
projectile that shoots doesnt line up with the muzzle. It shoots out
high on the screen"*.

Two reports, **one species of bug**: a number that answered a question
nobody had asked. Both had already been "fixed" — FIELD-GUN17 built the
colour channel and named the muzzle ray — and both were still wrong,
which is the useful part.

### The shot: a canvas pixel is not a world position

`muzzleRay` turns the barrel's pixel into a camera-space offset. It
divided by `canvasH` and said so in a comment: *"the CANVAS's aspect,
not the world viewport's — the viewmodel is drawn over the whole
frame."*

That sentence is **true of the gun and says nothing about where the orb
lands.** ROAD-E E5 made the two different spaces: the docked large HUD
**shrinks the world pass** (`setWorldViewport`, ViewportChanger.cs
:52-67) while the 2D pass takes the whole canvas back at the first
`drawScreenQuad`. So the gun really is drawn over the full frame, and
the shot is projected into a strip that is shorter than it.

Dividing the pixel by the taller of the two gives a **larger** `up`.
Measured on a bar a fifth of the screen high: the shot sat **96% too
high**, which is very nearly "at the centre of the screen instead of at
the barrel" — exactly the report.

**E5 already knew about this class.** It converted the crosshair
(`hudCrosshair.crosshairCentreY`, or the reticle points where the camera
is not) and the tap pick (`player/tapRay.js`). The viewmodel's muzzle
was the **third consumer**, and nobody counted it.

`worldRectPx` is tapRay's own arithmetic — the normalized bottom-left
rect into top-left canvas pixels, which is the part with a flip in it —
and it is reused rather than re-derived. What is deliberately **not**
reused is its bounds test: a tap outside the strip is not a pick, but a
muzzle below it is a real point below the bottom of the view, and
clamping it would move the shot.

The rect has to survive to the 2D pass, so the renderer now keeps
`worldViewportRect` — a **record**, where `_worldViewportPx` is GL
**state** and is rightly cleared by `endWorldPass` (EV6: state the
renderer owns must not leak between passes).

### The flash: a blown-out core has no opinion about hue

FIELD-GUN17 wired this end to end — the orb tells the flash and the
light what colour it is, sampled off its own archive, so nobody types a
number. All of that was right. **The statistic was wrong.**

It took the alpha-weighted **mean** of every opaque texel, and a glowing
missile sprite is an over-exposed white core inside a coloured halo. The
core is the brightest thing in the record and the most opaque, so it
dominated the mean; peak-normalising a near-white mean makes it paler
still. The answer was a lavender indistinguishable from the white it
replaced — which is why the whole channel looked like it had never been
wired at all.

**The core is white because it is over-exposed, not because the orb is
white.** A texel with no saturation carries no information about what
colour the thing is, so it is not allowed to vote: the weight is alpha
**times chroma**. What is left voting is the halo, which is where a
viewer reads the colour from anyway. On a shock-orb-shaped record the
old mean gave `125,152,255` and this gives `68,107,255`.

Falling back to the plain mean for a genuinely greyscale record is part
of the rule and not a guard: a white orb should answer white.

### Three campaign survivors, each a fixture that could not see its hole

- **The strip's top edge.** The large HUD's bar is at the **bottom**, so
  the strip starts at canvas row 0 and `r.y` is zero — a mutant that
  dropped the `- r.y` term passed everything. The renderer's rect is
  general, so the pin is now a strip pushed *down* the canvas.
- **A getter over a field nobody assigns** answers null for ever, which
  is the full canvas, which is the bug. The pin only asked whether the
  getter existed.
- **Chroma alone**, without alpha, passed because everything chromatic
  in the fixture was blue. The pin now carries an almost-transparent red
  rim — very saturated, covering nothing — which chroma alone would let
  repaint the whole orb.

10 mutants, 10 killed.

### One thing left, said plainly

The colour is learned the first time an orb's texture resolves, and that
load is asynchronous, so **the very first Thunderlock shot of a session
can start white and turn blue partway through its own flash.** That is
FIELD-GUN17's stated "white until warmed" design and it is a far smaller
thing than what was reported; making even the first shot blue means
warming the archive when the weapon is equipped rather than when a shot
flies, which is a wiring change across the hosts and its own slice.

## FIELD-GUN20: the anchor, after the origin and the strip

Mac, 2026-09-21: *"The orb projectile that fires is still not alligned
with coming out of the barrel (classic sprite not morrowind)."*

Third round on one symptom, and each round was a different question.
FIELD-GUN17 asked *where the shot starts* and answered with the drawn
barrel's own pixel. FIELD-GUN19 asked *which space that pixel is in*
and answered with the world strip. Both are right, and after both the
orb's **position** lies on the barrel. What was never asked is where
the **picture** is relative to the position.

### The renderer anchors at the base, and DFU does not, for this

The billboard vertex shader places a batch's sprite with its centre
half a height above the placement point (`(aCorner.y + 0.5) * uSize.y`
- "bottom-anchored"). That is `DaggerfallBillboard.AlignToBase`
(:410-416, `offset.y = Size.y / 2`) baked in, and it is right for
every flat a block places, because DFU calls AlignToBase on all of
them - `rmbFlats.js` says so at the top: "AlignToBase handled by the
renderer".

A missile is not a block flat. `DaggerfallMissile.cs:601-602` creates
its billboard on the missile's own transform at `localPosition =
Vector3.zero` and never aligns it; `EnemyBlood.cs:32-35` sets the
splash's `transform.position` to the hit point and never aligns it.
Both are **centred** on the position they are given. So the port's
three lanes that place a sprite by its position - the effect pool
(`hitEffects.spawn`: the orb in flight through `showFlyingFlat`, every
impact flash, every blood splash, the sparkles), the world hosts' spell
missiles (`hostMagic.ensureMissileBatch`) and the fourth host's own
(`dungeonContext.ensureMissileBatch`, the orb and every spell) - each
drew its sprite **half a height above where it was**. At half a metre
from the eye, half an orb is most of a screen.

The fireball and the splash were wrong by the same half and nobody
said so, which is what a picture at a wrong height looks like when
there is no barrel beside it to measure against.

### One law, one home

`rmbFlats.centredBase(pos, size)` - the position with half the
billboard's height taken off - beside `billboardSize`, where the
AlignToBase note already lives. The three lanes hand the renderer that
base; the flight's delta rides the origin uniform centre-to-centre and
does not move, and a floating-origin rebuild takes the same base. The
block flats keep their base, and a pin holds that none of them takes
the missile's anchor. (The thrown torch had already done this by hand -
`droppedTorches.js` lowers its projectile by half its texture height -
which is the same law written once more; it stays as it is, cited.)

**Pinned** in `test/thunderlock.test.js` (+2, 39): `centredBase` by
value (half the height, not the width; no size yet is the position
itself), every batch build in the three lanes taking it - counted per
file, the fourth host's and the world hosts' by their exact lines, the
bare fire position gone - and the other half of the law (no flat
placer takes it); and on the pool itself: an orb spawned at
FIELD-GUN17a's own muzzle offset lands its **centre** on the muzzle,
the base half its scaled height under it, and a move is a delta
between centres. Re-aimed at the centred base: `arrowflight.test.js`
(the fire position and the rebuild), `audit24_wave39.test.js` (four
splash bases), `audit24_wave44.test.js` (the sparkles),
`audit26_render.test.js` (the rebuild's source line). Campaign
`tools/mutants/fieldgun20.json`: 7 mutants - the pool at the bare
position, the rebuild at the bare position, each missile lane at its
bare fire position, the base lifted instead of lowered, half the width,
a block flat centred - all dead.

**Not seen on a screen.** This container has no ARENA2 and no GPU; the
claim is DFU's source against the shader's anchor, and the pins hold
the arithmetic. If the orb still reads off the barrel after this, the
next question is the flash's centroid (`thunderlockArt.muzzlePoint`
weighs the whole bloom, and a flash that blooms upward measures above
the bore) - a different question again, and a screenshot's.

## AUDIT FIELD-GUN-MW (2026-09-21): the gun in the rig, both views

Mac: *"The newly integrated gun on the morrowind rig needs proper rigging
in 3rd and 1st person, proper animations. Just want you to audit it and
ensure its perfect."* Four lenses over MW1/MW2/MW3, read against the rig's
own laws (MW-D42 for the shot, rule 24 for the release key, WS1 for the
holster). Two defects paid, one records gap paid, two things recorded
that only eyes on a build can close.

**F1 (PAID): the shot fired at the click under the arm, in both views.**
MW-D42's hold - the machine's hit waits for the arm's "shoot release" -
gated on `machine.isBow`. The Thunderlock is `machine.ranged` and not a
bow, so under the borrowed crossbow animation its hit rode straight
through: the orb left at the machine's frame 1, 70 ms after the click
(`GUN_FEEL.fps` 14), while the arm was still winding up. And the
weapon's VOICE - the bang, the recoil punch, the room shake, the flash -
fired on the machine leaving Idle, the click. The bow paid exactly this
at MW-D42 and MW-D42d ("the sound affect plays before the arrow is
fired"). Now: the gate is `ranged`; the hold is `holdShotForArm`,
decided FIRST in the frame so `thunderlockVoice` is told the frame a
held hit went (`fired`); under the arm the trigger is that frame, and
the flash counts from it on the curve's own tick (`flashFromClock`)
rather than from the machine's frame. The classic lane keeps the click,
because its sprite IS the machine's frames. Third person holds like
first (MW-D42c's `thirdActive()` is in the same condition). The reload's
two clacks still ride the machine's cooldown, which starts at the
click - the crossbow's own reload follows its release, and the two
roughly overlap; recorded, not retuned.

**F2 (PAID): the orb left the eye, not the barrel, in both views.**
`thunderlockMuzzle` read `_tlDrawn`, the classic sprite's record - written
by `drawThunderlock`, which the arm's branch of the draw ladder returns
BEFORE. Under the arm it was null, or a stale rect from before the arm
came up, so `arrows.fire` fell to the eye centre in first person and to
the camera - behind the body - in third. FIELD-GUN17 and 19 fixed the
muzzle for the sprite only. The rig now answers for itself:
`combat/rigMuzzle.js` (pure) finds the muzzle as the vertex farthest from
the piece's origin - the GRIP, since MW3's `--origin=grip` - so no axis
is assumed and a re-bake that turns the mesh does not move the muzzle
off the barrel; `fpArm.weaponMuzzle()` poses it through the frame the
last draw of THAT view composed - first person as the classic muzzle's
own lens offset in metres, third person as a world point through
`drawThird`'s model (kept as `lastThirdModel`), because behind the body
a lens offset is the wrong shape. The origin fork itself - a world muzzle,
a lens muzzle, or GetAimPosition's bow-hand arm - lived twice, restated
in `combat/arrowFlight.js` and in the dungeon host's own missiles
(ROAD-H H1c's "BOTH arrow spawn seams"), so a third arm added to one
would have missed the other; it is ONE function now,
`playerShotOrigin` in `systems/spellcast.js` beside the two arms it
forks, and both seams call it. The three hosts that fire the shot were
not touched: they already ask the one door. Re-aimed onto the one home:
`roadh_missiles` H1c, `thunderlock` FIELD-GUN17a, and three of
`fieldgun17.json`'s records (one of them the dungeon seam's own).

**F3 (PAID, as far as it can be): the MW1-MW3 mutant campaigns are not
in the tree.** The record claims "9 pins, 29 mutants, 29 killed" and "60
mutants over the two slices, 60 killed", and `tools/mutants/` carries
none of them - so `mutantdrift` holds nothing, and a survivor could
return with no gate to say so. The original lists are gone; this audit's
campaign (`tools/mutants/fieldgunmwaudit.json`, 17 mutants, 17 dead)
covers F1 and F2 in full and MW2/MW3's four load-bearing laws - the own
arm, the borrowed type, the bone, the un-borrowed bolt - against
`fieldgunmw.test.js`. The bake chain's 29 remain uncommitted and are
recorded here as such.

**Ruled sound by reading.** Third person shares `resolveWeaponParts`
with first, so the gun hangs on the body's `Weapon Bone` and the body
plays the crossbow groups (`t.weapon`, `tResolved.mwType`). Sheathed, the
bare gun rides the sheathing mod's own bare-weapon fallback on `Bip01
MarksmanCrossbow` (no `thunderlock_sh.nif`, and `holsters(crossbow)` is
true); it takes no quiver, since it borrows no bolt. The muzzle LIGHT
(`thunderlockMuzzleLight`, `_thunderlockFlash` on the entity) is
lane-agnostic and, with FP lighting on, the viewmodel light reads it
too - so the arm and the gun mesh are lit by the flash; only the
sprite's tinted flash frame has no mesh counterpart, and the light does
its work. `borrowsAmmo: false` holds through the third-person resolve
(`arrowInfo` null, no arrow part).

**Not closable here, and said plainly.** (1) The gun's ORIENTATION on
`Weapon Bone` - the bake put the barrel along the piece's +Y and the
grip at the origin, and no `BoneOffset` nudges it - was chosen against a
rendered preview, never against the bone; MW1 and MW3 both say so. Eyes
on a build decide whether it reads as held and pointing forward. If it
does not, the fix is a `BoneOffset` node in the bake, not a change to
the attach. (2) The crossbow animation's timing against the gun's
1.7 s reload is the same eyes' question.

**Pins** (`test/fieldgunmwaudit.test.js`, 6): the hold and the voice
under the arm (held at the click, released with the bang and the flash
on the same frame, once), the classic lane untouched and third person
held like first, the never-swallowed ceiling, the muzzle door in both
views and never the sprite's record, the muzzle vertex and the two
frames (a point ahead lands on `forward`, up on `up`; the body's model
carries the metre and the basis), and by source the gate, the order,
the third-person frame, the flight's world origin and the hosts' one
door (generative). Re-aimed: `thunderlock.test.js` F8's voice call.

