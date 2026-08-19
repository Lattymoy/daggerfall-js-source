// HARNESS: TextureReader.SetSpectral + its three constants, sliced VERBATIM from
// Assets/Scripts/Utility/TextureReader.cs. Pure byte remap, no Unity dependency.
using DaggerfallConnect;

public static class SpectralShim
{
    const int spectralEyesReserved = 14;
    const int spectralEyesPatched = 247;
    const int spectralGrayStart = 96;

        public static void SetSpectral(ref DFBitmap srcBitmap)
        {
            for (int i = 0; i < srcBitmap.Data.Length; i++)
            {
                byte index = srcBitmap.Data[i];

                // Index 14 is reserved for emissive eyes, patching this to 112 (white color index) for best interaction with shader
                // Other colours are reindexed to a grey gradiant area of palette so that bones are brighter than shroud
                if (index == spectralEyesReserved)
                    srcBitmap.Data[i] = spectralEyesPatched;
                else if (index > 0)
                    srcBitmap.Data[i] = (byte)(spectralGrayStart - index);
            }
        }
}
