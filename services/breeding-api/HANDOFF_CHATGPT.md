# Übergabe an ChatGPT: Palworld Breeding API

Diese Datei ist eine selbstständige Übergabe für einen neuen ChatGPT-Chat. Sie enthält keine Secretwerte.

## Projektstatus

| Feld | Wert |
|---|---|
| Projekt | Palworld Breeding API |
| Repository | MC-Micro/pal-tool |
| Branch | feature/palworld-breeding-api |
| Pull Request | NOT_AVAILABLE |
| Head-Commit | NOT_VERIFIABLE |
| Workername | palworld-breeding-api |
| Deploymentstatus | BLOCKED |
| workers.dev-Basisadresse | NOT_AVAILABLE |
| BREEDING_READ_TOKEN | NOT_VERIFIABLE; kein Wert in dieser Datei |
| Kanonisches Schema | 3 |
| API-Referenzschema | 1 |
| Kanonische Pals | 299 |
| Spezialkombinationen | 136 |
| Datenhash | febbf5f9fb594040d027724d20c9a475aea466f8d5b7ab1d6faa304a1257e26f |
| Generiertes Artefakt SHA-256 | 497eeb6e190e87fb51a2533e3a449387920888b3e95810d0388a42ab4d446af5 |
| Teststatus | Lint PASS; Typecheck PASS; 41/41 Tests PASS; Worker-Dry-Run PASS (1.419,88 KiB / gzip 347,29 KiB); strukturelle Validierung PASS; Determinismus PASS; Secret-Scan PASS; Release-Validierung erwartungsgemäß BLOCKED |

Head-Commit ist absichtlich nicht in der Datei festgeschrieben: Solange die Arbeit uncommitted ist, ist er nicht verifizierbar, und eine Datei kann nicht stabil den SHA des Commits enthalten, der ihren eigenen Inhalt erst festlegt. Der tatsächliche finale SHA muss nach dem letzten Commit mit git rev-parse HEAD ermittelt und im externen Abschlussbericht genannt werden.

## Ziel und Architektur

Das isolierte Modul services/breeding-api erzeugt aus der bestehenden kanonischen Palworld-Zuchtreferenz eine kompakte Read-only-API für Cloudflare Workers.

Kanonische Lesereihenfolge:

1. data/palworld-breeding/breeding_rules.json
2. data/palworld-breeding/special_combinations.json
3. data/palworld-breeding/pal_values.json
4. data/palworld-breeding/manifest.json

Der Build erzeugt eine deterministische Referenz mit:

- Pal- und Aliasindex
- aufgelöster direkter Paarmatrix
- geschlechtsabhängigen Spezial-Overrides
- Elternpaaren nach Zielkind
- Carrier-Adjazenz für theoretische Artenrouten
- Quellenhashes, Status und Validierungskonflikten

Der Worker ist read-only, ruft zur Laufzeit weder GitHub noch Drittanbieter-Zuchtrechner auf und schützt alle v1-Endpunkte durch BREEDING_READ_TOKEN im ersten Pfadsegment.

## Blockierende fachliche Konflikte

Deployment ist BLOCKED, weil die Release-Validierung zwei Widersprüche korrekt meldet.

### 1. Sibelyx/Lamball

SIBELYX_LAMBALL_ASSIGNMENT_CONFLICT

Aufgabenanforderung:

> Sibelyx + Lamball → Surfent; Gobfin Ignis soll als normales Formelkind ausgeschlossen sein.

Kanonische Referenz:

- Sibelyx / WhiteMoth: CombiRank 1810
- Lamball / SheepBall: CombiRank 3050
- Formelziel: floor((1810 + 3050 + 1) / 2) = 2430
- Gobfin Ignis / SharkKid_Fire: CombiRank 2430 und IgnoreCombi = false
- Surfent / Serpent: CombiRank 2440
- Ergebnis der kanonischen normalen Formel: Gobfin Ignis

Damit widerspricht der erwartete Surfent-Test den vorhandenen kanonischen Dateien. validate:release muss fehlschlagen, solange dieser Konflikt existiert. Weder Test noch Release-Gate dürfen entfernt, übersprungen oder künstlich grün gemacht werden.

Die hypothetische Regel „alle Spezialkinder aus dem normalen Kandidatenpool entfernen“ betrifft 77 derzeit zugelassene Spezialkind-Arten und würde 13.785 von 44.850 ungeordneten Paarergebnissen ändern. Eine Auflösung darf daher nicht nur Gobfin Ignis punktuell umschalten, sondern muss die globale Spielregel anhand direkter Spieldaten entscheiden.

Erforderliche fachliche Entscheidung:

