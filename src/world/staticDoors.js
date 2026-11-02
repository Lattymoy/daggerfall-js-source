// StaticDoor triggers from model door data.
// 1:1 translation of Daggerfall Unity's GameObjectHelper.GetStaticDoors
// (MIT, Daggerfall Workshop). Verbatim:
//   - Size from the diagonal verts v0/v2: width |v2.x - v0.x|,
//     height |v2.y - v0.y|, depth |v2.z - v0.z|; thickness is the larger of
//     width/depth; size = (thickness, max(height, thickness),
//     min(height, thickness)).
//   - centre = (v0 + v2) / 2 and normal stay in MODEL space; the placement
//     matrix rides along on the door (DFU's DaggerfallStaticDoors transforms
//     on use). Consumers multiply centre/normal through `matrix` themselves.
//   - Returns null when the model carries no door array (parity with DFU's
//     null guard); an empty doors array returns [].

/**
 * Build static door triggers for one placed model.
 * @param {object} model - output of dfMeshToModel (carries .doors).
 * @param {number} blockIndex - RMB block index of the owning block.
 * @param {number} recordIndex - building subrecord index within the block.
 * @param {Float32Array|number[]} matrix - the model's placement matrix
 *   (column-major mat4), stored on each door untransformed.
 * @returns {Array<{matrix,doorType:number,blockIndex:number,recordIndex:number,
 *   doorIndex:number,centre:{x,y,z},normal:{x,y,z},size:{x,y,z}}>|null}
 */
export function getStaticDoors(model, blockIndex, recordIndex, matrix) {
  if (!model.doors) return null;

  const staticDoors = new Array(model.doors.length);
  for (let i = 0; i < model.doors.length; i++) {
    const door = model.doors[i];
    const v0 = door.vert0;
    const v2 = door.vert2;

    // Absolute door size; thickness uniform from largest width or depth.
    const width = Math.abs(v2.x - v0.x);
    const height = Math.abs(v2.y - v0.y);
    const depth = Math.abs(v2.z - v0.z);
    const thickness = Math.max(width, depth);
    const size = {
      x: thickness,
      y: Math.max(height, thickness),
      z: Math.min(height, thickness),
    };

    staticDoors[i] = {
      matrix,
      doorType: door.type,
      blockIndex,
      recordIndex,
      doorIndex: door.index,
      centre: {
        x: (v0.x + v2.x) / 2,
        y: (v0.y + v2.y) / 2,
        z: (v0.z + v2.z) / 2,
      },
      normal: door.normal,
      size,
    };
  }

  return staticDoors;
}
