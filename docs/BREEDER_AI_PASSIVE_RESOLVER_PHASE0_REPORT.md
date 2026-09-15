# Breeder AI – Phase-0 Passive Resolver / Candidate Crosswalk Abschlussbericht

**Berichtsstand:** 15. September 2026

**Ergebnis:** Die lokale, reviewbare Candidate-/Crosswalk-Pipeline ist implementiert und alle lokal ausführbaren Gates sind grün. Das fachliche Phase-0-Gate ist noch **nicht geschlossen**, weil der neue Code ohne Push nicht im offiziellen `Probe Pal Data Core` gegen den Dedicated Server ausgeführt werden kann. Deshalb wurden weder ein endgültiger Passive-Adapter-Key noch kanonische Passive-Daten oder ein `PassiveResolver` vorweggenommen.

**Nicht erfolgt:** Push, neuer Remote-Branch, Pull Request, Merge, Deployment, Workflow-Dispatch, Cloud-/Secret-/Provideränderung oder Phase-1-Arbeit.

## 1. Lokaler Branch und HEAD

- Repository: `MC-Micro/pal-tool`
- Arbeitsverzeichnis: `C:\Users\Micro\Documents\GitHub\pal-tool-phase0`
- Branch: `breeder/passive-resolver-discovery`
- Tracking: `origin/breeder/passive-resolver-discovery`
- Ausgangs-HEAD: `e4e325c1a0c201c1e804c23c294b2364286d764f`
- Merge-Base sowie lokales/remote `main`: `b3e4daabeb4a6bbc3f132393d0898b0b3e45cea3`
- Implementierungs-/Dokumentations-HEAD vor Hinzufügen dieses selbstreferenziell nicht hashbaren Berichts: `2d44fa1`

Der exakte Abschluss-HEAD einschließlich dieses Berichts ist aus `git log main..HEAD` zu lesen. Der Working Tree war zu Beginn sauber; fremde Änderungen wurden nicht gefunden oder verworfen.

## 2. Lokale Commits

Im aktuellen Auftrag neu erstellt:

1. `e95f856 feat(data-core): add passive identity candidate gate`
2. `2d44fa1 docs(breeder-ai): record passive candidate review stop`
3. Bericht-Commit: der nach `2d44fa1` folgende lokale Commit, der ausschließlich diese Datei aufnimmt

Bereits auf dem vorbereiteten Branch vorhanden und ebenfalls Teil von `main..HEAD`:

1. `f99a2dd chore(data-core): discover passive resolver sources`
2. `e4e325c docs(breeder-ai): record passive resolver discovery`

## 3. Vollständige Liste geänderter Dateien

Gegen `main` umfasst der Branch diese Dateien:

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

Keine Raw PAKs, Raw DataTables, Mappings, Secrets oder generierten lokalen Build-Verzeichnisse werden versioniert.

## 4. Technische Zusammenfassung

Der Data-Core-Katalog enthält jetzt kontrolliert:

- `DT_PassiveSkill_Main`;
- `DT_PassiveSkill_Main_Common`;
- EN `DT_SkillNameText_Common`;
- DE `DT_SkillNameText_Common`.

Der neue Befehl `passive-candidate` erzeugt einen feldbegrenzten technischen Candidate mit Build-ID, Package-Provenienz, `sourceRow`, `sourceOrdinal`, Feldpräsenz, rohem `Rank`, `LotteryWeight`, `Category`, `OverrideNameTextId` und den offiziellen EN-/DE-Lokalisierungszeilen. Jede konfigurierte Quelle ist für diesen Befehl zwingend; fehlende oder nicht parsebare Quellen brechen ab.

Der read-only Review-Schritt:

- coalesced Main/Common anhand gleicher `sourceRow`;
- ignoriert `sourceOrdinal` bei der Inhaltsidentität, bewahrt es aber als Provenienz;
- erkennt auch den Unterschied zwischen einem fehlenden Feld und demselben Fallbackwert;
- blockiert widersprüchliche Main/Common- oder Lokalisierungsinhalte;
- folgt ausschließlich einem expliziten `OverrideNameTextId`;
- erfindet keinen Namensschlüssel;
- weist fehlende und mehrdeutige offizielle Namen aus;
- prüft den historischen Overlay ohne Ausführung seiner JavaScript-Datei als Code;
- mappt Overlay-Einträge nur bei übereinstimmenden exakten EN- und DE-Treffern.

