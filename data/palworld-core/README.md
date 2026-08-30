# Palworld Data Core

Dieser Bereich wird die kanonische, buildbezogene allgemeine Palworld-Datenbasis von `MC-Micro/pal-tool`.

## Grundsatz

Der Core speichert allgemeine Spielwahrheit. Persönlicher Besitz, IVs/Talente konkreter Exemplare, persönliche Passivkombinationen und private Zuchtprojekte gehören nicht hierher.

## Quellenmodell

Primärquelle ist der jeweils geprüfte offizielle Palworld Dedicated Server. Community- und Drittquellen dienen nur als unabhängige Cross-Checks oder Interpretationshilfe.

Jeder akzeptierte Core-Stand muss seine Provenienz dokumentieren, insbesondere:

- Palworld-/Dedicated-Server-Build;
- Prüf-/Generierungszeitpunkt;
- Extraktorversion beziehungsweise Commit;
- CUE4Parse-Version;
- Mapping-Status und gegebenenfalls Mapping-Hash;
- verwendete Tabellen und Row-Counts;
- normalisierte Output-Hashes;
- bekannte Konflikte und Freshness-/Revalidierungsstatus.

## Aktuell live verifizierter Probe-Stand

Am 30. August 2026 wurde die neue GitHub-native Probe auf dem Feature-Branch erfolgreich gegen den offiziellen anonym verfügbaren Dedicated Server ausgeführt.

```text
Steam App: 2394010
Dedicated-Server-Build: 24575149
Pal-LinuxServer.pak: 4,797,106,687 Bytes
CUE4Parse: 1.2.2.202607
externes Mapping: nicht verwendet
requiredTablesPassed: true
```

Direkt aus dem aktuellen Server-Paket erfolgreich gelesen:

```text
DT_PalMonsterParameter: 753 Zeilen
DT_PalCombiUnique: 258 Zeilen
DT_PalNameText_Common (en): 322 Zeilen
DT_PalNameText_Common (de): 322 Zeilen
DT_ItemDataTable: 2466 Zeilen
DT_PartnerSkill: 50 Zeilen
DT_PassiveSkill_Main: 1905 Zeilen
```

Die dateilistebasierte Discovery korrigierte den zunächst geratenen Pfad: `DT_PartnerSkillParameter` liegt im aktuellen Server unter `Pal/Content/Pal/DataTable/PassiveSkill/DT_PartnerSkillParameter` und umfasst **682 Zeilen**. Die Katalogpipeline speichert diese Korrektur als expliziten Package-Pfad und behält Discovery für künftige Verschiebungen bei.

Weitere live bestätigte Katalogstände:

```text
DT_ItemRecipeDataTable: 1414 Zeilen
DT_TechnologyRecipeUnlock: 588 Zeilen
DT_TechnologyNameText_Common (en/de): 835 / 835 Zeilen
DT_TechnologyDescText_Common (en/de): 587 / 587 Zeilen
```

### Bestätigte gemeinsame Pal-Felder

Der aktuelle `DT_PalMonsterParameter` liefert ohne externes Mapping unter anderem direkt:

- Identitäts-/Formfelder: `Tribe`, `BPClass`, `ZukanIndex`, `ZukanIndexSuffix`, `IsPal`, `IsBoss`, `IsRaidBoss`, `IsTowerBoss`, `Predator`;
- Elemente: `ElementType1`, `ElementType2`;
- Breeding: `CombiRank`, `CombiDuplicatePriority`, `IgnoreCombi`, `MaleProbability`;
- Stats: `HP`, `MeleeAttack`, `ShotAttack`, `Defense`, `Support`, `CraftSpeed`, `Stamina`, `FoodAmount`;
- Movement: `SlowWalkSpeed`, `WalkSpeed`, `RunSpeed`, `RideSprintSpeed`, `TransportSpeed`, `SwimSpeed`, `SwimDashSpeed`;
- Standardpassiven: `PassiveSkill1` bis `PassiveSkill4`;
- Partnertextreferenzen;
- dreizehn `WorkSuitability_*`-Felder einschließlich `OilExtraction`.

Damit können Breeding, Work, Stats und ein wesentlicher Teil des Movement-Rohmodells aus derselben aktuellen Pal-Tabelle gespeist werden.

### Lokalisierung

Der aktuelle Linux-Dedicated-Server enthält sowohl die englische als auch die deutsche `DT_PalNameText_Common` mit jeweils 322 Zeilen. Ein lokaler Microsoft-Store-/Xbox-PC-Client ist damit **für Pal-Namen im aktuellen Build nicht als Pflichtquelle erforderlich**.

Client-Daten bleiben nur dann ein möglicher ergänzender Fallback, wenn spätere Module nachweislich client-only Inhalte benötigen.

## Technische Zeilen vor Produktansicht

Der Technical Core bewahrt alle relevanten technischen Zeilen, bevor Domain- oder Produktfilter greifen. Technische Existenz, Spielbarkeit, Fangbarkeit, Züchtbarkeit, Boss-/Raid-/Tower-/Predatorstatus und Variantenbezug sind getrennte Dimensionen.

Die aktuell bestätigten 753 Pal-Zeilen werden deshalb nicht bereits im Extractor auf eine öffentliche spielbare Pal-Liste reduziert.

## Domain-Trennung

Geplante beziehungsweise zu revalidierende Module:

- `entities` / Pal-Identitäten und Crosswalks;
- `pals`;
- `stats`;
- `work`;
- `movement`;
- `passives`;
- `partners`;
- `items`;
- `tech`;
- `breeding`;
- `manifest` / Provenienz und Status.

Der versionierte technische Katalog liegt unter `tools/pal-data-core/catalog.v1.json`. Neue Tabellen werden zunächst generisch inventarisiert; endgültige kanonische Domain-Dateien und Interpretationen werden erst nach fachlicher 1.0.3-Revalidierung festgezogen.

## Breeder

Die buildabhängigen Zuchtfelder und die vollständige Unique-Combination-Tabelle gehören in den Core. Die fachliche Resolverregel bleibt in `data/palworld-breeding/breeding_rules.json`.

Bestehende `pal_values.json` und `special_combinations.json` sollen nach der Migration deterministisch aus dem Core erzeugt werden.

Die 258 aktuellen `DT_PalCombiUnique`-Zeilen werden vor einer Domain-Aufteilung vollständig bewahrt. Same-Species-, Gender-, Cross-Species- und weitere technische Kombinationen dürfen nicht bereits beim Import verloren gehen.
