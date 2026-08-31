# AUDIT 32 - THE FACE MATCHER AND THE REBUILD LANE (2026-08-30)

Mac's call: a deep deep audit on everything so far. Audits 29-31
covered the worn lane through D31 against the fetched reference. This
one takes the four slices since - D32 (the body follows the equip
table, from the parallel session), D33 (verdicts and the curation
table), D34 (the face sheet), D35 (the measured face match) - and
reads them the way a retail archive would: for every place a slice
ASSUMED something about data this repo has never seen.

## Findings

**F1 - THE HEAD READ ASSUMED THE TEXTURE'S LAYOUT (D35, mine).** The
first matcher took the head texture's middle band for the cheeks and
its lower band for the chin. That is only true if the face sits
centred in UV space, and nothing in this repo has seen a retail head
texture's unwrap; a face laid out to one side would have measured the
back of the skull as skin tone and matched every portrait to the
wrong head with perfect confidence. Fixed at the root: the head is
sampled THROUGH ITS OWN MESH. The head points +Y (Morrowind's
forward), so the front vertices are the face, the lower front vertices
the chin, and each vertex's UV names the exact texel that is its skin
- layout-agnostic by construction. The band read remains only as the
fallback for a mesh without UVs, and says so (`via`). Pinned on a
texture whose skin lives in a corner the band never reads: the mesh
read finds it, the band read is asserted WRONG. 2 mutants dead (the
back of the skull admitted as face; the chin never read).

**F2 - EVERY WORN SWAP RE-MEASURED THE FACE.** D32 rebuilds the body
whenever the equip table changes; D35 measured the face inside that
build. A gauntlet dropped therefore re-parsed a dozen head and hair
meshes and decoded a dozen textures, for a face that had not changed.
Memoised per identity per data generation, the same stamp D32's ESM
walks use, so a re-attached archive is a fresh measure and a gauntlet
is not.

**F3 - A MISS WOULD HAVE BEEN MEMOISED FOR THE SESSION.** The
enhanced door opens before ARENA2 is picked, so the first build of a
session can find no portrait archive; had that verdict gone into the
cache, every rebuild after the data arrived would still have said
"the walk stands". Only a match that measured something is cached.
1 mutant dead.

## Verified, and how

- **D35's portrait side on real data**: all 160 classic portraits
  from the ARENA2 set in the sandbox measure (zero unreadable, 19
  bald); the colours agree with the eye on every face inspected -
  Breton 0 grey and short, 2 grey and bearded, 4 red and bearded, 8
  bald; every Redguard skin dark; every Nord hair blond; Nord female 0
  and 1 are byte-identical portraits and measure identically.
- **D35's forward axis**: the head faces +Y - the same convention the
  weapon lane proved on retail (the Weapon Bone at +X is the actor's
  right, MW-D22's card), so "front vertices" is not a fresh guess.
- **D32's key** carries kind, template and material, so a shirt and a
  robe are two keys and a material swap is a change (read, not
  assumed).
- **The merge from the parallel session** (a6511989) made the
  measurer decode by extension - the texture ladder legitimately
  answers .tga and .bmp - and the three decoders share one
  `{width, height, mips}` shape, so F1's mip-0 read holds for all.
- **The race spelling both ways**: mwRaceId and dfRaceKeyOf round-trip
  every one of the eight (DarkElf <-> dark elf, HighElf, WoodElf).
- **Never-traps on the face**: no ARENA2, no CIF, no texture, no UVs,
  no head pool - each is a named reason on the card and the walk
  stands; nothing in the chain throws past its own catch.
- **The exporter (D34)** reads the same body-record fields the viewer
  already relies on and labels each cell with the walk's portrait
  indices from the identical modulo the game uses.

## Not covered, said plainly

The Morrowind side of the matcher is pinned on synthetic textures and
meshes; its first retail reading is Mac's card, which now prints the
measured distances for exactly that reason. The hair colour is the
texture's alpha-weighted mean, which for a hair texture with baked
scalp skin will lean toward the scalp - a bound worth knowing if a
pairing looks off.
