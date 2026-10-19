// A layout-only change for the LEGIBLE 2 tests (test/tooling/legible2_*.test.js): a line break after every `;`, `{`
// and `}` that has more code after it on its line - what a formatter does to a crowded line, without a formatter. It
// touches only the gaps between tokens, and only gaps of spaces and tabs, so strings, regexes, comments and template
// text are never split. A `}` that closes a template's `${...}` is left alone: the text after it is the template's.
import { tokenizer } from 'acorn';

export function breakLines(source) {
  const tokens = [...tokenizer(source, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true })];
  let out = '';
  let copiedTo = 0;
  for (let i = 0; i < tokens.length - 1; i++) {
    const token = tokens[i], next = tokens[i + 1];
    if (!['{', '}', ';'].includes(token.type.label)) continue;
    if (token.type.label === '}' && (next.type.label === 'template' || next.type.label === '`')) continue;
    if (!/^[ \t]+$/.test(source.slice(token.end, next.start))) continue;
    out += source.slice(copiedTo, token.end) + '\n';
    copiedTo = next.start;
  }
  return out + source.slice(copiedTo);
}
