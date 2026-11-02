// WeaponBasics' Alignment, and nothing else.
//
// FPSWeapon.cs's three alignments (AlignLeft / AlignCenter /
// AlignRight) decide where a weapon image sits on the 320x200 surface,
// and four readers want them: fpsWeapon.js (which re-exports this, so
// its surface is unchanged and it is still the enum's front door),
// weaponWidget.js, shieldWidget.js and the gun lab.
//
// WW-LAB (2026-09-19): it is a LEAF because of that last one. An enum
// of three integers had been living in a module that reaches the CIF
// reader, the inventory, the dye tables and - through nativePanel's
// HUD - the Morrowind arms and a vendored mod's mesh folder, so
// importing three integers cost the gun lab's standalone build four
// megabytes of .nif it never loads. Nothing here imports anything.
export const ALIGN = Object.freeze({ Left: 0, Center: 1, Right: 2 });
