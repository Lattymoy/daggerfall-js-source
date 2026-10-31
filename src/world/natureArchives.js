// @ts-check
// AUDIT FB1031 Y6: ClimateTextureSet's nature archives' one home - a LEAF, so the decor law (net/decorLaw.js
// decorPieceOf: a tree or a plant never hangs), which the account service reads as the client does, names one without
// carrying the block flats' reader into the Worker. world/rmbFlats.js re-exports isNatureArchive.

export const NATURE_ARCHIVE_MIN = 500; // ClimateTextureSet.Nature_RainForest
export const NATURE_ARCHIVE_MAX = 511; // ClimateTextureSet.Nature_Mountains_Snow
/** TREES-SEATED: an archive in the nature range - AddExteriorBlockFlats' own test (RMBLayout.cs:421, master), which swaps such a
 *  sub-record flat to the climate's archive. A MISC flat in the range keeps the archive it names (AddMiscBlockFlats,
 *  :326-380, swaps nothing), so a block's tree can be a nature archive that is not the pixel's. */
export const isNatureArchive = (archive) => archive >= NATURE_ARCHIVE_MIN && archive <= NATURE_ARCHIVE_MAX;
