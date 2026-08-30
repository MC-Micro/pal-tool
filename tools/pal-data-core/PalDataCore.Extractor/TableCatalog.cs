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
        "Pal/Content/L10N/de/Pal/DataTable/Text/DT_PalNameText_Common");

    public static readonly TableSpec Items = new(
        "items",
        false,
        "Pal/Content/Pal/DataTable/Item/DT_ItemDataTable",
        "Pal/Content/Pal/DataTable/Item/DT_ItemDataTable_Common");

    public static readonly TableSpec ItemRecipes = new(
        "item-recipes",
        false,
        "Pal/Content/Pal/DataTable/Item/DT_ItemRecipeDataTable",
        "Pal/Content/Pal/DataTable/Item/DT_ItemRecipeDataTable_Common");

    public static readonly TableSpec TechnologyRecipeUnlock = new(
        "technology-recipe-unlock",
        false,
        "Pal/Content/Pal/DataTable/Technology/DT_TechnologyRecipeUnlock",
        "Pal/Content/Pal/DataTable/Technology/DT_TechnologyRecipeUnlock_Common");

    public static readonly TableSpec TechnologyNamesEn = new(
        "technology-names-en",
        false,
        "Pal/Content/L10N/en/Pal/DataTable/Text/DT_TechnologyNameText_Common");

    public static readonly TableSpec TechnologyNamesDe = new(
        "technology-names-de",
        false,
        "Pal/Content/L10N/de/Pal/DataTable/Text/DT_TechnologyNameText_Common");

    public static readonly TableSpec TechnologyDescriptionsEn = new(
        "technology-descriptions-en",
        false,
        "Pal/Content/L10N/en/Pal/DataTable/Text/DT_TechnologyDescText_Common");

    public static readonly TableSpec TechnologyDescriptionsDe = new(
        "technology-descriptions-de",
        false,
        "Pal/Content/L10N/de/Pal/DataTable/Text/DT_TechnologyDescText_Common");

    public static readonly TableSpec PartnerSkills = new(
        "partner-skills",
        false,
        "Pal/Content/Pal/DataTable/PartnerSkill/DT_PartnerSkill");

    public static readonly TableSpec PartnerSkillParameters = new(
        "partner-skill-parameters",
        false,
        "Pal/Content/Pal/DataTable/PassiveSkill/DT_PartnerSkillParameter");

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
        ItemRecipes,
        TechnologyRecipeUnlock,
        TechnologyNamesEn,
        TechnologyNamesDe,
        TechnologyDescriptionsEn,
        TechnologyDescriptionsDe,
        PartnerSkills,
        PartnerSkillParameters,
        PassiveSkills,
    ];
}
