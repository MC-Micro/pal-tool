# Breeder AI – Phase-0 Passive Candidate/Resolver Abschlussbericht

**Berichtsstand:** 15. September 2026

**Repository:** `MC-Micro/pal-tool`

**Lokaler Branch:** `breeder/passive-resolver-discovery`

**Korrektur-Ausgangs-HEAD / Remote-HEAD:** `ac8fe06a0483b31fdc24122e82230b91f860a85d`

**Lokaler Implementierungscommit:** `d21110b fix(data-core): correct passive reference review`

**Status:** lokaler Korrekturblock vollständig validiert; Review-Stop; erneuter offizieller Probe-Lauf noch offen

## 1. Ergebnis

Der offizielle Run `34970361170` hat den typisierten Passive-Candidate technisch erfolgreich erzeugt, gleichzeitig aber zwei Annahmen des ersten Reviewcodes widerlegt:

1. `OverrideNameTextId` ist im Current Build nicht der alleinige Namenspfad. Alle 1905 technischen Entities tragen dort `None`; für sämtliche 115 displaybaren Entities existiert stattdessen der offizielle Schlüssel `PASSIVE_<sourceRow>` in EN und DE.
2. `Rank` ist ein `IntProperty`, kein String. Der erste Candidate hatte deshalb für alle 1905 Entities einen leeren Rank-Wert ausgegeben.

Der lokale Korrekturblock behebt beide Punkte, begrenzt Gate und Resolver-Fingerprint auf den belegten user-facing Reference Space und verschärft den Review-Erfolg auf vollständige relevante Namen und einen vollständigen 102er-Overlay-Crosswalk. Der breite technische Candidate bewahrt weiterhin alle 1905 Entities.

Noch nicht erfolgt sind die erneute Ausführung des korrigierten Candidate-Schemas gegen den offiziellen Current Build, die Freigabe eines endgültigen Adapter-Keys, die Veröffentlichung eines kanonischen Passive-Reference-Space und die Implementierung eines `PassiveResolver`.

In diesem Korrekturblock erfolgten kein Push, kein PR, kein Merge, kein Deployment, kein Workflow-Dispatch und keine Cloud-, Secret- oder Provideränderung.

## 2. Verbindliche offizielle Evidenz

Der ausdrücklich zuvor freigegebene Push und Current-Build-Lauf betrafen exakt:

```text
branch: breeder/passive-resolver-discovery
commit: ac8fe06a0483b31fdc24122e82230b91f860a85d
workflow: Probe Pal Data Core
run: 34970361170
conclusion: success
Dedicated Server build: 25247047
artifact: pal-data-core-candidate-25247047
artifact id: 10397252031
artifact digest: sha256:ddfd31c24c4cbe764f573848fe0c5dee64d7ea32f5515f7d213ddacbf558aba0
```

Candidate-Doppelbuild, Passive-Review, bestehende Breeding-Regression und Artefakt-Upload liefen technisch erfolgreich. Dass das damalige Review trotz `overlayMapped = 0` grün war, war kein Extraktions- oder Workflowfehler, sondern ein zu schwaches Review-Gate in Kombination mit der falschen Namensannahme.

Die unabhängige Auswertung dieses offiziellen Artefakts belegt:

- 3810 technische Source Rows aus Main und Main_Common;
- 1905 konfliktfrei coalesced technische Entities;
- jede `sourceRow` exakt einmal pro Tabelle;
- keine Case-Kollisionen;
- 115 `EPalPassiveCategory::SortDisplayable`;
- 1790 `SortNotDisplayable`;
- `OverrideNameTextId = None` bei allen 1905 Entities;
- `PASSIVE_<sourceRow>` in EN und DE für 115/115 displaybare Entities;
- 102/102 historische Overlay-Einträge exakt bilingual zuordenbar;
- 0 fehlende und 0 mehrdeutige Overlay-Paarzuordnungen;
- 13 zusätzliche aktuelle displaybare Entities außerhalb des historischen Overlays;
- 0 englische und 1 deutsche Anzeigenamen-Ambiguität;
- `Category` als `EnumProperty`, `LotteryWeight` und `Rank` als `IntProperty`, `OverrideNameTextId` als `NameProperty`.

