# Field bugs 2026-10-21: BOW-HOLD - a bow held past eight seconds never took its -20

GitHub issue #1098 (GrimmLiddell, 2026-10-21), read from the source and not played: "Bow accuracy penalty for draws
longer than 8 seconds is unreachable". Checked against the vendored C# (`vendor/roleplay-realism/Scripts/RoleplayRealism.cs`,
AdjustWeaponHitChanceMod :529-553 and AdjustWeaponAttackDamage :555-578). It holds, and it is the mod's bug, carried 1:1 -
RR1 read it at the port and recorded it as the shape of the C#.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | #1098: a draw past 8 s takes -10, never the -20 | The hit ladder's last two arms are `else if (t > 5000) -10; else if (t > 8000) -20` - a chain whose second arm nothing reaches, since every t past 8000 is past 5000 first. The damage ladder beside it steps upward and reaches every tier (0.85, 0.75, 0.5, 0.25 past 9 s), and the mod's own page names -20 past 8 s | fixed (BOW-HOLD) - a departure from the mod, Ledger A; awaiting Mac's approval |

## BOW-HOLD: the arms in the order that reaches both

`src/systems/roleplayRealism/rrRealism.js` (`rrAdjustWeaponHitChanceMod`). The `> 8000` arm stands ahead of the
`> 5000` arm (systems/roleplayRealism/rrRealism.js:"else if (weaponAnimTime > 8000) adjusted -= 20;"); the four arms
above them, the bow test and the no-draw answer are as the C# writes them. The ladder now: under 200 ms -40, under 500
-10, under 1000 as it is, under 2000 +10, 2000..5000 as it is, past 5000 -10, past 8000 -20.

Why a departure and not a transcription fix: the C# really is written this way, and the port restated it faithfully.
What makes the -20 the author's intent rather than dead code he meant: the damage ladder in the next method is the
same five thresholds in ascending order and every one of them fires, and the mod's description promises the -20.
A mistake in an else-if chain's order is the kind of departure SCOPE1 names - DFU (here, the mod) the reference, the
difference said out loud, approved by the owner.

**Pinned.** `test/systems/rr1_realism.test.js` (the 9 s cell re-aimed from -10 to -20; exactly 8000 still -10; 8001
-20); `test/systems/pcaao.test.js`'s six-cell ladder re-aimed (9000: 30, not 40). `tools/mutants/bow_hold.json` +3
(the chain's order back; the 8 s line moved to >=; the long hold softened to -10), 3/3 dead.

**Verified.** The two test files, the mutants, lint, types and the bible's gates, here. Not played: the number is a
cell of a ladder; the reporter's own report is from the source too. A player with advancedArchery on can feel it
from the chair: a bow held past eight seconds misses more than one loosed at six.
