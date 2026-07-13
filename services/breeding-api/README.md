# Palworld Breeding API

Read-only Cloudflare-Worker-API für schnelle, reproduzierbare Palworld-Zuchtberechnungen. Der Worker verwendet ausschließlich beim Build erzeugte Repository-Daten und ruft zur Laufzeit weder GitHub noch externe Zuchtrechner auf.

## Fachlicher Stand

Die Referenz ist für Palworld 1.0 am 13.07.2026 geprüft. Zwei direkt erzeugte und ausgebrütete Eier bestätigen:

- `Lunaris MALE + Grintale FEMALE → Penking`
- `Sibelyx + Lamball → Surfent`

Daraus gelten global:

1. Gleiche Art ergibt zuerst wieder dieselbe Art.
2. Danach gelten direkte Spezialkombinationen samt Geschlechtsvorgaben.
3. Spezialkinder, also alle Arten aus `special_combinations.child_internal`, sind keine normalen Formel-Kandidaten. Ihre Same-Species-Zucht und Spezialkombinationen bleiben gültig.
4. Der normale Pool verlangt `CombiRank > 0`, `IgnoreCombi = false` und keine Spezialkind-Art.
5. Bei vollständig gleichem Cross-Rank-Abstand nach den Seltenheitsregeln gewinnt der höhere `CombiRank`.
6. Same-Rank-Duplikate verwenden separat `CombiDuplicatePriority`, Nicht-Variante und interne Reihenfolge.
7. Paldeck-Nummern beeinflussen weder Zuchtwert noch Tie-Break.

Palworld.gg wurde für die beiden Testfälle ausschließlich manuell und nicht-kanonisch gegengeprüft. Es ist keine Build-, Release- oder Runtime-Abhängigkeit.

Das unveränderte Release-Gate ist lokal grün; es bestehen keine ungelösten fachlichen Konflikte. In diesem Arbeitslauf wird trotzdem nicht deployt.

## Kanonische Quellen und Zähler

Verbindliche Lesereihenfolge:

1. `../../data/palworld-breeding/breeding_rules.json`
2. `../../data/palworld-breeding/special_combinations.json`
3. `../../data/palworld-breeding/pal_values.json`
4. `../../data/palworld-breeding/manifest.json`

Aktueller Stand:

- kanonisches Schema: 4
- API-/Artefaktschema: 2
- Pals: 299
- Spezialkombinationen: 136
- eindeutige Spezialkind-Arten: 90
- zulässige normale Formel-Kinder: 184 statt zuvor 261
- ungeordnete Artenpaare einschließlich Same-Species: 44.850
- durch die Spezialkindregel geänderte Paarergebnisse: 13.785
- `source_data_hash`: `77901fb00c984e360f563049f2e7f3dc64a6b2d764e77f3c32a737ef4bc82121`
- `generated_artifact_hash`: `882987ec7c8a1eae7855e9bb3d995b79cb0aa498da2042c00fa6faec326ad9b8`

`source_data_hash` hasht deterministisch die vier kanonischen Eingabedateien. `generated_artifact_hash` hasht den kanonisch serialisierten generierten Referenzinhalt, wobei seine eigenen Hashfelder ausgeschlossen werden. Beide Begriffe werden öffentlich nicht vermischt.

Der vollständige Policyvergleich steht in `generated/special-child-impact.json`. Er enthält für jede Änderung Eltern, altes Kind, neues Kind, betroffene Spezialkind-Art, Special-Status und bekannte Routenlabels. Die separate Bestandsanalyse unter `../../data/palworld-breeding/analysis/anubis_jolthog_route.json` ist ebenfalls auf Schema 4 aktualisiert.

## Bekannte Routenänderungen

- `Sibelyx + Lamball`: Gobfin Ignis → **Surfent**
- `Anubis + Eikthyrdeer Terra`: Kingpaca Cryst → **Bakemi**
- `Anubis + Panthalus`: Dualith Noct → **Knocklem**
- `Dualith Noct + Jolthog`: Elphidran Aqua → **Vanwyrm**
- `Kingpaca Cryst + Jolthog → Elphidran` bleibt gültig.
- `Elphidran + Surfent → Elphidran Aqua` bleibt als Spezialkombination gültig.

Die frühere direkte Zweistufen-Abkürzung vom schmutzigen Anubis über einen beliebigen blanken Mate und anschließend den festen Jolthog liefert unter Schema 4 keinen Elphidran, Surfent oder Elphidran Aqua. Längere Routen bleiben möglich.

## Architektur

Der Generator validiert Schema, Regeln, IDs, Zähler, Patchstatus und Querverweise und erzeugt:

- `generated/reference.json`
- `generated/special-child-impact.json`
- Pal- und Aliasindex
- gepackte 44.850-Paar-Matrix
- beide konkrete Gegen-Geschlechtsorientierungen für geschlechtsabhängige Paare
- Reverse-Elternindex
- gerichteten Carrier-Graph
- Patch-, Hash- und Validierungsmetadaten

Für jedes verschiedene Artenpaar werden `A MALE + B FEMALE` und `A FEMALE + B MALE` durch dieselbe Resolverlogik ausgewertet. Greift nur in einer Richtung ein Special, fällt die Gegenrichtung auf die normale Formel zurück. `ANY` wird nur verwendet, wenn beide realen Orientierungen dasselbe vollständige Ergebnis besitzen. Forward-, Reverse-, Kinder- und Carrier-Indizes werden gemeinsam getestet.