Diese Werte sind Artefaktevidenz aus Run `34970361170`. Sie sind noch kein Ergebnis eines erneuten Runs des lokal korrigierten Candidate-Schemas 2.

## 3. Korrigierte Namensreferenzlogik

Für jede coalesced technische Entity gilt deterministisch:

1. Ein nichtleerer expliziter `OverrideNameTextId`, der nicht `None` ist, hat Vorrang. Die Ausgabe markiert ihn als `explicit_override` und nennt `overrideNameTextId` als Quellfeld.
2. Fehlt ein solcher Override, wird der Kandidat `PASSIVE_<sourceRow>` gebildet.
3. Dieser Default wird nur dann als beobachtete Referenz akzeptiert, wenn der exakte Key in mindestens einer der eingelesenen offiziellen EN-/DE-Lokalisierungstabellen vorhanden ist. Auch ein für diesen Key erkannter Lokalisierungskonflikt zählt als vorhandene, aber anschließend blockierende Evidenz.
4. Existiert der Key nirgends, bleibt `nameReference = null`. Es wird kein Name erfunden.
5. Für displaybare Entities müssen anschließend sowohl ein konfliktfreier EN- als auch DE-Text vorhanden sein; andernfalls schlägt das Gate fehl.

Belegte Beispiele:

```text
Rare             -> PASSIVE_Rare             -> Lucky / Außergewöhnlich
MoveSpeed_up_3   -> PASSIVE_MoveSpeed_up_3   -> Swift / Blitzschnell
CraftSpeed_up3   -> PASSIVE_CraftSpeed_up3   -> Remarkable Craftsmanship / Goldenes Händchen
Legend           -> PASSIVE_Legend           -> Legend / Legendär
```

Die Referenzquelle bleibt im Reviewartefakt sichtbar. Dadurch kann ein zukünftiger echter Override die Current-Build-Default-Konvention kontrolliert übersteuern, ohne dass beide Fälle semantisch vermischt werden.

## 4. Technischer Bestand und Resolver-Domänengrenze

Der technische Candidate bleibt ein vollständiges, feldbegrenztes Audit-Artefakt über alle 1905 Entities. Er enthält Build-ID, Package-Provenienz, `sourceRow`, `sourceOrdinal`, Feldpräsenz sowie die Rohwerte `Rank`, `LotteryWeight`, `Category`, `OverrideNameTextId` und die offiziellen EN-/DE-Lokalisierungszeilen.

Der user-facing Resolver-Reference-Space umfasst dagegen nur Entities, deren exakter Category-Enum-Endwert `SortDisplayable` ist. Im belegten Build sind das 115 Entities. Die 1790 `SortNotDisplayable`-Entities bleiben im technischen Candidate erhalten, blockieren aber nicht allein wegen fehlender Usernamen das Resolver-Gate.

Diese Grenze beweist ausschließlich user-visible beziehungsweise resolver-relevante Passive-Identität. Sie beweist ausdrücklich nicht:

- Vererbbarkeit;
- Züchtbarkeit;
- Stackability;
- Effekt-, Target- oder Balance-Semantik;
- sonstige Gameplay-Legalität.

Der historische 102er-Overlay ist ein redaktioneller Regression-/Crosswalk-Beleg und keine Whitelist. Die 13 zusätzlichen aktuellen displaybaren Entities gehören daher zum offiziellen Reference-Space, obwohl sie im Overlay fehlen.

## 5. Fingerprint-Entscheidung

Die Korrektur trennt zwei unterschiedliche Änderungsgrenzen:

### `technicalCandidateSha256`

Bytegenauer SHA-256 des vollständigen technischen Candidate-Artefakts. Er reagiert unter anderem auf technische Provenienz, interne Entities, Rohfelder und Balancewerte und dient der Artefakt- und Extraktionsnachvollziehbarkeit.

