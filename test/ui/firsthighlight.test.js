// FIRST-HIGHLIGHT (a player's ask: "a highlight on the border of items not yet crafted - the material strong, the item type subtler, a moving
// blue dashed edge, not too bright"): a pattern card and a material button wear a class while a first-time bonus is owed on them
// (ui/professions/profPages.js patternRows, materialRow - the game's own `first` answer, CRAFT-HALL), and the style draws the dashes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { patternRows, materialRow } from '../../src/ui/professions/profPages.js';
import { RECIPES } from '../../src/net/recipeLaw.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** A stand-in element: what the builders read and write, nothing more. */
const el = (tag, cls = '', text = '') => ({ tag, className: cls, textContent: text, children: [], type: '', disabled: false, onclick: null, append(...c) { this.children.push(...c); } });
const stand = () => ({ open: true, can: true, raw: false });
const smith = RECIPES.filter((r) => r.profession === 'smithing' && (r.product === 'dagger' || r.product === 'tanto'));
const classesOf = (node) => node.children.map((b) => [b.children?.[0]?.textContent ?? b.textContent, b.className]);

test('FIRST-HIGHLIGHT patterns: a card wears the owed class while any open grade of its pattern still owes a first-time bonus - and not once every grade is made, nor when nothing is known (mutants: the class on every card; a made pattern lit; unknown lit)', () => {
  const draw = (first) => { const detail = el('div'); patternRows(detail, el, smith, { show: 'all' }, () => {}, { stand, word: () => 'can make now', first }); return detail.children.at(-1); };   // the grid is the last child
  const owedDagger = draw((r) => r.product === 'dagger');
  const rows = Object.fromEntries(owedDagger.children.map((b) => [b.children[0].textContent, b.className]));
  assert.match(rows.Dagger, /\bprof-owed-pattern\b/, 'a dagger with grades still owed');
  assert.doesNotMatch(rows.Tanto, /prof-owed-pattern/, 'a tanto whose every grade is made');
  const noneOwed = draw(() => false);
  assert.ok(noneOwed.children.every((b) => !b.className.includes('prof-owed-pattern')), 'all made: none lit');
  const unknown = draw(() => null);
  assert.ok(unknown.children.every((b) => !b.className.includes('prof-owed-pattern')), 'nothing known: none lit');
  const noFirst = draw(null);
  assert.ok(noFirst.children.every((b) => !b.className.includes('prof-owed-pattern')), 'a service that sends no list: none lit');
});

test('FIRST-HIGHLIGHT materials: a material button wears the owed class for the grades whose first-time bonus is owed, the others none (mutants: every material lit; the star and the class apart)', () => {
  const daggers = smith.filter((r) => r.product === 'dagger');
  const picked = daggers.find((r) => r.id === 'dagger:steel');
  const box = el('div');
  materialRow(box, el, smith, picked, { picked: picked.id }, () => {}, stand, false, (r) => r.id === 'dagger:steel' || r.id === 'dagger:silver');
  const row = box.children[0];
  const lit = row.children.filter((b) => b.className.includes('prof-owed')).map((b) => b.textContent);
  assert.deepEqual(lit, ['Steel ★', 'Silver ★'], 'the two owed grades, each with the game\'s own star');
  assert.ok(row.children.filter((b) => !b.className.includes('prof-owed')).every((b) => !b.textContent.includes('★')), 'the others carry neither');
  const none = el('div');
  materialRow(none, el, smith, picked, { picked: picked.id }, () => {}, stand, false, () => false);
  assert.ok(none.children[0].children.every((b) => !b.className.includes('prof-owed')), 'all made: none lit');
});

test('FIRST-HIGHLIGHT style: a moving dashed edge in a soft blue, the pattern card fainter and slower than the material, still in a reduced-motion setting (by source; mutants: the animation dropped; the card as bright as the material)', () => {
  const css = rd('src/ui/enhanced/enhancedPlusStyle.js');
  assert.match(css, /\.prof-family\.prof-owed, \.prof-recipe\.prof-owed-pattern \{[\s\S]*?animation: prof-owed-dash 1\.4s linear infinite;/);
  assert.match(css, /\.prof-recipe\.prof-owed-pattern \{ --dash: rgba\(120, 175, 245, 0\.45\); animation-duration: 2\.6s; \}/, 'the card: fainter, slower');
  assert.match(css, /--dash: rgba\(120, 175, 245, 0\.85\)/, 'the material: the stronger');
  assert.match(css, /@keyframes prof-owed-dash \{ to \{ background-position: 12px 0, -12px 100%, 0 12px, 100% -12px; \} \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.prof-family\.prof-owed, \.prof-recipe\.prof-owed-pattern \{ animation: none; \} \}/);
});
