// PLUS6: THE GAUNTLET CURSOR (Enhanced Plus only) - the grey gauntlet, and a second frame with the pointing finger
// drawn in while a mouse button is held (click and hold, drag). Pixel art, two sizes (1x, and 2x for dense screens),
// embedded so it needs no asset. The hot spot is the fingertip in both frames, so a press never moves the point.
// CURSOR-EDGE: 31x32 (62x64 at 2x), never more than 32 on a side. Chromium shows a custom cursor larger than 32 DIP
// only while the whole image lies inside the viewport, and the OS arrow anywhere else - the gauntlet was 31x34 and went
// to the arrow within 31 px of the right edge and 34 px of the foot. Two rows of the hand were dropped to fit.
// A text field keeps the text caret. installPlusCursor() is called once, when the Plus sheet is laid on the page.

import { getPref, setPref } from '../../systems/uiPrefs.js';

const N1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB8AAAAgCAYAAADqgqNBAAAFg0lEQVR4AbXBMWgj2QGA4X+smUECGYwtZmSmHZYBP8/qfPDKcCTk4GB3SXGkubCwy5LyqquukppAIBAIXBPCVZtmuWKbEAJu3LgQnFZIc2EI0+wug6VBXrsQSIzejOIHFghj++wN+T6jWqsvucZ8NjX4PzOqtfrStGxW/EAQD3to89nU4FK1Vl9yg/lsavARjGqtvjQtGz8QiLBFNOiTxBFqkXPVl189Jxr00ZI4wg8E8bCHNp9NDe7JqNbqy2D/AE2ELbRo0OcmImwRDfpoSRzhB4J42EObz6YG97DBhXjYI4kjVkTYQkviiOuIsEUSR/iBIIkjgv0DtGqtvuQeKkrlHdOy2w/2HnJ8dIgqSh49fsInB5/y9t17RNji0eMnLFRBNh5xfHRIsBfy9NkL3vR+ZLvhkMQRD/YeMslOMC27rVTe4Q4qXDAtuz3JTniw9xBtoQo8z2OhCl6/esnbd+9x3CaPHj/h7bv3HB8dsrm1g+M2OT46RNtuODTcXSbZCUrlHe6gwgWl8o5p2e1JdkLD3SUbj1ioAiklm1s7HB8dooqShSp49PgJb9+95/jokGAv5OmzF2xu7eC4TY6PDinLAtOy20rlHX5GhUtK5R3TstvnZ6d8mGSoomShCqSUbG7tcHx0SPzTgF99/gWfHHzK5tYOmud5/Ouf/+D46BDtwd5DJtkJSuUdfobJNfxAoEWDPpqUEikl3W4XrdvtokWDPtGgTxJHrCRxxF1tcKlaqy+58Ic//QVNhC2uklKiSSlZ5weCj1HhkmnZ7WD/gIUqOD46JNgLcdwmWpqmpGlKmqZ4nofmeR4LVeC4TbLxiO2Gw4dJhlaWBaZlt5XKO9xigxtEgz7a61cvWZFSsk5KyXWC/QPuYoMbJHGElBI/EESDPnfhB4Lf/PZ3iLCFVq3Vl9yiwiXTstsNdxfHbfL02Qs2t3b47s9/5MMk4xe//BwpJd1ulzRN8TyPlTRNcdwm2XiElo1HZOMRn/36C/49fINp2W2l8g7X2GBNEkdo3W6XaNDHDwQfI4kjokGfYP8ArVqrL7lGhUumZbfLsuA/8U+oomRlu+HguE08zyNNU7Q0TfE8D83zPNI0JRuPEGELx20S7IU4bpNsPKLh7jLJTjAtu61U3mHNBpfms6nBBbXISeKI+5BS8vzF79F++Pv3SCnRRNhChC2C/QO0aq2+ZM0Ga+azqcEFtchZFw36rESDPtr3f/sr1/nyq+d0u12klKzEwx7B/gFatVZfcqnCFUrlHdOy25PshPOzU7YbDiJskaYp0aCPlo1HiLCF53msS9MULRr0WagCKSVpmlJioDXcXSbZCaZlt5XKOxWuoVTeMS27XZYF52enqKIkG49YEWELKSVXpWmKlo1HZOMRC1WgOW6TbDxCOz87pSwLTMtuV7iBUnnHtOx2WRacn52y3XBYcdwmaZrieR7rPM/D8zze9H5Ey8YjsvEIx22SjUdo2w2HhrvLJDuhwi2UyjumZbfLsuD87JTthoMIW0SDPo7bxPM8rrNQBY7bJBuP0LLxiJUkjvgwySjLAoM7qtbqS9Oy8QPBighbSClZ1+12ef3qJVf5gUBL4ghNLXJM7kEtctZFgz6alBLt22++ZsUPBEkc4QeCm2xwR/PZ1OBSEkes63a7fPvN11zlB4J1SRyh+YFAM7iHaq2+5IJp2Wh+INCSOELzA8FNkjjCDwRaPOyhbXAP89nU4IIfCNb5gcAPBCJsoYmwxbokjtDiYY942EObz6aGwT1Va/UlF0zLxg8Et0niCM0PBPGwhzafTQ0uGXyEaq2+NC2bFT8QrEviCM0PBPGwx8p8NjVYY/KR1CJHMy2bJI64Si1y4mEPbT6bGlzD4H9QrdWX3GI+mxrc4r/g7nZepWaaWAAAAABJRU5ErkJggg==';
const N2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD4AAABACAYAAABC6cT1AAAFhUlEQVR4AeXBsWrz3BnA8b+EbCTQZWg4w7EQHp7ryFCyNFMIGTt16gV0KF3aqYSQye9i3sHXcQYj5DOcQZdhsEkCqh/ocAj6XCdvkg8+/X5JXpQD73A87BP+AFImKsmLcuAkm80ZUxmLCrstseNhnzAiL8qBDzge9gnfKGWikrwoB06y2RxVGYuydYPyXYvqg0e9vjxziT/9+Rblu5ZYHzyqMhYVdltix8M+4RukTFSSF+XAiVksidm6Iea7lo+wdYPyXUusDx5VGYsKuy2x42Gf8IVSJirJi3Igks3mqKvrG8b4rkX1waMqYznH1g2xzXqFqoxF9cGjKmNRYbcldjzsE75AykQl/E9elAMnZrFE9cGjKmNRt3f3xJ4eH1C2blAignLOoXzXovrgUVfXNygRQT09PhDrg0dVxqLCbkvseNgnfKKUicp4I+y2KLNYEnPOoUQEZesGtVmvUL5rUbZuULd396inxwfUZr0iZusGtVmvGGMWS1TYbfkKKROV8EZelAMRs1gSs3WDEhGUcw61Wa9QlbEoWzcoEUE9PT6g+uBRV9c3KBFBOeeIbdYr1OvLM7HjYZ/wCVImKuON42GfcJIX5cBJHzzniAixzXqF6oNHiQjq9u4e5ZxjjO9aVB88MbNYosJuy2dKmaiMC1XGEvNdS0xEUCKCcs4Rc84R812L8l2L6oNnTB88XyFlojLeyItyIPL3f/4b9fT4gLJ1g/JdyzkiQkxEUM45xlTGovrg+Q4pE5XwRl6UAydmsUTZukFt1ivU1fUN7yEijHHOEfNdS6wPntjryzOx42Gf8AtSJirjnXzXomzdoDbrFerq+oaYiHCOiKCcc1zCLJaosNvyGVImKuOd+uBRt3f3KN+1KN+1KFs3fIbKWJStG2Jht0XlRTlwcjzsEz4gZaIS3siLcuDELJYoWzcoEUE551Cb9YrY1fUNSkRQzjliIsIY5xwx37WcY+sG9fPHE7HjYZ/wDikTlfEb+uBRtm5QzjmU71pUZSyqD57v0AdPzCyWqLDbovKiHDg5HvYJF0iZqIQ38qIciGSzOaoylnNs3aBEBOWcY4yIMMY5h/Jdi7J1wzm+a4mF3ZbY8bBPOCNlohJ+Q16UA5FsNkdVxjLG1g1KRFDOOcaICJdwzqF+/nhC/eNf/0E55xjjuxYVdltix8M+YUTKRCX8H3lRDkTMYsk5t3f3KOccynctytYNynct6vbunnOcc4wREZRzjtjPH08os1iiwm5L7HjYJ0RSJirhQnlRDkSy2RxVGYuydUPMdy1jbN2gRIRznHPEfNeibN2gRATlnEP5rmVM2G2JHQ/7hJOUiUp4p7woByLZbI6qjOUcWzcoEeESzjlivmuJ2bphjO9aYn3wqNeXZ2IpE5XwQXlRDkSy2RxVGcsYWzfERIT3eHp84BxbNyjftZwTdltUykQl/KK8KAci2WyOqoxF2bpB+a5F2bpBiQjv4Zwj5ruWS/TBE3t9eUalTFTCJ8uLcuAkm81RlbGMsXWDEhHOcc6hNusVl6iMJdYHT+z15RmVMlEZX+T15ZlzfNcSExFif/vrXxhTGYvqg0dVxvIRKROV8EXyohw4MYslqg8eVRlLzNYNsc16xTmVsVyiD55YZSwq7LaolIlK+CJ5UQ5EstmcWGUssT54YpWxfEQfPKoylljYbYmlTFTCF8uLcuDELJaoPnhUZSzn2LpB+a5F2bpB+a5lTB88sdeXZ8YcD/uEk5SJSvhieVEORLLZHFUZy6/ogydWGYsKuy2x42GfMCJlohK+SV6UAyfZbM6YyljO6YMnVhmLCrstY46HfcIZKROV8c1eX56JZbM5qg+eS7y+PKPCbkvseNgnvEPKRCX8TvKiHPgFx8M+4RekTNR/AaLyEbJ5GWBRAAAAAElFTkSuQmCC';
const P1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB8AAAAgCAYAAADqgqNBAAAE50lEQVR4AcXBsWsj2QHA4d/IM4MEOjh8YkbLtEN4sE8ToeKVSwgkEEjCFeGamINbzJZbXXWV3AQCgUAgTQhXOY1J4T9gm222GIhOSJMwhGmS8FhpsNcuBBLSaCZ+YMFgtD7bKfJ9/D9ZPFGz1a64tVouLJ6gwRP01YvKdlxEb4DRbLUrnqDBIx0dv664EQpJliaI3gCj2WpXPJLFHc1Wu2KP1XJh9dWLSkZ9jPOzU0IhydKEUEjS6QhjtVxYPFCDPWzHxXZcbMdF9AYYR8evK26cn51i/OZ3f8AIhSRLE0RvgNFstSseqMFHhELy+RdHGKI3wHh5/IpQSM7PTonjGBn1ydKEHdEb8BgH3GE77vAHz3+I4fldPL/Lu7dvKLYlm2LLz3/xS/717//w7u0bxPOIL7865pNPP8Pzu7x7+4ay3GI77rAo1id8D5s90ukI23GRUR+lFMb52SlZmqCU4uXxK+I4ZieZjMnSBEP0BqTTEQ9hsUez1a5Eb4Ahoz5KKYw4jlFKEccxRjIZY2RpQl2xWbNaLiy+R4M9RG+AjPrcpZTCUEpRFwrJUxxwx9Hx6+rd2zeI5xGe38XQWqO1RmtNEAQYQRCwKbZ4fpd8PuOw4/HhIscoyy224w6LYn3CPRrU9NWLilvJZIxxfnbKjlKKOqUU+4jegIdocKvZalfUZGmCUopQSJLJmIcIheTzL46QUR+j2WpX3OOAW7bjDjv+Mzy/y5dfHfPJp5/xx9//lg8XOS9+/FOUUsRxjNaaIAjY0Vrj+V3y+Qwjn8/I5zN+9JOf8Y/pd9iOOyyK9Ql7NKjJ0gQjjmOSyZhQSJ4iSxOSyRjRG2A0W+2KPQ64ZTvusCy3/DP9O8W2ZOew4+H5XYIgQGuNobUmCAKMIAjQWpPPZ8ioj+d3Ec8jPL9LPp/R8Z9xkb/HdtxhUaxPqGlwa7VcWNwoNmuyNOExlFK8PH6F8de/fItSCkNGfWTUR/QGGM1Wu6KmQc1qubC4UWzW1CWTMTvJZIzx7Z//xD6/+vVL4jhGKcVOOh0hegOMZqtdceuAO4pifWI77vAif8/11SWHHQ8Z9dFak0zGGPl8hoz6BEFAndYaI5mM2RRblFJorSmxMDr+My7y99iOOyyK9ckBexTF+sR23GFZbrm+uqTYluTzGTsy6qOU4i6tNUY+n5HPZ2yKLYbnd8nnM4zrq0vKcovtuMMDPqIo1ie24w7Lcsv11SWHHY8dz++itSYIAuqCICAIAr4b/Q0jn8/I5zM8v0s+n2Ecdjw6/jMu8vcccI+iWJ/Yjjssyy3XV5ccdjxk1CeZjPH8LkEQsM+m2OL5XfL5DCOfz9jJ0oQPFzllucXigZqtdmU7LqGQ7Mioj1KKujiOOT875a5QSIwsTTCKzRqbRyg2a+qSyRhDKYXxzdev2QmFJEsTQiH5mAYPtFouLG5laUJdHMd88/Vr7gqFpC5LE4xQSAyLR2i22hU3bMfFCIXEyNIEIxSSj8nShFBIjHQ6wmjwCKvlwuJGKCR1oZCEQiKjPoaM+tRlaYKRTkek0xHGarmwLB6p2WpX3LAdl1BI7pOlCUYoJOl0hLFaLixuWTxBs9WubMdlJxSSuixNMEIhSacjdlbLhUWNzRMVmzWG7bhkacJdxWZNOh1hrJYLiz0s/gfNVrviHqvlwuIe/wWp6Akk0hPkhQAAAABJRU5ErkJggg==';
/** PADPLUS1: the two frames at 1x, for the controller cursor (ui/gamepadInput.js), which draws its own element. */
export const GAUNTLET_POINT = N1;
export const GAUNTLET_PRESS = P1;
const P2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD4AAABACAYAAABC6cT1AAAFIElEQVR4Ae3BMW7bTBqA4XcISiABHoPFFCOCUDFlzpBikeZ3ZRgpU221R9huu0UQuFIaIYXOMQVBUFNMwWMIIGEb4K+vGwSMLCe2t+A+D/+3MIp3luXFxIxxOCneUcJCKd5JbT9MnPXBI0ptEOHYEBuHk+IdJCyU4o3d3H2ZOPNdS6wPHlFqgwjHhtg4nBRvKGGhFM/I8mLiBcbhpDir7YeJM1PVxA77HaLUBtEHjyi1QYRjQ2wcToo3kLBQimdkeTFxlq7WzCm1QYRjg/jHX7cI37WIPnjEx083CGst4v7bV2J98IhSG0Q4NsTG4aR4RQkLlfJCpTYIU9UI37UIvdkSu737jLj/9hVx2O+ImapGHPY75ujNFhGODW8hYaEUz8jyYuJMb7bETFUTO+x3iFIbhKlqhLUWcf/tK6IPHvHx0w3CWotwzhE77HeIp8cHYuNwUryChIVKuVI4Noh0tUaYqkZYa4kd9jtEHzzCWou4vfuMcM4xx3ctog+emN5sEeHY8JoSFkpxpSwvJs70ZkvMVDXCWkvMOYew1iKcc8R81xLrg+eSp8cHxDicFK8gYaFSrqQ3W4SpaoTvWi6x1hKz1iKcc8wptUH0wfMeEhZK8Yybuy8TZ4f9DvHx0w0vYa1ljnOOmO9aYn3wxJ4eH4iNw0nxBxIWKuUXavthYobvWoSpasRhv0N8/HRDzFrLJdZahHOOa+jNFhGODa8hYaFSfpLlxcQFffCI27vPCN+1CN+1CFPVvIZSG4SpamLh2CCyvJg4G4eT4jckLJTiJ1leTJzpzRZhqhphrUU45xCH/Y7Yx083CGstwjlHzFrLHOccMd+1XGKqGvHj+z2xcTgpXiBhoVJ+oQ8eYaoa4ZxD+K5FlNog+uB5D33wxPRmiwjHBpHlxcTZOJwUV0hYKMVPsryYiKSrNaLUhktMVSOstQjnHHOstcxxziF81yJMVXOJ71pi4dgQG4eT4oKEhVL8QpYXE5F0tUaU2jDHVDXCWotwzjHHWss1nHOIH9/vEf/+z38Rzjnm+K5FhGNDbBxOihkJC6V4RpYXExG92XLJ7d1nhHMO4bsWYaoa4bsWcXv3mUucc8yx1iKcc8R+fL9H6M0WEY4NsXE4KSIJC6W4UpYXE5F0tUaU2iBMVRPzXcscU9UIay2XOOeI+a5FmKpGWGsRzjmE71rmhGNDbBxOirOEhVK8UJYXE5F0tUaU2nCJqWqEtZZrOOeI+a4lZqqaOb5rifXBI54eH4glLJTiN2V5MRFJV2tEqQ1zTFUTs9byEvffvnKJqWqE71ouCccGkbBQij+U5cVEJF2tEaU2CFPVCN+1CFPVCGstL+GcI+a7lmv0wRN7enxAJCyU4pVleTFxlq7WiFIb5piqRlhrucQ5hzjsd1yj1IZYHzyxp8cHRMJCpbyRp8cHLvFdS8xaS+xf//zCnFIbRB88otSG35GwUIo3kuXFxJnebBF98IhSG2Kmqokd9jsuKbXhGn3wxEptEOHYIBIWSvFGsryYiKSrNbFSG2J98MRKbfgdffCIUhti4dgQS1goxRvL8mLiTG+2iD54RKkNl5iqRviuRZiqRviuZU4fPLGnxwfmjMNJcZawUIo3luXFRCRdrRGlNvyJPnhipTaIcGyIjcNJMSNhoRTvJMuLibN0tWZOqQ2X9METK7VBhGPDnHE4KS5IWKiUd/b0+EAsXa0RffBc4+nxARGODbFxOCleIGGhFP8jWV5M/IFxOCn+QMJC/Q22X+BmL0WPiAAAAABJRU5ErkJggg==';
export const CURSOR_HOTSPOT = [0, 0];
const cur = (a, b) => `image-set(url("${a}") 1x, url("${b}") 2x) ${CURSOR_HOTSPOT[0]} ${CURSOR_HOTSPOT[1]}, auto`;
const curFallback = (a) => `url("${a}") ${CURSOR_HOTSPOT[0]} ${CURSOR_HOTSPOT[1]}, auto`;