### `referenceSpaceSha256`

Kanonischer SHA-256 über Candidate-Schema 2 und die ordinal sortierte Menge der displaybaren Entities mit genau:

- `sourceRow`;
- belegter Namensreferenz einschließlich ihrer Herkunft;
- offiziellem EN-Namen;
- offiziellem DE-Namen.

Ausgeschlossen sind Package-Pfade, `sourceOrdinal`, `Rank`, `LotteryWeight`, Category-Balancewerte, nicht-displaybare Entities und der historische Overlay. Damit erzeugen interne oder reine Balanceänderungen keine falsche Migration des user-facing Passive-Referenzraums. Eine Änderung der Displayable-Zugehörigkeit verändert dagegen über die enthaltene Entity-Menge den Hash.

Der Reference-Space-Hash wird nur erzeugt, wenn keine technischen oder relevanten Lokalisierungskonflikte und keine fehlenden Referenzen/EN-/DE-Namen im displaybaren Raum bestehen. Der Overlay ist ein separates Gate: Er bestimmt nicht den Hash, muss aber für ein positives Review vollständig und widerspruchsfrei mapbar sein.

Der bestehende Species-/Breeding-Snapshot und dessen Fingerprint wurden nicht verändert.

## 6. Rank- und Rohwertkorrektur

`PassiveTechnicalRow.Rank` wurde von `string` auf `int` geändert. Der Extractor verwendet `ValueReader.Int` und Candidate-Schema 2 verlangt zur Laufzeit einen Integer. Es wird keine fachliche Rank-Bedeutung interpretiert.

Weil dasselbe offizielle Inventory `LotteryWeight` als `IntProperty` ausweist, wird auch dieser Rohwert verlustfrei als Integer modelliert und validiert. Beide Balancefelder bleiben außerhalb des Resolver-Reference-Space-Hashes, sind aber weiterhin Bestandteil des technischen Candidate-Hashes.

## 7. Ambiguitäts- und Crosswalk-Verhalten

Displaynamen werden pro Sprache unabhängig indexiert. Mehrere technische Keys mit demselben Namen bleiben als echte Ambiguität erhalten; Rank, Reihenfolge, Overlay-Nummer, `sourceOrdinal` und Fuzzy Matching lösen sie nicht auf.

Belegte deutsche Ambiguität:

```text
ElementBoost_Normal_2_PAL -> Celestial Emperor -> Erleuchteter
WorldTree_Sanity          -> Hermit Sage        -> Erleuchteter
```

Ein späterer Resolver muss bei rein deutschem Exact-Input `Erleuchteter` beide Kandidaten liefern. Der historische Overlay-Crosswalk kann dennoch eindeutig sein: Er bildet die Schnittmenge der exakten EN- und DE-Treffer. Wenn diese Schnittmenge genau eine `sourceRow` enthält, ist das bilinguale Paar eindeutig, selbst wenn eine Einzelsprache mehrere Treffer hat.

Es gibt weiterhin kein Fuzzy-, Nummern-, Positions- oder Rank-basiertes autoritatives Mapping.

## 8. Verschärftes Review-Gate

`ok` ist nicht mehr nur an `sourceConflicts.length === 0` gebunden. Ein positives Review verlangt jetzt mindestens:

- keine technischen Main/Common-Inhaltskonflikte;
- keine Lokalisierungskonflikte für tatsächlich verwendete displaybare Namensreferenzen;
- eine belegte Namensreferenz für jede displaybare Entity;
- einen offiziellen EN- und DE-Namen für jede displaybare Entity;
- keine fehlenden Overlay-Zuordnungen;
- keine widersprüchlichen oder mehrfach gemeinsam passenden Overlay-Zuordnungen;
- `overlayMapped === overlayRecords`.

Nicht blockierend, aber im Bericht sichtbar sind:

- echte Ambiguitäten einer einzelnen Sprache;
- displaybare Current-Build-Entities außerhalb des historischen Overlays;
- Lokalisierungskonflikte zu Keys, die keine displaybare Entity verwendet.

