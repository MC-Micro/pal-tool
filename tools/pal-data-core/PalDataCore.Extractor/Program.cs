using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace PalDataCore.Extractor;

internal static class Program
{
    private static readonly JsonSerializerOptions PrettyJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private static readonly JsonSerializerOptions CompactJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public static int Main(string[] args)
    {
        try
        {
            if (args.Length == 0 || args[0] is "-h" or "--help")
            {
                PrintUsage();
                return 0;
            }

            var command = args[0].ToLowerInvariant();
            var options = ParseOptions(args[1..]);
            return command switch
            {
                "validate-catalog" => RunValidateCatalog(options),
                "probe" => RunProbe(options),
                "inventory" => RunInventory(options),
                "snapshot" => RunSnapshot(options),
                _ => throw new ArgumentException($"Unknown command '{args[0]}'."),
            };
        }
        catch (Exception exception)
        {
            Console.Error.WriteLine($"{exception.GetType().Name}: {exception.Message}");
            return 1;
        }
    }

    private static int RunValidateCatalog(IReadOnlyDictionary<string, string> options)
    {
        var catalog = TableCatalog.Load(Required(options, "catalog"));
        Console.WriteLine($"Catalog schema={catalog.SchemaVersion} tables={catalog.Tables.Count} discoveries={catalog.Discoveries.Count}");
        return 0;
    }

    private static int RunProbe(IReadOnlyDictionary<string, string> options)
    {
        var pakDirectory = Required(options, "pak-dir");
        var output = Required(options, "output");
        var buildId = Required(options, "build-id");
        var catalog = TableCatalog.Load(Required(options, "catalog"));
        var mappings = options.GetValueOrDefault("mappings");

        var startedAt = DateTimeOffset.UtcNow;
        using var workspace = new PakWorkspace(pakDirectory, mappings);
        var tables = catalog.Tables.Select(workspace.Probe).ToArray();
        var requiredPassed = tables
            .Where(table => table.Required)
            .All(table => table.Present && table.Parsed && table.RowCount > 0);

        var discoveries = catalog.Discoveries.ToDictionary(
            discovery => discovery.Name,
            discovery => workspace.FindPackages(discovery.Token),
            StringComparer.OrdinalIgnoreCase);

        var notes = new List<string>();
        if (string.IsNullOrWhiteSpace(mappings))
            notes.Add("No mappings file supplied. This is accepted only when all required current-build tables parse successfully without it.");
        if (!tables.Single(table => table.Name == "pal-names-de").Present)
            notes.Add("German Pal localization was not found in the probed Dedicated Server paths; client-side localization may remain an optional supplemental source.");

        var report = new ProbeReport(
            2,
            catalog.SchemaVersion,
            buildId,
            startedAt,
            DateTimeOffset.UtcNow,
            workspace.PakBytes,
            !string.IsNullOrWhiteSpace(mappings),
            requiredPassed,
            tables,
            discoveries,
            notes);

        WriteJson(output, report, PrettyJsonOptions);

        Console.WriteLine($"Build {buildId}: {tables.Count(table => table.Parsed)}/{tables.Length} catalog tables parsed.");
        foreach (var table in tables)
            Console.WriteLine($"{table.Name}: present={table.Present} parsed={table.Parsed} sources={table.SourceCount} rows={table.RowCount}");

        foreach (var discovery in discoveries)
        {
            Console.WriteLine($"DISCOVERY {discovery.Key}: {discovery.Value.Count}");
            foreach (var package in discovery.Value)
                Console.WriteLine($"  {package}");
        }

        return requiredPassed ? 0 : 2;
    }

