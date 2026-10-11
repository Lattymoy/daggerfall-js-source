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
  assert.equal(t('Health'), 'Здоровье');
  assert.equal(t('Magicka'), 'Магия');
  assert.equal(t('Fatigue'), 'Усталость');
  assert.equal(t('Enduring'), 'Стойкий род');
  assert.equal(t('Bloodline'), 'Чистая кровь');
  assert.equal(t('No lineage'), 'Без династии');
  assert.equal(t('Rat'), 'Крыса');
  assert.equal(t('Rat (dead)'), 'Крыса (труп)');
  assert.equal(t('Lock Level: 15'), 'Уровень замка: 15');
  assert.equal(t('and 4 more'), 'и ещё 4');
  assert.equal(t('Arkay takes 6% of a lifespan for every road back,'), 'Аркей забирает 6% срока жизни за каждое возвращение,');
  assert.equal(t('every 15 points of it is a level.'), 'каждые 15 очков дают новый уровень.');
  assert.equal(labelOf('Controls/MouseLookSensitivity'), 'Чувствительность мыши');
  assert.equal(labelOf('Controls/SoundVolume'), 'Громкость звуков');
  assert.equal(labelOf('GUI/SDFFontRendering'), 'Сглаженные шрифты (SDF)');

  // Reset to English for test isolation
  setLanguage('en');
  assert.equal(getLanguage(), 'en');
  assert.equal(t('Continue'), 'Continue');
  assert.equal(t('Rat (dead)'), 'Rat (dead)');
  assert.equal(labelOf('Controls/MouseLookSensitivity'), 'Mouse Sensitivity');
  setLanguage(null);
});

test('Russian: items, held map, and inventory localization', () => {
  setLanguage('ru');
  try {
    // Items and gender grammar
    assert.equal(t('Broadsword'), 'Палаш');
    assert.equal(t('Claymore'), 'Клеймор');
    assert.equal(t('Cuirass'), 'Кираса');
    assert.equal(t('Greaves'), 'Поножи');
    assert.equal(t('Gauntlets'), 'Латные перчатки');
    assert.equal(t('Iron Broadsword'), 'Железный палаш');
    assert.equal(t('Leather Cuirass'), 'Кожаная кираса');
    assert.equal(t('Orcish Battle Axe'), 'Орочья секира');
    assert.equal(t('Steel Longsword'), 'Стальной длинный меч');
    assert.equal(t('Daedric Greaves'), 'Даэдрические поножи');
    assert.equal(t('3 of them'), '3 шт.');
    assert.equal(t('50 gold'), '50 золота');
    assert.equal(t('Pay 200 gold'), 'Заплатить 200 золота');
    assert.equal(t('3 days'), '3 дн.');
    assert.equal(t('5 days of your time'), '5 дн. вашего времени');

    // Held Map
    assert.equal(t('The Bay'), 'Залив');
    assert.equal(t('Town'), 'Город');
    assert.equal(t('Interior'), 'Интерьер');
    assert.equal(t('Dungeon'), 'Подземелье');
    assert.equal(t('Ports'), 'Порты');
    assert.equal(t('Ports only'), 'Только порты');
    assert.equal(t('Find a place…'), 'Поиск места…');
    assert.equal(t('Write a note…'), 'Написать заметку…');
    assert.equal(t('Begin journey'), 'Отправиться');
    assert.equal(t('Travel here'), 'Отправиться сюда');
    assert.equal(t('Teleport here'), 'Телепортироваться сюда');
    assert.equal(t('Teleport to Wayrest?'), 'Телепортироваться в Вэйрест?');
    assert.equal(t('Town under attack'), 'Нападение на город');
    assert.equal(t('Revenant lair'), 'Логово выходца');
    assert.equal(t('Dagon\'s Breach'), 'Прорыв Дагона');
    assert.equal(t('Waypoints'), 'Путевые точки');
    assert.equal(t('Personal (2)'), 'Личные (2)');

    // Enhanced Inventory
    assert.equal(t('Pack'), 'Сумка');
    assert.equal(t('Damage'), 'Урон');
    assert.equal(t('Armour'), 'Броня');
    assert.equal(t('Hands'), 'Хват');
    assert.equal(t('Weight'), 'Вес');
    assert.equal(t('Condition'), 'Состояние');
    assert.equal(t('Mount'), 'Скакун');
    assert.equal(t('Cart'), 'Телега');
    assert.equal(t('On foot'), 'Пешком');
    assert.equal(t('Open the wagon'), 'Открыть телегу');
    assert.equal(t('Leave the wagon'), 'Закрыть телегу');
    assert.equal(t('Dismantle'), 'Разобрать');
    assert.equal(t('Salvage'), 'Утилизировать');
    assert.equal(t('Keep'), 'Оставить');
    assert.equal(t('Dismantle Ebony Cuirass?'), 'Разобрать Эбонитовая кираса?');
    assert.equal(t('Salvage Steel Longsword?'), 'Утилизировать Стальной длинный меч?');
  } finally {
    setLanguage(null);
  }
});
