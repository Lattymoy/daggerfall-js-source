// STE-NOTES (2026-10-26, the owner: "The law for patch notes is now
// ASD-STE100 Simplified Technical English (STE)"): THE NOTES ARE WRITTEN
// IN STE. A pull request's `## Patch notes` (REL6) are what the release
// prints and the launcher shows, so they are read by players in every
// language the game speaks, many of them not in their first one - STE is
// the aerospace industry's controlled English for exactly that reader:
// one word, one meaning; short sentences; one topic to a sentence.
//
// This is the part of STE a machine can hold. It reads a description's
// notes as the release does (patchNotesOf - the same sections, the
// template's comment no notes) and reports each place they break:
//
//   - a sentence of more than 25 words; an instruction (a sentence that
//     starts with a command, after any "If ..., " condition) of more than 20
//   - a paragraph - a list item, or a block of prose - of more than six
//     sentences
//   - a semicolon
//   - an -ing form of a verb ("picking", "including"), except in a
//     technical name: a name mid-sentence keeps its capital, a control or
//     an item can be marked **bold** or `code`, and a noun that only ends
//     in -ing ("thing", "ring", "setting") is on NOT_A_VERB
//   - a contraction ("doesn't" - STE writes both words)
//   - a helping verb that makes a complex verb ("has been", "have taken" -
//     STE's verbs are the simple present, the simple past and the future)
//
// Counted as STE counts: a hyphenated word is one word, a number with its
// unit is one word, and a name in **bold**, `code` or "quotes" is one word.
// The rest of STE - the approved words in their approved meanings, an
// article before a noun, no noun cluster past three words, the active
// voice - is the writer's and the reviewer's
// (bible/01-Overview/Desktop-App.md, STE-NOTES). A clean run is not proof
// the notes are STE.
//
// The pull request's `ste-notes` check (.github/workflows/ste-notes.yml)
// runs this on every description; run it on a draft before you post it:
//
//   node scripts/steNotes.mjs <description.md>   (or - for stdin)
import { readFileSync } from 'node:fs';
import { patchNotesOf } from './desktopRelease.mjs';
import { isMain } from '../tools/lib/isMain.mjs';

/** STE: the most words in a sentence of descriptive writing. */
export const STE_SENTENCE_MAX = 25;
/** STE: the most words in an instruction. */
export const STE_INSTRUCTION_MAX = 20;
/** STE: the most sentences in a paragraph. */
export const STE_PARAGRAPH_MAX = 6;

/** Words that end in -ing and are no verb form: nouns, a preposition, base verbs. A word goes on with its reason.
 *  (A plural - "rings", "bindings" - is no verb form, and is never read.) */
export const NOT_A_VERB = new Set([
  'anything',
  'everything',
  'nothing',
  'something',
  'thing', // nouns
  'king',
  'ring',
  'earring',
  'string',
  'spring',
  'wing',
  'sling',
  'sting',
  'ceiling',
  'pudding',
  'sibling',
  'herring',
  'morning',
  'evening',
  'lightning',
  'clothing',
  'building',
  'setting',
  'rigging',
  'lodging',
  'during', // a preposition
  'bring',
  'cling',
  'fling',
  'sing',
  'swing',
  'wring', // base verbs
]);

/** Verbs an instruction starts with - an unambiguous few; a word that is also a common noun ("Set", "Update") is not one. */
const COMMANDS = new Set([
  'add',
  'ask',
  'buy',
  'choose',
  'click',
  'close',
  'craft',
  'disable',
  'do',
  'download',
  'drag',
  'enable',
  'enter',
  'equip',
  'find',
  'follow',
  'give',
  'go',
  'insure',
  'install',
  'keep',
  'leave',
  'let',
  'make',
  'open',
  'press',
  'put',
  'read',
  'remove',
  'restart',
  'right-click',
  'scroll',
  'see',
  'select',
  'sell',
  'send',
  'speak',
  'swap',
  'switch',
  'take',
  'talk',
  'tap',
  'toggle',
  'try',
  'use',
  'visit',
  'wait',
  'wear',
]);

/** A unit that counts as one word with the number before it. */
const UNITS = new Set([
  '%',
  's',
  'ms',
  'sec',
  'min',
  'h',
  'm',
  'cm',
  'km',
  'px',
  'kg',
  'g',
  'kb',
  'mb',
  'gb',
  'fps',
  'hz',
  '°',
]);

