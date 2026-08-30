# Pal Data Core – Zielarchitektur

**Stand:** 30. August 2026  
**Status:** verbindliche Architekturgrundlage für den laufenden Core-/Breeder-Refresh; Implementierung wird schrittweise auf dem Feature-Branch aufgebaut

## Zweck

`MC-Micro/pal-tool` ist die öffentliche technische Wahrheit für allgemeine Palworld-Spieldaten und die darauf aufbauenden Engines, APIs, MCP-Tools und Apps.

Der neue Pal Data Core soll künftig alle allgemeinen, buildbezogenen Spieldaten aus einer reproduzierbaren Primärquelle ableiten. Der Breeder ist der erste produktive Verbraucher, aber nicht Eigentümer der gemeinsamen Spieldaten.

## Repository-Grenzen

- `MC-Micro/pal-tool`: allgemeine Palworld-Fakten, Data-Core-Extractor, Fachregeln, Engines, PWA, API und MCP.
- `MC-Micro/pal-vault`: private Player-State-Daten, Projektkontinuität, Entscheidungen, Handoffs und persönliche Zuchtprojekte.
- `MC-Micro/pal-control`: private Serversteuerung und Host-/Serverintegrationen.

`pal-tool` darf für Build, Tests oder Runtime nicht von `pal-vault` oder `pal-control` abhängig sein.

## Wahrheitsklassen

### Game Truth

Direkt aus dem jeweiligen Palworld-Build gewonnene Fakten, zum Beispiel:

- technische Pal-Zeilen und Identitäten;
- Elemente;
- Arten-Grundwerte;
- Arbeitstauglichkeiten;
- Movement-Rohfelder;
- Zuchtparameter wie `CombiRank`, `IgnoreCombi` und `CombiDuplicatePriority`;
- vollständige `DT_PalCombiUnique`-Einträge;
- Partner-, Passive-, Item-, Technologie- und weitere DataTable-Fakten, sobald die jeweiligen Module aufgenommen wurden.

Diese Ebene gehört in den Pal Data Core.

### Mechanic Truth

Rekonstruierte und getestete Spielmechaniken, die nicht als einzelnes Rohfeld vorliegen. Beispiele:

- Zuchtentscheidungsreihenfolge;
- Kandidatenfilter;
- Tie-Break-Regeln;
- später Movement-, Partner- oder Berechnungsregeln.

Diese Ebene gehört in das jeweilige Fachmodul und wird gegen Game Truth und unabhängige Cross-Checks validiert.

### Player State

Konkrete persönliche Pal-Exemplare, IVs/Talente, Passiven, Geschlecht, Variante, Kondensation, Rollen und laufende Projekte sind keine allgemeine Spielwahrheit. Sie bleiben privat in `MC-Micro/pal-vault` und werden dem Planner nur als Eingabe bereitgestellt.

### Operational Truth

Serverstatus, Backups, Hosteinstellungen und Serveraktionen gehören ausschließlich zu `MC-Micro/pal-control`.

## Aktive Primärquelle

Der reguläre Data-Core-Refresh verwendet künftig den offiziellen anonym verfügbaren Palworld Dedicated Server über Steam App `2394010` in GitHub Actions.

Der lokale Windows-/Laptop-Extraktionsweg vom Juli 2026 ist historische Evidenz und Fallback-Referenz, aber kein aktiv weiterzuentwickelnder Standardweg.

### Zielpipeline

```text
Steam public build id
→ offizieller Dedicated Server
→ PAKs read-only mit CUE4Parse mounten
→ Tabellen-Probe
→ technischer Snapshot
→ Schema-/Row-/Field-Diff
→ Domain-Normalisierung
→ Domain-Tests
→ Review-Artefakt
→ freigegebene kanonische Daten
```

Raw PAKs, Mappings und vollständige extrahierte Originalassets werden nicht committed.

## Technical Core vor Produktfilter

Die vollständige technische Tabellenmenge bleibt zunächst erhalten. Insbesondere werden die aktuell bekannten 753 technischen Zeilen aus `DT_PalMonsterParameter` nicht bereits im Extractor auf die öffentliche spielbare Pal-Liste reduziert.

Fangbarkeit, Züchtbarkeit, Spielbarkeit, technische Existenz, Varianten-, Boss-, Raid-, Tower-, Predator- und weitere Formen sind getrennte Eigenschaften beziehungsweise Klassifizierungen.

Produktmodule filtern erst oberhalb des Technical Core.

