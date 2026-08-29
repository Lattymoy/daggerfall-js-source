// NetImmerse NIF reader for Morrowind-era files (version 4.0.0.2 only).
// Original implementation written against the niftools nifxml spec;
// OpenMW's components/nif used as behavioral reference only (GPL - no code
// ported). Slice 1 of the Morrowind import arc: scene graph, tri geometry,
// skinning data, render properties, extra data. Keyframe/particle/effect
// records land with the animation slice.
//
// 4.0.0.2 records carry NO size field, so an unknown record type makes the
// rest of the stream unreadable - there is nothing to skip over. The reader
// is therefore strict: any type outside the registry throws with the type
// name and record index, which is exactly the signal that tells the next
// slice what to implement.
//
// File layout:
//   Header line "NetImmerse File Format, Version 4.0.0.2\n" (0x0A-terminated)
//   uint32 version (0x04000002), uint32 recordCount
//   recordCount x { sizedString typeName, payload }   - little-endian
//   Footer: uint32 rootCount, int32 rootRefs[rootCount]
// Refs are int32 indices into the record list, -1 for null. Matrices are
// row-major 3x3 (Float32Array(9)). Sized strings are uint32 length + bytes.

export const MW_NIF_VERSION = 0x04000002;

class NifStream {
  /** @param {Uint8Array} bytes */
  constructor(bytes) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.pos = 0;
  }
  u8() {
    return this.view.getUint8(this.pos++);
  }
  u16() {
    const v = this.view.getUint16(this.pos, true);
    this.pos += 2;
    return v;
  }
  i16() {
    const v = this.view.getInt16(this.pos, true);
    this.pos += 2;
    return v;
  }
  u32() {
    const v = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return v;
  }
  i32() {
    const v = this.view.getInt32(this.pos, true);
    this.pos += 4;
    return v;
  }
  f32() {
    const v = this.view.getFloat32(this.pos, true);
    this.pos += 4;
    return v;
  }
  /** 32-bit bool as used throughout 4.0.0.2. */
  bool() {
    return this.u32() !== 0;
  }
  /** uint32 length-prefixed string, latin1 bytes. */
  string() {
    const len = this.u32();
    if (len > 0xffff || this.pos + len > this.bytes.byteLength) {
      throw new Error(`NIF: implausible string length ${len} at ${this.pos - 4}`);
    }
    let s = '';
    for (let i = 0; i < len; i++) s += String.fromCharCode(this.bytes[this.pos + i]);
    this.pos += len;
    return s;
  }
  vec2() {
    return [this.f32(), this.f32()];
  }
  vec3() {
    return [this.f32(), this.f32(), this.f32()];
  }
  vec4() {
    return [this.f32(), this.f32(), this.f32(), this.f32()];
  }
  mat33() {
    const m = new Float32Array(9);
    for (let i = 0; i < 9; i++) m[i] = this.f32();
    return m;
  }
  /** Record ref: int32 index, -1 for null. */
  ref() {
    return this.i32();
  }
  /** uint32 count + that many refs. */
  refList() {
    const n = this.u32();
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = this.ref();
    return out;
  }
  f32Array(n) {
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = this.f32();
    return out;
  }
  u16Array(n) {
    const out = new Uint16Array(n);
    for (let i = 0; i < n; i++) out[i] = this.u16();
    return out;
  }
}

// --- shared bases -----------------------------------------------------------

/** NIF key interpolation types. */
export const KEY_TYPE = Object.freeze({
  linear: 1,
  quadratic: 2,
  tbc: 3,
  xyz: 4,
  constant: 5,
});

/** NiTimeController base: chain link, timing, and the target it drives. */
function readTimeController(s, rec) {
  rec.next = s.ref();
  rec.flags = s.u16();
  rec.frequency = s.f32();
  rec.phase = s.f32();
  rec.startTime = s.f32();
  rec.stopTime = s.f32();
  rec.target = s.ref();
}

/**
 * KeyGroup<T> of `dim`-component float values: uint32 count, then (only
 * when count > 0) uint32 interpolation type and the keys. Quadratic keys
 * carry forward/backward tangents; TBC keys carry tension/continuity/bias.
 */
