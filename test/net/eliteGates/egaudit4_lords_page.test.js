// AUDIT EG IV (2026-10-13, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 12, 13.3 and 13.4) - THE LORDS'
// PAGE AS THE GAME HAS IT: section 13.4 names the brain that was built (`net/eliteGates/egLords.js` - lane 1 #29); the Ward-Bearer's job is the
// Rampart's portcullis alone and Ilthys's banner an errand's object (lane 1 #28); the lords' pronouns are the game's - Ilthys and
// Seyth "she" (their cards), Grath "he" (his card), the Night-Stalker "it" (its card and its Annals page) - lane 9 #18; and the
// Haven Nova's three numbers are the code's own measure over the Spellmaster's court (lane 1 #9; net/eliteGates/egLords.js egHavenRouteM).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { egHallOf } from '../../../src/net/eliteGates/egLaw.js';
import { egHavenRouteM } from '../../../src/net/eliteGates/egLords.js';
import { egErrandMs } from '../../../src/net/eliteGates/egShape.js';
import { ILIAC_CARDS } from '../../../src/net/iliac/iliacCards.js';
import { cardFlavor } from '../../../src/systems/iliac/iliacCardWords.js';   // PIN MOVED (the merge of main past KG-SET): a card's flavor is the words module's, read through the text core

const page = readFileSync(new URL('../../../bible/11-Multiplayer/Elite-Gates.md', import.meta.url), 'utf8');
/** A section of the page, from its heading to the next of its depth or higher. */
function section(head) {
  const at = page.indexOf(`\n${head}`);
  assert.ok(at >= 0, `the page has ${head}`);
  const depth = head.match(/^#+/)[0].length, rest = page.slice(at + 1 + head.length);
  const next = rest.search(new RegExp(`\\n#{1,${depth}} `));
  return head + (next >= 0 ? rest.slice(0, next) : rest);
}

test('AUDIT EG IV lane1 #29 and #28 SECTIONS 12 AND 13.4 NAME WHAT WAS BUILT: the Valkynaz\'s one brain is net/eliteGates/egLords.js (never net/egLord.js, the brain EG-PLAY built and layer one retired); a Ward-Bearer holds a Rampart\'s portcullis (no lord is warded by one), and the Conquest\'s banner is an errand\'s object (mutants: the old names)', () => {
  const s134 = section('### 13.4 The Valkynaz'), s12 = section('## 12. The legion - relentless adds');
  assert.ok(s134.includes('ONE brain (`net/eliteGates/egLords.js`)') && !s134.includes('net/egLord.js'), '13.4: net/eliteGates/egLords.js');
  assert.ok(!s12.includes('a ward on what it guards (a lord, a portcullis)') && s12.includes('stands and pulses before a Rampart\'s portcullis'), '12: the Ward-Bearer\'s one job');
  assert.ok(!s134.includes('(a Ward-Bearer body)') && s134.includes('a banner (an errand\'s object, struck)'), '13.4: the banner');
});

test('AUDIT EG IV lane9 #18 THE LORDS\' PRONOUNS ARE THE GAME\'S: Ilthys and Seyth "she" on the page as on their cards, Grath "he" as on his card, the Night-Stalker "it" as on its card (mutants: the page\'s "he" for Ilthys or Seyth, "it" for Grath, "he" for the Night-Stalker)', () => {
  const card = (id) => cardFlavor(ILIAC_CARDS.find((c) => c.id === id));
  assert.match(card('eg-ilthys'), /\bShe\b|\bshe\b/); assert.match(card('eg-seyth'), /\bher\b/); assert.match(card('eg-grath'), /\bhim\b|\bhe\b/); assert.match(card('eg-stalker'), /^It\b/);
  const s134 = section('### 13.4 The Valkynaz'), s133 = section('### 13.3 The roster');
  const ilthys = s134.split('\n').find((l) => l.startsWith('| **Ilthys')), seyth = s134.split('\n').find((l) => l.startsWith('| **Seyth'));
  assert.ok(/she plants a banner/.test(ilthys) && /hold her ward/.test(ilthys) && !/\bhis\b|\bhe\b/.test(ilthys), 'Ilthys: she');
  assert.ok(/beside her/.test(seyth) && /casts her ground mark/.test(seyth) && !/\bhis\b|\bhim\b/.test(seyth), 'Seyth: she');
  const grath = s133.slice(s133.indexOf('1. **Grath'), s133.indexOf('2. **The Last Spellmaster'));
  assert.ok(/He bounds/.test(grath) && !/\bIt bounds|\bit gores/.test(grath), 'Grath: he');
  const stalker = s133.slice(s133.indexOf('9. **The Night-Stalker'), s133.indexOf('10. **Valkynaz Seyth'));
  assert.ok(/It vanishes/.test(stalker) && !/\bHe\b|\bhis\b|\bhim\b/.test(stalker), 'the Night-Stalker: it');
});

test('AUDIT EG IV lane1 #9 THE HAVEN NOVA\'S NUMBERS ON THE PAGE ARE THE CODE\'S (section 13.3): each wind-up and route the page gives for two, three and four havens is net/eliteGates/egLords.js egHavenRouteM over the Spellmaster\'s court and its errand floor (mutants: the measure moved)', () => {
  const s133 = section('### 13.3 The roster');
  const said = [...s133.matchAll(/([\d.]+) s for (two|three|four)(?: havens)? \(([\d.]+) m/g)].map((m) => [m[2], Number(m[1]), Number(m[3])]);
  assert.equal(said.length, 3, 'three numbers said');
  const spec = egHallOf(1, 15, 0), f = spec.fl.find((q) => q.t === 'd'), all = spec.spots.haven.map((p) => [p.x, p.z, 3]);
  assert.equal(spec.lord, 'spellmaster');
  for (const [word, s, m] of said) {
    const k = { two: 2, three: 3, four: 4 }[word], route = egHavenRouteM(all.slice(0, k), f);
    assert.equal(s, egErrandMs(route) / 1000, `${k} havens: ${s} s`);
    assert.ok(m <= route && route - m <= 0.4, `${k} havens: the route said ${m} m, measured ${route.toFixed(2)} m`);
  }
});
