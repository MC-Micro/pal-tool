using System.Text.Json;

namespace PalDataCore.Extractor;

internal sealed record TableSpec(
    string Name,
    string Domain,
    string Extractor,
    bool Required,
    IReadOnlyList<string> PackagePaths);

internal sealed record DiscoverySpec(string Name, string Token);

internal sealed record TableCatalog(
    int SchemaVersion,
    IReadOnlyList<TableSpec> Tables,
    IReadOnlyList<DiscoverySpec> Discoveries)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public static TableCatalog Load(string path)
    {
        var fullPath = Path.GetFullPath(path);
        if (!File.Exists(fullPath))
            throw new FileNotFoundException("Data Core catalog not found", fullPath);

        var catalog = JsonSerializer.Deserialize<TableCatalog>(File.ReadAllText(fullPath), JsonOptions)
            ?? throw new InvalidDataException("Data Core catalog is empty or invalid.");

        catalog.Validate();
        return catalog;
    }

    public TableSpec Require(string name) => Tables.SingleOrDefault(
        table => table.Name.Equals(name, StringComparison.OrdinalIgnoreCase))
        ?? throw new InvalidDataException($"Catalog table '{name}' is required by this extraction profile.");

    private void Validate()
    {
        if (SchemaVersion != 1)
            throw new InvalidDataException($"Unsupported Data Core catalog schema {SchemaVersion}.");
        if (Tables.Count == 0)
            throw new InvalidDataException("Data Core catalog must contain at least one table.");
        if (Tables.Any(table => string.IsNullOrWhiteSpace(table.Name)
                                || string.IsNullOrWhiteSpace(table.Domain)
                                || string.IsNullOrWhiteSpace(table.Extractor)
                                || table.PackagePaths.Count == 0
                                || table.PackagePaths.Any(string.IsNullOrWhiteSpace)))
            throw new InvalidDataException("Every catalog table needs a name, domain, extractor, and package path.");
        if (Tables.GroupBy(table => table.Name, StringComparer.OrdinalIgnoreCase).Any(group => group.Count() > 1))
            throw new InvalidDataException("Data Core catalog table names must be unique.");
        if (Discoveries.Any(discovery => string.IsNullOrWhiteSpace(discovery.Name)
                                         || string.IsNullOrWhiteSpace(discovery.Token)))
            throw new InvalidDataException("Every discovery entry needs a name and token.");
        if (Discoveries.GroupBy(discovery => discovery.Name, StringComparer.OrdinalIgnoreCase)
            .Any(group => group.Count() > 1))
            throw new InvalidDataException("Data Core discovery names must be unique.");
    }
}
