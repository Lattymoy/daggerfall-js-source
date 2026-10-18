// @ts-check
// ═══════════════════════════════════════════════════════════════════
// GUILD1d (2026-09-30, Mac: "Lets do this") — THE HERALDRY, DRAWN
// (bible/11-Multiplayer/Seats-Arc.md 8.1: "A device, one of 24 of the
// port's own drawn charges (SVG silhouettes committed as the port's
// own art)").
//
// Each device is a few SVG path parts in a 100 x 100 box: `fg` parts
// in the device's colour, `bg` parts in the field's (a hole - an eye,
// a door, a gap between bars), a `w` part stroked that wide rather than
// filled. The banner (Seats-Arc 3.4) is the port's own cloth, 1 wide by
// 3 tall: its field the first colour, a border in the second, the
// device centred in the border's colour (GUILD2c: or its own, `charge`;
// a divided field's second part in `field2`), the foot cut as a
// swallowtail. GUILD2c: forty devices now (AUDIT2 GUILD2 G5).
// One drawing, two faces: an SVG string for the Guild tab, and a canvas
// for the world's cloth (render/bannerPass.js) - Path2D reads the same
// path text, so the tab and the street show one banner.
//
// Not a DFU member: Daggerfall Unity has no player guilds. Ledger A
// (ONLINE).
// ═══════════════════════════════════════════════════════════════════
import { HERALDRY_DEVICES, heraldryOf, heraldryColourOf, heraldryInk, heraldryKey } from '../net/heraldryLaw.js';

