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

Damit können Breeding, Work, Stats und ein wesentlicher Teil des Movement-Rohmodells aus derselben aktuellen Pal-Tabelle gespeist werden. Work, Stats und die genannten Movement-Rohwerte verursachen deshalb keinen zusätzlichen PAK-Download; offen ist ihre fachliche Normalisierung und Produktfreigabe.

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

Der versionierte technische Katalog liegt unter `tools/pal-data-core/catalog.v1.json`. Neue Tabellen werden zunächst generisch inventarisiert; endgültige kanonische Domain-Dateien und Interpretationen werden erst nach fachlicher Revalidierung festgezogen.

Die priorisierte, dynamische Ausbauplanung liegt in [`docs/PAL_DATA_CORE_ROADMAP.md`](../../docs/PAL_DATA_CORE_ROADMAP.md). Sie unterscheidet explizit zwischen `done`, bereits extrahierten aber noch nicht fachlich modellierten Daten, reiner Inventur und wirklich noch offenen Extraktions-/Forschungsblöcken.

## Breeder

Die buildabhängigen Zuchtfelder und die vollständige Unique-Combination-Tabelle gehören in den Core. Die fachliche Resolverregel bleibt in `data/palworld-breeding/breeding_rules.json`.

Bestehende `pal_values.json` und `special_combinations.json` bleiben als deterministische Kompatibilitätsartefakte für den Breeder bestehen und werden gegen den offiziellen Core-Candidate validiert.

Die 258 aktuellen `DT_PalCombiUnique`-Zeilen werden vor einer Domain-Aufteilung vollständig bewahrt und sind für Build `24575149` vollständig klassifiziert. Same-Species-, Gender-, Cross-Species- und technische Kombinationen dürfen beim Import nicht verloren gehen.

Der letzte deterministische Tabellen-Fallback wird aus dem offiziellen `sourceOrdinal` des Technical Snapshot abgeleitet. Das bestehende Breeder-Kompatibilitätsfeld `internal_index` spiegelt diesen Wert; es ist weder Paldecknummer noch ein unabhängig erfundener Zuchtindex.

## Kanonischer Passive-Identity-Reference-Space

Der bestätigende Schema-2-Lauf `34975314764` auf Commit `e28b6148f47ec2179f63de8c104664be8f31df73` erzeugte für den offiziellen Dedicated-Server-Build `25247047` das Artefakt `pal-data-core-candidate-25247047`, ID `10399160981`, Digest `sha256:1bd93cb80144833315dc7d6d6232f31fc57bb00cb11e317081ea34ee2a7ae63c`. Die unabhängige lokale Auswertung des vollständigen Artefakts war erfolgreich; es wurde nichts aus Dokumentation oder Review-Diffs rekonstruiert.

Das Artefakt belegt 3810 technische Source Rows, konfliktfrei coalesced zu 1905 Entities. Davon sind 115 `EPalPassiveCategory::SortDisplayable` und 1790 `SortNotDisplayable`. Bei allen 1905 steht `OverrideNameTextId` auf `None`; für alle 115 displaybaren Entities existiert jedoch der offizielle Key `PASSIVE_<sourceRow>` in EN und DE. `Rank` ist im Inventory ein `IntProperty`; Candidate-Schema 2 liest den Rohwert deshalb numerisch, ohne Rank-Semantik abzuleiten.

Die Candidate-Pipeline bewahrt weiterhin alle 1905 Entities mit `sourceRow`, Package-Pfad, `sourceOrdinal` als reine Provenienz, numerischem `Rank`, `LotteryWeight`, `Category`, `OverrideNameTextId` und den offiziellen EN-/DE-Lokalisierungszeilen. Der bytegenaue Candidate-Hash lautet `06ae40a0aafd4aa6da69841f526ac291eb82d5c91f70b118d0bdafda26540b5b`. Der engere Resolver-Reference-Space-Hash `5050fc82e7b14dad5ebb06de6aa3f5fbafbd8d168aae525b4b4fa05214efeb4b` umfasst nur displaybare `sourceRow`, die belegte Namensreferenz und EN-/DE-Namen; interne Entities, Package-/Ordinal-Provenienz und Balancefelder lösen keine user-facing Referenzmigration aus. Der bestehende Species-/Breeding-Snapshot und dessen Fingerprint bleiben unverändert.

Die Namensauflösung bevorzugt einen künftigen expliziten Override. Nur bei leerem/`None`-Override wird `PASSIVE_<sourceRow>` geprüft, und auch dann nur als belegte Referenz, wenn der Key in offizieller Lokalisierung tatsächlich existiert. Der historische Overlay ist nach dieser korrigierten Regel 102/102 exakt bilingual zuordenbar; 13 weitere aktuelle displaybare Entities zeigen, dass er keine vollständige Game-Truth-Whitelist ist. Die reale deutsche Ambiguität `Erleuchteter` bleibt für `ElementBoost_Normal_2_PAL` und `WorldTree_Sanity` erhalten.

[`passives.json`](passives.json) veröffentlicht daraus ausschließlich die 115 displaybaren Identitäten und Namen. [`passives.approval.json`](passives.approval.json) bindet diese Veröffentlichung explizit an Review-Schema, Referenz- und Candidate-Hash, Run, Commit, Artifact-Digest und die erwarteten Zählwerte. Der freigegebene Adapter-Key ist `{ namespace: "palworld.passive.source_row", value: sourceRow }`; persistierte Verweise tragen zusätzlich Schema 1 und den Reference-Space-Hash. Ein fremder Referenzraum ist ein ausdrücklicher Migrationsfall. Namen, PWA-Nummern, Arraypositionen, Rank, `sourceOrdinal` oder Generator-IDs sind keine dauerhaften Identitäten.

Weiter offen bleibt die Passive-Wirkungsdomäne. `SortDisplayable` beweist nur user-facing Resolver-Relevanz, nicht Vererbbarkeit, Züchtbarkeit, Effect-Semantik oder Balance. Insbesondere ist `apps/passives-pwa/data-passives.js.nr` keine Domain-ID.
