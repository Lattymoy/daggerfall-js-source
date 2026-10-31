// What makes a comment history rather than a reason (HISTORY-OUT, bible/Home.md), and the deterministic rewrite that
// takes the history out. Shared by tools/commentTags.mjs (the ratchet) and tools/commentSweep.mjs (the sweep).
//
// The rewrite only removes clearly delimited history: a leading slice tag, a parenthetical that holds nothing but
// references, a comment that is only a tag. It never touches code, so `tools/sameProgram.mjs` proves a swept file.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const acorn = require('acorn');

/** Uppercase words with a digit or hyphen that are names, not slice tags. Rule names stay: they are law. */
export const NOT_TAGS = new Set([
  'ARENA2', 'MP3', 'UTF-8', 'UTF8', 'GL2', 'WEBGL2', 'X11', 'D1', 'R2', 'V8', 'SHA-1', 'SHA-256', 'MD5', 'ES2020',
  'ES2022', 'H264', 'TES3', 'A1', 'BAY-OWN', 'TAMRIEL-WIDE', 'HOST-SPLIT', 'PLAIN-TEXT', 'LOOT-GATE', 'SCOPE1',
  'POWER-CEILING', 'HISTORY-OUT', 'STE-NOTES', 'CITE-ANCHOR', 'RECORD-OPEN', 'IMG-CIF', 'MAP-PAL', 'RGB-565', 'UV0',
  'UV1', 'XY-Z', 'HTTP-2', 'IPV4', 'IPV6', 'CRC32', 'TEXTURE-211', 'X-Y', 'Z-UP', 'DXT1', 'DXT5', 'BC1', 'BC3',
]);

const TAG_CORE = String.raw`[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*[a-z]{0,2}`;
/** One slice or audit tag: an uppercase token with a digit or a hyphen (`PROF8`, `DW-C`, `FB1029d`, `EG-ZP`). */
export const isTag = (word) => {
  if (NOT_TAGS.has(word) || NOT_TAGS.has(word.replace(/[a-z]+$/, ''))) return false;
  if (!new RegExp(`^${TAG_CORE}$`).test(word)) return false;
  const core = word.replace(/[a-z]+$/, '');
  if (/\d/.test(core) && /[A-Z]/.test(core)) return core.length >= 2;
  const parts = core.split('-');
  return parts.length > 1 && parts[0].length >= 2 && core.length >= 4;
};

const DATE = String.raw`\b20\d\d-\d\d-\d\d[a-z]?\b`;
const BIBLE_PATH = String.raw`(?:bible\/)?(?:[\w-]+\/\s*)*(?:[A-Z][\w-]*|Home)\.md`;
const SECTION_REF = String.raw`(?:(?:sections?|§)\s*)?\d+(?:\.\d+)+[a-z]?|(?:sections?|§)\s*\d+[a-z]?`;
const QUOTE = String.raw`"[^"\n]*"|“[^”\n]*”|\*"[^"\n]*"\*|\*[^*\n]+\*`;
const WHO = String.raw`(?:Mac|the owner|Dudey|a player|the player|Mac's)`;

/** A comment line that carries history: a date, a bible page, an owner's quote, an audit, a moved pin or a leading tag. */
export const HISTORY_LINE = new RegExp([
  DATE,
  String.raw`bible\/`,
  String.raw`\b[A-Z][\w-]*-Arc\.md`,
  String.raw`\b${WHO}\s*[:,]\s*(?:${QUOTE})`,
  String.raw`\bAUDIT\b`,
  String.raw`PIN MOVED`,
  String.raw`FIELD BUGS`,
].join('|'));