Jeder Gate-Grund wird maschinenlesbar in `gateFailures` ausgegeben. Bei unvollständigem Reference Space bleibt `referenceSpaceSha256 = null`.

## 9. Erwartete Counts des nächsten offiziellen Schema-2-Runs

Auf Basis der unabhängigen Auswertung von Run `34970361170` werden beim erneuten Current-Build-Lauf erwartet:

| Zähler | Erwartet |
|---|---:|
| technische Source Rows | 3810 |
| coalesced technische Entities | 1905 |
| displaybare Entities | 115 |
| nicht-displaybare Entities | 1790 |
| technische Main/Common-Konflikte | 0 |
| displaybare Entities ohne Namensreferenz | 0 |
| displaybare Entities ohne EN | 0 |
| displaybare Entities ohne DE | 0 |
| EN-Ambiguitäten | 0 |
| DE-Ambiguitäten | 1 |
| Overlay-Einträge | 102 |
| Overlay gemappt | 102 |
| Overlay fehlend | 0 |
| Overlay mehrdeutig | 0 |
| displaybare Entities außerhalb des Overlays | 13 |

Diese Tabelle ist eine überprüfbare Erwartung, keine Behauptung, dass der korrigierte lokale Commit bereits offiziell ausgeführt wurde.

## 10. Neue und geänderte Tests

Die Passive-Review-Suite wurde von 9 auf 18 Tests erweitert. Sie deckt jetzt ab:

- deterministische Reviewausgabe;
- Main/Common-Coalescing trotz unterschiedlicher Ordinals;
- fail-closed Main/Common-Inhaltskonflikt;
- fehlendes Feld gegenüber vorhandenem Fallbackwert;
- fehlende Lokalisierung ohne erfundenen Namensschlüssel;
- belegte `PASSIVE_Rare`-Defaultregel mit `Lucky` / `Außergewöhnlich`;
- Vorrang eines expliziten Overrides;
- unresolved Default ohne offiziellen Lokalisierungsschlüssel;
- nicht blockierende unbenannte `SortNotDisplayable`-Entity;
- blockierende relevante gegenüber nur berichteten irrelevanten Lokalisierungskonflikten;
- echte EN-/DE-Namensambiguität;
- reale DE-Mehrdeutigkeit `Erleuchteter` bei eindeutigem bilingualem Paar;
- numerischen Rank und Ausschluss von Rank/Lottery aus dem Resolver-Fingerprint;
- fail-closed fehlenden Overlay-Crosswalk;
- getrennte technische, displaybare, Overlay-, Ambiguitäts- und Outside-Overlay-Counts;
- exakte bilinguale Zuordnung ohne Nummernidentität;
- Overlay-Parsing als Daten statt Codeausführung;
- Runtime-Ablehnung nichtnumerischer Rank-/Lotterywerte.

## 11. Vollständige lokale Validierung

### Pal Data Core

- `.NET SDK 10.0.401` Restore: PASS;
- Release-Build `--no-restore --warnaserror`: PASS, 0 Warnungen, 0 Fehler;
- Catalog Validation: PASS, Schema 1, 16 Tabellen, 8 Discoveries;
- Syntax `review-passive-candidate.mjs`: PASS;
- Passive-Review-Tests: PASS, 18/18;
- Syntax des bestehenden `review-breeding-candidate.mjs`: PASS.

### Breeder AI

- Lint: PASS;
- Typecheck: PASS;
- Tests: PASS, 7 Dateien, 45/45 Tests;
- Worker Dry Run: PASS, 0.26 KiB / gzip 0.21 KiB, kein Deployment;
- Secret-Scan: PASS.

Die Vitest-Workerintegration meldete in der eingeschränkten Sandbox bekannte Warnungen bei der statischen Analyse des absoluten Workerpfads; alle 45 Tests bestanden. Der Dry Run wurde mit normaler lokaler Dateisicht erfolgreich wiederholt.

