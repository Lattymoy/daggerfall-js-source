// Parser.cs #region Static Helpers as a LEAF module (AUDIT quest-1).
// These lived in parser.js, but parser.js imports every resource
// module and the resources need these helpers - a cycle that closed
// through an eval-time `extends QuestResource` and threw "Cannot
// access 'QuestResource' before initialization" whenever a resource
// module was the entry point (7 of 15 quest modules crashed if
// imported first; the tests only passed by import-order luck).
// parser.js re-exports everything, so its import surface is unchanged.

/** C# Split(new char[0], RemoveEmptyEntries): split on whitespace. */
export function splitLine(text, trim = true) {
  const parts = text.split(/\s+/).filter((s) => s.length);
  return trim ? parts.map((s) => s.trim()) : parts;
}

/** 'FieldName: Value' by ':'; throws on unexpected part count. */
export function splitField(text, expectedCount = 2, trim = true) {
  const parts = text.split(':');
  if (parts.length !== expectedCount && expectedCount !== -1) {
    throw new Error('SplitField() encountered invalid number of results.');
  }
  return trim ? parts.map((s) => s.trim()) : parts;
}

export const getFieldStringValue = (text) => splitField(text)[1].trim();
export const getFieldIntValue = (text) => parseInt(splitField(text)[1].trim());

// int.Parse / int.TryParse's decimal surface (NumberStyles.Integer):
// surrounding whitespace, one leading sign, digits (AUDIT quest-P9/P10).
const INT_SURFACE = /^\s*[+-]?\d+\s*$/;
const inInt32 = (n) => n <= 2147483647 && n >= -2147483648;

/** int.TryParse: the value, or null where C# answers false - off the
 *  surface or past int32. AUDIT 68 S30-tryparse-dup: the quest layer's
 *  ONE port; Table.GetInt, ParseQuestList and CustomParseInt each kept
 *  their own, and two of them had no int32 bound. */
export function intTryParse(text) {
  if (typeof text !== 'string' || !INT_SURFACE.test(text)) return null;
  const n = Number.parseInt(text, 10);
  return inInt32(n) ? n : null;
}

/** int.Parse: intTryParse's surface, THROWING where TryParse answers
 *  false. */
export function intParse(text) {
  const n = intTryParse(text);
  if (n !== null) return n;
  const onSurface = typeof text === 'string' && INT_SURFACE.test(text);
  throw new Error(`int.Parse ${onSurface ? 'overflow' : 'failed'} on '${text}'`);
}

/** int.Parse with a 0 default for null/empty (Parser.ParseInt).
 *  AUDIT quest-P10: C# accepts a leading '+' and THROWS past int32. */
export function parseInt(text) {
  if (text == null || text === '') return 0;
  return intParse(text);
}