Der offizielle Workflow baut Candidate und Summary zweimal bytegenau, lädt den normalisierten Bericht auch bei einem erkannten Review-Konflikt hoch und markiert erst danach den Job fail-closed.

## 5. Tatsächlich bewiesene Passive-Identität

Noch ist **keine endgültige dauerhafte Passive-Identität bewiesen**.

Bewiesen ist lokal nur, dass die Pipeline `sourceRow` als technischen Identitätskandidaten reproduzierbar extrahieren, Main/Common-Wiederholungen zusammenführen und Widersprüche offenhalten kann. Die offizielle Discovery macht RowName/`sourceRow` zum stärksten Kandidaten, aber der bisherige offizielle Run enthält noch keine typisierten Row-Werte aus der neuen Projektion.

Der Namespace `palworld.passive.source_row` bleibt daher im Reviewbericht ausdrücklich `candidateNamespace`. Er wird nicht als freigegebener Contract oder `passive_id` verwendet.

## 6. Dataset-/Fingerprint-Entscheidung

Die Passive-Domäne verändert den bestehenden Species-/Breeding-Snapshot und dessen Fingerprint nicht.

Die Pipeline trennt zwei Passive-Hashes:

1. `technicalCandidateSha256`: bytegenauer Hash des vollständigen feldbegrenzten Candidates einschließlich technischer Provenienz;
2. `referenceSpaceSha256`: kanonischer Hash der coalesced Entities, Referenzfelder und EN-/DE-Namen ohne Package-Pfad und `sourceOrdinal`.

Damit bleibt die Artefakt-Reproduzierbarkeit prüfbar, während reine Tabellenreihenfolge keine falsche Änderung des fachlichen Referenzraums erzeugt. Bei Quellkonflikten wird kein `referenceSpaceSha256` freigegeben. Ein später persistierter Passive-Verweis muss Build-/Dataset-Referenz und Reference-Space-Hash tragen; ein fremder Dataset-Stand muss explizit als Migration behandelt werden.

## 7. Crosswalk-Ergebnis

Die Crosswalk-Logik ist implementiert und synthetisch getestet. Ein reales Current-Build-Crosswalk-Ergebnis liegt noch nicht vor, weil der neue Candidate erst durch einen künftigen offiziellen Run erzeugt werden kann.

Die Pipeline wird im Artefakt für jede technische Entity ausweisen:

- `sourceRow` und alle Package-/Ordinal-Provenienzen;
- die explizite Namensreferenz;
- EN-/DE-Namen oder deren Fehlen;
- Main/Common- und Lokalisierungskonflikte;
- exakte Namensmehrdeutigkeiten;
- Overlay-Zuordnungsstatus.

## 8. Anzahl eindeutiger, fehlender und mehrdeutiger Zuordnungen

Für den echten Build sind diese Zahlen noch **nicht belegt** und werden daher nicht geschätzt:

- eindeutige technische EN-/DE-Zuordnungen: offen;
- fehlende `OverrideNameTextId`: offen;
- fehlende EN-Lokalisierungen: offen;
- fehlende DE-Lokalisierungen: offen;
- mehrdeutige offizielle Anzeigenamen: offen;
- Main/Common-Konflikte: offen.

Der neue Reviewbericht erzeugt alle Zähler deterministisch. Lokale Fixtures dienen nur dem Algorithmusbeweis und werden nicht als Game Truth berichtet.

## 9. Historischer 102-Passive-Overlay-Crosswalk

Root-Validierung bestätigt weiterhin 102 strukturell konsistente Overlay-Einträge. Reale Crosswalk-Zahlen werden nicht behauptet, solange das offizielle Passive-Candidate-Artefakt fehlt.

Die Mappingregel ist absichtlich streng: Nur wenn der exakte englische und der exakte deutsche offizielle Name jeweils eindeutig auf dieselbe `sourceRow` zeigen, wird ein Overlay-Eintrag als gemappt ausgewiesen. Einseitige, widersprüchliche, mehrdeutige oder nur ähnliche Treffer bleiben fehlend beziehungsweise mehrdeutig. `nr`, Arrayposition, Rank und `sourceOrdinal` werden nie als Identität verwendet.

## 10. Resolver-Verhalten

Ein Breeder-AI-`PassiveResolver` wurde bewusst **nicht implementiert**. Ohne reviewtes kanonisches Reference-Space-Artefakt wären Key, Dataset und Aliasmenge nur plausibel angenommen.

