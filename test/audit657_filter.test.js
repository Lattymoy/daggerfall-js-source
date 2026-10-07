// AUDIT 657 (2026-10-07, Mac: "Lets do an audit on everything so far"): THE WORD FILTER'S FINDINGS, PINNED - lens T of
// PR #657's audit (TEXT-F1, net/nameFilter.js's sentence reader) and lens D's D1 and D9. No word a list holds is written
// here: each is read off the lists themselves. Each fix carries an `AUDIT 657 <ID>` comment where it stands. The record:
// bible/01-Overview/Audit-657.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import * as acorn from 'acorn';
import { maskText, textCaught, checkName, INNOCENT, CRUDE, SLURS, ANYWHERE, listIsNormalised } from '../src/net/nameFilter.js';
import { sanitizeChat } from '../src/net/wire.js';
import { shipNameVerdict } from '../src/systems/fleet.js';
import { shownItemName } from '../src/systems/itemInfo.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const LISTED = [...new Set([...ANYWHERE.flatMap((g) => g.words), ...SLURS, ...CRUDE])];
const starred = (s) => [...s].every((ch) => ch === '*');

test('AUDIT 657 T1 (= D1) the words that hold a listed one innocently read as themselves: "he gave a snigger", "a niggardly sum", "spiced wine", a booby trap, a cocky duellist, a pricked finger, a merchant who will dicker - and the game\'s own names that a list word and a tail spell (the Spices shop, the Spiced ships, Spicy Grilled Lizard); a name NAME-F1 let through before TEXT-F1 passes again (mutants: the innocent words never read out; read out of names only; a sentence\'s innocent word read against the lists)', () => {
  const fine = ['he gave a snigger', 'stop sniggering', 'a niggardly sum', 'spiced wine and spices', 'a spicy stew', 'they titter', 'a booby trap',
    'do not get cocky', 'a cocked crossbow', 'cocking the crossbow', 'we can dicker over the price', 'knobby knees', 'a knobbed staff',
    'he pricked his finger', 'pricking the skin', 'a spunky pup', 'Spicy Grilled Lizard', 'The Spiced Heron', 'Spices'];
  for (const line of fine) assert.equal(maskText(line), line, line);
  for (const name of ['Snigger', 'Sniggerton', 'Niggardly']) assert.equal(checkName(name).ok, true, name);
  assert.equal(shownItemName({ name: 'Spicy Grilled Lizard' }), 'Spicy Grilled Lizard', 'a dish\'s name in the pack');
  // what the lists hold is caught as before - beside an innocent word too
  for (const w of LISTED) assert.ok(starred(maskText(w)), `listed word #${LISTED.indexOf(w)}`);
  for (const w of ANYWHERE.flatMap((g) => g.words)) {
    assert.ok(textCaught(`${INNOCENT[0]}${w}`), 'an innocent word glued to one ANYWHERE holds - in a sentence');
    assert.equal(checkName(`${INNOCENT[0]}${w}`).ok, false, '- and in a name');
  }
  assert.equal(checkName('Cocky').ok, false, 'a name\'s verdict on a list word and a tail is NAME-F1\'s, unmoved');
  // the list: written normalised, and never a word a list holds
  assert.ok(listIsNormalised(INNOCENT));
  assert.deepEqual(INNOCENT.filter((w) => LISTED.includes(w)), []);
});

test('AUDIT 657 T1 (= D1) every name the port quotes in its own source reads unchanged - every capitalised string literal of up to six words, parsed (acorn), not only the ones a `name:` key holds: the Spices shop stood in a list, the Spiced ships in another, and TEXT-F1\'s walk never read either (mutant: the innocent words never read out)', () => {
  const NAME = /^[A-Z][A-Za-z'-]*(?: [A-Za-z'-]+){0,5}$/;
  const names = new Set();
  const visit = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { for (const x of n) visit(x); return; }
    if (n.type === 'Literal' && typeof n.value === 'string' && n.value.length >= 3 && n.value.length <= 48 && NAME.test(n.value)) names.add(n.value);
    for (const v of Object.values(n)) if (v && typeof v === 'object') visit(v);
  };
  const walk = (d) => {
    for (const f of readdirSync(new URL(`../${d}`, import.meta.url))) {
      const p = `${d}/${f}`;
      if (statSync(new URL(`../${p}`, import.meta.url)).isDirectory()) walk(p);
      else if (p.endsWith('.js') && p !== 'src/net/nameFilter.js') visit(acorn.parse(src(p), { ecmaVersion: 'latest', sourceType: 'module' }));
    }
  };
  walk('src');
  assert.ok(names.size > 5000, `${names.size} names read`);
  assert.ok(['Spices', 'Spiced', 'Spicy Grilled Lizard'].every((n) => names.has(n)), 'the three TEXT-F1 starred, read');
  assert.deepEqual([...names].filter((n) => maskText(n) !== n), [], 'no name the port carries is starred');
});

