namespace PalDataCore.Extractor;

public sealed record PassiveTechnicalRow(
    string SourceRow,
    int SourceOrdinal,
    string Rank,
    double LotteryWeight,
    string Category,
    string OverrideNameTextId,
    IReadOnlyList<string> PresentFields);

public sealed record PassiveTechnicalCandidate(
    int SchemaVersion,
    string SteamBuildId,
    IReadOnlyList<SourceTableSnapshot<PassiveTechnicalRow>> PassiveTables,
    IReadOnlyList<SourceTableSnapshot<LocalizedTextRow>> PassiveNamesEn,
    IReadOnlyList<SourceTableSnapshot<LocalizedTextRow>> PassiveNamesDe);

public sealed record PassiveCandidateSummary(
    int SchemaVersion,
    string SteamBuildId,
    int PassiveTableCount,
    int PassiveRows,
    int PassiveNameRowsEn,
    int PassiveNameRowsDe,
    string CandidateSha256);