const leadingTag = (text) => {
  const m = /^\s*((?:AUDIT\b|FIELD BUGS\b|PIN MOVED\b)?[\s\S]*?)(?=:|\s-\s|\s—\s|\s\()/.exec(text);
  if (!m) return false;
  const words = m[1].trim().split(/[\s,/&+]+/).filter(Boolean);
  if (!words.length || words.length > 6) return false;
  const lead = words.filter((w) => !/^(?:AUDIT|FIELD|BUGS|PIN|MOVED|and)$/.test(w) && !new RegExp(`^${DATE}$`).test(w));
  return lead.length > 0 && lead.every((w) => isTag(w) || /^[IVX]+$/.test(w) || /^\d+[a-z]?$/.test(w))
    && (lead.some(isTag) || /^(?:AUDIT|FIELD BUGS|PIN MOVED)/.test(m[1].trim()));
};

/** Does one comment line (its text, without `//` or ` * `) carry history? */
export const isHistoryLine = (text) => HISTORY_LINE.test(text) || leadingTag(text);

const FILLER = new Set(('see and since at per in its the of on from after before by with then also as a an was is now '
  + 'made here below above this that for to it s slice audit section sections merge field bugs fix pass moved pin '
  + 'record records the owner mac dudey player says said asked shipped rule law page arc it\'s via who where').split(' '));

/** Does a parenthetical hold nothing but references (tags, bible pages, sections, dates, owner quotes)? */
function refOnly(inner) {
  const marked = new RegExp(`${BIBLE_PATH}|${DATE}|(?:sections?|§)\\s*\\d|${WHO}\\s*[:,]\\s*(?:${QUOTE})|\\bAUDIT\\b`).test(inner)
    || inner.split(/[\s,;:()/]+/).some(isTag);
  if (!marked) return false;
  let rest = inner
    .replace(new RegExp(`${WHO}\\s*[:,]?\\s*(?:(?:${QUOTE})\\s*[,;]?\\s*(?:then|and)?\\s*)+`, 'g'), ' ')
    .replace(new RegExp(BIBLE_PATH, 'g'), ' ')
    .replace(new RegExp(DATE, 'g'), ' ')
    .replace(new RegExp(SECTION_REF, 'g'), ' ');
  const words = rest.split(/[\s,;:.()/'"`*-]+/).filter(Boolean);
  const left = words.filter((w) => !isTag(w) && !FILLER.has(w.toLowerCase()) && !/^\d+[a-z]?$/.test(w) && !/^[IVX]+$/.test(w));
  return left.length === 0 && /[A-Za-z0-9]/.test(inner);
}

/** Take the history out of one comment's text (its lines joined by `\n`, markers stripped), paragraph by paragraph. */
export function cleanText(text) {
  return text.split(/\n[ \t]*\n/).map(cleanParagraph).filter((p) => p !== '').join('\n\n');
}

function cleanParagraph(text) {
  let out = text;
  // a whole comment that is only a moved-pin note or only tags goes
  if (/^\s*PIN MOVED\b/.test(out)) return '';
  // parentheticals that are only references, innermost first
  for (let i = 0; i < 4; i++) {
    const next = out.replace(/\s?\(([^()]*)\)/g, (all, inner) => (refOnly(inner) ? '' : all));
    if (next === out) break;
    out = next;
  }
  // bible paths, with the section numbers after them, left inside prose or kept parentheticals
  out = out.replace(new RegExp(`[ \\t]*${BIBLE_PATH}(?:\\s+(?:${SECTION_REF}|\\d+[a-z]?)(?:\\s*,\\s*(?:${SECTION_REF}|\\d+[a-z]?))*)?`, 'g'), '');
  // a leading tag and its separator
  const tagged = leadingTag(out);
  if (tagged) out = out.replace(/^(\s*)(?:AUDIT\b|FIELD BUGS\b|PIN MOVED\b)?[\s\S]*?(?::|\s-\s|\s—\s)\s*/, '$1');
  // a comment left as nothing but tags
  const words = out.trim().split(/[\s,/&+:;.()]+/).filter(Boolean);
  if (words.some((w) => isTag(w) || w === 'AUDIT') && words.every((w) => isTag(w) || /^(?:AUDIT|FIELD|BUGS|\d+[a-z]?|[IVX]+)$/.test(w))) return '';
  // tidy what the cuts left
  out = out.replace(/,[ \t]*;/g, ';').replace(/\([ \t]*[,;][ \t]*/g, '(').replace(/[ \t]*[,;][ \t]*\)/g, ')').replace(/^[ \t]*[-–—:;,][ \t]*/, '');
  if (tagged) out = out.replace(/^(\s*)([a-z])(?=[a-z]*(?:[\s,;:.!?'-]|$))/, (_, s, c) => s + c.toUpperCase());   // a plain word, never an identifier
  return /[A-Za-z0-9]/.test(out) ? out : '';
}

/** Every comment in a source, as acorn sees it: `{ block, start, end }`. Null when the file does not parse. */
export function commentsOf(source) {
  const out = [];
  const opts = { ecmaVersion: 'latest', allowHashBang: true, allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true,
    onComment: (block, text, start, end) => out.push({ block, start, end }) };
  try { acorn.parse(source, { ...opts, sourceType: 'module' }); } catch {
    out.length = 0;
    try { acorn.parse(source, { ...opts, sourceType: 'script' }); } catch { return null; }
  }
  return out;
}

/** The comment lines of a source that carry history (each line of a block comment counts once). */
export function historyLines(source) {
  const comments = commentsOf(source);
  if (!comments) return 0;
  let n = 0;
  for (const c of comments) {
    const body = source.slice(c.start + 2, c.block ? c.end - 2 : c.end);
    for (const line of body.split('\n')) if (isHistoryLine(line.replace(/^\s*\*?\s?/, ''))) n++;
  }
  return n;
}
