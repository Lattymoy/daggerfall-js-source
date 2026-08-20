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

/** int.Parse with a 0 default for null/empty (Parser.ParseInt). */
export function parseInt(text) {
  if (text == null || text === '') return 0;
  if (!/^-?\d+$/.test(text.trim())) throw new Error(`int.Parse failed on '${text}'`);
  return Number.parseInt(text, 10);
}
