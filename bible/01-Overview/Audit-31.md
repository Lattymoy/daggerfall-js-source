# AUDIT 31 - THE CLOTHING SLICE (2026-08-30)

Mac's call, immediately after MW-D30 shipped: a comprehensive audit on
this. Method as Audit 30: the reference fetched and read beside the
slice, every byte-layout and law claim checked at the source, plus
adversarial probes of the composer's edges. No code changed: zero
findings requiring a fix, three equivalences recorded so the next
reader does not re-derive them.

## Verified at the source

- **CTDT** (loadclot.hpp:44-50): int32 type, float weight, uint16
  value, uint16 enchant - 12 bytes, TYPE FIRST. The reader's layout
  and size gate are exact. This claim had shipped from memory in D30
  and is now source-verified, which is the whole reason this audit ran
  the same evening.
- **The Type enum** (loadclot.hpp:30-42): Pants 0 through Amulet 9,
  matching MW_CLOTHING_TYPE verbatim, gloves and jewellery included
  and unmapped on purpose.
- **The reserve lists** (npcanimation.cpp:635-650): the robe's eleven
  and the skirt's three match RESERVES index for index.
- **The strict gate** (:746, :771): both reserveIndividualPart and
  addOrReplaceIndividualPart replace only on strictly-greater, the law
  D30's first draft got wrong and its pin now holds.
- **removeIndividualPart** (:731-742) resets the slot's priority to
  ZERO - see the helmet note below.

## Equivalences recorded, not churned

- **The helmet-hair rule's mechanism differs, its outcome does not.**
  The reference REMOVES hair (priority to 0) when the helmet slot
  equips; the port CLAIMS the hair slot at the helmet's priority (3).
  These diverge only if something claims hair above 3 - and nothing on
  retail references hair at all except heads' own pairing; a robe with
  a hair reference does not exist. Bound recorded: if modded data ever
  refs hair at robe priority, the port shows it through the helm and
  the reference does not.
- **Shoes walk at the garment rank, not the Boots-slot rank.** The
  reference equips MW shoes in the Boots slot (walk rank 7); the port
  ranks all non-robe non-skirt garments after armor (10-11). No
  observable outcome differs: shoes' priority is 2 either way, their
  part slots are disjoint from everything that could tie, and the
  strict gate makes rank matter only on exact ties.
- **Two cloaks resolve deterministically.** DF has two cloak slots and
  MW one robe; both cloaks arrive as robe-kind at priority 24 and the
  strict gate hands every tie to the first - Cloak1, by the readout's
  fixed order. The outer cloak dresses, the inner is a note-free loss
  recorded here.

## Probed and clean

Dead-export sweep over the new surface (every D30 export consumed by
the one home, the build, or the pins); armor boots cannot double-enter
through the Feet slot (the armor readout keys on DF_ARMOR_ROWS, the
garment readout on CLOTHING_NAME, disjoint index ranges); clothing
BODY parts reach the composer's pool because bodyParts keeps every
kind; a shirt under a cuirass loses exactly its chest reference and
keeps its arms.

## Open, said plainly

mwItemReport still prints the armor grid only; garments resolve at
build time with notes but have no pre-equip report row. The
first-person arms do not wear gauntlet or clothing parts (the
third-person body does); that is the fp-worn slice if Mac wants it.