Nach positivem Current-Build-Review muss der Resolver mindestens exakt technischen Key, DE, EN, echte Ambiguität, sichere Fuzzy-Kandidaten, `not_found`, Dataset-Mismatch, unbekannten persistierten Key, keine stille Fuzzy-Migration und deterministische Kandidatenreihenfolge testen. Fuzzy-Ergebnisse dürfen niemals autoritativ persistieren oder migrieren.

## 11. Architekturverbesserungen gegenüber dem bisherigen Entwurf

- Passive Candidate bleibt von `CoreTechnicalSnapshot` getrennt; Passive-Änderungen invalidieren Species/Breeding nicht.
- Technischer Artefakt-Hash und fachlicher Reference-Space-Hash sind getrennt.
- Feldpräsenz verhindert das stille Gleichsetzen „fehlend“ mit einem Defaultwert.
- Main/Common-Inhalte werden symmetrisch geprüft; keine Source-Priorität versteckt Konflikte.
- Overlay-Crosswalk ist eine separate redaktionelle Reviewebene und keine Game-Truth-Quelle.
- Der Workflow lädt Konfliktbeweise hoch, bevor er den Gate-Job fehlschlagen lässt.
- Keine gemeinsame Resolver-Abstraktion wurde vorzeitig eingeführt, weil noch kein zweiter autoritativer Resolver existiert.

## 12. Tests und Ergebnisse

### Pal Data Core

- temporäres offizielles .NET SDK: `10.0.401`;
- `dotnet restore`: PASS;
- `dotnet build --configuration Release --no-restore --warnaserror`: PASS, 0 Warnungen, 0 Fehler;
- `validate-catalog`: PASS, Schema 1, 16 Tabellen, 8 Discoveries;
- `node --check review-passive-candidate.mjs`: PASS;
- `node --test review-passive-candidate.test.mjs`: PASS, 9/9.

Die 9 Tests decken deterministische Reviewausgabe, Main/Common-Coalescing mit unterschiedlichen Ordinals, Inhaltskonflikt, fehlendes Feld versus Fallbackwert, fehlende EN/DE-Lokalisierung, nicht erfundene Namensreferenz, echte Anzeigenamen-Ambiguität, exakten bilingualen Overlay-Crosswalk ohne Nummernidentität, sichere Overlay-Datenparsing-Grenze und Runtime-Ablehnung eines falschen Candidate-Datentyps ab.

### Breeder AI

- `pnpm lint`: PASS;
- `pnpm typecheck`: PASS;
- `pnpm test`: PASS, 45/45;
- `pnpm build:worker`: PASS, Dry Run, 0.26 KiB / gzip 0.21 KiB;
- `pnpm scan:secrets`: PASS.

Der erste sandboxgebundene Worker-Build konnte den absoluten Workerpfad nicht lesen; der unmittelbar wiederholte rein lokale Dry Run mit normaler Dateisicht war erfolgreich. Es erfolgte kein Deployment.

### Root

- `node scripts/validate-data.mjs`: PASS, 102 Passives sowie PWA-/Cache-Verweise konsistent;
- `git diff --check`: PASS.

## 13. Current-Build-Probe und Artefakt

Schreibgeschützt über die öffentliche GitHub API bestätigt:

- Workflow: `Probe Pal Data Core`;
- Run: `34960294929`;
- Status/Conclusion: `completed` / `success`;
- Branch: `breeder/passive-resolver-discovery`;
- Run-HEAD: `f99a2ddf373f641faf42c5907d5a414782b14c8e`;
- Event: `push`;
- Dedicated-Server-Build: `25247047`;
- Artefakt: `pal-data-core-candidate-25247047`;
- Artefakt-ID: `10393031508`;
- Größe: 120595 Bytes;
- Digest: `sha256:0f17fce6fee67a2f7f6c2822cf63ba0d17dea13a25124a843b5e0ab5c9c291ff`;
- Ablaufdatum: 29. September 2026.

Dieser Run liegt vor Commit `e95f856` und beweist daher Discovery, Felder sowie die unveränderte grüne Breeding-Review, aber nicht die neue Passive-Row-Projektion. Der anonyme Artefakt-Download wurde von GitHub mit 401 abgelehnt; lokal gespeicherte Credentials wurden nicht ausgelesen oder umgangen.

Kein neuer Run wurde ausgelöst: Ohne Push könnte der Remote-Runner den lokalen Code nicht ausführen, und Push/Workflow-Dispatch/Cloudänderungen waren ausdrücklich untersagt.

## 14. Regressionsergebnisse

### Species / bestehende Phase 0

