using CUE4Parse.UE4.Assets.Exports.Engine;

namespace PalDataCore.Extractor;

internal sealed class SnapshotBuilder(PakWorkspace workspace, TableCatalog catalog)
{
    private static readonly string[] WorkSuitabilityKeys =
    [
        "EmitFlame",
        "Watering",
        "Seeding",
        "GenerateElectricity",
        "Handcraft",
        "Collection",
        "Deforest",
        "Mining",
        "ProductMedicine",
        "Cool",
        "Transport",
        "MonsterFarm",
        "OilExtraction",
    ];

    public CoreTechnicalSnapshot Build(string buildId)
    {
        var palTables = workspace.LoadAll(catalog.Require("pals"))
            .Select(source => new SourceTableSnapshot<PalTechnicalRow>(
                source.PackagePath,
                source.Table.RowMap.Count,
                source.Table.RowMap
                    .Select((row, sourceOrdinal) => (Row: row, SourceOrdinal: sourceOrdinal))
                    .OrderBy(item => item.Row.Key.Text, StringComparer.Ordinal)
                    .Select(item => ReadPal(item.Row.Key.Text, item.SourceOrdinal, item.Row.Value))
                    .ToArray()))
            .ToArray();

        var breedingTables = workspace.LoadAll(catalog.Require("breeding-unique"))
            .Select(source => new SourceTableSnapshot<BreedingUniqueTechnicalRow>(
                source.PackagePath,
                source.Table.RowMap.Count,
                source.Table.RowMap
                    .Select((row, sourceOrdinal) => (Row: row, SourceOrdinal: sourceOrdinal))
                    .OrderBy(item => item.Row.Key.Text, StringComparer.Ordinal)
                    .Select(item => ReadBreeding(item.Row.Key.Text, item.SourceOrdinal, item.Row.Value))
                    .ToArray()))
            .ToArray();

        var namesEn = ReadTextTables(catalog.Require("pal-names-en"));
        var namesDe = ReadTextTables(catalog.Require("pal-names-de"));

        if (palTables.Length == 0 || breedingTables.Length == 0)
            throw new InvalidOperationException("Technical snapshot requires Pal and CombiUnique source tables.");

        return new CoreTechnicalSnapshot(
            2,
            buildId,
            palTables,
            breedingTables,
            namesEn,
            namesDe);
    }

    private IReadOnlyList<SourceTableSnapshot<LocalizedTextRow>> ReadTextTables(TableSpec spec) =>
        workspace.LoadAll(spec)
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

    private static PalTechnicalRow ReadPal(
        string sourceRow,
        int sourceOrdinal,
        CUE4Parse.UE4.Assets.Objects.FStructFallback row)
    {
        var reader = new ValueReader(row);
        var work = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var key in WorkSuitabilityKeys)
            work[key] = reader.Int(0, $"WorkSuitability_{key}");

        var passives = new[]
        {
            reader.String("", "PassiveSkill1"),
            reader.String("", "PassiveSkill2"),
            reader.String("", "PassiveSkill3"),
            reader.String("", "PassiveSkill4"),
        };

        return new PalTechnicalRow(
            sourceRow,
            sourceOrdinal,
            reader.String("", "Tribe"),
            reader.String("", "BPClass"),
            reader.Int(-1, "ZukanIndex", "PalDexNum"),
            reader.String("", "ZukanIndexSuffix"),
            reader.Bool(false, "IsPal"),
            reader.Bool(false, "IsBoss"),
            reader.Bool(false, "IsRaidBoss"),
            reader.Bool(false, "IsTowerBoss"),
            reader.Bool(false, "Predator"),
            reader.String("", "NamePrefixID"),
            reader.String("", "OverrideNameTextID"),
            reader.String("None", "ElementType1"),
            reader.String("None", "ElementType2"),
            reader.Int(0, "Rarity"),
            reader.Int(0, "CombiRank"),
            reader.Int(0, "CombiDuplicatePriority"),
            reader.Bool(false, "IgnoreCombi"),
            reader.Number(0, "MaleProbability"),
            reader.Bool(false, "Nocturnal"),
            reader.Int(0, "HP"),
            reader.Int(0, "MeleeAttack"),
            reader.Int(0, "ShotAttack"),
            reader.Int(0, "Defense"),
            reader.Int(0, "Support"),
            reader.Int(0, "CraftSpeed"),
            reader.Int(0, "Stamina"),
            reader.Int(0, "FoodAmount"),
            reader.Int(0, "SlowWalkSpeed"),
            reader.Int(0, "WalkSpeed"),
            reader.Int(0, "RunSpeed"),
            reader.Int(0, "RideSprintSpeed"),
            reader.Int(0, "TransportSpeed"),
            reader.Int(0, "SwimSpeed"),
            reader.Int(0, "SwimDashSpeed"),
            work,
            passives,
            reader.String("", "OverridePartnerSkillNameTextID"),
            reader.String("", "OverridePartnerSkillDescTextID"));
    }

    private static BreedingUniqueTechnicalRow ReadBreeding(
        string sourceRow,
        int sourceOrdinal,
        CUE4Parse.UE4.Assets.Objects.FStructFallback row)
    {
        var reader = new ValueReader(row);
        return new BreedingUniqueTechnicalRow(
            sourceRow,
            sourceOrdinal,
            reader.String("", "ParentTribeA"),
            reader.String("", "ParentTribeB"),
            reader.String("", "ParentGenderA"),
            reader.String("", "ParentGenderB"),
            reader.String("", "ChildCharacterID"));
    }
}
