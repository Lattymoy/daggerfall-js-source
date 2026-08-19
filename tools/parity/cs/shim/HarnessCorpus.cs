// Harness-only observer. Writes the exact DFPurePoint inputs FaceUVTool receives.
using System;
using System.IO;
using System.Text;
using DaggerfallConnect.Utility;

internal static class HarnessCorpus
{
    public static TextWriter FaceUVWriter = null;
    public static TextWriter FaceUVIndexWriter = null;
    public static int CurrentRecord = -1;
    static int caseIndex = 0;
    internal static void CaptureFaceUV(ref FaceUVTool.DFPurePoint[] pts)
    {
        if (FaceUVWriter == null) return;
        StringBuilder sb = new StringBuilder();
        sb.Append(pts.Length);
        for (int i = 0; i < pts.Length; i++)
        {
            sb.Append(' ').Append(pts[i].x).Append(' ').Append(pts[i].y).Append(' ').Append(pts[i].z);
            sb.Append(' ').Append(pts[i].nx).Append(' ').Append(pts[i].ny).Append(' ').Append(pts[i].nz);
            sb.Append(' ').Append(pts[i].u).Append(' ').Append(pts[i].v);
        }
        if (FaceUVIndexWriter != null) FaceUVIndexWriter.Write(caseIndex + "\t" + CurrentRecord + "\n");
        caseIndex++;
        FaceUVWriter.Write(sb.ToString());
        FaceUVWriter.Write('\n');
    }
}
