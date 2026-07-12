# Palworld Breeding API

Read-only Cloudflare-Worker-API für schnelle und reproduzierbare Palworld-Zuchtberechnungen. Sie erzeugt aus der kanonischen Referenz des Repositorys kompakte Vorwärts-, Rückwärts- und Routenindizes. Zur Laufzeit werden weder GitHub noch externe Zuchtrechner abgefragt.

## Aktueller Release-Status

Das Produktionsdeployment ist derzeit bewusst blockiert.

Die Aufgabenanforderung erwartet:

> Sibelyx + Lamball → Surfent; Gobfin Ignis darf kein normales Formelkind sein.

Die kanonischen Dateien ergeben dagegen:

- Sibelyx / WhiteMoth: CombiRank 1810
- Lamball / SheepBall: CombiRank 3050
- Zielwert: floor((1810 + 3050 + 1) / 2) = 2430
- Gobfin Ignis / SharkKid_Fire: CombiRank 2430, IgnoreCombi = false
- Surfent / Serpent: CombiRank 2440

Damit ist Gobfin Ignis nach der aktuellen kanonischen Formel der exakte Treffer. Der Generator meldet deshalb den blockierenden Konflikt `SIBELYX_LAMBALL_ASSIGNMENT_CONFLICT`.

Die Aufgabenannahme „Spezialkinder sind ausschließlich über Spezialkombinationen zulässig“ wäre systemweit relevant: 77 derzeit normal zugelassene Arten erscheinen zugleich als direkte Spezialkinder. Ein hypothetischer Ausschluss dieser Arten verändert 13.785 der 44.850 ungeordneten Paarergebnisse. Der Konfliktbericht quantifiziert deshalb die vollständige potenzielle Reichweite und nicht nur Sibelyx + Lamball.

Eine zweite Lücke betrifft gleich weit entfernte Kind-Ränge mit identischer Seltenheit. `breeding_rules.json` endet hier ohne letzten Fallback. Der gepinnte PalworldSaveTools-Quellalgorithmus prüft den höheren Rang zuerst und behält ihn; der Generator bildet dieses Verhalten deterministisch nach, kennzeichnet es jedoch als `UNDOCUMENTED_EQUAL_RARITY_SOURCE_ORDER_FALLBACK` und blockiert die Freigabe bis zur kanonischen Bestätigung.

Strukturelle Prüfungen dürfen weiterhin laufen; `validate:release` muss fehlschlagen, bis beide Widersprüche fachlich aufgelöst wurden. Die Konflikte dürfen nicht durch Abschalten oder Abschwächen der Release-Prüfung umgangen werden.

## Architektur

Der Datenfluss ist:

1. Vier kanonische JSON-Dateien werden in verbindlicher Reihenfolge gelesen.
2. Der Generator validiert Schema, Zähler, IDs, Regelreihenfolge und Querverweise.
3. Eine deterministische Breeding Engine löst gleiche Arten, Spezialkombinationen und die normale Werteformel auf.
4. Der Build schreibt generated/reference.json.
5. Die Referenz enthält eine gepackte obere Dreiecksmatrix für direkte Paarungen, Geschlechts-Overrides, einen Rückwärtsindex nach Kind und einen vollständigen gerichteten Carrier-Graph mit allen Partnerzeugen für theoretische Artenrouten.
6. Der Cloudflare Worker bündelt diese Referenz und beantwortet ausschließlich Read-only-Anfragen.

Die stabile interne Pal-ID ist maßgeblich. Deutsche und englische Namen sowie Game-Table-Namen sind nur normalisierte Aliase. Mehrdeutige Aliase werden nicht geraten.

Die Paarmatrix enthält bei 299 Pals 44.850 ungeordnete Paare einschließlich gleicher Arten. Sie speichert Kind-IDs als Uint16 und Regelcodes als Uint8 in Base64. Geschlechtsabhängige Spezialkombinationen werden separat gespeichert. Der Rückwärtsindex und der vollständige Carrier-Graph mit 89.403 gerichteten Paarergebnissen werden beim Build erzeugt, damit Requests keine vollständige O(n²)-Berechnung wiederholen und gleich kurze Partneralternativen erhalten bleiben.