/** A circle as path text. */
const circle = (cx, cy, r) => `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
/** A star of `n` points about (cx, cy), its points at `R` and its hollows at `r`, the first point straight up. */
function star(cx, cy, R, r, n) {
  const pts = [];
  for (let i = 0; i < 2 * n; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const d = i % 2 ? r : R;
    pts.push(`${(cx + d * Math.cos(a)).toFixed(1)} ${(cy + d * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
}
const fg = (d) => ({ d });
const bg = (d) => ({ d, bg: true });
const line = (d, w) => ({ d, w });

/** THE FORTY DEVICES - GUILD1d's twenty-four and GUILD2c's sixteen, the record's order (heraldryLaw.js HERALDRY_DEVICES),
 *  each its parts. */
export const DEVICE_ART = Object.freeze({
  wolf: [fg('M84 80 L70 62 L74 30 L65 40 L60 16 L52 36 C40 36 30 42 22 50 L8 56 L10 63 L30 65 L40 72 L46 86 Z'), bg(circle(47, 47, 3.5))],
  bear: [fg(circle(27, 26, 10)), fg(circle(73, 26, 10)), fg('M50 26 C72 26 84 42 82 60 C80 78 66 88 50 88 C34 88 20 78 18 60 C16 42 28 26 50 26 Z'), bg(circle(38, 52, 4)), bg(circle(62, 52, 4)), bg('M42 68 C44 62 56 62 58 68 C56 74 44 74 42 68 Z')],
  boar: [fg('M12 60 C14 44 32 36 54 38 L66 30 L68 40 C78 42 86 50 90 58 L82 60 L86 65 L76 65 C74 70 70 72 66 72 L66 84 L58 84 L58 72 L36 72 L36 84 L28 84 L28 72 C18 70 12 66 12 60 Z'), bg(circle(70, 48, 3)), bg('M80 64 L90 56 L88 62 Z')],
  stag: [fg('M43 92 L41 62 L32 54 L37 49 L46 55 L54 55 L63 49 L68 54 L59 62 L57 92 Z'), fg('M42 50 L31 30 L20 26 L27 22 L33 27 L29 12 L37 25 L41 14 L42 30 L48 48 Z'), fg('M58 50 L69 30 L80 26 L73 22 L67 27 L71 12 L63 25 L59 14 L58 30 L52 48 Z')],
  lion: [fg(star(50, 52, 42, 32, 14)), bg(circle(40, 46, 4)), bg(circle(60, 46, 4)), bg('M42 64 L50 72 L58 64 C54 68 46 68 42 64 Z')],
  eagle: [fg('M50 14 L57 25 L55 38 L80 28 L92 33 L79 41 L90 46 L75 52 L60 53 L58 65 L67 82 L56 75 L50 87 L44 75 L33 82 L42 65 L40 53 L25 52 L10 46 L21 41 L8 33 L20 28 L45 38 L43 25 Z')],
  raven: [fg('M16 58 L32 50 C34 38 46 30 58 32 L72 25 L67 36 C75 40 81 50 79 60 L92 76 L72 71 C64 77 50 79 40 73 L26 82 L31 68 Z'), bg(circle(60, 40, 3))],
  dragon: [fg('M16 82 C28 72 35 62 33 50 L20 41 L35 38 L39 24 L48 35 L60 16 L63 38 L80 28 L71 49 C78 58 82 69 77 79 C71 88 57 88 50 81 C59 81 66 75 64 66 C57 73 49 75 41 73 C34 79 26 84 16 82 Z'), bg(circle(37, 44, 2.5))],
  serpent: [line('M30 22 C64 8 82 36 50 50 C18 64 38 92 74 78', 11), fg(circle(28, 22, 9)), bg(circle(25, 20, 2.5))],
  fish: [fg('M10 50 C24 28 56 26 72 43 L90 28 L86 50 L90 72 L72 57 C56 74 24 72 10 50 Z'), bg(circle(26, 46, 3.5)), bg('M44 36 C50 44 50 56 44 64 L46 64 C53 56 53 44 46 36 Z')],
  tower: [fg('M28 92 L28 34 L24 34 L24 14 L33 14 L33 21 L42 21 L42 14 L58 14 L58 21 L67 21 L67 14 L76 14 L76 34 L72 34 L72 92 Z'), bg('M42 92 L42 74 C42 64 58 64 58 74 L58 92 Z'), bg('M46 40 h8 v12 h-8 Z')],
  gate: [fg('M12 90 L12 22 L88 22 L88 90 Z'), bg('M26 90 L26 54 C26 32 74 32 74 54 L74 90 Z'), fg('M36 44 h5 v46 h-5 Z'), fg('M47.5 38 h5 v52 h-5 Z'), fg('M59 44 h5 v46 h-5 Z'), fg('M26 60 h48 v5 h-48 Z'), fg('M26 76 h48 v5 h-48 Z')],
  crown: [fg('M16 74 L12 30 L32 50 L50 20 L68 50 L88 30 L84 74 Z'), fg('M16 78 h68 v10 h-68 Z'), bg(circle(50, 60, 5))],
  sword: [fg('M50 4 L56 14 L55 62 L45 62 L44 14 Z'), fg('M30 62 h40 v7 h-40 Z'), fg('M46 69 h8 v17 h-8 Z'), fg(circle(50, 90, 6))],
  axe: [fg('M46 10 h8 v82 h-8 Z'), fg('M54 18 C72 12 86 24 88 44 C78 41 66 44 54 48 Z'), fg('M46 22 L32 26 L32 42 L46 44 Z')],
  hammer: [fg('M22 14 h56 v24 h-56 Z'), fg('M45 38 h10 v54 h-10 Z')],
  bow: [line('M34 8 C76 28 76 72 34 92', 8), line('M34 8 L34 92', 2), line('M16 50 L80 50', 4), fg('M92 50 L78 42 L78 58 Z')],
  shield: [fg('M18 12 L82 12 L82 44 C82 70 66 84 50 94 C34 84 18 70 18 44 Z'), bg('M18 38 L50 60 L82 38 L82 48 L50 70 L18 48 Z')],
  sun: [fg(star(50, 50, 44, 26, 12)), bg(circle(50, 50, 20)), fg(circle(50, 50, 15))],
  moon: [fg('M72 10 A40 40 0 0 0 72 90 A46 46 0 0 1 72 10 Z')],
  star: [fg(star(50, 52, 44, 18, 5))],
  eye: [fg('M6 50 C28 18 72 18 94 50 C72 82 28 82 6 50 Z'), bg(circle(50, 50, 17)), fg(circle(50, 50, 9))],
  rose: [...[0, 1, 2, 3, 4].map((i) => fg(circle(+(50 + 17 * Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / 5)).toFixed(1), +(50 + 17 * Math.sin(-Math.PI / 2 + (i * 2 * Math.PI) / 5)).toFixed(1), 15))), bg(circle(50, 50, 9)), fg(circle(50, 50, 5))],
  tree: [fg('M44 58 h12 v34 h-12 Z'), fg(circle(50, 30, 22)), fg(circle(32, 48, 17)), fg(circle(68, 48, 17)), fg(circle(50, 52, 16))],
  // GUILD2c (bible/11-Multiplayer/Guild-Overhaul.md): the sixteen more - the port's own drawing, as the twenty-four are
  skull: [fg(circle(50, 42, 30)), fg('M32 58 h36 v20 a6 6 0 0 1 -6 6 h-24 a6 6 0 0 1 -6 -6 Z'), bg(circle(38, 44, 8)), bg(circle(62, 44, 8)),
    bg('M50 53 L44 64 H56 Z'), bg('M41 72 h4 v10 h-4 Z'), bg('M48 72 h4 v10 h-4 Z'), bg('M55 72 h4 v10 h-4 Z')],
  key: [fg(circle(50, 24, 17)), bg(circle(50, 24, 8)), fg('M46 39 h8 v53 h-8 Z'), fg('M54 72 h13 v7 h-13 Z'), fg('M54 84 h9 v7 h-9 Z')],
  anchor: [fg(circle(50, 13, 9)), bg(circle(50, 13, 4)), fg('M46 21 h8 v61 h-8 Z'), fg('M30 30 h40 v7 h-40 Z'),
    line('M18 60 C22 82 40 90 50 90 C60 90 78 82 82 60', 8), fg('M10 64 L22 52 L28 68 Z'), fg('M90 64 L78 52 L72 68 Z')],
  ship: [fg('M8 62 H92 L78 84 H22 Z'), fg('M48 10 h4 v52 h-4 Z'), fg('M54 16 C74 24 78 44 54 58 Z'), fg('M46 20 C30 28 28 44 46 56 Z'),
    fg('M52 10 L68 15 L52 20 Z'), bg('M28 70 h4 v4 h-4 Z'), bg('M44 70 h4 v4 h-4 Z'), bg('M60 70 h4 v4 h-4 Z')],
  horse: [fg('M28 92 L34 62 C28 54 26 42 32 32 L28 12 L40 22 C46 18 56 18 63 22 C73 28 81 42 86 57 L78 64 L67 57 C65 66 63 76 65 92 Z'),
    bg(circle(54, 34, 3)), bg('M34 34 C38 44 40 52 38 60 L36 60 C37 52 35 44 32 36 Z')],
  spider: [fg(circle(50, 58, 15)), fg(circle(50, 36, 9)),
    ...[[-1, 0], [1, 0]].flatMap(([s]) => [
      line(`M${50 + s * 10} 50 L${50 + s * 28} 38 L${50 + s * 38} 44`, 4), line(`M${50 + s * 11} 56 L${50 + s * 32} 54 L${50 + s * 42} 62`, 4),
      line(`M${50 + s * 11} 62 L${50 + s * 30} 70 L${50 + s * 38} 82`, 4), line(`M${50 + s * 9} 67 L${50 + s * 20} 84 L${50 + s * 22} 94`, 4),
    ]), bg(circle(46, 34, 2)), bg(circle(54, 34, 2))],
  hand: [fg('M30 54 C30 46 34 42 40 42 H64 C70 42 72 48 72 56 V72 C72 84 62 92 50 92 C38 92 30 84 30 72 Z'),
    ...[31, 41, 51, 61].map((x, i) => fg(`M${x} ${20 + (i === 0 || i === 3 ? 6 : 0)} a5 5 0 0 1 10 0 V48 H${x} Z`)),
    fg('M70 60 L84 46 a5 5 0 0 1 7 7 L76 72 Z')],
  flame: [fg('M50 6 C58 26 76 34 76 58 C76 78 64 92 50 92 C36 92 24 78 24 58 C24 44 34 36 36 22 C42 32 46 40 46 48 C52 40 56 26 50 6 Z'),
    bg('M50 90 C42 90 37 83 37 75 C37 65 45 61 48 50 C54 61 63 65 63 75 C63 83 58 90 50 90 Z')],
  scales: [fg(circle(50, 15, 5)), fg('M47 18 h6 v66 h-6 Z'), fg('M30 84 h40 v8 h-40 Z'), fg('M12 24 h76 v5 h-76 Z'),
    line('M20 29 L10 58', 2), line('M20 29 L30 58', 2), line('M80 29 L70 58', 2), line('M80 29 L90 58', 2),
    fg('M5 58 h30 a15 11 0 0 1 -30 0 Z'), fg('M65 58 h30 a15 11 0 0 1 -30 0 Z')],
  book: [fg('M6 24 C24 18 40 20 50 28 C60 20 76 18 94 24 V80 C76 74 60 76 50 84 C40 76 24 74 6 80 Z'), bg('M48 30 h4 v52 h-4 Z'),
    bg('M14 36 C24 33 34 34 42 38 v3 C34 37 24 36 14 39 Z'), bg('M14 48 C24 45 34 46 42 50 v3 C34 49 24 48 14 51 Z'),
    bg('M86 36 C76 33 66 34 58 38 v3 C66 37 76 36 86 39 Z'), bg('M86 48 C76 45 66 46 58 50 v3 C66 49 76 48 86 51 Z')],
  chalice: [fg('M22 12 H78 C78 40 66 54 55 56 V72 H68 V82 H32 V72 H45 V56 C34 54 22 40 22 12 Z'), bg('M30 18 C34 22 40 24 50 24 C60 24 66 22 70 18 Z'),
    fg('M28 86 h44 v6 h-44 Z'), bg(star(50, 38, 8, 3.5, 4))],
  dagger: [fg('M50 12 L61 28 L56 60 L44 60 L39 28 Z'), bg('M48.5 22 h3 v34 h-3 Z'), fg('M24 58 L76 58 L70 67 L30 67 Z'), fg('M45 67 h10 v18 h-10 Z'), fg(circle(50, 89, 6))],
  owl: [fg('M50 14 C70 14 82 30 82 54 C82 76 68 92 50 92 C32 92 18 76 18 54 C18 30 30 14 50 14 Z'), fg('M22 26 L28 6 L42 20 Z'), fg('M78 26 L72 6 L58 20 Z'),
    bg(circle(36, 42, 11)), bg(circle(64, 42, 11)), fg(circle(36, 42, 5)), fg(circle(64, 42, 5)), bg('M50 50 L44 58 L50 68 L56 58 Z'),
    bg('M34 74 C40 70 46 72 50 76 C54 72 60 70 66 74 C60 78 54 80 50 84 C46 80 40 78 34 74 Z')],
  bat: [fg('M50 32 L55 24 L58 38 C66 28 80 26 95 32 C87 39 85 47 87 56 C79 50 70 52 64 60 C60 54 56 56 50 68 C44 56 40 54 36 60 C30 52 21 50 13 56 C15 47 13 39 5 32 C20 26 34 28 42 38 L45 24 Z'),
    bg(circle(46, 40, 1.8)), bg(circle(54, 40, 1.8))],
  swords: [fg('M16 10 L26 8 L76 70 L69 77 Z'), fg('M84 10 L74 8 L24 70 L31 77 Z'), fg('M58 74 L76 58 L81 63 L63 79 Z'), fg('M42 74 L24 58 L19 63 L37 79 Z'),
    fg('M69 77 L75 71 L88 85 L82 91 Z'), fg('M31 77 L25 71 L12 85 L18 91 Z')],
  anvil: [fg('M8 28 H76 C82 28 92 32 94 40 H70 V50 C70 58 64 63 58 65 V74 H70 V86 H30 V74 H42 V65 C36 63 30 58 30 50 V40 H22 C15 40 10 35 8 28 Z')],
});