1. Aktuelle direkte Palworld-Spieldaten oder gleichwertige Primärquellen prüfen.
2. Falls die kanonischen Dateien veraltet oder falsch sind, diese samt Manifest und Quellen-Pins nachvollziehbar aktualisieren.
3. Falls die Aufgabenannahme Surfent falsch ist, die erwartete Fixture nach ausdrücklicher fachlicher Entscheidung auf Gobfin Ignis korrigieren.
4. Danach die gesamte Prüf- und Release-Kette erneut ausführen.

### 2. Nicht dokumentierter letzter Gleichstands-Fallback

`UNDOCUMENTED_EQUAL_RARITY_SOURCE_ORDER_FALLBACK`

Bei Zielrang 2065 können nach den dokumentierten Seltenheitsregeln beispielsweise Mossanda (2060, Seltenheit 6) und Penking (2070, Seltenheit 6) gleichberechtigt übrig bleiben. `breeding_rules.json` definiert dafür keinen letzten Schritt. Der gepinnte PalworldSaveTools-Quellalgorithmus prüft den höheren Rang zuerst und behält ihn, weshalb die generierte Referenz vorläufig Penking verwendet. Diese Implementierung ist ausdrücklich markiert und blockiert die Freigabe, bis direkte Spieldaten den letzten Fallback bestätigen und `breeding_rules.json` ihn verbindlich dokumentiert.

## Relevante Dateien

Kanonische Quellen:

- data/palworld-breeding/breeding_rules.json
- data/palworld-breeding/special_combinations.json
- data/palworld-breeding/pal_values.json
- data/palworld-breeding/manifest.json

API-Modul:

- services/breeding-api/package.json
- services/breeding-api/pnpm-lock.yaml
- services/breeding-api/pnpm-workspace.yaml
- services/breeding-api/tsconfig.json
- services/breeding-api/eslint.config.js
- services/breeding-api/vitest.config.ts
- services/breeding-api/wrangler.jsonc
- services/breeding-api/src/types.ts
- services/breeding-api/src/breeding.ts
- services/breeding-api/src/auth.ts
- services/breeding-api/src/http.ts
- services/breeding-api/src/reference.ts
- services/breeding-api/src/routes.ts
- services/breeding-api/src/index.ts
- services/breeding-api/scripts/build-reference.ts
- services/breeding-api/scripts/validate-reference.ts
- services/breeding-api/scripts/check-deterministic.ts
- services/breeding-api/scripts/scan-secrets.ts
- services/breeding-api/README.md
- services/breeding-api/HANDOFF_CHATGPT.md
- services/breeding-api/test/api.test.ts
- services/breeding-api/test/breeding.test.ts
- services/breeding-api/test/generated-data.test.ts

Repository-Automation:

- .gitattributes
- .gitignore
- AGENTS.md
- .github/workflows/breeding-api-ci.yml
- .github/workflows/deploy-breeding-api.yml

Die endgültige Dateiliste muss vor dem Abschluss erneut mit git status und git diff --name-status ermittelt werden.

## API-Endpunkte

Geschützte Basisadresse:

~~~text
https://palworld-breeding-api.<CLOUDFLARE_SUBDOMAIN>.workers.dev/<BREEDING_READ_TOKEN>/v1
~~~

Endpunkte:

- GET /status — kompakter Versions-, Hash- und Validierungsstatus
- GET /pal?name=<NAME> — deutsche, englische oder interne Namensauflösung
- GET /pair?parent_a=<NAME>&parent_b=<NAME>&gender_a=<MALE|FEMALE|ANY>&gender_b=<MALE|FEMALE|ANY> — direkte Paarung mit Rechenweg
- GET /parents?child=<NAME> — alle Eltern eines Ziel-Pals
- GET /children?parent=<NAME> — mögliche zweite Eltern und Kinder eines Trägers
- GET /route?carrier=<NAME>&target=<NAME>&max_generations=<N> — theoretisch kürzeste Artenroute
- GET /reference — kompakte Gesamtreferenz
- GET /validate — strukturelle Prüfung und ungelöste Konflikte

Falsches oder fehlendes Token muss neutral HTTP 404 liefern. Schreibende Methoden müssen HTTP 405 liefern.

## Lokale Befehle

Aus dem Repository:

~~~powershell
cd services/breeding-api
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
~~~

Aktuell verifiziert:

- Lint: PASS
- Typecheck: PASS
- Tests: 41/41 PASS in 3 Testdateien
- Worker-Dry-Run: PASS; Upload 1.419,88 KiB, gzip 347,29 KiB
- strukturelle Validierung: PASS
- deterministischer Build: PASS
- Secret-Scan: PASS
- bestehende PWA-Validierung: PASS (102 Passives und Cache-Verweise konsistent)
- `validate:release`: erwartungsgemäß FAIL/BLOCKED wegen der beiden dokumentierten Fachkonflikte
- Ein Deployment darf deshalb nicht stattfinden.

