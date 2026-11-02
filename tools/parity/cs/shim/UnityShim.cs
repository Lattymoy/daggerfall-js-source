// Minimal Unity shim for running DaggerfallConnect readers under plain Mono.
// EXACT Unity semantics for the members the API readers actually touch.
using System;

namespace FullSerializer { }   // DFBlock has `using FullSerializer;` but no attributes.

namespace UnityEngine
{
    [Serializable]
    public struct Color32
    {
        public byte r, g, b, a;
        public Color32(byte r, byte g, byte b, byte a) { this.r = r; this.g = g; this.b = b; this.a = a; }
        public static implicit operator Color(Color32 c)
        {
            return new Color(c.r / 255f, c.g / 255f, c.b / 255f, c.a / 255f);
        }
        public static implicit operator Color32(Color c)
        {
            // Unity: Color32(byte)(Mathf.Clamp01(c.r) * 255) with rounding
            return new Color32(
                (byte)(Mathf.Clamp01(c.r) * 255f + 0.5f),
                (byte)(Mathf.Clamp01(c.g) * 255f + 0.5f),
                (byte)(Mathf.Clamp01(c.b) * 255f + 0.5f),
                (byte)(Mathf.Clamp01(c.a) * 255f + 0.5f));
        }
        public static Color32 Lerp(Color32 a, Color32 b, float t)
        {
            t = Mathf.Clamp01(t);
            return new Color32(
                (byte)(a.r + (b.r - a.r) * t),
                (byte)(a.g + (b.g - a.g) * t),
                (byte)(a.b + (b.b - a.b) * t),
                (byte)(a.a + (b.a - a.a) * t));
        }
        public override string ToString() { return string.Format("RGBA({0}, {1}, {2}, {3})", r, g, b, a); }
    }

    [Serializable]
    public struct Color
    {
        public float r, g, b, a;
        public Color(float r, float g, float b, float a) { this.r = r; this.g = g; this.b = b; this.a = a; }
        public Color(float r, float g, float b) { this.r = r; this.g = g; this.b = b; this.a = 1f; }
        public static Color clear { get { return new Color(0f, 0f, 0f, 0f); } }
        public static Color black { get { return new Color(0f, 0f, 0f, 1f); } }
        public static Color white { get { return new Color(1f, 1f, 1f, 1f); } }
        public static Color red   { get { return new Color(1f, 0f, 0f, 1f); } }
        public static Color Lerp(Color a, Color b, float t)
        {
            t = Mathf.Clamp01(t);
            return new Color(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t, a.a + (b.a - a.a) * t);
        }
        public static Color operator *(Color a, float d) { return new Color(a.r * d, a.g * d, a.b * d, a.a * d); }
        public static Color operator +(Color a, Color b) { return new Color(a.r + b.r, a.g + b.g, a.b + b.b, a.a + b.a); }
        // Exact port of UnityEngine.Color.RGBToHSV
        public static void RGBToHSV(Color rgbColor, out float H, out float S, out float V)
        {
            if (rgbColor.b > rgbColor.g && rgbColor.b > rgbColor.r)
                RGBToHSVHelper(4f, rgbColor.b, rgbColor.r, rgbColor.g, out H, out S, out V);
            else if (rgbColor.g > rgbColor.r)
                RGBToHSVHelper(2f, rgbColor.g, rgbColor.b, rgbColor.r, out H, out S, out V);
            else
                RGBToHSVHelper(0f, rgbColor.r, rgbColor.g, rgbColor.b, out H, out S, out V);
        }
        private static void RGBToHSVHelper(float offset, float dominantcolor, float colorone, float colortwo, out float H, out float S, out float V)
        {
            V = dominantcolor;
            if (V != 0f)
            {
                float num = colorone <= colortwo ? colorone : colortwo;
                float num2 = V - num;
                if (num2 != 0f) { S = num2 / V; H = offset + (colorone - colortwo) / num2; }
                else { S = 0f; H = offset + (colorone - colortwo); }
                H /= 6f;
                if (H < 0f) H += 1f;
            }
            else { S = 0f; H = 0f; }
        }
    }

    public static class Mathf
    {
        public const float PI = 3.14159274f;
        public static float Pow(float f, float p) { return (float)Math.Pow(f, p); }
        public static float Sqrt(float f) { return (float)Math.Sqrt(f); }
        public static float Abs(float f) { return Math.Abs(f); }
        public static float Clamp01(float value) { return value < 0f ? 0f : (value > 1f ? 1f : value); }
        public static float Clamp(float value, float min, float max) { return value < min ? min : (value > max ? max : value); }
        public static int Clamp(int value, int min, int max) { return value < min ? min : (value > max ? max : value); }
        public static float Min(float a, float b) { return a < b ? a : b; }
        public static float Max(float a, float b) { return a > b ? a : b; }
        public static float Floor(float f) { return (float)Math.Floor(f); }
        public static float Ceil(float f) { return (float)Math.Ceiling(f); }
        public static int FloorToInt(float f) { return (int)Math.Floor(f); }
        public static int CeilToInt(float f) { return (int)Math.Ceiling(f); }
        // Unity rounds half-to-even (banker's rounding).
        public static int RoundToInt(float f) { return (int)Math.Round((double)f, MidpointRounding.ToEven); }
        public static float Round(float f) { return (float)Math.Round((double)f, MidpointRounding.ToEven); }
        public static float Lerp(float a, float b, float t) { return a + (b - a) * Clamp01(t); }
    }

    public static class Debug
    {
        public static void Log(object m) { Console.Error.WriteLine("[Log] " + m); }
        public static void LogError(object m) { Console.Error.WriteLine("[Err] " + m); }
        public static void LogWarning(object m) { Console.Error.WriteLine("[Warn] " + m); }
        public static void LogFormat(string fmt, params object[] a) { Console.Error.WriteLine("[Log] " + string.Format(fmt, a)); }
        public static void LogErrorFormat(string fmt, params object[] a) { Console.Error.WriteLine("[Err] " + string.Format(fmt, a)); }
        public static void LogWarningFormat(string fmt, params object[] a) { Console.Error.WriteLine("[Warn] " + string.Format(fmt, a)); }
    }

    public class TextAsset { public byte[] bytes; public string text; }

    public static class Resources
    {
        // No Unity Resources folder exists outside the editor build for arena2 files;
        // real DFU also returns null here for BSA/arena2 paths.
        public static T Load<T>(string path) where T : class { return null; }
    }

    public static class Application
    {
        public static string streamingAssetsPath { get { return "/nonexistent/StreamingAssets"; } }
        public static string dataPath { get { return "/nonexistent"; } }
        public static string persistentDataPath { get { return "/nonexistent"; } }
    }
}

namespace FullSerializer
{
    // Attribute only; carries no read-path behaviour.
    [System.AttributeUsage(System.AttributeTargets.All, AllowMultiple = true)]
    public class fsObjectAttribute : System.Attribute
    {
        public fsObjectAttribute() { }
        public fsObjectAttribute(string versionString, params System.Type[] previousModels) { }
        public System.Type Converter { get; set; }
        public System.Type Processor { get; set; }
        public string VersionString { get; set; }
        public System.Type[] PreviousModels { get; set; }
        public fsObjectAttribute(System.Type processor) { }
    }
}