test('AUDIT 657 T2 a letter\'s combining accent is part of its word: every list word written with one (a vowel and U+0301, the accent stage 1 folds away) is starred whole, accent and all, the line\'s count of characters kept - it stood between words, and split the word in two (mutant: the marks no word\'s)', () => {
  for (const w of LISTED.filter((x) => /[aeiou]/.test(x))) {
    const accented = w.replace(/[aeiou]/, (v) => `${v}\u0301`);
    const out = maskText(`you ${accented} there`);
    assert.equal(out, `you ${'*'.repeat([...accented].length)} there`, `listed word #${LISTED.indexOf(w)}`);
  }
  // a spelled word with an accent on a letter is still a run of one-letter words - caught, and starred from its start
  for (const w of LISTED.filter((x) => x.length >= 4)) {
    const line = w.split('').map((c, k) => (k === 1 ? `${c}\u0301` : c)).join(' ');
    assert.ok(textCaught(line), `listed word #${LISTED.indexOf(w)} spelled, accented`);
    assert.ok(maskText(line).startsWith('* *'), `listed word #${LISTED.indexOf(w)} starred from its start`);
  }
  assert.equal(maskText('caf\u0065\u0301 au lait'), 'caf\u0065\u0301 au lait', 'an innocent accent untouched');
});

test('AUDIT 657 T3 a word said at someone - an at sign before it - is read without the sign, which stays the sentence\'s: `@` is the leet `a`, and the word read as `a` and itself passed (mutant: the at sign no word\'s edge)', () => {
  for (const w of LISTED) assert.equal(maskText(`@${w}`), `@${'*'.repeat(w.length)}`, `listed word #${LISTED.indexOf(w)}`);
  assert.equal(maskText('@Bran see you at the keep'), '@Bran see you at the keep');
  assert.ok(starred(maskText(`${CRUDE.find((w) => w.startsWith('a'))?.replace('a', '@') ?? '*'}`)), 'the leet a inside a word is still its letter');
});

test('AUDIT 657 T4 a ship\'s name is read word by word, as a rank\'s name is: checkName read "Big X Barge" as one word, and a word the lists catch stood in it - said to every crew that saw her; the other side judges a wire name by the same verdict (mutant: a ship\'s name read whole only)', () => {
  assert.deepEqual(shipNameVerdict('Laden Gull'), { ok: true, name: 'Laden Gull', reason: null });
  assert.equal(shipNameVerdict('The Spiced Heron').ok, true);
  assert.equal(shipNameVerdict('Cumberland Rose').ok, true, 'Scunthorpe\'s rule holds in a ship\'s name');
  for (const w of CRUDE.filter((x) => !INNOCENT.includes(x))) {
    const v = shipNameVerdict(`Big ${w} Barge`);
    assert.equal(v.ok, false, `crude word #${CRUDE.indexOf(w)}`);
    assert.equal(v.name, '');
    assert.match(v.reason, /^That name reads as ".+"\. Please pick another\.$/);
  }
  assert.match(src('src/systems/comeSailAwayWire.js'), /const v = shipNameVerdict\(raw\);\n\s*return v\.ok \? v\.name : '';/, 'a peer\'s wire name judged by the same verdict');
});

test('AUDIT 657 T5 a run of one-letter words read once where it can hold no word: every window of it a reading of its own cost a 240-letter chat line 7 ms at the relay - now within a few times an ordinary line of its length; every spelled word still caught (mutant: every window read)', () => {
  for (const w of LISTED) {
    const line = w.split('').join(' ');
    assert.ok(textCaught(line), `listed word #${LISTED.indexOf(w)} spelled`);
    assert.ok(maskText(line).startsWith('* * *'), `listed word #${LISTED.indexOf(w)} starred from its start`);
  }
  const spelled = 'q z '.repeat(200), prose = 'The quick brown fox jumps over the lazy dog near the old keep. '.repeat(13);
  const med = (s) => {
    const t = [];
    for (let k = 0; k < 15; k++) { const t0 = process.hrtime.bigint(); maskText(s); t.push(Number(process.hrtime.bigint() - t0)); }
    return t.sort((a, b) => a - b)[7];
  };
  for (let i = 0; i < 3; i++) { med(spelled); med(prose); }
  const ratio = Math.min(...[0, 1, 2].map(() => med(spelled) / med(prose)));
  assert.ok(ratio < 15, `800 one-letter words cost ${ratio.toFixed(1)} times 800 letters of prose (every window read: about 30)`);
});

test('AUDIT 657 D9 the mask never lengthens a line - one star a letter, so a letter past the Basic Plane (two UTF-16 units) is one star and the line shorter; its count of characters kept (mutant: none - the claim the words make)', () => {
  const w = CRUDE.find((x) => /^[a-z]{4}$/.test(x));
  const bold = [...w].map((c) => String.fromCodePoint(0x1d41a + c.charCodeAt(0) - 97)).join('');
  const line = `${bold} off`;
  const out = maskText(line);
  assert.equal(out, '**** off');
  assert.ok(out.length < line.length && [...out].length === [...line].length);
  assert.equal(sanitizeChat(line), '**** off');
  assert.match(src('src/net/nameFilter.js'), /and it never grows: a bound measured before it holds after it/);
});
