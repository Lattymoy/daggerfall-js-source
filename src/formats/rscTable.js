// MAC-U (2026-09-18, Mac, with the screenshot: "any directions I get
// look like two messages at once, like it changes mid-sentence" -
// "It's really easy. You'll want to go The Greensley Residence is
// south of where we're standing.").
//
// THE TABLE A DFU PLAYER READS. Daggerfall Unity does not read
// TEXT.RSC first. TextProvider.GetRSCTokens (TextProvider.cs:167-188)
// asks the localization string table `Internal_RSC` for the record's
// id and falls back to the classic file only for a key the table
// lacks - and the English table ships INSIDE every build
// (Assets/Localization/StringTables/Internal_RSC_en). The table was
// extracted from TEXT.RSC and then EDITED by the DFU project, so
// where the two differ, the table is the game as played.
//
// Record 7333 is such a row. Classic's nine direction hints read
// "%loc is %di of here", "%loc is %di of where we're standing", ...
// - a whole sentence naming the building - while every answer frame
// that expands %hnt already carries its own subject ("You'll want to
// go %hnt.", "Sure. %key is %hnt.", "Ya gotta go %hnt." - 7270-7274,
// 7285-7289). Classic fused them too; DFU's table trims the hint to
// the PHRASE the frames expect ("%di of here", "that way, just keep
// going %di"), and that is the text below, verbatim from
// vendor/dfu-text/Internal_RSC.csv (the source pin is
// test/macu_directions.test.js).
//
// The port keeps reading the player's TEXT.RSC for everything else:
// this module carries only the rows where the table diverges from
// classic AND the divergence has been verified against a real
// ARENA2. tools/rscTableDiff.mjs lists the candidates. It is DATA
// with no imports; textRsc.js encodes the rows into the file's own
// byte shape (encodeRscRecord) and reads them first.

/** DFU's Internal_RSC rows the port carries, by record id: each a
 *  list of the record's SubrecordSeparator-split variants as plain
 *  text ('\n' for a break byte). */
export const INTERNAL_RSC = Object.freeze({
  // GetKeySubjectBuildingDirection (TalkManager.cs:1692-1696) - the
  // %hnt direction arm's record
  7333: Object.freeze([
    '%di of here',
    "%di of where we're standing",
    'that way, just keep going %di',
    'that way, %di',
    'a way %di of here',
    "not too far to the %di, if you don't mind walking",
    "%di of here, unless I'm mistaken",
    '%di of here, I think',
    '%di, with a bit of a walk',
  ]),
});

/** DaggerfallStringTableImporter.ConvertStringToRSCTokens
 *  (DaggerfallStringTableImporter.cs:175-215) read as plain text: a
 *  literal newline in the CSV is editor air and is STRIPPED (:186-188
 *  - "TEXT.RSC does not use newline"), `[/record]` closes a variant,
 *  `[/end]` the record, `[/left]` / `[/center]` / `[/newline]` are
 *  the three break bytes (plainText's '\n'), and the prefixed and
 *  cosmetic markups (`[/pos`, `[/font`, `[/color`, `[/scale`,
 *  `[/image`, `[/input]`) carry no text. Returns the variants. */
export function parseRscMarkup(value) {
  const variants = [];
  let cur = '';
  const s = String(value ?? '').replace(/\r?\n/g, '');
  const re = /\[\/(record|end|left|center|newline|input|pos[^\]]*|font[^\]]*|color[^\]]*|scale[^\]]*|image[^\]]*)\]/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    cur += s.slice(last, m.index);
    last = m.index + m[0].length;
    const tag = m[1];
    if (tag === 'record') { variants.push(cur); cur = ''; continue; }
    if (tag === 'end') { variants.push(cur); cur = null; break; }
    if (tag === 'left' || tag === 'center' || tag === 'newline') cur += '\n';
  }
  if (cur !== null) variants.push(cur + s.slice(last));
  return variants;
}

/** The master CSV (`Key,Value`, values quoted with doubled quotes and
 *  free to span lines) as id -> raw markup value. A non-numeric key
 *  (the header, the named rows) is skipped. */
export function parseRscCsv(text) {
  const out = new Map();
  const s = String(text ?? '').replace(/^\uFEFF/, '');
  let i = 0;
  const n = s.length;
  const field = () => {
    if (s[i] === '"') {
      i++;
      let v = '';
      for (; i < n; i++) {
        if (s[i] === '"') {
          if (s[i + 1] === '"') { v += '"'; i++; continue; }
          i++;
          break;
        }
        v += s[i];
      }
      return v;
    }
    const start = i;
    while (i < n && s[i] !== ',' && s[i] !== '\n' && s[i] !== '\r') i++;
    return s.slice(start, i);
  };
  while (i < n) {
    const key = field();
    let value = '';
    if (s[i] === ',') { i++; value = field(); }
    while (i < n && s[i] !== '\n') i++;
    i++;
    if (/^\d+$/.test(key)) out.set(Number(key), value);
  }
  return out;
}
