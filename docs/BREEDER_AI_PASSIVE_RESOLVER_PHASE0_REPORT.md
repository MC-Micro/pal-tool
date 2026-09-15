# Breeder AI – Phase-0 Passive Reference/Resolver Abschlussbericht

**Berichtsstand:** 15. September 2026

**Repository:** `MC-Micro/pal-tool`

**Lokaler Branch:** `breeder/passive-resolver-discovery`

**Review-Basis:** Branch-HEAD `e28b6148f47ec2179f63de8c104664be8f31df73`

**Status:** Technischer Passive-Identity-/Resolver-Block einschließlich der zwei begrenzten unabhängigen Review-Fixes lokal abgeschlossen; erneuter Review-Stop; kein Phase-1-Start

## 1. Ergebnis

Der Phase-0-Block für Passive Reference Space, dauerhafte PassiveReference und PassiveResolver ist lokal vollständig umgesetzt und validiert.

Ergebnis in Kurzform:

- das vollständige offiziell bestätigte Schema-2-Artefakt wurde als alleinige fachliche Eingabe verwendet;
- genau 115 `SortDisplayable`-Entities wurden als minimaler kanonischer Reference Space veröffentlicht;
- der freigegebene Adapter-Key ist `{ namespace: "palworld.passive.source_row", value: sourceRow }`;
- persistierte Passive-Referenzen tragen zusätzlich Schema 1 und den Reference-Space-SHA-256;
- ein anderer Reference-Space-Hash ergibt ausdrücklich `migration_required`;
- exakte EN-/DE-Namen werden nur eindeutig autoritativ aufgelöst;
- die reale deutsche Ambiguität `Erleuchteter` bleibt erhalten;
- Fuzzy-Treffer sind ausschließlich nichtautoritative Kandidaten und werden nie automatisch persistiert oder migriert;
- die 1790 nicht-displaybaren technischen Entities bleiben außerhalb des Resolver-Reference-Space;
- `data-passives.js` bleibt ein getrennter historischer 102er Produkt-Overlay und keine Identitätsquelle;
- es wurde keine numerische `passive_id`, PWA-Nummer, Arrayposition, Rank-, Ordinal- oder Generator-ID eingeführt.
- die schnellen Data-Core- und Breeder-AI-CI-Workflows reagieren jetzt vollständig auf kanonische Passive-Daten; der aktuelle `breeder/**`-Branch ist als Push-Quelle abgedeckt;
- Unicode-kanonisch äquivalente deutsche Eingaben werden vor Transliteration und Match nach NFC vereinheitlicht.

Es trat kein Klasse-C-Konflikt auf. Die bestehenden Sicherheits-, Persistenz-, Tenant-, Repository- und Data-Core-Invarianten mussten nicht gelockert werden.

## 2. Verwendete offizielle Evidenz

Verwendet wurde ausschließlich die lokale Kopie unter:

```text
LOCAL_ARTIFACTS/artifacts/schema2-25247047/
```

Die lokale Kopie bleibt durch `.git/info/exclude` ausgeschlossen und ist nicht Bestandteil eines Commits.

Provenienz:

| Feld | Wert |
| --- | --- |
| Workflow | `Probe Pal Data Core` |
| Run | `34975314764` |
| Artifact ID | `10399160981` |
| Artifact | `pal-data-core-candidate-25247047` |
| Branch-HEAD | `e28b6148f47ec2179f63de8c104664be8f31df73` |
| Dedicated-Server-Build | `25247047` |
| GitHub-Artifact-Digest | `sha256:1bd93cb80144833315dc7d6d6232f31fc57bb00cb11e317081ea34ee2a7ae63c` |
| `passive-candidate-a.json` SHA-256 | `06ae40a0aafd4aa6da69841f526ac291eb82d5c91f70b118d0bdafda26540b5b` |
| `passive-review.json` SHA-256 | `99fee598a0de3681cdc084edbeb31812beeabd780b52814c056a7d006ac0150a` |
| Passive Reference-Space SHA-256 | `5050fc82e7b14dad5ebb06de6aa3f5fbafbd8d168aae525b4b4fa05214efeb4b` |

