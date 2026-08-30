namespace PalDataCore.Extractor;

internal sealed record TableSpec(string Name, bool Required, params string[] PackagePaths);

internal static class TableCatalog
{
    public static readonly TableSpec Pals = new(
        "pals",
        true,
        "Pal/Content/Pal/DataTable/Character/DT_PalMonsterParameter",
        "Pal/Content/Pal/DataTable/Character/DT_PalMonsterParameter_Common");

    public static readonly TableSpec Breeding = new(
        "breeding-unique",
        true,
        "Pal/Content/Pal/DataTable/Character/DT_PalCombiUnique",
        "Pal/Content/Pal/DataTable/Character/DT_PalCombiUnique_Common");

    public static readonly TableSpec PalNamesEn = new(
        "pal-names-en",
        false,
        "Pal/Content/L10N/en/Pal/DataTable/Text/DT_PalNameText_Common");

    public static readonly TableSpec PalNamesDe = new(
        "pal-names-de",
        false,
        "Pal/Content/L10N/de/Pal/DataTable/Text/DT_PalNameText_Common",
        "Pal/Content/L10N/de-DE/Pal/DataTable/Text/DT_PalNameText_Common");

    public static readonly TableSpec Items = new(
        "items",
        false,
        "Pal/Content/Pal/DataTable/Item/DT_ItemDataTable",
        "Pal/Content/Pal/DataTable/Item/DT_ItemDataTable_Common");

    public static readonly TableSpec PartnerSkills = new(
        "partner-skills",
        false,
        "Pal/Content/Pal/DataTable/PartnerSkill/DT_PartnerSkill");

    public static readonly TableSpec PartnerSkillParameters = new(
        "partner-skill-parameters",
        false,
        "Pal/Content/Pal/DataTable/PartnerSkill/DT_PartnerSkillParameter");

    public static readonly TableSpec PassiveSkills = new(
        "passives",
        false,
        "Pal/Content/Pal/DataTable/PassiveSkill/DT_PassiveSkill_Main");

    public static readonly TableSpec[] All =
    [
        Pals,
        Breeding,
        PalNamesEn,
        PalNamesDe,
        Items,
        PartnerSkills,
        PartnerSkillParameters,
        PassiveSkills,
    ];
}
