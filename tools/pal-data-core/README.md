# Pal Data Core Tooling

Dieser Ordner ist der dauerhafte technische Einstieg für die GitHub-native Palworld-Datenpipeline.

## Ziel

Der Standardweg soll ohne lokalen Nutzer-PC reproduzierbar funktionieren:

```text
Steam Build Query
→ Dedicated Server Download
→ CUE4Parse Probe/Snapshot
→ Technical Core
→ Domain-Generatoren
→ Diff/Tests/Review
```

## Designregeln

- Acquisition und Extraction sind getrennte Komponenten.
- Steam App `2394010` wird anonym bezogen.
- Ein Build wird vor dem Download abgefragt; unveränderte Builds müssen nicht erneut vollständig geladen werden.
- SteamCMD-Aufrufe benötigen begrenzte Wiederholungen für transiente Metadaten-/Konfigurationsfehler.
- PAKs werden nur temporär im Runner verarbeitet.
- CUE4Parse liest bevorzugt direkt aus dem PAK-Verzeichnis; `Mappings.usmap` ist nur ein buildkompatibler Fallback, wenn der aktuelle Server-Build ohne Mapping nicht vollständig parsebar ist.
- Raw PAKs, Mappings und vollständige Originaltabellen werden nicht committed oder als Build-Artefakt veröffentlicht.
- `probe` prüft Tabellen, Row-Counts und Feldabdeckung ohne kanonische Veröffentlichung.
- `inventory` erfasst deterministisch alle katalogisierten Quellen und sämtliche darin vorkommenden Felder über alle Zeilen; zusätzlich listet es alle DataTable-Pakete und konfigurierte Discoveries.
- `snapshot` erzeugt ausschließlich die normalisierte technische Zwischenstufe.
- `passive-candidate` erzeugt eine getrennte, feldbegrenzte technische Zwischenstufe aus Passive Main/Common und den offiziellen EN-/DE-Skillnamen. Alle konfigurierten Quellen sind für diesen Befehl verpflichtend; fehlende oder nicht parsebare Quellen brechen ab.
- Domain-Generatoren entscheiden erst oberhalb des Technical Core über spielbare, züchtbare oder anderweitig öffentliche Datensätze.
- Ein fehlgeschlagener neuer Refresh darf den letzten akzeptierten kanonischen Build nicht ersetzen.

## Erster Scope

Der erste dauerhafte Implementierungsblock umfasst:

- `DT_PalMonsterParameter` und gegebenenfalls `_Common`;
- `DT_PalCombiUnique` und gegebenenfalls `_Common`;
- relevante Pal-Lokalisierung, soweit sie im Dedicated Server vorhanden und vollständig ist;
- Provenienz, Tabellenstatus, Row-/Field-Diff und Hashes;
- Breeding-Adapter aus dem normalisierten Core.

Work und Stats werden bewusst schon beim Pal-Row-Snapshot erhalten, auch wenn ihre öffentlichen Domain-Dateien erst im nächsten Schritt freigegeben werden.

## Versionierter Tabellenkatalog

`catalog.v1.json` ist die datengetriebene Grenze zwischen dem allgemeinen PAK-Leser und den Domain-Profilen. Ein Eintrag enthält:

- stabilen technischen Namen und Domäne;
- genaues Extraktionsprofil (`pal-technical-v1`, `breeding-unique-v1`, `passive-technical-v1`, `localized-text-v1` oder zunächst `inventory-only`);
- Release-Relevanz über `required`;
- eine oder mehrere exakte Package-Quellen.

Ein `inventory-only`-Eintrag erfordert keine neue Acquisition. Unbekannte Felder werden als Name, Unreal-Property-Typ und Zeilenvorkommen sichtbar, bleiben aber bis zur Review uninterpretiert.

## Befehle

```bash
project=tools/pal-data-core/PalDataCore.Extractor/PalDataCore.Extractor.csproj
catalog=tools/pal-data-core/catalog.v1.json

dotnet run --project "$project" -- validate-catalog --catalog "$catalog"
dotnet run --project "$project" -- probe --pak-dir PAKS --catalog "$catalog" --output probe.json --build-id BUILD
dotnet run --project "$project" -- inventory --pak-dir PAKS --catalog "$catalog" --output inventory.json --build-id BUILD
dotnet run --project "$project" -- snapshot --pak-dir PAKS --catalog "$catalog" --output snapshot.json --summary summary.json --build-id BUILD
dotnet run --project "$project" -- passive-candidate --pak-dir PAKS --catalog "$catalog" --output passive-candidate.json --summary passive-summary.json --build-id BUILD
```

