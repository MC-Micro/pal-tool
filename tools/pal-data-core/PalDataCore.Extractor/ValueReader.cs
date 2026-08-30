using CUE4Parse.UE4.Assets.Objects;
using CUE4Parse.UE4.Objects.Core.i18N;
using CUE4Parse.UE4.Objects.UObject;

namespace PalDataCore.Extractor;

internal sealed class ValueReader(FStructFallback row)
{
    private readonly Dictionary<string, FPropertyTag> _properties = row.Properties
        .GroupBy(property => property.Name.Text, StringComparer.OrdinalIgnoreCase)
        .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);

    private FPropertyTag? Find(params string[] names)
    {
        foreach (var name in names)
            if (_properties.TryGetValue(name, out var property)) return property;
        return null;
    }

    public static string PropertyType(FPropertyTag property) =>
        property.TagData?.Type ?? "Unknown";

    public string String(string fallback, params string[] names)
    {
        var property = Find(names);
        var tag = property?.Tag;
        if (tag is null) return fallback;

        try
        {
            return PropertyType(property!) switch
            {
                "NameProperty" or "EnumProperty" => tag.GetValue<FName>().Text,
                "TextProperty" => tag.GetValue<FText>().Text,
                _ => tag.GetValue<string>() ?? fallback,
            };
        }
        catch
        {
            try { return Convert.ToString(tag.GetValue<object>()) ?? fallback; }
            catch { return fallback; }
        }
    }

    public int Int(int fallback, params string[] names)
    {
        var property = Find(names);
        var tag = property?.Tag;
        if (tag is null) return fallback;

        foreach (var type in new[] { typeof(int), typeof(short), typeof(byte), typeof(long), typeof(float), typeof(double) })
        {
            try { return Convert.ToInt32(tag.GetValue(type)); }
            catch { }
        }

        return fallback;
    }

    public double Number(double fallback, params string[] names)
    {
        var property = Find(names);
        var tag = property?.Tag;
        if (tag is null) return fallback;

        foreach (var type in new[] { typeof(double), typeof(float), typeof(int), typeof(long), typeof(short), typeof(byte) })
        {
            try { return Convert.ToDouble(tag.GetValue(type)); }
            catch { }
        }

        return fallback;
    }

    public bool Bool(bool fallback, params string[] names)
    {
        var property = Find(names);
        var tag = property?.Tag;
        if (tag is null) return fallback;
        try { return tag.GetValue<bool>(); }
        catch { return fallback; }
    }
}