Quelltexte werden vor Hashing und Parsing auf LF normalisiert; `.gitattributes` erzwingt zusätzlich LF für Textdateien. Dadurch bleiben Daten-Hash und generiertes Artefakt zwischen Windows und Linux identisch.

## Kanonische Quellen

Die verbindliche Lesereihenfolge lautet:

1. ../../data/palworld-breeding/breeding_rules.json
2. ../../data/palworld-breeding/special_combinations.json
3. ../../data/palworld-breeding/pal_values.json
4. ../../data/palworld-breeding/manifest.json

Aktueller Snapshot:

- kanonisches Schema: 3
- Pals: 299
- artverschiedene Spezialkombinationen: 136
- bekannte Gruppe mit identischem CombiRank: 1
- Spielreferenz: Palworld 1.0 direct game-table snapshot

Die API beachtet die in breeding_rules.json dokumentierte Reihenfolge:

1. Gleiche Art ergibt dieselbe Art.
2. Danach gilt eine passende Spezialkombination einschließlich Geschlechtsbedingung.
3. Erst danach wird die normale Formel angewandt.
4. Nur Pals mit CombiRank größer 0 und IgnoreCombi = false sind normale Kind-Kandidaten.
5. Der kleinste Abstand zum Ziel-CombiRank gewinnt.
6. Gleich weit entfernte unterschiedliche Ränge werden über die Nähe zum Seltenheitsdurchschnitt der Eltern und danach über niedrigere Seltenheit aufgelöst.
7. Identische Kind-Ränge werden über CombiDuplicatePriority, Nicht-Variante und InternalIndex aufgelöst.

Für den derzeit nicht explizit dokumentierten Restfall „verschiedene gleich weit entfernte Ränge und identische Kind-Seltenheit“ verwendet der Generator vorläufig den höheren CombiRank gemäß dem gepinnten Quellalgorithmus. Diese Umsetzung ist sichtbar dokumentiert und release-blockierend.

Eine Paldeck-Nummer ist niemals Zuchtwert oder Tie-Breaker.

## Voraussetzungen

- Node.js 22 oder neuer
- pnpm 11.7.0
- für Deployment: Cloudflare-Konto und Wrangler-Zugriff
- für GitHub Actions: Repository-Secrets CLOUDFLARE_API_TOKEN und CLOUDFLARE_ACCOUNT_ID

Das Modul ist vom frameworkfreien Root-Projekt isoliert. Befehle werden aus services/breeding-api ausgeführt.

## Lokaler Build und Prüfungen

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

Verfügbare Package-Skripte:

| Skript | Zweck |
|---|---|
| generate | Erzeugt generated/reference.json aus den kanonischen Dateien. |
| lint | Prüft TypeScript und Konfiguration mit ESLint. |
| typecheck | Führt TypeScript ohne Ausgabe aus. |
| test | Führt die Vitest-Suite einmalig aus. |
| test:coverage | Führt Tests mit Coverage aus. |
| build:worker | Erstellt mit Wrangler einen lokalen Dry-Run-Bundlecheck ohne Deployment. |
| validate | Prüft Struktur, kanonische Fixtures und gepackte Indizes; bekannte Aufgabenwidersprüche blockieren diesen Modus nicht allein. |
| validate:release | Verlangt zusätzlich null ungelöste blockierende Konflikte. |
| check:deterministic | Generiert zweimal und vergleicht die SHA-256-Hashes. |
| scan:secrets | Sucht in Textartefakten nach versehentlich eingebetteten Secretwerten. |
| ci | Führt die normale lokale Prüfkette aus; für Releases zusätzlich immer validate:release ausführen. |
| deploy | Führt wrangler deploy aus. Der GitHub-Workflow verwendet zusätzlich --keep-vars. |

Die beiden aktuellen Fachkonflikte bedeuten, dass `validate:release` erwartungsgemäß mit Exitcode 1 endet. Das ist ein Schutzmechanismus, kein Grund, den Test zu entfernen.