function readKeyGroup(s, dim) {
  const count = s.u32();
  const group = { type: 0, keys: [] };
  if (count === 0) return group;
  group.type = s.u32();
  const val = () => (dim === 1 ? s.f32() : s.f32Array(dim));
  for (let i = 0; i < count; i++) {
    const key = { time: s.f32(), value: val() };
    if (group.type === KEY_TYPE.quadratic) {
      key.forward = val();
      key.backward = val();
    } else if (group.type === KEY_TYPE.tbc) {
      key.tbc = [s.f32(), s.f32(), s.f32()];
    }
    group.keys.push(key);
  }
  return group;
}

/** NiObjectNET: name, extra-data chain head, controller chain head. */
function readObjectNET(s, rec) {
  rec.name = s.string();
  rec.extra = s.ref();
  rec.controller = s.ref();
}

/** transform + velocity + properties + optional bounding volume. */
function readAVObject(s, rec) {
  readObjectNET(s, rec);
  rec.flags = s.u16();
  rec.translation = s.vec3();
  rec.rotation = s.mat33();
  rec.scale = s.f32();
  rec.velocity = s.vec3();
  rec.properties = s.refList();
  rec.bounds = s.bool() ? readBoundingVolume(s) : null;
}

function readBoundingVolume(s) {
  const type = s.u32();
  if (type === 0) {
    return { type: 'sphere', center: s.vec3(), radius: s.f32() };
  }
  if (type === 1) {
    return { type: 'box', center: s.vec3(), axes: s.mat33(), extents: s.vec3() };
  }
  throw new Error(`NIF: unimplemented bounding volume type ${type}`);
}

function readNode(s, rec) {
  readAVObject(s, rec);
  rec.children = s.refList();
  rec.effects = s.refList();
}

/** Shared vertex payload of NiTriShapeData (4.0.0.2 flavor). */
function readGeometryData(s, rec) {
  rec.numVertices = s.u16();
  rec.vertices = s.bool() ? s.f32Array(rec.numVertices * 3) : null;
  rec.normals = s.bool() ? s.f32Array(rec.numVertices * 3) : null;
  rec.center = s.vec3();
  rec.radius = s.f32();
  rec.colors = s.bool() ? s.f32Array(rec.numVertices * 4) : null;
  // For 4.0.0.2 the full uint16 is the UV set count, gated by a has-UV bool.
  const declaredUVs = s.u16();
  const numUVs = s.bool() ? declaredUVs : 0;
  rec.uvSets = [];
  for (let i = 0; i < numUVs; i++) rec.uvSets.push(s.f32Array(rec.numVertices * 2));
}

// --- record registry --------------------------------------------------------

