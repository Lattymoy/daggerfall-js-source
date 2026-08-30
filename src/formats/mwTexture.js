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
