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
    private readonly string _pakDirectory;
    private readonly Dictionary<string, UDataTable?> _cache = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, string> _errors = new(StringComparer.OrdinalIgnoreCase);

    public PakWorkspace(string pakDirectory, string? mappingsPath)
    {
        _pakDirectory = pakDirectory;

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

    public long PakBytes => Directory
        .EnumerateFiles(_pakDirectory, "*.pak", SearchOption.AllDirectories)
        .Sum(path => new FileInfo(path).Length);

    public IReadOnlyList<string> FindPackages(string token, int limit = int.MaxValue) => _provider.Files
        .Select(file => file.Key)
        .Where(path => path.EndsWith(".uasset", StringComparison.OrdinalIgnoreCase))
        .Where(path => path.Contains(token, StringComparison.OrdinalIgnoreCase))
        .Order(StringComparer.OrdinalIgnoreCase)
        .Take(limit)
        .Select(path => path[..^".uasset".Length])
        .ToArray();

    public bool PackageExists(string packagePath)
    {
        var needle = $"{packagePath}.uasset";
        return _provider.Files.Any(file => file.Key.Equals(needle, StringComparison.OrdinalIgnoreCase));
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

    public IReadOnlyList<(string PackagePath, UDataTable Table)> LoadAll(TableSpec spec)
    {
        var result = new List<(string PackagePath, UDataTable Table)>();
        foreach (var packagePath in spec.PackagePaths)
        {
            var table = Load(packagePath);
            if (table is not null) result.Add((packagePath, table));
        }
        return result;
    }

    public TableProbe Probe(TableSpec spec)
    {
        var sources = new List<TableSourceProbe>();
        foreach (var packagePath in spec.PackagePaths)
        {
            if (!PackageExists(packagePath))
            {
                sources.Add(new TableSourceProbe(packagePath, false, false, 0, [], "Package not present"));
                continue;
            }

            var table = Load(packagePath);
            if (table is null)
            {
                sources.Add(new TableSourceProbe(
                    packagePath,
                    true,
                    false,
                    0,
                    [],
                    _errors.GetValueOrDefault(packagePath, "Unable to deserialize table")));
                continue;
            }

            sources.Add(new TableSourceProbe(
                packagePath,
                true,
                true,
                table.RowMap.Count,
                InventoryFields(table),
                null));
        }

        var parsedSources = sources.Where(source => source.Parsed).ToArray();
        return new TableProbe(
            spec.Name,
            spec.Domain,
            spec.Extractor,
            spec.Required,
            sources.Any(source => source.Present),
            parsedSources.Length > 0,
            parsedSources.Length,
            parsedSources.Sum(source => source.RowCount),
            MergeFields(parsedSources.SelectMany(source => source.Fields)),
            sources);
    }

    private static IReadOnlyList<FieldInventory> InventoryFields(UDataTable table) => table.RowMap.Values
        .SelectMany(row => row.Properties
            .GroupBy(property => property.Name.Text, StringComparer.OrdinalIgnoreCase)
            .Select(group => new
            {
                Name = group.Key,
                Types = group.Select(ValueReader.PropertyType).Distinct(StringComparer.Ordinal).ToArray(),
            }))
        .GroupBy(field => field.Name, StringComparer.OrdinalIgnoreCase)
        .Select(group => new FieldInventory(
            group.Key,
            group.Count(),
            group.SelectMany(field => field.Types)
                .Distinct(StringComparer.Ordinal)
                .Order(StringComparer.Ordinal)
                .ToArray()))
        .OrderBy(field => field.Name, StringComparer.OrdinalIgnoreCase)
        .ToArray();

    private static IReadOnlyList<FieldInventory> MergeFields(IEnumerable<FieldInventory> fields) => fields
        .GroupBy(field => field.Name, StringComparer.OrdinalIgnoreCase)
        .Select(group => new FieldInventory(
            group.Key,
            group.Sum(field => field.RowsPresent),
            group.SelectMany(field => field.PropertyTypes)
                .Distinct(StringComparer.Ordinal)
                .Order(StringComparer.Ordinal)
                .ToArray()))
        .OrderBy(field => field.Name, StringComparer.OrdinalIgnoreCase)
        .ToArray();

    public void Dispose()
    {
        _provider.Dispose();
        Log.CloseAndFlush();
    }
}
