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
- `snapshot` erzeugt ausschließlich die normalisierte technische Zwischenstufe.
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

## Spätere Module

- PartnerSkill / PartnerSkillParameter;
- Passiven;
- Movement- und Blueprint-Ergänzungen;
- Items und Tech;
- weitere aktuell oder künftig relevante Spieldaten.

## Nicht in diesem Ordner

- persönliche Pal-Bestände, IVs/Talente und private Projekte (`MC-Micro/pal-vault`);
- Serversteuerung, DatHost oder Backups (`MC-Micro/pal-control`);
- pair-spezifische Breeder-Hardcodes.
