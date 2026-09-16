# Abschlussbericht: Workspace-/Artifact-Bootstrap

**Stand:** 16. September 2026
**Status:** Review-Fix lokal implementiert und getestet; erneuter Review-Stopp; kein Push/PR/Merge/Deployment

## 1. Ausgangsstand und Arbeitsgrenze

- Repository: `MC-Micro/pal-tool`
- Ausgangs-HEAD: `50f74cf5442685024afb3a43b1b7def9eb14b15a`
- unveränderter Ausgangsbranch: `breeder/passive-resolver-discovery`
- neuer ausschließlich lokaler Branch: `feature/workspace-artifact-bootstrap`
- lokaler `main` und `origin/main` beim Start: `b3e4daabeb4a6bbc3f132393d0898b0b3e45cea3`
- bestätigter Remote-HEAD des Resolver-Branches beim Start: `50f74cf5442685024afb3a43b1b7def9eb14b15a`
- ursprünglicher Bootstrap-Review-HEAD: `fdd98a8cbbee17f583c03682181b780c72c90ac5`
- Review-Fix-Implementierungscommit: `f504012`
- Review-Fix-Dokumentationscommit: `dc476b8`
- finaler lokaler HEAD: der Commit, der diesen Bericht enthält; der exakte Wert steht im zugehörigen Review-Handoff beziehungsweise in `git rev-parse HEAD`.

Es gab keine unerwarteten getrackten oder ungetrackten Dateien außerhalb des bereits ignorierten `LOCAL_ARTIFACTS/`. Es wurden weder Remote-Zustand noch Cloud, Secrets, Provider, D1, Deployment oder Produktfunktion verändert.

## 2. Lokale Commits

1. `d4ac78b` – `feat(workspace): add verified artifact bootstrap`
2. `c22d234` – `docs(workspace): document artifact preflight boundary`
3. `fdd98a8` – `docs(workspace): record bootstrap completion`
4. `f504012` – `fix(workspace): harden artifact trust boundaries`
5. `dc476b8` – `docs(workspace): clarify artifact producer trust`
6. Run-Success-Provenienzfix – der Commit, der die aktuelle Fassung dieses Berichts enthält

Alle Commits sind ausschließlich lokal. Der Branch besitzt bewusst keinen neuen Push-/PR-Status.

## 3. Geänderte Dateien

- `.github/workflows/pal-data-core-ci.yml`
- `.gitignore`
- `AGENTS.md`
- `README.md`
- `docs/PAL_DATA_CORE_ARCHITECTURE.md`
- `docs/WORKSPACE_ARTIFACT_BOOTSTRAP.md`
- `docs/WORKSPACE_ARTIFACT_BOOTSTRAP_REPORT.md`
- `scripts/workspace-artifacts.mjs`
- `scripts/workspace-artifacts.test.mjs`
- `workspace-artifacts.json`

`tools/pal-data-core/**`, der schwere Probe-Workflow, kanonische Daten, Breeder AI, Breeding API und Produktcode blieben unverändert.

## 4. Gewählte Architektur

Die Lösung ist eine kleine repositoryweite Node-CLI mit drei Schichten:

1. `workspace-artifacts.json` definiert benannte, versionierte Artifact-Profile;
2. `scripts/workspace-artifacts.mjs` führt `check`, `fetch` und `prepare` fail-closed aus;
3. ein lokaler Verification Receipt bindet eine vorbereitete Kopie an Profil, vollständige aufgelöste Provenienz und SHA-256 jedes erwarteten Files.

Die Root-Schicht ist absichtlich unabhängig von Breeder AI, Breeding API, dem .NET-Extractor und privaten Repositories. Sie verwendet nur Node-Built-ins. Damit funktioniert der normale Preflight unter Windows und in der Linux-CI, ohne ein weiteres Paket oder Framework einzuführen.

Ein generischer Artifact-Orchestrator wurde bewusst nicht gebaut. Profile können dennoch weitere Data-Core-Domänen abdecken, weil erwartete Dateien und minimale SHA-/JSON-Pointer-Prüfungen Daten statt hartcodierter Passive-Logik sind.

