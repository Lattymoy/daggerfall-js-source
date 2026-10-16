// L10N4 (2026-10-03): THE PORT'S OWN STRINGS, ROUTED. Two laws the routing batches lean on, pinned over fixtures:
// the English catalog reads an English constant the module holds (`t('k', NO_PARTY_TEXT)`, the L10N3d shape -
// `TOO_FAR_AWAY_TEXT` beside `tooFarAwayText()`), and literals joined by `+`, so a long English needs no second copy;
// and the ratchet does not count a constant's words where they are written when a text-core call reads them - they
// are routed where they are read. A constant built from anything but words is still refused as no literal English.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { extractPortStrings } from '../../tools/l10nExtract.mjs';
import { hardcodedStrings } from '../../tools/l10nHardcoded.mjs';

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'l10n4route-'));
  for (const [p, text] of Object.entries(files)) { mkdirSync(join(root, p, '..'), { recursive: true }); writeFileSync(join(root, p), text); }
  return root;
}

const SRC = [
  "import { t, localizedText } from '../systems/textManager.js';",
  "export const NO_PARTY_TEXT = 'You are not in a party.';",
  "const JOINED = 'A long English ' + 'held in two halves.';",
  "export const UNREAD_TEXT = 'Nobody reads this sentence.';",
  "const BUILT = `${1 + 1} gold in the purse`;",
  "export const noPartyText = () => t('social.party.none', NO_PARTY_TEXT);",
  "export const joinedText = () => t('social.joined', JOINED);",
  "export const tooFar = () => localizedText('youAreTooFarAway', TOO_FAR);",
  "const TOO_FAR = 'You are too far away...';",
  "export const sum = () => t('social.sum', 'Two ' + 'parts');",
].join('\n');

test('L10N4 the catalog: a t() call\'s English may be the module\'s own constant (exported or not) or literals joined by +; the key never a constant', () => {
  const root = fixture({ 'src/ui/a.js': SRC });
  try {
    const { strings, problems } = extractPortStrings(root);
    assert.deepEqual(problems, []);
    assert.deepEqual(Object.fromEntries([...strings].map(([k, v]) => [k, v.en])), {
      'social.party.none': 'You are not in a party.',
      'social.joined': 'A long English held in two halves.',
      'social.sum': 'Two parts',
    });
  } finally { rmSync(root, { recursive: true, force: true }); }
  const bad = fixture({ 'src/ui/b.js': [
    "import { t } from '../systems/textManager.js';",
    "const BUILT = `${1 + 1} gold in the purse`;",
    "const KEY = 'social.key';",
    "export const a = () => t('social.built', BUILT);",
    "export const b = () => t(KEY, 'Words');",
  ].join('\n') });
  try {
    const { problems } = extractPortStrings(bad);
    assert.deepEqual(problems.map((p) => p.replace(/^.*?: /, '')), ["'social.built' has no literal English", 'the key is not a literal']);
  } finally { rmSync(bad, { recursive: true, force: true }); }
});

test('L10N4 the ratchet: a constant a text-core call reads is routed where it is read, so its words are not counted where they are written; a constant nothing routes still counts', () => {
  const root = fixture({ 'src/ui/a.js': SRC });
  try {
    assert.deepEqual(hardcodedStrings(root).map((s) => s.text), ['Nobody reads this sentence.', ' {}  gold in the purse']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
