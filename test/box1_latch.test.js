// BOX1 (2026-09-17, Mac: "When buying a spell, the dialouge ui Flickers
// between 2 seperate conversations"): the guild popup and the coven draw
// their textId boxes through latchBoxRows - the record is read ONCE per
// box, not once per frame (the host's rows() is a random-variant draw).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GuildServiceWindow, _setGuildServiceArtForTests } from '../src/ui/guildServiceWindow.js';
import { CovenWindow, _setCovenArtForTests } from '../src/ui/covenWindow.js';

const recorder = () => ({ uploadTexture: () => 'tex', releaseTexture: () => {}, drawScreenQuad: () => {} });
const font = { fnt: { fixedHeight: 6, fixedWidth: 4, glyphWidth: () => 4 } };
const canvas = { width: 320, height: 200 };
const img = { tex: 't', w: 130, h: 51 };

test('BOX1: the guild popup reads a step box\'s record once across many draws, and a Yes/No box likewise (mutant: rows() per draw)', () => {
  _setGuildServiceArtForTests({ base: img, member: img });
  try {
    let n = 0;
    const w = new GuildServiceWindow({
      member: () => true, service: () => 'Training',
      steps: () => [{ textId: 7, clickAnywhere: true }, { textId: 8, buttons: 'YesNo', onYes: () => {} }],
      rows: (id) => [{ text: `[${id}] variant ${++n}`, center: true }],
    });
    const r = recorder();
    for (let i = 0; i < 6; i++) w.draw(r, canvas, font);
    assert.equal(n, 1, 'the first box: one read over six frames');
    assert.equal(w._box.rows[0].text, '[7] variant 1');
    w.input('Space');   // click-anywhere: the next box
    for (let i = 0; i < 6; i++) w.draw(r, canvas, font);
    assert.equal(n, 2, 'the Yes/No box: its own single read');
    assert.equal(w._box.rows[0].text, '[8] variant 2');
    assert.deepEqual(w._box.buttons.length, 2);
  } finally { _setGuildServiceArtForTests(null); }
});

test('BOX1: the coven reads a textId box once across many draws (mutant: rows() per draw)', () => {
  _setCovenArtForTests({ base: img });
  try {
    let n = 0;
    const w = new CovenWindow({ rows: (id) => [{ text: `[${id}] variant ${++n}`, center: true }], onSummon: () => ({ textId: 9 }), onTalk: () => {}, onClose: () => {} });
    w.boxes.push({ textId: 9 });
    const r = recorder();
    for (let i = 0; i < 6; i++) w.draw(r, canvas, font);
    assert.equal(n, 1);
    assert.equal(w._box.rows[0].text, '[9] variant 1');
  } finally { _setCovenArtForTests(null); }
});