/**
 * GUILD2c: A DIVIDED FIELD'S SECOND PART, as path text over a `w` by `h` box (the banner's 100 x 300, the shield's 100 x
 * 104): the part `field2` fills, cut by the division's line - the second half of per pale (the sinister, right), per fess
 * (the base), per bend and per bend sinister (below the diagonal), per chevron (under the V); quarterly's second and
 * third quarters; per saltire's two flanks. Plain answers ''.
 */
export function divisionPath(division, w, h) {
  const m = w / 2, c = h / 2;
  switch (division) {
    case 'pale': return `M${m} 0 H${w} V${h} H${m} Z`;
    case 'fess': return `M0 ${c} H${w} V${h} H0 Z`;
    case 'bend': return `M0 0 L${w} ${h} L0 ${h} Z`;
    case 'bend-sinister': return `M${w} 0 L${w} ${h} L0 ${h} Z`;
    case 'quarterly': return `M${m} 0 H${w} V${c} H${m} Z M0 ${c} H${m} V${h} H0 Z`;
    case 'chevron': return `M0 ${h} L${m} ${(h * 0.38).toFixed(1)} L${w} ${h} Z`;
    case 'saltire': return `M0 0 L${m} ${c} L0 ${h} Z M${w} 0 L${m} ${c} L${w} ${h} Z`;
    default: return '';
  }
}
/** AUDIT2 GUILD2 G2: the FIRST colour's part of a divided field - the box less the division's part, as even-odd path text
 *  (the box, then the part's own subpaths: inside both is outside). A hole is painted once in each colour, each clipped
 *  to its own part - painted whole in the first and again in the second inside the part, its anti-aliased edge left a
 *  rim of the first colour around it there (a boar's eye, a key's bow). */