- alle 7 Breeder-AI-Testdateien grün;
- 45/45 Tests grün, einschließlich Species-Dataset-/Migrationstests;
- Lint und Typecheck grün.

### Öffentliche Breeding API

- Frozen-Lockfile-Install: PASS;
- Generate: PASS, 299 Pals, 44850 Paare, 0 Konflikte;
- Lint: PASS;
- Typecheck: PASS;
- Tests: PASS, 73/73;
- Worker Dry Run: PASS, kein Deployment;
- strukturelle Validierung: PASS;
- Release-Validierung: PASS;
- Determinismus: PASS, `46c200858d2f4eb9f84c973441640632c1497bdac4fc5df55b041de6a4a77f25`;
- Secret-Scan: PASS.

Auch hier scheiterte nur der erste Worker-Versuch an der Sandbox-Dateisicht; die identische lokale Wiederholung mit normaler Dateisicht war grün.

## 15. Verbleibende offene Phase-0-Gates

1. ausdrückliche Freigabe zum Pushen des bestehenden `breeder/**`-Branches;
2. offizieller `Probe Pal Data Core` auf dem exakten Implementierungs-Commit;
3. Download und fachliche Auswertung von `passive-candidate-a.json`, Summary und Reviewbericht;
4. Entscheidung, ob `sourceRow` im geprüften Dataset konfliktfrei und als Phase-0-Adapter-Key ausreichend ist;
5. reale Zähler für technische Entities, Lokalisierung, Ambiguitäten und 102-Overlay-Crosswalk;
6. review-gated Veröffentlichung eines kanonischen Passive-Reference-Space-Artefakts;
7. erst danach Passive-Referenzschema und `PassiveResolver` samt Persistenz-/Migrationsfällen;
8. die bereits zuvor offenen externen Auth-/JWKS-/Multi-Device-/Remote-D1-/Provider-/Betriebstopologie-Gates.

Phase 1 bleibt gesperrt.

## 16. Risiken und Punkte für unabhängigen Review

- `OverrideNameTextId` könnte bei einem Teil der 1905 Main-Zeilen leer sein; der Review erfindet absichtlich keinen Fallback. Die reale Namensreferenzregel muss am Artefakt geprüft werden.
- Main_Common könnte Ergänzungs- statt Duplikatsemantik besitzen. Der symmetrische Konfliktbericht bewahrt diese Evidenz, löst sie aber nicht durch eine unbelegte Priorität auf.
- Die 1905 technischen Zeilen können interne, unbenannte oder nicht produktrelevante Einträge enthalten. Ein Produktfilter darf erst nach belegbarer Klassifikation entstehen.
- Exakte offizielle Anzeigenamen können mehrfach vorkommen; das ist kein Identity-Konflikt, muss im Resolver aber als Ambiguität erhalten bleiben.
- Der bilinguale Overlay-Crosswalk ist bewusst konservativ und kann historische Umbenennungen als fehlend melden. Solche Fälle brauchen manuelle, belegte Review statt Fuzzy-Zuordnung.
- `sourceRow` ist erst innerhalb eines offiziell geprüften Reference Space verwendbar; Cross-Build-Migration bleibt explizit.
- Der technische Candidate enthält feldbegrenzte normalisierte Game Truth, aber keine Wirkungsauslegung. Effect-/Target-/Stack-Semantik bleibt außerhalb dieses Gates.

## 17. Vollständiger `main...HEAD`-Diff-Überblick

Der Branch besteht aus vier logisch getrennten Blöcken:

1. Discovery-Katalogerweiterung und dokumentierter offizieller Build-Proof (`f99a2dd`, `e4e325c`);
2. typisierte Passive-Candidate-Extraktion, Reviewlogik, Tests, CI und offizieller Probe-Workflow (`e95f856`);
3. aktualisierte Breeder-/Data-Core-Roadmaps, Architektur- und Review-Stop-Dokumentation (`2d44fa1`);
4. dieser detaillierte Handoff-Bericht.

Nicht verändert wurden Breeder-AI-Runtime/Resolvercode, Species-Verträge, Breeding-Regeln oder -Daten, öffentliche Breeding-API-/MCP-Verträge, historische PWA-Daten, Cloudkonfigurationen und Secrets.

## Review-Stop

Die lokale Arbeit endet hier. Der nächste Schritt ist ein unabhängiger Review. Ohne neue ausdrückliche Freigabe erfolgen keine weiteren Repository- oder Remoteaktionen.
