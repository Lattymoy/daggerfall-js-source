// ARCH3D.BSA mesh reader and decomposer.
// 1:1 translation of Daggerfall Unity's Arch3dFile.cs (MIT, Daggerfall
// Workshop / Gavin Clayton, Ferital). Output DFMesh shape matches DFMesh.cs:
// submeshes grouped by unique texture, each plane a triangle fan of points
// {x,y,z,nx,ny,nz,u,v} with positions/normals divided by 256 and UVs by 16.
//
// Quirks kept verbatim:
//   - Arch3dPatch byte fixes applied to the buffer before parsing.
//   - Bounding min/max start at 0, so Size always spans the origin.
//   - UVunpack applies only to the first 3 points of a plane and only for
//     record ids below 905.
//   - v2.5 meshes multiply point offsets by 3; v2.6/2.7 use them directly.
//   - Fixed decomposition buffer sizes (16 corners, 32 textures/submeshes,
//     512 planes per submesh, 16 points per plane, 24 UV slots) throw on
//     overflow exactly where C# would, failing that record's load.
//   - Corner detection: angle(l0,l1) > 0.001 rad marks a corner; normalize
//     of a zero-length edge throws, failing the record (caught upstream).
// Numeric note: JS doubles replace C# float/double mix; (Int32) casts are
// Math.trunc. The full-corpus gate pins observed output.

import { BsaFile, DIRECTORY_TYPES } from './bsaFile.js';
import { computeFaceUVCoordinates } from './faceUVTool.js';
import { ARCH3D_PATCH } from './arch3dPatch.js';

// Buffer lengths used during decomposition.
const CORNER_BUFFER_LENGTH = 16;
const UNIQUE_TEXTURE_BUFFER_LENGTH = 32;
const SUB_MESH_BUFFER_LENGTH = 32;
const PLANE_BUFFER_LENGTH = 512;
const POINT_BUFFER_LENGTH = 16;
const CALCULATED_UV_BUFFER_LENGTH = 24;

// Divisors for points and textures.
const POINT_DIVISOR = 256.0;
const TEXTURE_DIVISOR = 16.0;

export const MESH_VERSIONS = Object.freeze({
  Unknown: 0,
  Version25: 25,
  Version26: 26,
  Version27: 27,
});

export const UV_GENERATION_METHODS = Object.freeze({
  Unknown: 0,
  TriangleOnly: 1,
  ModifiedMatrixGenerator: 2,
});

function emptyMesh() {
  return {
    objectId: 0,
    radius: 0,
    size: { x: 0, y: 0, z: 0 },
    centre: { x: 0, y: 0, z: 0 },
    totalVertices: 0,
    totalTriangles: 0,
    subMeshes: null,
  };
}

function getVersion(version) {
  if (version === 'v2.7') return MESH_VERSIONS.Version27;
  if (version === 'v2.6') return MESH_VERSIONS.Version26;
  if (version === 'v2.5') return MESH_VERSIONS.Version25;
  return MESH_VERSIONS.Unknown;
}

/**
 * Unpack special texture coordinates. A packed coordinate is outside the
 * -14335..14335 range; -7168 is the only known exception.
 */
export function uvUnpack(u) {
  if (u > -14336 && u < 14336 && u !== -7168) return u;

  // Get the nearest multiple of 8192.
  let nextMult = u - 1;
  nextMult = nextMult >> 13;
  ++nextMult;
  nextMult = nextMult << 13;
  const prevMult = nextMult - 8192;
  const mult = u - prevMult < nextMult - u ? prevMult : nextMult;

  // Unpack the coordinate by subtracting the above multiple.
  return u - mult;
}

export class Arch3dFile {
  constructor() {
    this._bsa = null;
    this._records = null;
    this._recordIndexLookup = new Map();
    this.autoDiscard = true;
    this._lastRecord = -1;

    // Scratch buffers reused across records, as in DFU.
    this._cornerPointBuffer = new Array(CORNER_BUFFER_LENGTH);
    this._calculatedUVBuffer = new Array(CALCULATED_UV_BUFFER_LENGTH);
    this._subMeshBuffer = new Array(SUB_MESH_BUFFER_LENGTH);
  }

  static get filename() {
    return 'ARCH3D.BSA';
  }

  /** Number of BSA records in ARCH3D.BSA. */
  get count() {
    return this._bsa ? this._bsa.count : 0;
  }

