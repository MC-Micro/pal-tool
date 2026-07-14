# Übergabe an ChatGPT und Codex: Pal Tool / Breeding

Diese Datei soll eine neue technische Chat- oder Codex-Sitzung ohne Zugriff auf frühere Unterhaltungen arbeitsfähig machen. Sie enthält ausschließlich dauerhafte technische Projektinformationen und niemals geheime Werte, persönliche Nachrichten, Spielerbestände, private Backups oder Chatprotokolle.

## Vor dem Arbeiten lesen

1. Repositoryweite Regeln: `AGENTS.md`
2. Gesamtüberblick: `README.md`
3. Kanonische Zuchtreferenz: `data/palworld-breeding/README.md`
4. Kanonische Dateien in dieser Reihenfolge:
   - `data/palworld-breeding/breeding_rules.json`
   - `data/palworld-breeding/special_combinations.json`
   - `data/palworld-breeding/pal_values.json`
   - `data/palworld-breeding/manifest.json`
5. Worker-/API-/MCP-Details: `services/breeding-api/README.md`

## Dokumentierter technischer Baseline-Stand

| Feld | Dokumentierter Stand |
|---|---|
| Repository | `MC-Micro/pal-tool` |
| Standardbranch | `main` |
| Gemergte Grundlage | PR #3 Breeding API, PR #4 öffentlicher read-only MCP, PR #5 technische Dokumentations- und Übergaberegeln |
| Baseline-Commit dieses Dokumentationsstands | `6bb3b0222560e201b0bc192442d5fa9eac00ed83` |
| Hinweis zu Branch und Commit | Vor technischer Weiterarbeit den aktuellen `main`-Commit, den aktiven Branch und offene Pull Requests dynamisch über GitHub bestimmen |
| Worker | `palworld-breeding-api` |
| Zuletzt dokumentierter erfolgreicher ChatGPT-Zugriff | 13.07.2026 über die verbundene App `Breeder`; historischer Integrationstest, keine dauerhafte Erreichbarkeitsgarantie |
| Verbundener ChatGPT-App-/Pluginname | `Breeder` |
| Öffentlicher MCP | anonymer Streamable-HTTP-Endpunkt `/mcp` |
| Geschützte REST-API | weiterhin kompatibel; konkreter Pfad und Basisadresse werden absichtlich nicht dokumentiert |
| Worker-Basisadresse | absichtlich nicht in diesem öffentlichen Repository gespeichert |
| Kanonisches Schema | 4 |
| API-/Artefaktschema | 2 |
| Pals | 299 |
| normale Formel-Kinder | 184 |
| Spezialkombinationen | 136 |
| eindeutige Spezialkind-Arten | 90 |
| ungeordnete Paare | 44.850 |
| Policy-geänderte Paarergebnisse | 13.785 |
| Release-Gate | PASS, null ungelöste Konflikte |
| Patchstand | Palworld 1.0, geprüft am 13.07.2026; exakte Buildnummer nicht verifiziert |

Historische Statuswerte dokumentieren nur den zuletzt geprüften technischen Stand. Live-Erreichbarkeit, aktuelle Branches, aktuelle Commits, offene Pull Requests und ein möglicher neuerer Palworld-Patch müssen bei technischer Wartung oder Entwicklung erneut geprüft werden.

## Was das Repository enthält

### 1. Palworld Passives PWA

Die PWA liegt im Repository-Root und bleibt unabhängig vom Worker:

- Vanilla HTML, CSS und JavaScript
- installierbar und offlinefähig
- 102 Passives
- deutsche und englische Namen und Effekte
- eigener Root-Validator unter `scripts/validate-data.mjs`

Die PWA darf nicht nur zur Unterstützung der Breeding API auf ein Framework oder gemeinsame Runtime-Abhängigkeiten umgebaut werden.

### 2. Kanonische Zuchtreferenz

`data/palworld-breeding/` ist die verbindliche Quelle für Artenberechnungen. Generierte Dateien unter `services/breeding-api/generated/` sind nur Buildartefakte.

Bestätigte globale Reihenfolge:

1. Same-Species-Identität zuerst.
2. Direkte Spezialkombinationen samt Geschlechtsvorgaben danach.
3. Erst dann normale Formel mit ausschließlich zulässigen normalen Kindern.
4. Alle Arten aus `special_combinations.child_internal` sind aus dem normalen Kandidatenpool ausgeschlossen; Same-Species und direkte Specials bleiben gültig.
5. Cross-Rank-Ties, Seltenheit, Duplicate-Priority, Variantenstatus und interne Reihenfolge exakt nach `breeding_rules.json` lösen.
6. Paldeck-Nummern niemals als Rang oder Tie-Break verwenden.

Direkte Palworld-1.0-Eiertests vom 13.07.2026:

- `Lunaris MALE + Grintale FEMALE → Penking`
- `Sibelyx + Lamball → Surfent`

