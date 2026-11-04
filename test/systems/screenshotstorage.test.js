import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  createScreenshotStorage,
  getScreenshotsDir,
  VALID_EXTS,
  META_FILE,
  SCREENSHOTS_DIR,
} = require('../../app/lib/screenshotStorage.cjs');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'dagger-shot-test-'));
const rm = (dir) => fs.rmSync(dir, { recursive: true, force: true });

test('screenshot directory location respects portable vs installed environment', () => {
  const root = tmp();
  const portableRoot = tmp();
  try {
    // 1. Installed build (no env override)
    const normal = getScreenshotsDir(root, {});
    assert.equal(normal, path.join(root, SCREENSHOTS_DIR));

    // 2. Portable build (PORTABLE_EXECUTABLE_DIR set)
    const portable = getScreenshotsDir(root, { PORTABLE_EXECUTABLE_DIR: portableRoot });
    assert.equal(portable, path.join(portableRoot, SCREENSHOTS_DIR));

    // 3. Custom DAGGER_USER_DATA set
    const custom = getScreenshotsDir(root, { DAGGER_USER_DATA: path.join(root, 'custom') });
    assert.equal(custom, path.join(root, 'custom', SCREENSHOTS_DIR));
  } finally {
    rm(root);
    rm(portableRoot);
  }
});

test('screenshot store: writes, lists, reads, updates loading and deletes files', () => {
  const root = tmp();
  try {
    const store = createScreenshotStorage(path.join(root, 'Screenshots'));
    assert.equal(store.list().length, 0);

    // Save a screenshot
    const buf = Buffer.from([1, 2, 3, 4]);
    const rec1 = store.save({
      name: 'test1.png',
      buffer: buf,
      place: 'Wayrest',
      at: 1000,
      loading: true,
    });
    assert.equal(rec1.name, 'test1.png');
    assert.equal(rec1.place, 'Wayrest');
    assert.equal(rec1.loading, true);

    // Read back
    const readBytes = store.read('test1.png');
    assert.ok(readBytes);
    assert.deepEqual(readBytes, buf);

    // List reflects file
    let list = store.list();
    assert.equal(list.length, 1);
    assert.equal(list[0].id, 'test1.png');
    assert.equal(list[0].place, 'Wayrest');

    // Toggle loading
    store.setLoading('test1.png', false);
    list = store.list();
    assert.equal(list[0].loading, false);

    // Add manual external picture directly into folder
    const externalBuf = Buffer.from([5, 6, 7]);
    fs.writeFileSync(path.join(store.dir, 'external.jpg'), externalBuf);

    // Store immediately reads external file ("as many as are in the folder")
    list = store.list();
    assert.equal(list.length, 2);
    const ext = list.find((x) => x.id === 'external.jpg');
    assert.ok(ext);
    assert.equal(ext.loading, true, 'external picture defaults to loading screen');

    // Delete
    assert.ok(store.del('test1.png'));
    assert.equal(store.list().length, 1);
    assert.equal(store.read('test1.png'), null);
  } finally {
    rm(root);
  }
});