const READERS = {
  NiNode: readNode,
  RootCollisionNode: readNode,
  NiBSAnimationNode: readNode,
  NiBSParticleNode: readNode,
  AvoidNode: readNode,
  NiBillboardNode: readNode,

  NiTriShape(s, rec) {
    readAVObject(s, rec);
    rec.data = s.ref();
    rec.skin = s.ref();
  },

  NiTriShapeData(s, rec) {
    readGeometryData(s, rec);
    rec.numTriangles = s.u16();
    const numIndices = s.u32();
    rec.triangles = s.u16Array(numIndices);
    const numMatchGroups = s.u16();
    rec.matchGroups = [];
    for (let i = 0; i < numMatchGroups; i++) {
      rec.matchGroups.push(s.u16Array(s.u16()));
    }
  },

  NiSkinInstance(s, rec) {
    rec.data = s.ref();
    rec.skeletonRoot = s.ref();
    rec.bones = s.refList();
  },

  NiSkinData(s, rec) {
    rec.transform = { rotation: s.mat33(), translation: s.vec3(), scale: s.f32() };
    const numBones = s.u32();
    rec.partitions = s.ref(); // present at 4.0.0.2, -1 in practice
    rec.bones = [];
    for (let i = 0; i < numBones; i++) {
      const bone = {
        transform: { rotation: s.mat33(), translation: s.vec3(), scale: s.f32() },
        center: s.vec3(),
        radius: s.f32(),
        indices: null,
        weights: null,
      };
      const numVerts = s.u16();
      bone.indices = new Uint16Array(numVerts);
      bone.weights = new Float32Array(numVerts);
      for (let v = 0; v < numVerts; v++) {
        bone.indices[v] = s.u16();
        bone.weights[v] = s.f32();
      }
      rec.bones.push(bone);
    }
  },

  // --- properties ---
  NiMaterialProperty(s, rec) {
    readObjectNET(s, rec);
    rec.flags = s.u16();
    rec.ambient = s.vec3();
    rec.diffuse = s.vec3();
    rec.specular = s.vec3();
    rec.emissive = s.vec3();
    rec.glossiness = s.f32();
    rec.alpha = s.f32();
  },

  NiTexturingProperty(s, rec) {
    readObjectNET(s, rec);
    rec.flags = s.u16();
    rec.applyMode = s.u32();
    const count = s.u32();
    rec.textures = [];
    for (let i = 0; i < count; i++) {
      if (!s.bool()) {
        rec.textures.push(null);
        continue;
      }
      const tex = {
        source: s.ref(),
        clampMode: s.u32(),
        filterMode: s.u32(),
        uvSet: s.u32(),
        ps2L: s.i16(),
        ps2K: s.i16(),
        unknown: s.u16(),
      };
      if (i === TEX_SLOT.bump) {
        tex.lumaScale = s.f32();
        tex.lumaOffset = s.f32();
        tex.matrix = s.f32Array(4);
      }
      rec.textures.push(tex);
    }
  },

  NiSourceTexture(s, rec) {
    readObjectNET(s, rec);
    rec.external = s.u8() !== 0;
    if (rec.external) {
      rec.fileName = s.string();
      rec.pixelData = -1;
    } else {
      rec.unknownByte = s.u8();
      rec.pixelData = s.ref();
      rec.fileName = null;
    }
    rec.pixelLayout = s.u32();
    rec.useMipmaps = s.u32();
    rec.alphaFormat = s.u32();
    rec.isStatic = s.u8();
  },

  NiAlphaProperty(s, rec) {
    readObjectNET(s, rec);
    rec.flags = s.u16();
    rec.threshold = s.u8();
  },

  NiZBufferProperty(s, rec) {
    readObjectNET(s, rec);
    rec.flags = s.u16();
  },

  NiShadeProperty(s, rec) {
    readObjectNET(s, rec);
    rec.flags = s.u16();
  },

  NiDitherProperty(s, rec) {
    readObjectNET(s, rec);
    rec.flags = s.u16();
  },

  NiSpecularProperty(s, rec) {
    readObjectNET(s, rec);
    rec.flags = s.u16();
  },

  NiWireframeProperty(s, rec) {
    readObjectNET(s, rec);
    rec.flags = s.u16();
  },

  NiVertexColorProperty(s, rec) {
    readObjectNET(s, rec);
    rec.flags = s.u16();
    rec.vertexMode = s.u32();
    rec.lightingMode = s.u32();
  },

  NiStencilProperty(s, rec) {
    readObjectNET(s, rec);
    rec.flags = s.u16();
    rec.enabled = s.u8();
    rec.compareFunc = s.u32();
    rec.stencilRef = s.u32();
    rec.mask = s.u32();
    rec.failAction = s.u32();
    rec.zfailAction = s.u32();
    rec.zpassAction = s.u32();
    rec.drawMode = s.u32();
  },

  // --- extra data ---
  /** RULE 54's node, and the reason it must parse: the first-person
   *  camera tracks a bone named "Camera", so retail first-person
   *  SKELETONS carry a NiCamera - and an unimplemented record type is
   *  fatal to the whole file (a 4.0.0.2 NIF has no per-record sizes, so
   *  there is nothing to skip). Layout from nif.xml, gated to this
   *  version: `Unknown Short` and `Use Orthographic Projection` are
   *  ver1 10.1.0.0, `Unknown Int 2` is ver1 4.2.1.0 and `Unknown Int 3`
   *  is ver2 3.1 - none of the four exist at 4.0.0.2. */
  NiCamera(s, rec) {
    readAVObject(s, rec);
    rec.frustum = {
      left: s.f32(), right: s.f32(), top: s.f32(), bottom: s.f32(), near: s.f32(), far: s.f32(),
    };
    rec.viewport = { left: s.f32(), right: s.f32(), top: s.f32(), bottom: s.f32() };
    rec.lodAdjust = s.f32();
    rec.scene = s.ref();
    rec.screenPolygons = s.u32();
  },

  NiStringExtraData(s, rec) {
    rec.next = s.ref();
    rec.recordSize = s.u32();
    rec.string = s.string();
  },

  NiTextKeyExtraData(s, rec) {
    rec.next = s.ref();
    rec.recordSize = s.u32();
    const numKeys = s.u32();
    rec.keys = [];
    for (let i = 0; i < numKeys; i++) rec.keys.push({ time: s.f32(), text: s.string() });
  },

  // --- animation (slice 3) ---
  // NiSequenceStreamHelper is the root of an external .kf: its extra
  // chain holds the text keys then one NiStringExtraData per controller
  // naming the target bone; its controller chain holds the keyframe
  // controllers in the same order.
  NiSequenceStreamHelper(s, rec) {
    readObjectNET(s, rec);
  },

  NiKeyframeController(s, rec) {
    readTimeController(s, rec);
    rec.data = s.ref();
  },

  NiKeyframeData(s, rec) {
    const numRot = s.u32();
    rec.rotationType = 0;
    rec.rotationKeys = [];
    rec.xyzRotations = null;
    if (numRot > 0) {
      rec.rotationType = s.u32();
      if (rec.rotationType === KEY_TYPE.xyz) {
        // MW-era XYZ: axis order, then one float key group per axis.
        rec.axisOrder = s.u32();
        rec.xyzRotations = [readKeyGroup(s, 1), readKeyGroup(s, 1), readKeyGroup(s, 1)];
      } else {
        for (let i = 0; i < numRot; i++) {
          const key = { time: s.f32(), value: [s.f32(), s.f32(), s.f32(), s.f32()] }; // w,x,y,z
          if (rec.rotationType === KEY_TYPE.tbc) key.tbc = [s.f32(), s.f32(), s.f32()];
          rec.rotationKeys.push(key);
        }
      }
    }
    rec.translations = readKeyGroup(s, 3);
    rec.scales = readKeyGroup(s, 1);
  },
};

