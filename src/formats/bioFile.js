// BIO.DAT reader (SAV1). 1:1 translation of DFU API/BioFile.cs (MIT,
// Daggerfall Workshop) - the classic save's player biography text.
// The file is NUL-delimited text; Load splits on '\0' and keeps EVERY
// piece, including the empty string a trailing NUL produces - verbatim
// (String.Split does not drop empties).

export class BioFile {
  constructor() {
    /** @type {string[]} */
    this.lines = [];
  }

  /** @param {Uint8Array|ArrayBuffer} buffer - full BIO.DAT contents. */
  load(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let text = '';
    for (let i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
    this.lines = text.split('\0');
    return true;
  }
}
