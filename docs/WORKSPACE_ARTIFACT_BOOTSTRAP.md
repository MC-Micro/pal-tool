# Workspace-/Artifact-Bootstrap

**Stand:** 16. September 2026
**Scope:** lokales, repositoryweites Entwicklungs- und Review-Tooling

## Zweck und Grenze

Ein Git-Clone enthält die kleinen, reviewten und runtime-relevanten kanonischen Daten dieses Repositorys. Er enthält bewusst nicht die großen, laufbezogenen Review- und Probe-Artefakte aus GitHub Actions. `scripts/workspace-artifacts.mjs` verbindet beide Bereiche für eine konkrete Aufgabe reproduzierbar, ohne externe Evidenz zu neuer Game Truth zu erklären.

Der Bootstrap darf ausschließlich ein explizit gepinntes Artefakt prüfen, herunterladen und lokal vorbereiten. Er sucht kein „latest“, wechselt nicht auf andere Runs oder Artifact-IDs, startet keinen Workflow, lädt keinen Dedicated Server und erzeugt keine Ersatzdaten. Normale Runtime- und Resolver-Nutzung benötigt den Bootstrap nicht.

## Versionierte Profile

Die operationale Registry [`workspace-artifacts.json`](../workspace-artifacts.json) beschreibt benannte Zwecke. Ein Profil enthält:

- semantischen Zweck und lokales Ziel;
- Repository, Workflow, Run-ID, erzeugenden Repository-HEAD, Artifact-ID und -Name;
- den SHA-256 des ZIP-/Actions-Artefakts;
- erwartete Dateien und kontrollierte Inhaltsprüfungen;
- sofern relevant Steam-Build, Review-Schema, technischen Candidate-Hash und fachlichen Reference-Space-Hash.

Die freigegebene Passive-Publikationsprovenienz wird nicht dupliziert: Das Profil `passive-reference-approved-schema2` liest sie per JSON Pointer aus `data/palworld-core/passives.approval.json`. Das getrennte Profil `pal-data-core-resolver-head-evidence` ergänzt nur die operationalen IDs des späteren Runs auf dem Resolver-HEAD. Ein höherer Run oder derselbe Steam-Build ersetzt deshalb niemals still die tatsächlich freigegebene Publikationsprovenienz.

Mehrere `provenanceSources` werden feldweise fail-closed zusammengeführt. Jedes Feld gehört grundsätzlich genau einer Quelle. Eine identische Mehrfachdefinition ist zulässig; widersprüchliche Werte ergeben `registry_invalid` und keine spätere Quelle darf eine Approval-Quelle überschreiben. Das aufgelöste Provenienzobjekt besitzt keinen JavaScript-Prototyp, sodass Sondernamen wie `__proto__` oder `constructor` reine, inerte Datenfelder bleiben.

Ein Artifact-/ZIP-Digest identifiziert das technische Archiv eines einzelnen Runs. Der Candidate-Hash identifiziert den fachlich eingegrenzten technischen Candidate. Der Reference-Space-Hash identifiziert die persistenzrelevante Domain-Identität. Diese Werte dürfen sich unabhängig ändern und werden nicht gegeneinander substituiert.

## Verwendung

Voraussetzung ist Node.js 22 oder eine kompatible aktuelle Node-Version. Die Befehle funktionieren unter Windows, Linux und macOS.

```text
node scripts/workspace-artifacts.mjs list
node scripts/workspace-artifacts.mjs check passive-reference-approved-schema2
node scripts/workspace-artifacts.mjs fetch passive-reference-approved-schema2
node scripts/workspace-artifacts.mjs prepare passive-reference-approved-schema2
```

`check` ist der billige Preflight. Er führt keine Netzwerkoperation aus. Eine artifact-abhängige Facharbeit darf erst bei `status: "ready"` beginnen.