/** Texture slot indices inside NiTexturingProperty.textures. */
export const TEX_SLOT = Object.freeze({
  base: 0,
  dark: 1,
  detail: 2,
  gloss: 3,
  glow: 4,
  bump: 5,
  decal0: 6,
});

/**
 * Parse a Morrowind-era NIF file.
 * @param {Uint8Array} bytes
 * @returns {{version:number, records:object[], roots:number[]}}
 */
export function parseNif(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('parseNif expects a Uint8Array');
  const s = new NifStream(bytes);

  // Header line up to 0x0A. Cap the scan so binary junk fails fast.
  let nl = -1;
  for (let i = 0; i < Math.min(64, bytes.byteLength); i++) {
    if (bytes[i] === 0x0a) {
      nl = i;
      break;
    }
  }
  if (nl < 0) throw new Error('NIF: missing header line');
  let header = '';
  for (let i = 0; i < nl; i++) header += String.fromCharCode(bytes[i]);
  if (!header.startsWith('NetImmerse File Format')) {
    throw new Error(`NIF: bad header "${header}"`);
  }
  s.pos = nl + 1;

  const version = s.u32();
  if (version !== MW_NIF_VERSION) {
    throw new Error(
      `NIF: unsupported version 0x${version.toString(16)} (Morrowind 0x4000002 only)`,
    );
  }
  const recordCount = s.u32();
  const records = new Array(recordCount);
  for (let i = 0; i < recordCount; i++) {
    const type = s.string();
    const reader = READERS[type];
    if (!reader) {
      throw new Error(`NIF: unimplemented record type "${type}" (record ${i})`);
    }
    const rec = { type };
    reader(s, rec);
    records[i] = rec;
  }
  const roots = [];
  const rootCount = s.u32();
  for (let i = 0; i < rootCount; i++) roots.push(s.ref());
  if (s.pos !== bytes.byteLength) {
    throw new Error(`NIF: ${bytes.byteLength - s.pos} trailing bytes after footer`);
  }
  return { version, records, roots };
}

/**
 * Resolve a ref to its record, or null.
 * @param {{records:object[]}} nif @param {number} ref
 */
export function deref(nif, ref) {
  if (ref < 0) return null;
  const rec = nif.records[ref];
  if (!rec) throw new Error(`NIF: dangling ref ${ref}`);
  return rec;
}
