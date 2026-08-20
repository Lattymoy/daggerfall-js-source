// THE QUEST SYMBOL (Q1) - Symbol.cs + Parser.GetInnerSymbolName.
// Symbols name resources, tasks and text replacements. `original` is
// the source text ("_symbol_", "==symbol_", "#symbol"); `name` is the
// inner name the quest system keys on. GetInnerSymbolName trims the
// wrappers OUTSIDE IN (= then # then _) and deliberately not inner
// characters - "_one_day_" becomes "one_day" (Parser.cs).

export function getInnerSymbolName(symbol) {
  if (!symbol) return '';
  let result = symbol;
  result = trimChar(result, '=');   // Outer =
  result = trimChar(result, '#');   // Outer # (custom, gets binding)
  result = trimChar(result, '_');   // Outer _
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