/** A stand-in for a name opens with this: it counts as one word and is never read for the word rules. */
const NAME = '\u0001';
const NAME_RE = /\u0001(\d+)\u0002/g;
const CODE_RE = /`+[^`\n]*`+/g;
const BOLD_RE = /\*\*[^*\n]+\*\*|__[^_\n]+__/g;
const QUOTED_RE = /"[^"\n]*"|“[^”\n]*”/g;
const LINK_RE = /!\[[^\]\n]*\]\([^)\n]*\)|\[([^\]\n]*)\]\([^)\n]*\)/g;
const URL_RE = /<?https?:\/\/[^\s>)]+>?/g;
const ENTITY_RE = /&(?:#\d+|#x[0-9a-f]+|[a-z]+);/gi;

const ITEM_RE = /^(\s*)(?:[-*+]|\d+[.)])\s+/;
const HEADING_RE = /^ {0,3}#{1,6}(?:\s|$)/;
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;
/** A clause that sets the condition of an instruction, which STE puts first. */
const CONDITION_RE = /^(?:if|when|before|after|to|while|once|until)\b[^,]*,\s*/i;
/** A full stop that is not the end of a sentence. */
const NOT_AN_END_RE = /\b(?:e\.g|i\.e|cf|vs|approx|etc)\.$/i;
const CONTRACTION_RE =
  /\b[a-z]+n['’]t\b|\b(?:i|you|we|they|he|she|it|that|there|here|what|who|where|let)['’](?:s|re|ll|ve|d|m)\b/gi;
/** A past participle that is no adjective in the notes (not "hit" of hit points, not "hidden" of hidden doors). */
const IRREGULAR =
  'been|gone|done|made|taken|given|seen|come|become|got|gotten|found|left|kept|lost|won|held|brought|built|bought|sold|fought|caught|taught|thought|told|said|paid|put|shot|struck|known|shown|grown|thrown|drawn|chosen|spoken|stolen|written|ridden|risen|fallen|forgotten|beaten|eaten|begun|sunk|flown|meant|sent|spent|felt|dealt|swept|read|led|fled|met|slid|stuck|spun|hung|dug|swung';
/** An -ed word is a verb when no noun follows it: "have fixed a bug", "has changed." - not "have enchanted items". */
const REGULAR =
  '(?!(?:speed|need|seed|feed|steed|deed|creed|greed|weed|bed|red|shed|sled|hundred|sacred|kindred|naked|wicked|rugged|ragged|jagged|crooked|beloved)\\b)[a-z]{2,}ed(?=\\s*$|\\s*[.,;:!?)]|\\s+(?:the|a|an|your|my|our|their|its|his|her|to|in|on|at|with|for|from|by|it|them|him|us|you|this|that|these|those|some|all|every|each|more|up|out|back|away|down|over|off|into|onto)\\b)';
const HELPING_RE = new RegExp(
  `\\b(?:has|have|had)\\s+(?:(?:not|now|already|also|never|just|since|always|only|all)\\s+)*(?:(?:${IRREGULAR})(?![-\\w])|${REGULAR})`,
  'gi',
);

/** A line's text with its names stood in for (each kept in `names`), its links read as their text and its markup gone. */
function plain(line, names) {
  const stand = (m) => `${NAME}${names.push(m) - 1}\u0002`;
  return line
    .replace(CODE_RE, stand)
    .replace(LINK_RE, (m, text) => text ?? '')
    .replace(URL_RE, stand)
    .replace(BOLD_RE, stand)
    .replace(QUOTED_RE, stand)
    .replace(ENTITY_RE, ' ')
    .replace(/(^|[\s(])[*_]+|[*_]+(?=[\s.,:!?)]|$)/g, '$1');
}

/** The words of a sentence as STE counts them. */
export function steWords(sentence) {
  const tokens = sentence.split(/\s+/).filter((t) => t.includes(NAME) || /[\p{L}\p{N}]/u.test(t));
  const words = [];
  for (const t of tokens) {
    const bare = t.replace(/^[^\p{L}\p{N}\u0001]+|[^\p{L}\p{N}%°\u0001]+$/gu, '').toLowerCase();
    if (UNITS.has(bare) && words.length && /^[±~≈]?\d[\d.,]*$/.test(words[words.length - 1])) continue;
    words.push(bare);
  }
  return words;
}

/** A paragraph's sentences: split after . ! or ? and a space, never inside "e.g." or a number. */
export function steSentences(text) {
  const parts = text.split(/(?<=[.!?]["'’”)\]]*)\s+/);
  const sentences = [];
  for (const p of parts) {
    if (sentences.length && NOT_AN_END_RE.test(sentences[sentences.length - 1]))
      sentences[sentences.length - 1] += ` ${p}`;
    else sentences.push(p);
  }
  return sentences.map((s) => s.trim()).filter((s) => steWords(s).length > 0);
}

/** The notes' paragraphs - each list item, block of prose, table cell or heading - in order. */
function paragraphsOf(notes) {
  const out = [];
  let open = null;
  let fence = null;
  const close = () => {
    if (open) out.push(open);
    open = null;
  };
  for (const line of notes.split('\n')) {
    if (fence) {
      if (fence.test(line)) fence = null;
      continue;
    }
    const opens = FENCE_RE.exec(line);
    if (opens) {
      close();
      fence = new RegExp(`^ {0,3}${opens[1][0] === '`' ? '`' : '~'}{${opens[1].length},}[ \\t]*$`);
      continue;
    }
    if (!line.trim()) {
      close();
      continue;
    }
    if (HEADING_RE.test(line)) {
      close();
      out.push({ heading: true, text: line.replace(/^ {0,3}#+\s*/, '').replace(/\s+#+\s*$/, '') });
      continue;
    }
    const body = line.replace(/^\s*>\s?/, '');
    if (/^\s*\|/.test(body)) {
      close();
      for (const cell of body.split('|').map((c) => c.trim()))
        if (cell && !/^:?-+:?$/.test(cell)) out.push({ heading: false, text: cell });
      continue;
    }
    const item = ITEM_RE.exec(body);
    if (item) {
      close();
      open = { heading: false, text: body.slice(item[0].length) };
      continue;
    }
    if (open) open.text += ` ${body.trim()}`;
    else open = { heading: false, text: body.trim() };
  }
  close();
  return out;
}

/** The -ing words a sentence (or a heading) uses as verbs. */
function ingForms(sentence, heading) {
  const found = [];
  const tokens = sentence.split(/\s+/).filter(Boolean);
  tokens.forEach((token, i) => {
    if (token.includes(NAME)) return;
    const word = token.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '').replace(/['’]s$/, '');
    for (const part of word.split('-')) {
      if (!part || /^\p{Lu}{2,}$/u.test(part)) continue;
      // a capital mid-sentence (or anywhere in a heading) marks a name
      if (/^\p{Lu}/u.test(part) && (heading || i > 0)) continue;
      const lower = part.toLowerCase();
      if (/^[a-z]{2,}ing$/.test(lower) && !NOT_A_VERB.has(lower)) found.push(part);
    }
  });
  return found;
}

/** A short quote of a sentence for a report, its names as written. */
const quote = (s, names) => {
  const t = s.replace(NAME_RE, (m, i) => names[Number(i)]);
  return `"${t.length > 90 ? `${t.slice(0, 89)}…` : t}"`;
};

/**
 * Where a description's patch notes break STE's rules a machine can read -
 * [] when they keep them, or when there are no notes.
 *
 * @param {string|null|undefined} description
 * @returns {Array<{ rule: string, message: string }>}
 */
export function steFindings(description) {
  const notes = patchNotesOf(description);
  const findings = [];
  const find = (rule, message) => findings.push({ rule, message });
  for (const para of paragraphsOf(notes)) {
    const names = [];
    const text = plain(para.text, names);
    const q = (s) => quote(s, names);
    const sentences = para.heading ? [text] : steSentences(text);
    if (!para.heading && sentences.length > STE_PARAGRAPH_MAX) {
      find(
        'paragraph',
        `a paragraph of ${sentences.length} sentences - STE allows ${STE_PARAGRAPH_MAX}: ${q(sentences[0])}`,
      );
    }
    for (const s of sentences) {
      if (!para.heading) {
        const words = steWords(s);
        const command = COMMANDS.has(steWords(s.replace(CONDITION_RE, ''))[0] ?? '');
        const max = command ? STE_INSTRUCTION_MAX : STE_SENTENCE_MAX;
        if (words.length > max) {
          find(
            'length',
            `${command ? 'an instruction' : 'a sentence'} of ${words.length} words - STE allows ${max}: ${q(s)}`,
          );
        }
      }
      if (s.includes(';')) find('semicolon', `a semicolon - STE uses none, write two sentences: ${q(s)}`);
      for (const w of ingForms(s, para.heading)) {
        find(
          'ing',
          `"${w}" is an -ing form - STE uses none outside a technical name (mark a name **bold** or \`code\`): ${q(s)}`,
        );
      }
      for (const m of s.matchAll(CONTRACTION_RE))
        find('contraction', `"${m[0]}" is a contraction - STE writes both words: ${q(s)}`);
      for (const m of s.matchAll(HELPING_RE)) {
        find(
          'helping-verb',
          `"${m[0]}" makes a complex verb - STE uses the simple present, the simple past or the future: ${q(s)}`,
        );
      }
    }
  }
  return findings;
}

function main(args) {
  const [path] = args;
  if (!path) {
    console.error('usage: steNotes.mjs <description.md> | -');
    return 2;
  }
  const description = readFileSync(path === '-' ? 0 : path, 'utf8');
  if (!patchNotesOf(description)) {
    console.log('no patch notes - nothing to check');
    return 0;
  }
  const findings = steFindings(description);
  if (!findings.length) {
    console.log(
      "the patch notes keep the STE rules this check reads (STE-NOTES) - the dictionary is the writer's and the reviewer's",
    );
    return 0;
  }
  console.log(
    `the patch notes break STE in ${findings.length} place${findings.length === 1 ? '' : 's'} (STE-NOTES, bible/01-Overview/Desktop-App.md):`,
  );
  for (const f of findings) console.log(`- ${f.message}`);
  return 1;
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));
