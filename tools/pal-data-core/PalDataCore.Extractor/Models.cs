namespace PalDataCore.Extractor;

public sealed record TableProbe(
    string Name,
    bool Required,
    string? PackagePath,
    bool Present,
    bool Parsed,
    int RowCount,
    IReadOnlyList<string> Fields,
    string? Error);

public sealed record ProbeReport(
    int SchemaVersion,
    string SteamBuildId,
    DateTimeOffset StartedAt,
    DateTimeOffset FinishedAt,
    long PakBytes,
    bool MappingsProvided,
    bool RequiredTablesPassed,
    IReadOnlyList<TableProbe> Tables,
    IReadOnlyList<string> Notes);