Die lokale Workspace-Grenze und die Artifact-Grenze sind bewusst getrennt. Der Workspace muss das erwartete Repository/Origin, den tatsächlichen Repository-Root, getrackte Registry-/JSON-Provenienzquellen und den vereinbarten Dirty-State bestätigen. Der im Profil genannte Producer-HEAD ist dagegen ausschließlich Provenienz des externen Artifacts. Er muss weder im lokalen Clone vorhanden noch Vorfahr des aktuellen `HEAD` sein; dadurch bleiben saubere Squash-/Rebase-/Fresh-Clone-Stände verwendbar. Beim automatischen Download müssen die GitHub-Run-Metadaten den Producer-HEAD weiterhin exakt bestätigen; zusätzlich wird ausschließlich ein Run mit `status: "completed"` und `conclusion: "success"` akzeptiert. Jeder laufende, fehlgeschlagene, abgebrochene oder sonst nicht erfolgreiche Run endet vor dem Artifact-Metadatenrequest als `artifact_provenance_mismatch`.

`fetch` prüft zuerst Workspace, eine bereits vorbereitete Kopie und ein vorhandenes lokales ZIP. Nur wenn beides fehlt, ruft es exakt den gepinnten GitHub-Run, exakt die gepinnte Artifact-Metadatenressource und exakt den gepinnten ZIP-Endpunkt ab.

`prepare` schließt `fetch` ein, entpackt in ein temporäres Verzeichnis, prüft den vollständigen Dateisatz und die profilabhängige Provenienz und veröffentlicht das Verzeichnis anschließend atomar. Ein bereits verifiziertes Ergebnis wird erneut vollständig gegen seinen Receipt geprüft und ohne Download wiederverwendet.

Standardmäßig blockieren uncommittete oder ungetrackte, nicht ignorierte Workspace-Änderungen. `--allow-dirty` ist nur für einen bewusst geprüften lokalen Arbeitsstand gedacht:

```text
node scripts/workspace-artifacts.mjs check passive-reference-approved-schema2 --allow-dirty
```

## Lokale Struktur und manueller ZIP-Weg

Der getrackte Root-Eintrag `/LOCAL_ARTIFACTS/` in `.gitignore` schützt frische Clones vor versehentlichen Artifact-Commits.

```text
LOCAL_ARTIFACTS/
├── artifacts/
│   ├── passive-reference-approved-schema2.zip
│   └── passive-reference-approved-schema2/
│       ├── .workspace-artifact-receipt.json
│       └── ... erwartete Artifact-Dateien
└── diffs/
```

Wenn der automatische Download nicht möglich ist, kann die exakt referenzierte ZIP-Datei am vom `check`-Ergebnis genannten `manualZipPath` abgelegt werden. `prepare` vertraut ihr nicht blind: Der gepinnte SHA-256 wird vor dem Entpacken geprüft; anschließend werden Dateisatz, Content-Provenienz und Receipt geprüft. Ein falsches vorhandenes ZIP wird nicht überschrieben und löst keinen Fallback auf ein anderes Artefakt aus.

Bereits entpackte Dateien ohne gültigen Receipt gelten nicht als vertrauenswürdig. Historische Verzeichnisse in `LOCAL_ARTIFACTS/` werden weder importiert noch umbenannt.

## Authentifizierung

Für einen automatischen Download wird zuerst `GH_TOKEN`, danach `GITHUB_TOKEN` und andernfalls eine bestehende Anmeldung aus `gh auth token` verwendet. Tokenwerte werden weder in Registry/Receipt gespeichert noch geloggt. Ohne sichere lokale Authentifizierung endet der Download sofort mit `artifact_auth_required`, bevor ein GitHub-Datenrequest ausgeführt wird. Dann ist der verifizierte manuelle ZIP-Weg zu verwenden.

## Status- und Fehlerklassen

Die CLI liefert JSON sowie einen nicht-null Exit-Code außer bei erfolgreichem `ready`, `artifact_fetched` oder `artifact_prepared`:

- `ready`: Workspace und vorbereitete Kopie sind vollständig verifiziert;
- `artifact_missing`: weder vorbereitete Kopie noch lokales ZIP vorhanden;
- `artifact_auth_required`: kein sicherer GitHub-Zugang beziehungsweise Auth-Ablehnung;
- `artifact_unavailable`: exakter Run oder exaktes Artefakt gelöscht, abgelaufen oder nicht erreichbar;
- `artifact_digest_mismatch`: ZIP stimmt nicht mit dem gepinnten Artifact-Digest überein;
- `artifact_provenance_mismatch`: Metadaten, Receipt oder fachliche Inhaltsbindung widersprechen dem Profil;
- `artifact_extract_incomplete`: ZIP oder vorbereiteter Dateisatz ist unvollständig/unsicher;
- `workspace_dirty`: relevante lokale Änderungen ohne bewusstes `--allow-dirty`;
- `workspace_revision_mismatch`: Repository-Root, Origin oder getrackte Registry-/Provenienzquellen sind nicht valide;
- `registry_invalid`: Registry, Profil oder referenzierte Provenienzquelle ist ungültig.