## 5. Registry-/Pointer-Modell und Approval-Beziehung

Die Registry ist eine operationale Workspace-/Review-Registry, keine Game-Truth-Quelle.

Das Profil `passive-reference-approved-schema2` dupliziert die existierende Approval-Wahrheit nicht. Es liest Repository, Workflow, Run, Producer-Commit, Artifact-Name/-ID/-Digest, Steam-Build, Review-Schema, Candidate-Hash und Reference-Space-Hash über JSON Pointer aus `data/palworld-core/passives.approval.json`.

Das getrennte Profil `pal-data-core-resolver-head-evidence` verwendet dieselben fachlichen Werte, ergänzt aber explizit die operationalen Werte des späteren erfolgreichen Resolver-HEAD-Runs:

- Run `34984667636`
- Producer `50f74cf5442685024afb3a43b1b7def9eb14b15a`
- Artifact ID `10402842001`
- Artifact-SHA-256 `090f6591ebcc40727bcef05e966163d58aa0a0bbcb5860751df9ef17bcd2c635`

Dadurch bleibt sichtbar, dass dies zusätzliche technische Evidenz und kein Ersatz für die Publikationsfreigabe aus Run `34975314764`/Artifact `10399160981` ist.

Die Zusammenführung mehrerer Provenienzquellen ist jetzt feldweise fail-closed. Exakt gleiche Mehrfachdefinitionen sind zulässig; jeder widersprüchliche zweite Wert ergibt `registry_invalid` mit der ersten und der konfliktverursachenden Quelle. Es gibt keine Last-Writer-Wins-Semantik. Das Ergebnis wird mit `Object.create(null)` prototype-frei aufgebaut und anschließend eingefroren, sodass `__proto__`, `constructor` und andere Sondernamen keine Objektprototypwirkung besitzen.

## 6. `LOCAL_ARTIFACTS`-Strategie

`.gitignore` enthält jetzt den getrackten Root-Eintrag `/LOCAL_ARTIFACTS/`. Diese Entscheidung schützt jeden frischen Clone, ist einfacher als eine mutierende `.git/info/exclude`-Initialisierung und verhindert, dass ZIPs, entpackte Probe-Daten, Receipts oder Review-Diffs als untracked Repositoryinhalt erscheinen.

Die stabile Struktur lautet:

```text
LOCAL_ARTIFACTS/
├── artifacts/
│   ├── <profile>.zip
│   └── <profile>/
│       ├── .workspace-artifact-receipt.json
│       └── ... erwartete Dateien
└── diffs/
```

Keine Datei unter `LOCAL_ARTIFACTS/` wird committed.

## 7. Bedienung und Statusmodell

```text
node scripts/workspace-artifacts.mjs list
node scripts/workspace-artifacts.mjs check <profile>
node scripts/workspace-artifacts.mjs fetch <profile>
node scripts/workspace-artifacts.mjs prepare <profile>
```

`check` ist read-only und netzwerkfrei. Es prüft den tatsächlichen Git-Root, das zum Profil passende Repository-Origin, getrackte Registry-/JSON-Provenienzquellen, Dirty-State, lokale ZIP-/Prepared-Lage, Receipt, vollständigen Dateisatz, Datei-Hashes und profilierte Inhaltsprovenienz.

Der Artifact-Producer-HEAD und der aktuelle Workspace-HEAD sind getrennte Vertrauensgrenzen. Der lokale Producer-SHA muss bewusst weder vorhanden noch Vorfahr von `HEAD` sein; damit bleiben frische saubere Workspaces nach Squash, Rebase oder anderem legitimen History-Wechsel verwendbar. Die GitHub-Run-Prüfung verlangt den gepinnten Producer-HEAD weiterhin exakt und wurde nicht gelockert.

Das maschinenlesbare Modell unterscheidet:

- `ready`
- `artifact_missing`
- `artifact_auth_required`
- `artifact_unavailable` einschließlich expired/deleted
- `artifact_digest_mismatch`
- `artifact_provenance_mismatch`
- `artifact_extract_incomplete`
- `workspace_dirty`
- `workspace_revision_mismatch`
- `registry_invalid`

