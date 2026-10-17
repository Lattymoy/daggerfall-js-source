# AUDIT 30 - THE REFERENCE FETCHED (2026-08-30)

Mac's call, the same evening as AUDIT 29: a deep comprehensive audit
on everything so far. 29 covered the lane's claims against its own
code and suites and said plainly what it did not re-derive. This one
closes that debt the only way it closes: THE REFERENCE ITSELF,
fetched from the OpenMW tree and read beside the port, byte layout by
byte layout - plus an adversarial pass over MW-D29, which landed
after 29's scope froze.

## Method

curl against raw.githubusercontent.com/OpenMW/openmw/master, the
exact files the lane's comments cite: loadarmo.hpp, loadrace.hpp,
npcanimation.cpp, animation.cpp. Every layout, enum, table and
formula claim shipped since D27 checked against the fetched source.
One finding, fixed and pinned in this commit; the verifications are
recorded with the reference's own line numbers so the next audit can
diff instead of re-fetch.

## Finding

**F1 - A HELMET HIDES THE HAIR, and D29 did not know it.** The
reference removes PRT_Hair the moment the helmet SLOT equips
(npcanimation.cpp:615) - an ENGINE rule, prior to and independent of
the armor's own part references - which is why a helm whose refs
cover only the head still never shows hair through the shell. D29's
composer keyed shadows purely off the refs, so every closed helm on
retail data would have worn the player's hair straight through the
mesh. Fixed where the rule lives in the reference - at the piece, not
the ref: the Helm template shadows 'hair' unconditionally. 1 pin
(head-only helm must shadow hair; a cuirass must not), 1 mutant dead.

## Verifications, with the reference's line numbers

- **PartReferenceType, all 27** (loadarmo.hpp:18-49): matches
  ARMO_PART order exactly, PRT_RLeg/LLeg being the upper legs and 25
  the weapon door's. The `unsigned char mPart` + male/female RefId
  PartReference shape matches the INDX/BNAM/CNAM reader.
- **The part-to-bone table** (npcanimation.cpp:244-259): every bone
  spelling in ARMO_PART matches sPartList - skirt on Groin, pauldrons
  on the Clavicles, shield on Shield Bone. One nuance recorded, not
  churned: PRT_Hair attaches at "Head" with "Hair" as a shape FILTER;
  the port's hair rides the same attach bone and vanilla hair meshes
  are single-shape, so the filter has nothing to filter yet.
- **The base body occupies the same 27 slots** (npcanimation.cpp:
  1186-1199): MP_Hand maps to BOTH PRT_RHand and PRT_LHand as
  separate instances, one skin record each side - the port's
  one-row-two-bones shape plus shadowSkinRows' per-side trim is the
  equivalent picture, now verified rather than believed.
- **The priority arithmetic** (npcanimation.cpp:617-631): armor prio
  `((base+1)<<1)+1` beats clothing's `+0`; robes reserve eleven
  slots, skirts three. No consumer in the port yet - recorded here so
  the CLOTHING slice starts from the law instead of finding it.
- **RADT, 140 bytes** (loadrace.hpp:50-71): 7 skill pairs + 8
  attribute pairs + 4 floats puts mFlags at offset 136, Beast = 0x2 -
  raceBeastFlag's exact read, and mwEsmFile's decodeRace beside it.
- **calcAnimVelocity** (animation.cpp:180-224): the reverse scan for
  the LAST start and the AshVampire double-stop quirk, the plain-stop
  overwrite walking back to the OLDEST, the (1,1,0) accumulate mask
  making length() a horizontal hypot - animVelocity replicates all of
  it, including the quirk the reference's comment says "must be
  replicated".

## Not covered, said plainly

The upstream AUDIT 28 waves (W4, the self-audit) landed from the
parallel session with their own pins and self-audit and were not
re-audited here. The clothing/robe reserve law is recorded above and
has no consumer yet; the report page still covers armor records only.
