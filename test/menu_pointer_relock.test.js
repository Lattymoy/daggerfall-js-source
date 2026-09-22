import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (p) => readFileSync(p, 'utf8');

test('MENU-RELOCK: town menus reclaim look inside the closing key gesture', () => {
  const s = src('src/scenes/townTalk.js');
  assert.match(s, /if \(!overlay && !otherOverlayActive\?\.\(\)\) requestLook\(canvas\);/);
  assert.ok((s.match(/if \(!overlay && !otherOverlayActive\?\.\(\)\) requestLook\(canvas\);/g) ?? []).length >= 2,
    'both keydown and keyup close paths relock');
});

test('MENU-RELOCK: standalone interior reclaims after keydown and keyup drains', () => {
  const s = src('src/scenes/interior.js');
  assert.ok((s.match(/if \(!overlay && !gamePaused\(\)\) requestLook\(canvas\);/g) ?? []).length >= 2);
});

test('MENU-RELOCK: standalone dungeon compares overlay state around both key edges', () => {
  const s = src('src/scenes/dungeon.js');
  assert.ok((s.match(/if \(hadOverlay && !ctx\.uiOverlayActive\) requestLook\(canvas\);/g) ?? []).length >= 2);
});

test('MENU-RELOCK: world-hosted interior and dungeon use the host relock seam', () => {
  const s = src('src/scenes/worldModes.js');
  assert.match(s, /if \(hadOverlay && !interiorKeyCtx\.uiOverlayActive\) host\.relock\?\.\(\);/);
  assert.match(s, /if \(!interiorOverlay\) host\.relock\?\.\(\);/);
  assert.ok((s.match(/if \(hadOverlay && !dungeonCtx\.uiOverlayActive\) host\.relock\?\.\(\);/g) ?? []).length >= 2);
});