## Domain-Module

Die gemeinsame Identität verbindet getrennte Fachmodule. Zielrichtung:

```text
data/palworld-core/
  manifest.json
  entities.json
  pals.json
  stats.json
  work.json
  movement.json
  passives.json
  partners.json
  items.json
  tech.json
  breeding.json
```

Die exakte Datei- und Schemaaufteilung wird während der Revalidierung gegen die realen aktuellen Tabellen finalisiert. Keine Domain darf eine zweite Kopie derselben allgemeinen Pal-Fakten handpflegen.

## Breeding-Integration

Der Breeder bezieht zukünftig alle buildabhängigen Pal- und Kombinationstabellen aus dem Data Core.

`data/palworld-breeding/breeding_rules.json` bleibt die fachliche Regelwahrheit des Resolvers.

`pal_values.json` und `special_combinations.json` dürfen zur Rückwärtskompatibilität bestehen bleiben, sollen aber künftig deterministisch aus dem Core erzeugt und nicht als unabhängige handgepflegte Spieldatenquelle behandelt werden.

Die vollständige `DT_PalCombiUnique`-Tabelle wird vor der Aufteilung in öffentliche Specials, Same-Species-/Exclusion-Einträge, geschlechtsabhängige Regeln und weitere Sonderfälle erhalten.

## Versionierung

Mindestens folgende Versionen bleiben getrennt:

- Palworld Game-/Dedicated-Server-Build;
- Data-Core-Schema;
- Domain-Regelschema, zum Beispiel Breeding Rules;
- öffentliche API-/MCP-Schemaversion.

Eine neue Spielversion erzwingt nicht automatisch eine neue Core-, Regel- oder API-Schemaversion.

## Patch- und Release-Gates

Ein neuer Build darf nicht automatisch als kanonisch freigegeben werden.

Der Refresh soll mindestens prüfen:

- Build-ID und Quellenprovenienz;
- erforderliche Tabellen vorhanden und parsebar;
- Row- und Feldänderungen;
- unbekannte neue Felder beziehungsweise Strukturänderungen;
- Domain-Generatoren deterministisch;
- Breeding-Matrix und Regressionen;
- weitere Domain-Tests, sobald Work, Stats, Movement, Partner, Items und Tech aufgenommen werden;
- unabhängige Cross-Checks.

Unbekannte Strukturänderungen blockieren die Veröffentlichung bis zur fachlichen Prüfung.

## Private bestandsoptimierte Planung

Der öffentliche Breeder-Core bleibt stateless und darf keinen privaten Player State speichern oder über das anonyme MCP offenlegen.

Langfristig ist eine private, authentifizierte Planner-Schicht sinnvoll. Bevorzugtes Modell:

```text
pal-vault (kanonischer privater Player State)
→ geprüfter/synchronisierter privater Runtime-Snapshot
→ authentifizierter Planner

pal-tool Data Core + Breeding Engine
→ derselbe Planner
```

Der Planner kann dadurch Artenroute, Geschlechter, Passiven, IVs/Talente, Varianten und vorhandene Zwischenprodukte gemeinsam optimieren, ohne bei jeder Anfrage GitHub-Dateien manuell durchsuchen zu müssen.

Der anonyme öffentliche MCP-Zugang darf dabei niemals Zugriff auf den privaten Runtime-Snapshot erhalten.

## Sicherheits- und Lizenzgrenzen

- keine Secrets, Tokens oder privaten Serveradressen im Repository;
- keine privaten Inventardaten in `pal-tool`;
- keine Raw-Game-Assets veröffentlichen;
- fremden MIT-Code nur mit erforderlicher Attribution übernehmen;
- Communitydaten dienen als Cross-Check, nicht als stillschweigende Primärquelle.

## Aktueller Umsetzungsblock

1. aktuellen Dedicated-Server-Weg erneut reproduzierbar validieren;
2. Acquisition von Extraction trennen und SteamCMD-Fehler robust behandeln;
3. aktuellen Tabellenkatalog und Mapping-Bedarf bestimmen;
4. Technical-Core-Extractor aufbauen;
5. Pal- und Breeding-Module zuerst migrieren;
6. aktuelle 1.0.3-Breeding-Daten aus demselben Core erzeugen;
7. anschließend Work und Stats, danach Partner/Passives/Movement/Items/Tech erweitern;
8. temporäre Probe-/Migrationsworkflows vor dem finalen PR entfernen.