Erfolgreiche Fetch-/Prepare-Aktionen liefern zusätzlich `artifact_fetched` beziehungsweise `artifact_prepared`. Alle Fehlerklassen besitzen einen nicht-null Exit-Code. `--allow-dirty` existiert nur für bewusst geprüfte lokale Arbeit; die Dirty-Information bleibt in der Ausgabe erhalten.

## 8. Download- und Authentifizierungsstrategie

Der automatische Weg verwendet ausschließlich offizielle GitHub-API-Endpunkte für:

1. exakt `actions/runs/{workflowRunId}`;
2. exakt `actions/artifacts/{artifactId}`;
3. exakt `actions/artifacts/{artifactId}/zip`.

Es gibt keine Run-/Artifact-Liste, kein `latest`, kein UI-Scraping, keinen Branch-Fallback und keine alternative Artifact-ID. Run-, Workflow-, Repository-, Producer-HEAD-, Artifact-Name/-ID- und API-Digest-Metadaten müssen zum Profil passen. Der exakte Run wird nur akzeptiert, wenn zusätzlich `status === "completed"` und `conclusion === "success"` gelten. Jeder andere oder unbekannte Zustand ergibt `artifact_provenance_mismatch`; Artifact-Metadaten und ZIP werden danach nicht mehr angefordert.

Die Auth-Grenze verwendet vorhandenes `GH_TOKEN`, danach `GITHUB_TOKEN`, andernfalls eine bestehende `gh auth token`-Anmeldung. Tokenwerte gelangen nicht in Output, Registry oder Receipt. Ohne Token stoppt der Downloader mit `artifact_auth_required`, bevor ein GitHub-Request erfolgt.

Der Download schreibt zunächst exklusiv in eine UUID-Tempdatei. Nur ein vollständig geladener Byte-Stream mit exakt gepinntem SHA-256 wird atomar auf den stabilen ZIP-Pfad umbenannt. Ein vorhandenes falsches ZIP wird weder überschrieben noch durch einen Netzwerkfallback ersetzt.

Es wurde in diesem Auftrag kein echter Artifact-Download durchgeführt. Die Downloadgrenze wurde vollständig netzwerkfrei gemockt.

## 9. Manueller ZIP-Fallback

`check` nennt den deterministischen `manualZipPath`. Eine dort abgelegte ZIP-Datei wird nicht blind akzeptiert. `fetch`/`prepare` prüfen zuerst den exakten gepinnten Artifact-SHA-256. Anschließend gelten dieselben sicheren Extraction-, Dateisatz-, Inhalts- und Receipt-Prüfungen wie beim automatischen Download.

Das bereits historische lokale Verzeichnis `LOCAL_ARTIFACTS/artifacts/schema2-25247047/` wird nicht still umgedeutet: Es besitzt weder das gepinnte ZIP noch einen Bootstrap-Receipt und bleibt daher reine lokale Arbeitsevidenz. Das freigegebene Profil meldet gegenwärtig korrekt `artifact_missing`, bis die byte-identische ZIP am dokumentierten Pfad vorliegt.

## 10. Digest- und Provenienzprüfung

Die folgenden Identitäten bleiben ausdrücklich getrennt:

- Artifact-/ZIP-SHA-256: technische Archividentität eines Runs;
- Steam Build ID: Quellenprovenienz;
- technischer Passive-Candidate-SHA-256: technische Domainprojektion;
- Passive Reference-Space-SHA-256: persistenzrelevante fachliche Identität;
- Review-Schema: Struktur-/Gate-Version.

Der ZIP-Digest wird vor der Vertrauensübernahme geprüft. Danach bindet das Passive-Profil `passive-candidate-a.json` bytegenau an den Candidate-Hash und `passive-review.json` an Schema, Build, Candidate, Reference Space und `ok: true`.

Ein gleiches technisches ZIP mit verändert erwarteter Candidate- oder Reference-Space-Identität scheitert als `artifact_provenance_mismatch`. Ein geänderter technischer ZIP-Digest bei gleichen fachlichen Hashes bleibt ein anderes operationales Artefakt, aber nicht automatisch eine neue fachliche Identität.

