// A MORROWIND NIF, WRITTEN - the portable half of tools/nifWrite.mjs, moved here so the game
// can write one in the browser: our own scabbards and sheathing bones are built at runtime (systems/ownSheathing.js).
// The tool re-exports every name below, so each bake writes the bytes it always did. The record writers are keyed as
// mwNifFile.js's READERS are, and follow the reader's field order exactly; the pins parse what this writes.

import { MW_NIF_VERSION } from './mwNifFile.js'; // the reader's own: the one version either side takes

export { MW_NIF_VERSION };
export const NIF_HEADER_LINE = 'NetImmerse File Format, Version 4.0.0.2\n';

/** A little-endian byte builder whose methods are the reader's, one for one. */
export class NifOut {
  constructor() {
    this.bytes = new Uint8Array(1024);
    this.view = new DataView(this.bytes.buffer);
    this.length = 0;
  }
  _room(n) {
    if (this.length + n <= this.bytes.length) return;
    let size = this.bytes.length * 2;
    while (size < this.length + n) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.bytes.subarray(0, this.length));
    this.bytes = next;
    this.view = new DataView(next.buffer);
  }
  _push(buf) {
    this._room(buf.length);
    this.bytes.set(buf, this.length);
    this.length += buf.length;
    return this;
  }
  _num(size, set, value) {
    this._room(size);
    set.call(this.view, this.length, value, true);
    this.length += size;
    return this;
  }
  u8(value) {
    this._room(1);
    this.bytes[this.length++] = value & 0xff;
    return this;
  }
  u16(value) {
    return this._num(2, DataView.prototype.setUint16, value);
  }
  i16(value) {
    return this._num(2, DataView.prototype.setInt16, value);
  }
  u32(value) {
    return this._num(4, DataView.prototype.setUint32, value);
  }
  i32(value) {
    return this._num(4, DataView.prototype.setInt32, value);
  }
  f32(value) {
    return this._num(4, DataView.prototype.setFloat32, value);
  }
  /** The 32-bit bool this version uses everywhere. */
  bool(value) {
    return this.u32(value ? 1 : 0);
  }
  /** uint32 length + latin1 bytes. */
  string(text) {
    const bytes = latin1Bytes(text);
    return this.u32(bytes.length)._push(bytes);
  }
  vec3(value) {
    return this.f32(value[0]).f32(value[1]).f32(value[2]);
  }
  mat33(matrix) {
    for (let i = 0; i < 9; i++) this.f32(matrix[i]);
    return this;
  }
  /** A record ref: an int32 index, -1 for null. */
  ref(value) {
    return this.i32(value ?? -1);
  }
  refList(list) {
    this.u32(list.length);
    for (const entry of list) this.ref(entry);
    return this;
  }
  f32Array(a) {
    for (const value of a) this.f32(value);
    return this;
  }
  u16Array(a) {
    for (const value of a) this.u16(value);
    return this;
  }
  /** The bytes written, as a Uint8Array of their own. */
  toBytes() {
    return this.bytes.slice(0, this.length);
  }
}

/** A string's latin1 bytes: each UTF-16 unit's low byte, as Node's 'latin1' encoding writes it. */
export function latin1Bytes(text) {
  const str = String(text ?? '');
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
  return out;
}

const IDENTITY3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** NiObjectNET: name, extra-data chain head, controller chain head. */
const objectNET = (out, { name = '', extra = -1, controller = -1 }) => out.string(name).ref(extra).ref(controller);

/** NiAVObject: the transform, the velocity, the properties, and the bounding volume this writer never emits (the
 *  reference treats a missing one as "no bound", which is what a first-person part wants). */
function avObject(out, rec) {
  objectNET(out, rec);
  out.u16(rec.flags ?? 0);
  out.vec3(rec.translation ?? [0, 0, 0]);
  out.mat33(rec.rotation ?? IDENTITY3);
  out.f32(rec.scale ?? 1);
  out.vec3(rec.velocity ?? [0, 0, 0]);
  out.refList(rec.properties ?? []);
  out.bool(false);
}

