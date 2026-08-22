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

import { expandQuestMessage } from './questMacros.js';

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
   *  (uniform roll, injectable). QUIRK KEPT (Message.cs:161): any
   *  EXPLICIT variant answers variant 0 - DFU's else-arm is `index =
   *  0`, never `variant`. Use getTextTokensByVariant for real
   *  selection, as DFU's own callers do. Q4-i: macro expansion runs at
   *  token read, DFU's default. */
  getTextTokens(variant = -1, roll = Math.random, expandMacros = true) {
    const index = variant === -1 ? Math.floor(roll() * this.variantCount) : 0;
    const tokens = this.variants[index].tokens.map((t) => ({ ...t }));   // C# Token is a STRUCT - callers get copies (AUDIT quest-P17)
    // Q4-i: DFU expands macros by default at token read (Message.cs:
    // 170-183).
    // AUDIT 24 systems, TWO halves of Message.cs:174-183 the port left
    // out. (1) The reveal flag is not a parameter at all - C# passes
    // the LITERAL true, under Nystul's comment "reveal dialog linked
    // resources here on purpose (quest popups should reveal them)".
    // The port defaulted it to false and no caller ever passed true,
    // so a quest popup naming a Place or Person added no talk topic.
    // (GetTextTokensByVariant is the one that takes the false default
    // - QuestMacroHelper.cs:91 - and it still does, below.)
    // (2) The expansion is BRACKETED by
    // `ParentQuest.CurrentLogMessageId = this.id;` ... `= -1;`, the
    // only assignment to that field in the whole DFU tree. It is what
    // makes %qdt inside a log message answer the date THAT step was
    // written; without it getCurrentLogMessageTime never matched and
    // every %qdt printed the quest start.
    if (expandMacros) {
      const quest = this.parentQuest;
      // No try/finally: C# has none either, so a throwing expansion
      // (the %di NRE trio) really does leave the id latched.
      if (quest) quest.currentLogMessageId = this.id;
      expandQuestMessage(quest, tokens, true);
      if (quest) quest.currentLogMessageId = -1;
    }
    return tokens;
  }

  getTextTokensByVariant(variant = 0, expandMacros = true) {
    const tokens = this.variants[variant].tokens.map((t) => ({ ...t }));
    if (expandMacros) expandQuestMessage(this.parentQuest, tokens, false);
    return tokens;
  }

  /** GetSaveData (Message.cs:221-280): reconstruct SOURCE lines from
   *  the (unexpanded) variant tokens - later variants re-prefix the
   *  split token, centered lines re-prefix <ce>, and an unexpected
   *  formatting THROWS, verbatim. QUIRK KEPT: a second consecutive
   *  Text token flushes the line and DROPS ITSELF (C#'s continue) -
   *  unreachable through loadMessage's strict alternation. */
  getSaveData() {
    const lines = [];
    for (let variant = 0; variant < this.variants.length; variant++) {
      if (variant > 0) lines.push(SPLIT_TOKEN);
      let foundText = false;
      let currentLine = '';
      for (const token of this.variants[variant].tokens) {
        switch (token.formatting) {
          case Formatting.Text:
            if (foundText) {
              lines.push(currentLine);
              currentLine = '';
              foundText = false;
              continue;
            }
            currentLine += token.text;
            foundText = true;
            break;
          case Formatting.JustifyCenter:
            currentLine = CENTER_TOKEN + currentLine;
            lines.push(currentLine);
            currentLine = '';
            foundText = false;
            break;
          case Formatting.Nothing:
            lines.push(currentLine);
            currentLine = '';
            foundText = false;
            continue;
          default:
            throw new Error(`Message.GetSaveData() encountered unexpected formatting token ${token.formatting}`);
        }
      }
    }
    return { id: this.id, lines };
  }

  /** RestoreSaveData (Message.cs:282-285). */
  restoreSaveData(data) {
    this.loadMessage(data.id, data.lines);
  }
}