### Öffentliche Breeding API / bestehende Breeding-Regression

- Frozen-Lockfile-Install: PASS;
- Generate: PASS, 299 Pals und 44850 Paare, 0 Konflikte;
- Lint: PASS;
- Typecheck: PASS;
- Tests: PASS, 5 Dateien, 73/73 Tests;
- Worker Dry Run: PASS, 2412.46 KiB / gzip 500.95 KiB, kein Deployment;
- strukturelle Validierung: PASS;
- Release-Validierung: PASS;
- Determinismus: PASS, `46c200858d2f4eb9f84c973441640632c1497bdac4fc5df55b041de6a4a77f25`;
- Secret-Scan: PASS.

### Root und Git

- `node scripts/validate-data.mjs`: PASS, 102 Passives sowie Datenstruktur, PWA-Dateien und Cache-Verweise konsistent;
- `git diff --check`: PASS.

## 12. Dateien des Korrekturblocks

Implementierung und Tests:

- `tools/pal-data-core/PalDataCore.Extractor/PassiveCandidateBuilder.cs`
- `tools/pal-data-core/PalDataCore.Extractor/PassiveCandidateModels.cs`
- `tools/pal-data-core/scripts/review-passive-candidate.mjs`
- `tools/pal-data-core/tests/review-passive-candidate.test.mjs`

Dokumentation:

- `tools/pal-data-core/README.md`
- `data/palworld-core/README.md`
- `docs/PAL_DATA_CORE_ARCHITECTURE.md`
- `docs/PAL_DATA_CORE_ROADMAP.md`
- `docs/BREEDER_AI_IMPLEMENTATION_ROADMAP.md`
- `docs/BREEDER_AI_PASSIVE_RESOLVER_DISCOVERY.md`
- `docs/BREEDER_AI_PASSIVE_RESOLVER_PHASE0_REPORT.md`
- `docs/BREEDER_AI_PHASE0_COMPLETION_REPORT.md`

Keine Raw PAKs, Raw DataTables, Mappings, Secrets oder lokalen Buildartefakte werden committet.

## 13. Vollständiger `main...HEAD`-Umfang

Der gesamte Folgebranch gegenüber `main` umfasst:

- `.github/workflows/pal-data-core-ci.yml`
- `.github/workflows/probe-pal-data-core.yml`
- `.gitignore`
- `data/palworld-core/README.md`
- `docs/BREEDER_AI_IMPLEMENTATION_ROADMAP.md`
- `docs/BREEDER_AI_PASSIVE_RESOLVER_DISCOVERY.md`
- `docs/BREEDER_AI_PASSIVE_RESOLVER_PHASE0_REPORT.md`
- `docs/BREEDER_AI_PHASE0_COMPLETION_REPORT.md`
- `docs/PAL_DATA_CORE_ARCHITECTURE.md`
- `docs/PAL_DATA_CORE_ROADMAP.md`
- `tools/pal-data-core/PalDataCore.Extractor/PassiveCandidateBuilder.cs`
- `tools/pal-data-core/PalDataCore.Extractor/PassiveCandidateModels.cs`
- `tools/pal-data-core/PalDataCore.Extractor/Program.cs`
- `tools/pal-data-core/PalDataCore.Extractor/ValueReader.cs`
- `tools/pal-data-core/README.md`
- `tools/pal-data-core/catalog.v1.json`
- `tools/pal-data-core/scripts/review-passive-candidate.mjs`
- `tools/pal-data-core/tests/review-passive-candidate.test.mjs`

Die Commitfolge ist in vier logisch getrennte Blöcke gegliedert:

1. Discovery-Katalog und offizieller erster Build-Proof (`f99a2dd`, `e4e325c`);
2. Candidate-Extraktion, ursprüngliche Reviewpipeline, CI und Handoff (`e95f856`, `2d44fa1`, `f4e60e0`, `ac8fe06`);
3. evidenzbasierte Schema-2-/Namens-/Gate-/Fingerprint-Korrektur (`d21110b`);
4. aktualisierte Abschluss- und Architektur-Dokumentation im nachfolgenden lokalen Dokumentationscommit.

