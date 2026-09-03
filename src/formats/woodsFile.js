// Reads data from WOODS.WLD: the 1000x500 world heightmap plus per-pixel
// 5x5 large map data.
// 1:1 translation of Daggerfall Unity's WoodsFile.cs (MIT, Daggerfall
// Workshop). Verbatim:
//   - Header: 8 uint32 fields then 28 null uint32s; Width * Height must
//     equal 1000 * 500 or the load fails.
//   - 500000 uint32 data offsets follow the header, one per map pixel.
//   - The small heightmap is a raw 1000 * 500 byte buffer at
//     HeightMapOffset, row-major, one byte per world map pixel.
//   - GetHeightMapValue clamps BOTH axes with `>= dim - 1 -> dim - 1`
//     (DFU's exact form; the last row/column is reachable, everything past
//     clamps to it).
//   - Large map data is a 5x5 byte grid at dataOffset + 22 for each pixel.
//   - GetLargeHeightMapValuesRange strips the 5x5 down to the interior
//     3x3, inverts the sample Y order (srcData[ix][4 - iy]) AND walks
//     source pixels with a DESCENDING map Y (mapPixelY - y), verbatim.
// DFU's disk-usage FileProxy modes are not ported (read-only byte-buffer
// runtime, as bsaFile.js). The writeable `Buffer` setter has exactly one
// runtime caller - TerrainHelper.SmoothLocationNeighbourhood - and AUDIT
// 54 F4 ports that, so `heightMapBuffer` IS written in place at startup;
// syncHeightMapBytes below carries the result into the raw file bytes the
// EV7 terrain worker builds its own reader from (DFU has no second copy
// and so needs no equivalent).

export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 500;
const MAP_BUFFER_LENGTH = MAP_WIDTH * MAP_HEIGHT;

export class WoodsFile {
  constructor() {
    this.loaded = false;
    this.header = null;
    this.dataOffsets = null;
    this.heightMapBuffer = null;
    this._bytes = null;
    this._view = null;
  }

  /**
   * Load WOODS.WLD from bytes.
   * @param {Uint8Array} bytes
   * @returns {boolean} true if successful.
   */
  load(bytes) {
    try {
      this._bytes = bytes;
      this._view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      this._readHeader();
      this._readDataOffsets();
      // DataSection1 unused, exactly as DFU skips it.
      this._readHeightMap();
      this.loaded = true;
      return true;
    } catch {
      this.loaded = false;
      return false;
    }
  }

  _readHeader() {
    const v = this._view;
    this.header = {
      offsetSize: v.getUint32(0, true),
      width: v.getUint32(4, true),
      height: v.getUint32(8, true),
      nullValue1: v.getUint32(12, true),
      dataSection1Offset: v.getUint32(16, true),
      unknown1: v.getUint32(20, true),
      unknown2: v.getUint32(24, true),
      heightMapOffset: v.getUint32(28, true),
      // 28 null uint32s follow; offsets start at 32 + 112 = 144.
    };
  }

  _readDataOffsets() {
    if (this.header.width * this.header.height !== MAP_BUFFER_LENGTH) {
      throw new Error('Invalid WOODS.WLD Width*Height result from Header.');
    }
    const v = this._view;
    const offsets = new Uint32Array(MAP_BUFFER_LENGTH);
    let pos = 32 + 28 * 4;
    for (let i = 0; i < MAP_BUFFER_LENGTH; i++, pos += 4) {
      offsets[i] = v.getUint32(pos, true);
    }
    this.dataOffsets = offsets;
  }

  _readHeightMap() {
    const start = this.header.heightMapOffset;
    this.heightMapBuffer = this._bytes.slice(start, start + MAP_BUFFER_LENGTH);
  }

  /** AUDIT 54 F4: write heightMapBuffer back over the raw WOODS.WLD
   *  bytes. _readHeightMap takes a COPY, and the EV7 worker builds its
   *  own WoodsFile from those bytes, so a startup repair of the live
   *  buffer (SmoothLocationNeighbourhood) has to land here too or the
   *  two kernels sample different heights.
   *  @returns {boolean} false if nothing is loaded to write back. */
  syncHeightMapBytes() {
    if (!this.loaded || !this._bytes || !this.heightMapBuffer) return false;
    this._bytes.set(this.heightMapBuffer, this.header.heightMapOffset);
    return true;
  }

  /**
   * Heightmap value at a map pixel, verbatim clamped.
   * @param {number} mapPixelX - 0 to MAP_WIDTH - 1.
   * @param {number} mapPixelY - 0 to MAP_HEIGHT - 1.
   * @returns {number} byte height.
   */
  getHeightMapValue(mapPixelX, mapPixelY) {
    if (mapPixelX < 0) mapPixelX = 0;
    if (mapPixelX >= MAP_WIDTH - 1) mapPixelX = MAP_WIDTH - 1;
    if (mapPixelY < 0) mapPixelY = 0;
    if (mapPixelY >= MAP_HEIGHT - 1) mapPixelY = MAP_HEIGHT - 1;
    return this.heightMapBuffer[mapPixelY * MAP_WIDTH + mapPixelX];
  }

  /**
   * Range of small height map data as a flat dim*dim array
   * (GetHeightMapValuesRange1Dim).
   */
  getHeightMapValuesRange1Dim(mapPixelX, mapPixelY, dim) {
    const dst = new Uint8Array(dim * dim);
    for (let y = 0; y < dim; y++) {
      for (let x = 0; x < dim; x++) {
        dst[x + y * dim] = this.getHeightMapValue(mapPixelX + x, mapPixelY + y);
      }
    }
    return dst;
  }

  /**
   * 5x5 large map data for a map pixel, read exactly as found in the file.
   * Returned as data[x][y].
   */
  getLargeMapData(mapPixelX, mapPixelY) {
    if (mapPixelX < 0) mapPixelX = 0;
    if (mapPixelX >= MAP_WIDTH - 1) mapPixelX = MAP_WIDTH - 1;
    if (mapPixelY < 0) mapPixelY = 0;
    if (mapPixelY >= MAP_HEIGHT - 1) mapPixelY = MAP_HEIGHT - 1;
    const pos = this.dataOffsets[mapPixelY * MAP_WIDTH + mapPixelX] + 22;
    const data = [];
    for (let x = 0; x < 5; x++) data.push(new Uint8Array(5));
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        data[x][y] = this._bytes[pos + y * 5 + x];
      }
    }
    return data;
  }

  /**
   * Large height map range with the unknown border stripped, Y order of
   * samples inverted, source map Y descending. Returned flat, row-major
   * over a (dim*3) x (dim*3) grid: value at (x, y) = out[y * dim*3 + x].
   */
  getLargeHeightMapValuesRange(mapPixelX, mapPixelY, dim) {
    const offsetx = 1;
    const offsety = 1;
    const len = 3;
    const side = dim * len;
    const dst = new Uint8Array(side * side);
    for (let y = 0; y < dim; y++) {
      for (let x = 0; x < dim; x++) {
        const src = this.getLargeMapData(mapPixelX + x, mapPixelY - y);
        const startX = x * len;
        const startY = y * len;
        for (let iy = offsety; iy < offsety + len; iy++) {
          for (let ix = offsetx; ix < offsetx + len; ix++) {
            dst[(startY + iy - offsety) * side + (startX + ix - offsetx)] = src[ix][4 - iy];
          }
        }
      }
    }
    return dst;
  }
}