export const CURSOR_CSS = `
/* ── PLUS6: THE GAUNTLET CURSOR ── !important on purpose: many buttons and rails (and sheets injected after this one)
   set their own cursor: pointer, which showed the system hand over them. The gauntlet is the one pointer Plus has. */
html:not(.plus-nocursor), html:not(.plus-nocursor) *, html:not(.plus-nocursor) *::before, html:not(.plus-nocursor) *::after { cursor: ${curFallback(N1)} !important; cursor: ${cur(N1, N2)} !important; }
html.plus-press:not(.plus-nocursor), html.plus-press:not(.plus-nocursor) *, html.plus-press:not(.plus-nocursor) *::before, html.plus-press:not(.plus-nocursor) *::after { cursor: ${curFallback(P1)} !important; cursor: ${cur(P1, P2)} !important; }
/* DROPS-AUDIT F7: a controller hides the pointer on the canvas (gamepadInput.js: Cursor.visible = false) - the gauntlet
   stands down there too, or it sat parked beside the controller's own cursor */
html:not(.plus-nocursor) canvas[style*="cursor: none"] { cursor: none !important; }
html:not(.plus-nocursor) input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), html:not(.plus-nocursor) textarea, html:not(.plus-nocursor) [contenteditable="true"] { cursor: text !important; }
`;

