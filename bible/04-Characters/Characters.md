# Characters

ACTIVE again at the CH-series - see Characters-Arc.md for the live record,
which runs past this page's summary: C8 shipped the enemy rigs E1-E4b end to
end plus spectral (E4c deferred by Mac), which is where pivot 3 parked the
arc; it REOPENED on 2026-08-20 with CH-C (the archer band, enemies opening
doors, pacification), CH-X + CH-X2 + CH-X3 (the exterior mobile-foe mount and
its archery and casting arms), CH3 (fall damage + the equip swap pause) and
CH4 (the senses verify pass). Only E4c is still deferred by direction. The
remaining interims are Systems work (ledger below). The C9-C17 slices that
carry the same letter are recorded in `05-Combat/Combat.md`, not here. AUDIT
18 corrected this page's status word once already, in the other direction - it
said ACTIVE and stopped its record at C5 while Home.md's arc index said PARKED
with C8 and the E-series shipped.

C1-C3 SHIPPED (interior people, exterior
NPCs + name banks, dungeon enemies). C4 voxel rigs SHIPPED (character
render path, ?voxelfolk). C5 SHIPPED: the vendored/trace rigs are retired
for a designed `buildNeutralBody` figure, plus a full race system -
geometric armour (body-displacement + standoff pieces), clothing (1:1
with the item DB), simulated draped garments (verlet cloth with body
collision + bone-driven leg-drapes - see C-Drapes), race heads/hairstyles,
tails, body scales/fur,
per-race colour palettes with client-side tone selection, and an
in-engine bake (`raceCharacter.js` -> one cached mesh per race,
instanced by archive-derived race). Prerequisites (Readers, World)
COMPLETE; items routed here are collected in 01-Overview/Port-Ledger.md
section C. Scope in 01-Overview/Port-Doctrine.md phase plan.