Bestätigte Review-Zählwerte:

| Bereich | Anzahl |
| --- | ---: |
| technische Main/Common Source Rows | 3810 |
| konfliktfrei coalesced technische Entities | 1905 |
| `SortDisplayable` | 115 |
| `SortNotDisplayable` | 1790 |
| historische Overlay-Einträge | 102 |
| eindeutig bilingual gemappt | 102 |
| aktuelle displaybare Entities außerhalb des Overlays | 13 |
| englische Namensambiguitäten | 0 |
| deutsche Namensambiguitäten | 1 |
| relevante technische/Lokalisierungskonflikte | 0 |

`passive-review.json` besitzt keine Gate-Fehler und meldet `ok: true`. Es wurden ausdrücklich keine 115 Einträge aus Dokumentation, Diffs oder Erinnerungswissen rekonstruiert.

## 3. Kanonische Publikationsgrenze

Die kanonische Datei ist `data/palworld-core/passives.json`. Sie enthält ausschließlich:

- `sourceRow`;
- die belegte Namensreferenz;
- den offiziellen englischen Anzeigenamen;
- den offiziellen deutschen Anzeigenamen;
- die datasetweite Reference-Space-Identität und getrennte technische Provenienz.

Nicht enthalten sind `Rank`, `LotteryWeight`, Category-Balancewerte, Package-Pfade, `sourceOrdinal`, technische Rohzeilen oder PWA-Bewertungen.

`data/palworld-core/passives.approval.json` ist die explizite Freigabegrenze. Sie bindet die Publikation an Review-Schema, Steam-Build, technischen Candidate-Hash, Reference-Space-Hash, Repository, Workflow, Run, Commit, Artifact ID, Artifact-Digest und alle erwarteten Zählwerte.

`publish-passive-reference.mjs` veröffentlicht nicht automatisch aus einem Workflow-Lauf. Der Aufruf verlangt Review, Approval und einen neuen Ausgabeweg. Er bricht fail-closed ab bei:

- nicht erfolgreichem Review oder nichtleeren Gate-Fehlern;
- abweichendem Schema, Build, Hash, Provenienz- oder Zählwert;
- manipuliertem Reference Space;
- unbekannten oder zusätzlichen Entity-Feldern;
- fehlenden Namen oder ungültigen Namensreferenzen;
- doppelten oder case-kollidierenden `sourceRow`-Werten;
- nicht deterministischer beziehungsweise nicht ordinal sortierter Ausgabe;
- einem bereits vorhandenen Zielpfad.

Root-Validierung und Data-Core-Tests reproduzieren den Reference-Space-Hash und vergleichen die eingecheckte Publikation erneut mit der Approval-Datei.

## 4. Dauerhafte PassiveReference

Der Phase-0-Vertrag lautet:

```text
adapterKey.namespace = palworld.passive.source_row
adapterKey.value     = sourceRow
dataset.schemaVersion = 1
dataset.referenceSpaceSha256 = 5050fc82e7b14dad5ebb06de6aa3f5fbafbd8d168aae525b4b4fa05214efeb4b
```

Steam-Build, technischer Candidate-Hash und GitHub-Artefaktmetadaten bleiben nachvollziehbare Provenienz im kanonischen Artefakt. Sie werden bewusst nicht zusätzlich in jede persistierte Referenz kopiert. Die persistierte Dataset-Identität ist der fachlich engere Reference-Space-Hash.

Folge: Ein künftiger Steam-Build mit identischem relevantem Reference Space bleibt dasselbe Dataset. Ein abweichender Reference-Space-Hash ist immer ein expliziter Migrationsfall, selbst wenn der alte `sourceRow` im neuen Raum zufällig noch vorhanden ist. Es gibt keine automatische Namens-, Fuzzy-, Positions- oder Nummernmigration.

