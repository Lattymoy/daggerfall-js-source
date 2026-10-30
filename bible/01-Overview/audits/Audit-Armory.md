# AUDIT ARMORY (2026-10-28) - the Aura Armory, audited

The owner, of ARMORY (`04-Characters/Aura-Armory.md`; branch `ccr-0cc192da-6z4jft`): **"Can we audit this, ensure the
morrowind model is included and show me all the current developed sets"**. This page is the findings, each with its
verdict. What the audit changed is written into the record as it now stands.

## How it was run

The author's own pass, not cold lanes on a frozen snapshot: the whole suite on the merged branch, then each piece drawn
in Chromium on three bodies (`tools/armoryProbe.mjs`) and read as a picture, then the Morrowind lane traced from the
host to the bone reader. Every finding was reproduced before it was fixed, and every fix is pinned and mutated
(`tools/mutants/armory.json`).

**The Morrowind body.** Its mesh is Bethesda's and never ships (`04-Characters/Townsfolk-Outfits.md`), so the proof
stands on what does: retail's own skeleton (`test/fixtures/mw/retailRig.mjs`), read by the game's own bone reader
(`src/combat/fpArm.js` armBonesInBody, what thirdBones and a peer's bonesOf answer). All sixteen bones the pose reads
stand on it, and the probe draws both sets on a mannequin over those bones.

## Findings

| ID | Severity | Finding | Verdict |
|---|---|---|---|
| A1 | HIGH | A peer in a Morrowind body wore its pieces on the rest pose: `peerBodies.bonesOf` answers `{ feet, yaw, bones }`, and the host handed that wrapper to the pose as if it were the bones. | FIXED: the host reads `.bones` and stands the wearer at the body's own feet and facing, as the cape does. Pinned on retail's skeleton. |
| A2 | HIGH | Twelve `smoothstep` calls in `src/render/armoryPass.js` ran their edges backwards, which GLSL leaves undefined. Two had expression edges the port's scan (SD20c) cannot read. | FIXED: each is `1.0 - smoothstep(lo, hi, x)`. |
| A3 | MEDIUM | The Eternal Sigil's back ring stood inside the torso on every rig - the stand-in and a Morrowind body - so it never showed. | FIXED: a rig's back ring stands 0.27 m behind the chest's face. Pinned in node and on the GPU. |
| A4 | MEDIUM | The shop's stage for a weapon piece showed a bare figure: the body pass draws no weapon piece. | FIXED: the weapon's own stage, a pixel longsword outlined by the classic hand's shaders (`src/render/weaponPiecePreview.js`). |
| A5 | LOW | The Eternal Greaves burned white at the ankle: their heat reached the ramp's white core, and a tube's near and far sides add. | FIXED: their heat stops short of the core, their gain lower. |
| A6 | LOW | A piece bought was named in the service's English when it landed ("... is on your account"). | FIXED: the client's own name, in the player's language. |
| A7 | LOW | A claim pin held the armory roll to a miss; the service's die finds one in twelve, so it failed one run in twelve. | GONE: the owner then moved the Dagonfire line to the Sigil Broker, so no claim rolls a piece and the pins are main's again. |
| A8 | LOW | The 42 new strings were missing from the thirteen complete languages. | FIXED: drafted in-session, recorded as the machine's. |

## Not changed

- A sprite's forearm and its weapon in third person stay undrawn: a painting has no measure for them (`Aura-Armory.md`
  sections 7 and 8).
- `IT1` and `WD1` fail with the fetched freeware ARENA2 on this branch and on main alike: the patches were authored
  against another copy of the data. Nothing here touches world data.
