# FIELD BUGS 2026-10-25 - "Regens Health: In Darkness" never heals

One report, handed over by the owner as its title alone: "Regens Health: In Darkness" enchantment never activates. Read on
main's `80eafd01ff`, against Daggerfall Unity's C# (`RegensHealth.cs`, `PlayerEnterExit.cs`). The pins are
`test/scenes/fb1025_regendark.test.js`, the mutants `tools/mutants/fb1025_regendark.json`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Regens Health: In Darkness" enchantment never activates | The shared enchant ctx mounted the sunlight and holy-place flags but never the darkness flag, so the darkness arm read an absent seam and stayed off in every host | Fixed: the ctx mounts `inDarkness`, DFU's complement of the sunlight flag |

## REGEN-DARK (1) - `src/scenes/hostEnchant.js`, `src/systems/passiveSpecials.js`

FOUND. RegensHealth's MagicRound arm (`systems/enchantments.js`, `[T.RegensHealth`) regenerates on param 2 only when
`ctx?.inDarkness?.()` answers true. Every host (world, exterior, the standalone `?dungeon` route) mounts its ctx from
the one body, `createEnchantCtx` in `scenes/hostEnchant.js`, and that body carried `inSunlight` and `inHolyPlace` but
no `inDarkness`. An absent seam idles its arm (the headless charter), so the item never healed anywhere. The sunlight
and all-the-time params of the same enchantment worked.

WHY NOTHING STOPPED IT. V2c (2026-08-27) answered the E1 conditional flags off the passiveSpecials host seam and
recorded RegensHealth's conditional arms as live (`06-Systems/Systems-Arc.md`, "THE E1 RESIDUE TRIPLE";
`Port-Ledger.md`'s ENCHANTING row; `Port-Completion-Analysis.md` struck `InDarkness` with the other two). Only two of
the three flags were mounted. The pump's pin (`test/systems/enchantments.test.js`, "E1 pump") hands in its own ctx
for the sunlight param and never tests the darkness param or the mounted ctx.

THE LAW, verbatim. `RegensHealth.cs:97-98` reads `PlayerEnterExit.IsPlayerInDarkness`, which DFU defines as "Same as
!IsPlayerInSunlight": night, any interior, or prison. `systems/passiveSpecials.js` now exports `playerInDarkness`
beside `playerInSunlight`, and `createEnchantCtx` mounts it as `inDarkness`. This is not the career's
RegenerateHealth rule (`passiveSpecialsMagicRound`, `!day || dungeon`), which is `PassiveSpecialsEffect`'s own and
counts a building by day as lit. No departure from DFU.

A ctx built with no passive host registered reads minute 0 (night), so `inDarkness()` answers true there, as
`inSunlight()` already answers false. Only tests build a ctx that way.

PINS. `fb1025_regendark.test.js` (2): the mounted ctx's `inDarkness` against the real passiveSpecials seam (night
outdoors, day outdoors, day indoors, day in prison), and a worn RegensHealth(InDarkness) through the mounted ctx and
the real magic-round pump: +2 over eight rounds at night and indoors by day, nothing outdoors by day. Both fail on
main before the fix. MUTANTS: `tools/mutants/fb1025_regendark.json` (3).

NOT SEEN IN GAME. Checked through the real mount and the real pump, not on a running install.
