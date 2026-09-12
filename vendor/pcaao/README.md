# Physical Combat And Armor Overhaul 1.44 - Kirk.O (ported 1:1)

The files beside this note are the data of **Physical Combat And Armor
Overhaul v1.44** for Daggerfall Unity 1.1.1, by **Kirk.O**
(kirkoliveri@gmail.com - the manifest's ContactInfo; Nexus mod
"Physical Combat and Armor Overhaul"; source at
github.com/magicono43/DFU-Mod_Physical-Combat-And-Armor-Overhaul).
The mod's own description: "Armor Reduces Damage Taken Instead of
Reducing Chances of Being Hit, Also Much More."

**Permission:** Mac (Lattymoy) handed the shipped `.dfmod` over on
2026-09-12 to integrate 1:1. The repository states no licence.

> [Mac: paste the text of Kirk.O's permission, or the link to it, here.]

## What is here

- `physicalcombatandarmoroverhaul.dfmod.json` - the shipped bundle's
  manifest (title, version 1.44, author, contact, DFUnity 1.1.1, GUID,
  the three files it was built from, its three dependencies: Roleplay
  Realism and Meaner Monsters optional, "vanilla combat event handler"
  required).
- `modsettings.json` - its one settings section, `Modules`, the seven
  ToggleKeys as shipped, which `src/systems/modSettings.js` restates
  under the vendor key `pcaao` (plus the port's `Enabled`,
  `rolePlayRealismArchery` and `meanerMonsters`).

## What is NOT here, and where it went

The mod's code. The shipped bundle carries a compiled
`PhysicalCombatAndArmorOverhaul.dll` (45,056 bytes) and no source; the
repository's last single-file source is **v1.40** (commit `6e19023`,
"Changing access modifier for many methods", 2021-08-04) and its
master is the v2.0 rewrite in progress. The port's law is the shipped
1.44, decompiled (ILSpy 8.2.0.7535), with the v1.40 source naming what
the decompiler numbered. Neither the DLL nor the decompiled text is
carried here; the port is `src/combat/pcaao.js` (every formula, cited
by the C# method it restates) and `src/combat/pcaaoMeanerMonsters.js`
(InitMod's Meaner Monsters table). The page is
`bible/05-Combat/Physical-Combat-Overhaul.md`.

The "Vanilla Combat Event Handler" dependency (GUID
fb086c76-38e7-4d83-91dc-f29e6f1bb17e) is a hook mod: PCAAO mirrors its
two events (OnAttackDamageCalculated, OnSavingThrow) to relay to OTHER
mods. Nothing here consumes them; not carried.
