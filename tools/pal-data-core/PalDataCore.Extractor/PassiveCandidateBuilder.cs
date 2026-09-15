using CUE4Parse.UE4.Assets.Exports.Engine;

namespace PalDataCore.Extractor;

internal sealed class PassiveCandidateBuilder(PakWorkspace workspace, TableCatalog catalog)
{
    public PassiveTechnicalCandidate Build(string buildId)
    {
        var passiveTables = ReadPassiveTables(catalog.Require("passives"));
        var namesEn = ReadTextTables(catalog.Require("passive-names-en"));
        var namesDe = ReadTextTables(catalog.Require("passive-names-de"));

        return new PassiveTechnicalCandidate(
            1,
            buildId,
            passiveTables,
            namesEn,
            namesDe);
    }

    private IReadOnlyList<SourceTableSnapshot<PassiveTechnicalRow>> ReadPassiveTables(TableSpec spec) =>
        LoadEveryConfiguredSource(spec)
            .Select(source => new SourceTableSnapshot<PassiveTechnicalRow>(
                source.PackagePath,
                source.Table.RowMap.Count,
                source.Table.RowMap
                    .Select((row, sourceOrdinal) => (Row: row, SourceOrdinal: sourceOrdinal))
                    .OrderBy(item => item.Row.Key.Text, StringComparer.Ordinal)
                    .Select(item => ReadPassive(item.Row.Key.Text, item.SourceOrdinal, item.Row.Value))
                    .ToArray()))
            .ToArray();

    private IReadOnlyList<SourceTableSnapshot<LocalizedTextRow>> ReadTextTables(TableSpec spec) =>
        LoadEveryConfiguredSource(spec)
            .Select(source => new SourceTableSnapshot<LocalizedTextRow>(
                source.PackagePath,
                source.Table.RowMap.Count,
                source.Table.RowMap
                    .Select((row, sourceOrdinal) => (Row: row, SourceOrdinal: sourceOrdinal))
                    .OrderBy(item => item.Row.Key.Text, StringComparer.Ordinal)
                    .Select(item => new LocalizedTextRow(
                        item.Row.Key.Text,
                        item.SourceOrdinal,
                        new ValueReader(item.Row.Value).String("", "TextData", "Text", "Value")))
                    .ToArray()))
            .ToArray();

    private IReadOnlyList<(string PackagePath, UDataTable Table)> LoadEveryConfiguredSource(TableSpec spec)
    {
        var sources = workspace.LoadAll(spec)
            .OrderBy(source => source.PackagePath, StringComparer.Ordinal)
            .ToArray();
        var loaded = sources.Select(source => source.PackagePath).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var missing = spec.PackagePaths
            .Where(packagePath => !loaded.Contains(packagePath))
            .Order(StringComparer.Ordinal)
            .ToArray();
        if (missing.Length > 0)
        {
            throw new InvalidOperationException(
                $"Passive candidate requires every configured source for '{spec.Name}'. Missing or unparseable: {string.Join(", ", missing)}");
        }
        return sources;
    }

    private static PassiveTechnicalRow ReadPassive(
        string sourceRow,
        int sourceOrdinal,
        CUE4Parse.UE4.Assets.Objects.FStructFallback row)
    {
        var reader = new ValueReader(row);
        return new PassiveTechnicalRow(
            sourceRow,
            sourceOrdinal,
            reader.String("", "Rank"),
            reader.Number(0, "LotteryWeight"),
            reader.String("", "Category"),
            reader.String("", "OverrideNameTextId", "OverrideNameTextID"),
            reader.PresentPropertyNames(
                "Rank",
                "LotteryWeight",
                "Category",
                "OverrideNameTextId",
                "OverrideNameTextID"));
    }
}