Quelltexte werden vor Hashing und Parsing auf LF normalisiert. Generierung und Impact-Report sind für identische Quellen deterministisch.

## Lokale Befehle

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

Alle direkten Dependencies sind exakt auf die im Lockfile aufgelösten Versionen gepinnt. Drittanbieter-GitHub-Actions sind in allen Workflows auf bestätigte vollständige Commit-SHAs festgeschrieben.

## Zugriffsschutz und HTTP

Geschützte Basis:

```text
https://palworld-breeding-api.<CLOUDFLARE_SUBDOMAIN>.workers.dev/<BREEDING_READ_TOKEN>/v1
```

`BREEDING_READ_TOKEN` ist ein Cloudflare-Worker-Secret. Es wird niemals committed, ausgegeben oder an GitHub Actions übergeben. Fehlender oder falscher Token liefert eine neutrale HTTP-404-Antwort. Unterstützt werden `GET`, `HEAD` und notwendige `OPTIONS`; schreibende Methoden liefern nach erfolgreicher Authentifizierung HTTP 405.

Antworten verwenden JSON, ETag, Cache-Control, `nosniff`, `noindex` und CORS für die nicht vertraulichen Read-only-Daten.

## Endpunkte

- `GET /status`: kompakter Schema-, Hash-, Zähler-, Patch- und Validierungsstatus
- `GET /pal?name=<NAME>`: deutsche, englische und interne Namensauflösung
- `GET /pair?...`: direkte Paarung samt Regel, Kandidaten und Tie-Break
- `GET /parents?child=<NAME>`: alle Elternorientierungen eines Ziel-Pals
- `GET /children?parent=<NAME>`: zweite Eltern und Kinder eines Trägers
- `GET /route?carrier=<NAME>&target=<NAME>`: theoretisch kürzeste Artenrouten
- `GET /reference`: vollständige maschinenlesbare Referenz
- `GET /validate`: Validierung, beide Hasharten, Patchcheck und Impact-Zusammenfassung

`/route` liefert ausdrücklich:

```json
{
  "species_route_only": true,
  "inventory_aware": false,
  "passive_aware": false,
  "iv_aware": false,
  "unwanted_passives_aware": false,
  "egg_cost_aware": false,
  "cake_cost_aware": false,
  "time_cost_aware": false,
  "offspring_gender_feasibility_checked": false
}
```

Eine Artenroute ist daher weder eine bestands-, passiv-, geschlechts- noch kostenoptimierte praktische Zuchtplanung.

## Patchstatus

`manifest.patch_check` nennt Version `1.0`, Prüftag `2026-07-13`, Status `current`, keine verifizierte Buildnummer und `requires_recheck_after_newer_patch = true`. `current` gilt nur für diese Version und dieses Datum. `/status` und `/validate` spiegeln diese Details unverändert; ein neuerer Patch verlangt eine erneute Zuchtrelevanzprüfung.

## CI und Deployment

`Breeding API CI` installiert mit `--frozen-lockfile`, validiert die bestehende Root-PWA, generiert beide Artefakte, prüft auf nicht committete Generated-Abweichungen, lintet, typprüft, testet, baut den Worker trocken, validiert strukturell und für Release, prüft Determinismus und scannt Secrets. Feature-Branches deployen nicht.

Die früher schreibenden Workflows `Build Palworld Breeding Reference` und `Analyze Anubis Breeding Route` sind auf read-only Validierung umgestellt. Sie können Schema-4-Daten beziehungsweise die geprüfte Analyse nicht mehr automatisch mit älterer Logik überschreiben.

`Deploy Breeding API` ist manuell, nur auf `main`, verwendet das GitHub-Environment `production`, wiederholt die gesamte Freigabekette und deployt erst danach mit `pnpm exec wrangler deploy --keep-vars`. In diesem Codex-Lauf wird der Workflow nicht gestartet und kein Secret verändert.

Manuelle Erstbereitstellung nach Merge:

1. Environment `production`, Main-Policy und Cloudflare-Credentials prüfen.
2. Workflow `Deploy Breeding API` auf `main` manuell starten.
3. Erst nach dem ersten Worker-Deployment `BREEDING_READ_TOKEN` im Cloudflare-Dashboard oder interaktiv mit `pnpm exec wrangler secret put BREEDING_READ_TOKEN` setzen.
4. `/status`, `/validate`, bekannte Paarungen und einen falschen Token prüfen.
5. Basisadresse und Lesetoken nur in private ChatGPT-Projekthinweise übernehmen.

## Grenzen und Rollback

Die API verwaltet keinen Nutzerbestand und modelliert keine Passive-Chancen, IVs, Mutationen, Eier-, Kuchen- oder Zeitkosten. Ein theoretisch kürzester Artenweg kann praktisch schlechter sein als eine längere saubere Linie.

Cloudflare-Rollback erfolgt über die letzte gute Worker-Version. Repository-Rollback erfolgt mit einem normalen `git revert`, danach vollständiger CI- und Release-Prüfung; kein Hard Reset und keine isolierte Rücksetzung kanonischer Daten ohne Manifest-/Patchabgleich.