Nicht verändert wurden Breeder-AI-Runtime oder Resolver, Species-Verträge, Canonical Breeding-Daten und -Regeln, öffentliche API-/MCP-Verträge, historische PWA-Daten, Cloudressourcen oder Secrets.

## 14. Architekturentscheidungen

- Technisches Audit-Artefakt und fachlicher Resolver-Reference-Space besitzen getrennte Hash-Grenzen.
- Main und Main_Common bleiben gleichrangige Evidenz; widersprüchlicher Inhalt wird nicht durch Source-Priorität verdeckt.
- Feldpräsenz bleibt Teil des technischen Vergleichs, damit „fehlend“ nicht mit einem Defaultwert gleichgesetzt wird.
- Der Default-Namensschlüssel ist eine durch offizielle Lokalisierung belegte Konvention, keine frei erfundene Ableitung.
- `SortDisplayable` begrenzt nur die user-facing Identitätsdomäne; Gameplay-Semantik bleibt offen.
- Einzelsprachen-Ambiguitäten sind korrekte Domain-Wahrheit und werden nicht heuristisch aufgelöst.
- Der historische Overlay prüft Rückwärtszuordnung, definiert aber weder Identität noch Vollständigkeit aktueller Game Truth.
- Ein endgültiger namespaceter `sourceRow`-Adapter-Key wird erst nach erneutem offiziellen Schema-2-Artefaktreview entschieden.

## 15. Verbleibende Risiken und offene Gates

1. Der korrigierte lokale Commit wurde noch nicht im offiziellen Dedicated-Server-Workflow ausgeführt. Die erwarteten Counts und der neue Reference-Space-Hash müssen durch ein neues Artefakt bestätigt werden.
2. `sourceRow` ist der stärkste technische Kandidat, aber noch kein freigegebener dauerhafter `passive_id`-Contract.
3. Ein zukünftiger Build kann echte Overrides, neue Categories, Lokalisierungsänderungen, neue Ambiguitäten oder Entity-Zugänge/-Abgänge einführen; das Gate muss diese als neue Evidenz sichtbar machen.
4. `SortDisplayable` beweist keine Breeding-Eligibility oder Effect-Semantik. Dafür fehlt weiterhin ein autoritatives Domain-Artefakt.
5. Der historische Overlay deckt nur 102 der 115 aktuellen displaybaren Entities ab und darf nicht zur Whitelist werden.
6. Ein später persistierter Passive-Verweis muss an den freigegebenen Passive-Dataset-/Reference-Space-Fingerprint gebunden sein; fremde Dataset-Stände müssen explizite Migrationsfälle bleiben.
7. Der `PassiveResolver`, seine Exact-/Ambiguous-/Fuzzy-Candidate-Tests und sein Persistenz-/Migrationsverhalten bleiben bewusst unimplementiert.
8. Die bereits dokumentierten externen Phase-0-Gates für reale Auth/JWKS/OTP, Multi-Device, Remote D1, Provider und Betriebstopologie bleiben offen.

## 16. Nächster zulässiger Schritt

Nach unabhängiger Review und nur mit neuer ausdrücklicher Freigabe:

1. den bestehenden Branch pushen;
2. `Probe Pal Data Core` auf dem exakten korrigierten Commit ausführen;
3. Candidate, Reviewbericht, Summary, Hashes und alle erwarteten Counts aus dem neuen Artefakt prüfen;
4. `sourceRow` entweder als datasetgebundenen namespaceten Adapter-Key bestätigen oder die Abweichung dokumentieren;
5. erst danach über kanonische Veröffentlichung, `PassiveResolver` und Persistenzmigration entscheiden.

## Review-Stop

Die lokale Korrekturarbeit endet an diesem Punkt. Phase 1 bleibt gesperrt. Ohne neue ausdrückliche Freigabe erfolgen keine weiteren Repository- oder Remoteaktionen.