Der verifizierte Wrangler-Dry-Run erzeugt derzeit ein Bundle von 1.419,88 KiB beziehungsweise 347,29 KiB gzip und führt kein Deployment aus.

## Zugriffsschutz

Der Worker erwartet das Cloudflare-Worker-Secret BREEDING_READ_TOKEN im ersten URL-Pfadsegment:

~~~text
https://palworld-breeding-api.<CLOUDFLARE_SUBDOMAIN>.workers.dev/<BREEDING_READ_TOKEN>/v1/status
~~~

Regeln:

- Das echte Token wird niemals committed, geloggt, in Snapshots geschrieben oder in generierte JSON-Dateien eingebettet.
- CLOUDFLARE_API_TOKEN ist ausschließlich ein Deployment-Credential und nicht der Lesecode.
- Fehlender oder falscher Lesecode liefert nur eine neutrale HTTP-404-Antwort.
- Es gibt keine Cookies, Sessions, OAuth-, CAPTCHA-, Login- oder Cloudflare-Access-Abhängigkeit.
- Das Token kann ohne Codeänderung rotiert werden.
- Der URL-Token ist nur eine einfache Zugriffsschranke für nicht vertrauliche Read-only-Daten. Er kann in Browserhistorien, Proxy- oder Plattformlogs sichtbar werden und ist nicht für private Daten geeignet.

## HTTP-Verhalten

Unterstützt werden GET, HEAD und notwendige OPTIONS-Anfragen. Schreibende Methoden werden mit HTTP 405 abgelehnt.

JSON-Antworten verwenden mindestens:

- Content-Type: application/json; charset=utf-8
- X-Content-Type-Options: nosniff
- X-Robots-Tag: noindex, nofollow, noarchive
- Cache-Control und ETag, wo sinnvoll

If-None-Match kann bei cachebaren Antworten HTTP 304 auslösen. CORS darf für diese nicht vertrauliche Read-only-API auf * stehen; es ersetzt nicht die Tokenprüfung.

Normale Fehler verwenden ein stabiles JSON-Format:

~~~json
{
  "ok": false,
  "error": {
    "code": "AMBIGUOUS_PAL_NAME",
    "message": "Multiple Pals match the supplied name.",
    "candidates": []
  },
  "reference_id": "..."
}
~~~

Die Authentifizierungs-404 enthält absichtlich keine solche Diagnose.

## API-Endpunkte

Basis:

~~~text
https://palworld-breeding-api.<CLOUDFLARE_SUBDOMAIN>.workers.dev/<TOKEN>/v1
~~~

### GET /status

Kleine Zustandsantwort für den ersten ChatGPT-Abruf:

- ok
- api_schema_version
- breeding_reference_schema_version
- game_reference
- source_commit, sofern nachweisbar
- generated_at_utc
- data_hash
- pal_count
- special_combination_count
- pair_count
- validation_status
- known_patch_check_status
- verfügbare Endpunkte

Der Patchstatus darf nur current lauten, wenn dies aus den kanonischen Metadaten tatsächlich hervorgeht. Ansonsten gilt unknown oder needs_review.

### GET /pal?name=<NAME>

Löst deutschen, englischen oder internen Namen normalisiert auf. Die Antwort enthält interne ID und Namen, Variantenstatus, CombiRank, Seltenheit, IgnoreCombi, CombiDuplicatePriority, InternalIndex und Referenzmetadaten.

Bei Mehrdeutigkeit wird eine Kandidatenliste zurückgegeben. Die API rät nicht.

### GET /pair

Parameter:

- parent_a
- parent_b
- gender_a = MALE, FEMALE oder ANY
- gender_b = MALE, FEMALE oder ANY
- optional explain=true oder detail=full

Beispiel:

~~~text
/<TOKEN>/v1/pair?parent_a=Elphidran&parent_b=Surfent&gender_a=FEMALE&gender_b=MALE
~~~

Die Antwort nennt normalisierte Eltern, Kind, angewandte Regel, Spezialzeile und Geschlechtsbedingung oder Zielrang, Kandidaten und Tie-Break der Formel. Fehlt bei einer geschlechtsabhängigen Spezialkombination die notwendige Geschlechtsinformation, werden die möglichen Alternativen strukturiert ausgegeben.

