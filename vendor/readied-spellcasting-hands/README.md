# Readied Spellcasting Hands 1.3 - jefetienne (ported 1:1, its source vendored)

**Readied Spellcasting Hands 1.3** for Daggerfall Unity 0.11.4, by **jefetienne**
(Nexus mod 91; the manifest's ContactInfo is
`forums.dfworkshop.net/memberlist.php?mode=viewprofile&u=2186`). The mod's own
description: "Displays hands when ready for spellcasting". Its GUID is
`09eff704-86dc-45ce-a3a9-642e0ce7bb9a`. The same author's World Tooltips is
vendored beside it (`vendor/world-tooltips/`).

Mac (Lattymoy) handed the shipped zip
(`Readied_Spellcasting_Hands_-_Windows_1.3-91-1-3-1655327405`, sha256
`5471e6d6...2018`) over on 2026-10-11: "can we implement this mod into the
source".

**Licence.** MIT, "Copyright (c) 2009-2018 jefetienne", shipped as
`LICENSE-readied-spellcasting-hands` in the zip beside a second MIT notice for
Daggerfall Workshop (the mod's class is DFU's own `FPSSpellCasting`, modified).
Kept verbatim as `LICENSE` here. The port's implementation is written FROM the
source below and cites it by member, exactly as the other ported mods in this
tree do.

## What is here

- `Scripts/Modded_FPSSpellCasting_Ready.cs` - the mod's whole implementation,
  DFU's `FPSSpellCasting` copied and changed. **This is the author's own
  source, shipped inside the bundle** as a Unity TextAsset, not a decompile.
- `Scripts/ModLoader.cs` - the bundle's loader: at the game state it adds the
  component above to the player object.
- `readiedSpellCastHand.dfmod.json` - the bundle's manifest, verbatim.
- `LICENSE` - the zip's licence file, verbatim.

`tools/readiedHandsAssets.mjs` reproduces the three script and manifest files
from `readied spellcasting hands.dfmod` (sha256 `82f413ef...459c`) through the
port's own `src/formats/unity/unityBundle.js`, byte for byte; the licence is the
zip's own text file. There are no textures, sounds or settings: the hands are
Daggerfall's own casting art (`FIRE00C6.CIF` and its four siblings) from the
player's ARENA2, and the mod ships no `modsettings.json`.

## What the mod does

Its whole change is `AnimateSpellCast`, the coroutine DFU's `FPSSpellCasting`
steps its cast with. Every `animSpeed` (0.04 s) it asks one thing: **is a spell
readied** (`PlayerEffectManager.HasReadySpell`), **is it not a self-only one**
(`ReadySpell.Settings.TargetType != TargetTypes.CasterOnly` - those cast the
moment they are readied, so there is nothing to hold), and **is the real cast
not playing** (`!PlayerSpellCasting.IsPlayingAnim`)? While all three hold, it
shows **frame 0** of that spell's element's casting animation - the same
archive the cast itself plays, both hands, the right one mirrored, at the
cast's own layout (`UpdateSpellCast`, `AlignLeftHand`, `AlignRightHand`, the
small-frame inset of 0.134 for frame 0). The moment the cast starts the real
animation takes the screen, from that same frame; the moment the spell is put
away the hands go.

So a readied spell is a pair of hands raised and waiting, where DFU shows an
empty screen (the weapon hides while a spell is readied) until the click.

## The port's reading, recorded

See `src/combat/fpsSpellCasting.js` (`readiedHandsFrame`) and the RSH1 note in
`src/combat/weapon/weaponRig.js`. In outline:

- **The same art, the same draw.** The port's `FPSSpellCasting` is already DFU's
  own, line for line; the mod's copy of `SetCurrentAnims`, `UpdateSpellCast`
  and the two aligns is identical to it, so the readied hands are the port's
  `drawSpellCastHands` at frame 0 - one draw, never a second copy of it.
- **The classic lane only.** The mod draws DFU's sprite hands. Under the port's
  Morrowind arms a readied spell is already a stance of the arm itself
  (MW-D39), and the Eye of the Beholder's third person hides the hands as it
  hides the cast - both gates stand for the readied hands as they do for the
  cast.
- **The mod's `ElementTypes.None` arm** loads `GetMagicAnimFilename(None)`,
  which throws in DFU; the port's `magicAnimFilename` answers null there and
  nothing draws, as for the cast.
- **A switch.** The port has no mod list, so the mod is one switch, on by
  default (MO1): Features -> Combat -> Readied Spellcasting Hands by jefetienne.
