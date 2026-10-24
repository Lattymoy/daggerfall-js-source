# Readied Spellcasting Hands - the mod, 1:1 (RSH1, 2026-10-11)

Mac: *"can we implement this mod into the source"* - handing over
`Readied_Spellcasting_Hands_-_Windows_1.3-91-1-3-1655327405.zip`.

**Readied Spellcasting Hands 1.3** for Daggerfall Unity 0.11.4, by
**jefetienne** (Nexus mod 91; the author of World Tooltips, WORLD-HOVER).
Its own description: "Displays hands when ready for spellcasting".

Its source is vendored under `vendor/readied-spellcasting-hands/` (the two
C# files and the manifest, which the bundle carries as TextAssets, and the
zip's MIT licence; `tools/readiedHandsAssets.mjs` reproduces them through
`src/formats/unity/unityBundle.js`), it is credited on the About screen, and it is
one switch: Features -> Combat -> Readied Spellcasting Hands by jefetienne,
on by default (MO1).

## What DFU shows, and what the mod changes

A readied spell hides the weapon (`WeaponManager`'s `HasReadySpell` leg -
the port's `shown()` in `src/combat/weapon/weaponRig.js`), and nothing takes its
place: the screen is empty until the click starts the cast's hands.

The mod is DFU's `FPSSpellCasting`, copied whole as
`Modded_FPSSpellCasting_Ready` and added to the player by its `ModLoader`.
Every member but one is DFU's own, unchanged: `SetCurrentAnims` (the
element's `*00C6.CIF`), `UpdateSpellCast`, `AlignLeftHand`,
`AlignRightHand`, the small-frame inset (0.134 for frame 0) and the two
draws, the right hand mirrored. The one change is `AnimateSpellCast`, which
no longer plays a cast. Every 0.04 s it shows frame 0 of the readied
spell's element while

    pef.HasReadySpell && pef.ReadySpell.Settings.TargetType != TargetTypes.CasterOnly && !psc.IsPlayingAnim

and nothing otherwise. A self-only spell casts the moment it is readied,
so it raises nothing; the real cast takes the screen from the same frame
the readied hands hold.

## The port

- `src/combat/fpsSpellCasting.js` `readiedHandsFrame(spell, castPlaying)` -
  the coroutine's condition as one pure answer: frame 0, or -1. CasterOnly
  is the spell record's `rangeType` 0; an element with no archive (DFU's
  `ElementTypes.None`, which `GetMagicAnimFilename` throws on) draws
  nothing, as for the cast.
- `src/combat/weapon/weaponRig.js` - the draw, at the cast hands' own site, through
  the same `drawSpellCastHands` at that frame: the same art cache, the same
  layout, the same large-HUD offset, the same first-person light (MAC-I).
  The rig takes the readied record as `readiedSpell()`, which each host
  passes from its engine's `readied()` (`src/scenes/hostMagic.js`).
- The lanes: the classic sprite lane only. The Morrowind arms hold their own
  spell stance (MW-D39); the Eye of the Beholder's third person hides the
  readied hands as it hides the cast's (`eotbHidesSpellHands`).
- Online: the player's own (`ONLINE_PLAYERS_OWN_MODS`) - hands on one's own
  screen; the cast and its wire are unchanged.

The mod's copied class carries one difference from DFU's that the port does
not take: its `OnGUI` returns while `GameManager.IsGamePaused`, which the
port's frame already does (no rig draws under a window).

## SPELL-CLIMB (FIELD BUGS 2026-10-22c): the hands on the wall come first

Panthyon, on #bug-reports: *"When you hold a spell and dont drop it, climbing
will then manifest a second set of arms"*. The mod reads no climb - DFU's climb
screen is empty, so nothing stood beside its hands - but the enhanced climb
puts two fists on the stone (CLIMB-HANDS, `03-World/Parkour-Arc.md`), and both
pairs stood at once. A departure from the mod's `AnimateSpellCast`: the readied
hands also wait on `!climbHands.showing()` - they stand down while the fists
show and come back once those are off the screen. The spell stays readied, and
a click on the wall casts it; while that cast plays its hands take the screen
and the fists come back up onto the stone after it. DFU's own climb draws no
fists, so there the readied hands stand as the mod has them. Record:
`01-Overview/bugs/Field-Bugs-2026-10-22c.md`.

## SPELL-HAND (2026-10-23): one readied hand beside a weapon

With a one-handed weapon drawn in the hand that fights and nothing in the other,
a readied spell no longer hides the weapon: it takes the free hand alone
(`05-Combat/Two-Hands.md`, "The spell hand"). The mod's frame 0 is the same
frame, read by the same condition (`readiedHandsFrame`), drawn through the same
layout - ONE of the two hands it raises, on the side the weapon is not
(`combat/twoHands/spellHand.js` `drawSpellHand`), lowered while the weapon
beside it swings. Everywhere the hands cannot hold the spell beside the weapon
(both hands taken, a two-hander, nothing drawn), the mod's two hands stand as
above.
