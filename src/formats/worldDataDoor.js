// THE WORLD-DATA DOOR - the one seam MapsFile and BlocksFile ask before
// they read a region, a location or a block off the BSA, so DFU's
// static WorldDataReplacement calls (MapsFile.cs:984, :999;
// BlocksFile.cs:214, :273, :385, :850) have a home the readers can
// import without a cycle: formats/worldDataReplacement.js installs
// itself here (it imports the readers' enums), the readers import only
// this leaf. Unset, every ask answers "no replacement" - DFU with
// AssetInjection off.
let _door = null;
export function setWorldDataDoor(door) { _door = door ?? null; }
export const worldDataDoor = () => _door;
