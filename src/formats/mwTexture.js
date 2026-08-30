// MW-D11: THE TEXTURE PATH LAW, and it is not "prepend textures/".
//
// Bethesda converted the BSA textures from TGA to DDS and left every
// reference in every NIF saying .tga, so a Morrowind mesh asks for a file
// that is not in the archive under that name. OpenMW's answer is one
// function - Misc::ResourceHelpers::correctTexturePath, the ONLY entry
// point a NIF texture takes (nifosg/nifloader.cpp:1136-1142) - and it is
// four probes over a re-rooted, extension-swapped path, translated here
// verbatim.
//
//   correctTexturePath(p, vfs) = correctResourcePath({textures, bookart}, p, vfs, "dds")
//                                       (misc/resourcehelpers.cpp:137-141)
//
// THIS FILE IS THE ONE HOME. The mesh viewer carried its own two-line
// version (a "textures\" prefix and a .tga->.dds swap) which gets three
// of the rules wrong; it imports this now. Two ports of one rule drifting
// apart is how MW7 died.

import { decodeDds } from './mwDdsFile.js';

/** VFS::Path normalization (vfs/pathutil.hpp:18-64): backslash becomes
 *  '/', every character lowercases, runs of '/' collapse to one, and a
 *  SINGLE leading '/' is stripped. A BSA index must be built the same way
 *  or the lookups miss - VFS::Manager::exists is a plain hash lookup with
 *  no case-insensitive compare at query time (vfs/manager.cpp:64-72). */
export function normalizeVfsPath(path) {
  let out = String(path ?? '').replace(/\\/g, '/').toLowerCase();
  out = out.replace(/\/{2,}/g, '/');
  if (out.startsWith('/')) out = out.slice(1);
  return out;
}

/**
 * findDirectory (misc/resourcehelpers.cpp:38-62), and every clause earns
 * its place:
 *   - the match must be a WHOLE path component: preceded by '/' or at
 *     index 0, and followed by '/';
 *   - it must NOT be the last component (`position + size >= pathSize`
 *     returns npos), so "foo/textures" is not re-rooted and "textures"
 *     alone is not either - both get the prefix instead. THIS CLAUSE IS
 *     AN EARLY-OUT, NOT A RULE OF ITS OWN: with it removed the very next
 *     test reads one past the end (a std::string yields '\0' there, and
 *     JS yields undefined), which is not '/', so the component check
 *     fails anyway. A mutation campaign proved the two equivalent - kept
 *     because the reference has it and this is a translation, and
 *     recorded so nobody hunts for the pin that would catch its removal;
 *   - the scan continues past a failed candidate rather than giving up.
 * @returns the index the corrected path starts at, or -1.
 */
export function findDirectory(path, directory) {
  const size = directory.length;
  let offset = 0;
  for (;;) {
    const pos = path.indexOf(directory, offset);
    if (pos < 0) return -1;
    if (pos + size >= path.length) return -1;
    if ((pos === 0 || path[pos - 1] === '/') && path[pos + size] === '/') return pos;
    offset = pos + size;
  }
}

/**
 * Normalized::changeExtension (vfs/pathutil.hpp:289-297). Replaces from
 * one character PAST the last '.', so the dot survives - and REFUSES when
 * the reverse scan hits a '/' first or finds no '.' at all, which is what
 * makes an extensionless name keep its shape.
 * @returns {{path:string, changed:boolean}}
 */
export function changeExtension(path, ext) {
  for (let i = path.length - 1; i >= 0; i--) {
    if (path[i] === '/') break;
    if (path[i] === '.') return { path: `${path.slice(0, i + 1)}${ext}`, changed: true };
  }
  return { path, changed: false };
}

/** The last path component. */
const filename = (path) => {
  const at = path.lastIndexOf('/');
  return at < 0 ? path : path.slice(at + 1);
};

