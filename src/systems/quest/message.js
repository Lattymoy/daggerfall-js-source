// THE QUEST MESSAGE (Q1) - Message.cs. A message stores text for
// popups, journal, letters, rumours. Lines tokenize on load: a <ce>
// prefix centres the line (whole-line trim), otherwise only the END
// trims so left indentation survives; <---> starts a new VARIANT
// (rumour randomness). Each line lands as a Text token followed by a
// formatting token (JustifyCenter or Nothing - Nothing is DFU's line
// break here). Macro expansion (%foo/__foo_) rides the macro slice
// (routed; MacroHelper's quest table is a Ledger C row already).
//
// GetTextTokens' random variant is a UnityEngine.Random draw ->
// injectable uniform roll (THE ENGINE-PRNG RULE, Ledger A).

const CENTER_TOKEN = '<ce>';
const SPLIT_TOKEN = '<--->';

/** TextFile.Formatting members this layer uses, keyed by name (the
 *  port's text layer is row-based, not byte-token based - the NAMES
 *  are the contract here, the classic byte values live in
 *  formats/textRsc.js). */
export const Formatting = Object.freeze({
  Nothing: 'nothing',
  Text: 'text',
  JustifyCenter: 'center',
});

export class Message {
  constructor(parentQuest, id = 0, source = null) {
    this.parentQuest = parentQuest;
    this.id = 0;
    this.variants = [];
    if (source) this.loadMessage(id, source);
  }

  get variantCount() { return this.variants.length; }

  loadMessage(id, source) {
    this.id = id;
    this.variants = [];
    let variant = { tokens: [] };
    for (let i = 0; i < source.length; i++) {
      let line = source[i];

      // Handle known justification tokens
      let formatting = Formatting.Nothing;
      if (line.startsWith(CENTER_TOKEN)) {
        formatting = Formatting.JustifyCenter;
        line = line.replaceAll(CENTER_TOKEN, '');
      }

      // Trim end of line only and preserve left format if no
      // formatting defined; otherwise trim the whole line.
      line = formatting === Formatting.Nothing ? line.replace(/\s+$/, '') : line.trim();

      // Split token starts a new variant
      if (line.includes(SPLIT_TOKEN)) {
        this.variants.push(variant);
        variant = { tokens: [] };
        continue;
      }

      variant.tokens.push({ formatting: Formatting.Text, text: line });
      variant.tokens.push({ formatting, text: '' });
    }
    this.variants.push(variant);
  }

  replaceMessage(id, source) { this.loadMessage(id, source); }

  /** Tokens for this message; variant -1 picks a random variant
   *  (uniform roll, injectable). Macro expansion pends the macro
   *  slice - callers get raw tokens today, loudly documented. */
  getTextTokens(variant = -1, roll = Math.random) {
    const index = variant === -1 ? Math.floor(roll() * this.variantCount) : 0;
    return [...this.variants[index].tokens];
  }

  getTextTokensByVariant(variant = 0) {
    return [...this.variants[variant].tokens];
  }
}
