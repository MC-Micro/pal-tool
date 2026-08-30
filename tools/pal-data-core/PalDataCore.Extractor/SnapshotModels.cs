namespace PalDataCore.Extractor;

public sealed record SourceTableSnapshot<T>(
    string PackagePath,
    int RowCount,
    IReadOnlyList<T> Rows);

public sealed record PalTechnicalRow(
    string SourceRow,
    string Tribe,
    string BpClass,
    int ZukanIndex,
    string ZukanIndexSuffix,
    bool IsPal,
    bool IsBoss,
    bool IsRaidBoss,
    bool IsTowerBoss,
    bool Predator,
    string NamePrefixId,
    string OverrideNameTextId,
    string ElementType1,
    string ElementType2,
    int Rarity,
    int CombiRank,
    int CombiDuplicatePriority,
    bool IgnoreCombi,
    double MaleProbability,
    bool Nocturnal,
    int Hp,
    int MeleeAttack,
    int ShotAttack,
    int Defense,
    int Support,
    int CraftSpeed,
    int Stamina,
    int FoodAmount,
    int SlowWalkSpeed,
    int WalkSpeed,
    int RunSpeed,
    int RideSprintSpeed,
    int TransportSpeed,
    int SwimSpeed,
    int SwimDashSpeed,
    IReadOnlyDictionary<string, int> WorkSuitability,
    IReadOnlyList<string> DefaultPassiveSkills,
    string OverridePartnerSkillNameTextId,
    string OverridePartnerSkillDescTextId);

public sealed record BreedingUniqueTechnicalRow(
    string SourceRow,
    string ParentTribeA,
    string ParentTribeB,
    string ParentGenderA,
    string ParentGenderB,
    string ChildCharacterId);

public sealed record LocalizedTextRow(
    string SourceRow,
    string Text);

public sealed record CoreTechnicalSnapshot(
    int SchemaVersion,
    string SteamBuildId,
    DateTimeOffset GeneratedAt,
    IReadOnlyList<SourceTableSnapshot<PalTechnicalRow>> PalTables,
    IReadOnlyList<SourceTableSnapshot<BreedingUniqueTechnicalRow>> BreedingTables,
    IReadOnlyList<SourceTableSnapshot<LocalizedTextRow>> PalNamesEn,
    IReadOnlyList<SourceTableSnapshot<LocalizedTextRow>> PalNamesDe);

public sealed record SnapshotSummary(
    int SchemaVersion,
    string SteamBuildId,
    int PalTableCount,
    int PalRows,
    int BreedingTableCount,
    int BreedingRows,
    int PalNameRowsEn,
    int PalNameRowsDe,
    string SnapshotSha256);