## CI und Deployment

CI-Workflow:

~~~text
.github/workflows/breeding-api-ci.yml
~~~

Er läuft bei relevanten Pull Requests nach main und Pushes auf main, feature/** und release/**.

Manueller Deployment-Workflow:

~~~text
.github/workflows/deploy-breeding-api.yml
~~~

GitHub-Pfad:

~~~text
Repository → Actions → Deploy Breeding API → Run workflow
~~~

Der Workflow verwendet ausschließlich:

- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ACCOUNT_ID

BREEDING_READ_TOKEN wird nicht an GitHub Actions übergeben. wrangler deploy wird mit --keep-vars ausgeführt, damit das bestehende Worker-Secret erhalten bleibt.

Der Job besitzt zusätzlich einen harten `refs/heads/main`-Guard und verwendet das GitHub-Environment `production`. Die Environment-Branch-Policy und ein Required Reviewer müssen in den Repository-Einstellungen manuell aktiviert werden.

Empfohlen: Beide Cloudflare-Credentials in `production` als Environment-Secrets anlegen, den Workflow einmal erfolgreich prüfen und erst danach die gleichnamigen Repository-Secrets entfernen.

## Exakte manuelle Restschritte

1. Den Sibelyx/Lamball-Widerspruch anhand aktueller direkter Spieldaten fachlich auflösen.
2. Den letzten Gleichstands-Fallback anhand direkter Spieldaten bestätigen und in `breeding_rules.json` festschreiben.
3. Belegte Korrekturen an kanonischen Daten, Regeln oder erwarteter Fixture umsetzen; Release-Gates nicht abschwächen.
4. pnpm install --frozen-lockfile aus services/breeding-api ausführen.
5. pnpm run generate ausführen.
6. pnpm run lint ausführen.
7. pnpm run typecheck ausführen.
8. pnpm run test ausführen.
9. pnpm run build:worker ausführen.
10. pnpm run validate ausführen.
11. pnpm run validate:release ausführen und einen erfolgreichen Exitcode verlangen.
12. pnpm run check:deterministic ausführen.
13. pnpm run scan:secrets ausführen.
14. git diff --check und git status --short ausführen.
15. Änderungen committen und den tatsächlichen Head-SHA erfassen.
16. Branch feature/palworld-breeding-api pushen.
17. Pull Request nach main erstellen; URL in die externe Übergabe übernehmen.
18. CI vollständig abwarten und keinen fehlgeschlagenen Check ignorieren.
19. PR nach Prüfung mergen.
20. Kontrollieren, dass CLOUDFLARE_API_TOKEN und CLOUDFLARE_ACCOUNT_ID derzeit als GitHub Repository Secrets existieren.
21. Settings → Environments → production öffnen, Deployment-Branches auf `main` beschränken, nach Möglichkeit einen Required Reviewer setzen und beide Cloudflare-Credentials als Environment-Secrets anlegen.
22. Actions → Deploy Breeding API → Run workflow auf `main` manuell starten.
23. Die vom Workflow beziehungsweise Cloudflare gemeldete workers.dev-Adresse erfassen.
24. Im Cloudflare-Dashboard den Worker palworld-breeding-api öffnen.
25. Settings → Variables and Secrets → Add auswählen.
26. BREEDING_READ_TOKEN als Secret mit einem zufälligen Wert von mindestens 32 Bytes setzen.
27. Secret speichern und die entsprechende Worker-Version deployen.
28. Die URL /<TOKEN>/v1/status mit korrektem Token testen.
29. /<TOKEN>/v1/validate prüfen.
30. Bekannte Paarungen über /pair prüfen.
31. Einen falschen Token testen; erwartet wird HTTP 404.
32. Worker-Basisadresse und echten Lesecode ausschließlich in private ChatGPT-Projekthinweise oder eine private Projektquelle kopieren.
33. Nach erfolgreichem Environment-Secret-Test die gleichnamigen Repository-Secrets entfernen.
34. Diese HANDOFF-Datei niemals mit dem echten Token ergänzen.

Alternativer Secret-Befehl nach vorhandenem Worker:

~~~powershell
cd services/breeding-api
pnpm exec wrangler secret put BREEDING_READ_TOKEN
~~~

Der Wert wird interaktiv eingegeben und darf nicht als Befehlsargument erscheinen.

## Rollback

Cloudflare:

1. Worker → Deployments beziehungsweise Versions öffnen.
2. Letzte bekannte gute Version auswählen und erneut deployen.
3. BREEDING_READ_TOKEN-Bindung prüfen.
4. status, validate, bekannte pair-Abfragen und falsches Token testen.

Repository:

1. Fehlerhaften Commit mit git revert rückgängig machen.
2. Gesamte Prüfkette einschließlich validate:release ausführen.
3. Manuellen Deployment-Workflow erneut starten.

Kanonische Daten, Manifest und Quellen-Pins immer gemeinsam konsistent halten.

## Fertiger Text für private ChatGPT-Projekthinweise

Den Platzhalter <BREEDING_READ_TOKEN> ausschließlich in den privaten Projekthinweisen oder einer privaten Projektquelle ersetzen, niemals im Repository:

~~~text
Für gewöhnliche Palworld-Zuchtabfragen zuerst die geschützte Read-only Breeding-API verwenden.

Basisadresse:
https://palworld-breeding-api.<CLOUDFLARE_SUBDOMAIN>.workers.dev/<BREEDING_READ_TOKEN>/v1

Beim ersten Zuchtauftrag eines neuen Chats zuerst /status und anschließend /validate prüfen.

Die API darf nur als primäre Quelle verwendet werden, wenn:
- /status erreichbar und ok ist
- validation_status gültig ist
- /validate keine blockierenden Konflikte meldet
- der Datenstand nicht älter als ein neuer zuchtrelevanter Palworld-Patch ist

Endpunkte:
- /pal für Pal-Werte und Namensauflösung
- /pair für direkte Elternkombinationen
- /parents für mögliche Eltern eines Ziel-Pals
- /children für Weiterzuchten eines vorhandenen Arten-Trägers
- /route für theoretisch kürzeste Artenrouten
- /reference nur bei umfassendem Datenbedarf

Die API liefert Arten- und Zuchtdaten. Die praktische Passivplanung muss zusätzlich meinen tatsächlichen Bestand, Geschlechter, Passiven, unerwünschte Passiven, IVs und Zwischenprodukte berücksichtigen.

Den GitHub-Connector nur verwenden, wenn:
- /status oder /validate nicht erreichbar ist
- der Status ungültig, needs_review oder unbekannt ist
- ein neuer zuchtrelevanter Patch erschienen ist
- ein Ergebnis widersprüchlich ist
- die Referenz aktualisiert werden muss
- oder Dateien geändert werden sollen

Bei jeder Zuchtplanung:
1. bereits genannten Bestand verwenden
2. gleiche Art und Spezialkombinationen vor der Formel prüfen
3. Geschlechtsvorgaben beachten
4. möglichst wenige praktische Generationen priorisieren
5. Vererbungswahrscheinlichkeit und Trash-Passiven berücksichtigen
6. Eier-, Kuchen- und Zeitaufwand minimieren
7. keine Paldeck-Nummer als Zuchtwert verwenden
8. keine fehlenden Werte erfinden
9. Artenroute der API nicht mit einer vollständigen Passive-Route verwechseln
~~~

## ChatGPT-Verifikationsschritte nach Übergabe

Erst nach Auflösung des Blockers und erfolgreichem Deployment:

1. /status mit korrektem Token abrufen.
2. Prüfen, dass api_schema_version, breeding_reference_schema_version, Pal-Zähler und Spezialkombinationszähler plausibel sind.
3. Prüfen, dass known_patch_check_status nicht unbelegt current behauptet.
4. /validate abrufen und null blockierende Konflikte verlangen.
5. Elphidran + Surfent → Elphidran Aqua über /pair prüfen.
6. Anubis + Eikthyrdeer Terra → Kingpaca Cryst über /pair prüfen.
7. Kingpaca Cryst + Jolthog → Elphidran über /pair prüfen.
8. Anubis + Anubis → Anubis und Regel same_species prüfen.
9. Beide Elternreihenfolgen einer geschlechtsabhängigen Spezialkombination prüfen.
10. Den fachlich aufgelösten Sibelyx/Lamball-Ausgang explizit prüfen und mit der dokumentierten Entscheidung vergleichen.
11. Einen falschen Token testen und ausschließlich HTTP 404 akzeptieren.
12. generated_at_utc, game_reference und Datenstand gegen manifest.json sowie den aktuellen Palworld-Patch prüfen.
13. Erst danach die API als primäre Arten-Zuchtreferenz verwenden.

## Zusammenfassung für den nächsten Agenten

- Nicht deployen.
- Die oben aufgeführten bestandenen lokalen Prüfungen dürfen als bestanden gemeldet werden; `validate:release` bleibt rot.
- Release-Validierung nicht umgehen.
- Zuerst beide dokumentierten Fachkonflikte lösen.
- Danach vollständige Checks, Commit, PR, CI, manueller Deploy, Worker-Secret und Live-Verifikation durchführen.
