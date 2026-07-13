# Palworld Breeding API

Read-only Cloudflare-Worker-API für schnelle, reproduzierbare Palworld-Zuchtberechnungen. Der Worker verwendet ausschließlich beim Build erzeugte Repository-Daten und ruft zur Laufzeit weder GitHub noch externe Zuchtrechner auf.

## Aktuelle Zugriffswege

Der Worker stellt dieselbe kanonische Resolverlogik auf zwei Wegen bereit:

1. **Öffentliches MCP:** anonymer Streamable-HTTP-Endpunkt `/mcp`.
2. **Geschützte REST-API:** `/<BREEDING_READ_TOKEN>/v1/...`.

Der MCP-Endpunkt delegiert intern an die vorhandenen REST-Route-Handler. Es gibt keine zweite Zuchtimplementierung und keine abweichende Datenquelle.

Das öffentliche MCP bietet genau diese fünf read-only Tools:

- `breeding_status`
- `breeding_pair`
- `breeding_parents`
- `breeding_children`
- `breeding_route`

Alle fünf Tools sind als read-only, nicht destruktiv und idempotent beschrieben. Das öffentliche MCP enthält keine Token-, Verwaltungs-, Schreib- oder Deploymentfunktionen.

Der öffentliche MCP-Zugang wurde am 13.07.2026 aus ChatGPT über die verbundene App **Breeder** erfolgreich geprüft. Die konkrete Worker-Basisadresse und der geschützte REST-Token werden absichtlich nicht in diesem öffentlichen Repository gespeichert.

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

Das Release-Gate ist grün; es bestehen keine ungelösten fachlichen Konflikte. Der öffentliche MCP-Ausbau aus PR #4 hat die kanonischen Daten nicht verändert.

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

Der vollständige Policyvergleich steht in `generated/special-child-impact.json`. Die separate Bestandsanalyse unter `../../data/palworld-breeding/analysis/anubis_jolthog_route.json` ist ebenfalls auf Schema 4 aktualisiert.

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

Alle direkten Dependencies sind exakt auf die im Lockfile aufgelösten Versionen gepinnt. Drittanbieter-GitHub-Actions sind auf bestätigte vollständige Commit-SHAs festgeschrieben.

## Geschützte REST-API

Geschützte Basis:

```text
https://palworld-breeding-api.<CLOUDFLARE_SUBDOMAIN>.workers.dev/<BREEDING_READ_TOKEN>/v1
```

`BREEDING_READ_TOKEN` ist ein Cloudflare-Worker-Secret. Es wird niemals committed, ausgegeben oder an GitHub Actions übergeben. Fehlender oder falscher Token liefert eine neutrale HTTP-404-Antwort. Unterstützt werden `GET`, `HEAD` und notwendige `OPTIONS`; schreibende Methoden liefern nach erfolgreicher Authentifizierung HTTP 405.

Antworten verwenden JSON, ETag, Cache-Control, `nosniff`, `noindex` und CORS für die nicht vertraulichen Read-only-Daten.

REST-Endpunkte:

- `GET /status`: kompakter Schema-, Hash-, Zähler-, Patch- und Validierungsstatus
- `GET /pal?name=<NAME>`: deutsche, englische und interne Namensauflösung
- `GET /pair?...`: direkte Paarung samt Regel, Kandidaten und Tie-Break
- `GET /parents?child=<NAME>`: alle Elternorientierungen eines Ziel-Pals
- `GET /children?parent=<NAME>`: zweite Eltern und Kinder eines Trägers
- `GET /route?carrier=<NAME>&target=<NAME>`: theoretisch kürzeste Artenrouten
- `GET /reference`: vollständige maschinenlesbare Referenz
- `GET /validate`: Validierung, beide Hasharten, Patchcheck und Impact-Zusammenfassung

## Öffentliches MCP

Der MCP-Endpunkt liegt direkt unter `/mcp` und benötigt keine Authentifizierung. Er verwendet das offizielle `@modelcontextprotocol/sdk` im zustandslosen Streamable-HTTP-JSON-Modus.

Zuordnung der Tools zu den bestehenden Route-Handlern:

| MCP-Tool | Interner Handler |
|---|---|
| `breeding_status` | `/v1/status` |
| `breeding_pair` | `/v1/pair` |
| `breeding_parents` | `/v1/parents` |
| `breeding_children` | `/v1/children` |
| `breeding_route` | `/v1/route` |

`/pal`, `/reference` und `/validate` sind bewusst nicht als öffentliche MCP-Tools exponiert. Status- und Validierungsinformationen, die für den normalen Pluginbetrieb nötig sind, werden über `breeding_status` geliefert.

## Grenzen von Routen

REST und MCP liefern bei einer Route ausdrücklich:

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

`manifest.patch_check` nennt Version `1.0`, Prüftag `2026-07-13`, Status `current`, keine verifizierte Buildnummer und `requires_recheck_after_newer_patch = true`. `current` gilt nur für diese Version und dieses Datum. Ein neuerer Patch verlangt eine erneute Zuchtrelevanzprüfung.

## CI und Deployment

`Breeding API CI` installiert mit `--frozen-lockfile`, validiert die bestehende Root-PWA, generiert beide Artefakte, prüft auf nicht committete Generated-Abweichungen, lintet, typprüft, testet, baut den Worker trocken, validiert strukturell und für Release, prüft Determinismus und scannt Secrets. Feature-Branches deployen nicht.

Der PR-Head des öffentlichen MCP-Ausbaus wurde am 13.07.2026 erfolgreich durch `Breeding API CI` und die Root-PWA-Validierung geprüft.

Die früher schreibenden Workflows `Build Palworld Breeding Reference` und `Analyze Anubis Breeding Route` sind auf read-only Validierung umgestellt. Sie können Schema-4-Daten beziehungsweise die geprüfte Analyse nicht mehr automatisch mit älterer Logik überschreiben.

`Deploy Breeding API` ist manuell, nur auf `main`, verwendet das GitHub-Environment `production`, wiederholt die gesamte Freigabekette und deployt erst danach mit `pnpm exec wrangler deploy --keep-vars`. Dadurch bleibt das vorhandene Worker-Secret erhalten.

## Grenzen und Rollback

Die API verwaltet keinen Nutzerbestand und modelliert keine Passive-Chancen, IVs, Mutationen, Eier-, Kuchen- oder Zeitkosten. Ein theoretisch kürzester Artenweg kann praktisch schlechter sein als eine längere saubere Linie.

Cloudflare-Rollback erfolgt über die letzte gute Worker-Version. Repository-Rollback erfolgt mit einem normalen `git revert`, danach vollständiger CI- und Release-Prüfung; kein Hard Reset und keine isolierte Rücksetzung kanonischer Daten ohne Manifest-/Patchabgleich.

## Dauerhafte Übergabe

Nach materiellen Änderungen an Daten, API, MCP, CI oder Deployment muss `HANDOFF_CHATGPT.md` im selben Arbeitsgang aktualisiert werden. Der Handoff speichert technische Entscheidungen, aktuellen Stand, Validierung und offene Schritte, aber niemals persönliche Chatverläufe, Tokens, Secretwerte oder authentifizierte URLs.