export const divisionComplement = (divD, w, h) => (divD ? `M0 0 H${w} V${h} H0 Z ${divD}` : '');
/** The box a division is laid over on the banner - the cloth's own, to the swallowtail's points. */
const BANNER_BOX = Object.freeze({ w: 100, h: 300 });
/** And on the shield. */
const SHIELD_BOX = Object.freeze({ w: 100, h: 104 });

/** The banner's cloth in a 100 x 300 box: the field, and its foot cut as a swallowtail. */
export const BANNER_CLOTH = 'M0 0 H100 V300 L50 262 L0 300 Z';
/** The border, drawn inside the cloth's edge (the same outline, stroked this wide, clipped to the cloth). */
export const BANNER_BORDER_W = 16;
/** Where the device stands on the cloth: its 100 box scaled to this and set at this corner. */
export const BANNER_DEVICE = Object.freeze({ x: 14, y: 84, scale: 0.72 });

/** AUDIT2 GUILD2 G2: a divided field's two clip paths - `${clip}d` the division's part, `${clip}c` the rest (even-odd). */
export const partClips = (clip, divD, box) => `<clipPath id="${clip}d"><path d="${divD}"/></clipPath>`
  + `<clipPath id="${clip}c"><path d="${divisionComplement(divD, box.w, box.h)}" clip-rule="evenodd"/></clipPath>`;
