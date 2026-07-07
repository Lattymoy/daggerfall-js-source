// Classic FNT font reader (UI arc, U2a). Verbatim port of DFU
// FntFile.cs (MIT, Daggerfall Workshop):
//   header { FixedWidth u16, FixedHeight u16 }
//   240 glyph table entries { dataOffset u16, glyphWidth u16 }
//   each glyph = 32 bytes at its offset: 16 rows x 2 bytes in a
//   16-bit bitfield - and the source reads the LEFT 8 pixels from
//   byte[y*2 + 1] and the RIGHT 8 from byte[y*2] (the halves are
//   SWAPPED relative to file order), each byte expanding MSB-first.
// Glyph 0 maps to ASCII 33 ('!'); codes below asciiStart advance as
// spaces (DaggerfallFont's rule). Classic glyph spacing is 1px.

export const FNT_GLYPH_COUNT = 240;
export const FNT_GLYPH_BYTES = 32;
export const FNT_GLYPH_DIM = 16;
export const FNT_ASCII_START = 33;   // DaggerfallFont defaultAsciiStart
export const FNT_GLYPH_SPACING = 1;  // classicGlyphSpacing

export class FntFile {
  load(bytes) {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.fixedWidth = v.getUint16(0, true);
    this.fixedHeight = v.getUint16(2, true);
    this.glyphs = [];
    let o = 4;
    for (let i = 0; i < FNT_GLYPH_COUNT; i++) {
      const dataOffset = v.getUint16(o, true);
      const width = v.getUint16(o + 2, true);
      o += 4;
      this.glyphs.push({ width, data: bytes.subarray(dataOffset, dataOffset + FNT_GLYPH_BYTES) });
    }
    return this;
  }

  /** 16x16 pixel indices for one glyph: colorIndex where the bit is
   *  set, 0 elsewhere - the verbatim L/R half swap + MSB-first walk. */
  getGlyphPixels(index, colorIndex = 127) {
    if (index < 0 || index >= FNT_GLYPH_COUNT) return null;
    const g = this.glyphs[index];
    const out = new Uint8Array(FNT_GLYPH_DIM * FNT_GLYPH_DIM);
    const expand = (byte, row, off) => {
      let bit = 1;
      for (let i = 7; i >= 0; i--) {
        if (byte & bit) out[row * FNT_GLYPH_DIM + off + i] = colorIndex;
        bit <<= 1;
      }
    };
    for (let y = 0; y < FNT_GLYPH_DIM; y++) {
      expand(g.data[y * 2 + 1], y, 0);   // LEFT half from the odd byte
      expand(g.data[y * 2], y, 8);       // RIGHT half from the even byte
    }
    return out;
  }

  glyphWidth(index) {
    return index >= 0 && index < FNT_GLYPH_COUNT ? this.glyphs[index].width : 0;
  }
}
