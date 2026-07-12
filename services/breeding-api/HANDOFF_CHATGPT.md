# Übergabe an ChatGPT: Palworld Breeding API

Diese Datei informiert einen neuen Chat ohne Kenntnis der Codex-Sitzung. Sie enthält keine Secretwerte.

## Projektstatus

| Feld | Wert |
|---|---|
| Repository | `MC-Micro/pal-tool` |
| Branch | `feature/palworld-breeding-api` |
| Pull Request | https://github.com/MC-Micro/pal-tool/pull/3 |
| Head-Commit | Dynamisch vom PR-Head auflösen; letzter vollständiger Implementierungscommit: `PENDING_LOCAL_COMMIT` |
| Deployment | `NOT_DEPLOYED` |
| Worker | `palworld-breeding-api` |
| Worker-Basisadresse | `NOT_AVAILABLE` |
| BREEDING_READ_TOKEN | `NOT_SET`; niemals hier eintragen |
| Kanonisches Schema | 4 |
| API-/Artefaktschema | 2 |
| source_data_hash | `77901fb00c984e360f563049f2e7f3dc64a6b2d764e77f3c32a737ef4bc82121` |
| generated_artifact_hash | `882987ec7c8a1eae7855e9bb3d995b79cb0aa498da2042c00fa6faec326ad9b8` |
| Pals | 299 |
| normale Formel-Kinder | 184 |
| Spezialkombinationen | 136 |
| eindeutige Spezialkind-Arten | 90 |
| ungeordnete Paare | 44.850 |
| Policy-geänderte Paarergebnisse | 13.785 |
| Release-Gate | PASS, null ungelöste Konflikte |
| CI | Vor Push dieses Fortsetzungsstands noch nicht verifizierbar; aktuellen PR-Head prüfen |

Ein Commit kann seinen eigenen SHA nicht stabil im eigenen Dateiinhalt speichern. Deshalb ist der tatsächliche finale SHA im PR-Head beziehungsweise externen Abschlussblock maßgeblich; der Implementierungscommit wird vor der letzten Handoff-Aktualisierung eingetragen.

## Ziel und Architektur

Das isolierte Modul `services/breeding-api/` erzeugt eine deterministische Read-only-API für Cloudflare Workers. Kanonische Lesereihenfolge:

1. `data/palworld-breeding/breeding_rules.json`
2. `data/palworld-breeding/special_combinations.json`
3. `data/palworld-breeding/pal_values.json`
4. `data/palworld-breeding/manifest.json`

Der Build erzeugt `generated/reference.json` und `generated/special-child-impact.json`, eine direkte Paarmatrix, beide reale Gegen-Geschlechtsorientierungen, Reverse-Elternindex und Carrier-Graph. Runtime-Aufrufe an GitHub oder Palworld.gg existieren nicht.

## Bestätigte Spielregeln

Direkte Palworld-1.0-Eiertests vom 13.07.2026:

- `Lunaris MALE + Grintale FEMALE → Penking`
- `Sibelyx + Lamball → Surfent`

Damit bestätigt:

- Same-Species-Identität zuerst.
- direkte Spezialkombination vor Formel.
- Geschlechtsvorgaben sind bindend.
- jede Art aus `special_combinations.child_internal` ist aus dem normalen Formelpool ausgeschlossen.
- Same-Species bleibt auch für solche Spezialkind-Arten gültig.
- vollständig gleiche Cross-Rank-Ties wählen den höheren `CombiRank`.
- Same-Rank-Duplikate verwenden separat Priority, Nicht-Variante und interne Reihenfolge.
- Paldeck-Nummern werden nie verwendet.

Palworld.gg war nur ein manueller, nicht-kanonischer Crosscheck und ist kein Release-Gate.

## Patchstatus

- Status: `current`
- geprüfte Version: `Palworld 1.0`
- Prüftag: `2026-07-13`, Europe/Berlin, nur Datumspräzision
- geprüfter Build: `NOT_VERIFIED`
- Build verifiziert: `false`
- zuchtrelevante Änderungen gefunden: `true`
- erneute Prüfung nach neuerer Version: `true`

