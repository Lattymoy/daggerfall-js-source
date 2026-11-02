// FIELD BUGS 2026-10-02b - THE CREW'S WORDS AUDITED (Mac: "Audit this"). FIELD BUGS 2026-10-02's CREW-SAY laid the
// crew's bubbles clear of each other (ui/naval/navalHud.js layoutCrewLines) - and its audit, over five minutes of real crews
// at the helm and on deck, found three things wrong with how:
//   TALK IS HIS OWN   - every line said by two at once was laid once, by no name: right for the chorus and a battle's
//                       cry, wrong for talk - two pairs at one old yarn ("Heard the court at Daggerfall's hiring
//                       blades.") stood as one bubble, by nobody. Only a line SUNG or SHOUTED by many is theirs together
//   A STACK HOLDS     - a stack was laid nearest first every frame, so as the eye drifted and two hands' distances
//                       crossed, their bubbles swapped places - up to 247 px in a frame. A stack stands in the order its
//                       lines were first said, and a bubble comes DOWN to its place eased (CREW_SAY_EASE px a second),
//                       held where it stands while its way down is barred - never over another
//   THE SCREEN'S TOP  - a stack of six at scale 2 on a 540-line screen stood off its top; a lifted bubble that would
//                       stand over it is not drawn
// Each pin is red on the record's own code (e2466e2bd). `01-Overview/bugs/Field-Bugs-2026-10-02b.md`.
import '../../modsOff.js';
import { byClass } from '../../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCrewLife, crewRoster, CHANTIES, sung } from '../../../src/systems/naval/crewLife.js';
import { MOBILE } from '../../../src/systems/naval/navalBoarding.js';
import { buildDeck } from '../../../src/systems/naval/navalDeck.js';
import { boxColliderTriangles } from '../../../src/world/prefabColliders.js';
import * as hud from '../../../src/ui/naval/navalHud.js';

const { drawCrewLines, layoutCrewLines, crewSayBox, destroyNavalHud, CREW_SAY_LIFT, CREW_SAY_GAP } = hud;
const EASE = hud.CREW_SAY_EASE ?? Infinity;
/** The drawn bubbles: their words, their place (the transform's y), shown or not. */
function drawn() {
  const [layer] = byClass(globalThis.document.body, 'dfnaval-tags');
  return byClass(layer, 'dfnaval-say').filter((n) => n.style.display !== 'none').map((n) => ({ text: n.textContent, y: Number(/translate\([^,]+, (-?\d+)px\)/.exec(n.style.transform)[1]) }));
}
const yOf = (shown, text) => shown.find((b) => b.text === text)?.y;

test('CREW-SAY TALK IS HIS OWN: two pairs at one old yarn at once - each line by its own speaker\'s name, two bubbles; the chorus sung by five is one bubble by no name, and so is a battle\'s cry shouted by three (two pairs\' talk stood as one bubble, by nobody)', () => {
  const yarn = 'Heard the court at Daggerfall\'s hiring blades.';
  const cry = 'Coming about!';
  const chorus = sung(CHANTIES[0].chorus);
  const points = [
    { x: 300, y: 400, text: yarn, name: 'Perard', who: 'a', kind: 'talk', distance: 6 },
    { x: 900, y: 400, text: yarn, name: 'Uthane', who: 'b', kind: 'talk', distance: 7 },
    ...[0, 1, 2, 3, 4].map((i) => ({ x: 600 + i * 30, y: 600, text: chorus, name: `Hand${i}`, who: `s${i}`, kind: 'sing', distance: 8 + i })),
    ...[0, 1, 2].map((i) => ({ x: 100 + i * 40, y: 700, text: cry, name: `Gunner${i}`, who: `g${i}`, kind: 'shout', distance: 4 + i })),
  ];
  const laid = layoutCrewLines(points);
  assert.deepEqual(laid.filter((b) => b.text.endsWith(yarn)).map((b) => b.text).sort(), [`Perard: ${yarn}`, `Uthane: ${yarn}`], 'each his own');
  assert.deepEqual(laid.filter((b) => b.text.endsWith(chorus)).map((b) => [b.text, b.x]), [[chorus, 600]], 'the chorus once, over its nearest singer');
  assert.deepEqual(laid.filter((b) => b.text.endsWith(cry)).map((b) => [b.text, b.x]), [[cry, 100]], 'the cry once, over its nearest');
  // a real crew's evening: every talk line by its speaker, though two hands say the same words
  const roster = crewRoster({ hull: 3, seed: 5, crew: 60 });
  const life = createCrewLife({ deck: buildDeck([{ positions: [-4, 2, -12, 4, 2, -12, 4, 2, 12, -4, 2, 12], indices: [0, 1, 2, 0, 2, 3] }, boxColliderTriangles({ m_Center: { x: 0, y: 6, z: 0 }, m_Size: { x: 1.2, y: 8, z: 1.2 } })], { minX: -6, maxX: 6, minZ: -14, maxZ: 14 }), roster, seed: 5 });
  let twice = 0;
  for (let t = 0; t < 300; t += 0.05) {
    life.step(0.05, {});
    const pts = life.speech().map((l) => ({ x: 640 + l.member.pos[0] * 60, y: 600 - l.member.pos[2] * 10, text: l.text, name: `Hand${l.member.i}`, who: l.member.i, kind: l.kind, distance: 5 + Math.abs(l.member.pos[2]) }));
    const talk = pts.filter((p) => p.kind === 'talk');
    if (talk.some((p, i) => talk.findIndex((q) => q.text === p.text) !== i)) twice++;
    for (const b of layoutCrewLines(pts)) if (b.kind === 'talk') assert.match(b.text, /^Hand\d+: /, `t ${t.toFixed(2)}: talk by its speaker`);
  }
  assert.ok(twice > 20, `two hands said one talk line at once (${twice} frames)`);
});

