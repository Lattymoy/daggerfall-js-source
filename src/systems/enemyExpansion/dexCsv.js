// DEX1 (2026-10-19, Mac: "I want to implement this as our next mod 1:1") - DAGGERFALL ENEMY EXPANSION 1.3.4 (Kamer &
// Kab), THE TABLES' OWN READING. The mod keeps its whole bestiary in five CSV files (the `.mdb.csv`, `.cdb.csv` and
// `.tdb.csv` its manifest names, vendor/daggerfall-enemy-expansion/) and reads them with three helpers of its own,
// BestiaryMod.SplitCsvLine (BestiaryMod.cs:593-608), ParseArrayArg (:610-628) and ParseBool (:650-661). They are
// ported here exactly, quirks and all, because every cell the port reads goes through them - tools/dexExtract.mjs
// (which archives the tables draw) as much as the game's tables (systems/enemyExpansion/dexTables.js).

/** BestiaryMod.CsvSplit (:591): a cell is a quoted run (with \" inside) or anything up to the next comma. */
const CSV_SPLIT = /(?:^|,)("(?:\\"|[^"])*"|[^,]*)/g;

/**
 * BestiaryMod.SplitCsvLine (:593-608). Each match's value has its leading separators trimmed, `\"` unescaped and its
 * quotes trimmed. THE ONE QUIRK, kept: a match of length zero - which only an empty FIRST cell makes, the separator
 * being part of every later match - is added twice (`if (0 == curr.Length) list.Add("")` and then the trimmed value),
 * and the scan resumes one character on (.NET's Match.NextMatch after an empty match, as String.matchAll here), past
 * the comma the second cell's match needed: so `,a,b` reads `["", "", "b"]` - the second cell lost, the count kept.
 * No shipped line has an empty first cell.
 */
export function splitCsvLine(line) {
  const list = [];
  for (const m of String(line).matchAll(CSV_SPLIT)) {
    const curr = m[0];
    if (curr.length === 0) list.push('');
    list.push(curr.replace(/^[,;]+/, '').replaceAll('\\"', '"').replace(/^"+|"+$/g, ''));
  }
  return list;
}

/** The header's fields (BestiaryMod.cs:334, :676, :1641): split on `;` or `,` with no quoting, each `"`-trimmed. */
export const splitCsvHeader = (header) => String(header).split(/[;,]/).map((f) => f.replace(/^"+|"+$/g, ''));

/** The lines after the header, as StreamReader.ReadLine reads them (CRLF or LF; no line for a final terminator). */
export function csvLines(text) {
  const lines = String(text).replace(/^﻿/, '').split(/\r\n|\n|\r/);
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/**
 * BestiaryMod.ParseArrayArg (:610-628): `{0,1,-1,2}`, `[0;1]` or `7,10,29,44` as numbers - an empty element reads as
 * -1, mismatched brackets throw. C# int.Parse takes surrounding white space (`{ 0, 1, -1 }` is in the shipped
 * ClassBase), and nothing else: a cell that is not an integer throws, as it does there.
 */
export function parseArrayArg(arg, context = '') {
  if (arg == null || arg === '') return [];
  let a = String(arg);
  if (a[0] === '[' || a[0] === '{') {
    if ((a[0] === '[' && a[a.length - 1] !== ']') || (a[0] === '{' && a[a.length - 1] !== '}')) {
      throw new Error(`Error parsing (${context}): array argument has mismatched brackets`);
    }
    a = a.slice(1, -1);
  }
  return a.split(/[,;]/).map((frame) => parseCsInt(frame === '' ? '-1' : frame, context));
}

/** BestiaryMod.ParseFloatArrayArg (:630-648): the same shape, floats in the invariant culture (the glow colours). */
export function parseFloatArrayArg(arg, context = '') {
  if (arg == null || arg === '') return [];
  let a = String(arg);
  if (a[0] === '[' || a[0] === '{') {
    if ((a[0] === '[' && a[a.length - 1] !== ']') || (a[0] === '{' && a[a.length - 1] !== '}')) {
      throw new Error(`Error parsing (${context}): array argument has mismatched brackets`);
    }
    a = a.slice(1, -1);
  }
  return a.split(/[,;]/).map((s) => {
    const v = (s === '' ? '-1' : s).trim();
    if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(v)) throw new Error(`Error parsing (${context}): '${s}' is not a number`);
    return Number(v);
  });
}

/** BestiaryMod.ParseBool (:650-661): empty is false, `true`/`false` in any case, anything else throws. */
export function parseBool(value, context = '') {
  if (value == null || value === '') return false;
  if (String(value).toLowerCase() === 'true') return true;
  if (String(value).toLowerCase() === 'false') return false;
  throw new Error(`Error parsing (${context}): invalid boolean value '${value}'`);
}

/** C#'s int.Parse as the mod calls it: optional white space, an optional sign, digits - anything else throws. */
export function parseCsInt(s, context = '') {
  const v = String(s).trim();
  if (!/^[+-]?\d+$/.test(v)) throw new Error(`Error parsing (${context}): '${s}' is not an integer`);
  return Number.parseInt(v, 10);
}

/**
 * One CSV table as the mod reads it: the header's fields, and each later line split (the line number is the file's,
 * header = 1, for the mod's own messages). A field the mod looks up is found case-insensitively (GetIndex /
 * GetIndexOpt, StringComparison.InvariantCultureIgnoreCase).
 */
export function readCsvTable(text) {
  const lines = csvLines(text);
  const fields = splitCsvHeader(lines[0] ?? '');
  const lower = fields.map((f) => f.toLowerCase());
  /** GetIndexOpt: the column of a field, or null. */
  const column = (name) => { const i = lower.indexOf(String(name).toLowerCase()); return i === -1 ? null : i; };
  const rows = lines.slice(1).map((line, i) => ({ lineNumber: i + 2, line, tokens: splitCsvLine(line) }));
  return { fields, column, rows };
}
