import { ListPickerWindow, PICKER_RECTS, PICKER_X, PICKER_Y } from '/home/user/daggerfall-js-source/src/ui/listPicker.js';
const picked = [];
const w = new ListPickerWindow({ items: ['one','two','three','four'], onPick: (i) => picked.push(i) });
const [lx, ly] = PICKER_RECTS.list;
const rh = w.rowHeight(null);
const at = (row) => [PICKER_X + lx + 4, PICKER_Y + ly + row * rh + 1];
// HOST shape (worldModes.js:7090 bookshelf picker / world.js:4776 use-magic-item): click(vx, vy, right, middle)
w.click(...at(0), false, false);
console.log('after 1: selected', w.selectedIndex, 'picked', picked.length, '_lastRowClick', w._lastRowClick);
w.click(...at(2), false, false);
console.log('after 2: selected', w.selectedIndex, 'picked', picked, 'done', w.done);
// and the NESTED shape (potionMaker/travelMap/itemMaker forward click(vx,vy,font)):
const w2 = new ListPickerWindow({ items: ['one','two','three','four'], onPick: () => picked.push('nested') });
w2.click(...at(0), null);
w2.click(...at(2), null);
console.log('nested: picked', picked);
