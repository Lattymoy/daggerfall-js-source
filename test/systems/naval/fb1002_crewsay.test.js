// FIELD BUGS 2026-10-02 - CREW-SAY. Mac, testing sailing: "your crew mates speaking sometimes seems like gibberish".
// Nothing scrambles a crewman's words - every line is the tables' own English (systems/naval/crewLife.js,
// shipCrew.js) - but the bubbles that carry them (ui/naval/navalHud.js drawCrewLines) stood on their own heads with nothing
// between them, at 0.62 of an opaque ground, the farther painted OVER the nearer: the chorus is every hand at once (each
// copy behind its own name, so each wrapped at its own words) and stood up to six deep; a talk's two lines stood side by
// side over two hands side by side; and a bubble's foot, 6 px over the head point a hand's bar stands on, covered a
// mate's name and health over his bar. Read through each other, they read as gibberish. The pins, each red on the code
// before:
//   THE CHORUS ONCE    - a line two or more say at once is laid once, over the nearest of them, by no name; a line one
//                        hand says alone keeps his name (world.js hands the name beside the line, never in it)
//   NEVER OVER         - every bubble laid clear of every nearer one, lifted over it; the nearest at its own place and
//                        drawn over the rest - over five minutes of a real crew's words seen from the helm
//   A MATE'S NAME      - a bubble's foot (its tail under it) clear of a mate's bar and the name over it, by the sheet's
//                        own numbers; and its box the sheet's - a content box, its padding and ring outside its words
// `01-Overview/bugs/Field-Bugs-2026-10-02.md`.
import '../../modsOff.js';
import { byClass } from '../../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCrewLife, crewRoster, CHANTIES, sung } from '../../../src/systems/naval/crewLife.js';
import { MOBILE } from '../../../src/systems/naval/navalBoarding.js';
import { buildDeck } from '../../../src/systems/naval/navalDeck.js';
import { boxColliderTriangles } from '../../../src/world/prefabColliders.js';
import {
  drawCrewLines, layoutCrewLines, crewSayBox, destroyNavalHud, NAVAL_HUD_CSS,
  CREW_SAY_MAX, CREW_SAY_LIFT, CREW_SAY_GAP,
} from '../../../src/ui/naval/navalHud.js';

const WORLD = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
/** livingcrew's plain deck: a flat 8 m by 24 m at 2 m with a mast amidships. */
const plainDeck = () => buildDeck([
  { positions: [-4, 2, -12, 4, 2, -12, 4, 2, 12, -4, 2, 12], indices: [0, 1, 2, 0, 2, 3] },
  boxColliderTriangles({ m_Center: { x: 0, y: 6, z: 0 }, m_Size: { x: 1.2, y: 8, z: 1.2 } }),
], { minX: -6, maxX: 6, minZ: -14, maxZ: 14 });
/** The helm's eye, astern and over her deck looking forward - where heads stand in a line along the view. */
const EYE = [0, 5, -16];
const project = (pos) => {
  const head = [pos[0], pos[1] + 2.2, pos[2]];
  const depth = Math.max(1, head[2] - EYE[2]);
  return { x: 640 + (900 * head[0]) / depth, y: 360 - (900 * (head[1] - EYE[1])) / depth, distance: Math.hypot(head[0] - EYE[0], head[1] - EYE[1], head[2] - EYE[2]) };
};
/** A laid bubble's box, as the layout reads it. */
const boxOf = (b, scale) => { const { w, h } = crewSayBox(b.text, scale); const bottom = b.y - CREW_SAY_LIFT * scale - b.lift; return { l: b.x - w / 2, r: b.x + w / 2, top: bottom - h, bottom }; };
const meet = (a, b) => a.l < b.r && b.l < a.r && a.top < b.bottom && b.top < a.bottom;
const CHORUSES = new Set(CHANTIES.map((c) => sung(c.chorus)));

