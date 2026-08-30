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
                "probe" => RunProbe(options),
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

    private static int RunProbe(IReadOnlyDictionary<string, string> options)
    {
        var pakDirectory = Required(options, "pak-dir");
        var output = Required(options, "output");
        var buildId = Required(options, "build-id");
        var mappings = options.GetValueOrDefault("mappings");

        var startedAt = DateTimeOffset.UtcNow;
        using var workspace = new PakWorkspace(pakDirectory, mappings);
        var tables = TableCatalog.All.Select(workspace.Probe).ToArray();
        var requiredPassed = tables
            .Where(table => table.Required)
            .All(table => table.Present && table.Parsed && table.RowCount > 0);

        var discoveries = new Dictionary<string, IReadOnlyList<string>>(StringComparer.OrdinalIgnoreCase)
        {
            ["PartnerSkillParameter"] = workspace.FindPackages("PartnerSkillParameter"),
            ["Technology"] = workspace.FindPackages("Technology"),
            ["Recipe"] = workspace.FindPackages("Recipe"),
            ["BreedingItemEffect"] = workspace.FindPackages("BreedingItemEffect"),
            ["PalGameSetting"] = workspace.FindPackages("PalGameSetting"),
        };

        var notes = new List<string>();
        if (string.IsNullOrWhiteSpace(mappings))
            notes.Add("No mappings file supplied. This is accepted only when all required current-build tables parse successfully without it.");
        if (!tables.Single(table => table.Name == "pal-names-de").Present)
            notes.Add("German Pal localization was not found in the probed Dedicated Server paths; client-side localization may remain an optional supplemental source.");

        var report = new ProbeReport(
            1,
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
            Console.WriteLine($"{table.Name}: present={table.Present} parsed={table.Parsed} rows={table.RowCount} path={table.PackagePath ?? "-"}");

        foreach (var discovery in discoveries)
        {
            Console.WriteLine($"DISCOVERY {discovery.Key}: {discovery.Value.Count}");
            foreach (var package in discovery.Value)
                Console.WriteLine($"  {package}");
        }

        return requiredPassed ? 0 : 2;
    }

    private static int RunSnapshot(IReadOnlyDictionary<string, string> options)
    {
        var pakDirectory = Required(options, "pak-dir");
        var output = Required(options, "output");
        var summaryOutput = Required(options, "summary");
        var buildId = Required(options, "build-id");
        var mappings = options.GetValueOrDefault("mappings");

        using var workspace = new PakWorkspace(pakDirectory, mappings);
        var snapshot = new SnapshotBuilder(workspace).Build(buildId);
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

        probe --pak-dir PATH --output FILE --build-id ID [--mappings FILE]
        snapshot --pak-dir PATH --output FILE --summary FILE --build-id ID [--mappings FILE]
        """);
}