## 11. Extraction- und Pfadsicherheit

Der kleine eingebaute ZIP-Reader unterstützt ausschließlich unverschlüsselte Store-/Deflate-Einträge innerhalb fester Größen-/Anzahlgrenzen. Er verweigert:

- absolute, Drive-, Backslash-, Nullbyte-, Punkt- und Traversalpfade;
- Windows-reservierte Segmente und nachgestellte Punkte/Leerzeichen;
- Case-Kollisionen und doppelte Pfade;
- Symlinks, Multi-Disk, ZIP64 und unbekannte Kompression;
- inkonsistente Central-/Local-Namen, abgeschnittene Daten, Größen- oder CRC32-Abweichungen.

Er extrahiert ausschließlich in ein neues temporäres Verzeichnis. Erst nach vollständigem Dateisatz, Content-Provenienz und Receipt wird atomar zum Profilziel umbenannt. Temporäre Fehlerreste werden entfernt. Ein vorhandenes unvollständiges Ziel wird zur manuellen Prüfung stehen gelassen und niemals überschrieben.

Für Deflate erhält `inflateRawSync` nun `maxOutputLength` auf Basis der deklarierten unkomprimierten Entry-Größe, gedeckelt durch das bestehende 512-MiB-Entry-Limit. Ein Entry mit unterdeklarierter Größe kann deshalb nicht erst ungebremst expandieren und anschließend verglichen werden; der Inflate-Schritt bricht kontrolliert als `artifact_extract_incomplete` ab.

## 12. Idempotenz und Ablaufverhalten

Ein gültig vorbereitetes Profil wird bei jedem Aufruf erneut gegen Receipt und aktuelle Dateien geprüft. Ist es weiter `ready`, erfolgen weder Download noch Extraktion. Ein lokal vorhandenes korrektes ZIP wird ebenfalls wiederverwendet.

Meldet GitHub das exakt gepinnte Artefakt als expired oder liefert 404/410, endet der Vorgang als `artifact_unavailable`. Es gibt keinen Wechsel auf den späteren Run, selbst wenn Steam-Build und fachliche Hashes gleich sind. Eine außerhalb von GitHub erhaltene byte-identische ZIP bleibt über den manuellen, digest-geprüften Weg nutzbar.

Ein neuer Workflow-Run desselben Builds benötigt ein eigenes ausdrückliches Profil beziehungsweise eine reviewte Profiländerung. Höhere Run-/Artifact-IDs besitzen keinerlei automatische Priorität.

## 13. Tests und exakte Ergebnisse

### Neue Bootstrap-Unit-Tests

`node --test scripts/workspace-artifacts.test.mjs`

- **20 Tests, 20 bestanden, 0 fehlgeschlagen, 0 übersprungen**
- keine Netzwerkabhängigkeit
- abgedeckt: Produktionsregistry/Approval-Pointer, unbekanntes Profil/ungültige Registry, korrektes manuelles ZIP, falscher Digest, Auth-Abbruch vor Requests, exakter `completed/success`-Run mit exakt drei API-URLs ohne `latest`, Abbruch eines `completed/failure`-Runs und eines `in_progress/null`-Runs vor jedem Artifact-Request, expired Artifact ohne Fallback, unvollständige Extraktion, fehlende JSON-Provenienz, ZIP-Traversal, Dirty-Workspace-Gate, nicht-vorfahren historischer Producer, widersprüchlicher Approval-Override, Prototype-Sonderfelder, begrenzter unterdeklarierter Deflate-Output, Same-Build-Run-Trennung, unabhängige Archive/Candidate/Reference-Gates, tracked Ignore-Regel und Idempotenz/Reuse.

### Kombinierte Data-Core-Node-Tests

`node --test scripts/workspace-artifacts.test.mjs tools/pal-data-core/tests/*.test.mjs`

- **49 Tests, 49 bestanden, 0 fehlgeschlagen, 0 übersprungen**
- davon 20 Bootstrap- und 29 bestehende Data-Core-/Passive-Publikationstests.

