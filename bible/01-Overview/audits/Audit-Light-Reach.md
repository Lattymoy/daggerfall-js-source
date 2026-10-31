# AUDIT LIGHT-REACH - the street's lamps and windows read cold, 2026-10-30

The owner, of LIGHT-REACH (`07-Rendering/Enhanced-Lighting-Arc.md` LIGHT-REACH, pull request #1456), the day after it
was written: *"Audit"*. Five cold lanes read the change at `d19e9f1a7` against its base `b793e26e1`, in a frozen
worktree. Each lane was given the owner's asks and its files, never a conclusion, and had to reproduce every finding on
the real code before reporting it. The fixes went into the branch while the lanes read the snapshot.

| Lane | Read | Found |
|---|---|---|
| A | the cluster grid: the box and slice builds, their passes, the upload and the shader's read | A1, A2 |
| W | the window tiers: the boxes, the far rows, their block, the hand-over, the pass's cost | W1-W5, W7 |
| S | the lanterns: where the reach applies, the classic set, the flicker, the back-face skip, the cost, DFU's value | S1-S5 |
| G | the running game over ARENA2: the two trees side by side, the hand-over walked, the classic set, a province, by day | (reporting) |
| R | the pins, the mutants, the record, the pull request's text and the rules | R1-R10 |

The audit found one more while fixing W1 and W2 (W6), and `main` had moved 94 commits; it was merged in first.

In the tables below, an ID under *Pinned by* names that finding's test in `test/render/audit_lightreach.test.js`.

## Decided here

| The question | The call | Why |
|---|---|---|
| **The harbour's lamps** (S5): the quays' lanterns, the shipyard's office lantern and the lighthouse's lamp kept their reach while the street's grew. | The same share on the lane (`streetLightReach`), the classic set unchanged. | They burn beside the street's in its hours and colour; at their old reach a quay lantern fell from 0.78 to 0.52 of its neighbour. |
| **The back-face skip** (S2, S3, R3) changes pixels. | Kept, and recorded as a fix. | It closes a leak: a lamp behind a wall glinted on the wall's face for an eye grazing it. |

## Fixed - the window tiers (W)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| W1 = R6 | MED | **A tile trimmed by an overflowing near list lost up to 74% of its light**, every other frame (a 30 Hz beat): the far rows read the cut from before the trim. | The trim comes first: the cut moves to the first light left out that frame, the kept lights are faded to it, and the far rows read it. An overflowed cut holds for a second (`WL_FIT_HOLD_MS`). | W1, W2, W6 |
| W2 | LOW | **Each cap popped at its edge**: an eased cut lagged past the first tile its block left out, which lost its share whole. | Each cut stands at the first tile its block leaves out, near and far. | W1, W2, W6 |
| W6 | MED | **Beside a long wall the far list overflowed and the far cut fell to 12 m** (found fixing W1): a row's box held its whole run, the near tier's tiles too. | A row's box this frame covers only the lit tiles it weighs (`rowBox`). The far cut held at 67 m and above. | W1, W2, W6; W6 |
| W3 | LOW | **A curtained room's lamp jumped sideways at the hand-over**: the near tier hung it behind the gap, the row behind the whole glass. | Behind the whole glass in both tiers: a curtain hides the lamp, it does not move it. | W3, R1 |
| W4 | LOW | A mask only the far rows read took its mips a frame late. | The mips after the far rows' uploads. | W4 |
| W5 | LOW | **The pass's CPU and garbage**: 0.60 ms and 370 KB a frame against the base's 0.38 ms and 160 KB. | The boxes built with no closure or literal, the rows sorted on typed keys, `Math.hypot` out of the gather's paths: 0.44 ms and 118 KB. | A1, W5 |
| W7 | LOW | `release()` kept the free layers, so two masks could share a layer after it (latent: nothing calls it). | The free list and the holders go with the layers. | W7 |

Notes, no defect: the GLSL row walk against its twin (now `tools/winRowTwin.mjs`); std140 packing and float32 states; a
shift of the origin; every box conservative; both blocks bound in all 21 lit programs, under 16 KB. A row has no glow, so
past the near cut the 1 m strip under an upper window loses the glow (by design).

## Fixed - the cluster grid (A)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| A1 | LOW | **Garbage tripled**: 10.3 to 32.8 KB a frame - a light's floats handed across calls V8 does not inline, and two closures a build. | Floats through the space's arrays, no callback: 0.0 bytes a light. | A1, W5 |
| A2 | LOW | The lanterns' build took about 50 us more a frame. | A slice-bounds table, not two `Math.exp` a slice. Stopping the count at overflow was declined: `need` sizes the window band's next try. | - |

Notes, no defect: no lit fragment missing from its cell over 32 million, on either tree; the two passes always agree;
the list's capacity and the byte index hold.

## Fixed - the lanterns (S)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| S1 | MED | **A yard's candle reached 7.5 on the lane**, half again its room's 5: its share was taken of the prefab's 18, not the animator's 27. | Its share of the animator's own start (`streetLightRange`). | `yardlight.test.js` AUDIT LIGHT-REACH S1 |
| S2, S3 = R3 | LOW | **The back-face skip changes pixels**: the record said N.H is at most 0.71 there; at a grazing eye it is near 1. The IIL classic-shadows lane takes it too. | Recorded as a fix; LR8 pins the leak's size. | `lightreach.test.js` LR8 |
| S4 | MED | The longer reach's shadow cost was not priced: each lantern's map to 28 m, not 20. | The probe reads the shadow faces; measured below. | - |
| S5 | LOW | The harbour's lamps kept their reach. | Decided above. | S5 |

Notes, no defect: the classic set is DFU's 18 and Animate to the value; the flicker is the same share; the same
lanterns cast shadows at either reach; DFU's `DaggerfallLight [City].prefab` is range 18 with Animate.

## Fixed - the pins and the record (R)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| R1 | HIGH | The far tier could stop at 72 m, vanish away from town or go stale after a shift with every pin green. | Pinned: its reach, its life alone, a shift, its lit rows, its numbers, a front covered in part, the last slice. |
| R2 | HIGH | Eight GLSL mutants of the row walk survived. | Its whole text pinned (R2), proven by `tools/winRowTwin.mjs`, which fails on a broken walk. |
| R4 | MED | The patch note's 160 m is not what a busy street shows, and its frame rate was SwiftShader's. | The notes say 110 to 125 m and claim no frame rate. |
| R5 | LOW | "A twentieth" mixed suns in; "equal" left out the glow. | A lamp's eighth; qualified. |
| R7, R8 | LOW | The probe stood in Daggerfall alone, judged nothing and slept. | `--region` and `--loc`; it judges each view lit; it waits on frames. |
| R9 | LOW | Two comment blocks over eight lines. | Cut. |
| R10 | LOW | The ledger row lacked its approval cell; the record's pins left out EL2 and EL5. | Both added. |

## Measured after

Pending: the probe's A/B of the fixed tree against `main`, with the lanterns' shadow faces (S4), on a quiet machine
once the lanes' own runs are done.

## The record

Every fix is pinned by a test that fails on the code as it stood, with a mutant in `tools/mutants/lightreach.json`.
Records the fixes moved were re-aimed by content: `audityardlight.json`, `lightreach.json`, `wl1.json`,
`yardlight.json`.