/** PLUS6: the gauntlet is ON unless the player turned it off (UI Overhaul card, Enhanced Plus). */
export const plusCursorOn = () => getPref('plusCursor') !== false;
/** Wear the stored choice on the page: off puts .plus-nocursor on the root and the rules above stand down. */
export function applyPlusCursor(doc = globalThis.document) {
  doc?.documentElement?.classList?.toggle('plus-nocursor', !plusCursorOn());
}
/** Choose: stored, and worn at once - no reload. */
export function setPlusCursor(on, doc = globalThis.document) {
  setPref('plusCursor', !!on);
  applyPlusCursor(doc);
}

let installed = false;
export function installPlusCursor(doc = globalThis.document) {
  const win = doc?.defaultView;
  if (installed || !win) return;
  installed = true;
  const root = doc.documentElement;
  applyPlusCursor(doc);
  // CLICK-STUTTER (2026-10-13, field: "when I'm spamming the left mouse button the game starts to stutter"): the press
  // frame is a class on <html>, and the rules above match EVERY element and pseudo-element under it - so each toggle
  // restyles the whole page, twice a click. With the pointer LOCKED (a swing in the world) there is no cursor to draw:
  // the press is not worn at all, and a class left on from before the lock is taken off once.
  const down = (e) => {
    if (e.pointerType === 'touch' || doc.pointerLockElement) return;
    if (!root.classList.contains('plus-press')) root.classList.add('plus-press');
  };
  const up = () => { if (root.classList.contains('plus-press')) root.classList.remove('plus-press'); };
  win.addEventListener('pointerdown', down, { capture: true, passive: true });
  win.addEventListener('pointerup', up, { capture: true, passive: true });
  win.addEventListener('pointercancel', up, { capture: true, passive: true });
  win.addEventListener('blur', up);
}