  /**
   * Load ARCH3D.BSA contents. Applies the Arch3dPatch model fixes to a copy
   * of the buffer before parsing (DFU patches its memory buffer in place).
   * @param {Uint8Array} bytes
   * @returns {boolean} true if successful.
   */
  load(bytes) {
    const patched = bytes.slice();
    for (const [offset, data] of ARCH3D_PATCH) {
      for (let i = 0; i < data.length; i++) patched[offset + i] = data[i];
    }

    this._bsa = new BsaFile(patched);
    if (this._bsa.directoryType !== DIRECTORY_TYPES.NumberRecord) return false;
    this._records = new Array(this._bsa.count).fill(null);
    return true;
  }

  /**
   * Index of mesh record with specified id, or -1. Cached in a lookup map so
   * subsequent calls are fast.
   */
  getRecordIndex(id) {
    if (this._recordIndexLookup.has(id)) return this._recordIndexLookup.get(id);
    for (let i = 0; i < this.count; i++) {
      if (this._bsa.getRecordId(i) === id) {
        this._recordIndexLookup.set(id, i);
        return i;
      }
    }
    return -1;
  }

  /** ID of record from index. */
  getRecordId(record) {
    return this._bsa.getRecordId(record);
  }

  /** Load a mesh record into memory and decompose it for use. */
  loadRecord(record) {
    if (record < 0 || record >= this.count) return false;

    // Exit if already loaded.
    if (this._records[record] !== null && this._records[record].pureMesh !== null) return true;

    // Auto discard previous record.
    if (this.autoDiscard && this._lastRecord !== -1) this.discardRecord(this._lastRecord);

    const rec = {
      objectId: 0,
      version: MESH_VERSIONS.Unknown,
      bytes: this._bsa.getRecordBytes(record),
      header: null,
      pureMesh: null,
      dfMesh: emptyMesh(),
    };
    this._records[record] = rec;

    if (!this._read(record)) {
      this.discardRecord(record);
      return false;
    }

    if (!this._recordIndexLookup.has(rec.objectId)) {
      this._recordIndexLookup.set(rec.objectId, record);
    }

    this._lastRecord = record;
    return true;
  }

  /** Discard a mesh record from memory. */
  discardRecord(record) {
    if (record < 0 || record >= this.count) return;
    this._records[record] = null;
  }

  /** Discard all mesh records. */
  discardAllRecords() {
    for (let record = 0; record < this.count; record++) this.discardRecord(record);
  }

  /** DFMesh representation of a record (empty mesh on failure). */
  getMesh(record) {
    if (!this.loadRecord(record)) return emptyMesh();
    return this._records[record].dfMesh;
  }

  // --- Readers ---

  _read(record) {
    try {
      this._readHeader(record);
      const rec = this._records[record];
      rec.objectId = this._bsa.getRecordId(record);
      rec.version = getVersion(rec.header.version);
      if (!this._readMesh(record)) return false;
      if (!this._decomposeMesh(record)) return false;
    } catch (e) {
      return false;
    }
    return true;
  }

  _readHeader(record) {
    const rec = this._records[record];
    const v = new DataView(rec.bytes.buffer, rec.bytes.byteOffset, rec.bytes.byteLength);
    rec.view = v;
    let version = '';
    for (let i = 0; i < 4 && rec.bytes[i] !== 0; i++) version += String.fromCharCode(rec.bytes[i]);
    rec.header = {
      version,
      pointCount: v.getInt32(4, true),
      planeCount: v.getInt32(8, true),
      radius: v.getUint32(12, true),
      // nullValue1: u64 at 16
      planeDataOffset: v.getInt32(24, true),
      objectDataOffset: v.getInt32(28, true),
      objectDataCount: v.getInt32(32, true),
      unknown2: v.getUint32(36, true),
      // nullValue2: u64 at 40
      pointListOffset: v.getInt32(48, true),
      normalListOffset: v.getInt32(52, true),
      unknown3: v.getUint32(56, true),
      planeListOffset: v.getInt32(60, true),
    };
  }