test('CREW-SAY A STACK HOLDS: two hands side by side, a line each - as the eye drifts and their distances cross, neither bubble moves (they swapped places, a bubble\'s height and more); and when the line under a lifted bubble ends, the bubble comes down eased, CREW_SAY_EASE px a second, never through another', async () => {
  destroyNavalHud();
  const a = { x: 640, y: 500, text: 'Hardtack and regret.', name: 'Perard', who: 'a', kind: 'talk' };
  const b = { x: 650, y: 498, text: 'Wind\'s backing westerly.', name: 'Uthane', who: 'b', kind: 'talk' };
  drawCrewLines([{ ...a, distance: 6 }, { ...b, distance: 7 }], { dt: 0.05 });
  const first = drawn();
  assert.equal(yOf(first, `Perard: ${a.text}`), 500, 'the nearer at its own place');
  const over = yOf(first, `Uthane: ${b.text}`);
  assert.ok(over < 498 - crewSayBox(`Perard: ${a.text}`).h, `the farther lifted over it (${over})`);
  for (const [da, db] of [[6.6, 6.4], [7, 6], [8, 5]]) {   // the eye drifts: b comes nearer than a
    drawCrewLines([{ ...a, distance: da }, { ...b, distance: db }], { dt: 0.05 });
    assert.deepEqual(drawn().map((d) => [d.text, d.y]).sort(), first.map((d) => [d.text, d.y]).sort(), `${da} / ${db}: nothing moves`);
  }
  // a's line ends: b comes down at the ease - a twentieth of a second, 8 px - and on to its place
  drawCrewLines([{ ...b, distance: 5 }], { dt: 0.05 });
  const down = yOf(drawn(), `Uthane: ${b.text}`);
  assert.equal(down, over + Math.floor(EASE * 0.05), `eased (${over} to ${down})`);
  for (let i = 0; i < 80; i++) drawCrewLines([{ ...b, distance: 5 }], { dt: 0.05 });
  assert.equal(yOf(drawn(), `Uthane: ${b.text}`), 498, 'and at its own place');
  destroyNavalHud();
  // its way down barred by an older bubble standing between (a hand higher on the screen): held where it stands - not
  // through it - until that one's line ends
  const lo = { x: 640, y: 500, text: 'Aye!', name: 'Perard', who: 'lo', kind: 'talk', distance: 5 };
  const mid = { x: 650, y: 460, text: 'Fair point.', name: 'Elayne', who: 'mid', kind: 'talk', distance: 6 };
  const up = { x: 645, y: 500, text: 'More oakum!', name: 'Uthane', who: 'up', kind: 'talk', distance: 7 };
  drawCrewLines([lo], { dt: 0.05 });
  drawCrewLines([lo, mid], { dt: 0.05 });
  drawCrewLines([lo, mid, up], { dt: 0.05 });
  const high = yOf(drawn(), `Uthane: ${up.text}`);
  assert.ok(high < yOf(drawn(), `Elayne: ${mid.text}`), `over both (${high})`);
  for (let i = 0; i < 5; i++) {
    drawCrewLines([mid, up], { dt: 0.05 });
    assert.equal(yOf(drawn(), `Uthane: ${up.text}`), high, 'held while the one between stands');
  }
  drawCrewLines([up], { dt: 0.05 });
  assert.ok(yOf(drawn(), `Uthane: ${up.text}`) > high, 'and down once it is gone');
  destroyNavalHud();
  // five minutes of a real crew in battle, remembered frame to frame at 20 a second: never one over another
  const roster = crewRoster({ hull: 3, seed: 5, crew: 60 });
  const life = createCrewLife({ deck: buildDeck([{ positions: [-4, 2, -12, 4, 2, -12, 4, 2, 12, -4, 2, 12], indices: [0, 1, 2, 0, 2, 3] }, boxColliderTriangles({ m_Center: { x: 0, y: 6, z: 0 }, m_Size: { x: 1.2, y: 8, z: 1.2 } })], { minX: -6, maxX: 6, minZ: -14, maxZ: 14 }), roster, seed: 5 });
  const EYE = [0, 3.7, -13];
  const memory = hud.crewSayMemory();
  let eased = 0;
  for (let t = 0; t < 300; t += 0.05) {
    life.step(0.05, { battle: true });
    const pts = life.speech().map((l) => { const head = [l.member.pos[0], l.member.pos[1] + 2.2, l.member.pos[2]]; const depth = Math.max(1, head[2] - EYE[2]); return { x: 640 + (900 * head[0]) / depth, y: 360 - (900 * (head[1] - EYE[1])) / depth, text: l.text, name: `Hand${l.member.i}`, who: l.member.i, kind: l.kind, distance: Math.hypot(head[0] - EYE[0], head[1] - EYE[1], head[2] - EYE[2]) }; });
    for (const scale of [2]) {
      const before = new Map([...memory.bubbles].map(([k, v]) => [k, v.lift]));
      const laid = layoutCrewLines(pts, { scale, memory, dt: 0.05, top: 0 });
      for (const [k, v] of memory.bubbles) if (before.has(k) && v.lift < before.get(k) && before.get(k) - v.lift < 20) eased++;
      const boxes = laid.map((x) => { const { w, h } = crewSayBox(x.text, scale); const bottom = x.y - CREW_SAY_LIFT * scale - x.lift; return { l: x.x - w / 2, r: x.x + w / 2, top: bottom - h, bottom }; });
      for (let i = 0; i < boxes.length; i++) for (let j = 0; j < i; j++) assert.ok(!(boxes[i].l < boxes[j].r && boxes[j].l < boxes[i].r && boxes[i].top < boxes[j].bottom && boxes[j].top < boxes[i].bottom), `t ${t.toFixed(2)}: ${laid[i].text} over ${laid[j].text}`);
    }
  }
  assert.ok(eased > 50, `bubbles came down eased (${eased} frames)`);
  // the world hands the frame's dt (held at a pause) and each speaker
  const WORLD = (await import('node:fs')).readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(WORLD, /drawCrewLines\(points, \{ covered, scale: enhancedHudScale\(\), dt: gamePaused\(\) \? 0 : dt \}\);/);
});

