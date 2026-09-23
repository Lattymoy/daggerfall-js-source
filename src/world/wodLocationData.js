// ═══════════════════════════════════════════════════════════════════
// WOD1 - WORLD OF DAGGERFALL: THE DATA SHAPES AND THEIR READERS.
//
// "World of Daggerfall" 2.0 (Kamer, Daggerfall Unity mod, GUID
// 98f05888-989f-4ff1-b455-f4cafedaeb88) ships its whole implementation
// as C# TextAssets inside `world_of_daggerfall.dfmod`, and its content
// as ~2,400 XML files under StreamingAssets/Locations/. This module is
// the port of the two classes that READ that content:
//
//   LocationData.cs                   - LocationPrefab / LocationObject /
//                                       LocationInstance, the shapes
//   LocationHelper.LoadLocationInstance (LocationHelper.cs:938-975)
//   LocationHelper.LoadLocationPrefab   (LocationHelper.cs:1010-1052)
//   LocationHelper.ValidateValue        (LocationHelper.cs:1101-1155)
//
// Cites are to vendor/world-of-daggerfall/Scripts/, the author's own
// source extracted byte for byte by tools/worldOfDaggerfallAssets.mjs.
//
// WHAT "THE SAME READER" MEANS HERE. The C# is an XmlDocument walk that
// indexes every tag list by the same i (`GetElementsByTagName("name")[i]`
// for the i-th instance), fills each field with .NET's TryParse (whose
// `out` is ZEROED on failure - not left at the field's default), and
// skips an instance whose <prefab> is empty. Three consequences of that
// are live in the shipped data and are kept here on purpose:
//   - 3,000 instances (regions 5 and 35) carry EMPTY coordinates; they
//     parse to 0,0 and the loader's terrainX <= 0 guard retires them.
//   - 155,398 locationIDs do not fit an Int32, are empty, or are not
//     integers at all ("625450-103"); TryParse fails and they read as 0.
//     The ID only ever feeds a treasure container's LoadID
//     (LocationHelper.cs:1534).
//   - float fields are C# `float`: parsed through double, then narrowed
//     (Math.fround), which is .NET Framework's Single.TryParse path.
// The port has no XmlDocument, so `parseXml` below is a strict reader
// for the subset the files use (elements and text: no attributes,
// entities, comments, CDATA or declarations - the packer asserts that
// over every shipped file) that throws on malformed input as
// XmlDocument.Load does. A LEAF: no imports.
// ═══════════════════════════════════════════════════════════════════

/** LocationData.cs:50-62 - the defaults a fresh LocationInstance carries. */
export function newLocationInstance() {
  return {
    locationID: 0,
    name: 'DF_Rocks',
    type: 0,
    prefab: '',
    worldX: 0,
    worldY: 0,
    terrainX: 0,
    terrainY: 0,
  };
}

/** LocationData.cs:9-13 - a fresh LocationPrefab (8x8, no objects). */
export function newLocationPrefab() {
  return { height: 8, width: 8, obj: [] };
}

/** LocationData.cs:20-32 - a fresh LocationObject: a mesh (type 0) at
 *  the origin, identity rotation (Quaternion.Euler(0,0,0)), unit scale.
 *  rot is { x, y, z, w } in Unity's own (left-handed) frame. */
export function newLocationObject() {
  return {
    type: 0,
    name: '',
    objectID: 0,
    pos: { x: 0, y: 0, z: 0 },
    rot: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  };
}

// ── .NET number parsing ──────────────────────────────────────────────

// NumberStyles.AllowLeadingWhite / AllowTrailingWhite: U+0009-U+000D, U+0020.
const WS = '[\\t\\n\\v\\f\\r ]*';
const INT_RE = new RegExp(`^${WS}([+-]?)([0-9]+)${WS}$`);
// NumberStyles.Float | AllowThousands under an en-US culture: sign,
// digits with ',' group separators in the integral part, a '.' point,
// an exponent. (The culture is the author's: a comma-decimal locale
// fails every one of these files, a machine-dependent DFU hazard the
// port has no reason to reproduce.)
const FLOAT_RE = new RegExp(`^${WS}[+-]?(?:[0-9][0-9,]*(?:\\.[0-9]*)?|\\.[0-9]+)(?:[eE][+-]?[0-9]+)?${WS}$`);