  _readMesh(record) {
    const rec = this._records[record];
    const v = rec.view;
    const faceCount = rec.header.planeCount;
    const recordId = rec.objectId;
    const version = rec.version;

    const uniqueTextureBuffer = [];
    const planes = new Array(faceCount);

    let normalPos = rec.header.normalListOffset;
    let pos = rec.header.planeListOffset;
    let minX = 0, maxX = 0, minY = 0, maxY = 0, minZ = 0, maxZ = 0;
    let size = { x: 0, y: 0, z: 0 };
    let centre = { x: 0, y: 0, z: 0 };

    for (let plane = 0; plane < faceCount; plane++) {
      // Read plane header.
      const header = {
        position: pos,
        planePointCount: rec.bytes[pos],
        unknown1: rec.bytes[pos + 1],
        texture: v.getUint16(pos + 2, true),
        unknown2: v.getUint32(pos + 4, true),
      };
      pos += 8;

      // Read the normal data for this plane.
      const nx = v.getInt32(normalPos, true);
      const ny = v.getInt32(normalPos + 4, true);
      const nz = v.getInt32(normalPos + 8, true);
      normalPos += 12;

      // Build list of unique textures across all planes.
      const textureArchive = header.texture >> 7;
      const textureRecord = header.texture & 0x7f;
      let foundTexture = false;
      for (let i = 0; i < uniqueTextureBuffer.length; i++) {
        if (
          uniqueTextureBuffer[i].archive === textureArchive &&
          uniqueTextureBuffer[i].record === textureRecord
        ) {
          foundTexture = true;
          break;
        }
      }
      if (!foundTexture) {
        if (uniqueTextureBuffer.length >= UNIQUE_TEXTURE_BUFFER_LENGTH) {
          throw new RangeError('uniqueTextureBuffer overflow');
        }
        uniqueTextureBuffer.push({ archive: textureArchive, record: textureRecord });
      }

      // Read plane points.
      const pointCount = header.planePointCount;
      const points = new Array(pointCount);
      for (let point = 0; point < pointCount; point++) {
        const pointOffset = v.getInt32(pos, true);
        let u = v.getInt16(pos + 4, true);
        let uv = v.getInt16(pos + 6, true);
        pos += 8;

        // Fix some UV coordinates (only the first 3 points; coordinates from
        // point 4 up are ignored). Only models with id below 905 need this.
        if (point < 3 && recordId < 905) {
          u = uvUnpack(u);
          uv = uvUnpack(uv);
        }

        // Get point position.
        let pointPosition = rec.header.pointListOffset;
        switch (version) {
          case MESH_VERSIONS.Version27:
          case MESH_VERSIONS.Version26:
            pointPosition += pointOffset;
            break;
          case MESH_VERSIONS.Version25:
            pointPosition += pointOffset * 3;
            break;
        }

        const x = v.getInt32(pointPosition, true);
        const y = v.getInt32(pointPosition + 4, true);
        const z = v.getInt32(pointPosition + 8, true);

        // Track min/max of native points for a tight box around the mesh.
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;

        points[point] = { x, y, z, nx, ny, nz, u, v: uv };
      }

      // Read unknown plane data.
      const pdPos = rec.header.planeDataOffset + plane * 24;
      const planeData = rec.bytes.slice(pdPos, pdPos + 24);

      planes[plane] = {
        header,
        textureIndex: { archive: textureArchive, record: textureRecord },
        planeData,
        points,
      };

      // Store size and centre of mesh (recomputed per plane, as DFU does).
      size = {
        x: maxX / POINT_DIVISOR - minX / POINT_DIVISOR,
        y: maxY / POINT_DIVISOR - minY / POINT_DIVISOR,
        z: maxZ / POINT_DIVISOR - minZ / POINT_DIVISOR,
      };
      centre = { x: size.x / 2, y: size.y / 2, z: size.z / 2 };
    }

    rec.pureMesh = { uniqueTextures: uniqueTextureBuffer, planes, size, centre };

    // Prepare submesh decomposition buffers.
    for (let i = 0; i < uniqueTextureBuffer.length; i++) {
      this._subMeshBuffer[i] = {
        textureArchive: uniqueTextureBuffer[i].archive,
        textureRecord: uniqueTextureBuffer[i].record,
        planeCount: 0,
        planeBuffer: new Array(PLANE_BUFFER_LENGTH),
      };
    }

    return true;
  }

