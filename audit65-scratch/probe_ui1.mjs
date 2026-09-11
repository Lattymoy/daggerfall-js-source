import { SpellbookWindow, SPELLBOOK_RECTS, SPELLBOOK_LAYOUT } from '/home/user/daggerfall-js-source/src/ui/spellbookWindow.js';
const PX = SPELLBOOK_LAYOUT.x, PY = SPELLBOOK_LAYOUT.y;
const spell = (name, cost) => ({ name, cost, effects: [], icon: { index: 0 } });
const entity = { name: 'N', magicka: 20, maxMagicka: 40, spells: [spell('A',5),spell('B',5),spell('C',5)], items: [], stats: { personality: 50 } };
const readied = [];
const w = new SpellbookWindow({ spells: () => entity.spells, entity, castCost: (sp)=>sp.cost, onReady: (sp,o)=>readied.push([sp,o]), rows: () => [] });
w._font = { fnt: { fixedHeight: 6, fixedWidth: 4, glyphWidth: () => 4 } };
const [lx, ly] = SPELLBOOK_RECTS.list;
const rowY = (i) => PY + ly + i * (6 + SPELLBOOK_LAYOUT.rowSpacing) + 1;
// THE HOST'S CALL SHAPE: townTalk.js:1123 -> click(vx, vy, e.button === 2, e.button === 1)
const hostClick = (x, y, button = 0) => w.click(x, y, button === 2, button === 1);
hostClick(PX + lx + 4, rowY(0));            // click row 0
console.log('after click 1: selected', w.selectedIndex, 'readied', readied.length, '_lastRowClick', w._lastRowClick);
hostClick(PX + lx + 4, rowY(2));            // click row 2, "ten seconds later"
console.log('after click 2: selected', w.selectedIndex, 'readied', readied.length, readied.map(r=>r[0].name));