`current` gilt ausschließlich für Version 1.0 und diesen Prüftag.

## Auswirkungen und bekannte Routen

Der normale Pool schrumpft von 261 auf 184. Der vollständige Report listet 13.785 Änderungen in `services/breeding-api/generated/special-child-impact.json`.

Wichtige Ergebnisse:

- `Sibelyx + Lamball → Surfent`
- `Lunaris + Grintale → Penking`
- `Anubis + Eikthyrdeer Terra → Bakemi` — früher fälschlich Kingpaca Cryst
- `Anubis + Panthalus → Knocklem` — früher fälschlich Dualith Noct
- `Dualith Noct + Jolthog → Vanwyrm` — früher fälschlich Elphidran Aqua
- `Kingpaca Cryst + Jolthog → Elphidran` bleibt gültig
- `Elphidran + Surfent → Elphidran Aqua` bleibt gültige Spezialkombination

Die aktualisierte exhaustive Bestandsanalyse unter `data/palworld-breeding/analysis/anubis_jolthog_route.json` findet für den festen Jolthog keine direkte zweistufige Route vom Anubis über einen beliebigen blanken Mate zu Elphidran, Surfent oder Elphidran Aqua. Das schließt längere Routen nicht aus.

## Geschlechtsindex

Für jedes verschiedene Artenpaar werden `A MALE + B FEMALE` und `A FEMALE + B MALE` kanonisch ausgewertet. Bei einem einseitigen Gender-Special fällt die Gegenrichtung korrekt auf die Formel zurück. `ANY` wird nur bei identischem vollständigem Ergebnis beider Richtungen verwendet. Synthetische Tests prüfen Special, Formel-Fallback, umgekehrte Elternreihenfolge, Reverse-Index und Carrier-Graph.

## Hashbedeutung

- `source_data_hash`: deterministischer Hash der vier kanonischen Eingabedateien.
- `generated_artifact_hash`: deterministischer Hash der generierten Referenz ohne seine eigenen Hashfelder.

ETag und `reference_id` verwenden den Artefakt-Hash. `/status`, `/reference` und `/validate` benennen beide Hasharten ausdrücklich; ein Feld `generated_hash`, das nur den Source-Hash wiederholt, existiert nicht.

## API

Basis nach Deployment:

```text
https://palworld-breeding-api.<CLOUDFLARE_SUBDOMAIN>.workers.dev/<BREEDING_READ_TOKEN>/v1
```

- `/status`
- `/pal?name=<NAME>`
- `/pair?parent_a=<NAME>&parent_b=<NAME>&gender_a=<MALE|FEMALE|ANY>&gender_b=<MALE|FEMALE|ANY>`
- `/parents?child=<NAME>`
- `/children?parent=<NAME>`
- `/route?carrier=<NAME>&target=<NAME>`
- `/reference`
- `/validate`

Falsches oder fehlendes Token: neutrale HTTP 404. Schreibmethoden: nach gültiger Authentifizierung HTTP 405.

`/route` kennzeichnet maschinenlesbar:

- `species_route_only: true`
- `inventory_aware: false`
- `passive_aware: false`
- `iv_aware: false`
- `unwanted_passives_aware: false`
- `egg_cost_aware: false`
- `cake_cost_aware: false`
- `time_cost_aware: false`
- `offspring_gender_feasibility_checked: false`

## Tests und CI

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

Zuletzt lokal verifiziert:

- `pnpm install --frozen-lockfile` PASS; 263 Lockfile-Einträge bestanden die Supply-Chain-Prüfung
- Lint PASS
- Typecheck PASS
- 58/58 Tests in 3 Dateien PASS
- Worker-Dry-Run PASS; 1.426,51 KiB / gzip 334,54 KiB; kein Deployment
- strukturelle Validierung PASS
- Release-Validierung PASS
- deterministische Doppelgenerierung PASS; kombinierter Artefaktdatei-Hash `790d6891c7bdeef24c691c5650f2229f98e5119f79de13c5a03f0d68f144f81d`
- Secret-Scan PASS
- bestehende PWA-Validierung PASS; 102 Passives, Datenstruktur, PWA-Dateien und Cache-Verweise konsistent
- null ungelöste Konflikte