### Weitere erfolgreiche Prüfungen

- `node --check scripts/workspace-artifacts.mjs`: PASS
- `node --check scripts/workspace-artifacts.test.mjs`: PASS
- `node scripts/validate-data.mjs`: PASS; kanonischer 115er Passive-Reference-Space, 102er PWA-Overlay, Struktur, PWA-Dateien und Cache-Verweise konsistent
- realer sauberer Preflight: erwartungsgemäß `artifact_missing`, Workspace `ready`, Exit 2, kein Download
- geänderter-Dateien-Secret-Scan gegen Private-Key-, GitHub-, OpenAI-, Cloudflare- und Breeding-Token-Muster: PASS
- `git diff --check 50f74cf..HEAD`: PASS nach Entfernen eines Markdown-Trailing-Whitespace-Funds
- `.gitignore`-Test via `git check-ignore`: PASS

### Lokal nicht ausführbare Prüfung

Die .NET-Parität des bestehenden `Pal Data Core CI` konnte lokal nicht abgeschlossen werden. Installiert ist ausschließlich .NET SDK `8.0.425`; der unveränderte Extractor zielt auf `net10.0`, sodass `dotnet restore` mit `NETSDK1045` vor Restore/Compile/Katalogprüfung stoppt. Es wurde kein SDK nachinstalliert. Das betrifft keinen geänderten .NET-Code, bleibt aber ein offener CI-Nachweis für einen späteren Push/PR. `actionlint` und `gitleaks` sind lokal nicht installiert; Workflowstruktur wurde anhand des Diffs/der Trigger geprüft, der Secret-Scan erfolgte äquivalent nur über die geänderten Dateien.

Breeder-AI- und Breeding-API-Suites wurden nicht erneut ausgeführt, weil keine ihrer Code-, Konfigurations-, Lock-, Workflow- oder Datenabhängigkeiten geändert wurde. Die Root-Datenvalidation und alle betroffenen Data-Core-Tests liefen vollständig.

## 14. CI-/Workflow-Auswirkung

Der bestehende schnelle Workflow `Pal Data Core CI` reagiert jetzt zusätzlich auf:

- `scripts/workspace-artifacts.mjs`
- `scripts/workspace-artifacts.test.mjs`
- `workspace-artifacts.json`
- `.gitignore`

Er syntaxprüft beide neuen Skripte und führt die netzwerkfreien Bootstrap-Tests aus. Es wurden keine Actions ergänzt oder Versionspins geändert, keine Secrets benötigt und kein neuer Job/Deploymentpfad geschaffen.

`.github/workflows/probe-pal-data-core.yml` und `tools/pal-data-core/**` blieben unverändert. Der Probe-Workflow reagiert nur auf `breeder/**`, dieser lokale Branch ist `feature/**`; normale Bootstrap-Arbeit löst daher keinen Dedicated-Server-Download oder schweren Probe-Run aus.

## 15. Dokumentationsänderungen

- `docs/WORKSPACE_ARTIFACT_BOOTSTRAP.md`: vollständige Bedienung, Grenzen, Auth, manueller Weg, Status, Sicherheit und Profilerweiterung;
- `README.md`: Einstieg und kurze Runtime-vs.-externe-Evidenz-Grenze;
- `docs/PAL_DATA_CORE_ARCHITECTURE.md`: dauerhafte Architekturgrenze für externe Review-Artefakte;
- `AGENTS.md`: kurze verpflichtende Preflight-Regel für explizit artifact-abhängige Arbeit;
- dieser Abschlussbericht als dauerhafter Review-/Chat-Handoff.

Historische Phase-0-Berichte und fachliche Roadmaps wurden nicht rückwirkend umgeschrieben.

## 16. Architektur-Selbstreview