test('CREW-SAY THE CHORUS ONCE: five minutes of a real crew from the helm - whenever two or more sing the chorus, one bubble says it, over the nearest singer, by no name; a line said alone keeps its speaker\'s name; the world hands the name beside the line', () => {
  const roster = crewRoster({ hull: 3, seed: 21, crew: 60 });
  roster[1] = { mobile: MOBILE.Bard, gender: 'female' };
  const life = createCrewLife({ deck: plainDeck(), roster, seed: 21 });
  let chorusFrames = 0, alone = 0;
  for (let t = 0; t < 300; t += 0.05) {
    life.step(0.05, {});
    const speech = life.speech();
    const points = speech.map((l) => ({ ...project(l.member.pos), text: l.text, name: `Hand${l.member.i}`, kind: l.kind }));
    const laid = layoutCrewLines(points);
    const said = new Map();
    for (const p of points) said.set(p.text, [...(said.get(p.text) ?? []), p]);
    // FIELD BUGS 2026-10-02b PIN MOVED: a line SUNG or SHOUTED by many is theirs together; two hands' talk is each his own
    for (const b of laid) if (b.kind === 'talk') assert.match(b.text, /^Hand\d+: /, 'talk by its speaker\'s name, always');
    for (const [text, by] of said) {
      if (by.length >= 2 && by.every((p) => p.kind !== 'talk')) {
        if (CHORUSES.has(text)) chorusFrames++;
        const shown = laid.filter((b) => b.text.endsWith(text));
        assert.equal(shown.length, 1, `said by ${by.length} at once, laid once: ${text}`);
        assert.equal(shown[0].text, text, 'by no name - it is theirs together');
        const nearest = [...by].sort((a, b) => a.distance - b.distance)[0];
        assert.deepEqual([shown[0].x, shown[0].y], [nearest.x, nearest.y], 'over the nearest of them');
      } else if (laid.some((b) => b.text === `${by[0].name}: ${text}`)) alone++;
    }
    assert.ok(laid.length <= CREW_SAY_MAX);
  }
  assert.ok(chorusFrames > 40, `the chorus was sung by many (${chorusFrames} frames)`);
  assert.ok(alone > 100, `lines said alone kept their names (${alone})`);
  // the DOM: a chorus of six is one bubble, a lone line beside it keeps its name
  destroyNavalHud();
  const chorus = sung(CHANTIES[0].chorus);
  const six = Array.from({ length: 6 }, (_, i) => ({ x: 600 + i * 7, y: 300 - i * 2, text: chorus, name: `Hand${i}`, kind: 'sing', distance: 6 + i }));
  drawCrewLines([...six, { x: 300, y: 300, text: 'Wind\'s backing westerly.', name: 'Cyurmti', kind: 'talk', distance: 9 }]);
  const [layer] = byClass(globalThis.document.body, 'dfnaval-tags');
  const shown = byClass(layer, 'dfnaval-say').filter((n) => n.style.display !== 'none').map((n) => n.textContent);
  assert.deepEqual(shown, [chorus, 'Cyurmti: Wind\'s backing westerly.'], 'one chorus, by no name; a lone line by its speaker\'s');
  destroyNavalHud();
  assert.match(WORLD, /points\.push\(\{ x: at\.x, y: at\.y, text: l\.text, name: name \? name\.split\(' '\)\[0\] : null, who: key, kind: l\.kind, distance: d \}\);/, 'the world hands the name beside the line (and, 2026-10-02b, the speaker)');
});

test('CREW-SAY NEVER OVER: six heads in a huddle, each with its own line - no two bubbles meet, the nearest at its own place, each farther one lifted over the nearer; drawn, the nearest over the rest; five minutes of a real crew\'s words, never one over another, at both scales', () => {
  const lines = ['Aye!', 'Hardtack and regret.', 'Wind\'s backing westerly, Captain, mark it.', 'More oakum!', 'Fair point.', 'Shot in, rammed home!', 'one more'];
  for (const scale of [1, 1.5]) {
    const huddle = lines.map((text, i) => ({ x: 640 + (i % 3) * 9, y: 360 - i * 3, text, kind: 'talk', distance: 5 + i }));
    const laid = layoutCrewLines(huddle, { scale });
    assert.equal(laid.length, CREW_SAY_MAX, 'the nearest six');
    assert.equal(laid[0].lift, 0, 'the nearest at its own place');
    const boxes = laid.map((b) => boxOf(b, scale));
    for (let i = 0; i < boxes.length; i++) for (let j = 0; j < i; j++) assert.ok(!meet(boxes[i], boxes[j]), `${scale}: ${laid[i].text} over ${laid[j].text}`);
    // a huddle all within one bubble's width: each farther one over every nearer, the whole gap between (the lift is
    // whole pixels, rounded up)
    for (let i = 1; i < boxes.length; i++) assert.ok(boxes[i].bottom <= boxes[i - 1].top - CREW_SAY_GAP * scale + 1e-9, `${scale}: ${laid[i].text} over ${laid[i - 1].text}, a gap between`);
    assert.ok(laid.every((b) => Number.isInteger(b.lift)), 'whole pixels');
    // drawn: each at its laid place, the nearest over the rest
    destroyNavalHud();
    drawCrewLines(huddle, { scale });
    const [layer] = byClass(globalThis.document.body, 'dfnaval-tags');
    const says = byClass(layer, 'dfnaval-say');
    assert.deepEqual(says.map((n) => n.style.transform), laid.map((b) => `translate(${Math.round(b.x)}px, ${Math.round(b.y - b.lift)}px) scale(${scale}) translate(-50%, calc(-100% - ${CREW_SAY_LIFT}px))`));
    assert.deepEqual(says.map((n) => Number(n.style.zIndex)), laid.map((_, i) => CREW_SAY_MAX - i), 'the nearest over the rest');
    destroyNavalHud();
  }
  // a crew's own words, from the helm: never one over another
  const roster = crewRoster({ hull: 3, seed: 5, crew: 60 });
  const life = createCrewLife({ deck: plainDeck(), roster, seed: 5 });
  let crowded = 0;
  for (let t = 0; t < 300; t += 0.05) {
    life.step(0.05, {});
    const points = life.speech().map((l) => ({ ...project(l.member.pos), text: l.text, name: `Hand${l.member.i}`, kind: l.kind }));
    const laid = layoutCrewLines(points, { scale: 1 });
    const boxes = laid.map((b) => boxOf(b, 1));
    if (laid.length >= 2) crowded++;
    for (let i = 0; i < boxes.length; i++) for (let j = 0; j < i; j++) assert.ok(!meet(boxes[i], boxes[j]), `t ${t.toFixed(2)}: ${laid[i].text} over ${laid[j].text}`);
  }
  assert.ok(crowded > 100, `frames with two or more lines up (${crowded})`);
});

