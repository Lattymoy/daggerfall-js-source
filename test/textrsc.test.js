// TEXT.RSC: the verbatim table + faithful flattening, crafted bytes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TextRsc, RSC } from '../src/formats/textRsc.js';

function craft() {
  // headerLength covers (count+1) x 6: two records -> 18
  const head = [18, 0, /*id 500*/ 244, 1, 20, 0, 0, 0, /*id 501*/ 245, 1, 34, 0, 0, 0];
  const rec500 = [...'Hi'].map((c) => c.charCodeAt(0))
    .concat([RSC.NewLine], [...'yo'].map((c) => c.charCodeAt(0)),
      [RSC.SubrecordSeparator], [...'alt'].map((c) => c.charCodeAt(0)), [RSC.EndOfRecord]);
  // record 501: prefixes consume operands (0x21 = '!' must NOT leak), justify drops
  const rec501 = [RSC.FontPrefix, 0x21, RSC.PositionPrefix, 0x41, RSC.JustifyCenter]
    .concat([...'ok'].map((c) => c.charCodeAt(0)), [RSC.EndOfRecord]);
  const bytes = new Uint8Array(20 + rec500.length + rec501.length);
  bytes.set(head, 0);
  bytes.set(rec500, 20);
  bytes.set(rec501, 20 + rec500.length);
  // fix record 501's offset (34 was a placeholder): 20 + rec500.length
  new DataView(bytes.buffer).setUint32(10, 20 + rec500.length, true);
  return bytes;
}

test('textrsc: header walk, ids, raw bytes with terminator', () => {
  const t = new TextRsc().load(craft());
  assert.equal(t.recordCount, 2);
  assert.ok(t.hasRecord(500) && t.hasRecord(501) && !t.hasRecord(4));
  const raw = t.bytesById(500);
  assert.equal(raw[raw.length - 1], RSC.EndOfRecord);        // inclusive, per GetBytesById
  assert.equal(t.bytesById(9999), null);
});

test('textrsc: plainText - newline, variants, operand consumption, justify BREAKS', () => {
  const t = new TextRsc().load(craft());
  assert.deepEqual(t.plainText(500), ['Hi\nyo', 'alt']);     // subrecord split
  // U11: JustifyCenter (0xFD) and JustifyLeft (0xFC) each call
  // NewLine() in DFU (MultiFormatTextLabel.cs:333-345) - this pin used
  // to assert "justify drops", which is exactly the bug that fused
  // "Hammerfell." to "You are" in every centred TEXT.RSC record.
  assert.deepEqual(t.plainText(501), ['\nok']);              // '!' and 'A' operands never leak; the justify BREAKS
});

test('textrsc: linesById - rows with their per-row alignment', () => {
  const t = new TextRsc().load(craft());
  // record 501 is FontPrefix/PositionPrefix operands, a JustifyCenter,
  // then "ok" - so one CENTRED empty row closes and "ok" is the tail.
  assert.deepEqual(t.linesById(501), [{ text: '', center: true }, { text: 'ok', center: false }]);
  // record 500 breaks on a bare NewLine, which is LEFT
  assert.deepEqual(t.linesById(500), [{ text: 'Hi', center: false }, { text: 'yo', center: false }]);
  assert.deepEqual(t.linesById(9999), []);
});