1. Eine kleine separate Registry ist nötig, weil nicht jede spätere technische Evidenz eine Approval-Datei besitzt; vorhandene Approval-Wahrheit wird aber referenziert statt kopiert.
2. Die zwei Passive-Profile verhindern Drift zwischen Publikationsfreigabe und späterer Same-Build-Evidenz.
3. `LOCAL_ARTIFACTS/` ist durch eine getrackte Root-Regel auch im frischen Clone ignoriert.
4. Pfadnormalisierung, Git-Aufrufe und Tests laufen auf Windows; CI bleibt Linux-kompatibel.
5. Fehlende Auth stoppt vor dem ersten GitHub-Request.
6. Ein manuelles ZIP durchläuft dieselbe Digest-/Struktur-/Inhaltsprüfung.
7. Die API-Grenze kennt keine Listing-/Latest-Endpunkte und keine alternative ID.
8. Archiv-, Build-, Candidate-, Reference- und Schemaversion sind getrennte Felder/Gates.
9. Profile sind auf weitere Data-Core-Domänen erweiterbar, ohne einen Orchestrator zu bauen.
10. Weder Pfade noch Branch lösen einen schweren normalen Probe-Run aus.
11. Alle externen Daten und der Review-Diff bleiben unter dem ignorierten lokalen Root.
12. Ein künftiger Auftrag kann mit einem einzelnen `check <profile>` beginnen.
13. Squash-/Rebase-Historie beeinflusst die lokale Workspace-Eignung nicht; der Producer bleibt vollständig an der GitHub-Artifact-Grenze geprüft.
14. Mehrfachquellen können Approval-Werte nicht überschreiben, und Deflate-Output wird während der Dekompression begrenzt.

## 17. Offene Risiken und verbleibende Gates

- Das exakt approvte ZIP ist derzeit am neuen deterministischen Profilpfad nicht vorhanden; der reale Preflight ist korrekt `artifact_missing`. Das bestehende entpackte historische Verzeichnis wird absichtlich nicht ohne ZIP/Receipt vertraut.
- Ablauf/Löschung des GitHub-Artefakts kann automatischen Download unmöglich machen. Es gibt absichtlich keinen Ersatz; nur eine byte-identische lokale ZIP-Kopie kann helfen.
- Die lokale Maschine konnte den unveränderten .NET-10-CI-Anteil nicht ausführen. Ein späterer autorisierter Push muss `Pal Data Core CI` erfolgreich durchlaufen, bevor Merge erwogen wird.
- Der eigene kleine ZIP-Reader unterstützt bewusst nicht alle ZIP-Varianten. Nicht unterstützte Archive scheitern fail-closed; eine Formatänderung von GitHub müsste explizit reviewt werden.
- GitHub-API-Integration wurde gemockt, nicht live ausgeführt. Ein optionaler echter Smoke-Test bleibt getrennt und benötigt sichere Auth sowie ausdrücklichen Bedarf.
- Zwei unabhängige Reviewrunden sind eingearbeitet; der abschließende unabhängige Nachreview dieses letzten Run-Success-Fixes steht noch aus.

## 18. Bewusst nicht implementiert

- kein „latest“-/Such-/Browserfallback;
- kein Workflow-Dispatch, SteamCMD, Serverdownload, Extractorstart oder Ersatz-Candidate;
- keine Auto-Migration historischer entpackter Ordner;
- keine fachliche Datenreparatur oder Publikation;
- keine Phase 1, Access/OTP/JWKS, D1, Provider, API/MCP-, PWA- oder Deploymentarbeit;
- keine Cloud-/Secret-Änderung;
- kein Push, PR, Merge oder Deployment.

## 19. Git- und Diff-Übergabe

Erwarteter finaler Zustand:

```text
## feature/workspace-artifact-bootstrap
```

Die Diff-Basis bleibt exakt:

```text
50f74cf5442685024afb3a43b1b7def9eb14b15a..HEAD
```

Der vollständige lokale Review-Diff wird nach dem Abschlussbericht-Commit erzeugt unter:

```text
LOCAL_ARTIFACTS/diffs/workspace-artifact-bootstrap-50f74cf-head.diff
```

Er bleibt durch `/LOCAL_ARTIFACTS/` untracked. Nach Erzeugung sind keine weiteren Repositoryänderungen vorgesehen. Nächster zulässiger Schritt ist ausschließlich unabhängiger Review; Push/PR/Merge/Deployment benötigen eine neue ausdrückliche Freigabe.
