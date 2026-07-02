# Player-Arc (NOT STARTED)

First-person play inside the assembled world: walk, collide, activate.
This page exists so Port-Ledger C rows targeting "Player arc" resolve
somewhere real.

Inputs already shipped for this arc:
- `src/world/staticDoors.js` - trigger volumes from MeshReader's
  ModelDoor extraction (runs on every model), openRotation helper.
- Dungeon action records (`rdbLayout.js`) - doors, levers, platforms with
  verbatim axes/magnitudes, waiting for an activation system.
- Streaming world camera (`?world`) - the fly camera to be replaced by a
  grounded controller.

Queue sketch (not approved, ordering TBD with Mac):
1. Grounded movement + gravity + collision against meshes and terrain.
2. PlayerActivate ray: doors (interior/exterior transition via
   staticDoors), ladders, dungeon action chains.
3. Interior/exterior/dungeon scene transitions replacing URL params.