test('CREW-SAY A MATE\'S NAME: a bubble\'s foot, its tail under it, stands clear of a mate\'s bar and the name over it - by the sheet\'s own numbers; and the box the layout reckons is the sheet\'s (a content box: its words to max-width, its padding and ring outside them)', () => {
  const num = (re) => { const m = re.exec(NAVAL_HUD_CSS); assert.ok(m, String(re)); return Number(m[1]); };
  const bar = num(/\.dfnaval-crew\.mate \{[^}]*height: (\d+)px/);
  const gap = num(/\.dfnaval-crew-name \{[^}]*bottom: calc\(100% \+ (\d+)px\)/);
  const font = num(/\.dfnaval-crew-name \{[^}]*font-size: (\d+)px/);
  const lineH = num(/\.dfnaval-crew-name \{[^}]*line-height: (\d+(?:\.\d+)?);/);
  const tail = num(/\.dfnaval-say::after \{[^}]*bottom: -(\d+)px/);
  const outline = 2;   // OUTLINED's drop: 2px 2px 0
  assert.ok(CREW_SAY_LIFT - tail >= bar + gap + font * lineH + outline, `the tail's tip (${CREW_SAY_LIFT - tail}px) over the name's top (${bar + gap + font * lineH + outline}px)`);
  assert.match(NAVAL_HUD_CSS, /\.dfnaval-say \{[^}]*text-wrap: balance;/, 'the bubble wraps its words as before');
  // the box the layout reckons is the sheet's: a content box (no box-sizing) - its words to max-width, its padding and
  // its ring outside them - at the sheet's face and line
  const say = /\.dfnaval-say \{([^}]*)\}/.exec(NAVAL_HUD_CSS)[1];
  assert.doesNotMatch(say, /box-sizing/, 'a content box');
  const maxW = Number(/max-width: (\d+)px/.exec(say)[1]);
  const [pt, px, pb] = /padding: (\d+)px (\d+)px (\d+)px;/.exec(say).slice(1).map(Number);
  const ring = Number(/box-shadow: 0 0 0 (\d+)px/.exec(say)[1]);
  const sayFont = Number(/font-size: (\d+)px/.exec(say)[1]), sayLine = Number(/line-height: (\d+(?:\.\d+)?);/.exec(say)[1]);
  const long = crewSayBox('Wind\'s backing westerly, Captain, mark it - and the glass is falling.');
  assert.equal(long.w, maxW + 2 * px + 2 * ring, `a long line: the sheet's widest bubble (${long.w})`);
  assert.ok(long.h >= 2 * sayFont * sayLine + pt + pb + 2 * ring, 'on two lines at least');
  const word = crewSayBox('Aye!', 1.5);
  assert.equal(word.h, (sayFont * sayLine + pt + pb + 2 * ring) * 1.5, 'a word: one line, at the HUD\'s scale');
  assert.ok(word.w >= (4 * 6 + 2 * px + 2 * ring) * 1.5 && word.w < long.w * 1.5, 'and its own words\' width');
});