`ANY` bedeutet eine noch nicht festgelegte, praktisch gegengeschlechtliche Zuchtorientierung. Zwei ausdrücklich gleichgeschlechtliche Eltern werden mit `INCOMPATIBLE_GENDERS` und HTTP 400 abgelehnt; die API erzeugt dafür keinen künstlichen Formel-Fallback.

### GET /parents?child=<NAME>

Liefert alle gültigen Elternpaare eines Ziel-Pals.

Optionale Filter:

- parent
- gender
- special_only = true oder false
- max_results
- offset
- detail = compact oder full

Die Antwort enthält Gesamtzahl, stabile Pagination, Elternarten, notwendige Geschlechter, Regeltyp und Spezialzeile beziehungsweise Formelmetadaten.

### GET /children?parent=<NAME>

Liefert mögliche zweite Eltern und resultierende Kinder für einen vorhandenen Arten-Träger.

Optionale Filter:

- second_parent
- child
- max_results
- offset

Dieser Endpunkt plant Artenübergänge. Er bewertet keine Passive-Chancen.

### GET /route?carrier=<NAME>&target=<NAME>

Optionale Parameter:

- max_generations
- detail = compact oder full

Liefert die kürzeste theoretische Artenroute, notwendige zweite Elternarten, Geschlechtsbedingungen, Regeltypen und gleich kurze Alternativen. Jede Antwort muss species_route_only = true kennzeichnen.

Die Route berücksichtigt weder den realen Palbestand noch Passiven, IVs, Eierwahrscheinlichkeiten, Kuchenverbrauch oder gewünschte Kindgeschlechter.

### GET /reference

Liefert die kompakte maschinenlesbare Gesamtstruktur mit Regeln, Pal-Index, Spezialkombinationen, Geschlechtsbedingungen, Hashes und Schema. Dieser größere Endpunkt ist für umfassende Prüfungen vorgesehen; für gewöhnliche Fragen sind status, pal, pair oder parents effizienter.

### GET /validate

Liefert strukturelle Validierung und bekannte Konflikte:

- ok
- validation_status
- checked_pal_count
- checked_special_combination_count
- checked_pair_count
- error_count
- warning_count
- source_hashes
- generated_hashes
- fixture_status
- unresolved_conflicts
- release_blocked

Der Endpunkt gibt niemals Secrets aus.

## GitHub Actions

### Breeding API CI

Datei: ../../.github/workflows/breeding-api-ci.yml

Auslöser:

