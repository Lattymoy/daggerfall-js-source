// THE QUEST SYMBOL (Q1) - Symbol.cs + Parser.GetInnerSymbolName.
// Symbols name resources, tasks and text replacements. `original` is
// the source text ("_symbol_", "==symbol_", "#symbol"); `name` is the
// inner name the quest system keys on. GetInnerSymbolName nets to
// Trim('_') alone (the C# quirk below) and deliberately not inner
// characters - "_one_day_" becomes "one_day" (Parser.cs).

export function getInnerSymbolName(symbol) {
  if (!symbol) return '';
  // AUDIT quest-P7 / BUG-FOR-BUG: C#'s three Trims each operate on
  // `symbol`, not on the previous result - the first two assignments
  // are DEAD and the net effect is Trim('_') alone ("=sym_" keeps its
  // '='). Replicated exactly; the macro slice inherits DFU's own
  // behavior here, not a fixed-up version.
  let result;
  result = trimChar(symbol, '=');   // Outer = (dead in C#, kept for shape)
  result = trimChar(symbol, '#');   // Outer # (dead in C#, kept for shape)
  result = trimChar(symbol, '_');   // Outer _ - the only one that lands
  return result;
}

/** C# string.Trim(char): strip the char from BOTH ends, repeatedly. */
function trimChar(s, ch) {
  let start = 0, end = s.length;
  while (start < end && s[start] === ch) start++;
  while (end > start && s[end - 1] === ch) end--;
  return s.slice(start, end);
}

export class Symbol {
  constructor(original = null) {
    this.original = null;
    this.name = null;
    if (original !== null) this.setValue(original);
  }

  setValue(original) {
    this.original = original;
    this.name = getInnerSymbolName(original);
  }

  getValue() { return this.original; }

  clone() {
    const c = new Symbol();
    c.original = this.original;
    c.name = this.name;
    return c;
  }

  equals(other) {
    if (!other) return false;
    return other.name === this.name && other.original === this.original;
  }
}

/** The save envelope's Symbol shape (Q4-iv): the ORIGINAL alone -
 *  name re-derives deterministically in the ctor, so the C# habit of
 *  serializing both fields folds to one. Null stays null. */
export const symbolToSaveData = (sym) => (sym ? { original: sym.original } : null);
export const symbolFromSaveData = (data) => (data ? new Symbol(data.original) : null);