Ein abgelaufenes Artefakt wird als `artifact_unavailable` gemeldet. Es gibt keinen Ersatz durch ein neueres Artefakt desselben Builds. Eine manuell erhaltene Byte-identische ZIP-Kopie bleibt nur dann zulässig, wenn ihr SHA-256 exakt dem gepinnten Digest entspricht.

## Entpack- und Integritätsgrenze

Der eingebaute kleine ZIP-Reader akzeptiert nur normale, unverschlüsselte Store-/Deflate-Einträge innerhalb fester Größen- und Anzahlgrenzen. Er verweigert unter anderem:

- absolute Pfade, Laufwerkspfade, Backslashes und `..`;
- Windows-reservierte Namen, nachgestellte Punkte/Leerzeichen und Case-Kollisionen;
- symbolische Links, Multi-Disk- und ZIP64-Archive;
- verschlüsselte oder unbekannte Kompressionsmethoden;
- inkonsistente Local-/Central-Namen, Größen oder CRC32-Werte.

Deflate wird bereits im `inflateRawSync`-Schritt durch `maxOutputLength` auf höchstens die deklarierte unkomprimierte Entry-Größe begrenzt, zusätzlich zu den globalen Entry-/Archivlimits. Unterdeklarierter Output bricht damit kontrolliert vor einer ungebremsten Speicherallokation als `artifact_extract_incomplete` ab.

Die Extraktion findet in einem neuen temporären Verzeichnis statt. Erst nach vollständiger Profilprüfung und Receipt-Erzeugung wird dieses Verzeichnis unter dem stabilen Profilnamen sichtbar. Unvollständige temporäre Ergebnisse werden entfernt; ein bestehendes unvollständiges Ziel wird nicht automatisch überschrieben.

## Neues Profil kontrolliert freigeben

1. Den fachlichen Zweck und die tatsächlich reviewte Provenienz bestimmen; niemals allein den neuesten Run auswählen.
2. Bestehende Approval-/Provenienzdateien über eine `json`-Quelle referenzieren, wenn sie bereits die Wahrheit enthalten.
3. Nur noch fehlende operationale Pointer über eine kleine `inline`-Quelle ergänzen; widersprüchliche doppelte Felder sind ungültig.
4. Exakten erwarteten Dateisatz und minimale, belastbare Inhaltsbindungen definieren.
5. Registry- und Unit-Tests ausführen; bei neuer fachlicher Approval die zuständige Review-/Publikationsfolge separat durchführen.
6. Das neue Profil reviewen und versionieren. Ein Profilwechsel ist eine ausdrückliche Änderung, kein Laufzeit-Fallback.

## Tests und CI

```text
node --check scripts/workspace-artifacts.mjs
node --check scripts/workspace-artifacts.test.mjs
node --test scripts/workspace-artifacts.test.mjs
```

Die Tests sind netzwerkfrei; GitHub-Antworten werden an der injizierten Downloadgrenze simuliert. Sie laufen im schnellen `Pal Data Core CI`. Änderungen an diesem Bootstrap unter `scripts/`, an der Registry oder der Ignore-Regel lösen nicht den schweren `Probe Pal Data Core` aus.

## Hinweis für künftige Codex-Aufträge

Ein artifact-abhängiger Auftrag soll das benötigte Profil explizit nennen und vor Facharbeit verlangen:

> Führe `node scripts/workspace-artifacts.mjs check <profil>` aus. Beginne die Facharbeit nur bei `ready`; verwende bei Fehlen ausschließlich `fetch`/`prepare` für genau dieses Profil und stoppe fail-closed bei jeder Abweichung.

Damit ist keine erneute Browser-, Run-, Artifact- oder Diffs-Suche erforderlich.