test('CREW-SAY THE SCREEN\'S TOP: a huddle of six near the top of the screen - each bubble at its own head is drawn, and a lifted one that would stand over the screen\'s top is not (a stack of six stood off it); nothing drawn meets anything else', () => {
  destroyNavalHud();
  const huddle = ['Aye!', 'Hardtack and regret.', 'More oakum!', 'Fair point.', 'Shot in, rammed home!', 'one more'].map((text, i) => ({ x: 640 + (i % 3) * 9, y: 140 - i, text, name: `Hand${i}`, who: i, kind: 'talk', distance: 5 + i }));
  // a hand at the very top of the screen: his own bubble is drawn, though it stands partly off it - it is his place
  destroyNavalHud();
  drawCrewLines([{ x: 200, y: 30, text: 'Land ho!', name: 'Ysyrrya', who: 'top', kind: 'talk', distance: 9 }], { scale: 1, dt: 0.05 });
  assert.deepEqual(drawn(), [{ text: 'Ysyrrya: Land ho!', y: 30 }], 'at his own head');
  for (const scale of [1, 2]) {
    destroyNavalHud();
    drawCrewLines(huddle, { scale, dt: 0.05 });
    const shown = drawn();
    assert.ok(shown.length >= 1 && shown.length < huddle.length, `${scale}: some drawn, not all (${shown.length})`);
    for (const d of shown) {
      const { h } = crewSayBox(d.text, scale);
      const head = huddle.find((p) => d.text.endsWith(p.text)).y;
      assert.ok(d.y === Math.round(head) || d.y - CREW_SAY_LIFT * scale - h >= 0, `${scale}: ${d.text} stands on the screen (${d.y})`);
    }
    const boxes = shown.map((d) => { const { w, h } = crewSayBox(d.text, scale); const bottom = d.y - CREW_SAY_LIFT * scale; return { l: 640 - w / 2 - 20, r: 640 + w / 2 + 20, top: bottom - h, bottom }; });
    for (let i = 0; i < boxes.length; i++) for (let j = 0; j < i; j++) assert.ok(boxes[i].bottom <= boxes[j].top - CREW_SAY_GAP * scale + 1e-9 || boxes[j].bottom <= boxes[i].top - CREW_SAY_GAP * scale + 1e-9, `${scale}: ${shown[i].text} clear of ${shown[j].text}`);
  }
  destroyNavalHud();
});