## 5. Resolververhalten

Der `PassiveResolver` importiert das kanonische Repository-Artefakt direkt und validiert dessen Runtime-Schema strikt.

Autoritativ auflösbar sind:

- ein exakter namespaceter Adapter-Key;
- ein exakter veröffentlichter `sourceRow`;
- ein eindeutiger exakter englischer Anzeigename;
- ein eindeutiger exakter deutscher Anzeigename.

Nicht autoritativ:

- Fuzzy-Treffer werden als sortierte `candidates` zurückgegeben;
- ein unbekannter serialisierter technischer Key wird nicht fuzzy weiterinterpretiert;
- nicht-displaybare technische Entities werden nicht indexiert;
- eine echte Namensmehrdeutigkeit bleibt `ambiguous`.

Die Normalisierung vereinheitlicht Eingaben zuerst nach NFC, transliteriert danach explizit `ä/ö/ü/ß`, entfernt anschließend verbleibende kombinierende Zeichen und normalisiert Groß-/Kleinschreibung ohne Locale-Heuristik. Damit ergeben vorkomponierte und kanonisch äquivalente NFD-Eingaben denselben Resolverwert. Die Kandidatensortierung verwendet einen ordinalen Vergleich und keine implizite Locale-Sortierung.

Die belegte Ambiguität bleibt exakt:

| Eingabe | Kandidat 1 | Kandidat 2 |
| --- | --- | --- |
| `Erleuchteter` | `ElementBoost_Normal_2_PAL` / `Celestial Emperor` | `WorldTree_Sanity` / `Hermit Sage` |

## 6. Persistenz- und Migrationsverhalten

`resolvePersisted` prüft in dieser Reihenfolge:

1. striktes Runtime-Schema der persistierten Referenz;
2. Gleichheit von Dataset-Schema und Reference-Space-Hash;
3. Existenz des exakten Adapter-Keys im aktuellen 115er Raum.

Ein gültiger fremder Dataset-Stand liefert vor jeder Key-Neuzuordnung `migration_required`. Ein unbekannter Key im aktuellen Dataset liefert `unknown_key`. Ein Anzeigename an Stelle des `sourceRow` wird nicht als Key akzeptiert. Damit kann ein fremder oder veralteter State nicht stillschweigend als aktuelle Identität erscheinen.

Es gibt in Phase 0 noch keine Passive-Mutation im minimalen Inventory-Aggregat. Der neue Vertrag führt deshalb keine vorgezogene Phase-1-State-Struktur ein; er stellt die überprüfbare Referenz- und Migrationsgrenze bereit, die spätere Passive-State-Felder zwingend verwenden müssen.

## 7. Architekturentscheidungen

### Klasse A

- eigenständiges Runtime-Schema und eigener Resolver im Breeder-AI-Package;
- deterministische ordinale Sortierung;
- Fuzzy-Threshold und Levenshtein-Implementierung als lokales Spike-Detail;
- explizite Approval-Datei und nichtautomatischer Publisher;
- getrennte fokussierte Commits für Publikationsgrenze, kanonische Daten und Resolver.

### Klasse B

- `sourceRow` wird nach positiver offizieller Schema-2-Evidenz als namespaceter Adapter-Key freigegeben;
- Reference-Space-Hash ist die primäre persistierte Passive-Dataset-Identität;
- Steam-Build und technischer Candidate-Hash bleiben Provenienz;
- `SortDisplayable` begrenzt den user-facing Identity-Reference-Space, ohne Effect- oder Vererbungssemantik zu behaupten;
- SpeciesResolver und PassiveResolver bleiben getrennt, da Aliasquellen, Datasetgrenzen und Domänensemantik verschieden sind. Eine vorzeitige gemeinsame Abstraktion hätte keine zusätzliche Invariante bewiesen.