/** The record writers, keyed exactly as mwNifFile.js's READERS are. */
export const WRITERS = {
  NiNode(out, rec) {
    avObject(out, rec);
    out.refList(rec.children ?? []);
    out.refList(rec.effects ?? []);
  },

  NiTriShape(out, rec) {
    avObject(out, rec);
    out.ref(rec.data);
    out.ref(rec.skin ?? -1);
  },

  NiTriShapeData(out, rec) {
    const n = rec.positions.length / 3;
    if (n > 0xffff) throw new Error(`${n} vertices will not fit NiTriShapeData's uint16 count`);
    out.u16(n);
    out.bool(true).f32Array(rec.positions);
    if (rec.normals) out.bool(true).f32Array(rec.normals);
    else out.bool(false);
    // The bounding sphere the exporter is expected to have computed. `flattenNif` does not read it, but a file that
    // lies about its own bounds is a file that lies, so it is computed rather than zeroed.
    const { center, radius } = boundingSphere(rec.positions);
    out.vec3(center).f32(radius);
    out.bool(false); // no vertex colours
    // At 4.0.0.2 the uv-set COUNT is a uint16 and a separate bool gates whether any are written at all.
    out.u16(rec.uvs ? 1 : 0).bool(!!rec.uvs);
    if (rec.uvs) out.f32Array(rec.uvs);
    const tris = rec.indices.length / 3;
    if (tris > 0xffff) throw new Error(`${tris} triangles will not fit the uint16 count`);
    out.u16(tris);
    out.u32(rec.indices.length);
    out.u16Array(rec.indices);
    out.u16(0); // no match groups
  },

  NiMaterialProperty(out, rec) {
    objectNET(out, rec);
    out.u16(rec.flags ?? 1);
    out.vec3(rec.ambient ?? [1, 1, 1]);
    out.vec3(rec.diffuse ?? [1, 1, 1]);
    out.vec3(rec.specular ?? [0, 0, 0]);
    out.vec3(rec.emissive ?? [0, 0, 0]);
    out.f32(rec.glossiness ?? 0);
    out.f32(rec.alpha ?? 1);
  },

  NiTexturingProperty(out, rec) {
    objectNET(out, rec);
    out.u16(rec.flags ?? 0);
    out.u32(rec.applyMode ?? 2); // APPLY_MODULATE
    const slots = rec.textures ?? [];
    out.u32(slots.length);
    slots.forEach((tex, i) => {
      if (!tex) {
        out.bool(false);
        return;
      }
      out.bool(true);
      out.ref(tex.source)
        .u32(tex.clampMode ?? 3)
        .u32(tex.filterMode ?? 2)
        .u32(tex.uvSet ?? 0);
      out.i16(0).i16(-75).u16(0); // ps2L, ps2K, unknown: the exporter's constants
      // The bump slot alone carries the luma pair and a 2x2 matrix.
      if (i === 5) out.f32(1).f32(0).f32Array([1, 0, 0, 1]);
    });
  },

  NiSourceTexture(out, rec) {
    objectNET(out, rec);
    out.u8(1); // external
    out.string(rec.fileName);
    out.u32(rec.pixelLayout ?? 5)
      .u32(rec.useMipmaps ?? 2)
      .u32(rec.alphaFormat ?? 3)
      .u8(rec.isStatic ?? 1);
  },

  NiStencilProperty(out, rec) {
    objectNET(out, rec);
    out.u16(rec.flags ?? 0);
    out.u8(rec.enabled ?? 0);
    out.u32(rec.compareFunc ?? 0)
      .u32(rec.stencilRef ?? 0)
      .u32(rec.mask ?? 0xffffffff);
    out.u32(rec.failAction ?? 0)
      .u32(rec.zfailAction ?? 0)
      .u32(rec.zpassAction ?? 0);
    out.u32(rec.drawMode ?? 0);
  },

  // A SKIN. The reader's field order exactly (mwNifFile.js NiSkinInstance / NiSkinData): the instance
  // names its data, its skeleton root and its bones; the data carries the skin's own transform, the bone count, the
  // 4.0.0.2 partition ref, and per bone its inverse bind, a bounding sphere and its (vertex, weight) list.
  NiSkinInstance(out, rec) {
    out.ref(rec.data);
    out.ref(rec.skeletonRoot ?? -1);
    out.refList(rec.bones ?? []);
  },

  // AN EXTERNAL .KF. The helper is a bare NiObjectNET whose extra chain is the text keys and then one bone
  // name per controller, and whose controller chain is the keyframe controllers in the same order.
  NiSequenceStreamHelper(out, rec) {
    objectNET(out, rec);
  },

  NiStringExtraData(out, rec) {
    out.ref(rec.next ?? -1);
    out.u32(rec.recordSize ?? 4 + latin1Bytes(rec.string).length);
    out.string(rec.string);
  },

  NiTextKeyExtraData(out, rec) {
    out.ref(rec.next ?? -1);
    out.u32(rec.recordSize ?? 0);
    out.u32(rec.keys.length);
    for (const k of rec.keys) out.f32(k.time).string(k.text);
  },

  NiKeyframeController(out, rec) {
    out.ref(rec.next ?? -1)
      .u16(rec.flags ?? 8)
      .f32(rec.frequency ?? 1)
      .f32(rec.phase ?? 0);
    out.f32(rec.startTime ?? 0)
      .f32(rec.stopTime ?? 0)
      .ref(rec.target ?? -1);
    out.ref(rec.data);
  },

  NiKeyframeData(out, rec) {
    const rot = rec.rotationKeys ?? [];
    out.u32(rot.length);
    if (rot.length) {
      if ((rec.rotationType ?? 1) === 4) throw new Error('NiKeyframeData: XYZ rotation keys are not written');
      out.u32(rec.rotationType ?? 1);
      for (const k of rot) {
        out.f32(k.time).f32Array(k.value);
        if ((rec.rotationType ?? 1) === 3) out.f32Array(k.tbc);
      }
    }
    keyGroup(out, rec.translations, 3);
    keyGroup(out, rec.scales, 1);
  },

  // A bow's limbs and string - the reader's NiGeomMorpherController and NiMorphData.
  NiGeomMorpherController(out, rec) {
    out.ref(rec.next ?? -1)
      .u16(rec.flags ?? 8)
      .f32(rec.frequency ?? 1)
      .f32(rec.phase ?? 0);
    out.f32(rec.startTime ?? 0)
      .f32(rec.stopTime ?? 0)
      .ref(rec.target ?? -1);
    out.ref(rec.data).u8(rec.alwaysUpdate ?? 0);
  },

  NiMorphData(out, rec) {
    out.u32(rec.morphs.length)
      .u32(rec.numVertices)
      .u8(rec.relativeTargets ?? 1);
    for (const morph of rec.morphs) {
      const keys = morph.keys?.keys ?? [];
      const type = morph.keys?.type ?? 1;
      out.u32(keys.length).u32(type);
      for (const k of keys) {
        out.f32(k.time).f32(k.value);
        if (type === 2) out.f32(k.inTan).f32(k.outTan);
        else if (type === 3) out.f32Array(k.tbc);
      }
      out.f32Array(morph.vectors);
    }
  },

  NiSkinData(out, rec) {
    const skinTransform = rec.transform ?? {};
    out.mat33(skinTransform.rotation ?? IDENTITY3)
      .vec3(skinTransform.translation ?? [0, 0, 0])
      .f32(skinTransform.scale ?? 1);
    out.u32(rec.bones.length);
    out.ref(rec.partitions ?? -1);
    for (const b of rec.bones) {
      const boneTransform = b.transform ?? {};
      out.mat33(boneTransform.rotation ?? IDENTITY3)
        .vec3(boneTransform.translation ?? [0, 0, 0])
        .f32(boneTransform.scale ?? 1);
      out.vec3(b.center ?? [0, 0, 0]).f32(b.radius ?? 0);
      out.u16(b.indices.length);
      for (let value = 0; value < b.indices.length; value++) out.u16(b.indices[value]).f32(b.weights[value]);
    }
  },
};

