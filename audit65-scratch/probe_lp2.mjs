import { ListPickerWindow, PICKER_RECTS, PICKER_X, PICKER_Y } from '/home/user/daggerfall-js-source/src/ui/listPicker.js';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const run = async (third, fourth, label) => {
  const picked = [];
  const w = new ListPickerWindow({ items: ['one','two','three','four'], onPick: (i) => picked.push(i) });
  const [lx, ly] = PICKER_RECTS.list; const rh = w.rowHeight(null);
  const at = (row) => [PICKER_X + lx + 4, PICKER_Y + ly + row * rh + 1];
  w.click(...at(0), third, fourth);
  await sleep(600);                       // twice the 300 ms window
  w.click(...at(2), third, fourth);
  console.log(label, '-> picked', picked, 'done', w.done);
};
await run(false, false, 'HOST shape click(vx,vy,right,middle) after 600ms');
await run(null, undefined, 'NESTED shape click(vx,vy,font) after 600ms');