/** A device's parts as SVG, in `fgHex` and `bgHex`. */
function deviceSvg(device, fgHex, bgHex) {
  return (DEVICE_ART[device] ?? []).map((p) => partSvg(p, p.bg ? bgHex : fgHex)).join('');
}
/** One part of a device, in `hex`. */
const partSvg = (p, hex) => (p.w
  ? `<path d="${p.d}" fill="none" stroke="${hex}" stroke-width="${p.w}" stroke-linecap="round" stroke-linejoin="round"/>`
  : `<path d="${p.d}" fill="${hex}"/>`);
/**
 * THE DEVICE AT `transform`, its holes the field beneath. AUDIT GUILD2 G11: a hole was painted the FIRST field colour,
 * so on a divided field an owl's eyes, a key's bow and a skull's sockets lay in the wrong colour over the second part.
 * A divided field's hole (`div`: the division's clip-path id and its complement's, in the cloth's own space, and the
 * second colour) is painted the first colour inside the first part and the second inside the division's - in the parts'
 * own order, so a pupil drawn after its socket still lies on it. AUDIT2 GUILD2 G2: each colour clipped to its own part,
 * never one over the other (divisionComplement). Plain arms draw exactly as GUILD1d's (every cached picture unmoved).
 * SHIP-COLOURS: a ship's flag lays it too (ui/flagArt.js).
 */