### Klasse C

Kein Konflikt. Keine bindende Sicherheits-, Tenant-, Auth-, Persistenz-, Canonical-Data- oder Deploymentgrenze wurde geändert.

## 8. Neue und geänderte Tests

Data Core:

- deterministische minimale Publikation;
- Ablehnung eines erfolglosen Reviews;
- Ablehnung abweichender Provenienz und Zählwerte;
- Erkennung eines manipulierten Reference Space;
- Ablehnung unbekannter Semantikfelder;
- Ablehnung von Duplikaten und Case-Kollisionen;
- Post-Publication-Tamper-Erkennung;
- Validierung des eingecheckten 115er Artefakts gegen Approval;
- struktureller Ausschluss technischer Balancefelder;
- Beleg aller 13 Entities außerhalb des historischen Overlays;
- Erhalt der realen `Erleuchteter`-Ambiguität.

Breeder AI:

- aktueller 115er Count, Reference-Space-Hash und Provenienz;
- Current-Build-Beispiele `Lucky`/`Rare` und `Blitzschnell`/`MoveSpeed_up_3`;
- reale `Erleuchteter`-Ambiguität;
- exakte namespacete und rohe `sourceRow`-Auflösung;
- Ausschluss der realen nicht-displaybaren Entity `ATK_up_PartnerSkill_1`;
- eindeutige EN-/DE-Auflösung und Normalisierung;
- Fuzzy nur als Kandidat;
- unbekannter technischer Key ohne Fuzzy-Migration;
- aktueller persistierter Key;
- unbekannter Key und falscher Datentyp;
- fremder Reference-Space-Hash vor Keyprüfung als `migration_required`;
- anderer Steam-Build bei identischem Reference Space ohne Scheinemigration;
- Ablehnung unsortierter, duplizierter, case-kollidierender oder malformed Artefakte;
- Konsistenz von Steam-Build und Artifact-Name an der Runtime-Schema-Grenze.
- identische autoritative Auflösung von `Außergewöhnlich` in NFC- und NFD-Darstellung.

## 9. Vollständige Validierung

Alle Abschlussprüfungen liefen am 15. September 2026 lokal erfolgreich.

| Prüfung | Ergebnis |
| --- | --- |
| Data Core `dotnet restore --locked-mode` | PASS |
| Data Core Release-Build `--warnaserror` | PASS, 0 Warnungen, 0 Fehler |
| Data-Core-Katalog | PASS, Schema 1, 16 Tabellen, 8 Discoveries |
| Syntax der drei Review-/Publisher-Skripte | PASS |
| Data-Core-Node-Tests | PASS, 29/29 |
| Workflow-Trigger-Semantik | PASS, `breeder/**`, Canonical-Path in Push/PR und Overlay-Regression abgedeckt |
| offizielles lokales `breeding-review.json` | PASS, `ok: true`, 299 Species, 136/136 Specials |
| Breeding API Frozen Install | PASS |
| Breeding API Generate | PASS, 299 Pals, 44850 Paare |
| Breeding API Lint | PASS |
| Breeding API Typecheck | PASS |
| Breeding API Tests | PASS, 73/73 |
| Breeding API Worker-Dry-Run | PASS, kein Deployment |
| Breeding API Structural Validation | PASS |
| Breeding API Release Validation | PASS |
| Breeding API Determinismus | PASS, `46c200858d2f4eb9f84c973441640632c1497bdac4fc5df55b041de6a4a77f25` |
| Breeding API Secret-Scan | PASS |
| Breeder AI Frozen Install | PASS |
| Breeder AI Lint | PASS |
| Breeder AI Typecheck | PASS |
| Breeder AI vollständige Tests | PASS, 58/58 in 8 Dateien |
| Breeder AI Worker-Dry-Run | PASS, 503-only Spike-Bundle, kein Deployment |
| Breeder AI Secret-Scan | PASS |
| Root `node scripts/validate-data.mjs` | PASS, 115er Canonical Reference Space und 102er PWA-Overlay |
| `git diff --check` | PASS |

