namespace PalDataCore.Extractor;

public sealed record FieldInventory(
    string Name,
    int RowsPresent,
    IReadOnlyList<string> PropertyTypes);

public sealed record TableSourceProbe(
    string PackagePath,
    bool Present,
    bool Parsed,
    int RowCount,
    IReadOnlyList<FieldInventory> Fields,
    string? Error);

public sealed record TableProbe(
    string Name,
    string Domain,
    string Extractor,
    bool Required,
    bool Present,
    bool Parsed,
    int SourceCount,
    int RowCount,
    IReadOnlyList<FieldInventory> Fields,
    IReadOnlyList<TableSourceProbe> Sources);

public sealed record ProbeReport(
    int SchemaVersion,
    int CatalogSchemaVersion,
    string SteamBuildId,
    DateTimeOffset StartedAt,
    DateTimeOffset FinishedAt,
    long PakBytes,
    bool MappingsProvided,
    bool RequiredTablesPassed,
    IReadOnlyList<TableProbe> Tables,
    IReadOnlyDictionary<string, IReadOnlyList<string>> Discoveries,
    IReadOnlyList<string> Notes);

public sealed record CoreInventory(
    int SchemaVersion,
    int CatalogSchemaVersion,
    string SteamBuildId,
    IReadOnlyList<TableProbe> Tables,
    IReadOnlyDictionary<string, IReadOnlyList<string>> Discoveries,
    IReadOnlyList<string> DataTablePackages);
