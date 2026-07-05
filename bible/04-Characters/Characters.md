# Characters

ACTIVE - see Characters-Arc.md. C1-C3 SHIPPED (interior people, exterior
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