`Pal Data Core CI` kompiliert warnings-as-errors und validiert den Katalog ohne Spieldownload. `Probe Pal Data Core` ist der teure offizielle Build-Gate; sein kurzlebiges Review-Artefakt enthält nur normalisierte Candidate-Dateien, niemals PAKs, Mappings oder Raw DataTables.

`scripts/review-breeding-candidate.mjs` ist der read-only Breeding-Adapter-Gate. Er vergleicht den Candidate gegen die reviewte Produktmenge und blockiert bei:

- abweichenden offiziellen Namen, Paldeck-Nummern, Rängen, Rarity-, Ignore- oder Priority-Werten;
- widersprüchlichen Main-/Common-Quellen;
- fehlenden oder neuen veröffentlichten Cross-Species-Specials;
- nicht klassifizierten technischen Cross-Species-Zeilen oder Same-Species-Zeilen mit abweichendem Kind;
- nicht eindeutig reproduzierbarer technischer Snapshot-Provenienz.

Der Adapter schreibt nur einen Reviewbericht und verändert keine kanonischen Daten. Er klassifiziert alle 258 technischen Zuchtzeilen einzeln. Im Build `24575149` sind das 115 veröffentlichte Same-Species-Identitäten, 136 veröffentlichte Cross-Species-Specials und sieben technische Same-Species-Identitäten außerhalb des Produktfilters; technische Cross-Species-Zeilen außerhalb des Filters gibt es nicht. Die 299 veröffentlichte Arten umfassende Produktmenge bleibt ein expliziter Filter oberhalb der 753 technischen Pal-Zeilen.

`scripts/review-passive-candidate.mjs` ist der read-only Passive-Identity-/Crosswalk-Gate. Er:

- coalesced gleiche `sourceRow`-Identitäten aus Main/Common und blockiert bei abweichendem Inhalt;
- behandelt `sourceOrdinal` ausschließlich als Quellprovenienz;
- bevorzugt einen expliziten `OverrideNameTextId`; bei leerem/`None`-Override akzeptiert er die im Build `25247047` belegte Konvention `PASSIVE_<sourceRow>` nur dann, wenn dieser Key in mindestens einer offiziellen Lokalisierungstabelle tatsächlich existiert;
- begrenzt den user-facing Reference Space exakt auf `EPalPassiveCategory::SortDisplayable`, ohne daraus Vererbbarkeit, Züchtbarkeit oder Effect-Semantik abzuleiten;
- weist fehlende EN-/DE-Lokalisierungen sowie englische und deutsche Anzeigenamen-Ambiguitäten separat aus;
- mappt den historischen 102-Einträge-Overlay nur bei übereinstimmenden exakten EN- und DE-Treffern;
- verwendet weder Overlay-Nummer, Arrayposition, Rank, Displayname noch Fuzzy-Ähnlichkeit als technische Identität;
- bindet den Bericht sowohl an den bytegenauen Passive-Candidate-SHA-256 als auch an einen kanonischen Reference-Space-SHA-256 nur über displaybare `sourceRow`, belegte Namensreferenz und EN-/DE-Namen; Package-/Ordinal-Provenienz sowie Rank-, Lottery- und Category-Balancewerte sind nicht Teil dieses Resolver-Fingerprints.

Candidate-Schema 2 modelliert den inventarbelegten `IntProperty`-Rohwert `Rank` als Integer; es interpretiert seine Spielsemantik nicht. Der offizielle Probe-Workflow erzeugt Candidate und Summary zweimal und vergleicht beide bytegenau. Das Gate verlangt konfliktfreie relevante Quellen, vollständige EN-/DE-Namen aller displaybaren Entities und einen vollständig eindeutigen historischen Overlay-Crosswalk. Echte Einzelsprachen-Ambiguitäten und neue offizielle displaybare Entities außerhalb des Overlays bleiben erlaubt und sichtbar. Konflikte werden erst nach Upload des normalisierten Review-Artefakts als fehlgeschlagenes Gate markiert, damit der Widerspruch prüfbar bleibt. Eine kanonische Passive-Datei oder ein Breeder-AI-`PassiveResolver` entsteht aus diesem Candidate nicht automatisch; beides erfordert erneut die explizite Review eines aktuellen offiziellen Build-Artefakts.

## Spätere Module

- PartnerSkill / PartnerSkillParameter;
- kanonische Passive-Wirkungssemantik und Resolver-Veröffentlichung;
- Movement- und Blueprint-Ergänzungen;
- Items und Tech;
- weitere aktuell oder künftig relevante Spieldaten.

## Nicht in diesem Ordner

- persönliche Pal-Bestände, IVs/Talente und private Projekte (`MC-Micro/pal-vault`);
- Serversteuerung, DatHost oder Backups (`MC-Micro/pal-control`);
- pair-spezifische Breeder-Hardcodes.
