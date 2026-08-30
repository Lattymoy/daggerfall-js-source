// NetImmerse NIF reader for Morrowind-era files (version 4.0.0.2 only).
// Original implementation written against the niftools nifxml spec;
// OpenMW's components/nif used as behavioral reference only (GPL - no code
// ported). Scene graph, tri geometry, skinning data, render properties,
// extra data, keyframes, particles, lights and effects - the whole
// Morrowind-era registry.
//
// KNOWINGLY ABSENT, with the reason each cannot appear in a 4.0.0.2 file:
//   NiSkinPartition   - its SkinPartition struct is ver1 4.2.1.0, so the
//                       record has no body at this version.
//   NiAlphaAccumulator, NiClusterAccumulator, NiFltAnimationNode - OpenMW
//                       registers all three, but nif.xml declares no
//                       layout for any of them, and a guessed field list
//                       is worse than a named refusal.
// Anything else that throws is a real gap: the message names the type.
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
  u8Array(n) {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = this.u8();
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
function readKeyGroupOf(s, val) {
  const count = s.u32();
  const group = { type: 0, keys: [] };
  if (count === 0) return group;
  group.type = s.u32();
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

function readKeyGroup(s, dim) {
  return readKeyGroupOf(s, dim === 1 ? () => s.f32() : () => s.f32Array(dim));
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

/**
 * RULE 34's SET: every record type that runs NiNode::read, which is what
 * the rule is attached to. The five aliases OpenMW registers as plain
 * NiNode (AvoidNode, NiBSAnimationNode, NiBSParticleNode,
 * RootCollisionNode) or as NiNode subclasses (NiBillboardNode,
 * NiSwitchNode, NiLODNode, NiSortAdjustNode) all reach it;
 * NiTriShape and everything else do not, and the rule's own comment says
 * so: "Only for NiNode-s for now".
 */
const NI_NODE_TYPES = new Set([
  'NiNode', 'RootCollisionNode', 'NiBSAnimationNode', 'NiBSParticleNode',
  'AvoidNode', 'NiBillboardNode', 'NiSwitchNode', 'NiLODNode', 'NiSortAdjustNode',
]);

/**
 * RULE 34, and the doc marks it CRITICAL:
 *
 *   // Discard transformations for the root node, otherwise some meshes
 *   // occasionally get wrong orientation. Only for NiNode-s for now...
 *   if (mRecordIndex == 0 && !Misc::StringUtils::ciEqual(mName, "bip01"))
 *       mTransform = Nif::NiTransform::getIdentity();
 *                                              (nif/node.cpp:170-192)
 *
 * It happens IN THE PARSER, so every consumer - render loader, collision
 * loader, animation - sees identity and none of them can opt out. Two
 * halves, and a port that takes only one breaks the opposite half of the
 * data: applying the stored transform mis-orients every mesh whose
 * author left one on the root, and zeroing it UNCONDITIONALLY breaks
 * every skeleton whose root is named Bip01 - which is also why a Bip01
 * root survives as a real transform node and can be found by name later
 * (rule 56's accum root).
 *
 * RECORD INDEX 0, not "a root": the rule is indexed on the record's
 * position in the file, and the reference's own FIXME says so ("if node
 * 0 is *not* the only root node, this must not happen").
 */
function discardRootTransform(records) {
  const rec = records[0];
  if (!rec || !NI_NODE_TYPES.has(rec.type)) return;
  if (String(rec.name || '').toLowerCase() === 'bip01') return;
  rec.translation = [0, 0, 0];
  rec.rotation = Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  rec.scale = 1;
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

/**
 * NiExtraData base at 4.0.0.2: the chain link and the byte count the
 * exporter wrote for the payload. `Name` is ver1 10.0.1.0 and the inline
 * ByteArray is ver2 3.3.0.13, so neither exists here.
 */
function readExtraData(s, rec) {
  rec.next = s.ref();
  rec.recordSize = s.u32();
}

/**
 * NiDynamicEffect: an AV object plus the nodes the effect reaches. At
 * exactly 4.0.0.2 the list is raw uint32 pointers (nif.xml gates the ref
 * form to ver2 3.3.0.13 and the ver1 10.1.0.0 re-declaration above us);
 * they are kept as written, not dereferenced.
 */
function readDynamicEffect(s, rec) {
  readAVObject(s, rec);
  const count = s.u32();
  rec.affectedNodePointers = new Array(count);
  for (let i = 0; i < count; i++) rec.affectedNodePointers[i] = s.u32();
}

/** NiLight: a dynamic effect plus the three colour terms and the dimmer. */
function readLight(s, rec) {
  readDynamicEffect(s, rec);
  rec.dimmer = s.f32();
  rec.ambient = s.vec3();
  rec.diffuse = s.vec3();
  rec.specular = s.vec3();
}

/** NiPointLight/NiSpotLight share the three attenuation terms. */
function readPointLight(s, rec) {
  readLight(s, rec);
  rec.constantAttenuation = s.f32();
  rec.linearAttenuation = s.f32();
  rec.quadraticAttenuation = s.f32();
}

/** NiParticleModifier base: the next modifier and the controller pointer. */
function readParticleModifier(s, rec) {
  rec.next = s.ref();
  rec.controller = s.ref();
}

/** NiParticleCollider base: the modifier chain plus the bounce term. */
function readParticleCollider(s, rec) {
  readParticleModifier(s, rec);
  rec.bounce = s.f32();
}

/** NiPlane: normal + constant, shared by the collider and the effect. */
function readPlane(s) {
  return { normal: s.vec3(), constant: s.f32() };
}

/**
 * NiParticlesData: the geometry payload plus the per-particle arrays.
 * `Num Particles` is ver2 4.0.0.2 and `Particle Radius` ver2 10.0.1.0, so
 * both are present here; the radii/rotations/rotation-angle arrays are all
 * ver1 10.0.1.0 or later and are not.
 */
function readParticlesData(s, rec) {
  readGeometryData(s, rec);
  rec.numParticles = s.u16();
  rec.particleRadius = s.f32();
  rec.numActive = s.u16();
  rec.sizes = s.bool() ? s.f32Array(rec.numVertices) : null;
}

/**
 * NiParticleSystemController's body, shared verbatim by NiBSPArrayController
 * (which adds no fields of its own). The ver2 3.1 legacy fields and the
 * ver1 10.x replacements are both outside 4.0.0.2.
 */
function readParticleSystemController(s, rec) {
  readTimeController(s, rec);
  rec.speed = s.f32();
  rec.speedVariation = s.f32();
  rec.declination = s.f32();
  rec.declinationVariation = s.f32();
  rec.planarAngle = s.f32();
  rec.planarAngleVariation = s.f32();
  rec.initialNormal = s.vec3();
  rec.initialColor = s.vec4();
  rec.initialSize = s.f32();
  rec.emitStartTime = s.f32();
  rec.emitStopTime = s.f32();
  rec.resetParticleSystem = s.u8();
  rec.birthRate = s.f32();
  rec.lifetime = s.f32();
  rec.lifetimeVariation = s.f32();
  rec.useBirthRate = s.u8();
  rec.spawnOnDeath = s.u8();
  rec.emitterDimensions = s.vec3();
  rec.emitter = s.ref();
  rec.numSpawnGenerations = s.u16();
  rec.percentageSpawned = s.f32();
  rec.spawnMultiplier = s.u16();
  rec.spawnSpeedChaos = s.f32();
  rec.spawnDirChaos = s.f32();
  const numParticles = s.u16();
  rec.numValid = s.u16();
  rec.particles = [];
  for (let i = 0; i < numParticles; i++) {
    rec.particles.push({
      velocity: s.vec3(),
      rotationAxis: s.vec3(),
      age: s.f32(),
      lifeSpan: s.f32(),
      lastUpdate: s.f32(),
      spawnGeneration: s.u16(),
      code: s.u16(),
    });
  }
  rec.emitterModifier = s.ref();
  rec.particleModifier = s.ref();
  rec.particleCollider = s.ref();
  rec.staticTargetBound = s.u8();
}

/**
 * NiBoneLODController's body, shared by NiBSBoneLODController. The shape
 * groups are ver1 4.2.2.0 and absent here. Note the file writes THREE
 * counts but only `Num LODs` node groups follow.
 */
function readBoneLODController(s, rec) {
  readTimeController(s, rec);
  rec.lod = s.u32();
  const numLODs = s.u32();
  rec.numNodeGroups = s.u32();
  rec.nodeGroups = [];
  for (let i = 0; i < numLODs; i++) rec.nodeGroups.push(s.refList());
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

  // --- MW-D9e: the rest of the Morrowind-era registry ---
  // Every layout below is nif.xml gated to 4.0.0.2 the same way NiCamera
  // was. They are here because a 4.0.0.2 record carries no size, so ONE
  // unknown type kills the whole file - a mesh that merely contains a
  // particle emitter or a light took the skeleton down with it.

  // Nodes.
  NiCollisionSwitch: readNode,

  NiSwitchNode(s, rec) {
    readNode(s, rec);
    rec.index = s.u32();
  },

  // NiLODNode inherits NiSwitchNode, so the switch index comes first.
  // `LOD Center` is ver1 exactly 4.0.0.2; the NiLODData ref that replaces
  // the inline levels is ver1 10.1.0.0.
  NiLODNode(s, rec) {
    readNode(s, rec);
    rec.index = s.u32();
    rec.lodCenter = s.vec3();
    const count = s.u32();
    rec.lodLevels = [];
    for (let i = 0; i < count; i++) rec.lodLevels.push({ near: s.f32(), far: s.f32() });
  },

  NiSortAdjustNode(s, rec) {
    readNode(s, rec);
    rec.sortingMode = s.u32();
    rec.accumulator = s.ref();
  },

  // Geometry siblings of NiTriShape.
  NiTriStrips(s, rec) {
    readAVObject(s, rec);
    rec.data = s.ref();
    rec.skin = s.ref();
  },

  // `Has Points` is ver1 10.0.1.3: here the point lists always follow.
  NiTriStripsData(s, rec) {
    readGeometryData(s, rec);
    rec.numTriangles = s.u16();
    const numStrips = s.u16();
    rec.stripLengths = s.u16Array(numStrips);
    rec.strips = [];
    for (let i = 0; i < numStrips; i++) rec.strips.push(s.u16Array(rec.stripLengths[i]));
  },

  NiLines(s, rec) {
    readAVObject(s, rec);
    rec.data = s.ref();
    rec.skin = s.ref();
  },

  NiLinesData(s, rec) {
    readGeometryData(s, rec);
    rec.lines = new Uint8Array(rec.numVertices);
    for (let i = 0; i < rec.numVertices; i++) rec.lines[i] = s.bool() ? 1 : 0;
  },

  // Particle geometry. All three carry the same AV-object + data/skin pair.
  NiParticles(s, rec) {
    readAVObject(s, rec);
    rec.data = s.ref();
    rec.skin = s.ref();
  },

  NiAutoNormalParticles(s, rec) {
    readAVObject(s, rec);
    rec.data = s.ref();
    rec.skin = s.ref();
  },

  NiRotatingParticles(s, rec) {
    readAVObject(s, rec);
    rec.data = s.ref();
    rec.skin = s.ref();
  },

  NiParticlesData: readParticlesData,
  NiAutoNormalParticlesData: readParticlesData,

  // `Rotations 2` is ver2 4.2.2.0, so the quaternion array is read here.
  NiRotatingParticlesData(s, rec) {
    readParticlesData(s, rec);
    rec.rotations = s.bool() ? s.f32Array(rec.numVertices * 4) : null;
  },

  // Particle modifiers and colliders.
  NiGravity(s, rec) {
    readParticleModifier(s, rec);
    rec.decay = s.f32();
    rec.force = s.f32();
    rec.fieldType = s.u32();
    rec.position = s.vec3();
    rec.direction = s.vec3();
  },

  // `Symmetry Type` is ver1 4.1.0.12 - one version past this file.
  NiParticleBomb(s, rec) {
    readParticleModifier(s, rec);
    rec.decay = s.f32();
    rec.duration = s.f32();
    rec.deltaV = s.f32();
    rec.start = s.f32();
    rec.decayType = s.u32();
    rec.position = s.vec3();
    rec.direction = s.vec3();
  },

  NiParticleColorModifier(s, rec) {
    readParticleModifier(s, rec);
    rec.colorData = s.ref();
  },

  NiParticleGrowFade(s, rec) {
    readParticleModifier(s, rec);
    rec.grow = s.f32();
    rec.fade = s.f32();
  },

  NiParticleRotation(s, rec) {
    readParticleModifier(s, rec);
    rec.randomInitialAxis = s.u8();
    rec.initialAxis = s.vec3();
    rec.rotationSpeed = s.f32();
  },

  NiPlanarCollider(s, rec) {
    readParticleCollider(s, rec);
    rec.height = s.f32();
    rec.width = s.f32();
    rec.position = s.vec3();
    rec.xVector = s.vec3();
    rec.yVector = s.vec3();
    rec.plane = readPlane(s);
  },

  NiSphericalCollider(s, rec) {
    readParticleCollider(s, rec);
    rec.radius = s.f32();
    rec.position = s.vec3();
  },

  NiParticleSystemController: readParticleSystemController,
  NiBSPArrayController: readParticleSystemController,

  // Controllers. Every one below is a NiTimeController plus its own tail.
  NiAlphaController(s, rec) {
    readTimeController(s, rec);
    rec.data = s.ref();
  },

  NiMaterialColorController(s, rec) {
    readTimeController(s, rec);
    rec.data = s.ref();
  },

  NiVisController(s, rec) {
    readTimeController(s, rec);
    rec.data = s.ref();
  },

  NiRollController(s, rec) {
    readTimeController(s, rec);
    rec.data = s.ref();
  },

  NiLightColorController(s, rec) {
    readTimeController(s, rec);
    rec.data = s.ref();
  },

  // The one controller with no tail at all.
  NiLightRadiusController: readTimeController,

  // `Accum Time` is ver1 3.3.0.13 / ver2 10.1.0.103 - present here.
  NiFlipController(s, rec) {
    readTimeController(s, rec);
    rec.textureSlot = s.u32();
    rec.accumTime = s.f32();
    rec.delta = s.f32();
    rec.sources = s.refList();
  },

  // `Always Update` is ver1 exactly 4.0.0.2: this file is the first that
  // carries it, and the morpher flags that precede it are ver1 10.0.1.2.
  NiGeomMorpherController(s, rec) {
    readTimeController(s, rec);
    rec.data = s.ref();
    rec.alwaysUpdate = s.u8();
  },

  NiUVController(s, rec) {
    readTimeController(s, rec);
    rec.textureSet = s.u16();
    rec.data = s.ref();
  },

  NiLookAtController(s, rec) {
    readTimeController(s, rec);
    rec.lookAt = s.ref();
  },

  NiPathController(s, rec) {
    readTimeController(s, rec);
    rec.bankDir = s.i32();
    rec.maxBankAngle = s.f32();
    rec.smoothing = s.f32();
    rec.followAxis = s.i16();
    rec.pathData = s.ref();
    rec.percentData = s.ref();
  },

  NiBoneLODController: readBoneLODController,
  NiBSBoneLODController: readBoneLODController,

  // Animation data.
  NiFloatData(s, rec) {
    rec.data = readKeyGroup(s, 1);
  },

  NiPosData(s, rec) {
    rec.data = readKeyGroup(s, 3);
  },

  NiColorData(s, rec) {
    rec.data = readKeyGroup(s, 4);
  },

  NiBoolData(s, rec) {
    rec.data = readKeyGroupOf(s, () => s.u8());
  },

  NiUVData(s, rec) {
    rec.groups = [
      readKeyGroup(s, 1),
      readKeyGroup(s, 1),
      readKeyGroup(s, 1),
      readKeyGroup(s, 1),
    ];
  },

  // NOT a KeyGroup: NiVisData writes the count and the keys with no
  // interpolation word between them, and each value is one byte.
  NiVisData(s, rec) {
    const count = s.u32();
    rec.keys = [];
    for (let i = 0; i < count; i++) rec.keys.push({ time: s.f32(), value: s.u8() });
  },

  // Morph, unlike KeyGroup, writes its interpolation type even when the
  // key count is zero.
  NiMorphData(s, rec) {
    const numMorphs = s.u32();
    rec.numVertices = s.u32();
    rec.relativeTargets = s.u8();
    rec.morphs = [];
    for (let i = 0; i < numMorphs; i++) {
      const count = s.u32();
      const type = s.u32();
      const keys = [];
      for (let k = 0; k < count; k++) {
        const key = { time: s.f32(), value: s.f32() };
        if (type === KEY_TYPE.quadratic) {
          key.forward = s.f32();
          key.backward = s.f32();
        } else if (type === KEY_TYPE.tbc) {
          key.tbc = [s.f32(), s.f32(), s.f32()];
        }
        keys.push(key);
      }
      rec.morphs.push({ keys: { type, keys }, vectors: s.f32Array(rec.numVertices * 3) });
    }
  },

  // EXACTLY `numEntries` RGBA entries. nif.xml says the array is 16 long
  // when the count reads 16 and 256 otherwise, which is a rule about what
  // exporters happen to write, not about the bytes; OpenMW reads the
  // count and that is what the retail files hold.
  NiPalette(s, rec) {
    rec.hasAlpha = s.u8();
    rec.numEntries = s.u32();
    rec.palette = s.u8Array(rec.numEntries * 4);
  },

  // NiPixelData inherits NiPixelFormat, whose 4.0.0.2 face is the mask
  // block and the 8-byte compare field.
  NiPixelData(s, rec) {
    rec.pixelFormat = s.u32();
    rec.redMask = s.u32();
    rec.greenMask = s.u32();
    rec.blueMask = s.u32();
    rec.alphaMask = s.u32();
    rec.bitsPerPixel = s.u32();
    rec.oldFastCompare = s.u8Array(8);
    rec.palette = s.ref();
    const numMipmaps = s.u32();
    rec.bytesPerPixel = s.u32();
    rec.mipmaps = [];
    for (let i = 0; i < numMipmaps; i++) {
      rec.mipmaps.push({ width: s.u32(), height: s.u32(), offset: s.u32() });
    }
    rec.pixels = s.u8Array(s.u32());
  },

  // Lights and effects.
  NiAmbientLight: readLight,
  NiDirectionalLight: readLight,
  NiPointLight: readPointLight,

  NiSpotLight(s, rec) {
    readPointLight(s, rec);
    rec.outerSpotAngle = s.f32();
    rec.exponent = s.f32();
  },

  // `Unknown Short` is ver2 4.1.0.12 and the PS2 pair ver2 10.2.0.0, so
  // all three are read here.
  NiTextureEffect(s, rec) {
    readDynamicEffect(s, rec);
    rec.modelProjectionMatrix = s.mat33();
    rec.modelProjectionTranslation = s.vec3();
    rec.textureFiltering = s.u32();
    rec.textureClamping = s.u32();
    rec.textureType = s.u32();
    rec.coordinateGenerationType = s.u32();
    rec.sourceTexture = s.ref();
    rec.enablePlane = s.u8();
    rec.plane = readPlane(s);
    rec.ps2L = s.i16();
    rec.ps2K = s.i16();
    rec.unknown = s.u16();
  },

  NiFogProperty(s, rec) {
    readObjectNET(s, rec);
    rec.flags = s.u16();
    rec.fogDepth = s.f32();
    rec.fogColor = s.vec3();
  },

  // Extra data. The BARE NiExtraData carries `recordSize` opaque bytes
  // after the count - the subclasses spend those bytes on their own
  // fields instead.
  NiExtraData(s, rec) {
    readExtraData(s, rec);
    rec.data = s.u8Array(rec.recordSize);
  },

  NiVertWeightsExtraData(s, rec) {
    readExtraData(s, rec);
    rec.weights = s.f32Array(s.u16());
  },

  NiBinaryExtraData(s, rec) {
    readExtraData(s, rec);
    rec.data = s.u8Array(s.u32());
  },

  NiBooleanExtraData(s, rec) {
    readExtraData(s, rec);
    rec.booleanData = s.u8();
  },

  NiIntegerExtraData(s, rec) {
    readExtraData(s, rec);
    rec.integerData = s.u32();
  },

  NiVectorExtraData(s, rec) {
    readExtraData(s, rec);
    rec.vectorData = s.vec4();
  },

  NiStringsExtraData(s, rec) {
    readExtraData(s, rec);
    const count = s.u32();
    rec.strings = [];
    for (let i = 0; i < count; i++) rec.strings.push(s.string());
  },

  // `Accum Root Name` and the text-key ref are ver2 10.1.0.103; the
  // interpolator half of a controlled block is ver1 10.1.0.106.
  NiSequence(s, rec) {
    rec.name = s.string();
    rec.accumRootName = s.string();
    rec.textKeys = s.ref();
    const count = s.u32();
    rec.blocks = [];
    for (let i = 0; i < count; i++) {
      rec.blocks.push({ targetName: s.string(), controller: s.ref() });
    }
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
    const at = s.pos;
    try {
      reader(s, rec);
    } catch (err) {
      // A 4.0.0.2 stream has no record sizes, so the FIRST record that
      // reads the wrong number of bytes is the only one worth naming -
      // everything after it is noise. Say which one and where.
      throw new Error(`NIF: record ${i} "${type}" at byte ${at}: ${err.message}`);
    }
    records[i] = rec;
  }
  discardRootTransform(records);
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