Alle direkten Dependencies sind exakt gemäß Lockfile gepinnt. Alle 14 Drittanbieter-Action-Verwendungen nutzen verifizierte v4-Full-SHAs. `Breeding API CI` prüft zusätzlich die bestehende Root-PWA und verweigert uncommittete Generated-Abweichungen. Das Deployment bleibt manuell, `main`-only und im Environment `production`.

Die beiden alten schreibenden Referenz-/Analyse-Workflows wurden auf read-only Schema-4-Validierung umgestellt; sie können kanonische Daten und die Anubis-Analyse nicht mehr automatisch mit Altlogik überschreiben. Dadurch werden nun insgesamt 14 Action-Verwendungen per verifiziertem Full-SHA gepinnt.

## Manuelle Restschritte

1. PR-CI vollständig grün prüfen und PR reviewen/mergen.
2. GitHub Environment `production`, Main-Policy und Cloudflare-Credentials prüfen.
3. `Deploy Breeding API` auf `main` manuell starten.
4. Nach dem ersten Deployment `BREEDING_READ_TOKEN` als Worker-Secret setzen.
5. `/status`, `/validate`, bekannte Paarungen und falschen Token prüfen.
6. Worker-Basisadresse und Token nur in private ChatGPT-Projekthinweise übernehmen.

In diesem Codex-Lauf: kein Merge, kein Deployment, keine Secretänderung.

## Live-Prüfschritte

1. `/status`: Schema 4/2, beide Hashes, Zähler und Patchcheck prüfen.
2. `/validate`: `ok=true`, null Konflikte und Impact 13.785/44.850 verlangen.
3. `/pair`: Elphidran+Surfent, Sibelyx+Lamball, Lunaris+Grintale, Anubis+Eik Terra und Kingpaca Cryst+Jolthog prüfen.
4. Katress/Wixen in beiden Geschlechtsrichtungen und beiden Elternreihenfolgen prüfen.
5. falscher Token muss neutral 404 liefern.
6. Patchstand mit einer gegebenenfalls neueren Palworld-Version vergleichen.

## Fertiger Text für private ChatGPT-Projekthinweise

```text
Für gewöhnliche Palworld-Zuchtabfragen zuerst die geschützte Read-only Breeding-API verwenden.

Basisadresse:
https://palworld-breeding-api.<CLOUDFLARE_SUBDOMAIN>.workers.dev/<BREEDING_READ_TOKEN>/v1

Beim ersten Zuchtauftrag eines neuen Chats zuerst /status und /validate prüfen. Die API nur als primäre Artenquelle verwenden, wenn validation_status gültig ist, /validate keine Konflikte meldet und der dokumentierte Palworld-Stand nicht durch eine neuere zuchtrelevante Version überholt wurde.

/pal für Namen und Werte, /pair für direkte Paarungen, /parents und /children für Indizes, /route nur für theoretische Artenrouten und /reference nur bei umfassendem Datenbedarf verwenden.

Die praktische Planung muss zusätzlich tatsächlichen Bestand, Geschlechter, Passiven, Trash-Passiven, IVs, Eier-, Kuchen- und Zeitaufwand berücksichtigen. /route ist ausdrücklich nicht bestands-, passiv-, geschlechts- oder kostenoptimiert.

Den GitHub-Connector nur verwenden, wenn API/Status ungültig, veraltet, widersprüchlich oder nicht erreichbar ist oder Dateien aktualisiert werden sollen. Same-Species und Spezialkombinationen vor Formel prüfen, Spezialkinder aus dem normalen Formelpool ausschließen, Geschlechtsvorgaben beachten, keine Paldeck-Nummer verwenden und keine Werte erfinden.
```