/**
 * correctResourcePath (misc/resourcehelpers.cpp:81-131), verbatim.
 *
 * @param {string[]} topLevelDirectories tried IN ORDER; the first that
 *   matches wins, and everything before the match is DISCARDED - which is
 *   how an absolute authoring path like "D:\Bethesda\Data Files\Textures\
 *   tx_hand.tga" resolves.
 * @param {string} resPath the authored reference
 * @param {(p:string)=>boolean} exists the VFS probe
 * @param {string} ext substitute extension, WITHOUT a leading dot
 * @returns {string} the path to open - and when all four probes miss, the
 *   .dds candidate, NOT the authored name. The caller then fails to open
 *   it and gets the warning image, which is the behaviour that makes a
 *   missing texture visible instead of silent.
 */
export function correctResourcePath(topLevelDirectories, resPath, exists, ext) {
  const path = normalizeVfsPath(resPath);
  let corrected = null;
  for (const dir of topLevelDirectories) {
    const at = findDirectory(path, dir);
    if (at >= 0) {
      corrected = path.slice(at);
      break;
    }
  }
  if (corrected === null) corrected = `${topLevelDirectories[0]}/${path}`;

  const origExt = corrected;
  const swapped = changeExtension(corrected, ext);
  corrected = swapped.path;
  const isExtChanged = swapped.changed;

  if (exists(corrected)) return corrected;
  if (isExtChanged && exists(origExt)) return origExt;
  // BOTH fallbacks use topLevelDirectories.FRONT, never the directory that
  // matched - so a bookart-rooted miss is probed under textures/.
  const front = topLevelDirectories[0];
  const fallback = `${front}/${filename(corrected)}`;
  if (exists(fallback)) return fallback;
  if (isExtChanged) {
    const fallbackOrig = `${front}/${filename(origExt)}`;
    if (exists(fallbackOrig)) return fallbackOrig;
  }
  return corrected;
}

/** The two top-level directories a TEXTURE may be re-rooted at, in the
 *  order they are tried (misc/resourcehelpers.cpp:20-21, 140). */
export const TEXTURE_TOP_LEVEL = Object.freeze(['textures', 'bookart']);

/** The substitute extension, with NO leading dot - changeExtension
 *  replaces from one char past the '.', so the dot is already there. */
export const TEXTURE_EXT = 'dds';

/** correctTexturePath (misc/resourcehelpers.cpp:137-141). */
export function correctTexturePath(resPath, exists) {
  return correctResourcePath(TEXTURE_TOP_LEVEL, resPath, exists, TEXTURE_EXT);
}

/**
 * NiTexturingProperty's clamp bits (nif/property.hpp:70-71) and their GL
 * mapping (nifosg/nifloader.cpp:1145-1150).
 *
 * THE BITS ARE THE OTHER WAY ROUND FROM THE NAMES: bit 0 is wrapT and
 * bit 1 is wrapS. A set bit is REPEAT; a clear bit is CLAMP_TO_EDGE -
 * not GL_CLAMP, and not REPEAT-by-default. mClamp 3 (the common value)
 * is REPEAT on both axes.
 */
export const GL_REPEAT = 0x2901;
export const GL_CLAMP_TO_EDGE = 0x812f;
export function wrapModes(clampMode) {
  const c = clampMode | 0;
  return {
    wrapS: (c & 2) ? GL_REPEAT : GL_CLAMP_TO_EDGE,
    wrapT: (c & 1) ? GL_REPEAT : GL_CLAMP_TO_EDGE,
  };
}

/**
 * ImageManager's warning image (resource/imagemanager.cpp:28-43): 8x8,
 * every texel (255, 0, 255).
 *
 * A MISSING TEXTURE IS NOT A REFUSAL, and that is the rule, not a
 * convenience. Every failure path in the reference - the archive throwing,
 * no reader for the extension, a decode failure, an unsupported
 * compression - returns this and caches it under the failed path. The
 * port's own instinct here was a skin-tone fallback, which is precisely
 * the "empty view called a working one" this arc keeps being burned by:
 * magenta is a texture that SAYS it is missing.
 */
export function warningImage() {
  const width = 8;
  const height = 8;
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = 255;
    rgba[i * 4 + 1] = 0;
    rgba[i * 4 + 2] = 255;
    rgba[i * 4 + 3] = 255;
  }
  return { width, height, mips: [{ width, height, rgba }] };
}