/** int.TryParse(s, out v) - Int32 or 0 (the `out` is zeroed on failure). */
export function tryParseInt32(s) {
  const m = INT_RE.exec(s);
  if (!m) return 0;
  // Magnitude check on the digit string itself, so a 30-digit value
  // cannot round into range through a double.
  const digits = m[2].replace(/^0+(?=\d)/, '');
  const limit = m[1] === '-' ? '2147483648' : '2147483647';
  if (digits.length > limit.length || (digits.length === limit.length && digits > limit)) return 0;
  const v = Number(digits);
  return m[1] === '-' ? (v === 0 ? 0 : -v) : v;
}

/** float.TryParse(s, out v) - a C# float (via double, then narrowed) or 0. */
export function tryParseSingle(s) {
  if (!FLOAT_RE.test(s)) return 0;
  const v = Number(s.trim().replace(/,/g, ''));
  if (!Number.isFinite(v)) return 0;
  const f = Math.fround(v);
  // .NET Framework's Single.TryParse fails when the value overflows float.
  return Number.isFinite(f) ? f : 0;
}

/** int.Parse for ValidateValue: the same grammar, but failure THROWS
 *  (FormatException for a bad shape, OverflowException out of range) -
 *  returned here as null so the caller can take ValidateValue's catch. */
function parseInt32OrNull(s) {
  const m = INT_RE.exec(s);
  if (!m) return null;
  const digits = m[2].replace(/^0+(?=\d)/, '');
  const limit = m[1] === '-' ? '2147483648' : '2147483647';
  if (digits.length > limit.length || (digits.length === limit.length && digits > limit)) return null;
  return tryParseInt32(s);
}

// ── the XmlDocument subset ───────────────────────────────────────────

/**
 * Parse the element-and-text XML the mod's files use into a tree.
 * Throws on anything malformed or outside the subset. Returns the
 * document's elements in DOCUMENT ORDER (pre-order), each as
 * { tag, text, children } where `text` is the element's own raw text -
 * InnerXml for a leaf element, since the subset has no markup inside
 * a leaf's text.
 * @param {string} xml
 * @returns {{ root: object, elements: object[] }}
 */
export function parseXml(xml) {
  const elements = [];
  const stack = [];
  let root = null;
  let i = 0;
  const n = xml.length;
  const fail = (why) => { throw new Error(`XmlException: ${why} at offset ${i}`); };
  while (i < n) {
    const lt = xml.indexOf('<', i);
    const textEnd = lt < 0 ? n : lt;
    if (textEnd > i) {
      const text = xml.slice(i, textEnd);
      if (stack.length) stack[stack.length - 1].text += text;
      else if (/\S/.test(text)) fail('text outside the root element');
      i = textEnd;
      continue;
    }
    const gt = xml.indexOf('>', i);
    if (gt < 0) fail('unterminated tag');
    const body = xml.slice(i + 1, gt);
    if (body.startsWith('/')) {
      const tag = body.slice(1).trim();
      const top = stack.pop();
      if (!top || top.tag !== tag) fail(`mismatched </${tag}>`);
    } else {
      const selfClosing = body.endsWith('/');
      const tag = (selfClosing ? body.slice(0, -1) : body).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(tag)) fail(`unsupported markup <${body}>`);
      const el = { tag, text: '', children: [] };
      if (stack.length) stack[stack.length - 1].children.push(el);
      else if (root) fail('a second root element');
      else root = el;
      elements.push(el);
      if (!selfClosing) stack.push(el);
    }
    i = gt + 1;
  }
  if (stack.length) fail(`unclosed <${stack[stack.length - 1].tag}>`);
  if (!root) fail('no root element');
  return { root, elements };
}

/** XmlDocument.GetElementsByTagName: every element of that name, in
 *  document order. `[i]` past the end is null in .NET (and then
 *  `.InnerXml` throws) - `innerXml` below reproduces the throw. */
function byTag(doc, tag) {
  return doc.elements.filter((e) => e.tag === tag);
}

function innerXml(list, i) {
  const el = list[i];
  if (!el) throw new TypeError(`NullReferenceException: GetElementsByTagName(...)[${i}] is null`);
  return el.children.length ? fail() : el.text;
  function fail() { throw new Error('InnerXml of a non-leaf element is outside the subset'); }
}

// ── the two loaders ──────────────────────────────────────────────────

/**
 * LocationHelper.LoadLocationInstance (LocationHelper.cs:938-975),
 * over the file's TEXT (the C#'s File.Exists miss is the caller's
 * `null`). Returns null for a file without a <locations> element.
 * @param {?string} xml
 * @returns {?Array<object>}
 */