export function deviceLayers(device, inkHex, fieldHex, transform, div = null) {
  if (!div) return `<g transform="${transform}">${deviceSvg(device, inkHex, fieldHex)}</g>`;
  const inPart = (id, p, hex) => `<g clip-path="url(#${id})"><g transform="${transform}">${partSvg(p, hex)}</g></g>`;
  return (DEVICE_ART[device] ?? []).map((p) => (p.bg
    ? `${inPart(div.comp, p, fieldHex)}${inPart(div.id, p, div.hex)}`
    : `<g transform="${transform}">${partSvg(p, inkHex)}</g>`)).join('');
}
/**
 * The device on a canvas `ctx` already in the cloth's own space - `at` where it stands, its holes the field beneath (G11,
 * as deviceLayers): a divided field's hole painted in each colour inside its own part (`div` the division's Path2D in
 * the cloth's space, `comp` its complement's - AUDIT2 GUILD2 G2: even-odd - and `f2` the second colour).
 */
export function drawDevice(ctx, P, device, inkHex, fieldHex, at, div = null, f2 = null, comp = null) {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.scale(at.scale, at.scale);
  const paint = (p, hex) => {
    const path = new P(p.d);
    if (p.w) { ctx.strokeStyle = hex; ctx.lineWidth = p.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(path); } else { ctx.fillStyle = hex; ctx.fill(path); }
  };
  /** `p` painted `hex` inside `part` (the cloth's space, `rule` its fill rule). */
  const inPart = (p, hex, part, rule) => {
    ctx.save();
    ctx.scale(1 / at.scale, 1 / at.scale);   // back to the cloth's space, where the division's line is
    ctx.translate(-at.x, -at.y);
    ctx.clip(part, rule);
    ctx.translate(at.x, at.y);
    ctx.scale(at.scale, at.scale);
    paint(p, hex);
    ctx.restore();
  };
  for (const p of DEVICE_ART[device] ?? []) {
    if (p.bg && div && f2 && comp) { inPart(p, fieldHex, comp, 'evenodd'); inPart(p, f2, div, 'nonzero'); } else paint(p, p.bg ? fieldHex : inkHex);
  }
  ctx.restore();
}

/**
 * SEAT1a (Seats-Arc 3.4: "An unheld seat's anchors carry the kingdom's plain banner (the crown's metal, no device)"): a
 * PLAIN banner - two colours of the palette and no device (net/townSeatLaw.js seatPlainBanner) - or null. A guild's
 * heraldry always carries a device (heraldryOf); only a seat's plain cloth has none.
 */
export function plainBannerOf(raw) {
  if (!raw || typeof raw !== 'object' || raw.device !== null) return null;
  return heraldryColourOf(raw.field) && heraldryColourOf(raw.border) ? { field: raw.field, border: raw.border, device: null } : null;
}
/** What a banner draws: a guild's heraldry, a seat's plain cloth, or null (the unheld's Ash). */
const drawnOf = (raw) => heraldryOf(raw) ?? plainBannerOf(raw);

/**
 * THE BANNER AS SVG - for the Guild tab: `heraldry` (heraldryLaw.js's shape; none draws the unheld's plain Ash cloth)
 * at `width` pixels wide, three times as tall. A string: the tab sets it as its picture's markup.
 */
export function bannerSvg(heraldry, { width = 60 } = {}) {
  const h = drawnOf(heraldry);
  const field = heraldryColourOf(h?.field ?? 'ash')?.hex ?? '#8a8a8a';
  const border = heraldryColourOf(h?.border ?? 'ash')?.hex ?? '#8a8a8a';
  const ink = heraldryColourOf(heraldryInk(h) ?? 'ash')?.hex ?? border;   // GUILD2c: the device's own colour, else the border's
  const d = BANNER_DEVICE;
  const clip = `hb${h ? (heraldryKey(h) || `${h.field}${h.border}${h.device}`).replace(/[^a-z0-9]/gi, '') : 'none'}`;
  const divD = h?.division ? divisionPath(h.division, BANNER_BOX.w, BANNER_BOX.h) : '';
  const parted = divD ? `<path d="${divD}" fill="${heraldryColourOf(h.field2)?.hex}" clip-path="url(#${clip})"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 300" width="${width}" height="${width * 3}" role="img" aria-label="banner">`
    + `<defs><clipPath id="${clip}"><path d="${BANNER_CLOTH}"/></clipPath>${divD ? partClips(clip, divD, BANNER_BOX) : ''}</defs>`
    + `<path d="${BANNER_CLOTH}" fill="${field}"/>` + parted
    + (h ? `<path d="${BANNER_CLOTH}" fill="none" stroke="${border}" stroke-width="${BANNER_BORDER_W * 2}" clip-path="url(#${clip})"/>`
      + deviceLayers(h.device, ink, field, `translate(${d.x} ${d.y}) scale(${d.scale})`, divD ? { id: `${clip}d`, comp: `${clip}c`, hex: heraldryColourOf(h.field2)?.hex } : null) : '')
    + '</svg>';
}