/** A KeyGroup<T> as the reader takes it (mwNifFile.js readKeyGroupOf): the count, then - only when there
 *  are keys - the interpolation type and the keys. `dim` is 1 for a float group, 3 for a vector. */
function keyGroup(out, group, dim) {
  const keys = group?.keys ?? [];
  out.u32(keys.length);
  if (!keys.length) return;
  const type = group.type ?? 1;
  out.u32(type);
  const val = (value) => (dim === 1 ? out.f32(value) : out.f32Array(value));
  for (const k of keys) {
    out.f32(k.time);
    val(k.value);
    if (type === 2) {
      val(k.inTan);
      val(k.outTan);
    } else if (type === 3) out.f32Array(k.tbc);
  }
}

/** The sphere the exporter writes beside the vertices. */
export function boundingSphere(positions) {
  const n = positions.length / 3;
  if (!n) return { center: [0, 0, 0], radius: 0 };
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], positions[i + k]);
      max[k] = Math.max(max[k], positions[i + k]);
    }
  }
  const center = [0, 1, 2].map((k) => (min[k] + max[k]) / 2);
  let radius = 0;
  for (let i = 0; i < positions.length; i += 3) {
    radius = Math.max(
      radius,
      Math.hypot(positions[i] - center[0], positions[i + 1] - center[1], positions[i + 2] - center[2]),
    );
  }
  return { center, radius };
}

/** The container: header line, version, record count, the records, then the root footer. `records` is
 *  `[{ type, ...fields }]` and `roots` is indices into it. Answers a Uint8Array. */
export function writeNifBytes(records, roots = [0]) {
  const out = new NifOut();
  out._push(latin1Bytes(NIF_HEADER_LINE));
  out.u32(MW_NIF_VERSION);
  out.u32(records.length);
  for (const rec of records) {
    const writer = WRITERS[rec.type];
    if (!writer) throw new Error(`no NIF writer for record type "${rec.type}"`);
    out.string(rec.type);
    writer(out, rec);
  }
  out.u32(roots.length);
  for (const root of roots) out.ref(root);
  return out.toBytes();
}
