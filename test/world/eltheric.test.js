// ELTHERIC (2026-10-12, the owner: "Apparently the ocean is suppose to be eltheric not etheric"; bible/03-World/
// Eltheric-Ocean.md ELTHERIC) - THE SEA PAST THE VEIL IS THE ELTHERIC OCEAN: the lore's, and the name the intro map had
// already given the waters west of the Bay. It was "the Etheric Sea", in fourteen literals across eight modules; the word
// has one home now (world/ethericSea.js ETHER_WORD) and every word a player reads of the sea is made of it. Its code -
// the ETHER-* arcs, `ethericSea.js`, the ledger's `ether` trade key and every save's `ether` record - keeps its names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { ETHER_WORD, ETHER_SEA_NAME, ETHER_SEA_TITLE } from '../../src/world/ethericSea.js';
import { ETHER_REGION_NAME } from '../../src/world/etherPlaces.js';
import { SEAS } from '../../src/world/tamriel/tamrielGeography.js';
import { crossingRows, crossingWords } from '../../src/systems/naval/etherCrossing.js';
import { logLines, newLog, TRADE_WORD, TRADE_WORDS } from '../../src/systems/naval/captainLedger.js';
import { etherOfficeText } from '../../src/ui/naval/navalYardWindow.js';
import { ETHER_CHART_CSS } from '../../src/ui/etherChartWindow.js';

const ROOT = new URL('../..', import.meta.url).pathname;
const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : []; });

test('ELTHERIC: the word, the name at a sentence\'s middle and head, the isles\' region - and the intro map\'s ocean west of the Bay the same (mutant: the word another)', () => {
  assert.equal(ETHER_WORD, 'Eltheric');
  assert.deepEqual([ETHER_SEA_NAME, ETHER_SEA_TITLE, ETHER_REGION_NAME], ['the Eltheric Ocean', 'The Eltheric Ocean', 'the Eltheric Isles']);
  assert.equal(SEAS[0].name, `${ETHER_WORD} Ocean`, 'one ocean, one name');
});

test('ELTHERIC: every word a player reads of the sea is the one home\'s - the crossing, the ledger, the harbourmaster\'s tab (mutants: a literal for the word)', () => {
  assert.equal(crossingRows('out')[2], `here the sea is no longer the sea, but the ${ETHER_WORD}.`);
  assert.match(crossingWords('out'), new RegExp(`You have crossed into ${ETHER_SEA_NAME}\\. Veilhaven lies ahead\\.$`));
  const lines = Object.fromEntries(logLines({ ...newLog(), islands: 2, deepest: 3 }));
  assert.deepEqual([lines[`${ETHER_WORD} isles charted`], lines[`Deepest ${ETHER_WORD} waters`]], ['2', '3 leagues past the Veil']);
  assert.deepEqual([TRADE_WORD.ether, TRADE_WORDS.ether], [`${ETHER_WORD} ship`, `${ETHER_WORD} ships`]);
  assert.match(etherOfficeText({ port: 'Veilhaven', waters: 'the Shallows', charted: 2, rumours: [] }).lede, new RegExp(`^Veilhaven - a freeport of ${ETHER_SEA_NAME}, in the Shallows\\.`));
});

test('ELTHERIC: no code names the sea "Etheric" any more, and the word is written in one module (the intro map\'s table beside it) - comments may speak of it, code may not spell it', () => {
  const stale = [], spelt = [];
  for (const file of walk(join(ROOT, 'src'))) {
    const rel = file.slice(ROOT.length);
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const code = line.replace(/^\s*(\/\/|\*|\/\*).*$/, '').replace(/\s\/\/\s.*$/, '');
      if (/\bEtheric\b|\bETHERIC\b/.test(code)) stale.push(`${rel}:${i + 1}`);
      if (/\bEltheric\b/.test(code)) spelt.push(rel);   // no identifier holds the word: code that names it spells it
    });
  }
  assert.deepEqual(stale, [], 'the old name in no code');
  assert.deepEqual([...new Set(spelt)].sort(), ['src/world/ethericSea.js', 'src/world/tamriel/tamrielGeography.js'], 'the word spelt in its one home and the map\'s table alone');
});

test('ELTHERIC: the chart\'s title wraps on a narrow screen - its longer name was cut on a phone held upright (measured in Chromium, tools/etherChartProbe.mjs; mutant: the rule dropped)', () => {
  assert.match(ETHER_CHART_CSS, /@media \(max-width: 560px\) \{\n {2}\.dfchart-win \.dfnaval-wintitle h2 \{ white-space: normal; text-overflow: clip; \}\n\}/);
});
