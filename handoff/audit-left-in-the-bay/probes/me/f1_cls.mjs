const R = '/home/user/daggerfall-js-source/src/';
const { setTamrielTrace, IMPERIAL_ID } = await import(R + 'world/tamriel/tamrielLand.js');
const { setTamrielFit } = await import(R + 'world/tamriel/tamrielFrame.js');
const { rumareClass } = await import(R + 'world/tamrielWatersBake.js');
const { rumareSliceAllLand } = await import(R + 'world/rumareWaters.js');
const w = 320, h = 200, land = new Uint8Array(w * h), province = new Uint8Array(w * h);
for (let y = 0; y < 101; y++) for (let x = 0; x < w; x++) { land[y * w + x] = 1; province[y * w + x] = IMPERIAL_ID; }
setTamrielTrace({ w, h, land, province }); setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
let s = '';
for (let y = 646; y <= 670; y++) { let r = ''; for (let x = 2057; x <= 2081; x++) { const c = rumareClass(x, y); r += c === 0 ? (rumareSliceAllLand(x, y) ? '#' : 'l') : c === 1 ? '~' : 'm'; } s += y + ' ' + r + '\n'; }
console.log(s);
