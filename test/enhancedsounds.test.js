// ES1 (2026-09-16, Mac: "lump this in as a new enhanced toggle. Enhanced
// Sounds, add the wind noise to it") + MAC-O6 (Mac's patch: "looting
// gold/items makes no sound"). ONE switch over the port's own sounds:
// the wind loop (WIND3's own row, folded in) and the enhanced
// inventory's transfer cues - DoTransferItem's gold clink and button
// click, which the classic window always played and the enhanced one
// dropped on the floor (`plan.sound`, handed back by planTake/planStore
// and never read).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { enhancedSoundsOn, ENHANCED_SOUNDS_KEY } from '../src/systems/enhancedSounds.js';
import { windSoundOn } from '../src/systems/windAudio.js';
import { FEATURES } from '../src/systems/features.js';
import { PREF_DEFAULTS, setPref } from '../src/systems/uiPrefs.js';
import { ONLINE_PLAYERS_OWN_PREFS } from '../src/systems/onlineLane.js';
import { uiSkin, setUiSkin } from '../src/systems/uiSkin.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');

test('ES1 the row: Enhanced sounds on the Features home where the wind row stood - enhanced, on by default, the player’s own online, the shelf deriving its default (mutant: the key misspelled on either side)', () => {
  const row = FEATURES.find((f) => f.id === 'enhanced-sounds');
  assert.ok(row, 'the row exists');
  assert.equal(row.control.key, ENHANCED_SOUNDS_KEY);
  assert.equal(ENHANCED_SOUNDS_KEY, 'soundEnhancements');
  assert.deepEqual(row.kinds, ['enhanced']);
  assert.equal(row.control.initial, true); assert.equal(row.control.online, 'player'); assert.equal(row.control.store, 'prefs');
  assert.match(row.note, /wind/); assert.match(row.note, /gold/);
  assert.equal(PREF_DEFAULTS.soundEnhancements, true, 'RF4: the shelf derives the default from the row');
  assert.ok(ONLINE_PLAYERS_OWN_PREFS.includes('soundEnhancements'), 'the lane leaves it to the player');
  assert.equal(FEATURES.find((f) => f.id === 'wind-sound'), undefined, 'the wind’s own row is gone - it IS this row');
  assert.equal(FEATURES.findIndex((f) => f.id === 'enhanced-sounds'), FEATURES.findIndex((f) => f.id === 'wind-wisps') + 1, 'in the wind row’s place');
});

test('ES1 the switch: the enhanced skin and the pref; the wind rides it and keeps its own kill door (mutant: the skin gate dropped, or the wind reading a pref of its own)', () => {
  const skin = uiSkin();
  try {
    setUiSkin('enhanced'); setPref('soundEnhancements', true);
    assert.equal(enhancedSoundsOn(), true);
    assert.equal(windSoundOn(''), true, 'the wind is on with the switch');
    assert.equal(windSoundOn('?windaudio=off'), false, 'the wind’s kill door still silences the wind alone');
    setPref('soundEnhancements', false);
    assert.equal(enhancedSoundsOn(), false);
    assert.equal(windSoundOn(''), false, 'the switch off: no wind');
    setPref('soundEnhancements', true); setUiSkin('classic');
    assert.equal(enhancedSoundsOn(), false, 'the classic skin plays what DFU plays and nothing more');
    assert.equal(windSoundOn(''), false);
  } finally { setUiSkin(skin); setPref('soundEnhancements', true); }
});

test('MAC-O6 + ES1 by source: the enhanced inventory plays DoTransferItem’s cue on take AND store, off `plan.sound`, behind the switch; the wind gate composes the switch (mutant: a cue unguarded, or one door dropped)', () => {
  const inv = rd('src/ui/enhancedInventory.js');
  const cues = inv.match(/if \(enhancedSoundsOn\(\)\) audio\.playOneShot\(plan\.sound === 'gold' \? SOUND\.GoldPieces : SOUND\.ButtonClick, 1\);/g) ?? [];
  assert.equal(cues.length, 2, 'take and store, each behind the switch');
  assert.equal((inv.match(/audio\.playOneShot\(/g) ?? []).length, 2, 'and no cue in this window escapes it');
  assert.match(inv, /import \{ enhancedSoundsOn \} from '\.\.\/systems\/enhancedSounds\.js';/);
  // the classic window's own call is the reference, unchanged
  assert.match(rd('src/ui/nativeInventory.js'), /audio\.playOneShot\(plan\.sound === 'gold' \? SOUND\.GoldPieces : SOUND\.ButtonClick, 1\);/, 'the classic window plays it always, as DFU does');
  const wind = rd('src/systems/windAudio.js');
  assert.match(wind, /return enhancedSoundsOn\(\) && new URLSearchParams\(search\)\.get\('windaudio'\) !== 'off';/, 'the wind reads the one switch');
  assert.doesNotMatch(wind, /getPref\('windSound'\)/, 'no pref of its own any more');
  assert.doesNotMatch(rd('src/systems/features.js'), /key: 'windSound'/, 'and no row declares one');
});