/**
 * THE BANNER ON A CANVAS - for the world's cloth (render/bannerPass.js): the same drawing into a 2D context `ctx` of
 * `w` by `3w` pixels, the swallowtail's cut left clear. Path2D reads the path text the SVG does.
 * @param {CanvasRenderingContext2D} ctx @param {any} heraldry @param {number} w
 */
export function drawBanner(ctx, heraldry, w) {
  const h = drawnOf(heraldry);
  const field = heraldryColourOf(h?.field ?? 'ash')?.hex ?? '#8a8a8a';
  const border = heraldryColourOf(h?.border ?? 'ash')?.hex ?? '#8a8a8a';
  const P = globalThis.Path2D;
  ctx.save();
  ctx.clearRect(0, 0, w, w * 3);
  ctx.scale(w / 100, w / 100);
  const cloth = new P(BANNER_CLOTH);
  ctx.fillStyle = field;
  ctx.fill(cloth);
  if (h) {
    const ink = heraldryColourOf(heraldryInk(h) ?? h.border)?.hex ?? border;   // GUILD2c: the device's own colour
    ctx.save();
    ctx.clip(cloth);
    const divD = h.division ? divisionPath(h.division, BANNER_BOX.w, BANNER_BOX.h) : '';
    const div = divD ? new P(divD) : null;
    const f2 = h.division ? heraldryColourOf(h.field2)?.hex ?? field : null;
    if (div) { ctx.fillStyle = f2; ctx.fill(div); }   // GUILD2c
    ctx.strokeStyle = border;
    ctx.lineWidth = BANNER_BORDER_W * 2;
    ctx.stroke(cloth);
    ctx.restore();
    // AUDIT GUILD2 G11: its holes the field beneath; AUDIT2 G2: each colour in its own part
    drawDevice(ctx, P, h.device, ink, field, BANNER_DEVICE, div, f2, divD ? new P(divisionComplement(divD, BANNER_BOX.w, BANNER_BOX.h)) : null);
  }
  ctx.restore();
}

/** Every device has its art (a pin holds it). */
export const DEVICES_DRAWN = HERALDRY_DEVICES.every((d) => Array.isArray(DEVICE_ART[d]) && DEVICE_ART[d].length > 0);

// ─── HERALDRY-SHOWN (2026-10-02, Mac: "lets finish the build work"): THE SWATCH ──────────────────────────────────────
// Seats-Arc 8.1's small faces - the guild tag's frame, the siege HUD, the Chronicle - draw the heraldry as a SHIELD, not a
// three-tall banner: the same field, border and device (deviceSvg, the banner's own parts) on a heater shield in a 100 x
// 104 box, so a row of text keeps its height. ui/heraldrySwatch.js is its one DOM door.

/** The shield in a 100 x 104 box. */
export const SHIELD_CLOTH = 'M8 4 H92 V46 C92 74 74 92 50 102 C26 92 8 74 8 46 Z';
/** The shield's border, drawn inside its edge as the banner's is. */
export const SHIELD_BORDER_W = 10;
/** Where the device stands on the shield. */
export const SHIELD_DEVICE = Object.freeze({ x: 22, y: 16, scale: 0.56 });

/** A GUILD'S HERALDRY AS A SHIELD, an SVG string at `size` pixels wide - or '' for none (a swatch is a guild's: a seat's
 *  plain cloth has no device to bear). */
