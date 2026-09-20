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
client (`exteriorFoes.js:1776`, `dungeonContext.js:3471`, both gated on
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