export function loadLocationInstance(xml) {
  if (xml == null) return null;
  const doc = parseXml(xml);
  if (!doc.elements.some((e) => e.tag === 'locations')) return null;   // "Wrong file format"
  const inst = byTag(doc, 'locationInstance');
  const t = {
    name: byTag(doc, 'name'), locationID: byTag(doc, 'locationID'), type: byTag(doc, 'type'),
    prefab: byTag(doc, 'prefab'), worldX: byTag(doc, 'worldX'), worldY: byTag(doc, 'worldY'),
    terrainX: byTag(doc, 'terrainX'), terrainY: byTag(doc, 'terrainY'),
  };
  const out = [];
  for (let i = 0; i < inst.length; i++) {
    // :956 - an instance with no prefab is skipped, but its index still
    // advances every other list (the lists are read by the same i).
    if (innerXml(t.prefab, i) === '') continue;
    const tmp = newLocationInstance();
    tmp.name = innerXml(t.name, i);
    tmp.locationID = tryParseInt32(innerXml(t.locationID, i));
    tmp.type = tryParseInt32(innerXml(t.type, i));
    tmp.prefab = innerXml(t.prefab, i);
    tmp.worldX = tryParseInt32(innerXml(t.worldX, i));
    tmp.worldY = tryParseInt32(innerXml(t.worldY, i));
    tmp.terrainX = tryParseInt32(innerXml(t.terrainX, i));
    tmp.terrainY = tryParseInt32(innerXml(t.terrainY, i));
    out.push(tmp);
  }
  return out;
}

const OBJ_INT = ['type', 'objectID'];

/**
 * LocationHelper.LoadLocationPrefab (LocationHelper.cs:1010-1052), over
 * the file's text. Returns null for a file without <locationPrefab>.
 * @param {?string} xml
 * @returns {?{height:number,width:number,obj:Array<object>}}
 */
export function loadLocationPrefab(xml) {
  if (xml == null) return null;
  const doc = parseXml(xml);
  if (!doc.elements.some((e) => e.tag === 'locationPrefab')) return null;   // "Wrong file format"
  const p = newLocationPrefab();
  p.height = tryParseInt32(innerXml(byTag(doc, 'height'), 0));
  p.width = tryParseInt32(innerXml(byTag(doc, 'width'), 0));
  const count = byTag(doc, 'object').length;
  const L = {};
  for (const tag of ['type', 'name', 'objectID', 'posX', 'posY', 'posZ',
    'scaleX', 'scaleY', 'scaleZ', 'rotW', 'rotX', 'rotY', 'rotZ']) L[tag] = byTag(doc, tag);
  for (let i = 0; i < count; i++) {
    const o = newLocationObject();
    p.obj.push(o);
    for (const k of OBJ_INT) o[k] = tryParseInt32(innerXml(L[k], i));
    o.name = innerXml(L.name, i);
    o.pos.x = tryParseSingle(innerXml(L.posX, i));
    o.pos.y = tryParseSingle(innerXml(L.posY, i));
    o.pos.z = tryParseSingle(innerXml(L.posZ, i));
    o.scale.x = tryParseSingle(innerXml(L.scaleX, i));
    o.scale.y = tryParseSingle(innerXml(L.scaleY, i));
    o.scale.z = tryParseSingle(innerXml(L.scaleZ, i));
    o.rot.w = tryParseSingle(innerXml(L.rotW, i));
    o.rot.x = tryParseSingle(innerXml(L.rotX, i));
    o.rot.y = tryParseSingle(innerXml(L.rotY, i));
    o.rot.z = tryParseSingle(innerXml(L.rotZ, i));
  }
  return p;
}

/**
 * LocationHelper.ValidateValue (LocationHelper.cs:1101-1155): a mesh
 * (type 0) needs an Int32 name; a flat (type 1) needs exactly
 * "ARCHIVE.RECORD", both Int32; any other type is invalid.
 */
export function validateValue(type, name) {
  if (type === 0) return parseInt32OrNull(name) !== null;
  if (type === 1) {
    const arg = name.split('.');
    return arg.length === 2 && parseInt32OrNull(arg[0]) !== null && parseInt32OrNull(arg[1]) !== null;
  }
  return false;
}

/**
 * Directory.GetFiles' order on the platform the mod was built and
 * played on: NTFS returns a directory's names collated by the volume's
 * upcase table - an ordinal compare of the UPPERCASED UTF-16 names. The
 * order is load-bearing: the loader places the FIRST valid instance
 * that names a map pixel, and 51,356 pixels are named by more than one
 * (a bandit camp and a rock field, say - "Bandits" sorts before "Rocks").
 * The mod's file names are all ASCII (the packer asserts it).
 */
export function ntfsCompare(a, b) {
  const A = a.toUpperCase();
  const B = b.toUpperCase();
  return A < B ? -1 : A > B ? 1 : 0;
}