    private static int RunInventory(IReadOnlyDictionary<string, string> options)
    {
        var pakDirectory = Required(options, "pak-dir");
        var output = Required(options, "output");
        var buildId = Required(options, "build-id");
        var catalog = TableCatalog.Load(Required(options, "catalog"));
        var mappings = options.GetValueOrDefault("mappings");

        using var workspace = new PakWorkspace(pakDirectory, mappings);
        var tables = catalog.Tables.Select(workspace.Probe).ToArray();
        var discoveries = catalog.Discoveries.ToDictionary(
            discovery => discovery.Name,
            discovery => workspace.FindPackages(discovery.Token),
            StringComparer.OrdinalIgnoreCase);
        var inventory = new CoreInventory(
            1,
            catalog.SchemaVersion,
            buildId,
            tables,
            discoveries,
            workspace.FindPackages("/DataTable/"));

        WriteJson(output, inventory, PrettyJsonOptions);
        Console.WriteLine($"Inventory build={buildId} catalogTables={tables.Length} dataTablePackages={inventory.DataTablePackages.Count}");
        return tables.Where(table => table.Required).All(table => table.Parsed && table.RowCount > 0) ? 0 : 2;
    }

    private static int RunSnapshot(IReadOnlyDictionary<string, string> options)
    {
        var pakDirectory = Required(options, "pak-dir");
        var output = Required(options, "output");
        var summaryOutput = Required(options, "summary");
        var buildId = Required(options, "build-id");
        var catalog = TableCatalog.Load(Required(options, "catalog"));
        var mappings = options.GetValueOrDefault("mappings");

        using var workspace = new PakWorkspace(pakDirectory, mappings);
        var snapshot = new SnapshotBuilder(workspace, catalog).Build(buildId);
        var json = JsonSerializer.Serialize(snapshot, CompactJsonOptions);
        var bytes = Encoding.UTF8.GetBytes(json);
        var hash = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();

        var fullOutput = Path.GetFullPath(output);
        Directory.CreateDirectory(Path.GetDirectoryName(fullOutput)!);
        File.WriteAllBytes(fullOutput, bytes);

        var summary = new SnapshotSummary(
            snapshot.SchemaVersion,
            snapshot.SteamBuildId,
            snapshot.PalTables.Count,
            snapshot.PalTables.Sum(table => table.RowCount),
            snapshot.BreedingTables.Count,
            snapshot.BreedingTables.Sum(table => table.RowCount),
            snapshot.PalNamesEn.Sum(table => table.RowCount),
            snapshot.PalNamesDe.Sum(table => table.RowCount),
            hash);

        WriteJson(summaryOutput, summary, PrettyJsonOptions);

        Console.WriteLine($"Technical snapshot build={buildId} sha256={hash}");
        Console.WriteLine($"Pal source tables={summary.PalTableCount} rows={summary.PalRows}");
        Console.WriteLine($"Breeding source tables={summary.BreedingTableCount} rows={summary.BreedingRows}");
        Console.WriteLine($"Pal names EN={summary.PalNameRowsEn} DE={summary.PalNameRowsDe}");
        return 0;
    }

    private static void WriteJson<T>(string output, T value, JsonSerializerOptions options)
    {
        var fullOutput = Path.GetFullPath(output);
        Directory.CreateDirectory(Path.GetDirectoryName(fullOutput)!);
        File.WriteAllText(fullOutput, JsonSerializer.Serialize(value, options));
    }

    private static Dictionary<string, string> ParseOptions(string[] args)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        for (var index = 0; index < args.Length; index++)
        {
            if (!args[index].StartsWith("--", StringComparison.Ordinal))
                throw new ArgumentException($"Unexpected argument '{args[index]}'");
            var key = args[index][2..];
            if (index + 1 >= args.Length || args[index + 1].StartsWith("--", StringComparison.Ordinal))
                throw new ArgumentException($"Missing value for --{key}");
            result[key] = args[++index];
        }
        return result;
    }

    private static string Required(IReadOnlyDictionary<string, string> options, string key) =>
        options.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value)
            ? value
            : throw new ArgumentException($"--{key} is required");

    private static void PrintUsage() => Console.WriteLine("""
        Pal Data Core extractor

        validate-catalog --catalog FILE
        probe --pak-dir PATH --catalog FILE --output FILE --build-id ID [--mappings FILE]
        inventory --pak-dir PATH --catalog FILE --output FILE --build-id ID [--mappings FILE]
        snapshot --pak-dir PATH --catalog FILE --output FILE --summary FILE --build-id ID [--mappings FILE]
        """);
}
