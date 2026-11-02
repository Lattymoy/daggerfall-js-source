// DAGGER.SND reader: enumerates and extracts sound data.
// 1:1 translation of Daggerfall Unity's SndFile.cs (MIT, Daggerfall Workshop /
// Gavin Clayton). Each BSA record is raw unsigned 8-bit mono PCM at 11025 Hz;
// a 44-byte RIFF/WAVE header is synthesized so records play as standard WAVs.

import { BsaFile, DIRECTORY_TYPES } from './bsaFile.js';

export const SAMPLE_RATE = 11025;

export class SndFile {
  constructor() {
    this._bsa = null;
    this._sounds = null;
  }

  static get filename() {
    return 'DAGGER.SND';
  }

  /** Number of BSA records in DAGGER.SND. */
  get count() {
    return this._bsa ? this._bsa.count : 0;
  }

  /** Underlying BSA file for sound effects. */
  get bsaFile() {
    return this._bsa;
  }

  /**
   * Load DAGGER.SND contents.
   * @param {Uint8Array} bytes
   * @returns {boolean} true if successful.
   */
  load(bytes) {
    this._bsa = new BsaFile(bytes);
    if (this._bsa.directoryType !== DIRECTORY_TYPES.NumberRecord) return false;
    this._sounds = new Array(this._bsa.count).fill(null);
    return true;
  }

  /** Index of sound record with specified id, or -1 (linear search, as DFU). */
  getRecordIndex(id) {
    for (let i = 0; i < this.count; i++) {
      if (this._bsa.getRecordId(i) === id) return i;
    }
    return -1;
  }

  /** True if index is within a valid range. */
  isValidIndex(sound) {
    return sound >= 0 && sound < this.count;
  }

  /**
   * Sound from index: {name, waveHeader: Uint8Array(44), waveData: Uint8Array},
   * cached after first read. Returns null on invalid index.
   */
  getSound(sound) {
    if (!this.isValidIndex(sound)) return null;
    if (this._sounds[sound] !== null) return this._sounds[sound];

    const waveData = this._bsa.getRecordBytes(sound);
    const dfSound = {
      name: this._bsa.getRecordName(sound),
      waveHeader: this._createPcmHeader(waveData.length),
      waveData,
    };
    this._sounds[sound] = dfSound;
    return dfSound;
  }

  /** Entire WAV file (header + data) as one buffer, or null. */
  getStream(sound) {
    const dfSound = this.getSound(sound);
    if (!dfSound) return null;
    const data = new Uint8Array(dfSound.waveHeader.length + dfSound.waveData.length);
    data.set(dfSound.waveHeader, 0);
    data.set(dfSound.waveData, dfSound.waveHeader.length);
    return data;
  }

  /** Discard a sound from memory. */
  discardSound(sound) {
    if (sound < 0 || sound >= this.count) return;
    this._sounds[sound] = null;
  }

  /**
   * Creates a PCM header for the sound, including the data prefix preceding
   * raw sound bytes. Verbatim CreatePcmHeader: RIFF, fileLength = data + 36,
   * WAVE, fmt (PCM, 1 channel, 11025 Hz, 8-bit), data.
   */
  _createPcmHeader(dataLength) {
    const header = new Uint8Array(44);
    const v = new DataView(header.buffer);
    const writeTag = (offset, tag) => {
      for (let i = 0; i < 4; i++) header[offset + i] = tag.charCodeAt(i);
    };

    writeTag(0, 'RIFF');
    v.setInt32(4, dataLength + 36, true);
    writeTag(8, 'WAVE');
    writeTag(12, 'fmt ');
    v.setInt32(16, 16, true); // fmt length
    v.setInt16(20, 1, true); // format: PCM
    v.setInt16(22, 1, true); // channels
    v.setInt32(24, SAMPLE_RATE, true); // sample rate
    v.setInt32(28, SAMPLE_RATE, true); // avg bytes/sec
    v.setInt16(32, 1, true); // block align
    v.setInt16(34, 8, true); // bits per sample
    writeTag(36, 'data');
    v.setInt32(40, dataLength, true);

    return header;
  }
}
