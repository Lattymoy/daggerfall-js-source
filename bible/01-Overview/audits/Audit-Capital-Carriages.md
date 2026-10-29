# AUDIT CAPITAL-CARRIAGES (2026-10-29) - the carriages at the capitals' and the cities' gates, read cold

The owner, of CAPITAL-CARRIAGES (`../../06-Systems/Immersive-Travel.md` departures 14 and 15; "Ensure all capitals and
cities outside the bay properly have the wagon transport at their gates"): **"Audit this"**. Three cold lanes read the head
(`fd1ed9892`) against its base (`5995d0bb9`) in a frozen worktree with the freeware's data, each given the files and a
brief, never a conclusion. Each finding was proven - a probe on the real data, a test that fails at the head, or quoted
lines - before it was fixed, and each fix is pinned and mutated (`tools/mutants/audit_capitalcarriages.json`).

| Lane | Read | Found |
|---|---|---|
| L | the law: each stand on the ground the terrain kernel draws, the cities' gates on their real roads, the map's carriage towns | 7 |
| T | the pins, the mutants and the record: what each assertion holds, survivors with and without ARENA2, every claim | 8 |
| P | the player's view: the running game, a driver clicked at each capital's gate | see its section |

## Lane L - the law

| ID | Severity | Finding | Verdict |
|---|---|---|---|
| L1 | HIGH | The Imperial City's only carriage group stood 2.2 to 2.9 m under the ground: the law read a capital without a relief as flat, and Talos Bridge's landing is on the far shore, which rises to the land's own height. | FIXED: the landing has a level apron on the vertex lines (`rumareWaters.js` RUMARE_LANDING), and the law stands a thing only on the city's own flat ground (`flatAt`, rumareFlatAt). Pinned on the kernel's drawn ground. |
| L2 | MEDIUM | Past the Bay, 33 of 108 carriages and 34 drivers stood on a painted road; 3 on a gate's own laid road. Gate dressing cleared only the wall's and the houses' cells, and a gate's road never read the carrier. | FIXED: a gate's things outside it stand on the town's ground, off its roads and its gates' passages (`townWalls.js` townGateOutside, GATE_ROAD_CLEAR), and a gate's road goes round the carriage (`townGates.js`). |
| L3 | LOW | A gate past the template's four frames stood nothing: Bravil's fifth; 70 of 407 templates short under synthetic roads. | FIXED: such a gate takes its nearest frame's things again, turned to face it. |
| L4 | MEDIUM | Solitude's carriage stood on its stand's bank, one side 0.61 m under: the level law read the relief's own height, not the ground drawn on its 6.4 m lattice. | FIXED: the law reads the drawn ground (`capitalRelief.js` reliefDrawnAt) under a ring of nine points; the stand's edges are on the lattice. |
| L5 | LOW | The stand's bank changed the Gate Road's shoulder by up to 2.3 m, where the record said it kept clear. | FIXED: the stand is narrower and its bank one tile, off the shoulder. |
| L6 | LOW | All 625 Imperial City slices drew the map's carriage wheel; one holds a carriage. | FIXED: `capitalCarriages.js` isCarriageTown - a capital's slice only where a road gate stands. |
| L7 | LOW | The rim was read at a thing's centre only; Helstrom's north carriage reached 0.7 m into it. | FIXED: the rim is read under the whole reach. |

## Lane T - the pins and the record

| ID | Severity | Finding | Verdict |
|---|---|---|---|
| T1 | HIGH | "Every city past the Bay already stood a carriage at each gate" was measured on a wall built without roads. With its roads the Bay had 105 bare gates in 88 cities. | L2 and L3's fix. The claim is corrected and pinned on real roads. |
| T2 | MEDIUM | Solitude's carriage was off its level stand; the pin allowed the bank. | L4's fix; pinned inside the stand. |
| T3 | MEDIUM | Nothing pinned the Imperial City's stand: its slice's footprint and its walkers round its things could go unread. | FIXED: `capitalModels.js` carriageFootprintOf made testable and pinned to slice 300; the walkers pinned shut. |
| T4 | MEDIUM | The search's arms ran only where today's stands needed them: the next gate, a step toward the wall, along either way, never the sea or a lake. | FIXED: each pinned on a synthetic gate. |
| T5 | LOW | The capital-as-carriage-town pin built its location by hand, so the Imperial City's k 0 read as no capital went unseen. | FIXED: pinned on synthesizeCapitalLocation's own locations. |
| T6 | LOW | Two mutants died only with ARENA2, unnoted, and the gate frames were pinned only there. | FIXED: the frames pinned without it; the notes written. |
| T7 | LOW | The stand's measures and its bank's smoothstep were never checked. | FIXED: pinned. |
| T8 | LOW | Wording: the stand "clear of the shoulder" (L5); "Daggerfall's gate on its side" (11 of 18 take the opposite side's); Falinesti among the walled; "no block changed while the mod is not loaded" (Solitude's stand block is); the author's "the prebuild worker's closure gained nothing" (it gained `capitalCarriages.js`). | FIXED in the record. |

## Lane P - the player's view

Pending.

## Not changed

- Past the Bay with eight roads into every sixth template, 7 of 551 gates have no clear place off the roads within 32 m.
  On the real map 2 of 109 (Jehanna, Rihad). Their carriage stands on a road. The pin holds it under 2%.
- Unproven and left: a capital's stands are cached for the session, so a block read before the mod's patches install
  would keep none (no load order was found that does it); 16 of 18 stands sit on a block beside their carrier's (no
  per-block culling was found that reads that).
- `it1_worlddata`'s sha256 and L10N4's `shadowPass.js` ratchet fail on main as on this branch. Nothing here touches them.
