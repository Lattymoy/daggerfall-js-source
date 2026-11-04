import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

import {
  keepShot, listShots, loadingShot, deleteShot, setShotLoading, shotCount,
  setGalleryBackend, setShotEncoder,
} from '../../src/systems/shotGallery.js';

const require = createRequire(import.meta.url);
const { createScreenshotStorage } = require('../../app/lib/screenshotStorage.cjs');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'dagger-desk-shot-'));
const rm = (dir) => fs.rmSync(dir, { recursive: true, force: true });

test('desktop gallery: integrates shotStore with shotGallery without limits', async () => {
  const root = tmp();
  const shotStore = createScreenshotStorage(path.join(root, 'Screenshots'));

  // Mock globalThis.daggerShell.screenshots as exposed in preload.cjs
  const prevShell = globalThis.daggerShell;
  globalThis.daggerShell = {
    screenshots: {
      folderPath: shotStore.dir,
      openFolder: () => {},
      list: () => shotStore.list(),
      read: (name) => {
        const buf = shotStore.read(name);
        return buf ? new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) : null;
      },
      save: (name, bytes, meta) => shotStore.save({ name, buffer: Buffer.from(bytes), ...meta }),
      delete: (name) => shotStore.del(name),
      setLoading: (name, on) => shotStore.setLoading(name, on),
    },
  };

  // Reset internal _backend so it picks up desktop backend
  setGalleryBackend(null);
  setShotEncoder(async () => ({
    blob: new Blob(['full-png']),
    thumb: new Blob(['thumb-png']),
    w: 1920,
    h: 1080,
  }));

  try {
    // Initially empty
    assert.equal(await shotCount(), 0);
    assert.deepEqual(await listShots(), []);

    // Keep 1st shot
    const id1 = await keepShot(new Blob(['img1']), { place: 'Wayrest', at: 1000 });
    assert.ok(id1);
    assert.equal(await shotCount(), 1);

    // Keep 2nd shot
    const id2 = await keepShot(new Blob(['img2']), { place: 'Daggerfall', at: 2000 });
    assert.ok(id2);
    assert.equal(await shotCount(), 2);

    // Drop an external user image directly into the Screenshots folder on disk!
    fs.writeFileSync(path.join(shotStore.dir, 'custom_wallpaper.jpg'), Buffer.from('external-bytes'));

    // listShots() immediately reads it ("as many as are in the folder")
    const shots = await listShots();
    assert.equal(shots.length, 3);
    const custom = shots.find((s) => s.id === 'custom_wallpaper.jpg');
    assert.ok(custom);
    assert.equal(custom.loading, true);
    assert.ok(custom.blob instanceof Blob);

    // Toggle loading screen off for id1
    await setShotLoading(id1, false);
    const updated = await listShots();
    const shot1 = updated.find((s) => s.id === id1);
    assert.equal(shot1.loading, false);

    // loadingShot picks from items where loading !== false
    const picked = await loadingShot(() => 0);
    assert.ok(picked);
    assert.notEqual(picked.id, id1);
    assert.ok(picked.blob instanceof Blob);

    // Delete shot2
    assert.equal(await deleteShot(id2), true);
    assert.equal(await shotCount(), 2);
    assert.equal(fs.existsSync(path.join(shotStore.dir, id2)), false);
  } finally {
    globalThis.daggerShell = prevShell;
    setGalleryBackend(null);
    setShotEncoder(null);
    rm(root);
  }
});