### 3. Cloudflare Worker, REST und MCP

`services/breeding-api/` erzeugt eine deterministische read-only API aus den kanonischen Daten. Runtime-Aufrufe an GitHub oder Drittanbieterrechner existieren nicht.

Es gibt zwei Zugriffsmodi auf dieselbe Resolverlogik:

- öffentlicher, anonymer MCP-Endpunkt `/mcp`
- geschützter REST-Zugang auf dieselbe Resolverlogik; konkreter Pfad wird absichtlich nicht dokumentiert

Das MCP ruft intern die bestehenden REST-Route-Handler auf. Es enthält keine doppelte Zuchtlogik.

## Öffentliche MCP-Tools

Das MCP exponiert exakt fünf Tools:

| Tool | Zweck |
|---|---|
| `breeding_status` | Leichtgewichtiger Validierungs-, Schema-, Zähler- und Patchstatus für Wartung, Diagnostik, Deploymentkontrolle und geplante Integritätsprüfungen |
| `breeding_pair` | Kind zweier Eltern einschließlich Specials und Geschlecht |
| `breeding_parents` | Elternkombinationen für ein Ziel-Pal |
| `breeding_children` | mögliche Kinder eines Trägers mit Filtern |
| `breeding_route` | theoretische Artenroute |

Alle Tools sind read-only, nicht destruktiv und idempotent. `breeding_route` ist ausdrücklich nicht bestands-, passiv-, IV-, Trash-Passiv-, kosten-, zeit- oder vollständig geschlechtsoptimiert.

Für normale ChatGPT-Zuchtanfragen soll die verbundene App **Breeder** direkt mit den fachlich benötigten Tools verwendet werden. `breeding_status` ist keine verpflichtende Routineabfrage vor dem ersten Zuchtauftrag jedes neuen Chats.

`breeding_status` wird gezielt verwendet bei:

- Wartungs- und Integritätsprüfungen
- ausdrücklich genanntem neuem Patch
- Warnungen einer Wartungsaufgabe
- Toolfehlern oder Nichterreichbarkeit
- überraschenden oder widersprüchlichen Ergebnissen
- Deployment-, Repository- oder Datenänderungen
- ausdrücklicher Aktualitätsprüfung

GitHub und kanonische Dateien werden herangezogen, wenn der Status ungültig, veraltet, widersprüchlich oder unzureichend ist, wenn Breeder fehlschlägt oder wenn Dateien geändert werden müssen.

## Geschützte REST-API

Der geschützte REST-Zugang bleibt für bestehende technische Integrationen kompatibel. Basisadresse, konkreter geschützter Pfad und geheime Werte werden absichtlich nicht in diesem öffentlichen Repository ausgeschrieben.

Unterstützte Read-only-Funktionen:

- Status
- Pal-Namensauflösung
- Paarberechnung
- Elternsuche
- Kindersuche
- Artenroute
- vollständige Referenz
- Validierung

Fehlende oder ungültige Authentifizierung liefert neutral HTTP 404. Schreibmethoden sind nicht unterstützt. Geheime Werte dürfen weder in GitHub-Dateien noch in Chatprotokolle, Screenshots, Committexte oder öffentliche URLs übernommen werden.

## Wichtige Routenfolgen von Schema 4

- `Sibelyx + Lamball → Surfent`
- `Lunaris + Grintale → Penking`
- `Anubis + Eikthyrdeer Terra → Bakemi` – nicht Kingpaca Cryst
- `Anubis + Panthalus → Knocklem` – nicht Dualith Noct
- `Dualith Noct + Jolthog → Vanwyrm` – nicht Elphidran Aqua
- `Kingpaca Cryst + Jolthog → Elphidran` bleibt gültig
- `Elphidran + Surfent → Elphidran Aqua` bleibt eine gültige Spezialkombination

Die Analyse `data/palworld-breeding/analysis/anubis_jolthog_route.json` findet für den festen Jolthog keine direkte zweistufige Route vom Anubis über einen beliebigen blanken Mate zu Elphidran, Surfent oder Elphidran Aqua. Längere Routen sind dadurch nicht ausgeschlossen.

## Hashes und generierte Daten

- `source_data_hash`: deterministischer Hash der vier kanonischen Eingabedateien.
- `generated_artifact_hash`: deterministischer Hash der generierten Referenz ohne ihre eigenen Hashfelder.

Aktueller dokumentierter Stand:

- `source_data_hash`: `77901fb00c984e360f563049f2e7f3dc64a6b2d764e77f3c32a737ef4bc82121`
- `generated_artifact_hash`: `882987ec7c8a1eae7855e9bb3d995b79cb0aa498da2042c00fa6faec326ad9b8`

Der vollständige Ergebnisvergleich liegt unter `services/breeding-api/generated/special-child-impact.json`.

## Validierung und CI

Aus `services/breeding-api/`:

