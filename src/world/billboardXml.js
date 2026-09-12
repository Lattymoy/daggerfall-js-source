// ═══════════════════════════════════════════════════════════════════
// THE XML BILLBOARD SCALE (MM1, 2026-09-12) -
// TextureReplacement.SetBillboardScale (TextureReplacement.cs:661-673)
// and the scale arm of GetStaticBillboardMaterial (:508-519).
//
// DFU's asset injection lets a mod ship `<archive:000>_<record>-<frame>.xml`
// beside (or without) a replacement texture, and `<info><scaleX>..
// </scaleX><scaleY>..</scaleY></info>` in it multiplies the billboard's
// size: DaggerfallMobileUnit's record-size cache runs
// `SetBillboardScale(archive, i, ref finalSize)` AFTER the record's own
// scale and BEFORE GlobalScale (DaggerfallMobileUnit.cs:657-682), and a
// static DaggerfallBillboard's SetMaterial takes `size *= scale` from
// the same xml (DaggerfallBillboard.cs:252-258). Both read the record's
// frame-0 name (GetName(archive, record), :725-727).
//
// The port has no loose files to read, so a vendored mod REGISTERS its
// xml table here, with a live predicate for its switch; rmbFlats'
// billboardSize applies whatever answers. Meaner Monsters is the first
// registrant (characters/meanerMonsters.js). A later registration for
// the same record wins, as a later-loaded mod's file does in DFU.
// A LEAF: no imports.
// ═══════════════════════════════════════════════════════════════════

const _registry = [];   // [{ vendor, table: { [archive]: { [record]: [x, y] } }, isOn: () => bool }]

/** Register (or replace) a vendor's xml scale table. */
export function registerBillboardXml(vendor, table, isOn = () => true) {
  const i = _registry.findIndex((r) => r.vendor === vendor);
  const entry = { vendor, table, isOn };
  if (i >= 0) _registry[i] = entry; else _registry.push(entry);
}
export function unregisterBillboardXml(vendor) {
  const i = _registry.findIndex((r) => r.vendor === vendor);
  if (i >= 0) _registry.splice(i, 1);
}

/** The xml's `scaleX`/`scaleY` for a record (frame 0), or null - the
 *  last live registrant that names the record answers. */
export function billboardXmlScale(archive, record) {
  if (archive == null || record == null) return null;
  for (let i = _registry.length - 1; i >= 0; i--) {
    const r = _registry[i];
    const s = r.table?.[archive]?.[record];
    if (s && r.isOn()) return { x: s[0], y: s[1] };
  }
  return null;
}

/** `size.x *= scale.x; size.y *= scale.y` over a {w, h}. */
export function applyBillboardXml(archive, record, size) {
  const s = billboardXmlScale(archive, record);
  if (!s || !size) return size;
  return { w: size.w * s.x, h: size.h * s.y };
}