  /**
   * Decompose pure mesh into submeshes grouped by texture, each plane a
   * triangle-friendly fan.
   */
  _decomposeMesh(record) {
    const rec = this._records[record];
    const uniqueTextureCount = rec.pureMesh.uniqueTextures.length;
    const dfMesh = emptyMesh();
    dfMesh.subMeshes = new Array(uniqueTextureCount);
    dfMesh.objectId = rec.objectId;
    dfMesh.radius = rec.header.radius / POINT_DIVISOR;

    // Decompose each plane of this mesh into a buffer.
    const planeCount = rec.pureMesh.planes.length;
    for (let plane = 0; plane < planeCount; plane++) {
      const p = rec.pureMesh.planes[plane];
      const subMeshIndex = this._getSubMesh(
        rec.pureMesh,
        p.textureIndex.archive,
        p.textureIndex.record
      );
      this._writePlane(subMeshIndex, p);
    }

    // Copy valid mesh data from buffer into mesh record.
    let totalTriangles = 0;
    for (let submesh = 0; submesh < uniqueTextureCount; submesh++) {
      const buf = this._subMeshBuffer[submesh];
      const sm = {
        textureArchive: buf.textureArchive,
        textureRecord: buf.textureRecord,
        totalTriangles: 0,
        planes: new Array(buf.planeCount),
      };
      for (let plane = 0; plane < buf.planeCount; plane++) {
        const pb = buf.planeBuffer[plane];
        dfMesh.totalVertices += pb.pointCount;
        sm.totalTriangles += pb.pointCount - 2;
        sm.planes[plane] = {
          points: pb.pointBuffer.slice(0, pb.pointCount),
          uvGenerationMethod: pb.uvGenerationMethod,
        };
      }
      totalTriangles += sm.totalTriangles;
      dfMesh.subMeshes[submesh] = sm;
    }

    dfMesh.totalTriangles = totalTriangles;
    dfMesh.size = rec.pureMesh.size;
    dfMesh.centre = rec.pureMesh.centre;
    rec.dfMesh = dfMesh;
    return true;
  }

  _writePlane(subMeshIndex, planeIn) {
    // Handle planes with greater than 3 points.
    if (planeIn.points.length > 3) return this._writeVariablePlane(subMeshIndex, planeIn);

    const buf = this._subMeshBuffer[subMeshIndex];
    if (buf.planeCount >= PLANE_BUFFER_LENGTH) throw new RangeError('planeBuffer overflow');
    const planeIndex = buf.planeCount;
    buf.planeBuffer[planeIndex] = {
      pointCount: 0,
      pointBuffer: new Array(POINT_BUFFER_LENGTH),
      uvGenerationMethod: UV_GENERATION_METHODS.Unknown,
    };
    buf.planeCount++;

    // Points 1 & 2 UVs are deltas added to the previous point.
    planeIn.points[1].u += planeIn.points[0].u;
    planeIn.points[1].v += planeIn.points[0].v;
    planeIn.points[2].u += planeIn.points[1].u;
    planeIn.points[2].v += planeIn.points[1].v;

    // Write the 3 points.
    this._writePoint(planeIn.points[0], buf.planeBuffer[planeIndex]);
    this._writePoint(planeIn.points[1], buf.planeBuffer[planeIndex]);
    this._writePoint(planeIn.points[2], buf.planeBuffer[planeIndex]);

    buf.planeBuffer[planeIndex].uvGenerationMethod = UV_GENERATION_METHODS.TriangleOnly;
    return planeIndex;
  }

  /** Write an N-point triangle fan to buffer by finding corners. */
  _writeVariablePlane(subMeshIndex, planeIn) {
    const buf = this._subMeshBuffer[subMeshIndex];
    if (buf.planeCount >= PLANE_BUFFER_LENGTH) throw new RangeError('planeBuffer overflow');
    const planeIndex = buf.planeCount;
    buf.planeBuffer[planeIndex] = {
      pointCount: 0,
      pointBuffer: new Array(POINT_BUFFER_LENGTH),
      uvGenerationMethod: UV_GENERATION_METHODS.Unknown,
    };
    buf.planeCount++;

    // Find corner points.
    const cornerCount = this._getCornerPoints(planeIn.points);

    // Calculate UV coordinates of all points.
    if (computeFaceUVCoordinates(planeIn.points, this._calculatedUVBuffer)) {
      for (let pt = 0; pt < planeIn.points.length; pt++) {
        planeIn.points[pt].u = this._calculatedUVBuffer[pt].u;
        planeIn.points[pt].v = this._calculatedUVBuffer[pt].v;
      }
      buf.planeBuffer[planeIndex].uvGenerationMethod =
        UV_GENERATION_METHODS.ModifiedMatrixGenerator;
    }

    // Write first 3 points, then the remaining corners.
    let cornerPos = 0;
    this._writePoint(planeIn.points[this._cornerPointBuffer[cornerPos++]], buf.planeBuffer[planeIndex]);
    this._writePoint(planeIn.points[this._cornerPointBuffer[cornerPos++]], buf.planeBuffer[planeIndex]);
    this._writePoint(planeIn.points[this._cornerPointBuffer[cornerPos++]], buf.planeBuffer[planeIndex]);
    while (cornerPos < cornerCount) {
      this._writePoint(planeIn.points[this._cornerPointBuffer[cornerPos++]], buf.planeBuffer[planeIndex]);
    }

    return planeIndex;
  }