```powershell
pnpm install --frozen-lockfile
pnpm run generate
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build:worker
pnpm run validate
pnpm run validate:release
pnpm run check:deterministic
pnpm run scan:secrets
```

Der PR-Head des öffentlichen MCP-Ausbaus bestand am 13.07.2026 sowohl `Breeding API CI` als auch `Validate Palworld data`. Die CI prüft zusätzlich die Root-PWA, committed Generated-Artefakte, Lint, TypeScript, Tests, Worker-Dry-Run, strukturelle und Release-Validierung, Determinismus und Secretscan.

Deployment bleibt manuell, `main`-only, durch das GitHub-Environment `production` geschützt und verwendet `wrangler deploy --keep-vars`, damit das bestehende Worker-Secret erhalten bleibt.

## Patchregel

Der Status `current` gilt nur für Palworld 1.0 und den Prüftag 13.07.2026. Die genaue Buildnummer wurde nicht unabhängig verifiziert. Nach jeder neueren Palworld-Version muss geprüft werden, ob Zuchtwerte, Formel, Spezialkombinationen, Geschlechtsbedingungen, Varianten-, Gleichstands-, Passiv- oder IV-Regeln betroffen sind, bevor die Referenz weiter als aktuell bezeichnet wird.

## Dauerhafte technische Projektübergabe – verbindlich

ChatGPT- oder Codex-Chatverläufe sind kein verlässlicher Langzeitspeicher für den technischen Repositoryzustand. Wichtige technische Informationen dürfen nicht nur im Chat verbleiben.

Bei jeder materiellen technischen Weiterarbeit müssen im selben Pull Request oder Commit die passenden getrackten Dokumente aktualisiert werden. Dazu gehören insbesondere:

- Architektur- und Datenentscheidungen
- neue oder geänderte Endpunkte und MCP-Tools
- geänderte kanonische Regeln, Quellen, Hashes oder Patchannahmen
- Deployment- und Secret-Handhabung ohne geheime Werte
- ausgeführte Validierungen und deren Ergebnis
- bekannte technische Fehler, Risiken, offene Fragen und konkrete nächste Schritte
- Branch, Pull Request und maßgebliche Commits als historischer Arbeitsstand

Vor dem Ende einer größeren technischen Sitzung ist diese Datei zu aktualisieren, wenn Breeding-, API-, MCP-, CI- oder Deploymentarbeit betroffen war. Eine neue technische Sitzung muss anhand des Repositorys weiterarbeiten können, ohne eine frühere Unterhaltung lesen zu müssen.

Nicht speichern:

- persönliche Nachrichten oder vollständige Gesprächsverläufe
- persönliche Pal-Bestände, individuelle Ziel-Pals oder laufende private Zuchtprojekte
- private Backup-Pakete oder private ChatGPT-Projektanweisungen
- beiläufiges Brainstorming ohne dauerhafte technische Projektentscheidung
- Zugangsschlüssel, Passwörter, API-Schlüssel oder andere geheime Werte
- authentifizierte URLs
- Account- oder personenbezogene Daten

Persönliche Projektkontinuität gehört nur auf ausdrücklichen Wunsch in eine getrennte private Quelle oder ein privates Repository. Das öffentliche Repository bleibt frei von individuellem Spielerzustand.

Bei Widersprüchen gelten Code, kanonische Daten, Manifest, gemergte Pull Requests und erfolgreiche Validierung als technische Wahrheit. Die Dokumentation ist dann vor Abschluss der Arbeit zu korrigieren.

## Nächste Schritte bei einer normalen ChatGPT-Zuchtanfrage

1. Konkretes Ziel, vorhandene Pals und relevante Prioritäten erfassen.
2. Die fachlich benötigten Tools der verbundenen App **Breeder** direkt verwenden.
3. Artenroute anschließend getrennt nach Bestand, Geschlechtern, Passiven, IVs und praktischer Beschaffbarkeit bewerten.
4. `breeding_status`, GitHub- und Patchprüfungen nur bei den oben dokumentierten Auslösern verwenden.

## Nächste Schritte bei einer technischen Wartungs- oder Entwicklungssitzung

1. Aktuellen `main`-Commit, aktive Branches und offene Pull Requests über GitHub bestimmen.
2. Prüfen, ob seit dem 13.07.2026 eine neuere Palworld-Version erschienen ist, wenn Patchaktualität für die technische Arbeit relevant ist.
3. `breeding_status` über **Breeder** aufrufen, wenn Deploymentzustand, Validierung, Schema, Hashes oder Patchmetadaten geprüft werden sollen.
4. Bei Änderungen zuerst die kanonischen Dateien und vorhandenen Tests verstehen.
5. Nach materieller Arbeit README und diese Übergabe im selben Change aktualisieren.
6. Keine Secrets oder privaten URLs in Repository, Antworten, Screenshots oder Commits ausgeben.
