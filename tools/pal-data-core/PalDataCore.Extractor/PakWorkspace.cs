using CUE4Parse.Compression;
using CUE4Parse.FileProvider;
using CUE4Parse.MappingsProvider.Usmap;
using CUE4Parse.UE4.Assets.Exports.Engine;
using CUE4Parse.UE4.Versions;
using Serilog;

namespace PalDataCore.Extractor;

internal sealed class PakWorkspace : IDisposable
{
    private readonly DefaultFileProvider _provider;
    private readonly Dictionary<string, UDataTable?> _cache = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, string> _errors = new(StringComparer.OrdinalIgnoreCase);

    public PakWorkspace(string pakDirectory, string? mappingsPath)
    {
        Log.Logger = new LoggerConfiguration()
            .MinimumLevel.Warning()
            .WriteTo.Console()
            .CreateLogger();

        OodleHelper.Initialize();
        _provider = new DefaultFileProvider(
            pakDirectory,
            SearchOption.AllDirectories,
            new VersionContainer(EGame.GAME_UE5_1),
            StringComparer.OrdinalIgnoreCase);

        if (!string.IsNullOrWhiteSpace(mappingsPath))
            _provider.MappingsContainer = new FileUsmapTypeMappingsProvider(mappingsPath);

        _provider.Initialize();
        _provider.Mount();
        _provider.LoadVirtualPaths();
    }

    public long PakBytes => _provider.Files
        .Select(entry => entry.Value)
        .Where(file => file.Path.EndsWith(".pak", StringComparison.OrdinalIgnoreCase))
        .Sum(_ => 0L);

    public bool PackageExists(string packagePath)
    {
        var needle = $"{packagePath}.uasset";
        return _provider.Files.Keys.Any(path => path.Equals(needle, StringComparison.OrdinalIgnoreCase));
    }

    public UDataTable? Load(string packagePath)
    {
        if (_cache.TryGetValue(packagePath, out var cached)) return cached;

        if (!PackageExists(packagePath))
        {
            _cache[packagePath] = null;
            return null;
        }

        try
        {
            var table = _provider.LoadPackageObject<UDataTable>(packagePath);
            _cache[packagePath] = table;
            return table;
        }
        catch (Exception exception)
        {
            _errors[packagePath] = $"{exception.GetType().Name}: {exception.Message}";
            _cache[packagePath] = null;
            return null;
        }
    }

    public TableProbe Probe(TableSpec spec)
    {
        foreach (var packagePath in spec.PackagePaths)
        {
            if (!PackageExists(packagePath)) continue;

            var table = Load(packagePath);
            if (table is null)
                return new TableProbe(
                    spec.Name,
                    spec.Required,
                    packagePath,
                    true,
                    false,
                    0,
                    [],
                    _errors.GetValueOrDefault(packagePath, "Unable to deserialize table"));

            var fields = table.RowMap.Values
                .Take(10)
                .SelectMany(row => row.Properties.Select(property => property.Name.Text))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Order(StringComparer.OrdinalIgnoreCase)
                .ToArray();

            return new TableProbe(
                spec.Name,
                spec.Required,
                packagePath,
                true,
                true,
                table.RowMap.Count,
                fields,
                null);
        }

        return new TableProbe(spec.Name, spec.Required, null, false, false, 0, [], "Package not present");
    }

    public void Dispose()
    {
        _provider.Dispose();
        Log.CloseAndFlush();
    }
}