export function shieldSvg(heraldry, { size = 16 } = {}) {
  const h = heraldryOf(heraldry);
  if (!h) return '';
  const field = heraldryColourOf(h.field)?.hex, border = heraldryColourOf(h.border)?.hex;
  const ink = heraldryColourOf(heraldryInk(h))?.hex ?? border;   // GUILD2c
  const d = SHIELD_DEVICE;
  const clip = `hs${heraldryKey(h).replace(/[^a-z0-9]/gi, '')}`;
  const divD = h.division ? divisionPath(h.division, SHIELD_BOX.w, SHIELD_BOX.h) : '';
  const parted = divD ? `<path d="${divD}" fill="${heraldryColourOf(h.field2)?.hex}" clip-path="url(#${clip})"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 104" width="${size}" height="${Math.round(size * 1.04)}" role="img" aria-label="heraldry">`
    + `<defs><clipPath id="${clip}"><path d="${SHIELD_CLOTH}"/></clipPath>${divD ? partClips(clip, divD, SHIELD_BOX) : ''}</defs>`
    + `<path d="${SHIELD_CLOTH}" fill="${field}"/>` + parted
    + `<path d="${SHIELD_CLOTH}" fill="none" stroke="${border}" stroke-width="${SHIELD_BORDER_W * 2}" clip-path="url(#${clip})"/>`
    + deviceLayers(h.device, ink, field, `translate(${d.x} ${d.y}) scale(${d.scale})`, divD ? { id: `${clip}d`, comp: `${clip}c`, hex: heraldryColourOf(h.field2)?.hex } : null)
    + `<path d="${SHIELD_CLOTH}" fill="none" stroke="#000" stroke-opacity="0.6" stroke-width="3"/>`
    + '</svg>';
}

/**
 * AUDIT HERALDRY H4: THE SHIELD ON A CANVAS - the Overworld's name face (ui/travel/travelViewHud.js badgeSprite) draws on a
 * canvas, not the DOM: shieldSvg's drawing into `ctx` at (`x`, `y`), `size` pixels wide - the field (GUILD2c: a divided
 * one's second part in `field2`), the border inside the edge, the device in its own colour (the border's unless `charge`
 * names one) on the field, its holes the field beneath in each part, the dark edge. Drawn once into a kept sprite, never
 * a frame (AUDIT2 GUILD2 G5: it said the border's colour alone, on a plain field).
 * Whether it drew one (none for no heraldry, or no Path2D).
 * @param {CanvasRenderingContext2D} ctx @param {any} heraldry @param {number} x @param {number} y @param {number} size
 */
export function drawShield(ctx, heraldry, x, y, size) {
  const h = heraldryOf(heraldry);
  const P = globalThis.Path2D;
  if (!h || typeof P !== 'function') return false;
  const field = heraldryColourOf(h.field)?.hex ?? '', border = heraldryColourOf(h.border)?.hex ?? '';
  const inkHex = heraldryColourOf(heraldryInk(h))?.hex ?? border;   // GUILD2c
  const shield = new P(SHIELD_CLOTH);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  ctx.fillStyle = field;
  ctx.fill(shield);
  ctx.save();
  ctx.clip(shield);
  const divD = h.division ? divisionPath(h.division, SHIELD_BOX.w, SHIELD_BOX.h) : '';
  const div = divD ? new P(divD) : null;
  const f2 = h.division ? heraldryColourOf(h.field2)?.hex ?? field : null;
  if (div) { ctx.fillStyle = f2; ctx.fill(div); }   // GUILD2c
  ctx.strokeStyle = border;
  ctx.lineWidth = SHIELD_BORDER_W * 2;
  ctx.stroke(shield);
  ctx.restore();
  // a hole in the field's colour (AUDIT GUILD2 G11: both of a divided one's, AUDIT2 G2: each in its own part), the device
  // in its own (the border's by default)
  drawDevice(ctx, P, h.device, inkHex, field, SHIELD_DEVICE, div, f2, divD ? new P(divisionComplement(divD, SHIELD_BOX.w, SHIELD_BOX.h)) : null);
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 3;
  ctx.stroke(shield);
  ctx.restore();
  return true;
}