Der erste Wrangler-Aufruf innerhalb der Dateisandbox konnte außerhalb des Workspace weder lesen noch ein Wrangler-Log schreiben. Derselbe fest konfigurierte `--dry-run` bestand anschließend mit der dafür vorgesehenen lokalen Berechtigung. Dies war eine Sandboxgrenze, kein Code- oder Buildfehler.

## 10. Exakt geänderte Dateien dieses Abschlussblocks

- `.github/workflows/pal-data-core-ci.yml`
- `.github/workflows/breeder-ai-ci.yml`
- `README.md`
- `apps/breeder-ai/README.md`
- `apps/breeder-ai/src/domain/passive-reference.ts`
- `apps/breeder-ai/src/resolver/passive-resolver.ts`
- `apps/breeder-ai/test/passive-resolver.test.ts`
- `data/palworld-core/README.md`
- `data/palworld-core/passives.approval.json`
- `data/palworld-core/passives.json`
- `docs/BREEDER_AI_CURRENT_BLUEPRINT.md`
- `docs/BREEDER_AI_IMPLEMENTATION_ROADMAP.md`
- `docs/BREEDER_AI_PHASE0_COMPLETION_REPORT.md`
- `docs/BREEDER_AI_PASSIVE_RESOLVER_PHASE0_REPORT.md`
- `docs/PAL_DATA_CORE_ARCHITECTURE.md`
- `docs/PAL_DATA_CORE_ROADMAP.md`
- `scripts/validate-data.mjs`
- `tools/pal-data-core/README.md`
- `tools/pal-data-core/scripts/publish-passive-reference.mjs`
- `tools/pal-data-core/scripts/review-passive-candidate.mjs`
- `tools/pal-data-core/tests/publish-passive-reference.test.mjs`
- `tools/pal-data-core/tests/published-passive-reference.test.mjs`

`LOCAL_ARTIFACTS/` ist nicht getrackt und nicht committed.

## 11. Lokale fokussierte Commits

- `ae07579 feat(data-core): gate passive reference publication`
- `15b5273 feat(data-core): publish canonical passive references`
- `c90e0fb feat(breeder-ai): add passive reference resolver`
- `48c99a2 docs(breeder-ai): close passive resolver phase0 gate`
- `5da315c fix(ci): cover passive reference changes`
- `77b2b9b fix(breeder-ai): normalize passive mentions canonically`
- ein abschließender Dokumentationscommit hält diese Review-Fixes und die neuen Nachweise fest.

Es erfolgte kein Push.

Repositoryzustand am Review-Stop:

```text
Branch: breeder/passive-resolver-discovery
Upstream: origin/breeder/passive-resolver-discovery
Upstream-Stand: e28b6148f47ec2179f63de8c104664be8f31df73
main = origin/main: b3e4daabeb4a6bbc3f132393d0898b0b3e45cea3
Lokaler Branch: 7 Commits vor seinem Upstream
Working Tree: clean
```

Der vollständige Branch-Diff gegen `main` ist zusätzlich lokal und ausgeschlossen unter `LOCAL_ARTIFACTS/diffs/passive-reference-resolver-phase0-main-head.diff` gespeichert. Der begrenzte Nachreview-Diff gegen den vorherigen Review-Stand `48c99a2` liegt unter `LOCAL_ARTIFACTS/diffs/passive-reference-resolver-review-fix-48c99a2-head.diff`. Maßgeblich für den jeweils aktuellen Commitstand bleiben `git status` und `git log main..HEAD`.

## 12. Verbleibende offene Phase-0-Gates

