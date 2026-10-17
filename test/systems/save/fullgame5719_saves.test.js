import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveSlot, loadSlot, saveInfoOf, screenshotOf, onSlotSaved, SAVE_DATA_PREFIX, SAVE_INFO_PREFIX, SAVE_SHOT_PREFIX } from '../../../src/systems/save/saveSlots.js';

const snap = (time) => ({ v: 1, name: 'Audit', characterId: 'audit', classicMinutes: time });
for (const prefix of [SAVE_DATA_PREFIX, SAVE_SHOT_PREFIX, SAVE_INFO_PREFIX]) {
  for (const overwrite of [false, true]) test(`FG-07: ${overwrite ? 'overwrite' : 'new slot'} failure at ${prefix} restores the complete prior state`, () => {
    const data = new Map(); let armed = false;
    const s = { get length() { return data.size; }, key: (i) => [...data.keys()][i], getItem: (k) => data.get(k) ?? null,
      removeItem: (k) => data.delete(k), setItem(k, v) {
        if (armed && k.startsWith(prefix)) throw new DOMException('quota', 'QuotaExceededError');
        data.set(k, v);
      } };
    if (overwrite) assert.ok(saveSlot('Audit', 'QuickSave', snap(10), { storage: s, screenshot: 'old', now: 100 }).ok);
    const previous = new Map(data);
    let notified = 0; const off = onSlotSaved(() => notified++);
    try {
      armed = true;
      const result = saveSlot('Audit', 'QuickSave', snap(20), { storage: s, screenshot: 'new', now: 200 });
      assert.equal(result.ok, false);
      assert.deepEqual(data, previous);
      assert.equal(notified, 0);
      if (overwrite) {
        assert.equal(loadSlot(0, s).classicMinutes, 10);
        assert.equal(saveInfoOf(0, s).dateAndTime.gameTime, 10);
        assert.equal(screenshotOf(0, s), 'old');
      }
      armed = false;
      assert.ok(saveSlot('Audit', 'QuickSave', snap(30), { storage: s, now: 300 }).ok);
      assert.equal(loadSlot(0, s).classicMinutes, 30);
      assert.equal(saveInfoOf(0, s).dateAndTime.gameTime, 30);
      assert.equal(screenshotOf(0, s), null);
      assert.equal(notified, 1);
    } finally { off(); }
  });
}

test('FG-07: metadata failure restores a thumbnail removed by an overwrite without a capture', () => {
  const data = new Map(); let fail = false;
  const storage = { get length() { return data.size; }, key: (i) => [...data.keys()][i], getItem: (k) => data.get(k) ?? null,
    removeItem: (k) => data.delete(k), setItem(k, v) { if (fail && k.startsWith(SAVE_INFO_PREFIX)) throw new Error('quota'); data.set(k, v); } };
  saveSlot('Audit', 'QuickSave', snap(10), { storage, screenshot: 'old' });
  const before = new Map(data); fail = true;
  assert.equal(saveSlot('Audit', 'QuickSave', snap(20), { storage }).ok, false);
  assert.deepEqual(data, before);
});