  /**
   * Write a single point to buffer. Vector coordinates are divided by 256,
   * texture coordinates by 16.
   */
  _writePoint(srcPoint, dstPlane) {
    if (dstPlane.pointCount >= POINT_BUFFER_LENGTH) throw new RangeError('pointBuffer overflow');
    const pointPos = dstPlane.pointCount;
    dstPlane.pointBuffer[pointPos] = {
      x: srcPoint.x / POINT_DIVISOR,
      y: srcPoint.y / POINT_DIVISOR,
      z: srcPoint.z / POINT_DIVISOR,
      nx: srcPoint.nx / POINT_DIVISOR,
      ny: srcPoint.ny / POINT_DIVISOR,
      nz: srcPoint.nz / POINT_DIVISOR,
      u: srcPoint.u / TEXTURE_DIVISOR,
      v: srcPoint.v / TEXTURE_DIVISOR,
    };
    dstPlane.pointCount++;
    return pointPos;
  }

  /** Find submesh this archive/record combo belongs to. */
  _getSubMesh(mesh, textureArchive, textureRecord) {
    for (let i = 0; i < mesh.uniqueTextures.length; i++) {
      if (
        mesh.uniqueTextures[i].archive === textureArchive &&
        mesh.uniqueTextures[i].record === textureRecord
      ) {
        return i;
      }
    }
    throw new Error('GetSubMesh() index not found.');
  }

  /**
   * Find corner points from a pure face - reduces the number of points in
   * the final strip. Angle between successive edge vectors above 0.001 rad
   * marks a corner.
   */
  _getCornerPoints(pointsIn) {
    let cornerCount = 0;
    const pointCount = pointsIn.length;
    for (let point = 0; point < pointCount; point++) {
      let a;
      let b;
      let c;
      let cornerIndex;
      if (point < pointCount - 2) {
        a = pointsIn[point];
        b = pointsIn[point + 1];
        c = pointsIn[point + 2];
        cornerIndex = point + 1;
      } else if (point < pointCount - 1) {
        a = pointsIn[point];
        b = pointsIn[point + 1];
        c = pointsIn[0];
        cornerIndex = point + 1;
      } else {
        a = pointsIn[point];
        b = pointsIn[0];
        c = pointsIn[1];
        cornerIndex = 0;
      }

      // Direction vectors.
      const l0x = b.x - a.x, l0y = b.y - a.y, l0z = b.z - a.z;
      const l1x = c.x - a.x, l1y = c.y - a.y, l1z = c.z - a.z;

      // Angle between direction vectors: acos of normalized dot. Normalizing
      // a zero-length vector throws, matching DFU's Vector3.Normalize.
      const m0 = Math.sqrt(l0x * l0x + l0y * l0y + l0z * l0z);
      const m1 = Math.sqrt(l1x * l1x + l1y * l1y + l1z * l1z);
      if (m0 === 0 || m1 === 0) {
        throw new Error('Can not normalize a vector when it\'s magnitude is zero');
      }
      const angle = Math.acos((l0x * l1x + l0y * l1y + l0z * l1z) / (m0 * m1));
      if (angle > 0.001) {
        if (cornerCount >= CORNER_BUFFER_LENGTH) throw new RangeError('cornerPointBuffer overflow');
        this._cornerPointBuffer[cornerCount++] = cornerIndex;
      }
    }

    return cornerCount;
  }
}