Der lokale Passive-Identity-/Resolver-Gate ist erfüllt. Phase 0 als Gesamtgate und Phase 1 bleiben dennoch gesperrt, weil weiterhin extern oder betrieblich zu beweisen beziehungsweise zu entscheiden sind:

1. echte Cloudflare-Access-Anwendung, OTP-Policy, Allowlist/Provisioning und Assertion-Weitergabe;
2. Live-JWKS-Abruf, Cache, Rotation, unbekannte `kid` und Netzwerkfehler;
3. zwei reale Geräte und echter E-Mail-/Identity-Rebind inklusive Recovery-/Abuse-Policy;
4. Static-Assets-/API-/Routingtopologie;
5. Remote-D1-Migration, Backup, Restore und Rollback;
6. reale Reasoning-/Speech-/Research-Provider einschließlich Modelle, Limits, Kosten und Retention;
7. Security-Review des begrenzten JWT-/Auth-Adapters vor Produktion;
8. fachliche Passive-Wirkungs-, Vererbungs-, Züchtbarkeits- und Balance-Domain als getrennte spätere Data-Core-Arbeit;
9. unabhängiger Review des lokalen `main..HEAD`-Diffs und jede weitere Remote-/Releasefreigabe.

## 13. Nicht erfolgt

- kein Push;
- kein Pull Request;
- kein Merge;
- kein Deployment;
- keine Cloud-Ressource oder Remote-D1;
- keine Secret- oder Provideränderung;
- keine Änderung der öffentlichen API-/MCP-Verträge;
- keine Änderung der historischen PWA-Daten;
- kein Phase-1-Scope.

## 14. Review-Stop und nächste sichere Aktion

Der Auftrag endet an diesem Review-Stop. Der nächste sichere Schritt ist eine unabhängige Prüfung des lokalen Diffs, insbesondere:

- Approval-/Publisher-Grenze und Reproduzierbarkeit des Reference-Space-Hashes;
- Ausschluss technischer Felder und nicht-displaybarer Entities;
- Dataset-/Migrationsvertrag;
- Ambiguitäts- und Fuzzy-Verhalten;
- Abgrenzung des Identity-Reference-Space von noch offener Passive-Wirkungssemantik.

Push, PR, Merge, Deployment, Cloud-/Secret-Änderungen oder Phase 1 benötigen jeweils eine neue ausdrückliche Freigabe.

## 15. Begrenzte Fixes aus dem unabhängigen Review

Der unabhängige Review akzeptierte die grundsätzliche Architektur und meldete zwei lokale Push-Blocker:

1. unvollständige Workflow-Trigger;
2. unterschiedliche Normalformen für kanonisch äquivalente Unicode-Eingaben.

Die Workflowkorrektur ergänzt `data/palworld-core/**` in beiden Ereignisarten beider schnellen CI-Workflows. Data-Core-CI berücksichtigt zusätzlich `data-passives.js`, weil der Publication-Regressionstest diesen Overlay tatsächlich liest. Breeder-AI-CI akzeptiert nun `breeder/**` als Push-Branch. Es wurde kein Deployment-Workflow verändert und keine Voll-Probe an reine Repository-Datenänderungen gekoppelt.

Die Resolverkorrektur führt NFC vor der vorhandenen deutschen Transliteration aus und ersetzt die localegebundene Kleinschreibung durch deterministisches `toLowerCase()`. Exact-/Fuzzy-Grenzen, Aliasmenge und Ambiguitätsverhalten bleiben unverändert. Ein neuer NFD-Regressionstest beweist für `Außergewöhnlich` dieselbe autoritative `Rare`-Auflösung wie für die vorkomponierte Form.

Die nicht blockierenden Review-Hinweise zu ZIP-Digest-Prüfung und Runtime-Neuberechnung des Reference-Space-Hashes wurden bewusst nicht in einen Downloader-, Workspace- oder Worker-Crypto-Umbau ausgeweitet.
