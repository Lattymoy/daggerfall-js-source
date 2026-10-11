import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SDF_CODES, asciiFold } from '../src/ui/text.js';
import { sanitizeName } from '../src/net/wire.js';
import { checkName, normaliseName } from '../src/net/nameFilter.js';
import { encodeRscRecord, decodeRscBytes, TextRsc } from '../src/formats/textRsc.js';
import { t, setLanguage, getLanguage, RU } from '../src/systems/i18n.js';
import { labelOf } from '../src/ui/settingsCopy.js';

test('Russian: SDF_CODES includes Cyrillic Unicode block', () => {
  // Check that 1024..1119 (0x0400..0x045F) is in SDF_CODES
  assert.ok(SDF_CODES.includes(1025), 'Ё (1025) included');
  assert.ok(SDF_CODES.includes(1040), 'А (1040) included');
  assert.ok(SDF_CODES.includes(1071), 'Я (1071) included');
  assert.ok(SDF_CODES.includes(1072), 'а (1072) included');
  assert.ok(SDF_CODES.includes(1103), 'я (1103) included');
  assert.ok(SDF_CODES.includes(1105), 'ё (1105) included');
});

test('Russian: asciiFold passes through Cyrillic characters', () => {
  assert.equal(asciiFold('A'.charCodeAt(0)), 65);
  assert.equal(asciiFold('И'.charCodeAt(0)), 1048);
  assert.equal(asciiFold('я'.charCodeAt(0)), 1103);
  assert.equal(asciiFold(200), 63, 'unknown non-Cyrillic > 127 folds to ?');
});

test('Russian: sanitizeName and checkName accept Russian names', () => {
  assert.equal(normaliseName('Иван'), 'иван');
  assert.equal(normaliseName('Даэдрот'), 'даэдрот');
  assert.ok(checkName('Иван').ok);
  assert.ok(checkName('Даэдрот').ok);
  assert.equal(sanitizeName('Иван'), 'Иван');
  assert.equal(sanitizeName('Даэдрот'), 'Даэдрот');
  assert.equal(sanitizeName('  Сэр Ланселот  '), 'Сэр Ланселот');
});

test('Russian: TEXT.RSC encoding and decoding round-trip', () => {
  const enc = encodeRscRecord(['Привет, мир!', 'Второй вариант']);
  const tr = new TextRsc();
  tr._table = new Map([[100, enc]]);
  tr._byId = new Map();
  const variants = tr.plainText(100);
  assert.deepEqual(variants, ['Привет, мир!', 'Второй вариант']);
});

test('Russian: i18n translation system translates UI and settings', () => {
  setLanguage('ru');
  assert.equal(getLanguage(), 'ru');
  assert.equal(t('Continue'), 'Продолжить');
  assert.equal(t('New Game'), 'Новая игра');
  assert.equal(t('Settings'), 'Настройки');
  assert.equal(t('Online'), 'Сетевая игра');
  assert.equal(t('Yes'), 'Да');
  assert.equal(t('No'), 'Нет');
  assert.equal(labelOf('Controls/MouseLookSensitivity'), 'Чувствительность мыши');
  assert.equal(labelOf('Controls/SoundVolume'), 'Громкость звуков');
  assert.equal(labelOf('GUI/SDFFontRendering'), 'Сглаженные шрифты (SDF)');

  // Reset to English for test isolation
  setLanguage('en');
  assert.equal(getLanguage(), 'en');
  assert.equal(t('Continue'), 'Continue');
  assert.equal(labelOf('Controls/MouseLookSensitivity'), 'Mouse Sensitivity');
});
