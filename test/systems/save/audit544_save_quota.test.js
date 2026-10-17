import test from 'node:test';
import assert from 'node:assert/strict';
import { saveSlot, loadSlot, saveInfoOf, screenshotOf, onSlotSaved } from '../../../src/systems/save/saveSlots.js';

test('failed overwrite restores the old checkpoint when a larger new thumbnail consumes rollback space', () => {
  const data = new Map();
  let quota = Infinity;
  const bytes = map => [...map].reduce((n, [k, v]) => n + 2 * (k.length + v.length), 0);
  const storage = {
    get length() { return data.size; },
    key: i => [...data.keys()][i] ?? null,
    getItem: k => data.get(k) ?? null,
    removeItem: k => data.delete(k),
    setItem(k, value) {
      const trial = new Map(data); trial.set(String(k), String(value));
      if (bytes(trial) > quota) throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
      data.set(String(k), String(value));
    },
  };
  const snap = (time, padding) => ({ v: 1, name: 'Audit', characterId: 'audit', classicMinutes: time, padding });
  const old = snap(10, 'x'.repeat(4096));
  assert.equal(saveSlot('Audit', 'QuickSave', old, { storage, screenshot: 'old', now: 10 }).ok, true);
  const before = new Map(data);
  quota = bytes(data);
  let notices = 0;
  const off = onSlotSaved(() => notices++);
  try {
    // The new payload is smaller by exactly the amount the thumbnail grows.
    // Both fit, then the longer metadata timestamp exceeds the real quota.
    const result = saveSlot('Audit', 'QuickSave', snap(20, 'new'), {
      storage, screenshot: 'N'.repeat(4096), now: 1000000000000,
    });
    assert.equal(result.ok, false);
    assert.equal(notices, 0);
    const observed = {
      expectedCheckpointTime: 10,
      loadedCheckpointTime: loadSlot(0, storage)?.classicMinutes,
      displayedCheckpointTime: saveInfoOf(0, storage)?.dateAndTime.gameTime,
      thumbnailRestored: screenshotOf(0, storage) === 'old',
      exactSlotRestored: JSON.stringify([...data]) === JSON.stringify([...before]),
    };
    console.log(JSON.stringify(observed));
    assert.equal(observed.loadedCheckpointTime, 10, 'failed save must preserve the previous checkpoint');
    assert.deepEqual(data, before);
  } finally { off(); }
});