- Pull Requests nach main mit relevanten Pfadänderungen
- Pushes auf main, feature/** und release/** mit relevanten Pfadänderungen

Die CI installiert reproduzierbar, generiert, lintet, prüft Typen und Tests, validiert strukturell und für Release, prüft Determinismus und scannt auf Secrets. Wegen des aktuellen kanonischen Konflikts ist die Release-Stufe erwartungsgemäß rot.

### Deploy Breeding API

Datei: ../../.github/workflows/deploy-breeding-api.yml

Der Workflow ist ausschließlich manuell über Actions → Deploy Breeding API → Run workflow startbar. Er wiederholt alle Prüfungen und erreicht wrangler deploy nur, wenn validate:release erfolgreich ist.

Der Deployment-Job läuft ausschließlich vom Ref `refs/heads/main` und verwendet das GitHub-Environment `production`. Konfiguriere unter **Settings → Environments → production** zusätzlich eine Deployment-Branch-Policy nur für `main` und nach Möglichkeit einen Required Reviewer. Ein manuell ausgewählter Feature-Branch kann dadurch nicht direkt den Produktions-Worker überschreiben.

Für die endgültige Least-Privilege-Konfiguration sollten `CLOUDFLARE_API_TOKEN` und `CLOUDFLARE_ACCOUNT_ID` als Secrets im Environment `production` angelegt werden. Nach einem erfolgreichen Workflow-Test können die gleichnamigen Repository-Secrets entfernt werden; der Workflowzugriff `secrets.<NAME>` bleibt unverändert.

Er verwendet:

- GitHub-Secret CLOUDFLARE_API_TOKEN
- GitHub-Secret CLOUDFLARE_ACCOUNT_ID

BREEDING_READ_TOKEN wird absichtlich nicht an GitHub Actions übergeben. Das Deployment verwendet --keep-vars, damit ein bereits gesetztes Worker-Secret nicht gelöscht oder überschrieben wird.

## Erstes Deployment

Das erste Deployment darf erst nach fachlicher Auflösung beider blockierender Konflikte erfolgen.

1. Aktuelle direkte Palworld-Spieldaten beziehungsweise verlässliche Primärquellen prüfen.
2. Entscheiden, ob die kanonischen Daten aktualisiert werden müssen oder ob die Aufgabenannahme Surfent falsch war.
3. Den letzten Gleichstands-Fallback in `breeding_rules.json` anhand direkter Spieldaten ausdrücklich festschreiben.
4. Nur fachlich belegte Regeln oder Daten korrigieren; keine Release-Prüfung umgehen.
5. Lokal die gesamte Prüfkette einschließlich `pnpm run validate:release` ausführen.
6. Änderungen committen, Pull Request prüfen und mergen.
7. In GitHub kontrollieren, dass `CLOUDFLARE_API_TOKEN` und `CLOUDFLARE_ACCOUNT_ID` als Repository-Secrets existieren.
8. Unter Settings → Environments → production die Deployment-Branch-Policy auf `main` beschränken, nach Möglichkeit einen Required Reviewer setzen und die beiden Cloudflare-Credentials als Environment-Secrets anlegen.
9. Actions → Deploy Breeding API → Run workflow auf `main` ausführen.
10. Nach erfolgreichem Bootstrap-Deployment das Worker-Secret `BREEDING_READ_TOKEN` setzen.
11. Korrekten Token gegen `/status` und `/validate` testen.
12. Einen falschen Token testen; erwartet wird HTTP 404.
13. Nach erfolgreichem Environment-Secret-Test die gleichnamigen Repository-Secrets entfernen.
14. Die endgültige workers.dev-Adresse und den echten Lesecode ausschließlich in den privaten ChatGPT-Projekthinweisen oder einer privaten Projektquelle hinterlegen.

Bis BREEDING_READ_TOKEN gesetzt ist, sollen geschützte API-Routen neutral mit 404 antworten.

## BREEDING_READ_TOKEN setzen

Empfohlen ist ein zufälliger Wert mit mindestens 32 Zufallsbytes, beispielsweise 64 Hex-Zeichen. Nicht als Befehlsargument, Datei oder normale Cloudflare-Variable speichern.

Cloudflare-Dashboard:

1. Workers & Pages öffnen.
2. palworld-breeding-api auswählen.
3. Settings → Variables and Secrets öffnen.
4. Add variable wählen.
5. Name BREEDING_READ_TOKEN.
6. Typ Secret.
7. Wert einfügen und die neue Worker-Version speichern beziehungsweise deployen.

Alternativ nach vorhandenem Worker mit Wrangler:

~~~powershell
cd services/breeding-api
pnpm exec wrangler secret put BREEDING_READ_TOKEN
~~~

Wrangler fragt den Wert verdeckt ab. Der Wert gehört nicht in die Shell-History.

## Tokenrotation

1. Neuen zufälligen Lesecode erzeugen und sicher zwischenspeichern.
2. BREEDING_READ_TOKEN im Dashboard oder mit wrangler secret put ersetzen.
3. /status mit dem neuen Token prüfen.
4. Sicherstellen, dass das alte Token HTTP 404 erhält.
5. Den privaten ChatGPT-Projekthinweis beziehungsweise die private Projektquelle aktualisieren.
6. Alte lokale Notizen des Tokens entfernen.

Die GitHub-Deployment-Secrets müssen für eine reine Lesecode-Rotation nicht geändert werden.

## Rollback

Schneller Cloudflare-Rollback:

1. Cloudflare Dashboard → Worker → Deployments beziehungsweise Versions öffnen.
2. Letzte bekannte gute Version auswählen.
3. Diese Version erneut deployen.
4. Prüfen, dass BREEDING_READ_TOKEN weiterhin als Secret gebunden ist.
5. /status, /validate und bekannte Paarungen testen.

Repository-Rollback:

1. Fehlerhaften API-Commit per normalem Revert rückgängig machen; kein git reset --hard verwenden.
2. CI vollständig ausführen.
3. Nach erfolgreichem validate:release den manuellen Deployment-Workflow starten.

Kanonische Datendateien nicht unabhängig auf einen älteren Stand zurücksetzen, ohne Manifest, Quellen-Pins und Patchbezug gemeinsam zu prüfen.

## Patch- und Versionsstrategie

- Beim ersten Zuchtauftrag eines neuen ChatGPT-Chats zuerst /status prüfen.
- game_reference und generated_at_utc mit manifest.json und dem aktuellen Palworld-Patch vergleichen.
- Ein neuer Patch macht den Datensatz nicht automatisch falsch, verlangt aber eine Prüfung auf Zuchtwerte, Spezialkombinationen, Geschlechter und Vererbungsregeln.
- known_patch_check_status bleibt unknown oder needs_review, solange keine belegte aktuelle Prüfung gespeichert wurde.
- Aktualisierungen der kanonischen Daten erfolgen über den bestehenden Referenzgenerator und gepinnte Quellen-Commits.
- Datenänderungen werden nie ungeprüft automatisch als gültig veröffentlicht.
- Nach jeder kanonischen Änderung: Generator, Tests, strukturelle Validierung, Release-Validierung, Determinismus und Secret-Scan ausführen.
- API-Schema und kanonisches Schema werden getrennt versioniert.

## Fehlerbehebung

| Symptom | Prüfung |
|---|---|
| Jeder Request liefert 404 | Worker-Adresse und Pfad prüfen; kontrollieren, ob BREEDING_READ_TOKEN als Worker-Secret gesetzt ist. |
| Nur falscher Token liefert 404 | Erwartetes Verhalten. |
| validate:release schlägt mit SIBELYX_LAMBALL_ASSIGNMENT_CONFLICT fehl | Kanonischer, aktuell bekannter Blocker; nicht umgehen. |
| validate:release meldet UNDOCUMENTED_EQUAL_RARITY_SOURCE_ORDER_FALLBACK | `breeding_rules.json` benötigt einen belegten letzten Gleichstands-Fallback; nicht stillschweigend freigeben. |
| Determinismusprüfung schlägt fehl | Zeitstempel, unsortierte Maps/Sets oder nicht stabile Dateiausgabe prüfen. |
| GitHub-Deployment findet Credentials nicht | Repository-Secrets CLOUDFLARE_API_TOKEN und CLOUDFLARE_ACCOUNT_ID prüfen. |
| Worker deployt, aber Referenz fehlt | pnpm run generate und Wrangler-Bundlepfad prüfen. |
| Palname ist mehrdeutig | Internen Namen verwenden oder einen Kandidaten aus der strukturierten Antwort wählen. |
| Patchstatus ist unknown | Aktuellen Patch gegen manifest.json und direkte Quellen prüfen; nicht current erfinden. |

## Grenzen

- Die API liefert Arten- und Zuchtregeln, keine vollständige praktische Passive-Optimierung.
- Nutzerbestand, Geschlechterverfügbarkeit, Passiven, unerwünschte Passiven, IVs, Alpha-/Glücksstatus, Eier-, Kuchen- und Zeitkosten müssen zusätzlich geplant werden.
- /route optimiert primär Generationenzahl, nicht erwartete Eierzahl oder Vererbungswahrscheinlichkeit.
- Ein theoretisch kürzester Weg kann praktisch schlechter als eine längere, sauberere Passive-Linie sein.
- Die Daten sind ein Snapshot und nicht automatisch live mit Palworld synchronisiert.
- Der URL-Token schützt nicht vor jemandem, der die vollständige URL bereits kennt.
- Die API ist absichtlich read-only und bietet keine Bestandsverwaltung.
