import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, whereIs } from '../../../src/ui/settings/settingsMap.js';
import { portPool } from '../../../src/ui/enhanced/enhancedMenu.js';
import { playerEntity } from '../../../src/characters/playerEntity.js';

function fakeDocument() {
  const make = (tag) => {
    const n = {
      tag, children: [], className: '', textContent: '', title: '', type: '', disabled: false, style: {}, dataset: {}, attrs: {},
      append(...cs) { for (const c of cs) n.children.push(c); }, prepend(...cs) { n.children.unshift(...cs); },
      setAttribute(k, v) { n.attrs[k] = v; }, addEventListener() {}, querySelectorAll: () => [],
      classList: {
        add: (c) => { n.className = `${n.className} ${c}`.trim(); },
        toggle: (c, on) => { const has = n.className.split(/\s+/).includes(c); if (on ?? !has) { if (!has) n.classList.add(c); } else n.className = n.className.split(/\s+/).filter((x) => x !== c).join(' '); },
        contains: (c) => n.className.split(/\s+/).includes(c),
      },
    };
    return n;
  };
  return { createElement: make, createTextNode: (t) => ({ textContent: t }), querySelectorAll: () => [], getElementById: () => null };
}

function withDoc(fn) {
  globalThis.document = fakeDocument();
  try { return fn(); } finally { delete globalThis.document; }
}

test('Reflexes in-game setting: mapped to Combat > Enemies section', () => {
  const where = whereIs('port:reflexes');
  assert.ok(where, 'port:reflexes is mapped');
  assert.equal(where.tab.id, 'combat');
  assert.equal(where.section.id, 'enemies');

  const enemySec = CATEGORIES.find((t) => t.id === 'combat')?.sections?.find((s) => s.id === 'enemies');
  assert.ok(enemySec?.items?.includes('port:reflexes'), 'port:reflexes is in enemies items');
});

test('Reflexes in-game setting: disabled when not in a game, enabled and mutates playerEntity during pause', () => {
  withDoc(() => {
    // 1. Off-game (boot / main menu)
    const poolBoot = portPool({ pause: false });
    const rowBoot = poolBoot.get('reflexes');
    assert.ok(rowBoot, 'reflexes row exists in boot pool');
    assert.equal(rowBoot.dataset.opt, 'reflexes');
    assert.equal(rowBoot.dataset.live, '0', 'row is inactive outside a game');

    // 2. In-game (pause)
    playerEntity.chargenDone = true;
    playerEntity.reflexes = 2; // Average

    const clickNext = () => {
      const pool = portPool({ pause: true });
      const row = pool.get('reflexes');
      const actBtn = row.children[1].children[0];
      actBtn.onclick();
    };

    // Initial value is 2 (Average). Clicking should step to 3 (Low)
    clickNext();
    assert.equal(playerEntity.reflexes, 3, 'steps from 2 to 3 (Low)');

    clickNext();
    assert.equal(playerEntity.reflexes, 4, 'steps from 3 to 4 (Very Low)');

    clickNext();
    assert.equal(playerEntity.reflexes, 0, 'wraps from 4 to 0 (Very High)');

    clickNext();
    assert.equal(playerEntity.reflexes, 1, 'steps from 0 to 1 (High)');

    clickNext();
    assert.equal(playerEntity.reflexes, 2, 'steps from 1 to 2 (Average)');
  });
});