/**
 * RULE 18: correctActorModelPath (misc/resourcehelpers.cpp:180-198), the
 * OTHER resource-path rule, and it lives here because this file is
 * ResourceHelpers' one home and it needs the same two primitives.
 *
 *   insert 'x' before the FILENAME (after the last '/'), swap a .nif
 *   extension for .kf, and USE THE X-FORM ONLY IF THAT KF EXISTS -
 *   otherwise keep the original path.
 *
 * It REFINES RULE 6, which reads as though the skeleton names were
 * fixed. They are not: `meshes/base_anim_female.1st.nif` is promoted to
 * `meshes/xbase_anim_female.1st.nif` exactly when
 * `meshes/xbase_anim_female.1st.kf` is in the archive. The male
 * first-person entry is ALREADY x-form in the settings, so the insert
 * yields a non-existent `xx` name and the original stands - which is why
 * a port tested only on a male character sees nothing wrong.
 *
 * The extension swap is CONDITIONAL on the extension being exactly
 * "nif": for anything else the probe is against the model name itself,
 * not a .kf. Both branches are here because both are reachable.
 */
export function correctActorModelPath(resPath, exists) {
  const path = normalizeVfsPath(resPath);
  const at = path.lastIndexOf('/');
  const xform = at < 0 ? `x${path}` : `${path.slice(0, at + 1)}x${path.slice(at + 1)}`;
  const dot = xform.lastIndexOf('.');
  const ext = dot > xform.lastIndexOf('/') ? xform.slice(dot + 1) : '';
  const probe = ext === 'nif' ? changeExtension(xform, 'kf').path : xform;
  return exists(probe) ? xform : path;
}

// ---------------------------------------------------------------------------
// MW-D34: DECODE BY EXTENSION, the other half of the ladder.
//
// correctResourcePath above deliberately answers the AUTHORED extension
// when the .dds probe misses and the original file exists (`if
// (isExtChanged && vfs.exists(origExt)) return origExt;`,
// resourcehelpers.cpp:112-114) - and Morrowind's originals are .tga and
// .bmp. The reference then decodes that path BY ITS EXTENSION, not by
// assuming DDS: ImageManager reads the extension, aliases the
// non-standard "targa" to "tga" ("Non-standard, but Morrowind supports
// this", imagemanager.cpp:104-110), and asks osgDB for that format's
// reader. The port fed every ladder answer to decodeDds, so a texture
// the archives DO carry rendered as the magenta warning.


/** TGA (types 1-3 and their RLE forms 9-11; 8/15/16/24/32 bpp), to the
 *  same {width, height, mips:[{width,height,rgba}]} shape decodeDds
 *  answers. Bottom-up unless descriptor bit 5 sets top-origin. */
