// T3b: the mobile-NPC talk session + the activation ray (DFU
// TalkManager.TalkToNpc / GetNPCGreetingRecord / MacroHelper /
// PlayerActivate, verbatim).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  greetingTextId, startMobileTalk, expandMacros, firstName, oathTextId,
  NO_RESPONSE_TEXT_ID,
} from '../src/systems/talkSession.js';
import { rayPersonDistance } from '../src/scenes/townTalk.js';
import { wrapText } from '../src/ui/talkWindow.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

test('talk: the verbatim greeting thresholds and the -20 refusal edge', () => {
  // thresholds 0/10/30 -> 7207/7208/7209, below 0 -> 7206
  assert.equal(greetingTextId(-1), 7206);
  assert.equal(greetingTextId(0), 7207);
  assert.equal(greetingTextId(9), 7207);
  assert.equal(greetingTextId(10), 7208);
  assert.equal(greetingTextId(29), 7208);
  assert.equal(greetingTextId(30), 7209);
  const texts = { 7205: ['You get no response.'], 7206: ['Bad %pcf'], 7207: ['Hello.'] };
  const tv = (id) => texts[id];
  // reaction < -20 refuses with 7205; EXACTLY -20 still talks (7206)
  const refusedT = startMobileTalk({ reaction: -21, textVariants: tv, rolls: seq(0) });
  assert.deepEqual([refusedT.refused, refusedT.textId, refusedT.text], [true, NO_RESPONSE_TEXT_ID, 'You get no response.']);
  const edge = startMobileTalk({ reaction: -20, textVariants: tv, playerName: 'Mack C', rolls: seq(0) });
  assert.deepEqual([edge.refused, edge.textId, edge.text], [false, 7206, 'Bad Mack']);
});

test('talk: the macro set - %pcf first token, %oth by faction race (the DFU oath fix)', () => {
  assert.equal(firstName('Mack Cothran'), 'Mack');
  assert.equal(expandMacros('Hi %pcf, %oth!', { playerName: 'Mack Cothran', oath: 'By Sai' }), 'Hi Mack, By Sai!');
  // Oaths: TEXT.RSC 201 + FactionRace (Nord 0 / Khajiit 1 / Redguard 2 / Breton 3)
  assert.equal(oathTextId('Nord'), 201);
  assert.equal(oathTextId('Redguard'), 203);
  assert.equal(oathTextId('Breton'), 204);
  // The oath variant is drawn ONLY when the greeting carries %oth
  // (rolls: variant pick then oath pick)
  const texts = { 7207: ['%oth, hello.', 'Plain hello.'], 204: ['Oath A', 'Oath B'] };
  const withOath = startMobileTalk({ reaction: 0, textVariants: (id) => texts[id], npcRace: 'Breton', rolls: seq(0.0, 0.9) });
  assert.equal(withOath.text, 'Oath B, hello.');
  const noOath = startMobileTalk({ reaction: 0, textVariants: (id) => texts[id], npcRace: 'Breton', rolls: seq(0.9, 0.0) });
  assert.equal(noOath.text, 'Plain hello.');
});

test('townTalk: the activation ray hits the person cylinder; wrap is greedy', () => {
  const cam = [0, 1.7, 0];
  // person 3 units ahead (+z), feet at ground
  const fwd = [0, 0, 1];
  const d = rayPersonDistance(cam, fwd, [0, 0, 3]);
  assert.ok(Math.abs(d - 3) < 0.01, `direct hit distance ${d}`);
  // offset past the 0.45 radius misses
  assert.equal(rayPersonDistance(cam, fwd, [0.6, 0, 3]), Infinity);
  // behind the camera misses
  assert.equal(rayPersonDistance(cam, fwd, [0, 0, -3]), Infinity);
  // above the head band misses (looking level at feet 3 up)
  assert.equal(rayPersonDistance(cam, fwd, [0, 4.0, 3]), Infinity);
  // wrap: greedy against a fake 6px-per-char measure
  const lines = wrapText(null, 'aa bb cc dd', 30, (_f, s) => s.length * 6);
  assert.deepEqual(lines, ['aa bb', 'cc dd']);
});
