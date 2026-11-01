# Handheld Torches

A port of the DFU mod **Handheld Torches** 1.4.1 by RedRoryOTheGlen: a lit torch, candle or lantern
occupies a hand, so drawing a weapon with no free hand puts it out. The player sees a first-person hand holding the lit
torch or lantern, can light, douse, drop and throw lights with keys, and can set foes alight with a thrown torch. A lit
lantern hangs at the waist by default. The law is the mod's IL, read method by method (the DLL carries no source);
the pictures are our own, and the release's record is in `01-Overview/Own-Work.md`.

## How it works

**The component** (`src/systems/handheldTorches.js` `createHandheldTorches`). The weapon rig
(`src/combat/weapon/weaponRig.js`) owns one per host and drives `update`, `lateUpdate` and `draw` in the mod's order.
The held light is `PlayerEntity.LightSource`, written through one door (`src/systems/lightSource.js`
`setLightSource`), so the burning loop follows it.

**The hand law** (`updateFreeHand`). Each frame both hands start free. The left slot is taken by anything in it; a
two-handed item or a bow in the left slot takes the right hand too; an empty left hand being punched with is in use. A
two-hander in the right slot takes the off hand (always, unless `RelaxedTwoHandedWeapons`). Stow When Spellcasting,
Climbing or Swimming, and a transformed lycanthrope, take both. With no free hand a lit torch or candle is stowed
(remembered, or dropped), and a lit lantern is stowed with "You can't hold a light source right now" unless relaxed or
at the waist. A freed hand relights the remembered light. The law also runs at the equip moment, so an inventory
window shows the change at once.

