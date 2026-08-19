// Generic C# enum extractor: returns {EnumName: {member: value}}
import fs from 'fs';

export function parseEnums(rawText) {
  // strip comments up front so `enum X //note` followed by { still matches
  const text = rawText.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const out = {};
  const re = /(?:public|internal|private)?\s*enum\s+(\w+)\s*(?::\s*\w+\s*)?\{/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = m[1];
    // find matching brace
    let i = m.index + m[0].length - 1;
    let depth = 0, start = i;
    for (; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') { depth--; if (depth === 0) break; }
    }
    const body = text.slice(start + 1, i);
    const members = {};
    let next = 0;
    // strip comments
    const clean = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/^\s*#\s*(region|endregion|if|else|elif|endif|pragma)[^\n]*/gm, '');
    for (const part of clean.split(',')) {
      const p = part.trim();
      if (!p) continue;
      const mm = /^\[[^\]]*\]\s*/.exec(p);
      const q = mm ? p.slice(mm[0].length) : p;
      const em = /^(\w+)\s*(?:=\s*(.+))?$/s.exec(q);
      if (!em) continue;
      let val;
      if (em[2] !== undefined) {
        const expr = em[2].trim().replace(/\((?:int|uint|byte|sbyte|short|ushort|long)\)\s*/g, '');
        if (/^-?0x[0-9a-fA-F]+$/.test(expr)) val = parseInt(expr, 16);
        else if (/^-?\d+$/.test(expr)) val = parseInt(expr, 10);
        else if (members[expr] !== undefined) val = members[expr];
        else {
          // try simple expression of members / numbers e.g. A | B, 1 << 3
          try {
            const js = expr.replace(/\b([A-Za-z_]\w*)\b/g, (s) => (members[s] !== undefined ? String(members[s]) : s));
            if (/^[-0-9a-fA-Fx()\s|&<>+*^]+$/.test(js)) val = Function('"use strict";return (' + js + ')')();
          } catch (e) { /* ignore */ }
        }
        if (val === undefined) { val = null; }
      } else {
        val = next;
      }
      members[em[1]] = val;
      if (typeof val === 'number') next = val + 1;
    }
    out[name] = members;
  }
  return out;
}

export function parseEnumsFile(path) { return parseEnums(fs.readFileSync(path, 'utf8')); }