export function decodeTga(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 18) throw new Error('decodeTga: not a TGA file');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const idLength = bytes[0];
  const colorMapType = bytes[1];
  const imageType = bytes[2];
  const mapStart = dv.getUint16(3, true);
  const mapLength = dv.getUint16(5, true);
  const mapDepth = bytes[7];
  const width = dv.getUint16(12, true);
  const height = dv.getUint16(14, true);
  const depth = bytes[16];
  const descriptor = bytes[17];
  const baseType = imageType & 7;
  const rle = (imageType & 8) !== 0;
  if (baseType < 1 || baseType > 3 || !width || !height) throw new Error('decodeTga: unsupported image type');
  let off = 18 + idLength;
  const mapBpp = mapDepth >> 3;
  const palette = colorMapType === 1 ? bytes.subarray(off, off + mapLength * mapBpp) : null;
  if (colorMapType === 1) off += mapLength * mapBpp;
  const bpp = depth >> 3;
  const rgba = new Uint8Array(width * height * 4);
  const putBgr = (o, src, at, nb) => {
    if (nb === 1) { rgba[o] = rgba[o + 1] = rgba[o + 2] = src[at]; rgba[o + 3] = 255; return; }
    if (nb === 2) {
      const px = src[at] | (src[at + 1] << 8);   // ARRRRRGG GGGBBBBB
      rgba[o] = ((px >> 10) & 31) * 255 / 31;
      rgba[o + 1] = ((px >> 5) & 31) * 255 / 31;
      rgba[o + 2] = (px & 31) * 255 / 31;
      rgba[o + 3] = 255;
      return;
    }
    rgba[o] = src[at + 2]; rgba[o + 1] = src[at + 1]; rgba[o + 2] = src[at];
    rgba[o + 3] = nb === 4 ? src[at + 3] : 255;
  };
  const putPixel = (i, src, at) => {
    const x = i % width;
    const yRow = (i / width) | 0;
    const y = (descriptor & 0x20) ? yRow : height - 1 - yRow;   // bit 5: top origin
    const o = (y * width + x) * 4;
    if (baseType === 1) {
      const idx = (bpp === 2 ? (src[at] | (src[at + 1] << 8)) : src[at]) - mapStart;
      putBgr(o, palette, idx * mapBpp, mapBpp);
    } else putBgr(o, src, at, bpp);
  };
  const count = width * height;
  if (!rle) {
    for (let i = 0; i < count; i++) putPixel(i, bytes, off + i * bpp);
  } else {
    let i = 0;
    while (i < count && off < bytes.length) {
      const packet = bytes[off++];
      const n = (packet & 127) + 1;
      if (packet & 128) {
        for (let k = 0; k < n && i < count; k++) putPixel(i++, bytes, off);
        off += bpp;
      } else {
        for (let k = 0; k < n && i < count; k++) { putPixel(i++, bytes, off); off += bpp; }
      }
    }
  }
  return { width, height, mips: [{ width, height, rgba }] };
}

/** BMP (uncompressed BI_RGB, 8-bit paletted / 24 / 32 bpp), same shape.
 *  Positive height is bottom-up, per the format. */
export function decodeBmp(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 54 || bytes[0] !== 0x42 || bytes[1] !== 0x4d) {
    throw new Error('decodeBmp: not a BMP file');
  }
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dataOff = dv.getUint32(10, true);
  const headerSize = dv.getUint32(14, true);
  const width = dv.getInt32(18, true);
  const rawH = dv.getInt32(22, true);
  const height = Math.abs(rawH);
  const bpp = dv.getUint16(28, true);
  const compression = dv.getUint32(30, true);
  if (compression !== 0 || (bpp !== 8 && bpp !== 24 && bpp !== 32) || !width || !height) {
    throw new Error('decodeBmp: unsupported BMP format');
  }
  const palOff = 14 + headerSize;
  const stride = ((width * bpp + 31) >> 5) << 2;   // rows pad to 4 bytes
  const rgba = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row++) {
    const y = rawH > 0 ? height - 1 - row : row;   // positive height: bottom-up
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      if (bpp === 8) {
        const p = palOff + bytes[dataOff + row * stride + x] * 4;   // BGRA quads
        rgba[o] = bytes[p + 2]; rgba[o + 1] = bytes[p + 1]; rgba[o + 2] = bytes[p]; rgba[o + 3] = 255;
      } else {
        const at = dataOff + row * stride + x * (bpp >> 3);
        rgba[o] = bytes[at + 2]; rgba[o + 1] = bytes[at + 1]; rgba[o + 2] = bytes[at];
        rgba[o + 3] = bpp === 32 ? bytes[at + 3] : 255;
      }
    }
  }
  return { width, height, mips: [{ width, height, rgba }] };
}

/** ImageManager's routing (imagemanager.cpp:104-118): the path's own
 *  extension picks the decoder, "targa" aliases to "tga", and a format
 *  with no reader is an error the caller turns into the warning image. */
export function decodeTextureImage(path, bytes) {
  const p = String(path || '');
  const dot = p.lastIndexOf('.');
  let ext = dot >= 0 ? p.slice(dot + 1).toLowerCase() : '';
  if (ext === 'targa') ext = 'tga';   // "Non-standard, but Morrowind supports this"
  if (ext === 'dds') return decodeDds(bytes);
  if (ext === 'tga') return decodeTga(bytes);
  if (ext === 'bmp') return decodeBmp(bytes);
  throw new Error(`no decoder for ".${ext}"`);
}