**The keys** (the mod's own key store, parsed as Unity `KeyCode` names by `src/systems/keyCodes.js`):
- **Ignite / douse** (`Handling.ToggleLightInput`, default **O**): douse a lit light; else bring back the stowed one;
  else light a lantern, torch, candle or holy candle from the pack.
- **Drop** (`Handling.ManualDropInput`, default **G**): drop the lit light (never a lantern) or one from the pack, as a
  world light that burns `condition x 20` seconds.
- **Throw** (`Throwing.ThrowTorchInput`, default **X**): hold to wind up and show the arc, release to throw a torch.

**The sprite.** TEXTURE.112359: the torch hand (four frames) and the lantern (four), placed for guard, attack and
sheathe, moving between them; a candle has no sprite. Ambidexterity puts it in the free hand and moves the player
torch's light with it. Bob follows Weapon Widget's law; Inertia and Step are off as the mod ships them. With
`Presentation.Tint` on, the hand takes the room's light as the weapon does; off, its own colours.

**The pictures** (`src/systems/handheldTorchesArt.js`) are recipes for our painter: the hand with a torch (90 x 205)
and with a lantern (110 x 138), the torch on the floor (31 x 34) and doused, four frames each, played at the mod's
`ANIMATION_TIME`. A lit floor frame's `_Emission` twin is the frame. The doused candle and holy candle are our rule
over the player's lit candle (`dousedCandle`). The twenty lit candle frames are Daggerfall's TEXTURE.210 records 3
and 4, built from specs (`src/systems/handheldTorchesDerived.json`). Nothing is fetched.

**The throw's arc** (`Throwing.ShowTrajectory`). While a throw winds up, the flight's own arc (`throwArcPoints`,
without the throw's random spread) is drawn as dots through the last frame's camera, the landing marked larger
(`src/systems/torchArc.js`), in either lane and view.

**Dropped lights, the thrown torch, burning foes** (`src/scenes/droppedTorches.js` `createDroppedTorches`). Each host
owns one pool: billboards of TEXTURE.112358 with a point light whose range falls with the time left, a burning loop for
a torch, doused under a dungeon's water. Grab or Steal picks one up; Info or Talk names it. The burn reads the world
clock (seconds over twelve), so rests and waits age it and loads re-latch it. A thrown torch flies on Unity's 0.02 s
step, bounces off walls and lands as a dropped light when slow. A foe struck is made hostile and, with `Combustion`, on
a hit DFU's Continuous Damage-Health plus a light and a flame billboard for its duration. The pool is destroyed on every
transition and saved with the host.

**A burning foe's light.** With `Throwing.EmissionShadows` off, as the mod ships it, the light is shadowless: the
composer marks it in the carried mask (`src/render/lightId.js` `CARRIED_SHADOWLESS`), so it casts no shadow map and no
contact march, its glare kept.

**The lantern at the waist** (`Handling.LanternsAtWaist`, on by default). A lit lantern hangs at the right hip instead
of in a hand (`src/systems/playerTorch.js` `lanternAtWaist`, `LANTERN_HIP`): the hand law passes it by, the ignite key
with no hand free reaches it, a throw leaves it lit, and no hand frames draw it. It swings on two damped pendulums from
the hip's motion (`src/systems/lanternSwing.js`), and draws at `HIP_LANTERN_HEIGHT` (0.3 m) on Eye of the Beholder's
sprites and on the Morrowind body (a LIGH lantern hung at the pelvis on the third-person rig).

**Under the Morrowind view** the hand law, keys, drops and throws run unchanged; the modelled arm holds the LIGH
record's torch mesh, and no classic hand is drawn beside it.

**The held light in the pack.** A lit light shows as a row on the body under the off hand (`LIGHT_SLOT`, a sentinel,
never an index into the equip table); picking it offers Douse. Dragging a light onto the body lights it.

## Rules

- Integrated 1:1 from the mod's own law (Mac); departures below are named and pinned.
- All mods on by default (Mac): `Modules.Sprite` on, and `Enhancements/PlayerTorchFromItems` `True` through
  `src/systems/settings/settings.js` `PORT_DEFAULTS`, laid over the generated defaults.
- The lantern can hang at the waist, seen on the body and animated with movement, on by default (Mac).
- The held torch bobs with the weapon (Mac).
- A mod's default key may not land on a key the port already spends; `test/systems/ht1_handheldtorches.test.js` holds
  every mod's key defaults against DFU's bindings and the port's.
- The three keys and the relaxed switches are drawn on the mod's tile (`MOD_CURATED`), so they can be rebound.
- Online it is the player's own mod.

## Daggerfall Unity

The mod reads DFU's `PlayerEntity.LightSource`, `WeaponManager.Sheathed` and `UsingRightHand`,
`FormulaHelper.CalculateSuccessfulHit` and `EntityEffectBroker`. Departures from the mod:
1. The toggle key ships **O**, not F: the port spends F on its social action. A stored "F" is cleared once on load
   (`src/systems/modSettings.js` `KEY_MIGRATIONS`).
2. The drop key ships **G**, not Tab: the port spends Tab on the pixel dial.
3. `RelaxedTwoHandedWeapons` ships off (the mod: on): a held two-hander takes both hands, so the classic sprites never
   show three arms.
4. `LanternsAtWaist` is the port's own key on the mod's pane.
5. The dropped torch's light has no intensity flicker (the port's point lights have range only) and casts no shadow.
6. Cross-mod seams (Vanilla Combat Event Handler, Bloodfall, Custom Tooltips) are not carried. First-Person Lighting's
   tint is ours: `Presentation.Tint`.
7. The pictures are ours, and the arc is drawn as dots (the mod's `LineRenderer` has no twin here).
8. Kept quirks: a frame of lag on the cast, climb and swim flags; the throw press douses the lit light first; the fire
   takes on every hit that lands, since Continuous Damage-Health never rolls the mod's chance.

## Code and tests

- `src/systems/handheldTorches.js` - the component: hand law, keys, sprite, settings
- `src/systems/handheldTorchesArt.js` - our pictures; `src/systems/torchArc.js` - the arc
- `src/scenes/droppedTorches.js` - dropped and thrown lights, burning foes
- `src/systems/playerTorch.js`, `src/systems/lanternSwing.js` - the light's offset, the lantern at the waist and its
  swing
- `test/systems/ht1_handheldtorches.test.js` - the mod's law, the defaults and the key gate; the 52 settings as
  literals
- `test/systems/ownaudit_ht_keys.test.js` - the arc, the shadowless light, the tint
- `test/systems/nobethesda2_torchesicons.test.js`, `test/systems/ownwork4_pictures.test.js` - the pictures
- `test/systems/audit66_handheldtorches.test.js` - the audit's fixes
- `test/systems/ht2_packlight.test.js`, `test/systems/ht6_offhand.test.js` - lighting from the pack, the equip moment
- `test/systems/discord5.test.js` - two-hand compares, the relaxed default, rebindable keys
- `test/systems/htwaist_setting.test.js`, `test/systems/htwaist_handlaw.test.js`, `test/systems/htwaist_swing.test.js`,
  `test/systems/htwaist_eotb.test.js` - the lantern at the waist

## Open

- The waist lantern's size on retail Morrowind data is not measured here (no Morrowind in the container).
