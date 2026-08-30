using System.Text.Json;
using System.Text.Json.Serialization;

namespace PalDataCore.Extractor;

internal static class Program
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
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

            if (!args[0].Equals("probe", StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException($"Unknown command '{args[0]}'. Only 'probe' is implemented in the first gate.");

            var options = ParseOptions(args[1..]);
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

            var fullOutput = Path.GetFullPath(output);
            Directory.CreateDirectory(Path.GetDirectoryName(fullOutput)!);
            File.WriteAllText(fullOutput, JsonSerializer.Serialize(report, JsonOptions));

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
        catch (Exception exception)
        {
            Console.Error.WriteLine($"{exception.GetType().Name}: {exception.Message}");
            return 1;
        }
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
        """);
}
